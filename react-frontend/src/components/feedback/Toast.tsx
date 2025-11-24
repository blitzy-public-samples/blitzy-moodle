/* eslint-disable react-refresh/only-export-components */
import type { ReactNode, SyntheticEvent } from 'react';
import { useState, useEffect } from 'react';
import type { SlideProps } from '@mui/material';
import { Snackbar, Alert, Slide } from '@mui/material';

/**
 * Toast notification severity levels matching Moodle notification types
 * Maps to core\notification constants: SUCCESS, INFO, WARNING, ERROR
 */
export type ToastSeverity = 'success' | 'info' | 'warning' | 'error';

/**
 * Visual variant for the toast Alert component
 * Controls the styling presentation of the alert
 */
export type ToastVariant = 'standard' | 'filled' | 'outlined';

/**
 * Position configuration for toast placement on screen
 * Determines both horizontal and vertical anchoring
 */
export interface ToastPosition {
  /** Horizontal alignment: left, center, or right */
  horizontal: 'left' | 'center' | 'right';
  /** Vertical alignment: top or bottom */
  vertical: 'top' | 'bottom';
}

/**
 * Props for the Toast component
 */
export interface ToastProps {
  /** Controls toast visibility */
  open: boolean;
  /** Message content (string or React element for rich content) */
  message: string | ReactNode;
  /** Severity level determining color scheme and icon */
  severity: ToastSeverity;
  /** Auto-hide duration in milliseconds (default: 6000ms / 6 seconds). Set to null to disable auto-hide. */
  autoHideDuration?: number | null;
  /** Callback fired when toast should close */
  onClose: () => void;
  /** Screen position for toast (default: top-right) */
  position?: ToastPosition;
  /** Optional action buttons (e.g., Undo, Retry) rendered alongside close button */
  action?: ReactNode;
  /** Visual style variant (default: filled for maximum visibility) */
  variant?: ToastVariant;
}

/**
 * Return type for useToast hook
 * Provides state and control functions for managing toast lifecycle
 */
export interface UseToastReturn {
  /** Current visibility state */
  open: boolean;
  /** Current message content */
  message: string | ReactNode;
  /** Current severity level */
  severity: ToastSeverity;
  /** Function to display a toast notification */
  showToast: (message: string | ReactNode, severity?: ToastSeverity) => void;
  /** Function to hide the current toast notification */
  hideToast: () => void;
}

/**
 * Toast notification component for displaying temporary, auto-dismissing messages.
 *
 * Uses Material-UI Snackbar with Alert for consistent styling and accessibility.
 * Supports Moodle's four severity levels (success, info, warning, error),
 * custom duration, screen positioning, and optional action buttons.
 *
 * Features:
 * - Auto-dismissing after configurable duration (default 6 seconds)
 * - Slide animation based on position (top slides down, bottom slides up)
 * - WCAG 2.1 AA compliant with proper ARIA roles
 * - Prevents accidental dismissal via clickaway
 * - Integrated close button
 * - Optional action buttons for user interactions (Undo, Retry, etc.)
 * - Full TypeScript type safety in strict mode
 *
 * @example Basic usage
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <Toast
 *   open={open}
 *   message="Course saved successfully"
 *   severity="success"
 *   onClose={() => setOpen(false)}
 * />
 * ```
 *
 * @example With custom position and duration
 * ```tsx
 * <Toast
 *   open={open}
 *   message="Settings updated"
 *   severity="info"
 *   autoHideDuration={3000}
 *   position={{ horizontal: 'center', vertical: 'bottom' }}
 *   onClose={handleClose}
 * />
 * ```
 *
 * @example With action button
 * ```tsx
 * <Toast
 *   open={open}
 *   message="Assignment deleted"
 *   severity="info"
 *   onClose={handleClose}
 *   action={
 *     <Button color="inherit" size="small" onClick={handleUndo}>
 *       UNDO
 *     </Button>
 *   }
 * />
 * ```
 *
 * @example With React Query mutation
 * ```tsx
 * const mutation = useMutation({
 *   mutationFn: deleteCourse,
 *   onSuccess: () => {
 *     setOpen(true);
 *     setMessage('Course deleted successfully');
 *     setSeverity('success');
 *   },
 *   onError: () => {
 *     setOpen(true);
 *     setMessage('Failed to delete course');
 *     setSeverity('error');
 *   }
 * });
 * ```
 */
export function Toast({
  open,
  message,
  severity,
  autoHideDuration = 6000,
  onClose,
  position = { horizontal: 'right', vertical: 'top' },
  action,
  variant = 'filled',
}: ToastProps): JSX.Element {
  /**
   * Handle Snackbar close event
   * Prevents closing on clickaway to avoid accidental dismissal during operations.
   * This is critical during complex workflows (quiz attempts, grade editing, etc.)
   * where users might click outside the toast unintentionally.
   *
   * @param _event - The event that triggered the close (unused but required by Snackbar API)
   * @param reason - The reason for closing (timeout, clickaway, escapeKeyDown)
   */
  const handleClose = (_event?: SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    onClose();
  };

  /**
   * Determine slide animation direction based on vertical position
   * Top-positioned toasts slide down (entering from above)
   * Bottom-positioned toasts slide up (entering from below)
   * This creates natural, intuitive animations that match user expectations
   */
  const slideDirection: SlideProps['direction'] = position.vertical === 'top' ? 'down' : 'up';

  /**
   * Set ARIA role for accessibility (WCAG 2.1 AA compliance)
   * - 'alert' for urgent messages (warning/error) - assertive announcement by screen readers
   * - 'status' for informational messages (info/success) - polite announcement
   * This ensures assistive technologies properly convey message urgency
   */
  const accessibilityRole = severity === 'warning' || severity === 'error' ? 'alert' : 'status';

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={handleClose}
      anchorOrigin={position}
      TransitionComponent={Slide}
      TransitionProps={{ direction: slideDirection } as SlideProps}
    >
      <Alert
        severity={severity}
        variant={variant}
        onClose={onClose}
        action={action}
        role={accessibilityRole}
        sx={{ width: '100%' }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}

/**
 * Custom hook for managing toast notification state.
 *
 * Provides state management for a single toast instance with show/hide functions.
 * Handles message cleanup after toast closes to prevent stale content during animations.
 *
 * For multiple simultaneous toasts or global toast management across the application,
 * consider wrapping this in a ToastProvider context with queueing logic.
 *
 * Integration with React Query:
 * - Use in onSuccess/onError callbacks for automatic user feedback
 * - Pairs with mutation hooks for seamless operation notifications
 * - Provides consistent UX for all async operations
 *
 * @returns Object containing toast state and control functions
 *
 * @example Basic usage
 * ```tsx
 * const { open, message, severity, showToast, hideToast } = useToast();
 *
 * const handleSave = async () => {
 *   try {
 *     await saveCourse();
 *     showToast('Course saved successfully', 'success');
 *   } catch (error) {
 *     showToast('Failed to save course', 'error');
 *   }
 * };
 *
 * return (
 *   <>
 *     <Button onClick={handleSave}>Save</Button>
 *     <Toast
 *       open={open}
 *       message={message}
 *       severity={severity}
 *       onClose={hideToast}
 *     />
 *   </>
 * );
 * ```
 *
 * @example With React Query mutation
 * ```tsx
 * const { open, message, severity, showToast, hideToast } = useToast();
 *
 * const mutation = useMutation({
 *   mutationFn: createCourse,
 *   onSuccess: () => {
 *     showToast('Course created successfully', 'success');
 *     queryClient.invalidateQueries(['courses']);
 *   },
 *   onError: (error) => {
 *     showToast(`Failed to create course: ${error.message}`, 'error');
 *   },
 * });
 *
 * return (
 *   <>
 *     <Button
 *       onClick={() => mutation.mutate(courseData)}
 *       disabled={mutation.isLoading}
 *     >
 *       Create Course
 *     </Button>
 *     <Toast
 *       open={open}
 *       message={message}
 *       severity={severity}
 *       onClose={hideToast}
 *     />
 *   </>
 * );
 * ```
 *
 * @example With custom action button
 * ```tsx
 * const { open, message, severity, showToast, hideToast } = useToast();
 * const [deletedId, setDeletedId] = useState<number | null>(null);
 *
 * const handleDelete = (id: number) => {
 *   setDeletedId(id);
 *   deleteCourse(id);
 *   showToast('Course deleted', 'info');
 * };
 *
 * const handleUndo = () => {
 *   if (deletedId) {
 *     restoreCourse(deletedId);
 *     hideToast();
 *   }
 * };
 *
 * return (
 *   <Toast
 *     open={open}
 *     message={message}
 *     severity={severity}
 *     onClose={hideToast}
 *     action={
 *       <Button color="inherit" size="small" onClick={handleUndo}>
 *         UNDO
 *       </Button>
 *     }
 *   />
 * );
 * ```
 */
export const useToast = (): UseToastReturn => {
  const [open, setOpen] = useState<boolean>(false);
  const [message, setMessage] = useState<string | ReactNode>('');
  const [severity, setSeverity] = useState<ToastSeverity>('info');

  /**
   * Display a toast notification with specified message and severity
   *
   * @param msg - Message content (string or React element for rich formatting)
   * @param sev - Severity level (default: 'info')
   */
  const showToast = (msg: string | ReactNode, sev: ToastSeverity = 'info') => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  };

  /**
   * Hide the current toast notification
   * Triggers the exit animation and cleanup effect
   */
  const hideToast = () => {
    setOpen(false);
  };

  /**
   * Cleanup effect to reset message state after toast closes
   *
   * Waits 300ms after closing to allow exit animation to complete before clearing message.
   * This prevents the message content from disappearing mid-animation, which would cause
   * a jarring visual experience. The delay matches Material-UI's standard exit duration.
   */
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setMessage('');
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  return {
    open,
    message,
    severity,
    showToast,
    hideToast,
  };
};
