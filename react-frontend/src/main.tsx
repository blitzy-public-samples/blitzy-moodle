import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Providers } from './app/providers';
import { router } from './app/router';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

const root = createRoot(rootElement);

/**
 * Initialize the application
 * 
 * For E2E tests, we need to start the MSW browser worker before rendering
 * the app to ensure API requests are intercepted.
 * 
 * IMPORTANT: Use window object to store initialization state to prevent
 * double initialization even if the module is loaded multiple times.
 */

// Extend window interface for TypeScript
declare global {
  interface Window {
    __APP_INITIALIZING__?: boolean;
    __APP_INITIALIZED__?: boolean;
    __APP_INIT_COUNT__?: number;
  }
}

async function initializeApp() {
  // Initialize counters on window if not present
  if (typeof window.__APP_INIT_COUNT__ === 'undefined') {
    window.__APP_INIT_COUNT__ = 0;
  }
  
  const callId = ++window.__APP_INIT_COUNT__;
  const timestamp = new Date().toISOString();
  const windowId = (window as any).__WINDOW_ID__ || ((window as any).__WINDOW_ID__ = Math.random().toString(36));
  console.log(`[App ${callId} @ ${timestamp}] initializeApp called - windowId:`, windowId, 'isInitializing:', window.__APP_INITIALIZING__, 'isInitialized:', window.__APP_INITIALIZED__);
  
  // Atomic check-and-set to prevent double initialization
  // This handles race conditions when module is loaded multiple times simultaneously
  if (window.__APP_INITIALIZING__ || window.__APP_INITIALIZED__) {
    console.log(`[App ${callId}] Skipping - already initialized or initializing`);
    return;
  }
  
  // Set flag immediately to block any concurrent calls
  window.__APP_INITIALIZING__ = true;
  console.log(`[App ${callId}] Set __APP_INITIALIZING__ = true, windowId:`, windowId);
  
  // Check if we're running E2E tests
  // VITE_E2E_TEST is set in .env files or via environment variables
  const isE2ETest = import.meta.env.VITE_E2E_TEST === 'true';
  
  console.log(`[App ${callId}] __APP_INITIALIZING__ check passed, continuing...`);
  console.log(`[App ${callId}] Environment check - VITE_E2E_TEST:`, import.meta.env.VITE_E2E_TEST);
  console.log(`[App ${callId}] isE2ETest:`, isE2ETest);
  console.log(`[App ${callId}] DEV mode:`, import.meta.env.DEV);
  console.log(`[App ${callId}] Will use StrictMode:`, import.meta.env.DEV && !isE2ETest);
  
  if (isE2ETest) {
    console.log(`[App ${callId}] E2E test mode detected, initializing MSW...`);
    try {
      const { initMswForE2E } = await import('./mocks/browser');
      await initMswForE2E();
      console.log(`[App ${callId}] MSW initialized, rendering app`);
    } catch (error) {
      // MSW initialization failed - log error but continue rendering app
      // This can happen in some browsers (e.g., WebKit) with dynamic imports
      console.error(`[App ${callId}] Failed to initialize MSW (continuing without mocking):`, error);
      console.warn(`[App ${callId}] E2E tests may fail due to unmocked API calls`);
    }
  }
  
  // Render the app
  // Note: StrictMode disabled for E2E tests to prevent double-invocation of state updaters
  // which causes timers to run twice as fast
  console.log(`[App ${callId}] About to render app, StrictMode:`, import.meta.env.DEV && !isE2ETest);
  const app = (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
  
  root.render(
    import.meta.env.DEV && !isE2ETest ? <StrictMode>{app}</StrictMode> : app
  );
  console.log(`[App ${callId}] App rendered`);
  
  window.__APP_INITIALIZED__ = true;
  window.__APP_INITIALIZING__ = false;
}

// Initialize and render the app
initializeApp().catch((error) => {
  console.error('[App] Failed to initialize application:', error);
  // Last resort: render the app anyway
  const app = (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
  const isE2ETest = import.meta.env.VITE_E2E_TEST === 'true';
  root.render(
    import.meta.env.DEV && !isE2ETest ? <StrictMode>{app}</StrictMode> : app
  );
});
