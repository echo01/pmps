const {
  getProfile,
  updateOwnProfile,
  changeOwnPassword,
} = require('./profile.service');
const { successResponse } = require('../../shared/response');
const { validationError } = require('../../shared/http-error');
const { updateProfileSchema, changePasswordSchema } = require('./profile.schema');

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

async function getOwnProfile(req, res, next) {
  try {
    const profile = await getProfile({
      userId: req.user.id,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Profile retrieved successfully',
      data: profile,
    });
  } catch (error) {
    return next(error);
  }
}

async function putOwnProfile(req, res, next) {
  try {
    const profile = await updateOwnProfile({
      userId: req.user.id,
      payload: parsePayload(updateProfileSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Profile updated successfully',
      data: profile,
    });
  } catch (error) {
    return next(error);
  }
}

async function postOwnProfilePassword(req, res, next) {
  try {
    const profile = await changeOwnPassword({
      userId: req.user.id,
      payload: parsePayload(changePasswordSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Password changed successfully',
      data: profile,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getOwnProfile,
  putOwnProfile,
  postOwnProfilePassword,
};
