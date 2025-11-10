/**
 * Error Types and Interfaces for Moodle React Frontend
 *
 * Defines structured error objects that align with the Moodle API error response envelope.
 * Provides comprehensive type safety for error handling throughout the application.
 *
 * Based on Moodle error handling patterns from externallib.php and moodlelib.php,
 * adapted for TypeScript strict mode with React Query and Axios integration.
 *
 * @module types/errors
 */

import type { Timestamp } from './common';

// ============================================================================
// API Error Codes
// ============================================================================

/**
 * Enumeration of all possible API error codes
 *
 * These error codes map to specific error conditions returned by the Moodle API
 * and are used for consistent error handling and user messaging across the application.
 */
export enum ApiErrorCode {
  /** Authentication failed - invalid credentials or missing authentication */
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',

  /** Authorization failed - user authenticated but lacks permissions */
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',

  /** Permission denied - specific capability check failed */
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  /** Resource not found - requested entity does not exist */
  NOT_FOUND = 'NOT_FOUND',

  /** Validation error - request data failed validation */
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  /** Server error - unhandled exception on server side */
  SERVER_ERROR = 'SERVER_ERROR',

  /** Network error - connectivity issues or request failed */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /** Timeout error - request exceeded time limit */
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  /** Rate limit exceeded - too many requests from client */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  /** Conflict - resource already exists or state conflict */
  CONFLICT = 'CONFLICT',

  /** Bad request - malformed request data */
  BAD_REQUEST = 'BAD_REQUEST',

  /** Unsupported media type - invalid content type */
  UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE',

  /** Database error - database operation failed */
  DATABASE_ERROR = 'DATABASE_ERROR',

  /** File upload error - file upload or processing failed */
  FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
}

// ============================================================================
// HTTP Status Codes
// ============================================================================

/**
 * HTTP status code enumeration for mapping API responses
 *
 * Subset of HTTP status codes relevant to the Moodle API.
 * Used for consistent status code handling in API client and error boundaries.
 */
export enum HttpStatus {
  /** Request succeeded */
  OK = 200,

  /** Resource created successfully */
  CREATED = 201,

  /** Bad request - client error in request format */
  BAD_REQUEST = 400,

  /** Unauthorized - authentication required or failed */
  UNAUTHORIZED = 401,

  /** Forbidden - authenticated but lacks permission */
  FORBIDDEN = 403,

  /** Not found - resource does not exist */
  NOT_FOUND = 404,

  /** Conflict - resource state conflict */
  CONFLICT = 409,

  /** Unprocessable entity - validation failed */
  UNPROCESSABLE_ENTITY = 422,

  /** Too many requests - rate limit exceeded */
  TOO_MANY_REQUESTS = 429,

  /** Internal server error - unhandled server exception */
  INTERNAL_SERVER_ERROR = 500,

  /** Bad gateway - upstream server error */
  BAD_GATEWAY = 502,

  /** Service unavailable - server temporarily unavailable */
  SERVICE_UNAVAILABLE = 503,

  /** Gateway timeout - upstream server timeout */
  GATEWAY_TIMEOUT = 504,
}

// ============================================================================
// Base API Error Interface
// ============================================================================

/**
 * Base API error interface
 *
 * Represents an error returned by the Moodle API.
 * All API errors follow this structure to ensure consistent error handling.
 *
 * @property code - Specific error code from ApiErrorCode enum
 * @property message - Human-readable error message for display
 * @property details - Additional contextual information about the error (optional)
 * @property timestamp - Unix timestamp when the error occurred (optional)
 * @property path - API endpoint path where the error occurred (optional)
 */
export interface ApiError {
  /** Error code identifying the type of error */
  code: ApiErrorCode;

  /** Human-readable error message */
  message: string;

  /** Additional contextual information about the error */
  details?: Record<string, unknown>;

  /** Unix timestamp when error occurred */
  timestamp?: Timestamp;

  /** API endpoint path where error occurred */
  path?: string;
}

// ============================================================================
// Specific Error Types
// ============================================================================

/**
 * Validation error - extends ApiError with field-specific information
 *
 * Returned when request data fails validation rules.
 * Includes the specific field and constraint that failed.
 *
 * @extends ApiError
 * @property field - Name of the field that failed validation
 * @property constraint - Validation rule that was violated
 */
export interface ValidationError extends ApiError {
  code: ApiErrorCode.VALIDATION_ERROR;

  /** Field name that failed validation */
  field: string;

  /** Validation constraint that failed */
  constraint: string;
}

/**
 * Authentication error - extends ApiError with authentication failure reason
 *
 * Returned when authentication fails or token is invalid/expired.
 *
 * @extends ApiError
 * @property reason - Specific reason for authentication failure
 */
export interface AuthenticationError extends ApiError {
  code: ApiErrorCode.AUTHENTICATION_FAILED;

  /** Specific reason for authentication failure */
  reason: 'invalid_credentials' | 'token_expired' | 'token_invalid';
}

/**
 * Permission error - extends ApiError with capability information
 *
 * Returned when user lacks required Moodle capability for an operation.
 * Includes the specific capability required and context where it was checked.
 *
 * @extends ApiError
 * @property required_capability - Moodle capability string (e.g., 'mod/assign:grade')
 * @property context - Context where permission was checked (e.g., 'course', 'module')
 */
export interface PermissionError extends ApiError {
  code: ApiErrorCode.PERMISSION_DENIED;

  /** Moodle capability required for the operation */
  required_capability: string;

  /** Context where permission was checked */
  context: string;
}

/**
 * Not found error - extends ApiError with resource information
 *
 * Returned when a requested resource does not exist in the system.
 * Includes the type and ID of the resource that was not found.
 *
 * @extends ApiError
 * @property resourceType - Type of resource (e.g., 'course', 'assignment', 'user')
 * @property resourceId - ID of the resource that was not found
 */
export interface NotFoundError extends ApiError {
  code: ApiErrorCode.NOT_FOUND;

  /** Type of resource that was not found */
  resourceType: string;

  /** ID of the resource that was not found */
  resourceId: number;
}

// ============================================================================
// Error Response Envelope
// ============================================================================

/**
 * Error response envelope - matches API error response structure from Section 0.3
 *
 * Standard envelope for all API error responses.
 * Aligns with the success response envelope for consistent API contract.
 *
 * Example:
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "code": "PERMISSION_DENIED",
 *     "message": "You do not have permission to access this resource",
 *     "details": {
 *       "required_capability": "mod/assign:grade",
 *       "context": "course"
 *     }
 *   }
 * }
 * ```
 *
 * @property success - Always false for error responses
 * @property error - ApiError object containing error details
 * @property meta - Optional metadata about the error response
 */
export interface ErrorResponse {
  /** Always false for error responses */
  success: false;

  /** Error details */
  error: ApiError;

  /** Optional metadata */
  meta?: Record<string, unknown>;
}

// ============================================================================
// Application-Level Error Types
// ============================================================================

/**
 * Base application error - for errors not originating from API
 *
 * Used for client-side errors that don't map to API error responses,
 * such as local validation, cache errors, or programming errors.
 *
 * @property name - Error type name
 * @property message - Error message
 * @property cause - Original error that caused this error (optional)
 */
export interface AppError {
  /** Error type name */
  name: string;

  /** Human-readable error message */
  message: string;

  /** Original error cause */
  cause?: Error;
}

/**
 * Network error - connectivity or network-level issues
 *
 * Represents errors that occur at the network layer before reaching the API,
 * such as connection refused, DNS lookup failures, or network timeouts.
 *
 * @extends AppError
 * @property statusCode - HTTP status code if available (optional)
 */
export interface NetworkError extends AppError {
  name: 'NetworkError';

  /** HTTP status code if available */
  statusCode?: number;
}

/**
 * Timeout error - request exceeded time limit
 *
 * Occurs when a request takes longer than the configured timeout period.
 * Different from server-side timeouts (which return 504).
 *
 * @extends AppError
 * @property timeout - Timeout duration in milliseconds
 */
export interface TimeoutError extends AppError {
  name: 'TimeoutError';

  /** Timeout duration in milliseconds */
  timeout: number;
}

/**
 * Cache error - cache operation failed
 *
 * Represents errors that occur during cache operations,
 * such as localStorage failures or React Query cache issues.
 *
 * @extends AppError
 * @property cacheKey - Cache key that caused the error
 */
export interface CacheError extends AppError {
  name: 'CacheError';

  /** Cache key associated with the error */
  cacheKey: string;
}

// ============================================================================
// Validation Error Details
// ============================================================================

/**
 * Validation error detail for a single field
 *
 * Used to represent individual field validation errors in forms.
 * Typically used in conjunction with React Hook Form or Zod validation.
 *
 * @property field - Field name that failed validation
 * @property message - Human-readable validation error message
 * @property value - The invalid value that was submitted (optional)
 */
export interface ValidationErrorDetail {
  /** Field name that failed validation */
  field: string;

  /** Validation error message */
  message: string;

  /** The invalid value submitted */
  value?: unknown;
}

/**
 * Array of validation errors for multiple fields
 *
 * Used to collect and display validation errors for entire forms.
 */
export type ValidationErrors = ValidationErrorDetail[];

// ============================================================================
// Type Guard Functions
// ============================================================================

/**
 * Type guard to check if an error is an ApiError
 *
 * @param error - Unknown error object
 * @returns true if error is an ApiError
 *
 * @example
 * ```typescript
 * try {
 *   await fetchCourse(id);
 * } catch (error) {
 *   if (isApiError(error)) {
 *     console.log('API error code:', error.code);
 *   }
 * }
 * ```
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as ApiError).code === 'string' &&
    typeof (error as ApiError).message === 'string'
  );
}

/**
 * Type guard to check if an error is a ValidationError
 *
 * @param error - Unknown error object
 * @returns true if error is a ValidationError
 *
 * @example
 * ```typescript
 * if (isValidationError(error)) {
 *   console.log('Field error:', error.field, error.constraint);
 * }
 * ```
 */
export function isValidationError(error: unknown): error is ValidationError {
  return (
    isApiError(error) &&
    error.code === ApiErrorCode.VALIDATION_ERROR &&
    'field' in error &&
    'constraint' in error &&
    typeof (error as ValidationError).field === 'string' &&
    typeof (error as ValidationError).constraint === 'string'
  );
}

/**
 * Type guard to check if an error is an AuthenticationError
 *
 * @param error - Unknown error object
 * @returns true if error is an AuthenticationError
 *
 * @example
 * ```typescript
 * if (isAuthenticationError(error)) {
 *   if (error.reason === 'token_expired') {
 *     // Trigger token refresh
 *   }
 * }
 * ```
 */
export function isAuthenticationError(
  error: unknown
): error is AuthenticationError {
  return (
    isApiError(error) &&
    error.code === ApiErrorCode.AUTHENTICATION_FAILED &&
    'reason' in error &&
    typeof (error as AuthenticationError).reason === 'string' &&
    ['invalid_credentials', 'token_expired', 'token_invalid'].includes(
      (error as AuthenticationError).reason
    )
  );
}
