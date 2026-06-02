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
