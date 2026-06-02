# Sprint 3 Backend Summary - Master Data

Sprint 3 adds the master data APIs required before Production Lot, QC, QA, Approval, Report, and External API work.

Scope completed:

```text
1. Product Master
2. Equipment Master
3. Model Required Equipment
4. Test Template
5. Shared helpers for query parsing and calibration status
6. Integration tests for Sprint 3 master data flow
```

---

## 1. Files Added / Updated

### Added

```text
server/src/shared/query.js
server/src/shared/pagination.js
server/src/shared/calibration-status.js

server/src/modules/products/products.routes.js
server/src/modules/products/products.controller.js
server/src/modules/products/products.service.js
server/src/modules/products/products.repository.js
server/src/modules/products/products.schema.js

server/src/modules/equipment/equipment.routes.js
server/src/modules/equipment/equipment.controller.js
server/src/modules/equipment/equipment.service.js
server/src/modules/equipment/equipment.repository.js
server/src/modules/equipment/equipment.schema.js

server/src/modules/model-required-equipment/model-required-equipment.routes.js
server/src/modules/model-required-equipment/model-required-equipment.controller.js
server/src/modules/model-required-equipment/model-required-equipment.service.js
server/src/modules/model-required-equipment/model-required-equipment.repository.js
server/src/modules/model-required-equipment/model-required-equipment.schema.js

server/src/modules/test-templates/test-templates.routes.js
server/src/modules/test-templates/test-templates.controller.js
server/src/modules/test-templates/test-templates.service.js
server/src/modules/test-templates/test-templates.repository.js
server/src/modules/test-templates/test-templates.schema.js

server/src/tests/master-data.test.js
```

### Updated

```text
server/src/app.js
```

---

## 2. Product Master API

Permission:

```text
ProductMaster or ADMIN
```

Implemented endpoints:

```http
GET    /api/product-categories?search=&active=
POST   /api/product-categories
PUT    /api/product-categories/:id

GET    /api/product-sub-categories?search=&active=&category_id=
POST   /api/product-sub-categories
PUT    /api/product-sub-categories/:id

GET    /api/product-models?search=&active=&sub_category_id=
POST   /api/product-models
GET    /api/product-models/:id
PUT    /api/product-models/:id

GET    /api/lookups/product-models
```

Important behavior:

```text
- category_code duplicate returns 409
- sub_category_code duplicate returns 409
- model_code duplicate returns 409
- active=false product models are excluded from /api/lookups/product-models
- FK references are checked in service before insert/update
```

---

## 3. Equipment Master API

Permission:

```text
EquipmentMaster or ADMIN
```

Implemented endpoints:

```http
GET    /api/equipment-types?search=
POST   /api/equipment-types
PUT    /api/equipment-types/:id

GET    /api/equipment?search=&status=&equipment_type_id=
POST   /api/equipment
GET    /api/equipment/:id
PUT    /api/equipment/:id

GET    /api/equipment/expired-calibration
```

Important behavior:

```text
- type_code duplicate returns 409
- equipment_code duplicate returns 409
- status is limited to ACTIVE, INACTIVE, REPAIR, CALIBRATION
- calibration_status is returned as VALID, EXPIRED, or UNKNOWN
- expired calibration API returns equipment where calibration_due_date < CURRENT_DATE
```

---

## 4. Model Required Equipment API

Permission:

```text
ModelRequiredEquipment or ADMIN
```

Implemented endpoints:

```http
GET    /api/model-required-equipment?model_id=
POST   /api/model-required-equipment
PUT    /api/model-required-equipment/:id
DELETE /api/model-required-equipment/:id

GET    /api/models/:modelId/required-equipment
GET    /api/models/:modelId/available-equipment
```

Important behavior:

```text
- model_id must exist
- equipment_type_id must exist
- required_qty must be greater than 0
- duplicate model_id + equipment_type_id returns 409
- available-equipment returns only ACTIVE equipment
- available-equipment includes calibration_status
```

---

## 5. Test Template API

Permission:

```text
TestTemplate or ADMIN
```

Implemented endpoints:

```http
GET    /api/test-templates?model_id=&template_type=&active=
POST   /api/test-templates
GET    /api/test-templates/:id
PUT    /api/test-templates/:id

GET    /api/test-templates/:templateId/sections
POST   /api/test-templates/:templateId/sections
PUT    /api/test-template-sections/:id
DELETE /api/test-template-sections/:id

GET    /api/test-templates/:templateId/items
POST   /api/test-templates/:templateId/items
PUT    /api/test-template-items/:id
DELETE /api/test-template-items/:id
```

Important behavior:

```text
- template_type is limited to INSPECTION or QA
- duplicate model_id + template_type + template_name + revision returns 409
- check_type is limited to NUMERIC, BOOLEAN, TEXT
- section must belong to the same template when creating/updating items
- item_name from frontend is accepted and mapped to DB column test_point
- item response includes both test_point and item_name
- GET /api/test-templates/:templateId/items returns items grouped by section
```

---

## 6. Shared Helpers

```text
server/src/shared/query.js
  - parsePositiveInt
  - parseOptionalPositiveInt
  - parseBooleanQuery
  - parsePayload

server/src/shared/pagination.js
  - parsePagination
  - paginationMeta

server/src/shared/calibration-status.js
  - getCalibrationStatus
```

Calibration rules:

```text
calibration_due_date >= today -> VALID
calibration_due_date < today  -> EXPIRED
calibration_due_date null     -> UNKNOWN
```

---

## 7. Integration Tests

Test file:

```text
server/src/tests/master-data.test.js
```

Run:

```powershell
cd server
npm.cmd test
```

Covered Sprint 3 cases:

```text
- create product category
- duplicate product category returns 409
- create product sub category
- create product model
- product model lookup returns active model
- create equipment type
- create equipment
- calibration_status is returned
- expired calibration API returns expired equipment
- create model required equipment
- duplicate required equipment returns 409
- available equipment by model returns ACTIVE equipment with calibration_status
- create test template
- create template section
- create template item
- get template items grouped by section
```

Latest verification:

```text
tests 13
pass 13
fail 0
```

---

## 8. API Permission Rule

```text
/api/product-*                 ProductMaster or ADMIN
/api/lookups/product-models     ProductMaster or ADMIN
/api/equipment-*                EquipmentMaster or ADMIN
/api/equipment/*                EquipmentMaster or ADMIN
/api/model-required-equipment/* ModelRequiredEquipment or ADMIN
/api/models/:id/*equipment      ModelRequiredEquipment or ADMIN
/api/test-templates/*           TestTemplate or ADMIN
/api/test-template-sections/*   TestTemplate or ADMIN
/api/test-template-items/*      TestTemplate or ADMIN
```

Every Sprint 3 route is protected by:

```js
authMiddleware
requirePermission(...)
```

---

## 9. Notes for Sprint 4

Recommended next sprint:

```text
Sprint 4: Production Lot / Serial / ECN foundation
```

Reason:

```text
Product Model, Equipment, Required Equipment, and Test Template are now available.
The next dependency for QC/QA is Production Lot and Product Unit / Serial.
```

Still not included in Sprint 3:

```text
- Production Lot
- Generate Serial
- QC Save
- QA Save
- Approval Workflow
- Edit Result
- Report
- External API
```
