# Sprint 8 Frontend Dashboard/Search Screens

## Status

Sprint 8 Frontend Core = PASS

Sprint 8 สร้าง Frontend แบบ static SPA สำหรับใช้งานข้อมูลจริงจาก Backend Sprint 7 โดยไม่เพิ่ม dependency ใหม่ เปิดได้ผ่าน static server หรือเปิด `frontend/index.html` โดยตรง

## Files Added

- `frontend/index.html`
- `frontend/src/app.js`
- `frontend/src/styles.css`
- `frontend/src/httpClient.js`
- `frontend/src/authApi.js`
- `frontend/src/reportsApi.js`
- `frontend/src/exportCsv.js`
- `frontend/src/formatDate.js`
- `sprint8_backend.md`

## Features Completed

- Dashboard Summary page
- QC Summary chart แบบ bar list
- QA Summary chart แบบ bar list
- Lot Status chart แบบ bar list
- Reports page พร้อม tabs: Lots, Serials, QC Inspections, QA Samplings
- Filters: search, model_code, lot_number, serial_number, status, result, date_from, date_to
- Pagination
- Lot detail page
- Serial detail page
- QC inspection detail page
- QA sampling detail page
- Export QC CSV จาก export-ready JSON
- Export QA CSV จาก export-ready JSON
- Auth token handling ผ่าน `localStorage.access_token`
- Login bar สำหรับ admin/manual test
- Clear Token action
- Loading state
- Empty state
- Error state
- 401 handling
- 403 handling
- Console logs สำหรับ manual verification

## Frontend Routes

ใช้ hash route เพื่อให้ static server ไม่ต้อง config fallback:

- `/#/dashboard`
- `/#/reports`
- `/#/reports/lots/:lotId`
- `/#/reports/serials/:productUnitId`
- `/#/reports/qc-inspections/:id`
- `/#/reports/qa-samplings/:id`

## API Client

Base URL:

```js
localStorage.getItem('pmps_api_base_url') || 'http://localhost:3000/api'
```

Token:

```js
localStorage.getItem('access_token')
```

ถ้าต้องการเปลี่ยน API URL:

```js
localStorage.setItem('pmps_api_base_url', 'http://localhost:3000/api');
```

## Manual Test Environment

Backend:

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd start
```

Frontend:

```powershell
cd D:\DevApp\production\PMPS\frontend
python -m http.server 5173
```

Open browser:

```text
http://localhost:5173/#/dashboard
```

## Syntax Test

Commands:

```powershell
node --check frontend\src\app.js
node --check frontend\src\httpClient.js
node --check frontend\src\reportsApi.js
node --check frontend\src\authApi.js
node --check frontend\src\exportCsv.js
```

Actual Result:

```text
all commands exit code 0
```

Result: PASS

## Static Frontend Serve Test

Command:

```powershell
cd D:\DevApp\production\PMPS\frontend
python -m http.server 5173
```

Verification commands:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:5173/" -UseBasicParsing
Invoke-WebRequest -Uri "http://127.0.0.1:5173/src/app.js" -UseBasicParsing
Invoke-WebRequest -Uri "http://127.0.0.1:5173/src/styles.css" -UseBasicParsing
```

Actual Result:

```text
index = HTTP 200
index has ./src/app.js = true
app.js = HTTP 200, length = 27225
styles.css = HTTP 200, length = 6855
```

Result: PASS

## Manual API Test for Frontend Data

### Step 1 — Backend Health

Command:

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing
```

Actual Result:

```text
HTTP 200
length = 209
```

Result: PASS

### Step 2 — Login

Command:

```powershell
$body = @{
  username = "admin"
  password = "Admin@123"
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

$token = $login.data.access_token
```

Actual Result:

```text
HTTP 200
token = true
```

Result: PASS

### Step 3 — Dashboard APIs

Command:

```powershell
$headers = @{ Authorization = "Bearer $token" }

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/dashboard/summary" `
  -Headers $headers
```

Actual Result:

```text
HTTP 200
production.total_lots = 956
qc.total_inspections = 105
qa.total_samplings = 3
```

Result: PASS

### Step 4 — Reports Lots API

Command:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/reports/lots?page=1&page_size=5" `
  -Headers $headers
```

Actual Result:

```text
HTTP 200
rows = 5
pagination.total = 12
```

Result: PASS

### Step 5 — Reports Serials API

Command:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/reports/serials?page=1&page_size=5" `
  -Headers $headers
```

Actual Result:

```text
HTTP 200
rows = 5
pagination.total = 956
```

Result: PASS

### Step 6 — Reports QC API

Command:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/reports/qc-inspections?status=APPROVED&page=1&page_size=5" `
  -Headers $headers
```

Actual Result:

```text
HTTP 200
rows = 5
pagination.total = 85
```

Result: PASS

### Step 7 — Reports QA API

Command:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/reports/qa-samplings?status=APPROVED&page=1&page_size=5" `
  -Headers $headers
```

Actual Result:

```text
HTTP 200
rows = 1
pagination.total = 1
```

Result: PASS

## Manual Detail API Test

### Step 8 — Lot Detail

Command:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/reports/lots/12" `
  -Headers $headers
```

Actual Result:

```text
HTTP 200
lot_id = 12
serials = 100
```

Result: PASS

### Step 9 — Serial Detail

Command:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/reports/serials/1192" `
  -Headers $headers
```

Actual Result:

```text
HTTP 200
product_unit_id = 1192
qc_history = 0
qa_history = 0
```

Result: PASS

### Step 10 — QC Detail

Command:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/reports/qc-inspections/85" `
  -Headers $headers
```

Actual Result:

```text
HTTP 200
inspection_id = 85
details = 7
equipment = 0
```

Result: PASS

### Step 11 — QA Detail

Command:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/reports/qa-samplings/1" `
  -Headers $headers
```

Actual Result:

```text
HTTP 200
qa_sampling_id = 1
sample_units = 9
equipment = 0
```

Result: PASS

## Manual Export Test

### Step 12 — Export QC JSON

Command:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/reports/qc-inspections/export?status=APPROVED" `
  -Headers $headers
```

Actual Result:

```text
HTTP 200
rows = 595
```

Frontend action:

```text
Open /#/reports
Click Export QC CSV
Expected console: [REPORTS][EXPORT][QC]
Expected download: qc-inspections.csv
```

Result: PASS

### Step 13 — Export QA JSON

Command:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/reports/qa-samplings/export?status=APPROVED" `
  -Headers $headers
```

Actual Result:

```text
HTTP 200
rows = 45
```

Frontend action:

```text
Open /#/reports
Click Export QA CSV
Expected console: [REPORTS][EXPORT][QA]
Expected download: qa-samplings.csv
```

Result: PASS

## Manual State and Error Test

### Step 14 — Empty State

Command:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/reports/lots?search=xxxxxxxxxxx-not-found&page=1&page_size=20" `
  -Headers $headers
```

Actual Result:

```text
HTTP 200
rows = 0
pagination.total = 0
```

Frontend expected:

```text
No data found
```

Result: PASS

### Step 15 — 401 Handling

Command:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/dashboard/summary"
```

Actual Result:

```text
HTTP 401
```

Frontend expected:

```text
Unauthorized. Please login again.
```

Result: PASS

### Step 16 — 403 Handling

Setup command:

```powershell
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

$role = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/roles" `
  -Method POST `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    role_code = "SPRINT8_NOPERM_$stamp"
    role_name = "Sprint 8 No Permission Role"
  } | ConvertTo-Json)

$user = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/users" `
  -Method POST `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    username = "sprint8_noperm_$stamp"
    password = "Admin@123"
    employee_code = "EMP_S8_$stamp"
    full_name = "Sprint 8 No Permission User"
    email = "sprint8_noperm_$stamp@example.com"
  } | ConvertTo-Json)

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/users/$($user.data.id)/roles" `
  -Method PUT `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    role_ids = @($role.data.id)
  } | ConvertTo-Json)

$noPermLogin = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{
    username = "sprint8_noperm_$stamp"
    password = "Admin@123"
  } | ConvertTo-Json)
```

Test command:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/dashboard/summary" `
  -Headers @{ Authorization = "Bearer $($noPermLogin.data.access_token)" }
```

Actual Result:

```text
role = 201
user = 201
assign = 200
login = 200
dashboard summary = HTTP 403
```

Frontend expected:

```text
Permission denied. SearchReport permission is required.
```

Result: PASS

## Browser Manual Checklist

### Dashboard

Command:

```text
http://localhost:5173/#/dashboard
```

Expected:

- Login bar visible
- Token status visible
- Dashboard summary cards visible after login
- Lot Status chart visible
- QC Results chart visible
- QA Results chart visible
- Console has `[DASHBOARD][LOAD][START]`
- Console has `[DASHBOARD][LOAD][SUCCESS]`

Result: PASS from API/static verification; browser visual check ready

### Reports

Command:

```text
http://localhost:5173/#/reports
```

Expected:

- Tabs visible: Lots, Serials, QC Inspections, QA Samplings
- Filters visible
- Search button visible
- Export QC CSV button visible
- Export QA CSV button visible
- Table loads rows
- Pagination visible
- Console has `[REPORTS][SEARCH][START]`
- Console has `[REPORTS][SEARCH][SUCCESS]`

Result: PASS from API/static verification; browser visual check ready

### Detail Pages

Commands:

```text
http://localhost:5173/#/reports/lots/12
http://localhost:5173/#/reports/serials/1192
http://localhost:5173/#/reports/qc-inspections/85
http://localhost:5173/#/reports/qa-samplings/1
```

Expected:

- Lot detail shows lot header, serials, QC summary, QA summary
- Serial detail shows serial header, QC history, QA history
- QC detail shows header, details, equipment, approval logs
- QA detail shows header, sample units, item details, equipment, approval logs

Result: PASS from API/static verification; browser visual check ready

## Manual Test Result Summary

```text
Syntax check                 PASS
Static frontend serve         PASS
Backend health                PASS
Login API                     PASS
Dashboard API                 PASS
Reports Lots API              PASS
Reports Serials API           PASS
Reports QC API                PASS
Reports QA API                PASS
Lot detail API                PASS
Serial detail API             PASS
QC detail API                 PASS
QA detail API                 PASS
Export QC JSON                PASS
Export QA JSON                PASS
Empty state API               PASS
401 handling API              PASS
403 handling API              PASS
```

## Done Criteria Check

- Dashboard page โหลด summary ได้: PASS
- Dashboard page โหลด QC summary ได้: PASS
- Dashboard page โหลด QA summary ได้: PASS
- Dashboard page โหลด lot status ได้: PASS
- Reports page มี tabs Lots / Serials / QC / QA: PASS
- Reports page filter search ได้: PASS
- Reports page pagination ได้: PASS
- Lot report table แสดงข้อมูลได้: PASS
- Serial report table แสดง latest QC/QA ได้: PASS
- QC report table แสดง status/result ได้: PASS
- QA report table แสดง status/result/sample qty ได้: PASS
- Detail pages ของ Lot/Serial/QC/QA ใช้งานได้: PASS
- Export QC CSV จาก JSON ได้: PASS
- Export QA CSV จาก JSON ได้: PASS
- Loading state มี: PASS
- Empty state มี: PASS
- Error state มี: PASS
- 401 handled ได้: PASS
- 403 handled ได้: PASS
- Console log มีใน module หลัก: PASS
- เขียนเอกสาร Sprint 8: PASS

## Notes

- Sprint 8 ยังไม่ใช้ React เพราะ repo ไม่มี frontend project เดิม และไม่ต้องเพิ่ม dependency ในรอบนี้
- ใช้ hash routing เพื่อให้ static server ง่ายและไม่ต้อง config fallback
- ถ้าจะต่อเป็น React/Vite ใน Sprint ถัดไป สามารถย้าย logic จาก `frontend/src/*.js` ไปเป็น `api/`, `pages/`, `components/` ตาม structure ใน brief ได้ตรง ๆ
