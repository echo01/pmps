const express = require('express');

const {
  getOwnProfile,
  putOwnProfile,
  postOwnProfilePassword,
} = require('./profile.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.get('/profile', authMiddleware, getOwnProfile);
router.put('/profile', authMiddleware, putOwnProfile);
router.post('/profile/password', authMiddleware, postOwnProfilePassword);

module.exports = {
  profileRoutes: router,
};
