import { httpClient, setToken } from './httpClient.js';

export const authApi = {
  async login(payload) {
    const response = await httpClient.post('/auth/login', payload);
    const token = response?.data?.access_token;

    if (token) {
      setToken(token);
    }

    return response;
  },
};
