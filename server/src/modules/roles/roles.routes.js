const express = require('express');

const {
  getRoles,
  getRole,
  postRole,
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

module.exports = {
  rolesRoutes: router,
};