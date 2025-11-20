/**
 * Custom React Testing Library Utilities
 *
 * This module provides a custom render function and test utilities that wrap
 * components with all necessary providers (Redux, React Query, Material-UI, Router)
 * for isolated and consistent component testing.
 *
 * Features:
 * - Pre-configured Redux store with customizable initial state
 * - React Query client with test-optimized settings
 * - Material-UI theme provider for styled component testing
 * - React Router memory router for navigation testing
 * - Type-safe test utilities with full TypeScript support
 *
 * Benefits:
 * - Eliminates boilerplate provider setup in every test file
 * - Ensures consistent test environment across all component tests
 * - Enables isolated testing with mocked state and APIs
 * - Provides type-safe access to store and query client for assertions
 *
 * Usage Example:
 * ```typescript
 * import { renderWithProviders, screen, waitFor } from '@/tests/mocks/utils/test-utils';
 * import { CourseCard } from '@/features/courses/components/CourseCard';
 *
 * test('renders course card with authenticated user', async () => {
 *   const { getByText, store } = renderWithProviders(
 *     <CourseCard courseId={1} />,
 *     {
 *       preloadedState: {
 *         auth: {
 *           user: { id: 1, username: 'testuser', firstname: 'Test', lastname: 'User' },
 *           isAuthenticated: true,
 *           tokens: { accessToken: 'mock-token', refreshToken: 'mock-refresh' },
 *           isLoading: false,
 *           error: null,
 *           status: 'authenticated',
 *         },
 *       },
 *       initialRoutes: ['/courses/1'],
 *     }
 *   );
 *
 *   await waitFor(() => {
 *     expect(getByText('Course Title')).toBeInTheDocument();
 *   });
 *
 *   // Access store for assertions
 *   expect(store.getState().auth.isAuthenticated).toBe(true);
 * });
 * ```
 *
 * @module tests/mocks/utils/test-utils
 */

import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import type { PreloadedState } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import type { AppDispatch } from '@/app/store';
import { authReducer } from '@/features/auth/store/authSlice';
import { sidebarReducer } from '@/app/slices/sidebarSlice';
import theme from '@/styles/theme';

// Re-export everything from React Testing Library for convenience
export * from '@testing-library/react';

// ============================================================================
// Redux Store Setup for Tests
// ============================================================================

/**
 * Root state type for test store
 *
 * Represents the complete Redux state tree structure for testing.
 * Matches the production store structure to ensure test accuracy.
 *
 * State Structure:
 * - auth: Authentication state (user, tokens, status)
 * - sidebar: Sidebar navigation state (open/closed)
 *
 * Usage:
 * ```typescript
 * const preloadedState: Partial<RootState> = {
 *   auth: {
 *     user: mockUser,
 *     isAuthenticated: true,
 *     // ... other auth properties
 *   }
 * };
 * ```
 */
export interface RootState {
  auth: ReturnType<typeof authReducer>;
  sidebar: ReturnType<typeof sidebarReducer>;
}

/**
 * Test store type
 *
 * Type definition for the Redux store instance created by setupStore().
 * Provides type-safe access to store methods (dispatch, getState, subscribe).
 */
export type AppStore = ReturnType<typeof setupStore>;

/**
 * Configure Redux store for testing
 *
 * Creates a new Redux store instance with optional preloaded state for each test.
 * This ensures test isolation by providing a fresh store instance per test.
 *
 * Features:
 * - Accepts optional preloadedState to initialize specific state scenarios
 * - Uses same reducer configuration as production store
 * - Includes Redux Thunk middleware for async actions
 * - Enables Redux DevTools in test environment for debugging
 *
 * Benefits:
 * - Test Isolation: Each test gets a fresh store instance
 * - State Customization: Tests can provide specific initial state
 * - Production Parity: Uses same reducers as production store
 * - Type Safety: Full TypeScript inference for state and actions
 *
 * @param preloadedState - Optional initial state for the store
 * @returns Configured Redux store instance
 *
 * @example
 * ```typescript
 * const store = setupStore({
 *   auth: {
 *     user: { id: 1, username: 'testuser' },
 *     isAuthenticated: true,
 *   }
 * });
 *
 * // Use store in test
 * const state = store.getState();
 * expect(state.auth.user?.username).toBe('testuser');
 * ```
 */
export function setupStore(preloadedState?: PreloadedState<RootState>) {
  // Create store without preloadedState if not provided
  if (preloadedState === undefined) {
    return configureStore({
      reducer: {
        auth: authReducer,
        sidebar: sidebarReducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: false,
          immutableCheck: true,
        }),
    });
  }
  
  // Create store with preloadedState - use type assertion to satisfy strict mode
  return configureStore({
    reducer: {
      auth: authReducer,
      sidebar: sidebarReducer,
    },
    preloadedState: preloadedState as {
      auth: ReturnType<typeof authReducer>;
      sidebar: ReturnType<typeof sidebarReducer>;
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: true,
      }),
  });
}

// ============================================================================
// React Query Client Setup for Tests
// ============================================================================

/**
 * Test-optimized React Query client
 *
 * Configured QueryClient instance with settings optimized for testing:
 * - Disabled retry logic to fail fast in tests
 * - Zero cache time for predictable test behavior
 * - Disabled automatic refetching to prevent race conditions
 * - Suppressed error logging to reduce test output noise
 *
 * Query Configuration:
 * - retry: false (no automatic retries on failure)
 * - cacheTime: 0 (immediate cache garbage collection)
 * - staleTime: 0 (data immediately stale after fetch)
 * - refetchOnWindowFocus: false (no refetch on window focus)
 * - refetchOnReconnect: false (no refetch on network reconnect)
 * - refetchOnMount: false (no refetch when component mounts)
 *
 * Mutation Configuration:
 * - retry: false (no automatic retries on failure)
 *
 * Logger Configuration:
 * - Silent logger to prevent console output in tests
 *
 * Usage:
 * This client is automatically provided by renderWithProviders().
 * You can also access it directly for manual cache manipulation:
 *
 * @example
 * ```typescript
 * import { testQueryClient } from '@/tests/mocks/utils/test-utils';
 *
 * // Clear all queries before a test
 * beforeEach(() => {
 *   testQueryClient.clear();
 * });
 *
 * // Set query data manually
 * testQueryClient.setQueryData(['courses', 1], mockCourse);
 *
 * // Verify query state
 * const queryState = testQueryClient.getQueryState(['courses', 1]);
 * expect(queryState?.status).toBe('success');
 * ```
 */
export const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable retry to fail fast in tests
      retry: false,
      // Set cache time to 0 for predictable behavior
      gcTime: 0, // Formerly cacheTime in v4, now gcTime in v5
      // Data is immediately stale
      staleTime: 0,
      // Disable automatic refetching
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    },
    mutations: {
      // Disable retry for mutations
      retry: false,
    },
  },
  // Suppress error logging in tests
  logger: {
    log: () => {},
    warn: () => {},
    error: () => {},
  },
});

// ============================================================================
// All Providers Wrapper Component
// ============================================================================

/**
 * Props for AllTheProviders wrapper component
 *
 * Configuration options for the test provider wrapper:
 * - children: React elements to render within providers
 * - preloadedState: Initial Redux state for the test
 * - initialRoutes: Initial route entries for React Router
 */
interface AllTheProvidersProps {
  children: ReactNode;
  preloadedState?: PreloadedState<RootState>;
  initialRoutes?: string[];
}

/**
 * All Providers Wrapper Component
 *
 * Combines all necessary context providers into a single wrapper component
 * for consistent test environment setup. This ensures components have access
 * to all required contexts (Redux, React Query, Theme, Router).
 *
 * Provider Hierarchy (outer to inner):
 * 1. Redux Provider - Provides Redux store to all components
 * 2. React Query Provider - Provides React Query client for data fetching
 * 3. Material-UI Theme Provider - Provides theme for styled components
 * 4. React Router Memory Router - Provides routing context for navigation
 *
 * Features:
 * - Redux store with optional preloaded state
 * - React Query client with test-optimized settings
 * - Material-UI theme matching production environment
 * - Memory router with configurable initial routes
 *
 * @param props - Component props including children, preloadedState, initialRoutes
 * @returns JSX element with all providers properly nested
 *
 * @example
 * ```typescript
 * <AllTheProviders
 *   preloadedState={{ auth: { isAuthenticated: true } }}
 *   initialRoutes={['/dashboard']}
 * >
 *   <MyComponent />
 * </AllTheProviders>
 * ```
 */
function _AllTheProviders({ children, preloadedState, initialRoutes = ['/'] }: AllTheProvidersProps) {
  // Create a new store instance for this test with optional preloaded state
  const store = setupStore(preloadedState);

  return (
    <Provider store={store}>
      <QueryClientProvider client={testQueryClient}>
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={initialRoutes}>
            {children}
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  );
}

// ============================================================================
// Custom Render Function
// ============================================================================

/**
 * Extended render options for renderWithProviders
 *
 * Extends React Testing Library's RenderOptions with test-specific options:
 * - preloadedState: Initial Redux state for the test store
 * - initialRoutes: Initial route entries for React Router memory router
 *
 * All standard RenderOptions properties are also available:
 * - container, baseElement, hydrate, wrapper, queries, etc.
 */
export interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Initial Redux state for the test
   *
   * Allows tests to set up specific state scenarios:
   * - Authenticated vs unauthenticated user
   * - Specific user roles and capabilities
   * - UI state (sidebar open/closed, theme mode)
   *
   * @example
   * ```typescript
   * preloadedState: {
   *   auth: {
   *     user: { id: 1, username: 'teacher' },
   *     isAuthenticated: true,
   *   },
   *   sidebar: {
   *     isOpen: false,
   *   }
   * }
   * ```
   */
  preloadedState?: PreloadedState<RootState>;

  /**
   * Initial route entries for React Router
   *
   * Simulates navigation to specific routes before rendering:
   * - Single route: ['/courses/5']
   * - Multiple routes for back/forward navigation: ['/courses', '/courses/5']
   * - Routes with query params: ['/search?q=math']
   * - Routes with hash: ['/courses/5#section-2']
   *
   * @default ['/']
   *
   * @example
   * ```typescript
   * initialRoutes: ['/courses/5']
   * ```
   */
  initialRoutes?: string[];
}

/**
 * Custom render function with all providers
 *
 * Wraps React Testing Library's render() with all necessary providers for
 * isolated component testing. This is the primary render function to use
 * in all component tests.
 *
 * Providers Included:
 * - Redux Provider with configurable store and initial state
 * - React Query Provider with test-optimized client
 * - Material-UI Theme Provider with production theme
 * - React Router Memory Router with configurable routes
 *
 * Return Value:
 * - All standard React Testing Library queries (getBy*, queryBy*, findBy*)
 * - store: Redux store instance for state assertions
 * - queryClient: React Query client for cache assertions
 *
 * Features:
 * - Type-safe rendering with full TypeScript support
 * - Fresh provider instances per test for isolation
 * - Configurable initial state and routes
 * - Access to store and query client for assertions
 *
 * @param ui - React element to render
 * @param options - Extended render options including preloadedState and initialRoutes
 * @returns Render result with queries, store, and queryClient
 *
 * @example
 * ```typescript
 * // Basic rendering with default state
 * const { getByText } = renderWithProviders(<MyComponent />);
 * expect(getByText('Hello')).toBeInTheDocument();
 *
 * // With custom Redux state
 * const { getByText, store } = renderWithProviders(
 *   <MyComponent />,
 *   {
 *     preloadedState: {
 *       auth: {
 *         user: { id: 1, username: 'testuser' },
 *         isAuthenticated: true,
 *       }
 *     }
 *   }
 * );
 * expect(store.getState().auth.isAuthenticated).toBe(true);
 *
 * // With custom route
 * const { getByText } = renderWithProviders(
 *   <CourseDetail />,
 *   {
 *     initialRoutes: ['/courses/5']
 *   }
 * );
 *
 * // With both custom state and routes
 * const { getByText, store, queryClient } = renderWithProviders(
 *   <Dashboard />,
 *   {
 *     preloadedState: {
 *       auth: {
 *         user: mockUser,
 *         isAuthenticated: true,
 *       }
 *     },
 *     initialRoutes: ['/dashboard']
 *   }
 * );
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState,
    initialRoutes = ['/'],
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  // Create store for this test
  const store = setupStore(preloadedState);

  // Create wrapper with all providers
  function Wrapper({ children }: { children: ReactNode }): JSX.Element {
    return (
      <Provider store={store}>
        <QueryClientProvider client={testQueryClient}>
          <ThemeProvider theme={theme}>
            <MemoryRouter initialEntries={initialRoutes}>
              {children}
            </MemoryRouter>
          </ThemeProvider>
        </QueryClientProvider>
      </Provider>
    );
  }

  // Render with wrapper and return result plus store and queryClient
  const renderResult = render(ui, { wrapper: Wrapper, ...renderOptions });

  return {
    ...renderResult,
    store,
    queryClient: testQueryClient,
  };
}

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Export AppDispatch type for test usage
 *
 * Enables type-safe dispatch operations in tests:
 * - Dispatching sync actions
 * - Dispatching async thunks
 * - Type checking action payloads
 *
 * @example
 * ```typescript
 * import type { AppDispatch } from '@/tests/mocks/utils/test-utils';
 *
 * const dispatch: AppDispatch = store.dispatch;
 * await dispatch(loginThunk({ username, password }));
 * ```
 */
export type { AppDispatch };

// ============================================================================
// Usage Documentation
// ============================================================================

/**
 * Testing Best Practices
 *
 * 1. Clear Query Cache Between Tests:
 * ```typescript
 * import { testQueryClient } from '@/tests/mocks/utils/test-utils';
 *
 * beforeEach(() => {
 *   testQueryClient.clear();
 * });
 * ```
 *
 * 2. Test with Different Auth States:
 * ```typescript
 * // Authenticated user
 * renderWithProviders(<Component />, {
 *   preloadedState: {
 *     auth: {
 *       user: mockUser,
 *       isAuthenticated: true,
 *     }
 *   }
 * });
 *
 * // Unauthenticated user
 * renderWithProviders(<Component />, {
 *   preloadedState: {
 *     auth: {
 *       user: null,
 *       isAuthenticated: false,
 *     }
 *   }
 * });
 * ```
 *
 * 3. Test Navigation:
 * ```typescript
 * const { getByRole } = renderWithProviders(<Component />, {
 *   initialRoutes: ['/courses/5']
 * });
 *
 * // Simulate navigation
 * const link = getByRole('link', { name: 'Next Course' });
 * userEvent.click(link);
 * ```
 *
 * 4. Assert Redux State Changes:
 * ```typescript
 * const { store } = renderWithProviders(<LoginForm />);
 *
 * // Trigger login action
 * userEvent.click(submitButton);
 *
 * // Wait for state update
 * await waitFor(() => {
 *   expect(store.getState().auth.isAuthenticated).toBe(true);
 * });
 * ```
 *
 * 5. Assert Query Cache State:
 * ```typescript
 * const { queryClient } = renderWithProviders(<CourseList />);
 *
 * // Wait for data to load
 * await waitFor(() => {
 *   const queryState = queryClient.getQueryState(['courses']);
 *   expect(queryState?.status).toBe('success');
 * });
 *
 * // Verify cached data
 * const cachedData = queryClient.getQueryData(['courses']);
 * expect(cachedData).toHaveLength(5);
 * ```
 *
 * 6. Test Material-UI Theme:
 * ```typescript
 * import { useTheme } from '@mui/material/styles';
 *
 * const { getByRole } = renderWithProviders(<ThemedButton />);
 * const button = getByRole('button');
 *
 * // Theme values are applied via ThemeProvider
 * expect(button).toHaveStyle({ backgroundColor: theme.palette.primary.main });
 * ```
 *
 * 7. Clean Up After Tests:
 * ```typescript
 * afterEach(() => {
 *   // Clear all mocks
 *   vi.clearAllMocks();
 *   // Clear query cache
 *   testQueryClient.clear();
 * });
 * ```
 */
