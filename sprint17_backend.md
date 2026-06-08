# Sprint 17 - Lot Test Planning Dashboard

## Goal

เพิ่ม Lot Test Planning Dashboard สำหรับวางแผนและติดตามงานทดสอบของ Production Lot โดยมี 2 มุมมอง:

- Waterfall View: เห็นลำดับงาน QC / QA / Review / Approve / Report ของแต่ละ Lot
- Calendar View: เห็น task ตามวันและช่วงเวลา

## Backend Implementation

### Migration

เพิ่ม migration:

- `server/migrations/1780934400000_sprint17-lot-test-planning.js`

ตารางใหม่:

- `lot_test_plan`
- `lot_test_plan_task`

Permission ใหม่:

- `PlanningView`
- `PlanningManage`

ADMIN role จะได้รับ permission ทั้ง 2 รายการโดยอัตโนมัติหลัง migration

### Planning API

เพิ่ม module:

- `server/src/modules/planning/planning.repository.js`
- `server/src/modules/planning/planning.service.js`
- `server/src/modules/planning/planning.controller.js`
- `server/src/modules/planning/planning.routes.js`
- `server/src/modules/planning/planning.schema.js`

Endpoints:

- `GET /api/planning/plans`
- `GET /api/planning/plans/:id`
- `POST /api/planning/plans`
- `PUT /api/planning/plans/:id`
- `DELETE /api/planning/plans/:id`
- `POST /api/planning/plans/:id/tasks`
- `PUT /api/planning/tasks/:taskId`
- `DELETE /api/planning/tasks/:taskId`

Permission:

- View dashboard: `PlanningView` หรือ `SearchReport`
- Create/Edit/Delete plan: `PlanningManage`
- Add/Edit/Delete task: `PlanningManage`

เพิ่ม RBAC helper:

- `requireAnyPermission(['PlanningView', 'SearchReport'])`

### Planning Logic

เมื่อสร้าง plan สามารถเลือก `create_default_tasks = true` เพื่อสร้าง task อัตโนมัติ:

- Lot Created
- QC Inspection
- QC Review
- QC Approve
- QA Sampling
- Report Ready

Dashboard API คืนข้อมูล:

- `summary`
- `plans`
- `calendar_events`

ระบบคำนวณ:

- `delayed` จาก planned end ที่เลยวันปัจจุบันและยังไม่ completed/cancelled
- QC progress จาก `inspection_header`
- QA progress จาก `qa_sampling_header` + `qa_sample_unit`
- calendar events จาก tasks ของแต่ละ plan

## Frontend Implementation

เพิ่ม API client:

- `frontend/src/api/planning.api.ts`

เพิ่มหน้า:

- `frontend/src/pages/dashboard/PlanningDashboardPage.tsx`

เพิ่ม route:

- `/dashboard/planning`

เพิ่ม Sidebar menu:

- `Lot Planning`

เพิ่ม CSS:

- Planning filters
- Summary cards
- Waterfall board
- Calendar board
- Task status styling

Frontend capabilities:

- Search/filter plan by search, model, lot, status, date range
- Switch Waterfall / Calendar view
- Create plan
- Create default tasks
- Add/Edit task
- Open related page:
  - QC task -> `/qc/inspection/lots/:lotId`
  - QA task -> `/qa/sampling/lots/:lotId`
  - Report task -> `/reports/lots/:lotId`
  - Lot task -> `/production-lots/:lotId`

## Validation Rules

Plan:

- `lot_id` required
- `planned_start_date` required
- `planned_end_date` required
- `planned_end_date >= planned_start_date`
- `priority` must be `LOW`, `NORMAL`, `HIGH`, `URGENT`
- one active plan per lot by unique `lot_id`

Task:

- `task_type` required
- `task_name` required
- `planned_end_datetime >= planned_start_datetime`
- `task_status` must be valid
- `source_type` must be `QC`, `QA`, `REPORT`, `LOT` if provided

## Manual Test Commands

### Step 1 - Apply Migration

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd run migrate:up
```

Expected:

- migration complete
- `lot_test_plan` created
- `lot_test_plan_task` created
- permissions `PlanningView`, `PlanningManage` created

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
```

Expected:

- status 200
- ได้ access token

### Step 3 - Get Planning Dashboard

```powershell
curl.exe "http://localhost:3000/api/planning/plans?date_from=2026-06-01&date_to=2026-12-31" `
  -H "Authorization: Bearer $token"
```

Expected:

- status 200
- มี `summary`
- มี `plans`
- มี `calendar_events`

### Step 4 - Create Plan

เปลี่ยน `<LOT_ID>` เป็น id ของ production lot ที่ต้องการวางแผน

```powershell
$body = @{
  lot_id = <LOT_ID>
  plan_name = "Manual Lot Test Plan"
  priority = "HIGH"
  planned_start_date = "2026-06-10"
  planned_end_date = "2026-06-14"
  create_default_tasks = $true
} | ConvertTo-Json

$plan = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/planning/plans" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $body

$planId = $plan.data.id
```

Expected:

- status 201
- plan created
- default tasks created
- appears in Waterfall view

### Step 5 - Add Task

```powershell
$body = @{
  task_type = "CUSTOM"
  task_name = "Manual Follow Up"
  task_status = "PLANNED"
  source_type = "LOT"
  source_id = <LOT_ID>
  planned_start_datetime = "2026-06-11T08:00:00.000Z"
  planned_end_datetime = "2026-06-11T17:00:00.000Z"
  remark = "Manual test task"
} | ConvertTo-Json

curl.exe "http://localhost:3000/api/planning/plans/$planId/tasks" `
  -X POST `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d $body
```

Expected:

- status 201
- task appears in Waterfall
- task appears in Calendar

### Step 6 - Delayed Status Test

```powershell
$body = @{
  task_type = "CUSTOM"
  task_name = "Past Due Task"
  task_status = "PLANNED"
  source_type = "LOT"
  source_id = <LOT_ID>
  planned_start_datetime = "2026-01-01T08:00:00.000Z"
  planned_end_datetime = "2026-01-01T17:00:00.000Z"
} | ConvertTo-Json

curl.exe "http://localhost:3000/api/planning/plans/$planId/tasks" `
  -X POST `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d $body
```

Expected:

- task `derived_status = DELAYED`
- dashboard summary `delayed` increases

### Step 7 - Frontend Manual Test

Open:

```text
http://localhost:5173/dashboard/planning
```

Expected:

- Lot Planning menu appears
- Create Plan works
- Waterfall view shows plan tasks
- Calendar view shows task events
- Clicking task opens task modal
- Open QC routes to `/qc/inspection/lots/:lotId`
- Open QA routes to `/qa/sampling/lots/:lotId`
- Open Report routes to `/reports/lots/:lotId`

## Automated Test Result

### Test DB Migration

Command:

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd run migrate:test:up
```

Result:

- PASS
- Sprint17 migration applied to test DB

### Dev DB Migration

Command:

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd run migrate:up
```

Result:

- PASS
- Sprint17 migration applied to dev DB

### Backend Integration Test

Command:

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd test -- --runInBand
```

Result:

- PASS
- suites: 10
- tests: 82
- pass: 82
- fail: 0

### Frontend Build

Command:

```powershell
cd D:\DevApp\production\PMPS\frontend
npm.cmd run build
```

Result:

- PASS
- TypeScript compile ผ่าน
- Vite production build ผ่าน

## Sprint 17 Status

Sprint 17 Core = PASS

- DB migration = implemented
- Planning API = implemented
- Waterfall data API = implemented
- Calendar events API = implemented
- Frontend planning page = implemented
- Create Plan modal = implemented
- Add/Edit Task modal = implemented
- QC/QA/Report links = implemented
- Integration tests = PASS
- Frontend build = PASS
