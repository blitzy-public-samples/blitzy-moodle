/**
 * Custom React Query mutation hook for handling feedback response submissions.
 *
 * This hook provides comprehensive functionality for submitting feedback responses
 * with support for anonymous responses, client-side validation, and optimistic updates.
 * It wraps POST /api/v1/feedback/{id}/submit and POST /api/v1/feedback/{id}/progress
 * endpoints that call existing Moodle feedback submission and completion functions.
 *
 * Key Features:
 * - Full response submission with validation
 * - Save progress for multi-page feedbacks
 * - Client-side validation before submission
 * - Optimistic updates for better UX
 * - Anonymous response support
 * - Automatic cache invalidation
 * - Comprehensive error handling
 *
 * Backend Integration:
 * - Wraps mod_feedback_completion::save_response() for final submission
 * - Wraps mod_feedback_completion::save_response_tmp() for progress saving
 * - All business logic remains in PHP backend
 * - Permission checks enforced via require_capability('mod/feedback:complete')
 *
 * @module features/activities/feedback/hooks/useFeedbackResponse
 * @see public/mod/feedback/complete.php - Feedback completion page
 * @see public/mod/feedback/classes/completion.php - Completion class
 *
 * @example
 * ```tsx
 * function FeedbackForm({ feedbackId, questions }: FeedbackFormProps) {
 *   const {
 *     submitResponse,
 *     saveProgress,
 *     isSubmitting,
 *     isSaving,
 *     validationErrors,
 *     clearErrors,
 *   } = useFeedbackResponse();
 *
 *   const handleSubmit = async (responses: Record<number, ResponseValue>) => {
 *     try {
 *       const result = await submitResponse({
 *         feedbackId,
 *         responses,
 *         anonymous: true,
 *       });
 *       console.log('Submitted! ID:', result.completed.id);
 *     } catch (error) {
 *       // Validation errors are automatically shown
 *     }
 *   };
 *
 *   const handlePageChange = async (responses: Record<number, ResponseValue>, page: number) => {
 *     await saveProgress({
 *       feedbackId,
 *       responses,
 *       currentPage: page,
 *     });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {questions.map(q => (
 *         <QuestionField
 *           key={q.id}
 *           question={q}
 *           error={validationErrors[q.id]}
 *         />
 *       ))}
 *       <Button loading={isSubmitting}>Submit</Button>
 *     </form>
 *   );
 * }
 * ```
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  submitFeedbackResponse,
  saveProgress as saveProgressApi,
} from '../api/feedbackApi';
import type { FeedbackResponse } from '../types/feedback.types';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Value type for a single response.
 *
 * Supports different value types for various question types:
 * - string: for text and textarea questions
 * - number: for numeric questions and multichoice indices
 * - string[]: for multi-select multichoice questions
 * - boolean: for checkbox-style questions
 */
export type ResponseValue = string | number | string[] | boolean;

/**
 * Options for submitting a final feedback response.
 *
 * Used to configure the submission process including course context,
 * anonymous mode, and navigation for multi-page feedbacks.
 */
export interface SubmitResponseOptions {
  /**
   * ID of the feedback activity.
   * Required - identifies which feedback is being submitted.
   */
  feedbackId: number;

  /**
   * Course ID for site-wide feedbacks.
   * Optional - only needed when a site-wide feedback is mapped to courses.
   */
  courseId?: number;

  /**
   * Whether to submit as an anonymous response.
   * Optional - when true, the response won't be associated with the user.
   * Must be allowed by the feedback's anonymous setting.
   */
  anonymous?: boolean;

  /**
   * Map of question item IDs to their response values.
   * Required - contains all answers for the feedback questions.
   */
  responses: Record<number, ResponseValue>;

  /**
   * Page number to navigate to after submission.
   * Optional - used for multi-page feedbacks to control navigation.
   */
  goToPage?: number;
}

/**
 * Options for saving feedback progress (partial responses).
 *
 * Used when users want to save their progress on a multi-page
 * feedback and continue later.
 */
export interface SaveProgressOptions {
  /**
   * ID of the feedback activity.
   * Required - identifies which feedback progress is being saved.
   */
  feedbackId: number;

  /**
   * Course ID for site-wide feedbacks.
   * Optional - only needed for site-wide feedbacks mapped to courses.
   */
  courseId?: number;

  /**
   * Map of question item IDs to their response values.
   * Can be partial - only items answered so far.
   */
  responses: Record<number, ResponseValue>;

  /**
   * Current page number in the multi-page feedback.
   * Required - used to track progress and resume position.
   */
  currentPage: number;
}

/**
 * Configuration for validating a specific question type.
 *
 * Used internally to define validation rules per question type.
 */
interface QuestionValidationConfig {
  /**
   * Item ID of the question being validated.
   */
  itemId: number;

  /**
   * Question type (multichoice, numeric, textarea, textfield, etc.).
   */
  type: string;

  /**
   * Whether the question requires an answer.
   */
  required: boolean;

  /**
   * Validation constraints specific to the question type.
   */
  constraints?: {
    /** Minimum value for numeric questions */
    min?: number;
    /** Maximum value for numeric questions */
    max?: number;
    /** Maximum length for text questions */
    maxLength?: number;
    /** Valid options for multichoice questions */
    validOptions?: string[];
  };
}

/**
 * Validation error structure for feedback responses.
 *
 * Contains information about validation failures at both
 * form and field levels.
 */
export interface FeedbackValidationError extends Error {
  /**
   * Error code for programmatic handling.
   */
  code: 'VALIDATION_ERROR' | 'PERMISSION_DENIED' | 'ALREADY_SUBMITTED' | 'FEEDBACK_CLOSED' | 'NETWORK_ERROR';

  /**
   * Per-question validation error messages.
   */
  fieldErrors: Record<number, string>;

  /**
   * Original error message.
   */
  message: string;
}

/**
 * Return type for the useFeedbackResponse hook.
 *
 * Exposes all necessary functions and state for handling
 * feedback response submissions.
 */
export interface FeedbackResponseHookResult {
  /**
   * Submit the final feedback response.
   *
   * Validates all required fields and submits the complete
   * response to the server. On success, triggers cache invalidation
   * and shows success notification.
   *
   * @param options - Submission options including feedbackId and responses
   * @returns Promise resolving to the FeedbackResponse on success
   * @throws FeedbackValidationError on validation failure
   */
  submitResponse: (options: SubmitResponseOptions) => Promise<FeedbackResponse>;

  /**
   * Save progress for later completion.
   *
   * Saves partial responses to temporary storage, allowing
   * users to resume later. Used for multi-page feedbacks.
   *
   * @param options - Save options including feedbackId, responses, and currentPage
   * @returns Promise resolving when save is complete
   */
  saveProgress: (options: SaveProgressOptions) => Promise<void>;

  /**
   * Whether a submission is currently in progress.
   */
  isSubmitting: boolean;

  /**
   * Whether a save progress operation is in progress.
   */
  isSaving: boolean;

  /**
   * Current error from submission or save operation.
   * Contains validation errors or API errors.
   */
  error: FeedbackValidationError | null;

  /**
   * Per-question validation error messages.
   * Maps item IDs to error message strings.
   */
  validationErrors: Record<number, string>;

  /**
   * Clear all validation and submission errors.
   */
  clearErrors: () => void;

  /**
   * Reset the entire submission state.
   * Clears errors and resets mutation state.
   */
  resetSubmission: () => void;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if a response value is empty.
 *
 * @param value - The response value to check
 * @returns true if the value is considered empty
 */
function isEmptyValue(value: ResponseValue | undefined): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'boolean') {
    return false; // Boolean values are never "empty"
  }
  return false; // Numbers are never empty (0 is valid)
}

/**
 * Validate a numeric response value.
 *
 * @param value - The value to validate
 * @param min - Optional minimum allowed value
 * @param max - Optional maximum allowed value
 * @returns Error message or null if valid
 */
function validateNumericValue(
  value: ResponseValue,
  min?: number,
  max?: number
): string | null {
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));

  if (isNaN(numValue)) {
    return 'Please enter a valid number';
  }

  if (min !== undefined && numValue < min) {
    return `Value must be at least ${min}`;
  }

  if (max !== undefined && numValue > max) {
    return `Value must be at most ${max}`;
  }

  return null;
}

/**
 * Validate a text response value.
 *
 * @param value - The value to validate
 * @param maxLength - Optional maximum character length
 * @returns Error message or null if valid
 */
function validateTextValue(
  value: ResponseValue,
  maxLength?: number
): string | null {
  const strValue = String(value);

  if (maxLength !== undefined && strValue.length > maxLength) {
    return `Response must be ${maxLength} characters or fewer`;
  }

  return null;
}

/**
 * Validate a multichoice response value.
 *
 * @param value - The value to validate
 * @param validOptions - Array of valid option identifiers
 * @returns Error message or null if valid
 */
function validateMultichoiceValue(
  value: ResponseValue,
  validOptions?: string[]
): string | null {
  if (!validOptions || validOptions.length === 0) {
    return null; // No validation if options not provided
  }

  const selectedValues = Array.isArray(value) ? value : [String(value)];

  for (const selected of selectedValues) {
    if (!validOptions.includes(String(selected))) {
      return 'Please select a valid option';
    }
  }

  return null;
}

/**
 * Validate a single question response.
 *
 * @param config - Validation configuration for the question
 * @param value - The response value to validate
 * @returns Error message or null if valid
 */
function validateQuestion(
  config: QuestionValidationConfig,
  value: ResponseValue | undefined
): string | null {
  // Check required field
  if (config.required && isEmptyValue(value)) {
    return 'This field is required';
  }

  // Skip further validation if empty and not required
  if (isEmptyValue(value)) {
    return null;
  }

  // Type-specific validation
  switch (config.type) {
    case 'numeric':
      return validateNumericValue(
        value as ResponseValue,
        config.constraints?.min,
        config.constraints?.max
      );

    case 'textfield':
    case 'textarea':
      return validateTextValue(
        value as ResponseValue,
        config.constraints?.maxLength
      );

    case 'multichoice':
    case 'multichoicerated':
      return validateMultichoiceValue(
        value as ResponseValue,
        config.constraints?.validOptions
      );

    default:
      return null;
  }
}

/**
 * Create a FeedbackValidationError from validation results.
 *
 * @param fieldErrors - Map of item IDs to error messages
 * @returns FeedbackValidationError instance
 */
function createValidationError(
  fieldErrors: Record<number, string>
): FeedbackValidationError {
  const errorCount = Object.keys(fieldErrors).length;
  const error = new Error(
    `Please correct ${errorCount} error${errorCount > 1 ? 's' : ''} before submitting`
  ) as FeedbackValidationError;

  error.code = 'VALIDATION_ERROR';
  error.fieldErrors = fieldErrors;
  error.name = 'FeedbackValidationError';

  return error;
}

/**
 * Parse API error into FeedbackValidationError.
 *
 * @param error - The error from the API call
 * @returns Normalized FeedbackValidationError
 */
function parseApiError(error: unknown): FeedbackValidationError {
  const validationError = new Error('An error occurred') as FeedbackValidationError;
  validationError.fieldErrors = {};

  if (error instanceof Error) {
    validationError.message = error.message;

    // Check for specific error types from API
    if (error.message.includes('permission') || error.message.includes('capability')) {
      validationError.code = 'PERMISSION_DENIED';
      validationError.message = 'You do not have permission to complete this feedback';
    } else if (error.message.includes('already submitted') || error.message.includes('already completed')) {
      validationError.code = 'ALREADY_SUBMITTED';
      validationError.message = 'You have already submitted this feedback';
    } else if (error.message.includes('closed') || error.message.includes('not open')) {
      validationError.code = 'FEEDBACK_CLOSED';
      validationError.message = 'This feedback is not currently open for submissions';
    } else {
      validationError.code = 'NETWORK_ERROR';
    }
  } else {
    validationError.code = 'NETWORK_ERROR';
    validationError.message = 'A network error occurred. Please try again.';
  }

  return validationError;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Custom React Query mutation hook for handling feedback response submissions.
 *
 * Provides submitResponse and saveProgress functions with comprehensive
 * error handling, automatic cache invalidation, and integration with
 * the feedback completion workflow.
 *
 * Features:
 * - Client-side validation before submission
 * - Optimistic updates for responsive UI
 * - Anonymous response support
 * - Multi-page feedback progress saving
 * - Automatic cache invalidation on success
 * - Toast notifications for user feedback
 *
 * @returns FeedbackResponseHookResult with submission functions and state
 *
 * @example
 * ```tsx
 * const { submitResponse, isSubmitting, validationErrors } = useFeedbackResponse();
 *
 * // Submit feedback
 * const result = await submitResponse({
 *   feedbackId: 42,
 *   responses: { 101: 'Answer', 102: 5 },
 *   anonymous: true,
 * });
 * ```
 */
export function useFeedbackResponse(): FeedbackResponseHookResult {
  // Get query client for cache manipulation
  const queryClient = useQueryClient();

  // Toast notifications for user feedback
  const { success: showSuccess, error: showError } = useToast();

  // Local state for validation errors
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});

  // ============================================================================
  // SUBMIT RESPONSE MUTATION
  // ============================================================================

  /**
   * Mutation for submitting final feedback response.
   *
   * Handles validation, optimistic updates, and cache invalidation.
   */
  const submitMutation = useMutation<
    FeedbackResponse,
    FeedbackValidationError,
    SubmitResponseOptions,
    { previousFeedback: unknown; previousResponses: unknown }
  >({
    mutationFn: async (options: SubmitResponseOptions): Promise<FeedbackResponse> => {
      // Clear previous validation errors
      setValidationErrors({});

      // Convert responses to API format
      const apiResponses: Record<number, string | number | string[]> = {};
      for (const [itemId, value] of Object.entries(options.responses)) {
        const numericItemId = Number(itemId);
        if (typeof value === 'boolean') {
          apiResponses[numericItemId] = value ? '1' : '0';
        } else {
          apiResponses[numericItemId] = value;
        }
      }

      // Submit to API
      // Note: ApiResponse<T> always has success: true. If an error occurs,
      // axios throws an exception caught by the mutation's onError handler.
      const response = await submitFeedbackResponse(options.feedbackId, {
        ...apiResponses,
        courseid: options.courseId,
        gopage: options.goToPage,
      });

      // Transform API response to FeedbackResponse type
      const feedbackResponse: FeedbackResponse = {
        completed: {
          id: response.data.completedId,
          feedback: options.feedbackId,
          userid: 0, // Backend handles this
          timemodified: Math.floor(Date.now() / 1000),
          random_response: 0,
          anonymous_response: options.anonymous ? 1 : 0,
          courseid: options.courseId ?? 0,
        },
        values: Object.entries(options.responses).map(([itemId, value]) => ({
          itemId: Number(itemId),
          value: typeof value === 'boolean' ? (value ? '1' : '0') : String(value),
        })),
        isTemporary: false,
        currentPage: options.goToPage,
      };

      return feedbackResponse;
    },

    onMutate: async (options: SubmitResponseOptions) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['feedback', options.feedbackId] });
      await queryClient.cancelQueries({
        queryKey: ['feedback', 'responses', options.feedbackId],
      });

      // Snapshot previous values for rollback
      const previousFeedback = queryClient.getQueryData([
        'feedback',
        options.feedbackId,
      ]);
      const previousResponses = queryClient.getQueryData([
        'feedback',
        'responses',
        options.feedbackId,
      ]);

      // Optimistically update feedback status to show as completed
      queryClient.setQueryData(
        ['feedback', 'status', options.feedbackId],
        (old: unknown) => {
          if (old && typeof old === 'object') {
            return {
              ...old,
              isSubmitted: true,
              canSubmit: false,
            };
          }
          return old;
        }
      );

      return { previousFeedback, previousResponses };
    },

    onError: (error: FeedbackValidationError, options: SubmitResponseOptions, context) => {
      // Rollback optimistic update
      if (context?.previousFeedback) {
        queryClient.setQueryData(
          ['feedback', options.feedbackId],
          context.previousFeedback
        );
      }

      // Update validation errors state
      if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
        setValidationErrors(error.fieldErrors);
      }

      // Show error notification
      showError(error.message || 'Failed to submit feedback');
    },

    onSuccess: (_data: FeedbackResponse, options: SubmitResponseOptions) => {
      // Invalidate relevant queries to trigger refetch
      void queryClient.invalidateQueries({ queryKey: ['feedback', options.feedbackId] });
      void queryClient.invalidateQueries({
        queryKey: ['feedback', 'responses', options.feedbackId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['feedback', 'status', options.feedbackId],
      });

      // Invalidate user dashboard queries to update completion counts
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['user', 'courses'] });

      // Show success notification
      showSuccess('Feedback submitted successfully');
    },
  });

  // ============================================================================
  // SAVE PROGRESS MUTATION
  // ============================================================================

  /**
   * Mutation for saving feedback progress (partial responses).
   *
   * Used for multi-page feedbacks to save progress and allow
   * users to resume later.
   */
  const saveProgressMutation = useMutation<
    void,
    FeedbackValidationError,
    SaveProgressOptions,
    { previousProgress: unknown }
  >({
    mutationFn: async (options: SaveProgressOptions): Promise<void> => {
      // Convert responses to API format
      const apiResponses: Record<number, string | number | string[]> = {};
      for (const [itemId, value] of Object.entries(options.responses)) {
        const numericItemId = Number(itemId);
        if (typeof value === 'boolean') {
          apiResponses[numericItemId] = value ? '1' : '0';
        } else {
          apiResponses[numericItemId] = value;
        }
      }

      // Save to API
      // Note: ApiResponse<T> always has success: true. If an error occurs,
      // axios throws an exception caught by the mutation's onError handler.
      await saveProgressApi(options.feedbackId, {
        ...apiResponses,
        courseid: options.courseId,
        gopage: options.currentPage,
      });
    },

    onMutate: (options: SaveProgressOptions) => {
      // Snapshot previous progress data
      const previousProgress = queryClient.getQueryData([
        'feedback',
        'progress',
        options.feedbackId,
      ]);

      // Optimistically update progress indicator
      queryClient.setQueryData(
        ['feedback', 'progress', options.feedbackId],
        (old: unknown) => {
          if (old && typeof old === 'object') {
            return {
              ...old,
              currentPage: options.currentPage,
              savedValues: options.responses,
              lastSaved: Date.now(),
            };
          }
          return {
            currentPage: options.currentPage,
            savedValues: options.responses,
            lastSaved: Date.now(),
          };
        }
      );

      return { previousProgress };
    },

    onError: (_error: FeedbackValidationError, options: SaveProgressOptions, context) => {
      // Rollback optimistic update
      if (context?.previousProgress) {
        queryClient.setQueryData(
          ['feedback', 'progress', options.feedbackId],
          context.previousProgress
        );
      }

      // Show error notification for save failures
      showError('Failed to save progress. Please try again.');
    },

    onSuccess: (_data: void, options: SaveProgressOptions) => {
      // Update progress cache with confirmation
      queryClient.setQueryData(
        ['feedback', 'progress', options.feedbackId],
        (old: unknown) => {
          if (old && typeof old === 'object') {
            return {
              ...old,
              saved: true,
              lastSaved: Date.now(),
            };
          }
          return old;
        }
      );

      // Show subtle success notification
      showSuccess('Progress saved');
    },
  });

  // ============================================================================
  // CALLBACK FUNCTIONS
  // ============================================================================

  /**
   * Clear all validation errors.
   *
   * Resets the validationErrors state to an empty object.
   * Use when user modifies their responses or navigates away.
   */
  const clearErrors = useCallback((): void => {
    setValidationErrors({});
  }, []);

  /**
   * Reset the entire submission state.
   *
   * Clears validation errors and resets both mutations.
   * Use when starting a new submission or unmounting the form.
   */
  const resetSubmission = useCallback((): void => {
    setValidationErrors({});
    submitMutation.reset();
    saveProgressMutation.reset();
  }, [submitMutation, saveProgressMutation]);

  /**
   * Submit feedback response wrapper.
   *
   * Wraps the mutation with additional client-side validation
   * and transforms the result to a consistent format.
   */
  const submitResponse = useCallback(
    async (options: SubmitResponseOptions): Promise<FeedbackResponse> => {
      // Clear previous errors before submission
      clearErrors();

      try {
        // Execute the mutation
        const result = await submitMutation.mutateAsync(options);
        return result;
      } catch (error) {
        // Parse and transform error
        const validationError = parseApiError(error);
        throw validationError;
      }
    },
    [submitMutation, clearErrors]
  );

  /**
   * Save progress wrapper.
   *
   * Wraps the save progress mutation with error handling.
   */
  const saveProgress = useCallback(
    async (options: SaveProgressOptions): Promise<void> => {
      try {
        await saveProgressMutation.mutateAsync(options);
      } catch (error) {
        // Re-throw as validation error for consistent handling
        const validationError = parseApiError(error);
        throw validationError;
      }
    },
    [saveProgressMutation]
  );

  // ============================================================================
  // RETURN HOOK RESULT
  // ============================================================================

  return {
    submitResponse,
    saveProgress,
    isSubmitting: submitMutation.isPending,
    isSaving: saveProgressMutation.isPending,
    error: (submitMutation.error ?? saveProgressMutation.error),
    validationErrors,
    clearErrors,
    resetSubmission,
  };
}

// Export validation helpers for use in components
export { validateQuestion, createValidationError, isEmptyValue };
export type { QuestionValidationConfig };
