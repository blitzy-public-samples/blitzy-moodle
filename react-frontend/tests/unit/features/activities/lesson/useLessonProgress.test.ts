/**
 * @fileoverview Unit tests for useLessonProgress hook
 *
 * Tests lesson progress state management including page navigation, attempt tracking,
 * timer management, branching path logic, state transitions, response processing,
 * and completion tracking with proper state persistence.
 *
 * References Moodle functions:
 * - lesson->process_page_responses() from public/mod/lesson/view.php lines 94-197
 * - lesson->cluster_jump() from public/mod/lesson/locallib.php lines 2158-2280
 * - lesson->calculate_new_page_on_jump() from public/mod/lesson/locallib.php lines 2516-2639
 * - lesson_unseen_question_jump() from public/mod/lesson/locallib.php lines 2970-3021
 * - lesson_unseen_branch_jump() from public/mod/lesson/locallib.php lines 3407-3500
 * - continue.php lines 51-74 for page continuation logic
 *
 * @module tests/unit/features/activities/lesson/useLessonProgress.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse, delay } from 'msw';

import {
  useLessonProgress,
  type PageResponse,
  type NavigationResult,
  LESSON_JUMP_CONSTANTS,
} from '@/features/activities/lesson/hooks/useLessonProgress';
import { server } from '@tests/mocks/server';
import { createTestQueryClient } from '@tests/helpers/render';

// Extract constants for branching logic tests
const {
  LESSON_NEXTPAGE,
  LESSON_PREVIOUSPAGE,
  LESSON_EOL,
  LESSON_UNSEENBRANCHPAGE,
  LESSON_CLUSTERJUMP,
  LESSON_THISPAGE,
  LESSON_RANDOMPAGE,
  LESSON_RANDOMBRANCH,
} = LESSON_JUMP_CONSTANTS;

// ============================================================================
// Test Setup and Utilities
// ============================================================================

// Store active query clients for cleanup
const activeQueryClients: Set<QueryClient> = new Set();

/**
 * Creates a wrapper component with QueryClientProvider for renderHook.
 * Returns both wrapper and queryClient for cache inspection in tests.
 */
function createWrapper() {
  const queryClient = createTestQueryClient();
  activeQueryClients.add(queryClient);

  function Wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }

  return { wrapper: Wrapper, queryClient };
}

/**
 * Creates a mock lesson data response matching Moodle lesson structure
 */
function createMockLesson(
  overrides: Partial<{
    id: number;
    name: string;
    timelimit: number | null;
    maxattempts: number;
    retake: number;
    pages: Array<{ id: number; title: string; type: number }>;
    grade: number | null;
    completed: boolean;
  }> = {}
) {
  return {
    id: 1,
    name: 'Test Lesson',
    timelimit: null,
    maxattempts: 1,
    retake: 1,
    pages: [
      { id: 1, title: 'Page 1', type: 20 },
      { id: 2, title: 'Page 2', type: 20 },
      { id: 3, title: 'Page 3', type: 20 },
      { id: 4, title: 'End Page', type: 21 },
    ],
    grade: null,
    completed: false,
    ...overrides,
  };
}

/**
 * Creates a mock NavigationResult matching the hook's interface
 * @internal Kept for potential future test expansion
 */
function _createMockNavigationResult(
  overrides: Partial<NavigationResult> = {}
): NavigationResult {
  return {
    nextPageId: 2,
    isCorrect: true,
    feedback: 'Correct answer!',
    shouldShowFeedback: true,
    isEndOfLesson: false,
    ...overrides,
  };
}
// Suppress unused function warning - kept for future test expansion
void _createMockNavigationResult;

/**
 * Creates a mock PageResponse for submission
 */
function createMockPageResponse(overrides: Partial<PageResponse> = {}): PageResponse {
  return {
    pageid: 1,
    answerid: 1,
    data: { answer: 'test answer' },
    timeseen: 30,
    ...overrides,
  };
}

/**
 * Creates mock API response data for page response submission
 */
function createMockPageResponseApiResult(
  overrides: Partial<{
    nextPageId: number | null;
    isCorrect: boolean;
    feedback: string;
    showFeedback: boolean;
    isEndOfLesson: boolean;
    attemptCount: number;
    retryCount: number;
    grade: number | null;
  }> = {}
) {
  return {
    nextPageId: 2,
    isCorrect: true,
    feedback: 'Correct answer!',
    showFeedback: true,
    isEndOfLesson: false,
    attemptCount: 1,
    retryCount: 0,
    grade: null,
    ...overrides,
  };
}

/**
 * Creates mock timer API response data
 */
function createMockTimerData(
  overrides: Partial<{
    starttime: number;
    lessontime: number;
    isActive: boolean;
  }> = {}
) {
  const now = Math.floor(Date.now() / 1000);
  return {
    starttime: now,
    lessontime: 3600, // 1 hour
    isActive: true,
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('useLessonProgress', () => {
  beforeEach(() => {
    // Default lesson data handler - uses useLesson hook internally
    server.use(
      http.get('http://*/api/v1/lesson/:lessonId', () => {
        return HttpResponse.json({
          success: true,
          data: createMockLesson(),
        });
      })
    );
  });

  afterEach(async () => {
    // Cancel all pending queries and mutations to prevent ECONNREFUSED errors
    // when handlers are reset. This handles cases where React Query triggers
    // background refetches after mutations complete.
    for (const queryClient of activeQueryClients) {
      queryClient.cancelQueries();
      queryClient.clear();
    }
    activeQueryClients.clear();
    
    // Wait a tick to allow any pending operations to settle
    await new Promise(resolve => setTimeout(resolve, 10));
    
    vi.clearAllMocks();
    server.resetHandlers();
  });

  // ==========================================================================
  // Test Group: Initial State Setup
  // ==========================================================================

  describe('Initial State Setup', () => {
    it('should initialize currentPageId from initialPageId parameter', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 5), { wrapper });

      // The hook should immediately set currentPageId to initialPageId
      expect(result.current.currentPageId).toBe(5);
    });

    it('should initialize currentPageId as null when no initialPageId provided', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1), { wrapper });

      expect(result.current.currentPageId).toBeNull();
    });

    it('should initialize attemptCount to 0 by default', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      expect(result.current.attemptCount).toBe(0);
    });

    it('should initialize isCompleted to false by default', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      expect(result.current.isCompleted).toBe(false);
    });

    it('should initialize grade to null by default', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      expect(result.current.grade).toBeNull();
    });

    it('should initialize timeRemaining from lesson timelimit', async () => {
      server.use(
        http.get('http://*/api/v1/lesson/:lessonId', () => {
          return HttpResponse.json({
            success: true,
            data: createMockLesson({ timelimit: 1800 }), // 30 minutes
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      // Wait for lesson data to load and update state
      await waitFor(() => {
        expect(result.current.timeRemaining).toBe(1800);
      });
    });

    it('should initialize timeRemaining as null for untimed lessons', async () => {
      server.use(
        http.get('http://*/api/v1/lesson/:lessonId', () => {
          return HttpResponse.json({
            success: true,
            data: createMockLesson({ timelimit: null }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await waitFor(() => {
        expect(result.current.timeRemaining).toBeNull();
      });
    });

    it('should initialize isTimerActive to false by default', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      expect(result.current.isTimerActive).toBe(false);
    });

    it('should initialize lastPageSeen to null by default', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      expect(result.current.lastPageSeen).toBeNull();
    });

    it('should initialize currentRetry to 0 by default', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      expect(result.current.currentRetry).toBe(0);
    });

    it('should initialize isReviewMode to false by default', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      expect(result.current.isReviewMode).toBe(false);
    });

    it('should initialize isSubmitting to false', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      expect(result.current.isSubmitting).toBe(false);
    });

    it('should initialize error to null', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      expect(result.current.error).toBeNull();
    });
  });

  // ==========================================================================
  // Test Group: Page Navigation
  // ==========================================================================

  describe('Page Navigation', () => {
    it('should update currentPageId when navigateToPage is called', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      expect(result.current.currentPageId).toBe(1);

      act(() => {
        result.current.navigateToPage(3);
      });

      expect(result.current.currentPageId).toBe(3);
    });

    it('should update lastPageSeen when navigating to a new page', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      act(() => {
        result.current.navigateToPage(2);
      });

      // lastPageSeen should be the previous currentPageId
      expect(result.current.lastPageSeen).toBe(1);
      expect(result.current.currentPageId).toBe(2);
    });

    it('should track navigation history correctly', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      // Navigate through multiple pages
      act(() => {
        result.current.navigateToPage(2);
      });
      expect(result.current.lastPageSeen).toBe(1);

      act(() => {
        result.current.navigateToPage(3);
      });
      expect(result.current.lastPageSeen).toBe(2);

      act(() => {
        result.current.navigateToPage(4);
      });
      expect(result.current.lastPageSeen).toBe(3);
    });

    it('should invalidate page-specific queries on navigation', async () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      act(() => {
        result.current.navigateToPage(2);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['lessons', 1, 'pages', 2],
      });
    });

    it('should handle navigation to the same page', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      act(() => {
        result.current.navigateToPage(1);
      });

      // Should update but not crash
      expect(result.current.currentPageId).toBe(1);
    });

    it('should preserve lastPageSeen as null when first navigation has no previous page', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, null), { wrapper });

      act(() => {
        result.current.navigateToPage(1);
      });

      // lastPageSeen should remain null since we started with null currentPageId
      expect(result.current.lastPageSeen).toBeNull();
    });
  });

  // ==========================================================================
  // Test Group: Page Response Submission
  // ==========================================================================

  describe('Page Response Submission', () => {
    it('should submit page response and return NavigationResult', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 2,
              isCorrect: true,
              feedback: 'Well done!',
              showFeedback: true,
              isEndOfLesson: false,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      let navigationResult: NavigationResult | undefined;

      await act(async () => {
        navigationResult = await result.current.submitPageResponse(
          1,
          createMockPageResponse()
        );
      });

      expect(navigationResult).toBeDefined();
      expect(navigationResult!.nextPageId).toBe(2);
      expect(navigationResult!.isCorrect).toBe(true);
      expect(navigationResult!.feedback).toBe('Well done!');
      expect(navigationResult!.shouldShowFeedback).toBe(true);
      expect(navigationResult!.isEndOfLesson).toBe(false);
    });

    it('should update currentPageId after successful submission', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({ nextPageId: 3 }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      await waitFor(() => {
        expect(result.current.currentPageId).toBe(3);
      });
    });

    it('should update lastPageSeen after successful submission', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({ nextPageId: 2 }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      await waitFor(() => {
        expect(result.current.lastPageSeen).toBe(1);
      });
    });

    it('should update attemptCount from API response', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({ attemptCount: 2 }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      await waitFor(() => {
        expect(result.current.attemptCount).toBe(2);
      });
    });

    it('should update currentRetry from API response', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({ retryCount: 3 }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      await waitFor(() => {
        expect(result.current.currentRetry).toBe(3);
      });
    });

    it('should set isCompleted when response indicates end of lesson', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              isEndOfLesson: true,
              grade: 85,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      await waitFor(() => {
        expect(result.current.isCompleted).toBe(true);
      });
      expect(result.current.grade).toBe(85);
    });

    it('should set isSubmitting to true during submission', async () => {
      // Use a longer delay to ensure we can catch the isSubmitting state
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', async () => {
          await delay(200);
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult(),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      let submissionPromise: Promise<NavigationResult>;

      // Start the submission without awaiting
      act(() => {
        submissionPromise = result.current.submitPageResponse(
          1,
          createMockPageResponse()
        );
      });

      // isSubmitting should be true during the request - wait for state to update
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(true);
      });

      // Wait for completion
      await act(async () => {
        await submissionPromise;
      });

      // After completion, isSubmitting should be false
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });
    });

    it('should handle submission error and set error state', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json(
            { success: false, error: { message: 'Submission failed' } },
            { status: 500 }
          );
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        try {
          await result.current.submitPageResponse(1, createMockPageResponse());
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBeDefined();
    });

    it('should invalidate queries after successful submission', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult(),
          });
        })
      );

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      // Should invalidate lesson progress and lesson queries
      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('should handle incorrect answer response', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 1, // Stay on same page for retry
              isCorrect: false,
              feedback: 'Try again!',
              retryCount: 1,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      let navigationResult: NavigationResult | undefined;

      await act(async () => {
        navigationResult = await result.current.submitPageResponse(
          1,
          createMockPageResponse()
        );
      });

      expect(navigationResult!.isCorrect).toBe(false);
      expect(navigationResult!.feedback).toBe('Try again!');
      expect(result.current.currentRetry).toBe(1);
    });

    it('should send correct data in request body', async () => {
      let capturedBody: Record<string, unknown> | null = null;

      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult(),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const pageResponse: PageResponse = {
        pageid: 5,
        answerid: 10,
        data: { customField: 'value' },
        timeseen: 45,
      };

      await act(async () => {
        await result.current.submitPageResponse(5, pageResponse);
      });

      expect(capturedBody).toEqual({
        pageid: 5,
        answerid: 10,
        data: { customField: 'value' },
        timeseen: 45,
      });
    });
  });

  // ==========================================================================
  // Test Group: Branching Logic
  // ==========================================================================

  describe('Branching Logic', () => {
    it('should handle LESSON_NEXTPAGE navigation (jumpTo: -1)', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 2, // Server calculates next page
              isCorrect: true,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(navResult.nextPageId).toBe(2);
    });

    it('should handle LESSON_CLUSTERJUMP navigation (jumpTo: -80)', async () => {
      // Server handles cluster jump logic and returns appropriate page
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 5, // Server-calculated cluster jump destination
              isCorrect: true,
              feedback: 'Jumping to cluster page',
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(navResult.nextPageId).toBe(5);
    });

    it('should handle LESSON_UNSEENBRANCHPAGE navigation (jumpTo: -50)', async () => {
      // Server handles unseen branch page logic
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 7, // Random unseen page selected by server
              isCorrect: true,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(navResult.nextPageId).toBe(7);
    });

    it('should handle conditional paths based on correct answer', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 10, // Correct answer path
              isCorrect: true,
              feedback: 'Correct! Proceeding to advanced content.',
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(navResult.nextPageId).toBe(10);
      expect(navResult.isCorrect).toBe(true);
    });

    it('should handle conditional paths based on incorrect answer', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 5, // Incorrect answer path (remediation)
              isCorrect: false,
              feedback: 'Incorrect. Please review this content.',
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(navResult.nextPageId).toBe(5);
      expect(navResult.isCorrect).toBe(false);
    });

    it('should handle LESSON_EOL navigation (jumpTo: -9)', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: null, // End of lesson
              isCorrect: true,
              isEndOfLesson: true,
              grade: 100,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(navResult.nextPageId).toBeNull();
      expect(navResult.isEndOfLesson).toBe(true);
      expect(result.current.isCompleted).toBe(true);
    });

    it('should handle LESSON_PREVIOUSPAGE navigation (jumpTo: -2)', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 1, // Previous page
              isCorrect: true,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 2), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(2, createMockPageResponse({ pageid: 2 }));
      });

      expect(navResult.nextPageId).toBe(1);
    });

    it('should handle LESSON_THISPAGE navigation (jumpTo: 0)', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 1, // Stay on same page
              isCorrect: false,
              feedback: 'Try again on this page',
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(navResult.nextPageId).toBe(1);
    });

    it('should verify exported LESSON_JUMP_CONSTANTS values', () => {
      expect(LESSON_THISPAGE).toBe(0);
      expect(LESSON_NEXTPAGE).toBe(-1);
      expect(LESSON_PREVIOUSPAGE).toBe(-2);
      expect(LESSON_EOL).toBe(-9);
      expect(LESSON_UNSEENBRANCHPAGE).toBe(-50);
      expect(LESSON_RANDOMPAGE).toBe(-60);
      expect(LESSON_RANDOMBRANCH).toBe(-70);
      expect(LESSON_CLUSTERJUMP).toBe(-80);
    });
  });

  // ==========================================================================
  // Test Group: Timer Management
  // ==========================================================================

  describe('Timer Management', () => {
    // Timer tests need fake timers for testing timer-specific behavior
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('startTimer', () => {
      it('should call POST /api/v1/lesson/{id}/timer/start', async () => {
        let startCalled = false;

        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
            startCalled = true;
            return HttpResponse.json({
              success: true,
              data: createMockTimerData(),
            });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await act(async () => {
          await result.current.startTimer();
        });

        expect(startCalled).toBe(true);
      });

      it('should set isTimerActive to true after starting', async () => {
        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
            return HttpResponse.json({
              success: true,
              data: createMockTimerData(),
            });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        expect(result.current.isTimerActive).toBe(false);

        await act(async () => {
          await result.current.startTimer();
        });

        // Wait for state update to propagate after mutation completes
        await waitFor(() => {
          expect(result.current.isTimerActive).toBe(true);
        });
      });

      it('should calculate timeRemaining from starttime and lessontime', async () => {
        const now = Math.floor(Date.now() / 1000);
        const starttime = now - 300; // Started 5 minutes ago
        const lessontime = 1800; // 30 minutes total

        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
            return HttpResponse.json({
              success: true,
              data: {
                starttime,
                lessontime,
                isActive: true,
              },
            });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await act(async () => {
          await result.current.startTimer();
        });

        // Wait for state update and verify timeRemaining calculation
        // timeRemaining should be lessontime - elapsed (1800 - 300 = 1500)
        await waitFor(() => {
          expect(result.current.timeRemaining).toBe(1500);
        });
      });

      it('should handle timer start error', async () => {
        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
            return HttpResponse.json({ success: false }, { status: 500 });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await act(async () => {
          try {
            await result.current.startTimer();
          } catch {
            // Expected
          }
        });

        expect(result.current.error).toBeDefined();
        expect(result.current.isTimerActive).toBe(false);
      });
    });

    describe('stopTimer', () => {
      it('should call POST /api/v1/lesson/{id}/timer/stop', async () => {
        let stopCalled = false;

        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
            return HttpResponse.json({
              success: true,
              data: createMockTimerData(),
            });
          }),
          http.post('http://*/api/v1/lesson/:lessonId/timer/stop', () => {
            stopCalled = true;
            return HttpResponse.json({ success: true });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await act(async () => {
          await result.current.startTimer();
        });

        await act(async () => {
          await result.current.stopTimer();
        });

        expect(stopCalled).toBe(true);
      });

      it('should set isTimerActive to false after stopping', async () => {
        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
            return HttpResponse.json({
              success: true,
              data: createMockTimerData(),
            });
          }),
          http.post('http://*/api/v1/lesson/:lessonId/timer/stop', () => {
            return HttpResponse.json({ success: true });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await act(async () => {
          await result.current.startTimer();
        });

        // Wait for start state to propagate
        await waitFor(() => {
          expect(result.current.isTimerActive).toBe(true);
        });

        await act(async () => {
          await result.current.stopTimer();
        });

        // Wait for stop state to propagate
        await waitFor(() => {
          expect(result.current.isTimerActive).toBe(false);
        });
      });

      it('should handle timer stop error', async () => {
        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
            return HttpResponse.json({
              success: true,
              data: createMockTimerData(),
            });
          }),
          http.post('http://*/api/v1/lesson/:lessonId/timer/stop', () => {
            return HttpResponse.json({ success: false }, { status: 500 });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await act(async () => {
          await result.current.startTimer();
        });

        await act(async () => {
          try {
            await result.current.stopTimer();
          } catch {
            // Expected
          }
        });

        expect(result.current.error).toBeDefined();
      });
    });

    describe('Timer Countdown', () => {
      it('should decrement timeRemaining every second when timer is active', async () => {
        const now = Math.floor(Date.now() / 1000);

        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
            return HttpResponse.json({
              success: true,
              data: {
                starttime: now,
                lessontime: 60, // 60 seconds
                isActive: true,
              },
            });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await act(async () => {
          await result.current.startTimer();
        });

        // Wait for state update to propagate
        await waitFor(() => {
          expect(result.current.timeRemaining).toBe(60);
        });

        // Advance timer by 1 second
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });

        await waitFor(() => {
          expect(result.current.timeRemaining).toBe(59);
        });

        // Advance by 5 more seconds
        await act(async () => {
          vi.advanceTimersByTime(5000);
        });

        await waitFor(() => {
          expect(result.current.timeRemaining).toBe(54);
        });
      });

      it('should stop decrementing when timeRemaining reaches 0', async () => {
        const now = Math.floor(Date.now() / 1000);

        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
            return HttpResponse.json({
              success: true,
              data: {
                starttime: now,
                lessontime: 3, // 3 seconds
                isActive: true,
              },
            });
          }),
          http.post('http://*/api/v1/lesson/:lessonId/timer/expired', () => {
            return HttpResponse.json({
              success: true,
              data: { grade: 50 },
            });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await act(async () => {
          await result.current.startTimer();
        });

        // Wait for timer to be active first
        await waitFor(() => {
          expect(result.current.isTimerActive).toBe(true);
        });

        // Advance beyond the timer limit
        await act(async () => {
          vi.advanceTimersByTime(5000);
        });

        await waitFor(() => {
          expect(result.current.timeRemaining).toBe(0);
        });
      });

      it('should not run timer countdown when isTimerActive is false', async () => {
        server.use(
          http.get('http://*/api/v1/lesson/:lessonId', () => {
            return HttpResponse.json({
              success: true,
              data: createMockLesson({ timelimit: 60 }),
            });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await waitFor(() => {
          expect(result.current.timeRemaining).toBe(60);
        });

        // Timer is not active, so advancing time should not change timeRemaining
        act(() => {
          vi.advanceTimersByTime(5000);
        });

        // timeRemaining should remain unchanged
        expect(result.current.timeRemaining).toBe(60);
      });
    });

    describe('handleTimerExpiration', () => {
      it('should call POST /api/v1/lesson/{id}/timer/expired', async () => {
        let expiredCalled = false;

        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/expired', () => {
            expiredCalled = true;
            return HttpResponse.json({
              success: true,
              data: { grade: 75 },
            });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await act(async () => {
          await result.current.handleTimerExpiration();
        });

        expect(expiredCalled).toBe(true);
      });

      it('should set isCompleted to true after timer expiration', async () => {
        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/expired', () => {
            return HttpResponse.json({
              success: true,
              data: { grade: 75 },
            });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await act(async () => {
          await result.current.handleTimerExpiration();
        });

        expect(result.current.isCompleted).toBe(true);
      });

      it('should set grade from expiration response', async () => {
        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/expired', () => {
            return HttpResponse.json({
              success: true,
              data: { grade: 82 },
            });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await act(async () => {
          await result.current.handleTimerExpiration();
        });

        expect(result.current.grade).toBe(82);
      });

      it('should set isTimerActive to false after expiration', async () => {
        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
            return HttpResponse.json({
              success: true,
              data: createMockTimerData(),
            });
          }),
          http.post('http://*/api/v1/lesson/:lessonId/timer/expired', () => {
            return HttpResponse.json({
              success: true,
              data: { grade: 75 },
            });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await act(async () => {
          await result.current.startTimer();
        });

        await waitFor(() => {
          expect(result.current.isTimerActive).toBe(true);
        });

        await act(async () => {
          await result.current.handleTimerExpiration();
        });

        await waitFor(() => {
          expect(result.current.isTimerActive).toBe(false);
        });
      });

      it('should set timeRemaining to 0 after expiration', async () => {
        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
            return HttpResponse.json({
              success: true,
              data: createMockTimerData(),
            });
          }),
          http.post('http://*/api/v1/lesson/:lessonId/timer/expired', () => {
            return HttpResponse.json({
              success: true,
              data: { grade: 75 },
            });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await act(async () => {
          await result.current.startTimer();
        });

        await waitFor(() => {
          expect(result.current.isTimerActive).toBe(true);
        });

        await act(async () => {
          await result.current.handleTimerExpiration();
        });

        await waitFor(() => {
          expect(result.current.timeRemaining).toBe(0);
        });
      });

      it('should auto-trigger expiration when timer reaches 0', async () => {
        const now = Math.floor(Date.now() / 1000);
        let expiredCalled = false;

        server.use(
          http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
            return HttpResponse.json({
              success: true,
              data: {
                starttime: now,
                lessontime: 2, // 2 seconds
                isActive: true,
              },
            });
          }),
          http.post('http://*/api/v1/lesson/:lessonId/timer/expired', () => {
            expiredCalled = true;
            return HttpResponse.json({
              success: true,
              data: { grade: 60 },
            });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await act(async () => {
          await result.current.startTimer();
        });

        // Wait for timer to be active first
        await waitFor(() => {
          expect(result.current.isTimerActive).toBe(true);
        });

        // Advance to expire the timer
        await act(async () => {
          vi.advanceTimersByTime(3000);
        });

        await waitFor(() => {
          expect(expiredCalled).toBe(true);
        });

        await waitFor(() => {
          expect(result.current.isCompleted).toBe(true);
        });
      });
    });

    describe('Timer with No Time Limit', () => {
      it('should not activate timer for lesson with no time limit', async () => {
        server.use(
          http.get('http://*/api/v1/lesson/:lessonId', () => {
            return HttpResponse.json({
              success: true,
              data: createMockLesson({ timelimit: null }),
            });
          })
        );

        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        await waitFor(() => {
          expect(result.current.timeRemaining).toBeNull();
        });

        expect(result.current.isTimerActive).toBe(false);
      });

      it('should not countdown when timeRemaining is null', async () => {
        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

        expect(result.current.timeRemaining).toBeNull();

        act(() => {
          vi.advanceTimersByTime(5000);
        });

        expect(result.current.timeRemaining).toBeNull();
      });
    });
  });

  // ==========================================================================
  // Test Group: Progress Calculation
  // ==========================================================================

  describe('Progress Calculation', () => {
    it('should return 0 when lesson data is not loaded', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      // Before lesson data loads
      expect(result.current.getProgressPercentage()).toBe(0);
    });

    it('should return 100 when lesson is completed', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              isEndOfLesson: true,
              grade: 100,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(result.current.isCompleted).toBe(true);
      expect(result.current.getProgressPercentage()).toBe(100);
    });

    it('should return 0 when not completed and no progress data', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await waitFor(() => {
        expect(result.current.currentPageId).toBeDefined();
      });

      expect(result.current.getProgressPercentage()).toBe(0);
    });
  });

  // ==========================================================================
  // Test Group: Retry Logic
  // ==========================================================================

  describe('Retry Logic', () => {
    it('should return false for canRetry when lesson data not loaded', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      expect(result.current.canRetry()).toBe(false);
    });

    it('should return true for canRetry when maxattempts is 0 (unlimited)', async () => {
      server.use(
        http.get('http://*/api/v1/lesson/:lessonId', () => {
          return HttpResponse.json({
            success: true,
            data: createMockLesson({ maxattempts: 0 }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await waitFor(() => {
        expect(result.current.canRetry()).toBe(true);
      });
    });

    it('should return true when currentRetry < maxattempts', async () => {
      server.use(
        http.get('http://*/api/v1/lesson/:lessonId', () => {
          return HttpResponse.json({
            success: true,
            data: createMockLesson({ maxattempts: 3 }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await waitFor(() => {
        expect(result.current.canRetry()).toBe(true);
      });

      // currentRetry is 0, maxattempts is 3, so can retry
      expect(result.current.currentRetry).toBe(0);
      expect(result.current.canRetry()).toBe(true);
    });

    it('should return false when currentRetry >= maxattempts', async () => {
      server.use(
        http.get('http://*/api/v1/lesson/:lessonId', () => {
          return HttpResponse.json({
            success: true,
            data: createMockLesson({ maxattempts: 2 }),
          });
        }),
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              retryCount: 2, // Reached max
              isCorrect: false,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await waitFor(() => {
        expect(result.current.canRetry()).toBe(true);
      });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(result.current.currentRetry).toBe(2);
      expect(result.current.canRetry()).toBe(false);
    });

    it('should handle different maxattempts values', async () => {
      // Test with maxattempts = 1
      server.use(
        http.get('http://*/api/v1/lesson/:lessonId', () => {
          return HttpResponse.json({
            success: true,
            data: createMockLesson({ maxattempts: 1 }),
          });
        }),
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({ retryCount: 1 }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await waitFor(() => {
        expect(result.current.canRetry()).toBe(true);
      });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(result.current.canRetry()).toBe(false);
    });
  });

  // ==========================================================================
  // Test Group: Review Mode
  // ==========================================================================

  describe('Review Mode', () => {
    it('should initialize isReviewMode to false', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      expect(result.current.isReviewMode).toBe(false);
    });

    it('should not modify isReviewMode during normal navigation', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      act(() => {
        result.current.navigateToPage(2);
      });

      expect(result.current.isReviewMode).toBe(false);
    });

    it('should maintain isReviewMode state through submissions', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult(),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(result.current.isReviewMode).toBe(false);
    });
  });

  // ==========================================================================
  // Test Group: State Persistence
  // ==========================================================================

  describe('State Persistence', () => {
    it('should preserve state between re-renders', async () => {
      const { wrapper } = createWrapper();
      const { result, rerender } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      act(() => {
        result.current.navigateToPage(3);
      });

      expect(result.current.currentPageId).toBe(3);

      rerender();

      expect(result.current.currentPageId).toBe(3);
    });

    it('should preserve lastPageSeen through re-renders', async () => {
      const { wrapper } = createWrapper();
      const { result, rerender } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      act(() => {
        result.current.navigateToPage(2);
      });

      expect(result.current.lastPageSeen).toBe(1);

      rerender();

      expect(result.current.lastPageSeen).toBe(1);
    });

    it('should maintain attemptCount after submissions', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({ attemptCount: 5 }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result, rerender } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(result.current.attemptCount).toBe(5);

      rerender();

      expect(result.current.attemptCount).toBe(5);
    });

    it('should preserve timer state through re-renders', async () => {
      const now = Math.floor(Date.now() / 1000);

      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
          return HttpResponse.json({
            success: true,
            data: {
              starttime: now,
              lessontime: 300,
              isActive: true,
            },
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result, rerender } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.startTimer();
      });

      expect(result.current.isTimerActive).toBe(true);
      const initialTimeRemaining = result.current.timeRemaining;

      rerender();

      expect(result.current.isTimerActive).toBe(true);
      expect(result.current.timeRemaining).toBe(initialTimeRemaining);
    });
  });

  // ==========================================================================
  // Test Group: Completion Tracking
  // ==========================================================================

  describe('Completion Tracking', () => {
    it('should set isCompleted when navigating to EOL', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: null,
              isEndOfLesson: true,
              grade: 95,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 4), { wrapper });

      expect(result.current.isCompleted).toBe(false);

      await act(async () => {
        await result.current.submitPageResponse(4, createMockPageResponse({ pageid: 4 }));
      });

      expect(result.current.isCompleted).toBe(true);
    });

    it('should set final grade on completion', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              isEndOfLesson: true,
              grade: 87.5,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(result.current.grade).toBe(87.5);
    });

    it('should detect EOL from nextPageId being null', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: null,
              isEndOfLesson: true,
              grade: 100,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(navResult.nextPageId).toBeNull();
      expect(navResult.isEndOfLesson).toBe(true);
      expect(result.current.isCompleted).toBe(true);
    });

    it('should handle completion with grade of 0', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              isEndOfLesson: true,
              grade: 0,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(result.current.isCompleted).toBe(true);
      expect(result.current.grade).toBe(0);
    });

    it('should handle completion with null grade', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              isEndOfLesson: true,
              grade: null,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(result.current.isCompleted).toBe(true);
      expect(result.current.grade).toBeNull();
    });
  });

  // ==========================================================================
  // Test Group: Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle page submission during timer expiration race condition', async () => {
      // This test validates that a submission in progress completes even if timer expires
      const now = Math.floor(Date.now() / 1000);
      let submissionCount = 0;

      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
          return HttpResponse.json({
            success: true,
            data: {
              starttime: now,
              lessontime: 1, // 1 second
              isActive: true,
            },
          });
        }),
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', async () => {
          submissionCount++;
          // Small delay to simulate network latency
          await delay(50);
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult(),
          });
        }),
        http.post('http://*/api/v1/lesson/:lessonId/timer/expired', () => {
          return HttpResponse.json({
            success: true,
            data: { grade: 50 },
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      // Start timer
      await act(async () => {
        await result.current.startTimer();
      });

      // Wait for timer to activate
      await waitFor(() => {
        expect(result.current.isTimerActive).toBe(true);
      });

      // Start and complete submission
      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      // Submission should have been processed
      expect(submissionCount).toBe(1);
    });

    it('should handle branching to non-existent page ID (server error)', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'PAGE_NOT_FOUND', message: 'Target page does not exist' },
            },
            { status: 404 }
          );
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        try {
          await result.current.submitPageResponse(1, createMockPageResponse());
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle cluster jump with no unseen pages in cluster', async () => {
      // Server returns EOL when no unseen pages in cluster
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: null,
              isEndOfLesson: true,
              feedback: 'All pages in cluster have been viewed',
              grade: 100,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(navResult.isEndOfLesson).toBe(true);
      expect(result.current.isCompleted).toBe(true);
    });

    it('should handle timer with lesson having zero time limit', async () => {
      server.use(
        http.get('http://*/api/v1/lesson/:lessonId', () => {
          return HttpResponse.json({
            success: true,
            data: createMockLesson({ timelimit: 0 }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await waitFor(() => {
        // timelimit of 0 should be treated as no limit
        expect(result.current.timeRemaining).toBeNull();
      });
    });

    it('should handle multiple rapid page submissions', async () => {
      let submissionCount = 0;

      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', async () => {
          submissionCount++;
          // Small delay to simulate network latency
          await delay(10);
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: submissionCount + 1,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      // Fire multiple submissions rapidly
      const promises = [
        result.current.submitPageResponse(1, createMockPageResponse()),
        result.current.submitPageResponse(1, createMockPageResponse()),
        result.current.submitPageResponse(1, createMockPageResponse()),
      ];

      // Wait for all submissions to complete using real time
      await act(async () => {
        await Promise.all(promises);
      });

      // All submissions should have been processed
      expect(submissionCount).toBe(3);
    });

    it('should handle conditional navigation with complex branching', async () => {
      // Simulate a complex branching scenario
      const responses = [
        { nextPageId: 5, isCorrect: true },   // First correct -> page 5
        { nextPageId: 7, isCorrect: false },  // Second incorrect -> page 7
        { nextPageId: 3, isCorrect: true },   // Third correct -> page 3
      ];
      let responseIndex = 0;

      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          const response = responses[responseIndex % responses.length];
          responseIndex++;
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult(response),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      // First submission
      let navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });
      expect(navResult.nextPageId).toBe(5);
      await waitFor(() => {
        expect(result.current.currentPageId).toBe(5);
      });

      // Second submission
      navResult = await act(async () => {
        return result.current.submitPageResponse(5, createMockPageResponse({ pageid: 5 }));
      });
      expect(navResult.nextPageId).toBe(7);
      await waitFor(() => {
        expect(result.current.currentPageId).toBe(7);
      });

      // Third submission
      navResult = await act(async () => {
        return result.current.submitPageResponse(7, createMockPageResponse({ pageid: 7 }));
      });
      expect(navResult.nextPageId).toBe(3);
      await waitFor(() => {
        expect(result.current.currentPageId).toBe(3);
      });
    });

    it('should handle network failure during submission', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.error();
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        try {
          await result.current.submitPageResponse(1, createMockPageResponse());
        } catch {
          // Expected network error
        }
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should cleanup timer interval on unmount', async () => {
      const now = Math.floor(Date.now() / 1000);
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/timer/start', () => {
          return HttpResponse.json({
            success: true,
            data: {
              starttime: now,
              lessontime: 3600,
              isActive: true,
            },
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result, unmount } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.startTimer();
      });

      await waitFor(() => {
        expect(result.current.isTimerActive).toBe(true);
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should handle essay type response (answerid is null)', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 2,
              isCorrect: true, // Essays typically auto-pass
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const essayResponse: PageResponse = {
        pageid: 1,
        answerid: null, // Essay type has no specific answer ID
        data: { essayText: 'This is my essay response.' },
        timeseen: 120,
      };

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, essayResponse);
      });

      expect(navResult.nextPageId).toBe(2);
    });

    it('should handle matching type response (multiple answers)', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 2,
              isCorrect: true,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const matchingResponse: PageResponse = {
        pageid: 1,
        answerid: null,
        data: {
          matches: {
            'item1': 'answer1',
            'item2': 'answer2',
            'item3': 'answer3',
          },
        },
        timeseen: 60,
      };

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, matchingResponse);
      });

      expect(navResult.isCorrect).toBe(true);
    });

    it('should handle numerical response type', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 2,
              isCorrect: true,
              feedback: 'Correct! 42 is the answer.',
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const numericalResponse: PageResponse = {
        pageid: 1,
        answerid: null,
        data: { numericAnswer: 42 },
        timeseen: 30,
      };

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, numericalResponse);
      });

      expect(navResult.feedback).toBe('Correct! 42 is the answer.');
    });
  });

  // ==========================================================================
  // Test Group: TypeScript Interface Validation
  // ==========================================================================

  describe('TypeScript Interface Validation', () => {
    it('should validate LessonProgressState interface structure', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      // Type check: all properties should exist with correct types
      expect(typeof result.current.currentPageId === 'number' || result.current.currentPageId === null).toBe(true);
      expect(typeof result.current.attemptCount).toBe('number');
      expect(typeof result.current.isCompleted).toBe('boolean');
      expect(typeof result.current.grade === 'number' || result.current.grade === null).toBe(true);
      expect(typeof result.current.timeRemaining === 'number' || result.current.timeRemaining === null).toBe(true);
      expect(typeof result.current.isTimerActive).toBe('boolean');
      expect(typeof result.current.lastPageSeen === 'number' || result.current.lastPageSeen === null).toBe(true);
      expect(typeof result.current.currentRetry).toBe('number');
      expect(typeof result.current.isReviewMode).toBe('boolean');
    });

    it('should validate NavigationResult interface structure', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult(),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      // Type check: all properties should exist with correct types
      expect(typeof navResult.nextPageId === 'number' || navResult.nextPageId === null).toBe(true);
      expect(typeof navResult.isCorrect).toBe('boolean');
      expect(typeof navResult.feedback).toBe('string');
      expect(typeof navResult.shouldShowFeedback).toBe('boolean');
      expect(typeof navResult.isEndOfLesson).toBe('boolean');
    });

    it('should validate PageResponse interface structure', () => {
      const pageResponse: PageResponse = {
        pageid: 1,
        answerid: 2,
        data: { key: 'value' },
        timeseen: 30,
      };

      expect(typeof pageResponse.pageid).toBe('number');
      expect(typeof pageResponse.answerid === 'number' || pageResponse.answerid === null).toBe(true);
      expect(typeof pageResponse.data).toBe('object');
      expect(typeof pageResponse.timeseen).toBe('number');
    });

    it('should validate hook return type includes all action methods', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      expect(typeof result.current.navigateToPage).toBe('function');
      expect(typeof result.current.submitPageResponse).toBe('function');
      expect(typeof result.current.startTimer).toBe('function');
      expect(typeof result.current.stopTimer).toBe('function');
      expect(typeof result.current.handleTimerExpiration).toBe('function');
      expect(typeof result.current.getProgressPercentage).toBe('function');
      expect(typeof result.current.canRetry).toBe('function');
    });

    it('should validate hook return type includes mutation state', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      expect(typeof result.current.isSubmitting).toBe('boolean');
      expect(result.current.error === null || result.current.error instanceof Error).toBe(true);
    });
  });

  // ==========================================================================
  // Test Group: Moodle Function Reference Tests
  // ==========================================================================

  describe('Moodle Function References', () => {
    /**
     * These tests verify that the hook correctly interfaces with API endpoints
     * that wrap Moodle core functions from locallib.php and view.php
     */

    it('should handle process_page_responses equivalent (view.php lines 94-197)', async () => {
      // Moodle's process_page_responses handles answer processing
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 2,
              isCorrect: true,
              feedback: 'Response processed successfully',
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(navResult.nextPageId).toBe(2);
      expect(navResult.isCorrect).toBe(true);
    });

    it('should handle cluster_jump equivalent (locallib.php lines 2158-2280)', async () => {
      // Moodle's cluster_jump handles navigation within clusters
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 15, // Cluster page selected by server
              isCorrect: true,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(navResult.nextPageId).toBe(15);
    });

    it('should handle calculate_new_page_on_jump equivalent (locallib.php lines 2516-2639)', async () => {
      // Moodle's calculate_new_page_on_jump handles jump destination calculation
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 8, // Calculated jump destination
              isCorrect: false,
              feedback: 'Please review and try again',
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(navResult.nextPageId).toBe(8);
    });

    it('should handle lesson_unseen_question_jump equivalent (locallib.php lines 2970-3021)', async () => {
      // Moodle's lesson_unseen_question_jump returns a random unseen question
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 12, // Random unseen question
              isCorrect: true,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(navResult.nextPageId).toBe(12);
    });

    it('should handle lesson_unseen_branch_jump equivalent (locallib.php lines 3407-3500)', async () => {
      // Moodle's lesson_unseen_branch_jump returns a random unseen branch
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              nextPageId: 20, // Random unseen branch
              isCorrect: true,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      const navResult = await act(async () => {
        return result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(navResult.nextPageId).toBe(20);
    });

    it('should handle continue.php page continuation logic (lines 51-74)', async () => {
      // Moodle's continue.php handles lesson continuation from last page seen
      server.use(
        http.get('http://*/api/v1/lesson/:lessonId', () => {
          return HttpResponse.json({
            success: true,
            data: createMockLesson(),
          });
        })
      );

      const { wrapper } = createWrapper();
      
      // Simulating continuation with initialPageId being the last page seen
      const { result } = renderHook(() => useLessonProgress(1, 3), { wrapper });

      // Should start from the provided initial page (last seen)
      expect(result.current.currentPageId).toBe(3);
    });
  });

  // ==========================================================================
  // Test Group: Score and Grade Aggregation
  // ==========================================================================

  describe('Score and Grade Aggregation', () => {
    it('should handle grade aggregation from server', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              isEndOfLesson: true,
              grade: 87.5, // Aggregated grade from all questions
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(result.current.grade).toBe(87.5);
    });

    it('should handle perfect score', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              isEndOfLesson: true,
              grade: 100,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(result.current.grade).toBe(100);
    });

    it('should handle zero score', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              isEndOfLesson: true,
              grade: 0,
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(result.current.grade).toBe(0);
    });

    it('should handle decimal grade values', async () => {
      server.use(
        http.post('http://*/api/v1/lesson/:lessonId/pages/:pageId/response', () => {
          return HttpResponse.json({
            success: true,
            data: createMockPageResponseApiResult({
              isEndOfLesson: true,
              grade: 66.67, // 2/3 correct
            }),
          });
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLessonProgress(1, 1), { wrapper });

      await act(async () => {
        await result.current.submitPageResponse(1, createMockPageResponse());
      });

      expect(result.current.grade).toBe(66.67);
    });
  });
});
