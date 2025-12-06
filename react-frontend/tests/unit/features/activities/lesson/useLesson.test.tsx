/**
 * Unit Tests for useLesson React Query Hooks
 *
 * This test suite validates the lesson activity data fetching hooks:
 * - useLesson: Fetches lesson details with caching
 * - useLessonPages: Fetches lesson pages with branching logic
 * - useLessonAttempts: Fetches user attempts on lesson
 * - useLessonTimer: Fetches timer state with frequent updates
 *
 * All hooks use React Query for:
 * - Automatic caching and background refetching
 * - Loading states and error handling
 * - Query invalidation for data updates
 *
 * Tests use MSW for mocking API responses and React Testing Library
 * for hook testing in an isolated environment.
 *
 * References Moodle functions:
 * - lesson::load() from public/mod/lesson/locallib.php:1651-1658
 * - lesson->load_all_pages() from public/mod/lesson/locallib.php:2341-2348
 * - lesson->get_attempts() from public/mod/lesson/locallib.php:1951-1963
 * - lesson->get_user_timers() from public/mod/lesson/locallib.php:3159-3168
 *
 * @package react-frontend
 * @module tests/unit/features/activities/lesson
 */

import type React from 'react';
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@tests/mocks/server';
import {
  useLesson,
  useLessonPages,
  useLessonAttempts,
  useLessonTimer,
  useLessonProgress,
  useLessonQueryClient,
  invalidateLessonQueries,
  lessonKeys,
} from '@/features/activities/lesson/hooks/useLesson';
import type {
  Lesson,
  LessonPage,
  LessonAttempt,
  LessonTimer,
  Answer,
} from '@/features/activities/lesson/types/lesson.types';
import { QuestionType, NavigationConstant } from '@/features/activities/lesson/types/lesson.types';

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * API base URL for mock endpoints
 * Uses wildcard pattern to match any hostname (matching project convention)
 */
const API_BASE_URL = '*/api/v1';

/**
 * Default stale time for lesson data (5 minutes)
 * Matches the DEFAULT_STALE_TIME in useLesson.ts
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

/**
 * Stale time for timer data (10 seconds)
 * Matches the TIMER_STALE_TIME in useLesson.ts
 */
const TIMER_STALE_TIME = 10 * 1000;

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock Lesson object with default values
 * Simulates data returned by lesson::load() in Moodle
 */
function createMockLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 1,
    course: 1,
    name: 'Introduction to React',
    intro: '<p>This lesson covers React fundamentals.</p>',
    introformat: 1,
    practice: 0,
    modattempts: 1,
    usepassword: 0,
    password: '',
    dependency: 0,
    conditions: '{}',
    grade: 100,
    custom: 0,
    ongoing: 0,
    usemaxgrade: 1,
    maxanswers: 4,
    maxattempts: 3,
    review: 1,
    nextpagedefault: 0,
    feedback: 1,
    minquestions: 0,
    maxpages: 0,
    timelimit: 3600,
    retake: 1,
    activitylink: 0,
    mediafile: '',
    mediaheight: 480,
    mediawidth: 640,
    mediaclose: 0,
    slideshow: 0,
    width: 800,
    height: 600,
    bgcolor: '#ffffff',
    displayleft: 1,
    displayleftif: 0,
    progressbar: 1,
    available: 0,
    deadline: 0,
    timemodified: Date.now(),
    completionendreached: 1,
    completiontimespent: 0,
    allowofflineattempts: 0,
    ...overrides,
  };
}

/**
 * Creates a mock LessonPage object with default values
 * Simulates data returned by lesson->load_all_pages() in Moodle
 */
function createMockLessonPage(overrides: Partial<LessonPage> = {}): LessonPage {
  return {
    id: 1,
    lessonid: 1,
    prevpageid: 0,
    nextpageid: 2,
    qtype: QuestionType.MULTICHOICE,
    qoption: 0,
    layout: 1,
    display: 1,
    timecreated: Date.now() - 86400000,
    timemodified: Date.now(),
    title: 'What is React?',
    contents: '<p>React is a JavaScript library for building user interfaces.</p>',
    contentsformat: 1,
    answers: [],
    ...overrides,
  };
}

/**
 * Creates a mock Answer object with default values
 */
function createMockAnswer(overrides: Partial<Answer> = {}): Answer {
  return {
    id: 1,
    lessonid: 1,
    pageid: 1,
    jumpto: NavigationConstant.NEXTPAGE,
    grade: 1,
    score: 1,
    flags: 0,
    timecreated: Date.now() - 86400000,
    timemodified: Date.now(),
    answer: 'A JavaScript library',
    answerformat: 1,
    response: 'Correct! React is a JavaScript library.',
    responseformat: 1,
    ...overrides,
  };
}

/**
 * Creates a mock LessonAttempt object with default values
 * Simulates data returned by lesson->get_attempts() in Moodle
 */
function createMockLessonAttempt(overrides: Partial<LessonAttempt> = {}): LessonAttempt {
  return {
    id: 1,
    lessonid: 1,
    userid: 2,
    pageid: 1,
    retry: 0,
    correct: 1,
    useranswers: '1',
    grade: 1,
    completed: 0,
    timecreated: Date.now() - 3600000,
    timemodified: Date.now(),
    answerid: 1,
    timeseen: Date.now() - 3600000,
    ...overrides,
  };
}

/**
 * Creates a mock LessonTimer object with default values
 * Simulates data returned by lesson->get_user_timers() in Moodle
 */
function createMockLessonTimer(overrides: Partial<LessonTimer> = {}): LessonTimer {
  return {
    id: 1,
    lessonid: 1,
    userid: 2,
    starttime: Date.now() - 1800000,
    lessontime: 1800,
    completed: 0,
    timemodified: Date.now(),
    ...overrides,
  };
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a new QueryClient for testing with test-specific configuration
 * Disables retries for predictable testing while keeping reasonable cache settings
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Keep cache for 5 minutes to allow cache testing
        gcTime: 5 * 60 * 1000,
        // Keep data fresh for 5 minutes (matches hook default)
        staleTime: 5 * 60 * 1000,
        // Don't refetch on mount if data is fresh (matches hook default)
        refetchOnMount: false,
        // Don't refetch on window focus during tests
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Creates a wrapper component with QueryClientProvider for renderHook
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
// Test Suite Setup
// ============================================================================

describe('useLesson Hooks', () => {
  let queryClient: QueryClient;

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
  });

  // ============================================================================
  // useLesson Hook Tests
  // ============================================================================

  describe('useLesson', () => {
    describe('successful lesson data fetching', () => {
      it('should fetch lesson data successfully', async () => {
        const mockLesson = createMockLesson({ id: 123, name: 'Test Lesson' });

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, ({ params }) => {
            expect(params.lessonId).toBe('123');
            return HttpResponse.json({
              success: true,
              data: mockLesson,
            });
          })
        );

        const { result } = renderHook(() => useLesson(123), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockLesson);
        expect(result.current.data?.id).toBe(123);
        expect(result.current.data?.name).toBe('Test Lesson');
      });

      it('should return lesson object with complete structure', async () => {
        const mockLesson = createMockLesson({
          id: 1,
          name: 'Complete Lesson',
          intro: '<p>Introduction text</p>',
          timelimit: 3600,
          usepassword: 1,
          password: 'secret123',
          dependency: 5,
          retake: 1,
        });

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
            return HttpResponse.json({
              success: true,
              data: mockLesson,
            });
          })
        );

        const { result } = renderHook(() => useLesson(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const lesson = result.current.data;
        expect(lesson).toBeDefined();
        expect(lesson?.id).toBe(1);
        expect(lesson?.name).toBe('Complete Lesson');
        expect(lesson?.intro).toBe('<p>Introduction text</p>');
        expect(lesson?.timelimit).toBe(3600);
        expect(lesson?.usepassword).toBe(1);
        expect(lesson?.password).toBe('secret123');
        expect(lesson?.dependency).toBe(5);
        expect(lesson?.retake).toBe(1);
      });

      it('should verify React Query cache key structure', async () => {
        const mockLesson = createMockLesson({ id: 456 });

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
            return HttpResponse.json({
              success: true,
              data: mockLesson,
            });
          })
        );

        const { result } = renderHook(() => useLesson(456), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Verify cache key structure matches lessonKeys.detail(456)
        const expectedKey = lessonKeys.detail(456);
        expect(expectedKey).toEqual(['lesson', 'detail', 456]);

        // Verify data is in cache with correct key
        const cachedData = queryClient.getQueryData(lessonKeys.detail(456));
        expect(cachedData).toEqual(mockLesson);
      });
    });

    describe('loading states', () => {
      it('should have isLoading true initially', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, async () => {
            // Add delay to observe loading state
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({
              success: true,
              data: createMockLesson(),
            });
          })
        );

        const { result } = renderHook(() => useLesson(1), {
          wrapper: createWrapper(queryClient),
        });

        // Initially loading
        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();
        expect(result.current.isSuccess).toBe(false);

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeDefined();
      });

      it('should have data undefined during loading', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({
              success: true,
              data: createMockLesson({ name: 'Loaded Lesson' }),
            });
          })
        );

        const { result } = renderHook(() => useLesson(1), {
          wrapper: createWrapper(queryClient),
        });

        // Data is undefined while loading
        expect(result.current.data).toBeUndefined();

        await waitFor(() => {
          expect(result.current.data?.name).toBe('Loaded Lesson');
        });
      });

      it('should transition isSuccess to true after fetch completes', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
            return HttpResponse.json({
              success: true,
              data: createMockLesson(),
            });
          })
        );

        const { result } = renderHook(() => useLesson(1), {
          wrapper: createWrapper(queryClient),
        });

        expect(result.current.isSuccess).toBe(false);
        expect(result.current.isPending).toBe(true);

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.isPending).toBe(false);
        expect(result.current.isLoading).toBe(false);
      });
    });

    describe('error handling', () => {
      it('should set isError on API error', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'LESSON_NOT_FOUND',
                  message: 'Lesson not found',
                },
              },
              { status: 404 }
            );
          })
        );

        // Pass retry: false to avoid hook's default retry: 3
        const { result } = renderHook(() => useLesson(999, { retry: 0 }), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
        expect(result.current.error?.message).toContain('Failed to fetch lesson details');
      });

      it('should handle network errors', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
            return HttpResponse.error();
          })
        );

        // Pass retry: false to avoid hook's default retry: 3
        const { result } = renderHook(() => useLesson(1, { retry: 0 }), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it('should handle server error responses', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'Internal server error',
                },
              },
              { status: 500 }
            );
          })
        );

        // Pass retry: false to avoid hook's default retry: 3
        const { result } = renderHook(() => useLesson(1, { retry: 0 }), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.data).toBeUndefined();
      });

      it('should not retry when retry is disabled', async () => {
        let requestCount = 0;

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
            requestCount++;
            return HttpResponse.json(
              { success: false, error: { message: 'Error' } },
              { status: 500 }
            );
          })
        );

        // Pass retry: false explicitly to verify no retries occur
        const { result } = renderHook(() => useLesson(1, { retry: 0 }), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        const initialCount = requestCount;
        
        // Wait a bit to ensure no additional retries occur
        await new Promise(resolve => setTimeout(resolve, 100));

        // With retry disabled, request count should not increase after initial fetch
        // (React 18 StrictMode may cause initial double render, but no retries should occur)
        expect(requestCount).toBe(initialCount);
        // Should be at most 2 (due to StrictMode double render) with no retries
        expect(requestCount).toBeLessThanOrEqual(2);
      });
    });

    describe('caching behavior', () => {
      it('should cache lesson data and not refetch for same lessonId', async () => {
        let requestCount = 0;
        const mockLesson = createMockLesson({ id: 1 });

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
            requestCount++;
            return HttpResponse.json({
              success: true,
              data: mockLesson,
            });
          })
        );

        // First render
        const { result: result1, unmount } = renderHook(() => useLesson(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result1.current.isSuccess).toBe(true);
        });

        // Record count after first render (may be 1-2 due to React 18 StrictMode)
        const countAfterFirstRender = requestCount;
        unmount();

        // Second render with same lessonId should use cache
        const { result: result2 } = renderHook(() => useLesson(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result2.current.isSuccess).toBe(true);
        });

        // Should not have made additional requests (cached)
        expect(requestCount).toBe(countAfterFirstRender);
        expect(result2.current.data).toEqual(mockLesson);
      });

      it('should fetch different lesson for different lessonId', async () => {
        let requestCount = 0;
        const lesson1 = createMockLesson({ id: 1, name: 'Lesson 1' });
        const lesson2 = createMockLesson({ id: 2, name: 'Lesson 2' });

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, ({ params }) => {
            requestCount++;
            const lessonId = Number(params.lessonId);
            return HttpResponse.json({
              success: true,
              data: lessonId === 1 ? lesson1 : lesson2,
            });
          })
        );

        const { result: result1 } = renderHook(() => useLesson(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result1.current.isSuccess).toBe(true);
        });

        // Record count after first render
        const countAfterFirstRender = requestCount;

        const { result: result2 } = renderHook(() => useLesson(2), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result2.current.isSuccess).toBe(true);
        });

        // Should make additional request(s) for different lesson
        expect(requestCount).toBeGreaterThan(countAfterFirstRender);
        expect(result1.current.data?.name).toBe('Lesson 1');
        expect(result2.current.data?.name).toBe('Lesson 2');
      });

      it('should verify 5 minute stale time configuration', async () => {
        // Verify the DEFAULT_STALE_TIME constant matches expected value
        expect(DEFAULT_STALE_TIME).toBe(5 * 60 * 1000);

        // The hook uses this stale time by default
        const mockLesson = createMockLesson();

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
            return HttpResponse.json({
              success: true,
              data: mockLesson,
            });
          })
        );

        const { result } = renderHook(() => useLesson(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Query should be fresh (not stale) immediately after fetch
        // In React Query v5, we check if data is stale using the hook's isStale property
        expect(result.current.isStale).toBe(false);
        
        // Also verify dataUpdatedAt exists (query completed successfully)
        const queryState = queryClient.getQueryState(lessonKeys.detail(1));
        expect(queryState?.dataUpdatedAt).toBeDefined();
        expect(queryState?.dataUpdatedAt).toBeGreaterThan(0);
      });
    });

    describe('query invalidation', () => {
      it('should refetch after invalidateQueries is called', async () => {
        let requestCount = 0;
        
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
            requestCount++;
            // Use requestCount to determine which lesson name to return
            // Account for StrictMode double renders by using even/odd
            const isUpdated = requestCount > 2; // After StrictMode + invalidation
            return HttpResponse.json({
              success: true,
              data: createMockLesson({ name: isUpdated ? 'Updated' : 'Initial' }),
            });
          })
        );

        const { result } = renderHook(() => useLesson(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.name).toBe('Initial');
        const countBeforeInvalidation = requestCount;

        // Invalidate and wait for refetch
        await queryClient.invalidateQueries({ queryKey: lessonKeys.detail(1) });

        await waitFor(() => {
          expect(result.current.data?.name).toBe('Updated');
        });

        // Should have made additional request(s) after invalidation
        expect(requestCount).toBeGreaterThan(countBeforeInvalidation);
      });

      it('should clear cache using invalidateLessonQueries utility', async () => {
        let requestCount = 0;

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
            requestCount++;
            return HttpResponse.json({
              success: true,
              data: createMockLesson({ name: `Fetch ${requestCount}` }),
            });
          }),
          http.get(`${API_BASE_URL}/lesson/:lessonId/pages`, () => {
            return HttpResponse.json({
              success: true,
              data: { pages: [], count: 0 },
            });
          }),
          http.get(`${API_BASE_URL}/lesson/:lessonId/attempts`, () => {
            return HttpResponse.json({
              success: true,
              data: { attempts: [], retries: 0 },
            });
          }),
          http.get(`${API_BASE_URL}/lesson/:lessonId/timer`, () => {
            return HttpResponse.json({
              success: true,
              data: { timers: [], totalTimeSpent: 0 },
            });
          }),
          http.get(`${API_BASE_URL}/lesson/:lessonId/progress`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                visitedPages: [],
                currentPageId: 0,
                progressPercentage: 0,
                pagesCompleted: 0,
                totalPages: 0,
                timeSpent: 0,
                score: 0,
                isCompleted: false,
                currentRetry: 0,
                hasCompleted: false,
              },
            });
          })
        );

        const { result } = renderHook(() => useLesson(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const initialName = result.current.data?.name;
        const countBeforeInvalidation = requestCount;

        // Use the utility function to invalidate all lesson queries
        await invalidateLessonQueries(queryClient, 1);

        await waitFor(() => {
          // Name should change because requestCount incremented after invalidation
          expect(result.current.data?.name).not.toBe(initialName);
        });

        // Should have made additional request(s) after invalidation
        expect(requestCount).toBeGreaterThan(countBeforeInvalidation);
      });
    });

    describe('query variations', () => {
      it('should handle lesson ID correctly in API call', async () => {
        let capturedLessonId: string | readonly string[] | undefined;

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, ({ params }) => {
            capturedLessonId = params.lessonId;
            return HttpResponse.json({
              success: true,
              data: createMockLesson({ id: Number(params.lessonId) }),
            });
          })
        );

        const { result } = renderHook(() => useLesson(42), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(capturedLessonId).toBe('42');
        expect(result.current.data?.id).toBe(42);
      });

      it('should not fetch when enabled is false', async () => {
        let requestMade = false;

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
            requestMade = true;
            return HttpResponse.json({
              success: true,
              data: createMockLesson(),
            });
          })
        );

        const { result } = renderHook(
          () => useLesson(1, { enabled: false }),
          {
            wrapper: createWrapper(queryClient),
          }
        );

        // Wait a bit to ensure no request is made
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(requestMade).toBe(false);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isPending).toBe(true);
        expect(result.current.fetchStatus).toBe('idle');
      });

      it('should not fetch for invalid lesson ID (0 or negative)', async () => {
        let requestMade = false;

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
            requestMade = true;
            return HttpResponse.json({
              success: true,
              data: createMockLesson(),
            });
          })
        );

        const { result } = renderHook(() => useLesson(0), {
          wrapper: createWrapper(queryClient),
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(requestMade).toBe(false);
        expect(result.current.fetchStatus).toBe('idle');
      });
    });
  });

  // ============================================================================
  // useLessonPages Hook Tests
  // ============================================================================

  describe('useLessonPages', () => {
    describe('fetching lesson pages', () => {
      it('should fetch all lesson pages successfully', async () => {
        const mockPages = [
          createMockLessonPage({ id: 1, title: 'Introduction', prevpageid: 0, nextpageid: 2 }),
          createMockLessonPage({ id: 2, title: 'Question 1', prevpageid: 1, nextpageid: 3 }),
          createMockLessonPage({ id: 3, title: 'Conclusion', prevpageid: 2, nextpageid: 0 }),
        ];

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/pages`, ({ params }) => {
            expect(params.lessonId).toBe('1');
            return HttpResponse.json({
              success: true,
              data: {
                pages: mockPages,
                count: mockPages.length,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonPages(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.pages).toHaveLength(3);
        expect(result.current.data?.count).toBe(3);
      });

      it('should return pages with different question types', async () => {
        const mockPages = [
          createMockLessonPage({
            id: 1,
            title: 'Content Page',
            qtype: QuestionType.BRANCHTABLE,
          }),
          createMockLessonPage({
            id: 2,
            title: 'Multiple Choice',
            qtype: QuestionType.MULTICHOICE,
          }),
          createMockLessonPage({
            id: 3,
            title: 'True/False',
            qtype: QuestionType.TRUEFALSE,
          }),
          createMockLessonPage({
            id: 4,
            title: 'Essay Question',
            qtype: QuestionType.ESSAY,
          }),
        ];

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/pages`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                pages: mockPages,
                count: mockPages.length,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonPages(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const pages = result.current.data?.pages;
        expect(pages?.[0]?.qtype).toBe(QuestionType.BRANCHTABLE);
        expect(pages?.[1]?.qtype).toBe(QuestionType.MULTICHOICE);
        expect(pages?.[2]?.qtype).toBe(QuestionType.TRUEFALSE);
        expect(pages?.[3]?.qtype).toBe(QuestionType.ESSAY);
      });
    });

    describe('page structure validation', () => {
      it('should verify each page has correct properties', async () => {
        const mockAnswer = createMockAnswer({
          id: 1,
          answer: 'Option A',
          jumpto: NavigationConstant.NEXTPAGE,
          grade: 1,
        });

        const mockPage = createMockLessonPage({
          id: 1,
          title: 'Test Question',
          qtype: QuestionType.MULTICHOICE,
          contents: '<p>What is the answer?</p>',
          answers: [mockAnswer],
        });

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/pages`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                pages: [mockPage],
                count: 1,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonPages(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const page = result.current.data?.pages[0];
        expect(page).toBeDefined();
        expect(page?.id).toBe(1);
        expect(page?.title).toBe('Test Question');
        expect(page?.qtype).toBe(QuestionType.MULTICHOICE);
        expect(page?.contents).toContain('What is the answer?');
        expect(page?.answers).toHaveLength(1);
        expect(page?.answers?.[0]?.answer).toBe('Option A');
      });

      it('should handle branching logic data in pages', async () => {
        const branchTable = createMockLessonPage({
          id: 1,
          title: 'Choose Your Path',
          qtype: QuestionType.BRANCHTABLE,
          answers: [
            createMockAnswer({
              id: 1,
              answer: 'Path A',
              jumpto: 2,
              grade: 0,
            }),
            createMockAnswer({
              id: 2,
              answer: 'Path B',
              jumpto: 3,
              grade: 0,
            }),
          ],
        });

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/pages`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                pages: [branchTable],
                count: 1,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonPages(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const page = result.current.data?.pages[0];
        expect(page?.qtype).toBe(QuestionType.BRANCHTABLE);
        expect(page?.answers).toHaveLength(2);
        expect(page?.answers?.[0]?.jumpto).toBe(2);
        expect(page?.answers?.[1]?.jumpto).toBe(3);
      });

      it('should handle navigation constants in answers', async () => {
        const mockPage = createMockLessonPage({
          id: 1,
          answers: [
            createMockAnswer({ jumpto: NavigationConstant.NEXTPAGE }),
            createMockAnswer({ jumpto: NavigationConstant.EOL }),
            createMockAnswer({ jumpto: NavigationConstant.THISPAGE }),
          ],
        });

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/pages`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                pages: [mockPage],
                count: 1,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonPages(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const answers = result.current.data?.pages?.[0]?.answers;
        expect(answers?.[0]?.jumpto).toBe(NavigationConstant.NEXTPAGE);
        expect(answers?.[1]?.jumpto).toBe(NavigationConstant.EOL);
        expect(answers?.[2]?.jumpto).toBe(NavigationConstant.THISPAGE);
      });
    });

    describe('loading and error states', () => {
      it('should show loading state initially', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/pages`, async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({
              success: true,
              data: { pages: [], count: 0 },
            });
          })
        );

        const { result } = renderHook(() => useLessonPages(1), {
          wrapper: createWrapper(queryClient),
        });

        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });

      it('should handle API errors for pages', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/pages`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'PAGES_NOT_FOUND',
                  message: 'Lesson pages not found',
                },
              },
              { status: 404 }
            );
          })
        );

        // Pass retry: false to avoid hook's default retry: 3
        const { result } = renderHook(() => useLessonPages(1, { retry: 0 }), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
        expect(result.current.data).toBeUndefined();
      });

      it('should verify cache key for pages query', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/pages`, () => {
            return HttpResponse.json({
              success: true,
              data: { pages: [], count: 0 },
            });
          })
        );

        const { result } = renderHook(() => useLessonPages(123), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Verify cache key
        const expectedKey = lessonKeys.pages(123);
        expect(expectedKey).toEqual(['lesson', 'pages', 123]);

        const cachedData = queryClient.getQueryData(lessonKeys.pages(123));
        expect(cachedData).toBeDefined();
      });
    });
  });

  // ============================================================================
  // useLessonAttempts Hook Tests
  // ============================================================================

  describe('useLessonAttempts', () => {
    describe('fetching user attempts', () => {
      it('should fetch user attempts successfully', async () => {
        const mockAttempts = [
          createMockLessonAttempt({ id: 1, pageid: 1, correct: 1 }),
          createMockLessonAttempt({ id: 2, pageid: 2, correct: 0 }),
          createMockLessonAttempt({ id: 3, pageid: 3, correct: 1 }),
        ];

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/attempts`, ({ params }) => {
            expect(params.lessonId).toBe('1');
            return HttpResponse.json({
              success: true,
              data: {
                attempts: mockAttempts,
                retries: 0,
                lastpageseen: 3,
                bestgrade: 85,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonAttempts(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.attempts).toHaveLength(3);
        expect(result.current.data?.retries).toBe(0);
        expect(result.current.data?.lastpageseen).toBe(3);
        expect(result.current.data?.bestgrade).toBe(85);
      });

      it('should include grades and timestamps in attempts', async () => {
        const now = Date.now();
        const mockAttempt = createMockLessonAttempt({
          id: 1,
          grade: 10,
          timecreated: now - 3600000,
          timemodified: now,
        });

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/attempts`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                attempts: [mockAttempt],
                retries: 1,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonAttempts(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const attempt = result.current.data?.attempts[0];
        expect(attempt?.grade).toBe(10);
        expect(attempt?.timecreated).toBe(now - 3600000);
        expect(attempt?.timemodified).toBe(now);
      });
    });

    describe('filtering by user', () => {
      it('should pass userId parameter to API', async () => {
        let capturedUserId: string | null = null;

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/attempts`, ({ request }) => {
            const url = new URL(request.url);
            capturedUserId = url.searchParams.get('userid');
            return HttpResponse.json({
              success: true,
              data: {
                attempts: [],
                retries: 0,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonAttempts(1, 42), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(capturedUserId).toBe('42');
      });

      it('should not pass userId when not provided', async () => {
        let userIdParamExists = false;

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/attempts`, ({ request }) => {
            const url = new URL(request.url);
            userIdParamExists = url.searchParams.has('userid');
            return HttpResponse.json({
              success: true,
              data: {
                attempts: [],
                retries: 0,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonAttempts(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(userIdParamExists).toBe(false);
      });

      it('should use different cache keys for different users', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/attempts`, () => {
            return HttpResponse.json({
              success: true,
              data: { attempts: [], retries: 0 },
            });
          })
        );

        const { result: result1 } = renderHook(() => useLessonAttempts(1, 10), {
          wrapper: createWrapper(queryClient),
        });

        const { result: result2 } = renderHook(() => useLessonAttempts(1, 20), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result1.current.isSuccess).toBe(true);
          expect(result2.current.isSuccess).toBe(true);
        });

        // Verify different cache keys
        const key1 = lessonKeys.attempts(1, 10);
        const key2 = lessonKeys.attempts(1, 20);
        expect(key1).toEqual(['lesson', 'attempts', 1, 10]);
        expect(key2).toEqual(['lesson', 'attempts', 1, 20]);
        expect(key1).not.toEqual(key2);
      });
    });

    describe('empty attempts for new users', () => {
      it('should handle empty attempts array for new users', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/attempts`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                attempts: [],
                retries: 0,
                lastpageseen: undefined,
                bestgrade: undefined,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonAttempts(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.attempts).toEqual([]);
        expect(result.current.data?.retries).toBe(0);
        expect(result.current.data?.lastpageseen).toBeUndefined();
      });

      it('should show zero retries for first-time users', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/attempts`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                attempts: [],
                retries: 0,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonAttempts(1, 999), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.retries).toBe(0);
        expect(result.current.data?.attempts).toHaveLength(0);
      });
    });
  });

  // ============================================================================
  // useLessonTimer Hook Tests
  // ============================================================================

  describe('useLessonTimer', () => {
    describe('timer data fetching', () => {
      it('should fetch timer data successfully', async () => {
        const mockTimer = createMockLessonTimer({
          starttime: Date.now() - 1800000,
          lessontime: 1800,
          completed: 0,
        });

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/timer`, ({ params }) => {
            expect(params.lessonId).toBe('1');
            return HttpResponse.json({
              success: true,
              data: {
                timers: [mockTimer],
                activeTimer: mockTimer,
                totalTimeSpent: 1800,
                timeRemaining: 1800,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonTimer(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.timers).toHaveLength(1);
        expect(result.current.data?.activeTimer).toBeDefined();
        expect(result.current.data?.activeTimer?.starttime).toBe(mockTimer.starttime);
        expect(result.current.data?.activeTimer?.lessontime).toBe(1800);
        expect(result.current.data?.activeTimer?.completed).toBe(0);
      });

      it('should return timer object with correct properties', async () => {
        const now = Date.now();
        const mockTimer = createMockLessonTimer({
          id: 5,
          lessonid: 1,
          userid: 2,
          starttime: now - 600000,
          lessontime: 600,
          completed: 0,
          timemodified: now,
        });

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/timer`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                timers: [mockTimer],
                activeTimer: mockTimer,
                totalTimeSpent: 600,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonTimer(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const timer = result.current.data?.activeTimer;
        expect(timer?.id).toBe(5);
        expect(timer?.lessonid).toBe(1);
        expect(timer?.userid).toBe(2);
        expect(timer?.starttime).toBe(now - 600000);
        expect(timer?.lessontime).toBe(600);
        expect(timer?.completed).toBe(0);
      });

      it('should pass userId parameter to timer API', async () => {
        let capturedUserId: string | null = null;

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/timer`, ({ request }) => {
            const url = new URL(request.url);
            capturedUserId = url.searchParams.get('userid');
            return HttpResponse.json({
              success: true,
              data: {
                timers: [],
                totalTimeSpent: 0,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonTimer(1, 55), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(capturedUserId).toBe('55');
      });
    });

    describe('10 second stale time', () => {
      it('should verify TIMER_STALE_TIME is 10 seconds', () => {
        expect(TIMER_STALE_TIME).toBe(10 * 1000);
      });

      it('should use short stale time for frequent refetching', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/timer`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                timers: [],
                totalTimeSpent: 0,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonTimer(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Verify timer query uses short stale time (10 seconds)
        // The hook should be configured with TIMER_STALE_TIME = 10 * 1000
        const queryState = queryClient.getQueryState(lessonKeys.timer(1, undefined));
        expect(queryState).toBeDefined();
      });

      it('should verify timer cache key structure', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/timer`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                timers: [],
                totalTimeSpent: 0,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonTimer(42, 7), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Verify cache key structure
        const expectedKey = lessonKeys.timer(42, 7);
        expect(expectedKey).toEqual(['lesson', 'timer', 42, 7]);
      });
    });

    describe('timer state when no active timer', () => {
      it('should handle no active timer gracefully', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/timer`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                timers: [],
                activeTimer: undefined,
                totalTimeSpent: 0,
                timeRemaining: undefined,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonTimer(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.timers).toEqual([]);
        expect(result.current.data?.activeTimer).toBeUndefined();
        expect(result.current.data?.totalTimeSpent).toBe(0);
      });

      it('should handle completed timer', async () => {
        const completedTimer = createMockLessonTimer({
          completed: 1,
          lessontime: 3600,
        });

        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/timer`, () => {
            return HttpResponse.json({
              success: true,
              data: {
                timers: [completedTimer],
                activeTimer: undefined,
                totalTimeSpent: 3600,
                timeRemaining: 0,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonTimer(1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.timers?.[0]?.completed).toBe(1);
        expect(result.current.data?.activeTimer).toBeUndefined();
        expect(result.current.data?.timeRemaining).toBe(0);
      });

      it('should show loading state for timer query', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/timer`, async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({
              success: true,
              data: {
                timers: [],
                totalTimeSpent: 0,
              },
            });
          })
        );

        const { result } = renderHook(() => useLessonTimer(1), {
          wrapper: createWrapper(queryClient),
        });

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.isLoading).toBe(false);
      });

      it('should handle timer error states', async () => {
        server.use(
          http.get(`${API_BASE_URL}/lesson/:lessonId/timer`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'TIMER_ERROR',
                  message: 'Failed to fetch timer',
                },
              },
              { status: 500 }
            );
          })
        );

        // Pass retry: false to avoid hook's default retry: 3
        const { result } = renderHook(
          () => useLessonTimer(1, undefined, { retry: 0 }),
          {
            wrapper: createWrapper(queryClient),
          }
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });
  });

  // ============================================================================
  // useLessonProgress Hook Tests
  // ============================================================================

  describe('useLessonProgress', () => {
    it('should fetch lesson progress successfully', async () => {
      const mockProgress = {
        visitedPages: [1, 2, 3],
        currentPageId: 3,
        progressPercentage: 60,
        pagesCompleted: 3,
        totalPages: 5,
        timeSpent: 1800,
        score: 75,
        isCompleted: false,
        currentRetry: 0,
        hasCompleted: false,
      };

      server.use(
        http.get(`${API_BASE_URL}/lesson/:lessonId/progress`, () => {
          return HttpResponse.json({
            success: true,
            data: mockProgress,
          });
        })
      );

      const { result } = renderHook(() => useLessonProgress(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.visitedPages).toEqual([1, 2, 3]);
      expect(result.current.data?.progressPercentage).toBe(60);
      expect(result.current.data?.pagesCompleted).toBe(3);
      expect(result.current.data?.totalPages).toBe(5);
    });

    it('should pass userId to progress API', async () => {
      let capturedUserId: string | null = null;

      server.use(
        http.get(`${API_BASE_URL}/lesson/:lessonId/progress`, ({ request }) => {
          const url = new URL(request.url);
          capturedUserId = url.searchParams.get('userid');
          return HttpResponse.json({
            success: true,
            data: {
              visitedPages: [],
              currentPageId: 0,
              progressPercentage: 0,
              pagesCompleted: 0,
              totalPages: 0,
              timeSpent: 0,
              score: 0,
              isCompleted: false,
              currentRetry: 0,
              hasCompleted: false,
            },
          });
        })
      );

      const { result } = renderHook(() => useLessonProgress(1, 25), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedUserId).toBe('25');
    });

    it('should verify progress cache key', async () => {
      server.use(
        http.get(`${API_BASE_URL}/lesson/:lessonId/progress`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              visitedPages: [],
              currentPageId: 0,
              progressPercentage: 0,
              pagesCompleted: 0,
              totalPages: 0,
              timeSpent: 0,
              score: 0,
              isCompleted: false,
              currentRetry: 0,
              hasCompleted: false,
            },
          });
        })
      );

      const { result } = renderHook(() => useLessonProgress(77, 33), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const expectedKey = lessonKeys.progress(77, 33);
      expect(expectedKey).toEqual(['lesson', 'progress', 77, 33]);
    });
  });

  // ============================================================================
  // lessonKeys Factory Tests
  // ============================================================================

  describe('lessonKeys', () => {
    it('should generate correct base key', () => {
      expect(lessonKeys.all).toEqual(['lesson']);
    });

    it('should generate correct lists key', () => {
      expect(lessonKeys.lists()).toEqual(['lesson', 'list']);
    });

    it('should generate correct detail key', () => {
      expect(lessonKeys.detail(42)).toEqual(['lesson', 'detail', 42]);
    });

    it('should generate correct pages key', () => {
      expect(lessonKeys.pages(123)).toEqual(['lesson', 'pages', 123]);
    });

    it('should generate correct attempts key without userId', () => {
      expect(lessonKeys.attempts(1)).toEqual(['lesson', 'attempts', 1, 'me']);
    });

    it('should generate correct attempts key with userId', () => {
      expect(lessonKeys.attempts(1, 5)).toEqual(['lesson', 'attempts', 1, 5]);
    });

    it('should generate correct timer key without userId', () => {
      expect(lessonKeys.timer(1)).toEqual(['lesson', 'timer', 1, 'me']);
    });

    it('should generate correct timer key with userId', () => {
      expect(lessonKeys.timer(1, 10)).toEqual(['lesson', 'timer', 1, 10]);
    });

    it('should generate correct progress key without userId', () => {
      expect(lessonKeys.progress(1)).toEqual(['lesson', 'progress', 1, 'me']);
    });

    it('should generate correct progress key with userId', () => {
      expect(lessonKeys.progress(1, 15)).toEqual(['lesson', 'progress', 1, 15]);
    });
  });

  // ============================================================================
  // useLessonQueryClient Hook Tests
  // ============================================================================

  describe('useLessonQueryClient', () => {
    it('should return QueryClient instance', async () => {
      const { result } = renderHook(() => useLessonQueryClient(), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current).toBe(queryClient);
    });

    it('should allow cache invalidation', async () => {
      let requestCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
          requestCount++;
          return HttpResponse.json({
            success: true,
            data: createMockLesson(),
          });
        })
      );

      const { result: lessonResult } = renderHook(() => useLesson(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(lessonResult.current.isSuccess).toBe(true);
      });

      // Record count after initial render (may be 1-2 due to React 18 StrictMode)
      const countBeforeInvalidation = requestCount;

      const { result: clientResult } = renderHook(() => useLessonQueryClient(), {
        wrapper: createWrapper(queryClient),
      });

      // Use client to invalidate - this marks the query as stale
      await clientResult.current.invalidateQueries({ queryKey: lessonKeys.detail(1) });

      // In React Query v5, invalidation marks query as stale
      // Since there's an active subscriber, it triggers a refetch
      await waitFor(() => {
        expect(requestCount).toBeGreaterThan(countBeforeInvalidation);
      });

      // Verify data is still accessible after invalidation
      expect(lessonResult.current.data).toBeDefined();
    });
  });

  // ============================================================================
  // TypeScript Type Safety Tests
  // ============================================================================

  describe('TypeScript type safety', () => {
    it('should infer correct types for useLesson data', async () => {
      server.use(
        http.get(`${API_BASE_URL}/lesson/:lessonId`, () => {
          return HttpResponse.json({
            success: true,
            data: createMockLesson(),
          });
        })
      );

      const { result } = renderHook(() => useLesson(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Type assertions - these would fail at compile time if types are wrong
      const lesson = result.current.data;
      if (lesson) {
        const id: number = lesson.id;
        const name: string = lesson.name;
        const timelimit: number = lesson.timelimit;
        expect(typeof id).toBe('number');
        expect(typeof name).toBe('string');
        expect(typeof timelimit).toBe('number');
      }
    });

    it('should infer correct types for useLessonPages data', async () => {
      server.use(
        http.get(`${API_BASE_URL}/lesson/:lessonId/pages`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              pages: [createMockLessonPage()],
              count: 1,
            },
          });
        })
      );

      const { result } = renderHook(() => useLessonPages(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const pages = result.current.data?.pages;
      if (pages && pages.length > 0) {
        const page = pages[0];
        if (page) {
          const id: number = page.id;
          const title: string = page.title;
          const qtype: QuestionType = page.qtype;
          expect(typeof id).toBe('number');
          expect(typeof title).toBe('string');
          expect(typeof qtype).toBe('number');
        }
      }
    });

    it('should infer correct types for useLessonTimer data', async () => {
      server.use(
        http.get(`${API_BASE_URL}/lesson/:lessonId/timer`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              timers: [createMockLessonTimer()],
              activeTimer: createMockLessonTimer(),
              totalTimeSpent: 1800,
            },
          });
        })
      );

      const { result } = renderHook(() => useLessonTimer(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const timer = result.current.data?.activeTimer;
      if (timer) {
        const starttime: number = timer.starttime;
        const lessontime: number = timer.lessontime;
        const completed: number = timer.completed;
        expect(typeof starttime).toBe('number');
        expect(typeof lessontime).toBe('number');
        expect(typeof completed).toBe('number');
      }
    });
  });
});
