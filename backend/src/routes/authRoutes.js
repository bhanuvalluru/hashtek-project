const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const redisHelper = require('../redis');
const emailService = require('../emailService');
const config = require('../config');

const router = express.Router();

/**
 * Middleware: Verify JWT Token for protected routes
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  jwt.verify(token, config.jwtSecret, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session. Please log in again.' });
    }
    req.user = decodedUser;
    next();
  });
}

/**
 * 1. REGISTRATION ROUTE
 * - Validates input
 * - Checks if already in PostgreSQL
 * - Hashes password
 * - Generates verification token
 * - Temporarily stores in REDIS (TTL: 15 minutes)
 * - Sends verification email
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are all required.' });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters long.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Step A: Check if user already exists in PostgreSQL
    const existingDbUser = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingDbUser.rows.length > 0) {
      return res.status(409).json({ error: 'This email is already registered and verified. Please log in.' });
    }

    // Step B: Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Step C: Generate unique verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Step D: Store pending registration details in REDIS
    // User is NOT added to PostgreSQL yet! Only in Redis with TTL.
    const pendingUserData = {
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      registeredAt: new Date().toISOString(),
    };

    await redisHelper.storePendingUser(verificationToken, pendingUserData, config.verificationTokenTtl);

    // Step E: Send email with verification link
    const mailResult = await emailService.sendVerificationEmail(normalizedEmail, trimmedName, verificationToken);

    return res.status(201).json({
      success: true,
      message: 'Registration received! A verification link has been sent to your email.',
      verificationToken, // Provided for easy local testing
      verificationUrl: mailResult.verificationUrl,
      expiresInMinutes: Math.round(config.verificationTokenTtl / 60),
    });
  } catch (err) {
    console.error('Error during registration:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

/**
 * 2. EMAIL VERIFICATION ROUTE
 * - Reads verification token
 * - Finds pending user in REDIS
 * - Inserts into PostgreSQL database
 * - Deletes from REDIS
 */
router.post('/verify', async (req, res) => {
  try {
    const token = req.body.token || req.query.token;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required.' });
    }

    // Step A: Lookup token in REDIS
    const pendingUser = await redisHelper.getPendingUserByToken(token);

    if (!pendingUser) {
      return res.status(400).json({
        error: 'Invalid or expired verification link. Please register again if your link expired.',
      });
    }

    // Step B: Check if already inserted (edge case safeguard)
    const checkUser = await db.query('SELECT id FROM users WHERE email = $1', [pendingUser.email]);
    if (checkUser.rows.length > 0) {
      await redisHelper.deletePendingUser(token, pendingUser.email);
      return res.status(200).json({
        success: true,
        message: 'Email was already verified! You can log in directly.',
      });
    }

    // Step C: Insert into PostgreSQL database
    const insertResult = await db.query(
      `INSERT INTO users (name, email, password, is_verified)
       VALUES ($1, $2, $3, true)
       RETURNING id, name, email, created_at`,
      [pendingUser.name, pendingUser.email, pendingUser.password]
    );

    const newUser = insertResult.rows[0];

    // Step D: Remove pending user from REDIS
    await redisHelper.deletePendingUser(token, pendingUser.email);

    console.log(`✅ [Verified & Saved to DB] User: ${newUser.name} (${newUser.email}) - ID: ${newUser.id}`);

    return res.status(200).json({
      success: true,
      message: 'Email successfully verified! Your account is now active. You can log in.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error('Error during email verification:', err);
    return res.status(500).json({ error: 'Internal server error during email verification.' });
  }
});

/**
 * 3. LOGIN ROUTE
 * - Only verified users stored in PostgreSQL are allowed to log in
 * - If still pending in REDIS, notifies user to check email
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Both email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Step A: Check PostgreSQL database
    const userQuery = await db.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const user = userQuery.rows[0];

    if (!user) {
      // Check if registration is still waiting in REDIS
      const isPending = await redisHelper.isEmailPending(normalizedEmail);
      if (isPending) {
        return res.status(403).json({
          error: 'Your email has not been verified yet! Please check your email inbox to verify before logging in.',
          pendingVerification: true,
        });
      }

      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Step B: Double-check verification flag
    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Your account is not verified yet. Please check your email.',
        pendingVerification: true,
      });
    }

    // Step C: Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Step D: Issue JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error('Error during login:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

/**
 * 4. CURRENT USER ROUTE (PROTECTED)
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userQuery = await db.query(
      'SELECT id, name, email, is_verified, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({
      success: true,
      user: userQuery.rows[0],
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * 5. SYSTEM STATUS & REDIS INSPECTOR (Beginner learning feature)
 * Shows the state of Redis cache and PostgreSQL database
 */
router.get('/status', async (req, res) => {
  try {
    const dbCountResult = await db.query('SELECT COUNT(*) FROM users');
    const verifiedUsersCount = parseInt(dbCountResult.rows[0].count, 10);
    const pendingInRedis = await redisHelper.listPendingUsers();

    return res.json({
      system: 'Online',
      database: {
        type: 'PostgreSQL',
        verifiedUsersCount,
      },
      redis: {
        type: 'Redis Cache (Temporary Storage)',
        pendingRegistrationsCount: pendingInRedis.length,
        pendingRegistrations: pendingInRedis,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
