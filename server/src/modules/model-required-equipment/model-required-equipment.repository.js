const { pool } = require('../../db/pool');
const { getCalibrationStatus } = require('../../shared/calibration-status');

function mapAvailableEquipment(row) {
  return {
    ...row,
    calibration_status: getCalibrationStatus(row.calibration_due_date),
  };
}

async function findRequiredEquipmentById(id) {
  const result = await pool.query(
    `
      SELECT
        mre.id,
        mre.model_id,
        pm.model_code,
        pm.product_name,
        mre.equipment_type_id,
        etm.type_code AS equipment_type_code,
        etm.type_name AS equipment_type_name,
        mre.required_qty,
        mre.mandatory,
        mre.remark,
        mre.created_at,
        mre.updated_at
      FROM model_required_equipment mre
      JOIN product_model pm ON pm.id = mre.model_id
      JOIN equipment_type_master etm ON etm.id = mre.equipment_type_id
      WHERE mre.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findRequiredEquipmentByModelAndType(modelId, equipmentTypeId, excludeId) {
  const values = [modelId, equipmentTypeId];
  let excludeSql = '';

  if (excludeId) {
    values.push(excludeId);
    excludeSql = `AND id <> $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT id, model_id, equipment_type_id
      FROM model_required_equipment
      WHERE model_id = $1
        AND equipment_type_id = $2
      ${excludeSql}
    `,
    values
  );

  return result.rows[0] || null;
}

async function findRequiredEquipment({ modelId } = {}) {
  const values = [];
  const where = [];

  if (modelId) {
    values.push(modelId);
    where.push(`mre.model_id = $${values.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        mre.id,
        mre.model_id,
        pm.model_code,
        pm.product_name,
        mre.equipment_type_id,
        etm.type_code AS equipment_type_code,
        etm.type_name AS equipment_type_name,
        mre.required_qty,
        mre.mandatory,
        mre.remark,
        mre.created_at,
        mre.updated_at
      FROM model_required_equipment mre
      JOIN product_model pm ON pm.id = mre.model_id
      JOIN equipment_type_master etm ON etm.id = mre.equipment_type_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY pm.model_code ASC, etm.type_code ASC
    `,
    values
  );

  return result.rows;
}

async function createRequiredEquipment(payload) {
  const result = await pool.query(
    `
      INSERT INTO model_required_equipment (
        model_id, equipment_type_id, required_qty, mandatory, remark, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `,
    [
      payload.model_id,
      payload.equipment_type_id,
      payload.required_qty || 1,
      payload.mandatory ?? true,
      payload.remark || null,
    ]
  );

  return findRequiredEquipmentById(result.rows[0].id);
}

async function updateRequiredEquipment(id, payload) {
  const fields = [];
  const values = [];
  const fieldMap = {
    model_id: 'model_id',
    equipment_type_id: 'equipment_type_id',
    required_qty: 'required_qty',
    mandatory: 'mandatory',
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
      UPDATE model_required_equipment
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id
    `,
    values
  );

  return result.rows[0] ? findRequiredEquipmentById(id) : null;
}

async function deleteRequiredEquipment(id) {
  const result = await pool.query(
    `
      DELETE FROM model_required_equipment
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findAvailableEquipmentByModelId(modelId) {
  const result = await pool.query(
    `
      SELECT
        e.id AS equipment_id,
        e.equipment_code,
        e.equipment_name,
        e.equipment_type_id,
        etm.type_code AS equipment_type_code,
        etm.type_name AS equipment_type_name,
        e.status,
        e.calibration_due_date,
        mre.required_qty,
        mre.mandatory
      FROM model_required_equipment mre
      JOIN equipment_type_master etm ON etm.id = mre.equipment_type_id
      JOIN equipment_master e ON e.equipment_type_id = mre.equipment_type_id
      WHERE mre.model_id = $1
        AND e.status = 'ACTIVE'
      ORDER BY etm.type_code ASC, e.equipment_code ASC
    `,
    [modelId]
  );

  return result.rows.map(mapAvailableEquipment);
}

module.exports = {
  findRequiredEquipmentById,
  findRequiredEquipmentByModelAndType,
  findRequiredEquipment,
  createRequiredEquipment,
  updateRequiredEquipment,
  deleteRequiredEquipment,
  findAvailableEquipmentByModelId,
};
