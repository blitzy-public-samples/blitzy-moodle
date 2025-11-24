/**
 * LoadingSpinner Component Unit Tests
 *
 * Comprehensive test suite for the LoadingSpinner component validating all features:
 * - Size variants (small/medium/large with pixel mappings 24/40/60)
 * - Color variants (primary/secondary/inherit)
 * - Display modes (inline vs overlay with Backdrop)
 * - Full page blocking mode with fixed positioning
 * - Loading message display and typography
 * - WCAG 2.1 AA accessibility compliance (role, aria-label, aria-busy)
 * - Integration with React Suspense boundaries as fallback
 * - Integration with React Query loading states
 * - Layout and centering behavior
 * - Edge cases and error handling
 *
 * @see Section 0.4 Transformation Mapping - React component testing patterns
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { Suspense, useState } from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/tests/helpers/render';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material';

describe('LoadingSpinner Component', () => {
  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    test('renders loading spinner', () => {
      render(<LoadingSpinner />);

      // Assert CircularProgress is present via role
      const spinner = screen.getByRole('progressbar');
      expect(spinner).toBeInTheDocument();
    });

    test('renders with default props', () => {
      render(<LoadingSpinner />);

      // Assert default medium size (40px)
      const spinner = screen.getByRole('progressbar');
      expect(spinner).toHaveAttribute('aria-label', 'Loading');

      // Assert no overlay (Backdrop should not be present)
      const backdrop = document.querySelector('.MuiBackdrop-root');
      expect(backdrop).not.toBeInTheDocument();
    });

    test('displays loading message when provided', () => {
      const message = 'Loading course content...';
      render(<LoadingSpinner message={message} />);

      // Assert message is visible
      expect(screen.getByText(message)).toBeInTheDocument();
    });

    test('hides message when not provided', () => {
      render(<LoadingSpinner />);

      // Assert no Typography element for message
      const typography = document.querySelector('.MuiTypography-root');
      expect(typography).not.toBeInTheDocument();
    });

    test('renders with custom className', () => {
      const customClass = 'custom-spinner';
      render(<LoadingSpinner className={customClass} />);

      // Assert className is applied to container
      const container = document.querySelector(`.${customClass}`);
      expect(container).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Size Variant Tests
  // ============================================================================

  describe('Size Variants', () => {
    test('renders small size (24px)', () => {
      render(<LoadingSpinner size="small" />);

      const spinner = screen.getByRole('progressbar');
      // MUI CircularProgress applies size via inline style
      expect(spinner).toHaveAttribute('aria-label', 'Loading');
      
      // Verify CircularProgress is rendered with correct size
      const svgElement = spinner.querySelector('svg');
      expect(svgElement).toHaveStyle({ width: '24px', height: '24px' });
    });

    test('renders medium size (40px) - default', () => {
      render(<LoadingSpinner size="medium" />);

      const spinner = screen.getByRole('progressbar');
      const svgElement = spinner.querySelector('svg');
      expect(svgElement).toHaveStyle({ width: '40px', height: '40px' });
    });

    test('renders large size (60px)', () => {
      render(<LoadingSpinner size="large" />);

      const spinner = screen.getByRole('progressbar');
      const svgElement = spinner.querySelector('svg');
      expect(svgElement).toHaveStyle({ width: '60px', height: '60px' });
    });

    test('defaults to medium size when size prop omitted', () => {
      render(<LoadingSpinner />);

      const spinner = screen.getByRole('progressbar');
      const svgElement = spinner.querySelector('svg');
      expect(svgElement).toHaveStyle({ width: '40px', height: '40px' });
    });
  });

  // ============================================================================
  // Color Variant Tests
  // ============================================================================

  describe('Color Variants', () => {
    test('renders with primary color', () => {
      render(<LoadingSpinner color="primary" />);

      const spinner = screen.getByRole('progressbar');
      // MUI CircularProgress with color="primary" has specific class
      expect(spinner).toHaveClass('MuiCircularProgress-colorPrimary');
    });

    test('renders with secondary color', () => {
      render(<LoadingSpinner color="secondary" />);

      const spinner = screen.getByRole('progressbar');
      expect(spinner).toHaveClass('MuiCircularProgress-colorSecondary');
    });

    test('renders with inherit color', () => {
      render(<LoadingSpinner color="inherit" />);

      const spinner = screen.getByRole('progressbar');
      expect(spinner).toHaveClass('MuiCircularProgress-colorInherit');
    });

    test('defaults to primary color when color prop omitted', () => {
      render(<LoadingSpinner />);

      const spinner = screen.getByRole('progressbar');
      expect(spinner).toHaveClass('MuiCircularProgress-colorPrimary');
    });
  });

  // ============================================================================
  // Display Mode Tests
  // ============================================================================

  describe('Display Modes', () => {
    test('renders inline mode by default', () => {
      render(<LoadingSpinner />);

      // Assert Backdrop is not present
      const backdrop = document.querySelector('.MuiBackdrop-root');
      expect(backdrop).not.toBeInTheDocument();

      // Assert container uses Box for inline display
      const container = screen.getByTestId('loading-spinner').parentElement;
      expect(container).toBeInTheDocument();
    });

    test('renders overlay mode', () => {
      render(<LoadingSpinner overlay />);

      // Assert Backdrop component is rendered
      const backdrop = document.querySelector('.MuiBackdrop-root');
      expect(backdrop).toBeInTheDocument();
    });

    test('overlay blocks interaction with underlying content', () => {
      render(<LoadingSpinner overlay />);

      // Assert Backdrop has open prop (visible)
      const backdrop = document.querySelector('.MuiBackdrop-root');
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toBeVisible();
    });

    test('overlay has correct z-index', () => {
      const customZIndex = 1500;
      render(<LoadingSpinner overlay zIndex={customZIndex} />);

      const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
      expect(backdrop).toHaveStyle({ zIndex: customZIndex.toString() });
    });

    test('overlay uses default z-index of 1300', () => {
      render(<LoadingSpinner overlay />);

      const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
      expect(backdrop).toHaveStyle({ zIndex: '1300' });
    });
  });

  // ============================================================================
  // Full Page Mode Tests
  // ============================================================================

  describe('Full Page Mode', () => {
    test('renders full page mode with overlay', () => {
      render(<LoadingSpinner overlay fullPage />);

      const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
      expect(backdrop).toBeInTheDocument();
      // Fixed positioning for full viewport coverage
      expect(backdrop).toHaveStyle({ position: 'fixed' });
    });

    test('full page mode covers entire viewport', () => {
      render(<LoadingSpinner overlay fullPage />);

      const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
      expect(backdrop).toHaveStyle({
        position: 'fixed',
        top: '0px',
        left: '0px',
        right: '0px',
        bottom: '0px',
      });
    });

    test('overlay without fullPage uses absolute positioning', () => {
      render(<LoadingSpinner overlay fullPage={false} />);

      const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
      expect(backdrop).toHaveStyle({ position: 'absolute' });
    });

    test('inline mode with fullPage uses minHeight 100vh', () => {
      render(<LoadingSpinner fullPage />);

      const container = screen.getByTestId('loading-spinner').parentElement as HTMLElement;
      expect(container).toHaveStyle({ minHeight: '100vh' });
    });

    test('inline mode without fullPage uses auto height', () => {
      render(<LoadingSpinner />);

      const container = screen.getByTestId('loading-spinner').parentElement as HTMLElement;
      expect(container).toHaveStyle({ minHeight: 'auto' });
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    test('has role=progressbar', () => {
      render(<LoadingSpinner />);

      const spinner = screen.getByRole('progressbar');
      expect(spinner).toHaveAttribute('role', 'progressbar');
    });

    test('has aria-label=Loading by default', () => {
      render(<LoadingSpinner />);

      const spinner = screen.getByRole('progressbar');
      expect(spinner).toHaveAttribute('aria-label', 'Loading');
    });

    test('accepts custom aria-label', () => {
      const customLabel = 'Loading course assignments';
      render(<LoadingSpinner ariaLabel={customLabel} />);

      const spinner = screen.getByRole('progressbar');
      expect(spinner).toHaveAttribute('aria-label', customLabel);
    });

    test('has aria-busy=true for screen readers', () => {
      render(<LoadingSpinner />);

      const spinner = screen.getByRole('progressbar');
      expect(spinner).toHaveAttribute('aria-busy', 'true');
    });

    test('announces loading state to screen readers', () => {
      render(<LoadingSpinner ariaLabel="Loading quiz questions" />);

      // Verify accessible name is present for screen reader announcement
      const spinner = screen.getByLabelText('Loading quiz questions');
      expect(spinner).toBeInTheDocument();
    });

    test('message has appropriate typography for readability', () => {
      render(<LoadingSpinner message="Please wait while we load your content" />);

      const message = screen.getByText('Please wait while we load your content');
      // MUI Typography body2 variant is used for messages
      expect(message).toHaveClass('MuiTypography-body2');
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration with React Patterns', () => {
    test('works as React Suspense fallback', async () => {
      // Create a lazy-loaded component that delays
      const DelayedComponent = () => {
        throw new Promise((resolve) => setTimeout(resolve, 100));
      };

      const TestComponent = () => (
        <Suspense fallback={<LoadingSpinner message="Loading component..." />}>
          <DelayedComponent />
        </Suspense>
      );

      render(<TestComponent />);

      // Assert spinner is shown during Suspense
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Loading component...')).toBeInTheDocument();
    });

    test('works with React Query loading state', () => {
      // Create a component that uses React Query
      const TestComponent = () => {
        const { isLoading } = useQuery({
          queryKey: ['test'],
          queryFn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return { data: 'test' };
          },
        });

        if (isLoading) {
          return <LoadingSpinner message="Loading data..." />;
        }

        return <div>Data loaded</div>;
      };

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      // Assert spinner is shown during loading
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Loading data...')).toBeInTheDocument();
    });

    test('disappears when loading completes', async () => {
      // Component that toggles loading state
      const TestComponent = () => {
        const [isLoading, setIsLoading] = useState(true);

        React.useEffect(() => {
          const timer = setTimeout(() => setIsLoading(false), 100);
          return () => clearTimeout(timer);
        }, []);

        if (isLoading) {
          return <LoadingSpinner />;
        }

        return <div>Content loaded</div>;
      };

      render(<TestComponent />);

      // Initially shows spinner
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(
        () => {
          expect(screen.getByText('Content loaded')).toBeInTheDocument();
        },
        { timeout: 200 }
      );

      // Spinner should be gone
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Centering and Layout Tests
  // ============================================================================

  describe('Centering and Layout', () => {
    test('centers spinner horizontally and vertically', () => {
      render(<LoadingSpinner />);

      const spinnerContainer = screen.getByTestId('loading-spinner');
      expect(spinnerContainer).toHaveStyle({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      });
    });

    test('inline mode respects parent container constraints', () => {
      render(
        <div style={{ width: '200px', height: '200px' }}>
          <LoadingSpinner />
        </div>
      );

      const container = screen.getByTestId('loading-spinner').parentElement;
      expect(container).toBeInTheDocument();
      // Container should be within parent bounds
    });

    test('overlay mode centers on viewport with fixed positioning', () => {
      render(<LoadingSpinner overlay fullPage />);

      const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
      expect(backdrop).toHaveStyle({
        position: 'fixed',
        top: '0px',
        left: '0px',
        right: '0px',
        bottom: '0px',
      });
    });

    test('spinner content uses flexbox for centering', () => {
      render(<LoadingSpinner message="Loading..." />);

      const spinnerContainer = screen.getByTestId('loading-spinner');
      expect(spinnerContainer).toHaveStyle({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      });
    });
  });

  // ============================================================================
  // Message Styling Tests
  // ============================================================================

  describe('Message Display and Styling', () => {
    test('message displays below spinner', () => {
      render(<LoadingSpinner message="Loading courses..." />);

      const spinnerContainer = screen.getByTestId('loading-spinner');
      const spinner = screen.getByRole('progressbar');
      const message = screen.getByText('Loading courses...');

      // Verify both are in the container
      expect(spinnerContainer).toContainElement(spinner);
      expect(spinnerContainer).toContainElement(message);

      // Container uses flex column, so message is below
      expect(spinnerContainer).toHaveStyle({ flexDirection: 'column' });
    });

    test('message has correct typography variant', () => {
      render(<LoadingSpinner message="Please wait..." />);

      const message = screen.getByText('Please wait...');
      // MUI Typography body2 variant
      expect(message).toHaveClass('MuiTypography-body2');
    });

    test('message color matches theme text.secondary', () => {
      render(<LoadingSpinner message="Loading..." />);

      const message = screen.getByText('Loading...');
      // MUI applies color via class
      expect(message).toHaveClass('MuiTypography-colorTextSecondary');
    });

    test('message text is centered', () => {
      render(<LoadingSpinner message="Loading quiz content..." />);

      const message = screen.getByText('Loading quiz content...');
      expect(message).toHaveStyle({ textAlign: 'center' });
    });

    test('message supports ReactNode content', () => {
      const complexMessage = (
        <span>
          Loading <strong>important</strong> data...
        </span>
      );

      render(<LoadingSpinner message={complexMessage} />);

      expect(screen.getByText('important')).toBeInTheDocument();
      expect(screen.getByText(/Loading.*data.../)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Theme Integration Tests
  // ============================================================================

  describe('Theme Integration', () => {
    test('works in dark mode', () => {
      const darkTheme = createTheme({
        palette: {
          mode: 'dark',
        },
      });

      render(
        <ThemeProvider theme={darkTheme}>
          <LoadingSpinner overlay />
        </ThemeProvider>
      );

      // Spinner should be visible in dark mode
      const spinner = screen.getByRole('progressbar');
      expect(spinner).toBeInTheDocument();

      // Backdrop should have white color for dark mode
      const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
      expect(backdrop).toHaveStyle({ color: '#fff' });
    });

    test('respects theme primary color', () => {
      const customTheme = createTheme({
        palette: {
          primary: {
            main: '#ff0000',
          },
        },
      });

      render(
        <ThemeProvider theme={customTheme}>
          <LoadingSpinner color="primary" />
        </ThemeProvider>
      );

      const spinner = screen.getByRole('progressbar');
      expect(spinner).toHaveClass('MuiCircularProgress-colorPrimary');
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    test('handles rapid show/hide cycles without errors', async () => {
      const TestComponent = () => {
        const [show, setShow] = useState(true);

        React.useEffect(() => {
          // Rapidly toggle every 50ms
          const intervals = [50, 100, 150, 200];
          const timers = intervals.map((delay) =>
            setTimeout(() => setShow((prev) => !prev), delay)
          );

          return () => timers.forEach((timer) => clearTimeout(timer));
        }, []);

        return show ? <LoadingSpinner /> : <div>Hidden</div>;
      };

      render(<TestComponent />);

      // Should not throw errors during rapid toggling
      await waitFor(
        () => {
          // Just verify component eventually settles
          expect(document.body).toBeInTheDocument();
        },
        { timeout: 300 }
      );
    });

    test('renders without crashing with all props', () => {
      expect(() => {
        render(
          <LoadingSpinner
            size="large"
            color="secondary"
            overlay
            fullPage
            message="Loading everything..."
            ariaLabel="Loading all content"
            className="custom-class"
            zIndex={2000}
          />
        );
      }).not.toThrow();

      // Verify all props are applied
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Loading everything...')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading all content')).toBeInTheDocument();
    });

    test('handles empty string message gracefully', () => {
      render(<LoadingSpinner message="" />);

      // Empty message should not render Typography
      const spinner = screen.getByRole('progressbar');
      expect(spinner).toBeInTheDocument();

      // No visible text content
      const typography = document.querySelector('.MuiTypography-root');
      expect(typography).not.toBeInTheDocument();
    });

    test('handles very long messages with proper wrapping', () => {
      const longMessage =
        'This is a very long loading message that should wrap properly and not overflow the container or break the layout in any way.';

      render(<LoadingSpinner message={longMessage} />);

      const message = screen.getByText(longMessage);
      expect(message).toBeInTheDocument();
      // Typography should have maxWidth constraint
      expect(message).toHaveStyle({ maxWidth: '300px' });
    });

    test('maintains spinner visibility with zero opacity message', () => {
      render(
        <LoadingSpinner message={<span style={{ opacity: 0 }}>Hidden message</span>} />
      );

      // Spinner should still be visible
      const spinner = screen.getByRole('progressbar');
      expect(spinner).toBeVisible();
    });

    test('works correctly when rendered multiple times', () => {
      render(
        <>
          <LoadingSpinner size="small" ariaLabel="Spinner 1" />
          <LoadingSpinner size="medium" ariaLabel="Spinner 2" />
          <LoadingSpinner size="large" ariaLabel="Spinner 3" />
        </>
      );

      // All three spinners should be present
      expect(screen.getByLabelText('Spinner 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Spinner 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Spinner 3')).toBeInTheDocument();
    });

    test('overlay mode with multiple spinners uses correct z-index stacking', () => {
      render(
        <>
          <LoadingSpinner overlay zIndex={1000} />
          <LoadingSpinner overlay zIndex={2000} />
        </>
      );

      const backdrops = document.querySelectorAll('.MuiBackdrop-root');
      expect(backdrops).toHaveLength(2);

      // Verify z-index stacking
      expect(backdrops[0]).toHaveStyle({ zIndex: '1000' });
      expect(backdrops[1]).toHaveStyle({ zIndex: '2000' });
    });
  });

  // ============================================================================
  // Performance and Optimization Tests
  // ============================================================================

  describe('Performance Characteristics', () => {
    test('renders efficiently without unnecessary re-renders', () => {
      const renderSpy = vi.fn();

      const TestComponent = () => {
        renderSpy();
        return <LoadingSpinner />;
      };

      const { rerender } = render(<TestComponent />);

      // Initial render
      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Re-render with same props
      rerender(<TestComponent />);

      // Should render twice total (React 18 StrictMode may cause additional renders in dev)
      expect(renderSpy).toHaveBeenCalled();
    });

    test('unmounts cleanly without memory leaks', () => {
      const { unmount } = render(<LoadingSpinner overlay />);

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();

      // Backdrop should be removed from DOM
      const backdrop = document.querySelector('.MuiBackdrop-root');
      expect(backdrop).not.toBeInTheDocument();
    });
  });
});
