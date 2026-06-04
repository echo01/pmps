const API_BASE_URL = localStorage.getItem('pmps_api_base_url') || 'http://localhost:3000/api';

export function getToken() {
  return localStorage.getItem('access_token') || '';
}

export function setToken(token) {
  localStorage.setItem('access_token', token);
}

export function clearToken() {
  localStorage.removeItem('access_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.message || 'Request failed');
    error.status = response.status;
    error.errorCode = data?.error_code;
    error.errors = data?.errors || [];
    error.response = data;
    throw error;
  }

  return data;
}

export const httpClient = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) => request(path, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
};
