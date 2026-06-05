# Sprint 16 - User Management / Profile / Security Administration

## Goal

เพิ่มหน้าจอและ API สำหรับจัดการ User / Role / Profile ให้ Admin ควบคุมสิทธิ์ได้จากระบบ และให้ผู้ใช้แก้ไขข้อมูลส่วนตัวหรือเปลี่ยนรหัสผ่านของตัวเองได้อย่างปลอดภัย

## Backend Implementation

### Profile API

เพิ่ม module ใหม่ `server/src/modules/profile`

- `GET /api/profile`
  - ใช้ `authMiddleware`
  - คืนข้อมูล user ปัจจุบัน พร้อม `roles` และ `permissions`
- `PUT /api/profile`
  - ใช้ `authMiddleware`
  - แก้ไข `full_name`, `email`
- `POST /api/profile/password`
  - ใช้ `authMiddleware`
  - ตรวจ `current_password`
  - ตรวจ `new_password` และ `confirm_password`
  - ไม่ log password
  - reset `failed_login_count` และ `locked_until` หลังเปลี่ยนรหัสผ่านสำเร็จ

### User Management API Enhancement

ปรับ `server/src/modules/users`

- เพิ่ม `POST /api/users/:id/lock`
- เพิ่ม `POST /api/users/:id/unlock`
- `unlock` reset `failed_login_count = 0` และ `locked_until = NULL`
- ป้องกัน admin lock account ตัวเอง
- ป้องกันการแก้ role ของตัวเองจนไม่เหลือ `ADMIN` หรือ permission `UserRole`
- `PATCH /api/users/:id/active` ยังใช้งานได้เหมือนเดิม แต่มี self-lock guard เพิ่ม

### Role Management API Enhancement

ปรับ `server/src/modules/roles`

- เพิ่ม `GET /api/permissions`
- ใช้ `authMiddleware`
- ใช้ `requirePermission('UserRole')`
- ใช้สำหรับหน้า Role Detail เพื่อเลือก permission ทั้งหมดในระบบ

## Frontend Implementation

เพิ่ม API client

- `frontend/src/api/users.api.ts`
- `frontend/src/api/roles.api.ts`
- `frontend/src/api/profile.api.ts`
- เพิ่ม `httpClient.patch()`

เพิ่มหน้า Admin / Profile

- `/admin/users`
  - search user
  - filter active / locked
  - create user
  - edit user
  - assign roles
  - reset password
  - lock / unlock user
- `/admin/users/:userId`
  - ดูสถานะ user
  - ดู roles
  - ดู permissions ที่ได้จาก role
- `/admin/roles`
  - list role
  - create role
  - edit role name
- `/admin/roles/:roleId`
  - ดู role detail
  - assign permissions
- `/profile`
  - ดู profile ตัวเอง
  - แก้ full name / email
  - ดู roles / permissions ของตัวเอง
- `/profile/password`
  - เปลี่ยนรหัสผ่านตัวเอง

เพิ่ม sidebar menu

- Users
- Roles
- My Profile

## Security Rules

- `/admin/users/*` ต้องมี permission `UserRole`
- `/admin/roles/*` ต้องมี permission `UserRole`
- `/profile/*` ต้อง login เท่านั้น
- Admin ไม่สามารถ lock account ตัวเอง
- User ไม่สามารถถอด role ตัวเองจนเสียสิทธิ์ `ADMIN` หรือ `UserRole`
- Password ไม่ถูกเขียนลง log

## Integration Test

เพิ่มไฟล์

- `server/src/tests/user-management-profile.test.js`

Test cases:

- `GET /api/profile` คืน roles และ permissions array
- `PUT /api/profile` แก้ profile ตัวเองได้
- `POST /api/profile/password` เปลี่ยน password ได้ และ login ด้วย password เก่าไม่ได้
- `GET /api/permissions` คืน permission catalog
- `POST /api/users/:id/lock` lock user ได้
- `POST /api/users/:id/unlock` unlock user และ reset failed count ได้
- ป้องกัน admin lock account ตัวเอง
- ป้องกัน admin ถอด role ตัวเองจนไม่เหลือสิทธิ์จัดการ user/role

## Manual Test Commands

### Step 1 - Login admin

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
$adminId = $response.data.user.id
```

Expected:

- status 200
- ได้ `access_token`

### Step 2 - Get My Profile

```powershell
curl.exe "http://localhost:3000/api/profile" `
  -H "Authorization: Bearer $token"
```

Expected:

- status 200
- มี `username`
- มี `roles`
- มี `permissions`

### Step 3 - Update My Profile

```powershell
$body = @{
  full_name = "PMPS Admin"
  email = "admin@example.com"
} | ConvertTo-Json

curl.exe "http://localhost:3000/api/profile" `
  -X PUT `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d $body
```

Expected:

- status 200
- `full_name` และ `email` เปลี่ยนตาม payload

### Step 4 - List Users

```powershell
curl.exe "http://localhost:3000/api/users?search=admin&active=true" `
  -H "Authorization: Bearer $token"
```

Expected:

- status 200
- ได้รายการ users

### Step 5 - Create User

```powershell
$body = @{
  username = "sprint16_manual"
  password = "Admin@123"
  employee_code = "S16MANUAL"
  full_name = "Sprint 16 Manual User"
  email = "sprint16_manual@example.com"
  active = $true
} | ConvertTo-Json

$createdUser = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/users" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $body

$userId = $createdUser.data.id
```

Expected:

- status 201
- ได้ `userId`

### Step 6 - Lock User

```powershell
curl.exe "http://localhost:3000/api/users/$userId/lock" `
  -X POST `
  -H "Authorization: Bearer $token"
```

Expected:

- status 200
- `active = false`

### Step 7 - Unlock User

```powershell
curl.exe "http://localhost:3000/api/users/$userId/unlock" `
  -X POST `
  -H "Authorization: Bearer $token"
```

Expected:

- status 200
- `active = true`
- `failed_login_count = 0`

### Step 8 - Self Lock Protection

```powershell
curl.exe "http://localhost:3000/api/users/$adminId/lock" `
  -X POST `
  -H "Authorization: Bearer $token"
```

Expected:

- status 409
- message = `Cannot lock your own account`

### Step 9 - List Permissions

```powershell
curl.exe "http://localhost:3000/api/permissions" `
  -H "Authorization: Bearer $token"
```

Expected:

- status 200
- มี permission เช่น `UserRole`, `SearchReport`, `QCInspection`, `QASampling`

### Step 10 - Assign User Roles

```powershell
$roles = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/roles" `
  -Headers @{ Authorization = "Bearer $token" }

$roleId = $roles.data[0].id

$body = @{
  role_ids = @($roleId)
} | ConvertTo-Json

curl.exe "http://localhost:3000/api/users/$userId/roles" `
  -X PUT `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d $body
```

Expected:

- status 200
- user มี role ตามที่เลือก

### Step 11 - Change Own Password

```powershell
$body = @{
  current_password = "Admin@123"
  new_password = "Admin@12345"
  confirm_password = "Admin@12345"
} | ConvertTo-Json

curl.exe "http://localhost:3000/api/profile/password" `
  -X POST `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d $body
```

Expected:

- status 200
- password เปลี่ยนสำเร็จ

หมายเหตุ: หลัง manual test นี้ควรเปลี่ยน password กลับเป็นค่าเดิมทันที ถ้าทดสอบด้วย account จริง

## Automated Test Result

### Frontend Build

Command:

```powershell
cd D:\DevApp\production\PMPS\frontend
npm.cmd run build
```

Result:

- PASS
- TypeScript compile ผ่าน
- Vite production build ผ่าน

### Backend Integration Test

Command:

```powershell
cd D:\DevApp\production\PMPS\server
npm.cmd test -- --runInBand
```

Result:

- PASS
- suites: 9
- tests: 77
- pass: 77
- fail: 0

## Sprint 16 Status

Sprint 16 Core = PASS

- Backend Profile API = implemented
- User lock/unlock API = implemented
- Role permission catalog API = implemented
- Admin User Management UI = implemented
- Admin Role Management UI = implemented
- My Profile UI = implemented
- Change Password UI = implemented
- Integration Test = PASS
- Frontend Build = PASS
