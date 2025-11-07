/**
 * MSW Server Configuration for Node.js Test Environment
 * 
 * This file configures a Mock Service Worker (MSW) server instance for use
 * in Node.js test environments (Vitest, Jest). The server intercepts HTTP
 * requests during tests and returns mock responses based on the configured
 * request handlers.
 * 
 * Features:
 * - Intercepts all API requests to /api/v1/* endpoints
 * - Returns consistent mock data for predictable testing
 * - Supports handler reset between tests for test isolation
 * - Logs warnings for unhandled requests to aid debugging
 * 
 * The server is automatically started before all tests, reset after each test,
 * and closed after all tests complete (configured in tests/setup.ts).
 * 
 * @package    react-frontend
 * @subpackage tests/mocks
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW Server Instance for Node.js Test Environment
 * 
 * This server instance is configured with all request handlers from the
 * handlers barrel file. It intercepts HTTP requests during test execution
 * and returns mock responses without making actual network calls.
 * 
 * Configuration:
 * - Environment: Node.js (via msw/node)
 * - Handlers: All handlers from ./handlers/index.ts
 * - Default behavior: Warn on unhandled requests
 * 
 * Lifecycle (managed in tests/setup.ts):
 * - beforeAll: server.listen() - Start intercepting requests
 * - afterEach: server.resetHandlers() - Reset to default handlers
 * - afterAll: server.close() - Stop intercepting and cleanup
 * 
 * Usage in tests:
 * ```typescript
 * import { server } from './mocks/server';
 * import { http, HttpResponse } from 'msw';
 * 
 * // Override a handler for a specific test
 * test('handles 404 error', () => {
 *   server.use(
 *     http.get('/api/v1/courses/:id', () => {
 *       return HttpResponse.json(
 *         { success: false, error: { code: 'NOT_FOUND' } },
 *         { status: 404 }
 *       );
 *     })
 *   );
 *   
 *   // Test code that expects 404 error...
 * });
 * ```
 * 
 * @see https://mswjs.io/docs/api/setup-server
 */
export const server = setupServer(...handlers);
