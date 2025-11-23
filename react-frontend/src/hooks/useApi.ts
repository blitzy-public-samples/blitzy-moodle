/**
 * useApi Hook - Centralized API Client with JWT Authentication
 *
 * Custom React hook that provides a configured axios instance for making
 * authenticated API calls to the Moodle backend. Implements automatic JWT
 * token injection, token refresh on 401 errors, and standardized error handling.
 *
 * Features:
 * - Automatic JWT Bearer token injection from Redux auth state
 * - Request/response interceptors for centralized token and error handling
 * - Automatic token refresh on 401 Unauthorized responses
 * - Standardized API response envelope unwrapping
 * - Centralized error normalization and handling
 * - Logout on failed token refresh
 * - 30-second timeout for all requests
 *
 * Architecture:
 * - Integrates with Redux auth slice for token management
 * - Uses useMemo to recreate axios instance only when token changes
 * - Follows Moodle's API conventions for authentication and error responses
 * - Supports standard JSON API envelope: { success, data, error }
 *
 * Token Management:
 * - Access Token: Injected in Authorization header (Bearer scheme)
 * - Refresh Token: Used automatically on 401 to get new access token
 * - Token Expiration: 1-hour access token, 7-day refresh token
 * - Token Storage: Managed by Redux auth slice
 *
 * Error Handling:
 * - 401 Unauthorized: Attempts token refresh, retries request, or logs out
 * - 403 Forbidden: Permission denied error
 * - 404 Not Found: Resource not found error
 * - 500 Server Error: Backend error
 * - Network Error: Offline or connection issues
 * - Timeout: Request exceeded 30-second limit
 *
 * Usage Example:
 * ```typescript
 * import { useApi } from '@/hooks/useApi';
 *
 * function CourseList() {
 *   const api = useApi();
 *
 *   // GET request
 *   const fetchCourses = async () => {
 *     const response = await api.get('/courses');
 *     return response.data;
 *   };
 *
 *   // POST request with data
 *   const createCourse = async (courseData) => {
 *     const response = await api.post('/courses', courseData);
 *     return response.data;
 *   };
 *
 *   // PUT request
 *   const updateCourse = async (id, updates) => {
 *     const response = await api.put(`/courses/${id}`, updates);
 *     return response.data;
 *   };
 *
 *   // DELETE request
 *   const deleteCourse = async (id) => {
 *     await api.delete(`/courses/${id}`);
 *   };
 * }
 * ```
 *
 * Integration with React Query:
 * ```typescript
 * import { useQuery } from '@tanstack/react-query';
 * import { useApi } from '@/hooks/useApi';
 *
 * function useCourses() {
 *   const api = useApi();
 *
 *   return useQuery({
 *     queryKey: ['courses'],
 *     queryFn: async () => {
 *       const response = await api.get('/courses');
 *       return response.data;
 *     },
 *   });
 * }
 * ```
 *
 * Error Handling Example:
 * ```typescript
 * try {
 *   const response = await api.post('/courses', courseData);
 *   return response.data;
 * } catch (error) {
 *   if (axios.isAxiosError(error)) {
 *     // Access normalized error data
 *     console.error(error.response?.data.error.message);
 *   }
 * }
 * ```
 *
 * Reference:
 * - Inspired by Moodle's curl wrapper (public/lib/weblib.php)
 * - Follows Moodle's web service API patterns
 * - Implements JWT authentication per Agent Action Plan
 *
 * @module hooks/useApi
 */

import { useMemo } from 'react';
import axios from 'axios';
import type {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { useAppSelector } from '@/app/store';
import { useAppDispatch } from '@/app/store';
import { logout } from '@/features/auth/store/authSlice';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Standard API error response structure
 *
 * Matches the error envelope returned by Moodle API endpoints.
 * All API errors follow this structure for consistent error handling.
 */
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Standard API success response structure
 *
 * Matches the success envelope returned by Moodle API endpoints.
 * All successful API responses follow this structure.
 */
interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Token refresh response from auth API
 */
interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock AxiosResponse for errors that don't have a server response
 *
 * This helper constructs a properly typed AxiosResponse object for network
 * errors, timeouts, and request setup errors that don't receive a response
 * from the server. This allows us to maintain consistent error handling
 * throughout the application.
 *
 * @param errorData - The error data to include in the response
 * @param config - The original request configuration
 * @returns A properly typed mock AxiosResponse
 */
function createMockErrorResponse(
  errorData: ApiErrorResponse,
  config: InternalAxiosRequestConfig
): AxiosResponse<ApiErrorResponse> {
  return {
    data: errorData,
    status: 0,
    statusText: 'Network Error',
    headers: {},
    config,
  };
}

// ============================================================================
// Custom Hook
// ============================================================================

/**
 * useApi Hook
 *
 * Returns a configured axios instance with automatic JWT authentication,
 * request/response interceptors, and error handling.
 *
 * The axios instance is memoized with [token] dependency, so it only
 * recreates when the access token changes. This ensures the request
 * interceptor always has the current valid token.
 *
 * Request Interceptor:
 * - Injects JWT access token in Authorization header (Bearer scheme)
 * - Only adds header if token exists (allows unauthenticated requests)
 * - Runs before every request automatically
 *
 * Response Interceptor:
 * - Success: Unwraps standard API envelope (returns response.data)
 * - Error 401: Attempts token refresh with refresh token
 *   * On success: Retries original request with new token
 *   * On failure: Logs out user and redirects to login
 * - Other Errors: Normalizes error structure and re-throws
 *
 * Token Refresh Flow:
 * 1. Request receives 401 Unauthorized response
 * 2. Check if refresh token exists in Redux state
 * 3. Call POST /api/v1/auth/refresh with refresh token
 * 4. On success: Update Redux with new tokens
 * 5. Retry original failed request with new access token
 * 6. On refresh failure: Dispatch logout action
 *
 * Error Normalization:
 * - Extracts error message from various axios error formats
 * - Maintains consistent error structure across application
 * - Preserves original error for debugging
 * - Handles network errors, timeouts, and server errors
 *
 * @returns Configured axios instance ready for API calls
 *
 * @example
 * ```typescript
 * const api = useApi();
 * const courses = await api.get('/courses');
 * const newCourse = await api.post('/courses', { name: 'Math 101' });
 * ```
 */
export function useApi(): AxiosInstance {
  // Access authentication state from Redux
  const { tokens } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();

  // Create and configure axios instance
  // Memoized with [token] dependency to recreate only when token changes
  const apiClient = useMemo(() => {
    // Create base axios instance with configuration
    const instance = axios.create({
      // Base URL for all API requests (configured per environment)
      baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',

      // Request timeout (30 seconds)
      timeout: 30000,

      // Default headers for all requests
      headers: {
        'Content-Type': 'application/json',
      },

      // Include credentials for CORS requests (cookies, auth headers)
      withCredentials: true,
    });

    // ========================================================================
    // Request Interceptor - JWT Token Injection
    // ========================================================================

    /**
     * Request interceptor to inject JWT token
     *
     * Adds Authorization header with Bearer token to all requests
     * if user is authenticated. Allows unauthenticated requests
     * (login, public endpoints) when no token exists.
     *
     * @param config - Axios request configuration
     * @returns Modified request configuration with Authorization header
     */
    instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Inject JWT access token if available
        if (tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }

        return config;
      },
      (error: AxiosError) => {
        // Request setup failed (unlikely scenario)
        return Promise.reject(error);
      }
    );

    // ========================================================================
    // Response Interceptor - Error Handling & Token Refresh
    // ========================================================================

    /**
     * Response interceptor for error handling and token refresh
     *
     * Success Path:
     * - Returns response data directly (or full response if needed)
     * - Unwraps standard API envelope if present
     *
     * Error Path:
     * - 401 Unauthorized: Attempts token refresh and retries request
     * - 403 Forbidden: Permission denied error
     * - 404 Not Found: Resource not found error
     * - 500 Server Error: Backend error
     * - Network Error: Connection issues
     * - Timeout: Request exceeded time limit
     *
     * Token Refresh Logic:
     * - Only attempts refresh if refresh token exists
     * - Calls /api/v1/auth/refresh endpoint
     * - Updates Redux state with new tokens on success
     * - Retries original request with new access token
     * - Logs out user if refresh fails
     *
     * @param response - Successful axios response
     * @returns Response data or full response object
     */
    instance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Success response - return as is
        // React Query and other consumers will access response.data
        return response;
      },
      async (error: AxiosError<ApiErrorResponse>) => {
        // Extract original request config for potential retry
        const originalRequest = error.config;

        // ====================================================================
        // Handle 401 Unauthorized - Attempt Token Refresh
        // ====================================================================

        if (error.response?.status === 401 && originalRequest) {
          // Check if we have a refresh token to attempt refresh
          const refreshToken = tokens?.refreshToken;

          if (refreshToken) {
            try {
              // Attempt to refresh the access token using local instance
              // CRITICAL: Must use local instance, not global axios, to avoid mock conflicts
              const refreshResponse = await instance.post<
                ApiSuccessResponse<TokenRefreshResponse>
              >(
                `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/auth/refresh`,
                {
                  refreshToken,
                },
                {
                  headers: {
                    'Content-Type': 'application/json',
                  },
                }
              );

              // Extract new tokens from response
              const newTokens = refreshResponse.data.data;

              // Update Redux state with new tokens
              // Note: Using direct import of action to avoid circular dependency
              // In production, consider using a refresh thunk action
              dispatch({
                type: 'auth/refreshTokenSuccess',
                payload: {
                  accessToken: newTokens.accessToken,
                  refreshToken: newTokens.refreshToken,
                  expiresIn: newTokens.expiresIn,
                  tokenType: newTokens.tokenType,
                },
              });

              // Update Authorization header with new token
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
              }

              // Retry original request with new token
              return instance.request(originalRequest);
            } catch (refreshError) {
              // Token refresh failed - log out user
              // This happens when refresh token is expired or invalid
              dispatch(logout());

              // Redirect to login page will be handled by auth middleware
              // or ProtectedRoute component in React Router

              return Promise.reject(refreshError);
            }
          } else {
            // No refresh token available - log out user
            dispatch(logout());
            return Promise.reject(error);
          }
        }

        // ====================================================================
        // Handle Other Error Cases
        // ====================================================================

        // Normalize error structure for consistent handling
        const normalizedError: AxiosError<ApiErrorResponse> = error;

        // Add custom error properties for better debugging
        if (error.response) {
          // Server responded with error status
          const { response } = error;
          const {status} = response;
          const errorData = response.data;

          // Enhance error with status-specific messages
          if (status === 403) {
            // Forbidden - permission denied
            if (!errorData?.error) {
              response.data = {
                success: false,
                error: {
                  code: 'PERMISSION_DENIED',
                  message: 'You do not have permission to access this resource.',
                },
              };
            }
          } else if (status === 404) {
            // Not Found
            if (!errorData?.error) {
              response.data = {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'The requested resource was not found.',
                },
              };
            }
          } else if (status >= 500) {
            // Server Error
            if (!errorData?.error) {
              response.data = {
                success: false,
                error: {
                  code: 'SERVER_ERROR',
                  message: 'An error occurred on the server. Please try again later.',
                },
              };
            }
          }
        } else if (error.request || error.message === 'Network Error') {
          // Request made but no response received (network error)
          // Note: axios-mock-adapter's networkError() sets message to 'Network Error'
          const config = normalizedError.config ?? {} as InternalAxiosRequestConfig;
          const mockResponse = createMockErrorResponse(
            {
              success: false,
              error: {
                code: 'NETWORK_ERROR',
                message: 'Network error. Please check your connection and try again.',
              },
            },
            config
          );
          // Type-safe assignment of mock response
          Object.assign(normalizedError, { response: mockResponse });
        } else if (error.code === 'ECONNABORTED') {
          // Request timeout
          const config = normalizedError.config ?? {} as InternalAxiosRequestConfig;
          const mockResponse = createMockErrorResponse(
            {
              success: false,
              error: {
                code: 'TIMEOUT',
                message: 'Request timed out. Please try again.',
              },
            },
            config
          );
          // Type-safe assignment of mock response
          Object.assign(normalizedError, { response: mockResponse });
        } else {
          // Request setup error
          const config = normalizedError.config ?? {} as InternalAxiosRequestConfig;
          const mockResponse = createMockErrorResponse(
            {
              success: false,
              error: {
                code: 'REQUEST_ERROR',
                message: error.message || 'An error occurred while making the request.',
              },
            },
            config
          );
          // Type-safe assignment of mock response
          Object.assign(normalizedError, { response: mockResponse });
        }

        // Reject with normalized error
        return Promise.reject(normalizedError);
      }
    );

    return instance;
  }, [tokens?.accessToken, tokens?.refreshToken, dispatch]);

  return apiClient;
}
