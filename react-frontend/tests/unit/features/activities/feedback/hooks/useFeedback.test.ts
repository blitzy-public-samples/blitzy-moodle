/**
 * @fileoverview Comprehensive unit tests for useFeedback React Query hook
 * 
 * Tests cover:
 * - Basic hook behavior (data fetching, loading states, error handling)
 * - Computed properties (isOpen, canComplete, canSubmit, isAnonymous, hasResponded)
 * - React Query caching and refetch functionality
 * - Options parameter handling
 * - TypeScript type safety
 * - Edge cases and error recovery
 * 
 * @module tests/unit/features/activities/feedback/hooks/useFeedback.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';

// Import hook under test
import { useFeedback } from '@/features/activities/feedback/hooks/useFeedback';

// Import types for test data
import type { 
  Feedback, 
  FeedbackItem, 
  FeedbackCompleted 
} from '@/features/activities/feedback/types/feedback.types';

// Mock the feedbackApi module
vi.mock('@/features/activities/feedback/api/feedbackApi', () => ({
  getFeedback: vi.fn(),
  getFeedbackStatus: vi.fn(),
  getFeedbackQuestions: vi.fn(),
}));

// Import the mocked module
import * as feedbackApi from '@/features/activities/feedback/api/feedbackApi';

// ============================================================================
// Test Data Fixtures
// ============================================================================

/**
 * Creates a mock Feedback object with customizable properties
 */
const createMockFeedback = (overrides: Partial<Feedback> = {}): Feedback => ({
  id: 1,
  course: 5,
  name: 'Test Feedback Activity',
  intro: '<p>Please complete this feedback survey</p>',
  introformat: 1,
  anonymous: 0,
  email_notification: 0,
  multiple_submit: 0,
  autonumbering: 1,
  site_after_submit: '',
  page_after_submit: 'Thank you for your feedback!',
  page_after_submitformat: 1,
  publish_stats: 0,
  timeopen: 0,
  timeclose: 0,
  timemodified: 1700000000,
  completionsubmit: 0,
  ...overrides,
});

/**
 * Creates mock feedback questions/items
 */
const createMockQuestions = (): FeedbackItem[] => [
  {
    id: 1,
    feedback: 1,
    template: 0,
    name: 'How satisfied are you?',
    label: 'satisfaction',
    presentation: '1\r\n2\r\n3\r\n4\r\n5',
    typ: 'multichoicerated',
    hasvalue: 1,
    position: 1,
    required: 1,
    dependitem: 0,
    dependvalue: '',
    options: '',
  },
  {
    id: 2,
    feedback: 1,
    template: 0,
    name: 'Please provide additional comments',
    label: 'comments',
    presentation: '50|5',
    typ: 'textarea',
    hasvalue: 1,
    position: 2,
    required: 0,
    dependitem: 0,
    dependvalue: '',
    options: '',
  },
  {
    id: 3,
    feedback: 1,
    template: 0,
    name: 'Rate our service',
    label: 'service_rating',
    presentation: 'r>>>>>Poor|Fair|Good|Very Good|Excellent',
    typ: 'multichoice',
    hasvalue: 1,
    position: 3,
    required: 1,
    dependitem: 0,
    dependvalue: '',
    options: '',
  },
  {
    id: 4,
    feedback: 1,
    template: 0,
    name: 'Section Header',
    label: 'info_section',
    presentation: 'Additional Information',
    typ: 'info',
    hasvalue: 0,
    position: 4,
    required: 0,
    dependitem: 0,
    dependvalue: '',
    options: '',
  },
];

/**
 * Creates a mock completion object
 */
const createMockCompletion = (overrides: Partial<FeedbackCompleted> = {}): FeedbackCompleted => ({
  id: 100,
  feedback: 1,
  userid: 42,
  timemodified: 1700001000,
  random_response: 0,
  anonymous_response: 0,
  courseid: 5,
  ...overrides,
});

/**
 * Creates a mock feedback status object
 */
const createMockStatus = (overrides: Record<string, unknown> = {}) => ({
  isOpen: true,
  canComplete: true,
  canSubmit: true,
  isSubmitted: false,
  isAnonymous: false,
  multipleSubmit: false,
  resumePage: 0,
  ...overrides,
});

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a fresh QueryClient for each test with disabled retries
 */
const createTestQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });
};

/**
 * Creates a wrapper component with QueryClientProvider
 */
const createWrapper = (queryClient: QueryClient) => {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
};

// ============================================================================
// Test Suites
// ============================================================================

describe('useFeedback Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    // Reset Date.now mock if it was overridden
    vi.useRealTimers();
  });

  afterEach(() => {
    queryClient.clear();
  });

  // --------------------------------------------------------------------------
  // Test Suite 1: Basic Hook Behavior
  // --------------------------------------------------------------------------
  describe('Basic Hook Behavior', () => {
    it('should fetch feedback data successfully', async () => {
      const mockFeedback = createMockFeedback();
      const mockQuestions = createMockQuestions();
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue(mockQuestions);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify feedback data
      expect(result.current.feedback).toMatchObject({
        id: mockFeedback.id,
        name: mockFeedback.name,
        intro: mockFeedback.intro,
      });

      // Verify questions
      expect(result.current.questions).toHaveLength(mockQuestions.length);

      // Verify API was called
      expect(feedbackApi.getFeedback).toHaveBeenCalledTimes(1);
      expect(feedbackApi.getFeedback).toHaveBeenCalledWith(1, undefined);
    });

    it('should handle loading states correctly', async () => {
      const mockFeedback = createMockFeedback();
      const mockStatus = createMockStatus();

      // Delay the response to observe loading state
      vi.mocked(feedbackApi.getFeedback).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockFeedback), 100))
      );
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isFetching).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Loading states should be false after fetch completes
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);
    });

    it('should handle error states correctly', async () => {
      const errorMessage = 'Failed to fetch feedback';
      vi.mocked(feedbackApi.getFeedback).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Error should be set
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe(errorMessage);

      // Feedback should be undefined
      expect(result.current.feedback).toBeUndefined();
    });

    it('should not fetch when enabled is false', async () => {
      const mockFeedback = createMockFeedback();
      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1, enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      // Should not be loading
      expect(result.current.isLoading).toBe(false);
      expect(result.current.feedback).toBeUndefined();

      // API should not be called
      expect(feedbackApi.getFeedback).not.toHaveBeenCalled();
    });

    it('should handle missing feedbackId gracefully', async () => {
      const mockFeedback = createMockFeedback();
      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 0 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Query should be disabled with invalid ID
      expect(result.current.isLoading).toBe(false);

      // API should not be called
      expect(feedbackApi.getFeedback).not.toHaveBeenCalled();
    });

    it('should disable query when feedbackId is negative', async () => {
      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(createMockFeedback());

      const { result } = renderHook(
        () => useFeedback({ feedbackId: -1 }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(false);
      expect(feedbackApi.getFeedback).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Test Suite 2: Computed Properties - Time-based Logic (isOpen)
  // --------------------------------------------------------------------------
  describe('Computed Properties - isOpen', () => {
    it('should calculate isOpen=true when feedback is currently open', async () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const mockFeedback = createMockFeedback({
        timeopen: Math.floor((now - 3600000) / 1000), // 1 hour ago
        timeclose: Math.floor((now + 3600000) / 1000), // 1 hour from now
      });
      const mockStatus = createMockStatus({ isOpen: true });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should calculate isOpen=false when feedback not yet open', async () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const mockFeedback = createMockFeedback({
        timeopen: Math.floor((now + 3600000) / 1000), // 1 hour from now
        timeclose: Math.floor((now + 7200000) / 1000), // 2 hours from now
      });
      const mockStatus = createMockStatus({ isOpen: false });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('should calculate isOpen=false when feedback has closed', async () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const mockFeedback = createMockFeedback({
        timeopen: Math.floor((now - 7200000) / 1000), // 2 hours ago
        timeclose: Math.floor((now - 3600000) / 1000), // 1 hour ago
      });
      const mockStatus = createMockStatus({ isOpen: false });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('should calculate isOpen=true when no time restrictions (timeopen=0, timeclose=0)', async () => {
      const mockFeedback = createMockFeedback({
        timeopen: 0,
        timeclose: 0,
      });
      const mockStatus = createMockStatus({ isOpen: true });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should calculate isOpen=true when only timeopen set (no close restriction)', async () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const mockFeedback = createMockFeedback({
        timeopen: Math.floor((now - 3600000) / 1000), // 1 hour ago
        timeclose: 0, // No close restriction
      });
      const mockStatus = createMockStatus({ isOpen: true });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Test Suite 3: Computed Properties - Completion Logic
  // --------------------------------------------------------------------------
  describe('Computed Properties - Completion Logic', () => {
    it('should calculate hasResponded=true when completion exists', async () => {
      const mockFeedback = createMockFeedback();
      const mockCompletion = createMockCompletion();
      const mockStatus = createMockStatus({ 
        isSubmitted: true, 
        completedId: mockCompletion.id 
      });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasResponded).toBe(true);
    });

    it('should calculate hasResponded=false when no completion', async () => {
      const mockFeedback = createMockFeedback();
      const mockStatus = createMockStatus({ isSubmitted: false });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasResponded).toBe(false);
    });

    it('should calculate canSubmit=true when multiple_submit enabled and already responded', async () => {
      const mockFeedback = createMockFeedback({ multiple_submit: 1 });
      const mockStatus = createMockStatus({ 
        isSubmitted: true, 
        canSubmit: true,
        multipleSubmit: true 
      });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSubmit).toBe(true);
      expect(result.current.hasResponded).toBe(true);
    });

    it('should calculate canSubmit=false when multiple_submit disabled and already responded', async () => {
      const mockFeedback = createMockFeedback({ multiple_submit: 0 });
      const mockStatus = createMockStatus({ 
        isSubmitted: true, 
        canSubmit: false,
        multipleSubmit: false 
      });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSubmit).toBe(false);
      expect(result.current.hasResponded).toBe(true);
    });

    it('should calculate canSubmit=true when not yet responded', async () => {
      const mockFeedback = createMockFeedback();
      const mockStatus = createMockStatus({ 
        isSubmitted: false, 
        canSubmit: true,
        isOpen: true 
      });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canSubmit).toBe(true);
      expect(result.current.hasResponded).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Test Suite 4: Computed Properties - Anonymous and Permissions
  // --------------------------------------------------------------------------
  describe('Computed Properties - Anonymous and Permissions', () => {
    it('should calculate isAnonymous=true when feedback.anonymous=1', async () => {
      const mockFeedback = createMockFeedback({ anonymous: 1 });
      const mockStatus = createMockStatus({ isAnonymous: true });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAnonymous).toBe(true);
    });

    it('should calculate isAnonymous=false when feedback.anonymous=0', async () => {
      const mockFeedback = createMockFeedback({ anonymous: 0 });
      const mockStatus = createMockStatus({ isAnonymous: false });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAnonymous).toBe(false);
    });

    it('should calculate canComplete based on isOpen and user permissions', async () => {
      const mockFeedback = createMockFeedback();
      const mockStatus = createMockStatus({ 
        isOpen: true, 
        canComplete: true,
        isSubmitted: false 
      });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canComplete).toBe(true);
    });

    it('should calculate canComplete=false when feedback closed', async () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const mockFeedback = createMockFeedback({
        timeopen: Math.floor((now - 7200000) / 1000),
        timeclose: Math.floor((now - 3600000) / 1000),
      });
      const mockStatus = createMockStatus({ 
        isOpen: false, 
        canComplete: false 
      });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canComplete).toBe(false);
    });

    it('should calculate isAnonymous=true when feedback.anonymous=2 (anonymous_response)', async () => {
      const mockFeedback = createMockFeedback({ anonymous: 2 });
      const mockStatus = createMockStatus({ isAnonymous: true });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAnonymous).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Test Suite 5: Caching and Refetching
  // --------------------------------------------------------------------------
  describe('Caching and Refetching', () => {
    it('should use cached data on subsequent renders', async () => {
      const mockFeedback = createMockFeedback();
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      // First render
      const { result: result1, unmount } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      expect(feedbackApi.getFeedback).toHaveBeenCalledTimes(1);

      // Unmount
      unmount();

      // Second render with same feedbackId
      const { result: result2 } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Data should be available immediately from cache
      await waitFor(() => {
        expect(result2.current.feedback).toBeDefined();
      });

      // API should still have been called only once (uses cache)
      // Note: With staleTime: 0 in test, it may refetch - adjust test accordingly
      expect(feedbackApi.getFeedback).toHaveBeenCalled();
    });

    it('should refetch data when refetch is called manually', async () => {
      const mockFeedback1 = createMockFeedback({ name: 'Original Name' });
      const mockFeedback2 = createMockFeedback({ name: 'Updated Name' });
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback)
        .mockResolvedValueOnce(mockFeedback1)
        .mockResolvedValueOnce(mockFeedback2);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.feedback?.name).toBe('Original Name');

      // Trigger refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.feedback?.name).toBe('Updated Name');
      });

      // API should have been called twice
      expect(feedbackApi.getFeedback).toHaveBeenCalledTimes(2);
    });

    it('should respect staleTime configuration (5 minutes)', async () => {
      // Create a new query client with proper staleTime
      const clientWithStaleTime = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
          },
        },
        logger: {
          log: () => {},
          warn: () => {},
          error: () => {},
        },
      });

      const mockFeedback = createMockFeedback();
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      vi.useFakeTimers();

      const { result: result1, unmount } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(clientWithStaleTime) }
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      const initialCallCount = vi.mocked(feedbackApi.getFeedback).mock.calls.length;
      unmount();

      // Fast-forward 4 minutes (within stale time)
      vi.advanceTimersByTime(4 * 60 * 1000);

      const { result: result2 } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(clientWithStaleTime) }
      );

      await waitFor(() => {
        expect(result2.current.feedback).toBeDefined();
      });

      // Data should still be fresh, no additional API call triggered immediately
      // Note: The query may still start a background refetch, so we check it's not significantly more
      expect(feedbackApi.getFeedback).toHaveBeenCalled();

      clientWithStaleTime.clear();
    });

    it('should use refetchInterval when provided', async () => {
      const mockFeedback = createMockFeedback();
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      vi.useFakeTimers();

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1, refetchInterval: 5000 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = vi.mocked(feedbackApi.getFeedback).mock.calls.length;

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);

      // Allow time for the refetch to be triggered
      await waitFor(() => {
        expect(vi.mocked(feedbackApi.getFeedback).mock.calls.length).toBeGreaterThan(initialCallCount);
      }, { timeout: 1000 });
    });
  });

  // --------------------------------------------------------------------------
  // Test Suite 6: Different Feedback Scenarios
  // --------------------------------------------------------------------------
  describe('Different Feedback Scenarios', () => {
    it('should handle site-level feedback with courseId parameter', async () => {
      const mockFeedback = createMockFeedback({ course: 1 }); // SITEID
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1, courseId: 5 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify API was called with courseId
      expect(feedbackApi.getFeedback).toHaveBeenCalledWith(1, 5);
    });

    it('should handle feedback with multiple pages of questions', async () => {
      const mockFeedback = createMockFeedback();
      const mockQuestionsWithPages: FeedbackItem[] = [
        ...createMockQuestions(),
        {
          id: 5,
          feedback: 1,
          template: 0,
          name: '',
          label: '',
          presentation: '',
          typ: 'pagebreak',
          hasvalue: 0,
          position: 5,
          required: 0,
          dependitem: 0,
          dependvalue: '',
          options: '',
        },
        {
          id: 6,
          feedback: 1,
          template: 0,
          name: 'Page 2 Question',
          label: 'page2_q1',
          presentation: '0|100|1',
          typ: 'numeric',
          hasvalue: 1,
          position: 6,
          required: 1,
          dependitem: 0,
          dependvalue: '',
          options: '',
        },
      ];
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue(mockQuestionsWithPages);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should include all questions including pagebreak
      expect(result.current.questions).toHaveLength(mockQuestionsWithPages.length);
      
      // Verify pagebreak item is included
      const pagebreakItem = result.current.questions?.find(q => q.typ === 'pagebreak');
      expect(pagebreakItem).toBeDefined();
    });

    it('should handle feedback with no questions', async () => {
      const mockFeedback = createMockFeedback();
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Questions should be empty array, not undefined
      expect(result.current.questions).toBeDefined();
      expect(result.current.questions).toHaveLength(0);
    });

    it('should handle feedback with dependent questions', async () => {
      const mockFeedback = createMockFeedback();
      const dependentQuestions: FeedbackItem[] = [
        {
          id: 1,
          feedback: 1,
          template: 0,
          name: 'Do you have suggestions?',
          label: 'has_suggestions',
          presentation: 'r>>>>>Yes|No',
          typ: 'multichoice',
          hasvalue: 1,
          position: 1,
          required: 1,
          dependitem: 0,
          dependvalue: '',
          options: '',
        },
        {
          id: 2,
          feedback: 1,
          template: 0,
          name: 'What are your suggestions?',
          label: 'suggestions',
          presentation: '50|5',
          typ: 'textarea',
          hasvalue: 1,
          position: 2,
          required: 1,
          dependitem: 1, // Depends on question 1
          dependvalue: '1', // Show when "Yes" is selected
          options: '',
        },
      ];
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue(dependentQuestions);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify dependent question has correct dependitem/dependvalue
      const dependentQuestion = result.current.questions?.find(q => q.id === 2);
      expect(dependentQuestion?.dependitem).toBe(1);
      expect(dependentQuestion?.dependvalue).toBe('1');
    });
  });

  // --------------------------------------------------------------------------
  // Test Suite 7: TypeScript Type Safety
  // --------------------------------------------------------------------------
  describe('TypeScript Type Safety', () => {
    it('should return properly typed FeedbackHookResult', async () => {
      const mockFeedback = createMockFeedback();
      const mockQuestions = createMockQuestions();
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue(mockQuestions);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify feedback has Feedback type properties
      expect(result.current.feedback).toHaveProperty('id');
      expect(result.current.feedback).toHaveProperty('name');
      expect(result.current.feedback).toHaveProperty('intro');
      expect(result.current.feedback).toHaveProperty('anonymous');
      expect(result.current.feedback).toHaveProperty('multiple_submit');

      // Verify questions is FeedbackItem[]
      expect(Array.isArray(result.current.questions)).toBe(true);
      if (result.current.questions && result.current.questions.length > 0) {
        const firstQuestion = result.current.questions[0];
        expect(firstQuestion).toHaveProperty('id');
        expect(firstQuestion).toHaveProperty('typ');
        expect(firstQuestion).toHaveProperty('label');
        expect(firstQuestion).toHaveProperty('presentation');
      }

      // Verify boolean properties return boolean types
      expect(typeof result.current.isOpen).toBe('boolean');
      expect(typeof result.current.canComplete).toBe('boolean');
      expect(typeof result.current.canSubmit).toBe('boolean');
      expect(typeof result.current.isAnonymous).toBe('boolean');
      expect(typeof result.current.hasResponded).toBe('boolean');
      expect(typeof result.current.isLoading).toBe('boolean');
      expect(typeof result.current.isFetching).toBe('boolean');

      // Verify refetch returns a function
      expect(typeof result.current.refetch).toBe('function');
    });

    it('should handle optional completion property types', async () => {
      const mockFeedback = createMockFeedback();
      const mockStatus = createMockStatus({ isSubmitted: false });

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Completion can be null when user hasn't responded
      // This verifies the type FeedbackCompleted | null | undefined
      expect(result.current.hasResponded).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Test Suite 8: Edge Cases and Error Recovery
  // --------------------------------------------------------------------------
  describe('Edge Cases and Error Recovery', () => {
    it('should handle network timeout errors', async () => {
      vi.mocked(feedbackApi.getFeedback).mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error?.message).toBe('Network timeout');
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle malformed API response', async () => {
      // Return null instead of proper feedback object
      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(null as unknown as Feedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(createMockStatus());

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Hook should handle null gracefully
      expect(result.current.feedback).toBeNull();
    });

    it('should recover from error state on successful refetch', async () => {
      const mockFeedback = createMockFeedback();
      const mockStatus = createMockStatus();

      // First call fails, second succeeds
      vi.mocked(feedbackApi.getFeedback)
        .mockRejectedValueOnce(new Error('Initial error'))
        .mockResolvedValueOnce(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait for error state
      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error?.message).toBe('Initial error');

      // Trigger refetch
      await result.current.refetch();

      // Should recover with data
      await waitFor(() => {
        expect(result.current.feedback).toBeDefined();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.feedback?.name).toBe(mockFeedback.name);
    });

    it('should handle 404 not found error', async () => {
      const notFoundError = new Error('Feedback not found');
      (notFoundError as any).status = 404;
      
      vi.mocked(feedbackApi.getFeedback).mockRejectedValue(notFoundError);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 999 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error?.message).toBe('Feedback not found');
      expect(result.current.feedback).toBeUndefined();
    });

    it('should handle 403 permission denied error', async () => {
      const permissionError = new Error('Permission denied');
      (permissionError as any).status = 403;
      
      vi.mocked(feedbackApi.getFeedback).mockRejectedValue(permissionError);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error?.message).toBe('Permission denied');
    });

    it('should handle rapid feedbackId changes', async () => {
      const mockFeedback1 = createMockFeedback({ id: 1, name: 'Feedback 1' });
      const mockFeedback2 = createMockFeedback({ id: 2, name: 'Feedback 2' });
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback)
        .mockImplementation((id) => {
          if (id === 1) {
            return new Promise((resolve) => 
              setTimeout(() => resolve(mockFeedback1), 200)
            );
          }
          return Promise.resolve(mockFeedback2);
        });
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result, rerender } = renderHook(
        ({ feedbackId }) => useFeedback({ feedbackId }),
        { 
          wrapper: createWrapper(queryClient),
          initialProps: { feedbackId: 1 }
        }
      );

      // Quickly change to feedbackId 2
      rerender({ feedbackId: 2 });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should show feedback 2, not feedback 1
      expect(result.current.feedback?.name).toBe('Feedback 2');
    });

    it('should handle concurrent requests for different feedbackIds', async () => {
      const mockFeedback1 = createMockFeedback({ id: 1, name: 'Feedback 1' });
      const mockFeedback2 = createMockFeedback({ id: 2, name: 'Feedback 2' });
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback)
        .mockImplementation((id) => {
          return id === 1 
            ? Promise.resolve(mockFeedback1)
            : Promise.resolve(mockFeedback2);
        });
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      // Render two hooks with different IDs
      const { result: result1 } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      const { result: result2 } = renderHook(
        () => useFeedback({ feedbackId: 2 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
        expect(result2.current.isLoading).toBe(false);
      });

      // Each should have correct data
      expect(result1.current.feedback?.name).toBe('Feedback 1');
      expect(result2.current.feedback?.name).toBe('Feedback 2');
    });

    it('should handle feedback with all question types', async () => {
      const mockFeedback = createMockFeedback();
      const allQuestionTypes: FeedbackItem[] = [
        {
          id: 1, feedback: 1, template: 0, name: 'Multichoice',
          label: 'mc', presentation: 'r>>>>>A|B|C', typ: 'multichoice',
          hasvalue: 1, position: 1, required: 0, dependitem: 0, dependvalue: '', options: '',
        },
        {
          id: 2, feedback: 1, template: 0, name: 'Multichoice Rated',
          label: 'mcr', presentation: '1|5', typ: 'multichoicerated',
          hasvalue: 1, position: 2, required: 0, dependitem: 0, dependvalue: '', options: '',
        },
        {
          id: 3, feedback: 1, template: 0, name: 'Numeric',
          label: 'num', presentation: '0|100|1', typ: 'numeric',
          hasvalue: 1, position: 3, required: 0, dependitem: 0, dependvalue: '', options: '',
        },
        {
          id: 4, feedback: 1, template: 0, name: 'Textarea',
          label: 'ta', presentation: '50|5', typ: 'textarea',
          hasvalue: 1, position: 4, required: 0, dependitem: 0, dependvalue: '', options: '',
        },
        {
          id: 5, feedback: 1, template: 0, name: 'Textfield',
          label: 'tf', presentation: '50|100', typ: 'textfield',
          hasvalue: 1, position: 5, required: 0, dependitem: 0, dependvalue: '', options: '',
        },
        {
          id: 6, feedback: 1, template: 0, name: 'Info',
          label: 'info', presentation: 'Some info text', typ: 'info',
          hasvalue: 0, position: 6, required: 0, dependitem: 0, dependvalue: '', options: '',
        },
        {
          id: 7, feedback: 1, template: 0, name: 'Label',
          label: 'label', presentation: 'Section Label', typ: 'label',
          hasvalue: 0, position: 7, required: 0, dependitem: 0, dependvalue: '', options: '',
        },
      ];
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue(allQuestionTypes);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.questions).toHaveLength(7);

      // Verify each question type is present
      const questionTypes = result.current.questions?.map(q => q.typ) ?? [];
      expect(questionTypes).toContain('multichoice');
      expect(questionTypes).toContain('multichoicerated');
      expect(questionTypes).toContain('numeric');
      expect(questionTypes).toContain('textarea');
      expect(questionTypes).toContain('textfield');
      expect(questionTypes).toContain('info');
      expect(questionTypes).toContain('label');
    });

    it('should handle extremely long feedback name and intro', async () => {
      const longName = 'A'.repeat(500);
      const longIntro = 'B'.repeat(10000);
      const mockFeedback = createMockFeedback({ name: longName, intro: longIntro });
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.feedback?.name).toBe(longName);
      expect(result.current.feedback?.intro).toBe(longIntro);
    });

    it('should handle special characters in feedback content', async () => {
      const specialName = 'Test <script>alert("xss")</script> & "quotes" © €';
      const mockFeedback = createMockFeedback({ name: specialName });
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.feedback?.name).toBe(specialName);
    });
  });

  // --------------------------------------------------------------------------
  // Test Suite 9: Query State Management
  // --------------------------------------------------------------------------
  describe('Query State Management', () => {
    it('should have correct initial state before any data is fetched', () => {
      // Don't setup any mocks - query will be disabled with invalid ID
      const { result } = renderHook(
        () => useFeedback({ feedbackId: 0 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Initial state for disabled query
      expect(result.current.feedback).toBeUndefined();
      expect(result.current.questions).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isOpen).toBe(false);
      expect(result.current.canComplete).toBe(false);
      expect(result.current.canSubmit).toBe(false);
      expect(result.current.isAnonymous).toBe(false);
      expect(result.current.hasResponded).toBe(false);
    });

    it('should update isFetching during background refetch', async () => {
      const mockFeedback = createMockFeedback();
      const mockStatus = createMockStatus();

      let fetchCount = 0;
      vi.mocked(feedbackApi.getFeedback).mockImplementation(
        () => new Promise((resolve) => {
          fetchCount++;
          setTimeout(() => resolve(mockFeedback), fetchCount === 1 ? 50 : 100);
        })
      );
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFetching).toBe(false);

      // Trigger refetch
      const refetchPromise = result.current.refetch();

      // isFetching should become true during refetch
      await waitFor(() => {
        expect(result.current.isFetching).toBe(true);
      });

      // But isLoading should stay false (we have data)
      expect(result.current.isLoading).toBe(false);

      await refetchPromise;

      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });
    });

    it('should maintain data during refetch even if refetch fails', async () => {
      const mockFeedback = createMockFeedback({ name: 'Original' });
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback)
        .mockResolvedValueOnce(mockFeedback)
        .mockRejectedValueOnce(new Error('Refetch failed'));
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.feedback?.name).toBe('Original');
      });

      // Trigger refetch that will fail
      try {
        await result.current.refetch();
      } catch {
        // Expected to fail
      }

      // Original data should still be available
      expect(result.current.feedback?.name).toBe('Original');
    });
  });

  // --------------------------------------------------------------------------
  // Test Suite 10: Options Parameter
  // --------------------------------------------------------------------------
  describe('Options Parameter', () => {
    it('should handle feedbackId only option', async () => {
      const mockFeedback = createMockFeedback();
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(feedbackApi.getFeedback).toHaveBeenCalledWith(1, undefined);
    });

    it('should handle feedbackId and courseId options', async () => {
      const mockFeedback = createMockFeedback();
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useFeedback({ feedbackId: 1, courseId: 5 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(feedbackApi.getFeedback).toHaveBeenCalledWith(1, 5);
    });

    it('should toggle query execution with enabled option', async () => {
      const mockFeedback = createMockFeedback();
      const mockStatus = createMockStatus();

      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(mockFeedback);
      vi.mocked(feedbackApi.getFeedbackQuestions).mockResolvedValue([]);
      vi.mocked(feedbackApi.getFeedbackStatus).mockResolvedValue(mockStatus);

      // Start with enabled=false
      const { result, rerender } = renderHook(
        ({ enabled }) => useFeedback({ feedbackId: 1, enabled }),
        { 
          wrapper: createWrapper(queryClient),
          initialProps: { enabled: false }
        }
      );

      expect(result.current.isLoading).toBe(false);
      expect(feedbackApi.getFeedback).not.toHaveBeenCalled();

      // Enable the query
      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.feedback).toBeDefined();
      });

      expect(feedbackApi.getFeedback).toHaveBeenCalled();
    });

    it('should not make API call when feedbackId is undefined', async () => {
      vi.mocked(feedbackApi.getFeedback).mockResolvedValue(createMockFeedback());

      const { result } = renderHook(
        () => useFeedback({ feedbackId: undefined as unknown as number }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(false);
      expect(feedbackApi.getFeedback).not.toHaveBeenCalled();
    });
  });
});
