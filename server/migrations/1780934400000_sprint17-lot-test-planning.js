exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO app_permission (permission_code, permission_name, description)
    VALUES
      ('PlanningView', 'Planning View', 'View lot test planning dashboard'),
      ('PlanningManage', 'Planning Manage', 'Create and manage lot test plans and tasks')
    ON CONFLICT (permission_code) DO UPDATE
    SET
      permission_name = EXCLUDED.permission_name,
      description = EXCLUDED.description;

    INSERT INTO app_role_permission (role_id, permission_id)
    SELECT r.id, p.id
    FROM app_role r
    CROSS JOIN app_permission p
    WHERE r.role_code = 'ADMIN'
      AND p.permission_code IN ('PlanningView', 'PlanningManage')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS lot_test_plan (
      id SERIAL PRIMARY KEY,
      lot_id INT NOT NULL,
      plan_code VARCHAR(50) UNIQUE NOT NULL,
      plan_name VARCHAR(200) NOT NULL,
      priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
      planned_start_date DATE NOT NULL,
      planned_end_date DATE NOT NULL,
      owner_user_id INT,
      plan_status VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
      remark TEXT,
      created_by INT,
      updated_by INT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT fk_lot_test_plan_lot
        FOREIGN KEY (lot_id)
        REFERENCES production_lot(id)
        ON DELETE CASCADE,

      CONSTRAINT fk_lot_test_plan_owner
        FOREIGN KEY (owner_user_id)
        REFERENCES app_user(id)
        ON DELETE SET NULL,

      CONSTRAINT fk_lot_test_plan_created_by
        FOREIGN KEY (created_by)
        REFERENCES app_user(id)
        ON DELETE SET NULL,

      CONSTRAINT fk_lot_test_plan_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES app_user(id)
        ON DELETE SET NULL,

      CONSTRAINT uq_lot_test_plan_lot
        UNIQUE (lot_id),

      CONSTRAINT chk_lot_test_plan_priority
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),

      CONSTRAINT chk_lot_test_plan_status
        CHECK (plan_status IN ('PLANNED', 'IN_PROGRESS', 'WAITING_REVIEW', 'COMPLETED', 'CANCELLED')),

      CONSTRAINT chk_lot_test_plan_dates
        CHECK (planned_end_date >= planned_start_date)
    );

    CREATE TABLE IF NOT EXISTS lot_test_plan_task (
      id SERIAL PRIMARY KEY,
      plan_id INT NOT NULL,
      task_type VARCHAR(40) NOT NULL,
      task_name VARCHAR(200) NOT NULL,
      assigned_user_id INT,
      planned_start_datetime TIMESTAMP,
      planned_end_datetime TIMESTAMP,
      task_status VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
      source_type VARCHAR(20),
      source_id INT,
      sort_order INT NOT NULL DEFAULT 0,
      remark TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT fk_lot_test_plan_task_plan
        FOREIGN KEY (plan_id)
        REFERENCES lot_test_plan(id)
        ON DELETE CASCADE,

      CONSTRAINT fk_lot_test_plan_task_assigned_user
        FOREIGN KEY (assigned_user_id)
        REFERENCES app_user(id)
        ON DELETE SET NULL,

      CONSTRAINT chk_lot_test_plan_task_type
        CHECK (task_type IN ('LOT_CREATED', 'QC_INSPECTION', 'QC_REVIEW', 'QC_APPROVE', 'QA_SAMPLING', 'QA_REVIEW', 'QA_APPROVE', 'REPORT_READY', 'CUSTOM')),

      CONSTRAINT chk_lot_test_plan_task_status
        CHECK (task_status IN ('PLANNED', 'IN_PROGRESS', 'WAITING_REVIEW', 'COMPLETED', 'CANCELLED')),

      CONSTRAINT chk_lot_test_plan_task_source
        CHECK (source_type IS NULL OR source_type IN ('QC', 'QA', 'REPORT', 'LOT')),

      CONSTRAINT chk_lot_test_plan_task_dates
        CHECK (
          planned_start_datetime IS NULL
          OR planned_end_datetime IS NULL
          OR planned_end_datetime >= planned_start_datetime
        )
    );

    CREATE INDEX IF NOT EXISTS idx_lot_test_plan_lot
      ON lot_test_plan(lot_id);

    CREATE INDEX IF NOT EXISTS idx_lot_test_plan_dates
      ON lot_test_plan(planned_start_date, planned_end_date);

    CREATE INDEX IF NOT EXISTS idx_lot_test_plan_status
      ON lot_test_plan(plan_status);

    CREATE INDEX IF NOT EXISTS idx_lot_test_plan_task_plan
      ON lot_test_plan_task(plan_id);

    CREATE INDEX IF NOT EXISTS idx_lot_test_plan_task_dates
      ON lot_test_plan_task(planned_start_datetime, planned_end_datetime);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS lot_test_plan_task;
    DROP TABLE IF EXISTS lot_test_plan;

    DELETE FROM app_role_permission rp
    USING app_permission p
    WHERE rp.permission_id = p.id
      AND p.permission_code IN ('PlanningView', 'PlanningManage');

    DELETE FROM app_permission
    WHERE permission_code IN ('PlanningView', 'PlanningManage');
  `);
};
