const {
  findTemplateById,
  findTemplateByIdentity,
  findTemplates,
  createTemplate,
  updateTemplate,
  countTemplateUsage,
  deleteTemplateCascade,
  duplicateTemplate,
  countModelsByIds,
  findTemplateModels,
  replaceTemplateModels,
  findSectionById,
  findSectionsByTemplateId,
  createSection,
  updateSection,
  deleteSection,
  findItemById,
  findRawItemsByTemplateId,
  createItem,
  updateItem,
  deleteItem,
} = require('./test-templates.repository');

const { findModelById } = require('../products/products.repository');
const { withTransaction } = require('../../db/transaction');
const { conflict, notFound, validationError } = require('../../shared/http-error');

async function ensureModelExists(modelId) {
  const model = await findModelById(modelId);

  if (!model) {
    throw notFound('Product model not found');
  }

  return model;
}

async function ensureTemplateExists(templateId) {
  const template = await findTemplateById(templateId);

  if (!template) {
    throw notFound('Test template not found');
  }

  return template;
}

function groupItemsBySection(items) {
  const sectionMap = new Map();

  for (const item of items) {
    const sectionId = item.section_id || null;
    const mapKey = sectionId || `unsectioned-${item.id}`;

    if (!sectionMap.has(mapKey)) {
      sectionMap.set(mapKey, {
        section_id: sectionId,
        section_code: item.section_code || null,
        section_name: item.section_name || null,
        seq_no: item.section_seq_no || null,
        items: [],
      });
    }

    sectionMap.get(mapKey).items.push({
      id: item.id,
      template_id: item.template_id,
      section_id: item.section_id,
      item_code: item.item_code,
      item_name: item.item_name,
      test_point: item.test_point,
      test_description: item.test_description,
      check_type: item.check_type,
      spec_min: item.spec_min,
      spec_max: item.spec_max,
      unit: item.unit,
      mandatory: item.mandatory,
      active: item.active,
      seq_no: item.seq_no,
      remark: item.remark,
    });
  }

  return [...sectionMap.values()];
}

async function listTemplates({ modelId, templateType, active, requestId }) {
  console.info('[TEST_TEMPLATE][LIST][START]', {
    requestId,
    modelId,
    templateType,
    active,
  });

  const templates = await findTemplates({ modelId, templateType, active });
  console.info('[TEST_TEMPLATE][LIST][SUCCESS]', { requestId, count: templates.length });
  return templates;
}

async function getTemplate({ id, requestId }) {
  console.info('[TEST_TEMPLATE][GET][START]', { requestId, templateId: id });
  const template = await findTemplateById(id);

  if (!template) {
    throw notFound('Test template not found');
  }

  console.info('[TEST_TEMPLATE][GET][SUCCESS]', { requestId, templateId: id });
  return template;
}

async function ensureTemplateIdentityAvailable(payload, requestId, excludeId) {
  const existing = await findTemplateByIdentity({
    templateType: payload.template_type,
    templateName: payload.template_name,
    revision: payload.revision,
    excludeId,
  });

  if (existing) {
    console.warn('[TEST_TEMPLATE][DUPLICATE]', { requestId, templateId: existing.id });
    throw conflict('Template already exists for this type/revision', [
      {
        field: 'template_name',
        message: 'template_name and revision already exist for this type',
      },
    ]);
  }
}

function normalizeModelIds(modelIds) {
  return [...new Set((modelIds || []).map(Number).filter((value) => Number.isInteger(value) && value > 0))];
}

async function ensureModelsExist(modelIds, client) {
  const uniqueModelIds = normalizeModelIds(modelIds);

  if (!uniqueModelIds.length) {
    throw validationError('Validation failed', [
      {
        field: 'model_ids',
        message: 'at least one model is required',
      },
    ]);
  }

  const count = await countModelsByIds(uniqueModelIds, client);

  if (count !== uniqueModelIds.length) {
    throw validationError('Validation failed', [
      {
        field: 'model_ids',
        message: 'one or more models do not exist',
      },
    ]);
  }

  return uniqueModelIds;
}

async function createNewTemplate({ payload, userId, requestId }) {
  console.info('[TEST_TEMPLATE][CREATE][START]', {
    requestId,
    modelId: payload.model_id || null,
    templateType: payload.template_type,
  });

  if (payload.model_id) {
    await ensureModelExists(payload.model_id);
  }

  await ensureTemplateIdentityAvailable(payload, requestId);

  const template = payload.model_id
    ? await withTransaction(
      async (client) => {
        const created = await createTemplate(payload, userId, client);
        await replaceTemplateModels(created.id, [payload.model_id], payload.model_id, client);
        return findTemplateById(created.id, client);
      },
      { requestId, name: 'test-template-create-with-primary-model' }
    )
    : await createTemplate(payload, userId);

  console.info('[TEST_TEMPLATE][CREATE][SUCCESS]', { requestId, templateId: template.id });
  return template;
}

async function updateExistingTemplate({ id, payload, requestId }) {
  console.info('[TEST_TEMPLATE][UPDATE][START]', { requestId, templateId: id });
  const existing = await getTemplate({ id, requestId });

  if (payload.model_id) {
    await ensureModelExists(payload.model_id);
  }

  const identity = {
    model_id: payload.model_id || existing.model_id,
    template_type: payload.template_type || existing.template_type,
    template_name: payload.template_name || existing.template_name,
    revision: payload.revision || existing.revision,
  };
  await ensureTemplateIdentityAvailable(identity, requestId, id);

  const template = await updateTemplate(id, payload);
  console.info('[TEST_TEMPLATE][UPDATE][SUCCESS]', { requestId, templateId: id });
  return template;
}

async function removeTemplate({ id, requestId }) {
  console.info('[TEST_TEMPLATE][DELETE][START]', { requestId, templateId: id });

  const deleted = await withTransaction(
    async (client) => {
      const existing = await findTemplateById(id, client);

      if (!existing) {
        throw notFound('Test template not found');
      }

      const usage = await countTemplateUsage(id, client);
      const totalUsage = Number(usage.qc_count || 0) + Number(usage.qa_count || 0);

      if (totalUsage > 0) {
        throw conflict('Cannot delete template because it is already used by QC/QA records', [
          {
            field: 'template_id',
            message: `Template is used by ${usage.qc_count || 0} QC inspection(s) and ${usage.qa_count || 0} QA sampling(s)`,
          },
        ]);
      }

      return deleteTemplateCascade(id, client);
    },
    { requestId, name: 'test-template-delete' }
  );

  console.info('[TEST_TEMPLATE][DELETE][SUCCESS]', { requestId, templateId: id });
  return deleted;
}

async function duplicateExistingTemplate({ id, payload, userId, requestId }) {
  console.info('[TEST_TEMPLATE][DUPLICATE][START]', { requestId, templateId: id });

  const duplicated = await withTransaction(
    async (client) => {
      const source = await findTemplateById(id, client);

      if (!source) {
        throw notFound('Test template not found');
      }

      await ensureTemplateIdentityAvailable({
        template_type: source.template_type,
        template_name: payload.template_name,
        revision: payload.revision || source.revision || 'REV.00',
      }, requestId);

      return duplicateTemplate(id, payload, userId, client);
    },
    { requestId, name: 'test-template-duplicate' }
  );

  console.info('[TEST_TEMPLATE][DUPLICATE][SUCCESS]', { requestId, sourceTemplateId: id, templateId: duplicated.id });
  return duplicated;
}

async function listTemplateModels({ templateId, requestId }) {
  console.info('[TEST_TEMPLATE][MODEL_LIST][START]', { requestId, templateId });
  await ensureTemplateExists(templateId);
  const models = await findTemplateModels(templateId);
  console.info('[TEST_TEMPLATE][MODEL_LIST][SUCCESS]', { requestId, templateId, count: models.length });
  return models;
}

async function updateTemplateModels({ templateId, payload, requestId }) {
  console.info('[TEST_TEMPLATE][MODEL_ASSIGN][START]', {
    requestId,
    templateId,
    modelCount: payload.model_ids?.length || 0,
  });

  const models = await withTransaction(
    async (client) => {
      const template = await findTemplateById(templateId, client);

      if (!template) {
        throw notFound('Test template not found');
      }

      const modelIds = await ensureModelsExist(payload.model_ids, client);
      const primaryModelId = payload.primary_model_id && modelIds.includes(payload.primary_model_id)
        ? payload.primary_model_id
        : modelIds[0];

      await updateTemplate(templateId, { model_id: primaryModelId }, client);
      return replaceTemplateModels(templateId, modelIds, primaryModelId, client);
    },
    { requestId, name: 'test-template-model-assignment' }
  );

  console.info('[TEST_TEMPLATE][MODEL_ASSIGN][SUCCESS]', { requestId, templateId, count: models.length });
  return models;
}

async function listSections({ templateId, requestId }) {
  console.info('[TEST_TEMPLATE][SECTION_LIST][START]', { requestId, templateId });
  await ensureTemplateExists(templateId);
  const sections = await findSectionsByTemplateId(templateId);
  console.info('[TEST_TEMPLATE][SECTION_LIST][SUCCESS]', { requestId, count: sections.length });
  return sections;
}

async function createNewSection({ templateId, payload, requestId }) {
  console.info('[TEST_TEMPLATE][SECTION_CREATE][START]', { requestId, templateId });
  await ensureTemplateExists(templateId);
  const section = await createSection(templateId, payload);
  console.info('[TEST_TEMPLATE][SECTION_CREATE][SUCCESS]', { requestId, sectionId: section.id });
  return section;
}

async function updateExistingSection({ id, payload, requestId }) {
  console.info('[TEST_TEMPLATE][SECTION_UPDATE][START]', { requestId, sectionId: id });
  const existing = await findSectionById(id);

  if (!existing) {
    throw notFound('Template section not found');
  }

  const section = await updateSection(id, payload);
  console.info('[TEST_TEMPLATE][SECTION_UPDATE][SUCCESS]', { requestId, sectionId: id });
  return section;
}

async function removeSection({ id, requestId }) {
  console.info('[TEST_TEMPLATE][SECTION_DELETE][START]', { requestId, sectionId: id });
  const deleted = await deleteSection(id);

  if (!deleted) {
    throw notFound('Template section not found');
  }

  console.info('[TEST_TEMPLATE][SECTION_DELETE][SUCCESS]', { requestId, sectionId: id });
  return deleted;
}

async function ensureSectionBelongsToTemplate(sectionId, templateId) {
  if (!sectionId) {
    return;
  }

  const section = await findSectionById(sectionId);

  if (!section) {
    throw notFound('Template section not found');
  }

  if (section.template_id !== templateId) {
    throw validationError('Validation failed', [
      {
        field: 'section_id',
        message: 'section_id does not belong to this template',
      },
    ]);
  }
}

async function listItems({ templateId, requestId }) {
  console.info('[TEST_TEMPLATE][ITEM_LIST][START]', { requestId, templateId });
  await ensureTemplateExists(templateId);
  const items = await findRawItemsByTemplateId(templateId);
  const groupedItems = groupItemsBySection(items);
  console.info('[TEST_TEMPLATE][ITEM_LIST][SUCCESS]', {
    requestId,
    count: items.length,
  });
  return groupedItems;
}

async function createNewItem({ templateId, payload, requestId }) {
  console.info('[TEST_TEMPLATE][ITEM_CREATE][START]', { requestId, templateId });
  await ensureTemplateExists(templateId);
  await ensureSectionBelongsToTemplate(payload.section_id, templateId);
  const item = await createItem(templateId, payload);
  console.info('[TEST_TEMPLATE][ITEM_CREATE][SUCCESS]', { requestId, itemId: item.id });
  return item;
}

async function updateExistingItem({ id, payload, requestId }) {
  console.info('[TEST_TEMPLATE][ITEM_UPDATE][START]', { requestId, itemId: id });
  const existing = await findItemById(id);

  if (!existing) {
    throw notFound('Template item not found');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'section_id')) {
    await ensureSectionBelongsToTemplate(payload.section_id, existing.template_id);
  }

  const item = await updateItem(id, payload);
  console.info('[TEST_TEMPLATE][ITEM_UPDATE][SUCCESS]', { requestId, itemId: id });
  return item;
}

async function removeItem({ id, requestId }) {
  console.info('[TEST_TEMPLATE][ITEM_DELETE][START]', { requestId, itemId: id });
  const deleted = await deleteItem(id);

  if (!deleted) {
    throw notFound('Template item not found');
  }

  console.info('[TEST_TEMPLATE][ITEM_DELETE][SUCCESS]', { requestId, itemId: id });
  return deleted;
}

module.exports = {
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
};
