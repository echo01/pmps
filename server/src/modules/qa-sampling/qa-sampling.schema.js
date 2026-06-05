const { z } = require('zod');

const itemSchema = z.object({
  template_item_id: z.coerce.number().int().positive(),
  measured_value: z.coerce.number().optional().nullable(),
  measured_text: z.string().max(200).optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
});

const sampleUnitSchema = z.object({
  product_unit_id: z.coerce.number().int().positive(),
  items: z.array(itemSchema).min(1),
  remark: z.string().max(500).optional().nullable(),
});

function validateSampleUnits(payload, ctx) {
  const productUnitIds = new Set();

  for (const [unitIndex, unit] of (payload.sample_units || []).entries()) {
    if (productUnitIds.has(unit.product_unit_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sample_units'],
        message: 'product_unit_id must not be duplicated',
      });
      return;
    }

    productUnitIds.add(unit.product_unit_id);

    const itemIds = new Set();
    for (const item of unit.items) {
      if (itemIds.has(item.template_item_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sample_units', unitIndex, 'items'],
          message: 'template_item_id must not be duplicated in the same sample unit',
        });
        return;
      }

      itemIds.add(item.template_item_id);
    }
  }
}

const saveQaSamplingSchema = z
  .object({
    lot_id: z.coerce.number().int().positive(),
    template_id: z.coerce.number().int().positive(),
    sampling_no: z.coerce.number().int().positive(),
    sampling_method: z.string().trim().max(50).optional().default('MANUAL'),
    station_name: z.string().trim().min(1).max(100),
    equipment_ids: z.array(z.coerce.number().int().positive()),
    sample_units: z.array(sampleUnitSchema).min(1),
    remark: z.string().max(1000).optional().nullable(),
  })
  .superRefine(validateSampleUnits);

const updateQaSamplingSchema = z
  .object({
    sampling_method: z.string().trim().max(50).optional(),
    station_name: z.string().trim().min(1).max(100).optional(),
    equipment_ids: z.array(z.coerce.number().int().positive()).optional(),
    sample_units: z.array(sampleUnitSchema).min(1).optional(),
    remark: z.string().max(1000).optional().nullable(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    path: ['body'],
    message: 'At least one field is required',
  })
  .superRefine((payload, ctx) => {
    if (payload.sample_units) {
      validateSampleUnits(payload, ctx);
    }
  });

const workflowRemarkSchema = z.object({
  remark: z.string().max(1000).optional().nullable(),
});

const rejectWorkflowSchema = z.object({
  remark: z.string().trim().min(1).max(1000),
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
  saveQaSamplingSchema,
  updateQaSamplingSchema,
  workflowRemarkSchema,
  rejectWorkflowSchema,
  editRequestSchema,
  applyApprovedResultEditSchema,
};
