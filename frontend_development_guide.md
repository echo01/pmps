# Frontend Development Guide — Production Inspection & QA Sampling Web Application

เอกสารนี้ใช้สำหรับทีม Frontend ในการพัฒนา React Web Application สำหรับระบบ Production, QC Inspection, QA Sampling, Equipment Traceability, Report, User / Role / Approval และ External API Integration

> เอกสารที่เกี่ยวข้อง: `backend_development_guide.md`  
> หลักการทำงานร่วมกัน: ทุกหน้าจอ / Component ต้องอ้างอิง `Integration Contract ID` เดียวกับ Backend

---

## 1. Frontend Development Objective

เป้าหมายของ Frontend คือสร้าง UI สำหรับใช้งานในโรงงาน โดยต้องรองรับการทำงานต่อไปนี้

```text
1. Login และแสดงเมนูตามสิทธิ์
2. จัดการ User / Role
3. จัดการ Product Master
4. จัดการ Equipment / Calibration
5. จัดการ Test Template
6. สร้าง Production Lot / Serial Number
7. Current Lot Dashboard
8. บันทึก QC Inspection ราย Serial
9. บันทึก QA Sampling ราย Lot
10. Submit / Review / Approve / Reject
11. Edit Result พร้อม Reason
12. Report / Export
13. API Setting / API Log Viewer
```

Frontend ต้องยึดหลักสำคัญดังนี้

```text
- ใช้ API Contract จาก Backend เป็นหลัก
- UI ต้อง validate เบื้องต้นก่อนส่ง API
- Backend เป็นผู้ตัดสินสิทธิ์จริงเสมอ
- ทุก action สำคัญต้องมี console log สำหรับ debug
- ทุก module ต้องมี mock action เพื่อทดสอบ UI ก่อน API เสร็จ
- Error จาก Backend ต้องแสดงเป็นข้อความที่ผู้ใช้เข้าใจได้
- Role/Permission ต้องซ่อนเมนูและปุ่มที่ user ไม่มีสิทธิ์
```

---

## 2. Recommended Stack

```text
Framework       : React + TypeScript
Build Tool      : Vite
UI Library      : MUI / Ant Design / Mantine / shadcn/ui
Data Fetching   : TanStack Query
Form            : react-hook-form
Validation      : zod
Table           : TanStack Table หรือ UI DataGrid
HTTP Client     : axios หรือ fetch wrapper
State           : Zustand หรือ Context เฉพาะ auth/session
Export          : ใช้ Backend export เป็นหลัก หรือใช้ SheetJS เฉพาะ simple table
```

---

## 3. Folder Structure

```text
web/
  src/
    main.tsx
    App.tsx

    app/
      router.tsx
      providers.tsx
      queryClient.ts

    api/
      httpClient.ts
      apiResponse.ts
      auth.api.ts
      users.api.ts
      products.api.ts
      equipment.api.ts
      templates.api.ts
      productionLots.api.ts
      qc.api.ts
      qa.api.ts
      reports.api.ts
      editResults.api.ts
      externalApi.api.ts

    auth/
      AuthProvider.tsx
      useAuth.ts
      permission.ts

    layouts/
      MainLayout.tsx
      Sidebar.tsx
      Header.tsx

    pages/
      LoginPage.tsx
      dashboard/
      admin/
      products/
      equipment/
      templates/
      production-lots/
      qc/
      qa/
      reports/
      edit-results/
      settings/

    components/
      DataTable/
      Form/
      StatusBadge/
      ResultBadge/
      EquipmentSelector/
      ApprovalActions/
      ConfirmDialog/
      ErrorAlert/
      LoadingPanel/

    mocks/
      auth.mock.ts
      products.mock.ts
      equipment.mock.ts
      templates.mock.ts
      productionLots.mock.ts
      qc.mock.ts
      qa.mock.ts
      reports.mock.ts

    utils/
      logger.ts
      dateFormat.ts
      resultCalculator.ts
      serialGenerator.ts
      downloadFile.ts
```

---

## 4. Console Log Standard สำหรับ Frontend

ช่วงพัฒนาให้ทุก Page / Component มี log สำหรับตรวจ Action และ Payload แต่ห้าม log password, token, cookie หรือข้อมูลลับ

### 4.1 Log Format

```ts
console.info('[PAGE][ACTION][START]', { payloadSummary });
console.info('[PAGE][ACTION][MOCK]', { mockMode: true, result });
console.info('[PAGE][ACTION][API_SUCCESS]', { data });
console.warn('[PAGE][ACTION][VALIDATION_FAIL]', { issues });
console.error('[PAGE][ACTION][API_ERROR]', { status, message, error_code });
```

### 4.2 ตัวอย่าง Log

```text
[LOGIN][SUBMIT][START] { username: 'admin' }
[LOGIN][SUBMIT][API_SUCCESS] { userId: 1, roles: ['ADMIN'] }

[QC][SAVE_DRAFT][START] { product_unit_id: 100, itemCount: 7 }
[QC][SAVE_DRAFT][MOCK] { inspection_id: 10, overall_result: 'PASS' }
```

### 4.3 ห้าม Log

```text
- password
- token
- cookie
- refresh token
- X-API-KEY
- password_hash
```

---

## 5. Integration Contract ID

Frontend และ Backend ต้องใช้ Contract ID เดียวกันเพื่อแบ่งงานและตรวจสถานะได้ง่าย

| Contract ID | Frontend Page / Component | Backend API | Primary User Action |
|---|---|---|---|
| C-AUTH-001 | `/login` | `POST /api/auth/login` | Login |
| C-USER-001 | `/admin/users` | `/api/users` | Add/Edit User |
| C-ROLE-001 | `/admin/roles` | `/api/roles` | Assign Role |
| C-PROD-001 | `/products/*` | `/api/product-*` | Manage Product Master |
| C-EQ-001 | `/equipment/master` | `/api/equipment` | Manage Equipment |
| C-EQ-002 | `/equipment/model-required` | `/api/model-required-equipment` | Set Required Equipment |
| C-TPL-001 | `/templates` | `/api/test-templates` | Manage Template |
| C-LOT-001 | `/production-lots` | `/api/production-lots` | Create Lot / Generate Serial |
| C-DASH-001 | `/dashboard/current-lots` | `/api/current-lots` | View Current Lot |
| C-QC-001 | `/qc/inspection` | `/api/qc/inspections` | Save QC |
| C-QC-002 | `ApprovalActions` in QC | `/api/qc/inspections/:id/*` | Submit/Review/Approve/Reject QC |
| C-QA-001 | `/qa/sampling` | `/api/qa/samplings` | Save QA |
| C-QA-002 | `ApprovalActions` in QA | `/api/qa/samplings/:id/*` | Submit/Review/Approve/Reject QA |
| C-RPT-001 | `/reports/qc` | `/api/reports/qc` | Search QC Report |
| C-RPT-002 | `/reports/qa` | `/api/reports/qa` | Search QA Report |
| C-EDIT-001 | `/edit-results` | `/api/edit-results/*` | Edit Result with Reason |
| C-EXT-001 | `/settings/api` | External API | Configure API Integration |
| C-LOG-001 | `/settings/api` หรือ `/settings/api-logs` | `/api/api-logs` | View API Logs |

---

## 6. Common API Client Standard

### 6.1 API Response Type

```ts
export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: Array<{ field?: string; message: string }>;
  error_code?: string;
  meta?: {
    request_id?: string;
    page?: number;
    page_size?: number;
    total?: number;
  };
};
```

### 6.2 HTTP Client

```ts
export async function apiGet<T>(url: string): Promise<ApiResponse<T>> {
  console.info('[API][GET][START]', { url });
  const res = await fetch(url, { credentials: 'include' });
  const json = await res.json();
  if (!res.ok) {
    console.error('[API][GET][ERROR]', { url, status: res.status, message: json.message });
  } else {
    console.info('[API][GET][SUCCESS]', { url });
  }
  return json;
}
```

### 6.3 Error Handling Rule

```text
400 / 422: แสดง field error ใน form
401: redirect ไป /login
403: แสดง No Permission
404: แสดง Data Not Found
409: แสดง Conflict เช่น duplicate lot หรือ invalid status
500: แสดง Server Error และ request_id
```

---

## 7. Permission UI Rule

Frontend ต้องใช้ role / permission จาก `/api/auth/me` หรือ login response

```text
- ซ่อนเมนูที่ไม่มีสิทธิ์
- ซ่อนปุ่ม action เช่น Approve / Edit Approved Result
- แต่ยังต้องให้ Backend เป็นผู้ block จริง
```

ตัวอย่าง

```ts
function can(permission: string, userPermissions: string[]) {
  return userPermissions.includes(permission) || userPermissions.includes('ADMIN');
}
```

---

# PART A — Frontend Modules

---

## Module F01 — Login Page

### Contract ID

```text
C-AUTH-001
```

### Page

```text
/login
```

### Scope

```text
- Login form
- Remember username optional
- Show login error
- Redirect หลัง login สำเร็จ
```

### API

```http
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

### UI Components

```text
LoginForm
PasswordInput
ErrorAlert
LoadingButton
```

### Console Log

```ts
console.info('[LOGIN][SUBMIT][START]', { username });
console.info('[LOGIN][SUBMIT][API_SUCCESS]', { userId: user.id, roles: user.roles });
console.error('[LOGIN][SUBMIT][API_ERROR]', { message, error_code });
```

### Mock Action

```ts
export async function mockLogin(username: string, password: string) {
  console.info('[LOGIN][MOCK][START]', { username });
  if (username === 'admin' && password === 'Admin@123') {
    return {
      success: true,
      data: {
        user: {
          id: 1,
          username: 'admin',
          full_name: 'System Administrator',
          roles: ['ADMIN'],
          permissions: ['Dashboard', 'ProductMaster', 'QCInspection', 'QASampling', 'SearchReport']
        }
      }
    };
  }
  return { success: false, message: 'Invalid username or password', error_code: 'INVALID_CREDENTIALS' };
}
```

### UI Test Checklist

```text
- กด login โดยไม่กรอกข้อมูล ต้องแสดง validation
- login ผิดต้องแสดง error
- login ถูกต้องต้อง redirect ไป dashboard
- password ต้องไม่ถูก console.log
```

---

## Module F02 — User / Role Admin

### Contract ID

```text
C-USER-001
C-ROLE-001
```

### Pages

```text
/admin/users
/admin/roles
```

### Scope

```text
- User table
- Add/Edit user modal
- Activate/Deactivate user
- Reset password
- Assign roles
- Role table
```

### API

```http
GET    /api/users?search=&active=
POST   /api/users
PUT    /api/users/:id
PATCH  /api/users/:id/active
POST   /api/users/:id/password
GET    /api/users/:id/roles
PUT    /api/users/:id/roles
GET    /api/roles
```

### Console Log

```ts
console.info('[USERS][LOAD][START]', { search, active });
console.info('[USERS][SAVE][START]', { username, employee_code });
console.info('[USERS][ASSIGN_ROLES][START]', { userId, role_codes });
console.info('[USERS][SAVE][API_SUCCESS]', { userId });
```

### Mock Action

```ts
export const mockUsers = [
  { id: 1, username: 'admin', full_name: 'System Administrator', active: true, roles: ['ADMIN'] },
  { id: 2, username: 'qc01', full_name: 'QC Operator 01', active: true, roles: ['INSPECTION_OPERATOR'] }
];

export function mockAssignRoles(userId: number, role_codes: string[]) {
  console.info('[USERS][ASSIGN_ROLES][MOCK]', { userId, role_codes });
  return { success: true, message: 'Roles updated', data: { userId, role_codes } };
}
```

### UI Test Checklist

```text
- Search user ได้
- Toggle active แล้ว row เปลี่ยนสถานะ
- Assign role แล้ว chip role update
- User ที่ไม่มี UserRole permission ต้องเข้า page ไม่ได้
```

---

## Module F03 — Product Master

### Contract ID

```text
C-PROD-001
```

### Pages

```text
/products/categories
/products/sub-categories
/products/models
```

### Scope

```text
- CRUD Category
- CRUD Sub Category
- CRUD Product Model
- Lookup Model สำหรับหน้าอื่น
```

### API

```http
GET    /api/product-categories?search=
POST   /api/product-categories
PUT    /api/product-categories/:id
GET    /api/product-sub-categories?search=&category_id=
POST   /api/product-sub-categories
PUT    /api/product-sub-categories/:id
GET    /api/product-models?search=&active=
POST   /api/product-models
PUT    /api/product-models/:id
GET    /api/lookups/product-models
```

### Console Log

```ts
console.info('[PRODUCT][MODELS_LOAD][START]', { search, active });
console.info('[PRODUCT][MODEL_SAVE][START]', { model_code });
console.info('[PRODUCT][MODEL_SAVE][API_SUCCESS]', { modelId });
console.warn('[PRODUCT][MODEL_SAVE][CONFLICT]', { model_code });
```

### Mock Action

```ts
export const mockProductModels = [
  { id: 1, model_code: 'CMA-003', product_name: 'Air Control CMA-003', active: true },
  { id: 2, model_code: 'KM-06N', product_name: 'Power Meter KM-06N', active: true }
];
```

### UI Test Checklist

```text
- Add model แล้ว table เพิ่ม row
- Duplicate model_code ต้องแสดง conflict message
- inactive model ต้องไม่แสดงใน lookup สำหรับสร้าง lot
```

---

## Module F04 — Equipment Master / Model Required Equipment

### Contract ID

```text
C-EQ-001
C-EQ-002
```

### Pages

```text
/equipment/types
/equipment/master
/equipment/model-required
```

### Scope

```text
- Equipment type management
- Equipment master management
- Calibration status display
- Required equipment by model
```

### API

```http
GET    /api/equipment-types
GET    /api/equipment?search=&status=&calibration_status=
POST   /api/equipment
PUT    /api/equipment/:id
GET    /api/model-required-equipment?model_id=
POST   /api/model-required-equipment
PUT    /api/model-required-equipment/:id
GET    /api/models/:modelId/available-equipment
GET    /api/models/:modelId/required-equipment
GET    /api/equipment/expired-calibration
```

### UI Components

```text
EquipmentStatusBadge
CalibrationStatusBadge
EquipmentSelector
RequiredEquipmentGrid
```

### Console Log

```ts
console.info('[EQUIPMENT][LOAD][START]', { search, status, calibration_status });
console.info('[EQUIPMENT][SAVE][START]', { equipment_code });
console.info('[EQUIPMENT][CALIBRATION_FILTER][CHANGE]', { calibration_status });
console.info('[EQUIPMENT][MODEL_REQUIRED_SAVE][START]', { model_id, equipment_type_id, required_qty });
```

### Mock Action

```ts
export const mockEquipment = [
  { id: 1, equipment_code: 'DMM-001', equipment_name: 'Digital Multimeter', status: 'ACTIVE', calibration_due_date: '2026-12-31', calibration_status: 'VALID' },
  { id: 2, equipment_code: 'PSU-001', equipment_name: 'Power Supply', status: 'ACTIVE', calibration_due_date: '2025-01-31', calibration_status: 'EXPIRED' }
];
```

### UI Test Checklist

```text
- Equipment expired ต้องแสดงสีเตือน
- Filter calibration_status=EXPIRED ได้
- Model required equipment ต้องเพิ่ม/แก้ required_qty ได้
- EquipmentSelector ใน QC/QA ต้องเลือกเฉพาะเครื่องมือที่ valid หรือเตือนผู้ใช้ถ้า expired
```

---

## Module F05 — Test Template

### Contract ID

```text
C-TPL-001
```

### Page

```text
/templates
```

### Scope

```text
- Template header
- Template section
- Template items
- Check type / spec min / spec max / expect value
- Active template
```

### API

```http
GET    /api/test-templates?model_id=&template_type=&active=
POST   /api/test-templates
GET    /api/test-templates/:id
PUT    /api/test-templates/:id
GET    /api/test-templates/:templateId/sections
POST   /api/test-templates/:templateId/sections
GET    /api/test-templates/:templateId/items
POST   /api/test-templates/:templateId/items
PUT    /api/test-template-items/:id
```

### Console Log

```ts
console.info('[TEMPLATE][LOAD][START]', { model_id, template_type, active });
console.info('[TEMPLATE][ITEM_ADD][START]', { templateId, item_code, check_type });
console.info('[TEMPLATE][ITEM_ADD][MOCK]', { template_item_id: 999 });
```

### Mock Action

```ts
export const mockTemplateItems = [
  { id: 10, item_code: 'QC001', test_point: 'HP Alarm', check_type: 'BOOLEAN', mandatory: true },
  { id: 11, item_code: 'QC005', test_point: 'NTC 25C', check_type: 'NUMERIC', spec_min: 98, spec_max: 102, expect_value: 100, mandatory: true }
];
```

### UI Test Checklist

```text
- Add template item แล้ว grid update
- NUMERIC ต้องแสดง spec_min/spec_max
- BOOLEAN ต้องแสดง measured_text option ใน QC/QA
- Template type INSPECTION ใช้กับ QC, QA ใช้กับ QA เท่านั้น
```

---

## Module F06 — Production Lot / Serial Number

### Contract ID

```text
C-LOT-001
```

### Page

```text
/production-lots
```

### Scope

```text
- Create lot step form
- Select model
- Input lot number / lot qty / production date
- Generate serial preview
- Import serial optional
- ECN mapping optional
```

### API

```http
GET    /api/production-lots?search=&model_code=&date_from=&date_to=
POST   /api/production-lots
GET    /api/production-lots/:id
GET    /api/production-lots/:id/serials
POST   /api/production-lots/generate-serials
POST   /api/production-lots/:id/ecn
```

### UI Components

```text
ProductionLotStepForm
SerialGenerationForm
SerialPreviewTable
EcnSelector
```

### Console Log

```ts
console.info('[LOT][GENERATE_SERIAL][START]', { prefix, start_number, count, padding });
console.info('[LOT][GENERATE_SERIAL][PREVIEW]', { count: serials.length, first: serials[0], last: serials.at(-1) });
console.info('[LOT][CREATE][START]', { model_code, lot_number, lot_qty, serialCount });
console.info('[LOT][CREATE][API_SUCCESS]', { lotId });
```

### Mock Action

```ts
export function mockGenerateSerials(prefix: string, start: number, count: number, padding = 0) {
  const serials = Array.from({ length: count }, (_, i) => {
    const n = String(start + i).padStart(padding, '0');
    return `${prefix}${n}`;
  });
  console.info('[LOT][GENERATE_SERIAL][MOCK]', { count, first: serials[0], last: serials[serials.length - 1] });
  return serials;
}
```

### UI Test Checklist

```text
- Generate serial preview ก่อน save ได้
- serial count ไม่ตรง lot_qty ต้องแสดง warning
- duplicate serial ใน preview ต้องแสดง error
- Save success ต้อง redirect หรือแสดง created lot detail
```

---

## Module F07 — Current Lot Dashboard

### Contract ID

```text
C-DASH-001
```

### Page

```text
/dashboard/current-lots
```

### Scope

```text
- แสดง lot ล่าสุด
- แสดงจำนวน serial
- แสดง QC progress
- แสดง QA sampling status
- แสดง equipment/calibration warning summary
```

### API

```http
GET /api/current-lots?model_code=&lot_number=&production_date=
GET /api/reports/lots/:lotId/summary
```

### Console Log

```ts
console.info('[DASHBOARD][CURRENT_LOTS_LOAD][START]', { filters });
console.info('[DASHBOARD][CURRENT_LOTS_LOAD][API_SUCCESS]', { total });
```

### Mock Action

```ts
export const mockCurrentLots = [
  { lot_id: 20, model_code: 'CMA-003', lot_number: 'Assy/2601/0900', lot_qty: 84, qc_pass: 60, qc_fail: 2, qa_status: 'DRAFT' }
];
```

### UI Test Checklist

```text
- Filter by model / lot ได้
- Card แสดง progress ถูกต้อง
- คลิก lot แล้วไปหน้า QC หรือ QA ได้
```

---

## Module F08 — QC Inspection Page

### Contract ID

```text
C-QC-001
C-QC-002
```

### Page

```text
/qc/inspection
```

### Scope

```text
- Select lot
- Select serial
- Select template
- Load test items
- Input measured value/text
- Select equipment
- Calculate PASS/FAIL ที่ UI เพื่อ preview
- Save Draft
- Submit / Review / Approve / Reject ตาม role
```

### API

```http
GET    /api/qc/lots?search=
GET    /api/qc/lots/:lotId/units
GET    /api/qc/models/:modelId/templates
GET    /api/qc/templates/:templateId/items
POST   /api/qc/inspections
PUT    /api/qc/inspections/:id
GET    /api/qc/inspections/:id/equipment-check
POST   /api/qc/inspections/:id/submit
POST   /api/qc/inspections/:id/review
POST   /api/qc/inspections/:id/approve
POST   /api/qc/inspections/:id/reject
```

### UI Components

```text
LotSelector
SerialSelector
TemplateSelector
EquipmentSelector
QcResultGrid
ResultBadge
OverallResultPanel
ApprovalActions
```

### Console Log

```ts
console.info('[QC][LOT_SELECT]', { lotId });
console.info('[QC][SERIAL_SELECT]', { product_unit_id, serial_number });
console.info('[QC][ITEM_VALUE_CHANGE]', { template_item_id, measured_value, measured_text, previewResult });
console.info('[QC][SAVE_DRAFT][START]', { product_unit_id, template_id, itemCount });
console.info('[QC][SAVE_DRAFT][MOCK]', { inspection_id: 10, overall_result: 'PASS' });
console.info('[QC][SUBMIT][START]', { inspection_id });
```

### Mock Action

```ts
export function mockCalculateQcOverall(items: Array<{ mandatory: boolean; result: string }>) {
  const mandatory = items.filter(x => x.mandatory);
  if (mandatory.length === 0) return 'N/A';
  if (mandatory.some(x => x.result === 'FAIL')) return 'FAIL';
  return 'PASS';
}

export async function mockSaveQcInspection(payload: unknown) {
  console.info('[QC][SAVE_DRAFT][MOCK_START]', { payload });
  return {
    success: true,
    message: 'QC saved in mock mode',
    data: {
      inspection_id: 10,
      status: 'DRAFT',
      overall_result: 'PASS'
    }
  };
}
```

### UI Test Checklist

```text
- เลือก lot แล้ว serial list เปลี่ยน
- เลือก template แล้ว grid item แสดง
- กรอกค่า out of spec แล้ว preview FAIL
- equipment expired ต้องแสดง warning
- Save draft mock แล้วแสดง inspection_id
- ปุ่ม Approve แสดงเฉพาะ role ที่มีสิทธิ์
```

---

## Module F09 — QA Sampling Page

### Contract ID

```text
C-QA-001
C-QA-002
```

### Page

```text
/qa/sampling
```

### Scope

```text
- Select lot
- Select QA template
- Select sample serial
- Input measured values per sample
- Select equipment
- Calculate unit_result และ overall_result preview
- Save Draft
- Submit / Review / Approve / Reject ตาม role
```

### API

```http
GET    /api/qa/lots?search=
GET    /api/qa/lots/:lotId/units
GET    /api/qa/models/:modelId/templates
GET    /api/qa/templates/:templateId/items
GET    /api/qa/lots/:lotId/latest-sampling
POST   /api/qa/samplings
PUT    /api/qa/samplings/:id
GET    /api/qa/samplings/:id/equipment-check
POST   /api/qa/samplings/:id/submit
POST   /api/qa/samplings/:id/review
POST   /api/qa/samplings/:id/approve
POST   /api/qa/samplings/:id/reject
```

### UI Components

```text
LotSelector
TemplateSelector
SampleSerialSelector
QaSampleGrid
SampleResultBadge
QaSummaryPanel
EquipmentSelector
ApprovalActions
```

### Console Log

```ts
console.info('[QA][LOT_SELECT]', { lotId });
console.info('[QA][ADD_SAMPLE]', { product_unit_id, serial_number });
console.info('[QA][SAMPLE_VALUE_CHANGE]', { sample_no, template_item_id, measured_value, previewResult });
console.info('[QA][SAVE_DRAFT][START]', { lot_id, template_id, sampleCount });
console.info('[QA][SAVE_DRAFT][MOCK]', { qa_sampling_id: 20, overall_result: 'PASS' });
```

### Mock Action

```ts
export async function mockSaveQaSampling(payload: unknown) {
  console.info('[QA][SAVE_DRAFT][MOCK_START]', { payload });
  return {
    success: true,
    message: 'QA saved in mock mode',
    data: {
      qa_sampling_id: 20,
      status: 'DRAFT',
      sample_qty: 3,
      accept_qty: 3,
      reject_qty: 0,
      overall_result: 'PASS'
    }
  };
}
```

### UI Test Checklist

```text
- เลือก sample serial ซ้ำ ต้องเตือน
- เพิ่ม sample ได้หลายตัว
- unit_result คำนวณตาม item mandatory
- reject_qty > 0 แล้ว overall_result ต้อง FAIL
- Save draft mock แล้ว summary update
- ปุ่ม Approve แสดงเฉพาะ role ที่มีสิทธิ์
```

---

## Module F10 — Approval Actions Component

### Contract ID

```text
C-QC-002
C-QA-002
```

### Component

```text
components/ApprovalActions/ApprovalActions.tsx
```

### Scope

```text
- Render Submit / Review / Approve / Reject ตาม status และ permission
- Confirm dialog ก่อน action
- Remark input optional/required ตาม action
- Refresh data หลัง action สำเร็จ
```

### API

```http
POST /api/qc/inspections/:id/submit
POST /api/qc/inspections/:id/review
POST /api/qc/inspections/:id/approve
POST /api/qc/inspections/:id/reject
POST /api/qa/samplings/:id/submit
POST /api/qa/samplings/:id/review
POST /api/qa/samplings/:id/approve
POST /api/qa/samplings/:id/reject
```

### Console Log

```ts
console.info('[APPROVAL_ACTIONS][CLICK]', { sourceType, sourceId, action, currentStatus });
console.info('[APPROVAL_ACTIONS][CONFIRM]', { sourceType, sourceId, action, remark });
console.info('[APPROVAL_ACTIONS][API_SUCCESS]', { sourceType, sourceId, newStatus });
console.error('[APPROVAL_ACTIONS][API_ERROR]', { sourceType, sourceId, action, message });
```

### Mock Action

```ts
export function mockApprovalAction(currentStatus: string, action: string) {
  const nextMap: Record<string, string> = {
    SUBMIT: 'SUBMITTED',
    REVIEW: 'REVIEWED',
    APPROVE: 'APPROVED',
    REJECT: 'REJECTED'
  };
  console.info('[APPROVAL_ACTIONS][MOCK]', { currentStatus, action, nextStatus: nextMap[action] });
  return { success: true, data: { old_status: currentStatus, new_status: nextMap[action] } };
}
```

### UI Test Checklist

```text
- DRAFT แสดง Submit
- SUBMITTED แสดง Review / Reject สำหรับ reviewer
- REVIEWED แสดง Approve / Reject สำหรับ approver
- APPROVED ไม่แสดงปุ่ม action ปกติ
- Backend reject 409 ต้องแสดงข้อความ status ไม่ถูกต้อง
```

---

## Module F11 — Edit Result Page

### Contract ID

```text
C-EDIT-001
```

### Page

```text
/edit-results
```

### Scope

```text
- Search QC/QA record
- Load detail
- Edit measured_value / measured_text / remark
- Require reason
- Show edit history
```

### API

```http
GET  /api/edit-results/qc/:inspectionId
PUT  /api/edit-results/qc/:inspectionId
GET  /api/edit-results/qa/:qaSamplingId
PUT  /api/edit-results/qa/:qaSamplingId
GET  /api/reports/:sourceType/:headerId/edit-history
```

### Console Log

```ts
console.info('[EDIT_RESULT][LOAD][START]', { sourceType, headerId });
console.info('[EDIT_RESULT][FIELD_CHANGE]', { detailId, fieldName });
console.info('[EDIT_RESULT][SUBMIT][START]', { sourceType, headerId, changedCount, hasReason: Boolean(reason) });
console.info('[EDIT_RESULT][SUBMIT][API_SUCCESS]', { logCount });
```

### Mock Action

```ts
export async function mockEditResult(payload: unknown) {
  console.info('[EDIT_RESULT][SUBMIT][MOCK]', { payload });
  return {
    success: true,
    message: 'Edit result saved in mock mode',
    data: { log_count: 2, overall_result: 'PASS' }
  };
}
```

### UI Test Checklist

```text
- reason ว่างต้อง save ไม่ได้
- เปลี่ยนหลาย field ต้องแสดง changed summary
- approved record ต้องแสดง warning ก่อนแก้
- save สำเร็จแล้ว edit history refresh
```

---

## Module F12 — Reports / Export

### Contract ID

```text
C-RPT-001
C-RPT-002
```

### Pages

```text
/reports/qc
/reports/qa
```

### Scope

```text
- Filter report
- Data table with pagination
- Detail drawer/modal
- Approval history
- Edit history
- Equipment traceability
- Export PDF / Excel
```

### API

```http
GET /api/reports/qc?model_code=&lot_number=&serial_number=&date_from=&date_to=&result=&status=&equipment_code=&calibration_status=
GET /api/reports/qa?model_code=&lot_number=&serial_number=&date_from=&date_to=&result=&status=&equipment_code=&calibration_status=
GET /api/reports/qc/:inspectionId
GET /api/reports/qa/:qaSamplingId
GET /api/reports/:sourceType/:sourceId/approval-history
GET /api/reports/:sourceType/:headerId/edit-history
GET /api/reports/qc/:inspectionId/export/pdf
GET /api/reports/qa/:qaSamplingId/export/pdf
GET /api/reports/qc/export/excel
GET /api/reports/qa/export/excel
```

### Console Log

```ts
console.info('[REPORT][QC_SEARCH][START]', { filters, page, pageSize });
console.info('[REPORT][QC_SEARCH][API_SUCCESS]', { total, returned });
console.info('[REPORT][DETAIL_OPEN]', { sourceType, id });
console.info('[REPORT][EXPORT][START]', { exportType, filters });
```

### Mock Action

```ts
export const mockQcReportRows = [
  { inspection_id: 10, model_code: 'CMA-003', lot_number: 'Assy/2601/0900', serial_number: '69020200', overall_result: 'PASS', status: 'APPROVED' },
  { inspection_id: 11, model_code: 'CMA-003', lot_number: 'Assy/2601/0900', serial_number: '69020201', overall_result: 'FAIL', status: 'REVIEWED' }
];
```

### UI Test Checklist

```text
- Filter lot_number ที่มี / ต้อง query encode ถูกต้อง
- Pagination ทำงานได้
- ResultBadge PASS/FAIL แสดงถูก
- Export button แสดง loading
- Detail แสดง equipment traceability ได้
```

---

## Module F13 — API Setting / API Log Viewer

### Contract ID

```text
C-EXT-001
C-LOG-001
```

### Pages

```text
/settings/api
/settings/api-logs
```

### Scope

```text
- แสดง External API endpoint information
- แสดง API key status ไม่แสดง plain key
- View api_request_log
- Filter success/error/date/endpoint
```

### API

```http
GET /api/api-logs?endpoint=&success=&date_from=&date_to=
GET /api/health
```

### Console Log

```ts
console.info('[API_LOGS][LOAD][START]', { filters });
console.info('[API_LOGS][LOAD][API_SUCCESS]', { total, returned });
console.info('[API_SETTING][HEALTH_CHECK][START]');
console.info('[API_SETTING][HEALTH_CHECK][SUCCESS]', { status: 'OK' });
```

### Mock Action

```ts
export const mockApiLogs = [
  { id: 1, endpoint: '/api/qc/result', method: 'POST', status_code: 200, success: true, requested_at: '2026-05-29T10:00:00' },
  { id: 2, endpoint: '/api/qa/result', method: 'POST', status_code: 401, success: false, error_message: 'Invalid API key', requested_at: '2026-05-29T10:05:00' }
];
```

### UI Test Checklist

```text
- API log table แสดง success/error badge
- Filter endpoint ได้
- Health check แสดงสถานะ API
- ไม่แสดง API key แบบ plain text
```

---

# PART B — Frontend Development Phase Plan

## Phase 1 — Frontend Foundation

```text
1. Setup React + TypeScript + Vite
2. Setup Router
3. Setup Layout / Sidebar / Header
4. Setup HTTP client
5. Setup TanStack Query
6. Setup AuthProvider
7. Setup logger utility
8. Setup mock mode flag
```

Done Criteria

```text
- เปิดเว็บได้
- Route หลักทำงาน
- Login page แสดงได้
- Mock mode เปิด/ปิดได้จาก env
- Console log format ตรงมาตรฐาน
```

---

## Phase 2 — Auth / Permission UI

```text
1. Login Page
2. AuthProvider
3. Protected Route
4. Permission-based Sidebar
5. Logout
```

Done Criteria

```text
- Login mock ได้
- Login API จริงได้เมื่อ Backend พร้อม
- Role VIEWER เห็นเฉพาะ Dashboard / Report
- ADMIN เห็นครบทุกเมนู
```

---

## Phase 3 — Master Data UI

```text
1. Product Master pages
2. Equipment pages
3. Model Required Equipment page
4. Test Template page
```

Done Criteria

```text
- CRUD mock mode ทำงาน
- เชื่อม API จริงได้ทีละ module
- validation form ทำงาน
- table search/filter/sort ทำงาน
```

---

## Phase 4 — Production UI

```text
1. Production Lot page
2. Serial generation preview
3. Serial import optional
4. Current Lot Dashboard
```

Done Criteria

```text
- Generate serial preview ได้
- Save lot mock/API ได้
- Duplicate warning แสดงได้
- Dashboard แสดง lot summary ได้
```

---

## Phase 5 — QC / QA UI

```text
1. QC Inspection page
2. QA Sampling page
3. Equipment selector
4. Result calculator preview
5. ApprovalActions component
```

Done Criteria

```text
- QC save draft mock/API ได้
- QA save draft mock/API ได้
- PASS/FAIL preview ถูกต้อง
- Equipment expired warning แสดงได้
- Submit/Review/Approve/Reject button แสดงตาม role/status
```

---

## Phase 6 — Report / Edit / Logs UI

```text
1. QC Report
2. QA Report
3. Report detail
4. Export action
5. Edit Result page
6. API Log viewer
```

Done Criteria

```text
- Report search/filter/pagination ใช้งานได้
- Detail drawer แสดงข้อมูลครบ
- Edit result require reason
- API log viewer filter ได้
- Export button เรียก backend file download ได้
```

---

# PART C — UI Mock Mode Guideline

## Mock Mode Environment

```env
VITE_USE_MOCK=true
VITE_API_BASE_URL=http://localhost:3000
```

## API Wrapper Concept

```ts
const useMock = import.meta.env.VITE_USE_MOCK === 'true';

export async function getQcReport(params: QcReportParams) {
  console.info('[REPORT][QC_SEARCH][START]', params);
  if (useMock) {
    console.info('[REPORT][QC_SEARCH][MOCK]', { count: mockQcReportRows.length });
    return { success: true, data: mockQcReportRows, meta: { total: mockQcReportRows.length } };
  }
  return apiGet('/api/reports/qc?' + new URLSearchParams(params as any));
}
```

## Mock Data Rule

```text
- Mock data ต้องมีทั้ง PASS และ FAIL
- Mock data ต้องมี status DRAFT / SUBMITTED / REVIEWED / APPROVED / REJECTED
- Mock data ต้องมี equipment valid และ expired
- Mock data ต้องมี role หลายประเภท เช่น ADMIN, VIEWER, QC Operator
- Mock action ต้อง console.log payload ที่ไม่ใช่ข้อมูลลับ
```

---

# PART D — Sync Rule with Backend Team

Frontend ต้องส่งข้อมูลให้ Backend ตามนี้

```text
1. Payload ที่ UI ส่งจริง
2. Field validation ที่ UI ต้องการ
3. Error message ที่ต้องการแสดงในหน้า
4. Filter / pagination ที่ใช้จริง
5. Action flow ที่เกิดขึ้นจริงใน UI
6. Mock payload ที่ใช้ทดสอบ
```

Backend ต้องส่งข้อมูลให้ Frontend ตามนี้

```text
1. Endpoint URL
2. HTTP Method
3. Request JSON
4. Response JSON
5. Error code
6. Permission required
7. Example data
8. Field enum เช่น status, result, role, check_type
```

---

## Appendix A — Frontend Route Mapping

| Route | Module | Permission |
|---|---|---|
| `/login` | Login | Public |
| `/dashboard/current-lots` | Dashboard | Dashboard |
| `/products/categories` | Product Category | ProductMaster |
| `/products/sub-categories` | Product Sub Category | ProductMaster |
| `/products/models` | Product Model | ProductMaster |
| `/equipment/types` | Equipment Type | EquipmentMaster |
| `/equipment/master` | Equipment Master | EquipmentMaster |
| `/equipment/model-required` | Model Required Equipment | ModelRequiredEquipment |
| `/templates` | Test Template | TestTemplate |
| `/production-lots` | Production Lot | ProductionLot |
| `/qc/inspection` | QC Inspection | QCInspection |
| `/qa/sampling` | QA Sampling | QASampling |
| `/reports/qc` | QC Report | SearchReport |
| `/reports/qa` | QA Report | SearchReport |
| `/edit-results` | Edit Result | EditTestResult |
| `/admin/users` | User Admin | UserRole |
| `/admin/roles` | Role Admin | UserRole |
| `/settings/api` | API Setting | ApiSetting |
| `/settings/api-logs` | API Log Viewer | ApiSetting |

---

## Appendix B — Shared Enum

Frontend ควรสร้างไฟล์ enum กลางให้ตรงกับ Backend

```ts
export const ResultValues = ['PASS', 'FAIL', 'N/A'] as const;
export const StatusValues = ['DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED'] as const;
export const TemplateTypes = ['INSPECTION', 'QA'] as const;
export const CheckTypes = ['NUMERIC', 'BOOLEAN', 'TEXT'] as const;
export const EquipmentStatuses = ['ACTIVE', 'INACTIVE', 'REPAIR', 'CALIBRATION'] as const;
export const RoleCodes = [
  'ADMIN',
  'INSPECTION_OPERATOR',
  'INSPECTION_REVIEWER',
  'INSPECTION_APPROVER',
  'QA_OPERATOR',
  'QA_REVIEWER',
  'QA_APPROVER',
  'VIEWER'
] as const;
```

---

## Appendix C — UI Acceptance Checklist

```text
1. Login ทำงานและ redirect ถูกต้อง
2. Menu แสดงตาม permission
3. Product / Equipment / Template CRUD ใช้งานได้
4. Production Lot สร้าง serial preview ได้
5. QC input grid คำนวณ PASS/FAIL preview ได้
6. QA sampling grid คำนวณ unit_result และ overall_result ได้
7. Equipment expired แสดง warning
8. Approval button แสดงตาม role/status
9. Edit result ต้องใส่ reason
10. Report filter / pagination / detail ใช้งานได้
11. Export action เรียก backend ได้
12. API log viewer แสดงข้อมูลได้
13. ทุก module มี console log สำหรับ action หลัก
14. ทุก module มี mock action สำหรับทดสอบ UI ก่อน API พร้อม
```

