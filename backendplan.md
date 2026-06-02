# Backend Plan — Production Inspection & QA Sampling Web Application

เอกสารนี้จัดทำจากการตรวจสอบร่วมกันระหว่าง

1. `full_production_inspection_qa_schema_with_equipment_updated_v2.sql`
2. `backend_development_guide.md`

วัตถุประสงค์ของเอกสารนี้คือ

1. ตรวจสอบว่าโครงสร้าง Database ปัจจุบันรองรับระบบ Production, QC Inspection, QA Sampling, Equipment Traceability, Approval, Report และ External API ได้ครบหรือไม่
2. ระบุรายการที่ควรเพิ่มเติมใน Database ก่อนเริ่มเขียน Backend
3. กำหนดแผนการพัฒนา Backend แบบเป็น Phase
4. กำหนดจุดทดสอบและแนวทาง Debug ในแต่ละ Phase

---

## 1. Executive Summary

จากการตรวจสอบ schema และ backend guide พบว่าโครงสร้าง Database หลักสามารถใช้เป็นฐานเริ่มต้นสำหรับพัฒนา Backend ด้วย Node.js ได้แล้ว โดยครอบคลุม module สำคัญ เช่น Product Master, Production Lot, Serial Number, User / Role, Test Template, QC Inspection, QA Sampling, Approval Log, Edit Result Audit Log, API Request Log และ Equipment Traceability

อย่างไรก็ตาม ก่อนเริ่มพัฒนา Backend จริง ควรปรับปรุง Database เพิ่มเติมในส่วนของ Unique Constraint, Foreign Key, Permission Table, API Key Table, Status Constraint และ Audit Field เพื่อให้ระบบมีความปลอดภัยด้านข้อมูล ลดปัญหาข้อมูลซ้ำ และช่วยให้การ Debug ทำได้ง่ายขึ้น

ลำดับการพัฒนาที่แนะนำคือ

```text
Phase 0  DB Hardening & Migration Baseline
Phase 1  Backend Foundation
Phase 2  Auth / User / Role / RBAC
Phase 3  Master Data
Phase 4  Production Lot / Serial / ECN
Phase 5  QC Inspection Core
Phase 6  QA Sampling Core
Phase 7  Approval Workflow Shared Service
Phase 8  Edit Result / Audit Log
Phase 9  Reports / Export
Phase 10 External API / API Request Log
```

---

# PART A — Database Review

## 2. Database Structure ที่มีแล้ว

### 2.1 Product Master

ตารางที่มีแล้ว

```text
product_category
product_sub_category
product_model
```

สถานะ: ครบสำหรับเริ่มต้น

รองรับการจัดกลุ่มสินค้าแบบ Category, Sub Category และ Product Model เหมาะสำหรับเชื่อมกับ Lot, Template, QC และ QA

---

### 2.2 Production Lot / Serial Number

ตารางที่มีแล้ว

```text
production_lot
product_unit
```

สถานะ: ครบพื้นฐาน แต่ควรเพิ่ม Unique Constraint ให้ Lot

จุดที่ดีใน schema:

```sql
UNIQUE(model_id, serial_number)
```

ในตาราง `product_unit` มี Unique Constraint เพื่อป้องกัน Serial Number ซ้ำใน Model เดียวกัน ซึ่งเหมาะกับระบบการผลิตจริง

สิ่งที่ควรเพิ่ม:

```sql
ALTER TABLE production_lot
ADD CONSTRAINT uq_production_lot_model_lot
UNIQUE (model_id, lot_number);
```

เหตุผล:

- ป้องกัน Lot Number ซ้ำใน Model เดียวกัน
- ลดปัญหาการสร้าง Lot ซ้ำจาก API retry
- ทำให้ Backend สามารถตอบ `409 Conflict` ได้ชัดเจน

---

### 2.3 User / Role / Login Log

ตารางที่มีแล้ว

```text
app_user
app_role
app_user_role
user_login_log
```

สถานะ: ครบพื้นฐานสำหรับ Authentication และ Role Management

จุดที่ดี:

- `app_user.username` เป็น Unique
- `app_role.role_code` เป็น Unique
- `app_user_role` มี Unique ระหว่าง `user_id` และ `role_id`
- มี `user_login_log` สำหรับเก็บประวัติ Login

สิ่งที่ควรเพิ่ม:

```text
app_permission
app_role_permission
```

เหตุผล:

ระบบ Backend มี requirement ระดับ Permission เช่น

```text
ProductMaster
EquipmentMaster
QCInspection
QASampling
ApproveQC
ApproveQA
SearchReport
EditTestResult
```

ถ้าตรวจสิทธิ์ด้วย Role อย่างเดียว จะขยายระบบยากในอนาคต จึงควรมี Permission Table เพื่อให้ RBAC ชัดเจนขึ้น

SQL แนะนำ:

```sql
CREATE TABLE IF NOT EXISTS app_permission (
    id SERIAL PRIMARY KEY,
    permission_code VARCHAR(100) UNIQUE NOT NULL,
    permission_name VARCHAR(150) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_role_permission (
    id SERIAL PRIMARY KEY,
    role_id INT NOT NULL REFERENCES app_role(id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES app_permission(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);
```

---

### 2.4 Equipment / Calibration / Required Equipment

ตารางที่มีแล้ว

```text
equipment_type_master
equipment_master
model_required_equipment
inspection_equipment
qa_sampling_equipment
```

สถานะ: ครบสำหรับ Equipment Traceability และ Calibration Validation

รองรับการทำงานต่อไปนี้

```text
- กำหนดประเภทเครื่องมือ
- บันทึกเครื่องมือจริง
- ตรวจวัน Calibration Due Date
- กำหนด Required Equipment ตาม Product Model
- ผูก Equipment กับ QC Inspection
- ผูก Equipment กับ QA Sampling
```

สิ่งที่ควรเพิ่มใน Backend Logic:

```text
1. ตรวจ equipment.status = ACTIVE
2. ตรวจ calibration_due_date >= CURRENT_DATE
3. ตรวจ required_qty ตาม model_required_equipment
4. ตรวจว่า equipment ที่เลือกตรงกับ equipment_type ที่ model ต้องการหรือไม่
```

---

### 2.5 Test Template

ตารางที่มีแล้ว

```text
test_template
test_template_section
test_template_item
```

สถานะ: ครบสำหรับ QC Template และ QA Template

รองรับการทำงานต่อไปนี้

```text
- Template Header
- Template Type เช่น INSPECTION / QA
- Revision
- Section
- Item
- Check Type เช่น NUMERIC / BOOLEAN / TEXT
- Spec Min / Spec Max
- Mandatory Item
```

สิ่งที่ควรตรวจใน Backend:

```text
- QC page ต้องเรียกเฉพาะ template_type = INSPECTION
- QA page ต้องเรียกเฉพาะ template_type = QA
- ต้องเรียง section.seq_no และ item.seq_no
- inactive template ต้องไม่ถูกใช้สร้าง QC/QA ใหม่
```

---

### 2.6 QC Inspection

ตารางที่มีแล้ว

```text
inspection_header
inspection_detail
inspection_equipment
```

สถานะ: ครบสำหรับ QC Inspection Core

รองรับการทำงานต่อไปนี้

```text
- บันทึก Header
- บันทึก Detail ตาม Template Item
- คำนวณ Result ราย Item
- คำนวณ Overall Result
- ผูก Equipment ที่ใช้ตรวจ
- Submit / Review / Approve / Reject
```

สิ่งที่ควรเพิ่ม:

```sql
ALTER TABLE inspection_header
ADD CONSTRAINT uq_inspection_unit_template_no
UNIQUE (product_unit_id, template_id, inspection_no);
```

เหตุผล:

- ป้องกันการตรวจซ้ำรอบเดิมใน Serial เดียวกัน
- ป้องกัน API retry ทำให้เกิดข้อมูลซ้ำ
- ช่วยให้ Backend ตรวจ duplicate แล้วตอบ `409 Conflict` ได้

---

### 2.7 QA Sampling

ตารางที่มีแล้ว

```text
qa_sampling_header
qa_sample_unit
qa_sample_detail
qa_sampling_equipment
```

สถานะ: เกือบครบ แต่ควรเพิ่ม Constraint สำคัญ

สิ่งที่ควรเพิ่ม:

#### 2.7.1 เพิ่ม Unique Constraint ให้ Sampling Round

```sql
ALTER TABLE qa_sampling_header
ADD CONSTRAINT uq_qa_sampling_lot_template_round
UNIQUE (lot_id, template_id, sampling_round);
```

เหตุผล:

- ป้องกัน Sampling Round ซ้ำใน Lot เดียวกัน
- ทำให้ API `latest-sampling` และ `update_mode` ทำงานง่ายขึ้น

#### 2.7.2 เพิ่ม Unique Constraint ให้ Sample Serial

```sql
ALTER TABLE qa_sample_unit
ADD CONSTRAINT uq_qa_sample_unit_serial_per_sampling
UNIQUE (qa_sampling_id, serial_number);
```

ถ้าใช้ `product_unit_id` เป็นตัวอ้างอิงหลัก แนะนำเพิ่มด้วย:

```sql
ALTER TABLE qa_sample_unit
ADD CONSTRAINT uq_qa_sample_unit_product_per_sampling
UNIQUE (qa_sampling_id, product_unit_id);
```

เหตุผล:

- ป้องกัน Serial ซ้ำใน Sampling Round เดียวกัน
- ตรงกับ requirement ที่ระบุว่า duplicate serial ต้อง reject ถ้า `update_mode=false`

#### 2.7.3 เพิ่ม Foreign Key ให้ `qa_sample_detail.template_item_id`

```sql
ALTER TABLE qa_sample_detail
ADD CONSTRAINT fk_qa_sample_detail_item
FOREIGN KEY (template_item_id)
REFERENCES test_template_item(id)
ON DELETE RESTRICT;
```

เหตุผล:

- ป้องกัน QA Detail อ้างอิง Template Item ที่ไม่มีอยู่จริง
- ทำให้ Data Integrity เทียบเท่ากับ QC Inspection Detail

#### 2.7.4 เพิ่ม Foreign Key ให้ `qa_sample_unit.product_unit_id`

```sql
ALTER TABLE qa_sample_unit
ADD CONSTRAINT fk_qa_sample_unit_product_unit
FOREIGN KEY (product_unit_id)
REFERENCES product_unit(id)
ON DELETE SET NULL;
```

เหตุผล:

- ช่วย Trace Serial กลับไปยัง Product Unit ได้
- ช่วย Report ระดับ Lot / Serial ได้แม่นยำขึ้น

---

### 2.8 Approval Log

ตารางที่มีแล้ว

```text
approval_log
```

สถานะ: ครบ

รองรับการบันทึกประวัติการทำงานต่อไปนี้

```text
Submit
Review
Approve
Reject
```

สิ่งที่ต้องบังคับใน Backend:

```text
- ทุก approval action ต้อง insert approval_log
- status update และ approval_log ต้องอยู่ใน transaction เดียวกัน
- ถ้า insert approval_log fail ต้อง rollback status update
```

---

### 2.9 Edit Result / Audit Log

ตารางที่มีแล้ว

```text
test_result_edit_log
```

สถานะ: ครบ

รองรับการเก็บประวัติการแก้ไขผลตรวจ เช่น

```text
- แก้ measured_value
- แก้ measured_text
- แก้ result
- แก้ remark
- เก็บ old_value / new_value
- เก็บ reason
- เก็บ edited_by
```

สิ่งที่ต้องบังคับใน Backend:

```text
- ต้องระบุ reason ทุกครั้งที่แก้ผล
- ต้อง compare old/new ก่อน update
- field ที่เปลี่ยนต้องเขียน log
- update detail และ insert log ต้องอยู่ใน transaction เดียวกัน
- หลังแก้ผลต้อง recalculate overall_result
```

---

### 2.10 API Request Log / External API

ตารางที่มีแล้ว

```text
api_request_log
```

สถานะ: มี log แล้ว แต่ควรเพิ่ม API Client Table

สิ่งที่ควรเพิ่ม:

```sql
CREATE TABLE IF NOT EXISTS external_api_client (
    id SERIAL PRIMARY KEY,
    client_code VARCHAR(100) UNIQUE NOT NULL,
    client_name VARCHAR(200) NOT NULL,
    api_key_hash TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    allowed_ip TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
);
```

เพิ่ม field ใน `api_request_log`:

```sql
ALTER TABLE api_request_log
ADD COLUMN IF NOT EXISTS api_client_id INT REFERENCES external_api_client(id) ON DELETE SET NULL;

ALTER TABLE api_request_log
ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
```

เหตุผล:

- External API ใช้ `X-API-KEY`
- ไม่ควรเก็บ API Key แบบ plain text
- ต้องรู้ว่า request มาจาก client ไหน
- request_id ช่วย trace console log กับ DB log ได้ง่าย

---

### 2.11 ECN / Document Master

ตารางที่มีแล้ว

```text
ecn_master
lot_ecn_ref
document_type
document_master
ecn_document_ref
```

สถานะ: ครบพื้นฐาน

รองรับการทำงานต่อไปนี้

```text
- ผูก ECN กับ Lot
- จัดเก็บเอกสาร เช่น PDF, Drawing, BOM, Firmware, Manual
- ผูกเอกสารกับ ECN
```

สิ่งที่ควรเพิ่มในอนาคต:

```text
- document_version
- file_checksum
- storage_provider เช่น LOCAL / S3 / NAS
- uploaded_by
- approved_document_flag
```

---

## 3. Database Gap Summary

| Priority | รายการที่ควรเพิ่ม | เหตุผล |
|---|---|---|
| High | Unique `(model_id, lot_number)` ใน `production_lot` | ป้องกัน Lot ซ้ำ |
| High | Unique `(product_unit_id, template_id, inspection_no)` ใน `inspection_header` | ป้องกัน QC รอบเดิมซ้ำ |
| High | Unique `(lot_id, template_id, sampling_round)` ใน `qa_sampling_header` | ป้องกัน QA Sampling Round ซ้ำ |
| High | Unique sample serial ใน `qa_sample_unit` | ป้องกัน Serial ซ้ำในรอบ Sampling |
| High | FK `qa_sample_detail.template_item_id` | ป้องกัน QA Detail อ้าง item ผิด |
| High | `external_api_client` | รองรับ X-API-KEY อย่างถูกต้อง |
| Medium | `app_permission`, `app_role_permission` | รองรับ RBAC ระดับ Permission |
| Medium | Check Constraint สำหรับ status/result | ป้องกันค่าผิด เช่น APROVED |
| Medium | `updated_at` ใน Master/Transaction Table | ช่วย Audit และ Debug |
| Medium | `request_id` ใน `api_request_log` | Trace log ง่ายขึ้น |
| Low | `user_refresh_token` | จำเป็นเมื่อเลือก JWT + Refresh Token |

---

## 4. Recommended DB Hardening SQL

```sql
-- 1) Unique Lot per Model
ALTER TABLE production_lot
ADD CONSTRAINT uq_production_lot_model_lot
UNIQUE (model_id, lot_number);

-- 2) Unique QC Inspection Round
ALTER TABLE inspection_header
ADD CONSTRAINT uq_inspection_unit_template_no
UNIQUE (product_unit_id, template_id, inspection_no);

-- 3) Unique QA Sampling Round
ALTER TABLE qa_sampling_header
ADD CONSTRAINT uq_qa_sampling_lot_template_round
UNIQUE (lot_id, template_id, sampling_round);

-- 4) Unique QA Sample Serial
ALTER TABLE qa_sample_unit
ADD CONSTRAINT uq_qa_sample_unit_serial_per_sampling
UNIQUE (qa_sampling_id, serial_number);

-- 5) Unique QA Sample Product Unit
ALTER TABLE qa_sample_unit
ADD CONSTRAINT uq_qa_sample_unit_product_per_sampling
UNIQUE (qa_sampling_id, product_unit_id);

-- 6) FK QA Detail Template Item
ALTER TABLE qa_sample_detail
ADD CONSTRAINT fk_qa_sample_detail_item
FOREIGN KEY (template_item_id)
REFERENCES test_template_item(id)
ON DELETE RESTRICT;

-- 7) FK QA Sample Unit Product Unit
ALTER TABLE qa_sample_unit
ADD CONSTRAINT fk_qa_sample_unit_product_unit
FOREIGN KEY (product_unit_id)
REFERENCES product_unit(id)
ON DELETE SET NULL;

-- 8) Permission Table
CREATE TABLE IF NOT EXISTS app_permission (
    id SERIAL PRIMARY KEY,
    permission_code VARCHAR(100) UNIQUE NOT NULL,
    permission_name VARCHAR(150) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_role_permission (
    id SERIAL PRIMARY KEY,
    role_id INT NOT NULL REFERENCES app_role(id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES app_permission(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- 9) External API Client
CREATE TABLE IF NOT EXISTS external_api_client (
    id SERIAL PRIMARY KEY,
    client_code VARCHAR(100) UNIQUE NOT NULL,
    client_name VARCHAR(200) NOT NULL,
    api_key_hash TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    allowed_ip TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
);

ALTER TABLE api_request_log
ADD COLUMN IF NOT EXISTS api_client_id INT REFERENCES external_api_client(id) ON DELETE SET NULL;

ALTER TABLE api_request_log
ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);

-- 10) Check Constraint for Status / Result
ALTER TABLE inspection_header
ADD CONSTRAINT chk_inspection_status
CHECK (status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED'));

ALTER TABLE qa_sampling_header
ADD CONSTRAINT chk_qa_status
CHECK (status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED'));

ALTER TABLE inspection_detail
ADD CONSTRAINT chk_inspection_detail_result
CHECK (result IN ('PASS','FAIL','N/A'));

ALTER TABLE qa_sample_detail
ADD CONSTRAINT chk_qa_detail_result
CHECK (result IN ('PASS','FAIL','N/A'));
```

หมายเหตุ: ก่อนเพิ่ม Constraint ต้องตรวจสอบข้อมูลเดิมก่อน ถ้ามีข้อมูลซ้ำหรือข้อมูลผิด Constraint จะเพิ่มไม่สำเร็จ

---

# PART B — Backend Development Architecture

## 5. Recommended Stack

```text
Runtime         : Node.js 20 LTS+
Language        : TypeScript
Framework       : Express.js หรือ Fastify
Database        : PostgreSQL
DB Driver       : pg
Validation      : zod
Password Hash   : bcrypt หรือ argon2
Auth            : HTTP-only Cookie Session หรือ JWT + Refresh Token
Logging         : pino หรือ console ในช่วง development
Testing         : vitest หรือ jest + supertest
API Doc         : OpenAPI / Swagger
Migration       : node-pg-migrate หรือ Knex Migration
```

---

## 6. Backend Folder Structure

```text
server/
  src/
    app.ts
    server.ts

    config/
      env.ts
      database.ts
      auth.ts

    db/
      pool.ts
      transaction.ts
      migrations/
      seeds/

    middlewares/
      auth.middleware.ts
      rbac.middleware.ts
      api-key.middleware.ts
      validate.middleware.ts
      request-log.middleware.ts
      error.middleware.ts

    modules/
      auth/
      users/
      roles/
      products/
      equipment/
      templates/
      production-lots/
      qc-inspections/
      qa-samplings/
      approvals/
      edit-results/
      reports/
      external-api/
      api-logs/

    shared/
      result-calculator.ts
      equipment-validator.ts
      status-workflow.ts
      permission-map.ts
      pagination.ts
      http-error.ts
      response.ts
      constants.ts

    types/
      express.d.ts
```

---

## 7. Module File Standard

ทุก Module ควรแยกไฟล์ตามนี้

```text
<module>.routes.ts       กำหนด endpoint และ middleware
<module>.controller.ts   รับ request / response
<module>.service.ts      business logic / transaction
<module>.repository.ts   SQL query เท่านั้น
<module>.schema.ts       zod validation schema
<module>.types.ts        TypeScript types
<module>.test.ts         unit หรือ integration test
```

กฎสำคัญ:

```text
- ห้ามเขียน SQL โดยตรงใน Controller
- Controller มีหน้าที่รับ request และส่ง response เท่านั้น
- Service ทำ business logic และ transaction
- Repository ทำ SQL query เท่านั้น
- ทุก API ต้อง validate input ด้วย zod
- ทุก API ต้องตรวจ auth และ permission ที่ Backend
```

---

## 8. Console Log Standard

ช่วง Development ให้ใช้ console log ตรวจ Flow ได้ง่าย แต่ห้าม log password, token, API key หรือข้อมูลลับ

Format มาตรฐาน:

```ts
console.info('[MODULE][ACTION][START]', { requestId, userId, payloadSummary });
console.info('[MODULE][ACTION][DB]', { requestId, query: 'insert_header', affectedRows });
console.info('[MODULE][ACTION][SUCCESS]', { requestId, resultId });
console.warn('[MODULE][ACTION][VALIDATION_FAIL]', { requestId, issues });
console.error('[MODULE][ACTION][ERROR]', { requestId, message: error.message });
```

ห้าม Log:

```text
- password
- password_hash
- JWT token
- refresh token
- X-API-KEY
- full request_body ของ External API ถ้ามีข้อมูลลับหรือขนาดใหญ่
```

---

# PART C — Development Phase Plan

## Phase 0 — DB Hardening & Migration Baseline

### Objective

ทำให้ Database พร้อมสำหรับการพัฒนา Backend และลดปัญหา Data Integrity ตั้งแต่ต้น

### Scope

```text
1. เพิ่ม Unique Constraint สำคัญ
2. เพิ่ม Foreign Key ที่ขาด
3. เพิ่ม Permission Table
4. เพิ่ม External API Client Table
5. เพิ่ม Check Constraint สำหรับ status/result
6. สร้าง Migration Baseline
7. สร้าง Seed Admin / Role / Permission
8. สร้าง Test Database สำหรับ Integration Test
```

### Main Files

```text
src/db/migrations/001_initial_schema.ts
src/db/migrations/002_db_hardening.ts
src/db/seeds/001_seed_admin.ts
src/db/seeds/002_seed_permissions.ts
src/db/seeds/003_seed_master_data.ts
```

### Test Point

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

```sql
SELECT conname, conrelid::regclass
FROM pg_constraint
WHERE conname LIKE 'uq_%'
ORDER BY conrelid::regclass::text;
```

```sql
SELECT username, active
FROM app_user
WHERE username = 'admin';
```

### Debug Log

```ts
console.info('[DB][MIGRATION][START]', { requestId });
console.info('[DB][MIGRATION][SUCCESS]', { requestId });
console.error('[DB][MIGRATION][ERROR]', { requestId, message: error.message });
console.info('[DB][SEED][SUCCESS]', { requestId, seedName });
```

### Done Criteria

```text
- Migration สำเร็จ
- Seed admin สำเร็จ
- มี role และ permission พื้นฐานครบ
- Constraint สำคัญถูกสร้างครบ
- รัน migration ซ้ำแล้วไม่พัง
```

---

## Phase 1 — Backend Foundation

### Objective

สร้างโครง Backend ให้พร้อมก่อนเริ่ม Module ธุรกิจ

### Scope

```text
1. Setup Node.js + TypeScript
2. Setup Express หรือ Fastify
3. Setup PostgreSQL Pool
4. Setup Environment Config
5. Setup Request ID Middleware
6. Setup Error Middleware
7. Setup Response Standard
8. Setup Transaction Wrapper
9. Setup Health Check API
```

### Main Files

```text
src/app.ts
src/server.ts
src/config/env.ts
src/db/pool.ts
src/db/transaction.ts
src/middlewares/request-id.middleware.ts
src/middlewares/error.middleware.ts
src/shared/response.ts
src/shared/http-error.ts
```

### API

```http
GET /api/health
```

### Test Command

```bash
curl http://localhost:3000/api/health
```

Expected Response:

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "db": "connected"
  },
  "meta": {
    "request_id": "REQ-001"
  }
}
```

### Debug Log

```ts
console.info('[APP][START]', { port, env });
console.info('[DB][CONNECT][SUCCESS]', { requestId });
console.error('[DB][CONNECT][ERROR]', { requestId, message: error.message });
```

### Done Criteria

```text
- GET /api/health ใช้งานได้
- Database connect สำเร็จ
- Error response format ตรง standard
- ทุก request มี requestId
- Transaction wrapper ใช้งานได้
```

---

## Phase 2 — Auth / User / Role / RBAC

### Objective

ทำระบบ Login และ Permission ให้เสร็จก่อนเปิด Module อื่น

### Scope

```text
1. Login
2. Logout
3. Me/Profile
4. Change Password
5. User CRUD
6. Role CRUD
7. Assign Role
8. Permission Mapping
9. RBAC Middleware
10. Login Log
```

### Main Files

```text
src/modules/auth/auth.routes.ts
src/modules/auth/auth.controller.ts
src/modules/auth/auth.service.ts
src/modules/auth/auth.repository.ts
src/modules/auth/auth.schema.ts

src/modules/users/users.routes.ts
src/modules/users/users.controller.ts
src/modules/users/users.service.ts
src/modules/users/users.repository.ts
src/modules/users/users.schema.ts

src/modules/roles/roles.routes.ts
src/modules/roles/roles.controller.ts
src/modules/roles/roles.service.ts
src/modules/roles/roles.repository.ts
src/modules/roles/roles.schema.ts

src/middlewares/auth.middleware.ts
src/middlewares/rbac.middleware.ts
src/shared/permission-map.ts
```

### API

```http
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/change-password

GET    /api/users
POST   /api/users
GET    /api/users/:id
PUT    /api/users/:id
PATCH  /api/users/:id/active
POST   /api/users/:id/password
GET    /api/users/:id/roles
PUT    /api/users/:id/roles

GET    /api/roles
POST   /api/roles
PUT    /api/roles/:id
```

### Test Command — Login Success

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'
```

### Test Command — Login Fail

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}'
```

### Test Command — Assign Role

```bash
curl -X PUT http://localhost:3000/api/users/1/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"role_codes":["INSPECTION_OPERATOR"]}'
```

### Debug Log

```ts
console.info('[AUTH][LOGIN][START]', { requestId, username });
console.info('[AUTH][LOGIN][USER_FOUND]', { requestId, userId, active });
console.warn('[AUTH][LOGIN][FAILED]', { requestId, username, reason: 'INVALID_CREDENTIALS' });
console.info('[AUTH][LOGIN][SUCCESS]', { requestId, userId, roles });

console.info('[USERS][CREATE][START]', { requestId, username, employee_code });
console.info('[USERS][CREATE][SUCCESS]', { requestId, userId });
console.info('[USERS][ROLES_REPLACE][START]', { requestId, userId, roleIds });
console.info('[USERS][ROLES_REPLACE][SUCCESS]', { requestId, userId, count: roleIds.length });
```

### Bug Check

```text
- password_hash ต้องไม่ถูกส่งกลับ
- inactive user ต้อง login ไม่ได้
- wrong password ต้องเพิ่ม failed_login_count
- login สำเร็จต้อง reset failed_login_count
- ต้อง insert user_login_log ทุกครั้ง
- VIEWER ต้องเข้า admin API ไม่ได้
- Unauthorized request ต้องได้ 401
- Forbidden request ต้องได้ 403
```

### Done Criteria

```text
- Login สำเร็จด้วย admin
- Wrong password ถูกบันทึกใน user_login_log
- password_hash ไม่ออกใน response
- User CRUD ใช้งานได้
- Role assignment ใช้ transaction
- RBAC middleware ทำงานถูกต้อง
```

---

## Phase 3 — Master Data

### Objective

ทำ API สำหรับข้อมูลตั้งต้นที่ QC/QA ต้องใช้

### Scope

```text
1. Product Category
2. Product Sub Category
3. Product Model
4. Equipment Type
5. Equipment Master
6. Calibration Status
7. Model Required Equipment
8. Test Template
9. Template Section
10. Template Item
```

### Main Files

```text
src/modules/products/*
src/modules/equipment/*
src/modules/templates/*
src/shared/equipment-validator.ts
```

### API

```http
GET    /api/product-categories
POST   /api/product-categories
PUT    /api/product-categories/:id
GET    /api/product-sub-categories
POST   /api/product-sub-categories
PUT    /api/product-sub-categories/:id
GET    /api/product-models
POST   /api/product-models
PUT    /api/product-models/:id
GET    /api/lookups/product-models

GET    /api/equipment-types
POST   /api/equipment-types
PUT    /api/equipment-types/:id
GET    /api/equipment
POST   /api/equipment
GET    /api/equipment/:id
PUT    /api/equipment/:id
GET    /api/model-required-equipment
POST   /api/model-required-equipment
PUT    /api/model-required-equipment/:id
GET    /api/models/:modelId/available-equipment
GET    /api/models/:modelId/required-equipment
GET    /api/equipment/expired-calibration

GET    /api/test-templates
POST   /api/test-templates
GET    /api/test-templates/:id
PUT    /api/test-templates/:id
GET    /api/test-templates/:templateId/sections
POST   /api/test-templates/:templateId/sections
PUT    /api/test-template-sections/:id
GET    /api/test-templates/:templateId/items
POST   /api/test-templates/:templateId/items
PUT    /api/test-template-items/:id
```

### Test Command — Create Product Model

```bash
curl -X POST http://localhost:3000/api/product-models \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"sub_category_id":1,"model_code":"CMA-003","product_name":"Air Control CMA-003","active":true}'
```

### Test Command — Create Equipment

```bash
curl -X POST http://localhost:3000/api/equipment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"equipment_code":"DMM-001","equipment_name":"Digital Multimeter 001","equipment_type_id":1,"calibration_due_date":"2026-12-31","status":"ACTIVE"}'
```

### Test Command — Expired Calibration

```bash
curl "http://localhost:3000/api/equipment?status=ACTIVE&calibration_status=EXPIRED" \
  -H "Authorization: Bearer <token>"
```

### Debug Log

```ts
console.info('[PRODUCT][MODEL_CREATE][START]', { requestId, model_code });
console.info('[PRODUCT][MODEL_CREATE][SUCCESS]', { requestId, modelId, model_code });
console.warn('[PRODUCT][MODEL_CREATE][DUPLICATE]', { requestId, model_code });

console.info('[EQUIPMENT][CREATE][START]', { requestId, equipment_code });
console.info('[EQUIPMENT][CREATE][SUCCESS]', { requestId, equipmentId });
console.info('[EQUIPMENT][CALIBRATION_CHECK][RESULT]', { requestId, expiredCount, warningCount });

console.info('[TEMPLATE][ITEM_CREATE][START]', { requestId, templateId, item_code, check_type });
console.info('[TEMPLATE][ITEM_CREATE][SUCCESS]', { requestId, templateItemId });
```

### Bug Check

```text
- model_code ซ้ำต้องได้ 409 Conflict
- active=false ต้องไม่แสดงใน lookup สำหรับสร้าง Lot
- equipment หมดอายุไม่ควรให้เลือกใน QC/QA
- template inactive ต้องไม่ถูกใช้สร้าง QC/QA ใหม่
- template item ต้องเรียงตาม section.seq_no และ item.seq_no
```

### Done Criteria

```text
- สร้าง Product Model ได้
- สร้าง Equipment ได้
- กำหนด Required Equipment ต่อ Model ได้
- สร้าง QC/QA Template ได้
- ตรวจ Calibration Status ได้
```

---

## Phase 4 — Production Lot / Serial / ECN

### Objective

ทำระบบสร้าง Lot พร้อม Serial Number และรองรับ ECN Mapping

### Scope

```text
1. Create Production Lot
2. Generate Serial Number
3. Import Serial Number
4. Link ECN to Lot
5. Current Lot Dashboard
```

### Main Files

```text
src/modules/production-lots/production-lots.routes.ts
src/modules/production-lots/production-lots.controller.ts
src/modules/production-lots/production-lots.service.ts
src/modules/production-lots/production-lots.repository.ts
src/modules/production-lots/production-lots.schema.ts
src/modules/production-lots/serial-generator.ts
```

### API

```http
GET    /api/production-lots
POST   /api/production-lots
GET    /api/production-lots/:id
PUT    /api/production-lots/:id
GET    /api/production-lots/:id/serials
POST   /api/production-lots/generate-serials
POST   /api/production-lots/:id/ecn
GET    /api/current-lots
```

### Transaction Required

```text
POST /api/production-lots ต้อง insert production_lot + product_unit + lot_ecn_ref ใน transaction เดียว
```

### Test Command

```bash
curl -X POST http://localhost:3000/api/production-lots \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "model_code":"CMA-003",
    "lot_number":"Assy/2601/0900",
    "production_date":"2026-05-20",
    "lot_qty":3,
    "serial_generation":{"prefix":"","start_number":69020200,"count":3,"padding":0},
    "remark":"Created from backend test"
  }'
```

### Debug Log

```ts
console.info('[LOT][CREATE][START]', { requestId, model_code, lot_number, lot_qty });
console.info('[LOT][SERIAL_GENERATE][RESULT]', { requestId, count, firstSerial, lastSerial });
console.info('[LOT][CREATE][SUCCESS]', { requestId, lotId, serialCount });
console.error('[LOT][CREATE][ROLLBACK]', { requestId, reason: error.message });
```

### Bug Check

```text
- duplicate lot_number ต้องได้ 409
- duplicate serial ใน model เดียวกันต้อง rollback ทั้ง lot
- lot_qty ต้องตรงกับจำนวน serial ที่สร้าง
- serial_generation.count ต้องตรงกับ lot_qty
- ECN ที่ไม่มีอยู่จริงต้อง reject
```

### Done Criteria

```text
- สร้าง production_lot ได้ 1 row
- สร้าง product_unit ได้ครบตาม lot_qty
- duplicate serial rollback ทั้ง transaction
- current lot dashboard แสดง lot ล่าสุดได้
```

---

## Phase 5 — QC Inspection Core

### Objective

ทำระบบ QC Inspection ตั้งแต่ Save Draft ถึง Approve

### Scope

```text
1. Select Lot / Serial
2. Load QC Template
3. Save Inspection Header
4. Save Inspection Detail
5. Link Equipment
6. Calculate Item Result
7. Calculate Overall Result
8. Submit / Review / Approve / Reject
```

### Main Files

```text
src/modules/qc-inspections/qc-inspections.routes.ts
src/modules/qc-inspections/qc-inspections.controller.ts
src/modules/qc-inspections/qc-inspections.service.ts
src/modules/qc-inspections/qc-inspections.repository.ts
src/modules/qc-inspections/qc-inspections.schema.ts
src/shared/result-calculator.ts
src/shared/equipment-validator.ts
src/shared/status-workflow.ts
```

### API

```http
GET    /api/qc/lots
GET    /api/qc/lots/:lotId/units
GET    /api/qc/models/:modelId/templates
GET    /api/qc/templates/:templateId/items
GET    /api/qc/inspections/:id
POST   /api/qc/inspections
PUT    /api/qc/inspections/:id
GET    /api/qc/inspections/:id/equipment-check
POST   /api/qc/inspections/:id/submit
POST   /api/qc/inspections/:id/review
POST   /api/qc/inspections/:id/approve
POST   /api/qc/inspections/:id/reject
```

### Test Command — Save QC

```bash
curl -X POST http://localhost:3000/api/qc/inspections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "product_unit_id":100,
    "template_id":5,
    "inspection_no":1,
    "operator_user_id":1,
    "station_name":"QC-STATION-01",
    "equipment_ids":[1],
    "items":[
      {"template_item_id":10,"measured_text":"OK"},
      {"template_item_id":11,"measured_value":25.6}
    ]
  }'
```

### Test Command — Approve QC

```bash
curl -X POST http://localhost:3000/api/qc/inspections/10/approve \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"remark":"Approved by backend test"}'
```

### Result Calculator Rule

```text
NUMERIC:
- measured_value ว่าง -> N/A
- measured_value < spec_min -> FAIL
- measured_value > spec_max -> FAIL
- otherwise PASS

BOOLEAN:
- OK / PASS / YES / TRUE -> PASS
- NG / FAIL / NO / FALSE -> FAIL
- ว่างหรือค่าอื่น -> N/A

TEXT:
- ว่าง -> N/A
- มีค่า -> PASS

Overall:
- พิจารณาเฉพาะ mandatory item
- มี FAIL อย่างน้อย 1 item -> FAIL
- ผ่านทั้งหมด -> PASS
- ไม่มี mandatory item -> N/A
```

### Debug Log

```ts
console.info('[QC][SAVE][START]', { requestId, product_unit_id, template_id, itemCount: items.length });
console.info('[QC][EQUIPMENT_VALIDATE][RESULT]', { requestId, valid, missingCount, expiredCount });
console.info('[QC][CALCULATE][OVERALL]', { requestId, overall_result });
console.info('[QC][SAVE][SUCCESS]', { requestId, inspectionId, overall_result });
console.info('[QC][APPROVE][SUCCESS]', { requestId, inspectionId, oldStatus, newStatus: 'APPROVED' });
```

### Bug Check

```text
- inspection_header.status เริ่มต้นต้องเป็น DRAFT
- inspection_detail ต้องถูกสร้างตามจำนวน item
- result ต้องคำนวณจาก test_template_item
- overall_result ต้องคำนวณจาก mandatory item
- equipment หมดอายุต้อง submit/approve ไม่ผ่าน
- approve ต้องทำได้เฉพาะ status REVIEWED
- approve สำเร็จต้อง update approved_at และ insert approval_log
```

### Done Criteria

```text
- QC บันทึกครบ header/detail/equipment
- คำนวณ result ถูกต้อง
- submit/review/approve/reject ทำงานตาม workflow
- expired equipment ถูก block
- approval_log ถูกเขียนทุก action
```

---

## Phase 6 — QA Sampling Core

### Objective

ทำระบบ QA Sampling ระดับ Lot และ Sample Serial

### Scope

```text
1. Select Lot
2. Select Sample Serial
3. Save QA Header
4. Save QA Sample Unit
5. Save QA Sample Detail
6. Link Equipment
7. Calculate Unit Result
8. Calculate Header Summary
9. Submit / Review / Approve / Reject
```

### Main Files

```text
src/modules/qa-samplings/qa-samplings.routes.ts
src/modules/qa-samplings/qa-samplings.controller.ts
src/modules/qa-samplings/qa-samplings.service.ts
src/modules/qa-samplings/qa-samplings.repository.ts
src/modules/qa-samplings/qa-samplings.schema.ts
src/shared/result-calculator.ts
src/shared/equipment-validator.ts
src/shared/status-workflow.ts
```

### API

```http
GET    /api/qa/lots
GET    /api/qa/lots/:lotId/units
GET    /api/qa/models/:modelId/templates
GET    /api/qa/templates/:templateId/items
GET    /api/qa/lots/:lotId/latest-sampling
GET    /api/qa/samplings/:id
POST   /api/qa/samplings
PUT    /api/qa/samplings/:id
GET    /api/qa/samplings/:id/equipment-check
POST   /api/qa/samplings/:id/submit
POST   /api/qa/samplings/:id/review
POST   /api/qa/samplings/:id/approve
POST   /api/qa/samplings/:id/reject
```

### Test Command

```bash
curl -X POST http://localhost:3000/api/qa/samplings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "lot_id":20,
    "template_id":7,
    "sampling_round":1,
    "qa_operator_user_id":1,
    "equipment_ids":[1],
    "samples":[
      {
        "product_unit_id":100,
        "serial_number":"69020200",
        "sample_no":1,
        "items":[
          {"template_item_id":50,"measured_value":10.5},
          {"template_item_id":51,"measured_value":19.9}
        ]
      }
    ]
  }'
```

### Debug Log

```ts
console.info('[QA][SAVE][START]', { requestId, lot_id, template_id, sampleCount: samples.length });
console.info('[QA][SERIAL_VALIDATE][RESULT]', { requestId, validSerialCount, invalidSerialCount });
console.info('[QA][CALCULATE][SUMMARY]', { requestId, sample_qty, accept_qty, reject_qty, overall_result });
console.info('[QA][SAVE][SUCCESS]', { requestId, qa_sampling_id, overall_result });
```

### Bug Check

```text
- qa_sampling_header ต้องถูกสร้างหรือ update ตาม lot/template/round
- qa_sample_unit ต้องถูกสร้างตาม sample
- qa_sample_detail ต้องถูกสร้างตาม item
- sample_qty / accept_qty / reject_qty ต้องถูก update
- duplicate serial ใน sampling round ต้อง reject ถ้า update_mode=false
- serial ที่ไม่อยู่ใน lot ต้อง reject
- equipment หมดอายุต้อง submit/approve ไม่ผ่าน
```

### Done Criteria

```text
- QA บันทึกครบ header/unit/detail/equipment
- คำนวณ sample result ถูกต้อง
- คำนวณ accept/reject summary ถูกต้อง
- duplicate sample ถูก block
- approval_log ถูกเขียนทุก action
```

---

## Phase 7 — Approval Workflow Shared Service

### Objective

แยก Approval Logic ให้ QC และ QA ใช้ร่วมกัน

### Scope

```text
1. Submit
2. Review
3. Approve
4. Reject
5. Validate Status Transition
6. Insert Approval Log
7. Rollback เมื่อ Log Insert Fail
```

### Main Files

```text
src/modules/approvals/approval.service.ts
src/modules/approvals/approval.repository.ts
src/shared/status-workflow.ts
```

### Status Workflow

```text
DRAFT      -> SUBMITTED
SUBMITTED  -> REVIEWED
REVIEWED   -> APPROVED
SUBMITTED  -> REJECTED
REVIEWED   -> REJECTED
REJECTED   -> DRAFT
```

### Test Scenario

```text
1. QC status DRAFT -> submit -> SUBMITTED
2. QC status SUBMITTED -> review -> REVIEWED
3. QC status REVIEWED -> approve -> APPROVED
4. QC status APPROVED -> approve อีกครั้ง -> 409
5. QA status SUBMITTED -> reject -> REJECTED
6. ทุก action ต้องมี approval_log 1 row
```

### Debug Log

```ts
console.info('[APPROVAL][ACTION][START]', { requestId, sourceType, sourceId, action, userId });
console.info('[APPROVAL][STATUS_CHECK]', { requestId, oldStatus, action, allowed });
console.info('[APPROVAL][SUCCESS]', { requestId, sourceType, sourceId, oldStatus, newStatus });
```

### Bug Check

```text
- status ไม่ถูกต้องต้องได้ 409
- user ไม่มี permission ต้องได้ 403
- approval_log insert fail ต้อง rollback status
- approve ต้องตรวจ equipment calibration อีกครั้ง
```

### Done Criteria

```text
- QC/QA ใช้ approval service เดียวกัน
- ทุก action มี approval_log
- status transition ถูกต้อง
- transaction rollback ถูกต้อง
```

---

## Phase 8 — Edit Result / Audit Log

### Objective

ทำระบบแก้ไขผลตรวจพร้อม Audit Log

### Scope

```text
1. Get QC Result for Edit
2. Get QA Result for Edit
3. Compare Old/New Value
4. Update Detail Result
5. Recalculate Item Result
6. Recalculate Overall Result
7. Insert test_result_edit_log
8. Permission Control for Approved Record
```

### Main Files

```text
src/modules/edit-results/edit-results.routes.ts
src/modules/edit-results/edit-results.controller.ts
src/modules/edit-results/edit-results.service.ts
src/modules/edit-results/edit-results.repository.ts
src/modules/edit-results/edit-results.schema.ts
```

### API

```http
GET  /api/edit-results/qc/:inspectionId
PUT  /api/edit-results/qc/:inspectionId
GET  /api/edit-results/qa/:qaSamplingId
PUT  /api/edit-results/qa/:qaSamplingId
```

### Test Command

```bash
curl -X PUT http://localhost:3000/api/edit-results/qc/10 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "reason":"Correct measured value after review",
    "items":[
      {"detail_id":123,"measured_value":25.6,"measured_text":null,"remark":"Corrected"}
    ]
  }'
```

### Debug Log

```ts
console.info('[EDIT_RESULT][QC][START]', { requestId, inspectionId, editedBy, itemCount });
console.info('[EDIT_RESULT][COMPARE]', { requestId, detailId, changedFields });
console.info('[EDIT_RESULT][LOG_INSERTED]', { requestId, logCount });
console.info('[EDIT_RESULT][SUCCESS]', { requestId, headerId, overall_result });
```

### Bug Check

```text
- reason ว่างต้อง reject
- field ที่เปลี่ยนต้องมี log แยก field
- ถ้า status APPROVED ต้องใช้ ADMIN หรือ authorized role
- overall_result ต้อง recalculate
- edit log insert fail ต้อง rollback detail update
```

### Done Criteria

```text
- แก้ผล QC ได้พร้อม audit log
- แก้ผล QA ได้พร้อม audit log
- compare old/new ถูกต้อง
- recalculate result ถูกต้อง
- transaction rollback ถูกต้อง
```

---

## Phase 9 — Reports / Export

### Objective

ทำ API รายงาน QC/QA และ Export

### Scope

```text
1. QC Search Report
2. QA Search Report
3. QC Detail Report
4. QA Detail Report
5. Approval History
6. Edit History
7. Equipment Traceability
8. Lot Summary
9. Export PDF
10. Export Excel
```

### Main Files

```text
src/modules/reports/reports.routes.ts
src/modules/reports/reports.controller.ts
src/modules/reports/reports.service.ts
src/modules/reports/reports.repository.ts
src/modules/reports/reports.schema.ts
src/shared/pagination.ts
```

### API

```http
GET /api/reports/qc
GET /api/reports/qa
GET /api/reports/qc/:inspectionId
GET /api/reports/qa/:qaSamplingId
GET /api/reports/lots/:lotId/summary
GET /api/reports/:sourceType/:sourceId/approval-history
GET /api/reports/:sourceType/:headerId/edit-history
GET /api/reports/qc/:inspectionId/export/pdf
GET /api/reports/qa/:qaSamplingId/export/pdf
GET /api/reports/qc/export/excel
GET /api/reports/qa/export/excel
```

### Test Command

```bash
curl "http://localhost:3000/api/reports/qc?model_code=CMA-003&lot_number=Assy%2F2601%2F0900" \
  -H "Authorization: Bearer <token>"
```

### Debug Log

```ts
console.info('[REPORT][QC_SEARCH][START]', { requestId, filters, page, pageSize });
console.info('[REPORT][QC_SEARCH][SUCCESS]', { requestId, total, returned: rows.length });
console.info('[REPORT][EXPORT][START]', { requestId, type: 'QC_PDF', inspectionId });
console.info('[REPORT][EXPORT][SUCCESS]', { requestId, fileName });
```

### Bug Check

```text
- lot_number ที่มี / ต้องรองรับ URL encoding
- report ต้องมี pagination
- filter date_from/date_to ต้องทำงานถูกต้อง
- equipment traceability ต้องแสดงได้
- QA summary ควรใช้ sample_result หรือ unit_result ไม่ใช่ header overall_result อย่างเดียว
```

### Done Criteria

```text
- Report filter ใช้งานได้
- Report detail แสดงครบ
- Approval history แสดงถูกต้อง
- Edit history แสดงถูกต้อง
- Export PDF/Excel ใช้งานได้
```

---

## Phase 10 — External API / API Request Log

### Objective

ทำ API สำหรับเครื่องทดสอบหรือ Software ภายนอก

### Scope

```text
1. API Key Middleware
2. External API Client Management
3. Log Request ทุกครั้ง
4. External QC Result API
5. External QA Result API
6. External Lot / Product / Template Lookup
7. API Request Log Viewer
```

### Main Files

```text
src/modules/external-api/external-api.routes.ts
src/modules/external-api/external-api.controller.ts
src/modules/external-api/external-api.service.ts
src/modules/external-api/external-api.repository.ts
src/modules/external-api/external-api.schema.ts
src/modules/api-logs/api-logs.routes.ts
src/modules/api-logs/api-logs.controller.ts
src/modules/api-logs/api-logs.service.ts
src/modules/api-logs/api-logs.repository.ts
src/middlewares/api-key.middleware.ts
src/middlewares/request-log.middleware.ts
```

### API

```http
GET  /api/health
GET  /api/lots/:lotNumber
GET  /api/products/:serialNumber
GET  /api/templates/qc/:modelCode
GET  /api/templates/qa/:modelCode
GET  /api/qc/setup/:lotNumber
POST /api/production-lots
POST /api/qc/result
POST /api/qa/result
GET  /api/api-logs
```

### Test Command

```bash
curl -X POST http://localhost:3000/api/qc/result \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your_api_key" \
  -d '{
    "model_code":"CMA-003",
    "lot_number":"Assy/2601/0900",
    "serial_number":"69020200",
    "station_name":"QC-STATION-01",
    "operator_username":"admin",
    "template_name":"CMA-003 QC Inspection",
    "equipment_codes":["DMM-001"],
    "update_mode":false,
    "items":[{"item_code":"QC001","measured_text":"OK"}]
  }'
```

### Debug Log

```ts
console.info('[EXT_API][REQUEST][START]', { requestId, endpoint, method, clientIp });
console.warn('[EXT_API][AUTH][FAILED]', { requestId, endpoint, clientIp });
console.info('[EXT_API][QC_RESULT][SUCCESS]', { requestId, inspectionId, overall_result });
console.info('[EXT_API][REQUEST_LOG][INSERTED]', { requestId, statusCode, success });
```

### Bug Check

```text
- invalid API key ต้องได้ 401
- valid API key ต้องสร้าง QC/QA result ได้
- api_request_log ต้องถูกเขียนทุก request ทั้ง success/fail
- ห้าม log X-API-KEY แบบ plain text
- duplicate result ถ้า update_mode=false ต้อง reject
- update_mode=true ต้อง update พร้อม audit log
```

### Done Criteria

```text
- External API ใช้งานได้
- API key validation ทำงานถูกต้อง
- Request log ถูกเขียนครบ
- QC/QA result จาก external system บันทึกได้
- API log viewer ใช้งานได้
```

---

# PART D — Testing Checklist

## 9. Unit Test Checklist

```text
- result calculator
- status workflow
- equipment validator
- permission mapper
- serial generator
- pagination helper
- response helper
```

---

## 10. Integration Test Checklist

```text
- login success
- login fail
- create user
- assign role
- create product model
- create equipment
- create test template
- create production lot
- duplicate serial rollback
- save QC
- submit QC
- review QC
- approve QC
- save QA
- submit QA
- review QA
- approve QA
- edit QC result
- edit QA result
- external API submit QC
- external API submit QA
```

---

## 11. Permission Test Checklist

```text
- VIEWER cannot create QC
- INSPECTION_OPERATOR cannot approve QC
- QA_OPERATOR cannot approve QA
- ADMIN can access all modules
- Unauthorized request returns 401
- Forbidden request returns 403
- External API requires X-API-KEY
```

---

## 12. Transaction Test Checklist

```text
- QC detail insert fail แล้ว header ต้อง rollback
- QA sample detail insert fail แล้ว header/unit ต้อง rollback
- approval_log insert fail แล้ว status ต้อง rollback
- edit log insert fail แล้ว detail update ต้อง rollback
- duplicate serial ตอนสร้าง lot ต้อง rollback lot ทั้งหมด
- duplicate sample serial ตอนสร้าง QA ต้อง rollback ทั้ง sampling
```

---

# PART E — Development Rules

## 13. Controller Rules

```text
- รับ request
- validate request ผ่าน middleware หรือ schema
- เรียก service
- ส่ง response
- ห้ามเขียน SQL ใน controller
- ห้ามมี business logic หนักใน controller
```

---

## 14. Service Rules

```text
- ทำ business logic
- ตรวจ permission เพิ่มเติมถ้าจำเป็น
- ใช้ transaction เมื่อมีหลาย table
- เรียก repository
- เรียก shared helper เช่น result-calculator, equipment-validator
- throw HttpError เมื่อมี business error
```

---

## 15. Repository Rules

```text
- ทำ SQL query เท่านั้น
- ไม่ควรรู้ business flow
- รับ client จาก transaction ได้
- return raw row หรือ mapped row
- ไม่ response HTTP จาก repository
```

---

## 16. Error Code Standard

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
DUPLICATE_LOT
DUPLICATE_SERIAL
DUPLICATE_QC_INSPECTION
DUPLICATE_QA_SAMPLE
INVALID_STATUS_TRANSITION
EQUIPMENT_REQUIRED
EQUIPMENT_EXPIRED
CALIBRATION_EXPIRED
TEMPLATE_NOT_FOUND
RESULT_EDIT_REASON_REQUIRED
EXTERNAL_API_KEY_INVALID
INTERNAL_ERROR
```

---

## 17. Common API Response Standard

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "meta": {
    "request_id": "REQ-001"
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Validation failed",
  "error_code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "lot_number",
      "message": "lot_number is required"
    }
  ],
  "meta": {
    "request_id": "REQ-001"
  }
}
```

---

# PART F — Final Recommendation

## 18. Development Order Recommendation

ควรพัฒนาตามลำดับนี้

```text
1. DB Hardening
2. Backend Foundation
3. Auth / RBAC
4. Master Data
5. Production Lot / Serial
6. QC Inspection
7. QA Sampling
8. Approval Shared Service
9. Edit Result / Audit Log
10. Reports / Export
11. External API
```

ไม่ควรเริ่มจาก QC/QA ทันที เพราะ QC/QA ต้องพึ่งพาข้อมูลจากหลายระบบ ได้แก่

```text
- User / Role / Permission
- Product Model
- Production Lot
- Product Unit / Serial
- Test Template
- Equipment
- Calibration
- Approval Workflow
- Audit Log
```

ถ้าพื้นฐานเหล่านี้ยังไม่พร้อม การ Debug QC/QA จะซับซ้อนมาก และมีโอกาสเกิด bug จากข้อมูลต้นทางมากกว่าตัว logic ของ QC/QA เอง

---

## 19. Minimum Backend Readiness Before QC/QA

ก่อนเริ่ม Phase QC/QA ควรมีสิ่งเหล่านี้พร้อมแล้ว

```text
- Login ใช้งานได้
- Permission ตรวจได้
- Product Model มีข้อมูล
- Production Lot และ Serial สร้างได้
- Equipment Master มีข้อมูล
- Calibration Due Date ตรวจได้
- Required Equipment ต่อ Model กำหนดได้
- Test Template พร้อม Section และ Item
- Transaction Wrapper ใช้งานได้
- Result Calculator ผ่าน Unit Test
- Equipment Validator ผ่าน Unit Test
- Status Workflow ผ่าน Unit Test
```

---

## 20. Summary

Database ปัจจุบันมีโครงสร้างหลักครบสำหรับระบบ Production Inspection และ QA Sampling แล้ว แต่ควรเพิ่ม constraint และ table บางส่วนก่อนเริ่มพัฒนา Backend จริง โดยเฉพาะส่วนที่เกี่ยวกับ duplicate prevention, QA foreign key, permission control และ external API key management

แนวทางพัฒนาที่แนะนำคือเริ่มจากการทำ Database ให้แข็งแรงก่อน จากนั้นสร้าง Backend Foundation, Auth/RBAC, Master Data และ Production Lot ให้เสร็จ จึงค่อยเข้าสู่ QC และ QA Core เพราะทั้งสอง module เป็น business flow ที่พึ่งพาข้อมูลหลายส่วนและต้องใช้ transaction หลายตาราง

ถ้าทำตาม phase plan นี้ ทีม Backend จะสามารถพัฒนา ตรวจสอบ และ Debug ได้เป็นระบบ ลดปัญหา bug จากข้อมูลไม่ครบหรือ flow ไม่ชัดเจน และสามารถส่งต่อ API contract ให้ทีม Frontend ทำงานคู่กันได้ง่ายขึ้น
