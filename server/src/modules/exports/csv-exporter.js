function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = value instanceof Date ? value.toISOString() : String(value);

  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function createCsvBuffer({ columns, rows }) {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(',');
  const lines = rows.map((row) =>
    columns.map((column) => escapeCsvValue(row[column.key])).join(',')
  );

  return Buffer.from(`\ufeff${[header, ...lines].join('\r\n')}\r\n`, 'utf8');
}

module.exports = {
  createCsvBuffer,
};
