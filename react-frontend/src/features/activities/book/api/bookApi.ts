/**
 * Book Activity API Client Module
 *
 * Provides TypeScript functions for all book activity operations including
 * fetching books by course, retrieving book details, chapters, navigation
 * structure, and recording book views. Wraps RESTful API calls to
 * /api/v1/book/* endpoints using the axios HTTP client.
 *
 * This module implements the API client layer for the book activity, providing
 * a clean separation between API communication (this file) and React Query
 * hooks (in the hooks directory). All functions return properly typed responses
 * with comprehensive error handling following the standard API response envelope
 * pattern defined in Section 0.3 of the Agent Action Plan.
 *
 * Architecture Notes:
 * - Calls backend API endpoints that wrap existing Moodle book functions:
 *   - GET /api/v1/book/courses → get_books_by_courses() from mod_book_external
 *   - GET /api/v1/book/{id} → book data retrieval from mdl_book table
 *   - GET /api/v1/book/{id}/chapters → book_preload_chapters() from locallib.php
 *   - GET /api/v1/book/chapters/{id} → chapter content retrieval
 *   - GET /api/v1/book/{id}/navigation → book_get_toc() pattern from locallib.php
 *   - POST /api/v1/book/{id}/view → book_view() from lib.php
 *
 * - Maintains 100% backward compatibility with existing PHP business logic
 * - All business logic remains in the PHP backend; this file is a thin API wrapper
 *
 * @module features/activities/book/api/bookApi
 * @see public/mod/book/view.php - Book viewing entry point
 * @see public/mod/book/lib.php - book_view() at line 645
 * @see public/mod/book/locallib.php - book_preload_chapters() at line 52, book_get_toc() at line 199
 * @see public/mod/book/classes/external.php - get_books_by_courses() at line 178, view_book() at line 71
 */

import type { AxiosResponse } from 'axios';
import { apiClient } from '@/services/api/client';
import type { Book, Chapter } from '@/features/activities/book/types/book.types';
import type { ApiResponse } from '@/types/api';

// ============================================================================
// API Endpoint Constants
// ============================================================================

/**
 * Book API endpoint paths
 *
 * These are relative paths appended to the base URL configured in apiClient.
 * The base URL is /api/v1 by default.
 */
const BOOK_API_ENDPOINTS = {
  /** GET - Retrieve books for specified course IDs */
  BOOKS_BY_COURSES: '/book/courses',

  /** GET - Retrieve book details by ID */
  BOOK: (bookId: number): string => `/book/${bookId}`,

  /** GET - Retrieve all chapters for a book */
  BOOK_CHAPTERS: (bookId: number): string => `/book/${bookId}/chapters`,

  /** GET - Retrieve specific chapter content */
  CHAPTER: (chapterId: number): string => `/book/chapters/${chapterId}`,

  /** GET - Retrieve book navigation/table of contents */
  BOOK_NAVIGATION: (bookId: number): string => `/book/${bookId}/navigation`,

  /** POST - Record book view for analytics and completion tracking */
  BOOK_VIEW: (bookId: number): string => `/book/${bookId}/view`,
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Book navigation structure
 *
 * Represents the table of contents and navigation state for a book.
 * Contains all chapters with their hierarchy and the current chapter ID
 * for navigation tracking.
 *
 * @interface BookNavigation
 */
export interface BookNavigation {
  /**
   * Array of all chapters in the book with navigation properties
   *
   * Each chapter includes computed navigation fields (prev, next, parent)
   * added by the book_preload_chapters() function.
   */
  chapters: Chapter[];

  /**
   * Currently active chapter ID
   *
   * Used to highlight the current position in the table of contents
   * and determine navigation context.
   */
  currentChapterId: number | null;

  /**
   * Total number of visible chapters (excludes hidden chapters for students)
   */
  totalChapters: number;

  /**
   * Book numbering style for display purposes
   *
   * Values: 0=None, 1=Numbers, 2=Bullets, 3=Indented
   * Used to format chapter titles in the navigation.
   */
  numberingStyle: number;
}

/**
 * Response structure for fetching books by course IDs
 *
 * Contains an array of book entities and optional warnings
 * returned by the get_books_by_courses() external function.
 */
export interface BooksResponse {
  /**
   * Array of books matching the requested course IDs
   */
  books: Book[];

  /**
   * Optional warnings from the backend (e.g., invalid course IDs)
   */
  warnings?: BookWarning[];
}

/**
 * Warning structure returned by Moodle external functions
 */
export interface BookWarning {
  /**
   * Item type that generated the warning (e.g., 'book', 'course')
   */
  item: string;

  /**
   * Item ID related to the warning
   */
  itemid: number;

  /**
   * Warning code for programmatic handling
   */
  warningcode: string;

  /**
   * Human-readable warning message
   */
  message: string;
}

/**
 * Request parameters for fetching books by course IDs
 */
export interface FetchBooksByCourseParams {
  /**
   * Array of course IDs to retrieve books for
   *
   * If empty, retrieves books from all enrolled courses for the current user.
   */
  courseIds: number[];
}

/**
 * Request parameters for recording a book view
 */
export interface RecordBookViewParams {
  /**
   * Book ID being viewed
   */
  bookId: number;

  /**
   * Optional chapter ID being viewed
   *
   * If provided, triggers chapter_viewed event.
   * If null/undefined, triggers course_module_viewed event for the book.
   */
  chapterId?: number;
}

/**
 * Response structure for book view recording
 */
export interface BookViewResponse {
  /**
   * Indicates if the view was recorded successfully
   */
  status: boolean;

  /**
   * Optional warnings (e.g., empty book, hidden chapter)
   */
  warnings?: BookWarning[];
}

/**
 * API error response structure for book operations
 */
export interface BookApiError {
  /**
   * Error code for programmatic error handling
   *
   * Examples: 'BOOK_NOT_FOUND', 'CHAPTER_NOT_FOUND',
   * 'PERMISSION_DENIED', 'INVALID_BOOK_ID', etc.
   */
  code: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * HTTP status code
   */
  status?: number;

  /**
   * Additional error details
   */
  details?: Record<string, unknown>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Type guard to check if an error is a BookApiError
 *
 * @param error - The error to check
 * @returns True if the error is a BookApiError
 */
function isBookApiError(error: unknown): error is BookApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as BookApiError).code === 'string' &&
    typeof (error as BookApiError).message === 'string'
  );
}

/**
 * Type guard to check if an error is an Axios error
 *
 * @param error - The error to check
 * @returns True if the error has axios error properties
 */
function isAxiosError(error: unknown): error is { response?: { status?: number; data?: unknown }; message?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('response' in error || 'message' in error)
  );
}

/**
 * Create a standardized BookApiError
 *
 * @param code - Error code for programmatic handling
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @param details - Optional additional error details
 * @returns A structured BookApiError object
 */
function createBookApiError(
  code: string,
  message: string,
  status?: number,
  details?: Record<string, unknown>
): BookApiError {
  return {
    code,
    message,
    ...(status !== undefined && { status }),
    ...(details !== undefined && { details }),
  };
}

/**
 * Handle API errors consistently across all book API functions
 *
 * @param error - The caught error
 * @param defaultCode - Default error code if not extractable
 * @param defaultMessage - Default error message if not extractable
 * @returns A standardized BookApiError
 */
function handleBookApiError(
  error: unknown,
  defaultCode: string,
  defaultMessage: string
): BookApiError {
  // If already a BookApiError, return it
  if (isBookApiError(error)) {
    return error;
  }

  // Handle axios errors
  if (isAxiosError(error)) {
    const status = error.response?.status ?? 500;
    const errorData = error.response?.data as { error?: BookApiError } | undefined;

    // Extract error from response if available
    if (errorData?.error && isBookApiError(errorData.error)) {
      return {
        ...errorData.error,
        status,
      };
    }

    // Map common HTTP status codes to error messages
    switch (status) {
      case 401:
        return createBookApiError('UNAUTHORIZED', 'Authentication required. Please log in.', status);
      case 403:
        return createBookApiError('PERMISSION_DENIED', 'You do not have permission to access this book.', status);
      case 404:
        return createBookApiError('NOT_FOUND', 'The requested book or chapter was not found.', status);
      case 500:
        return createBookApiError('SERVER_ERROR', 'An internal server error occurred.', status);
      default:
        return createBookApiError(defaultCode, defaultMessage, status);
    }
  }

  // Handle generic errors
  return createBookApiError(
    'NETWORK_ERROR',
    error instanceof Error ? error.message : defaultMessage,
    0
  );
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch books by course IDs
 *
 * Calls GET /api/v1/book/courses which wraps the existing Moodle
 * get_books_by_courses() external function from mod_book_external class.
 *
 * The backend API endpoint:
 * 1. Validates course IDs
 * 2. Calls get_books_by_courses($courseids) from external.php line 178
 * 3. Filters results by user visibility permissions
 * 4. Returns array of books with metadata (numbering, navstyle, customtitles)
 *
 * If no course IDs are provided, retrieves books from all enrolled courses.
 *
 * @param courseIds - Array of course IDs to retrieve books for
 * @returns Promise resolving to array of books with warnings
 * @throws {BookApiError} If fetch fails or permission denied
 *
 * @example
 * ```typescript
 * // Fetch books for specific courses
 * const { books } = await fetchBooksByCoursesIds([1, 2, 3]);
 * console.log(`Found ${books.length} books`);
 *
 * // Fetch books from all enrolled courses
 * const { books: allBooks } = await fetchBooksByCoursesIds([]);
 * ```
 */
export async function fetchBooksByCoursesIds(courseIds: number[]): Promise<BooksResponse> {
  try {
    const response: AxiosResponse<ApiResponse<BooksResponse>> = await apiClient.get(
      BOOK_API_ENDPOINTS.BOOKS_BY_COURSES,
      {
        params: {
          courseids: courseIds.length > 0 ? courseIds.join(',') : undefined,
        },
      }
    );

    // Validate response structure
    if (!response.data || !response.data.success || !response.data.data) {
      throw createBookApiError(
        'INVALID_RESPONSE',
        'Invalid response format from books endpoint',
        500
      );
    }

    return response.data.data;
  } catch (error) {
    throw handleBookApiError(
      error,
      'FETCH_BOOKS_FAILED',
      'Failed to fetch books. Please try again.'
    );
  }
}

/**
 * Fetch a single book by ID
 *
 * Calls GET /api/v1/book/{id} which retrieves book details from the
 * mdl_book database table. Includes all book metadata including
 * numbering style, navigation style, and custom titles configuration.
 *
 * The backend API endpoint:
 * 1. Validates book ID
 * 2. Checks mod/book:read capability
 * 3. Retrieves book from database with full details
 * 4. Returns book entity with all configuration options
 *
 * @param bookId - The unique identifier of the book
 * @returns Promise resolving to the book entity
 * @throws {BookApiError} If book not found or permission denied
 *
 * @example
 * ```typescript
 * const book = await fetchBook(42);
 * console.log(`Book: ${book.name}`);
 * console.log(`Numbering style: ${book.numbering}`);
 * ```
 */
export async function fetchBook(bookId: number): Promise<Book> {
  try {
    const response: AxiosResponse<ApiResponse<Book>> = await apiClient.get(
      BOOK_API_ENDPOINTS.BOOK(bookId)
    );

    // Validate response structure
    if (!response.data || !response.data.success || !response.data.data) {
      throw createBookApiError(
        'INVALID_RESPONSE',
        'Invalid response format from book endpoint',
        500
      );
    }

    return response.data.data;
  } catch (error) {
    throw handleBookApiError(
      error,
      'FETCH_BOOK_FAILED',
      `Failed to fetch book with ID ${bookId}. Please try again.`
    );
  }
}

/**
 * Fetch all chapters for a book
 *
 * Calls GET /api/v1/book/{id}/chapters which wraps the existing Moodle
 * book_preload_chapters() function from locallib.php line 52.
 *
 * The backend API endpoint:
 * 1. Validates book ID
 * 2. Checks mod/book:read capability
 * 3. Calls book_preload_chapters($book) to get all chapters
 * 4. Filters hidden chapters based on mod/book:viewhiddenchapters capability
 * 5. Returns array of chapters with computed navigation properties
 *
 * Each chapter includes computed properties added by book_preload_chapters():
 * - parent: ID of parent chapter for subchapters
 * - number: Chapter number based on numbering style
 * - prev/next: Navigation links to adjacent chapters
 * - subchapters: Array of subchapter IDs for main chapters
 *
 * @param bookId - The unique identifier of the book
 * @returns Promise resolving to array of chapters
 * @throws {BookApiError} If book not found or permission denied
 *
 * @example
 * ```typescript
 * const chapters = await fetchBookChapters(42);
 * chapters.forEach(chapter => {
 *   console.log(`${chapter.pagenum}. ${chapter.title}`);
 * });
 * ```
 */
export async function fetchBookChapters(bookId: number): Promise<Chapter[]> {
  try {
    const response: AxiosResponse<ApiResponse<Chapter[]>> = await apiClient.get(
      BOOK_API_ENDPOINTS.BOOK_CHAPTERS(bookId)
    );

    // Validate response structure
    if (!response.data || !response.data.success || !response.data.data) {
      throw createBookApiError(
        'INVALID_RESPONSE',
        'Invalid response format from chapters endpoint',
        500
      );
    }

    return response.data.data;
  } catch (error) {
    throw handleBookApiError(
      error,
      'FETCH_CHAPTERS_FAILED',
      `Failed to fetch chapters for book ID ${bookId}. Please try again.`
    );
  }
}

/**
 * Fetch a specific chapter by ID
 *
 * Calls GET /api/v1/book/chapters/{id} to retrieve complete chapter
 * content including the HTML content field.
 *
 * The backend API endpoint:
 * 1. Validates chapter ID
 * 2. Retrieves chapter from book_chapters table
 * 3. Verifies user can access the parent book (mod/book:read)
 * 4. Checks if chapter is hidden (requires mod/book:viewhiddenchapters)
 * 5. Returns chapter with full content
 *
 * Note: The content field contains HTML that may need to be processed
 * with file_rewrite_pluginfile_urls() for embedded media.
 *
 * @param chapterId - The unique identifier of the chapter
 * @returns Promise resolving to the chapter entity with content
 * @throws {BookApiError} If chapter not found or permission denied
 *
 * @example
 * ```typescript
 * const chapter = await fetchChapter(123);
 * console.log(`Title: ${chapter.title}`);
 * console.log(`Content: ${chapter.content}`);
 * ```
 */
export async function fetchChapter(chapterId: number): Promise<Chapter> {
  try {
    const response: AxiosResponse<ApiResponse<Chapter>> = await apiClient.get(
      BOOK_API_ENDPOINTS.CHAPTER(chapterId)
    );

    // Validate response structure
    if (!response.data || !response.data.success || !response.data.data) {
      throw createBookApiError(
        'INVALID_RESPONSE',
        'Invalid response format from chapter endpoint',
        500
      );
    }

    return response.data.data;
  } catch (error) {
    throw handleBookApiError(
      error,
      'FETCH_CHAPTER_FAILED',
      `Failed to fetch chapter with ID ${chapterId}. Please try again.`
    );
  }
}

/**
 * Fetch book navigation structure (table of contents)
 *
 * Calls GET /api/v1/book/{id}/navigation which provides the complete
 * table of contents structure based on the book_get_toc() pattern
 * from locallib.php line 199.
 *
 * The backend API endpoint:
 * 1. Validates book ID
 * 2. Loads book and chapters via book_preload_chapters()
 * 3. Builds navigation structure with chapter hierarchy
 * 4. Applies numbering style (none, numbers, bullets, indented)
 * 5. Returns navigation object with chapters and current position
 *
 * The navigation structure is optimized for rendering a sidebar
 * table of contents with proper indentation and numbering.
 *
 * @param bookId - The unique identifier of the book
 * @returns Promise resolving to the book navigation structure
 * @throws {BookApiError} If book not found or permission denied
 *
 * @example
 * ```typescript
 * const nav = await fetchBookNavigation(42);
 * console.log(`Total chapters: ${nav.totalChapters}`);
 * nav.chapters.forEach(ch => {
 *   const indent = ch.subchapter ? '  ' : '';
 *   console.log(`${indent}${ch.number}. ${ch.title}`);
 * });
 * ```
 */
export async function fetchBookNavigation(bookId: number): Promise<BookNavigation> {
  try {
    const response: AxiosResponse<ApiResponse<BookNavigation>> = await apiClient.get(
      BOOK_API_ENDPOINTS.BOOK_NAVIGATION(bookId)
    );

    // Validate response structure
    if (!response.data || !response.data.success || !response.data.data) {
      throw createBookApiError(
        'INVALID_RESPONSE',
        'Invalid response format from navigation endpoint',
        500
      );
    }

    return response.data.data;
  } catch (error) {
    throw handleBookApiError(
      error,
      'FETCH_NAVIGATION_FAILED',
      `Failed to fetch navigation for book ID ${bookId}. Please try again.`
    );
  }
}

/**
 * Record a book or chapter view
 *
 * Calls POST /api/v1/book/{id}/view which wraps the existing Moodle
 * book_view() function from lib.php line 645. This is used for:
 * - Analytics tracking (which books/chapters are being read)
 * - Activity completion (viewing last chapter marks book as complete)
 * - Triggering events (course_module_viewed, chapter_viewed)
 *
 * The backend API endpoint:
 * 1. Validates book ID and optional chapter ID
 * 2. Verifies user can access the book (mod/book:read)
 * 3. If no chapter ID: triggers course_module_viewed event
 * 4. If chapter ID provided: triggers chapter_viewed event
 * 5. If viewing last chapter: marks activity as complete
 * 6. Returns success status and any warnings
 *
 * This function should be called when:
 * - User opens a book (no chapterId)
 * - User navigates to a specific chapter (with chapterId)
 *
 * @param bookId - The book being viewed
 * @param chapterId - Optional specific chapter being viewed
 * @returns Promise resolving to view recording status
 * @throws {BookApiError} If book not found or permission denied
 *
 * @example
 * ```typescript
 * // Record book open (no specific chapter)
 * await recordBookView(42);
 *
 * // Record specific chapter view
 * await recordBookView(42, 123);
 * ```
 */
export async function recordBookView(
  bookId: number,
  chapterId?: number
): Promise<BookViewResponse> {
  try {
    const response: AxiosResponse<ApiResponse<BookViewResponse>> = await apiClient.post(
      BOOK_API_ENDPOINTS.BOOK_VIEW(bookId),
      {
        chapterid: chapterId,
      }
    );

    // Validate response structure
    if (!response.data || !response.data.success || !response.data.data) {
      throw createBookApiError(
        'INVALID_RESPONSE',
        'Invalid response format from view endpoint',
        500
      );
    }

    return response.data.data;
  } catch (error) {
    throw handleBookApiError(
      error,
      'RECORD_VIEW_FAILED',
      `Failed to record view for book ID ${bookId}. Please try again.`
    );
  }
}

// ============================================================================
// React Query Key Constants
// ============================================================================

/**
 * Query key factory for book-related queries
 *
 * Provides consistent query keys for React Query cache management.
 * Use these keys with useQuery and useMutation for proper cache
 * invalidation and optimistic updates.
 *
 * @example
 * ```typescript
 * // In a React Query hook
 * const { data } = useQuery({
 *   queryKey: BOOK_QUERY_KEYS.book(42),
 *   queryFn: () => fetchBook(42)
 * });
 *
 * // Invalidate all book queries
 * queryClient.invalidateQueries({ queryKey: BOOK_QUERY_KEYS.all });
 * ```
 */
export const BOOK_QUERY_KEYS = {
  /** Base key for all book queries */
  all: ['books'] as const,

  /** Key for books by course IDs query */
  byCourses: (courseIds: number[]) => ['books', 'byCourses', courseIds] as const,

  /** Key for single book query */
  book: (bookId: number) => ['books', 'book', bookId] as const,

  /** Key for book chapters query */
  chapters: (bookId: number) => ['books', 'chapters', bookId] as const,

  /** Key for single chapter query */
  chapter: (chapterId: number) => ['books', 'chapter', chapterId] as const,

  /** Key for book navigation query */
  navigation: (bookId: number) => ['books', 'navigation', bookId] as const,
} as const;
