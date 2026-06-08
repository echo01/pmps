const express = require('express');

const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/rbac.middleware');
const { badRequest } = require('../../shared/http-error');
const {
  getQaLots,
  getQaLotSamplingStatus,
  getQaLotUnits,
  getQaTemplates,
  getQaTemplateItems,
  postQaSampling,
  postQaSamplingBySerial,
  getQaSamplingById,
  putQaSampling,
  getQaEquipmentCheck,
  postSubmitQaSampling,
  postReviewQaSampling,
  postApproveQaSampling,
  postRejectQaSampling,
  postQaSamplingEditRequest,
  postApplyQaSamplingEdit,
  getQaSamplingEditHistory,
} = require('./qa-sampling.controller');

const router = express.Router();
const qaAccess = [authMiddleware, requirePermission('QASampling')];
const editResultAccess = [authMiddleware, requirePermission('EditTestResult')];
const editHistoryAccess = [authMiddleware, requirePermission('SearchReport')];

router.get('/qa/lots', qaAccess, getQaLots);
router.get('/qa/lots/:lotId/sampling-status', qaAccess, getQaLotSamplingStatus);
router.get('/qa/lots/:lotId/units', qaAccess, getQaLotUnits);
router.get('/qa/models/:modelId/templates', qaAccess, getQaTemplates);
router.get('/qa/templates/:templateId/items', qaAccess, getQaTemplateItems);

router.post('/qa/samplings', qaAccess, postQaSampling);
router.post('/qa/samplings/by-serial', qaAccess, postQaSamplingBySerial);
router.all('/qa/samplings/by-serial', (req, res, next) => next(
  badRequest('Use POST /api/qa/samplings/by-serial to save QA sampling by serial', [
    {
      field: 'method',
      message: `Method ${req.method} is not supported for this endpoint`,
    },
  ])
));
router.get('/qa/samplings/:id/equipment-check', qaAccess, getQaEquipmentCheck);
router.get('/qa/samplings/:id', qaAccess, getQaSamplingById);
router.put('/qa/samplings/:id', qaAccess, putQaSampling);

router.post('/qa/samplings/:id/submit', qaAccess, postSubmitQaSampling);
router.post('/qa/samplings/:id/review', qaAccess, postReviewQaSampling);
router.post('/qa/samplings/:id/approve', qaAccess, postApproveQaSampling);
router.post('/qa/samplings/:id/reject', qaAccess, postRejectQaSampling);
router.post('/qa/samplings/:id/edit-request', editResultAccess, postQaSamplingEditRequest);
router.post('/qa/samplings/:id/apply-edit', editResultAccess, postApplyQaSamplingEdit);
router.get('/qa/samplings/:id/edit-history', editHistoryAccess, getQaSamplingEditHistory);

module.exports = {
  qaSamplingRoutes: router,
};
