/**
 * Page Object Model for Admin User Management Interface
 * 
 * Encapsulates selectors and interactions for the admin user management page
 * including user CRUD operations, bulk actions, search, and filtering.
 * 
 * Reference: public/admin/user.php, public/admin/user/user_bulk.php
 */

import { Locator, Page } from '@playwright/test';

/**
 * User data structure for creating and editing users
 */
export interface UserData {
  username: string;
  email: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  city?: string;
  country?: string;
  timezone?: string;
  description?: string;
  auth?: string;
  suspended?: boolean;
}

/**
 * User filter options for searching and filtering users
 */
export interface UserFilters {
  role?: string;
  cohort?: string;
  status?: 'active' | 'suspended' | 'all';
  auth?: string;
  confirmed?: boolean;
  lastaccess?: 'never' | 'week' | 'month' | 'year';
}

/**
 * Bulk action types available in user management
 */
export type BulkAction = 'suspend' | 'delete' | 'cohort' | 'force-password-change' | 'confirm';

/**
 * AdminUserPage - Page Object Model for admin user management
 * 
 * Provides high-level methods for interacting with the user management interface
 * including creating, editing, deleting users, and performing bulk operations.
 */
export class AdminUserPage {
  private readonly page: Page;

  // Main page locators
  private readonly userTable: Locator;
  private readonly createUserButton: Locator;
  private readonly searchInput: Locator;
  private readonly filterControls: Locator;

  // User row actions
  private readonly userRow: Locator;
  private readonly editButton: Locator;
  private readonly deleteButton: Locator;
  private readonly suspendButton: Locator;
  private readonly resetPasswordButton: Locator;

  // Bulk action controls
  private readonly bulkActionSelect: Locator;
  private readonly bulkActionButton: Locator;
  private readonly userCheckbox: Locator;

  // User form locators
  private readonly userForm: Locator;
  private readonly usernameInput: Locator;
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly profileFields: Locator;
  private readonly saveButton: Locator;

  // Confirmation dialog
  private readonly confirmDeleteButton: Locator;

  /**
   * Creates a new AdminUserPage instance
   * @param page - Playwright Page object
   */
  constructor(page: Page) {
    this.page = page;

    // Initialize main page locators
    this.userTable = page.locator('[data-region="report-user-list-wrapper"]');
    this.createUserButton = page.locator('[data-action="add-user"]');
    this.searchInput = page.locator('input[type="search"]');
    this.filterControls = page.locator('.user-filters');

    // User row action locators
    this.userRow = page.locator('table tbody tr');
    this.editButton = page.locator('[data-action="edit"]');
    this.deleteButton = page.locator('[data-action="delete"]');
    this.suspendButton = page.locator('[data-action="suspend"]');
    this.resetPasswordButton = page.locator('[data-action="reset-password"]');

    // Bulk action locators
    this.bulkActionSelect = page.locator('#id_action');
    this.bulkActionButton = page.locator('#user-bulk-action-form button[type="submit"]');
    this.userCheckbox = page.locator('input[type="checkbox"][name^="user"]');

    // User form locators
    this.userForm = page.locator('form#mform1');
    this.usernameInput = page.locator('#id_username');
    this.emailInput = page.locator('#id_email');
    this.passwordInput = page.locator('#id_newpassword');
    this.profileFields = page.locator('.fitem');
    this.saveButton = page.locator('#id_submitbutton');

    // Confirmation dialog
    this.confirmDeleteButton = page.locator('button:has-text("Delete")');
  }

  /**
   * Wait for the user management page to fully load
   */
  async waitForUserManagement(): Promise<void> {
    await this.userTable.waitFor({ state: 'visible' });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get list of users displayed in the table
   * @returns Array of user objects with id, username, email, and name
   */
  async getUsers(): Promise<Array<{ id: string; username: string; email: string; name: string }>> {
    await this.userRow.first().waitFor({ state: 'visible', timeout: 5000 });
    
    const rows = await this.userRow.all();
    const users = [];

    for (const row of rows) {
      const userId = await row.getAttribute('data-user-id') || '';
      const username = await row.locator('td[data-field="username"]').textContent() || '';
      const email = await row.locator('td[data-field="email"]').textContent() || '';
      const name = await row.locator('td[data-field="fullname"]').textContent() || '';

      users.push({
        id: userId.trim(),
        username: username.trim(),
        email: email.trim(),
        name: name.trim(),
      });
    }

    return users;
  }

  /**
   * Search for users by query string
   * @param query - Search query (username, email, or name)
   */
  async searchUsers(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(500); // Allow for search results to update
  }

  /**
   * Apply filters to the user list
   * @param filters - Filter options for role, status, etc.
   */
  async filterUsers(filters: UserFilters): Promise<void> {
    if (filters.role) {
      await this.page.selectOption('#id_role', filters.role);
    }

    if (filters.cohort) {
      await this.page.selectOption('#id_cohort', filters.cohort);
    }

    if (filters.status) {
      await this.page.selectOption('#id_status', filters.status);
    }

    if (filters.auth) {
      await this.page.selectOption('#id_auth', filters.auth);
    }

    if (filters.confirmed !== undefined) {
      await this.page.selectOption('#id_confirmed', filters.confirmed ? '1' : '0');
    }

    if (filters.lastaccess) {
      await this.page.selectOption('#id_lastaccess', filters.lastaccess);
    }

    // Apply filters
    await this.page.click('button:has-text("Apply filters")');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click the create user button to open user creation form
   */
  async clickCreateUser(): Promise<void> {
    await this.createUserButton.click();
    await this.userForm.waitFor({ state: 'visible' });
  }

  /**
   * Create a new user with provided data
   * @param userData - User information for creating new user
   */
  async createUser(userData: UserData): Promise<void> {
    await this.clickCreateUser();

    // Fill required fields
    await this.usernameInput.fill(userData.username);
    await this.emailInput.fill(userData.email);

    if (userData.password) {
      await this.passwordInput.fill(userData.password);
      await this.page.locator('#id_newpassword2').fill(userData.password); // Confirm password
    }

    // Fill optional profile fields
    if (userData.firstname) {
      await this.page.locator('#id_firstname').fill(userData.firstname);
    }

    if (userData.lastname) {
      await this.page.locator('#id_lastname').fill(userData.lastname);
    }

    if (userData.city) {
      await this.page.locator('#id_city').fill(userData.city);
    }

    if (userData.country) {
      await this.page.selectOption('#id_country', userData.country);
    }

    if (userData.timezone) {
      await this.page.selectOption('#id_timezone', userData.timezone);
    }

    if (userData.description) {
      await this.page.locator('#id_description_editor').fill(userData.description);
    }

    if (userData.auth) {
      await this.page.selectOption('#id_auth', userData.auth);
    }

    // Submit form
    await this.saveButton.click();
    await this.waitForActionComplete();
  }

  /**
   * Click edit button for specific user
   * @param userId - ID of the user to edit
   */
  async clickEditUser(userId: string): Promise<void> {
    const userRowLocator = this.page.locator(`tr[data-user-id="${userId}"]`);
    await userRowLocator.locator('[data-action="edit"]').click();
    await this.userForm.waitFor({ state: 'visible' });
  }

  /**
   * Edit existing user with updated data
   * @param userId - ID of the user to edit
   * @param userData - Updated user information
   */
  async editUser(userId: string, userData: Partial<UserData>): Promise<void> {
    await this.clickEditUser(userId);

    // Update fields that are provided
    if (userData.username) {
      await this.usernameInput.clear();
      await this.usernameInput.fill(userData.username);
    }

    if (userData.email) {
      await this.emailInput.clear();
      await this.emailInput.fill(userData.email);
    }

    if (userData.firstname) {
      await this.page.locator('#id_firstname').clear();
      await this.page.locator('#id_firstname').fill(userData.firstname);
    }

    if (userData.lastname) {
      await this.page.locator('#id_lastname').clear();
      await this.page.locator('#id_lastname').fill(userData.lastname);
    }

    if (userData.city) {
      await this.page.locator('#id_city').clear();
      await this.page.locator('#id_city').fill(userData.city);
    }

    if (userData.country) {
      await this.page.selectOption('#id_country', userData.country);
    }

    if (userData.suspended !== undefined) {
      const suspendCheckbox = this.page.locator('#id_suspended');
      if (userData.suspended) {
        await suspendCheckbox.check();
      } else {
        await suspendCheckbox.uncheck();
      }
    }

    // Submit form
    await this.saveButton.click();
    await this.waitForActionComplete();
  }

  /**
   * Delete a user account
   * @param userId - ID of the user to delete
   */
  async deleteUser(userId: string): Promise<void> {
    const userRowLocator = this.page.locator(`tr[data-user-id="${userId}"]`);
    await userRowLocator.locator('[data-action="delete"]').click();
    
    // Wait for confirmation dialog
    await this.page.waitForSelector('button:has-text("Delete")', { state: 'visible' });
  }

  /**
   * Confirm deletion in confirmation dialog
   */
  async confirmDeletion(): Promise<void> {
    await this.confirmDeleteButton.click();
    await this.waitForActionComplete();
  }

  /**
   * Suspend a user account
   * @param userId - ID of the user to suspend
   */
  async suspendUser(userId: string): Promise<void> {
    const userRowLocator = this.page.locator(`tr[data-user-id="${userId}"]`);
    await userRowLocator.locator('[data-action="suspend"]').click();
    await this.waitForActionComplete();
  }

  /**
   * Trigger password reset for a user
   * @param userId - ID of the user for password reset
   */
  async resetPassword(userId: string): Promise<void> {
    const userRowLocator = this.page.locator(`tr[data-user-id="${userId}"]`);
    await userRowLocator.locator('[data-action="reset-password"]').click();
    await this.waitForActionComplete();
  }

  /**
   * Select multiple users by their IDs
   * @param userIds - Array of user IDs to select
   */
  async selectUsers(userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      const checkbox = this.page.locator(`input[type="checkbox"][value="${userId}"]`);
      await checkbox.check();
    }
  }

  /**
   * Select all users in the current list
   */
  async selectAllUsers(): Promise<void> {
    const selectAllCheckbox = this.page.locator('input[type="checkbox"][name="selectall"]');
    await selectAllCheckbox.check();
  }

  /**
   * Apply a bulk action to selected users
   * @param action - Bulk action to perform
   */
  async applyBulkAction(action: BulkAction): Promise<void> {
    await this.bulkActionSelect.selectOption(action);
    await this.bulkActionButton.click();
    await this.waitForActionComplete();
  }

  /**
   * Suspend multiple selected users
   */
  async bulkSuspend(): Promise<void> {
    await this.applyBulkAction('suspend');
  }

  /**
   * Delete multiple selected users
   */
  async bulkDelete(): Promise<void> {
    await this.applyBulkAction('delete');
    // Confirm deletion if prompt appears
    const confirmButton = this.page.locator('button:has-text("Delete")');
    const isVisible = await confirmButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (isVisible) {
      await this.confirmDeletion();
    }
  }

  /**
   * Assign cohort to multiple selected users
   * @param cohortId - ID of the cohort to assign
   */
  async bulkAssignCohort(cohortId: string): Promise<void> {
    await this.applyBulkAction('cohort');
    
    // Wait for cohort selection page
    await this.page.waitForSelector('#id_cohort', { state: 'visible' });
    await this.page.selectOption('#id_cohort', cohortId);
    await this.page.click('button[type="submit"]');
    await this.waitForActionComplete();
  }

  /**
   * Verify that a user was successfully created
   * @param username - Username to verify in the list
   * @returns True if user is found in the list
   */
  async verifyUserCreated(username: string): Promise<boolean> {
    await this.searchUsers(username);
    const users = await this.getUsers();
    return users.some(user => user.username === username);
  }

  /**
   * Verify that a user was successfully deleted
   * @param userId - User ID to verify removal
   * @returns True if user is not found in the list
   */
  async verifyUserDeleted(userId: string): Promise<boolean> {
    await this.page.reload();
    await this.waitForUserManagement();
    
    const userRow = this.page.locator(`tr[data-user-id="${userId}"]`);
    const count = await userRow.count();
    return count === 0;
  }

  /**
   * Get validation error messages from the form
   * @returns Array of error messages
   */
  async getValidationErrors(): Promise<string[]> {
    const errorElements = await this.page.locator('.error, .alert-danger, [role="alert"]').all();
    const errors: string[] = [];

    for (const element of errorElements) {
      const text = await element.textContent();
      if (text) {
        errors.push(text.trim());
      }
    }

    return errors;
  }

  /**
   * Wait for an action to complete (page reload or success message)
   */
  async waitForActionComplete(): Promise<void> {
    // Wait for either navigation or success notification
    await Promise.race([
      this.page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
      this.page.waitForSelector('.alert-success, [role="status"]', { state: 'visible', timeout: 5000 }).catch(() => {}),
    ]);
    
    // Additional wait to ensure page is stable
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to a specific page of the user list
   * @param pageNumber - Page number to navigate to
   */
  async paginateUsers(pageNumber: number): Promise<void> {
    const pageLink = this.page.locator(`a[data-page="${pageNumber}"]`);
    await pageLink.click();
    await this.page.waitForLoadState('networkidle');
    await this.userTable.waitFor({ state: 'visible' });
  }
}
