class HttpError extends Error {
  constructor(statusCode, message, errorCode = 'ERROR', errors = []) {
    super(message);

    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

function badRequest(message = 'Bad request', errors = []) {
  return new HttpError(400, message, 'BAD_REQUEST', errors);
}

function validationError(message = 'Validation failed', errors = []) {
  return new HttpError(400, message, 'VALIDATION_ERROR', errors);
}

function unauthorized(message = 'Unauthorized') {
  return new HttpError(401, message, 'UNAUTHORIZED');
}

function forbidden(message = 'Forbidden') {
  return new HttpError(403, message, 'FORBIDDEN');
}

function notFound(message = 'Resource not found') {
  return new HttpError(404, message, 'NOT_FOUND');
}

function conflict(message = 'Conflict', errors = []) {
  return new HttpError(409, message, 'CONFLICT', errors);
}

function unprocessable(message = 'Business validation failed', errors = []) {
  return new HttpError(422, message, 'BUSINESS_VALIDATION_FAILED', errors);
}

module.exports = {
  HttpError,
  badRequest,
  validationError,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
};