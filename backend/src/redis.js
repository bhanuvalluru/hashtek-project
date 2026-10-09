const Redis = require('ioredis');
const config = require('./config');

const redis = new Redis(config.redisUrl, {
  retryStrategy(times) {
    const delay = Math.min(times * 500, 2000);
    console.log(`[Redis] Retrying connection in ${delay}ms... (Attempt ${times})`);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  console.log('✅ [Redis] Connected successfully to Redis server!');
});

redis.on('error', (err) => {
  console.error('⚠️ [Redis] Error:', err.message);
});

// Helper: Store pending registration data temporarily
async function storePendingUser(token, userData, ttlInSeconds = config.verificationTokenTtl) {
  const tokenKey = `pending_user:${token}`;
  const emailKey = `pending_email:${userData.email}`;

  // Store user info under the token key
  await redis.set(tokenKey, JSON.stringify(userData), 'EX', ttlInSeconds);
  
  // Also store email -> token mapping so we know an email has a pending verification
  await redis.set(emailKey, token, 'EX', ttlInSeconds);
}

// Helper: Get pending user by token
async function getPendingUserByToken(token) {
  const data = await redis.get(`pending_user:${token}`);
  return data ? JSON.parse(data) : null;
}

// Helper: Check if an email is currently pending verification
async function isEmailPending(email) {
  return await redis.get(`pending_email:${email}`);
}

// Helper: Delete pending user keys after successful verification
async function deletePendingUser(token, email) {
  await redis.del(`pending_user:${token}`);
  if (email) {
    await redis.del(`pending_email:${email}`);
  }
}

// Helper: Get all pending registrations (useful for demo/debugging UI)
async function listPendingUsers() {
  const keys = await redis.keys('pending_user:*');
  const results = [];
  for (const key of keys) {
    const token = key.replace('pending_user:', '');
    const data = await redis.get(key);
    const ttl = await redis.ttl(key);
    if (data) {
      const parsed = JSON.parse(data);
      results.push({
        token,
        email: parsed.email,
        name: parsed.name,
        expiresInSeconds: ttl,
      });
    }
  }
  return results;
}

module.exports = {
  redis,
  storePendingUser,
  getPendingUserByToken,
  isEmailPending,
  deletePendingUser,
  listPendingUsers,
};
