const express = require('express');

const {
  getRequiredEquipment,
  postRequiredEquipment,
  putRequiredEquipment,
  deleteRequiredEquipmentById,
  getRequiredEquipmentByModel,
  getAvailableEquipmentByModel,
} = require('./model-required-equipment.controller');

const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/rbac.middleware');

const router = express.Router();
const modelRequiredEquipmentAccess = [
  authMiddleware,
  requirePermission('ModelRequiredEquipment'),
];

router.get('/model-required-equipment', modelRequiredEquipmentAccess, getRequiredEquipment);
router.post('/model-required-equipment', modelRequiredEquipmentAccess, postRequiredEquipment);
router.put('/model-required-equipment/:id', modelRequiredEquipmentAccess, putRequiredEquipment);
router.delete('/model-required-equipment/:id', modelRequiredEquipmentAccess, deleteRequiredEquipmentById);

router.get('/models/:modelId/required-equipment', modelRequiredEquipmentAccess, getRequiredEquipmentByModel);
router.get('/models/:modelId/available-equipment', modelRequiredEquipmentAccess, getAvailableEquipmentByModel);

module.exports = {
  modelRequiredEquipmentRoutes: router,
};
