/**
 * Authentication API
 *
 * React Query hooks and API functions for authentication operations.
 * Integrates with JWT-based API authentication layer that wraps existing
 * Moodle authenticate_user_login() functions.
 *
 * @module features/auth/api/authApi
 */

import { useMutation } from '@tanstack/react-query';
import { apiClient, extractData } from '@/services/api/client';
import { AUTH_ENDPOINTS } from '@/services/api/endpoints';
import { setTokens, clearTokens } from '@/services/auth/authService';
import type { User, LoginCredentials, LoginResponse } from '../types/auth.types';
import type { ApiResponse } from '@/types/api';

// ============================================================================
// API Functions
// ============================================================================

/**
 * Login with username and password
 *
 * Calls POST /api/v1/auth/login which wraps existing Moodle
 * authenticate_user_login() function.
 *
 * @param credentials - Username and password
 * @returns User data and JWT tokens
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await apiClient.post<ApiResponse<LoginResponse>>(
    AUTH_ENDPOINTS.LOGIN,
    credentials
  );

  // Extract data from response envelope
  const loginData = extractData(response);
  
  // Store tokens securely if provided
  if (loginData.tokens) {
    setTokens(loginData.tokens.accessToken, loginData.tokens.refreshToken);
  }

  return loginData;
}

/**
 * Logout current user
 *
 * Calls POST /api/v1/auth/logout which invalidates JWT token
 * by adding it to Redis blacklist.
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post(AUTH_ENDPOINTS.LOGOUT);
  } catch (error) {
    // Continue with client-side cleanup even if server logout fails
    console.error('Logout API call failed:', error);
  } finally {
    // Always clear tokens on client side
    clearTokens();
  }
}

/**
 * Get current user from JWT token
 *
 * Calls GET /api/v1/auth/me which extracts user from JWT token.
 *
 * @returns Current user data
 */
export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<ApiResponse<User>>(AUTH_ENDPOINTS.ME);

  // Extract data from response envelope
  return extractData(response);
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * React Query mutation hook for login
 *
 * Usage:
 * ```tsx
 * const { mutate: loginUser, isLoading, error } = useLoginMutation();
 *
 * loginUser(
 *   { username: 'user', password: 'pass' },
 *   {
 *     onSuccess: (data) => {
 *       // Handle successful login
 *     },
 *     onError: (error) => {
 *       // Handle login error
 *     }
 *   }
 * );
 * ```
 */
export function useLoginMutation() {
  return useMutation({
    mutationFn: login,
    onError: (error) => {
      console.error('Login mutation failed:', error);
    },
  });
}

/**
 * React Query mutation hook for logout
 *
 * Usage:
 * ```tsx
 * const { mutate: logoutUser } = useLogoutMutation();
 *
 * logoutUser();
 * ```
 */
export function useLogoutMutation() {
  return useMutation({
    mutationFn: logout,
    onError: (error) => {
      console.error('Logout mutation failed:', error);
    },
  });
}
