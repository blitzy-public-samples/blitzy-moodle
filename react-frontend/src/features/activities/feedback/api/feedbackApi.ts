/**
 * Feedback Activity API Client Module
 *
 * Provides TypeScript functions for all feedback-related operations including
 * fetching feedback details, retrieving questions/items, submitting responses,
 * getting analysis data, and checking completion status.
 *
 * This module wraps RESTful API calls to /api/v1/feedback/* endpoints using
 * axios HTTP client. All API endpoints wrap existing Moodle functions from
 * mod_feedback_completion and mod_feedback_structure classes, maintaining
 * 100% backward compatibility with existing PHP business logic.
 *
 * Key Features:
 * - Feedback activity retrieval and display
 * - User feedback submission and progress saving
 * - Completion status tracking (open, submitted, can complete)
 * - Analysis and reporting for teachers
 * - Response viewing and management
 * - Multi-page feedback support with resume capability
 *
 * API Endpoint Mappings:
 * - GET /api/v1/feedback/{id} → getFeedback() → wraps view.php
 * - GET /api/v1/feedback/{id}/questions → getFeedbackQuestions() → wraps structure.get_items()
 * - POST /api/v1/feedback/{id}/submit → submitFeedbackResponse() → wraps completion.save_response()
 * - GET /api/v1/feedback/{id}/analysis → getFeedbackAnalysis() → wraps analysis.php
 * - GET /api/v1/feedback/{id}/status → getFeedbackStatus() → wraps completion class
 * - GET /api/v1/feedback/{id}/can-complete → canCompleteFeedback() → wraps completion.can_complete()
 * - GET /api/v1/feedback/{id}/responses → getFeedbackResponses() → wraps get_finished_responses()
 * - POST /api/v1/feedback/{id}/save-progress → saveProgress() → wraps save tmp values
 *
 * @module features/activities/feedback/api/feedbackApi
 * @see public/mod/feedback/view.php - Feedback viewing logic
 * @see public/mod/feedback/complete.php - Feedback submission logic
 * @see public/mod/feedback/analysis.php - Response analysis display
 * @see public/mod/feedback/classes/completion.php - Completion class methods
 * @see public/mod/feedback/classes/structure.php - Structure class methods
 */

import type { ApiResponse } from '@/types/api';
import { apiClient } from '@/services/api/client';
import type {
  Feedback,
  FeedbackItem,
  FeedbackAnalysis,
} from '../types/feedback.types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Response data structure for individual response values.
 *
 * Represents the value(s) for a single item in the analysis,
 * with support for different response formats (text, numeric, choice).
 */
export interface ResponseData {
  /** The response value (string for text, number for numeric/choice index) */
  value: string | number;

  /** Count of responses with this value */
  count: number;

  /** Percentage of total responses (0-100) */
  percentage: number;

  /** Display label for the value (for choice questions) */
  label?: string;
}

/**
 * Analysis data for a single feedback question/item.
 *
 * Contains response distribution, statistics, and visualization data
 * for an individual question in the feedback.
 */
export interface QuestionAnalysis {
  /** Feedback item ID */
  itemId: number;

  /** Question text/name */
  question: string;

  /** Question type (multichoice, textarea, textfield, numeric, etc.) */
  type: string;

  /** Array of response data with counts and percentages */
  responses: ResponseData[];

  /** Average value (for numeric and rated questions) */
  average?: number;

  /** Mode - most frequent value (for choice questions) */
  mode?: string | number;

  /** Response distribution by value */
  distribution?: Record<string, number>;
}

/**
 * Options for filtering feedback analysis data.
 *
 * Supports filtering by course (for site-wide feedbacks) and group.
 * Maps to analysis.php filtering parameters.
 */
export interface AnalysisOptions {
  /** Course ID filter for site-wide feedbacks mapped to multiple courses */
  courseid?: number;

  /** Group ID filter for group-mode enabled feedbacks */
  groupid?: number;
}

/**
 * Result structure for feedback submission.
 *
 * Returned after successfully submitting a feedback response,
 * containing confirmation data and optional continuation info.
 */
export interface FeedbackSubmissionResult {
  /** Whether the submission was successful */
  success: boolean;

  /** Completion record ID (feedback_completed.id) */
  completedId: number;

  /** Success/confirmation message for display */
  message: string;

  /** Page to resume from if multi-page submission was interrupted */
  resumePage?: number;
}

/**
 * Comprehensive feedback status information.
 *
 * Contains all status flags and data needed to determine
 * what actions a user can take on a feedback activity.
 * Maps to mod_feedback_completion class methods.
 */
export interface FeedbackStatus {
  /**
   * Whether the feedback is currently open for submissions.
   * Based on timeopen/timeclose settings.
   * Maps to mod_feedback_completion::is_open()
   */
  isOpen: boolean;

  /**
   * Whether the current user can complete the feedback.
   * Considers permissions, availability, and completion status.
   * Maps to mod_feedback_completion::can_complete()
   */
  canComplete: boolean;

  /**
   * Whether the user can submit a new response.
   * Considers multiple_submit setting and existing submissions.
   * Maps to mod_feedback_completion::can_submit()
   */
  canSubmit: boolean;

  /**
   * Whether the user has already submitted this feedback.
   * Maps to mod_feedback_completion::is_already_submitted()
   */
  isSubmitted: boolean;

  /**
   * Whether the feedback accepts anonymous responses.
   * From feedback.anonymous setting.
   */
  isAnonymous: boolean;

  /**
   * Whether multiple submissions are allowed.
   * From feedback.multiple_submit setting.
   */
  multipleSubmit: boolean;

  /**
   * Page number to resume from for in-progress submissions.
   * Used for multi-page feedbacks with saved temporary values.
   */
  resumePage?: number;

  /**
   * ID of the user's most recent completed submission.
   * From feedback_completed.id for the current user.
   */
  completedId?: number;
}

/**
 * User's feedback response history.
 *
 * Contains data about a user's completed or in-progress
 * feedback submissions including all response values.
 */
export interface FeedbackUserResponses {
  /** Completion record ID (feedback_completed.id) */
  completedId: number;

  /** Unix timestamp when the response was last modified */
  timemodified: number;

  /** Course ID where the feedback was completed */
  courseid: number;

  /** Map of item IDs to response values */
  values: Record<number, string | number | string[]>;
}

/**
 * Response values to submit for a feedback.
 *
 * Maps item IDs to their response values, supporting
 * various value types for different question types.
 */
export interface FeedbackResponses {
  /** Map of item ID to response value(s) */
  [itemId: number]: string | number | string[];

  /** Target page for multi-page navigation (optional) */
  gopage?: number;

  /** Course ID for site-wide feedback mapping (optional) */
  courseid?: number;
}

/**
 * Result structure for saving in-progress feedback.
 *
 * Returned after saving temporary values for multi-page feedback.
 */
export interface SaveProgressResult {
  /** Whether save was successful */
  success: boolean;

  /** Temporary completion ID for resuming later */
  completedTmpId: number;

  /** Current page number in multi-page feedback */
  currentPage: number;

  /** Total number of pages */
  totalPages: number;

  /** Map of saved item IDs to values */
  savedValues?: Record<number, string | number>;
}

/**
 * Result for can-complete check.
 *
 * Contains eligibility status and reason if user cannot complete.
 */
export interface CanCompleteResult {
  /** Whether the user can complete the feedback */
  canComplete: boolean;

  /** Human-readable reason if canComplete is false */
  reason?: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get feedback activity details.
 *
 * Retrieves comprehensive feedback activity information including
 * configuration settings, timing, anonymous mode, and submission rules.
 *
 * Backend Implementation:
 * - Wraps existing Moodle feedback retrieval from public/mod/feedback/view.php
 * - Uses get_course_and_cm_from_cmid() for context
 * - Uses mod_feedback_completion class for user-specific data
 * - Validates access via require_capability('mod/feedback:view')
 *
 * @param id - Feedback module instance ID (feedback.id)
 * @returns Promise resolving to API response containing Feedback object
 * @throws ApiError on permission denied (403), not found (404), or network errors
 *
 * @example
 * ```typescript
 * const response = await getFeedback(42);
 * if (response.success) {
 *   console.log('Feedback:', response.data.name);
 *   console.log('Anonymous:', response.data.anonymous === 1);
 * }
 * ```
 */
export async function getFeedback(id: number): Promise<ApiResponse<Feedback>> {
  const response = await apiClient.get<ApiResponse<Feedback>>(`/feedback/${id}`);
  return response.data;
}

/**
 * Get all questions/items for a feedback activity.
 *
 * Retrieves the complete list of feedback items including questions,
 * labels, pagebreaks, and info items with their configuration data.
 *
 * Backend Implementation:
 * - Wraps mod_feedback_structure::get_items() from classes/structure.php (line 146)
 * - Returns items ordered by position
 * - Includes dependency information (dependitem, dependvalue)
 * - Supports all item types: multichoice, textarea, textfield, numeric, label, info, pagebreak, captcha
 *
 * @param id - Feedback module instance ID
 * @returns Promise resolving to API response with array of FeedbackItem objects
 * @throws ApiError on permission denied or feedback not found
 *
 * @example
 * ```typescript
 * const response = await getFeedbackQuestions(42);
 * response.data.forEach(item => {
 *   if (item.typ !== 'pagebreak' && item.typ !== 'label') {
 *     console.log(`Q${item.position}: ${item.name} (${item.typ})`);
 *   }
 * });
 * ```
 */
export async function getFeedbackQuestions(id: number): Promise<ApiResponse<FeedbackItem[]>> {
  const response = await apiClient.get<ApiResponse<FeedbackItem[]>>(`/feedback/${id}/questions`);
  return response.data;
}

/**
 * Submit feedback responses.
 *
 * Submits the user's responses to complete a feedback activity.
 * Validates all required fields, enforces time restrictions,
 * and respects multiple submission settings.
 *
 * Backend Implementation:
 * - Wraps mod_feedback_completion::save_response() from classes/completion.php (line 547)
 * - Validates submission via is_open() and can_submit() checks
 * - Handles both anonymous and identified submissions based on feedback settings
 * - Creates feedback_completed and feedback_value records
 * - Triggers completion events for activity completion tracking
 *
 * @param feedbackId - Feedback module instance ID
 * @param responses - Object mapping item IDs to response values
 * @returns Promise resolving to API response with FeedbackSubmissionResult
 * @throws ApiError on validation failure, permission denied, or feedback closed
 *
 * @example
 * ```typescript
 * const responses: FeedbackResponses = {
 *   101: 'Very satisfied',  // Choice item
 *   102: 4,                 // Numeric item
 *   103: 'Great course!'    // Textarea item
 * };
 * const result = await submitFeedbackResponse(42, responses);
 * if (result.data.success) {
 *   console.log('Submitted! ID:', result.data.completedId);
 * }
 * ```
 */
export async function submitFeedbackResponse(
  feedbackId: number,
  responses: FeedbackResponses
): Promise<ApiResponse<FeedbackSubmissionResult>> {
  const response = await apiClient.post<ApiResponse<FeedbackSubmissionResult>>(
    `/feedback/${feedbackId}/submit`,
    { responses }
  );
  return response.data;
}

/**
 * Get feedback analysis data.
 *
 * Retrieves aggregated analysis and statistics for all feedback responses.
 * Only accessible to users with mod/feedback:viewanalysepage capability.
 *
 * Backend Implementation:
 * - Wraps logic from public/mod/feedback/analysis.php
 * - Uses mod_feedback_structure::can_view_analysis() for permission check (line 214)
 * - Aggregates data from feedback_value table
 * - Calculates statistics per item (counts, averages, distributions)
 * - Supports filtering by course and group for mapped feedbacks
 *
 * @param id - Feedback module instance ID
 * @param options - Optional filtering options for course and group
 * @returns Promise resolving to API response with FeedbackAnalysis object
 * @throws ApiError on permission denied (requires viewanalysepage capability)
 *
 * @example
 * ```typescript
 * // Get analysis for all responses
 * const analysis = await getFeedbackAnalysis(42);
 * console.log('Total responses:', analysis.data.totalResponses);
 *
 * // Get analysis filtered by group
 * const groupAnalysis = await getFeedbackAnalysis(42, { groupid: 5 });
 * ```
 */
export async function getFeedbackAnalysis(
  id: number,
  options?: AnalysisOptions
): Promise<ApiResponse<FeedbackAnalysis>> {
  const params: Record<string, unknown> = {};
  if (options?.courseid !== undefined) {
    params.courseid = options.courseid;
  }
  if (options?.groupid !== undefined) {
    params.groupid = options.groupid;
  }

  const response = await apiClient.get<ApiResponse<FeedbackAnalysis>>(
    `/feedback/${id}/analysis`,
    { params }
  );
  return response.data;
}

/**
 * Get feedback completion status for the current user.
 *
 * Retrieves comprehensive status information about the user's
 * relationship with the feedback activity, including availability,
 * permissions, and submission history.
 *
 * Backend Implementation:
 * - Wraps mod_feedback_completion class methods:
 *   - is_open() - checks timeopen/timeclose availability
 *   - can_complete() - checks capability and eligibility
 *   - can_submit() - checks if new submission allowed
 *   - is_already_submitted() - checks for existing completion
 * - From public/mod/feedback/classes/completion.php
 *
 * @param id - Feedback module instance ID
 * @returns Promise resolving to API response with FeedbackStatus object
 * @throws ApiError on feedback not found or access denied
 *
 * @example
 * ```typescript
 * const status = await getFeedbackStatus(42);
 * if (status.data.isOpen && status.data.canSubmit) {
 *   // Show feedback form
 * } else if (status.data.isSubmitted && !status.data.multipleSubmit) {
 *   // Show "already completed" message
 * }
 * ```
 */
export async function getFeedbackStatus(id: number): Promise<ApiResponse<FeedbackStatus>> {
  const response = await apiClient.get<ApiResponse<FeedbackStatus>>(`/feedback/${id}/status`);
  return response.data;
}

/**
 * Check if the current user can complete the feedback.
 *
 * Performs comprehensive eligibility check including permissions,
 * time availability, and prior completion status.
 *
 * Backend Implementation:
 * - Wraps mod_feedback_completion::can_complete() from classes/completion.php (line 612)
 * - Checks capability (mod/feedback:complete)
 * - Checks feedback is available (is_open())
 * - Checks not already submitted (unless multiple_submit enabled)
 * - Returns reason string if user cannot complete
 *
 * @param id - Feedback module instance ID
 * @returns Promise resolving to API response with canComplete flag and optional reason
 * @throws ApiError on feedback not found
 *
 * @example
 * ```typescript
 * const check = await canCompleteFeedback(42);
 * if (check.data.canComplete) {
 *   // Allow user to proceed to feedback form
 * } else {
 *   alert(check.data.reason || 'You cannot complete this feedback');
 * }
 * ```
 */
export async function canCompleteFeedback(
  id: number
): Promise<ApiResponse<CanCompleteResult>> {
  const response = await apiClient.get<ApiResponse<CanCompleteResult>>(
    `/feedback/${id}/can-complete`
  );
  return response.data;
}

/**
 * Get the user's feedback responses.
 *
 * Retrieves the current user's previous responses including both
 * completed submissions and in-progress (temporary) entries.
 * Only returns responses for the current user unless they have
 * mod/feedback:viewreports capability.
 *
 * Backend Implementation:
 * - Wraps mod_feedback_completion::get_finished_responses() (line 270)
 * - Wraps mod_feedback_completion::get_unfinished_responses() (line 233)
 * - Combines feedback_completed and feedback_completedtmp data
 * - Includes all feedback_value entries for each completion
 *
 * @param id - Feedback module instance ID
 * @returns Promise resolving to API response with array of FeedbackUserResponses
 * @throws ApiError on feedback not found or access denied
 *
 * @example
 * ```typescript
 * const myResponses = await getFeedbackResponses(42);
 * myResponses.data.forEach(response => {
 *   console.log('Response from:', new Date(response.timemodified * 1000));
 *   Object.entries(response.values).forEach(([itemId, value]) => {
 *     console.log(`  Item ${itemId}: ${value}`);
 *   });
 * });
 * ```
 */
export async function getFeedbackResponses(
  id: number
): Promise<ApiResponse<FeedbackUserResponses[]>> {
  const response = await apiClient.get<ApiResponse<FeedbackUserResponses[]>>(
    `/feedback/${id}/responses`
  );
  return response.data;
}

/**
 * Save in-progress feedback responses.
 *
 * Saves partial feedback responses for later completion, allowing
 * users to pause and resume multi-page feedback activities.
 * Creates or updates temporary completion records.
 *
 * Backend Implementation:
 * - Wraps feedback temporary value saving
 * - Creates/updates feedback_completedtmp record
 * - Creates/updates feedback_valuetmp records
 * - Tracks current page position for resume
 *
 * @param feedbackId - Feedback module instance ID
 * @param responses - Object mapping item IDs to response values (partial allowed)
 * @returns Promise resolving to API response with SaveProgressResult
 * @throws ApiError on save failure or permission denied
 *
 * @example
 * ```typescript
 * // Save responses from page 1 of a multi-page feedback
 * const partialResponses: FeedbackResponses = {
 *   101: 'Answer 1',
 *   102: 3,
 *   gopage: 2  // Next page to show
 * };
 * const result = await saveProgress(42, partialResponses);
 * if (result.data.success) {
 *   console.log('Progress saved, on page:', result.data.currentPage);
 * }
 * ```
 */
export async function saveProgress(
  feedbackId: number,
  responses: FeedbackResponses
): Promise<ApiResponse<SaveProgressResult>> {
  const response = await apiClient.post<ApiResponse<SaveProgressResult>>(
    `/feedback/${feedbackId}/save-progress`,
    { responses }
  );
  return response.data;
}
