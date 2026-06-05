import { httpClient } from './httpClient';
import { QueryValue, toQueryString } from '../utils/queryString';

export type RoleFilters = Record<string, QueryValue>;

export type Role = {
  id: number;
  role_code: string;
  role_name: string;
};

export type Permission = {
  id: number;
  permission_code: string;
  permission_name: string;
  description?: string | null;
};

export const rolesApi = {
  async getRoles(filters: RoleFilters = {}) {
    return (await httpClient.get<Role[]>(`/roles${toQueryString(filters)}`)).data;
  },
  async getRole(id: string | number) {
    return (await httpClient.get<Role>(`/roles/${id}`)).data;
  },
  async createRole(payload: { role_code: string; role_name: string }) {
    return (await httpClient.post<Role>('/roles', payload)).data;
  },
  async updateRole(id: string | number, payload: { role_name: string }) {
    return (await httpClient.put<Role>(`/roles/${id}`, payload)).data;
  },
  async getPermissions() {
    return (await httpClient.get<Permission[]>('/permissions')).data;
  },
  async getRolePermissions(id: string | number) {
    return (await httpClient.get<Permission[]>(`/roles/${id}/permissions`)).data;
  },
  async updateRolePermissions(id: string | number, permissionIds: number[]) {
    return (await httpClient.put<Permission[]>(`/roles/${id}/permissions`, { permission_ids: permissionIds })).data;
  },
};
