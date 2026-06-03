const { pool } = require('../../db/pool');

function addSearchFilter({ values, where, columns, search }) {
  if (!search) {
    return;
  }

  values.push(`%${search}%`);
  const placeholder = `$${values.length}`;
  where.push(`(${columns.map((column) => `${column} ILIKE ${placeholder}`).join(' OR ')})`);
}

function addEqualFilter({ values, where, column, value }) {
  if (!value) {
    return;
  }

  values.push(value);
  where.push(`${column} = $${values.length}`);
}

function addLikeFilter({ values, where, column, value }) {
  if (!value) {
    return;
  }

  values.push(`%${value}%`);
  where.push(`${column} ILIKE $${values.length}`);
}

function addDateRangeFilter({ values, where, column, filters }) {
  if (filters.date_from) {
    values.push(filters.date_from);
    where.push(`${column}::date >= $${values.length}::date`);
  }

  if (filters.date_to) {
    values.push(filters.date_to);
    where.push(`${column}::date <= $${values.length}::date`);
  }
}

async function countRows(sql, values) {
  const result = await pool.query(sql, values);
  return Number(result.rows[0]?.total || 0);
}

async function getDashboardSummary() {
  const [production, qc, qa] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(pl.id)::int AS total_lots,
        COUNT(pl.id) FILTER (WHERE pl.status = 'OPEN')::int AS open_lots,
        COUNT(pl.id) FILTER (WHERE pl.status = 'HOLD')::int AS hold_lots,
        COUNT(pl.id) FILTER (WHERE pl.status = 'CLOSED')::int AS closed_lots,
        COUNT(pu.id)::int AS total_units
      FROM production_lot pl
      LEFT JOIN product_unit pu ON pu.lot_id = pl.id
    `),
    pool.query(`
      SELECT
        COUNT(*)::int AS total_inspections,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
        COUNT(*) FILTER (WHERE status <> 'APPROVED')::int AS pending,
        COUNT(*) FILTER (WHERE overall_result = 'PASS')::int AS pass,
        COUNT(*) FILTER (WHERE overall_result = 'FAIL')::int AS fail,
        COUNT(*) FILTER (WHERE overall_result = 'N/A')::int AS na
      FROM inspection_header
    `),
    pool.query(`
      SELECT
        COUNT(*)::int AS total_samplings,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
        COUNT(*) FILTER (WHERE status <> 'APPROVED')::int AS pending,
        COUNT(*) FILTER (WHERE overall_result = 'PASS')::int AS pass,
        COUNT(*) FILTER (WHERE overall_result = 'FAIL')::int AS fail,
        COUNT(*) FILTER (WHERE overall_result = 'N/A')::int AS na
      FROM qa_sampling_header
    `),
  ]);

  return {
    production: production.rows[0],
    qc: qc.rows[0],
    qa: qa.rows[0],
  };
}

async function getQcSummary(filters = {}) {
  const values = [];
  const where = ['1 = 1'];
  addDateRangeFilter({ values, where, column: 'ih.inspection_datetime', filters });
  const whereSql = where.join(' AND ');

  const [byStatus, byResult, byModel] = await Promise.all([
    pool.query(
      `
        SELECT ih.status, COUNT(*)::int AS count
        FROM inspection_header ih
        WHERE ${whereSql}
        GROUP BY ih.status
        ORDER BY ih.status ASC
      `,
      values
    ),
    pool.query(
      `
        SELECT ih.overall_result, COUNT(*)::int AS count
        FROM inspection_header ih
        WHERE ${whereSql}
        GROUP BY ih.overall_result
        ORDER BY ih.overall_result ASC
      `,
      values
    ),
    pool.query(
      `
        SELECT
          pm.model_code,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE ih.overall_result = 'PASS')::int AS pass,
          COUNT(*) FILTER (WHERE ih.overall_result = 'FAIL')::int AS fail,
          COUNT(*) FILTER (WHERE ih.overall_result = 'N/A')::int AS na
        FROM inspection_header ih
        JOIN product_unit pu ON pu.id = ih.product_unit_id
        JOIN product_model pm ON pm.id = pu.model_id
        WHERE ${whereSql}
        GROUP BY pm.model_code
        ORDER BY pm.model_code ASC
      `,
      values
    ),
  ]);

  return {
    by_status: byStatus.rows,
    by_result: byResult.rows,
    by_model: byModel.rows,
  };
}

async function getQaSummary(filters = {}) {
  const values = [];
  const where = ['1 = 1'];
  addDateRangeFilter({ values, where, column: 'qsh.sampling_datetime', filters });
  const whereSql = where.join(' AND ');

  const [byStatus, byResult, byModel] = await Promise.all([
    pool.query(
      `
        SELECT qsh.status, COUNT(*)::int AS count
        FROM qa_sampling_header qsh
        WHERE ${whereSql}
        GROUP BY qsh.status
        ORDER BY qsh.status ASC
      `,
      values
    ),
    pool.query(
      `
        SELECT qsh.overall_result, COUNT(*)::int AS count
        FROM qa_sampling_header qsh
        WHERE ${whereSql}
        GROUP BY qsh.overall_result
        ORDER BY qsh.overall_result ASC
      `,
      values
    ),
    pool.query(
      `
        SELECT
          pm.model_code,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE qsh.overall_result = 'PASS')::int AS pass,
          COUNT(*) FILTER (WHERE qsh.overall_result = 'FAIL')::int AS fail,
          COUNT(*) FILTER (WHERE qsh.overall_result = 'N/A')::int AS na
        FROM qa_sampling_header qsh
        JOIN production_lot pl ON pl.id = qsh.lot_id
        JOIN product_model pm ON pm.id = pl.model_id
        WHERE ${whereSql}
        GROUP BY pm.model_code
        ORDER BY pm.model_code ASC
      `,
      values
    ),
  ]);

  return {
    by_status: byStatus.rows,
    by_result: byResult.rows,
    by_model: byModel.rows,
  };
}

async function getLotStatusSummary() {
  const result = await pool.query(`
    SELECT status, COUNT(*)::int AS count
    FROM production_lot
    GROUP BY status
    ORDER BY status ASC
  `);

  return result.rows;
}

function lotReportWhere(filters = {}) {
  const values = [];
  const where = ['1 = 1'];

  addSearchFilter({
    values,
    where,
    search: filters.search,
    columns: ['pl.lot_number', 'pm.model_code', 'pm.product_name'],
  });
  addLikeFilter({ values, where, column: 'pm.model_code', value: filters.model_code });
  addLikeFilter({ values, where, column: 'pl.lot_number', value: filters.lot_number });
  addEqualFilter({ values, where, column: 'pl.status', value: filters.status });
  addDateRangeFilter({ values, where, column: 'pl.production_date', filters });

  return { values, whereSql: where.join(' AND ') };
}

async function findLotReports(filters, pagination) {
  const { values, whereSql } = lotReportWhere(filters);
  values.push(pagination.limit, pagination.offset);

  const result = await pool.query(
    `
      SELECT
        pl.id AS lot_id,
        pl.lot_number,
        pl.model_id,
        pm.model_code,
        pm.product_name,
        pl.lot_qty,
        COUNT(DISTINCT pu.id)::int AS serial_count,
        COUNT(DISTINCT ih.id)::int AS qc_count,
        COUNT(DISTINCT qsh.id)::int AS qa_sampling_count,
        pl.status AS lot_status,
        pl.production_date
      FROM production_lot pl
      JOIN product_model pm ON pm.id = pl.model_id
      LEFT JOIN product_unit pu ON pu.lot_id = pl.id
      LEFT JOIN inspection_header ih ON ih.product_unit_id = pu.id
      LEFT JOIN qa_sampling_header qsh ON qsh.lot_id = pl.id
      WHERE ${whereSql}
      GROUP BY pl.id, pm.id
      ORDER BY pl.production_date DESC NULLS LAST, pl.id DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `,
    values
  );

  return result.rows;
}

async function countLotReports(filters) {
  const { values, whereSql } = lotReportWhere(filters);
  return countRows(
    `
      SELECT COUNT(*)::int AS total
      FROM production_lot pl
      JOIN product_model pm ON pm.id = pl.model_id
      WHERE ${whereSql}
    `,
    values
  );
}

function serialReportWhere(filters = {}) {
  const values = [];
  const where = ['1 = 1'];

  addSearchFilter({
    values,
    where,
    search: filters.search,
    columns: ['pu.serial_number', 'pl.lot_number', 'pm.model_code', 'pm.product_name'],
  });
  addLikeFilter({ values, where, column: 'pm.model_code', value: filters.model_code });
  addLikeFilter({ values, where, column: 'pl.lot_number', value: filters.lot_number });
  addLikeFilter({ values, where, column: 'pu.serial_number', value: filters.serial_number });
  addEqualFilter({ values, where, column: 'pu.product_status', value: filters.status });
  addDateRangeFilter({ values, where, column: 'pu.created_at', filters });

  return { values, whereSql: where.join(' AND ') };
}

async function findSerialReports(filters, pagination) {
  const { values, whereSql } = serialReportWhere(filters);
  values.push(pagination.limit, pagination.offset);

  const result = await pool.query(
    `
      SELECT
        pu.id AS product_unit_id,
        pu.serial_number,
        pu.lot_id,
        pl.lot_number,
        pm.model_code,
        pm.product_name,
        pu.product_status AS unit_status,
        latest_qc.status AS latest_qc_status,
        latest_qc.overall_result AS latest_qc_result,
        latest_qa.status AS latest_qa_status,
        latest_qa.unit_result AS latest_qa_result
      FROM product_unit pu
      JOIN production_lot pl ON pl.id = pu.lot_id
      JOIN product_model pm ON pm.id = pu.model_id
      LEFT JOIN LATERAL (
        SELECT ih.status, ih.overall_result
        FROM inspection_header ih
        WHERE ih.product_unit_id = pu.id
        ORDER BY ih.inspection_datetime DESC, ih.id DESC
        LIMIT 1
      ) latest_qc ON true
      LEFT JOIN LATERAL (
        SELECT qsh.status, qsu.unit_result
        FROM qa_sample_unit qsu
        JOIN qa_sampling_header qsh ON qsh.id = qsu.qa_sampling_id
        WHERE qsu.product_unit_id = pu.id
        ORDER BY qsh.sampling_datetime DESC, qsh.id DESC
        LIMIT 1
      ) latest_qa ON true
      WHERE ${whereSql}
      ORDER BY pu.created_at DESC, pu.id DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `,
    values
  );

  return result.rows;
}

async function countSerialReports(filters) {
  const { values, whereSql } = serialReportWhere(filters);
  return countRows(
    `
      SELECT COUNT(*)::int AS total
      FROM product_unit pu
      JOIN production_lot pl ON pl.id = pu.lot_id
      JOIN product_model pm ON pm.id = pu.model_id
      WHERE ${whereSql}
    `,
    values
  );
}

function qcReportWhere(filters = {}) {
  const values = [];
  const where = ['1 = 1'];

  addSearchFilter({
    values,
    where,
    search: filters.search,
    columns: ['pu.serial_number', 'pl.lot_number', 'pm.model_code', 'tt.template_name'],
  });
  addLikeFilter({ values, where, column: 'pm.model_code', value: filters.model_code });
  addLikeFilter({ values, where, column: 'pl.lot_number', value: filters.lot_number });
  addLikeFilter({ values, where, column: 'pu.serial_number', value: filters.serial_number });
  addEqualFilter({ values, where, column: 'ih.status', value: filters.status });
  addEqualFilter({ values, where, column: 'ih.overall_result', value: filters.result });
  addDateRangeFilter({ values, where, column: 'ih.inspection_datetime', filters });

  return { values, whereSql: where.join(' AND ') };
}

async function findQcInspectionReports(filters, pagination) {
  const { values, whereSql } = qcReportWhere(filters);
  values.push(pagination.limit, pagination.offset);

  const result = await pool.query(
    `
      SELECT
        ih.id AS inspection_id,
        ih.inspection_no,
        ih.status,
        ih.overall_result,
        ih.station_name,
        pu.id AS product_unit_id,
        pu.serial_number,
        pl.id AS lot_id,
        pl.lot_number,
        pm.model_code,
        pm.product_name,
        tt.template_name,
        operator.username AS operator_username,
        reviewer.username AS reviewer_username,
        approver.username AS approver_username,
        ih.inspection_datetime
      FROM inspection_header ih
      JOIN product_unit pu ON pu.id = ih.product_unit_id
      JOIN production_lot pl ON pl.id = pu.lot_id
      JOIN product_model pm ON pm.id = pu.model_id
      JOIN test_template tt ON tt.id = ih.template_id
      LEFT JOIN app_user operator ON operator.id = ih.operator_user_id
      LEFT JOIN app_user reviewer ON reviewer.id = ih.reviewer_user_id
      LEFT JOIN app_user approver ON approver.id = ih.approver_user_id
      WHERE ${whereSql}
      ORDER BY ih.inspection_datetime DESC, ih.id DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `,
    values
  );

  return result.rows;
}

async function countQcInspectionReports(filters) {
  const { values, whereSql } = qcReportWhere(filters);
  return countRows(
    `
      SELECT COUNT(*)::int AS total
      FROM inspection_header ih
      JOIN product_unit pu ON pu.id = ih.product_unit_id
      JOIN production_lot pl ON pl.id = pu.lot_id
      JOIN product_model pm ON pm.id = pu.model_id
      JOIN test_template tt ON tt.id = ih.template_id
      WHERE ${whereSql}
    `,
    values
  );
}

function qaReportWhere(filters = {}) {
  const values = [];
  const where = ['1 = 1'];

  addSearchFilter({
    values,
    where,
    search: filters.search,
    columns: ['pl.lot_number', 'pm.model_code', 'pm.product_name', 'tt.template_name'],
  });
  addLikeFilter({ values, where, column: 'pm.model_code', value: filters.model_code });
  addLikeFilter({ values, where, column: 'pl.lot_number', value: filters.lot_number });
  addEqualFilter({ values, where, column: 'qsh.status', value: filters.status });
  addEqualFilter({ values, where, column: 'qsh.overall_result', value: filters.result });
  addDateRangeFilter({ values, where, column: 'qsh.sampling_datetime', filters });

  return { values, whereSql: where.join(' AND ') };
}

async function findQaSamplingReports(filters, pagination) {
  const { values, whereSql } = qaReportWhere(filters);
  values.push(pagination.limit, pagination.offset);

  const result = await pool.query(
    `
      SELECT
        qsh.id AS qa_sampling_id,
        qsh.sampling_round AS sampling_no,
        qsh.sampling_method,
        qsh.status,
        qsh.overall_result,
        pl.id AS lot_id,
        pl.lot_number,
        pm.model_code,
        pm.product_name,
        tt.template_name,
        qsh.sample_qty,
        qsh.accept_qty,
        qsh.reject_qty,
        operator.username AS operator_username,
        reviewer.username AS reviewer_username,
        approver.username AS approver_username,
        qsh.sampling_datetime
      FROM qa_sampling_header qsh
      JOIN production_lot pl ON pl.id = qsh.lot_id
      JOIN product_model pm ON pm.id = pl.model_id
      JOIN test_template tt ON tt.id = qsh.template_id
      LEFT JOIN app_user operator ON operator.id = qsh.qa_operator_user_id
      LEFT JOIN app_user reviewer ON reviewer.id = qsh.qa_reviewer_user_id
      LEFT JOIN app_user approver ON approver.id = qsh.qa_approver_user_id
      WHERE ${whereSql}
      ORDER BY qsh.sampling_datetime DESC, qsh.id DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `,
    values
  );

  return result.rows;
}

async function countQaSamplingReports(filters) {
  const { values, whereSql } = qaReportWhere(filters);
  return countRows(
    `
      SELECT COUNT(*)::int AS total
      FROM qa_sampling_header qsh
      JOIN production_lot pl ON pl.id = qsh.lot_id
      JOIN product_model pm ON pm.id = pl.model_id
      JOIN test_template tt ON tt.id = qsh.template_id
      WHERE ${whereSql}
    `,
    values
  );
}

async function getLotReportDetail(lotId) {
  const [lot, serials, qcSummary, qaSummary, approvalStatus] = await Promise.all([
    pool.query(
      `
        SELECT
          pl.id AS lot_id,
          pl.lot_number,
          pl.model_id,
          pm.model_code,
          pm.product_name,
          pl.lot_qty,
          pl.status AS lot_status,
          pl.production_date,
          pl.remark,
          pl.created_at,
          pl.updated_at
        FROM production_lot pl
        JOIN product_model pm ON pm.id = pl.model_id
        WHERE pl.id = $1
      `,
      [lotId]
    ),
    pool.query(
      `
        SELECT
          pu.id AS product_unit_id,
          pu.serial_number,
          pu.product_status AS unit_status,
          latest_qc.status AS latest_qc_status,
          latest_qc.overall_result AS latest_qc_result,
          latest_qa.status AS latest_qa_status,
          latest_qa.unit_result AS latest_qa_result
        FROM product_unit pu
        LEFT JOIN LATERAL (
          SELECT ih.status, ih.overall_result
          FROM inspection_header ih
          WHERE ih.product_unit_id = pu.id
          ORDER BY ih.inspection_datetime DESC, ih.id DESC
          LIMIT 1
        ) latest_qc ON true
        LEFT JOIN LATERAL (
          SELECT qsh.status, qsu.unit_result
          FROM qa_sample_unit qsu
          JOIN qa_sampling_header qsh ON qsh.id = qsu.qa_sampling_id
          WHERE qsu.product_unit_id = pu.id
          ORDER BY qsh.sampling_datetime DESC, qsh.id DESC
          LIMIT 1
        ) latest_qa ON true
        WHERE pu.lot_id = $1
        ORDER BY pu.serial_number ASC
      `,
      [lotId]
    ),
    pool.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE ih.overall_result = 'PASS')::int AS pass,
          COUNT(*) FILTER (WHERE ih.overall_result = 'FAIL')::int AS fail,
          COUNT(*) FILTER (WHERE ih.overall_result = 'N/A')::int AS na,
          COUNT(*) FILTER (WHERE ih.status = 'APPROVED')::int AS approved
        FROM inspection_header ih
        JOIN product_unit pu ON pu.id = ih.product_unit_id
        WHERE pu.lot_id = $1
      `,
      [lotId]
    ),
    pool.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE overall_result = 'PASS')::int AS pass,
          COUNT(*) FILTER (WHERE overall_result = 'FAIL')::int AS fail,
          COUNT(*) FILTER (WHERE overall_result = 'N/A')::int AS na,
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved
        FROM qa_sampling_header
        WHERE lot_id = $1
      `,
      [lotId]
    ),
    pool.query(
      `
        SELECT
          al.source_type,
          al.source_id,
          al.action,
          al.old_status,
          al.new_status,
          u.username AS action_by_username,
          al.action_datetime,
          al.remark
        FROM approval_log al
        LEFT JOIN app_user u ON u.id = al.action_by
        WHERE (
          al.source_type = 'QC'
          AND al.source_id IN (
            SELECT ih.id
            FROM inspection_header ih
            JOIN product_unit pu ON pu.id = ih.product_unit_id
            WHERE pu.lot_id = $1
          )
        )
        OR (
          al.source_type = 'QA'
          AND al.source_id IN (
            SELECT id FROM qa_sampling_header WHERE lot_id = $1
          )
        )
        ORDER BY al.action_datetime ASC, al.id ASC
      `,
      [lotId]
    ),
  ]);

  return {
    lot: lot.rows[0] || null,
    serials: serials.rows,
    qc_summary: qcSummary.rows[0],
    qa_summary: qaSummary.rows[0],
    approval_status: approvalStatus.rows,
  };
}

async function getSerialReportDetail(productUnitId) {
  const [serial, qcInspections, qaSamplings] = await Promise.all([
    pool.query(
      `
        SELECT
          pu.id AS product_unit_id,
          pu.serial_number,
          pu.product_status AS unit_status,
          pl.id AS lot_id,
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
    ),
    pool.query(
      `
        SELECT
          ih.id AS inspection_id,
          ih.inspection_no,
          ih.status,
          ih.overall_result,
          ih.inspection_datetime
        FROM inspection_header ih
        WHERE ih.product_unit_id = $1
        ORDER BY ih.inspection_datetime DESC, ih.id DESC
      `,
      [productUnitId]
    ),
    pool.query(
      `
        SELECT
          qsh.id AS qa_sampling_id,
          qsh.sampling_round AS sampling_no,
          qsh.status,
          qsh.overall_result,
          qsu.unit_result,
          qsh.sampling_datetime
        FROM qa_sample_unit qsu
        JOIN qa_sampling_header qsh ON qsh.id = qsu.qa_sampling_id
        WHERE qsu.product_unit_id = $1
        ORDER BY qsh.sampling_datetime DESC, qsh.id DESC
      `,
      [productUnitId]
    ),
  ]);

  return {
    serial: serial.rows[0] || null,
    qc_inspections: qcInspections.rows,
    qa_samplings: qaSamplings.rows,
  };
}

async function getQcInspectionReportDetail(id) {
  const [header, details, equipment, approvalLogs] = await Promise.all([
    pool.query(
      `
        SELECT
          ih.*,
          ih.id AS inspection_id,
          pu.serial_number,
          pl.id AS lot_id,
          pl.lot_number,
          pm.model_code,
          pm.product_name,
          tt.template_name,
          operator.username AS operator_username,
          reviewer.username AS reviewer_username,
          approver.username AS approver_username
        FROM inspection_header ih
        JOIN product_unit pu ON pu.id = ih.product_unit_id
        JOIN production_lot pl ON pl.id = pu.lot_id
        JOIN product_model pm ON pm.id = pu.model_id
        JOIN test_template tt ON tt.id = ih.template_id
        LEFT JOIN app_user operator ON operator.id = ih.operator_user_id
        LEFT JOIN app_user reviewer ON reviewer.id = ih.reviewer_user_id
        LEFT JOIN app_user approver ON approver.id = ih.approver_user_id
        WHERE ih.id = $1
      `,
      [id]
    ),
    pool.query(
      `
        SELECT
          d.id,
          d.template_item_id,
          i.item_code,
          i.test_point AS item_name,
          d.measured_value,
          d.measured_text,
          d.result,
          d.remark
        FROM inspection_detail d
        JOIN test_template_item i ON i.id = d.template_item_id
        WHERE d.inspection_id = $1
        ORDER BY i.seq_no ASC, d.id ASC
      `,
      [id]
    ),
    pool.query(
      `
        SELECT
          ie.id,
          ie.equipment_id,
          e.equipment_code,
          e.equipment_name,
          e.status,
          e.calibration_due_date
        FROM inspection_equipment ie
        JOIN equipment_master e ON e.id = ie.equipment_id
        WHERE ie.inspection_id = $1
        ORDER BY e.equipment_code ASC
      `,
      [id]
    ),
    pool.query(
      `
        SELECT
          al.id,
          al.action,
          al.old_status,
          al.new_status,
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
    ),
  ]);

  return {
    header: header.rows[0] || null,
    details: details.rows,
    equipment: equipment.rows,
    approval_logs: approvalLogs.rows,
  };
}

async function getQaSamplingReportDetail(id) {
  const [header, sampleUnits, details, equipment, approvalLogs] = await Promise.all([
    pool.query(
      `
        SELECT
          qsh.*,
          qsh.id AS qa_sampling_id,
          qsh.sampling_round AS sampling_no,
          pl.lot_number,
          pm.model_code,
          pm.product_name,
          tt.template_name,
          operator.username AS operator_username,
          reviewer.username AS reviewer_username,
          approver.username AS approver_username
        FROM qa_sampling_header qsh
        JOIN production_lot pl ON pl.id = qsh.lot_id
        JOIN product_model pm ON pm.id = pl.model_id
        JOIN test_template tt ON tt.id = qsh.template_id
        LEFT JOIN app_user operator ON operator.id = qsh.qa_operator_user_id
        LEFT JOIN app_user reviewer ON reviewer.id = qsh.qa_reviewer_user_id
        LEFT JOIN app_user approver ON approver.id = qsh.qa_approver_user_id
        WHERE qsh.id = $1
      `,
      [id]
    ),
    pool.query(
      `
        SELECT
          id,
          product_unit_id,
          sample_no,
          serial_number,
          unit_result,
          remark
        FROM qa_sample_unit
        WHERE qa_sampling_id = $1
        ORDER BY sample_no ASC, id ASC
      `,
      [id]
    ),
    pool.query(
      `
        SELECT
          d.id,
          d.qa_sample_unit_id,
          d.template_item_id,
          i.item_code,
          i.test_point AS item_name,
          d.measured_value,
          d.measured_text,
          d.result,
          d.remark
        FROM qa_sample_detail d
        JOIN qa_sample_unit qsu ON qsu.id = d.qa_sample_unit_id
        JOIN test_template_item i ON i.id = d.template_item_id
        WHERE qsu.qa_sampling_id = $1
        ORDER BY qsu.sample_no ASC, i.seq_no ASC, d.id ASC
      `,
      [id]
    ),
    pool.query(
      `
        SELECT
          qe.id,
          qe.equipment_id,
          e.equipment_code,
          e.equipment_name,
          e.status,
          e.calibration_due_date
        FROM qa_sampling_equipment qe
        JOIN equipment_master e ON e.id = qe.equipment_id
        WHERE qe.qa_sampling_id = $1
        ORDER BY e.equipment_code ASC
      `,
      [id]
    ),
    pool.query(
      `
        SELECT
          al.id,
          al.action,
          al.old_status,
          al.new_status,
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
    ),
  ]);

  return {
    header: header.rows[0] || null,
    sample_units: sampleUnits.rows,
    details: details.rows,
    equipment: equipment.rows,
    approval_logs: approvalLogs.rows,
  };
}

async function findQcInspectionExportRows(filters) {
  const { values, whereSql } = qcReportWhere(filters);
  const result = await pool.query(
    `
      SELECT
        ih.id AS inspection_id,
        ih.inspection_no,
        ih.status,
        ih.overall_result,
        pl.lot_number,
        pu.serial_number,
        pm.model_code,
        tt.template_name,
        i.item_code,
        i.test_point AS item_name,
        d.measured_value,
        d.measured_text,
        d.result,
        d.remark,
        ih.inspection_datetime
      FROM inspection_header ih
      JOIN inspection_detail d ON d.inspection_id = ih.id
      JOIN test_template_item i ON i.id = d.template_item_id
      JOIN product_unit pu ON pu.id = ih.product_unit_id
      JOIN production_lot pl ON pl.id = pu.lot_id
      JOIN product_model pm ON pm.id = pu.model_id
      JOIN test_template tt ON tt.id = ih.template_id
      WHERE ${whereSql}
      ORDER BY ih.inspection_datetime DESC, ih.id DESC, i.seq_no ASC
    `,
    values
  );

  return result.rows;
}

async function findQaSamplingExportRows(filters) {
  const { values, whereSql } = qaReportWhere(filters);
  const result = await pool.query(
    `
      SELECT
        qsh.id AS qa_sampling_id,
        qsh.sampling_round AS sampling_no,
        qsh.status,
        qsh.overall_result,
        pl.lot_number,
        qsu.serial_number,
        pm.model_code,
        tt.template_name,
        i.item_code,
        i.test_point AS item_name,
        d.measured_value,
        d.measured_text,
        d.result,
        d.remark,
        qsh.sampling_datetime
      FROM qa_sampling_header qsh
      JOIN qa_sample_unit qsu ON qsu.qa_sampling_id = qsh.id
      JOIN qa_sample_detail d ON d.qa_sample_unit_id = qsu.id
      JOIN test_template_item i ON i.id = d.template_item_id
      JOIN production_lot pl ON pl.id = qsh.lot_id
      JOIN product_model pm ON pm.id = pl.model_id
      JOIN test_template tt ON tt.id = qsh.template_id
      WHERE ${whereSql}
      ORDER BY qsh.sampling_datetime DESC, qsh.id DESC, qsu.sample_no ASC, i.seq_no ASC
    `,
    values
  );

  return result.rows;
}

module.exports = {
  getDashboardSummary,
  getQcSummary,
  getQaSummary,
  getLotStatusSummary,
  findLotReports,
  countLotReports,
  findSerialReports,
  countSerialReports,
  findQcInspectionReports,
  countQcInspectionReports,
  findQaSamplingReports,
  countQaSamplingReports,
  getLotReportDetail,
  getSerialReportDetail,
  getQcInspectionReportDetail,
  getQaSamplingReportDetail,
  findQcInspectionExportRows,
  findQaSamplingExportRows,
};
