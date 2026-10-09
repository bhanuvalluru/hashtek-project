const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
});

// Auto-initialize tables and retry connection if database is still starting up
async function initDatabase(maxRetries = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Database] Connecting to PostgreSQL at ${config.postgres.host}:${config.postgres.port}... (Attempt ${attempt}/${maxRetries})`);
      const client = await pool.connect();
      
      // Create users table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          is_verified BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);

      client.release();
      console.log('✅ [Database] PostgreSQL connected and users table verified successfully!');
      return;
    } catch (err) {
      console.error(`⚠️ [Database] Connection failed: ${err.message}`);
      if (attempt === maxRetries) {
        console.error('❌ [Database] Max retries reached. Could not connect to PostgreSQL.');
        throw err;
      }
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  initDatabase,
  pool,
};
