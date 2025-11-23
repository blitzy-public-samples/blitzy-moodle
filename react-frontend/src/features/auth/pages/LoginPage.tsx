/**
 * Login Page Component
 *
 * Main login page that wraps the LoginForm component and handles
 * post-login navigation and state management.
 *
 * @module features/auth/pages/LoginPage
 */

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
import type { LoginResponse } from '../api/authApi';

// ============================================================================
// Component
// ============================================================================

/**
 * LoginPage Component
 *
 * Features:
 * - Centered login form with Material-UI styling
 * - Redirects to dashboard or returnUrl after successful login
 * - Integrates with React Query-based authentication state
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
export function LoginPage() {
  // ============================================================================
  // Hooks
  // ============================================================================

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  // Get return URL from query params (default to dashboard)
  const returnUrl = searchParams.get('returnUrl') ?? '/dashboard';

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Handle successful login
   * Updates Redux auth state and navigates to the return URL.
   */
  const handleLoginSuccess = async (response: LoginResponse) => {
    console.log('[LoginPage] handleLoginSuccess called with response:', response);
    console.log('[LoginPage] returnUrl:', returnUrl);
    
    // Dispatch login success action to Redux store
    // This updates the isAuthenticated flag and makes the user menu visible
    dispatch(loginSuccess({ user: response.user, tokens: response.tokens }));
    console.log('[LoginPage] Dispatched loginSuccess to Redux');
    
    // Wait a brief moment to ensure state update has propagated to all components
    // This prevents a race condition where ProtectedRoute or Header checks authentication
    // before the Redux state has fully updated
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('[LoginPage] Waited 100ms, now navigating to:', returnUrl);
    
    // Navigate to the return URL
    // The token and user data are now in Redux state, localStorage, and React Query cache
    navigate(returnUrl, { replace: true });
    console.log('[LoginPage] navigate() called');
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
            showRememberMe
            showForgotPassword
          />
        </Paper>
      </Container>
    </Box>
  );
}

export default LoginPage;
