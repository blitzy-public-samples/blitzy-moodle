import { type Page, type Locator } from '@playwright/test';
import { jwtDecode } from 'jwt-decode';

/**
 * JWT Token Payload Interface
 * 
 * Defines the expected structure of decoded JWT tokens issued by Moodle API.
 */
interface JWTPayload {
  sub?: string | number;
  roles?: string[];
  iss?: string;
  exp?: number;
  iat?: number;
}

/**
 * Page Object Model for the Moodle Login Page
 * 
 * Encapsulates all selectors and interactions for the authentication interface.
 * Uses data-testid attributes for stable element selection across React re-renders.
 * Provides methods for standard login, SSO authentication, validation checking,
 * and JWT token verification.
 * 
 * @example
 * ```typescript
 * const loginPage = new LoginPage(page);
 * await loginPage.waitForLoginForm();
 * await loginPage.login('student@example.com', 'password123');
 * expect(await loginPage.isLoggedIn()).toBe(true);
 * ```
 * 
 * @example SSO Login
 * ```typescript
 * const loginPage = new LoginPage(page);
 * await loginPage.waitForLoginForm();
 * await loginPage.loginWithSSO('google');
 * expect(await loginPage.isLoggedIn()).toBe(true);
 * ```
 */
export class LoginPage {
  private readonly page: Page;
  
  // Form input locators
  private readonly usernameInput: Locator;
  private readonly passwordInput: Locator;
  private readonly rememberMeCheckbox: Locator;
  private readonly submitButton: Locator;
  
  // Feedback and navigation locators
  private readonly errorMessage: Locator;
  private readonly forgotPasswordLink: Locator;
  private readonly ssoButtons: Locator;

  /**
   * Creates a new LoginPage instance
   * 
   * Initializes all locators using data-testid attributes for stability.
   * These selectors are resilient to implementation changes in the React components.
   * 
   * @param page - Playwright Page object for browser interaction
   */
  constructor(page: Page) {
    this.page = page;
    
    // Initialize all locators using data-testid attributes for stability
    this.usernameInput = page.locator('[data-testid="login-username-input"]');
    this.passwordInput = page.locator('[data-testid="login-password-input"]');
    this.rememberMeCheckbox = page.locator('[data-testid="login-remember-me-checkbox"]');
    this.submitButton = page.locator('[data-testid="login-submit-button"]');
    this.errorMessage = page.locator('[data-testid="login-error-message"]');
    this.forgotPasswordLink = page.locator('[data-testid="login-forgot-password-link"]');
    this.ssoButtons = page.locator('[data-testid^="login-sso-button-"]');
  }

  /**
   * Waits for the login form to be fully loaded and ready for interaction
   * 
   * Ensures that critical form elements (username, password, submit button)
   * are visible before attempting any interactions. Prevents race conditions
   * in test execution.
   * 
   * @throws {Error} If login form does not load within default Playwright timeout period
   * 
   * @example
   * ```typescript
   * await page.goto('/login');
   * await loginPage.waitForLoginForm();
   * // Form is now ready for interaction
   * ```
   */
  async waitForLoginForm(): Promise<void> {
    await this.usernameInput.waitFor({ state: 'visible' });
    await this.passwordInput.waitFor({ state: 'visible' });
    await this.submitButton.waitFor({ state: 'visible' });
  }

  /**
   * Performs login operation with username and password
   * 
   * Fills the login form with provided credentials and submits it.
   * Optionally sets the "Remember Me" checkbox before submission.
   * Waits for navigation to complete after form submission.
   * 
   * @param username - User's username or email address
   * @param password - User's password
   * @param rememberMe - Optional flag to keep user logged in across sessions (default: undefined, leaves checkbox untouched)
   * 
   * @example Standard Login
   * ```typescript
   * await loginPage.login('teacher@example.com', 'SecurePass123');
   * ```
   * 
   * @example Login with Remember Me
   * ```typescript
   * await loginPage.login('student@example.com', 'password', true);
   * ```
   */
  async login(username: string, password: string, rememberMe?: boolean): Promise<void> {
    // Fill username field
    await this.usernameInput.fill(username);
    
    // Fill password field
    await this.passwordInput.fill(password);
    
    // Handle remember me checkbox if specified
    if (rememberMe !== undefined) {
      const isChecked = await this.rememberMeCheckbox.isChecked();
      if (rememberMe && !isChecked) {
        await this.rememberMeCheckbox.check();
      } else if (!rememberMe && isChecked) {
        await this.rememberMeCheckbox.uncheck();
      }
    }
    
    // Submit the form
    await this.submitButton.click();
    
    // Wait for navigation to complete (either to dashboard or back to login with error)
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Performs SSO login by clicking the specified provider button
   * 
   * Initiates Single Sign-On authentication flow with external identity providers
   * (Google, Microsoft, LDAP, etc.). Waits for the SSO redirect cycle to complete.
   * 
   * @param provider - SSO provider name (e.g., 'google', 'microsoft', 'ldap', 'shibboleth')
   * 
   * @throws {Error} If SSO button for specified provider is not found
   * 
   * @example Google SSO
   * ```typescript
   * await loginPage.loginWithSSO('google');
   * // User is redirected to Google login, then back to Moodle
   * ```
   * 
   * @example Microsoft SSO
   * ```typescript
   * await loginPage.loginWithSSO('microsoft');
   * ```
   */
  async loginWithSSO(provider: string): Promise<void> {
    const ssoButton = this.ssoButtons.locator(`[data-testid="login-sso-button-${provider}"]`);
    await ssoButton.waitFor({ state: 'visible' });
    await ssoButton.click();
    
    // Wait for SSO redirect or popup to complete
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Retrieves the current error message displayed on the login form
   * 
   * Returns validation or authentication error messages shown to the user
   * after a failed login attempt. Returns null if no error is currently displayed.
   * 
   * @returns Error message text, or null if no error is displayed
   * 
   * @example
   * ```typescript
   * await loginPage.login('user@example.com', 'wrongpassword');
   * const error = await loginPage.getErrorMessage();
   * expect(error).toBe('Invalid username or password');
   * ```
   * 
   * @example No Error Case
   * ```typescript
   * await loginPage.login('user@example.com', 'correctpassword');
   * const error = await loginPage.getErrorMessage();
   * expect(error).toBeNull();
   * ```
   */
  async getErrorMessage(): Promise<string | null> {
    try {
      // Check if error message is visible
      const isVisible = await this.errorMessage.isVisible();
      if (!isVisible) {
        return null;
      }
      
      // Get error message text
      const errorText = await this.errorMessage.textContent();
      return errorText ? errorText.trim() : null;
    } catch (error) {
      // Error message element not found or not in DOM
      return null;
    }
  }

  /**
   * Checks if user is successfully logged in by verifying redirect to dashboard
   * 
   * Validates successful authentication through multiple indicators:
   * 1. URL contains dashboard or user area paths
   * 2. Login form is no longer visible
   * 3. JWT token exists in browser storage
   * 
   * @returns True if user is logged in (on dashboard), false otherwise
   * 
   * @example
   * ```typescript
   * await loginPage.login('user@example.com', 'pass123');
   * const loggedIn = await loginPage.isLoggedIn();
   * expect(loggedIn).toBe(true);
   * ```
   * 
   * @example Failed Login
   * ```typescript
   * await loginPage.login('user@example.com', 'wrongpass');
   * const loggedIn = await loginPage.isLoggedIn();
   * expect(loggedIn).toBe(false);
   * ```
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      // Wait briefly for navigation to complete
      await this.page.waitForLoadState('networkidle', { timeout: 5000 });
      
      // Check if current URL indicates dashboard or authenticated area
      const currentUrl = this.page.url();
      
      // Multiple indicators of successful login:
      // 1. URL contains /dashboard or /my (user area)
      // 2. Login form is no longer visible
      // 3. JWT token exists in storage
      
      const isDashboardUrl = currentUrl.includes('/dashboard') || currentUrl.includes('/my');
      const isLoginFormHidden = !(await this.usernameInput.isVisible().catch(() => false));
      const hasToken = (await this.getToken()) !== null;
      
      // Consider logged in if any strong indicator is present
      return isDashboardUrl || (isLoginFormHidden && hasToken);
    } catch (error) {
      // Navigation timeout or other error - assume not logged in
      return false;
    }
  }

  /**
   * Navigates to the password reset page by clicking the forgot password link
   * 
   * Initiates the password recovery workflow. Waits for the password reset
   * page to fully load after navigation.
   * 
   * @throws {Error} If forgot password link is not found or not clickable
   * 
   * @example
   * ```typescript
   * await loginPage.clickForgotPassword();
   * // Now on password reset page
   * expect(page.url()).toContain('/forgot-password');
   * ```
   */
  async clickForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.waitFor({ state: 'visible' });
    await this.forgotPasswordLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Retrieves the JWT authentication token from browser storage
   * 
   * Checks multiple storage locations for the JWT token:
   * 1. localStorage (most common for JWT storage)
   * 2. Cookies (httpOnly cookies or regular cookies)
   * 
   * Searches for common token key names:
   * - moodle_jwt_token
   * - jwt_token
   * - auth_token
   * 
   * @returns JWT token string, or null if not found in any storage location
   * 
   * @example
   * ```typescript
   * await loginPage.login('user@example.com', 'pass123');
   * const token = await loginPage.getToken();
   * expect(token).toBeTruthy();
   * expect(token).toMatch(/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/);
   * ```
   */
  async getToken(): Promise<string | null> {
    try {
      // Try localStorage first (common storage for JWT in SPA applications)
      const localStorageToken = await this.page.evaluate(() => {
        return localStorage.getItem('moodle_jwt_token') || 
               localStorage.getItem('jwt_token') ||
               localStorage.getItem('auth_token');
      });
      
      if (localStorageToken) {
        return localStorageToken;
      }
      
      // Try cookies as alternative storage (may be httpOnly for security)
      const cookies = await this.page.context().cookies();
      const jwtCookie = cookies.find(cookie => 
        cookie.name === 'moodle_jwt_token' || 
        cookie.name === 'jwt_token' ||
        cookie.name === 'auth_token'
      );
      
      if (jwtCookie) {
        return jwtCookie.value;
      }
      
      // Token not found in either location
      return null;
    } catch (error) {
      console.error('Error retrieving JWT token:', error);
      return null;
    }
  }

  /**
   * Verifies the structure and validity of the JWT token
   * 
   * Decodes the JWT token and validates that it contains all required fields:
   * - sub (subject/user ID): User identifier
   * - roles (array): User roles for authorization
   * - iss (issuer): Token issuer (Moodle instance)
   * - exp (expiration): Token expiration timestamp
   * - iat (issued at): Token creation timestamp
   * 
   * Also verifies that the token has not expired by comparing exp with current time.
   * 
   * Note: This method performs CLIENT-SIDE validation only. Signature verification
   * is the server's responsibility and requires the secret key.
   * 
   * @returns True if token structure is valid and not expired, false otherwise
   * 
   * @example
   * ```typescript
   * await loginPage.login('user@example.com', 'pass123');
   * const isValid = await loginPage.verifyTokenStructure();
   * expect(isValid).toBe(true);
   * ```
   * 
   * @example Invalid Token
   * ```typescript
   * // Manually set invalid token
   * await page.evaluate(() => localStorage.setItem('jwt_token', 'invalid'));
   * const isValid = await loginPage.verifyTokenStructure();
   * expect(isValid).toBe(false);
   * ```
   */
  async verifyTokenStructure(): Promise<boolean> {
    try {
      // Get the JWT token from storage
      const token = await this.getToken();
      
      if (!token) {
        console.error('No JWT token found for verification');
        return false;
      }
      
      // Decode the token (no signature verification - that's server-side responsibility)
      const decoded = jwtDecode<JWTPayload>(token);
      
      // Validate required fields exist with correct types
      const hasSubject = decoded.sub !== undefined && decoded.sub !== null;
      const hasRoles = Array.isArray(decoded.roles);
      const hasIssuer = typeof decoded.iss === 'string' && decoded.iss.length > 0;
      const hasExpiration = typeof decoded.exp === 'number' && decoded.exp > 0;
      const hasIssuedAt = typeof decoded.iat === 'number' && decoded.iat > 0;
      
      // Validate token is not expired
      const currentTime = Math.floor(Date.now() / 1000);
      const isNotExpired = decoded.exp ? decoded.exp > currentTime : false;
      
      // Validate issued at is not in the future (clock skew tolerance: 60 seconds)
      const issuedAtValid = decoded.iat ? decoded.iat <= currentTime + 60 : false;
      
      // All validations must pass
      const isValid = hasSubject && 
                      hasRoles && 
                      hasIssuer && 
                      hasExpiration && 
                      hasIssuedAt && 
                      isNotExpired && 
                      issuedAtValid;
      
      if (!isValid) {
        console.error('JWT token validation failed:', {
          hasSubject,
          hasRoles,
          hasIssuer,
          hasExpiration,
          hasIssuedAt,
          isNotExpired,
          issuedAtValid,
          tokenSubject: decoded.sub,
          tokenRoles: decoded.roles,
          tokenIssuer: decoded.iss,
          tokenExpiration: decoded.exp,
          tokenIssuedAt: decoded.iat,
          currentTime
        });
      }
      
      return isValid;
    } catch (error) {
      console.error('Error verifying JWT token structure:', error);
      return false;
    }
  }
}
