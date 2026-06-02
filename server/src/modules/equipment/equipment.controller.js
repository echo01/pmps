const {
  listEquipmentTypes,
  createNewEquipmentType,
  updateExistingEquipmentType,
  listEquipment,
  getEquipmentById,
  createNewEquipment,
  updateExistingEquipment,
  listExpiredCalibrationEquipment,
} = require('./equipment.service');

const { successResponse, createdResponse } = require('../../shared/response');
const {
  parseOptionalPositiveInt,
  parsePayload,
  parsePositiveInt,
} = require('../../shared/query');
const {
  createEquipmentTypeSchema,
  updateEquipmentTypeSchema,
  createEquipmentSchema,
  updateEquipmentSchema,
} = require('./equipment.schema');

async function getEquipmentTypes(req, res, next) {
  try {
    const types = await listEquipmentTypes({
      search: req.query.search,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Equipment types retrieved successfully',
      data: types,
    });
  } catch (error) {
    return next(error);
  }
}

async function postEquipmentType(req, res, next) {
  try {
    const type = await createNewEquipmentType({
      payload: parsePayload(createEquipmentTypeSchema, req.body),
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'Equipment type created successfully',
      data: type,
    });
  } catch (error) {
    return next(error);
  }
}

async function putEquipmentType(req, res, next) {
  try {
    const type = await updateExistingEquipmentType({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(updateEquipmentTypeSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Equipment type updated successfully',
      data: type,
    });
  } catch (error) {
    return next(error);
  }
}

async function getEquipment(req, res, next) {
  try {
    const equipment = await listEquipment({
      search: req.query.search,
      status: req.query.status,
      equipmentTypeId: parseOptionalPositiveInt(req.query.equipment_type_id, 'equipment_type_id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Equipment retrieved successfully',
      data: equipment,
    });
  } catch (error) {
    return next(error);
  }
}

async function getEquipmentDetail(req, res, next) {
  try {
    const equipment = await getEquipmentById({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Equipment retrieved successfully',
      data: equipment,
    });
  } catch (error) {
    return next(error);
  }
}

async function postEquipment(req, res, next) {
  try {
    const equipment = await createNewEquipment({
      payload: parsePayload(createEquipmentSchema, req.body),
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'Equipment created successfully',
      data: equipment,
    });
  } catch (error) {
    return next(error);
  }
}

async function putEquipment(req, res, next) {
  try {
    const equipment = await updateExistingEquipment({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(updateEquipmentSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Equipment updated successfully',
      data: equipment,
    });
  } catch (error) {
    return next(error);
  }
}

async function getExpiredCalibration(req, res, next) {
  try {
    const equipment = await listExpiredCalibrationEquipment({
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Expired calibration equipment retrieved successfully',
      data: equipment,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getEquipmentTypes,
  postEquipmentType,
  putEquipmentType,
  getEquipment,
  getEquipmentDetail,
  postEquipment,
  putEquipment,
  getExpiredCalibration,
};
