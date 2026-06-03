const { pool } = require('../../db/pool');

function executor(client) {
  return client || pool;
}

async function findQcLots({ search } = {}) {
  const values = [];
  const where = [`pl.status <> 'CANCELLED'`];

  if (search) {
    values.push(`%${search}%`);
    where.push(`(
      pl.lot_number ILIKE $${values.length}
      OR pm.model_code ILIKE $${values.length}
      OR pm.product_name ILIKE $${values.length}
    )`);
  }

  const result = await pool.query(
    `
      SELECT
        pl.id,
        pl.lot_number,
        pl.model_id,
        pm.model_code,
        pm.product_name,
        pl.lot_qty,
        COUNT(pu.id)::int AS serial_count,
        pl.status,
        pl.production_date,
        pl.created_at
      FROM production_lot pl
      JOIN product_model pm ON pm.id = pl.model_id
      LEFT JOIN product_unit pu ON pu.lot_id = pl.id
      WHERE ${where.join(' AND ')}
      GROUP BY pl.id, pm.id
      ORDER BY pl.production_date DESC NULLS LAST, pl.created_at DESC, pl.id DESC
      LIMIT 100
    `,
    values
  );

  return result.rows;
}

async function findLotById(lotId) {
  const result = await pool.query(
    `
      SELECT
        pl.id,
        pl.lot_number,
        pl.model_id,
        pm.model_code,
        pm.product_name,
        pl.lot_qty,
        pl.status,
        pl.production_date
      FROM production_lot pl
      JOIN product_model pm ON pm.id = pl.model_id
      WHERE pl.id = $1
    `,
    [lotId]
  );

  return result.rows[0] || null;
}

async function findLotUnits(lotId) {
  const result = await pool.query(
    `
      SELECT
        pu.id,
        pu.lot_id,
        pu.model_id,
        pu.serial_number,
        pu.product_status AS unit_status,
        ih.status AS latest_qc_status,
        ih.overall_result AS latest_qc_result,
        pu.created_at,
        pu.updated_at
      FROM product_unit pu
      LEFT JOIN LATERAL (
        SELECT status, overall_result
        FROM inspection_header ih
        WHERE ih.product_unit_id = pu.id
        ORDER BY ih.inspection_datetime DESC, ih.id DESC
        LIMIT 1
      ) ih ON true
      WHERE pu.lot_id = $1
      ORDER BY pu.serial_number ASC
    `,
    [lotId]
  );

  return result.rows;
}

async function findInspectionTemplatesByModelId(modelId) {
  const result = await pool.query(
    `
      SELECT
        id,
        model_id,
        template_type,
        template_name,
        revision,
        active,
        created_at,
        updated_at
      FROM test_template
      WHERE model_id = $1
        AND template_type = 'INSPECTION'
        AND active = true
      ORDER BY revision DESC NULLS LAST, created_at DESC, id DESC
    `,
    [modelId]
  );

  return result.rows;
}

async function findTemplateById(templateId) {
  const result = await pool.query(
    `
      SELECT
        id,
        model_id,
        template_type,
        template_name,
        revision,
        active,
        created_at,
        updated_at
      FROM test_template
      WHERE id = $1
    `,
    [templateId]
  );

  return result.rows[0] || null;
}

async function findInspectionTemplateItems(templateId) {
  const result = await pool.query(
    `
      SELECT
        i.id,
        i.template_id,
        i.section_id,
        s.seq_no AS section_seq_no,
        s.section_code,
        s.section_name,
        i.seq_no,
        i.item_code,
        i.test_point AS item_name,
        i.check_type,
        i.spec_min,
        i.spec_max,
        COALESCE(i.input_unit, i.source_unit) AS unit,
        i.mandatory,
        i.active
      FROM test_template_item i
      LEFT JOIN test_template_section s ON s.id = i.section_id
      WHERE i.template_id = $1
        AND i.active = true
      ORDER BY COALESCE(s.seq_no, 999999) ASC, i.seq_no ASC, i.id ASC
    `,
    [templateId]
  );

  return result.rows;
}

async function findProductUnitContext(productUnitId) {
  const result = await pool.query(
    `
      SELECT
        pu.id,
        pu.model_id,
        pu.lot_id,
        pu.serial_number,
        pu.product_status AS unit_status,
        pl.lot_number,
        pl.status AS lot_status,
        pm.model_code,
        pm.product_name
      FROM product_unit pu
      JOIN production_lot pl ON pl.id = pu.lot_id
      JOIN product_model pm ON pm.id = pu.model_id
      WHERE pu.id = $1
    `,
    [productUnitId]
  );

  return result.rows[0] || null;
}

async function findTemplateItemsByIds(templateId, itemIds) {
  if (!itemIds.length) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT
        id,
        template_id,
        seq_no,
        item_code,
        test_point AS item_name,
        check_type,
        spec_min,
        spec_max,
        mandatory,
        active
      FROM test_template_item
      WHERE template_id = $1
        AND id = ANY($2::int[])
        AND active = true
    `,
    [templateId, itemIds]
  );

  return result.rows;
}

async function findInspectionByUnitTemplateNo(productUnitId, templateId, inspectionNo, excludeId) {
  const values = [productUnitId, templateId, inspectionNo];
  let excludeSql = '';

  if (excludeId) {
    values.push(excludeId);
    excludeSql = `AND id <> $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT id
      FROM inspection_header
      WHERE product_unit_id = $1
        AND template_id = $2
        AND inspection_no = $3
      ${excludeSql}
    `,
    values
  );

  return result.rows[0] || null;
}

async function createInspectionHeader(payload, client) {
  const result = await executor(client).query(
    `
      INSERT INTO inspection_header (
        product_unit_id,
        template_id,
        inspection_no,
        operator_user_id,
        station_name,
        overall_result,
        status,
        remark,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `,
    [
      payload.product_unit_id,
      payload.template_id,
      payload.inspection_no,
      payload.operator_user_id,
      payload.station_name,
      payload.overall_result,
      payload.remark || null,
    ]
  );

  return result.rows[0];
}

async function updateInspectionHeader(id, payload, client) {
  const fields = [];
  const values = [];
  const fieldMap = {
    station_name: 'station_name',
    overall_result: 'overall_result',
    remark: 'remark',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      values.push(payload[key]);
      fields.push(`${column} = $${values.length}`);
    }
  }

  values.push(id);

  const result = await executor(client).query(
    `
      UPDATE inspection_header
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

async function insertInspectionDetails(inspectionId, details, client) {
  if (!details.length) {
    return [];
  }

  const result = await executor(client).query(
    `
      INSERT INTO inspection_detail (
        inspection_id,
        template_item_id,
        measured_value,
        measured_text,
        result,
        remark,
        created_at,
        updated_at
      )
      SELECT
        $1,
        detail.template_item_id,
        detail.measured_value,
        detail.measured_text,
        detail.result,
        detail.remark,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM jsonb_to_recordset($2::jsonb) AS detail(
        template_item_id int,
        measured_value numeric,
        measured_text text,
        result text,
        remark text
      )
      RETURNING id, inspection_id, template_item_id, measured_value, measured_text, result, remark, created_at, updated_at
    `,
    [inspectionId, JSON.stringify(details)]
  );

  return result.rows;
}

async function insertInspectionEquipment(inspectionId, equipmentIds, client) {
  if (!equipmentIds.length) {
    return [];
  }

  const result = await executor(client).query(
    `
      INSERT INTO inspection_equipment (inspection_id, equipment_id, created_at)
      SELECT $1, equipment_id, CURRENT_TIMESTAMP
      FROM unnest($2::int[]) AS equipment_id
      RETURNING id, inspection_id, equipment_id, usage_note, created_at
    `,
    [inspectionId, equipmentIds]
  );

  return result.rows;
}

async function deleteInspectionDetails(inspectionId, client) {
  await executor(client).query(
    `
      DELETE FROM inspection_detail
      WHERE inspection_id = $1
    `,
    [inspectionId]
  );
}

async function deleteInspectionEquipment(inspectionId, client) {
  await executor(client).query(
    `
      DELETE FROM inspection_equipment
      WHERE inspection_id = $1
    `,
    [inspectionId]
  );
}

async function findInspectionById(id) {
  const result = await pool.query(
    `
      SELECT
        ih.*,
        pu.serial_number,
        pu.lot_id,
        pu.model_id,
        pl.lot_number,
        pm.model_code,
        pm.product_name,
        tt.template_name,
        tt.revision,
        tt.template_type
      FROM inspection_header ih
      JOIN product_unit pu ON pu.id = ih.product_unit_id
      JOIN production_lot pl ON pl.id = pu.lot_id
      JOIN product_model pm ON pm.id = pu.model_id
      JOIN test_template tt ON tt.id = ih.template_id
      WHERE ih.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findInspectionDetails(id) {
  const result = await pool.query(
    `
      SELECT
        d.id,
        d.inspection_id,
        d.template_item_id,
        i.item_code,
        i.test_point AS item_name,
        i.check_type,
        i.mandatory,
        d.measured_value,
        d.measured_text,
        d.percent_error,
        d.result,
        d.remark,
        d.created_at,
        d.updated_at
      FROM inspection_detail d
      JOIN test_template_item i ON i.id = d.template_item_id
      WHERE d.inspection_id = $1
      ORDER BY i.seq_no ASC, d.id ASC
    `,
    [id]
  );

  return result.rows;
}

async function findInspectionEquipment(id) {
  const result = await pool.query(
    `
      SELECT
        ie.id,
        ie.inspection_id,
        ie.equipment_id,
        e.equipment_code,
        e.equipment_name,
        e.equipment_type_id,
        et.type_code AS equipment_type_code,
        e.status,
        e.calibration_due_date,
        ie.usage_note,
        ie.created_at
      FROM inspection_equipment ie
      JOIN equipment_master e ON e.id = ie.equipment_id
      LEFT JOIN equipment_type_master et ON et.id = e.equipment_type_id
      WHERE ie.inspection_id = $1
      ORDER BY e.equipment_code ASC
    `,
    [id]
  );

  return result.rows;
}

async function findApprovalLogs(id) {
  const result = await pool.query(
    `
      SELECT
        al.id,
        al.source_type,
        al.source_id,
        al.action,
        al.old_status,
        al.new_status,
        al.action_by,
        u.username AS action_by_username,
        al.action_datetime,
        al.remark
      FROM approval_log al
      LEFT JOIN app_user u ON u.id = al.action_by
      WHERE al.source_type = 'QC'
        AND al.source_id = $1
      ORDER BY al.action_datetime ASC, al.id ASC
    `,
    [id]
  );

  return result.rows;
}

async function findEquipmentByIds(equipmentIds) {
  if (!equipmentIds.length) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT
        e.id,
        e.equipment_code,
        e.equipment_name,
        e.equipment_type_id,
        et.type_code AS equipment_type_code,
        e.status,
        e.calibration_due_date
      FROM equipment_master e
      LEFT JOIN equipment_type_master et ON et.id = e.equipment_type_id
      WHERE e.id = ANY($1::int[])
    `,
    [equipmentIds]
  );

  return result.rows;
}

async function findModelRequiredEquipment(modelId) {
  const result = await pool.query(
    `
      SELECT
        mre.id,
        mre.model_id,
        mre.equipment_type_id,
        etm.type_code AS equipment_type_code,
        mre.required_qty,
        mre.mandatory
      FROM model_required_equipment mre
      JOIN equipment_type_master etm ON etm.id = mre.equipment_type_id
      WHERE mre.model_id = $1
      ORDER BY etm.type_code ASC
    `,
    [modelId]
  );

  return result.rows;
}

async function updateInspectionStatus(id, payload, client) {
  const fields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
  const values = [payload.status];

  if (Object.prototype.hasOwnProperty.call(payload, 'reviewer_user_id')) {
    values.push(payload.reviewer_user_id);
    fields.push(`reviewer_user_id = $${values.length}`);
    fields.push('reviewed_at = CURRENT_TIMESTAMP');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'approver_user_id')) {
    values.push(payload.approver_user_id);
    fields.push(`approver_user_id = $${values.length}`);
    fields.push('approved_at = CURRENT_TIMESTAMP');
  }

  values.push(id);

  const result = await executor(client).query(
    `
      UPDATE inspection_header
      SET ${fields.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

async function insertApprovalLog(payload, client) {
  const result = await executor(client).query(
    `
      INSERT INTO approval_log (
        source_type,
        source_id,
        action,
        old_status,
        new_status,
        action_by,
        action_datetime,
        remark
      )
      VALUES ('QC', $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
      RETURNING *
    `,
    [
      payload.source_id,
      payload.action,
      payload.old_status,
      payload.new_status,
      payload.action_by,
      payload.remark || null,
    ]
  );

  return result.rows[0];
}

async function findInspectionDetailsForEdit(inspectionId, detailIds) {
  if (!detailIds.length) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT
        d.id,
        d.inspection_id,
        d.template_item_id,
        d.measured_value,
        d.measured_text,
        d.result,
        d.remark,
        i.item_code,
        i.test_point AS item_name,
        i.check_type,
        i.spec_min,
        i.spec_max,
        i.mandatory
      FROM inspection_detail d
      JOIN test_template_item i ON i.id = d.template_item_id
      WHERE d.inspection_id = $1
        AND d.id = ANY($2::int[])
      ORDER BY d.id ASC
    `,
    [inspectionId, detailIds]
  );

  return result.rows;
}

async function findAllInspectionDetailsForOverall(inspectionId, client) {
  const result = await executor(client).query(
    `
      SELECT
        d.id,
        d.inspection_id,
        d.template_item_id,
        d.measured_value,
        d.measured_text,
        d.result,
        i.mandatory
      FROM inspection_detail d
      JOIN test_template_item i ON i.id = d.template_item_id
      WHERE d.inspection_id = $1
      ORDER BY d.id ASC
    `,
    [inspectionId]
  );

  return result.rows;
}

async function updateInspectionDetailResult(detailId, payload, client) {
  const result = await executor(client).query(
    `
      UPDATE inspection_detail
      SET
        measured_value = $2,
        measured_text = $3,
        result = $4,
        remark = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [
      detailId,
      payload.measured_value,
      payload.measured_text,
      payload.result,
      payload.remark || null,
    ]
  );

  return result.rows[0] || null;
}

async function updateInspectionAfterApprovedEdit(id, payload, client) {
  const result = await executor(client).query(
    `
      UPDATE inspection_header
      SET
        status = $2,
        overall_result = $3,
        reviewer_user_id = NULL,
        approver_user_id = NULL,
        reviewed_at = NULL,
        approved_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [id, payload.status, payload.overall_result]
  );

  return result.rows[0] || null;
}

async function insertResultEditAuditLog(payload, client) {
  const result = await executor(client).query(
    `
      INSERT INTO result_edit_audit_log (
        source_type,
        source_id,
        detail_id,
        template_item_id,
        old_measured_value,
        new_measured_value,
        old_measured_text,
        new_measured_text,
        old_result,
        new_result,
        old_overall_result,
        new_overall_result,
        edit_reason,
        edit_by,
        edit_at,
        approval_status
      )
      VALUES (
        'QC', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, $14
      )
      RETURNING *
    `,
    [
      payload.source_id,
      payload.detail_id || null,
      payload.template_item_id || null,
      payload.old_measured_value ?? null,
      payload.new_measured_value ?? null,
      payload.old_measured_text || null,
      payload.new_measured_text || null,
      payload.old_result || null,
      payload.new_result || null,
      payload.old_overall_result || null,
      payload.new_overall_result || null,
      payload.edit_reason,
      payload.edit_by,
      payload.approval_status,
    ]
  );

  return result.rows[0];
}

async function findResultEditAuditLogs(inspectionId) {
  const result = await pool.query(
    `
      SELECT
        l.id,
        l.source_type,
        l.source_id,
        l.detail_id,
        l.template_item_id,
        i.item_code,
        i.test_point AS item_name,
        l.old_measured_value,
        l.new_measured_value,
        l.old_measured_text,
        l.new_measured_text,
        l.old_result,
        l.new_result,
        l.old_overall_result,
        l.new_overall_result,
        l.edit_reason,
        l.edit_by,
        u.username AS edit_by_username,
        l.edit_at,
        l.approval_status
      FROM result_edit_audit_log l
      LEFT JOIN test_template_item i ON i.id = l.template_item_id
      LEFT JOIN app_user u ON u.id = l.edit_by
      WHERE l.source_type = 'QC'
        AND l.source_id = $1
      ORDER BY l.edit_at ASC, l.id ASC
    `,
    [inspectionId]
  );

  return result.rows;
}

module.exports = {
  findQcLots,
  findLotById,
  findLotUnits,
  findInspectionTemplatesByModelId,
  findTemplateById,
  findInspectionTemplateItems,
  findProductUnitContext,
  findTemplateItemsByIds,
  findInspectionByUnitTemplateNo,
  createInspectionHeader,
  updateInspectionHeader,
  insertInspectionDetails,
  insertInspectionEquipment,
  deleteInspectionDetails,
  deleteInspectionEquipment,
  findInspectionById,
  findInspectionDetails,
  findInspectionEquipment,
  findApprovalLogs,
  findEquipmentByIds,
  findModelRequiredEquipment,
  updateInspectionStatus,
  insertApprovalLog,
  findInspectionDetailsForEdit,
  findAllInspectionDetailsForOverall,
  updateInspectionDetailResult,
  updateInspectionAfterApprovedEdit,
  insertResultEditAuditLog,
  findResultEditAuditLogs,
};
