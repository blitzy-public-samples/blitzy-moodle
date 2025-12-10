/**
 * Unit tests for useFeedback custom React Query hook
 *
 * Tests the feedback activity data fetching, caching, and computed properties functionality.
 * Validates React Query integration including cache key management, stale time configuration,
 * automatic background revalidation, conditional query enabling, loading states, error handling,
 * and refetch functionality.
 *
 * Test Coverage:
 * - Basic functionality (initial loading state, data fetching, error states)
 * - Computed properties (isOpen, canComplete, canSubmit, isAnonymous, hasResponded)
 * - React Query configuration (query keys, stale time, cache time, refetch settings)
 * - Options parameter handling (feedbackId, courseId, enabled)
 * - Refetch functionality (manual refetch, error recovery)
 * - Loading states (isLoading, isFetching, background refetch)
 * - Error handling (API errors, permission errors, network errors)
 * - Cache management (persistence, invalidation, stale data)
 * - Edge cases (invalid feedbackId, undefined values, rapid changes)
 * - TypeScript type verification
 *
 * @packageDocumentation
 * @module tests/unit/features/activities/feedback/useFeedback
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { useFeedback } from '@/features/activities/feedback/hooks/useFeedback';
import * as feedbackApiModule from '@/features/activities/feedback/api/feedbackApi';
import { FeedbackQuestionType } from '@/features/activities/feedback/types/feedback.types';

// Mock the feedbackApi module - functions are exported directly, not as object properties
vi.mock('@/features/activities/feedback/api/feedbackApi', () => ({
  getFeedback: vi.fn(),
  getFeedbackStatus: vi.fn(),
  getFeedbackQuestions: vi.fn(),
}));

/**
 * Mock feedback data for testing
 * Represents a typical Moodle feedback activity with all required fields
 */
const mockFeedback = {
  id: 123,
  course: 5,
  name: 'Test Feedback Activity',
  intro: 'This is a test feedback description',
  introformat: 1,
  anonymous: 1 as const,
  email_notification: 0,
  multiple_submit: 0,
  autonumbering: 1,
  site_after_submit: '',
  page_after_submit: 'Thank you for your feedback',
  page_after_submitformat: 1,
  publish_stats: 0,
  timeopen: 0,
  timeclose: 0,
  timemodified: 1700000000,
  completionsubmit: 1,
  coursemodule: 456,
  visible: 1,
  groupmode: 0,
  groupingid: 0,
};

/**
 * Mock feedback status data for testing
 * Contains permissions and completion information
 * Matches FeedbackStatus interface from feedbackApi.ts
 */
const mockFeedbackStatus = {
  isOpen: true,
  canComplete: true,
  canSubmit: true,
  isSubmitted: false,
  isAnonymous: true,
  multipleSubmit: false,
  resumePage: undefined,
  completedId: undefined,
};

/**
 * Mock feedback questions/items for testing
 */
const mockFeedbackQuestions = [
  {
    id: 1,
    feedback: 123,
    template: 0,
    name: 'Question 1',
    label: 'q1',
    presentation: '5',
    typ: FeedbackQuestionType.MULTICHOICE,
    hasvalue: 1,
    position: 1,
    required: 1,
    dependitem: 0,
    dependvalue: '',
    options: '',
  },
  {
    id: 2,
    feedback: 123,
    template: 0,
    name: 'Question 2',
    label: 'q2',
    presentation: 'r>>>>>Enter your comments',
    typ: FeedbackQuestionType.TEXTAREA,
    hasvalue: 1,
    position: 2,
    required: 0,
    dependitem: 0,
    dependvalue: '',
    options: '',
  },
];

// Note: FeedbackCompleted type is available for use if individual completion tests are needed
// Example structure: { id, feedback, userid, timemodified, random_response, anonymous_response, courseid }

/**
 * Helper function to wrap mock data in ApiResponse format
 * The actual API returns { success: true, data: T } structure
 */
function wrapApiResponse<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

/**
 * Creates a fresh QueryClient for each test
 * Configured to disable retries and caching to ensure test isolation
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}

/**
 * Creates a wrapper component with QueryClientProvider for hook rendering
 * @param queryClient - The QueryClient instance to use
 * @returns A wrapper component for renderHook
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

describe('useFeedback', () => {
  let queryClient: QueryClient;
  let originalDateNow: () => number;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
    
    // Create fresh QueryClient for test isolation
    queryClient = createTestQueryClient();
    
    // Store original Date.now for time-based tests
    originalDateNow = Date.now;
    
    // Default mock implementations - successful responses wrapped in ApiResponse format
    vi.mocked(feedbackApiModule.getFeedback).mockResolvedValue(wrapApiResponse(mockFeedback));
    vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse(mockFeedbackStatus));
    vi.mocked(feedbackApiModule.getFeedbackQuestions).mockResolvedValue(wrapApiResponse(mockFeedbackQuestions));
  });

  afterEach(() => {
    // Restore Date.now
    Date.now = originalDateNow;
    
    // Clear all queries from cache
    queryClient.clear();
  });

  // ============================================================================
  // SECTION: Basic Functionality Tests
  // ============================================================================
  describe('Basic Functionality', () => {
    /**
     * Test: Hook returns initial loading state
     *
     * Purpose: Verify that the hook returns proper loading state during initial fetch
     * Expected: {feedback: undefined, isLoading: true, error: null}
     */
    it('should return initial loading state', () => {
      // Delay API response to observe loading state
      vi.mocked(feedbackApiModule.getFeedback).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.feedback).toBeUndefined();
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    /**
     * Test: Successful data fetch returns feedback object
     *
     * Purpose: Verify that the hook successfully fetches and returns feedback data
     */
    it('should fetch feedback data successfully', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.feedback).toBeDefined();
      expect(result.current.feedback?.id).toBe(123);
      expect(result.current.feedback?.name).toBe('Test Feedback Activity');
      expect(result.current.feedback?.intro).toBe('This is a test feedback description');
      expect(result.current.feedback?.anonymous).toBe(1);
      expect(result.current.error).toBeNull();
    });

    /**
     * Test: Questions array extraction from feedback data
     *
     * Purpose: Verify that questions are correctly fetched and returned
     */
    it('should extract questions array from feedback data', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.questions).toBeDefined();
      expect(result.current.questions).toHaveLength(2);
      expect(result.current.questions?.[0]?.name).toBe('Question 1');
      expect(result.current.questions?.[1]?.typ).toBe(FeedbackQuestionType.TEXTAREA);
    });

    /**
     * Test: Error state when API call fails
     *
     * Purpose: Verify that the hook correctly handles API errors
     */
    it('should handle error state when API call fails', async () => {
      const testError = new Error('Failed to fetch feedback');
      vi.mocked(feedbackApiModule.getFeedback).mockRejectedValue(testError);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Hook has retry: 2, so we need to wait for retries to complete
      // Use longer timeout to account for retry delays
      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      expect(result.current.error).toBeTruthy();
      expect(result.current.feedback).toBeUndefined();
    });

    /**
     * Test: Invalid feedbackId (0) disables query
     *
     * Purpose: Verify that the hook doesn't fetch when feedbackId is invalid
     */
    it('should disable query when feedbackId is 0', () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 0 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Query should not be loading because it's disabled
      expect(result.current.isLoading).toBe(false);
      expect(feedbackApiModule.getFeedback).not.toHaveBeenCalled();
    });

    /**
     * Test: Invalid feedbackId (negative) disables query
     *
     * Purpose: Verify that negative feedbackId is handled correctly
     */
    it('should disable query when feedbackId is negative', () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: -1 }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(false);
      expect(feedbackApiModule.getFeedback).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SECTION: Computed Properties Tests - isOpen
  // ============================================================================
  describe('Computed Properties - isOpen', () => {
    /**
     * Test: isOpen = true when current time is between timeopen and timeclose
     */
    it('should return isOpen = true when current time is between timeopen and timeclose', async () => {
      const now = 1700000000;
      Date.now = vi.fn(() => now * 1000); // Convert to milliseconds

      vi.mocked(feedbackApiModule.getFeedback).mockResolvedValue(wrapApiResponse({
        ...mockFeedback,
        timeopen: now - 3600, // 1 hour ago
        timeclose: now + 3600, // 1 hour from now
      }));
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        isOpen: true,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOpen).toBe(true);
    });

    /**
     * Test: isOpen = false when current time is before timeopen
     */
    it('should return isOpen = false when current time is before timeopen', async () => {
      const now = 1700000000;
      Date.now = vi.fn(() => now * 1000);

      vi.mocked(feedbackApiModule.getFeedback).mockResolvedValue(wrapApiResponse({
        ...mockFeedback,
        timeopen: now + 3600, // 1 hour from now
        timeclose: now + 7200, // 2 hours from now
      }));
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        isOpen: false,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOpen).toBe(false);
    });

    /**
     * Test: isOpen = false when current time is after timeclose
     */
    it('should return isOpen = false when current time is after timeclose', async () => {
      const now = 1700000000;
      Date.now = vi.fn(() => now * 1000);

      vi.mocked(feedbackApiModule.getFeedback).mockResolvedValue(wrapApiResponse({
        ...mockFeedback,
        timeopen: now - 7200, // 2 hours ago
        timeclose: now - 3600, // 1 hour ago
      }));
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        isOpen: false,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOpen).toBe(false);
    });

    /**
     * Test: isOpen = true when timeopen = 0 (no start restriction)
     */
    it('should return isOpen = true when timeopen = 0 (no start restriction)', async () => {
      vi.mocked(feedbackApiModule.getFeedback).mockResolvedValue(wrapApiResponse({
        ...mockFeedback,
        timeopen: 0,
        timeclose: Date.now() / 1000 + 3600, // 1 hour from now
      }));
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        isOpen: true,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOpen).toBe(true);
    });

    /**
     * Test: isOpen = true when timeclose = 0 (no end restriction)
     */
    it('should return isOpen = true when timeclose = 0 (no end restriction)', async () => {
      vi.mocked(feedbackApiModule.getFeedback).mockResolvedValue(wrapApiResponse({
        ...mockFeedback,
        timeopen: Date.now() / 1000 - 3600, // 1 hour ago
        timeclose: 0,
      }));
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        isOpen: true,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  // ============================================================================
  // SECTION: Computed Properties Tests - canComplete
  // ============================================================================
  describe('Computed Properties - canComplete', () => {
    /**
     * Test: canComplete = true when feedback is open and user has permission
     */
    it('should return canComplete = true when feedback is open and user has permission', async () => {
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        canComplete: true,
        isOpen: true,
        isAlreadySubmitted: false,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canComplete).toBe(true);
    });

    /**
     * Test: canComplete = false when feedback is closed
     */
    it('should return canComplete = false when feedback is closed', async () => {
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        canComplete: false,
        isOpen: false,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canComplete).toBe(false);
    });

    /**
     * Test: canComplete = false when user already completed (no multiple_submit)
     */
    it('should return canComplete = false when user already completed without multiple_submit', async () => {
      vi.mocked(feedbackApiModule.getFeedback).mockResolvedValue(wrapApiResponse({
        ...mockFeedback,
        multiple_submit: 0,
      }));
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        canComplete: false,
        isAlreadySubmitted: true,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canComplete).toBe(false);
    });

    /**
     * Test: canComplete = true when user completed but multiple_submit is enabled
     */
    it('should return canComplete = true when user completed but multiple_submit is enabled', async () => {
      vi.mocked(feedbackApiModule.getFeedback).mockResolvedValue(wrapApiResponse({
        ...mockFeedback,
        multiple_submit: 1,
      }));
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        canComplete: true,
        isAlreadySubmitted: true,
        isOpen: true,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canComplete).toBe(true);
    });
  });

  // ============================================================================
  // SECTION: Computed Properties Tests - canSubmit
  // ============================================================================
  describe('Computed Properties - canSubmit', () => {
    /**
     * Test: canSubmit = true when feedback is open and not yet submitted
     */
    it('should return canSubmit = true when feedback is open and not yet submitted', async () => {
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        canComplete: true,
        isOpen: true,
        isAlreadySubmitted: false,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSubmit).toBe(true);
    });

    /**
     * Test: canSubmit = false when already submitted (multiple_submit = 0)
     */
    it('should return canSubmit = false when already submitted without multiple_submit', async () => {
      // canSubmit is computed on server-side and returned directly from status
      // When user has already submitted and multiple_submit is disabled, server returns canSubmit = false
      vi.mocked(feedbackApiModule.getFeedback).mockResolvedValue(wrapApiResponse({
        ...mockFeedback,
        multiple_submit: 0,
      }));
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        canSubmit: false,  // Server-computed value
        isSubmitted: true,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSubmit).toBe(false);
    });

    /**
     * Test: canSubmit = true when already submitted but multiple_submit = 1
     */
    it('should return canSubmit = true when already submitted with multiple_submit enabled', async () => {
      // When multiple_submit is enabled, server allows re-submission
      vi.mocked(feedbackApiModule.getFeedback).mockResolvedValue(wrapApiResponse({
        ...mockFeedback,
        multiple_submit: 1,
      }));
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        canSubmit: true,  // Server allows re-submission with multiple_submit
        canComplete: true,
        isSubmitted: true,  // User has already submitted
        isOpen: true,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSubmit).toBe(true);
    });

    /**
     * Test: canSubmit = false when feedback is closed
     */
    it('should return canSubmit = false when feedback is closed', async () => {
      // When feedback is closed, server does not allow submission
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        canSubmit: false,  // Server does not allow submission when closed
        canComplete: false,
        isOpen: false,
        isSubmitted: false,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSubmit).toBe(false);
    });
  });

  // ============================================================================
  // SECTION: Computed Properties Tests - isAnonymous
  // ============================================================================
  describe('Computed Properties - isAnonymous', () => {
    /**
     * Test: isAnonymous = true when feedback.anonymous = 1
     */
    it('should return isAnonymous = true when feedback.anonymous = 1', async () => {
      vi.mocked(feedbackApiModule.getFeedback).mockResolvedValue(wrapApiResponse({
        ...mockFeedback,
        anonymous: 1,
      }));
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        isAnonymous: true,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAnonymous).toBe(true);
    });

    /**
     * Test: isAnonymous = false when feedback.anonymous = 0
     */
    it('should return isAnonymous = false when feedback.anonymous = 0', async () => {
      vi.mocked(feedbackApiModule.getFeedback).mockResolvedValue(wrapApiResponse({
        ...mockFeedback,
        anonymous: 0 as 0 | 1 | 2,
      }));
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        isAnonymous: false,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAnonymous).toBe(false);
    });

    /**
     * Test: isAnonymous = true when feedback.anonymous = 2 (anonymous_response)
     */
    it('should return isAnonymous = false when feedback.anonymous = 2 (guest only)', async () => {
      // anonymous = 2 means guest anonymous (not fully anonymous in Moodle)
      // The hook only considers anonymous = 1 (FEEDBACK_ANONYMOUS_YES) as truly anonymous
      vi.mocked(feedbackApiModule.getFeedback).mockResolvedValue(wrapApiResponse({
        ...mockFeedback,
        anonymous: 2 as 0 | 1 | 2,
      }));
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        isAnonymous: false,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Hook checks feedback.anonymous === 1 (FEEDBACK_ANONYMOUS_YES)
      // anonymous = 2 is guest anonymous, not considered anonymous by hook
      expect(result.current.isAnonymous).toBe(false);
    });
  });

  // ============================================================================
  // SECTION: Computed Properties Tests - hasResponded
  // ============================================================================
  describe('Computed Properties - hasResponded', () => {
    /**
     * Test: hasResponded = true when completion object exists
     */
    it('should return hasResponded = true when isSubmitted is true', async () => {
      // hasResponded is derived from status.isSubmitted
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        isSubmitted: true,  // This is the correct field name
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasResponded).toBe(true);
    });

    /**
     * Test: hasResponded = false when completion is null
     */
    it('should return hasResponded = false when isAlreadySubmitted is false', async () => {
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse({
        ...mockFeedbackStatus,
        isAlreadySubmitted: false,
        responses: null,
      }));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasResponded).toBe(false);
    });
  });

  // ============================================================================
  // SECTION: React Query Configuration Tests
  // ============================================================================
  describe('React Query Configuration', () => {
    /**
     * Test: Query key structure contains feedbackId
     */
    it('should use correct query key with feedbackId', async () => {
      const testFeedbackId = 456;

      const { result } = renderHook(
        () => useFeedback({ feedbackId: testFeedbackId }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify the API was called with the correct feedbackId
      // Note: API only takes feedbackId, not courseId
      expect(feedbackApiModule.getFeedback).toHaveBeenCalledWith(testFeedbackId);
    });

    /**
     * Test: Query key includes courseId when provided
     */
    it('should work with courseId provided (for query key isolation)', async () => {
      // Note: courseId is used for query key isolation but NOT passed to API
      const testFeedbackId = 123;
      const testCourseId = 5;

      const { result } = renderHook(
        () => useFeedback({ feedbackId: testFeedbackId, courseId: testCourseId }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // API functions only take feedbackId - courseId is for query key only
      expect(feedbackApiModule.getFeedback).toHaveBeenCalledWith(testFeedbackId);
      expect(feedbackApiModule.getFeedbackStatus).toHaveBeenCalledWith(testFeedbackId);
    });

    /**
     * Test: Query is enabled when feedbackId > 0
     */
    it('should enable query when feedbackId is positive', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123, enabled: true }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(feedbackApiModule.getFeedback).toHaveBeenCalled();
    });

    /**
     * Test: Query is disabled when enabled = false
     */
    it('should disable query when enabled option is false', () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123, enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(false);
      expect(feedbackApiModule.getFeedback).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SECTION: Options Parameter Tests
  // ============================================================================
  describe('Options Parameter', () => {
    /**
     * Test: Hook works with feedbackId only
     * Note: getFeedback API only takes feedbackId parameter
     * courseId is only used in the query key for cache isolation
     */
    it('should work with feedbackId only', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.feedback).toBeDefined();
      // API function only takes feedbackId, courseId is for query key only
      expect(feedbackApiModule.getFeedback).toHaveBeenCalledWith(123);
    });

    /**
     * Test: Hook works with feedbackId and courseId
     * Note: courseId is used for query key isolation, not passed to API
     */
    it('should work with feedbackId and courseId', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123, courseId: 5 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.feedback).toBeDefined();
      // courseId is NOT passed to API - only feedbackId is passed
      // courseId is used for query key isolation for site-wide feedbacks
      expect(feedbackApiModule.getFeedback).toHaveBeenCalledWith(123);
    });

    /**
     * Test: enabled = false prevents query execution
     */
    it('should not execute query when enabled is false', () => {
      renderHook(
        () => useFeedback({ feedbackId: 123, enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(feedbackApiModule.getFeedback).not.toHaveBeenCalled();
      expect(feedbackApiModule.getFeedbackStatus).not.toHaveBeenCalled();
      expect(feedbackApiModule.getFeedbackQuestions).not.toHaveBeenCalled();
    });

    /**
     * Test: enabled toggle affects query execution
     */
    it('should toggle query execution when enabled changes', async () => {
      const { rerender, result } = renderHook(
        ({ enabled }: { enabled: boolean }) => 
          useFeedback({ feedbackId: 123, enabled }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { enabled: false },
        }
      );

      // Initially disabled
      expect(feedbackApiModule.getFeedback).not.toHaveBeenCalled();

      // Enable the query
      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(feedbackApiModule.getFeedback).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SECTION: Refetch Functionality Tests
  // ============================================================================
  describe('Refetch Functionality', () => {
    /**
     * Test: Manual refetch() triggers new API request
     */
    it('should trigger new API request on manual refetch', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Get current call count before refetch
      const callCountBefore = vi.mocked(feedbackApiModule.getFeedback).mock.calls.length;

      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Verify API was called at least once more after refetch
      const callCountAfter = vi.mocked(feedbackApiModule.getFeedback).mock.calls.length;
      expect(callCountAfter).toBeGreaterThan(callCountBefore);
    });

    /**
     * Test: Refetch error handling
     * Note: Hook has retry: 2, so we need to fail all retries
     */
    it('should handle refetch errors', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Make ALL subsequent API calls fail (including retries)
      vi.mocked(feedbackApiModule.getFeedback).mockRejectedValue(
        new Error('Refetch failed')
      );

      // Trigger refetch
      await act(async () => {
        try {
          await result.current.refetch();
        } catch {
          // Expected to throw after retries exhausted
        }
      });

      // Wait for retries to complete and error to be set
      await waitFor(
        () => {
          expect(result.current.error).toBeTruthy();
        },
        { timeout: 10000 }
      );
    }, 15000);  // Extend test timeout to accommodate hook retries

    /**
     * Test: Refetch preserves existing data during loading
     */
    it('should preserve existing data during refetch', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const originalFeedback = result.current.feedback;
      expect(originalFeedback).toBeDefined();

      // Make refetch take time - must return wrapped API response
      vi.mocked(feedbackApiModule.getFeedback).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(wrapApiResponse(mockFeedback)), 500))
      );

      // Trigger refetch but don't await
      act(() => {
        result.current.refetch();
      });

      // Use waitFor to check that isFetching becomes true during refetch
      // Note: This may happen very quickly, so we check data is preserved
      await waitFor(() => {
        // Data should still be available during refetch
        expect(result.current.feedback).toEqual(originalFeedback);
      });
    });

    /**
     * Test: Refetch returns Promise that resolves when complete
     */
    it('should return Promise from refetch that resolves when complete', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify refetch returns a Promise
      const refetchPromise = result.current.refetch();
      expect(refetchPromise).toBeInstanceOf(Promise);

      // Wait for it to resolve
      await act(async () => {
        await refetchPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  // ============================================================================
  // SECTION: Loading States Tests
  // ============================================================================
  describe('Loading States', () => {
    /**
     * Test: isLoading = true during initial fetch
     */
    it('should set isLoading = true during initial fetch', () => {
      // Keep API pending
      vi.mocked(feedbackApiModule.getFeedback).mockImplementation(
        () => new Promise(() => {})
      );

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(true);
    });

    /**
     * Test: isLoading = false after data loads
     */
    it('should set isLoading = false after data loads', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.feedback).toBeDefined();
    });

    /**
     * Test: isFetching = true during background refetch
     */
    it('should set isFetching = true during background refetch', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Make next call slow - must return wrapped API response
      vi.mocked(feedbackApiModule.getFeedback).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(wrapApiResponse(mockFeedback)), 1000))
      );

      // Trigger background refetch
      act(() => {
        result.current.refetch();
      });

      // Wait a moment for isFetching to be true
      await waitFor(() => {
        // isFetching should be true during refetch
        expect(result.current.isFetching).toBe(true);
      });
      
      // isLoading should be false (we have stale data)
      expect(result.current.isLoading).toBe(false);
    });

    /**
     * Test: isFetching = false when refetch completes
     */
    it('should set isFetching = false when refetch completes', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.isFetching).toBe(false);
    });
  });

  // ============================================================================
  // SECTION: Error Handling Tests
  // ============================================================================
  describe('Error Handling', () => {
    /**
     * Test: Error state when API throws exception
     * Note: Hook has retry: 2, so we need longer timeout for retries
     */
    it('should capture error when API throws exception', async () => {
      const testError = new Error('API Error');
      vi.mocked(feedbackApiModule.getFeedback).mockRejectedValue(testError);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait for retries to complete (hook has retry: 2)
      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      expect(result.current.error).toBeTruthy();
      expect(result.current.feedback).toBeUndefined();
    });

    /**
     * Test: Error message extraction from Error object
     */
    it('should extract error message from Error object', async () => {
      const errorMessage = 'Failed to load feedback data';
      vi.mocked(feedbackApiModule.getFeedback).mockRejectedValue(
        new Error(errorMessage)
      );

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait for retries to complete
      await waitFor(
        () => {
          expect(result.current.error).toBeTruthy();
        },
        { timeout: 10000 }
      );

      expect(result.current.error?.message).toBe(errorMessage);
    });

    /**
     * Test: Error recovery with refetch
     */
    it('should recover from error on successful refetch', async () => {
      // Make all calls fail initially (including retries)
      vi.mocked(feedbackApiModule.getFeedback).mockRejectedValue(
        new Error('Temporary error')
      );

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait for error state (after retries complete)
      await waitFor(
        () => {
          expect(result.current.error).toBeTruthy();
        },
        { timeout: 10000 }
      );

      // Setup successful response for refetch - must wrap in ApiResponse
      vi.mocked(feedbackApiModule.getFeedback).mockResolvedValue(wrapApiResponse(mockFeedback));
      vi.mocked(feedbackApiModule.getFeedbackStatus).mockResolvedValue(wrapApiResponse(mockFeedbackStatus));
      vi.mocked(feedbackApiModule.getFeedbackQuestions).mockResolvedValue(wrapApiResponse(mockFeedbackQuestions));

      // Refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Wait for successful data
      await waitFor(() => {
        expect(result.current.feedback).toBeDefined();
      });

      // Error should be cleared, data should be available
      expect(result.current.error).toBeNull();
      expect(result.current.feedback).toBeDefined();
    });

    /**
     * Test: Permission denied error (403)
     */
    it('should handle permission denied error', async () => {
      const permissionError = Object.assign(new Error('Permission denied'), {
        response: { status: 403 },
      });
      vi.mocked(feedbackApiModule.getFeedback).mockRejectedValue(permissionError);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait for retries to complete
      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe('Permission denied');
    });

    /**
     * Test: Not found error (404)
     */
    it('should handle not found error', async () => {
      const notFoundError = Object.assign(new Error('Feedback not found'), {
        response: { status: 404 },
      });
      vi.mocked(feedbackApiModule.getFeedback).mockRejectedValue(notFoundError);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 999 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait for retries to complete
      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe('Feedback not found');
    });

    /**
     * Test: Network error handling
     */
    it('should handle network error', async () => {
      const networkError = new Error('Network Error');
      vi.mocked(feedbackApiModule.getFeedback).mockRejectedValue(networkError);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait for retries to complete
      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe('Network Error');
    });
  });

  // ============================================================================
  // SECTION: Cache Management Tests
  // ============================================================================
  describe('Cache Management', () => {
    /**
     * Test: Data persists in cache after unmount
     */
    it('should persist data in cache after unmount', async () => {
      // Use a fresh query client with non-zero cache time for this test
      const cacheQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 60000, // 1 minute cache
            staleTime: 30000, // 30 seconds stale time
          },
        },
      });

      const { result, unmount } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(cacheQueryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.feedback).toBeDefined();

      // Unmount the hook
      unmount();

      // Re-mount and check if data is cached
      vi.mocked(feedbackApiModule.getFeedback).mockClear();

      const { result: result2 } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(cacheQueryClient) }
      );

      // Data should be immediately available from cache
      await waitFor(() => {
        expect(result2.current.feedback).toBeDefined();
      });

      // Clean up
      cacheQueryClient.clear();
    });

    /**
     * Test: Multiple hook instances share cache
     */
    it('should share cache between multiple hook instances', async () => {
      const sharedQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 60000,
            staleTime: 30000,
          },
        },
      });

      // First hook instance
      const { result: result1 } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(sharedQueryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      // Clear mock to track new calls
      vi.mocked(feedbackApiModule.getFeedback).mockClear();

      // Second hook instance with same feedbackId
      const { result: result2 } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(sharedQueryClient) }
      );

      // Second instance should get data from cache without new API call
      await waitFor(() => {
        expect(result2.current.feedback).toBeDefined();
      });

      // API should not have been called again (within stale time)
      expect(feedbackApiModule.getFeedback).not.toHaveBeenCalled();

      // Both should have the same data
      expect(result1.current.feedback?.id).toBe(result2.current.feedback?.id);

      // Clean up
      sharedQueryClient.clear();
    });
  });

  // ============================================================================
  // SECTION: Edge Cases
  // ============================================================================
  describe('Edge Cases', () => {
    /**
     * Test: Hook with undefined feedbackId
     */
    it('should handle undefined feedbackId gracefully', () => {
      const { result } = renderHook(
        // Testing undefined case - feedbackId should be number but runtime may receive undefined
        () => useFeedback({ feedbackId: undefined as unknown as number }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(false);
      expect(feedbackApiModule.getFeedback).not.toHaveBeenCalled();
    });

    /**
     * Test: Hook with null courseId
     */
    it('should handle null courseId correctly', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123, courseId: undefined }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // courseId is not passed to API - only feedbackId is used
      expect(feedbackApiModule.getFeedback).toHaveBeenCalledWith(123);
    });

    /**
     * Test: Rapid feedbackId changes
     */
    it('should handle rapid feedbackId changes correctly', async () => {
      const { rerender, result } = renderHook(
        ({ feedbackId }: { feedbackId: number }) =>
          useFeedback({ feedbackId }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { feedbackId: 1 },
        }
      );

      // Rapidly change feedbackId
      rerender({ feedbackId: 2 });
      rerender({ feedbackId: 3 });
      rerender({ feedbackId: 123 });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The last feedbackId should be used
      expect(result.current.feedback?.id).toBe(123);
    });

    /**
     * Test: Feedback with no questions (empty array)
     */
    it('should handle feedback with no questions', async () => {
      // Mock must return wrapped API response with empty array
      vi.mocked(feedbackApiModule.getFeedbackQuestions).mockResolvedValue(wrapApiResponse([]));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.questions).toEqual([]);
    });

    /**
     * Test: Hook cleanup on unmount
     */
    it('should cleanup properly on unmount', async () => {
      const { result, unmount } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Unmount should not throw errors
      expect(() => unmount()).not.toThrow();
    });

    /**
     * Test: Concurrent requests for different feedbackIds
     */
    it('should handle concurrent requests for different feedbackIds', async () => {
      const { result: result1 } = renderHook(
        () => useFeedback({ feedbackId: 100 }),
        { wrapper: createWrapper(queryClient) }
      );

      const { result: result2 } = renderHook(
        () => useFeedback({ feedbackId: 200 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
        expect(result2.current.isLoading).toBe(false);
      });

      // Both should have made API calls - only feedbackId is passed
      expect(feedbackApiModule.getFeedback).toHaveBeenCalledWith(100);
      expect(feedbackApiModule.getFeedback).toHaveBeenCalledWith(200);
    });
  });

  // ============================================================================
  // SECTION: TypeScript Type Tests
  // ============================================================================
  describe('TypeScript Type Verification', () => {
    /**
     * Test: Verify return type structure
     */
    it('should return correct FeedbackHookResult type structure', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify all expected properties exist per FeedbackHookResult interface
      expect(result.current).toHaveProperty('feedback');
      expect(result.current).toHaveProperty('questions');
      expect(result.current).toHaveProperty('completion'); // Not 'status' - hook returns computed properties
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isFetching');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
      
      // Computed properties
      expect(result.current).toHaveProperty('isOpen');
      expect(result.current).toHaveProperty('canComplete');
      expect(result.current).toHaveProperty('canSubmit');
      expect(result.current).toHaveProperty('isAnonymous');
      expect(result.current).toHaveProperty('hasResponded');
    });

    /**
     * Test: Verify computed properties are boolean types
     */
    it('should have boolean types for computed properties', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // All computed properties should be booleans
      expect(typeof result.current.isOpen).toBe('boolean');
      expect(typeof result.current.canComplete).toBe('boolean');
      expect(typeof result.current.canSubmit).toBe('boolean');
      expect(typeof result.current.isAnonymous).toBe('boolean');
      expect(typeof result.current.hasResponded).toBe('boolean');
    });

    /**
     * Test: Verify feedback data matches Feedback interface
     */
    it('should return feedback data matching Feedback interface', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const feedback = result.current.feedback;
      expect(feedback).toBeDefined();
      
      if (feedback) {
        // Check required Feedback interface properties
        expect(typeof feedback.id).toBe('number');
        expect(typeof feedback.course).toBe('number');
        expect(typeof feedback.name).toBe('string');
        expect(typeof feedback.intro).toBe('string');
        expect([0, 1, 2]).toContain(feedback.anonymous);
        expect(typeof feedback.multiple_submit).toBe('number');
        expect(typeof feedback.timeopen).toBe('number');
        expect(typeof feedback.timeclose).toBe('number');
      }
    });

    /**
     * Test: Verify questions array matches FeedbackItem[] type
     */
    it('should return questions matching FeedbackItem[] type', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const questions = result.current.questions;
      expect(Array.isArray(questions)).toBe(true);
      
      if (questions && questions.length > 0) {
        const question = questions[0]!;  // Non-null assertion - we just checked length > 0
        expect(typeof question.id).toBe('number');
        expect(typeof question.feedback).toBe('number');
        expect(typeof question.name).toBe('string');
        expect(typeof question.typ).toBe('string');
        expect(typeof question.position).toBe('number');
      }
    });

    /**
     * Test: Verify refetch is a function
     */
    it('should have refetch as a callable function', async () => {
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 123 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });
  });
});
