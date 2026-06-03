/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS result_edit_audit_log (
      id SERIAL PRIMARY KEY,
      source_type VARCHAR(30) NOT NULL,
      source_id INT NOT NULL,
      detail_id INT,
      template_item_id INT,
      old_measured_value NUMERIC,
      new_measured_value NUMERIC,
      old_measured_text TEXT,
      new_measured_text TEXT,
      old_result VARCHAR(20),
      new_result VARCHAR(20),
      old_overall_result VARCHAR(20),
      new_overall_result VARCHAR(20),
      edit_reason TEXT NOT NULL,
      edit_by INT NOT NULL,
      edit_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      approval_status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
      CONSTRAINT fk_result_edit_audit_log_user
        FOREIGN KEY (edit_by)
        REFERENCES app_user(id)
        ON DELETE RESTRICT,
      CONSTRAINT chk_result_edit_source_type
        CHECK (source_type IN ('QC', 'QA')),
      CONSTRAINT chk_result_edit_approval_status
        CHECK (approval_status IN ('REQUESTED', 'APPLIED', 'APPROVED', 'REJECTED'))
    );

    CREATE INDEX IF NOT EXISTS idx_result_edit_audit_source
      ON result_edit_audit_log(source_type, source_id);

    CREATE INDEX IF NOT EXISTS idx_result_edit_audit_detail
      ON result_edit_audit_log(source_type, detail_id);

    CREATE INDEX IF NOT EXISTS idx_result_edit_audit_user
      ON result_edit_audit_log(edit_by);

    ALTER TABLE inspection_header
      DROP CONSTRAINT IF EXISTS chk_inspection_status;

    ALTER TABLE inspection_header
      ADD CONSTRAINT chk_inspection_status
      CHECK (status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED','EDIT_REQUESTED'));

    ALTER TABLE qa_sampling_header
      DROP CONSTRAINT IF EXISTS chk_qa_status;

    ALTER TABLE qa_sampling_header
      ADD CONSTRAINT chk_qa_status
      CHECK (status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED','EDIT_REQUESTED'));
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE inspection_header
      DROP CONSTRAINT IF EXISTS chk_inspection_status;

    ALTER TABLE inspection_header
      ADD CONSTRAINT chk_inspection_status
      CHECK (status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED'));

    ALTER TABLE qa_sampling_header
      DROP CONSTRAINT IF EXISTS chk_qa_status;

    ALTER TABLE qa_sampling_header
      ADD CONSTRAINT chk_qa_status
      CHECK (status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED'));

    DROP TABLE IF EXISTS result_edit_audit_log;
  `);
};
