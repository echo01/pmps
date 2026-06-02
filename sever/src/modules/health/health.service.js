const { pool } = require('../../db/pool');

async function checkHealth() {
  const startedAt = Date.now();

  const dbResult = await pool.query('SELECT NOW() AS db_time');

  return {
    app: 'running',
    db: 'connected',
    db_time: dbResult.rows[0].db_time,
    response_time_ms: Date.now() - startedAt,
  };
}

module.exports = { checkHealth };