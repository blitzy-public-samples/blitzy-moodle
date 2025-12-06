/**
 * LogoutButton Component
 *
 * Material-UI Button component that handles user logout functionality.
 * Provides a complete logout experience with confirmation dialog support,
 * loading states, error handling, and proper accessibility.
 *
 * This component integrates with:
 * - useAuth hook for logout mutation and auth state management
 * - useToast hook for error notifications
 * - React Router for navigation after logout
 * - React Query for cache invalidation
 *
 * Features:
 * - Optional confirmation dialog before logout (configurable)
 * - Loading spinner during logout process
 * - Error toast notification on failure
 * - Redirect to login page after successful logout
 * - Full keyboard accessibility (Enter, Space, Escape)
 * - WCAG 2.1 AA compliant with proper ARIA labels
 * - Light/dark mode support via MUI theme
 * - TypeScript strict mode with explicit prop interfaces
 *
 * Based on: public/login/logout.php
 * - Preserves sesskey validation equivalent (handled via JWT on backend)
 * - Maintains authentication plugin hooks (called via API)
 * - Implements require_logout() equivalent via API endpoint
 *
 * @module features/auth/components/LogoutButton
 * @see public/login/logout.php - Original PHP logout implementation
 * @see features/auth/hooks/useAuth - Authentication hook
 * @see hooks/useToast - Toast notification hook
 */

import React, { useState, useCallback } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { Logout as LogoutIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for the LogoutButton component
 *
 * Extends Material-UI Button styling props with logout-specific configuration.
 * All props are optional with sensible defaults.
 */
export interface LogoutButtonProps {
  /**
   * Button variant style
   * @default 'text'
   */
  variant?: 'text' | 'contained' | 'outlined';

  /**
   * Button color theme
   * @default 'inherit'
   */
  color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';

  /**
   * Button size
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Whether button should take full width of container
   * @default false
   */
  fullWidth?: boolean;

  /**
   * Whether to show confirmation dialog before logout
   *
   * When true, displays a dialog asking user to confirm logout action.
   * Equivalent to the sesskey confirmation in PHP version.
   * @default false
   */
  showConfirmDialog?: boolean;

  /**
   * Custom confirmation message for the dialog
   *
   * Only used when showConfirmDialog is true.
   * @default 'Are you sure you want to log out?'
   */
  confirmMessage?: string;

  /**
   * Callback function invoked after successful logout
   *
   * Called after auth state is cleared but before navigation.
   * Useful for cleanup operations or analytics tracking.
   */
  onLogoutSuccess?: () => void;

  /**
   * Callback function invoked when logout fails
   *
   * Called with the error when the logout API call fails.
   * Note: Local auth state is still cleared even on API failure (fail-safe).
   *
   * @param error - The error object from the failed logout attempt
   */
  onLogoutError?: (error: Error) => void;

  /**
   * Whether the button is disabled
   * @default false
   */
  disabled?: boolean;
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * LogoutButton - Handles user logout with Material-UI styling
 *
 * Renders a button that, when clicked, initiates the logout process:
 * 1. Optionally shows confirmation dialog (if showConfirmDialog is true)
 * 2. Calls logout API endpoint with JWT token
 * 3. Clears JWT tokens from storage
 * 4. Clears Redux auth state
 * 5. Invalidates React Query cache
 * 6. Redirects to login page
 *
 * Handles errors gracefully by showing toast notification while still
 * clearing local auth state to ensure user is logged out locally.
 *
 * @param props - Component props (see LogoutButtonProps)
 * @returns React component
 *
 * @example
 * // Basic usage
 * <LogoutButton />
 *
 * @example
 * // With confirmation dialog
 * <LogoutButton showConfirmDialog confirmMessage="Are you sure?" />
 *
 * @example
 * // With custom styling and callbacks
 * <LogoutButton
 *   variant="contained"
 *   color="error"
 *   size="large"
 *   onLogoutSuccess={() => console.log('Logged out!')}
 *   onLogoutError={(err) => console.error('Logout failed:', err)}
 * />
 */
function LogoutButton({
  variant = 'text',
  color = 'inherit',
  size = 'medium',
  fullWidth = false,
  showConfirmDialog = false,
  confirmMessage = 'Are you sure you want to log out?',
  onLogoutSuccess,
  onLogoutError,
  disabled = false,
}: LogoutButtonProps): React.ReactElement {
  // ============================================================================
  // Hooks
  // ============================================================================

  // Navigation for redirect after logout
  const navigate = useNavigate();

  // Query client for additional cache management
  const queryClient = useQueryClient();

  // Authentication hook - provides logout mutation and loading state
  // Using isLoading from the auth hook which reflects isLogoutLoading during logout
  const { logout, isLoading } = useAuth();

  // Toast notifications for error feedback
  const { error: showErrorToast } = useToast();

  // ============================================================================
  // Local State
  // ============================================================================

  // Confirmation dialog open state
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  // Track if we're in the process of logging out (for UI state)
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Execute the logout process
   *
   * Calls the logout API endpoint which:
   * - Blacklists JWT token on server (Redis)
   * - Calls Moodle's require_logout() function
   * - Triggers auth plugin logout hooks
   *
   * On success:
   * - Clears tokens from localStorage (handled by useAuth)
   * - Clears Redux auth state (handled by useAuth)
   * - Invalidates React Query cache (partially handled by useAuth, we do additional cleanup)
   * - Calls onLogoutSuccess callback if provided
   * - Redirects to login page
   *
   * On failure:
   * - Shows error toast notification
   * - Calls onLogoutError callback if provided
   * - Still clears local auth state (fail-safe behavior from useAuth)
   * - Still redirects to login page
   */
  const executeLogout = useCallback(async (): Promise<void> => {
    setIsLoggingOut(true);

    try {
      // Call logout which handles:
      // - POST /api/v1/auth/logout with JWT in Authorization header
      // - Clearing tokens from localStorage
      // - Dispatching Redux action to clear auth state
      // - Removing current user from React Query cache
      await logout();

      // Additional cache invalidation - clear ALL cached queries
      // This ensures no stale data remains from the previous user session
      // This is critical for security - next user shouldn't see previous user's data
      queryClient.clear();

      // Call success callback if provided
      if (onLogoutSuccess) {
        onLogoutSuccess();
      }

      // Navigate to login page
      // Using replace: true to prevent user from navigating back to authenticated pages
      navigate('/login', { replace: true });
    } catch (err) {
      // Even though logout failed on the server, useAuth has already
      // cleared local state (fail-safe behavior). Show error to user.
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to log out. Please try again.';

      showErrorToast(errorMessage);

      // Call error callback if provided
      if (onLogoutError) {
        onLogoutError(err instanceof Error ? err : new Error(errorMessage));
      }

      // Still navigate to login since local auth state is cleared
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  }, [logout, queryClient, navigate, onLogoutSuccess, onLogoutError, showErrorToast]);

  /**
   * Handle button click
   *
   * If showConfirmDialog is true, opens confirmation dialog.
   * Otherwise, directly executes logout.
   */
  const handleButtonClick = useCallback((): void => {
    if (showConfirmDialog) {
      setIsDialogOpen(true);
    } else {
      void executeLogout();
    }
  }, [showConfirmDialog, executeLogout]);

  /**
   * Handle dialog confirm (user clicked "Log out" in dialog)
   */
  const handleDialogConfirm = useCallback((): void => {
    setIsDialogOpen(false);
    void executeLogout();
  }, [executeLogout]);

  /**
   * Handle dialog cancel (user clicked "Cancel" or pressed Escape)
   */
  const handleDialogCancel = useCallback((): void => {
    setIsDialogOpen(false);
  }, []);

  /**
   * Handle keyboard events for accessibility
   *
   * Implements keyboard navigation for the logout button:
   * - Enter: Trigger logout (or open dialog)
   * - Space: Trigger logout (or open dialog)
   *
   * Note: Dialog keyboard handling is provided by MUI Dialog component
   * which handles Escape to close, Tab navigation, and focus trapping.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>): void => {
      // Enter and Space are standard button activation keys
      // These are already handled by <button> element, but we include
      // explicit handling for custom implementations or edge cases
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleButtonClick();
      }
    },
    [handleButtonClick]
  );

  // ============================================================================
  // Computed Values
  // ============================================================================

  // Determine if button should be in loading state
  // Show loading when either the auth hook is loading or we're in logout process
  const showLoading = isLoading || isLoggingOut;

  // Determine if button should be disabled
  // Disabled when explicitly disabled, loading, or auth has error
  const isButtonDisabled = disabled || showLoading;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <>
      {/* Logout Button */}
      <Button
        variant={variant}
        color={color}
        size={size}
        fullWidth={fullWidth}
        disabled={isButtonDisabled}
        onClick={handleButtonClick}
        onKeyDown={handleKeyDown}
        startIcon={
          showLoading ? (
            <CircularProgress
              size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
              color="inherit"
              aria-hidden="true"
            />
          ) : (
            <LogoutIcon aria-hidden="true" />
          )
        }
        aria-label={showLoading ? 'Logging out...' : 'Log out'}
        aria-busy={showLoading}
        aria-describedby={
          showConfirmDialog ? 'logout-dialog-description' : undefined
        }
      >
        {showLoading ? 'Logging out...' : 'Log out'}
      </Button>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <Dialog
          open={isDialogOpen}
          onClose={handleDialogCancel}
          aria-labelledby="logout-dialog-title"
          aria-describedby="logout-dialog-description"
          // Ensure focus returns to the logout button when dialog closes
          disableRestoreFocus={false}
          // Keep dialog mounted for smoother open/close animations
          keepMounted
        >
          <DialogTitle id="logout-dialog-title">
            Confirm Logout
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="logout-dialog-description">
              {confirmMessage}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={handleDialogCancel}
              color="inherit"
              autoFocus
              aria-label="Cancel logout"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDialogConfirm}
              color="error"
              variant="contained"
              disabled={showLoading}
              startIcon={
                showLoading ? (
                  <CircularProgress size={16} color="inherit" aria-hidden="true" />
                ) : undefined
              }
              aria-label="Confirm logout"
            >
              {showLoading ? 'Logging out...' : 'Log out'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default LogoutButton;
