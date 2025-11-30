/**
 * Custom React Hooks for Moodle Lesson Activity Data Fetching
 *
 * This module provides React Query hooks for fetching and caching lesson activity data
 * from the Moodle API. All hooks follow React Query best practices with:
 * - Automatic caching and background refetching
 * - Loading states and error handling
 * - Query invalidation for data updates
 * - TypeScript strict mode compliance
 *
 * API Endpoints Wrapped:
 * - GET /api/v1/lesson/{id} - Lesson details (wraps lesson::load())
 * - GET /api/v1/lesson/{id}/pages - Lesson pages (wraps lesson->load_all_pages())
 * - GET /api/v1/lesson/{id}/attempts - User attempts (wraps lesson->get_attempts())
 * - GET /api/v1/lesson/{id}/timer - Timer info (wraps lesson->get_user_timers())
 *
 * Moodle Functions Referenced:
 * - lesson::load() from public/mod/lesson/locallib.php:1651-1658
 * - lesson->load_all_pages() from public/mod/lesson/locallib.php:2341-2348
 * - lesson->get_attempts() from public/mod/lesson/locallib.php:1951-1963
 * - lesson->get_user_timers() from public/mod/lesson/locallib.php:3159-3168
 * - lesson->count_user_retries() from public/mod/lesson/locallib.php:3030-3034
 * - lesson->get_last_page_seen() from public/mod/lesson/locallib.php:2970-3021
 *
 * @package react-frontend
 * @module features/activities/lesson/hooks
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, QueryClient } from '@tanstack/react-query';
import apiClient from '@/services/api/client';
import type { AxiosResponse } from 'axios';
import type {
  Lesson,
  LessonPage,
  LessonAttempt,
  LessonTimer,
  LessonProgress,
} from '@/features/activities/lesson/types/lesson.types';

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response envelope for successful responses
 * Matches the standard response envelope defined in the API specification
 */
interface ApiResponse<T> {
  /** Indicates if the request was successful */
  success: boolean;
  /** The actual response data */
  data: T;
  /** Optional metadata (pagination, timing, etc.) */
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Lesson details response including computed fields
 * Extends the base Lesson type with additional computed data
 */
interface LessonDetailsResponse extends Lesson {
  /** Course module ID for this lesson */
  cmid?: number;
  /** First page ID in the lesson (prevpageid=0) */
  firstpageid?: number;
  /** Last page ID in the lesson (nextpageid=0) */
  lastpageid?: number;
  /** Whether the current user can manage the lesson */
  canmanage?: boolean;
  /** Whether the lesson is accessible at current time */
  isaccessible?: boolean;
}

/**
 * Lesson pages response with ordering information
 */
interface LessonPagesResponse {
  /** Array of lesson pages in order */
  pages: LessonPage[];
  /** Total count of pages */
  count: number;
}

/**
 * Lesson attempts response with user progress information
 */
interface LessonAttemptsResponse {
  /** Array of user attempts */
  attempts: LessonAttempt[];
  /** Number of completed retries */
  retries: number;
  /** Last page seen in current attempt */
  lastpageseen?: number;
  /** Best grade achieved */
  bestgrade?: number;
}

/**
 * Lesson timer response with time tracking
 */
interface LessonTimerResponse {
  /** Array of timer records */
  timers: LessonTimer[];
  /** Current active timer (if any) */
  activeTimer?: LessonTimer;
  /** Total time spent across all attempts */
  totalTimeSpent: number;
  /** Time remaining (if timed lesson) */
  timeRemaining?: number;
}

/**
 * Lesson progress response for current user
 */
interface LessonProgressResponse extends LessonProgress {
  /** Current retry number */
  currentRetry: number;
  /** Whether user has completed the lesson */
  hasCompleted: boolean;
  /** Grade for current attempt */
  currentGrade?: number;
}

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for lesson-related queries
 * Provides consistent, type-safe query keys for cache management
 *
 * Usage:
 * ```typescript
 * queryClient.invalidateQueries({ queryKey: lessonKeys.all });
 * queryClient.invalidateQueries({ queryKey: lessonKeys.detail(lessonId) });
 * ```
 */
export const lessonKeys = {
  /** Base key for all lesson queries */
  all: ['lesson'] as const,

  /** Key for listing all lessons */
  lists: () => [...lessonKeys.all, 'list'] as const,

  /** Key for a specific lesson's details */
  detail: (lessonId: number) => [...lessonKeys.all, 'detail', lessonId] as const,

  /** Key for a lesson's pages */
  pages: (lessonId: number) => [...lessonKeys.all, 'pages', lessonId] as const,

  /** Key for a lesson's attempts (user-specific) */
  attempts: (lessonId: number, userId?: number) =>
    [...lessonKeys.all, 'attempts', lessonId, userId ?? 'me'] as const,

  /** Key for a lesson's timer (user-specific) */
  timer: (lessonId: number, userId?: number) =>
    [...lessonKeys.all, 'timer', lessonId, userId ?? 'me'] as const,

  /** Key for a lesson's progress (user-specific) */
  progress: (lessonId: number, userId?: number) =>
    [...lessonKeys.all, 'progress', lessonId, userId ?? 'me'] as const,
} as const;

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default stale time for lesson data (5 minutes)
 * Lesson data doesn't change frequently, so we can cache it longer
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Stale time for timer data (10 seconds)
 * Timer data needs more frequent updates for accurate time tracking
 */
const TIMER_STALE_TIME = 10 * 1000; // 10 seconds

/**
 * Default retry count for failed queries
 */
const DEFAULT_RETRY_COUNT = 3;

/**
 * Retry delay function for exponential backoff
 * @param attemptIndex - The current attempt index (0-based)
 * @returns Delay in milliseconds before next retry
 */
const getRetryDelay = (attemptIndex: number): number => {
  // Exponential backoff: 1s, 2s, 4s
  return Math.min(1000 * Math.pow(2, attemptIndex), 8000);
};

// ============================================================================
// API Fetcher Functions
// ============================================================================

/**
 * Fetches lesson details from the API
 *
 * Wraps the Moodle lesson::load() function which retrieves
 * lesson configuration and settings from the database.
 *
 * @param lessonId - The lesson ID to fetch
 * @returns Promise resolving to lesson details
 * @throws Error if the API request fails
 */
const fetchLesson = async (lessonId: number): Promise<LessonDetailsResponse> => {
  const response: AxiosResponse<ApiResponse<LessonDetailsResponse>> =
    await apiClient.get(`/lesson/${lessonId}`);

  if (!response.data.success) {
    throw new Error('Failed to fetch lesson details');
  }

  return response.data.data;
};

/**
 * Fetches all pages for a lesson from the API
 *
 * Wraps the Moodle lesson->load_all_pages() function which retrieves
 * all pages in the lesson including questions and branch tables.
 *
 * @param lessonId - The lesson ID to fetch pages for
 * @returns Promise resolving to pages response
 * @throws Error if the API request fails
 */
const fetchLessonPages = async (lessonId: number): Promise<LessonPagesResponse> => {
  const response: AxiosResponse<ApiResponse<LessonPagesResponse>> =
    await apiClient.get(`/lesson/${lessonId}/pages`);

  if (!response.data.success) {
    throw new Error('Failed to fetch lesson pages');
  }

  return response.data.data;
};

/**
 * Fetches user attempts for a lesson from the API
 *
 * Wraps the Moodle lesson->get_attempts() function which retrieves
 * all attempts made by a user on the lesson pages.
 *
 * @param lessonId - The lesson ID to fetch attempts for
 * @param userId - Optional user ID (defaults to current user)
 * @returns Promise resolving to attempts response
 * @throws Error if the API request fails
 */
const fetchLessonAttempts = async (
  lessonId: number,
  userId?: number
): Promise<LessonAttemptsResponse> => {
  const params = userId ? { userid: userId } : {};
  const response: AxiosResponse<ApiResponse<LessonAttemptsResponse>> =
    await apiClient.get(`/lesson/${lessonId}/attempts`, { params });

  if (!response.data.success) {
    throw new Error('Failed to fetch lesson attempts');
  }

  return response.data.data;
};

/**
 * Fetches timer information for a lesson from the API
 *
 * Wraps the Moodle lesson->get_user_timers() function which retrieves
 * all timer records for a user's lesson attempts.
 *
 * @param lessonId - The lesson ID to fetch timer for
 * @param userId - Optional user ID (defaults to current user)
 * @returns Promise resolving to timer response
 * @throws Error if the API request fails
 */
const fetchLessonTimer = async (
  lessonId: number,
  userId?: number
): Promise<LessonTimerResponse> => {
  const params = userId ? { userid: userId } : {};
  const response: AxiosResponse<ApiResponse<LessonTimerResponse>> =
    await apiClient.get(`/lesson/${lessonId}/timer`, { params });

  if (!response.data.success) {
    throw new Error('Failed to fetch lesson timer');
  }

  return response.data.data;
};

/**
 * Fetches progress information for a lesson from the API
 *
 * Wraps multiple Moodle functions to calculate user progress:
 * - lesson->count_user_retries()
 * - lesson->get_last_page_seen()
 *
 * @param lessonId - The lesson ID to fetch progress for
 * @param userId - Optional user ID (defaults to current user)
 * @returns Promise resolving to progress response
 * @throws Error if the API request fails
 */
const fetchLessonProgress = async (
  lessonId: number,
  userId?: number
): Promise<LessonProgressResponse> => {
  const params = userId ? { userid: userId } : {};
  const response: AxiosResponse<ApiResponse<LessonProgressResponse>> =
    await apiClient.get(`/lesson/${lessonId}/progress`, { params });

  if (!response.data.success) {
    throw new Error('Failed to fetch lesson progress');
  }

  return response.data.data;
};

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Options for the useLesson hook
 */
interface UseLessonOptions {
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
  /** Stale time in milliseconds (default: 5 minutes) */
  staleTime?: number;
  /** Number of retry attempts (default: 3) */
  retry?: number;
}

/**
 * Hook for fetching lesson details with React Query
 *
 * Provides automatic caching, background refetching, and error handling
 * for lesson data. The lesson data is cached with a 5-minute stale time
 * since lesson configuration rarely changes during a session.
 *
 * Wraps: lesson::load() from public/mod/lesson/locallib.php:1651-1658
 * API Endpoint: GET /api/v1/lesson/{id}
 *
 * @param lessonId - The lesson ID to fetch
 * @param options - Optional configuration for the query
 * @returns UseQueryResult with lesson data, loading, and error states
 *
 * @example
 * ```typescript
 * const { data: lesson, isLoading, error } = useLesson(123);
 *
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return <LessonView lesson={lesson} />;
 * ```
 */
export function useLesson(
  lessonId: number,
  options?: UseLessonOptions
): UseQueryResult<LessonDetailsResponse, Error> {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    retry = DEFAULT_RETRY_COUNT,
  } = options ?? {};

  return useQuery<LessonDetailsResponse, Error>({
    queryKey: lessonKeys.detail(lessonId),
    queryFn: () => fetchLesson(lessonId),
    enabled: enabled && lessonId > 0,
    staleTime,
    retry,
    retryDelay: getRetryDelay,
    // Refetch on window focus for fresh data
    refetchOnWindowFocus: true,
    // Don't refetch on mount if data is fresh
    refetchOnMount: false,
  });
}

/**
 * Options for the useLessonPages hook
 */
interface UseLessonPagesOptions {
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
  /** Stale time in milliseconds (default: 5 minutes) */
  staleTime?: number;
  /** Number of retry attempts (default: 3) */
  retry?: number;
}

/**
 * Hook for fetching lesson pages with React Query
 *
 * Retrieves all pages in a lesson including question pages and branch tables.
 * Pages are returned in order based on their prevpageid/nextpageid links.
 *
 * Wraps: lesson->load_all_pages() from public/mod/lesson/locallib.php:2341-2348
 * API Endpoint: GET /api/v1/lesson/{id}/pages
 *
 * @param lessonId - The lesson ID to fetch pages for
 * @param options - Optional configuration for the query
 * @returns UseQueryResult with pages data, loading, and error states
 *
 * @example
 * ```typescript
 * const { data, isLoading } = useLessonPages(lessonId);
 *
 * if (isLoading) return <LoadingSpinner />;
 *
 * return (
 *   <PageNavigation
 *     pages={data.pages}
 *     totalCount={data.count}
 *   />
 * );
 * ```
 */
export function useLessonPages(
  lessonId: number,
  options?: UseLessonPagesOptions
): UseQueryResult<LessonPagesResponse, Error> {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    retry = DEFAULT_RETRY_COUNT,
  } = options ?? {};

  return useQuery<LessonPagesResponse, Error>({
    queryKey: lessonKeys.pages(lessonId),
    queryFn: () => fetchLessonPages(lessonId),
    enabled: enabled && lessonId > 0,
    staleTime,
    retry,
    retryDelay: getRetryDelay,
    refetchOnWindowFocus: false,
    // Pages are static, don't need frequent refetching
    refetchOnMount: false,
  });
}

/**
 * Options for the useLessonAttempts hook
 */
interface UseLessonAttemptsOptions {
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
  /** Stale time in milliseconds (default: 5 minutes) */
  staleTime?: number;
  /** Number of retry attempts (default: 3) */
  retry?: number;
}

/**
 * Hook for fetching user's lesson attempts with React Query
 *
 * Retrieves all attempts made by a user on the lesson, including
 * retry information and the last page seen.
 *
 * Wraps: lesson->get_attempts() from public/mod/lesson/locallib.php:1951-1963
 * API Endpoint: GET /api/v1/lesson/{id}/attempts
 *
 * @param lessonId - The lesson ID to fetch attempts for
 * @param userId - Optional user ID (defaults to current user)
 * @param options - Optional configuration for the query
 * @returns UseQueryResult with attempts data, loading, and error states
 *
 * @example
 * ```typescript
 * // Fetch current user's attempts
 * const { data } = useLessonAttempts(lessonId);
 *
 * // Fetch specific user's attempts (teachers viewing student progress)
 * const { data: studentAttempts } = useLessonAttempts(lessonId, studentId);
 *
 * console.log(`Completed ${data.retries} attempts`);
 * console.log(`Last page seen: ${data.lastpageseen}`);
 * ```
 */
export function useLessonAttempts(
  lessonId: number,
  userId?: number,
  options?: UseLessonAttemptsOptions
): UseQueryResult<LessonAttemptsResponse, Error> {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    retry = DEFAULT_RETRY_COUNT,
  } = options ?? {};

  return useQuery<LessonAttemptsResponse, Error>({
    queryKey: lessonKeys.attempts(lessonId, userId),
    queryFn: () => fetchLessonAttempts(lessonId, userId),
    enabled: enabled && lessonId > 0,
    staleTime,
    retry,
    retryDelay: getRetryDelay,
    // Refetch attempts when window regains focus
    refetchOnWindowFocus: true,
    // Always refetch on mount to get latest attempt state
    refetchOnMount: true,
  });
}

/**
 * Options for the useLessonTimer hook
 */
interface UseLessonTimerOptions {
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
  /** Stale time in milliseconds (default: 10 seconds) */
  staleTime?: number;
  /** Number of retry attempts (default: 3) */
  retry?: number;
  /** Polling interval in milliseconds (default: undefined - no polling) */
  refetchInterval?: number;
}

/**
 * Hook for fetching lesson timer information with React Query
 *
 * Retrieves timer information for a user's lesson attempts, including
 * the active timer and time remaining for timed lessons.
 *
 * Uses a shorter stale time (10 seconds) since timer data needs
 * frequent updates for accurate time tracking.
 *
 * Wraps: lesson->get_user_timers() from public/mod/lesson/locallib.php:3159-3168
 * API Endpoint: GET /api/v1/lesson/{id}/timer
 *
 * @param lessonId - The lesson ID to fetch timer for
 * @param userId - Optional user ID (defaults to current user)
 * @param options - Optional configuration for the query
 * @returns UseQueryResult with timer data, loading, and error states
 *
 * @example
 * ```typescript
 * // Basic usage
 * const { data: timer } = useLessonTimer(lessonId);
 *
 * // With polling for active timers
 * const { data: timer } = useLessonTimer(lessonId, undefined, {
 *   refetchInterval: 1000, // Poll every second
 * });
 *
 * if (timer.timeRemaining) {
 *   console.log(`Time remaining: ${timer.timeRemaining} seconds`);
 * }
 * ```
 */
export function useLessonTimer(
  lessonId: number,
  userId?: number,
  options?: UseLessonTimerOptions
): UseQueryResult<LessonTimerResponse, Error> {
  const {
    enabled = true,
    staleTime = TIMER_STALE_TIME,
    retry = DEFAULT_RETRY_COUNT,
    refetchInterval,
  } = options ?? {};

  return useQuery<LessonTimerResponse, Error>({
    queryKey: lessonKeys.timer(lessonId, userId),
    queryFn: () => fetchLessonTimer(lessonId, userId),
    enabled: enabled && lessonId > 0,
    staleTime,
    retry,
    retryDelay: getRetryDelay,
    // Enable polling if refetchInterval is provided
    refetchInterval,
    // Always refetch timer on focus for accurate time
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

/**
 * Options for the useLessonProgress hook
 */
interface UseLessonProgressOptions {
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
  /** Stale time in milliseconds (default: 5 minutes) */
  staleTime?: number;
  /** Number of retry attempts (default: 3) */
  retry?: number;
}

/**
 * Hook for fetching user's lesson progress with React Query
 *
 * Retrieves comprehensive progress information including visited pages,
 * completion percentage, score, and time spent.
 *
 * Wraps multiple Moodle functions:
 * - lesson->count_user_retries() from public/mod/lesson/locallib.php:3030-3034
 * - lesson->get_last_page_seen() from public/mod/lesson/locallib.php:2970-3021
 *
 * API Endpoint: GET /api/v1/lesson/{id}/progress
 *
 * @param lessonId - The lesson ID to fetch progress for
 * @param userId - Optional user ID (defaults to current user)
 * @param options - Optional configuration for the query
 * @returns UseQueryResult with progress data, loading, and error states
 *
 * @example
 * ```typescript
 * const { data: progress } = useLessonProgress(lessonId);
 *
 * return (
 *   <ProgressBar
 *     current={progress.pagesCompleted}
 *     total={progress.totalPages}
 *     percentage={progress.progressPercentage}
 *   />
 * );
 * ```
 */
export function useLessonProgress(
  lessonId: number,
  userId?: number,
  options?: UseLessonProgressOptions
): UseQueryResult<LessonProgressResponse, Error> {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    retry = DEFAULT_RETRY_COUNT,
  } = options ?? {};

  return useQuery<LessonProgressResponse, Error>({
    queryKey: lessonKeys.progress(lessonId, userId),
    queryFn: () => fetchLessonProgress(lessonId, userId),
    enabled: enabled && lessonId > 0,
    staleTime,
    retry,
    retryDelay: getRetryDelay,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

// ============================================================================
// Cache Invalidation Utilities
// ============================================================================

/**
 * Hook for accessing the query client for cache invalidation
 *
 * Use this to invalidate lesson queries after mutations (e.g., after
 * submitting an answer or completing a lesson).
 *
 * @returns QueryClient instance for cache management
 *
 * @example
 * ```typescript
 * const queryClient = useLessonQueryClient();
 *
 * // Invalidate all lesson data for a specific lesson
 * queryClient.invalidateQueries({ queryKey: lessonKeys.detail(lessonId) });
 *
 * // Invalidate attempts after submitting an answer
 * queryClient.invalidateQueries({ queryKey: lessonKeys.attempts(lessonId) });
 *
 * // Invalidate all lesson-related queries
 * queryClient.invalidateQueries({ queryKey: lessonKeys.all });
 * ```
 */
export function useLessonQueryClient(): QueryClient {
  return useQueryClient();
}

/**
 * Utility function to invalidate all queries for a specific lesson
 *
 * Useful after completing a lesson or major state changes.
 *
 * @param queryClient - The QueryClient instance
 * @param lessonId - The lesson ID to invalidate queries for
 *
 * @example
 * ```typescript
 * const queryClient = useLessonQueryClient();
 *
 * // After completing a lesson
 * await invalidateLessonQueries(queryClient, lessonId);
 * ```
 */
export async function invalidateLessonQueries(
  queryClient: QueryClient,
  lessonId: number
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: lessonKeys.detail(lessonId) }),
    queryClient.invalidateQueries({ queryKey: lessonKeys.pages(lessonId) }),
    queryClient.invalidateQueries({ queryKey: lessonKeys.attempts(lessonId) }),
    queryClient.invalidateQueries({ queryKey: lessonKeys.timer(lessonId) }),
    queryClient.invalidateQueries({ queryKey: lessonKeys.progress(lessonId) }),
  ]);
}

/**
 * Utility function to prefetch lesson data
 *
 * Can be used to prefetch lesson data before navigation for
 * improved perceived performance.
 *
 * @param queryClient - The QueryClient instance
 * @param lessonId - The lesson ID to prefetch
 *
 * @example
 * ```typescript
 * const queryClient = useLessonQueryClient();
 *
 * // Prefetch on hover
 * const handleLessonHover = (lessonId: number) => {
 *   prefetchLessonData(queryClient, lessonId);
 * };
 * ```
 */
export async function prefetchLessonData(
  queryClient: QueryClient,
  lessonId: number
): Promise<void> {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: lessonKeys.detail(lessonId),
      queryFn: () => fetchLesson(lessonId),
      staleTime: DEFAULT_STALE_TIME,
    }),
    queryClient.prefetchQuery({
      queryKey: lessonKeys.pages(lessonId),
      queryFn: () => fetchLessonPages(lessonId),
      staleTime: DEFAULT_STALE_TIME,
    }),
  ]);
}

// ============================================================================
// Combined Hooks
// ============================================================================

/**
 * Combined lesson data result type
 */
interface LessonData {
  /** Lesson details */
  lesson: LessonDetailsResponse | undefined;
  /** Lesson pages */
  pages: LessonPagesResponse | undefined;
  /** User attempts */
  attempts: LessonAttemptsResponse | undefined;
  /** Timer information */
  timer: LessonTimerResponse | undefined;
  /** Overall loading state */
  isLoading: boolean;
  /** Whether any query has an error */
  isError: boolean;
  /** Combined error from any failing query */
  error: Error | null;
  /** Whether all queries have completed successfully */
  isSuccess: boolean;
}

/**
 * Options for the useLessonData hook
 */
interface UseLessonDataOptions {
  /** Whether to fetch attempts (default: true) */
  includeAttempts?: boolean;
  /** Whether to fetch timer (default: false) */
  includeTimer?: boolean;
  /** User ID for user-specific data (default: current user) */
  userId?: number;
}

/**
 * Combined hook for fetching all lesson-related data
 *
 * Fetches lesson details, pages, and optionally attempts and timer
 * information in parallel using React Query.
 *
 * @param lessonId - The lesson ID to fetch data for
 * @param options - Optional configuration
 * @returns Combined lesson data with loading and error states
 *
 * @example
 * ```typescript
 * const { lesson, pages, attempts, isLoading, error } = useLessonData(lessonId, {
 *   includeAttempts: true,
 *   includeTimer: true,
 * });
 *
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return (
 *   <LessonPlayer
 *     lesson={lesson}
 *     pages={pages?.pages}
 *     attempts={attempts}
 *   />
 * );
 * ```
 */
export function useLessonData(
  lessonId: number,
  options?: UseLessonDataOptions
): LessonData {
  const {
    includeAttempts = true,
    includeTimer = false,
    userId,
  } = options ?? {};

  const lessonQuery = useLesson(lessonId);
  const pagesQuery = useLessonPages(lessonId);
  const attemptsQuery = useLessonAttempts(lessonId, userId, {
    enabled: includeAttempts,
  });
  const timerQuery = useLessonTimer(lessonId, userId, {
    enabled: includeTimer,
  });

  // Calculate combined loading state
  const isLoading =
    lessonQuery.isLoading ||
    pagesQuery.isLoading ||
    (includeAttempts && attemptsQuery.isLoading) ||
    (includeTimer && timerQuery.isLoading);

  // Calculate combined error state
  const isError =
    lessonQuery.isError ||
    pagesQuery.isError ||
    (includeAttempts && attemptsQuery.isError) ||
    (includeTimer && timerQuery.isError);

  // Get first error
  const error =
    lessonQuery.error ??
    pagesQuery.error ??
    (includeAttempts ? attemptsQuery.error : null) ??
    (includeTimer ? timerQuery.error : null);

  // Calculate combined success state
  const isSuccess =
    lessonQuery.isSuccess &&
    pagesQuery.isSuccess &&
    (!includeAttempts || attemptsQuery.isSuccess) &&
    (!includeTimer || timerQuery.isSuccess);

  return {
    lesson: lessonQuery.data,
    pages: pagesQuery.data,
    attempts: includeAttempts ? attemptsQuery.data : undefined,
    timer: includeTimer ? timerQuery.data : undefined,
    isLoading,
    isError,
    error,
    isSuccess,
  };
}
