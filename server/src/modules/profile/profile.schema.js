const { z } = require('zod');

const updateProfileSchema = z.object({
  full_name: z
    .string()
    .min(2, 'full_name must be at least 2 characters')
    .max(200, 'full_name must not exceed 200 characters'),

  email: z
    .string()
    .email('email must be a valid email address')
    .max(200, 'email must not exceed 200 characters')
    .optional()
    .nullable(),
});

const changePasswordSchema = z
  .object({
    current_password: z
      .string()
      .min(1, 'current_password is required')
      .max(100, 'current_password must not exceed 100 characters'),

    new_password: z
      .string()
      .min(8, 'new_password must be at least 8 characters')
      .max(100, 'new_password must not exceed 100 characters'),

    confirm_password: z
      .string()
      .min(8, 'confirm_password must be at least 8 characters')
      .max(100, 'confirm_password must not exceed 100 characters'),
  })
  .refine((payload) => payload.new_password === payload.confirm_password, {
    path: ['confirm_password'],
    message: 'confirm_password must match new_password',
  });

module.exports = {
  updateProfileSchema,
  changePasswordSchema,
};
