/**
 * Shared Admin API Utilities
 *
 * This module provides reusable utility functions for admin API operations to eliminate
 * code duplication across all admin subdomains (users, courses, roles, settings, plugins).
 * All functions use types from './types' and constants from './constants' for type safety.
 *
 * Key responsibilities:
 * - URL construction with query parameters
 * - Pagination parameter formatting
 * - Filter parameter conversion
 * - Bulk operation request/response handling
 * - Standardized error handling
 * - Response parsing and validation
 *
 * @module features/admin/api/shared
 */

import type { AxiosError } from 'axios';
import type {
  AdminPaginationParams,
  AdminFilterParams,
  AdminBulkOperationRequest,
  AdminBulkOperationResponse,
  AdminPaginatedResponse,
  AdminSortParams,
  AdminErrorResponse,
} from './types';
import type { DEFAULT_FILTERS} from './constants';
import { ADMIN_API_BASE, DEFAULT_PAGE_SIZE } from './constants';

/**
 * Constructs a full admin API URL with query parameters
 *
 * Builds a complete URL for admin API endpoints by combining the base API path
 * with the specific endpoint and optional query parameters. All parameters are
 * properly URL-encoded.
 *
 * @param endpoint - Relative endpoint path (e.g., "/users", "/courses/categories")
 * @param params - Optional query parameters to append to the URL
 * @returns Complete URL string with query parameters
 *
 * @example
 * ```typescript
 * // Simple endpoint without parameters
 * buildAdminUrl('/users')
 * // => "/api/v1/admin/users"
 *
 * // Endpoint with query parameters
 * buildAdminUrl('/users', { page: 2, search: 'john' })
 * // => "/api/v1/admin/users?page=2&search=john"
 * ```
 */
export function buildAdminUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | null | undefined>
): string {
  // Remove leading slash from endpoint if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = `${ADMIN_API_BASE}${cleanEndpoint}`;

  // If no parameters provided, return base URL
  if (!params || Object.keys(params).length === 0) {
    return baseUrl;
  }

  // Build query string from parameters, filtering out null/undefined values
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      queryParams.append(key, String(value));
    }
  });

  const queryString = queryParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Formats pagination parameters for API requests
 *
 * Converts pagination, sorting, and ordering preferences into a standardized
 * parameter object for API requests. Provides sensible defaults for optional
 * parameters.
 *
 * @param page - Page number (1-indexed)
 * @param perPage - Number of items per page
 * @param sort - Optional field name to sort by
 * @param order - Optional sort direction ('asc' or 'desc')
 * @returns Formatted pagination parameters object
 *
 * @example
 * ```typescript
 * // Basic pagination
 * buildPaginationParams(1, 20)
 * // => { page: 1, perPage: 20, sort: 'id', order: 'asc' }
 *
 * // With sorting
 * buildPaginationParams(2, 50, 'lastname', 'desc')
 * // => { page: 2, perPage: 50, sort: 'lastname', order: 'desc' }
 * ```
 */
export function buildPaginationParams(
  page: number,
  perPage: number,
  sort?: string,
  order?: 'asc' | 'desc'
): AdminPaginationParams {
  return {
    page: Math.max(1, page), // Ensure page is at least 1
    perPage: Math.max(1, Math.min(perPage, 100)), // Clamp between 1 and 100
    sort: sort ?? 'id', // Default to sorting by ID
    order: order ?? 'asc', // Default to ascending order
  };
}

/**
 * Converts filter objects to API query parameters
 *
 * Transforms a filter configuration object into a flat Record suitable for
 * URL query parameters. Handles nested objects (like dateRange) by flattening
 * them with appropriate key names.
 *
 * @param filters - Filter configuration object
 * @returns Flat object of query parameters
 *
 * @example
 * ```typescript
 * const filters = {
 *   search: 'john',
 *   role: 'student',
 *   status: 'active',
 *   suspended: false,
 *   dateRange: { start: '2024-01-01', end: '2024-12-31' }
 * };
 * buildFilterParams(filters)
 * // => {
 * //   search: 'john',
 * //   role: 'student',
 * //   status: 'active',
 * //   suspended: 'false',
 * //   dateStart: '2024-01-01',
 * //   dateEnd: '2024-12-31'
 * // }
 * ```
 */
export function buildFilterParams(
  filters: AdminFilterParams
): Record<string, string> {
  const params: Record<string, string> = {};

  // Add simple string/boolean filters
  if (filters.search) {
    params.search = filters.search;
  }

  if (filters.role) {
    params.role = filters.role;
  }

  if (filters.status) {
    params.status = filters.status;
  }

  if (filters.suspended !== undefined) {
    params.suspended = String(filters.suspended);
  }

  if (filters.confirmed !== undefined) {
    params.confirmed = String(filters.confirmed);
  }

  // Handle date range by flattening to dateStart and dateEnd
  if (filters.dateRange) {
    if (filters.dateRange.start) {
      params.dateStart = filters.dateRange.start;
    }
    if (filters.dateRange.end) {
      params.dateEnd = filters.dateRange.end;
    }
  }

  return params;
}

/**
 * Formats bulk operation request payloads
 *
 * Creates a standardized request payload for bulk operations on multiple entities.
 * Validates that IDs array is not empty and ensures the payload structure matches
 * the expected AdminBulkOperationRequest interface.
 *
 * @param ids - Array of entity IDs to perform the operation on
 * @param action - Bulk action identifier (e.g., 'delete', 'suspend')
 * @param options - Optional additional parameters for the operation
 * @returns Formatted bulk operation request object
 * @throws Error if ids array is empty
 *
 * @example
 * ```typescript
 * // Simple bulk delete
 * formatBulkOperationRequest([1, 2, 3], 'delete')
 * // => { ids: [1, 2, 3], action: 'delete' }
 *
 * // Bulk operation with options
 * formatBulkOperationRequest([4, 5], 'suspend', { sendEmail: true })
 * // => { ids: [4, 5], action: 'suspend', options: { sendEmail: true } }
 * ```
 */
export function formatBulkOperationRequest(
  ids: number[],
  action: string,
  options?: Record<string, unknown>
): AdminBulkOperationRequest {
  // Validate that IDs array is not empty
  if (!ids || ids.length === 0) {
    throw new Error('Bulk operation requires at least one ID');
  }

  // Validate that all IDs are positive integers
  const invalidIds = ids.filter((id) => !Number.isInteger(id) || id <= 0);
  if (invalidIds.length > 0) {
    throw new Error(
      `Invalid IDs provided: ${invalidIds.join(', ')}. All IDs must be positive integers.`
    );
  }

  const request: AdminBulkOperationRequest = {
    ids,
    action,
  };

  // Only include options if provided
  if (options && Object.keys(options).length > 0) {
    request.options = options;
  }

  return request;
}

/**
 * Parses and validates paginated API responses
 *
 * Transforms raw API responses into properly typed AdminPaginatedResponse objects.
 * Performs validation to ensure all required pagination metadata is present and
 * falls back to sensible defaults if needed.
 *
 * @template T - The type of items in the response
 * @param response - Raw API response data
 * @returns Validated and typed paginated response
 * @throws Error if response is missing critical fields
 *
 * @example
 * ```typescript
 * const apiResponse = {
 *   data: {
 *     items: [{ id: 1, name: 'User 1' }, { id: 2, name: 'User 2' }],
 *     total: 100,
 *     page: 1,
 *     totalPages: 5,
 *     perPage: 20
 *   }
 * };
 * const parsed = parsePaginatedResponse<User>(apiResponse);
 * // => AdminPaginatedResponse<User> with type-safe items array
 * ```
 */
export function parsePaginatedResponse<T>(
  response: unknown
): AdminPaginatedResponse<T> {
  // Type guard to check if response has expected structure
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response: expected an object');
  }

  const data = response as Record<string, unknown>;

  // Extract data from standard API response envelope
  const responseData =
    data.data && typeof data.data === 'object'
      ? (data.data as Record<string, unknown>)
      : data;

  // Validate required fields
  if (!Array.isArray(responseData.items)) {
    throw new Error('Invalid response: items must be an array');
  }

  // Extract pagination metadata with defaults
  const items = responseData.items as T[];
  const total =
    typeof responseData.total === 'number' ? responseData.total : items.length;
  const page = typeof responseData.page === 'number' ? responseData.page : 1;
  const perPage =
    typeof responseData.perPage === 'number'
      ? responseData.perPage
      : DEFAULT_PAGE_SIZE;
  const totalPages =
    typeof responseData.totalPages === 'number'
      ? responseData.totalPages
      : Math.ceil(total / perPage);

  return {
    items,
    total,
    page,
    perPage,
    totalPages,
  };
}

/**
 * Standardizes admin error handling with proper error messages
 *
 * Converts various error types (Axios errors, API errors, generic errors) into
 * a consistent AdminErrorResponse format. Extracts error details from API
 * responses when available and provides user-friendly fallback messages.
 *
 * @param error - Error object from API request or operation
 * @returns Standardized admin error response
 *
 * @example
 * ```typescript
 * try {
 *   await adminApi.deleteUser(123);
 * } catch (error) {
 *   const errorResponse = handleAdminError(error);
 *   console.error(errorResponse.error.message);
 *   // => "You do not have permission to delete this user"
 * }
 * ```
 */
export function handleAdminError(error: unknown): AdminErrorResponse {
  // Handle Axios errors with response data
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<{
      success?: boolean;
      error?: {
        code?: string;
        message?: string;
        details?: Record<string, unknown>;
      };
      message?: string;
      code?: string;
    }>;

    if (axiosError.response?.data) {
      const {data} = axiosError.response;

      // Check if response already has error structure
      if (data.error && typeof data.error === 'object') {
        return {
          success: false,
          error: {
            code: data.error.code ?? 'UNKNOWN_ERROR',
            message: data.error.message ?? 'An unknown error occurred',
            details: data.error.details,
          },
          code: data.error.code,
          message: data.error.message,
          details: data.error.details,
        };
      }

      // Handle legacy error format
      if (data.code ?? data.message) {
        return {
          success: false,
          error: {
            code: data.code ?? 'UNKNOWN_ERROR',
            message: data.message ?? 'An unknown error occurred',
          },
          code: data.code,
          message: data.message,
        };
      }
    }

    // Handle network errors or errors without response data
    if (axiosError.code === 'ECONNABORTED') {
      return {
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Request timeout. Please try again.',
        },
        code: 'TIMEOUT',
        message: 'Request timeout. Please try again.',
      };
    }

    if (axiosError.code === 'ERR_NETWORK') {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error. Please check your connection.',
        },
        code: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection.',
      };
    }

    // Generic Axios error
    return {
      success: false,
      error: {
        code: axiosError.code ?? 'AXIOS_ERROR',
        message: axiosError.message ?? 'An error occurred with the request',
      },
      code: axiosError.code,
      message: axiosError.message,
    };
  }

  // Handle generic Error instances
  if (error instanceof Error) {
    return {
      success: false,
      error: {
        code: 'ERROR',
        message: error.message,
      },
      code: 'ERROR',
      message: error.message,
    };
  }

  // Handle unknown error types
  return {
    success: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
    },
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
  };
}

/**
 * Validates bulk operation responses
 *
 * Checks that bulk operation responses contain all required fields and validates
 * that success/failure counts match the number of results. Throws descriptive
 * errors if the response structure is invalid.
 *
 * @param response - Raw bulk operation response
 * @returns Validated AdminBulkOperationResponse
 * @throws Error if response structure is invalid
 *
 * @example
 * ```typescript
 * const bulkResponse = await adminApi.bulkDeleteUsers([1, 2, 3]);
 * const validated = validateBulkOperationResponse(bulkResponse);
 * console.log(`Success: ${validated.successCount}, Failed: ${validated.failureCount}`);
 * ```
 */
export function validateBulkOperationResponse(
  response: unknown
): AdminBulkOperationResponse {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid bulk operation response: expected an object');
  }

  const data = response as Record<string, unknown>;

  // Extract data from standard API response envelope
  const responseData =
    data.data && typeof data.data === 'object'
      ? (data.data as Record<string, unknown>)
      : data;

  // Validate required fields
  if (typeof responseData.successCount !== 'number') {
    throw new Error(
      'Invalid bulk operation response: successCount must be a number'
    );
  }

  if (typeof responseData.failureCount !== 'number') {
    throw new Error(
      'Invalid bulk operation response: failureCount must be a number'
    );
  }

  if (!Array.isArray(responseData.errors)) {
    throw new Error(
      'Invalid bulk operation response: errors must be an array'
    );
  }

  // Validate that error count matches errors array length
  if (responseData.failureCount !== responseData.errors.length) {
    console.warn(
      `Bulk operation response: failureCount (${responseData.failureCount}) does not match errors array length (${responseData.errors.length})`
    );
  }

  const validated: AdminBulkOperationResponse = {
    successCount: responseData.successCount,
    failureCount: responseData.failureCount,
    errors: responseData.errors as AdminBulkOperationResponse['errors'],
  };

  // Include results array if present
  if (Array.isArray(responseData.results)) {
    validated.results = responseData.results as AdminBulkOperationResponse['results'];
  }

  return validated;
}

/**
 * Extracts pagination metadata from responses
 *
 * Pulls out pagination-specific metadata from API responses, providing a clean
 * interface for accessing page numbers, totals, and other pagination information.
 * Returns defaults if metadata is missing.
 *
 * @param response - Raw API response containing pagination data
 * @returns Pagination metadata object
 *
 * @example
 * ```typescript
 * const apiResponse = await adminApi.getUsers({ page: 2 });
 * const pagination = extractPaginationMetadata(apiResponse);
 * console.log(`Page ${pagination.page} of ${pagination.totalPages}`);
 * ```
 */
export function extractPaginationMetadata(
  response: unknown
): {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
} {
  if (!response || typeof response !== 'object') {
    // Return defaults for invalid responses
    return {
      page: 1,
      perPage: DEFAULT_PAGE_SIZE,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }

  const data = response as Record<string, unknown>;

  // Extract data from standard API response envelope
  const responseData =
    data.data && typeof data.data === 'object'
      ? (data.data as Record<string, unknown>)
      : data;

  const page = typeof responseData.page === 'number' ? responseData.page : 1;
  const perPage =
    typeof responseData.perPage === 'number'
      ? responseData.perPage
      : DEFAULT_PAGE_SIZE;
  const total = typeof responseData.total === 'number' ? responseData.total : 0;
  const totalPages =
    typeof responseData.totalPages === 'number'
      ? responseData.totalPages
      : Math.ceil(total / perPage);

  return {
    page,
    perPage,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Formats sort parameters for API requests
 *
 * Creates a standardized sort parameter object from field name and order direction.
 * Validates the order parameter and provides sensible defaults.
 *
 * @param field - Field name to sort by (e.g., 'lastname', 'email', 'timecreated')
 * @param order - Sort direction ('asc' or 'desc')
 * @returns Formatted sort parameters object
 *
 * @example
 * ```typescript
 * buildSortParams('lastname', 'asc')
 * // => { field: 'lastname', order: 'asc' }
 *
 * buildSortParams('timecreated', 'desc')
 * // => { field: 'timecreated', order: 'desc' }
 * ```
 */
export function buildSortParams(
  field: string,
  order: 'asc' | 'desc'
): AdminSortParams {
  // Validate order parameter
  if (order !== 'asc' && order !== 'desc') {
    console.warn(
      `Invalid sort order "${String(order)}". Defaulting to "asc". Valid values are "asc" or "desc".`
    );
    order = 'asc';
  }

  return {
    field: field.trim() || 'id', // Default to 'id' if field is empty
    order,
  };
}

/**
 * Merges default and user-provided filters
 *
 * Combines default filter configuration with user-provided filters, ensuring that
 * user preferences override defaults while maintaining type safety and providing
 * sensible fallbacks for missing values.
 *
 * @param baseFilters - Base filter configuration (typically DEFAULT_FILTERS)
 * @param userFilters - User-provided filter overrides
 * @returns Merged filter configuration
 *
 * @example
 * ```typescript
 * const merged = mergeAdminFilters(DEFAULT_FILTERS, {
 *   search: 'john',
 *   status: 'active'
 * });
 * // => {
 * //   search: 'john',
 * //   role: null,
 * //   status: 'active',
 * //   lastAccess: null,
 * //   suspended: null
 * // }
 * ```
 */
export function mergeAdminFilters(
  baseFilters: typeof DEFAULT_FILTERS,
  userFilters: Partial<AdminFilterParams>
): AdminFilterParams {
  // Start with base filters as foundation
  const merged: AdminFilterParams = {
    search: baseFilters.search ?? '',
    role: baseFilters.role ?? undefined,
    status: baseFilters.status ?? undefined,
    suspended: baseFilters.suspended ?? undefined,
  };

  // Override with user-provided filters
  if (userFilters.search !== undefined) {
    merged.search = userFilters.search;
  }

  if (userFilters.role !== undefined) {
    merged.role = userFilters.role;
  }

  if (userFilters.status !== undefined) {
    merged.status = userFilters.status;
  }

  if (userFilters.suspended !== undefined) {
    merged.suspended = userFilters.suspended;
  }

  if (userFilters.confirmed !== undefined) {
    merged.confirmed = userFilters.confirmed;
  }

  if (userFilters.dateRange !== undefined) {
    merged.dateRange = userFilters.dateRange;
  }

  return merged;
}
