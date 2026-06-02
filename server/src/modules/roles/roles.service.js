const {
  findRoles,
  findRoleById,
  findRoleByCode,
  createRole,
} = require('./roles.repository');

const { notFound, conflict } = require('../../shared/http-error');

async function listRoles({ search, requestId }) {
  console.info('[ROLES][LIST][START]', {
    requestId,
    search,
  });

  const roles = await findRoles({ search });

  console.info('[ROLES][LIST][SUCCESS]', {
    requestId,
    count: roles.length,
  });

  return roles;
}

async function getRoleById({ id, requestId }) {
  console.info('[ROLES][GET_BY_ID][START]', {
    requestId,
    id,
  });

  const role = await findRoleById(id);

  if (!role) {
    console.warn('[ROLES][GET_BY_ID][NOT_FOUND]', {
      requestId,
      id,
    });

    throw notFound('Role not found');
  }

  console.info('[ROLES][GET_BY_ID][SUCCESS]', {
    requestId,
    id,
  });

  return role;
}

async function createNewRole({ payload, requestId }) {
  console.info('[ROLES][CREATE][START]', {
    requestId,
    roleCode: payload.role_code,
  });

  const existingRole = await findRoleByCode(payload.role_code);

  if (existingRole) {
    console.warn('[ROLES][CREATE][DUPLICATE]', {
      requestId,
      roleCode: payload.role_code,
    });

    throw conflict('Role code already exists', [
      {
        field: 'role_code',
        message: 'role_code already exists',
      },
    ]);
  }

  const role = await createRole({
    roleCode: payload.role_code,
    roleName: payload.role_name,
  });

  console.info('[ROLES][CREATE][SUCCESS]', {
    requestId,
    roleId: role.id,
    roleCode: role.role_code,
  });

  return role;
}

module.exports = {
  listRoles,
  getRoleById,
  createNewRole,
};