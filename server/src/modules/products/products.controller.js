const {
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
} = require('./products.service');

const { successResponse, createdResponse } = require('../../shared/response');
const {
  parseBooleanQuery,
  parseOptionalPositiveInt,
  parsePayload,
  parsePositiveInt,
} = require('../../shared/query');
const {
  createCategorySchema,
  updateCategorySchema,
  createSubCategorySchema,
  updateSubCategorySchema,
  createModelSchema,
  updateModelSchema,
} = require('./products.schema');

async function getCategories(req, res, next) {
  try {
    const categories = await listCategories({
      search: req.query.search,
      active: parseBooleanQuery(req.query.active),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Product categories retrieved successfully',
      data: categories,
    });
  } catch (error) {
    return next(error);
  }
}

async function postCategory(req, res, next) {
  try {
    const category = await createNewCategory({
      payload: parsePayload(createCategorySchema, req.body),
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'Product category created successfully',
      data: category,
    });
  } catch (error) {
    return next(error);
  }
}

async function putCategory(req, res, next) {
  try {
    const category = await updateExistingCategory({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(updateCategorySchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Product category updated successfully',
      data: category,
    });
  } catch (error) {
    return next(error);
  }
}

async function getSubCategories(req, res, next) {
  try {
    const subCategories = await listSubCategories({
      search: req.query.search,
      active: parseBooleanQuery(req.query.active),
      categoryId: parseOptionalPositiveInt(req.query.category_id, 'category_id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Product sub categories retrieved successfully',
      data: subCategories,
    });
  } catch (error) {
    return next(error);
  }
}

async function postSubCategory(req, res, next) {
  try {
    const subCategory = await createNewSubCategory({
      payload: parsePayload(createSubCategorySchema, req.body),
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'Product sub category created successfully',
      data: subCategory,
    });
  } catch (error) {
    return next(error);
  }
}

async function putSubCategory(req, res, next) {
  try {
    const subCategory = await updateExistingSubCategory({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(updateSubCategorySchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Product sub category updated successfully',
      data: subCategory,
    });
  } catch (error) {
    return next(error);
  }
}

async function getModels(req, res, next) {
  try {
    const models = await listModels({
      search: req.query.search,
      active: parseBooleanQuery(req.query.active),
      subCategoryId: parseOptionalPositiveInt(req.query.sub_category_id, 'sub_category_id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Product models retrieved successfully',
      data: models,
    });
  } catch (error) {
    return next(error);
  }
}

async function getModelById(req, res, next) {
  try {
    const model = await getModel({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Product model retrieved successfully',
      data: model,
    });
  } catch (error) {
    return next(error);
  }
}

async function postModel(req, res, next) {
  try {
    const model = await createNewModel({
      payload: parsePayload(createModelSchema, req.body),
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'Product model created successfully',
      data: model,
    });
  } catch (error) {
    return next(error);
  }
}

async function putModel(req, res, next) {
  try {
    const model = await updateExistingModel({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(updateModelSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Product model updated successfully',
      data: model,
    });
  } catch (error) {
    return next(error);
  }
}

async function getModelLookup(req, res, next) {
  try {
    const models = await getProductModelLookup({
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Product model lookup retrieved successfully',
      data: models,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
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
};
