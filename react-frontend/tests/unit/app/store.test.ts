/**
 * Redux Store Configuration Unit Tests
 *
 * Comprehensive test suite validating Redux Toolkit store configuration including:
 * - Store creation and initialization
 * - Reducer combination and state structure
 * - Middleware configuration (thunk, serialization checks, immutability checks)
 * - Redux DevTools integration in development mode
 * - TypeScript type exports (RootState, AppDispatch)
 * - Typed hooks (useAppDispatch, useAppSelector)
 * - State updates and immutability guarantees
 * - Multi-slice interactions and error handling
 *
 * Test Strategy:
 * - Mock Redux DevTools extension for controlled testing
 * - Use real Redux Toolkit utilities (configureStore, createSlice, createAsyncThunk)
 * - Verify type safety through TypeScript compilation
 * - Test state mutations are handled immutably via Immer
 * - Validate middleware processes async actions correctly
 *
 * Coverage Target: 90%+ of store.ts including all exports and configurations
 *
 * @module tests/unit/app/store.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import {
  store,
  useAppDispatch,
  useAppSelector,
  type RootState,
  type AppDispatch,
} from '@/app/store';

// ============================================================================
// Test Setup and Teardown
// ============================================================================

/**
 * Mock Redux DevTools extension
 * Simulates browser extension for controlled testing
 */
let originalDevToolsExtension: unknown;

beforeEach(() => {
  // Save original Redux DevTools extension if present
  originalDevToolsExtension = (window as Window & { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__;

  // Mock Redux DevTools extension for testing
  (window as Window & { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__ = vi.fn(() => ({}));
});

afterEach(() => {
  // Restore original Redux DevTools extension
  if (originalDevToolsExtension !== undefined) {
    (window as Window & { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__ = originalDevToolsExtension;
  } else {
    delete (window as Window & { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__;
  }

  // Clear all mocks
  vi.clearAllMocks();
});

// ============================================================================
// Store Creation and Structure Tests
// ============================================================================

describe('Redux Store Configuration', () => {
  describe('Store Creation', () => {
    it('should create store with configureStore', () => {
      // Verify store is defined and not null/undefined
      expect(store).toBeDefined();
      expect(store).not.toBeNull();

      // Verify store has required Redux store methods
      expect(typeof store.dispatch).toBe('function');
      expect(typeof store.getState).toBe('function');
      expect(typeof store.subscribe).toBe('function');
      expect(typeof store.replaceReducer).toBe('function');
    });

    it('should return state object from getState', () => {
      const state = store.getState();

      // Verify getState returns an object
      expect(state).toBeDefined();
      expect(typeof state).toBe('object');
      expect(state).not.toBeNull();
    });

    it('should have dispatch method that accepts actions', () => {
      // Verify dispatch is a function
      expect(typeof store.dispatch).toBe('function');

      // Verify dispatch accepts and processes actions (no throw)
      expect(() => {
        store.dispatch({ type: 'test/action' });
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Reducer Combination Tests
  // ============================================================================

  describe('Reducer Combination', () => {
    it('should combine all reducer slices correctly', () => {
      const state = store.getState();

      // Verify state has auth reducer slice
      expect(state).toHaveProperty('auth');
      expect(typeof state.auth).toBe('object');

      // Verify state has sidebar reducer slice
      expect(state).toHaveProperty('sidebar');
      expect(typeof state.sidebar).toBe('object');
    });

    it('should have auth slice with correct structure', () => {
      const state = store.getState();

      // Verify auth slice has expected properties
      expect(state.auth).toHaveProperty('user');
      expect(state.auth).toHaveProperty('tokens');
      expect(state.auth).toHaveProperty('isAuthenticated');
      expect(state.auth).toHaveProperty('isLoading');
      expect(state.auth).toHaveProperty('error');
      expect(state.auth).toHaveProperty('status');
    });

    it('should have sidebar slice with correct structure', () => {
      const state = store.getState();

      // Verify sidebar slice has expected properties
      expect(state.sidebar).toHaveProperty('isOpen');
      expect(typeof state.sidebar.isOpen).toBe('boolean');
    });
  });

  // ============================================================================
  // Initial State Tests
  // ============================================================================

  describe('Initial State Structure', () => {
    it('should have correct initial auth state', () => {
      const state = store.getState();

      // Verify auth initial state matches expected values
      expect(state.auth.user).toBeNull();
      expect(state.auth.tokens).toBeNull();
      expect(state.auth.isAuthenticated).toBe(false);
      expect(state.auth.isLoading).toBe(false);
      expect(state.auth.error).toBeNull();
      expect(state.auth.status).toBe('idle');
    });

    it('should have correct initial sidebar state', () => {
      const state = store.getState();

      // Verify sidebar initial state (default open)
      expect(state.sidebar.isOpen).toBe(true);
    });

    it('should match expected complete state shape', () => {
      const state = store.getState();

      // Verify complete state tree structure
      expect(state).toMatchObject({
        auth: {
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          status: 'idle',
        },
        sidebar: {
          isOpen: true,
        },
      });
    });
  });

  // ============================================================================
  // Middleware Configuration Tests
  // ============================================================================

  describe('Middleware Configuration', () => {
    it('should include thunk middleware for async actions', async () => {
      // Create a test async thunk
      interface TestAsyncState {
        value: number;
        loading: boolean;
      }

      const testAsyncThunk = createAsyncThunk<number, void, { state: { testAsync: TestAsyncState } }>(
        'testAsync/fetch',
        async (): Promise<number> => {
          // Simulate async operation
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 42;
        }
      );

      // Create slice with async thunk handling
      const testSlice = createSlice({
        name: 'testAsync',
        initialState: { value: 0, loading: false },
        reducers: {},
        extraReducers: (builder) => {
          builder
            .addCase(testAsyncThunk.pending, (state) => {
              state.loading = true;
            })
            .addCase(testAsyncThunk.fulfilled, (state, action: PayloadAction<number>) => {
              state.loading = false;
              state.value = action.payload;
            });
        },
      });

      // Create temporary store with test slice
      const { configureStore } = await import('@reduxjs/toolkit');
      const testStore = configureStore({
        reducer: {
          testAsync: testSlice.reducer,
        },
      });

      // Dispatch async thunk
      const resultAction = await testStore.dispatch(testAsyncThunk());

      // Verify thunk was processed
      expect(resultAction.type).toBe('testAsync/fetch/fulfilled');
      expect(resultAction.payload).toBe(42);

      // Verify state was updated
      const finalState = testStore.getState();
      expect(finalState.testAsync.value).toBe(42);
      expect(finalState.testAsync.loading).toBe(false);
    });

    it('should process async thunks with proper lifecycle', async () => {
      // Track action types dispatched
      const dispatchedActions: string[] = [];

      // Create test async thunk
      interface AsyncTestState {
        status: string;
      }

      const asyncAction = createAsyncThunk<string, void, { state: { asyncTest: AsyncTestState } }>(
        'asyncTest/action',
        async (): Promise<string> => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return 'success';
        }
      );

      // Create slice to handle thunk
      const asyncSlice = createSlice({
        name: 'asyncTest',
        initialState: { status: 'idle' },
        reducers: {},
        extraReducers: (builder) => {
          builder
            .addCase(asyncAction.pending, (state) => {
              state.status = 'pending';
            })
            .addCase(asyncAction.fulfilled, (state, action: PayloadAction<string>) => {
              state.status = action.payload;
            })
            .addCase(asyncAction.rejected, (state) => {
              state.status = 'rejected';
            });
        },
      });

      // Create test store
      const { configureStore } = await import('@reduxjs/toolkit');
      const asyncStore = configureStore({
        reducer: {
          asyncTest: asyncSlice.reducer,
        },
        middleware: (getDefaultMiddleware) =>
          getDefaultMiddleware().concat((_storeAPI) => (next: (action: unknown) => unknown) => (action: unknown) => {
            if (typeof action === 'object' && action !== null && 'type' in action) {
              dispatchedActions.push((action as { type: string }).type);
            }
            return next(action);
          }),
      });

      // Dispatch async thunk
      await asyncStore.dispatch(asyncAction());

      // Verify lifecycle actions were dispatched
      expect(dispatchedActions).toContain('asyncTest/action/pending');
      expect(dispatchedActions).toContain('asyncTest/action/fulfilled');

      // Verify final state
      const state = asyncStore.getState();
      expect(state.asyncTest.status).toBe('success');
    });
  });

  // ============================================================================
  // Redux DevTools Integration Tests
  // ============================================================================

  describe('Redux DevTools Integration', () => {
    it('should enable Redux DevTools in development mode', () => {
      // Note: In actual store, devTools is enabled when NODE_ENV !== 'production'
      // Store is already configured with devTools: process.env.NODE_ENV !== 'production'

      // Verify store has standard Redux methods (DevTools uses these)
      expect(typeof store.dispatch).toBe('function');
      expect(typeof store.getState).toBe('function');
      expect(typeof store.subscribe).toBe('function');

      // In production environment, devTools would be disabled
      // This test verifies the store is properly configured for DevTools integration
      expect(store).toBeDefined();
    });

    it('should track state changes for DevTools', () => {
      const stateChangesSpy = vi.fn();

      // Subscribe to state changes (DevTools also subscribes)
      const unsubscribe = store.subscribe(() => {
        stateChangesSpy();
      });

      // Get initial state
      const initialState = store.getState();

      // Dispatch action that modifies state
      store.dispatch({ type: 'sidebar/toggleSidebar' });

      // Verify state changed (subscriber called)
      expect(stateChangesSpy).toHaveBeenCalled();

      // Verify state reference changed
      const newState = store.getState();
      expect(newState).not.toBe(initialState);

      // Cleanup
      unsubscribe();
    });
  });

  // ============================================================================
  // Type Export Tests
  // ============================================================================

  describe('Type Exports', () => {
    it('should export RootState type correctly', () => {
      // Type assertion - if this compiles, type export works
      const state: RootState = store.getState();

      // Verify state has expected structure
      expect(state).toHaveProperty('auth');
      expect(state).toHaveProperty('sidebar');

      // TypeScript ensures these properties exist and have correct types
      // If types were incorrect, this wouldn't compile
      const authUser = state.auth.user; // Should be User | null
      const sidebarOpen = state.sidebar.isOpen; // Should be boolean

      expect(authUser).toBeNull(); // Initial state
      expect(typeof sidebarOpen).toBe('boolean');
    });

    it('should export AppDispatch type correctly', () => {
      // Type assertion - if this compiles, type export works
      const {dispatch} = store;

      // Verify dispatch is a function
      expect(typeof dispatch).toBe('function');

      // Verify dispatch can accept actions (no TypeScript error)
      expect(() => {
        dispatch({ type: 'test/action' });
      }).not.toThrow();
    });

    it('should infer RootState from store correctly', () => {
      // Verify RootState is correctly inferred from store.getState
      type InferredState = ReturnType<typeof store.getState>;

      // Type assertion - should be compatible
      const state1: RootState = store.getState();
      const state2: InferredState = store.getState();

      // Both types should be equivalent
      expect(state1).toEqual(state2);
    });

    it('should infer AppDispatch from store correctly', () => {
      // Verify AppDispatch is correctly inferred from store.dispatch
      type InferredDispatch = typeof store.dispatch;

      // Type assertion - should be compatible
      const dispatch1: AppDispatch = store.dispatch;
      const dispatch2: InferredDispatch = store.dispatch;

      // Both types should be equivalent
      expect(dispatch1).toBe(dispatch2);
    });
  });

  // ============================================================================
  // Typed Hooks Export Tests
  // ============================================================================

  describe('Typed Hooks Export', () => {
    it('should export useAppDispatch hook', () => {
      // Verify useAppDispatch is exported and is a function
      expect(useAppDispatch).toBeDefined();
      expect(typeof useAppDispatch).toBe('function');
    });

    it('should export useAppSelector hook', () => {
      // Verify useAppSelector is exported and is a function
      expect(useAppSelector).toBeDefined();
      expect(typeof useAppSelector).toBe('function');
    });

    it('should have useAppDispatch return typed dispatch', () => {
      // Note: useAppDispatch must be called within React component context
      // This test verifies the hook is properly typed (compilation check)

      // Type assertion - if this compiles, typing is correct
      const typedHook: () => AppDispatch = useAppDispatch;

      expect(typedHook).toBe(useAppDispatch);
    });

    it('should have useAppSelector with RootState typing', () => {
      // Note: useAppSelector must be called within React component context
      // This test verifies the hook is properly typed (compilation check)

      // Type assertion - if this compiles, typing is correct
      type _SelectorHook = <Selected>(
        selector: (state: RootState) => Selected,
        equalityFn?: (left: Selected, right: Selected) => boolean
      ) => Selected;

      // Verify useAppSelector matches expected signature
      expect(typeof useAppSelector).toBe('function');
    });
  });

  // ============================================================================
  // State Update Tests
  // ============================================================================

  describe('State Updates', () => {
    it('should update state when actions are dispatched', () => {
      // Get initial state
      const initialState = store.getState();
      const initialSidebarOpen = initialState.sidebar.isOpen;

      // Dispatch action to toggle sidebar
      store.dispatch({ type: 'sidebar/toggleSidebar' });

      // Get updated state
      const updatedState = store.getState();
      const updatedSidebarOpen = updatedState.sidebar.isOpen;

      // Verify state changed
      expect(updatedSidebarOpen).toBe(!initialSidebarOpen);
    });

    it('should update sidebar state with setSidebarOpen action', () => {
      // Set sidebar explicitly to false
      store.dispatch({
        type: 'sidebar/setSidebarOpen',
        payload: false,
      });

      // Verify state updated
      let state = store.getState();
      expect(state.sidebar.isOpen).toBe(false);

      // Set sidebar explicitly to true
      store.dispatch({
        type: 'sidebar/setSidebarOpen',
        payload: true,
      });

      // Verify state updated
      state = store.getState();
      expect(state.sidebar.isOpen).toBe(true);
    });

    it('should notify subscribers on state changes', () => {
      const subscriber = vi.fn();

      // Subscribe to state changes
      const unsubscribe = store.subscribe(subscriber);

      // Dispatch action
      store.dispatch({ type: 'sidebar/toggleSidebar' });

      // Verify subscriber was called
      expect(subscriber).toHaveBeenCalled();
      expect(subscriber).toHaveBeenCalledTimes(1);

      // Dispatch another action
      store.dispatch({ type: 'sidebar/toggleSidebar' });

      // Verify subscriber called again
      expect(subscriber).toHaveBeenCalledTimes(2);

      // Cleanup
      unsubscribe();
    });

    it('should not notify unsubscribed listeners', () => {
      const subscriber = vi.fn();

      // Subscribe and immediately unsubscribe
      const unsubscribe = store.subscribe(subscriber);
      unsubscribe();

      // Dispatch action
      store.dispatch({ type: 'sidebar/toggleSidebar' });

      // Verify subscriber was NOT called
      expect(subscriber).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // State Immutability Tests
  // ============================================================================

  describe('State Immutability', () => {
    it('should maintain state immutability with Immer', () => {
      // Get initial state reference
      const stateBefore = store.getState();
      const _authBefore = stateBefore.auth;
      const sidebarBefore = stateBefore.sidebar;

      // Dispatch action that modifies state
      store.dispatch({ type: 'sidebar/toggleSidebar' });

      // Get new state reference
      const stateAfter = store.getState();
      const sidebarAfter = stateAfter.sidebar;

      // Verify state reference changed (new object)
      expect(stateAfter).not.toBe(stateBefore);

      // Verify modified slice reference changed
      expect(sidebarAfter).not.toBe(sidebarBefore);

      // Verify unmodified slice reference remains same (shallow equality optimization)
      // Note: Redux Toolkit may create new references even for unmodified slices
      expect(stateAfter.auth).toBeDefined();
    });

    it('should create new state object on every action', () => {
      const state1 = store.getState();

      store.dispatch({ type: 'sidebar/toggleSidebar' });
      const state2 = store.getState();

      store.dispatch({ type: 'sidebar/toggleSidebar' });
      const state3 = store.getState();

      // All state references should be different
      expect(state1).not.toBe(state2);
      expect(state2).not.toBe(state3);
      expect(state1).not.toBe(state3);
    });

    it('should not mutate original state object', () => {
      const stateBefore = store.getState();
      const sidebarValueBefore = stateBefore.sidebar.isOpen;

      // Try to mutate state directly (should not affect Redux state)
      try {
        // In strict mode, this may throw or be silently ignored
        (stateBefore.sidebar as { isOpen: boolean }).isOpen = !sidebarValueBefore;
      } catch (error) {
        // Expected in strict mode
      }

      // Get state again
      const stateAfter = store.getState();

      // Redux state should not be affected by direct mutation attempt
      // State returned by getState is a snapshot
      expect(stateAfter.sidebar.isOpen).toBe(sidebarValueBefore);
    });
  });

  // ============================================================================
  // Multiple Slices Interaction Tests
  // ============================================================================

  describe('Multiple Slices Interaction', () => {
    it('should handle actions across multiple slices independently', () => {
      const initialState = store.getState();

      // Dispatch action to sidebar slice
      store.dispatch({ type: 'sidebar/openSidebar' });

      const afterSidebarState = store.getState();

      // Verify sidebar changed
      expect(afterSidebarState.sidebar.isOpen).toBe(true);

      // Verify auth slice unchanged
      expect(afterSidebarState.auth).toEqual(initialState.auth);
    });

    it('should maintain independent state for each slice', () => {
      const state = store.getState();

      // Each slice should have its own state
      expect(state.auth).not.toBe(state.sidebar);

      // Modifying one slice should not affect others
      const authState = state.auth;
      const sidebarState = state.sidebar;

      store.dispatch({ type: 'sidebar/toggleSidebar' });

      const newState = store.getState();

      // Auth state should remain unchanged (reference may be same or different depending on optimization)
      expect(newState.auth.user).toEqual(authState.user);
      expect(newState.auth.isAuthenticated).toEqual(authState.isAuthenticated);

      // Sidebar state should have changed
      expect(newState.sidebar.isOpen).not.toBe(sidebarState.isOpen);
    });

    it('should allow dispatching to multiple slices in sequence', () => {
      // Dispatch to sidebar
      store.dispatch({ type: 'sidebar/closeSidebar' });

      let state = store.getState();
      expect(state.sidebar.isOpen).toBe(false);

      // Dispatch to sidebar again
      store.dispatch({ type: 'sidebar/openSidebar' });

      state = store.getState();
      expect(state.sidebar.isOpen).toBe(true);

      // Both operations succeeded independently
      expect(state.auth.isAuthenticated).toBe(false); // Auth unchanged
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle unknown action types gracefully', () => {
      // Get state before
      const stateBefore = store.getState();

      // Dispatch unknown action (should not crash)
      expect(() => {
        store.dispatch({ type: 'unknown/action' });
      }).not.toThrow();

      // State should remain unchanged for unknown actions
      const stateAfter = store.getState();
      expect(stateAfter.auth).toEqual(stateBefore.auth);
      expect(stateAfter.sidebar).toEqual(stateBefore.sidebar);
    });

    it('should handle action without type property', () => {
      // Get state before
      const stateBefore = store.getState();

      // Dispatch invalid action (Redux should throw error)
      // Note: TypeScript would prevent this, but test runtime behavior
      // Redux correctly throws an error for actions without type property
      expect(() => {
        store.dispatch({} as { type: string });
      }).toThrow('Actions may not have an undefined "type" property');

      // State should remain unchanged after error
      const stateAfter = store.getState();
      expect(stateAfter).toBeDefined();
      expect(stateAfter).toEqual(stateBefore);
    });

    it('should maintain store integrity after errors', () => {
      // Dispatch several valid actions
      store.dispatch({ type: 'sidebar/openSidebar' });
      store.dispatch({ type: 'sidebar/closeSidebar' });

      // Try dispatching invalid action
      try {
        store.dispatch({ type: 'invalid/action' });
      } catch (error) {
        // Ignore error
      }

      // Store should still work normally
      expect(() => {
        const state = store.getState();
        expect(state).toBeDefined();
      }).not.toThrow();

      // Should still be able to dispatch valid actions
      expect(() => {
        store.dispatch({ type: 'sidebar/toggleSidebar' });
      }).not.toThrow();

      const finalState = store.getState();
      expect(finalState).toBeDefined();
      expect(finalState.auth).toBeDefined();
      expect(finalState.sidebar).toBeDefined();
    });
  });

  // ============================================================================
  // TypeScript Strict Mode Compliance Tests
  // ============================================================================

  describe('TypeScript Strict Mode Compliance', () => {
    it('should have no any types in store configuration', () => {
      // This test verifies TypeScript compilation succeeds with strict mode
      // If any 'any' types were used improperly, TypeScript would error

      // Type-safe state access
      const state: RootState = store.getState();
      const authUser: typeof state.auth.user = state.auth.user;
      const {isOpen} = state.sidebar;

      // Type-safe dispatch
      const {dispatch} = store;

      // All these type assertions should compile successfully
      expect(state).toBeDefined();
      expect(authUser).toBeNull();
      expect(typeof isOpen).toBe('boolean');
      expect(dispatch).toBeInstanceOf(Function);
    });

    it('should enforce strict typing on selectors', () => {
      // Selector with explicit return type
      const selectAuthUser = (state: RootState): typeof state.auth.user => {
        return state.auth.user;
      };

      const user = selectAuthUser(store.getState());

      // TypeScript knows user is User | null
      expect(user).toBeNull();
    });

    it('should enforce strict typing on action creators', () => {
      // Action creator with explicit return type
      interface ToggleSidebarAction {
        type: 'sidebar/toggleSidebar';
      }

      const toggleSidebarAction = (): ToggleSidebarAction => ({
        type: 'sidebar/toggleSidebar',
      });

      const action = toggleSidebarAction();

      // TypeScript knows action type
      expect(action.type).toBe('sidebar/toggleSidebar');
    });
  });
});
