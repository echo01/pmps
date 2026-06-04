import { ApiResponse } from './apiResponse';
import { httpClient } from './httpClient';
import { QueryValue, toQueryString } from '../utils/queryString';

export type ProductionLotFilters = Record<string, QueryValue>;

export type ProductionLot = {
  id: number;
  model_id: number;
  model_code: string;
  product_name: string;
  model_name?: string | null;
  lot_number: string;
  production_date?: string | null;
  lot_qty: number;
  status: string;
  remark?: string | null;
  serial_count: number;
  created_at?: string;
  updated_at?: string;
  ecn_refs?: EcnRef[];
};

export type ProductUnit = {
  id: number;
  model_id: number;
  lot_id: number;
  serial_number: string;
  unit_status: string;
  created_at?: string;
  updated_at?: string;
};

export type EcnRef = {
  id: number;
  lot_id: number;
  ecn_id: number;
  ecn_no: string;
  ecn_title?: string | null;
  revision?: string | null;
  applied_note?: string | null;
  created_at?: string;
};

export type SerialGenerationPayload = {
  prefix: string;
  start_number: number;
  count: number;
  padding: number;
};

export type CreateProductionLotPayload = {
  model_id: number;
  lot_number: string;
  production_date?: string | null;
  lot_qty: number;
  remark?: string | null;
  serial_generation: SerialGenerationPayload;
  ecn_ids?: number[];
};

export type UpdateProductionLotPayload = {
  production_date?: string | null;
  remark?: string | null;
  status?: 'OPEN' | 'CLOSED' | 'HOLD' | 'CANCELLED';
};

export type ReportPage<T> = {
  rows: T[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
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

export const productionLotsApi = {
  async getCurrentLots(filters: ProductionLotFilters = {}) {
    return (await httpClient.get<ProductionLot[]>(`/current-lots${toQueryString(filters)}`)).data;
  },
  async getProductionLots(filters: ProductionLotFilters = {}) {
    return pageFromResponse<ProductionLot>(
      await httpClient.get<ProductionLot[]>(`/production-lots${toQueryString(filters)}`)
    );
  },
  async getProductionLot(id: string | number) {
    return (await httpClient.get<ProductionLot>(`/production-lots/${id}`)).data;
  },
  async updateProductionLot(id: string | number, payload: UpdateProductionLotPayload) {
    return (await httpClient.put<ProductionLot>(`/production-lots/${id}`, payload)).data;
  },
  async getProductionLotSerials(id: string | number) {
    return (await httpClient.get<ProductUnit[]>(`/production-lots/${id}/serials`)).data;
  },
  async generateSerials(payload: SerialGenerationPayload) {
    return (await httpClient.post<string[]>('/production-lots/generate-serials', payload)).data;
  },
  async createProductionLot(payload: CreateProductionLotPayload) {
    return (await httpClient.post<{ lot: ProductionLot; serials: ProductUnit[] }>('/production-lots', payload)).data;
  },
  async updateLotEcnRefs(id: string | number, ecn_ids: number[]) {
    return (await httpClient.post<EcnRef[]>(`/production-lots/${id}/ecn`, { ecn_ids })).data;
  },
};
