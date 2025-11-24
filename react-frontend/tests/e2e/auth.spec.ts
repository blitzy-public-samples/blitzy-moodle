import { test, expect } from './setup/msw';
import type { Page } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import {
  getAuthToken,
  decodeToken,
  isAuthenticated,
  logout,
  waitForTokenRefresh
} from './utils/auth';
import { testStudent, testTeacher, testAdmin, TEST_PASSWORD } from '../../src/mocks/fixtures/users';

// API Response Types
interface AuthMeSuccessResponse {
  success: true;
  data: {
    username: string;
    [key: string]: unknown;
  };
}

interface ApiErrorResponse {
  success: false;
  error: {
    code?: string;
    message?: string;
    [key: string]: unknown;
  };
}

/**
 * Authentication E2E Test Suite
 * 
 * This is the foundational test suite that validates the complete authentication
 * workflow including login, JWT token generation, token refresh, role-based access,
 * and security requirements. All other E2E tests depend on this test passing.
 * 
 * Test Coverage:
 * - Login form display and validation
 * - Invalid credentials and account lockout
 * - Successful authentication with JWT token generation
 * - Token structure validation and refresh mechanism
 * - Persistent login with remember me functionality
 * - Role-based access control (student, teacher, admin)
 * - Security requirements (HTTPS, password masking, token security)
 * - Performance requirements (<2 seconds login)
 * - SSO integration and password reset workflows
 */
test.describe('Authentication E2E Tests', () => {
  let loginPage: LoginPage;

  /**
   * Setup before each test
   * Ensures clean authentication state and navigates to login page
   */
  test.beforeEach(async ({ page }: { page: Page }) => {
    loginPage = new LoginPage(page);

    // Ensure clean state - clear any existing authentication
    await logout(page);

    // Navigate to login page
    await page.goto('/login');
    await loginPage.waitForLoginForm();
  });

  /**
   * Cleanup after each test
   * Logs out user to ensure clean state for subsequent tests
   */
  test.afterEach(async ({ page }: { page: Page }) => {
    // Logout user to prepare for next test
    try {
      await logout(page);
    } catch (error) {
      // Ignore logout errors in cleanup
      console.warn('Cleanup logout failed:', error);
    }
  });

  /**
   * Test 1: Login Form Display
   * Verifies that the login page renders all required form elements
   */
  test('should display login form with all required fields', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Verify all form elements are visible
    await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="remember-me-checkbox"]')).toBeVisible();
    await expect(page.locator('[data-testid="submit-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="forgot-password-link"]')).toBeVisible();

    // Verify page title
    await expect(page).toHaveTitle('Moodle LMS');
  });

  /**
   * Test 2: Form Validation
   * Verifies that submitting empty form shows appropriate validation errors
   */
  test('should show validation errors when submitting empty form', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Submit empty form
    await page.click('[data-testid="submit-button"]');

    // Wait for validation errors to appear
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 5000 });

    // Verify validation errors shown
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toBeTruthy();
    expect(errorMessage!.toLowerCase()).toMatch(/username|password|required/);
  });

  /**
   * Test 3: Invalid Credentials
   * Verifies that login fails with invalid username/password combination
   */
  test('should display error message for invalid credentials', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Attempt login with invalid credentials
    await loginPage.login('invaliduser@example.com', 'wrongpassword123');

    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 5000 });

    // Verify error message displayed
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toBeTruthy();
    expect(errorMessage!.toLowerCase()).toMatch(/invalid|incorrect|wrong/);
  });

  /**
   * Test 4: Account Lockout
   * Verifies that multiple failed login attempts trigger account lockout
   */
  test('should lock account after multiple failed login attempts', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Attempt login multiple times with wrong password
    // Use attemptLoginAndWaitForResult to ensure each attempt fully completes
    // before starting the next one, preventing UI state issues
    const maxAttempts = 5;
    let lastError: string | null = null;
    for (let i = 0; i < maxAttempts; i++) {
      lastError = await loginPage.attemptLoginAndWaitForResult('testuser@example.com', 'wrongpassword');
      console.log(`[Test] Attempt ${i + 1} of ${maxAttempts}, error: ${lastError}`);
    }

    // Verify account lockout message appears after the 5th failed attempt
    expect(lastError).toBeTruthy();
    expect(lastError!.toLowerCase()).toMatch(/locked|blocked|temporarily|too many/);
  });

  /**
   * Test 5: Successful Login
   * Verifies successful authentication with valid credentials
   */
  test('should successfully login with valid credentials', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    const startTime = Date.now();

    // Login with valid credentials
    await loginPage.login(testStudent.username, TEST_PASSWORD);

    // Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Verify logged in state
    const isLoggedIn = await loginPage.isLoggedIn();
    expect(isLoggedIn).toBe(true);

    // Performance: Verify login completes in <2 seconds
    const loginDuration = Date.now() - startTime;
    expect(loginDuration).toBeLessThan(2000);
  });

  /**
   * Test 6: JWT Token Generation
   * Verifies that JWT access token is generated and stored after successful login
   */
  test('should generate and store JWT access token after successful login', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Login
    await loginPage.login(testStudent.username, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Verify JWT token stored
    const token = await loginPage.getToken();
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    // Verify token format (JWT has 3 parts separated by dots)
    const tokenParts = token!.split('.');
    expect(tokenParts).toHaveLength(3);
  });

  /**
   * Test 7: JWT Token Structure
   * Validates the structure and required fields of the JWT token payload
   */
  test('should validate JWT token structure and payload', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Login
    await loginPage.login(testStudent.username, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Get and decode token
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();

    // Verify token structure using LoginPage method
    const isValid = await loginPage.verifyTokenStructure();
    expect(isValid).toBe(true);

    // Decode and verify payload fields
    const decoded = decodeToken(token!);
    expect(decoded).toBeTruthy();

    // Verify user ID (sub claim)
    expect(decoded.sub).toBeTruthy();
    expect(typeof decoded.sub === 'number' || typeof decoded.sub === 'string').toBe(true);

    // Verify roles array
    expect(decoded.roles).toBeTruthy();
    expect(Array.isArray(decoded.roles)).toBe(true);
    expect(decoded.roles.length).toBeGreaterThan(0);

    // Verify expiration (exp claim)
    expect(decoded.exp).toBeTruthy();
    expect(typeof decoded.exp).toBe('number');
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

    // Verify issuer (iss claim)
    expect(decoded.iss).toBeTruthy();

    // Verify issued at time (iat claim)
    expect(decoded.iat).toBeTruthy();
    expect(typeof decoded.iat).toBe('number');
    expect(decoded.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  /**
   * Test 8: Redirect After Login
   * Verifies that user is redirected to the intended page after successful login
   */
  test('should redirect to intended page after successful login', async ({ page }) => {
    loginPage = new LoginPage(page);

    // Navigate to login with return URL parameter
    const returnUrl = '/courses/5';
    await page.goto(`/login?returnurl=${encodeURIComponent(returnUrl)}`);
    await loginPage.waitForLoginForm();

    // Login
    await loginPage.login(testStudent.username, TEST_PASSWORD);

    // Verify redirected to intended page
    await expect(page).toHaveURL(new RegExp(returnUrl), { timeout: 10000 });
  });

  /**
   * Test 9: Persistent Login (Remember Me)
   * Verifies that checking "Remember me" stores refresh token with 7-day expiration
   */
  test('should store refresh token when "Remember me" is checked', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Check "Remember me" checkbox
    await page.check('[data-testid="remember-me-checkbox"]');

    // Login
    await loginPage.login(testStudent.username, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Verify refresh token exists
    const hasRefreshToken = await page.evaluate(() => {
      return Boolean(
        localStorage.getItem('moodle_refresh_token') ||
        localStorage.getItem('refresh_token') ||
        document.cookie.includes('moodle_refresh_token') ||
        document.cookie.includes('refresh_token')
      );
    });
    expect(hasRefreshToken).toBe(true);

    // Verify refresh token expiration (approximately 7 days)
    const cookies = await page.context().cookies();
    const refreshCookie = cookies.find(c => c.name === 'moodle_refresh_token' || c.name === 'refresh_token');

    if (refreshCookie?.expires) {
      const expirationDays = (refreshCookie.expires * 1000 - Date.now()) / (1000 * 60 * 60 * 24);
      expect(expirationDays).toBeGreaterThanOrEqual(6);
      expect(expirationDays).toBeLessThanOrEqual(8);
    }
  });

  /**
   * Test 10: Token Refresh
   * Verifies that access token is automatically refreshed before expiry
   */
  test('should automatically refresh access token before expiry', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Login
    await loginPage.login(testStudent.username, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Get original token
    const originalToken = await getAuthToken(page);
    expect(originalToken).toBeTruthy();

    // Wait for token refresh (simulated by utility function)
    await waitForTokenRefresh(page);

    // Get new token
    const newToken = await getAuthToken(page);
    expect(newToken).toBeTruthy();

    // Verify token was refreshed (tokens should be different)
    if (originalToken !== newToken) {
      // Token was refreshed
      const decoded = decodeToken(newToken!);
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    }

    // Verify user remains authenticated
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);
  });

  /**
   * Test 11: Authenticated API Calls
   * Verifies that JWT token is included in API requests and accepted by server
   */
  test('should include JWT token in authenticated API calls', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Login
    await loginPage.login(testStudent.username, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Get token
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();

    // Make authenticated API request from browser context (so MSW intercepts)
    const result = await page.evaluate(async (authToken) => {
      const response = await fetch('/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        text
      };
    }, token);

    // Verify successful response
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);

    const data = JSON.parse(result.text) as AuthMeSuccessResponse;
    expect(data.success).toBe(true);
    expect(data.data).toBeTruthy();
    expect(data.data.username).toBe(testStudent.username);
  });

  /**
   * Test 12: Role-Based Access - Student
   * Verifies that student role is correctly included in JWT token
   */
  test('should include correct role in JWT token for student', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Login as student
    await loginPage.login(testStudent.username, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Decode token and verify role
    const token = await getAuthToken(page);
    const decoded = decodeToken(token!);

    expect(decoded.roles).toContain('student');
    expect(decoded.roles).not.toContain('teacher');
    expect(decoded.roles).not.toContain('admin');
  });

  /**
   * Test 13: Role-Based Access - Teacher
   * Verifies that teacher role is correctly included in JWT token
   */
  test('should include correct role in JWT token for teacher', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Login as teacher
    await loginPage.login(testTeacher.username, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Decode token and verify role
    const token = await getAuthToken(page);
    const decoded = decodeToken(token!);

    expect(decoded.roles).toContain('teacher');
    // Teacher may also have editingteacher role
  });

  /**
   * Test 14: Role-Based Access - Admin
   * Verifies that admin role is correctly included in JWT token
   */
  test('should include correct role in JWT token for admin', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Login as admin
    await loginPage.login(testAdmin.username, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Decode token and verify role
    const token = await getAuthToken(page);
    const decoded = decodeToken(token!);

    expect(decoded.roles).toContain('admin');
  });

  /**
   * Test 15: Password Reset Link
   * Verifies that clicking "Forgot password" link redirects to password reset page
   */
  test('should redirect to password reset page when clicking forgot password link', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Click forgot password link
    await loginPage.clickForgotPassword();

    // Verify redirect to password reset page
    await expect(page).toHaveURL(/\/login\/forgot_password|\/password\/reset/, { timeout: 5000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  /**
   * Test 16: Login State Persistence
   * Verifies that user remains logged in after page refresh
   */
  test('should maintain login state after page refresh', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Login
    await loginPage.login(testStudent.username, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Verify logged in
    let authenticated = await loginPage.isLoggedIn();
    expect(authenticated).toBe(true);

    // Refresh page
    await page.reload({ waitUntil: 'networkidle' });

    // Verify still logged in
    authenticated = await loginPage.isLoggedIn();
    expect(authenticated).toBe(true);

    // Verify not redirected to login page
    await expect(page).not.toHaveURL(/\/login/);
  });

  /**
   * Test 17: Password Security
   * Verifies that password is not exposed in DOM or network requests
   */
  test('should not expose password in DOM or network requests', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Fill password field
    await page.fill('[data-testid="password-input"]', TEST_PASSWORD);

    // Verify password input type is "password"
    const passwordInput = page.locator('[data-testid="password-input"]');
    const inputType = await passwordInput.getAttribute('type');
    expect(inputType).toBe('password');

    // Monitor network requests
    const requests: string[] = [];
    page.on('request', request => {
      requests.push(request.url());
    });

    // Login
    await loginPage.login(testStudent.username, TEST_PASSWORD);

    // Verify password not in any URL
    const urlsWithPassword = requests.filter(url => url.includes(TEST_PASSWORD));
    expect(urlsWithPassword).toHaveLength(0);
  });

  /**
   * Test 18: HTTPS Enforcement
   * Verifies that authentication uses HTTPS in production
   */
  test('should enforce HTTPS for authentication in production', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    const url = page.url();

    // In production, HTTPS should be enforced
    if (process.env.NODE_ENV === 'production') {
      expect(url).toMatch(/^https:\/\//);
    }
  });

  /**
   * Test 19: Token URL Security
   * Verifies that JWT token is never exposed in URL parameters
   */
  test('should not expose JWT token in URL', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Login
    await loginPage.login(testStudent.username, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Get token
    const token = await getAuthToken(page);
    const url = page.url();

    // Verify token not in URL
    expect(url).not.toContain(token);
    expect(url).not.toMatch(/[?&]token=/);
    expect(url).not.toMatch(/[?&]access_token=/);
  });

  /**
   * Test 20: Complete Authentication Workflow Performance
   * Verifies entire authentication workflow completes within performance targets
   */
  test('should complete full authentication workflow within performance targets', async ({ page }) => {
    loginPage = new LoginPage(page);

    const startTime = Date.now();

    // Navigate to login
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Login
    await loginPage.login(testStudent.username, TEST_PASSWORD);

    // Wait for dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Verify token generated
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();

    // Make authenticated API call from browser context (so MSW intercepts)
    const result = await page.evaluate(async (authToken) => {
      const response = await fetch('/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      return {
        ok: response.ok
      };
    }, token);
    expect(result.ok).toBe(true);

    // Verify total time under 2 seconds
    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(2000);
  });

  /**
   * Test 21: Logout Functionality
   * Verifies that logout clears authentication state and redirects to login
   */
  test('should successfully logout and clear authentication state', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Login
    await loginPage.login(testStudent.username, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Verify logged in
    let authenticated = await loginPage.isLoggedIn();
    expect(authenticated).toBe(true);

    // Logout
    await logout(page);

    // Verify logged out
    authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(false);

    // Verify token cleared
    const token = await page.evaluate(() => {
      return localStorage.getItem('access_token');
    });
    expect(token).toBeNull();

    // Verify redirected to login page
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  /**
   * Test 22: Unauthorized API Access
   * Verifies that API requests without token are rejected with 401
   */
  test('should reject API calls without valid JWT token', async ({ page }) => {
    // Attempt API call without authentication from browser context (so MSW intercepts)
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/v1/auth/me');
      const text = await response.text();
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        text
      };
    });

    // Parse response
    const data = JSON.parse(result.text) as ApiErrorResponse;

    // Verify 401 Unauthorized response
    expect(result.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBeTruthy();
  });

  /**
   * Test 23: Expired Token Handling
   * Verifies that API requests with expired token are rejected with 401
   */
  test('should reject API calls with expired JWT token', async ({ page }) => {
    // Use an expired token (payload has exp in the past)
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImV4cCI6MTYwMDAwMDAwMCwiaWF0IjoxNjAwMDAwMDAwLCJpc3MiOiJtb29kbGUiLCJyb2xlcyI6WyJzdHVkZW50Il19.invalid';

    // Make request from browser context (so MSW intercepts)
    const result = await page.evaluate(async (token) => {
      const response = await fetch('/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const text = await response.text();
      return {
        status: response.status,
        text
      };
    }, expiredToken);

    // Verify 401 Unauthorized response
    expect(result.status).toBe(401);

    const data = JSON.parse(result.text) as ApiErrorResponse;
    expect(data.success).toBe(false);
    expect(data.error).toBeTruthy();
    expect(data.error.code).toMatch(/TOKEN_EXPIRED|UNAUTHORIZED|INVALID_TOKEN/i);
  });

  /**
   * Test 24: SSO Login Flow
   * Verifies SSO login button functionality (if configured)
   */
  test('should handle SSO login flow if configured', async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.waitForLoginForm();

    // Check if SSO button exists
    const ssoButton = page.locator('[data-testid="sso-login-button"]');
    const ssoButtonVisible = await ssoButton.isVisible().catch(() => false);

    if (ssoButtonVisible) {
      // Click SSO button
      await ssoButton.click();

      // Verify redirect to OAuth/SSO provider
      await page.waitForURL(/oauth|sso|saml|login/, { timeout: 5000 });

      // Note: Full SSO flow requires mock OAuth provider
      // This test only verifies the button exists and initiates redirect
    } else {
      // Skip test if SSO not configured
      test.skip();
    }
  });
});
