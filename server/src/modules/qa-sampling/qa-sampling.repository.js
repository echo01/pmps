const { pool } = require('../../db/pool');

function executor(client) {
  return client || pool;
}

async function findQaLots({ search, model_code, lot_number, status, date_from, date_to } = {}) {
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

  if (model_code) {
    values.push(`%${model_code}%`);
    where.push(`pm.model_code ILIKE $${values.length}`);
  }

  if (lot_number) {
    values.push(`%${lot_number}%`);
    where.push(`pl.lot_number ILIKE $${values.length}`);
  }

  if (status) {
    values.push(status);
    where.push(`COALESCE(latest_sampling.status, 'NOT_STARTED') = $${values.length}`);
  }

  if (date_from) {
    values.push(date_from);
    where.push(`pl.production_date >= $${values.length}`);
  }

  if (date_to) {
    values.push(date_to);
    where.push(`pl.production_date <= $${values.length}`);
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
        pl.status AS production_lot_status,
        latest_sampling.id AS qa_sampling_id,
        COALESCE(latest_sampling.status, 'NOT_STARTED') AS sampling_status,
        COALESCE(sample_progress.sample_qty, 0)::int AS sample_qty,
        latest_sampling.overall_result AS sampling_result,
        latest_sampling.updated_at AS sampling_updated_at,
        pl.production_date,
        pl.created_at
      FROM production_lot pl
      JOIN product_model pm ON pm.id = pl.model_id
      LEFT JOIN product_unit pu ON pu.lot_id = pl.id
      LEFT JOIN LATERAL (
        SELECT
          qsh.id,
          qsh.status,
          qsh.overall_result,
          qsh.updated_at
        FROM qa_sampling_header qsh
        WHERE qsh.lot_id = pl.id
        ORDER BY qsh.updated_at DESC, qsh.id DESC
        LIMIT 1
      ) latest_sampling ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT qsu.product_unit_id)::int AS sample_qty
        FROM qa_sampling_header qsh
        JOIN qa_sample_unit qsu ON qsu.qa_sampling_id = qsh.id
        WHERE qsh.lot_id = pl.id
      ) sample_progress ON true
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY pl.id, pm.id, latest_sampling.id, latest_sampling.status,
        sample_progress.sample_qty, latest_sampling.overall_result, latest_sampling.updated_at
      ORDER BY pl.production_date DESC NULLS LAST, pl.created_at DESC, pl.id DESC
      LIMIT 100
    `,
    values
  );

  return result.rows;
}

async function findLotSamplingStatus(lotId) {
  const result = await pool.query(
    `
      SELECT
        pu.id AS product_unit_id,
        pu.lot_id,
        pu.model_id,
        pu.serial_number,
        pu.product_status AS unit_status,
        latest.qa_sampling_id,
        latest.sampling_no,
        latest.template_id,
        latest.template_name,
        latest.revision,
        COALESCE(latest.qa_status, 'NOT_STARTED') AS qa_status,
        latest.unit_result,
        latest.overall_result,
        latest.updated_at
      FROM product_unit pu
      LEFT JOIN LATERAL (
        SELECT
          qsh.id AS qa_sampling_id,
          qsh.sampling_round AS sampling_no,
          qsh.template_id,
          tt.template_name,
          tt.revision,
          qsh.status AS qa_status,
          qsh.overall_result,
          qsu.unit_result,
          GREATEST(qsh.updated_at, qsu.updated_at) AS updated_at
        FROM qa_sample_unit qsu
        JOIN qa_sampling_header qsh ON qsh.id = qsu.qa_sampling_id
        JOIN test_template tt ON tt.id = qsh.template_id
        WHERE qsu.product_unit_id = pu.id
        ORDER BY qsh.updated_at DESC, qsh.id DESC
        LIMIT 1
      ) latest ON true
      WHERE pu.lot_id = $1
      ORDER BY pu.serial_number ASC
    `,
    [lotId]
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
        qsu.unit_result AS latest_qa_result,
        qsu.status AS latest_qa_status,
        pu.created_at,
        pu.updated_at
      FROM product_unit pu
      LEFT JOIN LATERAL (
        SELECT qsu.unit_result, qsh.status
        FROM qa_sample_unit qsu
        JOIN qa_sampling_header qsh ON qsh.id = qsu.qa_sampling_id
        WHERE qsu.product_unit_id = pu.id
        ORDER BY qsh.sampling_datetime DESC, qsh.id DESC
        LIMIT 1
      ) qsu ON true
      WHERE pu.lot_id = $1
      ORDER BY pu.serial_number ASC
    `,
    [lotId]
  );

  return result.rows;
}

async function findQaTemplatesByModelId(modelId) {
  const result = await pool.query(
    `
      SELECT
        t.id,
        t.model_id,
        t.template_type,
        t.template_name,
        t.revision,
        t.active,
        t.created_at,
        t.updated_at
      FROM test_template t
      JOIN test_template_model ttm ON ttm.template_id = t.id
      WHERE ttm.model_id = $1
        AND t.template_type = 'QA'
        AND t.active = true
      ORDER BY t.revision DESC NULLS LAST, t.created_at DESC, t.id DESC
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

async function isTemplateAssignedToModel(templateId, modelId) {
  const result = await pool.query(
    `
      SELECT 1
      FROM test_template_model
      WHERE template_id = $1
        AND model_id = $2
      LIMIT 1
    `,
    [templateId, modelId]
  );

  return Boolean(result.rows[0]);
}

async function findQaTemplateItems(templateId) {
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

async function findLotUnitsByIds(lotId, productUnitIds) {
  if (!productUnitIds.length) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT
        id,
        lot_id,
        model_id,
        serial_number,
        product_status AS unit_status
      FROM product_unit
      WHERE lot_id = $1
        AND id = ANY($2::int[])
    `,
    [lotId, productUnitIds]
  );

  return result.rows;
}

async function findProductUnitContextByLotAndSerial(lotNumber, serialNumber) {
  const result = await pool.query(
    `
      SELECT
        pu.id,
        pu.lot_id,
        pu.model_id,
        pu.serial_number,
        pu.product_status AS unit_status,
        pl.lot_number,
        pl.lot_qty,
        pl.status AS lot_status,
        pm.model_code,
        pm.product_name
      FROM product_unit pu
      JOIN production_lot pl ON pl.id = pu.lot_id
      JOIN product_model pm ON pm.id = pu.model_id
      WHERE pl.lot_number = $1
        AND pu.serial_number = $2
    `,
    [lotNumber, serialNumber]
  );

  return result.rows[0] || null;
}

async function findQaSamplingByLotTemplateNo(lotId, templateId, samplingNo, excludeId) {
  const values = [lotId, templateId, samplingNo];
  let excludeSql = '';

  if (excludeId) {
    values.push(excludeId);
    excludeSql = `AND id <> $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT id, status, sampling_round
      FROM qa_sampling_header
      WHERE lot_id = $1
        AND template_id = $2
        AND sampling_round = $3
      ${excludeSql}
    `,
    values
  );

  return result.rows[0] || null;
}

async function findLatestDraftSampling(lotId, templateId) {
  const result = await pool.query(
    `
      SELECT id, status, sampling_round
      FROM qa_sampling_header
      WHERE lot_id = $1
        AND template_id = $2
        AND status = 'DRAFT'
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `,
    [lotId, templateId]
  );

  return result.rows[0] || null;
}

async function findNextSamplingNo(lotId, templateId) {
  const result = await pool.query(
    `
      SELECT COALESCE(MAX(sampling_round), 0)::int + 1 AS sampling_no
      FROM qa_sampling_header
      WHERE lot_id = $1
        AND template_id = $2
    `,
    [lotId, templateId]
  );

  return result.rows[0].sampling_no;
}

async function createQaSamplingHeader(payload, client) {
  const result = await executor(client).query(
    `
      INSERT INTO qa_sampling_header (
        lot_id,
        template_id,
        sampling_round,
        sampling_method,
        station_name,
        lot_qty,
        sample_qty,
        accept_qty,
        reject_qty,
        qa_operator_user_id,
        overall_result,
        status,
        remark,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'DRAFT', $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *
    `,
    [
      payload.lot_id,
      payload.template_id,
      payload.sampling_no,
      payload.sampling_method || 'MANUAL',
      payload.station_name,
      payload.lot_qty,
      payload.sample_qty,
      payload.accept_qty,
      payload.reject_qty,
      payload.qa_operator_user_id,
      payload.overall_result,
      payload.remark || null,
    ]
  );

  return result.rows[0];
}

async function updateQaSamplingHeader(id, payload, client) {
  const fields = [];
  const values = [];
  const fieldMap = {
    sampling_method: 'sampling_method',
    station_name: 'station_name',
    sample_qty: 'sample_qty',
    accept_qty: 'accept_qty',
    reject_qty: 'reject_qty',
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
      UPDATE qa_sampling_header
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

async function insertQaSampleUnits(qaSamplingId, sampleUnits, client) {
  if (!sampleUnits.length) {
    return [];
  }

  const result = await executor(client).query(
    `
      INSERT INTO qa_sample_unit (
        qa_sampling_id,
        product_unit_id,
        sample_no,
        serial_number,
        unit_result,
        remark,
        updated_at
      )
      SELECT
        $1,
        unit_row.product_unit_id,
        unit_row.sample_no,
        unit_row.serial_number,
        unit_row.unit_result,
        unit_row.remark,
        CURRENT_TIMESTAMP
      FROM jsonb_to_recordset($2::jsonb) AS unit_row(
        product_unit_id int,
        sample_no int,
        serial_number text,
        unit_result text,
        remark text
      )
      RETURNING id, qa_sampling_id, product_unit_id, sample_no, serial_number, unit_result, remark, updated_at
    `,
    [qaSamplingId, JSON.stringify(sampleUnits)]
  );

  return result.rows;
}

async function insertQaSampleDetails(details, client) {
  if (!details.length) {
    return [];
  }

  const result = await executor(client).query(
    `
      INSERT INTO qa_sample_detail (
        qa_sample_unit_id,
        template_item_id,
        measured_value,
        measured_text,
        result,
        remark,
        created_at,
        updated_at
      )
      SELECT
        detail.qa_sample_unit_id,
        detail.template_item_id,
        detail.measured_value,
        detail.measured_text,
        detail.result,
        detail.remark,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM jsonb_to_recordset($1::jsonb) AS detail(
        qa_sample_unit_id int,
        template_item_id int,
        measured_value numeric,
        measured_text text,
        result text,
        remark text
      )
      RETURNING id, qa_sample_unit_id, template_item_id, measured_value, measured_text, result, remark, created_at, updated_at
    `,
    [JSON.stringify(details)]
  );

  return result.rows;
}

async function insertQaSamplingEquipment(qaSamplingId, equipmentIds, client) {
  if (!equipmentIds.length) {
    return [];
  }

  const result = await executor(client).query(
    `
      INSERT INTO qa_sampling_equipment (qa_sampling_id, equipment_id, created_at)
      SELECT $1, equipment_id, CURRENT_TIMESTAMP
      FROM unnest($2::int[]) AS equipment_id
      RETURNING id, qa_sampling_id, equipment_id, usage_note, created_at
    `,
    [qaSamplingId, equipmentIds]
  );

  return result.rows;
}

async function deleteQaSampleDetails(qaSamplingId, client) {
  await executor(client).query(
    `
      DELETE FROM qa_sample_detail
      WHERE qa_sample_unit_id IN (
        SELECT id FROM qa_sample_unit WHERE qa_sampling_id = $1
      )
    `,
    [qaSamplingId]
  );
}

async function deleteQaSampleUnits(qaSamplingId, client) {
  await executor(client).query(
    `
      DELETE FROM qa_sample_unit
      WHERE qa_sampling_id = $1
    `,
    [qaSamplingId]
  );
}

async function deleteQaSamplingEquipment(qaSamplingId, client) {
  await executor(client).query(
    `
      DELETE FROM qa_sampling_equipment
      WHERE qa_sampling_id = $1
    `,
    [qaSamplingId]
  );
}

async function findQaSamplingById(id) {
  const result = await pool.query(
    `
      SELECT
        qh.*,
        qh.sampling_round AS sampling_no,
        pl.lot_number,
        pl.model_id,
        pm.model_code,
        pm.product_name,
        tt.template_name,
        tt.revision,
        tt.template_type
      FROM qa_sampling_header qh
      JOIN production_lot pl ON pl.id = qh.lot_id
      JOIN product_model pm ON pm.id = pl.model_id
      JOIN test_template tt ON tt.id = qh.template_id
      WHERE qh.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findQaSampleUnits(id) {
  const result = await pool.query(
    `
      SELECT
        id,
        qa_sampling_id,
        product_unit_id,
        sample_no,
        serial_number,
        unit_result,
        remark,
        updated_at
      FROM qa_sample_unit
      WHERE qa_sampling_id = $1
      ORDER BY sample_no ASC, id ASC
    `,
    [id]
  );

  return result.rows;
}

async function findQaSampleDetails(id) {
  const result = await pool.query(
    `
      SELECT
        d.id,
        d.qa_sample_unit_id,
        su.qa_sampling_id,
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
      FROM qa_sample_detail d
      JOIN qa_sample_unit su ON su.id = d.qa_sample_unit_id
      JOIN test_template_item i ON i.id = d.template_item_id
      WHERE su.qa_sampling_id = $1
      ORDER BY su.sample_no ASC, i.seq_no ASC, d.id ASC
    `,
    [id]
  );

  return result.rows;
}

async function findQaSamplingEquipment(id) {
  const result = await pool.query(
    `
      SELECT
        qe.id,
        qe.qa_sampling_id,
        qe.equipment_id,
        e.equipment_code,
        e.equipment_name,
        e.equipment_type_id,
        et.type_code AS equipment_type_code,
        e.status,
        e.calibration_due_date,
        qe.usage_note,
        qe.created_at
      FROM qa_sampling_equipment qe
      JOIN equipment_master e ON e.id = qe.equipment_id
      LEFT JOIN equipment_type_master et ON et.id = e.equipment_type_id
      WHERE qe.qa_sampling_id = $1
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
      WHERE al.source_type = 'QA'
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

async function updateQaSamplingStatus(id, payload, client) {
  const fields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
  const values = [payload.status];

  if (Object.prototype.hasOwnProperty.call(payload, 'qa_reviewer_user_id')) {
    values.push(payload.qa_reviewer_user_id);
    fields.push(`qa_reviewer_user_id = $${values.length}`);
    fields.push('reviewed_at = CURRENT_TIMESTAMP');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'qa_approver_user_id')) {
    values.push(payload.qa_approver_user_id);
    fields.push(`qa_approver_user_id = $${values.length}`);
    fields.push('approved_at = CURRENT_TIMESTAMP');
  }

  values.push(id);

  const result = await executor(client).query(
    `
      UPDATE qa_sampling_header
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
      VALUES ('QA', $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
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

async function findQaSampleDetailsForEdit(qaSamplingId, detailIds) {
  if (!detailIds.length) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT
        d.id,
        d.qa_sample_unit_id,
        su.qa_sampling_id,
        su.product_unit_id,
        su.serial_number,
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
      FROM qa_sample_detail d
      JOIN qa_sample_unit su ON su.id = d.qa_sample_unit_id
      JOIN test_template_item i ON i.id = d.template_item_id
      WHERE su.qa_sampling_id = $1
        AND d.id = ANY($2::int[])
      ORDER BY su.sample_no ASC, d.id ASC
    `,
    [qaSamplingId, detailIds]
  );

  return result.rows;
}

async function findAllQaSampleDetailsForOverall(qaSamplingId, client) {
  const result = await executor(client).query(
    `
      SELECT
        d.id,
        d.qa_sample_unit_id,
        d.template_item_id,
        d.measured_value,
        d.measured_text,
        d.result,
        i.mandatory
      FROM qa_sample_detail d
      JOIN qa_sample_unit su ON su.id = d.qa_sample_unit_id
      JOIN test_template_item i ON i.id = d.template_item_id
      WHERE su.qa_sampling_id = $1
      ORDER BY su.sample_no ASC, d.id ASC
    `,
    [qaSamplingId]
  );

  return result.rows;
}

async function updateQaSampleDetailResult(detailId, payload, client) {
  const result = await executor(client).query(
    `
      UPDATE qa_sample_detail
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

async function updateQaSampleUnitResult(unitId, unitResult, client) {
  const result = await executor(client).query(
    `
      UPDATE qa_sample_unit
      SET
        unit_result = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [unitId, unitResult]
  );

  return result.rows[0] || null;
}

async function updateQaSamplingAfterApprovedEdit(id, payload, client) {
  const result = await executor(client).query(
    `
      UPDATE qa_sampling_header
      SET
        status = $2,
        overall_result = $3,
        accept_qty = $4,
        reject_qty = $5,
        qa_reviewer_user_id = NULL,
        qa_approver_user_id = NULL,
        reviewed_at = NULL,
        approved_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [id, payload.status, payload.overall_result, payload.accept_qty, payload.reject_qty]
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
        'QA', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, $14
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

async function findResultEditAuditLogs(qaSamplingId) {
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
      WHERE l.source_type = 'QA'
        AND l.source_id = $1
      ORDER BY l.edit_at ASC, l.id ASC
    `,
    [qaSamplingId]
  );

  return result.rows;
}

module.exports = {
  findQaLots,
  findLotById,
  findLotUnits,
  findLotSamplingStatus,
  findQaTemplatesByModelId,
  findTemplateById,
  isTemplateAssignedToModel,
  findQaTemplateItems,
  findLotUnitsByIds,
  findProductUnitContextByLotAndSerial,
  findQaSamplingByLotTemplateNo,
  findLatestDraftSampling,
  findNextSamplingNo,
  createQaSamplingHeader,
  updateQaSamplingHeader,
  insertQaSampleUnits,
  insertQaSampleDetails,
  insertQaSamplingEquipment,
  deleteQaSampleDetails,
  deleteQaSampleUnits,
  deleteQaSamplingEquipment,
  findQaSamplingById,
  findQaSampleUnits,
  findQaSampleDetails,
  findQaSamplingEquipment,
  findApprovalLogs,
  findEquipmentByIds,
  findModelRequiredEquipment,
  updateQaSamplingStatus,
  insertApprovalLog,
  findQaSampleDetailsForEdit,
  findAllQaSampleDetailsForOverall,
  updateQaSampleDetailResult,
  updateQaSampleUnitResult,
  updateQaSamplingAfterApprovedEdit,
  insertResultEditAuditLog,
  findResultEditAuditLogs,
};
