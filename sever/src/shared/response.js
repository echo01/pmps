function getRequestIdFromResponse(res, meta = {}) {
  return res.req?.requestId || meta.request_id || null;
}


function successResponse(res, options = {}) {
  const {
    statusCode = 200,
    message = 'Operation completed successfully',
    data = null,
    meta = {},
  } = options;

  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: {
      request_id: res.req?.requestId,
      ...meta,
    },
  });
}

function createdResponse(res, options = {}) {
  return successResponse(res, {
    statusCode: 201,
    message: options.message || 'Resource created successfully',
    data: options.data || null,
    meta: options.meta || {},
  });
}

function errorResponse(res, options = {}) {
  const {
    statusCode = 500,
    message = 'Internal server error',
    errorCode = 'INTERNAL_SERVER_ERROR',
    errors = [],
    meta = {},
  } = options;

  return res.status(statusCode).json({
    success: false,
    message,
    error_code: errorCode,
    errors,
    meta: {
      // request_id: res.req?.requestId,
      request_id: getRequestIdFromResponse(res, meta),
      ...meta,
    },
  });
}

module.exports = {
  successResponse,
  createdResponse,
  errorResponse,
};