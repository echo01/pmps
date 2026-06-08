const { pool } = require('../../db/pool');

function executor(client) {
  return client || pool;
}

function mapTemplate(row) {
  if (!row) {
    return null;
  }

  const models = row.models || [];

  return {
    ...row,
    models,
    model_ids: models.map((model) => model.id),
    model_codes: models.map((model) => model.model_code),
  };
}

function mapItem(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    item_name: row.test_point,
    unit: row.input_unit || row.source_unit || null,
  };
}

async function findTemplateById(id, client) {
  const result = await executor(client).query(
    `
      SELECT
        t.id, t.model_id, pm.model_code, pm.product_name,
        t.template_type, t.template_name, t.revision, t.revision_note,
        t.effective_from, t.effective_to, t.active,
        t.created_by, t.approved_by, t.approved_at,
        t.created_at, t.updated_at,
        COALESCE(
          jsonb_agg(
            DISTINCT jsonb_build_object(
              'id', mt.id,
              'model_code', mt.model_code,
              'product_name', mt.product_name,
              'is_primary', ttm.is_primary
            )
          ) FILTER (WHERE mt.id IS NOT NULL),
          '[]'::jsonb
        ) AS models
      FROM test_template t
      LEFT JOIN product_model pm ON pm.id = t.model_id
      LEFT JOIN test_template_model ttm ON ttm.template_id = t.id
      LEFT JOIN product_model mt ON mt.id = ttm.model_id
      WHERE t.id = $1
      GROUP BY t.id, pm.id
    `,
    [id]
  );

  return mapTemplate(result.rows[0]);
}

async function findTemplateByIdentity({ templateType, templateName, revision, excludeId }) {
  const values = [templateType, templateName, revision || 'REV.00'];
  let excludeSql = '';

  if (excludeId) {
    values.push(excludeId);
    excludeSql = `AND id <> $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT id
      FROM test_template
      WHERE template_type = $1
        AND template_name = $2
        AND COALESCE(revision, 'REV.00') = $3
      ${excludeSql}
    `,
    values
  );

  return result.rows[0] || null;
}

async function findTemplates({ modelId, templateType, active } = {}) {
  const values = [];
  const where = [];

  if (modelId) {
    values.push(modelId);
    where.push(`EXISTS (
      SELECT 1
      FROM test_template_model ttm_filter
      WHERE ttm_filter.template_id = t.id
        AND ttm_filter.model_id = $${values.length}
    )`);
  }

  if (templateType) {
    values.push(templateType);
    where.push(`t.template_type = $${values.length}`);
  }

  if (typeof active === 'boolean') {
    values.push(active);
    where.push(`t.active = $${values.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        t.id, t.model_id, pm.model_code, pm.product_name,
        t.template_type, t.template_name, t.revision, t.revision_note,
        t.effective_from, t.effective_to, t.active,
        t.created_by, t.approved_by, t.approved_at,
        t.created_at, t.updated_at,
        COALESCE(
          jsonb_agg(
            DISTINCT jsonb_build_object(
              'id', mt.id,
              'model_code', mt.model_code,
              'product_name', mt.product_name,
              'is_primary', ttm.is_primary
            )
          ) FILTER (WHERE mt.id IS NOT NULL),
          '[]'::jsonb
        ) AS models
      FROM test_template t
      LEFT JOIN product_model pm ON pm.id = t.model_id
      LEFT JOIN test_template_model ttm ON ttm.template_id = t.id
      LEFT JOIN product_model mt ON mt.id = ttm.model_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY t.id, pm.id
      ORDER BY t.template_type ASC, t.template_name ASC, t.revision ASC
    `,
    values
  );

  return result.rows.map(mapTemplate);
}

async function createTemplate(payload, userId, client) {
  const result = await executor(client).query(
    `
      INSERT INTO test_template (
        model_id, template_type, template_name, revision, revision_note,
        effective_from, effective_to, active, created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `,
    [
      payload.model_id || null,
      payload.template_type,
      payload.template_name,
      payload.revision || 'REV.00',
      payload.revision_note || null,
      payload.effective_from || null,
      payload.effective_to || null,
      payload.active ?? true,
      userId || null,
    ]
  );

  return findTemplateById(result.rows[0].id, client);
}

async function updateTemplate(id, payload, client) {
  const fields = [];
  const values = [];
  const fieldMap = {
    model_id: 'model_id',
    template_type: 'template_type',
    template_name: 'template_name',
    revision: 'revision',
    revision_note: 'revision_note',
    effective_from: 'effective_from',
    effective_to: 'effective_to',
    active: 'active',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      values.push(payload[key]);
      fields.push(`${column} = $${values.length}`);
    }
  }

  values.push(id);
  const result = await executor(client).query(
    `
      UPDATE test_template
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id
    `,
    values
  );

  return result.rows[0] ? findTemplateById(id, client) : null;
}

async function countTemplateUsage(templateId, client) {
  const result = await executor(client).query(
    `
      SELECT
        (
          SELECT COUNT(*)::int
          FROM inspection_header
          WHERE template_id = $1
        ) AS qc_count,
        (
          SELECT COUNT(*)::int
          FROM qa_sampling_header
          WHERE template_id = $1
        ) AS qa_count
    `,
    [templateId]
  );

  return result.rows[0] || { qc_count: 0, qa_count: 0 };
}

async function deleteTemplateCascade(templateId, client) {
  const db = executor(client);

  await db.query(
    `
      DELETE FROM test_template_model
      WHERE template_id = $1
    `,
    [templateId]
  );

  await db.query(
    `
      DELETE FROM test_template_item
      WHERE template_id = $1
    `,
    [templateId]
  );

  await db.query(
    `
      DELETE FROM test_template_section
      WHERE template_id = $1
    `,
    [templateId]
  );

  const result = await db.query(
    `
      DELETE FROM test_template
      WHERE id = $1
      RETURNING id
    `,
    [templateId]
  );

  return result.rows[0] || null;
}

async function duplicateTemplate(sourceTemplateId, payload, userId, client) {
  const db = executor(client);
  const source = await findTemplateById(sourceTemplateId, client);
  const inserted = await db.query(
    `
      INSERT INTO test_template (
        model_id, template_type, template_name, revision, revision_note,
        effective_from, effective_to, active, created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `,
    [
      payload.copy_models === false ? null : source.model_id,
      source.template_type,
      payload.template_name,
      payload.revision || source.revision || 'REV.00',
      payload.revision_note ?? source.revision_note ?? null,
      payload.effective_from ?? source.effective_from ?? null,
      payload.effective_to ?? source.effective_to ?? null,
      payload.active ?? source.active,
      userId || null,
    ]
  );

  const newTemplateId = inserted.rows[0].id;
  const sectionIdMap = new Map();
  const sections = await db.query(
    `
      SELECT id, seq_no, section_code, section_name
      FROM test_template_section
      WHERE template_id = $1
      ORDER BY seq_no ASC, id ASC
    `,
    [sourceTemplateId]
  );

  for (const section of sections.rows) {
    const copied = await db.query(
      `
        INSERT INTO test_template_section (
          template_id, seq_no, section_code, section_name, updated_at
        )
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING id
      `,
      [newTemplateId, section.seq_no, section.section_code, section.section_name]
    );
    sectionIdMap.set(section.id, copied.rows[0].id);
  }

  const items = await db.query(
    `
      SELECT
        section_id, seq_no, item_code, test_point,
        test_description, channel_name, input_name, input_value, input_unit,
        source_name, source_value, source_unit, expect_value, expect_text,
        spec_min, spec_max, check_type, decimal_place, mandatory, active, remark
      FROM test_template_item
      WHERE template_id = $1
      ORDER BY seq_no ASC, id ASC
    `,
    [sourceTemplateId]
  );

  for (const item of items.rows) {
    await db.query(
      `
        INSERT INTO test_template_item (
          template_id, section_id, seq_no, item_code, test_point,
          test_description, channel_name, input_name, input_value, input_unit,
          source_name, source_value, source_unit, expect_value, expect_text,
          spec_min, spec_max, check_type, decimal_place, mandatory, active, remark, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, CURRENT_TIMESTAMP
        )
      `,
      [
        newTemplateId,
        item.section_id ? sectionIdMap.get(item.section_id) || null : null,
        item.seq_no,
        item.item_code,
        item.test_point,
        item.test_description,
        item.channel_name,
        item.input_name,
        item.input_value,
        item.input_unit,
        item.source_name,
        item.source_value,
        item.source_unit,
        item.expect_value,
        item.expect_text,
        item.spec_min,
        item.spec_max,
        item.check_type,
        item.decimal_place,
        item.mandatory,
        item.active,
        item.remark,
      ]
    );
  }

  if (payload.copy_models !== false) {
    await db.query(
      `
        INSERT INTO test_template_model (template_id, model_id, is_primary)
        SELECT $2, model_id, is_primary
        FROM test_template_model
        WHERE template_id = $1
        ON CONFLICT (template_id, model_id) DO NOTHING
      `,
      [sourceTemplateId, newTemplateId]
    );
  }

  return findTemplateById(newTemplateId, client);
}

async function countModelsByIds(modelIds, client) {
  if (!modelIds.length) {
    return 0;
  }

  const result = await executor(client).query(
    `
      SELECT COUNT(*)::int AS count
      FROM product_model
      WHERE id = ANY($1::int[])
    `,
    [modelIds]
  );

  return result.rows[0]?.count || 0;
}

async function findTemplateModels(templateId, client) {
  const result = await executor(client).query(
    `
      SELECT
        pm.id,
        pm.model_code,
        pm.product_name,
        ttm.is_primary,
        ttm.created_at
      FROM test_template_model ttm
      JOIN product_model pm ON pm.id = ttm.model_id
      WHERE ttm.template_id = $1
      ORDER BY ttm.is_primary DESC, pm.model_code ASC
    `,
    [templateId]
  );

  return result.rows;
}

async function replaceTemplateModels(templateId, modelIds, primaryModelId, client) {
  const db = executor(client);

  await db.query(
    `
      DELETE FROM test_template_model
      WHERE template_id = $1
    `,
    [templateId]
  );

  if (!modelIds.length) {
    return [];
  }

  const values = [];
  const placeholders = modelIds.map((modelId, index) => {
    values.push(templateId, modelId, modelId === primaryModelId);
    const base = index * 3;
    return `($${base + 1}, $${base + 2}, $${base + 3})`;
  });

  await db.query(
    `
      INSERT INTO test_template_model (template_id, model_id, is_primary)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (template_id, model_id) DO UPDATE
      SET is_primary = EXCLUDED.is_primary
    `,
    values
  );

  return findTemplateModels(templateId, client);
}

async function findSectionById(id) {
  const result = await pool.query(
    `
      SELECT id, template_id, seq_no, section_code, section_name, updated_at
      FROM test_template_section
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findSectionsByTemplateId(templateId) {
  const result = await pool.query(
    `
      SELECT id, template_id, seq_no, section_code, section_name, updated_at
      FROM test_template_section
      WHERE template_id = $1
      ORDER BY seq_no ASC, id ASC
    `,
    [templateId]
  );

  return result.rows;
}

async function createSection(templateId, payload) {
  const result = await pool.query(
    `
      INSERT INTO test_template_section (
        template_id, seq_no, section_code, section_name, updated_at
      )
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING id
    `,
    [
      templateId,
      payload.seq_no,
      payload.section_code || null,
      payload.section_name,
    ]
  );

  return findSectionById(result.rows[0].id);
}

async function updateSection(id, payload) {
  const fields = [];
  const values = [];
  const fieldMap = {
    seq_no: 'seq_no',
    section_code: 'section_code',
    section_name: 'section_name',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      values.push(payload[key]);
      fields.push(`${column} = $${values.length}`);
    }
  }

  values.push(id);
  const result = await pool.query(
    `
      UPDATE test_template_section
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id
    `,
    values
  );

  return result.rows[0] ? findSectionById(id) : null;
}

async function deleteSection(id) {
  const result = await pool.query(
    `
      DELETE FROM test_template_section
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findItemById(id) {
  const result = await pool.query(
    `
      SELECT
        id, template_id, section_id, seq_no, item_code, test_point,
        test_description, channel_name, input_name, input_value, input_unit,
        source_name, source_value, source_unit, expect_value, expect_text,
        spec_min, spec_max, check_type, decimal_place, mandatory, active, remark, updated_at
      FROM test_template_item
      WHERE id = $1
    `,
    [id]
  );

  return mapItem(result.rows[0]);
}

async function findRawItemsByTemplateId(templateId) {
  const result = await pool.query(
    `
      SELECT
        i.id, i.template_id, i.section_id,
        s.seq_no AS section_seq_no, s.section_code, s.section_name,
        i.seq_no, i.item_code, i.test_point,
        i.test_description, i.channel_name, i.input_name, i.input_value, i.input_unit,
        i.source_name, i.source_value, i.source_unit, i.expect_value, i.expect_text,
        i.spec_min, i.spec_max, i.check_type, i.decimal_place, i.mandatory, i.active, i.remark, i.updated_at
      FROM test_template_item i
      LEFT JOIN test_template_section s ON s.id = i.section_id
      WHERE i.template_id = $1
      ORDER BY COALESCE(s.seq_no, 999999) ASC, i.seq_no ASC, i.id ASC
    `,
    [templateId]
  );

  return result.rows.map(mapItem);
}

async function createItem(templateId, payload) {
  const testPoint = payload.test_point || payload.item_name;
  const result = await pool.query(
    `
      INSERT INTO test_template_item (
        template_id, section_id, seq_no, item_code, test_point,
        test_description, channel_name, input_name, input_value, input_unit,
        source_name, source_value, source_unit, expect_value, expect_text,
        spec_min, spec_max, check_type, decimal_place, mandatory, active, remark, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, CURRENT_TIMESTAMP
      )
      RETURNING id
    `,
    [
      templateId,
      payload.section_id || null,
      payload.seq_no,
      payload.item_code || null,
      testPoint,
      payload.test_description || null,
      payload.channel_name || null,
      payload.input_name || null,
      payload.input_value ?? null,
      payload.input_unit || null,
      payload.source_name || null,
      payload.source_value ?? null,
      payload.source_unit || null,
      payload.expect_value ?? null,
      payload.expect_text || null,
      payload.spec_min ?? null,
      payload.spec_max ?? null,
      payload.check_type || 'NUMERIC',
      payload.decimal_place ?? null,
      payload.mandatory ?? true,
      payload.active ?? true,
      payload.remark || null,
    ]
  );

  return findItemById(result.rows[0].id);
}

async function updateItem(id, payload) {
  const normalizedPayload = { ...payload };

  if (payload.item_name && !payload.test_point) {
    normalizedPayload.test_point = payload.item_name;
  }

  delete normalizedPayload.item_name;

  const fields = [];
  const values = [];
  const fieldMap = {
    section_id: 'section_id',
    seq_no: 'seq_no',
    item_code: 'item_code',
    test_point: 'test_point',
    test_description: 'test_description',
    channel_name: 'channel_name',
    input_name: 'input_name',
    input_value: 'input_value',
    input_unit: 'input_unit',
    source_name: 'source_name',
    source_value: 'source_value',
    source_unit: 'source_unit',
    expect_value: 'expect_value',
    expect_text: 'expect_text',
    spec_min: 'spec_min',
    spec_max: 'spec_max',
    check_type: 'check_type',
    decimal_place: 'decimal_place',
    mandatory: 'mandatory',
    active: 'active',
    remark: 'remark',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(normalizedPayload, key)) {
      values.push(normalizedPayload[key]);
      fields.push(`${column} = $${values.length}`);
    }
  }

  values.push(id);
  const result = await pool.query(
    `
      UPDATE test_template_item
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id
    `,
    values
  );

  return result.rows[0] ? findItemById(id) : null;
}

async function deleteItem(id) {
  const result = await pool.query(
    `
      DELETE FROM test_template_item
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  findTemplateById,
  findTemplateByIdentity,
  findTemplates,
  createTemplate,
  updateTemplate,
  countTemplateUsage,
  deleteTemplateCascade,
  duplicateTemplate,
  countModelsByIds,
  findTemplateModels,
  replaceTemplateModels,
  findSectionById,
  findSectionsByTemplateId,
  createSection,
  updateSection,
  deleteSection,
  findItemById,
  findRawItemsByTemplateId,
  createItem,
  updateItem,
  deleteItem,
};
