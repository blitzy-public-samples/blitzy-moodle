/**
 * Permission Checking Custom Hook
 *
 * Provides comprehensive permission and capability checking functionality
 * throughout the React application. Integrates with Redux auth state to access
 * user roles and capabilities from JWT token payload.
 *
 * Architecture:
 * - Mirrors Moodle's capability-based permission system (accesslib.php)
 * - Client-side checks are for UI rendering only - backend must re-validate
 * - Supports context-aware permissions (system, course, module levels)
 * - Provides both granular capability checks and role-based convenience methods
 *
 * Important Security Note:
 * These permission checks are ONLY for client-side UI adjustments (hiding/showing
 * buttons, menu items, etc.). The backend API is the authoritative source for
 * all authorization decisions. Every API endpoint must call require_capability()
 * to enforce permissions server-side.
 *
 * Moodle Capability System:
 * - Capabilities are strings like 'moodle/course:view' or 'mod/assign:grade'
 * - Format: component/feature:action
 * - Capabilities are assigned to roles (admin, teacher, student, etc.)
 * - Capabilities can be granted at different context levels (system, course, module)
 * - Context hierarchy: System > Course Category > Course > Activity Module > Block
 *
 * Performance Optimization:
 * - Capabilities stored in Set for O(1) lookup time
 * - Computed values memoized to prevent expensive recalculations
 * - Functions memoized with useCallback to prevent component re-renders
 *
 * Usage Examples:
 * ```typescript
 * // Basic capability check
 * const { hasCapability } = usePermissions();
 * if (hasCapability('moodle/course:view')) {
 *   // Show course content
 * }
 *
 * // Context-aware capability check
 * if (hasCapability('mod/assign:grade', courseId)) {
 *   // Show grading interface
 * }
 *
 * // Multiple capability checks
 * const { hasAnyCapability } = usePermissions();
 * if (hasAnyCapability(['mod/assign:grade', 'mod/assign:editothersubmission'])) {
 *   // User can grade OR edit submissions
 * }
 *
 * // Role-based checks
 * const { isTeacher, isStudent } = usePermissions();
 * if (isTeacher) {
 *   // Show teacher-specific UI
 * }
 *
 * // Convenience methods
 * const { canGrade } = usePermissions();
 * if (canGrade(courseId)) {
 *   // Show grading button
 * }
 * ```
 *
 * @module hooks/usePermissions
 */

import { useMemo, useCallback } from 'react';
import { useAppSelector } from '../app/store';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Moodle capability string type
 *
 * Capabilities follow the format: component/feature:action
 *
 * Examples:
 * - 'moodle/course:view' - View course content
 * - 'moodle/course:update' - Edit course settings
 * - 'moodle/course:create' - Create new courses
 * - 'mod/assign:view' - View assignments
 * - 'mod/assign:submit' - Submit assignments
 * - 'mod/assign:grade' - Grade assignments
 * - 'mod/quiz:view' - View quizzes
 * - 'mod/quiz:attempt' - Attempt quizzes
 * - 'mod/forum:addquestion' - Add forum questions
 * - 'mod/forum:createattachment' - Create forum attachments
 * - 'gradereport/user:view' - View grade reports
 * - 'enrol/manual:enrol' - Manually enroll users
 *
 * Reference: public/lib/accesslib.php for complete capability list
 */
export type MoodleCapability = string;

/**
 * Moodle role shortname type
 *
 * Standard Moodle role archetypes based on mdl_role.shortname
 *
 * Role Hierarchy (default capabilities):
 * - admin: Site administrator, all permissions
 * - coursecreator: Can create and manage courses
 * - editingteacher: Teacher with editing permissions (grade, edit content)
 * - teacher: Teacher without editing permissions (view, participate)
 * - student: Student with view and submission permissions
 * - guest: Guest with read-only access
 *
 * Custom roles may exist in the system beyond these standard roles.
 */
export type MoodleRole =
  | 'admin'
  | 'coursecreator'
  | 'editingteacher'
  | 'teacher'
  | 'student'
  | 'guest';

/**
 * Return type interface for usePermissions hook
 *
 * Provides comprehensive permission checking methods and computed role flags
 */
export interface UsePermissionsReturn {
  /**
   * Check if user has a specific capability
   *
   * @param capability - Capability string (e.g., 'moodle/course:view')
   * @param contextId - Optional context ID to filter by specific context
   * @returns true if user has the capability, false otherwise
   *
   * Example:
   * ```typescript
   * // Check system-wide capability
   * hasCapability('moodle/site:config')
   *
   * // Check course-specific capability
   * hasCapability('moodle/course:update', courseId)
   * ```
   */
  hasCapability: (capability: MoodleCapability, contextId?: number) => boolean;

  /**
   * Check if user has ANY of the specified capabilities
   *
   * @param capabilities - Array of capability strings
   * @param contextId - Optional context ID to filter by specific context
   * @returns true if user has at least one capability, false otherwise
   *
   * Example:
   * ```typescript
   * // User needs either capability to access feature
   * hasAnyCapability(['mod/assign:grade', 'mod/assign:editothersubmission'])
   * ```
   */
  hasAnyCapability: (
    capabilities: MoodleCapability[],
    contextId?: number
  ) => boolean;

  /**
   * Check if user has ALL of the specified capabilities
   *
   * @param capabilities - Array of capability strings
   * @param contextId - Optional context ID to filter by specific context
   * @returns true if user has all capabilities, false otherwise
   *
   * Example:
   * ```typescript
   * // User needs all capabilities to access feature
   * hasAllCapabilities(['mod/assign:view', 'mod/assign:submit'])
   * ```
   */
  hasAllCapabilities: (
    capabilities: MoodleCapability[],
    contextId?: number
  ) => boolean;

  /**
   * Check if user has a specific role
   *
   * @param role - Role shortname to check
   * @returns true if user has the role, false otherwise
   *
   * Example:
   * ```typescript
   * hasRole('teacher') // true if user is a teacher
   * ```
   */
  hasRole: (role: MoodleRole) => boolean;

  /**
   * Whether user is an administrator
   *
   * Computed from hasRole('admin')
   */
  isAdmin: boolean;

  /**
   * Whether user is a teacher (editing or non-editing)
   *
   * Computed from hasRole('teacher') || hasRole('editingteacher')
   */
  isTeacher: boolean;

  /**
   * Whether user is a student
   *
   * Computed from hasRole('student')
   */
  isStudent: boolean;

  /**
   * Whether user is a guest
   *
   * Computed from hasRole('guest')
   */
  isGuest: boolean;

  /**
   * Convenience method: Check if user can view a course
   *
   * @param courseId - Course ID to check
   * @returns true if user has 'moodle/course:view' capability
   */
  canViewCourse: (courseId: number) => boolean;

  /**
   * Convenience method: Check if user can edit a course
   *
   * @param courseId - Course ID to check
   * @returns true if user has 'moodle/course:update' capability
   */
  canEditCourse: (courseId: number) => boolean;

  /**
   * Convenience method: Check if user can grade assignments
   *
   * @param courseId - Course ID to check
   * @returns true if user has 'mod/assign:grade' capability
   */
  canGrade: (courseId: number) => boolean;

  /**
   * Set of all user capabilities for direct access
   *
   * Provides O(1) lookup for capability checks.
   * Format: Set<string> containing capability names
   */
  capabilities: Set<string>;

  /**
   * Array of all user role shortnames
   *
   * Extracted from user.roles[].shortname
   */
  roles: MoodleRole[];
}

// ============================================================================
// Custom Hook Implementation
// ============================================================================

/**
 * Custom hook for checking user permissions and capabilities
 *
 * Provides comprehensive permission checking functionality throughout the
 * application. Integrates with Redux auth state to access user roles and
 * capabilities from JWT token payload.
 *
 * This hook is used for:
 * - Conditional UI rendering (show/hide buttons, menu items, features)
 * - Route protection (in combination with ProtectedRoute component)
 * - Feature access control (enable/disable functionality)
 * - Role-based component variations (different UI for teachers vs students)
 *
 * Security Note:
 * These checks are ONLY for UI purposes. The backend API must perform
 * identical permission checks using Moodle's require_capability() function.
 * Never trust client-side permission checks for security decisions.
 *
 * @returns Object containing permission check functions and computed role flags
 *
 * @example
 * ```typescript
 * function CourseActions({ courseId }) {
 *   const { canEditCourse, canViewCourse } = usePermissions();
 *
 *   if (!canViewCourse(courseId)) {
 *     return <AccessDenied />;
 *   }
 *
 *   return (
 *     <Box>
 *       <ViewCourseButton courseId={courseId} />
 *       {canEditCourse(courseId) && (
 *         <EditCourseButton courseId={courseId} />
 *       )}
 *     </Box>
 *   );
 * }
 * ```
 */
export function usePermissions(): UsePermissionsReturn {
  // ============================================================================
  // State Selection from Redux
  // ============================================================================

  /**
   * Select current user from auth state
   *
   * User object contains roles and capabilities from JWT token.
   * Returns null if user is not authenticated.
   */
  const user = useAppSelector((state) => state.auth.user);

  /**
   * Extract user roles array from user object
   *
   * Returns empty array if user is null or has no roles
   */
  const userRoles = useMemo(() => {
    if (!user || !user.roles) {
      return [];
    }
    return user.roles.map((role) => role.shortname as MoodleRole);
  }, [user]);

  /**
   * Extract user capabilities array from user object
   *
   * Returns empty array if user is null or has no capabilities
   */
  const userCapabilities = useMemo(() => {
    if (!user || !user.capabilities) {
      return [];
    }
    return user.capabilities;
  }, [user]);

  // ============================================================================
  // Capabilities Set for O(1) Lookup
  // ============================================================================

  /**
   * Create Set of capability names for efficient O(1) lookup
   *
   * Stores only capability strings, not full Permission objects.
   * Recalculates only when userCapabilities changes.
   *
   * Performance:
   * - Set lookup: O(1)
   * - Array lookup: O(n)
   * - For frequent permission checks, Set provides significant performance gain
   */
  const capabilities = useMemo(() => {
    const capabilitySet = new Set<string>();

    userCapabilities.forEach((permission) => {
      // Only add granted capabilities to the set
      if (permission.granted) {
        capabilitySet.add(permission.capability);
      }
    });

    return capabilitySet;
  }, [userCapabilities]);

  // ============================================================================
  // Permission Check Functions
  // ============================================================================

  /**
   * Check if user has a specific capability
   *
   * Performs O(1) lookup in capabilities Set.
   * If contextId is provided, filters to permissions in that specific context.
   *
   * Context Hierarchy:
   * - System context: site-wide permissions
   * - Course context: course-specific permissions
   * - Module context: activity-specific permissions
   *
   * Note: Context filtering requires matching against user.capabilities array
   * which includes contextId information.
   */
  const hasCapability = useCallback(
    (capability: MoodleCapability, contextId?: number): boolean => {
      // If no user, no capabilities
      if (!user) {
        return false;
      }

      // If contextId is specified, find permission with matching context
      if (contextId !== undefined) {
        const permission = userCapabilities.find(
          (p) =>
            p.capability === capability &&
            p.contextId === contextId &&
            p.granted
        );
        return !!permission;
      }

      // Otherwise, check if capability exists anywhere (O(1) lookup)
      return capabilities.has(capability);
    },
    [user, userCapabilities, capabilities]
  );

  /**
   * Check if user has ANY of the specified capabilities
   *
   * Returns true as soon as one matching capability is found.
   * Short-circuits for performance.
   */
  const hasAnyCapability = useCallback(
    (caps: MoodleCapability[], contextId?: number): boolean => {
      return caps.some((cap) => hasCapability(cap, contextId));
    },
    [hasCapability]
  );

  /**
   * Check if user has ALL of the specified capabilities
   *
   * Returns false as soon as one missing capability is found.
   * Short-circuits for performance.
   */
  const hasAllCapabilities = useCallback(
    (caps: MoodleCapability[], contextId?: number): boolean => {
      return caps.every((cap) => hasCapability(cap, contextId));
    },
    [hasCapability]
  );

  /**
   * Check if user has a specific role
   *
   * Performs simple array search in userRoles.
   * Roles array is typically small (1-5 roles), so O(n) is acceptable.
   */
  const hasRole = useCallback(
    (role: MoodleRole): boolean => {
      return userRoles.includes(role);
    },
    [userRoles]
  );

  // ============================================================================
  // Computed Role Flags
  // ============================================================================

  /**
   * Whether user is an administrator
   *
   * Administrators have site-wide access to all features and settings.
   * Typically assigned the 'admin' or 'manager' role shortname.
   *
   * Memoized to prevent recalculation on every render.
   */
  const isAdmin = useMemo(() => {
    return hasRole('admin');
  }, [hasRole]);

  /**
   * Whether user is a teacher (editing or non-editing)
   *
   * Teachers can view course content, grade assignments, and manage students.
   * Editing teachers can also modify course content.
   *
   * Checks for both 'teacher' and 'editingteacher' role shortnames.
   * Memoized to prevent recalculation on every render.
   */
  const isTeacher = useMemo(() => {
    return hasRole('teacher') || hasRole('editingteacher');
  }, [hasRole]);

  /**
   * Whether user is a student
   *
   * Students can view course content, submit assignments, and take quizzes.
   * They cannot edit course content or grade other students.
   *
   * Checks for 'student' role shortname.
   * Memoized to prevent recalculation on every render.
   */
  const isStudent = useMemo(() => {
    return hasRole('student');
  }, [hasRole]);

  /**
   * Whether user is a guest
   *
   * Guests have read-only access to permitted courses.
   * They cannot submit assignments or participate in activities.
   *
   * Checks for 'guest' role shortname.
   * Memoized to prevent recalculation on every render.
   */
  const isGuest = useMemo(() => {
    return hasRole('guest');
  }, [hasRole]);

  // ============================================================================
  // Convenience Functions for Common Capabilities
  // ============================================================================

  /**
   * Check if user can view a course
   *
   * Convenience wrapper for hasCapability('moodle/course:view', courseId).
   * Most basic permission required to access any course content.
   */
  const canViewCourse = useCallback(
    (courseId: number): boolean => {
      return hasCapability('moodle/course:view', courseId);
    },
    [hasCapability]
  );

  /**
   * Check if user can edit a course
   *
   * Convenience wrapper for hasCapability('moodle/course:update', courseId).
   * Required to modify course settings, sections, and structure.
   */
  const canEditCourse = useCallback(
    (courseId: number): boolean => {
      return hasCapability('moodle/course:update', courseId);
    },
    [hasCapability]
  );

  /**
   * Check if user can grade assignments
   *
   * Convenience wrapper for hasCapability('mod/assign:grade', courseId).
   * Required to grade student assignment submissions.
   */
  const canGrade = useCallback(
    (courseId: number): boolean => {
      return hasCapability('mod/assign:grade', courseId);
    },
    [hasCapability]
  );

  // ============================================================================
  // Return Hook Interface
  // ============================================================================

  return {
    // Permission check functions
    hasCapability,
    hasAnyCapability,
    hasAllCapabilities,
    hasRole,

    // Computed role flags
    isAdmin,
    isTeacher,
    isStudent,
    isGuest,

    // Convenience functions
    canViewCourse,
    canEditCourse,
    canGrade,

    // Direct access to capabilities and roles
    capabilities,
    roles: userRoles,
  };
}
