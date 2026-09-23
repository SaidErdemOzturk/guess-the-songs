import { env } from '@/config/env';
import type { ApiError } from '@/types/api';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean>): string {
    const url = new URL(`${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    return url.toString();
  }

  public async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, ...customConfig } = options;
    const url = this.buildUrl(endpoint, params);

    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const config: RequestInit = {
      headers: {
        ...defaultHeaders,
        ...headers,
      },
      ...customConfig,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorData: Partial<ApiError>;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: response.statusText };
        }
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      // Kurumsal merkezi logging/monitoring servisine (Sentry vb.) hata gönderme noktası
      console.error(`[ApiClient Error]: ${endpoint}`, error);
      throw error;
    }
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

export const apiClient = new ApiClient(env.apiBaseUrl);
