const { z } = require('zod');

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format');

const reportQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    model_code: z.string().trim().max(100).optional(),
    lot_number: z.string().trim().max(100).optional(),
    serial_number: z.string().trim().max(100).optional(),
    status: z.string().trim().max(50).optional(),
    result: z.string().trim().max(50).optional(),
    date_from: dateSchema.optional(),
    date_to: dateSchema.optional(),
    page: z.string().optional(),
    page_size: z.string().optional(),
  })
  .strict();

module.exports = {
  reportQuerySchema,
};
