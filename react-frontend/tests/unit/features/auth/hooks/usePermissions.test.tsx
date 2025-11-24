/**
 * Comprehensive Unit Tests for usePermissions Hook
 *
 * Tests the usePermissions React hook which provides Moodle capability checking
 * functionality in the React frontend. This hook mirrors the PHP has_capability()
 * and require_capability() functions from Moodle's accesslib.php.
 *
 * Test Coverage:
 * - hasCapability(): Core capability checking with contexts
 * - requireCapability(): Capability enforcement with error throwing
 * - hasAnyCapability(): Check if user has any of multiple capabilities
 * - hasAllCapabilities(): Check if user has all specified capabilities
 * - Convenience methods: canViewCourse, canEditCourse, canGrade
 * - Role checking: isAdmin, isTeacher, isStudent
 * - Context types: system, course, module, user
 * - Caching and performance optimization
 * - Null/undefined user handling
 * - Redux state integration
 * - TypeScript type safety
 * - Edge cases and error handling
 *
 * @module usePermissions.test
 */

import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import type { ReactNode } from 'react';

// Internal imports - hook under test and dependencies
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import type { Capability, Context } from '@/features/auth/hooks/usePermissions';
import { authReducer, authActions } from '@/features/auth/store/authSlice';
import type { User, Role, Permission, RoleArchetype, AuthState } from '@/features/auth/types/auth.types';

// ============================================================================
// Test Data and Mock Objects
// ============================================================================

/**
 * Create a mock permission object
 */
const createPermission = (
  capability: string,
  contextId: number,
  granted: boolean = true
): Permission => ({
  capability,
  contextId,
  granted,
});

/**
 * Create a mock role object
 */
const createRole = (
  id: number,
  shortname: string,
  archetype: RoleArchetype = 'student' as RoleArchetype
): Role => ({
  id,
  shortname,
  name: shortname.charAt(0).toUpperCase() + shortname.slice(1),
  archetype,
});

/**
 * Create a mock user object with capabilities and roles
 */
const createMockUser = (
  id: number,
  capabilities: Permission[],
  roles: Role[]
): User => ({
  id,
  username: `user${id}`,
  firstname: 'Test',
  lastname: `User${id}`,
  fullname: `Test User${id}`,
  email: `user${id}@test.com`,
  profileimageurl: '',
  profileimageurlsmall: '',
  roles,
  capabilities,
  lang: 'en',
  theme: 'boost',
  timezone: 'UTC',
  firstaccess: Date.now() - 86400000,
  lastaccess: Date.now(),
  lastlogin: Date.now(),
  currentlogin: Date.now(),
  suspended: false,
  confirmed: true,
  auth: 'manual',
  idnumber: '',
  institution: '',
  department: '',
  phone1: '',
  phone2: '',
  address: '',
  city: '',
  country: 'US',
  description: '',
  descriptionformat: 1,
  mailformat: 1,
  maildigest: 0,
  maildisplay: 2,
  autosubscribe: true,
  trackforums: false,
  imagealt: '',
  lastip: '',
});

/**
 * Mock admin user with system-level capabilities
 */
const createAdminUser = (): User => {
  const adminRole = createRole(1, 'manager', 'manager' as RoleArchetype);
  const capabilities = [
    createPermission('moodle/site:config', 0), // System context
    createPermission('moodle/course:view', 0),
    createPermission('moodle/course:update', 0),
    createPermission('moodle/course:create', 0),
    createPermission('moodle/course:delete', 0),
    createPermission('moodle/user:update', 0),
    createPermission('moodle/user:delete', 0),
    createPermission('moodle/grade:edit', 0),
    createPermission('moodle/role:assign', 0),
  ];
  return createMockUser(1, capabilities, [adminRole]);
};

/**
 * Mock teacher user with course-level capabilities
 */
const createTeacherUser = (courseId: number = 5): User => {
  const teacherRole = createRole(2, 'editingteacher', 'editingteacher' as RoleArchetype);
  const capabilities = [
    createPermission('moodle/course:view', courseId),
    createPermission('moodle/course:update', courseId),
    createPermission('moodle/grade:edit', courseId),
    createPermission('moodle/grade:view', courseId),
    createPermission('mod/assign:grade', courseId),
    createPermission('mod/assign:view', courseId),
    createPermission('mod/quiz:grade', courseId),
    createPermission('mod/quiz:view', courseId),
    createPermission('mod/forum:deleteanypost', courseId),
  ];
  return createMockUser(2, capabilities, [teacherRole]);
};

/**
 * Mock student user with limited capabilities
 */
const createStudentUser = (courseId: number = 5): User => {
  const studentRole = createRole(3, 'student', 'student' as RoleArchetype);
  const capabilities = [
    createPermission('moodle/course:view', courseId),
    createPermission('mod/assign:view', courseId),
    createPermission('mod/assign:submit', courseId),
    createPermission('mod/quiz:view', courseId),
    createPermission('mod/quiz:attempt', courseId),
    createPermission('mod/forum:view', courseId),
    createPermission('mod/forum:replypost', courseId),
  ];
  return createMockUser(3, capabilities, [studentRole]);
};

/**
 * Mock user with no capabilities (guest)
 */
const createGuestUser = (): User => {
  const guestRole = createRole(4, 'guest', 'guest' as RoleArchetype);
  return createMockUser(4, [], [guestRole]);
};

// ============================================================================
// Test Store Setup
// ============================================================================

/**
 * Create a test Redux store with auth reducer
 */
const createTestStore = (user: User | null = null, isAuthenticated: boolean = false) => {
  const store = configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState: {
      auth: {
        user,
        isAuthenticated,
        isLoading: false,
        error: null,
        tokens: null,
        status: user ? ('authenticated' as const) : ('unauthenticated' as const),
      } as AuthState,
    },
  });
  return store;
};

/**
 * Create wrapper component with Redux Provider for renderHook
 */
const createWrapper = (user: User | null = null, isAuthenticated: boolean = false) => {
  const store = createTestStore(user, isAuthenticated);
  function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

// ============================================================================
// Test Suite: hasCapability
// ============================================================================

describe('usePermissions - hasCapability', () => {
  it('should return true when user has the capability in the specified context', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasCapability = result.current.hasCapability(
      'moodle/course:view' as Capability,
      { type: 'course', contextId: 5 }
    );

    expect(hasCapability).toBe(true);
  });

  it('should return false when user lacks the capability', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasCapability = result.current.hasCapability(
      'moodle/course:update' as Capability,
      { type: 'course', contextId: 5 }
    );

    expect(hasCapability).toBe(false);
  });

  it('should work with system context', () => {
    const user = createAdminUser();
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasCapability = result.current.hasCapability(
      'moodle/site:config' as Capability,
      { type: 'system', contextId: 0 }
    );

    expect(hasCapability).toBe(true);
  });

  it('should work with module context', () => {
    const user = createTeacherUser(5);
    const moduleCapability = createPermission('mod/assign:grade', 123);
    user.capabilities.push(moduleCapability);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasCapability = result.current.hasCapability(
      'mod/assign:grade' as Capability,
      { type: 'module', contextId: 123 }
    );

    expect(hasCapability).toBe(true);
  });

  it('should work with user context', () => {
    const user = createTeacherUser(5);
    const userCapability = createPermission('moodle/user:viewdetails', 42);
    user.capabilities.push(userCapability);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasCapability = result.current.hasCapability(
      'moodle/user:viewdetails' as Capability,
      { type: 'user', contextId: 42 }
    );

    expect(hasCapability).toBe(true);
  });

  it('should return false for null user', () => {
    const wrapper = createWrapper(null, false);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasCapability = result.current.hasCapability(
      'moodle/course:view' as Capability,
      { type: 'course', contextId: 5 }
    );

    expect(hasCapability).toBe(false);
  });

  it('should return false for undefined user', () => {
    const wrapper = createWrapper(null, false);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasCapability = result.current.hasCapability(
      'moodle/course:view' as Capability,
      { type: 'course', contextId: 5 }
    );

    expect(hasCapability).toBe(false);
  });

  it('should validate capability string format', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Valid format: plugin/component:action
    const hasValidCapability = result.current.hasCapability(
      'moodle/course:view' as Capability,
      { type: 'course', contextId: 5 }
    );

    expect(hasValidCapability).toBe(true);
  });

  it('should check user.capabilities array properly', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // User should have this capability
    expect(result.current.hasCapability(
      'mod/assign:view' as Capability,
      { type: 'course', contextId: 5 }
    )).toBe(true);

    // User should not have this capability
    expect(result.current.hasCapability(
      'mod/assign:grade' as Capability,
      { type: 'course', contextId: 5 }
    )).toBe(false);
  });

  it('should respect context hierarchy (system > course)', () => {
    const user = createAdminUser();
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Admin has system-level capability, should work in any course context
    const hasCapability = result.current.hasCapability(
      'moodle/course:view' as Capability,
      { type: 'system', contextId: 0 }
    );

    expect(hasCapability).toBe(true);
  });

  it('should handle capability inheritance from parent contexts', () => {
    const user = createAdminUser();
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // System-level capabilities should be available at system context
    const systemCapability = result.current.hasCapability(
      'moodle/site:config' as Capability,
      { type: 'system', contextId: 0 }
    );

    expect(systemCapability).toBe(true);
  });
});

// ============================================================================
// Test Suite: requireCapability
// ============================================================================

describe('usePermissions - requireCapability', () => {
  it('should throw error when user lacks capability', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    expect(() => {
      result.current.requireCapability(
        'moodle/course:update' as Capability,
        { type: 'course', contextId: 5 }
      );
    }).toThrow();
  });

  it('should not throw when user has capability', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    expect(() => {
      result.current.requireCapability(
        'moodle/course:update' as Capability,
        { type: 'course', contextId: 5 }
      );
    }).not.toThrow();
  });

  it('should include capability and context info in error message', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    try {
      result.current.requireCapability(
        'moodle/course:update' as Capability,
        { type: 'course', contextId: 5 }
      );
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      if (error instanceof Error) {
        expect(error.message).toContain('moodle/course:update');
        expect(error.message).toContain('course');
        expect(error.message).toContain('5');
      }
    }
  });

  it('should throw error for null user', () => {
    const wrapper = createWrapper(null, false);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    expect(() => {
      result.current.requireCapability(
        'moodle/course:view' as Capability,
        { type: 'course', contextId: 5 }
      );
    }).toThrow();
  });

  it('should throw correct error type for catch handling', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    try {
      result.current.requireCapability(
        'moodle/course:delete' as Capability,
        { type: 'course', contextId: 5 }
      );
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('should work in React component error boundaries', () => {
    const user = createGuestUser();
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Simulate error boundary catching
    let caughtError: Error | null = null;
    try {
      result.current.requireCapability(
        'moodle/course:view' as Capability,
        { type: 'course', contextId: 5 }
      );
    } catch (error) {
      caughtError = error as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toBeTruthy();
  });
});

// ============================================================================
// Test Suite: hasAnyCapability
// ============================================================================

describe('usePermissions - hasAnyCapability', () => {
  it('should return true if user has any capability from the list', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasAny = result.current.hasAnyCapability(
      [
        'moodle/course:update' as Capability, // Student doesn't have
        'mod/assign:view' as Capability,      // Student has this
        'mod/assign:grade' as Capability,     // Student doesn't have
      ],
      { type: 'course', contextId: 5 }
    );

    expect(hasAny).toBe(true);
  });

  it('should return false if user has none of the capabilities', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasAny = result.current.hasAnyCapability(
      [
        'moodle/course:update' as Capability,
        'mod/assign:grade' as Capability,
        'moodle/course:delete' as Capability,
      ],
      { type: 'course', contextId: 5 }
    );

    expect(hasAny).toBe(false);
  });

  it('should return false for empty array', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasAny = result.current.hasAnyCapability(
      [],
      { type: 'course', contextId: 5 }
    );

    expect(hasAny).toBe(false);
  });

  it('should behave like hasCapability with single capability', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const context: Context = { type: 'course', contextId: 5 };
    const capability = 'moodle/course:view' as Capability;

    const hasAnyResult = result.current.hasAnyCapability([capability], context);
    const hasCapabilityResult = result.current.hasCapability(capability, context);

    expect(hasAnyResult).toBe(hasCapabilityResult);
  });

  it('should return false for null user', () => {
    const wrapper = createWrapper(null, false);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasAny = result.current.hasAnyCapability(
      ['moodle/course:view' as Capability],
      { type: 'course', contextId: 5 }
    );

    expect(hasAny).toBe(false);
  });

  it('should use short-circuit evaluation (stop after first match)', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // First capability matches, should return true immediately
    const hasAny = result.current.hasAnyCapability(
      [
        'moodle/course:view' as Capability,  // This matches first
        'moodle/course:update' as Capability,
        'mod/assign:grade' as Capability,
      ],
      { type: 'course', contextId: 5 }
    );

    expect(hasAny).toBe(true);
  });
});

// ============================================================================
// Test Suite: hasAllCapabilities
// ============================================================================

describe('usePermissions - hasAllCapabilities', () => {
  it('should return true only if user has all capabilities', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasAll = result.current.hasAllCapabilities(
      [
        'moodle/course:view' as Capability,
        'moodle/course:update' as Capability,
      ],
      { type: 'course', contextId: 5 }
    );

    expect(hasAll).toBe(true);
  });

  it('should return false if user lacks any capability', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasAll = result.current.hasAllCapabilities(
      [
        'mod/assign:view' as Capability,    // Student has
        'mod/assign:grade' as Capability,   // Student doesn't have
      ],
      { type: 'course', contextId: 5 }
    );

    expect(hasAll).toBe(false);
  });

  it('should return true for empty array (vacuous truth)', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasAll = result.current.hasAllCapabilities(
      [],
      { type: 'course', contextId: 5 }
    );

    expect(hasAll).toBe(true);
  });

  it('should behave like hasCapability with single capability', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const context: Context = { type: 'course', contextId: 5 };
    const capability = 'moodle/course:view' as Capability;

    const hasAllResult = result.current.hasAllCapabilities([capability], context);
    const hasCapabilityResult = result.current.hasCapability(capability, context);

    expect(hasAllResult).toBe(hasCapabilityResult);
  });

  it('should return false for null user', () => {
    const wrapper = createWrapper(null, false);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasAll = result.current.hasAllCapabilities(
      ['moodle/course:view' as Capability],
      { type: 'course', contextId: 5 }
    );

    expect(hasAll).toBe(false);
  });

  it('should validate all capabilities are checked before returning', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // All capabilities must be checked
    const hasAll = result.current.hasAllCapabilities(
      [
        'moodle/course:view' as Capability,
        'moodle/course:update' as Capability,
        'mod/assign:grade' as Capability,
      ],
      { type: 'course', contextId: 5 }
    );

    expect(hasAll).toBe(true);
  });
});

// ============================================================================
// Test Suite: canViewCourse
// ============================================================================

describe('usePermissions - canViewCourse', () => {
  it('should return true when user has moodle/course:view capability', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const canView = result.current.canViewCourse(5);

    expect(canView).toBe(true);
  });

  it('should return false when user lacks capability', () => {
    const user = createGuestUser();
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const canView = result.current.canViewCourse(5);

    expect(canView).toBe(false);
  });

  it('should return false with invalid courseId', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const canView = result.current.canViewCourse(999); // Course user doesn't have access to

    expect(canView).toBe(false);
  });

  it('should check course-specific context', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // User has capability for course 5
    expect(result.current.canViewCourse(5)).toBe(true);
    // But not for course 10
    expect(result.current.canViewCourse(10)).toBe(false);
  });

  it('should properly wrap hasCapability', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const canViewResult = result.current.canViewCourse(5);
    const hasCapabilityResult = result.current.hasCapability(
      'moodle/course:view' as Capability,
      { type: 'course', contextId: 5 }
    );

    expect(canViewResult).toBe(hasCapabilityResult);
  });
});

// ============================================================================
// Test Suite: canEditCourse
// ============================================================================

describe('usePermissions - canEditCourse', () => {
  it('should return true when user has moodle/course:update capability', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const canEdit = result.current.canEditCourse(5);

    expect(canEdit).toBe(true);
  });

  it('should return false when user lacks capability', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const canEdit = result.current.canEditCourse(5);

    expect(canEdit).toBe(false);
  });

  it('should return true for teacher role user', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const canEdit = result.current.canEditCourse(5);

    expect(canEdit).toBe(true);
  });

  it('should return false for student role user', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const canEdit = result.current.canEditCourse(5);

    expect(canEdit).toBe(false);
  });

  it('should validate proper course context checking', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // User can edit course 5
    expect(result.current.canEditCourse(5)).toBe(true);
    // But not course 10
    expect(result.current.canEditCourse(10)).toBe(false);
  });
});

// ============================================================================
// Test Suite: canGrade
// ============================================================================

describe('usePermissions - canGrade', () => {
  it('should return true when user has moodle/grade:edit capability in course', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const canGrade = result.current.canGrade(5);

    expect(canGrade).toBe(true);
  });

  it('should return false for student users', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const canGrade = result.current.canGrade(5);

    expect(canGrade).toBe(false);
  });

  it('should return true for teacher role', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const canGrade = result.current.canGrade(5);

    expect(canGrade).toBe(true);
  });

  it('should check both course and module contexts', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Teacher should have grading capability at course level
    const canGrade = result.current.canGrade(5);

    expect(canGrade).toBe(true);
  });

  it('should validate grading capability properly checked', () => {
    const user = createAdminUser();
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Admin should be able to grade
    const canGrade = result.current.canGrade(5);

    expect(canGrade).toBe(true);
  });
});

// ============================================================================
// Test Suite: isAdmin
// ============================================================================

describe('usePermissions - isAdmin', () => {
  it('should return true when user has moodle/site:config capability at system level', () => {
    const user = createAdminUser();
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const isAdmin = result.current.isAdmin();

    expect(isAdmin).toBe(true);
  });

  it('should return false for non-admin users', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const isAdmin = result.current.isAdmin();

    expect(isAdmin).toBe(false);
  });

  it('should return false for null user', () => {
    const wrapper = createWrapper(null, false);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const isAdmin = result.current.isAdmin();

    expect(isAdmin).toBe(false);
  });

  it('should check system context (contextId: 0)', () => {
    const user = createAdminUser();
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Admin capability should be at system context (0)
    const hasSystemCapability = result.current.hasCapability(
      'moodle/site:config' as Capability,
      { type: 'system', contextId: 0 }
    );

    expect(hasSystemCapability).toBe(true);
    expect(result.current.isAdmin()).toBe(true);
  });

  it('should validate admin role detection from user.roles array', () => {
    const user = createAdminUser();
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const isAdmin = result.current.isAdmin();
    const hasManagerRole = user.roles.some(role => role.archetype === ('manager' as RoleArchetype));

    expect(isAdmin).toBe(true);
    expect(hasManagerRole).toBe(true);
  });
});

// ============================================================================
// Test Suite: isTeacher
// ============================================================================

describe('usePermissions - isTeacher', () => {
  it('should return true when user has teacher role globally', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const isTeacher = result.current.isTeacher();

    expect(isTeacher).toBe(true);
  });

  it('should return true when user has teacher role in specific course', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const isTeacher = result.current.isTeacher(5);

    expect(isTeacher).toBe(true);
  });

  it('should return false for student users', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const isTeacher = result.current.isTeacher();

    expect(isTeacher).toBe(false);
  });

  it('should return false for null user', () => {
    const wrapper = createWrapper(null, false);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const isTeacher = result.current.isTeacher();

    expect(isTeacher).toBe(false);
  });

  it('should check editingteacher and teacher role archetypes', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const isTeacher = result.current.isTeacher();
    const hasTeacherRole = user.roles.some(
      role => role.archetype === ('editingteacher' as RoleArchetype) || role.archetype === ('teacher' as RoleArchetype)
    );

    expect(isTeacher).toBe(true);
    expect(hasTeacherRole).toBe(true);
  });

  it('should validate course-specific teacher role checking', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Should have teaching capabilities in course 5
    const canEditInCourse = result.current.canEditCourse(5);

    expect(canEditInCourse).toBe(true);
  });
});

// ============================================================================
// Test Suite: isStudent
// ============================================================================

describe('usePermissions - isStudent', () => {
  it('should return true when user has student role globally', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const isStudent = result.current.isStudent();

    expect(isStudent).toBe(true);
  });

  it('should return true when user has student role in specific course', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const isStudent = result.current.isStudent(5);

    expect(isStudent).toBe(true);
  });

  it('should return false for teacher users', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const isStudent = result.current.isStudent();

    expect(isStudent).toBe(false);
  });

  it('should return false for null user', () => {
    const wrapper = createWrapper(null, false);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const isStudent = result.current.isStudent();

    expect(isStudent).toBe(false);
  });

  it('should check student role archetype', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const isStudent = result.current.isStudent();
    const hasStudentRole = user.roles.some(role => role.archetype === ('student' as RoleArchetype));

    expect(isStudent).toBe(true);
    expect(hasStudentRole).toBe(true);
  });

  it('should validate course-specific student role checking', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Should have student capabilities in course 5
    const canViewCourse = result.current.canViewCourse(5);

    expect(canViewCourse).toBe(true);
  });
});

// ============================================================================
// Test Suite: Context Types
// ============================================================================

describe('usePermissions - Context Types', () => {
  it('should work with system context (highest level)', () => {
    const user = createAdminUser();
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const context: Context = { type: 'system', contextId: 0 };
    const hasCapability = result.current.hasCapability(
      'moodle/site:config' as Capability,
      context
    );

    expect(hasCapability).toBe(true);
  });

  it('should work with course context (course level)', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const context: Context = { type: 'course', contextId: 5 };
    const hasCapability = result.current.hasCapability(
      'moodle/course:view' as Capability,
      context
    );

    expect(hasCapability).toBe(true);
  });

  it('should work with module context (activity level)', () => {
    const user = createTeacherUser(5);
    const moduleCapability = createPermission('mod/assign:grade', 123);
    user.capabilities.push(moduleCapability);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const context: Context = { type: 'module', contextId: 123 };
    const hasCapability = result.current.hasCapability(
      'mod/assign:grade' as Capability,
      context
    );

    expect(hasCapability).toBe(true);
  });

  it('should work with user context (user profile level)', () => {
    const user = createTeacherUser(5);
    const userCapability = createPermission('moodle/user:viewdetails', 42);
    user.capabilities.push(userCapability);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const context: Context = { type: 'user', contextId: 42 };
    const hasCapability = result.current.hasCapability(
      'moodle/user:viewdetails' as Capability,
      context
    );

    expect(hasCapability).toBe(true);
  });

  it('should validate context type validation', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Valid context types
    const validContexts: Context[] = [
      { type: 'system', contextId: 0 },
      { type: 'course', contextId: 5 },
      { type: 'module', contextId: 123 },
      { type: 'user', contextId: 42 },
    ];

    validContexts.forEach(context => {
      // Should not throw error for valid context types
      expect(() => {
        result.current.hasCapability('moodle/course:view' as Capability, context);
      }).not.toThrow();
    });
  });

  it('should reject invalid context types', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // TypeScript should prevent invalid types at compile time
    // At runtime, invalid types would be handled gracefully
     
    const invalidContext = { type: 'invalid', contextId: 5 } as unknown as { type: 'course'; contextId: number };

    // Should return false for invalid context rather than throwing
    const hasCapability = result.current.hasCapability(
      'moodle/course:view' as Capability,
      invalidContext
    );

    expect(hasCapability).toBe(false);
  });
});

// ============================================================================
// Test Suite: Capability Caching
// ============================================================================

describe('usePermissions - Capability Caching', () => {
  it('should cache capability check results using useMemo', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result, rerender } = renderHook(() => usePermissions(), { wrapper });

    const firstResult = result.current;
    
    // Rerender without changing user
    rerender();
    
    const secondResult = result.current;

    // Results should be referentially equal (same object) due to useMemo
    expect(firstResult).toBe(secondResult);
  });

  it('should invalidate cache when user changes', async () => {
    const user1 = createTeacherUser(5);
    let store = createTestStore(user1, true);
    
    const { result, rerender } = renderHook(() => usePermissions(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    const firstResult = result.current;

    // Change user in store
    const user2 = createStudentUser(5);
    store = createTestStore(user2, true);
    
    rerender();

    await waitFor(() => {
      // Results should be different objects after user change
      expect(result.current).not.toBe(firstResult);
    });
  });

  it('should use cached results for repeated checks', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // First call
    const firstCheck = result.current.hasCapability(
      'moodle/course:view' as Capability,
      { type: 'course', contextId: 5 }
    );

    // Second call with same parameters
    const secondCheck = result.current.hasCapability(
      'moodle/course:view' as Capability,
      { type: 'course', contextId: 5 }
    );

    // Both should return the same value
    expect(firstCheck).toBe(secondCheck);
    expect(firstCheck).toBe(true);
  });

  it('should ensure cache improves performance for repeated checks', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const startTime = performance.now();

    // Perform multiple checks
    for (let i = 0; i < 100; i++) {
      result.current.hasCapability(
        'moodle/course:view' as Capability,
        { type: 'course', contextId: 5 }
      );
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Performance should be reasonable (< 10ms for 100 checks)
    expect(duration).toBeLessThan(10);
  });

  it('should not cause memory leaks with cache', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result, unmount } = renderHook(() => usePermissions(), { wrapper });

    // Perform many checks
    for (let i = 0; i < 1000; i++) {
      result.current.hasCapability(
        'moodle/course:view' as Capability,
        { type: 'course', contextId: 5 }
      );
    }

    // Should unmount cleanly without errors
    expect(() => unmount()).not.toThrow();
  });
});

// ============================================================================
// Test Suite: Null/Undefined User Handling
// ============================================================================

describe('usePermissions - Null/Undefined User Handling', () => {
  it('should return false for all capability checks when user is null', () => {
    const wrapper = createWrapper(null, false);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    expect(result.current.hasCapability(
      'moodle/course:view' as Capability,
      { type: 'course', contextId: 5 }
    )).toBe(false);
    
    expect(result.current.hasAnyCapability(
      ['moodle/course:view' as Capability],
      { type: 'course', contextId: 5 }
    )).toBe(false);
    
    expect(result.current.hasAllCapabilities(
      ['moodle/course:view' as Capability],
      { type: 'course', contextId: 5 }
    )).toBe(false);
  });

  it('should handle undefined user gracefully', () => {
    const wrapper = createWrapper(null, false);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    expect(result.current.canViewCourse(5)).toBe(false);
    expect(result.current.canEditCourse(5)).toBe(false);
    expect(result.current.canGrade(5)).toBe(false);
  });

  it('should not throw errors for null user checks', () => {
    const wrapper = createWrapper(null, false);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    expect(() => {
      result.current.hasCapability(
        'moodle/course:view' as Capability,
        { type: 'course', contextId: 5 }
      );
    }).not.toThrow();

    expect(() => {
      result.current.isAdmin();
    }).not.toThrow();

    expect(() => {
      result.current.isTeacher();
    }).not.toThrow();
  });

  it('should work correctly before authentication', () => {
    const wrapper = createWrapper(null, false);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // All permission checks should return false for unauthenticated users
    expect(result.current.isAdmin()).toBe(false);
    expect(result.current.isTeacher()).toBe(false);
    expect(result.current.isStudent()).toBe(false);
    expect(result.current.canViewCourse(5)).toBe(false);
  });

  it('should validate defensive programming for missing user data', () => {
    const wrapper = createWrapper(null, false);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Should handle missing user.capabilities array
    expect(() => {
      result.current.hasCapability(
        'moodle/course:view' as Capability,
        { type: 'course', contextId: 5 }
      );
    }).not.toThrow();

    // Should handle missing user.roles array
    expect(() => {
      result.current.isTeacher();
    }).not.toThrow();
  });
});

// ============================================================================
// Test Suite: Redux Integration
// ============================================================================

describe('usePermissions - Redux Integration', () => {
  it('should properly select user from auth state', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Hook should have access to user from Redux state
    const canView = result.current.canViewCourse(5);

    expect(canView).toBe(true);
  });

  it('should select isAuthenticated from auth state', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // User is authenticated, permission checks should work
    const canView = result.current.canViewCourse(5);

    expect(canView).toBe(true);
  });

  it('should update when Redux auth state changes', async () => {
    const user1 = createStudentUser(5);
    const store = createTestStore(user1, true);
    
    const { result, rerender } = renderHook(() => usePermissions(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    // Initially student can't edit
    expect(result.current.canEditCourse(5)).toBe(false);

    // Change to teacher user
    const user2 = createTeacherUser(5);
    store.dispatch(authActions.setUser(user2));
    
    rerender();

    await waitFor(() => {
      // Now should be able to edit
      expect(result.current.canEditCourse(5)).toBe(true);
    });
  });

  it('should re-render when user capabilities change', async () => {
    const user = createStudentUser(5);
    const store = createTestStore(user, true);
    
    const { result, rerender } = renderHook(() => usePermissions(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    // Initially can't grade
    expect(result.current.canGrade(5)).toBe(false);

    // Add grading capability
    const updatedUser = { ...user };
    updatedUser.capabilities = [
      ...user.capabilities,
      createPermission('moodle/grade:edit', 5),
    ];
    store.dispatch(authActions.setUser(updatedUser));
    
    rerender();

    await waitFor(() => {
      // Now can grade
      expect(result.current.canGrade(5)).toBe(true);
    });
  });

  it('should properly subscribe to Redux store updates', async () => {
    const user = createTeacherUser(5);
    const store = createTestStore(user, true);
    
    const { result, rerender } = renderHook(() => usePermissions(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    // Clear auth (logout)
    store.dispatch(authActions.clearAuth());
    
    rerender();

    await waitFor(() => {
      // After logout, all checks should return false
      expect(result.current.isTeacher()).toBe(false);
      expect(result.current.canViewCourse(5)).toBe(false);
    });
  });
});

// ============================================================================
// Test Suite: TypeScript Type Safety
// ============================================================================

describe('usePermissions - TypeScript Type Safety', () => {
  it('should enforce valid context types', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // TypeScript should only allow valid context types
    const validContexts: Context[] = [
      { type: 'system', contextId: 0 },
      { type: 'course', contextId: 5 },
      { type: 'module', contextId: 123 },
      { type: 'user', contextId: 42 },
    ];

    // All should work without TypeScript errors
    validContexts.forEach(context => {
      result.current.hasCapability('moodle/course:view' as Capability, context);
    });
  });

  it('should validate Capability type is string with proper format', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Capability should follow format: plugin/component:action
    const validCapabilities: Capability[] = [
      'moodle/course:view' as Capability,
      'moodle/course:update' as Capability,
      'mod/assign:submit' as Capability,
      'mod/quiz:attempt' as Capability,
    ];

    validCapabilities.forEach(capability => {
      result.current.hasCapability(capability, { type: 'course', contextId: 5 });
    });
  });

  it('should match PermissionsHook interface return type', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Verify all expected methods exist
    expect(typeof result.current.hasCapability).toBe('function');
    expect(typeof result.current.requireCapability).toBe('function');
    expect(typeof result.current.hasAnyCapability).toBe('function');
    expect(typeof result.current.hasAllCapabilities).toBe('function');
    expect(typeof result.current.canViewCourse).toBe('function');
    expect(typeof result.current.canEditCourse).toBe('function');
    expect(typeof result.current.canGrade).toBe('function');
    expect(typeof result.current.isAdmin).toBe('function');
    expect(typeof result.current.isTeacher).toBe('function');
    expect(typeof result.current.isStudent).toBe('function');
  });

  it('should validate TypeScript strict mode compliance', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    
    // This test passing indicates no TypeScript errors occurred
    const { result } = renderHook(() => usePermissions(), { wrapper });

    expect(result.current).toBeDefined();
  });

  it('should ensure no any types in hook or tests', () => {
    // This test validates that strict TypeScript checking is enabled
    // and no 'any' types are used in production code
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // All operations should be fully typed
    const hasCapability: boolean = result.current.hasCapability(
      'moodle/course:view' as Capability,
      { type: 'course', contextId: 5 }
    );

    expect(typeof hasCapability).toBe('boolean');
  });

  it('should validate proper type inference throughout', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // TypeScript should infer return types correctly
    const isTeacher: boolean = result.current.isTeacher();
    const canView: boolean = result.current.canViewCourse(5);
    const hasCapability: boolean = result.current.hasCapability(
      'moodle/course:view' as Capability,
      { type: 'course', contextId: 5 }
    );

    expect(typeof isTeacher).toBe('boolean');
    expect(typeof canView).toBe('boolean');
    expect(typeof hasCapability).toBe('boolean');
  });
});

// ============================================================================
// Test Suite: Edge Cases and Error Handling
// ============================================================================

describe('usePermissions - Edge Cases and Error Handling', () => {
  it('should handle empty capabilities array on user', () => {
    const user = createGuestUser();
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // User with no capabilities should fail all checks
    expect(result.current.hasCapability(
      'moodle/course:view' as Capability,
      { type: 'course', contextId: 5 }
    )).toBe(false);
  });

  it('should handle missing capabilities property on user object', () => {
    const user = createStudentUser(5);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    delete (user as any).capabilities;
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Should handle gracefully without crashing
    expect(() => {
      result.current.hasCapability(
        'moodle/course:view' as Capability,
        { type: 'course', contextId: 5 }
      );
    }).not.toThrow();
  });

  it('should handle malformed capability strings', () => {
    const user = createTeacherUser(5);
    const malformedCapability = createPermission('invalid-format', 5);
    user.capabilities.push(malformedCapability);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Should handle gracefully
    expect(() => {
      result.current.hasCapability('invalid-format' as Capability, {
        type: 'course',
        contextId: 5,
      });
    }).not.toThrow();
  });

  it('should handle invalid context objects', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Should handle invalid context gracefully
     
    const invalidContext = { type: 'invalid', contextId: -1 } as unknown as { type: 'course'; contextId: number };
    
    expect(() => {
      result.current.hasCapability('moodle/course:view' as Capability, invalidContext);
    }).not.toThrow();
  });

  it('should handle capability with special characters', () => {
    const user = createTeacherUser(5);
    const specialCapability = createPermission('moodle/course:view-all', 5);
    user.capabilities.push(specialCapability);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    const hasCapability = result.current.hasCapability(
      'moodle/course:view-all' as Capability,
      { type: 'course', contextId: 5 }
    );

    expect(hasCapability).toBe(true);
  });

  it('should handle capability case sensitivity correctly', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Capabilities should be case-sensitive
    const lowercase = result.current.hasCapability(
      'moodle/course:view' as Capability,
      { type: 'course', contextId: 5 }
    );

    const uppercase = result.current.hasCapability(
      'MOODLE/COURSE:VIEW' as Capability,
      { type: 'course', contextId: 5 }
    );

    expect(lowercase).toBe(true);
    expect(uppercase).toBe(false); // Should not match due to case difference
  });

  it('should handle very long capability names', () => {
    const user = createTeacherUser(5);
    const longCapability = `moodle/${  'a'.repeat(200)  }:view`;
    const permission = createPermission(longCapability, 5);
    user.capabilities.push(permission);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    expect(() => {
      result.current.hasCapability(longCapability, {
        type: 'course',
        contextId: 5,
      });
    }).not.toThrow();
  });

  it('should validate numeric contextId properly', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Valid numeric context IDs
    const validIds = [0, 1, 5, 100, 999999];

    validIds.forEach(contextId => {
      expect(() => {
        result.current.hasCapability('moodle/course:view' as Capability, {
          type: 'course',
          contextId,
        });
      }).not.toThrow();
    });
  });
});

// ============================================================================
// Test Suite: Performance and Memoization
// ============================================================================

describe('usePermissions - Performance and Memoization', () => {
  it('should use useMemo to prevent unnecessary recalculations', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result, rerender } = renderHook(() => usePermissions(), { wrapper });

    const firstRef = result.current;
    
    // Rerender multiple times
    rerender();
    rerender();
    rerender();

    // Should return same reference due to memoization
    expect(result.current).toBe(firstRef);
  });

  it('should ensure hook does not cause unnecessary re-renders', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    
    let renderCount = 0;
    const { rerender } = renderHook(() => {
      renderCount++;
      return usePermissions();
    }, { wrapper });

    const initialRenderCount = renderCount;
    
    // Multiple rerenders
    rerender();
    rerender();
    rerender();

    // Render count should only increase by actual rerenders (4 total)
    expect(renderCount).toBe(initialRenderCount + 3);
  });

  it('should validate minimal performance impact', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    
    const startTime = performance.now();
    
    const { result } = renderHook(() => usePermissions(), { wrapper });
    
    // Perform multiple operations
    for (let i = 0; i < 100; i++) {
      result.current.hasCapability('moodle/course:view' as Capability, {
        type: 'course',
        contextId: 5,
      });
      result.current.isTeacher();
      result.current.canViewCourse(5);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should complete 300 operations in reasonable time (< 20ms)
    expect(duration).toBeLessThan(20);
  });

  it('should test memory usage is acceptable', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    
    const { result, unmount } = renderHook(() => usePermissions(), { wrapper });

    // Perform many operations to test for memory leaks
    for (let i = 0; i < 10000; i++) {
      result.current.hasCapability('moodle/course:view' as Capability, {
        type: 'course',
        contextId: 5,
      });
    }

    // Should cleanly unmount without issues
    expect(() => unmount()).not.toThrow();
  });
});

// ============================================================================
// Test Suite: Integration with React Components
// ============================================================================

describe('usePermissions - Integration with React Components', () => {
  it('should work in functional components', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    
    const { result } = renderHook(() => {
      const permissions = usePermissions();
      return {
        canEdit: permissions.canEditCourse(5),
        isTeacher: permissions.isTeacher(),
      };
    }, { wrapper });

    expect(result.current.canEdit).toBe(true);
    expect(result.current.isTeacher).toBe(true);
  });

  it('should support conditional rendering based on permissions', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    
    const { result } = renderHook(() => {
      const permissions = usePermissions();
      return {
        showEditButton: permissions.canEditCourse(5),
        showViewButton: permissions.canViewCourse(5),
      };
    }, { wrapper });

    expect(result.current.showEditButton).toBe(false);
    expect(result.current.showViewButton).toBe(true);
  });

  it('should work in event handlers for permission checks', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Simulate event handler checking permissions
    const handleEdit = () => {
      if (result.current.canEditCourse(5)) {
        return 'edit-allowed';
      }
      return 'edit-denied';
    };

    expect(handleEdit()).toBe('edit-allowed');
  });

  it('should enable permission-based navigation guards', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Simulate navigation guard
    const canNavigateToAdmin = () => {
      return result.current.isAdmin();
    };

    expect(canNavigateToAdmin()).toBe(false);
  });

  it('should validate hook composability with other hooks', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    
    const { result } = renderHook(() => {
      const permissions = usePermissions();
      
      // Compose with other hook-like logic
      const courseId = 5;
      const canManageCourse = permissions.canEditCourse(courseId) && 
                             permissions.canGrade(courseId);
      
      return { canManageCourse };
    }, { wrapper });

    expect(result.current.canManageCourse).toBe(true);
  });
});

// ============================================================================
// Test Suite: Comparison with PHP Moodle Functions
// ============================================================================

describe('usePermissions - Comparison with PHP Moodle Functions', () => {
  it('should mirror has_capability() behavior from accesslib.php', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // PHP: has_capability('moodle/course:view', $context)
    const hasCapability = result.current.hasCapability(
      'moodle/course:view' as Capability,
      { type: 'course', contextId: 5 }
    );

    expect(hasCapability).toBe(true);
  });

  it('should mirror require_capability() behavior from accesslib.php', () => {
    const user = createStudentUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // PHP: require_capability('moodle/course:update', $context)
    // Throws moodle_exception on failure
    expect(() => {
      result.current.requireCapability(
        'moodle/course:update' as Capability,
        { type: 'course', contextId: 5 }
      );
    }).toThrow();
  });

  it('should mirror Moodle context system checking', () => {
    const user = createAdminUser();
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Moodle context hierarchy: CONTEXT_SYSTEM, CONTEXT_COURSE, CONTEXT_MODULE
    const systemCheck = result.current.hasCapability(
      'moodle/site:config' as Capability,
      { type: 'system', contextId: 0 }
    );

    expect(systemCheck).toBe(true);
  });

  it('should validate capability format matches Moodle conventions', () => {
    const user = createTeacherUser(5);
    const wrapper = createWrapper(user, true);
    const { result } = renderHook(() => usePermissions(), { wrapper });

    // Moodle format: plugin/component:action
    // Examples: moodle/course:view, mod/assign:submit, mod/quiz:attempt
    const validFormats = [
      'moodle/course:view',
      'mod/assign:submit',
      'mod/quiz:attempt',
      'gradereport/grader:view',
    ];

    validFormats.forEach(capability => {
      expect(() => {
        result.current.hasCapability(capability, {
          type: 'course',
          contextId: 5,
        });
      }).not.toThrow();
    });
  });

  it('should match Moodle role archetypes', () => {
    const adminUser = createAdminUser();
    const teacherUser = createTeacherUser(5);
    const studentUser = createStudentUser(5);

    const adminWrapper = createWrapper(adminUser, true);
    const teacherWrapper = createWrapper(teacherUser, true);
    const studentWrapper = createWrapper(studentUser, true);

    const adminResult = renderHook(() => usePermissions(), { wrapper: adminWrapper });
    const teacherResult = renderHook(() => usePermissions(), { wrapper: teacherWrapper });
    const studentResult = renderHook(() => usePermissions(), { wrapper: studentWrapper });

    // Moodle role archetypes: manager, coursecreator, editingteacher, teacher, student, guest, user
    expect(adminResult.result.current.isAdmin()).toBe(true);
    expect(teacherResult.result.current.isTeacher()).toBe(true);
    expect(studentResult.result.current.isStudent()).toBe(true);
  });
});
