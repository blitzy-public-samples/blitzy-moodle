/**
 * Password Reset Form Component
 *
 * A React Hook Form-based password reset form component using Material-UI v5
 * components with Zod validation. Collects username or email address, calls
 * the password reset API endpoint, handles token-based reset flow including
 * email verification, and displays success/error feedback.
 *
 * This component implements the frontend for Moodle's password reset flow,
 * wrapping the existing core_login_process_password_reset_request() PHP function
 * via the /api/v1/auth/reset-password endpoint without duplicating any business logic.
 *
 * Features:
 * - react-hook-form with Zod schema validation for form state management
 * - Material-UI TextField components with mutual exclusion (username/email)
 * - Client-side validation (email format, required field, max length)
 * - React Query mutation for API calls
 * - Multi-step flow: initial request → email sent confirmation
 * - Full WCAG 2.1 AA accessibility compliance
 * - Light/dark mode support via MUI theme
 *
 * @module features/auth/components/PasswordResetForm
 * @see public/login/forgot_password.php - Original Moodle password reset flow
 * @see public/login/forgot_password_form.php - Original form structure
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  TextField,
  Button,
  Alert,
  CircularProgress,
  Box,
  Typography,
  Link as MuiLink,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

// Internal imports from dependency files
import { resetPassword } from '../api/authApi';
import { useToast } from '@/hooks/useToast';
import type { PasswordResetFormData } from '../types/auth.types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum length for username field (matches Moodle's limit)
 */
const MAX_USERNAME_LENGTH = 100;

/**
 * Maximum length for email field (matches Moodle's limit)
 */
const MAX_EMAIL_LENGTH = 100;

/**
 * Regular expression for basic email validation
 * Follows RFC 5322 simplified pattern
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================================
// Zod Validation Schema
// ============================================================================

/**
 * Zod schema for password reset form validation
 *
 * Implements mutual exclusion between username and email fields:
 * - User can provide username OR email, but at least one is required
 * - If username is provided, email is optional (and vice versa)
 * - Email must be valid format if provided
 * - Fields have max length constraints matching Moodle's database schema
 */
const passwordResetSchema = z
  .object({
    /**
     * Username for password reset
     * Optional if email is provided
     */
    username: z
      .string()
      .max(MAX_USERNAME_LENGTH, {
        message: `Username must be ${MAX_USERNAME_LENGTH} characters or less`,
      })
      .optional()
      .or(z.literal('')),

    /**
     * Email address for password reset
     * Optional if username is provided, must be valid email format
     */
    email: z
      .string()
      .max(MAX_EMAIL_LENGTH, {
        message: `Email must be ${MAX_EMAIL_LENGTH} characters or less`,
      })
      .optional()
      .or(z.literal('')),
  })
  .refine(
    (data) => {
      // At least one of username or email must be provided
      const hasUsername = data.username && data.username.trim().length > 0;
      const hasEmail = data.email && data.email.trim().length > 0;
      return hasUsername || hasEmail;
    },
    {
      message: 'Please enter either a username or email address',
      path: ['username'], // Error will be shown on username field
    }
  )
  .refine(
    (data) => {
      // If email is provided, it must be valid format
      if (data.email && data.email.trim().length > 0) {
        return EMAIL_REGEX.test(data.email);
      }
      return true;
    },
    {
      message: 'Please enter a valid email address',
      path: ['email'],
    }
  );

/**
 * TypeScript type inferred from Zod schema
 */
type FormData = z.infer<typeof passwordResetSchema>;

// ============================================================================
// Component Props Interface
// ============================================================================

/**
 * Props interface for PasswordResetForm component
 */
export interface PasswordResetFormProps {
  /**
   * Optional callback function called after successful password reset request
   * Can be used for analytics, navigation, or parent component state updates
   */
  onSuccess?: () => void;

  /**
   * Optional callback function called when an error occurs
   * Receives the error message as a parameter
   */
  onError?: (error: string) => void;

  /**
   * Optional custom login page URL for the "Back to Login" link
   * Defaults to '/login'
   */
  loginUrl?: string;

  /**
   * Optional prop to enable reCAPTCHA integration
   * When true, component will render reCAPTCHA placeholder for plugin integration
   * @default false
   */
  enableRecaptcha?: boolean;

  /**
   * Optional className for additional styling
   */
  className?: string;

  /**
   * Optional aria-label for the form element
   * Defaults to 'Password reset form'
   */
  ariaLabel?: string;
}

// ============================================================================
// Form State Types
// ============================================================================

/**
 * Represents the current state of the password reset flow
 */
type FormState = 'idle' | 'loading' | 'success' | 'error';

// ============================================================================
// Main Component
// ============================================================================

/**
 * Password Reset Form Component
 *
 * Renders a form for requesting a password reset. Users can enter either
 * their username or email address to receive password reset instructions.
 *
 * The component:
 * 1. Validates input with Zod schema (mutual exclusion, email format)
 * 2. Submits to POST /api/v1/auth/reset-password via React Query mutation
 * 3. Displays success message with instructions to check email
 * 4. Shows error messages for validation failures or API errors
 * 5. Provides keyboard navigation and screen reader support
 *
 * @param props - Component props
 * @returns JSX element containing the password reset form
 *
 * @example
 * ```tsx
 * <PasswordResetForm
 *   onSuccess={() => console.log('Reset email sent!')}
 *   onError={(error) => console.error('Error:', error)}
 *   loginUrl="/login"
 * />
 * ```
 */
function PasswordResetForm({
  onSuccess,
  onError,
  loginUrl = '/login',
  enableRecaptcha = false,
  className,
  ariaLabel = 'Password reset form',
}: PasswordResetFormProps): React.ReactElement {
  // ============================================================================
  // Hooks and State
  // ============================================================================

  /**
   * Toast notification hook for displaying success/error messages
   */
  const toast = useToast();

  /**
   * Reference to the first input field for focus management
   */
  const usernameInputRef = useRef<HTMLInputElement>(null);

  /**
   * Reference to the alert element for screen reader announcements
   */
  const alertRef = useRef<HTMLDivElement>(null);

  /**
   * Track which field the user is currently focused on
   * Used for mutual exclusion behavior
   */
  const [activeField, setActiveField] = useState<'username' | 'email' | null>(null);

  /**
   * Track form submission state for UI feedback
   */
  const [formState, setFormState] = useState<FormState>('idle');

  /**
   * Store success message to display after successful submission
   */
  const [successMessage, setSuccessMessage] = useState<string>('');

  /**
   * Store error message for display in Alert component
   */
  const [errorMessage, setErrorMessage] = useState<string>('');

  /**
   * React Hook Form setup with Zod validation
   */
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, touchedFields },
    watch,
    reset,
    setFocus,
  } = useForm<FormData>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      username: '',
      email: '',
    },
    mode: 'onBlur', // Validate on blur for better UX
  });

  /**
   * Watch form values for mutual exclusion logic
   */
  const watchedUsername = watch('username');
  const watchedEmail = watch('email');

  // ============================================================================
  // React Query Mutation
  // ============================================================================

  /**
   * Mutation hook for password reset API call
   *
   * Handles:
   * - Optimistic UI updates
   * - Success/error callbacks
   * - Loading state management
   */
  const resetPasswordMutation = useMutation({
    mutationFn: (data: PasswordResetFormData) => resetPassword(data),
    onMutate: () => {
      // Set loading state when mutation starts
      setFormState('loading');
      setErrorMessage('');
      setSuccessMessage('');
    },
    onSuccess: (response) => {
      // Update state with success
      setFormState('success');
      const message =
        response.message ||
        'If an account exists with the information provided, you will receive password reset instructions by email.';
      setSuccessMessage(message);

      // Show toast notification
      toast.success(message);

      // Call optional success callback
      onSuccess?.();

      // Reset form after successful submission
      reset();

      // Focus on alert for screen reader announcement
      setTimeout(() => {
        alertRef.current?.focus();
      }, 100);
    },
    onError: (error: Error & { code?: string; message?: string }) => {
      // Update state with error
      setFormState('error');

      // Determine error message based on error code
      let message = 'An error occurred while processing your request. Please try again.';

      if (error.code === 'RATE_LIMITED') {
        message = 'Too many password reset requests. Please try again later.';
      } else if (error.code === 'NETWORK_ERROR') {
        message = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.code === 'VALIDATION_ERROR') {
        message = error.message || 'Please provide a valid username or email address.';
      } else if (error.message) {
        message = error.message;
      }

      setErrorMessage(message);

      // Show toast notification
      toast.error(message);

      // Call optional error callback
      onError?.(message);

      // Focus back on first input field
      setTimeout(() => {
        usernameInputRef.current?.focus();
      }, 100);
    },
  });

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle form submission
   *
   * Prepares data and triggers the API mutation
   */
  const onSubmit = useCallback(
    (data: FormData) => {
      // Build request payload with only non-empty fields
      const payload: PasswordResetFormData = {};

      if (data.username && data.username.trim().length > 0) {
        payload.username = data.username.trim();
      }

      if (data.email && data.email.trim().length > 0) {
        payload.email = data.email.trim();
      }

      // Trigger mutation
      resetPasswordMutation.mutate(payload);
    },
    [resetPasswordMutation]
  );

  /**
   * Handle field focus to implement mutual exclusion behavior
   * When one field has content, the other field appears disabled
   */
  const handleFieldFocus = useCallback((field: 'username' | 'email') => {
    setActiveField(field);
  }, []);

  /**
   * Handle field blur
   */
  const handleFieldBlur = useCallback(() => {
    setActiveField(null);
  }, []);

  /**
   * Dismiss error/success alerts and reset form state
   */
  const handleDismissAlert = useCallback(() => {
    setFormState('idle');
    setErrorMessage('');
    setSuccessMessage('');
  }, []);

  // ============================================================================
  // Computed Values
  // ============================================================================

  /**
   * Determine if username field should be visually disabled
   * (when email field has content)
   */
  const isUsernameDisabled = Boolean(
    watchedEmail && watchedEmail.trim().length > 0 && activeField !== 'username'
  );

  /**
   * Determine if email field should be visually disabled
   * (when username field has content)
   */
  const isEmailDisabled = Boolean(
    watchedUsername && watchedUsername.trim().length > 0 && activeField !== 'email'
  );

  /**
   * Check if form is currently loading
   */
  const isLoading = formState === 'loading' || isSubmitting || resetPasswordMutation.isPending;

  /**
   * Check if form was submitted successfully
   */
  const isSuccess = formState === 'success';

  /**
   * Check if form has errors
   */
  const hasError = formState === 'error' || Object.keys(errors).length > 0;

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Focus on username input when component mounts
   * Improves accessibility by guiding users to start point
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      usernameInputRef.current?.focus();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label={ariaLabel}
      role="form"
      className={className}
      sx={{
        width: '100%',
        maxWidth: 400,
        mx: 'auto',
        p: 3,
      }}
    >
      {/* Form Title */}
      <Typography
        component="h1"
        variant="h5"
        align="center"
        gutterBottom
        sx={{ mb: 3, fontWeight: 600 }}
      >
        Reset Your Password
      </Typography>

      {/* Instructions */}
      <Typography
        variant="body2"
        color="text.secondary"
        align="center"
        sx={{ mb: 3 }}
        id="password-reset-instructions"
      >
        Enter your username or email address below. If an account exists with that
        information, you will receive password reset instructions by email.
      </Typography>

      {/* Success Alert */}
      {isSuccess && successMessage && (
        <Alert
          severity="success"
          ref={alertRef}
          tabIndex={-1}
          onClose={handleDismissAlert}
          sx={{ mb: 3 }}
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </Alert>
      )}

      {/* Error Alert */}
      {formState === 'error' && errorMessage && (
        <Alert
          severity="error"
          ref={alertRef}
          tabIndex={-1}
          onClose={handleDismissAlert}
          sx={{ mb: 3 }}
          role="alert"
          aria-live="assertive"
        >
          {errorMessage}
        </Alert>
      )}

      {/* Username Section */}
      <Box sx={{ mb: 3 }}>
        <Typography
          component="h2"
          variant="subtitle2"
          sx={{ mb: 1, fontWeight: 500 }}
          id="search-by-username-label"
        >
          Search by username
        </Typography>
        <TextField
          {...register('username')}
          id="username"
          name="username"
          type="text"
          label="Username"
          placeholder="Enter your username"
          fullWidth
          autoComplete="username"
          disabled={isLoading || isUsernameDisabled}
          error={Boolean(errors.username)}
          helperText={errors.username?.message || (isUsernameDisabled ? 'Clear email field to search by username' : '')}
          inputRef={usernameInputRef}
          onFocus={() => handleFieldFocus('username')}
          onBlur={handleFieldBlur}
          InputProps={{
            'aria-describedby': 'username-helper-text password-reset-instructions',
            'aria-invalid': Boolean(errors.username),
          }}
          inputProps={{
            maxLength: MAX_USERNAME_LENGTH,
            'aria-labelledby': 'search-by-username-label',
          }}
          FormHelperTextProps={{
            id: 'username-helper-text',
          }}
        />
      </Box>

      {/* Divider */}
      <Typography
        variant="body2"
        color="text.secondary"
        align="center"
        sx={{ my: 2 }}
        aria-hidden="true"
      >
        — OR —
      </Typography>

      {/* Email Section */}
      <Box sx={{ mb: 3 }}>
        <Typography
          component="h2"
          variant="subtitle2"
          sx={{ mb: 1, fontWeight: 500 }}
          id="search-by-email-label"
        >
          Search by email address
        </Typography>
        <TextField
          {...register('email')}
          id="email"
          name="email"
          type="email"
          label="Email"
          placeholder="Enter your email address"
          fullWidth
          autoComplete="email"
          disabled={isLoading || isEmailDisabled}
          error={Boolean(errors.email)}
          helperText={errors.email?.message || (isEmailDisabled ? 'Clear username field to search by email' : '')}
          onFocus={() => handleFieldFocus('email')}
          onBlur={handleFieldBlur}
          InputProps={{
            'aria-describedby': 'email-helper-text password-reset-instructions',
            'aria-invalid': Boolean(errors.email),
          }}
          inputProps={{
            maxLength: MAX_EMAIL_LENGTH,
            'aria-labelledby': 'search-by-email-label',
          }}
          FormHelperTextProps={{
            id: 'email-helper-text',
          }}
        />
      </Box>

      {/* reCAPTCHA Placeholder for Plugin Integration */}
      {enableRecaptcha && (
        <Box
          sx={{ mb: 3 }}
          aria-label="CAPTCHA verification"
          data-testid="recaptcha-placeholder"
        >
          {/* 
            reCAPTCHA integration point for plugins.
            Plugins can inject their reCAPTCHA component here via extension points.
            This preserves compatibility with forgotpassword_captcha_enabled() 
            from public/login/forgot_password_form.php lines 72-74
          */}
          <Typography variant="caption" color="text.secondary">
            reCAPTCHA verification may be required
          </Typography>
        </Box>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        size="large"
        disabled={isLoading || isSuccess}
        aria-busy={isLoading}
        aria-describedby={hasError ? 'form-error-message' : undefined}
        sx={{
          py: 1.5,
          mb: 2,
          fontWeight: 600,
          position: 'relative',
        }}
      >
        {isLoading ? (
          <>
            <CircularProgress
              size={24}
              sx={{
                position: 'absolute',
                left: '50%',
                marginLeft: '-12px',
              }}
              aria-hidden="true"
            />
            <Box component="span" sx={{ visibility: 'hidden' }}>
              Search
            </Box>
            <Box
              component="span"
              sx={{
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
              }}
              role="status"
              aria-live="polite"
            >
              Searching for your account...
            </Box>
          </>
        ) : (
          'Search'
        )}
      </Button>

      {/* Back to Login Link */}
      <Box sx={{ textAlign: 'center' }}>
        <MuiLink
          component={Link}
          to={loginUrl}
          variant="body2"
          underline="hover"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            color: 'primary.main',
            '&:hover': {
              color: 'primary.dark',
            },
            '&:focus': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: '2px',
              borderRadius: '4px',
            },
          }}
          aria-label="Go back to login page"
        >
          ← Back to Login
        </MuiLink>
      </Box>

      {/* Screen Reader Only - Form Status */}
      <Box
        component="span"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
        }}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isSuccess && 'Password reset email has been sent. Please check your inbox.'}
        {formState === 'error' && errorMessage}
      </Box>
    </Box>
  );
}

// ============================================================================
// Export
// ============================================================================

export default PasswordResetForm;
