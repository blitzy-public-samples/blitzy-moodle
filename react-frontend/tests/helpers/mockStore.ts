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
} from '@/tests/helpers/mockData';
import type { User } from '@/types/entities';
import type { AuthTokens, AuthStatus } from '@/features/auth/types/auth.types';

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
 * const state = createAuthenticatedState();
 * const customUserState = createAuthenticatedState(createMockUser({ email: 'test@example.com' }));
 * ```
 */
export function createAuthenticatedState(user?: User): Partial<RootState> {
  const mockUser = user ?? createMockUser();
  const now = Math.floor(Date.now() / 1000);

  return {
    auth: {
      user: mockUser,
      tokens: {
        accessToken: 'mock-access-token-' + mockUser.id,
        refreshToken: 'mock-refresh-token-' + mockUser.id,
        expiresAt: now + 3600, // 1 hour from now
        refreshExpiresAt: now + 604800, // 7 days from now
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      status: 'authenticated' as AuthStatus,
    },
  };
}

/**
 * Creates state without authentication
 *
 * Returns partial state representing a logged-out user.
 * Useful for testing login flows and unauthenticated views.
 *
 * @returns {Partial<RootState>} State without authentication
 *
 * @example
 * ```typescript
 * const store = createMockStore(createUnauthenticatedState());
 * render(<LoginPage />, { store });
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
      status: 'unauthenticated' as AuthStatus,
    },
  };
}

/**
 * Creates state for a student user
 *
 * Returns partial state with authenticated student user having student role.
 * Useful for testing student-specific features and permissions.
 *
 * @returns {Partial<RootState>} State with authenticated student
 *
 * @example
 * ```typescript
 * const store = createMockStore(createStudentState());
 * render(<StudentDashboard />, { store });
 * ```
 */
export function createStudentState(): Partial<RootState> {
  const student = createMockStudent();
  return createAuthenticatedState(student);
}

/**
 * Creates state for a teacher user
 *
 * Returns partial state with authenticated teacher user having editingteacher role.
 * Useful for testing teacher-specific features like grading interfaces.
 *
 * @returns {Partial<RootState>} State with authenticated teacher
 *
 * @example
 * ```typescript
 * const store = createMockStore(createTeacherState());
 * render(<GradingInterface />, { store });
 * ```
 */
export function createTeacherState(): Partial<RootState> {
  const teacher = createMockTeacher();
  return createAuthenticatedState(teacher);
}

/**
 * Creates state for an admin user
 *
 * Returns partial state with authenticated admin user having site administrator role.
 * Useful for testing admin-only interfaces and permission-gated features.
 *
 * @returns {Partial<RootState>} State with authenticated admin
 *
 * @example
 * ```typescript
 * const store = createMockStore(createAdminState());
 * render(<UserManagementPage />, { store });
 * ```
 */
export function createAdminState(): Partial<RootState> {
  const admin = createMockAdmin();
  return createAuthenticatedState(admin);
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
  const now = Math.floor(Date.now() / 1000);

  return {
    user,
    tokens: {
      accessToken: token,
      refreshToken: 'refresh-' + token,
      expiresAt: now + 3600,
      refreshExpiresAt: now + 604800,
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
  const now = Math.floor(Date.now() / 1000);

  return {
    user,
    tokens: {
      accessToken: 'expired-access-token',
      refreshToken: 'valid-refresh-token',
      expiresAt: now - 3600, // Expired 1 hour ago
      refreshExpiresAt: now + 604800, // Refresh still valid
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
 */
function createSidebarState(isOpen: boolean = true): SidebarState {
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
     * @returns {Action[]} Array of matching actions
     */
    getDispatchedActions: (actionType?: string) => {
      if (!actionType) {
        return [...dispatchedActions];
      }
      return dispatchedActions.filter((action) => action.type === actionType);
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
  store.dispatch({ type: 'auth/clearAuth' });
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
    // Would need to dispatch appropriate actions
    Object.entries(updates.auth).forEach(([key, value]) => {
      // This is not ideal, but for testing purposes:
      store.dispatch({
        type: `auth/set${key.charAt(0).toUpperCase() + key.slice(1)}`,
        payload: value,
      });
    });
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
 * @param {any} store - Store instance to check
 * @returns {boolean} True if store has tracking
 */
export function isTrackingStore(store: any): store is MockStoreWithTracking {
  return (
    store &&
    'dispatchedActions' in store &&
    'clearDispatchedActions' in store
  );
}
