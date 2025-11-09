/**
 * Custom React hook for managing toast notifications
 *
 * Provides a flexible toast notification system with queue management,
 * auto-dismissal, and support for different notification types.
 * Integrates with Material-UI Snackbar components for consistent styling.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { success, error, warning, info, toasts, dismiss } = useToast();
 *
 *   const handleSave = async () => {
 *     try {
 *       await saveData();
 *       success('Data saved successfully!');
 *     } catch (err) {
 *       error('Failed to save data. Please try again.');
 *     }
 *   };
 *
 *   const handleUndo = () => {
 *     info('Action undone', {
 *       duration: 3000,
 *       action: {
 *         label: 'Redo',
 *         onClick: () => console.log('Redo clicked')
 *       }
 *     });
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleSave}>Save</button>
 *       <ToastContainer toasts={toasts} onDismiss={dismiss} />
 *     </>
 *   );
 * }
 * ```
 *
 * @module hooks/useToast
 */

import { useState, useCallback } from 'react';

/**
 * Toast notification type
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Action button configuration for toast notifications
 */
export interface ToastAction {
  /** Label text for the action button */
  label: string;
  /** Callback function when action button is clicked */
  onClick: () => void;
}

/**
 * Toast notification object
 */
export interface Toast {
  /** Unique identifier for the toast */
  id: string;
  /** Message content to display */
  message: string;
  /** Type of toast notification */
  type: ToastType;
  /** Duration in milliseconds before auto-dismiss (default: 5000) */
  duration?: number;
  /** Optional action button configuration */
  action?: ToastAction;
}

/**
 * Options for customizing toast behavior
 */
export interface ToastOptions {
  /** Duration in milliseconds before auto-dismiss (default: 5000) */
  duration?: number;
  /** Optional action button configuration */
  action?: ToastAction;
}

/**
 * Return type for the useToast hook
 */
export interface UseToastReturn {
  /** Array of current toast notifications */
  toasts: Toast[];
  /** Show a toast with specified type */
  showToast: (message: string, type: ToastType, options?: ToastOptions) => string;
  /** Show a success toast */
  success: (message: string, options?: ToastOptions) => string;
  /** Show an error toast */
  error: (message: string, options?: ToastOptions) => string;
  /** Show a warning toast */
  warning: (message: string, options?: ToastOptions) => string;
  /** Show an info toast */
  info: (message: string, options?: ToastOptions) => string;
  /** Dismiss a specific toast by ID */
  dismiss: (id: string) => void;
  /** Clear all toasts */
  clear: () => void;
}

/**
 * Custom hook for managing toast notifications
 *
 * Provides a complete toast notification system with:
 * - Multiple notification types (success, error, warning, info)
 * - Auto-dismissal with configurable duration (default 5000ms)
 * - Manual dismissal of individual toasts
 * - Queue management for multiple simultaneous toasts
 * - Optional action buttons for interactive toasts
 *
 * Note: This hook manages state only. Rendering is handled by a separate
 * ToastContainer component that should consume the toasts array and dismiss function.
 *
 * @returns {UseToastReturn} Toast management functions and current toasts
 *
 * @example
 * ```tsx
 * const { success, error, toasts, dismiss } = useToast();
 *
 * // Show success notification
 * success('Operation completed successfully!');
 *
 * // Show error with custom duration
 * error('Something went wrong', { duration: 10000 });
 *
 * // Show info with action button
 * info('File uploaded', {
 *   action: {
 *     label: 'View',
 *     onClick: () => navigate('/files')
 *   }
 * });
 *
 * // Manual dismissal
 * const toastId = warning('Please review');
 * setTimeout(() => dismiss(toastId), 2000);
 * ```
 */
export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  /**
   * Show a toast notification with specified type
   *
   * Creates a new toast with a unique ID and adds it to the queue.
   * Sets up auto-dismissal after the specified duration.
   *
   * @param message - The message to display in the toast
   * @param type - The type of toast (success, error, warning, info)
   * @param options - Optional configuration for duration and action button
   * @returns The unique ID of the created toast
   */
  const showToast = useCallback(
    (message: string, type: ToastType, options?: ToastOptions): string => {
      // Generate unique ID using timestamp and random number
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Default duration is 5000ms (5 seconds)
      const duration = options?.duration ?? 5000;

      // Create toast object
      const newToast: Toast = {
        id,
        message,
        type,
        duration,
        action: options?.action,
      };

      // Add toast to the queue
      setToasts((prev) => [...prev, newToast]);

      // Set up auto-dismissal only if duration > 0
      // duration === 0 means manual dismiss only
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, duration);
      }

      return id;
    },
    []
  );

  /**
   * Show a success toast notification
   *
   * Convenience method for showing success messages with green styling.
   * Typically used for successful operations like save, delete, or update.
   *
   * @param message - The success message to display
   * @param options - Optional configuration for duration and action button
   * @returns The unique ID of the created toast
   *
   * @example
   * success('Course saved successfully!');
   * success('File uploaded', { duration: 3000 });
   */
  const success = useCallback(
    (message: string, options?: ToastOptions): string => {
      return showToast(message, 'success', options);
    },
    [showToast]
  );

  /**
   * Show an error toast notification
   *
   * Convenience method for showing error messages with red styling.
   * Typically used for failed operations, validation errors, or exceptions.
   *
   * @param message - The error message to display
   * @param options - Optional configuration for duration and action button
   * @returns The unique ID of the created toast
   *
   * @example
   * error('Failed to save course. Please try again.');
   * error('Network error', { duration: 8000 });
   */
  const error = useCallback(
    (message: string, options?: ToastOptions): string => {
      return showToast(message, 'error', options);
    },
    [showToast]
  );

  /**
   * Show a warning toast notification
   *
   * Convenience method for showing warning messages with orange/yellow styling.
   * Typically used for non-critical issues or important notices.
   *
   * @param message - The warning message to display
   * @param options - Optional configuration for duration and action button
   * @returns The unique ID of the created toast
   *
   * @example
   * warning('Your session will expire in 5 minutes');
   * warning('Unsaved changes', { duration: 6000 });
   */
  const warning = useCallback(
    (message: string, options?: ToastOptions): string => {
      return showToast(message, 'warning', options);
    },
    [showToast]
  );

  /**
   * Show an info toast notification
   *
   * Convenience method for showing informational messages with blue styling.
   * Typically used for general information, tips, or status updates.
   *
   * @param message - The info message to display
   * @param options - Optional configuration for duration and action button
   * @returns The unique ID of the created toast
   *
   * @example
   * info('New features available!');
   * info('Processing your request...', { duration: 2000 });
   */
  const info = useCallback(
    (message: string, options?: ToastOptions): string => {
      return showToast(message, 'info', options);
    },
    [showToast]
  );

  /**
   * Dismiss a specific toast notification by ID
   *
   * Removes the toast with the specified ID from the queue immediately.
   * Can be used to manually dismiss a toast before its auto-dismiss timeout.
   *
   * @param id - The unique ID of the toast to dismiss
   *
   * @example
   * const toastId = info('Processing...');
   * // Later, when done:
   * dismiss(toastId);
   */
  const dismiss = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Clear all toast notifications
   *
   * Removes all toasts from the queue immediately.
   * Useful for cleanup on component unmount or route changes.
   *
   * @example
   * // Clear all toasts when navigating away
   * useEffect(() => {
   *   return () => clear();
   * }, []);
   */
  const clear = useCallback((): void => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    success,
    error,
    warning,
    info,
    dismiss,
    clear,
  };
}
