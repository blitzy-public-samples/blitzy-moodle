/**
 * Redux Store Configuration
 *
 * Configures the Redux Toolkit store as the single source of truth for global
 * application state. Combines feature-specific reducer slices (auth, user, theme)
 * into a unified store with middleware support and Redux DevTools integration.
 *
 * Architecture:
 * - Global State: Managed via Redux Toolkit for predictable state updates
 * - Server State: Managed separately via React Query (not in this store)
 * - Local State: Managed via React useState/useReducer in components
 *
 * State Slices:
 * - auth: User authentication, JWT tokens, login status
 * - user: User preferences, profile data, settings (to be added)
 * - theme: UI theme settings, dark/light mode (to be added)
 *
 * Features:
 * - Automatic Redux DevTools integration in development
 * - Thunk middleware for async actions
 * - Serialization checks for state immutability
 * - Type-safe dispatch and selector hooks
 * - Time-travel debugging support
 *
 * Usage Example:
 * ```typescript
 * // In provider
 * import { Provider } from 'react-redux';
 * import { store } from '@/app/store';
 * <Provider store={store}><App /></Provider>
 *
 * // In components
 * import { useAppDispatch, useAppSelector } from '@/app/store';
 * const dispatch = useAppDispatch();
 * const user = useAppSelector((state) => state.auth.user);
 * ```
 *
 * @module app/store
 */

import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import { authReducer } from '@/features/auth/store/authSlice';
import { sidebarReducer } from '@/app/slices/sidebarSlice';

// ============================================================================
// Store Configuration
// ============================================================================

/**
 * Redux store instance
 *
 * Configured with Redux Toolkit's configureStore for optimal defaults:
 * - Redux Thunk middleware: Enables async action creators
 * - Redux DevTools Extension: Automatic integration in development
 * - Immutability checks: Warns about state mutations in development
 * - Serializability checks: Ensures state is JSON-serializable
 *
 * Middleware Configuration:
 * - getDefaultMiddleware(): Includes thunk, immutableCheck, serializableCheck
 * - Custom middleware can be added via concatenation
 *
 * Reducer Composition:
 * - auth: Authentication state (user, tokens, status)
 * - Future: user slice for profile and preferences
 * - Future: theme slice for UI customization
 *
 * Performance Optimizations:
 * - Production build excludes DevTools and checks
 * - Lazy loading of reducers not currently implemented
 * - State normalization should be applied for large datasets
 *
 * Store Enhancement:
 * - Redux DevTools: Enabled automatically via configureStore
 * - Persisted State: Can be added via redux-persist if needed
 * - Analytics Middleware: Can be added for user behavior tracking
 */
export const store = configureStore({
  reducer: {
    /**
     * Authentication reducer
     *
     * Manages user authentication state including:
     * - User data (id, name, email, roles, capabilities)
     * - JWT tokens (access token: 1hr, refresh token: 7d)
     * - Authentication status (idle, loading, authenticated, error)
     * - Loading and error states for auth operations
     *
     * Actions:
     * - loginInitiated, loginSuccess, loginFailure
     * - logout, refreshTokenSuccess, refreshTokenFailure
     * - setUser, setTokens, clearAuth
     *
     * Selectors:
     * - selectUser, selectIsAuthenticated, selectAuthTokens
     * - selectUserId, selectUserRoles, selectAccessToken
     */
    auth: authReducer,

    /**
     * Sidebar navigation reducer
     *
     * Manages sidebar open/close state for the main navigation drawer.
     * Controls visibility across desktop (permanent) and mobile (temporary) modes.
     *
     * State:
     * - isOpen: Boolean flag for sidebar visibility
     *
     * Actions:
     * - toggleSidebar: Invert current state
     * - openSidebar: Explicitly open
     * - closeSidebar: Explicitly close
     * - setSidebarOpen: Set to specific boolean value
     *
     * Selectors:
     * - selectSidebarIsOpen: Get current open state
     */
    sidebar: sidebarReducer,

    // Note: Additional reducers will be added by other feature agents:
    // user: userReducer,  // User preferences and profile management
    // theme: themeReducer, // UI theme and appearance settings
  },

  // Middleware configuration (uses defaults: thunk + dev checks)
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Serialization check options
      serializableCheck: {
        // Ignore specific action types if needed
        // ignoredActions: ['auth/loginSuccess'],
        // Ignore specific paths in state if needed
        // ignoredPaths: ['auth.tokens.expiresAt'],
      },
      // Immutability check options
      immutableCheck: {
        // Warn on state mutations in development
        warnAfter: 128, // ms threshold before warning
      },
    }),

  // DevTools configuration
  devTools: process.env.NODE_ENV !== 'production',
});

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Root state type
 *
 * Represents the complete Redux state tree structure.
 * Automatically inferred from the store's reducer configuration.
 *
 * Type Safety:
 * - Ensures selectors access valid state paths
 * - Provides autocomplete for state properties
 * - Catches state access errors at compile time
 *
 * Usage Example:
 * ```typescript
 * const selectUserName = (state: RootState): string | null =>
 *   state.auth.user?.username ?? null;
 * ```
 *
 * State Structure:
 * ```typescript
 * {
 *   auth: {
 *     user: User | null,
 *     tokens: AuthTokens | null,
 *     isAuthenticated: boolean,
 *     isLoading: boolean,
 *     error: AuthError | null,
 *     status: AuthStatus
 *   },
 *   // Future state slices:
 *   // user: { preferences: {...}, profile: {...} },
 *   // theme: { mode: 'light' | 'dark', customizations: {...} }
 * }
 * ```
 */
export type RootState = ReturnType<typeof store.getState>;

/**
 * App dispatch type
 *
 * Typed dispatch function that includes thunk middleware support.
 * Enables dispatching both sync actions and async thunks with type safety.
 *
 * Type Safety:
 * - Ensures only valid actions can be dispatched
 * - Provides autocomplete for action creators
 * - Supports async thunk actions with proper typing
 *
 * Usage Example:
 * ```typescript
 * const dispatch = useAppDispatch();
 * dispatch(loginSuccess({ user, tokens }));
 * await dispatch(loginThunk({ username, password }));
 * ```
 *
 * Thunk Support:
 * - Enables async action creators via Redux Thunk
 * - Returns promises for async actions
 * - Supports TypeScript discriminated unions for actions
 */
export type AppDispatch = typeof store.dispatch;

// ============================================================================
// Typed Hooks
// ============================================================================

/**
 * Typed dispatch hook
 *
 * Type-safe alternative to useDispatch from react-redux.
 * Returns dispatch function with AppDispatch type for thunk support.
 *
 * Benefits:
 * - Full TypeScript support for actions and thunks
 * - Autocomplete for action creators
 * - Compile-time error checking
 * - No need to manually type dispatch in every component
 *
 * Usage Example:
 * ```typescript
 * import { useAppDispatch } from '@/app/store';
 *
 * function LoginForm() {
 *   const dispatch = useAppDispatch();
 *
 *   const handleLogin = async () => {
 *     dispatch(loginInitiated());
 *     try {
 *       const result = await loginApi({ username, password });
 *       dispatch(loginSuccess(result));
 *     } catch (error) {
 *       dispatch(loginFailure(error));
 *     }
 *   };
 * }
 * ```
 *
 * Async Thunk Example:
 * ```typescript
 * const dispatch = useAppDispatch();
 * await dispatch(fetchUserThunk(userId));
 * ```
 *
 * @returns Typed dispatch function with thunk support
 */
export const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>();

/**
 * Typed selector hook
 *
 * Type-safe alternative to useSelector from react-redux.
 * Provides full TypeScript inference for state selection.
 *
 * Benefits:
 * - Autocomplete for state properties
 * - Type checking for selector return values
 * - Prevents accessing non-existent state paths
 * - Consistent typing across all components
 *
 * Usage Example:
 * ```typescript
 * import { useAppSelector } from '@/app/store';
 *
 * function UserProfile() {
 *   // TypeScript knows user is User | null
 *   const user = useAppSelector((state) => state.auth.user);
 *
 *   // TypeScript knows isAuthenticated is boolean
 *   const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
 *
 *   // Complex selector with full type inference
 *   const userDisplayName = useAppSelector((state) =>
 *     state.auth.user
 *       ? `${state.auth.user.firstname} ${state.auth.user.lastname}`
 *       : 'Guest'
 *   );
 * }
 * ```
 *
 * With Memoized Selectors:
 * ```typescript
 * import { createSelector } from '@reduxjs/toolkit';
 *
 * const selectUserRoles = createSelector(
 *   [(state: RootState) => state.auth.user],
 *   (user) => user?.roles.map((r) => r.shortname) ?? []
 * );
 *
 * const roles = useAppSelector(selectUserRoles);
 * ```
 *
 * Equality Comparison:
 * ```typescript
 * // Shallow equality (default)
 * const user = useAppSelector((state) => state.auth.user);
 *
 * // Custom equality (e.g., deep equality)
 * import { isEqual } from 'lodash-es';
 * const user = useAppSelector((state) => state.auth.user, isEqual);
 * ```
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default store export
 *
 * Enables both named and default imports:
 * - import { store } from '@/app/store';
 * - import store from '@/app/store';
 *
 * The store instance provides:
 * - getState(): Returns current state snapshot
 * - dispatch(action): Dispatches actions to update state
 * - subscribe(listener): Registers state change listeners
 * - replaceReducer(nextReducer): Hot module replacement support
 *
 * Store Methods:
 * ```typescript
 * // Get current state
 * const state = store.getState();
 *
 * // Dispatch action
 * store.dispatch(loginSuccess({ user, tokens }));
 *
 * // Subscribe to changes
 * const unsubscribe = store.subscribe(() => {
 *   console.log('State changed:', store.getState());
 * });
 * ```
 */
export default store;
