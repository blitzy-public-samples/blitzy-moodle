/**
 * MSW (Mock Service Worker) Setup for Playwright E2E Tests
 * 
 * This module configures request interception for Playwright E2E tests.
 * For E2E tests, we use the MSW browser worker which runs as a service worker
 * in the actual browser, allowing it to intercept real browser HTTP requests.
 * 
 * Strategy: The browser worker is initialized in main.tsx when E2E_TEST=true.
 * This setup file provides test fixtures and utilities for working with the
 * MSW browser worker in Playwright tests.
 * 
 * @module e2e/setup/msw
 */

import { test as base, expect } from '@playwright/test';

/**
 * No server setup needed - MSW browser worker is initialized in main.tsx
 * when E2E_TEST environment variable is set to 'true'.
 * 
 * The Playwright config sets E2E_TEST=true before starting the dev server,
 * and Vite exposes it to the browser via import.meta.env.E2E_TEST.
 */

/**
 * Start the MSW server (no-op for browser worker)
 * 
 * The browser worker is automatically started when the app loads.
 * This function is kept for backwards compatibility with existing tests.
 */
export function startMockServer(): void {
  console.log('[MSW] Browser worker will be started by the application');
}

/**
 * Stop the MSW server (no-op for browser worker)
 * 
 * The browser worker is managed by the browser and doesn't need explicit cleanup.
 * This function is kept for backwards compatibility with existing tests.
 */
export function stopMockServer(): void {
  console.log('[MSW] Browser worker will be stopped by the browser');
}

/**
 * Reset handlers between tests (no-op for browser worker)
 * 
 * The browser worker maintains its handlers across navigations.
 * This function is kept for backwards compatibility with existing tests.
 */
export function resetMockServer(): void {
  // No action needed for browser worker
}

/**
 * Extended Playwright test for E2E tests with MSW browser worker
 * 
 * This extends the base Playwright test but doesn't need special fixtures
 * because the MSW browser worker is automatically started by the application
 * when E2E_TEST=true (set by playwright.config.ts).
 * 
 * The browser worker intercepts all HTTP requests made by the browser
 * and returns mock responses based on our handlers.
 * 
 * Use this instead of the base `test` import in your E2E tests for consistency.
 * 
 * @example
 * ```typescript
 * import { test, expect } from './setup/msw';
 * 
 * test('should mock API calls', async ({ page }) => {
 *   // MSW browser worker is automatically active
 *   await page.goto('/login');
 *   // All browser HTTP requests are mocked
 * });
 * ```
 */
export const test = base;

// Re-export expect for convenience
export { expect };
