import { httpClient } from './httpClient';
import { QueryValue, toQueryString } from '../utils/queryString';

export type ProductFilters = Record<string, QueryValue>;

export type ProductCategory = {
  id: number;
  category_code: string;
  category_name: string;
  description?: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ProductSubCategory = {
  id: number;
  category_id: number;
  category_code?: string;
  category_name?: string;
  sub_category_code: string;
  sub_category_name: string;
  description?: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ProductModel = {
  id: number;
  sub_category_id: number;
  sub_category_code?: string;
  sub_category_name?: string;
  category_id?: number;
  category_code?: string;
  category_name?: string;
  model_code: string;
  product_name: string;
  model_name?: string | null;
  description?: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ProductModelLookup = {
  id: number;
  model_code: string;
  product_name: string;
  model_name?: string | null;
};

export const productsApi = {
  async getProductCategories(filters: ProductFilters = {}) {
    return (await httpClient.get<ProductCategory[]>(`/product-categories${toQueryString(filters)}`)).data;
  },
  async createProductCategory(payload: Partial<ProductCategory>) {
    return (await httpClient.post<ProductCategory>('/product-categories', payload)).data;
  },
  async updateProductCategory(id: string | number, payload: Partial<ProductCategory>) {
    return (await httpClient.put<ProductCategory>(`/product-categories/${id}`, payload)).data;
  },
  async getProductSubCategories(filters: ProductFilters = {}) {
    return (await httpClient.get<ProductSubCategory[]>(`/product-sub-categories${toQueryString(filters)}`)).data;
  },
  async createProductSubCategory(payload: Partial<ProductSubCategory>) {
    return (await httpClient.post<ProductSubCategory>('/product-sub-categories', payload)).data;
  },
  async updateProductSubCategory(id: string | number, payload: Partial<ProductSubCategory>) {
    return (await httpClient.put<ProductSubCategory>(`/product-sub-categories/${id}`, payload)).data;
  },
  async getProductModels(filters: ProductFilters = {}) {
    return (await httpClient.get<ProductModel[]>(`/product-models${toQueryString(filters)}`)).data;
  },
  async getProductModelById(id: string | number) {
    return (await httpClient.get<ProductModel>(`/product-models/${id}`)).data;
  },
  async createProductModel(payload: Partial<ProductModel>) {
    return (await httpClient.post<ProductModel>('/product-models', payload)).data;
  },
  async updateProductModel(id: string | number, payload: Partial<ProductModel>) {
    return (await httpClient.put<ProductModel>(`/product-models/${id}`, payload)).data;
  },
  async getProductModelLookups() {
    return (await httpClient.get<ProductModelLookup[]>('/lookups/product-models')).data;
  },
};
