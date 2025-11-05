/**
 * API Client Configuration
 *
 * Provides a configured Axios instance for making HTTP requests to the Moodle API.
 * Includes request/response interceptors for:
 * - JWT token injection
 * - Token refresh on expiration
 * - Error handling and transformation
 * - Request/response logging (development only)
 *
 * All API endpoints use this client to ensure consistent authentication,
 * error handling, and request/response processing.
 *
 * Based on Agent Action Plan requirements:
 * - JWT tokens in Authorization header
 * - Automatic token refresh on 401 responses
 * - Standard error response transformation
 * - CORS support for cross-origin requests
 *
 * @package react-frontend
 * @subpackage services/api
 */

import type { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';
import type { ApiResponse, ApiErrorResponse } from '@/types/api';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Authentication token refresh response
 */
interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * Error response structure from API
 */
interface ApiErrorData {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Base URL for API requests
 * Defaults to /api/v1 for same-origin requests
 * Can be overridden via VITE_API_BASE_URL environment variable
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';

/**
 * Request timeout in milliseconds
 * Can be overridden via VITE_API_TIMEOUT environment variable
 */
const API_TIMEOUT = parseInt(
  (import.meta.env.VITE_API_TIMEOUT as string | undefined) ?? '30000',
  10
);

/**
 * Whether to include credentials (cookies) in requests
 */
const WITH_CREDENTIALS = import.meta.env.VITE_API_WITH_CREDENTIALS !== 'false';

// ============================================================================
// AXIOS INSTANCE
// ============================================================================

/**
 * Configured Axios instance for API requests
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  withCredentials: WITH_CREDENTIALS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Storage key for JWT access token
 */
const ACCESS_TOKEN_KEY = 'moodle_access_token';

/**
 * Storage key for JWT refresh token
 */
const REFRESH_TOKEN_KEY = 'moodle_refresh_token';

/**
 * Get access token from storage
 */
export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
}

/**
 * Get refresh token from storage
 */
export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get refresh token:', error);
    return null;
  }
}

/**
 * Store authentication tokens
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch (error) {
    console.error('Failed to store tokens:', error);
  }
}

/**
 * Clear authentication tokens
 */
export function clearTokens(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to clear tokens:', error);
  }
}

// ============================================================================
// REQUEST INTERCEPTOR
// ============================================================================

/**
 * Request interceptor to inject JWT token
 * Adds Authorization header with Bearer token for all authenticated requests
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log request in development
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params as Record<string, unknown> | undefined,
        data: config.data as unknown,
      });
    }

    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// ============================================================================
// RESPONSE INTERCEPTOR
// ============================================================================

/**
 * Flag to prevent infinite refresh loops
 */
let isRefreshing = false;

/**
 * Queue of pending requests waiting for token refresh
 */
let refreshSubscribers: Array<(token: string) => void> = [];

/**
 * Add request to refresh queue
 */
function subscribeTokenRefresh(callback: (token: string) => void): void {
  refreshSubscribers.push(callback);
}

/**
 * Process queued requests after token refresh
 */
function onTokenRefreshed(token: string): void {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    // Call refresh endpoint without interceptors to avoid infinite loop
    const response = await axios.post<ApiResponse<TokenRefreshResponse>>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { withCredentials: WITH_CREDENTIALS }
    );

    const tokenData = response.data;
    const { accessToken, refreshToken: newRefreshToken } =
      'data' in tokenData ? tokenData.data : { accessToken: '', refreshToken: '' };

    setTokens(accessToken, newRefreshToken);

    return accessToken;
  } catch (error) {
    console.error('[Token Refresh Error]', error);
    clearTokens();

    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }

    return null;
  }
}

/**
 * Response interceptor for error handling and token refresh
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log response in development
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(
        `[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`,
        {
          status: response.status,
          data: response.data as unknown,
        }
      );
    }

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Log error in development
    if (import.meta.env.DEV) {
      console.error('[API Response Error]', {
        url: originalRequest?.url,
        status: error.response?.status,
        data: error.response?.data,
      });
    }

    // Handle 401 Unauthorized - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for ongoing refresh to complete
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const newToken = await refreshAccessToken();

      isRefreshing = false;

      if (newToken) {
        onTokenRefreshed(newToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }

        return apiClient(originalRequest);
      }
    }

    // Transform error response to Error object with additional metadata
    const errorData = error.response?.data as ApiErrorData | undefined;
    const errorMessage = errorData?.error?.message ?? error.message ?? 'An unexpected error occurred';
    const errorCode = errorData?.error?.code ?? 'UNKNOWN_ERROR';
    
    // Create a proper Error object with message property
    const apiError = new Error(errorMessage) as Error & {
      code: string;
      status?: number;
      details?: Record<string, unknown>;
      response?: typeof error.response;
    };
    
    // Add metadata to error object
    apiError.code = errorCode;
    apiError.status = error.response?.status;
    apiError.details = errorData?.error?.details;
    apiError.response = error.response; // Preserve original axios response for compatibility

    return Promise.reject(apiError);
  }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract data from successful API response
 * Handles both standard ApiResponse and direct data responses
 */
export function extractData<T>(response: AxiosResponse<ApiResponse<T>>): T {
  // Handle 204 No Content responses
  if (response.status === 204 || response.data === null) {
    return undefined as unknown as T;
  }

  if (response.data && 'success' in response.data && response.data.success) {
    return response.data.data;
  }

  // Fallback for non-standard responses
  return response.data as unknown as T;
}

/**
 * Check if error is an API error response
 */
export function isApiError(error: unknown): error is ApiErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'success' in error &&
    error.success === false &&
    'error' in error
  );
}

/**
 * Get error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Default export is the configured Axios instance
 */
export default apiClient;
