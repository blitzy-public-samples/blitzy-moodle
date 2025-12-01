/**
 * useCourse Hook
 *
 * React Query hook for fetching individual course details with automatic caching,
 * background revalidation, and intelligent server state management. Wraps the
 * courseApi.getCourse() function to provide type-safe access to single course data
 * including course metadata, enrollment status, sections, and activities.
 *
 * Based on Moodle's course view functionality in public/course/view.php which uses
 * get_course() and get_course_contents() functions to retrieve complete course data.
 *
 * Features:
 * - Automatic caching with configurable 5-minute stale time
 * - Background revalidation to keep data fresh
 * - Conditional fetching via `enabled` option based on courseId availability
 * - React 18 Suspense integration for concurrent rendering
 * - Automatic refetching on window focus and network reconnect
 * - Consistent query key pattern ['courses', courseId] for cache management
 *
 * Performance Targets (from Agent Action Plan):
 * - Subsequent navigation: <500ms
 * - Time to Interactive (TTI): <5 seconds
 *
 * @module features/courses/hooks/useCourse
 * @see public/course/view.php - Moodle course view entry point
 * @see public/course/lib.php - Moodle course library functions
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { getCourse } from '../api/courseApi';
import type { Course } from '@/types/entities';
import type { ApiResponse } from '@/types/api';

// ============================================================================
// Constants
// ============================================================================

/**
 * Query key factory for course-related queries
 *
 * Using a factory pattern ensures consistent query keys across the application
 * for effective cache invalidation and management.
 *
 * @example
 * ```typescript
 * // Single course key
 * courseKeys.detail(42) // ['courses', 42]
 *
 * // All courses key
 * courseKeys.all // ['courses']
 *
 * // Invalidate all course queries
 * queryClient.invalidateQueries({ queryKey: courseKeys.all });
 *
 * // Invalidate specific course
 * queryClient.invalidateQueries({ queryKey: courseKeys.detail(42) });
 * ```
 */
export const courseKeys = {
  /** Base key for all course queries */
  all: ['courses'] as const,
  /** Generate key for a specific course by ID */
  detail: (id: number) => ['courses', id] as const,
  /** Generate key for course lists with filters */
  lists: () => [...courseKeys.all, 'list'] as const,
  /** Generate key for filtered course list */
  list: (filters: Record<string, unknown>) => [...courseKeys.lists(), filters] as const,
} as const;

/**
 * Default stale time for course data (5 minutes in milliseconds)
 *
 * Course data doesn't change frequently during a user session, so a 5-minute
 * stale time provides good performance while ensuring data doesn't become
 * too outdated. This aligns with the Agent Action Plan requirement for
 * <500ms subsequent navigation.
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Default cache time for inactive queries (30 minutes in milliseconds)
 *
 * Inactive queries (no active observers) are kept in cache for 30 minutes
 * before being garbage collected. This allows for quick restoration when
 * users navigate back to previously viewed courses.
 */
const DEFAULT_GC_TIME = 30 * 60 * 1000; // 30 minutes

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useCourse hook
 *
 * Extends React Query's UseQueryOptions to allow customization of caching
 * behavior and query execution. Only exposes options that are safe and
 * commonly needed for course fetching.
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const { data, isLoading } = useCourse(42);
 *
 * // Conditional fetching
 * const { data } = useCourse(courseId, { enabled: courseId > 0 });
 *
 * // Custom stale time
 * const { data } = useCourse(42, { staleTime: 10 * 60 * 1000 });
 *
 * // Disable refetch on window focus
 * const { data } = useCourse(42, { refetchOnWindowFocus: false });
 * ```
 */
export interface UseCourseOptions {
  /**
   * Whether the query should execute.
   * Useful for conditional fetching based on courseId availability.
   * @default true
   */
  enabled?: boolean;

  /**
   * Time in milliseconds after which data is considered stale.
   * Stale data will be refetched in the background when a new observer mounts.
   * @default 300000 (5 minutes)
   */
  staleTime?: number;

  /**
   * Time in milliseconds that unused/inactive cache data remains in memory.
   * After this time, the cache entry will be garbage collected.
   * @default 1800000 (30 minutes)
   */
  gcTime?: number;

  /**
   * Whether to refetch on window focus.
   * Helps keep data fresh when users switch back to the tab.
   * @default true
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Whether to refetch when network reconnects.
   * Useful for recovering from network interruptions.
   * @default true
   */
  refetchOnReconnect?: boolean;

  /**
   * Whether to retry failed requests.
   * @default 3
   */
  retry?: boolean | number;

  /**
   * Initial data to use before the query completes.
   * Useful for server-side rendering or optimistic UI.
   */
  initialData?: Course;

  /**
   * Placeholder data to show while loading.
   * Different from initialData - doesn't affect cache.
   */
  placeholderData?: Course | ((previousData: Course | undefined) => Course | undefined);
}

/**
 * Return type for the useCourse hook
 *
 * Provides all necessary states and methods for consuming course data
 * in React components. All properties are derived from React Query's
 * UseQueryResult for consistency and type safety.
 */
export interface UseCourseResult {
  /**
   * The course data if the query was successful.
   * `undefined` during initial loading or if the query failed.
   */
  data: Course | undefined;

  /**
   * `true` while the query is loading for the first time (no cached data).
   * Use this for showing initial loading states like skeletons.
   */
  isLoading: boolean;

  /**
   * `true` if the query encountered an error.
   * Check the `error` property for error details.
   */
  isError: boolean;

  /**
   * The error object if the query failed.
   * Type is `Error` for standard JavaScript errors.
   */
  error: Error | null;

  /**
   * Function to manually trigger a refetch of the query.
   * Useful for "refresh" buttons or retry functionality.
   *
   * @returns Promise that resolves when refetch completes
   */
  refetch: () => Promise<unknown>;

  /**
   * `true` when the query is currently fetching in the background.
   * This is true during both initial fetch and background refetches.
   * Use this for showing subtle loading indicators while cached data is shown.
   */
  isFetching: boolean;

  /**
   * `true` if the query has successfully received data at least once.
   */
  isSuccess: boolean;

  /**
   * `true` if the query is loading for the first time with no data.
   * Alias for checking `isLoading && !data`.
   */
  isPending: boolean;

  /**
   * `true` if the data is potentially stale and may be refetched soon.
   */
  isStale: boolean;

  /**
   * Current status of the query.
   * One of: 'pending', 'error', 'success'
   */
  status: 'pending' | 'error' | 'success';

  /**
   * Current fetch status.
   * One of: 'fetching', 'paused', 'idle'
   */
  fetchStatus: 'fetching' | 'paused' | 'idle';
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React Query hook for fetching individual course details
 *
 * Provides type-safe access to single course data with automatic caching,
 * background revalidation, and all the benefits of React Query's server
 * state management.
 *
 * @param courseId - The unique identifier of the course to fetch
 * @param options - Optional configuration for query behavior
 * @returns Object containing course data and query state
 *
 * @example
 * ```typescript
 * // Basic usage
 * function CourseDetail({ courseId }: { courseId: number }) {
 *   const { data: course, isLoading, isError, error } = useCourse(courseId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (isError) return <ErrorMessage error={error} />;
 *   if (!course) return <NotFound />;
 *
 *   return (
 *     <div>
 *       <h1>{course.fullname}</h1>
 *       <p>{course.summary}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Conditional fetching based on route param
 * function CourseView() {
 *   const { courseId } = useParams<{ courseId: string }>();
 *   const id = courseId ? parseInt(courseId, 10) : 0;
 *
 *   const { data: course, isLoading } = useCourse(id, {
 *     enabled: id > 0, // Only fetch when we have a valid ID
 *   });
 *
 *   // ...
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With Suspense (React 18 concurrent rendering)
 * function CourseWithSuspense({ courseId }: { courseId: number }) {
 *   return (
 *     <Suspense fallback={<LoadingSpinner />}>
 *       <CourseContent courseId={courseId} />
 *     </Suspense>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Using refetch for manual refresh
 * function CourseWithRefresh({ courseId }: { courseId: number }) {
 *   const { data: course, refetch, isFetching } = useCourse(courseId);
 *
 *   return (
 *     <div>
 *       <button onClick={() => refetch()} disabled={isFetching}>
 *         {isFetching ? 'Refreshing...' : 'Refresh'}
 *       </button>
 *       {course && <CourseContent course={course} />}
 *     </div>
 *   );
 * }
 * ```
 */
export default function useCourse(
  courseId: number,
  options: UseCourseOptions = {}
): UseCourseResult {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_GC_TIME,
    refetchOnWindowFocus = true,
    refetchOnReconnect = true,
    retry = 3,
    initialData,
    placeholderData,
  } = options;

  /**
   * Determine if the query should be enabled
   *
   * The query is disabled if:
   * - The `enabled` option is explicitly false
   * - The courseId is not a valid positive number
   */
  const shouldFetch = enabled && typeof courseId === 'number' && courseId > 0;

  /**
   * Query function that fetches course data from the API
   *
   * Wraps getCourse() and extracts the data from the API response envelope.
   * Handles both successful responses and errors appropriately.
   *
   * @throws {Error} When the API call fails or returns an error response
   */
  const queryFn = async (): Promise<Course> => {
    const response: ApiResponse<Course> = await getCourse(courseId);
    return response.data;
  };

  /**
   * Build the query options object for React Query
   *
   * Using explicit typing to ensure compatibility with useQuery's
   * expected options structure.
   */
  const queryOptions: UseQueryOptions<Course, Error> = {
    queryKey: courseKeys.detail(courseId),
    queryFn,
    enabled: shouldFetch,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    refetchOnReconnect,
    retry,
    initialData,
    placeholderData,
  };

  /**
   * Execute the query using React Query's useQuery hook
   *
   * This provides all the caching, background revalidation, and
   * state management benefits of React Query.
   */
  const query = useQuery<Course, Error>(queryOptions);

  /**
   * Return a consistent interface for consuming components
   *
   * The returned object includes all commonly needed properties and methods
   * for handling course data in React components.
   */
  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    isPending: query.isPending,
    isStale: query.isStale,
    status: query.status,
    fetchStatus: query.fetchStatus,
  };
}

// ============================================================================
// Named Export for Flexibility
// ============================================================================

/**
 * Named export for useCourse hook
 *
 * Provided for flexibility in import styles. Both default and named imports
 * are supported:
 *
 * @example
 * ```typescript
 * // Default import
 * import useCourse from '@/features/courses/hooks/useCourse';
 *
 * // Named import
 * import { useCourse } from '@/features/courses/hooks/useCourse';
 * ```
 */
export { useCourse };

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Prefetch a course into the query cache
 *
 * Useful for preloading course data before navigation to improve
 * perceived performance. Can be called from event handlers like
 * onMouseEnter on course links.
 *
 * @param queryClient - React Query client instance
 * @param courseId - Course ID to prefetch
 *
 * @example
 * ```typescript
 * import { useQueryClient } from '@tanstack/react-query';
 * import { prefetchCourse } from '@/features/courses/hooks/useCourse';
 *
 * function CourseLink({ courseId, name }: { courseId: number; name: string }) {
 *   const queryClient = useQueryClient();
 *
 *   const handleMouseEnter = () => {
 *     prefetchCourse(queryClient, courseId);
 *   };
 *
 *   return (
 *     <Link
 *       to={`/courses/${courseId}`}
 *       onMouseEnter={handleMouseEnter}
 *     >
 *       {name}
 *     </Link>
 *   );
 * }
 * ```
 */
export async function prefetchCourse(
  queryClient: { prefetchQuery: (options: UseQueryOptions<Course, Error>) => Promise<void> },
  courseId: number
): Promise<void> {
  if (!courseId || courseId <= 0) {
    return;
  }

  await queryClient.prefetchQuery({
    queryKey: courseKeys.detail(courseId),
    queryFn: async () => {
      const response = await getCourse(courseId);
      return response.data;
    },
    staleTime: DEFAULT_STALE_TIME,
  });
}

/**
 * Invalidate course cache for a specific course
 *
 * Useful after mutations (updates, enrollments, etc.) to ensure
 * the UI shows the latest data.
 *
 * @param queryClient - React Query client instance
 * @param courseId - Course ID to invalidate, or undefined to invalidate all
 *
 * @example
 * ```typescript
 * import { useQueryClient } from '@tanstack/react-query';
 * import { invalidateCourseCache } from '@/features/courses/hooks/useCourse';
 *
 * function useUpdateCourse() {
 *   const queryClient = useQueryClient();
 *
 *   return useMutation({
 *     mutationFn: updateCourse,
 *     onSuccess: (data) => {
 *       // Invalidate specific course cache
 *       invalidateCourseCache(queryClient, data.id);
 *     },
 *   });
 * }
 * ```
 */
export function invalidateCourseCache(
  queryClient: { invalidateQueries: (options: { queryKey: readonly unknown[] }) => Promise<void> },
  courseId?: number
): Promise<void> {
  const queryKey = courseId !== undefined ? courseKeys.detail(courseId) : courseKeys.all;
  return queryClient.invalidateQueries({ queryKey });
}

/**
 * Set course data directly in the cache
 *
 * Useful for optimistic updates or when you receive course data
 * from another source (e.g., WebSocket, list query).
 *
 * @param queryClient - React Query client instance
 * @param courseId - Course ID for the cache entry
 * @param data - Course data to set
 *
 * @example
 * ```typescript
 * import { useQueryClient } from '@tanstack/react-query';
 * import { setCourseInCache } from '@/features/courses/hooks/useCourse';
 *
 * function CourseList() {
 *   const queryClient = useQueryClient();
 *   const { data: courses } = useCourses();
 *
 *   // Pre-populate individual course caches from list data
 *   useEffect(() => {
 *     courses?.forEach((course) => {
 *       setCourseInCache(queryClient, course.id, course);
 *     });
 *   }, [courses, queryClient]);
 *
 *   return (...);
 * }
 * ```
 */
export function setCourseInCache(
  queryClient: { setQueryData: (queryKey: readonly unknown[], data: Course) => void },
  courseId: number,
  data: Course
): void {
  queryClient.setQueryData(courseKeys.detail(courseId), data);
}

/**
 * Get course data from cache without triggering a fetch
 *
 * Useful for checking if course data is already cached before
 * performing actions that depend on it.
 *
 * @param queryClient - React Query client instance
 * @param courseId - Course ID to look up
 * @returns The cached course data, or undefined if not cached
 *
 * @example
 * ```typescript
 * import { useQueryClient } from '@tanstack/react-query';
 * import { getCourseFromCache } from '@/features/courses/hooks/useCourse';
 *
 * function useCourseAction(courseId: number) {
 *   const queryClient = useQueryClient();
 *
 *   const performAction = () => {
 *     const cachedCourse = getCourseFromCache(queryClient, courseId);
 *     if (cachedCourse) {
 *       // Use cached data immediately
 *       console.log(`Acting on: ${cachedCourse.fullname}`);
 *     }
 *   };
 *
 *   return { performAction };
 * }
 * ```
 */
export function getCourseFromCache(
  queryClient: { getQueryData: (queryKey: readonly unknown[]) => Course | undefined },
  courseId: number
): Course | undefined {
  return queryClient.getQueryData(courseKeys.detail(courseId));
}
