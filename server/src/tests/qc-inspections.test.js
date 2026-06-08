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
  productUnitId: null,
  secondProductUnitId: null,
  secondSerialNumber: null,
  inspectionId: null,
  bySerialInspectionId: null,
  bulkSecondInspectionId: null,
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
    product_unit_id: state.productUnitId,
    template_id: state.templateId,
    inspection_no: 1,
    station_name: 'QC-STATION-01',
    equipment_ids: [state.equipmentId],
    items: [
      {
        template_item_id: state.numericItemId,
        measured_value: 230,
      },
      {
        template_item_id: state.booleanItemId,
        measured_text: 'OK',
      },
    ],
    remark: 'Sprint 5 QC save test',
    ...overrides,
  };
}

describe('Sprint 5 QC Inspection integration', () => {
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
        category_code: `S5C_${codeSuffix}`,
        category_name: 'Sprint5 Controller',
        active: true,
      },
    });
    assert.equal(category.status, 201);
    state.categoryId = category.body.data.id;

    const subCategory = await request('POST', '/api/product-sub-categories', {
      token: adminToken,
      body: {
        category_id: state.categoryId,
        sub_category_code: `S5SC_${codeSuffix}`,
        sub_category_name: 'Sprint5 Control Sub Category',
        active: true,
      },
    });
    assert.equal(subCategory.status, 201);
    state.subCategoryId = subCategory.body.data.id;

    const model = await request('POST', '/api/product-models', {
      token: adminToken,
      body: {
        sub_category_id: state.subCategoryId,
        model_code: `S5M-${codeSuffix}`,
        product_name: 'Sprint5 Model',
        model_name: 'Sprint5 Model Name',
        active: true,
      },
    });
    assert.equal(model.status, 201);
    state.modelId = model.body.data.id;

    const equipmentType = await request('POST', '/api/equipment-types', {
      token: adminToken,
      body: {
        type_code: `S5T_${codeSuffix}`,
        type_name: 'Sprint5 DMM Type',
      },
    });
    assert.equal(equipmentType.status, 201);
    state.equipmentTypeId = equipmentType.body.data.id;

    const equipment = await request('POST', '/api/equipment', {
      token: adminToken,
      body: {
        equipment_code: `S5EQ-${codeSuffix}`,
        equipment_name: 'Sprint5 DMM',
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
        template_type: 'INSPECTION',
        template_name: `Sprint5 QC Template ${suffix}`,
        revision: 'A',
        active: true,
      },
    });
    assert.equal(template.status, 201);
    state.templateId = template.body.data.id;

    const section = await request('POST', `/api/test-templates/${state.templateId}/sections`, {
      token: adminToken,
      body: {
        section_name: 'Electrical Test',
        seq_no: 1,
      },
    });
    assert.equal(section.status, 201);
    state.sectionId = section.body.data.id;

    const numericItem = await request('POST', `/api/test-templates/${state.templateId}/items`, {
      token: adminToken,
      body: {
        section_id: state.sectionId,
        item_code: 'VOLTAGE',
        item_name: 'Voltage Test',
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
        item_code: 'POWER_LED',
        item_name: 'Power LED',
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
        lot_number: `S5-LOT-${codeSuffix}`,
        production_date: '2026-06-03',
        lot_qty: 2,
        serial_generation: {
          prefix: `S5${codeSuffix}-`,
          start_number: 1,
          count: 2,
          padding: 3,
        },
      },
    });
    assert.equal(lot.status, 201);
    state.lotId = lot.body.data.lot.id;

    const units = await request('GET', `/api/qc/lots/${state.lotId}/units`, {
      token: adminToken,
    });
    assert.equal(units.status, 200);
    assert.equal(units.body.data.length, 2);
    state.productUnitId = units.body.data[0].id;
    state.secondProductUnitId = units.body.data[1].id;
    state.secondSerialNumber = units.body.data[1].serial_number;
  });

  after(async () => {
    await pool.query(
      `
        DELETE FROM approval_log
        WHERE source_type = 'QC'
          AND source_id IN (
            SELECT id FROM inspection_header WHERE template_id = $1
          )
      `,
      [state.templateId]
    );

    await pool.query(
      `
        DELETE FROM inspection_header
        WHERE template_id = $1
      `,
      [state.templateId]
    );

    await pool.query(
      `
        DELETE FROM app_user
        WHERE username LIKE $1
      `,
      [`sprint5_%_${suffix}`]
    );

    await pool.query(
      `
        DELETE FROM app_role
        WHERE role_code LIKE $1
      `,
      [`SPRINT5_%_${suffix}`]
    );

    await pool.query(
      `
        DELETE FROM test_template
        WHERE template_name LIKE $1
      `,
      [`Sprint5%${suffix}%`]
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
      [`S5${codeSuffix}-%`]
    );

    await pool.query(
      `
        DELETE FROM production_lot
        WHERE lot_number LIKE $1
      `,
      [`S5-LOT-${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM equipment_master
        WHERE equipment_code LIKE $1
      `,
      [`S5EQ-${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM equipment_type_master
        WHERE type_code LIKE $1
      `,
      [`S5T_${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM product_model
        WHERE model_code LIKE $1
      `,
      [`S5M-${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM product_sub_category
        WHERE sub_category_code LIKE $1
      `,
      [`S5SC_${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM product_category
        WHERE category_code LIKE $1
      `,
      [`S5C_${codeSuffix}%`]
    );

    await pool.end();

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('lists QC lots and lot units', async () => {
    const lots = await request('GET', `/api/qc/lots?search=${encodeURIComponent(`S5-LOT-${codeSuffix}`)}`, {
      token: adminToken,
    });

    assert.equal(lots.status, 200);
    assert.ok(lots.body.data.some((row) => row.id === state.lotId));
    const lotRow = lots.body.data.find((row) => row.id === state.lotId);
    assert.equal(lotRow.serial_count, 2);
    assert.equal(lotRow.production_lot_status, 'OPEN');
    assert.equal(lotRow.qc_status, 'NOT_STARTED');
    assert.equal(lotRow.approved_count, 0);
    assert.equal(lotRow.qc_result, 'N/A');

    const units = await request('GET', `/api/qc/lots/${state.lotId}/units`, {
      token: adminToken,
    });

    assert.equal(units.status, 200);
    assert.ok(units.body.data.some((row) => row.id === state.productUnitId));
    assert.ok(units.body.data[0].serial_number);
  });

  it('lists QC inspection status by lot with NOT_STARTED rows', async () => {
    const response = await request('GET', `/api/qc/lots/${state.lotId}/inspection-status`, {
      token: adminToken,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.lot.id, state.lotId);
    assert.equal(response.body.data.serials.length, 2);
    assert.ok(response.body.data.serials.some((row) => row.product_unit_id === state.productUnitId));
    assert.ok(response.body.data.serials.every((row) => row.qc_status === 'NOT_STARTED'));
    assert.equal(response.body.data.summary.not_started, 2);
    assert.equal(response.body.data.lot.qc_status, 'NOT_STARTED');
    assert.equal(response.body.data.lot.qc_result, 'N/A');
  });

  it('lists INSPECTION templates and grouped template items', async () => {
    const templates = await request('GET', `/api/qc/models/${state.modelId}/templates`, {
      token: adminToken,
    });

    assert.equal(templates.status, 200);
    assert.ok(templates.body.data.every((row) => row.template_type === 'INSPECTION'));
    assert.ok(templates.body.data.every((row) => row.active === true));
    assert.ok(templates.body.data.some((row) => row.id === state.templateId));

    const items = await request('GET', `/api/qc/templates/${state.templateId}/items`, {
      token: adminToken,
    });

    assert.equal(items.status, 200);
    assert.equal(items.body.data.length, 1);
    assert.equal(items.body.data[0].items.length, 2);
    assert.ok(items.body.data[0].items.some((row) => row.id === state.numericItemId));
  });

  it('creates QC inspection by lot_number and serial_number using first assigned template by default', async () => {
    const response = await request('POST', '/api/qc/inspections/by-serial', {
      token: adminToken,
      body: {
        lot_number: `S5-LOT-${codeSuffix}`,
        serial_number: state.secondSerialNumber,
        station_name: 'QC-STATION-BY-SERIAL',
        equipment_ids: [state.equipmentId],
        items: [
          {
            item_code: 'VOLTAGE',
            measured_value: 230,
          },
          {
            item_code: 'POWER_LED',
            measured_text: 'OK',
          },
        ],
        remark: 'Sprint 5 QC by serial test',
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.product_unit_id, state.secondProductUnitId);
    assert.equal(response.body.data.serial_number, state.secondSerialNumber);
    assert.equal(response.body.data.template_id, state.templateId);
    assert.equal(response.body.data.inspection_no, 2);
    assert.equal(response.body.data.status, 'DRAFT');
    assert.equal(response.body.data.overall_result, 'PASS');
    state.bySerialInspectionId = response.body.data.id;
  });

  it('creates QC inspection with calculated details and equipment in one transaction', async () => {
    const response = await request('POST', '/api/qc/inspections', {
      token: adminToken,
      body: qcPayload(),
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.status, 'DRAFT');
    assert.equal(response.body.data.overall_result, 'PASS');
    assert.equal(response.body.data.details.length, 2);
    assert.equal(response.body.data.equipment.length, 1);
    assert.ok(response.body.data.details.every((row) => row.result === 'PASS'));
    state.inspectionId = response.body.data.id;
  });

  it('updates QC inspection status table after draft creation', async () => {
    const response = await request('GET', `/api/qc/lots/${state.lotId}/inspection-status`, {
      token: adminToken,
    });

    const inspectedSerial = response.body.data.serials.find((row) => row.product_unit_id === state.productUnitId);

    assert.equal(response.status, 200);
    assert.equal(inspectedSerial.inspection_id, state.inspectionId);
    assert.equal(inspectedSerial.qc_status, 'DRAFT');
    assert.equal(inspectedSerial.overall_result, 'PASS');
    assert.equal(response.body.data.summary.draft, 2);
    assert.equal(response.body.data.summary.not_started, 0);
    assert.equal(response.body.data.lot.qc_status, 'DRAFT');
    assert.equal(response.body.data.lot.qc_result, 'N/A');

    const draftLots = await request(
      'GET',
      `/api/qc/lots?status=DRAFT&lot_number=${encodeURIComponent(`S5-LOT-${codeSuffix}`)}`,
      { token: adminToken }
    );
    assert.equal(draftLots.status, 200);
    assert.equal(draftLots.body.data.length, 1);
    assert.equal(draftLots.body.data[0].qc_status, 'DRAFT');
    assert.equal(draftLots.body.data[0].started_count, 2);
    assert.equal(draftLots.body.data[0].approved_count, 0);
  });

  it('duplicate QC inspection returns 409', async () => {
    const response = await request('POST', '/api/qc/inspections', {
      token: adminToken,
      body: qcPayload(),
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.error_code, 'CONFLICT');
  });

  it('retrieves and updates draft QC inspection with recalculated FAIL result', async () => {
    const detail = await request('GET', `/api/qc/inspections/${state.inspectionId}`, {
      token: adminToken,
    });

    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.details.length, 2);
    assert.equal(detail.body.data.equipment.length, 1);

    const equipmentCheck = await request('GET', `/api/qc/inspections/${state.inspectionId}/equipment-check`, {
      token: adminToken,
    });

    assert.equal(equipmentCheck.status, 200);
    assert.equal(equipmentCheck.body.data.valid, true);

    const updated = await request('PUT', `/api/qc/inspections/${state.inspectionId}`, {
      token: adminToken,
      body: {
        station_name: 'QC-STATION-02',
        equipment_ids: [state.equipmentId],
        items: [
          {
            template_item_id: state.numericItemId,
            measured_value: 250,
          },
          {
            template_item_id: state.booleanItemId,
            measured_text: 'OK',
          },
        ],
        remark: 'Update QC to fail numeric item',
      },
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.status, 'DRAFT');
    assert.equal(updated.body.data.overall_result, 'FAIL');
    assert.ok(updated.body.data.details.some((row) => row.result === 'FAIL'));
  });

  it('approve before reviewed returns 409, then submit review approve succeed with approval logs', async () => {
    const approveEarly = await request('POST', `/api/qc/inspections/${state.inspectionId}/approve`, {
      token: adminToken,
      body: {
        remark: 'Too early',
      },
    });

    assert.equal(approveEarly.status, 409);

    const submitted = await request('POST', `/api/qc/inspections/${state.inspectionId}/submit`, {
      token: adminToken,
      body: {
        remark: 'Submit QC',
      },
    });

    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.data.status, 'SUBMITTED');
    assert.ok(submitted.body.data.approval_logs.some((row) => row.action === 'SUBMIT'));

    const reviewed = await request('POST', `/api/qc/inspections/${state.inspectionId}/review`, {
      token: adminToken,
      body: {
        remark: 'Review QC',
      },
    });

    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.data.status, 'REVIEWED');
    assert.ok(reviewed.body.data.approval_logs.some((row) => row.action === 'REVIEW'));

    const approved = await request('POST', `/api/qc/inspections/${state.inspectionId}/approve`, {
      token: adminToken,
      body: {
        remark: 'Approve QC',
      },
    });

    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.status, 'APPROVED');
    assert.ok(approved.body.data.approved_at);
    assert.ok(approved.body.data.approval_logs.some((row) => row.action === 'APPROVE'));
  });

  it('expired equipment blocks submit', async () => {
    const created = await request('POST', '/api/qc/inspections', {
      token: adminToken,
      body: qcPayload({
        inspection_no: 2,
      }),
    });

    assert.equal(created.status, 201);
    state.bulkSecondInspectionId = created.body.data.id;

    await pool.query(
      `
        UPDATE equipment_master
        SET calibration_due_date = '2024-01-01'
        WHERE id = $1
      `,
      [state.equipmentId]
    );

    const blocked = await request('POST', `/api/qc/inspections/${created.body.data.id}/submit`, {
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

  it('bulk submits selected inspections, reviews the eligible lot, and approves selected inspections', async () => {
    const inspectionIds = [state.bySerialInspectionId, state.bulkSecondInspectionId];

    const submitted = await request('POST', '/api/qc/inspections/bulk-workflow', {
      token: adminToken,
      body: {
        action: 'SUBMIT',
        inspection_ids: inspectionIds,
        remark: 'Bulk submit selected QC inspections',
      },
    });

    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.data.processed_count, 2);
    assert.deepEqual(submitted.body.data.inspection_ids.sort((a, b) => a - b), inspectionIds.sort((a, b) => a - b));

    const reviewed = await request('POST', '/api/qc/inspections/bulk-workflow', {
      token: adminToken,
      body: {
        action: 'REVIEW',
        lot_id: state.lotId,
        remark: 'Bulk review all submitted QC inspections in lot',
      },
    });

    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.data.processed_count, 2);

    const approved = await request('POST', '/api/qc/inspections/bulk-workflow', {
      token: adminToken,
      body: {
        action: 'APPROVE',
        inspection_ids: inspectionIds,
        remark: 'Bulk approve selected QC inspections',
      },
    });

    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.processed_count, 2);

    const lotStatus = await request('GET', `/api/qc/lots/${state.lotId}/inspection-status`, {
      token: adminToken,
    });
    assert.equal(lotStatus.status, 200);
    assert.equal(lotStatus.body.data.summary.approved, 2);
    assert.equal(lotStatus.body.data.lot.qc_status, 'APPROVED');
    assert.equal(lotStatus.body.data.lot.qc_result, 'PASS');

    const approvedLots = await request(
      'GET',
      `/api/qc/lots?status=APPROVED&lot_number=${encodeURIComponent(`S5-LOT-${codeSuffix}`)}`,
      { token: adminToken }
    );
    assert.equal(approvedLots.status, 200);
    assert.equal(approvedLots.body.data.length, 1);
    assert.equal(approvedLots.body.data[0].production_lot_status, 'OPEN');
    assert.equal(approvedLots.body.data[0].qc_status, 'APPROVED');
    assert.equal(approvedLots.body.data[0].approved_count, 2);
    assert.equal(approvedLots.body.data[0].qc_result, 'PASS');
  });

  it('reject workflow writes approval log', async () => {
    const created = await request('POST', '/api/qc/inspections', {
      token: adminToken,
      body: qcPayload({
        inspection_no: 3,
      }),
    });

    assert.equal(created.status, 201);

    const submitted = await request('POST', `/api/qc/inspections/${created.body.data.id}/submit`, {
      token: adminToken,
      body: {
        remark: 'Submit for rejection',
      },
    });
    assert.equal(submitted.status, 200);

    const rejected = await request('POST', `/api/qc/inspections/${created.body.data.id}/reject`, {
      token: adminToken,
      body: {
        remark: 'Rejected due to abnormal result',
      },
    });

    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.data.status, 'REJECTED');
    assert.ok(rejected.body.data.approval_logs.some((row) => row.action === 'REJECT'));
  });

  it('GET /api/qc/lots without token returns 401', async () => {
    const response = await request('GET', '/api/qc/lots');

    assert.equal(response.status, 401);
    assert.equal(response.body.error_code, 'UNAUTHORIZED');
  });

  it('user without QCInspection permission returns 403', async () => {
    const role = await request('POST', '/api/roles', {
      token: adminToken,
      body: {
        role_code: `SPRINT5_NOPERM_${suffix}`,
        role_name: 'Sprint 5 No Permission Role',
      },
    });
    assert.equal(role.status, 201);

    const user = await request('POST', '/api/users', {
      token: adminToken,
      body: {
        username: `sprint5_noperm_${suffix}`,
        password: 'Admin@123',
        employee_code: `EMP_S5_NOPERM_${suffix}`,
        full_name: 'Sprint 5 No Permission User',
        email: `sprint5_noperm_${suffix}@example.com`,
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

    const loggedIn = await login(`sprint5_noperm_${suffix}`, 'Admin@123');
    assert.equal(loggedIn.status, 200);

    const forbidden = await request('GET', '/api/qc/lots', {
      token: loggedIn.body.data.access_token,
    });

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error_code, 'FORBIDDEN');
  });
});
