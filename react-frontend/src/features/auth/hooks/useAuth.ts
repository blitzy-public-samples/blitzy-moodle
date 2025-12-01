/**
 * Authentication Hook - useAuth
 *
 * Custom React hook providing comprehensive authentication functionality for the
 * Moodle React frontend. Acts as the primary interface for components to interact
 * with authentication logic by integrating Redux state management (authSlice),
 * React Query API calls (authApi), and local storage token handling.
 *
 * This hook combines:
 * - Redux Toolkit for global authentication state (user, tokens, isAuthenticated)
 * - React Query for server state management (API calls with caching)
 * - Local storage for JWT token persistence across sessions
 *
 * Architecture Overview:
 * - Global State: Redux authSlice manages user, tokens, and auth status
 * - Server State: React Query handles API calls and caching
 * - Persistence: JWT tokens stored in localStorage for session continuity
 * - API Layer: Wraps existing Moodle authenticate_user_login() via REST API
 *
 * JWT Token Lifecycle:
 * - Access Token: 1-hour expiration, used for API authentication
 * - Refresh Token: 7-day expiration, used to obtain new access tokens
 * - Automatic refresh on mount if refresh token exists and is valid
 * - Token blacklist on server-side for secure logout
 *
 * Security Notes:
 * - All permission checks enforced by backend via require_capability()
 * - This hook only manages auth state, not authorization decisions
 * - Tokens stored in localStorage (httpOnly cookies recommended for production)
 *
 * @module features/auth/hooks/useAuth
 * @see features/auth/store/authSlice - Redux state management
 * @see features/auth/api/authApi - API client functions
 * @see public/login/index.php - authenticate_user_login() source reference
 * @see public/login/logout.php - require_logout() source reference
 */

import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppSelector, useAppDispatch } from '@/app/store';
import { authActions } from '@/features/auth/store/authSlice';
import {
  login as loginApiCall,
  logout as logoutApiCall,
  refreshToken as refreshTokenApiCall,
  getCurrentUser,
  CURRENT_USER_QUERY_KEY,
} from '@/features/auth/api/authApi';
import type {
  User,
  AuthTokens,
  AuthError,
  LoginCredentials,
} from '@/features/auth/types/auth.types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Local storage keys for JWT tokens
 *
 * Using 'moodle_' prefix to avoid conflicts with other applications
 * on the same domain.
 */
const TOKEN_STORAGE_KEYS = {
  ACCESS_TOKEN: 'moodle_access_token',
  REFRESH_TOKEN: 'moodle_refresh_token',
} as const;

/**
 * Token refresh threshold in milliseconds
 *
 * Start refreshing when token has less than 5 minutes remaining.
 * This ensures smooth user experience without sudden session expiration.
 */
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * AuthHook interface defining all authentication methods and state
 *
 * This interface represents the complete API surface exposed by the useAuth hook.
 * All components should use this interface for authentication interactions.
 */
export interface AuthHook {
  /**
   * Current authenticated user or null if not authenticated
   *
   * Contains full user profile from Moodle including roles and capabilities.
   * Updated after successful login or when checkAuth() is called.
   */
  user: User | null;

  /**
   * Whether the user is currently authenticated
   *
   * True when valid JWT tokens exist and user data is loaded.
   * False during loading, after logout, or on authentication failure.
   */
  isAuthenticated: boolean;

  /**
   * Loading state for authentication operations
   *
   * True during initial auth check, login, logout, or token refresh.
   * Use this to show loading indicators in the UI.
   */
  isLoading: boolean;

  /**
   * Authentication error information if any
   *
   * Contains error code and message when authentication fails.
   * Use clearError() to reset this after displaying error to user.
   */
  error: AuthError | null;

  /**
   * Login with username and password
   *
   * Authenticates user via POST /api/v1/auth/login which wraps
   * Moodle's authenticate_user_login() function. On success:
   * - Stores JWT tokens in localStorage
   * - Updates Redux state with user data
   * - Invalidates React Query cache
   *
   * @param credentials - Username and password
   * @returns Promise resolving when login completes
   * @throws {AuthError} If authentication fails
   *
   * @example
   * ```tsx
   * const { login, isLoading, error } = useAuth();
   *
   * const handleSubmit = async (e: FormEvent) => {
   *   e.preventDefault();
   *   try {
   *     await login({ username, password });
   *     navigate('/dashboard');
   *   } catch (err) {
   *     // Error is available via the error property
   *   }
   * };
   * ```
   */
  login: (credentials: LoginCredentials) => Promise<void>;

  /**
   * Logout the current user
   *
   * Signs out user via POST /api/v1/auth/logout which:
   * - Blacklists JWT token on server (Redis)
   * - Calls Moodle's require_logout() function
   * - Clears local tokens and Redux state
   *
   * Always clears local auth state even if API call fails (fail-safe).
   *
   * @returns Promise resolving when logout completes
   *
   * @example
   * ```tsx
   * const { logout } = useAuth();
   *
   * const handleLogout = async () => {
   *   await logout();
   *   navigate('/login');
   * };
   * ```
   */
  logout: () => Promise<void>;

  /**
   * Verify current authentication status
   *
   * Validates current JWT token by calling GET /api/v1/auth/me.
   * On success, updates Redux state with fresh user data.
   * On failure, clears auth state and returns false.
   *
   * Use this on app initialization or route changes to verify session.
   *
   * @returns Promise resolving to true if authenticated, false otherwise
   *
   * @example
   * ```tsx
   * const { checkAuth } = useAuth();
   *
   * useEffect(() => {
   *   const verify = async () => {
   *     const isValid = await checkAuth();
   *     if (!isValid) navigate('/login');
   *   };
   *   verify();
   * }, []);
   * ```
   */
  checkAuth: () => Promise<boolean>;

  /**
   * Get current user data synchronously
   *
   * Returns user from Redux state without making API call.
   * Use checkAuth() if you need to verify token validity.
   *
   * @returns Current user or null if not authenticated
   *
   * @example
   * ```tsx
   * const { getUser } = useAuth();
   * const user = getUser();
   * if (user) console.log(`Current user: ${user.firstname}`);
   * ```
   */
  getUser: () => User | null;

  /**
   * Refresh expired access token
   *
   * Exchanges refresh token for new access token via POST /api/v1/auth/refresh.
   * Called automatically by axios interceptor on 401 responses.
   *
   * On success:
   * - Stores new tokens in localStorage
   * - Updates Redux state with new tokens
   *
   * On failure:
   * - Clears auth state (refresh token expired)
   * - User must re-authenticate
   *
   * @returns Promise resolving when refresh completes
   * @throws {AuthError} If refresh fails (token expired or invalid)
   *
   * @example
   * ```tsx
   * const { refreshToken } = useAuth();
   *
   * // Manual refresh (usually handled automatically)
   * try {
   *   await refreshToken();
   * } catch (err) {
   *   // Refresh failed, redirect to login
   *   navigate('/login');
   * }
   * ```
   */
  refreshToken: () => Promise<void>;

  /**
   * Clear authentication error
   *
   * Resets the error state to null. Call this after displaying
   * error message to user to clear the error indicator.
   *
   * @example
   * ```tsx
   * const { error, clearError } = useAuth();
   *
   * useEffect(() => {
   *   if (error) {
   *     showToast(error.message);
   *     clearError();
   *   }
   * }, [error]);
   * ```
   */
  clearError: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get access token from localStorage
 *
 * @returns Access token string or null if not stored
 */
function getStoredAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
  } catch {
    // localStorage might not be available (SSR, private browsing)
    return null;
  }
}

/**
 * Get refresh token from localStorage
 *
 * @returns Refresh token string or null if not stored
 */
function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
  } catch {
    return null;
  }
}

/**
 * Store authentication tokens in localStorage
 *
 * @param tokens - JWT tokens to store
 */
function storeTokens(tokens: AuthTokens): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
    localStorage.setItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  } catch {
    // Silently fail if localStorage is not available
    console.warn('Failed to store tokens in localStorage');
  }
}

/**
 * Clear authentication tokens from localStorage
 */
function clearStoredTokens(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
  } catch {
    // Silently fail if localStorage is not available
  }
}

/**
 * Check if access token is expired or about to expire
 *
 * Decodes JWT payload to check expiration time.
 * Returns true if token is expired or will expire within threshold.
 *
 * @param token - JWT access token
 * @returns true if token needs refresh, false otherwise
 */
function isTokenExpired(token: string | null): boolean {
  if (!token) return true;

  try {
    // JWT structure: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    // Decode payload (base64url -> JSON)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Check expiration (exp is in seconds, Date.now() is in milliseconds)
    const expirationMs = payload.exp * 1000;
    const nowMs = Date.now();

    // Token is expired if current time + threshold exceeds expiration
    return nowMs + TOKEN_REFRESH_THRESHOLD_MS >= expirationMs;
  } catch {
    // If we can't decode, assume expired
    return true;
  }
}

/**
 * Convert API error to AuthError format
 *
 * Normalizes various error types to AuthError interface.
 *
 * @param error - Error from API call
 * @returns Normalized AuthError object
 */
function normalizeError(error: unknown): AuthError {
  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    if ('code' in errorObj && 'message' in errorObj) {
      return {
        code: errorObj.code as AuthError['code'],
        message: errorObj.message as string,
        details: errorObj.details as Record<string, unknown> | undefined,
      };
    }
  }

  // Default error for unknown error types
  return {
    code: 'SERVER_ERROR' as AuthError['code'],
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
  };
}

// ============================================================================
// Main Hook Implementation
// ============================================================================

/**
 * useAuth - Primary authentication hook
 *
 * Provides comprehensive authentication functionality including:
 * - Access to auth state (user, isAuthenticated, loading, error)
 * - Login/logout actions
 * - User retrieval
 * - Token management and auto-refresh
 *
 * Integrates Redux for global state and React Query for server state.
 *
 * @returns AuthHook interface with all authentication methods and state
 *
 * @example
 * ```tsx
 * function App() {
 *   const { user, isAuthenticated, isLoading, login, logout, checkAuth } = useAuth();
 *
 *   useEffect(() => {
 *     checkAuth();
 *   }, [checkAuth]);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (!isAuthenticated) return <LoginPage onLogin={login} />;
 *
 *   return (
 *     <div>
 *       <h1>Welcome, {user?.firstname}!</h1>
 *       <button onClick={logout}>Logout</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth(): AuthHook {
  // ============================================================================
  // Redux State and Dispatch
  // ============================================================================

  const dispatch = useAppDispatch();

  // Select auth state from Redux store
  const user = useAppSelector((state) => state.auth.user);
  const tokens = useAppSelector((state) => state.auth.tokens);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const isReduxLoading = useAppSelector((state) => state.auth.isLoading);
  const reduxError = useAppSelector((state) => state.auth.error);

  // ============================================================================
  // React Query Setup
  // ============================================================================

  const queryClient = useQueryClient();

  // Track if we've initialized auth check
  const hasInitialized = useRef(false);
  const isRefreshing = useRef(false);

  // ============================================================================
  // API Mutations
  // ============================================================================

  /**
   * Login mutation
   *
   * Handles login API call and updates Redux state on success.
   */
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      dispatch(authActions.setLoading(true));
      return loginApiCall(credentials);
    },
    onSuccess: (response) => {
      // Store tokens in localStorage
      storeTokens(response.tokens);

      // Update Redux state with user and tokens
      dispatch(
        authActions.loginSuccess({
          user: response.user,
          tokens: response.tokens,
        })
      );

      // Update React Query cache
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, response.user);
    },
    onError: (error: unknown) => {
      const authError = normalizeError(error);
      dispatch(authActions.loginFailure(authError));
      clearStoredTokens();
    },
  });

  /**
   * Logout mutation
   *
   * Handles logout API call and clears auth state.
   * Always clears local state even if API fails (fail-safe).
   */
  const logoutMutation = useMutation({
    mutationFn: async () => {
      dispatch(authActions.setLoading(true));
      return logoutApiCall();
    },
    onSettled: () => {
      // Always clear auth state regardless of API success/failure
      // This ensures user is logged out locally even if server call fails
      clearStoredTokens();
      dispatch(authActions.clearAuth());
      queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    },
  });

  /**
   * Token refresh mutation
   *
   * Exchanges refresh token for new access token.
   */
  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (isRefreshing.current) {
        throw new Error('Refresh already in progress');
      }
      isRefreshing.current = true;
      return refreshTokenApiCall();
    },
    onSuccess: (response) => {
      isRefreshing.current = false;

      // Build complete tokens object
      const newTokens: AuthTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken ?? getStoredRefreshToken() ?? '',
        expiresIn: response.expiresIn,
        tokenType: response.tokenType,
      };

      // Store new tokens
      storeTokens(newTokens);

      // Update Redux state
      dispatch(authActions.setTokens(newTokens));
    },
    onError: (error: unknown) => {
      isRefreshing.current = false;
      const authError = normalizeError(error);

      // Refresh failed - clear auth state and require re-login
      clearStoredTokens();
      dispatch(authActions.refreshTokenFailure(authError));
      queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    },
  });

  // ============================================================================
  // Check Auth Query
  // ============================================================================

  /**
   * Query to fetch current user from API
   *
   * Only enabled when we have a stored token and need to validate it.
   */
  const checkAuthQuery = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getCurrentUser,
    enabled: false, // Manually triggered via checkAuth()
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    retry: (failureCount, error) => {
      // Don't retry on 401 (not authenticated)
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status?: number };
        if (apiError.status === 401) return false;
      }
      return failureCount < 3;
    },
  });

  // ============================================================================
  // Callback Functions
  // ============================================================================

  /**
   * Login with credentials
   */
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<void> => {
      await loginMutation.mutateAsync(credentials);
    },
    [loginMutation]
  );

  /**
   * Logout current user
   */
  const logout = useCallback(async (): Promise<void> => {
    // Optimistically clear React Query cache first for responsive UI
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null);
    queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });

    await logoutMutation.mutateAsync();
  }, [queryClient, logoutMutation]);

  /**
   * Check current authentication status
   *
   * Validates token and fetches user data from API.
   * Updates Redux state with fresh user data on success.
   */
  const checkAuth = useCallback(async (): Promise<boolean> => {
    const accessToken = getStoredAccessToken();
    const refreshTokenValue = getStoredRefreshToken();

    // No tokens stored - not authenticated
    if (!accessToken && !refreshTokenValue) {
      dispatch(authActions.clearAuth());
      return false;
    }

    dispatch(authActions.setLoading(true));

    try {
      // If access token is expired but we have refresh token, refresh first
      if (isTokenExpired(accessToken) && refreshTokenValue) {
        try {
          await refreshMutation.mutateAsync();
        } catch {
          // Refresh failed - not authenticated
          dispatch(authActions.clearAuth());
          return false;
        }
      }

      // Fetch current user from API
      const { data: userData } = await queryClient.fetchQuery({
        queryKey: CURRENT_USER_QUERY_KEY,
        queryFn: getCurrentUser,
      });

      // Update Redux state with user data
      if (userData) {
        dispatch(authActions.setUser(userData));
        dispatch(authActions.setLoading(false));
        return true;
      }

      dispatch(authActions.clearAuth());
      return false;
    } catch (error) {
      // API call failed - clear auth state
      const authError = normalizeError(error);
      dispatch(authActions.setError(authError));
      dispatch(authActions.setLoading(false));
      clearStoredTokens();
      return false;
    }
  }, [dispatch, queryClient, refreshMutation]);

  /**
   * Get current user synchronously from Redux state
   */
  const getUser = useCallback((): User | null => {
    return user;
  }, [user]);

  /**
   * Refresh the access token
   */
  const refreshToken = useCallback(async (): Promise<void> => {
    await refreshMutation.mutateAsync();
  }, [refreshMutation]);

  /**
   * Clear authentication error
   */
  const clearError = useCallback((): void => {
    dispatch(authActions.setError(null));
  }, [dispatch]);

  // ============================================================================
  // Auto-refresh on Mount
  // ============================================================================

  /**
   * Initialize authentication state on mount
   *
   * Checks for stored tokens and validates them with the API.
   * If tokens exist but are expired, attempts to refresh them.
   */
  useEffect(() => {
    // Only run once on mount
    if (hasInitialized.current) return;

    const initializeAuth = async () => {
      hasInitialized.current = true;

      const accessToken = getStoredAccessToken();
      const refreshTokenValue = getStoredRefreshToken();

      // No tokens stored - nothing to do
      if (!accessToken && !refreshTokenValue) {
        return;
      }

      // Set loading state
      dispatch(authActions.setLoading(true));

      try {
        // If access token is expired and we have refresh token, refresh first
        if (isTokenExpired(accessToken) && refreshTokenValue) {
          try {
            await refreshMutation.mutateAsync();
          } catch {
            // Refresh failed - clear auth and return
            dispatch(authActions.clearAuth());
            clearStoredTokens();
            return;
          }
        }

        // Fetch current user to validate token
        const userData = await getCurrentUser();

        // Reconstruct tokens from storage
        const storedAccessToken = getStoredAccessToken();
        const storedRefreshToken = getStoredRefreshToken();

        if (userData && storedAccessToken && storedRefreshToken) {
          // Initialize Redux state with stored auth data
          dispatch(
            authActions.loginSuccess({
              user: userData,
              tokens: {
                accessToken: storedAccessToken,
                refreshToken: storedRefreshToken,
                expiresIn: 3600, // Default 1 hour, actual expiration in token
                tokenType: 'Bearer',
              },
            })
          );

          // Update React Query cache
          queryClient.setQueryData(CURRENT_USER_QUERY_KEY, userData);
        } else {
          // Invalid state - clear everything
          dispatch(authActions.clearAuth());
          clearStoredTokens();
        }
      } catch {
        // API call failed - clear auth state
        dispatch(authActions.clearAuth());
        clearStoredTokens();
      }
    };

    initializeAuth();
  }, [dispatch, queryClient, refreshMutation]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  /**
   * Combined loading state
   *
   * True when any auth operation is in progress.
   */
  const isLoading =
    isReduxLoading ||
    loginMutation.isPending ||
    logoutMutation.isPending ||
    refreshMutation.isPending ||
    checkAuthQuery.isLoading;

  /**
   * Combined error state
   *
   * Returns error from Redux state, mutations, or query.
   */
  const error: AuthError | null =
    reduxError ||
    (loginMutation.error ? normalizeError(loginMutation.error) : null) ||
    (refreshMutation.error ? normalizeError(refreshMutation.error) : null) ||
    (checkAuthQuery.error ? normalizeError(checkAuthQuery.error) : null);

  // ============================================================================
  // Return Hook Interface
  // ============================================================================

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    checkAuth,
    getUser,
    refreshToken,
    clearError,
  };
}

/**
 * Default export for convenience
 *
 * Allows both named and default import:
 * - import { useAuth } from '@/features/auth/hooks/useAuth';
 * - import useAuth from '@/features/auth/hooks/useAuth';
 */
export default useAuth;
