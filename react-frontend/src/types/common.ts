/**
 * Common TypeScript Utility Types
 * 
 * Foundational type definitions used throughout the Moodle React frontend.
 * Based on Moodle database schema and core data structures.
 * 
 * @module types/common
 */

// ============================================================================
// ID Types (based on Moodle database schema)
// ============================================================================

/**
 * Generic identifier type (int 10 in Moodle database)
 */
export type Id = number;

/**
 * User identifier (int 10 from mdl_user table)
 */
export type UserId = number;

/**
 * Course identifier (int 10 from mdl_course table)
 */
export type CourseId = number;

/**
 * Course category identifier (int 10 from mdl_course_categories table)
 */
export type CategoryId = number;

/**
 * Course module identifier (int 10 from mdl_course_modules table)
 */
export type ModuleId = number;

/**
 * Generic activity identifier
 */
export type ActivityId = number;

/**
 * Grade identifier (int 10 from grade tables)
 */
export type GradeId = number;

/**
 * Assignment identifier (int 10 from mdl_assign table)
 */
export type AssignmentId = number;

/**
 * Quiz identifier (int 10 from mdl_quiz table)
 */
export type QuizId = number;

/**
 * Forum identifier (int 10 from mdl_forum table)
 */
export type ForumId = number;

/**
 * Message identifier (int 10 from mdl_messages table)
 */
export type MessageId = number;

/**
 * Role identifier (int 10 from mdl_role table)
 */
export type RoleId = number;

/**
 * Context identifier (int 10 from mdl_context table)
 */
export type ContextId = number;

/**
 * Enrolment identifier (int 10 from mdl_user_enrolments table)
 */
export type EnrolmentId = number;

// ============================================================================
// Timestamp Types (Unix timestamps in Moodle)
// ============================================================================

/**
 * Unix timestamp (seconds since epoch)
 * Moodle stores all timestamps as integers representing seconds since Unix epoch
 */
export type Timestamp = number;

/**
 * ISO 8601 date string for display purposes
 * Example: "2024-01-15T10:30:00Z"
 */
export type DateString = string;

/**
 * Time range with start and end timestamps
 */
export interface TimeRange {
  /**
   * Start timestamp (Unix timestamp)
   */
  start: Timestamp;
  
  /**
   * End timestamp (Unix timestamp)
   */
  end: Timestamp;
}

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
  /**
   * Current page number (1-indexed)
   */
  page: number;
  
  /**
   * Number of items per page
   */
  perPage: number;
  
  /**
   * Optional offset for cursor-based pagination
   */
  offset?: number;
}

/**
 * Pagination metadata returned by API
 */
export interface PaginationMeta {
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
   * Total number of pages
   */
  totalPages: number;
}

// ============================================================================
// Sorting Types
// ============================================================================

/**
 * Sort order direction
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Sorting parameters for lists
 * 
 * @template T - The type of object being sorted
 */
export type SortParams<T> = {
  /**
   * Field to sort by (must be a key of T)
   */
  field: keyof T;
  
  /**
   * Sort direction
   */
  order: SortOrder;
};

// ============================================================================
// Status and State Types
// ============================================================================

/**
 * Loading state for async operations
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Visibility state for UI elements
 */
export type VisibilityState = 'visible' | 'hidden';

/**
 * Completion status for activities and courses
 */
export type CompletionStatus = 'not_started' | 'in_progress' | 'completed';

// ============================================================================
// File and Media Types
// ============================================================================

/**
 * File size in bytes
 */
export type FileSize = number;

/**
 * MIME type string
 * Example: "application/pdf", "image/jpeg"
 */
export type MimeType = string;

/**
 * File extension (without the dot)
 * Example: "pdf", "docx", "png"
 */
export type FileExtension = string;

// ============================================================================
// Localization Types
// ============================================================================

/**
 * Language code (ISO 639-1)
 * Examples: "en", "fr", "de", "es"
 */
export type LanguageCode = string;

/**
 * Country code (ISO 3166-1 alpha-2)
 * Examples: "US", "GB", "FR", "DE"
 */
export type CountryCode = string;

/**
 * Timezone identifier (IANA timezone database)
 * Examples: "America/New_York", "Europe/London", "Asia/Tokyo"
 */
export type Timezone = string;

// ============================================================================
// Generic Utility Types
// ============================================================================

/**
 * Make all properties of T optional
 * 
 * @template T - The type to make optional
 */
export type Optional<T> = {
  [P in keyof T]?: T[P];
};

/**
 * Make all properties of T nullable
 * 
 * @template T - The type to make nullable
 */
export type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

/**
 * Add an id property to type T
 * 
 * @template T - The type to add id to
 */
export type WithId<T> = T & {
  /**
   * Unique identifier
   */
  id: Id;
};

/**
 * Add createdAt and updatedAt timestamps to type T
 * 
 * @template T - The type to add timestamps to
 */
export type WithTimestamps<T> = T & {
  /**
   * Creation timestamp (Unix timestamp)
   */
  createdAt: Timestamp;
  
  /**
   * Last update timestamp (Unix timestamp)
   */
  updatedAt: Timestamp;
};
