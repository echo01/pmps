const { errorResponse } = require('../shared/response');
const { mapDatabaseError } = require('../shared/db-error.mapper');

function errorMiddleware(error, req, res, next) {
  const requestId = req.requestId;

  // 1. Invalid JSON body
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    console.warn('[APP][JSON_PARSE_ERROR]', {
      requestId,
      message: error.message,
    });

    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid JSON body',
      errorCode: 'INVALID_JSON_BODY',
      errors: [
        {
          field: 'body',
          message: 'Request body must be valid JSON',
        },
      ],
    });
  }

  // 2. PostgreSQL error
  const mappedDbError = mapDatabaseError(error);

  if (mappedDbError) {
    console.warn('[APP][DB_ERROR]', {
      requestId,
      code: error.code,
      constraint: error.constraint,
      column: error.column,
      message: error.message,
    });

    return errorResponse(res, mappedDbError);
  }

  // 3. HttpError ที่เราสร้างเอง
  if (error.statusCode && error.errorCode) {
    console.warn('[APP][HTTP_ERROR]', {
      requestId,
      statusCode: error.statusCode,
      errorCode: error.errorCode,
      message: error.message,
    });

    return errorResponse(res, {
      statusCode: error.statusCode,
      message: error.message,
      errorCode: error.errorCode,
      errors: error.errors || [],
    });
  }

  // 4. Unexpected error เท่านั้นที่ใช้ console.error
  console.error('[APP][UNEXPECTED_ERROR]', {
    requestId,
    message: error.message,
    statusCode: 500,
    errorCode: 'INTERNAL_SERVER_ERROR',
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });

  return errorResponse(res, {
    statusCode: 500,
    message: 'Internal server error',
    errorCode: 'INTERNAL_SERVER_ERROR',
    errors: [],
  });
}

module.exports = { errorMiddleware };