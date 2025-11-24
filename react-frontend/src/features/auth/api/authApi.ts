/**
 * Authentication API
 *
 * React Query hooks and API functions for authentication operations.
 * Integrates with authentication API endpoints that handle JWT-based authentication.
 *
 * @module features/auth/api/authApi
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { apiClient } from '@/services/api/client';
import { AUTH_ENDPOINTS } from '@/services/api/endpoints';
import type { ApiResponse } from '@/types/api';
import type { AuthTokens, User } from '../types/auth.types';

// ============================================================================
// Types
// ============================================================================

/**
 * User data returned from authentication endpoints
 * Re-exports User type from auth.types for consistency
 */
export type AuthUser = User;

/**
 * Login request parameters
 */
export interface LoginParams {
  username: string;
  password: string;
}

/**
 * Login response containing user data and tokens
 */
export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch current authenticated user information
 *
 * Calls GET /api/v1/auth/me which validates the JWT token
 * and returns the current user's information.
 *
 * @returns Current user data
 * @throws {Error} If user is not authenticated or token is invalid
 */
export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<ApiResponse<AuthUser>>(
    AUTH_ENDPOINTS.ME
  );

  if (!response.data.success || !response.data.data) {
    throw new Error('Failed to fetch current user');
  }

  return response.data.data;
}

/**
 * Login with username and password
 *
 * Calls POST /api/v1/auth/login which validates credentials
 * and returns JWT tokens along with user information.
 *
 * @param params - Login credentials
 * @returns Login response with user data and tokens
 */
export async function login(params: LoginParams): Promise<LoginResponse> {
  const response = await apiClient.post<ApiResponse<LoginResponse>>(
    AUTH_ENDPOINTS.LOGIN,
    params
  );

  // Debug logging
  // eslint-disable-next-line no-console
  console.log('[authApi.login] Full response:', response);
  // eslint-disable-next-line no-console
  console.log('[authApi.login] response.data:', response.data);
  // eslint-disable-next-line no-console
  console.log('[authApi.login] response.data.success:', response.data.success);
  // eslint-disable-next-line no-console
  console.log('[authApi.login] response.data.data:', response.data.data);

  if (!response.data.success || !response.data.data) {
     
    console.error('[authApi.login] Validation failed - throwing error');
    throw new Error('Login failed');
  }

  return response.data.data;
}

/**
 * Logout current user
 *
 * Calls POST /api/v1/auth/logout which invalidates the current
 * JWT token on the server.
 */
export async function logout(): Promise<void> {
  await apiClient.post(AUTH_ENDPOINTS.LOGOUT);
}

/**
 * Refresh authentication token
 *
 * Calls POST /api/v1/auth/refresh to get a new access token
 * using the refresh token.
 *
 * @returns New access token and expiration time
 */
export async function refreshToken(): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await apiClient.post<ApiResponse<{ accessToken: string; expiresIn: number }>>(
    AUTH_ENDPOINTS.REFRESH
  );

  if (!response.data.success || !response.data.data) {
    throw new Error('Token refresh failed');
  }

  return response.data.data;
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Query key for current user data
 */
export const CURRENT_USER_QUERY_KEY = ['auth', 'me'] as const;

/**
 * Hook to fetch and cache current user information
 *
 * Uses React Query to manage the authenticated user's data.
 * This hook automatically refetches when the query is invalidated.
 * Only fetches user data when an authentication token exists in localStorage.
 *
 * @returns React Query result with user data
 */
export function useCurrentUser() {
  // Check if a token exists in localStorage
  // Only fetch user data if a token is present
  const hasToken = !!localStorage.getItem('moodle_access_token');
  
  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: fetchCurrentUser,
    enabled: hasToken, // Only fetch if token exists
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: (failureCount, error: AxiosError) => {
      // Don't retry on authentication errors
      if (error?.response?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Hook to perform login mutation
 *
 * Logs in a user with username and password, stores authentication tokens,
 * and updates the current user query cache with the authenticated user data.
 *
 * @returns Mutation function and state
 */
export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      // Store access token in localStorage
      // This matches the key used by the API client interceptor
      if (data.tokens.accessToken) {
        localStorage.setItem('moodle_access_token', data.tokens.accessToken);
      }
      
      // Optionally store refresh token for token refresh functionality
      if (data.tokens.refreshToken) {
        localStorage.setItem('moodle_refresh_token', data.tokens.refreshToken);
      }
      
      // Set the current user data directly in the query cache
      // This ensures useAuth immediately sees the authenticated user
      // without waiting for a refetch, preventing race conditions
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, data.user);
    },
  });
}

/**
 * Hook to perform logout mutation
 *
 * Logs out the current user and clears all cached authentication data.
 *
 * @returns Mutation function and state
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Clear all authentication-related queries
      queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      
      // Clear any other cached data that depends on authentication
      queryClient.clear();
    },
    onSettled: () => {
      // Clear tokens from localStorage after the API call completes
      // This runs even if the component that initiated the mutation has unmounted
      localStorage.removeItem('moodle_access_token');
      localStorage.removeItem('moodle_refresh_token');
    },
  });
}
