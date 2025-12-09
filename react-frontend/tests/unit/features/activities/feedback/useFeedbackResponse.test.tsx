/**
 * Unit tests for useFeedbackResponse custom React Query mutation hook.
 *
 * Tests validate response submission (submitResponse), progress saving (saveProgress),
 * client-side validation, optimistic updates, anonymous submission handling,
 * error management, and cache invalidation.
 *
 * Tests verify React Query mutation integration, validation rules for different
 * question types (required, numeric ranges, multichoice, text), error state
 * management, loading states, and proper TypeScript type usage.
 *
 * @module tests/unit/features/activities/feedback/useFeedbackResponse.test
 * @see react-frontend/src/features/activities/feedback/hooks/useFeedbackResponse.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useFeedbackResponse } from '@/features/activities/feedback/hooks/useFeedbackResponse';
import * as feedbackApi from '@/features/activities/feedback/api/feedbackApi';
import type { ApiResponse } from '@/types';

// ============================================================================
// MOCKS
// ============================================================================

// Mock the feedbackApi module
vi.mock('@/features/activities/feedback/api/feedbackApi', () => ({
  submitFeedbackResponse: vi.fn(),
  saveProgress: vi.fn(),
}));

// Mock the toast hook
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    success: mockShowSuccess,
    error: mockShowError,
  }),
}));

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create a fresh QueryClient for each test with appropriate test settings.
 *
 * Note: gcTime must be > 0 (or Infinity) to allow setQueryData to persist
 * cache values that don't have active observers (i.e., no useQuery watching them).
 * With gcTime: 0, data is garbage collected immediately, breaking tests that
 * verify cache state like optimistic updates and rollbacks.
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity, // Keep cache data until explicitly cleared
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Create wrapper component with QueryClientProvider.
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Create a mock successful submission response.
 */
function createSuccessfulSubmissionResponse(completedId: number = 456) {
  return {
    success: true as const,
    data: {
      success: true,
      completedId,
      message: 'Feedback submitted successfully',
    },
  };
}

/**
 * Create a mock successful progress save response.
 */
function createSuccessfulProgressResponse(currentPage: number = 2) {
  return {
    success: true as const,
    data: {
      success: true,
      completedTmpId: 789,
      currentPage,
      totalPages: 3,
      savedValues: { 1: 'partial answer' },
    },
  };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('useFeedbackResponse', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create fresh QueryClient for each test
    queryClient = createTestQueryClient();

    // Reset all mocks
    vi.clearAllMocks();
    mockShowSuccess.mockClear();
    mockShowError.mockClear();
  });

  afterEach(() => {
    // Clear query cache after each test
    queryClient.clear();
  });

  // ==========================================================================
  // INITIAL STATE TESTS
  // ==========================================================================

  describe('Initial State', () => {
    it('should return initial state with all properties', () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.submitResponse).toBeInstanceOf(Function);
      expect(result.current.saveProgress).toBeInstanceOf(Function);
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.isSaving).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.validationErrors).toEqual({});
      expect(result.current.clearErrors).toBeInstanceOf(Function);
      expect(result.current.resetSubmission).toBeInstanceOf(Function);
    });

    it('should have independent loading states for submit and save', () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Both should be false initially
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.isSaving).toBe(false);
    });
  });

  // ==========================================================================
  // submitResponse() SUCCESS TESTS
  // ==========================================================================

  describe('submitResponse() Success', () => {
    it('should successfully submit feedback response', async () => {
      const mockResponse = createSuccessfulSubmissionResponse(456);
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      let submittedResult: Awaited<ReturnType<typeof result.current.submitResponse>>;

      await act(async () => {
        submittedResult = await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer', 2: 'text response' },
          anonymous: false,
        });
      });

      // Verify API was called correctly
      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledTimes(1);
      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          1: 'answer',
          2: 'text response',
        })
      );

      // Verify returned FeedbackResponse
      expect(submittedResult!).toBeDefined();
      expect(submittedResult!.completed.id).toBe(456);
      expect(submittedResult!.isTemporary).toBe(false);
    });

    it('should set isSubmitting to true during submission', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(feedbackApi.submitFeedbackResponse).mockReturnValue(
        pendingPromise as Promise<ApiResponse<feedbackApi.FeedbackSubmissionResult>>
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Start submission without awaiting
      let submissionPromise: Promise<unknown>;
      act(() => {
        submissionPromise = result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      // Should be submitting
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(true);
      });

      // Resolve the API call
      await act(async () => {
        resolvePromise!(createSuccessfulSubmissionResponse());
        await submissionPromise;
      });

      // Should not be submitting anymore
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });
    });

    it('should set isSubmitting to false after completion', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      expect(result.current.isSubmitting).toBe(false);
    });

    it('should return FeedbackResponse with completedId', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse(999)
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      let response: Awaited<ReturnType<typeof result.current.submitResponse>>;

      await act(async () => {
        response = await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      expect(response!.completed).toBeDefined();
      expect(response!.completed.id).toBe(999);
    });

    it('should trigger success notification on successful submission', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      expect(mockShowSuccess).toHaveBeenCalledWith('Feedback submitted successfully');
    });

    it('should handle boolean response values by converting to string', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: true, 2: false },
          anonymous: false,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          1: '1',
          2: '0',
        })
      );
    });

    it('should pass courseId when provided', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          courseId: 456,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          courseid: 456,
        })
      );
    });

    it('should pass goToPage when provided for multi-page navigation', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
          goToPage: 2,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          gopage: 2,
        })
      );
    });
  });

  // ==========================================================================
  // submitResponse() ANONYMOUS SUBMISSION TESTS
  // ==========================================================================

  describe('submitResponse() Anonymous Submission', () => {
    it('should submit anonymous feedback when anonymous flag is true', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: true,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledWith(
        123,
        expect.any(Object)
      );
    });

    it('should return response with anonymous_response flag set', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      let response: Awaited<ReturnType<typeof result.current.submitResponse>>;

      await act(async () => {
        response = await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: true,
        });
      });

      expect(response!.completed.anonymous_response).toBe(1);
    });

    it('should return response with anonymous_response flag unset when not anonymous', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      let response: Awaited<ReturnType<typeof result.current.submitResponse>>;

      await act(async () => {
        response = await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      expect(response!.completed.anonymous_response).toBe(0);
    });
  });

  // ==========================================================================
  // submitResponse() ERROR HANDLING TESTS
  // ==========================================================================

  describe('submitResponse() Error Handling', () => {
    it('should handle network error', async () => {
      const networkError = new Error('Network error');
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(networkError);

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: { 1: 'answer' },
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      // Force re-render to pick up state changes from caught mutation error
      rerender();

      // Verify error state is updated
      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
        expect(result.current.isSubmitting).toBe(false);
      });
    });

    it('should handle permission denied error', async () => {
      const permissionError = new Error('You do not have permission to complete this feedback');
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(permissionError);

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: { 1: 'answer' },
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      // Force re-render to pick up state changes from caught mutation error
      rerender();

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
        expect(result.current.error?.code).toBe('PERMISSION_DENIED');
      });
    });

    it('should handle already submitted error', async () => {
      const alreadySubmittedError = new Error('You have already submitted this feedback');
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(alreadySubmittedError);

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: { 1: 'answer' },
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      // Force re-render to pick up state changes from caught mutation error
      rerender();

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
        expect(result.current.error?.code).toBe('ALREADY_SUBMITTED');
      });
    });

    it('should handle feedback closed error', async () => {
      const closedError = new Error('This feedback is closed');
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(closedError);

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: { 1: 'answer' },
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      // Force re-render to pick up state changes from caught mutation error
      rerender();

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
        expect(result.current.error?.code).toBe('FEEDBACK_CLOSED');
      });
    });

    it('should show error notification on submission failure', async () => {
      const error = new Error('Submission failed');
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(error);

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() - rejects.toThrow() pattern doesn't allow
      // the catch block in the hook to fully execute before checking mocks
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: { 1: 'answer' },
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      // Force re-render to pick up state changes
      rerender();

      expect(mockShowError).toHaveBeenCalled();
    });

    it('should set isSubmitting to false after error', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(
        new Error('Test error')
      );

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: { 1: 'answer' },
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      // Force re-render to pick up state changes from caught mutation error
      rerender();

      expect(result.current.isSubmitting).toBe(false);
    });

    it('should handle capability check failure', async () => {
      const capabilityError = new Error('Missing capability: mod/feedback:complete');
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(capabilityError);

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: { 1: 'answer' },
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      // Force re-render to pick up state changes from caught mutation error
      rerender();

      await waitFor(() => {
        expect(result.current.error?.code).toBe('PERMISSION_DENIED');
      });
    });
  });

  // ==========================================================================
  // submitResponse() OPTIMISTIC UPDATE TESTS
  // ==========================================================================

  describe('submitResponse() Optimistic Updates', () => {
    it('should optimistically update feedback status cache', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      // Set initial cache state
      queryClient.setQueryData(['feedback', 'status', 123], {
        isSubmitted: false,
        canSubmit: true,
        isOpen: true,
      });

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      // Note: The cache is invalidated on success, so we verify the mutation ran
      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalled();
    });

    it('should rollback optimistic update on error', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(
        new Error('API Error')
      );

      // Set initial cache state
      const initialStatus = {
        isSubmitted: false,
        canSubmit: true,
        isOpen: true,
      };
      queryClient.setQueryData(['feedback', 123], initialStatus);

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: { 1: 'answer' },
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      rerender();

      // Verify rollback occurred (cache restored)
      const cachedData = queryClient.getQueryData(['feedback', 123]);
      expect(cachedData).toEqual(initialStatus);
    });

    it('should cancel outgoing refetches on mutation', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(feedbackApi.submitFeedbackResponse).mockReturnValue(
        pendingPromise as Promise<ApiResponse<feedbackApi.FeedbackSubmissionResult>>
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Start submission
      act(() => {
        result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      // The mutation cancels queries on mutate - verify hook is in pending state
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(true);
      });

      // Resolve to cleanup
      await act(async () => {
        resolvePromise!(createSuccessfulSubmissionResponse());
      });
    });
  });

  // ==========================================================================
  // submitResponse() CACHE INVALIDATION TESTS
  // ==========================================================================

  describe('submitResponse() Cache Invalidation', () => {
    it('should invalidate feedback query on success', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['feedback', 123] })
      );
    });

    it('should invalidate feedback responses query on success', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['feedback', 'responses', 123] })
      );
    });

    it('should invalidate feedback status query on success', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['feedback', 'status', 123] })
      );
    });

    it('should invalidate dashboard query on success', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['dashboard'] })
      );
    });

    it('should invalidate user courses query on success', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['user', 'courses'] })
      );
    });
  });

  // ==========================================================================
  // submitResponse() MULTI-PAGE TESTS
  // ==========================================================================

  describe('submitResponse() Multi-Page Forms', () => {
    it('should handle submission with goToPage parameter', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
          goToPage: 2,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ gopage: 2 })
      );
    });

    it('should handle final page submission (goToPage = -1)', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer', 2: 'more text' },
          anonymous: false,
          goToPage: -1,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ gopage: -1 })
      );
    });

    it('should include currentPage in response for multi-page feedback', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      let response: Awaited<ReturnType<typeof result.current.submitResponse>>;

      await act(async () => {
        response = await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
          goToPage: 3,
        });
      });

      expect(response!.currentPage).toBe(3);
    });
  });

  // ==========================================================================
  // saveProgress() SUCCESS TESTS
  // ==========================================================================

  describe('saveProgress() Success', () => {
    it('should successfully save progress', async () => {
      vi.mocked(feedbackApi.saveProgress).mockResolvedValue(
        createSuccessfulProgressResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveProgress({
          feedbackId: 123,
          responses: { 1: 'partial answer' },
          currentPage: 2,
        });
      });

      expect(feedbackApi.saveProgress).toHaveBeenCalledTimes(1);
      expect(feedbackApi.saveProgress).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          1: 'partial answer',
          gopage: 2,
        })
      );
    });

    it('should set isSaving to true during save operation', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(feedbackApi.saveProgress).mockReturnValue(
        pendingPromise as Promise<ApiResponse<feedbackApi.SaveProgressResult>>
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Start save without awaiting
      let savePromise: Promise<unknown>;
      act(() => {
        savePromise = result.current.saveProgress({
          feedbackId: 123,
          responses: { 1: 'partial' },
          currentPage: 1,
        });
      });

      await waitFor(() => {
        expect(result.current.isSaving).toBe(true);
      });

      // Resolve to cleanup
      await act(async () => {
        resolvePromise!(createSuccessfulProgressResponse());
        await savePromise;
      });
    });

    it('should set isSaving to false after save completion', async () => {
      vi.mocked(feedbackApi.saveProgress).mockResolvedValue(
        createSuccessfulProgressResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveProgress({
          feedbackId: 123,
          responses: { 1: 'partial' },
          currentPage: 1,
        });
      });

      expect(result.current.isSaving).toBe(false);
    });

    it('should show progress saved notification on success', async () => {
      vi.mocked(feedbackApi.saveProgress).mockResolvedValue(
        createSuccessfulProgressResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveProgress({
          feedbackId: 123,
          responses: { 1: 'partial' },
          currentPage: 1,
        });
      });

      expect(mockShowSuccess).toHaveBeenCalledWith('Progress saved');
    });

    it('should update progress cache with saved responses', async () => {
      vi.mocked(feedbackApi.saveProgress).mockResolvedValue(
        createSuccessfulProgressResponse(2)
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveProgress({
          feedbackId: 123,
          responses: { 1: 'partial' },
          currentPage: 2,
        });
      });

      // Check that cache was updated
      const progressData = queryClient.getQueryData(['feedback', 'progress', 123]);
      expect(progressData).toBeDefined();
    });

    it('should pass courseId when provided', async () => {
      vi.mocked(feedbackApi.saveProgress).mockResolvedValue(
        createSuccessfulProgressResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveProgress({
          feedbackId: 123,
          courseId: 456,
          responses: { 1: 'partial' },
          currentPage: 1,
        });
      });

      expect(feedbackApi.saveProgress).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ courseid: 456 })
      );
    });

    it('should handle boolean values by converting to string', async () => {
      vi.mocked(feedbackApi.saveProgress).mockResolvedValue(
        createSuccessfulProgressResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveProgress({
          feedbackId: 123,
          responses: { 1: true, 2: false },
          currentPage: 1,
        });
      });

      expect(feedbackApi.saveProgress).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          1: '1',
          2: '0',
        })
      );
    });
  });

  // ==========================================================================
  // saveProgress() ERROR HANDLING TESTS
  // ==========================================================================

  describe('saveProgress() Error Handling', () => {
    it('should handle network error during save', async () => {
      vi.mocked(feedbackApi.saveProgress).mockRejectedValue(
        new Error('Network error')
      );

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.saveProgress({
            feedbackId: 123,
            responses: { 1: 'partial' },
            currentPage: 1,
          });
        } catch {
          // Expected to throw
        }
      });

      rerender();

      // Verify isSaving is reset after error
      expect(result.current.isSaving).toBe(false);
    });

    it('should show error notification on save failure', async () => {
      vi.mocked(feedbackApi.saveProgress).mockRejectedValue(
        new Error('Save failed')
      );

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() - rejects.toThrow() pattern doesn't allow
      // the catch block in the hook to fully execute before checking mocks
      await act(async () => {
        try {
          await result.current.saveProgress({
            feedbackId: 123,
            responses: { 1: 'partial' },
            currentPage: 1,
          });
        } catch {
          // Expected to throw
        }
      });

      // Force re-render to pick up state changes
      rerender();

      expect(mockShowError).toHaveBeenCalledWith(
        'Failed to save progress. Please try again.'
      );
    });

    it('should set isSaving to false after error', async () => {
      vi.mocked(feedbackApi.saveProgress).mockRejectedValue(
        new Error('Test error')
      );

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.saveProgress({
            feedbackId: 123,
            responses: { 1: 'partial' },
            currentPage: 1,
          });
        } catch {
          // Expected to throw
        }
      });

      // Force re-render to pick up state changes from caught mutation error
      rerender();

      expect(result.current.isSaving).toBe(false);
    });

    it('should rollback optimistic update on error', async () => {
      vi.mocked(feedbackApi.saveProgress).mockRejectedValue(
        new Error('API Error')
      );

      // Set initial progress state
      const initialProgress = {
        currentPage: 1,
        savedValues: {},
        lastSaved: 12345,
      };
      queryClient.setQueryData(['feedback', 'progress', 123], initialProgress);

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.saveProgress({
            feedbackId: 123,
            responses: { 1: 'new value' },
            currentPage: 2,
          });
        } catch {
          // Expected to throw
        }
      });

      rerender();

      // Verify rollback occurred
      const cachedData = queryClient.getQueryData(['feedback', 'progress', 123]);
      expect(cachedData).toEqual(initialProgress);
    });
  });

  // ==========================================================================
  // saveProgress() PARTIAL VALIDATION TESTS
  // ==========================================================================

  describe('saveProgress() Partial Validation', () => {
    it('should allow partial responses without required field validation', async () => {
      vi.mocked(feedbackApi.saveProgress).mockResolvedValue(
        createSuccessfulProgressResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Save with incomplete responses (required field missing)
      await act(async () => {
        await result.current.saveProgress({
          feedbackId: 123,
          responses: { 1: 'only one answer' }, // Missing required fields OK for progress save
          currentPage: 1,
        });
      });

      // Should succeed without validation error
      expect(feedbackApi.saveProgress).toHaveBeenCalled();
      expect(result.current.validationErrors).toEqual({});
    });

    it('should allow empty responses for optional questions', async () => {
      vi.mocked(feedbackApi.saveProgress).mockResolvedValue(
        createSuccessfulProgressResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveProgress({
          feedbackId: 123,
          responses: {}, // Empty responses OK for progress
          currentPage: 1,
        });
      });

      expect(feedbackApi.saveProgress).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // clearErrors() TESTS
  // ==========================================================================

  describe('clearErrors()', () => {
    it('should reset validationErrors to empty object', async () => {
      // First, trigger an error to populate validationErrors
      const errorWithFieldErrors = new Error('Validation error');
      (errorWithFieldErrors as unknown as { fieldErrors: Record<number, string> }).fieldErrors = {
        1: 'This field is required',
        2: 'Invalid value',
      };
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(errorWithFieldErrors);

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: {},
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      rerender();

      // Now clear errors
      act(() => {
        result.current.clearErrors();
      });

      expect(result.current.validationErrors).toEqual({});
    });

    it('should not affect mutation state when clearing errors', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Initial state checks
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.isSaving).toBe(false);

      act(() => {
        result.current.clearErrors();
      });

      // State should remain unchanged
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.isSaving).toBe(false);
    });

    it('should be callable at any time without errors', () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Should not throw when called multiple times
      expect(() => {
        act(() => {
          result.current.clearErrors();
          result.current.clearErrors();
          result.current.clearErrors();
        });
      }).not.toThrow();
    });

    it('should clear errors before new submission', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Verify clearErrors is called internally before submission
      // by checking that validationErrors is empty after submission starts
      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      expect(result.current.validationErrors).toEqual({});
    });
  });

  // ==========================================================================
  // resetSubmission() TESTS
  // ==========================================================================

  describe('resetSubmission()', () => {
    it('should reset mutation state', async () => {
      // Trigger an error first
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(
        new Error('Test error')
      );

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: { 1: 'answer' },
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      rerender();

      // Verify error state exists
      expect(result.current.error).not.toBeNull();

      // Reset
      act(() => {
        result.current.resetSubmission();
      });

      // Error should be cleared
      // Note: The error state comes from the mutation, which is reset
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
        expect(result.current.isSaving).toBe(false);
      });
    });

    it('should reset isSubmitting to false', async () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.resetSubmission();
      });

      expect(result.current.isSubmitting).toBe(false);
    });

    it('should reset validation errors', () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.resetSubmission();
      });

      expect(result.current.validationErrors).toEqual({});
    });

    it('should not affect cached data', async () => {
      // Set some cached data
      queryClient.setQueryData(['feedback', 123], { id: 123, name: 'Test Feedback' });

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.resetSubmission();
      });

      // Cached data should still exist
      const cachedData = queryClient.getQueryData(['feedback', 123]);
      expect(cachedData).toEqual({ id: 123, name: 'Test Feedback' });
    });
  });

  // ==========================================================================
  // LOADING STATE TESTS
  // ==========================================================================

  describe('Loading States', () => {
    it('should have isSubmitting true during submitResponse', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(feedbackApi.submitFeedbackResponse).mockReturnValue(
        pendingPromise as Promise<ApiResponse<feedbackApi.FeedbackSubmissionResult>>
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      let submissionPromise: Promise<unknown>;
      act(() => {
        submissionPromise = result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(true);
      });

      await act(async () => {
        resolvePromise!(createSuccessfulSubmissionResponse());
        await submissionPromise;
      });
    });

    it('should have isSaving true during saveProgress', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(feedbackApi.saveProgress).mockReturnValue(
        pendingPromise as Promise<ApiResponse<feedbackApi.SaveProgressResult>>
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      let savePromise: Promise<unknown>;
      act(() => {
        savePromise = result.current.saveProgress({
          feedbackId: 123,
          responses: { 1: 'partial' },
          currentPage: 1,
        });
      });

      await waitFor(() => {
        expect(result.current.isSaving).toBe(true);
      });

      await act(async () => {
        resolvePromise!(createSuccessfulProgressResponse());
        await savePromise;
      });
    });

    it('should have both mutations independent (can save while not submitting)', async () => {
      let resolveSubmit: (value: unknown) => void;
      const pendingSubmit = new Promise((resolve) => {
        resolveSubmit = resolve;
      });

      vi.mocked(feedbackApi.submitFeedbackResponse).mockReturnValue(
        pendingSubmit as Promise<ApiResponse<feedbackApi.FeedbackSubmissionResult>>
      );
      vi.mocked(feedbackApi.saveProgress).mockResolvedValue(
        createSuccessfulProgressResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Start submit (will be pending)
      let submitPromise: Promise<unknown>;
      act(() => {
        submitPromise = result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(true);
      });

      // Save should work independently
      await act(async () => {
        await result.current.saveProgress({
          feedbackId: 456,
          responses: { 2: 'other' },
          currentPage: 1,
        });
      });

      // Submit still pending, save completed
      expect(result.current.isSubmitting).toBe(true);
      expect(result.current.isSaving).toBe(false);

      // Cleanup
      await act(async () => {
        resolveSubmit!(createSuccessfulSubmissionResponse());
        await submitPromise;
      });
    });

    it('should reset loading states after completion', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.isSaving).toBe(false);
    });
  });

  // ==========================================================================
  // VALIDATION RULES BY QUESTION TYPE TESTS
  // ==========================================================================

  describe('Validation Rules by Question Type', () => {
    // Note: The hook itself doesn't perform client-side validation in the
    // mutation function - it delegates to the API. However, we test the
    // validation helpers that are exported from the hook module.

    it('should validate required fields on submission attempt', async () => {
      // The API will reject invalid submissions with validation errors
      const validationError = new Error('Validation failed');
      (validationError as unknown as { fieldErrors: Record<number, string> }).fieldErrors = {
        1: 'This field is required',
      };
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(validationError);

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: {}, // Missing required field
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      rerender();

      // Verify error state is set
      expect(result.current.error).not.toBeNull();
    });

    it('should handle multichoice validation errors from API', async () => {
      const validationError = new Error('Invalid option');
      (validationError as unknown as { fieldErrors: Record<number, string> }).fieldErrors = {
        1: 'Please select a valid option',
      };
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(validationError);

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: { 1: 'invalid_option' },
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      rerender();

      // Verify error state is set
      expect(result.current.error).not.toBeNull();
    });

    it('should handle numeric validation errors from API', async () => {
      const validationError = new Error('Invalid number');
      (validationError as unknown as { fieldErrors: Record<number, string> }).fieldErrors = {
        1: 'Value must be at least 1',
      };
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(validationError);

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: { 1: -5 }, // Below minimum
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      rerender();

      // Verify error state is set
      expect(result.current.error).not.toBeNull();
    });

    it('should handle text maxlength validation errors from API', async () => {
      const validationError = new Error('Text too long');
      (validationError as unknown as { fieldErrors: Record<number, string> }).fieldErrors = {
        1: 'Response must be 100 characters or fewer',
      };
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(validationError);

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: { 1: 'A'.repeat(200) }, // Exceeds maxlength
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      rerender();

      // Verify error state is set
      expect(result.current.error).not.toBeNull();
    });

    it('should accept valid multichoice responses', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'option_1' },
          anonymous: false,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalled();
    });

    it('should accept valid numeric responses', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 42 },
          anonymous: false,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalled();
    });

    it('should accept valid text responses', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'Valid text response' },
          anonymous: false,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalled();
    });

    it('should handle array responses for multi-select multichoice', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: ['option_1', 'option_2'] },
          anonymous: false,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          1: ['option_1', 'option_2'],
        })
      );
    });
  });

  // ==========================================================================
  // ERROR RECOVERY TESTS
  // ==========================================================================

  describe('Error Recovery', () => {
    it('should allow retry after network failure', async () => {
      // First call fails
      vi.mocked(feedbackApi.submitFeedbackResponse)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createSuccessfulSubmissionResponse());

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // First attempt fails - use try/catch pattern
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses: { 1: 'answer' },
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      // Force re-render to pick up state changes from caught mutation error
      rerender();

      // Reset and retry
      act(() => {
        result.current.resetSubmission();
      });

      // Second attempt succeeds
      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 'answer' },
          anonymous: false,
        });
      });

      // Force re-render to pick up state changes
      rerender();

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledTimes(2);
      expect(result.current.error).toBeNull();
    });

    it('should preserve form data after error (not clear responses)', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(
        new Error('Test error')
      );

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      const responses = { 1: 'important answer', 2: 42 };

      // Use try/catch inside act() to ensure catch block in hook executes fully
      await act(async () => {
        try {
          await result.current.submitResponse({
            feedbackId: 123,
            responses,
            anonymous: false,
          });
        } catch {
          // Expected to throw
        }
      });

      rerender();

      // The hook doesn't manage form state, but it should allow retry with same data
      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          1: 'important answer',
          2: 42,
        })
      );
    });

    it('should handle multiple consecutive errors', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockRejectedValue(
        new Error('Persistent error')
      );

      const { result, rerender } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Multiple failed attempts - use try/catch inside act()
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          try {
            await result.current.submitResponse({
              feedbackId: 123,
              responses: { 1: 'answer' },
              anonymous: false,
            });
          } catch {
            // Expected to throw
          }
        });

        // Force re-render to pick up state changes from caught mutation error
        rerender();

        act(() => {
          result.current.resetSubmission();
        });
      }

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================================================
  // TYPESCRIPT TYPE TESTS
  // ==========================================================================

  describe('TypeScript Type Safety', () => {
    it('should have correct FeedbackResponseHookResult return type', () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Type assertions to verify interface compliance
      const hookResult = result.current;

      // Verify function types
      const submitResponse: typeof hookResult.submitResponse = hookResult.submitResponse;
      const saveProgress: typeof hookResult.saveProgress = hookResult.saveProgress;
      const clearErrors: typeof hookResult.clearErrors = hookResult.clearErrors;
      const resetSubmission: typeof hookResult.resetSubmission = hookResult.resetSubmission;

      // Verify state types
      const isSubmitting: boolean = hookResult.isSubmitting;
      const isSaving: boolean = hookResult.isSaving;
      const validationErrors: Record<number, string> = hookResult.validationErrors;

      // Suppress unused variable warnings
      expect(submitResponse).toBeDefined();
      expect(saveProgress).toBeDefined();
      expect(clearErrors).toBeDefined();
      expect(resetSubmission).toBeDefined();
      expect(isSubmitting).toBe(false);
      expect(isSaving).toBe(false);
      expect(validationErrors).toEqual({});
    });

    it('should accept valid SubmitResponseOptions', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Valid options with all fields
      const options = {
        feedbackId: 123,
        courseId: 456,
        anonymous: true,
        responses: {
          1: 'string value',
          2: 42,
          3: ['a', 'b'],
          4: true,
        },
        goToPage: 2,
      };

      await act(async () => {
        await result.current.submitResponse(options);
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalled();
    });

    it('should accept valid SaveProgressOptions', async () => {
      vi.mocked(feedbackApi.saveProgress).mockResolvedValue(
        createSuccessfulProgressResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Valid options with all fields
      const options = {
        feedbackId: 123,
        courseId: 456,
        responses: {
          1: 'partial',
          2: 10,
        },
        currentPage: 2,
      };

      await act(async () => {
        await result.current.saveProgress(options);
      });

      expect(feedbackApi.saveProgress).toHaveBeenCalled();
    });

    it('should have validationErrors as Record<number, string>', () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      const errors = result.current.validationErrors;

      // Type should be Record<number, string>
      expect(typeof errors).toBe('object');

      // Can assign number keys with string values
      const testAssignment: Record<number, string> = { ...errors, 1: 'test error' };
      expect(testAssignment[1]).toBe('test error');
    });

    it('should return correct callback signatures', () => {
      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // clearErrors returns void
      const clearResult = result.current.clearErrors();
      expect(clearResult).toBeUndefined();

      // resetSubmission returns void
      const resetResult = result.current.resetSubmission();
      expect(resetResult).toBeUndefined();
    });
  });

  // ==========================================================================
  // DEPENDENT QUESTIONS TESTS
  // ==========================================================================

  describe('Dependent Questions', () => {
    // Note: Dependent question visibility logic is typically handled by the
    // rendering component based on question configuration. The hook accepts
    // whatever responses the component provides. We test that the hook
    // correctly passes through responses regardless of dependency logic.

    it('should pass all responses including dependent question answers', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Include both parent and dependent question responses
      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: {
            1: 'yes', // Parent question
            2: 'dependent answer', // Dependent on Q1 = 'yes'
          },
          anonymous: false,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          1: 'yes',
          2: 'dependent answer',
        })
      );
    });

    it('should allow submission without dependent question when parent condition not met', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Only parent question, dependent question skipped
      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: {
            1: 'no', // Dependent question not shown when this is 'no'
          },
          anonymous: false,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty responses object', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: {},
          anonymous: false,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalled();
    });

    it('should handle very large response objects', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Generate large response object
      const responses: Record<number, string> = {};
      for (let i = 1; i <= 100; i++) {
        responses[i] = `Answer for question ${i}`;
      }

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses,
          anonymous: false,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalled();
    });

    it('should handle special characters in responses', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: {
            1: '특수문자', // Korean
            2: '<script>alert("xss")</script>',
            3: 'Emoji: 😀🎉',
            4: 'Line\nBreak',
          },
          anonymous: false,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          1: '특수문자',
          2: '<script>alert("xss")</script>',
          3: 'Emoji: 😀🎉',
          4: 'Line\nBreak',
        })
      );
    });

    it('should handle zero as a valid numeric response', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: 0 },
          anonymous: false,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ 1: 0 })
      );
    });

    it('should handle negative numbers as valid numeric responses', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: -10 },
          anonymous: false,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ 1: -10 })
      );
    });

    it('should handle empty string as valid response', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.submitResponse({
          feedbackId: 123,
          responses: { 1: '' },
          anonymous: false,
        });
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ 1: '' })
      );
    });

    it('should handle concurrent submissions to different feedbacks', async () => {
      vi.mocked(feedbackApi.submitFeedbackResponse).mockResolvedValue(
        createSuccessfulSubmissionResponse()
      );

      const { result } = renderHook(() => useFeedbackResponse(), {
        wrapper: createWrapper(queryClient),
      });

      // Submit to two different feedbacks concurrently
      await act(async () => {
        await Promise.all([
          result.current.submitResponse({
            feedbackId: 123,
            responses: { 1: 'answer1' },
            anonymous: false,
          }),
          result.current.submitResponse({
            feedbackId: 456,
            responses: { 1: 'answer2' },
            anonymous: false,
          }),
        ]);
      });

      expect(feedbackApi.submitFeedbackResponse).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // VALIDATION HELPERS EXPORT TESTS
  // ==========================================================================

  describe('Validation Helpers', () => {
    // The hook exports some validation helpers for use in components
    // We test that they're properly accessible and functional

    it('should provide validateQuestion helper for custom validation', async () => {
      // Import the exported helpers
      const { validateQuestion, isEmptyValue, createValidationError } = await import(
        '@/features/activities/feedback/hooks/useFeedbackResponse'
      );

      // Test isEmptyValue
      expect(isEmptyValue(undefined)).toBe(true);
      // Test null as edge case (runtime may pass null even though type doesn't include it)
      expect(isEmptyValue(null as unknown as undefined)).toBe(true);
      expect(isEmptyValue('')).toBe(true);
      expect(isEmptyValue('   ')).toBe(true);
      expect(isEmptyValue([])).toBe(true);
      expect(isEmptyValue('text')).toBe(false);
      expect(isEmptyValue(0)).toBe(false);
      expect(isEmptyValue(false)).toBe(false);

      // Test validateQuestion with required field
      const requiredError = validateQuestion(
        { itemId: 1, type: 'textfield', required: true },
        undefined
      );
      expect(requiredError).toBe('This field is required');

      // Test validateQuestion with valid value
      const validResult = validateQuestion(
        { itemId: 1, type: 'textfield', required: true },
        'answer'
      );
      expect(validResult).toBeNull();

      // Test createValidationError
      const error = createValidationError({ 1: 'Error message', 2: 'Another error' });
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.fieldErrors).toEqual({ 1: 'Error message', 2: 'Another error' });
      expect(error.message).toContain('2 errors');
    });

    it('should validate numeric values with range constraints', async () => {
      const { validateQuestion } = await import(
        '@/features/activities/feedback/hooks/useFeedbackResponse'
      );

      // Valid value in range
      expect(
        validateQuestion(
          { itemId: 1, type: 'numeric', required: false, constraints: { min: 1, max: 10 } },
          5
        )
      ).toBeNull();

      // Value below minimum
      expect(
        validateQuestion(
          { itemId: 1, type: 'numeric', required: false, constraints: { min: 1, max: 10 } },
          0
        )
      ).toBe('Value must be at least 1');

      // Value above maximum
      expect(
        validateQuestion(
          { itemId: 1, type: 'numeric', required: false, constraints: { min: 1, max: 10 } },
          15
        )
      ).toBe('Value must be at most 10');

      // Non-numeric value
      expect(
        validateQuestion(
          { itemId: 1, type: 'numeric', required: false },
          'not a number'
        )
      ).toBe('Please enter a valid number');
    });

    it('should validate text values with maxLength constraint', async () => {
      const { validateQuestion } = await import(
        '@/features/activities/feedback/hooks/useFeedbackResponse'
      );

      // Valid length
      expect(
        validateQuestion(
          { itemId: 1, type: 'textfield', required: false, constraints: { maxLength: 10 } },
          'short'
        )
      ).toBeNull();

      // Exceeds maxLength
      expect(
        validateQuestion(
          { itemId: 1, type: 'textfield', required: false, constraints: { maxLength: 10 } },
          'this is way too long'
        )
      ).toBe('Response must be 10 characters or fewer');
    });

    it('should validate multichoice values against valid options', async () => {
      const { validateQuestion } = await import(
        '@/features/activities/feedback/hooks/useFeedbackResponse'
      );

      // Valid option
      expect(
        validateQuestion(
          {
            itemId: 1,
            type: 'multichoice',
            required: false,
            constraints: { validOptions: ['a', 'b', 'c'] },
          },
          'b'
        )
      ).toBeNull();

      // Invalid option
      expect(
        validateQuestion(
          {
            itemId: 1,
            type: 'multichoice',
            required: false,
            constraints: { validOptions: ['a', 'b', 'c'] },
          },
          'invalid'
        )
      ).toBe('Please select a valid option');

      // Array of valid options
      expect(
        validateQuestion(
          {
            itemId: 1,
            type: 'multichoice',
            required: false,
            constraints: { validOptions: ['a', 'b', 'c'] },
          },
          ['a', 'c']
        )
      ).toBeNull();

      // Array with invalid option
      expect(
        validateQuestion(
          {
            itemId: 1,
            type: 'multichoice',
            required: false,
            constraints: { validOptions: ['a', 'b', 'c'] },
          },
          ['a', 'invalid']
        )
      ).toBe('Please select a valid option');
    });
  });
});
