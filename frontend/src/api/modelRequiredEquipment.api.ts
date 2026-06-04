import { httpClient } from './httpClient';
import { QueryValue, toQueryString } from '../utils/queryString';

export type ModelRequiredEquipmentFilters = Record<string, QueryValue>;

export type ModelRequiredEquipment = {
  id: number;
  model_id: number;
  model_code: string;
  product_name: string;
  equipment_type_id: number;
  equipment_type_code: string;
  equipment_type_name: string;
  required_qty: number;
  mandatory: boolean;
  remark?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AvailableEquipment = {
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  equipment_type_id: number;
  equipment_type_code: string;
  equipment_type_name: string;
  status: string;
  calibration_due_date?: string | null;
  calibration_status?: 'VALID' | 'EXPIRED' | 'UNKNOWN';
  required_qty: number;
  mandatory: boolean;
};

export const modelRequiredEquipmentApi = {
  async getModelRequiredEquipment(filters: ModelRequiredEquipmentFilters = {}) {
    return (await httpClient.get<ModelRequiredEquipment[]>(`/model-required-equipment${toQueryString(filters)}`)).data;
  },
  async createModelRequiredEquipment(payload: Partial<ModelRequiredEquipment>) {
    return (await httpClient.post<ModelRequiredEquipment>('/model-required-equipment', payload)).data;
  },
  async updateModelRequiredEquipment(id: string | number, payload: Partial<ModelRequiredEquipment>) {
    return (await httpClient.put<ModelRequiredEquipment>(`/model-required-equipment/${id}`, payload)).data;
  },
  async deleteModelRequiredEquipment(id: string | number) {
    return (await httpClient.delete<{ id: number }>(`/model-required-equipment/${id}`)).data;
  },
  async getRequiredEquipmentByModel(modelId: string | number) {
    return (await httpClient.get<ModelRequiredEquipment[]>(`/models/${modelId}/required-equipment`)).data;
  },
  async getAvailableEquipmentByModel(modelId: string | number) {
    return (await httpClient.get<AvailableEquipment[]>(`/models/${modelId}/available-equipment`)).data;
  },
};
