# Sprint 7 Backend: Report / Search / Dashboard API

## Status

Sprint 7 Core = PASS

Sprint 7 เป็น read-only layer สำหรับ Frontend ใช้ค้นหา ดู dashboard และเตรียมข้อมูล export จากข้อมูลที่สร้างไว้ใน Sprint 4-6 โดยทุก endpoint ใช้ `authMiddleware` และ `requirePermission('SearchReport')`

## Files Added / Updated

- `server/src/modules/reports/reports.routes.js`
- `server/src/modules/reports/reports.controller.js`
- `server/src/modules/reports/reports.service.js`
- `server/src/modules/reports/reports.repository.js`
- `server/src/modules/reports/reports.schema.js`
- `server/src/tests/reports.test.js`
- `server/src/app.js`
- `sprint7.backend.md`

## API Completed

### Dashboard APIs

- `GET /api/dashboard/summary`
- `GET /api/dashboard/qc-summary`
- `GET /api/dashboard/qa-summary`
- `GET /api/dashboard/lot-status`

### Search APIs

- `GET /api/reports/lots`
- `GET /api/reports/serials`
- `GET /api/reports/qc-inspections`
- `GET /api/reports/qa-samplings`

### Detail Report APIs

- `GET /api/reports/lots/:lotId`
- `GET /api/reports/serials/:productUnitId`
- `GET /api/reports/qc-inspections/:id`
- `GET /api/reports/qa-samplings/:id`

### Export-ready APIs

- `GET /api/reports/qc-inspections/export`
- `GET /api/reports/qa-samplings/export`

หมายเหตุ: export API คืน JSON แบบ flat rows ก่อน ยังไม่สร้างไฟล์ Excel/PDF จริงตาม scope ของ Sprint 7

## Query Parameters Supported

- `search`
- `model_code`
- `lot_number`
- `serial_number`
- `status`
- `result`
- `date_from`
- `date_to`
- `page`
- `page_size`

## Integration Test Summary

ไฟล์ทดสอบ: `server/src/tests/reports.test.js`

Test setup สร้างข้อมูลจริงผ่าน API:

1. Login admin
   - Result: PASS
   - ได้ `access_token` สำหรับ setup และทดสอบ

2. Setup product category, sub category, model
   - Result: PASS
   - สร้าง model สำหรับ Sprint 7 fixture สำเร็จ

3. Setup equipment type, equipment, required equipment
   - Result: PASS
   - สร้าง equipment ที่ active และ calibration ยังไม่หมดอายุ

4. Setup QC template, section, numeric item, boolean item
   - Result: PASS
   - สร้าง template type `INSPECTION` สำเร็จ

5. Setup QA template, section, numeric item, boolean item
   - Result: PASS
   - สร้าง template type `QA` สำเร็จ

6. Create production lot and serials
   - Result: PASS
   - สร้าง lot จำนวน 3 serial สำเร็จ

7. Create and approve QC inspection
   - Result: PASS
   - สร้าง QC inspection แล้ว submit, review, approve สำเร็จ

8. Create and approve QA sampling
   - Result: PASS
   - สร้าง QA sampling แล้ว submit, review, approve สำเร็จ

## Test Steps and Results

### Step 1: Dashboard Summary

Endpoint:

```text
GET /api/dashboard/summary
```

Expected:

- status 200
- มี `data.production.total_lots`
- มี `data.qc.total_inspections`
- มี `data.qa.total_samplings`

Result: PASS

### Step 2: QC Summary

Endpoint:

```text
GET /api/dashboard/qc-summary?date_from=2026-06-01&date_to=2026-12-31
```

Expected:

- status 200
- `by_status` เป็น array
- `by_result` เป็น array
- `by_model` เป็น array
- พบ model fixture ของ Sprint 7

Result: PASS

### Step 3: QA Summary

Endpoint:

```text
GET /api/dashboard/qa-summary?date_from=2026-06-01&date_to=2026-12-31
```

Expected:

- status 200
- `by_status` เป็น array
- `by_result` เป็น array
- `by_model` เป็น array
- พบ model fixture ของ Sprint 7

Result: PASS

### Step 4: Lot Status Summary

Endpoint:

```text
GET /api/dashboard/lot-status
```

Expected:

- status 200
- data เป็น array
- มี status `OPEN`

Result: PASS

### Step 5: Lot Report Search

Endpoint:

```text
GET /api/reports/lots?search=<LOT>&page=1&page_size=20
```

Expected:

- status 200
- มี pagination meta
- พบ lot fixture
- `serial_count = 3`

Result: PASS

### Step 6: Serial Report Search

Endpoint:

```text
GET /api/reports/serials?serial_number=<SERIAL>&page=1&page_size=20
```

Expected:

- status 200
- พบ serial fixture
- `latest_qc_result = PASS`
- `latest_qa_result = PASS`

Result: PASS

### Step 7: QC Inspection Report Search

Endpoint:

```text
GET /api/reports/qc-inspections?status=APPROVED&result=PASS&model_code=<MODEL>&page=1&page_size=20
```

Expected:

- status 200
- พบ QC inspection fixture
- `status = APPROVED`
- `overall_result = PASS`

Result: PASS

### Step 8: QA Sampling Report Search

Endpoint:

```text
GET /api/reports/qa-samplings?status=APPROVED&result=PASS&model_code=<MODEL>&page=1&page_size=20
```

Expected:

- status 200
- พบ QA sampling fixture
- `status = APPROVED`
- `sample_qty = 2`

Result: PASS

### Step 9: Lot Detail Report

Endpoint:

```text
GET /api/reports/lots/:lotId
```

Expected:

- status 200
- `data.lot.lot_id` ตรงกับ fixture
- `data.serials.length = 3`
- `data.qc_summary.pass >= 1`
- `data.qa_summary.pass >= 1`

Result: PASS

### Step 10: Serial Detail Report

Endpoint:

```text
GET /api/reports/serials/:productUnitId
```

Expected:

- status 200
- `product_unit_id` ตรงกับ fixture
- มี `serial_number`
- มี QC inspection history
- มี QA sampling history

Result: PASS

### Step 11: QC Inspection Detail Report

Endpoint:

```text
GET /api/reports/qc-inspections/:id
```

Expected:

- status 200
- `inspection_id` ตรงกับ fixture
- `details.length = 2`
- `equipment.length = 1`
- มี approval log action `APPROVE`

Result: PASS

### Step 12: QA Sampling Detail Report

Endpoint:

```text
GET /api/reports/qa-samplings/:id
```

Expected:

- status 200
- `qa_sampling_id` ตรงกับ fixture
- `sample_units.length = 2`
- `equipment.length = 1`
- มี approval log action `APPROVE`

Result: PASS

### Step 13: QC Export-ready JSON

Endpoint:

```text
GET /api/reports/qc-inspections/export?model_code=<MODEL>&date_from=2026-06-01&date_to=2026-12-31
```

Expected:

- status 200
- data เป็น flat array
- มี row ตามจำนวน QC detail item
- แต่ละ row มี `lot_number`, `serial_number`, `item_code`, `measured_value` หรือ `measured_text`, `result`

Result: PASS

### Step 14: QA Export-ready JSON

Endpoint:

```text
GET /api/reports/qa-samplings/export?model_code=<MODEL>&date_from=2026-06-01&date_to=2026-12-31
```

Expected:

- status 200
- data เป็น flat array
- มี row ตามจำนวน sample unit x QA detail item
- แต่ละ row มี `lot_number`, `serial_number`, `item_code`, `measured_value` หรือ `measured_text`, `result`

Result: PASS

### Step 15: No Token

Endpoint:

```text
GET /api/dashboard/summary
```

Expected:

- ไม่ส่ง token
- status 401
- `error_code = UNAUTHORIZED`

Result: PASS

### Step 16: No Permission

Endpoint:

```text
GET /api/dashboard/summary
```

Expected:

- login ด้วย user ที่ไม่มี `SearchReport`
- status 403
- `error_code = FORBIDDEN`

Result: PASS

## Full Test Result

Command:

```powershell
npm.cmd run migrate:test:up
npm.cmd test
```

Result:

```text
No migrations to run!
Migrations complete!

tests 58
suites 6
pass 58
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 2933.3451
```

## Done Criteria Check

- Dashboard summary ใช้งานได้: PASS
- QC summary ใช้งานได้: PASS
- QA summary ใช้งานได้: PASS
- Lot status summary ใช้งานได้: PASS
- Lot report search พร้อม pagination: PASS
- Serial report search พร้อม pagination: PASS
- QC inspection report search พร้อม pagination: PASS
- QA sampling report search พร้อม pagination: PASS
- Lot detail report ใช้งานได้: PASS
- Serial detail report ใช้งานได้: PASS
- QC detail report ใช้งานได้: PASS
- QA detail report ใช้งานได้: PASS
- QC export-ready JSON ใช้งานได้: PASS
- QA export-ready JSON ใช้งานได้: PASS
- ทุก route ใช้ `authMiddleware`: PASS
- ทุก route ใช้ `requirePermission('SearchReport')`: PASS
- No token ได้ 401: PASS
- User ไม่มี SearchReport ได้ 403: PASS
- `npm test` ผ่าน: PASS
- เขียนเอกสาร Sprint 7: PASS

## Notes for Next Sprint

Sprint ถัดไปสามารถต่อยอดจาก JSON export-ready เป็น CSV/Excel จริง หรือเริ่มทำ Frontend Dashboard/Search screens ได้ โดยไม่ต้องเปลี่ยน data contract หลักของ Sprint 7

## Manual Test แบบครบชุด

Manual test นี้รันกับ development server:

```text
http://localhost:3000
```

ก่อนรัน manual test ได้ตรวจ migration แล้ว:

```powershell
npm.cmd run migrate:up
```

Result:

```text
No migrations to run!
Migrations complete!
```

เปิด server:

```powershell
npm.cmd start
```

Health check:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method GET
```

Result:

```text
status 200
success = true
app = running
db = connected
```

หมายเหตุ: ถ้าใช้ `Invoke-WebRequest` บน Windows PowerShell รุ่นเก่า ให้เพิ่ม `-UseBasicParsing` เพื่อเลี่ยง error เรื่อง Internet Explorer engine

### Manual Step 1 — Login

Command:

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

- status 200
- ได้ `access_token`

Actual Result:

```text
HTTP 200
token = true
```

Result: PASS

### Manual Step 2 — Dashboard Summary

Command:

```powershell
curl.exe "http://localhost:3000/api/dashboard/summary" `
  -H "Authorization: Bearer $token"
```

Expected:

- status 200
- มี `data.production.total_lots`
- มี `data.qc.total_inspections`
- มี `data.qa.total_samplings`

Actual Result:

```text
HTTP 200
production.total_lots = 956
qc.total_inspections = 105
qa.total_samplings = 3
```

Result: PASS

### Manual Step 3 — QC Summary

Command:

```powershell
curl.exe "http://localhost:3000/api/dashboard/qc-summary?date_from=2026-06-01&date_to=2026-12-31" `
  -H "Authorization: Bearer $token"
```

Expected:

- status 200
- `by_status` เป็น array
- `by_result` เป็น array
- `by_model` เป็น array

Actual Result:

```text
HTTP 200
by_status rows = 0
by_result rows = 0
by_model rows = 0
```

Result: PASS

หมายเหตุ: Endpoint ทำงานถูกต้องและคืน array ตาม contract แต่ใน development DB รอบ manual test ไม่มี QC record ในช่วงวันที่ `2026-06-01` ถึง `2026-12-31`

### Manual Step 4 — QA Summary

Command:

```powershell
curl.exe "http://localhost:3000/api/dashboard/qa-summary?date_from=2026-06-01&date_to=2026-12-31" `
  -H "Authorization: Bearer $token"
```

Expected:

- status 200
- `by_status` เป็น array
- `by_result` เป็น array
- `by_model` เป็น array

Actual Result:

```text
HTTP 200
by_status rows = 0
by_result rows = 0
by_model rows = 0
```

Result: PASS

หมายเหตุ: Endpoint ทำงานถูกต้องและคืน array ตาม contract แต่ใน development DB รอบ manual test ไม่มี QA record ในช่วงวันที่ `2026-06-01` ถึง `2026-12-31`

### Manual Step 5 — Lot Report Search

Command:

```powershell
curl.exe "http://localhost:3000/api/reports/lots?search=S4&page=1&page_size=20" `
  -H "Authorization: Bearer $token"
```

Expected:

- status 200
- มี pagination meta
- ถ้ามี lot ที่ match `S4` จะคืนใน `data`

Actual Result:

```text
HTTP 200
rows = 0
pagination.total = 0
```

Result: PASS

หมายเหตุ: API ทำงานถูกต้อง แต่ development DB รอบ manual test ไม่มี lot ที่ match `S4`

### Manual Step 6 — Serial Report Search

Command:

```powershell
curl.exe "http://localhost:3000/api/reports/serials?serial_number=S4&page=1&page_size=20" `
  -H "Authorization: Bearer $token"
```

Expected:

- status 200
- มี pagination meta
- ถ้ามี serial ที่ match `S4` จะคืนใน `data`

Actual Result:

```text
HTTP 200
rows = 0
pagination.total = 0
```

Result: PASS

หมายเหตุ: API ทำงานถูกต้อง แต่ development DB รอบ manual test ไม่มี serial ที่ match `S4`

### Manual Step 7 — QC Report Search

Command:

```powershell
curl.exe "http://localhost:3000/api/reports/qc-inspections?status=APPROVED&page=1&page_size=20" `
  -H "Authorization: Bearer $token"
```

Expected:

- status 200
- มี pagination meta
- ถ้ามี QC ที่ approve แล้ว จะพบ `status = APPROVED`

Actual Result:

```text
HTTP 200
rows = 20
pagination.total = 85
```

Result: PASS

### Manual Step 8 — QA Report Search

Command:

```powershell
curl.exe "http://localhost:3000/api/reports/qa-samplings?status=APPROVED&page=1&page_size=20" `
  -H "Authorization: Bearer $token"
```

Expected:

- status 200
- มี pagination meta
- ถ้ามี QA sampling ที่ approve แล้ว จะพบ `status = APPROVED`

Actual Result:

```text
HTTP 200
rows = 1
pagination.total = 1
```

Result: PASS

### Manual Step 9 — Detail Report

Command ตามคู่มือ:

```powershell
curl.exe "http://localhost:3000/api/reports/lots/<LOT_ID>" `
  -H "Authorization: Bearer $token"
```

Command ที่ใช้ทดสอบจริง:

```powershell
curl.exe "http://localhost:3000/api/reports/lots/12" `
  -H "Authorization: Bearer $token"
```

Expected:

- status 200
- `data.lot` มีข้อมูล lot
- `data.serials` เป็น array
- `data.qc_summary` มี summary
- `data.qa_summary` มี summary

Actual Result:

```text
HTTP 200
lot_id = 12
source = fallback first lot
serials = 100
qc_summary.pass = 1
qa_summary.pass = 0
```

Result: PASS

หมายเหตุ: เพราะ Step 5 ค้นหา `S4` แล้วไม่พบข้อมูล จึง fallback ไป lot แรกจาก `GET /api/reports/lots?page=1&page_size=1` เพื่อให้ทดสอบ detail endpoint จริงได้

### Manual Step 10 — No Token Test

Command:

```powershell
curl.exe "http://localhost:3000/api/dashboard/summary"
```

Expected:

```text
401 UNAUTHORIZED
```

Actual Result:

```text
HTTP/1.1 401 Unauthorized
{
  "success": false,
  "message": "Invalid or expired token",
  "error_code": "UNAUTHORIZED"
}
```

Result: PASS

### Manual Step 11 — No Permission Test

Setup command:

```powershell
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$roleBody = @{
  role_code = "SPRINT7_MANUAL_NOPERM_$stamp"
  role_name = "Sprint 7 Manual No Permission Role"
} | ConvertTo-Json

$role = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/roles" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $roleBody

$userBody = @{
  username = "sprint7_manual_noperm_$stamp"
  password = "Admin@123"
  employee_code = "EMP_S7_MANUAL_$stamp"
  full_name = "Sprint 7 Manual No Permission User"
  email = "sprint7_manual_noperm_$stamp@example.com"
} | ConvertTo-Json

$user = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/users" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $userBody

$assignBody = @{
  role_ids = @($role.data.id)
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/users/$($user.data.id)/roles" `
  -Method PUT `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $assignBody

$loginBody = @{
  username = "sprint7_manual_noperm_$stamp"
  password = "Admin@123"
} | ConvertTo-Json

$noPermissionLogin = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $loginBody

$noPermissionToken = $noPermissionLogin.data.access_token
```

Test command:

```powershell
curl.exe "http://localhost:3000/api/dashboard/summary" `
  -H "Authorization: Bearer $noPermissionToken"
```

Expected:

```text
403 FORBIDDEN
```

Actual Result:

```text
setup role HTTP = 201
setup user HTTP = 201
assign role HTTP = 200
dashboard summary HTTP = 403
error_code = FORBIDDEN
```

Result: PASS

## Manual Test Result Summary

```text
Step 1  Login                  PASS
Step 2  Dashboard Summary      PASS
Step 3  QC Summary             PASS
Step 4  QA Summary             PASS
Step 5  Lot Report Search      PASS
Step 6  Serial Report Search   PASS
Step 7  QC Report Search       PASS
Step 8  QA Report Search       PASS
Step 9  Detail Report          PASS
Step 10 No Token Test          PASS
Step 11 No Permission Test     PASS
```
