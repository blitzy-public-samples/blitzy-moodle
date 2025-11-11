/**
 * Authentication Redux Slice
 *
 * Redux Toolkit slice for managing authentication state across the React application.
 * Handles JWT token storage, user data, and authentication status.
 * Integrates with the JWT-based API authentication layer that wraps existing
 * Moodle authenticate_user_login() functions.
 *
 * @module features/auth/store/authSlice
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
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
 * User starts unauthenticated with no tokens or user data
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
     * @param action.payload - Error information or null to clear
     */
    setError: (state, action: PayloadAction<AuthError | null>) => {
      state.error = action.payload;
      if (action.payload) {
        state.status = 'error' as AuthStatus;
      }
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
} = authSlice.actions;

/**
 * Grouped authentication actions
 *
 * Provides convenient access to all auth-related actions.
 * Useful for importing multiple actions at once.
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
 */
interface RootState {
  auth: AuthState;
}

/**
 * Select current user
 *
 * Returns the authenticated user or null if not logged in.
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
 * @param state - Redux root state
 * @returns Array of user roles
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
 */
export const authReducer = authSlice.reducer;
export default authReducer;
