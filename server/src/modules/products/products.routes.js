const express = require('express');

const {
  getCategories,
  postCategory,
  putCategory,
  getSubCategories,
  postSubCategory,
  putSubCategory,
  getModels,
  getModelById,
  postModel,
  putModel,
  getModelLookup,
} = require('./products.controller');

const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/rbac.middleware');

const router = express.Router();
const productMasterAccess = [authMiddleware, requirePermission('ProductMaster')];

router.get('/lookups/product-models', productMasterAccess, getModelLookup);

router.get('/product-categories', productMasterAccess, getCategories);
router.post('/product-categories', productMasterAccess, postCategory);
router.put('/product-categories/:id', productMasterAccess, putCategory);

router.get('/product-sub-categories', productMasterAccess, getSubCategories);
router.post('/product-sub-categories', productMasterAccess, postSubCategory);
router.put('/product-sub-categories/:id', productMasterAccess, putSubCategory);

router.get('/product-models', productMasterAccess, getModels);
router.post('/product-models', productMasterAccess, postModel);
router.get('/product-models/:id', productMasterAccess, getModelById);
router.put('/product-models/:id', productMasterAccess, putModel);

module.exports = {
  productsRoutes: router,
};
