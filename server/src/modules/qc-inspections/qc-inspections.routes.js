const express = require('express');

const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/rbac.middleware');
const { badRequest } = require('../../shared/http-error');
const {
  getQcLots,
  getQcLotInspectionStatus,
  getQcLotUnits,
  getQcTemplates,
  getQcTemplateItems,
  postQcInspection,
  postQcInspectionBySerial,
  getQcInspectionById,
  putQcInspection,
  getQcEquipmentCheck,
  postSubmitQcInspection,
  postReviewQcInspection,
  postApproveQcInspection,
  postRejectQcInspection,
  postBulkQcInspectionWorkflow,
  postQcInspectionEditRequest,
  postApplyQcInspectionEdit,
  getQcInspectionEditHistory,
} = require('./qc-inspections.controller');

const router = express.Router();
const qcAccess = [authMiddleware, requirePermission('QCInspection')];
const editResultAccess = [authMiddleware, requirePermission('EditTestResult')];
const editHistoryAccess = [authMiddleware, requirePermission('SearchReport')];

router.get('/qc/lots', qcAccess, getQcLots);
router.get('/qc/lots/:lotId/inspection-status', qcAccess, getQcLotInspectionStatus);
router.get('/qc/lots/:lotId/units', qcAccess, getQcLotUnits);
router.get('/qc/models/:modelId/templates', qcAccess, getQcTemplates);
router.get('/qc/templates/:templateId/items', qcAccess, getQcTemplateItems);

router.post('/qc/inspections', qcAccess, postQcInspection);
router.post('/qc/inspections/by-serial', qcAccess, postQcInspectionBySerial);
router.post('/qc/inspections/bulk-workflow', qcAccess, postBulkQcInspectionWorkflow);
router.all('/qc/inspections/by-serial', (req, res, next) => next(
  badRequest('Use POST /api/qc/inspections/by-serial to create QC inspection by serial', [
    {
      field: 'method',
      message: `Method ${req.method} is not supported for this endpoint`,
    },
  ])
));
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
