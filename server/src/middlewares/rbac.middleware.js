const { forbidden } = require('../shared/http-error');

function requirePermission(permissionCode) {
  return function rbacMiddleware(req, res, next) {
    const user = req.user;

    if (!user) {
      return next(forbidden('User context is missing'));
    }

    const isAdmin = user.roles.includes('ADMIN');
    const hasPermission = user.permissions.includes(permissionCode);

    if (!isAdmin && !hasPermission) {
      console.warn('[RBAC][DENIED]', {
        requestId: req.requestId,
        userId: user.id,
        requiredPermission: permissionCode,
        userPermissions: user.permissions,
      });

      return next(forbidden('Permission denied'));
    }

    console.info('[RBAC][ALLOWED]', {
      requestId: req.requestId,
      userId: user.id,
      requiredPermission: permissionCode,
    });

    return next();
  };
}

module.exports = { requirePermission };