/**
 * MSW Request Handlers - Central Barrel Export
 * 
 * This file aggregates and re-exports all Mock Service Worker (MSW) request
 * handlers from individual feature modules. It provides a single entry point
 * for importing all handlers when configuring the MSW server.
 * 
 * Handler modules included:
 * - auth: Authentication endpoints (login, logout, refresh, me)
 * - users: User management endpoints (profile, dashboard, preferences)
 * - courses: Course management endpoints (CRUD, enrollment, contents)
 * - assignments: Assignment activity endpoints (view, submit, grade)
 * - quizzes: Quiz activity endpoints (attempt, submit, review)
 * - forums: Forum activity endpoints (discussions, posts, subscriptions)
 * - feedback: Feedback activity endpoints (questions, responses, analysis)
 * - admin: Admin endpoints (settings, users, roles, plugins)
 * 
 * Usage:
 * ```typescript
 * import { handlers } from './mocks/handlers';
 * import { setupServer } from 'msw/node';
 * 
 * const server = setupServer(...handlers);
 * ```
 * 
 * @package    react-frontend
 * @subpackage tests/mocks/handlers
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Import individual handler arrays from feature modules
import { authHandlers } from './auth';
import { usersHandlers } from './users';
import { coursesHandlers } from './courses';
import { assignmentsHandlers } from './assignments';
import { quizzesHandlers } from './quizzes';
import { forumsHandlers } from './forums';
import { feedbackHandlers } from './feedback';
import { adminHandlers } from './admin';

/**
 * Combined array of all MSW request handlers
 * 
 * This array contains all handlers from all feature modules, ready to be
 * passed to setupServer() or setupWorker() for MSW configuration.
 * 
 * The handlers are ordered by feature module:
 * 1. Authentication (4 handlers)
 * 2. Users (multiple handlers)
 * 3. Courses (multiple handlers)
 * 4. Assignments (multiple handlers)
 * 5. Quizzes (multiple handlers)
 * 6. Forums (multiple handlers)
 * 7. Feedback (multiple handlers)
 * 8. Admin (multiple handlers)
 * 
 * Total handler count varies based on feature implementation.
 */
export const handlers = [
  ...authHandlers,
  ...usersHandlers,
  ...coursesHandlers,
  ...assignmentsHandlers,
  ...quizzesHandlers,
  ...forumsHandlers,
  ...feedbackHandlers,
  ...adminHandlers,
];

/**
 * Re-export individual handler arrays for granular test control
 * 
 * These exports allow tests to import specific handler groups when they
 * need fine-grained control over which endpoints are mocked.
 * 
 * @example
 * ```typescript
 * import { authHandlers } from './mocks/handlers';
 * const server = setupServer(...authHandlers); // Only mock auth endpoints
 * ```
 */
export {
  authHandlers,
  usersHandlers,
  coursesHandlers,
  assignmentsHandlers,
  quizzesHandlers,
  forumsHandlers,
  feedbackHandlers,
  adminHandlers,
};
