import { httpClient } from './httpClient';
import { QueryValue, toQueryString } from '../utils/queryString';

export type PlanningFilters = Record<string, QueryValue>;

export type PlanPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type PlanStatus = 'PLANNED' | 'IN_PROGRESS' | 'WAITING_REVIEW' | 'COMPLETED' | 'CANCELLED';
export type TaskStatus = PlanStatus;
export type WorkflowStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'APPROVED' | 'REJECTED' | 'EDIT_REQUESTED';
export type TaskType = 'LOT_CREATED' | 'QC_INSPECTION' | 'QC_REVIEW' | 'QC_APPROVE' | 'QA_SAMPLING' | 'QA_REVIEW' | 'QA_APPROVE' | 'REPORT_READY' | 'CUSTOM';
export type SourceType = 'QC' | 'QA' | 'REPORT' | 'LOT';

export type PlanningTask = {
  id: number;
  plan_id: number;
  task_type: TaskType;
  task_name: string;
  assigned_user_id?: number | null;
  assigned_username?: string | null;
  assigned_full_name?: string | null;
  planned_start_datetime?: string | null;
  planned_end_datetime?: string | null;
  task_status: TaskStatus;
  workflow_status?: WorkflowStatus | null;
  status_source: 'WORKFLOW' | 'MANUAL';
  derived_status: TaskStatus | WorkflowStatus | 'DELAYED';
  delayed: boolean;
  source_type?: SourceType | null;
  source_id?: number | null;
  sort_order: number;
  remark?: string | null;
};

export type PlanningPlan = {
  id: number;
  lot_id: number;
  lot_number: string;
  lot_qty: number;
  lot_status: string;
  serial_count: number;
  production_date?: string | null;
  model_code: string;
  product_name: string;
  model_name?: string | null;
  plan_code: string;
  plan_name: string;
  priority: PlanPriority;
  planned_start_date: string;
  planned_end_date: string;
  planned_start_datetime: string;
  planned_end_datetime: string;
  owner_user_id?: number | null;
  owner_username?: string | null;
  owner_full_name?: string | null;
  plan_status: PlanStatus;
  derived_status: PlanStatus | 'DELAYED';
  delayed: boolean;
  remark?: string | null;
  task_count: number;
  completed_task_count: number;
  task_progress_percent: number;
  workflow: {
    qc_status: WorkflowStatus;
    qa_status: WorkflowStatus;
  };
  progress: {
    serial_total: number;
    qc_started: number;
    qc_approved: number;
    qa_started: number;
    qa_approved: number;
    qc_percent: number;
    qc_approved_percent: number;
    qa_percent: number;
    qa_approved_percent: number;
  };
  tasks: PlanningTask[];
};

export type PlanningDashboard = {
  summary: {
    total_plans: number;
    in_progress: number;
    delayed: number;
    completed: number;
    waiting_review: number;
  };
  plans: PlanningPlan[];
  calendar_events: Array<{
    id: number;
    plan_id: number;
    lot_id: number;
    lot_number: string;
    model_code: string;
    title: string;
    task_type: TaskType;
    task_status: TaskStatus;
    derived_status: TaskStatus | WorkflowStatus | 'DELAYED';
    start?: string | null;
    end?: string | null;
    source_type?: SourceType | null;
    source_id?: number | null;
  }>;
};

export type CreatePlanPayload = {
  lot_id: number;
  plan_code?: string | null;
  plan_name: string;
  priority: PlanPriority;
  planned_start_date?: string;
  planned_end_date?: string;
  planned_start_datetime?: string;
  planned_end_datetime?: string;
  owner_user_id?: number | null;
  plan_status?: PlanStatus;
  remark?: string | null;
  create_default_tasks?: boolean;
};

export type TaskPayload = {
  task_type: TaskType;
  task_name: string;
  assigned_user_id?: number | null;
  planned_start_datetime?: string | null;
  planned_end_datetime?: string | null;
  task_status?: TaskStatus;
  source_type?: SourceType | null;
  source_id?: number | null;
  sort_order?: number;
  remark?: string | null;
};

export const planningApi = {
  async getDashboard(filters: PlanningFilters = {}) {
    return (await httpClient.get<PlanningDashboard>(`/planning/plans${toQueryString(filters)}`)).data;
  },
  async getPlan(id: string | number) {
    return (await httpClient.get<PlanningPlan>(`/planning/plans/${id}`)).data;
  },
  async createPlan(payload: CreatePlanPayload) {
    return (await httpClient.post<PlanningPlan>('/planning/plans', payload)).data;
  },
  async updatePlan(id: string | number, payload: Partial<CreatePlanPayload>) {
    return (await httpClient.put<PlanningPlan>(`/planning/plans/${id}`, payload)).data;
  },
  async deletePlan(id: string | number) {
    return (await httpClient.delete<{ id: number }>(`/planning/plans/${id}`)).data;
  },
  async createTask(planId: string | number, payload: TaskPayload) {
    return (await httpClient.post<PlanningPlan>(`/planning/plans/${planId}/tasks`, payload)).data;
  },
  async updateTask(taskId: string | number, payload: Partial<TaskPayload>) {
    return (await httpClient.put<PlanningPlan>(`/planning/tasks/${taskId}`, payload)).data;
  },
  async deleteTask(taskId: string | number) {
    return (await httpClient.delete<PlanningPlan>(`/planning/tasks/${taskId}`)).data;
  },
};
