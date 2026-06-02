const { pool } = require('../../db/pool');

function whereClauses(filters, values, config) {
  const where = [];

  if (filters.search) {
    values.push(`%${filters.search}%`);
    where.push(config.search(values.length));
  }

  if (typeof filters.active === 'boolean') {
    values.push(filters.active);
    where.push(`${config.activeAlias || ''}active = $${values.length}`);
  }

  return where.length ? `WHERE ${where.join(' AND ')}` : '';
}

async function findCategoryById(id) {
  const result = await pool.query(
    `
      SELECT id, category_code, category_name, description, active, created_at, updated_at
      FROM product_category
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findCategoryByCode(categoryCode, excludeId) {
  const values = [categoryCode];
  let excludeSql = '';

  if (excludeId) {
    values.push(excludeId);
    excludeSql = `AND id <> $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT id, category_code
      FROM product_category
      WHERE category_code = $1
      ${excludeSql}
    `,
    values
  );

  return result.rows[0] || null;
}

async function findCategories({ search, active } = {}) {
  const values = [];
  const whereSql = whereClauses({ search, active }, values, {
    search: (index) => `(category_code ILIKE $${index} OR category_name ILIKE $${index})`,
  });

  const result = await pool.query(
    `
      SELECT id, category_code, category_name, description, active, created_at, updated_at
      FROM product_category
      ${whereSql}
      ORDER BY category_code ASC
    `,
    values
  );

  return result.rows;
}

async function createCategory(payload) {
  const result = await pool.query(
    `
      INSERT INTO product_category (category_code, category_name, description, active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, category_code, category_name, description, active, created_at, updated_at
    `,
    [
      payload.category_code,
      payload.category_name,
      payload.description || null,
      payload.active ?? true,
    ]
  );

  return result.rows[0];
}

async function updateCategory(id, payload) {
  const fields = [];
  const values = [];
  const fieldMap = {
    category_code: 'category_code',
    category_name: 'category_name',
    description: 'description',
    active: 'active',
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
      UPDATE product_category
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id, category_code, category_name, description, active, created_at, updated_at
    `,
    values
  );

  return result.rows[0] || null;
}

async function findSubCategoryById(id) {
  const result = await pool.query(
    `
      SELECT
        sc.id, sc.category_id, c.category_code, c.category_name,
        sc.sub_category_code, sc.sub_category_name,
        sc.description, sc.active, sc.created_at, sc.updated_at
      FROM product_sub_category sc
      JOIN product_category c ON c.id = sc.category_id
      WHERE sc.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findSubCategoryByCode(subCategoryCode, excludeId) {
  const values = [subCategoryCode];
  let excludeSql = '';

  if (excludeId) {
    values.push(excludeId);
    excludeSql = `AND id <> $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT id, sub_category_code
      FROM product_sub_category
      WHERE sub_category_code = $1
      ${excludeSql}
    `,
    values
  );

  return result.rows[0] || null;
}

async function findSubCategories({ search, active, categoryId } = {}) {
  const values = [];
  const where = [];

  if (search) {
    values.push(`%${search}%`);
    where.push(`(sc.sub_category_code ILIKE $${values.length} OR sc.sub_category_name ILIKE $${values.length})`);
  }

  if (typeof active === 'boolean') {
    values.push(active);
    where.push(`sc.active = $${values.length}`);
  }

  if (categoryId) {
    values.push(categoryId);
    where.push(`sc.category_id = $${values.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        sc.id, sc.category_id, c.category_code, c.category_name,
        sc.sub_category_code, sc.sub_category_name,
        sc.description, sc.active, sc.created_at, sc.updated_at
      FROM product_sub_category sc
      JOIN product_category c ON c.id = sc.category_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY c.category_code ASC, sc.sub_category_code ASC
    `,
    values
  );

  return result.rows;
}

async function createSubCategory(payload) {
  const result = await pool.query(
    `
      INSERT INTO product_sub_category (
        category_id, sub_category_code, sub_category_name, description, active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, category_id, sub_category_code, sub_category_name, description, active, created_at, updated_at
    `,
    [
      payload.category_id,
      payload.sub_category_code,
      payload.sub_category_name,
      payload.description || null,
      payload.active ?? true,
    ]
  );

  return findSubCategoryById(result.rows[0].id);
}

async function updateSubCategory(id, payload) {
  const fields = [];
  const values = [];
  const fieldMap = {
    category_id: 'category_id',
    sub_category_code: 'sub_category_code',
    sub_category_name: 'sub_category_name',
    description: 'description',
    active: 'active',
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
      UPDATE product_sub_category
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id
    `,
    values
  );

  return result.rows[0] ? findSubCategoryById(id) : null;
}

async function findModelById(id) {
  const result = await pool.query(
    `
      SELECT
        m.id, m.sub_category_id, sc.sub_category_code, sc.sub_category_name,
        sc.category_id, c.category_code, c.category_name,
        m.model_code, m.product_name, m.model_name,
        m.description, m.active, m.created_at, m.updated_at
      FROM product_model m
      JOIN product_sub_category sc ON sc.id = m.sub_category_id
      JOIN product_category c ON c.id = sc.category_id
      WHERE m.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findModelByCode(modelCode, excludeId) {
  const values = [modelCode];
  let excludeSql = '';

  if (excludeId) {
    values.push(excludeId);
    excludeSql = `AND id <> $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT id, model_code
      FROM product_model
      WHERE model_code = $1
      ${excludeSql}
    `,
    values
  );

  return result.rows[0] || null;
}

async function findModels({ search, active, subCategoryId } = {}) {
  const values = [];
  const where = [];

  if (search) {
    values.push(`%${search}%`);
    where.push(`(m.model_code ILIKE $${values.length} OR m.product_name ILIKE $${values.length} OR m.model_name ILIKE $${values.length})`);
  }

  if (typeof active === 'boolean') {
    values.push(active);
    where.push(`m.active = $${values.length}`);
  }

  if (subCategoryId) {
    values.push(subCategoryId);
    where.push(`m.sub_category_id = $${values.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        m.id, m.sub_category_id, sc.sub_category_code, sc.sub_category_name,
        sc.category_id, c.category_code, c.category_name,
        m.model_code, m.product_name, m.model_name,
        m.description, m.active, m.created_at, m.updated_at
      FROM product_model m
      JOIN product_sub_category sc ON sc.id = m.sub_category_id
      JOIN product_category c ON c.id = sc.category_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY m.model_code ASC
    `,
    values
  );

  return result.rows;
}

async function createModel(payload) {
  const result = await pool.query(
    `
      INSERT INTO product_model (
        sub_category_id, model_code, product_name, model_name, description, active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `,
    [
      payload.sub_category_id,
      payload.model_code,
      payload.product_name,
      payload.model_name || null,
      payload.description || null,
      payload.active ?? true,
    ]
  );

  return findModelById(result.rows[0].id);
}

async function updateModel(id, payload) {
  const fields = [];
  const values = [];
  const fieldMap = {
    sub_category_id: 'sub_category_id',
    model_code: 'model_code',
    product_name: 'product_name',
    model_name: 'model_name',
    description: 'description',
    active: 'active',
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
      UPDATE product_model
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id
    `,
    values
  );

  return result.rows[0] ? findModelById(id) : null;
}

async function findModelLookup() {
  const result = await pool.query(
    `
      SELECT id, model_code, product_name, model_name
      FROM product_model
      WHERE active = true
      ORDER BY model_code ASC
    `
  );

  return result.rows;
}

module.exports = {
  findCategoryById,
  findCategoryByCode,
  findCategories,
  createCategory,
  updateCategory,
  findSubCategoryById,
  findSubCategoryByCode,
  findSubCategories,
  createSubCategory,
  updateSubCategory,
  findModelById,
  findModelByCode,
  findModels,
  createModel,
  updateModel,
  findModelLookup,
};
