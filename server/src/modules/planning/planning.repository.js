const { pool } = require('../../db/pool');

function executor(client) {
  return client || pool;
}

function addFilters(filters = {}) {
  const values = [];
  const where = [];

  if (filters.search) {
    values.push(`%${filters.search}%`);
    where.push(`(
      p.plan_code ILIKE $${values.length}
      OR p.plan_name ILIKE $${values.length}
      OR pl.lot_number ILIKE $${values.length}
      OR pm.model_code ILIKE $${values.length}
      OR pm.product_name ILIKE $${values.length}
    )`);
  }

  if (filters.model_code) {
    values.push(`%${filters.model_code}%`);
    where.push(`pm.model_code ILIKE $${values.length}`);
  }

  if (filters.lot_number) {
    values.push(`%${filters.lot_number}%`);
    where.push(`pl.lot_number ILIKE $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    where.push(`p.plan_status = $${values.length}`);
  }

  if (filters.priority) {
    values.push(filters.priority);
    where.push(`p.priority = $${values.length}`);
  }

  if (filters.date_from) {
    values.push(filters.date_from);
    where.push(`p.planned_end_date >= $${values.length}::date`);
  }

  if (filters.date_to) {
    values.push(filters.date_to);
    where.push(`p.planned_start_date <= $${values.length}::date`);
  }

  return {
    values,
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
  };
}

function planSelectSql() {
  return `
    SELECT
      p.id,
      p.lot_id,
      p.plan_code,
      p.plan_name,
      p.priority,
      p.planned_start_date,
      p.planned_end_date,
      p.planned_start_datetime,
      p.planned_end_datetime,
      p.owner_user_id,
      owner.username AS owner_username,
      owner.full_name AS owner_full_name,
      p.plan_status,
      p.remark,
      p.created_by,
      p.updated_by,
      p.created_at,
      p.updated_at,
      pl.lot_number,
      pl.lot_qty,
      pl.status AS lot_status,
      pl.production_date,
      pm.model_code,
      pm.product_name,
      pm.model_name,
      COALESCE(unit_progress.serial_count, 0)::int AS serial_count,
      COALESCE(qc_progress.started_count, 0)::int AS qc_started_count,
      COALESCE(qc_progress.approved_count, 0)::int AS qc_approved_count,
      COALESCE(qc_progress.qc_status, 'NOT_STARTED') AS qc_status,
      COALESCE(qa_progress.started_count, 0)::int AS qa_started_count,
      COALESCE(qa_progress.approved_count, 0)::int AS qa_approved_count,
      COALESCE(qa_progress.qa_status, 'NOT_STARTED') AS qa_status
    FROM lot_test_plan p
    JOIN production_lot pl ON pl.id = p.lot_id
    JOIN product_model pm ON pm.id = pl.model_id
    LEFT JOIN app_user owner ON owner.id = p.owner_user_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS serial_count
      FROM product_unit pu
      WHERE pu.lot_id = pl.id
    ) unit_progress ON true
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE latest.status IS NOT NULL)::int AS started_count,
        COUNT(*) FILTER (WHERE latest.status = 'APPROVED')::int AS approved_count,
        CASE
          WHEN COUNT(*) FILTER (WHERE latest.status IS NOT NULL) = 0 THEN 'NOT_STARTED'
          WHEN COUNT(*) FILTER (WHERE latest.status = 'APPROVED') = COUNT(*) THEN 'APPROVED'
          WHEN COUNT(*) FILTER (WHERE latest.status = 'EDIT_REQUESTED') > 0 THEN 'EDIT_REQUESTED'
          WHEN COUNT(*) FILTER (WHERE latest.status = 'REJECTED') > 0 THEN 'REJECTED'
          WHEN COUNT(*) FILTER (WHERE latest.status = 'REVIEWED') > 0 THEN 'REVIEWED'
          WHEN COUNT(*) FILTER (WHERE latest.status = 'SUBMITTED') > 0 THEN 'SUBMITTED'
          WHEN COUNT(*) FILTER (WHERE latest.status = 'DRAFT') > 0 THEN 'DRAFT'
          ELSE 'IN_PROGRESS'
        END AS qc_status
      FROM product_unit pu
      LEFT JOIN LATERAL (
        SELECT ih.status
        FROM inspection_header ih
        WHERE ih.product_unit_id = pu.id
        ORDER BY ih.updated_at DESC NULLS LAST, ih.id DESC
        LIMIT 1
      ) latest ON true
      WHERE pu.lot_id = pl.id
    ) qc_progress ON true
    LEFT JOIN LATERAL (
      SELECT
        latest_sampling.status AS qa_status,
        COALESCE(all_samples.started_count, 0)::int AS started_count,
        CASE
          WHEN latest_sampling.status = 'APPROVED'
            THEN COALESCE(all_samples.started_count, 0)
          ELSE 0
        END::int AS approved_count
      FROM (
        SELECT
          qsh.id,
          qsh.status
        FROM qa_sampling_header qsh
        WHERE qsh.lot_id = pl.id
        ORDER BY qsh.updated_at DESC NULLS LAST, qsh.id DESC
        LIMIT 1
      ) latest_sampling
      CROSS JOIN LATERAL (
        SELECT COUNT(DISTINCT qsu.product_unit_id)::int AS started_count
        FROM qa_sampling_header qsh
        JOIN qa_sample_unit qsu ON qsu.qa_sampling_id = qsh.id
        WHERE qsh.lot_id = pl.id
      ) all_samples
    ) qa_progress ON true
  `;
}

function planGroupSql() {
  return `
    GROUP BY
      p.id,
      pl.id,
      pm.id,
      owner.id,
      unit_progress.serial_count,
      qc_progress.started_count,
      qc_progress.approved_count,
      qc_progress.qc_status,
      qa_progress.started_count,
      qa_progress.approved_count,
      qa_progress.qa_status
  `;
}

async function findPlans(filters = {}) {
  const { values, whereSql } = addFilters(filters);
  const result = await pool.query(
    `
      ${planSelectSql()}
      ${whereSql}
      ${planGroupSql()}
      ORDER BY p.planned_start_datetime ASC, p.priority DESC, p.id DESC
    `,
    values
  );

  return result.rows;
}

async function findPlanById(id, client) {
  const db = executor(client);
  const result = await db.query(
    `
      ${planSelectSql()}
      WHERE p.id = $1
      ${planGroupSql()}
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findPlanByLotId(lotId, client) {
  const db = executor(client);
  const result = await db.query(
    `
      SELECT id, lot_id, plan_code
      FROM lot_test_plan
      WHERE lot_id = $1
    `,
    [lotId]
  );

  return result.rows[0] || null;
}

async function findLotById(lotId, client) {
  const db = executor(client);
  const result = await db.query(
    `
      SELECT
        pl.id,
        pl.lot_number,
        pl.lot_qty,
        pl.production_date,
        pl.status,
        pm.model_code,
        pm.product_name
      FROM production_lot pl
      JOIN product_model pm ON pm.id = pl.model_id
      WHERE pl.id = $1
    `,
    [lotId]
  );

  return result.rows[0] || null;
}

async function nextPlanCode(client) {
  const db = executor(client);
  const result = await db.query(`
    SELECT COALESCE(MAX(id), 0) + 1 AS next_id
    FROM lot_test_plan
  `);

  return `PLAN-${String(result.rows[0].next_id).padStart(5, '0')}`;
}

async function createPlan(payload, client) {
  const db = executor(client);
  const result = await db.query(
    `
      INSERT INTO lot_test_plan (
        lot_id,
        plan_code,
        plan_name,
        priority,
        planned_start_date,
        planned_end_date,
        planned_start_datetime,
        planned_end_datetime,
        owner_user_id,
        plan_status,
        remark,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `,
    [
      payload.lot_id,
      payload.plan_code,
      payload.plan_name,
      payload.priority,
      payload.planned_start_date,
      payload.planned_end_date,
      payload.planned_start_datetime,
      payload.planned_end_datetime,
      payload.owner_user_id || null,
      payload.plan_status,
      payload.remark || null,
      payload.user_id,
    ]
  );

  return result.rows[0];
}

async function updatePlan(id, payload, userId) {
  const fields = [];
  const values = [];
  const fieldMap = {
    plan_name: 'plan_name',
    priority: 'priority',
    planned_start_date: 'planned_start_date',
    planned_end_date: 'planned_end_date',
    planned_start_datetime: 'planned_start_datetime',
    planned_end_datetime: 'planned_end_datetime',
    owner_user_id: 'owner_user_id',
    plan_status: 'plan_status',
    remark: 'remark',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      values.push(payload[key]);
      fields.push(`${column} = $${values.length}`);
    }
  }

  values.push(userId);
  fields.push(`updated_by = $${values.length}`);
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const result = await pool.query(
    `
      UPDATE lot_test_plan
      SET ${fields.join(', ')}
      WHERE id = $${values.length}
      RETURNING id
    `,
    values
  );

  return result.rows[0] || null;
}

async function deletePlan(id) {
  const result = await pool.query(
    `
      DELETE FROM lot_test_plan
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findTasksByPlanId(planId, client) {
  const db = executor(client);
  const result = await db.query(
    `
      SELECT
        t.id,
        t.plan_id,
        t.task_type,
        t.task_name,
        t.assigned_user_id,
        assignee.username AS assigned_username,
        assignee.full_name AS assigned_full_name,
        t.planned_start_datetime,
        t.planned_end_datetime,
        t.task_status,
        t.source_type,
        t.source_id,
        t.sort_order,
        t.remark,
        t.created_at,
        t.updated_at
      FROM lot_test_plan_task t
      LEFT JOIN app_user assignee ON assignee.id = t.assigned_user_id
      WHERE t.plan_id = $1
      ORDER BY t.sort_order ASC, t.planned_start_datetime ASC NULLS LAST, t.id ASC
    `,
    [planId]
  );

  return result.rows;
}

async function findTaskById(taskId, client) {
  const db = executor(client);
  const result = await db.query(
    `
      SELECT id, plan_id
      FROM lot_test_plan_task
      WHERE id = $1
    `,
    [taskId]
  );

  return result.rows[0] || null;
}

async function findTaskByPlanAndType(planId, taskType, client) {
  const db = executor(client);
  const result = await db.query(
    `
      SELECT id, plan_id, task_type, task_name
      FROM lot_test_plan_task
      WHERE plan_id = $1
        AND task_type = $2
      ORDER BY id ASC
      LIMIT 1
    `,
    [planId, taskType]
  );

  return result.rows[0] || null;
}

async function createTask(planId, payload, client) {
  const db = executor(client);
  const result = await db.query(
    `
      INSERT INTO lot_test_plan_task (
        plan_id,
        task_type,
        task_name,
        assigned_user_id,
        planned_start_datetime,
        planned_end_datetime,
        task_status,
        source_type,
        source_id,
        sort_order,
        remark,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 0), $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `,
    [
      planId,
      payload.task_type,
      payload.task_name,
      payload.assigned_user_id || null,
      payload.planned_start_datetime || null,
      payload.planned_end_datetime || null,
      payload.task_status || 'PLANNED',
      payload.source_type || null,
      payload.source_id || null,
      payload.sort_order,
      payload.remark || null,
    ]
  );

  return result.rows[0];
}

async function updateTask(taskId, payload) {
  const fields = [];
  const values = [];
  const fieldMap = {
    task_type: 'task_type',
    task_name: 'task_name',
    assigned_user_id: 'assigned_user_id',
    planned_start_datetime: 'planned_start_datetime',
    planned_end_datetime: 'planned_end_datetime',
    task_status: 'task_status',
    source_type: 'source_type',
    source_id: 'source_id',
    sort_order: 'sort_order',
    remark: 'remark',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      values.push(payload[key]);
      fields.push(`${column} = $${values.length}`);
    }
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(taskId);

  const result = await pool.query(
    `
      UPDATE lot_test_plan_task
      SET ${fields.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, plan_id
    `,
    values
  );

  return result.rows[0] || null;
}

async function deleteTask(taskId) {
  const result = await pool.query(
    `
      DELETE FROM lot_test_plan_task
      WHERE id = $1
      RETURNING id, plan_id
    `,
    [taskId]
  );

  return result.rows[0] || null;
}

module.exports = {
  findPlans,
  findPlanById,
  findPlanByLotId,
  findLotById,
  nextPlanCode,
  createPlan,
  updatePlan,
  deletePlan,
  findTasksByPlanId,
  findTaskById,
  findTaskByPlanAndType,
  createTask,
  updateTask,
  deleteTask,
};
