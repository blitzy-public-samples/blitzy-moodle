/**
 * Bulk Course Operations Type Definitions
 *
 * This file contains TypeScript interface definitions for bulk course operations
 * in the admin course management system. It provides type safety for mass course
 * modifications including delete, move, visibility changes, backup, and reset operations.
 *
 * @module features/admin/courses/types/bulk.types
 */

/**
 * Enum of supported bulk action types for course operations.
 * These actions can be performed on multiple courses simultaneously.
 */
export enum BulkActionType {
  /** Delete selected courses permanently */
  DELETE = 'delete',

  /** Move courses to a different category */
  MOVE_TO_CATEGORY = 'move_to_category',

  /** Change visibility status (hide/show) of courses */
  CHANGE_VISIBILITY = 'change_visibility',

  /** Create backup files for selected courses */
  BACKUP = 'backup',

  /** Reset courses to initial state (remove user data) */
  RESET = 'reset',
}

/**
 * Parameters specific to different bulk action types.
 * These optional fields are used based on the action being performed.
 */
export interface BulkActionParameters {
  /**
   * Target category ID for move operations.
   * Required when action is MOVE_TO_CATEGORY.
   */
  categoryId?: number;

  /**
   * Visibility status for change_visibility operations.
   * - true: Make courses visible
   * - false: Hide courses
   * Required when action is CHANGE_VISIBILITY.
   */
  visible?: boolean;

  /**
   * Backup configuration for backup operations.
   * Specifies what to include in the backup.
   */
  backup?: {
    /** Include user data in backup */
    includeUsers?: boolean;
    /** Include activity logs in backup */
    includeLogs?: boolean;
    /** Include user files in backup */
    includeFiles?: boolean;
    /** Include grade history in backup */
    includeGradeHistory?: boolean;
  };

  /**
   * Reset configuration for reset operations.
   * Specifies what to reset in the courses.
   */
  reset?: {
    /** Remove all user enrollments */
    removeEnrollments?: boolean;
    /** Remove all user submissions and attempts */
    removeSubmissions?: boolean;
    /** Remove all user grades */
    removeGrades?: boolean;
    /** Remove all forum posts and discussions */
    removeForumPosts?: boolean;
    /** Remove all user activity logs */
    removeLogs?: boolean;
    /** Reset course start date to today */
    resetStartDate?: boolean;
  };
}

/**
 * Error details for a single course that failed during bulk operation.
 * Used to track and report individual failures within a bulk action.
 */
export interface BulkActionError {
  /**
   * ID of the course that encountered an error.
   */
  courseId: number;

  /**
   * Name of the course for user-friendly error reporting.
   */
  courseName: string;

  /**
   * Human-readable error message describing what went wrong.
   */
  message: string;

  /**
   * Error code for programmatic error handling.
   * Common codes include:
   * - PERMISSION_DENIED: User lacks required capability
   * - COURSE_NOT_FOUND: Course ID doesn't exist
   * - VALIDATION_ERROR: Invalid parameters provided
   * - DATABASE_ERROR: Database operation failed
   * - BACKUP_FAILED: Backup creation failed
   * - CATEGORY_NOT_FOUND: Target category doesn't exist
   */
  code?: string;
}

/**
 * Result summary of a bulk course operation.
 * Tracks success/failure counts and provides detailed error information.
 */
export interface BulkActionResult {
  /**
   * Number of courses successfully processed.
   */
  successCount: number;

  /**
   * Number of courses that failed to process.
   */
  failedCount: number;

  /**
   * Total number of courses targeted by the operation.
   * Should equal successCount + failedCount.
   */
  totalCount: number;

  /**
   * Array of detailed error information for failed courses.
   * Empty array if all courses processed successfully.
   */
  errors: BulkActionError[];
}

/**
 * Main interface for bulk course action operations.
 * Combines action type, target courses, parameters, and result tracking.
 */
export interface BulkCourseAction {
  /**
   * Type of bulk action to perform on the selected courses.
   */
  action: BulkActionType;

  /**
   * Array of course IDs to be affected by the bulk action.
   * Must contain at least one course ID.
   */
  courseIds: number[];

  /**
   * Optional parameters specific to the action type.
   * Required fields depend on the action:
   * - MOVE_TO_CATEGORY: requires categoryId
   * - CHANGE_VISIBILITY: requires visible
   * - BACKUP: optional backup configuration
   * - RESET: optional reset configuration
   * - DELETE: no parameters needed
   */
  parameters?: BulkActionParameters;

  /**
   * Result of the bulk operation after execution.
   * Undefined before the operation is performed.
   * Populated after the API call completes.
   */
  result?: BulkActionResult;
}
