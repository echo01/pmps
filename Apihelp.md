# Apihelp.md - PMPS Postman API Examples

เอกสารนี้รวมตัวอย่าง API สำหรับทดสอบด้วย Postman ของระบบ PMPS โดยใช้ตัวแปร Environment เพื่อให้เปลี่ยนค่าได้ง่าย

## Postman Environment

สร้าง Environment ใน Postman แล้วเพิ่มตัวแปร:

| Variable | Initial value |
| --- | --- |
| `base_url` | `http://localhost:3000/api` |
| `token` | เว้นว่างไว้ก่อน Login |
| `admin_username` | `admin` |
| `admin_password` | `Admin@123` |

Header สำหรับ API ที่ต้อง Login:

```http
Authorization: Bearer {{token}}
Content-Type: application/json
```

หลัง Login ให้ใส่ Test script นี้ใน Postman เพื่อเก็บ token อัตโนมัติ:

```javascript
const json = pm.response.json();
if (json.success && json.data && json.data.access_token) {
  pm.environment.set("token", json.data.access_token);
}
```

## 1. Health

### Health Check

```http
GET {{base_url}}/health
```

## 2. Auth

### Login

```http
POST {{base_url}}/auth/login
Content-Type: application/json
```

```json
{
  "username": "{{admin_username}}",
  "password": "{{admin_password}}"
}
```

### Current User

```http
GET {{base_url}}/auth/me
Authorization: Bearer {{token}}
```

## 3. Profile

### Get My Profile

```http
GET {{base_url}}/profile
Authorization: Bearer {{token}}
```

### Update My Profile

```http
PUT {{base_url}}/profile
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "full_name": "System Admin",
  "email": "admin@example.com"
}
```

### Change My Password

```http
POST {{base_url}}/profile/password
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "current_password": "Admin@123",
  "new_password": "Admin@1234",
  "confirm_password": "Admin@1234"
}
```

## 4. Users

Permission: `UserRole`

### List Users

```http
GET {{base_url}}/users?search=admin&active=true&page=1&page_size=20
Authorization: Bearer {{token}}
```

### Create User

```http
POST {{base_url}}/users
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "username": "qc_user01",
  "password": "Password@123",
  "employee_code": "QC001",
  "full_name": "QC User 01",
  "department": "QC",
  "email": "qc_user01@example.com",
  "active": true
}
```

### Get User Detail

```http
GET {{base_url}}/users/3
Authorization: Bearer {{token}}
```

### Update User

```http
PUT {{base_url}}/users/3
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "employee_code": "QC001",
  "full_name": "QC User 01 Updated",
  "department": "QC",
  "email": "qc_user01@example.com",
  "active": true
}
```

### Activate / Deactivate User

```http
PATCH {{base_url}}/users/3/active
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "active": false
}
```

### Lock User

```http
POST {{base_url}}/users/3/lock
Authorization: Bearer {{token}}
```

### Unlock User

```http
POST {{base_url}}/users/3/unlock
Authorization: Bearer {{token}}
```

### Reset User Password

```http
POST {{base_url}}/users/3/password
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "password": "Password@123"
}
```

### Get User Roles

```http
GET {{base_url}}/users/3/roles
Authorization: Bearer {{token}}
```

### Assign User Roles

```http
PUT {{base_url}}/users/3/roles
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "role_ids": [1, 2]
}
```

## 5. Roles and Permissions

Permission: `UserRole`

### List Roles

```http
GET {{base_url}}/roles
Authorization: Bearer {{token}}
```

### Get Role Detail

```http
GET {{base_url}}/roles/1
Authorization: Bearer {{token}}
```

### Create Role

```http
POST {{base_url}}/roles
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "role_code": "QC_OPERATOR",
  "role_name": "QC Operator"
}
```

### Update Role

```http
PUT {{base_url}}/roles/2
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "role_name": "QC Operator Updated"
}
```

### List Permissions

```http
GET {{base_url}}/permissions
Authorization: Bearer {{token}}
```

### Get Role Permissions

```http
GET {{base_url}}/roles/2/permissions
Authorization: Bearer {{token}}
```

### Assign Role Permissions

```http
PUT {{base_url}}/roles/2/permissions
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "permission_ids": [1, 2, 3, 4]
}
```

## 6. Product Master

Permission: `ProductMaster`

### Lookup Product Models

```http
GET {{base_url}}/lookups/product-models?search=CMA
Authorization: Bearer {{token}}
```

### List Product Categories

```http
GET {{base_url}}/product-categories?search=Air&active=true
Authorization: Bearer {{token}}
```

### Create Product Category

```http
POST {{base_url}}/product-categories
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "category_code": "AIR",
  "category_name": "Air Control",
  "description": "Air control products",
  "active": true
}
```

### Update Product Category

```http
PUT {{base_url}}/product-categories/1
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "category_name": "Air Control Updated",
  "description": "Updated category",
  "active": true
}
```

### List Product Sub Categories

```http
GET {{base_url}}/product-sub-categories?category_id=1&active=true
Authorization: Bearer {{token}}
```

### Create Product Sub Category

```http
POST {{base_url}}/product-sub-categories
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "category_id": 1,
  "sub_category_code": "AIR-CONTROL",
  "sub_category_name": "Air Control",
  "description": "Air control sub category",
  "active": true
}
```

### Update Product Sub Category

```http
PUT {{base_url}}/product-sub-categories/1
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "category_id": 1,
  "sub_category_name": "Air Control Updated",
  "description": "Updated sub category",
  "active": true
}
```

### List Product Models

```http
GET {{base_url}}/product-models?search=CMA&active=true
Authorization: Bearer {{token}}
```

### Create Product Model

```http
POST {{base_url}}/product-models
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "sub_category_id": 1,
  "model_code": "CMA-003",
  "product_name": "Air Control CMA-003",
  "model_name": "CMA-003",
  "description": "Air control model",
  "active": true
}
```

### Get Product Model Detail

```http
GET {{base_url}}/product-models/1
Authorization: Bearer {{token}}
```

### Update Product Model

```http
PUT {{base_url}}/product-models/1
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "sub_category_id": 1,
  "product_name": "Air Control CMA-003 Updated",
  "model_name": "CMA-003",
  "description": "Updated model",
  "active": true
}
```

## 7. Equipment Master

Permission: `EquipmentMaster`

### List Equipment Types

```http
GET {{base_url}}/equipment-types?search=DMM
Authorization: Bearer {{token}}
```

### Create Equipment Type

```http
POST {{base_url}}/equipment-types
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "type_code": "DMM",
  "type_name": "Digital Multimeter",
  "description": "Digital multimeter"
}
```

### Update Equipment Type

```http
PUT {{base_url}}/equipment-types/1
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "type_name": "Digital Multimeter Updated",
  "description": "Updated equipment type"
}
```

### List Equipment

```http
GET {{base_url}}/equipment?search=DMM&status=ACTIVE&page=1&page_size=20
Authorization: Bearer {{token}}
```

### List Expired Calibration Equipment

```http
GET {{base_url}}/equipment/expired-calibration
Authorization: Bearer {{token}}
```

### Create Equipment

```http
POST {{base_url}}/equipment
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "equipment_code": "DMM-001",
  "equipment_name": "Digital Multimeter 001",
  "equipment_type_id": 1,
  "brand": "Fluke",
  "model": "179",
  "serial_number": "SN-DMM-001",
  "calibration_no": "CAL-001",
  "calibration_date": "2026-01-01",
  "calibration_due_date": "2026-12-29",
  "status": "ACTIVE",
  "location_name": "QC Room",
  "asset_no": "ASSET-DMM-001",
  "remark": "Ready"
}
```

### Get Equipment Detail

```http
GET {{base_url}}/equipment/1
Authorization: Bearer {{token}}
```

### Update Equipment

```http
PUT {{base_url}}/equipment/1
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "equipment_name": "Digital Multimeter 001 Updated",
  "status": "ACTIVE",
  "calibration_due_date": "2026-12-31",
  "remark": "Updated"
}
```

## 8. Model Required Equipment

Permission: `ModelRequiredEquipment`

### List Required Equipment Mapping

```http
GET {{base_url}}/model-required-equipment?model_id=1
Authorization: Bearer {{token}}
```

### Create Required Equipment Mapping

```http
POST {{base_url}}/model-required-equipment
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "model_id": 1,
  "equipment_type_id": 1,
  "required_qty": 1,
  "mandatory": true,
  "remark": "Required for QC"
}
```

### Update Required Equipment Mapping

```http
PUT {{base_url}}/model-required-equipment/1
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "required_qty": 1,
  "mandatory": true,
  "remark": "Updated requirement"
}
```

### Delete Required Equipment Mapping

```http
DELETE {{base_url}}/model-required-equipment/1
Authorization: Bearer {{token}}
```

### Required Equipment by Model

```http
GET {{base_url}}/models/1/required-equipment
Authorization: Bearer {{token}}
```

### Available Equipment by Model

```http
GET {{base_url}}/models/1/available-equipment
Authorization: Bearer {{token}}
```

## 9. Test Templates

Permission: `TestTemplate`

### List Test Templates

```http
GET {{base_url}}/test-templates?template_type=INSPECTION&active=true&model_id=1&page=1&page_size=20
Authorization: Bearer {{token}}
```

### Create Test Template

```http
POST {{base_url}}/test-templates
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "model_id": 1,
  "template_type": "INSPECTION",
  "template_name": "CMA-003 QC Inspection",
  "revision": "REV.00",
  "revision_note": "Initial revision",
  "effective_from": "2026-06-01",
  "effective_to": null,
  "active": true
}
```

### Get Test Template Detail

```http
GET {{base_url}}/test-templates/1
Authorization: Bearer {{token}}
```

### Update Test Template

```http
PUT {{base_url}}/test-templates/1
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "template_name": "CMA-003 QC Inspection Updated",
  "revision": "REV.01",
  "revision_note": "Updated revision",
  "effective_from": "2026-06-01",
  "effective_to": null,
  "active": true
}
```

### Delete Test Template

```http
DELETE {{base_url}}/test-templates/1
Authorization: Bearer {{token}}
```

### Duplicate Test Template

```http
POST {{base_url}}/test-templates/1/duplicate
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "template_name": "CMA-003 QC Inspection Copy",
  "revision": "REV.00",
  "revision_note": "Copy from existing template",
  "effective_from": "2026-06-08",
  "effective_to": null,
  "active": true,
  "copy_models": true
}
```

### Get Assigned Models

```http
GET {{base_url}}/test-templates/1/models
Authorization: Bearer {{token}}
```

### Assign Models to Template

```http
PUT {{base_url}}/test-templates/1/models
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "model_ids": [1, 2],
  "primary_model_id": 1
}
```

### List Template Sections

```http
GET {{base_url}}/test-templates/1/sections
Authorization: Bearer {{token}}
```

### Create Template Section

```http
POST {{base_url}}/test-templates/1/sections
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "seq_no": 1,
  "section_code": "POWER",
  "section_name": "Power Check"
}
```

### Update Template Section

```http
PUT {{base_url}}/test-template-sections/1
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "seq_no": 1,
  "section_code": "POWER",
  "section_name": "Power Check Updated"
}
```

### Delete Template Section

```http
DELETE {{base_url}}/test-template-sections/1
Authorization: Bearer {{token}}
```

### List Template Items

```http
GET {{base_url}}/test-templates/1/items
Authorization: Bearer {{token}}
```

### Create Template Item

```http
POST {{base_url}}/test-templates/1/items
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "section_id": 1,
  "seq_no": 1,
  "item_code": "QC01",
  "item_name": "Supply ON",
  "test_point": "Supply ON",
  "test_description": "Supply power on test",
  "check_type": "BOOLEAN",
  "expect_value": null,
  "expect_text": "OK",
  "spec_min": null,
  "spec_max": null,
  "decimal_place": null,
  "mandatory": true,
  "active": true,
  "remark": "Required"
}
```

### Update Template Item

```http
PUT {{base_url}}/test-template-items/1
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "section_id": 1,
  "seq_no": 1,
  "item_code": "QC01",
  "item_name": "Supply ON Updated",
  "check_type": "BOOLEAN",
  "mandatory": true,
  "active": true,
  "remark": "Updated"
}
```

### Delete Template Item

```http
DELETE {{base_url}}/test-template-items/1
Authorization: Bearer {{token}}
```

## 10. Production Lots

Permission: `ProductionLot`

### Preview Serial Numbers

```http
POST {{base_url}}/production-lots/generate-serials
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "prefix": "6904",
  "start_number": 47,
  "count": 14,
  "padding": 4
}
```

### List Production Lots

```http
GET {{base_url}}/production-lots?search=Assy&model_code=TL40&page=1&page_size=20
Authorization: Bearer {{token}}
```

### List Current Lots

```http
GET {{base_url}}/current-lots
Authorization: Bearer {{token}}
```

### Create Production Lot

```http
POST {{base_url}}/production-lots
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "model_id": 2,
  "lot_number": "Assy/2603/1472",
  "production_date": "2026-06-04",
  "lot_qty": 14,
  "serial_generation": {
    "prefix": "6904",
    "start_number": 47,
    "count": 14,
    "padding": 4
  },
  "ecn_ids": [],
  "remark": "Created from Postman"
}
```

### Get Production Lot Detail

```http
GET {{base_url}}/production-lots/12
Authorization: Bearer {{token}}
```

### Update Production Lot

```http
PUT {{base_url}}/production-lots/12
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "production_date": "2026-06-04",
  "lot_qty": 16,
  "serial_generation": {
    "prefix": "6904",
    "start_number": 47,
    "count": 16,
    "padding": 4
  },
  "status": "OPEN",
  "remark": "Adjust lot quantity"
}
```

### Delete Production Lot

```http
DELETE {{base_url}}/production-lots/12
Authorization: Bearer {{token}}
```

หมายเหตุ: ถ้า lot มี QC Inspection, QA Sampling, Planning, Report หรือ serial data ระบบจะลบข้อมูลที่เกี่ยวข้องตาม flow ที่ backend รองรับ

### List Lot Serials

```http
GET {{base_url}}/production-lots/12/serials
Authorization: Bearer {{token}}
```

### Assign ECN to Lot

```http
POST {{base_url}}/production-lots/12/ecn
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "ecn_ids": [1, 2]
}
```

## 11. QC Inspection

Permission: `QCInspection`

### QC Lot Search

```http
GET {{base_url}}/qc/lots?search=Assy&status=OPEN&date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

### QC Lot Inspection Status

```http
GET {{base_url}}/qc/lots/12/inspection-status
Authorization: Bearer {{token}}
```

### QC Lot Units

```http
GET {{base_url}}/qc/lots/12/units
Authorization: Bearer {{token}}
```

### QC Templates by Model

```http
GET {{base_url}}/qc/models/2/templates
Authorization: Bearer {{token}}
```

### QC Template Items

```http
GET {{base_url}}/qc/templates/1/items
Authorization: Bearer {{token}}
```

### Create QC Inspection by Product Unit ID

```http
POST {{base_url}}/qc/inspections
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "product_unit_id": 100,
  "template_id": 1,
  "inspection_no": "17",
  "station_name": "QC-STATION-01",
  "equipment_ids": [],
  "remark": "QC draft from Postman",
  "items": [
    {
      "template_item_id": 1,
      "measured_text": "OK",
      "remark": "PASS"
    },
    {
      "template_item_id": 2,
      "measured_text": "OK",
      "remark": "PASS"
    }
  ]
}
```

### Create QC Inspection by Lot and Serial

ถ้าไม่ส่ง `template_id` หรือส่ง `null` ระบบจะใช้ test template แรกของ model นั้นเป็น default

```http
POST {{base_url}}/qc/inspections/by-serial
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "lot_number": "Assy/2602/0263",
  "serial_number": "69040065",
  "template_id": null,
  "station_name": "QC-STATION-01",
  "equipment_ids": [],
  "remark": "QC by serial from Postman",
  "items": [
    {
      "item_code": "QC01",
      "measured_text": "OK",
      "remark": "PASS"
    },
    {
      "item_code": "QC02",
      "measured_text": "OK",
      "remark": "PASS"
    },
    {
      "item_code": "QC03",
      "measured_text": "OK",
      "remark": "PASS"
    },
    {
      "item_code": "QC04",
      "measured_text": "OK",
      "remark": "PASS"
    },
    {
      "item_code": "QC05",
      "measured_text": "OK",
      "remark": "PASS"
    },
    {
      "item_code": "QA06",
      "measured_text": "OK",
      "remark": "PASS"
    },
    {
      "item_code": "QC07",
      "measured_text": "OK",
      "remark": "PASS"
    }
  ]
}
```

### Get QC Inspection Detail

```http
GET {{base_url}}/qc/inspections/110
Authorization: Bearer {{token}}
```

### Update QC Inspection Draft

```http
PUT {{base_url}}/qc/inspections/110
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "station_name": "QC-STATION-01",
  "equipment_ids": [],
  "remark": "Update QC draft",
  "items": [
    {
      "template_item_id": 1,
      "measured_text": "OK",
      "remark": "PASS"
    }
  ]
}
```

### QC Equipment Check

```http
GET {{base_url}}/qc/inspections/110/equipment-check
Authorization: Bearer {{token}}
```

### Submit QC Inspection

```http
POST {{base_url}}/qc/inspections/110/submit
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "remark": "Submit QC"
}
```

### Review QC Inspection

```http
POST {{base_url}}/qc/inspections/110/review
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "remark": "Review QC"
}
```

### Approve QC Inspection

```http
POST {{base_url}}/qc/inspections/110/approve
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "remark": "Approve QC"
}
```

### Reject QC Inspection

```http
POST {{base_url}}/qc/inspections/110/reject
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "remark": "Reject reason is required"
}
```

### Bulk QC Workflow by IDs

```http
POST {{base_url}}/qc/inspections/bulk-workflow
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "action": "SUBMIT",
  "inspection_ids": [110, 111, 112],
  "remark": "Bulk submit QC"
}
```

### Bulk QC Workflow by Lot

```http
POST {{base_url}}/qc/inspections/bulk-workflow
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "action": "APPROVE",
  "lot_id": 12,
  "remark": "Bulk approve all ready QC in lot"
}
```

### Request QC Edit After Approved

Permission: `EditTestResult`

```http
POST {{base_url}}/qc/inspections/110/edit-request
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "reason": "Incorrect value found after approval"
}
```

### Apply QC Edit

Permission: `EditTestResult`

```http
POST {{base_url}}/qc/inspections/110/apply-edit
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "reason": "Correct measured result",
  "items": [
    {
      "detail_id": 1001,
      "measured_text": "OK",
      "remark": "Corrected"
    }
  ]
}
```

### QC Edit History

Permission: `SearchReport` หรือ `EditTestResult`

```http
GET {{base_url}}/qc/inspections/110/edit-history
Authorization: Bearer {{token}}
```

## 12. QA Sampling

Permission: `QASampling`

### QA Lot Search

```http
GET {{base_url}}/qa/lots?search=Assy&sampling_status=APPROVED&date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

### QA Lot Sampling Status

```http
GET {{base_url}}/qa/lots/12/sampling-status
Authorization: Bearer {{token}}
```

### QA Lot Units

```http
GET {{base_url}}/qa/lots/12/units
Authorization: Bearer {{token}}
```

### QA Templates by Model

```http
GET {{base_url}}/qa/models/2/templates
Authorization: Bearer {{token}}
```

### QA Template Items

```http
GET {{base_url}}/qa/templates/2/items
Authorization: Bearer {{token}}
```

### Create QA Sampling by Lot ID

```http
POST {{base_url}}/qa/samplings
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "lot_id": 12,
  "template_id": 2,
  "sampling_no": "1",
  "sampling_method": "MANUAL",
  "station_name": "QA-STATION-01",
  "equipment_ids": [],
  "remark": "QA draft from Postman",
  "sample_units": [
    {
      "product_unit_id": 100,
      "remark": "Sample 1",
      "items": [
        {
          "template_item_id": 10,
          "measured_text": "OK",
          "remark": "PASS"
        }
      ]
    }
  ]
}
```

### Create QA Sampling by Lot and Serial

ถ้าไม่ส่ง `template_id` หรือส่ง `null` ระบบจะใช้ QA test template แรกของ model นั้นเป็น default

```http
POST {{base_url}}/qa/samplings/by-serial
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "lot_number": "Assy/2603/1472",
  "serial_number": "69040047",
  "template_id": null,
  "sampling_method": "MANUAL",
  "station_name": "QA-STATION-01",
  "equipment_ids": [],
  "sample_remark": "Sample selected by API",
  "remark": "QA by serial from Postman",
  "items": [
    {
      "item_code": "QC01",
      "measured_text": "OK",
      "remark": "PASS"
    },
    {
      "item_code": "QC02",
      "measured_text": "OK",
      "remark": "PASS"
    },
    {
      "item_code": "QC03",
      "measured_text": "OK",
      "remark": "PASS"
    },
    {
      "item_code": "QC04",
      "measured_text": "OK",
      "remark": "PASS"
    },
    {
      "item_code": "QC05",
      "measured_text": "OK",
      "remark": "PASS"
    },
    {
      "item_code": "QA06",
      "measured_text": "OK",
      "remark": "PASS"
    },
    {
      "item_code": "QC07",
      "measured_text": "OK",
      "remark": "PASS"
    }
  ]
}
```

### Get QA Sampling Detail

```http
GET {{base_url}}/qa/samplings/9
Authorization: Bearer {{token}}
```

### Update QA Sampling Draft

```http
PUT {{base_url}}/qa/samplings/9
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "sampling_method": "MANUAL",
  "station_name": "QA-STATION-01",
  "equipment_ids": [],
  "remark": "Update QA draft",
  "sample_units": [
    {
      "product_unit_id": 100,
      "remark": "Update sample",
      "items": [
        {
          "template_item_id": 10,
          "measured_text": "OK",
          "remark": "PASS"
        }
      ]
    }
  ]
}
```

### QA Equipment Check

```http
GET {{base_url}}/qa/samplings/9/equipment-check
Authorization: Bearer {{token}}
```

### Submit QA Sampling

```http
POST {{base_url}}/qa/samplings/9/submit
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "remark": "Submit QA"
}
```

### Review QA Sampling

```http
POST {{base_url}}/qa/samplings/9/review
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "remark": "Review QA"
}
```

### Approve QA Sampling

```http
POST {{base_url}}/qa/samplings/9/approve
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "remark": "Approve QA"
}
```

### Reject QA Sampling

```http
POST {{base_url}}/qa/samplings/9/reject
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "remark": "Reject reason is required"
}
```

### Request QA Edit After Approved

Permission: `EditTestResult`

```http
POST {{base_url}}/qa/samplings/9/edit-request
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "reason": "Incorrect value found after approval"
}
```

### Apply QA Edit

Permission: `EditTestResult`

```http
POST {{base_url}}/qa/samplings/9/apply-edit
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "reason": "Correct sampled result",
  "items": [
    {
      "detail_id": 2001,
      "measured_text": "OK",
      "remark": "Corrected"
    }
  ]
}
```

### QA Edit History

Permission: `SearchReport` หรือ `EditTestResult`

```http
GET {{base_url}}/qa/samplings/9/edit-history
Authorization: Bearer {{token}}
```

## 13. Dashboard and Reports

Permission: `SearchReport`

### Dashboard Summary

```http
GET {{base_url}}/dashboard/summary
Authorization: Bearer {{token}}
```

### QC Summary

```http
GET {{base_url}}/dashboard/qc-summary?date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

### QA Summary

```http
GET {{base_url}}/dashboard/qa-summary?date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

### Lot Status Summary

```http
GET {{base_url}}/dashboard/lot-status?date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

### Lot Report Search

```http
GET {{base_url}}/reports/lots?search=Assy&model_code=TL40&lot_number=all&status=All&date_from=2026-05-03&date_to=2026-12-31&page=1&page_size=20
Authorization: Bearer {{token}}
```

### Serial Report Search

```http
GET {{base_url}}/reports/serials?serial_number=69040065&page=1&page_size=20
Authorization: Bearer {{token}}
```

### QC Inspection Report Search

```http
GET {{base_url}}/reports/qc-inspections?status=APPROVED&result=PASS&page=1&page_size=20
Authorization: Bearer {{token}}
```

### QA Sampling Report Search

```http
GET {{base_url}}/reports/qa-samplings?status=APPROVED&result=PASS&page=1&page_size=20
Authorization: Bearer {{token}}
```

### Lot Report Detail

```http
GET {{base_url}}/reports/lots/12
Authorization: Bearer {{token}}
```

### Serial Report Detail

```http
GET {{base_url}}/reports/serials/100
Authorization: Bearer {{token}}
```

### QC Inspection Report Detail

```http
GET {{base_url}}/reports/qc-inspections/110
Authorization: Bearer {{token}}
```

### QA Sampling Report Detail

```http
GET {{base_url}}/reports/qa-samplings/9
Authorization: Bearer {{token}}
```

## 14. Exports

Permission: `SearchReport`

### Export QC CSV

```http
GET {{base_url}}/exports/qc-inspections.csv?status=APPROVED&date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

### Export QC XLSX

```http
GET {{base_url}}/exports/qc-inspections.xlsx?status=APPROVED&date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

### Export QC PDF

```http
GET {{base_url}}/exports/qc-inspections.pdf?status=APPROVED&date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

### Export QC Detail PDF

```http
GET {{base_url}}/exports/qc-inspections/110/pdf
Authorization: Bearer {{token}}
```

### Export QA CSV

```http
GET {{base_url}}/exports/qa-samplings.csv?status=APPROVED&date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

### Export QA XLSX

```http
GET {{base_url}}/exports/qa-samplings.xlsx?status=APPROVED&date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

### Export QA PDF

```http
GET {{base_url}}/exports/qa-samplings.pdf?status=APPROVED&date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

### Export QA Detail PDF

```http
GET {{base_url}}/exports/qa-samplings/9/pdf
Authorization: Bearer {{token}}
```

### Export Lots CSV

```http
GET {{base_url}}/exports/lots.csv?date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

### Export Lots XLSX

```http
GET {{base_url}}/exports/lots.xlsx?date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

### Export Lot Detail PDF

```http
GET {{base_url}}/exports/lots/12/pdf
Authorization: Bearer {{token}}
```

### Export Audit Trails CSV

```http
GET {{base_url}}/exports/audit-trails.csv?source_type=QC&date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

### Export Audit Trails XLSX

```http
GET {{base_url}}/exports/audit-trails.xlsx?source_type=QA&date_from=2026-06-01&date_to=2026-12-31
Authorization: Bearer {{token}}
```

## 15. Lot Test Planning

Permission:

- View: `PlanningView` หรือ `SearchReport`
- Manage: `PlanningManage`

### List Plans

```http
GET {{base_url}}/planning/plans?search=Assy&status=PLANNED&date_from=2026-06-01&date_to=2026-06-30
Authorization: Bearer {{token}}
```

### Get Plan Detail

```http
GET {{base_url}}/planning/plans/1
Authorization: Bearer {{token}}
```

### Create Plan

```http
POST {{base_url}}/planning/plans
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "lot_id": 12,
  "plan_code": "PLAN-00012",
  "plan_name": "Assy/2602/0263 Test Plan",
  "priority": "NORMAL",
  "planned_start_datetime": "2026-06-06T08:00:00",
  "planned_end_datetime": "2026-06-06T17:00:00",
  "owner_user_id": null,
  "plan_status": "PLANNED",
  "remark": "Create plan from Postman",
  "create_default_tasks": true
}
```

### Update Plan

```http
PUT {{base_url}}/planning/plans/1
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "plan_name": "Assy/2602/0263 Test Plan Updated",
  "priority": "HIGH",
  "planned_start_datetime": "2026-06-06T09:00:00",
  "planned_end_datetime": "2026-06-06T18:00:00",
  "plan_status": "IN_PROGRESS",
  "remark": "Update plan date and time"
}
```

### Delete Plan

```http
DELETE {{base_url}}/planning/plans/1
Authorization: Bearer {{token}}
```

### Add Plan Task

```http
POST {{base_url}}/planning/plans/1/tasks
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "task_type": "QC_INSPECTION",
  "task_name": "QC Inspection",
  "assigned_user_id": null,
  "planned_start_datetime": "2026-06-06T09:00:00",
  "planned_end_datetime": "2026-06-06T11:00:00",
  "task_status": "PLANNED",
  "source_type": "QC",
  "source_id": null,
  "sort_order": 2,
  "remark": "QC inspection task"
}
```

### Update Plan Task

ใช้ endpoint นี้สำหรับแก้วันเวลา task จาก Calendar drag/drop ด้วย

```http
PUT {{base_url}}/planning/tasks/10
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "task_type": "QA_SAMPLING",
  "task_name": "QA Sampling",
  "assigned_user_id": null,
  "planned_start_datetime": "2026-06-11T09:00:00",
  "planned_end_datetime": "2026-06-11T15:00:00",
  "task_status": "PLANNED",
  "source_type": "QA",
  "source_id": 9,
  "sort_order": 5,
  "remark": "Move task from calendar"
}
```

### Delete Plan Task

```http
DELETE {{base_url}}/planning/tasks/10
Authorization: Bearer {{token}}
```

## 16. Development Debug Endpoints

ใช้เฉพาะตอนพัฒนา ห้ามเปิดใช้ใน production ถ้าไม่จำเป็น

### Echo JSON Body

```http
POST {{base_url}}/debug/json
Content-Type: application/json
```

```json
{
  "message": "debug body"
}
```

### Duplicate Role Debug

```http
GET {{base_url}}/debug/db/duplicate-role
```

### Log Body Debug

```http
POST {{base_url}}/debug/log-body
Content-Type: application/json
```

```json
{
  "hello": "world"
}
```

### Error Response Debug

```http
GET {{base_url}}/debug/errors/bad-request
GET {{base_url}}/debug/errors/unauthorized
GET {{base_url}}/debug/errors/forbidden
GET {{base_url}}/debug/errors/not-found
GET {{base_url}}/debug/errors/conflict
GET {{base_url}}/debug/errors/business
GET {{base_url}}/debug/errors/unexpected
```

## 17. Quick Manual Flow Examples

### QC by Serial Full Flow

1. Login แล้วเก็บ `{{token}}`
2. Create QC draft by serial
3. ใช้ `id` จาก response ไป Submit, Review, Approve

```http
POST {{base_url}}/qc/inspections/by-serial
POST {{base_url}}/qc/inspections/{{qc_inspection_id}}/submit
POST {{base_url}}/qc/inspections/{{qc_inspection_id}}/review
POST {{base_url}}/qc/inspections/{{qc_inspection_id}}/approve
```

### QA by Serial Full Flow

1. Login แล้วเก็บ `{{token}}`
2. Create QA draft by serial
3. ใช้ `id` จาก response ไป Submit, Review, Approve

```http
POST {{base_url}}/qa/samplings/by-serial
POST {{base_url}}/qa/samplings/{{qa_sampling_id}}/submit
POST {{base_url}}/qa/samplings/{{qa_sampling_id}}/review
POST {{base_url}}/qa/samplings/{{qa_sampling_id}}/approve
```

### No Token Test

```http
GET {{base_url}}/dashboard/summary
```

Expected:

```json
{
  "success": false,
  "error_code": "UNAUTHORIZED"
}
```

### No Permission Test

ใช้ token ของ user ที่ไม่มี permission เช่น `SearchReport`

```http
GET {{base_url}}/dashboard/summary
Authorization: Bearer {{no_permission_token}}
```

Expected:

```json
{
  "success": false,
  "error_code": "FORBIDDEN"
}
```
