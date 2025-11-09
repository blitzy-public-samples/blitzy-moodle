/**
 * Moodle Role Management Type Definitions
 * 
 * Comprehensive TypeScript type definitions for the Moodle role management system.
 * Based on Moodle database schema (role, role_assignments, role_capabilities, context, capabilities tables)
 * from public/lib/db/install.xml and constants from public/lib/accesslib.php.
 * 
 * This module provides type safety for all role management operations including:
 * - Role CRUD operations
 * - Role assignments to users in contexts
 * - Capability permission management
 * - Context-based access control
 * 
 * @module features/admin/roles/types/role.types
 */

import type { UserId } from '@/types/common';

// ============================================================================
// Context Level Enum
// ============================================================================

/**
 * Context levels in Moodle's hierarchical permission system.
 * 
 * Based on constants defined in public/lib/accesslib.php:
 * - CONTEXT_SYSTEM = 10
 * - CONTEXT_USER = 30
 * - CONTEXT_COURSECAT = 40
 * - CONTEXT_COURSE = 50
 * - CONTEXT_MODULE = 70
 * - CONTEXT_BLOCK = 80
 * 
 * Context levels define the hierarchy of permission inheritance.
 * Lower numbered contexts are higher in the hierarchy.
 */
export enum ContextLevel {
  /** System context level - only one instance in every system */
  SYSTEM = 10,
  
  /** User context level - one instance for each user describing what others can do to user */
  USER = 30,
  
  /** Course category context level - one instance for each category */
  COURSECAT = 40,
  
  /** Course context level - one instance for each course */
  COURSE = 50,
  
  /** Course module context level - one instance for each course module */
  MODULE = 70,
  
  /** Block context level - one instance for each block */
  BLOCK = 80,
}

// ============================================================================
// Permission Enum
// ============================================================================

/**
 * Permission values for role capabilities.
 * 
 * Based on constants defined in public/lib/accesslib.php:
 * - CAP_INHERIT = 0
 * - CAP_ALLOW = 1
 * - CAP_PREVENT = -1
 * - CAP_PROHIBIT = -1000
 * 
 * Permission hierarchy (from strongest to weakest):
 * 1. PROHIBIT (-1000): Absolutely denies the capability, cannot be overridden
 * 2. ALLOW (1): Grants the capability
 * 3. PREVENT (-1): Denies the capability but can be overridden by ALLOW at lower context
 * 4. INHERIT (0): Uses permission from parent context (default)
 */
export enum Permission {
  /** Inherit permission from parent context (default) */
  INHERIT = 0,
  
  /** Allow/grant the capability */
  ALLOW = 1,
  
  /** Prevent/deny the capability (can be overridden at lower context) */
  PREVENT = -1,
  
  /** Prohibit the capability (cannot be overridden, strongest denial) */
  PROHIBIT = -1000,
}

// ============================================================================
// Role Archetype Enum
// ============================================================================

/**
 * Role archetypes used for role inheritance and default capabilities.
 * 
 * Based on get_role_archetypes() function in public/lib/accesslib.php.
 * Archetypes define the base set of capabilities for predefined role types.
 * Custom roles can be created without an archetype.
 */
export enum RoleArchetype {
  /** Site administrator or manager with full system access */
  manager = 'manager',
  
  /** User who can create new courses */
  coursecreator = 'coursecreator',
  
  /** Teacher with editing rights in courses */
  editingteacher = 'editingteacher',
  
  /** Teacher without editing rights (non-editing teacher) */
  teacher = 'teacher',
  
  /** Student enrolled in courses */
  student = 'student',
  
  /** Guest user with minimal access */
  guest = 'guest',
  
  /** Authenticated user (default for all logged-in users) */
  user = 'user',
  
  /** Frontpage role for site homepage */
  frontpage = 'frontpage',
}

// ============================================================================
// Context Interface
// ============================================================================

/**
 * Context entity representing a permission scope in Moodle's hierarchy.
 * 
 * Based on mdl_context table schema from public/lib/db/install.xml (lines 1201-1218).
 * Contexts define where permissions apply in the system hierarchy.
 * 
 * Examples:
 * - System context: contextlevel=10, instanceid=0, path="/1", depth=1
 * - Course context: contextlevel=50, instanceid=123, path="/1/3/45", depth=3
 * - Module context: contextlevel=70, instanceid=456, path="/1/3/45/789", depth=4
 */
export interface Context {
  /** Primary key (int 10) */
  id: number;
  
  /** Context level in hierarchy (SYSTEM=10, USER=30, COURSECAT=40, COURSE=50, MODULE=70, BLOCK=80) */
  contextlevel: ContextLevel;
  
  /** ID of the instance at this context level (course ID, module ID, etc.) */
  instanceid: number;
  
  /** Hierarchical path like "/1/3/45" representing parent contexts */
  path: string;
  
  /** Depth in context hierarchy (1 for system, increases for nested contexts) */
  depth: number;
  
  /** Whether this context and its children are locked from modifications */
  locked: boolean;
}

// ============================================================================
// Role Interface
// ============================================================================

/**
 * Role entity defining a set of permissions in Moodle.
 * 
 * Based on mdl_role table schema from public/lib/db/install.xml (lines 1184-1200).
 * Roles are assigned to users in specific contexts to grant capabilities.
 * 
 * Examples:
 * - Manager: shortname="manager", archetype="manager"
 * - Teacher: shortname="editingteacher", archetype="editingteacher"
 * - Student: shortname="student", archetype="student"
 */
export interface Role {
  /** Primary key (int 10) */
  id: number;
  
  /** Display name of the role (max 255 chars, empty names are auto-localised) */
  name: string;
  
  /** Unique identifier for the role (max 100 chars) */
  shortname: string;
  
  /** HTML description of the role and its purpose */
  description: string;
  
  /** Display ordering for role lists (unique index) */
  sortorder: number;
  
  /** Role archetype for default capabilities and inheritance (max 30 chars) */
  archetype: RoleArchetype;
}

// ============================================================================
// Role Assignment Interface
// ============================================================================

/**
 * Role assignment mapping a role to a user in a specific context.
 * 
 * Based on mdl_role_assignments table schema from public/lib/db/install.xml (lines 1304-1328).
 * Defines which users have which roles in which contexts.
 * 
 * Example:
 * - User 123 is assigned "teacher" role (roleid=4) in course context (contextid=45)
 * - User 456 is assigned "student" role (roleid=5) in course context (contextid=45)
 */
export interface RoleAssignment {
  /** Primary key (int 10) */
  id: number;
  
  /** Foreign key to role table */
  roleid: number;
  
  /** Foreign key to context table (where the role is assigned) */
  contextid: number;
  
  /** Foreign key to user table (who has this role) */
  userid: UserId;
  
  /** Unix timestamp when assignment was last modified (int 10) */
  timemodified: number;
  
  /** User ID who made or modified this assignment (int 10) */
  modifierid: UserId;
  
  /** Plugin responsible for role assignment (empty when manually assigned, max 100 chars) */
  component: string;
  
  /** ID of enrolment/auth instance responsible for this assignment (int 10) */
  itemid: number;
  
  /** Display ordering for role assignments (int 10) */
  sortorder: number;
}

// ============================================================================
// Role Capability Interface
// ============================================================================

/**
 * Role capability defining permission for a specific capability in a context.
 * 
 * Based on mdl_role_capabilities table schema from public/lib/db/install.xml (lines 1329-1349).
 * Overrides default capability permissions for a role in a specific context.
 * 
 * Example:
 * - In course context 45, teacher role (roleid=4) has "mod/assign:grade" capability set to ALLOW (1)
 * - In course context 45, student role (roleid=5) has "mod/assign:grade" capability set to PREVENT (-1)
 */
export interface RoleCapability {
  /** Primary key (int 10) */
  id: number;
  
  /** Foreign key to context table (where permission applies) */
  contextid: number;
  
  /** Foreign key to role table (which role has this permission) */
  roleid: number;
  
  /** Capability name like "moodle/role:assign" or "mod/assign:grade" (max 255 chars) */
  capability: string;
  
  /** Permission value (INHERIT=0, ALLOW=1, PREVENT=-1, PROHIBIT=-1000) */
  permission: Permission;
  
  /** Unix timestamp when capability was last modified (int 10) */
  timemodified: number;
  
  /** User ID who modified this capability (int 10) */
  modifierid: UserId;
}

// ============================================================================
// Capability Interface
// ============================================================================

/**
 * Capability definition for a system-wide permission.
 * 
 * Based on mdl_capabilities table schema from public/lib/db/install.xml (lines 1230-1243).
 * Defines all available capabilities in the system that can be assigned to roles.
 * 
 * Example:
 * - name="mod/assign:grade", component="mod_assign", contextlevel=MODULE (70)
 * - name="moodle/course:create", component="moodle", contextlevel=COURSECAT (40)
 */
export interface Capability {
  /** Primary key (int 10) */
  id: number;
  
  /** Unique capability name like "moodle/role:assign" (max 255 chars, unique index) */
  name: string;
  
  /** Capability type (read, write, etc., max 50 chars) */
  captype: string;
  
  /** Default context level where this capability applies (int 10) */
  contextlevel: ContextLevel;
  
  /** Component that owns this capability (max 100 chars) */
  component: string;
  
  /** Risk level flags (bitmask of RISK_* constants, int 10) */
  riskbitmask: number;
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Role with associated context information and assignment statistics.
 * 
 * Used for displaying roles in lists with contextual data.
 */
export interface RoleWithContext {
  /** The role entity */
  role: Role;
  
  /** Context where this role is being viewed/managed */
  context: Context;
  
  /** Number of users assigned to this role in this context */
  assignmentCount: number;
}

/**
 * Request payload for creating or updating a role assignment.
 * 
 * Used by POST /api/v1/admin/roles/assign endpoint.
 */
export interface RoleAssignmentRequest {
  /** Foreign key to role table */
  roleid: number;
  
  /** Foreign key to context table (where to assign the role) */
  contextid: number;
  
  /** Foreign key to user table (who to assign the role to) */
  userid: UserId;
  
  /** Optional: Plugin responsible for assignment (empty for manual) */
  component?: string;
  
  /** Optional: Enrolment/auth instance ID */
  itemid?: number;
}

/**
 * Request payload for modifying capability permissions for a role.
 * 
 * Used by PUT /api/v1/admin/roles/capabilities endpoint.
 */
export interface RoleCapabilityRequest {
  /** Foreign key to context table (where to set permission) */
  contextid: number;
  
  /** Foreign key to role table (which role to modify) */
  roleid: number;
  
  /** Capability name to modify (e.g., "mod/assign:grade") */
  capability: string;
  
  /** New permission value (INHERIT, ALLOW, PREVENT, or PROHIBIT) */
  permission: Permission;
}

/**
 * Array of context levels where a role can be assigned.
 * 
 * Based on mdl_role_context_levels table (lines 1366-1377).
 * Defines which context levels are valid for assigning a specific role.
 */
export type AllowedContextLevels = ContextLevel[];

/**
 * Filter criteria for searching and filtering roles.
 * 
 * Used in role list and search operations.
 */
export interface RoleFilters {
  /** Filter by role archetype */
  archetype?: RoleArchetype;
  
  /** Filter by context level where role can be assigned */
  contextLevel?: ContextLevel;
  
  /** Search query for role name or shortname */
  searchQuery?: string;
}

/**
 * Sort order options for role lists.
 * 
 * Defines how roles should be ordered in lists.
 */
export type RoleSortOrder = 'sortorder' | 'name' | 'shortname' | 'archetype';
