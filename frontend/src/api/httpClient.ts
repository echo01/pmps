import { ApiClientError, ApiResponse } from './apiResponse';
import { logger } from '../utils/logger';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export function getToken() {
  return localStorage.getItem('access_token') || '';
}

export function setToken(token: string) {
  localStorage.setItem('access_token', token);
}

export function clearToken() {
  localStorage.removeItem('access_token');
}

function buildUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseJson(response: Response) {
  return response.json().catch(() => null);
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = buildUrl(path);
  const token = getToken();

  logger.info('[API][REQUEST][START]', { method: options.method || 'GET', path });

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const json = await parseJson(response);

  if (!response.ok) {
    const error = new ApiClientError(json?.message || 'Request failed', {
      status: response.status,
      errorCode: json?.error_code,
      requestId: json?.meta?.request_id,
      errors: json?.errors,
    });

    logger.error('[API][REQUEST][API_ERROR]', {
      method: options.method || 'GET',
      path,
      status: error.status,
      error_code: error.errorCode,
      request_id: error.requestId,
    });

    if (error.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent('pmps:unauthorized'));
    }

    throw error;
  }

  logger.info('[API][REQUEST][API_SUCCESS]', { method: options.method || 'GET', path, status: response.status });
  return json as ApiResponse<T>;
}

export async function apiDownload(path: string): Promise<Blob> {
  const url = buildUrl(path);
  const token = getToken();

  logger.info('[API][DOWNLOAD][START]', { path });

  const response = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const json = await parseJson(response);
    const error = new ApiClientError(json?.message || 'Download failed', {
      status: response.status,
      errorCode: json?.error_code,
      requestId: json?.meta?.request_id,
      errors: json?.errors,
    });

    logger.error('[API][DOWNLOAD][API_ERROR]', {
      path,
      status: error.status,
      error_code: error.errorCode,
      request_id: error.requestId,
    });

    if (error.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent('pmps:unauthorized'));
    }

    throw error;
  }

  logger.info('[API][DOWNLOAD][API_SUCCESS]', { path, status: response.status });
  return response.blob();
}

export const httpClient = {
  get<T>(path: string) {
    return apiRequest<T>(path, { method: 'GET' });
  },
  post<T>(path: string, body: unknown) {
    return apiRequest<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
