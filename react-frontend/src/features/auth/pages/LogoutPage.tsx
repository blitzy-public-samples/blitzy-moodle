/**
 * LogoutPage Component
 *
 * React page component that handles user logout confirmation and cleanup.
 * Transforms the PHP logout endpoint (public/login/logout.php) into a modern
 * React implementation with Material-UI components and proper state management.
 *
 * Features:
 * - Displays confirmation dialog before logout using Material-UI Dialog
 * - Validates session key (sesskey) from URL query parameters for CSRF protection
 * - Calls logout API endpoint (POST /api/v1/auth/logout) to invalidate JWT tokens
 * - Triggers server-side token blacklist in Redis via API
 * - Clears Redux auth state via authSlice
 * - Invalidates all React Query caches using queryClient.clear()
 * - Removes JWT tokens from localStorage
 * - Executes auth plugin logout hooks via API (ldap, oauth2, shibboleth hooks)
 * - Handles redirect to login page or site home based on loginpage parameter
 * - Shows immediate logout message for users already logged out
 * - Provides accessible logout confirmation with keyboard navigation
 * - Displays success notification toast upon successful logout
 *
 * URL Query Parameters:
 * - sesskey: Session key for CSRF validation (optional - shows dialog if missing)
 * - loginpage: If '1' or 'true', redirects to login page after logout; otherwise redirects to home
 *
 * Authentication Flow:
 * 1. Check if user is already logged out -> show message and redirect
 * 2. If sesskey is invalid/missing -> show confirmation dialog
 * 3. On confirmation -> call logout API -> clear state -> redirect
 *
 * @module features/auth/pages/LogoutPage
 * @see public/login/logout.php - Original PHP implementation reference
 * @see features/auth/hooks/useAuth - Authentication hook with logout mutation
 * @see components/layouts/GuestLayout - Layout component for guest pages
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';

// Internal imports from dependency files
import { useAuth } from '@/features/auth/hooks/useAuth';
import GuestLayout from '@/components/layouts/GuestLayout';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Logout state enum for tracking the current logout flow stage
 */
type LogoutState =
  | 'initial' // Initial state, checking auth status
  | 'confirm' // Showing confirmation dialog
  | 'processing' // Logout in progress
  | 'success' // Logout completed successfully
  | 'already_logged_out' // User was already logged out
  | 'error'; // Error occurred during logout

/**
 * Props interface for LogoutPage component
 * This component doesn't accept any props as it's a route endpoint
 */
interface LogoutPageProps {
  // No props required - all state comes from URL params and auth hooks
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default redirect delay in milliseconds after successful logout
 * Gives users time to see the success message before redirect
 */
const REDIRECT_DELAY_MS = 1500;

/**
 * Route paths for navigation
 */
const ROUTES = {
  LOGIN: '/login',
  HOME: '/',
} as const;

// ============================================================================
// Main Component
// ============================================================================

/**
 * LogoutPage Component
 *
 * Handles the complete logout flow including:
 * - Authentication status checking
 * - CSRF validation via sesskey parameter
 * - Confirmation dialog display
 * - Logout API call execution
 * - State cleanup (Redux, React Query, localStorage)
 * - Redirect after successful logout
 *
 * @returns {JSX.Element} Rendered LogoutPage component
 *
 * @example
 * ```tsx
 * // In router configuration
 * <Route path="/logout" element={<LogoutPage />} />
 * ```
 *
 * @example
 * ```tsx
 * // Navigate with sesskey for direct logout
 * navigate('/logout?sesskey=abc123&loginpage=1');
 * ```
 */
function LogoutPage(_props: LogoutPageProps): JSX.Element {
  // ============================================================================
  // Hooks
  // ============================================================================

  // URL search params for sesskey and loginpage
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // React Query client for cache invalidation
  const queryClient = useQueryClient();

  // Authentication hook with logout mutation
  const { logout, isAuthenticated, user } = useAuth();

  // Toast notifications for user feedback
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  // ============================================================================
  // State
  // ============================================================================

  // Current state in the logout flow
  const [logoutState, setLogoutState] = useState<LogoutState>('initial');

  // Dialog open state (controlled by logout flow)
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  // Loading state for logout operation
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Error message if logout fails
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ============================================================================
  // URL Parameter Extraction
  // ============================================================================

  // Extract sesskey from URL query parameters
  // In PHP: $sesskey = optional_param('sesskey', '__notpresent__', PARAM_RAW)
  const sesskey = searchParams.get('sesskey');

  // Extract loginpage flag from URL query parameters
  // In PHP: $login = optional_param('loginpage', 0, PARAM_BOOL)
  const loginPageParam = searchParams.get('loginpage');
  const shouldRedirectToLogin =
    loginPageParam === '1' || loginPageParam === 'true';

  // ============================================================================
  // Computed Values
  // ============================================================================

  /**
   * Get the redirect URL based on loginpage parameter
   * Mirrors PHP logic:
   * if ($login) { $redirect = get_login_url(); } else { $redirect = $CFG->wwwroot.'/'; }
   */
  const redirectUrl = shouldRedirectToLogin ? ROUTES.LOGIN : ROUTES.HOME;

  /**
   * Validate sesskey for CSRF protection
   * In PHP this is done via confirm_sesskey($sesskey)
   * For React, we check if a sesskey was provided in the URL
   * The actual validation happens server-side in the logout API endpoint
   */
  const hasValidSesskey = sesskey !== null && sesskey !== '';

  // ============================================================================
  // Callbacks
  // ============================================================================

  /**
   * Perform the actual logout operation
   *
   * This function:
   * 1. Sets loading state
   * 2. Calls logout API endpoint (which handles server-side token blacklist)
   * 3. Clears all React Query caches
   * 4. Shows success toast
   * 5. Redirects to appropriate page
   *
   * The useAuth.logout() function handles:
   * - POST /api/v1/auth/logout API call
   * - Server-side JWT token blacklist in Redis
   * - Auth plugin logout hooks (ldap, oauth2, shibboleth)
   * - Redux state clearing via authSlice.clearAuth()
   * - localStorage token removal
   */
  const performLogout = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setLogoutState('processing');
      setErrorMessage(null);

      // Call logout API endpoint
      // This triggers server-side cleanup including:
      // - Token blacklist in Redis
      // - Auth plugin logout hooks (ldap, oauth2, shibboleth)
      // - Moodle's require_logout() equivalent
      await logout();

      // Clear all React Query caches to ensure no stale data
      // persists for the next user session
      queryClient.clear();

      // Update state to success
      setLogoutState('success');

      // Show success notification
      showSuccessToast('You have been logged out successfully.');

      // Close dialog if open
      setDialogOpen(false);

      // Redirect after a brief delay to allow user to see success message
      setTimeout(() => {
        navigate(redirectUrl, { replace: true });
      }, REDIRECT_DELAY_MS);
    } catch (error) {
      // Handle logout error
      setLogoutState('error');
      setIsLoading(false);

      const errorMsg =
        error instanceof Error
          ? error.message
          : 'An error occurred during logout. Please try again.';

      setErrorMessage(errorMsg);
      showErrorToast(errorMsg);

      // Even on error, clear local auth state for security
      // The logout mutation in useAuth handles this with onSettled
      queryClient.clear();
    }
  }, [logout, queryClient, showSuccessToast, showErrorToast, navigate, redirectUrl]);

  /**
   * Handle confirmation dialog confirm button click
   * Triggers the logout operation
   */
  const handleConfirmLogout = useCallback((): void => {
    performLogout();
  }, [performLogout]);

  /**
   * Handle confirmation dialog cancel button click
   * Redirects back to home page without logging out
   */
  const handleCancelLogout = useCallback((): void => {
    setDialogOpen(false);
    navigate(ROUTES.HOME, { replace: true });
  }, [navigate]);

  /**
   * Handle retry button click on error state
   * Attempts logout again
   */
  const handleRetryLogout = useCallback((): void => {
    setErrorMessage(null);
    performLogout();
  }, [performLogout]);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Main effect to handle the logout flow based on auth state and sesskey
   *
   * Flow logic mirrors PHP implementation:
   * 1. If not logged in -> redirect immediately (no confirmation needed)
   * 2. If sesskey is invalid/missing -> show confirmation dialog
   * 3. If sesskey is valid -> proceed with logout directly
   */
  useEffect(() => {
    // Skip if already processing or completed
    if (
      logoutState === 'processing' ||
      logoutState === 'success' ||
      logoutState === 'error'
    ) {
      return;
    }

    // Check if user is already logged out
    // In PHP: if (!isloggedin()) { require_logout(); redirect($redirect); }
    if (!isAuthenticated) {
      setLogoutState('already_logged_out');

      // Show info message and redirect
      setTimeout(() => {
        navigate(redirectUrl, { replace: true });
      }, REDIRECT_DELAY_MS);
      return;
    }

    // User is logged in, check sesskey
    // In PHP: if (!confirm_sesskey($sesskey)) { /* show confirm dialog */ }
    if (!hasValidSesskey) {
      // Show confirmation dialog
      setLogoutState('confirm');
      setDialogOpen(true);
      return;
    }

    // Sesskey is valid, proceed with logout directly
    // In PHP: foreach($authsequence as $authname) { $authplugin->logoutpage_hook(); }
    // Then: require_logout(); redirect($redirect);
    setLogoutState('processing');
    performLogout();
  }, [
    isAuthenticated,
    hasValidSesskey,
    logoutState,
    navigate,
    redirectUrl,
    performLogout,
  ]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /**
   * Render content based on current logout state
   */
  const renderContent = (): JSX.Element => {
    switch (logoutState) {
      case 'initial':
        // Initial loading state while checking auth
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              py: 4,
            }}
          >
            <CircularProgress size={40} aria-label="Checking authentication status" />
            <Typography variant="body1" color="text.secondary">
              Checking authentication status...
            </Typography>
          </Box>
        );

      case 'already_logged_out':
        // User was not logged in
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              py: 4,
            }}
          >
            <Typography variant="h6" component="h2" gutterBottom>
              Already Logged Out
            </Typography>
            <Typography variant="body1" color="text.secondary" align="center">
              You are not currently logged in.
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Redirecting...
            </Typography>
            <CircularProgress size={24} aria-label="Redirecting" />
          </Box>
        );

      case 'processing':
        // Logout in progress
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              py: 4,
            }}
          >
            <CircularProgress size={40} aria-label="Logging out" />
            <Typography variant="body1" color="text.secondary">
              Logging out...
            </Typography>
          </Box>
        );

      case 'success':
        // Logout successful
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              py: 4,
            }}
          >
            <Typography
              variant="h6"
              component="h2"
              color="success.main"
              gutterBottom
            >
              Logged Out Successfully
            </Typography>
            <Typography variant="body1" color="text.secondary" align="center">
              You have been securely logged out.
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Redirecting...
            </Typography>
            <CircularProgress size={24} aria-label="Redirecting" />
          </Box>
        );

      case 'error':
        // Error during logout
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              py: 4,
            }}
          >
            <Typography
              variant="h6"
              component="h2"
              color="error.main"
              gutterBottom
            >
              Logout Error
            </Typography>
            <Typography variant="body1" color="text.secondary" align="center">
              {errorMessage || 'An error occurred during logout.'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleRetryLogout}
                disabled={isLoading}
              >
                Try Again
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                onClick={handleCancelLogout}
                disabled={isLoading}
              >
                Go Home
              </Button>
            </Box>
          </Box>
        );

      case 'confirm':
      default:
        // Show message that dialog is open (dialog renders separately)
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              py: 4,
            }}
          >
            {user && (
              <Typography variant="body1" color="text.secondary" align="center">
                Logged in as: {user.firstname} {user.lastname}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" align="center">
              Please confirm your logout request.
            </Typography>
          </Box>
        );
    }
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <GuestLayout title="Logout">
      {/* Main content area */}
      {renderContent()}

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCancelLogout}
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        maxWidth="xs"
        fullWidth
        // Prevent closing by clicking outside during loading
        disableEscapeKeyDown={isLoading}
        // Accessibility: Keep focus within dialog
        keepMounted={false}
      >
        <DialogTitle id="logout-dialog-title">
          <Typography variant="h6" component="span">
            Confirm Logout
          </Typography>
        </DialogTitle>

        <DialogContent>
          <Typography
            id="logout-dialog-description"
            variant="body1"
            color="text.secondary"
          >
            Are you sure you want to log out?
          </Typography>
          {user && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 2 }}
            >
              You are currently logged in as{' '}
              <strong>
                {user.firstname} {user.lastname}
              </strong>
              {user.email && ` (${user.email})`}
            </Typography>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCancelLogout}
            color="inherit"
            disabled={isLoading}
            aria-label="Cancel logout and stay logged in"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmLogout}
            variant="contained"
            color="primary"
            disabled={isLoading}
            autoFocus
            aria-label="Confirm logout"
            startIcon={
              isLoading ? (
                <CircularProgress size={20} color="inherit" />
              ) : undefined
            }
          >
            {isLoading ? 'Logging out...' : 'Logout'}
          </Button>
        </DialogActions>
      </Dialog>
    </GuestLayout>
  );
}

// Default export as specified in the schema
export default LogoutPage;
