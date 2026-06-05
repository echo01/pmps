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
let adminUserId;
let profileUserId;
let profileToken;
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
  return request('POST', '/api/auth/login', {
    body: {
      username,
      password,
    },
  });
}

describe('Sprint 16 User Management / Profile / Security Administration integration', () => {
  before(async () => {
    server = app.listen(0);

    await new Promise((resolve) => {
      server.once('listening', resolve);
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    const adminLogin = await login('admin', 'Admin@123');
    assert.equal(adminLogin.status, 200);
    adminToken = adminLogin.body.data.access_token;
    adminUserId = adminLogin.body.data.user.id;

    const profileUser = await request('POST', '/api/users', {
      token: adminToken,
      body: {
        username: `sprint16_profile_${suffix}`,
        password: 'Admin@123',
        employee_code: `S16P${String(suffix).slice(-8)}`,
        full_name: 'Sprint 16 Profile User',
        email: `sprint16_profile_${suffix}@example.com`,
        active: true,
      },
    });
    assert.equal(profileUser.status, 201);
    profileUserId = profileUser.body.data.id;

    const profileLogin = await login(`sprint16_profile_${suffix}`, 'Admin@123');
    assert.equal(profileLogin.status, 200);
    profileToken = profileLogin.body.data.access_token;
  });

  after(async () => {
    await pool.query(
      `
        DELETE FROM app_user
        WHERE username LIKE $1
      `,
      [`sprint16_%_${suffix}`]
    );

    await pool.end();

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('GET /api/profile returns current user roles and permissions arrays', async () => {
    const response = await request('GET', '/api/profile', {
      token: adminToken,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.username, 'admin');
    assert.ok(Array.isArray(response.body.data.roles));
    assert.ok(Array.isArray(response.body.data.permissions));
  });

  it('PUT /api/profile updates own full name and email', async () => {
    const response = await request('PUT', '/api/profile', {
      token: profileToken,
      body: {
        full_name: 'Sprint 16 Profile Updated',
        email: `sprint16_profile_updated_${suffix}@example.com`,
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.full_name, 'Sprint 16 Profile Updated');
    assert.equal(response.body.data.email, `sprint16_profile_updated_${suffix}@example.com`);
  });

  it('POST /api/profile/password changes own password after current password validation', async () => {
    const changed = await request('POST', '/api/profile/password', {
      token: profileToken,
      body: {
        current_password: 'Admin@123',
        new_password: 'Admin@12345',
        confirm_password: 'Admin@12345',
      },
    });

    assert.equal(changed.status, 200);
    assert.equal(changed.body.success, true);

    const oldLogin = await login(`sprint16_profile_${suffix}`, 'Admin@123');
    assert.equal(oldLogin.status, 401);

    const newLogin = await login(`sprint16_profile_${suffix}`, 'Admin@12345');
    assert.equal(newLogin.status, 200);
  });

  it('GET /api/permissions returns permission catalog for role management UI', async () => {
    const response = await request('GET', '/api/permissions', {
      token: adminToken,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(response.body.data.some((permission) => permission.permission_code === 'UserRole'));
  });

  it('POST /api/users/:id/lock locks a user and unlock resets failed count state', async () => {
    const locked = await request('POST', `/api/users/${profileUserId}/lock`, {
      token: adminToken,
    });

    assert.equal(locked.status, 200);
    assert.equal(locked.body.data.active, false);

    const unlocked = await request('POST', `/api/users/${profileUserId}/unlock`, {
      token: adminToken,
    });

    assert.equal(unlocked.status, 200);
    assert.equal(unlocked.body.data.active, true);
    assert.equal(unlocked.body.data.failed_login_count, 0);
  });

  it('prevents admin from locking own account', async () => {
    const response = await request('POST', `/api/users/${adminUserId}/lock`, {
      token: adminToken,
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.error_code, 'CONFLICT');
  });

  it('prevents removing own ADMIN/UserRole management access', async () => {
    const response = await request('PUT', `/api/users/${adminUserId}/roles`, {
      token: adminToken,
      body: {
        role_ids: [],
      },
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.error_code, 'CONFLICT');
  });
});
