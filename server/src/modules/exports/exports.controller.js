const { parsePayload, parsePositiveInt } = require('../../shared/query');
const { auditTrailExportQuerySchema, exportQuerySchema } = require('./exports.schema');
const service = require('./exports.service');

function parseFilters(query) {
  return parsePayload(exportQuerySchema, query);
}

function parseAuditFilters(query) {
  return parsePayload(auditTrailExportQuerySchema, query);
}

function sendFile(res, { buffer, contentType, filename }) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  return res.status(200).send(buffer);
}

function csv(res, buffer, filename) {
  return sendFile(res, {
    buffer,
    contentType: 'text/csv; charset=utf-8',
    filename,
  });
}

function excel(res, buffer, filename) {
  return sendFile(res, {
    buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename,
  });
}

function pdf(res, buffer, filename) {
  return sendFile(res, {
    buffer,
    contentType: 'application/pdf',
    filename,
  });
}

async function exportQcCsvController(req, res, next) {
  try {
    return csv(
      res,
      await service.exportQcCsv({ filters: parseFilters(req.query), requestId: req.requestId }),
      'qc-inspections.csv'
    );
  } catch (error) {
    return next(error);
  }
}

async function exportQcExcelController(req, res, next) {
  try {
    return excel(
      res,
      await service.exportQcExcel({ filters: parseFilters(req.query), requestId: req.requestId }),
      'qc-inspections.xlsx'
    );
  } catch (error) {
    return next(error);
  }
}

async function exportQcPdfController(req, res, next) {
  try {
    return pdf(
      res,
      await service.exportQcPdf({ filters: parseFilters(req.query), requestId: req.requestId }),
      'qc-inspections.pdf'
    );
  } catch (error) {
    return next(error);
  }
}

async function exportQcDetailPdfController(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    return pdf(
      res,
      await service.exportQcDetailPdf({ id, requestId: req.requestId }),
      `qc-inspection-${id}.pdf`
    );
  } catch (error) {
    return next(error);
  }
}

async function exportQaCsvController(req, res, next) {
  try {
    return csv(
      res,
      await service.exportQaCsv({ filters: parseFilters(req.query), requestId: req.requestId }),
      'qa-samplings.csv'
    );
  } catch (error) {
    return next(error);
  }
}

async function exportQaExcelController(req, res, next) {
  try {
    return excel(
      res,
      await service.exportQaExcel({ filters: parseFilters(req.query), requestId: req.requestId }),
      'qa-samplings.xlsx'
    );
  } catch (error) {
    return next(error);
  }
}

async function exportQaPdfController(req, res, next) {
  try {
    return pdf(
      res,
      await service.exportQaPdf({ filters: parseFilters(req.query), requestId: req.requestId }),
      'qa-samplings.pdf'
    );
  } catch (error) {
    return next(error);
  }
}

async function exportQaDetailPdfController(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    return pdf(
      res,
      await service.exportQaDetailPdf({ id, requestId: req.requestId }),
      `qa-sampling-${id}.pdf`
    );
  } catch (error) {
    return next(error);
  }
}

async function exportLotsCsvController(req, res, next) {
  try {
    return csv(
      res,
      await service.exportLotsCsv({ filters: parseFilters(req.query), requestId: req.requestId }),
      'lots.csv'
    );
  } catch (error) {
    return next(error);
  }
}

async function exportLotsExcelController(req, res, next) {
  try {
    return excel(
      res,
      await service.exportLotsExcel({ filters: parseFilters(req.query), requestId: req.requestId }),
      'lots.xlsx'
    );
  } catch (error) {
    return next(error);
  }
}

async function exportLotDetailPdfController(req, res, next) {
  try {
    const lotId = parsePositiveInt(req.params.lotId, 'lotId');
    return pdf(
      res,
      await service.exportLotDetailPdf({ lotId, requestId: req.requestId }),
      `lot-${lotId}.pdf`
    );
  } catch (error) {
    return next(error);
  }
}

async function exportAuditCsvController(req, res, next) {
  try {
    return csv(
      res,
      await service.exportAuditCsv({ filters: parseAuditFilters(req.query), requestId: req.requestId }),
      'audit-trails.csv'
    );
  } catch (error) {
    return next(error);
  }
}

async function exportAuditExcelController(req, res, next) {
  try {
    return excel(
      res,
      await service.exportAuditExcel({ filters: parseAuditFilters(req.query), requestId: req.requestId }),
      'audit-trails.xlsx'
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  exportAuditCsvController,
  exportAuditExcelController,
  exportLotDetailPdfController,
  exportLotsCsvController,
  exportLotsExcelController,
  exportQaCsvController,
  exportQaDetailPdfController,
  exportQaExcelController,
  exportQaPdfController,
  exportQcCsvController,
  exportQcDetailPdfController,
  exportQcExcelController,
  exportQcPdfController,
};
