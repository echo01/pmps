const { pool } = require('../../db/pool');

function getExecutor(client) {
  return client || pool;
}

function mapUserRow(row) {
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

async function findUsers({ search, active } = {}) {
  const values = [];
  const where = [];

  if (search) {
    values.push(`%${search}%`);
    where.push(`
      (
        username ILIKE $${values.length}
        OR full_name ILIKE $${values.length}
        OR employee_code ILIKE $${values.length}
        OR email ILIKE $${values.length}
      )
    `);
  }

  if (typeof active === 'boolean') {
    values.push(active);
    where.push(`active = $${values.length}`);
  }

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
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY id ASC
    `,
    values
  );

  return result.rows.map(mapUserRow);
}

async function findUserById(id, client) {
  const db = getExecutor(client);
  const result = await db.query(
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
    [id]
  );

  return mapUserRow(result.rows[0]);
}

async function findUserByUsername(username) {
  const result = await pool.query(
    `
      SELECT id, username
      FROM app_user
      WHERE username = $1
    `,
    [username]
  );

  return result.rows[0] || null;
}

async function findUserByEmployeeCode(employeeCode, excludeUserId) {
  const values = [employeeCode];
  let excludeSql = '';

  if (excludeUserId) {
    values.push(excludeUserId);
    excludeSql = `AND id <> $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT id, employee_code
      FROM app_user
      WHERE employee_code = $1
      ${excludeSql}
    `,
    values
  );

  return result.rows[0] || null;
}

async function createUser({
  username,
  passwordHash,
  employeeCode,
  fullName,
  department,
  email,
  active,
}) {
  const result = await pool.query(
    `
      INSERT INTO app_user (
        username,
        password_hash,
        employee_code,
        full_name,
        department,
        email,
        active,
        failed_login_count,
        password_changed_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
    [
      username,
      passwordHash,
      employeeCode || null,
      fullName,
      department || null,
      email || null,
      active ?? true,
    ]
  );

  return mapUserRow(result.rows[0]);
}

async function updateUser(id, payload) {
  const fields = [];
  const values = [];

  const fieldMap = {
    employee_code: 'employee_code',
    full_name: 'full_name',
    department: 'department',
    email: 'email',
    active: 'active',
  };

  for (const [payloadKey, columnName] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(payload, payloadKey)) {
      values.push(payload[payloadKey]);
      fields.push(`${columnName} = $${values.length}`);
    }
  }

  values.push(id);

  const result = await pool.query(
    `
      UPDATE app_user
      SET
        ${fields.join(', ')},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
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
    values
  );

  return mapUserRow(result.rows[0]);
}

async function updateUserActive(id, active) {
  const result = await pool.query(
    `
      UPDATE app_user
      SET
        active = $2,
        failed_login_count = CASE WHEN $2 = true THEN 0 ELSE failed_login_count END,
        locked_until = CASE WHEN $2 = true THEN NULL ELSE locked_until END,
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
    [id, active]
  );

  return mapUserRow(result.rows[0]);
}

async function updateUserPassword(id, passwordHash) {
  const result = await pool.query(
    `
      UPDATE app_user
      SET
        password_hash = $2,
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
    [id, passwordHash]
  );

  return mapUserRow(result.rows[0]);
}

async function findRolesByUserId(userId, client) {
  const db = getExecutor(client);
  const result = await db.query(
    `
      SELECT
        r.id,
        r.role_code,
        r.role_name
      FROM app_user_role ur
      JOIN app_role r
        ON r.id = ur.role_id
      WHERE ur.user_id = $1
      ORDER BY r.id ASC
    `,
    [userId]
  );

  return result.rows;
}

async function countRolesByIds(roleIds, client) {
  if (!roleIds.length) {
    return 0;
  }

  const db = getExecutor(client);
  const result = await db.query(
    `
      SELECT COUNT(*)::int AS count
      FROM app_role
      WHERE id = ANY($1::int[])
    `,
    [roleIds]
  );

  return result.rows[0].count;
}

async function findRoleAccessByIds(roleIds, client) {
  if (!roleIds.length) {
    return [];
  }

  const db = getExecutor(client);
  const result = await db.query(
    `
      SELECT
        r.id AS role_id,
        r.role_code,
        p.permission_code
      FROM app_role r
      LEFT JOIN app_role_permission rp
        ON rp.role_id = r.id
      LEFT JOIN app_permission p
        ON p.id = rp.permission_id
      WHERE r.id = ANY($1::int[])
    `,
    [roleIds]
  );

  return result.rows;
}

async function deleteUserRoles(userId, client) {
  const db = getExecutor(client);
  await db.query(
    `
      DELETE FROM app_user_role
      WHERE user_id = $1
    `,
    [userId]
  );
}

async function insertUserRoles(userId, roleIds, client) {
  if (!roleIds.length) {
    return;
  }

  const db = getExecutor(client);
  await db.query(
    `
      INSERT INTO app_user_role (user_id, role_id)
      SELECT $1, unnest($2::int[])
      ON CONFLICT (user_id, role_id) DO NOTHING
    `,
    [userId, roleIds]
  );
}

module.exports = {
  findUsers,
  findUserById,
  findUserByUsername,
  findUserByEmployeeCode,
  createUser,
  updateUser,
  updateUserActive,
  updateUserPassword,
  findRolesByUserId,
  countRolesByIds,
  findRoleAccessByIds,
  deleteUserRoles,
  insertUserRoles,
};
