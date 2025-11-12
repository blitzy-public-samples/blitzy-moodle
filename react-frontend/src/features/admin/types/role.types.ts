/**
 * Role and Permissions Management Type Definitions
 *
 * Comprehensive TypeScript type definitions for Moodle's role-based access control system.
 * Based on Moodle's role, role_assignments, role_capabilities, and context database tables.
 *
 * The role system in Moodle provides:
 * - Role definitions with standard archetypes
 * - Role assignments linking users to roles in specific contexts
 * - Role capabilities defining permissions for each role
 * - Context-based permission inheritance
 *
 * All types follow TypeScript strict mode with no 'any' types.
 *
 * @module features/admin/types/role
 */

import type { Timestamp } from '@/types/common';
import type { AdminFilterBase } from '@/features/admin/types/admin.types';

// ============================================================================
// Role Archetype Enum
// ============================================================================

/**
 * Standard role archetypes in Moodle.
 * Each archetype represents a predefined role template with specific capabilities.
 *
 * Corresponds to the 'archetype' field in mdl_role table.
 *
 * @enum {string}
 *
 * @see {@link https://docs.moodle.org/dev/Roles|Moodle Roles Documentation}
 */
export enum RoleArchetype {
  /**
   * Manager role - full administrative access to courses and categories.
   * Can manage course settings, users, and content.
   */
  MANAGER = 'manager',

  /**
   * Course creator role - can create new courses and manage course categories.
   * Typically assigned at category or system context.
   */
  COURSECREATOR = 'coursecreator',

  /**
   * Editing teacher role - full control over course content and activities.
   * Can edit activities, grade submissions, and manage enrolled users.
   */
  EDITINGTEACHER = 'editingteacher',

  /**
   * Non-editing teacher role - can teach and grade but cannot edit course structure.
   * Can view content, grade assignments, participate in activities.
   */
  TEACHER = 'teacher',

  /**
   * Student role - standard learner role with access to view and participate.
   * Can view content, submit assignments, take quizzes.
   */
  STUDENT = 'student',

  /**
   * Guest role - minimal read-only access to public content.
   * Cannot submit work or participate in most activities.
   */
  GUEST = 'guest',

  /**
   * Authenticated user role - default role for all logged-in users.
   * Provides baseline capabilities at system level.
   */
  USER = 'user',

  /**
   * Front page role - special role for front page access.
   * Typically used for site-wide announcements and resources.
   */
  FRONTPAGE = 'frontpage',
}

// ============================================================================
// Context Level Enum
// ============================================================================

/**
 * Context levels in Moodle's permission hierarchy.
 * Contexts define where permissions apply and how they inherit.
 *
 * Corresponds to the 'contextlevel' field in mdl_context table.
 * Moodle uses numeric values: SYSTEM=10, USER=30, COURSECAT=40, COURSE=50, MODULE=70, BLOCK=80.
 *
 * @enum {number}
 *
 * @see {@link https://docs.moodle.org/dev/Context|Moodle Context Documentation}
 */
export enum ContextLevel {
  /**
   * System context (level 10) - highest level, applies site-wide.
   * Used for global settings and system-wide capabilities.
   */
  SYSTEM = 10,

  /**
   * User context (level 30) - user's personal space.
   * Used for user profile, private files, and personal dashboard.
   */
  USER = 30,

  /**
   * Course category context (level 40) - course category and subcategories.
   * Used for organizing courses and delegating course creation.
   */
  COURSECAT = 40,

  /**
   * Course context (level 50) - individual course.
   * Most common context for role assignments (teachers, students).
   */
  COURSE = 50,

  /**
   * Activity module context (level 70) - individual activity or resource.
   * Used for activity-specific permissions (e.g., forum moderator).
   */
  MODULE = 70,

  /**
   * Block context (level 80) - individual block instance.
   * Used for block-specific permissions (e.g., who can configure a block).
   */
  BLOCK = 80,
}

// ============================================================================
// Capability Permission Enum
// ============================================================================

/**
 * Permission values for role capabilities.
 * Defines whether a capability is allowed, prohibited, or inherited.
 *
 * Corresponds to the 'permission' field in mdl_role_capabilities table.
 * Moodle uses numeric values: INHERIT=0, ALLOW=1, PREVENT=-1, PROHIBIT=-1000.
 *
 * @enum {number}
 *
 * @see {@link https://docs.moodle.org/dev/Hardening_new_Roles_system|Moodle Permissions Documentation}
 */
export enum CapabilityPermission {
  /**
   * Inherit permission from parent context (value: 0).
   * Default state - capability is not explicitly set at this level.
   */
  INHERIT = 0,

  /**
   * Allow the capability (value: 1).
   * Explicitly grants permission for this capability.
   */
  ALLOW = 1,

  /**
   * Prevent the capability (value: -1).
   * Overrides 'Allow' from parent contexts, but can be overridden by 'Prohibit'.
   */
  PREVENT = -1,

  /**
   * Prohibit the capability (value: -1000).
   * Strongest restriction - cannot be overridden by 'Allow' in child contexts.
   */
  PROHIBIT = -1000,
}

// ============================================================================
// Role Interface
// ============================================================================

/**
 * Role definition interface.
 * Represents a role in Moodle's role-based access control system.
 *
 * Corresponds to the mdl_role database table.
 *
 * @interface
 *
 * @example
 * const teacherRole: Role = {
 *   id: 3,
 *   name: 'Teacher',
 *   shortname: 'editingteacher',
 *   description: 'Teachers can do anything within a course, including changing activities and grading students.',
 *   sortorder: 3,
 *   archetype: RoleArchetype.EDITINGTEACHER
 * };
 */
export interface Role {
  /**
   * Unique role identifier.
   * Corresponds to 'id' field in mdl_role table (int 10, primary key).
   */
  id: number;

  /**
   * Full role name for display.
   * Corresponds to 'name' field in mdl_role table (varchar 254).
   * Can be customized by site administrators.
   *
   * @example "Teacher", "Student", "Course Manager"
   */
  name: string;

  /**
   * System shortname for the role.
   * Corresponds to 'shortname' field in mdl_role table (varchar 100).
   * Used internally and cannot contain spaces.
   *
   * @example "editingteacher", "student", "manager"
   */
  shortname: string;

  /**
   * Detailed description of role purpose and capabilities.
   * Corresponds to 'description' field in mdl_role table (longtext).
   * Shown to administrators when assigning roles.
   */
  description: string;

  /**
   * Sort order for displaying roles in lists.
   * Corresponds to 'sortorder' field in mdl_role table (int 10).
   * Lower numbers appear first in role selection interfaces.
   */
  sortorder: number;

  /**
   * Role archetype defining the default permission template.
   * Corresponds to 'archetype' field in mdl_role table (varchar 30).
   * Determines initial capabilities when role is created.
   */
  archetype: RoleArchetype;
}

// ============================================================================
// Role Assignment Interface
// ============================================================================

/**
 * Role assignment interface linking users to roles in specific contexts.
 * Represents the assignment of a role to a user within a particular context.
 *
 * Corresponds to the mdl_role_assignments database table.
 *
 * @interface
 *
 * @example
 * const teacherAssignment: RoleAssignment = {
 *   id: 1523,
 *   roleid: 3,
 *   contextid: 45,
 *   userid: 102,
 *   timemodified: 1640000000,
 *   modifierid: 2,
 *   component: '',
 *   itemid: 0,
 *   sortorder: 0
 * };
 */
export interface RoleAssignment {
  /**
   * Unique assignment identifier.
   * Corresponds to 'id' field in mdl_role_assignments table (int 10, primary key).
   */
  id: number;

  /**
   * ID of the role being assigned.
   * Corresponds to 'roleid' field in mdl_role_assignments table (int 10, foreign key to mdl_role).
   * References Role.id.
   */
  roleid: number;

  /**
   * ID of the context where the role is assigned.
   * Corresponds to 'contextid' field in mdl_role_assignments table (int 10, foreign key to mdl_context).
   * References Context.id.
   */
  contextid: number;

  /**
   * ID of the user being assigned the role.
   * Corresponds to 'userid' field in mdl_role_assignments table (int 10, foreign key to mdl_user).
   * The user who receives the role and its capabilities.
   */
  userid: number;

  /**
   * Unix timestamp when the assignment was last modified.
   * Corresponds to 'timemodified' field in mdl_role_assignments table (int 10).
   * Used for audit trails and change tracking.
   */
  timemodified: Timestamp;

  /**
   * ID of the user who created or last modified this assignment.
   * Corresponds to 'modifierid' field in mdl_role_assignments table (int 10, foreign key to mdl_user).
   * Used for audit trails to track who assigned the role.
   */
  modifierid: number;

  /**
   * Frankenstyle component name for plugin-controlled assignments.
   * Corresponds to 'component' field in mdl_role_assignments table (varchar 100).
   * Empty string for manual assignments, plugin name for automated assignments.
   *
   * @example "enrol_manual", "enrol_cohort", ""
   */
  component: string;

  /**
   * Item ID for plugin-specific assignment context.
   * Corresponds to 'itemid' field in mdl_role_assignments table (int 10).
   * Used by plugins to link assignment to specific enrollment or group.
   * Zero for manual assignments.
   */
  itemid: number;

  /**
   * Sort order for displaying multiple role assignments.
   * Corresponds to 'sortorder' field in mdl_role_assignments table (int 10).
   * Typically zero, but can be used to prioritize role display order.
   */
  sortorder: number;
}

// ============================================================================
// Role Capability Interface
// ============================================================================

/**
 * Role capability interface defining permissions for a role.
 * Represents a specific capability's permission value for a role in a context.
 *
 * Corresponds to the mdl_role_capabilities database table.
 *
 * @interface
 *
 * @example
 * const gradePermission: RoleCapability = {
 *   id: 8452,
 *   contextid: 45,
 *   roleid: 3,
 *   capability: 'mod/assign:grade',
 *   permission: CapabilityPermission.ALLOW,
 *   timemodified: 1640000000,
 *   modifierid: 2
 * };
 */
export interface RoleCapability {
  /**
   * Unique capability assignment identifier.
   * Corresponds to 'id' field in mdl_role_capabilities table (int 10, primary key).
   */
  id: number;

  /**
   * ID of the context where this capability is defined.
   * Corresponds to 'contextid' field in mdl_role_capabilities table (int 10, foreign key to mdl_context).
   * References Context.id where this permission applies.
   */
  contextid: number;

  /**
   * ID of the role this capability applies to.
   * Corresponds to 'roleid' field in mdl_role_capabilities table (int 10, foreign key to mdl_role).
   * References Role.id.
   */
  roleid: number;

  /**
   * Capability name in Moodle's capability system.
   * Corresponds to 'capability' field in mdl_role_capabilities table (varchar 255).
   * Follows format: component/module:action.
   *
   * @example "mod/assign:submit", "moodle/course:view", "moodle/user:update"
   */
  capability: string;

  /**
   * Permission value for this capability.
   * Corresponds to 'permission' field in mdl_role_capabilities table (int 10).
   * Determines whether capability is allowed, prevented, or prohibited.
   */
  permission: CapabilityPermission;

  /**
   * Unix timestamp when the capability permission was last modified.
   * Corresponds to 'timemodified' field in mdl_role_capabilities table (int 10).
   * Used for audit trails and change tracking.
   */
  timemodified: Timestamp;

  /**
   * ID of the user who last modified this capability permission.
   * Corresponds to 'modifierid' field in mdl_role_capabilities table (int 10, foreign key to mdl_user).
   * Used for audit trails to track permission changes.
   */
  modifierid: number;
}

// ============================================================================
// Capability Interface
// ============================================================================

/**
 * Capability definition interface.
 * Represents a permission that can be checked in Moodle's capability system.
 *
 * Corresponds to the mdl_capabilities database table.
 *
 * @interface
 *
 * @example
 * const submitCapability: Capability = {
 *   name: 'mod/assign:submit',
 *   captype: 'write',
 *   contextlevel: ContextLevel.MODULE,
 *   component: 'mod_assign',
 *   riskbitmask: 4
 * };
 */
export interface Capability {
  /**
   * Unique capability name following Moodle naming convention.
   * Corresponds to 'name' field in mdl_capabilities table (varchar 255, primary key).
   * Format: component/module:action.
   *
   * @example "mod/assign:submit", "moodle/course:view", "moodle/site:config"
   */
  name: string;

  /**
   * Type of capability indicating read or write operation.
   * Corresponds to 'captype' field in mdl_capabilities table (varchar 50).
   *
   * @example "read", "write"
   */
  captype: string;

  /**
   * Minimum context level where this capability can be assigned.
   * Corresponds to 'contextlevel' field in mdl_capabilities table (int 10).
   * Restricts where capability can be checked or assigned.
   */
  contextlevel: ContextLevel;

  /**
   * Frankenstyle component name that defines this capability.
   * Corresponds to 'component' field in mdl_capabilities table (varchar 100).
   *
   * @example "moodle", "mod_assign", "block_calendar_month"
   */
  component: string;

  /**
   * Risk bitmask indicating security risks associated with capability.
   * Corresponds to 'riskbitmask' field in mdl_capabilities table (int 10).
   *
   * Bit flags:
   * - 1: RISK_SPAM - Can send spam
   * - 2: RISK_PERSONAL - Access to personal information
   * - 4: RISK_XSS - Cross-site scripting vulnerability
   * - 8: RISK_CONFIG - Can change site configuration
   * - 16: RISK_MANAGETRUST - Can manage trust settings
   * - 32: RISK_DATALOSS - Can delete data
   *
   * @example 0 (no risk), 4 (XSS risk), 36 (config + dataloss)
   */
  riskbitmask: number;
}

// ============================================================================
// Context Interface
// ============================================================================

/**
 * Context interface representing a permission scope in Moodle.
 * Contexts define where permissions are checked and how they inherit.
 *
 * Corresponds to the mdl_context database table.
 *
 * @interface
 *
 * @example
 * const courseContext: Context = {
 *   id: 45,
 *   contextlevel: ContextLevel.COURSE,
 *   instanceid: 12,
 *   path: '/1/40/45',
 *   depth: 3,
 *   locked: 0
 * };
 */
export interface Context {
  /**
   * Unique context identifier.
   * Corresponds to 'id' field in mdl_context table (int 10, primary key).
   */
  id: number;

  /**
   * Context level in the hierarchy.
   * Corresponds to 'contextlevel' field in mdl_context table (int 10).
   * Determines the type of context (system, course, module, etc.).
   */
  contextlevel: ContextLevel;

  /**
   * ID of the instance at this context level.
   * Corresponds to 'instanceid' field in mdl_context table (int 10).
   *
   * - SYSTEM: always 0
   * - USER: userid from mdl_user
   * - COURSECAT: category id from mdl_course_categories
   * - COURSE: courseid from mdl_course
   * - MODULE: course module id from mdl_course_modules
   * - BLOCK: block instance id from mdl_block_instances
   */
  instanceid: number;

  /**
   * Path to this context in the context hierarchy.
   * Corresponds to 'path' field in mdl_context table (varchar 255).
   * Slash-separated list of context IDs from system to current context.
   *
   * @example "/1" (system), "/1/40/45" (course), "/1/40/45/123" (module)
   */
  path: string;

  /**
   * Depth of this context in the hierarchy.
   * Corresponds to 'depth' field in mdl_context table (int 2).
   * System context has depth 1, increases for each level.
   */
  depth: number;

  /**
   * Lock status of the context.
   * Corresponds to 'locked' field in mdl_context table (tinyint 2).
   *
   * - 0: Not locked
   * - 1: Locked (prevents role assignments and capability changes)
   */
  locked: number;
}

// ============================================================================
// Filter Interfaces
// ============================================================================

/**
 * Filter interface for querying roles.
 * Extends AdminFilterBase with role-specific filtering options.
 *
 * Used by role list API endpoints to filter and paginate role results.
 *
 * @interface
 * @extends {AdminFilterBase}
 *
 * @example
 * const filter: RoleFilter = {
 *   search: 'teacher',
 *   archetype: RoleArchetype.EDITINGTEACHER,
 *   sortBy: 'sortorder',
 *   sortOrder: 'asc',
 *   page: 1,
 *   perPage: 20
 * };
 */
export interface RoleFilter extends AdminFilterBase {
  /**
   * Search query for role name or shortname.
   * Inherited from AdminFilterBase.
   * @optional
   */
  search?: string;

  /**
   * Filter by role archetype.
   * Only returns roles matching the specified archetype.
   * @optional
   */
  archetype?: RoleArchetype;

  /**
   * Field to sort results by.
   * Inherited from AdminFilterBase.
   * @optional
   */
  sortBy?: string;

  /**
   * Sort order (ascending or descending).
   * Inherited from AdminFilterBase.
   * @optional
   */
  sortOrder?: 'asc' | 'desc';

  /**
   * Current page number (1-indexed).
   * Inherited from AdminFilterBase.
   * @optional
   */
  page?: number;

  /**
   * Number of items per page.
   * Inherited from AdminFilterBase.
   * @optional
   */
  perPage?: number;
}

/**
 * Filter interface for querying role capabilities.
 * Extends AdminFilterBase with capability-specific filtering options.
 *
 * Used by role capability API endpoints to filter permission configurations.
 *
 * @interface
 * @extends {AdminFilterBase}
 *
 * @example
 * const filter: RoleCapabilityFilter = {
 *   roleid: 3,
 *   contextid: 45,
 *   capability: 'mod/assign:grade',
 *   permission: CapabilityPermission.ALLOW,
 *   page: 1,
 *   perPage: 50
 * };
 */
export interface RoleCapabilityFilter extends AdminFilterBase {
  /**
   * Search query for capability name.
   * Inherited from AdminFilterBase.
   * @optional
   */
  search?: string;

  /**
   * Filter by specific role ID.
   * Only returns capabilities for the specified role.
   * @optional
   */
  roleid?: number;

  /**
   * Filter by specific context ID.
   * Only returns capabilities defined in the specified context.
   * @optional
   */
  contextid?: number;

  /**
   * Filter by capability name pattern.
   * Can use wildcards for partial matching (e.g., 'mod/assign:*').
   * @optional
   */
  capability?: string;

  /**
   * Filter by permission value.
   * Only returns capabilities with the specified permission.
   * @optional
   */
  permission?: CapabilityPermission;

  /**
   * Field to sort results by.
   * Inherited from AdminFilterBase.
   * @optional
   */
  sortBy?: string;

  /**
   * Sort order (ascending or descending).
   * Inherited from AdminFilterBase.
   * @optional
   */
  sortOrder?: 'asc' | 'desc';

  /**
   * Current page number (1-indexed).
   * Inherited from AdminFilterBase.
   * @optional
   */
  page?: number;

  /**
   * Number of items per page.
   * Inherited from AdminFilterBase.
   * @optional
   */
  perPage?: number;
}
