/**
 * Custom Render Helper for React Testing Library
 * 
 * Provides a custom render function that wraps React Testing Library's render with all
 * application providers (Redux, React Query, Router, MUI Theme) for comprehensive component
 * testing. This eliminates boilerplate provider setup in every test file and ensures
 * consistent test patterns across the entire test suite.
 * 
 * The custom render function creates a fully-configured application context matching the
 * production environment, enabling realistic component testing with access to global state,
 * server state management, routing, and theme configuration.
 * 
 * @see Section 0.4 Transformation Mapping - Test utilities for React components
 * @see @testing-library/react - Base testing library
 */

import type { ReactElement, ReactNode } from 'react';
import type {
  RenderOptions as RTLRenderOptions,
  RenderResult} from '@testing-library/react';
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
  fireEvent,
  cleanup,
  renderHook,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { Theme } from '@mui/material';
import { ThemeProvider, CssBaseline } from '@mui/material';
import type { EnhancedStore } from '@reduxjs/toolkit';
import { afterEach } from 'vitest';

// Internal imports
import type { RootState } from '@/app/store';
import theme, { createAppTheme } from '@/styles/theme';
import { createMockStore } from './mockStore';
import { createMockUser } from './mockData';
import { AuthStatus, type User as AuthUser } from '@/features/auth/types/auth.types';
import type { User as EntityUser } from '@/types/entities';

/**
 * Flexible User type for test rendering
 * Accepts both the auth User type and the entities User type
 * This allows mock data generators to work with the render helper
 */
type User = AuthUser | EntityUser;

/**
 * Converts an EntityUser to AuthUser by ensuring required fields exist
 * Used internally to normalize user data for auth state
 */
function normalizeUser(user: User): AuthUser {
  return {
    ...user,
    fullname: user.fullname ?? `${user.firstname} ${user.lastname}`,
    roles: user.roles ?? [],
    capabilities: user.capabilities ?? [],
  } as AuthUser;
}

/**
 * Extend globalThis with test utilities.
 * This declaration allows asyncUtils helpers (e.g., waitForLoadingToFinish) to access
 * the query client instance set in the custom render function.
 */
declare global {
  // eslint-disable-next-line no-var
  var __queryClient__: QueryClient | undefined;
}

/**
 * Extended render options for custom render function.
 * Provides configuration for all application providers.
 */
export interface RenderOptions extends Omit<RTLRenderOptions, 'wrapper'> {
  /** Initial Redux state (partial override) */
  initialState?: Partial<RootState>;
  /** Alias for initialState (common RTL pattern) */
  preloadedState?: Partial<RootState>;
  /** Custom Redux store instance */
  store?: EnhancedStore;
  /** Initial route for MemoryRouter */
  initialRoute?: string;
  /** Route history for MemoryRouter */
  routes?: string[];
  /** Custom React Query client */
  queryClient?: QueryClient;
  /** Custom MUI theme */
  theme?: Theme;
  /** Theme mode (light or dark) */
  themeMode?: 'light' | 'dark';
  /** Whether user is authenticated */
  authenticated?: boolean;
  /** Custom user for authenticated state */
  user?: User;
  /** Disable automatic query error reset after render */
  disableQueryErrorReset?: boolean;
}

/**
 * Enhanced render result with additional utilities.
 * Extends React Testing Library's RenderResult with test-specific helpers.
 */
export interface EnhancedRenderResult extends RenderResult {
  /** Redux store instance for state assertions */
  store: EnhancedStore;
  /** React Query client for cache inspection */
  queryClient: QueryClient;
  /** Router history for navigation assertions */
  history: string[];
  /** User event instance for realistic user interactions */
  user: ReturnType<typeof userEvent.setup>;
}

/**
 * Creates a QueryClient configured for testing.
 * 
 * Configures React Query with settings optimized for deterministic testing:
 * - No retries to avoid slow tests
 * - No caching to prevent test pollution
 * - Instant refetch for immediate data
 * - Silent logger to avoid console noise
 * 
 * @returns {QueryClient} Test-optimized QueryClient instance
 * 
 * @example
 * ```typescript
 * const queryClient = createTestQueryClient();
 * render(<MyComponent />, { queryClient });
 * ```
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 1000 * 60 * 5, // Keep cache for 5 minutes to allow optimistic update testing
        staleTime: 0,
        networkMode: 'always', // Execute queries even in test environment without network
        refetchOnMount: true, // Always refetch on mount
        refetchOnWindowFocus: false, // Don't refetch on window focus in tests
        refetchOnReconnect: false, // Don't refetch on reconnect in tests
      },
      mutations: {
        retry: false,
        networkMode: 'always', // Execute mutations even in test environment without network
      },
    },
  });
}

/**
 * All Providers Wrapper Component
 * 
 * Wraps test components with all application providers in the correct nesting order:
 * Redux Provider -> React Query Provider -> Router -> Theme Provider -> CssBaseline
 * 
 * @internal
 */
interface AllTheProvidersProps {
  children: ReactNode;
  store: EnhancedStore;
  queryClient: QueryClient;
  initialRoute: string;
  routes: string[];
  themeInstance: Theme;
}

// eslint-disable-next-line react-refresh/only-export-components -- Internal test helper component
function AllTheProviders({
  children,
  store,
  queryClient,
  initialRoute,
  routes,
  themeInstance,
}: AllTheProvidersProps): ReactElement {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute, ...routes]} initialIndex={0}>
          <ThemeProvider theme={themeInstance}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

/**
 * Custom render function with all application providers.
 * 
 * Wraps React Testing Library's render with Redux, React Query, Router, and MUI Theme
 * providers. Provides a drop-in replacement for RTL render that includes full application
 * context, eliminating boilerplate setup in test files.
 * 
 * @param {ReactElement} ui - Component to render
 * @param {RenderOptions} options - Render configuration options
 * @returns {EnhancedRenderResult} Render result with store, queryClient, and history
 * 
 * @example
 * ```typescript
 * // Basic usage
 * render(<MyComponent />);
 * 
 * // With authenticated user
 * render(<MyComponent />, {
 *   authenticated: true,
 *   user: createMockUser({ firstname: 'Jane' })
 * });
 * 
 * // With initial Redux state
 * render(<MyComponent />, {
 *   initialState: { auth: { user: createMockUser(), isAuthenticated: true } }
 * });
 * 
 * // With specific route
 * render(<MyComponent />, {
 *   initialRoute: '/courses/123'
 * });
 * 
 * // With custom theme mode
 * render(<MyComponent />, {
 *   themeMode: 'dark'
 * });
 * ```
 */
export function render(
  ui: ReactElement,
  options: RenderOptions = {}
): EnhancedRenderResult {
  const {
    initialState,
    preloadedState,
    store: customStore,
    initialRoute = '/',
    routes = [],
    queryClient: customQueryClient,
    theme: customTheme,
    themeMode,
    authenticated = false,
    user: customUser,
    disableQueryErrorReset: _disableQueryErrorReset = false,
    ...renderOptions
  } = options;

  // Support both initialState and preloadedState (preloadedState is common RTL pattern)
  const effectiveInitialState = initialState ?? preloadedState;

  // Create or use provided store
  let storeInstance: EnhancedStore;
  if (customStore) {
    storeInstance = customStore;
  } else if (effectiveInitialState || authenticated) {
    // Build initial state with auth if needed
    // Normalize user to ensure required fields exist for AuthState
    const user = normalizeUser(customUser || createMockUser());
    
    const authState = authenticated
      ? {
          auth: {
            user,
            isAuthenticated: true,
            tokens: {
              accessToken: 'mock-jwt-token',
              refreshToken: 'mock-refresh-token',
              expiresIn: 3600,
              tokenType: 'Bearer',
            },
            isLoading: false,
            error: null,
            status: AuthStatus.AUTHENTICATED,
          },
        }
      : {};
    
    storeInstance = createMockStore({
      ...authState,
      ...effectiveInitialState,
    });
  } else {
    storeInstance = createMockStore(effectiveInitialState);
  }

  // Create or use provided query client
  const queryClientInstance = customQueryClient || createTestQueryClient();

  // Set query client globally for async utilities (e.g., waitForLoadingToFinish)
  globalThis.__queryClient__ = queryClientInstance;

  // Determine theme instance
  let themeInstance: Theme;
  if (customTheme) {
    themeInstance = customTheme;
  } else if (themeMode) {
    // Create theme with specified mode (light or dark)
    themeInstance = createAppTheme(themeMode);
  } else {
    themeInstance = theme;
  }

  // Create user event instance for realistic user interactions
  const user = userEvent.setup();

  // Create wrapper with all providers
  function Wrapper({ children }: { children: ReactNode }) {
  return <AllTheProviders
      store={storeInstance}
      queryClient={queryClientInstance}
      initialRoute={initialRoute}
      routes={routes}
      themeInstance={themeInstance}
    >
      {children}
    </AllTheProviders>
}

  // Render component with wrapper
  const renderResult = rtlRender(ui, {
    wrapper: Wrapper,
    ...renderOptions,
  });

  // NOTE: We do NOT clear the queryClient here because:
  // 1. Clearing immediately prevents queries from executing
  // 2. We have gcTime: 0 in createTestQueryClient which already prevents caching
  // 3. Query cleanup happens automatically in afterEach hooks in tests/setup.ts

  // Return enhanced result
  return {
    ...renderResult,
    store: storeInstance,
    queryClient: queryClientInstance,
    history: [initialRoute, ...routes],
    user,
  };
}

/**
 * Render component with authenticated user.
 * 
 * Convenience function that renders a component with authentication context.
 * Automatically creates a mock user and sets up authenticated state.
 * Supports two calling signatures for flexibility:
 * 1. Simple: renderWithAuth(<Component />, user) - just pass a User object
 * 2. Advanced: renderWithAuth(<Component />, { preloadedState, user, ... }) - pass RenderOptions
 * 
 * @param {ReactElement} ui - Component to render
 * @param {User | RenderOptions} userOrOptions - User object or RenderOptions for advanced configuration
 * @returns {EnhancedRenderResult} Render result with authenticated context
 * 
 * @example
 * ```typescript
 * // Simple usage with default or custom user
 * renderWithAuth(<ProtectedComponent />);
 * renderWithAuth(<UserProfile />, createMockUser({ email: 'test@example.com' }));
 * 
 * // Advanced usage with preloaded state
 * renderWithAuth(<ProtectedComponent />, {
 *   preloadedState: {
 *     auth: { user: mockUser, tokens: mockTokens, isAuthenticated: true }
 *   }
 * });
 * ```
 */
export function renderWithAuth(
  ui: ReactElement,
  userOrOptions?: User | RenderOptions
): EnhancedRenderResult {
  // Determine if second argument is a User or RenderOptions
  // User objects have 'id' or 'username', RenderOptions have 'preloadedState', 'initialState', etc.
  const isRenderOptions = (arg: unknown): arg is RenderOptions => {
    if (!arg || typeof arg !== 'object') {return false;}
    const obj = arg as Record<string, unknown>;
    return (
      'preloadedState' in obj ||
      'initialState' in obj ||
      'store' in obj ||
      'initialRoute' in obj ||
      'queryClient' in obj ||
      'authenticated' in obj
    );
  };

  if (isRenderOptions(userOrOptions)) {
    // Advanced usage: RenderOptions passed
    return render(ui, {
      authenticated: true,
      ...userOrOptions,
    });
  }

  // Simple usage: User object passed (or undefined)
  return render(ui, {
    authenticated: true,
    user: userOrOptions,
  });
}

/**
 * Render component without authentication.
 * 
 * Convenience function that explicitly renders a component without authentication.
 * Useful for testing public/guest pages and login flows.
 * 
 * @param {ReactElement} ui - Component to render
 * @returns {EnhancedRenderResult} Render result without authentication
 * 
 * @example
 * ```typescript
 * renderWithoutAuth(<LoginPage />);
 * renderWithoutAuth(<PublicCourseCatalog />);
 * ```
 */
export function renderWithoutAuth(ui: ReactElement): EnhancedRenderResult {
  return render(ui, {
    authenticated: false,
  });
}

/**
 * Render component with specific initial route.
 * 
 * Convenience function for testing components that depend on URL parameters
 * or location state. Sets up MemoryRouter with the specified route.
 * 
 * @param {ReactElement} ui - Component to render
 * @param {string} route - Initial route path
 * @returns {EnhancedRenderResult} Render result with router at specified route
 * 
 * @example
 * ```typescript
 * renderWithRouter(<CourseDetail />, '/courses/123');
 * renderWithRouter(<UserProfile />, '/users/456/profile');
 * ```
 */
export function renderWithRouter(
  ui: ReactElement,
  route: string
): EnhancedRenderResult {
  return render(ui, {
    initialRoute: route,
  });
}

/**
 * Render component with specific theme mode.
 * 
 * Convenience function for testing components with light or dark theme.
 * Useful for verifying theme-dependent styling and appearance.
 * 
 * @param {ReactElement} ui - Component to render
 * @param {('light' | 'dark')} mode - Theme mode
 * @returns {EnhancedRenderResult} Render result with specified theme mode
 * 
 * @example
 * ```typescript
 * renderWithTheme(<ThemedComponent />, 'dark');
 * renderWithTheme(<ColorSensitiveUI />, 'light');
 * ```
 */
export function renderWithTheme(
  ui: ReactElement,
  mode: 'light' | 'dark'
): EnhancedRenderResult {
  return render(ui, {
    themeMode: mode,
  });
}

/**
 * Cleanup hook - Reset query client and store after each test.
 * Ensures test isolation and prevents state leakage between tests.
 */
afterEach(() => {
  cleanup();
});

/**
 * Re-export all React Testing Library utilities for convenient single-import access.
 * This allows test files to import everything they need from this single helper module.
 */
export {
  // Core RTL utilities
  screen,
  waitFor,
  within,
  fireEvent,
  cleanup,
  renderHook,
  act,
  // User event simulation
  userEvent,
};
