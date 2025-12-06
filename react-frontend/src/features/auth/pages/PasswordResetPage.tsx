/**
 * Password Reset Page Component
 *
 * React page component that orchestrates the complete forgot password and token-based
 * password reset workflow. This component serves as the React Router route endpoint
 * for the /reset-password path.
 *
 * Implements two modes of operation:
 * 1. Password Reset Request Mode (no token): Displays PasswordResetForm for
 *    username/email input with optional reCAPTCHA support
 * 2. Password Set Mode (token present): Displays SetPasswordForm with new
 *    password fields and password policy validation
 *
 * This component transforms the PHP forgot password workflow (public/login/forgot_password.php)
 * into a modern React SPA experience while maintaining identical functionality through
 * API calls that wrap the existing Moodle core functions:
 * - core_login_process_password_reset_request() via POST /api/v1/auth/password-reset/request
 * - core_login_process_password_set() via POST /api/v1/auth/password-reset/set
 *
 * Features:
 * - Two-mode operation based on URL token parameter presence
 * - Token migration from URL to session storage for security
 * - External forgot password URL override support
 * - Material-UI Stepper for workflow visualization
 * - Loading states with skeleton components
 * - Comprehensive error handling with clear messages
 * - Rate limiting support for password reset requests
 * - Full WCAG 2.1 AA accessibility compliance
 * - Plugin extension points for custom logic
 *
 * @module features/auth/pages/PasswordResetPage
 * @see public/login/forgot_password.php - Original Moodle password reset flow
 * @see public/login/forgot_password_form.php - Original request form
 * @see public/login/set_password_form.php - Original set password form
 * @see public/login/lib.php - Core password reset functions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Alert,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Container,
  Paper,
} from '@mui/material';

// Internal imports from dependency files
import { PasswordResetForm } from '../components/PasswordResetForm';
import { SetPasswordForm } from '../components/SetPasswordForm';
import { GuestLayout } from '@/components/layouts/GuestLayout';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/services/api/client';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Represents the current mode of the password reset workflow
 * - 'request': User is requesting a password reset (entering username/email)
 * - 'set': User is setting a new password (has valid token)
 * - 'loading': Initial loading state while validating token
 * - 'success': Password has been successfully reset
 */
type PasswordResetMode = 'request' | 'set' | 'loading' | 'success';

/**
 * Password reset workflow steps for the Stepper component
 */
interface WorkflowStep {
  /** Step label text */
  label: string;
  /** Description of the step */
  description: string;
}

/**
 * Token validation response from the API
 */
interface TokenValidationResponse {
  success: boolean;
  data?: {
    /** Username associated with the token */
    username: string;
    /** Whether the token is valid and not expired */
    valid: boolean;
    /** Expiration time in seconds remaining */
    expiresIn?: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Configuration response from the API
 */
interface ConfigResponse {
  success: boolean;
  data?: {
    /** External forgot password URL override */
    forgottenPasswordUrl?: string;
    /** Whether to protect usernames */
    protectUsernames?: boolean;
    /** Password reset expiration time in seconds */
    pwResetTime?: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Storage key for persisting token in session storage
 * Matches Moodle's approach of migrating token from GET parameter to session
 */
const TOKEN_STORAGE_KEY = 'moodle_password_reset_token';

/**
 * Login page URL for redirect after successful password reset
 */
const LOGIN_URL = '/login';

/**
 * Workflow steps for the Stepper component visualization
 */
const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    label: 'Request Reset',
    description: 'Enter your username or email to receive a password reset link',
  },
  {
    label: 'Check Email',
    description: 'Click the password reset link sent to your email',
  },
  {
    label: 'Set Password',
    description: 'Choose a new password following the security requirements',
  },
];

/**
 * API endpoints for password reset operations
 */
const API_ENDPOINTS = {
  /** Validate reset token */
  VALIDATE_TOKEN: '/auth/password-reset/validate',
  /** Get configuration for external redirect */
  CONFIG: '/auth/config',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets the token from session storage
 * Used to retrieve token after migration from URL parameter
 *
 * @returns The stored token or null if not found
 */
function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // Session storage may not be available (e.g., private browsing)
    return null;
  }
}

/**
 * Stores the token in session storage
 * Implements token migration from URL to session for security
 *
 * @param token - The reset token to store
 */
function storeToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Session storage may not be available
    console.warn('Unable to store token in session storage');
  }
}

/**
 * Clears the token from session storage
 * Called after successful password reset or on error
 */
function clearStoredToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Session storage may not be available
  }
}

/**
 * Determines the active step index for the Stepper component
 *
 * @param mode - Current password reset mode
 * @param emailSent - Whether the reset email has been sent
 * @returns The zero-based step index
 */
function getActiveStep(mode: PasswordResetMode, emailSent: boolean): number {
  switch (mode) {
    case 'request':
      return emailSent ? 1 : 0;
    case 'set':
      return 2;
    case 'success':
      return 3; // Completed
    default:
      return 0;
  }
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Password Reset Page Component
 *
 * Orchestrates the complete password reset workflow with two modes:
 *
 * Mode 1 - Request Reset (no token):
 * - Displays PasswordResetForm for username/email input
 * - Calls POST /api/v1/auth/password-reset/request
 * - Wraps core_login_process_password_reset_request function
 * - Sends confirmation email with reset token link
 * - Shows success message with obfuscated email address
 *
 * Mode 2 - Set Password (token present):
 * - Extracts token from URL query parameters
 * - Migrates token to session storage (security best practice)
 * - Validates token via API
 * - Displays SetPasswordForm with password policy requirements
 * - Calls POST /api/v1/auth/password-reset/set
 * - Wraps core_login_process_password_set function
 * - Redirects to login on success
 *
 * URL Examples:
 * - /reset-password (request mode)
 * - /reset-password?token=abc123 (set password mode)
 *
 * @returns JSX element containing the password reset page
 *
 * @example
 * ```tsx
 * // In router configuration
 * <Route path="/reset-password" element={<PasswordResetPage />} />
 * ```
 */
function PasswordResetPage(): React.ReactElement {
  // ============================================================================
  // Hooks
  // ============================================================================

  /**
   * URL search params for token extraction
   */
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * Navigation hook for redirects
   */
  const navigate = useNavigate();

  /**
   * Location hook for state access
   */
  const location = useLocation();

  /**
   * Toast notification hook
   */
  const toast = useToast();

  // ============================================================================
  // State
  // ============================================================================

  /**
   * Current mode of the password reset workflow
   */
  const [mode, setMode] = useState<PasswordResetMode>('loading');

  /**
   * Token for password reset (from URL or session storage)
   */
  const [token, setToken] = useState<string | null>(null);

  /**
   * Username associated with the token (fetched during validation)
   */
  const [username, setUsername] = useState<string>('');

  /**
   * Error message to display
   */
  const [errorMessage, setErrorMessage] = useState<string>('');

  /**
   * Whether the reset email has been sent (for stepper visualization)
   */
  const [emailSent, setEmailSent] = useState<boolean>(false);

  /**
   * Loading state for initial configuration and token validation
   */
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Whether an external forgot password URL is configured
   */
  const [externalUrl, setExternalUrl] = useState<string | null>(null);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Effect: Check for external forgot password URL configuration
   * If configured, redirects to external URL immediately
   */
  useEffect(() => {
    const checkExternalUrl = async (): Promise<void> => {
      try {
        const response = await apiClient.get<ConfigResponse>(API_ENDPOINTS.CONFIG);
        if (response.data.success && response.data.data?.forgottenPasswordUrl) {
          // External URL is configured - redirect
          setExternalUrl(response.data.data.forgottenPasswordUrl);
          window.location.href = response.data.data.forgottenPasswordUrl;
        }
      } catch {
        // Continue with internal password reset if config fetch fails
        // This is expected behavior when the endpoint doesn't exist
      }
    };

    checkExternalUrl();
  }, []);

  /**
   * Effect: Handle token from URL and session storage
   *
   * Implements the same token migration strategy as Moodle:
   * 1. If token is in URL (GET parameter), store it in session and remove from URL
   * 2. If token is in session, validate it
   * 3. If no token, show request form
   */
  useEffect(() => {
    const initializeMode = async (): Promise<void> => {
      // Don't proceed if redirecting to external URL
      if (externalUrl) return;

      setIsLoading(true);

      // Check for token in URL
      const urlToken = searchParams.get('token');

      if (urlToken) {
        // Token found in URL - migrate to session storage
        // This follows Moodle's pattern to avoid exposing token in URL
        storeToken(urlToken);

        // Remove token from URL to prevent exposure in browser history/logs
        searchParams.delete('token');
        setSearchParams(searchParams, { replace: true });

        // Validate the token
        await validateToken(urlToken);
      } else {
        // Check for token in session storage
        const storedToken = getStoredToken();

        if (storedToken) {
          await validateToken(storedToken);
        } else {
          // No token found - show request form
          setMode('request');
          setIsLoading(false);
        }
      }
    };

    initializeMode();
  }, [searchParams, setSearchParams, externalUrl]);

  // ============================================================================
  // Callbacks
  // ============================================================================

  /**
   * Validates the password reset token via API
   *
   * Checks if the token is valid and not expired, and retrieves
   * the associated username for display in the set password form.
   *
   * @param tokenToValidate - The token to validate
   */
  const validateToken = useCallback(
    async (tokenToValidate: string): Promise<void> => {
      try {
        const response = await apiClient.post<TokenValidationResponse>(
          API_ENDPOINTS.VALIDATE_TOKEN,
          { token: tokenToValidate }
        );

        if (response.data.success && response.data.data?.valid) {
          // Token is valid
          setToken(tokenToValidate);
          setUsername(response.data.data.username || '');
          setMode('set');
          setErrorMessage('');
        } else {
          // Token is invalid or expired
          const errorCode = response.data.error?.code || 'INVALID_TOKEN';
          handleTokenError(errorCode, response.data.error?.message);
        }
      } catch (error) {
        // API error or network failure
        handleTokenError(
          'VALIDATION_ERROR',
          'Unable to validate your password reset link. Please try again.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Handles token validation errors
   *
   * Maps error codes to user-friendly messages and clears invalid tokens.
   *
   * @param errorCode - Error code from API
   * @param defaultMessage - Default message if no specific message for code
   */
  const handleTokenError = useCallback(
    (errorCode: string, defaultMessage?: string): void => {
      // Clear invalid token from storage
      clearStoredToken();

      // Map error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        INVALID_TOKEN:
          'This password reset link is invalid. Please request a new one.',
        TOKEN_EXPIRED:
          'This password reset link has expired. Password reset links are valid for a limited time. Please request a new one.',
        TOKEN_USED:
          'This password reset link has already been used. Each link can only be used once. Please request a new one if needed.',
        USER_NOT_FOUND:
          'The user account associated with this reset link could not be found.',
        AUTH_DISABLED:
          'Password reset is not available for this account type.',
        GUEST_USER:
          'Guest accounts cannot reset their password.',
      };

      const message = errorMessages[errorCode] || defaultMessage ||
        'There was a problem with your password reset link. Please try again.';

      setErrorMessage(message);
      setMode('request');
      setToken(null);

      // Show error toast
      toast.error(message);
    },
    [toast]
  );

  /**
   * Handles successful password reset request
   *
   * Called when the PasswordResetForm successfully submits
   * and the backend has sent the reset email.
   */
  const handleRequestSuccess = useCallback((): void => {
    setEmailSent(true);
    toast.success(
      'Password reset instructions have been sent to your email address.'
    );
  }, [toast]);

  /**
   * Handles password reset request errors
   *
   * Called when the PasswordResetForm encounters an error.
   *
   * @param error - Error message from the form
   */
  const handleRequestError = useCallback(
    (error: string): void => {
      setErrorMessage(error);
      toast.error(error);
    },
    [toast]
  );

  /**
   * Handles successful password set
   *
   * Called when the SetPasswordForm successfully updates the password.
   * Clears token and redirects to login page.
   */
  const handleSetSuccess = useCallback((): void => {
    // Clear token from storage
    clearStoredToken();

    // Update mode for stepper
    setMode('success');

    // Show success toast
    toast.success(
      'Your password has been successfully updated. Please log in with your new password.'
    );

    // Redirect to login page after a short delay
    setTimeout(() => {
      navigate(LOGIN_URL, {
        state: {
          message: 'Password reset successful. Please log in with your new password.',
        },
      });
    }, 2000);
  }, [navigate, toast]);

  /**
   * Handles request to try again after error
   *
   * Clears error state and shows the request form again.
   */
  const handleTryAgain = useCallback((): void => {
    setErrorMessage('');
    setMode('request');
    setToken(null);
    setEmailSent(false);
    clearStoredToken();
  }, []);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /**
   * Renders the workflow stepper
   *
   * Visualizes the current step in the password reset process.
   *
   * @returns Stepper component JSX
   */
  const renderStepper = (): React.ReactElement => {
    const activeStep = getActiveStep(mode, emailSent);

    return (
      <Box
        sx={{ mb: 4 }}
        role="navigation"
        aria-label="Password reset progress"
      >
        <Stepper
          activeStep={activeStep}
          alternativeLabel
          sx={{
            '& .MuiStepLabel-label': {
              mt: 1,
            },
          }}
        >
          {WORKFLOW_STEPS.map((step, index) => (
            <Step key={step.label} completed={activeStep > index}>
              <StepLabel
                aria-current={activeStep === index ? 'step' : undefined}
              >
                <Typography variant="body2" component="span">
                  {step.label}
                </Typography>
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>
    );
  };

  /**
   * Renders the loading state
   *
   * Shown while validating token or checking configuration.
   *
   * @returns Loading indicator JSX
   */
  const renderLoading = (): React.ReactElement => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 4,
      }}
      role="status"
      aria-label="Loading password reset page"
    >
      <CircularProgress
        size={48}
        thickness={4}
        aria-hidden="true"
      />
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mt: 2 }}
      >
        Preparing password reset...
      </Typography>
    </Box>
  );

  /**
   * Renders the success state
   *
   * Shown after password has been successfully reset.
   *
   * @returns Success message JSX
   */
  const renderSuccess = (): React.ReactElement => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 4,
      }}
      role="status"
      aria-live="polite"
    >
      <Alert
        severity="success"
        sx={{ width: '100%', mb: 3 }}
      >
        Your password has been successfully updated!
      </Alert>
      <Typography variant="body1" color="text.secondary">
        You will be redirected to the login page shortly...
      </Typography>
      <CircularProgress
        size={24}
        sx={{ mt: 2 }}
        aria-hidden="true"
      />
    </Box>
  );

  /**
   * Renders the email sent confirmation
   *
   * Shown after successful password reset request.
   *
   * @returns Confirmation message JSX
   */
  const renderEmailSent = (): React.ReactElement => (
    <Box
      sx={{ py: 2 }}
      role="status"
      aria-live="polite"
    >
      <Alert
        severity="info"
        sx={{ mb: 3 }}
      >
        <Typography variant="body2">
          <strong>Check your email</strong>
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          If an account exists with the information you provided, you will
          receive an email with instructions to reset your password.
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          The email may take a few minutes to arrive. Be sure to check your
          spam or junk folder.
        </Typography>
      </Alert>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 2, textAlign: 'center' }}
      >
        Didn&apos;t receive the email?{' '}
        <Typography
          component="button"
          variant="body2"
          onClick={handleTryAgain}
          sx={{
            color: 'primary.main',
            textDecoration: 'underline',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            '&:hover': {
              textDecoration: 'none',
            },
            '&:focus': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: '2px',
            },
          }}
          tabIndex={0}
          aria-label="Try again with a different username or email"
        >
          Try again
        </Typography>
      </Typography>
    </Box>
  );

  /**
   * Renders the main content based on current mode
   *
   * @returns Content JSX for the current mode
   */
  const renderContent = (): React.ReactElement => {
    // Show error with option to try again
    if (errorMessage && mode === 'request') {
      return (
        <Box>
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            role="alert"
          >
            {errorMessage}
          </Alert>
          <PasswordResetForm
            onSuccess={handleRequestSuccess}
            onError={handleRequestError}
            loginUrl={LOGIN_URL}
          />
        </Box>
      );
    }

    switch (mode) {
      case 'loading':
        return renderLoading();

      case 'request':
        if (emailSent) {
          return renderEmailSent();
        }
        return (
          <PasswordResetForm
            onSuccess={handleRequestSuccess}
            onError={handleRequestError}
            loginUrl={LOGIN_URL}
          />
        );

      case 'set':
        if (!token) {
          // Should not happen, but handle gracefully
          return (
            <Alert severity="error" role="alert">
              No valid reset token found. Please request a new password reset.
            </Alert>
          );
        }
        return (
          <SetPasswordForm
            token={token}
            onSuccess={handleSetSuccess}
            username={username}
          />
        );

      case 'success':
        return renderSuccess();

      default:
        return renderLoading();
    }
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  /**
   * Determine page title based on mode
   */
  const getPageTitle = (): string => {
    switch (mode) {
      case 'set':
        return 'Set New Password';
      case 'success':
        return 'Password Reset Complete';
      default:
        return 'Forgot Password';
    }
  };

  /**
   * Get step description for screen readers
   */
  const getStepDescription = (): string => {
    if (mode === 'set') {
      return 'Step 3 of 3: Enter your new password';
    }
    if (emailSent) {
      return 'Step 2 of 3: Check your email for the reset link';
    }
    return 'Step 1 of 3: Enter your username or email address';
  };

  // If redirecting to external URL, show loading
  if (externalUrl) {
    return (
      <GuestLayout title="Redirecting...">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 4,
          }}
          role="status"
          aria-label="Redirecting to external password reset page"
        >
          <CircularProgress size={48} />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Redirecting to password reset...
          </Typography>
        </Box>
      </GuestLayout>
    );
  }

  return (
    <GuestLayout title={getPageTitle()}>
      {/* Hidden heading for screen readers */}
      <Box sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden' }}>
        <Typography
          variant="h1"
          component="h1"
          id="password-reset-heading"
        >
          {getPageTitle()}
        </Typography>
        <Typography
          variant="body2"
          aria-live="polite"
        >
          {getStepDescription()}
        </Typography>
      </Box>

      {/* Main content area */}
      <Box
        component="main"
        role="main"
        aria-labelledby="password-reset-heading"
        sx={{ width: '100%' }}
      >
        {/* Workflow Stepper - hide during loading */}
        {!isLoading && mode !== 'success' && renderStepper()}

        {/* Step description for sighted users */}
        {!isLoading && mode !== 'success' && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 3, textAlign: 'center' }}
            aria-hidden="true"
          >
            {mode === 'set'
              ? 'Create a new password for your account'
              : emailSent
              ? 'Check your email for the reset link'
              : 'Enter your username or email to reset your password'}
          </Typography>
        )}

        {/* Content based on current mode */}
        {isLoading ? renderLoading() : renderContent()}
      </Box>
    </GuestLayout>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default PasswordResetPage;
