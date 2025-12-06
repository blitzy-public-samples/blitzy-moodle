/**
 * React Query Mutation Hook for Choice Activity Response Submission
 *
 * Provides a comprehensive mutation hook for submitting, updating, and deleting
 * user responses to Moodle Choice activities. The hook wraps the POST
 * /api/v1/choices/{id}/respond API endpoint and implements optimistic updates
 * for immediate UI feedback before server confirmation.
 *
 * Features:
 * - Optimistic updates for instant UI feedback
 * - Automatic cache invalidation on successful submission
 * - Support for both single and multiple choice selections
 * - Client-side validation before submission
 * - Delete response functionality for choices that allow updates
 * - Comprehensive error handling for all edge cases
 * - Toast notifications for user feedback
 *
 * API Endpoint: POST /api/v1/choices/{id}/respond
 * Backend Functions (via API wrapper):
 * - choice_user_submit_response() - Submit or update user response
 * - choice_delete_responses() - Delete user's existing responses
 *
 * @example
 * ```tsx
 * // Basic usage in a component
 * function ChoiceOptions({ choiceId, options }) {
 *   const { mutate, isPending } = useChoiceResponse();
 *
 *   const handleSelect = (optionId: number) => {
 *     mutate({ choiceId, answer: optionId, courseId: courseId });
 *   };
 *
 *   return (
 *     <div>
 *       {options.map(option => (
 *         <Button
 *           key={option.id}
 *           onClick={() => handleSelect(option.id)}
 *           disabled={isPending}
 *         >
 *           {option.text}
 *         </Button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Multiple selection with async handling
 * const { mutateAsync, isPending, isError, error } = useChoiceResponse();
 *
 * const handleMultipleSubmit = async (selectedIds: number[]) => {
 *   try {
 *     const result = await mutateAsync({
 *       choiceId,
 *       answer: selectedIds,
 *       courseId
 *     });
 *     console.log('Success:', result.message);
 *   } catch (error) {
 *     console.error('Submission failed:', error);
 *   }
 * };
 * ```
 *
 * @example
 * ```tsx
 * // Delete response
 * const { mutate } = useChoiceResponse();
 *
 * const handleDeleteResponse = () => {
 *   mutate({
 *     choiceId,
 *     answer: [],
 *     action: 'delete',
 *     courseId
 *   });
 * };
 * ```
 *
 * @module features/activities/choice/hooks/useChoiceResponse
 * @see {@link https://docs.moodle.org/dev/Choice_module Choice Module Documentation}
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import apiClient from '@/services/api/client';
import type { Choice } from '@/features/activities/choice/hooks/useChoice';
import { useToast } from '@/hooks/useToast';
import type { ApiResponse } from '@/types/api';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Input data for submitting or deleting a choice response.
 *
 * @example
 * ```typescript
 * // Single choice submission
 * const input: ChoiceResponseInput = {
 *   choiceId: 123,
 *   answer: 456,
 *   courseId: 1
 * };
 *
 * // Multiple choice submission
 * const multiInput: ChoiceResponseInput = {
 *   choiceId: 123,
 *   answer: [456, 789],
 *   courseId: 1
 * };
 *
 * // Delete existing response
 * const deleteInput: ChoiceResponseInput = {
 *   choiceId: 123,
 *   answer: [],
 *   action: 'delete',
 *   courseId: 1
 * };
 * ```
 */
export interface ChoiceResponseInput {
  /**
   * The ID of the choice activity (course module ID)
   */
  choiceId: number;

  /**
   * The selected option ID(s).
   * - For single choice: a number representing the selected option ID
   * - For multiple choice: an array of selected option IDs
   * - For delete: an empty array []
   */
  answer: number | number[];

  /**
   * Action to perform (defaults to 'submit')
   * - 'submit': Submit or update the user's choice response
   * - 'delete': Delete the user's existing response(s)
   */
  action?: 'submit' | 'delete';

  /**
   * The course ID this choice belongs to (for cache invalidation)
   */
  courseId: number;
}

/**
 * Result returned from a successful choice response submission.
 *
 * Contains the submission status, a user-friendly message, and the updated
 * choice data with the user's new selection reflected.
 */
export interface ChoiceResponseResult {
  /**
   * Whether the submission was successful
   */
  success: boolean;

  /**
   * User-friendly message describing the result
   */
  message: string;

  /**
   * Updated choice data with the new selection reflected
   */
  updatedChoice: Choice;
}

/**
 * API response structure for POST /api/v1/choices/{id}/respond
 */
type ChoiceResponseApiResponse = ApiResponse<ChoiceResponseResult>;

/**
 * Mutation context for optimistic updates
 *
 * Stores the previous choice data before the mutation is performed,
 * allowing rollback on error.
 */
interface MutationContext {
  /**
   * Previous choice data from cache before mutation
   */
  previousChoice: Choice | undefined;

  /**
   * The choice ID being mutated
   */
  choiceId: number;
}

/**
 * Error response structure from the API
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
 * Return type for the useChoiceResponse hook
 *
 * Extends UseMutationResult with the specific types for choice response mutations.
 */
export type UseChoiceResponseResult = UseMutationResult<
  ChoiceResponseResult,
  Error,
  ChoiceResponseInput,
  MutationContext
>;

// ============================================================================
// Query Key Constants
// ============================================================================

/**
 * Query key factory for choice-related queries
 *
 * Used for cache invalidation after successful mutations.
 */
const CHOICE_QUERY_KEYS = {
  /** Base key for all choice queries */
  all: ['choices'] as const,

  /** Key for a specific choice */
  detail: (choiceId: number) => ['choices', choiceId] as const,

  /** Key for course activities list */
  courseActivities: (courseId: number) =>
    ['courses', courseId, 'activities'] as const,

  /** Key for dashboard data */
  dashboard: ['dashboard'] as const,
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates the choice response input before submission.
 *
 * Performs client-side validation to ensure the submission meets all requirements
 * before sending to the server. This provides immediate feedback and reduces
 * unnecessary API calls.
 *
 * @param input - The choice response input to validate
 * @param choice - The current choice data for validation context
 * @throws Error if validation fails
 */
function validateChoiceResponse(
  input: ChoiceResponseInput,
  choice: Choice | undefined
): void {
  // Basic input validation
  if (!input.choiceId || input.choiceId <= 0) {
    throw new Error('Invalid choice ID');
  }

  // If choice data is not available, skip detailed validation
  // Server will perform full validation
  if (!choice) {
    return;
  }

  // Delete action validation
  if (input.action === 'delete') {
    if (!choice.allowupdate) {
      throw new Error('This choice does not allow updating or deleting responses');
    }
    if (!choice.userAnswer.hasAnswered) {
      throw new Error('No response to delete');
    }
    return;
  }

  // Availability validation
  if (!choice.availability.available) {
    if (choice.availability.isClosed) {
      throw new Error('This choice has closed and no longer accepts responses');
    }
    if (!choice.availability.isOpen && !choice.availability.isPreview) {
      throw new Error('This choice is not yet open for responses');
    }
    const {warnings} = choice.availability;
    if (warnings.length > 0) {
      throw new Error(warnings[0]);
    }
    throw new Error('This choice is not available');
  }

  // Permission validation
  if (!choice.permissions.canChoose) {
    throw new Error('You do not have permission to submit a response to this choice');
  }

  // Check if user can update existing response
  if (choice.userAnswer.hasAnswered && !choice.permissions.canUpdate) {
    throw new Error(
      'You have already submitted a response and cannot change it'
    );
  }

  // Normalize answer to array for validation
  const answers = Array.isArray(input.answer) ? input.answer : [input.answer];

  // Empty answer validation (must select at least one option)
  if (answers.length === 0) {
    throw new Error('You must select at least one option');
  }

  // Multiple selection validation
  if (answers.length > 1 && !choice.allowmultiple) {
    throw new Error('This choice only allows selecting one option');
  }

  // Validate all selected options exist
  const optionIds = new Set(choice.options.map((opt) => opt.id));
  for (const answerId of answers) {
    if (!optionIds.has(answerId)) {
      throw new Error(`Invalid option selected: ${answerId}`);
    }
  }

  // Option capacity validation (if limit answers is enabled)
  if (choice.limitanswers) {
    for (const answerId of answers) {
      const option = choice.options.find((opt) => opt.id === answerId);
      if (option && option.maxanswers > 0) {
        // Check if option is full (excluding user's existing selection)
        const userAlreadySelected =
          choice.userAnswer.selectedOptionIds.includes(answerId);
        const effectiveCount = userAlreadySelected
          ? option.countanswers
          : option.countanswers;

        if (effectiveCount >= option.maxanswers && !userAlreadySelected) {
          throw new Error(
            `The option "${option.text}" has reached its maximum capacity`
          );
        }
      }
    }
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Submits or deletes a choice response via the API.
 *
 * Calls the POST /api/v1/choices/{id}/respond endpoint which wraps the
 * Moodle PHP functions choice_user_submit_response() or choice_delete_responses().
 *
 * @param input - The choice response input data
 * @returns Promise resolving to the submission result
 * @throws Error if the API request fails
 */
async function submitChoiceResponse(
  input: ChoiceResponseInput
): Promise<ChoiceResponseResult> {
  const { choiceId, answer, action = 'submit' } = input;

  // Normalize answer to array for API consistency
  const answerArray = Array.isArray(answer) ? answer : [answer];

  const response = await apiClient.post<ChoiceResponseApiResponse>(
    `/choices/${choiceId}/respond`,
    {
      answer: answerArray,
      action,
    }
  );

  // Extract data from standard API response envelope
  if (response.data.success && response.data.data) {
    return response.data.data;
  }

  // Handle error response
  const errorResponse = response.data as unknown as ApiErrorResponse;
  throw new Error(errorResponse.error?.message || 'Failed to submit response');
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React Query mutation hook for submitting and managing choice responses.
 *
 * Provides complete functionality for submitting, updating, and deleting user
 * responses to Moodle Choice activities. Implements optimistic updates for
 * immediate UI feedback, automatic cache invalidation for data consistency,
 * and comprehensive error handling.
 *
 * @returns Mutation result object with mutation functions and state
 *
 * @example
 * ```tsx
 * function ChoiceActivity({ choiceId, courseId }) {
 *   const { data: choice } = useChoice({ choiceId });
 *   const {
 *     mutate,
 *     mutateAsync,
 *     isPending,
 *     isError,
 *     error,
 *     isSuccess,
 *     reset,
 *     data
 *   } = useChoiceResponse();
 *
 *   const handleSubmit = (selectedOptionId: number) => {
 *     mutate({
 *       choiceId,
 *       answer: selectedOptionId,
 *       courseId
 *     });
 *   };
 *
 *   if (isPending) {
 *     return <CircularProgress />;
 *   }
 *
 *   return (
 *     <ChoiceOptions
 *       options={choice?.options ?? []}
 *       onSelect={handleSubmit}
 *     />
 *   );
 * }
 * ```
 */
export function useChoiceResponse(): UseChoiceResponseResult {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();

  return useMutation<
    ChoiceResponseResult,
    Error,
    ChoiceResponseInput,
    MutationContext
  >({
    /**
     * Mutation function that performs the API call
     */
    mutationFn: submitChoiceResponse,

    /**
     * Called before the mutation function.
     * Performs validation and sets up optimistic updates.
     *
     * @param input - The mutation input data
     * @returns Context object with previous data for rollback
     */
    onMutate: async (input: ChoiceResponseInput): Promise<MutationContext> => {
      const { choiceId, answer, action = 'submit' } = input;

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: CHOICE_QUERY_KEYS.detail(choiceId),
      });

      // Get current choice data from cache
      const previousChoice = queryClient.getQueryData<Choice>(
        CHOICE_QUERY_KEYS.detail(choiceId)
      );

      // Validate the submission
      validateChoiceResponse(input, previousChoice);

      // Perform optimistic update if we have cached data
      if (previousChoice) {
        // Normalize answer to array
        const answerArray = Array.isArray(answer) ? answer : [answer];

        // Create optimistically updated choice data
        const optimisticChoice: Choice = {
          ...previousChoice,
          userAnswer: {
            hasAnswered: action !== 'delete' && answerArray.length > 0,
            selectedOptionIds: action === 'delete' ? [] : answerArray,
            timemodified: Math.floor(Date.now() / 1000),
            // Preserve existing answer IDs for optimistic state
            answerIds: action === 'delete' ? [] : previousChoice.userAnswer.answerIds,
          },
          options: previousChoice.options.map((option) => {
            const wasSelected =
              previousChoice.userAnswer.selectedOptionIds.includes(option.id);
            const isNowSelected = answerArray.includes(option.id);

            // Calculate new count based on selection change
            let countChange = 0;
            if (action === 'delete' && wasSelected) {
              countChange = -1;
            } else if (wasSelected && !isNowSelected) {
              countChange = -1;
            } else if (!wasSelected && isNowSelected) {
              countChange = 1;
            }

            return {
              ...option,
              countanswers: Math.max(0, option.countanswers + countChange),
            };
          }),
        };

        // Update cache with optimistic data
        queryClient.setQueryData<Choice>(
          CHOICE_QUERY_KEYS.detail(choiceId),
          optimisticChoice
        );
      }

      // Return context for potential rollback
      return {
        previousChoice,
        choiceId,
      };
    },

    /**
     * Called when mutation fails.
     * Rolls back the optimistic update and shows error message.
     *
     * @param error - The error that occurred
     * @param input - The mutation input data
     * @param context - Context from onMutate for rollback
     */
    onError: (
      error: Error,
      _input: ChoiceResponseInput,
      context: MutationContext | undefined
    ): void => {
      // Rollback to previous data on error
      if (context?.previousChoice) {
        queryClient.setQueryData<Choice>(
          CHOICE_QUERY_KEYS.detail(context.choiceId),
          context.previousChoice
        );
      }

      // Show error toast with appropriate message
      const errorMessage = getErrorMessage(error);
      showError(errorMessage);
    },

    /**
     * Called when mutation succeeds.
     * Updates cache with server response and shows success message.
     *
     * @param data - The successful response data
     * @param input - The mutation input data
     */
    onSuccess: (
      data: ChoiceResponseResult,
      input: ChoiceResponseInput
    ): void => {
      const { choiceId, action = 'submit' } = input;

      // Update cache with server-confirmed data
      if (data.updatedChoice) {
        queryClient.setQueryData<Choice>(
          CHOICE_QUERY_KEYS.detail(choiceId),
          data.updatedChoice
        );
      }

      // Show success toast
      const message =
        action === 'delete'
          ? 'Your response has been deleted'
          : data.message || 'Your response has been saved';
      showSuccess(message);
    },

    /**
     * Called when mutation settles (succeeds or fails).
     * Invalidates related queries to ensure data consistency.
     *
     * @param _data - The response data (if successful)
     * @param _error - The error (if failed)
     * @param input - The mutation input data
     */
    onSettled: (
      _data: ChoiceResponseResult | undefined,
      _error: Error | null,
      input: ChoiceResponseInput
    ): void => {
      const { choiceId, courseId } = input;

      // Invalidate choice query to refetch latest data
      void queryClient.invalidateQueries({
        queryKey: CHOICE_QUERY_KEYS.detail(choiceId),
      });

      // Invalidate course activities list
      void queryClient.invalidateQueries({
        queryKey: CHOICE_QUERY_KEYS.courseActivities(courseId),
      });

      // Invalidate dashboard to update any choice widgets
      void queryClient.invalidateQueries({
        queryKey: CHOICE_QUERY_KEYS.dashboard,
      });
    },

    /**
     * Retry configuration
     * Don't retry on validation errors, retry once on network errors
     */
    retry: (failureCount: number, error: Error): boolean => {
      // Don't retry validation errors or permission errors
      const noRetryMessages = [
        'permission',
        'not allowed',
        'invalid',
        'closed',
        'full',
        'capacity',
      ];

      const errorMessage = error.message.toLowerCase();
      if (noRetryMessages.some((msg) => errorMessage.includes(msg))) {
        return false;
      }

      // Retry network errors once
      return failureCount < 1;
    },
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extracts a user-friendly error message from various error types.
 *
 * @param error - The error to extract message from
 * @returns User-friendly error message string
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for specific error codes and provide better messages
    const message = error.message.toLowerCase();

    if (message.includes('permission') || message.includes('capability')) {
      return 'You do not have permission to submit a response';
    }

    if (message.includes('closed')) {
      return 'This choice has closed and no longer accepts responses';
    }

    if (message.includes('full') || message.includes('capacity')) {
      return 'The selected option has reached its maximum capacity';
    }

    if (message.includes('multiple')) {
      return 'You can only select one option for this choice';
    }

    if (message.includes('network') || message.includes('timeout')) {
      return 'Network error. Please check your connection and try again.';
    }

    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default export for convenient importing
 *
 * @example
 * ```typescript
 * import useChoiceResponse from '@/features/activities/choice/hooks/useChoiceResponse';
 *
 * const { mutate, isPending } = useChoiceResponse();
 * ```
 */
export default useChoiceResponse;
