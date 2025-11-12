/**
 * Application Providers
 *
 * Wraps the application with all necessary context providers including
 * Redux store, React Query client, MUI theme, and other global providers.
 *
 * @module app/providers
 */

import React from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { store } from './store';
import theme from '@/styles/theme';

// ============================================================================
// React Query Configuration
// ============================================================================

/**
 * React Query Client
 *
 * Configured with default options for:
 * - Caching strategy
 * - Retry behavior
 * - Stale time
 * - Error handling
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// ============================================================================
// Providers Component
// ============================================================================

export interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Application Providers
 *
 * Wraps children with all necessary providers in the correct order:
 * 1. Redux Provider - Global state management
 * 2. React Query Provider - Server state management
 * 3. MUI Theme Provider - Material-UI theming
 * 4. CssBaseline - Normalize CSS across browsers
 *
 * Usage:
 * ```tsx
 * <Providers>
 *   <App />
 * </Providers>
 * ```
 */
export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
};

export default Providers;
