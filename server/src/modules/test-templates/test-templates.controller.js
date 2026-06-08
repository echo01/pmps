const {
  listTemplates,
  getTemplate,
  createNewTemplate,
  updateExistingTemplate,
  removeTemplate,
  duplicateExistingTemplate,
  listTemplateModels,
  updateTemplateModels,
  listSections,
  createNewSection,
  updateExistingSection,
  removeSection,
  listItems,
  createNewItem,
  updateExistingItem,
  removeItem,
} = require('./test-templates.service');

const { successResponse, createdResponse } = require('../../shared/response');
const {
  parseBooleanQuery,
  parseOptionalPositiveInt,
  parsePayload,
  parsePositiveInt,
} = require('../../shared/query');
const {
  createTemplateSchema,
  updateTemplateSchema,
  duplicateTemplateSchema,
  assignTemplateModelsSchema,
  createSectionSchema,
  updateSectionSchema,
  createItemSchema,
  updateItemSchema,
} = require('./test-templates.schema');

async function getTemplates(req, res, next) {
  try {
    const templates = await listTemplates({
      modelId: parseOptionalPositiveInt(req.query.model_id, 'model_id'),
      templateType: req.query.template_type,
      active: parseBooleanQuery(req.query.active),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Test templates retrieved successfully',
      data: templates,
    });
  } catch (error) {
    return next(error);
  }
}

async function getTemplateModels(req, res, next) {
  try {
    const models = await listTemplateModels({
      templateId: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Template models retrieved successfully',
      data: models,
    });
  } catch (error) {
    return next(error);
  }
}

async function putTemplateModels(req, res, next) {
  try {
    const models = await updateTemplateModels({
      templateId: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(assignTemplateModelsSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Template models updated successfully',
      data: models,
    });
  } catch (error) {
    return next(error);
  }
}

async function postTemplate(req, res, next) {
  try {
    const template = await createNewTemplate({
      payload: parsePayload(createTemplateSchema, req.body),
      userId: req.user?.id,
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'Test template created successfully',
      data: template,
    });
  } catch (error) {
    return next(error);
  }
}

async function getTemplateById(req, res, next) {
  try {
    const template = await getTemplate({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Test template retrieved successfully',
      data: template,
    });
  } catch (error) {
    return next(error);
  }
}

async function putTemplate(req, res, next) {
  try {
    const template = await updateExistingTemplate({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(updateTemplateSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Test template updated successfully',
      data: template,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteTemplateById(req, res, next) {
  try {
    const deleted = await removeTemplate({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Test template deleted successfully',
      data: deleted,
    });
  } catch (error) {
    return next(error);
  }
}

async function postDuplicateTemplate(req, res, next) {
  try {
    const template = await duplicateExistingTemplate({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(duplicateTemplateSchema, req.body),
      userId: req.user?.id,
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'Test template duplicated successfully',
      data: template,
    });
  } catch (error) {
    return next(error);
  }
}

async function getSections(req, res, next) {
  try {
    const sections = await listSections({
      templateId: parsePositiveInt(req.params.templateId, 'templateId'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Template sections retrieved successfully',
      data: sections,
    });
  } catch (error) {
    return next(error);
  }
}

async function postSection(req, res, next) {
  try {
    const section = await createNewSection({
      templateId: parsePositiveInt(req.params.templateId, 'templateId'),
      payload: parsePayload(createSectionSchema, req.body),
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'Template section created successfully',
      data: section,
    });
  } catch (error) {
    return next(error);
  }
}

async function putSection(req, res, next) {
  try {
    const section = await updateExistingSection({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(updateSectionSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Template section updated successfully',
      data: section,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteSectionById(req, res, next) {
  try {
    const deleted = await removeSection({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Template section deleted successfully',
      data: deleted,
    });
  } catch (error) {
    return next(error);
  }
}

async function getItems(req, res, next) {
  try {
    const items = await listItems({
      templateId: parsePositiveInt(req.params.templateId, 'templateId'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Template items retrieved successfully',
      data: items,
    });
  } catch (error) {
    return next(error);
  }
}

async function postItem(req, res, next) {
  try {
    const item = await createNewItem({
      templateId: parsePositiveInt(req.params.templateId, 'templateId'),
      payload: parsePayload(createItemSchema, req.body),
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'Template item created successfully',
      data: item,
    });
  } catch (error) {
    return next(error);
  }
}

async function putItem(req, res, next) {
  try {
    const item = await updateExistingItem({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(updateItemSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Template item updated successfully',
      data: item,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteItemById(req, res, next) {
  try {
    const deleted = await removeItem({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Template item deleted successfully',
      data: deleted,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
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
};
