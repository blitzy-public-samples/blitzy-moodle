/**
 * Admin API Module - Barrel Export
 *
 * This module serves as the primary entry point for all admin API utilities,
 * types, and constants. It aggregates and re-exports functionality from:
 * - ./types: TypeScript interfaces and type definitions
 * - ./constants: API configuration and constant values
 * - ./shared: Reusable utility functions
 *
 * By importing from this barrel file, components throughout the application
 * can access admin API functionality with clean, short import statements:
 *
 * @example
 * ```typescript
 * // Clean import from barrel
 * import {
 *   buildAdminUrl,
 *   AdminPaginationParams,
 *   ADMIN_ENDPOINTS
 * } from '@/features/admin/api';
 *
 * // Instead of deep imports
 * import { buildAdminUrl } from '@/features/admin/api/shared';
 * import { AdminPaginationParams } from '@/features/admin/api/types';
 * import { ADMIN_ENDPOINTS } from '@/features/admin/api/constants';
 * ```
 *
 * This pattern follows the barrel export convention established across all
 * feature modules in the application, promoting consistency and maintainability.
 *
 * @module features/admin/api
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

/**
 * Re-export all TypeScript type definitions from ./types
 *
 * These types provide comprehensive type safety for admin API operations:
 * - AdminPaginationParams: Pagination, sorting, and ordering parameters
 * - AdminPaginatedResponse: Generic wrapper for paginated list responses
 * - AdminBulkOperationRequest: Request payload for bulk operations
 * - AdminBulkOperationResponse: Response payload with success/failure details
 * - AdminFilterParams: Advanced filtering options for list endpoints
 * - AdminSortParams: Sorting configuration for list queries
 * - AdminErrorResponse: Standardized error response structure
 * - AdminSuccessResponse: Generic success response wrapper
 * - AdminPermissionCheck: Permission verification result
 */
export type {
  AdminPaginationParams,
  AdminPaginatedResponse,
  AdminBulkOperationRequest,
  AdminBulkOperationResponse,
  AdminFilterParams,
  AdminSortParams,
  AdminErrorResponse,
  AdminSuccessResponse,
  AdminPermissionCheck,
} from './types';

/**
 * Re-export type guard functions from ./types
 *
 * These utility functions enable runtime type checking of API responses:
 * - isAdminErrorResponse: Check if response is an error
 * - isAdminSuccessResponse: Check if response is successful
 */
export { isAdminErrorResponse, isAdminSuccessResponse } from './types';

// =============================================================================
// CONSTANT EXPORTS
// =============================================================================

/**
 * Re-export all configuration constants from ./constants
 *
 * These constants centralize admin API configuration values:
 * - ADMIN_API_BASE: Base path for all admin API endpoints ("/api/v1/admin")
 * - DEFAULT_PAGE_SIZE: Default pagination size (20 items)
 * - MAX_PAGE_SIZE: Maximum allowed page size (100 items)
 * - ADMIN_ENDPOINTS: Complete mapping of all admin endpoint paths
 * - BULK_ACTIONS: Supported bulk operation types
 * - SORT_ORDERS: Sort order directions (asc/desc)
 * - DEFAULT_FILTERS: Default filter configuration for lists
 * - ADMIN_PERMISSION_TYPES: Moodle capability identifiers for admin actions
 */
export {
  ADMIN_API_BASE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ADMIN_ENDPOINTS,
  BULK_ACTIONS,
  SORT_ORDERS,
  DEFAULT_FILTERS,
  ADMIN_PERMISSION_TYPES,
} from './constants';

/**
 * Re-export TypeScript type definitions derived from constants
 *
 * These types provide type safety when working with constant values:
 * - BulkActionType: Union type of all bulk action values
 * - SortOrderType: Union type of sort order values ('asc' | 'desc')
 * - AdminPermissionType: Union type of permission identifier strings
 * - DefaultFilterKey: Union type of default filter property names
 * - AdminEndpointCategory: Union type of endpoint category names
 */
export type {
  BulkActionType,
  SortOrderType,
  AdminPermissionType,
  DefaultFilterKey,
  AdminEndpointCategory,
} from './constants';

// =============================================================================
// UTILITY FUNCTION EXPORTS
// =============================================================================

/**
 * Re-export all shared utility functions from ./shared
 *
 * These reusable functions eliminate code duplication across admin subdomains:
 *
 * URL Construction:
 * - buildAdminUrl: Build complete API URLs with query parameters
 *
 * Parameter Formatting:
 * - buildPaginationParams: Format pagination parameters for requests
 * - buildFilterParams: Convert filter objects to query parameters
 * - buildSortParams: Format sort parameters for requests
 * - mergeAdminFilters: Merge default and user-provided filters
 *
 * Request/Response Handling:
 * - formatBulkOperationRequest: Create bulk operation request payloads
 * - parsePaginatedResponse: Parse and validate paginated responses
 * - validateBulkOperationResponse: Validate bulk operation responses
 * - extractPaginationMetadata: Extract pagination data from responses
 *
 * Error Handling:
 * - handleAdminError: Standardize error responses across error types
 */
export {
  buildAdminUrl,
  buildPaginationParams,
  buildFilterParams,
  formatBulkOperationRequest,
  parsePaginatedResponse,
  handleAdminError,
  validateBulkOperationResponse,
  extractPaginationMetadata,
  buildSortParams,
  mergeAdminFilters,
} from './shared';
