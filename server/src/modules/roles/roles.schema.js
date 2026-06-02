const { z } = require('zod');

const createRoleSchema = z.object({
  role_code: z
    .string()
    .min(2, 'role_code must be at least 2 characters')
    .max(50, 'role_code must not exceed 50 characters')
    .regex(/^[A-Z0-9_]+$/, 'role_code must use only A-Z, 0-9 and underscore'),

  role_name: z
    .string()
    .min(2, 'role_name must be at least 2 characters')
    .max(150, 'role_name must not exceed 150 characters'),
});

const updateRoleSchema = z.object({
  role_name: z
    .string()
    .min(2, 'role_name must be at least 2 characters')
    .max(150, 'role_name must not exceed 150 characters'),
});

const updateRolePermissionsSchema = z.object({
  permission_ids: z
    .array(z.number().int().positive('permission id must be positive'))
    .default([]),
});

module.exports = {
  createRoleSchema,
  updateRoleSchema,
  updateRolePermissionsSchema,
};
