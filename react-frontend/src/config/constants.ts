/**
 * Application-wide constant definitions for the Moodle React frontend.
 * 
 * This module contains immutable constants used throughout the application including:
 * - Pagination defaults
 * - File upload limits
 * - HTTP status codes
 * - User role constants
 * - Permission levels
 * - Date/time formats
 * - Validation rules
 * - UI constants (breakpoints, z-index, animations)
 * - Cache durations
 * - Error codes
 * - Route paths
 * - Quiz settings
 * - Grade settings
 * 
 * All constants use TypeScript's 'as const' assertion for type narrowing and immutability.
 * 
 * @module config/constants
 */

/**
 * Pagination configuration constants.
 * Used across all list views and data tables for consistent pagination behavior.
 */
export const PAGINATION = {
  /** Default number of items per page */
  DEFAULT_PAGE_SIZE: 20,
  /** Maximum allowed items per page to prevent performance issues */
  MAX_PAGE_SIZE: 100,
  /** Available page size options for user selection */
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100] as const,
  /** Default starting page number (1-indexed) */
  DEFAULT_PAGE: 1
} as const;

/**
 * File upload configuration and constraints.
 * Defines size limits, allowed file types, and chunk settings for large file uploads.
 */
export const FILE_UPLOAD = {
  /** Maximum file size in bytes (100MB) */
  MAX_SIZE_BYTES: 100 * 1024 * 1024,
  /** Maximum file size in megabytes for display purposes */
  MAX_SIZE_MB: 100,
  /** Allowed file extensions for uploads */
  ALLOWED_EXTENSIONS: [
    // Documents
    '.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt',
    // Spreadsheets
    '.xls', '.xlsx', '.ods', '.csv',
    // Presentations
    '.ppt', '.pptx', '.odp',
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
    // Archives
    '.zip', '.tar', '.gz', '.rar', '.7z',
    // Video
    '.mp4', '.avi', '.mov', '.wmv', '.webm',
    // Audio
    '.mp3', '.wav', '.ogg', '.m4a'
  ] as const,
  /** Allowed MIME types for file validation */
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/svg+xml',
    'video/mp4',
    'audio/mpeg'
  ] as const,
  /** Chunk size for large file uploads (5MB chunks) */
  CHUNK_SIZE: 5 * 1024 * 1024
} as const;

/**
 * HTTP status code constants.
 * Standard HTTP status codes used for API response handling and error management.
 */
export const HTTP_STATUS = {
  /** Request succeeded */
  OK: 200,
  /** Resource created successfully */
  CREATED: 201,
  /** Request succeeded with no content to return */
  NO_CONTENT: 204,
  /** Invalid request parameters or format */
  BAD_REQUEST: 400,
  /** Authentication required or failed */
  UNAUTHORIZED: 401,
  /** Authenticated but not authorized for this resource */
  FORBIDDEN: 403,
  /** Requested resource not found */
  NOT_FOUND: 404,
  /** Request conflicts with current state */
  CONFLICT: 409,
  /** Validation failed on submitted data */
  UNPROCESSABLE_ENTITY: 422,
  /** Rate limit exceeded */
  TOO_MANY_REQUESTS: 429,
  /** Server encountered an error */
  INTERNAL_SERVER_ERROR: 500,
  /** Gateway or proxy error */
  BAD_GATEWAY: 502,
  /** Service temporarily unavailable */
  SERVICE_UNAVAILABLE: 503,
  /** Gateway timeout waiting for upstream */
  GATEWAY_TIMEOUT: 504
} as const;

/**
 * User role constants matching Moodle's role system.
 * These roles correspond to Moodle's default role archetypes.
 */
export const USER_ROLES = {
  /** Guest user with minimal permissions */
  GUEST: 'guest',
  /** Student enrolled in courses */
  STUDENT: 'student',
  /** Teacher with full editing capabilities */
  TEACHER: 'editingteacher',
  /** Non-editing teacher (can grade but not edit) */
  NON_EDITING_TEACHER: 'teacher',
  /** User who can create new courses */
  COURSE_CREATOR: 'coursecreator',
  /** Manager with broad administrative permissions */
  MANAGER: 'manager',
  /** System administrator with full access */
  ADMINISTRATOR: 'admin'
} as const;

/**
 * Type alias for user roles derived from USER_ROLES constant.
 */
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * Capability/permission constants matching Moodle's capability system.
 * These capabilities are checked via require_capability() on the backend.
 * Frontend uses these for UI visibility but backend is authoritative.
 */
export const CAPABILITIES = {
  // Course capabilities
  /** View course content */
  COURSE_VIEW: 'moodle/course:view',
  /** Update course settings */
  COURSE_UPDATE: 'moodle/course:update',
  /** Delete a course */
  COURSE_DELETE: 'moodle/course:delete',
  /** Enroll users in course */
  COURSE_ENROL: 'moodle/course:enrol',
  
  // Assignment capabilities
  /** Submit assignment work */
  ASSIGN_SUBMIT: 'mod/assign:submit',
  /** Grade assignment submissions */
  ASSIGN_GRADE: 'mod/assign:grade',
  /** View assignment details */
  ASSIGN_VIEW: 'mod/assign:view',
  
  // Quiz capabilities
  /** Attempt a quiz */
  QUIZ_ATTEMPT: 'mod/quiz:attempt',
  /** Grade quiz attempts */
  QUIZ_GRADE: 'mod/quiz:grade',
  /** View quiz content */
  QUIZ_VIEW: 'mod/quiz:view',
  
  // Gradebook capabilities
  /** View grades in gradebook */
  GRADE_VIEW: 'moodle/grade:view',
  /** Edit grades in gradebook */
  GRADE_EDIT: 'moodle/grade:edit',
  
  // User capabilities
  /** View user profile details */
  USER_VIEW: 'moodle/user:viewdetails',
  /** Edit user profile */
  USER_EDIT: 'moodle/user:update'
} as const;

/**
 * Date and time format constants using date-fns format strings.
 * Provides consistent date/time formatting across the application.
 */
export const DATE_FORMATS = {
  /** Display date format: Jan 15, 2024 */
  DISPLAY_DATE: 'MMM dd, yyyy',
  /** Display date and time format: Jan 15, 2024 14:30 */
  DISPLAY_DATE_TIME: 'MMM dd, yyyy HH:mm',
  /** Display time only format: 14:30 */
  DISPLAY_TIME: 'HH:mm',
  /** ISO date format: 2024-01-15 */
  ISO_DATE: 'yyyy-MM-dd',
  /** ISO date-time format: 2024-01-15T14:30:00 */
  ISO_DATE_TIME: "yyyy-MM-dd'T'HH:mm:ss",
  /** Relative time format (uses date-fns formatDistanceToNow) */
  RELATIVE: 'relative'
} as const;

/**
 * Timezone configuration constants.
 */
export const TIME_ZONES = {
  /** Default timezone for the application */
  DEFAULT: 'UTC',
  /** Use user's preferred timezone from profile */
  USER_PREFERENCE: 'user'
} as const;

/**
 * Validation rule constants including regex patterns and length constraints.
 * Used across forms and input validation throughout the application.
 */
export const VALIDATION = {
  /** Email address validation regex */
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  /** Minimum password length */
  PASSWORD_MIN_LENGTH: 8,
  /** Maximum password length */
  PASSWORD_MAX_LENGTH: 100,
  /** Minimum username length */
  USERNAME_MIN_LENGTH: 3,
  /** Maximum username length */
  USERNAME_MAX_LENGTH: 50,
  /** Username validation regex (alphanumeric, underscore, hyphen) */
  USERNAME_REGEX: /^[a-zA-Z0-9_-]+$/,
  /** Maximum course name length */
  COURSE_NAME_MAX_LENGTH: 254,
  /** Maximum description length */
  DESCRIPTION_MAX_LENGTH: 10000,
  /** Phone number validation regex */
  PHONE_REGEX: /^\+?[\d\s()-]{10,20}$/,
  /** URL validation regex */
  URL_REGEX: /^https?:\/\/.+/
} as const;

/**
 * UI-related constants including breakpoints, z-index layers, and animation durations.
 * Matches Material-UI defaults where applicable for consistency.
 */
export const UI = {
  /** Responsive breakpoint values (matches MUI defaults) */
  BREAKPOINTS: {
    /** Extra small devices (0px and up) */
    XS: 0,
    /** Small devices (600px and up) */
    SM: 600,
    /** Medium devices (900px and up) */
    MD: 900,
    /** Large devices (1200px and up) */
    LG: 1200,
    /** Extra large devices (1536px and up) */
    XL: 1536
  },
  
  /** Z-index layering system for overlays and modals */
  Z_INDEX: {
    /** Navigation drawer z-index */
    DRAWER: 1200,
    /** App bar z-index */
    APP_BAR: 1100,
    /** Modal dialog z-index */
    MODAL: 1300,
    /** Snackbar notification z-index */
    SNACKBAR: 1400,
    /** Tooltip z-index */
    TOOLTIP: 1500
  },
  
  /** Animation duration constants (milliseconds) */
  ANIMATION: {
    /** Fast animations (150ms) */
    FAST: 150,
    /** Normal speed animations (300ms) */
    NORMAL: 300,
    /** Slow animations (500ms) */
    SLOW: 500
  },
  
  /** Debounce delay constants (milliseconds) */
  DEBOUNCE: {
    /** Search input debounce delay */
    SEARCH: 300,
    /** Generic input debounce delay */
    INPUT: 500,
    /** Window resize debounce delay */
    RESIZE: 150
  }
} as const;

/**
 * Cache duration constants for React Query.
 * Defines how long cached data remains fresh before refetching.
 */
export const CACHE_DURATIONS = {
  /** Short cache duration: 1 minute */
  SHORT: 1 * 60 * 1000,
  /** Medium cache duration: 5 minutes */
  MEDIUM: 5 * 60 * 1000,
  /** Long cache duration: 30 minutes */
  LONG: 30 * 60 * 1000,
  /** Very long cache duration: 1 hour */
  VERY_LONG: 60 * 60 * 1000,
  /** Infinite cache (manual invalidation only) */
  INFINITY: Infinity
} as const;

/**
 * Stale time constants for React Query.
 * Defines how long data is considered fresh before becoming stale.
 */
export const STALE_TIMES = {
  /** Immediately stale (always refetch) */
  IMMEDIATE: 0,
  /** Short stale time: 30 seconds */
  SHORT: 30 * 1000,
  /** Medium stale time: 5 minutes */
  MEDIUM: 5 * 60 * 1000,
  /** Long stale time: 30 minutes */
  LONG: 30 * 60 * 1000
} as const;

/**
 * Error code constants matching API error responses.
 * Used for error handling and displaying appropriate user messages.
 */
export const ERROR_CODES = {
  // Authentication errors
  /** Invalid login credentials provided */
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  /** JWT token has expired */
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  /** JWT token is invalid or malformed */
  TOKEN_INVALID: 'TOKEN_INVALID',
  /** User is not authenticated */
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Permission errors
  /** User lacks required permissions */
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  /** Insufficient privileges for this operation */
  INSUFFICIENT_PRIVILEGES: 'INSUFFICIENT_PRIVILEGES',
  
  // Resource errors
  /** Generic resource not found */
  NOT_FOUND: 'NOT_FOUND',
  /** Specific resource not found */
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  /** Resource already exists (duplicate) */
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Validation errors
  /** Generic validation error */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** Invalid input provided */
  INVALID_INPUT: 'INVALID_INPUT',
  /** Required field is missing */
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Server errors
  /** Internal server error */
  SERVER_ERROR: 'SERVER_ERROR',
  /** Network connectivity error */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** Request timeout */
  TIMEOUT: 'TIMEOUT',
  
  // Quiz-specific errors
  /** Quiz attempt already started */
  QUIZ_ALREADY_STARTED: 'QUIZ_ALREADY_STARTED',
  /** Quiz time limit expired */
  QUIZ_TIME_EXPIRED: 'QUIZ_TIME_EXPIRED',
  
  // File-specific errors
  /** Uploaded file exceeds size limit */
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  /** File type not allowed */
  FILE_TYPE_NOT_ALLOWED: 'FILE_TYPE_NOT_ALLOWED',
  
  // Generic fallback
  /** Unknown or unclassified error */
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

/**
 * Application route path constants.
 * Centralized route definitions for consistent navigation.
 * Use with React Router for type-safe routing.
 */
export const ROUTES = {
  /** Home/landing page */
  HOME: '/',
  /** Login page */
  LOGIN: '/login',
  /** Logout page */
  LOGOUT: '/logout',
  /** User dashboard */
  DASHBOARD: '/dashboard',
  /** Course catalog listing */
  COURSES: '/courses',
  /** Individual course detail page (dynamic :id parameter) */
  COURSE_DETAIL: '/courses/:id',
  /** User's enrolled courses */
  MY_COURSES: '/my/courses',
  /** Assignment listing */
  ASSIGNMENTS: '/assignments',
  /** Individual assignment detail (dynamic :id parameter) */
  ASSIGNMENT_DETAIL: '/assignments/:id',
  /** Quiz listing */
  QUIZZES: '/quizzes',
  /** Individual quiz detail (dynamic :id parameter) */
  QUIZ_DETAIL: '/quizzes/:id',
  /** Quiz attempt page (dynamic :id parameter) */
  QUIZ_ATTEMPT: '/quizzes/:id/attempt',
  /** Forum listing */
  FORUMS: '/forums',
  /** Individual forum detail (dynamic :id parameter) */
  FORUM_DETAIL: '/forums/:id',
  /** Gradebook page */
  GRADEBOOK: '/gradebook',
  /** Messaging center */
  MESSAGES: '/messages',
  /** User profile page */
  PROFILE: '/profile',
  /** User settings page */
  SETTINGS: '/settings',
  /** Admin dashboard */
  ADMIN: '/admin'
} as const;

/**
 * Quiz-specific configuration constants.
 * Settings for quiz attempts, timing, and question types.
 */
export const QUIZ = {
  /** Auto-save interval for quiz attempts (30 seconds) */
  AUTO_SAVE_INTERVAL: 30000,
  /** Time warning threshold (5 minutes in seconds) */
  TIME_WARNING_THRESHOLD: 300,
  /** Question type identifiers matching Moodle question types */
  QUESTION_TYPES: {
    /** Multiple choice question */
    MULTIPLE_CHOICE: 'multichoice',
    /** True/false question */
    TRUE_FALSE: 'truefalse',
    /** Short answer question */
    SHORT_ANSWER: 'shortanswer',
    /** Essay question */
    ESSAY: 'essay',
    /** Matching question */
    MATCHING: 'matching',
    /** Calculated question */
    CALCULATED: 'calculated'
  }
} as const;

/**
 * Grade-related constants including ranges and aggregation methods.
 * Matches Moodle's grading system conventions.
 */
export const GRADE = {
  /** Minimum grade value */
  MIN_GRADE: 0,
  /** Maximum grade value */
  MAX_GRADE: 100,
  /** Default passing grade percentage */
  PASSING_GRADE: 60,
  /** Number of decimal places for grade display */
  DECIMAL_PLACES: 2,
  /** Grade aggregation methods matching Moodle's grade calculation options */
  AGGREGATION_METHODS: {
    /** Simple mean of all grades */
    MEAN: 'mean',
    /** Weighted mean based on item weights */
    WEIGHTED_MEAN: 'weighted_mean',
    /** Sum of all grades */
    SUM: 'sum',
    /** Highest grade only */
    HIGHEST: 'highest',
    /** Lowest grade only */
    LOWEST: 'lowest'
  }
} as const;

/**
 * Type alias for HTTP status codes derived from HTTP_STATUS constant.
 */
export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];

/**
 * Type alias for error codes derived from ERROR_CODES constant.
 */
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Type alias for route paths derived from ROUTES constant.
 */
export type Route = typeof ROUTES[keyof typeof ROUTES];

/**
 * Type alias for capability strings derived from CAPABILITIES constant.
 */
export type Capability = typeof CAPABILITIES[keyof typeof CAPABILITIES];
