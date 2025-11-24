/**
 * Modal Component
 *
 * A flexible modal dialog component for displaying overlays, confirmations, and forms.
 * Built on Material-UI Dialog with comprehensive support for various modal patterns
 * used throughout the Moodle React frontend.
 *
 * Features:
 * - Configurable sizes (xs, sm, md, lg, xl, fullScreen)
 * - Primary/cancel action button patterns
 * - Loading states with spinner overlay
 * - Close button, backdrop click, and escape key handling
 * - Dividers between title, content, and actions
 * - Full accessibility support (WCAG 2.1 AA compliant)
 * - TypeScript strict mode with explicit prop interfaces
 *
 * Common Use Cases:
 * - Delete confirmations (courses, users, content)
 * - Form submissions (create/edit dialogs)
 * - Detailed views (assignment details, user info)
 * - Multi-step wizards (enrollment, course creation)
 * - Alert/warning messages
 *
 * Usage Examples:
 *
 * Simple Confirmation:
 * ```tsx
 * const { open, openModal, closeModal } = useModal();
 * <Modal
 *   open={open}
 *   onClose={closeModal}
 *   title="Delete Course?"
 *   actions={[
 *     { label: 'Cancel', onClick: closeModal },
 *     { label: 'Delete', onClick: handleDelete, color: 'error' }
 *   ]}
 * >
 *   <DialogContentText>
 *     Are you sure you want to delete this course?
 *   </DialogContentText>
 * </Modal>
 * ```
 *
 * Form Dialog:
 * ```tsx
 * const { open, loading, openModal, closeModal, setLoading } = useModal();
 * <Modal
 *   open={open}
 *   onClose={closeModal}
 *   title="Create New Course"
 *   maxWidth="md"
 *   loading={loading}
 *   actions={[
 *     { label: 'Cancel', onClick: closeModal, disabled: loading },
 *     { label: 'Create', onClick: handleCreate, color: 'primary', disabled: loading }
 *   ]}
 * >
 *   <CourseForm onSubmit={handleSubmit} />
 * </Modal>
 * ```
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useState, useCallback, type ReactNode } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  IconButton,
  Divider,
  Box,
  type DialogProps,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * Dialog size type
 * Maps to Material-UI Dialog maxWidth prop values
 */
export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;

/**
 * Action button color variants
 * Determines the visual prominence and semantic meaning of action buttons
 */
export type ActionColor = 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';

/**
 * Action button variant styles
 * Controls the fill and border styling of action buttons
 */
export type ActionVariant = 'text' | 'outlined' | 'contained';

/**
 * Configuration for a modal action button
 * Provides flexible definition of button behavior and appearance
 */
export interface ModalAction {
  /**
   * Button label text
   */
  label: string;

  /**
   * Click handler function
   */
  onClick: () => void;

  /**
   * Button color variant
   * @default 'primary'
   */
  color?: ActionColor;

  /**
   * Button style variant
   * @default 'text' for non-primary actions, 'contained' for primary
   */
  variant?: ActionVariant;

  /**
   * Whether the button is disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Whether this is a loading button
   * Shows loading spinner when true
   * @default false
   */
  loading?: boolean;

  /**
   * Whether to autofocus this button
   * @default false
   */
  autoFocus?: boolean;
}

/**
 * Props interface for the Modal component
 * Comprehensive configuration for all modal dialog patterns
 */
export interface ModalProps {
  /**
   * Whether the modal is open
   * @required
   */
  open: boolean;

  /**
   * Callback fired when the modal should close
   * Called on backdrop click, escape key, or close button
   * @required
   */
  onClose: () => void;

  /**
   * Modal title
   * Can be a string or custom React element
   */
  title?: string | ReactNode;

  /**
   * Modal content
   * Main body of the dialog - forms, text, custom components
   */
  children?: ReactNode;

  /**
   * Action buttons configuration
   * Can be custom React element or array of action configs
   */
  actions?: ReactNode | ModalAction[];

  /**
   * Maximum width of the dialog
   * @default 'sm'
   */
  maxWidth?: ModalSize;

  /**
   * Whether the dialog stretches to maxWidth
   * @default true
   */
  fullWidth?: boolean;

  /**
   * Whether the dialog is full-screen
   * Useful for mobile or complex forms
   * @default false
   */
  fullScreen?: boolean;

  /**
   * Disable closing on backdrop click
   * Use for critical confirmations or unsaved changes
   * @default false
   */
  disableBackdropClick?: boolean;

  /**
   * Disable closing with escape key
   * Use for critical confirmations or unsaved changes
   * @default false
   */
  disableEscapeKeyDown?: boolean;

  /**
   * Show close button in title
   * @default true
   */
  showCloseButton?: boolean;

  /**
   * Loading state - shows overlay spinner
   * Useful for async operations (form submissions, data fetching)
   * @default false
   */
  loading?: boolean;

  /**
   * Show dividers between title, content, and actions
   * @default true
   */
  dividers?: boolean;

  /**
   * Optional description text
   * Displayed at the top of content area
   */
  description?: string | ReactNode;

  /**
   * Aria label for the dialog
   * Used for accessibility when title is not a string
   */
  ariaLabelledBy?: string;

  /**
   * Aria description for the dialog
   * Used for accessibility
   */
  ariaDescribedBy?: string;

  /**
   * Additional className for custom styling
   */
  className?: string;

  /**
   * Custom styles for dialog paper
   */
  PaperProps?: DialogProps['PaperProps'];
}

/**
 * Modal Component
 *
 * A comprehensive modal dialog component supporting all common patterns:
 * - Confirmations (delete, logout, unenroll)
 * - Forms (create course, edit user, settings)
 * - Detailed views (assignment details, submission review)
 * - Multi-step processes (enrollment wizard, bulk operations)
 *
 * Accessibility:
 * - Focus trap within dialog
 * - Escape key to close (configurable)
 * - aria-labelledby for title
 * - aria-describedby for description
 * - Keyboard navigation for all actions
 *
 * @param props - Modal configuration props
 * @returns Modal dialog component
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
  fullScreen = false,
  disableBackdropClick = false,
  disableEscapeKeyDown = false,
  showCloseButton = true,
  loading = false,
  dividers = true,
  description,
  ariaLabelledBy,
  ariaDescribedBy,
  className,
  PaperProps,
}: ModalProps): JSX.Element {
  /**
   * Handle dialog close event
   * Prevents closing if backdrop click or escape key is disabled
   */
  const handleClose = useCallback(
    (_event: object, reason: 'backdropClick' | 'escapeKeyDown') => {
      // Prevent close on backdrop click if disabled
      if (reason === 'backdropClick' && disableBackdropClick) {
        return;
      }

      // Prevent close on escape key if disabled
      if (reason === 'escapeKeyDown' && disableEscapeKeyDown) {
        return;
      }

      onClose();
    },
    [onClose, disableBackdropClick, disableEscapeKeyDown]
  );

  /**
   * Render action buttons from configuration
   * Supports both custom ReactNode and array of action configs
   */
  const renderActions = (): ReactNode => {
    // If actions is a ReactNode, render it directly
    if (React.isValidElement(actions)) {
      return actions;
    }

    // If actions is an array of configs, render buttons
    if (Array.isArray(actions)) {
      return actions.map((action, index) => (
        <Button
          key={action.label}
          onClick={action.onClick}
          color={action.color ?? 'primary'}
          variant={action.variant ?? (index === actions.length - 1 ? 'contained' : 'text')}
          disabled={action.disabled ?? loading}
          // AutoFocus is intentionally supported for modal primary actions to improve keyboard navigation
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={action.autoFocus}
          sx={{ minWidth: 80 }}
        >
          {action.label}
        </Button>
      ));
    }

    return null;
  };

  /**
   * Generate unique IDs for accessibility attributes
   */
  const titleId = ariaLabelledBy ?? 'modal-title';
  const descriptionId = ariaDescribedBy ?? 'modal-description';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      fullScreen={fullScreen}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={className}
      PaperProps={{
        ...PaperProps,
        'aria-modal': 'true'
      }}
      BackdropProps={{
        sx: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
        ...({ 'data-testid': 'modal-backdrop' } as Record<string, unknown>),
      }}
      // Ensure focus trap and keyboard navigation
      disableEscapeKeyDown={disableEscapeKeyDown}
    >
      {/* Dialog Title with optional close button */}
      {title && (
        <>
          <DialogTitle
            id={titleId}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pr: showCloseButton ? 1 : 3,
            }}
          >
            <Box component="span" sx={{ flex: 1 }}>
              {title}
            </Box>
            {showCloseButton && (
              <IconButton
                edge="end"
                color="inherit"
                onClick={onClose}
                aria-label="Close dialog"
                disabled={loading}
                sx={{ ml: 1 }}
              >
                <CloseIcon />
              </IconButton>
            )}
          </DialogTitle>
          {dividers && <Divider />}
        </>
      )}

      {/* Dialog Content */}
      <DialogContent
        dividers={dividers}
        sx={{ position: 'relative', minHeight: '100px' }}
      >
        {/* Optional description text */}
        {description && (
          <DialogContentText id={descriptionId} sx={{ mb: 2 }}>
            {description}
          </DialogContentText>
        )}

        {/* Main content */}
        {children}

        {/* Loading overlay */}
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              zIndex: 1,
            }}
          >
            <LoadingSpinner
              size="large"
              message="Processing..."
              ariaLabel="Processing request"
            />
          </Box>
        )}
      </DialogContent>

      {/* Dialog Actions */}
      {actions && (
        <>
          {dividers && <Divider />}
          <DialogActions
            sx={{
              px: 3,
              py: 2,
              gap: 1,
            }}
          >
            {renderActions()}
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

/**
 * Return type for the useModal hook
 * Provides state and control functions for modal management
 */
export interface UseModalReturn {
  /**
   * Whether the modal is currently open
   */
  open: boolean;

  /**
   * Whether the modal is in loading state
   */
  loading: boolean;

  /**
   * Function to open the modal
   */
  openModal: () => void;

  /**
   * Function to close the modal
   */
  closeModal: () => void;

  /**
   * Function to set loading state
   */
  setLoading: (loading: boolean) => void;
}

/**
 * useModal Hook
 *
 * Custom hook for managing modal state and behavior.
 * Provides convenient state management for common modal patterns.
 *
 * Features:
 * - Open/close state management
 * - Loading state for async operations
 * - Clean API for modal control
 *
 * Usage:
 * ```tsx
 * const { open, loading, openModal, closeModal, setLoading } = useModal();
 *
 * const handleDelete = async () => {
 *   setLoading(true);
 *   try {
 *     await deleteCourse(courseId);
 *     closeModal();
 *     showSuccessToast('Course deleted');
 *   } catch (error) {
 *     showErrorToast('Failed to delete course');
 *   } finally {
 *     setLoading(false);
 *   }
 * };
 *
 * return (
 *   <>
 *     <Button onClick={openModal}>Delete Course</Button>
 *     <Modal
 *       open={open}
 *       onClose={closeModal}
 *       loading={loading}
 *       title="Delete Course?"
 *       actions={[
 *         { label: 'Cancel', onClick: closeModal },
 *         { label: 'Delete', onClick: handleDelete, color: 'error' }
 *       ]}
 *     >
 *       This action cannot be undone.
 *     </Modal>
 *   </>
 * );
 * ```
 *
 * Integration with React Query:
 * ```tsx
 * const { open, loading, openModal, closeModal, setLoading } = useModal();
 * const deleteMutation = useMutation({
 *   mutationFn: deleteCourse,
 *   onSuccess: () => {
 *     closeModal();
 *     queryClient.invalidateQueries(['courses']);
 *   }
 * });
 *
 * const handleDelete = () => {
 *   deleteMutation.mutate(courseId);
 * };
 *
 * // Use mutation loading state
 * <Modal loading={deleteMutation.isPending} ... />
 * ```
 *
 * @returns Object with modal state and control functions
 * 
 * This hook is part of the Modal component's public API, allowing consumers to manage modal state.
 * Exporting hooks alongside components is intentional for utility purposes.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useModal = (): UseModalReturn => {
  // Modal open state
  const [open, setOpen] = useState<boolean>(false);

  // Modal loading state for async operations
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Open the modal
   * Resets loading state when opening
   */
  const openModal = useCallback(() => {
    setOpen(true);
    setLoading(false);
  }, []);

  /**
   * Close the modal
   * Resets loading state when closing
   */
  const closeModal = useCallback(() => {
    setOpen(false);
    setLoading(false);
  }, []);

  /**
   * Set loading state
   * Useful for async operations within the modal
   */
  const setLoadingState = useCallback((isLoading: boolean) => {
    setLoading(isLoading);
  }, []);

  return {
    open,
    loading,
    openModal,
    closeModal,
    setLoading: setLoadingState,
  };
};
