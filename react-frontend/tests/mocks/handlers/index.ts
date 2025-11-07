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
 * 
 * Total handler count varies based on feature implementation.
 */
export const handlers = [
  ...authHandlers,
  ...usersHandlers,
  ...coursesHandlers,
  ...assignmentsHandlers,
  ...quizzesHandlers,
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
};
