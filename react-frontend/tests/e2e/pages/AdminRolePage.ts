/**
 * Page Object Model for Admin Role Management
 * 
 * Encapsulates selectors and interactions for role list, role creation form,
 * capability assignment checkboxes, role assignment to users form, context selector,
 * role deletion, and permission verification controls.
 * 
 * Used by admin-role-assignment.spec.ts E2E test.
 */

import type { Locator, Page } from '@playwright/test';

/**
 * Interface representing a role data structure
 */
export interface RoleData {
  id: number;
  name: string;
  shortname: string;
  description: string;
  sortorder?: number;
  archetype?: string;
}

/**
 * Interface representing a capability data structure
 */
export interface CapabilityData {
  name: string;
  permission: 'allow' | 'prevent' | 'prohibit' | 'inherit';
  locked?: boolean;
}

/**
 * Interface representing role assignment data
 */
export interface RoleAssignmentData {
  userId: number;
  roleId: number;
  contextId: number;
  contextPath?: string;
}

/**
 * Page Object Model for Admin Role Management
 * 
 * Provides methods for creating roles, assigning capabilities, assigning roles to users,
 * and verifying permissions in the Moodle admin interface.
 */
export class AdminRolePage {
  readonly page: Page;
  
  // Role list and management locators
  readonly roleList: Locator;
  readonly createRoleButton: Locator;
  readonly roleTable: Locator;
  
  // Role creation/edit form locators
  readonly roleNameInput: Locator;
  readonly roleDescriptionInput: Locator;
  readonly saveRoleButton: Locator;
  
  // Capability assignment locators
  readonly capabilityCheckboxes: Locator;
  readonly capabilitySearch: Locator;
  
  // Role assignment to users locators
  readonly assignRoleButton: Locator;
  readonly userSelector: Locator;
  readonly contextSelector: Locator;
  readonly roleSelector: Locator;
  readonly assignButton: Locator;
  readonly unassignButton: Locator;
  
  // Role deletion locators
  readonly deleteRoleButton: Locator;
  readonly confirmDeleteButton: Locator;

  /**
   * Constructor for AdminRolePage
   * @param page - Playwright Page object
   */
  constructor(page: Page) {
    this.page = page;
    
    // Initialize role list and management locators
    this.roleList = page.locator('[data-testid="role-list"], table.rolelist, #roles-list');
    this.createRoleButton = page.locator('[data-testid="create-role-button"], button:has-text("Add a new role"), a:has-text("Add a new role")');
    this.roleTable = page.locator('[data-testid="role-table"], table.rolelist, table.generaltable');
    
    // Initialize role creation/edit form locators
    this.roleNameInput = page.locator('[data-testid="role-name-input"], input[name="name"], input#id_name');
    this.roleDescriptionInput = page.locator('[data-testid="role-description-input"], textarea[name="description"], textarea#id_description');
    this.saveRoleButton = page.locator('[data-testid="save-role-button"], button:has-text("Save changes"), input[type="submit"][value*="Save"]');
    
    // Initialize capability assignment locators
    this.capabilityCheckboxes = page.locator('[data-testid^="capability-checkbox"], input[type="checkbox"][name^="cap_"]');
    this.capabilitySearch = page.locator('[data-testid="capability-search"], input[name="filter"], input.capability-filter');
    
    // Initialize role assignment to users locators
    this.assignRoleButton = page.locator('[data-testid="assign-role-button"], button:has-text("Assign roles"), a:has-text("Assign roles")');
    this.userSelector = page.locator('[data-testid="user-selector"], select[name="addselect"], select.user-selector');
    this.contextSelector = page.locator('[data-testid="context-selector"], select[name="contextid"], #id_contextid');
    this.roleSelector = page.locator('[data-testid="role-selector"], select[name="roleid"], #id_roleid');
    this.assignButton = page.locator('[data-testid="assign-button"], button:has-text("Assign"), input[type="submit"][name="add"]');
    this.unassignButton = page.locator('[data-testid="unassign-button"], button:has-text("Remove"), input[type="submit"][name="remove"]');
    
    // Initialize role deletion locators
    this.deleteRoleButton = page.locator('[data-testid="delete-role-button"], a:has-text("Delete"), button:has-text("Delete")');
    this.confirmDeleteButton = page.locator('[data-testid="confirm-delete-button"], button:has-text("Yes"), input[type="submit"][value="Yes"]');
  }

  /**
   * Wait for role management page to load
   */
  async waitForRoleManagement(): Promise<void> {
    await this.roleList.waitFor({ state: 'visible', timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get list of roles from the role table
   * @returns Array of role data
   */
  async getRoles(): Promise<RoleData[]> {
    await this.roleTable.waitFor({ state: 'visible' });
    
    const roles: RoleData[] = [];
    const rows = this.roleTable.locator('tbody tr');
    const rowCount = await rows.count();
    
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const nameCell = row.locator('td').first();
      const name = await nameCell.textContent();
      
      // Extract role ID from data attribute or link
      const roleLink = row.locator('a').first();
      const href = await roleLink.getAttribute('href') || '';
      const idMatch = href.match(/roleid=(\d+)/);
      const id = idMatch?.[1] ? parseInt(idMatch[1], 10) : i + 1;
      
      if (name) {
        roles.push({
          id,
          name: name.trim(),
          shortname: name.trim().toLowerCase().replace(/\s+/g, '_'),
          description: '',
        });
      }
    }
    
    return roles;
  }

  /**
   * Click the create role button to open role creation form
   */
  async clickCreateRole(): Promise<void> {
    await this.createRoleButton.click();
    await this.roleNameInput.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Create a new role with name and description
   * @param roleName - Name of the role
   * @param description - Description of the role
   */
  async createRole(roleName: string, description: string): Promise<void> {
    await this.roleNameInput.fill(roleName);
    await this.roleDescriptionInput.fill(description);
    await this.saveRoleButton.click();
    await this.waitForAssignmentComplete();
  }

  /**
   * Open role edit form for a specific role
   * @param roleId - ID of the role to edit
   */
  async editRole(roleId: number): Promise<void> {
    const editLink = this.roleTable.locator(`a[href*="roleid=${roleId}"][href*="action=edit"]`);
    await editLink.click();
    await this.roleNameInput.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Assign a capability to a role by checking the capability checkbox
   * @param roleId - ID of the role
   * @param capability - Name of the capability
   */
  async assignCapability(roleId: number, capability: string): Promise<void> {
    // Navigate to edit role if not already there
    const isOnEditPage = await this.roleNameInput.isVisible();
    if (!isOnEditPage) {
      await this.editRole(roleId);
    }
    
    // Find and check the capability checkbox
    const capabilityCheckbox = this.page.locator(`input[type="checkbox"][name="cap_${capability}"]`);
    await capabilityCheckbox.scrollIntoViewIfNeeded();
    await capabilityCheckbox.check();
  }

  /**
   * Remove a capability from a role by unchecking the capability checkbox
   * @param roleId - ID of the role
   * @param capability - Name of the capability
   */
  async removeCapability(roleId: number, capability: string): Promise<void> {
    // Navigate to edit role if not already there
    const isOnEditPage = await this.roleNameInput.isVisible();
    if (!isOnEditPage) {
      await this.editRole(roleId);
    }
    
    // Find and uncheck the capability checkbox
    const capabilityCheckbox = this.page.locator(`input[type="checkbox"][name="cap_${capability}"]`);
    await capabilityCheckbox.scrollIntoViewIfNeeded();
    await capabilityCheckbox.uncheck();
  }

  /**
   * Search for capabilities using the search input
   * @param query - Search query
   */
  async searchCapabilities(query: string): Promise<void> {
    await this.capabilitySearch.fill(query);
    // Wait for search results to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Save role changes
   */
  async saveRole(): Promise<void> {
    await this.saveRoleButton.click();
    await this.waitForAssignmentComplete();
  }

  /**
   * Click the assign role button to open role assignment form
   */
  async clickAssignRole(): Promise<void> {
    await this.assignRoleButton.click();
    await this.userSelector.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Select a user from the user selector
   * @param userId - ID of the user
   */
  async selectUser(userId: number): Promise<void> {
    await this.userSelector.selectOption({ value: userId.toString() });
  }

  /**
   * Select a context from the context selector
   * @param contextPath - Context path or ID
   */
  async selectContext(contextPath: string): Promise<void> {
    // Try to select by value first, then by label
    try {
      await this.contextSelector.selectOption({ value: contextPath });
    } catch {
      await this.contextSelector.selectOption({ label: contextPath });
    }
  }

  /**
   * Select a role from the role selector
   * @param roleId - ID of the role
   */
  async selectRole(roleId: number): Promise<void> {
    await this.roleSelector.selectOption({ value: roleId.toString() });
  }

  /**
   * Assign a role to a user in a specific context
   * @param userId - ID of the user
   * @param roleId - ID of the role
   * @param context - Context path or ID
   */
  async assignRoleToUser(userId: number, roleId: number, context: string): Promise<void> {
    // Navigate to assign page if not already there
    const isOnAssignPage = await this.userSelector.isVisible();
    if (!isOnAssignPage) {
      await this.clickAssignRole();
    }
    
    // Select context, role, and user, then assign
    await this.selectContext(context);
    await this.selectRole(roleId);
    await this.selectUser(userId);
    await this.assignButton.click();
    await this.waitForAssignmentComplete();
  }

  /**
   * Remove a role assignment from a user in a specific context
   * @param userId - ID of the user
   * @param roleId - ID of the role
   * @param context - Context path or ID
   */
  async unassignRole(userId: number, roleId: number, context: string): Promise<void> {
    // Navigate to assign page if not already there
    const isOnAssignPage = await this.userSelector.isVisible();
    if (!isOnAssignPage) {
      await this.clickAssignRole();
    }
    
    // Select context and role
    await this.selectContext(context);
    await this.selectRole(roleId);
    
    // Find the user in the assigned users list and click remove
    const assignedUserOption = this.page.locator(`select[name="removeselect"] option[value="${userId}"]`);
    await assignedUserOption.click();
    await this.unassignButton.click();
    await this.waitForAssignmentComplete();
  }

  /**
   * Delete a custom role
   * @param roleId - ID of the role to delete
   */
  async deleteRole(roleId: number): Promise<void> {
    const deleteLink = this.roleTable.locator(`a[href*="roleid=${roleId}"][href*="action=delete"]`);
    await deleteLink.click();
    await this.confirmDeleteButton.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Confirm role deletion in the confirmation dialog
   */
  async confirmRoleDeletion(): Promise<void> {
    await this.confirmDeleteButton.click();
    await this.waitForAssignmentComplete();
  }

  /**
   * Verify that a role exists in the role list
   * @param roleName - Name of the role
   * @returns True if role exists, false otherwise
   */
  async verifyRoleExists(roleName: string): Promise<boolean> {
    await this.roleList.waitFor({ state: 'visible' });
    const roleCell = this.roleTable.locator(`td:has-text("${roleName}")`);
    return await roleCell.isVisible();
  }

  /**
   * Verify that a capability is assigned to a role
   * @param roleId - ID of the role
   * @param capability - Name of the capability
   * @returns True if capability is assigned, false otherwise
   */
  async verifyCapabilityAssigned(roleId: number, capability: string): Promise<boolean> {
    // Navigate to edit role page
    const isOnEditPage = await this.roleNameInput.isVisible();
    if (!isOnEditPage) {
      await this.editRole(roleId);
    }
    
    // Check if capability checkbox is checked
    const capabilityCheckbox = this.page.locator(`input[type="checkbox"][name="cap_${capability}"]`);
    await capabilityCheckbox.scrollIntoViewIfNeeded();
    return await capabilityCheckbox.isChecked();
  }

  /**
   * Verify that a user has a specific role assigned
   * @param userId - ID of the user
   * @param roleId - ID of the role
   * @returns True if user has the role, false otherwise
   */
  async verifyUserHasRole(userId: number, roleId: number): Promise<boolean> {
    // Navigate to assign page if not already there
    const isOnAssignPage = await this.userSelector.isVisible();
    if (!isOnAssignPage) {
      await this.clickAssignRole();
    }
    
    // Select the role
    await this.selectRole(roleId);
    
    // Check if user appears in the assigned users list
    const assignedUserOption = this.page.locator(`select[name="removeselect"] option[value="${userId}"]`);
    return await assignedUserOption.isVisible();
  }

  /**
   * Wait for role assignment or operation to complete
   */
  async waitForAssignmentComplete(): Promise<void> {
    // Wait for success message or page reload
    try {
      const successMessage = this.page.locator('.alert-success, .notification-success, [role="alert"]:has-text("success")');
      await successMessage.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      // If no success message, wait for network idle
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Get all capabilities assigned to a role
   * @param roleId - ID of the role
   * @returns Array of capability data
   */
  async getRoleCapabilities(roleId: number): Promise<CapabilityData[]> {
    // Navigate to edit role page
    const isOnEditPage = await this.roleNameInput.isVisible();
    if (!isOnEditPage) {
      await this.editRole(roleId);
    }
    
    const capabilities: CapabilityData[] = [];
    const checkboxes = await this.capabilityCheckboxes.all();
    
    for (const checkbox of checkboxes) {
      const name = await checkbox.getAttribute('name');
      const isChecked = await checkbox.isChecked();
      
      if (name && name.startsWith('cap_')) {
        const capabilityName = name.replace('cap_', '');
        capabilities.push({
          name: capabilityName,
          permission: isChecked ? 'allow' : 'inherit',
        });
      }
    }
    
    return capabilities;
  }
}
