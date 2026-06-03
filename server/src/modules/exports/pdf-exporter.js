const PDFDocument = require('pdfkit');

function valueText(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function line(doc, label, value) {
  doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
  doc.font('Helvetica').text(valueText(value));
}

function section(doc, title) {
  doc.moveDown(0.8);
  doc.fontSize(13).font('Helvetica-Bold').text(title);
  doc.moveDown(0.2);
  doc.fontSize(9).font('Helvetica');
}

function table(doc, columns, rows, limit = 80) {
  if (!rows.length) {
    doc.text('No data');
    return;
  }

  const visibleRows = rows.slice(0, limit);
  doc.font('Helvetica-Bold').text(columns.map((column) => column.header).join(' | '));
  doc.font('Helvetica');

  visibleRows.forEach((row) => {
    doc.text(columns.map((column) => valueText(row[column.key])).join(' | '));
  });

  if (rows.length > limit) {
    doc.moveDown(0.2).text(`Showing first ${limit} of ${rows.length} rows.`);
  }
}

function createPdfBuffer(build) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    build(doc);
    doc.end();
  });
}

function createListPdfBuffer({ title, rows, columns }) {
  return createPdfBuffer((doc) => {
    doc.fontSize(16).font('Helvetica-Bold').text(title);
    doc.fontSize(9).font('Helvetica').text(`Generated at: ${new Date().toISOString()}`);
    section(doc, 'Rows');
    table(doc, columns, rows);
  });
}

function createLotDetailPdfBuffer(report) {
  return createPdfBuffer((doc) => {
    const lot = report.lot;
    doc.fontSize(16).font('Helvetica-Bold').text(`Production Lot Report: ${lot.lot_number}`);
    doc.fontSize(9).font('Helvetica');
    line(doc, 'Model', `${lot.model_code} - ${lot.product_name}`);
    line(doc, 'Status', lot.lot_status);
    line(doc, 'Lot Qty', lot.lot_qty);
    line(doc, 'Production Date', lot.production_date);

    section(doc, 'QC Summary');
    line(doc, 'Total', report.qc_summary.total);
    line(doc, 'Approved', report.qc_summary.approved);
    line(doc, 'PASS / FAIL / N/A', `${report.qc_summary.pass} / ${report.qc_summary.fail} / ${report.qc_summary.na}`);

    section(doc, 'QA Summary');
    line(doc, 'Total', report.qa_summary.total);
    line(doc, 'Approved', report.qa_summary.approved);
    line(doc, 'PASS / FAIL / N/A', `${report.qa_summary.pass} / ${report.qa_summary.fail} / ${report.qa_summary.na}`);

    section(doc, 'Serials');
    table(
      doc,
      [
        { header: 'Serial', key: 'serial_number' },
        { header: 'Unit', key: 'unit_status' },
        { header: 'QC', key: 'latest_qc_result' },
        { header: 'QA', key: 'latest_qa_result' },
      ],
      report.serials
    );
  });
}

function createQcDetailPdfBuffer(report) {
  return createPdfBuffer((doc) => {
    const header = report.header;
    doc.fontSize(16).font('Helvetica-Bold').text(`QC Inspection Report: ${header.inspection_id}`);
    doc.fontSize(9).font('Helvetica');
    line(doc, 'Inspection No', header.inspection_no);
    line(doc, 'Lot', header.lot_number);
    line(doc, 'Serial', header.serial_number);
    line(doc, 'Model', header.model_code);
    line(doc, 'Status', header.status);
    line(doc, 'Overall Result', header.overall_result);

    section(doc, 'Inspection Details');
    table(
      doc,
      [
        { header: 'Item', key: 'item_code' },
        { header: 'Measured Value', key: 'measured_value' },
        { header: 'Measured Text', key: 'measured_text' },
        { header: 'Result', key: 'result' },
      ],
      report.details
    );

    section(doc, 'Edit History');
    table(
      doc,
      [
        { header: 'Status', key: 'approval_status' },
        { header: 'Old', key: 'old_measured_value' },
        { header: 'New', key: 'new_measured_value' },
        { header: 'Reason', key: 'edit_reason' },
      ],
      report.edit_history
    );
  });
}

function createQaDetailPdfBuffer(report) {
  return createPdfBuffer((doc) => {
    const header = report.header;
    doc.fontSize(16).font('Helvetica-Bold').text(`QA Sampling Report: ${header.qa_sampling_id}`);
    doc.fontSize(9).font('Helvetica');
    line(doc, 'Sampling No', header.sampling_no);
    line(doc, 'Lot', header.lot_number);
    line(doc, 'Model', header.model_code);
    line(doc, 'Status', header.status);
    line(doc, 'Overall Result', header.overall_result);

    section(doc, 'Sample Units');
    table(
      doc,
      [
        { header: 'Sample', key: 'sample_no' },
        { header: 'Serial', key: 'serial_number' },
        { header: 'Result', key: 'unit_result' },
      ],
      report.sample_units
    );

    section(doc, 'Inspection Details');
    table(
      doc,
      [
        { header: 'Item', key: 'item_code' },
        { header: 'Measured Value', key: 'measured_value' },
        { header: 'Measured Text', key: 'measured_text' },
        { header: 'Result', key: 'result' },
      ],
      report.details
    );

    section(doc, 'Edit History');
    table(
      doc,
      [
        { header: 'Status', key: 'approval_status' },
        { header: 'Old', key: 'old_measured_value' },
        { header: 'New', key: 'new_measured_value' },
        { header: 'Reason', key: 'edit_reason' },
      ],
      report.edit_history
    );
  });
}

module.exports = {
  createListPdfBuffer,
  createLotDetailPdfBuffer,
  createQaDetailPdfBuffer,
  createQcDetailPdfBuffer,
};
