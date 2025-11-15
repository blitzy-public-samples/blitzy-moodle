/**
 * Quiz API
 *
 * React Query hooks and API functions for quiz operations.
 * Integrates with quiz API endpoints that wrap existing Moodle quiz functions.
 *
 * @module features/activities/quizzes/api/quizApi
 */

import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { QUIZ_ENDPOINTS } from '@/services/api/endpoints';
import type { ApiResponse } from '@/types/api';
import type { Quiz, QuizAttempt } from '../types/quiz.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Quiz details response with attempt information
 */
export interface QuizDetailResponse {
  quiz: Quiz;
  attempts: QuizAttempt[];
  canAttempt: boolean;
  canPreview: boolean;
  attemptsUsed: number;
  attemptsRemaining: number | null;
}

/**
 * Question for quiz attempt
 */
export interface QuizQuestion {
  id: number;
  slot: number;
  type: string;
  questiontext: string;
  questiontextformat: number;
  maxmark: number;
  options: QuizQuestionOption[];
  answer?: string | string[];
  flagged?: boolean;
}

/**
 * Question option/answer choice
 */
export interface QuizQuestionOption {
  id: number;
  text: string;
  correct?: boolean;
}

/**
 * Quiz attempt start response
 */
export interface QuizAttemptStartResponse {
  attempt: QuizAttempt;
  questions: QuizQuestion[];
  timeRemaining: number;
}

/**
 * Quiz submission request
 */
export interface QuizSubmissionRequest {
  attemptId: number;
  answers: Record<number, string | string[]>; // slot -> answer(s)
  timeup?: boolean;
  finalize?: boolean; // true for final submission, false/undefined for auto-save
}

/**
 * Quiz submission response
 */
export interface QuizSubmissionResponse {
  attempt: QuizAttempt;
  grade: number;
  feedback: string;
  redirectUrl?: string;
}

/**
 * Quiz review data
 */
export interface QuizReviewData {
  attempt: QuizAttempt;
  quiz: Quiz;
  questions: QuizReviewQuestion[];
  grade: number;
  maxGrade: number;
  percentage: number;
  feedback: string;
}

/**
 * Question with review information
 */
export interface QuizReviewQuestion extends QuizQuestion {
  userAnswer?: string | string[];
  correctAnswer?: string | string[];
  feedback?: string;
  mark: number;
  maxMark: number;
  isCorrect: boolean;
}

/**
 * Quiz attempt summary
 */
export interface QuizAttemptSummary {
  attempt: QuizAttempt;
  quiz: Quiz;
  questions: QuizQuestion[];
  answeredCount: number;
  totalQuestions: number;
  timeRemaining: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch quiz details and attempt information
 *
 * Calls GET /api/v1/quizzes/{id} which wraps existing Moodle quiz_get_quiz()
 * function and retrieves user's attempt history.
 *
 * @param id - Quiz ID
 * @returns Quiz details with attempt information
 */
export async function fetchQuizDetail(id: number): Promise<QuizDetailResponse> {
  const response = await apiClient.get<ApiResponse<QuizDetailResponse>>(
    QUIZ_ENDPOINTS.DETAIL(id)
  );

  return response.data.data;
}

/**
 * Start a new quiz attempt
 *
 * Calls POST /api/v1/quizzes/{id}/attempt which wraps existing Moodle
 * quiz_create_attempt() function.
 *
 * @param quizId - Quiz ID
 * @returns New attempt with questions
 */
export async function startQuizAttempt(quizId: number): Promise<QuizAttemptStartResponse> {
  const response = await apiClient.post<ApiResponse<QuizAttemptStartResponse>>(
    QUIZ_ENDPOINTS.ATTEMPT(quizId)
  );

  return response.data.data;
}

/**
 * Submit quiz attempt for grading
 *
 * Calls POST /api/v1/quizzes/{id}/submit which wraps existing Moodle
 * quiz_process_attempt() function.
 *
 * @param quizId - Quiz ID
 * @param submission - Quiz answers and metadata
 * @returns Submission result with grade
 */
export async function submitQuizAttempt(
  quizId: number,
  submission: QuizSubmissionRequest
): Promise<QuizSubmissionResponse> {
  const response = await apiClient.post<ApiResponse<QuizSubmissionResponse>>(
    QUIZ_ENDPOINTS.SUBMIT(quizId),
    submission
  );

  return response.data.data;
}

/**
 * Fetch quiz attempt results and review
 *
 * Calls GET /api/v1/quizzes/attempts/{attemptId}/review which retrieves
 * attempt results with correct answers and feedback.
 *
 * @param attemptId - Attempt ID
 * @returns Review data with results and feedback
 */
export async function fetchQuizReview(attemptId: number): Promise<QuizReviewData> {
  const response = await apiClient.get<ApiResponse<QuizReviewData>>(
    QUIZ_ENDPOINTS.REVIEW(attemptId)
  );

  return response.data.data;
}

/**
 * Fetch quiz questions for an attempt
 *
 * Calls GET /api/v1/quizzes/{id}/questions which retrieves questions
 * for the current attempt.
 *
 * @param quizId - Quiz ID
 * @param attemptId - Attempt ID
 * @param page - Page number for pagination (default 0)
 * @returns List of quiz questions
 */
export async function fetchQuizQuestions(quizId: number, attemptId: number, page: number = 0): Promise<QuizQuestion[]> {
  const response = await apiClient.get<ApiResponse<QuizQuestion[]>>(
    QUIZ_ENDPOINTS.QUESTIONS(quizId, attemptId, page)
  );

  return response.data.data;
}

/**
 * Fetch attempt summary (for review before submission)
 *
 * Calls GET /api/v1/quizzes/attempts/{attemptId}/summary which retrieves
 * current attempt status and answer summary.
 *
 * @param attemptId - Attempt ID
 * @returns Attempt summary data
 */
export async function fetchAttemptSummary(attemptId: number): Promise<QuizAttemptSummary> {
  const response = await apiClient.get<ApiResponse<QuizAttemptSummary>>(
    QUIZ_ENDPOINTS.SUMMARY(attemptId)
  );

  return response.data.data;
}

/**
 * Fetch user's quiz attempts
 *
 * Calls GET /api/v1/quizzes/{id}/attempts which retrieves all attempts
 * for the current user.
 *
 * @param quizId - Quiz ID
 * @returns List of user's quiz attempts
 */
export async function fetchQuizAttempts(quizId: number): Promise<QuizAttempt[]> {
  const response = await apiClient.get<ApiResponse<QuizAttempt[]>>(
    QUIZ_ENDPOINTS.ATTEMPTS(quizId)
  );

  return response.data.data;
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch quiz details with React Query
 *
 * @param quizId - Quiz ID
 * @param enabled - Whether query should run automatically
 * @returns Query result with quiz details
 */
export function useQuiz(
  quizId: number,
  enabled: boolean = true
): UseQueryResult<QuizDetailResponse, Error> {
  return useQuery({
    queryKey: ['quizzes', quizId],
    queryFn: () => fetchQuizDetail(quizId),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

/**
 * Hook to fetch quiz questions with React Query
 *
 * @param quizId - Quiz ID
 * @param attemptId - Attempt ID
 * @param enabled - Whether query should run automatically
 * @param page - Page number for pagination (default 0)
 * @returns Query result with quiz questions
 */
export function useQuizQuestions(
  quizId: number,
  attemptId: number,
  enabled: boolean = true,
  page: number = 0
): UseQueryResult<QuizQuestion[], Error> {
  return useQuery({
    queryKey: ['quizzes', quizId, 'questions', attemptId, page],
    queryFn: () => fetchQuizQuestions(quizId, attemptId, page),
    enabled,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook to fetch quiz attempts with React Query
 *
 * @param quizId - Quiz ID
 * @param enabled - Whether query should run automatically
 * @returns Query result with quiz attempts
 */
export function useQuizAttempts(
  quizId: number,
  enabled: boolean = true
): UseQueryResult<QuizAttempt[], Error> {
  return useQuery({
    queryKey: ['quizzes', quizId, 'attempts'],
    queryFn: () => fetchQuizAttempts(quizId),
    enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch quiz review with React Query
 *
 * @param attemptId - Attempt ID
 * @param enabled - Whether query should run automatically
 * @returns Query result with review data
 */
export function useQuizReview(
  attemptId: number,
  enabled: boolean = true
): UseQueryResult<QuizReviewData, Error> {
  return useQuery({
    queryKey: ['quizAttempts', attemptId, 'review'],
    queryFn: () => fetchQuizReview(attemptId),
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch attempt summary with React Query
 *
 * @param attemptId - Attempt ID
 * @param enabled - Whether query should run automatically
 * @returns Query result with attempt summary
 */
export function useAttemptSummary(
  attemptId: number,
  enabled: boolean = true
): UseQueryResult<QuizAttemptSummary, Error> {
  return useQuery({
    queryKey: ['quizAttempts', attemptId, 'summary'],
    queryFn: () => fetchAttemptSummary(attemptId),
    enabled,
    staleTime: 10 * 1000, // 10 seconds
  });
}

/**
 * Hook to start quiz attempt mutation
 *
 * @returns Mutation hook for starting quiz attempt
 */
export function useStartQuizAttempt(): UseMutationResult<
  QuizAttemptStartResponse,
  Error,
  number,
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (quizId: number) => startQuizAttempt(quizId),
    onSuccess: (_data, quizId) => {
      // Invalidate quiz queries to refresh attempt list
      queryClient.invalidateQueries({ queryKey: ['quizzes', quizId] });
      queryClient.invalidateQueries({ queryKey: ['quizzes', quizId, 'attempts'] });
    },
  });
}

/**
 * Hook to submit quiz attempt mutation
 *
 * @returns Mutation hook for submitting quiz
 */
export function useSubmitQuizAttempt(): UseMutationResult<
  QuizSubmissionResponse,
  Error,
  { quizId: number; submission: QuizSubmissionRequest },
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, submission }) => submitQuizAttempt(quizId, submission),
    onSuccess: (_data, variables) => {
      // Invalidate quiz and attempt queries
      queryClient.invalidateQueries({ queryKey: ['quizzes', variables.quizId] });
      queryClient.invalidateQueries({ queryKey: ['quizzes', variables.quizId, 'attempts'] });
      queryClient.invalidateQueries({ queryKey: ['quizAttempts', variables.submission.attemptId] });
    },
  });
}
