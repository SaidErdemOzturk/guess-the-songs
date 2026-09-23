export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
  timestamp: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
  details?: Record<string, string[]>;
}

export type AsyncState<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
};
