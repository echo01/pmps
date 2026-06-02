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
  const response = await request('POST', '/api/auth/login', {
    body: {
      username,
      password,
    },
  });

  return response;
}

describe('Sprint 2 Auth / User / Role integration', () => {
  before(async () => {
    server = app.listen(0);

    await new Promise((resolve) => {
      server.once('listening', resolve);
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await login('admin', 'Admin@123');
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    adminToken = response.body.data.access_token;
  });

  after(async () => {
    await pool.query(
      `
        DELETE FROM app_user
        WHERE username LIKE $1
      `,
      [`sprint2_%_${suffix}`]
    );

    await pool.query(
      `
        DELETE FROM app_role
        WHERE role_code LIKE $1
      `,
      [`SPRINT2_%_${suffix}`]
    );

    await pool.end();

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('login success', async () => {
    const response = await login('admin', 'Admin@123');

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(response.body.data.access_token);
    assert.equal(response.body.data.user.username, 'admin');
  });

  it('login wrong password', async () => {
    const response = await login('admin', 'WrongPassword@123');

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
    assert.equal(response.body.error_code, 'UNAUTHORIZED');
  });

  it('get current user /api/auth/me', async () => {
    const response = await request('GET', '/api/auth/me', {
      token: adminToken,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.user.username, 'admin');
  });

  it('GET /api/users with admin token', async () => {
    const response = await request('GET', '/api/users', {
      token: adminToken,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(Array.isArray(response.body.data));
  });

  it('GET /api/users without token returns 401', async () => {
    const response = await request('GET', '/api/users');

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
    assert.equal(response.body.error_code, 'UNAUTHORIZED');
  });

  it('POST /api/users duplicate username returns 409', async () => {
    const username = `sprint2_dup_${suffix}`;
    const payload = {
      username,
      password: 'Admin@123',
      employee_code: `EMP_DUP_${suffix}`,
      full_name: 'Sprint 2 Duplicate User',
      email: `sprint2_dup_${suffix}@example.com`,
      active: true,
    };

    const created = await request('POST', '/api/users', {
      token: adminToken,
      body: payload,
    });
    assert.equal(created.status, 201);

    const duplicated = await request('POST', '/api/users', {
      token: adminToken,
      body: {
        ...payload,
        employee_code: `EMP_DUP2_${suffix}`,
      },
    });

    assert.equal(duplicated.status, 409);
    assert.equal(duplicated.body.success, false);
    assert.equal(duplicated.body.error_code, 'CONFLICT');
  });

  it('PUT /api/users/:id/roles success', async () => {
    const role = await request('POST', '/api/roles', {
      token: adminToken,
      body: {
        role_code: `SPRINT2_ASSIGN_${suffix}`,
        role_name: 'Sprint 2 Assign Role',
      },
    });
    assert.equal(role.status, 201);

    const user = await request('POST', '/api/users', {
      token: adminToken,
      body: {
        username: `sprint2_assign_${suffix}`,
        password: 'Admin@123',
        employee_code: `EMP_ASSIGN_${suffix}`,
        full_name: 'Sprint 2 Assign User',
        email: `sprint2_assign_${suffix}@example.com`,
      },
    });
    assert.equal(user.status, 201);

    const assigned = await request(
      'PUT',
      `/api/users/${user.body.data.id}/roles`,
      {
        token: adminToken,
        body: {
          role_ids: [role.body.data.id],
        },
      }
    );

    assert.equal(assigned.status, 200);
    assert.equal(assigned.body.success, true);
    assert.equal(assigned.body.data.length, 1);
    assert.equal(assigned.body.data[0].role_code, role.body.data.role_code);
  });

  it('user without permission entering role API returns 403', async () => {
    const role = await request('POST', '/api/roles', {
      token: adminToken,
      body: {
        role_code: `SPRINT2_NOPERM_${suffix}`,
        role_name: 'Sprint 2 No Permission Role',
      },
    });
    assert.equal(role.status, 201);

    const user = await request('POST', '/api/users', {
      token: adminToken,
      body: {
        username: `sprint2_noperm_${suffix}`,
        password: 'Admin@123',
        employee_code: `EMP_NOPERM_${suffix}`,
        full_name: 'Sprint 2 No Permission User',
        email: `sprint2_noperm_${suffix}@example.com`,
      },
    });
    assert.equal(user.status, 201);

    const assigned = await request(
      'PUT',
      `/api/users/${user.body.data.id}/roles`,
      {
        token: adminToken,
        body: {
          role_ids: [role.body.data.id],
        },
      }
    );
    assert.equal(assigned.status, 200);

    const loginResponse = await login(`sprint2_noperm_${suffix}`, 'Admin@123');
    assert.equal(loginResponse.status, 200);

    const forbidden = await request('GET', '/api/roles', {
      token: loginResponse.body.data.access_token,
    });

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.success, false);
    assert.equal(forbidden.body.error_code, 'FORBIDDEN');
  });
});
