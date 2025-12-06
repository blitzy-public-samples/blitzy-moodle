/**
 * AppLayout Component
 *
 * Main authenticated application layout component providing the overall page structure
 * with header, sidebar navigation, breadcrumb trail, and content area. Composes Header,
 * Sidebar, and Breadcrumbs navigation components into a cohesive full-application chrome.
 *
 * Architecture:
 * - Uses Material-UI Box component with flex layout for responsive two-column design
 * - Implements drawer width calculations (240px sidebar on desktop, temporary drawer on mobile)
 * - Integrates with Redux for sidebar open/close state management
 * - Includes React Error Boundary for graceful error handling
 * - Wraps children in React Suspense with LoadingSpinner fallback
 *
 * Layout Structure:
 * - Header: Sticky top navigation bar (position='sticky', z-index above sidebar)
 * - Sidebar: Left drawer (permanent on desktop >=md, temporary overlay on mobile <md)
 * - Main Content: Scrollable area with breadcrumbs above children
 *
 * Responsive Behavior:
 * - Desktop (>=md): Permanent sidebar with 240px width, content has marginLeft offset
 * - Mobile (<md): Temporary drawer overlay, content takes full width
 *
 * Features:
 * - Consistent spacing, content padding, and scroll behavior
 * - Proper z-index layering for header, sidebar, and content
 * - WCAG 2.1 AA accessibility with proper landmark roles
 * - Focus management for accessible navigation
 * - Error boundary with user-friendly fallback UI
 *
 * Design Reference:
 * - Moodle theme_boost drawer-based layout (drawers.php, drawers.mustache)
 * - Material Design navigation drawer patterns
 *
 * @module components/layouts/AppLayout
 * @copyright 2024 Moodle React Frontend Migration
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { Suspense, type ReactNode, type ErrorInfo } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

// Internal component imports
import Header from '@/components/navigation/Header';
import Sidebar, { DRAWER_WIDTH } from '@/components/navigation/Sidebar';
import Breadcrumbs from '@/components/navigation/Breadcrumbs';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';

// Redux imports
import { useAppSelector } from '@/app/store';
import { selectSidebarIsOpen } from '@/app/slices/sidebarSlice';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * AppLayout component props interface
 *
 * Defines the properties accepted by the AppLayout component.
 * All props except children are optional with sensible defaults.
 *
 * @interface AppLayoutProps
 */
export interface AppLayoutProps {
  /**
   * Child components to render in the main content area
   *
   * Typically React Router Outlet or page-level components.
   * Children are wrapped in Suspense for lazy loading support.
   *
   * @type {ReactNode}
   * @required
   */
  children: ReactNode;

  /**
   * Optional CSS class name for custom styling
   *
   * Applied to the root container Box element.
   * Useful for page-specific layout adjustments or testing selectors.
   *
   * @type {string}
   * @optional
   */
  className?: string;
}

// ============================================================================
// Error Boundary Configuration
// ============================================================================

/**
 * Error fallback component rendered when an error is caught
 *
 * Displays a user-friendly error message with a reload button.
 * Provides clear call-to-action for error recovery.
 *
 * @param props - Fallback component props from react-error-boundary
 * @returns Error fallback UI
 */
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps): JSX.Element {
  return (
    <Box
      role="alert"
      aria-live="assertive"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        padding: 4,
        textAlign: 'center',
      }}
    >
      <Box
        component="h2"
        sx={{
          fontSize: '1.5rem',
          fontWeight: 600,
          color: 'error.main',
          marginBottom: 2,
        }}
      >
        Something went wrong
      </Box>

      <Box
        component="p"
        sx={{
          color: 'text.secondary',
          marginBottom: 3,
          maxWidth: 500,
        }}
      >
        An unexpected error occurred while loading this page. Please try again or contact support if
        the problem persists.
      </Box>

      {/* Error details for development - only show in non-production */}
      {process.env.NODE_ENV !== 'production' && error.message && (
        <Box
          component="pre"
          sx={{
            padding: 2,
            backgroundColor: 'grey.100',
            borderRadius: 1,
            fontSize: '0.75rem',
            color: 'error.dark',
            maxWidth: '100%',
            overflow: 'auto',
            marginBottom: 3,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {error.message}
        </Box>
      )}

      <Box
        component="button"
        onClick={resetErrorBoundary}
        sx={{
          padding: '12px 24px',
          fontSize: '1rem',
          fontWeight: 500,
          color: 'white',
          backgroundColor: 'primary.main',
          border: 'none',
          borderRadius: 1,
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
          '&:hover': {
            backgroundColor: 'primary.dark',
          },
          '&:focus': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        }}
        type="button"
        aria-label="Reload page to try again"
      >
        Reload Page
      </Box>
    </Box>
  );
}

/**
 * Error handler for logging errors
 *
 * Called when an error is caught by the error boundary.
 * Logs error details for debugging and monitoring.
 *
 * @param error - The error that was caught
 * @param info - Additional error information including component stack
 */
function handleError(error: Error, info: ErrorInfo): void {
  // Log error to console in development
  console.error('AppLayout Error Boundary caught error:', error);
  console.error('Component stack:', info.componentStack);

  // In production, this would send to error tracking service
  // Example: errorTrackingService.logError(error, info);
}

/**
 * Handle error boundary reset
 *
 * Called when the user clicks the reload button.
 * Reloads the page to attempt recovery.
 */
function handleReset(): void {
  // Reload the page to reset application state
  window.location.reload();
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * AppLayout Component
 *
 * Main authenticated application layout wrapper providing consistent page structure
 * with header, sidebar navigation, breadcrumbs, and content area. Essential wrapper
 * for all authenticated pages including dashboard, courses, assignments, and user pages.
 *
 * Layout Architecture:
 * ```
 * ┌──────────────────────────────────────────────────────────────────┐
 * │                         Header (sticky)                          │
 * ├────────────────┬─────────────────────────────────────────────────┤
 * │                │                                                  │
 * │    Sidebar     │              Main Content Area                  │
 * │    (240px)     │    ┌────────────────────────────────────────┐   │
 * │                │    │         Breadcrumbs                    │   │
 * │  - Dashboard   │    ├────────────────────────────────────────┤   │
 * │  - Courses     │    │                                        │   │
 * │  - Messages    │    │           Page Content                 │   │
 * │  - Grades      │    │          (children)                    │   │
 * │  - Admin       │    │                                        │   │
 * │                │    │                                        │   │
 * │                │    └────────────────────────────────────────┘   │
 * │                │                                                  │
 * └────────────────┴─────────────────────────────────────────────────┘
 * ```
 *
 * Responsive Behavior:
 * - Desktop (>=md breakpoint): Sidebar is permanent, content has left margin
 * - Mobile (<md breakpoint): Sidebar is temporary overlay, content is full width
 *
 * State Management:
 * - Sidebar open/close state from Redux (sidebar.isOpen)
 * - Mobile detection via MUI useMediaQuery hook
 *
 * Accessibility Features:
 * - role="main" on content area for screen reader navigation
 * - Proper landmark structure (header, nav, main)
 * - Focus management for navigation
 * - Error boundary with accessible error messages
 *
 * @param props - Component properties
 * @returns Rendered application layout
 *
 * @example
 * ```tsx
 * // In router configuration
 * <Route path="/dashboard" element={
 *   <AppLayout>
 *     <DashboardPage />
 *   </AppLayout>
 * } />
 *
 * // With Outlet for nested routes
 * <Route path="/" element={<AppLayout><Outlet /></AppLayout>}>
 *   <Route path="courses" element={<CoursesPage />} />
 *   <Route path="profile" element={<ProfilePage />} />
 * </Route>
 * ```
 */
function AppLayout({ children, className }: AppLayoutProps): JSX.Element {
  // Access MUI theme for breakpoint values
  const theme = useTheme();

  // Detect mobile breakpoint for responsive layout
  // Mobile: screen width < md (960px by default in MUI v5)
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Get sidebar open state from Redux store
  const sidebarIsOpen = useAppSelector(selectSidebarIsOpen);

  // Calculate main content margin based on sidebar state and screen size
  // On desktop with sidebar open: add marginLeft offset
  // On mobile or with sidebar closed: no margin (full width)
  const contentMarginLeft = !isMobile && sidebarIsOpen ? `${DRAWER_WIDTH}px` : 0;

  // Calculate content transition for smooth margin changes
  const contentTransition = theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  });

  const contentTransitionOpen = theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.easeOut,
    duration: theme.transitions.duration.enteringScreen,
  });

  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'background.default',
      }}
      data-testid="app-layout"
    >
      {/* Header - Sticky top navigation bar */}
      <Header />

      {/* Sidebar - Left navigation drawer */}
      <Sidebar />

      {/* Main content area */}
      <Box
        component="main"
        role="main"
        aria-label="Main content"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          minHeight: '100vh',
          marginLeft: contentMarginLeft,
          transition: sidebarIsOpen ? contentTransitionOpen : contentTransition,
          // Account for header height with top padding
          paddingTop: {
            xs: '56px', // Mobile header height (Toolbar dense)
            sm: '64px', // Desktop header height (Toolbar regular)
          },
          width: isMobile ? '100%' : `calc(100% - ${sidebarIsOpen ? DRAWER_WIDTH : 0}px)`,
          overflow: 'hidden',
        }}
      >
        {/* Scrollable content container */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            overflow: 'auto',
            padding: {
              xs: 2, // 16px on mobile
              sm: 3, // 24px on tablet and up
            },
          }}
        >
          {/* Breadcrumb navigation - above main content */}
          <Box
            sx={{
              marginBottom: {
                xs: 2, // 16px on mobile
                sm: 3, // 24px on tablet and up
              },
            }}
          >
            <Breadcrumbs />
          </Box>

          {/* Error Boundary - catches errors in children */}
          <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onError={handleError}
            onReset={handleReset}
          >
            {/* Suspense - handles lazy-loaded route components */}
            <Suspense
              fallback={
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '50vh',
                  }}
                >
                  <LoadingSpinner size="large" message="Loading content..." />
                </Box>
              }
            >
              {/* Page content - rendered inside content area */}
              <Box
                sx={{
                  flexGrow: 1,
                }}
              >
                {children}
              </Box>
            </Suspense>
          </ErrorBoundary>
        </Box>
      </Box>
    </Box>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default AppLayout;

// Named exports for flexibility
export { AppLayout };
