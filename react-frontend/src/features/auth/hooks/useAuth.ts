/**
 * Authentication Hook
 *
 * Provides access to the current authenticated user's information
 * and authentication state. Uses React Query to fetch and cache user data
 * by consuming the API functions from authApi.ts.
 *
 * Architecture:
 * - API functions (login, logout, getCurrentUser) are imported from authApi.ts
 * - React Query hooks (useQuery, useMutation) are created within this file
 * - This separation follows the project architecture in Section 0.4
 *
 * @module features/auth/hooks/useAuth
 * @see features/auth/api/authApi - API client functions
 * @see public/login/index.php - authenticate_user_login() source reference
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  login as loginApi,
  logout as logoutApi,
  getCurrentUser,
  CURRENT_USER_QUERY_KEY,
} from '../api/authApi';
import type {
  AuthUser,
  LoginCredentials,
  LoginResponse,
  ApiError,
} from '../api/authApi';

// Re-export types for convenience
export type { AuthUser, LoginCredentials, LoginResponse, ApiError };

// Re-export query key for external cache management
export { CURRENT_USER_QUERY_KEY };

// ============================================================================
// Internal React Query Hooks
// ============================================================================

/**
 * Internal hook to fetch current user data
 *
 * Uses React Query to fetch and cache the current authenticated user.
 * Only fetches if an access token exists in localStorage.
 *
 * @returns React Query result with user data
 */
function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getCurrentUser,
    // Only attempt to fetch if we have a token
    enabled: !!localStorage.getItem('moodle_access_token'),
    // Consider user data stale after 5 minutes
    staleTime: 5 * 60 * 1000,
    // Keep cached data for 30 minutes
    gcTime: 30 * 60 * 1000,
    // Don't retry on 401 errors (not authenticated)
    retry: (failureCount, error) => {
      // Check if error has ApiError structure with status property
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as unknown as ApiError;
        if (apiError.status === 401) {return false;}
      }
      return failureCount < 3;
    },
  });
}

/**
 * Internal hook for login mutation
 *
 * Handles the login API call and stores tokens on success.
 *
 * @returns React Query mutation result
 */
function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => loginApi(credentials),
    onSuccess: (response: LoginResponse) => {
      // Store tokens in localStorage
      localStorage.setItem('moodle_access_token', response.tokens.accessToken);
      localStorage.setItem('moodle_refresh_token', response.tokens.refreshToken);

      // Update the user query cache with the user data
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, response.user);
    },
    onError: (error: ApiError) => {
      // Ensure tokens are cleared on login failure
      localStorage.removeItem('moodle_access_token');
      localStorage.removeItem('moodle_refresh_token');
      
      // Log error for debugging (in development)
      if (process.env.NODE_ENV === 'development') {
        console.error('Login failed:', error.message, error.code);
      }
    },
  });
}

/**
 * Internal hook for logout mutation
 *
 * Handles the logout API call and clears tokens.
 *
 * @returns React Query mutation result
 */
function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutApi,
    onSettled: () => {
      // Always clear tokens and cache, regardless of API success/failure
      // This ensures the user is logged out locally even if the server call fails
      localStorage.removeItem('moodle_access_token');
      localStorage.removeItem('moodle_refresh_token');

      // Clear the user query cache
      queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null);
    },
  });
}

// ============================================================================
// Public Hook Interface
// ============================================================================

/**
 * Return type for the useAuth hook
 */
export interface UseAuthReturn {
  /** Current authenticated user, or null if not authenticated */
  user: AuthUser | null;
  
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  
  /** Function to log in with username and password, returns login response */
  login: (username: string, password: string) => Promise<LoginResponse>;
  
  /** Function to log out the current user */
  logout: () => void;
  
  /** Whether authentication state is being loaded */
  isLoading: boolean;
  
  /** Authentication error if any */
  error: ApiError | null;
  
  /** Whether a login operation is in progress */
  isLoginLoading: boolean;
  
  /** Whether a logout operation is in progress */
  isLogoutLoading: boolean;
}

/**
 * Hook to access authentication state
 *
 * Fetches the current user from the API and provides authentication
 * state including user data, loading status, and auth methods.
 *
 * During the initial loading phase, checks localStorage for a token
 * to prevent unnecessary redirects while the user data is being fetched.
 *
 * @returns Authentication state and methods
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, isLoading, login, logout } = useAuth();
 *
 * if (isLoading) return <Spinner />;
 * if (!isAuthenticated) return <LoginPrompt />;
 *
 * return (
 *   <div>
 *     <p>Welcome, {user.firstname}!</p>
 *     <button onClick={logout}>Logout</button>
 *   </div>
 * );
 * ```
 *
 * @example
 * ```tsx
 * // Login with credentials
 * const { login, isLoginLoading, error } = useAuth();
 *
 * const handleSubmit = async (username: string, password: string) => {
 *   try {
 *     await login(username, password);
 *     navigate('/dashboard');
 *   } catch (err) {
 *     // Error is available via the error property
 *     console.error('Login failed');
 *   }
 * };
 * ```
 */
export const useAuth = (): UseAuthReturn => {
  const queryClient = useQueryClient();
  
  // Fetch current user data
  const { 
    data: user, 
    isLoading: isUserLoading, 
    isError,
    error: queryError,
  } = useCurrentUser();
  
  // Login mutation
  const loginMutation = useLoginMutation();
  
  // Logout mutation
  const logoutMutation = useLogoutMutation();

  /**
   * Login with username and password
   *
   * @param username - User's username
   * @param password - User's password
   * @returns Promise resolving to login response with user and tokens
   * @throws {ApiError} If login fails
   */
  const login = useCallback(async (username: string, password: string): Promise<LoginResponse> => {
    return await loginMutation.mutateAsync({ username, password });
  }, [loginMutation]);

  /**
   * Logout the current user
   *
   * Clears local cache immediately for responsive UI,
   * then calls the logout API to invalidate the token server-side.
   */
  const logout = useCallback((): void => {
    // CRITICAL: Clear the user query cache SYNCHRONOUSLY FIRST
    // This ensures isAuthenticated immediately becomes false,
    // preventing race conditions in ProtectedRoute and other components
    queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null);
    
    // Call the logout API endpoint
    // Tokens are still in localStorage so the interceptor can add them to the request
    // The useLogoutMutation hook will clear tokens in its onSettled callback
    logoutMutation.mutate();
  }, [queryClient, logoutMutation]);

  // Check if a token exists in localStorage
  // This helps prevent redirects during the initial loading phase
  const hasToken = !!localStorage.getItem('moodle_access_token');

  // User is authenticated if:
  // 1. We have user data from the API AND no error, OR
  // 2. We have no error AND we have a token (covers loading and initial states)
  // If there's an API error (like 401), the token is invalid and we're not authenticated
  const isAuthenticated = !isError && (!!user || hasToken);

  // Determine loading state
  // Loading if fetching user data OR during initial token check
  const isLoading = isUserLoading && hasToken;

  // Extract error from query or mutation
  const error: ApiError | null = 
    (queryError as ApiError | null) ?? 
    (loginMutation.error) ?? 
    null;

  return {
    user: user ?? null,
    isAuthenticated,
    login,
    logout,
    isLoading,
    error,
    isLoginLoading: loginMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
  };
};

// Default export for convenience
export default useAuth;
