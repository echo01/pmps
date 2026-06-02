const {
  findCategoryById,
  findCategoryByCode,
  findCategories,
  createCategory,
  updateCategory,
  findSubCategoryById,
  findSubCategoryByCode,
  findSubCategories,
  createSubCategory,
  updateSubCategory,
  findModelById,
  findModelByCode,
  findModels,
  createModel,
  updateModel,
  findModelLookup,
} = require('./products.repository');

const { conflict, notFound } = require('../../shared/http-error');

async function ensureCategoryExists(categoryId) {
  const category = await findCategoryById(categoryId);

  if (!category) {
    throw notFound('Product category not found');
  }

  return category;
}

async function ensureSubCategoryExists(subCategoryId) {
  const subCategory = await findSubCategoryById(subCategoryId);

  if (!subCategory) {
    throw notFound('Product sub category not found');
  }

  return subCategory;
}

async function listCategories({ search, active, requestId }) {
  console.info('[PRODUCT][CATEGORY_LIST][START]', { requestId, search, active });
  const categories = await findCategories({ search, active });
  console.info('[PRODUCT][CATEGORY_LIST][SUCCESS]', { requestId, count: categories.length });
  return categories;
}

async function createNewCategory({ payload, requestId }) {
  console.info('[PRODUCT][CATEGORY_CREATE][START]', {
    requestId,
    category_code: payload.category_code,
  });

  if (await findCategoryByCode(payload.category_code)) {
    throw conflict('Category code already exists', [
      { field: 'category_code', message: 'category_code already exists' },
    ]);
  }

  const category = await createCategory(payload);
  console.info('[PRODUCT][CATEGORY_CREATE][SUCCESS]', { requestId, categoryId: category.id });
  return category;
}

async function updateExistingCategory({ id, payload, requestId }) {
  console.info('[PRODUCT][CATEGORY_UPDATE][START]', { requestId, categoryId: id });
  await ensureCategoryExists(id);

  if (payload.category_code && await findCategoryByCode(payload.category_code, id)) {
    throw conflict('Category code already exists', [
      { field: 'category_code', message: 'category_code already exists' },
    ]);
  }

  const category = await updateCategory(id, payload);
  console.info('[PRODUCT][CATEGORY_UPDATE][SUCCESS]', { requestId, categoryId: id });
  return category;
}

async function listSubCategories({ search, active, categoryId, requestId }) {
  console.info('[PRODUCT][SUB_CATEGORY_LIST][START]', {
    requestId,
    search,
    active,
    categoryId,
  });
  const subCategories = await findSubCategories({ search, active, categoryId });
  console.info('[PRODUCT][SUB_CATEGORY_LIST][SUCCESS]', {
    requestId,
    count: subCategories.length,
  });
  return subCategories;
}

async function createNewSubCategory({ payload, requestId }) {
  console.info('[PRODUCT][SUB_CATEGORY_CREATE][START]', {
    requestId,
    sub_category_code: payload.sub_category_code,
  });

  await ensureCategoryExists(payload.category_id);

  if (await findSubCategoryByCode(payload.sub_category_code)) {
    throw conflict('Sub category code already exists', [
      { field: 'sub_category_code', message: 'sub_category_code already exists' },
    ]);
  }

  const subCategory = await createSubCategory(payload);
  console.info('[PRODUCT][SUB_CATEGORY_CREATE][SUCCESS]', {
    requestId,
    subCategoryId: subCategory.id,
  });
  return subCategory;
}

async function updateExistingSubCategory({ id, payload, requestId }) {
  console.info('[PRODUCT][SUB_CATEGORY_UPDATE][START]', { requestId, subCategoryId: id });
  await ensureSubCategoryExists(id);

  if (payload.category_id) {
    await ensureCategoryExists(payload.category_id);
  }

  if (payload.sub_category_code && await findSubCategoryByCode(payload.sub_category_code, id)) {
    throw conflict('Sub category code already exists', [
      { field: 'sub_category_code', message: 'sub_category_code already exists' },
    ]);
  }

  const subCategory = await updateSubCategory(id, payload);
  console.info('[PRODUCT][SUB_CATEGORY_UPDATE][SUCCESS]', { requestId, subCategoryId: id });
  return subCategory;
}

async function listModels({ search, active, subCategoryId, requestId }) {
  console.info('[PRODUCT][MODEL_LIST][START]', {
    requestId,
    search,
    active,
    subCategoryId,
  });
  const models = await findModels({ search, active, subCategoryId });
  console.info('[PRODUCT][MODEL_LIST][SUCCESS]', { requestId, count: models.length });
  return models;
}

async function getModel({ id, requestId }) {
  console.info('[PRODUCT][MODEL_GET][START]', { requestId, modelId: id });
  const model = await findModelById(id);

  if (!model) {
    throw notFound('Product model not found');
  }

  console.info('[PRODUCT][MODEL_GET][SUCCESS]', { requestId, modelId: id });
  return model;
}

async function createNewModel({ payload, requestId }) {
  console.info('[PRODUCT][MODEL_CREATE][START]', {
    requestId,
    model_code: payload.model_code,
  });

  await ensureSubCategoryExists(payload.sub_category_id);

  if (await findModelByCode(payload.model_code)) {
    throw conflict('Model code already exists', [
      { field: 'model_code', message: 'model_code already exists' },
    ]);
  }

  const model = await createModel(payload);
  console.info('[PRODUCT][MODEL_CREATE][SUCCESS]', { requestId, modelId: model.id });
  return model;
}

async function updateExistingModel({ id, payload, requestId }) {
  console.info('[PRODUCT][MODEL_UPDATE][START]', { requestId, modelId: id });
  await getModel({ id, requestId });

  if (payload.sub_category_id) {
    await ensureSubCategoryExists(payload.sub_category_id);
  }

  if (payload.model_code && await findModelByCode(payload.model_code, id)) {
    throw conflict('Model code already exists', [
      { field: 'model_code', message: 'model_code already exists' },
    ]);
  }

  const model = await updateModel(id, payload);
  console.info('[PRODUCT][MODEL_UPDATE][SUCCESS]', { requestId, modelId: id });
  return model;
}

async function getProductModelLookup({ requestId }) {
  console.info('[PRODUCT][MODEL_LOOKUP][START]', { requestId });
  const models = await findModelLookup();
  console.info('[PRODUCT][MODEL_LOOKUP][SUCCESS]', { requestId, count: models.length });
  return models;
}

module.exports = {
  listCategories,
  createNewCategory,
  updateExistingCategory,
  listSubCategories,
  createNewSubCategory,
  updateExistingSubCategory,
  listModels,
  getModel,
  createNewModel,
  updateExistingModel,
  getProductModelLookup,
};
