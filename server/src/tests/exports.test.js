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

async function requestJson(method, path, { token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}

async function requestRaw(path, { token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return {
    status: response.status,
    headers: response.headers,
    buffer: Buffer.from(await response.arrayBuffer()),
  };
}

async function login(username, password) {
  return requestJson('POST', '/api/auth/login', {
    body: {
      username,
      password,
    },
  });
}

function assertContentDisposition(response, filename) {
  const disposition = response.headers.get('content-disposition');
  assert.ok(disposition.includes(`filename="${filename}"`));
}

function assertCsv(response, expectedHeader) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/csv/);
  assert.deepEqual([...response.buffer.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.ok(response.buffer.toString('utf8').includes(expectedHeader));
}

function assertXlsx(response) {
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('content-type'),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  assert.equal(response.buffer.subarray(0, 2).toString('utf8'), 'PK');
}

function assertPdf(response) {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.buffer.subarray(0, 4).toString('utf8'), '%PDF');
}

describe('Sprint 10 Export integration', () => {
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
  });

  after(async () => {
    await pool.query('DELETE FROM app_user WHERE username LIKE $1', [`sprint10_%_${suffix}`]);
    await pool.query('DELETE FROM app_role WHERE role_code LIKE $1', [`SPRINT10_%_${suffix}`]);
    await pool.end();

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('exports QC inspection CSV/XLSX/PDF files', async () => {
    const csv = await requestRaw('/api/exports/qc-inspections.csv', { token: adminToken });
    assertCsv(csv, 'Inspection ID');
    assertContentDisposition(csv, 'qc-inspections.csv');

    const xlsx = await requestRaw('/api/exports/qc-inspections.xlsx', { token: adminToken });
    assertXlsx(xlsx);
    assertContentDisposition(xlsx, 'qc-inspections.xlsx');

    const pdf = await requestRaw('/api/exports/qc-inspections.pdf', { token: adminToken });
    assertPdf(pdf);
    assertContentDisposition(pdf, 'qc-inspections.pdf');
  });

  it('exports QA sampling CSV/XLSX/PDF files', async () => {
    const csv = await requestRaw('/api/exports/qa-samplings.csv', { token: adminToken });
    assertCsv(csv, 'QA Sampling ID');

    const xlsx = await requestRaw('/api/exports/qa-samplings.xlsx', { token: adminToken });
    assertXlsx(xlsx);

    const pdf = await requestRaw('/api/exports/qa-samplings.pdf', { token: adminToken });
    assertPdf(pdf);
  });

  it('exports lot and audit trail CSV/XLSX files', async () => {
    const lotsCsv = await requestRaw('/api/exports/lots.csv', { token: adminToken });
    assertCsv(lotsCsv, 'Lot ID');

    const lotsXlsx = await requestRaw('/api/exports/lots.xlsx', { token: adminToken });
    assertXlsx(lotsXlsx);

    const auditCsv = await requestRaw('/api/exports/audit-trails.csv', { token: adminToken });
    assertCsv(auditCsv, 'Audit ID');

    const auditXlsx = await requestRaw('/api/exports/audit-trails.xlsx', { token: adminToken });
    assertXlsx(auditXlsx);
  });

  it('export endpoint without token returns 401', async () => {
    const response = await requestJson('GET', '/api/exports/qc-inspections.csv');

    assert.equal(response.status, 401);
    assert.equal(response.body.error_code, 'UNAUTHORIZED');
  });

  it('user without SearchReport permission returns 403', async () => {
    const role = await requestJson('POST', '/api/roles', {
      token: adminToken,
      body: {
        role_code: `SPRINT10_NOPERM_${suffix}`,
        role_name: 'Sprint 10 No Permission Role',
      },
    });
    assert.equal(role.status, 201);

    const user = await requestJson('POST', '/api/users', {
      token: adminToken,
      body: {
        username: `sprint10_noperm_${suffix}`,
        password: 'Admin@123',
        employee_code: `EMP_S10_NOPERM_${suffix}`,
        full_name: 'Sprint 10 No Permission User',
        email: `sprint10_noperm_${suffix}@example.com`,
      },
    });
    assert.equal(user.status, 201);

    const assigned = await requestJson('PUT', `/api/users/${user.body.data.id}/roles`, {
      token: adminToken,
      body: {
        role_ids: [role.body.data.id],
      },
    });
    assert.equal(assigned.status, 200);

    const loggedIn = await login(`sprint10_noperm_${suffix}`, 'Admin@123');
    assert.equal(loggedIn.status, 200);

    const forbidden = await requestJson('GET', '/api/exports/qc-inspections.csv', {
      token: loggedIn.body.data.access_token,
    });

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error_code, 'FORBIDDEN');
  });
});
