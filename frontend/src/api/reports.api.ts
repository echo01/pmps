import { ApiResponse } from './apiResponse';
import { httpClient } from './httpClient';
import {
  mockDashboardSummary,
  mockLotDetail,
  mockLots,
  mockLotStatus,
  mockQaDetail,
  mockQaRows,
  mockQaSummary,
  mockQcDetail,
  mockQcRows,
  mockQcSummary,
  mockSerialDetail,
  mockSerials,
} from '../mocks/reports.mock';
import { QueryValue, toQueryString } from '../utils/queryString';

const useMock = import.meta.env.VITE_USE_MOCK === 'true';

export type PaginationMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type ReportPage<T> = {
  rows: T[];
  pagination: PaginationMeta;
};

export type DashboardSummary = {
  production: Record<string, number>;
  qc: Record<string, number>;
  qa: Record<string, number>;
};

export type SummaryGroup = {
  status?: string;
  overall_result?: string;
  model_code?: string;
  count?: number;
  total?: number;
  pass?: number;
  fail?: number;
  na?: number;
};

export type ReportFilters = Record<string, QueryValue>;

export type LotReportRow = {
  lot_id: number;
  lot_number: string;
  model_code: string;
  product_name: string;
  lot_qty: number;
  serial_count: number;
  qc_count: number;
  qa_sampling_count: number;
  lot_status: string;
  production_date: string;
};

export type SerialReportRow = {
  product_unit_id: number;
  serial_number: string;
  lot_id: number;
  lot_number: string;
  model_code: string;
  product_name: string;
  unit_status: string;
  latest_qc_status?: string;
  latest_qc_result?: string;
  latest_qa_status?: string;
  latest_qa_result?: string;
};

export type QcInspectionReportRow = {
  inspection_id: number;
  inspection_no: number;
  status: string;
  overall_result: string;
  station_name?: string;
  product_unit_id: number;
  serial_number: string;
  lot_id: number;
  lot_number: string;
  model_code: string;
  product_name: string;
  template_name: string;
  operator_username?: string;
  reviewer_username?: string;
  approver_username?: string;
  inspection_datetime?: string;
};

export type QaSamplingReportRow = {
  qa_sampling_id: number;
  sampling_no: number;
  sampling_method?: string;
  status: string;
  overall_result: string;
  lot_id: number;
  lot_number: string;
  model_code: string;
  product_name: string;
  template_name: string;
  sample_qty: number;
  accept_qty: number;
  reject_qty: number;
  operator_username?: string;
  reviewer_username?: string;
  approver_username?: string;
  sampling_datetime?: string;
};

export type DetailItem = {
  id: number;
  item_code?: string;
  item_name?: string;
  measured_value?: number | string | null;
  measured_text?: string | null;
  result?: string;
  remark?: string | null;
};

export type ApprovalLog = {
  id: number;
  action: string;
  old_status?: string;
  new_status?: string;
  action_by_username?: string;
  action_datetime?: string;
  remark?: string | null;
};

export type EditHistoryRow = {
  id: number;
  approval_status?: string;
  item_code?: string;
  item_name?: string;
  old_measured_value?: number | string | null;
  new_measured_value?: number | string | null;
  old_measured_text?: string | null;
  new_measured_text?: string | null;
  old_result?: string;
  new_result?: string;
  edit_reason?: string;
  edit_by_username?: string;
  edit_at?: string;
};

export type QcInspectionReportDetail = QcInspectionReportRow & {
  details: DetailItem[];
  equipment: Array<Record<string, string | number | null>>;
  approval_logs: ApprovalLog[];
  edit_history: EditHistoryRow[];
};

export type QaSampleUnit = {
  id: number;
  sample_no?: number;
  serial_number?: string;
  unit_result?: string;
  details?: DetailItem[];
};

export type QaSamplingReportDetail = QaSamplingReportRow & {
  sample_units: QaSampleUnit[];
  equipment: Array<Record<string, string | number | null>>;
  approval_logs: ApprovalLog[];
  edit_history: EditHistoryRow[];
};

export type SerialReportDetail = SerialReportRow & {
  qc_inspections: QcInspectionReportRow[];
  qa_samplings: QaSamplingReportRow[];
};

export type LotReportDetail = {
  lot: LotReportRow | null;
  serials: SerialReportRow[];
  qc_summary: Record<string, number>;
  qa_summary: Record<string, number>;
  approval_status: Array<Record<string, string | number | null>>;
};

function pageFromResponse<T>(response: ApiResponse<T[]>): ReportPage<T> {
  return {
    rows: response.data,
    pagination: response.meta?.pagination || {
      page: 1,
      page_size: response.data.length,
      total: response.data.length,
      total_pages: 1,
    },
  };
}

export const reportsApi = {
  async getDashboardSummary() {
    return useMock ? mockDashboardSummary() : (await httpClient.get<DashboardSummary>('/dashboard/summary')).data;
  },
  async getQcSummary(params: ReportFilters) {
    return useMock ? mockQcSummary() : (await httpClient.get<{ by_status: SummaryGroup[]; by_result: SummaryGroup[]; by_model: SummaryGroup[] }>(`/dashboard/qc-summary${toQueryString(params)}`)).data;
  },
  async getQaSummary(params: ReportFilters) {
    return useMock ? mockQaSummary() : (await httpClient.get<{ by_status: SummaryGroup[]; by_result: SummaryGroup[]; by_model: SummaryGroup[] }>(`/dashboard/qa-summary${toQueryString(params)}`)).data;
  },
  async getLotStatus() {
    return useMock ? mockLotStatus() : (await httpClient.get<Array<{ status: string; count: number }>>('/dashboard/lot-status')).data;
  },
  async searchLots(params: ReportFilters) {
    return useMock ? mockLots() : pageFromResponse<LotReportRow>(await httpClient.get<LotReportRow[]>(`/reports/lots${toQueryString(params)}`));
  },
  async searchSerials(params: ReportFilters) {
    return useMock ? mockSerials() : pageFromResponse<SerialReportRow>(await httpClient.get<SerialReportRow[]>(`/reports/serials${toQueryString(params)}`));
  },
  async searchQcInspections(params: ReportFilters) {
    return useMock ? mockQcRows() : pageFromResponse<QcInspectionReportRow>(await httpClient.get<QcInspectionReportRow[]>(`/reports/qc-inspections${toQueryString(params)}`));
  },
  async searchQaSamplings(params: ReportFilters) {
    return useMock ? mockQaRows() : pageFromResponse<QaSamplingReportRow>(await httpClient.get<QaSamplingReportRow[]>(`/reports/qa-samplings${toQueryString(params)}`));
  },
  async getLotDetail(lotId: string | number) {
    return useMock ? mockLotDetail() : (await httpClient.get<LotReportDetail>(`/reports/lots/${lotId}`)).data;
  },
  async getSerialDetail(productUnitId: string | number) {
    return useMock ? mockSerialDetail() : (await httpClient.get<SerialReportDetail>(`/reports/serials/${productUnitId}`)).data;
  },
  async getQcInspectionDetail(id: string | number) {
    return useMock ? mockQcDetail() : (await httpClient.get<QcInspectionReportDetail>(`/reports/qc-inspections/${id}`)).data;
  },
  async getQaSamplingDetail(id: string | number) {
    return useMock ? mockQaDetail() : (await httpClient.get<QaSamplingReportDetail>(`/reports/qa-samplings/${id}`)).data;
  },
};
