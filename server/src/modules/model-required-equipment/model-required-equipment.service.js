const {
  findRequiredEquipmentById,
  findRequiredEquipmentByModelAndType,
  findRequiredEquipment,
  createRequiredEquipment,
  updateRequiredEquipment,
  deleteRequiredEquipment,
  findAvailableEquipmentByModelId,
} = require('./model-required-equipment.repository');

const { findModelById } = require('../products/products.repository');
const { findEquipmentTypeById } = require('../equipment/equipment.repository');
const { conflict, notFound } = require('../../shared/http-error');

async function ensureModelExists(modelId) {
  const model = await findModelById(modelId);

  if (!model) {
    throw notFound('Product model not found');
  }

  return model;
}

async function ensureEquipmentTypeExists(equipmentTypeId) {
  const equipmentType = await findEquipmentTypeById(equipmentTypeId);

  if (!equipmentType) {
    throw notFound('Equipment type not found');
  }

  return equipmentType;
}

async function listRequiredEquipment({ modelId, requestId }) {
  console.info('[MODEL_REQUIRED_EQUIPMENT][LIST][START]', { requestId, modelId });
  const rows = await findRequiredEquipment({ modelId });
  console.info('[MODEL_REQUIRED_EQUIPMENT][LIST][SUCCESS]', { requestId, count: rows.length });
  return rows;
}

async function createNewRequiredEquipment({ payload, requestId }) {
  console.info('[MODEL_REQUIRED_EQUIPMENT][CREATE][START]', {
    requestId,
    modelId: payload.model_id,
    equipmentTypeId: payload.equipment_type_id,
  });

  await ensureModelExists(payload.model_id);
  await ensureEquipmentTypeExists(payload.equipment_type_id);

  if (await findRequiredEquipmentByModelAndType(payload.model_id, payload.equipment_type_id)) {
    throw conflict('Required equipment already exists for this model', [
      {
        field: 'equipment_type_id',
        message: 'equipment_type_id already exists for this model',
      },
    ]);
  }

  const row = await createRequiredEquipment(payload);
  console.info('[MODEL_REQUIRED_EQUIPMENT][CREATE][SUCCESS]', { requestId, id: row.id });
  return row;
}

async function updateExistingRequiredEquipment({ id, payload, requestId }) {
  console.info('[MODEL_REQUIRED_EQUIPMENT][UPDATE][START]', { requestId, id });
  const existing = await findRequiredEquipmentById(id);

  if (!existing) {
    throw notFound('Required equipment not found');
  }

  const modelId = payload.model_id || existing.model_id;
  const equipmentTypeId = payload.equipment_type_id || existing.equipment_type_id;

  if (payload.model_id) {
    await ensureModelExists(payload.model_id);
  }

  if (payload.equipment_type_id) {
    await ensureEquipmentTypeExists(payload.equipment_type_id);
  }

  if (await findRequiredEquipmentByModelAndType(modelId, equipmentTypeId, id)) {
    throw conflict('Required equipment already exists for this model', [
      {
        field: 'equipment_type_id',
        message: 'equipment_type_id already exists for this model',
      },
    ]);
  }

  const row = await updateRequiredEquipment(id, payload);
  console.info('[MODEL_REQUIRED_EQUIPMENT][UPDATE][SUCCESS]', { requestId, id });
  return row;
}

async function removeRequiredEquipment({ id, requestId }) {
  console.info('[MODEL_REQUIRED_EQUIPMENT][DELETE][START]', { requestId, id });
  const deleted = await deleteRequiredEquipment(id);

  if (!deleted) {
    throw notFound('Required equipment not found');
  }

  console.info('[MODEL_REQUIRED_EQUIPMENT][DELETE][SUCCESS]', { requestId, id });
  return deleted;
}

async function getRequiredEquipmentForModel({ modelId, requestId }) {
  console.info('[MODEL_REQUIRED_EQUIPMENT][MODEL_LIST][START]', { requestId, modelId });
  await ensureModelExists(modelId);
  const rows = await findRequiredEquipment({ modelId });
  console.info('[MODEL_REQUIRED_EQUIPMENT][MODEL_LIST][SUCCESS]', { requestId, count: rows.length });
  return rows;
}

async function getAvailableEquipmentForModel({ modelId, requestId }) {
  console.info('[MODEL_REQUIRED_EQUIPMENT][AVAILABLE][START]', { requestId, modelId });
  await ensureModelExists(modelId);
  const rows = await findAvailableEquipmentByModelId(modelId);
  console.info('[MODEL_REQUIRED_EQUIPMENT][AVAILABLE][SUCCESS]', { requestId, count: rows.length });
  return rows;
}

module.exports = {
  listRequiredEquipment,
  createNewRequiredEquipment,
  updateExistingRequiredEquipment,
  removeRequiredEquipment,
  getRequiredEquipmentForModel,
  getAvailableEquipmentForModel,
};
