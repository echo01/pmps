const { pool } = require('../../db/pool');

function getExecutor(client) {
  return client || pool;
}

async function findRoles({ search } = {}) {
  const values = [];
  let whereSql = '';

  if (search) {
    values.push(`%${search}%`);
    whereSql = `
      WHERE role_code ILIKE $1
         OR role_name ILIKE $1
    `;
  }

  const result = await pool.query(
    `
      SELECT
        id,
        role_code,
        role_name
      FROM app_role
      ${whereSql}
      ORDER BY id ASC
    `,
    values
  );

  return result.rows;
}

async function findRoleById(id, client) {
  const db = getExecutor(client);
  const result = await db.query(
    `
      SELECT
        id,
        role_code,
        role_name
      FROM app_role
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findRoleByCode(roleCode) {
  const result = await pool.query(
    `
      SELECT
        id,
        role_code,
        role_name
      FROM app_role
      WHERE role_code = $1
    `,
    [roleCode]
  );

  return result.rows[0] || null;
}

async function createRole({ roleCode, roleName }) {
  const result = await pool.query(
    `
      INSERT INTO app_role (
        role_code,
        role_name
      )
      VALUES ($1, $2)
      RETURNING
        id,
        role_code,
        role_name
    `,
    [roleCode, roleName]
  );

  return result.rows[0];
}

async function updateRole(id, { roleName }) {
  const result = await pool.query(
    `
      UPDATE app_role
      SET role_name = $2
      WHERE id = $1
      RETURNING
        id,
        role_code,
        role_name
    `,
    [id, roleName]
  );

  return result.rows[0] || null;
}

async function findPermissions() {
  const result = await pool.query(
    `
      SELECT
        id,
        permission_code,
        permission_name,
        description
      FROM app_permission
      ORDER BY permission_code ASC
    `
  );

  return result.rows;
}

async function findPermissionsByRoleId(roleId, client) {
  const db = getExecutor(client);
  const result = await db.query(
    `
      SELECT
        p.id,
        p.permission_code,
        p.permission_name,
        p.description
      FROM app_role_permission rp
      JOIN app_permission p
        ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.permission_code ASC
    `,
    [roleId]
  );

  return result.rows;
}

async function countPermissionsByIds(permissionIds, client) {
  if (!permissionIds.length) {
    return 0;
  }

  const db = getExecutor(client);
  const result = await db.query(
    `
      SELECT COUNT(*)::int AS count
      FROM app_permission
      WHERE id = ANY($1::int[])
    `,
    [permissionIds]
  );

  return result.rows[0].count;
}

async function deleteRolePermissions(roleId, client) {
  const db = getExecutor(client);
  await db.query(
    `
      DELETE FROM app_role_permission
      WHERE role_id = $1
    `,
    [roleId]
  );
}

async function insertRolePermissions(roleId, permissionIds, client) {
  if (!permissionIds.length) {
    return;
  }

  const db = getExecutor(client);
  await db.query(
    `
      INSERT INTO app_role_permission (role_id, permission_id)
      SELECT $1, unnest($2::int[])
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `,
    [roleId, permissionIds]
  );
}

module.exports = {
  findRoles,
  findRoleById,
  findRoleByCode,
  createRole,
  updateRole,
  findPermissions,
  findPermissionsByRoleId,
  countPermissionsByIds,
  deleteRolePermissions,
  insertRolePermissions,
};
