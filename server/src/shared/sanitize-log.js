function sanitizeObject(input) {
  if (!input || typeof input !== 'object') {
    return input;
  }

  const sensitiveKeys = [
    'password',
    'password_hash',
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'x-api-key',
    'api_key',
    'apikey',
    'secret',
  ];

  const output = Array.isArray(input) ? [] : {};

  for (const [key, value] of Object.entries(input)) {
    const lowerKey = key.toLowerCase();

    if (sensitiveKeys.includes(lowerKey)) {
      output[key] = '[REDACTED]';
      continue;
    }

    if (value && typeof value === 'object') {
      output[key] = sanitizeObject(value);
      continue;
    }

    output[key] = value;
  }

  return output;
}

module.exports = { sanitizeObject };
