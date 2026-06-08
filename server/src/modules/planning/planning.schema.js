const { z } = require('zod');

const nullablePositiveInt = z.number().int().positive().optional().nullable();

const prioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
const planStatusSchema = z.enum(['PLANNED', 'IN_PROGRESS', 'WAITING_REVIEW', 'COMPLETED', 'CANCELLED']);
const taskTypeSchema = z.enum([
  'LOT_CREATED',
  'QC_INSPECTION',
  'QC_REVIEW',
  'QC_APPROVE',
  'QA_SAMPLING',
  'QA_REVIEW',
  'QA_APPROVE',
  'REPORT_READY',
  'CUSTOM',
]);
const taskStatusSchema = z.enum(['PLANNED', 'IN_PROGRESS', 'WAITING_REVIEW', 'COMPLETED', 'CANCELLED']);
const sourceTypeSchema = z.enum(['QC', 'QA', 'REPORT', 'LOT']).optional().nullable();

function dateRangeRefine(payload) {
  return !payload.planned_start_date || !payload.planned_end_date || payload.planned_end_date >= payload.planned_start_date;
}

function datetimeRangeRefine(payload) {
  return !payload.planned_start_datetime
    || !payload.planned_end_datetime
    || new Date(payload.planned_end_datetime).getTime() > new Date(payload.planned_start_datetime).getTime();
}

const planningQuerySchema = z.object({
  search: z.string().max(100).optional(),
  model_code: z.string().max(100).optional(),
  lot_number: z.string().max(100).optional(),
  status: planStatusSchema.optional(),
  priority: prioritySchema.optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const createPlanSchema = z
  .object({
    lot_id: z.number().int().positive(),
    plan_code: z.string().max(50).optional().nullable(),
    plan_name: z.string().min(2).max(200),
    priority: prioritySchema.default('NORMAL'),
    planned_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    planned_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    planned_start_datetime: z.string().datetime({ offset: true }).optional(),
    planned_end_datetime: z.string().datetime({ offset: true }).optional(),
    owner_user_id: nullablePositiveInt,
    plan_status: planStatusSchema.default('PLANNED'),
    remark: z.string().max(1000).optional().nullable(),
    create_default_tasks: z.boolean().default(true),
  })
  .refine((payload) => (
    (payload.planned_start_datetime && payload.planned_end_datetime)
    || (payload.planned_start_date && payload.planned_end_date)
  ), {
    path: ['planned_start_datetime'],
    message: 'planned start and end datetime are required',
  })
  .refine(dateRangeRefine, {
    path: ['planned_end_date'],
    message: 'planned_end_date must be greater than or equal to planned_start_date',
  })
  .refine(datetimeRangeRefine, {
    path: ['planned_end_datetime'],
    message: 'planned_end_datetime must be greater than planned_start_datetime',
  });

const updatePlanSchema = z
  .object({
    plan_name: z.string().min(2).max(200).optional(),
    priority: prioritySchema.optional(),
    planned_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    planned_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    planned_start_datetime: z.string().datetime({ offset: true }).optional(),
    planned_end_datetime: z.string().datetime({ offset: true }).optional(),
    owner_user_id: nullablePositiveInt,
    plan_status: planStatusSchema.optional(),
    remark: z.string().max(1000).optional().nullable(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'at least one field is required',
  })
  .refine(dateRangeRefine, {
    path: ['planned_end_date'],
    message: 'planned_end_date must be greater than or equal to planned_start_date',
  })
  .refine(datetimeRangeRefine, {
    path: ['planned_end_datetime'],
    message: 'planned_end_datetime must be greater than planned_start_datetime',
  });

const taskBaseSchema = z.object({
    task_type: taskTypeSchema,
    task_name: z.string().min(2).max(200),
    assigned_user_id: nullablePositiveInt,
    planned_start_datetime: z.string().datetime({ offset: true }).optional().nullable(),
    planned_end_datetime: z.string().datetime({ offset: true }).optional().nullable(),
    task_status: taskStatusSchema.default('PLANNED'),
    source_type: sourceTypeSchema,
    source_id: z.number().int().positive().optional().nullable(),
    sort_order: z.number().int().min(0).optional(),
    remark: z.string().max(1000).optional().nullable(),
  });

const createTaskSchema = taskBaseSchema
  .refine(datetimeRangeRefine, {
    path: ['planned_end_datetime'],
    message: 'planned_end_datetime must be greater than planned_start_datetime',
  });

const updateTaskSchema = taskBaseSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'at least one field is required',
  })
  .refine(datetimeRangeRefine, {
    path: ['planned_end_datetime'],
    message: 'planned_end_datetime must be greater than planned_start_datetime',
  });

module.exports = {
  planningQuerySchema,
  createPlanSchema,
  updatePlanSchema,
  createTaskSchema,
  updateTaskSchema,
};
