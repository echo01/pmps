const { z } = require('zod');

const createRequiredEquipmentSchema = z.object({
  model_id: z.number().int().positive(),
  equipment_type_id: z.number().int().positive(),
  required_qty: z.number().int().positive().optional(),
  mandatory: z.boolean().optional(),
  remark: z.string().max(500).optional().nullable(),
});

const updateRequiredEquipmentSchema = z.object({
  model_id: z.number().int().positive().optional(),
  equipment_type_id: z.number().int().positive().optional(),
  required_qty: z.number().int().positive().optional(),
  mandatory: z.boolean().optional(),
  remark: z.string().max(500).optional().nullable(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'at least one field is required',
});

module.exports = {
  createRequiredEquipmentSchema,
  updateRequiredEquipmentSchema,
};
