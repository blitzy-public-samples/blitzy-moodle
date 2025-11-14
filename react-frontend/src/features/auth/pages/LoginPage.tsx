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
import {
  Box,
  Container,
  Paper,
  Typography,
} from '@mui/material';
import { LoginForm } from '../components/LoginForm';

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
export const LoginPage: React.FC = () => {
  // ============================================================================
  // Hooks
  // ============================================================================

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get return URL from query params (default to dashboard)
  const returnUrl = searchParams.get('returnUrl') || '/dashboard';

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Handle successful login
   * Navigates to the return URL after the mutation has successfully
   * stored the token and updated the React Query cache.
   */
  const handleLoginSuccess = async (response: { user: any; tokens: any }) => {
    console.log('[LoginPage] handleLoginSuccess called with response:', response);
    console.log('[LoginPage] Return URL:', returnUrl);
    
    // Wait a brief moment to ensure React Query cache update has propagated
    // This prevents a race condition where ProtectedRoute checks authentication
    // before the useAuth hook has received the updated cache data
    console.log('[LoginPage] Waiting 100ms for state propagation...');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('[LoginPage] Calling navigate...');
    
    // Navigate to the return URL
    // The token and user data are already stored in localStorage and React Query cache
    // by the useLoginMutation hook's onSuccess handler
    navigate(returnUrl, { replace: true });
    
    console.log('[LoginPage] navigate() called successfully');
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
