/**
 * Custom React Query hook for fetching feedback summary statistics
 *
 * This hook provides access to feedback summary data including:
 * - Completion rate and total responses
 * - Respondent count and group-based metrics
 * - Anonymous response statistics
 *
 * Wraps GET /api/v1/feedback/{id}/summary endpoint which calls existing
 * Moodle feedback summary functions (mod_feedback_structure::count_completed_responses)
 *
 * @module features/activities/feedback/hooks/useFeedbackSummary
 */

import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';

/**
 * Interface representing feedback summary statistics
 */
export interface FeedbackSummary {
  /** Total number of completed responses */
  completedCount: number;

  /** Number of feedback items/questions */
  itemsCount: number;

  /** Total number of responses (same as completedCount for feedback) */
  totalResponses: number;

  /** Number of unique respondents */
  respondentCount: number;

  /** Completion rate as a percentage (0-100) */
  completionRate: number;

  /** Number of enrolled users eligible to complete the feedback */
  enrolledUsersCount: number;

  /** Whether the feedback is anonymous */
  isAnonymous: boolean;

  /** Group ID if filtered by group, null otherwise */
  groupId: number | null;

  /** Group name if filtered by group, null otherwise */
  groupName: string | null;

  /** Whether there are sufficient responses for anonymous feedback in the group */
  sufficientAnonymousResponses: boolean;

  /** Minimum anonymous count required for displaying results in groups */
  minAnonymousCount: number;
}

/**
 * Parameters for the useFeedbackSummary hook
 */
export interface UseFeedbackSummaryParams {
  /** The feedback activity ID */
  feedbackId: number;

  /** Optional group ID for filtering results by group */
  groupId?: number | null;

  /** Optional course ID for multi-course feedback contexts */
  courseId?: number | null;
}

/**
 * API response from GET /api/v1/feedback/{id}/summary
 */
interface FeedbackSummaryApiResponse {
  success: boolean;
  data: FeedbackSummary;
}

/**
 * Fetches feedback summary statistics from the API
 *
 * @param feedbackId - The feedback activity ID
 * @param groupId - Optional group ID for filtering
 * @param courseId - Optional course ID for context
 * @returns Promise resolving to feedback summary data
 */
async function fetchFeedbackSummary(
  feedbackId: number,
  groupId?: number | null,
  courseId?: number | null
): Promise<FeedbackSummary> {
  // Build query parameters
  const params = new URLSearchParams();

  if (groupId !== null && groupId !== undefined && groupId > 0) {
    params.append('groupId', groupId.toString());
  }

  if (courseId !== null && courseId !== undefined && courseId > 0) {
    params.append('courseId', courseId.toString());
  }

  const queryString = params.toString();
  const url = `/api/v1/feedback/${feedbackId}/summary${queryString ? `?${queryString}` : ''}`;

  // Import API client at runtime to avoid circular dependencies
  const { apiClient } = await import('@/services/api/client');

  const response = await apiClient.get<FeedbackSummaryApiResponse>(url);

  if (!response.data.success) {
    throw new Error('Failed to fetch feedback summary');
  }

  return response.data.data;
}

/**
 * React Query hook for fetching feedback summary statistics
 *
 * This hook manages the fetching, caching, and updating of feedback summary data
 * including completion rates, response counts, and group-based metrics.
 *
 * @param params - Hook parameters including feedbackId and optional groupId
 * @param options - Optional React Query configuration options
 * @returns React Query result containing feedback summary data and query state
 *
 * @example
 * ```tsx
 * function FeedbackSummaryWidget({ feedbackId }: { feedbackId: number }) {
 *   const { data: summary, isLoading, error } = useFeedbackSummary({
 *     feedbackId,
 *     groupId: selectedGroupId
 *   });
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <h3>Summary Statistics</h3>
 *       <p>Completed: {summary.completedCount} / {summary.enrolledUsersCount}</p>
 *       <p>Completion Rate: {summary.completionRate.toFixed(1)}%</p>
 *       <p>Questions: {summary.itemsCount}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With group filtering
 * function GroupFeedbackSummary({ feedbackId, groupId }: Props) {
 *   const { data: summary } = useFeedbackSummary({
 *     feedbackId,
 *     groupId
 *   }, {
 *     enabled: groupId > 0,
 *     staleTime: 5 * 60 * 1000 // 5 minutes
 *   });
 *
 *   if (!summary) return null;
 *
 *   if (!summary.sufficientAnonymousResponses) {
 *     return <Alert>Insufficient responses for anonymous feedback in this group</Alert>;
 *   }
 *
 *   return <SummaryDisplay summary={summary} />;
 * }
 * ```
 */
export function useFeedbackSummary(
  params: UseFeedbackSummaryParams,
  options?: Omit<UseQueryOptions<FeedbackSummary, Error>, 'queryKey' | 'queryFn'>
): UseQueryResult<FeedbackSummary, Error> {
  const { feedbackId, groupId = null, courseId = null } = params;

  return useQuery<FeedbackSummary, Error>({
    // Query key includes all parameters that affect the data
    queryKey: ['feedback', feedbackId, 'summary', groupId ?? 'all', courseId ?? 'default'],

    // Query function calls the API
    queryFn: () => fetchFeedbackSummary(feedbackId, groupId, courseId),

    // Default options optimized for summary data
    staleTime: 2 * 60 * 1000, // 2 minutes - summary data changes relatively slowly
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for navigation

    // Only fetch if we have a valid feedback ID
    enabled: feedbackId > 0,

    // Retry on failure with exponential backoff
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),

    // Merge with user-provided options
    ...options,
  });
}

/**
 * Type guard to check if a value is a valid FeedbackSummary
 *
 * @param value - The value to check
 * @returns True if the value is a valid FeedbackSummary
 */
export function isFeedbackSummary(value: unknown): value is FeedbackSummary {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const summary = value as Record<string, unknown>;

  return (
    typeof summary.completedCount === 'number' &&
    typeof summary.itemsCount === 'number' &&
    typeof summary.totalResponses === 'number' &&
    typeof summary.respondentCount === 'number' &&
    typeof summary.completionRate === 'number' &&
    typeof summary.enrolledUsersCount === 'number' &&
    typeof summary.isAnonymous === 'boolean' &&
    (summary.groupId === null || typeof summary.groupId === 'number') &&
    (summary.groupName === null || typeof summary.groupName === 'string') &&
    typeof summary.sufficientAnonymousResponses === 'boolean' &&
    typeof summary.minAnonymousCount === 'number'
  );
}
