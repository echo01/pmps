const express = require('express');

const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/rbac.middleware');
const controller = require('./reports.controller');

const router = express.Router();
const reportAccess = [authMiddleware, requirePermission('SearchReport')];

router.get('/dashboard/summary', reportAccess, controller.getDashboardSummaryController);
router.get('/dashboard/qc-summary', reportAccess, controller.getQcSummaryController);
router.get('/dashboard/qa-summary', reportAccess, controller.getQaSummaryController);
router.get('/dashboard/lot-status', reportAccess, controller.getLotStatusController);

router.get('/reports/lots', reportAccess, controller.getLotReportsController);
router.get('/reports/serials', reportAccess, controller.getSerialReportsController);
router.get('/reports/qc-inspections/export', reportAccess, controller.exportQcInspectionReportsController);
router.get('/reports/qa-samplings/export', reportAccess, controller.exportQaSamplingReportsController);
router.get('/reports/qc-inspections', reportAccess, controller.getQcInspectionReportsController);
router.get('/reports/qa-samplings', reportAccess, controller.getQaSamplingReportsController);

router.get('/reports/lots/:lotId', reportAccess, controller.getLotReportByIdController);
router.get('/reports/serials/:productUnitId', reportAccess, controller.getSerialReportByIdController);
router.get('/reports/qc-inspections/:id', reportAccess, controller.getQcInspectionReportByIdController);
router.get('/reports/qa-samplings/:id', reportAccess, controller.getQaSamplingReportByIdController);

module.exports = {
  reportsRoutes: router,
};
