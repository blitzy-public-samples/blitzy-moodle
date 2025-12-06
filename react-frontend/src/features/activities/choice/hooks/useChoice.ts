/**
 * React Query Hook for Choice Activity Data
 *
 * This hook provides data fetching and caching for Moodle Choice activity instances.
 * It wraps the GET /api/v1/choices/{id} API endpoint, which internally calls existing
 * Moodle PHP functions:
 * - choice_get_choice() - Retrieves choice activity data
 * - choice_get_availability_status() - Checks if user can make/update choice
 * - choice_get_my_option() - Gets user's current selection(s)
 *
 * Features:
 * - Automatic caching with 5-minute staleTime for optimal performance
 * - TypeScript strict mode with comprehensive type definitions
 * - Error handling for network failures, permission errors, and not found scenarios
 * - Support for React 18 concurrent rendering with Suspense boundaries
 * - Cache invalidation support via returned refetch function
 *
 * @example
 * ```tsx
 * // Basic usage in a component
 * const { data: choice, isLoading, error } = useChoice(choiceId);
 *
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorAlert message={error.message} />;
 *
 * return (
 *   <div>
 *     <h1>{choice.name}</h1>
 *     <div dangerouslySetInnerHTML={{ __html: choice.intro }} />
 *     {choice.options.map(option => (
 *       <ChoiceOptionCard key={option.id} option={option} />
 *     ))}
 *   </div>
 * );
 * ```
 *
 * @example
 * ```tsx
 * // Usage with refetch after submission
 * const { data, refetch } = useChoice(choiceId);
 * const submitMutation = useChoiceSubmission();
 *
 * const handleSubmit = async (optionId: number) => {
 *   await submitMutation.mutateAsync({ choiceId, optionId });
 *   await refetch(); // Refresh choice data after submission
 * };
 * ```
 *
 * @module features/activities/choice/hooks/useChoice
 * @see {@link https://docs.moodle.org/dev/Choice_module Choice Module Documentation}
 */

import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/services/api/client';
import type { ApiResponse } from '@/types/api';
import type {
  DisplayMode,
  ShowResultsMode,
  PublishMode,
} from '../types/choice.types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Cache stale time for choice data (5 minutes)
 *
 * Choice activities are relatively static - options don't change frequently,
 * and user responses are handled separately. A 5-minute staleTime provides
 * a good balance between freshness and performance.
 *
 * This aligns with the performance requirements in Agent Action Plan section 0.7.
 */
const CHOICE_STALE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Cache garbage collection time (10 minutes)
 *
 * Unused cache entries are kept for 10 minutes after becoming unused.
 * This allows quick restoration if user navigates back to the choice.
 */
const CHOICE_GC_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Choice option interface for use with the useChoice hook.
 *
 * Represents a single selectable option within a choice activity.
 * Based on the choice_options database table schema.
 *
 * Re-exported from choice.types.ts for convenience when using the hook.
 */
export interface ChoiceOption {
  /** Unique identifier for this option */
  id: number;

  /** Text content/label of this option */
  text: string;

  /** Maximum number of users who can select this option (0 = unlimited) */
  maxanswers: number;

  /** Current count of users who have selected this option */
  countanswers: number;
}

/**
 * User's current answer(s) to the choice activity.
 *
 * Contains information about the user's current selection(s) in the choice,
 * including which option(s) they selected and when.
 */
export interface ChoiceUserAnswer {
  /** Whether the user has submitted any answer(s) */
  hasAnswered: boolean;

  /** Array of option IDs the user has selected (may contain multiple if allowmultiple is true) */
  selectedOptionIds: number[];

  /** Timestamp when the user last modified their answer (Unix timestamp, 0 if no answer) */
  timemodified: number;

  /** Array of answer record IDs (internal, used for deletion/update operations) */
  answerIds: number[];
}

/**
 * Availability status for the choice activity.
 *
 * Indicates whether the user can currently make or update their choice,
 * and provides warning messages if there are restrictions.
 */
export interface ChoiceAvailability {
  /** Whether the choice is currently available for the user to make/update selections */
  available: boolean;

  /** Whether the choice is open (time-based availability) */
  isOpen: boolean;

  /** Whether the choice has closed (past timeclose) */
  isClosed: boolean;

  /** Whether the choice is in preview mode (before timeopen with showpreview enabled) */
  isPreview: boolean;

  /** Array of warning messages explaining any restrictions */
  warnings: string[];

  /** Timestamp when the choice opens (0 if no restriction) */
  openTime: number;

  /** Timestamp when the choice closes (0 if no restriction) */
  closeTime: number;
}

/**
 * Permission flags for the choice activity.
 *
 * Indicates what actions the current user is allowed to perform
 * on the choice activity based on their role and capabilities.
 */
export interface ChoicePermissions {
  /** Whether the user can make/submit a choice selection */
  canChoose: boolean;

  /** Whether the user can view the choice activity and options */
  canView: boolean;

  /** Whether the user can manage the choice (edit, delete, view all responses) */
  canManage: boolean;

  /** Whether the user can update their existing choice (if they've already answered) */
  canUpdate: boolean;

  /** Whether the user can view choice results */
  canViewResults: boolean;

  /** Whether the user can delete their own responses */
  canDeleteOwn: boolean;
}

/**
 * Complete Choice activity interface returned by the useChoice hook.
 *
 * This interface extends the base choice data with user-specific information
 * including their current answer(s), availability status, and permission flags.
 * All properties are based on Moodle's choice module data structures.
 *
 * @see {@link https://docs.moodle.org/dev/Choice_module Choice Module Documentation}
 */
export interface Choice {
  /** Unique identifier for the choice activity (course module ID) */
  id: number;

  /** Name/title of the choice activity */
  name: string;

  /** Introduction/description text (may contain HTML) */
  intro: string;

  /** Timestamp when the choice opens for responses (0 = no restriction) */
  timeopen: number;

  /** Timestamp when the choice closes for responses (0 = no restriction) */
  timeclose: number;

  /** Display mode for options (0 = horizontal, 1 = vertical) */
  display: DisplayMode;

  /** Whether users can update their choice after initial submission */
  allowupdate: boolean;

  /** Whether users can select multiple options */
  allowmultiple: boolean;

  /** Whether the number of responses per option is limited */
  limitanswers: boolean;

  /** When to show results to users (0 = never, 1 = after answer, 2 = after close, 3 = always) */
  showresults: ShowResultsMode;

  /** Whether to publish results with user names (0 = anonymous, 1 = with names) */
  publish: PublishMode;

  /** Whether to show users who haven't answered in results */
  showunanswered: boolean;

  /** Whether to include inactive/suspended users in results */
  includeinactive: boolean;

  /** Array of available choice options */
  options: ChoiceOption[];

  /** User's current answer(s) to this choice */
  userAnswer: ChoiceUserAnswer;

  /** Availability status for making/updating choices */
  availability: ChoiceAvailability;

  /** Permission flags for this user */
  permissions: ChoicePermissions;

  /** Course ID this choice belongs to */
  courseId: number;

  /** Course module ID */
  cmid: number;

  /** Format of the intro text (0 = Moodle, 1 = HTML, 2 = Plain, 4 = Markdown) */
  introformat: number;

  /** Whether submitting completes the activity */
  completionsubmit: boolean;

  /** Whether to show available spaces for limited options */
  showavailable: boolean;

  /** Whether to show preview before choice opens */
  showpreview: boolean;

  /** Timestamp of last modification */
  timemodified: number;
}

/**
 * API response structure for GET /api/v1/choices/{id}
 *
 * The API returns choice data wrapped in the standard response envelope.
 */
type ChoiceApiResponse = ApiResponse<Choice>;

/**
 * Parameters for the useChoice hook
 */
export interface UseChoiceParams {
  /** Choice activity ID to fetch */
  choiceId: number;

  /** Whether to enable the query (defaults to true) */
  enabled?: boolean;
}

/**
 * Return type for the useChoice hook
 *
 * Extends the standard UseQueryResult with the Choice data type.
 */
export type UseChoiceResult = UseQueryResult<Choice, Error>;

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for choice-related queries.
 *
 * Provides consistent query key generation for React Query cache management.
 * Using a factory pattern ensures cache keys are predictable and enables
 * efficient cache invalidation.
 *
 * @example
 * ```typescript
 * // Get query key for a specific choice
 * const queryKey = choiceQueryKeys.detail(123);
 * // Result: ['choices', 123]
 *
 * // Invalidate all choice queries
 * queryClient.invalidateQueries({ queryKey: choiceQueryKeys.all });
 *
 * // Invalidate specific choice
 * queryClient.invalidateQueries({ queryKey: choiceQueryKeys.detail(123) });
 * ```
 */
export const choiceQueryKeys = {
  /** Base key for all choice queries */
  all: ['choices'] as const,

  /** Query key for a specific choice by ID */
  detail: (choiceId: number) => ['choices', choiceId] as const,

  /** Query key for choice results by ID */
  results: (choiceId: number) => ['choices', choiceId, 'results'] as const,

  /** Query key for choice options by ID */
  options: (choiceId: number) => ['choices', choiceId, 'options'] as const,
} as const;

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetches choice activity data from the API.
 *
 * Makes a GET request to /api/v1/choices/{id} and extracts the choice data
 * from the standard API response envelope.
 *
 * @param choiceId - The ID of the choice activity to fetch
 * @returns Promise resolving to the Choice data
 * @throws Error if the API request fails or returns an error response
 *
 * @internal This function is used internally by the useChoice hook.
 * For direct API calls, use the choiceApi service instead.
 */
async function fetchChoice(choiceId: number): Promise<Choice> {
  // Validate choiceId parameter
  if (!choiceId || choiceId <= 0) {
    throw new Error('Invalid choice ID: Choice ID must be a positive number');
  }

  try {
    // Make GET request to the choice endpoint
    const response = await apiClient.get<ChoiceApiResponse>(`/choices/${choiceId}`);

    // Extract data from the standard API response envelope
    // The response structure is: { success: true, data: Choice, meta?: ... }
    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    // Handle unexpected response structure
    throw new Error('Invalid API response: Missing choice data');
  } catch (error: unknown) {
    // Re-throw with more context for debugging
    if (error instanceof Error) {
      // Check for specific error types and provide user-friendly messages
      // The error can be either:
      // 1. Standard AxiosError: error.response.status
      // 2. Serialized error (from interceptors): error.status (direct property)
      const axiosError = error as { 
        response?: { status?: number; data?: { error?: { message?: string; code?: string } } };
        status?: number;
        data?: { error?: { message?: string; code?: string } };
        customError?: { message?: string; code?: string; status?: number };
      };

      // Get status from either response object or direct property (serialized error)
      const status = axiosError.response?.status ?? axiosError.status;
      // Get data from either response object or direct property (serialized error)
      const data = axiosError.response?.data ?? axiosError.data;
      // Get customError if present (from interceptors)
      const {customError} = axiosError;

      if (status) {
        // Handle specific HTTP error statuses
        switch (status) {
          case 401:
            throw new Error('Authentication required: Please log in to view this choice activity');
          case 403:
            throw new Error('Permission denied: You do not have access to view this choice activity');
          case 404:
            throw new Error(`Choice not found: No choice activity exists with ID ${choiceId}`);
          case 500:
            throw new Error('Server error: Unable to load choice activity. Please try again later.');
          default:
            // Use error message from API or customError if available
            if (customError?.message) {
              throw new Error(customError.message);
            }
            if (data?.error?.message) {
              throw new Error(data.error.message);
            }
        }
      }

      // Network or other errors
      if (error.message.includes('Network Error') || error.message.includes('network')) {
        throw new Error('Network error: Unable to connect to the server. Please check your connection.');
      }

      throw error;
    }

    // Unknown error type
    throw new Error('An unexpected error occurred while loading the choice activity');
  }
}

// ============================================================================
// React Query Hook
// ============================================================================

/**
 * React Query hook for fetching and caching Choice activity data.
 *
 * This hook provides a convenient way to fetch choice activity data with
 * automatic caching, loading states, and error handling. It wraps the
 * GET /api/v1/choices/{id} endpoint which internally calls existing Moodle
 * PHP functions (choice_get_choice, choice_get_availability_status, etc.).
 *
 * Features:
 * - 5-minute cache staleTime for optimal performance
 * - Automatic refetching on window focus (configurable)
 * - TypeScript strict mode with comprehensive types
 * - Support for React 18 Suspense boundaries
 * - Comprehensive error handling with user-friendly messages
 *
 * @param choiceId - The ID of the choice activity to fetch
 * @param options - Optional configuration for the hook
 * @param options.enabled - Whether to enable the query (defaults to true when choiceId is valid)
 * @returns UseQueryResult with choice data, loading state, error state, and refetch function
 *
 * @example
 * ```tsx
 * // Basic usage
 * function ChoiceActivity({ id }: { id: number }) {
 *   const { data: choice, isLoading, error } = useChoice(id);
 *
 *   if (isLoading) return <CircularProgress />;
 *   if (error) return <Alert severity="error">{error.message}</Alert>;
 *   if (!choice) return null;
 *
 *   return (
 *     <Box>
 *       <Typography variant="h4">{choice.name}</Typography>
 *       <Typography
 *         variant="body1"
 *         dangerouslySetInnerHTML={{ __html: choice.intro }}
 *       />
 *       {choice.options.map(option => (
 *         <ChoiceOptionCard
 *           key={option.id}
 *           option={option}
 *           selected={choice.userAnswer.selectedOptionIds.includes(option.id)}
 *           disabled={!choice.availability.available}
 *         />
 *       ))}
 *     </Box>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With conditional fetching
 * function ConditionalChoice({ id, shouldFetch }: { id: number; shouldFetch: boolean }) {
 *   const { data, isLoading } = useChoice(id, { enabled: shouldFetch });
 *   // Query only runs when shouldFetch is true
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With manual refetch after mutation
 * function ChoiceWithSubmit({ id }: { id: number }) {
 *   const { data: choice, refetch, isFetching } = useChoice(id);
 *   const submitMutation = useSubmitChoice();
 *
 *   const handleSubmit = async (optionIds: number[]) => {
 *     await submitMutation.mutateAsync({ choiceId: id, optionIds });
 *     await refetch(); // Refresh to show updated state
 *   };
 *
 *   return (
 *     <Box>
 *       {isFetching && <LinearProgress />}
 *       {choice && <ChoiceForm choice={choice} onSubmit={handleSubmit} />}
 *     </Box>
 *   );
 * }
 * ```
 */
export function useChoice(
  choiceId: number,
  options?: { enabled?: boolean }
): UseChoiceResult {
  const { enabled = true } = options ?? {};

  return useQuery<Choice, Error>({
    // Query key for cache management: ['choices', choiceId]
    queryKey: choiceQueryKeys.detail(choiceId),

    // Query function that fetches the choice data
    queryFn: () => fetchChoice(choiceId),

    // Only enable the query if:
    // 1. The enabled option is true (default)
    // 2. The choiceId is a valid positive number
    enabled: enabled && Boolean(choiceId) && choiceId > 0,

    // Cache staleTime: 5 minutes
    // Data is considered fresh for 5 minutes before refetching in background
    staleTime: CHOICE_STALE_TIME,

    // Garbage collection time: 10 minutes
    // Unused cache entries are kept for 10 minutes after becoming unused
    gcTime: CHOICE_GC_TIME,

    // Refetch on window focus: Enabled
    // Refetches stale data when user returns to the tab/window
    refetchOnWindowFocus: true,

    // Refetch on mount: Only if data is stale
    // Prevents unnecessary refetches when component remounts with fresh data
    refetchOnMount: true,

    // Retry configuration
    // Retry failed requests up to 3 times with exponential backoff
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Network mode: Online only
    // Only run queries when there is network connectivity
    networkMode: 'online',

    // Placeholder data: None
    // We don't provide placeholder data to ensure accurate loading states

    // Structural sharing: Enabled (default)
    // Optimizes re-renders by maintaining referential equality for unchanged data
  });
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default export of the useChoice hook.
 *
 * Allows importing with:
 * ```typescript
 * import useChoice from '@/features/activities/choice/hooks/useChoice';
 * ```
 *
 * Or with named import:
 * ```typescript
 * import { useChoice } from '@/features/activities/choice/hooks/useChoice';
 * ```
 */
export default useChoice;
