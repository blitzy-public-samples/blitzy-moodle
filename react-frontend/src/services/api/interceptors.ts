/**
 * Axios Request/Response Interceptors
 *
 * This module provides comprehensive interceptor functions for the Axios HTTP client
 * to handle authentication, token refresh, error handling, and response standardization.
 *
 * Key Features:
 * - Automatic JWT token injection into request Authorization headers
 * - Automatic token refresh on 401 Unauthorized errors with request retry
 * - Token refresh queue management to prevent concurrent refresh requests
 * - Standardized error response formatting with user-friendly messages
 * - Network error handling with graceful degradation
 * - Success response standardization and unwrapping
 *
 * Token Refresh Flow:
 * 1. API request fails with 401 Unauthorized
 * 2. Interceptor detects expired access token
 * 3. Check if refresh is already in progress (queue subsequent requests)
 * 4. Call refreshAccessToken() to get new access token
 * 5. Retry original request with new token
 * 6. Process queued requests with new token
 * 7. On refresh failure, clear tokens and redirect to login
 *
 * Race Condition Prevention:
 * - Multiple simultaneous 401 errors trigger only ONE refresh request
 * - Subsequent requests are queued and resolved after refresh completes
 * - Mutex pattern ensures thread safety for token refresh operations
 *
 * Security Considerations:
 * - Never log token values in production
 * - Clear all tokens on refresh failure
 * - Redirect to login on authentication failure
 * - Prevent infinite refresh loops with _retry flag
 *
 * @module services/api/interceptors
 */

import type {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import {
  getAccessToken,
  refreshAccessToken,
  clearTokens,
} from '../auth/authService';

// ============================================================================
// TypeScript Type Definitions
// ============================================================================

/**
 * Extend Axios request config to include custom properties
 *
 * - _retry: Prevents infinite refresh loops by tracking retries
 * - _requestStartTime: Tracks request start time for performance monitoring
 */
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    /**
     * Flag indicating if this request has already been retried after token refresh
     * Used to prevent infinite refresh loops when refresh itself fails with 401
     */
    _retry?: boolean;

    /**
     * Request start timestamp for performance tracking (development only)
     */
    _requestStartTime?: number;
  }
}

/**
 * Queued request structure for managing concurrent 401 errors
 *
 * When multiple requests fail with 401 simultaneously, they are queued
 * and resolved/rejected together after the token refresh completes.
 */
interface QueuedRequest {
  /**
   * Resolve callback - called with new access token on successful refresh
   */
  resolve: (token: string) => void;

  /**
   * Reject callback - called with error on refresh failure
   */
  reject: (error: Error) => void;
}

/**
 * API error response structure
 *
 * Defines the expected structure of error responses from the API
 * following the standard error envelope format.
 */
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Standard API success response envelope
 *
 * All API responses should follow this structure for consistency
 */
interface StandardApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

// ============================================================================
// Token Refresh State Management
// ============================================================================

/**
 * Mutex lock for token refresh operations
 *
 * Prevents concurrent refresh requests which could cause race conditions.
 * When multiple API calls fail with 401 simultaneously, only one refresh
 * request should be made. Other calls queue their requests.
 *
 * This is critical for preventing:
 * - Multiple simultaneous refresh API calls
 * - Token overwrite race conditions
 * - Unnecessary server load
 */
let isRefreshing = false;

/**
 * Queue of failed requests waiting for token refresh
 *
 * Requests that fail with 401 while a refresh is in progress are added
 * to this queue. Once refresh completes, all queued requests are either
 * resolved with the new token or rejected with the refresh error.
 */
let failedQueue: QueuedRequest[] = [];

/**
 * Process all queued requests after token refresh completes
 *
 * This function is called after refreshAccessToken() resolves or rejects.
 * It iterates through all requests that were queued during the refresh
 * operation and either resolves them with the new token or rejects them
 * with the error.
 *
 * @param error - Error from refresh operation (null if successful)
 * @param token - New access token (null if refresh failed)
 *
 * @example
 * ```typescript
 * // On successful refresh
 * processQueue(null, newAccessToken);
 * // All queued requests are resolved and retried with new token
 *
 * // On refresh failure
 * processQueue(new Error('Refresh failed'), null);
 * // All queued requests are rejected with the error
 * ```
 */
function processQueue(error: Error | null, token: string | null = null): void {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });

  // Clear the queue after processing
  failedQueue = [];
}

// ============================================================================
// Request Interceptor
// ============================================================================

/**
 * Request interceptor to inject JWT access token into Authorization header
 *
 * This interceptor runs before every API request and automatically adds
 * the JWT access token to the Authorization header if a valid token exists.
 *
 * The interceptor:
 * - Retrieves the access token from secure storage
 * - Adds "Bearer <token>" to Authorization header if token exists
 * - Ensures Content-Type is set (defaults to application/json)
 * - Preserves any existing headers
 *
 * Security Notes:
 * - Token is retrieved from authService (handles storage abstraction)
 * - No token validation is performed here (handled by response interceptor)
 * - Token is never logged in production
 *
 * @param config - Axios request configuration object
 * @returns Modified request configuration with Authorization header
 *
 * @example
 * ```typescript
 * // Request without manual token handling
 * const response = await apiClient.get('/courses');
 * // Interceptor automatically adds: Authorization: Bearer <token>
 * ```
 */
function onRequest(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  console.log('[Interceptor onRequest] ENTRY - config.url:', config.url);
  console.log('[Interceptor onRequest] ENTRY - config.baseURL:', config.baseURL);
  
  // Retrieve access token from secure storage
  const token = getAccessToken();
  console.log('[Interceptor onRequest] token retrieved:', token);

  // Inject token into Authorization header if available
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Ensure Content-Type is set (default to JSON for API requests)
  if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }

  // Optional: Add request timestamp for performance tracking
  if (import.meta.env.DEV) {
    config._requestStartTime = Date.now();
  }

  console.log('[Interceptor onRequest] EXIT - config.url:', config.url);
  console.log('[Interceptor onRequest] EXIT - config.headers.Authorization:', config.headers.Authorization);
  return config;
}

/**
 * Request error handler
 *
 * Handles errors that occur before the request is sent (e.g., network
 * configuration errors, invalid request setup).
 *
 * @param error - Axios error object
 * @returns Rejected promise with error
 */
function onRequestError(error: AxiosError): Promise<never> {
  if (import.meta.env.DEV) {
    console.error('[Interceptor] Request setup error:', error.message);
  }

  return Promise.reject(error);
}

// ============================================================================
// Response Interceptor - Success
// ============================================================================

/**
 * Response success interceptor for standardizing API responses
 *
 * This interceptor runs after every successful API response (2xx status).
 * It ensures responses follow a consistent format and optionally tracks
 * response times for performance monitoring.
 *
 * Response Format:
 * - Backend should return: { success: true, data: {...}, meta: {...} }
 * - If response doesn't follow format, it's wrapped in standard envelope
 *
 * @param response - Axios response object
 * @returns Standardized response object
 *
 * @example
 * ```typescript
 * // Backend returns standard format
 * { success: true, data: { id: 1, name: 'Course' } }
 * // Returned as-is
 *
 * // Backend returns non-standard format
 * { id: 1, name: 'Course' }
 * // Wrapped: { success: true, data: { id: 1, name: 'Course' } }
 * ```
 */
function onResponse(response: AxiosResponse): AxiosResponse {
  // Track response time in development
  if (import.meta.env.DEV && response.config._requestStartTime) {
    const duration = Date.now() - response.config._requestStartTime;
    // eslint-disable-next-line no-console
    console.debug(`[Interceptor] Request completed in ${duration}ms:`, response.config.url);
  }

  // Check if response follows standard envelope format
  // Type guard to check if data is already in StandardApiResponse format
  const hasStandardFormat: boolean =
    response.data !== null &&
    response.data !== undefined &&
    typeof response.data === 'object' &&
    'success' in response.data &&
    'data' in response.data;

  // Return as-is if already standardized
  if (hasStandardFormat) {
    return response;
  }

  // Wrap non-standard responses in standard envelope
  // This ensures consistent data access patterns across the application
  // Store original data before wrapping to satisfy type checker
  const originalData: unknown = response.data;
  const wrappedData: StandardApiResponse = {
    success: true,
    data: originalData,
    meta: {},
  };
  response.data = wrappedData;

  return response;
}

// ============================================================================
// Response Interceptor - Error
// ============================================================================

/**
 * Create response error handler with closure over axios instance
 *
 * This factory function creates an error handler that has access to the specific
 * axios instance via closure. This is necessary because the handler needs to use
 * the same instance (with its baseURL and other config) when retrying requests.
 *
 * @param axiosInstance - The axios instance to use for retries
 * @returns Error handler function configured for the given instance
 */
function createOnResponseError(axiosInstance: AxiosInstance) {
  /**
   * Response error interceptor with automatic token refresh on 401 errors
   *
   * This is the core interceptor that handles all API errors, with special
   * logic for 401 Unauthorized errors that trigger automatic token refresh.
   *
   * Error Handling by Status Code:
   * - 401: Attempt token refresh and retry request
   * - 403: Permission denied error
   * - 404: Not found error
   * - 5xx: Server error
   * - Network errors: Connection/timeout errors
   *
   * Token Refresh Flow:
   * 1. Detect 401 error (expired access token)
   * 2. Check if request was already retried (prevent infinite loops)
   * 3. Check if refresh is in progress (queue if so)
   * 4. Call refreshAccessToken() to get new token
   * 5. Retry original request with new token
   * 6. On refresh failure, clear tokens and redirect to login
   *
   * Race Condition Handling:
   * - If refresh is already in progress, queue the request
   * - Once refresh completes, process all queued requests
   * - All requests get the same new token
   *
   * @param error - Axios error object
   * @returns Promise that resolves with retried response or rejects with error
   *
   * @example
   * ```typescript
   * // Request fails with 401
   * // Interceptor automatically:
   * // 1. Refreshes token
   * // 2. Retries request with new token
   * // 3. Returns successful response (transparent to caller)
   * ```
   */
  return async function onResponseError(error: AxiosError): Promise<AxiosResponse> {
  const originalRequest = error.config;

  // ============================================================================
  // Handle 401 Unauthorized - Token Refresh Logic
  // ============================================================================

  if (error.response?.status === 401 && originalRequest) {
    // Prevent infinite refresh loops
    // If this request was already retried after refresh, don't retry again
    if (originalRequest._retry) {
      if (import.meta.env.DEV) {
        console.warn('[Interceptor] Token refresh failed permanently, redirecting to login');
      }

      // Clear all tokens and redirect to login
      clearTokens();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Check if a refresh is already in progress
    // If so, queue this request and wait for refresh to complete
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            // Update request with new token and retry
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(axiosInstance.request(originalRequest));
          },
          reject: (err: Error) => {
            reject(err);
          },
        });
      });
    }

    // Mark this request as retried to prevent infinite loops
    originalRequest._retry = true;

    // Set refresh flag to queue subsequent 401 errors
    isRefreshing = true;

    try {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[Interceptor] Refreshing access token due to 401 error');
      }

      // Attempt to refresh the access token
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[Interceptor] Calling refreshAccessToken()...');
      }
      
      const newAccessToken = await refreshAccessToken();
      
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[Interceptor] refreshAccessToken() returned:', newAccessToken ? 'token received' : 'null/undefined');
      }

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[Interceptor] Token refresh successful, retrying request');
      }

      // Reset refresh flag
      isRefreshing = false;

      // Process all queued requests with new token
      processQueue(null, newAccessToken);

      // Update original request with new token and retry
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[Interceptor] About to retry request. Details:', {
          url: originalRequest.url,
          baseURL: originalRequest.baseURL,
          method: originalRequest.method,
          fullConfig: JSON.stringify(originalRequest, null, 2),
        });
      }
      
      try {
        const retryResponse = await axiosInstance.request(originalRequest);
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.debug('[Interceptor] Retry succeeded:', retryResponse.status);
        }
        return retryResponse;
      } catch (retryError) {
        if (import.meta.env.DEV) {
           
          console.error('[Interceptor] Retry failed with error:', retryError);
        }
        throw retryError;
      }
    } catch (refreshError) {
      // Reset refresh flag
      isRefreshing = false;

      // Reject all queued requests
      processQueue(refreshError as Error, null);

      if (import.meta.env.DEV) {
        console.error('[Interceptor] Token refresh failed:', refreshError);
      }

      // Clear all tokens and redirect to login
      clearTokens();
      window.location.href = '/login';

      return Promise.reject(refreshError);
    }
  }

  // ============================================================================
  // Handle 403 Forbidden - Permission Denied
  // ============================================================================

  if (error.response?.status === 403) {
    const permissionError = {
      message: 'You do not have permission to perform this action',
      code: 'PERMISSION_DENIED',
      status: 403,
      details: error.response.data,
    };

    if (import.meta.env.DEV) {
      console.warn('[Interceptor] Permission denied:', error.config?.url);
    }

    return Promise.reject(permissionError);
  }

  // ============================================================================
  // Handle 404 Not Found
  // ============================================================================

  if (error.response?.status === 404) {
    const notFoundError = {
      message: 'The requested resource was not found',
      code: 'NOT_FOUND',
      status: 404,
      details: {
        url: error.config?.url,
      },
    };

    if (import.meta.env.DEV) {
      console.warn('[Interceptor] Resource not found:', error.config?.url);
    }

    return Promise.reject(notFoundError);
  }

  // ============================================================================
  // Handle 5xx Server Errors
  // ============================================================================

  if (error.response && error.response.status >= 500) {
    const serverError = {
      message: 'A server error occurred. Please try again later.',
      code: 'SERVER_ERROR',
      status: error.response.status,
      details: import.meta.env.DEV ? error.response.data : undefined,
    };

    if (import.meta.env.DEV) {
      console.error('[Interceptor] Server error:', error.response.status, error.config?.url);
    }

    return Promise.reject(serverError);
  }

  // ============================================================================
  // Handle Network Errors (no response)
  // ============================================================================

  if (!error.response) {
    const networkError = {
      message: 'Network error. Please check your connection.',
      code: 'NETWORK_ERROR',
      status: 0,
      details: {
        message: error.message,
      },
    };

    if (import.meta.env.DEV) {
      console.error('[Interceptor] Network error:', error.message);
    }

    return Promise.reject(networkError);
  }

  // ============================================================================
  // Handle All Other Errors
  // ============================================================================

  // Type cast to ApiErrorResponse to safely access error properties
  const responseData = error.response?.data as ApiErrorResponse | undefined;
  
  const defaultError = {
    message: responseData?.error?.message ?? error.message ?? 'An unexpected error occurred',
    code: responseData?.error?.code ?? 'UNKNOWN_ERROR',
    status: error.response?.status ?? 0,
    details: import.meta.env.DEV ? error.response?.data : undefined,
  };

  if (import.meta.env.DEV) {
    console.error('[Interceptor] Unhandled error:', error.response?.status, error.config?.url);
  }

  return Promise.reject(defaultError);
  };
}

// ============================================================================
// Main Setup Function
// ============================================================================

/**
 * Configure Axios instance with request/response interceptors
 *
 * This function sets up all interceptors on the provided Axios instance:
 * - Request interceptor: Injects JWT tokens into Authorization headers
 * - Response success interceptor: Standardizes response format
 * - Response error interceptor: Handles 401 errors with token refresh
 *
 * The interceptors are chained in order:
 * 1. Request interceptors run before request is sent
 * 2. Response interceptors run after response is received
 * 3. Error interceptors run if request or response fails
 *
 * Usage:
 * ```typescript
 * import axios from 'axios';
 * import { setupInterceptors } from './interceptors';
 *
 * const apiClient = axios.create({ baseURL: '/api/v1' });
 * setupInterceptors(apiClient);
 *
 * // Now all requests automatically include JWT tokens
 * // and handle token refresh on 401 errors
 * apiClient.get('/courses');
 * ```
 *
 * @param axiosInstance - Axios instance to configure with interceptors
 * @returns The configured Axios instance (for chaining)
 *
 * @example
 * ```typescript
 * // Create and configure API client in one line
 * const apiClient = setupInterceptors(
 *   axios.create({ baseURL: '/api/v1' })
 * );
 * ```
 */
export function setupInterceptors(axiosInstance: AxiosInstance): AxiosInstance {
  // Create error handler with closure over this specific axios instance
  const onResponseError = createOnResponseError(axiosInstance);

  // Register request interceptors
  axiosInstance.interceptors.request.use(onRequest, onRequestError);

  // Register response interceptors
  axiosInstance.interceptors.response.use(onResponse, onResponseError);

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[Interceptor] API interceptors configured successfully');
  }

  return axiosInstance;
}
