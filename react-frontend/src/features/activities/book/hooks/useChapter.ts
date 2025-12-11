/**
 * Custom React Hook for Chapter Data Fetching and Navigation
 *
 * Provides a React Query-based hook for fetching and managing individual chapter
 * data in the Moodle book activity module. This hook wraps the chapter retrieval
 * logic from Moodle's PHP backend and provides navigation state for chapter traversal.
 *
 * Key Features:
 * - Fetches individual chapter data via GET /api/v1/books/chapters/{id} endpoint
 * - Provides navigation state with previous/next chapter IDs based on pagenum ordering
 * - Respects chapter visibility based on hidden flag and user capabilities
 * - Returns complete chapter content with format information for rendering
 * - Supports optimistic updates for chapter modifications
 * - Integrates with useBookChapters for table of contents generation
 *
 * Architecture Notes:
 * - The backend API endpoint wraps book_preload_chapters() from locallib.php line 52-132
 * - Database queries follow patterns from view.php lines 72-96
 * - Chapter visibility respects hidden flag and mod/book:viewhiddenchapters capability
 * - All business logic remains in PHP backend; this is a thin API wrapper
 *
 * @module features/activities/book/hooks/useChapter
 * @see public/mod/book/view.php - Book viewing entry point with chapter loading
 * @see public/mod/book/locallib.php - book_preload_chapters() at line 52
 * @see public/mod/book/lib.php - Book module library functions
 * @see react-frontend/src/features/activities/book/api/bookApi.ts - API client
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { fetchChapter } from '@/features/activities/book/api/bookApi';
import type { Chapter } from '@/features/activities/book/types/book.types';
import useBookChapters, {
  bookChaptersQueryKeys,
  type ChapterNavigationResult,
} from '@/features/activities/book/hooks/useBookChapters';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Navigation state containing previous and next chapter IDs
 *
 * Provides lightweight references to adjacent chapters for navigation controls.
 * Uses IDs instead of full Chapter objects for efficient state management.
 *
 * @interface ChapterNavigationState
 */
export interface ChapterNavigationState {
  /**
   * Previous chapter ID in reading sequence
   * null if current chapter is the first chapter
   */
  previousChapterId: number | null;

  /**
   * Next chapter ID in reading sequence
   * null if current chapter is the last chapter
   */
  nextChapterId: number | null;

  /**
   * Parent chapter ID for subchapters
   * null for main chapters
   */
  parentChapterId: number | null;

  /**
   * Whether the current chapter is the first in the book
   */
  isFirstChapter: boolean;

  /**
   * Whether the current chapter is the last in the book
   */
  isLastChapter: boolean;
}

/**
 * Return type for the useChapter hook
 *
 * Provides comprehensive access to chapter data, loading/error states,
 * navigation state, and helper functions for chapter management.
 *
 * @interface UseChapterResult
 */
export interface UseChapterResult {
  /**
   * Chapter entity with all database fields
   * - id: Unique chapter identifier
   * - bookid: Parent book identifier
   * - pagenum: Chapter sequence number (sort order)
   * - subchapter: Whether this is a subchapter (0=main, 1=sub)
   * - title: Chapter title
   * - content: Chapter HTML content
   * - contentformat: Content text format (0=Moodle, 1=HTML, 2=Plain, 4=Markdown)
   * - hidden: Whether chapter is hidden from students
   * - timecreated: Unix timestamp of creation
   * - timemodified: Unix timestamp of last modification
   * - importsrc: Import source reference for imported chapters
   *
   * null when loading or if chapter not found
   */
  chapter: Chapter | null;

  /**
   * Whether the chapter is currently being fetched
   * True during initial load and manual refetches
   */
  isLoading: boolean;

  /**
   * Whether a fetch is in progress (including background refetches)
   */
  isFetching: boolean;

  /**
   * Error object if the fetch failed
   * Contains error code and message from the API
   */
  error: Error | null;

  /**
   * Whether the query has successfully fetched at least once
   */
  isSuccess: boolean;

  /**
   * Whether the query has encountered an error
   */
  isError: boolean;

  /**
   * Navigation state with previous/next chapter IDs
   * Provides efficient navigation without full chapter objects
   */
  navigation: ChapterNavigationState;

  /**
   * Full previous chapter object for detailed navigation display
   * null if current chapter is first or chapters not loaded
   */
  previousChapter: Chapter | null;

  /**
   * Full next chapter object for detailed navigation display
   * null if current chapter is last or chapters not loaded
   */
  nextChapter: Chapter | null;

  /**
   * Function to manually refetch chapter data
   * Useful for refreshing after edits
   */
  refetch: () => Promise<unknown>;

  /**
   * Function to invalidate and refetch all related queries
   * Triggers refetch of both chapter and chapters list
   */
  invalidateAndRefetch: () => Promise<void>;

  /**
   * Whether the chapter is a subchapter
   * Based on chapter.subchapter field
   */
  isSubchapter: boolean;

  /**
   * Whether the chapter is hidden
   * Based on chapter.hidden field
   */
  isHidden: boolean;

  /**
   * Whether the chapter content is available
   * True when chapter data has been successfully loaded
   */
  hasContent: boolean;

  /**
   * Current position of chapter in the book (1-indexed)
   * null if chapter position cannot be determined
   */
  chapterPosition: number | null;

  /**
   * Total number of chapters in the book
   */
  totalChapters: number;
}

/**
 * Options for configuring the useChapter hook
 *
 * @interface UseChapterOptions
 */
export interface UseChapterOptions {
  /**
   * Whether to enable the query
   * Default: true when both bookId and chapterId are positive numbers
   */
  enabled?: boolean;

  /**
   * Whether to refetch on window focus
   * Default: false (chapters don't change frequently)
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Stale time in milliseconds
   * Default: 5 minutes (300000ms)
   */
  staleTime?: number;
}

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for chapter queries
 *
 * Provides consistent query keys for React Query caching and invalidation.
 * Uses a hierarchical structure: ['books', bookId, 'chapters', chapterId]
 *
 * This follows the React Query best practice of creating query key factories
 * for type safety and consistency across the application.
 */
export const chapterQueryKeys = {
  /**
   * Base key for all book-related queries
   */
  all: ['books'] as const,

  /**
   * Key for a specific chapter within a book
   *
   * @param bookId - The unique identifier of the parent book
   * @param chapterId - The unique identifier of the chapter
   * @returns Query key array for the specific chapter
   *
   * @example
   * // Query key for chapter 456 in book 123
   * chapterQueryKeys.chapter(123, 456) // ['books', 123, 'chapters', 456]
   */
  chapter: (bookId: number, chapterId: number) =>
    ['books', bookId, 'chapters', chapterId] as const,

  /**
   * Key for invalidating all chapters of a specific book
   *
   * @param bookId - The unique identifier of the book
   * @returns Partial query key for all chapters in the book
   */
  bookChapters: (bookId: number) => ['books', bookId, 'chapters'] as const,
} as const;

// ============================================================================
// Constants
// ============================================================================

/**
 * Default stale time for chapter queries (5 minutes)
 *
 * Chapter content doesn't change frequently during normal viewing sessions.
 * A 5-minute stale time provides good balance between freshness and performance.
 */
const CHAPTER_STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Cache time for chapter queries (10 minutes)
 *
 * How long to keep chapter data in cache after all subscribers unsubscribe.
 * Slightly higher than stale time to allow for background refetching.
 */
const CHAPTER_CACHE_TIME = 10 * 60 * 1000; // 10 minutes

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom React hook for fetching and managing chapter data
 *
 * Fetches a specific chapter from the Moodle book module using React Query,
 * providing chapter content, navigation state, and helper functions for
 * chapter management and traversal.
 *
 * The hook integrates with useBookChapters to compute navigation state
 * (previous/next chapters) based on the complete chapter list sorted by pagenum.
 *
 * Features:
 * - Fetches chapter data from GET /api/v1/books/chapters/{id} endpoint
 * - Computes navigation state with previous/next chapter IDs
 * - Provides full Chapter objects for detailed navigation display
 * - Supports visibility checking based on hidden flag
 * - Enables optimistic updates through cache invalidation
 * - TypeScript strict mode compliant with full type safety
 *
 * @param bookId - The unique identifier of the parent book
 * @param chapterId - The unique identifier of the chapter to fetch
 * @param options - Optional configuration for the hook
 * @returns UseChapterResult object containing chapter data and navigation state
 *
 * @example
 * ```typescript
 * // Basic usage - fetch chapter and display content
 * function ChapterView({ bookId, chapterId }: Props) {
 *   const {
 *     chapter,
 *     isLoading,
 *     error,
 *     navigation,
 *   } = useChapter(bookId, chapterId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage message={error.message} />;
 *   if (!chapter) return <NotFound />;
 *
 *   return (
 *     <article>
 *       <h1>{chapter.title}</h1>
 *       <div dangerouslySetInnerHTML={{ __html: chapter.content }} />
 *
 *       <nav>
 *         {navigation.previousChapterId && (
 *           <Link to={`/chapter/${navigation.previousChapterId}`}>
 *             Previous
 *           </Link>
 *         )}
 *         {navigation.nextChapterId && (
 *           <Link to={`/chapter/${navigation.nextChapterId}`}>
 *             Next
 *           </Link>
 *         )}
 *       </nav>
 *     </article>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Advanced usage - with navigation chapter details
 * function ChapterNavigation({ bookId, chapterId }: Props) {
 *   const {
 *     previousChapter,
 *     nextChapter,
 *     chapterPosition,
 *     totalChapters,
 *   } = useChapter(bookId, chapterId);
 *
 *   return (
 *     <nav aria-label="Chapter navigation">
 *       <span>Page {chapterPosition} of {totalChapters}</span>
 *
 *       {previousChapter && (
 *         <Button onClick={() => navigate(previousChapter.id)}>
 *           ← {previousChapter.title}
 *         </Button>
 *       )}
 *
 *       {nextChapter && (
 *         <Button onClick={() => navigate(nextChapter.id)}>
 *           {nextChapter.title} →
 *         </Button>
 *       )}
 *     </nav>
 *   );
 * }
 * ```
 */
export default function useChapter(
  bookId: number,
  chapterId: number,
  options?: UseChapterOptions
): UseChapterResult {
  // Get the query client for cache invalidation
  const queryClient = useQueryClient();

  // Determine if the query should be enabled
  // Default: enabled when both bookId and chapterId are positive numbers
  const isEnabled = options?.enabled ?? (bookId > 0 && chapterId > 0);

  // Fetch all chapters for the book to compute navigation
  // This provides the chapter list needed for previous/next computation
  const {
    chapters,
    getNavigationChapters,
    findChapter,
    totalChapters,
    isLoading: isChaptersLoading,
  } = useBookChapters(bookId, { enabled: isEnabled });

  // Execute the React Query for fetching the specific chapter
  const {
    data: chapter,
    isLoading: isChapterLoading,
    isFetching,
    error,
    isSuccess,
    isError,
    refetch,
  } = useQuery<Chapter, Error>({
    // Query key following the pattern: ['books', bookId, 'chapters', chapterId]
    // This enables fine-grained cache invalidation
    queryKey: chapterQueryKeys.chapter(bookId, chapterId),

    // Query function calls the API client
    // The API wraps Moodle's chapter retrieval from book_preload_chapters()
    // and database queries from view.php lines 72-96
    queryFn: () => fetchChapter(chapterId),

    // Enable/disable the query based on valid IDs
    enabled: isEnabled,

    // Stale time configuration
    staleTime: options?.staleTime ?? CHAPTER_STALE_TIME,

    // Cache time (garbage collection time)
    gcTime: CHAPTER_CACHE_TIME,

    // Retry configuration for failed requests
    // Retry twice with exponential backoff
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Refetch behavior configuration
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    refetchOnReconnect: true,
  });

  // ============================================================================
  // Computed Navigation State
  // ============================================================================

  /**
   * Compute navigation state using useMemo for performance optimization
   *
   * Calculates previous/next chapter IDs based on pagenum ordering.
   * Uses the chapters array from useBookChapters (already sorted by pagenum).
   *
   * This computation is memoized to prevent unnecessary recalculations
   * on every render when the chapter data hasn't changed.
   */
  const navigation = useMemo<ChapterNavigationState>(() => {
    // Get navigation chapters using the helper from useBookChapters
    const { previous, next }: ChapterNavigationResult =
      getNavigationChapters(chapterId);

    // Find current chapter position in the sorted list
    const currentIndex = chapters.findIndex((ch) => ch.id === chapterId);
    const isFirstChapter = currentIndex === 0;
    const isLastChapter = currentIndex === chapters.length - 1;

    // Get parent chapter ID for subchapters
    const currentChapter = findChapter(chapterId);
    const parentChapterId = currentChapter?.parent ?? null;

    return {
      previousChapterId: previous?.id ?? null,
      nextChapterId: next?.id ?? null,
      parentChapterId,
      isFirstChapter: chapters.length > 0 ? isFirstChapter : true,
      isLastChapter: chapters.length > 0 ? isLastChapter : true,
    };
  }, [chapters, chapterId, getNavigationChapters, findChapter]);

  /**
   * Get full previous chapter object for detailed navigation display
   *
   * Provides complete chapter data for navigation UI that needs
   * to display chapter titles or other metadata.
   */
  const previousChapter = useMemo<Chapter | null>(() => {
    if (navigation.previousChapterId === null) {
      return null;
    }
    return findChapter(navigation.previousChapterId) ?? null;
  }, [navigation.previousChapterId, findChapter]);

  /**
   * Get full next chapter object for detailed navigation display
   */
  const nextChapter = useMemo<Chapter | null>(() => {
    if (navigation.nextChapterId === null) {
      return null;
    }
    return findChapter(navigation.nextChapterId) ?? null;
  }, [navigation.nextChapterId, findChapter]);

  /**
   * Calculate chapter position (1-indexed) in the book
   *
   * Returns the position of the current chapter in reading order.
   * Position is 1-indexed for user-friendly display.
   */
  const chapterPosition = useMemo<number | null>(() => {
    if (chapters.length === 0) {
      return null;
    }
    const index = chapters.findIndex((ch) => ch.id === chapterId);
    return index >= 0 ? index + 1 : null;
  }, [chapters, chapterId]);

  // ============================================================================
  // Derived State
  // ============================================================================

  /**
   * Whether the chapter is a subchapter
   * Based on chapter.subchapter field (0=main chapter, 1=subchapter)
   */
  const isSubchapter = chapter?.subchapter === 1;

  /**
   * Whether the chapter is hidden from students
   * Based on chapter.hidden field (0=visible, 1=hidden)
   *
   * Note: Hidden chapters are only visible to users with
   * mod/book:viewhiddenchapters capability, which is checked
   * by the backend API before returning chapter data.
   */
  const isHidden = chapter?.hidden === 1;

  /**
   * Whether the chapter content is available for rendering
   * True when chapter data has been successfully loaded
   */
  const hasContent = isSuccess && chapter !== undefined && chapter !== null;

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Invalidate and refetch all related queries
   *
   * Invalidates both the chapter query and the chapters list query,
   * triggering a fresh fetch of all data. Useful after chapter edits
   * to ensure the UI reflects the latest state.
   *
   * This function is wrapped in useCallback for stable reference
   * across renders, preventing unnecessary effect re-runs.
   */
  const invalidateAndRefetch = useCallback(async (): Promise<void> => {
    // Invalidate the specific chapter query
    await queryClient.invalidateQueries({
      queryKey: chapterQueryKeys.chapter(bookId, chapterId),
    });

    // Invalidate the chapters list query to refresh navigation
    await queryClient.invalidateQueries({
      queryKey: bookChaptersQueryKeys.chapters(bookId),
    });
  }, [queryClient, bookId, chapterId]);

  // ============================================================================
  // Return Hook Result
  // ============================================================================

  // Combine loading states from both queries
  const isLoading = isChapterLoading || isChaptersLoading;

  return {
    // Core chapter data
    chapter: chapter ?? null,

    // Query states from React Query
    isLoading,
    isFetching,
    error,
    isSuccess,
    isError,

    // Navigation state (lightweight IDs)
    navigation,

    // Full navigation chapter objects
    previousChapter,
    nextChapter,

    // Actions
    refetch,
    invalidateAndRefetch,

    // Derived state
    isSubchapter,
    isHidden,
    hasContent,

    // Position information
    chapterPosition,
    totalChapters,
  };
}

// ============================================================================
// Named Export for Flexibility
// ============================================================================

/**
 * Named export of useChapter hook
 *
 * Allows importing as either:
 * - `import useChapter from './useChapter'` (default)
 * - `import { useChapter } from './useChapter'` (named)
 */
export { useChapter };

// ============================================================================
// Type Re-exports for Consumer Convenience
// ============================================================================

/**
 * Re-export Chapter type for consumers who need to type chapter data
 */
export type { Chapter } from '@/features/activities/book/types/book.types';
