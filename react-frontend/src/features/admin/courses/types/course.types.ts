/**
 * TypeScript type definitions for Course entity in admin course management.
 * 
 * This file contains comprehensive interface definitions for the Course entity,
 * mapping Moodle's course database schema to TypeScript types for use in the
 * React admin interface.
 * 
 * @module features/admin/courses/types
 */

/**
 * Course format types supported by Moodle
 */
export type CourseFormat = 
  | 'topics'        // Topic-based format
  | 'weeks'         // Weekly format
  | 'social'        // Social format
  | 'singleactivity' // Single activity format
  | string;         // Allow custom format plugins

/**
 * Course visibility options
 */
export enum CourseVisibility {
  HIDDEN = 0,
  VISIBLE = 1,
}

/**
 * Group mode options for courses
 */
export enum GroupMode {
  NO_GROUPS = 0,      // No groups
  SEPARATE_GROUPS = 1, // Separate groups
  VISIBLE_GROUPS = 2,  // Visible groups
}

/**
 * Download course content options
 */
export enum DownloadContentOption {
  SITE_DEFAULT = 0,
  DISABLED = 1,
  ENABLED = 2,
}

/**
 * Text format options for course summary and other text fields
 */
export enum TextFormat {
  MOODLE = 0,   // Moodle auto-format
  HTML = 1,     // HTML format
  PLAIN = 2,    // Plain text format
  MARKDOWN = 4, // Markdown format
}

/**
 * Legacy files option
 */
export enum LegacyFilesOption {
  NO = 0,
  DISABLED = 1,
  ENABLED = 2,
}

/**
 * Enrollment method information
 */
export interface EnrolmentMethod {
  /** Enrollment method ID */
  id: number;
  /** Enrollment method type (e.g., 'manual', 'self', 'cohort') */
  enrol: string;
  /** Method name */
  name: string;
  /** Whether method is enabled */
  status: number;
}

/**
 * Course tag information
 */
export interface CourseTag {
  /** Tag ID */
  id: number;
  /** Tag name */
  name: string;
  /** Tag display name */
  rawname: string;
}

/**
 * Complete Course entity interface representing a Moodle course.
 * 
 * This interface maps all essential fields from the Moodle course table
 * and related data structures, providing type safety for course CRUD
 * operations in the admin interface.
 * 
 * @interface Course
 */
export interface Course {
  /**
   * Unique course identifier
   * Primary key from mdl_course table
   */
  id: number;

  /**
   * Full course name
   * Required field, maximum 254 characters
   * @example "Introduction to Computer Science"
   */
  fullname: string;

  /**
   * Short course name
   * Required field, maximum 255 characters
   * Used for course identification and breadcrumbs
   * @example "CS101"
   */
  shortname: string;

  /**
   * Course category ID
   * Foreign key reference to mdl_course_categories
   * Determines course organization and permissions inheritance
   */
  category: number;

  /**
   * Course visibility flag
   * 0 = hidden, 1 = visible
   * Controls whether course appears in listings and is accessible to students
   */
  visible: number;

  /**
   * Course start date
   * Unix timestamp indicating when the course begins
   * Used for enrollment periods and relative dates
   */
  startdate: number;

  /**
   * Course end date
   * Unix timestamp indicating when the course ends
   * Optional field (0 or null means no end date)
   */
  enddate: number;

  /**
   * ID number for external systems
   * Optional alphanumeric identifier for integration with external systems
   * Must be unique across all courses if set
   * @example "2024-FALL-CS101"
   */
  idnumber?: string;

  /**
   * Course format type
   * Determines the course layout and structure
   * Common values: 'topics', 'weeks', 'social', 'singleactivity'
   * @default 'topics'
   */
  format: CourseFormat;

  /**
   * Show gradebook to students
   * 0 = no, 1 = yes
   * Controls whether students can see their grades
   * @default 1
   */
  showgrades: number;

  /**
   * Number of news items to show
   * Integer value 0-10 indicating how many recent news/announcement items to display
   * @default 5
   */
  newsitems: number;

  /**
   * Maximum file upload size in bytes
   * Controls the maximum size for file uploads in this course
   * 0 means use site default
   * @default 0
   */
  maxbytes: number;

  /**
   * Show activity reports to students
   * 0 = no, 1 = yes
   * Controls whether students can see their own activity reports
   * @default 0
   */
  showreports: number;

  /**
   * Group mode for the course
   * 0 = no groups, 1 = separate groups, 2 = visible groups
   * Determines default group behavior for activities
   * @default 0
   */
  groupmode: number;

  /**
   * Force group mode
   * 0 = no, 1 = yes
   * If enabled, course group mode is forced on all activities
   * @default 0
   */
  groupmodeforce: number;

  /**
   * Default grouping ID
   * Foreign key to mdl_groupings
   * 0 means no default grouping
   * @default 0
   */
  defaultgroupingid: number;

  /**
   * Course creation timestamp
   * Unix timestamp when the course was created
   * Automatically set on course creation
   */
  timecreated: number;

  /**
   * Course modification timestamp
   * Unix timestamp when the course was last modified
   * Automatically updated on course changes
   */
  timemodified: number;

  /**
   * Course summary/description
   * Rich text description of the course content and objectives
   * Can contain HTML depending on summaryformat
   */
  summary?: string;

  /**
   * Summary text format
   * Indicates the format of the summary field
   * 0 = Moodle, 1 = HTML, 2 = Plain, 4 = Markdown
   * @default 1
   */
  summaryformat: number;

  /**
   * Download course content setting
   * 0 = use site default, 1 = disabled, 2 = enabled
   * Controls whether students can download course content
   */
  downloadcontent?: number;

  /**
   * Relative dates mode
   * 0 = no, 1 = yes
   * If enabled, activity dates are relative to student enrollment date
   * Cannot be changed after course creation
   * @default 0
   */
  relativedatesmode: number;

  /**
   * Enable completion tracking
   * 0 = disabled, 1 = enabled
   * Controls whether activity and course completion tracking is available
   * @default 0
   */
  enablecompletion: number;

  /**
   * Show activity completion conditions
   * 0 = no, 1 = yes
   * Controls whether completion conditions are visible to students
   * Only relevant if enablecompletion is 1
   * @default 1
   */
  showcompletionconditions: number;

  /**
   * Show activity dates
   * 0 = no, 1 = yes
   * Controls whether activity dates are displayed to students
   * @default 1
   */
  showactivitydates: number;

  /**
   * Forced language
   * Language code (e.g., 'en', 'es', 'fr')
   * Empty string means no forced language
   * If set, all course content is displayed in this language
   */
  lang?: string;

  /**
   * Forced theme
   * Theme name (e.g., 'boost', 'classic')
   * Empty string means no forced theme
   * If set, this theme is used for the course regardless of user preference
   */
  theme?: string;

  /**
   * Calendar type
   * Calendar system to use (e.g., 'gregorian', 'hijri')
   * Empty string means use site default
   */
  calendartype?: string;

  /**
   * Legacy files option
   * 0 = no legacy files, 1 = legacy files disabled, 2 = legacy files enabled
   * Controls access to legacy course files area
   * @default 0
   */
  legacyfiles: number;

  /**
   * PDF export font
   * Font name to use for PDF exports from this course
   * Empty or undefined means use site default
   * @example 'freesans', 'dejavusans'
   */
  pdfexportfont?: string;

  /**
   * Enable AI tools in course
   * 0 = no, 1 = yes
   * Controls whether AI-powered tools are available in this course
   * @default 1
   */
  enableaitools: number;

  /**
   * Course sort order
   * Integer determining the display order within the category
   * Lower numbers appear first
   * Automatically managed by Moodle
   */
  sortorder: number;

  /**
   * Course image URL
   * URL to the course overview image
   * Used in course listings and cards
   * Optional field
   */
  courseimage?: string;

  /**
   * Enrollment methods
   * Array of enrollment methods available for this course
   * Includes method type, name, and status
   */
  enrolmentmethods?: EnrolmentMethod[];

  /**
   * Course tags
   * Array of tags associated with this course
   * Used for course discovery and categorization
   */
  tags?: CourseTag[];
}

/**
 * Course creation request payload
 * Contains required and optional fields for creating a new course
 */
export interface CourseCreateRequest {
  fullname: string;
  shortname: string;
  category: number;
  visible?: number;
  startdate?: number;
  enddate?: number;
  idnumber?: string;
  format?: CourseFormat;
  summary?: string;
  summaryformat?: number;
  showgrades?: number;
  newsitems?: number;
  maxbytes?: number;
  showreports?: number;
  groupmode?: number;
  groupmodeforce?: number;
  enablecompletion?: number;
  showcompletionconditions?: number;
  showactivitydates?: number;
  downloadcontent?: number;
  relativedatesmode?: number;
  lang?: string;
  theme?: string;
  enableaitools?: number;
  tags?: string[];
}

/**
 * Course update request payload
 * Contains optional fields that can be updated for an existing course
 */
export interface CourseUpdateRequest extends Partial<CourseCreateRequest> {
  id: number;
}

/**
 * Course list filters for admin course management
 */
export interface CourseFilters {
  /** Filter by category ID */
  category?: number;
  /** Search query for course name or shortname */
  search?: string;
  /** Filter by visibility */
  visible?: number;
  /** Filter by format */
  format?: CourseFormat;
  /** Filter by completion enabled */
  enablecompletion?: number;
  /** Sort field */
  sortby?: 'fullname' | 'shortname' | 'timecreated' | 'timemodified' | 'startdate';
  /** Sort direction */
  sortorder?: 'asc' | 'desc';
}

/**
 * Paginated course list response
 */
export interface CoursePaginatedResponse {
  /** Array of courses */
  courses: Course[];
  /** Total number of courses matching filters */
  total: number;
  /** Current page number (0-indexed) */
  page: number;
  /** Number of items per page */
  perPage: number;
  /** Total number of pages */
  totalPages: number;
}
