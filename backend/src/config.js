require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_key_for_beginner_auth',
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
  postgres: {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgrespassword',
    database: process.env.DB_NAME || 'authdb',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'no-reply@authapp.local',
  },
  // Token expiration for Redis in seconds (15 minutes)
  verificationTokenTtl: parseInt(process.env.VERIFICATION_TOKEN_TTL, 10) || 900,
};
