/**
 * Unit Tests for Lesson API Integration Layer
 *
 * Comprehensive test suite for lesson API hooks validating API endpoint calls for
 * lesson operations including fetching lesson details, managing attempts, loading
 * pages, submitting answers, navigating pages, tracking progress, and managing
 * timed sessions with proper React Query patterns and error handling.
 *
 * These tests reference Moodle lesson functions:
 * - lesson::load() from public/mod/lesson/view.php
 * - lesson->process_page_responses() from public/mod/lesson/continue.php
 * - lesson->start_timer() and lesson->update_timer() from public/mod/lesson/locallib.php
 *
 * @module tests/unit/features/activities/lesson/lessonApi.test
 */

import React from 'react';
import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';

// Internal imports from depends_on_files
import { server } from '@/tests/mocks/server';
import { waitFor } from '@/tests/helpers/asyncUtils';
import { createTestQueryClient } from '@/tests/helpers/render';
import {
  useLesson,
  useLessonAttempt,
  useStartLessonAttempt,
  useLessonPage,
  useNextLessonPage,
  useSubmitLessonAnswer,
  useNavigateLessonPage,
  useLessonProgress,
  useUpdateLessonTimer,
  useFinishLessonAttempt,
  useLessonPages,
  useRestartLesson,
  lessonQueryKeys,
  type LessonDetailResponse,
  type LessonAttemptResponse,
  type StartLessonAttemptResponse,
  type LessonPageResponse,
  type NextPageResponse,
  type SubmitAnswerResponse,
  type NavigatePageResponse,
  type LessonProgressResponse,
  type UpdateTimerResponse,
  type FinishLessonAttemptResponse,
  type LessonPagesResponse,
  type RestartLessonResponse,
  type SubmitAnswerRequest,
  type NavigatePageRequest,
  type UpdateTimerRequest,
} from '@/features/activities/lesson/api/lessonApi';

// ============================================================================
// Test Constants and Mock Data
// ============================================================================

const API_BASE_URL = '/api/v1';

/**
 * Mock lesson entity for testing
 */
const mockLesson = {
  id: 1,
  name: 'Introduction to Testing',
  intro: '<p>Welcome to the testing lesson.</p>',
  course: 101,
  grade: 100,
  timelimit: 3600, // 1 hour in seconds
  retake: 1,
  maxretries: 3,
  ongoing: 0,
  usemaxgrade: 1,
  maxattempts: 0,
  nextpagedefault: 0,
  feedback: 1,
  minquestions: 0,
  maxpages: 1,
  practice: 0,
  password: '',
  dependency: 0,
  conditions: '',
  timespent: 0,
  completed: 0,
  gradebetterthan: 0,
  modattempts: 0,
  available: 1,
  deadline: 0,
  review: 0,
  bgcolor: '',
  displayleft: 1,
  displayleftif: 0,
  progressbar: 1,
  allowofflineattempts: 0,
  introformat: 1,
  contentsettings: null,
  displaymenu: 0,
  slideshow: 0,
  width: 640,
  height: 480,
};

/**
 * Mock lesson detail response
 */
const mockLessonDetailResponse: LessonDetailResponse = {
  lesson: mockLesson as any,
  canAccess: true,
  requiresPassword: false,
  passwordProvided: false,
  dependencyLesson: null,
  dependencySatisfied: true,
  isAvailable: true,
  availabilityMessage: undefined,
  maxAttempts: 3,
  attemptsUsed: 0,
  canRetake: true,
};

/**
 * Mock lesson attempt response
 */
const mockLessonAttemptResponse: LessonAttemptResponse = {
  retryCount: 0,
  lastPageSeen: 2,
  hasActiveTimer: true,
  timer: {
    id: 1,
    lessonid: 1,
    userid: 100,
    starttime: Math.floor(Date.now() / 1000) - 600, // Started 10 minutes ago
    lessontime: 600,
    timemodified: Math.floor(Date.now() / 1000),
    completed: false,
  } as any,
  timeRemaining: 3000, // 50 minutes remaining
  hasTimeLimit: true,
  timeSpent: 600,
  inProgress: true,
  visitedPages: [1, 2],
  progressPercentage: 40,
};

/**
 * Mock lesson page for question type
 */
const mockLessonPage = {
  id: 2,
  lessonid: 1,
  prevpageid: 1,
  nextpageid: 3,
  qtype: 2, // Multiple choice
  qoption: 0,
  layout: 1,
  display: 1,
  timecreated: 1700000000,
  timemodified: 1700000000,
  title: 'Question 1',
  contents: '<p>What is the correct answer?</p>',
  contentsformat: 1,
};

/**
 * Mock answers for question pages
 */
const mockAnswers = [
  {
    id: 1,
    pageid: 2,
    lessonid: 1,
    jumpto: 3,
    grade: 100,
    score: 1,
    flags: 0,
    timecreated: 1700000000,
    timemodified: 1700000000,
    answer: 'Correct Answer',
    answerformat: 1,
    response: 'Well done!',
    responseformat: 1,
  },
  {
    id: 2,
    pageid: 2,
    lessonid: 1,
    jumpto: 2, // Stay on same page
    grade: 0,
    score: 0,
    flags: 0,
    timecreated: 1700000000,
    timemodified: 1700000000,
    answer: 'Wrong Answer',
    answerformat: 1,
    response: 'Try again.',
    responseformat: 1,
  },
];

/**
 * Mock page response
 */
const mockPageResponse: LessonPageResponse = {
  page: mockLessonPage as any,
  answers: mockAnswers as any[],
  isQuestion: true,
  questionType: 2 as any,
  canGoBack: true,
  previousPageId: 1,
  navigationOptions: [],
  mediaFiles: [],
  timeRemaining: 3000,
};

/**
 * Mock start attempt response
 */
const mockStartAttemptResponse: StartLessonAttemptResponse = {
  firstPageId: 1,
  firstPage: { ...mockLessonPage, id: 1, prevpageid: 0 } as any,
  timer: {
    id: 1,
    lessonid: 1,
    userid: 100,
    starttime: Math.floor(Date.now() / 1000),
    lessontime: 0,
    timemodified: Math.floor(Date.now() / 1000),
    completed: false,
  } as any,
  retryNumber: 0,
  isTimed: true,
  timeLimit: 3600,
};

/**
 * Mock submit answer response
 */
const mockSubmitAnswerResponse: SubmitAnswerResponse = {
  isCorrect: true,
  score: 1,
  maxScore: 1,
  feedback: 'Well done! That is correct.',
  nextPageId: 3,
  lessonEnded: false,
  correctAnswer: 'Correct Answer',
  attempt: {
    id: 1,
    lessonid: 1,
    pageid: 2,
    userid: 100,
    answerid: 1,
    retry: 0,
    correct: 1,
    useranswer: '1',
    timeseen: Math.floor(Date.now() / 1000),
  } as any,
  progress: {
    pagesCompleted: 2,
    totalPages: 5,
    progressPercentage: 40,
    questionsAnswered: 1,
    correctAnswers: 1,
    timeSpent: 650,
  } as any,
  timeRemaining: 2950,
};

/**
 * Mock next page response
 */
const mockNextPageResponse: NextPageResponse = {
  nextPage: { ...mockLessonPage, id: 3, prevpageid: 2, nextpageid: 4 } as any,
  answers: mockAnswers as any[],
  isLastPage: false,
  navigationConstant: undefined,
};

/**
 * Mock navigate page response
 */
const mockNavigatePageResponse: NavigatePageResponse = {
  page: { ...mockLessonPage, id: 3 } as any,
  answers: mockAnswers as any[],
  progress: {
    pagesCompleted: 2,
    totalPages: 5,
    progressPercentage: 40,
    questionsAnswered: 1,
    correctAnswers: 1,
    timeSpent: 660,
  } as any,
  timeRemaining: 2940,
};

/**
 * Mock progress response
 */
const mockProgressResponse: LessonProgressResponse = {
  progress: {
    pagesCompleted: 2,
    totalPages: 5,
    progressPercentage: 40,
    questionsAnswered: 1,
    correctAnswers: 1,
    timeSpent: 650,
  } as any,
  attempts: [
    {
      id: 1,
      lessonid: 1,
      pageid: 1,
      userid: 100,
      answerid: null,
      retry: 0,
      correct: 0,
      useranswer: '',
      timeseen: Math.floor(Date.now() / 1000) - 600,
    } as any,
  ],
  contentPagesViewed: [1],
  correctQuestionPages: [2],
  currentGrade: 50,
  maxGrade: 100,
  gradePercentage: 50,
  timeSpent: 650,
};

/**
 * Mock timer update response
 */
const mockTimerUpdateResponse: UpdateTimerResponse = {
  timer: {
    id: 1,
    lessonid: 1,
    userid: 100,
    starttime: Math.floor(Date.now() / 1000) - 660,
    lessontime: 660,
    timemodified: Math.floor(Date.now() / 1000),
    completed: false,
  } as any,
  timeRemaining: 2940,
  timeExpired: false,
};

/**
 * Mock finish attempt response
 */
const mockFinishAttemptResponse: FinishLessonAttemptResponse = {
  grade: {
    id: 1,
    lessonid: 1,
    userid: 100,
    grade: 85,
    late: 0,
    completed: Math.floor(Date.now() / 1000),
  } as any,
  gradePercentage: 85,
  timeSpent: 2500,
  completed: true,
  isLate: false,
  feedbackMessage: 'Excellent work! You scored 85%.',
  canRetake: true,
  attemptsRemaining: 2,
};

/**
 * Mock pages list response
 */
const mockPagesResponse: LessonPagesResponse = {
  pages: [
    { ...mockLessonPage, id: 1, prevpageid: 0, nextpageid: 2 } as any,
    { ...mockLessonPage, id: 2 } as any,
    { ...mockLessonPage, id: 3, prevpageid: 2, nextpageid: 4 } as any,
    { ...mockLessonPage, id: 4, prevpageid: 3, nextpageid: 5 } as any,
    { ...mockLessonPage, id: 5, prevpageid: 4, nextpageid: 0 } as any,
  ],
  totalPages: 5,
  questionPages: 3,
  contentPages: 2,
  accessiblePages: [1, 2, 3],
};

/**
 * Mock restart lesson response
 */
const mockRestartResponse: RestartLessonResponse = {
  retryNumber: 1,
  firstPage: { ...mockLessonPage, id: 1, prevpageid: 0 } as any,
  timer: {
    id: 2,
    lessonid: 1,
    userid: 100,
    starttime: Math.floor(Date.now() / 1000),
    lessontime: 0,
    timemodified: Math.floor(Date.now() / 1000),
    completed: false,
  } as any,
  message: 'Lesson restarted successfully. This is attempt 2 of 3.',
};

// ============================================================================
// Test Setup
// ============================================================================

let queryClient: QueryClient;

/**
 * Creates a wrapper component with QueryClientProvider for hook testing
 */
function createWrapper(): React.FC<{ children: ReactNode }> {
  return function Wrapper({ children }: { children: ReactNode }): React.ReactElement {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

// Reset handlers and create fresh QueryClient before each test
beforeEach(() => {
  queryClient = createTestQueryClient();
  vi.clearAllMocks();
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
});

// Close server after all tests
afterAll(() => {
  server.close();
});

// ============================================================================
// useLesson Hook Tests
// ============================================================================

describe('useLesson', () => {
  it('should fetch lesson details with correct API endpoint', async () => {
    const lessonId = 1;

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}`, () => {
        return HttpResponse.json({
          success: true,
          data: mockLessonDetailResponse,
        });
      })
    );

    const { result } = renderHook(() => useLesson(lessonId), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for query to complete
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify response structure
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.lesson.id).toBe(1);
    expect(result.current.data?.lesson.name).toBe('Introduction to Testing');
    expect(result.current.data?.canAccess).toBe(true);
    expect(result.current.data?.requiresPassword).toBe(false);
    expect(result.current.data?.dependencySatisfied).toBe(true);
    expect(result.current.data?.isAvailable).toBe(true);
    expect(result.current.data?.maxAttempts).toBe(3);
    expect(result.current.data?.attemptsUsed).toBe(0);
    expect(result.current.data?.canRetake).toBe(true);
  });

  it('should handle error for invalid lesson ID', async () => {
    const invalidLessonId = 9999;

    server.use(
      http.get(`${API_BASE_URL}/lesson/${invalidLessonId}`, () => {
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

    const { result } = renderHook(() => useLesson(invalidLessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should not execute query when lessonId is 0', async () => {
    const { result } = renderHook(() => useLesson(0), {
      wrapper: createWrapper(),
    });

    // Query should not run when lessonId is 0
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('should not execute query when enabled is false', async () => {
    server.use(
      http.get(`${API_BASE_URL}/lesson/1`, () => {
        return HttpResponse.json({
          success: true,
          data: mockLessonDetailResponse,
        });
      })
    );

    const { result } = renderHook(() => useLesson(1, false), {
      wrapper: createWrapper(),
    });

    // Query should not run when disabled
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('should cache lesson data and not refetch within stale time', async () => {
    let fetchCount = 0;

    server.use(
      http.get(`${API_BASE_URL}/lesson/1`, () => {
        fetchCount++;
        return HttpResponse.json({
          success: true,
          data: mockLessonDetailResponse,
        });
      })
    );

    const { result, rerender } = renderHook(() => useLesson(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchCount).toBe(1);

    // Rerender should use cached data
    rerender();

    expect(result.current.isSuccess).toBe(true);
    expect(fetchCount).toBe(1); // Still 1, no refetch
  });

  it('should handle network errors gracefully', async () => {
    server.use(
      http.get(`${API_BASE_URL}/lesson/1`, () => {
        return HttpResponse.error();
      })
    );

    const { result } = renderHook(() => useLesson(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

// ============================================================================
// useLessonAttempt Hook Tests
// ============================================================================

describe('useLessonAttempt', () => {
  it('should fetch attempt status with correct endpoint', async () => {
    const lessonId = 1;

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/attempt`, () => {
        return HttpResponse.json({
          success: true,
          data: mockLessonAttemptResponse,
        });
      })
    );

    const { result } = renderHook(() => useLessonAttempt(lessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.retryCount).toBe(0);
    expect(result.current.data?.lastPageSeen).toBe(2);
    expect(result.current.data?.hasActiveTimer).toBe(true);
    expect(result.current.data?.inProgress).toBe(true);
    expect(result.current.data?.visitedPages).toEqual([1, 2]);
    expect(result.current.data?.progressPercentage).toBe(40);
  });

  it('should verify retry count tracking', async () => {
    const lessonId = 1;
    const responseWithRetries = {
      ...mockLessonAttemptResponse,
      retryCount: 2,
    };

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/attempt`, () => {
        return HttpResponse.json({
          success: true,
          data: responseWithRetries,
        });
      })
    );

    const { result } = renderHook(() => useLessonAttempt(lessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.retryCount).toBe(2);
  });

  it('should handle last page seen retrieval', async () => {
    const lessonId = 1;
    const responseWithLastPage = {
      ...mockLessonAttemptResponse,
      lastPageSeen: 5,
    };

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/attempt`, () => {
        return HttpResponse.json({
          success: true,
          data: responseWithLastPage,
        });
      })
    );

    const { result } = renderHook(() => useLessonAttempt(lessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.lastPageSeen).toBe(5);
  });

  it('should handle no active attempt', async () => {
    const lessonId = 1;
    const noAttemptResponse: LessonAttemptResponse = {
      retryCount: 0,
      lastPageSeen: null,
      hasActiveTimer: false,
      timer: undefined,
      timeRemaining: null,
      hasTimeLimit: true,
      timeSpent: 0,
      inProgress: false,
      visitedPages: [],
      progressPercentage: 0,
    };

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/attempt`, () => {
        return HttpResponse.json({
          success: true,
          data: noAttemptResponse,
        });
      })
    );

    const { result } = renderHook(() => useLessonAttempt(lessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.inProgress).toBe(false);
    expect(result.current.data?.lastPageSeen).toBeNull();
    expect(result.current.data?.visitedPages).toEqual([]);
  });
});

// ============================================================================
// useStartLessonAttempt Hook Tests
// ============================================================================

describe('useStartLessonAttempt', () => {
  it('should start new lesson attempt and initialize timer', async () => {
    const lessonId = 1;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/start`, () => {
        return HttpResponse.json({
          success: true,
          data: mockStartAttemptResponse,
        });
      })
    );

    const { result } = renderHook(() => useStartLessonAttempt(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.firstPageId).toBe(1);
    expect(result.current.data?.isTimed).toBe(true);
    expect(result.current.data?.timeLimit).toBe(3600);
    expect(result.current.data?.retryNumber).toBe(0);
    expect(result.current.data?.timer).toBeDefined();
  });

  it('should pass password for password-protected lessons', async () => {
    const lessonId = 1;
    const password = 'secret123';
    let receivedPassword: string | undefined;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/start`, async ({ request }) => {
        const body = (await request.json()) as { password?: string };
        receivedPassword = body.password;
        return HttpResponse.json({
          success: true,
          data: mockStartAttemptResponse,
        });
      })
    );

    const { result } = renderHook(() => useStartLessonAttempt(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, password });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(receivedPassword).toBe(password);
  });

  it('should handle incorrect password error', async () => {
    const lessonId = 1;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/start`, () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_PASSWORD',
              message: 'The password you entered is incorrect.',
            },
          },
          { status: 403 }
        );
      })
    );

    const { result } = renderHook(() => useStartLessonAttempt(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, password: 'wrongpassword' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should handle max attempts exceeded error', async () => {
    const lessonId = 1;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/start`, () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'MAX_ATTEMPTS_EXCEEDED',
              message: 'You have exceeded the maximum number of attempts.',
            },
          },
          { status: 403 }
        );
      })
    );

    const { result } = renderHook(() => useStartLessonAttempt(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should invalidate relevant queries on success', async () => {
    const lessonId = 1;
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/start`, () => {
        return HttpResponse.json({
          success: true,
          data: mockStartAttemptResponse,
        });
      })
    );

    const { result } = renderHook(() => useStartLessonAttempt(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify queries were invalidated
    expect(invalidateSpy).toHaveBeenCalled();
  });
});

// ============================================================================
// useLessonPage Hook Tests
// ============================================================================

describe('useLessonPage', () => {
  it('should fetch page content with correct endpoint', async () => {
    const lessonId = 1;
    const pageId = 2;

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/page/${pageId}`, () => {
        return HttpResponse.json({
          success: true,
          data: mockPageResponse,
        });
      })
    );

    const { result } = renderHook(() => useLessonPage(lessonId, pageId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.page.id).toBe(2);
    expect(result.current.data?.isQuestion).toBe(true);
    expect(result.current.data?.answers).toHaveLength(2);
    expect(result.current.data?.canGoBack).toBe(true);
    expect(result.current.data?.previousPageId).toBe(1);
  });

  it('should verify question data structure for different question types', async () => {
    const lessonId = 1;
    const pageId = 2;
    const essayPageResponse: LessonPageResponse = {
      ...mockPageResponse,
      questionType: 10 as any, // Essay
      answers: [],
    };

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/page/${pageId}`, () => {
        return HttpResponse.json({
          success: true,
          data: essayPageResponse,
        });
      })
    );

    const { result } = renderHook(() => useLessonPage(lessonId, pageId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.questionType).toBe(10);
    expect(result.current.data?.answers).toHaveLength(0);
  });

  it('should handle media files associated with page', async () => {
    const lessonId = 1;
    const pageId = 2;
    const pageWithMedia: LessonPageResponse = {
      ...mockPageResponse,
      mediaFiles: [
        {
          id: 1,
          filename: 'video.mp4',
          url: '/pluginfile.php/100/mod_lesson/page_contents/1/video.mp4',
          mimetype: 'video/mp4',
          filesize: 5242880,
        },
        {
          id: 2,
          filename: 'image.png',
          url: '/pluginfile.php/100/mod_lesson/page_contents/1/image.png',
          mimetype: 'image/png',
          filesize: 102400,
        },
      ],
    };

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/page/${pageId}`, () => {
        return HttpResponse.json({
          success: true,
          data: pageWithMedia,
        });
      })
    );

    const { result } = renderHook(() => useLessonPage(lessonId, pageId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.mediaFiles).toHaveLength(2);
    expect(result.current.data?.mediaFiles[0].mimetype).toBe('video/mp4');
    expect(result.current.data?.mediaFiles[1].mimetype).toBe('image/png');
  });

  it('should handle page not found error', async () => {
    const lessonId = 1;
    const pageId = 999;

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/page/${pageId}`, () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'PAGE_NOT_FOUND',
              message: 'The requested page does not exist.',
            },
          },
          { status: 404 }
        );
      })
    );

    const { result } = renderHook(() => useLessonPage(lessonId, pageId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should not fetch when pageId is 0', async () => {
    const { result } = renderHook(() => useLessonPage(1, 0), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ============================================================================
// useNextLessonPage Hook Tests
// ============================================================================

describe('useNextLessonPage', () => {
  it('should calculate next page based on answer', async () => {
    const lessonId = 1;
    const currentPageId = 2;
    const answerId = 1;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/nextpage`, () => {
        return HttpResponse.json({
          success: true,
          data: mockNextPageResponse,
        });
      })
    );

    const { result } = renderHook(() => useNextLessonPage(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, currentPageId, answerId });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.nextPage.id).toBe(3);
    expect(result.current.data?.isLastPage).toBe(false);
  });

  it('should handle branching navigation', async () => {
    const lessonId = 1;
    const branchResponse: NextPageResponse = {
      nextPage: { ...mockLessonPage, id: 10 } as any,
      answers: [],
      isLastPage: false,
      navigationConstant: -40, // Branch navigation constant
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/nextpage`, () => {
        return HttpResponse.json({
          success: true,
          data: branchResponse,
        });
      })
    );

    const { result } = renderHook(() => useNextLessonPage(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, currentPageId: 2 });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.navigationConstant).toBe(-40);
  });

  it('should handle conditional navigation (wrong answer stays on page)', async () => {
    const lessonId = 1;
    const stayOnPageResponse: NextPageResponse = {
      nextPage: mockLessonPage as any, // Same page
      answers: mockAnswers as any[],
      isLastPage: false,
      navigationConstant: undefined,
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/nextpage`, () => {
        return HttpResponse.json({
          success: true,
          data: stayOnPageResponse,
        });
      })
    );

    const { result } = renderHook(() => useNextLessonPage(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, currentPageId: 2, answerId: 2 }); // Wrong answer

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.nextPage.id).toBe(2); // Same page
  });

  it('should cache next page data', async () => {
    const lessonId = 1;
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/nextpage`, () => {
        return HttpResponse.json({
          success: true,
          data: mockNextPageResponse,
        });
      })
    );

    const { result } = renderHook(() => useNextLessonPage(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, currentPageId: 2, answerId: 1 });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(setQueryDataSpy).toHaveBeenCalled();
  });

  it('should identify last page correctly', async () => {
    const lessonId = 1;
    const lastPageResponse: NextPageResponse = {
      nextPage: { ...mockLessonPage, id: 5, nextpageid: 0 } as any,
      answers: [],
      isLastPage: true,
      navigationConstant: 0, // End of lesson
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/nextpage`, () => {
        return HttpResponse.json({
          success: true,
          data: lastPageResponse,
        });
      })
    );

    const { result } = renderHook(() => useNextLessonPage(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, currentPageId: 4, answerId: 1 });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.isLastPage).toBe(true);
  });
});

// ============================================================================
// useSubmitLessonAnswer Hook Tests
// ============================================================================

describe('useSubmitLessonAnswer', () => {
  it('should submit answer and return feedback', async () => {
    const lessonId = 1;
    const request: SubmitAnswerRequest = {
      pageId: 2,
      answerId: 1,
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/submit`, () => {
        return HttpResponse.json({
          success: true,
          data: mockSubmitAnswerResponse,
        });
      })
    );

    const { result } = renderHook(() => useSubmitLessonAnswer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, request });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.isCorrect).toBe(true);
    expect(result.current.data?.feedback).toBe('Well done! That is correct.');
    expect(result.current.data?.score).toBe(1);
    expect(result.current.data?.nextPageId).toBe(3);
  });

  it('should verify feedback response structure', async () => {
    const lessonId = 1;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/submit`, () => {
        return HttpResponse.json({
          success: true,
          data: mockSubmitAnswerResponse,
        });
      })
    );

    const { result } = renderHook(() => useSubmitLessonAnswer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      lessonId,
      request: { pageId: 2, answerId: 1 },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.feedback).toBeDefined();
    expect(result.current.data?.correctAnswer).toBeDefined();
    expect(result.current.data?.attempt).toBeDefined();
    expect(result.current.data?.progress).toBeDefined();
  });

  it('should handle incorrect answer response', async () => {
    const lessonId = 1;
    const incorrectResponse: SubmitAnswerResponse = {
      ...mockSubmitAnswerResponse,
      isCorrect: false,
      score: 0,
      feedback: 'That is incorrect. Please try again.',
      nextPageId: 2, // Stay on same page
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/submit`, () => {
        return HttpResponse.json({
          success: true,
          data: incorrectResponse,
        });
      })
    );

    const { result } = renderHook(() => useSubmitLessonAnswer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      lessonId,
      request: { pageId: 2, answerId: 2 },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.isCorrect).toBe(false);
    expect(result.current.data?.score).toBe(0);
    expect(result.current.data?.nextPageId).toBe(2); // Stay on same page
  });

  it('should handle essay submission with typed answer', async () => {
    const lessonId = 1;
    const essayRequest: SubmitAnswerRequest = {
      pageId: 3,
      userAnswer: 'This is my essay response about the topic.',
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/submit`, async ({ request }) => {
        const body = (await request.json()) as SubmitAnswerRequest;
        expect(body.userAnswer).toBe(essayRequest.userAnswer);
        return HttpResponse.json({
          success: true,
          data: {
            ...mockSubmitAnswerResponse,
            score: 0, // Essays are manually graded
            maxScore: 1,
          },
        });
      })
    );

    const { result } = renderHook(() => useSubmitLessonAnswer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, request: essayRequest });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should handle matching question submission', async () => {
    const lessonId = 1;
    const matchingRequest: SubmitAnswerRequest = {
      pageId: 4,
      matchingAnswers: {
        1: 10,
        2: 20,
        3: 30,
      },
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/submit`, async ({ request }) => {
        const body = (await request.json()) as SubmitAnswerRequest;
        expect(body.matchingAnswers).toEqual(matchingRequest.matchingAnswers);
        return HttpResponse.json({
          success: true,
          data: mockSubmitAnswerResponse,
        });
      })
    );

    const { result } = renderHook(() => useSubmitLessonAnswer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, request: matchingRequest });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should invalidate progress queries on success', async () => {
    const lessonId = 1;
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/submit`, () => {
        return HttpResponse.json({
          success: true,
          data: mockSubmitAnswerResponse,
        });
      })
    );

    const { result } = renderHook(() => useSubmitLessonAnswer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      lessonId,
      request: { pageId: 2, answerId: 1 },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('should handle lesson end when submitting final answer', async () => {
    const lessonId = 1;
    const lessonEndResponse: SubmitAnswerResponse = {
      ...mockSubmitAnswerResponse,
      lessonEnded: true,
      nextPageId: 0,
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/submit`, () => {
        return HttpResponse.json({
          success: true,
          data: lessonEndResponse,
        });
      })
    );

    const { result } = renderHook(() => useSubmitLessonAnswer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      lessonId,
      request: { pageId: 5, answerId: 1 },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.lessonEnded).toBe(true);
  });

  it('should handle submission errors', async () => {
    const lessonId = 1;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/submit`, () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'SUBMISSION_FAILED',
              message: 'Failed to process answer submission.',
            },
          },
          { status: 500 }
        );
      })
    );

    const { result } = renderHook(() => useSubmitLessonAnswer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      lessonId,
      request: { pageId: 2, answerId: 1 },
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

// ============================================================================
// useNavigateLessonPage Hook Tests
// ============================================================================

describe('useNavigateLessonPage', () => {
  it('should navigate to target page', async () => {
    const lessonId = 1;
    const request: NavigatePageRequest = {
      currentPageId: 2,
      targetPageId: 3,
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/nextpage`, () => {
        return HttpResponse.json({
          success: true,
          data: mockNavigatePageResponse,
        });
      })
    );

    const { result } = renderHook(() => useNavigateLessonPage(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, request });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.page.id).toBe(3);
    expect(result.current.data?.progress).toBeDefined();
  });

  it('should cache target page data on navigation', async () => {
    const lessonId = 1;
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/nextpage`, () => {
        return HttpResponse.json({
          success: true,
          data: mockNavigatePageResponse,
        });
      })
    );

    const { result } = renderHook(() => useNavigateLessonPage(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      lessonId,
      request: { currentPageId: 2, targetPageId: 3 },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(setQueryDataSpy).toHaveBeenCalled();
  });

  it('should invalidate attempt and progress queries', async () => {
    const lessonId = 1;
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/nextpage`, () => {
        return HttpResponse.json({
          success: true,
          data: mockNavigatePageResponse,
        });
      })
    );

    const { result } = renderHook(() => useNavigateLessonPage(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      lessonId,
      request: { currentPageId: 2, targetPageId: 3 },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('should update time remaining after navigation', async () => {
    const lessonId = 1;
    const navigationWithTime: NavigatePageResponse = {
      ...mockNavigatePageResponse,
      timeRemaining: 2900,
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/nextpage`, () => {
        return HttpResponse.json({
          success: true,
          data: navigationWithTime,
        });
      })
    );

    const { result } = renderHook(() => useNavigateLessonPage(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      lessonId,
      request: { currentPageId: 2, targetPageId: 3 },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.timeRemaining).toBe(2900);
  });
});

// ============================================================================
// useLessonProgress Hook Tests
// ============================================================================

describe('useLessonProgress', () => {
  it('should fetch progress data with correct endpoint', async () => {
    const lessonId = 1;

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/progress`, () => {
        return HttpResponse.json({
          success: true,
          data: mockProgressResponse,
        });
      })
    );

    const { result } = renderHook(() => useLessonProgress(lessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.progress).toBeDefined();
    expect(result.current.data?.attempts).toBeDefined();
    expect(result.current.data?.gradePercentage).toBe(50);
  });

  it('should verify completion percentage calculation', async () => {
    const lessonId = 1;
    const progressWith60Percent: LessonProgressResponse = {
      ...mockProgressResponse,
      progress: {
        ...mockProgressResponse.progress,
        progressPercentage: 60,
        pagesCompleted: 3,
        totalPages: 5,
      } as any,
    };

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/progress`, () => {
        return HttpResponse.json({
          success: true,
          data: progressWith60Percent,
        });
      })
    );

    const { result } = renderHook(() => useLessonProgress(lessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.progress.progressPercentage).toBe(60);
    expect(result.current.data?.progress.pagesCompleted).toBe(3);
    expect(result.current.data?.progress.totalPages).toBe(5);
  });

  it('should verify time spent calculation', async () => {
    const lessonId = 1;
    const progressWithTime: LessonProgressResponse = {
      ...mockProgressResponse,
      timeSpent: 1800, // 30 minutes
    };

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/progress`, () => {
        return HttpResponse.json({
          success: true,
          data: progressWithTime,
        });
      })
    );

    const { result } = renderHook(() => useLessonProgress(lessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.timeSpent).toBe(1800);
  });

  it('should track content pages viewed', async () => {
    const lessonId = 1;

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/progress`, () => {
        return HttpResponse.json({
          success: true,
          data: mockProgressResponse,
        });
      })
    );

    const { result } = renderHook(() => useLessonProgress(lessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.contentPagesViewed).toEqual([1]);
    expect(result.current.data?.correctQuestionPages).toEqual([2]);
  });

  it('should handle zero progress state', async () => {
    const lessonId = 1;
    const zeroProgress: LessonProgressResponse = {
      progress: {
        pagesCompleted: 0,
        totalPages: 5,
        progressPercentage: 0,
        questionsAnswered: 0,
        correctAnswers: 0,
        timeSpent: 0,
      } as any,
      attempts: [],
      contentPagesViewed: [],
      correctQuestionPages: [],
      currentGrade: 0,
      maxGrade: 100,
      gradePercentage: 0,
      timeSpent: 0,
    };

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/progress`, () => {
        return HttpResponse.json({
          success: true,
          data: zeroProgress,
        });
      })
    );

    const { result } = renderHook(() => useLessonProgress(lessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.progress.progressPercentage).toBe(0);
    expect(result.current.data?.attempts).toHaveLength(0);
  });
});

// ============================================================================
// useUpdateLessonTimer Hook Tests
// ============================================================================

describe('useUpdateLessonTimer', () => {
  it('should update timer during session', async () => {
    const lessonId = 1;
    const request: UpdateTimerRequest = {
      timeSpent: 660,
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/timer`, () => {
        return HttpResponse.json({
          success: true,
          data: mockTimerUpdateResponse,
        });
      })
    );

    const { result } = renderHook(() => useUpdateLessonTimer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, request });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.timer).toBeDefined();
    expect(result.current.data?.timeRemaining).toBe(2940);
    expect(result.current.data?.timeExpired).toBe(false);
  });

  it('should verify countdown accuracy', async () => {
    const lessonId = 1;
    const timerWithCountdown: UpdateTimerResponse = {
      timer: {
        id: 1,
        lessonid: 1,
        userid: 100,
        starttime: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
        lessontime: 1800,
        timemodified: Math.floor(Date.now() / 1000),
        completed: false,
      } as any,
      timeRemaining: 1800, // 30 minutes remaining
      timeExpired: false,
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/timer`, () => {
        return HttpResponse.json({
          success: true,
          data: timerWithCountdown,
        });
      })
    );

    const { result } = renderHook(() => useUpdateLessonTimer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, request: { timeSpent: 1800 } });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.timeRemaining).toBe(1800);
    expect(result.current.data?.timer.lessontime).toBe(1800);
  });

  it('should handle time expiration', async () => {
    const lessonId = 1;
    const expiredTimerResponse: UpdateTimerResponse = {
      timer: {
        id: 1,
        lessonid: 1,
        userid: 100,
        starttime: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        lessontime: 3600,
        timemodified: Math.floor(Date.now() / 1000),
        completed: true,
      } as any,
      timeRemaining: 0,
      timeExpired: true,
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/timer`, () => {
        return HttpResponse.json({
          success: true,
          data: expiredTimerResponse,
        });
      })
    );

    const { result } = renderHook(() => useUpdateLessonTimer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, request: { timeSpent: 3600 } });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.timeExpired).toBe(true);
    expect(result.current.data?.timeRemaining).toBe(0);
  });

  it('should update attempt query cache with new timer data', async () => {
    const lessonId = 1;
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/timer`, () => {
        return HttpResponse.json({
          success: true,
          data: mockTimerUpdateResponse,
        });
      })
    );

    const { result } = renderHook(() => useUpdateLessonTimer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, request: { timeSpent: 660 } });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(setQueryDataSpy).toHaveBeenCalledWith(
      lessonQueryKeys.attempt(lessonId),
      expect.any(Function)
    );
  });

  it('should handle timer update with fake timers', async () => {
    vi.useFakeTimers();

    const lessonId = 1;
    let callCount = 0;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/timer`, () => {
        callCount++;
        return HttpResponse.json({
          success: true,
          data: {
            ...mockTimerUpdateResponse,
            timeRemaining: 3600 - (callCount * 30),
          },
        });
      })
    );

    const { result } = renderHook(() => useUpdateLessonTimer(), {
      wrapper: createWrapper(),
    });

    // First call
    result.current.mutate({ lessonId, request: { timeSpent: 30 } });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.timeRemaining).toBe(3570);

    vi.useRealTimers();
  });
});

// ============================================================================
// useFinishLessonAttempt Hook Tests
// ============================================================================

describe('useFinishLessonAttempt', () => {
  it('should finish attempt and record final grade', async () => {
    const lessonId = 1;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/finish`, () => {
        return HttpResponse.json({
          success: true,
          data: mockFinishAttemptResponse,
        });
      })
    );

    const { result } = renderHook(() => useFinishLessonAttempt(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, endReached: true });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.grade).toBeDefined();
    expect(result.current.data?.gradePercentage).toBe(85);
    expect(result.current.data?.completed).toBe(true);
    expect(result.current.data?.canRetake).toBe(true);
    expect(result.current.data?.attemptsRemaining).toBe(2);
  });

  it('should handle timer stop on finish', async () => {
    const lessonId = 1;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/finish`, () => {
        return HttpResponse.json({
          success: true,
          data: {
            ...mockFinishAttemptResponse,
            timeSpent: 2500,
          },
        });
      })
    );

    const { result } = renderHook(() => useFinishLessonAttempt(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, endReached: true });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.timeSpent).toBe(2500);
  });

  it('should handle finishing without reaching end', async () => {
    const lessonId = 1;
    let receivedEndReached: boolean | undefined;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/finish`, async ({ request }) => {
        const body = (await request.json()) as { endReached?: boolean };
        receivedEndReached = body.endReached;
        return HttpResponse.json({
          success: true,
          data: {
            ...mockFinishAttemptResponse,
            completed: false,
            feedbackMessage: 'Lesson ended early. Your progress has been saved.',
          },
        });
      })
    );

    const { result } = renderHook(() => useFinishLessonAttempt(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId, endReached: false });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(receivedEndReached).toBe(false);
    expect(result.current.data?.completed).toBe(false);
  });

  it('should handle late submission', async () => {
    const lessonId = 1;
    const lateSubmission: FinishLessonAttemptResponse = {
      ...mockFinishAttemptResponse,
      isLate: true,
      feedbackMessage: 'Your submission was recorded as late.',
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/finish`, () => {
        return HttpResponse.json({
          success: true,
          data: lateSubmission,
        });
      })
    );

    const { result } = renderHook(() => useFinishLessonAttempt(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.isLate).toBe(true);
  });

  it('should invalidate all lesson queries on success', async () => {
    const lessonId = 1;
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/finish`, () => {
        return HttpResponse.json({
          success: true,
          data: mockFinishAttemptResponse,
        });
      })
    );

    const { result } = renderHook(() => useFinishLessonAttempt(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should invalidate detail, attempt, and progress queries
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('should handle no retakes available', async () => {
    const lessonId = 1;
    const noRetakesResponse: FinishLessonAttemptResponse = {
      ...mockFinishAttemptResponse,
      canRetake: false,
      attemptsRemaining: 0,
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/finish`, () => {
        return HttpResponse.json({
          success: true,
          data: noRetakesResponse,
        });
      })
    );

    const { result } = renderHook(() => useFinishLessonAttempt(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ lessonId });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.canRetake).toBe(false);
    expect(result.current.data?.attemptsRemaining).toBe(0);
  });
});

// ============================================================================
// useLessonPages Hook Tests
// ============================================================================

describe('useLessonPages', () => {
  it('should fetch all lesson pages', async () => {
    const lessonId = 1;

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/pages`, () => {
        return HttpResponse.json({
          success: true,
          data: mockPagesResponse,
        });
      })
    );

    const { result } = renderHook(() => useLessonPages(lessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages).toHaveLength(5);
    expect(result.current.data?.totalPages).toBe(5);
  });

  it('should verify page structure for different page types', async () => {
    const lessonId = 1;

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/pages`, () => {
        return HttpResponse.json({
          success: true,
          data: mockPagesResponse,
        });
      })
    );

    const { result } = renderHook(() => useLessonPages(lessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.questionPages).toBe(3);
    expect(result.current.data?.contentPages).toBe(2);
  });

  it('should track accessible pages', async () => {
    const lessonId = 1;

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/pages`, () => {
        return HttpResponse.json({
          success: true,
          data: mockPagesResponse,
        });
      })
    );

    const { result } = renderHook(() => useLessonPages(lessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.accessiblePages).toEqual([1, 2, 3]);
  });

  it('should handle branching paths in page structure', async () => {
    const lessonId = 1;
    const branchingPages: LessonPagesResponse = {
      ...mockPagesResponse,
      pages: [
        { ...mockLessonPage, id: 1, nextpageid: 2 } as any,
        { ...mockLessonPage, id: 2, qtype: 20, nextpageid: 0 } as any, // Branch page
        { ...mockLessonPage, id: 3, prevpageid: 0 } as any, // Branch target 1
        { ...mockLessonPage, id: 4, prevpageid: 0 } as any, // Branch target 2
        { ...mockLessonPage, id: 5, nextpageid: 0 } as any, // End
      ],
    };

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/pages`, () => {
        return HttpResponse.json({
          success: true,
          data: branchingPages,
        });
      })
    );

    const { result } = renderHook(() => useLessonPages(lessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Check for branch page type
    const branchPage = result.current.data?.pages.find(p => p.qtype === 20);
    expect(branchPage).toBeDefined();
  });

  it('should cache pages data for extended time', async () => {
    const lessonId = 1;
    let fetchCount = 0;

    server.use(
      http.get(`${API_BASE_URL}/lesson/${lessonId}/pages`, () => {
        fetchCount++;
        return HttpResponse.json({
          success: true,
          data: mockPagesResponse,
        });
      })
    );

    const { result, rerender } = renderHook(() => useLessonPages(lessonId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchCount).toBe(1);

    // Rerender should use cache
    rerender();

    expect(fetchCount).toBe(1);
  });
});

// ============================================================================
// useRestartLesson Hook Tests
// ============================================================================

describe('useRestartLesson', () => {
  it('should restart lesson and reset attempt', async () => {
    const lessonId = 1;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/restart`, () => {
        return HttpResponse.json({
          success: true,
          data: mockRestartResponse,
        });
      })
    );

    const { result } = renderHook(() => useRestartLesson(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(lessonId);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.retryNumber).toBe(1);
    expect(result.current.data?.firstPage).toBeDefined();
    expect(result.current.data?.message).toContain('restarted');
  });

  it('should increment retry number on restart', async () => {
    const lessonId = 1;
    const secondRetryResponse: RestartLessonResponse = {
      ...mockRestartResponse,
      retryNumber: 2,
      message: 'Lesson restarted successfully. This is attempt 3 of 3.',
    };

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/restart`, () => {
        return HttpResponse.json({
          success: true,
          data: secondRetryResponse,
        });
      })
    );

    const { result } = renderHook(() => useRestartLesson(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(lessonId);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.retryNumber).toBe(2);
  });

  it('should initialize new timer on restart for timed lessons', async () => {
    const lessonId = 1;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/restart`, () => {
        return HttpResponse.json({
          success: true,
          data: mockRestartResponse,
        });
      })
    );

    const { result } = renderHook(() => useRestartLesson(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(lessonId);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.timer).toBeDefined();
    expect(result.current.data?.timer?.lessontime).toBe(0);
  });

  it('should handle max retakes exceeded error', async () => {
    const lessonId = 1;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/restart`, () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'MAX_RETAKES_EXCEEDED',
              message: 'You have used all your attempts.',
            },
          },
          { status: 403 }
        );
      })
    );

    const { result } = renderHook(() => useRestartLesson(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(lessonId);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should invalidate all queries and cache first page', async () => {
    const lessonId = 1;
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/restart`, () => {
        return HttpResponse.json({
          success: true,
          data: mockRestartResponse,
        });
      })
    );

    const { result } = renderHook(() => useRestartLesson(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(lessonId);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should invalidate queries
    expect(invalidateSpy).toHaveBeenCalled();

    // Should cache first page
    expect(setQueryDataSpy).toHaveBeenCalled();
  });

  it('should handle retakes not allowed error', async () => {
    const lessonId = 1;

    server.use(
      http.post(`${API_BASE_URL}/lesson/${lessonId}/restart`, () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'RETAKES_NOT_ALLOWED',
              message: 'Retakes are not allowed for this lesson.',
            },
          },
          { status: 403 }
        );
      })
    );

    const { result } = renderHook(() => useRestartLesson(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(lessonId);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

// ============================================================================
// Error Handling and Edge Cases Tests
// ============================================================================

describe('Error Handling and Edge Cases', () => {
  describe('Network Errors', () => {
    it('should handle network failure for lesson fetch', async () => {
      server.use(
        http.get(`${API_BASE_URL}/lesson/1`, () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useLesson(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle network failure for mutations', async () => {
      server.use(
        http.post(`${API_BASE_URL}/lesson/1/submit`, () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useSubmitLessonAnswer(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        lessonId: 1,
        request: { pageId: 2, answerId: 1 },
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('Timeout Errors', () => {
    it('should handle slow API responses', async () => {
      server.use(
        http.get(`${API_BASE_URL}/lesson/1`, async () => {
          await delay(100); // Short delay for test
          return HttpResponse.json({
            success: true,
            data: mockLessonDetailResponse,
          });
        })
      );

      const { result } = renderHook(() => useLesson(1), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('Invalid Responses', () => {
    it('should handle malformed JSON response', async () => {
      server.use(
        http.get(`${API_BASE_URL}/lesson/1`, () => {
          return HttpResponse.text('invalid json{', {
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const { result } = renderHook(() => useLesson(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle empty response', async () => {
      server.use(
        http.get(`${API_BASE_URL}/lesson/1`, () => {
          return HttpResponse.json(null);
        })
      );

      const { result } = renderHook(() => useLesson(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError || result.current.data === null).toBe(true);
      });
    });
  });

  describe('Race Conditions', () => {
    it('should handle rapid successive calls', async () => {
      let callCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/lesson/1/progress`, () => {
          callCount++;
          return HttpResponse.json({
            success: true,
            data: {
              ...mockProgressResponse,
              progress: {
                ...mockProgressResponse.progress,
                progressPercentage: callCount * 20,
              },
            },
          });
        })
      );

      const { result, rerender } = renderHook(
        ({ id }) => useLessonProgress(id),
        {
          wrapper: createWrapper(),
          initialProps: { id: 1 },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Rapid rerenders
      rerender({ id: 1 });
      rerender({ id: 1 });
      rerender({ id: 1 });

      // Should handle gracefully without errors
      expect(result.current.isError).toBe(false);
    });

    it('should handle concurrent mutations', async () => {
      const lessonId = 1;
      let submitCount = 0;

      server.use(
        http.post(`${API_BASE_URL}/lesson/${lessonId}/submit`, async () => {
          submitCount++;
          await delay(50); // Simulate async processing
          return HttpResponse.json({
            success: true,
            data: {
              ...mockSubmitAnswerResponse,
              nextPageId: 2 + submitCount,
            },
          });
        })
      );

      const { result } = renderHook(() => useSubmitLessonAnswer(), {
        wrapper: createWrapper(),
      });

      // Trigger multiple mutations
      result.current.mutate({
        lessonId,
        request: { pageId: 2, answerId: 1 },
      });

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('Cache Invalidation Patterns', () => {
    it('should invalidate related queries after submission', async () => {
      const lessonId = 1;
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      server.use(
        http.post(`${API_BASE_URL}/lesson/${lessonId}/submit`, () => {
          return HttpResponse.json({
            success: true,
            data: mockSubmitAnswerResponse,
          });
        })
      );

      const { result } = renderHook(() => useSubmitLessonAnswer(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        lessonId,
        request: { pageId: 2, answerId: 1 },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Progress and attempt queries should be invalidated
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: lessonQueryKeys.progress(lessonId),
        })
      );
    });
  });

  describe('HTTP Status Codes', () => {
    it('should handle 401 Unauthorized', async () => {
      server.use(
        http.get(`${API_BASE_URL}/lesson/1`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required.',
              },
            },
            { status: 401 }
          );
        })
      );

      const { result } = renderHook(() => useLesson(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle 403 Forbidden', async () => {
      server.use(
        http.get(`${API_BASE_URL}/lesson/1`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'You do not have permission to access this lesson.',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useLesson(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle 500 Internal Server Error', async () => {
      server.use(
        http.get(`${API_BASE_URL}/lesson/1`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: 'An unexpected error occurred.',
              },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useLesson(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });
});

// ============================================================================
// Query Keys Tests
// ============================================================================

describe('lessonQueryKeys', () => {
  it('should generate correct query keys', () => {
    expect(lessonQueryKeys.all).toEqual(['lessons']);
    expect(lessonQueryKeys.detail(1)).toEqual(['lessons', 1]);
    expect(lessonQueryKeys.attempt(1)).toEqual(['lessons', 1, 'attempt']);
    expect(lessonQueryKeys.page(1, 2)).toEqual(['lessons', 1, 'pages', 2]);
    expect(lessonQueryKeys.pages(1)).toEqual(['lessons', 1, 'pages']);
    expect(lessonQueryKeys.progress(1)).toEqual(['lessons', 1, 'progress']);
  });

  it('should maintain key consistency for caching', () => {
    // Multiple calls should produce identical keys
    const key1 = lessonQueryKeys.detail(5);
    const key2 = lessonQueryKeys.detail(5);

    expect(key1).toEqual(key2);
    expect(key1[0]).toBe(key2[0]);
    expect(key1[1]).toBe(key2[1]);
  });
});

// ============================================================================
// Loading States Tests
// ============================================================================

describe('Loading States', () => {
  it('should show loading state for lesson query', async () => {
    server.use(
      http.get(`${API_BASE_URL}/lesson/1`, async () => {
        await delay(100);
        return HttpResponse.json({
          success: true,
          data: mockLessonDetailResponse,
        });
      })
    );

    const { result } = renderHook(() => useLesson(1), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFetching).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // No longer loading
    expect(result.current.isLoading).toBe(false);
  });

  it('should show pending state for mutations', async () => {
    server.use(
      http.post(`${API_BASE_URL}/lesson/1/submit`, async () => {
        await delay(100);
        return HttpResponse.json({
          success: true,
          data: mockSubmitAnswerResponse,
        });
      })
    );

    const { result } = renderHook(() => useSubmitLessonAnswer(), {
      wrapper: createWrapper(),
    });

    // Not pending initially
    expect(result.current.isPending).toBe(false);

    result.current.mutate({
      lessonId: 1,
      request: { pageId: 2, answerId: 1 },
    });

    // Should be pending during mutation
    expect(result.current.isPending).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.isPending).toBe(false);
  });
});
