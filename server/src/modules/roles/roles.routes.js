const express = require('express');

const {
  getRoles,
  getRole,
  postRole,
  putRole,
  getPermissions,
  getPermissionsByRole,
  putPermissionsByRole,
} = require('./roles.controller');

const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.get(
  '/roles',
  authMiddleware,
  requirePermission('UserRole'),
  getRoles
);

router.get(
  '/roles/:id',
  authMiddleware,
  requirePermission('UserRole'),
  getRole
);

router.post(
  '/roles',
  authMiddleware,
  requirePermission('UserRole'),
  postRole
);

router.get(
  '/permissions',
  authMiddleware,
  requirePermission('UserRole'),
  getPermissions
);

router.put(
  '/roles/:id',
  authMiddleware,
  requirePermission('UserRole'),
  putRole
);

router.get(
  '/roles/:id/permissions',
  authMiddleware,
  requirePermission('UserRole'),
  getPermissionsByRole
);

router.put(
  '/roles/:id/permissions',
  authMiddleware,
  requirePermission('UserRole'),
  putPermissionsByRole
);

module.exports = {
  rolesRoutes: router,
};
