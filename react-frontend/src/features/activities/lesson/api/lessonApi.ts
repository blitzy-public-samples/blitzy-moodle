/**
 * Lesson API
 *
 * React Query hooks and API functions for lesson activity operations.
 * Integrates with lesson API endpoints that wrap existing Moodle lesson functions
 * including page navigation, timer management, answer submission, and progress tracking.
 *
 * The lesson module provides interactive content with branching navigation paths.
 * Students progress through pages by answering questions, with the path determined
 * by their responses. Key features include:
 * - Time-limited attempts with server-side timer tracking
 * - Password protection and dependency prerequisites
 * - Retry/retake management with configurable limits
 * - Grade calculation based on question responses
 *
 * All hooks integrate with React Query for caching, optimistic updates, and
 * automatic refetching. Uses TypeScript for type safety with proper interfaces.
 *
 * @module features/activities/lesson/api/lessonApi
 */

import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { LESSON_ENDPOINTS } from '@/services/api/endpoints';
import type { ApiResponse } from '@/types/api';
import type {
  Lesson,
  LessonPage,
  Answer,
  LessonAttempt,
  LessonProgress,
  LessonTimer,
  LessonGrade,
  QuestionType,
} from '../types/lesson.types';

// ============================================================================
// Response Types
// ============================================================================

/**
 * Lesson detail response with access information
 *
 * Contains the lesson configuration, access status, and attempt information
 * for the current user.
 */
export interface LessonDetailResponse {
  /** The lesson entity with all settings */
  lesson: Lesson;

  /** Whether the user can access the lesson */
  canAccess: boolean;

  /** Whether the lesson requires a password */
  requiresPassword: boolean;

  /** Whether the password has been provided */
  passwordProvided: boolean;

  /** Dependency lesson that must be completed first */
  dependencyLesson?: Lesson | null;

  /** Whether the dependency is satisfied */
  dependencySatisfied: boolean;

  /** Whether the lesson is within the available time window */
  isAvailable: boolean;

  /** Availability message if not available */
  availabilityMessage?: string;

  /** Maximum number of attempts allowed */
  maxAttempts: number;

  /** Number of attempts used by the user */
  attemptsUsed: number;

  /** Whether retakes are allowed */
  canRetake: boolean;
}

/**
 * Lesson attempt status response
 *
 * Contains information about the user's current attempt including
 * timer status, progress, and last page seen.
 */
export interface LessonAttemptResponse {
  /** Current retry number (0-indexed) */
  retryCount: number;

  /** Last page ID seen in the current attempt */
  lastPageSeen: number | null;

  /** Whether there is an active timer */
  hasActiveTimer: boolean;

  /** Timer information if active */
  timer?: LessonTimer;

  /** Time remaining in seconds (for timed lessons) */
  timeRemaining: number | null;

  /** Whether the lesson has a time limit */
  hasTimeLimit: boolean;

  /** Total time spent in the lesson */
  timeSpent: number;

  /** Whether the current attempt is in progress */
  inProgress: boolean;

  /** Array of page IDs that have been visited */
  visitedPages: number[];

  /** Current progress percentage */
  progressPercentage: number;
}

/**
 * Start lesson attempt response
 *
 * Returned when starting a new lesson attempt, includes the first page
 * and timer information.
 */
export interface StartLessonAttemptResponse {
  /** ID of the first page to display */
  firstPageId: number;

  /** The first page content */
  firstPage: LessonPage;

  /** Timer information for timed lessons */
  timer?: LessonTimer;

  /** The retry number for this attempt */
  retryNumber: number;

  /** Whether the lesson is timed */
  isTimed: boolean;

  /** Time limit in seconds (0 = no limit) */
  timeLimit: number;
}

/**
 * Lesson page response with navigation options
 *
 * Contains the page content, answers, and navigation information.
 */
export interface LessonPageResponse {
  /** The page entity with content */
  page: LessonPage;

  /** Available answers for question pages */
  answers: Answer[];

  /** Whether this is a question page */
  isQuestion: boolean;

  /** Question type for question pages */
  questionType?: QuestionType;

  /** Whether navigation back is allowed */
  canGoBack: boolean;

  /** Previous page ID if available */
  previousPageId: number | null;

  /** Navigation options based on lesson settings */
  navigationOptions: NavigationOption[];

  /** Media files associated with the page */
  mediaFiles: MediaFile[];

  /** Time remaining in seconds (for timed lessons) */
  timeRemaining: number | null;
}

/**
 * Navigation option for branch pages
 */
export interface NavigationOption {
  /** Button/link label */
  label: string;

  /** Target page ID or navigation constant */
  jumpto: number;

  /** Whether this is a special navigation (end, next unseen, etc.) */
  isSpecial: boolean;
}

/**
 * Media file associated with a lesson page
 */
export interface MediaFile {
  /** File ID */
  id: number;

  /** File name */
  filename: string;

  /** File URL */
  url: string;

  /** MIME type */
  mimetype: string;

  /** File size in bytes */
  filesize: number;
}

/**
 * Submit answer request
 */
export interface SubmitAnswerRequest {
  /** Page ID where the answer is submitted */
  pageId: number;

  /** Selected answer ID for multiple choice */
  answerId?: number;

  /** User's typed answer for short answer/essay */
  userAnswer?: string;

  /** Array of answer IDs for matching questions */
  matchingAnswers?: Record<number, number>;

  /** Jump target for branch pages */
  jumpto?: number;
}

/**
 * Submit answer response
 *
 * Contains feedback and navigation information after submitting an answer.
 */
export interface SubmitAnswerResponse {
  /** Whether the answer was correct */
  isCorrect: boolean;

  /** Score earned for this response */
  score: number;

  /** Maximum possible score for the question */
  maxScore: number;

  /** Feedback text to display */
  feedback: string;

  /** Next page ID based on the answer */
  nextPageId: number;

  /** Whether the lesson has ended */
  lessonEnded: boolean;

  /** The correct answer(s) if showing */
  correctAnswer?: string;

  /** Attempt record created */
  attempt: LessonAttempt;

  /** Updated progress after submission */
  progress: LessonProgress;

  /** Time remaining after submission */
  timeRemaining: number | null;
}

/**
 * Navigate page request
 */
export interface NavigatePageRequest {
  /** Current page ID */
  currentPageId: number;

  /** Target page ID or navigation constant */
  targetPageId: number;
}

/**
 * Navigate page response
 */
export interface NavigatePageResponse {
  /** The target page to display */
  page: LessonPage;

  /** Answers for the page */
  answers: Answer[];

  /** Updated progress */
  progress: LessonProgress;

  /** Time remaining */
  timeRemaining: number | null;
}

/**
 * Lesson progress response
 */
export interface LessonProgressResponse {
  /** Progress tracking data */
  progress: LessonProgress;

  /** All attempts for this retry */
  attempts: LessonAttempt[];

  /** Content pages viewed */
  contentPagesViewed: number[];

  /** Question pages answered correctly */
  correctQuestionPages: number[];

  /** Current grade earned */
  currentGrade: number;

  /** Maximum possible grade */
  maxGrade: number;

  /** Grade percentage */
  gradePercentage: number;

  /** Time spent in seconds */
  timeSpent: number;
}

/**
 * Update timer request
 */
export interface UpdateTimerRequest {
  /** Start time of the timer (Unix timestamp) */
  startTime?: number;

  /** Current time spent */
  timeSpent?: number;
}

/**
 * Update timer response
 */
export interface UpdateTimerResponse {
  /** Updated timer record */
  timer: LessonTimer;

  /** Time remaining in seconds */
  timeRemaining: number;

  /** Whether time has expired */
  timeExpired: boolean;
}

/**
 * Finish lesson attempt response
 */
export interface FinishLessonAttemptResponse {
  /** Final grade for the attempt */
  grade: LessonGrade;

  /** Grade as a percentage */
  gradePercentage: number;

  /** Total time spent */
  timeSpent: number;

  /** Whether the lesson was completed successfully */
  completed: boolean;

  /** Whether the submission was late */
  isLate: boolean;

  /** Feedback message based on grade */
  feedbackMessage: string;

  /** Whether retakes are available */
  canRetake: boolean;

  /** Attempts remaining */
  attemptsRemaining: number | null;
}

/**
 * Lesson pages list response
 */
export interface LessonPagesResponse {
  /** All pages in the lesson */
  pages: LessonPage[];

  /** Total page count */
  totalPages: number;

  /** Question page count */
  questionPages: number;

  /** Content page count */
  contentPages: number;

  /** Pages accessible for navigation (based on settings) */
  accessiblePages: number[];
}

/**
 * Restart lesson response
 */
export interface RestartLessonResponse {
  /** New retry number */
  retryNumber: number;

  /** First page to display */
  firstPage: LessonPage;

  /** New timer if lesson is timed */
  timer?: LessonTimer;

  /** Success message */
  message: string;
}

/**
 * Next page request
 */
export interface NextPageRequest {
  /** Current page ID */
  currentPageId: number;

  /** Selected answer ID (for question pages) */
  answerId?: number;
}

/**
 * Next page response
 */
export interface NextPageResponse {
  /** Next page to display */
  nextPage: LessonPage;

  /** Answers for the next page */
  answers: Answer[];

  /** Whether this is the last page */
  isLastPage: boolean;

  /** Navigation constant if special navigation */
  navigationConstant?: number;
}

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query key factory for lesson-related queries
 *
 * Provides consistent query keys for React Query caching and invalidation.
 */
export const lessonQueryKeys = {
  /** All lesson queries */
  all: ['lessons'] as const,

  /** Single lesson detail */
  detail: (id: number) => ['lessons', id] as const,

  /** Lesson attempt information */
  attempt: (lessonId: number) => ['lessons', lessonId, 'attempt'] as const,

  /** Specific lesson page */
  page: (lessonId: number, pageId: number) => ['lessons', lessonId, 'pages', pageId] as const,

  /** All lesson pages */
  pages: (lessonId: number) => ['lessons', lessonId, 'pages'] as const,

  /** Lesson progress */
  progress: (lessonId: number) => ['lessons', lessonId, 'progress'] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch lesson details and access information
 *
 * Calls GET /api/v1/lesson/{id} which wraps existing Moodle lesson functions
 * to retrieve lesson settings, access status, and attempt information.
 *
 * @param lessonId - Lesson ID
 * @returns Lesson details with access information
 */
export async function fetchLessonDetail(lessonId: number): Promise<LessonDetailResponse> {
  const response = await apiClient.get<ApiResponse<LessonDetailResponse>>(
    LESSON_ENDPOINTS.DETAIL(lessonId)
  );

  return response.data.data;
}

/**
 * Fetch user's current attempt status
 *
 * Calls GET /api/v1/lesson/{id}/attempt which retrieves the user's current
 * attempt information including retry count, timer status, and last page seen.
 * References view.php lines 121-141 and locallib.php get_last_page_seen().
 *
 * @param lessonId - Lesson ID
 * @returns Attempt status information
 */
export async function fetchLessonAttempt(lessonId: number): Promise<LessonAttemptResponse> {
  const response = await apiClient.get<ApiResponse<LessonAttemptResponse>>(
    LESSON_ENDPOINTS.ATTEMPT(lessonId)
  );

  return response.data.data;
}

/**
 * Start a new lesson attempt
 *
 * Calls POST /api/v1/lesson/{id}/start which wraps existing Moodle
 * lesson start_timer() function and initializes a new attempt.
 * References view.php lines 194-196 and locallib.php start_timer() method.
 *
 * @param lessonId - Lesson ID
 * @param password - Optional password for password-protected lessons
 * @returns Start attempt response with first page
 */
export async function startLessonAttempt(
  lessonId: number,
  password?: string
): Promise<StartLessonAttemptResponse> {
  const response = await apiClient.post<ApiResponse<StartLessonAttemptResponse>>(
    LESSON_ENDPOINTS.START(lessonId),
    { password }
  );

  return response.data.data;
}

/**
 * Fetch specific lesson page content
 *
 * Calls GET /api/v1/lesson/{id}/page/{pageId} which retrieves the page
 * content including question, answers, media files, and navigation options.
 * References view.php lines 95-97 and locallib.php load_page() method.
 *
 * @param lessonId - Lesson ID
 * @param pageId - Page ID
 * @returns Page content with navigation options
 */
export async function fetchLessonPage(
  lessonId: number,
  pageId: number
): Promise<LessonPageResponse> {
  const response = await apiClient.get<ApiResponse<LessonPageResponse>>(
    LESSON_ENDPOINTS.PAGE(lessonId, pageId)
  );

  return response.data.data;
}

/**
 * Fetch the next page in the lesson sequence
 *
 * Calls POST /api/v1/lesson/{id}/nextpage which determines the next page
 * based on navigation logic and optionally the selected answer.
 * References locallib.php get_next_page() method.
 *
 * @param lessonId - Lesson ID
 * @param request - Current page ID and optional answer
 * @returns Next page response
 */
export async function fetchNextLessonPage(
  lessonId: number,
  request: NextPageRequest
): Promise<NextPageResponse> {
  const response = await apiClient.post<ApiResponse<NextPageResponse>>(
    LESSON_ENDPOINTS.NEXT_PAGE(lessonId),
    request
  );

  return response.data.data;
}

/**
 * Submit answer for a lesson page
 *
 * Calls POST /api/v1/lesson/{id}/submit which wraps existing Moodle
 * process_page_responses() function to submit and grade the answer.
 * References continue.php lines 64-78 and locallib.php process_page_responses().
 *
 * @param lessonId - Lesson ID
 * @param request - Answer submission data
 * @returns Submission result with feedback and next page
 */
export async function submitLessonAnswer(
  lessonId: number,
  request: SubmitAnswerRequest
): Promise<SubmitAnswerResponse> {
  const response = await apiClient.post<ApiResponse<SubmitAnswerResponse>>(
    LESSON_ENDPOINTS.SUBMIT(lessonId),
    request
  );

  return response.data.data;
}

/**
 * Navigate to a specific page in the lesson
 *
 * Handles navigation for branch pages and content pages where no answer
 * is required. References continue.php lines 72-75 redirect logic.
 *
 * @param lessonId - Lesson ID
 * @param request - Navigation request with current and target page
 * @returns Navigation result with target page content
 */
export async function navigateLessonPage(
  lessonId: number,
  request: NavigatePageRequest
): Promise<NavigatePageResponse> {
  const response = await apiClient.post<ApiResponse<NavigatePageResponse>>(
    LESSON_ENDPOINTS.NEXT_PAGE(lessonId),
    {
      currentPageId: request.currentPageId,
      jumpto: request.targetPageId,
    }
  );

  return response.data.data;
}

/**
 * Fetch user's progress through the lesson
 *
 * Calls GET /api/v1/lesson/{id}/progress which retrieves progress data
 * including completed pages, grades, and time spent.
 * References locallib.php get_attempts() and get_content_pages_viewed().
 *
 * @param lessonId - Lesson ID
 * @returns Progress data
 */
export async function fetchLessonProgress(lessonId: number): Promise<LessonProgressResponse> {
  const response = await apiClient.get<ApiResponse<LessonProgressResponse>>(
    LESSON_ENDPOINTS.PROGRESS(lessonId)
  );

  return response.data.data;
}

/**
 * Update the lesson timer
 *
 * Calls POST /api/v1/lesson/{id}/timer which updates the timer record
 * during a timed lesson session.
 * References continue.php lines 52-62 and locallib.php update_timer() method.
 *
 * @param lessonId - Lesson ID
 * @param request - Timer update data
 * @returns Updated timer information
 */
export async function updateLessonTimer(
  lessonId: number,
  request: UpdateTimerRequest
): Promise<UpdateTimerResponse> {
  const response = await apiClient.post<ApiResponse<UpdateTimerResponse>>(
    LESSON_ENDPOINTS.UPDATE_TIMER(lessonId),
    request
  );

  return response.data.data;
}

/**
 * Finish a lesson attempt
 *
 * Calls POST /api/v1/lesson/{id}/finish which stops the timer and
 * finalizes the grade for the attempt.
 * References locallib.php stop_timer() and update_timer() with endreached parameter.
 *
 * @param lessonId - Lesson ID
 * @param endReached - Whether the user reached the end naturally
 * @returns Final grade and completion status
 */
export async function finishLessonAttempt(
  lessonId: number,
  endReached: boolean = true
): Promise<FinishLessonAttemptResponse> {
  const response = await apiClient.post<ApiResponse<FinishLessonAttemptResponse>>(
    LESSON_ENDPOINTS.FINISH(lessonId),
    { endReached }
  );

  return response.data.data;
}

/**
 * Fetch all pages in the lesson
 *
 * Calls GET /api/v1/lesson/{id}/pages which retrieves all pages for
 * navigation overview and menu display.
 * References locallib.php load_all_pages() method.
 *
 * @param lessonId - Lesson ID
 * @returns All lesson pages
 */
export async function fetchLessonPages(lessonId: number): Promise<LessonPagesResponse> {
  const response = await apiClient.get<ApiResponse<LessonPagesResponse>>(
    LESSON_ENDPOINTS.PAGES(lessonId)
  );

  return response.data.data;
}

/**
 * Restart the lesson from the beginning
 *
 * Calls POST /api/v1/lesson/{id}/restart which starts a new retry
 * if retakes are allowed.
 * References view.php lines 174-183 retake logic and locallib.php retake property.
 *
 * @param lessonId - Lesson ID
 * @returns Restart response with new first page
 */
export async function restartLesson(lessonId: number): Promise<RestartLessonResponse> {
  const response = await apiClient.post<ApiResponse<RestartLessonResponse>>(
    LESSON_ENDPOINTS.RESTART(lessonId)
  );

  return response.data.data;
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch lesson details with React Query
 *
 * Retrieves lesson configuration, access status, and attempt information.
 * Data is cached for 5 minutes with automatic background refetching.
 *
 * @param lessonId - Lesson ID
 * @param enabled - Whether query should run automatically (default: true)
 * @returns Query result with lesson details
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useLesson(lessonId);
 *
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return <LessonHeader lesson={data.lesson} />;
 * ```
 */
export function useLesson(
  lessonId: number,
  enabled: boolean = true
): UseQueryResult<LessonDetailResponse, Error> {
  return useQuery({
    queryKey: lessonQueryKeys.detail(lessonId),
    queryFn: () => fetchLessonDetail(lessonId),
    enabled: enabled && lessonId > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

/**
 * Hook to fetch current user's attempt status
 *
 * Retrieves retry count, last page seen, timer status, and progress.
 * Data is cached for 30 seconds to balance freshness with performance.
 *
 * @param lessonId - Lesson ID
 * @param enabled - Whether query should run automatically (default: true)
 * @returns Query result with attempt status
 *
 * @example
 * ```tsx
 * const { data: attempt } = useLessonAttempt(lessonId);
 *
 * if (attempt?.inProgress) {
 *   // Resume from last page
 *   navigateToPage(attempt.lastPageSeen);
 * }
 * ```
 */
export function useLessonAttempt(
  lessonId: number,
  enabled: boolean = true
): UseQueryResult<LessonAttemptResponse, Error> {
  return useQuery({
    queryKey: lessonQueryKeys.attempt(lessonId),
    queryFn: () => fetchLessonAttempt(lessonId),
    enabled: enabled && lessonId > 0,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to start a new lesson attempt
 *
 * Creates a mutation for starting a new lesson attempt, which initializes
 * the timer and retrieves the first page. On success, invalidates related
 * queries to refresh attempt status.
 *
 * @returns Mutation hook for starting lesson attempt
 *
 * @example
 * ```tsx
 * const { mutate: startAttempt, isLoading } = useStartLessonAttempt();
 *
 * const handleStart = () => {
 *   startAttempt(
 *     { lessonId, password },
 *     {
 *       onSuccess: (data) => {
 *         navigateToPage(data.firstPageId);
 *       },
 *     }
 *   );
 * };
 * ```
 */
export function useStartLessonAttempt(): UseMutationResult<
  StartLessonAttemptResponse,
  Error,
  { lessonId: number; password?: string },
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lessonId, password }) => startLessonAttempt(lessonId, password),
    onSuccess: (_data, variables) => {
      // Invalidate lesson and attempt queries to refresh state
      void queryClient.invalidateQueries({
        queryKey: lessonQueryKeys.detail(variables.lessonId),
      });
      void queryClient.invalidateQueries({
        queryKey: lessonQueryKeys.attempt(variables.lessonId),
      });
      void queryClient.invalidateQueries({
        queryKey: lessonQueryKeys.progress(variables.lessonId),
      });
    },
  });
}

/**
 * Hook to fetch specific lesson page content
 *
 * Retrieves page content including question text, answers, and navigation
 * options. Data is cached for 2 minutes per page.
 *
 * @param lessonId - Lesson ID
 * @param pageId - Page ID
 * @param enabled - Whether query should run automatically (default: true)
 * @returns Query result with page content
 *
 * @example
 * ```tsx
 * const { data: pageData, isLoading } = useLessonPage(lessonId, currentPageId);
 *
 * if (pageData?.isQuestion) {
 *   return <QuestionPage page={pageData.page} answers={pageData.answers} />;
 * }
 * return <ContentPage page={pageData.page} />;
 * ```
 */
export function useLessonPage(
  lessonId: number,
  pageId: number,
  enabled: boolean = true
): UseQueryResult<LessonPageResponse, Error> {
  return useQuery({
    queryKey: lessonQueryKeys.page(lessonId, pageId),
    queryFn: () => fetchLessonPage(lessonId, pageId),
    enabled: enabled && lessonId > 0 && pageId > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch the next page in the lesson sequence
 *
 * Creates a mutation that determines and retrieves the next page based on
 * navigation logic and optionally the selected answer.
 *
 * @returns Mutation hook for fetching next page
 *
 * @example
 * ```tsx
 * const { mutate: getNextPage } = useNextLessonPage();
 *
 * const handleContinue = () => {
 *   getNextPage(
 *     { lessonId, currentPageId, answerId },
 *     {
 *       onSuccess: (data) => {
 *         setCurrentPage(data.nextPage);
 *       },
 *     }
 *   );
 * };
 * ```
 */
export function useNextLessonPage(): UseMutationResult<
  NextPageResponse,
  Error,
  { lessonId: number; currentPageId: number; answerId?: number },
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lessonId, currentPageId, answerId }) =>
      fetchNextLessonPage(lessonId, { currentPageId, answerId }),
    onSuccess: (data, variables) => {
      // Pre-populate the cache with the new page data
      queryClient.setQueryData(
        lessonQueryKeys.page(variables.lessonId, data.nextPage.id),
        {
          page: data.nextPage,
          answers: data.answers,
          isQuestion: data.nextPage.qtype > 0,
          canGoBack: true,
          previousPageId: variables.currentPageId,
          navigationOptions: [],
          mediaFiles: [],
          timeRemaining: null,
        } as LessonPageResponse
      );
    },
  });
}

/**
 * Hook to submit an answer to a lesson page
 *
 * Creates a mutation for submitting and grading an answer. On success,
 * invalidates progress queries and caches feedback for display.
 *
 * @returns Mutation hook for submitting answers
 *
 * @example
 * ```tsx
 * const { mutate: submitAnswer, isLoading } = useSubmitLessonAnswer();
 *
 * const handleSubmit = (answerId: number) => {
 *   submitAnswer(
 *     {
 *       lessonId,
 *       request: { pageId: currentPageId, answerId },
 *     },
 *     {
 *       onSuccess: (data) => {
 *         showFeedback(data.feedback, data.isCorrect);
 *         if (!data.lessonEnded) {
 *           navigateToPage(data.nextPageId);
 *         }
 *       },
 *     }
 *   );
 * };
 * ```
 */
export function useSubmitLessonAnswer(): UseMutationResult<
  SubmitAnswerResponse,
  Error,
  { lessonId: number; request: SubmitAnswerRequest },
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lessonId, request }) => submitLessonAnswer(lessonId, request),
    onSuccess: (data, variables) => {
      // Invalidate progress and attempt queries
      void queryClient.invalidateQueries({
        queryKey: lessonQueryKeys.progress(variables.lessonId),
      });
      void queryClient.invalidateQueries({
        queryKey: lessonQueryKeys.attempt(variables.lessonId),
      });

      // If lesson ended, invalidate detail to refresh completion status
      if (data.lessonEnded) {
        void queryClient.invalidateQueries({
          queryKey: lessonQueryKeys.detail(variables.lessonId),
        });
      }
    },
  });
}

/**
 * Hook to navigate to a specific page in the lesson
 *
 * Creates a mutation for navigating to branch page targets or content pages
 * where no answer is required.
 *
 * @returns Mutation hook for page navigation
 *
 * @example
 * ```tsx
 * const { mutate: navigateTo } = useNavigateLessonPage();
 *
 * const handleBranchClick = (targetPageId: number) => {
 *   navigateTo(
 *     {
 *       lessonId,
 *       request: { currentPageId, targetPageId },
 *     },
 *     {
 *       onSuccess: (data) => {
 *         setCurrentPage(data.page);
 *       },
 *     }
 *   );
 * };
 * ```
 */
export function useNavigateLessonPage(): UseMutationResult<
  NavigatePageResponse,
  Error,
  { lessonId: number; request: NavigatePageRequest },
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lessonId, request }) => navigateLessonPage(lessonId, request),
    onSuccess: (data, variables) => {
      // Cache the target page data
      queryClient.setQueryData(
        lessonQueryKeys.page(variables.lessonId, data.page.id),
        {
          page: data.page,
          answers: data.answers,
          isQuestion: data.page.qtype > 0,
          canGoBack: true,
          previousPageId: variables.request.currentPageId,
          navigationOptions: [],
          mediaFiles: [],
          timeRemaining: data.timeRemaining,
        } as LessonPageResponse
      );

      // Invalidate attempt and progress queries
      void queryClient.invalidateQueries({
        queryKey: lessonQueryKeys.attempt(variables.lessonId),
      });
      void queryClient.invalidateQueries({
        queryKey: lessonQueryKeys.progress(variables.lessonId),
      });
    },
  });
}

/**
 * Hook to fetch user's progress through the lesson
 *
 * Retrieves progress data including completed pages, grades, and time spent.
 * Data is cached for 1 minute to provide relatively fresh progress updates.
 *
 * @param lessonId - Lesson ID
 * @param enabled - Whether query should run automatically (default: true)
 * @returns Query result with progress data
 *
 * @example
 * ```tsx
 * const { data: progressData } = useLessonProgress(lessonId);
 *
 * return (
 *   <ProgressBar
 *     value={progressData?.progress.progressPercentage}
 *     label={`${progressData?.progress.pagesCompleted} / ${progressData?.progress.totalPages}`}
 *   />
 * );
 * ```
 */
export function useLessonProgress(
  lessonId: number,
  enabled: boolean = true
): UseQueryResult<LessonProgressResponse, Error> {
  return useQuery({
    queryKey: lessonQueryKeys.progress(lessonId),
    queryFn: () => fetchLessonProgress(lessonId),
    enabled: enabled && lessonId > 0,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to update the lesson timer
 *
 * Creates a mutation for updating the timer during a timed lesson session.
 * Should be called periodically (e.g., every 30-60 seconds) to keep the
 * server-side timer in sync.
 *
 * @returns Mutation hook for updating timer
 *
 * @example
 * ```tsx
 * const { mutate: updateTimer } = useUpdateLessonTimer();
 *
 * useEffect(() => {
 *   const interval = setInterval(() => {
 *     updateTimer(
 *       { lessonId, request: { timeSpent } },
 *       {
 *         onSuccess: (data) => {
 *           if (data.timeExpired) {
 *             handleTimeUp();
 *           }
 *         },
 *       }
 *     );
 *   }, 30000);
 *
 *   return () => clearInterval(interval);
 * }, [lessonId, timeSpent]);
 * ```
 */
export function useUpdateLessonTimer(): UseMutationResult<
  UpdateTimerResponse,
  Error,
  { lessonId: number; request: UpdateTimerRequest },
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lessonId, request }) => updateLessonTimer(lessonId, request),
    onSuccess: (data, variables) => {
      // Update the attempt query with new timer information
      queryClient.setQueryData<LessonAttemptResponse>(
        lessonQueryKeys.attempt(variables.lessonId),
        (old) =>
          old
            ? {
                ...old,
                timer: data.timer,
                timeRemaining: data.timeRemaining,
                timeSpent: data.timer.lessontime,
              }
            : old
      );
    },
  });
}

/**
 * Hook to finish a lesson attempt
 *
 * Creates a mutation for finishing a lesson attempt, which stops the timer
 * and calculates the final grade. On success, invalidates all lesson queries
 * to refresh completion status.
 *
 * @returns Mutation hook for finishing attempt
 *
 * @example
 * ```tsx
 * const { mutate: finishAttempt, isLoading } = useFinishLessonAttempt();
 *
 * const handleFinish = () => {
 *   finishAttempt(
 *     { lessonId, endReached: true },
 *     {
 *       onSuccess: (data) => {
 *         showGradeDialog(data.grade, data.gradePercentage);
 *         if (data.canRetake) {
 *           showRetakeOption();
 *         }
 *       },
 *     }
 *   );
 * };
 * ```
 */
export function useFinishLessonAttempt(): UseMutationResult<
  FinishLessonAttemptResponse,
  Error,
  { lessonId: number; endReached?: boolean },
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lessonId, endReached = true }) => finishLessonAttempt(lessonId, endReached),
    onSuccess: (_data, variables) => {
      // Invalidate all lesson-related queries to refresh state
      void queryClient.invalidateQueries({
        queryKey: lessonQueryKeys.detail(variables.lessonId),
      });
      void queryClient.invalidateQueries({
        queryKey: lessonQueryKeys.attempt(variables.lessonId),
      });
      void queryClient.invalidateQueries({
        queryKey: lessonQueryKeys.progress(variables.lessonId),
      });
    },
  });
}

/**
 * Hook to fetch all pages in the lesson
 *
 * Retrieves all pages for navigation overview and menu display.
 * Data is cached for 10 minutes as page structure rarely changes.
 *
 * @param lessonId - Lesson ID
 * @param enabled - Whether query should run automatically (default: true)
 * @returns Query result with all lesson pages
 *
 * @example
 * ```tsx
 * const { data: pagesData } = useLessonPages(lessonId);
 *
 * return (
 *   <NavigationMenu
 *     pages={pagesData?.pages}
 *     accessiblePages={pagesData?.accessiblePages}
 *     onPageSelect={handlePageSelect}
 *   />
 * );
 * ```
 */
export function useLessonPages(
  lessonId: number,
  enabled: boolean = true
): UseQueryResult<LessonPagesResponse, Error> {
  return useQuery({
    queryKey: lessonQueryKeys.pages(lessonId),
    queryFn: () => fetchLessonPages(lessonId),
    enabled: enabled && lessonId > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook to restart the lesson from the beginning
 *
 * Creates a mutation for restarting a lesson if retakes are allowed.
 * On success, invalidates all lesson queries and returns the first page
 * of the new attempt.
 *
 * @returns Mutation hook for restarting lesson
 *
 * @example
 * ```tsx
 * const { mutate: restartLesson, isLoading } = useRestartLesson();
 *
 * const handleRetake = () => {
 *   restartLesson(lessonId, {
 *     onSuccess: (data) => {
 *       navigateToPage(data.firstPage.id);
 *       showMessage(data.message);
 *     },
 *   });
 * };
 * ```
 */
export function useRestartLesson(): UseMutationResult<
  RestartLessonResponse,
  Error,
  number,
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lessonId: number) => restartLesson(lessonId),
    onSuccess: (data, lessonId) => {
      // Invalidate all lesson-related queries to refresh state
      void queryClient.invalidateQueries({
        queryKey: lessonQueryKeys.detail(lessonId),
      });
      void queryClient.invalidateQueries({
        queryKey: lessonQueryKeys.attempt(lessonId),
      });
      void queryClient.invalidateQueries({
        queryKey: lessonQueryKeys.progress(lessonId),
      });
      void queryClient.invalidateQueries({
        queryKey: lessonQueryKeys.pages(lessonId),
      });

      // Pre-populate the first page in cache
      queryClient.setQueryData(
        lessonQueryKeys.page(lessonId, data.firstPage.id),
        {
          page: data.firstPage,
          answers: [],
          isQuestion: data.firstPage.qtype > 0,
          canGoBack: false,
          previousPageId: null,
          navigationOptions: [],
          mediaFiles: [],
          timeRemaining: data.timer?.lessontime ?? null,
        } as LessonPageResponse
      );
    },
  });
}
