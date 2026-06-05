import { httpClient } from './httpClient';
import { QueryValue, toQueryString } from '../utils/queryString';

export type UserFilters = Record<string, QueryValue>;

export type ManagedUser = {
  id: number;
  employee_code?: string | null;
  username: string;
  full_name: string;
  department?: string | null;
  email?: string | null;
  active: boolean;
  failed_login_count?: number;
  locked_until?: string | null;
  last_login_at?: string | null;
  password_changed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type UserRole = {
  id: number;
  role_code: string;
  role_name: string;
};

export type CreateUserPayload = {
  username: string;
  password: string;
  employee_code?: string | null;
  full_name: string;
  department?: string | null;
  email?: string | null;
  active?: boolean;
};

export type UpdateUserPayload = {
  employee_code?: string | null;
  full_name?: string;
  department?: string | null;
  email?: string | null;
  active?: boolean;
};

export const usersApi = {
  async getUsers(filters: UserFilters = {}) {
    return (await httpClient.get<ManagedUser[]>(`/users${toQueryString(filters)}`)).data;
  },
  async getUser(id: string | number) {
    return (await httpClient.get<ManagedUser>(`/users/${id}`)).data;
  },
  async createUser(payload: CreateUserPayload) {
    return (await httpClient.post<ManagedUser>('/users', payload)).data;
  },
  async updateUser(id: string | number, payload: UpdateUserPayload) {
    return (await httpClient.put<ManagedUser>(`/users/${id}`, payload)).data;
  },
  async setUserActive(id: string | number, active: boolean) {
    return (await httpClient.patch<ManagedUser>(`/users/${id}/active`, { active })).data;
  },
  async lockUser(id: string | number) {
    return (await httpClient.post<ManagedUser>(`/users/${id}/lock`, {})).data;
  },
  async unlockUser(id: string | number) {
    return (await httpClient.post<ManagedUser>(`/users/${id}/unlock`, {})).data;
  },
  async resetPassword(id: string | number, password: string) {
    return (await httpClient.post<ManagedUser>(`/users/${id}/password`, { password })).data;
  },
  async getUserRoles(id: string | number) {
    return (await httpClient.get<UserRole[]>(`/users/${id}/roles`)).data;
  },
  async updateUserRoles(id: string | number, roleIds: number[]) {
    return (await httpClient.put<UserRole[]>(`/users/${id}/roles`, { role_ids: roleIds })).data;
  },
};
