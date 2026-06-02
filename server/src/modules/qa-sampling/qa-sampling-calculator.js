const {
  calculateItemResult,
  calculateOverallResult,
} = require('../qc-inspections/qc-result-calculator');

function calculateUnitResult(calculatedItems) {
  return calculateOverallResult(calculatedItems);
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
