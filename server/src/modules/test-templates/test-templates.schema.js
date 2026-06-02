const { z } = require('zod');

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');
const templateTypeSchema = z.enum(['INSPECTION', 'QA']);
const checkTypeSchema = z.enum(['NUMERIC', 'BOOLEAN', 'TEXT']);

const createTemplateSchema = z.object({
  model_id: z.number().int().positive(),
  template_type: templateTypeSchema,
  template_name: z.string().min(2).max(200),
  revision: z.string().min(1).max(50).optional(),
  revision_note: z.string().max(500).optional().nullable(),
  effective_from: dateString.optional().nullable(),
  effective_to: dateString.optional().nullable(),
  active: z.boolean().optional(),
});

const updateTemplateSchema = createTemplateSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'at least one field is required',
  }
);

const createSectionSchema = z.object({
  seq_no: z.number().int().positive(),
  section_code: z.string().max(100).optional().nullable(),
  section_name: z.string().min(2).max(200),
});

const updateSectionSchema = createSectionSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'at least one field is required',
  }
);

const baseItemSchema = z.object({
  section_id: z.number().int().positive().optional().nullable(),
  seq_no: z.number().int().positive(),
  item_code: z.string().max(100).optional().nullable(),
  test_point: z.string().max(150).optional(),
  item_name: z.string().max(150).optional(),
  test_description: z.string().max(1000).optional().nullable(),
  channel_name: z.string().max(50).optional().nullable(),
  input_name: z.string().max(100).optional().nullable(),
  input_value: z.number().optional().nullable(),
  input_unit: z.string().max(30).optional().nullable(),
  source_name: z.string().max(100).optional().nullable(),
  source_value: z.number().optional().nullable(),
  source_unit: z.string().max(30).optional().nullable(),
  expect_value: z.number().optional().nullable(),
  expect_text: z.string().max(200).optional().nullable(),
  spec_min: z.number().optional().nullable(),
  spec_max: z.number().optional().nullable(),
  check_type: checkTypeSchema.optional(),
  decimal_place: z.number().int().nonnegative().optional().nullable(),
  mandatory: z.boolean().optional(),
  active: z.boolean().optional(),
  remark: z.string().max(500).optional().nullable(),
});

const createItemSchema = baseItemSchema.refine((payload) => payload.test_point || payload.item_name, {
  message: 'test_point or item_name is required',
  path: ['test_point'],
});

const updateItemSchema = baseItemSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'at least one field is required',
  }
);

module.exports = {
  createTemplateSchema,
  updateTemplateSchema,
  createSectionSchema,
  updateSectionSchema,
  createItemSchema,
  updateItemSchema,
};
