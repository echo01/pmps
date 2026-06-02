const {
  listRoles,
  getRoleById,
  createNewRole,
} = require('./roles.service');

const { successResponse, createdResponse } = require('../../shared/response');
const { validationError } = require('../../shared/http-error');
const { createRoleSchema } = require('./roles.schema');

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
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      throw validationError('Validation failed', [
        {
          field: 'id',
          message: 'id must be integer',
        },
      ]);
    }

    const role = await getRoleById({
      id,
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
    const parsed = createRoleSchema.safeParse(req.body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      throw validationError('Validation failed', errors);
    }

    const role = await createNewRole({
      payload: parsed.data,
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

module.exports = {
  getRoles,
  getRole,
  postRole,
};