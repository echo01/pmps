# Sprint 6 Backend: QA Sampling Core

## Status

Sprint 6 Core = PASS

Implemented QA Sampling transaction flow from Lot selection, sample unit selection, QA template lookup, save sampling, update draft sampling, equipment validation, submit, review, approve, reject, and approval logging.

## Migration

Added:

- `server/migrations/1780502400000_sprint6-qa-sampling-fields.js`

This migration adds API-required fields to `qa_sampling_header`:

- `sampling_method VARCHAR(50)`
- `station_name VARCHAR(100)`

The existing schema already had the core QA tables and Sprint 1 hardening already added the key constraints:

- `uq_qa_sampling_lot_template_round`
- `uq_qa_sample_unit_serial_per_sampling`
- `uq_qa_sample_unit_product_per_sampling`
- `chk_qa_status`
- `chk_qa_overall_result`
- `chk_qa_detail_result`

## Added Module

- `server/src/modules/qa-sampling/qa-sampling.routes.js`
- `server/src/modules/qa-sampling/qa-sampling.controller.js`
- `server/src/modules/qa-sampling/qa-sampling.service.js`
- `server/src/modules/qa-sampling/qa-sampling.repository.js`
- `server/src/modules/qa-sampling/qa-sampling.schema.js`
- `server/src/modules/qa-sampling/qa-sampling-calculator.js`
- `server/src/modules/qa-sampling/qa-sampling-equipment-validator.js`

The module is registered in:

- `server/src/app.js`

## Permissions

All Sprint 6 QA routes use:

- `authMiddleware`
- `requirePermission('QASampling')`

## APIs

Implemented endpoints:

- `GET /api/qa/lots?search=`
- `GET /api/qa/lots/:lotId/units`
- `GET /api/qa/models/:modelId/templates`
- `GET /api/qa/templates/:templateId/items`
- `POST /api/qa/samplings`
- `GET /api/qa/samplings/:id`
- `PUT /api/qa/samplings/:id`
- `GET /api/qa/samplings/:id/equipment-check`
- `POST /api/qa/samplings/:id/submit`
- `POST /api/qa/samplings/:id/review`
- `POST /api/qa/samplings/:id/approve`
- `POST /api/qa/samplings/:id/reject`

API `sampling_no` is mapped to database column `qa_sampling_header.sampling_round`.

## Save QA Transaction

`POST /api/qa/samplings` validates and saves:

- `qa_sampling_header`
- `qa_sample_unit`
- `qa_sample_detail`
- `qa_sampling_equipment`

All writes are executed inside one `withTransaction` call.

Validation includes:

- production lot exists
- template exists
- template type is `QA`
- template is active
- template model matches lot model
- duplicate `(lot_id, template_id, sampling_round)` returns `409`
- sample product units belong to the selected lot
- sample product units are not duplicated in payload
- template items belong to selected template
- template items are not duplicated within the same sample unit
- mandatory template items are present for every sample unit
- equipment ids exist
- equipment status is `ACTIVE`
- equipment calibration is not expired
- selected equipment satisfies `model_required_equipment`

## Result Calculation

Implemented in `qa-sampling-calculator.js`.

Item result reuses Sprint 5 QC rules:

- `NUMERIC`: blank = `N/A`, outside spec = `FAIL`, within spec = `PASS`
- `BOOLEAN`: OK/PASS/YES/TRUE = `PASS`, NG/FAIL/NO/FALSE = `FAIL`, blank or unknown = `N/A`
- `TEXT`: blank = `N/A`, non-empty = `PASS`

Sample unit result:

- any mandatory item `FAIL` = `FAIL`
- all mandatory items `PASS` = `PASS`
- otherwise `N/A`

Sampling overall result:

- any sample unit `FAIL` = `FAIL`
- all sample units `PASS` = `PASS`
- otherwise `N/A`

## Equipment Validation

Implemented in `qa-sampling-equipment-validator.js`, reusing the Sprint 5 QC equipment validation rule.

Checks:

- selected equipment ids exist
- equipment is `ACTIVE`
- `calibration_due_date >= current date`
- selected equipment covers mandatory `model_required_equipment.required_qty`

Validation runs during:

- save QA sampling
- update draft QA sampling
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

Each workflow action updates `qa_sampling_header.status` and inserts one `approval_log` row with `source_type = 'QA'` in the same transaction.

Approve also updates:

- `qa_approver_user_id`
- `approved_at`

Review also updates:

- `qa_reviewer_user_id`
- `reviewed_at`

Reject requires a non-empty `remark`.

## Integration Tests

Added:

- `server/src/tests/qa-sampling.test.js`

Test coverage:

- login admin
- setup product category, sub category, model
- setup active equipment with valid calibration
- setup model required equipment
- setup active `QA` template
- setup template section and items
- setup production lot and serials
- `GET /api/qa/lots`
- `GET /api/qa/lots/:lotId/units`
- `GET /api/qa/models/:modelId/templates`
- `GET /api/qa/templates/:templateId/items`
- `POST /api/qa/samplings` save success
- duplicate sampling returns `409`
- `GET /api/qa/samplings/:id`
- `GET /api/qa/samplings/:id/equipment-check`
- `PUT /api/qa/samplings/:id` recalculates `FAIL`
- approve before reviewed returns `409`
- submit success and writes approval log
- review success and writes approval log
- approve success, sets `approved_at`, and writes approval log
- expired equipment blocks submit with `422`
- reject success and writes approval log
- no token returns `401`
- user without `QASampling` permission returns `403`

## Test Result

Migration command:

```bash
npm.cmd run migrate:test:up
```

Migration result:

```text
Migrations complete
```

Test command:

```bash
npm.cmd test
```

Test result:

```text
tests 42
suites 5
pass 42
fail 0
cancelled 0
skipped 0
todo 0
```

## Done Criteria

Sprint 6 is complete because:

- QA Lot selection works
- QA Unit selection works
- QA template lookup returns only active QA templates
- QA template item grouping works
- Save QA creates header, sample units, details, and equipment with transaction
- duplicate lot/template/sampling number returns `409`
- item result calculation works
- sample unit result calculation works
- QA sampling overall result calculation works
- equipment validation works
- draft update works
- submit/review/approve/reject workflow works
- workflow actions write approval logs
- expired equipment is blocked
- Auth/RBAC paths are tested
- `npm.cmd test` passes

## Production Migration Note

Before using Sprint 6 against a non-test database, run:

```bash
npm.cmd run migrate:up
```

This applies the new `qa_sampling_header.sampling_method` and `qa_sampling_header.station_name` fields.

## Next Sprint Suggestion

Sprint 7 can continue with report/search APIs or post-approval edit-result controls. The QA and QC transaction foundations are now in place.
