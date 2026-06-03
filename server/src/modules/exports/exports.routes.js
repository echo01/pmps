const express = require('express');

const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/rbac.middleware');
const controller = require('./exports.controller');

const router = express.Router();
const exportAccess = [authMiddleware, requirePermission('SearchReport')];

router.get('/exports/qc-inspections.csv', exportAccess, controller.exportQcCsvController);
router.get('/exports/qc-inspections.xlsx', exportAccess, controller.exportQcExcelController);
router.get('/exports/qc-inspections.pdf', exportAccess, controller.exportQcPdfController);
router.get('/exports/qc-inspections/:id/pdf', exportAccess, controller.exportQcDetailPdfController);

router.get('/exports/qa-samplings.csv', exportAccess, controller.exportQaCsvController);
router.get('/exports/qa-samplings.xlsx', exportAccess, controller.exportQaExcelController);
router.get('/exports/qa-samplings.pdf', exportAccess, controller.exportQaPdfController);
router.get('/exports/qa-samplings/:id/pdf', exportAccess, controller.exportQaDetailPdfController);

router.get('/exports/lots.csv', exportAccess, controller.exportLotsCsvController);
router.get('/exports/lots.xlsx', exportAccess, controller.exportLotsExcelController);
router.get('/exports/lots/:lotId/pdf', exportAccess, controller.exportLotDetailPdfController);

router.get('/exports/audit-trails.csv', exportAccess, controller.exportAuditCsvController);
router.get('/exports/audit-trails.xlsx', exportAccess, controller.exportAuditExcelController);

module.exports = {
  exportsRoutes: router,
};
