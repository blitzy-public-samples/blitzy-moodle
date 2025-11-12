/**
 * Application Router Configuration
 *
 * Defines all application routes using React Router v6.
 * Routes are organized by feature module with lazy loading for code splitting.
 *
 * @module app/router
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import App from '@/App';

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * Application Router
 *
 * Route Structure:
 * - / - Root redirects to /dashboard
 * - /login - Login page (public)
 * - /dashboard - Dashboard page (protected, to be implemented)
 * - Additional routes will be added as features are implemented
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/dashboard',
    element: (
      <div>
        <h1>Dashboard</h1>
        <p>Dashboard implementation coming soon...</p>
      </div>
    ),
  },
  {
    path: '/demo',
    element: <App />,
  },
  {
    path: '*',
    element: (
      <div>
        <h1>404 - Page Not Found</h1>
        <p>The page you are looking for does not exist.</p>
      </div>
    ),
  },
]);

export default router;
