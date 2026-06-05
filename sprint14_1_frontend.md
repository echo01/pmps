# Sprint 14.1 Frontend - QC Lot-Based Inspection UI Refinement

## Goal

Sprint 14.1 refines QC Inspection from a direct form-first flow into a lot-first workflow.

New QC flow:

```text
QC Inspection menu
-> Lot Search
-> Open Lot
-> Serial status table for the whole lot
-> Select serial
-> Start / Continue / Review / Approve / View inspection
```

## Implemented

- `/qc/inspection`
  - now opens QC Lot Search page.
- `/qc/inspection/lots`
  - alternate QC Lot Search route.
- `/qc/inspection/lots/:lotId`
  - new lot-based serial inspection page.
- `/qc/inspection/:inspectionId`
  - kept for opening a single inspection record directly.
- Added backend endpoint:
  - `GET /api/qc/lots/:lotId/inspection-status`
- Added frontend pages:
  - `frontend/src/pages/qc/QcLotSearchPage.tsx`
  - `frontend/src/pages/qc/QcLotInspectionPage.tsx`
- Updated result grid to support read-only mode for non-DRAFT statuses.
- Added integration tests for the new inspection-status endpoint.
- Added QA lot-based sampling flow using the same operator pattern as QC:
  - `/qa/sampling`
  - `/qa/sampling/lots`
  - `/qa/sampling/lots/:lotId`
- Added backend endpoint:
  - `GET /api/qa/lots/:lotId/sampling-status`
- Added frontend pages:
  - `frontend/src/pages/qa/QaLotSearchPage.tsx`
  - `frontend/src/pages/qa/QaLotSamplingPage.tsx`
- Updated shared transaction components:
  - `frontend/src/components/transaction/EquipmentSelector.tsx`
  - `frontend/src/components/transaction/EquipmentCheckPanel.tsx`
  - `frontend/src/components/transaction/ResultGrid.tsx`
  - `frontend/src/components/transaction/ResultInputCell.tsx`
- Updated common error display:
  - `frontend/src/components/common/ErrorAlert.tsx`
- Updated backend schemas so QC/QA can save without equipment when the selected model has no mandatory equipment rule:
  - `server/src/modules/qc-inspections/qc-inspections.schema.js`
  - `server/src/modules/qa-sampling/qa-sampling.schema.js`

## Development Summary

Sprint 14.1 changes the operator experience from record-first to lot-first.

Before this sprint, QC/QA users could open a form directly, but it was hard to see the status of every serial in the lot. The new flow makes the lot the main work area:

```text
Search lot
-> Open lot
-> See all serials/samples and workflow status
-> Pick one serial/sample
-> Work in the form
-> Return to the table after workflow action
```

Main development changes:

- Added lot status APIs for QC and QA.
- Added lot search pages for QC and QA.
- Added lot detail working pages for QC inspection and QA sampling.
- Added progress score bar based on started/processed serials.
- Added table pagination with 10 rows per page.
- Added column filters on serial/sample tables.
- Added scroll behavior between table and form.
- Added read-only rendering for non-editable workflow statuses.
- Added equipment requirement awareness in the form.
- Kept existing direct detail routes for compatibility.
- Improved validation error display so backend field-level errors are visible in the UI.

Important design decision:

- QC Inspection is one inspection per product unit/serial.
- QA Sampling remains one sampling header with multiple sample units.
- QC and QA share the same Required Equipment rule source: `Model Required Equipment`.

## Backend API

### GET `/api/qc/lots`

Supports filters:

```text
search
lot_number
model_code
status
date_from
date_to
```

### GET `/api/qc/lots/:lotId/inspection-status`

Response shape:

```json
{
  "lot": {
    "id": 12,
    "lot_number": "Assy/2601/0902",
    "model_id": 5,
    "model_code": "CMA-003",
    "product_name": "..."
  },
  "summary": {
    "not_started": 98,
    "draft": 1,
    "submitted": 1,
    "reviewed": 0,
    "approved": 0,
    "rejected": 0,
    "edit_requested": 0
  },
  "serials": [
    {
      "product_unit_id": 1093,
      "serial_number": "...",
      "unit_status": "CREATED",
      "inspection_id": 110,
      "inspection_no": 1,
      "template_id": 9,
      "template_name": "Final QC",
      "qc_status": "DRAFT",
      "overall_result": "PASS",
      "updated_at": "2026-06-04T..."
    }
  ]
}
```

### GET `/api/qa/lots`

Supports filters:

```text
search
lot_number
model_code
status
date_from
date_to
```

### GET `/api/qa/lots/:lotId/sampling-status`

Response shape:

```json
{
  "lot": {
    "id": 12,
    "lot_number": "Assy/2601/0902",
    "model_id": 5,
    "model_code": "CMA-003",
    "product_name": "...",
    "serial_count": 100
  },
  "summary": {
    "not_started": 98,
    "draft": 2,
    "submitted": 0,
    "reviewed": 0,
    "approved": 0,
    "rejected": 0,
    "edit_requested": 0
  },
  "samples": [
    {
      "product_unit_id": 1093,
      "serial_number": "...",
      "qa_sampling_id": 70,
      "sampling_no": 1,
      "template_id": 9,
      "template_name": "Final QA",
      "qa_status": "DRAFT",
      "unit_result": "PASS",
      "overall_result": "PASS",
      "updated_at": "2026-06-04T..."
    }
  ]
}
```

## UI Behavior

### Page 1 - QC Lot Search

Route:

```text
/qc/inspection
/qc/inspection/lots
```

Features:

- Search by lot/model/product.
- Filter by lot number, model code, status, date from, date to.
- Lot table shows lot number, model, product, lot qty, serial count, status.
- `Open Lot` routes to `/qc/inspection/lots/:lotId`.

Console logs:

```text
[QC_LOT_PAGE][LOAD][START]
[QC_LOT_PAGE][LOAD][API_SUCCESS]
[QC_LOT_PAGE][LOT_OPEN]
```

### Page 2 - QC Lot Serial Inspection

Route:

```text
/qc/inspection/lots/:lotId
```

Features:

- Lot header.
- Summary cards:
  - Not Started
  - Draft
  - Submitted
  - Reviewed
  - Approved
  - Rejected
- Lot-level inspection setup for the whole lot.
- Serial table for the whole lot.
- Row action labels:
  - `NOT_STARTED` -> Start Inspect
  - `DRAFT` -> Continue Draft
  - `SUBMITTED` -> Review
  - `REVIEWED` -> Approve / Reject
  - `APPROVED` -> View
  - `REJECTED` -> View
  - `EDIT_REQUESTED` -> View Edit
- Form panel is bound to selected serial.
- New `NOT_STARTED` serials use the current lot-level setup values.
- Existing inspection rows can load their saved template, inspection no, equipment, result values, and remark.
- `APPROVED`, `SUBMITTED`, `REVIEWED`, `REJECTED` rows render read-only result inputs.
- Save Draft is visible only for `NOT_STARTED` and `DRAFT`.

Updated layout:

```text
-------------------------------------------------
| Lot Inspection Setup                          |
| Template / Station / Remark                   |
| Equipment Selector                            |
-------------------------------------------------
-------------------------------------------------
| Serials in Lot                                |
| - Score bar                                   |
| - Column filters                              |
| - 10 rows per page                            |
-------------------------------------------------
-------------------------------------------------
| Inspection Form                               |
| Selected serial / Inspection No / Result input / Equipment Check |
| Save Draft / Submit / Review / Approve / Reject  |
-------------------------------------------------
```

Lot inspection setup behavior:

- Template, Station, Remark, and Equipment are placed before `Serials in Lot`.
- These values are treated as the default setup for the lot.
- When the operator clicks `Start Inspect` on a `NOT_STARTED` serial, the form uses the current lot-level setup automatically.
- The setup is not cleared when moving from one `NOT_STARTED` serial to another.
- This prevents the operator from selecting the same template, station, and equipment repeatedly for every serial in the same lot.
- When the operator opens an existing inspection row, saved setup data from that inspection can populate the setup controls so the displayed result stays aligned with the stored record.
- The setup controls remain available above the serial table so the operator can adjust the default before starting the next serial.

Inspection No behavior:

- `Inspection No` is displayed inside `Inspection Form`.
- The value is read-only in the UI.
- The value is taken from the selected row `No.` in `Serials in Lot`.
- The row number is based on the serial position in the full lot, so it stays stable even when table filters or pagination are used.
- Example: selecting serial row `No. 4` sets `Inspection No = 4`.

Serial table behavior:

- The table displays 10 serials per page.
- The score bar shows inspection progress:
  - Formula: `(serials already inspected / total serials in lot) * 100`.
  - `NOT_STARTED` is counted as not inspected.
  - `DRAFT`, `SUBMITTED`, `REVIEWED`, `APPROVED`, `REJECTED`, and `EDIT_REQUESTED` are counted as inspected/started.
- Column filters are available in the table header:
  - No.
  - Serial
  - QC Status
  - Result
  - Template
  - Updated
  - Action
- Text filters use contains matching.
- Status, Result, and Action use dropdown filters.
- When any filter is active, the footer shows filtered count and displays `Clear Filters`.

Scroll behavior:

- Clicking any row Action button selects the serial and scrolls the page to `Inspection Form`.
- After `Submit`, `Review`, `Approve`, or `Reject` succeeds, the page scrolls back to `Serials in Lot`.
- This keeps the operator focused on the current work area:
  - choose serial from table
  - enter or review result in form
  - complete workflow action
  - return to serial list to continue the next item

Inspection form behavior:

- `NOT_STARTED`
  - opens an editable new inspection form.
  - uses the lot-level Template, Station, Remark, and Equipment values.
  - uses the selected serial row `No.` as `Inspection No`.
  - user enters result values and saves draft.
- `DRAFT`
  - opens the existing draft with saved setup values, equipment, result values, and remark.
  - user can edit and save draft again.
- `SUBMITTED`
  - opens read-only result data.
  - Review and Reject actions are available based on permission.
- `REVIEWED`
  - opens read-only result data.
  - Approve and Reject actions are available based on permission.
- `APPROVED`, `REJECTED`
  - opens read-only result data.
  - Save Draft is hidden.
- `EDIT_REQUESTED`
  - opens the inspection for edit-review flow visibility.

Workflow action behavior:

- `Save Draft`
  - saves entered QC result values.
  - sends the current lot-level setup values with the selected serial.
  - sends `Inspection No` from the selected serial row `No.`.
  - creates a new inspection if the selected serial has no inspection yet.
  - updates the existing inspection if the selected serial already has a DRAFT inspection.
- `Submit`
  - moves DRAFT inspection to SUBMITTED.
- `Review`
  - moves SUBMITTED inspection to REVIEWED.
- `Approve`
  - moves REVIEWED inspection to APPROVED.
- `Reject`
  - rejects SUBMITTED or REVIEWED inspection.
  - reject remark is required by the workflow action component.

Run Equipment Check:

- `Run Equipment Check` validates the equipment assigned to the selected inspection.
- It is used to confirm that selected equipment is suitable before completing workflow actions.
- Expected validation scope:
  - selected equipment matches required equipment for the model/template.
  - equipment is active.
  - calibration is still valid.
  - required equipment is complete.
- The result is displayed in `EquipmentCheckPanel`.
- This check does not replace Save Draft; it is a supporting validation before Submit/Review/Approve.

Equipment requirement behavior:

- Required equipment is not configured inside QC Inspection directly.
- QC reads equipment rules from `Model Required Equipment` by `lot.model_id`.
- The equipment selector is shown in `Lot Inspection Setup`.
- Selected equipment is reused for new serial inspections in the same lot until the operator changes it.
- If the model has mandatory required equipment:
  - the form requires at least the configured quantity of valid equipment.
  - Save Draft is disabled until equipment is selected.
  - backend validates the selected equipment again on Save/Submit/Approve.
- If the model has no required equipment:
  - the UI displays `No equipment required for this model`.
  - Save Draft can be completed with `equipment_ids: []`.
  - backend accepts the empty equipment list and still keeps service-level validation available.
- If required equipment exists but no active/calibrated equipment is available:
  - the UI displays that required equipment is not available.
  - workflow completion should be blocked until valid equipment master data is prepared.

Required equipment setup flow:

```text
Equipment Types
-> Equipment Master
-> Required Equipment
-> QC Inspection / QA Sampling
```

Example:

```text
Product Model: CMA-003
Equipment Type: DMM
Required Qty: 1
Mandatory: Yes
```

The system then allows QC/QA operators to select active DMM equipment for lots using model `CMA-003`.

### Page 3 - QA Lot Search

Route:

```text
/qa/sampling
/qa/sampling/lots
```

Features:

- Search by lot/model/product.
- Filter by lot number, model code, status, date from, date to.
- Lot table shows lot number, model, product, lot qty, serial count, status.
- `Open Lot` routes to `/qa/sampling/lots/:lotId`.

Console logs:

```text
[QA_LOT_PAGE][LOAD][START]
[QA_LOT_PAGE][LOAD][API_SUCCESS]
[QA_LOT_PAGE][LOT_OPEN]
```

### Page 4 - QA Lot Sampling

Route:

```text
/qa/sampling/lots/:lotId
```

QA uses the same operator layout as QC but keeps the QA data model intact: one QA sampling header can contain multiple sample units.

Updated layout:

```text
-------------------------------------------------
| Lot Sampling Setup                            |
| Template / Method / Station                   |
| Remark / Equipment Selector                   |
-------------------------------------------------
-------------------------------------------------
| Samples in Lot                                |
| - Score bar                                   |
| - Column filters                              |
| - 10 rows per page                            |
-------------------------------------------------
-------------------------------------------------
| QA Sampling Form                              |
| Selected samples / Sampling No / Result input / Equipment Check |
| Save Draft / Submit / Review / Approve / Reject   |
-------------------------------------------------
```

Lot sampling setup behavior:

- Template, Method, Station, Remark, and Equipment are placed before `Samples in Lot`.
- These values are treated as the default setup for the lot sampling set.
- When the operator clicks `Add Sample` on a `NOT_STARTED` serial, the form uses the current lot-level setup automatically.
- The setup is not cleared when adding more `NOT_STARTED` serials into the same sampling set.
- This prevents the operator from selecting the same template, method, station, and equipment repeatedly for every sample in the same lot.
- When the operator opens an existing QA sampling record, saved setup data from that record can populate the setup controls so the displayed sampling stays aligned with the stored record.
- If the operator starts a new sampling set after viewing a read-only sampling record, the selected samples and result drafts are reset, but the lot-level setup remains available for reuse.

Sampling No behavior:

- `Sampling No` is displayed inside `QA Sampling Form`.
- The value is read-only in the UI.
- The value is taken from the selected row `No.` in `Samples in Lot`.
- The row number is based on the serial position in the full lot, so it stays stable even when table filters or pagination are used.
- Example: selecting sample row `No. 4` sets `Sampling No = 4`.

Sample table behavior:

- The table displays 10 serials per page.
- The score bar shows QA sampling activity progress:
  - Formula: `(serials with QA sampling activity / total serials in lot) * 100`.
  - `NOT_STARTED` is counted as not sampled.
  - `DRAFT`, `SUBMITTED`, `REVIEWED`, `APPROVED`, `REJECTED`, and `EDIT_REQUESTED` are counted as sampled/started.
- Column filters are available in the table header:
  - No.
  - Serial
  - QA Status
  - Result
  - Template
  - Updated
  - Action
- Text filters use contains matching.
- Status, Result, and Action use dropdown filters.
- When any filter is active, the footer shows filtered count and displays `Clear Filters`.

QA action behavior:

- `NOT_STARTED` -> Add Sample
  - adds the serial into the current editable sampling set.
  - if no sampling set is active, starts a new draft sampling set in the form.
- `DRAFT` -> Continue Draft
  - loads the existing QA sampling record.
  - all sample units in that sampling set are populated in the form.
- `SUBMITTED` -> Review
  - loads the sampling record read-only.
  - Review and Reject are available based on permission.
- `REVIEWED` -> Approve / Reject
  - loads the sampling record read-only.
  - Approve and Reject are available based on permission.
- `APPROVED`, `REJECTED` -> View
  - loads read-only sampling data.
- `EDIT_REQUESTED` -> View Edit
  - loads the sampling for edit-review visibility.

QA scroll behavior:

- Clicking any row Action button selects/adds the sample and scrolls the page to `QA Sampling Form`.
- After `Submit`, `Review`, `Approve`, or `Reject` succeeds, the page scrolls back to `Samples in Lot`.

QA form behavior:

- The form supports multiple selected sample units in one QA sampling set.
- Selected sample serials are shown as chips above the result grids.
- Editable draft mode allows removing a selected sample from the set.
- Template, Method, Station, Remark, and Equipment are maintained in `Lot Sampling Setup`.
- Sampling No is maintained in `QA Sampling Form` and comes from the selected sample row `No.`.
- `Save Draft`
  - sends the current lot-level setup values with all selected sample units.
  - sends `Sampling No` from the selected sample row `No.`.
  - creates a QA sampling record if no sampling ID is active.
  - updates the existing DRAFT sampling record when a sampling ID is active.
- `Run Equipment Check`
  - validates the equipment assigned to the active QA sampling record.
  - uses the existing QA equipment validation rules.

QA draft duplicate handling:

- QA Sampling can contain multiple sample units under one sampling header.
- When saving a draft, the page checks whether a sampling already exists for the same template and sampling number.
- If an existing DRAFT sampling is found:
  - the page loads that draft and updates it instead of creating a duplicate.
  - the sample table cache is synchronized so QA Status, Result, Updated, and Action change immediately.
- If an existing non-DRAFT sampling is found:
  - the page prevents silent overwrite.
  - the operator should use a new Sampling No. for a new sampling set.
- If backend returns a duplicate conflict, the page refetches status and attempts to recover by loading the existing DRAFT.

QA equipment requirement behavior:

- QA uses the same `Model Required Equipment` rule source as QC.
- The rule is based on the product model of the selected lot.
- The equipment selector is shown in `Lot Sampling Setup`.
- Selected equipment is reused for the sampling set until the operator changes it.
- If no required equipment exists for the model, QA Save Draft can be completed without equipment.
- If required equipment exists, selected equipment must satisfy type, quantity, active status, and calibration rules.

## Operator Flow Summary

### QC Inspection

```text
1. Open QC Inspection.
2. Search lot by lot/model/status/date.
3. Open the target lot.
4. Set Template, Station, Remark, and Equipment in Lot Inspection Setup.
5. Review summary cards and progress score bar.
6. Use filters if needed to find a serial.
7. Click row action.
8. Page scrolls to Inspection Form.
9. Confirm Inspection No from the selected serial row No. and enter inspection result values.
10. Save Draft.
11. Submit when ready.
12. Reviewer opens SUBMITTED row and clicks Review or Reject.
13. Approver opens REVIEWED row and clicks Approve or Reject.
14. After workflow action succeeds, page scrolls back to Serials in Lot.
```

### QA Sampling

```text
1. Open QA Sampling.
2. Search lot by lot/model/status/date.
3. Open the target lot.
4. Set Template, Method, Station, Remark, and Equipment in Lot Sampling Setup.
5. Review sample progress score bar.
6. Click Add Sample for one or more serials.
7. Page scrolls to QA Sampling Form.
8. Confirm Sampling No from the selected sample row No. and enter result values for every selected sample unit.
9. Save Draft.
10. Submit when ready.
11. Reviewer opens SUBMITTED sampling and clicks Review or Reject.
12. Approver opens REVIEWED sampling and clicks Approve or Reject.
13. After workflow action succeeds, page scrolls back to Samples in Lot.
```

### Required Equipment Setup

```text
1. Open Equipment Types.
2. Create equipment type, for example DMM.
3. Open Equipment Master.
4. Create equipment, assign it to DMM, set status ACTIVE, and set valid calibration due date.
5. Open Required Equipment.
6. Select Product Model.
7. Add Required Equipment rule by equipment type and required quantity.
8. Open QC or QA lot flow.
9. Equipment selector shows available equipment for the lot model.
10. Save/Submit/Approve validates equipment against the model rule.
```

## Validation Rules

QC/QA equipment validation checks:

- Selected equipment IDs must exist.
- Equipment status must be `ACTIVE`.
- Calibration due date must exist and must not be expired.
- Mandatory model required equipment must be satisfied by equipment type and required quantity.
- If the model has no mandatory required equipment, an empty equipment list is valid.

Backend validation responsibility:

- Schema validates request shape.
- Service-level equipment validator enforces business rules.
- QC and QA schemas intentionally allow `equipment_ids: []` so models without required equipment can be processed.

Frontend validation responsibility:

- The form disables Save Draft when mandatory equipment exists and no equipment is selected.
- The form allows Save Draft when no equipment rule exists.
- `ErrorAlert` displays backend validation details when API validation fails.

## Manual Test

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

### Step 2 - Lot Search API

```powershell
$lots = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/qc/lots?search=Assy&lot_number=Assy&model_code=CMA&status=OPEN" `
  -Headers $headers

$lot = @($lots.data)[0]
```

Result:

```text
PASS
LotSearchCount = 4
LotId = 12
LotNumber = Assy/2601/0902
```

### Step 3 - Lot Serial Inspection Status API

```powershell
$status = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/qc/lots/$($lot.id)/inspection-status" `
  -Headers $headers
```

Result:

```text
PASS
SerialCount = 100
NotStarted = 98
Draft = 1
Submitted = 1
Reviewed = 0
Approved = 0
Rejected = 0
```

### Step 4 - Browser Checklist

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd start

cd D:\DevApp\production\PMPS\frontend
npm.cmd run dev
```

Checklist:

| Step | Expected |
|---|---|
| Open `/qc/inspection` | Lot Search page displays |
| Search `Assy` | Lot table displays matching lots |
| Click Open Lot on lot 12 | Redirects to `/qc/inspection/lots/12` |
| Open `/qc/inspection/lots/12` | Lot header, summary cards, and 100 serial rows display |
| Check serial table | Score bar displays progress and table shows 10 rows per page |
| Type in Serial column filter | Table filters matching serial rows and resets to page 1 |
| Select QC Status filter | Table shows only rows matching the selected status |
| Click Clear Filters | All serial rows are available again |
| Select NOT_STARTED serial | Form panel is editable |
| Click serial Action | Page scrolls to Inspection Form |
| Save Draft | serial table refreshes and row becomes DRAFT |
| Select DRAFT serial | Existing values populate and Save Draft is available |
| Submit DRAFT | row becomes SUBMITTED after refresh |
| Submit/Review/Approve/Reject success | Page scrolls back to Serials in Lot |
| Click Run Equipment Check | Equipment validation panel updates for selected inspection |
| Select SUBMITTED serial | form is read-only and Review/Reject actions are available |
| Select REVIEWED serial | Approve/Reject actions are available |
| Select APPROVED serial | form is read-only and Save Draft is hidden |
| Open `/qa/sampling` | QA Lot Search page displays |
| Search QA lot | QA lot table displays matching lots |
| Click Open Lot | Redirects to `/qa/sampling/lots/:lotId` |
| Check QA sample table | Score bar displays progress and table shows 10 rows per page |
| Filter QA sample columns | Table filters matching rows and resets to page 1 |
| Click Add Sample | Page scrolls to QA Sampling Form and selected serial appears as a sample chip |
| Save QA Draft | QA sampling set is created/updated and table refreshes |
| Select DRAFT QA row | Existing QA sampling set populates all sample units and result values |
| Submit/Review/Approve/Reject QA success | Page scrolls back to Samples in Lot |

## Automated Test Results

```text
PASS npm.cmd run build
PASS npm.cmd test -- --runInBand
```

Backend integration result:

```text
tests 70
pass 70
fail 0
```

Frontend build result:

```text
tsc --noEmit PASS
vite build PASS
```

## Notes

- QA Sampling flow remains as implemented in Sprint 14.
- Sprint 14.1 focuses only on QC lot-based inspection UX refinement.
- Browser automation tool was not available in this session, so UI validation was documented as a manual browser checklist and verified with frontend build plus backend/manual API tests.
