async function insertDebugRole(client, roleCode, roleName) {
  const result = await client.query(
    `
      INSERT INTO app_role (
        role_code,
        role_name
      )
      VALUES ($1, $2)
      RETURNING id, role_code, role_name
    `,
    [roleCode, roleName]
  );

  return result.rows[0];
}

async function deleteDebugRoleByCode(client, roleCode) {
  await client.query(
    `
      DELETE FROM app_role
      WHERE role_code = $1
    `,
    [roleCode]
  );
}

async function findRoleByCode(client, roleCode) {
  const result = await client.query(
    `
      SELECT id, role_code, role_name
      FROM app_role
      WHERE role_code = $1
    `,
    [roleCode]
  );

  return result.rows[0] || null;
}

module.exports = {
  insertDebugRole,
  deleteDebugRoleByCode,
  findRoleByCode,
};
