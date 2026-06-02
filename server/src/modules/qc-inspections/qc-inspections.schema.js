const { z } = require('zod');

const itemSchema = z.object({
  template_item_id: z.coerce.number().int().positive(),
  measured_value: z.coerce.number().optional().nullable(),
  measured_text: z.string().max(200).optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
});

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

const saveQcInspectionSchema = z
  .object({
    product_unit_id: z.coerce.number().int().positive(),
    template_id: z.coerce.number().int().positive(),
    inspection_no: z.coerce.number().int().positive(),
    station_name: z.string().trim().min(1).max(100),
    equipment_ids: z.array(z.coerce.number().int().positive()).min(1),
    items: z.array(itemSchema).min(1),
    remark: z.string().max(1000).optional().nullable(),
  })
  .superRefine(uniqueTemplateItems);

const updateQcInspectionSchema = z
  .object({
    station_name: z.string().trim().min(1).max(100).optional(),
    equipment_ids: z.array(z.coerce.number().int().positive()).min(1).optional(),
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

module.exports = {
  saveQcInspectionSchema,
  updateQcInspectionSchema,
  workflowRemarkSchema,
  rejectWorkflowSchema,
};
