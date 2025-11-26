/**
 * MSW Request Handlers - Barrel Export
 * 
 * This file aggregates and re-exports all MSW (Mock Service Worker) request handlers
 * from individual handler modules. It provides a centralized access point for all API
 * mock handlers used throughout the test suite.
 * 
 * Usage Examples:
 * 
 * 1. Import all handlers for comprehensive API mocking:
 * ```typescript
 * import { handlers } from '@/tests/mocks/handlers';
 * import { setupServer } from 'msw/node';
 * 
 * const server = setupServer(...handlers);
 * ```
 * 
 * 2. Import specific module handlers for targeted testing:
 * ```typescript
 * import { authHandlers, coursesHandlers } from '@/tests/mocks/handlers';
 * 
 * const server = setupServer(...authHandlers, ...coursesHandlers);
 * ```
 * 
 * 3. Import individual handler arrays for fine-grained control:
 * ```typescript
 * import { quizzesHandlers } from '@/tests/mocks/handlers';
 * 
 * // Use only quiz handlers in a specific test
 * server.use(...quizzesHandlers);
 * ```
 * 
 * Adding New Handler Modules:
 * 
 * 1. Create a new handler file in this directory (e.g., `forums.ts`)
 * 2. Export a handler array (e.g., `export const forumsHandlers = [...]`)
 * 3. Import the handler array in this file
 * 4. Add it to the exports and the unified handlers array
 * 
 * @module tests/mocks/handlers
 */

import type { RequestHandler } from 'msw';

// ============================================================================
// Authentication & Authorization
// ============================================================================

/**
 * MSW handlers for authentication API endpoints.
 * Includes login, logout, token refresh, and current user retrieval.
 */
export { authHandlers } from './auth';

// ============================================================================
// User Management
// ============================================================================

/**
 * MSW handlers for user management API endpoints.
 * Includes user profile retrieval, updates, dashboard data, courses, and preferences.
 */
export { usersHandlers } from './users';

// ============================================================================
// Course Management
// ============================================================================

/**
 * MSW handlers for course management API endpoints.
 * Includes course listing, details, CRUD operations, enrollment, and content retrieval.
 */
export { coursesHandlers } from './courses';

// ============================================================================
// Learning Activities
// ============================================================================

/**
 * MSW handlers for assignment activity API endpoints.
 * Includes assignment details, submission, grading, feedback, and file management.
 */
export { assignmentsHandlers } from './assignments';

/**
 * MSW handlers for quiz activity API endpoints.
 * Includes quiz details, attempt management, question rendering, submission, and results review.
 */
export { quizzesHandlers } from './quizzes';

/**
 * MSW handlers for forum activity API endpoints.
 * Includes forum discussions, posts, subscriptions, and read status management.
 */
export { forumsHandlers } from './forums';

/**
 * MSW handlers for choice activity API endpoints.
 * Includes choice details, response submission, and results viewing.
 */
export { choicesHandlers } from './choices';

/**
 * MSW handlers for feedback activity API endpoints.
 * Includes feedback form details, response submission, and results analysis.
 */
export { feedbackHandlers } from './feedback';

/**
 * MSW handlers for H5P interactive content API endpoints.
 * Includes H5P content details, attempt tracking, and results retrieval.
 */
export { h5pHandlers } from './h5p';

/**
 * MSW handlers for resource activity API endpoints.
 * Includes resource file details, display options, and file access management.
 */
export { resourcesHandlers } from './resources';

// ============================================================================
// Assessment & Grading
// ============================================================================

/**
 * MSW handlers for gradebook API endpoints.
 * Includes course grades, user grades, grade items, categories, and reports.
 */
export { gradesHandlers } from './grades';

// ============================================================================
// Communication
// ============================================================================

/**
 * MSW handlers for messaging and notification API endpoints.
 * Includes message sending, conversation management, read status, and notifications.
 */
export { messagesHandlers } from './messages';

// ============================================================================
// File Management
// ============================================================================

/**
 * MSW handlers for file management API endpoints.
 * Includes file upload, download, deletion, repository browsing, and thumbnail generation.
 */
export { filesHandlers } from './files';

// ============================================================================
// Administration
// ============================================================================

/**
 * MSW handlers for administrative API endpoints.
 * Includes user management, course administration, role assignment, settings, and plugin configuration.
 */
export { adminHandlers } from './admin';

// ============================================================================
// Unified Handler Collection
// ============================================================================

/**
 * Import individual handler arrays for aggregation
 */
import { authHandlers } from './auth';
import { usersHandlers } from './users';
import { coursesHandlers } from './courses';
import { assignmentsHandlers } from './assignments';
import { quizzesHandlers } from './quizzes';
import { forumsHandlers } from './forums';
import { choicesHandlers } from './choices';
import { feedbackHandlers } from './feedback';
import { h5pHandlers } from './h5p';
import { resourcesHandlers } from './resources';
import { gradesHandlers } from './grades';
import { messagesHandlers } from './messages';
import { filesHandlers } from './files';
import { adminHandlers } from './admin';

/**
 * Unified collection of all MSW request handlers.
 * 
 * This array combines handlers from all modules into a single collection
 * that can be passed directly to MSW's setupServer() function for comprehensive
 * API mocking across the entire test suite.
 * 
 * The handlers are ordered by functional area:
 * 1. Authentication & Authorization
 * 2. User Management
 * 3. Course Management
 * 4. Learning Activities (Assignments, Quizzes, Forums, Choices, Feedback, H5P, Resources)
 * 5. Assessment & Grading
 * 6. Communication (Messages, Notifications)
 * 7. File Management
 * 8. Administration
 * 
 * @type {RequestHandler[]}
 */
export const handlers: RequestHandler[] = [
  ...authHandlers,
  ...usersHandlers,
  ...coursesHandlers,
  ...assignmentsHandlers,
  ...quizzesHandlers,
  ...forumsHandlers,
  ...choicesHandlers,
  ...feedbackHandlers,
  ...h5pHandlers,
  ...resourcesHandlers,
  ...gradesHandlers,
  ...messagesHandlers,
  ...filesHandlers,
  ...adminHandlers,
];

/**
 * Default export of unified handlers collection.
 * Provides convenient access when importing the entire handler set.
 */
export default handlers;
