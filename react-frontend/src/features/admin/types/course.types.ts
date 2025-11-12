/**
 * Course Administration Type Definitions
 *
 * Comprehensive TypeScript type definitions for course administration features.
 * Based on Moodle's course_categories table schema and course management structures.
 * Provides type safety for admin operations including category hierarchy management,
 * bulk course operations, and course administrative data.
 *
 * These types extend the base Course types from the courses feature and add
 * admin-specific fields and operations not exposed to regular users.
 *
 * All types follow TypeScript strict mode with no 'any' types.
 *
 * @module features/admin/types/course
 */

import type { Timestamp } from '@/types/common';
import type { Course } from '@/features/courses/types/course.types';
import type { AdminFilterBase } from '@/features/admin/types/admin.types';

// ============================================================================
// Course Category Types - Based on mdl_course_categories Table
// ============================================================================

/**
 * Course Category Interface
 *
 * Represents a course category from the Moodle mdl_course_categories table.
 * Categories provide hierarchical organization of courses with parent-child relationships.
 *
 * Database Schema Mapping:
 * - Maps directly to mdl_course_categories table structure
 * - All integer fields are int(10) in database
 * - Text fields follow Moodle character limits
 *
 * @interface CourseCategory
 */
export interface CourseCategory {
  /**
   * Category unique identifier (primary key)
   * Maps to: mdl_course_categories.id (int 10)
   */
  id: number;

  /**
   * Category name displayed in UI
   * Maps to: mdl_course_categories.name (char 255)
   */
  name: string;

  /**
   * Custom identifier for external systems or integrations
   * Maps to: mdl_course_categories.idnumber (char 100)
   * Optional - may be empty string or null
   */
  idnumber: string;

  /**
   * Category description text (supports HTML)
   * Maps to: mdl_course_categories.description (text, nullable)
   * Can contain formatted text for display on category pages
   */
  description: string | null;

  /**
   * Format of description text
   * Maps to: mdl_course_categories.descriptionformat (int 2)
   * Values: 0=Moodle, 1=HTML, 2=Plain text, 4=Markdown
   */
  descriptionformat: number;

  /**
   * Parent category ID for hierarchical structure
   * Maps to: mdl_course_categories.parent (int 10)
   * 0 indicates top-level category (no parent)
   */
  parent: number;

  /**
   * Display order within parent category
   * Maps to: mdl_course_categories.sortorder (int 10)
   * Lower numbers appear first in lists
   */
  sortorder: number;

  /**
   * Number of courses directly in this category (not including subcategories)
   * Maps to: mdl_course_categories.coursecount (int 10)
   * Cached value updated by Moodle core when courses are added/removed
   */
  coursecount: number;

  /**
   * Visibility flag for category and its courses
   * Maps to: mdl_course_categories.visible (int 1)
   * 0 = hidden from students, 1 = visible
   * When hidden, all courses in category are also hidden
   */
  visible: number;

  /**
   * Previous visibility state before category was hidden
   * Maps to: mdl_course_categories.visibleold (int 1)
   * Used to restore visibility when parent category is made visible again
   */
  visibleold: number;

  /**
   * Last modification timestamp (Unix timestamp)
   * Maps to: mdl_course_categories.timemodified (int 10)
   * Updated whenever category settings change
   */
  timemodified: Timestamp;

  /**
   * Depth level in category hierarchy
   * Maps to: mdl_course_categories.depth (int 10)
   * 1 = top level, 2 = first subcategory level, etc.
   */
  depth: number;

  /**
   * Path from root to this category
   * Maps to: mdl_course_categories.path (char 255)
   * Format: "/1/5/12" where numbers are category IDs from root to current
   * Used for efficient hierarchy queries
   */
  path: string;

  /**
   * Theme override for this category
   * Maps to: mdl_course_categories.theme (char 50)
   * Empty string or null = inherit from parent/system
   * Otherwise specifies theme name to use for category pages
   */
  theme: string | null;
}

// ============================================================================
// Course Administration Data Types
// ============================================================================

/**
 * Course Admin Data Interface
 *
 * Extended course data with admin-specific fields for course management operations.
 * Extends the base Course type with additional metadata needed for administration.
 *
 * This interface includes enrollment counts, completion status, and other
 * aggregated data not included in the standard Course interface.
 *
 * @interface CourseAdminData
 * @extends Course
 */
export interface CourseAdminData extends Course {
  /**
   * Total number of active enrollments in this course
   * Calculated from mdl_user_enrolments table
   * Includes all enrollment methods (manual, self, cohort, etc.)
   * Does not include suspended enrollments
   */
  enrolmentCount: number;

  /**
   * Whether completion tracking is enabled for this course
   * Derived from Course.enablecompletion (boolean conversion)
   * true = completion tracking active, false = disabled
   */
  completionEnabled: boolean;
}

// ============================================================================
// Bulk Operation Types
// ============================================================================

/**
 * Course Bulk Action Enum
 *
 * Enumeration of bulk operations that can be performed on multiple courses simultaneously.
 * Used in admin interfaces for batch course management.
 *
 * These actions are available to users with appropriate admin capabilities
 * and operate on arrays of course IDs.
 *
 * @enum {string}
 */
export enum CourseBulkAction {
  /**
   * Permanently delete selected courses and all associated data
   * Requires: moodle/course:delete capability
   * Warning: This is irreversible and removes all course content
   */
  DELETE = 'delete',

  /**
   * Move selected courses to a different category
   * Requires: moodle/course:changecategory capability
   * Preserves all course data and enrollments
   */
  MOVE = 'move',

  /**
   * Hide selected courses from students
   * Requires: moodle/course:visibility capability
   * Sets visible=0, courses remain accessible to teachers/admins
   */
  HIDE = 'hide',

  /**
   * Make selected courses visible to students
   * Requires: moodle/course:visibility capability
   * Sets visible=1, courses appear in catalog
   */
  SHOW = 'show',

  /**
   * Create backup files for selected courses
   * Requires: moodle/backup:backupcourse capability
   * Generates .mbz backup files in moodledata
   */
  BACKUP = 'backup',

  /**
   * Restore selected courses from backup files
   * Requires: moodle/restore:restorecourse capability
   * Requires backup file selection or upload
   */
  RESTORE = 'restore',
}

// ============================================================================
// Category Management Form Types
// ============================================================================

/**
 * Category Form Data Interface
 *
 * Data structure for creating or editing course categories.
 * Includes all user-editable fields from category creation/edit forms.
 *
 * Excludes system-managed fields (id, sortorder, depth, path, coursecount)
 * which are calculated or assigned by Moodle.
 *
 * @interface CategoryFormData
 */
export interface CategoryFormData {
  /**
   * Category name (required)
   * Must be unique within parent category
   * Max length: 255 characters
   */
  name: string;

  /**
   * Custom identifier for external systems
   * Optional - can be empty string
   * Max length: 100 characters
   * Must be unique across all categories if specified
   */
  idnumber: string;

  /**
   * Category description (HTML or plain text)
   * Optional - can be empty string or null
   * Displayed on category page
   */
  description: string;

  /**
   * Description format identifier
   * 0 = Moodle auto format
   * 1 = HTML
   * 2 = Plain text
   * 4 = Markdown
   * @default 1 (HTML)
   */
  descriptionformat: number;

  /**
   * Parent category ID
   * 0 = top-level category (no parent)
   * Must be valid existing category ID
   * Cannot create circular parent-child relationships
   */
  parent: number;

  /**
   * Theme override for category
   * Empty string = inherit from parent/system
   * Must be valid installed theme name
   * Max length: 50 characters
   */
  theme: string;
}

// ============================================================================
// Filtering and Searching Types
// ============================================================================

/**
 * Category Filter Interface
 *
 * Filter parameters for querying and searching course categories.
 * Extends AdminFilterBase with category-specific filter options.
 *
 * Used by category list API endpoints to support search, hierarchy filtering,
 * visibility filtering, and sorting.
 *
 * @interface CategoryFilter
 * @extends AdminFilterBase
 */
export interface CategoryFilter extends AdminFilterBase {
  /**
   * Search query string
   * Searches across: name, idnumber, description
   * Case-insensitive partial matching
   * Inherited from AdminFilterBase
   */
  search?: string;

  /**
   * Filter by parent category ID
   * undefined = return all categories
   * 0 = return only top-level categories
   * number > 0 = return only direct children of specified parent
   */
  parent?: number;

  /**
   * Filter by visibility status
   * undefined = return all categories regardless of visibility
   * 0 = return only hidden categories
   * 1 = return only visible categories
   */
  visible?: number;

  /**
   * Field to sort results by
   * Common values: 'name', 'sortorder', 'coursecount', 'timemodified'
   * Inherited from AdminFilterBase but overridden with category-specific defaults
   */
  sortBy?: string;

  /**
   * Sort direction
   * 'asc' = ascending (A-Z, 0-9, oldest first)
   * 'desc' = descending (Z-A, 9-0, newest first)
   * Inherited from AdminFilterBase
   * @default 'asc'
   */
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Category Tree Structure Types
// ============================================================================

/**
 * Category Tree Node Interface
 *
 * Recursive tree structure for displaying category hierarchies.
 * Used in UI components that render nested category lists or trees.
 *
 * Each node contains category data and references to its children,
 * enabling efficient rendering of multi-level category structures.
 *
 * @interface CategoryTreeNode
 */
export interface CategoryTreeNode {
  /**
   * Category unique identifier
   * Maps to CourseCategory.id
   */
  id: number;

  /**
   * Category display name
   * Maps to CourseCategory.name
   */
  name: string;

  /**
   * Parent category ID
   * 0 = top-level category
   * Maps to CourseCategory.parent
   */
  parent: number;

  /**
   * Array of child category nodes
   * Empty array if category has no children
   * Recursively contains CategoryTreeNode objects
   */
  children: CategoryTreeNode[];

  /**
   * Depth level in hierarchy
   * 1 = top level, 2 = first subcategory, etc.
   * Maps to CourseCategory.depth
   */
  depth: number;

  /**
   * Number of courses directly in this category
   * Does not include courses in subcategories
   * Maps to CourseCategory.coursecount
   */
  coursecount: number;

  /**
   * Visibility status
   * 0 = hidden, 1 = visible
   * Maps to CourseCategory.visible
   */
  visible: number;
}

// ============================================================================
// Course Visibility Enum
// ============================================================================

/**
 * Course Visibility Enum
 *
 * Enumeration of course visibility states for students and general users.
 * Determines who can see and access courses in the catalog.
 *
 * Visibility is enforced by Moodle's capability system and affects course
 * display in lists, searches, and direct access attempts.
 *
 * @enum {number}
 */
export enum CourseVisibility {
  /**
   * Course is fully visible to all users with access
   * Appears in course catalogs and searches
   * Corresponds to visible=1 in database
   */
  VISIBLE = 1,

  /**
   * Course is hidden from students and guests
   * Only visible to teachers, managers, and admins
   * Does not appear in course catalogs for students
   * Corresponds to visible=0 in database
   */
  HIDDEN = 0,

  /**
   * Course is partially hidden (custom visibility state)
   * Used for courses in draft or review status
   * May be implemented through additional visibility settings
   * Value -1 represents special "hidden from students" state
   */
  HIDDEN_FROM_STUDENTS = -1,
}

// ============================================================================
// Course Sorting Types
// ============================================================================

/**
 * Course Sort Field Enum
 *
 * Enumeration of valid fields for sorting course lists in admin views.
 * Corresponds to database columns in mdl_course table.
 *
 * Used in course management interfaces to allow sorting by various criteria.
 *
 * @enum {string}
 */
export enum CourseSortField {
  /**
   * Sort by full course name (alphabetical)
   * Maps to: mdl_course.fullname
   */
  NAME = 'fullname',

  /**
   * Sort by course ID number (alphanumeric)
   * Maps to: mdl_course.idnumber
   */
  IDNUMBER = 'idnumber',

  /**
   * Sort by course creation date (chronological)
   * Maps to: mdl_course.timecreated
   */
  TIMECREATED = 'timecreated',

  /**
   * Sort by last modification date (chronological)
   * Maps to: mdl_course.timemodified
   */
  TIMEMODIFIED = 'timemodified',

  /**
   * Sort by short course name/code (alphabetical)
   * Maps to: mdl_course.shortname
   */
  SHORTNAME = 'shortname',
}

// ============================================================================
// Breadcrumb Navigation Types
// ============================================================================

/**
 * Course Category Path Type
 *
 * Type representing a breadcrumb path from root to a specific category.
 * Used for navigation UI components to display category hierarchy.
 *
 * Array of category objects showing the path from top-level to current category.
 * First element is the root (top-level), last element is the current category.
 *
 * Example:
 * ```typescript
 * const path: CourseCategoryPath = [
 *   { id: 1, name: 'Sciences' },
 *   { id: 5, name: 'Computer Science' },
 *   { id: 12, name: 'Programming' }
 * ];
 * ```
 *
 * This represents: Sciences > Computer Science > Programming
 *
 * @type CourseCategoryPath
 */
export type CourseCategoryPath = Array<{
  /**
   * Category ID for navigation
   */
  id: number;

  /**
   * Category name for display
   */
  name: string;
}>;
