/**
 * Admin Feature Type Definitions
 *
 * Comprehensive TypeScript type definitions for the admin feature domain.
 * Based on Moodle's admin PHP structures and database schema.
 * Provides common types shared across all admin subdomains including:
 * - User management
 * - Course administration
 * - Role management
 * - System settings
 *
 * All types follow TypeScript strict mode with no 'any' types.
 *
 * @module features/admin/types
 */

import type { SortOrder } from '@/types/common';

// ============================================================================
// Admin Action Enum
// ============================================================================

/**
 * Standard administrative actions available across admin features.
 * Maps to common operations performed by site administrators.
 *
 * @enum {string}
 */
export enum AdminAction {
  /** Create a new entity (user, course, role, etc.) */
  CREATE = 'create',

  /** Update an existing entity */
  UPDATE = 'update',

  /** Permanently delete an entity */
  DELETE = 'delete',

  /** Enable a disabled entity (make active) */
  ENABLE = 'enable',

  /** Disable an active entity (make inactive without deleting) */
  DISABLE = 'disable',

  /** Suspend an entity (temporary deactivation, reversible) */
  SUSPEND = 'suspend',

  /** Unsuspend a previously suspended entity */
  UNSUSPEND = 'unsuspend',

  /** Archive an entity (long-term storage, no longer active) */
  ARCHIVE = 'archive',

  /** Restore an archived entity back to active state */
  RESTORE = 'restore',
}

// ============================================================================
// Permission Types
// ============================================================================

/**
 * Admin permission type representing Moodle capabilities.
 * Corresponds to Moodle's capability system for access control.
 *
 * Common admin capabilities include:
 * - 'moodle/site:config' - Configure site settings
 * - 'moodle/user:create' - Create users
 * - 'moodle/user:delete' - Delete users
 * - 'moodle/user:update' - Update users
 * - 'moodle/course:create' - Create courses
 * - 'moodle/role:assign' - Assign roles
 * - 'moodle/role:manage' - Manage role definitions
 *
 * @see {@link https://docs.moodle.org/dev/Capabilities|Moodle Capabilities Documentation}
 */
export type AdminPermission = string;

// ============================================================================
// Base Entity Interface
// ============================================================================

/**
 * Base interface for all admin entities with common fields.
 * Mirrors Moodle's database standard fields (id, timecreated, timemodified).
 *
 * All admin entities (users, courses, roles, etc.) extend this interface.
 *
 * @interface
 */
export interface AdminEntityBase {
  /**
   * Unique identifier for the entity
   * Corresponds to primary key in Moodle database tables (int 10)
   */
  id: number;

  /**
   * Unix timestamp when the entity was created
   * Corresponds to 'timecreated' field in Moodle database (int 10)
   */
  timecreated: number;

  /**
   * Unix timestamp when the entity was last modified
   * Corresponds to 'timemodified' field in Moodle database (int 10)
   */
  timemodified: number;
}

// ============================================================================
// Sorting Types
// ============================================================================

/**
 * Common sortable fields available across admin entities.
 * Union type of standard sort fields used in admin interfaces.
 */
export type AdminSortField =
  | 'id'
  | 'name'
  | 'firstname'
  | 'lastname'
  | 'email'
  | 'username'
  | 'timecreated'
  | 'timemodified'
  | 'lastaccess'
  | 'status';

// ============================================================================
// Filter and Pagination Interfaces
// ============================================================================

/**
 * Base filter interface for admin data queries.
 * Provides common filtering, sorting, and pagination parameters.
 *
 * Used as a base for specific filter types (UserFilter, CourseFilter, etc.)
 *
 * @interface
 */
export interface AdminFilterBase {
  /**
   * Search query string for filtering results
   * Typically searches across name, email, username fields
   * @optional
   */
  search?: string;

  /**
   * Current page number for pagination (1-indexed)
   * @default 1
   */
  page?: number;

  /**
   * Number of items to return per page
   * @default 20
   */
  perPage?: number;

  /**
   * Field to sort results by
   * @optional
   */
  sortBy?: string;

  /**
   * Sort direction (ascending or descending)
   * Imported from common types for consistency
   * @optional
   * @default 'asc'
   */
  sortOrder?: SortOrder;
}

/**
 * Pagination parameters interface for admin data responses.
 * Contains pagination metadata returned by API endpoints.
 *
 * Matches Moodle's pagination structure and AdminFilterBase pagination fields.
 *
 * @interface
 */
export interface AdminPaginationParams {
  /**
   * Current page number (1-indexed)
   */
  page: number;

  /**
   * Number of items per page
   */
  perPage: number;

  /**
   * Total number of items across all pages
   */
  total: number;

  /**
   * Total number of pages (calculated from total / perPage)
   */
  totalPages: number;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response wrapper for admin endpoints.
 * Generic type that wraps all admin API responses with consistent structure.
 *
 * Supports both successful responses with data and error responses.
 * Follows the standard envelope pattern defined in the API layer.
 *
 * @template T - The type of data returned on success
 * @interface
 *
 * @example
 * // Success response
 * const response: AdminResponse<User> = {
 *   success: true,
 *   data: { id: 1, username: 'admin', ... }
 * };
 *
 * @example
 * // Error response
 * const response: AdminResponse<User> = {
 *   success: false,
 *   error: {
 *     code: 'PERMISSION_DENIED',
 *     message: 'You do not have permission to perform this action'
 *   }
 * };
 *
 * @example
 * // Paginated response
 * const response: AdminResponse<User[]> = {
 *   success: true,
 *   data: [{ id: 1, ... }, { id: 2, ... }],
 *   meta: {
 *     pagination: { page: 1, perPage: 20, total: 100, totalPages: 5 }
 *   }
 * };
 */
export interface AdminResponse<T> {
  /**
   * Indicates whether the operation was successful
   * true = success with data, false = error occurred
   */
  success: boolean;

  /**
   * Response data on successful operation
   * Only present when success is true
   * @optional
   */
  data?: T;

  /**
   * Error information on failed operation
   * Only present when success is false
   * @optional
   */
  error?: {
    /**
     * Error code for programmatic handling
     * Examples: 'PERMISSION_DENIED', 'NOT_FOUND', 'VALIDATION_ERROR'
     */
    code: string;

    /**
     * Human-readable error message
     */
    message: string;

    /**
     * Additional error details (field errors, context, etc.)
     * @optional
     */
    details?: Record<string, unknown>;
  };

  /**
   * Response metadata (pagination, timestamps, etc.)
   * @optional
   */
  meta?: {
    /**
     * Pagination information for list responses
     * @optional
     */
    pagination?: AdminPaginationParams;

    /**
     * Additional metadata fields
     */
    [key: string]: unknown;
  };
}

// ============================================================================
// Bulk Action Types
// ============================================================================

/**
 * Result of bulk administrative operations.
 * Provides summary statistics and error details for bulk actions.
 *
 * Used when performing operations on multiple entities simultaneously
 * (e.g., bulk user deletion, bulk course updates).
 *
 * @interface
 *
 * @example
 * const result: BulkActionResult = {
 *   successCount: 45,
 *   failureCount: 5,
 *   totalCount: 50,
 *   errors: [
 *     { id: 10, error: 'User has active enrollments' },
 *     { id: 23, error: 'Permission denied' }
 *   ]
 * };
 */
export interface BulkActionResult {
  /**
   * Number of entities successfully processed
   */
  successCount: number;

  /**
   * Number of entities that failed to process
   */
  failureCount: number;

  /**
   * Total number of entities attempted
   * Should equal successCount + failureCount
   */
  totalCount: number;

  /**
   * Array of errors for failed operations
   * Each entry includes entity identifier and error message
   */
  errors: Array<{
    /**
     * ID of the entity that failed
     */
    id: number;

    /**
     * Error message explaining the failure
     */
    error: string;

    /**
     * Optional error code for programmatic handling
     */
    code?: string;
  }>;
}
