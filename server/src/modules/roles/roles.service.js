const {
  findRoles,
  findRoleById,
  findRoleByCode,
  createRole,
  updateRole,
  findPermissionsByRoleId,
  countPermissionsByIds,
  deleteRolePermissions,
  insertRolePermissions,
} = require('./roles.repository');

const { withTransaction } = require('../../db/transaction');
const { notFound, conflict, validationError } = require('../../shared/http-error');

function uniqueIds(ids) {
  return [...new Set(ids)];
}

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

async function updateExistingRole({ id, payload, requestId }) {
  console.info('[ROLES][UPDATE][START]', {
    requestId,
    roleId: id,
  });

  await getRoleById({ id, requestId });

  const role = await updateRole(id, {
    roleName: payload.role_name,
  });

  console.info('[ROLES][UPDATE][SUCCESS]', {
    requestId,
    roleId: id,
  });

  return role;
}

async function getRolePermissions({ id, requestId }) {
  console.info('[ROLES][PERMISSIONS_GET][START]', {
    requestId,
    roleId: id,
  });

  await getRoleById({ id, requestId });
  const permissions = await findPermissionsByRoleId(id);

  console.info('[ROLES][PERMISSIONS_GET][SUCCESS]', {
    requestId,
    roleId: id,
    count: permissions.length,
  });

  return permissions;
}

async function replaceRolePermissions({ id, permissionIds, requestId }) {
  const uniquePermissionIds = uniqueIds(permissionIds);

  console.info('[ROLES][PERMISSIONS_REPLACE][START]', {
    requestId,
    roleId: id,
    permissionIds: uniquePermissionIds,
  });

  const permissions = await withTransaction(
    async (client) => {
      const role = await findRoleById(id, client);

      if (!role) {
        throw notFound('Role not found');
      }

      const existingPermissionCount = await countPermissionsByIds(
        uniquePermissionIds,
        client
      );

      if (existingPermissionCount !== uniquePermissionIds.length) {
        throw validationError('Validation failed', [
          {
            field: 'permission_ids',
            message: 'one or more permission_ids were not found',
          },
        ]);
      }

      await deleteRolePermissions(id, client);
      await insertRolePermissions(id, uniquePermissionIds, client);

      return findPermissionsByRoleId(id, client);
    },
    {
      requestId,
      name: 'replace_role_permissions',
    }
  );

  console.info('[ROLES][PERMISSIONS_REPLACE][SUCCESS]', {
    requestId,
    roleId: id,
    count: permissions.length,
  });

  return permissions;
}

module.exports = {
  listRoles,
  getRoleById,
  createNewRole,
  updateExistingRole,
  getRolePermissions,
  replaceRolePermissions,
};
