const crypto = require('crypto');
const { sanitizeObject } = require('../shared/sanitize-log');

function requestIdMiddleware(req, res, next) {
  const incomingRequestId = req.headers['x-request-id'];

  const requestId =
    typeof incomingRequestId === 'string' && incomingRequestId.trim()
      ? incomingRequestId.trim()
      : crypto.randomUUID();

  req.requestId = requestId;
  req.requestStartedAt = Date.now();

  res.setHeader('X-Request-Id', requestId);

  console.info('[REQUEST][START]', {
    requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    query: sanitizeObject(req.query),
  });

  res.on('finish', () => {
    const durationMs = Date.now() - req.requestStartedAt;

    console.info('[REQUEST][END]', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}

module.exports = { requestIdMiddleware };