/**
 * usePermissions Hook
 *
 * Custom React hook for checking user permissions and capabilities using Moodle's
 * capability system. Provides TypeScript-safe permission checking for React components
 * to conditionally render UI based on user permissions.
 *
 * This hook mirrors Moodle's PHP capability functions:
 * - has_capability(): Check if user has a specific capability
 * - require_capability(): Enforce capability requirements
 * - has_any_capability(): Check if user has any of multiple capabilities
 * - has_all_capabilities(): Check if user has all of multiple capabilities
 *
 * IMPORTANT: This hook is for UI-only permission checks (hiding/showing buttons,
 * enabling/disabling features). Real permission enforcement happens on the backend
 * via existing Moodle functions. The backend API endpoints are responsible for
 * authoritative permission enforcement via require_capability().
 *
 * Architecture:
 * - Integrates with Redux auth state to access user roles and capabilities
 * - Caches capability check results using React.useMemo for performance
 * - Provides context-aware permission checking (system, course, module, user)
 * - Supports Moodle's hierarchical capability system
 *
 * Moodle Context Hierarchy:
 * System (highest) → Course Category → Course → Activity Module → Block (lowest)
 *
 * Usage Example:
 * ```typescript
 * function CourseEditButton({ courseId }: { courseId: number }) {
 *   const { canEditCourse, isTeacher } = usePermissions();
 *
 *   if (!canEditCourse(courseId)) {
 *     return null; // Hide button if user lacks permission
 *   }
 *
 *   return <Button onClick={handleEdit}>Edit Course</Button>;
 * }
 * ```
 *
 * @module features/auth/hooks/usePermissions
 */

import { useMemo } from 'react';
import { useAppSelector } from '@/app/store';
import type { User } from '@/features/auth/types/auth.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Moodle context type
 *
 * Represents the hierarchical levels where permissions can be assigned.
 * Matches Moodle's context system for capability checking.
 *
 * Hierarchy:
 * - system: Site-wide permissions
 * - course: Course-level permissions
 * - module: Activity module permissions
 * - user: User-specific permissions
 */
export type ContextType = 'system' | 'course' | 'module' | 'user';

/**
 * Context for permission checking
 *
 * Identifies the specific context where a permission should be checked.
 * Combines context type with context instance ID.
 *
 * Examples:
 * - { type: 'system', contextId: 1 } - System context
 * - { type: 'course', contextId: 42 } - Course with ID 42
 * - { type: 'module', contextId: 123 } - Activity module with ID 123
 */
export interface Context {
  /**
   * Type of context (system, course, module, user)
   */
  type: ContextType;

  /**
   * ID of the context instance
   * For system context, typically 1
   * For course context, the course ID
   * For module context, the course module ID
   */
  contextId: number;
}

/**
 * Moodle capability string
 *
 * Capabilities follow the format: {component}/{action}
 * Examples:
 * - 'moodle/course:view' - View course
 * - 'moodle/course:update' - Edit course
 * - 'mod/assign:submit' - Submit assignment
 * - 'mod/quiz:attempt' - Attempt quiz
 * - 'moodle/grade:view' - View grades
 * - 'moodle/site:config' - Configure site (admin)
 *
 * Full list defined in Moodle's access.php files across modules
 */
export type Capability = string;

/**
 * Permissions hook return type
 *
 * Defines all methods available from usePermissions hook
 */
export interface PermissionsHook {
  /**
   * Check if current user has a specific capability in a given context
   *
   * @param capability - Capability string (e.g., 'moodle/course:view')
   * @param context - Context where permission should be checked
   * @returns true if user has capability, false otherwise
   *
   * @example
   * ```typescript
   * const canView = hasCapability('moodle/course:view', {
   *   type: 'course',
   *   contextId: courseId
   * });
   * ```
   */
  hasCapability(capability: Capability, context: Context): boolean;

  /**
   * Require a specific capability, throwing error if user lacks it
   *
   * Use this for critical operations where the absence of permission
   * should prevent rendering or trigger error handling.
   *
   * @param capability - Capability string (e.g., 'moodle/course:update')
   * @param context - Context where permission is required
   * @throws Error if user lacks the required capability
   *
   * @example
   * ```typescript
   * try {
   *   requireCapability('moodle/course:update', {
   *     type: 'course',
   *     contextId: courseId
   *   });
   *   // Proceed with editing
   * } catch (error) {
   *   // Show permission denied message
   * }
   * ```
   */
  requireCapability(capability: Capability, context: Context): void;

  /**
   * Check if user has ANY of the provided capabilities in context
   *
   * Returns true if user has at least one of the capabilities.
   * Useful for features with multiple permission paths.
   *
   * @param capabilities - Array of capability strings
   * @param context - Context where permissions should be checked
   * @returns true if user has any of the capabilities
   *
   * @example
   * ```typescript
   * const canManage = hasAnyCapability(
   *   ['moodle/course:update', 'moodle/course:delete'],
   *   { type: 'course', contextId: courseId }
   * );
   * ```
   */
  hasAnyCapability(capabilities: Capability[], context: Context): boolean;

  /**
   * Check if user has ALL of the provided capabilities in context
   *
   * Returns true only if user has every capability in the list.
   * Useful for features requiring multiple permissions.
   *
   * @param capabilities - Array of capability strings
   * @param context - Context where permissions should be checked
   * @returns true if user has all capabilities
   *
   * @example
   * ```typescript
   * const canGrade = hasAllCapabilities(
   *   ['mod/assign:grade', 'moodle/grade:edit'],
   *   { type: 'course', contextId: courseId }
   * );
   * ```
   */
  hasAllCapabilities(capabilities: Capability[], context: Context): boolean;

  /**
   * Check if user can view a specific course
   *
   * Convenience method wrapping hasCapability for 'moodle/course:view'
   *
   * @param courseId - Course ID to check
   * @returns true if user can view course
   */
  canViewCourse(courseId: number): boolean;

  /**
   * Check if user can edit a specific course
   *
   * Convenience method wrapping hasCapability for 'moodle/course:update'
   *
   * @param courseId - Course ID to check
   * @returns true if user can edit course
   */
  canEditCourse(courseId: number): boolean;

  /**
   * Check if user can grade in a specific course
   *
   * Convenience method wrapping hasCapability for 'moodle/grade:edit'
   *
   * @param courseId - Course ID to check
   * @returns true if user can grade in course
   */
  canGrade(courseId: number): boolean;

  /**
   * Check if current user is a site administrator
   *
   * Checks for 'moodle/site:config' capability in system context
   *
   * @returns true if user is admin
   */
  isAdmin(): boolean;

  /**
   * Check if current user has a teacher role
   *
   * Can check globally or in a specific course.
   * Looks for 'editingteacher' or 'teacher' role shortnames.
   *
   * @param courseId - Optional course ID to check role in specific course
   * @returns true if user is a teacher
   */
  isTeacher(courseId?: number): boolean;

  /**
   * Check if current user has a student role
   *
   * Can check globally or in a specific course.
   * Looks for 'student' role shortname.
   *
   * @param courseId - Optional course ID to check role in specific course
   * @returns true if user is a student
   */
  isStudent(courseId?: number): boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for checking user permissions and capabilities
 *
 * Provides methods to check if the current authenticated user has specific
 * capabilities in given contexts. Integrates with Redux auth state and
 * memoizes results for performance.
 *
 * State Dependencies:
 * - state.auth.user: Current user with roles and capabilities
 * - state.auth.isAuthenticated: Authentication status
 *
 * Performance:
 * - Capability checks are memoized based on user and roles
 * - Recalculates only when user data changes
 * - Handles null/undefined user gracefully
 *
 * Security:
 * - UI-only checks (not authoritative)
 * - Backend API enforces real permissions
 * - Never trust client-side permission checks for security
 *
 * @returns PermissionsHook object with permission checking methods
 *
 * @example
 * ```typescript
 * function CourseActions({ courseId }: { courseId: number }) {
 *   const { canEditCourse, canGrade, isTeacher } = usePermissions();
 *
 *   return (
 *     <Box>
 *       {canEditCourse(courseId) && (
 *         <Button onClick={handleEdit}>Edit Course</Button>
 *       )}
 *       {canGrade(courseId) && (
 *         <Button onClick={handleGrade}>Grade Assignments</Button>
 *       )}
 *       {isTeacher(courseId) && (
 *         <Link to={`/courses/${courseId}/manage`}>Manage</Link>
 *       )}
 *     </Box>
 *   );
 * }
 * ```
 */
export function usePermissions(): PermissionsHook {
  // Access current user from Redux auth state
  const user = useAppSelector((state) => state.auth.user);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  // Memoize permission checking logic based on user data
  // Recalculates only when user or authentication status changes
  const permissions = useMemo<PermissionsHook>(() => {
    /**
     * Check if user has a specific capability in context
     *
     * Implementation:
     * 1. Return false if user is null/undefined (not authenticated)
     * 2. Check if user.capabilities array contains matching permission
     * 3. Match by capability string and contextId
     *
     * Note: This is a simplified implementation. In a full Moodle implementation,
     * capability checking would traverse the context hierarchy and check for
     * permission overrides at each level.
     */
    const hasCapability = (capability: Capability, context: Context): boolean => {
      // Return false if no user (not authenticated)
      if (!user || !isAuthenticated) {
        return false;
      }

      // Return false if user has no capabilities array
      if (!user.capabilities || !Array.isArray(user.capabilities)) {
        return false;
      }

      // Check if user has the capability in the specified context
      // Look for exact match in capabilities array
      const hasPermission = user.capabilities.some(
        (permission) =>
          permission.capability === capability &&
          permission.contextId === context.contextId &&
          permission.granted === true
      );

      return hasPermission;
    };

    /**
     * Require capability, throwing error if not present
     *
     * Use this for critical permission checks where lack of permission
     * should trigger error handling.
     */
    const requireCapability = (capability: Capability, context: Context): void => {
      if (!hasCapability(capability, context)) {
        throw new Error(
          `Permission denied: User lacks required capability '${capability}' ` +
            `in context ${context.type} (ID: ${context.contextId})`
        );
      }
    };

    /**
     * Check if user has ANY of the provided capabilities
     *
     * Returns true if at least one capability is granted
     */
    const hasAnyCapability = (capabilities: Capability[], context: Context): boolean => {
      if (!user || !isAuthenticated || !capabilities || capabilities.length === 0) {
        return false;
      }

      return capabilities.some((capability) => hasCapability(capability, context));
    };

    /**
     * Check if user has ALL of the provided capabilities
     *
     * Returns true only if every capability is granted
     */
    const hasAllCapabilities = (capabilities: Capability[], context: Context): boolean => {
      if (!user || !isAuthenticated || !capabilities || capabilities.length === 0) {
        return false;
      }

      return capabilities.every((capability) => hasCapability(capability, context));
    };

    /**
     * Check if user can view a specific course
     *
     * Checks 'moodle/course:view' capability in course context
     */
    const canViewCourse = (courseId: number): boolean => {
      return hasCapability('moodle/course:view', {
        type: 'course',
        contextId: courseId,
      });
    };

    /**
     * Check if user can edit a specific course
     *
     * Checks 'moodle/course:update' capability in course context
     */
    const canEditCourse = (courseId: number): boolean => {
      return hasCapability('moodle/course:update', {
        type: 'course',
        contextId: courseId,
      });
    };

    /**
     * Check if user can grade in a specific course
     *
     * Checks 'moodle/grade:edit' capability in course context
     */
    const canGrade = (courseId: number): boolean => {
      return hasCapability('moodle/grade:edit', {
        type: 'course',
        contextId: courseId,
      });
    };

    /**
     * Check if user is a site administrator
     *
     * Checks 'moodle/site:config' capability in system context (ID: 1)
     */
    const isAdmin = (): boolean => {
      return hasCapability('moodle/site:config', {
        type: 'system',
        contextId: 1, // System context always has ID 1
      });
    };

    /**
     * Check if user has teacher role
     *
     * If courseId provided, checks for teacher role in that specific course.
     * Otherwise, checks if user has teacher role anywhere.
     *
     * Looks for role shortnames: 'editingteacher', 'teacher'
     */
    const isTeacher = (courseId?: number): boolean => {
      if (!user || !isAuthenticated) {
        return false;
      }

      // Return false if user has no roles array
      if (!user.roles || !Array.isArray(user.roles)) {
        return false;
      }

      // Check if user has teacher or editingteacher role
      const hasTeacherRole = user.roles.some(
        (role) =>
          role.shortname === 'teacher' ||
          role.shortname === 'editingteacher' ||
          role.shortname === 'manager'
      );

      // If no specific course requested, return general teacher status
      if (courseId === undefined) {
        return hasTeacherRole;
      }

      // If specific course requested, also check course editing capability
      return (
        hasTeacherRole &&
        (canViewCourse(courseId) || canEditCourse(courseId))
      );
    };

    /**
     * Check if user has student role
     *
     * If courseId provided, checks for student role in that specific course.
     * Otherwise, checks if user has student role anywhere.
     *
     * Looks for role shortname: 'student'
     */
    const isStudent = (courseId?: number): boolean => {
      if (!user || !isAuthenticated) {
        return false;
      }

      // Return false if user has no roles array
      if (!user.roles || !Array.isArray(user.roles)) {
        return false;
      }

      // Check if user has student role
      const hasStudentRole = user.roles.some((role) => role.shortname === 'student');

      // If no specific course requested, return general student status
      if (courseId === undefined) {
        return hasStudentRole;
      }

      // If specific course requested, also check course view capability
      return hasStudentRole && canViewCourse(courseId);
    };

    // Return all permission checking methods
    return {
      hasCapability,
      requireCapability,
      hasAnyCapability,
      hasAllCapabilities,
      canViewCourse,
      canEditCourse,
      canGrade,
      isAdmin,
      isTeacher,
      isStudent,
    };
  }, [user, isAuthenticated]); // Recalculate when user or auth status changes

  return permissions;
}

// Default export for convenience
export default usePermissions;
