/* eslint-disable no-console */
/**
 * Browser Context Management Utilities for Playwright E2E Tests
 * 
 * Provides comprehensive utilities for managing browser contexts, tabs, cookies,
 * storage, and viewport configurations in Playwright end-to-end tests.
 * 
 * @module browser-helpers
 */

import type { Browser, BrowserContext, Page, Cookie } from '@playwright/test';

/**
 * Configuration options for creating a new browser context
 */
export interface BrowserContextOptions {
  /** Viewport dimensions for the context */
  viewport?: { width: number; height: number } | null;
  /** Storage state to pre-load (cookies and localStorage) */
  storageState?: string | { cookies: Cookie[]; origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }> };
  /** Permissions to grant to the context */
  permissions?: string[];
  /** Geolocation coordinates */
  geolocation?: { latitude: number; longitude: number; accuracy?: number };
  /** Locale setting (e.g., 'en-US', 'de-DE') */
  locale?: string;
  /** Timezone ID (e.g., 'America/New_York', 'Europe/London') */
  timezoneId?: string;
  /** Custom user agent string */
  userAgent?: string;
  /** Device scale factor (pixel ratio) */
  deviceScaleFactor?: number;
  /** Whether to emulate mobile device */
  isMobile?: boolean;
  /** Whether device supports touch events */
  hasTouch?: boolean;
  /** Whether to allow file downloads */
  acceptDownloads?: boolean;
}

/**
 * Viewport dimensions for responsive testing
 */
export interface ViewportSize {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * Options for setting cookies in browser context
 */
export interface CookieOptions {
  /** Cookie name */
  name: string;
  /** Cookie value */
  value: string;
  /** Domain for the cookie (defaults to current domain) */
  domain?: string;
  /** Path for the cookie (defaults to '/') */
  path?: string;
  /** Expiration timestamp in Unix time (seconds since epoch) */
  expires?: number;
  /** Whether cookie is HTTP only (not accessible via JavaScript) */
  httpOnly?: boolean;
  /** Whether cookie requires secure (HTTPS) connection */
  secure?: boolean;
  /** SameSite attribute for CSRF protection */
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Browser storage state including cookies and localStorage
 */
export interface StorageState {
  /** List of cookies */
  cookies: Cookie[];
  /** Origins with their localStorage data */
  origins: Array<{
    origin: string;
    localStorage: Array<{
      name: string;
      value: string;
    }>;
  }>;
}

/**
 * Predefined viewport sizes for common device types
 */
export const VIEWPORT_SIZES = {
  mobile: { width: 375, height: 667 } as ViewportSize,
  tablet: { width: 768, height: 1024 } as ViewportSize,
  desktop: { width: 1920, height: 1080 } as ViewportSize,
  smallMobile: { width: 320, height: 568 } as ViewportSize,
  largeMobile: { width: 414, height: 896 } as ViewportSize,
  smallDesktop: { width: 1366, height: 768 } as ViewportSize,
} as const;

/**
 * Creates a new browser context with authentication state pre-loaded.
 * Useful for tests that require a logged-in user without repeating login steps.
 * 
 * @param browser - Playwright Browser instance
 * @param storageState - Path to storage state file or storage state object with auth tokens
 * @param options - Additional browser context options
 * @returns Promise resolving to configured BrowserContext
 * 
 * @example
 * ```typescript
 * const context = await createAuthenticatedContext(
 *   browser,
 *   './playwright/.auth/user.json',
 *   { viewport: VIEWPORT_SIZES.desktop }
 * );
 * ```
 */
export async function createAuthenticatedContext(
  browser: Browser,
  storageState: string | StorageState,
  options: Omit<BrowserContextOptions, 'storageState'> = {}
): Promise<BrowserContext> {
  try {
    const context = await browser.newContext({
      ...options,
      storageState,
    });

    return context;
  } catch (error) {
    throw new Error(
      `Failed to create authenticated browser context: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Creates an isolated browser context for independent test execution.
 * Ensures tests run in complete isolation without sharing state.
 * 
 * @param browser - Playwright Browser instance
 * @param options - Browser context configuration options
 * @returns Promise resolving to isolated BrowserContext
 * 
 * @example
 * ```typescript
 * const context = await createIsolatedContext(browser, {
 *   viewport: VIEWPORT_SIZES.mobile,
 *   locale: 'en-US',
 *   permissions: ['geolocation']
 * });
 * ```
 */
export async function createIsolatedContext(
  browser: Browser,
  options: BrowserContextOptions = {}
): Promise<BrowserContext> {
  try {
    // Create context with default isolation settings
    const context = await browser.newContext({
      viewport: options.viewport !== undefined ? options.viewport : VIEWPORT_SIZES.desktop,
      locale: options.locale ?? 'en-US',
      timezoneId: options.timezoneId ?? 'America/New_York',
      permissions: options.permissions ?? [],
      geolocation: options.geolocation,
      userAgent: options.userAgent,
      deviceScaleFactor: options.deviceScaleFactor ?? 1,
      isMobile: options.isMobile ?? false,
      hasTouch: options.hasTouch ?? false,
      acceptDownloads: options.acceptDownloads ?? true,
    });

    return context;
  } catch (error) {
    throw new Error(
      `Failed to create isolated browser context: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Clears all browser storage including localStorage, sessionStorage, and cookies.
 * Useful for ensuring clean state between tests.
 * 
 * @param context - Browser context to clear storage from
 * @returns Promise that resolves when storage is cleared
 * 
 * @example
 * ```typescript
 * await clearBrowserStorage(context);
 * // All cookies, localStorage, and sessionStorage are now cleared
 * ```
 */
export async function clearBrowserStorage(context: BrowserContext): Promise<void> {
  try {
    // Clear all cookies
    await context.clearCookies();

    // Clear localStorage and sessionStorage for all pages in context
    // Note: Some pages (like about:blank or data: URLs) may not support storage
    const pages = context.pages();
    for (const page of pages) {
      try {
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
      } catch (storageError) {
        // Ignore storage errors for pages that don't support it (e.g., about:blank, data: URLs)
        // The important part is that cookies are cleared, which always works
        console.debug(
          `Could not clear storage for page ${page.url()}: ${
            storageError instanceof Error ? storageError.message : String(storageError)
          }`
        );
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to clear browser storage: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Sets a cookie in the browser context with proper security flags.
 * Follows security best practices for JWT token storage and authentication.
 * 
 * @param context - Browser context to add cookie to
 * @param options - Cookie configuration options
 * @returns Promise that resolves when cookie is set
 * 
 * @example
 * ```typescript
 * await setCookie(context, {
 *   name: 'jwt_token',
 *   value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   domain: 'localhost',
 *   path: '/',
 *   httpOnly: true,
 *   secure: true,
 *   sameSite: 'Strict',
 *   expires: Math.floor(Date.now() / 1000) + 3600
 * });
 * ```
 */
export async function setCookie(
  context: BrowserContext,
  options: CookieOptions
): Promise<void> {
  try {
    const cookie: Cookie = {
      name: options.name,
      value: options.value,
      domain: options.domain ?? 'localhost',
      path: options.path ?? '/',
      expires: options.expires ?? -1,
      httpOnly: options.httpOnly ?? false,
      secure: options.secure ?? false,
      sameSite: options.sameSite ?? 'Lax',
    };

    await context.addCookies([cookie]);
  } catch (error) {
    throw new Error(
      `Failed to set cookie '${options.name}': ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Retrieves a specific cookie value from the browser context.
 * 
 * @param context - Browser context to get cookie from
 * @param name - Name of the cookie to retrieve
 * @returns Promise resolving to Cookie object or undefined if not found
 * 
 * @example
 * ```typescript
 * const jwtCookie = await getCookie(context, 'jwt_token');
 * if (jwtCookie) {
 *   console.log('Token expires:', new Date(jwtCookie.expires * 1000));
 * }
 * ```
 */
export async function getCookie(
  context: BrowserContext,
  name: string
): Promise<Cookie | undefined> {
  try {
    const cookies = await context.cookies();
    return cookies.find(cookie => cookie.name === name);
  } catch (error) {
    throw new Error(
      `Failed to get cookie '${name}': ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Removes a specific cookie from the browser context.
 * 
 * @param context - Browser context to remove cookie from
 * @param name - Name of the cookie to delete
 * @param domain - Optional domain to match (if cookie is domain-specific)
 * @returns Promise that resolves when cookie is deleted
 * 
 * @example
 * ```typescript
 * await deleteCookie(context, 'jwt_token', 'localhost');
 * // JWT token cookie is now removed
 * ```
 */
export async function deleteCookie(
  context: BrowserContext,
  name: string,
  domain?: string
): Promise<void> {
  try {
    const cookies = await context.cookies();
    const cookiesToDelete = cookies.filter(cookie => {
      const nameMatches = cookie.name === name;
      const domainMatches = domain ? cookie.domain === domain : true;
      return nameMatches && domainMatches;
    });

    if (cookiesToDelete.length > 0) {
      await context.clearCookies();
      const remainingCookies = cookies.filter(cookie => 
        !cookiesToDelete.some(c => c.name === cookie.name && c.domain === cookie.domain)
      );
      if (remainingCookies.length > 0) {
        await context.addCookies(remainingCookies);
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to delete cookie '${name}': ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Configures viewport size for responsive testing.
 * Supports predefined sizes (mobile, tablet, desktop) or custom dimensions.
 * 
 * @param page - Page to set viewport for
 * @param size - Viewport dimensions or predefined size name
 * @returns Promise that resolves when viewport is set
 * 
 * @example
 * ```typescript
 * // Using predefined size
 * await setViewport(page, VIEWPORT_SIZES.mobile);
 * 
 * // Using custom size
 * await setViewport(page, { width: 1440, height: 900 });
 * ```
 */
export async function setViewport(
  page: Page,
  size: ViewportSize
): Promise<void> {
  try {
    await page.setViewportSize(size);
  } catch (error) {
    throw new Error(
      `Failed to set viewport to ${size.width}x${size.height}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Navigates to a URL and waits for page to be fully loaded.
 * Includes configurable timeout and wait conditions.
 * 
 * @param page - Page to navigate
 * @param url - URL to navigate to
 * @param options - Navigation options
 * @returns Promise that resolves when navigation is complete
 * 
 * @example
 * ```typescript
 * await navigateToPage(page, 'http://localhost:3000/dashboard', {
 *   waitUntil: 'networkidle',
 *   timeout: 10000
 * });
 * ```
 */
export async function navigateToPage(
  page: Page,
  url: string,
  options: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    timeout?: number;
  } = {}
): Promise<void> {
  try {
    await page.goto(url, {
      waitUntil: options.waitUntil || 'networkidle',
      timeout: options.timeout || 30000,
    });
  } catch (error) {
    throw new Error(
      `Failed to navigate to ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Properly closes a browser context and cleans up all resources.
 * Ensures all pages and resources are disposed of correctly.
 * 
 * @param context - Browser context to close
 * @returns Promise that resolves when context is closed
 * 
 * @example
 * ```typescript
 * await closeContext(context);
 * // All pages and resources in context are now closed
 * ```
 */
export async function closeContext(context: BrowserContext): Promise<void> {
  try {
    // Close all pages first
    const pages = context.pages();
    await Promise.all(pages.map(page => page.close()));

    // Close the context
    await context.close();
  } catch (error) {
    throw new Error(
      `Failed to close browser context: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Exports the current browser storage state for reuse in other tests.
 * Includes cookies and localStorage data.
 * 
 * @param context - Browser context to export state from
 * @returns Promise resolving to StorageState object
 * 
 * @example
 * ```typescript
 * const state = await getStorageState(context);
 * // Save state to file for reuse
 * await fs.writeFile('./auth-state.json', JSON.stringify(state));
 * ```
 */
export async function getStorageState(context: BrowserContext): Promise<StorageState> {
  try {
    const state = await context.storageState();
    return state as StorageState;
  } catch (error) {
    throw new Error(
      `Failed to get storage state: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Imports browser storage state for faster test setup.
 * Avoids repeating login steps by restoring authentication state.
 * 
 * @param context - Browser context to import state into
 * @param state - Storage state to import
 * @returns Promise that resolves when state is imported
 * 
 * @example
 * ```typescript
 * const savedState = JSON.parse(await fs.readFile('./auth-state.json', 'utf-8'));
 * await setStorageState(context, savedState);
 * // Context now has authentication state without login
 * ```
 */
export async function setStorageState(
  context: BrowserContext,
  state: StorageState
): Promise<void> {
  try {
    // Add cookies from storage state
    if (state.cookies && state.cookies.length > 0) {
      await context.addCookies(state.cookies);
    }

    // Set localStorage for each origin
    if (state.origins && state.origins.length > 0) {
      const pages = context.pages();
      if (pages.length > 0) {
        const page = pages[0]!;
        for (const origin of state.origins) {
          if (origin.localStorage && origin.localStorage.length > 0) {
            await page.goto(origin.origin);
            await page.evaluate((items) => {
              for (const item of items) {
                localStorage.setItem(item.name, item.value);
              }
            }, origin.localStorage);
          }
        }
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to set storage state: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Handles new tab/window interactions and returns the new page.
 * Waits for popup and returns the page object for interaction.
 * 
 * @param context - Browser context where popup will occur
 * @param trigger - Async function that triggers the new tab (e.g., clicking a link)
 * @returns Promise resolving to the new Page object
 * 
 * @example
 * ```typescript
 * const newPage = await handleNewTab(context, async () => {
 *   await page.click('a[target="_blank"]');
 * });
 * await newPage.waitForLoadState();
 * ```
 */
export async function handleNewTab(
  context: BrowserContext,
  trigger: () => Promise<void>
): Promise<Page> {
  try {
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      trigger(),
    ]);

    await newPage.waitForLoadState('load');
    return newPage;
  } catch (error) {
    throw new Error(
      `Failed to handle new tab: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Switches to a specific browser tab by index or URL pattern.
 * 
 * @param context - Browser context containing the tabs
 * @param selector - Tab index (0-based) or URL pattern to match
 * @returns Promise resolving to the selected Page
 * 
 * @example
 * ```typescript
 * // Switch by index
 * const firstTab = await switchToTab(context, 0);
 * 
 * // Switch by URL pattern
 * const dashboardTab = await switchToTab(context, /dashboard/);
 * ```
 */
export async function switchToTab(
  context: BrowserContext,
  selector: number | RegExp
): Promise<Page> {
  try {
    const pages = context.pages();

    if (pages.length === 0) {
      throw new Error('No pages available in context');
    }

    let targetPage: Page | undefined;

    if (typeof selector === 'number') {
      if (selector < 0 || selector >= pages.length) {
        throw new Error(`Tab index ${selector} out of range (0-${pages.length - 1})`);
      }
      targetPage = pages[selector]!;
    } else {
      targetPage = pages.find(page => selector.test(page.url()));
      if (!targetPage) {
        throw new Error(`No tab found matching pattern: ${selector}`);
      }
    }

    await targetPage.bringToFront();
    return targetPage
  } catch (error) {
    throw new Error(
      `Failed to switch to tab: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Closes a specific tab while keeping the browser context active.
 * 
 * @param page - Page (tab) to close
 * @returns Promise that resolves when tab is closed
 * 
 * @example
 * ```typescript
 * await closeTab(secondTab);
 * // Second tab is closed, but context and other tabs remain active
 * ```
 */
export async function closeTab(page: Page): Promise<void> {
  try {
    if (!page.isClosed()) {
      await page.close();
    }
  } catch (error) {
    throw new Error(
      `Failed to close tab: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
