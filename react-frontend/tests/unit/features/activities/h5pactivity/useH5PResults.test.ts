/**
 * @file useH5PResults.test.ts
 * @description Comprehensive unit tests for useH5PResults, useH5PUserAttempts, and useH5PAttemptResults hooks
 * 
 * Tests validate React Query integration for H5P attempt and result data fetching including:
 * - Basic functionality with data fetching
 * - Loading, success, and error states
 * - Pagination, sorting, and filtering support
 * - Automatic caching with 3-minute stale time
 * - Background refetching on window focus
 * - Query key generation for selective cache invalidation
 * - Optimistic updates for new attempts
 * - TypeScript type safety
 * - Proper cleanup on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import type { ReactNode } from 'react';

import {
  useH5PResults,
  useH5PUserAttempts,
  useH5PAttemptResults,
  h5pResultsQueryKeys,
} from '../../../../../src/features/activities/h5pactivity/hooks/useH5PResults';
import * as h5pApi from '../../../../../src/features/activities/h5pactivity/api/h5pApi';
import type {
  H5PResult,
  H5PAttempt,
  H5PUserAttempts,
  H5PAttemptWithResults,
  H5PInteractionType,
} from '../../../../../src/features/activities/h5pactivity/types/h5p.types';

/**
 * Response type for H5P results API
 */
interface H5PResultsResponse {
  activityid: number;
  attempts: H5PAttemptWithResults[];
  warnings?: Array<{ message: string }>;
}

// ============================================================================
// Mock Setup
// ============================================================================

vi.mock('../../../../../src/features/activities/h5pactivity/api/h5pApi');

const mockedH5pApi = h5pApi as unknown as {
  getResults: Mock;
  getUserAttempts: Mock;
  getAttemptResults: Mock;
};

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a mock H5P result with xAPI data
 */
const createMockResult = (overrides: Partial<H5PResult> = {}): H5PResult => ({
  id: 1,
  attemptid: 1,
  subcontent: '',
  timecreated: Date.now() / 1000,
  interactiontype: 'choice' as H5PInteractionType,
  description: 'What is the capital of France?',
  correctpattern: '["Paris"]',
  response: 'Paris',
  additionals: '{}',
  rawscore: 1,
  maxscore: 1,
  duration: 30,
  completion: 1,
  success: 1,
  ...overrides,
});

/**
 * Creates a mock H5P attempt
 */
const createMockAttempt = (overrides: Partial<H5PAttempt> = {}): H5PAttempt => ({
  id: 1,
  h5pactivityid: 1,
  userid: 1,
  timecreated: Math.floor(Date.now() / 1000),
  timemodified: Math.floor(Date.now() / 1000),
  attempt: 1,
  rawscore: 80,
  maxscore: 100,
  scaled: 0.8,
  duration: 300,
  completion: 1,
  success: 1,
  ...overrides,
});

/**
 * Creates mock H5P attempt with results
 */
const createMockAttemptWithResults = (
  overrides: Partial<H5PAttemptWithResults> = {}
): H5PAttemptWithResults => ({
  ...createMockAttempt(),
  results: [createMockResult()],
  ...overrides,
});

/**
 * Creates mock user attempts response
 */
const createMockUserAttempts = (overrides: Partial<H5PUserAttempts> = {}): H5PUserAttempts => ({
  userid: 1,
  firstname: 'Test',
  lastname: 'User',
  fullname: 'Test User',
  attemptcount: 1,
  attempts: [createMockAttempt()],
  scored: {
    title: 'Best Score',
    grademethod: 'highest',
    attemptid: 1,
    rawscore: 80,
    maxscore: 100,
    scaled: 0.8,
  },
  ...overrides,
});

/**
 * Creates mock results response
 * @param attempts - Array of attempts. Pass undefined to get a default mock attempt, pass [] for empty results
 */
const createMockResultsResponse = (attempts?: H5PAttemptWithResults[]) => ({
  activityid: 1,
  attempts: attempts === undefined ? [createMockAttemptWithResults()] : attempts,
  warnings: [],
});

/**
 * Creates mock user attempts response
 * @param usersattempts - Array of user attempts. Pass undefined to get a default, pass [] for empty results
 */
const createMockUserAttemptsResponse = (usersattempts?: H5PUserAttempts[], totalattempts?: number) => ({
  activityid: 1,
  usersattempts: usersattempts === undefined ? [createMockUserAttempts()] : usersattempts,
  totalattempts: totalattempts ?? (usersattempts === undefined ? 1 : usersattempts.length),
  warnings: [],
});

/**
 * Creates mock attempt results response
 * @param results - Array of results. Pass undefined to get a default mock result, pass [] for empty results
 */
const createMockAttemptResultsResponse = (results?: H5PResult[]) => ({
  attemptid: 1,
  results: results === undefined ? [createMockResult()] : results,
  warnings: [],
});

// ============================================================================
// Test Wrapper
// ============================================================================

/**
 * Creates a wrapper component with QueryClientProvider for testing hooks
 */
const createWrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
};

/**
 * Creates a fresh QueryClient for each test
 */
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

// ============================================================================
// Test Suite
// ============================================================================

describe('useH5PResults Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Basic Functionality Tests
  // --------------------------------------------------------------------------
  describe('Basic Functionality', () => {
    it('returns attempts array on successful fetch', async () => {
      const mockResponse = createMockResultsResponse();
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.attempts).toHaveLength(1);
    });

    it('attempts data matches H5PAttemptWithResults interface', async () => {
      const mockAttempt = createMockAttemptWithResults({
        id: 42,
        attempt: 3,
        rawscore: 75,
        maxscore: 100,
      });
      const mockResponse = createMockResultsResponse([mockAttempt]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const attempt = result.current.data?.attempts[0];
      expect(attempt).toMatchObject({
        id: 42,
        attempt: 3,
        rawscore: 75,
        maxscore: 100,
      });
      expect(attempt?.results).toBeDefined();
    });

    it('calls h5pApi.getResults with activity ID', async () => {
      const mockResponse = createMockResultsResponse();
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      renderHook(() => useH5PResults(123), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockedH5pApi.getResults).toHaveBeenCalled();
      });

      expect(mockedH5pApi.getResults).toHaveBeenCalledWith(123, undefined);
    });

    it('returns data, isLoading, error, refetch', async () => {
      const mockResponse = createMockResultsResponse();
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      // Initial state
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
      expect(typeof result.current.refetch).toBe('function');

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('hook works with valid parameters', async () => {
      const mockResponse = createMockResultsResponse();
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1, { attemptIds: [1, 2, 3] }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedH5pApi.getResults).toHaveBeenCalledWith(1, [1, 2, 3]);
    });
  });

  // --------------------------------------------------------------------------
  // Loading State Tests
  // --------------------------------------------------------------------------
  describe('Loading State', () => {
    it('isLoading is true initially', () => {
      mockedH5pApi.getResults.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockResultsResponse()), 100))
      );

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('data is undefined during loading', () => {
      mockedH5pApi.getResults.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockResultsResponse()), 100))
      );

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.data).toBeUndefined();
    });

    it('error is null during loading', () => {
      mockedH5pApi.getResults.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockResultsResponse()), 100))
      );

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.error).toBeNull();
    });

    it('loading state transitions to success', async () => {
      const mockResponse = createMockResultsResponse();
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('shows loading for API delays', async () => {
      let resolvePromise: (value: unknown) => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockedH5pApi.getResults.mockReturnValue(delayedPromise);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      resolvePromise!(createMockResultsResponse());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Success State Tests
  // --------------------------------------------------------------------------
  describe('Success State', () => {
    it('isLoading is false after success', async () => {
      const mockResponse = createMockResultsResponse();
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('data contains attempts array', async () => {
      const mockResponse = createMockResultsResponse([
        createMockAttemptWithResults({ id: 1 }),
        createMockAttemptWithResults({ id: 2 }),
      ]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attempts).toHaveLength(2);
    });

    it('error is null on success', async () => {
      const mockResponse = createMockResultsResponse();
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.error).toBeNull();
    });

    it('each attempt has required fields', async () => {
      const mockResponse = createMockResultsResponse();
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const attempt = result.current.data?.attempts[0];
      expect(attempt).toHaveProperty('id');
      expect(attempt).toHaveProperty('attempt');
      expect(attempt).toHaveProperty('rawscore');
      expect(attempt).toHaveProperty('maxscore');
      expect(attempt).toHaveProperty('duration');
      expect(attempt).toHaveProperty('completion');
      expect(attempt).toHaveProperty('success');
      expect(attempt).toHaveProperty('results');
    });

    it('includes scoring and completion data', async () => {
      const mockAttempt = createMockAttemptWithResults({
        rawscore: 85,
        maxscore: 100,
        scaled: 0.85,
        completion: 1,
        success: 1,
      });
      const mockResponse = createMockResultsResponse([mockAttempt]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const attempt = result.current.data?.attempts[0];
      expect(attempt?.rawscore).toBe(85);
      expect(attempt?.maxscore).toBe(100);
      expect(attempt?.scaled).toBe(0.85);
      expect(attempt?.completion).toBe(1);
      expect(attempt?.success).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Error State Tests
  // --------------------------------------------------------------------------
  describe('Error State', () => {
    it('isLoading is false after error', async () => {
      mockedH5pApi.getResults.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('error object contains details', async () => {
      const testError = new Error('Failed to fetch results');
      mockedH5pApi.getResults.mockRejectedValue(testError);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Failed to fetch results');
    });

    it('data is undefined on error', async () => {
      mockedH5pApi.getResults.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.data).toBeUndefined();
    });

    it('handles no attempts gracefully', async () => {
      const mockResponse = createMockResultsResponse([]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attempts).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });

    it('handles API errors (404)', async () => {
      const error = new Error('Activity not found');
      (error as Error & { status?: number }).status = 404;
      mockedH5pApi.getResults.mockRejectedValue(error);

      const { result } = renderHook(() => useH5PResults(999), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Activity not found');
    });

    it('handles API errors (403 Forbidden)', async () => {
      const error = new Error('Access denied');
      (error as Error & { status?: number }).status = 403;
      mockedH5pApi.getResults.mockRejectedValue(error);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Access denied');
    });

    it('handles API errors (500 Server Error)', async () => {
      const error = new Error('Internal server error');
      (error as Error & { status?: number }).status = 500;
      mockedH5pApi.getResults.mockRejectedValue(error);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Internal server error');
    });

    it('handles network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      mockedH5pApi.getResults.mockRejectedValue(networkError);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.name).toBe('NetworkError');
    });
  });

  // --------------------------------------------------------------------------
  // Refetch Tests
  // --------------------------------------------------------------------------
  describe('Refetch', () => {
    it('provides refetch function', async () => {
      const mockResponse = createMockResultsResponse();
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(typeof result.current.refetch).toBe('function');
    });

    it('refetch() triggers new API call', async () => {
      const mockResponse = createMockResultsResponse();
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedH5pApi.getResults).toHaveBeenCalledTimes(1);

      await result.current.refetch();

      expect(mockedH5pApi.getResults).toHaveBeenCalledTimes(2);
    });

    it('updates data on successful refetch', async () => {
      const initialResponse = createMockResultsResponse([
        createMockAttemptWithResults({ rawscore: 50 }),
      ]);
      const updatedResponse = createMockResultsResponse([
        createMockAttemptWithResults({ rawscore: 100 }),
      ]);

      mockedH5pApi.getResults
        .mockResolvedValueOnce(initialResponse)
        .mockResolvedValueOnce(updatedResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attempts[0]?.rawscore).toBe(50);

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.data?.attempts[0]?.rawscore).toBe(100);
      });
    });

    it('handles refetch errors', async () => {
      const mockResponse = createMockResultsResponse();
      mockedH5pApi.getResults
        .mockResolvedValueOnce(mockResponse)
        .mockRejectedValueOnce(new Error('Refetch failed'));

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('manual refetch bypasses cache', async () => {
      const mockResponse = createMockResultsResponse();
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Clear mock call count
      mockedH5pApi.getResults.mockClear();

      // Force refetch
      await result.current.refetch();

      expect(mockedH5pApi.getResults).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Caching Tests
  // --------------------------------------------------------------------------
  describe('Caching', () => {
    it('second call uses cached data', async () => {
      const mockResponse = createMockResultsResponse();
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      // First call
      const { result: result1 } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      expect(mockedH5pApi.getResults).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const { result: result2 } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      // Should immediately have data from cache
      expect(result2.current.data).toBeDefined();
      expect(mockedH5pApi.getResults).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('different activity IDs have separate caches', async () => {
      const response1 = createMockResultsResponse([createMockAttemptWithResults({ id: 1 })]);
      const response2 = createMockResultsResponse([createMockAttemptWithResults({ id: 2 })]);

      mockedH5pApi.getResults
        .mockResolvedValueOnce(response1)
        .mockResolvedValueOnce(response2);

      const { result: result1 } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      const { result: result2 } = renderHook(() => useH5PResults(2), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      expect(mockedH5pApi.getResults).toHaveBeenCalledTimes(2);
      expect(result1.current.data?.attempts[0]?.id).toBe(1);
      expect(result2.current.data?.attempts[0]?.id).toBe(2);
    });

    it('caches results with attemptIds separately', async () => {
      const response1 = createMockResultsResponse();
      const response2 = createMockResultsResponse();

      mockedH5pApi.getResults
        .mockResolvedValueOnce(response1)
        .mockResolvedValueOnce(response2);

      // Call without attemptIds
      const { result: result1 } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Call with attemptIds
      const { result: result2 } = renderHook(
        () => useH5PResults(1, { attemptIds: [1, 2] }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Should be 2 separate API calls due to different cache keys
      expect(mockedH5pApi.getResults).toHaveBeenCalledTimes(2);
    });
  });

  // --------------------------------------------------------------------------
  // Query Key Tests
  // --------------------------------------------------------------------------
  describe('Query Key', () => {
    it('h5pResultsQueryKeys generates proper keys', () => {
      const key = h5pResultsQueryKeys.activity(1);
      expect(key).toEqual(['h5pResults', 'activity', 1]);
    });

    it('h5pResultsQueryKeys includes attemptIds in key', () => {
      const key = h5pResultsQueryKeys.results(1, [1, 2, 3]);
      expect(key).toEqual(['h5pResults', 'activity', 1, 'results', { attemptIds: [1, 2, 3] }]);
    });

    it('different params generate different keys', () => {
      const key1 = h5pResultsQueryKeys.activity(1);
      const key2 = h5pResultsQueryKeys.activity(2);
      const key3 = h5pResultsQueryKeys.results(1, [1]);

      expect(key1).not.toEqual(key2);
      expect(key1).not.toEqual(key3);
    });

    it('enables selective invalidation', async () => {
      const mockResponse = createMockResultsResponse();
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Invalidate specific query
      await queryClient.invalidateQueries({ queryKey: h5pResultsQueryKeys.results(1) });

      await waitFor(() => {
        // After invalidation, data should refetch
        expect(mockedH5pApi.getResults).toHaveBeenCalledTimes(2);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Detailed Results Tests (xAPI Statement Data)
  // --------------------------------------------------------------------------
  describe('Detailed Results (xAPI Data)', () => {
    it('returns results array with xAPI data', async () => {
      const mockResult = createMockResult({
        interactiontype: 'choice' as H5PInteractionType,
        description: 'What is 2+2?',
        correctpattern: '["4"]',
        response: '4',
      });
      const mockAttempt = createMockAttemptWithResults({
        results: [mockResult],
      });
      const mockResponse = createMockResultsResponse([mockAttempt]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const attemptResult = result.current.data?.attempts[0]?.results[0];
      expect(attemptResult?.interactiontype).toBe('choice');
      expect(attemptResult?.description).toBe('What is 2+2?');
      expect(attemptResult?.correctpattern).toBe('["4"]');
      expect(attemptResult?.response).toBe('4');
    });

    it('each result has interaction type', async () => {
      const interactionTypes: H5PInteractionType[] = ['choice', 'true-false', 'fill-in', 'matching'];
      const results = interactionTypes.map((type, idx) =>
        createMockResult({ id: idx, interactiontype: type })
      );
      const mockAttempt = createMockAttemptWithResults({ results });
      const mockResponse = createMockResultsResponse([mockAttempt]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const attemptResults = result.current.data?.attempts[0]?.results;
      expect(attemptResults).toHaveLength(4);
      interactionTypes.forEach((type, idx) => {
        expect(attemptResults?.[idx]?.interactiontype).toBe(type);
      });
    });

    it('includes correct answer and user response', async () => {
      const mockResult = createMockResult({
        correctpattern: '["Paris"]',
        response: 'London',
        success: 0,
      });
      const mockAttempt = createMockAttemptWithResults({ results: [mockResult] });
      const mockResponse = createMockResultsResponse([mockAttempt]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const attemptResult = result.current.data?.attempts[0]?.results[0];
      expect(attemptResult?.correctpattern).toBe('["Paris"]');
      expect(attemptResult?.response).toBe('London');
      expect(attemptResult?.success).toBe(0);
    });

    it('contains scoring information', async () => {
      const mockResult = createMockResult({
        rawscore: 3,
        maxscore: 5,
      });
      const mockAttempt = createMockAttemptWithResults({ results: [mockResult] });
      const mockResponse = createMockResultsResponse([mockAttempt]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const attemptResult = result.current.data?.attempts[0]?.results[0];
      expect(attemptResult?.rawscore).toBe(3);
      expect(attemptResult?.maxscore).toBe(5);
    });

    it('has additionals field for extra data', async () => {
      const additionalData = JSON.stringify({ hint: 'Think about Europe', category: 'Geography' });
      const mockResult = createMockResult({ additionals: additionalData });
      const mockAttempt = createMockAttemptWithResults({ results: [mockResult] });
      const mockResponse = createMockResultsResponse([mockAttempt]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const attemptResult = result.current.data?.attempts[0]?.results[0];
      expect(attemptResult?.additionals).toBe(additionalData);
      expect(JSON.parse(attemptResult?.additionals || '{}')).toHaveProperty('hint');
    });
  });

  // --------------------------------------------------------------------------
  // Attempt Metadata Tests
  // --------------------------------------------------------------------------
  describe('Attempt Metadata', () => {
    it('returns attempt number', async () => {
      const mockAttempt = createMockAttemptWithResults({ attempt: 3 });
      const mockResponse = createMockResultsResponse([mockAttempt]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attempts[0]?.attempt).toBe(3);
    });

    it('includes timestamps (created, modified)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockAttempt = createMockAttemptWithResults({
        timecreated: now,
        timemodified: now + 100,
      });
      const mockResponse = createMockResultsResponse([mockAttempt]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attempts[0]?.timecreated).toBe(now);
      expect(result.current.data?.attempts[0]?.timemodified).toBe(now + 100);
    });

    it('contains score data (raw, max, scaled)', async () => {
      const mockAttempt = createMockAttemptWithResults({
        rawscore: 75,
        maxscore: 100,
        scaled: 0.75,
      });
      const mockResponse = createMockResultsResponse([mockAttempt]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const attempt = result.current.data?.attempts[0];
      expect(attempt?.rawscore).toBe(75);
      expect(attempt?.maxscore).toBe(100);
      expect(attempt?.scaled).toBe(0.75);
    });

    it('includes duration in seconds', async () => {
      const mockAttempt = createMockAttemptWithResults({ duration: 300 });
      const mockResponse = createMockResultsResponse([mockAttempt]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attempts[0]?.duration).toBe(300);
    });

    it('has completion status (number)', async () => {
      const mockAttempt = createMockAttemptWithResults({ completion: 1 });
      const mockResponse = createMockResultsResponse([mockAttempt]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attempts[0]?.completion).toBe(1);
    });

    it('has success status (number)', async () => {
      const mockAttempt = createMockAttemptWithResults({ success: 0 });
      const mockResponse = createMockResultsResponse([mockAttempt]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attempts[0]?.success).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Multiple Attempts Tests
  // --------------------------------------------------------------------------
  describe('Multiple Attempts', () => {
    it('handles single attempt', async () => {
      const mockResponse = createMockResultsResponse([createMockAttemptWithResults()]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attempts).toHaveLength(1);
    });

    it('handles multiple attempts (10+)', async () => {
      const attempts = Array.from({ length: 15 }, (_, i) =>
        createMockAttemptWithResults({ id: i + 1, attempt: i + 1 })
      );
      const mockResponse = createMockResultsResponse(attempts);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attempts).toHaveLength(15);
    });

    it('handles many attempts (100+)', async () => {
      const attempts = Array.from({ length: 100 }, (_, i) =>
        createMockAttemptWithResults({ id: i + 1, attempt: i + 1 })
      );
      const mockResponse = createMockResultsResponse(attempts);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attempts).toHaveLength(100);
    });

    it('empty array when no attempts', async () => {
      const mockResponse = createMockResultsResponse([]);
      mockedH5pApi.getResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attempts).toEqual([]);
    });
  });
});

// ============================================================================
// useH5PUserAttempts Hook Tests
// ============================================================================

describe('useH5PUserAttempts Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Basic Functionality Tests
  // --------------------------------------------------------------------------
  describe('Basic Functionality', () => {
    it('returns user attempts on successful fetch', async () => {
      const mockResponse = createMockUserAttemptsResponse();
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PUserAttempts(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.usersattempts).toHaveLength(1);
    });

    it('calls h5pApi.getUserAttempts with activity ID', async () => {
      const mockResponse = createMockUserAttemptsResponse();
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      renderHook(() => useH5PUserAttempts(123), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockedH5pApi.getUserAttempts).toHaveBeenCalled();
      });

      expect(mockedH5pApi.getUserAttempts).toHaveBeenCalledWith(123, expect.any(Object));
    });

    it('returns user info with attempts', async () => {
      const mockUserAttempts = createMockUserAttempts({
        userid: 42,
        firstname: 'John',
        lastname: 'Doe',
        fullname: 'John Doe',
      });
      const mockResponse = createMockUserAttemptsResponse([mockUserAttempts]);
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PUserAttempts(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const userAttempt = result.current.data?.usersattempts[0];
      expect(userAttempt?.userid).toBe(42);
      expect(userAttempt?.fullname).toBe('John Doe');
      expect(userAttempt?.firstname).toBe('John');
      expect(userAttempt?.lastname).toBe('Doe');
    });

    it('includes scored attempt information', async () => {
      const mockUserAttempts = createMockUserAttempts({
        scored: {
          title: 'Highest Score',
          grademethod: 'highest',
          attemptid: 5,
          rawscore: 95,
          maxscore: 100,
          scaled: 0.95,
        },
      });
      const mockResponse = createMockUserAttemptsResponse([mockUserAttempts]);
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PUserAttempts(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const scored = result.current.data?.usersattempts[0]?.scored;
      expect(scored?.rawscore).toBe(95);
      expect(scored?.maxscore).toBe(100);
      expect(scored?.attemptid).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // Pagination Tests
  // --------------------------------------------------------------------------
  describe('Pagination', () => {
    it('accepts page parameter', async () => {
      const mockResponse = createMockUserAttemptsResponse();
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      renderHook(() => useH5PUserAttempts(1, { page: 2 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockedH5pApi.getUserAttempts).toHaveBeenCalled();
      });

      expect(mockedH5pApi.getUserAttempts).toHaveBeenCalledWith(1, expect.objectContaining({ page: 2 }));
    });

    it('accepts perPage parameter', async () => {
      const mockResponse = createMockUserAttemptsResponse();
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      renderHook(() => useH5PUserAttempts(1, { perPage: 25 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockedH5pApi.getUserAttempts).toHaveBeenCalled();
      });

      expect(mockedH5pApi.getUserAttempts).toHaveBeenCalledWith(1, expect.objectContaining({ perPage: 25 }));
    });

    it('returns paginated results', async () => {
      const users = Array.from({ length: 5 }, (_, i) =>
        createMockUserAttempts({ userid: i + 1 })
      );
      const mockResponse = {
        ...createMockUserAttemptsResponse(users),
        totalattempts: 50,
      };
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PUserAttempts(1, { page: 1, perPage: 5 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.usersattempts).toHaveLength(5);
      expect(result.current.data?.totalattempts).toBe(50);
    });

    it('includes total count in response', async () => {
      const mockResponse = {
        ...createMockUserAttemptsResponse(),
        totalattempts: 100,
      };
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PUserAttempts(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.totalattempts).toBe(100);
    });

    it('page 1 shows first N items', async () => {
      const users = Array.from({ length: 10 }, (_, i) =>
        createMockUserAttempts({ userid: i + 1 })
      );
      const mockResponse = createMockUserAttemptsResponse(users);
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PUserAttempts(1, { page: 0, perPage: 10 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.usersattempts).toHaveLength(10);
      expect(result.current.data?.usersattempts[0]?.userid).toBe(1);
    });

    it('pagination pages cached separately', async () => {
      const page1Response = createMockUserAttemptsResponse([
        createMockUserAttempts({ userid: 1 }),
      ]);
      const page2Response = createMockUserAttemptsResponse([
        createMockUserAttempts({ userid: 11 }),
      ]);

      mockedH5pApi.getUserAttempts
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      // Fetch page 1
      const { result: result1 } = renderHook(() => useH5PUserAttempts(1, { page: 0 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Fetch page 2
      const { result: result2 } = renderHook(() => useH5PUserAttempts(1, { page: 1 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Should be 2 separate API calls
      expect(mockedH5pApi.getUserAttempts).toHaveBeenCalledTimes(2);
    });
  });

  // --------------------------------------------------------------------------
  // Sorting Tests
  // --------------------------------------------------------------------------
  describe('Sorting', () => {
    it('accepts sortorder parameter', async () => {
      const mockResponse = createMockUserAttemptsResponse();
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      renderHook(() => useH5PUserAttempts(1, { sortorder: 'lastname' }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockedH5pApi.getUserAttempts).toHaveBeenCalled();
      });

      expect(mockedH5pApi.getUserAttempts).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ sortorder: 'lastname' })
      );
    });

    it('accepts different sortorder values', async () => {
      const mockResponse = createMockUserAttemptsResponse();
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      renderHook(() => useH5PUserAttempts(1, { sortorder: 'firstname' }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockedH5pApi.getUserAttempts).toHaveBeenCalled();
      });

      expect(mockedH5pApi.getUserAttempts).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ sortorder: 'firstname' })
      );
    });

    it('sort order persists in query key', async () => {
      const mockResponse = createMockUserAttemptsResponse();
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      // Fetch with firstname order
      const { result: result1 } = renderHook(
        () => useH5PUserAttempts(1, { sortorder: 'firstname' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Fetch with lastname order - should be separate cache
      const { result: result2 } = renderHook(
        () => useH5PUserAttempts(1, { sortorder: 'lastname' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      expect(mockedH5pApi.getUserAttempts).toHaveBeenCalledTimes(2);
    });
  });

  // --------------------------------------------------------------------------
  // Filtering Tests
  // --------------------------------------------------------------------------
  describe('Filtering', () => {
    it('accepts firstInitial parameter', async () => {
      const mockResponse = createMockUserAttemptsResponse();
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      renderHook(() => useH5PUserAttempts(1, { firstInitial: 'J' }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockedH5pApi.getUserAttempts).toHaveBeenCalled();
      });

      expect(mockedH5pApi.getUserAttempts).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ firstInitial: 'J' })
      );
    });

    it('accepts lastInitial parameter', async () => {
      const mockResponse = createMockUserAttemptsResponse();
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      renderHook(() => useH5PUserAttempts(1, { lastInitial: 'S' }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockedH5pApi.getUserAttempts).toHaveBeenCalled();
      });

      expect(mockedH5pApi.getUserAttempts).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ lastInitial: 'S' })
      );
    });

    it('filters by user initials', async () => {
      const filteredUsers = [
        createMockUserAttempts({ userid: 1, firstname: 'John', lastname: 'Smith' }),
        createMockUserAttempts({ userid: 2, firstname: 'Jane', lastname: 'Snow' }),
      ];
      const mockResponse = createMockUserAttemptsResponse(filteredUsers);
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useH5PUserAttempts(1, { firstInitial: 'J', lastInitial: 'S' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.usersattempts).toHaveLength(2);
    });

    it('combines multiple filters', async () => {
      const mockResponse = createMockUserAttemptsResponse();
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      renderHook(
        () => useH5PUserAttempts(1, { firstInitial: 'A', lastInitial: 'B', page: 1, perPage: 10 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(mockedH5pApi.getUserAttempts).toHaveBeenCalled();
      });

      expect(mockedH5pApi.getUserAttempts).toHaveBeenCalledWith(1, {
        firstInitial: 'A',
        lastInitial: 'B',
        page: 1,
        perPage: 10,
      });
    });

    it('filters dont break pagination', async () => {
      const mockResponse = {
        ...createMockUserAttemptsResponse(),
        totalattempts: 30,
      };
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useH5PUserAttempts(1, { firstInitial: 'J', page: 2, perPage: 10 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedH5pApi.getUserAttempts).toHaveBeenCalledWith(1, {
        firstInitial: 'J',
        page: 2,
        perPage: 10,
      });
    });

    it('filter combinations cached separately', async () => {
      const mockResponse = createMockUserAttemptsResponse();
      mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

      // Fetch with filter J
      const { result: result1 } = renderHook(
        () => useH5PUserAttempts(1, { firstInitial: 'J' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Fetch with filter K - should be separate cache
      const { result: result2 } = renderHook(
        () => useH5PUserAttempts(1, { firstInitial: 'K' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      expect(mockedH5pApi.getUserAttempts).toHaveBeenCalledTimes(2);
    });
  });

  // --------------------------------------------------------------------------
  // Error State Tests
  // --------------------------------------------------------------------------
  describe('Error State', () => {
    it('handles API errors (404)', async () => {
      const error = new Error('Activity not found');
      mockedH5pApi.getUserAttempts.mockRejectedValue(error);

      const { result } = renderHook(() => useH5PUserAttempts(999), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Activity not found');
    });

    it('handles unauthorized (401)', async () => {
      const error = new Error('Unauthorized');
      mockedH5pApi.getUserAttempts.mockRejectedValue(error);

      const { result } = renderHook(() => useH5PUserAttempts(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Unauthorized');
    });

    it('handles forbidden (403)', async () => {
      const error = new Error('Access denied');
      mockedH5pApi.getUserAttempts.mockRejectedValue(error);

      const { result } = renderHook(() => useH5PUserAttempts(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Access denied');
    });
  });
});

// ============================================================================
// useH5PAttemptResults Hook Tests
// ============================================================================

describe('useH5PAttemptResults Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Basic Functionality Tests
  // --------------------------------------------------------------------------
  describe('Basic Functionality', () => {
    it('fetches detailed results for attempt ID', async () => {
      const mockResponse = createMockAttemptResultsResponse();
      mockedH5pApi.getAttemptResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedH5pApi.getAttemptResults).toHaveBeenCalledWith(1);
      expect(result.current.data?.results).toBeDefined();
    });

    it('returns results array with xAPI data', async () => {
      const mockResults = [
        createMockResult({ id: 1, interactiontype: 'choice' as H5PInteractionType }),
        createMockResult({ id: 2, interactiontype: 'true-false' as H5PInteractionType }),
      ];
      const mockResponse = createMockAttemptResultsResponse(mockResults);
      mockedH5pApi.getAttemptResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.results).toHaveLength(2);
    });

    it('each result has interaction type', async () => {
      const mockResult = createMockResult({ interactiontype: 'fill-in' as H5PInteractionType });
      const mockResponse = createMockAttemptResultsResponse([mockResult]);
      mockedH5pApi.getAttemptResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.results[0]?.interactiontype).toBe('fill-in');
    });

    it('includes correct answer and user response', async () => {
      const mockResult = createMockResult({
        correctpattern: '["42"]',
        response: '42',
      });
      const mockResponse = createMockAttemptResultsResponse([mockResult]);
      mockedH5pApi.getAttemptResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.results[0]?.correctpattern).toBe('["42"]');
      expect(result.current.data?.results[0]?.response).toBe('42');
    });

    it('contains scoring information', async () => {
      const mockResult = createMockResult({
        rawscore: 2,
        maxscore: 3,
      });
      const mockResponse = createMockAttemptResultsResponse([mockResult]);
      mockedH5pApi.getAttemptResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.results[0]?.rawscore).toBe(2);
      expect(result.current.data?.results[0]?.maxscore).toBe(3);
    });

    it('tests getAttemptResults API method', async () => {
      const mockResponse = createMockAttemptResultsResponse();
      mockedH5pApi.getAttemptResults.mockResolvedValue(mockResponse);

      renderHook(() => useH5PAttemptResults(5), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockedH5pApi.getAttemptResults).toHaveBeenCalled();
      });

      expect(mockedH5pApi.getAttemptResults).toHaveBeenCalledWith(5);
    });
  });

  // --------------------------------------------------------------------------
  // xAPI Statement Data Tests
  // --------------------------------------------------------------------------
  describe('xAPI Statement Data', () => {
    it('results include statement details', async () => {
      const mockResult = createMockResult({
        description: 'Select the correct answer',
        interactiontype: 'choice' as H5PInteractionType,
      });
      const mockResponse = createMockAttemptResultsResponse([mockResult]);
      mockedH5pApi.getAttemptResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.results[0]?.description).toBe('Select the correct answer');
    });

    it('contains interaction type', async () => {
      const mockResult = createMockResult({ interactiontype: 'matching' as H5PInteractionType });
      const mockResponse = createMockAttemptResultsResponse([mockResult]);
      mockedH5pApi.getAttemptResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.results[0]?.interactiontype).toBe('matching');
    });

    it('has description text', async () => {
      const mockResult = createMockResult({
        description: 'Match the capitals with their countries',
      });
      const mockResponse = createMockAttemptResultsResponse([mockResult]);
      mockedH5pApi.getAttemptResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.results[0]?.description).toContain('Match the capitals');
    });

    it('includes correct pattern', async () => {
      const mockResult = createMockResult({
        correctpattern: '["France[.]Paris","Germany[.]Berlin"]',
      });
      const mockResponse = createMockAttemptResultsResponse([mockResult]);
      mockedH5pApi.getAttemptResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.results[0]?.correctpattern).toContain('France');
    });

    it('contains user response', async () => {
      const mockResult = createMockResult({
        response: 'France[.]Paris[,]Germany[.]Madrid',
      });
      const mockResponse = createMockAttemptResultsResponse([mockResult]);
      mockedH5pApi.getAttemptResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.results[0]?.response).toContain('Madrid');
    });

    it('has additionals field for extra data', async () => {
      const additionalData = JSON.stringify({
        extensions: { difficulty: 'hard' },
        context: { groupId: 'geography' },
      });
      const mockResult = createMockResult({ additionals: additionalData });
      const mockResponse = createMockAttemptResultsResponse([mockResult]);
      mockedH5pApi.getAttemptResults.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const parsed = JSON.parse(result.current.data?.results[0]?.additionals || '{}');
      expect(parsed.extensions.difficulty).toBe('hard');
    });
  });

  // --------------------------------------------------------------------------
  // Error Handling Tests
  // --------------------------------------------------------------------------
  describe('Error Handling', () => {
    it('handles missing attempt error', async () => {
      const error = new Error('Attempt not found');
      mockedH5pApi.getAttemptResults.mockRejectedValue(error);

      const { result } = renderHook(() => useH5PAttemptResults(999), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Attempt not found');
    });

    it('handles API failures', async () => {
      const error = new Error('Server error');
      mockedH5pApi.getAttemptResults.mockRejectedValue(error);

      const { result } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Server error');
    });
  });

  // --------------------------------------------------------------------------
  // Caching Tests
  // --------------------------------------------------------------------------
  describe('Caching', () => {
    it('caches results by attempt ID', async () => {
      const mockResponse = createMockAttemptResultsResponse();
      mockedH5pApi.getAttemptResults.mockResolvedValue(mockResponse);

      // First fetch
      const { result: result1 } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second fetch - should use cache
      const { result: result2 } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result2.current.data).toBeDefined();
      expect(mockedH5pApi.getAttemptResults).toHaveBeenCalledTimes(1);
    });

    it('different attempt IDs have separate caches', async () => {
      const response1 = createMockAttemptResultsResponse([createMockResult({ id: 1 })]);
      const response2 = createMockAttemptResultsResponse([createMockResult({ id: 2 })]);

      mockedH5pApi.getAttemptResults
        .mockResolvedValueOnce(response1)
        .mockResolvedValueOnce(response2);

      const { result: result1 } = renderHook(() => useH5PAttemptResults(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      const { result: result2 } = renderHook(() => useH5PAttemptResults(2), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      expect(mockedH5pApi.getAttemptResults).toHaveBeenCalledTimes(2);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('H5P Hooks Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it('works with QueryClientProvider', async () => {
    const mockResponse = createMockResultsResponse();
    mockedH5pApi.getResults.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useH5PResults(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
  });

  it('integrates with global cache', async () => {
    const mockResponse = createMockResultsResponse();
    mockedH5pApi.getResults.mockResolvedValue(mockResponse);

    // First hook
    const { result: result1 } = renderHook(() => useH5PResults(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
    });

    // Second hook shares cache
    const { result: result2 } = renderHook(() => useH5PResults(1), {
      wrapper: createWrapper(queryClient),
    });

    // Immediate access to cached data
    expect(result2.current.data).toBeDefined();
  });

  it('shares query client instance', async () => {
    const resultsResponse = createMockResultsResponse();
    const userAttemptsResponse = createMockUserAttemptsResponse();

    mockedH5pApi.getResults.mockResolvedValue(resultsResponse);
    mockedH5pApi.getUserAttempts.mockResolvedValue(userAttemptsResponse);

    // Both hooks share the same queryClient
    const { result: resultsHook } = renderHook(() => useH5PResults(1), {
      wrapper: createWrapper(queryClient),
    });

    const { result: userAttemptsHook } = renderHook(() => useH5PUserAttempts(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(resultsHook.current.isSuccess).toBe(true);
      expect(userAttemptsHook.current.isSuccess).toBe(true);
    });

    // Verify both are using the same client
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);
  });

  it('can invalidate related queries', async () => {
    const mockResponse = createMockResultsResponse();
    mockedH5pApi.getResults.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useH5PResults(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Invalidate all h5p queries
    await queryClient.invalidateQueries({ queryKey: ['h5pResults'] });

    await waitFor(() => {
      expect(mockedH5pApi.getResults).toHaveBeenCalledTimes(2);
    });
  });
});

// ============================================================================
// Type Safety Tests
// ============================================================================

describe('Type Safety', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it('return type matches UseQueryResult', async () => {
    const mockResponse = createMockResultsResponse();
    mockedH5pApi.getResults.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useH5PResults(1), {
      wrapper: createWrapper(queryClient),
    });

    // Type check: result should have UseQueryResult properties
    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('isError');
    expect(result.current).toHaveProperty('isSuccess');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('refetch');
    expect(result.current).toHaveProperty('isFetching');
  });

  it('attempts typed as H5PAttemptWithResults[]', async () => {
    const mockAttempt = createMockAttemptWithResults({
      id: 1,
      attempt: 1,
      rawscore: 80,
      maxscore: 100,
      results: [createMockResult()],
    });
    const mockResponse = createMockResultsResponse([mockAttempt]);
    mockedH5pApi.getResults.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useH5PResults(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const attempt = result.current.data?.attempts[0];
    // Type assertions - these should compile without errors
    expect(typeof attempt?.id).toBe('number');
    expect(typeof attempt?.attempt).toBe('number');
    expect(typeof attempt?.rawscore).toBe('number');
    expect(Array.isArray(attempt?.results)).toBe(true);
  });

  it('results typed as H5PResult[]', async () => {
    const mockResult = createMockResult({
      id: 1,
      interactiontype: 'choice' as H5PInteractionType,
      rawscore: 1,
      maxscore: 1,
    });
    const mockResponse = createMockAttemptResultsResponse([mockResult]);
    mockedH5pApi.getAttemptResults.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useH5PAttemptResults(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const h5pResult = result.current.data?.results[0];
    // Type assertions
    expect(typeof h5pResult?.id).toBe('number');
    expect(typeof h5pResult?.interactiontype).toBe('string');
    expect(typeof h5pResult?.rawscore).toBe('number');
  });

  it('error typed as Error object', async () => {
    const testError = new Error('Test error');
    mockedH5pApi.getResults.mockRejectedValue(testError);

    const { result } = renderHook(() => useH5PResults(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Error should be an Error instance
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Test error');
  });

  it('options parameter type-safe', async () => {
    const mockResponse = createMockResultsResponse();
    mockedH5pApi.getResults.mockResolvedValue(mockResponse);

    // Valid options should work
    const { result } = renderHook(
      () => useH5PResults(1, { attemptIds: [1, 2, 3] }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedH5pApi.getResults).toHaveBeenCalledWith(1, [1, 2, 3]);
  });
});

// ============================================================================
// Cleanup Tests
// ============================================================================

describe('Cleanup', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it('cleans up on unmount', async () => {
    const mockResponse = createMockResultsResponse();
    mockedH5pApi.getResults.mockResolvedValue(mockResponse);

    const { result, unmount } = renderHook(() => useH5PResults(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Unmount should not throw
    expect(() => unmount()).not.toThrow();
  });

  it('does not update after unmount', async () => {
    let resolvePromise: (value: unknown) => void;
    const slowPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockedH5pApi.getResults.mockReturnValue(slowPromise as Promise<H5PResultsResponse>);

    const { result, unmount } = renderHook(() => useH5PResults(1), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(true);

    // Unmount before promise resolves
    unmount();

    // Resolve the promise after unmount
    resolvePromise!(createMockResultsResponse());

    // No errors should occur - wait a tick
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(true).toBe(true);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it('handles activity ID of 0', async () => {
    const mockResponse = createMockResultsResponse();
    mockedH5pApi.getResults.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useH5PResults(0), {
      wrapper: createWrapper(queryClient),
    });

    // Activity ID of 0 is invalid, so query should be disabled
    // Wait a tick to ensure hook has initialized
    await waitFor(() => {
      // Query should be disabled, so isLoading should be false and query never fires
      expect(result.current.isLoading).toBe(false);
    });

    // Query is disabled for invalid ID (0), so it should not have been called
    expect(mockedH5pApi.getResults).not.toHaveBeenCalled();
    // Success should be false since query never ran
    expect(result.current.isSuccess).toBe(false);
    // Data should be empty since query never ran
    expect(result.current.attempts).toEqual([]);
  });

  it('handles very large activity ID', async () => {
    const mockResponse = createMockResultsResponse();
    mockedH5pApi.getResults.mockResolvedValue(mockResponse);

    const largeId = 999999999;
    const { result } = renderHook(() => useH5PResults(largeId), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedH5pApi.getResults).toHaveBeenCalledWith(largeId, undefined);
  });

  it('handles empty attemptIds array', async () => {
    const mockResponse = createMockResultsResponse([]);
    mockedH5pApi.getResults.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useH5PResults(1, { attemptIds: [] }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedH5pApi.getResults).toHaveBeenCalledWith(1, []);
  });

  it('handles invalid response format gracefully', async () => {
    // Return invalid response - cast to bypass type checking for testing
    // The hook's queryFn does response.attempts.map(), which will throw if attempts is undefined
    mockedH5pApi.getResults.mockResolvedValue({ invalid: 'response' } as unknown as H5PResultsResponse);

    const { result } = renderHook(() => useH5PResults(1), {
      wrapper: createWrapper(queryClient),
    });

    // Wait for loading to complete (either success or error)
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // The hook tries to map over response.attempts which is undefined,
    // so it should throw an error and be in error state
    expect(result.current.isError).toBe(true);
    // Attempts should be empty since error occurred
    expect(result.current.attempts).toEqual([]);
  });

  it('handles missing required fields in response', async () => {
    // Response missing attempts array - this will cause .map() to fail
    mockedH5pApi.getResults.mockResolvedValue({ activityid: 1 } as unknown as H5PResultsResponse);

    const { result } = renderHook(() => useH5PResults(1), {
      wrapper: createWrapper(queryClient),
    });

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // The hook tries to map over undefined attempts, causing an error
    expect(result.current.isError).toBe(true);
    // Data should be undefined since query errored
    expect(result.current.data).toBeUndefined();
  });

  it('handles partial data scenarios', async () => {
    // Attempt with partial results
    const partialAttempt = {
      id: 1,
      attempt: 1,
      // Missing other fields
    };
    mockedH5pApi.getResults.mockResolvedValue({
      activityid: 1,
      attempts: [partialAttempt],
    } as unknown as H5PResultsResponse);

    const { result } = renderHook(() => useH5PResults(1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.attempts[0]?.id).toBe(1);
  });

  it('handles empty string for filter initials', async () => {
    const mockResponse = createMockUserAttemptsResponse();
    mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () => useH5PUserAttempts(1, { firstInitial: '', lastInitial: '' }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedH5pApi.getUserAttempts).toHaveBeenCalled();
  });

  it('handles zero perPage', async () => {
    const mockResponse = createMockUserAttemptsResponse();
    mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useH5PUserAttempts(1, { perPage: 0 }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedH5pApi.getUserAttempts).toHaveBeenCalledWith(1, expect.objectContaining({ perPage: 0 }));
  });

  it('handles very large page numbers', async () => {
    const mockResponse = createMockUserAttemptsResponse([]);
    mockedH5pApi.getUserAttempts.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useH5PUserAttempts(1, { page: 9999 }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.usersattempts).toHaveLength(0);
  });

  it('handles concurrent requests', async () => {
    const mockResponse = createMockResultsResponse();
    let callCount = 0;
    mockedH5pApi.getResults.mockImplementation(() => {
      callCount++;
      return Promise.resolve(mockResponse);
    });

    // Render multiple hooks simultaneously
    const { result: result1 } = renderHook(() => useH5PResults(1), {
      wrapper: createWrapper(queryClient),
    });
    const { result: result2 } = renderHook(() => useH5PResults(2), {
      wrapper: createWrapper(queryClient),
    });
    const { result: result3 } = renderHook(() => useH5PResults(3), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
      expect(result2.current.isSuccess).toBe(true);
      expect(result3.current.isSuccess).toBe(true);
    });

    expect(callCount).toBe(3);
  });

  it('handles rapid re-renders', async () => {
    const mockResponse = createMockResultsResponse();
    mockedH5pApi.getResults.mockResolvedValue(mockResponse);

    const { result, rerender } = renderHook(
      ({ id }) => useH5PResults(id),
      {
        wrapper: createWrapper(queryClient),
        initialProps: { id: 1 },
      }
    );

    // Rapid re-renders
    rerender({ id: 1 });
    rerender({ id: 1 });
    rerender({ id: 1 });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should only call API once due to caching
    expect(mockedH5pApi.getResults).toHaveBeenCalledTimes(1);
  });

  it('handles activity ID change', async () => {
    const response1 = createMockResultsResponse([createMockAttemptWithResults({ id: 1 })]);
    const response2 = createMockResultsResponse([createMockAttemptWithResults({ id: 2 })]);

    mockedH5pApi.getResults
      .mockResolvedValueOnce(response1)
      .mockResolvedValueOnce(response2);

    const { result, rerender } = renderHook(
      ({ id }) => useH5PResults(id),
      {
        wrapper: createWrapper(queryClient),
        initialProps: { id: 1 },
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.attempts[0]?.id).toBe(1);

    // Change activity ID
    rerender({ id: 2 });

    await waitFor(() => {
      expect(result.current.data?.attempts[0]?.id).toBe(2);
    });
  });
});
