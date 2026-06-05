const express = require('express');

const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/rbac.middleware');
const {
  getQaLots,
  getQaLotSamplingStatus,
  getQaLotUnits,
  getQaTemplates,
  getQaTemplateItems,
  postQaSampling,
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
