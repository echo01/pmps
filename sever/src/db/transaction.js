const { pool } = require('./pool');

/**
 * Run database operations inside a PostgreSQL transaction.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback
 * @param {{ requestId?: string, name?: string }} options
 * @returns {Promise<T>}
 */
async function withTransaction(callback, options = {}) {
  const { requestId, name = 'default' } = options;

  const client = await pool.connect();

  try {
    console.info('[DB][TRANSACTION][BEGIN]', {
      requestId,
      name,
    });

    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');

    console.info('[DB][TRANSACTION][COMMIT]', {
      requestId,
      name,
    });

    return result;
  } catch (error) {
    console.error('[DB][TRANSACTION][ERROR]', {
      requestId,
      name,
      message: error.message,
      code: error.code,
      constraint: error.constraint,
    });

    try {
      await client.query('ROLLBACK');

      console.warn('[DB][TRANSACTION][ROLLBACK]', {
        requestId,
        name,
      });
    } catch (rollbackError) {
      console.error('[DB][TRANSACTION][ROLLBACK_ERROR]', {
        requestId,
        name,
        message: rollbackError.message,
      });
    }

    throw error;
  } finally {
    client.release();

    console.info('[DB][TRANSACTION][RELEASE]', {
      requestId,
      name,
    });
  }
}

module.exports = { withTransaction };