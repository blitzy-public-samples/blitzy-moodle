/**
 * Admin Types Barrel Export
 *
 * Centralized export point for all admin feature type definitions.
 * This barrel file aggregates and re-exports types from all admin subdomain modules.
 *
 * Purpose:
 * - Enables clean imports: `import { User, Role } from '@/features/admin/types'`
 * - Avoids deep imports: No need for `import { User } from '@/features/admin/types/user.types'`
 * - Provides single source of truth for admin type dependencies
 * - Simplifies refactoring if internal structure changes
 *
 * Exported Type Categories:
 * - Common admin types (AdminAction, AdminPermission, AdminEntityBase, etc.)
 * - User management types (User, UserFilter, UserBulkAction, etc.)
 * - Role management types (Role, RoleAssignment, Capability, etc.)
 * - Course administration types (CourseCategory, CourseBulkAction, etc.)
 * - System settings types (SystemSetting, PluginConfig, etc.)
 *
 * @module features/admin/types
 */

// ============================================================================
// Common Admin Types
// ============================================================================

/**
 * Re-export all common admin type definitions.
 *
 * Includes:
 * - AdminAction enum (CREATE, UPDATE, DELETE, ENABLE, DISABLE, SUSPEND, etc.)
 * - AdminPermission type (Moodle capability strings)
 * - AdminEntityBase interface (id, timecreated, timemodified)
 * - AdminSortField type (common sortable fields)
 * - AdminFilterBase interface (search, pagination, sorting)
 * - AdminPaginationParams interface (page, perPage, total, totalPages)
 * - AdminResponse<T> interface (success, data, error, meta wrapper)
 * - BulkActionResult interface (successCount, failureCount, errors)
 */
export * from './admin.types';

// ============================================================================
// User Management Types
// ============================================================================

/**
 * Re-export all user management type definitions.
 *
 * Includes:
 * - User interface (complete mdl_user table schema mapping)
 * - UserFilter interface (extends AdminFilterBase with user-specific filters)
 * - UserBulkAction enum (DELETE, SUSPEND, CONFIRM, etc.)
 * - UserFormData interface (data for user create/edit forms)
 * - UserStatus enum (ACTIVE, SUSPENDED, DELETED)
 * - UserAuthMethod type (manual, ldap, oauth2, shibboleth, etc.)
 * - UserPreferences interface (user settings and preferences)
 */
export * from './user.types';

// ============================================================================
// Role and Permissions Management Types
// ============================================================================

/**
 * Re-export all role and permissions management type definitions.
 *
 * Includes:
 * - Role interface (mdl_role table mapping)
 * - RoleAssignment interface (user-role-context assignments)
 * - RoleCapability interface (role-capability-permission mappings)
 * - Capability interface (capability definitions with risk levels)
 * - Context interface (context hierarchy for permissions)
 * - RoleArchetype enum (MANAGER, TEACHER, STUDENT, etc.)
 * - ContextLevel enum (SYSTEM, CATEGORY, COURSE, MODULE, USER, BLOCK)
 * - CapabilityPermission enum (ALLOW, PREVENT, PROHIBIT)
 * - RoleFilter interface (role filtering and search parameters)
 */
export * from './role.types';

// ============================================================================
// Course Administration Types
// ============================================================================

/**
 * Re-export all course administration type definitions.
 *
 * Includes:
 * - CourseCategory interface (mdl_course_categories table mapping)
 * - CourseAdminData interface (extended course data for admin operations)
 * - CourseBulkAction enum (MOVE, DELETE, HIDE, SHOW, BACKUP, RESTORE)
 * - CategoryFormData interface (category create/edit form data)
 * - CategoryFilter interface (category filtering parameters)
 * - CategoryTreeNode interface (hierarchical category tree structure)
 * - CourseVisibility enum (VISIBLE, HIDDEN)
 * - CourseSortField enum (NAME, IDNUMBER, TIMECREATED, TIMEMODIFIED)
 */
export * from './course.types';

// ============================================================================
// System Settings and Configuration Types
// ============================================================================

/**
 * Re-export all system settings and configuration type definitions.
 *
 * Includes:
 * - SystemSetting interface (mdl_config table mapping)
 * - PluginConfig interface (mdl_config_plugins table mapping)
 * - SettingCategory enum (GENERAL, APPEARANCE, COURSES, USERS, etc.)
 * - SettingType enum (TEXT, BOOL, SELECT, MULTISELECT, TEXTAREA, etc.)
 * - SettingFormData interface (settings form submission data)
 * - ConfigLog interface (configuration change audit log)
 * - PluginInfo interface (installed plugin information)
 */
export * from './settings.types';
