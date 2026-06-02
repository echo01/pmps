const {
  findTemplateById,
  findTemplateByIdentity,
  findTemplates,
  createTemplate,
  updateTemplate,
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
    modelId: payload.model_id,
    templateType: payload.template_type,
    templateName: payload.template_name,
    revision: payload.revision,
    excludeId,
  });

  if (existing) {
    console.warn('[TEST_TEMPLATE][DUPLICATE]', { requestId, templateId: existing.id });
    throw conflict('Template already exists for this model/type/revision', [
      {
        field: 'template_name',
        message: 'template_name and revision already exist for this model/type',
      },
    ]);
  }
}

async function createNewTemplate({ payload, userId, requestId }) {
  console.info('[TEST_TEMPLATE][CREATE][START]', {
    requestId,
    modelId: payload.model_id,
    templateType: payload.template_type,
  });

  await ensureModelExists(payload.model_id);
  await ensureTemplateIdentityAvailable(payload, requestId);

  const template = await createTemplate(payload, userId);
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
  listSections,
  createNewSection,
  updateExistingSection,
  removeSection,
  listItems,
  createNewItem,
  updateExistingItem,
  removeItem,
};
