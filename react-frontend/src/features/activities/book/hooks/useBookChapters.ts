/**
 * Custom React Hook for Fetching Book Chapters
 *
 * Provides a React Query-based hook for fetching and managing book chapters
 * in the Moodle book activity module. This hook wraps the book_preload_chapters
 * pattern from Moodle's PHP backend (locallib.php line 52) and transforms it
 * into a React-friendly API with TypeScript support.
 *
 * The hook integrates with:
 * - React Query for efficient data fetching, caching, and state management
 * - The book API client (bookApi.ts) for backend communication
 * - Moodle's chapter hierarchy system (main chapters and subchapters)
 *
 * Key Features:
 * - Fetches all chapters for a given book ID via GET /api/v1/books/{bookId}/chapters
 * - Returns chapters sorted by pagenum (reading order)
 * - Provides navigation helpers to find previous/next chapters
 * - Respects visibility permissions (hidden chapters filtered by backend API)
 * - 5-minute stale time for efficient caching
 * - Full TypeScript support with strict mode compliance
 *
 * Architecture Notes:
 * - The backend API endpoint already filters hidden chapters based on
 *   mod/book:viewhiddenchapters capability check via require_capability()
 * - Navigation helpers work with the returned chapters (pre-filtered by permissions)
 * - Parent-child relationships are resolved by the backend (book_preload_chapters)
 *
 * @module features/activities/book/hooks/useBookChapters
 * @see public/mod/book/locallib.php - book_preload_chapters() at line 52
 * @see public/mod/book/view.php - Book viewing and navigation logic
 * @see react-frontend/src/features/activities/book/api/bookApi.ts - API client
 */

import { useQuery } from '@tanstack/react-query';
import { fetchBookChapters } from '@/features/activities/book/api/bookApi';
import type { Chapter } from '@/features/activities/book/types/book.types';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Chapter navigation result containing references to adjacent chapters
 *
 * Used by getNavigationChapters() to provide previous/next chapter information
 * for navigation controls in the book viewer.
 *
 * @interface ChapterNavigationResult
 */
export interface ChapterNavigationResult {
  /**
   * Previous chapter in reading sequence
   * null if current chapter is the first visible chapter
   */
  previous: Chapter | null;

  /**
   * Next chapter in reading sequence
   * null if current chapter is the last visible chapter
   */
  next: Chapter | null;
}

/**
 * Return type for the useBookChapters hook
 *
 * Provides access to chapters data, loading/error states from React Query,
 * and navigation helper functions for chapter traversal.
 *
 * @interface UseBookChaptersResult
 */
export interface UseBookChaptersResult {
  /**
   * Array of chapters sorted by pagenum (reading order)
   * Includes both main chapters and subchapters with hierarchy information
   * Hidden chapters are pre-filtered based on user permissions by the API
   */
  chapters: Chapter[];

  /**
   * Whether the chapters are currently being fetched
   * True during initial load and manual refetches
   */
  isLoading: boolean;

  /**
   * Whether the initial fetch is in progress
   * Differs from isLoading in that it's only true for the first fetch
   */
  isFetching: boolean;

  /**
   * Error object if the fetch failed
   * Contains error code and message from the API
   */
  error: Error | null;

  /**
   * Whether the query has successfully fetched at least once
   * Useful for showing skeleton loaders on first load
   */
  isSuccess: boolean;

  /**
   * Whether the query has encountered an error
   * Use in conjunction with error for error handling
   */
  isError: boolean;

  /**
   * Function to manually refetch chapters
   * Useful for refreshing data after modifications
   */
  refetch: () => Promise<unknown>;

  /**
   * Get navigation references for a specific chapter
   *
   * Returns the previous and next chapters relative to the specified
   * chapter ID, respecting visibility (hidden chapters already filtered
   * by the backend API based on viewhiddenchapters capability).
   *
   * @param currentChapterId - The ID of the current chapter
   * @returns Object with previous and next chapter references
   *
   * @example
   * ```typescript
   * const { getNavigationChapters } = useBookChapters(bookId);
   * const { previous, next } = getNavigationChapters(currentChapterId);
   *
   * if (next) {
   *   console.log(`Next chapter: ${next.title}`);
   * }
   * ```
   */
  getNavigationChapters: (currentChapterId: number) => ChapterNavigationResult;

  /**
   * Get all main chapters (non-subchapters)
   * Useful for generating table of contents structure
   */
  mainChapters: Chapter[];

  /**
   * Get subchapters for a specific main chapter
   *
   * @param parentChapterId - The ID of the parent main chapter
   * @returns Array of subchapters belonging to the parent
   */
  getSubchapters: (parentChapterId: number) => Chapter[];

  /**
   * Find a specific chapter by ID
   *
   * @param chapterId - The ID of the chapter to find
   * @returns The chapter if found, undefined otherwise
   */
  findChapter: (chapterId: number) => Chapter | undefined;

  /**
   * Get the first chapter of the book
   * Useful for default chapter selection when entering a book
   */
  firstChapter: Chapter | null;

  /**
   * Total count of chapters (including subchapters)
   */
  totalChapters: number;
}

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for book chapters queries
 *
 * Provides consistent query keys for React Query caching and invalidation.
 * Using a factory pattern ensures type safety and consistency across the app.
 */
export const bookChaptersQueryKeys = {
  /**
   * Base key for all book chapters queries
   */
  all: ['books'] as const,

  /**
   * Key for a specific book's chapters
   *
   * @param bookId - The unique identifier of the book
   * @returns Query key array for the book's chapters
   */
  chapters: (bookId: number) => ['books', bookId, 'chapters'] as const,
} as const;

// ============================================================================
// Constants
// ============================================================================

/**
 * Default stale time for chapters query (5 minutes)
 *
 * Chapters don't change frequently during normal usage, so a 5-minute
 * stale time provides a good balance between freshness and performance.
 * This matches Moodle's caching strategy for book content.
 */
const CHAPTERS_STALE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Cache time for chapters query (10 minutes)
 *
 * How long to keep the data in cache after all subscribers unsubscribe.
 * Set slightly higher than stale time to allow for background refetching.
 */
const CHAPTERS_CACHE_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom React hook for fetching and managing book chapters
 *
 * Fetches all chapters for a book activity module using React Query,
 * providing chapters array with hierarchy information, loading/error states,
 * and navigation helper functions to find previous/next chapters.
 *
 * The hook wraps the book_preload_chapters pattern from Moodle's PHP backend
 * and transforms chapter data into a React-friendly format with TypeScript support.
 *
 * @param bookId - The unique identifier of the book to fetch chapters for
 * @param options - Optional configuration for the hook
 * @param options.enabled - Whether to enable the query (default: true when bookId > 0)
 *
 * @returns UseBookChaptersResult object containing chapters, states, and helpers
 *
 * @example
 * ```typescript
 * // Basic usage
 * function BookTOC({ bookId }: { bookId: number }) {
 *   const {
 *     chapters,
 *     isLoading,
 *     error,
 *     mainChapters,
 *     getSubchapters,
 *   } = useBookChapters(bookId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage message={error.message} />;
 *
 *   return (
 *     <ul>
 *       {mainChapters.map(chapter => (
 *         <li key={chapter.id}>
 *           {chapter.title}
 *           <ul>
 *             {getSubchapters(chapter.id).map(sub => (
 *               <li key={sub.id}>{sub.title}</li>
 *             ))}
 *           </ul>
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Navigation usage
 * function ChapterNavigation({ bookId, currentChapterId }: Props) {
 *   const { getNavigationChapters } = useBookChapters(bookId);
 *   const { previous, next } = getNavigationChapters(currentChapterId);
 *
 *   return (
 *     <nav>
 *       {previous && (
 *         <Button onClick={() => navigate(previous.id)}>
 *           Previous: {previous.title}
 *         </Button>
 *       )}
 *       {next && (
 *         <Button onClick={() => navigate(next.id)}>
 *           Next: {next.title}
 *         </Button>
 *       )}
 *     </nav>
 *   );
 * }
 * ```
 */
export default function useBookChapters(
  bookId: number,
  options?: {
    enabled?: boolean;
  }
): UseBookChaptersResult {
  // Determine if the query should be enabled
  // Default: enabled when bookId is a positive number
  const isEnabled = options?.enabled ?? bookId > 0;

  // Execute the React Query for fetching chapters
  const {
    data: chapters = [],
    isLoading,
    isFetching,
    error,
    isSuccess,
    isError,
    refetch,
  } = useQuery<Chapter[], Error>({
    // Query key following React Query best practices
    // Format: ['books', bookId, 'chapters']
    queryKey: bookChaptersQueryKeys.chapters(bookId),

    // Query function that calls the API client
    // The API wraps book_preload_chapters() from locallib.php
    queryFn: () => fetchBookChapters(bookId),

    // Enable/disable the query based on bookId validity
    enabled: isEnabled,

    // 5-minute stale time for efficient caching
    // Chapters don't change frequently during normal book viewing
    staleTime: CHAPTERS_STALE_TIME,

    // 10-minute cache time after all subscribers unsubscribe
    gcTime: CHAPTERS_CACHE_TIME,

    // Retry configuration for failed requests
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Refetch behavior configuration
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  // ============================================================================
  // Derived Data and Helper Functions
  // ============================================================================

  /**
   * Get all main chapters (chapters that are not subchapters)
   *
   * Main chapters have subchapter = 0 and serve as parents for subchapters.
   * Used for generating the table of contents top-level structure.
   */
  const mainChapters: Chapter[] = chapters.filter(
    (chapter) => chapter.subchapter === 0
  );

  /**
   * Get subchapters for a specific parent chapter
   *
   * Finds all chapters where parent matches the given parentChapterId.
   * Returns chapters sorted by pagenum (inherited from API response).
   *
   * @param parentChapterId - The ID of the parent main chapter
   * @returns Array of subchapters belonging to the parent
   */
  const getSubchapters = (parentChapterId: number): Chapter[] => {
    return chapters.filter(
      (chapter) =>
        chapter.subchapter === 1 && chapter.parent === parentChapterId
    );
  };

  /**
   * Find a specific chapter by ID
   *
   * @param chapterId - The ID of the chapter to find
   * @returns The chapter if found, undefined otherwise
   */
  const findChapter = (chapterId: number): Chapter | undefined => {
    return chapters.find((chapter) => chapter.id === chapterId);
  };

  /**
   * Get the first chapter of the book
   *
   * Returns the chapter with the lowest pagenum value.
   * Used for default chapter selection when entering a book without
   * a specific chapter ID.
   */
  const firstChapter: Chapter | null = chapters.length > 0 ? chapters[0] : null;

  /**
   * Total count of chapters (including subchapters)
   */
  const totalChapters: number = chapters.length;

  /**
   * Get navigation chapters (previous and next) relative to current chapter
   *
   * Finds the previous and next chapters in reading sequence based on
   * pagenum ordering. The chapters array is already filtered by the backend
   * API based on the user's viewhiddenchapters capability, so this function
   * works with visible chapters only.
   *
   * Navigation follows the flat pagenum order, not the hierarchy.
   * This means subchapters are included in the navigation sequence.
   *
   * Algorithm:
   * 1. Find the index of the current chapter in the sorted array
   * 2. Previous = chapter at index - 1 (if exists)
   * 3. Next = chapter at index + 1 (if exists)
   *
   * @param currentChapterId - The ID of the current chapter
   * @returns Object with previous and next chapter references
   */
  const getNavigationChapters = (
    currentChapterId: number
  ): ChapterNavigationResult => {
    // Handle edge cases
    if (!chapters || chapters.length === 0) {
      return { previous: null, next: null };
    }

    // Find the index of the current chapter in the sorted array
    // Chapters are already sorted by pagenum from the API
    const currentIndex = chapters.findIndex(
      (chapter) => chapter.id === currentChapterId
    );

    // If chapter not found, return null for both navigation directions
    if (currentIndex === -1) {
      return { previous: null, next: null };
    }

    // Get previous chapter (if not at the beginning)
    const previous: Chapter | null =
      currentIndex > 0 ? chapters[currentIndex - 1] : null;

    // Get next chapter (if not at the end)
    const next: Chapter | null =
      currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

    return { previous, next };
  };

  // ============================================================================
  // Return Hook Result
  // ============================================================================

  return {
    // Data
    chapters,
    mainChapters,
    firstChapter,
    totalChapters,

    // Query states from React Query
    isLoading,
    isFetching,
    error,
    isSuccess,
    isError,

    // Actions
    refetch,

    // Helper functions
    getNavigationChapters,
    getSubchapters,
    findChapter,
  };
}

// ============================================================================
// Named Export for Flexibility
// ============================================================================

/**
 * Named export of useBookChapters hook
 *
 * Allows importing as either:
 * - `import useBookChapters from './useBookChapters'` (default)
 * - `import { useBookChapters } from './useBookChapters'` (named)
 */
export { useBookChapters };

// ============================================================================
// Type Re-exports for Consumer Convenience
// ============================================================================

/**
 * Re-export Chapter type for consumers who need to type chapter data
 */
export type { Chapter } from '@/features/activities/book/types/book.types';
