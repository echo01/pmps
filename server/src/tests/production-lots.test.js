const assert = require('node:assert/strict');
const { after, before, describe, it } = require('node:test');

require('dotenv').config();

if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

const { app } = require('../app');
const { pool } = require('../db/pool');

let server;
let baseUrl;
let adminToken;
const suffix = Date.now();
const codeSuffix = String(suffix).slice(-8);

const state = {
  categoryId: null,
  subCategoryId: null,
  modelId: null,
  lotId: null,
  ecnId: null,
};

async function request(method, path, { token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json();

  return {
    status: response.status,
    body: json,
  };
}

async function login(username, password) {
  return request('POST', '/api/auth/login', {
    body: {
      username,
      password,
    },
  });
}

function createLotPayload(overrides = {}) {
  return {
    model_id: state.modelId,
    lot_number: `S4-LOT-${codeSuffix}`,
    production_date: '2026-06-02',
    lot_qty: 3,
    remark: 'Sprint 4 integration lot',
    serial_generation: {
      prefix: `S4${codeSuffix}-`,
      start_number: 1,
      count: 3,
      padding: 3,
    },
    ...overrides,
  };
}

describe('Sprint 4 Production Lot integration', () => {
  before(async () => {
    server = app.listen(0);

    await new Promise((resolve) => {
      server.once('listening', resolve);
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await login('admin', 'Admin@123');
    assert.equal(response.status, 200);
    adminToken = response.body.data.access_token;

    const category = await request('POST', '/api/product-categories', {
      token: adminToken,
      body: {
        category_code: `S4C_${codeSuffix}`,
        category_name: 'Sprint4 Controller',
        active: true,
      },
    });
    assert.equal(category.status, 201);
    state.categoryId = category.body.data.id;

    const subCategory = await request('POST', '/api/product-sub-categories', {
      token: adminToken,
      body: {
        category_id: state.categoryId,
        sub_category_code: `S4SC_${codeSuffix}`,
        sub_category_name: 'Sprint4 Control Sub Category',
        active: true,
      },
    });
    assert.equal(subCategory.status, 201);
    state.subCategoryId = subCategory.body.data.id;

    const model = await request('POST', '/api/product-models', {
      token: adminToken,
      body: {
        sub_category_id: state.subCategoryId,
        model_code: `S4M-${codeSuffix}`,
        product_name: 'Sprint4 Model',
        model_name: 'Sprint4 Model Name',
        active: true,
      },
    });
    assert.equal(model.status, 201);
    state.modelId = model.body.data.id;

    const ecn = await pool.query(
      `
        INSERT INTO ecn_master (
          ecn_no, ecn_title, revision, issue_date, effective_date, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `,
      [
        `S4-ECN-${codeSuffix}`,
        'Sprint 4 ECN',
        'A',
        '2026-06-01',
        '2026-06-02',
      ]
    );
    state.ecnId = ecn.rows[0].id;
  });

  after(async () => {
    await pool.query(
      `
        DELETE FROM app_user
        WHERE username LIKE $1
      `,
      [`sprint4_%_${suffix}`]
    );

    await pool.query(
      `
        DELETE FROM app_role
        WHERE role_code LIKE $1
      `,
      [`SPRINT4_%_${suffix}`]
    );

    await pool.query(
      `
        DELETE FROM lot_ecn_ref
        WHERE lot_id IN (
          SELECT id FROM production_lot WHERE lot_number LIKE $1
        )
      `,
      [`S4%${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM ecn_master
        WHERE ecn_no LIKE $1
      `,
      [`S4-ECN-${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM product_unit
        WHERE serial_number LIKE $1
      `,
      [`S4${codeSuffix}-%`]
    );

    await pool.query(
      `
        DELETE FROM production_lot
        WHERE lot_number LIKE $1
      `,
      [`S4%${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM product_model
        WHERE model_code LIKE $1
      `,
      [`S4M-${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM product_sub_category
        WHERE sub_category_code LIKE $1
      `,
      [`S4SC_${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM product_category
        WHERE category_code LIKE $1
      `,
      [`S4C_${codeSuffix}%`]
    );

    await pool.end();

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('generates serial preview', async () => {
    const response = await request('POST', '/api/production-lots/generate-serials', {
      token: adminToken,
      body: {
        prefix: 'S4',
        start_number: 1,
        count: 3,
        padding: 4,
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, ['S40001', 'S40002', 'S40003']);
  });

  it('creates production lot with serials', async () => {
    const response = await request('POST', '/api/production-lots', {
      token: adminToken,
      body: createLotPayload(),
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.lot.lot_number, `S4-LOT-${codeSuffix}`);
    assert.equal(response.body.data.lot.serial_count, 3);
    assert.equal(response.body.data.serials.length, 3);
    state.lotId = response.body.data.lot.id;
  });

  it('links ECN references to production lot and returns them in detail', async () => {
    const linked = await request('POST', `/api/production-lots/${state.lotId}/ecn`, {
      token: adminToken,
      body: {
        ecn_ids: [state.ecnId],
      },
    });

    assert.equal(linked.status, 200);
    assert.equal(linked.body.success, true);
    assert.equal(linked.body.data.length, 1);
    assert.equal(linked.body.data[0].ecn_id, state.ecnId);
    assert.equal(linked.body.data[0].ecn_no, `S4-ECN-${codeSuffix}`);

    const detail = await request('GET', `/api/production-lots/${state.lotId}`, {
      token: adminToken,
    });

    assert.equal(detail.status, 200);
    assert.ok(Array.isArray(detail.body.data.ecn_refs));
    assert.ok(detail.body.data.ecn_refs.some((row) => row.ecn_id === state.ecnId));
  });

  it('lists, retrieves, updates, and reads production lot serials', async () => {
    const list = await request(
      'GET',
      `/api/production-lots?search=${encodeURIComponent(`S4-LOT-${codeSuffix}`)}&page=1&page_size=10`,
      {
        token: adminToken,
      }
    );

    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((row) => row.id === state.lotId));
    assert.equal(list.body.meta.pagination.page, 1);

    const detail = await request('GET', `/api/production-lots/${state.lotId}`, {
      token: adminToken,
    });

    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.serial_count, 3);

    const serials = await request('GET', `/api/production-lots/${state.lotId}/serials`, {
      token: adminToken,
    });

    assert.equal(serials.status, 200);
    assert.equal(serials.body.data.length, 3);
    assert.equal(serials.body.data[0].unit_status, 'CREATED');

    const updated = await request('PUT', `/api/production-lots/${state.lotId}`, {
      token: adminToken,
      body: {
        status: 'HOLD',
        remark: 'Sprint 4 updated lot',
      },
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.status, 'HOLD');
    assert.equal(updated.body.data.remark, 'Sprint 4 updated lot');
  });

  it('increases and decreases lot quantity with serial workflow cleanup', async () => {
    const increased = await request('PUT', `/api/production-lots/${state.lotId}`, {
      token: adminToken,
      body: {
        lot_qty: 5,
        serial_generation: {
          prefix: `S4${codeSuffix}-ADD-`,
          start_number: 1,
          count: 2,
          padding: 3,
        },
      },
    });

    assert.equal(increased.status, 200);
    assert.equal(increased.body.data.lot_qty, 5);
    assert.equal(increased.body.data.serial_count, 5);
    assert.equal(increased.body.data.added_serials.length, 2);

    const reduced = await request('PUT', `/api/production-lots/${state.lotId}`, {
      token: adminToken,
      body: {
        lot_qty: 2,
      },
    });

    assert.equal(reduced.status, 200);
    assert.equal(reduced.body.data.lot_qty, 2);
    assert.equal(reduced.body.data.serial_count, 2);
    assert.equal(reduced.body.data.removed_serials.length, 3);

    const serials = await request('GET', `/api/production-lots/${state.lotId}/serials`, {
      token: adminToken,
    });

    assert.equal(serials.status, 200);
    assert.equal(serials.body.data.length, 2);
  });

  it('rejects duplicate lot number for same model', async () => {
    const response = await request('POST', '/api/production-lots', {
      token: adminToken,
      body: createLotPayload({
        serial_generation: {
          prefix: `S4${codeSuffix}-DUPLOT-`,
          start_number: 1,
          count: 3,
          padding: 3,
        },
      }),
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.error_code, 'CONFLICT');
  });

  it('rejects duplicate serial and does not create the lot', async () => {
    const duplicateLotNumber = `S4-DUPSER-${codeSuffix}`;

    const response = await request('POST', '/api/production-lots', {
      token: adminToken,
      body: createLotPayload({
        lot_number: duplicateLotNumber,
      }),
    });

    assert.equal(response.status, 409);

    const list = await request(
      'GET',
      `/api/production-lots?search=${encodeURIComponent(duplicateLotNumber)}`,
      {
        token: adminToken,
      }
    );

    assert.equal(list.status, 200);
    assert.equal(list.body.data.some((row) => row.lot_number === duplicateLotNumber), false);
  });

  it('returns current lots', async () => {
    const response = await request(
      'GET',
      `/api/current-lots?model_code=${encodeURIComponent(`S4M-${codeSuffix}`)}&lot_number=${encodeURIComponent(`S4-LOT-${codeSuffix}`)}`,
      {
        token: adminToken,
      }
    );

    assert.equal(response.status, 200);
    assert.ok(response.body.data.some((row) => row.id === state.lotId));
  });

  it('deletes production lot with QC, QA, audit, serial, ECN, and planning records', async () => {
    const created = await request('POST', '/api/production-lots', {
      token: adminToken,
      body: createLotPayload({
        lot_number: `S4-DELETE-${codeSuffix}`,
        lot_qty: 1,
        serial_generation: {
          prefix: `S4${codeSuffix}-DELETE-`,
          start_number: 1,
          count: 1,
          padding: 3,
        },
        ecn_ids: [state.ecnId],
      }),
    });

    assert.equal(created.status, 201);
    const deleteLotId = created.body.data.lot.id;
    const unitId = created.body.data.serials[0].id;

    const template = await pool.query(
      `
        INSERT INTO test_template (
          model_id, template_type, template_name, revision, effective_from, active, created_at, updated_at
        )
        VALUES ($1, 'INSPECTION', $2, 'REV.00', '2026-06-01', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `,
      [state.modelId, `S4 Delete Template ${codeSuffix}`]
    );
    assert.ok(template.rows[0]?.id);

    const admin = await pool.query(
      `SELECT id FROM app_user WHERE username = 'admin'`
    );
    const templateId = template.rows[0].id;
    const adminId = admin.rows[0].id;

    const inspection = await pool.query(
      `
        INSERT INTO inspection_header (
          product_unit_id, template_id, inspection_no, status, overall_result, created_at, updated_at
        )
        VALUES ($1, $2, 1, 'DRAFT', 'N/A', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `,
      [unitId, templateId]
    );

    const sampling = await pool.query(
      `
        INSERT INTO qa_sampling_header (
          lot_id, template_id, sampling_round, lot_qty, sample_qty,
          accept_qty, reject_qty, status, overall_result, created_at, updated_at
        )
        VALUES ($1, $2, 1, 1, 1, 0, 0, 'DRAFT', 'N/A', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `,
      [deleteLotId, templateId]
    );

    await pool.query(
      `
        INSERT INTO qa_sample_unit (
          qa_sampling_id, product_unit_id, sample_no, serial_number, unit_result, updated_at
        )
        VALUES ($1, $2, 1, $3, 'N/A', CURRENT_TIMESTAMP)
      `,
      [sampling.rows[0].id, unitId, created.body.data.serials[0].serial_number]
    );

    await pool.query(
      `
        INSERT INTO result_edit_audit_log (
          source_type, source_id, edit_reason, edit_by, approval_status
        )
        VALUES
          ('QC', $1, 'Delete cascade test', $3, 'REQUESTED'),
          ('QA', $2, 'Delete cascade test', $3, 'REQUESTED')
      `,
      [inspection.rows[0].id, sampling.rows[0].id, adminId]
    );

    await pool.query(
      `
        INSERT INTO lot_test_plan (
          lot_id, plan_code, plan_name, planned_start_date, planned_end_date,
          planned_start_datetime, planned_end_datetime,
          plan_status, created_by, updated_by
        )
        VALUES (
          $1, $2, 'Delete cascade plan', '2026-06-02', '2026-06-03',
          '2026-06-02T08:00:00+07:00', '2026-06-03T17:00:00+07:00',
          'PLANNED', $3, $3
        )
      `,
      [deleteLotId, `S4-DEL-PLAN-${codeSuffix}`, adminId]
    );

    const deleted = await request('DELETE', `/api/production-lots/${deleteLotId}`, {
      token: adminToken,
    });

    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.data.id, deleteLotId);

    const remaining = await pool.query(
      `
        SELECT
          (SELECT COUNT(*) FROM production_lot WHERE id = $1)::int AS lots,
          (SELECT COUNT(*) FROM product_unit WHERE lot_id = $1)::int AS units,
          (SELECT COUNT(*) FROM qa_sampling_header WHERE lot_id = $1)::int AS qa,
          (SELECT COUNT(*) FROM lot_test_plan WHERE lot_id = $1)::int AS plans,
          (
            SELECT COUNT(*)
            FROM result_edit_audit_log
            WHERE (source_type = 'QC' AND source_id = $2)
               OR (source_type = 'QA' AND source_id = $3)
          )::int AS audits
      `,
      [deleteLotId, inspection.rows[0].id, sampling.rows[0].id]
    );

    assert.deepEqual(remaining.rows[0], {
      lots: 0,
      units: 0,
      qa: 0,
      plans: 0,
      audits: 0,
    });
  });

  it('GET /api/production-lots without token returns 401', async () => {
    const response = await request('GET', '/api/production-lots');

    assert.equal(response.status, 401);
    assert.equal(response.body.error_code, 'UNAUTHORIZED');
  });

  it('user without ProductionLot permission returns 403', async () => {
    const role = await request('POST', '/api/roles', {
      token: adminToken,
      body: {
        role_code: `SPRINT4_NOPERM_${suffix}`,
        role_name: 'Sprint 4 No Permission Role',
      },
    });
    assert.equal(role.status, 201);

    const user = await request('POST', '/api/users', {
      token: adminToken,
      body: {
        username: `sprint4_noperm_${suffix}`,
        password: 'Admin@123',
        employee_code: `EMP_S4_NOPERM_${suffix}`,
        full_name: 'Sprint 4 No Permission User',
        email: `sprint4_noperm_${suffix}@example.com`,
      },
    });
    assert.equal(user.status, 201);

    const assigned = await request('PUT', `/api/users/${user.body.data.id}/roles`, {
      token: adminToken,
      body: {
        role_ids: [role.body.data.id],
      },
    });
    assert.equal(assigned.status, 200);

    const loggedIn = await login(`sprint4_noperm_${suffix}`, 'Admin@123');
    assert.equal(loggedIn.status, 200);

    const forbidden = await request('GET', '/api/production-lots', {
      token: loggedIn.body.data.access_token,
    });

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error_code, 'FORBIDDEN');
  });
});
