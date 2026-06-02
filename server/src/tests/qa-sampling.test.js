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
  equipmentTypeId: null,
  equipmentId: null,
  templateId: null,
  sectionId: null,
  numericItemId: null,
  booleanItemId: null,
  lotId: null,
  productUnitIds: [],
  qaSamplingId: null,
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

function sampleUnits(overrides = {}) {
  return state.productUnitIds.map((productUnitId) => ({
    product_unit_id: productUnitId,
    items: [
      {
        template_item_id: state.numericItemId,
        measured_value: overrides.failFirstUnit && productUnitId === state.productUnitIds[0] ? 9999 : 230,
      },
      {
        template_item_id: state.booleanItemId,
        measured_text: 'OK',
      },
    ],
  }));
}

function qaPayload(overrides = {}) {
  return {
    lot_id: state.lotId,
    template_id: state.templateId,
    sampling_no: 1,
    sampling_method: 'MANUAL',
    station_name: 'QA-STATION-01',
    equipment_ids: [state.equipmentId],
    sample_units: sampleUnits(),
    remark: 'Sprint 6 QA sampling test',
    ...overrides,
  };
}

describe('Sprint 6 QA Sampling integration', () => {
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
        category_code: `S6C_${codeSuffix}`,
        category_name: 'Sprint6 Controller',
        active: true,
      },
    });
    assert.equal(category.status, 201);
    state.categoryId = category.body.data.id;

    const subCategory = await request('POST', '/api/product-sub-categories', {
      token: adminToken,
      body: {
        category_id: state.categoryId,
        sub_category_code: `S6SC_${codeSuffix}`,
        sub_category_name: 'Sprint6 Control Sub Category',
        active: true,
      },
    });
    assert.equal(subCategory.status, 201);
    state.subCategoryId = subCategory.body.data.id;

    const model = await request('POST', '/api/product-models', {
      token: adminToken,
      body: {
        sub_category_id: state.subCategoryId,
        model_code: `S6M-${codeSuffix}`,
        product_name: 'Sprint6 Model',
        model_name: 'Sprint6 Model Name',
        active: true,
      },
    });
    assert.equal(model.status, 201);
    state.modelId = model.body.data.id;

    const equipmentType = await request('POST', '/api/equipment-types', {
      token: adminToken,
      body: {
        type_code: `S6T_${codeSuffix}`,
        type_name: 'Sprint6 QA Type',
      },
    });
    assert.equal(equipmentType.status, 201);
    state.equipmentTypeId = equipmentType.body.data.id;

    const equipment = await request('POST', '/api/equipment', {
      token: adminToken,
      body: {
        equipment_code: `S6EQ-${codeSuffix}`,
        equipment_name: 'Sprint6 QA Tool',
        equipment_type_id: state.equipmentTypeId,
        calibration_due_date: '2027-01-01',
        status: 'ACTIVE',
      },
    });
    assert.equal(equipment.status, 201);
    state.equipmentId = equipment.body.data.id;

    const required = await request('POST', '/api/model-required-equipment', {
      token: adminToken,
      body: {
        model_id: state.modelId,
        equipment_type_id: state.equipmentTypeId,
        required_qty: 1,
        mandatory: true,
      },
    });
    assert.equal(required.status, 201);

    const template = await request('POST', '/api/test-templates', {
      token: adminToken,
      body: {
        model_id: state.modelId,
        template_type: 'QA',
        template_name: `Sprint6 QA Template ${suffix}`,
        revision: 'A',
        active: true,
      },
    });
    assert.equal(template.status, 201);
    state.templateId = template.body.data.id;

    const section = await request('POST', `/api/test-templates/${state.templateId}/sections`, {
      token: adminToken,
      body: {
        section_name: 'QA Sampling Test',
        seq_no: 1,
      },
    });
    assert.equal(section.status, 201);
    state.sectionId = section.body.data.id;

    const numericItem = await request('POST', `/api/test-templates/${state.templateId}/items`, {
      token: adminToken,
      body: {
        section_id: state.sectionId,
        item_code: 'QA_VOLTAGE',
        item_name: 'QA Voltage Test',
        check_type: 'NUMERIC',
        spec_min: 210,
        spec_max: 240,
        input_unit: 'VAC',
        mandatory: true,
        seq_no: 1,
      },
    });
    assert.equal(numericItem.status, 201);
    state.numericItemId = numericItem.body.data.id;

    const booleanItem = await request('POST', `/api/test-templates/${state.templateId}/items`, {
      token: adminToken,
      body: {
        section_id: state.sectionId,
        item_code: 'QA_LED',
        item_name: 'QA LED',
        check_type: 'BOOLEAN',
        mandatory: true,
        seq_no: 2,
      },
    });
    assert.equal(booleanItem.status, 201);
    state.booleanItemId = booleanItem.body.data.id;

    const lot = await request('POST', '/api/production-lots', {
      token: adminToken,
      body: {
        model_id: state.modelId,
        lot_number: `S6-LOT-${codeSuffix}`,
        production_date: '2026-06-03',
        lot_qty: 3,
        serial_generation: {
          prefix: `S6${codeSuffix}-`,
          start_number: 1,
          count: 3,
          padding: 3,
        },
      },
    });
    assert.equal(lot.status, 201);
    state.lotId = lot.body.data.lot.id;

    const units = await request('GET', `/api/qa/lots/${state.lotId}/units`, {
      token: adminToken,
    });
    assert.equal(units.status, 200);
    assert.equal(units.body.data.length, 3);
    state.productUnitIds = units.body.data.slice(0, 2).map((unit) => unit.id);
  });

  after(async () => {
    await pool.query(
      `
        DELETE FROM approval_log
        WHERE source_type = 'QA'
          AND source_id IN (
            SELECT id FROM qa_sampling_header WHERE template_id = $1
          )
      `,
      [state.templateId]
    );

    await pool.query(
      `
        DELETE FROM qa_sampling_header
        WHERE template_id = $1
      `,
      [state.templateId]
    );

    await pool.query(
      `
        DELETE FROM app_user
        WHERE username LIKE $1
      `,
      [`sprint6_%_${suffix}`]
    );

    await pool.query(
      `
        DELETE FROM app_role
        WHERE role_code LIKE $1
      `,
      [`SPRINT6_%_${suffix}`]
    );

    await pool.query(
      `
        DELETE FROM test_template
        WHERE template_name LIKE $1
      `,
      [`Sprint6%${suffix}%`]
    );

    await pool.query(
      `
        DELETE FROM model_required_equipment
        WHERE model_id = $1
      `,
      [state.modelId]
    );

    await pool.query(
      `
        DELETE FROM product_unit
        WHERE serial_number LIKE $1
      `,
      [`S6${codeSuffix}-%`]
    );

    await pool.query(
      `
        DELETE FROM production_lot
        WHERE lot_number LIKE $1
      `,
      [`S6-LOT-${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM equipment_master
        WHERE equipment_code LIKE $1
      `,
      [`S6EQ-${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM equipment_type_master
        WHERE type_code LIKE $1
      `,
      [`S6T_${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM product_model
        WHERE model_code LIKE $1
      `,
      [`S6M-${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM product_sub_category
        WHERE sub_category_code LIKE $1
      `,
      [`S6SC_${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM product_category
        WHERE category_code LIKE $1
      `,
      [`S6C_${codeSuffix}%`]
    );

    await pool.end();

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('lists QA lots and lot units', async () => {
    const lots = await request('GET', `/api/qa/lots?search=${encodeURIComponent(`S6-LOT-${codeSuffix}`)}`, {
      token: adminToken,
    });

    assert.equal(lots.status, 200);
    assert.ok(lots.body.data.some((row) => row.id === state.lotId));
    assert.equal(lots.body.data.find((row) => row.id === state.lotId).serial_count, 3);

    const units = await request('GET', `/api/qa/lots/${state.lotId}/units`, {
      token: adminToken,
    });

    assert.equal(units.status, 200);
    assert.equal(units.body.data.length, 3);
    assert.ok(units.body.data[0].serial_number);
  });

  it('lists active QA templates and grouped template items', async () => {
    const templates = await request('GET', `/api/qa/models/${state.modelId}/templates`, {
      token: adminToken,
    });

    assert.equal(templates.status, 200);
    assert.ok(templates.body.data.every((row) => row.template_type === 'QA'));
    assert.ok(templates.body.data.every((row) => row.active === true));
    assert.ok(templates.body.data.some((row) => row.id === state.templateId));

    const items = await request('GET', `/api/qa/templates/${state.templateId}/items`, {
      token: adminToken,
    });

    assert.equal(items.status, 200);
    assert.equal(items.body.data.length, 1);
    assert.equal(items.body.data[0].items.length, 2);
  });

  it('creates QA sampling with sample units, details, equipment, and PASS overall result', async () => {
    const response = await request('POST', '/api/qa/samplings', {
      token: adminToken,
      body: qaPayload(),
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.status, 'DRAFT');
    assert.equal(response.body.data.overall_result, 'PASS');
    assert.equal(response.body.data.sample_units.length, 2);
    assert.equal(response.body.data.equipment.length, 1);
    assert.ok(response.body.data.sample_units.every((unit) => unit.unit_result === 'PASS'));
    state.qaSamplingId = response.body.data.id;
  });

  it('duplicate QA sampling returns 409', async () => {
    const response = await request('POST', '/api/qa/samplings', {
      token: adminToken,
      body: qaPayload(),
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.error_code, 'CONFLICT');
  });

  it('retrieves, equipment-checks, and updates draft QA sampling to FAIL', async () => {
    const detail = await request('GET', `/api/qa/samplings/${state.qaSamplingId}`, {
      token: adminToken,
    });

    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.sample_units.length, 2);

    const equipmentCheck = await request('GET', `/api/qa/samplings/${state.qaSamplingId}/equipment-check`, {
      token: adminToken,
    });

    assert.equal(equipmentCheck.status, 200);
    assert.equal(equipmentCheck.body.data.valid, true);

    const updated = await request('PUT', `/api/qa/samplings/${state.qaSamplingId}`, {
      token: adminToken,
      body: {
        station_name: 'QA-STATION-02',
        equipment_ids: [state.equipmentId],
        sample_units: sampleUnits({ failFirstUnit: true }),
        remark: 'Update QA sampling to fail',
      },
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.status, 'DRAFT');
    assert.equal(updated.body.data.overall_result, 'FAIL');
    assert.ok(updated.body.data.sample_units.some((unit) => unit.unit_result === 'FAIL'));
  });

  it('approve before reviewed returns 409, then submit review approve succeed with approval logs', async () => {
    const approveEarly = await request('POST', `/api/qa/samplings/${state.qaSamplingId}/approve`, {
      token: adminToken,
      body: {
        remark: 'Too early',
      },
    });

    assert.equal(approveEarly.status, 409);

    const submitted = await request('POST', `/api/qa/samplings/${state.qaSamplingId}/submit`, {
      token: adminToken,
      body: {
        remark: 'Submit QA sampling',
      },
    });

    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.data.status, 'SUBMITTED');
    assert.ok(submitted.body.data.approval_logs.some((row) => row.action === 'SUBMIT'));

    const reviewed = await request('POST', `/api/qa/samplings/${state.qaSamplingId}/review`, {
      token: adminToken,
      body: {
        remark: 'Review QA sampling',
      },
    });

    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.data.status, 'REVIEWED');
    assert.ok(reviewed.body.data.approval_logs.some((row) => row.action === 'REVIEW'));

    const approved = await request('POST', `/api/qa/samplings/${state.qaSamplingId}/approve`, {
      token: adminToken,
      body: {
        remark: 'Approve QA sampling',
      },
    });

    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.status, 'APPROVED');
    assert.ok(approved.body.data.approved_at);
    assert.ok(approved.body.data.approval_logs.some((row) => row.action === 'APPROVE'));
  });

  it('expired equipment blocks submit', async () => {
    const created = await request('POST', '/api/qa/samplings', {
      token: adminToken,
      body: qaPayload({
        sampling_no: 2,
      }),
    });

    assert.equal(created.status, 201);

    await pool.query(
      `
        UPDATE equipment_master
        SET calibration_due_date = '2024-01-01'
        WHERE id = $1
      `,
      [state.equipmentId]
    );

    const blocked = await request('POST', `/api/qa/samplings/${created.body.data.id}/submit`, {
      token: adminToken,
      body: {
        remark: 'Submit should be blocked',
      },
    });

    assert.equal(blocked.status, 422);
    assert.equal(blocked.body.error_code, 'BUSINESS_VALIDATION_FAILED');

    await pool.query(
      `
        UPDATE equipment_master
        SET calibration_due_date = '2027-01-01'
        WHERE id = $1
      `,
      [state.equipmentId]
    );
  });

  it('reject workflow writes approval log', async () => {
    const created = await request('POST', '/api/qa/samplings', {
      token: adminToken,
      body: qaPayload({
        sampling_no: 3,
      }),
    });

    assert.equal(created.status, 201);

    const submitted = await request('POST', `/api/qa/samplings/${created.body.data.id}/submit`, {
      token: adminToken,
      body: {
        remark: 'Submit for rejection',
      },
    });
    assert.equal(submitted.status, 200);

    const rejected = await request('POST', `/api/qa/samplings/${created.body.data.id}/reject`, {
      token: adminToken,
      body: {
        remark: 'Rejected due to abnormal result',
      },
    });

    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.data.status, 'REJECTED');
    assert.ok(rejected.body.data.approval_logs.some((row) => row.action === 'REJECT'));
  });

  it('GET /api/qa/lots without token returns 401', async () => {
    const response = await request('GET', '/api/qa/lots');

    assert.equal(response.status, 401);
    assert.equal(response.body.error_code, 'UNAUTHORIZED');
  });

  it('user without QASampling permission returns 403', async () => {
    const role = await request('POST', '/api/roles', {
      token: adminToken,
      body: {
        role_code: `SPRINT6_NOPERM_${suffix}`,
        role_name: 'Sprint 6 No Permission Role',
      },
    });
    assert.equal(role.status, 201);

    const user = await request('POST', '/api/users', {
      token: adminToken,
      body: {
        username: `sprint6_noperm_${suffix}`,
        password: 'Admin@123',
        employee_code: `EMP_S6_NOPERM_${suffix}`,
        full_name: 'Sprint 6 No Permission User',
        email: `sprint6_noperm_${suffix}@example.com`,
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

    const loggedIn = await login(`sprint6_noperm_${suffix}`, 'Admin@123');
    assert.equal(loggedIn.status, 200);

    const forbidden = await request('GET', '/api/qa/lots', {
      token: loggedIn.body.data.access_token,
    });

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error_code, 'FORBIDDEN');
  });
});
