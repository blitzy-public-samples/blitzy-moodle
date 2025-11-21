/**
 * Permission Checking Utility Functions - Unit Tests
 *
 * Comprehensive test suite validating client-side permission checking functions
 * based on user roles and capabilities. Tests cover all permission helper functions
 * including capability checks, role-based permissions, and context-specific access.
 *
 * IMPORTANT: These tests validate CLIENT-SIDE helpers for UI presentation only.
 * The backend API MUST ALWAYS enforce permissions authoritatively using
 * require_capability() and the Moodle access control system.
 *
 * @module tests/unit/utils/permissions.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  hasCapability,
  hasAnyCapability,
  hasAllCapabilities,
  canViewCourse,
  canEditCourse,
  canGradeAssignment,
  canSubmitAssignment,
  canManageUsers,
  canManageRoles,
  canAccessAdmin,
  isStudent,
  isTeacher,
  isAdmin,
  getUserRole,
  CAPABILITY_VIEW_COURSE,
  CAPABILITY_EDIT_COURSE,
  CAPABILITY_GRADE_ASSIGNMENT,
  CAPABILITY_SUBMIT_ASSIGNMENT,
  CAPABILITY_MANAGE_USERS,
  CAPABILITY_MANAGE_ROLES,
  CAPABILITY_VIEW_ADMIN,
  CONTEXT_SYSTEM,
} from '@/utils/permissions';

// ============================================================================
// Mock Data and Helpers
// ============================================================================

/**
 * Mock window object with Moodle user data
 */
interface MockMoodleWindow {
  __MOODLE_USER__?: {
    id: number;
    roles?: string[];
    capabilities?: string[];
  };
}

/**
 * Set mock user data in window global
 */
function setMockUser(userData: {
  id: number;
  roles?: string[];
  capabilities?: string[];
}) {
  (window as unknown as MockMoodleWindow).__MOODLE_USER__ = userData;
}

/**
 * Clear mock user data
 */
function clearMockUser() {
  delete (window as unknown as MockMoodleWindow).__MOODLE_USER__;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Permission Utilities', () => {
  // Clean up after each test
  afterEach(() => {
    clearMockUser();
  });

  // ==========================================================================
  // hasCapability() Tests
  // ==========================================================================

  describe('hasCapability', () => {
    it('should return true when user has the capability', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE, CAPABILITY_SUBMIT_ASSIGNMENT],
      });

      const result = hasCapability(CAPABILITY_VIEW_COURSE);
      expect(result).toBe(true);
    });

    it('should return false when user does not have the capability', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_SUBMIT_ASSIGNMENT],
      });

      const result = hasCapability(CAPABILITY_VIEW_COURSE);
      expect(result).toBe(false);
    });

    it('should return false when user is not authenticated', () => {
      clearMockUser();

      const result = hasCapability(CAPABILITY_VIEW_COURSE);
      expect(result).toBe(false);
    });

    it('should check capability with context ID', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_EDIT_COURSE],
      });

      const result = hasCapability(CAPABILITY_EDIT_COURSE, 5);
      expect(result).toBe(true);
    });

    it('should return false for invalid capability name', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = hasCapability('invalid/capability:name');
      expect(result).toBe(false);
    });

    it('should return false for empty capability string', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = hasCapability('');
      expect(result).toBe(false);
    });

    it('should check capability in system context', () => {
      setMockUser({
        id: 1,
        roles: ['admin'],
        capabilities: [CAPABILITY_VIEW_ADMIN],
      });

      const result = hasCapability(CAPABILITY_VIEW_ADMIN, CONTEXT_SYSTEM);
      expect(result).toBe(true);
    });
  });

  // ==========================================================================
  // hasAnyCapability() Tests
  // ==========================================================================

  describe('hasAnyCapability', () => {
    it('should return true when user has at least one capability', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = hasAnyCapability([
        CAPABILITY_VIEW_COURSE,
        CAPABILITY_EDIT_COURSE,
      ]);
      expect(result).toBe(true);
    });

    it('should return true when user has all capabilities', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_VIEW_COURSE, CAPABILITY_EDIT_COURSE],
      });

      const result = hasAnyCapability([
        CAPABILITY_VIEW_COURSE,
        CAPABILITY_EDIT_COURSE,
      ]);
      expect(result).toBe(true);
    });

    it('should return false when user has none of the capabilities', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_SUBMIT_ASSIGNMENT],
      });

      const result = hasAnyCapability([
        CAPABILITY_EDIT_COURSE,
        CAPABILITY_GRADE_ASSIGNMENT,
      ]);
      expect(result).toBe(false);
    });

    it('should return false for empty capability array', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = hasAnyCapability([]);
      expect(result).toBe(false);
    });

    it('should work with single capability (same as hasCapability)', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = hasAnyCapability([CAPABILITY_VIEW_COURSE]);
      expect(result).toBe(true);
    });

    it('should check capabilities with context ID', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_EDIT_COURSE],
      });

      const result = hasAnyCapability(
        [CAPABILITY_EDIT_COURSE, CAPABILITY_GRADE_ASSIGNMENT],
        5
      );
      expect(result).toBe(true);
    });

    it('should return false when user is not authenticated', () => {
      clearMockUser();

      const result = hasAnyCapability([
        CAPABILITY_VIEW_COURSE,
        CAPABILITY_EDIT_COURSE,
      ]);
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // hasAllCapabilities() Tests
  // ==========================================================================

  describe('hasAllCapabilities', () => {
    it('should return true when user has all capabilities', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_VIEW_COURSE, CAPABILITY_EDIT_COURSE],
      });

      const result = hasAllCapabilities([
        CAPABILITY_VIEW_COURSE,
        CAPABILITY_EDIT_COURSE,
      ]);
      expect(result).toBe(true);
    });

    it('should return false when user has some but not all capabilities', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = hasAllCapabilities([
        CAPABILITY_VIEW_COURSE,
        CAPABILITY_EDIT_COURSE,
      ]);
      expect(result).toBe(false);
    });

    it('should return false when user has none of the capabilities', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_SUBMIT_ASSIGNMENT],
      });

      const result = hasAllCapabilities([
        CAPABILITY_EDIT_COURSE,
        CAPABILITY_GRADE_ASSIGNMENT,
      ]);
      expect(result).toBe(false);
    });

    it('should return true for empty capability array', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = hasAllCapabilities([]);
      expect(result).toBe(true);
    });

    it('should work with single capability', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = hasAllCapabilities([CAPABILITY_VIEW_COURSE]);
      expect(result).toBe(true);
    });

    it('should check capabilities with context ID', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_EDIT_COURSE, CAPABILITY_GRADE_ASSIGNMENT],
      });

      const result = hasAllCapabilities(
        [CAPABILITY_EDIT_COURSE, CAPABILITY_GRADE_ASSIGNMENT],
        5
      );
      expect(result).toBe(true);
    });

    it('should return false when user is not authenticated', () => {
      clearMockUser();

      const result = hasAllCapabilities([
        CAPABILITY_VIEW_COURSE,
        CAPABILITY_EDIT_COURSE,
      ]);
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // canViewCourse() Tests
  // ==========================================================================

  describe('canViewCourse', () => {
    it('should return true when user has course view capability', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = canViewCourse(5);
      expect(result).toBe(true);
    });

    it('should return false when user does not have course view capability', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_SUBMIT_ASSIGNMENT],
      });

      const result = canViewCourse(5);
      expect(result).toBe(false);
    });

    it('should work with different course contexts', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result1 = canViewCourse(5);
      const result2 = canViewCourse(10);
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should return false when user is not authenticated', () => {
      clearMockUser();

      const result = canViewCourse(5);
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // canEditCourse() Tests
  // ==========================================================================

  describe('canEditCourse', () => {
    it('should return true when user has course edit capability', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_EDIT_COURSE],
      });

      const result = canEditCourse(5);
      expect(result).toBe(true);
    });

    it('should return true for teacher role', () => {
      setMockUser({
        id: 1,
        roles: ['editingteacher'],
        capabilities: [CAPABILITY_EDIT_COURSE],
      });

      const result = canEditCourse(5);
      expect(result).toBe(true);
    });

    it('should return false for student role', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = canEditCourse(5);
      expect(result).toBe(false);
    });

    it('should return false when user is not authenticated', () => {
      clearMockUser();

      const result = canEditCourse(5);
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // canGradeAssignment() Tests
  // ==========================================================================

  describe('canGradeAssignment', () => {
    it('should return true when user has grade assignment capability', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_GRADE_ASSIGNMENT],
      });

      const result = canGradeAssignment(10);
      expect(result).toBe(true);
    });

    it('should return true for teacher role', () => {
      setMockUser({
        id: 1,
        roles: ['editingteacher'],
        capabilities: [CAPABILITY_GRADE_ASSIGNMENT],
      });

      const result = canGradeAssignment(10);
      expect(result).toBe(true);
    });

    it('should return false for student role', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_SUBMIT_ASSIGNMENT],
      });

      const result = canGradeAssignment(10);
      expect(result).toBe(false);
    });

    it('should return false when user is not authenticated', () => {
      clearMockUser();

      const result = canGradeAssignment(10);
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // canSubmitAssignment() Tests
  // ==========================================================================

  describe('canSubmitAssignment', () => {
    it('should return true when user has submit assignment capability', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_SUBMIT_ASSIGNMENT],
      });

      const result = canSubmitAssignment(10);
      expect(result).toBe(true);
    });

    it('should return true for student role', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_SUBMIT_ASSIGNMENT],
      });

      const result = canSubmitAssignment(10);
      expect(result).toBe(true);
    });

    it('should return false when user does not have submit capability', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = canSubmitAssignment(10);
      expect(result).toBe(false);
    });

    it('should return false when user is not authenticated', () => {
      clearMockUser();

      const result = canSubmitAssignment(10);
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // canManageUsers() Tests
  // ==========================================================================

  describe('canManageUsers', () => {
    it('should return true when user has manage users capability', () => {
      setMockUser({
        id: 1,
        roles: ['admin'],
        capabilities: [CAPABILITY_MANAGE_USERS],
      });

      const result = canManageUsers();
      expect(result).toBe(true);
    });

    it('should return true for admin role', () => {
      setMockUser({
        id: 1,
        roles: ['manager'],
        capabilities: [CAPABILITY_MANAGE_USERS],
      });

      const result = canManageUsers();
      expect(result).toBe(true);
    });

    it('should return false for student role', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = canManageUsers();
      expect(result).toBe(false);
    });

    it('should return false for teacher role', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_EDIT_COURSE],
      });

      const result = canManageUsers();
      expect(result).toBe(false);
    });

    it('should return false when user is not authenticated', () => {
      clearMockUser();

      const result = canManageUsers();
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // canManageRoles() Tests
  // ==========================================================================

  describe('canManageRoles', () => {
    it('should return true when user has manage roles capability', () => {
      setMockUser({
        id: 1,
        roles: ['admin'],
        capabilities: [CAPABILITY_MANAGE_ROLES],
      });

      const result = canManageRoles();
      expect(result).toBe(true);
    });

    it('should return true for admin role', () => {
      setMockUser({
        id: 1,
        roles: ['manager'],
        capabilities: [CAPABILITY_MANAGE_ROLES],
      });

      const result = canManageRoles();
      expect(result).toBe(true);
    });

    it('should return false for non-admin role', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_EDIT_COURSE],
      });

      const result = canManageRoles();
      expect(result).toBe(false);
    });

    it('should return false when user is not authenticated', () => {
      clearMockUser();

      const result = canManageRoles();
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // canAccessAdmin() Tests
  // ==========================================================================

  describe('canAccessAdmin', () => {
    it('should return true when user has admin access capability', () => {
      setMockUser({
        id: 1,
        roles: ['admin'],
        capabilities: [CAPABILITY_VIEW_ADMIN],
      });

      const result = canAccessAdmin();
      expect(result).toBe(true);
    });

    it('should return true for admin role', () => {
      setMockUser({
        id: 1,
        roles: ['manager'],
        capabilities: [CAPABILITY_VIEW_ADMIN],
      });

      const result = canAccessAdmin();
      expect(result).toBe(true);
    });

    it('should return false for student role', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = canAccessAdmin();
      expect(result).toBe(false);
    });

    it('should return false for teacher role', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_EDIT_COURSE],
      });

      const result = canAccessAdmin();
      expect(result).toBe(false);
    });

    it('should check for specific admin capabilities', () => {
      setMockUser({
        id: 1,
        roles: ['coursecreator'],
        capabilities: [CAPABILITY_VIEW_ADMIN],
      });

      const result = canAccessAdmin();
      expect(result).toBe(true);
    });

    it('should return false when user is not authenticated', () => {
      clearMockUser();

      const result = canAccessAdmin();
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // isStudent() Tests
  // ==========================================================================

  describe('isStudent', () => {
    it('should return true when user has student role', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = isStudent();
      expect(result).toBe(true);
    });

    it('should return false when user does not have student role', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_EDIT_COURSE],
      });

      const result = isStudent();
      expect(result).toBe(false);
    });

    it('should return true when user has multiple roles including student', () => {
      setMockUser({
        id: 1,
        roles: ['student', 'teacher'],
        capabilities: [CAPABILITY_VIEW_COURSE, CAPABILITY_EDIT_COURSE],
      });

      const result = isStudent();
      expect(result).toBe(true);
    });

    it('should return false when user is not authenticated', () => {
      clearMockUser();

      const result = isStudent();
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // isTeacher() Tests
  // ==========================================================================

  describe('isTeacher', () => {
    it('should return true when user has teacher role', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = isTeacher();
      expect(result).toBe(true);
    });

    it('should return true when user has editingteacher role', () => {
      setMockUser({
        id: 1,
        roles: ['editingteacher'],
        capabilities: [CAPABILITY_EDIT_COURSE],
      });

      const result = isTeacher();
      expect(result).toBe(true);
    });

    it('should return false when user does not have teacher role', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = isTeacher();
      expect(result).toBe(false);
    });

    it('should return false when user is not authenticated', () => {
      clearMockUser();

      const result = isTeacher();
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // isAdmin() Tests
  // ==========================================================================

  describe('isAdmin', () => {
    it('should return true when user has manager role', () => {
      setMockUser({
        id: 1,
        roles: ['manager'],
        capabilities: [CAPABILITY_VIEW_ADMIN],
      });

      const result = isAdmin();
      expect(result).toBe(true);
    });

    it('should return true when user has admin capability', () => {
      setMockUser({
        id: 1,
        roles: ['coursecreator'],
        capabilities: [CAPABILITY_VIEW_ADMIN],
      });

      const result = isAdmin();
      expect(result).toBe(true);
    });

    it('should return false when user does not have admin role or capability', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_EDIT_COURSE],
      });

      const result = isAdmin();
      expect(result).toBe(false);
    });

    it('should return false for student role', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = isAdmin();
      expect(result).toBe(false);
    });

    it('should return false when user is not authenticated', () => {
      clearMockUser();

      const result = isAdmin();
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // getUserRole() Tests
  // ==========================================================================

  describe('getUserRole', () => {
    it('should return primary role for user', () => {
      setMockUser({
        id: 1,
        roles: ['student'],
        capabilities: [CAPABILITY_VIEW_COURSE],
      });

      const result = getUserRole();
      expect(result).toBe('student');
    });

    it('should return null for user with no roles', () => {
      setMockUser({
        id: 1,
        roles: [],
        capabilities: [],
      });

      const result = getUserRole();
      expect(result).toBeNull();
    });

    it('should return null when user is not authenticated', () => {
      clearMockUser();

      const result = getUserRole();
      expect(result).toBeNull();
    });

    it('should return highest priority role when user has multiple roles', () => {
      setMockUser({
        id: 1,
        roles: ['student', 'teacher', 'manager'],
        capabilities: [
          CAPABILITY_VIEW_COURSE,
          CAPABILITY_EDIT_COURSE,
          CAPABILITY_MANAGE_USERS,
        ],
      });

      const result = getUserRole();
      expect(result).toBe('manager');
    });

    it('should work with specific context', () => {
      setMockUser({
        id: 1,
        roles: ['teacher'],
        capabilities: [CAPABILITY_EDIT_COURSE],
      });

      const result = getUserRole(5);
      expect(result).toBe('teacher');
    });

    it('should work with system context', () => {
      setMockUser({
        id: 1,
        roles: ['manager'],
        capabilities: [CAPABILITY_VIEW_ADMIN],
      });

      const result = getUserRole(CONTEXT_SYSTEM);
      expect(result).toBe('manager');
    });

    it('should prioritize editingteacher over teacher', () => {
      setMockUser({
        id: 1,
        roles: ['teacher', 'editingteacher'],
        capabilities: [CAPABILITY_EDIT_COURSE],
      });

      const result = getUserRole();
      expect(result).toBe('editingteacher');
    });

    it('should prioritize teacher over student', () => {
      setMockUser({
        id: 1,
        roles: ['student', 'teacher'],
        capabilities: [CAPABILITY_VIEW_COURSE, CAPABILITY_EDIT_COURSE],
      });

      const result = getUserRole();
      expect(result).toBe('teacher');
    });
  });

  // ==========================================================================
  // User Persona Tests
  // ==========================================================================

  describe('User Personas', () => {
    describe('as student', () => {
      beforeEach(() => {
        setMockUser({
          id: 1,
          roles: ['student'],
          capabilities: [CAPABILITY_VIEW_COURSE, CAPABILITY_SUBMIT_ASSIGNMENT],
        });
      });

      it('should allow viewing courses', () => {
        expect(canViewCourse(5)).toBe(true);
      });

      it('should allow submitting assignments', () => {
        expect(canSubmitAssignment(10)).toBe(true);
      });

      it('should not allow editing courses', () => {
        expect(canEditCourse(5)).toBe(false);
      });

      it('should not allow grading assignments', () => {
        expect(canGradeAssignment(10)).toBe(false);
      });

      it('should not allow managing users', () => {
        expect(canManageUsers()).toBe(false);
      });

      it('should not allow accessing admin area', () => {
        expect(canAccessAdmin()).toBe(false);
      });

      it('should be identified as student', () => {
        expect(isStudent()).toBe(true);
        expect(isTeacher()).toBe(false);
        expect(isAdmin()).toBe(false);
      });

      it('should return student as primary role', () => {
        expect(getUserRole()).toBe('student');
      });
    });

    describe('as teacher', () => {
      beforeEach(() => {
        setMockUser({
          id: 2,
          roles: ['editingteacher'],
          capabilities: [
            CAPABILITY_VIEW_COURSE,
            CAPABILITY_EDIT_COURSE,
            CAPABILITY_GRADE_ASSIGNMENT,
          ],
        });
      });

      it('should allow viewing courses', () => {
        expect(canViewCourse(5)).toBe(true);
      });

      it('should allow editing courses', () => {
        expect(canEditCourse(5)).toBe(true);
      });

      it('should allow grading assignments', () => {
        expect(canGradeAssignment(10)).toBe(true);
      });

      it('should not allow managing users', () => {
        expect(canManageUsers()).toBe(false);
      });

      it('should not allow accessing admin area', () => {
        expect(canAccessAdmin()).toBe(false);
      });

      it('should be identified as teacher', () => {
        expect(isStudent()).toBe(false);
        expect(isTeacher()).toBe(true);
        expect(isAdmin()).toBe(false);
      });

      it('should return editingteacher as primary role', () => {
        expect(getUserRole()).toBe('editingteacher');
      });
    });

    describe('as admin', () => {
      beforeEach(() => {
        setMockUser({
          id: 3,
          roles: ['manager'],
          capabilities: [
            CAPABILITY_VIEW_COURSE,
            CAPABILITY_EDIT_COURSE,
            CAPABILITY_MANAGE_USERS,
            CAPABILITY_MANAGE_ROLES,
            CAPABILITY_VIEW_ADMIN,
          ],
        });
      });

      it('should allow viewing courses', () => {
        expect(canViewCourse(5)).toBe(true);
      });

      it('should allow editing courses', () => {
        expect(canEditCourse(5)).toBe(true);
      });

      it('should allow managing users', () => {
        expect(canManageUsers()).toBe(true);
      });

      it('should allow managing roles', () => {
        expect(canManageRoles()).toBe(true);
      });

      it('should allow accessing admin area', () => {
        expect(canAccessAdmin()).toBe(true);
      });

      it('should be identified as admin', () => {
        expect(isStudent()).toBe(false);
        expect(isTeacher()).toBe(false);
        expect(isAdmin()).toBe(true);
      });

      it('should return manager as primary role', () => {
        expect(getUserRole()).toBe('manager');
      });
    });

    describe('as guest', () => {
      beforeEach(() => {
        setMockUser({
          id: 0,
          roles: [],
          capabilities: [],
        });
      });

      it('should not allow viewing courses', () => {
        expect(canViewCourse(5)).toBe(false);
      });

      it('should not allow editing courses', () => {
        expect(canEditCourse(5)).toBe(false);
      });

      it('should not allow submitting assignments', () => {
        expect(canSubmitAssignment(10)).toBe(false);
      });

      it('should not allow grading assignments', () => {
        expect(canGradeAssignment(10)).toBe(false);
      });

      it('should not allow managing users', () => {
        expect(canManageUsers()).toBe(false);
      });

      it('should not allow accessing admin area', () => {
        expect(canAccessAdmin()).toBe(false);
      });

      it('should not be identified as any role', () => {
        expect(isStudent()).toBe(false);
        expect(isTeacher()).toBe(false);
        expect(isAdmin()).toBe(false);
      });

      it('should return null as primary role', () => {
        expect(getUserRole()).toBeNull();
      });
    });
  });
});

