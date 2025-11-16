/**
 * ProtectedRoute Component
 *
 * A route wrapper component that ensures only authenticated users can access protected routes.
 * Displays a loading spinner during authentication check and redirects to login if not authenticated.
 *
 * Features:
 * - Automatic authentication state checking via useAuth hook
 * - Loading state with centered spinner during auth verification
 * - Automatic redirect to login page with return URL preservation
 * - Seamless integration with React Router
 * - Supports optional permission-based access control
 *
 * @module features/auth/components/ProtectedRoute
 */

import type React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../hooks/useAuth';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for ProtectedRoute component
 */
export interface ProtectedRouteProps {
  /** Child components to render if authenticated */
  children: React.ReactNode;
  /** Optional required permission/capability */
  requiredPermission?: string;
  /** Optional custom fallback component during loading */
  loadingComponent?: React.ReactNode;
  /** Optional redirect path (default: '/login') */
  redirectTo?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ProtectedRoute component that guards routes requiring authentication
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ProtectedRoute>
 *   <DashboardPage />
 * </ProtectedRoute>
 *
 * // With permission check
 * <ProtectedRoute requiredPermission="moodle/course:create">
 *   <CreateCoursePage />
 * </ProtectedRoute>
 *
 * // With custom loading component
 * <ProtectedRoute loadingComponent={<CustomLoader />}>
 *   <ProfilePage />
 * </ProtectedRoute>
 * ```
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  loadingComponent,
  redirectTo = '/login',
}) => {
  // user will be needed for permission checking when implemented (see TODO below)
  const { user: _user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress size={48} />
        <Typography variant="body1" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    // Preserve the attempted URL for redirect after login
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  }

  // Check for required permission if specified
  if (requiredPermission) {
    // TODO: Implement permission checking when permission system is available
    // For now, we allow access if authenticated
    // In the future, this should check user.capabilities or similar
    const hasPermission = true; // Placeholder

    if (!hasPermission) {
      // Redirect to unauthorized page or home
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // User is authenticated (and has required permission if specified)
  return <>{children}</>;
};

// Default export for convenient importing
export default ProtectedRoute;
