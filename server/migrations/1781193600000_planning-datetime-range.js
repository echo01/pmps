exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE lot_test_plan
      ADD COLUMN IF NOT EXISTS planned_start_datetime TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS planned_end_datetime TIMESTAMPTZ;

    UPDATE lot_test_plan
    SET
      planned_start_datetime = COALESCE(
        planned_start_datetime,
        (planned_start_date::timestamp + TIME '08:00') AT TIME ZONE 'Asia/Bangkok'
      ),
      planned_end_datetime = COALESCE(
        planned_end_datetime,
        (planned_end_date::timestamp + TIME '17:00') AT TIME ZONE 'Asia/Bangkok'
      );

    ALTER TABLE lot_test_plan_task
      ALTER COLUMN planned_start_datetime TYPE TIMESTAMPTZ
        USING planned_start_datetime AT TIME ZONE 'Asia/Bangkok',
      ALTER COLUMN planned_end_datetime TYPE TIMESTAMPTZ
        USING planned_end_datetime AT TIME ZONE 'Asia/Bangkok';

    ALTER TABLE lot_test_plan
      ALTER COLUMN planned_start_datetime SET NOT NULL,
      ALTER COLUMN planned_end_datetime SET NOT NULL;

    ALTER TABLE lot_test_plan
      DROP CONSTRAINT IF EXISTS chk_lot_test_plan_datetimes;

    ALTER TABLE lot_test_plan
      ADD CONSTRAINT chk_lot_test_plan_datetimes
      CHECK (planned_end_datetime >= planned_start_datetime);

    CREATE INDEX IF NOT EXISTS idx_lot_test_plan_datetimes
      ON lot_test_plan(planned_start_datetime, planned_end_datetime);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_lot_test_plan_datetimes;

    ALTER TABLE lot_test_plan_task
      ALTER COLUMN planned_start_datetime TYPE TIMESTAMP
        USING planned_start_datetime AT TIME ZONE 'Asia/Bangkok',
      ALTER COLUMN planned_end_datetime TYPE TIMESTAMP
        USING planned_end_datetime AT TIME ZONE 'Asia/Bangkok';

    ALTER TABLE lot_test_plan
      DROP CONSTRAINT IF EXISTS chk_lot_test_plan_datetimes,
      DROP COLUMN IF EXISTS planned_end_datetime,
      DROP COLUMN IF EXISTS planned_start_datetime;
  `);
};
