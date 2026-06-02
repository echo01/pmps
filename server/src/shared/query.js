const { validationError } = require('./http-error');

function parsePositiveInt(value, fieldName) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw validationError('Validation failed', [
      {
        field: fieldName,
        message: `${fieldName} must be a positive integer`,
      },
    ]);
  }

  return numberValue;
}

function parseOptionalPositiveInt(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parsePositiveInt(value, fieldName);
}

function parseBooleanQuery(value, fieldName = 'active') {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === 'true' || value === true) {
    return true;
  }

  if (value === 'false' || value === false) {
    return false;
  }

  throw validationError('Validation failed', [
    {
      field: fieldName,
      message: `${fieldName} query must be true or false`,
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

module.exports = {
  parsePositiveInt,
  parseOptionalPositiveInt,
  parseBooleanQuery,
  parsePayload,
};
