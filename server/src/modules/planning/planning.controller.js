const service = require('./planning.service');
const { successResponse, createdResponse } = require('../../shared/response');
const { validationError } = require('../../shared/http-error');
const {
  planningQuerySchema,
  createPlanSchema,
  updatePlanSchema,
  createTaskSchema,
  updateTaskSchema,
} = require('./planning.schema');

function parseId(idValue, field = 'id') {
  const id = Number(idValue);
  if (!Number.isInteger(id) || id <= 0) {
    throw validationError('Validation failed', [
      { field, message: `${field} must be a positive integer` },
    ]);
  }
  return id;
}

function parsePayload(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw validationError(
      'Validation failed',
      parsed.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }))
    );
  }
  return parsed.data;
}

function parseQuery(query) {
  return parsePayload(planningQuerySchema, query);
}

async function getDashboard(req, res, next) {
  try {
    return successResponse(res, {
      message: 'Planning dashboard retrieved successfully',
      data: await service.getPlanningDashboard({
        filters: parseQuery(req.query),
        requestId: req.requestId,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

async function getPlan(req, res, next) {
  try {
    return successResponse(res, {
      message: 'Planning record retrieved successfully',
      data: await service.getPlan({
        id: parseId(req.params.id),
        requestId: req.requestId,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

async function postPlan(req, res, next) {
  try {
    return createdResponse(res, {
      message: 'Planning record created successfully',
      data: await service.createPlan({
        payload: parsePayload(createPlanSchema, req.body),
        userId: req.user.id,
        requestId: req.requestId,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

async function putPlan(req, res, next) {
  try {
    return successResponse(res, {
      message: 'Planning record updated successfully',
      data: await service.updatePlan({
        id: parseId(req.params.id),
        payload: parsePayload(updatePlanSchema, req.body),
        userId: req.user.id,
        requestId: req.requestId,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

async function deletePlan(req, res, next) {
  try {
    return successResponse(res, {
      message: 'Planning record deleted successfully',
      data: await service.deletePlan({
        id: parseId(req.params.id),
        requestId: req.requestId,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

async function postTask(req, res, next) {
  try {
    return createdResponse(res, {
      message: 'Planning task created successfully',
      data: await service.createTask({
        planId: parseId(req.params.id, 'plan_id'),
        payload: parsePayload(createTaskSchema, req.body),
        requestId: req.requestId,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

async function putTask(req, res, next) {
  try {
    return successResponse(res, {
      message: 'Planning task updated successfully',
      data: await service.updateTask({
        taskId: parseId(req.params.taskId, 'task_id'),
        payload: parsePayload(updateTaskSchema, req.body),
        requestId: req.requestId,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteTask(req, res, next) {
  try {
    return successResponse(res, {
      message: 'Planning task deleted successfully',
      data: await service.deleteTask({
        taskId: parseId(req.params.taskId, 'task_id'),
        requestId: req.requestId,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getDashboard,
  getPlan,
  postPlan,
  putPlan,
  deletePlan,
  postTask,
  putTask,
  deleteTask,
};
