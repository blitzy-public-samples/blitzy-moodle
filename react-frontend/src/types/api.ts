/**
 * API Type Definitions for Moodle React Frontend
 *
 * TypeScript types for API request and response structures including the standard
 * API response envelope, pagination metadata, authentication tokens, and request
 * configuration. Defines the shape of all data exchanged between the React frontend
 * and Moodle backend API, ensuring type safety for API calls and responses.
 *
 * Aligns with the API response standard envelope defined in Section 0.3 of the
 * Agent Action Plan.
 *
 * @module types/api
 */

import type {
  Id,
  UserId,
  Timestamp,
  PaginationParams,
  PaginationMeta,
  SortParams,
  FileSize,
  MimeType,
} from './common';
import type { ErrorResponse } from './errors';
import type { User } from './entities';

// ============================================================================
// Standard API Response Envelope
// ============================================================================

/**
 * Standard API response metadata
 *
 * Contains optional pagination information, timestamps, and additional metadata
 * returned by API endpoints.
 */
export interface ApiResponseMeta {
  /**
   * Pagination metadata for list responses
   */
  pagination?: PaginationMeta;

  /**
   * Response timestamp (Unix timestamp)
   */
  timestamp?: Timestamp;

  /**
   * Request duration in milliseconds
   */
  duration?: number;

  /**
   * Additional metadata fields
   */
  [key: string]: unknown;
}

/**
 * Standard API success response envelope (from Section 0.3)
 *
 * All successful API responses follow this structure to provide consistency
 * across all endpoints.
 *
 * @template T - Type of the response data payload
 *
 * @example
 * ```typescript
 * const response: ApiResponse<Course> = {
 *   success: true,
 *   data: {
 *     id: 5,
 *     fullname: "Introduction to TypeScript",
 *     // ...
 *   },
 *   meta: {
 *     timestamp: 1705327200
 *   }
 * };
 * ```
 */
export interface ApiResponse<T> {
  /**
   * Indicates successful response (always true for success responses)
   */
  success: true;

  /**
   * Response payload data
   */
  data: T;

  /**
   * Optional metadata (pagination, timestamps, etc.)
   */
  meta?: ApiResponseMeta;
}

/**
 * Union type for all API responses (success or error)
 *
 * Combines ApiResponse (success) and ErrorResponse (failure) to represent
 * any possible API response outcome.
 *
 * @template T - Type of the success response data payload
 *
 * @example
 * ```typescript
 * function handleResponse<T>(result: ApiResult<T>) {
 *   if (result.success) {
 *     console.log('Data:', result.data);
 *   } else {
 *     console.error('Error:', result.error.message);
 *   }
 * }
 * ```
 */
export type ApiResult<T> = ApiResponse<T> | ErrorResponse;

/**
 * Alias for ErrorResponse for backward compatibility
 *
 * Some parts of the codebase use ApiErrorResponse instead of ErrorResponse.
 * This type alias provides compatibility while maintaining a single source of truth.
 */
export type ApiErrorResponse = ErrorResponse;

/**
 * Paginated API response
 *
 * Standard response structure for list endpoints that return paginated results.
 * Contains an array of items along with pagination metadata.
 *
 * @template T - Type of the items in the paginated list
 *
 * @example
 * ```typescript
 * const coursesResponse: PaginatedResponse<Course> = {
 *   success: true,
 *   data: {
 *     items: [
 *       { id: 1, fullname: "Course 1", ... },
 *       { id: 2, fullname: "Course 2", ... }
 *     ],
 *     total: 150
 *   },
 *   meta: {
 *     pagination: {
 *       page: 1,
 *       perPage: 20,
 *       totalPages: 8
 *     }
 *   }
 * };
 * ```
 */
export interface PaginatedResponse<T> {
  /**
   * Indicates successful response (always true for success responses)
   */
  success: true;

  /**
   * Paginated data payload
   */
  data: {
    /**
     * Array of items for the current page
     */
    items: T[];

    /**
     * Total number of items across all pages
     */
    total: number;
  };

  /**
   * Response metadata including pagination information
   */
  meta: ApiResponseMeta & {
    /**
     * Pagination metadata (required for paginated responses)
     */
    pagination: PaginationMeta;
  };
}

/**
 * Simplified API error type for component use
 *
 * A simplified version of ErrorResponse for use in React components and hooks
 * where the full error structure is not needed. Contains only the essential
 * error information for display and handling.
 *
 * Note: Renamed from ApiError to SimplifiedApiError to avoid naming conflict
 * with the more comprehensive ApiError interface in errors.ts.
 *
 * @example
 * ```typescript
 * const handleError = (error: SimplifiedApiError) => {
 *   toast.error(error.message);
 *   console.error('Error code:', error.code);
 * };
 * ```
 */
export interface SimplifiedApiError {
  /**
   * Error code for programmatic error handling
   */
  code: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * HTTP status code
   */
  status?: number;

  /**
   * Additional error details
   */
  details?: Record<string, unknown>;
}

// ============================================================================
// Authentication Token Types (JWT Implementation from Section 0.1)
// ============================================================================

/**
 * JWT token pair returned upon successful authentication
 *
 * Contains access token (1-hour expiration) and refresh token (7-day expiration)
 * as specified in Section 0.1 of the Agent Action Plan.
 */
export interface JwtTokens {
  /**
   * JWT access token with 1-hour expiration
   *
   * Used for authenticating API requests via Authorization header.
   */
  accessToken: string;

  /**
   * JWT refresh token with 7-day expiration
   *
   * Used to obtain new access token when current token expires.
   */
  refreshToken: string;

  /**
   * Access token expiration duration in seconds (typically 3600 for 1 hour)
   */
  expiresIn: number;

  /**
   * Token type (always 'Bearer' for JWT)
   */
  tokenType: 'Bearer';
}

/**
 * Decoded JWT token payload
 *
 * Structure of claims contained within a JWT token after decoding.
 * Used for client-side token validation and extracting user information.
 */
export interface DecodedJwt {
  /**
   * Subject - user ID
   */
  sub: UserId;

  /**
   * Issuer - Moodle site URL
   */
  iss: string;

  /**
   * Issued at timestamp (Unix timestamp)
   */
  iat: Timestamp;

  /**
   * Expiration timestamp (Unix timestamp)
   */
  exp: Timestamp;

  /**
   * User role identifiers (e.g., ['student', 'teacher'])
   */
  roles: string[];

  /**
   * Additional custom claims
   */
  [key: string]: unknown;
}

/**
 * Login response containing tokens and user information
 *
 * Returned by the /api/v1/auth/login endpoint after successful authentication.
 */
export interface LoginResponse {
  /**
   * JWT token pair (access and refresh tokens)
   */
  tokens: JwtTokens;

  /**
   * Authenticated user profile information
   */
  user: User;
}

// ============================================================================
// List and Pagination Request Parameters
// ============================================================================

/**
 * Parameters for list/collection API requests
 *
 * Supports pagination, sorting, filtering, and search across list endpoints.
 *
 * @template T - Type of the entity being listed (for type-safe sorting)
 *
 * @example
 * ```typescript
 * const params: ListParams<Course> = {
 *   pagination: { page: 1, perPage: 20 },
 *   sort: { field: 'fullname', order: 'asc' },
 *   filter: { category: 5 },
 *   search: 'introduction'
 * };
 * ```
 */
export interface ListParams<T> {
  /**
   * Pagination parameters (page number and items per page)
   */
  pagination?: PaginationParams;

  /**
   * Sorting parameters (field and order)
   */
  sort?: SortParams<T>;

  /**
   * Filter parameters (field-value pairs)
   */
  filter?: Record<string, unknown>;

  /**
   * Search query string
   */
  search?: string;
}

// ============================================================================
// Request Configuration
// ============================================================================

/**
 * API request configuration options
 *
 * Additional options that can be passed to API client methods for
 * customizing request behavior.
 */
export interface ApiRequestConfig {
  /**
   * Custom HTTP headers
   */
  headers?: Record<string, string>;

  /**
   * URL query parameters
   */
  params?: Record<string, string | number | boolean>;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * AbortSignal for request cancellation
   */
  signal?: AbortSignal;

  /**
   * Include credentials (cookies) in cross-origin requests
   */
  withCredentials?: boolean;
}

// ============================================================================
// Batch Operation Types
// ============================================================================

/**
 * Batch request for performing multiple operations
 *
 * Allows executing multiple API operations in a single request,
 * optionally in sequential or parallel execution mode.
 *
 * @template T - Type of the operation data
 *
 * @example
 * ```typescript
 * const batchRequest: BatchRequest<EnrollmentData> = {
 *   operations: [
 *     { userId: 1, courseId: 5 },
 *     { userId: 2, courseId: 5 },
 *     { userId: 3, courseId: 5 }
 *   ],
 *   sequential: false
 * };
 * ```
 */
export interface BatchRequest<T> {
  /**
   * Array of operations to perform
   */
  operations: T[];

  /**
   * Execute operations sequentially (true) vs parallel (false)
   * Default: false (parallel execution)
   */
  sequential?: boolean;
}

/**
 * Batch response containing results of multiple operations
 *
 * Returns individual results for each operation along with success/failure counts.
 *
 * @template T - Type of the individual operation result data
 */
export interface BatchResponse<T> {
  /**
   * Array of results for each operation (success or error)
   */
  results: Array<ApiResult<T>>;

  /**
   * Number of successful operations
   */
  successCount: number;

  /**
   * Number of failed operations
   */
  failureCount: number;
}

// ============================================================================
// File Upload Types
// ============================================================================

/**
 * File upload response
 *
 * Returned by file upload endpoints after successful file upload and processing.
 * Contains file metadata and access URLs.
 */
export interface FileUploadResponse {
  /**
   * Unique file identifier
   */
  fileId: Id;

  /**
   * Original filename
   */
  filename: string;

  /**
   * File size in bytes
   */
  size: FileSize;

  /**
   * MIME type (e.g., 'application/pdf', 'image/jpeg')
   */
  mimeType: MimeType;

  /**
   * Download URL for the file
   */
  url: string;

  /**
   * Thumbnail URL (optional, for images)
   */
  thumbnailUrl?: string;
}

// ============================================================================
// Search Types
// ============================================================================

/**
 * Search request parameters
 *
 * Parameters for performing search operations across entities.
 */
export interface SearchParams {
  /**
   * Search query string
   */
  query: string;

  /**
   * Fields to search in (optional, server determines default fields)
   */
  fields?: string[];

  /**
   * Maximum number of results to return
   */
  limit?: number;

  /**
   * Result offset for pagination
   */
  offset?: number;
}

/**
 * Search result response
 *
 * Generic search result structure containing matched items and metadata.
 *
 * @template T - Type of the search result items
 */
export interface SearchResult<T> {
  /**
   * Array of matching items
   */
  items: T[];

  /**
   * Total number of matching items (before limit/offset)
   */
  total: number;

  /**
   * Original search query
   */
  query: string;
}

// ============================================================================
// API Endpoint Path Types
// ============================================================================

/**
 * Base type for API endpoint paths
 */
export type ApiEndpoint = string;

/**
 * Authentication endpoint paths
 *
 * Type-safe literal union for authentication-related API endpoints.
 */
export type AuthEndpoints =
  | '/auth/login'
  | '/auth/logout'
  | '/auth/refresh'
  | '/auth/me';

/**
 * Course endpoint paths
 *
 * Type-safe literal union for course-related API endpoints.
 */
export type CourseEndpoints =
  | '/courses'
  | '/courses/:id'
  | '/courses/:id/enroll'
  | '/courses/:id/unenroll'
  | '/courses/:id/contents'
  | '/courses/:id/users';

// ============================================================================
// HTTP Method Types
// ============================================================================

/**
 * HTTP request method types
 *
 * Standard HTTP methods used in API requests.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
