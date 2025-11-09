/**
 * User List Type Definitions
 *
 * TypeScript type definitions for user list queries, filtering, sorting, and pagination
 * in the admin user management interface. These types support comprehensive user list
 * operations including search, multi-field filtering, bulk actions, and customizable views.
 *
 * Based on Moodle admin user list functionality:
 * - Source: public/admin/user.php (user listing and filtering)
 * - Source: public/admin/user/user_bulk.php (bulk user operations)
 *
 * @package react-frontend
 * @subpackage features/admin/users/types
 */

import type { User } from './user.types';

/**
 * Sortable fields for user list
 *
 * Defines all columns that can be used for sorting the user list.
 * These correspond to key user table fields commonly used for ordering results.
 */
export enum UserSortField {
  /** Sort by username (alphabetical) */
  USERNAME = 'username',
  /** Sort by email address (alphabetical) */
  EMAIL = 'email',
  /** Sort by first name (alphabetical) */
  FIRSTNAME = 'firstname',
  /** Sort by last name (alphabetical) */
  LASTNAME = 'lastname',
  /** Sort by last access time (chronological) */
  LASTACCESS = 'lastaccess',
  /** Sort by account creation time (chronological) */
  TIMECREATED = 'timecreated',
}

/**
 * Sort order direction
 *
 * Specifies whether sorting should be ascending or descending.
 */
export enum SortOrder {
  /** Ascending order (A-Z, 0-9, oldest-newest) */
  ASC = 'asc',
  /** Descending order (Z-A, 9-0, newest-oldest) */
  DESC = 'desc',
}

/**
 * User filter status options
 *
 * Predefined filter combinations for common user status queries.
 * These provide quick access to frequently-used user subsets.
 */
export enum UserFilterStatus {
  /** Show all users regardless of status */
  ALL = 'all',
  /** Show only active users (confirmed, not suspended, not deleted) */
  ACTIVE = 'active',
  /** Show only suspended users */
  SUSPENDED = 'suspended',
  /** Show only deleted users */
  DELETED = 'deleted',
  /** Show only unconfirmed users (pending email confirmation) */
  UNCONFIRMED = 'unconfirmed',
}

/**
 * Pagination metadata
 *
 * Information about the current page and total available records.
 * Used for rendering pagination controls and calculating page boundaries.
 *
 * @interface PaginationMeta
 */
export interface PaginationMeta {
  /** Current page number (1-based indexing) */
  page: number;
  /** Number of records per page */
  perPage: number;
  /** Total number of records matching the current filters */
  total: number;
  /** Total number of pages available */
  totalPages: number;
}

/**
 * User list query parameters
 *
 * Complete set of parameters for querying the user list API endpoint.
 * Supports pagination, sorting, filtering by multiple criteria, and text search.
 *
 * All parameters are optional to allow flexible queries. Default values
 * are typically applied server-side when parameters are omitted.
 *
 * @interface UserListQueryParams
 */
export interface UserListQueryParams {
  /** Page number to retrieve (1-based, default: 1) */
  page?: number;
  /** Number of users per page (default: 50, max typically 200) */
  perPage?: number;
  /** Field to sort by (default: username) */
  sortBy?: UserSortField;
  /** Sort direction (default: ASC) */
  sortOrder?: SortOrder;

  /** Text search query - searches across username, email, firstname, lastname */
  search?: string;

  /** Predefined status filter (overrides individual status flags when set) */
  status?: UserFilterStatus;

  /** Filter by authentication method (e.g., 'manual', 'ldap', 'oauth2') */
  authMethod?: string;
  /** Filter by role ID or role shortname */
  role?: string | number;

  /** Filter by email confirmation status (0=unconfirmed, 1=confirmed) */
  confirmed?: number;
  /** Filter by suspension status (0=not suspended, 1=suspended) */
  suspended?: number;
  /** Filter by deletion status (0=not deleted, 1=deleted) */
  deleted?: number;
}

/**
 * Filter options available for the current context
 *
 * Provides the list of available filter values for dropdowns and multi-selects.
 * These are typically populated from the server based on system configuration
 * and available data.
 *
 * @interface FilterOptions
 */
export interface FilterOptions {
  /** List of authentication methods available in the system */
  authMethods: Array<{
    /** Authentication method plugin name (e.g., 'manual', 'ldap') */
    value: string;
    /** Display name for the authentication method */
    label: string;
  }>;
  /** List of roles that can be used for filtering */
  roles: Array<{
    /** Role ID or shortname */
    value: string | number;
    /** Display name of the role */
    label: string;
  }>;
  /** List of predefined status filters */
  statuses: Array<{
    /** Status filter value */
    value: UserFilterStatus;
    /** Display name for the status filter */
    label: string;
  }>;
}

/**
 * User list API response
 *
 * Standard response format for user list queries.
 * Contains the user data array, pagination metadata, and optional filter options.
 *
 * @interface UserListResponse
 */
export interface UserListResponse {
  /** Array of user records matching the query */
  data: User[];
  /** Pagination information for the current query */
  pagination: PaginationMeta;
  /** Optional metadata including available filter options */
  meta?: {
    /** Available filter options for dropdowns */
    filterOptions?: FilterOptions;
    /** Additional metadata as needed */
    [key: string]: unknown;
  };
}

/**
 * Column visibility configuration
 *
 * Controls which columns are displayed in the user list table.
 * Allows users to customize their view by showing/hiding specific columns.
 *
 * @interface ColumnVisibility
 */
export interface ColumnVisibility {
  /** Show username column (typically always visible) */
  username: boolean;
  /** Show email column */
  email: boolean;
  /** Show first name column */
  firstname: boolean;
  /** Show last name column */
  lastname: boolean;
  /** Show city column */
  city: boolean;
  /** Show country column */
  country: boolean;
  /** Show last access time column */
  lastaccess: boolean;
  /** Show authentication method column */
  auth: boolean;
  /** Show account status column (active/suspended/deleted) */
  status: boolean;
  /** Show email confirmation status column */
  confirmed: boolean;
}

/**
 * Bulk selection state
 *
 * Manages the state of bulk user selection for performing operations
 * on multiple users simultaneously (e.g., bulk delete, bulk suspend).
 *
 * @interface BulkSelectionState
 */
export interface BulkSelectionState {
  /** Array of selected user IDs */
  selectedUserIds: number[];
  /** Whether all users on all pages are selected (not just current page) */
  selectAll: boolean;
  /** Whether a bulk operation is currently in progress */
  isLoading: boolean;
}

/**
 * List view preferences
 *
 * User-specific preferences for the user list view.
 * These settings are typically persisted to allow users to maintain
 * their preferred view configuration across sessions.
 *
 * @interface ListViewPreferences
 */
export interface ListViewPreferences {
  /** Preferred number of users per page */
  perPage: number;
  /** Preferred sort field */
  sortBy: UserSortField;
  /** Preferred sort direction */
  sortOrder: SortOrder;
  /** Column visibility configuration */
  columnVisibility: ColumnVisibility;
}
