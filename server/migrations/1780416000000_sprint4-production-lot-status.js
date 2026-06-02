exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE production_lot
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'OPEN';

    UPDATE production_lot
    SET status = 'OPEN'
    WHERE status IS NULL;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_production_lot_status'
          AND conrelid = 'production_lot'::regclass
      ) THEN
        ALTER TABLE production_lot
        ADD CONSTRAINT chk_production_lot_status
        CHECK (status IN ('OPEN', 'CLOSED', 'HOLD', 'CANCELLED'));
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE production_lot
    DROP CONSTRAINT IF EXISTS chk_production_lot_status;

    ALTER TABLE production_lot
    DROP COLUMN IF EXISTS status;
  `);
};
