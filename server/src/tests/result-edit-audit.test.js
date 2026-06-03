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
  qaTemplateId: null,
  qcNumericItemId: null,
  qcBooleanItemId: null,
  qaNumericItemId: null,
  qaBooleanItemId: null,
  lotId: null,
  productUnitIds: [],
  qcInspectionId: null,
  qcDetailId: null,
  qaSamplingId: null,
  qaDetailId: null,
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

function qcPayload() {
  return {
    product_unit_id: state.productUnitIds[0],
    template_id: state.qcTemplateId,
    inspection_no: 1,
    station_name: 'S9-QC-STATION',
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
    remark: 'Sprint 9 QC fixture',
  };
}

function qaPayload() {
  return {
    lot_id: state.lotId,
    template_id: state.qaTemplateId,
    sampling_no: 1,
    sampling_method: 'MANUAL',
    station_name: 'S9-QA-STATION',
    equipment_ids: [state.equipmentId],
    sample_units: state.productUnitIds.slice(0, 2).map((productUnitId) => ({
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
    })),
    remark: 'Sprint 9 QA fixture',
  };
}

async function approveQc(id) {
  assert.equal((await request('POST', `/api/qc/inspections/${id}/submit`, {
    token: adminToken,
    body: { remark: 'Submit QC S9' },
  })).status, 200);
  assert.equal((await request('POST', `/api/qc/inspections/${id}/review`, {
    token: adminToken,
    body: { remark: 'Review QC S9' },
  })).status, 200);
  const approved = await request('POST', `/api/qc/inspections/${id}/approve`, {
    token: adminToken,
    body: { remark: 'Approve QC S9' },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.status, 'APPROVED');
}

async function approveQa(id) {
  assert.equal((await request('POST', `/api/qa/samplings/${id}/submit`, {
    token: adminToken,
    body: { remark: 'Submit QA S9' },
  })).status, 200);
  assert.equal((await request('POST', `/api/qa/samplings/${id}/review`, {
    token: adminToken,
    body: { remark: 'Review QA S9' },
  })).status, 200);
  const approved = await request('POST', `/api/qa/samplings/${id}/approve`, {
    token: adminToken,
    body: { remark: 'Approve QA S9' },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.status, 'APPROVED');
}

describe('Sprint 9 Edit Result / Audit Trail integration', () => {
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
        category_code: `S9C_${codeSuffix}`,
        category_name: 'Sprint9 Controller',
        active: true,
      },
    });
    assert.equal(category.status, 201);
    state.categoryId = category.body.data.id;

    const subCategory = await request('POST', '/api/product-sub-categories', {
      token: adminToken,
      body: {
        category_id: state.categoryId,
        sub_category_code: `S9SC_${codeSuffix}`,
        sub_category_name: 'Sprint9 Sub Category',
        active: true,
      },
    });
    assert.equal(subCategory.status, 201);
    state.subCategoryId = subCategory.body.data.id;

    const model = await request('POST', '/api/product-models', {
      token: adminToken,
      body: {
        sub_category_id: state.subCategoryId,
        model_code: `S9M-${codeSuffix}`,
        product_name: 'Sprint9 Model',
        model_name: 'Sprint9 Model Name',
        active: true,
      },
    });
    assert.equal(model.status, 201);
    state.modelId = model.body.data.id;

    const equipmentType = await request('POST', '/api/equipment-types', {
      token: adminToken,
      body: {
        type_code: `S9T_${codeSuffix}`,
        type_name: 'Sprint9 Tool Type',
      },
    });
    assert.equal(equipmentType.status, 201);
    state.equipmentTypeId = equipmentType.body.data.id;

    const equipment = await request('POST', '/api/equipment', {
      token: adminToken,
      body: {
        equipment_code: `S9EQ-${codeSuffix}`,
        equipment_name: 'Sprint9 Tool',
        equipment_type_id: state.equipmentTypeId,
        calibration_due_date: '2027-01-01',
        status: 'ACTIVE',
      },
    });
    assert.equal(equipment.status, 201);
    state.equipmentId = equipment.body.data.id;

    assert.equal((await request('POST', '/api/model-required-equipment', {
      token: adminToken,
      body: {
        model_id: state.modelId,
        equipment_type_id: state.equipmentTypeId,
        required_qty: 1,
        mandatory: true,
      },
    })).status, 201);

    const qcTemplate = await request('POST', '/api/test-templates', {
      token: adminToken,
      body: {
        model_id: state.modelId,
        template_type: 'INSPECTION',
        template_name: `Sprint9 QC Template ${suffix}`,
        revision: 'A',
        active: true,
      },
    });
    assert.equal(qcTemplate.status, 201);
    state.qcTemplateId = qcTemplate.body.data.id;

    const qcSection = await request('POST', `/api/test-templates/${state.qcTemplateId}/sections`, {
      token: adminToken,
      body: {
        section_name: 'Sprint9 QC Section',
        seq_no: 1,
      },
    });
    assert.equal(qcSection.status, 201);

    const qcNumeric = await request('POST', `/api/test-templates/${state.qcTemplateId}/items`, {
      token: adminToken,
      body: {
        section_id: qcSection.body.data.id,
        item_code: 'S9_QC_VOLT',
        item_name: 'Sprint9 QC Voltage',
        check_type: 'NUMERIC',
        spec_min: 210,
        spec_max: 240,
        input_unit: 'VAC',
        mandatory: true,
        seq_no: 1,
      },
    });
    assert.equal(qcNumeric.status, 201);
    state.qcNumericItemId = qcNumeric.body.data.id;

    const qcBoolean = await request('POST', `/api/test-templates/${state.qcTemplateId}/items`, {
      token: adminToken,
      body: {
        section_id: qcSection.body.data.id,
        item_code: 'S9_QC_LED',
        item_name: 'Sprint9 QC LED',
        check_type: 'BOOLEAN',
        mandatory: true,
        seq_no: 2,
      },
    });
    assert.equal(qcBoolean.status, 201);
    state.qcBooleanItemId = qcBoolean.body.data.id;

    const qaTemplate = await request('POST', '/api/test-templates', {
      token: adminToken,
      body: {
        model_id: state.modelId,
        template_type: 'QA',
        template_name: `Sprint9 QA Template ${suffix}`,
        revision: 'A',
        active: true,
      },
    });
    assert.equal(qaTemplate.status, 201);
    state.qaTemplateId = qaTemplate.body.data.id;

    const qaSection = await request('POST', `/api/test-templates/${state.qaTemplateId}/sections`, {
      token: adminToken,
      body: {
        section_name: 'Sprint9 QA Section',
        seq_no: 1,
      },
    });
    assert.equal(qaSection.status, 201);

    const qaNumeric = await request('POST', `/api/test-templates/${state.qaTemplateId}/items`, {
      token: adminToken,
      body: {
        section_id: qaSection.body.data.id,
        item_code: 'S9_QA_VOLT',
        item_name: 'Sprint9 QA Voltage',
        check_type: 'NUMERIC',
        spec_min: 210,
        spec_max: 240,
        input_unit: 'VAC',
        mandatory: true,
        seq_no: 1,
      },
    });
    assert.equal(qaNumeric.status, 201);
    state.qaNumericItemId = qaNumeric.body.data.id;

    const qaBoolean = await request('POST', `/api/test-templates/${state.qaTemplateId}/items`, {
      token: adminToken,
      body: {
        section_id: qaSection.body.data.id,
        item_code: 'S9_QA_LED',
        item_name: 'Sprint9 QA LED',
        check_type: 'BOOLEAN',
        mandatory: true,
        seq_no: 2,
      },
    });
    assert.equal(qaBoolean.status, 201);
    state.qaBooleanItemId = qaBoolean.body.data.id;

    const lot = await request('POST', '/api/production-lots', {
      token: adminToken,
      body: {
        model_id: state.modelId,
        lot_number: `S9-LOT-${codeSuffix}`,
        production_date: '2026-06-03',
        lot_qty: 3,
        serial_generation: {
          prefix: `S9${codeSuffix}-`,
          start_number: 1,
          count: 3,
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
    state.productUnitIds = units.body.data.map((unit) => unit.id);

    const qc = await request('POST', '/api/qc/inspections', {
      token: adminToken,
      body: qcPayload(),
    });
    assert.equal(qc.status, 201);
    state.qcInspectionId = qc.body.data.id;
    state.qcDetailId = qc.body.data.details.find((detail) => detail.template_item_id === state.qcNumericItemId).id;
    await approveQc(state.qcInspectionId);

    const qa = await request('POST', '/api/qa/samplings', {
      token: adminToken,
      body: qaPayload(),
    });
    assert.equal(qa.status, 201);
    state.qaSamplingId = qa.body.data.id;
    state.qaDetailId = qa.body.data.sample_units[0].details.find(
      (detail) => detail.template_item_id === state.qaNumericItemId
    ).id;
    await approveQa(state.qaSamplingId);
  });

  after(async () => {
    await pool.query(
      `
        DELETE FROM result_edit_audit_log
        WHERE (
          source_type = 'QC' AND source_id IN (SELECT id FROM inspection_header WHERE template_id = $1)
        )
        OR (
          source_type = 'QA' AND source_id IN (SELECT id FROM qa_sampling_header WHERE template_id = $2)
        )
      `,
      [state.qcTemplateId, state.qaTemplateId]
    );
    await pool.query(
      `
        DELETE FROM approval_log
        WHERE (
          source_type = 'QC' AND source_id IN (SELECT id FROM inspection_header WHERE template_id = $1)
        )
        OR (
          source_type = 'QA' AND source_id IN (SELECT id FROM qa_sampling_header WHERE template_id = $2)
        )
      `,
      [state.qcTemplateId, state.qaTemplateId]
    );
    await pool.query('DELETE FROM qa_sampling_header WHERE template_id = $1', [state.qaTemplateId]);
    await pool.query('DELETE FROM inspection_header WHERE template_id = $1', [state.qcTemplateId]);
    await pool.query('DELETE FROM test_template WHERE template_name LIKE $1', [`Sprint9%${suffix}%`]);
    await pool.query('DELETE FROM model_required_equipment WHERE model_id = $1', [state.modelId]);
    await pool.query('DELETE FROM product_unit WHERE serial_number LIKE $1', [`S9${codeSuffix}-%`]);
    await pool.query('DELETE FROM production_lot WHERE lot_number LIKE $1', [`S9-LOT-${codeSuffix}%`]);
    await pool.query('DELETE FROM equipment_master WHERE equipment_code LIKE $1', [`S9EQ-${codeSuffix}%`]);
    await pool.query('DELETE FROM equipment_type_master WHERE type_code LIKE $1', [`S9T_${codeSuffix}%`]);
    await pool.query('DELETE FROM product_model WHERE model_code LIKE $1', [`S9M-${codeSuffix}%`]);
    await pool.query('DELETE FROM product_sub_category WHERE sub_category_code LIKE $1', [`S9SC_${codeSuffix}%`]);
    await pool.query('DELETE FROM product_category WHERE category_code LIKE $1', [`S9C_${codeSuffix}%`]);

    await pool.end();

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('rejects normal QC update after approval', async () => {
    const response = await request('PUT', `/api/qc/inspections/${state.qcInspectionId}`, {
      token: adminToken,
      body: {
        station_name: 'SHOULD-NOT-UPDATE',
      },
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.error_code, 'CONFLICT');
  });

  it('requests and applies QC approved result edit with audit trail', async () => {
    const requested = await request('POST', `/api/qc/inspections/${state.qcInspectionId}/edit-request`, {
      token: adminToken,
      body: {
        reason: 'Retest found QC voltage out of spec',
      },
    });

    assert.equal(requested.status, 200);
    assert.equal(requested.body.data.status, 'EDIT_REQUESTED');
    assert.ok(requested.body.data.edit_history.some((row) => row.approval_status === 'REQUESTED'));

    const applied = await request('POST', `/api/qc/inspections/${state.qcInspectionId}/apply-edit`, {
      token: adminToken,
      body: {
        reason: 'Apply QC retest value',
        items: [
          {
            detail_id: state.qcDetailId,
            measured_value: 9999,
          },
        ],
      },
    });

    assert.equal(applied.status, 200);
    assert.equal(applied.body.data.status, 'SUBMITTED');
    assert.equal(applied.body.data.overall_result, 'FAIL');
    assert.ok(applied.body.data.edit_history.some((row) => row.approval_status === 'APPLIED'));
    assert.ok(applied.body.data.approval_logs.some((row) => row.action === 'APPLY_EDIT'));

    const history = await request('GET', `/api/qc/inspections/${state.qcInspectionId}/edit-history`, {
      token: adminToken,
    });
    assert.equal(history.status, 200);
    assert.ok(history.body.data.some((row) => Number(row.new_measured_value) === 9999));

    const report = await request('GET', `/api/reports/qc-inspections/${state.qcInspectionId}`, {
      token: adminToken,
    });
    assert.equal(report.status, 200);
    assert.equal(report.body.data.overall_result, 'FAIL');
    assert.ok(report.body.data.edit_history.some((row) => row.edit_reason === 'Apply QC retest value'));

    const reviewed = await request('POST', `/api/qc/inspections/${state.qcInspectionId}/review`, {
      token: adminToken,
      body: { remark: 'Review edited QC' },
    });
    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.data.status, 'REVIEWED');

    const approved = await request('POST', `/api/qc/inspections/${state.qcInspectionId}/approve`, {
      token: adminToken,
      body: { remark: 'Approve edited QC' },
    });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.status, 'APPROVED');
  });

  it('requests and applies QA approved result edit with audit trail', async () => {
    const requested = await request('POST', `/api/qa/samplings/${state.qaSamplingId}/edit-request`, {
      token: adminToken,
      body: {
        reason: 'Retest found QA voltage out of spec',
      },
    });

    assert.equal(requested.status, 200);
    assert.equal(requested.body.data.status, 'EDIT_REQUESTED');

    const applied = await request('POST', `/api/qa/samplings/${state.qaSamplingId}/apply-edit`, {
      token: adminToken,
      body: {
        reason: 'Apply QA retest value',
        items: [
          {
            detail_id: state.qaDetailId,
            measured_value: 9999,
          },
        ],
      },
    });

    assert.equal(applied.status, 200);
    assert.equal(applied.body.data.status, 'SUBMITTED');
    assert.equal(applied.body.data.overall_result, 'FAIL');
    assert.ok(applied.body.data.sample_units.some((unit) => unit.unit_result === 'FAIL'));
    assert.ok(applied.body.data.edit_history.some((row) => row.approval_status === 'APPLIED'));

    const history = await request('GET', `/api/qa/samplings/${state.qaSamplingId}/edit-history`, {
      token: adminToken,
    });
    assert.equal(history.status, 200);
    assert.ok(history.body.data.some((row) => Number(row.new_measured_value) === 9999));

    const report = await request('GET', `/api/reports/qa-samplings/${state.qaSamplingId}`, {
      token: adminToken,
    });
    assert.equal(report.status, 200);
    assert.equal(report.body.data.overall_result, 'FAIL');
    assert.ok(report.body.data.edit_history.some((row) => row.edit_reason === 'Apply QA retest value'));

    const reviewed = await request('POST', `/api/qa/samplings/${state.qaSamplingId}/review`, {
      token: adminToken,
      body: { remark: 'Review edited QA' },
    });
    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.data.status, 'REVIEWED');

    const approved = await request('POST', `/api/qa/samplings/${state.qaSamplingId}/approve`, {
      token: adminToken,
      body: { remark: 'Approve edited QA' },
    });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.status, 'APPROVED');
  });
});
