/**
 * Book API Client Unit Tests
 *
 * Comprehensive Vitest test suite for the book activity API client functions.
 * Tests cover success cases, error handling, network failures, and API response
 * validation for all book-related API operations.
 *
 * Functions Tested:
 * - fetchBook() - Retrieve book metadata by ID
 * - fetchBookChapters() - Retrieve all chapters for a book
 * - fetchChapter() - Retrieve single chapter with content
 * - fetchBookNavigation() - Retrieve table of contents structure
 * - recordBookView() - Record book/chapter view for analytics
 *
 * Testing Patterns:
 * - Mock axios HTTP client using vi.mock() to avoid actual API calls
 * - Test standard API response envelope handling (success, data, meta)
 * - Validate TypeScript interfaces for Book, Chapter, BookNavigation
 * - Cover edge cases: empty books, nested chapters, large books (50+ chapters)
 * - Cover error scenarios: 404 not found, network errors, permission denied
 *
 * @module tests/unit/features/activities/book/bookApi.test
 * @see react-frontend/src/features/activities/book/api/bookApi.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import type { AxiosResponse } from 'axios';

import {
  fetchBook,
  fetchBookChapters,
  fetchChapter,
  fetchBookNavigation,
  recordBookView,
  fetchBooksByCoursesIds,
  type BookNavigation,
  type BooksResponse,
  type BookViewResponse,
} from '@/features/activities/book/api/bookApi';
import type { Book, Chapter } from '@/features/activities/book/types/book.types';
import { apiClient } from '@/services/api/client';
import type { ApiResponse } from '@/types/api';

// ============================================================================
// Mock Setup
// ============================================================================

/**
 * Mock the API client module
 *
 * We mock the entire @/services/api/client module to control API responses
 * without making actual network requests. This allows testing success cases,
 * error handling, and edge cases in isolation.
 */
vi.mock('@/services/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Type the mocked functions for better TypeScript support
const mockedApiClientGet = apiClient.get as MockedFunction<typeof apiClient.get>;
const mockedApiClientPost = apiClient.post as MockedFunction<typeof apiClient.post>;

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a mock book entity
 *
 * @param overrides - Optional fields to override default values
 * @returns A complete Book object for testing
 */
function createMockBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 1,
    course: 42,
    name: 'Introduction to Programming',
    intro: '<p>This book covers programming fundamentals.</p>',
    introformat: 1,
    numbering: 1, // BookNumbering.NUMBERS
    navstyle: 1, // BookNavStyle.IMAGES
    customtitles: 0,
    revision: 5,
    timecreated: 1700000000,
    timemodified: 1705000000,
    ...overrides,
  };
}

/**
 * Create a mock chapter entity
 *
 * @param overrides - Optional fields to override default values
 * @returns A complete Chapter object for testing
 */
function createMockChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 100,
    bookid: 1,
    pagenum: 1,
    subchapter: 0,
    title: 'Chapter 1: Getting Started',
    content: '<p>Welcome to the first chapter.</p>',
    contentformat: 1,
    hidden: 0,
    timecreated: 1700000000,
    timemodified: 1705000000,
    importsrc: '',
    parent: null,
    number: '1',
    prev: null,
    next: { prev: 100, next: 102, parent: null },
    subchapters: [101],
    ...overrides,
  };
}

/**
 * Create a mock API success response
 *
 * @template T - Type of the response data
 * @param data - The data payload
 * @param meta - Optional metadata
 * @returns A mock Axios response with ApiResponse structure
 */
function createMockResponse<T>(
  data: T,
  meta?: Record<string, unknown>
): AxiosResponse<ApiResponse<T>> {
  return {
    data: {
      success: true,
      data,
      ...(meta && { meta }),
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as AxiosResponse['config'],
  };
}

/**
 * Create a mock API error response
 *
 * @param status - HTTP status code
 * @param code - Error code
 * @param message - Error message
 * @returns A mock Axios error object
 */
function createMockError(status: number, code: string, message: string) {
  const error = new Error(message) as Error & {
    response?: { status: number; data: { error: { code: string; message: string } } };
    isAxiosError: boolean;
  };
  error.response = {
    status,
    data: {
      error: {
        code,
        message,
      },
    },
  };
  error.isAxiosError = true;
  return error;
}

/**
 * Create a mock network error (no response)
 *
 * @param message - Error message
 * @returns A mock network error object
 */
function createNetworkError(message: string = 'Network Error'): Error {
  const error = new Error(message);
  return error;
}

// ============================================================================
// Test Suite: fetchBook
// ============================================================================

describe('fetchBook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('success cases', () => {
    it('should fetch book by ID and return book metadata', async () => {
      // Arrange
      const mockBook = createMockBook({ id: 42, name: 'Test Book' });
      const mockResponse = createMockResponse(mockBook);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBook(42);

      // Assert
      expect(result).toEqual(mockBook);
      expect(mockedApiClientGet).toHaveBeenCalledTimes(1);
      expect(mockedApiClientGet).toHaveBeenCalledWith('/book/42');
    });

    it('should return book with all metadata fields (numbering, navstyle, customtitles, revision)', async () => {
      // Arrange
      const mockBook = createMockBook({
        id: 1,
        name: 'Complete Book',
        intro: 'Full intro text',
        numbering: 2, // BookNumbering.BULLETS
        navstyle: 0, // BookNavStyle.TEXT
        customtitles: 1,
        revision: 10,
      });
      const mockResponse = createMockResponse(mockBook);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBook(1);

      // Assert
      expect(result.id).toBe(1);
      expect(result.name).toBe('Complete Book');
      expect(result.intro).toBe('Full intro text');
      expect(result.numbering).toBe(2);
      expect(result.navstyle).toBe(0);
      expect(result.customtitles).toBe(1);
      expect(result.revision).toBe(10);
    });

    it('should handle book with null intro field', async () => {
      // Arrange
      const mockBook = createMockBook({ intro: null });
      const mockResponse = createMockResponse(mockBook);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBook(1);

      // Assert
      expect(result.intro).toBeNull();
    });

    it('should correctly parse response with meta field', async () => {
      // Arrange
      const mockBook = createMockBook();
      const mockResponse = createMockResponse(mockBook, { timestamp: 1705327200 });
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBook(1);

      // Assert
      expect(result).toEqual(mockBook);
    });
  });

  describe('error handling', () => {
    it('should throw error for 404 not found', async () => {
      // Arrange
      // When response.data.error contains a valid BookApiError, the implementation
      // returns that error directly with the status from the response
      const mockError = createMockError(404, 'NOT_FOUND', 'Book not found');
      mockedApiClientGet.mockRejectedValueOnce(mockError);

      // Act & Assert
      await expect(fetchBook(999)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Book not found',
        status: 404,
      });
    });

    it('should throw error for 403 permission denied', async () => {
      // Arrange
      const mockError = createMockError(403, 'PERMISSION_DENIED', 'Access denied');
      mockedApiClientGet.mockRejectedValueOnce(mockError);

      // Act & Assert
      await expect(fetchBook(1)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
        message: 'Access denied',
        status: 403,
      });
    });

    it('should throw error for 401 unauthorized', async () => {
      // Arrange
      const mockError = createMockError(401, 'UNAUTHORIZED', 'Not authenticated');
      mockedApiClientGet.mockRejectedValueOnce(mockError);

      // Act & Assert
      await expect(fetchBook(1)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
        status: 401,
      });
    });

    it('should throw error for 500 server error', async () => {
      // Arrange
      const mockError = createMockError(500, 'SERVER_ERROR', 'Internal error');
      mockedApiClientGet.mockRejectedValueOnce(mockError);

      // Act & Assert
      await expect(fetchBook(1)).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        message: 'Internal error',
        status: 500,
      });
    });

    it('should handle network errors gracefully', async () => {
      // Arrange
      // Network errors (plain Error with message) are treated as axios errors
      // due to isAxiosError checking for 'message' property, resulting in 
      // status 500 (from response?.status ?? 500) and SERVER_ERROR code
      const networkError = createNetworkError('Network Error');
      mockedApiClientGet.mockRejectedValueOnce(networkError);

      // Act & Assert
      await expect(fetchBook(1)).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        message: 'An internal server error occurred.',
        status: 500,
      });
    });

    it('should throw error for invalid response format (missing success)', async () => {
      // Arrange
      const invalidResponse = {
        data: { data: createMockBook() }, // Missing success: true
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };
      mockedApiClientGet.mockResolvedValueOnce(invalidResponse);

      // Act & Assert
      await expect(fetchBook(1)).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    });

    it('should throw error for invalid response format (missing data)', async () => {
      // Arrange
      const invalidResponse = {
        data: { success: true }, // Missing data field
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };
      mockedApiClientGet.mockResolvedValueOnce(invalidResponse);

      // Act & Assert
      await expect(fetchBook(1)).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    });
  });
});

// ============================================================================
// Test Suite: fetchBookChapters
// ============================================================================

describe('fetchBookChapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('success cases', () => {
    it('should fetch all chapters for a book ordered by pagenum', async () => {
      // Arrange
      const mockChapters: Chapter[] = [
        createMockChapter({ id: 1, pagenum: 1, title: 'Chapter 1' }),
        createMockChapter({ id: 2, pagenum: 2, title: 'Chapter 2' }),
        createMockChapter({ id: 3, pagenum: 3, title: 'Chapter 3' }),
      ];
      const mockResponse = createMockResponse(mockChapters);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBookChapters(42);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0]!.pagenum).toBe(1);
      expect(result[1]!.pagenum).toBe(2);
      expect(result[2]!.pagenum).toBe(3);
      expect(mockedApiClientGet).toHaveBeenCalledWith('/book/42/chapters');
    });

    it('should handle nested chapter hierarchies (subchapter flag = 1)', async () => {
      // Arrange
      const mockChapters: Chapter[] = [
        createMockChapter({ id: 1, pagenum: 1, subchapter: 0, title: 'Chapter 1', parent: null }),
        createMockChapter({ id: 2, pagenum: 2, subchapter: 1, title: 'Chapter 1.1', parent: 1 }),
        createMockChapter({ id: 3, pagenum: 3, subchapter: 1, title: 'Chapter 1.2', parent: 1 }),
        createMockChapter({ id: 4, pagenum: 4, subchapter: 0, title: 'Chapter 2', parent: null }),
        createMockChapter({ id: 5, pagenum: 5, subchapter: 1, title: 'Chapter 2.1', parent: 4 }),
      ];
      const mockResponse = createMockResponse(mockChapters);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBookChapters(1);

      // Assert
      expect(result).toHaveLength(5);
      
      // Main chapters
      expect(result[0]!.subchapter).toBe(0);
      expect(result[0]!.parent).toBeNull();
      
      // Subchapters
      expect(result[1]!.subchapter).toBe(1);
      expect(result[1]!.parent).toBe(1);
      expect(result[2]!.subchapter).toBe(1);
      expect(result[2]!.parent).toBe(1);
      expect(result[4]!.subchapter).toBe(1);
      expect(result[4]!.parent).toBe(4);
    });

    it('should handle large books with 50+ chapters', async () => {
      // Arrange
      const mockChapters: Chapter[] = Array.from({ length: 55 }, (_, i) =>
        createMockChapter({
          id: i + 1,
          pagenum: i + 1,
          title: `Chapter ${i + 1}`,
          subchapter: i % 5 === 0 ? 0 : 1, // Every 5th is a main chapter
          parent: i % 5 === 0 ? null : Math.floor(i / 5) * 5 + 1,
        })
      );
      const mockResponse = createMockResponse(mockChapters);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBookChapters(1);

      // Assert
      expect(result).toHaveLength(55);
      expect(result[0]!.subchapter).toBe(0);
      expect(result[54]!.pagenum).toBe(55);
    });

    it('should handle empty book with no chapters', async () => {
      // Arrange
      const mockChapters: Chapter[] = [];
      const mockResponse = createMockResponse(mockChapters);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBookChapters(1);

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should return chapters with navigation properties (prev, next)', async () => {
      // Arrange
      const mockChapters: Chapter[] = [
        createMockChapter({
          id: 1,
          pagenum: 1,
          prev: null,
          next: { prev: 1, next: 3, parent: null },
        }),
        createMockChapter({
          id: 2,
          pagenum: 2,
          prev: { prev: null, next: 2, parent: null },
          next: { prev: 2, next: null, parent: null },
        }),
        createMockChapter({
          id: 3,
          pagenum: 3,
          prev: { prev: 1, next: 3, parent: null },
          next: null,
        }),
      ];
      const mockResponse = createMockResponse(mockChapters);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBookChapters(1);

      // Assert
      expect(result[0]!.prev).toBeNull();
      expect(result[0]!.next).toBeDefined();
      expect(result[2]!.next).toBeNull();
    });

    it('should handle hidden chapters correctly', async () => {
      // Arrange
      const mockChapters: Chapter[] = [
        createMockChapter({ id: 1, pagenum: 1, hidden: 0 }),
        createMockChapter({ id: 2, pagenum: 2, hidden: 1 }), // Hidden chapter
        createMockChapter({ id: 3, pagenum: 3, hidden: 0 }),
      ];
      const mockResponse = createMockResponse(mockChapters);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBookChapters(1);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0]!.hidden).toBe(0);
      expect(result[1]!.hidden).toBe(1);
      expect(result[2]!.hidden).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should throw error for 404 book not found', async () => {
      // Arrange
      const mockError = createMockError(404, 'NOT_FOUND', 'Book not found');
      mockedApiClientGet.mockRejectedValueOnce(mockError);

      // Act & Assert
      await expect(fetchBookChapters(999)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('should handle network errors', async () => {
      // Arrange
      // Network errors result in SERVER_ERROR due to isAxiosError detecting 'message' property
      const networkError = createNetworkError('Request timeout');
      mockedApiClientGet.mockRejectedValueOnce(networkError);

      // Act & Assert
      await expect(fetchBookChapters(1)).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        message: 'An internal server error occurred.',
        status: 500,
      });
    });
  });
});

// ============================================================================
// Test Suite: fetchChapter
// ============================================================================

describe('fetchChapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('success cases', () => {
    it('should fetch single chapter with content', async () => {
      // Arrange
      const mockChapter = createMockChapter({
        id: 123,
        title: 'Test Chapter',
        content: '<p>Chapter content goes here.</p>',
        contentformat: 1,
        hidden: 0,
      });
      const mockResponse = createMockResponse(mockChapter);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchChapter(123);

      // Assert
      expect(result).toEqual(mockChapter);
      expect(result.content).toBe('<p>Chapter content goes here.</p>');
      expect(mockedApiClientGet).toHaveBeenCalledWith('/book/chapters/123');
    });

    it('should return chapter with all required fields', async () => {
      // Arrange
      const mockChapter = createMockChapter({
        id: 1,
        bookid: 42,
        pagenum: 5,
        subchapter: 1,
        title: 'Subchapter Title',
        content: '<h1>Content</h1><p>Body text</p>',
        contentformat: 1,
        hidden: 0,
        parent: 100,
        number: '2.1',
      });
      const mockResponse = createMockResponse(mockChapter);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchChapter(1);

      // Assert
      expect(result.bookid).toBe(42);
      expect(result.pagenum).toBe(5);
      expect(result.subchapter).toBe(1);
      expect(result.title).toBe('Subchapter Title');
      expect(result.contentformat).toBe(1);
      expect(result.hidden).toBe(0);
      expect(result.parent).toBe(100);
    });

    it('should handle hidden chapter (hidden = 1)', async () => {
      // Arrange
      const mockChapter = createMockChapter({
        id: 1,
        hidden: 1,
        number: 'x', // Hidden chapters have 'x' as number
      });
      const mockResponse = createMockResponse(mockChapter);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchChapter(1);

      // Assert
      expect(result.hidden).toBe(1);
      expect(result.number).toBe('x');
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid chapter ID (404)', async () => {
      // Arrange
      const mockError = createMockError(404, 'NOT_FOUND', 'Chapter not found');
      mockedApiClientGet.mockRejectedValueOnce(mockError);

      // Act & Assert
      await expect(fetchChapter(99999)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('should throw error for permission denied on hidden chapter', async () => {
      // Arrange
      const mockError = createMockError(403, 'PERMISSION_DENIED', 'Cannot view hidden chapter');
      mockedApiClientGet.mockRejectedValueOnce(mockError);

      // Act & Assert
      await expect(fetchChapter(1)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
        status: 403,
      });
    });

    it('should handle network errors', async () => {
      // Arrange
      // Network errors result in SERVER_ERROR due to isAxiosError detecting 'message' property
      const networkError = createNetworkError('Connection refused');
      mockedApiClientGet.mockRejectedValueOnce(networkError);

      // Act & Assert
      await expect(fetchChapter(1)).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        message: 'An internal server error occurred.',
        status: 500,
      });
    });
  });
});

// ============================================================================
// Test Suite: fetchBookNavigation
// ============================================================================

describe('fetchBookNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Create a mock book navigation structure
   */
  function createMockNavigation(overrides: Partial<BookNavigation> = {}): BookNavigation {
    return {
      chapters: [
        createMockChapter({ id: 1, pagenum: 1, title: 'Chapter 1' }),
        createMockChapter({ id: 2, pagenum: 2, title: 'Chapter 2' }),
      ],
      currentChapterId: 1,
      totalChapters: 2,
      numberingStyle: 1,
      ...overrides,
    };
  }

  describe('success cases', () => {
    it('should fetch book navigation/TOC structure', async () => {
      // Arrange
      const mockNavigation = createMockNavigation();
      const mockResponse = createMockResponse(mockNavigation);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBookNavigation(42);

      // Assert
      expect(result).toEqual(mockNavigation);
      expect(mockedApiClientGet).toHaveBeenCalledWith('/book/42/navigation');
    });

    it('should return navigation with chapter relationships', async () => {
      // Arrange
      const chapters: Chapter[] = [
        createMockChapter({
          id: 1,
          pagenum: 1,
          prev: null,
          next: { prev: 1, next: 3, parent: null },
        }),
        createMockChapter({
          id: 2,
          pagenum: 2,
          subchapter: 1,
          parent: 1,
          prev: { prev: null, next: 2, parent: 1 },
          next: { prev: 2, next: null, parent: null },
        }),
        createMockChapter({
          id: 3,
          pagenum: 3,
          prev: { prev: 1, next: 3, parent: null },
          next: null,
        }),
      ];
      const mockNavigation = createMockNavigation({ chapters, totalChapters: 3 });
      const mockResponse = createMockResponse(mockNavigation);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBookNavigation(1);

      // Assert
      expect(result.chapters).toHaveLength(3);
      expect(result.totalChapters).toBe(3);
      
      // First chapter has no prev
      expect(result.chapters[0]!.prev).toBeNull();
      expect(result.chapters[0]!.next).toBeDefined();
      
      // Last chapter has no next
      expect(result.chapters[2]!.next).toBeNull();
      expect(result.chapters[2]!.prev).toBeDefined();
    });

    it('should return correct numbering style', async () => {
      // Arrange
      const mockNavigation = createMockNavigation({ numberingStyle: 2 }); // BULLETS
      const mockResponse = createMockResponse(mockNavigation);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBookNavigation(1);

      // Assert
      expect(result.numberingStyle).toBe(2);
    });

    it('should handle navigation for empty book', async () => {
      // Arrange
      const mockNavigation = createMockNavigation({
        chapters: [],
        currentChapterId: null,
        totalChapters: 0,
      });
      const mockResponse = createMockResponse(mockNavigation);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBookNavigation(1);

      // Assert
      expect(result.chapters).toEqual([]);
      expect(result.currentChapterId).toBeNull();
      expect(result.totalChapters).toBe(0);
    });

    it('should handle navigation with nested chapters', async () => {
      // Arrange
      const chapters: Chapter[] = [
        createMockChapter({ id: 1, pagenum: 1, subchapter: 0, number: '1' }),
        createMockChapter({ id: 2, pagenum: 2, subchapter: 1, parent: 1, number: '1.1' }),
        createMockChapter({ id: 3, pagenum: 3, subchapter: 1, parent: 1, number: '1.2' }),
        createMockChapter({ id: 4, pagenum: 4, subchapter: 0, number: '2' }),
      ];
      const mockNavigation = createMockNavigation({
        chapters,
        totalChapters: 4,
      });
      const mockResponse = createMockResponse(mockNavigation);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBookNavigation(1);

      // Assert
      expect(result.chapters).toHaveLength(4);
      const mainChapters = result.chapters.filter((c) => c.subchapter === 0);
      const subchapters = result.chapters.filter((c) => c.subchapter === 1);
      expect(mainChapters).toHaveLength(2);
      expect(subchapters).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should throw error for 404 book not found', async () => {
      // Arrange
      const mockError = createMockError(404, 'NOT_FOUND', 'Book not found');
      mockedApiClientGet.mockRejectedValueOnce(mockError);

      // Act & Assert
      await expect(fetchBookNavigation(999)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('should handle network errors', async () => {
      // Arrange
      // Network errors result in SERVER_ERROR due to isAxiosError detecting 'message' property
      const networkError = createNetworkError('DNS lookup failed');
      mockedApiClientGet.mockRejectedValueOnce(networkError);

      // Act & Assert
      await expect(fetchBookNavigation(1)).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        message: 'An internal server error occurred.',
        status: 500,
      });
    });
  });
});

// ============================================================================
// Test Suite: recordBookView
// ============================================================================

describe('recordBookView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Create a mock book view response
   */
  function createMockViewResponse(overrides: Partial<BookViewResponse> = {}): BookViewResponse {
    return {
      status: true,
      ...overrides,
    };
  }

  describe('success cases', () => {
    it('should record book view with bookId only', async () => {
      // Arrange
      const mockViewResponse = createMockViewResponse();
      const mockResponse = createMockResponse(mockViewResponse);
      mockedApiClientPost.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await recordBookView(42);

      // Assert
      expect(result).toEqual(mockViewResponse);
      expect(mockedApiClientPost).toHaveBeenCalledTimes(1);
      expect(mockedApiClientPost).toHaveBeenCalledWith('/book/42/view', { chapterid: undefined });
    });

    it('should record book view with bookId and chapterId', async () => {
      // Arrange
      const mockViewResponse = createMockViewResponse();
      const mockResponse = createMockResponse(mockViewResponse);
      mockedApiClientPost.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await recordBookView(42, 123);

      // Assert
      expect(result.status).toBe(true);
      expect(mockedApiClientPost).toHaveBeenCalledWith('/book/42/view', { chapterid: 123 });
    });

    it('should return success status true on successful view recording', async () => {
      // Arrange
      const mockViewResponse = createMockViewResponse({ status: true });
      const mockResponse = createMockResponse(mockViewResponse);
      mockedApiClientPost.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await recordBookView(1);

      // Assert
      expect(result.status).toBe(true);
    });

    it('should handle view response with warnings', async () => {
      // Arrange
      const mockViewResponse = createMockViewResponse({
        status: true,
        warnings: [
          {
            item: 'chapter',
            itemid: 123,
            warningcode: 'hidden_chapter',
            message: 'Chapter is hidden',
          },
        ],
      });
      const mockResponse = createMockResponse(mockViewResponse);
      mockedApiClientPost.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await recordBookView(42, 123);

      // Assert
      expect(result.status).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0]!.warningcode).toBe('hidden_chapter');
    });
  });

  describe('error handling', () => {
    it('should throw error for 404 book not found', async () => {
      // Arrange
      const mockError = createMockError(404, 'NOT_FOUND', 'Book not found');
      mockedApiClientPost.mockRejectedValueOnce(mockError);

      // Act & Assert
      await expect(recordBookView(999)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('should throw error for permission denied', async () => {
      // Arrange
      const mockError = createMockError(403, 'PERMISSION_DENIED', 'Not enrolled in course');
      mockedApiClientPost.mockRejectedValueOnce(mockError);

      // Act & Assert
      await expect(recordBookView(1)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
        status: 403,
      });
    });

    it('should handle network errors', async () => {
      // Arrange
      // Network errors result in SERVER_ERROR due to isAxiosError detecting 'message' property
      const networkError = createNetworkError('Request failed');
      mockedApiClientPost.mockRejectedValueOnce(networkError);

      // Act & Assert
      await expect(recordBookView(1)).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        message: 'An internal server error occurred.',
        status: 500,
      });
    });
  });
});

// ============================================================================
// Test Suite: fetchBooksByCoursesIds
// ============================================================================

describe('fetchBooksByCoursesIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Create a mock books response
   */
  function createMockBooksResponse(overrides: Partial<BooksResponse> = {}): BooksResponse {
    return {
      books: [createMockBook({ id: 1 }), createMockBook({ id: 2 })],
      ...overrides,
    };
  }

  describe('success cases', () => {
    it('should fetch books for specified course IDs', async () => {
      // Arrange
      const mockBooksResponse = createMockBooksResponse();
      const mockResponse = createMockResponse(mockBooksResponse);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBooksByCoursesIds([1, 2, 3]);

      // Assert
      expect(result.books).toHaveLength(2);
      expect(mockedApiClientGet).toHaveBeenCalledWith('/book/courses', {
        params: { courseids: '1,2,3' },
      });
    });

    it('should fetch books from all enrolled courses when courseIds is empty', async () => {
      // Arrange
      const mockBooksResponse = createMockBooksResponse();
      const mockResponse = createMockResponse(mockBooksResponse);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBooksByCoursesIds([]);

      // Assert
      expect(result.books).toHaveLength(2);
      expect(mockedApiClientGet).toHaveBeenCalledWith('/book/courses', {
        params: { courseids: undefined },
      });
    });

    it('should handle response with warnings', async () => {
      // Arrange
      const mockBooksResponse = createMockBooksResponse({
        warnings: [
          {
            item: 'course',
            itemid: 999,
            warningcode: 'noaccess',
            message: 'You do not have access to this course',
          },
        ],
      });
      const mockResponse = createMockResponse(mockBooksResponse);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBooksByCoursesIds([1, 999]);

      // Assert
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0]!.warningcode).toBe('noaccess');
    });

    it('should handle empty books array', async () => {
      // Arrange
      const mockBooksResponse = createMockBooksResponse({ books: [] });
      const mockResponse = createMockResponse(mockBooksResponse);
      mockedApiClientGet.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchBooksByCoursesIds([1]);

      // Assert
      expect(result.books).toEqual([]);
      expect(result.books).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should throw error for permission denied', async () => {
      // Arrange
      const mockError = createMockError(403, 'PERMISSION_DENIED', 'Access denied');
      mockedApiClientGet.mockRejectedValueOnce(mockError);

      // Act & Assert
      await expect(fetchBooksByCoursesIds([1])).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
        status: 403,
      });
    });

    it('should handle network errors', async () => {
      // Arrange
      // Network errors result in SERVER_ERROR due to isAxiosError detecting 'message' property
      const networkError = createNetworkError('Server unreachable');
      mockedApiClientGet.mockRejectedValueOnce(networkError);

      // Act & Assert
      await expect(fetchBooksByCoursesIds([1])).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        message: 'An internal server error occurred.',
        status: 500,
      });
    });
  });
});

// ============================================================================
// Test Suite: Chapter Navigation Edge Cases
// ============================================================================

describe('Chapter Navigation Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('first chapter should have no prev navigation', async () => {
    // Arrange
    const mockChapters: Chapter[] = [
      createMockChapter({
        id: 1,
        pagenum: 1,
        title: 'First Chapter',
        prev: null,
        next: { prev: 1, next: 3, parent: null },
      }),
      createMockChapter({
        id: 2,
        pagenum: 2,
        prev: { prev: null, next: 2, parent: null },
        next: null,
      }),
    ];
    const mockResponse = createMockResponse(mockChapters);
    mockedApiClientGet.mockResolvedValueOnce(mockResponse);

    // Act
    const result = await fetchBookChapters(1);

    // Assert
    expect(result[0]!.prev).toBeNull();
  });

  it('last chapter should have no next navigation', async () => {
    // Arrange
    const mockChapters: Chapter[] = [
      createMockChapter({
        id: 1,
        pagenum: 1,
        prev: null,
        next: { prev: 1, next: null, parent: null },
      }),
      createMockChapter({
        id: 2,
        pagenum: 2,
        title: 'Last Chapter',
        prev: { prev: null, next: 2, parent: null },
        next: null,
      }),
    ];
    const mockResponse = createMockResponse(mockChapters);
    mockedApiClientGet.mockResolvedValueOnce(mockResponse);

    // Act
    const result = await fetchBookChapters(1);

    // Assert
    const lastChapter = result[result.length - 1]!;
    expect(lastChapter.next).toBeNull();
  });

  it('single chapter book should have no prev or next', async () => {
    // Arrange
    const mockChapters: Chapter[] = [
      createMockChapter({
        id: 1,
        pagenum: 1,
        title: 'Only Chapter',
        prev: null,
        next: null,
      }),
    ];
    const mockResponse = createMockResponse(mockChapters);
    mockedApiClientGet.mockResolvedValueOnce(mockResponse);

    // Act
    const result = await fetchBookChapters(1);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]!.prev).toBeNull();
    expect(result[0]!.next).toBeNull();
  });
});

// ============================================================================
// Test Suite: API Response Envelope Handling
// ============================================================================

describe('API Response Envelope Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should correctly extract data from success envelope', async () => {
    // Arrange
    const mockBook = createMockBook({ id: 42, name: 'Test Book' });
    const mockResponse = createMockResponse(mockBook);
    mockedApiClientGet.mockResolvedValueOnce(mockResponse);

    // Act
    const result = await fetchBook(42);

    // Assert
    expect(result).toEqual(mockBook);
    expect(result.id).toBe(42);
  });

  it('should handle response with metadata', async () => {
    // Arrange
    const mockChapters = [createMockChapter()];
    const mockResponse = createMockResponse(mockChapters, {
      pagination: { page: 1, perPage: 50, total: 1, totalPages: 1 },
      timestamp: 1705327200,
    });
    mockedApiClientGet.mockResolvedValueOnce(mockResponse);

    // Act
    const result = await fetchBookChapters(1);

    // Assert
    expect(result).toHaveLength(1);
  });

  it('should throw on malformed success response (success: false)', async () => {
    // Arrange
    const invalidResponse = {
      data: {
        success: false as const,
        error: { code: 'SOME_ERROR', message: 'Error occurred' },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    };
    mockedApiClientGet.mockResolvedValueOnce(invalidResponse);

    // Act & Assert
    await expect(fetchBook(1)).rejects.toBeDefined();
  });
});

// ============================================================================
// Test Suite: TypeScript Interface Validation
// ============================================================================

describe('TypeScript Interface Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Book interface should match expected structure', async () => {
    // Arrange
    const mockBook: Book = {
      id: 1,
      course: 42,
      name: 'TypeScript Book',
      intro: '<p>Intro</p>',
      introformat: 1,
      numbering: 1,
      navstyle: 1,
      customtitles: 0,
      revision: 1,
      timecreated: 1700000000,
      timemodified: 1705000000,
    };
    const mockResponse = createMockResponse(mockBook);
    mockedApiClientGet.mockResolvedValueOnce(mockResponse);

    // Act
    const result = await fetchBook(1);

    // Assert - Verify all required fields exist
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('course');
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('intro');
    expect(result).toHaveProperty('introformat');
    expect(result).toHaveProperty('numbering');
    expect(result).toHaveProperty('navstyle');
    expect(result).toHaveProperty('customtitles');
    expect(result).toHaveProperty('revision');
    expect(result).toHaveProperty('timecreated');
    expect(result).toHaveProperty('timemodified');
  });

  it('Chapter interface should match expected structure', async () => {
    // Arrange
    const mockChapter: Chapter = createMockChapter();
    const mockResponse = createMockResponse(mockChapter);
    mockedApiClientGet.mockResolvedValueOnce(mockResponse);

    // Act
    const result = await fetchChapter(1);

    // Assert - Verify all required fields exist
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('bookid');
    expect(result).toHaveProperty('pagenum');
    expect(result).toHaveProperty('subchapter');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('contentformat');
    expect(result).toHaveProperty('hidden');
    expect(result).toHaveProperty('timecreated');
    expect(result).toHaveProperty('timemodified');
    expect(result).toHaveProperty('importsrc');
    // Computed navigation properties
    expect(result).toHaveProperty('parent');
    expect(result).toHaveProperty('number');
    expect(result).toHaveProperty('prev');
    expect(result).toHaveProperty('next');
  });

  it('BookNavigation interface should match expected structure', async () => {
    // Arrange
    const mockNavigation: BookNavigation = {
      chapters: [createMockChapter()],
      currentChapterId: 1,
      totalChapters: 1,
      numberingStyle: 1,
    };
    const mockResponse = createMockResponse(mockNavigation);
    mockedApiClientGet.mockResolvedValueOnce(mockResponse);

    // Act
    const result = await fetchBookNavigation(1);

    // Assert - Verify all required fields exist
    expect(result).toHaveProperty('chapters');
    expect(result).toHaveProperty('currentChapterId');
    expect(result).toHaveProperty('totalChapters');
    expect(result).toHaveProperty('numberingStyle');
    expect(Array.isArray(result.chapters)).toBe(true);
  });
});

// ============================================================================
// Test Suite: URL and Parameter Verification
// ============================================================================

describe('URL and Parameter Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetchBook should call correct endpoint with book ID in URL', async () => {
    // Arrange
    const mockBook = createMockBook();
    mockedApiClientGet.mockResolvedValueOnce(createMockResponse(mockBook));

    // Act
    await fetchBook(123);

    // Assert
    expect(mockedApiClientGet).toHaveBeenCalledWith('/book/123');
  });

  it('fetchBookChapters should call correct endpoint', async () => {
    // Arrange
    mockedApiClientGet.mockResolvedValueOnce(createMockResponse([]));

    // Act
    await fetchBookChapters(456);

    // Assert
    expect(mockedApiClientGet).toHaveBeenCalledWith('/book/456/chapters');
  });

  it('fetchChapter should call correct endpoint with chapter ID', async () => {
    // Arrange
    mockedApiClientGet.mockResolvedValueOnce(createMockResponse(createMockChapter()));

    // Act
    await fetchChapter(789);

    // Assert
    expect(mockedApiClientGet).toHaveBeenCalledWith('/book/chapters/789');
  });

  it('fetchBookNavigation should call correct endpoint', async () => {
    // Arrange
    const mockNavigation: BookNavigation = {
      chapters: [],
      currentChapterId: null,
      totalChapters: 0,
      numberingStyle: 0,
    };
    mockedApiClientGet.mockResolvedValueOnce(createMockResponse(mockNavigation));

    // Act
    await fetchBookNavigation(321);

    // Assert
    expect(mockedApiClientGet).toHaveBeenCalledWith('/book/321/navigation');
  });

  it('recordBookView should call correct endpoint with POST', async () => {
    // Arrange
    mockedApiClientPost.mockResolvedValueOnce(createMockResponse({ status: true }));

    // Act
    await recordBookView(654, 987);

    // Assert
    expect(mockedApiClientPost).toHaveBeenCalledWith('/book/654/view', { chapterid: 987 });
  });

  it('fetchBooksByCoursesIds should pass courseids as comma-separated string', async () => {
    // Arrange
    mockedApiClientGet.mockResolvedValueOnce(createMockResponse({ books: [] }));

    // Act
    await fetchBooksByCoursesIds([10, 20, 30]);

    // Assert
    expect(mockedApiClientGet).toHaveBeenCalledWith('/book/courses', {
      params: { courseids: '10,20,30' },
    });
  });
});
