/**
 * Unit Tests for useChoice React Query Hook
 *
 * Comprehensive test suite validating the useChoice hook's functionality including:
 * - Query caching behavior with React Query
 * - Refetching and background update mechanisms
 * - Error handling for network failures and permission errors
 * - Stale-while-revalidate patterns
 * - TypeScript type enforcement for Choice entity data
 *
 * Testing Strategy:
 * - Uses MSW (Mock Service Worker) for realistic HTTP mocking
 * - Uses React Testing Library's renderHook for hook testing
 * - Follows AAA (Arrange, Act, Assert) pattern
 * - Creates isolated QueryClient instances per test
 *
 * Based on requirements from Agent Action Plan Section 0.4 and 0.7.
 *
 * @module tests/unit/features/activities/choice/hooks/useChoice.test
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode, FC } from 'react';
import React from 'react';

import {
  useChoice,
  choiceQueryKeys,
  type Choice,
  type ChoiceOption,
  type ChoiceUserAnswer,
  type ChoiceAvailability,
  type ChoicePermissions,
} from '@/features/activities/choice/hooks/useChoice';

// ============================================================================
// Test Constants
// ============================================================================

/** API base URL for test requests */
const API_BASE_URL = '/api/v1';

/** Default stale time for choice queries (5 minutes in ms) */
const CHOICE_STALE_TIME = 5 * 60 * 1000;

/** Default GC time for choice queries (10 minutes in ms) */
const CHOICE_GC_TIME = 10 * 60 * 1000;

// ============================================================================
// Test Fixtures: Choice Options
// ============================================================================

/**
 * Creates a mock choice option with the specified overrides.
 *
 * @param overrides - Partial ChoiceOption to merge with defaults
 * @returns Complete ChoiceOption fixture
 */
function createMockChoiceOption(overrides: Partial<ChoiceOption> = {}): ChoiceOption {
  return {
    id: 1,
    text: 'Option A',
    maxanswers: 0,
    countanswers: 0,
    ...overrides,
  };
}

// ============================================================================
// Test Fixtures: User Answer
// ============================================================================

/**
 * Creates a mock user answer with the specified overrides.
 *
 * @param overrides - Partial ChoiceUserAnswer to merge with defaults
 * @returns Complete ChoiceUserAnswer fixture
 */
function createMockUserAnswer(overrides: Partial<ChoiceUserAnswer> = {}): ChoiceUserAnswer {
  return {
    hasAnswered: false,
    selectedOptionIds: [],
    timemodified: 0,
    answerIds: [],
    ...overrides,
  };
}

// ============================================================================
// Test Fixtures: Availability
// ============================================================================

/**
 * Creates a mock availability status with the specified overrides.
 *
 * @param overrides - Partial ChoiceAvailability to merge with defaults
 * @returns Complete ChoiceAvailability fixture
 */
function createMockAvailability(overrides: Partial<ChoiceAvailability> = {}): ChoiceAvailability {
  return {
    available: true,
    isOpen: true,
    isClosed: false,
    isPreview: false,
    warnings: [],
    openTime: 0,
    closeTime: 0,
    ...overrides,
  };
}

// ============================================================================
// Test Fixtures: Permissions
// ============================================================================

/**
 * Creates a mock permissions object with the specified overrides.
 *
 * @param overrides - Partial ChoicePermissions to merge with defaults
 * @returns Complete ChoicePermissions fixture
 */
function createMockPermissions(overrides: Partial<ChoicePermissions> = {}): ChoicePermissions {
  return {
    canChoose: true,
    canView: true,
    canManage: false,
    canUpdate: true,
    canViewResults: false,
    canDeleteOwn: true,
    ...overrides,
  };
}

// ============================================================================
// Test Fixtures: Choice Entity
// ============================================================================

/**
 * Creates a complete mock Choice entity with all required fields.
 *
 * @param overrides - Partial Choice to merge with defaults
 * @returns Complete Choice fixture
 */
function createMockChoice(overrides: Partial<Choice> = {}): Choice {
  return {
    id: 1,
    name: 'Test Choice Activity',
    intro: '<p>Please select your preferred option below.</p>',
    timeopen: 0,
    timeclose: 0,
    display: 1, // Vertical
    allowupdate: true,
    allowmultiple: false,
    limitanswers: false,
    showresults: 1, // After answer
    publish: 0, // Anonymous
    showunanswered: false,
    includeinactive: false,
    options: [
      createMockChoiceOption({ id: 1, text: 'Option A', countanswers: 5 }),
      createMockChoiceOption({ id: 2, text: 'Option B', countanswers: 3 }),
      createMockChoiceOption({ id: 3, text: 'Option C', countanswers: 2 }),
    ],
    userAnswer: createMockUserAnswer(),
    availability: createMockAvailability(),
    permissions: createMockPermissions(),
    courseId: 1,
    cmid: 100,
    introformat: 1,
    completionsubmit: true,
    showavailable: true,
    showpreview: false,
    timemodified: Date.now() / 1000,
    ...overrides,
  };
}

/**
 * Creates a mock choice with multiple selection enabled.
 *
 * @returns Choice fixture with allowmultiple enabled
 */
function createMockMultipleChoice(): Choice {
  return createMockChoice({
    id: 2,
    name: 'Multiple Selection Choice',
    allowmultiple: true,
    options: [
      createMockChoiceOption({ id: 4, text: 'Option 1' }),
      createMockChoiceOption({ id: 5, text: 'Option 2' }),
      createMockChoiceOption({ id: 6, text: 'Option 3' }),
      createMockChoiceOption({ id: 7, text: 'Option 4' }),
    ],
  });
}

/**
 * Creates a mock choice with limited capacity on options.
 *
 * @returns Choice fixture with limitanswers enabled
 */
function createMockLimitedChoice(): Choice {
  return createMockChoice({
    id: 3,
    name: 'Limited Capacity Choice',
    limitanswers: true,
    showavailable: true,
    options: [
      createMockChoiceOption({ id: 8, text: 'Limited Option A', maxanswers: 10, countanswers: 8 }),
      createMockChoiceOption({ id: 9, text: 'Limited Option B', maxanswers: 5, countanswers: 5 }),
      createMockChoiceOption({ id: 10, text: 'Unlimited Option', maxanswers: 0, countanswers: 15 }),
    ],
  });
}

/**
 * Creates a mock choice with time restrictions.
 *
 * @returns Choice fixture with timeopen and timeclose set
 */
function createMockTimedChoice(): Choice {
  const now = Math.floor(Date.now() / 1000);
  return createMockChoice({
    id: 4,
    name: 'Timed Choice Activity',
    timeopen: now - 3600, // Opened 1 hour ago
    timeclose: now + 3600, // Closes in 1 hour
    availability: createMockAvailability({
      openTime: now - 3600,
      closeTime: now + 3600,
      isOpen: true,
    }),
  });
}

/**
 * Creates a mock choice with different showresults settings.
 *
 * @param showresults - The showresults mode value
 * @returns Choice fixture with specified showresults
 */
function createMockChoiceWithResultsVisibility(showresults: 0 | 1 | 2 | 3): Choice {
  return createMockChoice({
    id: 5 + showresults,
    name: `Choice with showresults=${showresults}`,
    showresults,
  });
}

// ============================================================================
// API Response Helpers
// ============================================================================

/**
 * Creates a standard API success response envelope.
 *
 * @param data - The data payload to wrap
 * @returns API response envelope
 */
function createApiResponse<T>(data: T): { success: true; data: T } {
  return {
    success: true,
    data,
  };
}

/**
 * Creates a standard API error response.
 *
 * @param code - Error code
 * @param message - Error message
 * @returns API error response
 */
function createApiErrorResponse(code: string, message: string): { success: false; error: { code: string; message: string } } {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

// ============================================================================
// MSW Server Setup
// ============================================================================

/** Mock choice data for successful responses */
const mockChoice = createMockChoice();

/** MSW request handlers */
const handlers = [
  // Default success handler for choice endpoint
  http.get(`${API_BASE_URL}/choices/:id`, ({ params }) => {
    const id = Number(params.id);
    
    // Return choice with matching ID
    if (id === 1) {
      return HttpResponse.json(createApiResponse(mockChoice));
    }
    if (id === 2) {
      return HttpResponse.json(createApiResponse(createMockMultipleChoice()));
    }
    if (id === 3) {
      return HttpResponse.json(createApiResponse(createMockLimitedChoice()));
    }
    if (id === 4) {
      return HttpResponse.json(createApiResponse(createMockTimedChoice()));
    }
    
    // Default: return mock choice with modified ID
    return HttpResponse.json(createApiResponse({ ...mockChoice, id }));
  }),
];

/** MSW server instance */
const server = setupServer(...handlers);

// ============================================================================
// Test Wrapper Component
// ============================================================================

/**
 * Creates a test wrapper component with QueryClientProvider.
 *
 * @param queryClient - The QueryClient instance to use
 * @returns Wrapper component for renderHook
 */
function createWrapper(queryClient: QueryClient): FC<{ children: ReactNode }> {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('useChoice Hook', () => {
  let queryClient: QueryClient;

  // Start MSW server before all tests
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  // Reset handlers after each test
  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
  });

  // Stop server after all tests
  afterAll(() => {
    server.close();
  });

  // Create fresh QueryClient before each test
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries for faster tests
          gcTime: CHOICE_GC_TIME,
          staleTime: 0, // Override for testing
        },
      },
    });
  });

  // ==========================================================================
  // Test Setup and Configuration
  // ==========================================================================

  describe('Test Setup and Configuration', () => {
    it('should create QueryClient with correct configuration', () => {
      // Arrange & Act
      const client = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      // Assert
      expect(client).toBeDefined();
      expect(client.getDefaultOptions().queries?.retry).toBe(false);
    });

    it('should have mock fixtures with valid data', () => {
      // Arrange & Act
      const choice = createMockChoice();

      // Assert
      expect(choice.id).toBe(1);
      expect(choice.name).toBe('Test Choice Activity');
      expect(choice.options).toHaveLength(3);
      expect(choice.userAnswer.hasAnswered).toBe(false);
      expect(choice.availability.available).toBe(true);
      expect(choice.permissions.canChoose).toBe(true);
    });
  });

  // ==========================================================================
  // Query Caching Tests
  // ==========================================================================

  describe('Query Caching', () => {
    it('should populate cache with key ["choices", choiceId] on initial fetch', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      const cachedData = queryClient.getQueryData(choiceQueryKeys.detail(1));
      expect(cachedData).toBeDefined();
      expect(cachedData).toEqual(mockChoice);
    });

    it('should use cached data without refetching for subsequent calls with same ID', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      let fetchCount = 0;
      
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          fetchCount++;
          return HttpResponse.json(createApiResponse(mockChoice));
        })
      );

      // Act - First render
      const { result: result1 } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));

      // Act - Second render with same ID
      const { result: result2 } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result2.current.isSuccess).toBe(true));

      // Assert
      expect(fetchCount).toBe(1); // Only one fetch should have occurred
      expect(result1.current.data).toEqual(result2.current.data);
    });

    it('should respect staleTime configuration preventing unnecessary refetches', async () => {
      // Arrange
      const clientWithStaleTime = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: CHOICE_STALE_TIME, // 5 minutes
          },
        },
      });
      const wrapper = createWrapper(clientWithStaleTime);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - Data should not be stale immediately
      const queryState = clientWithStaleTime.getQueryState(choiceQueryKeys.detail(1));
      expect(queryState?.isInvalidated).toBe(false);
    });

    it('should persist cache across component unmounts/remounts', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act - First mount
      const { result: result1, unmount } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));
      
      // Unmount
      unmount();

      // Remount
      const { result: result2 } = renderHook(() => useChoice(1), { wrapper });

      // Assert - Should have cached data immediately
      expect(result2.current.data).toEqual(mockChoice);
    });

    it('should invalidate cache when data becomes stale', async () => {
      // Arrange
      const clientWithShortStale = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 0, // Immediately stale
          },
        },
      });
      const wrapper = createWrapper(clientWithShortStale);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      const queryState = clientWithShortStale.getQueryState(choiceQueryKeys.detail(1));
      expect(queryState?.dataUpdatedAt).toBeDefined();
    });

    it('should respect gcTime for unused cache entries', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result, unmount } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Unmount and check cache still exists
      unmount();
      const cachedData = queryClient.getQueryData(choiceQueryKeys.detail(1));

      // Assert - Cache should still exist after unmount (within gcTime)
      expect(cachedData).toBeDefined();
    });
  });

  // ==========================================================================
  // Data Fetching Tests
  // ==========================================================================

  describe('Data Fetching', () => {
    it('should return complete Choice data structure on successful fetch', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe(1);
      expect(result.current.data?.name).toBe('Test Choice Activity');
      expect(result.current.data?.options).toHaveLength(3);
      expect(result.current.data?.userAnswer).toBeDefined();
      expect(result.current.data?.availability).toBeDefined();
      expect(result.current.data?.permissions).toBeDefined();
    });

    it('should have isLoading true during initial fetch', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });

      // Assert - Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      // Wait for completion
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it('should have isLoading false after data loads', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeDefined();
    });

    it('should have isError false on successful fetch', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should transform data from API envelope format to typed Choice entity', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - Data should be unwrapped from envelope
      expect(result.current.data).not.toHaveProperty('success');
      expect(result.current.data?.id).toBe(mockChoice.id);
    });

    it('should dedupe concurrent requests with same choiceId', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      let fetchCount = 0;
      
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, async () => {
          fetchCount++;
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json(createApiResponse(mockChoice));
        })
      );

      // Act - Multiple concurrent renders
      const { result: result1 } = renderHook(() => useChoice(1), { wrapper });
      const { result: result2 } = renderHook(() => useChoice(1), { wrapper });
      const { result: result3 } = renderHook(() => useChoice(1), { wrapper });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
        expect(result2.current.isSuccess).toBe(true);
        expect(result3.current.isSuccess).toBe(true);
      });

      // Assert - Only one fetch should have occurred
      expect(fetchCount).toBe(1);
    });
  });

  // ==========================================================================
  // Refetching Behavior Tests
  // ==========================================================================

  describe('Refetching Behavior', () => {
    it('should trigger new API call when refetch() is called', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      let fetchCount = 0;
      
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          fetchCount++;
          return HttpResponse.json(createApiResponse(mockChoice));
        })
      );

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      
      expect(fetchCount).toBe(1);

      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Assert
      expect(fetchCount).toBe(2);
    });

    it('should preserve existing data during background update', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const updatedChoice = { ...mockChoice, name: 'Updated Choice Name' };
      let requestCount = 0;
      
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          requestCount++;
          if (requestCount === 1) {
            return HttpResponse.json(createApiResponse(mockChoice));
          }
          return HttpResponse.json(createApiResponse(updatedChoice));
        })
      );

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      
      const originalData = result.current.data;

      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Assert - Data should still be available during refetch
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.name).toBe('Updated Choice Name');
    });

    it('should have isFetching true during background refetch', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json(createApiResponse(mockChoice));
        })
      );

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Start refetch
      act(() => {
        result.current.refetch();
      });

      // Assert - isFetching should be true during refetch
      await waitFor(() => expect(result.current.isFetching).toBe(true));
      await waitFor(() => expect(result.current.isFetching).toBe(false));
    });

    it('should update cache with new data after refetch', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const updatedChoice = { ...mockChoice, name: 'Refreshed Choice' };
      let requestCount = 0;
      
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          requestCount++;
          if (requestCount === 1) {
            return HttpResponse.json(createApiResponse(mockChoice));
          }
          return HttpResponse.json(createApiResponse(updatedChoice));
        })
      );

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      
      await act(async () => {
        await result.current.refetch();
      });

      // Assert
      const cachedData = queryClient.getQueryData<Choice>(choiceQueryKeys.detail(1));
      expect(cachedData?.name).toBe('Refreshed Choice');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should set isError to true for 404 Not Found error', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/choices/999`, () => {
          return new HttpResponse(null, { status: 404 });
        })
      );
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(999), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Assert
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain('not found');
    });

    it('should handle 403 Permission Denied error with proper error structure', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          return HttpResponse.json(
            createApiErrorResponse('PERMISSION_DENIED', 'You do not have access to this choice'),
            { status: 403 }
          );
        })
      );
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Assert
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain('Permission denied');
    });

    it('should handle 500 Server Error', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Assert
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain('Server error');
    });

    it('should handle network timeout errors', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          return HttpResponse.error();
        })
      );
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Assert
      expect(result.current.error).toBeDefined();
    });

    it('should handle malformed JSON response', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          return new HttpResponse('not valid json', {
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Assert
      expect(result.current.error).toBeDefined();
    });

    it('should contain user-friendly error message', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          return new HttpResponse(null, { status: 404 });
        })
      );
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Assert - Error message should be user-friendly
      expect(result.current.error?.message).toBeDefined();
      expect(typeof result.current.error?.message).toBe('string');
      expect(result.current.error?.message.length).toBeGreaterThan(0);
    });

    it('should not corrupt existing cached data on error', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      let requestCount = 0;
      
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          requestCount++;
          if (requestCount === 1) {
            return HttpResponse.json(createApiResponse(mockChoice));
          }
          return new HttpResponse(null, { status: 500 });
        })
      );

      // Act - First successful fetch
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      
      const originalData = result.current.data;

      // Trigger refetch that will fail
      try {
        await act(async () => {
          await result.current.refetch();
        });
      } catch {
        // Expected error
      }

      // Assert - Original data should be preserved
      expect(result.current.data).toEqual(originalData);
    });

    it('should retry failed requests with exponential backoff', async () => {
      // Arrange
      const clientWithRetry = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(100 * 2 ** attemptIndex, 1000),
          },
        },
      });
      const wrapper = createWrapper(clientWithRetry);
      let attemptCount = 0;
      
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          attemptCount++;
          if (attemptCount < 3) {
            return new HttpResponse(null, { status: 500 });
          }
          return HttpResponse.json(createApiResponse(mockChoice));
        })
      );

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      // Assert
      expect(attemptCount).toBe(3);
      expect(result.current.data).toBeDefined();
    });
  });

  // ==========================================================================
  // TypeScript Type Safety Tests
  // ==========================================================================

  describe('TypeScript Type Safety', () => {
    it('should return UseQueryResult<Choice, Error> interface', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - Type checking at compile time, runtime verification of structure
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isError');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
      expect(result.current).toHaveProperty('isFetching');
    });

    it('should have data property typed as Choice | undefined', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });

      // Assert - Before load, data should be undefined
      expect(result.current.data).toBeUndefined();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // After load, data should match Choice interface
      expect(result.current.data).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        options: expect.any(Array),
      });
    });

    it('should have error property typed correctly', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Assert
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBeDefined();
    });

    it('should correctly type Choice option properties', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - Verify option properties are correctly typed
      const firstOption = result.current.data?.options[0];
      expect(firstOption).toMatchObject({
        id: expect.any(Number),
        text: expect.any(String),
        maxanswers: expect.any(Number),
        countanswers: expect.any(Number),
      });
    });
  });

  // ==========================================================================
  // React Query Integration Tests
  // ==========================================================================

  describe('React Query Integration', () => {
    it('should work within QueryClientProvider context', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.data).toBeDefined();
    });

    it('should support enabled/disabled query functionality', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      let fetchCount = 0;
      
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          fetchCount++;
          return HttpResponse.json(createApiResponse(mockChoice));
        })
      );

      // Act - Disabled query
      const { result, rerender } = renderHook(
        ({ enabled }) => useChoice(1, { enabled }),
        { wrapper, initialProps: { enabled: false } }
      );

      // Wait a bit to ensure no fetch occurs
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(fetchCount).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');

      // Enable the query
      rerender({ enabled: true });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(fetchCount).toBe(1);
    });

    it('should not fetch with invalid choiceId (0)', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(0), { wrapper });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - Should not fetch
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should not fetch with negative choiceId', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(-1), { wrapper });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - Should not fetch
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  // ==========================================================================
  // Choice-Specific Tests
  // ==========================================================================

  describe('Choice-Specific Functionality', () => {
    it('should include permission flags in response', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.data?.permissions).toBeDefined();
      expect(result.current.data?.permissions).toMatchObject({
        canChoose: expect.any(Boolean),
        canView: expect.any(Boolean),
        canManage: expect.any(Boolean),
        canUpdate: expect.any(Boolean),
        canViewResults: expect.any(Boolean),
        canDeleteOwn: expect.any(Boolean),
      });
    });

    it('should include availability status in response', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.data?.availability).toBeDefined();
      expect(result.current.data?.availability).toMatchObject({
        available: expect.any(Boolean),
        isOpen: expect.any(Boolean),
        isClosed: expect.any(Boolean),
        isPreview: expect.any(Boolean),
        warnings: expect.any(Array),
        openTime: expect.any(Number),
        closeTime: expect.any(Number),
      });
    });

    it('should include user answer if they have responded', async () => {
      // Arrange
      const choiceWithAnswer = createMockChoice({
        userAnswer: createMockUserAnswer({
          hasAnswered: true,
          selectedOptionIds: [1],
          timemodified: Date.now() / 1000,
          answerIds: [100],
        }),
      });
      
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          return HttpResponse.json(createApiResponse(choiceWithAnswer));
        })
      );
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.data?.userAnswer.hasAnswered).toBe(true);
      expect(result.current.data?.userAnswer.selectedOptionIds).toContain(1);
    });

    it('should correctly reflect option countanswers', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.data?.options[0].countanswers).toBe(5);
      expect(result.current.data?.options[1].countanswers).toBe(3);
      expect(result.current.data?.options[2].countanswers).toBe(2);
    });

    it('should correctly reflect showresults setting', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.data?.showresults).toBe(1); // After answer
    });

    it('should reflect allowmultiple flag', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(2), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.data?.allowmultiple).toBe(true);
    });

    it('should reflect limitanswers and maxanswers correctly', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(3), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.data?.limitanswers).toBe(true);
      expect(result.current.data?.options[0].maxanswers).toBe(10);
      expect(result.current.data?.options[1].maxanswers).toBe(5);
      expect(result.current.data?.options[2].maxanswers).toBe(0); // Unlimited
    });

    it('should include time restrictions for timed choice', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(4), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.data?.timeopen).toBeGreaterThan(0);
      expect(result.current.data?.timeclose).toBeGreaterThan(0);
      expect(result.current.data?.availability.openTime).toBeGreaterThan(0);
      expect(result.current.data?.availability.closeTime).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      let renderCount = 0;

      // Act
      const { result } = renderHook(
        () => {
          renderCount++;
          return useChoice(1);
        },
        { wrapper }
      );
      
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - Initial render + loading state + success state
      expect(renderCount).toBeLessThanOrEqual(3);
    });

    it('should memoize query keys correctly', () => {
      // Arrange & Act
      const key1 = choiceQueryKeys.detail(1);
      const key2 = choiceQueryKeys.detail(1);
      const key3 = choiceQueryKeys.detail(2);

      // Assert - Same ID should produce equivalent keys
      expect(key1).toEqual(key2);
      expect(key1).not.toEqual(key3);
    });

    it('should handle rapid successive calls with different choiceIds', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      
      // Act - Rapidly switch between choice IDs
      const { result, rerender } = renderHook(
        ({ id }) => useChoice(id),
        { wrapper, initialProps: { id: 1 } }
      );

      rerender({ id: 2 });
      rerender({ id: 3 });
      rerender({ id: 4 });
      rerender({ id: 1 });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - Should end up with data for the last ID
      expect(result.current.data?.id).toBe(1);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle choice with empty options array', async () => {
      // Arrange
      const emptyOptionsChoice = createMockChoice({
        options: [],
      });
      
      server.use(
        http.get(`${API_BASE_URL}/choices/100`, () => {
          return HttpResponse.json(createApiResponse(emptyOptionsChoice));
        })
      );
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(100), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.data?.options).toEqual([]);
    });

    it('should handle very large choiceId', async () => {
      // Arrange
      const largeId = 999999999;
      server.use(
        http.get(`${API_BASE_URL}/choices/${largeId}`, () => {
          return HttpResponse.json(createApiResponse({ ...mockChoice, id: largeId }));
        })
      );
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(largeId), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.data?.id).toBe(largeId);
    });

    it('should handle choice with all options at capacity', async () => {
      // Arrange
      const fullChoice = createMockChoice({
        limitanswers: true,
        options: [
          createMockChoiceOption({ id: 1, maxanswers: 5, countanswers: 5 }),
          createMockChoiceOption({ id: 2, maxanswers: 3, countanswers: 3 }),
        ],
      });
      
      server.use(
        http.get(`${API_BASE_URL}/choices/101`, () => {
          return HttpResponse.json(createApiResponse(fullChoice));
        })
      );
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(101), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - All options at capacity
      result.current.data?.options.forEach((option) => {
        expect(option.countanswers).toBe(option.maxanswers);
      });
    });

    it('should handle closed choice activity', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const closedChoice = createMockChoice({
        timeclose: now - 3600, // Closed 1 hour ago
        availability: createMockAvailability({
          available: false,
          isClosed: true,
          isOpen: false,
          closeTime: now - 3600,
        }),
      });
      
      server.use(
        http.get(`${API_BASE_URL}/choices/102`, () => {
          return HttpResponse.json(createApiResponse(closedChoice));
        })
      );
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(102), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.data?.availability.isClosed).toBe(true);
      expect(result.current.data?.availability.available).toBe(false);
    });

    it('should handle preview-only choice activity', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const previewChoice = createMockChoice({
        showpreview: true,
        timeopen: now + 3600, // Opens in 1 hour
        availability: createMockAvailability({
          available: false,
          isOpen: false,
          isPreview: true,
          openTime: now + 3600,
        }),
      });
      
      server.use(
        http.get(`${API_BASE_URL}/choices/103`, () => {
          return HttpResponse.json(createApiResponse(previewChoice));
        })
      );
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoice(103), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(result.current.data?.showpreview).toBe(true);
      expect(result.current.data?.availability.isPreview).toBe(true);
    });
  });

  // ==========================================================================
  // Query Key Factory Tests
  // ==========================================================================

  describe('Query Key Factory', () => {
    it('should generate correct all choices key', () => {
      // Arrange & Act
      const allKey = choiceQueryKeys.all;

      // Assert
      expect(allKey).toEqual(['choices']);
    });

    it('should generate correct detail key for specific choice', () => {
      // Arrange & Act
      const detailKey = choiceQueryKeys.detail(42);

      // Assert
      expect(detailKey).toEqual(['choices', 42]);
    });

    it('should generate correct results key for specific choice', () => {
      // Arrange & Act
      const resultsKey = choiceQueryKeys.results(42);

      // Assert
      expect(resultsKey).toEqual(['choices', 42, 'results']);
    });

    it('should generate correct options key for specific choice', () => {
      // Arrange & Act
      const optionsKey = choiceQueryKeys.options(42);

      // Assert
      expect(optionsKey).toEqual(['choices', 42, 'options']);
    });
  });
});
