const { pool } = require('../../db/pool');

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

async function findRoleById(id) {
  const result = await pool.query(
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

module.exports = {
  findRoles,
  findRoleById,
  findRoleByCode,
  createRole,
};