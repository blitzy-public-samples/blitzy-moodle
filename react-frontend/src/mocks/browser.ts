/**
 * MSW Browser Worker Setup for E2E Tests
 * 
 * This file configures the Mock Service Worker for browser environments,
 * specifically for Playwright E2E tests. The browser worker intercepts
 * HTTP requests made by the browser and returns mock responses.
 * 
 * This is different from the Node.js server setup used for unit tests.
 * The browser worker runs as a service worker in the browser context.
 * 
 * @module mocks/browser
 */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * MSW Browser Worker Instance
 * 
 * This worker instance intercepts HTTP requests in the browser during
 * E2E tests and returns mock responses without making actual network calls.
 * 
 * The worker is only started when E2E_TEST environment variable is set to 'true'.
 */
export const worker = setupWorker(...handlers);

/**
 * Initialize MSW Browser Worker for E2E Tests
 * 
 * This function should be called before the React app is rendered
 * when running E2E tests. It starts the service worker and waits
 * for it to be ready before resolving.
 * 
 * @returns Promise that resolves when the worker is ready
 */
export async function initMswForE2E(): Promise<void> {
  // Only start MSW in E2E test mode
  // VITE_E2E_TEST is set to 'true' string in .env files or by Playwright
  const isE2ETest = import.meta.env.VITE_E2E_TEST === 'true';
  
  if (!isE2ETest) {
    console.log('[MSW] Not in E2E test mode, skipping browser worker initialization');
    return;
  }

  console.log('[MSW] Starting browser worker for E2E tests...');
  console.log('[MSW] Registered handlers:', handlers.length);
  
  try {
    await worker.start({
      onUnhandledRequest: (request, print) => {
        // Bypass external URLs (not targeting our API) - don't even log them
        const url = new URL(request.url);
        if (!url.origin.includes('localhost') && !url.origin.includes('127.0.0.1')) {
          return; // Silently bypass external requests
        }
        
        // Warn about unhandled local API requests only
        print.warning();
      },
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });
    console.log('[MSW] Browser worker started successfully');
    console.log('[MSW] Worker handlers:', worker.listHandlers().length);
  } catch (error) {
    console.error('[MSW] Failed to start browser worker:', error);
    throw error;
  }
}
