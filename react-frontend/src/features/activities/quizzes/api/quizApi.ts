/**
 * Quiz API Client Module
 *
 * Provides comprehensive quiz-related API functions for the React frontend.
 * This module integrates with the /api/v1/quizzes/* endpoints using Axios
 * and provides TypeScript-typed request/response interfaces for type-safe
 * quiz operations.
 *
 * The API functions wrap existing Moodle PHP quiz functions through the
 * API layer, ensuring all business logic remains in the PHP backend.
 *
 * @module features/activities/quizzes/api/quizApi
 * @see public/mod/quiz/view.php - Quiz details and attempts display
 * @see public/mod/quiz/startattempt.php - Attempt creation
 * @see public/mod/quiz/processattempt.php - Answer submission
 * @see public/mod/quiz/review.php - Attempt review
 * @see public/mod/quiz/summary.php - Attempt summary
 */

import type { AxiosResponse } from 'axios';
import { apiClient } from '@/services/api/client';
import { QUIZ_ENDPOINTS } from '@/services/api/endpoints';
import type { QuizAttempt } from '@/types/entities';
import type {
  AttemptSummary,
  Quiz,
  Question,
  QuestionNavigationState,
  QuizTimer,
  QuestionDisplayOptions,
} from '../types/quiz.types';

// ============================================================================
// Internal API Response Envelope Type
// ============================================================================

/**
 * Internal API response envelope for quiz endpoints
 *
 * This local interface properly types the full API response envelope including
 * both success and error cases. This allows TypeScript to understand that
 * the error property exists when success is false.
 *
 * @template T - Type of the data payload
 */
interface QuizApiResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data payload (present when success is true) */
  data: T;
  /** Error information (present when success is false) */
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  /** Response metadata */
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
    timestamp?: number;
    duration?: number;
  };
}

/**
 * Extract data from API response or throw error
 *
 * Helper function that validates the API response envelope and extracts
 * the data payload. Throws an error if the response indicates failure.
 *
 * @template T - Type of the data payload
 * @param response - Axios response containing the API envelope
 * @param defaultErrorMessage - Default error message if none provided by API
 * @returns The extracted data payload
 * @throws Error if the API response indicates failure
 */
function extractData<T>(
  response: AxiosResponse<QuizApiResponse<T>>,
  defaultErrorMessage: string
): T {
  if (!response.data.success) {
    const errorMessage = response.data.error?.message ?? defaultErrorMessage;
    const error = new Error(errorMessage);
    if (response.data.error?.code) {
      (error as Error & { code: string }).code = response.data.error.code;
    }
    throw error;
  }
  return response.data.data;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Quiz details response structure
 *
 * Response from GET /api/v1/quizzes/{id} endpoint.
 * Contains quiz settings, user's attempts, and access permissions.
 * Wraps quiz_settings::create_for_cmid() from view.php.
 */
export interface QuizDetailsResponse {
  /** The quiz entity with all settings */
  quiz: Quiz;

  /** User's previous attempts at this quiz */
  attempts: QuizAttempt[];

  /** Whether the user can start a new attempt */
  canAttempt: boolean;

  /** Whether the user can preview the quiz (for teachers) */
  canPreview: boolean;

  /** Whether the user can review their attempts */
  canReview: boolean;

  /** Number of attempts the user has made */
  attemptsUsed: number;

  /** Number of attempts remaining (null = unlimited) */
  attemptsRemaining: number | null;

  /** User's best grade on this quiz */
  bestGrade: number | null;

  /** User's overall quiz grade */
  overallGrade: number | null;

  /** ID of any unfinished attempt */
  unfinishedAttemptId: number | null;

  /** Access restriction messages */
  accessRestrictions: string[];

  /** Gradebook feedback for the user */
  gradebookFeedback: string | null;
}

/**
 * Quiz attempt creation response
 *
 * Response from POST /api/v1/quizzes/{id}/attempt endpoint.
 * Contains the newly created attempt and initial questions.
 * Wraps quiz_validate_new_attempt() from startattempt.php.
 */
export interface CreateAttemptResponse {
  /** The newly created attempt */
  attempt: QuizAttempt;

  /** Initial set of questions for the first page */
  questions: QuizQuestion[];

  /** Time remaining for the attempt in seconds (0 = no limit) */
  timeRemaining: number;

  /** Total number of pages in the quiz */
  totalPages: number;

  /** Navigation state for all questions */
  navigation: QuestionNavigationState[];

  /** Timer configuration */
  timer: QuizTimerState;
}

/**
 * Quiz question for attempt interface
 *
 * Represents a question as rendered during a quiz attempt.
 */
export interface QuizQuestion {
  /** Question attempt ID */
  id: number;

  /** Slot number in the quiz */
  slot: number;

  /** Page number this question appears on */
  page: number;

  /** Question type (multichoice, truefalse, essay, etc.) */
  type: string;

  /** Rendered question text (HTML) */
  questiontext: string;

  /** Format of the question text */
  questiontextformat: number;

  /** Maximum possible mark for this question */
  maxmark: number;

  /** Display number for the question (e.g., "1", "1.2", "A1") */
  displaynumber: string;

  /** Answer options for choice-based questions */
  options?: QuizQuestionOption[];

  /** Current answer given by the student */
  answer?: string | string[] | Record<string, string>;

  /** Whether the question is flagged by the student */
  flagged: boolean;

  /** Whether the question has been answered */
  answered: boolean;

  /** Current state of the question */
  state: string;

  /** Whether navigation is required to previous question first */
  requiresPrevious: boolean;
}

/**
 * Quiz question option interface
 *
 * Represents an answer choice for multiple choice and similar questions.
 */
export interface QuizQuestionOption {
  /** Option ID */
  id: number;

  /** Option text (may contain HTML) */
  text: string;

  /** Whether this is the correct answer (only shown in review) */
  correct?: boolean;

  /** Feedback for selecting this option (only shown in review) */
  feedback?: string;
}

/**
 * Quiz timer state interface
 *
 * Timer information for managing attempt time limits.
 */
export interface QuizTimerState {
  /** Time remaining in seconds */
  timeRemaining: number;

  /** Total time limit in seconds (0 = no limit) */
  timeLimit: number;

  /** When the attempt started (Unix timestamp) */
  startTime: number;

  /** When the attempt must end (Unix timestamp, 0 = no limit) */
  endTime: number;

  /** Whether the timer is actively counting down */
  isRunning: boolean;

  /** Whether the time has expired */
  isExpired: boolean;

  /** Whether in grace period */
  inGracePeriod: boolean;

  /** Grace period duration in seconds */
  gracePeriod: number;
}

/**
 * Submit answers request body
 *
 * Request body for POST /api/v1/quizzes/{id}/submit endpoint.
 */
export interface SubmitAnswersRequest {
  /** The attempt ID */
  attemptId: number;

  /** Answers keyed by slot number */
  answers: Record<number, string | string[] | Record<string, string>>;

  /** Whether this is the final submission */
  finishAttempt: boolean;

  /** Current page being submitted */
  currentPage?: number;

  /** Whether time has expired */
  timeUp?: boolean;

  /** Sequence checks for question validation */
  sequenceChecks?: Record<number, number>;
}

/**
 * Submit answers response
 *
 * Response from POST /api/v1/quizzes/{id}/submit endpoint.
 * Wraps process_attempt() from processattempt.php.
 */
export interface SubmitAnswersResponse {
  /** Whether the submission was successful */
  success: boolean;

  /** Updated attempt object */
  attempt: QuizAttempt;

  /** Grade received (only if finishAttempt was true) */
  grade?: number | null;

  /** Grade as percentage (only if finishAttempt was true) */
  percentage?: number | null;

  /** Overall feedback based on grade */
  feedback?: string | null;

  /** Whether the attempt can be reviewed */
  canReview: boolean;

  /** URL to redirect to after submission */
  redirectUrl?: string;

  /** Any warnings or messages */
  warnings: string[];
}

/**
 * User attempts list response
 *
 * Response from GET /api/v1/quizzes/{id}/attempts endpoint.
 * Contains all attempts for the current user on a quiz.
 */
export interface UserAttemptsResponse {
  /** List of user's attempts */
  attempts: QuizAttempt[];

  /** Total number of attempts */
  total: number;

  /** Quiz information */
  quiz: Quiz;

  /** Best grade achieved */
  bestGrade: number | null;

  /** Whether more attempts are allowed */
  canAttempt: boolean;
}

/**
 * Attempt results response
 *
 * Response from GET /api/v1/quizzes/attempts/{id} endpoint.
 * Contains the results of a completed attempt.
 */
export interface AttemptResultsResponse {
  /** The attempt with final state */
  attempt: QuizAttempt;

  /** The quiz */
  quiz: Quiz;

  /** Final grade */
  grade: number | null;

  /** Maximum possible grade */
  maxGrade: number;

  /** Grade as percentage */
  percentage: number | null;

  /** Grade as formatted string */
  gradeFormatted: string;

  /** Overall feedback based on grade */
  feedback: string | null;

  /** When the attempt was finished */
  timeFinished: number;

  /** Duration of the attempt in seconds */
  duration: number;

  /** Whether the user can review the attempt */
  canReview: boolean;

  /** When review becomes available (if restricted) */
  reviewAvailableFrom?: number;
}

/**
 * Attempt questions response
 *
 * Response from GET /api/v1/quizzes/{id}/questions endpoint.
 * Contains questions for a specific page of an attempt.
 */
export interface AttemptQuestionsResponse {
  /** The current attempt */
  attempt: QuizAttempt;

  /** Questions on the requested page */
  questions: QuizQuestion[];

  /** Current page number */
  currentPage: number;

  /** Total number of pages */
  totalPages: number;

  /** Navigation state for all questions */
  navigation: QuestionNavigationState[];

  /** Display options for questions */
  displayOptions: QuestionDisplayOptions;

  /** Timer state */
  timer: QuizTimerState;
}

/**
 * Attempt review response
 *
 * Response from GET /api/v1/quizzes/attempts/{id}/review endpoint.
 * Contains complete review data for a finished attempt.
 */
export interface AttemptReviewResponse {
  /** The attempt being reviewed */
  attempt: QuizAttempt;

  /** The quiz */
  quiz: Quiz;

  /** Questions with answers and feedback */
  questions: QuizReviewQuestion[];

  /** Final grade */
  grade: number | null;

  /** Maximum possible grade */
  maxGrade: number;

  /** Grade as percentage */
  percentage: number | null;

  /** Overall feedback */
  overallFeedback: string | null;

  /** Display options for review */
  displayOptions: QuestionDisplayOptions;

  /** Navigation state for all questions */
  navigation: QuestionNavigationState[];
}

/**
 * Quiz review question interface
 *
 * Question with review information including correct answers and feedback.
 */
export interface QuizReviewQuestion {
  /** Question attempt ID */
  id: number;

  /** Slot number */
  slot: number;

  /** Page number */
  page: number;

  /** Question type */
  type: string;

  /** Question text */
  questiontext: string;

  /** Display number */
  displaynumber: string;

  /** Maximum mark */
  maxmark: number;

  /** Mark received */
  mark: number | null;

  /** Mark as fraction of max (0-1) */
  fraction: number | null;

  /** Whether the answer was correct */
  correct: boolean | null;

  /** Student's response */
  response: string | string[] | Record<string, string>;

  /** Summary of the response */
  responseSummary: string;

  /** The correct answer (if allowed to show) */
  rightAnswer?: string;

  /** Specific feedback for the response */
  specificFeedback?: string;

  /** General feedback for the question */
  generalFeedback?: string;

  /** Whether the question was flagged */
  flagged: boolean;

  /** Question state */
  state: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch quiz details
 *
 * Retrieves comprehensive quiz information including settings, user's attempts,
 * and access permissions. This wraps the quiz_settings::create_for_cmid()
 * functionality from view.php.
 *
 * @param quizId - The quiz ID to fetch
 * @returns Promise resolving to quiz details response
 *
 * @example
 * ```typescript
 * const quizDetails = await fetchQuizDetails(123);
 * if (quizDetails.canAttempt) {
 *   // User can start a new attempt
 * }
 * ```
 */
export async function fetchQuizDetails(quizId: number): Promise<QuizDetailsResponse> {
  const response: AxiosResponse<QuizApiResponse<QuizDetailsResponse>> = await apiClient.get(
    QUIZ_ENDPOINTS.DETAIL(quizId)
  );

  return extractData(response, 'Failed to fetch quiz details');
}

/**
 * Create a new quiz attempt
 *
 * Starts a new attempt for the specified quiz. This wraps the
 * quiz_validate_new_attempt() functionality from startattempt.php.
 *
 * @param quizId - The quiz ID to attempt
 * @param options - Optional configuration for the attempt
 * @returns Promise resolving to the created attempt response
 *
 * @example
 * ```typescript
 * const attemptData = await createQuizAttempt(123);
 * // Navigate to first question
 * console.log(attemptData.questions[0]);
 * ```
 */
export async function createQuizAttempt(
  quizId: number,
  options?: {
    /** Whether this is a preview attempt */
    preview?: boolean;
    /** Force starting a new attempt even if unfinished one exists */
    forcenew?: boolean;
  }
): Promise<CreateAttemptResponse> {
  const response: AxiosResponse<QuizApiResponse<CreateAttemptResponse>> = await apiClient.post(
    QUIZ_ENDPOINTS.ATTEMPT(quizId),
    {
      preview: options?.preview ?? false,
      forcenew: options?.forcenew ?? false,
    }
  );

  return extractData(response, 'Failed to create quiz attempt');
}

/**
 * Submit quiz answers
 *
 * Submits answers for one or more questions in an attempt. Can be used for
 * auto-save (finishAttempt: false) or final submission (finishAttempt: true).
 * This wraps the process_attempt() functionality from processattempt.php.
 *
 * @param quizId - The quiz ID
 * @param request - The submission request containing answers
 * @returns Promise resolving to the submission response
 *
 * @example
 * ```typescript
 * // Auto-save current page
 * await submitQuizAnswers(123, {
 *   attemptId: 456,
 *   answers: { 1: 'A', 2: ['B', 'C'] },
 *   finishAttempt: false,
 *   currentPage: 0
 * });
 *
 * // Final submission
 * const result = await submitQuizAnswers(123, {
 *   attemptId: 456,
 *   answers: { 1: 'A', 2: ['B', 'C'] },
 *   finishAttempt: true
 * });
 * console.log(`Grade: ${result.grade}`);
 * ```
 */
export async function submitQuizAnswers(
  quizId: number,
  request: SubmitAnswersRequest
): Promise<SubmitAnswersResponse> {
  const response: AxiosResponse<QuizApiResponse<SubmitAnswersResponse>> = await apiClient.post(
    QUIZ_ENDPOINTS.SUBMIT(quizId),
    request
  );

  return extractData(response, 'Failed to submit quiz answers');
}

/**
 * Get user's quiz attempts
 *
 * Retrieves all attempts for the current user on a specific quiz.
 * This wraps the quiz_get_user_attempts() functionality from view.php.
 *
 * @param quizId - The quiz ID
 * @returns Promise resolving to the list of user attempts
 *
 * @example
 * ```typescript
 * const attemptsData = await getUserAttempts(123);
 * console.log(`Total attempts: ${attemptsData.total}`);
 * console.log(`Best grade: ${attemptsData.bestGrade}`);
 * ```
 */
export async function getUserAttempts(quizId: number): Promise<UserAttemptsResponse> {
  const response: AxiosResponse<QuizApiResponse<UserAttemptsResponse>> = await apiClient.get(
    QUIZ_ENDPOINTS.ATTEMPTS(quizId)
  );

  return extractData(response, 'Failed to fetch user attempts');
}

/**
 * Get attempt results
 *
 * Retrieves the results for a completed quiz attempt including grade
 * and feedback. This wraps functionality from review.php.
 *
 * @param attemptId - The attempt ID to fetch results for
 * @returns Promise resolving to the attempt results
 *
 * @example
 * ```typescript
 * const results = await getAttemptResults(456);
 * console.log(`Grade: ${results.grade}/${results.maxGrade}`);
 * console.log(`Percentage: ${results.percentage}%`);
 * ```
 */
export async function getAttemptResults(attemptId: number): Promise<AttemptResultsResponse> {
  const response: AxiosResponse<QuizApiResponse<AttemptResultsResponse>> = await apiClient.get(
    QUIZ_ENDPOINTS.RESULTS(attemptId)
  );

  return extractData(response, 'Failed to fetch attempt results');
}

/**
 * Get attempt questions
 *
 * Retrieves questions for a specific page of an attempt. This is used
 * during an active quiz attempt to load question content.
 *
 * @param quizId - The quiz ID
 * @param attemptId - The attempt ID
 * @param page - The page number to fetch (0-indexed)
 * @returns Promise resolving to the questions for the page
 *
 * @example
 * ```typescript
 * // Get first page of questions
 * const questionsData = await getAttemptQuestions(123, 456, 0);
 * questionsData.questions.forEach(q => {
 *   console.log(`Question ${q.slot}: ${q.questiontext}`);
 * });
 * ```
 */
export async function getAttemptQuestions(
  quizId: number,
  attemptId: number,
  page: number = 0
): Promise<AttemptQuestionsResponse> {
  const response: AxiosResponse<QuizApiResponse<AttemptQuestionsResponse>> = await apiClient.get(
    QUIZ_ENDPOINTS.QUESTIONS(quizId, attemptId, page)
  );

  return extractData(response, 'Failed to fetch attempt questions');
}

/**
 * Get attempt review
 *
 * Retrieves complete review data for a finished attempt, including
 * questions with answers, correct answers (if allowed), and feedback.
 * This wraps functionality from review.php.
 *
 * @param attemptId - The attempt ID to review
 * @returns Promise resolving to the review data
 *
 * @example
 * ```typescript
 * const review = await getAttemptReview(456);
 * review.questions.forEach(q => {
 *   console.log(`Question ${q.slot}: ${q.correct ? 'Correct' : 'Incorrect'}`);
 *   if (q.specificFeedback) {
 *     console.log(`Feedback: ${q.specificFeedback}`);
 *   }
 * });
 * ```
 */
export async function getAttemptReview(attemptId: number): Promise<AttemptReviewResponse> {
  const response: AxiosResponse<QuizApiResponse<AttemptReviewResponse>> = await apiClient.get(
    QUIZ_ENDPOINTS.REVIEW(attemptId)
  );

  return extractData(response, 'Failed to fetch attempt review');
}

/**
 * Get attempt summary
 *
 * Retrieves a summary of the attempt before final submission, including
 * answered/unanswered question counts and any warnings. This wraps
 * functionality from summary.php.
 *
 * @param attemptId - The attempt ID
 * @returns Promise resolving to the attempt summary
 *
 * @example
 * ```typescript
 * const summary = await getAttemptSummary(456);
 * console.log(`Answered: ${summary.answered}/${summary.total}`);
 * if (summary.warnings.length > 0) {
 *   console.log('Warnings:', summary.warnings);
 * }
 * ```
 */
export async function getAttemptSummary(attemptId: number): Promise<AttemptSummary> {
  const response: AxiosResponse<QuizApiResponse<AttemptSummary>> = await apiClient.get(
    QUIZ_ENDPOINTS.SUMMARY(attemptId)
  );

  return extractData(response, 'Failed to fetch attempt summary');
}

// ============================================================================
// Type Re-exports for Convenience
// ============================================================================

export type {
  QuizAttempt,
  AttemptSummary,
  Quiz,
  Question,
  QuestionNavigationState,
  QuizTimer,
  QuestionDisplayOptions,
};
