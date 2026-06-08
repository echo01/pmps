const repository = require('./planning.repository');
const { withTransaction } = require('../../db/transaction');
const { conflict, notFound, validationError } = require('../../shared/http-error');

const UNIQUE_CORE_TASK_TYPES = new Set([
  'LOT_CREATED',
  'QC_INSPECTION',
  'QC_REVIEW',
  'QC_APPROVE',
  'QA_SAMPLING',
  'QA_REVIEW',
  'QA_APPROVE',
  'REPORT_READY',
]);

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function defaultTaskDatetime(date, hour) {
  return `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;
}

function planDatetimes(plan) {
  return {
    start: plan.planned_start_datetime || defaultTaskDatetime(plan.planned_start_date, 8),
    end: plan.planned_end_datetime || defaultTaskDatetime(plan.planned_end_date, 17),
  };
}

function splitPlanRange(plan, count) {
  const range = planDatetimes(plan);
  const startMs = new Date(range.start).getTime();
  const endMs = new Date(range.end).getTime();
  const step = Math.floor((endMs - startMs) / count);

  return Array.from({ length: count }, (_, index) => ({
    start: new Date(startMs + step * index).toISOString(),
    end: new Date(index === count - 1 ? endMs : startMs + step * (index + 1)).toISOString(),
  }));
}

function defaultTasksForPlan(plan, lot) {
  const slots = splitPlanRange(plan, 6);

  return [
    {
      task_type: 'LOT_CREATED',
      task_name: 'Lot Created',
      task_status: 'COMPLETED',
      source_type: 'LOT',
      source_id: lot.id,
      planned_start_datetime: slots[0].start,
      planned_end_datetime: slots[0].end,
      sort_order: 10,
    },
    {
      task_type: 'QC_INSPECTION',
      task_name: 'QC Inspection',
      task_status: 'PLANNED',
      source_type: 'QC',
      source_id: lot.id,
      planned_start_datetime: slots[1].start,
      planned_end_datetime: slots[1].end,
      sort_order: 20,
    },
    {
      task_type: 'QC_REVIEW',
      task_name: 'QC Review',
      task_status: 'PLANNED',
      source_type: 'QC',
      source_id: lot.id,
      planned_start_datetime: slots[2].start,
      planned_end_datetime: slots[2].end,
      sort_order: 30,
    },
    {
      task_type: 'QC_APPROVE',
      task_name: 'QC Approve',
      task_status: 'PLANNED',
      source_type: 'QC',
      source_id: lot.id,
      planned_start_datetime: slots[3].start,
      planned_end_datetime: slots[3].end,
      sort_order: 40,
    },
    {
      task_type: 'QA_SAMPLING',
      task_name: 'QA Sampling',
      task_status: 'PLANNED',
      source_type: 'QA',
      source_id: lot.id,
      planned_start_datetime: slots[4].start,
      planned_end_datetime: slots[4].end,
      sort_order: 50,
    },
    {
      task_type: 'REPORT_READY',
      task_name: 'Report Ready',
      task_status: 'PLANNED',
      source_type: 'REPORT',
      source_id: lot.id,
      planned_start_datetime: slots[5].start,
      planned_end_datetime: slots[5].end,
      sort_order: 60,
    },
  ];
}

function progressFromPlan(row) {
  const total = Number(row.serial_count || row.lot_qty || 0);
  const qcStarted = Number(row.qc_started_count || 0);
  const qcApproved = Number(row.qc_approved_count || 0);
  const qaStarted = Number(row.qa_started_count || 0);
  const qaApproved = Number(row.qa_approved_count || 0);

  return {
    serial_total: total,
    qc_started: qcStarted,
    qc_approved: qcApproved,
    qa_started: qaStarted,
    qa_approved: qaApproved,
    qc_percent: total ? Math.round((qcStarted / total) * 100) : 0,
    qc_approved_percent: total ? Math.round((qcApproved / total) * 100) : 0,
    qa_percent: total ? Math.round((qaStarted / total) * 100) : 0,
    qa_approved_percent: total ? Math.round((qaApproved / total) * 100) : 0,
  };
}

function isDelayed(endValue, status) {
  if (!endValue || ['COMPLETED', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
    return false;
  }

  return new Date(endValue).getTime() < Date.now();
}

function taskWorkflowStatus(taskType, workflow) {
  const qcStatus = workflow.qc_status || 'NOT_STARTED';
  const qaStatus = workflow.qa_status || 'NOT_STARTED';

  if (taskType === 'QC_INSPECTION') return qcStatus;
  if (taskType === 'QA_SAMPLING') return qaStatus;

  if (taskType === 'QC_REVIEW') {
    if (['REVIEWED', 'APPROVED'].includes(qcStatus)) return 'COMPLETED';
    if (qcStatus === 'SUBMITTED') return 'WAITING_REVIEW';
    if (['REJECTED', 'EDIT_REQUESTED'].includes(qcStatus)) return qcStatus;
    return qcStatus === 'NOT_STARTED' ? 'PLANNED' : 'IN_PROGRESS';
  }

  if (taskType === 'QC_APPROVE') {
    if (qcStatus === 'APPROVED') return 'COMPLETED';
    if (qcStatus === 'REVIEWED') return 'WAITING_REVIEW';
    if (['REJECTED', 'EDIT_REQUESTED'].includes(qcStatus)) return qcStatus;
    return qcStatus === 'NOT_STARTED' ? 'PLANNED' : 'IN_PROGRESS';
  }

  if (taskType === 'QA_REVIEW') {
    if (['REVIEWED', 'APPROVED'].includes(qaStatus)) return 'COMPLETED';
    if (qaStatus === 'SUBMITTED') return 'WAITING_REVIEW';
    if (['REJECTED', 'EDIT_REQUESTED'].includes(qaStatus)) return qaStatus;
    return qaStatus === 'NOT_STARTED' ? 'PLANNED' : 'IN_PROGRESS';
  }

  if (taskType === 'QA_APPROVE') {
    if (qaStatus === 'APPROVED') return 'COMPLETED';
    if (qaStatus === 'REVIEWED') return 'WAITING_REVIEW';
    if (['REJECTED', 'EDIT_REQUESTED'].includes(qaStatus)) return qaStatus;
    return qaStatus === 'NOT_STARTED' ? 'PLANNED' : 'IN_PROGRESS';
  }

  return null;
}

function normalizeTask(row, workflow) {
  const workflowStatus = taskWorkflowStatus(row.task_type, workflow);
  const effectiveStatus = workflowStatus || row.task_status;
  const delayed = isDelayed(row.planned_end_datetime, effectiveStatus);
  return {
    id: row.id,
    plan_id: row.plan_id,
    task_type: row.task_type,
    task_name: row.task_name,
    assigned_user_id: row.assigned_user_id,
    assigned_username: row.assigned_username,
    assigned_full_name: row.assigned_full_name,
    planned_start_datetime: row.planned_start_datetime,
    planned_end_datetime: row.planned_end_datetime,
    task_status: row.task_status,
    workflow_status: workflowStatus,
    status_source: workflowStatus ? 'WORKFLOW' : 'MANUAL',
    derived_status: workflowStatus || (delayed ? 'DELAYED' : effectiveStatus),
    delayed,
    source_type: row.source_type,
    source_id: row.source_id,
    sort_order: row.sort_order,
    remark: row.remark,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizePlan(row, tasks = []) {
  const workflow = {
    qc_status: row.qc_status || 'NOT_STARTED',
    qa_status: row.qa_status || 'NOT_STARTED',
  };
  const normalizedTasks = tasks.map((task) => normalizeTask(task, workflow));
  const delayed = isDelayed(row.planned_end_datetime, row.plan_status) || normalizedTasks.some((task) => task.delayed);
  const completedTasks = normalizedTasks.filter((task) => task.task_status === 'COMPLETED').length;
  const progress = progressFromPlan(row);

  return {
    id: row.id,
    lot_id: row.lot_id,
    lot_number: row.lot_number,
    lot_qty: row.lot_qty,
    lot_status: row.lot_status,
    serial_count: row.serial_count,
    production_date: row.production_date,
    model_code: row.model_code,
    product_name: row.product_name,
    model_name: row.model_name,
    plan_code: row.plan_code,
    plan_name: row.plan_name,
    priority: row.priority,
    planned_start_date: toDateOnly(row.planned_start_date),
    planned_end_date: toDateOnly(row.planned_end_date),
    planned_start_datetime: row.planned_start_datetime,
    planned_end_datetime: row.planned_end_datetime,
    owner_user_id: row.owner_user_id,
    owner_username: row.owner_username,
    owner_full_name: row.owner_full_name,
    plan_status: row.plan_status,
    derived_status: delayed ? 'DELAYED' : row.plan_status,
    delayed,
    remark: row.remark,
    task_count: normalizedTasks.length,
    completed_task_count: completedTasks,
    task_progress_percent: normalizedTasks.length ? Math.round((completedTasks / normalizedTasks.length) * 100) : 0,
    workflow,
    progress,
    tasks: normalizedTasks,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function makeSummary(plans) {
  return {
    total_plans: plans.length,
    in_progress: plans.filter((plan) => plan.plan_status === 'IN_PROGRESS' || plan.progress.qc_started > 0 || plan.progress.qa_started > 0).length,
    delayed: plans.filter((plan) => plan.delayed).length,
    completed: plans.filter((plan) => plan.plan_status === 'COMPLETED').length,
    waiting_review: plans.filter((plan) => plan.plan_status === 'WAITING_REVIEW' || plan.tasks.some((task) => task.task_status === 'WAITING_REVIEW')).length,
  };
}

function makeCalendarEvents(plans) {
  return plans.flatMap((plan) =>
    plan.tasks.map((task) => ({
      id: task.id,
      plan_id: plan.id,
      lot_id: plan.lot_id,
      lot_number: plan.lot_number,
      model_code: plan.model_code,
      title: `${task.task_name} - ${plan.lot_number}`,
      task_type: task.task_type,
      task_status: task.task_status,
      derived_status: task.derived_status,
      start: task.planned_start_datetime,
      end: task.planned_end_datetime,
      source_type: task.source_type,
      source_id: task.source_id,
    }))
  );
}

async function getPlanningDashboard({ filters, requestId }) {
  console.info('[PLANNING][DASHBOARD][START]', { requestId, filters });

  const rows = await repository.findPlans(filters);
  const plans = await Promise.all(
    rows.map(async (row) => normalizePlan(row, await repository.findTasksByPlanId(row.id)))
  );

  console.info('[PLANNING][DASHBOARD][SUCCESS]', { requestId, count: plans.length });

  return {
    summary: makeSummary(plans),
    plans,
    calendar_events: makeCalendarEvents(plans),
  };
}

async function getPlan({ id, requestId }) {
  console.info('[PLANNING][GET][START]', { requestId, id });

  const row = await repository.findPlanById(id);
  if (!row) {
    throw notFound('Planning record not found');
  }

  const plan = normalizePlan(row, await repository.findTasksByPlanId(id));
  console.info('[PLANNING][GET][SUCCESS]', { requestId, id });
  return plan;
}

async function createPlan({ payload, userId, requestId }) {
  console.info('[PLANNING][CREATE][START]', { requestId, lotId: payload.lot_id });

  const plan = await withTransaction(
    async (client) => {
      const lot = await repository.findLotById(payload.lot_id, client);
      if (!lot) {
        throw validationError('Validation failed', [
          { field: 'lot_id', message: 'lot_id was not found' },
        ]);
      }

      const existing = await repository.findPlanByLotId(payload.lot_id, client);
      if (existing) {
        throw conflict('Lot test plan already exists', [
          { field: 'lot_id', message: 'lot already has a test plan' },
        ]);
      }

      const range = planDatetimes(payload);
      const normalizedPayload = {
        ...payload,
        planned_start_datetime: range.start,
        planned_end_datetime: range.end,
        planned_start_date: payload.planned_start_date || range.start.slice(0, 10),
        planned_end_date: payload.planned_end_date || range.end.slice(0, 10),
      };
      const planCode = payload.plan_code || await repository.nextPlanCode(client);
      const created = await repository.createPlan(
        {
          ...normalizedPayload,
          plan_code: planCode,
          user_id: userId,
        },
        client
      );

      if (payload.create_default_tasks) {
        const defaultTasks = defaultTasksForPlan(normalizedPayload, lot);
        for (const task of defaultTasks) {
          await repository.createTask(created.id, task, client);
        }
      }

      return repository.findPlanById(created.id, client);
    },
    { requestId, name: 'create_lot_test_plan' }
  );

  console.info('[PLANNING][CREATE][SUCCESS]', { requestId, planId: plan.id });
  return getPlan({ id: plan.id, requestId });
}

async function updatePlan({ id, payload, userId, requestId }) {
  console.info('[PLANNING][UPDATE][START]', { requestId, id });

  const existing = await repository.findPlanById(id);
  if (!existing) {
    throw notFound('Planning record not found');
  }

  const mergedStart = payload.planned_start_datetime || existing.planned_start_datetime;
  const mergedEnd = payload.planned_end_datetime || existing.planned_end_datetime;
  if (new Date(mergedEnd).getTime() <= new Date(mergedStart).getTime()) {
    throw validationError('Validation failed', [
      { field: 'planned_end_datetime', message: 'planned end must be greater than planned start' },
    ]);
  }

  await repository.updatePlan(id, {
    ...payload,
    ...(payload.planned_start_datetime ? { planned_start_date: payload.planned_start_datetime.slice(0, 10) } : {}),
    ...(payload.planned_end_datetime ? { planned_end_date: payload.planned_end_datetime.slice(0, 10) } : {}),
  }, userId);
  console.info('[PLANNING][UPDATE][SUCCESS]', { requestId, id });
  return getPlan({ id, requestId });
}

async function deletePlan({ id, requestId }) {
  console.info('[PLANNING][DELETE][START]', { requestId, id });

  const deleted = await repository.deletePlan(id);
  if (!deleted) {
    throw notFound('Planning record not found');
  }

  console.info('[PLANNING][DELETE][SUCCESS]', { requestId, id });
  return { id };
}

async function createTask({ planId, payload, requestId }) {
  console.info('[PLANNING][TASK_CREATE][START]', { requestId, planId });

  const plan = await repository.findPlanById(planId);
  if (!plan) {
    throw notFound('Planning record not found');
  }

  if (UNIQUE_CORE_TASK_TYPES.has(payload.task_type)) {
    const existing = await repository.findTaskByPlanAndType(planId, payload.task_type);

    if (existing) {
      throw conflict('Planning task type already exists for this plan', [
        {
          field: 'task_type',
          message: `${payload.task_type} already exists in this plan`,
        },
      ]);
    }
  }

  await repository.createTask(planId, payload);
  console.info('[PLANNING][TASK_CREATE][SUCCESS]', { requestId, planId });
  return getPlan({ id: planId, requestId });
}

async function updateTask({ taskId, payload, requestId }) {
  console.info('[PLANNING][TASK_UPDATE][START]', { requestId, taskId });

  const task = await repository.findTaskById(taskId);
  if (!task) {
    throw notFound('Planning task not found');
  }

  await repository.updateTask(taskId, payload);
  console.info('[PLANNING][TASK_UPDATE][SUCCESS]', { requestId, taskId });
  return getPlan({ id: task.plan_id, requestId });
}

async function deleteTask({ taskId, requestId }) {
  console.info('[PLANNING][TASK_DELETE][START]', { requestId, taskId });

  const deleted = await repository.deleteTask(taskId);
  if (!deleted) {
    throw notFound('Planning task not found');
  }

  console.info('[PLANNING][TASK_DELETE][SUCCESS]', { requestId, taskId });
  return getPlan({ id: deleted.plan_id, requestId });
}

module.exports = {
  getPlanningDashboard,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  createTask,
  updateTask,
  deleteTask,
};
