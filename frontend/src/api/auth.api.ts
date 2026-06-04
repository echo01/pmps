import { httpClient, setToken } from './httpClient';
import { mockLogin, mockMe } from '../mocks/auth.mock';

const useMock = import.meta.env.VITE_USE_MOCK === 'true';

export type UserSession = {
  id: number;
  username: string;
  employee_code?: string;
  full_name?: string;
  email?: string;
  roles: string[];
  permissions: string[];
};

export type LoginResult = {
  access_token: string;
  user: UserSession;
};

export const authApi = {
  async login(payload: { username: string; password: string }) {
    const data = useMock
      ? await mockLogin(payload.username)
      : (await httpClient.post<LoginResult>('/auth/login', payload)).data;

    setToken(data.access_token);
    return data;
  },
  async me() {
    return useMock
      ? mockMe()
      : (await httpClient.get<{ user: UserSession }>('/auth/me')).data;
  },
};
