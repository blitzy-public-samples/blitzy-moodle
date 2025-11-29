/**
 * H5P Activity API Module
 *
 * TypeScript API client module for H5P activity operations providing React Query-powered
 * methods to fetch H5P activities, retrieve user attempts, get attempt results, track
 * activity views, submit xAPI statements, manage H5P player interactions, and access
 * capability information with comprehensive error handling and type safety.
 *
 * All API functions wrap backend REST API endpoints at /api/v1/h5p/* that delegate
 * to existing Moodle H5P external functions without duplicating business logic.
 *
 * @package    react-frontend
 * @subpackage features/activities/h5pactivity/api
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 *
 * API Endpoints:
 * - GET    /api/v1/h5p/activities              - Get H5P activities by courses
 * - GET    /api/v1/h5p/activity/{id}           - Get single H5P activity details
 * - GET    /api/v1/h5p/activity/{id}/access    - Get access information
 * - POST   /api/v1/h5p/activity/{id}/view      - Mark activity as viewed
 * - GET    /api/v1/h5p/activity/{id}/attempts  - Get attempts for specific users
 * - GET    /api/v1/h5p/activity/{id}/user-attempts - Get paginated user attempts
 * - GET    /api/v1/h5p/activity/{id}/results   - Get detailed attempt results
 * - GET    /api/v1/h5p/attempts/{id}/results   - Get results for single attempt
 * - POST   /api/v1/h5p/activity/{id}/xapi      - Submit xAPI statement
 * - POST   /api/v1/h5p/activity/{id}/report-viewed - Log report viewed
 * - GET    /api/v1/h5p/activity/{id}/state     - Get player state
 * - POST   /api/v1/h5p/activity/{id}/state     - Save player state
 *
 * Backend References:
 * - public/mod/h5pactivity/classes/external/get_h5pactivities_by_courses.php
 * - public/mod/h5pactivity/classes/external/get_attempts.php
 * - public/mod/h5pactivity/classes/external/get_user_attempts.php
 * - public/mod/h5pactivity/classes/external/get_results.php
 * - public/mod/h5pactivity/classes/external/view_h5pactivity.php
 * - public/mod/h5pactivity/classes/external/get_h5pactivity_access_information.php
 * - public/mod/h5pactivity/classes/external/log_report_viewed.php
 */

import type { AxiosResponse } from 'axios';
import { apiClient } from '@/services/api/client';
import type { ApiResponse } from '@/types/api';
import type {
  H5PActivity,
  H5PAccessInfo,
  H5PAttempt,
  H5PResult,
  H5PStatement,
  H5PDisplayOptions,
  H5PActivityUpdatePayload,
  H5PUserAttempts,
  H5PGlobalSettings,
} from '../types/h5p.types';

// ============================================================================
// TYPE DEFINITIONS FOR API RESPONSES
// ============================================================================

/**
 * Response structure for getH5PActivities API call
 * Maps to PHP get_h5pactivities_by_courses return structure
 */
interface H5PActivitiesResponse {
  /** Array of H5P activities with full metadata */
  h5pactivities: H5PActivity[];
  /** Global H5P settings for content embedding */
  settings?: H5PGlobalSettings;
  /** Warnings from the backend operation */
  warnings?: H5PApiWarning[];
}

/**
 * Response structure for getAttempts API call
 * Maps to PHP get_attempts return structure
 */
interface H5PAttemptsResponse {
  /** Activity ID the attempts belong to */
  activityid: number;
  /** Array of user attempts data grouped by user */
  usersattempts: H5PUserAttemptsData[];
  /** Warnings from the backend operation */
  warnings?: H5PApiWarning[];
}

/**
 * User attempts data structure from get_attempts
 */
interface H5PUserAttemptsData {
  /** User ID */
  userid: number;
  /** User's scored/graded attempt (if exists) */
  scored?: H5PScoredAttempt;
  /** All attempts for this user */
  attempts: H5PAttempt[];
}

/**
 * Scored attempt information
 */
interface H5PScoredAttempt {
  /** Attempt title/description */
  title: string;
  /** Grade method used for scoring */
  grademethod: string;
  /** Attempt ID that was scored */
  attemptid: number;
}

/**
 * Response structure for getUserAttempts API call
 * Maps to PHP get_user_attempts return structure
 */
interface H5PUserAttemptsResponse {
  /** Activity ID the attempts belong to */
  activityid: number;
  /** Array of user attempts with user info */
  usersattempts: H5PUserAttempts[];
  /** Total count of attempts (for pagination) */
  totalattempts?: number;
  /** Warnings from the backend operation */
  warnings?: H5PApiWarning[];
}

/**
 * Options for getUserAttempts API call
 */
interface GetUserAttemptsOptions {
  /** Sort order for results */
  sortorder?: 'firstname' | 'lastname' | 'id' | 'attempts' | 'timecreated';
  /** Page number (0-based) */
  page?: number;
  /** Number of results per page */
  perPage?: number;
  /** Filter by first name initial */
  firstInitial?: string;
  /** Filter by last name initial */
  lastInitial?: string;
}

/**
 * Response structure for getResults API call
 * Maps to PHP get_results return structure
 */
interface H5PResultsResponse {
  /** Activity ID the results belong to */
  activityid: number;
  /** Array of attempt results with xAPI data */
  attempts: H5PAttemptResults[];
  /** Warnings from the backend operation */
  warnings?: H5PApiWarning[];
}

/**
 * Attempt with results data
 */
interface H5PAttemptResults {
  /** Attempt ID */
  id: number;
  /** H5P activity ID */
  h5pactivityid: number;
  /** User ID who made the attempt */
  userid: number;
  /** Unix timestamp when attempt was created */
  timecreated: number;
  /** Unix timestamp when attempt was last modified */
  timemodified: number;
  /** Attempt number (1st, 2nd, etc.) */
  attempt: number;
  /** Raw score achieved */
  rawscore: number;
  /** Maximum possible score */
  maxscore: number;
  /** Duration in seconds */
  duration: number;
  /** Completion status (0=incomplete, 1=complete) */
  completion: number;
  /** Success status (0=failed, 1=passed, null=no pass score) */
  success: number | null;
  /** Scaled grade (0-1) */
  scaled: number;
  /** Array of detailed result interactions */
  results?: H5PResult[];
}

/**
 * Response structure for viewH5PActivity API call
 */
interface ViewActivityResponse {
  /** Whether the view was logged successfully */
  status: boolean;
  /** Warnings from the backend operation */
  warnings?: H5PApiWarning[];
}

/**
 * Response structure for logReportViewed API call
 */
interface LogReportViewedResponse {
  /** Whether the log entry was created successfully */
  status: boolean;
  /** Warnings from the backend operation */
  warnings?: H5PApiWarning[];
}

/**
 * Response structure for submitXAPIStatement API call
 */
interface SubmitXAPIResponse {
  /** Whether the statement was processed successfully */
  success: boolean;
  /** ID of the created statement record (if any) */
  statementId?: string;
  /** Warnings from the backend operation */
  warnings?: H5PApiWarning[];
}

/**
 * Response structure for player state operations
 */
interface PlayerStateResponse {
  /** Whether the operation was successful */
  success: boolean;
  /** The player state data (for get operations) */
  state?: Record<string, unknown>;
  /** Warnings from the backend operation */
  warnings?: H5PApiWarning[];
}

/**
 * Warning structure returned by Moodle external functions
 */
interface H5PApiWarning {
  /** Warning item identifier */
  item?: string;
  /** Item ID the warning relates to */
  itemid?: number;
  /** Warning code */
  warningcode: string;
  /** Human-readable warning message */
  message: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract data from API response, handling the standard envelope
 *
 * @param response - Axios response with API envelope
 * @returns The data payload from the response
 * @throws Error if response indicates failure
 */
function extractData<T>(response: AxiosResponse<ApiResponse<T>>): T {
  const { data } = response;
  if (data && typeof data === 'object' && 'data' in data) {
    return data.data;
  }
  // Handle case where response is the data directly (no envelope)
  return data as unknown as T;
}

/**
 * Validate activity ID is a positive integer
 *
 * @param activityId - Activity ID to validate
 * @throws Error if activity ID is invalid
 */
function validateActivityId(activityId: number): void {
  if (!Number.isInteger(activityId) || activityId <= 0) {
    throw new Error(`Invalid activity ID: ${activityId}. Must be a positive integer.`);
  }
}

/**
 * Validate attempt ID is a positive integer
 *
 * @param attemptId - Attempt ID to validate
 * @throws Error if attempt ID is invalid
 */
function validateAttemptId(attemptId: number): void {
  if (!Number.isInteger(attemptId) || attemptId <= 0) {
    throw new Error(`Invalid attempt ID: ${attemptId}. Must be a positive integer.`);
  }
}

/**
 * Parse display options bit flags into boolean object
 *
 * Converts the displayoptions integer bitmask into a structured object
 * with boolean flags for each display option.
 *
 * Display option bit flags:
 * - Bit 0 (1): frame - Show frame around content
 * - Bit 1 (2): export - Allow content export (download)
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
 * // { frame: true, download: false, embed: false, copyright: true, about: true }
 * ```
 */
export function parseDisplayOptions(displayoptions: number): H5PDisplayOptions {
  return {
    frame: (displayoptions & 1) !== 0,
    download: (displayoptions & 2) !== 0,
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
 *   download: false,
 *   embed: false,
 *   copyright: true,
 *   about: true
 * });
 * // Returns: 25 (Binary: 11001)
 * ```
 */
export function buildDisplayOptions(options: Partial<H5PDisplayOptions>): number {
  let bitmask = 0;
  if (options.frame) bitmask |= 1;
  if (options.download) bitmask |= 2;
  if (options.embed) bitmask |= 4;
  if (options.copyright) bitmask |= 8;
  if (options.about) bitmask |= 16;
  return bitmask;
}

// ============================================================================
// API FUNCTIONS - H5P ACTIVITY RETRIEVAL
// ============================================================================

/**
 * Get H5P activities by courses
 *
 * Retrieves H5P activities across one or more courses with full metadata including
 * configuration, grading settings, tracking status, content hash, and file information.
 * Also returns global H5P settings (enablesavestate, savestatefreq).
 *
 * Maps to PHP: mod_h5pactivity_external::get_h5pactivities_by_courses()
 * Endpoint: GET /api/v1/h5p/activities
 *
 * @param courseIds - Optional array of course IDs to filter by. If empty, returns
 *                    activities from all courses the user is enrolled in.
 * @returns Promise resolving to object with h5pactivities array and global settings
 * @throws Error if request fails or access denied
 *
 * @example
 * ```typescript
 * // Get activities from specific courses
 * const result = await getH5PActivities([101, 102]);
 * result.h5pactivities.forEach(activity => {
 *   console.log(activity.name, activity.grade);
 * });
 *
 * // Get all activities user has access to
 * const allActivities = await getH5PActivities();
 * ```
 */
export async function getH5PActivities(
  courseIds?: number[]
): Promise<H5PActivitiesResponse> {
  const params: Record<string, unknown> = {};
  
  if (courseIds && courseIds.length > 0) {
    // Validate all course IDs
    courseIds.forEach((id, index) => {
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error(`Invalid course ID at index ${index}: ${id}`);
      }
    });
    params.courseids = courseIds;
  }

  const response = await apiClient.get<ApiResponse<H5PActivitiesResponse>>(
    '/h5p/activities',
    { params }
  );

  return extractData(response);
}

/**
 * Get single H5P activity details
 *
 * Retrieves comprehensive H5P activity information including configuration,
 * grading settings, display options, tracking preferences, and content metadata.
 *
 * Maps to PHP: Activity data from h5pactivity_summary_exporter
 * Endpoint: GET /api/v1/h5p/activity/{id}
 *
 * @param activityId - H5P activity module ID
 * @returns Promise resolving to H5PActivity data with full configuration
 * @throws Error if activity not found (404) or access denied (403)
 *
 * @example
 * ```typescript
 * const activity = await getH5PActivity(123);
 * console.log(activity.name);
 * console.log(`Grade: ${activity.grade}/${activity.maxgrade}`);
 * if (activity.enabletracking) {
 *   console.log('Tracking enabled');
 * }
 * ```
 */
export async function getH5PActivity(activityId: number): Promise<H5PActivity> {
  validateActivityId(activityId);
  
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
 * Maps to PHP: mod_h5pactivity_external::get_h5pactivity_access_information()
 * Endpoint: GET /api/v1/h5p/activity/{id}/access
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
export async function getAccessInformation(activityId: number): Promise<H5PAccessInfo> {
  validateActivityId(activityId);
  
  const response = await apiClient.get<ApiResponse<H5PAccessInfo>>(
    `/h5p/activity/${activityId}/access`
  );
  
  return extractData(response);
}

// ============================================================================
// API FUNCTIONS - ACTIVITY TRACKING
// ============================================================================

/**
 * Mark H5P activity as viewed
 *
 * Records that the current user has viewed the H5P activity, triggering
 * the course_module_viewed event and updating completion status if configured.
 *
 * Maps to PHP: mod_h5pactivity_external::view_h5pactivity()
 * Endpoint: POST /api/v1/h5p/activity/{id}/view
 *
 * This function:
 * - Validates the user can view the activity
 * - Triggers the \mod_h5pactivity\event\course_module_viewed event
 * - Updates completion state if activity has view-based completion
 *
 * @param activityId - H5P activity module ID to mark as viewed
 * @returns Promise resolving to status indicating success
 * @throws Error if activity not found or access denied
 *
 * @example
 * ```typescript
 * // Called when user navigates to H5P activity page
 * const result = await viewH5PActivity(123);
 * if (result.status) {
 *   console.log('View logged successfully');
 * }
 * ```
 */
export async function viewH5PActivity(activityId: number): Promise<ViewActivityResponse> {
  validateActivityId(activityId);
  
  const response = await apiClient.post<ApiResponse<ViewActivityResponse>>(
    `/h5p/activity/${activityId}/view`
  );
  
  return extractData(response);
}

/**
 * Log that a report was viewed
 *
 * Records when a user views attempt reports for analytics and audit purposes.
 * Can log viewing of own attempts or other users' attempts (with permission).
 *
 * Maps to PHP: mod_h5pactivity_external::log_report_viewed()
 * Endpoint: POST /api/v1/h5p/activity/{id}/report-viewed
 *
 * @param activityId - H5P activity module ID
 * @param userId - Optional user ID whose report was viewed (omit for own report)
 * @param attemptId - Optional specific attempt ID that was viewed
 * @returns Promise resolving to status indicating success
 * @throws Error if activity not found or access denied
 *
 * @example
 * ```typescript
 * // Log viewing own report
 * await logReportViewed(123);
 *
 * // Log viewing specific user's report (teacher)
 * await logReportViewed(123, 456);
 *
 * // Log viewing specific attempt report
 * await logReportViewed(123, 456, 789);
 * ```
 */
export async function logReportViewed(
  activityId: number,
  userId?: number,
  attemptId?: number
): Promise<LogReportViewedResponse> {
  validateActivityId(activityId);
  
  const payload: Record<string, number> = {};
  
  if (userId !== undefined) {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error(`Invalid user ID: ${userId}`);
    }
    payload.userid = userId;
  }
  
  if (attemptId !== undefined) {
    validateAttemptId(attemptId);
    payload.attemptid = attemptId;
  }
  
  const response = await apiClient.post<ApiResponse<LogReportViewedResponse>>(
    `/h5p/activity/${activityId}/report-viewed`,
    payload
  );
  
  return extractData(response);
}

// ============================================================================
// API FUNCTIONS - ATTEMPT MANAGEMENT
// ============================================================================

/**
 * Get attempts for specific users
 *
 * Retrieves attempts for specified user IDs in an H5P activity. Returns attempt
 * details including scores, timestamps, duration, and completion status.
 * Also includes the scored attempt information for grade calculation.
 *
 * Maps to PHP: mod_h5pactivity_external::get_attempts()
 * Endpoint: GET /api/v1/h5p/activity/{id}/attempts
 *
 * @param activityId - H5P activity module ID
 * @param userIds - Optional array of user IDs to get attempts for.
 *                  If omitted, returns current user's attempts.
 * @returns Promise resolving to attempts response with user attempts data
 * @throws Error if activity not found or access denied
 *
 * @example
 * ```typescript
 * // Get my attempts
 * const result = await getAttempts(123);
 * result.usersattempts.forEach(userData => {
 *   console.log(`User ${userData.userid} has ${userData.attempts.length} attempts`);
 * });
 *
 * // Get specific users' attempts (teacher)
 * const result = await getAttempts(123, [456, 789]);
 * ```
 */
export async function getAttempts(
  activityId: number,
  userIds?: number[]
): Promise<H5PAttemptsResponse> {
  validateActivityId(activityId);
  
  const params: Record<string, unknown> = {};
  
  if (userIds && userIds.length > 0) {
    userIds.forEach((id, index) => {
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error(`Invalid user ID at index ${index}: ${id}`);
      }
    });
    params.userids = userIds;
  }
  
  const response = await apiClient.get<ApiResponse<H5PAttemptsResponse>>(
    `/h5p/activity/${activityId}/attempts`,
    { params }
  );
  
  return extractData(response);
}

/**
 * Get paginated user attempts list
 *
 * Retrieves a paginated, sortable list of all user attempts for an H5P activity.
 * Supports filtering by name initials and various sort orders. Used primarily
 * for teacher reports showing all student attempts.
 *
 * Maps to PHP: mod_h5pactivity_external::get_user_attempts()
 * Endpoint: GET /api/v1/h5p/activity/{id}/user-attempts
 *
 * @param activityId - H5P activity module ID
 * @param options - Optional filtering and pagination parameters
 * @param options.sortorder - Sort by: 'firstname', 'lastname', 'id', 'attempts', 'timecreated'
 * @param options.page - Page number (0-based), defaults to 0
 * @param options.perPage - Results per page, defaults to 20
 * @param options.firstInitial - Filter by first name starting letter
 * @param options.lastInitial - Filter by last name starting letter
 * @returns Promise resolving to paginated user attempts with total count
 * @throws Error if activity not found or access denied
 *
 * @example
 * ```typescript
 * // Get first page of user attempts, sorted by last name
 * const result = await getUserAttempts(123, {
 *   sortorder: 'lastname',
 *   page: 0,
 *   perPage: 25
 * });
 * console.log(`Showing ${result.usersattempts.length} of ${result.totalattempts}`);
 *
 * // Filter by name initial
 * const filtered = await getUserAttempts(123, {
 *   firstInitial: 'A',
 *   lastInitial: 'S'
 * });
 * ```
 */
export async function getUserAttempts(
  activityId: number,
  options?: GetUserAttemptsOptions
): Promise<H5PUserAttemptsResponse> {
  validateActivityId(activityId);
  
  const params: Record<string, unknown> = {};
  
  if (options) {
    if (options.sortorder) {
      params.sortorder = options.sortorder;
    }
    if (options.page !== undefined) {
      if (!Number.isInteger(options.page) || options.page < 0) {
        throw new Error(`Invalid page number: ${options.page}`);
      }
      params.page = options.page;
    }
    if (options.perPage !== undefined) {
      if (!Number.isInteger(options.perPage) || options.perPage <= 0) {
        throw new Error(`Invalid perPage value: ${options.perPage}`);
      }
      params.perpage = options.perPage;
    }
    if (options.firstInitial) {
      params.firstinitial = options.firstInitial;
    }
    if (options.lastInitial) {
      params.lastinitial = options.lastInitial;
    }
  }
  
  const response = await apiClient.get<ApiResponse<H5PUserAttemptsResponse>>(
    `/h5p/activity/${activityId}/user-attempts`,
    { params }
  );
  
  return extractData(response);
}

// ============================================================================
// API FUNCTIONS - RESULTS RETRIEVAL
// ============================================================================

/**
 * Get detailed attempt results
 *
 * Retrieves detailed results for specified attempts including xAPI statement data,
 * interaction types, correct/incorrect responses, scores, and timing information.
 *
 * Maps to PHP: mod_h5pactivity_external::get_results()
 * Endpoint: GET /api/v1/h5p/activity/{id}/results
 *
 * Results include xAPI interaction data:
 * - interactiontype: Type of H5P interaction (choice, fill-in, matching, etc.)
 * - description: Question or interaction prompt
 * - correctanswer: Expected correct response(s)
 * - response: User's actual response
 * - additionals: Extra data specific to interaction type
 * - rawscore, maxscore: Points earned and maximum
 * - duration: Time spent in seconds
 * - completion, success: Status flags
 *
 * @param activityId - H5P activity module ID
 * @param attemptIds - Optional array of attempt IDs to get results for.
 *                     If omitted, returns results for all accessible attempts.
 * @returns Promise resolving to results response with xAPI interaction data
 * @throws Error if activity not found or access denied
 *
 * @example
 * ```typescript
 * // Get results for specific attempts
 * const results = await getResults(123, [456, 789]);
 * results.attempts.forEach(attempt => {
 *   console.log(`Attempt ${attempt.id}: ${attempt.rawscore}/${attempt.maxscore}`);
 *   attempt.results?.forEach(result => {
 *     console.log(`  ${result.description}: ${result.success ? '✓' : '✗'}`);
 *   });
 * });
 * ```
 */
export async function getResults(
  activityId: number,
  attemptIds?: number[]
): Promise<H5PResultsResponse> {
  validateActivityId(activityId);
  
  const params: Record<string, unknown> = {};
  
  if (attemptIds && attemptIds.length > 0) {
    attemptIds.forEach((id, index) => {
      validateAttemptId(id);
    });
    params.attemptids = attemptIds;
  }
  
  const response = await apiClient.get<ApiResponse<H5PResultsResponse>>(
    `/h5p/activity/${activityId}/results`,
    { params }
  );
  
  return extractData(response);
}

/**
 * Get results for a single attempt
 *
 * Convenience function to retrieve detailed results for a single attempt.
 * Returns the attempt with its xAPI interaction results.
 *
 * Endpoint: GET /api/v1/h5p/attempts/{id}/results
 *
 * @param attemptId - H5P attempt ID to get results for
 * @returns Promise resolving to attempt results with xAPI data
 * @throws Error if attempt not found or access denied
 *
 * @example
 * ```typescript
 * const result = await getAttemptResults(456);
 * console.log(`Score: ${result.rawscore}/${result.maxscore}`);
 * console.log(`Duration: ${result.duration} seconds`);
 * console.log(`Passed: ${result.success ? 'Yes' : 'No'}`);
 * ```
 */
export async function getAttemptResults(attemptId: number): Promise<H5PAttemptResults> {
  validateAttemptId(attemptId);
  
  const response = await apiClient.get<ApiResponse<H5PAttemptResults>>(
    `/h5p/attempts/${attemptId}/results`
  );
  
  return extractData(response);
}

// ============================================================================
// API FUNCTIONS - XAPI STATEMENT SUBMISSION
// ============================================================================

/**
 * Submit xAPI statement for H5P interaction
 *
 * Submits an xAPI statement to record user interaction with H5P content.
 * Used by the H5P player to track learning activities, quiz answers,
 * video progress, and other interaction types.
 *
 * Endpoint: POST /api/v1/h5p/activity/{id}/xapi
 *
 * The statement should follow xAPI specification with:
 * - actor: User performing the action
 * - verb: Action being performed (answered, completed, experienced, etc.)
 * - object: H5P content being interacted with
 * - result: Outcome of the interaction (score, success, completion)
 * - context: Additional context (parent activity, platform, etc.)
 *
 * @param activityId - H5P activity module ID
 * @param statementData - xAPI statement data conforming to H5PStatement interface
 * @returns Promise resolving to submission result with statement ID
 * @throws Error if activity not found, access denied, or statement invalid
 *
 * @example
 * ```typescript
 * const statement: H5PStatement = {
 *   actor: {
 *     objectType: 'Agent',
 *     account: { homePage: 'https://moodle.example.com', name: '123' }
 *   },
 *   verb: {
 *     id: 'http://adlnet.gov/expapi/verbs/answered',
 *     display: { 'en-US': 'answered' }
 *   },
 *   object: {
 *     objectType: 'Activity',
 *     id: 'https://moodle.example.com/mod/h5pactivity/view.php?id=456',
 *     definition: {
 *       type: 'http://adlnet.gov/expapi/activities/cmi.interaction',
 *       interactionType: 'choice'
 *     }
 *   },
 *   result: {
 *     score: { scaled: 1.0, raw: 10, max: 10 },
 *     success: true,
 *     completion: true
 *   }
 * };
 *
 * const result = await submitXAPIStatement(456, statement);
 * console.log('Statement ID:', result.statementId);
 * ```
 */
export async function submitXAPIStatement(
  activityId: number,
  statementData: H5PStatement
): Promise<SubmitXAPIResponse> {
  validateActivityId(activityId);
  
  if (!statementData || typeof statementData !== 'object') {
    throw new Error('Statement data is required and must be an object');
  }
  
  // Validate required xAPI statement components
  if (!statementData.actor) {
    throw new Error('xAPI statement must include an actor');
  }
  if (!statementData.verb) {
    throw new Error('xAPI statement must include a verb');
  }
  if (!statementData.object) {
    throw new Error('xAPI statement must include an object');
  }
  
  const response = await apiClient.post<ApiResponse<SubmitXAPIResponse>>(
    `/h5p/activity/${activityId}/xapi`,
    { statement: statementData }
  );
  
  return extractData(response);
}

// ============================================================================
// API FUNCTIONS - PLAYER STATE MANAGEMENT
// ============================================================================

/**
 * Save H5P player state
 *
 * Saves the current state of the H5P player for the user, enabling
 * resume capability. When the user returns to the activity, their
 * progress can be restored from this saved state.
 *
 * Endpoint: POST /api/v1/h5p/activity/{id}/state
 *
 * State is typically saved automatically by the H5P player at intervals
 * defined by $CFG->mod_h5pactivity_savestatefreq (default 60 seconds).
 *
 * @param activityId - H5P activity module ID
 * @param state - Player state object to save (JSON-serializable)
 * @returns Promise resolving to success status
 * @throws Error if activity not found, access denied, or save state disabled
 *
 * @example
 * ```typescript
 * // Called by H5P player periodically or on beforeunload
 * const state = h5pPlayer.getCurrentState();
 * await savePlayerState(123, state);
 * ```
 */
export async function savePlayerState(
  activityId: number,
  state: Record<string, unknown>
): Promise<PlayerStateResponse> {
  validateActivityId(activityId);
  
  if (!state || typeof state !== 'object') {
    throw new Error('State must be a valid object');
  }
  
  const response = await apiClient.post<ApiResponse<PlayerStateResponse>>(
    `/h5p/activity/${activityId}/state`,
    { state }
  );
  
  return extractData(response);
}

/**
 * Get H5P player state
 *
 * Retrieves the saved state of the H5P player for the current user,
 * allowing the player to resume from where they left off.
 *
 * Endpoint: GET /api/v1/h5p/activity/{id}/state
 *
 * Returns empty state if:
 * - No state has been saved
 * - Save state feature is disabled
 * - State has been cleared (e.g., after completion)
 *
 * @param activityId - H5P activity module ID
 * @returns Promise resolving to saved player state or empty object
 * @throws Error if activity not found or access denied
 *
 * @example
 * ```typescript
 * const { state } = await getPlayerState(123);
 * if (state && Object.keys(state).length > 0) {
 *   h5pPlayer.restoreState(state);
 *   console.log('Resumed from saved state');
 * } else {
 *   console.log('Starting fresh');
 * }
 * ```
 */
export async function getPlayerState(activityId: number): Promise<PlayerStateResponse> {
  validateActivityId(activityId);
  
  const response = await apiClient.get<ApiResponse<PlayerStateResponse>>(
    `/h5p/activity/${activityId}/state`
  );
  
  return extractData(response);
}

// ============================================================================
// ADDITIONAL API FUNCTIONS
// ============================================================================

/**
 * Update H5P activity settings
 *
 * Updates activity configuration including name, description, grading options,
 * display settings, and tracking preferences. Only provided fields are updated.
 *
 * Endpoint: PUT /api/v1/h5p/activity/{id}
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
 * const updated = await updateH5PActivity(123, {
 *   name: "Updated Activity Name",
 *   enabletracking: 1
 * });
 * ```
 */
export async function updateH5PActivity(
  activityId: number,
  updates: H5PActivityUpdatePayload
): Promise<H5PActivity> {
  validateActivityId(activityId);
  
  if (!updates || typeof updates !== 'object') {
    throw new Error('Updates object is required');
  }
  
  const response = await apiClient.put<ApiResponse<H5PActivity>>(
    `/h5p/activity/${activityId}`,
    updates
  );
  
  return extractData(response);
}

/**
 * Delete H5P activity
 *
 * Permanently deletes an H5P activity and all associated data including
 * attempts, results, and uploaded content packages.
 *
 * Endpoint: DELETE /api/v1/h5p/activity/{id}
 *
 * Requires: moodle/course:manageactivities capability
 *
 * @param activityId - H5P activity module ID to delete
 * @returns Promise resolving when deletion completes
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
  validateActivityId(activityId);
  
  await apiClient.delete(`/h5p/activity/${activityId}`);
}

/**
 * Create a new H5P activity attempt
 *
 * Initiates a new attempt for the current user. Validates attempt rules
 * (max attempts, timing restrictions) before creating.
 *
 * Endpoint: POST /api/v1/h5p/activity/{id}/attempts
 *
 * Requires: mod/h5pactivity:submit capability
 *
 * @param activityId - H5P activity module ID
 * @returns Promise resolving to newly created H5PAttempt
 * @throws Error if max attempts reached, access denied, or validation fails
 *
 * @example
 * ```typescript
 * const attempt = await createH5PAttempt(123);
 * console.log(`Started attempt ${attempt.attempt}`);
 * ```
 */
export async function createH5PAttempt(activityId: number): Promise<H5PAttempt> {
  validateActivityId(activityId);
  
  const response = await apiClient.post<ApiResponse<H5PAttempt>>(
    `/h5p/activity/${activityId}/attempts`
  );
  
  return extractData(response);
}

/**
 * Get H5P attempts for current user
 *
 * Convenience function to retrieve current user's attempts for an activity.
 *
 * @param activityId - H5P activity module ID
 * @param userId - Optional user ID (defaults to current user)
 * @returns Promise resolving to array of H5PAttempt objects
 * @throws Error if activity not found or access denied
 */
export async function getH5PAttempts(
  activityId: number,
  userId?: number
): Promise<H5PAttempt[]> {
  validateActivityId(activityId);
  
  const params: Record<string, number> = {};
  if (userId !== undefined) {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error(`Invalid user ID: ${userId}`);
    }
    params.userid = userId;
  }
  
  const response = await apiClient.get<ApiResponse<H5PAttempt[]>>(
    `/h5p/activity/${activityId}/attempts`,
    { params }
  );
  
  return extractData(response);
}

/**
 * Check if activity ID is valid
 *
 * Utility function to validate activity ID format.
 *
 * @param activityId - Activity ID to validate
 * @returns True if valid positive integer, false otherwise
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
