# Sprint 10 Backend - Export Excel / CSV / PDF Report

## Objective

Sprint 10 เพิ่ม Export API สำหรับรายงาน QC, QA, Production Lot และ Audit Trail โดยทุก endpoint ต้องตรวจ `authMiddleware` และ `requirePermission('SearchReport')`

## Implemented Scope

1. เพิ่มโมดูล `server/src/modules/exports`
   - `exports.routes.js`
   - `exports.controller.js`
   - `exports.service.js`
   - `exports.repository.js`
   - `exports.schema.js`
   - `csv-exporter.js`
   - `excel-exporter.js`
   - `pdf-exporter.js`

2. เพิ่ม dependency
   - `exceljs` สำหรับสร้างไฟล์ `.xlsx`
   - `pdfkit` สำหรับสร้างไฟล์ `.pdf`

3. เพิ่ม route ใน `server/src/app.js`
   - `app.use('/api', exportsRoutes)`

## Export APIs

| Method | Endpoint | Output |
|---|---|---|
| GET | `/api/exports/qc-inspections.csv` | QC CSV |
| GET | `/api/exports/qc-inspections.xlsx` | QC Excel |
| GET | `/api/exports/qc-inspections.pdf` | QC list PDF |
| GET | `/api/exports/qc-inspections/:id/pdf` | QC detail PDF |
| GET | `/api/exports/qa-samplings.csv` | QA CSV |
| GET | `/api/exports/qa-samplings.xlsx` | QA Excel |
| GET | `/api/exports/qa-samplings.pdf` | QA list PDF |
| GET | `/api/exports/qa-samplings/:id/pdf` | QA detail PDF |
| GET | `/api/exports/lots.csv` | Production Lot CSV |
| GET | `/api/exports/lots.xlsx` | Production Lot Excel |
| GET | `/api/exports/lots/:lotId/pdf` | Production Lot detail PDF |
| GET | `/api/exports/audit-trails.csv` | Audit Trail CSV |
| GET | `/api/exports/audit-trails.xlsx` | Audit Trail Excel |

## Query Filters

Export QC / QA / Lots รองรับ:

```text
search
model_code
lot_number
serial_number
status
result
date_from
date_to
```

Audit Trail export รองรับ:

```text
source_type
source_id
date_from
date_to
edit_by
approval_status
```

## Automated Test

เพิ่มไฟล์:

```text
server/src/tests/exports.test.js
```

ครอบคลุม:

| Test | Expected |
|---|---|
| QC CSV/XLSX/PDF export | 200, content-type ถูกต้อง, file signature ถูกต้อง |
| QA CSV/XLSX/PDF export | 200, content-type ถูกต้อง, file signature ถูกต้อง |
| Lots CSV/XLSX export | 200, content-type ถูกต้อง, file signature ถูกต้อง |
| Audit Trails CSV/XLSX export | 200, content-type ถูกต้อง, file signature ถูกต้อง |
| No token | 401 `UNAUTHORIZED` |
| User ไม่มี `SearchReport` | 403 `FORBIDDEN` |

### Automated Test Commands

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd run migrate:test:up
npm.cmd test
```

### Automated Test Result

```text
npm.cmd run migrate:test:up
Result: PASS
Message: No migrations to run! Migrations complete!

npm.cmd test
Result: PASS
tests 66
suites 8
pass 66
fail 0
```

## Manual Test

### Step 1 - Start Backend

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd run migrate:up
npm.cmd start
```

Expected:

```text
Backend running on http://localhost:3000
```

### Step 2 - Login

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
$headers = @{ Authorization = "Bearer $token" }
```

Result:

```text
PASS
HTTP 200
Token acquired
```

### Step 3 - QC Export

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/qc-inspections.csv?date_from=2026-06-01&date_to=2026-12-31" `
  -Headers $headers `
  -OutFile ".\manual-test-output\sprint10\qc-inspections.csv" `
  -UseBasicParsing

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/qc-inspections.xlsx?date_from=2026-06-01&date_to=2026-12-31" `
  -Headers $headers `
  -OutFile ".\manual-test-output\sprint10\qc-inspections.xlsx" `
  -UseBasicParsing

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/qc-inspections.pdf?date_from=2026-06-01&date_to=2026-12-31" `
  -Headers $headers `
  -OutFile ".\manual-test-output\sprint10\qc-inspections.pdf" `
  -UseBasicParsing
```

Result:

```text
QC CSV  PASS  HTTP 200  Content-Type text/csv; charset=utf-8  Signature EF BB BF
QC XLSX PASS  HTTP 200  Content-Type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet  Signature PK
QC PDF  PASS  HTTP 200  Content-Type application/pdf  Signature %PDF
```

### Step 4 - QC Detail PDF

ใช้ QC จาก manual DB:

```text
QC inspection id = 100
```

Command:

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/qc-inspections/100/pdf" `
  -Headers $headers `
  -OutFile ".\manual-test-output\sprint10\qc-inspection-100.pdf" `
  -UseBasicParsing
```

Result:

```text
PASS
HTTP 200
Content-Type application/pdf
Signature %PDF
File size 1875 bytes
```

### Step 5 - QA Export

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/qa-samplings.csv?date_from=2026-06-01&date_to=2026-12-31" `
  -Headers $headers `
  -OutFile ".\manual-test-output\sprint10\qa-samplings.csv" `
  -UseBasicParsing

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/qa-samplings.xlsx?date_from=2026-06-01&date_to=2026-12-31" `
  -Headers $headers `
  -OutFile ".\manual-test-output\sprint10\qa-samplings.xlsx" `
  -UseBasicParsing

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/qa-samplings.pdf?date_from=2026-06-01&date_to=2026-12-31" `
  -Headers $headers `
  -OutFile ".\manual-test-output\sprint10\qa-samplings.pdf" `
  -UseBasicParsing
```

Result:

```text
QA CSV  PASS  HTTP 200  Content-Type text/csv; charset=utf-8  Signature EF BB BF
QA XLSX PASS  HTTP 200  Content-Type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet  Signature PK
QA PDF  PASS  HTTP 200  Content-Type application/pdf  Signature %PDF
```

### Step 6 - QA Detail PDF

ใช้ QA จาก manual DB:

```text
QA sampling id = 3
```

Command:

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/qa-samplings/3/pdf" `
  -Headers $headers `
  -OutFile ".\manual-test-output\sprint10\qa-sampling-3.pdf" `
  -UseBasicParsing
```

Result:

```text
PASS
HTTP 200
Content-Type application/pdf
Signature %PDF
File size 3163 bytes
```

### Step 7 - Lot Export

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/lots.csv?date_from=2026-06-01&date_to=2026-12-31" `
  -Headers $headers `
  -OutFile ".\manual-test-output\sprint10\lots.csv" `
  -UseBasicParsing

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/lots.xlsx?date_from=2026-06-01&date_to=2026-12-31" `
  -Headers $headers `
  -OutFile ".\manual-test-output\sprint10\lots.xlsx" `
  -UseBasicParsing
```

Result:

```text
Lots CSV  PASS  HTTP 200  Content-Type text/csv; charset=utf-8  Signature EF BB BF
Lots XLSX PASS  HTTP 200  Content-Type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet  Signature PK
```

### Step 8 - Lot Detail PDF

ใช้ Lot จาก manual DB:

```text
lot id = 12
```

Command:

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/lots/12/pdf" `
  -Headers $headers `
  -OutFile ".\manual-test-output\sprint10\lot-12.pdf" `
  -UseBasicParsing
```

Result:

```text
PASS
HTTP 200
Content-Type application/pdf
Signature %PDF
File size 3068 bytes
```

### Step 9 - Audit Trail Export

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/audit-trails.csv?source_type=QC" `
  -Headers $headers `
  -OutFile ".\manual-test-output\sprint10\audit-trails.csv" `
  -UseBasicParsing

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/audit-trails.xlsx?source_type=QC" `
  -Headers $headers `
  -OutFile ".\manual-test-output\sprint10\audit-trails.xlsx" `
  -UseBasicParsing
```

Result:

```text
Audit CSV  PASS  HTTP 200  Content-Type text/csv; charset=utf-8  Signature EF BB BF
Audit XLSX PASS  HTTP 200  Content-Type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet  Signature PK
```

### Step 10 - No Token Test

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/qc-inspections.csv" `
  -UseBasicParsing
```

Expected:

```text
401 UNAUTHORIZED
```

Result:

```text
PASS
HTTP 401
error_code = UNAUTHORIZED
```

### Step 11 - No Permission Test

สร้าง user ที่ไม่มี `SearchReport` permission แล้ว login:

```powershell
$noPermHeaders = @{ Authorization = "Bearer <NO_PERMISSION_TOKEN>" }

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/exports/qc-inspections.csv" `
  -Headers $noPermHeaders `
  -UseBasicParsing
```

Expected:

```text
403 FORBIDDEN
```

Result:

```text
PASS
HTTP 403
error_code = FORBIDDEN
```

## Manual Test Summary

| Step | Result |
|---|---|
| Login | PASS |
| QC CSV/XLSX/PDF | PASS |
| QC Detail PDF | PASS |
| QA CSV/XLSX/PDF | PASS |
| QA Detail PDF | PASS |
| Lots CSV/XLSX | PASS |
| Lot Detail PDF | PASS |
| Audit CSV/XLSX | PASS |
| No token | PASS, 401 |
| No permission | PASS, 403 |

## Notes

- CSV ใช้ UTF-8 BOM เพื่อเปิดใน Excel ได้ง่ายขึ้น
- XLSX เป็นไฟล์จริงจาก `exceljs` และตรวจ signature ได้เป็น `PK`
- PDF เป็นไฟล์จริงจาก `pdfkit` และตรวจ signature ได้เป็น `%PDF`
- Manual export files ถูกเขียนไว้ที่ `manual-test-output/sprint10`
