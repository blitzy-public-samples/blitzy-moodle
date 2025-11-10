/**
 * Course Type Definitions
 *
 * TypeScript type definitions for course-related entities matching Moodle's database schema.
 * These types provide type safety for React components while maintaining compatibility
 * with the backend API and database structure.
 *
 * @module features/courses/types
 */

import type { RoleId } from '@/types/common';

// ============================================================================
// Enums
// ============================================================================

/**
 * Enrollment status values matching Moodle ENROL_USER_* constants
 * - ACTIVE (0): User is actively enrolled and can participate
 * - SUSPENDED (1): User enrollment is suspended
 * - NOT_ENROLLED: User is not enrolled in the course
 */
export enum EnrollmentStatus {
  ACTIVE = 0,
  SUSPENDED = 1,
  NOT_ENROLLED = -1,
}

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Course format types supported by Moodle
 * Common formats: 'topics', 'weeks', 'singleactivity', 'social'
 * Can also be custom format from plugins
 */
export type CourseFormat = string;

/**
 * Sort order for course listing
 */
export type SortOrder = 'asc' | 'desc';

// ============================================================================
// Core Interfaces - Database Schema Mappings
// ============================================================================

/**
 * Course interface matching Moodle mdl_course table schema
 *
 * Represents a complete course entity with all database fields.
 * Field types match the Moodle database schema exactly.
 *
 * @interface Course
 */
export interface Course {
  /** Course ID (primary key, int 10) */
  id: number;

  /** Course category ID (int 10, foreign key to course_categories) */
  category: number;

  /** Sort order within category (int 10) */
  sortorder?: number;

  /** Full course name (char 1333) */
  fullname: string;

  /** Short course name/code (char 255) */
  shortname: string;

  /** Custom identifier for external systems (char 100) */
  idnumber?: string;

  /** Course description/summary (text, nullable) */
  summary?: string | null;

  /** Summary format: 0=Moodle, 1=HTML, 2=Plain, 4=Markdown (int 2) */
  summaryformat?: number;

  /** Course format type (char 21, default='topics') */
  format: CourseFormat;

  /** Whether to show grades to students: 1=yes, 0=no (int 2) */
  showgrades?: number;

  /** Number of news/announcements items to display (int 5) */
  newsitems?: number;

  /** Course start date (Unix timestamp, int 10) */
  startdate: number;

  /** Course end date (Unix timestamp, int 10) */
  enddate: number;

  /** Whether to display relative dates: 0=no, 1=yes (int 1) */
  relativedatesmode?: number;

  /** Current marker for course format (int 10) */
  marker?: number;

  /** Maximum upload file size in bytes (int 10) */
  maxbytes?: number;

  /** Legacy files setting: 0=none, 1=disabled, 2=enabled (int 4) */
  legacyfiles?: number;

  /** Whether to show reports: 0=no, 1=yes (int 4) */
  showreports?: number;

  /** Course visibility: 1=visible, 0=hidden (int 1) */
  visible: number;

  /** Previous visibility state when parent category hidden (int 1) */
  visibleold?: number;

  /** Allow course content download: 1=yes, 0=no, null=inherit (int 1, nullable) */
  downloadcontent?: number | null;

  /** Group mode: 0=No groups, 1=Separate groups, 2=Visible groups (int 4) */
  groupmode?: number;

  /** Force group mode in all activities: 1=yes, 0=no (int 4) */
  groupmodeforce?: number;

  /** Default grouping ID for activities (int 10) */
  defaultgroupingid?: number;

  /**
   * Forced language for this course
   * Empty string or null means 'Do not force'
   * Otherwise a Moodle lang pack name like 'en' or 'en_us' (char 30)
   */
  lang: string;

  /** Calendar type for this course (char 30) */
  calendartype?: string;

  /** Theme override for this course (char 50) */
  theme?: string;

  /** Course creation timestamp (Unix timestamp, int 10) */
  timecreated: number;

  /** Last modification timestamp (Unix timestamp, int 10) */
  timemodified: number;

  /** Whether course was requested: 1=yes, 0=no (int 1) */
  requested?: number;

  /**
   * Enable activity completion tracking
   * 1 = allow use of completion progress-tracking on this course
   * 0 = disable completion tracking on this course (int 1)
   */
  enablecompletion?: number;

  /** Notify users when they complete this course: 1=yes, 0=no (int 1) */
  completionnotify?: number;

  /** Cache revision number for validating course content cache (int 10) */
  cacherev?: number;

  /**
   * Original course ID if this course was restored from another course
   * on the same site (int 10, nullable, foreign key to course)
   */
  originalcourseid?: number | null;

  /** Display activity dates to users: 1=yes, 0=no (int 1) */
  showactivitydates?: number;

  /**
   * Display completion conditions to users
   * 1 = display conditions, 0 = do not display (int 1, nullable)
   */
  showcompletionconditions?: number | null;

  /** PDF export font setting (char 50, nullable) */
  pdfexportfont?: string | null;

  /** Allow AI tools in this course: 1=enabled, 0=disabled (int 1, nullable) */
  enableaitools?: number | null;
}

/**
 * Course category interface matching Moodle mdl_course_categories table
 *
 * Represents hierarchical course categories used to organize courses.
 *
 * @interface CourseCategory
 */
export interface CourseCategory {
  /** Category ID (primary key, int 10) */
  id: number;

  /** Category name (char 255) */
  name: string;

  /** Custom identifier for external systems (char 100, nullable) */
  idnumber?: string | null;

  /** Category description (text, nullable) */
  description?: string | null;

  /** Description format: 0=Moodle, 1=HTML, 2=Plain, 4=Markdown (int 2) */
  descriptionformat: number;

  /** Parent category ID, 0 for top-level (int 10, foreign key to course_categories) */
  parent: number;

  /** Sort order within parent category (int 10) */
  sortorder: number;

  /** Number of courses in this category (int 10) */
  coursecount: number;

  /** Category visibility: 1=visible, 0=hidden (int 1) */
  visible: number;

  /** Previous visibility state when parent hidden (int 1) */
  visibleold: number;

  /** Last modification timestamp (Unix timestamp, int 10) */
  timemodified: number;

  /** Depth level in category hierarchy, 0=top level (int 10) */
  depth: number;

  /** Full path from root, e.g., "/1/2/5" (char 255) */
  path: string;

  /** Theme override for this category (char 50, nullable) */
  theme?: string | null;
}

/**
 * Course section interface matching Moodle mdl_course_sections table
 *
 * Represents a section/topic/week within a course containing activities.
 *
 * @interface CourseSection
 */
export interface CourseSection {
  /** Section ID (primary key, int 10) */
  id: number;

  /** Course ID this section belongs to (int 10, foreign key to course) */
  course: number;

  /** Section number within the course (int 10) */
  section: number;

  /** Section name/title (char 1333, nullable) */
  name?: string | null;

  /** Section summary/description (text, nullable) */
  summary?: string | null;

  /** Summary format: 0=Moodle, 1=HTML, 2=Plain, 4=Markdown (int 2) */
  summaryformat: number;

  /**
   * Comma-separated list of course module IDs in this section
   * Example: "123,124,125" (text, nullable)
   */
  sequence?: string | null;

  /** Section visibility: 1=visible, 0=hidden (int 1) */
  visible: number;

  /**
   * Availability restrictions in JSON format
   * Null if no restrictions, otherwise JSON object with conditions (text, nullable)
   */
  availability?: string | null;

  /** Delegate component name if section is managed by a component (char 100, nullable) */
  component?: string | null;

  /** Item ID used by delegate component to identify its instance (int 10, nullable) */
  itemid?: number | null;

  /** Last modification timestamp (Unix timestamp, int 10) */
  timemodified: number;
}

/**
 * User enrollment interface matching Moodle mdl_user_enrolments table
 *
 * Represents a user's enrollment in a course with status and timing.
 *
 * @interface Enrollment
 */
export interface Enrollment {
  /** Enrollment ID (primary key, int 10) */
  id: number;

  /**
   * Enrollment status
   * 0 = active participation (ENROL_USER_ACTIVE)
   * 1 = suspended (ENROL_USER_SUSPENDED)
   * Plugins may define status > 10 (int 10)
   */
  status: EnrollmentStatus;

  /** Enrolment method ID (int 10, foreign key to enrol) */
  enrolid: number;

  /** User ID (int 10, foreign key to user) */
  userid: number;

  /** Enrollment start time (Unix timestamp, int 10) */
  timestart: number;

  /** Enrollment end time (Unix timestamp, int 10, default=2147483647 for no end) */
  timeend: number;

  /** User ID who last modified this enrollment (int 10, foreign key to user) */
  modifierid: number;

  /** Enrollment creation timestamp (Unix timestamp, int 10) */
  timecreated: number;

  /** Last modification timestamp (Unix timestamp, int 10) */
  timemodified: number;
}

/**
 * Course progress tracking interface
 *
 * Tracks a user's completion progress in a course.
 *
 * @interface CourseProgress
 */
export interface CourseProgress {
  /** Completion percentage (0-100) */
  completionPercentage: number;

  /** Number of activities marked as complete */
  completedActivities: number;

  /** Total number of activities in the course */
  totalActivities: number;

  /** Last access timestamp (Unix timestamp) */
  lastAccess: number;

  /** Whether the course is fully complete */
  isComplete: boolean;
}

// ============================================================================
// UI-Specific Interfaces
// ============================================================================

/**
 * Simplified course section for UI display with parsed data
 *
 * @interface Section
 */
export interface Section {
  /** Section ID */
  id: number;

  /** Section name/title */
  name: string | null;

  /** Section summary/description */
  summary: string | null;

  /** Section visibility */
  visible: boolean;

  /** Parsed availability information for display */
  availabilityInfo?: string | null;

  /** Activities in this section */
  activities: Activity[];

  /** Completion percentage for this section (0-100) */
  completionPercentage: number;
}

/**
 * Activity/module within a course section
 *
 * @interface Activity
 */
export interface Activity {
  /** Activity/module ID */
  id: number;

  /** Activity name */
  name: string;

  /** Activity type (e.g., 'assignment', 'quiz', 'forum') */
  type: string;

  /** Module name from Moodle (e.g., 'assign', 'quiz', 'forum') */
  modname: string;

  /** URL to access the activity */
  url: string;

  /** Whether the activity is completed by the user */
  completed: boolean;

  /** Activity visibility */
  visible: boolean;

  /** Icon URL or identifier for the activity type */
  icon?: string;
}

// ============================================================================
// Form Data Interfaces
// ============================================================================

/**
 * Course form data for creating or editing courses
 *
 * @interface CourseFormData
 */
export interface CourseFormData {
  /** Full course name */
  fullname: string;

  /** Short course name/code */
  shortname: string;

  /** Course category ID */
  category: number;

  /** Course description */
  summary?: string;

  /** Course start date (Unix timestamp) */
  startdate: number;

  /** Course end date (Unix timestamp) */
  enddate: number;

  /** Course format */
  format: CourseFormat;

  /** Course language */
  language?: string;

  /** Course visibility */
  visible: boolean;

  /** Course image file (for upload) */
  image?: File;
}

// ============================================================================
// API Request Types
// ============================================================================

/**
 * Request parameters for fetching courses list
 *
 * @interface GetCoursesRequest
 */
export interface GetCoursesRequest {
  /** Page number for pagination (1-based) */
  page?: number;

  /** Number of items per page */
  perPage?: number;

  /** Filter by category ID */
  categoryId?: number;

  /** Search query string */
  search?: string;

  /** Field to sort by */
  sortBy?: string;

  /** Sort order direction */
  sortOrder?: SortOrder;
}

/**
 * Request data for creating a new course
 *
 * @interface CreateCourseRequest
 */
export interface CreateCourseRequest {
  /** Full course name (required) */
  fullname: string;

  /** Short course name/code (required) */
  shortname: string;

  /** Course category ID (required) */
  category: number;

  /** Course description */
  summary?: string;

  /** Summary format */
  summaryformat?: number;

  /** Course format */
  format: CourseFormat;

  /** Course start date (Unix timestamp) */
  startdate: number;

  /** Course end date (Unix timestamp) */
  enddate: number;

  /** Course visibility */
  visible: number;

  /** Course language */
  lang?: string;

  /** Enable completion tracking */
  enablecompletion?: number;
}

/**
 * Request data for updating an existing course
 *
 * @interface UpdateCourseRequest
 */
export interface UpdateCourseRequest {
  /** Course ID (required) */
  id: number;

  /** Full course name */
  fullname?: string;

  /** Short course name/code */
  shortname?: string;

  /** Course category ID */
  category?: number;

  /** Course description */
  summary?: string;

  /** Summary format */
  summaryformat?: number;

  /** Course format */
  format?: CourseFormat;

  /** Course start date (Unix timestamp) */
  startdate?: number;

  /** Course end date (Unix timestamp) */
  enddate?: number;

  /** Course visibility */
  visible?: number;

  /** Course language */
  lang?: string;

  /** Enable completion tracking */
  enablecompletion?: number;
}

/**
 * Request data for enrolling a user in a course
 *
 * @interface EnrollInCourseRequest
 */
export interface EnrollInCourseRequest {
  /** Course ID to enroll in */
  courseId: number;

  /** User ID to enroll (optional, defaults to current user) */
  userId?: number;

  /** Role ID to assign (e.g., student, teacher) */
  roleId?: RoleId;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response for fetching courses list with pagination
 *
 * @interface GetCoursesResponse
 */
export interface GetCoursesResponse {
  /** Request success status */
  success: true;

  /** Array of courses */
  data: Course[];

  /** Metadata including pagination info */
  meta: {
    pagination: {
      /** Current page number */
      page: number;

      /** Items per page */
      perPage: number;

      /** Total number of items */
      total: number;

      /** Total number of pages */
      totalPages: number;
    };
  };
}

/**
 * Response for fetching a single course with details
 *
 * @interface CourseDetailResponse
 */
export interface CourseDetailResponse {
  /** Request success status */
  success: true;

  /** Course data with optional additional details */
  data: Course & {
    /** Course sections (optional) */
    sections?: CourseSection[];

    /** User's enrollment info (optional) */
    enrollment?: Enrollment;

    /** User's progress in the course (optional) */
    progress?: CourseProgress;
  };
}

/**
 * Response for enrollment operations
 *
 * @interface EnrollmentResult
 */
export interface EnrollmentResult {
  /** Operation success status */
  success: boolean;

  /** Course ID */
  courseid: number;

  /** User ID enrolled */
  userid: number;

  /** Role ID assigned */
  roleid?: number;

  /** Success or error message */
  message?: string;

  /** Enrollment record ID if successful */
  enrollmentId?: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Simplified course summary for list views
 * Picks only essential fields from the full Course interface
 */
export type CourseSummary = Pick<
  Course,
  'id' | 'fullname' | 'shortname' | 'category' | 'visible' | 'format'
>;

/**
 * Course list item with optional enrollment and progress data
 * Used in course catalog and "My Courses" views
 */
export type CourseListItem = Course & {
  /** User's enrollment info (optional) */
  enrollment?: Enrollment;

  /** User's progress in the course (optional) */
  progress?: CourseProgress;
};
