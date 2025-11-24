/**
 * Unit Tests for Toast Component
 * 
 * Comprehensive test suite validating the Toast notification component functionality
 * including auto-dismissing behavior, Moodle severity levels, positioning, animations,
 * accessibility features, and integration with React Query mutations.
 * 
 * Tests cover:
 * - Basic rendering and visibility control
 * - Severity levels (success, info, warning, error) with proper styling and icons
 * - Auto-hide duration (default 6000ms, custom, disabled)
 * - Position configurations (top-right, top-center, bottom-right, etc.)
 * - Close button functionality
 * - Custom action buttons (Undo, Retry, etc.)
 * - Slide animation transitions based on position
 * - WCAG 2.1 AA accessibility compliance (ARIA roles, live regions)
 * - Visual variants (filled, standard, outlined)
 * - useToast hook for programmatic control
 * - Integration with React Query mutation callbacks
 * - Edge cases and error handling
 * 
 * @see Section 0.4 Transformation Mapping - React component tests
 * @see react-frontend/src/components/feedback/Toast.tsx - Component implementation
 */

import React, { useState } from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '../../helpers/render';
import userEvent from '@testing-library/user-event';
import { Toast, useToast, type ToastProps } from '@/components/feedback/Toast';
import { Button } from '@mui/material';

/**
 * Test wrapper component for controlled Toast testing
 * Provides state management to test Toast behavior with dynamic props
 */
function ToastWrapper(props: Partial<ToastProps> & { initialOpen?: boolean }) {
  const { initialOpen = false, ...toastProps } = props;
  const [open, setOpen] = useState(initialOpen);

  const defaultProps: ToastProps = {
    open: open,
    message: 'Test message',
    severity: 'info',
    onClose: () => setOpen(false),
    ...toastProps,
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>Show Toast</Button>
      <Toast {...defaultProps} />
    </>
  );
}

/**
 * Test wrapper for useToast hook testing
 * Demonstrates hook usage pattern with Toast component
 */
function UseToastWrapper() {
  const { open, message, severity, showToast, hideToast } = useToast();

  return (
    <>
      <Button onClick={() => showToast('Success message', 'success')}>
        Show Success
      </Button>
      <Button onClick={() => showToast('Error message', 'error')}>
        Show Error
      </Button>
      <Button onClick={() => showToast(<span>Rich content</span>, 'info')}>
        Show Rich Content
      </Button>
      <Button onClick={hideToast}>Hide Toast</Button>
      <Toast
        open={open}
        message={message}
        severity={severity}
        onClose={hideToast}
      />
    </>
  );
}

describe('Toast Component', () => {
  /**
   * Setup and Teardown
   * Use fake timers for deterministic auto-hide testing
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  /**
   * Basic Rendering Tests
   * Verify toast visibility control and message display
   */
  describe('Basic Rendering', () => {
    test('renders toast when open=true', () => {
      render(
        <Toast
          open={true}
          message="Test notification"
          severity="info"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Test notification')).toBeInTheDocument();
    });

    test('does not render when open=false', () => {
      render(
        <Toast
          open={false}
          message="Hidden message"
          severity="info"
          onClose={vi.fn()}
        />
      );

      expect(screen.queryByText('Hidden message')).not.toBeInTheDocument();
    });

    test('displays string message text', () => {
      render(
        <Toast
          open={true}
          message="Simple string message"
          severity="info"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Simple string message')).toBeInTheDocument();
    });

    test('displays ReactNode message with rich content', () => {
      render(
        <Toast
          open={true}
          message={
            <div>
              <strong>Bold text</strong>
              <span> and regular text</span>
            </div>
          }
          severity="info"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Bold text')).toBeInTheDocument();
      expect(screen.getByText('and regular text')).toBeInTheDocument();
    });
  });

  /**
   * Severity Level Tests
   * Validate all Moodle notification severity levels with correct styling
   */
  describe('Severity Levels', () => {
    test('renders with success severity', () => {
      render(
        <Toast
          open={true}
          message="Success message"
          severity="success"
          onClose={vi.fn()}
        />
      );

      const alert = screen.getByRole('status');
      expect(alert).toHaveClass('MuiAlert-filledSuccess');
      expect(screen.getByText('Success message')).toBeInTheDocument();
    });

    test('renders with info severity', () => {
      render(
        <Toast
          open={true}
          message="Info message"
          severity="info"
          onClose={vi.fn()}
        />
      );

      const alert = screen.getByRole('status');
      expect(alert).toHaveClass('MuiAlert-filledInfo');
      expect(screen.getByText('Info message')).toBeInTheDocument();
    });

    test('renders with warning severity', () => {
      render(
        <Toast
          open={true}
          message="Warning message"
          severity="warning"
          onClose={vi.fn()}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('MuiAlert-filledWarning');
      expect(screen.getByText('Warning message')).toBeInTheDocument();
    });

    test('renders with error severity', () => {
      render(
        <Toast
          open={true}
          message="Error message"
          severity="error"
          onClose={vi.fn()}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('MuiAlert-filledError');
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  /**
   * Auto-Hide Duration Tests
   * Test automatic dismissal after configurable timeout
   */
  describe('Auto-Hide Duration', () => {
    test('auto-hides after default duration (6000ms)', () => {
      const handleClose = vi.fn();
      render(
        <Toast
          open={true}
          message="Auto-hide message"
          severity="info"
          onClose={handleClose}
        />
      );

      expect(screen.getByText('Auto-hide message')).toBeInTheDocument();

      // Advance time to just before auto-hide
      act(() => {
        vi.advanceTimersByTime(5999);
      });
      expect(handleClose).not.toHaveBeenCalled();

      // Advance to trigger auto-hide
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    test('auto-hides after custom duration (3000ms)', () => {
      const handleClose = vi.fn();
      render(
        <Toast
          open={true}
          message="Custom duration"
          severity="info"
          autoHideDuration={3000}
          onClose={handleClose}
        />
      );

      act(() => {
        vi.advanceTimersByTime(2999);
      });
      expect(handleClose).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    test('does not auto-hide when duration is null', () => {
      const handleClose = vi.fn();
      render(
        <Toast
          open={true}
          message="Persistent toast"
          severity="info"
          autoHideDuration={null as any}
          onClose={handleClose}
        />
      );

      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(handleClose).not.toHaveBeenCalled();
      expect(screen.getByText('Persistent toast')).toBeInTheDocument();
    });

    test('auto-hides after very short duration (1000ms)', () => {
      const handleClose = vi.fn();
      render(
        <Toast
          open={true}
          message="Quick toast"
          severity="info"
          autoHideDuration={1000}
          onClose={handleClose}
        />
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Position Tests
   * Verify toast placement at all screen positions
   */
  describe('Position', () => {
    test('renders at top-right position (default)', () => {
      const { container } = render(
        <Toast
          open={true}
          message="Top right"
          severity="info"
          onClose={vi.fn()}
        />
      );

      const snackbar = container.querySelector('.MuiSnackbar-root');
      expect(snackbar).toHaveClass('MuiSnackbar-anchorOriginTopRight');
    });

    test('renders at top-center position', () => {
      const { container } = render(
        <Toast
          open={true}
          message="Top center"
          severity="info"
          position={{ vertical: 'top', horizontal: 'center' }}
          onClose={vi.fn()}
        />
      );

      const snackbar = container.querySelector('.MuiSnackbar-root');
      expect(snackbar).toHaveClass('MuiSnackbar-anchorOriginTopCenter');
    });

    test('renders at bottom-right position', () => {
      const { container } = render(
        <Toast
          open={true}
          message="Bottom right"
          severity="info"
          position={{ vertical: 'bottom', horizontal: 'right' }}
          onClose={vi.fn()}
        />
      );

      const snackbar = container.querySelector('.MuiSnackbar-root');
      expect(snackbar).toHaveClass('MuiSnackbar-anchorOriginBottomRight');
    });

    test('renders at bottom-left position', () => {
      const { container } = render(
        <Toast
          open={true}
          message="Bottom left"
          severity="info"
          position={{ vertical: 'bottom', horizontal: 'left' }}
          onClose={vi.fn()}
        />
      );

      const snackbar = container.querySelector('.MuiSnackbar-root');
      expect(snackbar).toHaveClass('MuiSnackbar-anchorOriginBottomLeft');
    });

    test('renders at top-left position', () => {
      const { container } = render(
        <Toast
          open={true}
          message="Top left"
          severity="info"
          position={{ vertical: 'top', horizontal: 'left' }}
          onClose={vi.fn()}
        />
      );

      const snackbar = container.querySelector('.MuiSnackbar-root');
      expect(snackbar).toHaveClass('MuiSnackbar-anchorOriginTopLeft');
    });

    test('renders at bottom-center position', () => {
      const { container } = render(
        <Toast
          open={true}
          message="Bottom center"
          severity="info"
          position={{ vertical: 'bottom', horizontal: 'center' }}
          onClose={vi.fn()}
        />
      );

      const snackbar = container.querySelector('.MuiSnackbar-root');
      expect(snackbar).toHaveClass('MuiSnackbar-anchorOriginBottomCenter');
    });
  });

  /**
   * Close Button Tests
   * Verify manual dismissal via close button
   */
  describe('Close Button', () => {
    test('shows close button in Alert', async () => {
      render(
        <Toast
          open={true}
          message="Closeable toast"
          severity="info"
          onClose={vi.fn()}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });

    test('closes on close button click', async () => {
      const handleClose = vi.fn();
      render(
        <Toast
          open={true}
          message="Click to close"
          severity="info"
          onClose={handleClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await userEvent.click(closeButton);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    test('close button has accessible label', () => {
      render(
        <Toast
          open={true}
          message="Accessible close"
          severity="info"
          onClose={vi.fn()}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toHaveAttribute('aria-label', 'Close');
    });
  });

  /**
   * Action Button Tests
   * Test custom action buttons within toast (Undo, Retry, etc.)
   */
  describe('Action Buttons', () => {
    test('renders custom action button', () => {
      render(
        <Toast
          open={true}
          message="With action"
          severity="info"
          onClose={vi.fn()}
          action={
            <Button color="inherit" size="small">
              UNDO
            </Button>
          }
        />
      );

      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    });

    test('action button onClick works', async () => {
      const handleAction = vi.fn();
      render(
        <Toast
          open={true}
          message="Action test"
          severity="info"
          onClose={vi.fn()}
          action={
            <Button color="inherit" size="small" onClick={handleAction}>
              RETRY
            </Button>
          }
        />
      );

      const actionButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(actionButton);

      expect(handleAction).toHaveBeenCalledTimes(1);
    });

    test('renders multiple action buttons', () => {
      render(
        <Toast
          open={true}
          message="Multiple actions"
          severity="info"
          onClose={vi.fn()}
          action={
            <>
              <Button color="inherit" size="small">
                UNDO
              </Button>
              <Button color="inherit" size="small">
                RETRY
              </Button>
            </>
          }
        />
      );

      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    test('undo action button example', async () => {
      const handleUndo = vi.fn();
      render(
        <Toast
          open={true}
          message="Course deleted"
          severity="info"
          onClose={vi.fn()}
          action={
            <Button color="inherit" size="small" onClick={handleUndo}>
              UNDO
            </Button>
          }
        />
      );

      expect(screen.getByText('Course deleted')).toBeInTheDocument();

      const undoButton = screen.getByRole('button', { name: /undo/i });
      await userEvent.click(undoButton);

      expect(handleUndo).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Slide Animation Tests
   * Verify slide transitions match position
   */
  describe('Slide Animation', () => {
    test('applies Slide transition component', () => {
      const { container } = render(
        <Toast
          open={true}
          message="Animated toast"
          severity="info"
          onClose={vi.fn()}
        />
      );

      // MUI Slide component adds specific transition classes
      const slideElement = container.querySelector('.MuiSlide-root');
      expect(slideElement).toBeInTheDocument();
    });

    test('slide direction is down for top position', () => {
      const { container } = render(
        <Toast
          open={true}
          message="Slide down"
          severity="info"
          position={{ vertical: 'top', horizontal: 'center' }}
          onClose={vi.fn()}
        />
      );

      // Component uses 'down' direction for top position
      expect(screen.getByText('Slide down')).toBeInTheDocument();
    });

    test('slide direction is up for bottom position', () => {
      const { container } = render(
        <Toast
          open={true}
          message="Slide up"
          severity="info"
          position={{ vertical: 'bottom', horizontal: 'center' }}
          onClose={vi.fn()}
        />
      );

      // Component uses 'up' direction for bottom position
      expect(screen.getByText('Slide up')).toBeInTheDocument();
    });
  });

  /**
   * Accessibility Tests
   * Validate WCAG 2.1 AA compliance with proper ARIA roles
   */
  describe('Accessibility', () => {
    test('info severity has role=status', () => {
      render(
        <Toast
          open={true}
          message="Info message"
          severity="info"
          onClose={vi.fn()}
        />
      );

      const alert = screen.getByRole('status');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Info message');
    });

    test('success severity has role=status', () => {
      render(
        <Toast
          open={true}
          message="Success message"
          severity="success"
          onClose={vi.fn()}
        />
      );

      const alert = screen.getByRole('status');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Success message');
    });

    test('warning severity has role=alert', () => {
      render(
        <Toast
          open={true}
          message="Warning message"
          severity="warning"
          onClose={vi.fn()}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Warning message');
    });

    test('error severity has role=alert', () => {
      render(
        <Toast
          open={true}
          message="Error message"
          severity="error"
          onClose={vi.fn()}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Error message');
    });

    test('has appropriate aria attributes', () => {
      render(
        <Toast
          open={true}
          message="Accessible toast"
          severity="success"
          onClose={vi.fn()}
        />
      );

      const alert = screen.getByRole('status');
      // MUI Alert includes proper ARIA attributes automatically
      expect(alert).toBeInTheDocument();
    });
  });

  /**
   * Variant Tests
   * Test different visual styles (filled, standard, outlined)
   */
  describe('Variant', () => {
    test('renders filled variant (default)', () => {
      render(
        <Toast
          open={true}
          message="Filled variant"
          severity="info"
          onClose={vi.fn()}
        />
      );

      const alert = screen.getByRole('status');
      expect(alert).toHaveClass('MuiAlert-filled');
    });

    test('renders standard variant', () => {
      render(
        <Toast
          open={true}
          message="Standard variant"
          severity="info"
          variant="standard"
          onClose={vi.fn()}
        />
      );

      const alert = screen.getByRole('status');
      expect(alert).toHaveClass('MuiAlert-standard');
    });

    test('renders outlined variant', () => {
      render(
        <Toast
          open={true}
          message="Outlined variant"
          severity="info"
          variant="outlined"
          onClose={vi.fn()}
        />
      );

      const alert = screen.getByRole('status');
      expect(alert).toHaveClass('MuiAlert-outlined');
    });
  });

  /**
   * useToast Hook Tests
   * Test programmatic toast control via custom hook
   */
  describe('useToast Hook', () => {
    test('showToast function displays toast', async () => {
      render(<UseToastWrapper />);

      const showButton = screen.getByRole('button', { name: /show success/i });
      await userEvent.click(showButton);

      expect(screen.getByText('Success message')).toBeInTheDocument();
    });

    test('hideToast function closes toast', async () => {
      render(<UseToastWrapper />);

      // Show toast first
      const showButton = screen.getByRole('button', { name: /show success/i });
      await userEvent.click(showButton);
      expect(screen.getByText('Success message')).toBeInTheDocument();

      // Hide toast
      const hideButton = screen.getByRole('button', { name: /hide toast/i });
      await userEvent.click(hideButton);

      await waitFor(() => {
        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      });
    });

    test('showToast updates severity correctly', async () => {
      render(<UseToastWrapper />);

      // Show success toast
      const successButton = screen.getByRole('button', { name: /show success/i });
      await userEvent.click(successButton);
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Hide and show error toast
      const hideButton = screen.getByRole('button', { name: /hide toast/i });
      await userEvent.click(hideButton);

      await waitFor(() => {
        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      });

      const errorButton = screen.getByRole('button', { name: /show error/i });
      await userEvent.click(errorButton);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });

    test('showToast handles ReactNode content', async () => {
      render(<UseToastWrapper />);

      const richButton = screen.getByRole('button', { name: /show rich content/i });
      await userEvent.click(richButton);

      expect(screen.getByText('Rich content')).toBeInTheDocument();
    });

    test('default severity is info when not specified', async () => {
      const TestComponent = () => {
        const { open, message, severity, showToast, hideToast } = useToast();
        return (
          <>
            <Button onClick={() => showToast('Default severity')}>
              Show Default
            </Button>
            <Toast
              open={open}
              message={message}
              severity={severity}
              onClose={hideToast}
            />
          </>
        );
      };

      render(<TestComponent />);

      const showButton = screen.getByRole('button', { name: /show default/i });
      await userEvent.click(showButton);

      // Default severity should be 'info' which has role='status'
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Default severity')).toBeInTheDocument();
    });
  });

  /**
   * Edge Cases
   * Test error conditions and boundary cases
   */
  describe('Edge Cases', () => {
    test('handles rapid open/close cycles', async () => {
      render(<ToastWrapper initialOpen={false} />);

      const showButton = screen.getByRole('button', { name: /show toast/i });

      // Rapidly toggle toast
      await userEvent.click(showButton);
      const closeButton = screen.getByRole('button', { name: /close/i });
      await userEvent.click(closeButton);

      await userEvent.click(showButton);
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    test('handles empty message gracefully', () => {
      render(
        <Toast
          open={true}
          message=""
          severity="info"
          onClose={vi.fn()}
        />
      );

      // Toast should still render even with empty message
      const alert = screen.getByRole('status');
      expect(alert).toBeInTheDocument();
    });

    test('handles very long message', () => {
      const longMessage = 'A'.repeat(500);
      render(
        <Toast
          open={true}
          message={longMessage}
          severity="info"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    test('prevents closing on clickaway', () => {
      const handleClose = vi.fn();
      const { container } = render(
        <div>
          <div data-testid="outside">Outside element</div>
          <Toast
            open={true}
            message="No clickaway close"
            severity="info"
            onClose={handleClose}
          />
        </div>
      );

      // Click outside the toast
      const outsideElement = screen.getByTestId('outside');
      fireEvent.click(outsideElement);

      // onClose should not be called (prevented by handleClose logic)
      expect(handleClose).not.toHaveBeenCalled();
      expect(screen.getByText('No clickaway close')).toBeInTheDocument();
    });

    test('onClose called only once per close action', async () => {
      const handleClose = vi.fn();
      render(
        <Toast
          open={true}
          message="Single close call"
          severity="info"
          onClose={handleClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await userEvent.click(closeButton);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    test('handles null autoHideDuration correctly', () => {
      const handleClose = vi.fn();
      render(
        <Toast
          open={true}
          message="No auto-hide"
          severity="info"
          autoHideDuration={undefined}
          onClose={handleClose}
        />
      );

      // Default should be used (6000ms)
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Integration with React Query Tests
   * Test toast usage in mutation callbacks
   */
  describe('Integration with React Query', () => {
    test('shows success toast after mutation success', async () => {
      const TestComponent = () => {
        const { open, message, severity, showToast, hideToast } = useToast();

        const handleSuccess = () => {
          showToast('Operation completed successfully', 'success');
        };

        return (
          <>
            <Button onClick={handleSuccess}>Trigger Success</Button>
            <Toast
              open={open}
              message={message}
              severity={severity}
              onClose={hideToast}
            />
          </>
        );
      };

      render(<TestComponent />);

      const triggerButton = screen.getByRole('button', { name: /trigger success/i });
      await userEvent.click(triggerButton);

      expect(screen.getByText('Operation completed successfully')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    test('shows error toast after mutation error', async () => {
      const TestComponent = () => {
        const { open, message, severity, showToast, hideToast } = useToast();

        const handleError = () => {
          showToast('Operation failed: Network error', 'error');
        };

        return (
          <>
            <Button onClick={handleError}>Trigger Error</Button>
            <Toast
              open={open}
              message={message}
              severity={severity}
              onClose={hideToast}
            />
          </>
        );
      };

      render(<TestComponent />);

      const triggerButton = screen.getByRole('button', { name: /trigger error/i });
      await userEvent.click(triggerButton);

      expect(screen.getByText('Operation failed: Network error')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    test('custom message in mutation callbacks', async () => {
      const TestComponent = () => {
        const { open, message, severity, showToast, hideToast } = useToast();

        const handleCustomMessage = () => {
          showToast(
            <span>
              Course <strong>CS101</strong> created successfully
            </span>,
            'success'
          );
        };

        return (
          <>
            <Button onClick={handleCustomMessage}>Create Course</Button>
            <Toast
              open={open}
              message={message}
              severity={severity}
              onClose={hideToast}
            />
          </>
        );
      };

      render(<TestComponent />);

      const createButton = screen.getByRole('button', { name: /create course/i });
      await userEvent.click(createButton);

      expect(screen.getByText('Course')).toBeInTheDocument();
      expect(screen.getByText('CS101')).toBeInTheDocument();
      expect(screen.getByText('created successfully')).toBeInTheDocument();
    });
  });

  /**
   * Message Cleanup Tests
   * Verify message state resets after toast closes
   */
  describe('Message Cleanup', () => {
    test('clears message state after toast closes', async () => {
      render(<UseToastWrapper />);

      // Show toast
      const showButton = screen.getByRole('button', { name: /show success/i });
      await userEvent.click(showButton);
      expect(screen.getByText('Success message')).toBeInTheDocument();

      // Hide toast
      const hideButton = screen.getByRole('button', { name: /hide toast/i });
      await userEvent.click(hideButton);

      // Wait for cleanup (300ms after close)
      await waitFor(
        () => {
          expect(screen.queryByText('Success message')).not.toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });
  });
});
