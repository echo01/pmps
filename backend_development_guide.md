# Backend Development Guide — Production Inspection & QA Sampling Web Application

เอกสารนี้ใช้สำหรับทีม Backend ในการพัฒนา Node.js Web Application สำหรับระบบ Production, QC Inspection, QA Sampling, Equipment Traceability, Report, User / Role / Approval และ External API Integration

> เอกสารที่เกี่ยวข้อง: `frontend_development_guide.md`  
> หลักการทำงานร่วมกัน: ทุก Module ต้องอ้างอิง `Integration Contract ID` เดียวกันระหว่าง Backend และ Frontend

---

## 1. Backend Development Objective

เป้าหมายของ Backend คือสร้าง API กลางสำหรับระบบผลิตและระบบคุณภาพ โดยต้องรองรับการทำงานต่อไปนี้

```text
1. Authentication / Authorization / RBAC
2. User / Role Management
3. Product Master
4. Equipment Master / Calibration Validation
5. Test Template
6. Production Lot / Serial Number
7. QC Inspection
8. QA Sampling
9. Approval Workflow
10. Edit Result / Audit Log
11. Reports / Export
12. External Integration API
13. API Request Log
```

Backend ต้องยึดหลักสำคัญดังนี้

```text
- ห้ามเขียน SQL โดยตรงใน Controller
- ต้องแยก Route / Controller / Service / Repository
- Operations ที่บันทึกหลาย Table ต้องใช้ Transaction
- ทุก API ต้องตรวจ Auth และ Permission ที่ Backend
- Submit / Review / Approve / Reject ต้องเขียน approval_log
- Edit Result ต้องเขียน test_result_edit_log
- External API ต้องเขียน api_request_log
- QC / QA ต้องตรวจ Equipment และ Calibration ก่อน Submit / Approve
```

---

## 2. Recommended Stack

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

## 3. Folder Structure

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

มาตรฐานในแต่ละ Module

```text
<module>.routes.ts       กำหนด endpoint และ middleware
<module>.controller.ts   รับ request / response
<module>.service.ts      business logic / transaction
<module>.repository.ts   SQL query เท่านั้น
<module>.schema.ts       zod validation schema
<module>.types.ts        TypeScript types
<module>.test.ts         unit หรือ integration test
```

---

## 4. Console Log Standard สำหรับ Development

ช่วงพัฒนาให้ทุก Module มี log ที่ตรวจสอบ Flow ได้ง่าย แต่ห้าม log password, token, API key หรือข้อมูลลับ

### 4.1 Log Format

```ts
console.info('[MODULE][ACTION][START]', { requestId, userId, payloadSummary });
console.info('[MODULE][ACTION][DB]', { requestId, query: 'insert_header', affectedRows });
console.info('[MODULE][ACTION][SUCCESS]', { requestId, resultId });
console.warn('[MODULE][ACTION][VALIDATION_FAIL]', { requestId, issues });
console.error('[MODULE][ACTION][ERROR]', { requestId, message: error.message });
```

### 4.2 ตัวอย่าง Log

```text
[AUTH][LOGIN][START] { requestId: 'REQ-001', username: 'admin' }
[AUTH][LOGIN][SUCCESS] { requestId: 'REQ-001', userId: 1, roles: ['ADMIN'] }

[QC][SAVE][START] { requestId: 'REQ-102', product_unit_id: 100, template_id: 5 }
[QC][SAVE][DB] { requestId: 'REQ-102', action: 'insert_inspection_header', inspection_id: 10 }
[QC][SAVE][SUCCESS] { requestId: 'REQ-102', inspection_id: 10, overall_result: 'PASS' }
```

### 4.3 ห้าม Log

```text
- password
- password_hash
- JWT token
- refresh token
- X-API-KEY
- full request_body ของ External API ถ้ามีข้อมูลขนาดใหญ่หรือข้อมูลลับ
```

---

## 5. Integration Contract ID

Backend และ Frontend ต้องใช้ Contract ID เดียวกันเพื่อแบ่งงานได้ชัดเจน

| Contract ID | Module | Backend Owner | Frontend Owner | Main Route / Page |
|---|---|---|---|---|
| C-AUTH-001 | Auth Login | Auth API | Login Page | `POST /api/auth/login` / `/login` |
| C-USER-001 | User Management | User API | User Admin Page | `/api/users` / `/admin/users` |
| C-ROLE-001 | Role Management | Role API | Role Admin Page | `/api/roles` / `/admin/roles` |
| C-PROD-001 | Product Master | Product API | Product Pages | `/api/product-*` / `/products/*` |
| C-EQ-001 | Equipment Master | Equipment API | Equipment Pages | `/api/equipment` / `/equipment/master` |
| C-EQ-002 | Model Required Equipment | Equipment API | Model Required Equipment Page | `/api/model-required-equipment` / `/equipment/model-required` |
| C-TPL-001 | Test Template | Template API | Template Page | `/api/test-templates` / `/templates` |
| C-LOT-001 | Production Lot | Production Lot API | Production Lot Page | `/api/production-lots` / `/production-lots` |
| C-DASH-001 | Current Lot Dashboard | Dashboard API | Dashboard Page | `/api/current-lots` / `/dashboard/current-lots` |
| C-QC-001 | QC Save | QC API | QC Inspection Page | `/api/qc/inspections` / `/qc/inspection` |
| C-QC-002 | QC Approval | Approval API | QC Action Buttons | `/api/qc/inspections/:id/*` / `/qc/inspection` |
| C-QA-001 | QA Save | QA API | QA Sampling Page | `/api/qa/samplings` / `/qa/sampling` |
| C-QA-002 | QA Approval | Approval API | QA Action Buttons | `/api/qa/samplings/:id/*` / `/qa/sampling` |
| C-RPT-001 | QC Report | Report API | QC Report Page | `/api/reports/qc` / `/reports/qc` |
| C-RPT-002 | QA Report | Report API | QA Report Page | `/api/reports/qa` / `/reports/qa` |
| C-EDIT-001 | Edit Result | Edit Result API | Edit Result Page | `/api/edit-results/*` / `/edit-results` |
| C-EXT-001 | External API | External API | API Setting Page | `/api/qc/result`, `/api/qa/result` / `/settings/api` |
| C-LOG-001 | API Request Log | API Log API | API Log Viewer | `/api/api-logs` / `/settings/api` |

---

## 6. Common API Response Standard

ทุก API ควรตอบกลับด้วยรูปแบบเดียวกัน

### 6.1 Success Response

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

### 6.2 Error Response

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

### 6.3 HTTP Status Code

```text
200 OK                 อ่านข้อมูล / update สำเร็จ
201 Created            สร้างข้อมูลสำเร็จ
400 Bad Request        request ไม่ถูกต้อง
401 Unauthorized       ยังไม่ login หรือ token ไม่ถูกต้อง
403 Forbidden          ไม่มีสิทธิ์
404 Not Found          ไม่พบข้อมูล
409 Conflict           duplicate หรือสถานะไม่อนุญาต
422 Unprocessable      business validation ไม่ผ่าน
500 Internal Error     server error
```

---

## 7. Shared Backend Components

### 7.1 Transaction Wrapper

```ts
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### 7.2 Result Calculator

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

### 7.3 Status Workflow

```text
DRAFT      -> SUBMITTED
SUBMITTED  -> REVIEWED
REVIEWED   -> APPROVED
SUBMITTED  -> REJECTED
REVIEWED   -> REJECTED
REJECTED   -> DRAFT
```

### 7.4 Equipment Validator

```text
1. ตรวจ model_required_equipment
2. ตรวจ required_qty
3. ตรวจ equipment.status = ACTIVE
4. ตรวจ calibration_due_date >= CURRENT_DATE
5. ตรวจว่า equipment ถูกผูกกับ inspection_header หรือ qa_sampling_header แล้ว
```

---

# PART A — Backend Modules

---

## Module B01 — Auth

### Contract ID

```text
C-AUTH-001
```

### Scope

```text
- Login
- Logout
- Me/Profile
- Change Password
- Refresh Token ถ้าเลือกใช้ JWT
- Login Log
```

### Database

```text
app_user
app_role
app_user_role
user_login_log
user_refresh_token optional
```

### API

```http
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/change-password
POST /api/auth/refresh-token
```

### Backend Files

```text
modules/auth/auth.routes.ts
modules/auth/auth.controller.ts
modules/auth/auth.service.ts
modules/auth/auth.repository.ts
modules/auth/auth.schema.ts
```

### Console Log

```ts
console.info('[AUTH][LOGIN][START]', { requestId, username });
console.info('[AUTH][LOGIN][USER_FOUND]', { requestId, userId, active });
console.warn('[AUTH][LOGIN][FAILED]', { requestId, username, reason: 'INVALID_CREDENTIALS' });
console.info('[AUTH][LOGIN][SUCCESS]', { requestId, userId, roles });
```

### Test Concept

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'
```

Expected

```json
{
  "success": true,
  "data": {
    "user": {
      "username": "admin",
      "roles": ["ADMIN"]
    }
  }
}
```

### Bug Check

```text
- password_hash ต้องไม่ถูกส่งกลับ
- inactive user ต้อง login ไม่ได้
- wrong password ต้องเพิ่ม failed_login_count
- login สำเร็จต้อง reset failed_login_count
- ต้อง insert user_login_log ทุกครั้ง
```

---

## Module B02 — User / Role Management

### Contract ID

```text
C-USER-001
C-ROLE-001
```

### Scope

```text
- Create / Edit User
- Activate / Deactivate User
- Reset Password
- Assign Roles
- List Roles
```

### Database

```text
app_user
app_role
app_user_role
```

### API

```http
GET    /api/users?search=&active=
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

### Console Log

```ts
console.info('[USERS][CREATE][START]', { requestId, username, employee_code });
console.info('[USERS][CREATE][SUCCESS]', { requestId, userId });
console.info('[USERS][ROLES_REPLACE][START]', { requestId, userId, roleIds });
console.info('[USERS][ROLES_REPLACE][SUCCESS]', { requestId, userId, count: roleIds.length });
```

### Transaction Required

```text
PUT /api/users/:id/roles ต้องใช้ transaction เพราะต้องลบ role เดิมและ insert role ใหม่
```

### Test Concept

```bash
curl -X PUT http://localhost:3000/api/users/1/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"role_codes":["INSPECTION_OPERATOR"]}'
```

Expected

```text
- app_user_role ของ user_id = 1 ถูกแทนที่ด้วย role ใหม่
- duplicate role ไม่ทำให้ error
- non-admin ต้องถูก block ด้วย 403
```

---

## Module B03 — Product Master

### Contract ID

```text
C-PROD-001
```

### Scope

```text
- Product Category
- Product Sub Category
- Product Model
- Lookup สำหรับ Frontend
```

### Database

```text
product_category
product_sub_category
product_model
```

### API

```http
GET    /api/product-categories?search=
POST   /api/product-categories
PUT    /api/product-categories/:id
GET    /api/product-sub-categories?search=&category_id=
POST   /api/product-sub-categories
PUT    /api/product-sub-categories/:id
GET    /api/product-models?search=&active=
POST   /api/product-models
PUT    /api/product-models/:id
GET    /api/lookups/product-models
```

### Console Log

```ts
console.info('[PRODUCT][MODEL_CREATE][START]', { requestId, model_code });
console.info('[PRODUCT][MODEL_CREATE][SUCCESS]', { requestId, modelId, model_code });
console.warn('[PRODUCT][MODEL_CREATE][DUPLICATE]', { requestId, model_code });
```

### Test Concept

```bash
curl -X POST http://localhost:3000/api/product-models \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"sub_category_id":1,"model_code":"CMA-003","product_name":"Air Control CMA-003","active":true}'
```

Expected

```text
- model_code ซ้ำต้องได้ 409 Conflict
- active=false ต้องไม่แสดงใน lookup ที่ใช้สร้าง Lot
```

---

## Module B04 — Equipment Master / Required Equipment

### Contract ID

```text
C-EQ-001
C-EQ-002
```

### Scope

```text
- Equipment Type
- Equipment Master
- Calibration Status
- Model Required Equipment
- Available Equipment สำหรับ Model
```

### Database

```text
equipment_type_master
equipment_master
model_required_equipment
inspection_equipment
qa_sampling_equipment
```

### API

```http
GET    /api/equipment-types
POST   /api/equipment-types
PUT    /api/equipment-types/:id
GET    /api/equipment?search=&status=&calibration_status=
POST   /api/equipment
GET    /api/equipment/:id
PUT    /api/equipment/:id
GET    /api/model-required-equipment?model_id=
POST   /api/model-required-equipment
PUT    /api/model-required-equipment/:id
GET    /api/models/:modelId/available-equipment
GET    /api/models/:modelId/required-equipment
GET    /api/equipment/expired-calibration
```

### Console Log

```ts
console.info('[EQUIPMENT][CREATE][START]', { requestId, equipment_code });
console.info('[EQUIPMENT][CREATE][SUCCESS]', { requestId, equipmentId });
console.info('[EQUIPMENT][CALIBRATION_CHECK][RESULT]', { requestId, expiredCount, warningCount });
```

### Test Concept

```bash
curl "http://localhost:3000/api/equipment?status=ACTIVE&calibration_status=EXPIRED" \
  -H "Authorization: Bearer <token>"
```

Expected

```text
- แสดงเฉพาะเครื่องมือที่ ACTIVE แต่ calibration_due_date < CURRENT_DATE
- API available-equipment ต้องไม่ส่งเครื่องมือหมดอายุให้เลือกสำหรับ QC/QA หรือส่งพร้อม flag warning
```

---

## Module B05 — Test Template

### Contract ID

```text
C-TPL-001
```

### Scope

```text
- Template Header
- Template Section
- Template Item
- Revision
- Active Template by Model / Type
```

### Database

```text
test_template
test_template_section
test_template_item
```

### API

```http
GET    /api/test-templates?model_id=&template_type=&active=
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

### Console Log

```ts
console.info('[TEMPLATE][ITEM_CREATE][START]', { requestId, templateId, item_code, check_type });
console.info('[TEMPLATE][ITEM_CREATE][SUCCESS]', { requestId, templateItemId });
```

### Test Concept

```bash
curl "http://localhost:3000/api/test-templates?model_id=1&template_type=INSPECTION&active=true" \
  -H "Authorization: Bearer <token>"
```

Expected

```text
- ต้องได้เฉพาะ template type INSPECTION สำหรับ QC
- QA page ต้องเรียก template_type=QA
- template item ต้องเรียงตาม section.seq_no และ item.seq_no
```

---

## Module B06 — Production Lot / Serial Number

### Contract ID

```text
C-LOT-001
C-DASH-001
```

### Scope

```text
- Create Production Lot
- Serial Generation
- Serial Import
- ECN Mapping
- Current Lot Dashboard
```

### Database

```text
production_lot
product_unit
lot_ecn_ref
ecn_master
product_model
```

### API

```http
GET    /api/production-lots?search=&model_code=&date_from=&date_to=
POST   /api/production-lots
GET    /api/production-lots/:id
PUT    /api/production-lots/:id
GET    /api/production-lots/:id/serials
POST   /api/production-lots/generate-serials
POST   /api/production-lots/:id/ecn
GET    /api/current-lots?model_code=&lot_number=&production_date=
```

### Transaction Required

```text
POST /api/production-lots ต้อง insert production_lot + product_unit + lot_ecn_ref ใน transaction เดียว
```

### Console Log

```ts
console.info('[LOT][CREATE][START]', { requestId, model_code, lot_number, lot_qty });
console.info('[LOT][SERIAL_GENERATE][RESULT]', { requestId, count, firstSerial, lastSerial });
console.info('[LOT][CREATE][SUCCESS]', { requestId, lotId, serialCount });
console.error('[LOT][CREATE][ROLLBACK]', { requestId, reason: error.message });
```

### Test Concept

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

Expected

```text
- production_lot ถูกสร้าง 1 row
- product_unit ถูกสร้าง 3 row
- duplicate lot_number ต้องได้ 409
- duplicate serial ใน model เดียวกันต้อง rollback ทั้ง lot
```

---

## Module B07 — QC Inspection

### Contract ID

```text
C-QC-001
C-QC-002
```

### Scope

```text
- Select Lot / Serial
- Load QC Template
- Save Inspection Header / Detail
- Link Equipment
- Calculate Item Result / Overall Result
- Submit / Review / Approve / Reject
```

### Database

```text
inspection_header
inspection_detail
inspection_equipment
product_unit
production_lot
test_template
test_template_item
equipment_master
approval_log
```

### API

```http
GET    /api/qc/lots?search=
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

### Transaction Required

```text
- Save QC: header + detail + equipment
- Approval action: status update + approval_log
```

### Console Log

```ts
console.info('[QC][SAVE][START]', { requestId, product_unit_id, template_id, itemCount: items.length });
console.info('[QC][EQUIPMENT_VALIDATE][RESULT]', { requestId, valid, missingCount, expiredCount });
console.info('[QC][CALCULATE][OVERALL]', { requestId, overall_result });
console.info('[QC][SAVE][SUCCESS]', { requestId, inspectionId, overall_result });
console.info('[QC][APPROVE][SUCCESS]', { requestId, inspectionId, oldStatus, newStatus: 'APPROVED' });
```

### Test Concept — Save QC

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

Expected

```text
- inspection_header.status = DRAFT
- inspection_detail ถูกสร้างตามจำนวน item
- result ถูกคำนวณจาก template_item
- overall_result ถูกคำนวณจาก mandatory item
- inspection_equipment ถูกสร้าง
```

### Test Concept — Approve QC

```bash
curl -X POST http://localhost:3000/api/qc/inspections/10/approve \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"remark":"Approved by backend test"}'
```

Expected

```text
- ถ้า status ไม่ใช่ REVIEWED ต้อง reject ด้วย 409
- ถ้า equipment หมดอายุต้อง reject ด้วย 422
- ถ้าสำเร็จต้อง update approved_at และ insert approval_log
```

---

## Module B08 — QA Sampling

### Contract ID

```text
C-QA-001
C-QA-002
```

### Scope

```text
- Select Lot
- Select Sample Serial
- Save QA Header / Sample Unit / Sample Detail
- Link Equipment
- Calculate Unit Result / Overall Result
- Submit / Review / Approve / Reject
```

### Database

```text
qa_sampling_header
qa_sample_unit
qa_sample_detail
qa_sampling_equipment
production_lot
product_unit
test_template
test_template_item
equipment_master
approval_log
```

### API

```http
GET    /api/qa/lots?search=
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

### Transaction Required

```text
- Save QA: header + sample_unit + sample_detail + equipment
- Approval action: status update + approval_log
```

### Console Log

```ts
console.info('[QA][SAVE][START]', { requestId, lot_id, template_id, sampleCount: samples.length });
console.info('[QA][SERIAL_VALIDATE][RESULT]', { requestId, validSerialCount, invalidSerialCount });
console.info('[QA][CALCULATE][SUMMARY]', { requestId, sample_qty, accept_qty, reject_qty, overall_result });
console.info('[QA][SAVE][SUCCESS]', { requestId, qa_sampling_id, overall_result });
```

### Test Concept

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

Expected

```text
- qa_sampling_header ถูกสร้างหรือ update ตาม lot/template/round
- qa_sample_unit ถูกสร้างตาม sample
- qa_sample_detail ถูกสร้างตาม item
- sample_qty / accept_qty / reject_qty ถูก update
- duplicate serial ใน sampling round ต้อง reject ถ้า update_mode=false
```

---

## Module B09 — Approval Workflow

### Contract ID

```text
C-QC-002
C-QA-002
```

### Scope

```text
- Submit
- Review
- Approve
- Reject
- Insert approval_log
```

### Shared Service

```text
modules/approvals/approval.service.ts
shared/status-workflow.ts
```

### Console Log

```ts
console.info('[APPROVAL][ACTION][START]', { requestId, sourceType, sourceId, action, userId });
console.info('[APPROVAL][STATUS_CHECK]', { requestId, oldStatus, action, allowed });
console.info('[APPROVAL][SUCCESS]', { requestId, sourceType, sourceId, oldStatus, newStatus });
```

### Test Concept

```text
1. QC status DRAFT -> submit -> SUBMITTED
2. SUBMITTED -> review -> REVIEWED
3. REVIEWED -> approve -> APPROVED
4. APPROVED -> edit by normal user -> 403 หรือ 409
5. ทุก action ต้องมี approval_log 1 row
```

---

## Module B10 — Edit Result / Audit Log

### Contract ID

```text
C-EDIT-001
```

### Scope

```text
- Edit QC result
- Edit QA result
- Compare old/new value
- Recalculate result
- Insert test_result_edit_log
```

### Database

```text
inspection_header
inspection_detail
qa_sampling_header
qa_sample_detail
test_result_edit_log
```

### API

```http
GET  /api/edit-results/qc/:inspectionId
PUT  /api/edit-results/qc/:inspectionId
GET  /api/edit-results/qa/:qaSamplingId
PUT  /api/edit-results/qa/:qaSamplingId
```

### Console Log

```ts
console.info('[EDIT_RESULT][QC][START]', { requestId, inspectionId, editedBy, itemCount });
console.info('[EDIT_RESULT][COMPARE]', { requestId, detailId, changedFields });
console.info('[EDIT_RESULT][LOG_INSERTED]', { requestId, logCount });
console.info('[EDIT_RESULT][SUCCESS]', { requestId, headerId, overall_result });
```

### Test Concept

```bash
curl -X PUT http://localhost:3000/api/edit-results/qc/10 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "reason":"Correct measured value after review",
    "items":[{"detail_id":123,"measured_value":25.6,"measured_text":null,"remark":"Corrected"}]
  }'
```

Expected

```text
- reason ว่างต้อง reject
- field ที่เปลี่ยนต้องมี log แยก field
- ถ้า status APPROVED ต้องใช้ ADMIN หรือ authorized role
- overall_result ต้อง recalculate
```

---

## Module B11 — Reports / Export

### Contract ID

```text
C-RPT-001
C-RPT-002
```

### Scope

```text
- QC Search Report
- QA Search Report
- QC Detail Report
- QA Detail Report
- Approval History
- Edit History
- Equipment Traceability
- Export PDF / Excel
```

### API

```http
GET /api/reports/qc?model_code=&lot_number=&serial_number=&date_from=&date_to=&result=&status=&equipment_code=&calibration_status=
GET /api/reports/qa?model_code=&lot_number=&serial_number=&date_from=&date_to=&result=&status=&equipment_code=&calibration_status=
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

### Console Log

```ts
console.info('[REPORT][QC_SEARCH][START]', { requestId, filters, page, pageSize });
console.info('[REPORT][QC_SEARCH][SUCCESS]', { requestId, total, returned: rows.length });
console.info('[REPORT][EXPORT][START]', { requestId, type: 'QC_PDF', inspectionId });
console.info('[REPORT][EXPORT][SUCCESS]', { requestId, fileName });
```

### Test Concept

```bash
curl "http://localhost:3000/api/reports/qc?model_code=CMA-003&lot_number=Assy%2F2601%2F0900" \
  -H "Authorization: Bearer <token>"
```

Expected

```text
- lot_number ที่มี / ต้องรองรับ URL encoding
- ต้องมี pagination
- report ต้องแสดง equipment traceability ได้
- QA summary ควรใช้ sample_result หรือ unit_result ไม่ใช่ header overall_result อย่างเดียว
```

---

## Module B12 — External Integration API

### Contract ID

```text
C-EXT-001
C-LOG-001
```

### Scope

```text
- API สำหรับเครื่องทดสอบหรือ Software ภายนอก
- ใช้ X-API-KEY
- รักษา contract เดิมให้ใกล้เคียงระบบ WinForms Local API
- เขียน api_request_log ทุก request
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
```

### Console Log

```ts
console.info('[EXT_API][REQUEST][START]', { requestId, endpoint, method, clientIp });
console.warn('[EXT_API][AUTH][FAILED]', { requestId, endpoint, clientIp });
console.info('[EXT_API][QC_RESULT][SUCCESS]', { requestId, inspectionId, overall_result });
console.info('[EXT_API][REQUEST_LOG][INSERTED]', { requestId, statusCode, success });
```

### Test Concept

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

Expected

```text
- invalid API key ต้องได้ 401
- valid request ต้องสร้าง QC result ได้
- api_request_log ต้องถูกเขียน
- ห้าม log X-API-KEY แบบ plain text
```

---

# PART B — Development Phase Plan

## Phase 1 — Backend Foundation

```text
1. Setup Node.js + TypeScript
2. Setup PostgreSQL pool
3. Setup env config
4. Setup migration runner
5. Setup error middleware
6. Setup response standard
7. Setup requestId middleware
8. Setup console log standard
```

Done Criteria

```text
- GET /api/health ใช้งานได้
- Database connect สำเร็จ
- Error response format ตรง standard
- Console log มี requestId
```

---

## Phase 2 — Auth / User / Role

```text
1. Auth login/logout/me
2. User CRUD
3. Role CRUD
4. User role assignment
5. RBAC middleware
6. Login log
```

Done Criteria

```text
- Login สำเร็จด้วย admin
- Wrong password ถูก log
- VIEWER เข้า API admin ไม่ได้
- ADMIN เข้าได้ทุก API ที่กำหนด
```

---

## Phase 3 — Master Data

```text
1. Product Master
2. Equipment Master
3. Model Required Equipment
4. Test Template
```

Done Criteria

```text
- สร้าง model ได้
- สร้าง equipment ได้
- กำหนด required equipment ต่อ model ได้
- สร้าง QC/QA template และ item ได้
```

---

## Phase 4 — Production Lot

```text
1. Create lot
2. Generate serial
3. Import serial
4. ECN mapping
5. Current lot dashboard API
```

Done Criteria

```text
- สร้าง lot พร้อม serial ใน transaction เดียว
- duplicate serial rollback ทั้งหมด
- current lot dashboard แสดง lot ล่าสุดได้
```

---

## Phase 5 — QC / QA Core

```text
1. Result calculator
2. Equipment validator
3. QC save
4. QA save
5. Submit / Review / Approve / Reject
```

Done Criteria

```text
- QC บันทึกครบ header/detail/equipment
- QA บันทึกครบ header/unit/detail/equipment
- approve ต้องเขียน approval_log
- equipment expired ต้อง submit/approve ไม่ผ่าน
```

---

## Phase 6 — Reports / Edit / External API

```text
1. QC / QA report
2. Approval history
3. Edit result history
4. Edit result with audit log
5. External API compatibility
6. API request log viewer API
7. Export PDF / Excel
```

Done Criteria

```text
- Report filter ใช้งานได้
- Edit result มี test_result_edit_log
- External API ส่ง QC/QA ได้
- api_request_log ถูกเขียนทุกครั้ง
```

---

# PART C — Backend Testing Checklist

## Unit Test

```text
- result calculator
- status workflow
- equipment validator
- permission mapper
- serial generator
```

## Integration Test

```text
- login success / fail
- create production lot
- save QC
- save QA
- submit / review / approve
- edit result
- external API submit QC / QA
```

## Permission Test

```text
- VIEWER cannot create QC
- INSPECTION_OPERATOR cannot approve QC
- QA_OPERATOR cannot approve QA
- ADMIN can access all modules
- Unauthorized request returns 401
- Forbidden request returns 403
```

## Transaction Test

```text
- QC detail insert fail แล้ว header ต้อง rollback
- QA sample detail insert fail แล้ว header/unit ต้อง rollback
- approval_log insert fail แล้ว status ต้อง rollback
- edit log insert fail แล้ว detail update ต้อง rollback
```

---

# PART D — Sync Rule with Frontend Team

Backend ต้องส่งข้อมูลให้ Frontend ตามนี้ทุกครั้ง

```text
1. Endpoint URL
2. HTTP Method
3. Request JSON
4. Response JSON
5. Error code ที่เป็นไปได้
6. Permission required
7. Console log key ที่ใช้ debug
8. Mock data สำหรับ Frontend ใช้ก่อน API เสร็จ
```

Frontend ต้องส่ง feedback ให้ Backend ตามนี้

```text
1. Payload ที่ UI ส่งจริง
2. Error message ที่ต้องการแสดง
3. Field ที่ต้อง validate เพิ่ม
4. Pagination / filter ที่ต้องใช้จริง
5. Action flow เช่น save draft, submit, approve
```

---

## Appendix A — Recommended Permission by API Group

| API Group | Permission Required |
|---|---|
| `/api/auth/*` | Login required เฉพาะ logout/me/change-password |
| `/api/users/*` | UserRole หรือ ADMIN |
| `/api/roles/*` | UserRole หรือ ADMIN |
| `/api/product-*` | ProductMaster หรือ ADMIN |
| `/api/equipment/*` | EquipmentMaster หรือ ADMIN |
| `/api/model-required-equipment/*` | ModelRequiredEquipment หรือ ADMIN |
| `/api/test-templates/*` | TestTemplate หรือ ADMIN |
| `/api/production-lots/*` | ProductionLot หรือ ADMIN |
| `/api/qc/*` | QCInspection หรือ ADMIN |
| `/api/qa/*` | QASampling หรือ ADMIN |
| `/api/reports/*` | SearchReport หรือ ADMIN |
| `/api/edit-results/*` | EditTestResult หรือ ADMIN |
| `/api/qc/inspections/:id/approve` | ApproveQC หรือ ADMIN |
| `/api/qa/samplings/:id/approve` | ApproveQA หรือ ADMIN |
| External API | X-API-KEY |

