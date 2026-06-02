const { z } = require('zod');

const nullableText = z.string().max(500, 'description must not exceed 500 characters').optional().nullable();

const createCategorySchema = z.object({
  category_code: z.string().min(2).max(50).regex(/^[A-Z0-9_-]+$/),
  category_name: z.string().min(2).max(150),
  description: nullableText,
  active: z.boolean().optional(),
});

const updateCategorySchema = z.object({
  category_code: z.string().min(2).max(50).regex(/^[A-Z0-9_-]+$/).optional(),
  category_name: z.string().min(2).max(150).optional(),
  description: nullableText,
  active: z.boolean().optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'at least one field is required',
});

const createSubCategorySchema = z.object({
  category_id: z.number().int().positive(),
  sub_category_code: z.string().min(2).max(50).regex(/^[A-Z0-9_-]+$/),
  sub_category_name: z.string().min(2).max(150),
  description: nullableText,
  active: z.boolean().optional(),
});

const updateSubCategorySchema = z.object({
  category_id: z.number().int().positive().optional(),
  sub_category_code: z.string().min(2).max(50).regex(/^[A-Z0-9_-]+$/).optional(),
  sub_category_name: z.string().min(2).max(150).optional(),
  description: nullableText,
  active: z.boolean().optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'at least one field is required',
});

const createModelSchema = z.object({
  sub_category_id: z.number().int().positive(),
  model_code: z.string().min(2).max(100).regex(/^[A-Z0-9_.-]+$/),
  product_name: z.string().min(2).max(200),
  model_name: z.string().max(200).optional().nullable(),
  description: nullableText,
  active: z.boolean().optional(),
});

const updateModelSchema = z.object({
  sub_category_id: z.number().int().positive().optional(),
  model_code: z.string().min(2).max(100).regex(/^[A-Z0-9_.-]+$/).optional(),
  product_name: z.string().min(2).max(200).optional(),
  model_name: z.string().max(200).optional().nullable(),
  description: nullableText,
  active: z.boolean().optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'at least one field is required',
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  createSubCategorySchema,
  updateSubCategorySchema,
  createModelSchema,
  updateModelSchema,
};
