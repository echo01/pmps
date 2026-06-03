# PMPS - Production Management and Planning System

PMPS is a production quality management system for Production Lot control, QC Inspection, QA Sampling, equipment traceability, approval workflow, RBAC permission control, reports, dashboard, and frontend search screens.

Current project status: Sprint 1-9 completed.

```text
Backend foundation                 PASS
Auth / User / Role / RBAC          PASS
Product / Equipment master data    PASS
Production Lot / Serial / ECN      PASS
QC Inspection workflow             PASS
QA Sampling workflow               PASS
Report / Search / Dashboard API    PASS
Frontend Dashboard/Search screens  PASS
Edit Result / Audit Trail          PASS
```

---

## Tech Stack

```text
Backend runtime   : Node.js
Backend framework : Express.js
Database          : PostgreSQL
DB driver         : pg
Migration         : node-pg-migrate
Validation        : zod
Auth              : JWT
Password hash     : bcrypt
Backend testing   : node:test
Frontend          : Static HTML/CSS/Vanilla JS SPA
Frontend routing  : Hash routing
Environment       : dotenv / dotenv-cli
```

---

## Repository Structure

```text
PMPS/
  server/
    src/
      app.js
      server.js
      config/
      db/
      middlewares/
      shared/
      modules/
        auth/
        users/
        roles/
        products/
        equipment/
        model-required-equipment/
        test-templates/
        production-lots/
        qc-inspections/
        qa-sampling/
        reports/
      tests/
    migrations/
    package.json

  frontend/
    index.html
    src/
      app.js
      styles.css
      httpClient.js
      authApi.js
      reportsApi.js
      exportCsv.js
      formatDate.js

  sprint1_backend.md
  sprint2_backend.md
  sprint3_backend.md
  sprint4_backend.md
  sprint5_backend.md
  sprint6_backend.md
  sprint7_backend.md
  sprint8_backend.md
  sprint9_backend.md
```

---

## Current Features

### Backend Foundation

- Standard API response format
- Central error middleware
- Request ID middleware
- Request start/end logging
- Log sanitization for sensitive values
- PostgreSQL connection pool
- Transaction helper
- Repository/service/controller/route module pattern
- Test database support
- DB hardening migrations

### Auth / RBAC

- `POST /api/auth/login`
- `GET /api/auth/me`
- JWT auth middleware
- RBAC permission middleware
- User management APIs
- Role management APIs
- Role-permission assignment
- User-role assignment

### Master Data

- Product Category
- Product Sub Category
- Product Model
- Equipment Type
- Equipment Master
- Calibration status support
- Model Required Equipment
- Test Templates
- Template Sections
- Template Items

### Production Lot

- Production lot create/list/detail/update
- Serial generation preview
- Serial generation during lot creation
- Lot serial list
- Current lots
- Lot status update
- ECN reference assignment
- Duplicate lot protection
- Duplicate serial rollback protection

### QC Inspection

- QC lot/unit/template lookup
- QC inspection create/detail/update
- QC detail calculation
- Equipment validation
- Submit / Review / Approve / Reject workflow
- Approval logs
- Integration tests for workflow and permission behavior

### QA Sampling

- QA lot/unit/template lookup
- QA sampling create/detail/update
- Sample unit result calculation
- Overall sampling result calculation
- Equipment validation
- Submit / Review / Approve / Reject workflow
- Approval logs
- Integration tests for workflow and permission behavior

### Reports / Dashboard API

- Dashboard summary
- QC summary
- QA summary
- Lot status summary
- Production lot report search
- Serial report search
- QC inspection report search
- QA sampling report search
- Lot detail report
- Serial detail report
- QC inspection detail report
- QA sampling detail report
- QC export-ready JSON
- QA export-ready JSON

### Edit Result / Audit Trail

- QC edit request after approval
- QC apply edit with recalculation
- QC edit history
- QA edit request after approval
- QA apply edit with recalculation
- QA edit history
- Audit log with old/new values and reason
- Report detail includes edit history
- Edited results must be reviewed and approved again

### Frontend

- Static SPA in `frontend/`
- Login bar with token storage
- Dashboard page
- Reports page with tabs and filters
- Pagination
- Detail pages
- QC CSV export
- QA CSV export
- Loading / empty / error states
- 401 and 403 display handling

---

## Environment Variables

Create `server/.env`.

```env
DATABASE_URL=postgres://postgres:<password>@localhost:5432/production_db
DATABASE_URL_TEST=postgres://postgres:<password>@localhost:5432/production_db_test
PORT=3000
NODE_ENV=development

JWT_SECRET=<generate_a_long_random_secret>
JWT_EXPIRES_IN=1d
```

Generate a JWT secret:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Default development login:

```text
username: admin
password: Admin@123
```

Change the default password before production use.

---

## Install Backend

```powershell
cd D:\DevApp\production\PMPS\server
npm install
```

---

## Database Setup

Main database:

```text
production_db
```

Test database:

```text
production_db_test
```

Run migrations on main DB:

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd run migrate:up
```

Run migrations on test DB:

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd run migrate:test:up
```

Check migration history:

```sql
SELECT *
FROM pgmigrations
ORDER BY run_on;
```

---

## Run Backend

Development:

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd run dev
```

Start:

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd start
```

Backend URL:

```text
http://localhost:3000
```

Health check:

```powershell
curl.exe "http://localhost:3000/api/health"
```

---

## Run Frontend

The current frontend is dependency-free static HTML/CSS/JS.

```powershell
cd D:\DevApp\production\PMPS\frontend
python -m http.server 5173
```

Open:

```text
http://localhost:5173/#/dashboard
```

Routes:

```text
/#/dashboard
/#/reports
/#/reports/lots/:lotId
/#/reports/serials/:productUnitId
/#/reports/qc-inspections/:id
/#/reports/qa-samplings/:id
```

Frontend API base URL defaults to:

```text
http://localhost:3000/api
```

To override it in browser console:

```js
localStorage.setItem('pmps_api_base_url', 'http://localhost:3000/api');
```

---

## Test Backend

Run all integration tests:

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd test
```

Latest full test result:

```text
tests 61
suites 7
pass 61
fail 0
```

Test files:

```text
server/src/tests/auth-user-role.test.js
server/src/tests/master-data.test.js
server/src/tests/production-lots.test.js
server/src/tests/qc-inspections.test.js
server/src/tests/qa-sampling.test.js
server/src/tests/reports.test.js
```

---

## Test Frontend

Syntax checks:

```powershell
cd D:\DevApp\production\PMPS
node --check frontend\src\app.js
node --check frontend\src\httpClient.js
node --check frontend\src\reportsApi.js
node --check frontend\src\authApi.js
node --check frontend\src\exportCsv.js
```

Static serve check:

```powershell
cd D:\DevApp\production\PMPS\frontend
python -m http.server 5173
```

Then verify:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:5173/" -UseBasicParsing
Invoke-WebRequest -Uri "http://127.0.0.1:5173/src/app.js" -UseBasicParsing
Invoke-WebRequest -Uri "http://127.0.0.1:5173/src/styles.css" -UseBasicParsing
```

Latest frontend manual result:

```text
Syntax check                 PASS
Static frontend serve         PASS
Backend health                PASS
Login API                     PASS
Dashboard API                 PASS
Reports Lots API              PASS
Reports Serials API           PASS
Reports QC API                PASS
Reports QA API                PASS
Lot detail API                PASS
Serial detail API             PASS
QC detail API                 PASS
QA detail API                 PASS
Export QC JSON                PASS
Export QA JSON                PASS
Empty state API               PASS
401 handling API              PASS
403 handling API              PASS
```

See `sprint8_backend.md` for full manual commands and results.

---

## Main API Groups

### Auth

```text
POST /api/auth/login
GET  /api/auth/me
```

### User / Role

```text
GET   /api/users
POST  /api/users
GET   /api/users/:id
PUT   /api/users/:id
PATCH /api/users/:id/active
POST  /api/users/:id/password
GET   /api/users/:id/roles
PUT   /api/users/:id/roles

GET  /api/roles
POST /api/roles
GET  /api/roles/:id
PUT  /api/roles/:id
GET  /api/roles/:id/permissions
PUT  /api/roles/:id/permissions
```

### Production Lot

```text
GET  /api/production-lots
POST /api/production-lots
GET  /api/production-lots/:id
PUT  /api/production-lots/:id
GET  /api/production-lots/:id/serials
POST /api/production-lots/:id/ecn
POST /api/production-lots/generate-serials
GET  /api/current-lots
```

### QC Inspection

```text
GET  /api/qc/lots
GET  /api/qc/lots/:lotId/units
GET  /api/qc/models/:modelId/templates
GET  /api/qc/templates/:templateId/items
POST /api/qc/inspections
GET  /api/qc/inspections/:id
PUT  /api/qc/inspections/:id
GET  /api/qc/inspections/:id/equipment-check
POST /api/qc/inspections/:id/submit
POST /api/qc/inspections/:id/review
POST /api/qc/inspections/:id/approve
POST /api/qc/inspections/:id/reject
```

### QA Sampling

```text
GET  /api/qa/lots
GET  /api/qa/lots/:lotId/units
GET  /api/qa/models/:modelId/templates
GET  /api/qa/templates/:templateId/items
POST /api/qa/samplings
GET  /api/qa/samplings/:id
PUT  /api/qa/samplings/:id
GET  /api/qa/samplings/:id/equipment-check
POST /api/qa/samplings/:id/submit
POST /api/qa/samplings/:id/review
POST /api/qa/samplings/:id/approve
POST /api/qa/samplings/:id/reject
```

### Dashboard / Reports

```text
GET /api/dashboard/summary
GET /api/dashboard/qc-summary
GET /api/dashboard/qa-summary
GET /api/dashboard/lot-status

GET /api/reports/lots
GET /api/reports/serials
GET /api/reports/qc-inspections
GET /api/reports/qa-samplings

GET /api/reports/lots/:lotId
GET /api/reports/serials/:productUnitId
GET /api/reports/qc-inspections/:id
GET /api/reports/qa-samplings/:id

GET /api/reports/qc-inspections/export
GET /api/reports/qa-samplings/export
```

### Edit Result / Audit Trail

```text
POST /api/qc/inspections/:id/edit-request
POST /api/qc/inspections/:id/apply-edit
GET  /api/qc/inspections/:id/edit-history

POST /api/qa/samplings/:id/edit-request
POST /api/qa/samplings/:id/apply-edit
GET  /api/qa/samplings/:id/edit-history
```

---

## Permission Summary

```text
User / Role APIs              UserRole or ADMIN
Product master APIs           ProductMaster or ADMIN
Equipment APIs                EquipmentMaster or ADMIN
Production Lot APIs           ProductionLot or ADMIN
QC APIs                       QCInspection or ADMIN
QA APIs                       QASampling or ADMIN
Report / Dashboard APIs       SearchReport or ADMIN
Edit result APIs              EditTestResult or ADMIN
Auth login                    Public
Auth me                       Login required
```

---

## Response Standard

Success:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "meta": {
    "request_id": "..."
  }
}
```

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "error_code": "VALIDATION_ERROR",
  "errors": [],
  "meta": {
    "request_id": "..."
  }
}
```

---

## Module Pattern

Backend modules follow this structure:

```text
<module>.routes.js       Endpoint definitions
<module>.controller.js   Request/response handling
<module>.service.js      Business logic
<module>.repository.js   SQL access
<module>.schema.js       zod validation
```

Flow:

```text
routes -> controller -> service -> repository -> PostgreSQL
```

Rules:

```text
- Controllers do not contain SQL.
- Repositories contain SQL/data access.
- Services contain business logic and transaction orchestration.
- Multi-table writes use withTransaction.
- Responses use shared response helpers.
- Errors flow through errorMiddleware.
```

---

## Sprint Documents

```text
sprint1_backend.md  Backend foundation, Auth, RBAC
sprint2_backend.md  User / Role Management
sprint3_backend.md  Product / Equipment / Template master data
sprint4_backend.md  Production Lot / Serial / ECN
sprint5_backend.md  QC Inspection workflow
sprint6_backend.md  QA Sampling workflow
sprint7_backend.md  Report / Search / Dashboard API
sprint8_backend.md  Frontend Dashboard/Search screens
sprint9_backend.md  Edit Result / Audit Trail
```

---

## Security Notes

```text
- Do not commit server/.env.
- Change default admin password before production.
- Use a strong JWT_SECRET.
- Keep debug routes disabled outside development.
- Do not expose stack traces in production responses.
- Do not log password, password_hash, JWT token, API key, or API secret.
- Use HTTPS in production.
```

---

## Recommended Next Steps

```text
1. Convert static frontend to React/Vite if the UI will grow further.
2. Add real Excel/PDF export if business users need file generation server-side.
3. Add frontend E2E tests with Playwright.
4. Add production deployment configuration.
5. Add audit/report export logs if export tracking is required.
```
