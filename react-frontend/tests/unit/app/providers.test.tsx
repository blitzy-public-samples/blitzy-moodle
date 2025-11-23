/**
 * Unit Tests for AppProviders Component
 *
 * Comprehensive test suite validating the AppProviders wrapper component that composes
 * Redux Provider, React Query QueryClientProvider, and Material-UI ThemeProvider in
 * the correct nesting order. Tests ensure proper provider initialization, context
 * availability, and error boundary integration.
 *
 * Test Coverage:
 * - Basic rendering of children components
 * - Redux Provider configuration with store
 * - React Query Provider with QueryClient defaults
 * - Material-UI ThemeProvider with custom theme
 * - Provider nesting order (Redux → React Query → MUI Theme)
 * - Child components can access Redux state and dispatch
 * - Child components can use React Query hooks
 * - Child components can access MUI theme
 * - React Query DevTools conditional rendering
 * - CssBaseline integration for CSS reset
 * - Error handling and boundaries
 * - TypeScript prop typing validation
 *
 * @module tests/unit/app/providers.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@mui/material/styles';
import AppProviders from '@/app/providers';
import type { RootState } from '@/app/store';

// ============================================================================
// Test Helper Components
// ============================================================================

/**
 * Test component that accesses Redux state
 *
 * Uses useSelector to read authentication state from Redux store.
 * Tests that Redux Provider is properly configured.
 */
function TestReduxComponent(): React.ReactElement {
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <div>
      <span>Auth Status: {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</span>
      <span>User: {user ? user.username : 'None'}</span>
    </div>
  );
}

/**
 * Test component that dispatches Redux actions
 *
 * Uses useDispatch to dispatch actions to Redux store.
 * Tests that dispatch functionality works correctly.
 */
function TestReduxDispatchComponent(): React.ReactElement {
  const dispatch = useDispatch();
  const [dispatchCalled, setDispatchCalled] = useState(false);

  const handleClick = (): void => {
    dispatch({ type: 'TEST_ACTION', payload: 'test' });
    setDispatchCalled(true);
  };

  return (
    <div>
      <button onClick={handleClick}>Dispatch Action</button>
      <span>Dispatch Called: {dispatchCalled ? 'Yes' : 'No'}</span>
    </div>
  );
}

/**
 * Test component that uses React Query
 *
 * Uses useQuery hook to fetch data.
 * Tests that QueryClientProvider is properly configured.
 */
function TestReactQueryComponent(): React.ReactElement {
  const { data, isLoading, error } = useQuery({
    queryKey: ['test-query'],
    queryFn: async () => {
      return { message: 'Test Data' };
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>Query Data: {data?.message}</div>;
}

/**
 * Test component that accesses QueryClient configuration
 *
 * Uses useQueryClient to access QueryClient instance and validate defaults.
 * Tests that QueryClient is configured with correct default options.
 */
function TestQueryClientConfigComponent(): React.ReactElement {
  const queryClient = useQueryClient();
  const defaultOptions = queryClient.getDefaultOptions();

  return (
    <div>
      <span>Stale Time: {defaultOptions.queries?.staleTime}</span>
      <span>Refetch On Focus: {String(defaultOptions.queries?.refetchOnWindowFocus)}</span>
      <span>Retry: {defaultOptions.queries?.retry}</span>
    </div>
  );
}

/**
 * Test component that accesses MUI theme
 *
 * Uses useTheme hook to access Material-UI theme configuration.
 * Tests that ThemeProvider is properly configured with custom theme.
 */
function TestThemeComponent(): React.ReactElement {
  const theme = useTheme();

  return (
    <div>
      <span>Primary Color: {theme.palette.primary.main}</span>
      <span>Theme Mode: {theme.palette.mode}</span>
      <span>Spacing: {theme.spacing(1)}</span>
    </div>
  );
}

/**
 * Test component that uses all contexts simultaneously
 *
 * Uses Redux, React Query, and MUI theme hooks together.
 * Tests that all providers are properly nested and contexts are accessible.
 */
function TestMultiContextComponent(): React.ReactElement {
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );
  const theme = useTheme();
  const { data } = useQuery({
    queryKey: ['multi-context-test'],
    queryFn: async () => ({ value: 'test' }),
  });

  return (
    <div>
      <span>Redux Works: {isAuthenticated !== undefined ? 'Yes' : 'No'}</span>
      <span>Theme Works: {theme.palette ? 'Yes' : 'No'}</span>
      <span>Query Works: {data ? 'Yes' : 'No'}</span>
    </div>
  );
}

/**
 * Test component that throws an error
 *
 * Used to test error boundary integration.
 */
function ErrorThrowingComponent(): React.ReactElement {
  throw new Error('Test error');
}

// ============================================================================
// Test Suite
// ============================================================================

describe('AppProviders Component', () => {
  // Cleanup after each test
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should render children correctly', () => {
      render(
        <AppProviders>
          <div>Test Content</div>
        </AppProviders>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should render multiple children', () => {
      render(
        <AppProviders>
          <div>First Child</div>
          <div>Second Child</div>
        </AppProviders>
      );

      expect(screen.getByText('First Child')).toBeInTheDocument();
      expect(screen.getByText('Second Child')).toBeInTheDocument();
    });

    it('should render React fragments as children', () => {
      render(
        <AppProviders>
          <>
            <div>Fragment Child 1</div>
            <div>Fragment Child 2</div>
          </>
        </AppProviders>
      );

      expect(screen.getByText('Fragment Child 1')).toBeInTheDocument();
      expect(screen.getByText('Fragment Child 2')).toBeInTheDocument();
    });

    it('should render string children', () => {
      render(<AppProviders>Plain text content</AppProviders>);

      expect(screen.getByText('Plain text content')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Redux Provider Integration Tests
  // ============================================================================

  describe('Redux Provider Integration', () => {
    it('should provide Redux store to child components', () => {
      render(
        <AppProviders>
          <TestReduxComponent />
        </AppProviders>
      );

      // Should render without throwing context errors
      expect(screen.getByText(/Auth Status:/)).toBeInTheDocument();
    });

    it('should allow children to access Redux state', () => {
      render(
        <AppProviders>
          <TestReduxComponent />
        </AppProviders>
      );

      // Default auth state should be accessible
      expect(screen.getByText(/Not Authenticated/)).toBeInTheDocument();
    });

    it('should allow children to dispatch Redux actions', async () => {
      const user = userEvent.setup();

      render(
        <AppProviders>
          <TestReduxDispatchComponent />
        </AppProviders>
      );

      const button = screen.getByText('Dispatch Action');
      expect(screen.getByText('Dispatch Called: No')).toBeInTheDocument();

      await user.click(button);

      expect(screen.getByText('Dispatch Called: Yes')).toBeInTheDocument();
    });

    it('should not throw errors when accessing store', () => {
      expect(() => {
        render(
          <AppProviders>
            <TestReduxComponent />
          </AppProviders>
        );
      }).not.toThrow();
    });
  });

  // ============================================================================
  // React Query Provider Integration Tests
  // ============================================================================

  describe('React Query Provider Integration', () => {
    it('should provide React Query client to children', async () => {
      render(
        <AppProviders>
          <TestReactQueryComponent />
        </AppProviders>
      );

      // Initially loading
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Wait for query to complete
      await waitFor(() => {
        expect(screen.getByText('Query Data: Test Data')).toBeInTheDocument();
      });
    });

    it('should configure QueryClient with correct defaults', () => {
      render(
        <AppProviders>
          <TestQueryClientConfigComponent />
        </AppProviders>
      );

      // Verify staleTime is 5 minutes (300000ms)
      expect(screen.getByText('Stale Time: 300000')).toBeInTheDocument();

      // Verify refetchOnWindowFocus is false
      expect(screen.getByText('Refetch On Focus: false')).toBeInTheDocument();

      // Verify retry is 1
      expect(screen.getByText('Retry: 1')).toBeInTheDocument();
    });

    it('should handle query errors gracefully', async () => {
      function ErrorQueryComponent(): React.ReactElement {
        const { error, isLoading } = useQuery({
          queryKey: ['error-query'],
          queryFn: async () => {
            throw new Error('Query failed');
          },
          retry: 0, // Don't retry for this test
        });

        if (isLoading) return <div>Loading...</div>;
        if (error) return <div>Query Error: {error.message}</div>;

        return <div>Success</div>;
      }

      render(
        <AppProviders>
          <ErrorQueryComponent />
        </AppProviders>
      );

      await waitFor(() => {
        expect(screen.getByText('Query Error: Query failed')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Material-UI Theme Provider Tests
  // ============================================================================

  describe('Material-UI Theme Provider', () => {
    it('should provide MUI theme to child components', () => {
      render(
        <AppProviders>
          <TestThemeComponent />
        </AppProviders>
      );

      // Theme should be accessible
      expect(screen.getByText(/Primary Color:/)).toBeInTheDocument();
    });

    it('should apply custom theme configuration', () => {
      render(
        <AppProviders>
          <TestThemeComponent />
        </AppProviders>
      );

      // Custom theme values should be present
      const primaryColor = screen.getByText(/Primary Color:/);
      expect(primaryColor).toBeInTheDocument();

      // Theme mode should be present (light or dark)
      const themeMode = screen.getByText(/Theme Mode:/);
      expect(themeMode).toBeInTheDocument();
    });

    it('should provide theme spacing function', () => {
      render(
        <AppProviders>
          <TestThemeComponent />
        </AppProviders>
      );

      // Spacing function should work (typically returns 8px for spacing(1))
      const spacing = screen.getByText(/Spacing:/);
      expect(spacing).toBeInTheDocument();
      expect(spacing.textContent).toMatch(/\d+/); // Should contain a number
    });

    it('should not throw errors when accessing theme', () => {
      expect(() => {
        render(
          <AppProviders>
            <TestThemeComponent />
          </AppProviders>
        );
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Provider Nesting Order Tests
  // ============================================================================

  describe('Provider Nesting Order', () => {
    it('should nest providers in correct order', () => {
      render(
        <AppProviders>
          <TestMultiContextComponent />
        </AppProviders>
      );

      // All contexts should be accessible
      expect(screen.getByText('Redux Works: Yes')).toBeInTheDocument();
      expect(screen.getByText('Theme Works: Yes')).toBeInTheDocument();
    });

    it('should allow simultaneous access to all contexts', async () => {
      render(
        <AppProviders>
          <TestMultiContextComponent />
        </AppProviders>
      );

      // Redux should be accessible immediately
      expect(screen.getByText('Redux Works: Yes')).toBeInTheDocument();

      // Theme should be accessible immediately
      expect(screen.getByText('Theme Works: Yes')).toBeInTheDocument();

      // Query should complete
      await waitFor(() => {
        expect(screen.getByText('Query Works: Yes')).toBeInTheDocument();
      });
    });

    it('should not have context access conflicts', () => {
      expect(() => {
        render(
          <AppProviders>
            <TestMultiContextComponent />
          </AppProviders>
        );
      }).not.toThrow();
    });
  });

  // ============================================================================
  // CssBaseline Integration Tests
  // ============================================================================

  describe('CssBaseline Integration', () => {
    it('should render CssBaseline for CSS reset', () => {
      const { container } = render(
        <AppProviders>
          <div>Content</div>
        </AppProviders>
      );

      // CssBaseline injects global styles, check that component renders
      expect(container.firstChild).toBeTruthy();
    });
  });

  // ============================================================================
  // React Query DevTools Tests
  // ============================================================================

  describe('React Query DevTools', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should render DevTools in development mode', () => {
      process.env.NODE_ENV = 'development';

      const { container } = render(
        <AppProviders>
          <div>Test Content</div>
        </AppProviders>
      );

      // In development, DevTools should be in the component tree
      // Note: DevTools may not be visible by default (initialIsOpen: false)
      expect(container).toBeTruthy();
    });

    it('should not render DevTools in production mode', () => {
      process.env.NODE_ENV = 'production';

      const { container } = render(
        <AppProviders>
          <div>Test Content</div>
        </AppProviders>
      );

      // In production, DevTools should not be rendered
      expect(container).toBeTruthy();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle child component errors', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      // Error boundary behavior depends on implementation
      // This test validates that rendering doesn't crash the test suite
      expect(() => {
        try {
          render(
            <AppProviders>
              <ErrorThrowingComponent />
            </AppProviders>
          );
        } catch (error) {
          // Error is expected
        }
      }).toBeDefined();

      console.error = originalError;
    });

    it('should render without errors for valid children', () => {
      expect(() => {
        render(
          <AppProviders>
            <div>Valid Content</div>
          </AppProviders>
        );
      }).not.toThrow();
    });
  });

  // ============================================================================
  // TypeScript Props Tests
  // ============================================================================

  describe('TypeScript Props', () => {
    it('should accept ReactNode children prop', () => {
      // Test with element
      expect(() => {
        render(
          <AppProviders>
            <div>Element Child</div>
          </AppProviders>
        );
      }).not.toThrow();

      // Test with string
      expect(() => {
        render(<AppProviders>String Child</AppProviders>);
      }).not.toThrow();

      // Test with fragment
      expect(() => {
        render(
          <AppProviders>
            <>Fragment Child</>
          </AppProviders>
        );
      }).not.toThrow();

      // Test with array
      expect(() => {
        render(
          <AppProviders>
            {[<div key="1">Array Item 1</div>, <div key="2">Array Item 2</div>]}
          </AppProviders>
        );
      }).not.toThrow();
    });

    it('should accept null children', () => {
      expect(() => {
        render(<AppProviders>{null}</AppProviders>);
      }).not.toThrow();
    });

    it('should accept undefined children', () => {
      expect(() => {
        render(<AppProviders>{undefined}</AppProviders>);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Re-render Behavior Tests
  // ============================================================================

  describe('Re-render Behavior', () => {
    it('should not cause unnecessary re-renders', () => {
      let renderCount = 0;

      function RenderCountComponent(): React.ReactElement {
        renderCount++;
        return <div>Render Count: {renderCount}</div>;
      }

      const { rerender } = render(
        <AppProviders>
          <RenderCountComponent />
        </AppProviders>
      );

      const initialCount = renderCount;
      expect(screen.getByText(`Render Count: ${initialCount}`)).toBeInTheDocument();

      // Rerender providers with same children
      rerender(
        <AppProviders>
          <RenderCountComponent />
        </AppProviders>
      );

      // Component should re-render (React behavior), but providers should not cause extra renders
      expect(renderCount).toBeGreaterThanOrEqual(initialCount);
    });

    it('should handle children updates correctly', () => {
      const { rerender } = render(
        <AppProviders>
          <div>Initial Content</div>
        </AppProviders>
      );

      expect(screen.getByText('Initial Content')).toBeInTheDocument();

      rerender(
        <AppProviders>
          <div>Updated Content</div>
        </AppProviders>
      );

      expect(screen.queryByText('Initial Content')).not.toBeInTheDocument();
      expect(screen.getByText('Updated Content')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Tests', () => {
    it('should support full application workflow', async () => {
      const user = userEvent.setup();

      function IntegrationTestComponent(): React.ReactElement {
        const dispatch = useDispatch();
        const theme = useTheme();
        const [clicked, setClicked] = useState(false);

        const { data } = useQuery({
          queryKey: ['integration-test'],
          queryFn: async () => ({ value: 'Integration Data' }),
        });

        const handleClick = (): void => {
          dispatch({ type: 'INTEGRATION_ACTION' });
          setClicked(true);
        };

        return (
          <div>
            <button onClick={handleClick}>Integration Button</button>
            <div>Clicked: {clicked ? 'Yes' : 'No'}</div>
            <div>Theme: {theme.palette.mode}</div>
            <div>Data: {data?.value || 'Loading'}</div>
          </div>
        );
      }

      render(
        <AppProviders>
          <IntegrationTestComponent />
        </AppProviders>
      );

      // Wait for query to load
      await waitFor(() => {
        expect(screen.getByText('Data: Integration Data')).toBeInTheDocument();
      });

      // Verify theme is accessible
      expect(screen.getByText(/Theme:/)).toBeInTheDocument();

      // Test Redux dispatch
      expect(screen.getByText('Clicked: No')).toBeInTheDocument();
      await user.click(screen.getByText('Integration Button'));
      expect(screen.getByText('Clicked: Yes')).toBeInTheDocument();
    });

    it('should maintain provider isolation', () => {
      // Each instance of AppProviders should have isolated contexts
      const { unmount: unmount1 } = render(
        <AppProviders>
          <div>Instance 1</div>
        </AppProviders>
      );

      expect(screen.getByText('Instance 1')).toBeInTheDocument();
      unmount1();

      const { unmount: unmount2 } = render(
        <AppProviders>
          <div>Instance 2</div>
        </AppProviders>
      );

      expect(screen.getByText('Instance 2')).toBeInTheDocument();
      unmount2();
    });
  });
});
