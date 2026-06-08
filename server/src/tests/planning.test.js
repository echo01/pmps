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
  planId: null,
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

describe('Sprint 17 Lot Test Planning Dashboard integration', () => {
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
        category_code: `S17C_${codeSuffix}`,
        category_name: 'Sprint17 Controller',
        active: true,
      },
    });
    assert.equal(category.status, 201);
    state.categoryId = category.body.data.id;

    const subCategory = await request('POST', '/api/product-sub-categories', {
      token: adminToken,
      body: {
        category_id: state.categoryId,
        sub_category_code: `S17SC_${codeSuffix}`,
        sub_category_name: 'Sprint17 Planning Sub Category',
        active: true,
      },
    });
    assert.equal(subCategory.status, 201);
    state.subCategoryId = subCategory.body.data.id;

    const model = await request('POST', '/api/product-models', {
      token: adminToken,
      body: {
        sub_category_id: state.subCategoryId,
        model_code: `S17M-${codeSuffix}`,
        product_name: 'Sprint17 Model',
        model_name: 'Sprint17 Model Name',
        active: true,
      },
    });
    assert.equal(model.status, 201);
    state.modelId = model.body.data.id;

    const lot = await request('POST', '/api/production-lots', {
      token: adminToken,
      body: {
        model_id: state.modelId,
        lot_number: `S17-LOT-${codeSuffix}`,
        production_date: '2026-06-05',
        lot_qty: 5,
        serial_generation: {
          prefix: `S17${codeSuffix}-`,
          start_number: 1,
          count: 5,
          padding: 3,
        },
      },
    });
    assert.equal(lot.status, 201);
    state.lotId = lot.body.data.lot.id;
  });

  after(async () => {
    await pool.query(
      `
        DELETE FROM lot_test_plan
        WHERE lot_id IN (
          SELECT id FROM production_lot WHERE lot_number LIKE $1
        )
      `,
      [`S17%${codeSuffix}%`]
    );

    await pool.query('DELETE FROM product_unit WHERE serial_number LIKE $1', [`S17${codeSuffix}-%`]);
    await pool.query('DELETE FROM production_lot WHERE lot_number LIKE $1', [`S17%${codeSuffix}%`]);
    await pool.query('DELETE FROM product_model WHERE model_code LIKE $1', [`S17M-${codeSuffix}%`]);
    await pool.query('DELETE FROM product_sub_category WHERE sub_category_code LIKE $1', [`S17SC_${codeSuffix}%`]);
    await pool.query('DELETE FROM product_category WHERE category_code LIKE $1', [`S17C_${codeSuffix}%`]);

    await pool.end();

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('creates a lot test plan with default waterfall tasks', async () => {
    const response = await request('POST', '/api/planning/plans', {
      token: adminToken,
      body: {
        lot_id: state.lotId,
        plan_name: 'Sprint 17 Planning Test',
        priority: 'HIGH',
        planned_start_date: '2026-06-05',
        planned_end_date: '2026-06-05',
        planned_start_datetime: '2026-06-05T08:00:00.000+07:00',
        planned_end_datetime: '2026-06-05T17:00:00.000+07:00',
        create_default_tasks: true,
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.lot_id, state.lotId);
    assert.equal(response.body.data.priority, 'HIGH');
    assert.equal(response.body.data.planned_start_date, '2026-06-05');
    assert.equal(response.body.data.planned_end_date, '2026-06-05');
    assert.ok(response.body.data.planned_start_datetime);
    assert.ok(response.body.data.planned_end_datetime);
    assert.ok(response.body.data.tasks.length >= 5);
    assert.ok(response.body.data.tasks.some((task) => task.task_type === 'QC_INSPECTION'));
    assert.ok(response.body.data.tasks.some((task) => task.task_type === 'QA_SAMPLING'));
    assert.equal(response.body.data.workflow.qc_status, 'NOT_STARTED');
    assert.equal(response.body.data.workflow.qa_status, 'NOT_STARTED');
    assert.equal(
      response.body.data.tasks.find((task) => task.task_type === 'QC_INSPECTION').derived_status,
      'NOT_STARTED'
    );
    assert.equal(
      response.body.data.tasks.find((task) => task.task_type === 'QA_SAMPLING').derived_status,
      'NOT_STARTED'
    );
    assert.ok(response.body.data.tasks.every((task) => (
      task.task_type === 'CUSTOM'
      || response.body.data.tasks[0].planned_start_datetime.slice(0, 10) === task.planned_start_datetime.slice(0, 10)
    )));
    state.planId = response.body.data.id;
  });

  it('lists planning dashboard summary, waterfall plans, and calendar events', async () => {
    const response = await request(
      'GET',
      `/api/planning/plans?lot_number=S17-LOT-${codeSuffix}&date_from=2026-06-01&date_to=2026-06-30`,
      { token: adminToken }
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.summary.total_plans, 1);
    assert.equal(response.body.data.plans.length, 1);
    assert.ok(response.body.data.calendar_events.length >= 5);
  });

  it('adds a delayed custom task and dashboard delayed summary increases', async () => {
    const added = await request('POST', `/api/planning/plans/${state.planId}/tasks`, {
      token: adminToken,
      body: {
        task_type: 'CUSTOM',
        task_name: 'Past Due Follow Up',
        task_status: 'PLANNED',
        source_type: 'LOT',
        source_id: state.lotId,
        planned_start_datetime: '2026-01-01T08:00:00.000Z',
        planned_end_datetime: '2026-01-01T17:00:00.000Z',
      },
    });

    assert.equal(added.status, 201);

    const dashboard = await request('GET', `/api/planning/plans?lot_number=S17-LOT-${codeSuffix}`, {
      token: adminToken,
    });

    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.data.summary.delayed, 1);
    assert.ok(dashboard.body.data.plans[0].tasks.some((task) => task.derived_status === 'DELAYED'));
  });

  it('rejects duplicate core task types in the same plan', async () => {
    const response = await request('POST', `/api/planning/plans/${state.planId}/tasks`, {
      token: adminToken,
      body: {
        task_type: 'QC_INSPECTION',
        task_name: 'Duplicate QC Inspection',
        task_status: 'PLANNED',
        source_type: 'QC',
        source_id: state.lotId,
        planned_start_datetime: '2026-06-09T08:00:00.000Z',
        planned_end_datetime: '2026-06-09T17:00:00.000Z',
      },
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.error_code, 'CONFLICT');
  });

  it('rejects creating duplicate plan for same lot', async () => {
    const response = await request('POST', '/api/planning/plans', {
      token: adminToken,
      body: {
        lot_id: state.lotId,
        plan_name: 'Duplicate Sprint 17 Planning Test',
        priority: 'NORMAL',
        planned_start_date: '2026-06-05',
        planned_end_date: '2026-06-12',
      },
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.error_code, 'CONFLICT');
  });

  it('GET /api/planning/plans without token returns 401', async () => {
    const response = await request('GET', '/api/planning/plans');

    assert.equal(response.status, 401);
    assert.equal(response.body.error_code, 'UNAUTHORIZED');
  });
});
