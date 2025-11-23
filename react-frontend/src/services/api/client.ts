/**
 * Pre-configured Axios HTTP Client
 *
 * This module exports a pre-configured Axios instance that serves as the primary
 * interface for all API communication with the Moodle backend. The client is
 * configured with authentication, error handling, and response standardization.
 *
 * Features:
 * - Automatic JWT token injection via Authorization header
 * - Automatic token refresh on 401 Unauthorized errors
 * - Standardized error handling and response formatting
 * - CORS support with credentials (for httpOnly cookies)
 * - 30 second timeout for all requests
 * - Request/response logging in development mode
 * - Single instance pattern for connection reuse
 *
 * Usage:
 * ```typescript
 * import apiClient from '@/services/api/client';
 *
 * // GET request
 * const response = await apiClient.get('/courses');
 * const courses = response.data.data; // Unwrap standard envelope
 *
 * // POST request with data
 * const result = await apiClient.post('/auth/login', {
 *   username: 'student1',
 *   password: 'password123'
 * });
 *
 * // PUT request with dynamic URL
 * await apiClient.put(`/courses/${courseId}`, updateData);
 *
 * // DELETE request
 * await apiClient.delete(`/courses/${courseId}`);
 * ```
 *
 * Architecture Notes:
 * - This client should be used by ALL React Query hooks and API service functions
 * - Do NOT create separate Axios instances unless absolutely necessary
 * - Single instance enables connection pooling and consistent configuration
 * - Interceptors are applied via setupInterceptors() from ./interceptors
 *
 * Configuration:
 * - Base URL: Read from VITE_API_BASE_URL environment variable (default: /api/v1)
 * - Timeout: Read from VITE_API_TIMEOUT environment variable (default: 30000ms)
 * - Credentials: Always included for CORS requests (httpOnly cookie support)
 *
 * @module services/api/client
 */

import axios, { AxiosInstance, CreateAxiosDefaults } from 'axios';
import { setupInterceptors } from './interceptors';
import { API_BASE_URL } from './endpoints';

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * API base URL from environment variable with fallback
 *
 * Priority:
 * 1. VITE_API_BASE_URL environment variable (set in .env files)
 * 2. API_BASE_URL constant from endpoints.ts (default: '/api/v1')
 *
 * In production, this should be set to the full API URL including domain.
 * In development, relative path '/api/v1' works with Vite proxy configuration.
 */
const baseURL: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? API_BASE_URL;

/**
 * Request timeout in milliseconds
 *
 * Default: 30 seconds (30000ms)
 * Can be overridden via VITE_API_TIMEOUT environment variable
 *
 * Prevents hanging requests and resource leaks. Individual requests can override
 * this timeout if needed for long-running operations (e.g., file uploads).
 */
const timeout: number = (import.meta.env.VITE_API_TIMEOUT as string | undefined)
  ? parseInt(import.meta.env.VITE_API_TIMEOUT as string, 10)
  : 30000;

/**
 * Development mode flag
 *
 * Used to enable verbose logging and debugging features in development
 * without impacting production performance or security.
 */
const isDevelopment: boolean = import.meta.env.DEV === true;

// ============================================================================
// Axios Configuration
// ============================================================================

/**
 * Axios instance configuration
 *
 * This configuration object defines the default behavior for all API requests
 * made through the apiClient instance.
 *
 * Configuration Details:
 * - baseURL: All relative URLs are resolved against this base URL
 * - timeout: Maximum time to wait for response before aborting request
 * - headers: Default headers sent with every request
 * - withCredentials: Enable sending cookies in CORS requests (for httpOnly JWT storage)
 * - validateStatus: Custom function to determine if HTTP status is success or error
 *
 * Security Notes:
 * - withCredentials enables httpOnly cookies for secure token storage
 * - CORS must be properly configured on backend to allow credentials
 * - HTTPS should be enforced in production for secure communication
 */
const axiosConfig: CreateAxiosDefaults = {
  // Base URL for all API requests
  baseURL,

  // Request timeout (30 seconds default)
  timeout,

  // Default headers for all requests
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },

  // Enable credentials (cookies) for CORS requests
  // Required for httpOnly cookie-based JWT token storage
  withCredentials: true,

  // Custom status validation
  // Treat 2xx and 3xx status codes as successful
  // 4xx and 5xx will be handled by error interceptors
  validateStatus: (status: number): boolean => {
    return status >= 200 && status < 400;
  },
};

// ============================================================================
// Axios Instance Creation
// ============================================================================

/**
 * Main Axios HTTP client instance
 *
 * This is the primary API client used throughout the application. It is
 * pre-configured with base URL, timeout, headers, and interceptors.
 *
 * The instance is configured with:
 * - Request interceptors: Inject JWT tokens, add request metadata
 * - Response interceptors: Handle token refresh, standardize responses, format errors
 * - CORS support: Enable credentials for httpOnly cookie support
 * - Timeout handling: Prevent hanging requests with 30s timeout
 *
 * Singleton Pattern:
 * This instance is created once and reused throughout the application to:
 * - Reduce memory footprint
 * - Enable HTTP connection pooling and keep-alive
 * - Maintain consistent configuration across all API calls
 * - Simplify testing and mocking
 */
const apiClient: AxiosInstance = axios.create(axiosConfig);

// ============================================================================
// Apply Interceptors
// ============================================================================

/**
 * Configure request/response interceptors
 *
 * The setupInterceptors function from ./interceptors configures:
 *
 * Request Interceptors:
 * - Automatically inject JWT access token into Authorization header
 * - Add request metadata (timestamps, IDs) for tracking
 * - Handle request configuration and validation
 *
 * Response Interceptors:
 * - Automatically refresh expired tokens on 401 Unauthorized
 * - Queue concurrent requests during token refresh
 * - Standardize successful response format
 * - Transform errors into user-friendly format
 * - Handle network errors gracefully
 *
 * Token Refresh Flow:
 * 1. API request fails with 401 Unauthorized
 * 2. Interceptor detects expired access token
 * 3. Check if refresh is already in progress (queue request if so)
 * 4. Call refreshAccessToken() to get new access token
 * 5. Retry original request with new token
 * 6. Process all queued requests with new token
 * 7. On refresh failure, clear tokens and redirect to login
 *
 * This must be called AFTER creating the instance but BEFORE using it
 * to ensure all requests benefit from authentication and error handling.
 */
setupInterceptors(apiClient);

// ============================================================================
// Development Mode Logging
// ============================================================================

/**
 * Development-only request/response logging
 *
 * In development mode, log all requests and responses to the console
 * for debugging and troubleshooting. This helps developers:
 * - Verify API calls are being made correctly
 * - Inspect request/response data structure
 * - Debug authentication and authorization issues
 * - Track API performance
 *
 * Security Notes:
 * - Logging is ONLY enabled in development mode
 * - Never log sensitive data (tokens, passwords) even in development
 * - Production builds automatically strip this code via tree shaking
 *
 * Performance Notes:
 * - Console logging has minimal performance impact in development
 * - Code is completely removed in production builds
 * - No runtime checks needed in production
 */
if (isDevelopment) {
  // Request logging interceptor
  apiClient.interceptors.request.use(
    (config) => {
      console.log('🚀 API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        params: config.params,
        // Only log data for non-GET requests to avoid clutter
        ...(config.method?.toUpperCase() !== 'GET' && { data: config.data }),
      });
      return config;
    },
    (error) => {
      console.error('❌ Request Error:', error);
      return Promise.reject(error);
    }
  );

  // Response logging interceptor
  apiClient.interceptors.response.use(
    (response) => {
      console.log('✅ API Response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.config.url,
        // Only log first 100 chars of data to avoid console overflow
        data:
          typeof response.data === 'string'
            ? response.data.substring(0, 100) + (response.data.length > 100 ? '...' : '')
            : response.data,
      });
      return response;
    },
    (error) => {
      console.error('❌ Response Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        message: error.message,
        // Only log error response data, not full error object
        data: error.response?.data,
      });
      return Promise.reject(error);
    }
  );
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Export the configured Axios client instance
 *
 * Default export for convenient importing:
 * ```typescript
 * import apiClient from '@/services/api/client';
 * ```
 *
 * Named export for explicit imports:
 * ```typescript
 * import { apiClient } from '@/services/api/client';
 * ```
 *
 * Usage Examples:
 *
 * 1. Simple GET request:
 * ```typescript
 * const response = await apiClient.get('/courses');
 * const courses = response.data.data;
 * ```
 *
 * 2. POST request with data:
 * ```typescript
 * const response = await apiClient.post('/courses', {
 *   fullname: 'Introduction to React',
 *   shortname: 'REACT101',
 *   categoryid: 1
 * });
 * ```
 *
 * 3. PUT request with dynamic URL:
 * ```typescript
 * await apiClient.put(`/courses/${courseId}`, {
 *   fullname: 'Updated Course Name'
 * });
 * ```
 *
 * 4. DELETE request:
 * ```typescript
 * await apiClient.delete(`/courses/${courseId}`);
 * ```
 *
 * 5. With React Query:
 * ```typescript
 * const { data } = useQuery({
 *   queryKey: ['courses', courseId],
 *   queryFn: () => apiClient.get(`/courses/${courseId}`).then(res => res.data.data)
 * });
 * ```
 *
 * 6. With custom config:
 * ```typescript
 * await apiClient.post('/files/upload', formData, {
 *   headers: { 'Content-Type': 'multipart/form-data' },
 *   timeout: 60000, // 60 seconds for file upload
 *   onUploadProgress: (progressEvent) => {
 *     const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
 *     console.log(`Upload progress: ${percentCompleted}%`);
 *   }
 * });
 * ```
 *
 * Error Handling:
 * All errors are automatically formatted by the response interceptor:
 * ```typescript
 * try {
 *   await apiClient.post('/courses', courseData);
 * } catch (error) {
 *   // Error is already formatted with message, code, and status
 *   console.error(error.message); // User-friendly message
 *   console.error(error.code);    // Error code (e.g., 'PERMISSION_DENIED')
 *   console.error(error.status);  // HTTP status code
 * }
 * ```
 *
 * Authentication:
 * Token injection is automatic via request interceptor:
 * - Tokens are retrieved from authService
 * - Authorization header is automatically added
 * - Token refresh is automatic on 401 errors
 * - No manual token management needed in components
 *
 * Best Practices:
 * - Use this client for ALL API calls (don't create separate instances)
 * - Let interceptors handle authentication and error formatting
 * - Use React Query hooks for data fetching (wraps this client)
 * - Handle loading and error states in components, not here
 * - Don't catch errors unless you need custom handling
 * - Trust the interceptors for token management
 */
export default apiClient;

/**
 * Named export for explicit imports
 *
 * Provides the same instance as the default export
 */
export { apiClient };
