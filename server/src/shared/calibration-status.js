function toDateOnly(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getCalibrationStatus(calibrationDueDate, now = new Date()) {
  const dueDate = toDateOnly(calibrationDueDate);

  if (!dueDate) {
    return 'UNKNOWN';
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return dueDate < today ? 'EXPIRED' : 'VALID';
}

module.exports = {
  getCalibrationStatus,
};
