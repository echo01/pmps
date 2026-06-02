const {
  listRequiredEquipment,
  createNewRequiredEquipment,
  updateExistingRequiredEquipment,
  removeRequiredEquipment,
  getRequiredEquipmentForModel,
  getAvailableEquipmentForModel,
} = require('./model-required-equipment.service');

const { successResponse, createdResponse } = require('../../shared/response');
const {
  parseOptionalPositiveInt,
  parsePayload,
  parsePositiveInt,
} = require('../../shared/query');
const {
  createRequiredEquipmentSchema,
  updateRequiredEquipmentSchema,
} = require('./model-required-equipment.schema');

async function getRequiredEquipment(req, res, next) {
  try {
    const rows = await listRequiredEquipment({
      modelId: parseOptionalPositiveInt(req.query.model_id, 'model_id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Required equipment retrieved successfully',
      data: rows,
    });
  } catch (error) {
    return next(error);
  }
}

async function postRequiredEquipment(req, res, next) {
  try {
    const row = await createNewRequiredEquipment({
      payload: parsePayload(createRequiredEquipmentSchema, req.body),
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'Required equipment created successfully',
      data: row,
    });
  } catch (error) {
    return next(error);
  }
}

async function putRequiredEquipment(req, res, next) {
  try {
    const row = await updateExistingRequiredEquipment({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(updateRequiredEquipmentSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Required equipment updated successfully',
      data: row,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteRequiredEquipmentById(req, res, next) {
  try {
    const deleted = await removeRequiredEquipment({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Required equipment deleted successfully',
      data: deleted,
    });
  } catch (error) {
    return next(error);
  }
}

async function getRequiredEquipmentByModel(req, res, next) {
  try {
    const rows = await getRequiredEquipmentForModel({
      modelId: parsePositiveInt(req.params.modelId, 'modelId'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Required equipment retrieved successfully',
      data: rows,
    });
  } catch (error) {
    return next(error);
  }
}

async function getAvailableEquipmentByModel(req, res, next) {
  try {
    const rows = await getAvailableEquipmentForModel({
      modelId: parsePositiveInt(req.params.modelId, 'modelId'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Available equipment retrieved successfully',
      data: rows,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getRequiredEquipment,
  postRequiredEquipment,
  putRequiredEquipment,
  deleteRequiredEquipmentById,
  getRequiredEquipmentByModel,
  getAvailableEquipmentByModel,
};
