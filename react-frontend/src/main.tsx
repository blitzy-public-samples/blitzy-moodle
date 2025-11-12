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
 */
async function initializeApp() {
  // Check if we're running E2E tests
  // VITE_E2E_TEST is set in .env files or via environment variables
  const isE2ETest = import.meta.env.VITE_E2E_TEST === 'true';
  
  if (isE2ETest) {
    console.log('[App] E2E test mode detected, initializing MSW...');
    const { initMswForE2E } = await import('./mocks/browser');
    await initMswForE2E();
    console.log('[App] MSW initialized, rendering app');
  }
  
  // Render the app
  root.render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>
  );
}

// Initialize and render the app
initializeApp().catch((error) => {
  console.error('[App] Failed to initialize application:', error);
});
