/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    pgm.sql(`

    -- =========================================================
    -- A. production_lot unique constraint
    -- =========================================================
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'uq_production_lot_model_lot'
              AND conrelid = 'production_lot'::regclass
        ) THEN
            ALTER TABLE production_lot
            ADD CONSTRAINT uq_production_lot_model_lot
            UNIQUE (model_id, lot_number);
        END IF;
    END $$;


    -- =========================================================
    -- B. qa_sample_detail.template_item_id FK
    -- =========================================================
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'fk_qa_sample_detail_item'
              AND conrelid = 'qa_sample_detail'::regclass
        ) THEN
            ALTER TABLE qa_sample_detail
            ADD CONSTRAINT fk_qa_sample_detail_item
            FOREIGN KEY (template_item_id)
            REFERENCES test_template_item(id)
            ON DELETE RESTRICT;
        END IF;
    END $$;


    -- =========================================================
    -- C. qa_sample_unit.product_unit_id FK
    -- =========================================================
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'fk_qa_sample_unit_product_unit'
              AND conrelid = 'qa_sample_unit'::regclass
        ) THEN
            ALTER TABLE qa_sample_unit
            ADD CONSTRAINT fk_qa_sample_unit_product_unit
            FOREIGN KEY (product_unit_id)
            REFERENCES product_unit(id)
            ON DELETE SET NULL;
        END IF;
    END $$;


    -- =========================================================
    -- D. qa_sample_unit unique constraints
    -- =========================================================
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'uq_qa_sample_unit_serial_per_sampling'
              AND conrelid = 'qa_sample_unit'::regclass
        ) THEN
            ALTER TABLE qa_sample_unit
            ADD CONSTRAINT uq_qa_sample_unit_serial_per_sampling
            UNIQUE (qa_sampling_id, serial_number);
        END IF;
    END $$;

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'uq_qa_sample_unit_product_per_sampling'
              AND conrelid = 'qa_sample_unit'::regclass
        ) THEN
            ALTER TABLE qa_sample_unit
            ADD CONSTRAINT uq_qa_sample_unit_product_per_sampling
            UNIQUE (qa_sampling_id, product_unit_id);
        END IF;
    END $$;


    -- =========================================================
    -- E. inspection_header unique constraint
    -- =========================================================
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'uq_inspection_unit_template_no'
              AND conrelid = 'inspection_header'::regclass
        ) THEN
            ALTER TABLE inspection_header
            ADD CONSTRAINT uq_inspection_unit_template_no
            UNIQUE (product_unit_id, template_id, inspection_no);
        END IF;
    END $$;


    -- =========================================================
    -- F. qa_sampling_header unique constraint
    -- =========================================================
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'uq_qa_sampling_lot_template_round'
              AND conrelid = 'qa_sampling_header'::regclass
        ) THEN
            ALTER TABLE qa_sampling_header
            ADD CONSTRAINT uq_qa_sampling_lot_template_round
            UNIQUE (lot_id, template_id, sampling_round);
        END IF;
    END $$;


    -- =========================================================
    -- G. Permission / Role Permission
    -- =========================================================
    CREATE TABLE IF NOT EXISTS app_permission (
        id SERIAL PRIMARY KEY,
        permission_code VARCHAR(100) UNIQUE NOT NULL,
        permission_name VARCHAR(150) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_role_permission (
        id SERIAL PRIMARY KEY,
        role_id INT NOT NULL,
        permission_id INT NOT NULL,

        CONSTRAINT fk_role_permission_role
            FOREIGN KEY (role_id)
            REFERENCES app_role(id)
            ON DELETE CASCADE,

        CONSTRAINT fk_role_permission_permission
            FOREIGN KEY (permission_id)
            REFERENCES app_permission(id)
            ON DELETE CASCADE,

        CONSTRAINT uq_role_permission
            UNIQUE (role_id, permission_id)
    );

    INSERT INTO app_permission (permission_code, permission_name, description)
    VALUES
    ('UserRole', 'User and Role Management', 'Manage users, roles and permissions'),
    ('ProductMaster', 'Product Master', 'Manage product category, subcategory and model'),
    ('EquipmentMaster', 'Equipment Master', 'Manage equipment and calibration data'),
    ('ModelRequiredEquipment', 'Model Required Equipment', 'Manage required equipment per model'),
    ('TestTemplate', 'Test Template', 'Manage QC and QA test templates'),
    ('ProductionLot', 'Production Lot', 'Create and manage production lots and serial numbers'),
    ('QCInspection', 'QC Inspection', 'Create and manage QC inspection records'),
    ('QASampling', 'QA Sampling', 'Create and manage QA sampling records'),
    ('ApproveQC', 'Approve QC', 'Review and approve QC inspection'),
    ('ApproveQA', 'Approve QA', 'Review and approve QA sampling'),
    ('SearchReport', 'Search Report', 'View QC and QA reports'),
    ('EditTestResult', 'Edit Test Result', 'Edit QC and QA test results'),
    ('ApiLogViewer', 'API Log Viewer', 'View external API request logs')
    ON CONFLICT (permission_code) DO UPDATE
    SET 
        permission_name = EXCLUDED.permission_name,
        description = EXCLUDED.description;

    INSERT INTO app_role_permission (role_id, permission_id)
    SELECT r.id, p.id
    FROM app_role r
    CROSS JOIN app_permission p
    WHERE r.role_code = 'ADMIN'
    ON CONFLICT (role_id, permission_id) DO NOTHING;


    -- =========================================================
    -- H. External API Client
    -- =========================================================
    CREATE TABLE IF NOT EXISTS external_api_client (
        id SERIAL PRIMARY KEY,
        client_code VARCHAR(100) UNIQUE NOT NULL,
        client_name VARCHAR(200) NOT NULL,
        api_key_hash TEXT NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        allowed_ip TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        last_used_at TIMESTAMP
    );

    ALTER TABLE api_request_log
    ADD COLUMN IF NOT EXISTS api_client_id INT;

    ALTER TABLE api_request_log
    ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);

    ALTER TABLE api_request_log
    ADD COLUMN IF NOT EXISTS duration_ms INT;

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'fk_api_request_log_client'
              AND conrelid = 'api_request_log'::regclass
        ) THEN
            ALTER TABLE api_request_log
            ADD CONSTRAINT fk_api_request_log_client
            FOREIGN KEY (api_client_id)
            REFERENCES external_api_client(id)
            ON DELETE SET NULL;
        END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_api_request_log_request_id
    ON api_request_log(request_id);

    CREATE INDEX IF NOT EXISTS idx_api_request_log_client
    ON api_request_log(api_client_id);


    -- =========================================================
    -- I. updated_at columns
    -- =========================================================
    ALTER TABLE product_category ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
    ALTER TABLE product_sub_category ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
    ALTER TABLE product_model ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

    ALTER TABLE production_lot ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
    ALTER TABLE product_unit ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

    ALTER TABLE equipment_type_master ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
    ALTER TABLE equipment_master ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
    ALTER TABLE model_required_equipment ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

    ALTER TABLE test_template ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
    ALTER TABLE test_template_section ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
    ALTER TABLE test_template_item ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

    ALTER TABLE inspection_header ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
    ALTER TABLE inspection_detail ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

    ALTER TABLE qa_sampling_header ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
    ALTER TABLE qa_sample_unit ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
    ALTER TABLE qa_sample_detail ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

    ALTER TABLE document_master ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
    ALTER TABLE ecn_master ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;


    -- =========================================================
    -- J. Check Constraints
    -- =========================================================
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'chk_inspection_status'
              AND conrelid = 'inspection_header'::regclass
        ) THEN
            ALTER TABLE inspection_header
            ADD CONSTRAINT chk_inspection_status
            CHECK (status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED'));
        END IF;
    END $$;

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'chk_qa_status'
              AND conrelid = 'qa_sampling_header'::regclass
        ) THEN
            ALTER TABLE qa_sampling_header
            ADD CONSTRAINT chk_qa_status
            CHECK (status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED'));
        END IF;
    END $$;

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'chk_inspection_overall_result'
              AND conrelid = 'inspection_header'::regclass
        ) THEN
            ALTER TABLE inspection_header
            ADD CONSTRAINT chk_inspection_overall_result
            CHECK (overall_result IS NULL OR overall_result IN ('PASS','FAIL','N/A'));
        END IF;
    END $$;

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'chk_qa_overall_result'
              AND conrelid = 'qa_sampling_header'::regclass
        ) THEN
            ALTER TABLE qa_sampling_header
            ADD CONSTRAINT chk_qa_overall_result
            CHECK (overall_result IS NULL OR overall_result IN ('PASS','FAIL','N/A'));
        END IF;
    END $$;

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'chk_inspection_detail_result'
              AND conrelid = 'inspection_detail'::regclass
        ) THEN
            ALTER TABLE inspection_detail
            ADD CONSTRAINT chk_inspection_detail_result
            CHECK (result IS NULL OR result IN ('PASS','FAIL','N/A'));
        END IF;
    END $$;

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'chk_qa_detail_result'
              AND conrelid = 'qa_sample_detail'::regclass
        ) THEN
            ALTER TABLE qa_sample_detail
            ADD CONSTRAINT chk_qa_detail_result
            CHECK (result IS NULL OR result IN ('PASS','FAIL','N/A'));
        END IF;
    END $$;

  `);
};



/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    pgm.sql(`
    -- SQL สำหรับ rollback ถ้าจำเป็น
    -- ตอนนี้แนะนำให้เว้นว่างไว้ก่อน หรือใส่ comment
  `);
};
