/**
 * Common API Type Definitions
 * 
 * Provides standard interfaces for API requests and responses across all modules.
 * All API endpoints follow a consistent response envelope structure for error handling
 * and data transmission.
 * 
 * Based on API response standards defined in Agent Action Plan section 0.2:
 * - Success responses include data payload and optional metadata
 * - Error responses include error code, message, and details
 * - Paginated responses include pagination metadata
 * 
 * @package react-frontend
 * @subpackage types
 */

// ============================================================================
// API RESPONSE ENVELOPES
// ============================================================================

/**
 * Standard success response envelope
 * All successful API responses follow this structure
 */
export interface ApiSuccessResponse<T = unknown> {
  /** Indicates successful response */
  success: true;
  
  /** Response payload data */
  data: T;
  
  /** Optional metadata (pagination, etc.) */
  meta?: ResponseMetadata;
}

/**
 * Standard error response envelope
 * All error responses follow this structure
 */
export interface ApiErrorResponse {
  /** Indicates error response */
  success: false;
  
  /** Error details */
  error: ApiError;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Standardized API error structure
 */
export interface ApiError {
  /** Error code identifier (e.g., "PERMISSION_DENIED", "NOT_FOUND") */
  code: string;
  
  /** Human-readable error message */
  message: string;
  
  /** Optional additional error details */
  details?: Record<string, unknown>;
  
  /** HTTP status code */
  status?: number;
  
  /** Stack trace (development only) */
  stack?: string;
}

/**
 * Common API error codes
 */
export enum ApiErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  
  // Authorization errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  
  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Business logic errors
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

/**
 * Pagination metadata for list responses
 */
export interface PaginationMetadata {
  /** Current page number (1-based) */
  page: number;
  
  /** Number of items per page */
  perPage: number;
  
  /** Total number of items across all pages */
  total: number;
  
  /** Total number of pages */
  totalPages: number;
  
  /** Whether there is a next page */
  hasNext?: boolean;
  
  /** Whether there is a previous page */
  hasPrevious?: boolean;
}

/**
 * Response metadata (pagination, sorting, filtering, etc.)
 */
export interface ResponseMetadata {
  /** Pagination information */
  pagination?: PaginationMetadata;
  
  /** Sorting information */
  sort?: SortMetadata;
  
  /** Applied filters */
  filters?: Record<string, unknown>;
  
  /** Timestamp when response was generated */
  timestamp?: number;
}

/**
 * Sorting metadata
 */
export interface SortMetadata {
  /** Field being sorted */
  field: string;
  
  /** Sort direction */
  order: 'asc' | 'desc';
}

/**
 * Paginated response with data array
 */
export interface PaginatedResponse<T = unknown> {
  /** Indicates successful response */
  success: true;
  
  /** Array of items for current page */
  data: T[];
  
  /** Pagination and other metadata */
  meta: ResponseMetadata & {
    pagination: PaginationMetadata;
  };
}

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * Common pagination request parameters
 */
export interface PaginationParams {
  /** Page number (1-based) */
  page?: number;
  
  /** Number of items per page */
  perPage?: number;
  
  /** Alternative parameter name for page size */
  limit?: number;
  
  /** Offset for cursor-based pagination */
  offset?: number;
}

/**
 * Common sorting request parameters
 */
export interface SortParams {
  /** Field to sort by */
  sortBy?: string;
  
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Common filtering request parameters
 */
export interface FilterParams {
  /** Search query string */
  search?: string;
  
  /** Additional filters as key-value pairs */
  filters?: Record<string, unknown>;
}

/**
 * Combined list request parameters
 */
export interface ListRequestParams extends PaginationParams, SortParams, FilterParams {
  /** Include soft-deleted items */
  includeDeleted?: boolean;
  
  /** Include related entities */
  include?: string[];
}

// ============================================================================
// HTTP METHOD TYPES
// ============================================================================

/**
 * Supported HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * HTTP headers type
 */
export type HttpHeaders = Record<string, string>;

/**
 * API request configuration
 */
export interface ApiRequestConfig {
  /** Request method */
  method: HttpMethod;
  
  /** Request URL (relative or absolute) */
  url: string;
  
  /** Request headers */
  headers?: HttpHeaders;
  
  /** Request body data */
  data?: unknown;
  
  /** URL query parameters */
  params?: Record<string, unknown>;
  
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Whether to include credentials (cookies) */
  withCredentials?: boolean;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Field validation error
 */
export interface FieldError {
  /** Field name */
  field: string;
  
  /** Error message */
  message: string;
  
  /** Validation rule that failed */
  rule?: string;
  
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Validation error response
 */
export interface ValidationErrorResponse extends ApiErrorResponse {
  error: ApiError & {
    code: 'VALIDATION_ERROR';
    details: {
      /** Array of field-specific errors */
      fields: FieldError[];
    };
  };
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Extract data type from ApiResponse
 */
export type ExtractData<T> = T extends ApiResponse<infer D> ? D : never;

/**
 * Extract data type from PaginatedResponse
 */
export type ExtractPaginatedData<T> = T extends PaginatedResponse<infer D> ? D : never;

/**
 * Make all API response properties optional (for partial updates)
 */
export type PartialApiResponse<T> = Partial<T>;

/**
 * API endpoint path type
 */
export type ApiEndpoint = string;

/**
 * API version type
 */
export type ApiVersion = 'v1' | 'v2';
