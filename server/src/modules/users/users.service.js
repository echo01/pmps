const bcrypt = require('bcrypt');

const {
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
  deleteUserRoles,
  insertUserRoles,
} = require('./users.repository');

const { withTransaction } = require('../../db/transaction');
const { conflict, notFound, validationError } = require('../../shared/http-error');

function uniqueIds(ids) {
  return [...new Set(ids)];
}

async function listUsers({ search, active, requestId }) {
  console.info('[USERS][LIST][START]', {
    requestId,
    search,
    active,
  });

  const users = await findUsers({ search, active });

  console.info('[USERS][LIST][SUCCESS]', {
    requestId,
    count: users.length,
  });

  return users;
}

async function getUserById({ id, requestId }) {
  console.info('[USERS][GET_BY_ID][START]', {
    requestId,
    userId: id,
  });

  const user = await findUserById(id);

  if (!user) {
    console.warn('[USERS][GET_BY_ID][NOT_FOUND]', {
      requestId,
      userId: id,
    });

    throw notFound('User not found');
  }

  console.info('[USERS][GET_BY_ID][SUCCESS]', {
    requestId,
    userId: id,
  });

  return user;
}

async function ensureEmployeeCodeAvailable(employeeCode, requestId, excludeUserId) {
  if (!employeeCode) {
    return;
  }

  const existingUser = await findUserByEmployeeCode(employeeCode, excludeUserId);

  if (existingUser) {
    console.warn('[USERS][EMPLOYEE_CODE][DUPLICATE]', {
      requestId,
      employeeCode,
      userId: existingUser.id,
    });

    throw conflict('Employee code already exists', [
      {
        field: 'employee_code',
        message: 'employee_code already exists',
      },
    ]);
  }
}

async function createNewUser({ payload, requestId }) {
  console.info('[USERS][CREATE][START]', {
    requestId,
    username: payload.username,
    employee_code: payload.employee_code,
  });

  const existingUser = await findUserByUsername(payload.username);

  if (existingUser) {
    console.warn('[USERS][CREATE][DUPLICATE_USERNAME]', {
      requestId,
      username: payload.username,
    });

    throw conflict('Username already exists', [
      {
        field: 'username',
        message: 'username already exists',
      },
    ]);
  }

  await ensureEmployeeCodeAvailable(payload.employee_code, requestId);

  const passwordHash = await bcrypt.hash(payload.password, 12);

  const user = await createUser({
    username: payload.username,
    passwordHash,
    employeeCode: payload.employee_code,
    fullName: payload.full_name,
    department: payload.department,
    email: payload.email,
    active: payload.active,
  });

  console.info('[USERS][CREATE][SUCCESS]', {
    requestId,
    userId: user.id,
    username: user.username,
  });

  return user;
}

async function updateExistingUser({ id, payload, requestId }) {
  console.info('[USERS][UPDATE][START]', {
    requestId,
    userId: id,
  });

  await getUserById({ id, requestId });
  await ensureEmployeeCodeAvailable(payload.employee_code, requestId, id);

  const user = await updateUser(id, payload);

  console.info('[USERS][UPDATE][SUCCESS]', {
    requestId,
    userId: id,
  });

  return user;
}

async function setUserActive({ id, active, requestId }) {
  console.info('[USERS][ACTIVE][START]', {
    requestId,
    userId: id,
    active,
  });

  await getUserById({ id, requestId });

  const user = await updateUserActive(id, active);

  console.info('[USERS][ACTIVE][SUCCESS]', {
    requestId,
    userId: id,
    active: user.active,
  });

  return user;
}

async function setUserPassword({ id, password, requestId }) {
  console.info('[USERS][PASSWORD][START]', {
    requestId,
    userId: id,
  });

  await getUserById({ id, requestId });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await updateUserPassword(id, passwordHash);

  console.info('[USERS][PASSWORD][SUCCESS]', {
    requestId,
    userId: id,
  });

  return user;
}

async function getUserRoles({ id, requestId }) {
  console.info('[USERS][ROLES_GET][START]', {
    requestId,
    userId: id,
  });

  await getUserById({ id, requestId });
  const roles = await findRolesByUserId(id);

  console.info('[USERS][ROLES_GET][SUCCESS]', {
    requestId,
    userId: id,
    count: roles.length,
  });

  return roles;
}

async function replaceUserRoles({ id, roleIds, requestId }) {
  const uniqueRoleIds = uniqueIds(roleIds);

  console.info('[USERS][ROLES_REPLACE][START]', {
    requestId,
    userId: id,
    roleIds: uniqueRoleIds,
  });

  const roles = await withTransaction(
    async (client) => {
      const user = await findUserById(id, client);

      if (!user) {
        throw notFound('User not found');
      }

      const existingRoleCount = await countRolesByIds(uniqueRoleIds, client);

      if (existingRoleCount !== uniqueRoleIds.length) {
        throw validationError('Validation failed', [
          {
            field: 'role_ids',
            message: 'one or more role_ids were not found',
          },
        ]);
      }

      await deleteUserRoles(id, client);
      await insertUserRoles(id, uniqueRoleIds, client);

      return findRolesByUserId(id, client);
    },
    {
      requestId,
      name: 'replace_user_roles',
    }
  );

  console.info('[USERS][ROLES_REPLACE][SUCCESS]', {
    requestId,
    userId: id,
    count: roles.length,
  });

  return roles;
}

module.exports = {
  listUsers,
  getUserById,
  createNewUser,
  updateExistingUser,
  setUserActive,
  setUserPassword,
  getUserRoles,
  replaceUserRoles,
};
