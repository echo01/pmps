const { z } = require('zod');

const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'username is required'),

  password: z
    .string()
    .min(1, 'password is required'),
});

module.exports = {
  loginSchema,
};