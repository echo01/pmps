const { pool } = require('../../db/pool');

async function findUserByUsername(username) {
  const result = await pool.query(
    `
      SELECT
        id,
        username,
        password_hash,
        employee_code,
        full_name,
        email,
        active,
        failed_login_count
      FROM app_user
      WHERE username = $1
    `,
    [username]
  );

  return result.rows[0] || null;
}

async function findRolesAndPermissionsByUserId(userId) {
  const result = await pool.query(
    `
      SELECT
        r.role_code,
        p.permission_code
      FROM app_user_role ur
      JOIN app_role r
        ON r.id = ur.role_id
      LEFT JOIN app_role_permission rp
        ON rp.role_id = r.id
      LEFT JOIN app_permission p
        ON p.id = rp.permission_id
      WHERE ur.user_id = $1
      ORDER BY r.role_code, p.permission_code
    `,
    [userId]
  );

  const roles = [...new Set(result.rows.map((row) => row.role_code))];

  const permissions = [
    ...new Set(
      result.rows
        .map((row) => row.permission_code)
        .filter(Boolean)
    ),
  ];

  return {
    roles,
    permissions,
  };
}

async function resetFailedLoginCount(userId) {
  await pool.query(
    `
      UPDATE app_user
      SET 
        failed_login_count = 0,
        last_login_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [userId]
  );
}

async function incrementFailedLoginCount(userId) {
  await pool.query(
    `
      UPDATE app_user
      SET 
        failed_login_count = COALESCE(failed_login_count, 0) + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [userId]
  );
}

async function insertLoginLog({
  userId,
  username,
  success,
  failureReason,
  ipAddress,
  userAgent,
}) {
  await pool.query(
    `
      INSERT INTO user_login_log (
        user_id,
        username,
        login_success,
        fail_reason,
        client_ip,
        machine_name,
        login_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `,
    [
      userId,
      username,
      success,
      failureReason,
      ipAddress,
      userAgent,
    ]
  );
}

module.exports = {
  findUserByUsername,
  findRolesAndPermissionsByUserId,
  resetFailedLoginCount,
  incrementFailedLoginCount,
  insertLoginLog,
};