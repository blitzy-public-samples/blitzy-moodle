/**
 * React Query mutation hook for modifying choice responses
 * 
 * This hook wraps the PUT /api/v1/choices/{id}/responses endpoint to modify
 * user responses to a new option. It supports bulk modification where multiple
 * users can have their choices changed to a different option.
 * 
 * Features:
 * - Optimistic updates for immediate UI feedback
 * - Automatic cache invalidation on success
 * - Rollback on error with toast notification
 * - Permission validation (requires mod/choice:deleteresponses capability)
 * 
 * Based on: public/mod/choice/lib.php - choice_modify_responses()
 * 
 * @packageDocumentation
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { useToast } from '@/hooks/useToast';

/**
 * Input parameters for modifying choice responses
 */
interface ModifyResponsesInput {
  /** The choice activity ID */
  choiceId: number;
  /** Array of user IDs whose responses should be modified */
  userIds: number[];
  /** Array of answer/attempt IDs to be modified */
  attemptIds: number[];
  /** The new option ID to set for the selected users/attempts */
  newOptionId: number;
}

/**
 * Response from the modify responses API endpoint
 */
interface ModifyResponsesResponse {
  /** Indicates if the operation was successful */
  success: boolean;
  /** Number of responses modified */
  modifiedCount: number;
  /** Message describing the result */
  message: string;
}

/**
 * Cached choice results data structure for optimistic updates
 */
interface ChoiceResultsCache {
  /** Choice activity details */
  choice: {
    id: number;
    name: string;
    options: Array<{
      id: number;
      text: string;
      count: number;
    }>;
  };
  /** Array of user responses */
  responses: Array<{
    userId: number;
    optionId: number;
    attemptId: number;
    timeModified: number;
  }>;
}

/**
 * Custom hook for modifying choice responses with optimistic updates
 * 
 * This hook provides a mutation function to change user responses to a different
 * option in a choice activity. It implements optimistic updates by immediately
 * modifying the cached data, then rolling back if the API call fails.
 * 
 * @example
 * ```typescript
 * const { mutate, isLoading, error } = useModifyResponses();
 * 
 * const handleModify = () => {
 *   mutate({
 *     choiceId: 123,
 *     userIds: [45, 67],
 *     attemptIds: [101, 102],
 *     newOptionId: 5
 *   });
 * };
 * ```
 * 
 * @returns UseMutationResult with mutation function and state
 */
export default function useModifyResponses(): UseMutationResult<
  ModifyResponsesResponse,
  Error,
  ModifyResponsesInput,
  { previousData: ChoiceResultsCache | undefined }
> {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<
    ModifyResponsesResponse,
    Error,
    ModifyResponsesInput,
    { previousData: ChoiceResultsCache | undefined }
  >({
    /**
     * Mutation function that calls the API endpoint
     */
    mutationFn: async (input: ModifyResponsesInput) => {
      const { choiceId, userIds, attemptIds, newOptionId } = input;

      // Validate input parameters
      if (!choiceId || choiceId <= 0) {
        throw new Error('Invalid choice ID');
      }

      if (!newOptionId || newOptionId <= 0) {
        throw new Error('Invalid new option ID');
      }

      if ((!userIds || userIds.length === 0) && (!attemptIds || attemptIds.length === 0)) {
        throw new Error('Either userIds or attemptIds must be provided');
      }

      // Make API request to modify responses
      const response = await apiClient.put<{ success: boolean; data: ModifyResponsesResponse }>(
        `/api/v1/choices/${choiceId}/responses`,
        {
          userIds: userIds || [],
          attemptIds: attemptIds || [],
          newOptionId,
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.data?.message || 'Failed to modify responses');
      }

      return response.data.data;
    },

    /**
     * Optimistic update: Immediately modify the cached data before API response
     */
    onMutate: async (variables: ModifyResponsesInput) => {
      const { choiceId, attemptIds, newOptionId } = variables;

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ['choices', choiceId, 'results'],
      });

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData<ChoiceResultsCache>([
        'choices',
        choiceId,
        'results',
      ]);

      // Optimistically update the cached data
      if (previousData) {
        queryClient.setQueryData<ChoiceResultsCache>(
          ['choices', choiceId, 'results'],
          (oldData) => {
            if (!oldData) return oldData;

            // Create a set of attemptIds for faster lookup
            const attemptIdSet = new Set(attemptIds);

            // Update responses that match the attemptIds
            const updatedResponses = oldData.responses.map((response) => {
              if (attemptIdSet.has(response.attemptId)) {
                return {
                  ...response,
                  optionId: newOptionId,
                  timeModified: Date.now() / 1000, // Convert to Unix timestamp
                };
              }
              return response;
            });

            // Recalculate option counts based on updated responses
            const optionCounts = new Map<number, number>();
            updatedResponses.forEach((response) => {
              const currentCount = optionCounts.get(response.optionId) || 0;
              optionCounts.set(response.optionId, currentCount + 1);
            });

            // Update option counts in choice data
            const updatedOptions = oldData.choice.options.map((option) => ({
              ...option,
              count: optionCounts.get(option.id) || 0,
            }));

            return {
              ...oldData,
              responses: updatedResponses,
              choice: {
                ...oldData.choice,
                options: updatedOptions,
              },
            };
          }
        );
      }

      // Return context with previous data for rollback
      return { previousData };
    },

    /**
     * On error: Rollback optimistic update and show error notification
     */
    onError: (error: Error, variables: ModifyResponsesInput, context) => {
      const { choiceId } = variables;

      // Rollback to previous data if available
      if (context?.previousData) {
        queryClient.setQueryData(['choices', choiceId, 'results'], context.previousData);
      }

      // Show error toast notification
      showToast({
        type: 'error',
        message: `Failed to modify responses: ${error.message}`,
        duration: 5000,
      });

      // Log error for debugging
      console.error('Error modifying choice responses:', error);
    },

    /**
     * On success: Invalidate cache and show success notification
     */
    onSuccess: (data: ModifyResponsesResponse, variables: ModifyResponsesInput) => {
      const { choiceId } = variables;

      // Invalidate and refetch choice results to ensure data consistency
      queryClient.invalidateQueries({
        queryKey: ['choices', choiceId, 'results'],
      });

      // Also invalidate the choice details cache as counts may have changed
      queryClient.invalidateQueries({
        queryKey: ['choices', choiceId],
      });

      // Show success toast notification
      showToast({
        type: 'success',
        message: data.message || `Successfully modified ${data.modifiedCount} response(s)`,
        duration: 3000,
      });
    },

    /**
     * Always execute: Clean up any pending queries after mutation settles
     */
    onSettled: (_data, _error, variables) => {
      const { choiceId } = variables;

      // Ensure cache is synchronized regardless of success or failure
      queryClient.invalidateQueries({
        queryKey: ['choices', choiceId],
      });
    },

    // Retry configuration
    retry: 1, // Retry once on failure
    retryDelay: 1000, // Wait 1 second before retrying
  });
}
