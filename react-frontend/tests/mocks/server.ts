/**
 * Mock Service Worker (MSW) Server Configuration
 * 
 * This module configures and exports an MSW server instance for use in Node.js test environments.
 * The server intercepts HTTP requests made during tests and returns mock responses based on
 * configured handlers, enabling comprehensive API testing without requiring a live backend.
 * 
 * @module tests/mocks/server
 * 
 * @description
 * The MSW server is configured with all request handlers from the handlers directory, which
 * includes mock endpoints for:
 * - Authentication (login, logout, refresh, me)
 * - Users (profile, dashboard, preferences)
 * - Courses (catalog, details, enrollment)
 * - Assignments (submissions, grading)
 * - Quizzes (attempts, results)
 * - Grades (gradebook data)
 * - Messages (messaging and notifications)
 * 
 * @usage
 * **In tests/setup.ts (Global Test Setup):**
 * ```typescript
 * import { server } from './mocks/server';
 * 
 * // Start server before all tests
 * beforeAll(() => server.listen({ 
 *   onUnhandledRequest: 'error' // Fail tests on unhandled requests
 * }));
 * 
 * // Reset handlers after each test to clear runtime additions
 * afterEach(() => server.resetHandlers());
 * 
 * // Close server after all tests for cleanup
 * afterAll(() => server.close());
 * ```
 * 
 * **In Individual Test Files (Override Handlers):**
 * ```typescript
 * import { server } from '@/tests/mocks/server';
 * import { http, HttpResponse } from 'msw';
 * 
 * describe('Custom API Behavior', () => {
 *   it('should handle custom response', async () => {
 *     // Override handler for this test only
 *     server.use(
 *       http.get('/api/v1/courses/:id', () => {
 *         return HttpResponse.json({ 
 *           success: true,
 *           data: { id: 1, name: 'Custom Course' }
 *         });
 *       })
 *     );
 *     
 *     // Test code that makes API call...
 *   });
 * });
 * ```
 * 
 * **Error Simulation:**
 * ```typescript
 * import { server } from '@/tests/mocks/server';
 * import { http, HttpResponse } from 'msw';
 * 
 * it('should handle API errors', async () => {
 *   server.use(
 *     http.post('/api/v1/assignments/:id/submit', () => {
 *       return HttpResponse.json(
 *         { 
 *           success: false, 
 *           error: { code: 'SUBMISSION_FAILED', message: 'File too large' }
 *         },
 *         { status: 413 }
 *       );
 *     })
 *   );
 *   
 *   // Test error handling...
 * });
 * ```
 * 
 * @see {@link https://mswjs.io/docs/api/setup-server|MSW setupServer API}
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW server instance configured for Node.js test environment
 * 
 * This server is pre-configured with all mock API request handlers from the handlers
 * directory. It intercepts HTTP requests during tests and returns mock responses,
 * enabling integration testing without a live backend.
 * 
 * @constant
 * 
 * @property {Function} listen - Starts the request interception server
 *   - Options: { onUnhandledRequest: 'bypass' | 'warn' | 'error' }
 *   - Example: server.listen({ onUnhandledRequest: 'error' })
 * 
 * @property {Function} close - Stops the server and cleans up all listeners
 *   - Should be called in afterAll() hook for proper cleanup
 *   - Example: server.close()
 * 
 * @property {Function} resetHandlers - Removes any runtime request handlers
 *   - Resets server to initial handlers configuration
 *   - Should be called in afterEach() to prevent test pollution
 *   - Example: server.resetHandlers()
 * 
 * @property {Function} use - Adds runtime request handlers for specific tests
 *   - Accepts one or more RequestHandler instances
 *   - Handlers are prepended (take precedence over initial handlers)
 *   - Example: server.use(http.get('/api/v1/custom', customHandler))
 * 
 * @property {Function} restoreHandlers - Marks all handlers as unused
 *   - Restores handlers to their initial state
 *   - Different from resetHandlers (which removes runtime handlers)
 *   - Example: server.restoreHandlers()
 * 
 * @example
 * // Global setup in tests/setup.ts
 * beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * 
 * @example
 * // Per-test override
 * server.use(
 *   http.post('/api/v1/auth/login', () => {
 *     return HttpResponse.json({ 
 *       success: false, 
 *       error: { code: 'INVALID_CREDENTIALS' }
 *     }, { status: 401 });
 *   })
 * );
 */
export const server = setupServer(...handlers);
