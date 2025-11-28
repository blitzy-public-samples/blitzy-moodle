/**
 * Authentication API Client Module
 *
 * Provides TypeScript functions for all authentication operations including login,
 * logout, token refresh, user profile retrieval, and password reset. Wraps RESTful
 * API calls to /api/v1/auth/* endpoints using the axios HTTP client.
 *
 * This module implements the API client layer for authentication, providing a clean
 * separation between API communication (this file) and React Query hooks (in hooks
 * directory). All functions return properly typed responses with comprehensive error
 * handling following the standard API response envelope pattern.
 *
 * Architecture Notes:
 * - Calls backend API endpoints that wrap existing Moodle authentication functions:
 *   - POST /api/v1/auth/login → authenticate_user_login() + complete_user_login()
 *   - POST /api/v1/auth/logout → require_logout()
 *   - POST /api/v1/auth/refresh → JWT token refresh logic
 *   - GET /api/v1/auth/me → Current user from JWT payload
 *   - POST /api/v1/auth/reset-password → core_login_process_password_reset()
 *
 * - Supports all existing Moodle authentication plugins (LDAP, SSO, OAuth, local)
 *   through the backend API without any modification to authentication logic
 *
 * - JWT tokens follow the specification from Section 0.1:
 *   - Access token: 1-hour expiration
 *   - Refresh token: 7-day expiration
 *   - HS256 algorithm with 256-bit secret
 *
 * @module features/auth/api/authApi
 * @see public/login/index.php - authenticate_user_login() at line 158, complete_user_login() at line 215
 * @see public/login/logout.php - require_logout() at line 62
 * @see public/login/lib.php - core_login_process_password_reset()
 */

import type { AxiosResponse } from 'axios';
import { apiClient } from '@/services/api/client';
import type { JwtTokens } from '@/types/api';
import type { User } from '../types/auth.types';

/**
 * Re-export User as AuthUser for use in authentication contexts
 *
 * This provides a semantic alias that makes it clear when a User type
 * is being used specifically in authentication operations.
 */
export type AuthUser = User;

// ============================================================================
// Query Key Constants
// ============================================================================

/**
 * React Query key for current user data
 *
 * Used for cache management, invalidation, and optimistic updates.
 * Export this constant to ensure consistent key usage across the app.
 *
 * @example
 * ```typescript
 * // In useAuth hook
 * const { data: user } = useQuery({
 *   queryKey: CURRENT_USER_QUERY_KEY,
 *   queryFn: getCurrentUser
 * });
 *
 * // To invalidate after logout
 * queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
 * ```
 */
export const CURRENT_USER_QUERY_KEY = ['auth', 'currentUser'] as const;

/**
 * React Query key for login mutations
 */
export const LOGIN_MUTATION_KEY = ['auth', 'login'] as const;

/**
 * React Query key for logout mutations
 */
export const LOGOUT_MUTATION_KEY = ['auth', 'logout'] as const;

/**
 * React Query key for token refresh mutations
 */
export const REFRESH_TOKEN_MUTATION_KEY = ['auth', 'refresh'] as const;

// ============================================================================
// API Endpoint Constants
// ============================================================================

/**
 * Authentication API endpoint paths
 *
 * These are relative paths appended to the base URL configured in apiClient.
 * The base URL is /api/v1 by default.
 */
const AUTH_API_ENDPOINTS = {
  /** POST - Authenticate user with credentials, returns JWT tokens and user data */
  LOGIN: '/auth/login',

  /** POST - Invalidate JWT token and end session */
  LOGOUT: '/auth/logout',

  /** POST - Exchange refresh token for new access token */
  REFRESH: '/auth/refresh',

  /** GET - Retrieve current user profile from JWT token payload */
  ME: '/auth/me',

  /** POST - Request password reset email */
  RESET_PASSWORD: '/auth/reset-password',
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Login credentials interface
 *
 * Represents the username and password required for authentication.
 * Maps to the form data submitted on the Moodle login page.
 *
 * @example
 * ```typescript
 * const credentials: LoginCredentials = {
 *   username: 'student1',
 *   password: 'securePassword123'
 * };
 * ```
 */
export interface LoginCredentials {
  /**
   * Username for authentication (Moodle username)
   *
   * This is the unique login identifier for the user account.
   * Supports lowercase alphanumeric characters.
   */
  username: string;

  /**
   * Password for authentication
   *
   * The user's password as entered. Will be validated against the
   * authentication plugin configured for the user (manual, LDAP, OAuth, etc.)
   */
  password: string;
}

/**
 * Login response data structure
 *
 * Contains the authenticated user profile and JWT tokens returned
 * after successful authentication.
 */
export interface LoginResponse {
  /**
   * Authenticated user profile data
   *
   * Contains full user information from Moodle including roles,
   * preferences, and profile fields.
   */
  user: User;

  /**
   * JWT authentication tokens
   *
   * Contains access token (1-hour) and refresh token (7-day)
   * for stateless API authentication.
   */
  tokens: JwtTokens;
}

/**
 * Token refresh response data structure
 *
 * Contains the new access token and expiration time returned
 * after refreshing an expired access token.
 */
export interface RefreshTokenResponse {
  /**
   * New JWT access token
   *
   * Use this token for subsequent API requests by including
   * it in the Authorization header as: Bearer <accessToken>
   */
  accessToken: string;

  /**
   * New refresh token (optional)
   *
   * Some implementations rotate the refresh token on each refresh.
   * If provided, store this as the new refresh token.
   */
  refreshToken?: string;

  /**
   * Access token expiration time in seconds (typically 3600 for 1 hour)
   */
  expiresIn: number;

  /**
   * Token type (always 'Bearer' for JWT)
   */
  tokenType: 'Bearer';
}

/**
 * Password reset request parameters
 */
export interface PasswordResetRequest {
  /**
   * Username or email address for the account to reset
   *
   * Either username or email must be provided. The backend
   * will look up the account and send a password reset email.
   */
  username?: string;
  email?: string;
}

/**
 * Password reset response
 */
export interface PasswordResetResponse {
  /**
   * Indicates if the reset email was sent successfully
   */
  success: boolean;

  /**
   * Message to display to the user
   *
   * For security, this message should not reveal whether
   * the account exists or not.
   */
  message: string;
}

/**
 * Standard API response envelope structure
 *
 * All API responses follow this structure for consistency.
 * The data field contains the actual response payload.
 *
 * @template T - Type of the response data payload
 */
interface ApiResponse<T> {
  /**
   * Indicates successful response
   */
  success: boolean;

  /**
   * Response data payload
   */
  data: T;

  /**
   * Optional metadata (pagination, timestamps, etc.)
   */
  meta?: {
    timestamp?: number;
    [key: string]: unknown;
  };
}

/**
 * API error response structure
 *
 * Returned when an API request fails. Contains error code,
 * message, and optional details for debugging.
 */
export interface ApiError {
  /**
   * Error code for programmatic error handling
   *
   * Examples: 'AUTHENTICATION_FAILED', 'INVALID_CREDENTIALS',
   * 'ACCOUNT_LOCKED', 'SESSION_EXPIRED', etc.
   */
  code: string;

  /**
   * Human-readable error message
   *
   * Suitable for display to end users.
   */
  message: string;

  /**
   * HTTP status code
   */
  status?: number;

  /**
   * Additional error details
   *
   * May contain field-specific validation errors or
   * additional context for debugging.
   */
  details?: Record<string, unknown>;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Authenticate user with username and password
 *
 * Calls POST /api/v1/auth/login which wraps the existing Moodle
 * authenticate_user_login() function. On success, returns JWT tokens
 * and the authenticated user's profile data.
 *
 * The backend API endpoint:
 * 1. Validates login token (CSRF protection)
 * 2. Calls authenticate_user_login($username, $password)
 * 3. On success, calls complete_user_login($user)
 * 4. Generates JWT access and refresh tokens
 * 5. Returns user profile and tokens
 *
 * Supports all Moodle authentication plugins:
 * - Manual (local database)
 * - LDAP/Active Directory
 * - OAuth 2.0
 * - SAML/Shibboleth
 * - CAS
 * - And other configured auth plugins
 *
 * @param credentials - Username and password for authentication
 * @returns Promise resolving to login response with user and tokens
 * @throws {ApiError} If authentication fails or network error occurs
 *
 * @example
 * ```typescript
 * try {
 *   const response = await login({
 *     username: 'student1',
 *     password: 'password123'
 *   });
 *
 *   // Store tokens
 *   localStorage.setItem('access_token', response.tokens.accessToken);
 *   localStorage.setItem('refresh_token', response.tokens.refreshToken);
 *
 *   // Use user data
 *   console.log(`Welcome, ${response.user.firstname}!`);
 * } catch (error) {
 *   if (error.code === 'INVALID_CREDENTIALS') {
 *     showError('Invalid username or password');
 *   }
 * }
 * ```
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  try {
    const response: AxiosResponse<ApiResponse<LoginResponse>> = await apiClient.post(
      AUTH_API_ENDPOINTS.LOGIN,
      credentials
    );

    // Validate response structure
    if (!response.data || !response.data.success || !response.data.data) {
      const errorMessage = 'Invalid response format from login endpoint';
      throw createApiError('AUTHENTICATION_FAILED', errorMessage, 500);
    }

    const loginData = response.data.data;

    // Validate required fields in response
    if (!loginData.user || !loginData.tokens) {
      throw createApiError('AUTHENTICATION_FAILED', 'Missing user or token data in response', 500);
    }

    if (!loginData.tokens.accessToken || !loginData.tokens.refreshToken) {
      throw createApiError('AUTHENTICATION_FAILED', 'Missing token values in response', 500);
    }

    return loginData;
  } catch (error) {
    // If already an ApiError, rethrow it
    if (isApiError(error)) {
      throw error;
    }

    // Handle axios errors
    if (isAxiosError(error)) {
      const status = error.response?.status ?? 500;
      const errorData = error.response?.data as { error?: ApiError } | undefined;

      // Extract error from response if available
      if (errorData?.error) {
        throw {
          ...errorData.error,
          status,
        } as ApiError;
      }

      // Map common HTTP status codes to error messages
      switch (status) {
        case 401:
          throw createApiError('INVALID_CREDENTIALS', 'Invalid username or password', status);
        case 403:
          throw createApiError('ACCOUNT_DISABLED', 'Your account has been suspended', status);
        case 429:
          throw createApiError('RATE_LIMITED', 'Too many login attempts. Please try again later', status);
        default:
          throw createApiError(
            'AUTHENTICATION_FAILED',
            'An error occurred during authentication. Please try again.',
            status
          );
      }
    }

    // Handle generic errors
    throw createApiError(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network error during login',
      0
    );
  }
}

/**
 * Log out the current user
 *
 * Calls POST /api/v1/auth/logout which wraps the existing Moodle
 * require_logout() function. The backend invalidates the JWT token
 * by adding it to a server-side blacklist (typically in Redis).
 *
 * The backend API endpoint:
 * 1. Validates the current JWT token
 * 2. Adds the token to the blacklist
 * 3. Calls require_logout() to clean up session
 * 4. Returns success response
 *
 * After logout, the client should:
 * 1. Clear stored access and refresh tokens
 * 2. Clear any cached user data
 * 3. Redirect to login page or public area
 *
 * @returns Promise resolving when logout is complete
 * @throws {ApiError} If logout fails or network error occurs
 *
 * @example
 * ```typescript
 * try {
 *   await logout();
 *
 *   // Clear local storage
 *   localStorage.removeItem('access_token');
 *   localStorage.removeItem('refresh_token');
 *
 *   // Redirect to login
 *   navigate('/login');
 * } catch (error) {
 *   // Logout failed, but still clear local data
 *   localStorage.clear();
 *   navigate('/login');
 * }
 * ```
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post(AUTH_API_ENDPOINTS.LOGOUT);
  } catch (error) {
    // If already an ApiError, rethrow it
    if (isApiError(error)) {
      throw error;
    }

    // Handle axios errors
    if (isAxiosError(error)) {
      const status = error.response?.status ?? 500;
      const errorData = error.response?.data as { error?: ApiError } | undefined;

      if (errorData?.error) {
        throw {
          ...errorData.error,
          status,
        } as ApiError;
      }

      // For logout, we might get 401 if token is already expired
      // This is not really an error - the user is effectively logged out
      if (status === 401) {
        // Token is invalid/expired, consider logout successful
        return;
      }

      throw createApiError('LOGOUT_FAILED', 'Failed to logout from server', status);
    }

    // Handle generic errors
    throw createApiError(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network error during logout',
      0
    );
  }
}

/**
 * Refresh the access token using the refresh token
 *
 * Calls POST /api/v1/auth/refresh to exchange an expired access token
 * for a new one using the refresh token. This maintains seamless
 * authentication without requiring the user to re-enter credentials.
 *
 * The backend API endpoint:
 * 1. Validates the refresh token
 * 2. Verifies the token is not blacklisted
 * 3. Generates a new access token
 * 4. Optionally rotates the refresh token
 * 5. Returns new token(s) with expiration
 *
 * Token Refresh Flow:
 * 1. API request fails with 401 (access token expired)
 * 2. Client calls refreshToken() with stored refresh token
 * 3. New access token received and stored
 * 4. Original request retried with new token
 *
 * Note: The refresh token should be sent via httpOnly cookie or
 * in the request body, depending on security configuration.
 *
 * @returns Promise resolving to new token data
 * @throws {ApiError} If refresh fails (requires re-authentication)
 *
 * @example
 * ```typescript
 * try {
 *   const newTokens = await refreshToken();
 *
 *   // Update stored access token
 *   localStorage.setItem('access_token', newTokens.accessToken);
 *
 *   // Update refresh token if rotated
 *   if (newTokens.refreshToken) {
 *     localStorage.setItem('refresh_token', newTokens.refreshToken);
 *   }
 *
 *   // Retry failed request with new token
 *   return retryRequest(originalRequest);
 * } catch (error) {
 *   // Refresh failed, require full re-authentication
 *   redirectToLogin();
 * }
 * ```
 */
export async function refreshToken(): Promise<RefreshTokenResponse> {
  try {
    // The refresh token is typically sent via httpOnly cookie
    // or can be explicitly sent in the request body
    const storedRefreshToken = localStorage.getItem('moodle_refresh_token');

    const response: AxiosResponse<ApiResponse<RefreshTokenResponse>> = await apiClient.post(
      AUTH_API_ENDPOINTS.REFRESH,
      storedRefreshToken ? { refreshToken: storedRefreshToken } : undefined
    );

    // Validate response structure
    if (!response.data || !response.data.success || !response.data.data) {
      throw createApiError('TOKEN_REFRESH_FAILED', 'Invalid response from token refresh endpoint', 500);
    }

    const tokenData = response.data.data;

    // Validate required fields
    if (!tokenData.accessToken) {
      throw createApiError('TOKEN_REFRESH_FAILED', 'Missing access token in refresh response', 500);
    }

    // Ensure tokenType is set
    return {
      ...tokenData,
      tokenType: tokenData.tokenType ?? 'Bearer',
      expiresIn: tokenData.expiresIn ?? 3600,
    };
  } catch (error) {
    // If already an ApiError, rethrow it
    if (isApiError(error)) {
      throw error;
    }

    // Handle axios errors
    if (isAxiosError(error)) {
      const status = error.response?.status ?? 500;
      const errorData = error.response?.data as { error?: ApiError } | undefined;

      if (errorData?.error) {
        throw {
          ...errorData.error,
          status,
        } as ApiError;
      }

      // 401 means refresh token is invalid/expired
      if (status === 401) {
        throw createApiError(
          'SESSION_EXPIRED',
          'Your session has expired. Please log in again.',
          status
        );
      }

      throw createApiError('TOKEN_REFRESH_FAILED', 'Failed to refresh authentication token', status);
    }

    // Handle generic errors
    throw createApiError(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network error during token refresh',
      0
    );
  }
}

/**
 * Get the current authenticated user's profile
 *
 * Calls GET /api/v1/auth/me which extracts the user ID from the
 * JWT token payload and returns the full user profile from the database.
 *
 * The backend API endpoint:
 * 1. Validates the JWT access token
 * 2. Extracts user ID from token payload (sub claim)
 * 3. Retrieves user profile from database
 * 4. Returns user data with roles and preferences
 *
 * This endpoint is useful for:
 * - Initial application load to restore user session
 * - Verifying token validity
 * - Getting updated user profile after changes
 * - Loading user preferences and settings
 *
 * @returns Promise resolving to current user profile
 * @throws {ApiError} If not authenticated or token is invalid
 *
 * @example
 * ```typescript
 * try {
 *   const user = await getCurrentUser();
 *
 *   // Check user roles
 *   const isTeacher = user.roles?.some(r => r.shortname === 'teacher');
 *
 *   // Display user greeting
 *   showGreeting(`Welcome back, ${user.firstname}!`);
 * } catch (error) {
 *   if (error.code === 'SESSION_EXPIRED') {
 *     // Try to refresh token
 *     await refreshToken();
 *     return getCurrentUser();
 *   }
 *   // Handle other errors
 *   redirectToLogin();
 * }
 * ```
 */
export async function getCurrentUser(): Promise<User> {
  try {
    const response: AxiosResponse<ApiResponse<User>> = await apiClient.get(
      AUTH_API_ENDPOINTS.ME
    );

    // Validate response structure
    if (!response.data || !response.data.success || !response.data.data) {
      throw createApiError('USER_FETCH_FAILED', 'Invalid response from user profile endpoint', 500);
    }

    const userData = response.data.data;

    // Validate required user fields
    if (!userData.id || !userData.username) {
      throw createApiError('USER_FETCH_FAILED', 'Invalid user data in response', 500);
    }

    return userData;
  } catch (error) {
    // If already an ApiError, rethrow it
    if (isApiError(error)) {
      throw error;
    }

    // Handle axios errors
    if (isAxiosError(error)) {
      const status = error.response?.status ?? 500;
      const errorData = error.response?.data as { error?: ApiError } | undefined;

      if (errorData?.error) {
        throw {
          ...errorData.error,
          status,
        } as ApiError;
      }

      // 401 means not authenticated
      if (status === 401) {
        throw createApiError(
          'NOT_AUTHENTICATED',
          'You are not logged in. Please log in to continue.',
          status
        );
      }

      throw createApiError('USER_FETCH_FAILED', 'Failed to fetch user profile', status);
    }

    // Handle generic errors
    throw createApiError(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network error fetching user profile',
      0
    );
  }
}

/**
 * Request a password reset email
 *
 * Calls POST /api/v1/auth/reset-password which wraps the existing Moodle
 * core_login_process_password_reset() function. Sends a password reset
 * email to the user if the account exists.
 *
 * The backend API endpoint:
 * 1. Validates the username or email
 * 2. Looks up the user account
 * 3. Generates a password reset token
 * 4. Sends reset email via Moodle's email system
 * 5. Returns success (even if account not found for security)
 *
 * Security Notes:
 * - Response message should not reveal if account exists
 * - Rate limiting should be applied to prevent abuse
 * - Reset tokens should have short expiration (1-2 hours)
 *
 * @param request - Username or email address to reset
 * @returns Promise resolving to reset response with message
 * @throws {ApiError} If request fails or network error occurs
 *
 * @example
 * ```typescript
 * try {
 *   const result = await resetPassword({ email: 'user@example.com' });
 *
 *   // Show confirmation message
 *   showMessage(result.message);
 *   // "If an account exists with this email, you will receive password reset instructions."
 * } catch (error) {
 *   if (error.code === 'RATE_LIMITED') {
 *     showError('Too many requests. Please try again later.');
 *   } else {
 *     showError('An error occurred. Please try again.');
 *   }
 * }
 * ```
 */
export async function resetPassword(
  request: PasswordResetRequest
): Promise<PasswordResetResponse> {
  try {
    // Validate that at least username or email is provided
    if (!request.username && !request.email) {
      throw createApiError(
        'VALIDATION_ERROR',
        'Please provide a username or email address',
        400
      );
    }

    const response: AxiosResponse<ApiResponse<PasswordResetResponse>> = await apiClient.post(
      AUTH_API_ENDPOINTS.RESET_PASSWORD,
      request
    );

    // Validate response structure
    if (!response.data || !response.data.success) {
      // For password reset, we return a generic success message for security
      // even if the underlying call didn't strictly succeed
      return {
        success: true,
        message: 'If an account exists with this information, you will receive password reset instructions by email.',
      };
    }

    const resetData = response.data.data;

    // Return response with default message if not provided
    return {
      success: resetData?.success ?? true,
      message:
        resetData?.message ??
        'If an account exists with this information, you will receive password reset instructions by email.',
    };
  } catch (error) {
    // If already an ApiError, rethrow it
    if (isApiError(error)) {
      throw error;
    }

    // Handle axios errors
    if (isAxiosError(error)) {
      const status = error.response?.status ?? 500;
      const errorData = error.response?.data as { error?: ApiError } | undefined;

      if (errorData?.error) {
        throw {
          ...errorData.error,
          status,
        } as ApiError;
      }

      // Rate limiting
      if (status === 429) {
        throw createApiError(
          'RATE_LIMITED',
          'Too many password reset requests. Please try again later.',
          status
        );
      }

      // For most errors, return generic success for security
      // (don't reveal if account exists or not)
      if (status >= 400 && status < 500) {
        return {
          success: true,
          message: 'If an account exists with this information, you will receive password reset instructions by email.',
        };
      }

      throw createApiError('PASSWORD_RESET_FAILED', 'Failed to process password reset request', status);
    }

    // Handle generic errors
    throw createApiError(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network error during password reset',
      0
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a standardized API error object
 *
 * @param code - Error code for programmatic handling
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @param details - Additional error details
 * @returns ApiError object
 */
function createApiError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
): ApiError {
  return {
    code,
    message,
    status,
    ...(details && { details }),
  };
}

/**
 * Type guard to check if an error is an ApiError
 *
 * @param error - Error to check
 * @returns true if error is ApiError
 */
function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as ApiError).code === 'string' &&
    typeof (error as ApiError).message === 'string'
  );
}

/**
 * Type guard to check if an error is an Axios error
 *
 * @param error - Error to check
 * @returns true if error is AxiosError
 */
function isAxiosError(error: unknown): error is {
  response?: {
    status: number;
    data: unknown;
  };
  message: string;
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    (error as { isAxiosError?: boolean }).isAxiosError === true
  );
}
