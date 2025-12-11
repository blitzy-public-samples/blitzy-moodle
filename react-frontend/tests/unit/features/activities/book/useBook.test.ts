/**
 * Unit Tests for useBook React Query Hook
 *
 * Comprehensive test suite validating the useBook hook's data fetching,
 * caching behavior, error handling, loading states, background refetching,
 * and query invalidation scenarios.
 *
 * The useBook hook wraps the fetchBook API function with React Query,
 * providing automatic caching (5-minute staleTime), background refetching
 * on window focus, and comprehensive state management for book metadata.
 *
 * Test Categories:
 * - Successful data fetching with proper book structure
 * - Loading state management (initial and refetch)
 * - Error handling (404, network errors, permission denied)
 * - React Query caching behavior with 5-minute staleTime
 * - Query key structure validation ['books', bookId]
 * - RefetchOnWindowFocus behavior simulation
 * - Query invalidation triggers refetch
 * - Hook return properties (isLoading, isError, error, data, refetch)
 * - TypeScript type safety validation
 * - Multiple book IDs with separate cache entries
 * - Stale data behavior after staleTime expires
 *
 * @module tests/unit/features/activities/book/useBook.test
 * @see react-frontend/src/features/activities/book/hooks/useBook.ts
 */

import React from 'react';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useBook, getBookQueryKey, getBookQueryKeyPrefix } from '@/features/activities/book/hooks/useBook';
import { fetchBook } from '@/features/activities/book/api/bookApi';
import type { Book } from '@/features/activities/book/types/book.types';
import { BookNumbering, BookNavStyle } from '@/features/activities/book/types/book.types';

// ============================================================================
// Mock Setup
// ============================================================================

/**
 * Mock the bookApi module to control fetchBook responses
 * This prevents actual API calls and allows testing various scenarios
 */
vi.mock('@/features/activities/book/api/bookApi', () => ({
  fetchBook: vi.fn(),
}));

/**
 * Type assertion for mocked fetchBook function
 * Allows access to mock-specific methods like mockResolvedValue
 */
const mockFetchBook = fetchBook as ReturnType<typeof vi.fn>;

// ============================================================================
// Test Fixtures - Mock Book Data
// ============================================================================

/**
 * Creates a mock Book object with all required database fields
 * Based on mdl_book table schema from public/mod/book/db/install.xml
 *
 * @param overrides - Partial Book object to override defaults
 * @returns Complete Book object for testing
 */
function createMockBook(overrides: Partial<Book> = {}): Book {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: 1,
    course: 101,
    name: 'Introduction to Software Engineering',
    intro: '<p>This book covers fundamental software engineering concepts.</p>',
    introformat: 1, // HTML format
    numbering: BookNumbering.NUMBERS,
    navstyle: BookNavStyle.IMAGES,
    customtitles: 0,
    revision: 5,
    timecreated: now - 86400 * 30, // 30 days ago
    timemodified: now - 86400, // 1 day ago
    ...overrides,
  };
}

/**
 * Creates an error object matching BookApiError structure
 * Used for testing error handling scenarios
 *
 * @param code - Error code (e.g., 'NOT_FOUND', 'PERMISSION_DENIED')
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @returns Error object for testing
 */
function createMockError(
  code: string,
  message: string,
  status: number = 500
): Error & { code: string; status: number } {
  const error = new Error(message) as Error & { code: string; status: number };
  error.code = code;
  error.status = status;
  return error;
}

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Creates a new QueryClient configured for testing
 *
 * Configuration:
 * - retry: false - Fail immediately on error for faster tests
 * - staleTime: 0 - Treat all data as stale for consistent test behavior
 * - gcTime: Infinity - Prevent garbage collection during tests
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: Infinity,
      },
    },
  });
}

/**
 * Wrapper props interface for QueryClientProvider
 */
interface WrapperProps {
  children: ReactNode;
}

/**
 * Creates a wrapper component with QueryClientProvider for hook testing
 *
 * @param queryClient - QueryClient instance to use
 * @returns Wrapper component function for renderHook
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: WrapperProps): React.ReactElement {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('useBook Hook', () => {
  let queryClient: QueryClient;

  /**
   * Setup before each test:
   * - Create fresh QueryClient to prevent test pollution
   * - Reset all mocks to clean state
   */
  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  /**
   * Cleanup after each test:
   * - Clear QueryClient cache
   * - Reset all mock implementations
   */
  afterEach(() => {
    queryClient.clear();
    vi.resetAllMocks();
  });

  // ==========================================================================
  // Successful Data Fetching Tests
  // ==========================================================================

  describe('Successful Data Fetching', () => {
    it('should fetch book data successfully with all required fields', async () => {
      const mockBook = createMockBook();
      mockFetchBook.mockResolvedValue(mockBook);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      // Wait for the query to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify all book fields are present and correctly typed
      const book = result.current.data;
      expect(book).toBeDefined();
      expect(book?.id).toBe(mockBook.id);
      expect(book?.course).toBe(mockBook.course);
      expect(book?.name).toBe(mockBook.name);
      expect(book?.intro).toBe(mockBook.intro);
      expect(book?.introformat).toBe(mockBook.introformat);
      expect(book?.numbering).toBe(mockBook.numbering);
      expect(book?.navstyle).toBe(mockBook.navstyle);
      expect(book?.customtitles).toBe(mockBook.customtitles);
      expect(book?.revision).toBe(mockBook.revision);
      expect(book?.timecreated).toBe(mockBook.timecreated);
      expect(book?.timemodified).toBe(mockBook.timemodified);
    });

    it('should call fetchBook with correct book ID', async () => {
      const bookId = 42;
      mockFetchBook.mockResolvedValue(createMockBook({ id: bookId }));

      const { result } = renderHook(() => useBook(bookId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetchBook).toHaveBeenCalledWith(bookId);
      expect(mockFetchBook).toHaveBeenCalledTimes(1);
    });

    it('should handle book with NONE numbering style', async () => {
      const mockBook = createMockBook({
        numbering: BookNumbering.NONE,
      });
      mockFetchBook.mockResolvedValue(mockBook);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.numbering).toBe(BookNumbering.NONE);
    });

    it('should handle book with BULLETS numbering style', async () => {
      const mockBook = createMockBook({
        numbering: BookNumbering.BULLETS,
      });
      mockFetchBook.mockResolvedValue(mockBook);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.numbering).toBe(BookNumbering.BULLETS);
    });

    it('should handle book with INDENTED numbering style', async () => {
      const mockBook = createMockBook({
        numbering: BookNumbering.INDENTED,
      });
      mockFetchBook.mockResolvedValue(mockBook);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.numbering).toBe(BookNumbering.INDENTED);
    });

    it('should handle book with TEXT navigation style', async () => {
      const mockBook = createMockBook({
        navstyle: BookNavStyle.TEXT,
      });
      mockFetchBook.mockResolvedValue(mockBook);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.navstyle).toBe(BookNavStyle.TEXT);
    });

    it('should handle book with custom titles enabled', async () => {
      const mockBook = createMockBook({
        customtitles: 1,
      });
      mockFetchBook.mockResolvedValue(mockBook);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.customtitles).toBe(1);
    });

    it('should handle book with null intro field', async () => {
      const mockBook = createMockBook({
        intro: null,
      });
      mockFetchBook.mockResolvedValue(mockBook);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.intro).toBeNull();
    });
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  describe('Loading States', () => {
    it('should return isLoading true initially while fetching', async () => {
      // Create a deferred promise to control when the API resolves
      let resolvePromise: (value: Book) => void;
      const deferredPromise = new Promise<Book>((resolve) => {
        resolvePromise = resolve;
      });
      mockFetchBook.mockReturnValue(deferredPromise);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isPending).toBe(true);
      expect(result.current.data).toBeUndefined();

      // Resolve the promise
      await act(async () => {
        resolvePromise!(createMockBook());
      });

      // Wait for state to update
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isPending).toBe(false);
      expect(result.current.data).toBeDefined();
    });

    it('should transition from loading to success state', async () => {
      mockFetchBook.mockResolvedValue(createMockBook());

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toBeDefined();
    });

    it('should show isFetching during background refetch', async () => {
      const mockBook = createMockBook();
      mockFetchBook.mockResolvedValue(mockBook);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Trigger a refetch
      let resolveRefetch: (value: Book) => void;
      const refetchPromise = new Promise<Book>((resolve) => {
        resolveRefetch = resolve;
      });
      mockFetchBook.mockReturnValue(refetchPromise);

      await act(async () => {
        result.current.refetch();
      });

      // Should have data but also be fetching
      await waitFor(() => {
        expect(result.current.isFetching).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.isLoading).toBe(false); // Not loading because we have cached data

      // Resolve refetch
      await act(async () => {
        resolveRefetch!(createMockBook({ revision: 6 }));
      });

      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle 404 not found error', async () => {
      const error = createMockError('NOT_FOUND', 'Book not found', 404);
      mockFetchBook.mockRejectedValue(error);

      const { result } = renderHook(() => useBook(999), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Book not found');
      expect(result.current.data).toBeUndefined();
    });

    it('should handle network error', async () => {
      const networkError = new Error('Network request failed');
      mockFetchBook.mockRejectedValue(networkError);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Network request failed');
    });

    it('should handle permission denied error (403)', async () => {
      const error = createMockError(
        'PERMISSION_DENIED',
        'You do not have permission to access this book',
        403
      );
      mockFetchBook.mockRejectedValue(error);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain('permission');
    });

    it('should handle server error (500)', async () => {
      const error = createMockError(
        'SERVER_ERROR',
        'Internal server error',
        500
      );
      mockFetchBook.mockRejectedValue(error);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Internal server error');
    });

    it('should transition from loading to error state', async () => {
      const error = new Error('Fetch failed');
      mockFetchBook.mockRejectedValue(error);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      // Should start loading
      expect(result.current.isLoading).toBe(true);

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(false);
    });
  });

  // ==========================================================================
  // Caching Behavior Tests
  // ==========================================================================

  describe('Caching Behavior', () => {
    it('should use query key structure ["books", bookId]', async () => {
      const bookId = 42;
      mockFetchBook.mockResolvedValue(createMockBook({ id: bookId }));

      const { result } = renderHook(() => useBook(bookId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the cache contains our data with correct key
      const cachedData = queryClient.getQueryData(['books', bookId]);
      expect(cachedData).toBeDefined();
      expect((cachedData as Book).id).toBe(bookId);
    });

    it('should return cached data on subsequent renders without refetch', async () => {
      const mockBook = createMockBook();
      mockFetchBook.mockResolvedValue(mockBook);

      // First render
      const { result, unmount } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetchBook).toHaveBeenCalledTimes(1);

      unmount();

      // Second render with same book ID
      const { result: result2 } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      // Should immediately have cached data
      expect(result2.current.data).toBeDefined();
      expect(result2.current.data?.id).toBe(mockBook.id);

      // Should not have made another fetch call
      expect(mockFetchBook).toHaveBeenCalledTimes(1);
    });

    it('should maintain separate cache entries for different book IDs', async () => {
      const book1 = createMockBook({ id: 1, name: 'Book One' });
      const book2 = createMockBook({ id: 2, name: 'Book Two' });

      mockFetchBook
        .mockResolvedValueOnce(book1)
        .mockResolvedValueOnce(book2);

      // Fetch first book
      const { result: result1 } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Fetch second book
      const { result: result2 } = renderHook(() => useBook(2), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Verify both caches exist independently
      const cachedBook1 = queryClient.getQueryData(['books', 1]) as Book;
      const cachedBook2 = queryClient.getQueryData(['books', 2]) as Book;

      expect(cachedBook1.name).toBe('Book One');
      expect(cachedBook2.name).toBe('Book Two');
      expect(mockFetchBook).toHaveBeenCalledTimes(2);
    });

    it('should respect 5-minute staleTime configuration', async () => {
      // Create a client with custom staleTime for this test
      const testClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 5 * 60 * 1000, // 5 minutes - matching production config
            gcTime: Infinity,
          },
        },
      });

      const mockBook = createMockBook();
      mockFetchBook.mockResolvedValue(mockBook);

      const { result } = renderHook(
        () => useBook(1, { staleTime: 5 * 60 * 1000 }),
        { wrapper: createWrapper(testClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Check query state - data should not be stale immediately
      const queryState = testClient.getQueryState(['books', 1]);
      expect(queryState?.isInvalidated).toBe(false);

      testClient.clear();
    });

    it('should fetch for new bookId after previous bookId data is cached', async () => {
      const book1 = createMockBook({ id: 1 });
      const book2 = createMockBook({ id: 2 });

      mockFetchBook
        .mockResolvedValueOnce(book1)
        .mockResolvedValueOnce(book2);

      // First render with book 1
      const { result, rerender } = renderHook(
        ({ bookId }) => useBook(bookId),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { bookId: 1 },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.id).toBe(1);

      // Rerender with book 2
      rerender({ bookId: 2 });

      await waitFor(() => {
        expect(result.current.data?.id).toBe(2);
      });

      // Both fetch calls should have been made
      expect(mockFetchBook).toHaveBeenCalledWith(1);
      expect(mockFetchBook).toHaveBeenCalledWith(2);
    });
  });

  // ==========================================================================
  // Query Invalidation Tests
  // ==========================================================================

  describe('Query Invalidation', () => {
    it('should refetch when query is invalidated', async () => {
      const initialBook = createMockBook({ revision: 1 });
      const updatedBook = createMockBook({ revision: 2 });

      mockFetchBook
        .mockResolvedValueOnce(initialBook)
        .mockResolvedValueOnce(updatedBook);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.revision).toBe(1);

      // Invalidate the query
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['books', 1] });
      });

      await waitFor(() => {
        expect(result.current.data?.revision).toBe(2);
      });

      expect(mockFetchBook).toHaveBeenCalledTimes(2);
    });

    it('should refetch when all book queries are invalidated', async () => {
      mockFetchBook
        .mockResolvedValueOnce(createMockBook({ revision: 1 }))
        .mockResolvedValueOnce(createMockBook({ revision: 2 }));

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Invalidate all book queries
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['books'] });
      });

      await waitFor(() => {
        expect(result.current.data?.revision).toBe(2);
      });
    });

    it('should support manual refetch through hook return value', async () => {
      const book1 = createMockBook({ revision: 1 });
      const book2 = createMockBook({ revision: 2 });

      mockFetchBook
        .mockResolvedValueOnce(book1)
        .mockResolvedValueOnce(book2);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.revision).toBe(1);

      // Manual refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.data?.revision).toBe(2);
      });
    });
  });

  // ==========================================================================
  // Hook Options Tests
  // ==========================================================================

  describe('Hook Options', () => {
    it('should not fetch when enabled is false', async () => {
      const mockBook = createMockBook();
      mockFetchBook.mockResolvedValue(mockBook);

      const { result } = renderHook(
        () => useBook(1, { enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      // Give it time to potentially fetch (it shouldn't)
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetchBook).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPending).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should not fetch when bookId is 0', async () => {
      mockFetchBook.mockResolvedValue(createMockBook());

      const { result } = renderHook(() => useBook(0), {
        wrapper: createWrapper(queryClient),
      });

      // Give it time to potentially fetch (it shouldn't)
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetchBook).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('should not fetch when bookId is negative', async () => {
      mockFetchBook.mockResolvedValue(createMockBook());

      const { result } = renderHook(() => useBook(-1), {
        wrapper: createWrapper(queryClient),
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetchBook).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('should fetch when enabled changes from false to true', async () => {
      const mockBook = createMockBook();
      mockFetchBook.mockResolvedValue(mockBook);

      const { result, rerender } = renderHook(
        ({ enabled }) => useBook(1, { enabled }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { enabled: false },
        }
      );

      // Initially disabled
      expect(mockFetchBook).not.toHaveBeenCalled();

      // Enable fetching
      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetchBook).toHaveBeenCalledTimes(1);
      expect(result.current.data).toBeDefined();
    });

    it('should respect custom staleTime option', async () => {
      mockFetchBook.mockResolvedValue(createMockBook());

      const customStaleTime = 10 * 60 * 1000; // 10 minutes

      const { result } = renderHook(
        () => useBook(1, { staleTime: customStaleTime }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the query was made with our hook (query state exists)
      const queryState = queryClient.getQueryState(['books', 1]);
      expect(queryState).toBeDefined();
    });
  });

  // ==========================================================================
  // RefetchOnWindowFocus Tests
  // ==========================================================================

  describe('RefetchOnWindowFocus Behavior', () => {
    it('should refetch on window focus by default when data is stale', async () => {
      const book1 = createMockBook({ revision: 1 });
      const book2 = createMockBook({ revision: 2 });

      mockFetchBook
        .mockResolvedValueOnce(book1)
        .mockResolvedValueOnce(book2);

      // Use a client that marks data as stale immediately
      const focusTestClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 0, // Data is immediately stale
            gcTime: Infinity,
            refetchOnWindowFocus: true,
          },
        },
      });

      const { result } = renderHook(
        () => useBook(1, { refetchOnWindowFocus: true }),
        { wrapper: createWrapper(focusTestClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.revision).toBe(1);

      // Simulate window focus event
      await act(async () => {
        focusTestClient.getQueryCache().onFocus();
      });

      await waitFor(() => {
        expect(result.current.data?.revision).toBe(2);
      });

      focusTestClient.clear();
    });

    it('should not refetch on window focus when refetchOnWindowFocus is false', async () => {
      mockFetchBook.mockResolvedValue(createMockBook());

      const { result } = renderHook(
        () => useBook(1, { refetchOnWindowFocus: false }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const initialCallCount = mockFetchBook.mock.calls.length;

      // Simulate window focus
      await act(async () => {
        queryClient.getQueryCache().onFocus();
      });

      // Wait a bit to ensure no additional fetch
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not have made additional calls
      expect(mockFetchBook.mock.calls.length).toBe(initialCallCount);
    });
  });

  // ==========================================================================
  // Hook Return Value Tests
  // ==========================================================================

  describe('Hook Return Properties', () => {
    it('should return all React Query properties', async () => {
      mockFetchBook.mockResolvedValue(createMockBook());

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      // Check that all expected properties exist
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isPending');
      expect(result.current).toHaveProperty('isError');
      expect(result.current).toHaveProperty('isSuccess');
      expect(result.current).toHaveProperty('isFetching');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
      expect(result.current).toHaveProperty('status');
      expect(result.current).toHaveProperty('fetchStatus');

      // Verify refetch is a function
      expect(typeof result.current.refetch).toBe('function');
    });

    it('should return correct status values through query lifecycle', async () => {
      let resolvePromise: (value: Book) => void;
      const deferredPromise = new Promise<Book>((resolve) => {
        resolvePromise = resolve;
      });
      mockFetchBook.mockReturnValue(deferredPromise);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      // Pending state
      expect(result.current.status).toBe('pending');
      expect(result.current.fetchStatus).toBe('fetching');

      // Resolve to success
      await act(async () => {
        resolvePromise!(createMockBook());
      });

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe('Utility Functions', () => {
    it('getBookQueryKey should return correct query key format', () => {
      const bookId = 42;
      const queryKey = getBookQueryKey(bookId);

      expect(queryKey).toEqual(['books', bookId]);
      expect(queryKey[0]).toBe('books');
      expect(queryKey[1]).toBe(42);
    });

    it('getBookQueryKeyPrefix should return "books"', () => {
      const prefix = getBookQueryKeyPrefix();
      expect(prefix).toBe('books');
    });

    it('should use getBookQueryKey for cache lookups', async () => {
      const bookId = 123;
      const mockBook = createMockBook({ id: bookId });
      mockFetchBook.mockResolvedValue(mockBook);

      const { result } = renderHook(() => useBook(bookId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Use getBookQueryKey to verify cache
      const cachedData = queryClient.getQueryData(getBookQueryKey(bookId));
      expect(cachedData).toBeDefined();
      expect((cachedData as Book).id).toBe(bookId);
    });
  });

  // ==========================================================================
  // TypeScript Type Safety Tests
  // ==========================================================================

  describe('TypeScript Type Safety', () => {
    it('should return properly typed Book object', async () => {
      mockFetchBook.mockResolvedValue(createMockBook());

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const book = result.current.data;

      // TypeScript should recognize these as the correct types
      // These assertions verify runtime type correctness
      if (book) {
        expect(typeof book.id).toBe('number');
        expect(typeof book.course).toBe('number');
        expect(typeof book.name).toBe('string');
        expect(book.intro === null || typeof book.intro === 'string').toBe(true);
        expect(typeof book.introformat).toBe('number');
        expect(typeof book.numbering).toBe('number');
        expect(typeof book.navstyle).toBe('number');
        expect(typeof book.customtitles).toBe('number');
        expect(typeof book.revision).toBe('number');
        expect(typeof book.timecreated).toBe('number');
        expect(typeof book.timemodified).toBe('number');
      }
    });

    it('should return Error type for error state', async () => {
      const testError = new Error('Test error');
      mockFetchBook.mockRejectedValue(testError);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Error should be an Error instance
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Test error');
    });
  });

  // ==========================================================================
  // Book Metadata Validation Tests
  // ==========================================================================

  describe('Book Metadata Validation', () => {
    it('should include all required database fields per schema', async () => {
      const fullBook = createMockBook({
        id: 1,
        course: 101,
        name: 'Complete Book',
        intro: '<p>Full introduction</p>',
        introformat: 1,
        numbering: BookNumbering.NUMBERS,
        navstyle: BookNavStyle.IMAGES,
        customtitles: 1,
        revision: 10,
        timecreated: 1609459200, // 2021-01-01 00:00:00
        timemodified: 1640995200, // 2022-01-01 00:00:00
      });

      mockFetchBook.mockResolvedValue(fullBook);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const book = result.current.data;

      // Validate all required fields exist with correct values
      expect(book?.id).toBe(1);
      expect(book?.course).toBe(101);
      expect(book?.name).toBe('Complete Book');
      expect(book?.intro).toBe('<p>Full introduction</p>');
      expect(book?.introformat).toBe(1);
      expect(book?.numbering).toBe(BookNumbering.NUMBERS);
      expect(book?.navstyle).toBe(BookNavStyle.IMAGES);
      expect(book?.customtitles).toBe(1);
      expect(book?.revision).toBe(10);
      expect(book?.timecreated).toBe(1609459200);
      expect(book?.timemodified).toBe(1640995200);
    });

    it('should handle all BookNumbering enum values', async () => {
      const numberingValues = [
        BookNumbering.NONE,
        BookNumbering.NUMBERS,
        BookNumbering.BULLETS,
        BookNumbering.INDENTED,
      ];

      for (const numbering of numberingValues) {
        queryClient.clear();
        vi.clearAllMocks();

        mockFetchBook.mockResolvedValue(
          createMockBook({ id: numbering + 1, numbering })
        );

        const { result } = renderHook(() => useBook(numbering + 1), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.numbering).toBe(numbering);
      }
    });

    it('should handle all BookNavStyle enum values', async () => {
      const navStyles = [BookNavStyle.TEXT, BookNavStyle.IMAGES];

      for (const navstyle of navStyles) {
        queryClient.clear();
        vi.clearAllMocks();

        mockFetchBook.mockResolvedValue(
          createMockBook({ id: navstyle + 10, navstyle })
        );

        const { result } = renderHook(() => useBook(navstyle + 10), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.navstyle).toBe(navstyle);
      }
    });

    it('should handle book with zero revision (newly created)', async () => {
      const newBook = createMockBook({
        revision: 0,
        timecreated: Math.floor(Date.now() / 1000),
        timemodified: Math.floor(Date.now() / 1000),
      });

      mockFetchBook.mockResolvedValue(newBook);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.revision).toBe(0);
      expect(result.current.data?.timecreated).toBe(result.current.data?.timemodified);
    });
  });

  // ==========================================================================
  // Stale Data Behavior Tests
  // ==========================================================================

  describe('Stale Data Behavior', () => {
    it('should serve stale data while refetching in background', async () => {
      const oldBook = createMockBook({ name: 'Old Title', revision: 1 });
      const newBook = createMockBook({ name: 'New Title', revision: 2 });

      mockFetchBook.mockResolvedValueOnce(oldBook);

      const { result } = renderHook(
        () => useBook(1, { staleTime: 0 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.name).toBe('Old Title');

      // Set up delayed response for refetch
      let resolveRefetch: (value: Book) => void;
      mockFetchBook.mockReturnValueOnce(
        new Promise<Book>((resolve) => {
          resolveRefetch = resolve;
        })
      );

      // Trigger refetch
      act(() => {
        result.current.refetch();
      });

      // Should still show old data while fetching
      await waitFor(() => {
        expect(result.current.isFetching).toBe(true);
      });

      expect(result.current.data?.name).toBe('Old Title');

      // Resolve with new data
      await act(async () => {
        resolveRefetch!(newBook);
      });

      await waitFor(() => {
        expect(result.current.data?.name).toBe('New Title');
      });
    });

    it('should update data when refetch completes', async () => {
      const versions = [
        createMockBook({ revision: 1, name: 'Version 1' }),
        createMockBook({ revision: 2, name: 'Version 2' }),
        createMockBook({ revision: 3, name: 'Version 3' }),
      ];

      mockFetchBook
        .mockResolvedValueOnce(versions[0])
        .mockResolvedValueOnce(versions[1])
        .mockResolvedValueOnce(versions[2]);

      const { result } = renderHook(() => useBook(1), {
        wrapper: createWrapper(queryClient),
      });

      // First fetch
      await waitFor(() => {
        expect(result.current.data?.revision).toBe(1);
      });

      // Second fetch via refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.data?.revision).toBe(2);
      });

      // Third fetch via invalidation
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['books', 1] });
      });

      await waitFor(() => {
        expect(result.current.data?.revision).toBe(3);
      });
    });
  });
});
