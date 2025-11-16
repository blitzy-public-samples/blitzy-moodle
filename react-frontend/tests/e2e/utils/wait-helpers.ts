/**
 * Wait and Retry Logic Utilities for Playwright E2E Tests
 * 
 * Provides smart waiting functions with configurable timeouts and retry strategies
 * for handling asynchronous operations, API responses, DOM element visibility,
 * and network requests in end-to-end tests.
 * 
 * Features:
 * - Exponential backoff retry logic
 * - Custom retry conditions
 * - Timeout management
 * - DOM element waiting utilities
 * - Network activity monitoring
 * - API response waiting
 * - Page load synchronization
 */

import type { Page, Response } from '@playwright/test';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Options for wait operations with configurable timeout and polling interval
 */
export interface WaitOptions {
  /** Maximum time to wait in milliseconds (default: 30000) */
  timeout: number;
  /** Polling interval in milliseconds (default: 100) */
  interval?: number;
  /** Custom error message to throw on timeout */
  errorMessage?: string;
}

/**
 * Options for retry operations with exponential backoff configuration
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay between retries in milliseconds */
  initialDelay: number;
  /** Maximum delay between retries in milliseconds */
  maxDelay: number;
  /** Multiplication factor for exponential backoff */
  factor: number;
  /** Optional function to determine if error is retryable */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Function type for custom condition checking in wait operations
 */
export interface ConditionFunction {
  (): boolean | Promise<boolean>;
}

/**
 * Custom error type for timeout failures
 */
export class TimeoutError extends Error {
  public readonly name: string = 'TimeoutError';
  public readonly timeout: number;

  constructor(message: string, timeout: number) {
    super(message);
    this.timeout = timeout;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_POLL_INTERVAL = 100; // 100ms
const DEFAULT_RETRY_INITIAL_DELAY = 100; // 100ms
const DEFAULT_RETRY_MAX_DELAY = 5000; // 5 seconds
const DEFAULT_RETRY_FACTOR = 2;
const DEFAULT_MAX_ATTEMPTS = 3;

// ============================================================================
// Core Wait Utilities
// ============================================================================

/**
 * Wait for a custom condition function to return true
 * 
 * Polls the condition function at regular intervals until it returns true
 * or the timeout is reached. Useful for waiting on complex custom conditions
 * that don't have built-in Playwright wait methods.
 * 
 * @param condition Function that returns boolean or Promise<boolean>
 * @param options Wait configuration options
 * @returns Promise that resolves when condition is met
 * @throws TimeoutError if condition is not met within timeout
 * 
 * @example
 * await waitForCondition(
 *   async () => {
 *     const count = await page.locator('.item').count();
 *     return count > 5;
 *   },
 *   { timeout: 10000 }
 * );
 */
export async function waitForCondition(
  condition: ConditionFunction,
  options: Partial<WaitOptions> = {}
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const interval = options.interval ?? DEFAULT_POLL_INTERVAL;
  const errorMessage = options.errorMessage ?? 'Condition was not met within timeout';

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await condition();
      if (result === true) {
        return;
      }
    } catch (error) {
      // Continue polling even if condition throws - it may succeed later
    }

    await sleep(interval);
  }

  throw new TimeoutError(errorMessage, timeout);
}

/**
 * Poll a function until it returns a truthy value or timeout is reached
 * 
 * Similar to waitForCondition but returns the value from the function
 * instead of just waiting. Useful when you need the actual value that
 * satisfies the condition.
 * 
 * @param fn Function to poll that returns value or Promise<value>
 * @param options Wait configuration options
 * @returns Promise that resolves with the function's return value
 * @throws TimeoutError if function doesn't return truthy value within timeout
 * 
 * @example
 * const userId = await pollUntil(
 *   async () => {
 *     const text = await page.locator('[data-user-id]').textContent();
 *     return text ? parseInt(text, 10) : null;
 *   },
 *   { timeout: 5000 }
 * );
 */
export async function pollUntil<T>(
  fn: () => T | Promise<T>,
  options: Partial<WaitOptions> = {}
): Promise<T> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const interval = options.interval ?? DEFAULT_POLL_INTERVAL;
  const errorMessage = options.errorMessage ?? 'Poll function did not return truthy value within timeout';

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await fn();
      if (result) {
        return result;
      }
    } catch (error) {
      // Continue polling even if function throws
    }

    await sleep(interval);
  }

  throw new TimeoutError(errorMessage, timeout);
}

/**
 * Retry an operation with exponential backoff on failure
 * 
 * Executes an operation and retries it with increasing delays if it fails.
 * Uses exponential backoff strategy to avoid overwhelming the system while
 * giving transient failures time to resolve.
 * 
 * @param operation Function to execute that may fail
 * @param options Retry configuration options
 * @returns Promise that resolves with operation result
 * @throws Error from operation if all retry attempts fail
 * 
 * @example
 * const data = await retryOperation(
 *   async () => {
 *     const response = await fetch('/api/data');
 *     if (!response.ok) throw new Error('API error');
 *     return response.json();
 *   },
 *   { maxAttempts: 3, initialDelay: 100, maxDelay: 5000, factor: 2 }
 * );
 */
export async function retryOperation<T>(
  operation: () => T | Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const initialDelay = options.initialDelay ?? DEFAULT_RETRY_INITIAL_DELAY;
  const maxDelay = options.maxDelay ?? DEFAULT_RETRY_MAX_DELAY;
  const factor = options.factor ?? DEFAULT_RETRY_FACTOR;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if this was the last attempt or error is not retryable
      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw lastError;
      }

      // Wait before next attempt with exponential backoff
      await sleep(delay);
      delay = Math.min(delay * factor, maxDelay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError ?? new Error('Operation failed with unknown error');
}

/**
 * Simple sleep utility for fixed delays
 * 
 * Use sparingly - prefer Playwright's built-in waiting mechanisms when possible.
 * Only use this when you need an unconditional delay (e.g., waiting for animations).
 * 
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after delay
 * 
 * @example
 * await sleep(1000); // Wait 1 second
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Page Load Wait Utilities
// ============================================================================

/**
 * Wait for page to fully load (DOMContentLoaded + network idle)
 * 
 * Ensures both the DOM is ready and all network requests have completed.
 * Use this after navigation or when you need to ensure the page is fully loaded
 * before interacting with it.
 * 
 * @param page Playwright Page instance
 * @param options Wait configuration options
 * @returns Promise that resolves when page is fully loaded
 * @throws TimeoutError if page doesn't load within timeout
 * 
 * @example
 * await page.goto('/dashboard');
 * await waitForPageLoad(page, { timeout: 15000 });
 */
export async function waitForPageLoad(
  page: Page,
  options: Partial<WaitOptions> = {}
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  try {
    // Wait for DOMContentLoaded event
    await page.waitForLoadState('domcontentloaded', { timeout });
    
    // Wait for network to be idle (no more than 2 network connections for at least 500ms)
    await page.waitForLoadState('networkidle', { timeout });
  } catch (error) {
    const errorMessage = options.errorMessage ?? 'Page did not load within timeout';
    throw new TimeoutError(errorMessage, timeout);
  }
}

/**
 * Wait for all network requests to complete (network idle state)
 * 
 * Waits until there are no more than 2 network connections for at least 500ms.
 * Useful after triggering actions that cause API calls to ensure all data has loaded.
 * 
 * @param page Playwright Page instance
 * @param options Wait configuration options
 * @returns Promise that resolves when network is idle
 * @throws TimeoutError if network doesn't become idle within timeout
 * 
 * @example
 * await page.click('[data-testid="load-more"]');
 * await waitForNetworkIdle(page);
 */
export async function waitForNetworkIdle(
  page: Page,
  options: Partial<WaitOptions> = {}
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch (error) {
    const errorMessage = options.errorMessage ?? 'Network did not become idle within timeout';
    throw new TimeoutError(errorMessage, timeout);
  }
}

/**
 * Wait for navigation to complete with optional URL check
 * 
 * Waits for the page to navigate to a new URL. Can optionally verify the URL
 * matches an expected pattern. Use this after triggering navigation actions.
 * 
 * @param page Playwright Page instance
 * @param expectedUrl Expected URL pattern (string or RegExp) - optional
 * @param options Wait configuration options
 * @returns Promise that resolves when navigation completes
 * @throws TimeoutError if navigation doesn't complete within timeout
 * 
 * @example
 * await page.click('[data-testid="submit"]');
 * await waitForNavigation(page, '/success');
 */
export async function waitForNavigation(
  page: Page,
  expectedUrl?: string | RegExp,
  options: Partial<WaitOptions> = {}
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  try {
    if (expectedUrl) {
      await page.waitForURL(expectedUrl, { timeout });
    } else {
      await page.waitForLoadState('domcontentloaded', { timeout });
    }
  } catch (error) {
    const errorMessage = options.errorMessage ?? 
      `Navigation ${expectedUrl ? `to ${expectedUrl}` : ''} did not complete within timeout`;
    throw new TimeoutError(errorMessage, timeout);
  }
}

// ============================================================================
// DOM Element Wait Utilities
// ============================================================================

/**
 * Wait for DOM element to be visible or hidden
 * 
 * Waits for an element matching the selector to become visible or hidden.
 * Uses Playwright's built-in waiting which is more reliable than polling.
 * 
 * @param page Playwright Page instance
 * @param selector CSS selector for the element
 * @param state 'visible' or 'hidden' state to wait for (default: 'visible')
 * @param options Wait configuration options
 * @returns Promise that resolves when element reaches desired state
 * @throws TimeoutError if element doesn't reach state within timeout
 * 
 * @example
 * await waitForElement(page, '[data-testid="success-message"]', 'visible');
 * await waitForElement(page, '[data-testid="loading-spinner"]', 'hidden');
 */
export async function waitForElement(
  page: Page,
  selector: string,
  state: 'visible' | 'hidden' = 'visible',
  options: Partial<WaitOptions> = {}
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  try {
    const locator = page.locator(selector);
    
    if (state === 'visible') {
      await locator.waitFor({ state: 'visible', timeout });
    } else {
      await locator.waitFor({ state: 'hidden', timeout });
    }
  } catch (error) {
    const errorMessage = options.errorMessage ?? 
      `Element '${selector}' did not become ${state} within timeout`;
    throw new TimeoutError(errorMessage, timeout);
  }
}

/**
 * Wait for specific text content to appear in element
 * 
 * Waits for an element to become visible and contain specific text.
 * Supports both exact string matching and regular expressions.
 * 
 * @param page Playwright Page instance
 * @param selector CSS selector for the element
 * @param text Expected text content (string or RegExp)
 * @param options Wait configuration options
 * @returns Promise that resolves when text appears
 * @throws TimeoutError if text doesn't appear within timeout
 * 
 * @example
 * await waitForText(page, '[data-testid="status"]', 'Completed');
 * await waitForText(page, '.message', /success/i);
 */
export async function waitForText(
  page: Page,
  selector: string,
  text: string | RegExp,
  options: Partial<WaitOptions> = {}
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  try {
    const locator = page.locator(selector);
    await locator.waitFor({ state: 'visible', timeout });
    
    // Wait for text content to match
    await waitForCondition(
      async () => {
        const content = await locator.textContent();
        if (!content) {return false;}
        
        if (typeof text === 'string') {
          return content.includes(text);
        } 
          return text.test(content);
        
      },
      { timeout, interval: options.interval }
    );
  } catch (error) {
    const errorMessage = options.errorMessage ?? 
      `Text '${text}' did not appear in element '${selector}' within timeout`;
    throw new TimeoutError(errorMessage, timeout);
  }
}

/**
 * Wait for specific number of elements to appear
 * 
 * Waits until exactly the expected number of elements matching the selector
 * are present in the DOM. Useful for validating list rendering.
 * 
 * @param page Playwright Page instance
 * @param selector CSS selector for the elements
 * @param count Expected number of elements
 * @param options Wait configuration options
 * @returns Promise that resolves when element count matches
 * @throws TimeoutError if element count doesn't match within timeout
 * 
 * @example
 * await waitForElementCount(page, '[data-testid="course-card"]', 5);
 */
export async function waitForElementCount(
  page: Page,
  selector: string,
  count: number,
  options: Partial<WaitOptions> = {}
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  try {
    await waitForCondition(
      async () => {
        const elements = page.locator(selector);
        const actualCount = await elements.count();
        return actualCount === count;
      },
      { timeout, interval: options.interval }
    );
  } catch (error) {
    const errorMessage = options.errorMessage ?? 
      `Expected ${count} elements matching '${selector}', but count did not match within timeout`;
    throw new TimeoutError(errorMessage, timeout);
  }
}

/**
 * Wait for element attribute to match expected value
 * 
 * Waits for an element's attribute to have a specific value.
 * Supports both exact string matching and regular expressions.
 * 
 * @param page Playwright Page instance
 * @param selector CSS selector for the element
 * @param attribute Attribute name to check
 * @param expectedValue Expected attribute value (string or RegExp)
 * @param options Wait configuration options
 * @returns Promise that resolves when attribute matches
 * @throws TimeoutError if attribute doesn't match within timeout
 * 
 * @example
 * await waitForAttributeValue(page, 'button', 'aria-disabled', 'false');
 * await waitForAttributeValue(page, 'input', 'value', /^\d+$/);
 */
export async function waitForAttributeValue(
  page: Page,
  selector: string,
  attribute: string,
  expectedValue: string | RegExp,
  options: Partial<WaitOptions> = {}
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  try {
    const locator = page.locator(selector);
    await locator.waitFor({ state: 'attached', timeout });
    
    await waitForCondition(
      async () => {
        const value = await locator.getAttribute(attribute);
        if (value === null) {return false;}
        
        if (typeof expectedValue === 'string') {
          return value === expectedValue;
        } 
          return expectedValue.test(value);
        
      },
      { timeout, interval: options.interval }
    );
  } catch (error) {
    const errorMessage = options.errorMessage ?? 
      `Attribute '${attribute}' of element '${selector}' did not match expected value within timeout`;
    throw new TimeoutError(errorMessage, timeout);
  }
}

/**
 * Wait for CSS property to have specific value
 * 
 * Waits for an element's computed CSS property to match an expected value.
 * Useful for waiting on CSS transitions or dynamic style changes.
 * 
 * @param page Playwright Page instance
 * @param selector CSS selector for the element
 * @param property CSS property name (e.g., 'display', 'opacity')
 * @param expectedValue Expected property value (string or RegExp)
 * @param options Wait configuration options
 * @returns Promise that resolves when CSS property matches
 * @throws TimeoutError if property doesn't match within timeout
 * 
 * @example
 * await waitForCssProperty(page, '.modal', 'display', 'block');
 * await waitForCssProperty(page, '.fade-in', 'opacity', '1');
 */
export async function waitForCssProperty(
  page: Page,
  selector: string,
  property: string,
  expectedValue: string | RegExp,
  options: Partial<WaitOptions> = {}
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  try {
    const locator = page.locator(selector);
    await locator.waitFor({ state: 'attached', timeout });
    
    await waitForCondition(
      async () => {
        const value = await locator.evaluate(
          (el, prop) => window.getComputedStyle(el).getPropertyValue(prop),
          property
        );
        
        if (!value) {return false;}
        
        if (typeof expectedValue === 'string') {
          return value === expectedValue;
        } 
          return expectedValue.test(value);
        
      },
      { timeout, interval: options.interval }
    );
  } catch (error) {
    const errorMessage = options.errorMessage ?? 
      `CSS property '${property}' of element '${selector}' did not match expected value within timeout`;
    throw new TimeoutError(errorMessage, timeout);
  }
}

// ============================================================================
// API Wait Utilities
// ============================================================================

/**
 * Wait for API endpoint to return successful response
 * 
 * Waits for a network response matching the URL pattern to return with a
 * successful status code (200-299). Useful for ensuring API calls complete
 * before making assertions on the resulting data.
 * 
 * @param page Playwright Page instance
 * @param urlPattern URL pattern to match (string or RegExp)
 * @param options Wait configuration options
 * @returns Promise that resolves with Response when successful
 * @throws TimeoutError if successful response not received within timeout
 * 
 * @example
 * await page.click('[data-testid="save"]');
 * const response = await waitForApiResponse(page, '/api/v1/courses');
 * const data = await response.json();
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  options: Partial<WaitOptions> = {}
): Promise<Response> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  try {
    const response = await page.waitForResponse(
      (response) => {
        const url = response.url();
        const matches = typeof urlPattern === 'string' 
          ? url.includes(urlPattern) 
          : urlPattern.test(url);
        
        return matches && response.ok();
      },
      { timeout }
    );
    
    return response;
  } catch (error) {
    const errorMessage = options.errorMessage ?? 
      `API endpoint matching '${urlPattern}' did not return successful response within timeout`;
    throw new TimeoutError(errorMessage, timeout);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Debounce function execution for rapid events
 * 
 * Creates a debounced version of a function that delays its execution until
 * after the specified delay has elapsed since the last call. Useful for
 * handling rapid events like window resize or input changes.
 * 
 * @param fn Function to debounce
 * @param delay Delay in milliseconds before execution
 * @returns Debounced function
 * 
 * @example
 * const debouncedSearch = debounce(
 *   async (query: string) => {
 *     await page.fill('[data-testid="search"]', query);
 *   },
 *   300
 * );
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined;

  return function debounced(...args: Parameters<T>): void {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = undefined;
    }, delay);
  };
}
