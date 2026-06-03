const { successResponse } = require('../../shared/response');
const { parsePayload, parsePositiveInt } = require('../../shared/query');
const { parsePagination, paginationMeta } = require('../../shared/pagination');
const { reportQuerySchema } = require('./reports.schema');
const service = require('./reports.service');

function parseFilters(query) {
  const parsed = parsePayload(reportQuerySchema, query);

  return {
    search: parsed.search,
    model_code: parsed.model_code,
    lot_number: parsed.lot_number,
    serial_number: parsed.serial_number,
    status: parsed.status,
    result: parsed.result,
    date_from: parsed.date_from,
    date_to: parsed.date_to,
  };
}

function pagedResponse(res, message, result) {
  return successResponse(res, {
    message,
    data: result.rows,
    meta: paginationMeta({
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    }),
  });
}

async function getDashboardSummaryController(req, res, next) {
  try {
    const data = await service.getDashboardSummary({ requestId: req.requestId });
    return successResponse(res, {
      message: 'Dashboard summary retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQcSummaryController(req, res, next) {
  try {
    const data = await service.getQcDashboardSummary({
      filters: parseFilters(req.query),
      requestId: req.requestId,
    });
    return successResponse(res, {
      message: 'QC summary retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQaSummaryController(req, res, next) {
  try {
    const data = await service.getQaDashboardSummary({
      filters: parseFilters(req.query),
      requestId: req.requestId,
    });
    return successResponse(res, {
      message: 'QA summary retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getLotStatusController(req, res, next) {
  try {
    const data = await service.getLotStatusDashboard({ requestId: req.requestId });
    return successResponse(res, {
      message: 'Lot status summary retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getLotReportsController(req, res, next) {
  try {
    const result = await service.searchLotReports({
      filters: parseFilters(req.query),
      pagination: parsePagination(req.query),
      requestId: req.requestId,
    });
    return pagedResponse(res, 'Production lot report retrieved successfully', result);
  } catch (error) {
    return next(error);
  }
}

async function getSerialReportsController(req, res, next) {
  try {
    const result = await service.searchSerialReports({
      filters: parseFilters(req.query),
      pagination: parsePagination(req.query),
      requestId: req.requestId,
    });
    return pagedResponse(res, 'Serial report retrieved successfully', result);
  } catch (error) {
    return next(error);
  }
}

async function getQcInspectionReportsController(req, res, next) {
  try {
    const result = await service.searchQcInspectionReports({
      filters: parseFilters(req.query),
      pagination: parsePagination(req.query),
      requestId: req.requestId,
    });
    return pagedResponse(res, 'QC inspection report retrieved successfully', result);
  } catch (error) {
    return next(error);
  }
}

async function getQaSamplingReportsController(req, res, next) {
  try {
    const result = await service.searchQaSamplingReports({
      filters: parseFilters(req.query),
      pagination: parsePagination(req.query),
      requestId: req.requestId,
    });
    return pagedResponse(res, 'QA sampling report retrieved successfully', result);
  } catch (error) {
    return next(error);
  }
}

async function getLotReportByIdController(req, res, next) {
  try {
    const data = await service.getLotReport({
      lotId: parsePositiveInt(req.params.lotId, 'lotId'),
      requestId: req.requestId,
    });
    return successResponse(res, {
      message: 'Production lot report detail retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getSerialReportByIdController(req, res, next) {
  try {
    const data = await service.getSerialReport({
      productUnitId: parsePositiveInt(req.params.productUnitId, 'productUnitId'),
      requestId: req.requestId,
    });
    return successResponse(res, {
      message: 'Serial report detail retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQcInspectionReportByIdController(req, res, next) {
  try {
    const data = await service.getQcInspectionReport({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });
    return successResponse(res, {
      message: 'QC inspection report detail retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQaSamplingReportByIdController(req, res, next) {
  try {
    const data = await service.getQaSamplingReport({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });
    return successResponse(res, {
      message: 'QA sampling report detail retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function exportQcInspectionReportsController(req, res, next) {
  try {
    const data = await service.exportQcInspectionRows({
      filters: parseFilters(req.query),
      requestId: req.requestId,
    });
    return successResponse(res, {
      message: 'QC inspection export rows retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function exportQaSamplingReportsController(req, res, next) {
  try {
    const data = await service.exportQaSamplingRows({
      filters: parseFilters(req.query),
      requestId: req.requestId,
    });
    return successResponse(res, {
      message: 'QA sampling export rows retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getDashboardSummaryController,
  getQcSummaryController,
  getQaSummaryController,
  getLotStatusController,
  getLotReportsController,
  getSerialReportsController,
  getQcInspectionReportsController,
  getQaSamplingReportsController,
  getLotReportByIdController,
  getSerialReportByIdController,
  getQcInspectionReportByIdController,
  getQaSamplingReportByIdController,
  exportQcInspectionReportsController,
  exportQaSamplingReportsController,
};
