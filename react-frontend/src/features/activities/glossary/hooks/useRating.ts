/**
 * Glossary Entry Rating Hooks
 *
 * React Query hooks for glossary entry rating functionality. Provides hooks for
 * fetching rating statistics (average, count, user's rating) and submitting/updating
 * ratings with optimistic UI updates.
 *
 * Features:
 * - Fetch rating statistics for glossary entries
 * - Submit user ratings with optimistic updates
 * - Cache invalidation for real-time consistency
 * - Support for different rating scales (e.g., 1-5, 1-10, 1-100)
 * - Error handling for invalid ratings and permission issues
 *
 * Based on Moodle's rating system (mdl_rating table) and mod_glossary rating capabilities.
 *
 * @module features/activities/glossary/hooks/useRating
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';

import { getEntryRatings, rateEntry } from '@/features/activities/glossary/api/glossaryApi';
import type { RatingStats, RateEntryInput } from '@/features/activities/glossary/types/glossary.types';
import type { Id } from '@/types/common';

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Factory for generating consistent query keys for rating data.
 * These keys are used for caching and cache invalidation.
 */
export const ratingQueryKeys = {
  /**
   * Base key for all rating-related queries
   */
  all: ['glossary', 'ratings'] as const,

  /**
   * Key for a specific entry's ratings
   * @param entryId - The glossary entry ID
   */
  entry: (entryId: Id) => ['glossary', 'entry', entryId, 'ratings'] as const,
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useEntryRatings hook
 */
export interface UseEntryRatingsOptions {
  /**
   * Whether the query should be enabled.
   * Set to false to disable automatic fetching (e.g., when entry doesn't exist yet)
   */
  enabled?: boolean;

  /**
   * How long the data is considered fresh (in milliseconds).
   * During this time, refetches won't occur on component remount.
   * @default 30000 (30 seconds)
   */
  staleTime?: number;

  /**
   * Whether to refetch the query on window focus.
   * Useful for keeping ratings up-to-date when user returns to the tab.
   * @default true
   */
  refetchOnWindowFocus?: boolean;
}

/**
 * Options for the useRateEntry mutation hook
 */
export interface UseRateEntryOptions {
  /**
   * Callback fired on successful rating submission.
   * Receives the updated rating statistics.
   */
  onSuccess?: (data: RatingStats, variables: RateEntryInput) => void;

  /**
   * Callback fired when rating submission fails.
   * Receives the error object and the attempted input.
   */
  onError?: (error: Error, variables: RateEntryInput) => void;

  /**
   * Callback fired after mutation completes (success or error).
   */
  onSettled?: () => void;
}

/**
 * Error types specific to rating operations
 */
export type RatingErrorCode =
  | 'RATING_DISABLED'
  | 'INVALID_RATING'
  | 'OUT_OF_SCALE'
  | 'PERMISSION_DENIED'
  | 'ENTRY_NOT_FOUND'
  | 'OWN_ENTRY'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Extended error for rating operations with error code
 */
export interface RatingError extends Error {
  code?: RatingErrorCode;
  details?: {
    minRating?: number;
    maxRating?: number;
    scaleid?: number;
    requiredCapability?: string;
  };
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching rating statistics for a glossary entry.
 *
 * Fetches rating data including:
 * - Average rating value
 * - Total number of ratings
 * - Sum of all ratings
 * - Current user's rating (if they have rated the entry)
 *
 * Uses React Query for automatic caching, background updates, and error handling.
 *
 * @param entryId - The glossary entry ID to fetch ratings for
 * @param options - Optional configuration for the query
 * @returns React Query result object with rating statistics data
 *
 * @example
 * ```tsx
 * function EntryRating({ entryId }: { entryId: number }) {
 *   const { data: ratings, isLoading, error } = useEntryRatings(entryId);
 *
 *   if (isLoading) return <Skeleton />;
 *   if (error) return <Alert severity="error">Failed to load ratings</Alert>;
 *   if (!ratings) return null;
 *
 *   return (
 *     <Box>
 *       <Typography>Average: {ratings.average.toFixed(1)}</Typography>
 *       <Typography>Total ratings: {ratings.count}</Typography>
 *       {ratings.userRating && (
 *         <Typography>Your rating: {ratings.userRating}</Typography>
 *       )}
 *     </Box>
 *   );
 * }
 * ```
 */
export function useEntryRatings(
  entryId: Id,
  options: UseEntryRatingsOptions = {}
): UseQueryResult<RatingStats, RatingError> {
  const {
    enabled = true,
    staleTime = 30000, // 30 seconds default stale time
    refetchOnWindowFocus = true,
  } = options;

  return useQuery<RatingStats, RatingError>({
    queryKey: ratingQueryKeys.entry(entryId),
    queryFn: async () => {
      try {
        const stats = await getEntryRatings(entryId);
        return stats;
      } catch (error) {
        // Transform error to RatingError with proper code
        const ratingError = transformToRatingError(error);
        throw ratingError;
      }
    },
    enabled: enabled && entryId > 0,
    staleTime,
    refetchOnWindowFocus,
    // Keep previous data while fetching new data to prevent UI flicker
    placeholderData: (previousData) => previousData,
    // Retry failed requests up to 3 times with exponential backoff
    retry: (failureCount, error) => {
      // Don't retry on permission errors or validation errors
      if (
        error.code === 'PERMISSION_DENIED' ||
        error.code === 'ENTRY_NOT_FOUND' ||
        error.code === 'RATING_DISABLED'
      ) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * Hook for submitting or updating a rating for a glossary entry.
 *
 * Features:
 * - Optimistic updates for immediate UI feedback
 * - Automatic cache invalidation on success
 * - Rollback on error to restore previous state
 * - Scale validation (rating must be within configured scale)
 *
 * The mutation automatically handles:
 * - Permission checking (mod/glossary:rate capability)
 * - Scale range validation
 * - Prevention of self-rating
 *
 * @param options - Optional callbacks for success, error, and settled states
 * @returns React Query mutation result with mutate function and status
 *
 * @example
 * ```tsx
 * function RatingInput({ entryId, scaleid }: { entryId: number; scaleid: number }) {
 *   const { mutate: rate, isPending } = useRateEntry({
 *     onSuccess: (newStats) => {
 *       toast.success(`Rating submitted! New average: ${newStats.average.toFixed(1)}`);
 *     },
 *     onError: (error) => {
 *       if (error.code === 'OWN_ENTRY') {
 *         toast.error('You cannot rate your own entries');
 *       } else if (error.code === 'OUT_OF_SCALE') {
 *         toast.error('Rating must be within the valid range');
 *       } else {
 *         toast.error('Failed to submit rating');
 *       }
 *     },
 *   });
 *
 *   const handleRate = (value: number) => {
 *     rate({ entryId, rating: value, scaleid });
 *   };
 *
 *   return (
 *     <Rating
 *       onChange={(_, value) => value && handleRate(value)}
 *       disabled={isPending}
 *     />
 *   );
 * }
 * ```
 */
export function useRateEntry(
  options: UseRateEntryOptions = {}
): UseMutationResult<RatingStats, RatingError, RateEntryInput> {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled } = options;

  return useMutation<RatingStats, RatingError, RateEntryInput, { previousRatings?: RatingStats }>({
    mutationFn: async (input: RateEntryInput) => {
      // Validate input before sending to server
      validateRatingInput(input);

      try {
        const result = await rateEntry(input);
        return result;
      } catch (error) {
        const ratingError = transformToRatingError(error);
        throw ratingError;
      }
    },

    // Optimistic update: Update the UI immediately before server confirms
    onMutate: async (newRating) => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ratingQueryKeys.entry(newRating.entryId),
      });

      // Snapshot the previous value for rollback
      const previousRatings = queryClient.getQueryData<RatingStats>(
        ratingQueryKeys.entry(newRating.entryId)
      );

      // Optimistically update to the new value
      if (previousRatings) {
        const optimisticStats = calculateOptimisticRating(
          previousRatings,
          newRating.rating
        );

        queryClient.setQueryData<RatingStats>(
          ratingQueryKeys.entry(newRating.entryId),
          optimisticStats
        );
      }

      // Return context object with snapshotted value for rollback
      return { previousRatings };
    },

    // On error, roll back to the previous value
    onError: (error, variables, context) => {
      // Rollback to previous data on error
      if (context?.previousRatings) {
        queryClient.setQueryData<RatingStats>(
          ratingQueryKeys.entry(variables.entryId),
          context.previousRatings
        );
      }

      // Call user-provided error handler
      onError?.(error, variables);
    },

    // On success, update cache with actual server data
    onSuccess: (data, variables) => {
      // Update cache with server response (more accurate than optimistic)
      queryClient.setQueryData<RatingStats>(
        ratingQueryKeys.entry(variables.entryId),
        data
      );

      // Also invalidate to ensure we have fresh data
      void queryClient.invalidateQueries({
        queryKey: ratingQueryKeys.entry(variables.entryId),
      });

      // Invalidate related entry queries that might include rating data
      void queryClient.invalidateQueries({
        queryKey: ['glossary', 'entry', variables.entryId],
        exact: false,
      });

      // Call user-provided success handler
      onSuccess?.(data, variables);
    },

    // Always refetch after error or success
    onSettled: () => {
      onSettled?.();
    },

    // Retry configuration for mutations
    retry: (failureCount, error) => {
      // Don't retry on validation or permission errors
      if (
        error.code === 'PERMISSION_DENIED' ||
        error.code === 'INVALID_RATING' ||
        error.code === 'OUT_OF_SCALE' ||
        error.code === 'OWN_ENTRY' ||
        error.code === 'RATING_DISABLED'
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates rating input before submission.
 * Throws a RatingError if validation fails.
 *
 * @param input - The rating input to validate
 * @throws {RatingError} If validation fails
 */
function validateRatingInput(input: RateEntryInput): void {
  if (!input.entryId || input.entryId <= 0) {
    const error: RatingError = new Error('Invalid entry ID');
    error.code = 'INVALID_RATING';
    throw error;
  }

  if (typeof input.rating !== 'number' || isNaN(input.rating)) {
    const error: RatingError = new Error('Rating must be a valid number');
    error.code = 'INVALID_RATING';
    throw error;
  }

  if (!input.scaleid || input.scaleid === 0) {
    const error: RatingError = new Error('Scale ID is required');
    error.code = 'INVALID_RATING';
    throw error;
  }

  // For positive scales (e.g., 1-5, 1-100), rating must be positive
  if (input.scaleid > 0 && (input.rating < 1 || input.rating > input.scaleid)) {
    const error: RatingError = new Error(
      `Rating must be between 1 and ${input.scaleid}`
    );
    error.code = 'OUT_OF_SCALE';
    error.details = {
      minRating: 1,
      maxRating: input.scaleid,
      scaleid: input.scaleid,
    };
    throw error;
  }
}

/**
 * Calculates optimistic rating statistics after a new rating is submitted.
 *
 * If the user already has a rating, it updates the average accounting for
 * the change. If it's a new rating, it adds to the count and recalculates.
 *
 * @param current - Current rating statistics
 * @param newRating - The new rating value being submitted
 * @returns Updated rating statistics (optimistic)
 */
function calculateOptimisticRating(
  current: RatingStats,
  newRating: number
): RatingStats {
  const { count, sum, userRating } = current;

  // User is updating their existing rating
  if (userRating !== undefined && userRating !== null) {
    const newSum = sum - userRating + newRating;
    const newAverage = count > 0 ? newSum / count : newRating;

    return {
      average: newAverage,
      count,
      sum: newSum,
      userRating: newRating,
    };
  }

  // User is submitting a new rating
  const newCount = count + 1;
  const newSum = sum + newRating;
  const newAverage = newSum / newCount;

  return {
    average: newAverage,
    count: newCount,
    sum: newSum,
    userRating: newRating,
  };
}

/**
 * Transforms an unknown error into a structured RatingError.
 *
 * Maps common error messages and HTTP status codes to RatingErrorCode values
 * for consistent error handling in the UI.
 *
 * @param error - The error to transform
 * @returns A RatingError with appropriate code and message
 */
function transformToRatingError(error: unknown): RatingError {
  // If already a RatingError, return as-is
  if (isRatingError(error)) {
    return error;
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const ratingError: RatingError = new Error(error.message);
    ratingError.code = mapErrorMessageToCode(error.message);
    return ratingError;
  }

  // Handle axios/fetch error responses
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;

    // Check for response data with error info
    const response = errorObj.response as Record<string, unknown> | undefined;
    const data = response?.data as Record<string, unknown> | undefined;

    if (data?.error) {
      const serverError = data.error as Record<string, unknown>;
      const ratingError: RatingError = new Error(
        (serverError.message as string) || 'Rating operation failed'
      );
      ratingError.code = mapServerErrorCode(serverError.code as string);

      if (serverError.details) {
        ratingError.details = serverError.details as RatingError['details'];
      }

      return ratingError;
    }

    // Check for HTTP status codes
    const status = response?.status as number | undefined;
    if (status) {
      const ratingError: RatingError = new Error(
        getErrorMessageForStatus(status)
      );
      ratingError.code = mapHttpStatusToCode(status);
      return ratingError;
    }

    // Network error (no response)
    if (errorObj.code === 'ERR_NETWORK' || errorObj.code === 'ECONNABORTED') {
      const ratingError: RatingError = new Error(
        'Network error. Please check your connection.'
      );
      ratingError.code = 'NETWORK_ERROR';
      return ratingError;
    }
  }

  // Fallback for unknown error types
  const ratingError: RatingError = new Error('An unexpected error occurred');
  ratingError.code = 'UNKNOWN_ERROR';
  return ratingError;
}

/**
 * Type guard to check if an error is a RatingError
 */
function isRatingError(error: unknown): error is RatingError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as RatingError).code === 'string'
  );
}

/**
 * Maps error message patterns to RatingErrorCode values
 */
function mapErrorMessageToCode(message: string): RatingErrorCode {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes('permission') ||
    lowerMessage.includes('capability') ||
    lowerMessage.includes('not allowed')
  ) {
    return 'PERMISSION_DENIED';
  }

  if (
    lowerMessage.includes('own entry') ||
    lowerMessage.includes('cannot rate your own')
  ) {
    return 'OWN_ENTRY';
  }

  if (lowerMessage.includes('not found') || lowerMessage.includes('no entry')) {
    return 'ENTRY_NOT_FOUND';
  }

  if (
    lowerMessage.includes('disabled') ||
    lowerMessage.includes('not enabled')
  ) {
    return 'RATING_DISABLED';
  }

  if (
    lowerMessage.includes('scale') ||
    lowerMessage.includes('out of range') ||
    lowerMessage.includes('invalid value')
  ) {
    return 'OUT_OF_SCALE';
  }

  if (
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('required')
  ) {
    return 'INVALID_RATING';
  }

  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('connection')
  ) {
    return 'NETWORK_ERROR';
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Maps server error codes to RatingErrorCode values
 */
function mapServerErrorCode(code: string | undefined): RatingErrorCode {
  if (!code) {
    return 'UNKNOWN_ERROR';
  }

  const codeMap: Record<string, RatingErrorCode> = {
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    ACCESS_DENIED: 'PERMISSION_DENIED',
    FORBIDDEN: 'PERMISSION_DENIED',
    NOT_FOUND: 'ENTRY_NOT_FOUND',
    ENTRY_NOT_FOUND: 'ENTRY_NOT_FOUND',
    RATING_DISABLED: 'RATING_DISABLED',
    INVALID_RATING: 'INVALID_RATING',
    OUT_OF_SCALE: 'OUT_OF_SCALE',
    INVALID_SCALE: 'OUT_OF_SCALE',
    OWN_ENTRY: 'OWN_ENTRY',
    NETWORK_ERROR: 'NETWORK_ERROR',
  };

  return codeMap[code.toUpperCase()] ?? 'UNKNOWN_ERROR';
}

/**
 * Maps HTTP status codes to RatingErrorCode values
 */
function mapHttpStatusToCode(status: number): RatingErrorCode {
  switch (status) {
    case 400:
      return 'INVALID_RATING';
    case 401:
    case 403:
      return 'PERMISSION_DENIED';
    case 404:
      return 'ENTRY_NOT_FOUND';
    case 422:
      return 'OUT_OF_SCALE';
    default:
      return status >= 500 ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR';
  }
}

/**
 * Gets a user-friendly error message for an HTTP status code
 */
function getErrorMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid rating data provided';
    case 401:
      return 'You must be logged in to rate entries';
    case 403:
      return 'You do not have permission to rate this entry';
    case 404:
      return 'The glossary entry was not found';
    case 422:
      return 'The rating value is outside the allowed range';
    case 500:
      return 'Server error. Please try again later.';
    default:
      return `Request failed with status ${status}`;
  }
}
