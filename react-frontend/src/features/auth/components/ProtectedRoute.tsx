/**
 * ProtectedRoute Component
 *
 * React Router wrapper component that implements route-level authorization checking
 * by validating JWT token authentication status and redirecting unauthenticated users
 * to the login page while preserving the intended destination URL.
 *
 * This component serves as a security boundary in the React application, ensuring that
 * only authenticated users can access protected routes. It integrates with the JWT-based
 * authentication system that wraps Moodle's existing authentication infrastructure.
 *
 * Features:
 * - Checks authentication state from Redux store using useAuth() hook
 * - Validates JWT token presence and authentication status
 * - Redirects unauthenticated users to /login with return URL parameter
 * - Renders child routes/components for authenticated users
 * - Shows loading spinner during authentication check
 * - Uses React Router v6 Navigate component for declarative redirects
 * - Preserves intended destination URL for post-login redirect
 * - Implements TypeScript strict typing with PropsWithChildren interface
 * - Integrates with Material-UI theme for consistent styling
 *
 * Security Notes:
 * - This component only handles frontend routing protection
 * - All actual authorization is enforced by the backend API via require_capability()
 * - JWT token validation occurs on every API request, not just route access
 * - This is a UX layer that redirects before users see unauthorized content
 *
 * Architecture:
 * - Uses useAuth hook from authSlice for centralized auth state
 * - Uses LoadingSpinner component for consistent loading UI
 * - Uses React Router v6 Navigate for declarative navigation
 * - Preserves location state for post-login redirect
 *
 * @module features/auth/components/ProtectedRoute
 * @see features/auth/hooks/useAuth - Authentication state hook
 * @see components/feedback/LoadingSpinner - Loading indicator component
 * @see public/login/index.php - Moodle login reference
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import type { PropsWithChildren, ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default login route path
 *
 * Users will be redirected to this path when they attempt to access
 * a protected route without authentication.
 */
const DEFAULT_LOGIN_PATH = '/login';

/**
 * Query parameter name for storing the return URL
 *
 * After successful login, users will be redirected back to this URL.
 * Using 'returnUrl' as it's a common convention and clearly describes purpose.
 */
const RETURN_URL_PARAM = 'returnUrl';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for ProtectedRoute component
 *
 * Extends PropsWithChildren to properly type the children prop that will be
 * rendered when the user is authenticated. Additional props allow customization
 * of redirect behavior and loading state display.
 */
export interface ProtectedRouteProps {
  /**
   * Optional custom path to redirect unauthenticated users
   *
   * Defaults to '/login'. Use this when you need to redirect to a
   * different authentication page (e.g., '/auth/login', '/signin').
   *
   * @default '/login'
   */
  redirectPath?: string;

  /**
   * Optional custom loading message to display during auth check
   *
   * Displayed alongside the loading spinner while authentication
   * status is being verified. Useful for providing context to users.
   *
   * @default 'Verifying authentication...'
   */
  loadingMessage?: string;
}

/**
 * Combined props type with PropsWithChildren
 *
 * This ensures proper TypeScript typing for the children prop,
 * following React 18 best practices for wrapper components.
 */
type ProtectedRoutePropsWithChildren = PropsWithChildren<ProtectedRouteProps>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Builds the complete redirect URL with return parameter
 *
 * Combines the login path with the current location to create a URL
 * that will redirect users back to their intended destination after login.
 *
 * @param loginPath - Base path to the login page
 * @param currentPath - Current pathname the user was attempting to access
 * @param currentSearch - Current search/query string (if any)
 * @returns Complete redirect path with encoded return URL
 *
 * @example
 * buildRedirectUrl('/login', '/dashboard', '?tab=settings')
 * // Returns: '/login?returnUrl=%2Fdashboard%3Ftab%3Dsettings'
 */
function buildRedirectUrl(
  loginPath: string,
  currentPath: string,
  currentSearch: string
): string {
  // Combine pathname and search to get the full intended URL
  const intendedUrl = currentPath + currentSearch;

  // Only add returnUrl parameter if there's actually a destination to return to
  // Avoid redirecting to empty paths or just '/'
  if (intendedUrl && intendedUrl !== '/') {
    // Encode the intended URL to safely include it as a query parameter
    const encodedReturnUrl = encodeURIComponent(intendedUrl);
    return `${loginPath}?${RETURN_URL_PARAM}=${encodedReturnUrl}`;
  }

  // If no meaningful return URL, just redirect to login without parameter
  return loginPath;
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * ProtectedRoute - Route wrapper for authenticated-only access
 *
 * Wraps child components/routes to ensure they are only rendered when
 * the user has a valid authentication session (JWT token). Provides a
 * seamless user experience by:
 *
 * 1. Showing a loading indicator during authentication verification
 * 2. Redirecting to login with preserved return URL if not authenticated
 * 3. Rendering children immediately when authenticated
 *
 * Integration with Moodle Authentication:
 * - Works alongside existing Moodle auth plugins (LDAP, OAuth, SAML, local)
 * - JWT tokens are issued after successful Moodle authentication
 * - All permission checks are enforced by backend (require_capability)
 *
 * Usage Examples:
 *
 * @example Basic usage with React Router
 * ```tsx
 * // In router configuration
 * <Route path="/dashboard" element={
 *   <ProtectedRoute>
 *     <DashboardPage />
 *   </ProtectedRoute>
 * } />
 * ```
 *
 * @example With custom redirect path
 * ```tsx
 * <ProtectedRoute redirectPath="/auth/signin">
 *   <AdminPanel />
 * </ProtectedRoute>
 * ```
 *
 * @example With custom loading message
 * ```tsx
 * <ProtectedRoute loadingMessage="Checking access permissions...">
 *   <GradeReportPage />
 * </ProtectedRoute>
 * ```
 *
 * @example Nested route protection
 * ```tsx
 * <ProtectedRoute>
 *   <Routes>
 *     <Route path="courses" element={<CoursesPage />} />
 *     <Route path="grades" element={<GradesPage />} />
 *   </Routes>
 * </ProtectedRoute>
 * ```
 *
 * @param props - Component props including children and optional configuration
 * @returns Loading spinner, redirect to login, or rendered children
 */
export function ProtectedRoute({
  children,
  redirectPath = DEFAULT_LOGIN_PATH,
  loadingMessage = 'Verifying authentication...',
}: ProtectedRoutePropsWithChildren): ReactElement {
  // Get authentication state from Redux store via useAuth hook
  // isAuthenticated: true if user has valid JWT token
  // isLoading: true during initial auth check or token refresh
  const { isAuthenticated, isLoading } = useAuth();

  // Get current location for preserving intended destination
  // pathname: the route path user was trying to access
  // search: query string parameters (if any)
  const location = useLocation();

  // ============================================================================
  // Render Logic
  // ============================================================================

  /**
   * Loading State
   *
   * During initial authentication verification (checking stored JWT token,
   * refreshing expired tokens, or initial app load), display a centered
   * loading spinner to provide visual feedback to the user.
   *
   * This prevents:
   * - Flash of login page for authenticated users
   * - Flash of protected content for unauthenticated users
   * - Jarring redirects during token refresh
   */
  if (isLoading) {
    return (
      <LoadingSpinner
        size="large"
        fullPage
        message={loadingMessage}
        ariaLabel="Verifying authentication status"
      />
    );
  }

  /**
   * Unauthenticated State
   *
   * If the user is not authenticated (no valid JWT token), redirect them
   * to the login page. The current location is preserved in the URL as
   * a query parameter so the user can be redirected back after login.
   *
   * Using Navigate component with 'replace' prop to:
   * - Avoid adding the redirect to browser history
   * - Prevent "back button" from going to protected route
   * - Create cleaner navigation flow
   */
  if (!isAuthenticated) {
    // Build redirect URL with return parameter
    const redirectUrl = buildRedirectUrl(
      redirectPath,
      location.pathname,
      location.search
    );

    return (
      <Navigate
        to={redirectUrl}
        replace
        // Also pass location state as backup for login page
        // Some login implementations prefer state over query params
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  /**
   * Authenticated State
   *
   * User has a valid authentication session. Render the protected
   * children components. At this point:
   * - JWT token is present and not expired
   * - User data is available in Redux store
   * - API calls will include Authorization header automatically
   *
   * Note: Backend API still validates tokens on each request.
   * This frontend check is for UX (avoiding showing protected UI
   * to users who would be rejected by the API anyway).
   */
  return <>{children}</>;
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Default export for convenient importing
 *
 * Allows both named and default import patterns:
 * - import ProtectedRoute from '@/features/auth/components/ProtectedRoute';
 * - import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
 */
export default ProtectedRoute;
