const { pool } = require('../../db/pool');

function mapProfileRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    employee_code: row.employee_code,
    username: row.username,
    full_name: row.full_name,
    department: row.department,
    email: row.email,
    active: row.active,
    failed_login_count: row.failed_login_count,
    locked_until: row.locked_until,
    last_login_at: row.last_login_at,
    password_changed_at: row.password_changed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function findProfileById(userId) {
  const result = await pool.query(
    `
      SELECT
        id,
        employee_code,
        username,
        full_name,
        department,
        email,
        active,
        failed_login_count,
        locked_until,
        last_login_at,
        password_changed_at,
        created_at,
        updated_at
      FROM app_user
      WHERE id = $1
    `,
    [userId]
  );

  return mapProfileRow(result.rows[0]);
}

async function updateProfile(userId, payload) {
  const result = await pool.query(
    `
      UPDATE app_user
      SET
        full_name = $2,
        email = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING
        id,
        employee_code,
        username,
        full_name,
        department,
        email,
        active,
        failed_login_count,
        locked_until,
        last_login_at,
        password_changed_at,
        created_at,
        updated_at
    `,
    [userId, payload.full_name, payload.email || null]
  );

  return mapProfileRow(result.rows[0]);
}

async function findPasswordByUserId(userId) {
  const result = await pool.query(
    `
      SELECT
        id,
        password_hash
      FROM app_user
      WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function updateProfilePassword(userId, passwordHash) {
  const result = await pool.query(
    `
      UPDATE app_user
      SET
        password_hash = $2,
        failed_login_count = 0,
        locked_until = NULL,
        password_changed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING
        id,
        employee_code,
        username,
        full_name,
        department,
        email,
        active,
        failed_login_count,
        locked_until,
        last_login_at,
        password_changed_at,
        created_at,
        updated_at
    `,
    [userId, passwordHash]
  );

  return mapProfileRow(result.rows[0]);
}

module.exports = {
  findProfileById,
  updateProfile,
  findPasswordByUserId,
  updateProfilePassword,
};
