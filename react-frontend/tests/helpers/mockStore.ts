/**
 * Redux Store Mocking Utilities for Testing
 *
 * Provides comprehensive factory functions for creating isolated Redux stores with custom
 * initial states for testing React components that depend on Redux state. These utilities
 * reduce boilerplate in tests and ensure consistent test patterns across the application.
 *
 * Key Features:
 * - Create isolated Redux stores with same configuration as production
 * - Factory functions for common test scenarios (authenticated, student, teacher, admin)
 * - Dispatch tracking for verifying action dispatch in tests
 * - State selectors for inspecting store state during tests
 * - Store reset and update utilities for test isolation
 *
 * Usage Examples:
 * ```typescript
 * // Create store with authenticated student
 * const store = createMockStore(createStudentState());
 *
 * // Create store with custom auth state
 * const store = createMockStore({
 *   auth: createAuthState({ isAuthenticated: true })
 * });
 *
 * // Create store with dispatch tracking
 * const { store, dispatchedActions } = createMockStoreWithTracking();
 * // ... perform actions
 * expect(dispatchedActions).toContainEqual(expect.objectContaining({ type: 'auth/loginSuccess' }));
 *
 * // Use with custom render
 * const { getByText } = render(<LoginForm />, { initialState: createUnauthenticatedState() });
 * ```
 *
 * @see react-frontend/tests/helpers/testUtils.tsx - Custom render with Provider
 * @see react-frontend/src/app/store.ts - Production store configuration
 * @module tests/helpers/mockStore
 */

import { configureStore } from '@reduxjs/toolkit';
import type { EnhancedStore, Reducer, Action } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import type { RootState } from '@/app/store';
import { authReducer } from '@/features/auth/store/authSlice';
import type { AuthState } from '@/features/auth/store/authSlice';
import { sidebarReducer } from '@/app/slices/sidebarSlice';
import type { SidebarState } from '@/app/slices/sidebarSlice';
import {
  createMockUser,
  createMockStudent,
  createMockTeacher,
  createMockAdmin,
} from './mockData';
import type { User, AuthStatus } from '@/features/auth/types/auth.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Mock store with dispatch tracking capabilities
 *
 * Enhanced store instance that tracks all dispatched actions for test verification.
 * Enables assertions on what actions were dispatched during component interactions.
 */
export interface MockStoreWithTracking {
  /** Redux store instance with tracking enabled */
  store: EnhancedStore<RootState>;
  /** Array of all actions dispatched since store creation or last clear */
  dispatchedActions: Action[];
  /** Clear the dispatched actions array */
  clearDispatchedActions: () => void;
  /** Get all dispatched actions of a specific type */
  getDispatchedActions: (actionType?: string) => Action[];
  /** Assert that an action of specific type was dispatched */
  expectActionDispatched: (actionType: string) => void;
}

// ============================================================================
// Initial State Factories
// ============================================================================

/**
 * Creates default initial state for the Redux store
 *
 * Returns a complete RootState with all slices initialized to their default values.
 * Use this as the base for creating customized test states.
 *
 * @returns {RootState} Complete initial state with all slices
 *
 * @example
 * ```typescript
 * const state = createInitialState();
 * const customState = { ...state, auth: createAuthState({ isAuthenticated: true }) };
 * ```
 */
export function createInitialState(): RootState {
  return {
    auth: {
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      status: 'idle' as AuthStatus,
    },
    sidebar: {
      isOpen: true, // Desktop default
    },
  };
}

/**
 * Creates state with an authenticated user
 *
 * Returns partial state with authenticated user and valid tokens.
 * Useful for testing components that require authentication.
 *
 * @param {User} [user] - Custom user object, defaults to mock user
 * @returns {Partial<RootState>} State with authenticated user
 *
 * @example
 * ```typescript
 * const store = createMockStore(createAuthenticatedState());
 * expect(getAuthState(store).isAuthenticated).toBe(true);
 * ```
 */
export function createAuthenticatedState(user?: User): Partial<RootState> {
  const mockUser = user || createMockUser();

  return {
    auth: {
      user: mockUser,
      tokens: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600, // 1 hour in seconds
        tokenType: 'Bearer',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      status: 'authenticated' as AuthStatus,
    },
    sidebar: {
      isOpen: true,
    },
  };
}

/**
 * Creates state with no authenticated user
 *
 * Returns partial state with unauthenticated state.
 * Useful for testing login pages and guest-accessible components.
 *
 * @returns {Partial<RootState>} State without authentication
 *
 * @example
 * ```typescript
 * const store = createMockStore(createUnauthenticatedState());
 * expect(getAuthState(store).isAuthenticated).toBe(false);
 * ```
 */
export function createUnauthenticatedState(): Partial<RootState> {
  return {
    auth: {
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      status: 'idle' as AuthStatus,
    },
    sidebar: {
      isOpen: true,
    },
  };
}

/**
 * Creates state for a student user
 *
 * Returns partial state with authenticated student user.
 * Useful for testing student-specific features and permissions.
 *
 * @returns {Partial<RootState>} State with student user
 *
 * @example
 * ```typescript
 * const store = createMockStore(createStudentState());
 * const user = getAuthState(store).user;
 * expect(user?.roles).toContain('student');
 * ```
 */
export function createStudentState(): Partial<RootState> {
  return createAuthenticatedState(createMockStudent());
}

/**
 * Creates state for a teacher user
 *
 * Returns partial state with authenticated teacher user.
 * Useful for testing teacher-specific features like grading and course management.
 *
 * @returns {Partial<RootState>} State with teacher user
 *
 * @example
 * ```typescript
 * const store = createMockStore(createTeacherState());
 * const user = getAuthState(store).user;
 * expect(user?.roles).toContain('teacher');
 * ```
 */
export function createTeacherState(): Partial<RootState> {
  return createAuthenticatedState(createMockTeacher());
}

/**
 * Creates state for an admin user
 *
 * Returns partial state with authenticated admin user.
 * Useful for testing admin-only features like user management and system settings.
 *
 * @returns {Partial<RootState>} State with admin user
 *
 * @example
 * ```typescript
 * const store = createMockStore(createAdminState());
 * const user = getAuthState(store).user;
 * expect(user?.roles).toContain('admin');
 * ```
 */
export function createAdminState(): Partial<RootState> {
  return createAuthenticatedState(createMockAdmin());
}

// ============================================================================
// User State Helpers (Placeholder for Future User Slice)
// ============================================================================

/**
 * User state interface (placeholder for future user slice)
 *
 * Note: This is a placeholder for the planned user state slice.
 * Once the user slice is implemented in the store, this should be imported from there.
 */
export interface UserState {
  preferences: UserPreferences;
  profile: User | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * User preferences interface
 */
export interface UserPreferences {
  language: string;
  timezone: string;
  emailNotifications: boolean;
  dateFormat: string;
}

/**
 * Creates user state with custom overrides
 *
 * Note: This is a placeholder for the planned user slice.
 * Returns mock user state for testing purposes.
 *
 * @param {Partial<UserState>} [overrides] - Custom user state overrides
 * @returns {UserState} User state
 *
 * @example
 * ```typescript
 * const userState = createUserState({ isLoading: true });
 * expect(userState.isLoading).toBe(true);
 * ```
 */
export function createUserState(overrides: Partial<UserState> = {}): UserState {
  const defaultState: UserState = {
    preferences: {
      language: 'en',
      timezone: 'UTC',
      emailNotifications: true,
      dateFormat: 'YYYY-MM-DD',
    },
    profile: null,
    isLoading: false,
    error: null,
  };

  return {
    ...defaultState,
    ...overrides,
    preferences: {
      ...defaultState.preferences,
      ...(overrides.preferences ?? {}),
    },
  };
}

/**
 * Creates user preferences with custom overrides
 *
 * @param {Partial<UserPreferences>} [overrides] - Custom preferences
 * @returns {UserPreferences} User preferences
 *
 * @example
 * ```typescript
 * const prefs = createUserPreferences({ language: 'es' });
 * expect(prefs.language).toBe('es');
 * ```
 */
export function createUserPreferences(
  overrides: Partial<UserPreferences> = {}
): UserPreferences {
  return {
    language: 'en',
    timezone: 'UTC',
    emailNotifications: true,
    dateFormat: 'YYYY-MM-DD',
    ...overrides,
  };
}

/**
 * Creates user state with user profile
 *
 * @param {User} user - User object for profile
 * @returns {UserState} User state with profile
 *
 * @example
 * ```typescript
 * const user = createMockUser();
 * const userState = createUserProfile(user);
 * expect(userState.profile).toEqual(user);
 * ```
 */
export function createUserProfile(user: User): UserState {
  return createUserState({ profile: user });
}

// ============================================================================
// Theme State Helpers (Placeholder for Future Theme Slice)
// ============================================================================

/**
 * Theme state interface (placeholder for future theme slice)
 *
 * Note: This is a placeholder for the planned theme slice.
 * Once the theme slice is implemented in the store, this should be imported from there.
 */
export interface ThemeState {
  mode: 'light' | 'dark';
  customColors: Record<string, string>;
  fontSize: 'small' | 'medium' | 'large';
}

/**
 * Creates theme state with custom mode
 *
 * Note: This is a placeholder for the planned theme slice.
 * Returns mock theme state for testing purposes.
 *
 * @param {'light' | 'dark'} [mode='light'] - Theme mode
 * @returns {ThemeState} Theme state
 *
 * @example
 * ```typescript
 * const themeState = createThemeState('dark');
 * expect(themeState.mode).toBe('dark');
 * ```
 */
export function createThemeState(mode: 'light' | 'dark' = 'light'): ThemeState {
  return {
    mode,
    customColors: {},
    fontSize: 'medium',
  };
}

/**
 * Creates light theme state
 *
 * @returns {ThemeState} Light theme state
 *
 * @example
 * ```typescript
 * const themeState = createLightThemeState();
 * expect(themeState.mode).toBe('light');
 * ```
 */
export function createLightThemeState(): ThemeState {
  return createThemeState('light');
}

/**
 * Creates dark theme state
 *
 * @returns {ThemeState} Dark theme state
 *
 * @example
 * ```typescript
 * const themeState = createDarkThemeState();
 * expect(themeState.mode).toBe('dark');
 * ```
 */
export function createDarkThemeState(): ThemeState {
  return createThemeState('dark');
}

// ============================================================================
// Auth State Helpers
// ============================================================================

/**
 * Creates auth state with custom overrides
 *
 * Returns complete AuthState with default values that can be overridden.
 * Provides fine-grained control over auth state for specific test scenarios.
 *
 * @param {Partial<AuthState>} [overrides] - Properties to override in default auth state
 * @returns {AuthState} Complete auth state
 *
 * @example
 * ```typescript
 * const authState = createAuthState({ isLoading: true });
 * const errorState = createAuthState({ error: { code: 'INVALID_CREDENTIALS', message: 'Login failed' } });
 * ```
 */
export function createAuthState(overrides: Partial<AuthState> = {}): AuthState {
  const defaultState: AuthState = {
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    status: 'idle' as AuthStatus,
  };

  return {
    ...defaultState,
    ...overrides,
  };
}

/**
 * Creates auth state with valid token and user
 *
 * Returns authenticated auth state with specified token and user.
 * Useful for testing token-dependent behavior.
 *
 * @param {string} token - Access token value
 * @param {User} user - User object
 * @returns {AuthState} Auth state with token and user
 *
 * @example
 * ```typescript
 * const user = createMockUser();
 * const authState = createAuthStateWithToken('test-token', user);
 * ```
 */
export function createAuthStateWithToken(token: string, user: User): AuthState {
  return {
    user,
    tokens: {
      accessToken: token,
      refreshToken: `refresh-${  token}`,
      expiresIn: 3600, // 1 hour in seconds
      tokenType: 'Bearer',
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    status: 'authenticated' as AuthStatus,
  };
}

/**
 * Creates auth state with expired token
 *
 * Returns auth state with expired tokens to test token refresh flows.
 * Useful for testing automatic token refresh behavior.
 *
 * @returns {AuthState} Auth state with expired tokens
 *
 * @example
 * ```typescript
 * const store = createMockStore({ auth: createExpiredAuthState() });
 * render(<ProtectedRoute />, { store });
 * // Should trigger token refresh
 * ```
 */
export function createExpiredAuthState(): AuthState {
  const user = createMockUser();

  return {
    user,
    tokens: {
      accessToken: 'expired-access-token',
      refreshToken: 'valid-refresh-token',
      expiresIn: -3600, // Negative value indicates expired (1 hour ago)
      tokenType: 'Bearer',
    },
    isAuthenticated: true, // Still authenticated, just needs refresh
    isLoading: false,
    error: null,
    status: 'authenticated' as AuthStatus,
  };
}

// ============================================================================
// Sidebar State Helpers
// ============================================================================

/**
 * Creates sidebar state with custom open/close state
 *
 * @param {boolean} [isOpen=true] - Whether sidebar is open
 * @returns {SidebarState} Sidebar state
 *
 * @example
 * ```typescript
 * const sidebarState = createSidebarState(false);
 * // Returns: { isOpen: false }
 * ```
 */
export function createSidebarState(isOpen: boolean = true): SidebarState {
  return { isOpen };
}

// ============================================================================
// Mock Store Creation
// ============================================================================

/**
 * Creates an isolated Redux store for testing
 *
 * Returns a Redux store configured identically to production store but with
 * custom initial state. Each test gets an independent store instance to prevent
 * test interference.
 *
 * @param {Partial<RootState>} [initialState] - Custom initial state (merged with defaults)
 * @returns {EnhancedStore<RootState>} Configured Redux store
 *
 * @example
 * ```typescript
 * // Create store with default state
 * const store = createMockStore();
 *
 * // Create store with authenticated user
 * const store = createMockStore(createAuthenticatedState());
 *
 * // Create store with custom partial state
 * const store = createMockStore({
 *   auth: createAuthState({ isLoading: true })
 * });
 * ```
 */
export function createMockStore(
  initialState?: Partial<RootState>
): EnhancedStore<RootState> {
  // Merge provided initial state with defaults
  const defaultState = createInitialState();
  const mergedState: RootState = {
    ...defaultState,
    ...initialState,
    auth: {
      ...defaultState.auth,
      ...(initialState?.auth ?? {}),
    },
    sidebar: {
      ...defaultState.sidebar,
      ...(initialState?.sidebar ?? {}),
    },
  };

  // Configure store with same setup as production
  return configureStore({
    reducer: {
      auth: authReducer as Reducer,
      sidebar: sidebarReducer as Reducer,
    },
    preloadedState: mergedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false, // Disable for tests
        immutableCheck: false, // Disable for tests
      }),
    devTools: false, // Disable DevTools in tests
  });
}

// ============================================================================
// Dispatch Tracking
// ============================================================================

/**
 * Creates a mock store with action dispatch tracking
 *
 * Returns a store with enhanced dispatch function that records all dispatched actions.
 * Provides utilities for verifying action dispatch behavior in tests.
 *
 * @param {Partial<RootState>} [initialState] - Custom initial state
 * @returns {MockStoreWithTracking} Store with tracking utilities
 *
 * @example
 * ```typescript
 * const { store, dispatchedActions, expectActionDispatched } = createMockStoreWithTracking();
 *
 * render(<LoginForm />, { store });
 * fireEvent.click(screen.getByRole('button', { name: /login/i }));
 *
 * // Verify login action was dispatched
 * expectActionDispatched('auth/loginInitiated');
 *
 * // Or check manually
 * expect(dispatchedActions).toContainEqual(
 *   expect.objectContaining({ type: 'auth/loginSuccess' })
 * );
 * ```
 */
export function createMockStoreWithTracking(
  initialState?: Partial<RootState>
): MockStoreWithTracking {
  const store = createMockStore(initialState);
  const dispatchedActions: Action[] = [];

  // Save original dispatch
  const originalDispatch = store.dispatch;

  // Replace dispatch with tracking version
  store.dispatch = vi.fn((action: Action) => {
    dispatchedActions.push(action);
    return originalDispatch(action);
  }) as typeof store.dispatch;

  return {
    store,
    dispatchedActions,

    /**
     * Clears the array of dispatched actions
     *
     * Useful for resetting tracking between test phases or assertions.
     */
    clearDispatchedActions: () => {
      dispatchedActions.length = 0;
    },

    /**
     * Gets all dispatched actions, optionally filtered by type
     *
     * @param {string} [actionType] - Filter by action type (e.g., 'auth/loginSuccess')
     *                                 Can be exact match or prefix (e.g., 'auth/' for all auth actions)
     * @returns {Action[]} Array of matching actions
     */
    getDispatchedActions: (actionType?: string) => {
      if (!actionType) {
        return [...dispatchedActions];
      }
      // Support both exact match and prefix matching
      return dispatchedActions.filter(
        (action) => action.type === actionType || action.type.startsWith(actionType)
      );
    },

    /**
     * Asserts that an action of specific type was dispatched
     *
     * Throws assertion error if action type was not dispatched.
     *
     * @param {string} actionType - Action type to verify (e.g., 'auth/loginSuccess')
     * @throws {Error} If action type was not found in dispatched actions
     */
    expectActionDispatched: (actionType: string) => {
      const found = dispatchedActions.some(
        (action) => action.type === actionType
      );
      if (!found) {
        const actionTypes = dispatchedActions.map((a) => a.type).join(', ');
        throw new Error(
          `Expected action "${actionType}" to be dispatched. ` +
            `Dispatched actions: ${actionTypes || 'none'}`
        );
      }
    },
  };
}

// ============================================================================
// State Selectors for Testing
// ============================================================================

/**
 * Gets auth state from store
 *
 * Convenience selector for accessing auth state in tests.
 *
 * @param {EnhancedStore<RootState>} store - Redux store instance
 * @returns {AuthState} Current auth state
 *
 * @example
 * ```typescript
 * const store = createMockStore(createAuthenticatedState());
 * const authState = getAuthState(store);
 * expect(authState.isAuthenticated).toBe(true);
 * ```
 */
export function getAuthState(store: EnhancedStore<RootState>): AuthState {
  return store.getState().auth;
}

/**
 * Gets sidebar state from store
 *
 * Convenience selector for accessing sidebar state in tests.
 *
 * @param {EnhancedStore<RootState>} store - Redux store instance
 * @returns {SidebarState} Current sidebar state
 */
export function getSidebarState(
  store: EnhancedStore<RootState>
): SidebarState {
  return store.getState().sidebar;
}

/**
 * Gets user state from store
 *
 * Convenience selector for accessing user state in tests.
 *
 * Note: This is a placeholder for the planned user slice.
 * Currently returns mock user state.
 *
 * @param {EnhancedStore<RootState>} store - Redux store instance
 * @returns {UserState} Current user state (placeholder)
 *
 * @example
 * ```typescript
 * const store = createMockStore();
 * const userState = getUserState(store);
 * expect(userState.preferences).toBeDefined();
 * ```
 */
export function getUserState(_store: EnhancedStore<RootState>): UserState {
  // Placeholder: Return mock user state since user slice doesn't exist yet
  // Once user slice is added to store, this should return: _store.getState().user
  return createUserState();
}

/**
 * Gets theme state from store
 *
 * Convenience selector for accessing theme state in tests.
 *
 * Note: This is a placeholder for the planned theme slice.
 * Currently returns mock theme state.
 *
 * @param {EnhancedStore<RootState>} store - Redux store instance
 * @returns {ThemeState} Current theme state (placeholder)
 *
 * @example
 * ```typescript
 * const store = createMockStore();
 * const themeState = getThemeState(store);
 * expect(themeState.mode).toBe('light');
 * ```
 */
export function getThemeState(_store: EnhancedStore<RootState>): ThemeState {
  // Placeholder: Return mock theme state since theme slice doesn't exist yet
  // Once theme slice is added to store, this should return: _store.getState().theme
  return createThemeState('light');
}

/**
 * Gets complete state snapshot from store
 *
 * Returns current state of entire Redux store for comprehensive assertions.
 *
 * @param {EnhancedStore<RootState>} store - Redux store instance
 * @returns {RootState} Complete current state
 *
 * @example
 * ```typescript
 * const store = createMockStore();
 * store.dispatch(loginSuccess({ user, tokens }));
 * const state = getStoreSnapshot(store);
 * expect(state.auth.isAuthenticated).toBe(true);
 * expect(state.sidebar.isOpen).toBe(true);
 * ```
 */
export function getStoreSnapshot(store: EnhancedStore<RootState>): RootState {
  return store.getState();
}

// ============================================================================
// Store Manipulation Utilities
// ============================================================================

/**
 * Resets store to initial state
 *
 * Dispatches actions to reset all slices to their initial values.
 * Useful for cleanup between test phases.
 *
 * @param {EnhancedStore<RootState>} store - Redux store to reset
 *
 * @example
 * ```typescript
 * const store = createMockStore(createAuthenticatedState());
 * // ... perform test actions
 * resetStore(store);
 * expect(getAuthState(store).isAuthenticated).toBe(false);
 * ```
 */
export function resetStore(store: EnhancedStore<RootState>): void {
  // Import action creators (would need to be added to slices)
  // For now, create a new store with initial state is simpler
  const initialState = createInitialState();

  // Dispatch reset actions for each slice
  // Note: This requires reset actions in each slice
  // Alternative: Just create a new store instance in tests
  store.dispatch({ type: 'auth/logout' });
  store.dispatch({ type: 'sidebar/setSidebarOpen', payload: initialState.sidebar.isOpen });
}

/**
 * Updates store state with partial updates
 *
 * Directly modifies store state for test setup. Use sparingly as it bypasses
 * normal Redux flow. Prefer dispatching actions when testing action behavior.
 *
 * @param {EnhancedStore<RootState>} store - Redux store to update
 * @param {Partial<RootState>} updates - Partial state updates
 *
 * @example
 * ```typescript
 * const store = createMockStore();
 * updateStoreState(store, {
 *   auth: createAuthState({ isLoading: true })
 * });
 * expect(getAuthState(store).isLoading).toBe(true);
 * ```
 *
 * @deprecated Prefer using action dispatches or creating new store with initial state
 */
export function updateStoreState(
  store: EnhancedStore<RootState>,
  updates: Partial<RootState>
): void {
  // This function would require store enhancers or direct state manipulation
  // which breaks Redux principles. Better to dispatch actions or create new store.
  // Keeping for API compatibility but marking as deprecated.

  console.warn(
    'updateStoreState is deprecated. Create a new store with desired initial state instead.'
  );

  // To properly update, we'd need to dispatch actions
  if (updates.auth) {
    // Check if we're authenticating or logging out
    if (updates.auth.isAuthenticated && updates.auth.user && updates.auth.tokens) {
      // Dispatch loginSuccess action
      store.dispatch({
        type: 'auth/loginSuccess',
        payload: {
          user: updates.auth.user,
          tokens: updates.auth.tokens,
        },
      });
    } else if (updates.auth.isAuthenticated === false) {
      // Dispatch logout action
      store.dispatch({
        type: 'auth/logout',
      });
    }
  }

  if (updates.sidebar) {
    if ('isOpen' in updates.sidebar) {
      store.dispatch({
        type: 'sidebar/setSidebarOpen',
        payload: updates.sidebar.isOpen,
      });
    }
  }
}

/**
 * Type guard to check if store has tracking capabilities
 *
 * @param {unknown} store - Store instance to check
 * @returns {boolean} True if store has tracking
 */
export function isTrackingStore(store: unknown): store is MockStoreWithTracking {
  return (
    typeof store === 'object' &&
    store !== null &&
    'dispatchedActions' in store &&
    'clearDispatchedActions' in store
  );
}
