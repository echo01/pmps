export type ApiErrorItem = {
  field?: string;
  message: string;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  errors?: ApiErrorItem[];
  error_code?: string;
  meta?: {
    request_id?: string;
    pagination?: {
      page: number;
      page_size: number;
      total: number;
      total_pages: number;
    };
  };
};

export class ApiClientError extends Error {
  status: number;
  errorCode?: string;
  requestId?: string;
  errors: ApiErrorItem[];

  constructor(message: string, options: {
    status: number;
    errorCode?: string;
    requestId?: string;
    errors?: ApiErrorItem[];
  }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.errorCode = options.errorCode;
    this.requestId = options.requestId;
    this.errors = options.errors || [];
  }
}
