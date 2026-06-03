const { pool } = require('../../db/pool');
const reportsRepository = require('../reports/reports.repository');

function addSearchFilter({ values, where, columns, search }) {
  if (!search) {
    return;
  }

  values.push(`%${search}%`);
  const placeholder = `$${values.length}`;
  where.push(`(${columns.map((column) => `${column} ILIKE ${placeholder}`).join(' OR ')})`);
}

function addLikeFilter({ values, where, column, value }) {
  if (!value) {
    return;
  }

  values.push(`%${value}%`);
  where.push(`${column} ILIKE $${values.length}`);
}

function addEqualFilter({ values, where, column, value }) {
  if (!value) {
    return;
  }

  values.push(value);
  where.push(`${column} = $${values.length}`);
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

async function findLotExportRows(filters) {
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

  const result = await pool.query(
    `
      SELECT
        pl.id AS lot_id,
        pl.lot_number,
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
      WHERE ${where.join(' AND ')}
      GROUP BY pl.id, pm.id
      ORDER BY pl.production_date DESC NULLS LAST, pl.id DESC
    `,
    values
  );

  return result.rows;
}

async function findAuditTrailExportRows(filters) {
  const values = [];
  const where = ['1 = 1'];

  addEqualFilter({ values, where, column: 'l.source_type', value: filters.source_type });
  addEqualFilter({ values, where, column: 'l.source_id', value: filters.source_id });
  addEqualFilter({ values, where, column: 'l.edit_by', value: filters.edit_by });
  addEqualFilter({ values, where, column: 'l.approval_status', value: filters.approval_status });
  addDateRangeFilter({ values, where, column: 'l.edit_at', filters });

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
      WHERE ${where.join(' AND ')}
      ORDER BY l.edit_at DESC, l.id DESC
    `,
    values
  );

  return result.rows;
}

module.exports = {
  findAuditTrailExportRows,
  findLotExportRows,
  findQaSamplingExportRows: reportsRepository.findQaSamplingExportRows,
  findQcInspectionExportRows: reportsRepository.findQcInspectionExportRows,
  getLotReportDetail: reportsRepository.getLotReportDetail,
  getQaSamplingReportDetail: reportsRepository.getQaSamplingReportDetail,
  getQcInspectionReportDetail: reportsRepository.getQcInspectionReportDetail,
};
