/**
 * Alert Component
 *
 * Displays informational, success, warning, and error messages to users.
 * Maps directly to Moodle's notification system levels (SUCCESS, WARNING, INFO, ERROR).
 *
 * Features:
 * - Severity-based styling and icons (success, info, warning, error)
 * - Optional title and close button
 * - Support for custom action buttons
 * - Fade-out animation on close
 * - Full accessibility with ARIA attributes
 * - Material-UI v5 theming support (light/dark modes)
 *
 * Usage:
 * ```tsx
 * <Alert
 *   severity="success"
 *   message="Operation completed successfully"
 *   closeable
 * />
 *
 * <Alert
 *   severity="error"
 *   title="Submission Failed"
 *   message="Please check your file format and try again"
 *   action={<Button>Retry</Button>}
 * />
 * ```
 */

import { useState, type ReactNode, type SyntheticEvent } from 'react';
import {
  Alert as MuiAlert,
  AlertTitle,
  IconButton,
  Collapse,
  Box,
  type AlertProps as MuiAlertProps,
} from '@mui/material';
import { Close } from '@mui/icons-material';

/**
 * Alert severity levels matching Moodle's notification system:
 * - success: notification::SUCCESS - Operation completed successfully
 * - info: notification::INFO - Informational message
 * - warning: notification::WARNING - Warning that requires attention
 * - error: notification::ERROR - Error that needs user action
 */
export type AlertSeverity = 'success' | 'info' | 'warning' | 'error';

/**
 * Alert visual variants following Material Design guidelines
 */
export type AlertVariant = 'standard' | 'filled' | 'outlined';

/**
 * Props interface for the Alert component
 */
export interface AlertComponentProps {
  /**
   * Severity level of the alert (maps to Moodle notification types)
   * @default 'info'
   */
  severity?: AlertSeverity;

  /**
   * Optional title displayed at the top of the alert
   */
  title?: string;

  /**
   * Alert message content (supports both string and React elements)
   */
  message: string | ReactNode;

  /**
   * Visual variant of the alert
   * @default 'standard'
   */
  variant?: AlertVariant;

  /**
   * Whether the alert can be closed by the user
   * @default false
   */
  closeable?: boolean;

  /**
   * Callback fired when the alert is closed
   */
  onClose?: () => void;

  /**
   * Custom action button(s) to display in the alert
   */
  action?: ReactNode;

  /**
   * Custom icon to display (or false to hide icon)
   */
  icon?: ReactNode | false;

  /**
   * Additional styles using MUI's sx prop
   */
  sx?: MuiAlertProps['sx'];

  /**
   * Additional class name for custom styling
   */
  className?: string;

  /**
   * Test ID for component testing
   */
  'data-testid'?: string;
}

/**
 * Alert Component
 *
 * Reusable notification component that displays user feedback messages
 * with support for different severity levels, custom actions, and dismissal.
 */
export function Alert({
  severity = 'info',
  title,
  message,
  variant = 'standard',
  closeable = false,
  onClose,
  action,
  icon,
  sx,
  className,
  'data-testid': dataTestId,
}: AlertComponentProps): JSX.Element {
  // State to control alert visibility when closeable
  const [open, setOpen] = useState<boolean>(true);

  /**
   * Handle alert close
   * Triggers fade-out animation and calls onClose callback
   */
  const handleClose = (event: SyntheticEvent): void => {
    // Prevent event bubbling to avoid unintended side effects
    event.stopPropagation();

    setOpen(false);

    // Call onClose callback after a short delay to allow animation to complete
    if (onClose) {
      setTimeout(() => {
        onClose();
      }, 300); // Match Collapse animation duration
    }
  };

  /**
   * Determine aria-live attribute based on severity
   * - 'assertive' for warning/error: Interrupts current screen reader activity
   * - 'polite' for info/success: Waits for current screen reader activity to complete
   */
  const getAriaLive = (): 'polite' | 'assertive' => {
    return severity === 'warning' || severity === 'error' ? 'assertive' : 'polite';
  };

  /**
   * Render close button if closeable prop is true
   */
  const renderCloseButton = (): ReactNode => {
    if (!closeable) {
      return null;
    }

    return (
      <IconButton
        aria-label="close alert"
        color="inherit"
        size="small"
        onClick={handleClose}
        sx={{
          padding: 0.5,
          marginLeft: 1,
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      >
        <Close fontSize="small" />
      </IconButton>
    );
  };

  /**
   * Combine action prop with close button if both are present
   */
  const getActionContent = (): ReactNode => {
    // If both custom action and close button exist, combine them
    if (action && closeable) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {action}
          {renderCloseButton()}
        </Box>
      );
    }

    // If only close button, return it
    if (closeable) {
      return renderCloseButton();
    }

    // If only custom action, return it
    return action ?? null;
  };

  return (
    <Collapse in={open} timeout={300} unmountOnExit>
      <MuiAlert
        data-testid={dataTestId ?? `alert-${severity}`}
        severity={severity}
        variant={variant}
        icon={icon}
        action={getActionContent()}
        role="alert"
        aria-live={getAriaLive()}
        className={className}
        sx={{
          marginBottom: 2,
          width: '100%',
          alignItems: 'flex-start',
          ...sx,
        }}
      >
        {title && <AlertTitle>{title}</AlertTitle>}
        {typeof message === 'string' ? <Box component="span">{message}</Box> : message}
      </MuiAlert>
    </Collapse>
  );
}

// Set display name for better debugging in React DevTools
Alert.displayName = 'Alert';

export default Alert;
