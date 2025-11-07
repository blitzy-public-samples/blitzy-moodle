/**
 * Custom helper to wait for React Query state changes
 * This is needed because @testing-library/react's waitFor doesn't properly
 * handle React Query state updates in the test environment (happy-dom + vitest).
 * 
 * React Query state updates require 2-3 polling cycles to propagate through:
 * 1. Promise resolution
 * 2. React Query internal state update
 * 3. Test renderer re-render
 * 4. happy-dom event loop processing
 */
export async function waitForQueryState<T>(
  getCurrentState: () => T,
  predicate: (state: T) => boolean,
  options: {
    timeout?: number;
    interval?: number;
    onTimeout?: string;
  } = {}
): Promise<T> {
  const {
    timeout = 5000,
    interval = 50,
    onTimeout = 'Timeout waiting for query state'
  } = options;

  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const state = getCurrentState();
    
    if (predicate(state)) {
      return state;
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(onTimeout);
}
