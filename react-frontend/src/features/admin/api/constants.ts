/**
 * Admin API Constants
 * 
 * Constant definitions for admin API operations including base paths,
 * endpoint mappings, pagination defaults, bulk operation types, sort orders,
 * and permission identifiers. Centralizes all admin API configuration values
 * to ensure consistency across the admin feature subdomains.
 * 
 * @module features/admin/api/constants
 */

/**
 * Base path for all admin API endpoints
 * All admin-related API calls will be prefixed with this base path
 */
export const ADMIN_API_BASE = '/api/v1/admin';

/**
 * Default pagination size for admin lists
 * Used when no page size is specified by the user
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Maximum allowed page size for pagination
 * Prevents excessive data fetching in a single request
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Admin API endpoint paths organized by resource type
 * Provides a single source of truth for all admin endpoint URLs
 */
export const ADMIN_ENDPOINTS = {
  /**
   * User management endpoints
   */
  users: {
    /** List all users with pagination and filtering */
    list: '/users',
    /** Create a new user */
    create: '/users',
    /** Update an existing user by ID */
    update: '/users/:id',
    /** Delete a user by ID */
    delete: '/users/:id',
    /** Perform bulk operations on multiple users */
    bulk: '/users/bulk',
  },
  
  /**
   * Course management endpoints
   */
  courses: {
    /** List all courses with pagination and filtering */
    list: '/courses',
    /** Get and manage course categories */
    categories: '/courses/categories',
    /** Perform bulk operations on multiple courses */
    bulk: '/courses/bulk',
  },
  
  /**
   * Role management endpoints
   */
  roles: {
    /** List all roles in the system */
    list: '/roles',
    /** Assign a role to a user in a context */
    assign: '/roles/assign',
    /** Get capabilities for a specific role */
    capabilities: '/roles/capabilities',
  },
  
  /**
   * System settings endpoints
   */
  settings: {
    /** Get current system settings */
    get: '/settings',
    /** Update system settings */
    update: '/settings',
  },
  
  /**
   * Plugin management endpoints
   */
  plugins: {
    /** List all installed plugins */
    list: '/plugins',
    /** Configure a specific plugin by ID */
    configure: '/plugins/:id',
  },
} as const;

/**
 * Supported bulk operation types for admin actions
 * Defines all operations that can be performed on multiple items at once
 */
export const BULK_ACTIONS = {
  /** Delete multiple items permanently */
  DELETE: 'delete',
  /** Suspend multiple user accounts */
  SUSPEND: 'suspend',
  /** Activate multiple user accounts */
  ACTIVATE: 'activate',
  /** Assign a role to multiple users */
  ASSIGN_ROLE: 'assign_role',
  /** Remove a role from multiple users */
  REMOVE_ROLE: 'remove_role',
  /** Enroll multiple users in a course */
  ENROLL: 'enroll',
  /** Unenroll multiple users from a course */
  UNENROLL: 'unenroll',
} as const;

/**
 * Sort order directions for list queries
 * Used to specify ascending or descending sort order
 */
export const SORT_ORDERS = {
  /** Ascending order (A-Z, 0-9, oldest-newest) */
  ASC: 'asc',
  /** Descending order (Z-A, 9-0, newest-oldest) */
  DESC: 'desc',
} as const;

/**
 * Default filter configurations for admin lists
 * Provides default values and initial state for list filtering
 */
export const DEFAULT_FILTERS = {
  /** Default search query (empty string) */
  search: '',
  /** Default role filter (all roles) */
  role: null,
  /** Default status filter (all statuses) */
  status: null,
  /** Default last access filter (no filter) */
  lastAccess: null,
  /** Default suspended state filter (show all users) */
  suspended: null,
} as const;

/**
 * Common admin permission identifiers
 * Maps to Moodle capability strings for admin operations
 * These are used to check if the current user has permission to perform admin actions
 */
export const ADMIN_PERMISSION_TYPES = {
  /** Permission to manage users (create, edit, delete) */
  MANAGE_USERS: 'moodle/user:update',
  /** Permission to create new users */
  CREATE_USER: 'moodle/user:create',
  /** Permission to delete users */
  DELETE_USER: 'moodle/user:delete',
  /** Permission to manage courses */
  MANAGE_COURSES: 'moodle/course:update',
  /** Permission to manage roles */
  MANAGE_ROLES: 'moodle/role:manage',
  /** Permission to assign roles to users */
  ASSIGN_ROLES: 'moodle/role:assign',
  /** Permission to manage system settings */
  MANAGE_SETTINGS: 'moodle/site:config',
  /** Permission to manage plugins */
  MANAGE_PLUGINS: 'moodle/site:config',
} as const;

/**
 * TypeScript type definitions for the constants
 * These provide type safety when using the constants throughout the application
 */

/** Type for bulk action values */
export type BulkActionType = typeof BULK_ACTIONS[keyof typeof BULK_ACTIONS];

/** Type for sort order values */
export type SortOrderType = typeof SORT_ORDERS[keyof typeof SORT_ORDERS];

/** Type for admin permission identifiers */
export type AdminPermissionType = typeof ADMIN_PERMISSION_TYPES[keyof typeof ADMIN_PERMISSION_TYPES];

/** Type for default filter keys */
export type DefaultFilterKey = keyof typeof DEFAULT_FILTERS;

/** Type for admin endpoint categories */
export type AdminEndpointCategory = keyof typeof ADMIN_ENDPOINTS;
