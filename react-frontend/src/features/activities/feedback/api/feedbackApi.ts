/**
 * Feedback Activity API Client
 *
 * Provides methods for interacting with the Moodle feedback module API endpoints.
 * Handles feedback viewing, completion, submission, analysis, and response management.
 *
 * Key features:
 * - Feedback activity retrieval and display
 * - User feedback submission and progress saving
 * - Completion status tracking
 * - Analysis and reporting for teachers
 * - Response viewing and management
 *
 * Based on Moodle feedback module (/mod/feedback/) functionality:
 * - public/mod/feedback/view.php: Feedback viewing
 * - public/mod/feedback/complete.php: Feedback completion
 * - public/mod/feedback/analysis.php: Response analysis
 * - public/mod/feedback/lib.php: Core feedback functions
 *
 * API endpoints (wrapping existing Moodle feedback functions):
 * - GET /api/v1/feedback/{id}: Get feedback details
 * - POST /api/v1/feedback/{id}/complete: Submit feedback
 * - GET /api/v1/feedback/{id}/analysis: Get response analysis
 * - GET /api/v1/feedback/{id}/status: Get completion status
 *
 * @package react-frontend
 * @subpackage features/activities/feedback
 */

import type { ApiResponse } from '@/types/api';
import { apiClient } from '@/services/api/client';
import type {
  Feedback,
  FeedbackItem,
  FeedbackCompleted,
  FeedbackAnalysis,
} from '../types/feedback.types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Result of feedback submission
 */
export interface FeedbackSubmissionResult {
  /** Submission ID */
  completedId: number;

  /** Whether submission was successful */
  success: boolean;

  /** Submission timestamp */
  timeModified: number;

  /** Success message */
  message?: string;

  /** Any warning messages */
  warnings?: string[];
}

/**
 * Result of saving in-progress feedback responses
 */
export interface SaveProgressResult {
  /** Whether save was successful */
  saved: boolean;

  /** In-progress completion ID (0 if new) */
  completedId: number;

  /** Page to resume from */
  resumePage: number;

  /** Saved values for verification */
  savedValues?: Record<number, string | number>;
}

/**
 * Feedback completion status
 */
export interface FeedbackStatus {
  /** Whether feedback has been completed by user */
  isCompleted: boolean;

  /** Number of attempts made */
  attemptCount: number;

  /** Whether multiple completions are allowed */
  allowMultiple: boolean;

  /** Whether feedback is currently open */
  isOpen: boolean;

  /** Time when feedback opens (0 if always open) */
  timeOpen: number;

  /** Time when feedback closes (0 if never closes) */
  timeClose: number;

  /** Most recent completion details (if exists) */
  lastCompleted?: FeedbackCompleted;
}

/**
 * All feedback responses
 */
export interface FeedbackResponses {
  /** Array of completed feedback submissions */
  responses: FeedbackCompleted[];

  /** Total number of responses */
  total: number;

  /** Whether there are more pages */
  hasMore: boolean;
}

/**
 * Options for retrieving feedback analysis
 */
export interface AnalysisOptions {
  /** Filter by course ID (for site-wide feedbacks) */
  courseId?: number;

  /** Filter by group ID */
  groupId?: number;

  /** Include anonymous responses */
  includeAnonymous?: boolean;
}

/**
 * Analysis data for a single question
 */
export interface QuestionAnalysis {
  /** Item ID */
  itemId: number;

  /** Question text */
  question: string;

  /** Question type */
  type: string;

  /** Number of responses */
  responseCount: number;

  /** Analysis data (structure varies by question type) */
  data: unknown;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get feedback activity details
 *
 * Retrieves comprehensive feedback activity information including configuration,
 * timing settings, anonymous mode, and completion requirements.
 *
 * Maps to PHP endpoint: GET /api/v1/feedback/{id}
 * Wraps: feedback_get_feedback() from lib.php
 *
 * @param id - Feedback module ID
 * @returns Promise resolving to API response with Feedback data
 * @throws Error if feedback not found or access denied
 */
export async function getFeedback(id: number): Promise<ApiResponse<Feedback>> {
  const response = await apiClient.get<ApiResponse<Feedback>>(`feedback/${id}`);
  return response.data;
}

/**
 * Submit feedback responses
 *
 * Submits user's responses to a feedback activity. Validates all required
 * fields and enforces time restrictions and completion limits.
 *
 * Maps to PHP endpoint: POST /api/v1/feedback/{id}/complete
 * Wraps: feedback_save_tmp_values(), feedback_save_values() from lib.php
 *
 * @param feedbackId - Feedback module ID
 * @param responses - Map of item IDs to response values
 * @returns Promise resolving to API response with submission result
 * @throws Error if validation fails or submission not allowed
 */
export async function submitFeedbackResponse(
  feedbackId: number,
  responses: Record<number, string | number>
): Promise<ApiResponse<FeedbackSubmissionResult>> {
  const response = await apiClient.post<ApiResponse<FeedbackSubmissionResult>>(
    `feedback/${feedbackId}/submit`,
    responses
  );
  return response.data;
}

/**
 * Save in-progress feedback responses
 *
 * Saves partial feedback responses for later completion. Allows users to
 * pause and resume multi-page feedback activities without submitting.
 *
 * Maps to PHP endpoint: POST /api/v1/feedback/{id}/save-progress
 * Wraps: feedback_save_tmp_values() from lib.php
 *
 * @param feedbackId - Feedback module ID
 * @param responses - Map of item IDs to response values (partial responses allowed)
 * @returns Promise resolving to API response with save result
 * @throws Error if save fails
 */
export async function saveProgress(
  feedbackId: number,
  responses: Record<number, string | number>
): Promise<ApiResponse<SaveProgressResult>> {
  const response = await apiClient.post<ApiResponse<SaveProgressResult>>(
    `feedback/${feedbackId}/save-progress`,
    { responses }
  );
  return response.data;
}

/**
 * Get feedback analysis data
 *
 * Retrieves aggregated analysis and statistics for feedback responses.
 * Only accessible to users with analysis permissions (teachers/admins).
 *
 * Maps to PHP endpoint: GET /api/v1/feedback/{id}/analysis
 * Wraps: feedback_get_analysis() functions from lib.php
 *
 * @param feedbackId - Feedback module ID
 * @param options - Optional filtering options (course, group, anonymous)
 * @returns Promise resolving to API response with analysis data
 * @throws Error if user lacks permissions or analysis unavailable
 */
export async function getFeedbackAnalysis(
  feedbackId: number,
  options?: AnalysisOptions
): Promise<ApiResponse<FeedbackAnalysis>> {
  const response = await apiClient.get<ApiResponse<FeedbackAnalysis>>(
    `feedback/${feedbackId}/analysis`,
    { params: options }
  );
  return response.data;
}

/**
 * Get feedback completion status
 *
 * Retrieves the current user's completion status for a feedback activity,
 * including whether they have completed it and if additional attempts are allowed.
 *
 * Maps to PHP endpoint: GET /api/v1/feedback/{id}/status
 * Wraps: feedback_is_already_submitted(), feedback_get_completeds() from lib.php
 *
 * @param feedbackId - Feedback module ID
 * @returns Promise resolving to API response with completion status
 */
export async function getFeedbackStatus(
  feedbackId: number
): Promise<ApiResponse<FeedbackStatus>> {
  const response = await apiClient.get<ApiResponse<FeedbackStatus>>(
    `feedback/${feedbackId}/status`
  );
  return response.data;
}

/**
 * Get feedback questions/items
 *
 * Retrieves all questions and items for a feedback activity, including
 * their configuration, dependencies, and page organization.
 *
 * Maps to PHP endpoint: GET /api/v1/feedback/{id}/questions
 * Wraps: feedback_get_items() from lib.php
 *
 * @param feedbackId - Feedback module ID
 * @returns Promise resolving to API response with array of feedback items
 */
export async function getFeedbackQuestions(
  feedbackId: number
): Promise<ApiResponse<FeedbackItem[]>> {
  const response = await apiClient.get<ApiResponse<FeedbackItem[]>>(
    `feedback/${feedbackId}/questions`
  );
  return response.data;
}

/**
 * Check if user can complete feedback
 *
 * Validates whether the current user is allowed to complete the feedback
 * based on time restrictions, completion limits, and permissions.
 *
 * Maps to PHP endpoint: GET /api/v1/feedback/{id}/can-complete
 * Wraps: feedback_can_complete() logic from lib.php
 *
 * @param feedbackId - Feedback module ID
 * @returns Promise resolving to API response with completion eligibility
 */
export async function canCompleteFeedback(
  feedbackId: number
): Promise<ApiResponse<{ canComplete: boolean; reason?: string }>> {
  const response = await apiClient.get<ApiResponse<{ canComplete: boolean; reason?: string }>>(
    `/feedback/${feedbackId}/can-complete`
  );
  return response.data;
}

/**
 * Get all feedback responses
 *
 * Retrieves all responses submitted to a feedback activity.
 * Only accessible to users with view responses permission (teachers/admins).
 *
 * Maps to PHP endpoint: GET /api/v1/feedback/{id}/responses
 * Wraps: feedback_get_completeds() from lib.php
 *
 * @param feedbackId - Feedback module ID
 * @returns Promise resolving to API response with all responses
 * @throws Error if user lacks permissions
 */
export async function getFeedbackResponses(
  feedbackId: number
): Promise<ApiResponse<FeedbackResponses>> {
  const response = await apiClient.get<ApiResponse<FeedbackResponses>>(
    `/feedback/${feedbackId}/responses`
  );
  return response.data;
}
