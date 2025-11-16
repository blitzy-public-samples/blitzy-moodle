/**
 * Authentication Service Module
 *
 * This module provides comprehensive JWT-based authentication token management for the Moodle React frontend.
 * It handles secure storage, validation, automatic refresh, and logout operations for access and refresh tokens.
 *
 * Key Features:
 * - Secure token storage using localStorage with automatic fallback to in-memory storage
 * - JWT token validation with expiration checking and configurable buffer time
 * - Automatic access token refresh with mutex lock to prevent race conditions
 * - Server-side token blacklisting on logout via Redis
 * - JWT payload decoding for extracting user information and roles
 * - Integration with API client interceptors for authentication headers
 *
 * Token Configuration:
 * - Access Token Expiration: 1 hour (3600 seconds)
 * - Refresh Token Expiration: 7 days (604800 seconds)
 * - Expiration Buffer: 60 seconds (refresh tokens 1 minute before actual expiration)
 *
 * Security Considerations:
 * - Tokens are never logged or exposed in console (production mode)
 * - XSS protection through secure storage practices
 * - Token format validation before decoding
 * - Graceful handling of token tampering attempts
 * - httpOnly cookies support (when available from server)
 *
 * @module services/auth/authService
 */

import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import type { AxiosResponse, AxiosError } from 'axios';
import { getItem, setItem, removeItem } from '../storage/storageService';
import { AUTH_ENDPOINTS } from '../api/endpoints';
import type { ApiResponse } from '../../types/api';

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * Storage key for JWT access token
 * Must match keys used in client.ts, authApi.ts, and useAuth.ts for consistency
 */
const ACCESS_TOKEN_KEY = 'moodle_access_token';

/**
 * Storage key for JWT refresh token
 * Must match keys used in client.ts, authApi.ts, and useAuth.ts for consistency
 */
const REFRESH_TOKEN_KEY = 'moodle_refresh_token';

/**
 * Token expiration buffer in seconds (1 minute)
 *
 * Tokens are considered expired if they will expire within this buffer time.
 * This prevents race conditions where a token expires during an API request.
 * The buffer ensures we refresh tokens proactively before they actually expire.
 */
const EXPIRATION_BUFFER_SECONDS = 60;

/**
 * Base URL for API requests
 * Uses Vite environment variable with fallback to root-relative path
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * JWT payload structure as defined by the backend API
 *
 * Follows the JWT standard claims (RFC 7519) plus custom Moodle-specific claims.
 * The backend signs tokens with HS256 algorithm using a 256-bit secret.
 *
 * Standard Claims:
 * - sub: Subject (user ID in Moodle)
 * - iss: Issuer (Moodle instance URL)
 * - iat: Issued At (Unix timestamp)
 * - exp: Expiration Time (Unix timestamp)
 *
 * Custom Claims:
 * - roles: Array of user role names (e.g., ['student', 'teacher'])
 * - username: Moodle username
 */
interface JWTPayload {
  /**
   * Subject - User ID in Moodle database
   */
  sub: number;

  /**
   * Issuer - Moodle instance URL
   */
  iss: string;

  /**
   * Issued At - Unix timestamp when token was created
   */
  iat: number;

  /**
   * Expiration - Unix timestamp when token expires
   */
  exp: number;

  /**
   * User roles in Moodle (e.g., 'student', 'teacher', 'admin')
   */
  roles?: string[];

  /**
   * Moodle username
   */
  username?: string;

  /**
   * Additional custom claims
   */
  [key: string]: unknown;
}

/**
 * User information extracted from JWT token payload
 *
 * This interface represents the user data that can be reliably extracted
 * from a decoded JWT token without making additional API calls.
 */
export interface TokenUser {
  /**
   * User ID from token subject claim
   */
  id: number;

  /**
   * Username from custom claim (optional)
   */
  username?: string;

  /**
   * Array of user role names (optional)
   */
  roles?: string[];
}

/**
 * Response structure from token refresh endpoint
 *
 * The backend returns both a new access token and a new refresh token
 * to support refresh token rotation for enhanced security.
 * 
 * Note: The API returns snake_case property names, not camelCase.
 */
interface RefreshTokenResponse {
  /**
   * New JWT access token (1 hour expiration)
   */
  access_token: string;

  /**
   * New JWT refresh token (7 day expiration)
   */
  refresh_token: string;
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Mutex lock for token refresh operations
 *
 * Prevents concurrent refresh requests which could cause race conditions.
 * When multiple API calls fail due to expired token simultaneously, only
 * one refresh request should be made. Other calls wait for the same promise.
 *
 * This is critical for preventing:
 * - Multiple simultaneous refresh API calls
 * - Token overwrite race conditions
 * - Unnecessary server load
 */
let refreshPromise: Promise<string> | null = null;

// ============================================================================
// Token Storage Functions
// ============================================================================

/**
 * Retrieve the current JWT access token from secure storage
 *
 * Attempts to read from localStorage first (or httpOnly cookie if configured).
 * Falls back to in-memory storage if browser storage is unavailable.
 *
 * @returns The access token string, or null if no token is stored
 *
 * @example
 * ```typescript
 * const token = getAccessToken();
 * if (token) {
 *   // User is logged in with a stored token
 *   // Note: Token might still be expired - check with isTokenExpired()
 * }
 * ```
 */
export function getAccessToken(): string | null {
  return getItem<string>(ACCESS_TOKEN_KEY, 'local');
}

/**
 * Retrieve the current JWT refresh token from secure storage
 *
 * Attempts to read from localStorage first (or httpOnly cookie if configured).
 * Falls back to in-memory storage if browser storage is unavailable.
 *
 * @returns The refresh token string, or null if no token is stored
 *
 * @example
 * ```typescript
 * const refreshToken = getRefreshToken();
 * if (refreshToken && !isTokenExpired(refreshToken)) {
 *   // Can use refresh token to get new access token
 * }
 * ```
 */
export function getRefreshToken(): string | null {
  return getItem<string>(REFRESH_TOKEN_KEY, 'local');
}

/**
 * Store JWT access and refresh tokens in secure storage
 *
 * Saves both tokens to localStorage (or httpOnly cookies if configured).
 * Falls back to in-memory storage if browser storage is unavailable.
 *
 * This function is called after:
 * - Successful login (POST /api/v1/auth/login)
 * - Successful token refresh (POST /api/v1/auth/refresh)
 *
 * Security Notes:
 * - Tokens are stored as plain strings (already encrypted via HTTPS)
 * - localStorage is accessible to JavaScript (XSS risk if code is compromised)
 * - httpOnly cookies are preferred when available (not accessible to JavaScript)
 * - Never log token values in production
 *
 * @param accessToken - JWT access token (1 hour expiration)
 * @param refreshToken - JWT refresh token (7 day expiration)
 *
 * @example
 * ```typescript
 * // After successful login
 * const response = await login(username, password);
 * setTokens(response.data.accessToken, response.data.refreshToken);
 * ```
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  // Validate token format before storing (basic sanity check)
  if (!accessToken || typeof accessToken !== 'string' || accessToken.split('.').length !== 3) {
    console.error('Invalid access token format - expected JWT with 3 parts');
    return;
  }

  if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.split('.').length !== 3) {
    console.error('Invalid refresh token format - expected JWT with 3 parts');
    return;
  }

  // Store tokens in localStorage (falls back to in-memory if unavailable)
  setItem(ACCESS_TOKEN_KEY, accessToken, 'local');
  setItem(REFRESH_TOKEN_KEY, refreshToken, 'local');

  // In production, never log token values
  if (import.meta.env.DEV) {
    console.debug('[AuthService] Tokens stored successfully');
  }
}

/**
 * Remove all authentication tokens from secure storage
 *
 * Clears both access and refresh tokens from localStorage (or cookies).
 * Also clears from in-memory fallback storage if it was used.
 *
 * This function is called during:
 * - User logout (after calling API logout endpoint)
 * - Token refresh failure (expired refresh token)
 * - Authentication errors that require re-login
 *
 * After calling this function, isAuthenticated() will return false.
 *
 * @example
 * ```typescript
 * // During logout
 * await logout(); // Calls API and then clearTokens() internally
 *
 * // On auth error
 * if (error.response?.status === 401) {
 *   clearTokens();
 *   redirectToLogin();
 * }
 * ```
 */
export function clearTokens(): void {
  removeItem(ACCESS_TOKEN_KEY, 'local');
  removeItem(REFRESH_TOKEN_KEY, 'local');

  if (import.meta.env.DEV) {
    console.debug('[AuthService] Tokens cleared');
  }
}

// ============================================================================
// Token Validation Functions
// ============================================================================

/**
 * Check if a JWT token is expired or will expire soon
 *
 * Decodes the token to extract the expiration claim (exp) and compares
 * against current time. Includes a configurable buffer time to refresh
 * tokens proactively before they actually expire.
 *
 * The function considers a token expired if:
 * - Current time >= (exp - EXPIRATION_BUFFER_SECONDS)
 * - Token cannot be decoded (malformed, tampered, or invalid format)
 * - Token is missing the exp claim
 *
 * Buffer Time Logic:
 * - Buffer = 60 seconds
 * - Token exp = 1705327200 (some future time)
 * - Current time = 1705327150
 * - Time until expiration = 50 seconds < 60 seconds buffer
 * - Result: Token is considered expired (needs refresh)
 *
 * @param token - JWT token string to validate
 * @returns True if token is expired or invalid, false if token is still valid
 *
 * @example
 * ```typescript
 * const token = getAccessToken();
 * if (token && isTokenExpired(token)) {
 *   // Token exists but is expired - need to refresh
 *   await refreshAccessToken();
 * }
 * ```
 */
export function isTokenExpired(token: string): boolean {
  // Validate token format (JWT must have 3 parts: header.payload.signature)
  if (!token || typeof token !== 'string') {
    return true;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    // Invalid JWT format
    return true;
  }

  try {
    // Decode the token payload (does not verify signature - that's done server-side)
    const decoded = jwtDecode<JWTPayload>(token);

    // Check if exp claim exists
    if (!decoded.exp || typeof decoded.exp !== 'number') {
      console.warn('[AuthService] Token missing expiration claim');
      return true;
    }

    // Get current time in seconds (JWT timestamps are in seconds, not milliseconds)
    const currentTimeSeconds = Math.floor(Date.now() / 1000);

    // Consider token expired if it will expire within the buffer time
    // This ensures we refresh tokens proactively before they actually expire
    const isExpired = decoded.exp <= currentTimeSeconds + EXPIRATION_BUFFER_SECONDS;

    if (import.meta.env.DEV && isExpired) {
      const timeUntilExpiration = decoded.exp - currentTimeSeconds;
      console.debug(
        `[AuthService] Token expired or expiring soon (${timeUntilExpiration}s remaining)`
      );
    }

    return isExpired;
  } catch (error) {
    // Token decoding failed - likely malformed or tampered
    console.error('[AuthService] Token decoding failed:', error);
    return true;
  }
}

/**
 * Check if the user is currently authenticated with a valid token
 *
 * Performs a comprehensive authentication check by:
 * 1. Verifying an access token exists in storage
 * 2. Validating the token is not expired (considering buffer time)
 *
 * This function does NOT make an API call - it only checks local token state.
 * For server-side validation, use the /api/v1/auth/me endpoint.
 *
 * @returns True if user has a valid, non-expired access token; false otherwise
 *
 * @example
 * ```typescript
 * // In a ProtectedRoute component
 * if (!isAuthenticated()) {
 *   return <Navigate to="/login" />;
 * }
 *
 * // In a React component
 * const authenticated = isAuthenticated();
 * if (authenticated) {
 *   // Show authenticated UI
 * }
 * ```
 */
export function isAuthenticated(): boolean {
  const token = getAccessToken();

  // No token in storage
  if (!token) {
    return false;
  }

  // Token exists but is expired or invalid
  if (isTokenExpired(token)) {
    return false;
  }

  // Token exists and is valid
  return true;
}

// ============================================================================
// Token Refresh Functions
// ============================================================================

/**
 * Refresh the access token using the refresh token
 *
 * This function implements automatic token refresh with the following features:
 * - Mutex lock to prevent concurrent refresh requests (race condition protection)
 * - Uses the refresh token to obtain a new access token from the API
 * - Automatically stores the new tokens upon successful refresh
 * - Clears all tokens if refresh fails (requires re-login)
 * - Returns the new access token for immediate use
 *
 * Flow:
 * 1. Check if refresh is already in progress (return existing promise if so)
 * 2. Validate refresh token exists and is not expired
 * 3. Call POST /api/v1/auth/refresh with refresh token
 * 4. Store new access and refresh tokens (token rotation)
 * 5. Return new access token
 * 6. On failure, clear tokens and throw error
 *
 * Mutex Lock Pattern:
 * - Multiple API calls may fail simultaneously due to expired access token
 * - API client interceptor will call refreshAccessToken() for each failed request
 * - Mutex ensures only ONE refresh API call is made
 * - Subsequent calls wait for the same promise to resolve
 * - All calls receive the same new access token
 *
 * Token Rotation:
 * - Backend returns both new access token AND new refresh token
 * - This enhances security by rotating refresh tokens on each use
 * - Old refresh token is invalidated server-side after successful refresh
 *
 * @returns Promise resolving to the new access token string
 * @throws Error if refresh token is missing, expired, or refresh request fails
 *
 * @example
 * ```typescript
 * // In API client interceptor
 * try {
 *   const newToken = await refreshAccessToken();
 *   // Retry failed request with new token
 *   originalRequest.headers.Authorization = `Bearer ${newToken}`;
 *   return axios(originalRequest);
 * } catch (error) {
 *   // Refresh failed - redirect to login
 *   redirectToLogin();
 * }
 * ```
 */
export async function refreshAccessToken(): Promise<string> {
  // Check if refresh is already in progress
  // If so, return the existing promise instead of making a new request
  if (refreshPromise) {
    return refreshPromise;
  }

  // Create new refresh promise with mutex lock
  refreshPromise = (async (): Promise<string> => {
    try {
      const currentRefreshToken = getRefreshToken();

      // Validate refresh token exists
      if (!currentRefreshToken) {
        throw new Error('No refresh token available - user must login again');
      }

      // Validate refresh token is not expired
      if (isTokenExpired(currentRefreshToken)) {
        throw new Error('Refresh token expired - user must login again');
      }

      if (import.meta.env.DEV) {
        console.debug('[AuthService] Refreshing access token...');
      }

      // Call the refresh endpoint
      // Note: Using axios directly instead of apiClient to avoid circular dependency
      // (apiClient interceptor depends on this authService)
      const response: AxiosResponse<ApiResponse<RefreshTokenResponse>> = await axios.post(
        `${API_BASE_URL}${AUTH_ENDPOINTS.REFRESH}`,
        { refreshToken: currentRefreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          // Don't include Authorization header - refresh token is in request body
        }
      );

      // Validate response structure
      if (!response.data?.success || !response.data.data) {
        throw new Error('Token refresh failed: Invalid response structure');
      }

      const { access_token: accessToken, refresh_token: newRefreshToken } = response.data.data;

      // Validate returned tokens
      if (!accessToken || !newRefreshToken) {
        throw new Error('Token refresh failed: Missing tokens in response');
      }

      // Store new tokens (token rotation)
      setTokens(accessToken, newRefreshToken);

      if (import.meta.env.DEV) {
        console.debug('[AuthService] Access token refreshed successfully');
      }

      // Return new access token
      return accessToken;
    } catch (error) {
      // Clear all tokens on refresh failure
      // User will need to login again
      clearTokens();

      // Handle Axios errors with detailed messages
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ success: false; error?: { message?: string } }>;

        // Extract error message from API response
        const errorMessage =
          axiosError.response?.data?.error?.message ?? 
          axiosError.message ??
          'Token refresh failed';

        if (import.meta.env.DEV) {
          console.error('[AuthService] Token refresh failed:', errorMessage);
        }

        throw new Error(errorMessage);
      }

      // Re-throw non-Axios errors
      if (import.meta.env.DEV) {
        console.error('[AuthService] Token refresh failed:', error);
      }
      throw error;
    } finally {
      // Always clear the mutex lock when done (success or failure)
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ============================================================================
// Token Decoding Functions
// ============================================================================

/**
 * Decode JWT token and extract user information
 *
 * Extracts user-related claims from the JWT payload without verifying
 * the signature (signature verification is done server-side).
 *
 * Extracted Information:
 * - User ID (from 'sub' claim)
 * - Username (from 'username' custom claim)
 * - User roles (from 'roles' custom claim)
 *
 * This function is useful for:
 * - Displaying user info in the UI without an API call
 * - Client-side authorization checks (hiding/showing UI elements)
 * - Accessing user ID for constructing API requests
 *
 * Security Note:
 * - Client-side role checks are for UX only, NOT security
 * - Always verify permissions server-side with require_capability()
 * - Never trust client-side decoded data for authorization decisions
 * - This data can be tampered with - backend must validate JWT signature
 *
 * @param token - Optional JWT token to decode (defaults to current access token)
 * @returns TokenUser object with user info, or null if token is invalid
 *
 * @example
 * ```typescript
 * // Get current user from stored access token
 * const user = getUserFromToken();
 * if (user) {
 *   console.log(`Welcome ${user.username} (ID: ${user.id})`);
 *   if (user.roles?.includes('teacher')) {
 *     // Show teacher-specific UI (still verify server-side!)
 *   }
 * }
 *
 * // Decode a specific token
 * const user = getUserFromToken(customToken);
 * ```
 */
export function getUserFromToken(token?: string): TokenUser | null {
  // Use provided token or get from storage
  const tokenToUse = token ?? getAccessToken();

  if (!tokenToUse) {
    return null;
  }

  try {
    // Decode token payload
    const decoded = jwtDecode<JWTPayload>(tokenToUse);

    // Validate required claims
    if (!decoded.sub || typeof decoded.sub !== 'number') {
      console.warn('[AuthService] Token missing or invalid user ID (sub claim)');
      return null;
    }

    // Extract user information
    const user: TokenUser = {
      id: decoded.sub,
      username: decoded.username,
      roles: decoded.roles,
    };

    return user;
  } catch (error) {
    // Token decoding failed
    console.error('[AuthService] Failed to decode token:', error);
    return null;
  }
}

// ============================================================================
// Logout Functions
// ============================================================================

/**
 * Logout the current user by invalidating tokens
 *
 * Performs a complete logout operation with the following steps:
 * 1. Call API logout endpoint to blacklist token server-side (Redis)
 * 2. Clear local token storage (localStorage or in-memory)
 * 3. Handle errors gracefully (always clear local tokens even if API fails)
 *
 * Server-Side Token Blacklisting:
 * - Backend adds access token to Redis blacklist with TTL = token expiration
 * - Blacklisted tokens are rejected by JWT validation middleware
 * - This prevents token reuse after logout (important for shared computers)
 * - Refresh token is also invalidated in the database
 *
 * Error Handling:
 * - If API call fails, tokens are still cleared locally
 * - Network errors don't prevent local logout
 * - User experience is not blocked by backend issues
 * - Errors are logged but not thrown (logout always succeeds locally)
 *
 * Post-Logout State:
 * - isAuthenticated() returns false
 * - getAccessToken() returns null
 * - getRefreshToken() returns null
 * - All API calls will fail with 401 Unauthorized
 * - Application should redirect to login page
 *
 * @returns Promise that resolves when logout is complete (always succeeds)
 *
 * @example
 * ```typescript
 * // In logout handler
 * const handleLogout = async () => {
 *   try {
 *     await logout();
 *     // Redirect to login page
 *     navigate('/login');
 *     // Show success message
 *     toast.success('Logged out successfully');
 *   } catch (error) {
 *     // This should never happen - logout always succeeds locally
 *     // But handle it just in case
 *     console.error('Logout error:', error);
 *   }
 * };
 * ```
 */
export async function logout(): Promise<void> {
  try {
    const token = getAccessToken();

    // If we have a token, try to blacklist it on the server
    if (token) {
      if (import.meta.env.DEV) {
        console.debug('[AuthService] Calling logout API to blacklist token...');
      }

      // Call the API to blacklist the token on the server
      // Note: Using axios directly instead of apiClient to avoid circular dependency
      await axios.post(
        `${API_BASE_URL}${AUTH_ENDPOINTS.LOGOUT}`,
        {}, // Empty body - token is in Authorization header
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          // Set a timeout to prevent logout from hanging
          timeout: 5000,
        }
      );

      if (import.meta.env.DEV) {
        console.debug('[AuthService] Token blacklisted on server');
      }
    }
  } catch (error) {
    // Log error but don't throw - we still want to clear local tokens
    // Network issues or server errors should not prevent local logout
    if (import.meta.env.DEV) {
      console.warn('[AuthService] Logout API call failed (will still clear local tokens):', error);
    }

    // In production, only log a generic message to avoid exposing internals
    if (!import.meta.env.DEV) {
      console.error('Logout request failed, but local session will be cleared');
    }
  } finally {
    // ALWAYS clear tokens locally, regardless of API call success
    // This ensures user can logout even if backend is down
    clearTokens();

    if (import.meta.env.DEV) {
      console.debug('[AuthService] Logout complete - tokens cleared');
    }
  }
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Reset internal state - FOR TESTING ONLY
 * 
 * This function clears the module-level refreshPromise mutex to prevent state
 * leakage between test runs. It should NEVER be called in production code.
 * 
 * The refreshPromise variable acts as a mutex to prevent concurrent token refresh
 * operations. In tests, this state can leak between test runs when a refresh
 * operation completes after a test has ended. This function allows tests to
 * explicitly reset this state in their beforeEach hooks.
 * 
 * @internal
 * @example
 * ```typescript
 * // In test file beforeEach hook
 * import { __resetAuthState } from '@/services/auth/authService';
 * 
 * beforeEach(() => {
 *   __resetAuthState(); // Clear mutex state
 *   vi.clearAllMocks();
 * });
 * ```
 */
export function __resetAuthState(): void {
  refreshPromise = null;
  
  if (import.meta.env.DEV) {
    console.debug('[AuthService] Test utility: internal state reset');
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Default export object containing all authentication service functions
 *
 * This export provides a convenient way to import all functions as a namespace:
 * ```typescript
 * import authService from '@/services/auth/authService';
 * authService.getAccessToken();
 * authService.logout();
 * ```
 *
 * Individual named exports are also available:
 * ```typescript
 * import { getAccessToken, logout } from '@/services/auth/authService';
 * ```
 */
const authService = {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  isTokenExpired,
  isAuthenticated,
  refreshAccessToken,
  getUserFromToken,
  logout,
};

export default authService;
