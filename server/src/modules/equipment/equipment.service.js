const {
  findEquipmentTypeById,
  findEquipmentTypeByCode,
  findEquipmentTypes,
  createEquipmentType,
  updateEquipmentType,
  findEquipmentById,
  findEquipmentByCode,
  findEquipment,
  findExpiredEquipment,
  createEquipment,
  updateEquipment,
} = require('./equipment.repository');

const { conflict, notFound } = require('../../shared/http-error');

async function ensureEquipmentTypeExists(id) {
  if (!id) {
    return null;
  }

  const equipmentType = await findEquipmentTypeById(id);

  if (!equipmentType) {
    throw notFound('Equipment type not found');
  }

  return equipmentType;
}

async function listEquipmentTypes({ search, requestId }) {
  console.info('[EQUIPMENT][TYPE_LIST][START]', { requestId, search });
  const types = await findEquipmentTypes({ search });
  console.info('[EQUIPMENT][TYPE_LIST][SUCCESS]', { requestId, count: types.length });
  return types;
}

async function createNewEquipmentType({ payload, requestId }) {
  console.info('[EQUIPMENT][TYPE_CREATE][START]', {
    requestId,
    type_code: payload.type_code,
  });

  if (await findEquipmentTypeByCode(payload.type_code)) {
    throw conflict('Equipment type code already exists', [
      { field: 'type_code', message: 'type_code already exists' },
    ]);
  }

  const type = await createEquipmentType(payload);
  console.info('[EQUIPMENT][TYPE_CREATE][SUCCESS]', { requestId, equipmentTypeId: type.id });
  return type;
}

async function updateExistingEquipmentType({ id, payload, requestId }) {
  console.info('[EQUIPMENT][TYPE_UPDATE][START]', { requestId, equipmentTypeId: id });
  await ensureEquipmentTypeExists(id);

  if (payload.type_code && await findEquipmentTypeByCode(payload.type_code, id)) {
    throw conflict('Equipment type code already exists', [
      { field: 'type_code', message: 'type_code already exists' },
    ]);
  }

  const type = await updateEquipmentType(id, payload);
  console.info('[EQUIPMENT][TYPE_UPDATE][SUCCESS]', { requestId, equipmentTypeId: id });
  return type;
}

async function listEquipment({ search, status, equipmentTypeId, requestId }) {
  console.info('[EQUIPMENT][LIST][START]', {
    requestId,
    search,
    status,
    equipmentTypeId,
  });
  const equipment = await findEquipment({ search, status, equipmentTypeId });
  console.info('[EQUIPMENT][LIST][SUCCESS]', { requestId, count: equipment.length });
  return equipment;
}

async function getEquipmentById({ id, requestId }) {
  console.info('[EQUIPMENT][GET][START]', { requestId, equipmentId: id });
  const equipment = await findEquipmentById(id);

  if (!equipment) {
    throw notFound('Equipment not found');
  }

  console.info('[EQUIPMENT][GET][SUCCESS]', { requestId, equipmentId: id });
  return equipment;
}

async function createNewEquipment({ payload, requestId }) {
  console.info('[EQUIPMENT][CREATE][START]', {
    requestId,
    equipment_code: payload.equipment_code,
  });

  await ensureEquipmentTypeExists(payload.equipment_type_id);

  if (await findEquipmentByCode(payload.equipment_code)) {
    throw conflict('Equipment code already exists', [
      { field: 'equipment_code', message: 'equipment_code already exists' },
    ]);
  }

  const equipment = await createEquipment(payload);
  console.info('[EQUIPMENT][CREATE][SUCCESS]', { requestId, equipmentId: equipment.id });
  return equipment;
}

async function updateExistingEquipment({ id, payload, requestId }) {
  console.info('[EQUIPMENT][UPDATE][START]', { requestId, equipmentId: id });
  await getEquipmentById({ id, requestId });
  await ensureEquipmentTypeExists(payload.equipment_type_id);

  if (payload.equipment_code && await findEquipmentByCode(payload.equipment_code, id)) {
    throw conflict('Equipment code already exists', [
      { field: 'equipment_code', message: 'equipment_code already exists' },
    ]);
  }

  const equipment = await updateEquipment(id, payload);
  console.info('[EQUIPMENT][UPDATE][SUCCESS]', { requestId, equipmentId: id });
  return equipment;
}

async function listExpiredCalibrationEquipment({ requestId }) {
  console.info('[EQUIPMENT][EXPIRED_CALIBRATION][START]', { requestId });
  const equipment = await findExpiredEquipment();
  console.info('[EQUIPMENT][EXPIRED_CALIBRATION][SUCCESS]', {
    requestId,
    count: equipment.length,
  });
  return equipment;
}

module.exports = {
  listEquipmentTypes,
  createNewEquipmentType,
  updateExistingEquipmentType,
  listEquipment,
  getEquipmentById,
  createNewEquipment,
  updateExistingEquipment,
  listExpiredCalibrationEquipment,
  ensureEquipmentTypeExists,
};
