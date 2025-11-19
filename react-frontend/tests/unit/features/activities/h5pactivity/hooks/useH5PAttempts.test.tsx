/**
 * Unit Tests for useH5PAttempts Hook
 * 
 * This file contains comprehensive unit tests for the useH5PAttempts React Query hook.
 * The tests verify correct behavior for fetching, filtering, sorting, and paginating
 * H5P activity attempts using Vitest mocking for API client.
 * 
 * Test Categories:
 * - Successful data fetching scenarios
 * - Filtering (userIds, firstInitial, lastInitial)
 * - Sorting (attempt, timecreated, score with asc/desc)
 * - Pagination (page, perPage)
 * - Error handling (network failures, 404, 403)
 * - Cache invalidation and prefetching
 * - Loading and refetching states
 * 
 * @package    react-frontend
 * @subpackage tests/unit/features/activities/h5pactivity/hooks
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { apiClient } from '@/services/api/client';
import useH5PAttempts, {
  useInvalidateH5PAttempts,
  usePrefetchH5PAttempts,
} from '@/features/activities/h5pactivity/hooks/useH5PAttempts';

/* eslint-disable @typescript-eslint/unbound-method */

// Mock the API client module
vi.mock('@/services/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// ============================================================================
// Test Setup and Helpers
// ============================================================================

/**
 * Creates a fresh QueryClient for each test to ensure isolation
 * Disables retries for faster test execution
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0, // Disable cache between tests
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Creates a wrapper component that provides QueryClient context
 * Used by renderHook to wrap the hook under test
 */
function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockUserAttempt = {
  userid: 101,
  firstname: 'John',
  lastname: 'Doe',
  email: 'john.doe@example.com',
  attempts: [
    {
      id: 1,
      h5pactivityid: 1,
      userid: 101,
      timecreated: 1609459200,
      timemodified: 1609462800,
      attempt: 1,
      rawscore: 85,
      maxscore: 100,
      duration: 1800,
      completion: 1,
      success: 1,
      scaled: 0.85,
    },
    {
      id: 2,
      h5pactivityid: 1,
      userid: 101,
      timecreated: 1609545600,
      timemodified: 1609549200,
      attempt: 2,
      rawscore: 92,
      maxscore: 100,
      duration: 1500,
      completion: 1,
      success: 1,
      scaled: 0.92,
    },
  ],
};

const mockUserAttempt2 = {
  userid: 102,
  firstname: 'Jane',
  lastname: 'Johnson',
  email: 'jane.johnson@example.com',
  attempts: [
    {
      id: 3,
      h5pactivityid: 1,
      userid: 102,
      timecreated: 1609632000,
      timemodified: 1609635600,
      attempt: 1,
      rawscore: 78,
      maxscore: 100,
      duration: 2100,
      completion: 1,
      success: 1,
      scaled: 0.78,
    },
  ],
};

const mockApiResponseUserAttempts = {
  success: true,
  data: {
    activityid: 1,
    usersattempts: [mockUserAttempt, mockUserAttempt2],
    totalattempts: 3,
  },
};

const _mockApiResponseAttempts = {
  success: true,
  data: {
    activityid: 1,
    attempts: [
      ...mockUserAttempt.attempts,
      ...mockUserAttempt2.attempts,
    ],
  },
};

// Create convenient aliases for refactored tests
const mockH5PAttemptsResponse = mockApiResponseUserAttempts;
const mockH5PAttemptsData = mockApiResponseUserAttempts.data;

// Create a reference to the mocked API client for easier access in tests
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const mockApiClient = apiClient as any;

// ============================================================================
// Test Suite: Basic Fetching Functionality
// ============================================================================

describe('useH5PAttempts - Basic Fetching', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  it('should fetch attempts successfully with valid activityId', async () => {
    // Mock successful API response
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: mockApiResponseUserAttempts,
    } as any);

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1 }),
      { wrapper: createWrapper(queryClient) }
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.attempts).toEqual([]);

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify API was called correctly
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/h5p/user-attempts',
      expect.objectContaining({
        h5pactivityid: 1,
      })
    );

    // Verify data structure
    expect(result.current.attempts).toBeDefined();
    expect(Array.isArray(result.current.attempts)).toBe(true);
    expect(result.current.attempts.length).toBe(2);
    
    // Verify first user attempt has expected fields
    const firstUserAttempt = result.current.attempts[0];
    expect(firstUserAttempt).toHaveProperty('userid', 101);
    expect(firstUserAttempt).toHaveProperty('firstname', 'John');
    expect(firstUserAttempt).toHaveProperty('lastname', 'Doe');
    expect(firstUserAttempt).toHaveProperty('email', 'john.doe@example.com');
    expect(firstUserAttempt).toHaveProperty('attempts');
    expect(Array.isArray(firstUserAttempt.attempts)).toBe(true);
    expect(firstUserAttempt.attempts.length).toBe(2);
    
    // Verify individual attempt structure
    const firstAttempt = firstUserAttempt.attempts[0];
    expect(firstAttempt).toHaveProperty('id');
    expect(firstAttempt).toHaveProperty('timecreated');
    expect(firstAttempt).toHaveProperty('timemodified');
    expect(firstAttempt).toHaveProperty('attempt');
    expect(firstAttempt).toHaveProperty('rawscore');
    expect(firstAttempt).toHaveProperty('maxscore');
    expect(firstAttempt).toHaveProperty('scaled');
    
    // Verify no errors
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should not fetch when activityId is null', () => {
    const { result } = renderHook(
      () => useH5PAttempts({ activityId: null }),
      { wrapper: createWrapper(queryClient) }
    );

    // Should not be loading since query is disabled
    expect(result.current.isLoading).toBe(false);
    expect(result.current.attempts).toEqual([]);
    expect(result.current.totalAttempts).toBe(0);
  });

  it('should not fetch when activityId is undefined', () => {
    const { result } = renderHook(
      () => useH5PAttempts({ activityId: undefined }),
      { wrapper: createWrapper(queryClient) }
    );

    // Should not be loading since query is disabled
    expect(result.current.isLoading).toBe(false);
    expect(result.current.attempts).toEqual([]);
    expect(result.current.totalAttempts).toBe(0);
  });

  it('should fetch attempts for activity with no attempts', async () => {
    const emptyResponse = {
      success: true,
      data: {
        usersattempts: [],
        warnings: []
      }
    };

    mockApiClient.post.mockResolvedValueOnce({ data: emptyResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 999 }), // Activity with no attempts
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.attempts).toEqual([]);
    expect(result.current.isError).toBe(false);
  });
});

// ============================================================================
// Test Suite: Filtering Functionality
// ============================================================================

describe('useH5PAttempts - Filtering', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('should filter attempts by single userId', async () => {
    const filteredResponse = {
      success: true,
      data: {
        usersattempts: [mockH5PAttemptsData.usersattempts[0]], // Only user 101
        warnings: []
      }
    };

    mockApiClient.post.mockResolvedValueOnce({ data: filteredResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1, userIds: [101] }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // All attempts should be for user ID 101
    expect(result.current.attempts.length).toBe(1);
    expect(result.current.attempts[0].userid).toBe(101);
  });

  it('should filter attempts by multiple userIds', async () => {
    const filteredResponse = {
      success: true,
      data: {
        usersattempts: mockH5PAttemptsData.usersattempts, // Both users 101 and 102
        warnings: []
      }
    };

    mockApiClient.post.mockResolvedValueOnce({ data: filteredResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1, userIds: [101, 102] }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // All attempts should be for user IDs 101 or 102
    expect(result.current.attempts.length).toBe(2);
    result.current.attempts.forEach(attempt => {
      expect([101, 102]).toContain(attempt.userid);
    });
  });

  it('should filter attempts by firstInitial', async () => {
    const filteredResponse = {
      success: true,
      data: {
        usersattempts: [mockH5PAttemptsData.usersattempts[0], mockH5PAttemptsData.usersattempts[1]], // John and Jane
        warnings: []
      }
    };

    mockApiClient.post.mockResolvedValueOnce({ data: filteredResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1, firstInitial: 'J' }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // All attempts should have first names starting with 'J'
    expect(result.current.attempts.length).toBe(2);
    result.current.attempts.forEach(attempt => {
      expect(attempt.firstname.toUpperCase()).toMatch(/^J/);
    });
  });

  it('should filter attempts by lastInitial', async () => {
    const filteredResponse = {
      success: true,
      data: {
        usersattempts: [mockH5PAttemptsData.usersattempts[1]], // Jane Johnson
        warnings: []
      }
    };

    mockApiClient.post.mockResolvedValueOnce({ data: filteredResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1, lastInitial: 'J' }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // All attempts should have last names starting with 'J'
    expect(result.current.attempts.length).toBe(1);
    result.current.attempts.forEach(attempt => {
      expect(attempt.lastname.toUpperCase()).toMatch(/^J/);
    });
  });

  it('should apply multiple filters simultaneously', async () => {
    const filteredResponse = {
      success: true,
      data: {
        usersattempts: [mockH5PAttemptsData.usersattempts[0]], // John Doe, filtered by both userId and firstInitial
        warnings: []
      }
    };

    mockApiClient.post.mockResolvedValueOnce({ data: filteredResponse });

    const { result } = renderHook(
      () =>
        useH5PAttempts({
          activityId: 1,
          userIds: [101],
          firstInitial: 'J',
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have John Doe's attempts (user 101, first name starts with J)
    expect(result.current.attempts.length).toBe(1);
    result.current.attempts.forEach(attempt => {
      expect(attempt.userid).toBe(101);
      expect(attempt.firstname.toUpperCase()).toMatch(/^J/);
    });
  });
});

// ============================================================================
// Test Suite: Sorting Functionality
// ============================================================================

describe('useH5PAttempts - Sorting', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('should sort attempts by timecreated descending (default)', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: mockH5PAttemptsResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1 }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify API was called with correct sort parameters
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/h5p/user-attempts',
      expect.objectContaining({
        h5pactivityid: 1,
        sortorder: 'timecreated DESC'
      })
    );

    expect(result.current.attempts.length).toBeGreaterThan(0);
  });

  it('should sort attempts by timecreated ascending', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: mockH5PAttemptsResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1, sortBy: 'timecreated', sortOrder: 'asc' }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify API was called with correct sort parameters
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/h5p/user-attempts',
      expect.objectContaining({
        h5pactivityid: 1,
        sortorder: 'timecreated ASC'
      })
    );

    expect(result.current.attempts.length).toBeGreaterThan(0);
  });

  it('should sort attempts by score descending (client-side)', async () => {
    // Create mock data with unsorted scores to verify client-side sorting
    const unsortedResponse = {
      success: true,
      data: {
        activityid: 1,
        usersattempts: [
          {
            userid: 101,
            attempts: [
              { id: 1, h5pactivityid: 1, userid: 101, timecreated: 1609459200, timemodified: 1609459500, attempt: 1, rawscore: 5, maxscore: 10, duration: 300, scaled: 0.5 },
              { id: 2, h5pactivityid: 1, userid: 101, timecreated: 1609545600, timemodified: 1609545900, attempt: 2, rawscore: 9, maxscore: 10, duration: 250, scaled: 0.9 },
              { id: 3, h5pactivityid: 1, userid: 101, timecreated: 1609632000, timemodified: 1609632300, attempt: 3, rawscore: 3, maxscore: 10, duration: 200, scaled: 0.3 }
            ]
          }
        ],
        totalattempts: 3,
        warnings: []
      }
    };

    mockApiClient.post.mockResolvedValueOnce({ data: unsortedResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1, sortBy: 'score', sortOrder: 'desc' }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify attempts are sorted by scaled score in descending order
    const userAttempt = result.current.attempts[0];
    expect(userAttempt.attempts.length).toBe(3);
    expect(userAttempt.attempts[0].scaled).toBe(0.9); // Highest
    expect(userAttempt.attempts[1].scaled).toBe(0.5); // Middle
    expect(userAttempt.attempts[2].scaled).toBe(0.3); // Lowest
  });

  it('should sort attempts by attempt number ascending', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: mockH5PAttemptsResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1, sortBy: 'attempt', sortOrder: 'asc' }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify API was called with correct sort parameters
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/h5p/user-attempts',
      expect.objectContaining({
        h5pactivityid: 1,
        sortorder: 'attempt ASC'
      })
    );

    expect(result.current.attempts.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Test Suite: Pagination Functionality
// ============================================================================

describe('useH5PAttempts - Pagination', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('should paginate with default page size (20)', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: mockH5PAttemptsResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1 }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify API was called with default pagination parameters
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/h5p/user-attempts',
      expect.objectContaining({
        h5pactivityid: 1,
        page: 0, // API uses 0-based page numbering
        perpage: 20
      })
    );

    expect(result.current.attempts.length).toBeGreaterThan(0);
  });

  it('should paginate with custom page size', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: mockH5PAttemptsResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1, perPage: 5 }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify API was called with custom perPage parameter
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/h5p/user-attempts',
      expect.objectContaining({
        h5pactivityid: 1,
        perpage: 5
      })
    );

    expect(result.current.attempts.length).toBeGreaterThan(0);
  });

  it('should fetch second page correctly', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: mockH5PAttemptsResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1, page: 2, perPage: 5 }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify API was called with correct page parameter (0-based)
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/h5p/user-attempts',
      expect.objectContaining({
        h5pactivityid: 1,
        page: 1, // API uses 0-based, so page 2 becomes 1
        perpage: 5
      })
    );

    expect(result.current.attempts.length).toBeGreaterThan(0);
  });

  it('should return totalAttempts from API response', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: mockH5PAttemptsResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1 }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify totalAttempts matches mock data
    expect(result.current.totalAttempts).toBe(mockH5PAttemptsResponse.data.totalattempts);
  });
});

// ============================================================================
// Test Suite: Error Handling
// ============================================================================

describe('useH5PAttempts - Error Handling', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  it('should handle 404 error for non-existent activity', async () => {
    const notFoundError = {
      response: {
        status: 404,
        data: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'H5P activity not found'
          }
        }
      }
    };

    // Use mockRejectedValue (not Once) to handle retries
    mockApiClient.post.mockRejectedValue(notFoundError);

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 99999 }), // Non-existent activity
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 5000 } // Increased timeout to account for retry delays
    );

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeDefined();
    expect(result.current.attempts).toEqual([]);
  });

  it('should handle invalid activityId gracefully', async () => {
    const badRequestError = {
      response: {
        status: 400,
        data: {
          success: false,
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Invalid activity ID'
          }
        }
      }
    };

    // Use mockRejectedValue (not Once) to handle retries
    mockApiClient.post.mockRejectedValue(badRequestError);

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: -1 }), // Invalid ID
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 5000 } // Increased timeout to account for retry delays
    );

    expect(result.current.isError).toBe(true);
    expect(result.current.attempts).toEqual([]);
  });
});

// ============================================================================
// Test Suite: React Query Features
// ============================================================================

describe('useH5PAttempts - React Query Features', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('should provide refetch function', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: mockH5PAttemptsResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1 }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.refetch).toBeDefined();
    expect(typeof result.current.refetch).toBe('function');
  });

  it('should track isFetching state separately from isLoading', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: mockH5PAttemptsResponse });

    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1 }),
      { wrapper: createWrapper(queryClient) }
    );

    // Initially both should be true
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFetching).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // After first load, isLoading is false but isFetching may vary
    expect(result.current.isFetching).toBe(false);
  });

  it('should cache results based on query key', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: mockH5PAttemptsResponse });

    // First render
    const { result: result1 } = renderHook(
      () => useH5PAttempts({ activityId: 1, page: 1 }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
    });

    // API should have been called once
    expect(apiClient.post).toHaveBeenCalledTimes(1);

    // Second render with same params should use cache
    const { result: result2 } = renderHook(
      () => useH5PAttempts({ activityId: 1, page: 1 }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });

    // API should still have been called only once (cached)
    expect(apiClient.post).toHaveBeenCalledTimes(1);

    // Data should match
    expect(result2.current.attempts).toEqual(result1.current.attempts);
  });
});

// ============================================================================
// Test Suite: Cache Invalidation
// ============================================================================

describe('useInvalidateH5PAttempts', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('should invalidate cache for specific activity', async () => {
    mockApiClient.post.mockResolvedValue({ data: mockH5PAttemptsResponse });

    // First, populate cache
    const { result } = renderHook(
      () => useH5PAttempts({ activityId: 1 }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify API was called once
    expect(apiClient.post).toHaveBeenCalledTimes(1);

    // Get invalidate function
    const { result: invalidateResult } = renderHook(
      () => useInvalidateH5PAttempts(),
      { wrapper: createWrapper(queryClient) }
    );

    // Invalidate should be a function
    expect(typeof invalidateResult.current).toBe('function');

    // Call invalidate
    invalidateResult.current(1);

    // After invalidation, next query should trigger a refetch
    const { result: refetchResult } = renderHook(
      () => useH5PAttempts({ activityId: 1 }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(refetchResult.current.isLoading).toBe(false);
    });

    // API should have been called again (cache was invalidated)
    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// Test Suite: Prefetching
// ============================================================================

describe('usePrefetchH5PAttempts', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('should prefetch attempts data', async () => {
    mockApiClient.post.mockResolvedValue({ data: mockH5PAttemptsResponse });

    const { result } = renderHook(
      () => usePrefetchH5PAttempts(),
      { wrapper: createWrapper(queryClient) }
    );

    // Prefetch should be a function
    expect(typeof result.current).toBe('function');

    // Call prefetch
    await result.current({ activityId: 1 });

    // Verify API was called for prefetch
    expect(apiClient.post).toHaveBeenCalledTimes(1);

    // After prefetch, data should be in cache
    // Verify by checking if subsequent hook render doesn't trigger another API call
    const { result: attemptsResult } = renderHook(
      () => useH5PAttempts({ activityId: 1 }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(attemptsResult.current.isLoading).toBe(false);
    });

    // Should still be called only once (used cached data)
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(attemptsResult.current.attempts.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Test Suite: Combined Scenarios
// ============================================================================

describe('useH5PAttempts - Combined Scenarios', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('should handle complex query with multiple filters, sorting, and pagination', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: mockH5PAttemptsResponse });

    const { result } = renderHook(
      () =>
        useH5PAttempts({
          activityId: 1,
          userIds: [1, 2, 3],
          sortBy: 'score',
          sortOrder: 'desc',
          page: 1,
          perPage: 3,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify API was called with correct endpoint and parameters
    // When userIds are specified and page=1, uses /api/v1/h5p/attempts endpoint
    // without pagination or sort parameters (sorting handled client-side)
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/h5p/attempts',
      expect.objectContaining({
        h5pactivityid: 1,
        userids: [1, 2, 3],
      })
    );

    // Verify client-side score sorting (sorts attempts within each user)
    result.current.attempts.forEach((userAttempt) => {
      if (userAttempt.attempts.length > 1) {
        for (let i = 0; i < userAttempt.attempts.length - 1; i++) {
          const score1 = userAttempt.attempts[i].scaled;
          const score2 = userAttempt.attempts[i + 1].scaled;
          expect(score1).toBeGreaterThanOrEqual(score2);
        }
      }
    });

    expect(result.current.attempts).toBeDefined();
  });

  it('should update when parameters change', async () => {
    const activity1Response = { ...mockH5PAttemptsResponse };
    
    // Create a different user attempt for activity 2
    const mockUserAttemptActivity2: UserAttempts = {
      userid: 201,
      attempts: [
        {
          id: 5,
          h5pactivityid: 2,
          userid: 201,
          attempt: 1,
          timecreated: 1609459200,
          timemodified: 1609462800,
          rawscore: 85,
          maxscore: 100,
          duration: 450,
          scaled: 0.85
        }
      ]
    };
    
    const activity2Response = {
      success: true,
      data: {
        activityid: 2,
        usersattempts: [mockUserAttemptActivity2],
        totalattempts: 1
      }
    };

    mockApiClient.post.mockResolvedValueOnce({ data: activity1Response });

    const { result, rerender } = renderHook(
      ({ activityId }) => useH5PAttempts({ activityId }),
      {
        wrapper: createWrapper(queryClient),
        initialProps: { activityId: 1 },
      }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const firstAttempts = result.current.attempts;
    expect(firstAttempts.length).toBeGreaterThan(0);

    // Verify first API call
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/h5p/user-attempts',
      expect.objectContaining({
        h5pactivityid: 1
      })
    );

    // Mock response for activity 2
    mockApiClient.post.mockResolvedValueOnce({ data: activity2Response });

    // Change activity ID
    rerender({ activityId: 2 });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify second API call with new activity ID
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/h5p/user-attempts',
      expect.objectContaining({
        h5pactivityid: 2
      })
    );

    // Should have different attempts for activity 2
    const secondAttempts = result.current.attempts;
    
    // Debug output
    console.log('First attempts:', JSON.stringify(firstAttempts, null, 2));
    console.log('Second attempts:', JSON.stringify(secondAttempts, null, 2));
    console.log('First attempts length:', firstAttempts.length);
    console.log('Second attempts length:', secondAttempts.length);
    console.log('Are they the same reference?', firstAttempts === secondAttempts);
    
    expect(secondAttempts).not.toEqual(firstAttempts);
  });
});
