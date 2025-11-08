/**
 * H5P Activity API Module
 *
 * Provides API functions for H5P activities including activity retrieval,
 * access information, and activity updates. All functions call the backend API
 * layer which wraps existing Moodle H5P functions.
 *
 * @package    react-frontend
 * @subpackage features/activities/h5pactivity/api
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 *
 * API Endpoints:
 * - GET    /api/v1/h5p/activity/{id}         - Get H5P activity details
 * - GET    /api/v1/h5p/activity/{id}/access  - Get access information
 * - PUT    /api/v1/h5p/activity/{id}         - Update H5P activity
 * - GET    /api/v1/h5p/activity/{id}/attempts - Get user attempts
 * - POST   /api/v1/h5p/activity/{id}/attempts - Create new attempt
 *
 * Backend References:
 * - public/mod/h5pactivity/lib.php
 * - public/mod/h5pactivity/classes/external/get_h5pactivity_access_information.php
 * - public/mod/h5pactivity/classes/local/manager.php
 */

import { apiClient, extractData } from '@/services/api/client';
import type { ApiResponse } from '@/types/api';
import type {
  H5PActivity,
  H5PAccessInfo,
  H5PActivityUpdatePayload,
  H5PAttempt,
} from '../types/h5p.types';

// ============================================================================
// API FUNCTIONS - H5P ACTIVITY OPERATIONS
// ============================================================================

/**
 * Get H5P activity details
 *
 * Retrieves comprehensive H5P activity information including configuration,
 * grading settings, display options, and tracking preferences.
 *
 * Maps to PHP endpoint: GET /api/v1/h5p/activity/{id}
 * Wraps: Moodle H5P activity retrieval from database
 *
 * @param activityId - H5P activity module ID
 * @returns Promise resolving to H5PActivity data
 * @throws Error if activity not found (404) or access denied (403)
 *
 * @example
 * ```typescript
 * try {
 *   const activity = await getH5PActivity(123);
 *   console.log(activity.name); // "Introduction to HTML5"
 * } catch (error) {
 *   if (error.response?.status === 404) {
 *     console.error('Activity not found');
 *   }
 * }
 * ```
 */
export async function getH5PActivity(activityId: number): Promise<H5PActivity> {
  const response = await apiClient.get<ApiResponse<H5PActivity>>(
    `/h5p/activity/${activityId}`
  );
  return extractData(response);
}

/**
 * Get access information for H5P activity
 *
 * Retrieves capability-based access permissions for the current user,
 * indicating what actions they can perform on this H5P activity.
 *
 * Maps to PHP endpoint: GET /api/v1/h5p/activity/{id}/access
 * Wraps: get_h5pactivity_access_information from external API
 *
 * Checks these capabilities:
 * - mod/h5pactivity:view - Can view the activity
 * - mod/h5pactivity:submit - Can submit attempts
 * - mod/h5pactivity:reviewattempts - Can review all attempts (teacher)
 * - Self review - Can review own attempts (student)
 *
 * @param activityId - H5P activity module ID
 * @returns Promise resolving to H5PAccessInfo with capability flags
 * @throws Error if activity not found or access denied
 *
 * @example
 * ```typescript
 * const access = await getAccessInformation(123);
 * if (access.cansubmit) {
 *   // Show "Start Attempt" button
 * }
 * if (access.canreviewattempts) {
 *   // Show teacher reports link
 * }
 * ```
 */
export async function getAccessInformation(
  activityId: number
): Promise<H5PAccessInfo> {
  const response = await apiClient.get<ApiResponse<H5PAccessInfo>>(
    `/h5p/activity/${activityId}/access`
  );
  return extractData(response);
}

/**
 * Update H5P activity settings
 *
 * Updates activity configuration including name, description, grading options,
 * display settings, and tracking preferences. Only provided fields are updated.
 *
 * Maps to PHP endpoint: PUT /api/v1/h5p/activity/{id}
 * Wraps: Moodle course module update functions with permission checks
 *
 * Requires: mod/h5pactivity:addinstance capability (edit permission)
 *
 * @param activityId - H5P activity module ID to update
 * @param updates - Partial activity data containing fields to update
 * @returns Promise resolving to updated H5PActivity data
 * @throws Error if activity not found, access denied, or validation fails
 *
 * @example
 * ```typescript
 * // Update activity name and enable tracking
 * const updated = await updateH5PActivity(123, {
 *   name: "Updated Activity Name",
 *   enabletracking: 1
 * });
 *
 * // Update display options (show frame and copyright)
 * const updated = await updateH5PActivity(123, {
 *   displayoptions: 0b11001 // frame | copyright | about
 * });
 *
 * // Change grading method to use highest score
 * const updated = await updateH5PActivity(123, {
 *   grademethod: H5PGradeMethod.HIGHEST
 * });
 * ```
 */
export async function updateH5PActivity(
  activityId: number,
  updates: H5PActivityUpdatePayload
): Promise<H5PActivity> {
  const response = await apiClient.put<ApiResponse<H5PActivity>>(
    `/h5p/activity/${activityId}`,
    updates
  );
  return extractData(response);
}

/**
 * Get all attempts for an H5P activity
 *
 * Retrieves attempt history for the current user or all users (if has permission).
 * Includes scores, completion status, and xAPI tracking data.
 *
 * Maps to PHP endpoint: GET /api/v1/h5p/activity/{id}/attempts
 * Wraps: H5P attempt retrieval from h5pactivity_attempts table
 *
 * @param activityId - H5P activity module ID
 * @param userId - Optional user ID (defaults to current user, requires permission for others)
 * @returns Promise resolving to array of H5PAttempt objects
 * @throws Error if activity not found or access denied
 *
 * @example
 * ```typescript
 * // Get my attempts
 * const myAttempts = await getH5PAttempts(123);
 *
 * // Get specific user's attempts (teacher only)
 * const userAttempts = await getH5PAttempts(123, 456);
 * ```
 */
export async function getH5PAttempts(
  activityId: number,
  userId?: number
): Promise<H5PAttempt[]> {
  const params = userId ? { userid: userId } : {};
  const response = await apiClient.get<ApiResponse<H5PAttempt[]>>(
    `/h5p/activity/${activityId}/attempts`,
    { params }
  );
  return extractData(response);
}

/**
 * Create a new H5P activity attempt
 *
 * Initiates a new attempt for the current user. Validates attempt rules
 * (max attempts, timing restrictions) before creating.
 *
 * Maps to PHP endpoint: POST /api/v1/h5p/activity/{id}/attempts
 * Wraps: H5P attempt creation logic with validation
 *
 * Requires: mod/h5pactivity:submit capability
 *
 * @param activityId - H5P activity module ID
 * @returns Promise resolving to newly created H5PAttempt
 * @throws Error if max attempts reached, access denied, or validation fails
 *
 * @example
 * ```typescript
 * try {
 *   const attempt = await createH5PAttempt(123);
 *   console.log(`Started attempt ${attempt.attempt}`);
 *   // Redirect to H5P player with attempt ID
 * } catch (error) {
 *   if (error.response?.status === 403) {
 *     console.error('Maximum attempts reached');
 *   }
 * }
 * ```
 */
export async function createH5PAttempt(activityId: number): Promise<H5PAttempt> {
  const response = await apiClient.post<ApiResponse<H5PAttempt>>(
    `/h5p/activity/${activityId}/attempts`
  );
  return extractData(response);
}

/**
 * Delete an H5P activity
 *
 * Permanently deletes an H5P activity and all associated data including
 * attempts, results, and uploaded content packages.
 *
 * Maps to PHP endpoint: DELETE /api/v1/h5p/activity/{id}
 * Wraps: Moodle course module deletion with H5P cleanup
 *
 * Requires: moodle/course:manageactivities capability
 *
 * @param activityId - H5P activity module ID to delete
 * @returns Promise resolving to success confirmation
 * @throws Error if activity not found or access denied
 *
 * @example
 * ```typescript
 * if (confirm('Delete this H5P activity?')) {
 *   await deleteH5PActivity(123);
 *   // Redirect to course page
 * }
 * ```
 */
export async function deleteH5PActivity(activityId: number): Promise<void> {
  await apiClient.delete(`/h5p/activity/${activityId}`);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse display options bit flags into boolean object
 *
 * Converts the displayoptions integer bitmask into a structured object
 * with boolean flags for each display option.
 *
 * Display option bit flags:
 * - Bit 0 (1): frame - Show frame around content
 * - Bit 1 (2): export - Allow content export
 * - Bit 2 (4): embed - Allow content embedding
 * - Bit 3 (8): copyright - Show copyright info
 * - Bit 4 (16): about - Show about H5P info
 *
 * @param displayoptions - Integer bitmask from database
 * @returns Object with boolean flags for each option
 *
 * @example
 * ```typescript
 * const options = parseDisplayOptions(25); // Binary: 11001
 * console.log(options);
 * // {
 * //   frame: true,     // Bit 0 is set
 * //   export: false,   // Bit 1 is not set
 * //   embed: false,    // Bit 2 is not set
 * //   copyright: true, // Bit 3 is set
 * //   about: true      // Bit 4 is set
 * // }
 * ```
 */
export function parseDisplayOptions(displayoptions: number): {
  frame: boolean;
  export: boolean;
  embed: boolean;
  copyright: boolean;
  about: boolean;
} {
  return {
    frame: (displayoptions & 1) !== 0,
    export: (displayoptions & 2) !== 0,
    embed: (displayoptions & 4) !== 0,
    copyright: (displayoptions & 8) !== 0,
    about: (displayoptions & 16) !== 0,
  };
}

/**
 * Build display options bitmask from boolean flags
 *
 * Converts a structured object with boolean flags into the integer bitmask
 * format stored in the database. Inverse operation of parseDisplayOptions.
 *
 * @param options - Object with boolean flags for each option
 * @returns Integer bitmask for database storage
 *
 * @example
 * ```typescript
 * const bitmask = buildDisplayOptions({
 *   frame: true,
 *   export: false,
 *   embed: false,
 *   copyright: true,
 *   about: true
 * });
 * console.log(bitmask); // 25 (Binary: 11001)
 * ```
 */
export function buildDisplayOptions(options: {
  frame?: boolean;
  export?: boolean;
  embed?: boolean;
  copyright?: boolean;
  about?: boolean;
}): number {
  let bitmask = 0;
  if (options.frame) {
    bitmask |= 1;
  }
  if (options.export) {
    bitmask |= 2;
  }
  if (options.embed) {
    bitmask |= 4;
  }
  if (options.copyright) {
    bitmask |= 8;
  }
  if (options.about) {
    bitmask |= 16;
  }
  return bitmask;
}

/**
 * Validate activity ID
 *
 * Checks if the provided activity ID is valid (positive integer).
 *
 * @param activityId - Activity ID to validate
 * @returns True if valid, false otherwise
 *
 * @example
 * ```typescript
 * if (!isValidActivityId(activityId)) {
 *   throw new Error('Invalid activity ID');
 * }
 * ```
 */
export function isValidActivityId(activityId: number | null | undefined): boolean {
  return typeof activityId === 'number' && activityId > 0 && Number.isInteger(activityId);
}
