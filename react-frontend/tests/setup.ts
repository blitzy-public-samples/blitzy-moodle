/**
 * Vitest Global Test Setup Configuration
 * 
 * This file runs before all test suites and configures:
 * - React Testing Library matchers (@testing-library/jest-dom)
 * - Custom Moodle-specific matchers (./helpers/customMatchers)
 * - MSW server for API mocking
 * - Browser API mocks for jsdom environment
 * - Global test utilities and cleanup
 * - React Query test client configuration
 * - Timezone and locale settings for consistent date testing
 * 
 * All tests inherit this setup automatically via vitest.config.ts
 */

console.log('[Setup] Loading test setup file...');

import '@testing-library/jest-dom';
import './helpers/customMatchers';
import { cleanup } from '@testing-library/react';
import { beforeAll, afterAll, afterEach, vi, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { toHaveNoViolations } from 'vitest-axe/dist/matchers';

// Manually extend expect with vitest-axe matcher (workaround for empty extend-expect.js in v0.1.0)
expect.extend({ toHaveNoViolations });

// Import MSW server setup from mocks directory
// Note: This assumes ./mocks/server.ts exists with server export
// If not yet created, this import should be added once MSW is configured
import { server } from './mocks/server';

console.log('[Setup] Test setup file loaded, applying mocks...');

/**
 * NOTE: React.useId() Mock Strategy
 * 
 * MUI components use React.useId() internally, which generates sequential IDs.
 * This creates snapshot inconsistencies between individual and full-suite test runs.
 * 
 * After extensive attempts to mock React.useId() globally (which caused various issues),
 * the solution is to regenerate snapshots in the context where they'll be verified (full suite).
 * 
 * To regenerate snapshots for FormDatePicker:
 * 1. Delete the snapshot file
 * 2. Run: npm test -- FormDatePicker -u --run
 * 3. This creates snapshots with the current test context's IDs
 */

/**
 * MSW Server Lifecycle Management
 * Setup API mocking server before all tests, reset handlers between tests, and cleanup after all tests
 */
beforeAll(() => {
  // Start MSW server to intercept API requests during tests
  console.log('[Setup] Starting MSW server...');
  server.listen({ onUnhandledRequest: 'warn' });
  console.log('[Setup] MSW server started');
});

afterEach(() => {
  // Reset handlers to ensure test isolation
  server.resetHandlers();
});

afterAll(() => {
  // Clean up and close the server after all tests complete
  console.log('[Setup] Closing MSW server...');
  server.close();
});

/**
 * Global Unhandled Rejection Handler
 * 
 * Axios errors contain non-serializable function properties (like transformRequest)
 * which cause Vitest to fail when it tries to serialize them for cross-process communication.
 * This handler sanitizes such errors by extracting only the serializable parts.
 */
process.on('unhandledRejection', (reason: unknown) => {
  // Only handle errors that look like AxiosError objects (have config with transformRequest)
  if (reason && typeof reason === 'object') {
    const errorObj = reason as Record<string, unknown>;
    
    // Check if this is an AxiosError-like object with non-serializable config
    if (errorObj.config && typeof errorObj.config === 'object') {
      const config = errorObj.config as Record<string, unknown>;
      if (typeof config.transformRequest === 'function' || typeof config.transformResponse === 'function') {
        // Log a simplified version for debugging without causing serialization issues
        const sanitizedError = {
          message: errorObj.message || 'Unknown error',
          status: (errorObj.response as Record<string, unknown>)?.status,
          code: errorObj.code,
          url: config.url,
          method: config.method,
        };
        console.warn('[Test] Caught unhandled AxiosError rejection:', sanitizedError);
        // Prevent the unhandled rejection from propagating
        return;
      }
    }
  }
  // For non-Axios errors, let them propagate normally
});

/**
 * React Testing Library Cleanup
 * Automatically unmount React trees after each test to prevent memory leaks
 */
afterEach(() => {
  cleanup();
});

/**
 * Browser API Mocks for jsdom Environment
 * jsdom doesn't implement all browser APIs, so we mock them for testing
 */

// Mock window.matchMedia for responsive design and media query testing
// MUI DatePicker uses (pointer: fine) to detect desktop vs mobile
// Return matches: true for desktop queries to ensure calendar button renders
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => {
    // Desktop environment: pointer: fine (mouse), hover: hover, min-width queries
    const isDesktopQuery = 
      query.includes('pointer: fine') || 
      query.includes('pointer:fine') ||
      query.includes('hover: hover') ||
      query.includes('hover:hover') ||
      query.includes('min-width');
    
    return {
      matches: isDesktopQuery,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    };
  }),
});

// Mock IntersectionObserver for lazy loading and visibility detection
global.IntersectionObserver = class IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(
    public callback: IntersectionObserverCallback,
    public options?: IntersectionObserverInit
  ) {}

  disconnect(): void {}
  
  observe(target: Element): void {
    // Immediately trigger callback with mock entry showing element as visible
    this.callback(
      [
        {
          target,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
          time: Date.now(),
        } as IntersectionObserverEntry,
      ],
      this
    );
  }
  
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  
  unobserve(_target: Element): void {}
} as any;

// Mock ResizeObserver for component resize handling
// MUI DataGrid requires proper dimensions to render virtualized rows
global.ResizeObserver = class ResizeObserver {
  constructor(public callback: ResizeObserverCallback) {}
  
  disconnect(): void {}
  
  observe(target: Element, _options?: ResizeObserverOptions): void {
    // Immediately trigger callback with mock entry
    // Use realistic dimensions instead of getBoundingClientRect() which returns zeros in happy-dom
    const mockContentRect = {
      x: 0,
      y: 0,
      width: 1200,  // Realistic viewport width
      height: 800,  // Realistic viewport height
      top: 0,
      right: 1200,
      bottom: 800,
      left: 0,
    };
    
    this.callback(
      [
        {
          target,
          contentRect: mockContentRect as DOMRectReadOnly,
          borderBoxSize: [{ inlineSize: 1200, blockSize: 800 } as any],
          contentBoxSize: [{ inlineSize: 1200, blockSize: 800 } as any],
          devicePixelContentBoxSize: [{ inlineSize: 1200, blockSize: 800 } as any],
        } as ResizeObserverEntry,
      ],
      this
    );
  }
  
  unobserve(_target: Element): void {}
} as any;

// Mock HTMLElement.prototype.scrollIntoView for scroll behavior testing
HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock HTMLElement dimensions for MUI DataGrid
// MUI DataGrid checks clientWidth/clientHeight and offsetWidth/offsetHeight of parent container
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get: function() {
    const styleWidth = parseFloat(this.style.width);
    const width = styleWidth || 1200;
    
    // Log when clientWidth is accessed
    const className = this.className || 'no-class';
    if (styleWidth === 0 || (className.includes && className.includes('MuiDataGrid'))) {
      console.log('[Mock] clientWidth accessed:', this.tagName, className.slice(0, 100), 'style.width:', this.style.width, 'returning:', width);
    }
    
    return width;
  },
});

Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get: function() {
    return parseFloat(this.style.height) || 800;
  },
});

Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get: function() {
    return parseFloat(this.style.width) || 1200;
  },
});

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get: function() {
    return parseFloat(this.style.height) || 800;
  },
});

// Mock HTMLElement.prototype.getBoundingClientRect for proper layout calculations
// MUI DataGrid and other components need realistic dimensions to render properly
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function(this: HTMLElement) {
  // Try to get real dimensions first
  const rect = originalGetBoundingClientRect.call(this);
  
  // If width is zero (typical in happy-dom), return realistic mock dimensions
  // This is crucial for MUI DataGrid which checks parent container width
  if (rect.width === 0) {
    const width = this.offsetWidth || 1200;
    const height = this.offsetHeight || 800;
    console.log('[Mock] getBoundingClientRect called on element with zero width, returning mock dimensions', this.tagName, this.className, 'width:', width);
    return {
      x: 0,
      y: 0,
      width: width,
      height: height,
      top: 0,
      right: width,
      bottom: height,
      left: 0,
      toJSON: () => ({})
    } as DOMRect;
  }
  
  return rect;
};

/**
 * Storage API Mocks
 * Mock localStorage and sessionStorage with proper implementation
 */
class StorageMock implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

global.localStorage = new StorageMock();
global.sessionStorage = new StorageMock();

/**
 * Console Method Mocks
 * Suppress expected errors/warnings during tests while keeping important messages
 */
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Filter out known React warnings and errors that are expected in tests
  console.error = vi.fn((...args: any[]) => {
    const message = args[0];
    if (typeof message === 'string') {
      // Suppress React 18 act() warnings in tests
      if (message.includes('act(')) return;
      // Suppress React DOM render warnings
      if (message.includes('ReactDOM.render')) return;
      // Suppress React testing library warnings about updates not wrapped in act()
      if (message.includes('not wrapped in act')) return;
    }
    // Log other errors normally
    originalConsoleError.call(console, ...args);
  });

  console.warn = vi.fn((...args: any[]) => {
    const message = args[0];
    if (typeof message === 'string') {
      // Suppress specific warnings if needed
      if (message.includes('componentWillReceiveProps')) return;
    }
    // Log other warnings normally
    originalConsoleWarn.call(console, ...args);
  });
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

/**
 * Global Test Timeout Configuration
 * Set default timeout for all tests to 5000ms
 */
vi.setConfig({ testTimeout: 5000 });

/**
 * Timezone and Locale Configuration
 * Set timezone to UTC for consistent date testing across different environments
 */
beforeAll(() => {
  // Mock the system time to use UTC timezone
  process.env.TZ = 'UTC';
  
  // Save original Intl before stubbing
  const originalIntl = global.Intl;
  
  // Set default locale for date formatting
  vi.stubGlobal('Intl', {
    ...originalIntl,
    DateTimeFormat: vi.fn(() => ({
      format: vi.fn(),
      formatToParts: vi.fn(),
      resolvedOptions: vi.fn(() => ({
        locale: 'en-US',
        timeZone: 'UTC',
      })),
    })),
    // Mock NumberFormat for locale-aware number formatting in tests
    NumberFormat: vi.fn((locale?: string | string[], options?: Intl.NumberFormatOptions) => {
      // Use the original NumberFormat if available (Node.js has full Intl support)
      if (originalIntl && originalIntl.NumberFormat) {
        return new originalIntl.NumberFormat(locale, options);
      }
      // Fallback mock for environments without Intl.NumberFormat
      return {
        format: (value: number) => {
          if (options?.style === 'percent') {
            return `${value.toFixed(options?.maximumFractionDigits ?? 0)}%`;
          }
          return value.toLocaleString('en-US', options);
        },
        formatToParts: vi.fn(),
        resolvedOptions: vi.fn(() => ({
          locale: locale || 'en-US',
          numberingSystem: 'latn',
          style: options?.style || 'decimal',
          minimumIntegerDigits: options?.minimumIntegerDigits || 1,
          minimumFractionDigits: options?.minimumFractionDigits || 0,
          maximumFractionDigits: options?.maximumFractionDigits || 3,
        })),
      };
    }) as any,
    // Mock Collator for locale-aware string comparison (required by MUI DataGrid sorting)
    Collator: vi.fn((locale?: string | string[], options?: Intl.CollatorOptions) => {
      // Use the original Collator if available (Node.js has full Intl support)
      if (originalIntl && originalIntl.Collator) {
        return new originalIntl.Collator(locale, options);
      }
      // Fallback mock for environments without Intl.Collator
      return {
        compare: (a: string, b: string) => {
          // Simple lexicographic comparison as fallback
          return a.localeCompare(b);
        },
        resolvedOptions: () => ({
          locale: locale || 'en-US',
          usage: options?.usage || 'sort',
          sensitivity: options?.sensitivity || 'variant',
          ignorePunctuation: options?.ignorePunctuation || false,
          collation: 'default',
          numeric: options?.numeric || false,
          caseFirst: options?.caseFirst || 'false',
        }),
      };
    }) as any,
  });
});

/**
 * React Query Test Client Configuration
 * Create a test-specific QueryClient with no retries and instant cache expiration
 * This ensures predictable test behavior and prevents cache pollution between tests
 */
export const createTestQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries for faster test execution
        gcTime: 0, // Garbage collection time - instantly clear cache
        staleTime: 0, // Consider data stale immediately
        refetchOnWindowFocus: false, // Disable automatic refetching
        refetchOnMount: false, // Disable refetch on component mount
        refetchOnReconnect: false, // Disable refetch on network reconnect
      },
      mutations: {
        retry: false, // Disable mutation retries
      },
    },
    // Note: logger option was removed in React Query v5
    // Error suppression is now handled via console mocks above
  });
};

/**
 * Global Test Utilities
 * Helper functions available to all tests
 */
export const testUtils = {
  /**
   * Wait for a specified amount of time (useful for testing async behavior)
   */
  wait: (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Create a mock file object for file upload testing
   */
  createMockFile: (
    name: string = 'test.txt',
    size: number = 1024,
    type: string = 'text/plain'
  ): File => {
    const content = 'a'.repeat(size);
    return new File([content], name, { type });
  },

  /**
   * Create a mock image file for image upload testing
   */
  createMockImage: (
    name: string = 'test.jpg',
    _width: number = 100,
    _height: number = 100
  ): File => {
    return new File(['fake-image-content'], name, { type: 'image/jpeg' });
  },

  /**
   * Mock successful API response structure
   */
  createMockApiResponse: <T>(data: T) => ({
    success: true,
    data,
    meta: {},
  }),

  /**
   * Mock error API response structure
   */
  createMockApiError: (
    code: string = 'ERROR',
    message: string = 'An error occurred'
  ) => ({
    success: false,
    error: {
      code,
      message,
      details: {},
    },
  }),
};

/**
 * Export everything that tests might need to import
 */
export { vi } from 'vitest';
