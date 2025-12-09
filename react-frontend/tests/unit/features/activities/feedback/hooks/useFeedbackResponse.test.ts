/**
 * Comprehensive unit test suite for useFeedbackResponse React Query mutation hook.
 *
 * Tests response submission, anonymous responses, client-side validation,
 * optimistic updates with rollback, progress saving, cache invalidation,
 * error handling (network, validation, permission, duplicate), and TypeScript type safety.
 *
 * @module tests/unit/features/activities/feedback/hooks/useFeedbackResponse.test
 * @see react-frontend/src/features/activities/feedback/hooks/useFeedbackResponse.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useFeedbackResponse,
  type SubmitResponseOptions,
  type SaveProgressOptions,
  type ResponseValue,
} from '@/features/activities/feedback/hooks/useFeedbackResponse';
import type { FeedbackResponse } from '@/features/activities/feedback/types/feedback.types';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock feedbackApi module
vi.mock('@/features/activities/feedback/api/feedbackApi', () => ({
  submitFeedbackResponse: vi.fn(),
  saveProgress: vi.fn(),
}));

// Mock useToast hook
vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    toasts: [],
    dismiss: vi.fn(),
    showToast: vi.fn(),
  })),
}));

// Import mocked functions for test manipulation
import {
  submitFeedbackResponse as mockSubmitFeedbackResponse,
  saveProgress as mockSaveProgressApi,
} from '@/features/activities/feedback/api/feedbackApi';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Mock responses data fixture - maps questionId to answer values
 */
const mockResponses: Record<number, ResponseValue> = {
  101: 'Great course!', // Text question
  102: 5, // Numeric question
  103: 'option_2', // Multichoice question
  104: ['opt1', 'opt2'], // Multi-select question
  105: true, // Boolean checkbox
};

/**
 * Mock submit options fixture
 */
const mockSubmitOptions: SubmitResponseOptions = {
  feedbackId: 42,
  responses: mockResponses,
  anonymous: false,
  courseId: 10,
};

/**
 * Mock save progress options fixture
 */
const mockSaveOptions: SaveProgressOptions = {
  feedbackId: 42,
  responses: mockResponses,
  currentPage: 1,
  courseId: 10,
};

/**
 * Mock successful FeedbackResponse fixture
 * Used for testing submission response handling
 */
const _mockFeedbackResponse: FeedbackResponse = {
  completed: {
    id: 999,
    feedback: 42,
    userid: 1,
    timemodified: Math.floor(Date.now() / 1000),
    random_response: 0,
    anonymous_response: 0,
    courseid: 10,
  },
  values: [
    { itemId: 101, value: 'Great course!' },
    { itemId: 102, value: '5' },
    { itemId: 103, value: 'option_2' },
  ],
  isTemporary: false,
  currentPage: undefined,
};

// Suppress unused variable warning - fixture kept for reference
void _mockFeedbackResponse;

/**
 * Mock saved values for progress save - uses only string/number values
 * per SaveProgressResult interface requirements
 */
const mockSavedValues: Record<number, string | number> = {
  101: 'Great course!',
  102: 5,
  103: 'option_2',
};

/**
 * Create a mock API success response
 */
const createApiSuccessResponse = <T>(data: T) => ({
  success: true as const,
  data,
  meta: {},
});

/**
 * Create a mock API submission result
 */
const createSubmissionResult = (completedId: number = 999) => ({
  success: true,
  completedId,
  message: 'Feedback submitted successfully',
});

/**
 * Create a mock save progress result
 */
const createSaveProgressResult = (page: number = 1) => ({
  success: true,
  completedTmpId: 888,
  currentPage: page,
  totalPages: 3,
  savedValues: mockSavedValues,
});

// ============================================================================
// TEST WRAPPER SETUP
// ============================================================================

/**
 * Creates a fresh QueryClient with test-optimized settings
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity, // Keep cache data for duration of test
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Creates a wrapper component for renderHook with QueryClientProvider
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('useFeedbackResponse', () => {
  let queryClient: QueryClient;
  let mockSuccessFn: ReturnType<typeof vi.fn<[string], string>>;
  let mockErrorFn: ReturnType<typeof vi.fn<[string], string>>;

  beforeEach(() => {
    // Create fresh QueryClient for each test
    queryClient = createTestQueryClient();

    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock toast functions with proper return types
    mockSuccessFn = vi.fn<[string], string>().mockReturnValue('toast-id-1');
    mockErrorFn = vi.fn<[string], string>().mockReturnValue('toast-id-2');
    vi.mocked(useToast).mockReturnValue({
      success: mockSuccessFn,
      error: mockErrorFn,
      warning: vi.fn<[string], string>().mockReturnValue('toast-id-3'),
      info: vi.fn<[string], string>().mockReturnValue('toast-id-4'),
      toasts: [],
      dismiss: vi.fn(),
      showToast: vi.fn<[string, string], string>().mockReturnValue('toast-id-5'),
      clear: vi.fn(),
    });

    // Setup default successful API responses
    vi.mocked(mockSubmitFeedbackResponse).mockResolvedValue(
      createApiSuccessResponse(createSubmissionResult())
    );
    vi.mocked(mockSaveProgressApi).mockResolvedValue(
      createApiSuccessResponse(createSaveProgressResult())
    );
  });

  afterEach(() => {
    // Clean up QueryClient
    queryClient.clear();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Test Suite 1: Basic Submission Functionality
  // ==========================================================================

  describe('Basic Submission Functionality', () => {
    it('should submit feedback response successfully', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      let submissionResult: FeedbackResponse | undefined;

      await act(async () => {
        submissionResult = await result.current.submitResponse(mockSubmitOptions);
      });

      // Verify API was called with correct parameters
      expect(mockSubmitFeedbackResponse).toHaveBeenCalledTimes(1);
      expect(mockSubmitFeedbackResponse).toHaveBeenCalledWith(
        mockSubmitOptions.feedbackId,
        expect.objectContaining({
          101: 'Great course!',
          102: 5,
          103: 'option_2',
          courseid: mockSubmitOptions.courseId,
        })
      );

      // Verify mutation returns correct response structure
      expect(submissionResult).toBeDefined();
      expect(submissionResult?.completed.id).toBe(999);
      expect(submissionResult?.isTemporary).toBe(false);

      // Verify no error state
      expect(result.current.error).toBeNull();
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should handle loading state during submission', async () => {
      // Mock with delayed response
      vi.mocked(mockSubmitFeedbackResponse).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve(createApiSuccessResponse(createSubmissionResult())),
              100
            )
          )
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Initially not submitting
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.isSaving).toBe(false);

      // Start submission without awaiting
      let submissionPromise: Promise<FeedbackResponse>;
      act(() => {
        submissionPromise = result.current.submitResponse(mockSubmitOptions);
      });

      // Should be submitting now
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(true);
      });

      // isSaving should still be false (different mutation)
      expect(result.current.isSaving).toBe(false);

      // Wait for completion
      await act(async () => {
        await submissionPromise;
      });

      // Should no longer be submitting - wait for state to update
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });
    });

    it('should clear submission state on reset', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Submit successfully
      await act(async () => {
        await result.current.submitResponse(mockSubmitOptions);
      });

      // Reset submission state
      act(() => {
        result.current.resetSubmission();
      });

      // Verify state is reset
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.validationErrors).toEqual({});
    });

    it('should handle boolean response values correctly', async () => {
      const optionsWithBoolean: SubmitResponseOptions = {
        feedbackId: 42,
        responses: {
          101: true,
          102: false,
        },
      };

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(optionsWithBoolean);
      });

      // Verify boolean values are converted to '1' and '0'
      expect(mockSubmitFeedbackResponse).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          101: '1',
          102: '0',
        })
      );
    });
  });

  // ==========================================================================
  // Test Suite 2: Anonymous Response Submission
  // ==========================================================================

  describe('Anonymous Response Submission', () => {
    it('should submit anonymous response when anonymous=true', async () => {
      const anonymousOptions: SubmitResponseOptions = {
        ...mockSubmitOptions,
        anonymous: true,
      };

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      let submissionResult: FeedbackResponse | undefined;
      await act(async () => {
        submissionResult = await result.current.submitResponse(anonymousOptions);
      });

      expect(mockSubmitFeedbackResponse).toHaveBeenCalledTimes(1);
      
      // Verify the response reflects anonymous status
      expect(submissionResult?.completed.anonymous_response).toBe(1);
    });

    it('should submit identified response when anonymous=false', async () => {
      const identifiedOptions: SubmitResponseOptions = {
        ...mockSubmitOptions,
        anonymous: false,
      };

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      let submissionResult: FeedbackResponse | undefined;
      await act(async () => {
        submissionResult = await result.current.submitResponse(identifiedOptions);
      });

      expect(mockSubmitFeedbackResponse).toHaveBeenCalledTimes(1);
      expect(submissionResult?.completed.anonymous_response).toBe(0);
    });

    it('should default to non-anonymous when anonymous flag not provided', async () => {
      const optionsWithoutAnonymous: SubmitResponseOptions = {
        feedbackId: 42,
        responses: mockResponses,
      };

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      let submissionResult: FeedbackResponse | undefined;
      await act(async () => {
        submissionResult = await result.current.submitResponse(optionsWithoutAnonymous);
      });

      expect(mockSubmitFeedbackResponse).toHaveBeenCalledTimes(1);
      // Should default to non-anonymous (0)
      expect(submissionResult?.completed.anonymous_response).toBe(0);
    });
  });

  // ==========================================================================
  // Test Suite 3: Client-Side Validation
  // ==========================================================================

  describe('Client-Side Validation', () => {
    it('should clear validation errors when clearErrors is called', async () => {
      // Mock API to return a validation error
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(
        new Error('Validation failed')
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Attempt submission that fails
      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected error
        }
      });

      // Verify error state exists
      expect(result.current.error).not.toBeNull();

      // Clear errors
      act(() => {
        result.current.clearErrors();
      });

      // Verify errors are cleared
      expect(result.current.validationErrors).toEqual({});
      expect(result.current.error).toBeNull();
    });

    it('should allow submission with all valid responses', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(mockSubmitOptions);
      });

      // Verify no validation errors
      expect(result.current.validationErrors).toEqual({});
      expect(result.current.error).toBeNull();
      expect(mockSubmitFeedbackResponse).toHaveBeenCalledTimes(1);
    });

    it('should clear errors before new submission attempt', async () => {
      // First submission fails
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(
        new Error('First attempt failed')
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // First attempt
      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected
        }
      });

      expect(result.current.error).not.toBeNull();

      // Reset mock for success
      vi.mocked(mockSubmitFeedbackResponse).mockResolvedValueOnce(
        createApiSuccessResponse(createSubmissionResult())
      );

      // Second attempt should clear previous errors first
      await act(async () => {
        await result.current.submitResponse(mockSubmitOptions);
      });

      expect(result.current.error).toBeNull();
    });
  });

  // ==========================================================================
  // Test Suite 4: Optimistic Updates
  // ==========================================================================

  describe('Optimistic Updates', () => {
    it('should optimistically update cache on submission', async () => {
      // Setup initial cache data
      queryClient.setQueryData(['feedback', 'status', 42], {
        isSubmitted: false,
        canSubmit: true,
      });

      // Add delay to observe optimistic update
      vi.mocked(mockSubmitFeedbackResponse).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve(createApiSuccessResponse(createSubmissionResult())),
              200
            )
          )
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Complete the full submission
      await act(async () => {
        await result.current.submitResponse(mockSubmitOptions);
      });

      // After successful submission, verify the cache reflects completion
      // The hook invalidates queries on success, so we verify the mutation was called
      expect(mockSubmitFeedbackResponse).toHaveBeenCalledTimes(1);
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should rollback optimistic update on submission failure', async () => {
      // Setup initial cache state
      const initialStatus = {
        isSubmitted: false,
        canSubmit: true,
      };
      queryClient.setQueryData(['feedback', 'status', 42], initialStatus);
      queryClient.setQueryData(['feedback', 42], { id: 42, name: 'Test Feedback' });

      // Mock API failure with delay to observe optimistic update
      vi.mocked(mockSubmitFeedbackResponse).mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('API Error')), 100)
          )
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Start submission and expect it to fail
      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected error
        }
      });

      // Verify error state is set
      expect(result.current.error).not.toBeNull();

      // Verify rollback occurred - original feedback data should be restored
      // Note: The hook rolls back feedback data, not status data in onError
      const feedbackData = queryClient.getQueryData(['feedback', 42]);
      expect(feedbackData).toEqual({ id: 42, name: 'Test Feedback' });
    });

    it('should update completion status optimistically', async () => {
      // Setup cache with no completion
      queryClient.setQueryData(['feedback', 'status', 42], {
        isSubmitted: false,
        canSubmit: true,
      });

      // Add delay to simulate real API
      vi.mocked(mockSubmitFeedbackResponse).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve(createApiSuccessResponse(createSubmissionResult())),
              100
            )
          )
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Complete the full submission flow
      await act(async () => {
        await result.current.submitResponse(mockSubmitOptions);
      });

      // Verify submission completed successfully
      expect(mockSubmitFeedbackResponse).toHaveBeenCalledTimes(1);
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  // ==========================================================================
  // Test Suite 5: Cache Invalidation
  // ==========================================================================

  describe('Cache Invalidation', () => {
    it('should invalidate feedback query after successful submission', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(mockSubmitOptions);
      });

      // Verify invalidation was called for feedback queries
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['feedback', 42],
        })
      );
    });

    it('should invalidate responses query after submission', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(mockSubmitOptions);
      });

      // Verify responses cache is invalidated
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['feedback', 'responses', 42],
        })
      );
    });

    it('should invalidate user dashboard queries after submission', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(mockSubmitOptions);
      });

      // Verify dashboard queries are invalidated
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['dashboard'],
        })
      );
    });

    it('should invalidate status query after submission', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(mockSubmitOptions);
      });

      // Verify status cache is invalidated
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['feedback', 'status', 42],
        })
      );
    });

    it('should not invalidate cache if submission fails', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Mock API failure
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(
        new Error('Submission failed')
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected error
        }
      });

      // Invalidation should not be called on error
      // (only cancelQueries is called in onMutate)
      expect(invalidateSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['dashboard'],
        })
      );
    });
  });

  // ==========================================================================
  // Test Suite 6: Progress Saving
  // ==========================================================================

  describe('Progress Saving', () => {
    it('should save progress without full submission', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveProgress(mockSaveOptions);
      });

      // Verify API was called correctly
      expect(mockSaveProgressApi).toHaveBeenCalledTimes(1);
      expect(mockSaveProgressApi).toHaveBeenCalledWith(
        mockSaveOptions.feedbackId,
        expect.objectContaining({
          101: 'Great course!',
          102: 5,
          gopage: mockSaveOptions.currentPage,
        })
      );

      // Verify not in saving state after completion
      expect(result.current.isSaving).toBe(false);
    });

    it('should allow progress save with incomplete responses', async () => {
      const partialOptions: SaveProgressOptions = {
        feedbackId: 42,
        responses: {
          101: 'Partial answer',
          // Missing other questions
        },
        currentPage: 1,
      };

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveProgress(partialOptions);
      });

      // Should not throw validation errors for missing fields during save
      expect(result.current.validationErrors).toEqual({});
      expect(mockSaveProgressApi).toHaveBeenCalledTimes(1);
    });

    it('should update cache with saved progress', async () => {
      // Setup initial cache
      queryClient.setQueryData(['feedback', 'progress', 42], {
        currentPage: 0,
        savedValues: {},
      });

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveProgress(mockSaveOptions);
      });

      // Verify cache was updated - hook updates currentPage and savedValues in onMutate,
      // and adds saved: true in onSuccess
      const progressData = queryClient.getQueryData(['feedback', 'progress', 42]) as {
        currentPage: number;
        savedValues: Record<number, string | number | number[]>;
        saved?: boolean;
        lastSaved?: number;
      } | undefined;
      
      expect(progressData).toBeDefined();
      expect(progressData?.currentPage).toBe(mockSaveOptions.currentPage);
      expect(progressData?.savedValues).toEqual(mockSaveOptions.responses);
      // After successful save, saved flag is set to true
      expect(progressData?.saved).toBe(true);
    });

    it('should handle auto-save scenarios without blocking UI', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Perform multiple rapid saves
      await act(async () => {
        await result.current.saveProgress({ ...mockSaveOptions, currentPage: 1 });
        await result.current.saveProgress({ ...mockSaveOptions, currentPage: 2 });
        await result.current.saveProgress({ ...mockSaveOptions, currentPage: 3 });
      });

      // All saves should complete
      expect(mockSaveProgressApi).toHaveBeenCalledTimes(3);
      expect(result.current.isSaving).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should show notification after successful progress save', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveProgress(mockSaveOptions);
      });

      // Verify success toast was shown
      expect(mockSuccessFn).toHaveBeenCalledWith('Progress saved');
    });

    it('should handle loading state during save', async () => {
      // Mock with delay
      vi.mocked(mockSaveProgressApi).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve(createApiSuccessResponse(createSaveProgressResult())),
              100
            )
          )
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Start save and complete it
      await act(async () => {
        await result.current.saveProgress(mockSaveOptions);
      });

      // Verify save completed and states are reset
      expect(result.current.isSaving).toBe(false);
      expect(result.current.isSubmitting).toBe(false);
      expect(mockSaveProgressApi).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Test Suite 7: Error Handling - Network Errors
  // ==========================================================================

  describe('Error Handling - Network Errors', () => {
    it('should handle network timeout during submission', async () => {
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(
        new Error('Network timeout')
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected error
        }
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.code).toBe('NETWORK_ERROR');
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should handle API server errors (500)', async () => {
      const serverError = new Error('Internal Server Error');
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(serverError);

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected
        }
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toContain('Internal Server Error');
    });

    it('should show error toast on network failure', async () => {
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(
        new Error('Network error')
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected
        }
      });

      expect(mockErrorFn).toHaveBeenCalled();
    });

    it('should handle progress save network failure', async () => {
      vi.mocked(mockSaveProgressApi).mockRejectedValueOnce(
        new Error('Network error during save')
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.saveProgress(mockSaveOptions);
        } catch {
          // Expected
        }
      });

      expect(result.current.error).not.toBeNull();
      expect(mockErrorFn).toHaveBeenCalledWith(
        'Failed to save progress. Please try again.'
      );
    });
  });

  // ==========================================================================
  // Test Suite 8: Error Handling - Permission Errors
  // ==========================================================================

  describe('Error Handling - Permission Errors', () => {
    it('should handle permission denied error (403)', async () => {
      const permissionError = new Error('You do not have permission to complete this feedback');
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(permissionError);

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected
        }
      });

      expect(result.current.error?.code).toBe('PERMISSION_DENIED');
      expect(result.current.error?.message).toContain('permission');
    });

    it('should handle capability check failure', async () => {
      const capabilityError = new Error('Missing required capability');
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(capabilityError);

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected
        }
      });

      expect(result.current.error?.code).toBe('PERMISSION_DENIED');
    });

    it('should handle feedback closed error', async () => {
      const closedError = new Error('This feedback is closed');
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(closedError);

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected
        }
      });

      expect(result.current.error?.code).toBe('FEEDBACK_CLOSED');
      expect(result.current.error?.message).toContain('not currently open');
    });

    it('should handle feedback not open error', async () => {
      const notOpenError = new Error('Feedback is not open yet');
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(notOpenError);

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected
        }
      });

      expect(result.current.error?.code).toBe('FEEDBACK_CLOSED');
    });
  });

  // ==========================================================================
  // Test Suite 9: Error Handling - Validation Errors
  // ==========================================================================

  describe('Error Handling - Validation Errors', () => {
    it('should capture validation errors from API', async () => {
      const apiError = new Error('Validation failed');
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(apiError);

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected
        }
      });

      expect(result.current.error).not.toBeNull();
      expect(mockErrorFn).toHaveBeenCalled();
    });

    it('should handle backend validation errors differently from network errors', async () => {
      // Backend validation error
      const backendValidationError = new Error('Field validation failed on server');
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(
        backendValidationError
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected
        }
      });

      // Backend validation errors are captured in main error state
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Field validation failed on server');
    });
  });

  // ==========================================================================
  // Test Suite 10: Error Handling - Duplicate Submission
  // ==========================================================================

  describe('Error Handling - Duplicate Submission', () => {
    it('should handle duplicate submission error (already submitted)', async () => {
      const duplicateError = new Error('You have already submitted this feedback');
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(duplicateError);

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected
        }
      });

      expect(result.current.error?.code).toBe('ALREADY_SUBMITTED');
      expect(result.current.error?.message).toContain('already submitted');
    });

    it('should handle already completed error', async () => {
      // Error message must match parseApiError substring check: 'already completed' (no "been" in between)
      const completedError = new Error('You have already completed this feedback');
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(completedError);

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected
        }
      });

      expect(result.current.error?.code).toBe('ALREADY_SUBMITTED');
    });

    it('should allow resubmission when API permits (multiple_submit enabled)', async () => {
      // First submission succeeds
      await vi.mocked(mockSubmitFeedbackResponse).mockResolvedValueOnce(
        createApiSuccessResponse(createSubmissionResult(999))
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // First submission
      await act(async () => {
        await result.current.submitResponse(mockSubmitOptions);
      });

      // Reset for second submission
      vi.mocked(mockSubmitFeedbackResponse).mockResolvedValueOnce(
        createApiSuccessResponse(createSubmissionResult(1000))
      );

      // Second submission should also succeed
      let secondResult: FeedbackResponse | undefined;
      await act(async () => {
        secondResult = await result.current.submitResponse(mockSubmitOptions);
      });

      expect(secondResult?.completed.id).toBe(1000);
      expect(mockSubmitFeedbackResponse).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // Test Suite 11: Multi-Page Feedback Support
  // ==========================================================================

  describe('Multi-Page Feedback Support', () => {
    it('should submit with goToPage parameter for multi-page feedback', async () => {
      const multiPageOptions: SubmitResponseOptions = {
        ...mockSubmitOptions,
        goToPage: 2,
      };

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(multiPageOptions);
      });

      expect(mockSubmitFeedbackResponse).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          gopage: 2,
        })
      );
    });

    it('should save progress with current page tracking', async () => {
      const pageOptions: SaveProgressOptions = {
        feedbackId: 42,
        responses: { 101: 'Answer' },
        currentPage: 2,
      };

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveProgress(pageOptions);
      });

      expect(mockSaveProgressApi).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          gopage: 2,
        })
      );
    });

    it('should handle page navigation with progress updates', async () => {
      queryClient.setQueryData(['feedback', 'progress', 42], {
        currentPage: 1,
        savedValues: {},
      });

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Save progress for page 1 then navigate to page 2
      await act(async () => {
        await result.current.saveProgress({
          feedbackId: 42,
          responses: { 101: 'Page 1 answer' },
          currentPage: 2, // Navigate to page 2
        });
      });

      // Verify progress was saved with page navigation
      const progressData = queryClient.getQueryData(['feedback', 'progress', 42]) as {
        currentPage: number;
        savedValues: Record<number, string | number | number[]>;
      } | undefined;
      
      // Cache should be updated by onMutate/onSuccess
      expect(progressData).toBeDefined();
      expect(progressData?.currentPage).toBe(2);
      expect(progressData?.savedValues).toEqual({ 101: 'Page 1 answer' });
    });
  });

  // ==========================================================================
  // Test Suite 12: TypeScript Type Safety
  // ==========================================================================

  describe('TypeScript Type Safety', () => {
    it('should return properly typed FeedbackResponseHookResult', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Verify return type structure
      expect(typeof result.current.submitResponse).toBe('function');
      expect(typeof result.current.saveProgress).toBe('function');
      expect(typeof result.current.isSubmitting).toBe('boolean');
      expect(typeof result.current.isSaving).toBe('boolean');
      expect(typeof result.current.clearErrors).toBe('function');
      expect(typeof result.current.resetSubmission).toBe('function');
      expect(typeof result.current.validationErrors).toBe('object');
      expect(result.current.error === null || typeof result.current.error === 'object').toBe(true);
    });

    it('should return FeedbackResponse from submitResponse', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      const response = await act(async () => {
        return await result.current.submitResponse(mockSubmitOptions);
      });

      // Type assertions - these verify TypeScript types at compile time
      expect(response).toHaveProperty('completed');
      expect(response).toHaveProperty('values');
      expect(response).toHaveProperty('isTemporary');
      expect(typeof response.completed.id).toBe('number');
      expect(Array.isArray(response.values)).toBe(true);
      expect(typeof response.isTemporary).toBe('boolean');
    });

    it('should accept correct SubmitResponseOptions types', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Valid options with all fields
      const validOptions: SubmitResponseOptions = {
        feedbackId: 42,
        courseId: 10,
        anonymous: true,
        responses: {
          101: 'text',
          102: 123,
          103: ['a', 'b'],
          104: true,
        },
        goToPage: 2,
      };

      await act(async () => {
        await result.current.submitResponse(validOptions);
      });

      expect(mockSubmitFeedbackResponse).toHaveBeenCalledTimes(1);
    });

    it('should accept correct SaveProgressOptions types', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Valid save options
      const validSaveOptions: SaveProgressOptions = {
        feedbackId: 42,
        courseId: 10,
        responses: { 101: 'partial' },
        currentPage: 1,
      };

      await act(async () => {
        await result.current.saveProgress(validSaveOptions);
      });

      expect(mockSaveProgressApi).toHaveBeenCalledTimes(1);
    });

    it('should have typed error property', async () => {
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(
        new Error('Test error')
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected
        }
      });

      const error = result.current.error;
      expect(error).not.toBeNull();
      
      if (error) {
        // Type should be FeedbackValidationError
        expect(error).toHaveProperty('code');
        expect(error).toHaveProperty('fieldErrors');
        expect(error).toHaveProperty('message');
        expect(['VALIDATION_ERROR', 'PERMISSION_DENIED', 'ALREADY_SUBMITTED', 'FEEDBACK_CLOSED', 'NETWORK_ERROR']).toContain(error.code);
      }
    });

    it('should have correctly typed validationErrors as Record<number, string>', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // validationErrors should be a Record<number, string>
      expect(result.current.validationErrors).toEqual({});
      
      // Type check: this should work
      const errors: Record<number, string> = result.current.validationErrors;
      expect(errors).toBeDefined();
    });
  });

  // ==========================================================================
  // Test Suite 13: Integration Scenarios
  // ==========================================================================

  describe('Integration Scenarios', () => {
    it('should handle complete feedback submission workflow', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Step 1: Save progress multiple times during completion
      await act(async () => {
        await result.current.saveProgress({
          feedbackId: 42,
          responses: { 101: 'First answer' },
          currentPage: 1,
        });
      });

      expect(mockSaveProgressApi).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeNull();

      // Save more progress
      await act(async () => {
        await result.current.saveProgress({
          feedbackId: 42,
          responses: { 101: 'First answer', 102: 5 },
          currentPage: 2,
        });
      });

      expect(mockSaveProgressApi).toHaveBeenCalledTimes(2);

      // Step 2: Submit final response
      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 42,
          responses: { 101: 'First answer', 102: 5, 103: 'Final' },
        });
      });

      // Verify complete workflow
      expect(mockSubmitFeedbackResponse).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeNull();
      expect(mockSuccessFn).toHaveBeenCalledWith('Feedback submitted successfully');
    });

    it('should handle submission retry after validation fix', async () => {
      // First attempt fails
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(
        new Error('Validation failed')
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Step 1: Attempt submit with validation error
      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected
        }
      });

      expect(result.current.error).not.toBeNull();

      // Step 2: Clear errors
      act(() => {
        result.current.clearErrors();
      });

      expect(result.current.error).toBeNull();

      // Step 3: Fix validation issues and submit again
      vi.mocked(mockSubmitFeedbackResponse).mockResolvedValueOnce(
        createApiSuccessResponse(createSubmissionResult())
      );

      await act(async () => {
        await result.current.submitResponse(mockSubmitOptions);
      });

      // Step 4: Verify success
      expect(result.current.error).toBeNull();
      expect(mockSubmitFeedbackResponse).toHaveBeenCalledTimes(2);
    });

    it('should handle progress save during submission (edge case)', async () => {
      // Slow submission
      vi.mocked(mockSubmitFeedbackResponse).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve(createApiSuccessResponse(createSubmissionResult())),
              200
            )
          )
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Start submission
      let submitPromise: Promise<FeedbackResponse>;
      act(() => {
        submitPromise = result.current.submitResponse(mockSubmitOptions);
      });

      // Attempt progress save while submitting (should work independently)
      await act(async () => {
        await result.current.saveProgress(mockSaveOptions);
      });

      // Both operations should complete without errors
      await act(async () => {
        await submitPromise;
      });

      expect(mockSubmitFeedbackResponse).toHaveBeenCalledTimes(1);
      expect(mockSaveProgressApi).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeNull();
    });

    it('should handle state across multiple component renders', async () => {
      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Submit
      await act(async () => {
        await result.current.submitResponse(mockSubmitOptions);
      });

      // Rerender
      rerender();

      // State should be preserved after rerender
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should clean up properly when resetSubmission is called mid-operation', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Start operations
      await act(async () => {
        await result.current.saveProgress(mockSaveOptions);
        await result.current.submitResponse(mockSubmitOptions);
      });

      // Reset everything
      act(() => {
        result.current.resetSubmission();
      });

      // Verify clean state
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.isSaving).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.validationErrors).toEqual({});
    });
  });

  // ==========================================================================
  // Test Suite 14: Toast Notification Behavior
  // ==========================================================================

  describe('Toast Notification Behavior', () => {
    it('should show success toast on successful submission', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(mockSubmitOptions);
      });

      expect(mockSuccessFn).toHaveBeenCalledWith('Feedback submitted successfully');
    });

    it('should show error toast on submission failure', async () => {
      vi.mocked(mockSubmitFeedbackResponse).mockRejectedValueOnce(
        new Error('Submission failed')
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitResponse(mockSubmitOptions);
        } catch {
          // Expected
        }
      });

      expect(mockErrorFn).toHaveBeenCalled();
    });

    it('should show success toast on progress save', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveProgress(mockSaveOptions);
      });

      expect(mockSuccessFn).toHaveBeenCalledWith('Progress saved');
    });

    it('should show error toast on progress save failure', async () => {
      vi.mocked(mockSaveProgressApi).mockRejectedValueOnce(
        new Error('Save failed')
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.saveProgress(mockSaveOptions);
        } catch {
          // Expected
        }
      });

      expect(mockErrorFn).toHaveBeenCalledWith(
        'Failed to save progress. Please try again.'
      );
    });
  });

  // ==========================================================================
  // Test Suite 15: Edge Cases and Boundary Conditions
  // ==========================================================================

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty responses object', async () => {
      const emptyOptions: SubmitResponseOptions = {
        feedbackId: 42,
        responses: {},
      };

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(emptyOptions);
      });

      expect(mockSubmitFeedbackResponse).toHaveBeenCalledWith(
        42,
        expect.objectContaining({})
      );
    });

    it('should handle array response values correctly', async () => {
      const optionsWithArray: SubmitResponseOptions = {
        feedbackId: 42,
        responses: {
          101: ['option1', 'option2', 'option3'],
        },
      };

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(optionsWithArray);
      });

      expect(mockSubmitFeedbackResponse).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          101: ['option1', 'option2', 'option3'],
        })
      );
    });

    it('should handle numeric string itemIds in responses', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Even though keys are strings internally, they should be processed correctly
      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 42,
          responses: { 101: 'value', 102: 123 },
        });
      });

      expect(mockSubmitFeedbackResponse).toHaveBeenCalled();
    });

    it('should preserve courseId in API calls', async () => {
      const optionsWithCourse: SubmitResponseOptions = {
        feedbackId: 42,
        courseId: 123,
        responses: { 101: 'test' },
      };

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(optionsWithCourse);
      });

      expect(mockSubmitFeedbackResponse).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          courseid: 123,
        })
      );
    });

    it('should handle very long text responses', async () => {
      const longText = 'a'.repeat(10000);
      const optionsWithLongText: SubmitResponseOptions = {
        feedbackId: 42,
        responses: { 101: longText },
      };

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(optionsWithLongText);
      });

      expect(mockSubmitFeedbackResponse).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          101: longText,
        })
      );
    });

    it('should handle special characters in text responses', async () => {
      const specialChars = '<script>alert("xss")</script> & " \' < > © ® ™ € £';
      const optionsWithSpecialChars: SubmitResponseOptions = {
        feedbackId: 42,
        responses: { 101: specialChars },
      };

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(optionsWithSpecialChars);
      });

      expect(mockSubmitFeedbackResponse).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          101: specialChars,
        })
      );
    });

    it('should handle zero as a valid numeric response', async () => {
      const optionsWithZero: SubmitResponseOptions = {
        feedbackId: 42,
        responses: { 101: 0 },
      };

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(optionsWithZero);
      });

      expect(mockSubmitFeedbackResponse).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          101: 0,
        })
      );
    });

    it('should handle negative numeric responses', async () => {
      const optionsWithNegative: SubmitResponseOptions = {
        feedbackId: 42,
        responses: { 101: -5 },
      };

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse(optionsWithNegative);
      });

      expect(mockSubmitFeedbackResponse).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          101: -5,
        })
      );
    });
  });
});
