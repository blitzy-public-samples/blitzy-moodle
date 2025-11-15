/**
 * Central Types Module - Moodle React Frontend
 *
 * This barrel export file provides a single import point for all TypeScript types
 * used throughout the Moodle React application. It aggregates and re-exports types
 * from four core type modules:
 *
 * - **common.ts**: Common utility types (IDs, timestamps, pagination, sorting, etc.)
 * - **errors.ts**: Error types and error handling interfaces
 * - **api.ts**: API request/response types, JWT tokens, and endpoint types
 * - **entities.ts**: Moodle domain entity interfaces (User, Course, Assignment, etc.)
 *
 * ## Purpose
 *
 * Centralizing type exports enables clean, consistent imports throughout the application:
 *
 * ```typescript
 * // Instead of multiple imports:
 * import { User } from '@/types/entities';
 * import { ApiResponse } from '@/types/api';
 * import { UserId } from '@/types/common';
 *
 * // Single import from central types:
 * import { User, ApiResponse, UserId } from '@/types';
 * ```
 *
 * ## Architecture Context
 *
 * This module is part of the React frontend refactoring described in Section 0 of the
 * Agent Action Plan. It provides type safety for the transition from PHP server-side
 * rendering to a React SPA architecture while maintaining alignment with the existing
 * Moodle database schema and PHP object structures.
 *
 * ## Type Categories
 *
 * ### Common Types (from common.ts)
 * - ID types: UserId, CourseId, ModuleId, AssignmentId, QuizId, etc.
 * - Timestamp types: Timestamp, DateString, TimeRange
 * - Pagination types: PaginationParams, PaginationMeta
 * - Sorting types: SortOrder, SortParams
 * - State types: LoadingState, VisibilityState, CompletionStatus
 * - Localization types: LanguageCode, CountryCode, Timezone
 * - Utility types: Optional, Nullable, WithId, WithTimestamps
 *
 * ### Error Types (from errors.ts)
 * - Error enums: ApiErrorCode, HttpStatus
 * - Error interfaces: ApiError, ValidationError, AuthenticationError, PermissionError
 * - Error responses: ErrorResponse
 * - Application errors: AppError, NetworkError, TimeoutError, CacheError
 * - Validation types: ValidationErrorDetail, ValidationErrors
 * - Type guards: isApiError, isValidationError, isAuthenticationError
 *
 * ### API Types (from api.ts)
 * - Response envelopes: ApiResponse, ApiResult, ErrorResponse
 * - Authentication: JwtTokens, DecodedJwt, LoginResponse
 * - Request types: ListParams, ApiRequestConfig, SearchParams
 * - Response types: PaginatedResponse, BatchRequest, BatchResponse
 * - File types: FileUploadResponse
 * - Endpoint types: ApiEndpoint, AuthEndpoints, CourseEndpoints
 * - HTTP types: HttpMethod
 *
 * ### Entity Types (from entities.ts)
 * - User entities: User, Role, RoleAssignment, Context
 * - Course entities: Course, CourseCategory, CourseModule, Enrollment
 * - Activity entities: Assignment, AssignmentSubmission, Quiz, QuizAttempt
 * - Communication entities: Forum, ForumDiscussion, ForumPost, Message, Conversation
 * - Assessment entities: Grade, GradeItem
 * - Content entities: File, CalendarEvent, Notification, Badge
 *
 * ## Usage Guidelines
 *
 * 1. **Always import from this index file** rather than individual type modules
 * 2. **Use TypeScript path aliases** (@/types) for clean imports
 * 3. **Leverage type inference** where possible but prefer explicit types for public APIs
 * 4. **Follow TypeScript strict mode** - no 'any' types allowed
 * 5. **Document complex types** with JSDoc comments in your code
 *
 * @module types
 * @see Section 0.3 Target Design - Type system architecture
 * @see react-frontend/src/types/common.ts - Common utility types
 * @see react-frontend/src/types/errors.ts - Error types and handling
 * @see react-frontend/src/types/api.ts - API request/response types
 * @see react-frontend/src/types/entities.ts - Moodle domain entities
 */

// ============================================================================
// Common Utility Types
// ============================================================================

/**
 * Re-export all common utility types
 *
 * Includes ID types (UserId, CourseId, etc.), timestamp types (Timestamp, DateString),
 * pagination types (PaginationParams, PaginationMeta), sorting types (SortOrder, SortParams),
 * state types (LoadingState, VisibilityState), localization types (LanguageCode, CountryCode),
 * and generic utility types (Optional, Nullable, WithId, WithTimestamps).
 *
 * @see react-frontend/src/types/common.ts
 */
export * from './common';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Re-export all error types and interfaces
 *
 * Includes ApiErrorCode enum, ApiError interface, ValidationError, AuthenticationError,
 * PermissionError, NotFoundError, ErrorResponse, AppError, NetworkError, TimeoutError,
 * CacheError, ValidationErrorDetail, ValidationErrors, HttpStatus enum, and type guard
 * functions (isApiError, isValidationError, isAuthenticationError).
 *
 * @see react-frontend/src/types/errors.ts
 */
export * from './errors';

// ============================================================================
// API Types
// ============================================================================

/**
 * Re-export all API request/response types
 *
 * Includes ApiResponse, ApiResponseMeta, ApiResult, ApiErrorResponse, PaginatedResponse,
 * JwtTokens, DecodedJwt, LoginResponse, ListParams, ApiRequestConfig, BatchRequest,
 * BatchResponse, FileUploadResponse, SearchParams, SearchResult, ApiEndpoint,
 * AuthEndpoints, CourseEndpoints, and HttpMethod types for type-safe API communication.
 *
 * @see react-frontend/src/types/api.ts
 */
export * from './api';

// ============================================================================
// Entity Types
// ============================================================================

/**
 * Re-export all Moodle domain entity interfaces
 *
 * Includes comprehensive entity definitions for all core Moodle objects:
 * - User management: User, Role, RoleAssignment, Context
 * - Course management: Course, CourseCategory, CourseModule, Enrollment
 * - Activities: Assignment, AssignmentSubmission, Quiz, QuizAttempt
 * - Communication: Forum, ForumDiscussion, ForumPost, Message, Conversation
 * - Assessment: Grade, GradeItem
 * - Content: File, CalendarEvent, Notification, Badge
 * - And many other Moodle entities
 *
 * @see react-frontend/src/types/entities.ts
 * @see public/lib/db/install.xml - Moodle database schema
 */
export * from './entities';
