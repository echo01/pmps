const express = require('express');

const {
  getTemplates,
  postTemplate,
  getTemplateById,
  putTemplate,
  deleteTemplateById,
  postDuplicateTemplate,
  getTemplateModels,
  putTemplateModels,
  getSections,
  postSection,
  putSection,
  deleteSectionById,
  getItems,
  postItem,
  putItem,
  deleteItemById,
} = require('./test-templates.controller');

const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/rbac.middleware');

const router = express.Router();
const testTemplateAccess = [authMiddleware, requirePermission('TestTemplate')];

router.get('/test-templates', testTemplateAccess, getTemplates);
router.post('/test-templates', testTemplateAccess, postTemplate);
router.get('/test-templates/:id', testTemplateAccess, getTemplateById);
router.put('/test-templates/:id', testTemplateAccess, putTemplate);
router.delete('/test-templates/:id', testTemplateAccess, deleteTemplateById);
router.post('/test-templates/:id/duplicate', testTemplateAccess, postDuplicateTemplate);
router.get('/test-templates/:id/models', testTemplateAccess, getTemplateModels);
router.put('/test-templates/:id/models', testTemplateAccess, putTemplateModels);

router.get('/test-templates/:templateId/sections', testTemplateAccess, getSections);
router.post('/test-templates/:templateId/sections', testTemplateAccess, postSection);
router.put('/test-template-sections/:id', testTemplateAccess, putSection);
router.delete('/test-template-sections/:id', testTemplateAccess, deleteSectionById);

router.get('/test-templates/:templateId/items', testTemplateAccess, getItems);
router.post('/test-templates/:templateId/items', testTemplateAccess, postItem);
router.put('/test-template-items/:id', testTemplateAccess, putItem);
router.delete('/test-template-items/:id', testTemplateAccess, deleteItemById);

module.exports = {
  testTemplatesRoutes: router,
};
