/**
 * useBook Hook - Book Instance Data Fetching
 *
 * Custom React hook that encapsulates book instance data fetching logic using
 * React Query, providing automatic caching, background refetching, and state
 * management for book metadata.
 *
 * This hook wraps the fetchBook API function to provide a clean, type-safe
 * interface for components that need to display or work with book data.
 *
 * Features:
 * - Automatic caching with 5-minute staleTime for efficient data reuse
 * - Background refetching on window focus for fresh data
 * - Loading, error, and success states from React Query
 * - TypeScript strict typing with Book interface
 * - Query invalidation support for updates
 *
 * The hook fetches book instance data from the API endpoint that wraps
 * Moodle's book_view() function and database queries from:
 * - public/mod/book/view.php (lines 38-47 for book retrieval)
 * - public/mod/book/lib.php (book_view function)
 *
 * Book data includes all database fields per public/mod/book/db/install.xml:
 * - id: Unique book identifier
 * - course: Course ID the book belongs to
 * - name: Book title
 * - intro: Introduction text
 * - introformat: Text format for intro
 * - numbering: Chapter numbering style (BookNumbering enum)
 * - navstyle: Navigation style (BookNavStyle enum)
 * - customtitles: Whether custom titles are enabled
 * - revision: Book revision number for cache invalidation
 * - timecreated: Creation timestamp
 * - timemodified: Last modification timestamp
 *
 * @module features/activities/book/hooks/useBook
 * @see public/mod/book/view.php - Book viewing entry point
 * @see public/mod/book/lib.php - book_view() function
 * @see public/mod/book/locallib.php - Supporting functions
 */

import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { fetchBook } from '@/features/activities/book/api/bookApi';
import type { Book } from '@/features/activities/book/types/book.types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Query key prefix for book-related queries
 *
 * Used to create cache keys that allow:
 * - Targeted invalidation of specific book data
 * - Automatic refetching when book data changes
 * - Efficient cache lookup and deduplication
 */
const BOOK_QUERY_KEY_PREFIX = 'books' as const;

/**
 * Default stale time for book queries (5 minutes in milliseconds)
 *
 * Book data is relatively static content that doesn't change frequently,
 * so a 5-minute stale time provides a good balance between fresh data
 * and reduced API calls.
 *
 * After staleTime:
 * - Data is considered stale but still usable
 * - Background refetch occurs on next access
 * - User sees cached data immediately while refresh happens
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Cache time for garbage collection (30 minutes)
 *
 * Unused cached data will be garbage collected after this time.
 * This is longer than staleTime to allow data to survive temporary
 * unmounts during navigation.
 */
const DEFAULT_GC_TIME = 30 * 60 * 1000; // 30 minutes

// ============================================================================
// Hook Options Interface
// ============================================================================

/**
 * Configuration options for the useBook hook
 *
 * Allows customization of React Query behavior while providing
 * sensible defaults for common use cases.
 *
 * @interface UseBookOptions
 */
export interface UseBookOptions {
  /**
   * Whether the query should execute automatically
   *
   * Set to false to disable automatic fetching. Useful when:
   * - The bookId is not yet available
   * - Fetching should be deferred until user action
   * - Conditional data loading is needed
   *
   * @default true
   */
  enabled?: boolean;

  /**
   * Custom stale time in milliseconds
   *
   * Override the default 5-minute stale time for specific use cases:
   * - Shorter time for frequently updated books
   * - Longer time for archived or static content
   * - 0 for always-fresh data
   * - Infinity for never-stale data
   *
   * @default 300000 (5 minutes)
   */
  staleTime?: number;

  /**
   * Whether to refetch on window focus
   *
   * When true, the query will refetch when the window regains focus,
   * ensuring users see fresh data after returning to the tab.
   *
   * @default true
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Whether to refetch when the component remounts
   *
   * Controls refetch behavior when a component using this hook
   * is unmounted and remounted.
   *
   * @default false (use cached data if available)
   */
  refetchOnMount?: boolean | 'always';

  /**
   * Number of retry attempts on failure
   *
   * Controls how many times the query will retry on failure
   * before entering the error state.
   *
   * @default 3
   */
  retry?: number | boolean;
}

// ============================================================================
// Main Hook Implementation
// ============================================================================

/**
 * Fetch book instance data with React Query
 *
 * Custom hook that provides access to book metadata with automatic
 * caching, background updates, and comprehensive state management.
 *
 * The hook manages the complete lifecycle of book data fetching:
 * 1. Initial fetch from API (GET /api/v1/books/{id})
 * 2. Caching for performance
 * 3. Background refetching for freshness
 * 4. Error handling with retry logic
 * 5. Loading state management
 *
 * The underlying API endpoint wraps Moodle's existing functions:
 * - Database query: $DB->get_record('book', ['id' => $bookid])
 * - Permission check: require_capability('mod/book:read', $context)
 * - View tracking: book_view() from lib.php
 *
 * @param bookId - The unique identifier of the book to fetch
 * @param options - Optional configuration for query behavior
 * @returns UseQueryResult containing book data, loading state, and error state
 *
 * @example Basic usage
 * ```typescript
 * function BookHeader({ bookId }: { bookId: number }) {
 *   const { data: book, isLoading, error } = useBook(bookId);
 *
 *   if (isLoading) return <Skeleton variant="text" />;
 *   if (error) return <Alert severity="error">Failed to load book</Alert>;
 *
 *   return (
 *     <Typography variant="h4">{book?.name}</Typography>
 *   );
 * }
 * ```
 *
 * @example With custom options
 * ```typescript
 * function BookView({ bookId }: { bookId: number }) {
 *   const { data: book, isLoading, refetch } = useBook(bookId, {
 *     staleTime: 10 * 60 * 1000, // 10 minutes
 *     refetchOnWindowFocus: false,
 *   });
 *
 *   return (
 *     <Box>
 *       <Button onClick={() => refetch()}>Refresh</Button>
 *       {book && <BookContent book={book} />}
 *     </Box>
 *   );
 * }
 * ```
 *
 * @example Conditional fetching
 * ```typescript
 * function ConditionalBook({ bookId }: { bookId: number | null }) {
 *   const { data: book, isLoading } = useBook(bookId ?? 0, {
 *     enabled: bookId !== null && bookId > 0,
 *   });
 *
 *   if (!bookId) return <Typography>Select a book</Typography>;
 *   if (isLoading) return <CircularProgress />;
 *
 *   return <BookDisplay book={book} />;
 * }
 * ```
 *
 * @example With error handling
 * ```typescript
 * function BookWithError({ bookId }: { bookId: number }) {
 *   const { data: book, isLoading, error, refetch } = useBook(bookId);
 *
 *   if (error) {
 *     return (
 *       <Alert
 *         severity="error"
 *         action={<Button onClick={() => refetch()}>Retry</Button>}
 *       >
 *         {error.message}
 *       </Alert>
 *     );
 *   }
 *
 *   return book ? <BookContent book={book} /> : null;
 * }
 * ```
 */
export function useBook(
  bookId: number,
  options: UseBookOptions = {}
): UseQueryResult<Book, Error> {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    refetchOnWindowFocus = true,
    refetchOnMount = false,
    retry = 3,
  } = options;

  return useQuery<Book, Error>({
    /**
     * Query key for caching and invalidation
     *
     * The key ['books', bookId] allows:
     * - Individual book cache entries
     * - Targeted invalidation: queryClient.invalidateQueries(['books', bookId])
     * - Batch invalidation: queryClient.invalidateQueries(['books'])
     */
    queryKey: [BOOK_QUERY_KEY_PREFIX, bookId],

    /**
     * Query function that fetches book data
     *
     * Calls the fetchBook API function which:
     * 1. Makes GET request to /api/v1/books/{bookId}
     * 2. Validates response structure
     * 3. Returns typed Book object
     * 4. Throws BookApiError on failure
     */
    queryFn: () => fetchBook(bookId),

    /**
     * Only execute query when bookId is valid and enabled is true
     *
     * Prevents unnecessary API calls when:
     * - bookId is 0 or negative (invalid)
     * - Component has disabled fetching intentionally
     */
    enabled: enabled && bookId > 0,

    /**
     * Stale time for cache management
     *
     * Book content is relatively static, so 5-minute stale time
     * provides good performance while ensuring reasonable freshness.
     */
    staleTime,

    /**
     * Garbage collection time
     *
     * Keep unused data in cache for 30 minutes to handle
     * navigation patterns where user returns to the same book.
     */
    gcTime: DEFAULT_GC_TIME,

    /**
     * Refetch on window focus for fresh data
     *
     * When user returns to tab, ensures they see current book state
     * in case changes were made elsewhere.
     */
    refetchOnWindowFocus,

    /**
     * Refetch behavior on component mount
     *
     * By default, uses cached data if available and not stale.
     * Set to 'always' for critical data that must be fresh.
     */
    refetchOnMount,

    /**
     * Retry configuration
     *
     * Retry failed requests with exponential backoff.
     * Default of 3 retries handles transient network issues.
     */
    retry,

    /**
     * Retry delay with exponential backoff
     *
     * Increases delay between retries to avoid overwhelming
     * the server during transient issues:
     * - Attempt 1: 1 second
     * - Attempt 2: 2 seconds
     * - Attempt 3: 4 seconds (capped at 30 seconds)
     */
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate query key for book queries
 *
 * Utility function to create consistent query keys for use with
 * React Query's queryClient methods. Useful for:
 * - Manual cache invalidation
 * - Prefetching book data
 * - Optimistic updates
 *
 * @param bookId - The book ID to create a key for
 * @returns Query key array for the specified book
 *
 * @example Invalidate book data after edit
 * ```typescript
 * const queryClient = useQueryClient();
 * await updateBook(bookId, updates);
 * queryClient.invalidateQueries(getBookQueryKey(bookId));
 * ```
 *
 * @example Prefetch book data
 * ```typescript
 * const queryClient = useQueryClient();
 * queryClient.prefetchQuery({
 *   queryKey: getBookQueryKey(bookId),
 *   queryFn: () => fetchBook(bookId),
 * });
 * ```
 */
export function getBookQueryKey(bookId: number): readonly [string, number] {
  return [BOOK_QUERY_KEY_PREFIX, bookId] as const;
}

/**
 * Get the query key prefix for all book queries
 *
 * Useful for invalidating all book data at once:
 *
 * @returns The book query key prefix
 *
 * @example Invalidate all book data
 * ```typescript
 * const queryClient = useQueryClient();
 * queryClient.invalidateQueries([getBookQueryKeyPrefix()]);
 * ```
 */
export function getBookQueryKeyPrefix(): string {
  return BOOK_QUERY_KEY_PREFIX;
}

// ============================================================================
// Default Export
// ============================================================================

export default useBook;
