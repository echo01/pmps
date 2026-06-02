# Sprint 5 Backend: QC Inspection Transaction

## Status

Sprint 5 Core = PASS

Implemented QC Inspection transaction flow from Lot/Serial selection through Save QC, update draft inspection, equipment validation, submit, review, approve, reject, and approval logging.

## Database Notes

No new migration was required for Sprint 5.

The required hardening already exists in Sprint 1 migration:

- `uq_inspection_unit_template_no`
- `chk_inspection_status`
- `chk_inspection_overall_result`
- `chk_inspection_detail_result`
- `updated_at` on `inspection_header` and `inspection_detail`

Key tables used:

- `inspection_header`
- `inspection_detail`
- `inspection_equipment`
- `approval_log`
- `product_unit`
- `production_lot`
- `test_template`
- `test_template_item`
- `equipment_master`
- `model_required_equipment`

## Added Module

- `server/src/modules/qc-inspections/qc-inspections.routes.js`
- `server/src/modules/qc-inspections/qc-inspections.controller.js`
- `server/src/modules/qc-inspections/qc-inspections.service.js`
- `server/src/modules/qc-inspections/qc-inspections.repository.js`
- `server/src/modules/qc-inspections/qc-inspections.schema.js`
- `server/src/modules/qc-inspections/qc-result-calculator.js`
- `server/src/modules/qc-inspections/qc-equipment-validator.js`

The module is registered in:

- `server/src/app.js`

## Permissions

All Sprint 5 QC routes use:

- `authMiddleware`
- `requirePermission('QCInspection')`

## APIs

Implemented endpoints:

- `GET /api/qc/lots?search=`
- `GET /api/qc/lots/:lotId/units`
- `GET /api/qc/models/:modelId/templates`
- `GET /api/qc/templates/:templateId/items`
- `POST /api/qc/inspections`
- `GET /api/qc/inspections/:id`
- `PUT /api/qc/inspections/:id`
- `GET /api/qc/inspections/:id/equipment-check`
- `POST /api/qc/inspections/:id/submit`
- `POST /api/qc/inspections/:id/review`
- `POST /api/qc/inspections/:id/approve`
- `POST /api/qc/inspections/:id/reject`

## Save QC Transaction

`POST /api/qc/inspections` validates and saves:

- `inspection_header`
- `inspection_detail`
- `inspection_equipment`

All three are inserted inside one `withTransaction` call.

Validation includes:

- product unit exists
- product unit belongs to a production lot and model
- template exists
- template is active
- template type is `INSPECTION`
- template model matches product unit model
- duplicate `(product_unit_id, template_id, inspection_no)` returns `409`
- template item ids belong to the selected template
- mandatory template items are present
- equipment ids exist
- equipment status is `ACTIVE`
- equipment calibration is not expired
- selected equipment satisfies `model_required_equipment`

## Result Calculation

Implemented in `qc-result-calculator.js`.

Item rules:

- `NUMERIC`: blank = `N/A`, outside spec = `FAIL`, within spec = `PASS`
- `BOOLEAN`: OK/PASS/YES/TRUE = `PASS`, NG/FAIL/NO/FALSE = `FAIL`, blank or unknown = `N/A`
- `TEXT`: blank = `N/A`, non-empty = `PASS`

Overall rule:

- only mandatory items are considered
- any mandatory `FAIL` = `FAIL`
- all mandatory `PASS` = `PASS`
- no mandatory items or incomplete mandatory results = `N/A`

## Equipment Validation

Implemented in `qc-equipment-validator.js`.

Checks:

- selected equipment ids exist
- equipment is `ACTIVE`
- `calibration_due_date >= current date`
- selected equipment covers mandatory `model_required_equipment.required_qty`

Validation runs during:

- save QC
- update draft QC
- equipment-check API
- submit
- approve

## Workflow

Implemented workflow:

- `DRAFT -> SUBMITTED`
- `SUBMITTED -> REVIEWED`
- `REVIEWED -> APPROVED`
- `SUBMITTED -> REJECTED`
- `REVIEWED -> REJECTED`

Each workflow action updates `inspection_header.status` and inserts one `approval_log` row in the same transaction.

Approve also updates:

- `approver_user_id`
- `approved_at`

Review also updates:

- `reviewer_user_id`
- `reviewed_at`

Reject requires a non-empty `remark`.

## Integration Tests

Added:

- `server/src/tests/qc-inspections.test.js`

Test coverage:

- login admin
- setup product category, sub category, model
- setup active equipment with valid calibration
- setup model required equipment
- setup active `INSPECTION` template
- setup template section and items
- setup production lot and serials
- `GET /api/qc/lots`
- `GET /api/qc/lots/:lotId/units`
- `GET /api/qc/models/:modelId/templates`
- `GET /api/qc/templates/:templateId/items`
- `POST /api/qc/inspections` save success
- duplicate inspection returns `409`
- `GET /api/qc/inspections/:id`
- `GET /api/qc/inspections/:id/equipment-check`
- `PUT /api/qc/inspections/:id` recalculates `FAIL`
- approve before reviewed returns `409`
- submit success and writes approval log
- review success and writes approval log
- approve success, sets `approved_at`, and writes approval log
- expired equipment blocks submit with `422`
- reject success and writes approval log
- no token returns `401`
- user without `QCInspection` permission returns `403`

## Test Result

Command:

```bash
npm.cmd test
```

Result:

```text
tests 32
suites 4
pass 32
fail 0
cancelled 0
skipped 0
todo 0
```

## Done Criteria

Sprint 5 is complete because:

- QC Lot selection works
- QC Unit selection works
- INSPECTION template lookup works
- template item grouping works
- Save QC uses transaction
- result calculation works
- equipment validation works
- duplicate inspection protection works
- update draft works
- workflow submit/review/approve/reject works
- approval logs are written
- expired equipment is blocked
- Auth/RBAC paths are tested
- `npm.cmd test` passes

## Next Sprint Suggestion

Sprint 6 should continue with QA Sampling Core, reusing the same result calculation, equipment validation, transaction, and approval workflow patterns from Sprint 5.
