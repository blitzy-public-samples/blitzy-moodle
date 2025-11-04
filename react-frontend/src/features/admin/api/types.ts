/**
 * TypeScript type definitions for Admin API operations
 *
 * This module provides comprehensive type safety for all administrative API interactions
 * including user management, course management, role management, and settings management.
 * These types extend standard API response structures with admin-specific features like
 * bulk operations, permission checks, and advanced filtering capabilities.
 *
 * @module features/admin/api/types
 */

/**
 * Pagination parameters for admin list endpoints
 *
 * Used to control pagination, sorting, and ordering of list results
 * across all admin endpoints that return paginated data.
 */
export interface AdminPaginationParams {
  /**
   * Page number to retrieve (1-indexed)
   * @example 1
   */
  page: number;

  /**
   * Number of items to return per page
   * @example 20
   * @default 20
   */
  perPage: number;

  /**
   * Field name to sort by
   * @example "lastname", "email", "timecreated"
   */
  sort: string;

  /**
   * Sort order direction
   * @example "asc" | "desc"
   */
  order: 'asc' | 'desc';
}

/**
 * Generic paginated response wrapper for admin endpoints
 *
 * Wraps list results with pagination metadata to enable
 * client-side pagination controls and navigation.
 *
 * @template T - The type of items in the response
 */
export interface AdminPaginatedResponse<T> {
  /**
   * Array of items for the current page
   */
  items: T[];

  /**
   * Total number of items across all pages
   */
  total: number;

  /**
   * Current page number (1-indexed)
   */
  page: number;

  /**
   * Total number of pages available
   */
  totalPages: number;

  /**
   * Number of items per page
   */
  perPage: number;
}

/**
 * Request payload for bulk operations on multiple entities
 *
 * Supports operations like bulk delete, bulk suspend, bulk enroll, etc.
 * across users, courses, or other administrative entities.
 */
export interface AdminBulkOperationRequest {
  /**
   * Array of entity IDs to perform the operation on
   * @example [1, 2, 3, 4, 5]
   */
  ids: number[];

  /**
   * Action to perform on the selected entities
   * @example "delete", "suspend", "unsuspend", "confirm", "unlock"
   */
  action: string;

  /**
   * Optional additional parameters for the bulk operation
   * @example { "force": true, "sendEmail": false }
   */
  options?: Record<string, unknown>;
}

/**
 * Response payload for bulk operations
 *
 * Provides detailed feedback on the success and failure of
 * individual operations within a bulk request.
 */
export interface AdminBulkOperationResponse {
  /**
   * Number of operations that completed successfully
   */
  successCount: number;

  /**
   * Number of operations that failed
   */
  failureCount: number;

  /**
   * Array of error details for failed operations
   */
  errors: Array<{
    /**
     * ID of the entity that failed
     */
    id: number;

    /**
     * Error message describing the failure
     */
    message: string;

    /**
     * Error code for programmatic handling
     */
    code?: string;
  }>;

  /**
   * Optional array of detailed results for each operation
   */
  results?: Array<{
    /**
     * ID of the entity
     */
    id: number;

    /**
     * Whether the operation succeeded
     */
    success: boolean;

    /**
     * Optional message or error description
     */
    message?: string;
  }>;
}

/**
 * Common filter parameters for admin list endpoints
 *
 * Enables advanced filtering of administrative lists by various criteria
 * including text search, role filtering, status filtering, and date ranges.
 */
export interface AdminFilterParams {
  /**
   * Text search query to filter by name, email, or username
   * @example "john.doe"
   */
  search?: string;

  /**
   * Filter by user role or capability
   * @example "student", "teacher", "manager"
   */
  role?: string;

  /**
   * Filter by entity status
   * @example "active", "inactive", "suspended"
   */
  status?: string;

  /**
   * Filter by date range
   * @example { start: "2024-01-01", end: "2024-12-31" }
   */
  dateRange?: {
    /**
     * Start date in ISO 8601 format
     */
    start: string;

    /**
     * End date in ISO 8601 format
     */
    end: string;
  };

  /**
   * Filter to show only suspended users
   * @example true | false
   */
  suspended?: boolean;

  /**
   * Filter to show only confirmed users
   * @example true | false
   */
  confirmed?: boolean;
}

/**
 * Sorting configuration for admin endpoints
 *
 * Specifies the field and direction for sorting list results.
 */
export interface AdminSortParams {
  /**
   * Field name to sort by
   * @example "lastname", "email", "timecreated", "lastaccess"
   */
  field: string;

  /**
   * Sort order direction
   * @example "asc" | "desc"
   */
  order: 'asc' | 'desc';
}

/**
 * Standardized error response structure for admin operations
 *
 * Provides consistent error handling across all admin API endpoints
 * with detailed error information for debugging and user feedback.
 */
export interface AdminErrorResponse {
  /**
   * Indicates the operation failed
   * Always false for error responses
   */
  success: false;

  /**
   * Detailed error information
   */
  error: {
    /**
     * Machine-readable error code
     * @example "PERMISSION_DENIED", "VALIDATION_ERROR", "NOT_FOUND"
     */
    code: string;

    /**
     * Human-readable error message
     * @example "You do not have permission to perform this action"
     */
    message: string;

    /**
     * Optional additional error details
     */
    details?: Record<string, unknown>;
  };

  /**
   * Legacy error code field for backward compatibility
   * @deprecated Use error.code instead
   */
  code?: string;

  /**
   * Legacy error message field for backward compatibility
   * @deprecated Use error.message instead
   */
  message?: string;

  /**
   * Optional detailed validation errors or additional context
   */
  details?: Record<string, unknown>;
}

/**
 * Generic success response wrapper for admin operations
 *
 * Provides a consistent structure for successful API responses
 * with optional metadata and success messages.
 *
 * @template T - The type of data in the response
 */
export interface AdminSuccessResponse<T> {
  /**
   * Indicates the operation succeeded
   * Always true for success responses
   */
  success: true;

  /**
   * The response data payload
   */
  data: T;

  /**
   * Optional metadata about the response
   */
  meta?: {
    /**
     * Timestamp when the response was generated
     */
    timestamp?: string;

    /**
     * API version that generated the response
     */
    version?: string;

    /**
     * Pagination information for list responses
     */
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };

    /**
     * Additional metadata fields
     */
    [key: string]: unknown;
  };

  /**
   * Optional success message for user feedback
   * @example "User created successfully"
   */
  message?: string;
}

/**
 * Permission check result for admin operations
 *
 * Used to verify whether the current user has the required capability
 * to perform an administrative action in a given context.
 */
export interface AdminPermissionCheck {
  /**
   * Whether the user has the required permission
   */
  hasPermission: boolean;

  /**
   * The capability that was checked
   * @example "moodle/user:create", "moodle/course:delete"
   */
  capability: string;

  /**
   * The context in which the permission was checked
   * @example "system", "course:123", "user:456"
   */
  context: string;

  /**
   * Optional message explaining the permission result
   * @example "You do not have permission to delete users"
   */
  message?: string;
}

/**
 * Type guard to check if a response is an error response
 *
 * @param response - The response to check
 * @returns True if the response is an AdminErrorResponse
 */
export function isAdminErrorResponse(
  response: AdminSuccessResponse<unknown> | AdminErrorResponse
): response is AdminErrorResponse {
  return response.success === false;
}

/**
 * Type guard to check if a response is a success response
 *
 * @param response - The response to check
 * @returns True if the response is an AdminSuccessResponse
 */
export function isAdminSuccessResponse<T>(
  response: AdminSuccessResponse<T> | AdminErrorResponse
): response is AdminSuccessResponse<T> {
  return response.success === true;
}
