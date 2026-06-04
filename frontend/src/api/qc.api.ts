import { httpClient } from './httpClient';
import { QueryValue, toQueryString } from '../utils/queryString';

export type TransactionLot = {
  id: number;
  lot_number: string;
  model_id: number;
  model_code: string;
  product_name: string;
  lot_qty: number;
  serial_count: number;
  status: string;
  production_date?: string | null;
};

export type TransactionUnit = {
  id: number;
  lot_id: number;
  model_id: number;
  serial_number: string;
  unit_status: string;
  latest_qc_status?: string | null;
  latest_qc_result?: string | null;
  latest_qa_status?: string | null;
  latest_qa_result?: string | null;
};

export type TransactionTemplate = {
  id: number;
  model_id: number;
  template_type: 'INSPECTION' | 'QA';
  template_name: string;
  revision?: string | null;
  active: boolean;
};

export type TemplateItem = {
  id: number;
  template_id: number;
  section_id?: number | null;
  section_code?: string | null;
  section_name?: string | null;
  item_code: string;
  item_name: string;
  check_type: string;
  spec_min?: number | string | null;
  spec_max?: number | string | null;
  unit?: string | null;
  mandatory: boolean;
};

export type TemplateSection = {
  section_id?: number | null;
  section_code?: string | null;
  section_name?: string | null;
  seq_no: number;
  items: TemplateItem[];
};

export type QcItemPayload = {
  template_item_id: number;
  measured_value?: number | null;
  measured_text?: string | null;
  remark?: string | null;
};

export type QcInspectionPayload = {
  product_unit_id: number;
  template_id: number;
  inspection_no: number;
  station_name: string;
  equipment_ids: number[];
  items: QcItemPayload[];
  remark?: string | null;
};

export type QcInspection = {
  id: number;
  product_unit_id: number;
  template_id: number;
  inspection_no: number;
  station_name: string;
  status: string;
  overall_result: string;
  remark?: string | null;
  lot_id: number;
  lot_number: string;
  model_id: number;
  model_code: string;
  product_name: string;
  serial_number: string;
  template_name: string;
  revision?: string | null;
  details: Array<QcItemPayload & {
    id: number;
    item_code: string;
    item_name: string;
    check_type: string;
    result: string;
  }>;
  equipment: Array<{ equipment_id: number; equipment_code: string; equipment_name: string; status: string; calibration_due_date?: string | null }>;
  approval_logs: Array<Record<string, string | number | null>>;
};

export type EquipmentCheck = {
  valid: boolean;
  missing: unknown[];
  missing_required: unknown[];
  expired: unknown[];
  inactive: unknown[];
  summary: {
    missing_count: number;
    inactive_count: number;
    expired_count: number;
    missing_required_count: number;
  };
};

function flattenTemplateSections(sections: TemplateSection[]) {
  return sections.flatMap((section) => section.items.map((item) => ({
    ...item,
    section_id: section.section_id,
    section_code: section.section_code,
    section_name: section.section_name,
  })));
}

export const qcApi = {
  async getLots(params: Record<string, QueryValue> = {}) {
    return (await httpClient.get<TransactionLot[]>(`/qc/lots${toQueryString(params)}`)).data;
  },
  async getLotUnits(lotId: string | number) {
    return (await httpClient.get<TransactionUnit[]>(`/qc/lots/${lotId}/units`)).data;
  },
  async getTemplatesByModel(modelId: string | number) {
    return (await httpClient.get<TransactionTemplate[]>(`/qc/models/${modelId}/templates`)).data;
  },
  async getTemplateItems(templateId: string | number) {
    return flattenTemplateSections((await httpClient.get<TemplateSection[]>(`/qc/templates/${templateId}/items`)).data);
  },
  async createInspection(payload: QcInspectionPayload) {
    return (await httpClient.post<QcInspection>('/qc/inspections', payload)).data;
  },
  async getInspection(id: string | number) {
    return (await httpClient.get<QcInspection>(`/qc/inspections/${id}`)).data;
  },
  async updateInspection(id: string | number, payload: Partial<QcInspectionPayload>) {
    return (await httpClient.put<QcInspection>(`/qc/inspections/${id}`, payload)).data;
  },
  async checkEquipment(id: string | number) {
    return (await httpClient.get<EquipmentCheck>(`/qc/inspections/${id}/equipment-check`)).data;
  },
  async submit(id: string | number, remark?: string) {
    return (await httpClient.post<QcInspection>(`/qc/inspections/${id}/submit`, { remark })).data;
  },
  async review(id: string | number, remark?: string) {
    return (await httpClient.post<QcInspection>(`/qc/inspections/${id}/review`, { remark })).data;
  },
  async approve(id: string | number, remark?: string) {
    return (await httpClient.post<QcInspection>(`/qc/inspections/${id}/approve`, { remark })).data;
  },
  async reject(id: string | number, remark: string) {
    return (await httpClient.post<QcInspection>(`/qc/inspections/${id}/reject`, { remark })).data;
  },
};
