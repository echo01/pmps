const jwt = require('jsonwebtoken');
const { unauthorized } = require('../shared/http-error');

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw unauthorized('Authorization header is required');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw unauthorized('Invalid authorization format');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.sub,
      username: decoded.username,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
    };

    console.info('[AUTH][TOKEN][VERIFIED]', {
      requestId: req.requestId,
      userId: req.user.id,
      username: req.user.username,
      roles: req.user.roles,
    });

    return next();
  } catch (error) {
    console.warn('[AUTH][TOKEN][FAILED]', {
      requestId: req.requestId,
      message: error.message,
    });

    return next(unauthorized('Invalid or expired token'));
  }
}

module.exports = { authMiddleware };