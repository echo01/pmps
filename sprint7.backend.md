# Sprint 7 Backend: Report / Search / Dashboard API

## Status

Sprint 7 Core = PASS

Sprint 7 เป็น read-only layer สำหรับ Frontend ใช้ค้นหา ดู dashboard และเตรียมข้อมูล export จากข้อมูลที่สร้างไว้ใน Sprint 4-6 โดยทุก endpoint ใช้ `authMiddleware` และ `requirePermission('SearchReport')`

## Files Added / Updated

- `server/src/modules/reports/reports.routes.js`
- `server/src/modules/reports/reports.controller.js`
- `server/src/modules/reports/reports.service.js`
- `server/src/modules/reports/reports.repository.js`
- `server/src/modules/reports/reports.schema.js`
- `server/src/tests/reports.test.js`
- `server/src/app.js`
- `sprint7.backend.md`

## API Completed

### Dashboard APIs

- `GET /api/dashboard/summary`
- `GET /api/dashboard/qc-summary`
- `GET /api/dashboard/qa-summary`
- `GET /api/dashboard/lot-status`

### Search APIs

- `GET /api/reports/lots`
- `GET /api/reports/serials`
- `GET /api/reports/qc-inspections`
- `GET /api/reports/qa-samplings`

### Detail Report APIs

- `GET /api/reports/lots/:lotId`
- `GET /api/reports/serials/:productUnitId`
- `GET /api/reports/qc-inspections/:id`
- `GET /api/reports/qa-samplings/:id`

### Export-ready APIs

- `GET /api/reports/qc-inspections/export`
- `GET /api/reports/qa-samplings/export`

หมายเหตุ: export API คืน JSON แบบ flat rows ก่อน ยังไม่สร้างไฟล์ Excel/PDF จริงตาม scope ของ Sprint 7

## Query Parameters Supported

- `search`
- `model_code`
- `lot_number`
- `serial_number`
- `status`
- `result`
- `date_from`
- `date_to`
- `page`
- `page_size`

## Integration Test Summary

ไฟล์ทดสอบ: `server/src/tests/reports.test.js`

Test setup สร้างข้อมูลจริงผ่าน API:

1. Login admin
   - Result: PASS
   - ได้ `access_token` สำหรับ setup และทดสอบ

2. Setup product category, sub category, model
   - Result: PASS
   - สร้าง model สำหรับ Sprint 7 fixture สำเร็จ

3. Setup equipment type, equipment, required equipment
   - Result: PASS
   - สร้าง equipment ที่ active และ calibration ยังไม่หมดอายุ

4. Setup QC template, section, numeric item, boolean item
   - Result: PASS
   - สร้าง template type `INSPECTION` สำเร็จ

5. Setup QA template, section, numeric item, boolean item
   - Result: PASS
   - สร้าง template type `QA` สำเร็จ

6. Create production lot and serials
   - Result: PASS
   - สร้าง lot จำนวน 3 serial สำเร็จ

7. Create and approve QC inspection
   - Result: PASS
   - สร้าง QC inspection แล้ว submit, review, approve สำเร็จ

8. Create and approve QA sampling
   - Result: PASS
   - สร้าง QA sampling แล้ว submit, review, approve สำเร็จ

## Test Steps and Results

### Step 1: Dashboard Summary

Endpoint:

```text
GET /api/dashboard/summary
```

Expected:

- status 200
- มี `data.production.total_lots`
- มี `data.qc.total_inspections`
- มี `data.qa.total_samplings`

Result: PASS

### Step 2: QC Summary

Endpoint:

```text
GET /api/dashboard/qc-summary?date_from=2026-06-01&date_to=2026-12-31
```

Expected:

- status 200
- `by_status` เป็น array
- `by_result` เป็น array
- `by_model` เป็น array
- พบ model fixture ของ Sprint 7

Result: PASS

### Step 3: QA Summary

Endpoint:

```text
GET /api/dashboard/qa-summary?date_from=2026-06-01&date_to=2026-12-31
```

Expected:

- status 200
- `by_status` เป็น array
- `by_result` เป็น array
- `by_model` เป็น array
- พบ model fixture ของ Sprint 7

Result: PASS

### Step 4: Lot Status Summary

Endpoint:

```text
GET /api/dashboard/lot-status
```

Expected:

- status 200
- data เป็น array
- มี status `OPEN`

Result: PASS

### Step 5: Lot Report Search

Endpoint:

```text
GET /api/reports/lots?search=<LOT>&page=1&page_size=20
```

Expected:

- status 200
- มี pagination meta
- พบ lot fixture
- `serial_count = 3`

Result: PASS

### Step 6: Serial Report Search

Endpoint:

```text
GET /api/reports/serials?serial_number=<SERIAL>&page=1&page_size=20
```

Expected:

- status 200
- พบ serial fixture
- `latest_qc_result = PASS`
- `latest_qa_result = PASS`

Result: PASS

### Step 7: QC Inspection Report Search

Endpoint:

```text
GET /api/reports/qc-inspections?status=APPROVED&result=PASS&model_code=<MODEL>&page=1&page_size=20
```

Expected:

- status 200
- พบ QC inspection fixture
- `status = APPROVED`
- `overall_result = PASS`

Result: PASS

### Step 8: QA Sampling Report Search

Endpoint:

```text
GET /api/reports/qa-samplings?status=APPROVED&result=PASS&model_code=<MODEL>&page=1&page_size=20
```

Expected:

- status 200
- พบ QA sampling fixture
- `status = APPROVED`
- `sample_qty = 2`

Result: PASS

### Step 9: Lot Detail Report

Endpoint:

```text
GET /api/reports/lots/:lotId
```

Expected:

- status 200
- `data.lot.lot_id` ตรงกับ fixture
- `data.serials.length = 3`
- `data.qc_summary.pass >= 1`
- `data.qa_summary.pass >= 1`

Result: PASS

### Step 10: Serial Detail Report

Endpoint:

```text
GET /api/reports/serials/:productUnitId
```

Expected:

- status 200
- `product_unit_id` ตรงกับ fixture
- มี `serial_number`
- มี QC inspection history
- มี QA sampling history

Result: PASS

### Step 11: QC Inspection Detail Report

Endpoint:

```text
GET /api/reports/qc-inspections/:id
```

Expected:

- status 200
- `inspection_id` ตรงกับ fixture
- `details.length = 2`
- `equipment.length = 1`
- มี approval log action `APPROVE`

Result: PASS

### Step 12: QA Sampling Detail Report

Endpoint:

```text
GET /api/reports/qa-samplings/:id
```

Expected:

- status 200
- `qa_sampling_id` ตรงกับ fixture
- `sample_units.length = 2`
- `equipment.length = 1`
- มี approval log action `APPROVE`

Result: PASS

### Step 13: QC Export-ready JSON

Endpoint:

```text
GET /api/reports/qc-inspections/export?model_code=<MODEL>&date_from=2026-06-01&date_to=2026-12-31
```

Expected:

- status 200
- data เป็น flat array
- มี row ตามจำนวน QC detail item
- แต่ละ row มี `lot_number`, `serial_number`, `item_code`, `measured_value` หรือ `measured_text`, `result`

Result: PASS

### Step 14: QA Export-ready JSON

Endpoint:

```text
GET /api/reports/qa-samplings/export?model_code=<MODEL>&date_from=2026-06-01&date_to=2026-12-31
```

Expected:

- status 200
- data เป็น flat array
- มี row ตามจำนวน sample unit x QA detail item
- แต่ละ row มี `lot_number`, `serial_number`, `item_code`, `measured_value` หรือ `measured_text`, `result`

Result: PASS

### Step 15: No Token

Endpoint:

```text
GET /api/dashboard/summary
```

Expected:

- ไม่ส่ง token
- status 401
- `error_code = UNAUTHORIZED`

Result: PASS

### Step 16: No Permission

Endpoint:

```text
GET /api/dashboard/summary
```

Expected:

- login ด้วย user ที่ไม่มี `SearchReport`
- status 403
- `error_code = FORBIDDEN`

Result: PASS

## Full Test Result

Command:

```powershell
npm.cmd run migrate:test:up
npm.cmd test
```

Result:

```text
No migrations to run!
Migrations complete!

tests 58
suites 6
pass 58
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 2933.3451
```

## Done Criteria Check

- Dashboard summary ใช้งานได้: PASS
- QC summary ใช้งานได้: PASS
- QA summary ใช้งานได้: PASS
- Lot status summary ใช้งานได้: PASS
- Lot report search พร้อม pagination: PASS
- Serial report search พร้อม pagination: PASS
- QC inspection report search พร้อม pagination: PASS
- QA sampling report search พร้อม pagination: PASS
- Lot detail report ใช้งานได้: PASS
- Serial detail report ใช้งานได้: PASS
- QC detail report ใช้งานได้: PASS
- QA detail report ใช้งานได้: PASS
- QC export-ready JSON ใช้งานได้: PASS
- QA export-ready JSON ใช้งานได้: PASS
- ทุก route ใช้ `authMiddleware`: PASS
- ทุก route ใช้ `requirePermission('SearchReport')`: PASS
- No token ได้ 401: PASS
- User ไม่มี SearchReport ได้ 403: PASS
- `npm test` ผ่าน: PASS
- เขียนเอกสาร Sprint 7: PASS

## Notes for Next Sprint

Sprint ถัดไปสามารถต่อยอดจาก JSON export-ready เป็น CSV/Excel จริง หรือเริ่มทำ Frontend Dashboard/Search screens ได้ โดยไม่ต้องเปลี่ยน data contract หลักของ Sprint 7
