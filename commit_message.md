# Commit Summary

```text
feat(backend): add Sprint 1 backend foundation with auth and RBAC
```

# Commit Description

```text
Implemented Sprint 1 backend foundation for the PMPS Production Inspection & QA Sampling system.

Changes included:
- Added PostgreSQL hardening migration for required constraints, foreign keys, check constraints, permission tables, external API client table, and updated_at columns.
- Added seed migrations for default permissions, role-permission mappings, and admin user.
- Added Express backend foundation with environment config, PostgreSQL pool, Health API, central response helper, HTTP error helper, database error mapper, and request ID middleware.
- Added standardized error middleware for JSON parse errors, HTTP errors, database errors, and unexpected errors.
- Added request logging with requestId, durationMs, and sensitive log sanitization.
- Added withTransaction helper for safe multi-table database operations.
- Added Roles module as repository pattern reference with routes, controller, service, repository, and zod schema validation.
- Added test database support and integration test setup with vitest and supertest.
- Added Auth Login module with bcrypt password validation, JWT token generation, user roles/permissions response, and login log writing.
- Added Auth Middleware and RBAC Middleware for Bearer token verification and permission-based route protection.
- Protected Roles API with UserRole permission.

Verification:
- Database migrations completed successfully.
- Admin user seeded and mapped to ADMIN role.
- ADMIN role has 13 permissions.
- GET /api/health returns service and DB status.
- POST /api/auth/login returns JWT access token.
- GET /api/auth/me works with Bearer token.
- Protected /api/roles requires valid token and permission.
```

# Alternative Short Commit Message

```text
feat: initialize PMPS backend foundation, auth, RBAC, and migrations
```

# Suggested PR / GitHub Description

```md
## Summary

This PR adds the Sprint 1 backend foundation for the PMPS Production Inspection & QA Sampling application.

## Included

- Database hardening migration
- Permission and admin seed migrations
- Health API
- Central response and error handling
- Request ID middleware and request logging
- Transaction helper
- Repository pattern example using Roles module
- Test database and integration test setup
- Auth login with bcrypt and JWT
- Auth middleware and RBAC middleware
- Protected Roles API

## Testing

Tested manually with:

- `npm run migrate:up`
- `npm run migrate:test:up`
- `npm run dev`
- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/roles` with and without Bearer token
- `npm test`

## Notes

- `.env` must not be committed.
- Default admin password is for development only and must be changed before production.
- Debug routes must remain development-only.
```
