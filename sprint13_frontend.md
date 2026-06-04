# Sprint 13 Frontend - Production Lot / Serial UI

## Objective

Sprint 13 เพิ่มหน้าจอ Frontend สำหรับ Production Lot และ Serial Generation ต่อจาก Backend Sprint 4 โดยเน้น:

1. Current Lots
2. Production Lot search/list
3. Create Production Lot
4. Serial preview
5. Serial duplicate validation ผ่าน backend
6. Lot detail
7. Lot serial list
8. ECN mapping by ECN ID
9. Permission-based menu/action

## Implemented Scope

### Frontend Routes

| Route | Description | Permission |
|---|---|---|
| `/production-lots` | Current lots, all lots, create lot | `ProductionLot` |
| `/production-lots/:id` | Lot detail, serials, ECN refs, update status/remark | `ProductionLot` |

### Files Added / Updated

```text
frontend/src/api/products.api.ts
frontend/src/api/productionLots.api.ts
frontend/src/pages/production/ProductionLotsPage.tsx
frontend/src/pages/production/ProductionLotDetailPage.tsx
frontend/src/app/router.tsx
frontend/src/layouts/Sidebar.tsx
frontend/src/styles/global.css
frontend/src/api/httpClient.ts
frontend/src/mocks/auth.mock.ts
```

## API Mapping

| UI Action | Backend API |
|---|---|
| Product model dropdown | `GET /api/lookups/product-models` |
| Current lots | `GET /api/current-lots` |
| Search production lots | `GET /api/production-lots` |
| Get lot detail | `GET /api/production-lots/:id` |
| Update lot status/remark | `PUT /api/production-lots/:id` |
| Get lot serials | `GET /api/production-lots/:id/serials` |
| Serial preview | `POST /api/production-lots/generate-serials` |
| Create production lot | `POST /api/production-lots` |
| Replace ECN refs | `POST /api/production-lots/:id/ecn` |

## UI Behavior

### `/production-lots`

มี 3 tabs:

```text
Current Lots
All Lots
Create Lot
```

Filter รองรับ:

```text
search
model_code
lot_number
status
date_from
date_to
page
page_size
```

ค่า `all`, `All`, `ทั้งหมด` และค่าว่าง จะถูกตีความเป็นไม่กำหนด filter

### Create Lot

Fields:

```text
Product Model
Lot Number
Production Date
Lot Qty
Serial Prefix
Start Number
Padding
ECN IDs
Remark
```

Validation ฝั่ง frontend:

```text
model_id required
lot_number required
lot_qty > 0
lot_qty <= 5000
serial_padding >= 0
```

Serial preview ใช้:

```http
POST /api/production-lots/generate-serials
```

Create lot ใช้:

```http
POST /api/production-lots
```

Backend ยังตรวจซ้ำ:

```text
duplicate lot_number per model
duplicate serial
serial_generation.count must equal lot_qty
ECN ids must exist
```

### `/production-lots/:id`

แสดง:

```text
Lot header
Status / Qty / Serial count
Update status + remark
ECN references
Update ECN IDs
Serial list
```

## Permission Mapping

| UI | Permission |
|---|---|
| Sidebar Production Lots menu | `ProductionLot` or `ADMIN` |
| `/production-lots` | `ProductionLot` or `ADMIN` |
| `/production-lots/:id` | `ProductionLot` or `ADMIN` |

Frontend ซ่อนเมนูตาม permission แต่ backend ยังเป็นตัว block จริงเสมอ

## Console Log Standard

เพิ่ม log สำคัญ:

```text
[PRODUCTION_LOTS][CURRENT_LOAD][START]
[PRODUCTION_LOTS][CURRENT_LOAD][API_SUCCESS]
[PRODUCTION_LOTS][LIST_LOAD][START]
[PRODUCTION_LOTS][LIST_LOAD][API_SUCCESS]
[PRODUCTION_LOTS][SERIAL_PREVIEW][API_SUCCESS]
[PRODUCTION_LOTS][CREATE][START]
[PRODUCTION_LOTS][CREATE][API_SUCCESS]
[PRODUCTION_LOTS][UPDATE][START]
[PRODUCTION_LOTS][UPDATE][API_SUCCESS]
[PRODUCTION_LOTS][ECN_UPDATE][START]
[PRODUCTION_LOTS][ECN_UPDATE][API_SUCCESS]
```

ไม่มีการ log password/token

## Build Test

Command:

```powershell
cd D:\DevApp\production\PMPS\frontend
npm.cmd run build
```

Result:

```text
PASS
tsc --noEmit PASS
vite build PASS

dist/index.html                  0.39 kB
dist/assets/index-*.css          6.51 kB
dist/assets/index-*.js         304.65 kB
```

## Manual API Test

### Step 1 - Start Backend

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd start
```

### Step 2 - Login

```powershell
$login = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{
    username = "admin"
    password = "Admin@123"
  } | ConvertTo-Json)

$headers = @{ Authorization = "Bearer $($login.data.access_token)" }
```

Result:

```text
PASS
HTTP 200
user=admin
```

### Step 3 - Product Model Lookup

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/lookups/product-models" `
  -Headers $headers
```

Result:

```text
PASS
HTTP 200
model count = 5
```

### Step 4 - Current Lots

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/current-lots?date_from=2026-06-01&date_to=2026-12-31" `
  -Headers $headers
```

Result:

```text
PASS
HTTP 200
rows = 0
```

Note:

```text
Dev DB ตอนทดสอบไม่มี current lot ในช่วงวันที่นี้ จึงได้ 0 rows แต่ API ทำงานปกติ
```

### Step 5 - Production Lot List

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/production-lots?page=1&page_size=1&date_from=2026-06-01&date_to=2026-12-31" `
  -Headers $headers
```

Result:

```text
PASS
HTTP 200
rows = 0
```

### Step 6 - Serial Preview

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/production-lots/generate-serials" `
  -Method POST `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    prefix = "S13-"
    start_number = 1
    count = 3
    padding = 3
  } | ConvertTo-Json)
```

Result:

```text
PASS
HTTP 200
serials = S13-001,S13-002,S13-003
```

## Browser Manual Test Checklist

ให้ทดสอบใน browser หลังเปิด backend และ frontend:

```powershell
# Backend
cd D:\DevApp\production\PMPS\server
npm.cmd start

# Frontend
cd D:\DevApp\production\PMPS\frontend
npm.cmd run dev
```

| Step | Expected |
|---|---|
| Login admin | redirect `/dashboard` |
| Sidebar | เห็นเมนู Production Lots |
| Open `/production-lots` | เห็น Current Lots tab |
| Filter From/To only | ค้นหา lot ทั้งหมดในช่วงวันที่ |
| พิมพ์ `all` ใน search/model/lot | ไม่ส่งคำว่า all เป็น filter |
| Open All Lots tab | แสดง table และ pagination |
| Open Create Lot tab | แสดง form create lot |
| Product model dropdown | โหลด active model ได้ |
| Click Preview Serials | แสดง serial preview |
| Create lot with valid payload | save success และไป All Lots |
| Create duplicate lot | แสดง conflict 409 |
| Create duplicate serial | แสดง conflict 409 |
| Open `/production-lots/:id` | แสดง lot detail และ serials |
| Update status/remark | save success |
| Update ECN IDs | save success ถ้า ECN ID มีจริง |
| Update ECN ID ที่ไม่มีจริง | แสดง validation error |
| User ไม่มี `ProductionLot` | ไม่เห็นเมนูหรือเห็น No Permission |

## Known Limitations

1. Sprint 13 ยังไม่ทำ ECN search/list UI เพราะ backend ยังไม่มี endpoint สำหรับค้น `ecn_master`
2. ECN mapping ใช้ช่องกรอก ECN IDs แบบ comma-separated เช่น `1,2,3`
3. Product model dropdown ใช้ `GET /api/lookups/product-models` ซึ่ง backend ปัจจุบัน protect ด้วย `ProductMaster`; admin ใช้งานได้ แต่ user ที่มีเฉพาะ `ProductionLot` อาจโหลด model lookup ไม่ได้จนกว่า backend จะเพิ่ม lookup permission ที่เหมาะสม
4. Sprint 13 ยังไม่ทำ QC/QA Entry UI

## Next Sprint Suggestion

Sprint ถัดไปควรทำ:

```text
QC Inspection Entry UI
QA Sampling Entry UI
Equipment validation display
Submit / Review / Approve action buttons
```

เพราะ Production Lot และ Serial foundation พร้อมให้ QC/QA ใช้ต่อแล้ว
## Hotfix Verification - Production Lot Detail

Issue:

```text
Open /production-lots/12 returned "Unable to load data / Internal server error".
```

Root cause:

```text
Backend Production Lot detail loads ECN references from lot_ecn_ref.
The repository selects and inserts lot_ecn_ref.created_at, but the dev/test database schema did not have this column.
```

Fix:

```text
Added migration:
server/migrations/1780761600000_sprint13-lot-ecn-ref-created-at.js

Column added:
lot_ecn_ref.created_at timestamp default CURRENT_TIMESTAMP
```

Manual test:

```powershell
$loginBody = @{ username = "admin"; password = "Admin@123" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
$headers = @{ Authorization = "Bearer $($login.data.access_token)" }

Invoke-RestMethod -Uri "http://localhost:3000/api/production-lots/12" -Method GET -Headers $headers
Invoke-RestMethod -Uri "http://localhost:3000/api/production-lots/12/serials" -Method GET -Headers $headers
```

Result:

```text
PASS
GET /api/production-lots/12 = HTTP 200
lot_number = Assy/2601/0902
ecn_refs = 0

PASS
GET /api/production-lots/12/serials = HTTP 200
serial_count = 100
```

Regression test:

```text
PASS npm.cmd run migrate:up
PASS npm.cmd run migrate:test:up
PASS npm.cmd test -- --runInBand
PASS npm.cmd run build
```
