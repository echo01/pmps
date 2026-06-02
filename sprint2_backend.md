# Sprint 2 Backend Summary - User / Role Management + RBAC Completion

เอกสารนี้สรุปงาน Sprint 2 สำหรับ Backend PMPS หลังจาก Sprint 1 มี foundation, Auth, JWT, Auth Middleware, RBAC Middleware, Roles Module ตัวอย่าง และ test database พร้อมใช้งานแล้ว

---

## 1. Sprint 2 Objective

เป้าหมายหลักคือทำ User / Role Management ให้พร้อมใช้เป็นฐานของระบบ permission ทั้งหมดก่อนเริ่ม module ฝั่ง Product, Equipment, QC และ QA

สิ่งที่ทำใน Sprint 2:

```text
1. เพิ่ม User Management Module
2. เพิ่ม User Role Assignment API พร้อม transaction
3. ขยาย Roles Module ให้ update role ได้
4. เพิ่ม Role Permission Mapping API พร้อม transaction
5. เพิ่ม Integration Test สำหรับ Auth / User / Role / RBAC
```

---

## 2. Files Added / Updated

### Added

```text
server/src/modules/users/users.routes.js
server/src/modules/users/users.controller.js
server/src/modules/users/users.service.js
server/src/modules/users/users.repository.js
server/src/modules/users/users.schema.js
server/src/tests/auth-user-role.test.js
```

### Updated

```text
server/src/app.js
server/src/modules/roles/roles.routes.js
server/src/modules/roles/roles.controller.js
server/src/modules/roles/roles.service.js
server/src/modules/roles/roles.repository.js
server/src/modules/roles/roles.schema.js
server/package.json
```

---

## 3. User Management API

All `/api/users/*` routes use:

```js
authMiddleware
requirePermission('UserRole')
```

ADMIN can access because `requirePermission` allows ADMIN role bypass.

Implemented endpoints:

```http
GET    /api/users?search=&active=
POST   /api/users
GET    /api/users/:id
PUT    /api/users/:id
PATCH  /api/users/:id/active
POST   /api/users/:id/password
GET    /api/users/:id/roles
PUT    /api/users/:id/roles
```

Important behavior:

```text
- password is hashed with bcrypt before saving
- password_hash is never returned from API
- duplicate username returns 409
- duplicate employee_code returns 409
- PUT /api/users/:id/roles replaces all roles in one transaction
- invalid role_ids returns VALIDATION_ERROR
```

---

## 4. Roles / Permissions API

All `/api/roles/*` routes use:

```js
authMiddleware
requirePermission('UserRole')
```

Existing endpoints kept:

```http
GET  /api/roles
GET  /api/roles/:id
POST /api/roles
```

Added endpoints:

```http
PUT /api/roles/:id
GET /api/roles/:id/permissions
PUT /api/roles/:id/permissions
```

Important behavior:

```text
- PUT /api/roles/:id updates role_name
- GET /api/roles/:id/permissions returns mapped permissions
- PUT /api/roles/:id/permissions replaces all permissions in one transaction
- invalid permission_ids returns VALIDATION_ERROR
```

---

## 5. Transaction Usage

Transaction helper used:

```js
withTransaction(callback, { requestId, name })
```

Sprint 2 transaction APIs:

```text
PUT /api/users/:id/roles
  - validate user
  - validate all role_ids
  - delete current app_user_role rows
  - insert new app_user_role rows

PUT /api/roles/:id/permissions
  - validate role
  - validate all permission_ids
  - delete current app_role_permission rows
  - insert new app_role_permission rows
```

---

## 6. Integration Tests

Added built-in Node.js integration test runner, so no new external test dependency is required.

Run:

```powershell
cd server
npm.cmd test
```

Test file:

```text
server/src/tests/auth-user-role.test.js
```

Covered cases:

```text
- login success
- login wrong password
- get current user /api/auth/me
- GET /api/users with admin token
- GET /api/users without token -> 401
- POST /api/users duplicate username -> 409
- PUT /api/users/:id/roles success
- user without permission enters role API -> 403
```

Latest verification:

```text
tests 8
pass 8
fail 0
```

---

## 7. API Permission Rule

```text
/api/users/*   UserRole or ADMIN
/api/roles/*   UserRole or ADMIN
/api/auth/me   login required
/api/auth/login public
```

This matches the Sprint 1 rule: important routes must use `authMiddleware`; restricted routes must use `requirePermission`.

---

## 8. Next Recommended Sprint

After Sprint 2, the backend now has enough User / Role / Permission foundation to continue with master data.

Recommended next order:

```text
1. Product Master Module
2. Equipment Master Module
3. Model Required Equipment
4. Test Template
5. Production Lot / Serial
```
