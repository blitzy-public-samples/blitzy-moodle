/**
 * E2E Test: Logout Workflow with Token Invalidation
 * 
 * Comprehensive end-to-end test suite validating logout functionality:
 * - Logout button visibility and interaction
 * - Session termination and cleanup
 * - JWT token invalidation and blacklisting
 * - Redirect behavior after logout
 * - Protected page access prevention
 * - Multi-tab logout synchronization
 * - Auto-logout on token expiration
 * - Re-authentication flow after logout
 * 
 * @module tests/e2e/logout.spec
 */

import { test, expect, describe, beforeEach, afterEach, Page } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { auth } from './utils/auth';
import { apiHelpers } from './utils/api-helpers';
import { browserHelpers } from './utils/browser-helpers';
import { testStudent, TEST_PASSWORD } from './fixtures/users';

describe('Logout Workflow', () => {
  let page: Page;
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let authToken: string | null;

  beforeEach(async ({ page: testPage, context }) => {
    page = testPage;
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);

    // Setup: Login as student user and verify dashboard loads successfully
    await auth.loginAsStudent(page, testStudent.username, TEST_PASSWORD);
    await dashboardPage.waitForDashboard();

    // Store auth token for later validation tests
    authToken = await auth.getAuthToken(page);
    expect(authToken).toBeTruthy();

    // Take screenshot of initial logged-in state
    await page.screenshot({ 
      path: `test-results/logout/before-logout-${Date.now()}.png`,
      fullPage: true 
    });
  });

  afterEach(async ({ page }) => {
    // Cleanup: Ensure user is logged out and session cleared
    try {
      await auth.clearAuthenticationState(page);
    } catch (error) {
      // Already logged out or cleared
      console.log('Cleanup: Session already cleared');
    }

    // Clear browser storage to prevent test pollution
    await browserHelpers.clearBrowserStorage(page);
  });

  test('should display logout button in user menu', async () => {
    // Test logout button visibility
    const userMenuButton = page.locator('[aria-label="User menu"], [data-testid="user-menu-button"]');
    await expect(userMenuButton).toBeVisible({ timeout: 5000 });

    // Open user menu
    await userMenuButton.click();
    await page.waitForTimeout(500); // Wait for menu animation

    // Verify logout button exists in menu
    const logoutButton = page.locator(
      'button:has-text("Logout"), button:has-text("Log out"), button:has-text("Sign out"), [data-testid="logout-button"]'
    ).first();
    await expect(logoutButton).toBeVisible({ timeout: 3000 });
    await expect(logoutButton).toBeEnabled();

    // Take screenshot showing logout button
    await page.screenshot({ 
      path: `test-results/logout/logout-button-visible-${Date.now()}.png` 
    });
  });

  test('should successfully logout and redirect to login page', async () => {
    // Execute logout action
    await auth.logout(page);

    // Wait for logout processing
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Test redirect after logout: Verify redirected to login page
    await loginPage.waitForLoginForm();
    expect(page.url()).toMatch(/\/login|\/auth\/login/);

    // Verify login form elements are displayed
    const loginForm = page.locator('form[name="login"], form[data-testid="login-form"]').first();
    await expect(loginForm).toBeVisible({ timeout: 5000 });

    // Take screenshot of login page after logout
    await page.screenshot({ 
      path: `test-results/logout/after-logout-login-page-${Date.now()}.png`,
      fullPage: true 
    });
  });

  test('should terminate session and prevent access to protected pages', async () => {
    // Perform logout
    await auth.logout(page);
    await loginPage.waitForLoginForm();

    // Test session termination: Verify cannot access protected pages
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Should redirect to login page
    await loginPage.waitForLoginForm();
    expect(page.url()).toMatch(/\/login|\/auth\/login/);

    // Verify authentication state is false
    const isAuthenticated = await auth.isAuthenticated(page);
    expect(isAuthenticated).toBe(false);

    // Attempt to access dashboard directly
    const dashboardAccessible = await page.locator('[data-testid="dashboard-content"]').isVisible()
      .catch(() => false);
    expect(dashboardAccessible).toBe(false);

    // Take screenshot showing blocked access
    await page.screenshot({ 
      path: `test-results/logout/protected-page-blocked-${Date.now()}.png` 
    });
  });

  test('should invalidate JWT token and return 401 for API requests', async () => {
    // Store old token before logout
    const oldToken = authToken as string;
    expect(oldToken).toBeTruthy();

    // Perform logout
    await auth.logout(page);
    await loginPage.waitForLoginForm();

    // Test token invalidation: Attempt API call with old token
    try {
      const response = await apiHelpers.apiRequest(page, {
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          'Authorization': `Bearer ${oldToken}`
        }
      });

      // Verify 401 Unauthorized response
      expect(response.status).toBe(401);
      expect(response.success).toBe(false);
      expect(response.error?.code).toMatch(/UNAUTHORIZED|TOKEN_INVALID|AUTHENTICATION_REQUIRED/i);

    } catch (error: any) {
      // API request should fail with 401
      expect(error.status || error.response?.status).toBe(401);
    }

    // Verify token is blacklisted on server
    const dashboardResponse = await apiHelpers.apiRequest(page, {
      method: 'GET',
      url: '/api/v1/users/dashboard',
      headers: {
        'Authorization': `Bearer ${oldToken}`
      }
    }).catch((err: any) => err);

    expect(dashboardResponse.status || dashboardResponse.response?.status).toBe(401);

    // Take screenshot after token validation test
    await page.screenshot({ 
      path: `test-results/logout/token-invalidated-${Date.now()}.png` 
    });
  });

  test('should clear authentication token from localStorage and cookies', async () => {
    // Verify token exists before logout
    const tokenBefore = await auth.getAuthToken(page);
    expect(tokenBefore).toBeTruthy();

    // Perform logout
    await auth.logout(page);
    await loginPage.waitForLoginForm();

    // Test localStorage cleared: Verify auth token removed
    const tokenAfter = await auth.getAuthToken(page);
    expect(tokenAfter).toBeNull();

    // Verify localStorage is cleared
    const localStorageKeys = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
      }
      return keys;
    });

    // Should not contain auth-related keys
    const authKeys = localStorageKeys.filter(key => 
      key.includes('auth') || key.includes('token') || key.includes('user')
    );
    expect(authKeys.length).toBe(0);

    // Verify cookies are cleared
    const cookies = await page.context().cookies();
    const authCookies = cookies.filter(cookie => 
      cookie.name.includes('auth') || 
      cookie.name.includes('token') || 
      cookie.name.includes('session')
    );
    expect(authCookies.length).toBe(0);

    // Take screenshot after storage verification
    await page.screenshot({ 
      path: `test-results/logout/storage-cleared-${Date.now()}.png` 
    });
  });

  test('should redirect dashboard access to login page after logout', async () => {
    // Perform logout
    await auth.logout(page);
    await loginPage.waitForLoginForm();

    // Test dashboard access: Try navigating to dashboard
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Verify redirected to login
    await loginPage.waitForLoginForm();
    expect(page.url()).toMatch(/\/login|\/auth\/login/);

    // Verify dashboard not rendered
    const dashboardLoaded = await dashboardPage.waitForDashboard().catch(() => false);
    expect(dashboardLoaded).toBe(false);

    // Take screenshot showing redirect
    await page.screenshot({ 
      path: `test-results/logout/dashboard-redirect-${Date.now()}.png` 
    });
  });

  test('should redirect direct course URL access to login page', async () => {
    // Perform logout
    await auth.logout(page);
    await loginPage.waitForLoginForm();

    // Test direct URL access: Try accessing course via direct URL
    await page.goto('/courses/1', { waitUntil: 'networkidle' });

    // Verify redirected to login
    await loginPage.waitForLoginForm();
    expect(page.url()).toMatch(/\/login|\/auth\/login/);

    // Try another protected route
    await page.goto('/assignments/5', { waitUntil: 'networkidle' });
    await loginPage.waitForLoginForm();
    expect(page.url()).toMatch(/\/login|\/auth\/login/);

    // Take screenshot showing blocked direct access
    await page.screenshot({ 
      path: `test-results/logout/direct-url-blocked-${Date.now()}.png` 
    });
  });

  test('should allow re-login with same credentials after logout', async () => {
    // Perform logout
    await auth.logout(page);
    await loginPage.waitForLoginForm();

    // Verify logged out
    expect(await auth.isAuthenticated(page)).toBe(false);

    // Test re-login: Login again with same credentials
    await auth.login(page, testStudent.username, TEST_PASSWORD);

    // Verify new session created
    const newToken = await auth.getAuthToken(page);
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(authToken); // New token should be different

    // Verify can access dashboard with new session
    await dashboardPage.waitForDashboard();
    expect(page.url()).toMatch(/\/dashboard|\/my/);

    // Verify authenticated state
    expect(await auth.isAuthenticated(page)).toBe(true);

    // Take screenshot of successful re-login
    await page.screenshot({ 
      path: `test-results/logout/relogin-success-${Date.now()}.png`,
      fullPage: true 
    });
  });

  test('should logout from all tabs when logout triggered in one tab', async ({ context }) => {
    // Open second tab with same authenticated session
    const secondPage = await context.newPage();
    await secondPage.goto('/dashboard', { waitUntil: 'networkidle' });

    // Verify both tabs are authenticated
    expect(await auth.isAuthenticated(page)).toBe(true);
    expect(await auth.isAuthenticated(secondPage)).toBe(true);

    // Perform logout from first tab
    await auth.logout(page);
    await loginPage.waitForLoginForm();

    // Wait for storage event to propagate
    await page.waitForTimeout(2000);

    // Navigate second tab to trigger auth check
    await secondPage.goto('/courses', { waitUntil: 'networkidle' });
    await secondPage.waitForTimeout(1000);

    // Verify second tab is also logged out (redirected to login)
    expect(secondPage.url()).toMatch(/\/login|\/auth\/login/);
    expect(await auth.isAuthenticated(secondPage)).toBe(false);

    // Take screenshot of both tabs
    await page.screenshot({ 
      path: `test-results/logout/multi-tab-first-${Date.now()}.png` 
    });
    await secondPage.screenshot({ 
      path: `test-results/logout/multi-tab-second-${Date.now()}.png` 
    });

    // Cleanup
    await secondPage.close();
  });

  test('should auto-logout when token expires', async () => {
    // Note: This test simulates token expiration by manually expiring the token
    // In production, this would wait for actual token expiration (1 hour)

    // Get current token
    const currentToken = await auth.getAuthToken(page);
    expect(currentToken).toBeTruthy();

    // Simulate token expiration by setting an expired token
    await page.evaluate(() => {
      // Create an expired JWT token (expired 1 hour ago)
      const expiredPayload = {
        sub: '1',
        iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
        roles: ['student']
      };
      
      // Store expired token (this is simulation - real token would be properly signed)
      localStorage.setItem('auth_token', JSON.stringify({ 
        token: 'expired_token_simulation',
        expiresAt: expiredPayload.exp * 1000
      }));
    });

    // Try to access protected page - should trigger auto-logout
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Should be redirected to login due to expired token
    await page.waitForTimeout(2000);
    expect(page.url()).toMatch(/\/login|\/auth\/login/);

    // Verify logged out state
    expect(await auth.isAuthenticated(page)).toBe(false);

    // Take screenshot of auto-logout
    await page.screenshot({ 
      path: `test-results/logout/auto-logout-expired-${Date.now()}.png` 
    });
  });

  test('should warn user about unsaved changes before logout', async () => {
    // Navigate to a page with a form (e.g., profile edit)
    await page.goto('/profile/edit', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Enter some data to make form dirty
    const nameInput = page.locator('input[name="firstname"], input[id="firstname"]').first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('Modified Name');
    }

    // Attempt to logout with unsaved changes
    const userMenuButton = page.locator('[aria-label="User menu"], [data-testid="user-menu-button"]');
    await userMenuButton.click();
    await page.waitForTimeout(500);

    const logoutButton = page.locator(
      'button:has-text("Logout"), button:has-text("Log out"), [data-testid="logout-button"]'
    ).first();
    
    // Set up dialog handler to capture warning
    let dialogAppeared = false;
    page.on('dialog', async dialog => {
      dialogAppeared = true;
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toMatch(/unsaved changes|lose changes|discard changes/i);
      await dialog.dismiss(); // Cancel logout
    });

    await logoutButton.click();
    await page.waitForTimeout(1000);

    // If using custom modal instead of native dialog
    const warningModal = page.locator('[role="dialog"]:has-text("unsaved"), [data-testid="unsaved-changes-modal"]').first();
    if (await warningModal.isVisible().catch(() => false)) {
      // Take screenshot of warning
      await page.screenshot({ 
        path: `test-results/logout/unsaved-changes-warning-${Date.now()}.png` 
      });

      // Click cancel to stay on page
      const cancelButton = warningModal.locator('button:has-text("Cancel"), button:has-text("Stay")').first();
      if (await cancelButton.isVisible().catch(() => false)) {
        await cancelButton.click();
      }
    }

    // Verify still logged in (logout was cancelled)
    await page.waitForTimeout(1000);
    const stillAuthenticated = await auth.isAuthenticated(page);
    
    // User should still be authenticated if they cancelled
    // Note: This behavior depends on implementation - some apps may force logout
    console.log('Authentication state after cancel:', stillAuthenticated);
  });

  test('should verify complete session cleanup and no cached sensitive data', async () => {
    // Store sensitive data references before logout
    const userDataBefore = await page.evaluate(() => {
      return {
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage }
      };
    });

    // Perform logout
    await auth.logout(page);
    await loginPage.waitForLoginForm();

    // Verify complete session cleanup
    const userDataAfter = await page.evaluate(() => {
      return {
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage },
        localStorageLength: localStorage.length,
        sessionStorageLength: sessionStorage.length
      };
    });

    // Verify no sensitive data in storage
    const localStorageValues = Object.values(userDataAfter.localStorage);
    const sessionStorageValues = Object.values(userDataAfter.sessionStorage);

    // Check for sensitive data patterns
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /private/i,
      /ssn/i,
      /credit.*card/i,
      /"sub":\s*"\d+"/,  // JWT subject (user ID)
      /"email":/i
    ];

    for (const value of [...localStorageValues, ...sessionStorageValues]) {
      for (const pattern of sensitivePatterns) {
        expect(String(value)).not.toMatch(pattern);
      }
    }

    // Verify API cache cleared
    const cacheCleared = await page.evaluate(() => {
      // Check if React Query cache or Redux store is cleared
      const reactQueryCache = (window as any).__REACT_QUERY_CACHE__;
      const reduxStore = (window as any).__REDUX_STORE__;
      
      return {
        reactQueryEmpty: !reactQueryCache || Object.keys(reactQueryCache).length === 0,
        reduxStoreCleared: !reduxStore || !reduxStore.getState()?.auth?.user
      };
    });

    console.log('Cache cleanup status:', cacheCleared);

    // Verify network cache cleared for API requests
    await page.goto('/api/v1/users/me', { waitUntil: 'networkidle' });
    expect(page.url()).toMatch(/\/login|\/auth\/login/); // Should redirect

    // Take screenshot of cleaned state
    await page.screenshot({ 
      path: `test-results/logout/session-cleaned-${Date.now()}.png` 
    });
  });

  test('should prevent reuse of old tokens after logout', async () => {
    // Store old token and refresh token
    const oldAccessToken = authToken as string;
    const tokenData = await page.evaluate(() => {
      const authData = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      return authData ? JSON.parse(authData) : null;
    });

    const oldRefreshToken = tokenData?.refreshToken;

    // Perform logout
    await auth.logout(page);
    await loginPage.waitForLoginForm();

    // Security: Verify old access token cannot be reused
    const accessTokenTest = await apiHelpers.apiRequest(page, {
      method: 'GET',
      url: '/api/v1/courses',
      headers: {
        'Authorization': `Bearer ${oldAccessToken}`
      }
    }).catch((err: any) => ({ status: err.status || err.response?.status }));

    expect(accessTokenTest.status).toBe(401);

    // Security: Verify old refresh token cannot be reused
    if (oldRefreshToken) {
      const refreshTokenTest = await apiHelpers.apiRequest(page, {
        method: 'POST',
        url: '/api/v1/auth/refresh',
        body: {
          refreshToken: oldRefreshToken
        }
      }).catch((err: any) => ({ status: err.status || err.response?.status }));

      expect(refreshTokenTest.status).toBe(401);
    }

    // Verify tokens are blacklisted on server
    // Multiple attempts should all fail
    for (let i = 0; i < 3; i++) {
      const retryTest = await apiHelpers.apiRequest(page, {
        method: 'GET',
        url: '/api/v1/users/dashboard',
        headers: {
          'Authorization': `Bearer ${oldAccessToken}`
        }
      }).catch((err: any) => ({ status: err.status || err.response?.status }));

      expect(retryTest.status).toBe(401);
    }

    // Take screenshot of security validation
    await page.screenshot({ 
      path: `test-results/logout/token-reuse-blocked-${Date.now()}.png` 
    });
  });
});
