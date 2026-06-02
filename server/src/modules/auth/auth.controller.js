const { loginSchema } = require('./auth.schema');
const { loginUser } = require('./auth.service');
const { successResponse } = require('../../shared/response');
const { validationError } = require('../../shared/http-error');


async function me(req, res, next) {
  try {
    return successResponse(res, {
      message: 'Current user retrieved successfully',
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      throw validationError('Validation failed', errors);
    }

    const result = await loginUser({
      username: parsed.data.username,
      password: parsed.data.password,
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return successResponse(res, {
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
  me,
};