import { httpClient } from './httpClient';

export type Profile = {
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
  roles: string[];
  permissions: string[];
};

export const profileApi = {
  async getProfile() {
    return (await httpClient.get<Profile>('/profile')).data;
  },
  async updateProfile(payload: { full_name: string; email?: string | null }) {
    return (await httpClient.put<Profile>('/profile', payload)).data;
  },
  async changePassword(payload: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) {
    return (await httpClient.post<Profile>('/profile/password', payload)).data;
  },
};
