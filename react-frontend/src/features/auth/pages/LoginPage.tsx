/**
 * Login Page Component
 *
 * Main login page that wraps the LoginForm component and handles
 * post-login navigation and state management.
 *
 * @module features/auth/pages/LoginPage
 */

import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Box,
  Container,
  Paper,
  Typography,
} from '@mui/material';
import { LoginForm } from '../components/LoginForm';
import { loginSuccess } from '../store/authSlice';

// ============================================================================
// Component
// ============================================================================

/**
 * LoginPage Component
 *
 * Features:
 * - Centered login form with Material-UI styling
 * - Redirects to dashboard or returnUrl after successful login
 * - Dispatches login success action to Redux store
 * - Accessible layout with proper heading structure
 *
 * URL Parameters:
 * - returnUrl: Redirect destination after successful login (default: /dashboard)
 *
 * Example URLs:
 * - /login
 * - /login?returnUrl=/courses/123
 * - /login?returnUrl=/admin
 */
export const LoginPage: React.FC = () => {
  // ============================================================================
  // Hooks
  // ============================================================================

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  // Get return URL from query params (default to dashboard)
  const returnUrl = searchParams.get('returnUrl') || '/dashboard';

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Handle successful login
   * Dispatches Redux action and redirects to intended destination
   */
  const handleLoginSuccess = (response: { user: any; tokens: any }) => {
    // Update Redux store with authenticated user
    dispatch(loginSuccess({
      user: response.user,
      tokens: response.tokens,
    }));

    // Redirect to intended page
    console.log('Login successful, redirecting to:', returnUrl);
    navigate(returnUrl, { replace: true });
  };

  /**
   * Handle login error
   * Error is already displayed by LoginForm component
   */
  const handleLoginError = (error: Error) => {
    console.error('Login error:', error);
    // LoginForm handles error display, no additional action needed here
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Page Title */}
          <Typography
            component="h1"
            variant="h4"
            gutterBottom
            sx={{ mb: 3, fontWeight: 600 }}
          >
            Sign In
          </Typography>

          {/* Subtitle */}
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ mb: 4 }}
          >
            Enter your credentials to access your account
          </Typography>

          {/* Login Form */}
          <LoginForm
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
            showRememberMe={true}
            showForgotPassword={true}
          />
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginPage;
