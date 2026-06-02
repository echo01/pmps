function mapDatabaseError(error) {
  // PostgreSQL error code reference
  // 23505 = unique_violation
  // 23503 = foreign_key_violation
  // 23502 = not_null_violation
  // 23514 = check_violation
  // 22P02 = invalid_text_representation

  if (!error || !error.code) {
    return null;
  }

  switch (error.code) {
    case '23505':
      return {
        statusCode: 409,
        message: 'Duplicate data',
        errorCode: 'DUPLICATE_DATA',
        errors: [
          {
            field: error.constraint || null,
            message: 'Data already exists or violates unique constraint',
          },
        ],
      };

    case '23503':
      return {
        statusCode: 409,
        message: 'Referenced data does not exist',
        errorCode: 'FOREIGN_KEY_VIOLATION',
        errors: [
          {
            field: error.constraint || null,
            message: 'Related record was not found',
          },
        ],
      };

    case '23502':
      return {
        statusCode: 400,
        message: 'Required field is missing',
        errorCode: 'NOT_NULL_VIOLATION',
        errors: [
          {
            field: error.column || null,
            message: 'This field is required',
          },
        ],
      };

    case '23514':
      return {
        statusCode: 422,
        message: 'Data violates business rule',
        errorCode: 'CHECK_CONSTRAINT_VIOLATION',
        errors: [
          {
            field: error.constraint || null,
            message: 'Value is not allowed by database constraint',
          },
        ],
      };

    case '22P02':
      return {
        statusCode: 400,
        message: 'Invalid data format',
        errorCode: 'INVALID_DATA_FORMAT',
        errors: [],
      };

    default:
      return null;
  }
}

module.exports = { mapDatabaseError };