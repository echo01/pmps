import { httpClient } from './httpClient';
import { QueryValue, toQueryString } from '../utils/queryString';

export type TemplateFilters = Record<string, QueryValue>;

export type DuplicateTestTemplatePayload = {
  template_name: string;
  revision?: string;
  revision_note?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  active?: boolean;
  copy_models?: boolean;
};

export type TestTemplate = {
  id: number;
  model_id?: number | null;
  model_code?: string | null;
  product_name?: string | null;
  models?: TemplateModel[];
  model_ids?: number[];
  model_codes?: string[];
  template_type: 'INSPECTION' | 'QA';
  template_name: string;
  revision?: string | null;
  revision_note?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TemplateModel = {
  id: number;
  model_code: string;
  product_name: string;
  is_primary: boolean;
  created_at?: string;
};

export type TemplateSection = {
  id: number;
  template_id: number;
  seq_no: number;
  section_code?: string | null;
  section_name: string;
  updated_at?: string;
};

export type TemplateItem = {
  id: number;
  template_id: number;
  section_id?: number | null;
  section_seq_no?: number | null;
  section_code?: string | null;
  section_name?: string | null;
  seq_no: number;
  item_code?: string | null;
  test_point?: string | null;
  item_name?: string | null;
  test_description?: string | null;
  expect_value?: number | null;
  expect_text?: string | null;
  spec_min?: number | null;
  spec_max?: number | null;
  unit?: string | null;
  input_unit?: string | null;
  source_unit?: string | null;
  check_type: 'NUMERIC' | 'BOOLEAN' | 'TEXT';
  mandatory: boolean;
  active: boolean;
  remark?: string | null;
  updated_at?: string;
};

export type TemplateItemGroup = {
  section_id?: number | null;
  section_code?: string | null;
  section_name?: string | null;
  seq_no?: number | null;
  items: TemplateItem[];
};

export const testTemplatesApi = {
  async getTestTemplates(filters: TemplateFilters = {}) {
    return (await httpClient.get<TestTemplate[]>(`/test-templates${toQueryString(filters)}`)).data;
  },
  async createTestTemplate(payload: Partial<TestTemplate>) {
    return (await httpClient.post<TestTemplate>('/test-templates', payload)).data;
  },
  async getTestTemplateById(id: string | number) {
    return (await httpClient.get<TestTemplate>(`/test-templates/${id}`)).data;
  },
  async updateTestTemplate(id: string | number, payload: Partial<TestTemplate>) {
    return (await httpClient.put<TestTemplate>(`/test-templates/${id}`, payload)).data;
  },
  async deleteTestTemplate(id: string | number) {
    return (await httpClient.delete<{ id: number }>(`/test-templates/${id}`)).data;
  },
  async duplicateTestTemplate(id: string | number, payload: DuplicateTestTemplatePayload) {
    return (await httpClient.post<TestTemplate>(`/test-templates/${id}/duplicate`, payload)).data;
  },
  async getTemplateModels(id: string | number) {
    return (await httpClient.get<TemplateModel[]>(`/test-templates/${id}/models`)).data;
  },
  async updateTemplateModels(id: string | number, payload: { model_ids: number[]; primary_model_id?: number | null }) {
    return (await httpClient.put<TemplateModel[]>(`/test-templates/${id}/models`, payload)).data;
  },
  async getTemplateSections(templateId: string | number) {
    return (await httpClient.get<TemplateSection[]>(`/test-templates/${templateId}/sections`)).data;
  },
  async createTemplateSection(templateId: string | number, payload: Partial<TemplateSection>) {
    return (await httpClient.post<TemplateSection>(`/test-templates/${templateId}/sections`, payload)).data;
  },
  async updateTemplateSection(id: string | number, payload: Partial<TemplateSection>) {
    return (await httpClient.put<TemplateSection>(`/test-template-sections/${id}`, payload)).data;
  },
  async deleteTemplateSection(id: string | number) {
    return (await httpClient.delete<{ id: number }>(`/test-template-sections/${id}`)).data;
  },
  async getTemplateItems(templateId: string | number) {
    return (await httpClient.get<TemplateItemGroup[]>(`/test-templates/${templateId}/items`)).data;
  },
  async createTemplateItem(templateId: string | number, payload: Partial<TemplateItem>) {
    return (await httpClient.post<TemplateItem>(`/test-templates/${templateId}/items`, payload)).data;
  },
  async updateTemplateItem(id: string | number, payload: Partial<TemplateItem>) {
    return (await httpClient.put<TemplateItem>(`/test-template-items/${id}`, payload)).data;
  },
  async deleteTemplateItem(id: string | number) {
    return (await httpClient.delete<{ id: number }>(`/test-template-items/${id}`)).data;
  },
};
