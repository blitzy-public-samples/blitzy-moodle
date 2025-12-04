/**
 * useQuizAttempt - Custom React Query Hook for Managing Quiz Attempts
 *
 * This hook provides comprehensive quiz attempt management functionality including:
 * - Creating new quiz attempts
 * - Submitting answers (single or batch)
 * - Finishing attempts and retrieving results
 * - Loading existing attempts for resume functionality
 * - Fetching attempt history and questions
 *
 * All operations delegate to the backend PHP layer which wraps existing Moodle
 * quiz functions. No grade calculation or business logic is performed client-side.
 *
 * Backend API endpoints wrap:
 * - quiz_create_attempt_handling_errors() from attempt.php
 * - quiz_process_attempt() from processattempt.php
 * - quiz_get_user_attempts() from view.php
 *
 * @module features/activities/quizzes/hooks/useQuizAttempt
 * @see public/mod/quiz/attempt.php - Attempt display page
 * @see public/mod/quiz/startattempt.php - Attempt creation
 * @see public/mod/quiz/processattempt.php - Answer processing
 * @see public/mod/quiz/summary.php - Attempt summary
 */

import { useState, useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import {
  createQuizAttempt,
  submitQuizAnswers,
  getUserAttempts,
  getAttemptResults,
  getAttemptQuestions,
  getAttemptSummary,
  quizQueryKeys,
  type CreateAttemptResponse,
  type SubmitAnswersRequest,
  type SubmitAnswersResponse,
  type UserAttemptsResponse,
  type AttemptResultsResponse,
  type AttemptQuestionsResponse,
  type QuizQuestion,
} from '../api/quizApi';

import type {
  QuizAttempt,
  Question,
  QuizAttemptState,
  AttemptResponse,
  AttemptSummary,
} from '../types/quiz.types';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration options for the useQuizAttempt hook
 *
 * @interface UseQuizAttemptOptions
 */
export interface UseQuizAttemptOptions {
  /**
   * The quiz ID to manage attempts for
   * Required - the hook will not fetch data without a valid quiz ID
   */
  quizId: number;

  /**
   * Optional existing attempt ID for resuming an in-progress attempt
   * When provided, the hook will load this attempt's data on initialization
   */
  attemptId?: number;

  /**
   * Callback invoked when a new attempt is successfully created
   * Receives the newly created attempt object
   * @param attempt - The created QuizAttempt object
   */
  onAttemptCreated?: (attempt: QuizAttempt) => void;

  /**
   * Callback invoked when answers are successfully submitted (but not finished)
   * Useful for showing auto-save confirmation or updating UI state
   */
  onAnswerSubmitted?: () => void;

  /**
   * Callback invoked when an attempt is finished and graded
   * Receives the final attempt response with grade and feedback
   * @param results - The AttemptResponse containing final grade and state
   */
  onAttemptFinished?: (results: AttemptResponse) => void;

  /**
   * Callback invoked when any operation encounters an error
   * Allows parent components to handle errors (show toasts, log, etc.)
   * @param error - The error that occurred
   */
  onError?: (error: Error) => void;
}

/**
 * Return type for the useQuizAttempt hook
 *
 * Provides all state, data, and mutation functions needed for
 * complete quiz attempt lifecycle management.
 *
 * @interface UseQuizAttemptResult
 */
export interface UseQuizAttemptResult {
  /**
   * The currently active attempt, or null if none
   * Updated when starting new attempt or loading existing one
   */
  currentAttempt: QuizAttempt | null;

  /**
   * Array of all user attempts for this quiz
   * Includes both completed and in-progress attempts
   */
  attempts: QuizAttempt[];

  /**
   * Questions for the current attempt
   * Loaded when an attempt is active
   */
  questions: Question[];

  /**
   * Combined loading state for initial data fetching
   * True while attempts list or questions are being loaded
   */
  isLoading: boolean;

  /**
   * True while any mutation is in progress
   * (creating attempt, submitting answers, finishing)
   */
  isSubmitting: boolean;

  /**
   * Error object if any operation has failed
   * Null when no error has occurred
   */
  error: Error | null;

  /**
   * Creates a new quiz attempt
   * Calls backend which wraps quiz_create_attempt_handling_errors()
   * @returns Promise resolving to the created QuizAttempt
   */
  startAttempt: () => Promise<QuizAttempt>;

  /**
   * Submits a single answer without finishing the attempt
   * Used for auto-save functionality
   * @param questionId - The question slot number
   * @param answer - The answer value (type depends on question type)
   * @returns Promise that resolves when submission is complete
   */
  submitAnswer: (questionId: number, answer: string | string[] | Record<string, string>) => Promise<void>;

  /**
   * Submits all answers without finishing the attempt
   * Used for batch auto-save when navigating pages
   * @param answers - Record mapping slot numbers to answer values
   * @returns Promise that resolves when submission is complete
   */
  submitAllAnswers: (answers: Record<number, string | string[] | Record<string, string>>) => Promise<void>;

  /**
   * Finishes the attempt and submits for grading
   * Calls backend which wraps quiz_process_attempt()
   * @returns Promise resolving to AttemptResponse with grade
   */
  finishAttempt: () => Promise<AttemptResponse>;

  /**
   * Loads an existing attempt (for resume functionality)
   * Fetches attempt data and questions
   * @param attemptId - The attempt ID to load
   * @returns Promise that resolves when loading is complete
   */
  loadAttempt: (attemptId: number) => Promise<void>;

  /**
   * Manually refetch the attempts list
   * Useful after external changes or to ensure fresh data
   * @returns Promise that resolves when refetch is complete
   */
  refetchAttempts: () => Promise<void>;

  /**
   * Get the attempt summary before final submission
   * Returns overview of answered questions and warnings
   * @returns Promise resolving to AttemptSummary
   */
  getAttemptSummaryData: () => Promise<AttemptSummary | null>;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Answer value type union for flexibility in answer formats
 * Different question types may have different answer formats
 */
type AnswerValue = string | string[] | Record<string, string>;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useQuizAttempt - Comprehensive quiz attempt management hook
 *
 * This hook encapsulates all quiz attempt operations using React Query for
 * efficient server state management. It provides:
 *
 * - Automatic caching of attempt data
 * - Optimistic updates for better UX
 * - Error handling with rollback capabilities
 * - Loading state management
 * - Cache invalidation on mutations
 *
 * Quiz Attempt Lifecycle:
 * 1. User views quiz → hook fetches existing attempts
 * 2. User starts attempt → startAttempt() creates new attempt
 * 3. User answers questions → submitAnswer() auto-saves answers
 * 4. User navigates pages → submitAllAnswers() batch saves
 * 5. User submits → finishAttempt() grades and closes attempt
 * 6. User resumes → loadAttempt() loads in-progress attempt
 *
 * @param options - Configuration options for the hook
 * @returns UseQuizAttemptResult with state and mutation functions
 *
 * @example
 * ```typescript
 * function QuizAttemptPage({ quizId }: { quizId: number }) {
 *   const {
 *     currentAttempt,
 *     questions,
 *     isLoading,
 *     startAttempt,
 *     submitAnswer,
 *     finishAttempt,
 *   } = useQuizAttempt({
 *     quizId,
 *     onAttemptCreated: (attempt) => {
 *       console.log('Started attempt:', attempt.id);
 *     },
 *     onAttemptFinished: (results) => {
 *       console.log('Final grade:', results.grade);
 *     },
 *     onError: (error) => {
 *       toast.error(error.message);
 *     },
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       {!currentAttempt ? (
 *         <Button onClick={startAttempt}>Start Quiz</Button>
 *       ) : (
 *         <QuestionRenderer
 *           questions={questions}
 *           onAnswer={(qid, ans) => submitAnswer(qid, ans)}
 *           onFinish={finishAttempt}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
function useQuizAttempt(options: UseQuizAttemptOptions): UseQuizAttemptResult {
  const {
    quizId,
    attemptId: initialAttemptId,
    onAttemptCreated,
    onAnswerSubmitted,
    onAttemptFinished,
    onError,
  } = options;

  // ============================================================================
  // Query Client and Local State
  // ============================================================================

  const queryClient: QueryClient = useQueryClient();

  /**
   * Local state for the currently active attempt
   * This is updated when starting a new attempt or loading an existing one
   */
  const [currentAttempt, setCurrentAttempt] = useState<QuizAttempt | null>(null);

  /**
   * Local state for the current attempt ID
   * Used for loading questions
   */
  const [activeAttemptId, setActiveAttemptId] = useState<number | undefined>(initialAttemptId);

  /**
   * Local state for tracking submission progress across mutations
   */
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  /**
   * Local state for error tracking
   */
  const [error, setError] = useState<Error | null>(null);

  // ============================================================================
  // Query: Fetch User Attempts
  // ============================================================================

  /**
   * Query to fetch all user attempts for this quiz
   * Caches for 5 minutes to reduce API calls
   * Automatically enabled when quizId is valid
   */
  const attemptsQuery = useQuery<UserAttemptsResponse, Error>({
    queryKey: quizQueryKeys.attempts(quizId),
    queryFn: () => getUserAttempts(quizId),
    enabled: quizId > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection time
  });

  // ============================================================================
  // Query: Fetch Attempt Questions
  // ============================================================================

  /**
   * Query to fetch questions for the active attempt
   * Only enabled when there's an active attempt ID
   * Refreshes more frequently than attempts list for timer accuracy
   */
  const questionsQuery = useQuery<AttemptQuestionsResponse, Error>({
    queryKey: quizQueryKeys.questions(quizId, activeAttemptId ?? 0, 0),
    queryFn: () => getAttemptQuestions(quizId, activeAttemptId ?? 0, 0),
    enabled: quizId > 0 && (activeAttemptId ?? 0) > 0,
    staleTime: 30 * 1000, // 30 seconds for timer accuracy
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
  });

  // ============================================================================
  // Mutation: Start Attempt
  // ============================================================================

  /**
   * Mutation to create a new quiz attempt
   * Wraps quiz_create_attempt_handling_errors() via API
   * Backend checks mod/quiz:attempt capability
   */
  const startAttemptMutation = useMutation<CreateAttemptResponse, Error, void>({
    mutationFn: async () => {
      return createQuizAttempt(quizId);
    },
    onMutate: () => {
      setIsSubmitting(true);
      setError(null);
    },
    onSuccess: (data: CreateAttemptResponse) => {
      // Update local state with the new attempt
      setCurrentAttempt(data.attempt);
      setActiveAttemptId(data.attempt.id);

      // Invalidate attempts cache to include the new attempt
      queryClient.invalidateQueries({
        queryKey: quizQueryKeys.attempts(quizId),
      });

      // Call success callback if provided
      if (onAttemptCreated) {
        onAttemptCreated(data.attempt);
      }

      setIsSubmitting(false);
    },
    onError: (err: Error) => {
      setError(err);
      setIsSubmitting(false);

      // Call error callback if provided
      if (onError) {
        onError(err);
      }
    },
  });

  // ============================================================================
  // Mutation: Submit Single Answer
  // ============================================================================

  /**
   * Mutation for submitting a single answer
   * Uses optimistic updates for immediate UI feedback
   * Does NOT finish the attempt - for auto-save only
   */
  const submitAnswerMutation = useMutation<
    SubmitAnswersResponse,
    Error,
    { questionId: number; answer: AnswerValue }
  >({
    mutationFn: async ({ questionId, answer }) => {
      if (!activeAttemptId) {
        throw new Error('No active attempt to submit answers to');
      }

      const request: SubmitAnswersRequest = {
        attemptId: activeAttemptId,
        answers: { [questionId]: answer },
        finishAttempt: false,
        currentPage: currentAttempt?.currentpage ?? 0,
      };

      return submitQuizAnswers(quizId, request);
    },
    onMutate: async ({ questionId, answer }) => {
      setIsSubmitting(true);
      setError(null);

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: quizQueryKeys.questions(quizId, activeAttemptId ?? 0, 0),
      });

      // Snapshot the previous value for rollback
      const previousQuestions = queryClient.getQueryData<AttemptQuestionsResponse>(
        quizQueryKeys.questions(quizId, activeAttemptId ?? 0, 0)
      );

      // Optimistically update the question answer in cache
      if (previousQuestions) {
        queryClient.setQueryData<AttemptQuestionsResponse>(
          quizQueryKeys.questions(quizId, activeAttemptId ?? 0, 0),
          {
            ...previousQuestions,
            questions: previousQuestions.questions.map((q: QuizQuestion) =>
              q.slot === questionId
                ? { ...q, answer, answered: true }
                : q
            ),
          }
        );
      }

      return { previousQuestions };
    },
    onSuccess: () => {
      setIsSubmitting(false);
      // Silent success - no notification for auto-save
    },
    onError: (err: Error, _variables, context) => {
      setError(err);
      setIsSubmitting(false);

      // Rollback optimistic update on error
      if (context?.previousQuestions) {
        queryClient.setQueryData(
          quizQueryKeys.questions(quizId, activeAttemptId ?? 0, 0),
          context.previousQuestions
        );
      }

      // Call error callback if provided
      if (onError) {
        onError(err);
      }
    },
    onSettled: () => {
      // Refetch to ensure cache is in sync with server
      queryClient.invalidateQueries({
        queryKey: quizQueryKeys.questions(quizId, activeAttemptId ?? 0, 0),
      });
    },
  });

  // ============================================================================
  // Mutation: Submit All Answers
  // ============================================================================

  /**
   * Mutation for batch submitting multiple answers
   * Used when navigating between pages to save all current answers
   * Does NOT finish the attempt
   */
  const submitAllAnswersMutation = useMutation<
    SubmitAnswersResponse,
    Error,
    Record<number, AnswerValue>
  >({
    mutationFn: async (answers) => {
      if (!activeAttemptId) {
        throw new Error('No active attempt to submit answers to');
      }

      const request: SubmitAnswersRequest = {
        attemptId: activeAttemptId,
        answers,
        finishAttempt: false,
        currentPage: currentAttempt?.currentpage ?? 0,
      };

      return submitQuizAnswers(quizId, request);
    },
    onMutate: async (answers) => {
      setIsSubmitting(true);
      setError(null);

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: quizQueryKeys.questions(quizId, activeAttemptId ?? 0, 0),
      });

      // Snapshot for rollback
      const previousQuestions = queryClient.getQueryData<AttemptQuestionsResponse>(
        quizQueryKeys.questions(quizId, activeAttemptId ?? 0, 0)
      );

      // Optimistically update all answers in cache
      if (previousQuestions) {
        queryClient.setQueryData<AttemptQuestionsResponse>(
          quizQueryKeys.questions(quizId, activeAttemptId ?? 0, 0),
          {
            ...previousQuestions,
            questions: previousQuestions.questions.map((q: QuizQuestion) =>
              answers[q.slot] !== undefined
                ? { ...q, answer: answers[q.slot], answered: true }
                : q
            ),
          }
        );
      }

      return { previousQuestions };
    },
    onSuccess: () => {
      setIsSubmitting(false);

      // Call success callback if provided
      if (onAnswerSubmitted) {
        onAnswerSubmitted();
      }
    },
    onError: (err: Error, _variables, context) => {
      setError(err);
      setIsSubmitting(false);

      // Rollback on error
      if (context?.previousQuestions) {
        queryClient.setQueryData(
          quizQueryKeys.questions(quizId, activeAttemptId ?? 0, 0),
          context.previousQuestions
        );
      }

      // Call error callback
      if (onError) {
        onError(err);
      }
    },
    onSettled: () => {
      // Ensure cache sync
      queryClient.invalidateQueries({
        queryKey: quizQueryKeys.questions(quizId, activeAttemptId ?? 0, 0),
      });
    },
  });

  // ============================================================================
  // Mutation: Finish Attempt
  // ============================================================================

  /**
   * Mutation to finish and grade the attempt
   * Wraps quiz_process_attempt() via API
   * Submits any remaining answers and sets finishAttempt: true
   */
  const finishAttemptMutation = useMutation<AttemptResponse, Error, void>({
    mutationFn: async () => {
      if (!activeAttemptId) {
        throw new Error('No active attempt to finish');
      }

      // Get current answers from cache to submit with finish
      const currentQuestionsData = queryClient.getQueryData<AttemptQuestionsResponse>(
        quizQueryKeys.questions(quizId, activeAttemptId, 0)
      );

      // Build answers record from current question state
      const finalAnswers: Record<number, AnswerValue> = {};
      if (currentQuestionsData?.questions) {
        currentQuestionsData.questions.forEach((q: QuizQuestion) => {
          if (q.answer !== undefined) {
            finalAnswers[q.slot] = q.answer;
          }
        });
      }

      const request: SubmitAnswersRequest = {
        attemptId: activeAttemptId,
        answers: finalAnswers,
        finishAttempt: true,
        currentPage: currentAttempt?.currentpage ?? 0,
      };

      const response = await submitQuizAnswers(quizId, request);

      // Convert SubmitAnswersResponse to AttemptResponse format
      const attemptResponse: AttemptResponse = {
        attempt: response.attempt,
        grade: response.grade ?? null,
        feedback: response.feedback ?? null,
        state: response.attempt.state,
        timefinish: response.attempt.timefinish,
        canreview: response.canReview,
        reviewurl: response.redirectUrl,
      };

      return attemptResponse;
    },
    onMutate: () => {
      setIsSubmitting(true);
      setError(null);
    },
    onSuccess: (data: AttemptResponse) => {
      // Update current attempt state
      setCurrentAttempt(data.attempt);

      // Invalidate all related caches
      queryClient.invalidateQueries({
        queryKey: quizQueryKeys.attempts(quizId),
      });
      queryClient.invalidateQueries({
        queryKey: quizQueryKeys.results(activeAttemptId ?? 0),
      });

      // Call success callback
      if (onAttemptFinished) {
        onAttemptFinished(data);
      }

      setIsSubmitting(false);
    },
    onError: (err: Error) => {
      setError(err);
      setIsSubmitting(false);

      // Allow retry - don't lock user out
      if (onError) {
        onError(err);
      }
    },
  });

  // ============================================================================
  // Memoized Functions
  // ============================================================================

  /**
   * Start a new quiz attempt
   * Memoized to prevent unnecessary re-renders
   */
  const startAttempt = useCallback(async (): Promise<QuizAttempt> => {
    const result = await startAttemptMutation.mutateAsync();
    return result.attempt;
  }, [startAttemptMutation]);

  /**
   * Submit a single answer
   * Memoized to prevent unnecessary re-renders
   */
  const submitAnswer = useCallback(
    async (questionId: number, answer: AnswerValue): Promise<void> => {
      await submitAnswerMutation.mutateAsync({ questionId, answer });
    },
    [submitAnswerMutation]
  );

  /**
   * Submit all answers
   * Memoized to prevent unnecessary re-renders
   */
  const submitAllAnswers = useCallback(
    async (answers: Record<number, AnswerValue>): Promise<void> => {
      await submitAllAnswersMutation.mutateAsync(answers);
    },
    [submitAllAnswersMutation]
  );

  /**
   * Finish the current attempt
   * Memoized to prevent unnecessary re-renders
   */
  const finishAttempt = useCallback(async (): Promise<AttemptResponse> => {
    return finishAttemptMutation.mutateAsync();
  }, [finishAttemptMutation]);

  /**
   * Load an existing attempt
   * Used for resuming in-progress attempts
   */
  const loadAttempt = useCallback(
    async (attemptIdToLoad: number): Promise<void> => {
      try {
        setIsSubmitting(true);
        setError(null);

        // Fetch attempt results to get attempt details
        const attemptResults: AttemptResultsResponse = await getAttemptResults(attemptIdToLoad);

        // Update local state
        setCurrentAttempt(attemptResults.attempt);
        setActiveAttemptId(attemptIdToLoad);

        // Trigger questions query by updating the active attempt ID
        // The useQuery will automatically fetch with the new ID

        setIsSubmitting(false);
      } catch (err) {
        const loadError = err instanceof Error ? err : new Error('Failed to load attempt');
        setError(loadError);
        setIsSubmitting(false);

        if (onError) {
          onError(loadError);
        }
      }
    },
    [onError]
  );

  /**
   * Manually refetch the attempts list
   */
  const refetchAttempts = useCallback(async (): Promise<void> => {
    await attemptsQuery.refetch();
  }, [attemptsQuery]);

  /**
   * Get attempt summary before final submission
   * Returns overview of answered questions and any warnings
   */
  const getAttemptSummaryData = useCallback(async (): Promise<AttemptSummary | null> => {
    if (!activeAttemptId) {
      return null;
    }

    try {
      const summary = await getAttemptSummary(activeAttemptId);
      return summary;
    } catch (err) {
      const summaryError = err instanceof Error ? err : new Error('Failed to fetch attempt summary');
      if (onError) {
        onError(summaryError);
      }
      return null;
    }
  }, [activeAttemptId, onError]);

  // ============================================================================
  // Transform Questions to Expected Format
  // ============================================================================

  /**
   * Transform QuizQuestion[] to Question[] format
   * Maps the API response format to the types expected by consumers
   */
  const transformQuestions = (quizQuestions: QuizQuestion[] | undefined): Question[] => {
    if (!quizQuestions) {
      return [];
    }

    return quizQuestions.map((q: QuizQuestion): Question => ({
      id: q.id,
      type: q.type,
      name: `Question ${q.displaynumber}`,
      questiontext: q.questiontext,
      questiontextformat: q.questiontextformat,
      defaultmark: q.maxmark,
      options: {
        answers: q.options?.map((opt) => ({
          id: opt.id,
          answer: opt.text,
          fraction: opt.correct ? 1 : 0,
          feedback: opt.feedback ?? '',
        })),
      },
      state: q.state as Question['state'],
      maxmark: q.maxmark,
      flagged: q.flagged,
      slot: q.slot,
      page: q.page,
      displaynumber: q.displaynumber,
      response: q.answer,
    }));
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  /**
   * Combined loading state
   */
  const isLoading: boolean =
    attemptsQuery.isLoading || questionsQuery.isLoading;

  /**
   * Combine errors from queries and mutations
   */
  const combinedError: Error | null =
    error ??
    attemptsQuery.error ??
    questionsQuery.error ??
    null;

  /**
   * Extract attempts array from query result
   */
  const attempts: QuizAttempt[] = attemptsQuery.data?.attempts ?? [];

  /**
   * Transform questions from query result
   */
  const questions: Question[] = transformQuestions(questionsQuery.data?.questions);

  // ============================================================================
  // Return Result
  // ============================================================================

  return {
    currentAttempt,
    attempts,
    questions,
    isLoading,
    isSubmitting,
    error: combinedError,
    startAttempt,
    submitAnswer,
    submitAllAnswers,
    finishAttempt,
    loadAttempt,
    refetchAttempts,
    getAttemptSummaryData,
  };
}

// ============================================================================
// Export
// ============================================================================

export default useQuizAttempt;
