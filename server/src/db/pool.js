const { Pool } = require('pg');
const { env } = require('../config/env');

const pool = new Pool({
  connectionString: env.databaseUrl,
});

pool.on('connect', () => {
  console.info('[DB][POOL][CONNECT]', {
    message: 'PostgreSQL client connected',
  });
});

pool.on('error', (error) => {
  console.error('[DB][POOL][ERROR]', {
    message: error.message,
  });
});

module.exports = { pool };