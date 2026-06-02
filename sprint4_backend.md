# Sprint 4 Backend: Production Lot + Serial Management

## Scope

Sprint 4 adds Production Lot APIs for creating lots, generating serial numbers, tracking product units, and exposing current production lots. The module follows the same controller/service/repository/schema split used by Sprint 2 and Sprint 3.

## Added Module

- `server/src/modules/production-lots/production-lots.routes.js`
- `server/src/modules/production-lots/production-lots.controller.js`
- `server/src/modules/production-lots/production-lots.service.js`
- `server/src/modules/production-lots/production-lots.repository.js`
- `server/src/modules/production-lots/production-lots.schema.js`
- `server/src/modules/production-lots/serial-generator.js`

## Migration

- `server/migrations/1780416000000_sprint4-production-lot-status.js`

This migration adds `production_lot.status` with allowed values:

- `OPEN`
- `CLOSED`
- `HOLD`
- `CANCELLED`

## APIs

All Sprint 4 APIs require:

- `authMiddleware`
- `requirePermission('ProductionLot')`

Implemented endpoints:

- `GET /api/production-lots?search=&model_code=&date_from=&date_to=&status=&page=&page_size=`
- `POST /api/production-lots`
- `GET /api/production-lots/:id`
- `PUT /api/production-lots/:id`
- `GET /api/production-lots/:id/serials`
- `POST /api/production-lots/generate-serials`
- `POST /api/production-lots/:id/ecn`
- `GET /api/current-lots?model_code=&lot_number=&production_date=`

## Serial Generation

Request:

```json
{
  "prefix": "SN",
  "start_number": 1,
  "count": 3,
  "padding": 5
}
```

Response data:

```json
["SN00001", "SN00002", "SN00003"]
```

Validation rules:

- `start_number` must be integer `>= 0`
- `count` must be `1..5000`
- `padding` must be `0..20`
- `prefix` max length is 50
- generated serials must be unique

## Create Lot Behavior

`POST /api/production-lots` uses `withTransaction` for lot creation, serial insertion, and ECN mapping.

Validation includes:

- product model must exist
- `lot_number` must not duplicate within the same model
- generated serial count must equal `lot_qty`
- generated payload serials must be unique
- serial numbers must not already exist for the same model
- provided `ecn_ids` must exist

Rollback behavior is covered by the duplicate serial integration test.

## Update Lot Rules

`PUT /api/production-lots/:id` allows only:

- `production_date`
- `remark`
- `status`

The API does not allow changing:

- `model_id`
- `lot_number`
- `lot_qty`

## Integration Tests

Added `server/src/tests/production-lots.test.js` covering:

- login setup
- product master setup
- serial preview generation
- create production lot with serials
- list lots
- lot detail
- lot serials
- update lot status and remark
- duplicate lot conflict
- duplicate serial conflict and rollback
- ECN reference assignment via `POST /api/production-lots/:id/ecn`
- current lots
- no token returns 401
- user without `ProductionLot` permission returns 403

## Next Sprint Suggestion

Sprint 5 should continue with QC Inspection Transaction because Production Lot and Product Unit data are now available as the transaction foundation.
