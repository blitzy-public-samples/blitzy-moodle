/**
 * TypeScript type definitions for Course Category entity
 *
 * This file provides type definitions for course categories in the Moodle admin interface.
 * These types are derived from Moodle's core_course_category class and the course_categories
 * database table structure.
 *
 * @package react-frontend
 * @subpackage features/admin/courses
 * @see public/course/classes/category.php - Source of category structure
 * @see public/course/classes/editcategory_form.php - Category form fields
 */

/**
 * Course Category Interface
 *
 * Represents a course category in Moodle's hierarchical category structure.
 * Categories can be nested to create a tree structure for organizing courses.
 *
 * @interface CourseCategory
 */
export interface CourseCategory {
  /**
   * Unique identifier for the category
   * Primary key from course_categories table
   */
  id: number;

  /**
   * Display name of the category
   * Required field, used for navigation and display
   */
  name: string;

  /**
   * Optional identifier/code for the category
   * Used for external integrations and reporting
   * Can be null if not set
   */
  idnumber: string | null;

  /**
   * Long description of the category
   * Can contain HTML content depending on descriptionformat
   * Null if no description is provided
   */
  description: string | null;

  /**
   * Format of the description field
   * Corresponds to Moodle FORMAT_* constants:
   * - 0: FORMAT_MOODLE (Moodle auto-format)
   * - 1: FORMAT_HTML (Plain HTML)
   * - 2: FORMAT_PLAIN (Plain text)
   * - 3: FORMAT_WIKI (Wiki format - deprecated)
   * - 4: FORMAT_MARKDOWN (Markdown format)
   * Null if description is not set
   */
  descriptionformat: number | null;

  /**
   * Parent category ID
   * - 0 indicates this is a top-level category
   * - Non-zero values reference another category's id
   * Used to build the hierarchical tree structure
   */
  parent: number;

  /**
   * Sort order within parent category
   * Lower numbers appear first in category listings
   * Used for manual ordering of categories
   */
  sortorder: number;

  /**
   * Number of courses directly within this category
   * Does not include courses in subcategories
   * Cached value for performance
   */
  coursecount: number;

  /**
   * Visibility status of the category
   * - 1: Category is visible to users
   * - 0: Category is hidden from users
   * Affects whether category appears in navigation and course listings
   */
  visible: number;

  /**
   * Previous visibility state before being hidden
   * Used to restore visibility when parent category becomes visible
   * Null if never changed or not applicable
   */
  visibleold: number | null;

  /**
   * Unix timestamp of last modification
   * Updated whenever category properties are changed
   * Null if never modified since creation
   */
  timemodified: number | null;

  /**
   * Depth level in the category tree
   * - 1: Top-level category (parent = 0)
   * - 2: Child of top-level category
   * - 3+: Deeper nesting levels
   * Used for indentation and tree rendering
   */
  depth: number;

  /**
   * Path from root to this category
   * Format: "/parentid1/parentid2/.../thisid"
   * Example: "/0/5/12" means category 12 is child of 5, which is top-level
   * Used for efficient tree queries and hierarchy validation
   */
  path: string;

  /**
   * Theme override for this category
   * If set, courses in this category use this theme instead of site theme
   * Null if no theme override is set
   * Only populated if $CFG->allowcategorythemes is enabled
   */
  theme: string | null;
}

/**
 * Partial Course Category Interface
 *
 * Used for category updates where only some fields are provided.
 * All fields are optional to allow partial updates.
 *
 * @interface PartialCourseCategory
 */
export interface PartialCourseCategory {
  id?: number;
  name?: string;
  idnumber?: string | null;
  description?: string | null;
  descriptionformat?: number | null;
  parent?: number;
  sortorder?: number;
  coursecount?: number;
  visible?: number;
  visibleold?: number | null;
  timemodified?: number | null;
  depth?: number;
  path?: string;
  theme?: string | null;
}

/**
 * Course Category Create Input Interface
 *
 * Used when creating a new category.
 * Only includes fields that can be set during creation.
 *
 * @interface CourseCategoryCreateInput
 */
export interface CourseCategoryCreateInput {
  /**
   * Name of the new category (required)
   */
  name: string;

  /**
   * Optional identifier for the category
   */
  idnumber?: string;

  /**
   * Optional description text
   */
  description?: string;

  /**
   * Description format (defaults to 1 for HTML if not specified)
   */
  descriptionformat?: number;

  /**
   * Parent category ID (defaults to 0 for top-level)
   */
  parent?: number;

  /**
   * Theme override (optional, requires allowcategorythemes setting)
   */
  theme?: string;
}

/**
 * Course Category Update Input Interface
 *
 * Used when updating an existing category.
 * All fields except id are optional.
 *
 * @interface CourseCategoryUpdateInput
 */
export interface CourseCategoryUpdateInput {
  /**
   * ID of the category to update (required)
   */
  id: number;

  /**
   * New name for the category
   */
  name?: string;

  /**
   * New idnumber
   */
  idnumber?: string | null;

  /**
   * New description
   */
  description?: string | null;

  /**
   * New description format
   */
  descriptionformat?: number | null;

  /**
   * New parent category ID
   */
  parent?: number;

  /**
   * New visibility status
   */
  visible?: number;

  /**
   * New theme override
   */
  theme?: string | null;
}

/**
 * Course Category Tree Node Interface
 *
 * Extends CourseCategory to include children for tree rendering.
 * Used in hierarchical category displays and management interfaces.
 *
 * @interface CourseCategoryTreeNode
 */
export interface CourseCategoryTreeNode extends CourseCategory {
  /**
   * Array of child categories
   * Empty array if category has no children
   * Used to render nested category structures
   */
  children: CourseCategoryTreeNode[];

  /**
   * Flag indicating if node is expanded in UI
   * Used for tree view state management
   */
  expanded?: boolean;

  /**
   * Flag indicating if node is currently selected
   * Used for highlighting in tree views
   */
  selected?: boolean;
}

/**
 * Course Category List Response Interface
 *
 * Standard API response format for category list endpoints.
 * Includes pagination metadata.
 *
 * @interface CourseCategoryListResponse
 */
export interface CourseCategoryListResponse {
  /**
   * Array of categories
   */
  categories: CourseCategory[];

  /**
   * Total number of categories (for pagination)
   */
  total: number;

  /**
   * Current page number
   */
  page?: number;

  /**
   * Number of items per page
   */
  perPage?: number;
}

/**
 * Course Category Sort Options
 *
 * Defines available sorting options for category lists.
 *
 * @type CourseCategorySortField
 */
export type CourseCategorySortField =
  | 'name'
  | 'idnumber'
  | 'sortorder'
  | 'coursecount'
  | 'timemodified';

/**
 * Course Category Sort Direction
 *
 * @type CourseCategorySortDirection
 */
export type CourseCategorySortDirection = 'asc' | 'desc';

/**
 * Course Category Filter Options
 *
 * Used for filtering category lists in admin interfaces.
 *
 * @interface CourseCategoryFilterOptions
 */
export interface CourseCategoryFilterOptions {
  /**
   * Filter by parent category ID
   * 0 for top-level categories only
   */
  parent?: number;

  /**
   * Filter by visibility status
   */
  visible?: number;

  /**
   * Search term for category name or idnumber
   */
  search?: string;

  /**
   * Filter by depth level
   */
  depth?: number;

  /**
   * Sort field
   */
  sortField?: CourseCategorySortField;

  /**
   * Sort direction
   */
  sortDirection?: CourseCategorySortDirection;
}
