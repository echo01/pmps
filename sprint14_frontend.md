# Sprint 14 Frontend - QC / QA Transaction Entry UI

## Scope

Sprint 14 adds real transaction entry screens for QC Inspection and QA Sampling.

Implemented:

- QC Inspection entry page: `/qc/inspection`
- QC Inspection detail/edit/workflow page: `/qc/inspection/:inspectionId`
- QA Sampling entry page: `/qa/sampling`
- QA Sampling detail/edit/workflow page: `/qa/sampling/:qaSamplingId`
- Sidebar menu items with permissions:
  - `QCInspection`
  - `QASampling`
- API clients:
  - `frontend/src/api/qc.api.ts`
  - `frontend/src/api/qa.api.ts`
- Shared transaction components:
  - `ApprovalActions`
  - `EquipmentSelector`
  - `EquipmentCheckPanel`
  - `ResultGrid`
  - `ResultInputCell`
- Result preview helper:
  - `frontend/src/utils/resultPreview.ts`
- DB compatibility migration for dev/test transaction tables:
  - `server/migrations/1780848000000_sprint14-transaction-created-at-columns.js`

## Result Preview Rules

```text
NUMERIC:
- empty = N/A
- less than spec_min = FAIL
- more than spec_max = FAIL
- in spec = PASS

BOOLEAN:
- OK / PASS / YES / TRUE = PASS
- NG / FAIL / NO / FALSE = FAIL
- empty or other value = N/A

TEXT:
- empty = N/A
- has value = PASS
```

## Manual Test Commands

### Step 1 - Login

```powershell
$loginBody = @{
  username = "admin"
  password = "Admin@123"
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $loginBody

$headers = @{ Authorization = "Bearer $($login.data.access_token)" }
```

Result:

```text
PASS
HTTP 200
```

### Step 2 - QC Data Load

```powershell
$qcLots = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/qc/lots?search=Assy" `
  -Headers $headers

$lot = @($qcLots.data)[0]

$qcUnits = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/qc/lots/$($lot.id)/units" `
  -Headers $headers

$qcTemplates = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/qc/models/$($lot.model_id)/templates" `
  -Headers $headers

$qcItems = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/qc/templates/$(@($qcTemplates.data)[0].id)/items" `
  -Headers $headers
```

Result:

```text
PASS
LotId = 12
LotNumber = Assy/2601/0902
UnitCount = 100
QcTemplateCount = 3
QcSectionCount = 1
```

### Step 3 - QA Data Load

```powershell
$qaTemplates = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/qa/models/$($lot.model_id)/templates" `
  -Headers $headers

$qaItems = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/qa/templates/$(@($qaTemplates.data)[0].id)/items" `
  -Headers $headers
```

Result:

```text
PASS
QaTemplateCount = 1
QaSectionCount = 1
```

### Step 4 - Equipment Load

```powershell
$equipment = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/models/$($lot.model_id)/available-equipment" `
  -Headers $headers
```

Result:

```text
PASS
AvailableEquipmentCount = 1
```

### Step 5 - QC Save Draft / Submit

Executed with UI-equivalent payload:

```text
POST /api/qc/inspections
GET  /api/qc/inspections/110/equipment-check
POST /api/qc/inspections/110/submit
```

Result:

```text
PASS
QcInspectionId = 110
Create status = DRAFT
Overall result = PASS
Equipment valid = true
Submit status = SUBMITTED
```

### Step 6 - QA Save Draft / Submit

Executed with UI-equivalent payload:

```text
POST /api/qa/samplings
GET  /api/qa/samplings/4/equipment-check
POST /api/qa/samplings/4/submit
```

Result:

```text
PASS
QaSamplingId = 4
Create status = DRAFT
Overall result = PASS
Equipment valid = true
Submit status = SUBMITTED
```

### Step 7 - Frontend Browser Checklist

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd start

cd D:\DevApp\production\PMPS\frontend
npm.cmd run dev
```

Checklist:

| Step | Expected |
|---|---|
| Open `/qc/inspection` | QC Inspection page loads |
| Search lot | Lot table loads and console logs `[QC][LOTS_LOAD][START]` |
| Select lot | Serial/template/equipment areas become usable |
| Select serial | Console logs `[QC][SERIAL_SELECT]` |
| Select QC template | Result grid appears |
| Enter numeric/boolean/text values | Preview badge changes PASS/FAIL/N/A |
| Select equipment | Equipment table checkbox toggles |
| Save Draft | API success and redirect to `/qc/inspection/:inspectionId` |
| Run Equipment Check | Validation panel shows PASS/FAIL counts |
| Submit/Review/Approve/Reject | Buttons enable by current status |
| Open `/qa/sampling` | QA Sampling page loads |
| Select lot/template/sample units | Sample result grids appear |
| Save Draft | API success and redirect to `/qa/sampling/:qaSamplingId` |
| Run Equipment Check | Validation panel shows PASS/FAIL counts |
| Submit/Review/Approve/Reject | Buttons enable by current status |

## Automated Test Results

```text
PASS npm.cmd run migrate:up
PASS npm.cmd run migrate:test:up
PASS npm.cmd run build
PASS npm.cmd test -- --runInBand
```

Backend integration result:

```text
tests 66
pass 66
fail 0
```

Frontend build result:

```text
tsc --noEmit PASS
vite build PASS
```

## Notes

- Template item endpoints return section groups, so the frontend API layer flattens `sections[].items[]` before rendering the result grid.
- Equipment check endpoints return validation directly in `data`, so `EquipmentCheckPanel` reads `data.valid` and `data.summary`.
- Sprint 14 does not include approved-result edit UI. That remains covered by Sprint 9 backend/report flow.
