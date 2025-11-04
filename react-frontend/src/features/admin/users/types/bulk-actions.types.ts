/**
 * Type definitions for bulk user actions in admin user management
 *
 * This file defines the TypeScript types for bulk operations on multiple users,
 * including action identifiers, request/response structures, and confirmation dialogs.
 *
 * Based on Moodle's bulk user action system from:
 * - public/admin/user/user_bulk.php
 * - public/admin/user/user_bulk_forms.php
 * - public/admin/user/user_bulk_confirm.php
 * - public/admin/user/user_bulk_delete.php
 *
 * @module features/admin/users/types/bulk-actions
 */

/**
 * Enumeration of all available bulk user actions
 *
 * These actions correspond to the bulk operations available in Moodle's
 * admin user management interface. Each action requires specific capabilities.
 *
 * @enum {string}
 */
export enum BulkActionType {
  /**
   * Confirm unconfirmed user accounts
   * Requires: moodle/user:update capability
   */
  CONFIRM = 'confirm',

  /**
   * Send message to selected users
   * Requires: moodle/user:update and moodle/site:readallmessages capabilities
   */
  MESSAGE = 'message',

  /**
   * Delete selected user accounts
   * Requires: moodle/user:delete capability
   */
  DELETE = 'delete',

  /**
   * Display selected users on page
   * Requires: moodle/user:update or moodle/user:delete capability
   */
  DISPLAY = 'displayonpage',

  /**
   * Download user data in various formats
   * Requires: moodle/user:update capability
   */
  DOWNLOAD = 'download',

  /**
   * Force password change for selected users
   * Requires: moodle/user:update capability
   */
  FORCE_PASSWORD_CHANGE = 'forcepasswordchange',

  /**
   * Add selected users to a cohort
   * Requires: moodle/user:update and moodle/cohort:assign capabilities
   */
  ADD_TO_COHORT = 'addtocohort',

  /**
   * Suspend selected user accounts
   * Requires: moodle/user:update capability
   */
  SUSPEND = 'suspend',

  /**
   * Unsuspend (reactivate) selected user accounts
   * Requires: moodle/user:update capability
   */
  UNSUSPEND = 'unsuspend',
}

/**
 * Confirmation data for bulk actions that require user confirmation
 *
 * This interface represents the data needed to display a confirmation dialog
 * before executing a bulk action on multiple users.
 *
 * @interface BulkActionConfirmation
 */
export interface BulkActionConfirmation {
  /**
   * The bulk action to be performed
   */
  action: BulkActionType;

  /**
   * Array of user IDs to be affected by the bulk action
   */
  userIds: number[];

  /**
   * Array of full names or usernames of affected users (for display)
   */
  usernames: string[];

  /**
   * Optional message or description for the action
   */
  message?: string;

  /**
   * Whether this action requires explicit user confirmation
   * Actions like DELETE and SUSPEND typically require confirmation
   */
  requiresConfirmation: boolean;
}

/**
 * Result of a bulk action operation on a single user
 *
 * This interface represents the outcome of applying a bulk action to one user.
 * Used to provide detailed feedback when operations succeed or fail for individual users.
 *
 * @interface BulkUserActionResult
 */
export interface BulkUserActionResult {
  /**
   * ID of the user this result applies to
   */
  userId: number;

  /**
   * Whether the operation succeeded for this user
   */
  success: boolean;

  /**
   * Success or informational message
   */
  message?: string;

  /**
   * Error message if the operation failed
   */
  error?: string;
}

/**
 * Data required for sending bulk messages to users
 *
 * This interface defines the structure for the MESSAGE bulk action,
 * allowing administrators to send messages to multiple users simultaneously.
 *
 * @interface MessageBulkActionData
 */
export interface MessageBulkActionData {
  /**
   * Subject line of the message
   */
  subject: string;

  /**
   * Content of the message to be sent
   */
  message: string;

  /**
   * Format of the message content
   * 0 = Moodle auto format
   * 1 = HTML format
   * 2 = Plain text format
   * 4 = Markdown format
   */
  messageformat: number;
}

/**
 * Data required for adding users to a cohort
 *
 * This interface defines the structure for the ADD_TO_COHORT bulk action,
 * allowing administrators to add multiple users to a cohort at once.
 *
 * @interface CohortBulkActionData
 */
export interface CohortBulkActionData {
  /**
   * ID of the cohort to add users to
   */
  cohortId: number;

  /**
   * Name of the cohort (for display and confirmation)
   */
  cohortName: string;
}

/**
 * Enumeration of available download formats for user data export
 *
 * These formats are supported by Moodle's bulk user download functionality.
 *
 * @enum {string}
 */
export enum DownloadFormat {
  /**
   * Comma-Separated Values format
   */
  CSV = 'csv',

  /**
   * Microsoft Excel format (.xlsx)
   */
  EXCEL = 'excel',

  /**
   * OpenDocument Spreadsheet format (.ods)
   */
  ODS = 'ods',

  /**
   * JavaScript Object Notation format
   */
  JSON = 'json',
}

/**
 * Data required for downloading user data
 *
 * This interface defines the structure for the DOWNLOAD bulk action,
 * specifying the format and fields to include in the exported data.
 *
 * @interface DownloadBulkActionData
 */
export interface DownloadBulkActionData {
  /**
   * Format for the downloaded data
   */
  format: DownloadFormat;

  /**
   * Array of user field names to include in the download
   * Common fields: id, username, firstname, lastname, email, city, country,
   * institution, department, lastaccess, auth, confirmed, suspended
   */
  fields: string[];
}

/**
 * Union type for bulk action-specific data
 *
 * This type represents the additional data required for different bulk actions.
 * The specific interface depends on the BulkActionType being performed.
 *
 * @type BulkActionData
 */
export type BulkActionData =
  | MessageBulkActionData
  | CohortBulkActionData
  | DownloadBulkActionData
  | null
  | undefined;

/**
 * Request structure for bulk user action API calls
 *
 * This interface defines the complete request structure sent to the backend
 * when performing a bulk action on multiple users.
 *
 * @interface BulkActionRequest
 */
export interface BulkActionRequest {
  /**
   * Type of bulk action to perform
   */
  action: BulkActionType;

  /**
   * Array of user IDs to apply the action to
   */
  userIds: number[];

  /**
   * Action-specific data (depends on the action type)
   */
  data?: BulkActionData;

  /**
   * URL to redirect to after the action completes (optional)
   */
  returnUrl?: string;

  /**
   * Whether the action has been confirmed by the user
   * Required for actions that need confirmation (DELETE, SUSPEND)
   */
  confirmed?: boolean;
}

/**
 * Response structure for bulk user action API calls
 *
 * This interface defines the response structure returned from the backend
 * after executing a bulk action on multiple users.
 *
 * @interface BulkActionResponse
 */
export interface BulkActionResponse {
  /**
   * Whether the overall bulk operation was successful
   */
  success: boolean;

  /**
   * General message about the operation
   */
  message?: string;

  /**
   * Detailed results for each user
   * Present when operations have mixed success/failure results
   */
  results?: BulkUserActionResult[];

  /**
   * Count of users successfully processed
   */
  successCount: number;

  /**
   * Count of users that failed processing
   */
  failureCount: number;

  /**
   * Total number of users in the bulk operation
   */
  totalCount: number;

  /**
   * Errors that prevented the entire operation from completing
   */
  errors?: string[];

  /**
   * For download actions, the URL or path to the generated file
   */
  downloadUrl?: string;
}

/**
 * Options for configuring bulk action behavior
 *
 * This interface defines optional configuration for bulk action execution,
 * such as notification preferences and validation settings.
 *
 * @interface BulkActionOptions
 */
export interface BulkActionOptions {
  /**
   * Whether to send email notifications to affected users
   */
  sendNotifications?: boolean;

  /**
   * Whether to skip validation checks (use with caution)
   */
  skipValidation?: boolean;

  /**
   * Whether to continue processing if some users fail
   * If false, stops at first error
   */
  continueOnError?: boolean;

  /**
   * Maximum number of users to process in a single batch
   */
  batchSize?: number;

  /**
   * Whether to perform the operation in a background task
   * Recommended for large numbers of users
   */
  async?: boolean;
}

/**
 * Progress information for async bulk operations
 *
 * This interface tracks the progress of asynchronous bulk operations,
 * useful for displaying progress bars and status updates.
 *
 * @interface BulkActionProgress
 */
export interface BulkActionProgress {
  /**
   * Unique identifier for this bulk operation task
   */
  taskId: string;

  /**
   * Current status of the operation
   */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

  /**
   * Number of users processed so far
   */
  processedCount: number;

  /**
   * Total number of users to process
   */
  totalCount: number;

  /**
   * Percentage complete (0-100)
   */
  percentComplete: number;

  /**
   * Start time of the operation
   */
  startedAt?: Date;

  /**
   * Completion time of the operation
   */
  completedAt?: Date;

  /**
   * Current status message
   */
  statusMessage?: string;

  /**
   * Partial results available so far
   */
  partialResults?: BulkUserActionResult[];
}
