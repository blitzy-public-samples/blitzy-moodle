/**
 * TypeScript type definitions for course and category administration forms.
 * 
 * These interfaces map to Moodle's course edit form (public/course/edit_form.php)
 * and category edit form (public/course/classes/editcategory_form.php).
 * 
 * @module features/admin/courses/types
 */

/**
 * Text format constants matching Moodle's FORMAT_* constants.
 * Used for editor content to specify the format of text fields.
 */
export enum TextFormat {
  /** Moodle auto-format (default) */
  MOODLE = 0,
  /** HTML format */
  HTML = 1,
  /** Plain text format */
  PLAIN = 2,
  /** Markdown format */
  MARKDOWN = 4,
}

/**
 * Editor content structure for rich text fields.
 * Represents the text and format information for editor fields
 * like course summary or category description.
 */
export interface EditorContent {
  /** The text content */
  text: string;
  /** The format of the text (one of TextFormat enum values) */
  format: TextFormat;
}

/**
 * Course format types supported by Moodle.
 * Common formats: 'topics', 'weeks', 'social', 'singleactivity'
 * Also supports custom format plugins as any string value
 */
export type CourseFormat = string;

/**
 * Download course content options.
 * Maps to Moodle's DOWNLOAD_COURSE_CONTENT_* constants.
 */
export enum DownloadContent {
  /** Site default setting */
  SITE_DEFAULT = 0,
  /** Download disabled */
  DISABLED = 1,
  /** Download enabled */
  ENABLED = 2,
}

/**
 * Form data structure for course creation and editing.
 * 
 * This interface represents the complete set of fields available in the
 * Moodle course edit form. When creating a new course, the 'id' field
 * should be undefined. When editing, 'id' should contain the course ID.
 * 
 * Required fields for course creation:
 * - fullname: The full name of the course
 * - shortname: The short name/code for the course
 * - category: The category ID where the course belongs
 * 
 * @see public/course/edit_form.php
 */
export interface CourseFormData {
  /**
   * Course ID. Present only when editing an existing course.
   * Undefined when creating a new course.
   */
  id?: number;

  /**
   * Full name of the course (required).
   * Maximum length: 254 characters
   * @example "Introduction to Computer Science"
   */
  fullname: string;

  /**
   * Short name/code for the course (required).
   * Used in navigation and course listings.
   * Maximum length: 255 characters
   * @example "CS101"
   */
  shortname: string;

  /**
   * Category ID where the course belongs (required).
   * Must be a valid category ID from the course categories.
   */
  category: number;

  /**
   * ID number for the course (optional).
   * Used for external system integration and bulk operations.
   * Maximum length: 100 characters
   * @example "CS-2024-SPRING-101"
   */
  idnumber?: string;

  /**
   * Course visibility setting.
   * - 1: Course is visible to students
   * - 0: Course is hidden from students
   * @default 1
   */
  visible?: 0 | 1;

  /**
   * Download course content setting.
   * Controls whether students can download course content.
   * @see DownloadContent enum
   */
  downloadcontent?: DownloadContent;

  /**
   * Course start date as Unix timestamp.
   * Represents when the course officially begins.
   * @example 1704067200 (January 1, 2024 00:00:00 UTC)
   */
  startdate: number;

  /**
   * Course end date as Unix timestamp (optional).
   * Represents when the course officially ends.
   * If not set, the course has no end date.
   * @example 1719792000 (July 1, 2024 00:00:00 UTC)
   */
  enddate?: number;

  /**
   * Relative dates mode setting.
   * When enabled, activity dates are relative to each student's enrollment.
   * - 0: Disabled (absolute dates)
   * - 1: Enabled (relative dates)
   * Note: Can only be set during course creation, not editable afterwards.
   * @default 0
   */
  relativedatesmode?: 0 | 1;

  /**
   * Course format type.
   * Determines the layout and structure of the course.
   * Common values: 'topics', 'weeks', 'social', 'singleactivity'
   * @default 'topics'
   * @see CourseFormat type
   */
  format: CourseFormat;

  /**
   * Course summary/description text.
   * Plain text version of the course description.
   */
  summary?: string;

  /**
   * Format of the course summary text.
   * @see TextFormat enum
   * @default TextFormat.HTML
   */
  summaryformat?: TextFormat;

  /**
   * Course overview files (images/media).
   * Array of file IDs or file objects for the course image and other overview media.
   * These files are displayed on the course listing page.
   */
  overviewfiles?: number[] | File[];
}

/**
 * Form data structure for category creation and editing.
 * 
 * This interface represents the fields available in the Moodle
 * course category edit form. Categories organize courses into
 * a hierarchical structure.
 * 
 * Required fields for category creation:
 * - name: The name of the category
 * - parent: The parent category ID (0 for top-level)
 * 
 * @see public/course/classes/editcategory_form.php
 */
export interface CategoryFormData {
  /**
   * Category ID. Present only when editing an existing category.
   * Undefined when creating a new category.
   */
  id?: number;

  /**
   * Name of the category (required).
   * Displayed in category listings and navigation.
   * @example "Computer Science"
   */
  name: string;

  /**
   * Parent category ID (required).
   * Use 0 for top-level categories.
   * Must be a valid category ID or 0.
   * @example 0 // Top-level category
   * @example 5 // Child of category with ID 5
   */
  parent: number;

  /**
   * ID number for the category (optional).
   * Used for external system integration and bulk operations.
   * Maximum length: 100 characters
   * Must be unique across all categories.
   * @example "DEPT-CS"
   */
  idnumber?: string;

  /**
   * Category description text.
   * Plain text version of the category description.
   */
  description?: string;

  /**
   * Format of the category description text.
   * @see TextFormat enum
   * @default TextFormat.HTML
   */
  descriptionformat?: TextFormat;

  /**
   * Theme to force for all courses in this category (optional).
   * If set, all courses in this category will use this theme.
   * Empty string or undefined means no forced theme.
   * @example "boost"
   * @example "classic"
   */
  theme?: string;
}

/**
 * Validation error structure for form fields.
 * Maps field names to their error messages.
 */
export interface FormErrors {
  [fieldName: string]: string;
}

/**
 * Form submission state for tracking async operations.
 */
export interface FormSubmissionState {
  /** Whether the form is currently being submitted */
  isSubmitting: boolean;
  /** Whether the submission was successful */
  isSuccess: boolean;
  /** Whether the submission encountered an error */
  isError: boolean;
  /** Error message if submission failed */
  error?: string;
}

/**
 * Course form validation result.
 */
export interface CourseFormValidation {
  /** Whether the form data is valid */
  isValid: boolean;
  /** Map of field names to error messages */
  errors: Partial<Record<keyof CourseFormData, string>>;
}

/**
 * Category form validation result.
 */
export interface CategoryFormValidation {
  /** Whether the form data is valid */
  isValid: boolean;
  /** Map of field names to error messages */
  errors: Partial<Record<keyof CategoryFormData, string>>;
}
