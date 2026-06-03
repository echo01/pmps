const { notFound } = require('../../shared/http-error');
const repository = require('./reports.repository');

async function paged({ rowsFn, countFn, filters, pagination }) {
  const [rows, total] = await Promise.all([
    rowsFn(filters, pagination),
    countFn(filters),
  ]);

  return {
    rows,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

async function getDashboardSummary({ requestId }) {
  console.info('[REPORTS][DASHBOARD][SUMMARY]', { requestId });
  return repository.getDashboardSummary();
}

async function getQcDashboardSummary({ filters, requestId }) {
  console.info('[REPORTS][DASHBOARD][QC]', { requestId, filters });
  return repository.getQcSummary(filters);
}

async function getQaDashboardSummary({ filters, requestId }) {
  console.info('[REPORTS][DASHBOARD][QA]', { requestId, filters });
  return repository.getQaSummary(filters);
}

async function getLotStatusDashboard({ requestId }) {
  console.info('[REPORTS][DASHBOARD][LOT_STATUS]', { requestId });
  return repository.getLotStatusSummary();
}

async function searchLotReports({ filters, pagination, requestId }) {
  console.info('[REPORTS][LOTS][SEARCH]', { requestId, filters });
  return paged({
    rowsFn: repository.findLotReports,
    countFn: repository.countLotReports,
    filters,
    pagination,
  });
}

async function searchSerialReports({ filters, pagination, requestId }) {
  console.info('[REPORTS][SERIALS][SEARCH]', { requestId, filters });
  return paged({
    rowsFn: repository.findSerialReports,
    countFn: repository.countSerialReports,
    filters,
    pagination,
  });
}

async function searchQcInspectionReports({ filters, pagination, requestId }) {
  console.info('[REPORTS][QC][SEARCH]', { requestId, filters });
  return paged({
    rowsFn: repository.findQcInspectionReports,
    countFn: repository.countQcInspectionReports,
    filters,
    pagination,
  });
}

async function searchQaSamplingReports({ filters, pagination, requestId }) {
  console.info('[REPORTS][QA][SEARCH]', { requestId, filters });
  return paged({
    rowsFn: repository.findQaSamplingReports,
    countFn: repository.countQaSamplingReports,
    filters,
    pagination,
  });
}

async function getLotReport({ lotId, requestId }) {
  console.info('[REPORTS][LOTS][DETAIL]', { requestId, lotId });
  const report = await repository.getLotReportDetail(lotId);

  if (!report.lot) {
    throw notFound('Production lot report not found');
  }

  return report;
}

async function getSerialReport({ productUnitId, requestId }) {
  console.info('[REPORTS][SERIALS][DETAIL]', { requestId, productUnitId });
  const report = await repository.getSerialReportDetail(productUnitId);

  if (!report.serial) {
    throw notFound('Serial report not found');
  }

  return {
    ...report.serial,
    qc_inspections: report.qc_inspections,
    qa_samplings: report.qa_samplings,
  };
}

async function getQcInspectionReport({ id, requestId }) {
  console.info('[REPORTS][QC][DETAIL]', { requestId, id });
  const report = await repository.getQcInspectionReportDetail(id);

  if (!report.header) {
    throw notFound('QC inspection report not found');
  }

  return {
    ...report.header,
    details: report.details,
    equipment: report.equipment,
    approval_logs: report.approval_logs,
  };
}

async function getQaSamplingReport({ id, requestId }) {
  console.info('[REPORTS][QA][DETAIL]', { requestId, id });
  const report = await repository.getQaSamplingReportDetail(id);

  if (!report.header) {
    throw notFound('QA sampling report not found');
  }

  const detailsByUnitId = report.details.reduce((map, detail) => {
    if (!map.has(detail.qa_sample_unit_id)) {
      map.set(detail.qa_sample_unit_id, []);
    }

    map.get(detail.qa_sample_unit_id).push(detail);
    return map;
  }, new Map());

  return {
    ...report.header,
    sample_units: report.sample_units.map((unit) => ({
      ...unit,
      details: detailsByUnitId.get(unit.id) || [],
    })),
    equipment: report.equipment,
    approval_logs: report.approval_logs,
  };
}

async function exportQcInspectionRows({ filters, requestId }) {
  console.info('[REPORTS][QC][EXPORT]', { requestId, filters });
  return repository.findQcInspectionExportRows(filters);
}

async function exportQaSamplingRows({ filters, requestId }) {
  console.info('[REPORTS][QA][EXPORT]', { requestId, filters });
  return repository.findQaSamplingExportRows(filters);
}

module.exports = {
  getDashboardSummary,
  getQcDashboardSummary,
  getQaDashboardSummary,
  getLotStatusDashboard,
  searchLotReports,
  searchSerialReports,
  searchQcInspectionReports,
  searchQaSamplingReports,
  getLotReport,
  getSerialReport,
  getQcInspectionReport,
  getQaSamplingReport,
  exportQcInspectionRows,
  exportQaSamplingRows,
};
