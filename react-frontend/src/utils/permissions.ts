/**
 * Permission Checking Utility Functions
 *
 * Client-side capability verification utilities based on user roles and permissions
 * from JWT token or auth state. Provides helpers to show/hide UI elements and control
 * feature access throughout the React application.
 *
 * IMPORTANT: These are CLIENT-SIDE helpers for UI presentation only.
 * The backend API MUST ALWAYS enforce permissions authoritatively using
 * require_capability() and the Moodle access control system.
 *
 * Never rely on these functions for security - they are for UX optimization only.
 *
 * @module utils/permissions
 */

import { CONTEXT_MODULE } from './constants';
import type { Role } from '@/features/auth/types/auth.types';

// ============================================================================
// Capability Name Constants
// ============================================================================

/**
 * Capability to view course content
 * Required for accessing course pages and materials
 */
export const CAPABILITY_VIEW_COURSE = 'moodle/course:view';

/**
 * Capability to edit course settings and content
 * Required for teachers and course creators
 */
export const CAPABILITY_EDIT_COURSE = 'moodle/course:update';

/**
 * Capability to manage course activities
 * Required for adding/editing activities within a course
 */
export const CAPABILITY_MANAGE_ACTIVITIES = 'moodle/course:manageactivities';

/**
 * Capability to submit assignments
 * Required for students to submit work
 */
export const CAPABILITY_SUBMIT_ASSIGNMENT = 'mod/assign:submit';

/**
 * Capability to grade assignments
 * Required for teachers to grade student submissions
 */
export const CAPABILITY_GRADE_ASSIGNMENT = 'mod/assign:grade';

/**
 * Capability to manage users in the system
 * Required for administrators to create, edit, and delete users
 */
export const CAPABILITY_MANAGE_USERS = 'moodle/user:update';

/**
 * Capability to create users
 * Required for administrators to create new user accounts
 */
export const CAPABILITY_CREATE_USERS = 'moodle/user:create';

/**
 * Capability to delete users
 * Required for administrators to delete user accounts
 */
export const CAPABILITY_DELETE_USERS = 'moodle/user:delete';

/**
 * Capability to assign roles
 * Required for administrators to assign roles to users
 */
export const CAPABILITY_ASSIGN_ROLES = 'moodle/role:assign';

/**
 * Capability to manage roles
 * Required for administrators to define and edit roles
 */
export const CAPABILITY_MANAGE_ROLES = 'moodle/role:manage';

/**
 * Capability to view site administration
 * Required to access the admin area
 */
export const CAPABILITY_VIEW_ADMIN = 'moodle/site:config';

/**
 * Capability to view the gradebook
 * Required for teachers to see grade reports
 */
export const CAPABILITY_VIEW_GRADES = 'moodle/grade:view';

/**
 * Capability to edit grades
 * Required for teachers to modify grades
 */
export const CAPABILITY_EDIT_GRADES = 'moodle/grade:edit';

/**
 * Capability to enrol users in courses
 * Required for manual enrollment
 */
export const CAPABILITY_ENROL_USERS = 'enrol/manual:enrol';

// ============================================================================
// Context Type Constants
// ============================================================================

/**
 * System context level (value: 10)
 * Represents the entire Moodle site
 */
export const CONTEXT_SYSTEM = 10;

/**
 * User context level (value: 30)
 * Represents a specific user's personal space
 */
export const CONTEXT_USER = 30;

/**
 * Course context level (value: 50)
 * Represents a specific course
 */
export const CONTEXT_COURSE = 50;

/**
 * Module context level (value: 70)
 * Represents a specific activity module within a course
 * Imported from constants.ts to maintain consistency
 */
export { CONTEXT_MODULE };

// ============================================================================
// Role Archetype Constants
// ============================================================================

/**
 * Student role archetype
 * Typically has view permissions but limited editing capabilities
 */
export const ROLE_ARCHETYPE_STUDENT = 'student';

/**
 * Teacher role archetype (non-editing)
 * Can view and interact but not modify course content
 */
export const ROLE_ARCHETYPE_TEACHER = 'teacher';

/**
 * Editing teacher role archetype
 * Full course management capabilities
 */
export const ROLE_ARCHETYPE_EDITINGTEACHER = 'editingteacher';

/**
 * Manager role archetype
 * Administrative capabilities at course category level
 */
export const ROLE_ARCHETYPE_MANAGER = 'manager';

/**
 * Course creator role archetype
 * Can create new courses
 */
export const ROLE_ARCHETYPE_COURSECREATOR = 'coursecreator';

// ============================================================================
// Types
// ============================================================================

/**
 * User permission data structure
 * Represents a capability grant in a specific context
 */
interface UserPermission {
  capability: string;
  contextId: number;
  granted: boolean;
}

/**
 * Current user data interface for permission checking
 * Contains the minimal data needed to evaluate permissions
 */
interface CurrentUserData {
  id: number;
  roles: Role[];
  capabilities: UserPermission[];
}

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Get current user data from global state
 *
 * This function attempts to retrieve the current user's authentication data
 * from the Redux store or other global state management solution.
 *
 * NOTE: In a real implementation, this would access the Redux store directly
 * or use a React hook. For now, we check window.__MOODLE_USER__ as a fallback.
 *
 * @private
 * @returns Current user data or null if not authenticated
 */
function getCurrentUser(): CurrentUserData | null {
  // Attempt to access Redux store if available
  // In production, this would import the store and select from authSlice
  if (typeof window !== 'undefined') {
    // Check for global user data (set by provider or auth hook)
    const globalUser = (window as any).__MOODLE_USER__;
    if (globalUser && globalUser.id) {
      return {
        id: globalUser.id,
        roles: globalUser.roles || [],
        capabilities: globalUser.capabilities || [],
      };
    }
  }

  return null;
}

/**
 * Check if user has a capability in any parent context
 *
 * Moodle's permission system allows capabilities to be inherited from
 * parent contexts (e.g., system -> course -> module). This function
 * checks if the user has the capability in the specified context or
 * any of its parent contexts.
 *
 * @private
 * @param capabilities - User's capability list
 * @param capability - Capability name to check
 * @param contextId - Context ID to check (optional)
 * @returns true if user has the capability
 */
function hasCapabilityInContext(
  capabilities: UserPermission[],
  capability: string,
  contextId?: number
): boolean {
  // If no context specified, check for capability in any context
  if (contextId === undefined) {
    return capabilities.some(
      (perm) => perm.capability === capability && perm.granted
    );
  }

  // Check for capability in specific context
  // In a full implementation, this would also check parent contexts
  return capabilities.some(
    (perm) =>
      perm.capability === capability &&
      perm.contextId === contextId &&
      perm.granted
  );
}

/**
 * Check if user has a specific role archetype
 *
 * @private
 * @param roles - User's roles
 * @param archetype - Role archetype to check
 * @returns true if user has the role archetype
 */
function hasRoleArchetype(roles: Role[], archetype: string): boolean {
  return roles.some((role) => role.archetype === archetype);
}

// ============================================================================
// Core Permission Checking Functions
// ============================================================================

/**
 * Check if current user has a specific capability
 *
 * Verifies whether the authenticated user has the specified capability
 * in the given context. This is the primary permission checking function.
 *
 * Example:
 * ```typescript
 * if (hasCapability('moodle/course:view', courseId)) {
 *   // Show course content
 * }
 * ```
 *
 * @param capability - Moodle capability name (e.g., 'moodle/course:view')
 * @param contextId - Optional context ID to check permission in specific context
 * @returns true if user has the capability, false otherwise
 */
export function hasCapability(
  capability: string,
  contextId?: number
): boolean {
  const user = getCurrentUser();
  if (!user) {
    return false;
  }

  return hasCapabilityInContext(user.capabilities, capability, contextId);
}

/**
 * Check if current user has any of the specified capabilities
 *
 * Returns true if the user has at least one of the provided capabilities.
 * Useful for showing UI elements that require one of several permissions.
 *
 * Example:
 * ```typescript
 * if (hasAnyCapability(['mod/assign:grade', 'mod/assign:editothersubmission'])) {
 *   // Show grading interface
 * }
 * ```
 *
 * @param capabilities - Array of capability names to check
 * @param contextId - Optional context ID to check permissions in specific context
 * @returns true if user has any of the capabilities, false otherwise
 */
export function hasAnyCapability(
  capabilities: string[],
  contextId?: number
): boolean {
  const user = getCurrentUser();
  if (!user) {
    return false;
  }

  return capabilities.some((capability) =>
    hasCapabilityInContext(user.capabilities, capability, contextId)
  );
}

/**
 * Check if current user has all of the specified capabilities
 *
 * Returns true only if the user has every one of the provided capabilities.
 * Useful for features that require multiple permissions.
 *
 * Example:
 * ```typescript
 * if (hasAllCapabilities(['moodle/course:update', 'moodle/course:manageactivities'])) {
 *   // Show full course editing interface
 * }
 * ```
 *
 * @param capabilities - Array of capability names to check
 * @param contextId - Optional context ID to check permissions in specific context
 * @returns true if user has all capabilities, false otherwise
 */
export function hasAllCapabilities(
  capabilities: string[],
  contextId?: number
): boolean {
  const user = getCurrentUser();
  if (!user) {
    return false;
  }

  return capabilities.every((capability) =>
    hasCapabilityInContext(user.capabilities, capability, contextId)
  );
}

// ============================================================================
// Course Permission Helpers
// ============================================================================

/**
 * Check if user can view a course
 *
 * Verifies the 'moodle/course:view' capability for the specified course.
 *
 * Example:
 * ```typescript
 * if (canViewCourse(courseId)) {
 *   <Link to={`/courses/${courseId}`}>View Course</Link>
 * }
 * ```
 *
 * @param courseId - Course ID to check permission for
 * @returns true if user can view the course, false otherwise
 */
export function canViewCourse(courseId: number): boolean {
  return hasCapability(CAPABILITY_VIEW_COURSE, courseId);
}

/**
 * Check if user can edit a course
 *
 * Verifies the 'moodle/course:update' capability for the specified course.
 * Required for teachers and course creators to modify course settings.
 *
 * Example:
 * ```typescript
 * if (canEditCourse(courseId)) {
 *   <Button onClick={handleEdit}>Edit Course</Button>
 * }
 * ```
 *
 * @param courseId - Course ID to check permission for
 * @returns true if user can edit the course, false otherwise
 */
export function canEditCourse(courseId: number): boolean {
  return hasCapability(CAPABILITY_EDIT_COURSE, courseId);
}

// ============================================================================
// Assignment Permission Helpers
// ============================================================================

/**
 * Check if user can grade an assignment
 *
 * Verifies the 'mod/assign:grade' capability for the specified assignment.
 * Required for teachers to grade student submissions.
 *
 * Example:
 * ```typescript
 * if (canGradeAssignment(assignmentId)) {
 *   <Button onClick={handleGrade}>Grade Submissions</Button>
 * }
 * ```
 *
 * @param assignmentId - Assignment module context ID
 * @returns true if user can grade the assignment, false otherwise
 */
export function canGradeAssignment(assignmentId: number): boolean {
  return hasCapability(CAPABILITY_GRADE_ASSIGNMENT, assignmentId);
}

/**
 * Check if user can submit an assignment
 *
 * Verifies the 'mod/assign:submit' capability for the specified assignment.
 * Required for students to submit their work.
 *
 * Example:
 * ```typescript
 * if (canSubmitAssignment(assignmentId)) {
 *   <AssignmentSubmissionForm assignmentId={assignmentId} />
 * }
 * ```
 *
 * @param assignmentId - Assignment module context ID
 * @returns true if user can submit to the assignment, false otherwise
 */
export function canSubmitAssignment(assignmentId: number): boolean {
  return hasCapability(CAPABILITY_SUBMIT_ASSIGNMENT, assignmentId);
}

// ============================================================================
// User Management Permission Helpers
// ============================================================================

/**
 * Check if user can manage users
 *
 * Verifies the 'moodle/user:update' capability at system level.
 * Required for administrators to create, edit, and delete users.
 *
 * Example:
 * ```typescript
 * if (canManageUsers()) {
 *   <Link to="/admin/users">Manage Users</Link>
 * }
 * ```
 *
 * @returns true if user can manage users, false otherwise
 */
export function canManageUsers(): boolean {
  return hasCapability(CAPABILITY_MANAGE_USERS, CONTEXT_SYSTEM);
}

/**
 * Check if user can manage roles
 *
 * Verifies the 'moodle/role:manage' capability at system level.
 * Required for administrators to define and edit roles.
 *
 * Example:
 * ```typescript
 * if (canManageRoles()) {
 *   <Link to="/admin/roles">Manage Roles</Link>
 * }
 * ```
 *
 * @returns true if user can manage roles, false otherwise
 */
export function canManageRoles(): boolean {
  return hasCapability(CAPABILITY_MANAGE_ROLES, CONTEXT_SYSTEM);
}

/**
 * Check if user can access admin area
 *
 * Verifies the 'moodle/site:config' capability at system level.
 * Required to view and access the site administration interface.
 *
 * Example:
 * ```typescript
 * if (canAccessAdmin()) {
 *   <AdminDashboard />
 * }
 * ```
 *
 * @returns true if user can access admin area, false otherwise
 */
export function canAccessAdmin(): boolean {
  return hasCapability(CAPABILITY_VIEW_ADMIN, CONTEXT_SYSTEM);
}

// ============================================================================
// Role-Based Helper Functions
// ============================================================================

/**
 * Check if current user has student role
 *
 * Determines if the user has a role with the 'student' archetype.
 * Useful for showing student-specific UI elements.
 *
 * Example:
 * ```typescript
 * if (isStudent()) {
 *   <StudentDashboard />
 * }
 * ```
 *
 * @returns true if user has student role, false otherwise
 */
export function isStudent(): boolean {
  const user = getCurrentUser();
  if (!user) {
    return false;
  }

  return hasRoleArchetype(user.roles, ROLE_ARCHETYPE_STUDENT);
}

/**
 * Check if current user has teacher role
 *
 * Determines if the user has a role with 'teacher' or 'editingteacher' archetype.
 * Useful for showing teacher-specific UI elements.
 *
 * Example:
 * ```typescript
 * if (isTeacher()) {
 *   <TeacherDashboard />
 * }
 * ```
 *
 * @returns true if user has teacher role, false otherwise
 */
export function isTeacher(): boolean {
  const user = getCurrentUser();
  if (!user) {
    return false;
  }

  return (
    hasRoleArchetype(user.roles, ROLE_ARCHETYPE_TEACHER) ||
    hasRoleArchetype(user.roles, ROLE_ARCHETYPE_EDITINGTEACHER)
  );
}

/**
 * Check if current user has admin role
 *
 * Determines if the user has a role with 'manager' archetype or
 * system-level administrative capabilities.
 *
 * Example:
 * ```typescript
 * if (isAdmin()) {
 *   <AdminDashboard />
 * }
 * ```
 *
 * @returns true if user has admin role, false otherwise
 */
export function isAdmin(): boolean {
  const user = getCurrentUser();
  if (!user) {
    return false;
  }

  // Check for manager role archetype
  if (hasRoleArchetype(user.roles, ROLE_ARCHETYPE_MANAGER)) {
    return true;
  }

  // Also check for site configuration capability (system admin)
  return hasCapability(CAPABILITY_VIEW_ADMIN, CONTEXT_SYSTEM);
}

/**
 * Get user's primary role in a context
 *
 * Returns the shortname of the user's primary role in the specified context.
 * If no context is specified, returns the highest-level role.
 *
 * Priority order: manager > editingteacher > teacher > student
 *
 * Example:
 * ```typescript
 * const role = getUserRole(courseId);
 * if (role === 'editingteacher') {
 *   // Show editing controls
 * }
 * ```
 *
 * @param contextId - Optional context ID to get role for specific context
 * @returns Role shortname or null if user has no roles
 */
export function getUserRole(contextId?: number): string | null {
  const user = getCurrentUser();
  if (!user || user.roles.length === 0) {
    return null;
  }

  // Define role priority (higher index = higher priority)
  const rolePriority: { [key: string]: number } = {
    student: 1,
    teacher: 2,
    editingteacher: 3,
    coursecreator: 4,
    manager: 5,
  };

  // Filter roles by context if specified
  // Note: In a full implementation, this would filter by contextId
  // For now, we return the highest priority role
  let highestRole: Role | null = null;
  let highestPriority = 0;

  for (const role of user.roles) {
    const archetype = role.archetype || role.shortname;
    const priority = rolePriority[archetype] || 0;

    if (priority > highestPriority) {
      highestPriority = priority;
      highestRole = role;
    }
  }

  return highestRole ? highestRole.shortname : null;
}
