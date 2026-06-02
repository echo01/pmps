const { validationError } = require('../../shared/http-error');

function generateSerials({ prefix = '', start_number: startNumber, count, padding = 0 }) {
  const serials = [];

  for (let index = 0; index < count; index += 1) {
    const numberText = String(startNumber + index);
    serials.push(`${prefix}${padding > 0 ? numberText.padStart(padding, '0') : numberText}`);
  }

  if (new Set(serials).size !== serials.length) {
    throw validationError('Generated serials must be unique', [
      {
        field: 'serial_generation',
        message: 'Generated serials contain duplicated values',
      },
    ]);
  }

  return serials;
}

module.exports = {
  generateSerials,
};
