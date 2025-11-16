/**
 * Async Testing Utilities
 * 
 * Comprehensive utilities for testing asynchronous operations in React applications.
 * Provides helpers for waiting on API calls, React Query mutations, state updates,
 * and other asynchronous side effects.
 * 
 * @module tests/helpers/asyncUtils
 */

import {
  waitFor as rtlWaitFor,
  waitForElementToBeRemoved as rtlWaitForElementToBeRemoved,
  screen,
} from '@testing-library/react';
import { expect } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';

// ============================================================================
// Global Type Extensions
// ============================================================================

/**
 * API call tracking information
 */
interface ApiCallInfo {
  url: string;
  method: string;
  timestamp: number;
}

/**
 * API response data
 */
interface ApiResponseData {
  [url: string]: unknown;
}

/**
 * Test state tracking
 */
interface TestStateData {
  [key: string]: unknown;
}

/**
 * Extend globalThis with test utilities
 */
declare global {
  // eslint-disable-next-line no-var
  var __queryClient__: QueryClient | undefined;
  // eslint-disable-next-line no-var
  var __apiCalls__: ApiCallInfo[] | undefined;
  // eslint-disable-next-line no-var
  var __apiResponses__: ApiResponseData | undefined;
  // eslint-disable-next-line no-var
  var __currentState__: TestStateData | undefined;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default timeout for async operations (5 seconds)
 */
export const DEFAULT_TIMEOUT = 5000;

/**
 * Default polling interval for waitFor checks (50ms)
 */
export const DEFAULT_INTERVAL = 50;

/**
 * Default debounce wait time (300ms)
 */
export const DEFAULT_DEBOUNCE_MS = 300;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Options for waitFor operations
 */
interface WaitOptions {
  timeout?: number;
  interval?: number;
}

/**
 * Query key type for React Query
 */
type QueryKey = readonly unknown[];

// ============================================================================
// React Testing Library Async Utilities (Re-exports with Enhancements)
// ============================================================================

/**
 * Wait for a condition to be truthy with enhanced defaults.
 * Re-export from @testing-library/react with custom timeout and interval.
 * 
 * @example
 * await waitFor(() => {
 *   expect(screen.getByText('Success')).toBeInTheDocument();
 * });
 * 
 * @param callback - Function that should eventually not throw
 * @param options - Timeout and interval options
 */
export const waitFor = async <T>(
  callback: () => T | Promise<T>,
  options?: WaitOptions
): Promise<T> => {
  return rtlWaitFor(callback, {
    timeout: options?.timeout ?? DEFAULT_TIMEOUT,
    interval: options?.interval ?? DEFAULT_INTERVAL,
  });
};

/**
 * Wait for an element to be removed from the DOM.
 * Re-export from @testing-library/react with enhanced error messages.
 * 
 * @example
 * await waitForElementToBeRemoved(() => screen.queryByRole('progressbar'));
 * 
 * @param callback - Function returning element(s) to wait for removal
 * @param options - Timeout and interval options
 */
export const waitForElementToBeRemoved = async <T>(
  callback: (() => T) | T,
  options?: WaitOptions
): Promise<void> => {
  return rtlWaitForElementToBeRemoved(callback, {
    timeout: options?.timeout ?? DEFAULT_TIMEOUT,
    interval: options?.interval ?? DEFAULT_INTERVAL,
  });
};

// ============================================================================
// React Query Async Utilities
// ============================================================================

/**
 * Wait for a React Query query to succeed.
 * Polls the QueryClient cache until the specified query has successful data.
 * 
 * @example
 * await waitForQuery(['courses', courseId]);
 * expect(screen.getByText('Course Title')).toBeInTheDocument();
 * 
 * @param queryKey - The query key to wait for
 * @param options - Timeout and interval options
 */
export const waitForQuery = async (
  queryKey: QueryKey,
  options?: WaitOptions
): Promise<void> => {
  await waitFor(
    () => {
      // In a test environment, we need to access the QueryClient from the test context
      // This is typically available through a test wrapper
      const queryCache = globalThis.__queryClient__;
      if (!queryCache) {
        throw new Error(
          'QueryClient not found. Ensure your test wrapper provides __queryClient__ globally.'
        );
      }
      
      const query = queryCache.getQueryState(queryKey);
      if (query?.status !== 'success') {
        throw new Error(`Query ${JSON.stringify(queryKey)} not yet successful`);
      }
    },
    options
  );
};

/**
 * Wait for any active mutation to complete.
 * Useful when testing form submissions or data updates.
 * 
 * @example
 * fireEvent.click(screen.getByRole('button', { name: 'Save' }));
 * await waitForMutation();
 * expect(screen.getByText('Saved successfully')).toBeInTheDocument();
 * 
 * @param options - Timeout and interval options
 */
export const waitForMutation = async (options?: WaitOptions): Promise<void> => {
  await waitFor(
    () => {
      const queryCache = globalThis.__queryClient__;
      if (!queryCache) {
        throw new Error(
          'QueryClient not found. Ensure your test wrapper provides __queryClient__ globally.'
        );
      }
      
      const isMutating = queryCache.isMutating();
      if (isMutating > 0) {
        throw new Error('Mutations still in progress');
      }
    },
    options
  );
};

/**
 * Wait for a query to succeed and return its data.
 * 
 * @example
 * const course = await waitForQuerySuccess<Course>(['courses', courseId]);
 * expect(course.title).toBe('Introduction to React');
 * 
 * @param queryKey - The query key to wait for
 * @param options - Timeout and interval options
 * @returns The query data
 */
export const waitForQuerySuccess = async <T>(
  queryKey: QueryKey,
  options?: WaitOptions
): Promise<T> => {
  let data: T | undefined;
  
  await waitFor(
    () => {
      const queryCache = globalThis.__queryClient__;
      if (!queryCache) {
        throw new Error(
          'QueryClient not found. Ensure your test wrapper provides __queryClient__ globally.'
        );
      }
      
      const query = queryCache.getQueryState(queryKey);
      if (query?.status !== 'success') {
        throw new Error(`Query ${JSON.stringify(queryKey)} not yet successful`);
      }
      
      data = query.data as T;
    },
    options
  );
  
  if (data === undefined) {
    throw new Error(`Query data was not available after successful completion`);
  }
  
  return data;
};

/**
 * Wait for a query to fail and return its error.
 * 
 * @example
 * const error = await waitForQueryError(['courses', 'invalid-id']);
 * expect(error.message).toContain('Not found');
 * 
 * @param queryKey - The query key to wait for
 * @param options - Timeout and interval options
 * @returns The query error
 */
export const waitForQueryError = async (
  queryKey: QueryKey,
  options?: WaitOptions
): Promise<Error> => {
  let error: Error | undefined;
  
  await waitFor(
    () => {
      const queryCache = globalThis.__queryClient__;
      if (!queryCache) {
        throw new Error(
          'QueryClient not found. Ensure your test wrapper provides __queryClient__ globally.'
        );
      }
      
      const query = queryCache.getQueryState(queryKey);
      if (query?.status !== 'error') {
        throw new Error(`Query ${JSON.stringify(queryKey)} has not errored yet`);
      }
      
      error = query.error as Error;
    },
    options
  );
  
  if (error === undefined) {
    throw new Error(`Query error was not available after error state`);
  }
  
  return error;
};

/**
 * Wait for all loading states to complete (queries and mutations).
 * 
 * @example
 * render(<Dashboard />);
 * await waitForLoadingToFinish();
 * expect(screen.getByText('Welcome')).toBeInTheDocument();
 * 
 * @param options - Timeout and interval options
 */
export const waitForLoadingToFinish = async (
  options?: WaitOptions
): Promise<void> => {
  await waitFor(
    () => {
      const queryCache = globalThis.__queryClient__;
      if (!queryCache) {
        throw new Error(
          'QueryClient not found. Ensure your test wrapper provides __queryClient__ globally.'
        );
      }
      
      const isFetching = queryCache.isFetching();
      const isMutating = queryCache.isMutating();
      
      if (isFetching > 0 || isMutating > 0) {
        throw new Error(
          `Still loading: ${isFetching} queries fetching, ${isMutating} mutations in progress`
        );
      }
    },
    options
  );
};

// ============================================================================
// API Call Waiting
// ============================================================================

/**
 * Wait for a specific API call to complete.
 * Works with MSW (Mock Service Worker) mocked requests.
 * 
 * @example
 * await waitForApiCall('/api/v1/courses/5', 'GET');
 * expect(screen.getByText('Course Title')).toBeInTheDocument();
 * 
 * @param url - The API endpoint URL
 * @param method - HTTP method (default: 'GET')
 * @param options - Timeout and interval options
 */
export const waitForApiCall = async (
  url: string,
  method: string = 'GET',
  options?: WaitOptions
): Promise<void> => {
  await waitFor(
    () => {
      const apiCalls = globalThis.__apiCalls__ ?? [];
      const found = apiCalls.some(
        (call: { url: string; method: string }) =>
          call.url.includes(url) && call.method === method
      );
      
      if (!found) {
        throw new Error(`API call ${method} ${url} not yet made`);
      }
    },
    options
  );
};

/**
 * Wait for any API call to complete.
 * 
 * @example
 * fireEvent.click(screen.getByRole('button', { name: 'Load Data' }));
 * await waitForAnyApiCall();
 * 
 * @param options - Timeout and interval options
 */
export const waitForAnyApiCall = async (options?: WaitOptions): Promise<void> => {
  await waitFor(
    () => {
      const apiCalls = globalThis.__apiCalls__ ?? [];
      if (apiCalls.length === 0) {
        throw new Error('No API calls made yet');
      }
    },
    options
  );
};

/**
 * Wait for an API call and return its response data.
 * 
 * @example
 * const course = await waitForApiResponse<Course>('/api/v1/courses/5');
 * expect(course.title).toBe('Introduction to React');
 * 
 * @param url - The API endpoint URL
 * @param options - Timeout and interval options
 * @returns The response data
 */
export const waitForApiResponse = async <T>(
  url: string,
  options?: WaitOptions
): Promise<T> => {
  let response: T | undefined;
  
  await waitFor(
    () => {
      const apiResponses = globalThis.__apiResponses__ ?? {};
      response = apiResponses[url] as T;
      
      if (!response) {
        throw new Error(`No response yet for ${url}`);
      }
    },
    options
  );
  
  if (response === undefined) {
    throw new Error(`API response was not available`);
  }
  
  return response;
};

// ============================================================================
// State Update Waiting
// ============================================================================

/**
 * Wait for a state value to match an expected value.
 * 
 * @example
 * await waitForStateUpdate(
 *   () => store.getState().user.isAuthenticated,
 *   true
 * );
 * 
 * @param selector - Function that returns the current state value
 * @param expectedValue - The expected value to wait for
 * @param options - Timeout and interval options
 */
export const waitForStateUpdate = async <T>(
  selector: () => T,
  expectedValue: T,
  options?: WaitOptions
): Promise<void> => {
  await waitFor(
    () => {
      const currentValue = selector();
      if (currentValue !== expectedValue) {
        throw new Error(
          `State not yet updated. Current: ${JSON.stringify(currentValue)}, Expected: ${JSON.stringify(expectedValue)}`
        );
      }
    },
    options
  );
};

/**
 * Wait for a condition to become true.
 * 
 * @example
 * await waitForCondition(() => items.length > 0, { timeout: 3000 });
 * 
 * @param condition - Function that returns true when condition is met
 * @param options - Timeout and interval options
 */
export const waitForCondition = async (
  condition: () => boolean,
  options?: WaitOptions
): Promise<void> => {
  await waitFor(
    () => {
      if (!condition()) {
        throw new Error('Condition not yet met');
      }
    },
    options
  );
};

/**
 * Wait for the next React render/update.
 * 
 * @example
 * fireEvent.click(screen.getByRole('button'));
 * await waitForNextUpdate();
 * expect(screen.getByText('Updated')).toBeInTheDocument();
 * 
 * @param options - Timeout and interval options
 */
export const waitForNextUpdate = async (options?: WaitOptions): Promise<void> => {
  // Use a short delay to allow React to process the update
  await new Promise(resolve => setTimeout(resolve, options?.interval ?? DEFAULT_INTERVAL));
};

// ============================================================================
// Loading State Utilities
// ============================================================================

/**
 * Wait for a loading spinner to appear.
 * 
 * @example
 * fireEvent.click(screen.getByRole('button', { name: 'Load' }));
 * await waitForLoadingSpinner();
 * 
 * @param options - Timeout and interval options
 */
export const waitForLoadingSpinner = async (
  options?: WaitOptions
): Promise<void> => {
  await waitFor(
    () => {
      const spinner = screen.queryByRole('progressbar') ?? screen.queryByTestId('loading-spinner');
      if (!spinner) {
        throw new Error('Loading spinner not found');
      }
    },
    options
  );
};

/**
 * Wait for the loading spinner to disappear.
 * 
 * @example
 * await waitForLoadingSpinnerToDisappear();
 * expect(screen.getByText('Data Loaded')).toBeInTheDocument();
 * 
 * @param options - Timeout and interval options
 */
export const waitForLoadingSpinnerToDisappear = async (
  options?: WaitOptions
): Promise<void> => {
  await waitFor(
    () => {
      const spinner = screen.queryByRole('progressbar') ?? screen.queryByTestId('loading-spinner');
      if (spinner) {
        throw new Error('Loading spinner still present');
      }
    },
    options
  );
};

/**
 * Assert that a loading indicator is present (synchronous).
 * 
 * @example
 * expectLoadingState();
 */
export const expectLoadingState = (): void => {
  const spinner = screen.queryByRole('progressbar') ?? screen.queryByTestId('loading-spinner');
  expect(spinner).toBeDefined();
  expect(spinner).not.toBeNull();
};

/**
 * Assert that no loading indicator is present (synchronous).
 * 
 * @example
 * expectNotLoadingState();
 */
export const expectNotLoadingState = (): void => {
  const spinner = screen.queryByRole('progressbar') ?? screen.queryByTestId('loading-spinner');
  expect(spinner).toBeNull();
};

// ============================================================================
// Form Submission Utilities
// ============================================================================

/**
 * Wait for a form submission to complete.
 * Waits for submit button to be re-enabled or success message.
 * 
 * @example
 * fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
 * await waitForFormSubmission();
 * 
 * @param options - Timeout and interval options
 */
export const waitForFormSubmission = async (
  options?: WaitOptions
): Promise<void> => {
  await waitFor(
    () => {
      // Check if submit button is no longer disabled
      const submitButtons = screen.queryAllByRole('button', { name: /submit|save|create/i });
      const hasEnabledButton = submitButtons.some(btn => !btn.hasAttribute('disabled'));
      
      // Or check for success/error messages
      const hasMessage = 
        screen.queryByText(/success|error|saved|failed/i) !== null;
      
      if (!hasEnabledButton && !hasMessage) {
        throw new Error('Form submission not yet complete');
      }
    },
    options
  );
};

/**
 * Wait for form validation errors to appear.
 * 
 * @example
 * fireEvent.submit(screen.getByRole('form'));
 * await waitForValidationErrors();
 * expect(screen.getByText('Email is required')).toBeInTheDocument();
 * 
 * @param options - Timeout and interval options
 */
export const waitForValidationErrors = async (
  options?: WaitOptions
): Promise<void> => {
  await waitFor(
    () => {
      const errors = screen.queryAllByRole('alert');
      if (errors.length === 0) {
        throw new Error('No validation errors displayed yet');
      }
    },
    options
  );
};

/**
 * Wait for a success message to appear.
 * 
 * @example
 * await waitForSuccessMessage('Course created successfully');
 * 
 * @param message - Optional specific message text to wait for
 * @param options - Timeout and interval options
 */
export const waitForSuccessMessage = async (
  message?: string,
  options?: WaitOptions
): Promise<void> => {
  await waitFor(
    () => {
      if (message) {
        const element = screen.queryByText(message);
        if (!element) {
          throw new Error(`Success message "${message}" not found`);
        }
      } else {
        const element = screen.queryByText(/success|saved|created|updated/i);
        if (!element) {
          throw new Error('No success message found');
        }
      }
    },
    options
  );
};

// ============================================================================
// Navigation Utilities
// ============================================================================

/**
 * Wait for navigation to a specific path.
 * 
 * @example
 * fireEvent.click(screen.getByRole('link', { name: 'Courses' }));
 * await waitForNavigation('/courses');
 * 
 * @param expectedPath - The path to wait for
 * @param options - Timeout and interval options
 */
export const waitForNavigation = async (
  expectedPath: string,
  options?: WaitOptions
): Promise<void> => {
  await waitFor(
    () => {
      const currentPath = window.location.pathname;
      if (!currentPath.includes(expectedPath)) {
        throw new Error(`Not yet navigated to ${expectedPath}. Current: ${currentPath}`);
      }
    },
    options
  );
};

/**
 * Wait for a page to fully load (all queries and navigation complete).
 * 
 * @example
 * await waitForPageLoad();
 * expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
 * 
 * @param options - Timeout and interval options
 */
export const waitForPageLoad = async (options?: WaitOptions): Promise<void> => {
  // Wait for loading states to finish
  await waitForLoadingToFinish(options);
  
  // Wait for at least one render cycle
  await waitForNextUpdate(options);
};

// ============================================================================
// Optimistic Update Testing
// ============================================================================

/**
 * Capture the initial state before an optimistic update.
 * 
 * @example
 * const initialCount = captureInitialState(() => items.length);
 * 
 * @param selector - Function that returns the state to capture
 * @returns The captured state value
 */
export const captureInitialState = <T>(selector: () => T): T => {
  return selector();
};

/**
 * Wait for and verify an optimistic update occurred.
 * 
 * @example
 * const initialState = captureInitialState(() => store.getState().courses);
 * fireEvent.click(screen.getByRole('button', { name: 'Add Course' }));
 * await expectOptimisticUpdate(initialState, [...initialState, newCourse]);
 * 
 * @param initialState - The captured initial state
 * @param expectedState - The expected optimistic state
 * @param options - Timeout and interval options
 */
export const expectOptimisticUpdate = async <T>(
  _initialState: T,
  expectedState: T,
  options?: WaitOptions
): Promise<void> => {
  await waitFor(
    () => {
      // This is a placeholder check - actual implementation would depend on state management
      const currentState = globalThis.__currentState__;
      if (JSON.stringify(currentState) !== JSON.stringify(expectedState)) {
        throw new Error(
          `Optimistic update not yet applied. Expected: ${JSON.stringify(expectedState)}`
        );
      }
    },
    options
  );
};

/**
 * Wait for eventual consistency after an optimistic update.
 * Verifies that the server state eventually matches expectations.
 * 
 * @example
 * await expectEventualConsistency(finalServerState, 10000);
 * 
 * @param finalState - The expected final state after server response
 * @param timeout - Maximum time to wait (default: 10000ms)
 */
export const expectEventualConsistency = async <T>(
  finalState: T,
  timeout?: number
): Promise<void> => {
  await waitFor(
    () => {
      const currentState = globalThis.__currentState__;
      if (JSON.stringify(currentState) !== JSON.stringify(finalState)) {
        throw new Error(
          `Eventual consistency not yet achieved. Expected: ${JSON.stringify(finalState)}`
        );
      }
    },
    { timeout: timeout ?? 10000 }
  );
};

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Wait for an error message to appear.
 * 
 * @example
 * await waitForErrorMessage('Invalid email address');
 * 
 * @param message - Optional specific error message or regex pattern
 * @param options - Timeout and interval options
 */
export const waitForErrorMessage = async (
  message?: string | RegExp,
  options?: WaitOptions
): Promise<void> => {
  await waitFor(
    () => {
      if (message) {
        const element = typeof message === 'string'
          ? screen.queryByText(message)
          : screen.queryByText(message);
        
        if (!element) {
          const errorText = typeof message === 'string' ? message : message.toString();
          throw new Error(`Error message "${errorText}" not found`);
        }
      } else {
        const element = screen.queryByRole('alert');
        if (!element) {
          throw new Error('No error message found');
        }
      }
    },
    options
  );
};

/**
 * Assert that no error messages are displayed (synchronous).
 * 
 * @example
 * expectNoErrors();
 */
export const expectNoErrors = (): void => {
  const errors = screen.queryAllByRole('alert');
  const errorTexts = errors.filter(el => 
    el.textContent?.toLowerCase().includes('error') ||
    el.className?.toLowerCase().includes('error')
  );
  expect(errorTexts.length).toBe(0);
};

// ============================================================================
// Debounce/Throttle Testing
// ============================================================================

/**
 * Wait for a debounced function to complete.
 * 
 * @example
 * fireEvent.change(input, { target: { value: 'search query' } });
 * await waitForDebounce(500);
 * expect(searchFn).toHaveBeenCalled();
 * 
 * @param ms - Milliseconds to wait (default: 300ms)
 */
export const waitForDebounce = async (ms?: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, ms ?? DEFAULT_DEBOUNCE_MS));
  // Allow one more tick for React to process
  await waitForNextUpdate();
};

/**
 * Flush all pending promises in the microtask queue.
 * Useful for testing promise-based async operations.
 * 
 * @example
 * someAsyncFunction();
 * await flushPromises();
 * expect(result).toBeDefined();
 */
export const flushPromises = async (): Promise<void> => {
  await new Promise(resolve => setImmediate(resolve));
};
