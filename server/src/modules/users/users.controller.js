const {
  listUsers,
  getUserById,
  createNewUser,
  updateExistingUser,
  setUserActive,
  lockUser,
  unlockUser,
  setUserPassword,
  getUserRoles,
  replaceUserRoles,
} = require('./users.service');

const { successResponse, createdResponse } = require('../../shared/response');
const { validationError } = require('../../shared/http-error');
const {
  createUserSchema,
  updateUserSchema,
  updateUserActiveSchema,
  updateUserPasswordSchema,
  updateUserRolesSchema,
} = require('./users.schema');

function parseId(idValue) {
  const id = Number(idValue);

  if (!Number.isInteger(id) || id <= 0) {
    throw validationError('Validation failed', [
      {
        field: 'id',
        message: 'id must be a positive integer',
      },
    ]);
  }

  return id;
}

function parseBooleanQuery(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw validationError('Validation failed', [
    {
      field: 'active',
      message: 'active query must be true or false',
    },
  ]);
}

function parsePayload(schema, body) {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'body',
      message: issue.message,
    }));

    throw validationError('Validation failed', errors);
  }

  return parsed.data;
}

async function getUsers(req, res, next) {
  try {
    const users = await listUsers({
      search: req.query.search,
      active: parseBooleanQuery(req.query.active),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Users retrieved successfully',
      data: users,
    });
  } catch (error) {
    return next(error);
  }
}

async function getUser(req, res, next) {
  try {
    const user = await getUserById({
      id: parseId(req.params.id),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'User retrieved successfully',
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

async function postUser(req, res, next) {
  try {
    const payload = parsePayload(createUserSchema, req.body);
    const user = await createNewUser({
      payload,
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'User created successfully',
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

async function putUser(req, res, next) {
  try {
    const user = await updateExistingUser({
      id: parseId(req.params.id),
      payload: parsePayload(updateUserSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'User updated successfully',
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

async function patchUserActive(req, res, next) {
  try {
    const payload = parsePayload(updateUserActiveSchema, req.body);
    const user = await setUserActive({
      id: parseId(req.params.id),
      active: payload.active,
      actorUserId: req.user.id,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'User active status updated successfully',
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

async function postUserLock(req, res, next) {
  try {
    const user = await lockUser({
      id: parseId(req.params.id),
      actorUserId: req.user.id,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'User locked successfully',
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

async function postUserUnlock(req, res, next) {
  try {
    const user = await unlockUser({
      id: parseId(req.params.id),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'User unlocked successfully',
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

async function postUserPassword(req, res, next) {
  try {
    const payload = parsePayload(updateUserPasswordSchema, req.body);
    const user = await setUserPassword({
      id: parseId(req.params.id),
      password: payload.password,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'User password updated successfully',
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

async function getRolesByUser(req, res, next) {
  try {
    const roles = await getUserRoles({
      id: parseId(req.params.id),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'User roles retrieved successfully',
      data: roles,
    });
  } catch (error) {
    return next(error);
  }
}

async function putRolesByUser(req, res, next) {
  try {
    const payload = parsePayload(updateUserRolesSchema, req.body);
    const roles = await replaceUserRoles({
      id: parseId(req.params.id),
      roleIds: payload.role_ids,
      actorUserId: req.user.id,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'User roles updated successfully',
      data: roles,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getUsers,
  getUser,
  postUser,
  putUser,
  patchUserActive,
  postUserLock,
  postUserUnlock,
  postUserPassword,
  getRolesByUser,
  putRolesByUser,
};
