const ExcelJS = require('exceljs');

async function createWorkbookBuffer({ sheets }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMPS';
  workbook.created = new Date();

  sheets.forEach((sheet) => {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.columns = sheet.columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width || Math.max(14, column.header.length + 4),
    }));

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle' };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    if (sheet.rows.length > 0) {
      worksheet.addRows(sheet.rows);
    } else {
      worksheet.addRow({ [sheet.columns[0].key]: 'No data' });
    }

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'top', wrapText: true };
      });
    });
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = {
  createWorkbookBuffer,
};
