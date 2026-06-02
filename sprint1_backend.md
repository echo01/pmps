# Sprint 1 Backend Summary — PMPS Production Inspection & QA Sampling

เอกสารนี้สรุปสิ่งที่ทำเสร็จแล้วใน Sprint 1 สำหรับ Backend Node.js Application และรวบรวมวิธีทดสอบแต่ละขั้นตอน เพื่อใช้เป็นเอกสารอ้างอิงก่อนเริ่มพัฒนา Module ถัดไป เช่น User Management, Product Master, Equipment, Production Lot, QC และ QA

---

## 0. Sprint 1 Objective

เป้าหมายของ Sprint 1 คือเตรียม Backend Foundation ให้พร้อมก่อนเริ่มพัฒนา Business Module จริง โดยเน้น 4 เรื่องหลัก

```text
1. Database readiness
2. Migration / seed control
3. Backend foundation structure
4. Authentication / Authorization foundation
```

หลังจบ Sprint 1 ระบบสามารถทำงานพื้นฐานได้ดังนี้

```text
- เชื่อมต่อ PostgreSQL ได้
- รัน migration ได้
- มี admin user สำหรับทดสอบระบบ
- มี Health API
- มี response format กลาง
- มี error middleware กลาง
- มี requestId ทุก request
- มี transaction helper
- มีตัวอย่าง repository pattern
- มี test database สำหรับ integration test
- Login ด้วย admin ได้
- สร้าง JWT access token ได้
- ตรวจ token ด้วย Auth Middleware ได้
- ตรวจ permission ด้วย RBAC Middleware ได้
```

---

# 1. Database Constraint / Hardening

## สิ่งที่ทำแล้ว

เพิ่ม constraint และ table ที่จำเป็นก่อนเริ่มเขียน Backend เพื่อป้องกันข้อมูลผิดตั้งแต่ระดับ Database

รายการที่ทำแล้ว:

```text
A. เพิ่ม Unique Constraint ให้ production_lot
B. เพิ่ม Foreign Key ให้ qa_sample_detail.template_item_id
C. เพิ่ม Foreign Key ให้ qa_sample_unit.product_unit_id
D. เพิ่ม Unique Constraint ป้องกัน QA sample ซ้ำในรอบเดียวกัน
E. เพิ่ม Unique Constraint ให้ QC Inspection
F. เพิ่ม Unique Constraint ให้ QA Sampling Header
G. เพิ่มตาราง app_permission และ app_role_permission
H. เพิ่มตาราง external_api_client สำหรับ External API
I. เพิ่ม updated_at ในตาราง Master และ Transaction หลัก
J. เพิ่ม Check Constraint สำหรับ Status / Result
```

## จุดที่พบและแก้ไขแล้ว

ตอนตรวจข้อมูลก่อนเพิ่ม FK พบ orphan data ใน `qa_sample_unit.product_unit_id` จำนวน 18 rows โดย `product_unit_id` ชี้ไปยัง record ที่ไม่มีอยู่ใน `product_unit`

แก้ไขแล้วจน query นี้ได้ผลเป็น `(0 rows)`

```sql
SELECT 
    qsu.id,
    qsu.product_unit_id,
    qsu.serial_number
FROM qa_sample_unit qsu
LEFT JOIN product_unit pu
    ON pu.id = qsu.product_unit_id
WHERE qsu.product_unit_id IS NOT NULL
  AND pu.id IS NULL;
```

## วิธีทดสอบหลังเพิ่ม Constraint

```sql
SELECT 
    conname,
    conrelid::regclass AS table_name,
    contype
FROM pg_constraint
WHERE conname IN (
    'uq_production_lot_model_lot',
    'fk_qa_sample_detail_item',
    'fk_qa_sample_unit_product_unit',
    'uq_qa_sample_unit_serial_per_sampling',
    'uq_qa_sample_unit_product_per_sampling',
    'uq_inspection_unit_template_no',
    'uq_qa_sampling_lot_template_round',
    'chk_inspection_status',
    'chk_qa_status',
    'chk_inspection_overall_result',
    'chk_qa_overall_result',
    'chk_inspection_detail_result',
    'chk_qa_detail_result',
    'fk_api_request_log_client'
)
ORDER BY table_name, conname;
```

Expected:

```text
ต้องเห็น constraint ครบตามรายการที่เพิ่มไว้
```

---

# 2. Migration Script

## สิ่งที่ทำแล้ว

ติดตั้งและใช้งาน `node-pg-migrate` สำหรับควบคุม database migration

ติดตั้ง package:

```powershell
npm install pg dotenv
npm install -D node-pg-migrate dotenv-cli
```

สร้าง migration แล้ว 3 ไฟล์:

```text
migrations/
  1780039894529_db-hardening-before-backend.js
  1780040826415_seed-default-permissions.js
  1780042092598_seed-admin-user.js
```

## ปัญหาที่พบและแก้ไขแล้ว

### ปัญหา ES Module / CommonJS

ตอนแรก migration file ใช้:

```js
export const up = (pgm) => {};
```

ทำให้เกิด error:

```text
SyntaxError: Unexpected token 'export'
```

แก้เป็น CommonJS:

```js
exports.up = (pgm) => {};
exports.down = (pgm) => {};
exports.shorthands = undefined;
```

### ปัญหา DATABASE_URL

พบ error:

```text
The DATABASE_URL environment variable is not set
```

แก้โดยติดตั้ง `dotenv` และ `dotenv-cli` พร้อมตั้งค่า `.env`

```env
DATABASE_URL=postgres://postgres:<password>@localhost:5432/production_db
DATABASE_URL_TEST=postgres://postgres:<password>@localhost:5432/production_db_test
```

## วิธีทดสอบ Migration

รัน migration DB หลัก:

```powershell
npm run migrate:up
```

ตรวจ migration:

```sql
SELECT *
FROM pgmigrations
ORDER BY run_on;
```

Expected:

```text
1 | 1780039894529_db-hardening-before-backend
2 | 1780040826415_seed-default-permissions
3 | 1780042092598_seed-admin-user
```

---

# 3. Seed Admin / Role / Permission

## สิ่งที่ทำแล้ว

สร้าง seed data สำหรับระบบเริ่มต้น

```text
- ADMIN role
- app_permission 13 รายการ
- app_role_permission สำหรับ ADMIN และ role อื่น
- admin user
- mapping admin user กับ ADMIN role
```

Permission ที่ seed แล้ว:

```text
ApiLogViewer
ApproveQA
ApproveQC
EditTestResult
EquipmentMaster
ModelRequiredEquipment
ProductionLot
ProductMaster
QASampling
QCInspection
SearchReport
TestTemplate
UserRole
```

## ปัญหาที่พบและแก้ไขแล้ว

ตอน seed admin user พบ error:

```text
column "description" of relation "app_role" does not exist
```

สาเหตุคือ schema จริงของ `app_role` มีเฉพาะ:

```text
id
role_code
role_name
```

จึงแก้ migration `seed-admin-user` ให้ insert เฉพาะ:

```sql
INSERT INTO app_role (
    role_code,
    role_name
)
VALUES (
    'ADMIN',
    'System Administrator'
)
ON CONFLICT (role_code) DO UPDATE
SET role_name = EXCLUDED.role_name;
```

## วิธีทดสอบ Admin User

ตรวจ admin:

```sql
SELECT 
    id,
    username,
    employee_code,
    full_name,
    email,
    active,
    failed_login_count
FROM app_user
WHERE username = 'admin';
```

Expected:

```text
username = admin
employee_code = ADMIN001
active = true
failed_login_count = 0
```

ตรวจ role:

```sql
SELECT 
    u.username,
    r.role_code
FROM app_user u
JOIN app_user_role ur ON ur.user_id = u.id
JOIN app_role r ON r.id = ur.role_id
WHERE u.username = 'admin';
```

Expected:

```text
admin | ADMIN
```

ตรวจ permission:

```sql
SELECT 
    u.username,
    r.role_code,
    p.permission_code
FROM app_user u
JOIN app_user_role ur ON ur.user_id = u.id
JOIN app_role r ON r.id = ur.role_id
JOIN app_role_permission rp ON rp.role_id = r.id
JOIN app_permission p ON p.id = rp.permission_id
WHERE u.username = 'admin'
ORDER BY p.permission_code;
```

Expected:

```text
admin ต้องมี permission 13 รายการ
```

---

# 4. Health API

## สิ่งที่ทำแล้ว

สร้าง Health API เพื่อตรวจว่า Backend Server และ PostgreSQL ใช้งานได้

Files:

```text
src/app.js
src/server.js
src/config/env.js
src/db/pool.js
src/modules/health/health.routes.js
src/modules/health/health.controller.js
src/modules/health/health.service.js
```

Endpoint:

```http
GET /api/health
```

## วิธีทดสอบ

Start server:

```powershell
npm run dev
```

Test API:

```powershell
curl.exe http://localhost:3000/api/health
```

Expected:

```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "app": "running",
    "db": "connected"
  },
  "meta": {
    "request_id": "..."
  }
}
```

Console expected:

```text
[APP][START]
[REQUEST][START]
[HEALTH][CHECK][START]
[HEALTH][CHECK][SUCCESS]
[REQUEST][END]
```

---

# 5. Response Format กลาง

## สิ่งที่ทำแล้ว

สร้าง response helper กลางเพื่อให้ API ทุกตัวตอบรูปแบบเดียวกัน

Files:

```text
src/shared/response.js
src/shared/http-error.js
```

Response success standard:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "meta": {
    "request_id": "..."
  }
}
```

Response error standard:

```json
{
  "success": false,
  "message": "Validation failed",
  "error_code": "VALIDATION_ERROR",
  "errors": [],
  "meta": {
    "request_id": "..."
  }
}
```

## วิธีทดสอบ

Health API ต้องใช้ `successResponse()` แล้ว response ยังเหมือนเดิม

```powershell
curl.exe http://localhost:3000/api/health
```

Route ที่ไม่มีอยู่ต้องได้ format กลาง:

```powershell
curl.exe http://localhost:3000/api/not-found
```

Expected:

```json
{
  "success": false,
  "message": "Route not found",
  "error_code": "ROUTE_NOT_FOUND",
  "errors": [],
  "meta": {
    "request_id": "..."
  }
}
```

---

# 6. Error Middleware

## สิ่งที่ทำแล้ว

ปรับ Error Middleware ให้รองรับ error หลัก ๆ

Files:

```text
src/middlewares/error.middleware.js
src/shared/db-error.mapper.js
src/shared/http-error.js
```

รองรับ:

```text
- Invalid JSON body
- HttpError ที่สร้างเอง
- PostgreSQL error เช่น unique, foreign key, not null, check constraint
- Unexpected error
```

Error log key:

```text
[APP][JSON_PARSE_ERROR]
[APP][DB_ERROR]
[APP][HTTP_ERROR]
[APP][UNEXPECTED_ERROR]
```

## วิธีทดสอบ Bad Request

```powershell
curl.exe http://localhost:3000/api/debug/errors/bad-request
```

Expected:

```json
{
  "success": false,
  "message": "Debug bad request",
  "error_code": "BAD_REQUEST",
  "errors": [
    {
      "field": "test_field",
      "message": "This is a test bad request error"
    }
  ],
  "meta": {
    "request_id": "..."
  }
}
```

## วิธีทดสอบ Unauthorized

```powershell
curl.exe http://localhost:3000/api/debug/errors/unauthorized
```

Expected:

```json
{
  "success": false,
  "message": "Debug unauthorized",
  "error_code": "UNAUTHORIZED",
  "errors": [],
  "meta": {
    "request_id": "..."
  }
}
```

## วิธีทดสอบ JSON ผิดรูปแบบ

```powershell
curl.exe -X POST "http://localhost:3000/api/debug/json" -H "Content-Type: application/json" --data-raw "{ invalid json }"
```

Expected:

```json
{
  "success": false,
  "message": "Invalid JSON body",
  "error_code": "INVALID_JSON_BODY",
  "errors": [
    {
      "field": "body",
      "message": "Request body must be valid JSON"
    }
  ],
  "meta": {
    "request_id": "..."
  }
}
```

หมายเหตุ: Debug route ควรเปิดเฉพาะ `NODE_ENV=development` และไม่ควรเก็บไว้ใน production

---

# 7. RequestId Middleware

## สิ่งที่ทำแล้ว

สร้าง Request ID middleware เพื่อ trace request ตลอด flow

Files:

```text
src/middlewares/request-id.middleware.js
src/shared/sanitize-log.js
```

ความสามารถ:

```text
- สร้าง requestId ถ้า client ไม่ส่งมา
- รับ X-Request-Id จาก client ได้
- ใส่ X-Request-Id ใน response header
- ใส่ request_id ใน response body
- log REQUEST START / END
- วัด durationMs
- sanitize ข้อมูลลับก่อน log
```

## วิธีทดสอบ Health API พร้อม Header

```powershell
curl.exe -i http://localhost:3000/api/health
```

Expected header:

```text
X-Request-Id: <uuid>
```

Expected body:

```json
{
  "meta": {
    "request_id": "<uuid>"
  }
}
```

## วิธีทดสอบส่ง X-Request-Id เอง

```powershell
curl.exe -i http://localhost:3000/api/health -H "X-Request-Id: TEST-REQ-001"
```

Expected:

```text
Header: X-Request-Id: TEST-REQ-001
Body: meta.request_id = TEST-REQ-001
```

Console expected:

```text
[REQUEST][START]
[REQUEST][END]
```

---

# 8. withTransaction Helper

## สิ่งที่ทำแล้ว

สร้าง helper สำหรับจัดการ transaction กลาง

File:

```text
src/db/transaction.js
```

ความสามารถ:

```text
- pool.connect()
- BEGIN
- COMMIT เมื่อสำเร็จ
- ROLLBACK เมื่อ error
- release client ทุกครั้ง
- log BEGIN / COMMIT / ROLLBACK / RELEASE
```

ใช้กับงานจริง เช่น:

```text
- Create Production Lot
- Save QC
- Save QA
- Approval Workflow
- Edit Result
```

## วิธีทดสอบ Transaction Commit

```powershell
curl.exe -X POST http://localhost:3000/api/debug/transaction/commit
```

Expected:

```json
{
  "success": true,
  "message": "Transaction commit test completed",
  "data": {
    "role_code": "DEBUG_COMMIT_ROLE"
  }
}
```

ตรวจ role:

```powershell
curl.exe http://localhost:3000/api/debug/roles/DEBUG_COMMIT_ROLE
```

Expected:

```text
ต้องเจอ DEBUG_COMMIT_ROLE
```

## วิธีทดสอบ Transaction Rollback

```powershell
curl.exe -X POST http://localhost:3000/api/debug/transaction/rollback
```

Expected:

```json
{
  "success": false,
  "message": "Internal server error",
  "error_code": "INTERNAL_SERVER_ERROR"
}
```

ตรวจ role:

```powershell
curl.exe http://localhost:3000/api/debug/roles/DEBUG_ROLLBACK_ROLE
```

Expected:

```json
{
  "success": true,
  "data": null
}
```

Console expected:

```text
[DB][TRANSACTION][BEGIN]
[DB][TRANSACTION][ERROR]
[DB][TRANSACTION][ROLLBACK]
[DB][TRANSACTION][RELEASE]
```

---

# 9. Repository Pattern ตัวอย่าง 1 Module

## สิ่งที่ทำแล้ว

สร้างตัวอย่าง Repository Pattern ด้วย `Roles Module`

Files:

```text
src/modules/roles/
  roles.routes.js
  roles.controller.js
  roles.service.js
  roles.repository.js
  roles.schema.js
```

Pattern ที่ใช้:

```text
routes
  ↓
controller
  ↓
service
  ↓
repository
  ↓
PostgreSQL
```

หน้าที่แต่ละชั้น:

```text
routes      = กำหนด URL และ HTTP method
controller  = อ่าน request, validate input, ส่ง response
service     = business logic, duplicate check, throw error
repository  = SQL เท่านั้น
schema      = zod validation schema
```

Endpoints:

```http
GET  /api/roles
GET  /api/roles/:id
POST /api/roles
```

## วิธีทดสอบ GET Roles

```powershell
curl.exe http://localhost:3000/api/roles
```

หลังทำ Auth/RBAC แล้ว ต้องส่ง token:

```powershell
curl.exe http://localhost:3000/api/roles -H "Authorization: Bearer $token"
```

Expected:

```json
{
  "success": true,
  "message": "Roles retrieved successfully",
  "data": []
}
```

## วิธีทดสอบ Create Role

```powershell
$body = '{"role_code":"TEST_ROLE","role_name":"Test Role"}'

curl.exe -X POST "http://localhost:3000/api/roles" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  --data-raw $body
```

Expected:

```json
{
  "success": true,
  "message": "Role created successfully",
  "data": {
    "role_code": "TEST_ROLE",
    "role_name": "Test Role"
  }
}
```

## วิธีทดสอบ Duplicate Role

รัน create ซ้ำอีกครั้ง

Expected:

```json
{
  "success": false,
  "message": "Role code already exists",
  "error_code": "CONFLICT"
}
```

---

# 10. Test Database สำหรับ Integration Test

## สิ่งที่ทำแล้ว

สร้าง database สำหรับ test แยกจาก dev database

```text
production_db       = database หลัก
production_db_test  = database สำหรับ integration test
```

เพิ่มใน `.env`:

```env
DATABASE_URL_TEST=postgres://postgres:<password>@localhost:5432/production_db_test
```

ติดตั้ง test package:

```powershell
npm install -D vitest supertest
```

## ปัญหาที่พบและแก้ไขแล้ว

ตอนรัน migration test DB พบ error:

```text
relation "production_lot" does not exist
```

สาเหตุคือ `production_db_test` เป็น database ว่าง แต่ migration แรกเป็น hardening migration ที่ต้องอาศัย schema เดิมก่อน

วิธีแก้:

```text
1. สร้าง production_db_test
2. import schema เดิมเข้า production_db_test ก่อน
3. รัน migration test DB
```

## วิธีทดสอบ Migration Test DB

```powershell
npm run migrate:test:up
```

ตรวจใน test DB:

```sql
SELECT *
FROM pgmigrations
ORDER BY run_on;
```

Expected:

```text
ต้องเห็น migration ทั้ง 3 ตัว
```

## วิธีทดสอบ Health API ด้วย Vitest

ไฟล์ตัวอย่าง:

```text
src/tests/health.test.js
```

รัน:

```powershell
npm test
```

Expected:

```text
Health API test ผ่าน
Roles API test ผ่าน
```

---

# 11. Auth Login Module

## สิ่งที่ทำแล้ว

สร้าง Auth Module สำหรับ login ด้วย username/password และสร้าง JWT token

Files:

```text
src/modules/auth/
  auth.routes.js
  auth.controller.js
  auth.service.js
  auth.repository.js
  auth.schema.js
```

ติดตั้ง package:

```powershell
npm install jsonwebtoken bcrypt
```

เพิ่มใน `.env`:

```env
JWT_SECRET=<secret ที่ generate เอง>
JWT_EXPIRES_IN=1d
```

Endpoint:

```http
POST /api/auth/login
```

## ปัญหาที่พบและแก้ไขแล้ว

### 1. Route not found

สาเหตุคือยังไม่ได้ผูก route ใน `app.js`

แก้โดยเพิ่ม:

```js
const { authRoutes } = require('./modules/auth/auth.routes');
app.use('/api', authRoutes);
```

### 2. Invalid JSON Body

สาเหตุคือ PowerShell ส่ง JSON body ไม่ถูกต้อง

วิธีทดสอบที่ถูกต้อง:

```powershell
$body = @{
  username = "admin"
  password = "Admin@123"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

### 3. user_login_log column ไม่ตรง

พบ error:

```text
column "success" of relation "user_login_log" does not exist
```

แก้ function `insertLoginLog()` ให้ใช้ column จริง:

```text
login_success
fail_reason
client_ip
machine_name
login_at
```

## วิธีทดสอบ Login สำเร็จ

```powershell
$body = @{
  username = "admin"
  password = "Admin@123"
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

$response
```

Expected:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "...",
    "user": {
      "username": "admin",
      "roles": ["ADMIN"],
      "permissions": []
    }
  }
}
```

เก็บ token:

```powershell
$token = $response.data.access_token
```

---

# 12. Auth Middleware + RBAC Middleware

## สิ่งที่ทำแล้ว

สร้าง Middleware สำหรับตรวจ JWT token และ permission

Files:

```text
src/middlewares/auth.middleware.js
src/middlewares/rbac.middleware.js
```

เพิ่ม endpoint:

```http
GET /api/auth/me
```

เพิ่มการป้องกัน route roles:

```js
router.get(
  '/roles',
  authMiddleware,
  requirePermission('UserRole'),
  getRoles
);
```

## วิธีทดสอบ Login และเก็บ Token

```powershell
$body = @{
  username = "admin"
  password = "Admin@123"
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

$token = $response.data.access_token
```

## วิธีทดสอบ Auth Me

```powershell
curl.exe "http://localhost:3000/api/auth/me" `
  -H "Authorization: Bearer $token"
```

Expected:

```json
{
  "success": true,
  "message": "Current user retrieved successfully",
  "data": {
    "user": {
      "id": 2,
      "username": "admin",
      "roles": ["ADMIN"],
      "permissions": []
    }
  }
}
```

## วิธีทดสอบไม่มี Token

```powershell
curl.exe "http://localhost:3000/api/auth/me"
```

Expected:

```json
{
  "success": false,
  "message": "Invalid or expired token",
  "error_code": "UNAUTHORIZED"
}
```

## วิธีทดสอบ Roles API พร้อม Token

```powershell
curl.exe "http://localhost:3000/api/roles" `
  -H "Authorization: Bearer $token"
```

Expected:

```json
{
  "success": true,
  "message": "Roles retrieved successfully",
  "data": []
}
```

## วิธีทดสอบ Roles API ไม่มี Token

```powershell
curl.exe "http://localhost:3000/api/roles"
```

Expected:

```json
{
  "success": false,
  "message": "Invalid or expired token",
  "error_code": "UNAUTHORIZED"
}
```

Console expected:

```text
[AUTH][TOKEN][VERIFIED]
[RBAC][ALLOWED]
```

หรือกรณีไม่ผ่าน:

```text
[AUTH][TOKEN][FAILED]
[APP][HTTP_ERROR]
```

---

# 13. Current Project Structure หลัง Sprint 1

โครงสร้างหลักที่ควรมีตอนนี้:

```text
src/
  app.js
  server.js

  config/
    env.js

  db/
    pool.js
    transaction.js

  middlewares/
    request-id.middleware.js
    error.middleware.js
    auth.middleware.js
    rbac.middleware.js

  shared/
    response.js
    http-error.js
    db-error.mapper.js
    sanitize-log.js

  modules/
    health/
      health.routes.js
      health.controller.js
      health.service.js

    auth/
      auth.routes.js
      auth.controller.js
      auth.service.js
      auth.repository.js
      auth.schema.js

    roles/
      roles.routes.js
      roles.controller.js
      roles.service.js
      roles.repository.js
      roles.schema.js

    debug/
      debug.routes.js
      debug.controller.js
      debug.service.js
      debug.repository.js

  tests/
    test-env.js
    health.test.js
    roles.test.js
```

---

# 14. Sprint 1 Final Verification Checklist

ก่อนเริ่ม Sprint 2 ให้ตรวจตามนี้อีกครั้ง

## Database

```sql
SELECT * FROM pgmigrations ORDER BY run_on;
```

Expected:

```text
มี migration 3 ตัว
```

```sql
SELECT username, active FROM app_user WHERE username = 'admin';
```

Expected:

```text
admin | true
```

## API

```powershell
curl.exe http://localhost:3000/api/health
```

Expected:

```text
success = true
```

## Login

```powershell
$body = @{
  username = "admin"
  password = "Admin@123"
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

$token = $response.data.access_token
```

Expected:

```text
$token มีค่า JWT
```

## Auth Me

```powershell
curl.exe "http://localhost:3000/api/auth/me" `
  -H "Authorization: Bearer $token"
```

Expected:

```text
success = true
username = admin
```

## RBAC

```powershell
curl.exe "http://localhost:3000/api/roles" `
  -H "Authorization: Bearer $token"
```

Expected:

```text
success = true
```

## No Token

```powershell
curl.exe "http://localhost:3000/api/roles"
```

Expected:

```text
success = false
error_code = UNAUTHORIZED
```

## Test

```powershell
npm test
```

Expected:

```text
Health test ผ่าน
Roles test ผ่าน
```

---

# 15. สิ่งที่ควรทำต่อใน Sprint 2

ลำดับที่แนะนำหลัง Sprint 1:

```text
1. User Management Module
   - GET /api/users
   - POST /api/users
   - PUT /api/users/:id
   - PATCH /api/users/:id/active
   - PUT /api/users/:id/roles

2. ปรับ Roles Module ให้ครบ
   - PUT /api/roles/:id
   - GET /api/roles/:id/permissions
   - PUT /api/roles/:id/permissions

3. Product Master Module
   - Product Category
   - Product Sub Category
   - Product Model

4. Equipment Master Module
   - Equipment Type
   - Equipment Master
   - Calibration Status
   - Model Required Equipment
```

แนะนำให้เริ่ม Sprint 2 ด้วย `User Management Module` เพราะ Auth/RBAC พร้อมแล้ว และจะใช้เป็นพื้นฐานสำหรับระบบสิทธิ์ทั้งหมด

---

# 16. Notes / Rules สำหรับทีม Backend

```text
1. Controller ห้ามเขียน SQL โดยตรง
2. SQL ต้องอยู่ใน repository เท่านั้น
3. งานที่บันทึกหลาย table ต้องใช้ withTransaction
4. ทุก API ต้องใช้ response helper
5. ทุก error ต้องผ่าน errorMiddleware
6. ทุก log ต้องมี requestId
7. ห้าม log password, token, API key
8. Route สำคัญต้องใช้ authMiddleware
9. Route ที่ต้องจำกัดสิทธิ์ต้องใช้ requirePermission
10. Test DB ต้องใช้ production_db_test เท่านั้น
```
