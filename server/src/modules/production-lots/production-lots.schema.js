const { z } = require('zod');

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format');

const serialGenerationSchema = z.object({
  prefix: z.string().trim().max(50).optional().default(''),
  start_number: z.coerce.number().int().min(0),
  count: z.coerce.number().int().positive().max(5000),
  padding: z.coerce.number().int().min(0).max(20).optional().default(0),
});

const createProductionLotSchema = z
  .object({
    model_id: z.coerce.number().int().positive(),
    lot_number: z.string().trim().min(1).max(100),
    production_date: dateSchema.optional().nullable(),
    lot_qty: z.coerce.number().int().positive().max(5000),
    remark: z.string().trim().max(500).optional().nullable(),
    serial_generation: serialGenerationSchema,
    ecn_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
  })
  .refine((payload) => payload.serial_generation.count === payload.lot_qty, {
    path: ['serial_generation', 'count'],
    message: 'serial_generation.count must equal lot_qty',
  });

const updateProductionLotSchema = z
  .object({
    production_date: dateSchema.optional().nullable(),
    remark: z.string().trim().max(500).optional().nullable(),
    status: z.enum(['OPEN', 'CLOSED', 'HOLD', 'CANCELLED']).optional(),
  })
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    path: ['body'],
    message: 'At least one field is required',
  });

const updateLotEcnSchema = z.object({
  ecn_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
});

module.exports = {
  serialGenerationSchema,
  createProductionLotSchema,
  updateProductionLotSchema,
  updateLotEcnSchema,
};
