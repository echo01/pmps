function isBlank(value) {
  return value === undefined || value === null || value === '';
}

function calculateItemResult(templateItem, measured = {}) {
  const checkType = templateItem.check_type;

  if (checkType === 'NUMERIC') {
    if (isBlank(measured.measured_value)) {
      return 'N/A';
    }

    const value = Number(measured.measured_value);

    if (templateItem.spec_min !== null && templateItem.spec_min !== undefined && value < Number(templateItem.spec_min)) {
      return 'FAIL';
    }

    if (templateItem.spec_max !== null && templateItem.spec_max !== undefined && value > Number(templateItem.spec_max)) {
      return 'FAIL';
    }

    return 'PASS';
  }

  if (checkType === 'BOOLEAN') {
    if (isBlank(measured.measured_text)) {
      return 'N/A';
    }

    const value = String(measured.measured_text).trim().toUpperCase();
    const passValues = new Set(['OK', 'PASS', 'YES', 'TRUE']);
    const failValues = new Set(['NG', 'FAIL', 'NO', 'FALSE']);

    if (passValues.has(value)) {
      return 'PASS';
    }

    if (failValues.has(value)) {
      return 'FAIL';
    }

    return 'N/A';
  }

  if (checkType === 'TEXT') {
    return isBlank(measured.measured_text) ? 'N/A' : 'PASS';
  }

  return 'N/A';
}

function calculateOverallResult(calculatedItems) {
  const mandatoryItems = calculatedItems.filter((item) => item.mandatory);

  if (!mandatoryItems.length) {
    return 'N/A';
  }

  if (mandatoryItems.some((item) => item.result === 'FAIL')) {
    return 'FAIL';
  }

  if (mandatoryItems.every((item) => item.result === 'PASS')) {
    return 'PASS';
  }

  return 'N/A';
}

module.exports = {
  calculateItemResult,
  calculateOverallResult,
};
