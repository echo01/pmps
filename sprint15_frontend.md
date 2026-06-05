# Sprint 15 Frontend - Edit Result UI + Audit Review

## Goal

Sprint 15 adds frontend support for safe approved-result editing.

The workflow follows the backend Sprint 9 design:

```text
APPROVED
-> Request Edit
-> EDIT_REQUESTED
-> Apply Edit
-> SUBMITTED
-> REVIEWED
-> APPROVED
```

Direct editing of APPROVED records is not allowed. All changes must go through request/apply edit so old values, new values, reason, editor, and status history are stored in audit logs.

## Implemented

### API Layer

Updated:

- `frontend/src/api/qc.api.ts`
- `frontend/src/api/qa.api.ts`

Added QC API functions:

```ts
requestEditInspection(id, { reason })
applyEditInspection(id, { reason, items })
getInspectionEditHistory(id)
```

Added QA API functions:

```ts
requestEditSampling(id, { reason })
applyEditSampling(id, { reason, items })
getSamplingEditHistory(id)
```

Added shared types:

- `ApprovedResultEditPayload`
- `ApprovedResultEditItemPayload`
- `EditHistoryRow`

### Shared Components

Added:

- `frontend/src/components/edit-result/EditRequestModal.tsx`
- `frontend/src/components/edit-result/ApplyEditPanel.tsx`
- `frontend/src/components/edit-result/EditResultGrid.tsx`
- `frontend/src/components/edit-result/EditHistoryPanel.tsx`
- `frontend/src/components/edit-result/EditStatusBanner.tsx`
- `frontend/src/components/edit-result/editResultTypes.ts`

Component responsibilities:

- `EditRequestModal`
  - Collects required reason before calling request edit API.
- `EditStatusBanner`
  - Highlights EDIT_REQUESTED state and latest reason.
- `ApplyEditPanel`
  - Shows editable result grid and apply reason.
- `EditResultGrid`
  - Shows old value, new value, old result, and new preview.
- `EditHistoryPanel`
  - Shows REQUESTED/APPLIED audit trail with old/new values and reason.

### QC Pages

Updated:

- `frontend/src/pages/qc/QcLotInspectionPage.tsx`
- `frontend/src/pages/qc/QcInspectionPage.tsx`

QC behavior:

- APPROVED record shows `Request Edit` when user has `EditTestResult`.
- Request Edit opens modal with required reason.
- Successful request changes backend status to `EDIT_REQUESTED`.
- EDIT_REQUESTED record shows `Apply Edited Result`.
- Apply Edit grid supports changing measured value/text and remark.
- New preview is calculated in UI before apply.
- Successful apply edit returns backend status to `SUBMITTED`.
- Existing Review / Approve flow is reused after apply edit.
- Edit History panel shows REQUESTED/APPLIED audit logs.
- Non-DRAFT direct detail records render read-only result grids.

### QA Pages

Updated:

- `frontend/src/pages/qa/QaLotSamplingPage.tsx`
- `frontend/src/pages/qa/QaSamplingPage.tsx`

QA behavior:

- APPROVED sampling shows `Request Edit` when user has `EditTestResult`.
- Request Edit opens modal with required reason.
- EDIT_REQUESTED sampling shows `Apply Edited Result`.
- Apply Edit grid supports multiple sample units grouped by sample/serial label.
- New preview is calculated per detail row.
- Successful apply edit returns backend status to `SUBMITTED`.
- Existing Review / Approve flow is reused after apply edit.
- Edit History panel shows REQUESTED/APPLIED audit logs.
- Non-DRAFT direct detail records render read-only result grids.

## Permission Rules

| UI Action | Permission |
|---|---|
| Request Edit | `EditTestResult` |
| Apply Edit | `EditTestResult` |
| View Edit History | `SearchReport` |
| Review after Apply Edit | `QCInspection` / `QASampling` |
| Approve after Apply Edit | `QCInspection` / `QASampling` |

Users without `EditTestResult` can still view records if their page permission allows it, but they do not see Request Edit or Apply Edit actions.

## Result Preview Rules

Sprint 15 reuses the existing preview logic:

- NUMERIC
  - empty = `N/A`
  - below min = `FAIL`
  - above max = `FAIL`
  - within spec = `PASS`
- BOOLEAN
  - `OK`, `PASS`, `YES`, `TRUE` = `PASS`
  - `NG`, `FAIL`, `NO`, `FALSE` = `FAIL`
  - otherwise = `N/A`
- TEXT
  - empty = `N/A`
  - has value = `PASS`

## Manual Test

### Step 1 - Start Backend / Frontend

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd start

cd D:\DevApp\production\PMPS\frontend
npm.cmd run dev
```

Expected:

```text
Backend runs on http://localhost:3000
Frontend runs on http://localhost:5173
```

### Step 2 - Login

```text
username: admin
password: Admin@123
```

Expected:

```text
Login success
User has EditTestResult permission
```

### Step 3 - QC Request Edit

Open:

```text
/qc/inspection/lots/:lotId
```

Select an APPROVED serial.

Expected:

```text
Result grid is read-only
Request Edit button is visible
Edit History panel is visible when user has SearchReport
```

Click `Request Edit`, enter:

```text
Retest value after abnormal reading
```

Expected:

```text
POST /api/qc/inspections/:id/edit-request
Status changes to EDIT_REQUESTED
Table action changes to View Edit / Apply Edit
Edit History contains REQUESTED
```

### Step 4 - QC Apply Edit

Select the EDIT_REQUESTED serial.

Expected:

```text
Edit requested banner is visible
Apply Edited Result panel is visible
Old Value / New Value / Old Result / New Preview columns are visible
```

Change at least one result value, enter reason:

```text
Apply QC retest value
```

Click `Apply Edit`.

Expected:

```text
POST /api/qc/inspections/:id/apply-edit
Status changes to SUBMITTED
Overall result is recalculated
Edit History contains APPLIED
Row action changes to Review
```

### Step 5 - QC Re-review / Re-approve

Use existing workflow:

```text
Review
Approve
```

Expected:

```text
SUBMITTED -> REVIEWED -> APPROVED
```

### Step 6 - QA Request Edit

Open:

```text
/qa/sampling/lots/:lotId
```

Select an APPROVED QA sampling row.

Expected:

```text
Result grids are read-only
Request Edit button is visible
Edit History panel is visible when user has SearchReport
```

Submit request reason.

Expected:

```text
POST /api/qa/samplings/:id/edit-request
Status changes to EDIT_REQUESTED
Edit History contains REQUESTED
```

### Step 7 - QA Apply Edit

Select the EDIT_REQUESTED QA sampling row.

Expected:

```text
Apply Edited Result panel is visible
Rows are grouped by sample/serial label
```

Change at least one sample detail value and apply edit.

Expected:

```text
POST /api/qa/samplings/:id/apply-edit
Status changes to SUBMITTED
Unit result and overall result are recalculated
Edit History contains APPLIED
```

### Step 8 - QA Re-review / Re-approve

Use existing workflow:

```text
Review
Approve
```

Expected:

```text
SUBMITTED -> REVIEWED -> APPROVED
```

### Step 9 - Permission Check

Login with a user without `EditTestResult`.

Expected:

```text
APPROVED records can be viewed when page permission allows
Request Edit button is hidden
Apply Edit panel is hidden
Direct API call returns 403
```

### Step 10 - Validation Check

Request Edit with empty reason.

Expected:

```text
reason is required
```

Apply Edit without changing any item.

Expected:

```text
At least one item must be changed
```

Apply Edit without reason.

Expected:

```text
reason is required
```

## Automated Test Result

```text
PASS npm.cmd run build
```

Build includes:

```text
tsc --noEmit
vite build
```

## Done Criteria

- APPROVED QC shows Request Edit for `EditTestResult`.
- QC Request Edit changes status to EDIT_REQUESTED.
- EDIT_REQUESTED QC shows Apply Edited Result.
- QC Apply Edit changes status to SUBMITTED.
- QC Edit History shows REQUESTED/APPLIED audit rows.
- QC must Review/Approve again after apply edit.
- APPROVED QA shows Request Edit for `EditTestResult`.
- QA Request Edit changes status to EDIT_REQUESTED.
- EDIT_REQUESTED QA shows Apply Edited Result.
- QA Apply Edit changes status to SUBMITTED.
- QA Edit History shows REQUESTED/APPLIED audit rows.
- QA must Review/Approve again after apply edit.
- User without `EditTestResult` does not see Request/Apply Edit.
- Validation handles empty reason and no changed items.
- Field-level backend errors are shown by `ErrorAlert`.
- Frontend build passes.

