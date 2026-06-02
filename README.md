# PMPS Backend — Production Inspection & QA Sampling

Backend application for PMPS production line quality management. This service provides API foundations for Production Lot, QC Inspection, QA Sampling, Equipment Traceability, Approval Workflow, User/Role Permission Control, Reports, and External API Integration.

This repository currently contains the Sprint 1 backend foundation: database hardening, migrations, seed data, API response standard, error handling, request tracing, transaction helper, repository pattern, test database setup, authentication, JWT authorization, and RBAC middleware.

---

## 1. Tech Stack

```text
Runtime      : Node.js
Framework    : Express.js
Database     : PostgreSQL
DB Driver    : pg
Migration    : node-pg-migrate
Validation   : zod
Auth         : JWT
Password Hash: bcrypt
Testing      : vitest + supertest
Environment  : dotenv / dotenv-cli
```

---

## 2. Current Sprint 1 Features

### Database Foundation

- Added required DB constraints and foreign keys.
- Added unique constraints for production lots, QC inspection rounds, QA sampling rounds, and QA sample units.
- Added permission tables:
  - `app_permission`
  - `app_role_permission`
- Added External API client table:
  - `external_api_client`
- Added `updated_at` columns to key master and transaction tables.
- Added status/result check constraints.
- Fixed orphan data in `qa_sample_unit.product_unit_id` before adding FK.

### Migration and Seed

Created migration scripts:

```text
migrations/
  1780039894529_db-hardening-before-backend.js
  1780040826415_seed-default-permissions.js
  1780042092598_seed-admin-user.js
```

Seed data includes:

- `ADMIN` role
- Default permissions
- Role-permission mapping
- Default admin user
- Admin role assignment

Default development login:

```text
username: admin
password: Admin@123
```

> Change the default password before production use.

### Backend Foundation

- Health API
- Central response format
- Central error middleware
- Request ID middleware
- Request start/end logging
- Log sanitization for sensitive values
- PostgreSQL transaction helper
- Repository pattern example with Roles module
- Test database support
- Integration test setup

### Authentication and Authorization

- Login API using username/password
- bcrypt password verification
- JWT access token generation
- Login log write to `user_login_log`
- `GET /api/auth/me`
- JWT auth middleware
- RBAC permission middleware
- Protected Roles API with `UserRole` permission

---

## 3. Project Structure

```text
src/
  app.js
  server.js

  config/
    env.js

  db/
    pool.js
    transaction.js

  middlewares/
    request-id.middleware.js
    error.middleware.js
    auth.middleware.js
    rbac.middleware.js

  shared/
    response.js
    http-error.js
    db-error.mapper.js
    sanitize-log.js

  modules/
    health/
      health.routes.js
      health.controller.js
      health.service.js

    auth/
      auth.routes.js
      auth.controller.js
      auth.service.js
      auth.repository.js
      auth.schema.js

    roles/
      roles.routes.js
      roles.controller.js
      roles.service.js
      roles.repository.js
      roles.schema.js

    debug/
      debug.routes.js
      debug.controller.js
      debug.service.js
      debug.repository.js

  tests/
    test-env.js
    health.test.js
    roles.test.js
```

---

## 4. Environment Variables

Create `.env` in the backend project root.

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgres://postgres:<password>@localhost:5432/production_db
DATABASE_URL_TEST=postgres://postgres:<password>@localhost:5432/production_db_test

JWT_SECRET=<generate_a_long_random_secret>
JWT_EXPIRES_IN=1d
```

Generate a JWT secret:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Do not commit `.env` to Git.

---

## 5. Installation

```powershell
npm install
```

Common dependencies used in Sprint 1:

```powershell
npm install express pg cors helmet dotenv bcrypt jsonwebtoken zod
npm install -D nodemon node-pg-migrate dotenv-cli vitest supertest
```

---

## 6. Database Setup

### Main Database

The main database is:

```text
production_db
```

Run migrations:

```powershell
npm run migrate:up
```

Check migration history:

```sql
SELECT *
FROM pgmigrations
ORDER BY run_on;
```

Expected migrations:

```text
1780039894529_db-hardening-before-backend
1780040826415_seed-default-permissions
1780042092598_seed-admin-user
```

### Test Database

Create test database:

```sql
CREATE DATABASE production_db_test
WITH
    OWNER = postgres
    ENCODING = 'UTF8'
    TEMPLATE = template0;
```

The test database must contain the baseline schema before running the hardening migrations. Import the original schema first, then run:

```powershell
npm run migrate:test:up
```

---

## 7. Available Scripts

Example `package.json` scripts:

```json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "migrate:up": "dotenv -e .env -- node-pg-migrate up",
    "migrate:down": "dotenv -e .env -- node-pg-migrate down",
    "migrate:create": "node-pg-migrate create",
    "migrate:test:up": "dotenv -e .env -- node -e \"process.env.DATABASE_URL=process.env.DATABASE_URL_TEST; require('child_process').execSync('npx node-pg-migrate up', {stdio:'inherit'})\"",
    "migrate:test:down": "dotenv -e .env -- node -e \"process.env.DATABASE_URL=process.env.DATABASE_URL_TEST; require('child_process').execSync('npx node-pg-migrate down', {stdio:'inherit'})\"",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## 8. Run Development Server

```powershell
npm run dev
```

Expected console log:

```text
[APP][START]
```

---

## 9. API Testing

### Health API

```powershell
curl.exe http://localhost:3000/api/health
```

Expected:

```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "app": "running",
    "db": "connected"
  },
  "meta": {
    "request_id": "..."
  }
}
```

### Login

```powershell
$body = @{
  username = "admin"
  password = "Admin@123"
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

$token = $response.data.access_token
```

Expected:

```text
$response.success = true
$response.data.access_token exists
$response.data.user.username = admin
$response.data.user.roles contains ADMIN
```

### Current User

```powershell
curl.exe "http://localhost:3000/api/auth/me" `
  -H "Authorization: Bearer $token"
```

Expected:

```json
{
  "success": true,
  "message": "Current user retrieved successfully",
  "data": {
    "user": {
      "username": "admin",
      "roles": ["ADMIN"]
    }
  }
}
```

### Protected Roles API

```powershell
curl.exe "http://localhost:3000/api/roles" `
  -H "Authorization: Bearer $token"
```

Expected:

```text
success = true
```

Without token:

```powershell
curl.exe "http://localhost:3000/api/roles"
```

Expected:

```text
success = false
error_code = UNAUTHORIZED
```

---

## 10. Response Standard

### Success Response

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

### Error Response

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

## 11. Logging Standard

Every API flow should include `requestId`.

Examples:

```text
[REQUEST][START]
[AUTH][LOGIN][START]
[AUTH][LOGIN][SUCCESS]
[RBAC][ALLOWED]
[REQUEST][END]
```

Do not log sensitive data:

```text
password
password_hash
JWT token
refresh token
X-API-KEY
API secret
```

---

## 12. Repository Pattern

Each module should follow this structure:

```text
<module>.routes.js       Endpoint definitions
<module>.controller.js   Request/response handling
<module>.service.js      Business logic
<module>.repository.js   SQL only
<module>.schema.js       zod validation
```

Flow:

```text
routes -> controller -> service -> repository -> PostgreSQL
```

Rules:

```text
- Do not write SQL in controllers.
- Repositories must contain SQL only.
- Services handle business logic and transactions.
- Multi-table writes must use withTransaction.
- All responses must use response helpers.
- All errors must pass through errorMiddleware.
```

---

## 13. Integration Test

Run tests:

```powershell
npm test
```

Expected:

```text
Health API test passed
Roles API test passed
```

Test database:

```text
production_db_test
```

Integration tests must not use `production_db`.

---

## 14. Sprint 1 Verification Checklist

```text
[ ] npm run migrate:up completed
[ ] pgmigrations contains 3 migrations
[ ] admin user exists and active = true
[ ] admin has ADMIN role
[ ] ADMIN has 13 permissions
[ ] npm run dev starts server
[ ] GET /api/health returns success=true
[ ] POST /api/auth/login returns access_token
[ ] GET /api/auth/me works with Bearer token
[ ] GET /api/roles requires token
[ ] GET /api/roles works with admin token
[ ] npm test passes
```

---

## 15. Next Sprint Recommendation

Recommended Sprint 2 scope:

```text
1. User Management Module
   - GET /api/users
   - POST /api/users
   - PUT /api/users/:id
   - PATCH /api/users/:id/active
   - PUT /api/users/:id/roles

2. Complete Role Management
   - PUT /api/roles/:id
   - GET /api/roles/:id/permissions
   - PUT /api/roles/:id/permissions

3. Product Master Module
   - Product Category
   - Product Sub Category
   - Product Model

4. Equipment Master Module
   - Equipment Type
   - Equipment Master
   - Calibration Status
   - Model Required Equipment
```

Recommended first module for Sprint 2:

```text
User Management Module
```

---

## 16. Security Notes

```text
- Do not commit .env.
- Change default admin password before production.
- Use a strong JWT_SECRET.
- Rotate JWT_SECRET if token leakage is suspected.
- Keep debug routes disabled outside development.
- Do not expose stack traces in production responses.
```
