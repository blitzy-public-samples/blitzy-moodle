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
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { CourseCatalogPage } from '@/features/courses/pages/CourseCatalogPage';
import { FileRepositoryPage } from '@/features/courses/pages/FileRepositoryPage';
import { UserManagementPage } from '@/features/admin/users/pages/UserManagementPage';
import { ForumPage } from '@/features/activities/forums/pages/ForumPage';
import { DiscussionPage } from '@/features/activities/forums/pages/DiscussionPage';
import { QuizPage } from '@/features/activities/quizzes/pages/QuizPage';
import { QuizAttemptPage } from '@/features/activities/quizzes/pages/QuizAttemptPage';
import { QuizReviewPage } from '@/features/activities/quizzes/pages/QuizReviewPage';
import { StudentGradebookPage } from '@/features/gradebook/pages/StudentGradebookPage';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
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
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/courses',
    element: (
      <ProtectedRoute>
        <CourseCatalogPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/courses/:id/files',
    element: (
      <ProtectedRoute>
        <FileRepositoryPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/courses/:courseId/forums/:forumId',
    element: (
      <ProtectedRoute>
        <ForumPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/courses/:courseId/forums/:forumId/discussions/:discussionId',
    element: (
      <ProtectedRoute>
        <DiscussionPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/courses/:courseId/quizzes/:quizId',
    element: (
      <ProtectedRoute>
        <QuizPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/courses/:courseId/quizzes/:quizId/attempt/:attemptId',
    element: (
      <ProtectedRoute>
        <QuizAttemptPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/courses/:courseId/quizzes/:quizId/review/:attemptId',
    element: (
      <ProtectedRoute>
        <QuizReviewPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/courses/:courseId/grades',
    element: (
      <ProtectedRoute>
        <StudentGradebookPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/users',
    element: (
      <ProtectedRoute requiredPermission="moodle/site:config">
        <UserManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/demo',
    element: (
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    ),
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
