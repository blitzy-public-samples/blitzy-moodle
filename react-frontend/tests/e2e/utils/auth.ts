/**
 * Authentication Utilities for Playwright E2E Tests
 * 
 * Provides comprehensive authentication functions for E2E testing including:
 * - User login/logout operations
 * - JWT token management (extraction, validation, refresh)
 * - Multi-role authentication (student, teacher, admin)
 * - Authentication state management
 * - Token refresh and expiration handling
 * 
 * These utilities enable tests to authenticate users, manage sessions,
 * and verify authentication state across different user roles.
 * 
 * @module e2e/utils/auth
 */

import { Page } from '@playwright/test';
import { jwtDecode } from 'jwt-decode';
import { 
  waitForElement, 
  retryOperation, 
  pollUntil 
} from './wait-helpers';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Login credentials for user authentication
 */
export interface LoginCredentials {
  /** Username or email for login */
  username: string;
  /** Password for authentication */
  password: string;
}

/**
 * JWT authentication token response from API
 */
export interface AuthToken {
  /** Access token for API authorization (1 hour expiration) */
  accessToken: string;
  /** Refresh token for obtaining new access tokens (7 days expiration) */
  refreshToken: string;
  /** Token expiration time in seconds */
  expiresIn: number;
  /** Token type (typically "Bearer") */
  tokenType: string;
}

/**
 * Decoded JWT token payload structure
 */
export interface TokenPayload {
  /** User ID (subject) */
  sub: number;
  /** User roles array (e.g., ['student'], ['teacher'], ['admin']) */
  roles: string[];
  /** Issued at timestamp (Unix epoch) */
  iat: number;
  /** Expiration timestamp (Unix epoch) */
  exp: number;
  /** Token issuer (Moodle site URL) */
  iss: string;
}

/**
 * User role type for role-based authentication
 */
export type UserRole = 'student' | 'teacher' | 'admin' | 'guest';

// ============================================================================
// Constants
// ============================================================================

/** Login page URL path */
const LOGIN_PAGE_URL = '/login';

/** LocalStorage key for access token */
const ACCESS_TOKEN_KEY = 'accessToken';

/** LocalStorage key for refresh token */
const REFRESH_TOKEN_KEY = 'refreshToken';

/** Cookie name for JWT token (if using httpOnly cookies) */
const JWT_COOKIE_NAME = 'jwt_token';

/** API endpoint for login */
const LOGIN_API_ENDPOINT = '/api/v1/auth/login';

/** API endpoint for token refresh */
const REFRESH_API_ENDPOINT = '/api/v1/auth/refresh';

/** Test user credentials */
const TEST_USERS = {
  student: {
    username: 'student1',
    password: 'Student@123',
  },
  teacher: {
    username: 'teacher1',
    password: 'Teacher@123',
  },
  admin: {
    username: 'admin',
    password: 'Admin@123',
  },
};

// ============================================================================
// Core Authentication Functions
// ============================================================================

/**
 * Login user with username and password, obtain JWT token, and store in browser context
 * 
 * Performs a complete login flow:
 * 1. Navigate to login page
 * 2. Fill in credentials and submit form
 * 3. Wait for redirect to dashboard
 * 4. Extract JWT token from storage
 * 5. Verify token structure and validity
 * 6. Store authentication state for reuse
 * 
 * @param page Playwright Page object
 * @param credentials User login credentials
 * @returns Authenticated Page object
 * @throws Error if login fails or token is invalid
 * 
 * @example
 * const page = await login(page, { username: 'student1', password: 'Student@123' });
 */
export async function login(page: Page, credentials: LoginCredentials): Promise<Page> {
  // Navigate to login page
  await page.goto(LOGIN_PAGE_URL);
  // Removed waitForPageLoad - the form element waits below are more reliable

  // Wait for login form to be visible
  await waitForElement(page, 'input[name="username"]', 'visible', { timeout: 5000 });
  await waitForElement(page, 'input[name="password"]', 'visible', { timeout: 5000 });

  // Fill in credentials
  await page.fill('input[name="username"]', credentials.username);
  await page.fill('input[name="password"]', credentials.password);

  // Submit the form and wait for navigation
  // Set up navigation expectation before clicking
  // Use a regex pattern to match the dashboard URL reliably
  const navigationPromise = page.waitForURL(/\/dashboard/, { timeout: 10000 });
  
  // Click submit button to trigger form submission
  await page.click('button[type="submit"]');
  
  // Now wait for the navigation to complete
  await navigationPromise;

  // Navigation is complete - the more specific URL and element waits below are sufficient
  // Note: Removed waitForPageLoad here as it waits for networkidle which is too strict
  // for React apps with background API activity (React Query, etc.)

  // Extract JWT token from storage with retry logic
  const token = await retryOperation(
    async () => {
      const extractedToken = await getAuthToken(page);
      if (!extractedToken) {
        throw new Error('Token not found in storage after login');
      }
      return extractedToken;
    },
    {
      maxAttempts: 5,
      initialDelay: 200,
      maxDelay: 2000,
      factor: 2,
    }
  );

  // Verify token structure and validity
  const payload = decodeToken(token);
  
  if (!payload.sub || !payload.roles || !Array.isArray(payload.roles)) {
    throw new Error('Invalid token payload structure');
  }

  if (payload.exp * 1000 < Date.now()) {
    throw new Error('Token is already expired');
  }

  // Verify successful authentication by checking the redirect to dashboard
  // Note: User menu may not be implemented yet, so we check for the dashboard heading
  await page.waitForURL(/\/dashboard/, { timeout: 5000 });
  
  // Wait for the dashboard page to load
  await waitForElement(page, 'h1:has-text("Dashboard")', 'visible', { timeout: 5000 });

  return page;
}

/**
 * Login with predefined student test user credentials
 * 
 * Convenience function for logging in as a student role.
 * Uses predefined test credentials and verifies student role in JWT token.
 * 
 * @param page Playwright Page object
 * @returns Authenticated Page with student context
 * @throws Error if login fails or user doesn't have student role
 * 
 * @example
 * const studentPage = await loginAsStudent(page);
 */
export async function loginAsStudent(page: Page): Promise<Page> {
  await login(page, TEST_USERS.student);

  // Verify student role in token
  const token = await getAuthToken(page);
  if (token) {
    const payload = decodeToken(token);
    const hasStudentRole = payload.roles.some(
      role => role.toLowerCase() === 'student'
    );
    
    if (!hasStudentRole) {
      throw new Error('User does not have student role');
    }
  }

  return page;
}

/**
 * Login with predefined teacher test user credentials
 * 
 * Convenience function for logging in as a teacher role.
 * Uses predefined test credentials and verifies teacher role in JWT token.
 * 
 * @param page Playwright Page object
 * @returns Authenticated Page with teacher context
 * @throws Error if login fails or user doesn't have teacher role
 * 
 * @example
 * const teacherPage = await loginAsTeacher(page);
 */
export async function loginAsTeacher(page: Page): Promise<Page> {
  await login(page, TEST_USERS.teacher);

  // Verify teacher role in token
  const token = await getAuthToken(page);
  if (token) {
    const payload = decodeToken(token);
    const hasTeacherRole = payload.roles.some(
      role => role.toLowerCase() === 'teacher' || role.toLowerCase() === 'editingteacher'
    );
    
    if (!hasTeacherRole) {
      throw new Error('User does not have teacher role');
    }
  }

  return page;
}

/**
 * Login with predefined admin test user credentials
 * 
 * Convenience function for logging in as an admin role.
 * Uses predefined test credentials and verifies admin role in JWT token.
 * 
 * @param page Playwright Page object
 * @returns Authenticated Page with admin context
 * @throws Error if login fails or user doesn't have admin role
 * 
 * @example
 * const adminPage = await loginAsAdmin(page);
 */
export async function loginAsAdmin(page: Page): Promise<Page> {
  await login(page, TEST_USERS.admin);

  // Verify admin role in token
  const token = await getAuthToken(page);
  if (token) {
    const payload = decodeToken(token);
    const hasAdminRole = payload.roles.some(
      role => role.toLowerCase() === 'admin' || role.toLowerCase() === 'manager'
    );
    
    if (!hasAdminRole) {
      throw new Error('User does not have admin role');
    }
  }

  return page;
}

/**
 * Logout current user and invalidate JWT token
 * 
 * Performs complete logout flow:
 * 1. Click logout button in user menu
 * 2. Wait for redirect to login page
 * 3. Verify token removed from storage
 * 4. Verify API calls return 401 Unauthorized
 * 5. Clear browser storage completely
 * 
 * @param page Playwright Page object
 * @returns Promise that resolves when logout is complete
 * @throws Error if logout fails
 * 
 * @example
 * await logout(page);
 */
export async function logout(page: Page): Promise<void> {
  // Check if user is authenticated before attempting logout
  const authenticated = await isAuthenticated(page);
  
  if (!authenticated) {
    // Not logged in, just clear any residual state and return
    await clearAuthenticationState(page);
    return;
  }

  // Check if user menu is visible (indicates user is on a page with auth UI)
  const userMenuVisible = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);
  
  if (!userMenuVisible) {
    // User is authenticated but not on a page with the user menu
    // Just clear auth state and navigate to login
    await clearAuthenticationState(page);
    await page.goto(LOGIN_PAGE_URL);
    // Removed waitForPageLoad - navigation is sufficient here
    return;
  }

  // Open user menu
  await page.click('[data-testid="user-menu"]');
  
  // Wait for menu to expand
  await waitForElement(page, '[data-testid="logout-button"]', 'visible', { timeout: 3000 });

  // Click logout button and wait for navigation
  await Promise.all([
    page.waitForURL(`**${LOGIN_PAGE_URL}`, { timeout: 10000 }),
    page.click('[data-testid="logout-button"]'),
  ]);

  // Removed waitForPageLoad - URL wait above is sufficient

  // Verify token removed from storage
  await pollUntil(
    async () => {
      const token = await getAuthToken(page);
      return token === null;
    },
    {
      timeout: 5000,
      interval: 100,
      errorMessage: 'Token was not removed from storage after logout',
    }
  );

  // Clear all authentication state
  await clearAuthenticationState(page);

  // Verify unauthenticated state by checking for login form
  await waitForElement(page, 'input[name="username"]', 'visible', { timeout: 5000 });
}

// ============================================================================
// Token Management Functions
// ============================================================================

/**
 * Extract JWT token from browser storage
 * 
 * Checks both localStorage and cookies for authentication token.
 * Prioritizes localStorage access token, then falls back to httpOnly cookie.
 * 
 * @param page Playwright Page object
 * @returns JWT token string or null if not found
 * 
 * @example
 * const token = await getAuthToken(page);
 * if (token) {
 *   console.log('User is authenticated');
 * }
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  // Try to get token from localStorage first
  // Wrap in try-catch to handle SecurityError when page context doesn't have localStorage access
  let localStorageToken: string | null = null;
  try {
    localStorageToken = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, ACCESS_TOKEN_KEY);
  } catch (error) {
    // SecurityError when localStorage is not accessible (e.g., on about:blank)
    // This is expected and we'll fall back to checking cookies
  }

  if (localStorageToken) {
    return localStorageToken;
  }

  // Try to get token from cookies as fallback
  const cookies = await page.context().cookies();
  const jwtCookie = cookies.find(cookie => cookie.name === JWT_COOKIE_NAME);

  if (jwtCookie) {
    return jwtCookie.value;
  }

  return null;
}

/**
 * Decode JWT token and extract payload
 * 
 * Uses jwt-decode library to parse JWT token and extract payload data
 * including user ID, roles, issued at, and expiration timestamps.
 * Validates token structure and required fields.
 * 
 * @param token JWT token string
 * @returns Decoded token payload
 * @throws Error if token is malformed or missing required fields
 * 
 * @example
 * const token = await getAuthToken(page);
 * const payload = decodeToken(token);
 * console.log('User ID:', payload.sub);
 * console.log('Roles:', payload.roles);
 */
export function decodeToken(token: string): TokenPayload {
  try {
    const decoded = jwtDecode<TokenPayload>(token);

    // Validate required fields
    if (!decoded.sub) {
      throw new Error('Token payload missing "sub" field');
    }

    if (!decoded.roles || !Array.isArray(decoded.roles)) {
      throw new Error('Token payload missing or invalid "roles" field');
    }

    if (!decoded.iat || !decoded.exp) {
      throw new Error('Token payload missing timestamp fields');
    }

    return decoded;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to decode token: ${error.message}`);
    }
    throw new Error('Failed to decode token: Unknown error');
  }
}

/**
 * Check if user is currently authenticated
 * 
 * Performs comprehensive authentication check:
 * 1. Verifies token exists in storage
 * 2. Decodes token and checks expiration
 * 3. Optionally verifies token with API call
 * 
 * @param page Playwright Page object
 * @param verifyWithApi Optional flag to verify token via API (default: false)
 * @returns Boolean indicating authentication status
 * 
 * @example
 * const isLoggedIn = await isAuthenticated(page);
 * if (isLoggedIn) {
 *   // Proceed with authenticated actions
 * }
 */
export async function isAuthenticated(
  page: Page, 
  verifyWithApi: boolean = false
): Promise<boolean> {
  // Get token from storage
  const token = await getAuthToken(page);

  if (!token) {
    return false;
  }

  try {
    // Decode and validate token
    const payload = decodeToken(token);

    // Check if token is expired
    const isExpired = payload.exp * 1000 < Date.now();
    if (isExpired) {
      return false;
    }

    // Optionally verify with API
    if (verifyWithApi) {
      const response = await page.request.get('/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      return response.ok();
    }

    return true;
  } catch (error) {
    // Token is malformed or invalid
    return false;
  }
}

/**
 * Refresh expired access token using refresh token
 * 
 * Calls the refresh token API endpoint to obtain a new access token.
 * Updates token in browser storage and returns new token.
 * 
 * @param page Playwright Page object
 * @returns New access token or throws error if refresh failed
 * @throws Error if refresh token is missing or refresh fails
 * 
 * @example
 * try {
 *   const newToken = await refreshToken(page);
 *   console.log('Token refreshed successfully');
 * } catch (error) {
 *   console.error('Token refresh failed, user must re-login');
 * }
 */
export async function refreshToken(page: Page): Promise<string> {
  // Get refresh token from storage
  const refreshTokenValue = await page.evaluate((key) => {
    return localStorage.getItem(key);
  }, REFRESH_TOKEN_KEY);

  if (!refreshTokenValue) {
    throw new Error('Refresh token not found in storage');
  }

  // Call refresh API endpoint
  const response = await page.request.post(REFRESH_API_ENDPOINT, {
    data: {
      refreshToken: refreshTokenValue,
    },
  });

  if (!response.ok()) {
    throw new Error(`Token refresh failed with status: ${response.status()}`);
  }

  const responseData = await response.json();

  if (!responseData.success || !responseData.data?.accessToken) {
    throw new Error('Invalid response from refresh token endpoint');
  }

  const newAccessToken = responseData.data.accessToken;

  // Update access token in storage
  await page.evaluate(
    ({ key, token }) => {
      localStorage.setItem(key, token);
    },
    { key: ACCESS_TOKEN_KEY, token: newAccessToken }
  );

  return newAccessToken;
}

/**
 * Wait for automatic token refresh to complete
 * 
 * Monitors token value in storage and detects when token changes,
 * indicating an automatic refresh has occurred. Used for testing
 * the automatic token refresh mechanism in the application.
 * 
 * @param page Playwright Page object
 * @param timeoutMs Maximum time to wait for refresh in milliseconds
 * @returns Promise that resolves when token refresh is detected
 * @throws Error if token refresh doesn't occur within timeout
 * 
 * @example
 * // Wait for automatic token refresh
 * await waitForTokenRefresh(page, 65000); // Wait up to 65 seconds
 */
export async function waitForTokenRefresh(
  page: Page, 
  timeoutMs: number = 65000
): Promise<void> {
  // Get initial token value
  const initialToken = await getAuthToken(page);

  if (!initialToken) {
    throw new Error('No token found to monitor for refresh');
  }

  // Poll until token changes
  await pollUntil(
    async () => {
      const currentToken = await getAuthToken(page);
      return currentToken !== null && currentToken !== initialToken;
    },
    {
      timeout: timeoutMs,
      interval: 1000,
      errorMessage: 'Token was not refreshed within timeout period',
    }
  );

  // Verify new token is valid
  const newToken = await getAuthToken(page);
  if (newToken) {
    const payload = decodeToken(newToken);
    
    if (payload.exp * 1000 < Date.now()) {
      throw new Error('Refreshed token is already expired');
    }
  }
}

// ============================================================================
// Advanced Authentication Functions
// ============================================================================

/**
 * Setup authentication state without UI login
 * 
 * Bypasses UI login flow by calling API directly to obtain JWT token.
 * Stores token in browser context for faster test setup.
 * Used for tests that don't focus on authentication but require
 * an authenticated user.
 * 
 * @param page Playwright Page object
 * @param credentials User login credentials
 * @returns Promise that resolves when authentication state is set up
 * @throws Error if API login fails
 * 
 * @example
 * // Fast authentication without UI interaction
 * await setupAuthenticationState(page, { 
 *   username: 'student1', 
 *   password: 'Student@123' 
 * });
 * await page.goto('/courses'); // Now authenticated
 */
export async function setupAuthenticationState(
  page: Page,
  credentials: LoginCredentials
): Promise<void> {
  // Call login API directly
  const response = await page.request.post(LOGIN_API_ENDPOINT, {
    data: {
      username: credentials.username,
      password: credentials.password,
    },
  });

  if (!response.ok()) {
    throw new Error(`API login failed with status: ${response.status()}`);
  }

  const responseData = await response.json();

  if (!responseData.success || !responseData.data) {
    throw new Error('Invalid response from login API');
  }

  const authToken: AuthToken = responseData.data;

  // Store tokens in localStorage
  await page.evaluate(
    ({ accessKey, refreshKey, accessToken, refreshToken }) => {
      localStorage.setItem(accessKey, accessToken);
      localStorage.setItem(refreshKey, refreshToken);
    },
    {
      accessKey: ACCESS_TOKEN_KEY,
      refreshKey: REFRESH_TOKEN_KEY,
      accessToken: authToken.accessToken,
      refreshToken: authToken.refreshToken,
    }
  );

  // Verify token is valid
  const isAuth = await isAuthenticated(page);
  if (!isAuth) {
    throw new Error('Authentication state setup failed - token is invalid');
  }
}

/**
 * Clear all authentication data from browser
 * 
 * Removes all authentication-related data including:
 * - Access token from localStorage
 * - Refresh token from localStorage
 * - JWT cookies
 * - User data from storage
 * 
 * Resets authentication state to logged-out.
 * 
 * @param page Playwright Page object
 * @returns Promise that resolves when all auth data is cleared
 * 
 * @example
 * await clearAuthenticationState(page);
 * // User is now in logged-out state
 */
export async function clearAuthenticationState(page: Page): Promise<void> {
  // Clear tokens from localStorage
  // Wrap in try-catch to handle SecurityError when localStorage is not accessible
  try {
    await page.evaluate(
      ({ accessKey, refreshKey }) => {
        localStorage.removeItem(accessKey);
        localStorage.removeItem(refreshKey);
        // Also clear any user-related data
        localStorage.removeItem('user');
        localStorage.removeItem('userPreferences');
      },
      {
        accessKey: ACCESS_TOKEN_KEY,
        refreshKey: REFRESH_TOKEN_KEY,
      }
    );
  } catch (error) {
    // SecurityError when localStorage is not accessible (e.g., on about:blank)
    // This is acceptable as it means there's no auth state to clear
  }

  // Clear JWT cookies
  const context = page.context();
  const cookies = await context.cookies();
  
  const jwtCookies = cookies.filter(
    cookie => cookie.name === JWT_COOKIE_NAME || cookie.name.includes('auth')
  );

  if (jwtCookies.length > 0) {
    await context.clearCookies();
  }

  // Verify authentication state is cleared
  const isAuth = await isAuthenticated(page);
  if (isAuth) {
    throw new Error('Failed to clear authentication state');
  }
}
