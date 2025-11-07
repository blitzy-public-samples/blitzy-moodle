/**
 * Choice Activity - Delete Responses Hook
 * 
 * React Query mutation hook for deleting choice responses with optimistic updates,
 * automatic cache invalidation, and comprehensive error handling.
 * 
 * @module features/activities/choice/hooks/useDeleteResponses
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { useToast } from '@/hooks/useToast';

/**
 * Input parameters for deleting choice responses
 */
interface DeleteResponsesInput {
  /** The choice activity ID */
  choiceId: number;
  /** Array of attempt/response IDs to delete */
  attemptIds: number[];
}

/**
 * API response structure for successful deletion
 */
interface DeleteResponsesResponse {
  success: boolean;
  data: {
    deleted: number;
    choiceId: number;
  };
  meta?: {
    message?: string;
  };
}

/**
 * API error response structure
 */
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: {
      required_capability?: string;
      context?: string;
      attemptIds?: number[];
    };
  };
}

/**
 * Cached choice results data structure
 */
interface ChoiceResultsCache {
  responses: Array<{
    id: number;
    userid: number;
    optionid: number;
    timemodified: number;
  }>;
  options: Array<{
    id: number;
    text: string;
    count: number;
  }>;
  totalResponses: number;
}

/**
 * Deletes choice responses via the API
 * 
 * Calls DELETE /api/v1/choices/{id}/responses endpoint which wraps the
 * existing choice_delete_responses() PHP function. Requires the
 * mod/choice:deleteresponses capability.
 * 
 * @param input - Choice ID and array of attempt IDs to delete
 * @returns Promise resolving to deletion response
 * @throws ApiErrorResponse if deletion fails or permission denied
 */
async function deleteChoiceResponses(
  input: DeleteResponsesInput
): Promise<DeleteResponsesResponse> {
  const { choiceId, attemptIds } = input;

  // Validate input
  if (!choiceId || choiceId <= 0) {
    throw new Error('Invalid choice ID provided');
  }

  if (!Array.isArray(attemptIds) || attemptIds.length === 0) {
    throw new Error('At least one attempt ID must be provided');
  }

  // Ensure all attempt IDs are valid positive integers
  const validAttemptIds = attemptIds.filter(id => Number.isInteger(id) && id > 0);
  if (validAttemptIds.length !== attemptIds.length) {
    throw new Error('All attempt IDs must be valid positive integers');
  }

  try {
    const response = await apiClient.delete<DeleteResponsesResponse>(
      `/api/v1/choices/${choiceId}/responses`,
      {
        data: {
          attemptIds: validAttemptIds,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    // Transform API error into standardized format
    if (error.response?.data?.error) {
      const apiError = error.response.data as ApiErrorResponse;
      throw new Error(apiError.error.message || 'Failed to delete choice responses');
    }
    
    throw new Error(
      error.message || 'An unexpected error occurred while deleting responses'
    );
  }
}

/**
 * React Query mutation hook for deleting choice responses
 * 
 * Features:
 * - Optimistic updates: Immediately removes deleted responses from cache
 * - Automatic cache invalidation: Refetches choice results on success
 * - Rollback on error: Restores previous cache state if deletion fails
 * - Toast notifications: Shows success/error messages to user
 * - Permission validation: Ensures user has mod/choice:deleteresponses capability
 * 
 * @example
 * ```tsx
 * function ChoiceResponseManager({ choiceId }) {
 *   const deleteResponses = useDeleteResponses();
 * 
 *   const handleDelete = (attemptIds: number[]) => {
 *     deleteResponses.mutate(
 *       { choiceId, attemptIds },
 *       {
 *         onSuccess: () => {
 *           console.log('Responses deleted successfully');
 *         },
 *       }
 *     );
 *   };
 * 
 *   return (
 *     <button
 *       onClick={() => handleDelete([1, 2, 3])}
 *       disabled={deleteResponses.isPending}
 *     >
 *       {deleteResponses.isPending ? 'Deleting...' : 'Delete Responses'}
 *     </button>
 *   );
 * }
 * ```
 * 
 * @returns UseMutationResult with mutate function and state
 */
export default function useDeleteResponses(): UseMutationResult<
  DeleteResponsesResponse,
  Error,
  DeleteResponsesInput,
  { previousData: ChoiceResultsCache | undefined }
> {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<
    DeleteResponsesResponse,
    Error,
    DeleteResponsesInput,
    { previousData: ChoiceResultsCache | undefined }
  >({
    mutationFn: deleteChoiceResponses,

    /**
     * Optimistic update: Remove responses from cache immediately
     * This provides instant feedback to the user while the API request is in flight
     */
    onMutate: async (variables: DeleteResponsesInput) => {
      const { choiceId, attemptIds } = variables;
      const queryKey = ['choices', choiceId, 'results'];

      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData<ChoiceResultsCache>(queryKey);

      // Optimistically update the cache
      if (previousData) {
        queryClient.setQueryData<ChoiceResultsCache>(queryKey, (old) => {
          if (!old) return old;

          // Filter out deleted responses
          const filteredResponses = old.responses.filter(
            (response) => !attemptIds.includes(response.id)
          );

          // Recalculate option counts
          const optionCounts = new Map<number, number>();
          filteredResponses.forEach((response) => {
            optionCounts.set(
              response.optionid,
              (optionCounts.get(response.optionid) || 0) + 1
            );
          });

          const updatedOptions = old.options.map((option) => ({
            ...option,
            count: optionCounts.get(option.id) || 0,
          }));

          return {
            ...old,
            responses: filteredResponses,
            options: updatedOptions,
            totalResponses: filteredResponses.length,
          };
        });
      }

      // Return context with previous data for potential rollback
      return { previousData };
    },

    /**
     * On success: Invalidate cache to refetch fresh data
     * Show success toast notification
     */
    onSuccess: (data, variables) => {
      const { choiceId } = variables;
      const deletedCount = data.data.deleted;

      // Invalidate the results cache to trigger a refetch
      queryClient.invalidateQueries({
        queryKey: ['choices', choiceId, 'results'],
      });

      // Also invalidate the main choice query in case metadata changed
      queryClient.invalidateQueries({
        queryKey: ['choices', choiceId],
      });

      // Invalidate the choice list if it exists
      queryClient.invalidateQueries({
        queryKey: ['choices'],
        exact: false,
      });

      // Show success notification
      showToast({
        type: 'success',
        message: `Successfully deleted ${deletedCount} response${deletedCount !== 1 ? 's' : ''}`,
        duration: 4000,
      });
    },

    /**
     * On error: Rollback optimistic update and show error message
     * This restores the previous cache state if the deletion fails
     */
    onError: (error, variables, context) => {
      const { choiceId } = variables;

      // Rollback to previous data if available
      if (context?.previousData) {
        queryClient.setQueryData(
          ['choices', choiceId, 'results'],
          context.previousData
        );
      }

      // Show error notification with details
      const errorMessage = error.message || 'Failed to delete choice responses';
      
      showToast({
        type: 'error',
        message: errorMessage,
        duration: 6000,
      });

      // Log error for debugging (in development)
      if (process.env.NODE_ENV === 'development') {
        console.error('Delete responses error:', error);
      }
    },

    /**
     * Always refetch after mutation settles (success or error)
     * This ensures cache consistency even if optimistic update was incorrect
     */
    onSettled: (_data, _error, variables) => {
      const { choiceId } = variables;

      // Ensure we have the latest data
      queryClient.invalidateQueries({
        queryKey: ['choices', choiceId, 'results'],
      });
    },

    // Retry configuration
    retry: false, // Don't retry delete operations (they're idempotent but we want explicit user action)

    // Network mode: fail fast if offline
    networkMode: 'online',
  });
}

/**
 * Type export for use in other components
 */
export type { DeleteResponsesInput, DeleteResponsesResponse };
