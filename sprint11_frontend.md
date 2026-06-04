# Sprint 11 Frontend - React/Vite Foundation + Dashboard/Reports Migration

## Objective

ย้าย Frontend จาก Static SPA เดิมของ Sprint 8 ไปเป็น React + Vite + TypeScript ใน `PMPS/frontend` และเชื่อมต่อ Backend API ที่ทำครบถึง Sprint 10 สำหรับ Login, Dashboard, Reports, Detail และ Export

## Backup

ก่อนปรับ frontend ได้ backup static frontend เดิมไว้แล้ว:

```text
manual-test-output/sprint11-backup/
  index-static-sprint8.html
  src-static-sprint8/
```

## New Frontend Structure

```text
frontend/
  index.html
  package.json
  package-lock.json
  vite.config.ts
  tsconfig.json
  tsconfig.node.json
  .env
  .env.example
  .gitignore

  src/
    main.tsx
    App.tsx
    vite-env.d.ts

    app/
      router.tsx
      providers.tsx
      queryClient.ts

    api/
      apiResponse.ts
      httpClient.ts
      auth.api.ts
      reports.api.ts
      exports.api.ts

    auth/
      AuthProvider.tsx
      useAuth.ts
      permission.ts

    layouts/
      MainLayout.tsx
      MainLayout.module.css
      Sidebar.tsx
      Header.tsx

    pages/
      LoginPage.tsx
      dashboard/
        DashboardPage.tsx
        DashboardPage.module.css
      reports/
        ReportsPage.tsx
        ReportsPage.module.css
        LotDetailPage.tsx
        SerialDetailPage.tsx
        QcInspectionDetailPage.tsx
        QaSamplingDetailPage.tsx
        detailHelpers.tsx

    components/
      common/
      badges/
      reports/

    mocks/
      auth.mock.ts
      reports.mock.ts

    utils/
      logger.ts
      queryString.ts
      dateFormat.ts
      downloadFile.ts

    styles/
      global.css
```

## Dependencies

เพิ่ม dependencies หลัก:

```text
react
react-dom
react-router-dom
@tanstack/react-query
zod
lucide-react
vite
typescript
@vitejs/plugin-react
```

## Environment

ไฟล์ `frontend/.env` และ `frontend/.env.example`:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_USE_MOCK=false
```

## Routes

| Frontend Route | Status |
|---|---|
| `/login` | Implemented |
| `/dashboard` | Implemented |
| `/reports` | Implemented |
| `/reports/lots/:lotId` | Implemented |
| `/reports/serials/:productUnitId` | Implemented |
| `/reports/qc-inspections/:id` | Implemented |
| `/reports/qa-samplings/:id` | Implemented |

## API Mapping

| Frontend Feature | Backend API |
|---|---|
| Login | `POST /api/auth/login` |
| Current user | `GET /api/auth/me` |
| Dashboard summary | `GET /api/dashboard/summary` |
| QC summary | `GET /api/dashboard/qc-summary` |
| QA summary | `GET /api/dashboard/qa-summary` |
| Lot status | `GET /api/dashboard/lot-status` |
| Lot reports | `GET /api/reports/lots` |
| Serial reports | `GET /api/reports/serials` |
| QC reports | `GET /api/reports/qc-inspections` |
| QA reports | `GET /api/reports/qa-samplings` |
| Lot detail | `GET /api/reports/lots/:lotId` |
| Serial detail | `GET /api/reports/serials/:productUnitId` |
| QC detail | `GET /api/reports/qc-inspections/:id` |
| QA detail | `GET /api/reports/qa-samplings/:id` |
| QC export | `GET /api/exports/qc-inspections.csv/.xlsx/.pdf` |
| QA export | `GET /api/exports/qa-samplings.csv/.xlsx/.pdf` |
| Lot export | `GET /api/exports/lots.csv/.xlsx` |
| Detail PDF | `GET /api/exports/*/:id/pdf` |
| Audit export | `GET /api/exports/audit-trails.csv/.xlsx` |

## Permission Mapping

| UI Area | Permission |
|---|---|
| Dashboard | login required |
| Reports menu | `SearchReport` or `ADMIN` |
| Reports pages | `SearchReport` or `ADMIN` |
| Export buttons | backend enforces `SearchReport` |

Frontend ซ่อน menu/action ตาม permission แต่ Backend ยังเป็นตัว block จริงเสมอ

## Implemented UX / Error Rules

| Rule | Status |
|---|---|
| Token stored in `localStorage.access_token` | Implemented |
| API client attaches `Authorization: Bearer <token>` | Implemented |
| 401 clears token and redirects login | Implemented |
| 403 shows `No Permission` | Implemented |
| Error panel shows message and request_id if present | Implemented |
| Loading state | Implemented |
| Empty state | Implemented |
| Console log standard | Implemented |
| Do not log password/token | Implemented |
| Mock mode foundation | Implemented |

## Manual Test Commands and Results

### Step 1 - Backup Static Frontend

Command:

```powershell
cd D:\DevApp\production\PMPS
New-Item -ItemType Directory -Force .\manual-test-output\sprint11-backup
Copy-Item .\frontend\index.html .\manual-test-output\sprint11-backup\index-static-sprint8.html -Force
Copy-Item .\frontend\src .\manual-test-output\sprint11-backup\src-static-sprint8 -Recurse -Force
```

Result:

```text
PASS
manual-test-output/sprint11-backup/index-static-sprint8.html created
manual-test-output/sprint11-backup/src-static-sprint8 created
```

### Step 2 - Install Dependencies

Command:

```powershell
cd D:\DevApp\production\PMPS\frontend
$env:NODE_OPTIONS='--use-system-ca'
npm.cmd install
```

Result:

```text
PASS
added 75 packages
```

Note:

```text
npm audit reported 2 moderate severity vulnerabilities.
ยังไม่ได้รัน npm audit fix เพราะอาจเปลี่ยน major version ของ dependency
```

### Step 3 - Backend API Verification

Command:

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd start
```

Manual API checks:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/health"

$login = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{ username="admin"; password="Admin@123" } | ConvertTo-Json)

$headers = @{ Authorization = "Bearer $($login.data.access_token)" }

Invoke-RestMethod -Uri "http://localhost:3000/api/dashboard/summary" -Headers $headers
Invoke-RestMethod -Uri "http://localhost:3000/api/reports/lots?page=1&page_size=1" -Headers $headers
```

Result:

```text
Backend health   PASS HTTP 200 success=true
Backend login    PASS HTTP 200 user=admin
Dashboard API    PASS HTTP 200 total_lots=956
Reports API      PASS HTTP 200 returned=1
```

### Step 4 - Vite Dev Server

Command:

```powershell
cd D:\DevApp\production\PMPS\frontend
npm.cmd run dev -- --host 127.0.0.1 --port 5174
```

Result:

```text
PASS
VITE v5.4.21 ready
Local: http://127.0.0.1:5174/
```

Note:

```text
ใน automated shell ใช้ timeout เพื่อไม่ให้ dev server ค้าง session จึงหยุด process หลังเห็น Vite ready
```

### Step 5 - Build Test

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
dist/index.html created
dist/assets/index-*.css created
dist/assets/index-*.js created
```

Build output:

```text
dist/index.html                  0.39 kB
dist/assets/index-*.css          5.94 kB
dist/assets/index-*.js         284.89 kB
```

## Browser Manual Test Checklist

ให้ทดสอบต่อใน browser:

| Step | Expected |
|---|---|
| Open `/login` | Login page visible |
| Login `admin` / `Admin@123` | Redirect `/dashboard` |
| Check localStorage | `access_token` exists |
| Open `/dashboard` | Summary cards, QC/QA/Lot status visible |
| Click Refresh | Data reloads |
| Open `/reports` | Lots / Serials / QC / QA tabs visible |
| Search lot | Table updates |
| Change tab Serials | Serial API loads |
| Change tab QC | QC API loads |
| Change tab QA | QA API loads |
| Filter `status=APPROVED` | Query applies |
| Search no data | Empty state visible |
| Pagination next/prev | Page changes |
| Open lot detail | Lot header, serials, QC/QA summary visible |
| Open serial detail | QC/QA history visible |
| Open QC detail | Details, equipment, approval logs, edit history visible |
| Open QA detail | Sample units, details, approval logs, edit history visible |
| Export Lots CSV/XLSX | Browser downloads file |
| Export QC CSV/XLSX/PDF | Browser downloads file |
| Export QA CSV/XLSX/PDF | Browser downloads file |
| Export Audit CSV/XLSX | Browser downloads file |
| Remove token and reload | Redirect `/login` |
| User without `SearchReport` | Reports hidden or No Permission shown |

## Mock Mode

Mock files added:

```text
src/mocks/auth.mock.ts
src/mocks/reports.mock.ts
```

Manual command:

```powershell
cd D:\DevApp\production\PMPS\frontend

# edit .env
VITE_USE_MOCK=true

npm.cmd run dev
```

Expected:

```text
Mock login works
Mock dashboard data visible
Mock reports data visible
Console contains [MOCK]
```

## Known Limitations

1. Sprint 11 ยังไม่ทำ Master Data UI, Production Lot Create, QC Entry และ QA Entry ตาม scope ที่ตั้งไว้
2. Browser click-through manual test ต้องเปิดทดสอบใน browser จริงหลัง dev server running
3. Reports table ใช้ `<table>` ธรรมดาก่อน ยังไม่ได้ใช้ `@tanstack/react-table`
4. Export buttons เรียก backend download APIs แล้ว แต่ automated shell ไม่สามารถยืนยัน browser download UX ได้ ต้องทดสอบใน browser

## Next Sprint Suggestion

Sprint 12 ควรทำ Master Data UI:

```text
Product Category
Product Sub Category
Product Model
Equipment Type
Equipment Master
Model Required Equipment
Test Template
```

เหตุผล: Backend Master Data API พร้อมแล้ว และ frontend_development_guide.md ระบุ Master Data เป็น module หลักถัดไปของระบบ
