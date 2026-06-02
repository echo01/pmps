const express = require('express');

const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/rbac.middleware');
const {
  getProductionLots,
  postProductionLot,
  getProductionLotById,
  putProductionLot,
  getProductionLotSerials,
  postGenerateSerials,
  postLotEcnRefs,
  getCurrentLots,
} = require('./production-lots.controller');

const router = express.Router();
const productionLotAccess = [authMiddleware, requirePermission('ProductionLot')];

router.get('/current-lots', productionLotAccess, getCurrentLots);

router.post('/production-lots/generate-serials', productionLotAccess, postGenerateSerials);
router.get('/production-lots', productionLotAccess, getProductionLots);
router.post('/production-lots', productionLotAccess, postProductionLot);
router.get('/production-lots/:id', productionLotAccess, getProductionLotById);
router.put('/production-lots/:id', productionLotAccess, putProductionLot);
router.get('/production-lots/:id/serials', productionLotAccess, getProductionLotSerials);
router.post('/production-lots/:id/ecn', productionLotAccess, postLotEcnRefs);

module.exports = {
  productionLotsRoutes: router,
};
