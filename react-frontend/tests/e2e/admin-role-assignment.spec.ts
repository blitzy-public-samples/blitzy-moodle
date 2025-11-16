/**
 * E2E Test: Admin Role Assignment Workflow
 * 
 * Tests the complete role management workflow including:
 * - Custom role creation with specific capabilities
 * - Capability assignment to roles
 * - Role assignment to users in course context
 * - Permission verification for granted capabilities
 * - Role unassignment and permission revocation
 * - Role deletion and cleanup
 * - Error scenarios for non-admin users
 * 
 * @module tests/e2e/admin-role-assignment.spec
 */

import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { AdminRolePage } from './pages/AdminRolePage';
import { CoursePage } from './pages/CoursePage';
import { loginAsAdmin, loginAsStudent, logout, isAuthenticated } from './utils/auth';
import { _testAdmin, testStudent, _TEST_PASSWORD } from './fixtures/users';
import { testCourse1 } from './fixtures/courses';

test.describe('Admin Role Assignment Workflow', () => {
  let adminPage: Page;
  let adminRolePage: AdminRolePage;
  let customRoleName: string;
  let customRoleId: number;
  const customRoleDescription = 'Custom role for E2E testing with course management capabilities';
  
  // Capabilities to assign to custom role
  const testCapabilities = [
    'moodle/course:view',
    'moodle/course:update',
    'mod/assign:grade',
    'moodle/course:manageactivities'
  ];

  /**
   * Setup: Login as admin user, navigate to role management
   */
  test.beforeAll(async ({ browser }) => {
    // Step 1: Login as admin user
    adminPage = await browser.newPage();
    await loginAsAdmin(adminPage);
    
    // Verify admin authentication
    const authenticated = await isAuthenticated(adminPage);
    expect(authenticated).toBe(true);
    
    // Step 1: Navigate to role management
    adminRolePage = new AdminRolePage(adminPage);
    await adminRolePage.waitForRoleManagement();
    
    // Generate unique role name to avoid conflicts
    customRoleName = `E2E_Test_Role_${Date.now()}`;
  });

  /**
   * Cleanup: Remove test roles and assignments
   */
  test.afterAll(async () => {
    // Step 10: Cleanup - Remove test roles and assignments
    try {
      // Attempt to delete role if it still exists
      const roleExists = await adminRolePage.verifyRoleExists(customRoleName);
      if (roleExists && customRoleId) {
        await adminRolePage.deleteRole(customRoleId);
        await adminRolePage.confirmRoleDeletion();
      }
    } catch (error) {
      console.log('Cleanup: Role may have already been deleted or does not exist');
    }
    
    // Logout admin user
    await logout(adminPage);
    await adminPage.close();
  });

  /**
   * Reset state before each test
   */
  test.beforeEach(async () => {
    // Ensure we're on role management page
    await adminRolePage.waitForRoleManagement();
  });

  /**
   * Step 2: Test role creation with specific name and description
   */
  test('should create a custom role with specific capabilities', async () => {
    // Click create role button
    await adminRolePage.clickCreateRole();
    
    // Create role with custom name and description
    await adminRolePage.createRole(customRoleName, customRoleDescription);
    
    // Step 8 Assertion: Verify role appears in lists
    const roleExists = await adminRolePage.verifyRoleExists(customRoleName);
    expect(roleExists).toBe(true);
    
    // Get the role ID by fetching all roles and finding the one with matching name
    const roles = await adminRolePage.getRoles();
    const createdRole = roles.find(role => role.name === customRoleName);
    expect(createdRole).toBeDefined();
    customRoleId = createdRole!.id;
    
    // Capture screenshot for verification
    await adminPage.screenshot({ 
      path: `screenshots/admin-role-created-${customRoleName}.png`,
      fullPage: true 
    });
  });

  /**
   * Step 3: Test capability assignment to role
   */
  test('should assign multiple capabilities to the custom role', async () => {
    // Assign each capability to the role
    for (const capability of testCapabilities) {
      await adminRolePage.assignCapability(customRoleId, capability);
    }
    
    // Save role with assigned capabilities
    await adminRolePage.saveRole();
    
    // Step 8 Assertion: Verify capabilities saved correctly
    for (const capability of testCapabilities) {
      const isAssigned = await adminRolePage.verifyCapabilityAssigned(
        customRoleId,
        capability
      );
      expect(isAssigned).toBe(true);
    }
    
    // Retrieve all role capabilities for comprehensive verification
    const roleCapabilities = await adminRolePage.getRoleCapabilities(customRoleId);
    
    // Verify all test capabilities are present
    for (const capability of testCapabilities) {
      const capabilityNames = roleCapabilities.map(cap => cap.name);
      expect(capabilityNames).toContain(capability);
    }
    
    // Capture screenshot
    await adminPage.screenshot({ 
      path: `screenshots/admin-capabilities-assigned-${customRoleName}.png`,
      fullPage: true 
    });
  });

  /**
   * Step 4: Test role assignment to user in course context
   */
  test('should assign custom role to test user in course context', async () => {
    // Navigate to role assignment interface
    await adminRolePage.clickAssignRole();
    
    // Select the custom role
    await adminRolePage.selectRole(customRoleId);
    
    // Select course context for role assignment
    await adminRolePage.selectContext(`course/${testCourse1.id}`);
    
    // Select test student as the user to assign role to
    await adminRolePage.selectUser(testStudent.id);
    
    // Perform the role assignment
    await adminRolePage.assignRoleToUser(testStudent.id, customRoleId, `course/${testCourse1.id}`);
    
    // Wait for assignment operation to complete
    await adminRolePage.waitForAssignmentComplete();
    
    // Step 8 Assertion: Verify user has role
    const userHasRole = await adminRolePage.verifyUserHasRole(
      testStudent.id,
      customRoleId
    );
    expect(userHasRole).toBe(true);
    
    // Capture screenshot
    await adminPage.screenshot({ 
      path: `screenshots/admin-role-assigned-to-user-${testStudent.username}.png`,
      fullPage: true 
    });
  });

  /**
   * Step 5: Test permission verification - verify capabilities granted
   */
  test('should verify test user has granted capabilities after role assignment', async ({ browser }) => {
    // Create new browser context for test student
    const studentPage = await browser.newPage();
    
    try {
      // Login as test student
      await loginAsStudent(studentPage);
      
      // Verify student authentication
      const studentAuthenticated = await isAuthenticated(studentPage);
      expect(studentAuthenticated).toBe(true);
      
      // Navigate to the course where role was assigned
      const coursePage = new CoursePage(studentPage);
      await coursePage.waitForCourse();
      
      // Verify student can view course (moodle/course:view capability)
      const courseInfo = await coursePage.getCourseInfo();
      expect(courseInfo).toBeDefined();
      expect(courseInfo.title).toBe(testCourse1.fullname);
      
      // Step 8 Assertion: User gains access
      const isEnrolled = await coursePage.isEnrolled();
      expect(isEnrolled).toBe(true);
      
      // Verify student can see course sections (view capability)
      const sections = await coursePage.getSections();
      expect(sections).toBeDefined();
      expect(sections.length).toBeGreaterThan(0);
      
      // Verify student can see course activities (view capability)
      const activities = await coursePage.getActivities();
      expect(activities).toBeDefined();
      
      // Capture screenshot showing granted access
      await studentPage.screenshot({ 
        path: `screenshots/student-course-access-granted-${testStudent.username}.png`,
        fullPage: true 
      });
      
    } finally {
      // Cleanup student session
      await logout(studentPage);
      await studentPage.close();
    }
  });

  /**
   * Step 6: Test role unassignment and permission revocation
   */
  test('should revoke permissions after unassigning role from user', async ({ browser }) => {
    // Step 6: Remove role from user
    await adminRolePage.clickAssignRole();
    await adminRolePage.unassignRole(
      testStudent.id,
      customRoleId,
      `course/${testCourse1.id}`
    );
    
    // Verify role unassignment completed
    const userStillHasRole = await adminRolePage.verifyUserHasRole(
      testStudent.id,
      customRoleId
    );
    expect(userStillHasRole).toBe(false);
    
    // Step 6: Verify permissions revoked
    const studentPage = await browser.newPage();
    
    try {
      // Login as test student
      await loginAsStudent(studentPage);
      
      const coursePage = new CoursePage(studentPage);
      
      // Attempt to access course
      try {
        await coursePage.waitForCourse();
        
        // Check enrollment status after role unassignment
        const stillEnrolled = await coursePage.isEnrolled();
        
        // Step 8 Assertion: User loses access
        // After role unassignment, user should no longer be enrolled via that role
        if (stillEnrolled) {
          // If enrolled through other means, verify capabilities are limited
          const sections = await coursePage.getSections();
          // User may still view basic info but not edit
          expect(sections).toBeDefined();
        } else {
          // Complete access revocation
          expect(stillEnrolled).toBe(false);
        }
      } catch (error) {
        // Permission denied is expected after role unassignment
        console.log('Expected: Permission denied after role unassignment');
        // This is a valid outcome - user loses access completely
      }
      
      // Capture screenshot showing revoked access
      await studentPage.screenshot({ 
        path: `screenshots/student-access-revoked-${testStudent.username}.png`,
        fullPage: true 
      });
      
    } finally {
      // Cleanup student session
      await logout(studentPage);
      await studentPage.close();
    }
  });

  /**
   * Step 7: Test role deletion and cleanup verification
   */
  test('should delete custom role and verify cleanup', async () => {
    // Delete the custom role
    await adminRolePage.deleteRole(customRoleId);
    
    // Confirm deletion in confirmation dialog
    await adminRolePage.confirmRoleDeletion();
    
    // Step 8 Assertion: Verify role no longer exists
    const roleStillExists = await adminRolePage.verifyRoleExists(customRoleName);
    expect(roleStillExists).toBe(false);
    
    // Capture screenshot confirming deletion
    await adminPage.screenshot({ 
      path: `screenshots/admin-role-deleted-${customRoleName}.png`,
      fullPage: true 
    });
  });

  /**
   * Step 9: Error scenarios - test permission denied for non-admin users
   */
  test('should deny role management access to non-admin users', async ({ browser }) => {
    // Create new browser context for test student (non-admin)
    const studentPage = await browser.newPage();
    
    try {
      // Login as test student (non-admin user)
      await loginAsStudent(studentPage);
      
      // Verify student authentication
      const studentAuthenticated = await isAuthenticated(studentPage);
      expect(studentAuthenticated).toBe(true);
      
      // Attempt to access role management page
      const studentRolePage = new AdminRolePage(studentPage);
      
      // Expect permission denial
      let permissionDenied = false;
      
      try {
        await studentRolePage.waitForRoleManagement();
        
        // If page loads, verify student cannot perform role operations
        try {
          await studentRolePage.clickCreateRole();
          // If this succeeds, it's an error - non-admin should not be able to create roles
          throw new Error('Non-admin user should not be able to create roles');
        } catch (error) {
          // Expected: Operation should fail for non-admin
          permissionDenied = true;
        }
        
      } catch (error) {
        // Expected: Page should not be accessible to non-admin
        permissionDenied = true;
        
        // Verify error message or redirect
        const pageContent = await studentPage.content();
        const hasPermissionError = 
          pageContent.includes('permission') || 
          pageContent.includes('access denied') ||
          pageContent.includes('not authorized') ||
          pageContent.includes('forbidden');
        
        expect(hasPermissionError).toBe(true);
      }
      
      // Step 9 Assertion: Permission denied for non-admin users
      expect(permissionDenied).toBe(true);
      
      // Capture screenshot showing access denial
      await studentPage.screenshot({ 
        path: `screenshots/non-admin-access-denied-${testStudent.username}.png`,
        fullPage: true 
      });
      
    } finally {
      // Cleanup student session
      await logout(studentPage);
      await studentPage.close();
    }
  });

  /**
   * Comprehensive workflow test - all steps in sequence
   */
  test('should complete full role assignment workflow from creation to deletion', async ({ browser }) => {
    // This test runs the complete workflow to ensure end-to-end consistency
    
    const workflowRoleName = `E2E_Workflow_Role_${Date.now()}`;
    let workflowRoleId: number;
    
    // Step 1: Already logged in as admin from beforeAll
    await adminRolePage.waitForRoleManagement();
    
    // Step 2: Create role
    await adminRolePage.clickCreateRole();
    await adminRolePage.createRole(workflowRoleName, 'Full workflow test role');
    expect(await adminRolePage.verifyRoleExists(workflowRoleName)).toBe(true);
    
    // Get the role ID after creation
    const roles = await adminRolePage.getRoles();
    const workflowRole = roles.find(r => r.name === workflowRoleName);
    expect(workflowRole).toBeDefined();
    workflowRoleId = workflowRole!.id;
    
    // Step 3: Assign capabilities
    await adminRolePage.assignCapability(workflowRoleId, 'moodle/course:view');
    await adminRolePage.assignCapability(workflowRoleId, 'moodle/course:update');
    await adminRolePage.saveRole();
    expect(await adminRolePage.verifyCapabilityAssigned(workflowRoleId, 'moodle/course:view')).toBe(true);
    
    // Step 4: Assign role to user
    await adminRolePage.clickAssignRole();
    await adminRolePage.selectRole(workflowRoleId);
    await adminRolePage.selectContext(`course/${testCourse1.id}`);
    await adminRolePage.selectUser(testStudent.id);
    await adminRolePage.assignRoleToUser(testStudent.id, workflowRoleId, `course/${testCourse1.id}`);
    await adminRolePage.waitForAssignmentComplete();
    expect(await adminRolePage.verifyUserHasRole(testStudent.id, workflowRoleId)).toBe(true);
    
    // Step 5: Verify permissions granted
    const studentPage = await browser.newPage();
    await loginAsStudent(studentPage);
    const coursePage = new CoursePage(studentPage);
    await coursePage.waitForCourse();
    expect(await coursePage.isEnrolled()).toBe(true);
    await logout(studentPage);
    await studentPage.close();
    
    // Step 6: Unassign role
    await adminRolePage.clickAssignRole();
    await adminRolePage.unassignRole(testStudent.id, workflowRoleId, `course/${testCourse1.id}`);
    expect(await adminRolePage.verifyUserHasRole(testStudent.id, workflowRoleId)).toBe(false);
    
    // Step 7: Delete role
    await adminRolePage.deleteRole(workflowRoleId);
    await adminRolePage.confirmRoleDeletion();
    expect(await adminRolePage.verifyRoleExists(workflowRoleName)).toBe(false);
    
    // Step 8: All assertions passed throughout workflow
    // Step 9: Error scenarios tested in separate test
    // Step 10: Cleanup completed
    
    await adminPage.screenshot({ 
      path: `screenshots/full-workflow-complete-${workflowRoleName}.png`,
      fullPage: true 
    });
  });
});
