const { notFound } = require('../../shared/http-error');
const repository = require('./exports.repository');
const { createCsvBuffer } = require('./csv-exporter');
const { createWorkbookBuffer } = require('./excel-exporter');
const {
  createListPdfBuffer,
  createLotDetailPdfBuffer,
  createQaDetailPdfBuffer,
  createQcDetailPdfBuffer,
} = require('./pdf-exporter');

const qcColumns = [
  { header: 'Inspection ID', key: 'inspection_id', width: 16 },
  { header: 'Inspection No', key: 'inspection_no', width: 16 },
  { header: 'Status', key: 'status', width: 16 },
  { header: 'Overall Result', key: 'overall_result', width: 16 },
  { header: 'Lot Number', key: 'lot_number', width: 18 },
  { header: 'Serial Number', key: 'serial_number', width: 22 },
  { header: 'Model Code', key: 'model_code', width: 18 },
  { header: 'Template', key: 'template_name', width: 24 },
  { header: 'Item Code', key: 'item_code', width: 16 },
  { header: 'Item Name', key: 'item_name', width: 28 },
  { header: 'Measured Value', key: 'measured_value', width: 18 },
  { header: 'Measured Text', key: 'measured_text', width: 18 },
  { header: 'Result', key: 'result', width: 14 },
  { header: 'Remark', key: 'remark', width: 28 },
  { header: 'Inspection Datetime', key: 'inspection_datetime', width: 24 },
];

const qaColumns = [
  { header: 'QA Sampling ID', key: 'qa_sampling_id', width: 18 },
  { header: 'Sampling No', key: 'sampling_no', width: 16 },
  { header: 'Status', key: 'status', width: 16 },
  { header: 'Overall Result', key: 'overall_result', width: 16 },
  { header: 'Lot Number', key: 'lot_number', width: 18 },
  { header: 'Serial Number', key: 'serial_number', width: 22 },
  { header: 'Model Code', key: 'model_code', width: 18 },
  { header: 'Template', key: 'template_name', width: 24 },
  { header: 'Item Code', key: 'item_code', width: 16 },
  { header: 'Item Name', key: 'item_name', width: 28 },
  { header: 'Measured Value', key: 'measured_value', width: 18 },
  { header: 'Measured Text', key: 'measured_text', width: 18 },
  { header: 'Result', key: 'result', width: 14 },
  { header: 'Remark', key: 'remark', width: 28 },
  { header: 'Sampling Datetime', key: 'sampling_datetime', width: 24 },
];

const lotColumns = [
  { header: 'Lot ID', key: 'lot_id', width: 14 },
  { header: 'Lot Number', key: 'lot_number', width: 20 },
  { header: 'Model Code', key: 'model_code', width: 18 },
  { header: 'Product Name', key: 'product_name', width: 28 },
  { header: 'Lot Qty', key: 'lot_qty', width: 12 },
  { header: 'Serial Count', key: 'serial_count', width: 14 },
  { header: 'QC Count', key: 'qc_count', width: 12 },
  { header: 'QA Sampling Count', key: 'qa_sampling_count', width: 20 },
  { header: 'Lot Status', key: 'lot_status', width: 14 },
  { header: 'Production Date', key: 'production_date', width: 18 },
];

const auditColumns = [
  { header: 'Audit ID', key: 'id', width: 14 },
  { header: 'Source Type', key: 'source_type', width: 14 },
  { header: 'Source ID', key: 'source_id', width: 14 },
  { header: 'Detail ID', key: 'detail_id', width: 14 },
  { header: 'Item Code', key: 'item_code', width: 16 },
  { header: 'Item Name', key: 'item_name', width: 28 },
  { header: 'Old Measured Value', key: 'old_measured_value', width: 20 },
  { header: 'New Measured Value', key: 'new_measured_value', width: 20 },
  { header: 'Old Measured Text', key: 'old_measured_text', width: 20 },
  { header: 'New Measured Text', key: 'new_measured_text', width: 20 },
  { header: 'Old Result', key: 'old_result', width: 14 },
  { header: 'New Result', key: 'new_result', width: 14 },
  { header: 'Old Overall Result', key: 'old_overall_result', width: 20 },
  { header: 'New Overall Result', key: 'new_overall_result', width: 20 },
  { header: 'Edit Reason', key: 'edit_reason', width: 32 },
  { header: 'Edit By', key: 'edit_by_username', width: 18 },
  { header: 'Edit At', key: 'edit_at', width: 24 },
  { header: 'Approval Status', key: 'approval_status', width: 18 },
];

function summaryRows(rows) {
  return [
    { label: 'Generated At', value: new Date().toISOString() },
    { label: 'Total Rows', value: rows.length },
  ];
}

async function makeCsv({ rows, columns }) {
  return createCsvBuffer({ rows, columns });
}

async function makeWorkbook({ name, rows, columns }) {
  return createWorkbookBuffer({
    sheets: [
      {
        name: 'Summary',
        columns: [
          { header: 'Label', key: 'label', width: 24 },
          { header: 'Value', key: 'value', width: 36 },
        ],
        rows: summaryRows(rows),
      },
      { name, columns, rows },
    ],
  });
}

async function getQcInspectionRows({ filters, requestId }) {
  console.info('[EXPORTS][QC][ROWS]', { requestId, filters });
  return repository.findQcInspectionExportRows(filters);
}

async function getQaSamplingRows({ filters, requestId }) {
  console.info('[EXPORTS][QA][ROWS]', { requestId, filters });
  return repository.findQaSamplingExportRows(filters);
}

async function getLotRows({ filters, requestId }) {
  console.info('[EXPORTS][LOTS][ROWS]', { requestId, filters });
  return repository.findLotExportRows(filters);
}

async function getAuditTrailRows({ filters, requestId }) {
  console.info('[EXPORTS][AUDIT][ROWS]', { requestId, filters });
  return repository.findAuditTrailExportRows(filters);
}

async function exportQcCsv(options) {
  return makeCsv({ rows: await getQcInspectionRows(options), columns: qcColumns });
}

async function exportQcExcel(options) {
  return makeWorkbook({ name: 'QC Inspections', rows: await getQcInspectionRows(options), columns: qcColumns });
}

async function exportQcPdf(options) {
  const rows = await getQcInspectionRows(options);
  return createListPdfBuffer({ title: 'QC Inspection Export', rows, columns: qcColumns.slice(0, 8) });
}

async function exportQaCsv(options) {
  return makeCsv({ rows: await getQaSamplingRows(options), columns: qaColumns });
}

async function exportQaExcel(options) {
  return makeWorkbook({ name: 'QA Samplings', rows: await getQaSamplingRows(options), columns: qaColumns });
}

async function exportQaPdf(options) {
  const rows = await getQaSamplingRows(options);
  return createListPdfBuffer({ title: 'QA Sampling Export', rows, columns: qaColumns.slice(0, 8) });
}

async function exportLotsCsv(options) {
  return makeCsv({ rows: await getLotRows(options), columns: lotColumns });
}

async function exportLotsExcel(options) {
  return makeWorkbook({ name: 'Production Lots', rows: await getLotRows(options), columns: lotColumns });
}

async function exportAuditCsv(options) {
  return makeCsv({ rows: await getAuditTrailRows(options), columns: auditColumns });
}

async function exportAuditExcel(options) {
  return makeWorkbook({ name: 'Audit Trails', rows: await getAuditTrailRows(options), columns: auditColumns });
}

async function exportLotDetailPdf({ lotId, requestId }) {
  console.info('[EXPORTS][LOTS][PDF]', { requestId, lotId });
  const report = await repository.getLotReportDetail(lotId);

  if (!report.lot) {
    throw notFound('Production lot report not found');
  }

  return createLotDetailPdfBuffer(report);
}

async function exportQcDetailPdf({ id, requestId }) {
  console.info('[EXPORTS][QC][PDF]', { requestId, id });
  const report = await repository.getQcInspectionReportDetail(id);

  if (!report.header) {
    throw notFound('QC inspection report not found');
  }

  return createQcDetailPdfBuffer(report);
}

async function exportQaDetailPdf({ id, requestId }) {
  console.info('[EXPORTS][QA][PDF]', { requestId, id });
  const report = await repository.getQaSamplingReportDetail(id);

  if (!report.header) {
    throw notFound('QA sampling report not found');
  }

  return createQaDetailPdfBuffer(report);
}

module.exports = {
  exportAuditCsv,
  exportAuditExcel,
  exportLotDetailPdf,
  exportLotsCsv,
  exportLotsExcel,
  exportQaCsv,
  exportQaDetailPdf,
  exportQaExcel,
  exportQaPdf,
  exportQcCsv,
  exportQcDetailPdf,
  exportQcExcel,
  exportQcPdf,
};
