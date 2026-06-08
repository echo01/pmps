exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE production_lot
      DROP CONSTRAINT IF EXISTS chk_production_lot_status;

    ALTER TABLE production_lot
      ADD CONSTRAINT chk_production_lot_status
      CHECK (status IN ('OPEN', 'COMPLETED', 'CLOSED', 'HOLD', 'CANCELLED'));

    CREATE OR REPLACE FUNCTION sync_lot_workflow_completion(target_lot_id INT)
    RETURNS VOID
    LANGUAGE plpgsql
    AS $$
    DECLARE
      target_plan_id INT;
      workflow_complete BOOLEAN := false;
    BEGIN
      SELECT id
      INTO target_plan_id
      FROM lot_test_plan
      WHERE lot_id = target_lot_id
      LIMIT 1;

      IF target_plan_id IS NULL THEN
        RETURN;
      END IF;

      SELECT
        EXISTS (
          SELECT 1
          FROM lot_test_plan_task
          WHERE plan_id = target_plan_id
            AND task_type = 'LOT_CREATED'
            AND task_status = 'COMPLETED'
        )
        AND NOT EXISTS (
          SELECT required_type
          FROM unnest(ARRAY[
            'QC_INSPECTION',
            'QC_REVIEW',
            'QC_APPROVE',
            'QA_SAMPLING',
            'REPORT_READY'
          ]) AS required_type
          WHERE NOT EXISTS (
            SELECT 1
            FROM lot_test_plan_task task
            WHERE task.plan_id = target_plan_id
              AND task.task_type = required_type
          )
        )
        AND EXISTS (
          SELECT 1
          FROM product_unit
          WHERE lot_id = target_lot_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM product_unit unit_row
          LEFT JOIN LATERAL (
            SELECT inspection.status
            FROM inspection_header inspection
            WHERE inspection.product_unit_id = unit_row.id
            ORDER BY inspection.updated_at DESC NULLS LAST, inspection.id DESC
            LIMIT 1
          ) latest_qc ON true
          WHERE unit_row.lot_id = target_lot_id
            AND COALESCE(latest_qc.status, 'NOT_STARTED') <> 'APPROVED'
        )
        AND COALESCE((
          SELECT sampling.status
          FROM qa_sampling_header sampling
          WHERE sampling.lot_id = target_lot_id
          ORDER BY sampling.updated_at DESC NULLS LAST, sampling.id DESC
          LIMIT 1
        ), 'NOT_STARTED') = 'APPROVED'
      INTO workflow_complete;

      UPDATE lot_test_plan_task
      SET
        task_status = CASE WHEN workflow_complete THEN 'COMPLETED' ELSE 'PLANNED' END,
        updated_at = CURRENT_TIMESTAMP
      WHERE plan_id = target_plan_id
        AND task_type = 'REPORT_READY'
        AND task_status <> CASE WHEN workflow_complete THEN 'COMPLETED' ELSE 'PLANNED' END;

      UPDATE lot_test_plan
      SET
        plan_status = CASE WHEN workflow_complete THEN 'COMPLETED' ELSE 'IN_PROGRESS' END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = target_plan_id
        AND (
          (workflow_complete AND plan_status NOT IN ('COMPLETED', 'CANCELLED'))
          OR (NOT workflow_complete AND plan_status = 'COMPLETED')
        );

      UPDATE production_lot
      SET
        status = CASE WHEN workflow_complete THEN 'COMPLETED' ELSE 'OPEN' END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = target_lot_id
        AND (
          (workflow_complete AND status = 'OPEN')
          OR (NOT workflow_complete AND status = 'COMPLETED')
        );
    END;
    $$;

    CREATE OR REPLACE FUNCTION sync_lot_workflow_from_change()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    DECLARE
      target_lot_id INT;
      changed_task_type VARCHAR(40);
    BEGIN
      IF TG_TABLE_NAME = 'inspection_header' THEN
        SELECT lot_id
        INTO target_lot_id
        FROM product_unit
        WHERE id = COALESCE(NEW.product_unit_id, OLD.product_unit_id);
      ELSIF TG_TABLE_NAME = 'qa_sampling_header' THEN
        target_lot_id := COALESCE(NEW.lot_id, OLD.lot_id);
      ELSIF TG_TABLE_NAME = 'lot_test_plan_task' THEN
        changed_task_type := COALESCE(NEW.task_type, OLD.task_type);
        IF changed_task_type = 'REPORT_READY' THEN
          RETURN COALESCE(NEW, OLD);
        END IF;

        SELECT lot_id
        INTO target_lot_id
        FROM lot_test_plan
        WHERE id = COALESCE(NEW.plan_id, OLD.plan_id);
      END IF;

      IF target_lot_id IS NOT NULL THEN
        PERFORM sync_lot_workflow_completion(target_lot_id);
      END IF;

      RETURN COALESCE(NEW, OLD);
    END;
    $$;

    DROP TRIGGER IF EXISTS trg_sync_lot_workflow_from_qc ON inspection_header;
    CREATE TRIGGER trg_sync_lot_workflow_from_qc
      AFTER INSERT OR UPDATE OF status OR DELETE
      ON inspection_header
      FOR EACH ROW
      EXECUTE FUNCTION sync_lot_workflow_from_change();

    DROP TRIGGER IF EXISTS trg_sync_lot_workflow_from_qa ON qa_sampling_header;
    CREATE TRIGGER trg_sync_lot_workflow_from_qa
      AFTER INSERT OR UPDATE OF status OR DELETE
      ON qa_sampling_header
      FOR EACH ROW
      EXECUTE FUNCTION sync_lot_workflow_from_change();

    DROP TRIGGER IF EXISTS trg_sync_lot_workflow_from_task ON lot_test_plan_task;
    CREATE TRIGGER trg_sync_lot_workflow_from_task
      AFTER INSERT OR UPDATE OF task_status, task_type OR DELETE
      ON lot_test_plan_task
      FOR EACH ROW
      EXECUTE FUNCTION sync_lot_workflow_from_change();

    SELECT sync_lot_workflow_completion(id)
    FROM production_lot;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_sync_lot_workflow_from_task ON lot_test_plan_task;
    DROP TRIGGER IF EXISTS trg_sync_lot_workflow_from_qa ON qa_sampling_header;
    DROP TRIGGER IF EXISTS trg_sync_lot_workflow_from_qc ON inspection_header;
    DROP FUNCTION IF EXISTS sync_lot_workflow_from_change();
    DROP FUNCTION IF EXISTS sync_lot_workflow_completion(INT);

    UPDATE production_lot
    SET status = 'CLOSED'
    WHERE status = 'COMPLETED';

    ALTER TABLE production_lot
      DROP CONSTRAINT IF EXISTS chk_production_lot_status;

    ALTER TABLE production_lot
      ADD CONSTRAINT chk_production_lot_status
      CHECK (status IN ('OPEN', 'CLOSED', 'HOLD', 'CANCELLED'));
  `);
};
