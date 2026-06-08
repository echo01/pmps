const { z } = require('zod');

const optionalPositiveInt = z.preprocess(
  (value) => (value === undefined || value === null || value === '' ? undefined : value),
  z.coerce.number().int().positive().optional()
);

const itemSchema = z.object({
  template_item_id: z.coerce.number().int().positive(),
  measured_value: z.coerce.number().optional().nullable(),
  measured_text: z.string().max(200).optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
});

const bySerialItemSchema = z
  .object({
    template_item_id: optionalPositiveInt,
    item_code: z.string().trim().min(1).max(100).optional(),
    measured_value: z.coerce.number().optional().nullable(),
    measured_text: z.string().max(200).optional().nullable(),
    remark: z.string().max(500).optional().nullable(),
  })
  .refine(
    (payload) => payload.template_item_id || payload.item_code,
    {
      path: ['item_code'],
      message: 'template_item_id or item_code is required',
    }
  );

function uniqueTemplateItems(payload, ctx) {
  const seen = new Set();

  for (const item of payload.items || []) {
    if (seen.has(item.template_item_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'template_item_id must not be duplicated',
      });
      return;
    }

    seen.add(item.template_item_id);
  }
}

function uniqueBySerialItems(payload, ctx) {
  const seen = new Set();

  for (const item of payload.items || []) {
    const key = item.template_item_id
      ? `id:${item.template_item_id}`
      : `code:${String(item.item_code || '').trim().toUpperCase()}`;

    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'template_item_id or item_code must not be duplicated',
      });
      return;
    }

    seen.add(key);
  }
}

const saveQcInspectionSchema = z
  .object({
    product_unit_id: z.coerce.number().int().positive(),
    template_id: z.coerce.number().int().positive(),
    inspection_no: z.coerce.number().int().positive(),
    station_name: z.string().trim().min(1).max(100),
    equipment_ids: z.array(z.coerce.number().int().positive()),
    items: z.array(itemSchema).min(1),
    remark: z.string().max(1000).optional().nullable(),
  })
  .superRefine(uniqueTemplateItems);

const saveQcInspectionBySerialSchema = z
  .object({
    lot_number: z.string().trim().min(1).max(100),
    serial_number: z.string().trim().min(1).max(100),
    template_id: optionalPositiveInt.nullable(),
    station_name: z.string().trim().min(1).max(100),
    equipment_ids: z.array(z.coerce.number().int().positive()),
    items: z.array(bySerialItemSchema).min(1),
    remark: z.string().max(1000).optional().nullable(),
  })
  .superRefine(uniqueBySerialItems);

const updateQcInspectionSchema = z
  .object({
    station_name: z.string().trim().min(1).max(100).optional(),
    equipment_ids: z.array(z.coerce.number().int().positive()).optional(),
    items: z.array(itemSchema).min(1).optional(),
    remark: z.string().max(1000).optional().nullable(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    path: ['body'],
    message: 'At least one field is required',
  })
  .superRefine((payload, ctx) => {
    if (payload.items) {
      uniqueTemplateItems(payload, ctx);
    }
  });

const workflowRemarkSchema = z.object({
  remark: z.string().max(1000).optional().nullable(),
});

const rejectWorkflowSchema = z.object({
  remark: z.string().trim().min(1).max(1000),
});

const bulkWorkflowSchema = z
  .object({
    action: z.enum(['SUBMIT', 'REVIEW', 'APPROVE']),
    inspection_ids: z.array(z.coerce.number().int().positive()).min(1).optional(),
    lot_id: z.coerce.number().int().positive().optional(),
    remark: z.string().max(1000).optional().nullable(),
  })
  .refine((payload) => Boolean(payload.inspection_ids) !== Boolean(payload.lot_id), {
    path: ['body'],
    message: 'Provide either inspection_ids or lot_id',
  })
  .superRefine((payload, ctx) => {
    if (payload.inspection_ids && new Set(payload.inspection_ids).size !== payload.inspection_ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inspection_ids'],
        message: 'inspection_ids must not be duplicated',
      });
    }
  });

const editRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

const approvedResultEditItemSchema = z
  .object({
    detail_id: z.coerce.number().int().positive(),
    measured_value: z.coerce.number().optional().nullable(),
    measured_text: z.string().max(200).optional().nullable(),
    remark: z.string().max(500).optional().nullable(),
  })
  .refine(
    (payload) => Object.prototype.hasOwnProperty.call(payload, 'measured_value')
      || Object.prototype.hasOwnProperty.call(payload, 'measured_text')
      || Object.prototype.hasOwnProperty.call(payload, 'remark'),
    {
      path: ['body'],
      message: 'At least one editable field is required',
    }
  );

const applyApprovedResultEditSchema = z
  .object({
    reason: z.string().trim().min(1).max(1000),
    items: z.array(approvedResultEditItemSchema).min(1),
  })
  .superRefine((payload, ctx) => {
    const seen = new Set();

    for (const item of payload.items) {
      if (seen.has(item.detail_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items'],
          message: 'detail_id must not be duplicated',
        });
        return;
      }

      seen.add(item.detail_id);
    }
  });

module.exports = {
  saveQcInspectionSchema,
  saveQcInspectionBySerialSchema,
  updateQcInspectionSchema,
  workflowRemarkSchema,
  rejectWorkflowSchema,
  bulkWorkflowSchema,
  editRequestSchema,
  applyApprovedResultEditSchema,
};
