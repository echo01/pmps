const { pool } = require('../../db/pool');
const { getCalibrationStatus } = require('../../shared/calibration-status');

function mapEquipment(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    calibration_status: getCalibrationStatus(row.calibration_due_date),
  };
}

async function findEquipmentTypeById(id) {
  const result = await pool.query(
    `
      SELECT id, type_code, type_name, description, created_at, updated_at
      FROM equipment_type_master
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findEquipmentTypeByCode(typeCode, excludeId) {
  const values = [typeCode];
  let excludeSql = '';

  if (excludeId) {
    values.push(excludeId);
    excludeSql = `AND id <> $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT id, type_code
      FROM equipment_type_master
      WHERE type_code = $1
      ${excludeSql}
    `,
    values
  );

  return result.rows[0] || null;
}

async function findEquipmentTypes({ search } = {}) {
  const values = [];
  let whereSql = '';

  if (search) {
    values.push(`%${search}%`);
    whereSql = `WHERE type_code ILIKE $1 OR type_name ILIKE $1`;
  }

  const result = await pool.query(
    `
      SELECT id, type_code, type_name, description, created_at, updated_at
      FROM equipment_type_master
      ${whereSql}
      ORDER BY type_code ASC
    `,
    values
  );

  return result.rows;
}

async function createEquipmentType(payload) {
  const result = await pool.query(
    `
      INSERT INTO equipment_type_master (type_code, type_name, description, created_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, type_code, type_name, description, created_at, updated_at
    `,
    [payload.type_code, payload.type_name, payload.description || null]
  );

  return result.rows[0];
}

async function updateEquipmentType(id, payload) {
  const fields = [];
  const values = [];
  const fieldMap = {
    type_code: 'type_code',
    type_name: 'type_name',
    description: 'description',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      values.push(payload[key]);
      fields.push(`${column} = $${values.length}`);
    }
  }

  values.push(id);
  const result = await pool.query(
    `
      UPDATE equipment_type_master
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id, type_code, type_name, description, created_at, updated_at
    `,
    values
  );

  return result.rows[0] || null;
}

async function findEquipmentById(id) {
  const result = await pool.query(
    `
      SELECT
        e.id, e.equipment_code, e.equipment_name,
        e.equipment_type_id, et.type_code AS equipment_type_code, et.type_name AS equipment_type_name,
        e.brand, e.model, e.serial_number,
        e.calibration_no, e.calibration_date, e.calibration_due_date,
        e.status, e.location_name, e.asset_no, e.remark,
        e.created_at, e.updated_at
      FROM equipment_master e
      LEFT JOIN equipment_type_master et ON et.id = e.equipment_type_id
      WHERE e.id = $1
    `,
    [id]
  );

  return mapEquipment(result.rows[0]);
}

async function findEquipmentByCode(equipmentCode, excludeId) {
  const values = [equipmentCode];
  let excludeSql = '';

  if (excludeId) {
    values.push(excludeId);
    excludeSql = `AND id <> $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT id, equipment_code
      FROM equipment_master
      WHERE equipment_code = $1
      ${excludeSql}
    `,
    values
  );

  return result.rows[0] || null;
}

async function findEquipment({ search, status, equipmentTypeId } = {}) {
  const values = [];
  const where = [];

  if (search) {
    values.push(`%${search}%`);
    where.push(`(e.equipment_code ILIKE $${values.length} OR e.equipment_name ILIKE $${values.length} OR e.serial_number ILIKE $${values.length})`);
  }

  if (status) {
    values.push(status);
    where.push(`e.status = $${values.length}`);
  }

  if (equipmentTypeId) {
    values.push(equipmentTypeId);
    where.push(`e.equipment_type_id = $${values.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        e.id, e.equipment_code, e.equipment_name,
        e.equipment_type_id, et.type_code AS equipment_type_code, et.type_name AS equipment_type_name,
        e.brand, e.model, e.serial_number,
        e.calibration_no, e.calibration_date, e.calibration_due_date,
        e.status, e.location_name, e.asset_no, e.remark,
        e.created_at, e.updated_at
      FROM equipment_master e
      LEFT JOIN equipment_type_master et ON et.id = e.equipment_type_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY e.equipment_code ASC
    `,
    values
  );

  return result.rows.map(mapEquipment);
}

async function findExpiredEquipment() {
  const result = await pool.query(
    `
      SELECT
        e.id, e.equipment_code, e.equipment_name,
        e.equipment_type_id, et.type_code AS equipment_type_code, et.type_name AS equipment_type_name,
        e.brand, e.model, e.serial_number,
        e.calibration_no, e.calibration_date, e.calibration_due_date,
        e.status, e.location_name, e.asset_no, e.remark,
        e.created_at, e.updated_at
      FROM equipment_master e
      LEFT JOIN equipment_type_master et ON et.id = e.equipment_type_id
      WHERE e.calibration_due_date IS NOT NULL
        AND e.calibration_due_date < CURRENT_DATE
      ORDER BY e.calibration_due_date ASC, e.equipment_code ASC
    `
  );

  return result.rows.map(mapEquipment);
}

async function createEquipment(payload) {
  const result = await pool.query(
    `
      INSERT INTO equipment_master (
        equipment_code, equipment_name, equipment_type_id,
        brand, model, serial_number,
        calibration_no, calibration_date, calibration_due_date,
        status, location_name, asset_no, remark,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `,
    [
      payload.equipment_code,
      payload.equipment_name,
      payload.equipment_type_id || null,
      payload.brand || null,
      payload.model || null,
      payload.serial_number || null,
      payload.calibration_no || null,
      payload.calibration_date || null,
      payload.calibration_due_date || null,
      payload.status || 'ACTIVE',
      payload.location_name || null,
      payload.asset_no || null,
      payload.remark || null,
    ]
  );

  return findEquipmentById(result.rows[0].id);
}

async function updateEquipment(id, payload) {
  const fields = [];
  const values = [];
  const fieldMap = {
    equipment_code: 'equipment_code',
    equipment_name: 'equipment_name',
    equipment_type_id: 'equipment_type_id',
    brand: 'brand',
    model: 'model',
    serial_number: 'serial_number',
    calibration_no: 'calibration_no',
    calibration_date: 'calibration_date',
    calibration_due_date: 'calibration_due_date',
    status: 'status',
    location_name: 'location_name',
    asset_no: 'asset_no',
    remark: 'remark',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      values.push(payload[key]);
      fields.push(`${column} = $${values.length}`);
    }
  }

  values.push(id);
  const result = await pool.query(
    `
      UPDATE equipment_master
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id
    `,
    values
  );

  return result.rows[0] ? findEquipmentById(id) : null;
}

module.exports = {
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
};
