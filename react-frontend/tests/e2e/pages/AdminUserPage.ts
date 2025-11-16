/**
 * Page Object Model for Admin User Management Interface
 * 
 * Encapsulates selectors and interactions for the admin user management page
 * including user CRUD operations, bulk actions, search, and filtering.
 * 
 * Reference: public/admin/user.php, public/admin/user/user_bulk.php
 */

import type { Locator, Page } from '@playwright/test';

/**
 * User data structure for creating and editing users
 */
export interface UserData {
  id?: number;
  username: string;
  email: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  city?: string;
  country?: string;
  timezone?: string;
  description?: string;
  department?: string;
  institution?: string;
  auth?: string;
  suspended?: boolean;
  deleted?: boolean;
  roles?: Array<{
    roleid: number;
    shortname: string;
    name: string;
  }>;
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

  // User row actions (scoped per row in methods)
  private readonly userRow: Locator;

  // Bulk action controls
  private readonly bulkActionSelect: Locator;
  private readonly bulkActionButton: Locator;

  // User form locators
  private readonly userForm: Locator;
  private readonly usernameInput: Locator;
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly firstnameInput: Locator;
  private readonly lastnameInput: Locator;
  private readonly authMethodSelect: Locator;
  private readonly saveButton: Locator;
  private readonly cancelButton: Locator;

  // Edit form locators
  private readonly editDialog: Locator;
  private readonly editUsernameInput: Locator;
  private readonly editFirstnameInput: Locator;
  private readonly editLastnameInput: Locator;
  private readonly editEmailInput: Locator;
  private readonly editSaveButton: Locator;

  // Confirmation dialog
  private readonly confirmationDialog: Locator;
  private readonly confirmDeleteButton: Locator;
  
  // Additional UI elements
  private readonly tablePagination: Locator;
  private readonly selectAllCheckbox: Locator;
  private readonly bulkSuspendButton: Locator;
  private readonly bulkDeleteButton: Locator;
  
  // Filter locators
  private readonly roleFilter: Locator;
  private readonly statusFilter: Locator;
  private readonly authFilter: Locator;

  /**
   * Creates a new AdminUserPage instance
   * @param page - Playwright Page object
   */
  constructor(page: Page) {
    this.page = page;

    // Initialize main page locators
    this.userTable = page.locator('[data-testid="user-table"]');
    this.createUserButton = page.locator('[data-testid="create-user-button"]');
    // MUI TextField with data-testid in inputProps - target directly
    this.searchInput = page.locator('[data-testid="search-input"]');

    // User row action locators (scoped per row in methods)
    this.userRow = page.locator('table tbody tr');

    // Bulk action locators
    this.bulkActionSelect = page.locator('[data-testid="bulk-actions-menu"]');
    this.bulkActionButton = page.locator('[data-testid="bulk-actions-button"]');
    this.bulkSuspendButton = page.locator('[data-testid="bulk-suspend-button"]');
    this.bulkDeleteButton = page.locator('[data-testid="bulk-delete-button"]');

    // User form locators (for create dialog)
    this.userForm = page.locator('[data-testid="create-user-dialog"]');
    this.usernameInput = page.locator('[data-testid="username-input"]');
    this.emailInput = page.locator('[data-testid="email-input"]');
    this.passwordInput = page.locator('[data-testid="password-input"]');
    this.firstnameInput = page.locator('[data-testid="firstname-input"]');
    this.lastnameInput = page.locator('[data-testid="lastname-input"]');
    // MUI Select - data-testid is now on the clickable element via SelectDisplayProps
    this.authMethodSelect = page.locator('[data-testid="auth-method-select"]');
    this.saveButton = page.locator('[data-testid="create-user-submit"]');
    this.cancelButton = page.locator('[data-testid="cancel-button"]');

    // Edit form locators
    this.editDialog = page.locator('[data-testid="edit-user-dialog"]');
    this.editUsernameInput = page.locator('[data-testid="edit-username-input"]');
    this.editFirstnameInput = page.locator('[data-testid="edit-firstname-input"]');
    this.editLastnameInput = page.locator('[data-testid="edit-lastname-input"]');
    this.editEmailInput = page.locator('[data-testid="edit-email-input"]');
    this.editSaveButton = page.locator('[data-testid="edit-user-submit"]');

    // Confirmation dialog
    this.confirmationDialog = page.locator('[data-testid="delete-user-dialog"]');
    this.confirmDeleteButton = page.locator('[data-testid="delete-user-confirm"]');
    
    // Additional UI elements
    this.tablePagination = page.locator('[data-testid="table-pagination"]');
    this.selectAllCheckbox = page.locator('[data-testid="select-all-checkbox"]');
    
    // Filter locators (MUI Select components - data-testid now on clickable element via SelectDisplayProps)
    this.roleFilter = page.locator('[data-testid="filter-role"]');
    this.statusFilter = page.locator('[data-testid="filter-status"]');
    this.authFilter = page.locator('[data-testid="filter-auth"]');
  }

  /**
   * Navigate to the user management page
   * @param url - URL to navigate to (defaults to admin user management)
   */
  async goto(url: string = '/admin/users'): Promise<void> {
    await this.page.goto(url);
    await this.waitForUserManagement();
  }

  /**
   * Wait for the user management page to fully load
   */
  async waitForUserManagement(): Promise<void> {
    await this.userTable.waitFor({ state: 'visible' });
    // Remove networkidle wait - it's unreliable with MSW and SPAs
    // The table being visible is sufficient indicator that the page is ready
  }

  /**
   * Get list of users displayed in the table
   * @returns Array of user objects with full User interface properties
   */
  async getUsers(): Promise<Array<{
    id?: number;
    username: string;
    email: string;
    firstname?: string;
    lastname?: string;
    fullname?: string;
    suspended?: boolean;
    deleted?: boolean;
    roles?: Array<{ roleid: number; shortname: string; name: string }>;
    department?: string;
    auth?: string;
    confirmed?: boolean;
  }>> {
    // Check if there are any rows first
    const rowLocator = this.userTable.locator('tbody tr[data-testid^="user-row-"]');
    const rowCount = await rowLocator.count();
    
    // If no rows exist, return empty array (e.g., empty search results or cleanup phase)
    if (rowCount === 0) {
      return [];
    }
    
    // Wait for the first row to be visible
    await rowLocator.first().waitFor({ state: 'visible', timeout: 5000 });
    
    const rows = await rowLocator.all();
    const users = [];

    for (const row of rows) {
      // Extract user ID from data-testid attribute (format: user-row-{id})
      const testId = await row.getAttribute('data-testid') || '';
      const userId = testId.startsWith('user-row-') 
        ? parseInt(testId.replace('user-row-', ''), 10) 
        : undefined;
      
      // Extract roles from data-user-roles attribute (JSON stringified array)
      const rolesAttr = await row.getAttribute('data-user-roles');
      let roles: Array<{ roleid: number; shortname: string; name: string }> | undefined;
      if (rolesAttr) {
        try {
          roles = JSON.parse(rolesAttr) as Array<{ roleid: number; shortname: string; name: string }>;
        } catch (e) {
          roles = undefined;
        }
      }
      
      // Extract suspended status from data-user-suspended attribute
      const suspendedAttr = await row.getAttribute('data-user-suspended');
      const suspended = suspendedAttr === 'true' || suspendedAttr === '1';
      
      // Extract data from table cells
      // Table structure: checkbox(0), username(1), fullname(2), email(3), auth(4), status(5), actions(6)
      const cells = await row.locator('td').all();
      
      // Use innerText instead of textContent for better text extraction
      const username = cells.length > 1 ? (await cells[1].innerText()).trim() : '';
      const fullname = cells.length > 2 ? (await cells[2].innerText()).trim() : '';
      const email = cells.length > 3 ? (await cells[3].innerText()).trim() : '';
      const auth = cells.length > 4 ? (await cells[4].innerText()).trim() : '';
      
      // Extract status from the Chip in the Status cell (column 5)
      // The Chip contains text like "Active", "Suspended", or "Deleted"
      let _statusText = '';
      if (cells.length > 5) {
        const statusCell = cells[5];
        const chipLocator = statusCell.locator('.MuiChip-label');
        if (await chipLocator.count() > 0) {
          _statusText = (await chipLocator.innerText()).trim();
        }
      }
      
      // Parse fullname into firstname and lastname
      const nameParts = fullname.split(' ').filter(part => part.length > 0);
      const firstname = nameParts[0] || '';
      const lastname = nameParts.slice(1).join(' ') || '';

      users.push({
        id: userId,
        username,
        email,
        firstname: firstname || undefined,
        lastname: lastname || undefined,
        fullname: fullname || undefined,
        auth: auth || undefined,
        suspended,
        roles,
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
    // Remove networkidle wait - unreliable with MSW and SPAs
    await this.page.waitForTimeout(500); // Allow for search results to update
  }

  /**
   * Apply filters to the user list
   * @param filters - Filter options for role, status, etc.
   */
  async filterUsers(filters: UserFilters): Promise<void> {
    // Apply role filter
    if (filters.role) {
      // Click the role filter to open the dropdown
      await this.roleFilter.click();
      // Wait for the dropdown menu to appear and click the desired option
      await this.page.locator(`li[data-value="${filters.role}"]`).click();
      // Wait a bit for the filter to apply
      await this.page.waitForTimeout(300);
    }
    
    // Apply status filter
    if (filters.status) {
      // Click the status filter to open the dropdown
      await this.statusFilter.click();
      // Wait for the dropdown menu to appear and click the desired option
      await this.page.locator(`li[data-value="${filters.status}"]`).click();
      // Wait a bit for the filter to apply
      await this.page.waitForTimeout(300);
    }
    
    // Apply auth filter
    if (filters.auth) {
      // Click the auth filter to open the dropdown
      await this.authFilter.click();
      // Wait for the dropdown menu to appear and click the desired option
      await this.page.locator(`li[data-value="${filters.auth}"]`).click();
      // Wait a bit for the filter to apply
      await this.page.waitForTimeout(300);
    }
    
    // Wait for the table to update with filtered results
    await this.page.waitForTimeout(500);
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
   * NOTE: Only fields available in React component: username, email, password, firstname, lastname, auth
   */
  async createUser(userData: UserData, waitForComplete: boolean = true): Promise<void> {
    await this.clickCreateUser();

    // Fill required fields
    await this.usernameInput.fill(userData.username);
    await this.emailInput.fill(userData.email);

    if (userData.password) {
      await this.passwordInput.fill(userData.password);
    }

    // Fill optional profile fields (only those available in the React component)
    if (userData.firstname) {
      await this.firstnameInput.fill(userData.firstname);
    }

    if (userData.lastname) {
      await this.lastnameInput.fill(userData.lastname);
    }

    if (userData.auth) {
      await this.authMethodSelect.click();
      await this.page.locator(`[data-value="${userData.auth}"]`).click();
    }

    // Submit form
    await this.saveButton.click();
    
    // Only wait for completion if requested (validation tests should pass false)
    if (waitForComplete) {
      await this.waitForActionComplete();
    }
  }

  /**
   * Click edit button for specific user
   * @param userId - ID of the user to edit
   */
  async clickEditUser(userId: number): Promise<void> {
    const editButton = this.page.locator(`[data-testid="edit-user-${userId}"]`);
    await editButton.click();
    await this.userForm.waitFor({ state: 'visible' });
  }

  /**
   * Edit existing user with updated data
   * @param userId - ID of the user to edit
   * @param userData - Updated user information
   * NOTE: Only fields available in React edit dialog: username, firstname, lastname, email
   * NOTE: Suspension must be done through suspendUser() method, not in edit dialog
   */
  async editUser(userId: number, userData: Partial<UserData>): Promise<void> {
    await this.clickEditUser(userId);

    // Update fields that are provided (only those available in the React component)
    if (userData.username) {
      await this.editUsernameInput.clear();
      await this.editUsernameInput.fill(userData.username);
    }

    if (userData.email) {
      await this.editEmailInput.clear();
      await this.editEmailInput.fill(userData.email);
    }

    if (userData.firstname) {
      await this.editFirstnameInput.clear();
      await this.editFirstnameInput.fill(userData.firstname);
    }

    if (userData.lastname) {
      await this.editLastnameInput.clear();
      await this.editLastnameInput.fill(userData.lastname);
    }

    // Submit form
    await this.saveButton.click();
    await this.waitForActionComplete();
  }

  /**
   * Delete a user account
   * @param userId - ID of the user to delete
   */
  async deleteUser(userId: number): Promise<void> {
    const deleteButton = this.page.locator(`[data-testid="delete-user-${userId}"]`);
    await deleteButton.click();
    
    // Wait for confirmation dialog
    await this.confirmationDialog.waitFor({ state: 'visible' });
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
  async suspendUser(userId: number): Promise<void> {
    const suspendButton = this.page.locator(`[data-testid="suspend-user-${userId}"]`);
    await suspendButton.click();
    await this.waitForActionComplete();
  }

  /**
   * Trigger password reset for a user
   * @param userId - ID of the user for password reset
   */
  async resetPassword(userId: number): Promise<void> {
    const resetPasswordButton = this.page.locator(`[data-testid="reset-password-user-${userId}"]`);
    await resetPasswordButton.click();
    await this.waitForActionComplete();
  }

  /**
   * Select multiple users by their IDs
   * @param userIds - Array of user IDs to select
   */
  async selectUsers(userIds: number[]): Promise<void> {
    for (const userId of userIds) {
      const checkbox = this.page.locator(`[data-testid="select-user-${userId}"]`);
      await checkbox.check();
    }
  }

  /**
   * Select all users in the current list
   */
  async selectAllUsers(): Promise<void> {
    await this.selectAllCheckbox.check();
  }

  /**
   * Apply a bulk action to selected users
   * @param action - Bulk action to perform
   * NOTE: Bulk actions now use separate buttons, not a select dropdown
   */
  async applyBulkAction(action: BulkAction): Promise<void> {
    // Note: Bulk actions now use separate buttons, not a menu/select dropdown
    // Playwright will auto-wait for buttons to be actionable when clicking
    
    switch (action) {
      case 'suspend':
        await this.bulkSuspendButton.click();
        break;
      case 'delete':
        await this.bulkDeleteButton.click();
        break;
      default:
        throw new Error(`Bulk action "${action}" is not implemented in the React component`);
    }
    
    await this.waitForActionComplete();
  }

  /**
   * Suspend multiple selected users
   */
  async bulkSuspend(): Promise<void> {
    await this.bulkSuspendButton.click();
    await this.waitForActionComplete();
  }

  /**
   * Delete multiple selected users
   */
  async bulkDelete(): Promise<void> {
    await this.bulkDeleteButton.click();
    
    // Wait for confirmation dialog
    await this.confirmationDialog.waitFor({ state: 'visible' });
    await this.confirmDeletion();
  }

  /**
   * Assign cohort to multiple selected users
   * @param cohortId - ID of the cohort to assign
   * NOTE: Cohort assignment is not yet implemented in the React component
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async bulkAssignCohort(_cohortId: string): Promise<void> {
    throw new Error('Cohort assignment is not yet implemented in the React component');
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
  async verifyUserDeleted(userId: number): Promise<boolean> {
    await this.page.reload();
    await this.waitForUserManagement();
    
    const userRow = this.page.locator(`[data-testid="user-row-${userId}"]`);
    const count = await userRow.count();
    return count === 0;
  }

  /**
   * Get validation error messages from the form
   * @returns Array of error messages
   */
  async getValidationErrors(): Promise<string[]> {
    // Look for MUI TextField error helper text (class: .Mui-error) and generic error alerts
    const errorElements = await this.page.locator('.Mui-error, .error, .alert-danger, [role="alert"]').all();
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
    // Wait for success notification (more reliable than networkidle)
    // Remove networkidle waits - they're unreliable with MSW and SPAs
    await this.page.waitForSelector('.alert-success, [role="status"]', { state: 'visible', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(200); // Small delay for UI to stabilize
  }

  /**
   * Navigate to a specific page of the user list
   * @param pageNumber - Page number to navigate to, or 'next'/'prev' for navigation buttons
   * NOTE: MUI TablePagination uses aria-labels for navigation buttons
   */
  async paginateUsers(pageNumber: number | 'next' | 'prev'): Promise<void> {
    const pagination = this.page.locator('[data-testid="table-pagination"]');
    
    if (typeof pageNumber === 'string') {
      // Handle next/prev navigation with MUI TablePagination
      const ariaLabel = pageNumber === 'next' ? 'Go to next page' : 'Go to previous page';
      const navButton = pagination.locator(`button[aria-label="${ariaLabel}"]`);
      await navButton.click();
    } else {
      // MUI TablePagination doesn't show page numbers, only next/prev
      // To navigate to a specific page, we need to click next multiple times
      throw new Error('Direct page navigation not supported with MUI TablePagination. Use "next" or "prev" instead.');
    }
    // Remove networkidle wait - unreliable with MSW and SPAs
    await this.userTable.waitFor({ state: 'visible' });
  }
}
