const express = require('express');

const {
  getUsers,
  getUser,
  postUser,
  putUser,
  patchUserActive,
  postUserLock,
  postUserUnlock,
  postUserPassword,
  getRolesByUser,
  putRolesByUser,
} = require('./users.controller');

const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use('/users', authMiddleware, requirePermission('UserRole'));

router.get('/users', getUsers);
router.post('/users', postUser);
router.get('/users/:id', getUser);
router.put('/users/:id', putUser);
router.patch('/users/:id/active', patchUserActive);
router.post('/users/:id/lock', postUserLock);
router.post('/users/:id/unlock', postUserUnlock);
router.post('/users/:id/password', postUserPassword);
router.get('/users/:id/roles', getRolesByUser);
router.put('/users/:id/roles', putRolesByUser);

module.exports = {
  usersRoutes: router,
};
