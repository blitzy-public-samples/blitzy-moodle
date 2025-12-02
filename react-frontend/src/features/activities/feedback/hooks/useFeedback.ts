/**
 * Custom React Query Hook for Feedback Activity Data Management
 *
 * Provides type-safe access to feedback activity details including questions,
 * settings, completion status, and user responses. Implements intelligent
 * caching with 5-minute stale time, automatic background revalidation, and
 * support for both named and anonymous feedbacks.
 *
 * @module features/activities/feedback/hooks/useFeedback
 *
 * Key Features:
 * - Type-safe access to feedback data via React Query
 * - Intelligent caching with 5-minute stale time and 10-minute cache time
 * - Automatic background revalidation on window focus and network reconnect
 * - Support for conditional query enabling/disabling
 * - Configurable auto-refresh intervals for real-time updates
 * - Computed properties for availability and permission checks
 * - Memoized derived values for performance optimization
 *
 * Integration with Moodle Backend:
 * - Wraps GET /api/v1/feedback/{id} endpoint
 * - API calls existing Moodle feedback_get_feedback() function
 * - Uses mod_feedback_completion class methods for status checks
 * - Backend is authoritative for all permission checks via require_capability()
 * - No business logic duplication - all validation on server-side
 *
 * Usage Examples:
 * ```typescript
 * // Basic usage - fetch feedback by ID
 * const { feedback, questions, isLoading } = useFeedback({ feedbackId: 42 });
 *
 * // With course ID for site-wide feedbacks
 * const { feedback, canComplete } = useFeedback({
 *   feedbackId: 42,
 *   courseId: 10
 * });
 *
 * // With conditional enabling and auto-refresh
 * const { feedback, refetch } = useFeedback({
 *   feedbackId: 42,
 *   enabled: isVisible,
 *   refetchInterval: 30000 // Refresh every 30 seconds
 * });
 * ```
 *
 * Cache Invalidation Patterns:
 * - Manual invalidation: queryClient.invalidateQueries(['feedback', feedbackId])
 * - After submission: Use useFeedbackResponse hook's onSuccess callback
 * - On window focus: Automatic (refetchOnWindowFocus enabled)
 * - On reconnect: Automatic (refetchOnReconnect enabled)
 *
 * @see ../api/feedbackApi.ts - API client functions
 * @see ../types/feedback.types.ts - TypeScript interfaces
 * @see public/mod/feedback/classes/completion.php - Moodle completion class
 * @see public/mod/feedback/classes/structure.php - Moodle structure class
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';

import {
  getFeedback,
  getFeedbackStatus,
  getFeedbackQuestions,
  type FeedbackStatus,
} from '../api/feedbackApi';
import type {
  Feedback,
  FeedbackItem,
  FeedbackCompleted,
} from '../types/feedback.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default stale time for feedback queries (5 minutes in milliseconds).
 *
 * After this time, cached data is considered stale and will be refetched
 * in the background on next access. This balances data freshness with
 * reduced server load for feedback activities which don't change frequently.
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

/**
 * Default cache time for feedback queries (10 minutes in milliseconds).
 *
 * Data remains in cache for this duration even after all subscribers unmount.
 * Set higher than staleTime to allow quick remounts without refetching.
 */
const DEFAULT_CACHE_TIME = 10 * 60 * 1000;

/**
 * Anonymous feedback constant value.
 * Matches FEEDBACK_ANONYMOUS_YES constant from Moodle's mod/feedback/lib.php
 */
const FEEDBACK_ANONYMOUS_YES = 1;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Options for configuring the useFeedback hook.
 *
 * Controls query behavior including caching, conditional fetching,
 * and automatic refresh intervals.
 */
export interface FeedbackHookOptions {
  /**
   * ID of the feedback activity to fetch (required).
   * Must be a positive integer corresponding to feedback.id in the database.
   */
  feedbackId: number;

  /**
   * Course ID for site-wide feedbacks (optional).
   *
   * When a feedback is placed on the site front page but mapped to specific
   * courses, this parameter filters data for the specified course context.
   * For feedbacks in regular courses, this is typically not needed.
   */
  courseId?: number;

  /**
   * Conditionally enable or disable the query (optional).
   *
   * When false, the query will not automatically fetch data.
   * Useful for lazy loading or conditional data requirements.
   * @default true
   */
  enabled?: boolean;

  /**
   * Auto-refresh interval in milliseconds (optional).
   *
   * When set, the query will automatically refetch at this interval.
   * Useful for real-time updates during active feedback sessions.
   * Set to undefined or 0 to disable automatic refetching.
   */
  refetchInterval?: number;
}

/**
 * Result object returned by the useFeedback hook.
 *
 * Contains the feedback data, computed status properties, loading states,
 * and utility functions for managing the feedback query.
 */
export interface FeedbackHookResult {
  /**
   * Full feedback activity details including all configuration settings.
   * Undefined while loading or if an error occurred.
   */
  feedback: Feedback | undefined;

  /**
   * Array of feedback questions/items including their configuration.
   * Returns empty array while loading or if no questions defined.
   * Includes all item types: questions, labels, pagebreaks, etc.
   */
  questions: FeedbackItem[];

  /**
   * User's completion record if they have submitted the feedback.
   * Null if user hasn't completed or for anonymous feedbacks.
   * Contains submission timestamp and response identifiers.
   */
  completion: FeedbackCompleted | null;

  /**
   * Whether the feedback is currently open for responses.
   *
   * Computed from feedback.timeopen and feedback.timeclose settings.
   * True if current time is within the open period.
   */
  isOpen: boolean;

  /**
   * Whether the current user can complete the feedback.
   *
   * Considers:
   * - User has mod/feedback:complete capability
   * - Feedback is currently open (isOpen)
   * - User hasn't exceeded submission limits
   *
   * Note: Backend is authoritative for this check via require_capability()
   */
  canComplete: boolean;

  /**
   * Whether the user can submit a new response.
   *
   * Considers:
   * - feedback.multiple_submit setting
   * - Whether user has already submitted
   * - Other submission restrictions
   *
   * Note: Backend enforces this in save_response()
   */
  canSubmit: boolean;

  /**
   * Whether the feedback accepts anonymous responses.
   *
   * When true (anonymous=1), responses are not linked to user IDs
   * and cannot be viewed individually per user.
   */
  isAnonymous: boolean;

  /**
   * Whether the current user has already responded to this feedback.
   *
   * True if a completion record exists for the user.
   * For anonymous feedbacks, this may not be determinable.
   */
  hasResponded: boolean;

  /**
   * Loading state for the initial data fetch.
   *
   * True only during the first fetch when no cached data exists.
   * Use this to show skeleton loaders or loading spinners.
   */
  isLoading: boolean;

  /**
   * Fetching state for any data retrieval including background updates.
   *
   * True during initial fetch AND background refetches.
   * Use this to show subtle loading indicators during updates.
   */
  isFetching: boolean;

  /**
   * Error state if the fetch operation failed.
   *
   * Contains the error object if any query failed, null otherwise.
   * Use this to display error messages and retry options.
   */
  error: Error | null;

  /**
   * Function to manually trigger a data refetch.
   *
   * Returns a promise that resolves when the refetch completes.
   * Useful for "refresh" buttons or after performing mutations.
   */
  refetch: () => Promise<void>;
}

/**
 * Internal type for the combined feedback data response.
 *
 * Represents the aggregated data from feedback and status queries
 * used internally within the hook for derived computations.
 */
interface FeedbackQueryData {
  feedback: Feedback;
  status: FeedbackStatus | null;
  questions: FeedbackItem[];
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Custom React Query hook for fetching and managing feedback activity data.
 *
 * Provides comprehensive access to feedback details, questions, completion
 * status, and user permissions. Implements intelligent caching with automatic
 * background revalidation for optimal performance and data freshness.
 *
 * @param options - Configuration options for the hook
 * @returns FeedbackHookResult object with feedback data and utilities
 *
 * @example Basic usage
 * ```typescript
 * function FeedbackView({ feedbackId }: { feedbackId: number }) {
 *   const {
 *     feedback,
 *     questions,
 *     isLoading,
 *     isOpen,
 *     canComplete
 *   } = useFeedback({ feedbackId });
 *
 *   if (isLoading) return <Skeleton />;
 *   if (!feedback) return <NotFound />;
 *
 *   return (
 *     <div>
 *       <h1>{feedback.name}</h1>
 *       {isOpen && canComplete ? (
 *         <FeedbackForm questions={questions} />
 *       ) : (
 *         <ClosedMessage />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With course context for site feedbacks
 * ```typescript
 * const { feedback, hasResponded } = useFeedback({
 *   feedbackId: 42,
 *   courseId: currentCourseId
 * });
 * ```
 *
 * @example With auto-refresh for live updates
 * ```typescript
 * const { feedback, refetch } = useFeedback({
 *   feedbackId: 42,
 *   refetchInterval: 60000 // Refresh every minute
 * });
 * ```
 */
export function useFeedback(options: FeedbackHookOptions): FeedbackHookResult {
  const { feedbackId, courseId, enabled = true, refetchInterval } = options;

  // Get query client for cache operations and manual invalidation
  const queryClient = useQueryClient();

  // Validate feedbackId is provided and positive
  const isValidFeedbackId = feedbackId > 0 && Number.isInteger(feedbackId);
  const queryEnabled = enabled && isValidFeedbackId;

  // ============================================================================
  // MAIN FEEDBACK QUERY
  // ============================================================================

  /**
   * Primary query for fetching feedback activity details.
   *
   * Uses a compound query key including feedbackId and courseId for proper
   * cache isolation between different course contexts of site feedbacks.
   */
  const feedbackQuery = useQuery({
    queryKey: ['feedback', feedbackId, courseId] as const,
    queryFn: async (): Promise<Feedback> => {
      const response = await getFeedback(feedbackId);
      if (!response.success || !response.data) {
        throw new Error(
          response.error?.message || 'Failed to fetch feedback data'
        );
      }
      return response.data;
    },
    enabled: queryEnabled,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: refetchInterval || undefined,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // ============================================================================
  // STATUS QUERY
  // ============================================================================

  /**
   * Secondary query for fetching feedback status information.
   *
   * Fetches completion status, permissions, and availability data.
   * Only runs when the main feedback query has succeeded.
   */
  const statusQuery = useQuery({
    queryKey: ['feedback', 'status', feedbackId, courseId] as const,
    queryFn: async (): Promise<FeedbackStatus> => {
      const response = await getFeedbackStatus(feedbackId);
      if (!response.success || !response.data) {
        throw new Error(
          response.error?.message || 'Failed to fetch feedback status'
        );
      }
      return response.data;
    },
    enabled: queryEnabled && !!feedbackQuery.data,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: refetchInterval || undefined,
    retry: 2,
  });

  // ============================================================================
  // QUESTIONS QUERY
  // ============================================================================

  /**
   * Secondary query for fetching feedback questions/items.
   *
   * Fetches all items including questions, labels, and pagebreaks.
   * Only runs when the main feedback query has succeeded.
   */
  const questionsQuery = useQuery({
    queryKey: ['feedback', 'questions', feedbackId] as const,
    queryFn: async (): Promise<FeedbackItem[]> => {
      const response = await getFeedbackQuestions(feedbackId);
      if (!response.success || !response.data) {
        throw new Error(
          response.error?.message || 'Failed to fetch feedback questions'
        );
      }
      return response.data;
    },
    enabled: queryEnabled && !!feedbackQuery.data,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================

  /**
   * Memoized computation of whether the feedback is currently open.
   *
   * Checks timeopen and timeclose against the current time.
   * Matches logic in mod_feedback_structure::is_open()
   */
  const isOpen = useMemo((): boolean => {
    const feedback = feedbackQuery.data;
    if (!feedback) return false;

    const now = Math.floor(Date.now() / 1000); // Current Unix timestamp
    const isAfterOpen = !feedback.timeopen || feedback.timeopen <= now;
    const isBeforeClose = !feedback.timeclose || feedback.timeclose >= now;

    return isAfterOpen && isBeforeClose;
  }, [feedbackQuery.data]);

  /**
   * Memoized computation of whether the user can complete the feedback.
   *
   * Combines local checks with status data from the backend.
   * Backend is authoritative via require_capability('mod/feedback:complete')
   */
  const canComplete = useMemo((): boolean => {
    const status = statusQuery.data;
    if (!status) {
      // If status not loaded, fall back to isOpen check only
      return isOpen;
    }
    return status.canComplete;
  }, [statusQuery.data, isOpen]);

  /**
   * Memoized computation of whether the user can submit a new response.
   *
   * Considers multiple_submit setting and existing submissions.
   * Matches logic in mod_feedback_completion::can_submit()
   */
  const canSubmit = useMemo((): boolean => {
    const status = statusQuery.data;
    if (!status) {
      // If status not loaded, assume can submit if open
      return isOpen;
    }
    return status.canSubmit;
  }, [statusQuery.data, isOpen]);

  /**
   * Memoized computation of whether feedback accepts anonymous responses.
   *
   * Based on feedback.anonymous setting (1 = anonymous, 2 = identified)
   */
  const isAnonymous = useMemo((): boolean => {
    const feedback = feedbackQuery.data;
    if (!feedback) return false;
    return feedback.anonymous === FEEDBACK_ANONYMOUS_YES;
  }, [feedbackQuery.data]);

  /**
   * Memoized computation of whether the current user has already responded.
   *
   * Based on status.isSubmitted from the backend status check.
   */
  const hasResponded = useMemo((): boolean => {
    const status = statusQuery.data;
    if (!status) return false;
    return status.isSubmitted;
  }, [statusQuery.data]);

  /**
   * Memoized questions array with proper typing.
   *
   * Returns empty array if questions haven't loaded yet.
   */
  const questions = useMemo((): FeedbackItem[] => {
    return questionsQuery.data ?? [];
  }, [questionsQuery.data]);

  /**
   * Memoized completion data extraction with null safety.
   *
   * Constructs a FeedbackCompleted object from status data if available.
   */
  const completion = useMemo((): FeedbackCompleted | null => {
    const status = statusQuery.data;
    const feedback = feedbackQuery.data;

    if (!status || !status.completedId || !feedback) {
      return null;
    }

    // Construct a FeedbackCompleted object from available status data
    // Note: This is a minimal representation; full data comes from the backend
    const completedRecord: FeedbackCompleted = {
      id: status.completedId,
      feedback: feedbackId,
      userid: 0, // Backend doesn't expose this in status for privacy
      timemodified: 0, // Not available in status response
      random_response: 0,
      anonymous_response: isAnonymous ? FEEDBACK_ANONYMOUS_YES : 2,
      courseid: courseId ?? 0,
    };

    return completedRecord;
  }, [statusQuery.data, feedbackQuery.data, feedbackId, courseId, isAnonymous]);

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  /**
   * Combined error state from all queries.
   *
   * Returns the first error encountered from any of the queries.
   */
  const error = useMemo((): Error | null => {
    if (feedbackQuery.error) {
      return feedbackQuery.error instanceof Error
        ? feedbackQuery.error
        : new Error(String(feedbackQuery.error));
    }
    if (statusQuery.error) {
      return statusQuery.error instanceof Error
        ? statusQuery.error
        : new Error(String(statusQuery.error));
    }
    if (questionsQuery.error) {
      return questionsQuery.error instanceof Error
        ? questionsQuery.error
        : new Error(String(questionsQuery.error));
    }
    return null;
  }, [feedbackQuery.error, statusQuery.error, questionsQuery.error]);

  // ============================================================================
  // LOADING STATES
  // ============================================================================

  /**
   * Initial loading state - true only on first fetch with no cached data.
   */
  const isLoading =
    feedbackQuery.isLoading ||
    (feedbackQuery.isSuccess && statusQuery.isLoading) ||
    (feedbackQuery.isSuccess && questionsQuery.isLoading);

  /**
   * Fetching state - true during any data retrieval including background refetch.
   */
  const isFetching =
    feedbackQuery.isFetching ||
    statusQuery.isFetching ||
    questionsQuery.isFetching;

  // ============================================================================
  // REFETCH FUNCTION
  // ============================================================================

  /**
   * Memoized refetch function for manual data refresh.
   *
   * Invalidates all related queries and triggers a fresh fetch.
   * Wrapped in useCallback to maintain stable reference.
   */
  const refetch = useCallback(async (): Promise<void> => {
    // Invalidate all feedback-related queries for this feedbackId
    await queryClient.invalidateQueries({
      queryKey: ['feedback', feedbackId],
    });

    // Await the main query refetch to ensure data is fresh
    await feedbackQuery.refetch();
    await Promise.all([statusQuery.refetch(), questionsQuery.refetch()]);
  }, [queryClient, feedbackId, feedbackQuery, statusQuery, questionsQuery]);

  // ============================================================================
  // RETURN VALUE
  // ============================================================================

  return {
    feedback: feedbackQuery.data,
    questions,
    completion,
    isOpen,
    canComplete,
    canSubmit,
    isAnonymous,
    hasResponded,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}

// Export the hook as a named export (as specified in schema)
export { useFeedback as default };
