# Sprint 12 Frontend - Master Data UI

## Objective

Sprint 12 adds the frontend screens needed to manage core master data for Production Lot, QC Inspection, and QA Sampling.

Main scope:

1. Product Category UI
2. Product Sub Category UI
3. Product Model UI
4. Equipment Type UI
5. Equipment Master UI
6. Model Required Equipment UI
7. Test Template UI
8. Template Section UI
9. Template Item UI
10. Permission-based menu and routes
11. Search, filter, add, edit, delete where supported
12. Loading, empty, and error states

## Files Added / Updated

Frontend API:

```text
frontend/src/api/products.api.ts
frontend/src/api/equipment.api.ts
frontend/src/api/modelRequiredEquipment.api.ts
frontend/src/api/testTemplates.api.ts
frontend/src/api/httpClient.ts
```

Frontend pages:

```text
frontend/src/pages/master-data/ProductCategoriesPage.tsx
frontend/src/pages/master-data/ProductSubCategoriesPage.tsx
frontend/src/pages/master-data/ProductModelsPage.tsx
frontend/src/pages/master-data/EquipmentTypesPage.tsx
frontend/src/pages/master-data/EquipmentMasterPage.tsx
frontend/src/pages/master-data/ModelRequiredEquipmentPage.tsx
frontend/src/pages/master-data/TestTemplatesPage.tsx
frontend/src/pages/master-data/TemplateDetailPage.tsx
frontend/src/pages/master-data/masterDataUtils.ts
```

Common UI:

```text
frontend/src/components/master-data/MasterDataToolbar.tsx
frontend/src/components/master-data/MasterDataFormModal.tsx
frontend/src/components/master-data/MasterDataBadges.tsx
frontend/src/components/common/ConfirmDialog.tsx
frontend/src/components/common/FormFieldError.tsx
frontend/src/components/common/SelectField.tsx
```

Routing and layout:

```text
frontend/src/app/router.tsx
frontend/src/layouts/Sidebar.tsx
frontend/src/styles/global.css
frontend/src/mocks/auth.mock.ts
```

Backend schema support:

```text
server/migrations/1780675200000_sprint12-template-section-code.js
```

## Routes

| Route | Screen | Permission |
|---|---|---|
| `/products/categories` | Product Category | `ProductMaster` |
| `/products/sub-categories` | Product Sub Category | `ProductMaster` |
| `/products/models` | Product Model | `ProductMaster` |
| `/equipment/types` | Equipment Type | `EquipmentMaster` |
| `/equipment/master` | Equipment Master | `EquipmentMaster` |
| `/equipment/model-required` | Model Required Equipment | `ModelRequiredEquipment` |
| `/templates` | Test Template List | `TestTemplate` |
| `/templates/:templateId` | Template Sections and Items | `TestTemplate` |

## API Mapping

| UI | Backend API |
|---|---|
| Product Category | `GET/POST/PUT /api/product-categories` |
| Product Sub Category | `GET/POST/PUT /api/product-sub-categories` |
| Product Model | `GET/POST/PUT /api/product-models`, `GET /api/lookups/product-models` |
| Equipment Type | `GET/POST/PUT /api/equipment-types` |
| Equipment Master | `GET/POST/PUT /api/equipment`, `GET /api/equipment/expired-calibration` |
| Model Required Equipment | `GET/POST/PUT/DELETE /api/model-required-equipment` |
| Available Equipment | `GET /api/models/:modelId/available-equipment` |
| Template Header | `GET/POST/PUT /api/test-templates` |
| Template Sections | `GET/POST /api/test-templates/:templateId/sections`, `PUT/DELETE /api/test-template-sections/:id` |
| Template Items | `GET/POST /api/test-templates/:templateId/items`, `PUT/DELETE /api/test-template-items/:id` |

## Validation Rules

Frontend validation now checks:

- `category_code` and `category_name` are required.
- `sub_category_code`, `sub_category_name`, and `category_id` are required.
- `model_code`, `product_name`, and `sub_category_id` are required.
- `type_code` and `type_name` are required.
- `equipment_code` and `equipment_name` are required.
- Equipment status is selected from `ACTIVE`, `INACTIVE`, `REPAIR`, `CALIBRATION`.
- `model_id`, `equipment_type_id`, and `required_qty > 0` are required for model required equipment.
- Template `model_id`, `template_type`, `template_name`, and `revision` are handled in the form.
- Template item `item_name`, `seq_no > 0`, and `check_type` are required.
- For `NUMERIC` template items, `spec_min <= spec_max` is enforced before API submit.
- `BOOLEAN` and `TEXT` template item forms hide numeric spec fields.

Backend remains the final validator for 401, 403, 409, and schema validation.

## Permission Mapping

| Module | Permission |
|---|---|
| Product Category / Sub Category / Model | `ProductMaster` |
| Equipment Type / Equipment | `EquipmentMaster` |
| Model Required Equipment | `ModelRequiredEquipment` |
| Test Template / Section / Item | `TestTemplate` |

Sidebar menus are hidden when the user lacks permission. Routes also use `ProtectedRoute`, while backend RBAC remains authoritative.

## Manual API Smoke Test

Backend was started with:

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd start
```

Login:

```powershell
$login = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{
    username = "admin"
    password = "Admin@123"
  } | ConvertTo-Json)

$headers = @{ Authorization = "Bearer $($login.data.access_token)" }
```

Result:

```text
PASS
HTTP 200
user = admin
```

Smoke test result:

| Check | Result | Count |
|---|---:|---:|
| Product categories | PASS | 5 |
| Product sub categories | PASS | 5 |
| Product models | PASS | 5 |
| Product model lookup | PASS | 5 |
| Equipment types | PASS | 8 |
| Equipment master | PASS | 1 |
| Expired calibration | PASS | 0 |
| Model required equipment | PASS | 1 |
| Test templates | PASS | 12 |
| Template detail | PASS | 1 |
| Template sections | PASS | 0 |
| Template items | PASS | 0 |
| Required equipment by model | PASS | 1 |
| Available equipment by model | PASS | 1 |

Important fix from smoke test:

```text
GET /api/test-templates/:id/sections
GET /api/test-templates/:id/items
```

Initially failed with HTTP 500 because the dev DB was missing `test_template_section.section_code`, while backend repository and Sprint 12 UI support that field. Added and ran migration:

```text
server/migrations/1780675200000_sprint12-template-section-code.js
```

Migration commands run:

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd run migrate:up
npm.cmd run migrate:test:up
```

Result:

```text
PASS
Template sections/items endpoints no longer return 500.
```

## Build Result

Command:

```powershell
cd D:\DevApp\production\PMPS\frontend
npm.cmd run build
```

Result:

```text
PASS
tsc --noEmit PASS
vite build PASS

dist/index.html                 0.39 kB
dist/assets/index-*.css         7.59 kB
dist/assets/index-*.js        363.11 kB
```

## Backend Integration Test Result

Commands:

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd run migrate:test:up
npm.cmd test -- --runInBand
```

Result:

```text
PASS
tests 66
suites 8
pass 66
fail 0
```

## Browser Manual Test Checklist

Use:

```powershell
# Backend
cd D:\DevApp\production\PMPS\server
npm.cmd start

# Frontend
cd D:\DevApp\production\PMPS\frontend
npm.cmd run dev
```

Checklist:

| Step | Expected |
|---|---|
| Login admin | Redirect to `/dashboard` |
| Product menu | Product Category, Sub Category, Product Models visible |
| Equipment menu | Equipment Types, Equipment Master, Required Equipment visible |
| Template menu | Test Templates visible |
| Product Category Add/Edit/Search | Works and shows backend conflict on duplicate code |
| Product Sub Category Add/Edit/Filter | Works with category dropdown |
| Product Model Add/Edit/Filter | Works with sub category dropdown |
| Equipment Type Add/Edit/Search | Works and shows duplicate conflict |
| Equipment Master Add/Edit/Filter | Shows calibration status badge |
| Expired calibration filter | Calls expired calibration API |
| Model Required Equipment | Add/Edit/Delete and available equipment preview work |
| Test Template Header | Add/Edit/Filter by model/type/active works |
| Template Section | Add/Edit/Delete works |
| Template Item | Add/Edit/Delete works and dynamic fields follow `check_type` |
| No permission user | Menu hidden and protected route shows No Permission |
| Backend stopped | ErrorAlert shown; app does not crash |

## Known Limitations

1. Browser UI was not fully clicked through with Playwright in this pass; verification was done by TypeScript build, backend integration tests, and manual API smoke tests.
2. Template item API returns grouped items by section; frontend supports that shape in `TemplateDetailPage`.
3. `Product model lookup` is protected by `ProductMaster`; screens outside Product Master that need this lookup may still require backend permission adjustment later.

## Sprint 12 Status

Sprint 12 is now functionally complete for the requested frontend scope:

- Master Data routes exist.
- API clients exist.
- Add/Edit/Delete where supported exists.
- Loading/empty/error states exist.
- Permission-based menu and route protection exist.
- Build passes.
- Backend integration tests pass.
- Manual API smoke test passes after migration.

## Next Sprint Suggestion

Continue with Sprint 13 / Sprint 14 work that depends on this master data:

```text
Production Lot / Serial UI hardening
QC Inspection Entry UI
QA Sampling Entry UI
Equipment validation display in QC/QA workflows
```
