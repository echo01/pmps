# Sprint 9 Backend: Edit Result / Audit Trail

## Status

Sprint 9 Core = PASS

Sprint 9 เพิ่ม flow สำหรับแก้ไขผล QC/QA หลัง `APPROVED` อย่างปลอดภัย โดยต้องขอแก้ไขก่อน, บันทึกเหตุผล, เก็บค่าเก่า/ค่าใหม่, คำนวณ result ใหม่, เขียน audit log และบังคับให้กลับไป review/approve ใหม่

## Files Added / Updated

- `server/migrations/1780588800000_sprint9-result-edit-audit.js`
- `server/src/modules/qc-inspections/qc-inspections.schema.js`
- `server/src/modules/qc-inspections/qc-inspections.routes.js`
- `server/src/modules/qc-inspections/qc-inspections.controller.js`
- `server/src/modules/qc-inspections/qc-inspections.service.js`
- `server/src/modules/qc-inspections/qc-inspections.repository.js`
- `server/src/modules/qa-sampling/qa-sampling.schema.js`
- `server/src/modules/qa-sampling/qa-sampling.routes.js`
- `server/src/modules/qa-sampling/qa-sampling.controller.js`
- `server/src/modules/qa-sampling/qa-sampling.service.js`
- `server/src/modules/qa-sampling/qa-sampling.repository.js`
- `server/src/modules/reports/reports.repository.js`
- `server/src/modules/reports/reports.service.js`
- `server/src/tests/result-edit-audit.test.js`
- `sprint9_backend.md`

## Database Changes

เพิ่ม table:

```text
result_edit_audit_log
```

Columns:

```text
id
source_type
source_id
detail_id
template_item_id
old_measured_value
new_measured_value
old_measured_text
new_measured_text
old_result
new_result
old_overall_result
new_overall_result
edit_reason
edit_by
edit_at
approval_status
```

เพิ่ม status ใหม่ใน constraint:

```text
EDIT_REQUESTED
```

ใช้กับ:

```text
inspection_header.status
qa_sampling_header.status
```

## Workflow

Implemented flow:

```text
APPROVED
  -> EDIT_REQUESTED
  -> SUBMITTED
  -> REVIEWED
  -> APPROVED
```

เหตุผลที่ `apply-edit` ส่งกลับเป็น `SUBMITTED`: เพื่อบังคับให้ผลที่แก้ไขแล้วต้องผ่าน review และ approve ใหม่ด้วย workflow เดิม

## Permissions

```text
POST /api/qc/inspections/:id/edit-request    EditTestResult
POST /api/qc/inspections/:id/apply-edit      EditTestResult
GET  /api/qc/inspections/:id/edit-history    SearchReport

POST /api/qa/samplings/:id/edit-request      EditTestResult
POST /api/qa/samplings/:id/apply-edit        EditTestResult
GET  /api/qa/samplings/:id/edit-history      SearchReport
```

Report detail APIs still use:

```text
SearchReport
```

## API Completed

### QC

```text
POST /api/qc/inspections/:id/edit-request
POST /api/qc/inspections/:id/apply-edit
GET  /api/qc/inspections/:id/edit-history
```

### QA

```text
POST /api/qa/samplings/:id/edit-request
POST /api/qa/samplings/:id/apply-edit
GET  /api/qa/samplings/:id/edit-history
```

### Reports Updated

```text
GET /api/reports/qc-inspections/:id
GET /api/reports/qa-samplings/:id
```

Both now include:

```text
edit_history
```

## Request Examples

### QC Edit Request

```powershell
$body = @{
  reason = "Retest found QC voltage out of spec"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/qc/inspections/<QC_INSPECTION_ID>/edit-request" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $body
```

Expected:

```text
status 200
data.status = EDIT_REQUESTED
data.edit_history contains approval_status = REQUESTED
```

### QC Apply Edit

```powershell
$body = @{
  reason = "Apply QC retest value"
  items = @(
    @{
      detail_id = <QC_DETAIL_ID>
      measured_value = 9999
    }
  )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/qc/inspections/<QC_INSPECTION_ID>/apply-edit" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $body
```

Expected:

```text
status 200
data.status = SUBMITTED
data.overall_result recalculated
data.edit_history contains approval_status = APPLIED
data.approval_logs contains action = APPLY_EDIT
```

### QA Edit Request

```powershell
$body = @{
  reason = "Retest found QA voltage out of spec"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/qa/samplings/<QA_SAMPLING_ID>/edit-request" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $body
```

Expected:

```text
status 200
data.status = EDIT_REQUESTED
```

### QA Apply Edit

```powershell
$body = @{
  reason = "Apply QA retest value"
  items = @(
    @{
      detail_id = <QA_DETAIL_ID>
      measured_value = 9999
    }
  )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/qa/samplings/<QA_SAMPLING_ID>/apply-edit" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $body
```

Expected:

```text
status 200
data.status = SUBMITTED
data.overall_result recalculated
sample unit result recalculated
```

## Integration Test Summary

Test file:

```text
server/src/tests/result-edit-audit.test.js
```

Setup:

1. Login admin
2. Create product category / sub category / model
3. Create equipment type / equipment / model required equipment
4. Create QC template with numeric and boolean items
5. Create QA template with numeric and boolean items
6. Create production lot and serials
7. Create QC inspection and approve it
8. Create QA sampling and approve it

## Test Steps and Results

### Test 1 — Normal QC update after approval is rejected

Command under test:

```text
PUT /api/qc/inspections/:id
```

Expected:

```text
status 409
error_code = CONFLICT
message = Only DRAFT QC inspection can be updated
```

Actual Result:

```text
PASS
```

### Test 2 — QC edit request

Command under test:

```text
POST /api/qc/inspections/:id/edit-request
```

Expected:

```text
status 200
data.status = EDIT_REQUESTED
edit_history contains REQUESTED
```

Actual Result:

```text
PASS
```

### Test 3 — QC apply edit

Command under test:

```text
POST /api/qc/inspections/:id/apply-edit
```

Expected:

```text
status 200
data.status = SUBMITTED
overall_result changes PASS -> FAIL
edit_history contains APPLIED
approval_logs contains APPLY_EDIT
```

Actual Result:

```text
PASS
```

### Test 4 — QC edit history

Command under test:

```text
GET /api/qc/inspections/:id/edit-history
```

Expected:

```text
status 200
history contains old/new measured value
```

Actual Result:

```text
PASS
```

### Test 5 — QC report detail includes edit history

Command under test:

```text
GET /api/reports/qc-inspections/:id
```

Expected:

```text
status 200
data.edit_history contains edit_reason
```

Actual Result:

```text
PASS
```

### Test 6 — QC must be reviewed and approved again

Commands under test:

```text
POST /api/qc/inspections/:id/review
POST /api/qc/inspections/:id/approve
```

Expected:

```text
SUBMITTED -> REVIEWED -> APPROVED
```

Actual Result:

```text
PASS
```

### Test 7 — QA edit request

Command under test:

```text
POST /api/qa/samplings/:id/edit-request
```

Expected:

```text
status 200
data.status = EDIT_REQUESTED
```

Actual Result:

```text
PASS
```

### Test 8 — QA apply edit

Command under test:

```text
POST /api/qa/samplings/:id/apply-edit
```

Expected:

```text
status 200
data.status = SUBMITTED
overall_result changes PASS -> FAIL
sample unit result recalculated
edit_history contains APPLIED
```

Actual Result:

```text
PASS
```

### Test 9 — QA edit history

Command under test:

```text
GET /api/qa/samplings/:id/edit-history
```

Expected:

```text
status 200
history contains old/new measured value
```

Actual Result:

```text
PASS
```

### Test 10 — QA report detail includes edit history

Command under test:

```text
GET /api/reports/qa-samplings/:id
```

Expected:

```text
status 200
data.edit_history contains edit_reason
```

Actual Result:

```text
PASS
```

### Test 11 — QA must be reviewed and approved again

Commands under test:

```text
POST /api/qa/samplings/:id/review
POST /api/qa/samplings/:id/approve
```

Expected:

```text
SUBMITTED -> REVIEWED -> APPROVED
```

Actual Result:

```text
PASS
```

## Migration Test Result

Test DB:

```powershell
npm.cmd run migrate:test:up
```

Result:

```text
1780588800000_sprint9-result-edit-audit migrated successfully
Migrations complete!
```

Development DB:

```powershell
npm.cmd run migrate:up
```

Result:

```text
1780588800000_sprint9-result-edit-audit migrated successfully
Migrations complete!
```

## Full Test Result

Command:

```powershell
npm.cmd test
```

Result:

```text
tests 61
suites 7
pass 61
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 2852.5946
```

## Done Criteria Check

- ขอแก้ผล QC หลัง APPROVED ได้: PASS
- Apply edit QC หลัง edit request ได้: PASS
- QC result และ overall_result ถูกคำนวณใหม่: PASS
- QC audit log มี old/new value และ reason: PASS
- QC report detail เห็น edit history: PASS
- QC ต้อง review/approve ใหม่หลังแก้: PASS
- ขอแก้ผล QA หลัง APPROVED ได้: PASS
- Apply edit QA หลัง edit request ได้: PASS
- QA detail, unit result และ overall_result ถูกคำนวณใหม่: PASS
- QA audit log มี old/new value และ reason: PASS
- QA report detail เห็น edit history: PASS
- QA ต้อง review/approve ใหม่หลังแก้: PASS
- API เดิมยังปฏิเสธการแก้ approved result โดยตรง: PASS
- Migration main/test DB ผ่าน: PASS
- Integration test ผ่าน: PASS

## Notes

- Sprint 9 ใช้ `EDIT_REQUESTED` เป็นสถานะพักหลังขอแก้ไข
- เมื่อ `apply-edit` สำเร็จ ระบบเปลี่ยนสถานะเป็น `SUBMITTED` เพื่อให้ใช้ review/approve workflow เดิมต่อ
- ยังไม่ได้ทำ reject edit request แยกต่างหาก เพราะ scope รอบนี้เน้น request/apply/history และ re-approval
