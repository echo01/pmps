-- =========================================================
-- FULL UPDATED PRODUCTION / INSPECTION / QA DATABASE
-- PostgreSQL
-- FINAL VERSION AFTER ERROR FIX
-- =========================================================


-- =========================================================
-- DROP OLD TABLES (OPTIONAL)
-- =========================================================
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;


-- =========================================================
-- 1) PRODUCT CATEGORY
-- =========================================================
CREATE TABLE IF NOT EXISTS product_category (
    id SERIAL PRIMARY KEY,

    category_code VARCHAR(50) UNIQUE NOT NULL,
    category_name VARCHAR(150) NOT NULL,

    description TEXT,

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_category_code
ON product_category(category_code);


-- =========================================================
-- 2) PRODUCT SUB CATEGORY
-- =========================================================
CREATE TABLE IF NOT EXISTS product_sub_category (
    id SERIAL PRIMARY KEY,

    category_id INT NOT NULL,

    sub_category_code VARCHAR(50) UNIQUE NOT NULL,
    sub_category_name VARCHAR(150) NOT NULL,

    description TEXT,

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sub_category_category
        FOREIGN KEY (category_id)
        REFERENCES product_category(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_product_sub_category_code
ON product_sub_category(sub_category_code);


-- =========================================================
-- 3) PRODUCT MODEL
-- =========================================================
CREATE TABLE IF NOT EXISTS product_model (
    id SERIAL PRIMARY KEY,

    sub_category_id INT NOT NULL,

    model_code VARCHAR(100) UNIQUE NOT NULL,

    product_name VARCHAR(200) NOT NULL,

    model_name VARCHAR(200),

    description TEXT,

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_model_sub_category
        FOREIGN KEY (sub_category_id)
        REFERENCES product_sub_category(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_product_model_code
ON product_model(model_code);


-- =========================================================
-- 4) LOT
-- =========================================================
CREATE TABLE IF NOT EXISTS production_lot (
    id SERIAL PRIMARY KEY,

    model_id INT NOT NULL,

    lot_number VARCHAR(100) NOT NULL,

    production_date DATE,

    lot_qty INT,

    remark TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_lot_model
        FOREIGN KEY (model_id)
        REFERENCES product_model(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_production_lot_number
ON production_lot(lot_number);


-- =========================================================
-- 5) PRODUCT UNIT / SERIAL
-- =========================================================
CREATE TABLE IF NOT EXISTS product_unit (
    id SERIAL PRIMARY KEY,

    model_id INT NOT NULL,

    lot_id INT,

    serial_number VARCHAR(100) NOT NULL,

    product_status VARCHAR(50) DEFAULT 'NORMAL',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_unit_model
        FOREIGN KEY (model_id)
        REFERENCES product_model(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_product_unit_lot
        FOREIGN KEY (lot_id)
        REFERENCES production_lot(id)
        ON DELETE SET NULL,

    CONSTRAINT uq_product_serial
        UNIQUE(model_id, serial_number)
);

CREATE INDEX idx_product_unit_serial
ON product_unit(serial_number);


-- =========================================================
-- 6) USER
-- =========================================================
CREATE TABLE IF NOT EXISTS app_user (
    id SERIAL PRIMARY KEY,

    employee_code VARCHAR(50) UNIQUE,

    username VARCHAR(100) UNIQUE NOT NULL,

    -- Store password hash only. Do not store plain text password.
    password_hash TEXT,

    full_name VARCHAR(200) NOT NULL,

    department VARCHAR(100),

    email VARCHAR(200),

    active BOOLEAN DEFAULT TRUE,

    failed_login_count INT DEFAULT 0,

    locked_until TIMESTAMP,

    last_login_at TIMESTAMP,

    password_changed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_user_username
ON app_user(username);

CREATE INDEX IF NOT EXISTS idx_app_user_active
ON app_user(active);

CREATE INDEX IF NOT EXISTS idx_app_user_email
ON app_user(email);

-- Migration safe ALTER statements for existing databases created from an older schema.
ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS email VARCHAR(200);

ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS failed_login_count INT DEFAULT 0;

ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;

ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;


-- =========================================================
-- 7) ROLE
-- =========================================================
CREATE TABLE IF NOT EXISTS app_role (
    id SERIAL PRIMARY KEY,

    role_code VARCHAR(50) UNIQUE NOT NULL,

    role_name VARCHAR(150) NOT NULL
);


-- =========================================================
-- 8) USER ROLE
-- =========================================================
CREATE TABLE IF NOT EXISTS app_user_role (
    id SERIAL PRIMARY KEY,

    user_id INT NOT NULL,

    role_id INT NOT NULL,

    CONSTRAINT fk_user_role_user
        FOREIGN KEY (user_id)
        REFERENCES app_user(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_role_role
        FOREIGN KEY (role_id)
        REFERENCES app_role(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_user_role
        UNIQUE(user_id, role_id)
);

-- Migration safe block for existing databases where app_user_role was created
-- without UNIQUE(user_id, role_id). This is required for:
-- ON CONFLICT (user_id, role_id) DO NOTHING
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_user_role'
          AND conrelid = 'app_user_role'::regclass
    ) THEN
        ALTER TABLE app_user_role
        ADD CONSTRAINT uq_user_role UNIQUE(user_id, role_id);
    END IF;
END $$;

-- =========================================================
-- 8.1) USER LOGIN LOG
-- เก็บประวัติการ Login สำเร็จ / ไม่สำเร็จ
-- =========================================================
CREATE TABLE IF NOT EXISTS user_login_log (
    id SERIAL PRIMARY KEY,

    user_id INT,

    username VARCHAR(100),

    login_success BOOLEAN NOT NULL,

    fail_reason TEXT,

    client_ip VARCHAR(100),

    machine_name VARCHAR(150),

    login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_login_log_user
        FOREIGN KEY (user_id)
        REFERENCES app_user(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_login_log_user
ON user_login_log(user_id);

CREATE INDEX IF NOT EXISTS idx_user_login_log_username
ON user_login_log(username);

CREATE INDEX IF NOT EXISTS idx_user_login_log_at
ON user_login_log(login_at);


-- =========================================================
-- 8.2) APPROVAL LOG
-- เก็บประวัติ Submit / Review / Approve / Reject ของ QC และ QA
-- source_type = QC หรือ QA
-- source_id   = inspection_header.id หรือ qa_sampling_header.id
-- =========================================================
CREATE TABLE IF NOT EXISTS approval_log (
    id SERIAL PRIMARY KEY,

    source_type VARCHAR(30) NOT NULL,

    source_id INT NOT NULL,

    action VARCHAR(50) NOT NULL,

    old_status VARCHAR(30),

    new_status VARCHAR(30),

    action_by INT NOT NULL,

    action_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    remark TEXT,

    CONSTRAINT fk_approval_log_user
        FOREIGN KEY (action_by)
        REFERENCES app_user(id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_approval_log_source
ON approval_log(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_approval_log_action_by
ON approval_log(action_by);

CREATE INDEX IF NOT EXISTS idx_approval_log_datetime
ON approval_log(action_datetime);


-- =========================================================
-- 8.3) TEST RESULT EDIT LOG
-- เก็บประวัติการแก้ไขผลทดสอบ QC / QA
-- source_type = QC หรือ QA
-- header_id   = inspection_header.id หรือ qa_sampling_header.id
-- detail_id   = inspection_detail.id หรือ qa_sample_detail.id
-- =========================================================
CREATE TABLE IF NOT EXISTS test_result_edit_log (
    id SERIAL PRIMARY KEY,

    source_type VARCHAR(30) NOT NULL,

    header_id INT NOT NULL,

    detail_id INT,

    field_name VARCHAR(100),

    old_value TEXT,

    new_value TEXT,

    edited_by INT NOT NULL,

    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    reason TEXT,

    CONSTRAINT fk_test_result_edit_log_user
        FOREIGN KEY (edited_by)
        REFERENCES app_user(id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_test_result_edit_log_source
ON test_result_edit_log(source_type, header_id);

CREATE INDEX IF NOT EXISTS idx_test_result_edit_log_detail
ON test_result_edit_log(detail_id);

CREATE INDEX IF NOT EXISTS idx_test_result_edit_log_user
ON test_result_edit_log(edited_by);


-- =========================================================
-- 8.4) API REQUEST LOG
-- เก็บ Log การเรียก API จาก Software Application ภายนอก
-- =========================================================
CREATE TABLE IF NOT EXISTS api_request_log (
    id SERIAL PRIMARY KEY,

    endpoint VARCHAR(200),

    method VARCHAR(20),

    request_body TEXT,

    response_body TEXT,

    status_code INT,

    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    client_ip VARCHAR(100),

    success BOOLEAN,

    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_request_log_endpoint
ON api_request_log(endpoint);

CREATE INDEX IF NOT EXISTS idx_api_request_log_requested_at
ON api_request_log(requested_at);

CREATE INDEX IF NOT EXISTS idx_api_request_log_success
ON api_request_log(success);



-- =========================================================
-- INSERT ROLE MASTER
-- =========================================================
INSERT INTO app_role (role_code, role_name)
VALUES
('ADMIN', 'System Administrator'),
('INSPECTION_OPERATOR', 'Inspection Operator'),
('INSPECTION_REVIEWER', 'Inspection Reviewer'),
('INSPECTION_APPROVER', 'Inspection Approver'),
('QA_OPERATOR', 'QA Operator'),
('QA_REVIEWER', 'QA Reviewer'),
('QA_APPROVER', 'QA Approver'),
('VIEWER', 'Viewer')
ON CONFLICT (role_code) DO UPDATE
SET role_name = EXCLUDED.role_name;


-- =========================================================
-- 9) TEST TEMPLATE
-- =========================================================
CREATE TABLE IF NOT EXISTS test_template (
    id SERIAL PRIMARY KEY,

    model_id INT NOT NULL,

    template_type VARCHAR(30) NOT NULL,

    template_name VARCHAR(200) NOT NULL,

    revision VARCHAR(50) DEFAULT 'REV.00',

    revision_note TEXT,

    effective_from DATE DEFAULT CURRENT_DATE,

    effective_to DATE,

    active BOOLEAN DEFAULT TRUE,

    created_by INT,

    approved_by INT,

    approved_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_template_model
        FOREIGN KEY (model_id)
        REFERENCES product_model(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 10) TEST TEMPLATE SECTION
-- =========================================================
CREATE TABLE IF NOT EXISTS test_template_section (
    id SERIAL PRIMARY KEY,

    template_id INT NOT NULL,

    seq_no INT NOT NULL,

    section_code VARCHAR(100),

    section_name VARCHAR(200),

    CONSTRAINT fk_template_section_template
        FOREIGN KEY (template_id)
        REFERENCES test_template(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 11) TEST TEMPLATE ITEM
-- =========================================================
CREATE TABLE IF NOT EXISTS test_template_item (
    id SERIAL PRIMARY KEY,

    template_id INT NOT NULL,

    section_id INT,

    seq_no INT NOT NULL,

    item_code VARCHAR(100),

    test_point VARCHAR(150) NOT NULL,

    test_description TEXT,

    channel_name VARCHAR(50),

    input_name VARCHAR(100),

    input_value NUMERIC,

    input_unit VARCHAR(30),

    source_name VARCHAR(100),

    source_value NUMERIC,

    source_unit VARCHAR(30),

    expect_value NUMERIC,

    expect_text VARCHAR(200),

    spec_min NUMERIC,

    spec_max NUMERIC,

    check_type VARCHAR(30) DEFAULT 'NUMERIC',

    decimal_place INT,

    mandatory BOOLEAN DEFAULT TRUE,

    active BOOLEAN DEFAULT TRUE,

    remark TEXT,

    CONSTRAINT fk_item_template
        FOREIGN KEY (template_id)
        REFERENCES test_template(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_item_section
        FOREIGN KEY (section_id)
        REFERENCES test_template_section(id)
        ON DELETE SET NULL
);


-- =========================================================
-- 12) INSPECTION HEADER
-- =========================================================
CREATE TABLE IF NOT EXISTS inspection_header (
    id SERIAL PRIMARY KEY,

    product_unit_id INT NOT NULL,

    template_id INT NOT NULL,

    inspection_no INT NOT NULL DEFAULT 1,

    inspection_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    operator_user_id INT,

    reviewer_user_id INT,

    approver_user_id INT,

    reviewed_at TIMESTAMP,

    approved_at TIMESTAMP,

    station_name VARCHAR(100),

    overall_result VARCHAR(30),

    status VARCHAR(30) DEFAULT 'DRAFT',

    remark TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_inspection_product_unit
        FOREIGN KEY (product_unit_id)
        REFERENCES product_unit(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_inspection_template
        FOREIGN KEY (template_id)
        REFERENCES test_template(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inspection_operator
        FOREIGN KEY (operator_user_id)
        REFERENCES app_user(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_inspection_reviewer
        FOREIGN KEY (reviewer_user_id)
        REFERENCES app_user(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_inspection_approver
        FOREIGN KEY (approver_user_id)
        REFERENCES app_user(id)
        ON DELETE SET NULL
);


-- =========================================================
-- 13) INSPECTION DETAIL
-- =========================================================
CREATE TABLE IF NOT EXISTS inspection_detail (
    id SERIAL PRIMARY KEY,

    inspection_id INT NOT NULL,

    template_item_id INT NOT NULL,

    measured_value NUMERIC,

    measured_text VARCHAR(200),

    percent_error NUMERIC,

    result VARCHAR(30),

    remark TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_inspection_detail_header
        FOREIGN KEY (inspection_id)
        REFERENCES inspection_header(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_inspection_detail_item
        FOREIGN KEY (template_item_id)
        REFERENCES test_template_item(id)
        ON DELETE RESTRICT
);


-- =========================================================
-- 14) QA SAMPLING HEADER
-- =========================================================
CREATE TABLE IF NOT EXISTS qa_sampling_header (
    id SERIAL PRIMARY KEY,

    lot_id INT NOT NULL,

    template_id INT NOT NULL,

    sampling_round INT NOT NULL DEFAULT 1,

    sampling_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    lot_qty INT,

    sample_qty INT,

    accept_qty INT DEFAULT 0,

    reject_qty INT DEFAULT 0,

    qa_operator_user_id INT,

    qa_reviewer_user_id INT,

    qa_approver_user_id INT,

    reviewed_at TIMESTAMP,

    approved_at TIMESTAMP,

    overall_result VARCHAR(30),

    status VARCHAR(30) DEFAULT 'DRAFT',

    remark TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_qa_lot
        FOREIGN KEY (lot_id)
        REFERENCES production_lot(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_qa_template
        FOREIGN KEY (template_id)
        REFERENCES test_template(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_qa_operator
        FOREIGN KEY (qa_operator_user_id)
        REFERENCES app_user(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_qa_reviewer
        FOREIGN KEY (qa_reviewer_user_id)
        REFERENCES app_user(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_qa_approver
        FOREIGN KEY (qa_approver_user_id)
        REFERENCES app_user(id)
        ON DELETE SET NULL
);


-- =========================================================
-- 15) QA SAMPLE UNIT
-- =========================================================
CREATE TABLE IF NOT EXISTS qa_sample_unit (
    id SERIAL PRIMARY KEY,

    qa_sampling_id INT NOT NULL,

    product_unit_id INT,

    sample_no INT NOT NULL,

    serial_number VARCHAR(100),

    unit_result VARCHAR(30),

    remark TEXT,

    CONSTRAINT fk_qa_sample_header
        FOREIGN KEY (qa_sampling_id)
        REFERENCES qa_sampling_header(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 16) QA SAMPLE DETAIL
-- =========================================================
CREATE TABLE IF NOT EXISTS qa_sample_detail (
    id SERIAL PRIMARY KEY,

    qa_sample_unit_id INT NOT NULL,

    template_item_id INT NOT NULL,

    measured_value NUMERIC,

    measured_text VARCHAR(200),

    percent_error NUMERIC,

    result VARCHAR(30),

    remark TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_qa_detail_sample_unit
        FOREIGN KEY (qa_sample_unit_id)
        REFERENCES qa_sample_unit(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 17) ECN MASTER
-- =========================================================
CREATE TABLE IF NOT EXISTS ecn_master (
    id SERIAL PRIMARY KEY,

    ecn_no VARCHAR(64) UNIQUE NOT NULL,

    ecn_title VARCHAR(200),

    ecn_note TEXT,

    revision VARCHAR(50),

    issue_date DATE,

    effective_date DATE,

    created_by INT,

    approved_by INT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 18) LOT ECN REF
-- =========================================================
CREATE TABLE IF NOT EXISTS lot_ecn_ref (
    id SERIAL PRIMARY KEY,

    lot_id INT NOT NULL,

    ecn_id INT NOT NULL,

    applied_note TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_lot_ecn_lot
        FOREIGN KEY (lot_id)
        REFERENCES production_lot(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_lot_ecn_ecn
        FOREIGN KEY (ecn_id)
        REFERENCES ecn_master(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 19) DOCUMENT TYPE
-- =========================================================
CREATE TABLE IF NOT EXISTS document_type (
    id SERIAL PRIMARY KEY,

    doc_type_code VARCHAR(50) UNIQUE NOT NULL,

    doc_type_name VARCHAR(100) NOT NULL,

    description TEXT
);


-- =========================================================
-- 20) DOCUMENT MASTER
-- =========================================================
CREATE TABLE IF NOT EXISTS document_master (
    id SERIAL PRIMARY KEY,

    model_id INT,

    doc_type_id INT NOT NULL,

    document_no VARCHAR(100) NOT NULL,

    document_name VARCHAR(255) NOT NULL,

    revision VARCHAR(50),

    version_no VARCHAR(50),

    file_name VARCHAR(255),

    file_path TEXT,

    file_extension VARCHAR(20),

    file_size BIGINT,

    checksum_md5 VARCHAR(64),

    description TEXT,

    effective_date DATE,

    expire_date DATE,

    active BOOLEAN DEFAULT TRUE,

    created_by INT,

    approved_by INT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    approved_at TIMESTAMP,

    CONSTRAINT fk_doc_model
        FOREIGN KEY (model_id)
        REFERENCES product_model(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_doc_type
        FOREIGN KEY (doc_type_id)
        REFERENCES document_type(id)
        ON DELETE RESTRICT
);


-- =========================================================
-- 21) ECN DOCUMENT REF
-- =========================================================
CREATE TABLE IF NOT EXISTS ecn_document_ref (
    id SERIAL PRIMARY KEY,

    ecn_id INT NOT NULL,

    document_id INT NOT NULL,

    change_note TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ecn_doc_ecn
        FOREIGN KEY (ecn_id)
        REFERENCES ecn_master(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ecn_doc_document
        FOREIGN KEY (document_id)
        REFERENCES document_master(id)
        ON DELETE CASCADE
);




-- =========================================================
-- 23) EQUIPMENT TYPE MASTER
-- =========================================================
CREATE TABLE IF NOT EXISTS equipment_type_master (
    id SERIAL PRIMARY KEY,

    type_code VARCHAR(50) UNIQUE NOT NULL,
    type_name VARCHAR(100) NOT NULL,

    description TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipment_type_code
ON equipment_type_master(type_code);


-- =========================================================
-- 24) EQUIPMENT MASTER
-- เครื่องมือทดสอบ / เครื่องมือวัด / Fixture
-- =========================================================
CREATE TABLE IF NOT EXISTS equipment_master (
    id SERIAL PRIMARY KEY,

    equipment_code VARCHAR(100) UNIQUE NOT NULL,
    equipment_name VARCHAR(200) NOT NULL,

    equipment_type_id INT,

    brand VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100),

    calibration_no VARCHAR(100),
    calibration_date DATE,
    calibration_due_date DATE,

    status VARCHAR(30) DEFAULT 'ACTIVE',

    location_name VARCHAR(100),
    asset_no VARCHAR(100),

    remark TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_equipment_type
        FOREIGN KEY (equipment_type_id)
        REFERENCES equipment_type_master(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_equipment_code
ON equipment_master(equipment_code);

CREATE INDEX IF NOT EXISTS idx_equipment_serial
ON equipment_master(serial_number);

CREATE INDEX IF NOT EXISTS idx_equipment_status
ON equipment_master(status);

CREATE INDEX IF NOT EXISTS idx_equipment_calibration_due
ON equipment_master(calibration_due_date);


-- =========================================================
-- 25) INSPECTION EQUIPMENT
-- เครื่องมือที่ใช้ใน QC / Inspection
-- =========================================================
CREATE TABLE IF NOT EXISTS inspection_equipment (
    id SERIAL PRIMARY KEY,

    inspection_id INT NOT NULL,
    equipment_id INT NOT NULL,

    usage_note TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_inspection_equipment_header
        FOREIGN KEY (inspection_id)
        REFERENCES inspection_header(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_inspection_equipment_master
        FOREIGN KEY (equipment_id)
        REFERENCES equipment_master(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_inspection_equipment
        UNIQUE (inspection_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_inspection_equipment_inspection
ON inspection_equipment(inspection_id);

CREATE INDEX IF NOT EXISTS idx_inspection_equipment_equipment
ON inspection_equipment(equipment_id);


-- =========================================================
-- 26) QA SAMPLING EQUIPMENT
-- เครื่องมือที่ใช้ใน QA Sampling
-- =========================================================
CREATE TABLE IF NOT EXISTS qa_sampling_equipment (
    id SERIAL PRIMARY KEY,

    qa_sampling_id INT NOT NULL,
    equipment_id INT NOT NULL,

    usage_note TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_qa_sampling_equipment_header
        FOREIGN KEY (qa_sampling_id)
        REFERENCES qa_sampling_header(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_qa_sampling_equipment_master
        FOREIGN KEY (equipment_id)
        REFERENCES equipment_master(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_qa_sampling_equipment
        UNIQUE (qa_sampling_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_qa_sampling_equipment_header
ON qa_sampling_equipment(qa_sampling_id);

CREATE INDEX IF NOT EXISTS idx_qa_sampling_equipment_equipment
ON qa_sampling_equipment(equipment_id);


-- =========================================================
-- 27) MODEL REQUIRED EQUIPMENT
-- เครื่องมือมาตรฐานที่แต่ละ Product Model ต้องใช้
-- =========================================================
CREATE TABLE IF NOT EXISTS model_required_equipment (
    id SERIAL PRIMARY KEY,

    model_id INT NOT NULL,
    equipment_type_id INT NOT NULL,

    required_qty INT DEFAULT 1,
    mandatory BOOLEAN DEFAULT TRUE,

    remark TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_model_required_equipment_model
        FOREIGN KEY (model_id)
        REFERENCES product_model(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_model_required_equipment_type
        FOREIGN KEY (equipment_type_id)
        REFERENCES equipment_type_master(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_model_required_equipment
        UNIQUE (model_id, equipment_type_id)
);

CREATE INDEX IF NOT EXISTS idx_model_required_equipment_model
ON model_required_equipment(model_id);

CREATE INDEX IF NOT EXISTS idx_model_required_equipment_type
ON model_required_equipment(equipment_type_id);


-- =========================================================
-- 28) INSERT EQUIPMENT TYPE MASTER
-- =========================================================
INSERT INTO equipment_type_master
(type_code, type_name, description)
VALUES
('DMM', 'Digital Multimeter', 'Digital Multimeter'),
('OSC', 'Oscilloscope', 'Oscilloscope'),
('PSU', 'Power Supply', 'DC Power Supply'),
('TEMP', 'Temperature Chamber', 'Temperature Chamber'),
('FIXTURE', 'Test Fixture', 'Production Test Fixture'),
('HIPOT', 'HiPot Tester', 'High Voltage Tester'),
('LOAD', 'Electronic Load', 'Electronic Load'),
('PLC', 'PLC Test System', 'PLC Testing System'),
('SIGNAL_GEN', 'Signal Generator', 'Signal Generator'),
('CALIBRATOR', 'Process Calibrator', 'Process Calibrator')
ON CONFLICT (type_code) DO NOTHING;


-- =========================================================
-- 22) INSERT DOCUMENT TYPE MASTER
-- =========================================================
INSERT INTO document_type
(doc_type_code, doc_type_name)
VALUES

('ECN_PDF', 'ECN PDF'),
('DRAWING', 'Mechanical Drawing'),
('PCB', 'PCB Layout'),
('BOM', 'Bill Of Material'),
('FIRMWARE', 'Firmware'),
('USER_MANUAL', 'User Manual'),
('STICKER', 'Sticker Artwork'),
('DIAGRAM_LABEL', 'Diagram Label')

ON CONFLICT (doc_type_code) DO NOTHING;

-- =========================================================
-- OPTIONAL) CREATE / UPDATE ADMIN USER FOR TEST LOGIN
-- Username: admin
-- Password: Admin@123
-- Note: PostgreSQL password check example:
-- SELECT username, password_hash = crypt('Admin@123', password_hash) AS password_ok
-- FROM app_user WHERE username = 'admin';
-- =========================================================
-- Uncomment this block when you want to create default admin user.
/*
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO app_role (role_code, role_name)
VALUES ('ADMIN', 'System Administrator')
ON CONFLICT (role_code) DO UPDATE
SET role_name = EXCLUDED.role_name;

INSERT INTO app_user
(
    employee_code,
    username,
    password_hash,
    full_name,
    department,
    email,
    active,
    failed_login_count,
    locked_until,
    last_login_at,
    password_changed_at,
    created_at,
    updated_at
)
VALUES
(
    'ADMIN001',
    'admin',
    crypt('Admin@123', gen_salt('bf')),
    'System Administrator',
    'IT',
    'admin@example.com',
    TRUE,
    0,
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (username) DO UPDATE
SET
    employee_code = EXCLUDED.employee_code,
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    department = EXCLUDED.department,
    email = EXCLUDED.email,
    active = TRUE,
    failed_login_count = 0,
    locked_until = NULL,
    password_changed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO app_user_role (user_id, role_id)
SELECT u.id, r.id
FROM app_user u
JOIN app_role r ON r.role_code = 'ADMIN'
WHERE u.username = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;
*/
