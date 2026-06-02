const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const {
  findUserByUsername,
  findRolesAndPermissionsByUserId,
  resetFailedLoginCount,
  incrementFailedLoginCount,
  insertLoginLog,
} = require('./auth.repository');

const { unauthorized, forbidden } = require('../../shared/http-error');

async function loginUser({
  username,
  password,
  requestId,
  ipAddress,
  userAgent,
}) {
  console.info('[AUTH][LOGIN][START]', {
    requestId,
    username,
  });

  const user = await findUserByUsername(username);

  if (!user) {
    console.warn('[AUTH][LOGIN][FAILED]', {
      requestId,
      username,
      reason: 'USER_NOT_FOUND',
    });

    await insertLoginLog({
      userId: null,
      username,
      success: false,
      failureReason: 'USER_NOT_FOUND',
      ipAddress,
      userAgent,
    });

    throw unauthorized('Invalid username or password');
  }

  if (!user.active) {
    console.warn('[AUTH][LOGIN][FAILED]', {
      requestId,
      username,
      userId: user.id,
      reason: 'USER_INACTIVE',
    });

    await insertLoginLog({
      userId: user.id,
      username,
      success: false,
      failureReason: 'USER_INACTIVE',
      ipAddress,
      userAgent,
    });

    throw forbidden('User account is inactive');
  }

  const passwordMatched = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatched) {
    await incrementFailedLoginCount(user.id);

    console.warn('[AUTH][LOGIN][FAILED]', {
      requestId,
      username,
      userId: user.id,
      reason: 'INVALID_PASSWORD',
    });

    await insertLoginLog({
      userId: user.id,
      username,
      success: false,
      failureReason: 'INVALID_PASSWORD',
      ipAddress,
      userAgent,
    });

    throw unauthorized('Invalid username or password');
  }

  await resetFailedLoginCount(user.id);

  const { roles, permissions } = await findRolesAndPermissionsByUserId(user.id);

  const tokenPayload = {
    sub: user.id,
    username: user.username,
    roles,
    permissions,
  };

  const accessToken = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    }
  );

  await insertLoginLog({
    userId: user.id,
    username,
    success: true,
    failureReason: null,
    ipAddress,
    userAgent,
  });

  console.info('[AUTH][LOGIN][SUCCESS]', {
    requestId,
    userId: user.id,
    roles,
  });

  return {
    access_token: accessToken,
    user: {
      id: user.id,
      username: user.username,
      employee_code: user.employee_code,
      full_name: user.full_name,
      email: user.email,
      roles,
      permissions,
    },
  };
}

module.exports = {
  loginUser,
};