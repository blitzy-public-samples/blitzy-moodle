/**
 * Authentication Redux Slice
 *
 * Redux Toolkit slice for managing authentication state across the React application.
 * Handles JWT token storage, user data, and authentication status.
 * Integrates with the JWT-based API authentication layer that wraps existing
 * Moodle authenticate_user_login() functions.
 *
 * This slice serves as the single source of truth for authentication state,
 * managing user sessions with 1-hour access tokens and 7-day refresh tokens.
 *
 * @module features/auth/store/authSlice
 */

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type {
  User,
  AuthTokens,
  AuthError,
  AuthStatus,
} from '../types/auth.types';

// ============================================================================
// State Interface
// ============================================================================

/**
 * Authentication state shape
 *
 * Represents the complete authentication state stored in Redux.
 * Serves as the single source of truth for authentication across the application.
 *
 * State Management Rules:
 * - user and tokens are null when not authenticated
 * - isAuthenticated is true only when valid tokens exist
 * - isLoading is true during async auth operations
 * - error contains details when authentication fails
 * - status tracks the authentication state machine
 */
export interface AuthState {
  /**
   * Current authenticated user
   * null when user is not authenticated
   */
  user: User | null;

  /**
   * JWT authentication tokens
   * Contains accessToken (1-hour expiration) and refreshToken (7-day expiration)
   * null when user is not authenticated
   */
  tokens: AuthTokens | null;

  /**
   * Whether user is currently authenticated
   * true when user has valid tokens and is logged in
   */
  isAuthenticated: boolean;

  /**
   * Loading state for authentication operations
   * true during login, logout, or token refresh operations
   */
  isLoading: boolean;

  /**
   * Authentication error information
   * Contains error code and message when authentication fails
   * null when there is no error
   */
  error: AuthError | null;

  /**
   * Current authentication status
   * Tracks the state machine of authentication process
   */
  status: AuthStatus;
}

// ============================================================================
// Initial State
// ============================================================================

/**
 * Initial authentication state
 *
 * User starts unauthenticated with no tokens or user data.
 * This is the state before any authentication attempt or after logout.
 */
const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  status: 'idle' as AuthStatus,
};

// ============================================================================
// Redux Slice
// ============================================================================

/**
 * Authentication slice created with Redux Toolkit's createSlice
 *
 * Provides reducers for all authentication state mutations and
 * automatically generates action creators.
 *
 * Integration Points:
 * - Used by useAuth hook for accessing auth state
 * - Updated by authApi mutations from React Query
 * - Persisted to localStorage for session continuity
 *
 * State Transitions:
 * idle -> loading -> authenticated (success)
 * idle -> loading -> error (failure)
 * authenticated -> loading -> authenticated (token refresh success)
 * authenticated -> unauthenticated (logout)
 */
export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Login initiated action
     *
     * Called when user submits login form.
     * Sets loading state and clears any previous errors.
     *
     * State Changes:
     * - Sets isLoading to true
     * - Clears any previous error
     * - Sets status to 'loading'
     */
    loginInitiated: (state) => {
      state.isLoading = true;
      state.error = null;
      state.status = 'loading' as AuthStatus;
    },

    /**
     * Login success action
     *
     * Called when login API request succeeds.
     * Stores user data and JWT tokens in state.
     *
     * State Changes:
     * - Stores user object with profile data
     * - Stores JWT access and refresh tokens
     * - Sets isAuthenticated to true
     * - Sets isLoading to false
     * - Clears any error
     * - Sets status to 'authenticated'
     *
     * Token Structure:
     * - accessToken: JWT with 1-hour expiration
     * - refreshToken: JWT with 7-day expiration
     * - expiresIn: Seconds until access token expires
     * - tokenType: Always 'Bearer'
     *
     * @param action.payload - User and tokens from successful login
     */
    loginSuccess: (
      state,
      action: PayloadAction<{ user: User; tokens: AuthTokens }>
    ) => {
      state.user = action.payload.user;
      state.tokens = action.payload.tokens;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
      state.status = 'authenticated' as AuthStatus;
    },

    /**
     * Login failure action
     *
     * Called when login API request fails.
     * Stores error information and clears any partial auth state.
     *
     * State Changes:
     * - Clears user data
     * - Clears tokens
     * - Sets isAuthenticated to false
     * - Sets isLoading to false
     * - Stores error with code and message
     * - Sets status to 'error'
     *
     * Common Error Codes:
     * - INVALID_CREDENTIALS: Wrong username/password
     * - ACCOUNT_SUSPENDED: User account disabled
     * - ACCOUNT_NOT_CONFIRMED: Email not confirmed
     * - NETWORK_ERROR: Connection issues
     * - SERVER_ERROR: Backend failure
     *
     * @param action.payload - Error information from failed login
     */
    loginFailure: (state, action: PayloadAction<AuthError>) => {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = action.payload;
      state.status = 'error' as AuthStatus;
    },

    /**
     * Logout action
     *
     * Called when user logs out or token is invalidated.
     * Clears all authentication state and returns to initial state.
     *
     * State Changes:
     * - Clears user data
     * - Clears tokens (will be blacklisted on backend)
     * - Sets isAuthenticated to false
     * - Sets isLoading to false
     * - Clears any error
     * - Sets status to 'unauthenticated'
     *
     * Side Effects (handled by middleware/hooks):
     * - Tokens blacklisted in Redis on backend
     * - localStorage cleared
     * - Redirect to login page
     */
    logout: (state) => {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
      state.status = 'unauthenticated' as AuthStatus;
    },

    /**
     * Refresh token success action
     *
     * Called when access token refresh succeeds.
     * Updates tokens while preserving user data.
     *
     * State Changes:
     * - Updates tokens with new access/refresh tokens
     * - Maintains isAuthenticated as true
     * - Clears any error
     * - Sets status to 'authenticated'
     *
     * Token Refresh Strategy:
     * - Automatic refresh when access token expires
     * - Uses refresh token to obtain new access token
     * - Happens transparently without user interaction
     * - If refresh fails, user is logged out
     *
     * @param action.payload - New JWT tokens from refresh
     */
    refreshTokenSuccess: (state, action: PayloadAction<AuthTokens>) => {
      state.tokens = action.payload;
      state.isAuthenticated = true;
      state.error = null;
      state.status = 'authenticated' as AuthStatus;
    },

    /**
     * Refresh token failure action
     *
     * Called when access token refresh fails.
     * Clears authentication state and forces re-login.
     *
     * State Changes:
     * - Clears user data
     * - Clears tokens
     * - Sets isAuthenticated to false
     * - Sets isLoading to false
     * - Stores error information
     * - Sets status to 'unauthenticated'
     *
     * Failure Reasons:
     * - Refresh token expired (after 7 days)
     * - Refresh token blacklisted (after logout)
     * - Network error during refresh
     * - Server error
     *
     * @param action.payload - Error information from failed refresh
     */
    refreshTokenFailure: (state, action: PayloadAction<AuthError>) => {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = action.payload;
      state.status = 'unauthenticated' as AuthStatus;
    },

    /**
     * Set user action
     *
     * Updates user data without changing authentication status.
     * Used when user profile is updated.
     *
     * State Changes:
     * - Updates user object with new data
     * - Preserves authentication status and tokens
     *
     * Use Cases:
     * - User updates profile information
     * - User changes avatar
     * - User updates preferences
     * - Admin updates user data
     *
     * @param action.payload - Updated user data
     */
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },

    /**
     * Set tokens action
     *
     * Updates authentication tokens without changing user data.
     * Used for token refresh scenarios.
     *
     * State Changes:
     * - Updates tokens object
     * - Preserves user data and authentication status
     *
     * Use Cases:
     * - Manual token refresh
     * - Token received from external source
     * - Restoring tokens from storage
     *
     * @param action.payload - New JWT tokens
     */
    setTokens: (state, action: PayloadAction<AuthTokens>) => {
      state.tokens = action.payload;
    },

    /**
     * Clear authentication action
     *
     * Resets authentication state to initial values.
     * Used for cleanup and testing purposes.
     *
     * State Changes:
     * - Resets all fields to initial state
     * - Equivalent to fresh application start
     *
     * Use Cases:
     * - Testing scenarios
     * - Manual state cleanup
     * - Error recovery
     * - Forced logout without API call
     */
    clearAuth: (state) => {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
      state.status = 'idle' as AuthStatus;
    },

    /**
     * Set loading action
     *
     * Updates loading state for authentication operations.
     *
     * State Changes:
     * - Sets isLoading to provided value
     * - Updates status to 'loading' if loading is true
     *
     * Use Cases:
     * - Manual loading state management
     * - Custom authentication flows
     * - Loading indicators
     *
     * @param action.payload - Loading state boolean
     */
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
      if (action.payload) {
        state.status = 'loading' as AuthStatus;
      }
    },

    /**
     * Set error action
     *
     * Updates error state for authentication failures.
     *
     * State Changes:
     * - Sets error to provided value
     * - Sets status to 'error' if error is not null
     *
     * Use Cases:
     * - Manual error handling
     * - Custom error scenarios
     * - Error clearing (pass null)
     *
     * @param action.payload - Error information or null to clear
     */
    setError: (state, action: PayloadAction<AuthError | null>) => {
      state.error = action.payload;
      if (action.payload) {
        state.status = 'error' as AuthStatus;
      }
    },

    /**
     * Initialize authentication state from stored tokens
     *
     * Called on application startup to restore authentication state
     * from localStorage. Hydrates Redux store with user and token data
     * if valid tokens exist.
     *
     * State Changes:
     * - Restores user data from payload
     * - Restores JWT tokens from payload
     * - Sets isAuthenticated to true
     * - Sets isLoading to false
     * - Clears any error
     * - Sets status to 'authenticated'
     *
     * Critical for:
     * - Maintaining login state across page refreshes
     * - Synchronizing Redux store with localStorage on app startup
     * - Preventing "logged out" UI flash when user is actually logged in
     * - Supporting browser back/forward navigation
     *
     * Security Notes:
     * - Tokens should be validated server-side before use
     * - Client-side validation only checks token format and expiration
     * - Backend must verify JWT signature on every API request
     *
     * @param action.payload - User and tokens restored from storage
     */
    initializeAuth: (
      state,
      action: PayloadAction<{ user: User; tokens: AuthTokens }>
    ) => {
      state.user = action.payload.user;
      state.tokens = action.payload.tokens;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
      state.status = 'authenticated' as AuthStatus;
    },
  },
});

// ============================================================================
// Action Creators
// ============================================================================

/**
 * Exported action creators
 *
 * Automatically generated by createSlice.
 * Use these to dispatch authentication state changes.
 *
 * Usage Example:
 * ```typescript
 * import { loginSuccess } from '@/features/auth/store/authSlice';
 * dispatch(loginSuccess({ user, tokens }));
 * ```
 */
export const {
  loginInitiated,
  loginSuccess,
  loginFailure,
  logout,
  refreshTokenSuccess,
  refreshTokenFailure,
  setUser,
  setTokens,
  clearAuth,
  setLoading,
  setError,
  initializeAuth,
} = authSlice.actions;

/**
 * Grouped authentication actions
 *
 * Provides convenient access to all auth-related actions.
 * Useful for importing multiple actions at once.
 *
 * Usage Example:
 * ```typescript
 * import { authActions } from '@/features/auth/store/authSlice';
 * dispatch(authActions.loginSuccess({ user, tokens }));
 * dispatch(authActions.logout());
 * ```
 */
export const authActions = {
  loginInitiated,
  loginSuccess,
  loginFailure,
  logout,
  refreshTokenSuccess,
  refreshTokenFailure,
  setUser,
  setTokens,
  clearAuth,
  setLoading,
  setError,
};

// ============================================================================
// Selectors
// ============================================================================

/**
 * Root state interface
 *
 * Represents the shape of the Redux store.
 * Used for typing selector functions.
 *
 * Note: In actual store configuration, RootState is defined
 * in app/store.ts. This is a minimal interface for this slice.
 */
interface RootState {
  auth: AuthState;
}

/**
 * Select current user
 *
 * Returns the authenticated user or null if not logged in.
 *
 * Usage Example:
 * ```typescript
 * const user = useSelector(selectUser);
 * if (user) {
 *   console.log(`Welcome ${user.firstname}!`);
 * }
 * ```
 *
 * @param state - Redux root state
 * @returns Current user or null
 */
export const selectUser = (state: RootState): User | null => state.auth.user;

/**
 * Select authentication status
 *
 * Returns whether user is currently authenticated.
 *
 * Usage Example:
 * ```typescript
 * const isAuthenticated = useSelector(selectIsAuthenticated);
 * if (!isAuthenticated) {
 *   navigate('/login');
 * }
 * ```
 *
 * @param state - Redux root state
 * @returns True if user is authenticated
 */
export const selectIsAuthenticated = (state: RootState): boolean =>
  state.auth.isAuthenticated;

/**
 * Select loading state
 *
 * Returns whether an authentication operation is in progress.
 *
 * Usage Example:
 * ```typescript
 * const isLoading = useSelector(selectIsLoading);
 * return <Button loading={isLoading}>Login</Button>;
 * ```
 *
 * @param state - Redux root state
 * @returns True if loading
 */
export const selectIsLoading = (state: RootState): boolean =>
  state.auth.isLoading;

/**
 * Select authentication error
 *
 * Returns current authentication error or null if no error.
 *
 * Usage Example:
 * ```typescript
 * const error = useSelector(selectAuthError);
 * if (error) {
 *   showErrorMessage(error.message);
 * }
 * ```
 *
 * @param state - Redux root state
 * @returns Authentication error or null
 */
export const selectAuthError = (state: RootState): AuthError | null =>
  state.auth.error;

/**
 * Select authentication tokens
 *
 * Returns JWT tokens (access and refresh) or null if not authenticated.
 *
 * Usage Example:
 * ```typescript
 * const tokens = useSelector(selectAuthTokens);
 * if (tokens) {
 *   api.setAuthHeader(tokens.accessToken);
 * }
 * ```
 *
 * @param state - Redux root state
 * @returns Authentication tokens or null
 */
export const selectAuthTokens = (state: RootState): AuthTokens | null =>
  state.auth.tokens;

/**
 * Select authentication status
 *
 * Returns the current authentication status enum value.
 *
 * Usage Example:
 * ```typescript
 * const status = useSelector(selectAuthStatus);
 * if (status === AuthStatus.LOADING) {
 *   return <LoadingSpinner />;
 * }
 * ```
 *
 * @param state - Redux root state
 * @returns Current authentication status
 */
export const selectAuthStatus = (state: RootState): AuthStatus =>
  state.auth.status;

/**
 * Select user ID
 *
 * Returns the current user's ID or null if not authenticated.
 * Convenience selector for quick access to user ID.
 *
 * Usage Example:
 * ```typescript
 * const userId = useSelector(selectUserId);
 * fetchUserCourses(userId);
 * ```
 *
 * @param state - Redux root state
 * @returns User ID or null
 */
export const selectUserId = (state: RootState): number | null =>
  state.auth.user?.id ?? null;

/**
 * Select user roles
 *
 * Returns the current user's roles or empty array if not authenticated.
 * Used for role-based UI adjustments.
 *
 * Usage Example:
 * ```typescript
 * const roles = useSelector(selectUserRoles);
 * const isTeacher = roles.includes('editingteacher');
 * ```
 *
 * @param state - Redux root state
 * @returns Array of user role shortnames
 */
export const selectUserRoles = (state: RootState): string[] => {
  if (!state.auth.user) {
    return [];
  }
  return state.auth.user.roles.map((role) => role.shortname);
};

/**
 * Select access token
 *
 * Returns the JWT access token or null if not authenticated.
 * Used for API request authorization headers.
 *
 * Usage Example:
 * ```typescript
 * const accessToken = useSelector(selectAccessToken);
 * axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
 * ```
 *
 * @param state - Redux root state
 * @returns Access token string or null
 */
export const selectAccessToken = (state: RootState): string | null =>
  state.auth.tokens?.accessToken ?? null;

/**
 * Select refresh token
 *
 * Returns the JWT refresh token or null if not authenticated.
 * Used for obtaining new access tokens.
 *
 * Usage Example:
 * ```typescript
 * const refreshToken = useSelector(selectRefreshToken);
 * if (isAccessTokenExpired()) {
 *   await refreshAccessToken(refreshToken);
 * }
 * ```
 *
 * @param state - Redux root state
 * @returns Refresh token string or null
 */
export const selectRefreshToken = (state: RootState): string | null =>
  state.auth.tokens?.refreshToken ?? null;

/**
 * Select user display name
 *
 * Returns the user's full name for display purposes.
 * Concatenates firstname and lastname.
 *
 * Usage Example:
 * ```typescript
 * const displayName = useSelector(selectUserDisplayName);
 * return <Typography>Welcome, {displayName}!</Typography>;
 * ```
 *
 * @param state - Redux root state
 * @returns User's full name or null
 */
export const selectUserDisplayName = (state: RootState): string | null => {
  if (!state.auth.user) {
    return null;
  }
  return `${state.auth.user.firstname} ${state.auth.user.lastname}`.trim();
};

/**
 * Select user email
 *
 * Returns the current user's email address or null if not authenticated.
 *
 * Usage Example:
 * ```typescript
 * const email = useSelector(selectUserEmail);
 * return <Typography>{email}</Typography>;
 * ```
 *
 * @param state - Redux root state
 * @returns User email or null
 */
export const selectUserEmail = (state: RootState): string | null =>
  state.auth.user?.email ?? null;

// ============================================================================
// Reducer Export
// ============================================================================

/**
 * Authentication reducer
 *
 * Default export of the authentication slice reducer.
 * Must be included in the Redux store configuration.
 *
 * Store Configuration Example:
 * ```typescript
 * import { configureStore } from '@reduxjs/toolkit';
 * import authReducer from '@/features/auth/store/authSlice';
 *
 * export const store = configureStore({
 *   reducer: {
 *     auth: authReducer,
 *   },
 * });
 * ```
 */
export const authReducer = authSlice.reducer;
export default authReducer;
