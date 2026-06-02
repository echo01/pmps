const express = require('express');

const {
  getEquipmentTypes,
  postEquipmentType,
  putEquipmentType,
  getEquipment,
  getEquipmentDetail,
  postEquipment,
  putEquipment,
  getExpiredCalibration,
} = require('./equipment.controller');

const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/rbac.middleware');

const router = express.Router();
const equipmentMasterAccess = [authMiddleware, requirePermission('EquipmentMaster')];

router.get('/equipment-types', equipmentMasterAccess, getEquipmentTypes);
router.post('/equipment-types', equipmentMasterAccess, postEquipmentType);
router.put('/equipment-types/:id', equipmentMasterAccess, putEquipmentType);

router.get('/equipment/expired-calibration', equipmentMasterAccess, getExpiredCalibration);
router.get('/equipment', equipmentMasterAccess, getEquipment);
router.post('/equipment', equipmentMasterAccess, postEquipment);
router.get('/equipment/:id', equipmentMasterAccess, getEquipmentDetail);
router.put('/equipment/:id', equipmentMasterAccess, putEquipment);

module.exports = {
  equipmentRoutes: router,
};
