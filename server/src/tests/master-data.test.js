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
  secondModelId: null,
  equipmentTypeId: null,
  equipmentId: null,
  requiredEquipmentId: null,
  templateId: null,
  sectionId: null,
  itemId: null,
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

describe('Sprint 3 Master Data integration', () => {
  before(async () => {
    server = app.listen(0);

    await new Promise((resolve) => {
      server.once('listening', resolve);
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await request('POST', '/api/auth/login', {
      body: {
        username: 'admin',
        password: 'Admin@123',
      },
    });

    assert.equal(response.status, 200);
    adminToken = response.body.data.access_token;
  });

  after(async () => {
    await pool.query(
      `
        DELETE FROM test_template
        WHERE template_name LIKE $1
      `,
      [`Sprint3%${suffix}%`]
    );

    await pool.query(
      `
        DELETE FROM model_required_equipment
        WHERE model_id IN (
          SELECT id FROM product_model WHERE model_code LIKE $1
        )
      `,
      [`S3M-${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM equipment_master
        WHERE equipment_code LIKE $1
      `,
      [`S3EQ-${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM equipment_type_master
        WHERE type_code LIKE $1
      `,
      [`S3T_${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM product_model
        WHERE model_code LIKE $1
      `,
      [`S3M-${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM product_sub_category
        WHERE sub_category_code LIKE $1
      `,
      [`S3SC_${codeSuffix}%`]
    );

    await pool.query(
      `
        DELETE FROM product_category
        WHERE category_code LIKE $1
      `,
      [`S3C_${codeSuffix}%`]
    );

    await pool.end();

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('creates Product Category and rejects duplicate code', async () => {
    const payload = {
      category_code: `S3C_${codeSuffix}`,
      category_name: 'Sprint3 Controller',
      active: true,
    };

    const created = await request('POST', '/api/product-categories', {
      token: adminToken,
      body: payload,
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.success, true);
    state.categoryId = created.body.data.id;

    const duplicated = await request('POST', '/api/product-categories', {
      token: adminToken,
      body: payload,
    });

    assert.equal(duplicated.status, 409);
    assert.equal(duplicated.body.error_code, 'CONFLICT');
  });

  it('creates Product Sub Category and Product Model', async () => {
    const subCategory = await request('POST', '/api/product-sub-categories', {
      token: adminToken,
      body: {
        category_id: state.categoryId,
        sub_category_code: `S3SC_${codeSuffix}`,
        sub_category_name: 'Sprint3 Control Sub Category',
        active: true,
      },
    });

    assert.equal(subCategory.status, 201);
    state.subCategoryId = subCategory.body.data.id;

    const model = await request('POST', '/api/product-models', {
      token: adminToken,
      body: {
        sub_category_id: state.subCategoryId,
        model_code: `S3M-${codeSuffix}`,
        product_name: 'Sprint3 Model',
        model_name: 'Sprint3 Model Name',
        active: true,
      },
    });

    assert.equal(model.status, 201);
    state.modelId = model.body.data.id;

    const lookup = await request('GET', '/api/lookups/product-models', {
      token: adminToken,
    });

    assert.equal(lookup.status, 200);
    assert.ok(lookup.body.data.some((row) => row.id === state.modelId));

    const secondModel = await request('POST', '/api/product-models', {
      token: adminToken,
      body: {
        sub_category_id: state.subCategoryId,
        model_code: `S3M-${codeSuffix}-B`,
        product_name: 'Sprint3 Second Model',
        model_name: 'Sprint3 Second Model Name',
        active: true,
      },
    });

    assert.equal(secondModel.status, 201);
    state.secondModelId = secondModel.body.data.id;
  });

  it('creates Equipment Type and Equipment with calibration status', async () => {
    const type = await request('POST', '/api/equipment-types', {
      token: adminToken,
      body: {
        type_code: `S3T_${codeSuffix}`,
        type_name: 'Sprint3 Test Equipment',
      },
    });

    assert.equal(type.status, 201);
    state.equipmentTypeId = type.body.data.id;

    const equipment = await request('POST', '/api/equipment', {
      token: adminToken,
      body: {
        equipment_code: `S3EQ-${codeSuffix}`,
        equipment_name: 'Sprint3 DMM',
        equipment_type_id: state.equipmentTypeId,
        calibration_due_date: '2024-01-01',
        status: 'ACTIVE',
      },
    });

    assert.equal(equipment.status, 201);
    assert.equal(equipment.body.data.calibration_status, 'EXPIRED');
    state.equipmentId = equipment.body.data.id;

    const expired = await request('GET', '/api/equipment/expired-calibration', {
      token: adminToken,
    });

    assert.equal(expired.status, 200);
    assert.ok(expired.body.data.some((row) => row.id === state.equipmentId));
  });

  it('creates required equipment, rejects duplicate, and lists available equipment', async () => {
    const required = await request('POST', '/api/model-required-equipment', {
      token: adminToken,
      body: {
        model_id: state.modelId,
        equipment_type_id: state.equipmentTypeId,
        required_qty: 1,
      },
    });

    assert.equal(required.status, 201);
    state.requiredEquipmentId = required.body.data.id;

    const duplicate = await request('POST', '/api/model-required-equipment', {
      token: adminToken,
      body: {
        model_id: state.modelId,
        equipment_type_id: state.equipmentTypeId,
        required_qty: 1,
      },
    });

    assert.equal(duplicate.status, 409);

    const available = await request(
      'GET',
      `/api/models/${state.modelId}/available-equipment`,
      {
        token: adminToken,
      }
    );

    assert.equal(available.status, 200);
    assert.ok(available.body.data.some((row) => row.equipment_id === state.equipmentId));
    assert.equal(
      available.body.data.find((row) => row.equipment_id === state.equipmentId).calibration_status,
      'EXPIRED'
    );
  });

  it('creates test template, section, item, and returns grouped items', async () => {
    const template = await request('POST', '/api/test-templates', {
      token: adminToken,
      body: {
        template_type: 'INSPECTION',
        template_name: `Sprint3 Template ${suffix}`,
        revision: 'A',
        active: true,
      },
    });

    assert.equal(template.status, 201);
    state.templateId = template.body.data.id;
    assert.equal(template.body.data.model_id, null);

    const assigned = await request('PUT', `/api/test-templates/${state.templateId}/models`, {
      token: adminToken,
      body: {
        model_ids: [state.modelId, state.secondModelId],
        primary_model_id: state.modelId,
      },
    });

    assert.equal(assigned.status, 200);
    assert.equal(assigned.body.data.length, 2);
    assert.ok(assigned.body.data.some((row) => row.id === state.secondModelId));

    const filtered = await request('GET', `/api/test-templates?model_id=${state.secondModelId}`, {
      token: adminToken,
    });

    assert.equal(filtered.status, 200);
    assert.ok(filtered.body.data.some((row) => row.id === state.templateId));

    const section = await request(
      'POST',
      `/api/test-templates/${state.templateId}/sections`,
      {
        token: adminToken,
        body: {
          section_name: 'Electrical Test',
          seq_no: 1,
        },
      }
    );

    assert.equal(section.status, 201);
    state.sectionId = section.body.data.id;

    const item = await request('POST', `/api/test-templates/${state.templateId}/items`, {
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

    assert.equal(item.status, 201);
    assert.equal(item.body.data.item_name, 'Voltage Test');
    state.itemId = item.body.data.id;

    const items = await request('GET', `/api/test-templates/${state.templateId}/items`, {
      token: adminToken,
    });

    assert.equal(items.status, 200);
    assert.equal(items.body.data.length, 1);
    assert.equal(items.body.data[0].items[0].id, state.itemId);

    const qcTemplates = await request('GET', `/api/qc/models/${state.secondModelId}/templates`, {
      token: adminToken,
    });

    assert.equal(qcTemplates.status, 200);
    assert.ok(qcTemplates.body.data.some((row) => row.id === state.templateId));
  });

  it('duplicates test template with sections, items, and model assignments', async () => {
    const duplicated = await request('POST', `/api/test-templates/${state.templateId}/duplicate`, {
      token: adminToken,
      body: {
        template_name: `Sprint3 Template Copy ${suffix}`,
        revision: 'A-COPY',
        active: true,
        copy_models: true,
      },
    });

    assert.equal(duplicated.status, 201);
    assert.equal(duplicated.body.data.template_name, `Sprint3 Template Copy ${suffix}`);
    assert.notEqual(duplicated.body.data.id, state.templateId);

    const copiedItems = await request('GET', `/api/test-templates/${duplicated.body.data.id}/items`, {
      token: adminToken,
    });

    assert.equal(copiedItems.status, 200);
    assert.equal(copiedItems.body.data.length, 1);
    assert.equal(copiedItems.body.data[0].section_name, 'Electrical Test');
    assert.equal(copiedItems.body.data[0].items.length, 1);
    assert.equal(copiedItems.body.data[0].items[0].item_code, 'VOLTAGE');

    const copiedModels = await request('GET', `/api/test-templates/${duplicated.body.data.id}/models`, {
      token: adminToken,
    });

    assert.equal(copiedModels.status, 200);
    assert.equal(copiedModels.body.data.length, 2);
    assert.ok(copiedModels.body.data.some((row) => row.id === state.modelId && row.is_primary));
    assert.ok(copiedModels.body.data.some((row) => row.id === state.secondModelId));
  });

  it('deletes unused test template with assignments and rejects reading it afterwards', async () => {
    const template = await request('POST', '/api/test-templates', {
      token: adminToken,
      body: {
        template_type: 'QA',
        template_name: `Sprint3 Delete Template ${suffix}`,
        revision: 'A',
        active: true,
      },
    });

    assert.equal(template.status, 201);

    const assigned = await request('PUT', `/api/test-templates/${template.body.data.id}/models`, {
      token: adminToken,
      body: {
        model_ids: [state.modelId],
        primary_model_id: state.modelId,
      },
    });

    assert.equal(assigned.status, 200);

    const deleted = await request('DELETE', `/api/test-templates/${template.body.data.id}`, {
      token: adminToken,
    });

    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.data.id, template.body.data.id);

    const missing = await request('GET', `/api/test-templates/${template.body.data.id}`, {
      token: adminToken,
    });

    assert.equal(missing.status, 404);
  });
});
