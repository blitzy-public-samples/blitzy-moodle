/**
 * Login Page Component
 *
 * Main login page that wraps the LoginForm component and handles
 * post-login navigation and state management.
 *
 * @module features/auth/pages/LoginPage
 */

import { useSearchParams } from 'react-router-dom';
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
export function LoginPage() {
  // ============================================================================
  // Hooks
  // ============================================================================

  const [searchParams] = useSearchParams();

  // Get return URL from query params (default to dashboard)
  const returnUrl = searchParams.get('returnUrl') ?? '/dashboard';

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Handle successful login
   * Note: LoginForm internally handles Redux state updates, token storage,
   * and navigation via useAuth hook. This callback is for page-specific actions.
   */
  const handleLoginSuccess = (data: { redirectUrl?: string }) => {
    // eslint-disable-next-line no-console
    console.log('[LoginPage] handleLoginSuccess called with data:', data);
    // eslint-disable-next-line no-console
    console.log('[LoginPage] returnUrl:', returnUrl);
    
    // LoginForm handles navigation internally, but we can perform additional
    // page-specific actions here if needed (e.g., analytics, tracking)
  };

  /**
   * Handle login error
   * Error is already displayed by LoginForm component
   */
  const handleLoginError = (error: Error) => {
    // eslint-disable-next-line no-console
    console.error('[LoginPage] Login error:', error);
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
            redirectUrl={returnUrl}
            showRememberUsername
            showForgotPassword
          />
        </Paper>
      </Container>
    </Box>
  );
}

export default LoginPage;
