const {
  listRoles,
  getRoleById,
  createNewRole,
  updateExistingRole,
  getRolePermissions,
  replaceRolePermissions,
} = require('./roles.service');

const { successResponse, createdResponse } = require('../../shared/response');
const { validationError } = require('../../shared/http-error');
const {
  createRoleSchema,
  updateRoleSchema,
  updateRolePermissionsSchema,
} = require('./roles.schema');

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

async function getRoles(req, res, next) {
  try {
    const roles = await listRoles({
      search: req.query.search,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Roles retrieved successfully',
      data: roles,
    });
  } catch (error) {
    return next(error);
  }
}

async function getRole(req, res, next) {
  try {
    const role = await getRoleById({
      id: parseId(req.params.id),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Role retrieved successfully',
      data: role,
    });
  } catch (error) {
    return next(error);
  }
}

async function postRole(req, res, next) {
  try {
    const role = await createNewRole({
      payload: parsePayload(createRoleSchema, req.body),
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'Role created successfully',
      data: role,
    });
  } catch (error) {
    return next(error);
  }
}

async function putRole(req, res, next) {
  try {
    const role = await updateExistingRole({
      id: parseId(req.params.id),
      payload: parsePayload(updateRoleSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Role updated successfully',
      data: role,
    });
  } catch (error) {
    return next(error);
  }
}

async function getPermissionsByRole(req, res, next) {
  try {
    const permissions = await getRolePermissions({
      id: parseId(req.params.id),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Role permissions retrieved successfully',
      data: permissions,
    });
  } catch (error) {
    return next(error);
  }
}

async function putPermissionsByRole(req, res, next) {
  try {
    const payload = parsePayload(updateRolePermissionsSchema, req.body);
    const permissions = await replaceRolePermissions({
      id: parseId(req.params.id),
      permissionIds: payload.permission_ids,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Role permissions updated successfully',
      data: permissions,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getRoles,
  getRole,
  postRole,
  putRole,
  getPermissionsByRole,
  putPermissionsByRole,
};
