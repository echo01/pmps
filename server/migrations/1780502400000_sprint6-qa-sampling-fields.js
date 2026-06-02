exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE qa_sampling_header
    ADD COLUMN IF NOT EXISTS sampling_method VARCHAR(50);

    ALTER TABLE qa_sampling_header
    ADD COLUMN IF NOT EXISTS station_name VARCHAR(100);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE qa_sampling_header
    DROP COLUMN IF EXISTS station_name;

    ALTER TABLE qa_sampling_header
    DROP COLUMN IF EXISTS sampling_method;
  `);
};
