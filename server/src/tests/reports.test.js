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
  qcTemplateId: null,
  qcSectionId: null,
  qcNumericItemId: null,
  qcBooleanItemId: null,
  qaTemplateId: null,
  qaSectionId: null,
  qaNumericItemId: null,
  qaBooleanItemId: null,
  lotId: null,
  planId: null,
  productUnitIds: [],
  qcInspectionId: null,
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

function qcPayload(overrides = {}) {
  return {
    product_unit_id: state.productUnitIds[0],
    template_id: state.qcTemplateId,
    inspection_no: 1,
    station_name: 'S7-QC-STATION',
    equipment_ids: [state.equipmentId],
    items: [
      {
        template_item_id: state.qcNumericItemId,
        measured_value: 230,
      },
      {
        template_item_id: state.qcBooleanItemId,
        measured_text: 'OK',
      },
    ],
    remark: 'Sprint 7 QC report fixture',
    ...overrides,
  };
}

function qaSampleUnits() {
  return state.productUnitIds.slice(0, 2).map((productUnitId) => ({
    product_unit_id: productUnitId,
    items: [
      {
        template_item_id: state.qaNumericItemId,
        measured_value: 230,
      },
      {
        template_item_id: state.qaBooleanItemId,
        measured_text: 'OK',
      },
    ],
  }));
}

function qaPayload(overrides = {}) {
  return {
    lot_id: state.lotId,
    template_id: state.qaTemplateId,
    sampling_no: 1,
    sampling_method: 'MANUAL',
    station_name: 'S7-QA-STATION',
    equipment_ids: [state.equipmentId],
    sample_units: qaSampleUnits(),
    remark: 'Sprint 7 QA report fixture',
    ...overrides,
  };
}

async function approveQcInspection(id) {
  const submitted = await request('POST', `/api/qc/inspections/${id}/submit`, {
    token: adminToken,
    body: {
      remark: 'S7 submit QC',
    },
  });
  assert.equal(submitted.status, 200);

  const reviewed = await request('POST', `/api/qc/inspections/${id}/review`, {
    token: adminToken,
    body: {
      remark: 'S7 review QC',
    },
  });
  assert.equal(reviewed.status, 200);

  const approved = await request('POST', `/api/qc/inspections/${id}/approve`, {
    token: adminToken,
    body: {
      remark: 'S7 approve QC',
    },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.status, 'APPROVED');
}

async function approveQaSampling(id) {
  const submitted = await request('POST', `/api/qa/samplings/${id}/submit`, {
    token: adminToken,
    body: {
      remark: 'S7 submit QA',
    },
  });
  assert.equal(submitted.status, 200);

  const reviewed = await request('POST', `/api/qa/samplings/${id}/review`, {
    token: adminToken,
    body: {
      remark: 'S7 review QA',
    },
  });
  assert.equal(reviewed.status, 200);

  const approved = await request('POST', `/api/qa/samplings/${id}/approve`, {
    token: adminToken,
    body: {
      remark: 'S7 approve QA',
    },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.status, 'APPROVED');
}

describe('Sprint 7 Report / Search / Dashboard integration', () => {
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
        category_code: `S7C_${codeSuffix}`,
        category_name: 'Sprint7 Controller',
        active: true,
      },
    });
    assert.equal(category.status, 201);
    state.categoryId = category.body.data.id;

    const subCategory = await request('POST', '/api/product-sub-categories', {
      token: adminToken,
      body: {
        category_id: state.categoryId,
        sub_category_code: `S7SC_${codeSuffix}`,
        sub_category_name: 'Sprint7 Control Sub Category',
        active: true,
      },
    });
    assert.equal(subCategory.status, 201);
    state.subCategoryId = subCategory.body.data.id;

    const model = await request('POST', '/api/product-models', {
      token: adminToken,
      body: {
        sub_category_id: state.subCategoryId,
        model_code: `S7M-${codeSuffix}`,
        product_name: 'Sprint7 Model',
        model_name: 'Sprint7 Model Name',
        active: true,
      },
    });
    assert.equal(model.status, 201);
    state.modelId = model.body.data.id;

    const equipmentType = await request('POST', '/api/equipment-types', {
      token: adminToken,
      body: {
        type_code: `S7T_${codeSuffix}`,
        type_name: 'Sprint7 Report Tool Type',
      },
    });
    assert.equal(equipmentType.status, 201);
    state.equipmentTypeId = equipmentType.body.data.id;

    const equipment = await request('POST', '/api/equipment', {
      token: adminToken,
      body: {
        equipment_code: `S7EQ-${codeSuffix}`,
        equipment_name: 'Sprint7 Report Tool',
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

    const qcTemplate = await request('POST', '/api/test-templates', {
      token: adminToken,
      body: {
        model_id: state.modelId,
        template_type: 'INSPECTION',
        template_name: `Sprint7 QC Template ${suffix}`,
        revision: 'A',
        active: true,
      },
    });
    assert.equal(qcTemplate.status, 201);
    state.qcTemplateId = qcTemplate.body.data.id;

    const qcSection = await request('POST', `/api/test-templates/${state.qcTemplateId}/sections`, {
      token: adminToken,
      body: {
        section_name: 'Sprint7 QC Section',
        seq_no: 1,
      },
    });
    assert.equal(qcSection.status, 201);
    state.qcSectionId = qcSection.body.data.id;

    const qcNumericItem = await request('POST', `/api/test-templates/${state.qcTemplateId}/items`, {
      token: adminToken,
      body: {
        section_id: state.qcSectionId,
        item_code: 'S7_QC_VOLTAGE',
        item_name: 'Sprint7 QC Voltage',
        check_type: 'NUMERIC',
        spec_min: 210,
        spec_max: 240,
        input_unit: 'VAC',
        mandatory: true,
        seq_no: 1,
      },
    });
    assert.equal(qcNumericItem.status, 201);
    state.qcNumericItemId = qcNumericItem.body.data.id;

    const qcBooleanItem = await request('POST', `/api/test-templates/${state.qcTemplateId}/items`, {
      token: adminToken,
      body: {
        section_id: state.qcSectionId,
        item_code: 'S7_QC_LED',
        item_name: 'Sprint7 QC LED',
        check_type: 'BOOLEAN',
        mandatory: true,
        seq_no: 2,
      },
    });
    assert.equal(qcBooleanItem.status, 201);
    state.qcBooleanItemId = qcBooleanItem.body.data.id;

    const qaTemplate = await request('POST', '/api/test-templates', {
      token: adminToken,
      body: {
        model_id: state.modelId,
        template_type: 'QA',
        template_name: `Sprint7 QA Template ${suffix}`,
        revision: 'A',
        active: true,
      },
    });
    assert.equal(qaTemplate.status, 201);
    state.qaTemplateId = qaTemplate.body.data.id;

    const qaSection = await request('POST', `/api/test-templates/${state.qaTemplateId}/sections`, {
      token: adminToken,
      body: {
        section_name: 'Sprint7 QA Section',
        seq_no: 1,
      },
    });
    assert.equal(qaSection.status, 201);
    state.qaSectionId = qaSection.body.data.id;

    const qaNumericItem = await request('POST', `/api/test-templates/${state.qaTemplateId}/items`, {
      token: adminToken,
      body: {
        section_id: state.qaSectionId,
        item_code: 'S7_QA_VOLTAGE',
        item_name: 'Sprint7 QA Voltage',
        check_type: 'NUMERIC',
        spec_min: 210,
        spec_max: 240,
        input_unit: 'VAC',
        mandatory: true,
        seq_no: 1,
      },
    });
    assert.equal(qaNumericItem.status, 201);
    state.qaNumericItemId = qaNumericItem.body.data.id;

    const qaBooleanItem = await request('POST', `/api/test-templates/${state.qaTemplateId}/items`, {
      token: adminToken,
      body: {
        section_id: state.qaSectionId,
        item_code: 'S7_QA_LED',
        item_name: 'Sprint7 QA LED',
        check_type: 'BOOLEAN',
        mandatory: true,
        seq_no: 2,
      },
    });
    assert.equal(qaBooleanItem.status, 201);
    state.qaBooleanItemId = qaBooleanItem.body.data.id;

    const lot = await request('POST', '/api/production-lots', {
      token: adminToken,
      body: {
        model_id: state.modelId,
        lot_number: `S7-LOT-${codeSuffix}`,
        production_date: '2026-06-03',
        lot_qty: 3,
        serial_generation: {
          prefix: `S7${codeSuffix}-`,
          start_number: 1,
          count: 3,
          padding: 3,
        },
      },
    });
    assert.equal(lot.status, 201);
    state.lotId = lot.body.data.lot.id;

    const plan = await request('POST', '/api/planning/plans', {
      token: adminToken,
      body: {
        lot_id: state.lotId,
        plan_name: 'Sprint 7 Report Readiness Plan',
        priority: 'NORMAL',
        planned_start_date: '2026-06-03',
        planned_end_date: '2026-06-12',
        create_default_tasks: true,
      },
    });
    assert.equal(plan.status, 201);
    state.planId = plan.body.data.id;

    const units = await request('GET', `/api/qc/lots/${state.lotId}/units`, {
      token: adminToken,
    });
    assert.equal(units.status, 200);
    state.productUnitIds = units.body.data.map((unit) => unit.id);

    const qcInspection = await request('POST', '/api/qc/inspections', {
      token: adminToken,
      body: qcPayload(),
    });
    assert.equal(qcInspection.status, 201);
    state.qcInspectionId = qcInspection.body.data.id;
    await approveQcInspection(state.qcInspectionId);

    const qaSampling = await request('POST', '/api/qa/samplings', {
      token: adminToken,
      body: qaPayload(),
    });
    assert.equal(qaSampling.status, 201);
    state.qaSamplingId = qaSampling.body.data.id;
    await approveQaSampling(state.qaSamplingId);
  });

  after(async () => {
    await pool.query(
      `
        DELETE FROM approval_log
        WHERE (
          source_type = 'QC'
          AND source_id IN (SELECT id FROM inspection_header WHERE template_id = $1)
        )
        OR (
          source_type = 'QA'
          AND source_id IN (SELECT id FROM qa_sampling_header WHERE template_id = $2)
        )
      `,
      [state.qcTemplateId, state.qaTemplateId]
    );

    await pool.query('DELETE FROM qa_sampling_header WHERE template_id = $1', [state.qaTemplateId]);
    await pool.query('DELETE FROM inspection_header WHERE template_id = $1', [state.qcTemplateId]);

    await pool.query('DELETE FROM app_user WHERE username LIKE $1', [`sprint7_%_${suffix}`]);
    await pool.query('DELETE FROM app_role WHERE role_code LIKE $1', [`SPRINT7_%_${suffix}`]);
    await pool.query('DELETE FROM test_template WHERE template_name LIKE $1', [`Sprint7%${suffix}%`]);
    await pool.query('DELETE FROM model_required_equipment WHERE model_id = $1', [state.modelId]);
    await pool.query('DELETE FROM product_unit WHERE serial_number LIKE $1', [`S7${codeSuffix}-%`]);
    await pool.query('DELETE FROM production_lot WHERE lot_number LIKE $1', [`S7-LOT-${codeSuffix}%`]);
    await pool.query('DELETE FROM equipment_master WHERE equipment_code LIKE $1', [`S7EQ-${codeSuffix}%`]);
    await pool.query('DELETE FROM equipment_type_master WHERE type_code LIKE $1', [`S7T_${codeSuffix}%`]);
    await pool.query('DELETE FROM product_model WHERE model_code LIKE $1', [`S7M-${codeSuffix}%`]);
    await pool.query('DELETE FROM product_sub_category WHERE sub_category_code LIKE $1', [`S7SC_${codeSuffix}%`]);
    await pool.query('DELETE FROM product_category WHERE category_code LIKE $1', [`S7C_${codeSuffix}%`]);

    await pool.end();

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('GET /api/dashboard/summary returns production, QC, and QA totals', async () => {
    const response = await request('GET', '/api/dashboard/summary', {
      token: adminToken,
    });

    assert.equal(response.status, 200);
    assert.ok(response.body.data.production.total_lots >= 1);
    assert.ok(response.body.data.qc.total_inspections >= 1);
    assert.ok(response.body.data.qa.total_samplings >= 1);
  });

  it('GET /api/dashboard/qc-summary returns grouped chart data', async () => {
    const response = await request(
      'GET',
      '/api/dashboard/qc-summary?date_from=2026-06-01&date_to=2026-12-31',
      { token: adminToken }
    );

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.data.by_status));
    assert.ok(Array.isArray(response.body.data.by_result));
    assert.ok(Array.isArray(response.body.data.by_model));
    assert.ok(response.body.data.by_model.some((row) => row.model_code === `S7M-${codeSuffix}`));
  });

  it('GET /api/dashboard/qa-summary returns grouped chart data', async () => {
    const response = await request(
      'GET',
      '/api/dashboard/qa-summary?date_from=2026-06-01&date_to=2026-12-31',
      { token: adminToken }
    );

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.data.by_status));
    assert.ok(Array.isArray(response.body.data.by_result));
    assert.ok(Array.isArray(response.body.data.by_model));
    assert.ok(response.body.data.by_model.some((row) => row.model_code === `S7M-${codeSuffix}`));
  });

  it('GET /api/dashboard/lot-status returns lot status counts', async () => {
    const response = await request('GET', '/api/dashboard/lot-status', {
      token: adminToken,
    });

    assert.equal(response.status, 200);
    assert.ok(response.body.data.some((row) => row.status === 'OPEN'));
  });

  it('GET /api/reports/lots searches lots with pagination', async () => {
    const response = await request(
      'GET',
      `/api/reports/lots?search=${encodeURIComponent(`S7-LOT-${codeSuffix}`)}&page=1&page_size=20`,
      { token: adminToken }
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.meta.pagination.page, 1);
    assert.equal(response.body.meta.pagination.page_size, 20);
    assert.ok(response.body.data.some((row) => row.lot_id === state.lotId));
    const lot = response.body.data.find((row) => row.lot_id === state.lotId);
    assert.equal(lot.serial_count, 3);
    assert.equal(lot.qa_sampling_count, 2);
  });

  it('GET /api/reports/serials searches serials with latest QC and QA result', async () => {
    const response = await request(
      'GET',
      `/api/reports/serials?serial_number=${encodeURIComponent(`S7${codeSuffix}`)}&page=1&page_size=20`,
      { token: adminToken }
    );

    assert.equal(response.status, 200);
    assert.ok(response.body.data.some((row) => row.product_unit_id === state.productUnitIds[0]));
    const firstUnit = response.body.data.find((row) => row.product_unit_id === state.productUnitIds[0]);
    assert.equal(firstUnit.latest_qc_result, 'PASS');
    assert.equal(firstUnit.latest_qa_result, 'PASS');
  });

  it('GET /api/reports/qc-inspections searches QC reports', async () => {
    const response = await request(
      'GET',
      `/api/reports/qc-inspections?status=APPROVED&result=PASS&model_code=${encodeURIComponent(`S7M-${codeSuffix}`)}&page=1&page_size=20`,
      { token: adminToken }
    );

    assert.equal(response.status, 200);
    assert.ok(response.body.data.some((row) => row.inspection_id === state.qcInspectionId));
    assert.equal(response.body.data.find((row) => row.inspection_id === state.qcInspectionId).status, 'APPROVED');
  });

  it('GET /api/reports/qa-samplings searches QA reports', async () => {
    const response = await request(
      'GET',
      `/api/reports/qa-samplings?status=APPROVED&result=PASS&model_code=${encodeURIComponent(`S7M-${codeSuffix}`)}&page=1&page_size=20`,
      { token: adminToken }
    );

    assert.equal(response.status, 200);
    assert.ok(response.body.data.some((row) => row.qa_sampling_id === state.qaSamplingId));
    assert.equal(response.body.data.find((row) => row.qa_sampling_id === state.qaSamplingId).sample_qty, 2);
  });

  it('GET /api/reports/lots/:lotId returns lot detail report', async () => {
    const response = await request('GET', `/api/reports/lots/${state.lotId}`, {
      token: adminToken,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.lot.lot_id, state.lotId);
    assert.equal(response.body.data.serials.length, 3);
    assert.ok(response.body.data.qc_summary.pass >= 1);
    assert.equal(response.body.data.qa_summary.total, 2);
    assert.equal(response.body.data.qa_summary.pass, 2);
    assert.equal(response.body.data.qa_summary.approved, 2);
  });

  it('GET /api/reports/serials/:productUnitId returns serial detail report', async () => {
    const response = await request('GET', `/api/reports/serials/${state.productUnitIds[0]}`, {
      token: adminToken,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.product_unit_id, state.productUnitIds[0]);
    assert.ok(response.body.data.serial_number);
    assert.ok(response.body.data.qc_inspections.some((row) => row.inspection_id === state.qcInspectionId));
    assert.ok(response.body.data.qa_samplings.some((row) => row.qa_sampling_id === state.qaSamplingId));
  });

  it('GET /api/reports/qc-inspections/:id returns QC detail report', async () => {
    const response = await request('GET', `/api/reports/qc-inspections/${state.qcInspectionId}`, {
      token: adminToken,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.inspection_id, state.qcInspectionId);
    assert.equal(response.body.data.details.length, 2);
    assert.equal(response.body.data.equipment.length, 1);
    assert.ok(response.body.data.approval_logs.some((row) => row.action === 'APPROVE'));
  });

  it('GET /api/reports/qa-samplings/:id returns QA detail report', async () => {
    const response = await request('GET', `/api/reports/qa-samplings/${state.qaSamplingId}`, {
      token: adminToken,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.qa_sampling_id, state.qaSamplingId);
    assert.equal(response.body.data.sample_units.length, 2);
    assert.equal(response.body.data.equipment.length, 1);
    assert.ok(response.body.data.approval_logs.some((row) => row.action === 'APPROVE'));
  });

  it('GET /api/reports/qc-inspections/export returns flat QC rows', async () => {
    const response = await request(
      'GET',
      `/api/reports/qc-inspections/export?model_code=${encodeURIComponent(`S7M-${codeSuffix}`)}&date_from=2026-06-01&date_to=2026-12-31`,
      { token: adminToken }
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 2);
    assert.ok(response.body.data.every((row) => row.lot_number === `S7-LOT-${codeSuffix}`));
    assert.ok(response.body.data.every((row) => row.item_code));
  });

  it('GET /api/reports/qa-samplings/export returns flat QA rows', async () => {
    const response = await request(
      'GET',
      `/api/reports/qa-samplings/export?model_code=${encodeURIComponent(`S7M-${codeSuffix}`)}&date_from=2026-06-01&date_to=2026-12-31`,
      { token: adminToken }
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 4);
    assert.ok(response.body.data.every((row) => row.lot_number === `S7-LOT-${codeSuffix}`));
    assert.ok(response.body.data.every((row) => row.serial_number));
  });

  it('completes Report Ready, plan, and production lot when QC and QA workflows are approved', async () => {
    for (let index = 1; index < state.productUnitIds.length; index += 1) {
      const inspection = await request('POST', '/api/qc/inspections', {
        token: adminToken,
        body: qcPayload({
          product_unit_id: state.productUnitIds[index],
          inspection_no: index + 1,
        }),
      });
      assert.equal(inspection.status, 201);
      await approveQcInspection(inspection.body.data.id);
    }

    const listResponse = await request(
      'GET',
      `/api/reports/lots?search=${encodeURIComponent(`S7-LOT-${codeSuffix}`)}&status=READY&page=1&page_size=20`,
      { token: adminToken }
    );

    assert.equal(listResponse.status, 200);
    const readyLot = listResponse.body.data.find((row) => row.lot_id === state.lotId);
    assert.ok(readyLot);
    assert.equal(readyLot.lot_status, 'READY');

    const planningResponse = await request('GET', `/api/planning/plans/${state.planId}`, {
      token: adminToken,
    });

    assert.equal(planningResponse.status, 200);
    assert.equal(planningResponse.body.data.plan_status, 'COMPLETED');
    assert.equal(planningResponse.body.data.lot_status, 'COMPLETED');
    assert.equal(
      planningResponse.body.data.tasks.find((task) => task.task_type === 'REPORT_READY').derived_status,
      'COMPLETED'
    );

    const productionLotResponse = await request('GET', `/api/production-lots/${state.lotId}`, {
      token: adminToken,
    });

    assert.equal(productionLotResponse.status, 200);
    assert.equal(productionLotResponse.body.data.status, 'COMPLETED');

    const detailResponse = await request('GET', `/api/reports/lots/${state.lotId}`, {
      token: adminToken,
    });

    assert.equal(detailResponse.status, 200);
    assert.equal(detailResponse.body.data.lot.lot_status, 'READY');
  });

  it('GET /api/dashboard/summary without token returns 401', async () => {
    const response = await request('GET', '/api/dashboard/summary');

    assert.equal(response.status, 401);
    assert.equal(response.body.error_code, 'UNAUTHORIZED');
  });

  it('user without SearchReport permission returns 403', async () => {
    const role = await request('POST', '/api/roles', {
      token: adminToken,
      body: {
        role_code: `SPRINT7_NOPERM_${suffix}`,
        role_name: 'Sprint 7 No Permission Role',
      },
    });
    assert.equal(role.status, 201);

    const user = await request('POST', '/api/users', {
      token: adminToken,
      body: {
        username: `sprint7_noperm_${suffix}`,
        password: 'Admin@123',
        employee_code: `EMP_S7_NOPERM_${suffix}`,
        full_name: 'Sprint 7 No Permission User',
        email: `sprint7_noperm_${suffix}@example.com`,
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

    const loggedIn = await login(`sprint7_noperm_${suffix}`, 'Admin@123');
    assert.equal(loggedIn.status, 200);

    const forbidden = await request('GET', '/api/dashboard/summary', {
      token: loggedIn.body.data.access_token,
    });

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error_code, 'FORBIDDEN');
  });
});
