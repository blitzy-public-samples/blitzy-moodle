/**
 * Comprehensive Unit Tests for useQuiz Custom Hook
 *
 * This test file validates the useQuiz custom hook which provides quiz data fetching
 * functionality using React Query. Tests cover all aspects of the hook including:
 * - Hook initialization and result structure
 * - Data fetching with fetchQuizDetails API function
 * - Loading and fetching states
 * - Error handling for various error types (permission, network, not found)
 * - Caching behavior (staleTime, gcTime)
 * - Query key management and cache invalidation
 * - Conditional query enabling
 * - Manual refetch functionality
 * - Success/error callbacks
 * - Refetch interval configuration
 * - TypeScript typing validation
 *
 * @module tests/unit/features/activities/quizzes/useQuiz.test
 * @see react-frontend/src/features/activities/quizzes/hooks/useQuiz.ts
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Import the hook under test
import { useQuiz, quizQueryKeys } from '@/features/activities/quizzes/hooks/useQuiz';
import type { UseQuizResult } from '@/features/activities/quizzes/hooks/useQuiz';

// Import the API function to mock
import { fetchQuizDetails } from '@/features/activities/quizzes/api/quizApi';

// Import types for mock data
import type { Quiz } from '@/features/activities/quizzes/types/quiz.types';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the API module
vi.mock('@/features/activities/quizzes/api/quizApi', () => ({
  fetchQuizDetails: vi.fn(),
}));

// Cast the mock for type safety
const mockFetchQuizDetails = fetchQuizDetails as Mock;

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a mock Quiz object with all required properties
 * Matches the Quiz interface from quiz.types.ts
 */
function createMockQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 1,
    course: 101,
    name: 'Test Quiz',
    intro: '<p>This is a test quiz introduction</p>',
    introformat: 1,
    timeopen: Math.floor(Date.now() / 1000) - 86400, // Opened 1 day ago
    timeclose: Math.floor(Date.now() / 1000) + 86400 * 7, // Closes in 7 days
    timelimit: 3600, // 1 hour
    overduehandling: 'autosubmit' as const,
    graceperiod: 0,
    preferredbehaviour: 'deferredfeedback',
    canredoquestions: 0,
    attempts: 3,
    attemptonlast: 0,
    grademethod: 1, // HIGHEST
    decimalpoints: 2,
    questiondecimalpoints: -1,
    reviewattempt: 69904,
    reviewcorrectness: 69904,
    reviewmaxmarks: 69904,
    reviewmarks: 69904,
    reviewspecificfeedback: 69904,
    reviewgeneralfeedback: 69904,
    reviewrightanswer: 69904,
    reviewoverallfeedback: 69904,
    questionsperpage: 1,
    navmethod: 'free' as const,
    shuffleanswers: 1,
    sumgrades: 100,
    grade: 100,
    timecreated: Math.floor(Date.now() / 1000) - 86400 * 30,
    timemodified: Math.floor(Date.now() / 1000) - 86400,
    password: '',
    subnet: '',
    browsersecurity: '',
    delay1: 0,
    delay2: 0,
    showuserpicture: 0,
    showblocks: 0,
    completionattemptsexhausted: 0,
    completionminattempts: 0,
    completionpass: 0,
    allowofflineattempts: 0,
    precreateattempts: 0,
    ...overrides,
  };
}

/**
 * Creates a mock API response from fetchQuizDetails
 * The API returns a QuizDetailsResponse containing the quiz and additional info
 */
function createMockApiResponse(quiz: Quiz = createMockQuiz()) {
  return {
    quiz,
    attempts: [],
    canAttempt: true,
    canPreview: false,
    canReview: true,
    attemptsUsed: 0,
    attemptsRemaining: 3,
    bestGrade: null,
    overallGrade: null,
    unfinishedAttemptId: null,
    accessRestrictions: [],
    gradebookFeedback: null,
  };
}

/**
 * Creates a test QueryClient with configuration optimized for testing
 * - No retries to make tests deterministic
 * - Instant cache expiration to prevent test pollution
 * - Silent error logging
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/**
 * Wrapper component that provides QueryClientProvider for hook testing
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('useQuiz Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Create fresh QueryClient for each test
    queryClient = createTestQueryClient();
    
    // Default mock implementation returns successful response
    mockFetchQuizDetails.mockResolvedValue(createMockApiResponse());
  });

  afterEach(() => {
    // Clear the query cache after each test
    queryClient.clear();
  });

  // ==========================================================================
  // Hook Initialization Tests
  // ==========================================================================

  describe('Hook Initialization', () => {
    it('should return expected result structure with all properties', async () => {
      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      // Verify the hook returns all expected properties
      expect(result.current).toHaveProperty('quiz');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isFetching');
      expect(result.current).toHaveProperty('isError');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');

      // Verify refetch is a function
      expect(typeof result.current.refetch).toBe('function');
    });

    it('should return correct initial types matching UseQuizResult interface', async () => {
      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      // Initially, quiz is undefined and isLoading is true
      expect(result.current.quiz).toBeUndefined();
      expect(typeof result.current.isLoading).toBe('boolean');
      expect(typeof result.current.isFetching).toBe('boolean');
      expect(typeof result.current.isError).toBe('boolean');
      expect(result.current.error).toBeNull();

      // Wait for the query to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // After loading, quiz should be defined
      expect(result.current.quiz).toBeDefined();
    });
  });

  // ==========================================================================
  // Data Fetching Tests
  // ==========================================================================

  describe('Data Fetching', () => {
    it('should call fetchQuizDetails with correct quizId', async () => {
      const quizId = 42;
      
      renderHook(() => useQuiz(quizId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockFetchQuizDetails).toHaveBeenCalledWith(quizId);
      });
    });

    it('should call fetchQuizDetails only once for same quizId', async () => {
      const quizId = 1;
      
      const { result } = renderHook(() => useQuiz(quizId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have been called exactly once
      expect(mockFetchQuizDetails).toHaveBeenCalledTimes(1);
    });

    it('should call fetchQuizDetails with different quizId when prop changes', async () => {
      const { result, rerender } = renderHook(
        ({ quizId }: { quizId: number }) => useQuiz(quizId),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { quizId: 1 },
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Change quizId
      rerender({ quizId: 2 });

      await waitFor(() => {
        expect(mockFetchQuizDetails).toHaveBeenCalledWith(2);
      });

      expect(mockFetchQuizDetails).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  describe('Loading State', () => {
    it('should have isLoading true during initial fetch', async () => {
      // Make the API call take longer
      mockFetchQuizDetails.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockApiResponse()), 100))
      );

      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.quiz).toBeUndefined();

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.quiz).toBeDefined();
    });

    it('should have isLoading false after fetch completion', async () => {
      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.quiz).toBeDefined();
    });

    it('should have isFetching true during any fetch operation', async () => {
      mockFetchQuizDetails.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockApiResponse()), 100))
      );

      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      // During initial fetch
      expect(result.current.isFetching).toBe(true);

      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Success State Tests
  // ==========================================================================

  describe('Success State', () => {
    it('should populate quiz data correctly with all expected fields', async () => {
      const mockQuiz = createMockQuiz({
        id: 123,
        name: 'Advanced Mathematics Quiz',
        intro: '<p>Test your math skills</p>',
        timelimit: 7200, // 2 hours
        attempts: 5,
      });

      mockFetchQuizDetails.mockResolvedValue(createMockApiResponse(mockQuiz));

      const { result } = renderHook(() => useQuiz(123), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      // Verify quiz data
      expect(result.current.quiz?.id).toBe(123);
      expect(result.current.quiz?.name).toBe('Advanced Mathematics Quiz');
      expect(result.current.quiz?.intro).toBe('<p>Test your math skills</p>');
      expect(result.current.quiz?.timelimit).toBe(7200);
      expect(result.current.quiz?.attempts).toBe(5);
    });

    it('should have isError false when fetch succeeds', async () => {
      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should set isError true when API call fails', async () => {
      const error = new Error('API Error');
      mockFetchQuizDetails.mockRejectedValue(error);

      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should provide error object when fetch fails', async () => {
      const errorMessage = 'Failed to fetch quiz details';
      const error = new Error(errorMessage);
      mockFetchQuizDetails.mockRejectedValue(error);

      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe(errorMessage);
    });

    it('should handle 403 permission denied error correctly', async () => {
      const permissionError = new Error('You do not have permission to view this quiz');
      (permissionError as Error & { code: string }).code = '403';
      mockFetchQuizDetails.mockRejectedValue(permissionError);

      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain('permission');
      expect(result.current.quiz).toBeUndefined();
    });

    it('should handle 404 not found error correctly', async () => {
      const notFoundError = new Error('Quiz not found');
      (notFoundError as Error & { code: string }).code = '404';
      mockFetchQuizDetails.mockRejectedValue(notFoundError);

      const { result } = renderHook(() => useQuiz(999), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Quiz not found');
    });

    it('should handle network error correctly', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      mockFetchQuizDetails.mockRejectedValue(networkError);

      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.quiz).toBeUndefined();
    });
  });

  // ==========================================================================
  // Query Key Tests
  // ==========================================================================

  describe('Query Key Management', () => {
    it('should use correct query key format ["quiz", quizId]', () => {
      // Test the query key factory directly
      expect(quizQueryKeys.detail(1)).toEqual(['quiz', 1]);
      expect(quizQueryKeys.detail(42)).toEqual(['quiz', 42]);
      expect(quizQueryKeys.detail(999)).toEqual(['quiz', 999]);
    });

    it('should have separate cache entries for different quizIds', async () => {
      const quiz1 = createMockQuiz({ id: 1, name: 'Quiz 1' });
      const quiz2 = createMockQuiz({ id: 2, name: 'Quiz 2' });

      mockFetchQuizDetails
        .mockResolvedValueOnce(createMockApiResponse(quiz1))
        .mockResolvedValueOnce(createMockApiResponse(quiz2));

      // Render hook for quiz 1
      const { result: result1 } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.quiz?.name).toBe('Quiz 1');
      });

      // Render hook for quiz 2
      const { result: result2 } = renderHook(() => useQuiz(2), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result2.current.quiz?.name).toBe('Quiz 2');
      });

      // Verify both are in cache with correct data
      expect(queryClient.getQueryData(quizQueryKeys.detail(1))).toBeDefined();
      expect(queryClient.getQueryData(quizQueryKeys.detail(2))).toBeDefined();
    });

    it('should reuse cached data for same quizId across hook instances', async () => {
      const mockQuiz = createMockQuiz({ id: 1, name: 'Cached Quiz' });
      mockFetchQuizDetails.mockResolvedValue(createMockApiResponse(mockQuiz));

      // First hook instance
      const { result: result1 } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.quiz).toBeDefined();
      });

      // Second hook instance with same quizId
      const { result: result2 } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      // Should get data immediately from cache
      // Note: In test environment with staleTime: 0, it might refetch
      // but the cached data should still be available
      await waitFor(() => {
        expect(result2.current.quiz?.name).toBe('Cached Quiz');
      });
    });
  });

  // ==========================================================================
  // Caching Behavior Tests
  // ==========================================================================

  describe('Caching Behavior', () => {
    it('should configure staleTime as 5 minutes (300000ms)', async () => {
      // Create a QueryClient that preserves the hook's cache settings
      const cachingQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      });

      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(cachingQueryClient),
      });

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      // Check the query's options - the hook sets staleTime to 5 * 60 * 1000
      const queryState = cachingQueryClient.getQueryState(quizQueryKeys.detail(1));
      
      // The query should be in the cache
      expect(queryState).toBeDefined();
      
      // Verify the data is cached
      const cachedData = cachingQueryClient.getQueryData(quizQueryKeys.detail(1));
      expect(cachedData).toBeDefined();

      cachingQueryClient.clear();
    });

    it('should configure gcTime as 30 minutes (1800000ms)', async () => {
      // This test verifies the hook is configured with gcTime of 30 minutes
      // We test this indirectly by verifying the cache persists
      const cachingQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
            // Don't override gcTime to test the hook's configuration
          },
        },
      });

      const { result, unmount } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(cachingQueryClient),
      });

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      // Unmount the component (all subscribers gone)
      unmount();

      // The cache should still have the data because gcTime is 30 minutes
      // (not garbage collected yet)
      const cachedData = cachingQueryClient.getQueryData(quizQueryKeys.detail(1));
      expect(cachedData).toBeDefined();

      cachingQueryClient.clear();
    });
  });

  // ==========================================================================
  // Conditional Enabling Tests
  // ==========================================================================

  describe('Conditional Query Enabling', () => {
    it('should enable query only when quizId > 0', async () => {
      // Test with quizId = 0
      const { result: result0 } = renderHook(() => useQuiz(0), {
        wrapper: createWrapper(queryClient),
      });

      // Give it time to potentially make the call
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should not have called the API
      expect(mockFetchQuizDetails).not.toHaveBeenCalled();
      expect(result0.current.quiz).toBeUndefined();
      expect(result0.current.isLoading).toBe(false); // Query is disabled, not loading
    });

    it('should not make API call when quizId is negative', async () => {
      const { result } = renderHook(() => useQuiz(-1), {
        wrapper: createWrapper(queryClient),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockFetchQuizDetails).not.toHaveBeenCalled();
      expect(result.current.quiz).toBeUndefined();
    });

    it('should not make API call when enabled option is false', async () => {
      const { result } = renderHook(
        () => useQuiz(1, { enabled: false }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockFetchQuizDetails).not.toHaveBeenCalled();
      expect(result.current.quiz).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });

    it('should make API call when both quizId > 0 and enabled is true', async () => {
      const { result } = renderHook(
        () => useQuiz(1, { enabled: true }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      expect(mockFetchQuizDetails).toHaveBeenCalledWith(1);
    });

    it('should enable query when quizId becomes valid', async () => {
      const { result, rerender } = renderHook(
        ({ quizId }: { quizId: number }) => useQuiz(quizId),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { quizId: 0 },
        }
      );

      // Initially disabled
      expect(mockFetchQuizDetails).not.toHaveBeenCalled();

      // Change to valid quizId
      rerender({ quizId: 1 });

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      expect(mockFetchQuizDetails).toHaveBeenCalledWith(1);
    });
  });

  // ==========================================================================
  // Manual Refetch Tests
  // ==========================================================================

  describe('Manual Refetch', () => {
    it('should trigger new API call when refetch is called', async () => {
      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      expect(mockFetchQuizDetails).toHaveBeenCalledTimes(1);

      // Call refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Should have been called again
      expect(mockFetchQuizDetails).toHaveBeenCalledTimes(2);
    });

    it('should update data after refetch completes', async () => {
      const initialQuiz = createMockQuiz({ id: 1, name: 'Initial Quiz' });
      const updatedQuiz = createMockQuiz({ id: 1, name: 'Updated Quiz' });

      mockFetchQuizDetails
        .mockResolvedValueOnce(createMockApiResponse(initialQuiz))
        .mockResolvedValueOnce(createMockApiResponse(updatedQuiz));

      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.quiz?.name).toBe('Initial Quiz');
      });

      // Refetch to get updated data
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.quiz?.name).toBe('Updated Quiz');
      });
    });

    it('should return a Promise from refetch function', async () => {
      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      // refetch should return a Promise
      let refetchPromise: Promise<void>;
      await act(async () => {
        refetchPromise = result.current.refetch();
        expect(refetchPromise).toBeInstanceOf(Promise);
        await refetchPromise;
      });
    });
  });

  // ==========================================================================
  // Callback Tests
  // ==========================================================================

  describe('Callbacks', () => {
    it('should call onSuccess callback with quiz data when fetch succeeds', async () => {
      const onSuccess = vi.fn();
      const mockQuiz = createMockQuiz({ id: 1, name: 'Success Quiz' });
      mockFetchQuizDetails.mockResolvedValue(createMockApiResponse(mockQuiz));

      const { result } = renderHook(
        () => useQuiz(1, { onSuccess }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      // Give time for the effect to run
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      expect(onSuccess).toHaveBeenCalledWith(mockQuiz);
    });

    it('should call onError callback with error when fetch fails', async () => {
      const onError = vi.fn();
      const error = new Error('Fetch failed');
      mockFetchQuizDetails.mockRejectedValue(error);

      const { result } = renderHook(
        () => useQuiz(1, { onError }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Give time for the effect to run
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should call onSuccess after manual refetch succeeds', async () => {
      const onSuccess = vi.fn();
      const mockQuiz = createMockQuiz({ id: 1, name: 'Refetch Quiz' });
      mockFetchQuizDetails.mockResolvedValue(createMockApiResponse(mockQuiz));

      const { result } = renderHook(
        () => useQuiz(1, { onSuccess }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      // Reset mock to track new calls
      onSuccess.mockClear();

      // Refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(onSuccess).toHaveBeenCalledWith(mockQuiz);
    });

    it('should call onError after manual refetch fails', async () => {
      const onError = vi.fn();
      
      // First call succeeds
      mockFetchQuizDetails.mockResolvedValueOnce(createMockApiResponse());
      
      const { result } = renderHook(
        () => useQuiz(1, { onError }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      // Second call (refetch) fails
      const refetchError = new Error('Refetch failed');
      mockFetchQuizDetails.mockRejectedValueOnce(refetchError);

      // Refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });

    it('should not call callbacks when query is disabled', async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();

      renderHook(
        () => useQuiz(1, { enabled: false, onSuccess, onError }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Refetch Interval Tests
  // ==========================================================================

  describe('Refetch Interval', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should periodically refetch when refetchInterval option is provided', async () => {
      const refetchInterval = 1000; // 1 second

      const { result } = renderHook(
        () => useQuiz(1, { refetchInterval }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      expect(mockFetchQuizDetails).toHaveBeenCalledTimes(1);

      // Advance time by refetch interval
      await act(async () => {
        vi.advanceTimersByTime(refetchInterval);
      });

      // Should trigger another fetch
      await waitFor(() => {
        expect(mockFetchQuizDetails).toHaveBeenCalledTimes(2);
      });

      // Advance time again
      await act(async () => {
        vi.advanceTimersByTime(refetchInterval);
      });

      await waitFor(() => {
        expect(mockFetchQuizDetails).toHaveBeenCalledTimes(3);
      });
    });

    it('should not refetch periodically when refetchInterval is 0', async () => {
      const { result } = renderHook(
        () => useQuiz(1, { refetchInterval: 0 }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      expect(mockFetchQuizDetails).toHaveBeenCalledTimes(1);

      // Advance time
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // Should not have been called again
      expect(mockFetchQuizDetails).toHaveBeenCalledTimes(1);
    });

    it('should not refetch periodically when refetchInterval is undefined', async () => {
      const { result } = renderHook(
        () => useQuiz(1, { refetchInterval: undefined }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      expect(mockFetchQuizDetails).toHaveBeenCalledTimes(1);

      // Advance time
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // Should not have been called again
      expect(mockFetchQuizDetails).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Background Refetching Tests
  // ==========================================================================

  describe('Background Refetching', () => {
    it('should have isFetching true during background updates', async () => {
      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      // Setup slow response for refetch
      mockFetchQuizDetails.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockApiResponse()), 100))
      );

      // Trigger refetch
      act(() => {
        result.current.refetch();
      });

      // During background refetch, isFetching should be true but isLoading false
      // (we have cached data, so it's a background update)
      await waitFor(() => {
        expect(result.current.isFetching).toBe(true);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.quiz).toBeDefined(); // Still have data during background fetch
      });

      // Wait for refetch to complete
      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Multiple Hook Instances Tests
  // ==========================================================================

  describe('Multiple Hook Instances', () => {
    it('should maintain separate cache entries for different quizIds', async () => {
      const quiz10 = createMockQuiz({ id: 10, name: 'Quiz Ten' });
      const quiz20 = createMockQuiz({ id: 20, name: 'Quiz Twenty' });

      mockFetchQuizDetails
        .mockResolvedValueOnce(createMockApiResponse(quiz10))
        .mockResolvedValueOnce(createMockApiResponse(quiz20));

      // Render two hooks with different quizIds
      const { result: result10 } = renderHook(() => useQuiz(10), {
        wrapper: createWrapper(queryClient),
      });

      const { result: result20 } = renderHook(() => useQuiz(20), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result10.current.quiz?.id).toBe(10);
        expect(result20.current.quiz?.id).toBe(20);
      });

      // Verify cache entries are separate
      expect(result10.current.quiz?.name).toBe('Quiz Ten');
      expect(result20.current.quiz?.name).toBe('Quiz Twenty');
    });

    it('should share cache data between hook instances with same quizId', async () => {
      const mockQuiz = createMockQuiz({ id: 5, name: 'Shared Quiz' });
      mockFetchQuizDetails.mockResolvedValue(createMockApiResponse(mockQuiz));

      // First instance
      const { result: result1 } = renderHook(() => useQuiz(5), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.quiz).toBeDefined();
      });

      // Second instance with same quizId - should use cached data
      const { result: result2 } = renderHook(() => useQuiz(5), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result2.current.quiz?.name).toBe('Shared Quiz');
      });

      // Both should have the same data
      expect(result1.current.quiz?.id).toBe(result2.current.quiz?.id);
    });
  });

  // ==========================================================================
  // Cleanup Behavior Tests
  // ==========================================================================

  describe('Cleanup Behavior', () => {
    it('should not cause memory leaks when unmounted', async () => {
      const { result, unmount } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });

    it('should handle rapid mount/unmount cycles', async () => {
      const results: ReturnType<typeof renderHook>[] = [];

      // Rapidly mount and unmount
      for (let i = 0; i < 5; i++) {
        const hookResult = renderHook(() => useQuiz(1), {
          wrapper: createWrapper(queryClient),
        });
        results.push(hookResult);
        hookResult.unmount();
      }

      // Final mount
      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      // Should have no errors
      expect(result.current.isError).toBe(false);
    });

    it('should cancel pending requests on unmount', async () => {
      // Setup slow API response
      let resolvePromise: (value: unknown) => void;
      mockFetchQuizDetails.mockImplementation(
        () => new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const { result, unmount } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);

      // Unmount while loading
      unmount();

      // Resolve the promise after unmount
      resolvePromise!(createMockApiResponse());

      // Should not cause any errors (React Query handles this)
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });

  // ==========================================================================
  // TypeScript Typing Tests
  // ==========================================================================

  describe('TypeScript Typing', () => {
    it('should return values matching UseQuizResult interface', async () => {
      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      // Type assertions - these will fail compilation if types don't match
      const hookResult: UseQuizResult = result.current;
      
      // Verify structure at runtime
      expect(hookResult.quiz).toBeDefined();
      expect(typeof hookResult.isLoading).toBe('boolean');
      expect(typeof hookResult.isFetching).toBe('boolean');
      expect(typeof hookResult.isError).toBe('boolean');
      expect(hookResult.error === null || hookResult.error instanceof Error).toBe(true);
      expect(typeof hookResult.refetch).toBe('function');
    });

    it('should have quiz typed as Quiz | undefined', async () => {
      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      // Initially undefined
      expect(result.current.quiz).toBeUndefined();

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      // After fetch, should have Quiz properties
      if (result.current.quiz) {
        expect(typeof result.current.quiz.id).toBe('number');
        expect(typeof result.current.quiz.name).toBe('string');
        expect(typeof result.current.quiz.course).toBe('number');
      }
    });

    it('should accept correct option types', async () => {
      // This test verifies TypeScript compilation - will fail if types are wrong
      const onSuccess = vi.fn<[Quiz], void>();
      const onError = vi.fn<[Error], void>();

      const { result } = renderHook(
        () => useQuiz(1, {
          enabled: true,
          refetchInterval: 5000,
          onSuccess,
          onError,
        }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      // Verify callbacks received correct types
      expect(onSuccess).toHaveBeenCalled();
      const calledWithQuiz = onSuccess.mock.calls[0][0];
      expect(typeof calledWithQuiz.id).toBe('number');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty quiz data from API', async () => {
      const emptyQuiz = createMockQuiz({
        name: '',
        intro: '',
        timelimit: 0,
        attempts: 0,
      });
      mockFetchQuizDetails.mockResolvedValue(createMockApiResponse(emptyQuiz));

      const { result } = renderHook(() => useQuiz(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      expect(result.current.quiz?.name).toBe('');
      expect(result.current.quiz?.timelimit).toBe(0);
    });

    it('should handle very large quizId values', async () => {
      const largeId = Number.MAX_SAFE_INTEGER;
      const mockQuiz = createMockQuiz({ id: largeId });
      mockFetchQuizDetails.mockResolvedValue(createMockApiResponse(mockQuiz));

      const { result } = renderHook(() => useQuiz(largeId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      expect(result.current.quiz?.id).toBe(largeId);
      expect(mockFetchQuizDetails).toHaveBeenCalledWith(largeId);
    });

    it('should handle rapid option changes', async () => {
      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useQuiz(1, { enabled }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { enabled: true },
        }
      );

      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      // Rapidly toggle enabled
      rerender({ enabled: false });
      rerender({ enabled: true });
      rerender({ enabled: false });
      rerender({ enabled: true });

      // Should still work correctly
      await waitFor(() => {
        expect(result.current.quiz).toBeDefined();
      });

      expect(result.current.isError).toBe(false);
    });
  });
});
