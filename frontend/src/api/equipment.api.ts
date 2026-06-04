import { httpClient } from './httpClient';
import { QueryValue, toQueryString } from '../utils/queryString';

export type EquipmentFilters = Record<string, QueryValue>;

export type EquipmentType = {
  id: number;
  type_code: string;
  type_name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Equipment = {
  id: number;
  equipment_code: string;
  equipment_name: string;
  equipment_type_id?: number | null;
  equipment_type_code?: string | null;
  equipment_type_name?: string | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  calibration_no?: string | null;
  calibration_date?: string | null;
  calibration_due_date?: string | null;
  calibration_status?: 'VALID' | 'EXPIRED' | 'UNKNOWN';
  status: 'ACTIVE' | 'INACTIVE' | 'REPAIR' | 'CALIBRATION';
  location_name?: string | null;
  asset_no?: string | null;
  remark?: string | null;
  created_at?: string;
  updated_at?: string;
};

export const equipmentApi = {
  async getEquipmentTypes(filters: EquipmentFilters = {}) {
    return (await httpClient.get<EquipmentType[]>(`/equipment-types${toQueryString(filters)}`)).data;
  },
  async createEquipmentType(payload: Partial<EquipmentType>) {
    return (await httpClient.post<EquipmentType>('/equipment-types', payload)).data;
  },
  async updateEquipmentType(id: string | number, payload: Partial<EquipmentType>) {
    return (await httpClient.put<EquipmentType>(`/equipment-types/${id}`, payload)).data;
  },
  async getEquipment(filters: EquipmentFilters = {}) {
    return (await httpClient.get<Equipment[]>(`/equipment${toQueryString(filters)}`)).data;
  },
  async getEquipmentById(id: string | number) {
    return (await httpClient.get<Equipment>(`/equipment/${id}`)).data;
  },
  async createEquipment(payload: Partial<Equipment>) {
    return (await httpClient.post<Equipment>('/equipment', payload)).data;
  },
  async updateEquipment(id: string | number, payload: Partial<Equipment>) {
    return (await httpClient.put<Equipment>(`/equipment/${id}`, payload)).data;
  },
  async getExpiredCalibrationEquipment() {
    return (await httpClient.get<Equipment[]>('/equipment/expired-calibration')).data;
  },
};
