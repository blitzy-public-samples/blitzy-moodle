/**
 * Lesson Progress Hook
 *
 * Custom React hook for managing lesson progress state including page navigation,
 * attempt tracking, timer management, and branching path logic. Handles state
 * transitions during lesson completion, processes page responses, manages timer
 * countdown, and coordinates with useLesson hook for data synchronization.
 *
 * References Moodle functions:
 * - lesson->process_page_responses() from public/mod/lesson/locallib.php
 * - lesson->start_timer(), update_timer(), stop_timer(), check_time()
 * - lesson->get_last_page_seen(), cluster_jump(), calculate_new_page_on_jump()
 * - lesson_unseen_question_jump(), lesson_unseen_branch_jump(), lesson_random_question_jump()
 *
 * @module features/activities/lesson/hooks/useLessonProgress
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useLesson } from './useLesson';
import { apiClient } from '@/services/api/client';
// Note: LessonProgress type is available from '../types/lesson.types' if needed
// The hook uses its own LessonProgressState interface for internal state management
import type { Id, Timestamp } from '@/types/common';

// ============================================================================
// Constants (matching Moodle lesson constants from locallib.php)
// ============================================================================

/**
 * Navigation constants matching Moodle LESSON_* jump constants
 * These are exported for documentation and potential future client-side logic.
 * Currently, branching logic is handled server-side via the PHP API.
 */
export const LESSON_JUMP_CONSTANTS = {
  /** Jump to this page */
  LESSON_THISPAGE: 0,
  /** Jump to next page */
  LESSON_NEXTPAGE: -1,
  /** Jump to previous page */
  LESSON_PREVIOUSPAGE: -2,
  /** Jump to end of lesson */
  LESSON_EOL: -9,
  /** Jump to unseen content page */
  LESSON_UNSEENBRANCHPAGE: -50,
  /** Jump to random content page */
  LESSON_RANDOMPAGE: -60,
  /** Jump to random branch */
  LESSON_RANDOMBRANCH: -70,
  /** Jump within cluster */
  LESSON_CLUSTERJUMP: -80,
} as const;

/**
 * Lesson end of lesson constant
 * Exported for convenience, same as LESSON_JUMP_CONSTANTS.LESSON_EOL
 */
export const LESSON_EOL = LESSON_JUMP_CONSTANTS.LESSON_EOL;

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Lesson progress state interface defining all state properties
 * tracked during lesson navigation and completion.
 */
export interface LessonProgressState {
  /** Current page ID being displayed or null if not started */
  currentPageId: Id | null;
  /** Number of attempts the user has made on the lesson */
  attemptCount: number;
  /** Whether the lesson has been completed */
  isCompleted: boolean;
  /** Final grade percentage (0-100) or null if not graded */
  grade: number | null;
  /** Time remaining in seconds for timed lessons, null if no timer */
  timeRemaining: number | null;
  /** Whether the timer is currently active and counting down */
  isTimerActive: boolean;
  /** ID of the last page the user viewed (for resume functionality) */
  lastPageSeen: Id | null;
  /** Current retry number within the current attempt */
  currentRetry: number;
  /** Whether the lesson is being viewed in review mode */
  isReviewMode: boolean;
}

/**
 * Navigation result interface returned after submitting a page response.
 * Contains information about the next page and feedback to display.
 */
export interface NavigationResult {
  /** ID of the next page to display, or null for end of lesson */
  nextPageId: Id | null;
  /** Whether the user's answer was correct */
  isCorrect: boolean;
  /** Feedback text to display to the user */
  feedback: string;
  /** Whether feedback should be shown before navigation */
  shouldShowFeedback: boolean;
  /** Whether this response leads to the end of the lesson */
  isEndOfLesson: boolean;
}

/**
 * Page response interface for submitting answers to lesson pages.
 * Contains all data needed to process the user's response.
 */
export interface PageResponse {
  /** ID of the page being responded to */
  pageid: Id;
  /** ID of the selected answer, or null for essay/other types */
  answerid: Id | null;
  /** Additional response data (essay text, matching answers, etc.) */
  data: Record<string, unknown>;
  /** Timestamp when the page was viewed */
  timeseen: Timestamp;
}

/**
 * Timer state returned from the API
 */
interface TimerApiResponse {
  /** Whether the operation was successful */
  success: boolean;
  /** Timer data */
  data: {
    /** Start timestamp of the timer */
    starttime: Timestamp;
    /** Total lesson time in seconds */
    lessontime: number;
    /** Whether timer is active */
    isActive: boolean;
  };
}

/**
 * Page response API result
 */
interface PageResponseApiResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Response data */
  data: {
    /** Next page ID to navigate to */
    nextPageId: Id | null;
    /** Whether the answer was correct */
    isCorrect: boolean;
    /** Feedback text */
    feedback: string;
    /** Whether to show feedback */
    showFeedback: boolean;
    /** Whether this is the end of the lesson */
    isEndOfLesson: boolean;
    /** Updated attempt count */
    attemptCount: number;
    /** Current retry count */
    retryCount: number;
    /** Final grade if lesson is complete */
    grade: number | null;
  };
}

/**
 * Parameters for submitting a page response
 */
interface SubmitPageResponseParams {
  /** The page ID being responded to */
  pageId: Id;
  /** The answer data for the page */
  answerData: PageResponse;
}

/**
 * Return type for the useLessonProgress hook
 */
interface UseLessonProgressReturn extends LessonProgressState {
  /** Navigate to a specific page by ID */
  navigateToPage: (pageId: Id) => void;
  /** Submit a response to the current page */
  submitPageResponse: (pageId: Id, answerData: PageResponse) => Promise<NavigationResult>;
  /** Start the lesson timer */
  startTimer: () => Promise<void>;
  /** Stop the lesson timer */
  stopTimer: () => Promise<void>;
  /** Handle timer expiration (auto-submit and redirect) */
  handleTimerExpiration: () => Promise<void>;
  /** Get the current progress percentage (0-100) */
  getProgressPercentage: () => number;
  /** Check if the user can retry the current page */
  canRetry: () => boolean;
  /** Whether a mutation is currently in progress */
  isSubmitting: boolean;
  /** Error from the last mutation if any */
  error: Error | null;
}

// ============================================================================
// Query Keys (for cache invalidation)
// ============================================================================

/**
 * Query key factory for lesson progress queries
 */
const lessonProgressQueryKeys = {
  /** Base key for all lesson progress queries */
  all: ['lessonProgress'] as const,
  /** Key for a specific lesson's progress */
  lesson: (lessonId: Id) => [...lessonProgressQueryKeys.all, lessonId] as const,
  /** Key for timer state */
  timer: (lessonId: Id) => [...lessonProgressQueryKeys.lesson(lessonId), 'timer'] as const,
  /** Key for attempts */
  attempts: (lessonId: Id) => [...lessonProgressQueryKeys.lesson(lessonId), 'attempts'] as const,
};

// ============================================================================
// Custom Hook Implementation
// ============================================================================

/**
 * Custom hook for managing lesson progress state.
 *
 * Provides comprehensive state management for lesson navigation including:
 * - Current page tracking and navigation
 * - Attempt and retry counting
 * - Timer management with countdown
 * - Branching path logic support
 * - Progress synchronization with server
 *
 * @param lessonId - The ID of the lesson to track progress for
 * @param initialPageId - Optional initial page ID to start from (overrides last page seen)
 * @returns Object containing progress state and action methods
 *
 * @example
 * ```tsx
 * const {
 *   currentPageId,
 *   timeRemaining,
 *   navigateToPage,
 *   submitPageResponse,
 *   getProgressPercentage
 * } = useLessonProgress(lessonId, firstPageId);
 * ```
 */
export function useLessonProgress(
  lessonId: Id,
  initialPageId?: Id | null
): UseLessonProgressReturn {
  // ============================================================================
  // Query Client for Cache Management
  // ============================================================================
  const queryClient = useQueryClient();

  // ============================================================================
  // Fetch Lesson Data using useLesson hook
  // ============================================================================
  const { data: lessonData, isLoading: isLessonLoading } = useLesson(lessonId);

  // ============================================================================
  // Progress State Management
  // ============================================================================
  const [progressState, setProgressState] = useState<LessonProgressState>({
    currentPageId: initialPageId ?? null,
    attemptCount: 0,
    isCompleted: false,
    grade: null,
    timeRemaining: null,
    isTimerActive: false,
    lastPageSeen: null,
    currentRetry: 0,
    isReviewMode: false,
  });

  // Track timer interval reference for cleanup
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track timer start time for calculations
  const timerStartRef = useRef<Timestamp | null>(null);

  // Track lesson time limit
  const timeLimitRef = useRef<number | null>(null);

  // Track if component is mounted
  const isMountedRef = useRef<boolean>(true);

  // ============================================================================
  // Initialize Progress State from Lesson Data
  // ============================================================================
  useEffect(() => {
    if (lessonData && !isLessonLoading) {
      const lesson = lessonData;

      // Initialize from lesson data or provided initialPageId
      setProgressState((prev) => ({
        ...prev,
        // Use initialPageId if provided, otherwise try to get last page seen
        currentPageId: initialPageId ?? prev.currentPageId,
        // Initialize timer state from lesson settings
        timeRemaining: lesson.timelimit ? lesson.timelimit : null,
        // Store time limit for timer calculations
        isTimerActive: false,
      }));

      // Store time limit in ref for timer calculations
      timeLimitRef.current = lesson.timelimit ?? null;
    }
  }, [lessonData, isLessonLoading, initialPageId]);

  // ============================================================================
  // Cleanup on Unmount
  // ============================================================================
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      // Clear timer interval on unmount
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, []);

  // ============================================================================
  // Timer Countdown Effect
  // ============================================================================
  useEffect(() => {
    // Only run timer if active and has time remaining
    if (!progressState.isTimerActive || progressState.timeRemaining === null) {
      return;
    }

    // Clear any existing interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    // Set up countdown interval (every second)
    timerIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;

      setProgressState((prev) => {
        if (prev.timeRemaining === null || prev.timeRemaining <= 0) {
          // Timer expired - will be handled by handleTimerExpiration
          return { ...prev, timeRemaining: 0, isTimerActive: false };
        }

        return {
          ...prev,
          timeRemaining: prev.timeRemaining - 1,
        };
      });
    }, 1000);

    // Cleanup interval on effect cleanup
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [progressState.isTimerActive]);

  // ============================================================================
  // Handle Timer Expiration Automatically
  // ============================================================================
  useEffect(() => {
    if (
      progressState.isTimerActive === false &&
      progressState.timeRemaining === 0 &&
      !progressState.isCompleted
    ) {
      // Timer has expired - trigger expiration handler
      handleTimerExpiration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressState.timeRemaining, progressState.isTimerActive, progressState.isCompleted]);

  // ============================================================================
  // API Mutations
  // ============================================================================

  /**
   * Mutation for submitting page responses
   */
  const submitResponseMutation = useMutation<
    NavigationResult,
    Error,
    SubmitPageResponseParams
  >({
    mutationFn: async ({ pageId, answerData }) => {
      const response = await apiClient.post<PageResponseApiResult>(
        `/api/v1/lesson/${lessonId}/pages/${pageId}/response`,
        {
          pageid: answerData.pageid,
          answerid: answerData.answerid,
          data: answerData.data,
          timeseen: answerData.timeseen,
        }
      );

      if (!response.data.success) {
        throw new Error('Failed to submit page response');
      }

      const result = response.data.data;

      // Update progress state with response data
      setProgressState((prev) => ({
        ...prev,
        attemptCount: result.attemptCount,
        currentRetry: result.retryCount,
        isCompleted: result.isEndOfLesson,
        grade: result.grade,
        currentPageId: result.nextPageId,
        lastPageSeen: pageId,
      }));

      return {
        nextPageId: result.nextPageId,
        isCorrect: result.isCorrect,
        feedback: result.feedback,
        shouldShowFeedback: result.showFeedback,
        isEndOfLesson: result.isEndOfLesson,
      };
    },
    onSuccess: () => {
      // Invalidate lesson progress queries to refresh data
      queryClient.invalidateQueries({
        queryKey: lessonProgressQueryKeys.lesson(lessonId),
      });
      // Also invalidate main lesson queries
      queryClient.invalidateQueries({
        queryKey: ['lessons', lessonId],
      });
    },
    onError: (error) => {
      console.error('Failed to submit page response:', error);
    },
  });

  /**
   * Mutation for starting the timer
   */
  const startTimerMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      const response = await apiClient.post<TimerApiResponse>(
        `/api/v1/lesson/${lessonId}/timer/start`
      );

      if (!response.data.success) {
        throw new Error('Failed to start lesson timer');
      }

      const { starttime, lessontime } = response.data.data;

      // Store timer start time
      timerStartRef.current = starttime;

      // Calculate initial time remaining
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - starttime;
      const remaining = Math.max(0, lessontime - elapsed);

      setProgressState((prev) => ({
        ...prev,
        timeRemaining: remaining,
        isTimerActive: true,
      }));
    },
    onError: (error) => {
      console.error('Failed to start timer:', error);
    },
  });

  /**
   * Mutation for stopping the timer
   */
  const stopTimerMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      const response = await apiClient.post<{ success: boolean }>(
        `/api/v1/lesson/${lessonId}/timer/stop`
      );

      if (!response.data.success) {
        throw new Error('Failed to stop lesson timer');
      }

      // Clear timer interval
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      setProgressState((prev) => ({
        ...prev,
        isTimerActive: false,
      }));
    },
    onError: (error) => {
      console.error('Failed to stop timer:', error);
    },
  });

  /**
   * Mutation for handling timer expiration
   */
  const timerExpirationMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      // Post to server that timer has expired
      const response = await apiClient.post<{
        success: boolean;
        data: { grade: number | null };
      }>(`/api/v1/lesson/${lessonId}/timer/expired`);

      if (!response.data.success) {
        throw new Error('Failed to handle timer expiration');
      }

      // Clear timer interval
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      setProgressState((prev) => ({
        ...prev,
        isTimerActive: false,
        isCompleted: true,
        grade: response.data.data.grade,
        timeRemaining: 0,
      }));
    },
    onSuccess: () => {
      // Invalidate queries after timer expiration
      queryClient.invalidateQueries({
        queryKey: lessonProgressQueryKeys.lesson(lessonId),
      });
      queryClient.invalidateQueries({
        queryKey: ['lessons', lessonId],
      });
    },
    onError: (error) => {
      console.error('Failed to handle timer expiration:', error);
    },
  });

  // ============================================================================
  // Action Methods
  // ============================================================================

  /**
   * Navigate to a specific page by ID
   * Updates current page state and invalidates relevant queries
   */
  const navigateToPage = useCallback(
    (pageId: Id): void => {
      setProgressState((prev) => ({
        ...prev,
        currentPageId: pageId,
        lastPageSeen: prev.currentPageId ?? prev.lastPageSeen,
      }));

      // Invalidate page-specific queries to refresh content
      queryClient.invalidateQueries({
        queryKey: ['lessons', lessonId, 'pages', pageId],
      });
    },
    [lessonId, queryClient]
  );

  /**
   * Submit a response to a lesson page
   * Processes the answer and returns navigation result
   */
  const submitPageResponse = useCallback(
    async (pageId: Id, answerData: PageResponse): Promise<NavigationResult> => {
      const result = await submitResponseMutation.mutateAsync({
        pageId,
        answerData,
      });
      return result;
    },
    [submitResponseMutation]
  );

  /**
   * Start the lesson timer
   * Initializes timer state and begins countdown
   */
  const startTimer = useCallback(async (): Promise<void> => {
    await startTimerMutation.mutateAsync();
  }, [startTimerMutation]);

  /**
   * Stop the lesson timer
   * Pauses countdown and clears interval
   */
  const stopTimer = useCallback(async (): Promise<void> => {
    await stopTimerMutation.mutateAsync();
  }, [stopTimerMutation]);

  /**
   * Handle timer expiration
   * Automatically submits current progress and redirects to end of lesson
   */
  const handleTimerExpiration = useCallback(async (): Promise<void> => {
    await timerExpirationMutation.mutateAsync();
  }, [timerExpirationMutation]);

  /**
   * Calculate the current progress percentage
   * Based on visited pages vs total pages from lesson data
   */
  const getProgressPercentage = useCallback((): number => {
    if (!lessonData) {
      return 0;
    }

    // If we have progress data from the lesson, use it
    // Otherwise calculate based on completion state
    if (progressState.isCompleted) {
      return 100;
    }

    // Default to 0 if we can't calculate progress
    // The actual calculation should come from server via useLessonProgress in useLesson
    return 0;
  }, [lessonData, progressState.isCompleted]);

  /**
   * Check if the user can retry the current page
   * Based on max attempts setting and current retry count
   */
  const canRetry = useCallback((): boolean => {
    if (!lessonData) {
      return false;
    }

    // If maxattempts is 0, unlimited retries are allowed
    const maxAttempts = lessonData.maxattempts ?? 0;
    if (maxAttempts === 0) {
      return true;
    }

    // Check if current retry count is less than max attempts
    return progressState.currentRetry < maxAttempts;
  }, [lessonData, progressState.currentRetry]);

  // ============================================================================
  // Return Hook Value
  // ============================================================================
  return {
    // State values
    currentPageId: progressState.currentPageId,
    attemptCount: progressState.attemptCount,
    isCompleted: progressState.isCompleted,
    grade: progressState.grade,
    timeRemaining: progressState.timeRemaining,
    isTimerActive: progressState.isTimerActive,
    lastPageSeen: progressState.lastPageSeen,
    currentRetry: progressState.currentRetry,
    isReviewMode: progressState.isReviewMode,

    // Action methods
    navigateToPage,
    submitPageResponse,
    startTimer,
    stopTimer,
    handleTimerExpiration,
    getProgressPercentage,
    canRetry,

    // Mutation state
    isSubmitting:
      submitResponseMutation.isPending ||
      startTimerMutation.isPending ||
      stopTimerMutation.isPending ||
      timerExpirationMutation.isPending,
    error:
      submitResponseMutation.error ||
      startTimerMutation.error ||
      stopTimerMutation.error ||
      timerExpirationMutation.error,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useLessonProgress;
