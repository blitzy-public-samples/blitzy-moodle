/**
 * Application-wide constants for the Moodle React frontend
 * 
 * This file centralizes all constant values used throughout the application including:
 * - API configuration (base URLs, timeouts, rate limits)
 * - Pagination defaults
 * - Validation rules and regex patterns
 * - Date and time formatting strings
 * - Moodle capability names for permission checks
 * - File upload constraints
 * - Grade aggregation methods
 * - User roles
 * - Context levels
 * 
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// ============================================================================
// API Configuration Constants
// ============================================================================

/**
 * Base URL for the Moodle API endpoints
 * Defaults to /api/v1 but can be overridden via environment variables
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * API request timeout in milliseconds
 * Requests exceeding this duration will be aborted
 */
export const API_TIMEOUT = 30000; // 30 seconds

/**
 * Rate limit for API requests per user per hour
 * Used for client-side throttling and informational purposes
 */
export const API_RATE_LIMIT = 1000; // 1000 requests per hour per user

// ============================================================================
// Pagination Constants
// ============================================================================

/**
 * Default number of items per page for paginated lists
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Maximum number of items per page
 * Used to prevent excessive data transfer and performance issues
 */
export const MAX_PAGE_SIZE = 100;

// ============================================================================
// Validation Rules - Regular Expressions
// ============================================================================

/**
 * Email validation regex pattern
 * Validates standard email address format
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Username validation regex pattern
 * Allows alphanumeric characters, underscores, hyphens, periods, and @ symbols
 * Matches Moodle's PARAM_USERNAME validation
 */
export const USERNAME_REGEX = /^[a-zA-Z0-9._@-]+$/;

/**
 * URL validation regex pattern
 * Validates URLs with http or https protocol
 */
export const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;

// ============================================================================
// Validation Rules - Username Constraints
// ============================================================================

/**
 * Minimum allowed length for usernames
 */
export const MIN_USERNAME_LENGTH = 2;

/**
 * Maximum allowed length for usernames
 * Matches Moodle's database field constraint
 */
export const MAX_USERNAME_LENGTH = 100;

// ============================================================================
// Validation Rules - Password Requirements
// ============================================================================

/**
 * Minimum password length requirement
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Password must contain at least one uppercase letter
 */
export const PASSWORD_REQUIRES_UPPERCASE = true;

/**
 * Password must contain at least one lowercase letter
 */
export const PASSWORD_REQUIRES_LOWERCASE = true;

/**
 * Password must contain at least one digit
 */
export const PASSWORD_REQUIRES_DIGIT = true;

/**
 * Password must contain at least one special character
 */
export const PASSWORD_REQUIRES_SPECIAL = true;

// ============================================================================
// File Upload Constants
// ============================================================================

/**
 * Maximum file size for uploads in bytes
 * Default: 100MB (can be overridden by server settings)
 */
export const MAX_FILE_SIZE = 104857600; // 100 * 1024 * 1024

/**
 * Allowed MIME types for file uploads
 * Common document, image, video, and archive formats
 */
export const ALLOWED_FILE_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/html',
  'application/rtf',
  
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/svg+xml',
  'image/webp',
  
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  
  // Video
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/webm',
  'video/ogg',
  'video/x-msvideo',
  
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/gzip',
  'application/x-tar',
  
  // Other
  'application/json',
  'application/xml',
];

// ============================================================================
// Date and Time Format Constants
// ============================================================================

/**
 * Short date format for display
 * Compatible with date-fns format function
 * Example: 12/31/2024
 */
export const DATE_FORMAT_SHORT = 'MM/dd/yyyy';

/**
 * Long date format for display
 * Compatible with date-fns format function
 * Example: December 31, 2024
 */
export const DATE_FORMAT_LONG = 'MMMM dd, yyyy';

/**
 * Date and time format for display
 * Compatible with date-fns format function
 * Example: 12/31/2024 3:45 PM
 */
export const DATETIME_FORMAT = 'MM/dd/yyyy h:mm a';

/**
 * Time format for display
 * Compatible with date-fns format function
 * Example: 3:45 PM
 */
export const TIME_FORMAT = 'h:mm a';

// ============================================================================
// Moodle Capability Constants
// ============================================================================

/**
 * Capability to view course content
 * Required for accessing course pages and materials
 */
export const CAPABILITY_VIEW_COURSE = 'moodle/course:view';

/**
 * Capability to edit course settings and content
 * Required for teachers and course creators
 */
export const CAPABILITY_EDIT_COURSE = 'moodle/course:update';

/**
 * Capability to submit assignments
 * Required for students to submit work
 */
export const CAPABILITY_SUBMIT_ASSIGNMENT = 'mod/assign:submit';

/**
 * Capability to grade assignments
 * Required for teachers to grade student submissions
 */
export const CAPABILITY_GRADE_ASSIGNMENT = 'mod/assign:grade';

/**
 * Capability to manage users in the system
 * Required for administrators to create, edit, and delete users
 */
export const CAPABILITY_MANAGE_USERS = 'moodle/user:update';

// ============================================================================
// Context Level Constants
// ============================================================================

/**
 * System context level
 * Represents the entire Moodle site
 */
export const CONTEXT_SYSTEM = 10;

/**
 * User context level
 * Represents a specific user's personal space
 */
export const CONTEXT_USER = 30;

/**
 * Course context level
 * Represents a specific course
 */
export const CONTEXT_COURSE = 50;

/**
 * Module context level
 * Represents a specific activity module within a course
 */
export const CONTEXT_MODULE = 70;

// ============================================================================
// Grade Aggregation Method Constants
// ============================================================================

/**
 * Mean of grades aggregation method
 * Calculates the simple average of all grades
 */
export const GRADE_AGGREGATE_MEAN = 0;

/**
 * Weighted mean of grades aggregation method
 * Calculates the weighted average based on item weights
 */
export const GRADE_AGGREGATE_WEIGHTED_MEAN = 10;

/**
 * Sum of grades aggregation method
 * Calculates the total sum of all grades
 */
export const GRADE_AGGREGATE_SUM = 13;

// ============================================================================
// User Role Constants
// ============================================================================

/**
 * Student role identifier
 * Represents learners enrolled in courses
 */
export const ROLE_STUDENT = 'student';

/**
 * Teacher role identifier
 * Represents instructors with editing capabilities
 */
export const ROLE_TEACHER = 'editingteacher';

/**
 * Administrator role identifier
 * Represents site administrators with full system access
 */
export const ROLE_ADMIN = 'admin';

// ============================================================================
// Export all constants as a single object for convenience
// ============================================================================

/**
 * Combined constants object
 * Provides access to all constants through a single import
 */
export const CONSTANTS = {
  // API Configuration
  API_BASE_URL,
  API_TIMEOUT,
  API_RATE_LIMIT,
  
  // Pagination
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  
  // Validation - Regex
  EMAIL_REGEX,
  USERNAME_REGEX,
  URL_REGEX,
  
  // Validation - Username
  MIN_USERNAME_LENGTH,
  MAX_USERNAME_LENGTH,
  
  // Validation - Password
  MIN_PASSWORD_LENGTH,
  PASSWORD_REQUIRES_UPPERCASE,
  PASSWORD_REQUIRES_LOWERCASE,
  PASSWORD_REQUIRES_DIGIT,
  PASSWORD_REQUIRES_SPECIAL,
  
  // File Upload
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
  
  // Date Formats
  DATE_FORMAT_SHORT,
  DATE_FORMAT_LONG,
  DATETIME_FORMAT,
  TIME_FORMAT,
  
  // Capabilities
  CAPABILITY_VIEW_COURSE,
  CAPABILITY_EDIT_COURSE,
  CAPABILITY_SUBMIT_ASSIGNMENT,
  CAPABILITY_GRADE_ASSIGNMENT,
  CAPABILITY_MANAGE_USERS,
  
  // Context Levels
  CONTEXT_SYSTEM,
  CONTEXT_USER,
  CONTEXT_COURSE,
  CONTEXT_MODULE,
  
  // Grade Aggregation
  GRADE_AGGREGATE_MEAN,
  GRADE_AGGREGATE_WEIGHTED_MEAN,
  GRADE_AGGREGATE_SUM,
  
  // User Roles
  ROLE_STUDENT,
  ROLE_TEACHER,
  ROLE_ADMIN,
} as const;

// Export type for the constants object
export type ConstantsType = typeof CONSTANTS;
