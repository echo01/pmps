const { pool } = require('../../db/pool');

function executor(client) {
  return client || pool;
}

function buildLotWhere(filters = {}, values = []) {
  const where = [];

  if (filters.search) {
    values.push(`%${filters.search}%`);
    where.push(`(
      pl.lot_number ILIKE $${values.length}
      OR pm.model_code ILIKE $${values.length}
      OR pm.product_name ILIKE $${values.length}
      OR COALESCE(pm.model_name, '') ILIKE $${values.length}
    )`);
  }

  if (filters.model_code) {
    values.push(`%${filters.model_code}%`);
    where.push(`pm.model_code ILIKE $${values.length}`);
  }

  if (filters.date_from) {
    values.push(filters.date_from);
    where.push(`pl.production_date >= $${values.length}`);
  }

  if (filters.date_to) {
    values.push(filters.date_to);
    where.push(`pl.production_date <= $${values.length}`);
  }

  if (filters.production_date) {
    values.push(filters.production_date);
    where.push(`pl.production_date = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    where.push(`pl.status = $${values.length}`);
  }

  if (filters.lot_number) {
    values.push(`%${filters.lot_number}%`);
    where.push(`pl.lot_number ILIKE $${values.length}`);
  }

  return where.length ? `WHERE ${where.join(' AND ')}` : '';
}

function lotSelectSql() {
  return `
    SELECT
      pl.id,
      pl.model_id,
      pm.model_code,
      pm.product_name,
      pm.model_name,
      pl.lot_number,
      pl.production_date,
      pl.lot_qty,
      pl.status,
      pl.remark,
      pl.created_at,
      pl.updated_at,
      COUNT(pu.id)::int AS serial_count
    FROM production_lot pl
    JOIN product_model pm ON pm.id = pl.model_id
    LEFT JOIN product_unit pu ON pu.lot_id = pl.id
  `;
}

async function findLots({ filters = {}, limit, offset }) {
  const values = [];
  const whereSql = buildLotWhere(filters, values);

  values.push(limit);
  const limitIndex = values.length;
  values.push(offset);

  const result = await pool.query(
    `
      ${lotSelectSql()}
      ${whereSql}
      GROUP BY pl.id, pm.id
      ORDER BY pl.production_date DESC NULLS LAST, pl.created_at DESC, pl.id DESC
      LIMIT $${limitIndex} OFFSET $${values.length}
    `,
    values
  );

  return result.rows;
}

async function countLots(filters = {}) {
  const values = [];
  const whereSql = buildLotWhere(filters, values);

  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM production_lot pl
      JOIN product_model pm ON pm.id = pl.model_id
      ${whereSql}
    `,
    values
  );

  return result.rows[0].total;
}

async function findLotById(id, client) {
  const result = await executor(client).query(
    `
      ${lotSelectSql()}
      WHERE pl.id = $1
      GROUP BY pl.id, pm.id
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findLotByModelAndLotNumber(modelId, lotNumber) {
  const result = await pool.query(
    `
      SELECT id, model_id, lot_number
      FROM production_lot
      WHERE model_id = $1
        AND lot_number = $2
    `,
    [modelId, lotNumber]
  );

  return result.rows[0] || null;
}

async function createLot(payload, client) {
  const result = await executor(client).query(
    `
      WITH inserted AS (
        INSERT INTO production_lot (
          model_id, lot_number, production_date, lot_qty, status, remark, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      )
      SELECT
        inserted.id,
        inserted.model_id,
        pm.model_code,
        pm.product_name,
        pm.model_name,
        inserted.lot_number,
        inserted.production_date,
        inserted.lot_qty,
        inserted.status,
        inserted.remark,
        inserted.created_at,
        inserted.updated_at,
        0::int AS serial_count
      FROM inserted
      JOIN product_model pm ON pm.id = inserted.model_id
    `,
    [
      payload.model_id,
      payload.lot_number,
      payload.production_date || null,
      payload.lot_qty,
      payload.status || 'OPEN',
      payload.remark || null,
    ]
  );

  return result.rows[0];
}

async function updateLot(id, payload, client) {
  const fields = [];
  const values = [];
  const fieldMap = {
    production_date: 'production_date',
    remark: 'remark',
    status: 'status',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      values.push(payload[key]);
      fields.push(`${column} = $${values.length}`);
    }
  }

  values.push(id);

  if (!fields.length) {
    return findLotById(id, client);
  }

  const result = await executor(client).query(
    `
      UPDATE production_lot
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id
    `,
    values
  );

  return result.rows[0] ? findLotById(id, client) : null;
}

async function findSerialsByLotId(lotId) {
  const result = await pool.query(
    `
      SELECT
        id,
        model_id,
        lot_id,
        serial_number,
        product_status AS unit_status,
        created_at,
        updated_at
      FROM product_unit
      WHERE lot_id = $1
      ORDER BY serial_number ASC
    `,
    [lotId]
  );

  return result.rows;
}

async function findExistingSerialsByModelId(modelId, serialNumbers) {
  if (!serialNumbers.length) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT serial_number
      FROM product_unit
      WHERE model_id = $1
        AND serial_number = ANY($2::text[])
    `,
    [modelId, serialNumbers]
  );

  return result.rows.map((row) => row.serial_number);
}

async function insertProductUnits({ lotId, modelId, serialNumbers }, client) {
  if (!serialNumbers.length) {
    return [];
  }

  const result = await executor(client).query(
    `
      INSERT INTO product_unit (
        model_id, lot_id, serial_number, product_status, created_at, updated_at
      )
      SELECT $1, $2, serial_number, 'CREATED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM unnest($3::text[]) AS serial_number
      RETURNING
        id,
        model_id,
        lot_id,
        serial_number,
        product_status AS unit_status,
        created_at,
        updated_at
    `,
    [modelId, lotId, serialNumbers]
  );

  return result.rows;
}

async function updateLotQty(lotId, lotQty, client) {
  await executor(client).query(
    `
      UPDATE production_lot
      SET lot_qty = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [lotId, lotQty]
  );
}

async function findUnitsForRemoval(lotId, count, client) {
  const result = await executor(client).query(
    `
      SELECT pu.id, pu.serial_number
      FROM product_unit pu
      WHERE pu.lot_id = $1
      ORDER BY
        CASE
          WHEN EXISTS (
            SELECT 1 FROM inspection_header ih WHERE ih.product_unit_id = pu.id
          ) OR EXISTS (
            SELECT 1 FROM qa_sample_unit qsu WHERE qsu.product_unit_id = pu.id
          )
          THEN 1
          ELSE 0
        END ASC,
        pu.id DESC
      LIMIT $2
    `,
    [lotId, count]
  );

  return result.rows;
}

async function deleteUnitWorkflowData(unitIds, client) {
  if (!unitIds.length) {
    return;
  }

  const db = executor(client);

  await db.query(
    `
      DELETE FROM result_edit_audit_log
      WHERE (
        source_type = 'QC'
        AND source_id IN (
          SELECT id FROM inspection_header WHERE product_unit_id = ANY($1::int[])
        )
      ) OR (
        source_type = 'QA'
        AND detail_id IN (
          SELECT qsd.id
          FROM qa_sample_detail qsd
          JOIN qa_sample_unit qsu ON qsu.id = qsd.qa_sample_unit_id
          WHERE qsu.product_unit_id = ANY($1::int[])
        )
      )
    `,
    [unitIds]
  );

  await db.query(
    `
      DELETE FROM qa_sample_unit
      WHERE product_unit_id = ANY($1::int[])
    `,
    [unitIds]
  );

  await db.query(
    `
      DELETE FROM product_unit
      WHERE id = ANY($1::int[])
    `,
    [unitIds]
  );
}

async function recalculateQaSamplingForLot(lotId, lotQty, client) {
  await executor(client).query(
    `
      WITH summary AS (
        SELECT
          qsh.id,
          COUNT(qsu.id)::int AS sample_count,
          COUNT(*) FILTER (WHERE qsu.unit_result = 'PASS')::int AS pass_count,
          COUNT(*) FILTER (WHERE qsu.unit_result = 'FAIL')::int AS fail_count,
          COUNT(*) FILTER (
            WHERE qsu.id IS NOT NULL
              AND COALESCE(qsu.unit_result, 'N/A') NOT IN ('PASS', 'FAIL')
          )::int AS incomplete_count
        FROM qa_sampling_header qsh
        LEFT JOIN qa_sample_unit qsu ON qsu.qa_sampling_id = qsh.id
        WHERE qsh.lot_id = $1
        GROUP BY qsh.id
      )
      UPDATE qa_sampling_header qsh
      SET
        lot_qty = $2::int,
        sample_qty = summary.sample_count,
        accept_qty = summary.pass_count,
        reject_qty = summary.fail_count,
        overall_result = CASE
          WHEN summary.sample_count = 0 OR summary.incomplete_count > 0 THEN 'N/A'
          WHEN summary.fail_count > 0 THEN 'FAIL'
          ELSE 'PASS'
        END,
        status = CASE
          WHEN summary.sample_count < GREATEST(1, CEIL($2::int * 0.10)::int) THEN 'DRAFT'
          ELSE qsh.status
        END,
        qa_reviewer_user_id = CASE
          WHEN summary.sample_count < GREATEST(1, CEIL($2::int * 0.10)::int) THEN NULL
          ELSE qsh.qa_reviewer_user_id
        END,
        qa_approver_user_id = CASE
          WHEN summary.sample_count < GREATEST(1, CEIL($2::int * 0.10)::int) THEN NULL
          ELSE qsh.qa_approver_user_id
        END,
        reviewed_at = CASE
          WHEN summary.sample_count < GREATEST(1, CEIL($2::int * 0.10)::int) THEN NULL
          ELSE qsh.reviewed_at
        END,
        approved_at = CASE
          WHEN summary.sample_count < GREATEST(1, CEIL($2::int * 0.10)::int) THEN NULL
          ELSE qsh.approved_at
        END,
        updated_at = CURRENT_TIMESTAMP
      FROM summary
      WHERE qsh.id = summary.id
    `,
    [lotId, lotQty]
  );
}

async function syncLotWorkflow(lotId, client) {
  await executor(client).query(
    `SELECT sync_lot_workflow_completion($1)`,
    [lotId]
  );
}

async function deleteLotGraph(lotId, client) {
  const db = executor(client);

  await db.query(
    `
      DELETE FROM result_edit_audit_log
      WHERE (
        source_type = 'QC'
        AND source_id IN (
          SELECT ih.id
          FROM inspection_header ih
          JOIN product_unit pu ON pu.id = ih.product_unit_id
          WHERE pu.lot_id = $1
        )
      ) OR (
        source_type = 'QA'
        AND source_id IN (
          SELECT id FROM qa_sampling_header WHERE lot_id = $1
        )
      )
    `,
    [lotId]
  );

  await db.query(`DELETE FROM qa_sampling_header WHERE lot_id = $1`, [lotId]);
  await db.query(`DELETE FROM product_unit WHERE lot_id = $1`, [lotId]);

  const result = await db.query(
    `DELETE FROM production_lot WHERE id = $1 RETURNING id, lot_number`,
    [lotId]
  );

  return result.rows[0] || null;
}

async function findEcnByIds(ecnIds) {
  if (!ecnIds.length) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT id, ecn_no, ecn_title, revision
      FROM ecn_master
      WHERE id = ANY($1::int[])
    `,
    [ecnIds]
  );

  return result.rows;
}

async function deleteLotEcnRefs(lotId, client) {
  await executor(client).query(
    `
      DELETE FROM lot_ecn_ref
      WHERE lot_id = $1
    `,
    [lotId]
  );
}

async function insertLotEcnRefs(lotId, ecnIds, client) {
  if (!ecnIds.length) {
    return [];
  }

  const result = await executor(client).query(
    `
      INSERT INTO lot_ecn_ref (lot_id, ecn_id, created_at)
      SELECT $1, ecn_id, CURRENT_TIMESTAMP
      FROM unnest($2::int[]) AS ecn_id
      RETURNING id, lot_id, ecn_id, created_at
    `,
    [lotId, ecnIds]
  );

  return result.rows;
}

async function findLotEcnRefs(lotId, client) {
  const result = await executor(client).query(
    `
      SELECT
        ler.id,
        ler.lot_id,
        ler.ecn_id,
        em.ecn_no,
        em.ecn_title,
        em.revision,
        ler.applied_note,
        ler.created_at
      FROM lot_ecn_ref ler
      JOIN ecn_master em ON em.id = ler.ecn_id
      WHERE ler.lot_id = $1
      ORDER BY em.ecn_no ASC
    `,
    [lotId]
  );

  return result.rows;
}

async function findCurrentLots(filters = {}) {
  const values = [];
  const whereSql = buildLotWhere(filters, values);

  const result = await pool.query(
    `
      ${lotSelectSql()}
      ${whereSql}
      GROUP BY pl.id, pm.id
      ORDER BY pl.production_date DESC NULLS LAST, pl.created_at DESC, pl.id DESC
      LIMIT 50
    `,
    values
  );

  return result.rows;
}

module.exports = {
  findLots,
  countLots,
  findLotById,
  findLotByModelAndLotNumber,
  createLot,
  updateLot,
  findSerialsByLotId,
  findExistingSerialsByModelId,
  insertProductUnits,
  updateLotQty,
  findUnitsForRemoval,
  deleteUnitWorkflowData,
  recalculateQaSamplingForLot,
  syncLotWorkflow,
  deleteLotGraph,
  findEcnByIds,
  deleteLotEcnRefs,
  insertLotEcnRefs,
  findLotEcnRefs,
  findCurrentLots,
};
