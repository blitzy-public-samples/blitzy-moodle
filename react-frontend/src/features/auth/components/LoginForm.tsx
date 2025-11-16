/**
 * Login Form Component
 *
 * Provides username/password authentication form with validation.
 * Integrates with JWT-based API authentication that wraps existing
 * Moodle authenticate_user_login() functions.
 *
 * @module features/auth/components/LoginForm
 */

import type React from 'react';
import { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  FormControlLabel,
  Checkbox,
  CircularProgress,
} from '@mui/material';
import { useLoginMutation } from '../api/authApi';
import type { LoginCredentials } from '../types/auth.types';

// ============================================================================
// Component Props
// ============================================================================

export interface LoginFormProps {
  /**
   * Callback fired after successful login
   * @param user - The authenticated user
   * @param tokens - JWT authentication tokens
   */
  onSuccess?: (response: { user: any; tokens: any }) => void;

  /**
   * Callback fired when login fails
   * @param error - The error that occurred
   */
  onError?: (error: Error) => void;

  /**
   * Whether to show the "Remember me" checkbox
   * @default true
   */
  showRememberMe?: boolean;

  /**
   * Whether to show the "Forgot password" link
   * @default true
   */
  showForgotPassword?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * LoginForm Component
 *
 * Features:
 * - Username and password inputs with validation
 * - Remember me checkbox (controls token persistence)
 * - Forgot password link
 * - Form validation and error display
 * - Loading state during authentication
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * Test IDs (for E2E tests):
 * - login-username-input
 * - login-password-input
 * - login-remember-checkbox
 * - login-submit-button
 * - login-error-message
 */
export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onError,
  showRememberMe = true,
  showForgotPassword = true,
}) => {
  // ============================================================================
  // State
  // ============================================================================

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberUsername, setRememberUsername] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // ============================================================================
  // Mutations
  // ============================================================================

  const { mutate: loginUser, isPending, error: loginError } = useLoginMutation();

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Handle form submission
   */
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Clear previous validation errors
    setValidationError(null);

    // Client-side validation
    if (!username.trim()) {
      setValidationError('Username is required');
      return;
    }

    if (!password) {
      setValidationError('Password is required');
      return;
    }

    // Prepare credentials
    const credentials: LoginCredentials = {
      username: username.trim(),
      password,
      rememberUsername,
    };

    // Submit login request
    console.log('[LoginForm] Calling loginUser mutation with credentials:', { username: credentials.username });
    loginUser(credentials, {
      onSuccess: (response) => {
        console.log('[LoginForm] Mutation onSuccess called with response:', response);
        console.log('[LoginForm] Response has user:', !!response.user);
        console.log('[LoginForm] Response has tokens:', !!response.tokens);
        // Only call onSuccess if user and tokens are present
        if (response.user && response.tokens) {
          console.log('[LoginForm] Calling parent onSuccess callback...');
          onSuccess?.({ user: response.user, tokens: response.tokens });
          console.log('[LoginForm] Parent onSuccess callback called');
        } else {
          console.error('[LoginForm] Response missing user or tokens, not calling parent onSuccess');
        }
      },
      onError: (error) => {
        console.error('[LoginForm] Mutation onError called:', error);
        onError?.(error);
      },
    });
    console.log('[LoginForm] loginUser mutation call completed (async)');
  };

  /**
   * Handle username change
   */
  const handleUsernameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
    setValidationError(null); // Clear validation error on input
  };

  /**
   * Handle password change
   */
  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
    setValidationError(null); // Clear validation error on input
  };

  /**
   * Handle remember me checkbox change
   */
  const handleRememberMeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRememberUsername(event.target.checked);
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  // Display error (validation error takes priority over API error)
  const displayError = validationError || (loginError ? loginError.message : null);

  // Disable form during submission
  const isFormDisabled = isPending;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        width: '100%',
        maxWidth: 400,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
      data-testid="login-form"
    >
      {/* Error Alert */}
      {displayError && (
        <Alert severity="error" data-testid="error-message">
          {displayError}
        </Alert>
      )}

      {/* Username Field */}
      <TextField
        id="username"
        name="username"
        label="Username"
        type="text"
        value={username}
        onChange={handleUsernameChange}
        disabled={isFormDisabled}
        required
        autoComplete="username"
        autoFocus
        fullWidth
        inputProps={{
          'data-testid': 'username-input',
          'aria-label': 'Username',
        }}
        error={!!validationError && !username.trim()}
      />

      {/* Password Field */}
      <TextField
        id="password"
        name="password"
        label="Password"
        type="password"
        value={password}
        onChange={handlePasswordChange}
        disabled={isFormDisabled}
        required
        autoComplete="current-password"
        fullWidth
        inputProps={{
          'data-testid': 'password-input',
          'aria-label': 'Password',
        }}
        error={!!validationError && !password}
      />

      {/* Remember Me Checkbox */}
      {showRememberMe && (
        <FormControlLabel
          control={
            <Checkbox
              checked={rememberUsername}
              onChange={handleRememberMeChange}
              disabled={isFormDisabled}
              inputProps={{
                'data-testid': 'remember-me-checkbox',
                'aria-label': 'Remember me',
              } as React.InputHTMLAttributes<HTMLInputElement>}
            />
          }
          label="Remember me"
        />
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        variant="contained"
        color="primary"
        size="large"
        disabled={isFormDisabled}
        fullWidth
        data-testid="submit-button"
        sx={{ mt: 1 }}
      >
        {isPending ? (
          <>
            <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
            Logging in...
          </>
        ) : (
          'Log in'
        )}
      </Button>

      {/* Forgot Password Link */}
      {showForgotPassword && (
        <Box sx={{ textAlign: 'center', mt: 1 }}>
          <Typography
            component="a"
            href="/login/forgot_password.php"
            variant="body2"
            data-testid="forgot-password-link"
            sx={{
              color: 'primary.main',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            Forgot password?
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default LoginForm;
