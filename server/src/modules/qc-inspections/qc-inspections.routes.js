const express = require('express');

const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/rbac.middleware');
const {
  getQcLots,
  getQcLotUnits,
  getQcTemplates,
  getQcTemplateItems,
  postQcInspection,
  getQcInspectionById,
  putQcInspection,
  getQcEquipmentCheck,
  postSubmitQcInspection,
  postReviewQcInspection,
  postApproveQcInspection,
  postRejectQcInspection,
  postQcInspectionEditRequest,
  postApplyQcInspectionEdit,
  getQcInspectionEditHistory,
} = require('./qc-inspections.controller');

const router = express.Router();
const qcAccess = [authMiddleware, requirePermission('QCInspection')];
const editResultAccess = [authMiddleware, requirePermission('EditTestResult')];
const editHistoryAccess = [authMiddleware, requirePermission('SearchReport')];

router.get('/qc/lots', qcAccess, getQcLots);
router.get('/qc/lots/:lotId/units', qcAccess, getQcLotUnits);
router.get('/qc/models/:modelId/templates', qcAccess, getQcTemplates);
router.get('/qc/templates/:templateId/items', qcAccess, getQcTemplateItems);

router.post('/qc/inspections', qcAccess, postQcInspection);
router.get('/qc/inspections/:id/equipment-check', qcAccess, getQcEquipmentCheck);
router.get('/qc/inspections/:id', qcAccess, getQcInspectionById);
router.put('/qc/inspections/:id', qcAccess, putQcInspection);

router.post('/qc/inspections/:id/submit', qcAccess, postSubmitQcInspection);
router.post('/qc/inspections/:id/review', qcAccess, postReviewQcInspection);
router.post('/qc/inspections/:id/approve', qcAccess, postApproveQcInspection);
router.post('/qc/inspections/:id/reject', qcAccess, postRejectQcInspection);
router.post('/qc/inspections/:id/edit-request', editResultAccess, postQcInspectionEditRequest);
router.post('/qc/inspections/:id/apply-edit', editResultAccess, postApplyQcInspectionEdit);
router.get('/qc/inspections/:id/edit-history', editHistoryAccess, getQcInspectionEditHistory);

module.exports = {
  qcInspectionsRoutes: router,
};
