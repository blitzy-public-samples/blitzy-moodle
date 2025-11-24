/**
 * Unit Tests for Alert Component
 *
 * Validates Alert component behavior including:
 * - Severity levels (success, info, warning, error) matching Moodle notification constants
 * - Closeable behavior with onClose callback
 * - Accessibility features (ARIA roles, aria-live)
 * - Icon display and customization
 * - Title rendering with AlertTitle
 * - Action buttons support
 * - Variant support (standard, filled, outlined)
 * - Integration with Moodle notification system levels
 *
 * @see react-frontend/src/components/feedback/Alert.tsx
 * @see public/lib/classes/notification.php - Moodle notification constants
 */

import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Button } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';

// Component under test
import { Alert } from '@/components/feedback/Alert';

describe('Alert Component', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test Suite: Severity Level Tests
   * Validates that each severity level renders with correct styling, icons, and ARIA attributes
   */
  describe('Severity Levels', () => {
    test('renders with success severity', () => {
      render(<Alert severity="success" message="Operation completed successfully" />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('data-testid', 'alert-success');
      
      // Verify MUI Alert applies success styling (class includes 'MuiAlert-standardSuccess')
      expect(alert.className).toContain('MuiAlert-standardSuccess');
      
      // Verify success icon is present (MUI automatically adds CheckCircleIcon for success)
      const successIcon = alert.querySelector('.MuiAlert-icon svg');
      expect(successIcon).toBeInTheDocument();
      
      // Verify aria-live is 'polite' for success (non-urgent)
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    test('renders with info severity', () => {
      render(<Alert severity="info" message="Informational message" />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('data-testid', 'alert-info');
      
      // Verify MUI Alert applies info styling
      expect(alert.className).toContain('MuiAlert-standardInfo');
      
      // Verify info icon is present
      const infoIcon = alert.querySelector('.MuiAlert-icon svg');
      expect(infoIcon).toBeInTheDocument();
      
      // Verify aria-live is 'polite' for info (non-urgent)
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    test('renders with warning severity', () => {
      render(<Alert severity="warning" message="Warning message" />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('data-testid', 'alert-warning');
      
      // Verify MUI Alert applies warning styling
      expect(alert.className).toContain('MuiAlert-standardWarning');
      
      // Verify warning icon is present
      const warningIcon = alert.querySelector('.MuiAlert-icon svg');
      expect(warningIcon).toBeInTheDocument();
      
      // Verify aria-live is 'assertive' for warning (urgent)
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    test('renders with error severity', () => {
      render(<Alert severity="error" message="Error message" />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('data-testid', 'alert-error');
      
      // Verify MUI Alert applies error styling
      expect(alert.className).toContain('MuiAlert-standardError');
      
      // Verify error icon is present
      const errorIcon = alert.querySelector('.MuiAlert-icon svg');
      expect(errorIcon).toBeInTheDocument();
      
      // Verify aria-live is 'assertive' for error (urgent)
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    test('defaults to info severity when not specified', () => {
      render(<Alert message="Default message" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-testid', 'alert-info');
      expect(alert.className).toContain('MuiAlert-standardInfo');
    });
  });

  /**
   * Test Suite: Message Content Tests
   * Validates rendering of string and ReactNode message content
   */
  describe('Message Content', () => {
    test('renders message as string', () => {
      const message = 'This is a test message';
      render(<Alert severity="info" message={message} />);

      expect(screen.getByText(message)).toBeInTheDocument();
    });

    test('renders message as ReactNode with complex JSX', () => {
      const message = (
        <div>
          <strong>Bold text</strong>
          <p>Paragraph content</p>
          <a href="/test">Link</a>
        </div>
      );
      
      render(<Alert severity="info" message={message} />);

      expect(screen.getByText('Bold text')).toBeInTheDocument();
      expect(screen.getByText('Paragraph content')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Link' })).toBeInTheDocument();
    });

    test('renders with title using AlertTitle', () => {
      const title = 'Alert Title';
      const message = 'Alert message content';
      
      render(<Alert severity="success" title={title} message={message} />);

      // Verify title is rendered
      expect(screen.getByText(title)).toBeInTheDocument();
      
      // Verify title has AlertTitle styling (MUI applies specific class)
      const titleElement = screen.getByText(title);
      expect(titleElement.className).toContain('MuiAlertTitle');
      
      // Verify message is also rendered
      expect(screen.getByText(message)).toBeInTheDocument();
    });

    test('renders without title when title is undefined', () => {
      const message = 'Message without title';
      
      render(<Alert severity="info" message={message} />);

      // Verify message is rendered
      expect(screen.getByText(message)).toBeInTheDocument();
      
      // Verify no AlertTitle element exists
      const alert = screen.getByRole('alert');
      const alertTitle = alert.querySelector('.MuiAlertTitle-root');
      expect(alertTitle).not.toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Closeable Behavior Tests
   * Validates close button display and onClose callback functionality
   */
  describe('Closeable Behavior', () => {
    test('shows close button when closeable=true', () => {
      render(<Alert severity="info" message="Test message" closeable />);

      const closeButton = screen.getByRole('button', { name: /close alert/i });
      expect(closeButton).toBeInTheDocument();
    });

    test('hides close button when closeable=false', () => {
      render(<Alert severity="info" message="Test message" closeable={false} />);

      const closeButton = screen.queryByRole('button', { name: /close alert/i });
      expect(closeButton).not.toBeInTheDocument();
    });

    test('calls onClose when close button clicked', async () => {
      const onCloseMock = vi.fn();
      
      render(
        <Alert
          severity="info"
          message="Test message"
          closeable
          onClose={onCloseMock}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close alert/i });
      fireEvent.click(closeButton);

      // Wait for the animation delay (300ms) before onClose is called
      await waitFor(() => {
        expect(onCloseMock).toHaveBeenCalledTimes(1);
      }, { timeout: 500 });
    });

    test('removes alert from DOM on close with Collapse animation', async () => {
      function TestWrapper() {
        const [showAlert, setShowAlert] = React.useState(true);

        return (
          <div>
            {showAlert && (
              <Alert
                severity="success"
                message="This alert will close"
                closeable
                onClose={() => setShowAlert(false)}
              />
            )}
            <div data-testid="other-content">Other content</div>
          </div>
        );
      }

      render(<TestWrapper />);

      // Verify alert is initially present
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Click close button
      const closeButton = screen.getByRole('button', { name: /close alert/i });
      fireEvent.click(closeButton);

      // Wait for alert to be removed (Collapse animation + onClose delay = ~600ms)
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      }, { timeout: 1000 });

      // Verify other content remains
      expect(screen.getByTestId('other-content')).toBeInTheDocument();
    });

    test('does not call onClose when closeable=false', () => {
      const onCloseMock = vi.fn();
      
      render(
        <Alert
          severity="info"
          message="Test message"
          closeable={false}
          onClose={onCloseMock}
        />
      );

      // No close button should exist
      const closeButton = screen.queryByRole('button', { name: /close alert/i });
      expect(closeButton).not.toBeInTheDocument();
      
      // onClose should never be called
      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });

  /**
   * Test Suite: Variant Tests
   * Validates standard, filled, and outlined visual variants
   */
  describe('Variant Support', () => {
    test('renders standard variant with default styling', () => {
      render(<Alert severity="info" message="Standard variant" variant="standard" />);

      const alert = screen.getByRole('alert');
      
      // Verify standard variant class is applied
      expect(alert.className).toContain('MuiAlert-standardInfo');
    });

    test('renders filled variant with solid background', () => {
      render(<Alert severity="success" message="Filled variant" variant="filled" />);

      const alert = screen.getByRole('alert');
      
      // Verify filled variant class is applied
      expect(alert.className).toContain('MuiAlert-filledSuccess');
    });

    test('renders outlined variant with border styling', () => {
      render(<Alert severity="warning" message="Outlined variant" variant="outlined" />);

      const alert = screen.getByRole('alert');
      
      // Verify outlined variant class is applied
      expect(alert.className).toContain('MuiAlert-outlinedWarning');
    });

    test('defaults to standard variant when not specified', () => {
      render(<Alert severity="error" message="Default variant" />);

      const alert = screen.getByRole('alert');
      
      // Verify standard variant is applied by default
      expect(alert.className).toContain('MuiAlert-standardError');
    });
  });

  /**
   * Test Suite: Icon Tests
   * Validates default icons, custom icons, and icon hiding
   */
  describe('Icon Display', () => {
    test('shows default icon based on severity', () => {
      const { rerender } = render(<Alert severity="success" message="Test" />);
      
      // Success alert should have icon
      let alert = screen.getByRole('alert');
      let icon = alert.querySelector('.MuiAlert-icon');
      expect(icon).toBeInTheDocument();

      // Info alert should have icon
      rerender(<Alert severity="info" message="Test" />);
      alert = screen.getByRole('alert');
      icon = alert.querySelector('.MuiAlert-icon');
      expect(icon).toBeInTheDocument();

      // Warning alert should have icon
      rerender(<Alert severity="warning" message="Test" />);
      alert = screen.getByRole('alert');
      icon = alert.querySelector('.MuiAlert-icon');
      expect(icon).toBeInTheDocument();

      // Error alert should have icon
      rerender(<Alert severity="error" message="Test" />);
      alert = screen.getByRole('alert');
      icon = alert.querySelector('.MuiAlert-icon');
      expect(icon).toBeInTheDocument();
    });

    test('hides icon when icon={false}', () => {
      render(<Alert severity="info" message="No icon" icon={false} />);

      const alert = screen.getByRole('alert');
      const icon = alert.querySelector('.MuiAlert-icon');
      
      // Icon should not be present
      expect(icon).not.toBeInTheDocument();
    });

    test('renders custom icon', () => {
      const customIcon = <CheckCircle data-testid="custom-icon" />;
      
      render(<Alert severity="info" message="Custom icon" icon={customIcon} />);

      // Verify custom icon is rendered
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Action Button Tests
   * Validates custom action buttons within alerts
   */
  describe('Action Buttons', () => {
    test('renders custom action buttons', () => {
      const action = <Button size="small">Retry</Button>;
      
      render(
        <Alert
          severity="error"
          message="Operation failed"
          action={action}
        />
      );

      const retryButton = screen.getByRole('button', { name: 'Retry' });
      expect(retryButton).toBeInTheDocument();
    });

    test('action button click triggers callback', () => {
      const onActionClick = vi.fn();
      const action = (
        <Button size="small" onClick={onActionClick}>
          Undo
        </Button>
      );
      
      render(
        <Alert
          severity="warning"
          message="Item deleted"
          action={action}
        />
      );

      const undoButton = screen.getByRole('button', { name: 'Undo' });
      fireEvent.click(undoButton);

      expect(onActionClick).toHaveBeenCalledTimes(1);
    });

    test('action buttons and close button coexist', () => {
      const action = <Button size="small">Retry</Button>;
      
      render(
        <Alert
          severity="error"
          message="Operation failed"
          action={action}
          closeable
        />
      );

      // Both action button and close button should be present
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close alert/i })).toBeInTheDocument();
    });

    test('renders multiple action buttons', () => {
      const actions = (
        <>
          <Button size="small">Retry</Button>
          <Button size="small">Cancel</Button>
        </>
      );
      
      render(
        <Alert
          severity="error"
          message="Operation failed"
          action={actions}
        />
      );

      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Accessibility Tests
   * Validates ARIA attributes and screen reader support
   */
  describe('Accessibility Features', () => {
    test('has correct role=alert attribute', () => {
      render(<Alert severity="info" message="Test message" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('role', 'alert');
    });

    test('info severity has aria-live=polite', () => {
      render(<Alert severity="info" message="Info message" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    test('success severity has aria-live=polite', () => {
      render(<Alert severity="success" message="Success message" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    test('warning severity has aria-live=assertive', () => {
      render(<Alert severity="warning" message="Warning message" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    test('error severity has aria-live=assertive', () => {
      render(<Alert severity="error" message="Error message" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    test('screen reader announces message content', () => {
      const message = 'This message should be announced';
      render(<Alert severity="info" message={message} />);

      const alert = screen.getByRole('alert');
      
      // Verify alert contains the message text
      expect(within(alert).getByText(message)).toBeInTheDocument();
      
      // Verify alert is accessible to screen readers
      expect(alert).toHaveTextContent(message);
    });

    test('close button has accessible label', () => {
      render(<Alert severity="info" message="Test" closeable />);

      const closeButton = screen.getByRole('button', { name: /close alert/i });
      expect(closeButton).toHaveAttribute('aria-label', 'close alert');
    });
  });

  /**
   * Test Suite: Integration with Moodle Notification Levels
   * Documents mapping between React Alert severity and Moodle notification constants
   */
  describe('Moodle Notification Level Mapping', () => {
    test('success severity maps to notification::SUCCESS', () => {
      // Moodle notification::SUCCESS constant = 'success'
      // React Alert severity='success' maps directly
      render(<Alert severity="success" message="Success notification" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-testid', 'alert-success');
      expect(alert.className).toContain('MuiAlert-standardSuccess');
    });

    test('info severity maps to notification::INFO', () => {
      // Moodle notification::INFO constant = 'info'
      // React Alert severity='info' maps directly
      render(<Alert severity="info" message="Info notification" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-testid', 'alert-info');
      expect(alert.className).toContain('MuiAlert-standardInfo');
    });

    test('warning severity maps to notification::WARNING', () => {
      // Moodle notification::WARNING constant = 'warning'
      // React Alert severity='warning' maps directly
      render(<Alert severity="warning" message="Warning notification" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-testid', 'alert-warning');
      expect(alert.className).toContain('MuiAlert-standardWarning');
    });

    test('error severity maps to notification::ERROR', () => {
      // Moodle notification::ERROR constant = 'error'
      // React Alert severity='error' maps directly
      render(<Alert severity="error" message="Error notification" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-testid', 'alert-error');
      expect(alert.className).toContain('MuiAlert-standardError');
    });
  });

  /**
   * Test Suite: Style Customization Tests
   * Validates custom styling via sx prop and className
   */
  describe('Style Customization', () => {
    test('accepts custom sx prop', () => {
      render(
        <Alert
          severity="info"
          message="Custom styles"
          sx={{ margin: 4, padding: 3 }}
        />
      );

      const alert = screen.getByRole('alert');
      
      // MUI applies sx styles via inline styles or classes
      // Verify the element exists (specific style verification would require styled-components testing)
      expect(alert).toBeInTheDocument();
    });

    test('applies custom className', () => {
      const customClass = 'custom-alert-class';
      
      render(
        <Alert
          severity="success"
          message="Custom class"
          className={customClass}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass(customClass);
    });

    test('combines custom className with MUI classes', () => {
      const customClass = 'my-custom-alert';
      
      render(
        <Alert
          severity="error"
          message="Combined classes"
          className={customClass}
        />
      );

      const alert = screen.getByRole('alert');
      
      // Should have both custom class and MUI classes
      expect(alert).toHaveClass(customClass);
      expect(alert.className).toContain('MuiAlert-standardError');
    });
  });

  /**
   * Test Suite: Edge Cases
   * Validates handling of unusual inputs and scenarios
   */
  describe('Edge Cases', () => {
    test('handles empty message gracefully', () => {
      render(<Alert severity="info" message="" />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      
      // Alert should render but with no visible text
      expect(alert).toHaveTextContent('');
    });

    test('handles very long message with text wrapping', () => {
      const longMessage = 'This is a very long message that should wrap to multiple lines. '.repeat(10);
      
      render(<Alert severity="warning" message={longMessage} />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      // Trim whitespace for comparison as browsers normalize trailing spaces
      expect(alert.textContent?.trim()).toBe(longMessage.trim());
    });

    test('renders multiple alerts without interference', () => {
      render(
        <div>
          <Alert severity="success" message="First alert" />
          <Alert severity="error" message="Second alert" />
          <Alert severity="info" message="Third alert" />
        </div>
      );

      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(3);

      // Verify each alert has correct content
      expect(screen.getByText('First alert')).toBeInTheDocument();
      expect(screen.getByText('Second alert')).toBeInTheDocument();
      expect(screen.getByText('Third alert')).toBeInTheDocument();

      // Verify each alert has correct severity
      expect(alerts[0]).toHaveAttribute('data-testid', 'alert-success');
      expect(alerts[1]).toHaveAttribute('data-testid', 'alert-error');
      expect(alerts[2]).toHaveAttribute('data-testid', 'alert-info');
    });

    test('handles rapid open/close cycles', async () => {
      function TestWrapper() {
        const [showAlert, setShowAlert] = React.useState(true);
        const [clickCount, setClickCount] = React.useState(0);

        return (
          <div>
            {showAlert && (
              <Alert
                severity="info"
                message={`Alert ${clickCount}`}
                closeable
                onClose={() => {
                  setShowAlert(false);
                  setTimeout(() => {
                    setShowAlert(true);
                    setClickCount((c) => c + 1);
                  }, 100);
                }}
              />
            )}
          </div>
        );
      }

      render(<TestWrapper />);

      // Initial alert
      expect(screen.getByText('Alert 0')).toBeInTheDocument();

      // Close and wait for re-open
      const closeButton = screen.getByRole('button', { name: /close alert/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.getByText('Alert 1')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    test('handles undefined onClose gracefully when closeable=true', () => {
      // Should not throw error even without onClose callback
      expect(() => {
        render(<Alert severity="info" message="Test" closeable />);
      }).not.toThrow();

      const closeButton = screen.getByRole('button', { name: /close alert/i });
      
      // Should not throw when clicking close button
      expect(() => {
        fireEvent.click(closeButton);
      }).not.toThrow();
    });

    test('preserves alert state across re-renders with same props', () => {
      const { rerender } = render(
        <Alert severity="success" message="Initial message" />
      );

      // Verify initial render
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Initial message')).toBeInTheDocument();

      // Re-render with same props
      rerender(<Alert severity="success" message="Initial message" />);

      // Alert should still be present
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Initial message')).toBeInTheDocument();
    });
  });
});
