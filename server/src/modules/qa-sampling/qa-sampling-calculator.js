const {
  calculateItemResult,
} = require('../qc-inspections/qc-result-calculator');

function calculateUnitResult(calculatedItems) {
  if (!calculatedItems.length) {
    return 'N/A';
  }

  if (calculatedItems.some((item) => item.result === 'FAIL')) {
    return 'FAIL';
  }

  if (calculatedItems.every((item) => item.result === 'PASS')) {
    return 'PASS';
  }

  return 'N/A';
}

function calculateSamplingOverallResult(sampleUnits) {
  if (!sampleUnits.length) {
    return 'N/A';
  }

  if (sampleUnits.some((unit) => unit.unit_result === 'FAIL')) {
    return 'FAIL';
  }

  if (sampleUnits.every((unit) => unit.unit_result === 'PASS')) {
    return 'PASS';
  }

  return 'N/A';
}

module.exports = {
  calculateItemResult,
  calculateUnitResult,
  calculateSamplingOverallResult,
};
