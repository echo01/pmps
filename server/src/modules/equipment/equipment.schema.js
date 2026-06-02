const { z } = require('zod');

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');
const nullableText = z.string().max(500).optional().nullable();
const statusSchema = z.enum(['ACTIVE', 'INACTIVE', 'REPAIR', 'CALIBRATION']);

const createEquipmentTypeSchema = z.object({
  type_code: z.string().min(2).max(50).regex(/^[A-Z0-9_/-]+$/),
  type_name: z.string().min(2).max(100),
  description: nullableText,
});

const updateEquipmentTypeSchema = z.object({
  type_code: z.string().min(2).max(50).regex(/^[A-Z0-9_/-]+$/).optional(),
  type_name: z.string().min(2).max(100).optional(),
  description: nullableText,
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'at least one field is required',
});

const createEquipmentSchema = z.object({
  equipment_code: z.string().min(2).max(100).regex(/^[A-Z0-9_.-]+$/),
  equipment_name: z.string().min(2).max(200),
  equipment_type_id: z.number().int().positive().optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  serial_number: z.string().max(100).optional().nullable(),
  calibration_no: z.string().max(100).optional().nullable(),
  calibration_date: dateString.optional().nullable(),
  calibration_due_date: dateString.optional().nullable(),
  status: statusSchema.optional(),
  location_name: z.string().max(100).optional().nullable(),
  asset_no: z.string().max(100).optional().nullable(),
  remark: nullableText,
});

const updateEquipmentSchema = createEquipmentSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'at least one field is required',
  }
);

module.exports = {
  createEquipmentTypeSchema,
  updateEquipmentTypeSchema,
  createEquipmentSchema,
  updateEquipmentSchema,
};
