/**
 * Custom React Query hook for fetching and managing feedback analysis data
 *
 * Provides aggregated analysis results for all feedback items including:
 * - Response counts and statistics
 * - Group-filtered analysis
 * - Anonymous protection validation
 * - Per-item analysis data
 *
 * Wraps GET /api/v1/feedback/{id}/analysis endpoint that calls existing
 * Moodle feedback analysis functions (mod_feedback_structure methods).
 *
 * @module useFeedbackAnalysis
 */

import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';

/**
 * Represents a single feedback item's analysis data
 */
interface FeedbackItemAnalysis {
  /** Unique item ID */
  id: number;
  /** Item type (e.g., 'multichoice', 'numeric', 'textarea') */
  type: string;
  /** Item question/label */
  name: string;
  /** Item number for display (if autonumbering enabled) */
  itemNumber: number | null;
  /** Position in feedback */
  position: number;
  /** Whether this item is required */
  required: boolean;
  /** Analysis results specific to item type */
  analysisData: {
    /** Number of responses for this item */
    responseCount: number;
    /** For choice-based items: response distribution */
    choices?: Array<{
      value: string;
      label: string;
      count: number;
      percentage: number;
    }>;
    /** For numeric items: statistical data */
    statistics?: {
      min: number;
      max: number;
      mean: number;
      median: number;
      stdDev: number;
      sum: number;
    };
    /** For text items: sample responses (limited for privacy) */
    textResponses?: Array<{
      id: number;
      response: string;
      /** Random response number for anonymous feedback */
      responseNumber?: number;
    }>;
  };
}

/**
 * Summary statistics for the entire feedback
 */
interface FeedbackAnalysisSummary {
  /** Total number of completed responses */
  totalResponses: number;
  /** Number of started but incomplete responses */
  incompleteResponses: number;
  /** Number of responses in selected group (if filtered) */
  groupResponses?: number;
  /** Time period statistics */
  timeStats: {
    /** First response timestamp */
    firstResponseTime: number | null;
    /** Most recent response timestamp */
    lastResponseTime: number | null;
    /** Average completion time in seconds */
    avgCompletionTime: number | null;
  };
}

/**
 * Anonymous protection status
 */
interface AnonymousProtection {
  /** Whether feedback is anonymous */
  isAnonymous: boolean;
  /** Whether sufficient responses exist for group analysis */
  sufficientResponses: boolean;
  /** Minimum required responses for anonymous group analysis */
  minimumRequired: number;
  /** Actual response count in current context */
  actualCount: number;
  /** Warning message if insufficient responses */
  warningMessage?: string;
}

/**
 * Complete feedback analysis data returned from API
 */
interface FeedbackAnalysisData {
  /** Feedback activity ID */
  feedbackId: number;
  /** Feedback activity name */
  feedbackName: string;
  /** Course ID */
  courseId: number;
  /** Summary statistics */
  summary: FeedbackAnalysisSummary;
  /** Anonymous protection status */
  anonymousProtection: AnonymousProtection;
  /** Analysis data for each item */
  items: FeedbackItemAnalysis[];
  /** Currently applied group filter (0 = all) */
  groupId: number;
  /** Group name if filtered */
  groupName?: string;
  /** Whether user can export to Excel */
  canExport: boolean;
  /** Whether analysis is viewable */
  canViewAnalysis: boolean;
}

/**
 * API response envelope for feedback analysis
 */
interface FeedbackAnalysisResponse {
  success: boolean;
  data: FeedbackAnalysisData;
  meta?: {
    /** Timestamp of data generation */
    generatedAt: number;
  };
}

/**
 * Error response from API
 */
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Options for useFeedbackAnalysis hook
 */
interface UseFeedbackAnalysisOptions {
  /** Feedback activity ID */
  feedbackId: number;
  /** Optional group ID for filtering (0 = all groups) */
  groupId?: number;
  /** Enable/disable automatic refetching */
  enabled?: boolean;
  /** Custom stale time in milliseconds (default: 5 minutes) */
  staleTime?: number;
  /** Custom garbage collection time in milliseconds (default: 10 minutes) */
  gcTime?: number;
  /** Refetch on window focus */
  refetchOnWindowFocus?: boolean;
  /** Refetch interval in milliseconds (null = no interval) */
  refetchInterval?: number | false;
}

/**
 * Fetches feedback analysis data from the API
 *
 * @param feedbackId - Feedback activity ID
 * @param groupId - Optional group ID for filtering
 * @returns Promise resolving to feedback analysis data
 * @throws {Error} When API request fails or returns error response
 */
const fetchFeedbackAnalysis = async (
  feedbackId: number,
  groupId: number = 0
): Promise<FeedbackAnalysisData> => {
  try {
    // Build query parameters
    const params: Record<string, string | number> = {};
    if (groupId > 0) {
      params.groupid = groupId;
    }

    // Make API request
    // Note: apiClient already has baseURL set to /api/v1 or http://localhost:8000/api/v1
    // Use relative path (no leading slash) so Axios appends it to baseURL correctly
    const response = await apiClient.get<FeedbackAnalysisResponse>(
      `feedback/${feedbackId}/analysis`,
      { params }
    );

    // Validate response structure
    if (!response.data || !response.data.success) {
      const errorResponse = response.data as unknown as ApiErrorResponse;
      throw new Error(errorResponse?.error?.message || 'Failed to fetch feedback analysis');
    }

    // Return analysis data
    return response.data.data;
  } catch (error) {
    // Handle different error types
    if (error instanceof Error) {
      throw error;
    }

    // Handle axios errors
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const axiosError = error as {
        response?: {
          data?: ApiErrorResponse;
          status?: number;
        };
      };

      if (axiosError.response?.data?.error) {
        throw new Error(axiosError.response.data.error.message);
      }

      if (axiosError.response?.status === 403) {
        throw new Error('You do not have permission to view feedback analysis');
      }

      if (axiosError.response?.status === 404) {
        throw new Error('Feedback activity not found');
      }
    }

    // Generic error fallback
    throw new Error('An unexpected error occurred while fetching feedback analysis');
  }
};

/**
 * Custom React Query hook for fetching and managing feedback analysis data
 *
 * Provides aggregated analysis results for all feedback items including response
 * counts, statistics, and group-filtered analysis. Implements intelligent caching
 * to minimize API calls while keeping data fresh.
 *
 * @param options - Configuration options for the hook
 * @returns React Query result with feedback analysis data and query state
 *
 * @example
 * ```tsx
 * // Basic usage - fetch all responses
 * const { data, isLoading, error } = useFeedbackAnalysis({
 *   feedbackId: 42
 * });
 *
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorAlert error={error} />;
 *
 * return (
 *   <div>
 *     <h2>{data.feedbackName} Analysis</h2>
 *     <p>Total Responses: {data.summary.totalResponses}</p>
 *     {data.items.map(item => (
 *       <ItemAnalysis key={item.id} item={item} />
 *     ))}
 *   </div>
 * );
 * ```
 *
 * @example
 * ```tsx
 * // Group-filtered analysis
 * const [selectedGroup, setSelectedGroup] = useState<number>(0);
 *
 * const { data, isLoading } = useFeedbackAnalysis({
 *   feedbackId: 42,
 *   groupId: selectedGroup
 * });
 *
 * // Check anonymous protection
 * if (data && !data.anonymousProtection.sufficientResponses) {
 *   return (
 *     <Alert severity="warning">
 *       {data.anonymousProtection.warningMessage}
 *     </Alert>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With custom caching and refetch configuration
 * const { data, refetch } = useFeedbackAnalysis({
 *   feedbackId: 42,
 *   staleTime: 2 * 60 * 1000, // 2 minutes
 *   gcTime: 5 * 60 * 1000, // 5 minutes (garbage collection time)
 *   refetchOnWindowFocus: true,
 *   refetchInterval: 30000 // Refetch every 30 seconds
 * });
 *
 * // Manual refetch on button click
 * const handleRefresh = () => {
 *   refetch();
 * };
 * ```
 */
export function useFeedbackAnalysis(
  options: UseFeedbackAnalysisOptions
): UseQueryResult<FeedbackAnalysisData, Error> {
  const {
    feedbackId,
    groupId = 0,
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes default
    gcTime = 10 * 60 * 1000, // 10 minutes default
    refetchOnWindowFocus = false,
    refetchInterval = false,
  } = options;

  // Validate feedbackId
  if (!feedbackId || feedbackId <= 0) {
    throw new Error('feedbackId must be a positive number');
  }

  // Validate groupId
  if (groupId < 0) {
    throw new Error('groupId must be non-negative (0 for all groups)');
  }

  return useQuery<
    FeedbackAnalysisData,
    Error,
    FeedbackAnalysisData,
    readonly [string, number, string, number]
  >({
    // Query key includes feedbackId and groupId for proper caching
    queryKey: ['feedback', feedbackId, 'analysis', groupId] as const,

    // Query function
    queryFn: () => fetchFeedbackAnalysis(feedbackId, groupId),

    // Caching configuration
    staleTime,
    gcTime,

    // Refetch configuration
    enabled,
    refetchOnWindowFocus,
    refetchInterval,

    // Retry configuration - retry failed requests up to 2 times
    retry: (failureCount, error) => {
      // Don't retry on permission or not found errors
      if (error.message.includes('permission') || error.message.includes('not found')) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },

    // Retry delay - exponential backoff
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Note: keepPreviousData was renamed to placeholderData in React Query v5
    // Using default behavior which is similar

    // Mark data as stale on error but keep it in cache
    throwOnError: false,

    // Meta information for debugging
    meta: {
      errorMessage: 'Failed to load feedback analysis data',
    },
  });
}

/**
 * Type guard to check if analysis data has sufficient responses for display
 *
 * @param data - Feedback analysis data
 * @returns True if analysis can be displayed, false if blocked by anonymous protection
 */
export function canDisplayAnalysis(
  data: FeedbackAnalysisData | undefined
): data is FeedbackAnalysisData {
  if (!data) {
    return false;
  }

  // If anonymous feedback, check if sufficient responses exist
  if (data.anonymousProtection.isAnonymous) {
    return data.anonymousProtection.sufficientResponses;
  }

  // Non-anonymous feedback can always be displayed (if user has permission)
  return data.canViewAnalysis;
}

/**
 * Helper function to calculate response rate
 *
 * @param data - Feedback analysis data
 * @param totalEnrolled - Total number of enrolled users (optional)
 * @returns Response rate as percentage (0-100), or null if totalEnrolled not provided
 */
export function calculateResponseRate(
  data: FeedbackAnalysisData,
  totalEnrolled?: number
): number | null {
  if (!totalEnrolled || totalEnrolled <= 0) {
    return null;
  }

  const responses = data.summary.groupResponses ?? data.summary.totalResponses;
  return Math.round((responses / totalEnrolled) * 100 * 10) / 10; // Round to 1 decimal
}

/**
 * Export types for use in other components
 */
export type {
  FeedbackAnalysisData,
  FeedbackAnalysisSummary,
  FeedbackItemAnalysis,
  AnonymousProtection,
  UseFeedbackAnalysisOptions,
};
