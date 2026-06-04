import { httpClient } from './httpClient';
import { QueryValue, toQueryString } from '../utils/queryString';
import { EquipmentCheck, QcItemPayload, TemplateItem, TemplateSection, TransactionLot, TransactionTemplate, TransactionUnit } from './qc.api';

function flattenTemplateSections(sections: TemplateSection[]) {
  return sections.flatMap((section) => section.items.map((item) => ({
    ...item,
    section_id: section.section_id,
    section_code: section.section_code,
    section_name: section.section_name,
  })));
}

export type QaSampleUnitPayload = {
  product_unit_id: number;
  items: QcItemPayload[];
  remark?: string | null;
};

export type QaSamplingPayload = {
  lot_id: number;
  template_id: number;
  sampling_no: number;
  sampling_method: string;
  station_name: string;
  equipment_ids: number[];
  sample_units: QaSampleUnitPayload[];
  remark?: string | null;
};

export type QaSampling = {
  id: number;
  lot_id: number;
  template_id: number;
  sampling_no: number;
  sampling_method: string;
  station_name: string;
  status: string;
  overall_result: string;
  remark?: string | null;
  lot_number: string;
  model_id: number;
  model_code: string;
  product_name: string;
  template_name: string;
  revision?: string | null;
  sample_units: Array<{
    id: number;
    product_unit_id: number;
    sample_no: number;
    serial_number: string;
    unit_result: string;
    remark?: string | null;
    details: Array<QcItemPayload & {
      id: number;
      item_code: string;
      item_name: string;
      check_type: string;
      result: string;
    }>;
  }>;
  equipment: Array<{ equipment_id: number; equipment_code: string; equipment_name: string; status: string; calibration_due_date?: string | null }>;
  approval_logs: Array<Record<string, string | number | null>>;
};

export const qaApi = {
  async getLots(params: Record<string, QueryValue> = {}) {
    return (await httpClient.get<TransactionLot[]>(`/qa/lots${toQueryString(params)}`)).data;
  },
  async getLotUnits(lotId: string | number) {
    return (await httpClient.get<TransactionUnit[]>(`/qa/lots/${lotId}/units`)).data;
  },
  async getTemplatesByModel(modelId: string | number) {
    return (await httpClient.get<TransactionTemplate[]>(`/qa/models/${modelId}/templates`)).data;
  },
  async getTemplateItems(templateId: string | number) {
    return flattenTemplateSections((await httpClient.get<TemplateSection[]>(`/qa/templates/${templateId}/items`)).data);
  },
  async createSampling(payload: QaSamplingPayload) {
    return (await httpClient.post<QaSampling>('/qa/samplings', payload)).data;
  },
  async getSampling(id: string | number) {
    return (await httpClient.get<QaSampling>(`/qa/samplings/${id}`)).data;
  },
  async updateSampling(id: string | number, payload: Partial<QaSamplingPayload>) {
    return (await httpClient.put<QaSampling>(`/qa/samplings/${id}`, payload)).data;
  },
  async checkEquipment(id: string | number) {
    return (await httpClient.get<EquipmentCheck>(`/qa/samplings/${id}/equipment-check`)).data;
  },
  async submit(id: string | number, remark?: string) {
    return (await httpClient.post<QaSampling>(`/qa/samplings/${id}/submit`, { remark })).data;
  },
  async review(id: string | number, remark?: string) {
    return (await httpClient.post<QaSampling>(`/qa/samplings/${id}/review`, { remark })).data;
  },
  async approve(id: string | number, remark?: string) {
    return (await httpClient.post<QaSampling>(`/qa/samplings/${id}/approve`, { remark })).data;
  },
  async reject(id: string | number, remark: string) {
    return (await httpClient.post<QaSampling>(`/qa/samplings/${id}/reject`, { remark })).data;
  },
};
