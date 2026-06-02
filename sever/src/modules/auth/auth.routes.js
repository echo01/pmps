const express = require('express');
const { login, me } = require('./auth.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.post('/auth/login', login);
router.get('/auth/me', authMiddleware, me);

module.exports = {
  authRoutes: router,
};