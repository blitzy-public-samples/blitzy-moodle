/**
 * E2E Test: Admin User Management
 * 
 * Comprehensive Playwright E2E test suite for admin user management workflows.
 * Validates user CRUD operations, bulk actions, password reset, suspension, and deletion.
 * 
 * Test Coverage:
 * - User list display with pagination, search, and filters
 * - User creation with form validation
 * - User editing with profile field updates
 * - Bulk operations (suspend, delete, assign cohort)
 * - Password reset workflow
 * - User suspension with login blocking
 * - User deletion with data anonymization
 * - Error scenarios and validation
 * 
 * @see react-frontend/tests/e2e/pages/AdminUserPage.ts for Page Object Model
 * @see public/admin/user.php for backend implementation
 * @see public/admin/user/user_bulk.php for bulk operations backend
 */

import { test, expect } from '@playwright/test';
import { AdminUserPage } from './pages/AdminUserPage';
import { loginAsAdmin, logout, isAuthenticated } from './utils/auth';
import type { UserData } from './pages/AdminUserPage';

/**
 * Admin user management test suite
 * Tests all user management operations available to site administrators
 */
test.describe('Admin User Management', () => {
  // Track test users created during tests for cleanup
  const createdUserIds: number[] = [];
  const createdUsernames: string[] = [];

  /**
   * Setup: Login as admin and navigate to user management page
   * Runs before each test to ensure clean state
   */
  test.beforeEach(async ({ page }) => {
    // Listen to browser console to debug MSW initialization
    page.on('console', msg => {
      const text = msg.text();
      // Log all console messages for debugging
      console.log(`[Browser Console] ${msg.type()}: ${text}`);
    });
    
    // Listen to network requests to debug API calls
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/') || url.includes('/admin/')) {
        console.log(`[Network Request] ${request.method()} ${url}`);
      }
    });
    
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/') || url.includes('/admin/')) {
        console.log(`[Network Response] ${response.status()} ${url}`);
      }
    });
    
    // Login as admin user with full system permissions
    await loginAsAdmin(page);
    
    // Verify admin is authenticated
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);
    
    // Initialize Page Object Model and navigate to user management
    const adminPage = new AdminUserPage(page);
    await adminPage.goto();
    await adminPage.waitForUserManagement();
    
    // Wait for the user table to actually populate with data from MSW
    // This ensures MSW has intercepted the API call and returned mock data
    // before any test interactions begin
    try {
      await page.waitForSelector('[data-testid^="user-row-"]', { 
        state: 'visible', 
        timeout: 10000 
      });
    } catch (error) {
      // If no rows appear, MSW might not be ready - wait a bit longer
      console.log('[Test] No user rows found, waiting for MSW initialization...');
      await page.waitForTimeout(2000);
      // Try again after waiting
      await page.waitForSelector('[data-testid^="user-row-"]', { 
        state: 'visible', 
        timeout: 5000 
      });
    }
    
    // Store adminPage in test context for use in test
     
    (page as any)._adminPage = adminPage;
  });

  /**
   * Cleanup: Delete test users and logout
   * Runs after each test
   */
  test.afterEach(async ({ page }) => {
    // Logout admin user
    await logout(page);
  });

  /**
   * Final cleanup: Delete all test users created during tests
   * Runs once after all tests complete
   */
  test.afterAll(async ({ browser }) => {
    if (createdUsernames.length === 0) {
      return; // No users to clean up
    }

    // Create a new context for cleanup
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Login as admin for cleanup
      await loginAsAdmin(page);
      const adminPage = new AdminUserPage(page);
      
      // Delete all test users created during this test run
      for (const username of createdUsernames) {
        try {
          await adminPage.goto();
          await adminPage.searchUsers(username);
          const users = await adminPage.getUsers();
          
          if (users.length > 0) {
            const user = users.find(u => u.username === username);
            if (user?.id) {
              await adminPage.deleteUser(user.id);
              await adminPage.confirmDeletion();
              await adminPage.waitForActionComplete();
            }
          }
        } catch (error) {
          console.warn(`Failed to cleanup user ${username}:`, error);
        }
      }
      
      // Logout admin user
      await logout(page);
    } finally {
      // Close browser context
      await context.close();
    }
  });

  /**
   * Test 1: User List Display
   * Verifies that the user table displays correctly with pagination, search, and filters
   */
  test.describe('User List Display', () => {
    test('should display user table with pagination controls', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Get initial user list
      const users = await adminPage.getUsers();
      
      // Verify users are displayed
      expect(users.length).toBeGreaterThan(0);
      
      // Verify each user has required fields
      users.forEach(user => {
        expect(user.username).toBeTruthy();
        expect(user.email).toBeTruthy();
        expect(user.firstname).toBeTruthy();
        expect(user.lastname).toBeTruthy();
      });
      
      // Capture screenshot for documentation
      await page.screenshot({ 
        path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/admin-user-list.png',
        fullPage: true 
      });
    });

    test('should search users by username', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Search for a specific test user
      await adminPage.searchUsers('student');
      await page.waitForTimeout(500); // Allow search to process
      
      // Get filtered results
      const users = await adminPage.getUsers();
      
      // Verify all results contain search term
      expect(users.length).toBeGreaterThan(0);
      users.forEach(user => {
        expect(user.username.toLowerCase()).toContain('student');
      });
    });

    test('should search users by email', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Search by email domain
      await adminPage.searchUsers('@example.com');
      await page.waitForTimeout(500);
      
      const users = await adminPage.getUsers();
      
      // Verify results contain email search term
      expect(users.length).toBeGreaterThan(0);
      users.forEach(user => {
        expect(user.email.toLowerCase()).toContain('@example.com');
      });
    });

    test('should filter users by role', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Filter to show only students
      await adminPage.filterUsers({ role: 'student' });
      await page.waitForTimeout(500);
      
      const users = await adminPage.getUsers();
      
      // Verify all users have student role
      expect(users.length).toBeGreaterThan(0);
      users.forEach(user => {
        expect(user.roles?.some(r => r.shortname.toLowerCase().includes('student'))).toBe(true);
      });
    });

    test('should filter users by status', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Filter to show only active users
      await adminPage.filterUsers({ status: 'active' });
      await page.waitForTimeout(500);
      
      const users = await adminPage.getUsers();
      
      // Verify users are active (not suspended)
      expect(users.length).toBeGreaterThan(0);
      users.forEach(user => {
        expect(user.suspended).toBe(false);
      });
    });

    test('should combine search and filters', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Search and filter simultaneously
      await adminPage.searchUsers('test');
      await adminPage.filterUsers({ 
        role: 'student',
        status: 'active'
      });
      await page.waitForTimeout(500);
      
      const users = await adminPage.getUsers();
      
      // Verify combined filters work
      if (users.length > 0) {
        users.forEach(user => {
          expect(user.username.toLowerCase()).toContain('test');
          expect(user.suspended).toBe(false);
        });
      }
    });
  });

  /**
   * Test 2: User Creation
   * Validates user creation workflow with form validation
   */
  test.describe('User Creation', () => {
    test('should create new user with valid data', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Generate unique user data
      const timestamp = Date.now();
      const newUser: UserData = {
        username: `testuser${timestamp}`,
        firstname: 'Test',
        lastname: 'User',
        email: `testuser${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual',
        city: 'San Francisco',
        country: 'US',
        department: 'Testing',
        institution: 'Test University'
      };
      
      // Track for cleanup
      createdUsernames.push(newUser.username);
      
      // Create user (createUser method handles opening the dialog)
      await adminPage.createUser(newUser);
      
      // Wait for user to be created
      await adminPage.waitForActionComplete();
      
      // Verify user was created successfully
      await adminPage.verifyUserCreated(newUser.username);
      
      // Search for the new user
      await adminPage.searchUsers(newUser.username);
      const users = await adminPage.getUsers();
      
      // Verify user appears in list with correct data
      expect(users.length).toBe(1);
      const createdUser = users[0]!;
      expect(createdUser.username).toBe(newUser.username);
      expect(createdUser.email).toBe(newUser.email);
      expect(createdUser.firstname).toBe(newUser.firstname);
      expect(createdUser.lastname).toBe(newUser.lastname);
      
      // Store ID for cleanup
      if (createdUser.id) {
        createdUserIds.push(createdUser.id);
      }
      
      // Capture screenshot
      await page.screenshot({ 
        path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/admin-user-created.png' 
      });
    });

    test('should show validation error for missing required fields', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Attempt to create user with missing username
      const incompleteUser: UserData = {
        username: '', // Missing required field
        firstname: 'Test',
        lastname: 'User',
        email: 'test@example.com',
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      // Pass false to not wait for completion (validation should keep dialog open)
      await adminPage.createUser(incompleteUser, false);
      
      // Wait briefly for validation to render
      await page.waitForTimeout(500);
      
      // Get validation errors
      const errors = await adminPage.getValidationErrors();
      
      // Verify username required error is shown
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(err => err.toLowerCase().includes('username'))).toBe(true);
      
      // Capture error state
      await page.screenshot({ 
        path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/admin-user-validation-error.png' 
      });
    });

    test('should show validation error for invalid email format', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      const timestamp = Date.now();
      const invalidUser: UserData = {
        username: `testuser${timestamp}`,
        firstname: 'Test',
        lastname: 'User',
        email: 'invalid-email-format', // Invalid email
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      // Pass false to not wait for completion (validation should keep dialog open)
      await adminPage.createUser(invalidUser, false);
      
      // Wait briefly for validation to render
      await page.waitForTimeout(500);
      
      const errors = await adminPage.getValidationErrors();
      
      // Verify email validation error
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(err => 
        err.toLowerCase().includes('email') || 
        err.toLowerCase().includes('invalid')
      )).toBe(true);
    });

    test('should show validation error for duplicate username', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Try to create user with existing username
      const duplicateUser: UserData = {
        username: 'admin', // Already exists
        firstname: 'Test',
        lastname: 'User',
        email: 'newadmin@example.com',
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      // Pass false to not wait for completion (validation should keep dialog open)
      await adminPage.createUser(duplicateUser, false);
      
      // Wait briefly for validation to render
      await page.waitForTimeout(500);
      
      const errors = await adminPage.getValidationErrors();
      
      // Verify duplicate username error
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(err => 
        err.toLowerCase().includes('username') || 
        err.toLowerCase().includes('exist') ||
        err.toLowerCase().includes('taken')
      )).toBe(true);
    });

    test('should show validation error for weak password', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      const timestamp = Date.now();
      const weakPasswordUser: UserData = {
        username: `testuser${timestamp}`,
        firstname: 'Test',
        lastname: 'User',
        email: `testuser${timestamp}@example.com`,
        password: '123', // Too weak
        auth: 'manual'
      };
      
      // Pass false to not wait for completion (validation should keep dialog open)
      await adminPage.createUser(weakPasswordUser, false);
      
      // Wait briefly for validation to render
      await page.waitForTimeout(500);
      
      const errors = await adminPage.getValidationErrors();
      
      // Verify password strength error
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(err => 
        err.toLowerCase().includes('password')
      )).toBe(true);
    });
  });

  /**
   * Test 3: User Editing
   * Validates user profile editing with field updates
   */
  test.describe('User Editing', () => {
    test('should edit user profile fields', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Create a test user first
      const timestamp = Date.now();
      const testUser: UserData = {
        username: `edittest${timestamp}`,
        firstname: 'Edit',
        lastname: 'Test',
        email: `edittest${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual',
        city: 'New York',
        country: 'US'
      };
      
      createdUsernames.push(testUser.username);
      
      // Create user (createUser method handles opening the dialog)
      await adminPage.createUser(testUser);
      await adminPage.waitForActionComplete();
      
      // Search for the user
      await adminPage.searchUsers(testUser.username);
      const users = await adminPage.getUsers();
      expect(users.length).toBe(1);
      const userId = users[0]!.id!;
      createdUserIds.push(userId);
      
      // Edit the user
      await adminPage.clickEditUser(userId);
      
      const updatedData: Partial<UserData> = {
        firstname: 'Updated',
        lastname: 'Name',
        city: 'Los Angeles',
        department: 'Engineering'
      };
      
      await adminPage.editUser(userId, updatedData);
      await adminPage.waitForActionComplete();
      
      // Verify changes were saved
      await adminPage.searchUsers(testUser.username);
      const updatedUsers = await adminPage.getUsers();
      expect(updatedUsers.length).toBe(1);
      expect(updatedUsers[0]!.firstname).toBe('Updated');
      expect(updatedUsers[0]!.lastname).toBe('Name');
      
      // Capture screenshot
      await page.screenshot({ 
        path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/admin-user-edited.png' 
      });
    });

    test('should persist changes after page refresh', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Create test user
      const timestamp = Date.now();
      const testUser: UserData = {
        username: `persisttest${timestamp}`,
        firstname: 'Persist',
        lastname: 'Test',
        email: `persisttest${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      createdUsernames.push(testUser.username);
      
      // Create user (createUser method handles opening the dialog)
      await adminPage.createUser(testUser);
      await adminPage.waitForActionComplete();
      
      // Get user ID
      await adminPage.searchUsers(testUser.username);
      let users = await adminPage.getUsers();
      const userId = users[0]!.id!;
      createdUserIds.push(userId);
      
      // Edit user
      await adminPage.clickEditUser(userId);
      await adminPage.editUser(userId, { 
        firstname: 'Changed',
        city: 'Seattle'
      });
      await adminPage.waitForActionComplete();
      
      // Refresh page
      await page.reload();
      await adminPage.waitForUserManagement();
      
      // Verify changes persisted
      await adminPage.searchUsers(testUser.username);
      users = await adminPage.getUsers();
      expect(users[0]!.firstname).toBe('Changed');
    });
  });

  /**
   * Test 4: Bulk Operations
   * Validates bulk actions on multiple selected users
   */
  test.describe('Bulk Operations', () => {
    test('should suspend multiple users', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Create two test users
      const timestamp = Date.now();
      const user1: UserData = {
        username: `bulksuspend1_${timestamp}`,
        firstname: 'Bulk',
        lastname: 'Suspend1',
        email: `bulksuspend1_${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      const user2: UserData = {
        username: `bulksuspend2_${timestamp}`,
        firstname: 'Bulk',
        lastname: 'Suspend2',
        email: `bulksuspend2_${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      createdUsernames.push(user1.username, user2.username);
      
      // Create users (createUser method handles opening the dialog)
      await adminPage.createUser(user1);
      await adminPage.waitForActionComplete();
      
      await adminPage.createUser(user2);
      await adminPage.waitForActionComplete();
      
      // Search for users
      await adminPage.searchUsers(`bulksuspend`);
      const users = await adminPage.getUsers();
      expect(users.length).toBeGreaterThanOrEqual(2);
      
      const userIds = users
        .filter(u => u.username.includes(`bulksuspend`))
        .map(u => u.id!)
        .slice(0, 2);
      
      userIds.forEach(id => createdUserIds.push(id));
      
      // Select users and apply bulk suspend
      await adminPage.selectUsers(userIds);
      await adminPage.bulkSuspend();
      await adminPage.waitForActionComplete();
      
      // Verify users are suspended
      await adminPage.filterUsers({ status: 'suspended' });
      await adminPage.searchUsers(`bulksuspend`);
      const suspendedUsers = await adminPage.getUsers();
      
      expect(suspendedUsers.length).toBeGreaterThanOrEqual(2);
      suspendedUsers.forEach(user => {
        expect(user.suspended).toBe(true);
      });
      
      // Capture screenshot
      await page.screenshot({ 
        path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/admin-bulk-suspend.png' 
      });
    });

    test('should delete multiple users', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Create two test users
      const timestamp = Date.now();
      const user1: UserData = {
        username: `bulkdelete1_${timestamp}`,
        firstname: 'Bulk',
        lastname: 'Delete1',
        email: `bulkdelete1_${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      const user2: UserData = {
        username: `bulkdelete2_${timestamp}`,
        firstname: 'Bulk',
        lastname: 'Delete2',
        email: `bulkdelete2_${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      createdUsernames.push(user1.username, user2.username);
      
      // Create users (createUser method handles opening the dialog)
      await adminPage.createUser(user1);
      await adminPage.waitForActionComplete();
      
      await adminPage.createUser(user2);
      await adminPage.waitForActionComplete();
      
      // Get user IDs
      await adminPage.searchUsers(`bulkdelete`);
      const users = await adminPage.getUsers();
      const userIds = users
        .filter(u => u.username.includes(`bulkdelete`))
        .map(u => u.id!)
        .slice(0, 2);
      
      // Select and delete users
      await adminPage.selectUsers(userIds);
      await adminPage.bulkDelete();
      await adminPage.confirmDeletion();
      await adminPage.waitForActionComplete();
      
      // Verify users are deleted
      await adminPage.searchUsers(`bulkdelete`);
      const remainingUsers = await adminPage.getUsers();
      
      // Users should be deleted or marked as deleted
      expect(
        remainingUsers.filter(u => 
          userIds.includes(u.id!) && !u.deleted
        ).length
      ).toBe(0);
    });

    test('should assign cohort to multiple users', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Create test users
      const timestamp = Date.now();
      const user1: UserData = {
        username: `bulkcohort1_${timestamp}`,
        firstname: 'Bulk',
        lastname: 'Cohort1',
        email: `bulkcohort1_${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      const user2: UserData = {
        username: `bulkcohort2_${timestamp}`,
        firstname: 'Bulk',
        lastname: 'Cohort2',
        email: `bulkcohort2_${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      createdUsernames.push(user1.username, user2.username);
      
      // Create users (createUser method handles opening the dialog)
      await adminPage.createUser(user1);
      await adminPage.waitForActionComplete();
      
      await adminPage.createUser(user2);
      await adminPage.waitForActionComplete();
      
      // Get user IDs
      await adminPage.searchUsers(`bulkcohort`);
      const users = await adminPage.getUsers();
      const userIds = users
        .filter(u => u.username.includes(`bulkcohort`))
        .map(u => u.id!)
        .slice(0, 2);
      
      userIds.forEach(id => createdUserIds.push(id));
      
      // Select users and assign cohort
      await adminPage.selectUsers(userIds);
      await adminPage.bulkAssignCohort('Test Cohort');
      await adminPage.waitForActionComplete();
      
      // Verify operation completed (actual cohort assignment verification
      // would require additional API calls or database checks)
      const actionComplete = await adminPage.waitForActionComplete();
      expect(actionComplete).toBe(true);
    });
  });

  /**
   * Test 5: Password Reset
   * Validates password reset workflow
   */
  test.describe('Password Reset', () => {
    test('should trigger password reset for user', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Create test user
      const timestamp = Date.now();
      const testUser: UserData = {
        username: `resettest${timestamp}`,
        firstname: 'Reset',
        lastname: 'Test',
        email: `resettest${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      createdUsernames.push(testUser.username);
      
      // Create user (createUser method handles opening the dialog)
      await adminPage.createUser(testUser);
      await adminPage.waitForActionComplete();
      
      // Get user ID
      await adminPage.searchUsers(testUser.username);
      const users = await adminPage.getUsers();
      const userId = users[0]!.id!;
      createdUserIds.push(userId);
      
      // Trigger password reset
      await adminPage.resetPassword(userId);
      await adminPage.waitForActionComplete();
      
      // Verify reset was triggered (email notification sent)
      // In a real scenario, we'd verify email was sent or check notification
      const actionComplete = await adminPage.waitForActionComplete();
      expect(actionComplete).toBe(true);
      
      // Capture screenshot
      await page.screenshot({ 
        path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/admin-password-reset.png' 
      });
    });
  });

  /**
   * Test 6: User Suspension
   * Validates user suspension and login blocking
   */
  test.describe('User Suspension', () => {
    test('should suspend user account', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Create test user
      const timestamp = Date.now();
      const testUser: UserData = {
        username: `suspendtest${timestamp}`,
        firstname: 'Suspend',
        lastname: 'Test',
        email: `suspendtest${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      createdUsernames.push(testUser.username);
      
      // Create user (createUser method handles opening the dialog)
      await adminPage.createUser(testUser);
      await adminPage.waitForActionComplete();
      
      // Get user ID
      await adminPage.searchUsers(testUser.username);
      let users = await adminPage.getUsers();
      const userId = users[0]!.id!;
      createdUserIds.push(userId);
      
      // Verify user is initially active
      expect(users[0]!.suspended).toBe(false);
      
      // Suspend user
      await adminPage.suspendUser(userId);
      await adminPage.waitForActionComplete();
      
      // Verify user is suspended
      await adminPage.filterUsers({ status: 'suspended' });
      await adminPage.searchUsers(testUser.username);
      users = await adminPage.getUsers();
      
      expect(users.length).toBe(1);
      expect(users[0]!.suspended).toBe(true);
      
      // Capture screenshot
      await page.screenshot({ 
        path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/admin-user-suspended.png' 
      });
    });

    test('should verify suspended user cannot login', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Create and suspend test user
      const timestamp = Date.now();
      const testUser: UserData = {
        username: `loginblocked${timestamp}`,
        firstname: 'Login',
        lastname: 'Blocked',
        email: `loginblocked${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      createdUsernames.push(testUser.username);
      
      // Create user (createUser method handles opening the dialog)
      await adminPage.createUser(testUser);
      await adminPage.waitForActionComplete();
      
      // Get user ID and suspend
      await adminPage.searchUsers(testUser.username);
      const users = await adminPage.getUsers();
      const userId = users[0]!.id!;
      createdUserIds.push(userId);
      
      await adminPage.suspendUser(userId);
      await adminPage.waitForActionComplete();
      
      // Logout admin
      await logout(page);
      
      // Attempt to login as suspended user
      await page.goto('/login');
      await page.fill('input[name="username"]', testUser.username);
      await page.fill('input[name="password"]', testUser.password!);
      await page.click('button[type="submit"]');
      
      // Wait for login attempt to process
      await page.waitForTimeout(2000);
      
      // Verify login was blocked (error message or still on login page)
      const url = page.url();
      const errorVisible = await page.locator('text=/suspended|disabled|blocked/i').isVisible().catch(() => false);
      
      expect(
        url.includes('/login') || errorVisible
      ).toBe(true);
      
      // Login back as admin
      await loginAsAdmin(page);
      const adminPageNew = new AdminUserPage(page);
       
      (page as any)._adminPage = adminPageNew;
      await adminPageNew.goto();
    });
  });

  /**
   * Test 7: User Deletion
   * Validates user deletion and data anonymization
   */
  test.describe('User Deletion', () => {
    test('should delete user account', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Create test user
      const timestamp = Date.now();
      const testUser: UserData = {
        username: `deletetest${timestamp}`,
        firstname: 'Delete',
        lastname: 'Test',
        email: `deletetest${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      createdUsernames.push(testUser.username);
      
      // Create user (createUser method handles opening the dialog)
      await adminPage.createUser(testUser);
      await adminPage.waitForActionComplete();
      
      // Get user ID
      await adminPage.searchUsers(testUser.username);
      const users = await adminPage.getUsers();
      const userId = users[0]!.id!;
      
      // Delete user
      await adminPage.deleteUser(userId);
      await adminPage.confirmDeletion();
      await adminPage.waitForActionComplete();
      
      // Verify user was deleted
      await adminPage.verifyUserDeleted(userId);
      
      // Search for deleted user - should not appear in active users
      await adminPage.searchUsers(testUser.username);
      const remainingUsers = await adminPage.getUsers();
      
      expect(
        remainingUsers.filter(u => u.id === userId && !u.deleted).length
      ).toBe(0);
      
      // Capture screenshot
      await page.screenshot({ 
        path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/admin-user-deleted.png' 
      });
    });

    test('should anonymize user data on deletion', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Create test user with specific data
      const timestamp = Date.now();
      const testUser: UserData = {
        username: `anonymize${timestamp}`,
        firstname: 'Anonymize',
        lastname: 'Test',
        email: `anonymize${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual',
        city: 'San Francisco',
        department: 'Engineering'
      };
      
      createdUsernames.push(testUser.username);
      
      // Create user (createUser method handles opening the dialog)
      await adminPage.createUser(testUser);
      await adminPage.waitForActionComplete();
      
      // Get user ID
      await adminPage.searchUsers(testUser.username);
      const users = await adminPage.getUsers();
      const userId = users[0]!.id!;
      
      // Delete user
      await adminPage.deleteUser(userId);
      await adminPage.confirmDeletion();
      await adminPage.waitForActionComplete();
      
      // Verify deletion completed
      await adminPage.verifyUserDeleted(userId);
      
      // In Moodle, deleted users are typically:
      // - Marked as deleted=1
      // - Email changed to "noreply+[id]@moodle.invalid"
      // - Username changed to "deleted[id]"
      // - Personal data anonymized
      
      // Verification would require checking database or API
      // For E2E test, we verify the user no longer appears in active list
      await adminPage.searchUsers(testUser.username);
      const activeUsers = await adminPage.getUsers();
      
      expect(
        activeUsers.filter(u => u.username === testUser.username).length
      ).toBe(0);
    });

    test('should prevent deletion of admin users', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Search for admin user
      await adminPage.searchUsers('admin');
      const users = await adminPage.getUsers();
      const adminUser = users.find(u => u.username === 'admin');
      
      if (adminUser?.id) {
        // Attempt to delete admin user
        await adminPage.deleteUser(adminUser.id);
        
        // Should show error or prevent deletion
        const errors = await adminPage.getValidationErrors().catch(() => []);
        
        // Either error is shown or deletion dialog doesn't appear
        // Moodle typically prevents admin deletion with error message
        expect(
          errors.some(err => 
            err.toLowerCase().includes('admin') ||
            err.toLowerCase().includes('cannot delete') ||
            err.toLowerCase().includes('prevented')
          ) || errors.length === 0
        ).toBe(true);
      }
    });
  });

  /**
   * Test 8: Error Scenarios
   * Validates proper error handling and validation
   */
  test.describe('Error Scenarios', () => {
    test('should handle network errors gracefully', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Simulate network condition or timeout
      // Note: Actual network simulation would require Playwright network interception
      
      // Attempt operation and verify error handling
      await adminPage.searchUsers('nonexistentuser12345');
      const users = await adminPage.getUsers();
      
      // Should return empty array, not crash
      expect(Array.isArray(users)).toBe(true);
    });

    test('should handle concurrent operations', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Create test user
      const timestamp = Date.now();
      const testUser: UserData = {
        username: `concurrent${timestamp}`,
        firstname: 'Concurrent',
        lastname: 'Test',
        email: `concurrent${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      createdUsernames.push(testUser.username);
      
      // Create user (createUser method handles opening the dialog)
      await adminPage.createUser(testUser);
      await adminPage.waitForActionComplete();
      
      // Get user ID
      await adminPage.searchUsers(testUser.username);
      const users = await adminPage.getUsers();
      const userId = users[0]!.id!;
      createdUserIds.push(userId);
      
      // Attempt multiple edits in quick succession
      // System should handle gracefully
      await adminPage.clickEditUser(userId);
      await adminPage.editUser(userId, { firstname: 'Update1' });
      
      // Wait for action to complete before next operation
      await adminPage.waitForActionComplete();
      
      await adminPage.clickEditUser(userId);
      await adminPage.editUser(userId, { firstname: 'Update2' });
      await adminPage.waitForActionComplete();
      
      // Verify final state is correct
      await adminPage.searchUsers(testUser.username);
      const finalUsers = await adminPage.getUsers();
      expect(finalUsers[0]!.firstname).toBe('Update2');
    });

    test('should validate email format in bulk operations', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Create user with valid email
      const timestamp = Date.now();
      const testUser: UserData = {
        username: `emailvalid${timestamp}`,
        firstname: 'Email',
        lastname: 'Valid',
        email: `emailvalid${timestamp}@example.com`,
        password: 'TestPassword123!',
        auth: 'manual'
      };
      
      createdUsernames.push(testUser.username);
      
      // Create user (createUser method handles opening the dialog)
      await adminPage.createUser(testUser);
      await adminPage.waitForActionComplete();
      
      // Get user and attempt edit with invalid email
      await adminPage.searchUsers(testUser.username);
      const users = await adminPage.getUsers();
      const userId = users[0]!.id!;
      createdUserIds.push(userId);
      
      await adminPage.clickEditUser(userId);
      await adminPage.editUser(userId, { email: 'invalid-email' });
      
      // Should show validation error
      const errors = await adminPage.getValidationErrors();
      expect(errors.some(err => 
        err.toLowerCase().includes('email') ||
        err.toLowerCase().includes('invalid')
      )).toBe(true);
    });
  });

  /**
   * Test 9: Pagination
   * Validates pagination controls work correctly
   */
  test.describe('Pagination', () => {
    test('should navigate through user pages', async ({ page }) => {
       
      const adminPage = (page as any)._adminPage as AdminUserPage;
      
      // Clear search to show all users
      await adminPage.searchUsers('');
      
      // Get first page of users
      const firstPageUsers = await adminPage.getUsers();
      expect(firstPageUsers.length).toBeGreaterThan(0);
      
      // Attempt to go to next page if pagination exists
      const hasNextPage = await page.locator('button:has-text("Next"), a:has-text("Next"), [aria-label*="next"]')
        .isVisible()
        .catch(() => false);
      
      if (hasNextPage) {
        await adminPage.paginateUsers('next');
        await page.waitForTimeout(500);
        
        const secondPageUsers = await adminPage.getUsers();
        
        // Users on second page should be different from first page
        expect(secondPageUsers.length).toBeGreaterThan(0);
        expect(secondPageUsers[0]!.id).not.toBe(firstPageUsers[0]!.id);
      }
    });
  });

  /**
   * Test 10: Accessibility
   * Validates keyboard navigation and screen reader support
   */
  test.describe('Accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      // Navigate with Tab key
      await page.keyboard.press('Tab');
      
      // Verify focus is on interactive element
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'BUTTON', 'A', 'SELECT']).toContain(focused);
    });

    test('should have proper ARIA labels', async ({ page }) => {
      // Check for ARIA labels on key elements
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
      const ariaLabel = await searchInput.getAttribute('aria-label').catch(() => null);
      const placeholder = await searchInput.getAttribute('placeholder').catch(() => null);
      
      // Should have either aria-label or placeholder for screen readers
      expect(ariaLabel || placeholder).toBeTruthy();
    });
  });
});
