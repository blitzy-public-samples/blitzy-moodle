/**
 * Authentication Hook
 *
 * Provides access to the current authenticated user's information
 * and authentication state. Uses React Query to fetch and cache user data.
 *
 * @module features/auth/hooks/useAuth
 */

import { useCurrentUser, useLoginMutation, useLogout } from '../api/authApi';
import type { AuthUser } from '../api/authApi';

export type { AuthUser };

/**
 * Return type for the useAuth hook
 */
export interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
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
 * const { user, isAuthenticated, isLoading } = useAuth();
 *
 * if (isLoading) return <Spinner />;
 * if (!isAuthenticated) return <LoginPrompt />;
 *
 * return <div>Welcome, {user.fullname}!</div>;
 * ```
 */
export const useAuth = (): UseAuthReturn => {
  const { data: user, isLoading, isError } = useCurrentUser();
  const loginMutation = useLoginMutation();
  const logoutMutation = useLogout();

  const login = async (username: string, password: string): Promise<void> => {
    await loginMutation.mutateAsync({ username, password });
  };

  const logout = (): void => {
    // Clear authentication tokens from localStorage
    localStorage.removeItem('moodle_access_token');
    localStorage.removeItem('moodle_refresh_token');
    
    logoutMutation.mutate();
  };

  // Check if a token exists in localStorage
  // This helps prevent redirects during the initial loading phase
  const hasToken = !!localStorage.getItem('moodle_access_token');

  // User is authenticated if:
  // 1. We have user data from the API AND no error, OR
  // 2. We have no error AND we have a token (covers loading and initial states)
  // If there's an API error (like 401), the token is invalid and we're not authenticated
  const isAuthenticated = !isError && (!!user || hasToken);

  console.log('[useAuth] Current state:', {
    hasUser: !!user,
    hasToken,
    isError,
    isLoading,
    isAuthenticated,
    userEmail: user?.email,
  });

  return {
    user: user ?? null,
    isAuthenticated,
    login,
    logout,
    isLoading,
  };
};
