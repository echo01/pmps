const bcrypt = require('bcrypt');

const {
  findProfileById,
  updateProfile,
  findPasswordByUserId,
  updateProfilePassword,
} = require('./profile.repository');
const { findRolesAndPermissionsByUserId } = require('../auth/auth.repository');
const { conflict, notFound, validationError } = require('../../shared/http-error');

async function attachRolesAndPermissions(profile) {
  const access = await findRolesAndPermissionsByUserId(profile.id);

  return {
    ...profile,
    roles: access.roles,
    permissions: access.permissions,
  };
}

async function getProfile({ userId, requestId }) {
  console.info('[PROFILE][GET][START]', {
    requestId,
    userId,
  });

  const profile = await findProfileById(userId);

  if (!profile) {
    throw notFound('Profile not found');
  }

  const result = await attachRolesAndPermissions(profile);

  console.info('[PROFILE][GET][SUCCESS]', {
    requestId,
    userId,
  });

  return result;
}

async function updateOwnProfile({ userId, payload, requestId }) {
  console.info('[PROFILE][UPDATE][START]', {
    requestId,
    userId,
  });

  const existingProfile = await findProfileById(userId);

  if (!existingProfile) {
    throw notFound('Profile not found');
  }

  const profile = await updateProfile(userId, payload);
  const result = await attachRolesAndPermissions(profile);

  console.info('[PROFILE][UPDATE][SUCCESS]', {
    requestId,
    userId,
  });

  return result;
}

async function changeOwnPassword({ userId, payload, requestId }) {
  console.info('[PROFILE][PASSWORD][START]', {
    requestId,
    userId,
  });

  const userPassword = await findPasswordByUserId(userId);

  if (!userPassword) {
    throw notFound('Profile not found');
  }

  const currentPasswordMatches = await bcrypt.compare(
    payload.current_password,
    userPassword.password_hash
  );

  if (!currentPasswordMatches) {
    throw validationError('Current password is incorrect', [
      {
        field: 'current_password',
        message: 'current_password is incorrect',
      },
    ]);
  }

  const newPasswordMatchesCurrent = await bcrypt.compare(
    payload.new_password,
    userPassword.password_hash
  );

  if (newPasswordMatchesCurrent) {
    throw conflict('New password must be different from current password', [
      {
        field: 'new_password',
        message: 'new_password must be different from current password',
      },
    ]);
  }

  const passwordHash = await bcrypt.hash(payload.new_password, 12);
  const profile = await updateProfilePassword(userId, passwordHash);
  const result = await attachRolesAndPermissions(profile);

  console.info('[PROFILE][PASSWORD][SUCCESS]', {
    requestId,
    userId,
  });

  return result;
}

module.exports = {
  getProfile,
  updateOwnProfile,
  changeOwnPassword,
};
