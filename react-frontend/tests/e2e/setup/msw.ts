/**
 * MSW (Mock Service Worker) Setup for Playwright E2E Tests
 * 
 * This module configures request interception for Playwright E2E tests using MSW's Node.js server.
 * It intercepts HTTP requests made by both the browser and the test runner (page.request),
 * enabling fast and reliable E2E tests without depending on a real backend.
 * 
 * Strategy: Use MSW's setupServer() to intercept all HTTP requests at the Node.js level,
 * which works for both browser page requests AND direct API calls from page.request.
 * 
 * @module e2e/setup/msw
 */

import { test as base, expect } from '@playwright/test';
import type { Page, BrowserContext } from '@playwright/test';
import { setupServer } from 'msw/node';

// Import all our mock handlers from the central barrel export
import { handlers } from '../../mocks/handlers';

/**
 * Create MSW server for Node.js-level HTTP interception
 * 
 * This server intercepts ALL HTTP requests (including page.request calls)
 * and handles them with our mock handlers.
 */
export const server = setupServer(...handlers);

/**
 * Start the MSW server
 * 
 * This should be called once before all tests in the test suite.
 */
export function startMockServer(): void {
  server.listen({
    onUnhandledRequest: 'warn', // Warn about unhandled requests
  });
  console.log('[MSW] Mock server started');
}

/**
 * Stop the MSW server
 * 
 * This should be called once after all tests in the test suite.
 */
export function stopMockServer(): void {
  server.close();
  console.log('[MSW] Mock server stopped');
}

/**
 * Reset handlers between tests
 * 
 * This resets the server to its initial handlers, clearing any runtime
 * modifications made during individual tests.
 */
export function resetMockServer(): void {
  server.resetHandlers();
}

/**
 * Extended Playwright test with API mocking fixtures
 * 
 * This extends the base Playwright test with automatic MSW server management.
 * The MSW server is started once before all tests and stopped after all tests.
 * Between individual tests, handlers are reset to their initial state.
 * 
 * This approach ensures that ALL HTTP requests (including page.request API calls)
 * are intercepted and mocked properly.
 * 
 * Use this instead of the base `test` import in your E2E tests.
 * 
 * @example
 * ```typescript
 * import { test, expect } from './setup/msw';
 * 
 * test('should mock API calls', async ({ page }) => {
 *   // API mocking is automatically set up
 *   await page.goto('/login');
 *   // Both page navigation and page.request calls are mocked
 * });
 * ```
 */
export const test = base.extend({
  // Run once before all tests in the worker
  // eslint-disable-next-line no-empty-pattern
  workerStorageState: [async ({}, use) => {
    // Start MSW server once per worker (each worker gets its own server)
    startMockServer();
    
    await use(undefined);
    
    // Stop MSW server after all tests in worker complete
    stopMockServer();
  }, { scope: 'worker', auto: true }],
  
  // Reset handlers before each test
  // eslint-disable-next-line no-empty-pattern
  autoMockReset: [async ({}, use) => {
    // Reset handlers to initial state before each test
    resetMockServer();
    
    await use(undefined);
  }, { auto: true }],
});

// Re-export expect for convenience
export { expect };
