const { z } = require('zod');

const optionalNullableString = (max, fieldName) =>
  z
    .string()
    .max(max, `${fieldName} must not exceed ${max} characters`)
    .optional()
    .nullable();

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'username must be at least 3 characters')
    .max(100, 'username must not exceed 100 characters')
    .regex(/^[A-Za-z0-9._-]+$/, 'username contains unsupported characters'),

  password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(100, 'password must not exceed 100 characters'),

  employee_code: optionalNullableString(50, 'employee_code'),

  full_name: z
    .string()
    .min(2, 'full_name must be at least 2 characters')
    .max(200, 'full_name must not exceed 200 characters'),

  department: optionalNullableString(100, 'department'),

  email: z
    .string()
    .email('email must be a valid email address')
    .max(200, 'email must not exceed 200 characters')
    .optional()
    .nullable(),

  active: z.boolean().optional(),
});

const updateUserSchema = z
  .object({
    employee_code: optionalNullableString(50, 'employee_code'),

    full_name: z
      .string()
      .min(2, 'full_name must be at least 2 characters')
      .max(200, 'full_name must not exceed 200 characters')
      .optional(),

    department: optionalNullableString(100, 'department'),

    email: z
      .string()
      .email('email must be a valid email address')
      .max(200, 'email must not exceed 200 characters')
      .optional()
      .nullable(),

    active: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'at least one field is required',
  });

const updateUserActiveSchema = z.object({
  active: z.boolean(),
});

const updateUserPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(100, 'password must not exceed 100 characters'),
});

const updateUserRolesSchema = z.object({
  role_ids: z
    .array(z.number().int().positive('role id must be positive'))
    .default([]),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  updateUserActiveSchema,
  updateUserPasswordSchema,
  updateUserRolesSchema,
};
