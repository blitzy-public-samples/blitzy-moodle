/**
 * Unit Tests for usePermissions Hook
 *
 * Comprehensive test suite for the usePermissions custom hook that provides
 * Moodle capability-based permission checking throughout the React application.
 *
 * Tests verify:
 * - Capability checking against Moodle permission system
 * - Role-based permission checks (admin, teacher, student, guest)
 * - Multiple capability checks (any/all)
 * - Context-aware permissions
 * - Convenience permission functions
 * - Integration with Redux auth state
 * - TypeScript type safety
 * - Performance optimizations (Set usage for O(1) lookups)
 *
 * Moodle Capability System Reference:
 * - Capabilities follow format: component/feature:action
 * - Examples: 'moodle/course:view', 'mod/assign:grade', 'mod/quiz:attempt'
 * - Capabilities are granted to roles at various context levels
 * - Context hierarchy: System > Course Category > Course > Activity Module > Block
 * - Reference: public/lib/accesslib.php for complete capability system
 *
 * Important Security Note:
 * These tests verify CLIENT-SIDE permission checks for UI rendering only.
 * The backend API is the authoritative source for all authorization decisions.
 * Every API endpoint must call require_capability() to enforce permissions server-side.
 *
 * @module tests/unit/hooks/usePermissions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { RootState } from '@/app/store';
import { authReducer } from '@/features/auth/store/authSlice';
import type { User, Role, Permission } from '@/features/auth/types/auth.types';

// ============================================================================
// Test Helper Functions
// ============================================================================

/**
 * Create a Redux store wrapper for testing with custom auth state
 *
 * Provides a Redux Provider with configurable authentication state for testing
 * different user scenarios (admin, teacher, student, guest, no auth, etc.).
 *
 * @param preloadedState - Initial Redux state with custom auth data
 * @returns React component wrapping children with Redux Provider
 */
function createWrapper(preloadedState?: Partial<RootState>) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      sidebar: (state = { isOpen: false }) => state, // Minimal sidebar reducer
    },
    preloadedState: preloadedState as RootState,
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

/**
 * Helper to create a mock user with specified roles and capabilities
 *
 * @param id - User ID
 * @param roles - Array of role shortnames
 * @param capabilities - Array of capability strings (all granted by default)
 * @param contextId - Optional default contextId for capabilities
 * @returns Complete User object with roles and capabilities
 */
function createMockUser(
  id: number,
  roles: string[],
  capabilities: string[],
  contextId = 1
): User {
  const mockRoles: Role[] = roles.map((roleName, index) => ({
    id: index + 1,
    shortname: roleName,
    name: roleName.charAt(0).toUpperCase() + roleName.slice(1),
    description: `${roleName} role`,
  }));

  const mockCapabilities: Permission[] = capabilities.map((capability) => ({
    capability,
    contextId,
    granted: true,
  }));

  return {
    id,
    username: `user${id}`,
    email: `user${id}@example.com`,
    firstname: `User`,
    lastname: `${id}`,
    fullname: `User ${id}`,
    auth: 'manual',
    confirmed: true,
    suspended: false,
    roles: mockRoles,
    capabilities: mockCapabilities,
  };
}

// ============================================================================
// Mock User Data
// ============================================================================

/**
 * Mock administrator user with full system permissions
 *
 * Admin users have all capabilities across the system including:
 * - Site configuration (moodle/site:config)
 * - Course creation and management (moodle/course:create, moodle/course:update)
 * - User management (moodle/user:update)
 * - Grading permissions (mod/assign:grade)
 */
const mockAdminUser = createMockUser(
  1,
  ['admin'],
  [
    'moodle/site:config',
    'moodle/course:create',
    'moodle/course:update',
    'moodle/course:view',
    'moodle/user:update',
    'mod/assign:grade',
    'mod/quiz:grade',
  ]
);

/**
 * Mock editing teacher user with course editing and grading permissions
 *
 * Editing teachers can:
 * - View and update courses (moodle/course:view, moodle/course:update)
 * - Grade assignments and quizzes (mod/assign:grade, mod/quiz:grade)
 * - But cannot configure site settings (no moodle/site:config)
 */
const mockTeacherUser = createMockUser(
  2,
  ['editingteacher'],
  [
    'moodle/course:view',
    'moodle/course:update',
    'mod/assign:grade',
    'mod/quiz:grade',
    'mod/forum:addquestion',
  ]
);

/**
 * Mock student user with basic viewing and submission permissions
 *
 * Students can:
 * - View courses (moodle/course:view)
 * - Submit assignments (mod/assign:submit)
 * - Attempt quizzes (mod/quiz:attempt)
 * - But cannot grade or edit content
 */
const mockStudentUser = createMockUser(
  3,
  ['student'],
  [
    'moodle/course:view',
    'mod/assign:submit',
    'mod/assign:view',
    'mod/quiz:attempt',
    'mod/quiz:view',
  ]
);

/**
 * Mock guest user with read-only permissions
 *
 * Guests can only:
 * - View permitted courses (moodle/course:view)
 * - Cannot submit, edit, or participate in activities
 */
const mockGuestUser = createMockUser(4, ['guest'], ['moodle/course:view']);

/**
 * Mock user with no capabilities or roles
 *
 * Used to test edge case of user with no permissions
 */
const mockEmptyUser = createMockUser(5, [], []);

/**
 * Mock user with multiple roles
 *
 * Used to test handling of users with multiple role assignments
 */
const mockMultiRoleUser = createMockUser(
  6,
  ['teacher', 'coursecreator'],
  [
    'moodle/course:view',
    'moodle/course:create',
    'moodle/course:update',
    'mod/assign:grade',
  ]
);

// ============================================================================
// Test Suite: usePermissions Hook
// ============================================================================

describe('usePermissions', () => {
  // ==========================================================================
  // Basic Functionality Tests
  // ==========================================================================

  describe('Basic State Selection', () => {
    it('should return correct capabilities from auth state', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockAdminUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Verify capabilities Set contains all admin capabilities
      expect(result.current.capabilities).toBeInstanceOf(Set);
      expect(result.current.capabilities.has('moodle/site:config')).toBe(true);
      expect(result.current.capabilities.has('moodle/course:create')).toBe(
        true
      );
      expect(result.current.capabilities.has('moodle/course:update')).toBe(
        true
      );
      expect(result.current.capabilities.has('mod/assign:grade')).toBe(true);
    });

    it('should return empty capabilities Set when user is not authenticated', () => {
      const wrapper = createWrapper({
        auth: {
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          status: 'unauthenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.capabilities).toBeInstanceOf(Set);
      expect(result.current.capabilities.size).toBe(0);
      expect(result.current.roles).toEqual([]);
    });

    it('should return correct roles array from auth state', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockTeacherUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.roles).toEqual(['editingteacher']);
    });
  });

  // ==========================================================================
  // Single Capability Checks
  // ==========================================================================

  describe('hasCapability', () => {
    it('should return true for capabilities user has', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockTeacherUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.hasCapability('moodle/course:view')).toBe(true);
      expect(result.current.hasCapability('moodle/course:update')).toBe(true);
      expect(result.current.hasCapability('mod/assign:grade')).toBe(true);
    });

    it('should return false for capabilities user does not have', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockTeacherUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Teacher doesn't have site config permission
      expect(result.current.hasCapability('moodle/site:config')).toBe(false);
      // Teacher doesn't have user update permission
      expect(result.current.hasCapability('moodle/user:update')).toBe(false);
    });

    it('should return false when user is not authenticated', () => {
      const wrapper = createWrapper({
        auth: {
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          status: 'unauthenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.hasCapability('moodle/course:view')).toBe(false);
      expect(result.current.hasCapability('moodle/site:config')).toBe(false);
    });
  });

  // ==========================================================================
  // Multiple Capability Checks
  // ==========================================================================

  describe('hasAnyCapability', () => {
    it('should return true if user has at least one of the specified capabilities', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockStudentUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Student has mod/assign:submit but not mod/assign:grade
      expect(
        result.current.hasAnyCapability([
          'mod/assign:submit',
          'mod/assign:grade',
        ])
      ).toBe(true);
    });

    it('should return false if user has none of the specified capabilities', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockStudentUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Student has neither site config nor user update
      expect(
        result.current.hasAnyCapability([
          'moodle/site:config',
          'moodle/user:update',
        ])
      ).toBe(false);
    });

    it('should return true if user has all of the specified capabilities', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockTeacherUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Teacher has both capabilities
      expect(
        result.current.hasAnyCapability([
          'moodle/course:view',
          'moodle/course:update',
        ])
      ).toBe(true);
    });
  });

  describe('hasAllCapabilities', () => {
    it('should return true if user has all specified capabilities', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockTeacherUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Teacher has both capabilities
      expect(
        result.current.hasAllCapabilities([
          'moodle/course:view',
          'moodle/course:update',
        ])
      ).toBe(true);

      // Teacher has all three capabilities
      expect(
        result.current.hasAllCapabilities([
          'moodle/course:view',
          'moodle/course:update',
          'mod/assign:grade',
        ])
      ).toBe(true);
    });

    it('should return false if user is missing any of the specified capabilities', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockTeacherUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Teacher has moodle/course:view but not moodle/site:config
      expect(
        result.current.hasAllCapabilities([
          'moodle/course:view',
          'moodle/site:config',
        ])
      ).toBe(false);
    });

    it('should return false if user has none of the specified capabilities', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockGuestUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Guest has neither capability
      expect(
        result.current.hasAllCapabilities([
          'moodle/site:config',
          'moodle/user:update',
        ])
      ).toBe(false);
    });
  });

  // ==========================================================================
  // Role Validation Tests
  // ==========================================================================

  describe('hasRole', () => {
    it('should return true for roles the user has', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockTeacherUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.hasRole('editingteacher')).toBe(true);
    });

    it('should return false for roles the user does not have', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockTeacherUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.hasRole('admin')).toBe(false);
      expect(result.current.hasRole('student')).toBe(false);
      expect(result.current.hasRole('guest')).toBe(false);
    });

    it('should handle users with multiple roles', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockMultiRoleUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.hasRole('teacher')).toBe(true);
      expect(result.current.hasRole('coursecreator')).toBe(true);
      expect(result.current.hasRole('admin')).toBe(false);
    });
  });

  // ==========================================================================
  // Computed Role Flags
  // ==========================================================================

  describe('Computed Role Flags', () => {
    it('should identify admin role correctly', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockAdminUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isTeacher).toBe(false);
      expect(result.current.isStudent).toBe(false);
      expect(result.current.isGuest).toBe(false);
    });

    it('should identify teacher role correctly', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockTeacherUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isTeacher).toBe(true); // editingteacher counts as teacher
      expect(result.current.isStudent).toBe(false);
      expect(result.current.isGuest).toBe(false);
    });

    it('should identify student role correctly', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockStudentUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isTeacher).toBe(false);
      expect(result.current.isStudent).toBe(true);
      expect(result.current.isGuest).toBe(false);
    });

    it('should identify guest role correctly', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockGuestUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isTeacher).toBe(false);
      expect(result.current.isStudent).toBe(false);
      expect(result.current.isGuest).toBe(true);
    });

    it('should return false for all role flags when user has no roles', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockEmptyUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isTeacher).toBe(false);
      expect(result.current.isStudent).toBe(false);
      expect(result.current.isGuest).toBe(false);
    });

    it('should handle isTeacher for both teacher and editingteacher roles', () => {
      const teacherUser = createMockUser(
        7,
        ['teacher'],
        ['moodle/course:view']
      );

      const wrapper = createWrapper({
        auth: {
          user: teacherUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isTeacher).toBe(true);
    });
  });

  // ==========================================================================
  // Convenience Functions
  // ==========================================================================

  describe('Convenience Functions', () => {
    describe('canViewCourse', () => {
      it('should return true for users with moodle/course:view capability', () => {
        const wrapper = createWrapper({
          auth: {
            user: mockStudentUser,
            tokens: null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            status: 'authenticated',
          },
        });

        const { result } = renderHook(() => usePermissions(), { wrapper });

        expect(result.current.canViewCourse(123)).toBe(true);
      });

      it('should return false for users without moodle/course:view capability', () => {
        const userWithoutView = createMockUser(
          8,
          ['student'],
          ['mod/assign:submit']
        );

        const wrapper = createWrapper({
          auth: {
            user: userWithoutView,
            tokens: null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            status: 'authenticated',
          },
        });

        const { result } = renderHook(() => usePermissions(), { wrapper });

        expect(result.current.canViewCourse(123)).toBe(false);
      });
    });

    describe('canEditCourse', () => {
      it('should return true for teachers with moodle/course:update capability', () => {
        const wrapper = createWrapper({
          auth: {
            user: mockTeacherUser,
            tokens: null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            status: 'authenticated',
          },
        });

        const { result } = renderHook(() => usePermissions(), { wrapper });

        expect(result.current.canEditCourse(123)).toBe(true);
      });

      it('should return false for students without moodle/course:update capability', () => {
        const wrapper = createWrapper({
          auth: {
            user: mockStudentUser,
            tokens: null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            status: 'authenticated',
          },
        });

        const { result } = renderHook(() => usePermissions(), { wrapper });

        expect(result.current.canEditCourse(123)).toBe(false);
      });
    });

    describe('canGrade', () => {
      it('should return true for teachers with mod/assign:grade capability', () => {
        const wrapper = createWrapper({
          auth: {
            user: mockTeacherUser,
            tokens: null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            status: 'authenticated',
          },
        });

        const { result } = renderHook(() => usePermissions(), { wrapper });

        expect(result.current.canGrade(123)).toBe(true);
      });

      it('should return false for students without mod/assign:grade capability', () => {
        const wrapper = createWrapper({
          auth: {
            user: mockStudentUser,
            tokens: null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            status: 'authenticated',
          },
        });

        const { result } = renderHook(() => usePermissions(), { wrapper });

        expect(result.current.canGrade(123)).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle user with no capabilities', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockEmptyUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.capabilities.size).toBe(0);
      expect(result.current.hasCapability('moodle/course:view')).toBe(false);
      expect(
        result.current.hasAnyCapability(['moodle/course:view', 'mod/assign:grade'])
      ).toBe(false);
      expect(
        result.current.hasAllCapabilities(['moodle/course:view'])
      ).toBe(false);
    });

    it('should handle user with multiple roles correctly', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockMultiRoleUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.roles).toEqual(['teacher', 'coursecreator']);
      expect(result.current.hasRole('teacher')).toBe(true);
      expect(result.current.hasRole('coursecreator')).toBe(true);
      expect(result.current.isTeacher).toBe(true);
    });

    it('should handle empty capability arrays gracefully', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockTeacherUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Empty array should return false for hasAnyCapability
      expect(result.current.hasAnyCapability([])).toBe(false);
      // Empty array should return true for hasAllCapabilities (vacuous truth)
      expect(result.current.hasAllCapabilities([])).toBe(true);
    });
  });

  // ==========================================================================
  // Performance and Implementation Tests
  // ==========================================================================

  describe('Performance and Implementation', () => {
    it('should use Set for O(1) capability lookup performance', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockAdminUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Verify capabilities is a Set (O(1) lookup) not an Array (O(n) lookup)
      expect(result.current.capabilities).toBeInstanceOf(Set);

      // Verify Set.has() method is available and works
      expect(typeof result.current.capabilities.has).toBe('function');
      expect(result.current.capabilities.has('moodle/site:config')).toBe(true);
    });

    it('should memoize computed role flags to prevent unnecessary recalculations', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockTeacherUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result, rerender } = renderHook(() => usePermissions(), {
        wrapper,
      });

      const firstIsTeacher = result.current.isTeacher;
      const firstCapabilities = result.current.capabilities;

      // Force re-render
      rerender();

      // Verify values remain stable (same reference due to memoization)
      expect(result.current.isTeacher).toBe(firstIsTeacher);
      expect(result.current.capabilities).toBe(firstCapabilities);
    });
  });

  // ==========================================================================
  // Context-Aware Permissions Tests
  // ==========================================================================

  describe('Context-Aware Permissions', () => {
    it('should check capability with specific contextId when provided', () => {
      // Create user with context-specific capabilities
      const userWithContextCapabilities = createMockUser(
        9,
        ['editingteacher'],
        []
      );

      // Add capabilities with different contexts
      userWithContextCapabilities.capabilities = [
        {
          capability: 'moodle/course:update',
          contextId: 5, // Can update course 5
          granted: true,
        },
        {
          capability: 'moodle/course:update',
          contextId: 10, // Can update course 10
          granted: true,
        },
        {
          capability: 'moodle/course:view',
          contextId: 5, // Can view course 5
          granted: true,
        },
      ];

      const wrapper = createWrapper({
        auth: {
          user: userWithContextCapabilities,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Should find capability in correct context
      expect(
        result.current.hasCapability('moodle/course:update', 5)
      ).toBe(true);
      expect(
        result.current.hasCapability('moodle/course:update', 10)
      ).toBe(true);

      // Should NOT find capability in wrong context
      expect(
        result.current.hasCapability('moodle/course:update', 15)
      ).toBe(false);

      // Should find view capability in correct context
      expect(
        result.current.hasCapability('moodle/course:view', 5)
      ).toBe(true);

      // Should NOT find view capability in wrong context
      expect(
        result.current.hasCapability('moodle/course:view', 10)
      ).toBe(false);
    });

    it('should check capability without contextId (system-wide) when contextId not provided', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockAdminUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Without contextId, should check if capability exists anywhere
      expect(result.current.hasCapability('moodle/site:config')).toBe(true);
      expect(result.current.hasCapability('moodle/course:create')).toBe(true);
    });

    it('should support context-aware checks in hasAnyCapability and hasAllCapabilities', () => {
      const userWithContextCapabilities = createMockUser(
        10,
        ['editingteacher'],
        []
      );

      userWithContextCapabilities.capabilities = [
        {
          capability: 'moodle/course:update',
          contextId: 5,
          granted: true,
        },
        {
          capability: 'mod/assign:grade',
          contextId: 5,
          granted: true,
        },
      ];

      const wrapper = createWrapper({
        auth: {
          user: userWithContextCapabilities,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // hasAnyCapability with correct context
      expect(
        result.current.hasAnyCapability(
          ['moodle/course:update', 'mod/assign:grade'],
          5
        )
      ).toBe(true);

      // hasAllCapabilities with correct context
      expect(
        result.current.hasAllCapabilities(
          ['moodle/course:update', 'mod/assign:grade'],
          5
        )
      ).toBe(true);

      // hasAnyCapability with wrong context
      expect(
        result.current.hasAnyCapability(
          ['moodle/course:update', 'mod/assign:grade'],
          10
        )
      ).toBe(false);
    });
  });

  // ==========================================================================
  // TypeScript Type Safety Tests
  // ==========================================================================

  describe('TypeScript Type Safety', () => {
    it('should enforce correct types for all return values', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockTeacherUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Verify function types
      expect(typeof result.current.hasCapability).toBe('function');
      expect(typeof result.current.hasAnyCapability).toBe('function');
      expect(typeof result.current.hasAllCapabilities).toBe('function');
      expect(typeof result.current.hasRole).toBe('function');
      expect(typeof result.current.canViewCourse).toBe('function');
      expect(typeof result.current.canEditCourse).toBe('function');
      expect(typeof result.current.canGrade).toBe('function');

      // Verify boolean types
      expect(typeof result.current.isAdmin).toBe('boolean');
      expect(typeof result.current.isTeacher).toBe('boolean');
      expect(typeof result.current.isStudent).toBe('boolean');
      expect(typeof result.current.isGuest).toBe('boolean');

      // Verify Set and Array types
      expect(result.current.capabilities).toBeInstanceOf(Set);
      expect(Array.isArray(result.current.roles)).toBe(true);
    });

    it('should accept capability strings and role strings as parameters', () => {
      const wrapper = createWrapper({
        auth: {
          user: mockTeacherUser,
          tokens: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          status: 'authenticated',
        },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // TypeScript should allow these calls with string literals
      const capabilityCheck = result.current.hasCapability('moodle/course:view');
      const roleCheck = result.current.hasRole('editingteacher');

      expect(typeof capabilityCheck).toBe('boolean');
      expect(typeof roleCheck).toBe('boolean');
    });
  });
});
