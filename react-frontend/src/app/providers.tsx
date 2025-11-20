/**
 * Application Providers Wrapper
 *
 * Composes all necessary context providers in the correct nesting order for the
 * entire React application. This ensures proper provider composition to avoid
 * context access issues and enables all components to access shared application
 * infrastructure including state management, API caching, theming, and authentication.
 *
 * Provider Nesting Order (Outermost to Innermost):
 * 1. Redux Provider (outermost) - Global state management for auth, user, theme
 * 2. React Query QueryClientProvider - Server state caching and synchronization
 * 3. MUI ThemeProvider - Consistent Material-UI styling and theming
 * 4. MUI CssBaseline - CSS reset for cross-browser consistency
 * 5. ReactQueryDevtools - Development tools for debugging queries (dev only)
 * 6. Children components (innermost) - Application content
 *
 * Critical Implementation Notes:
 * - Provider order matters: Redux outermost allows all components to access store
 * - React Query next enables data fetching hooks throughout the component tree
 * - MUI theme available to all components via useTheme hook
 * - CssBaseline normalizes browser default styles before component rendering
 * - ReactQueryDevtools excluded from production builds automatically
 *
 * Enables Child Components to Use:
 * - useAppSelector/useAppDispatch hooks for Redux global state
 * - useQuery/useMutation hooks for React Query server state
 * - useTheme hook for Material-UI theme access
 * - All MUI components with consistent theming
 *
 * @module app/providers
 */

import type React from 'react';
import { type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { store } from './store';
import theme from '../styles/theme';

// ============================================================================
// React Query Configuration
// ============================================================================

/**
 * React Query Client Instance
 *
 * Configured with default options for all queries and mutations in the application.
 * These settings balance data freshness with performance by caching responses while
 * preventing excessive network requests.
 *
 * Query Configuration:
 * - staleTime: 5 minutes - Data considered fresh for 5 minutes, no refetch during this time
 * - cacheTime: 10 minutes - Cached data kept in memory for 10 minutes after last use
 * - refetchOnWindowFocus: false - Prevents refetch when user returns to browser tab
 * - retry: 1 - Only retry failed requests once to avoid hammering failing endpoints
 *
 * Mutation Configuration:
 * - retry: 1 - Retry failed mutations once before showing error to user
 *
 * Performance Implications:
 * - 5-minute stale time reduces network requests for frequently accessed data
 * - Single retry prevents long waits on persistent failures
 * - Disabled window focus refetch avoids unnecessary requests during tab switching
 *
 * These settings can be overridden per-query using useQuery/useMutation options.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime in v4)
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});

// ============================================================================
// Providers Component
// ============================================================================

/**
 * AppProviders Props Interface
 *
 * Defines the props accepted by the AppProviders component.
 *
 * @property children - React node(s) to be wrapped with all application providers
 */
export interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Application Providers Wrapper Component
 *
 * Wraps the application with all necessary context providers in the correct nesting
 * order. This component ensures that all child components have access to Redux global
 * state, React Query server state management, and Material-UI theming.
 *
 * Provider Responsibilities:
 *
 * 1. Redux Provider (Layer 1 - Outermost):
 *    - Makes Redux store available to all nested components
 *    - Enables useAppSelector for reading global state
 *    - Enables useAppDispatch for dispatching actions
 *    - Manages auth state, user preferences, and UI theme mode
 *
 * 2. React Query QueryClientProvider (Layer 2):
 *    - Makes QueryClient available for data fetching hooks
 *    - Enables useQuery for GET requests with automatic caching
 *    - Enables useMutation for POST/PUT/DELETE requests
 *    - Handles background refetching, cache invalidation, optimistic updates
 *
 * 3. MUI ThemeProvider (Layer 3):
 *    - Injects Material-UI theme configuration into React context
 *    - Makes theme object available via useTheme hook
 *    - Enables consistent styling across all MUI components
 *    - Supports light/dark mode switching
 *
 * 4. MUI CssBaseline (Layer 4):
 *    - Applies CSS reset for cross-browser consistency
 *    - Normalizes box-sizing, margins, and default element styles
 *    - Ensures consistent baseline styles before component rendering
 *
 * 5. ReactQueryDevtools (Development Only):
 *    - Provides visual debugging interface for React Query cache
 *    - Shows query status, cache contents, and refetch controls
 *    - Automatically excluded from production builds
 *    - Conditionally rendered based on NODE_ENV environment variable
 *
 * Usage Example:
 * ```tsx
 * import { AppProviders } from '@/app/providers';
 * import { App } from '@/App';
 *
 * ReactDOM.createRoot(document.getElementById('root')!).render(
 *   <React.StrictMode>
 *     <AppProviders>
 *       <App />
 *     </AppProviders>
 *   </React.StrictMode>
 * );
 * ```
 *
 * Important Notes:
 * - Provider order is critical and must not be changed
 * - Redux must be outermost to allow all components store access
 * - React Query must be inside Redux but outside MUI for proper context flow
 * - MUI theme must wrap all components that use Material-UI
 * - CssBaseline must be inside ThemeProvider to access theme variables
 *
 * @param props - Component props
 * @param props.children - Child components to wrap with providers
 * @returns React element with all providers wrapping children
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }): React.ReactElement => {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {process.env.NODE_ENV === 'development' && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  );
};

// Default export for convenient importing
export default AppProviders;
