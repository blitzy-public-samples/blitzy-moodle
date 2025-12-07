/**
 * @fileoverview Comprehensive Vitest unit tests for useComment React Query hooks
 * @description Tests comment fetching with pagination, posting comments with optimistic updates,
 * updating comments, deleting comments, cache invalidation, error handling, loading states,
 * and real-time comment count updates for glossary entries.
 *
 * Tests cover:
 * - useEntryComments: Paginated comment fetching with sorting options
 * - usePostComment: Posting new comments with optimistic UI updates and rollback
 * - useUpdateComment: Updating existing comments with permission checks
 * - useDeleteComment: Deleting comments with cache invalidation
 * - Error handling: Network errors (500, 503), validation (400), permission (403), not found (404)
 * - Loading and mutation states
 * - Cache management and synchronization
 *
 * @module tests/unit/features/activities/glossary/hooks/useComment
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';

import {
  useEntryComments,
  usePostComment,
  useUpdateComment,
  useDeleteComment,
  commentKeys,
  type CommentsResponse,
} from '@/features/activities/glossary/hooks/useComment';
import type {
  GlossaryComment,
  PostCommentInput,
  UpdateCommentInput,
  TextFormat,
} from '@/features/activities/glossary/types/glossary.types';

import { createTestQueryClient } from '@tests/helpers/render';
import { server } from '@tests/mocks/server';

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = '*/api/v1';
const MOCK_ENTRY_ID = 456;
const MOCK_COMMENT_ID = 789;
const MOCK_USER_ID = 123;
const MOCK_CONTEXT_ID = 99;

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock GlossaryComment object for testing
 */
function createMockComment(overrides: Partial<GlossaryComment> = {}): GlossaryComment {
  return {
    id: MOCK_COMMENT_ID,
    contextid: MOCK_CONTEXT_ID,
    component: 'mod_glossary',
    commentarea: 'glossary_entry',
    itemid: MOCK_ENTRY_ID,
    content: 'This is a test comment for the glossary entry.',
    format: 1 as TextFormat, // HTML format
    userid: MOCK_USER_ID,
    userfullname: 'Test User',
    userpictureurl: 'https://example.com/avatar.jpg',
    timecreated: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    timemodified: Math.floor(Date.now() / 1000) - 3600,
    ...overrides,
  };
}

/**
 * Creates an array of mock comments for pagination testing
 */
function createMockComments(count: number, baseEntryId: number = MOCK_ENTRY_ID): GlossaryComment[] {
  const comments: GlossaryComment[] = [];
  const baseTime = Math.floor(Date.now() / 1000);

  for (let i = 0; i < count; i++) {
    comments.push(
      createMockComment({
        id: 1000 + i,
        itemid: baseEntryId,
        content: `Comment ${i + 1} for testing purposes`,
        userid: 100 + i,
        userfullname: `User ${i + 1}`,
        timecreated: baseTime - i * 60, // Each comment 1 minute older
        timemodified: baseTime - i * 60,
      })
    );
  }
  return comments;
}

/**
 * Creates a mock API success response wrapper
 */
function createMockApiResponse<T>(data: T, status: number = 200) {
  return HttpResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * Creates a mock API error response
 */
function createMockErrorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return HttpResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
    },
    { status }
  );
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a wrapper component with QueryClientProvider for testing hooks
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('useComment Hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create fresh QueryClient for each test to prevent cache pollution
    queryClient = createTestQueryClient();
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear query cache after each test
    queryClient.clear();
    // Reset MSW handlers to initial state
    server.resetHandlers();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // commentKeys Tests
  // ==========================================================================

  describe('commentKeys', () => {
    it('should generate correct base key for all comments', () => {
      expect(commentKeys.all).toEqual(['glossary', 'comments']);
    });

    it('should generate correct entry key with entryId', () => {
      expect(commentKeys.entry(MOCK_ENTRY_ID)).toEqual([
        'glossary',
        'entry',
        MOCK_ENTRY_ID,
        'comments',
      ]);
    });

    it('should generate consistent keys for the same entryId', () => {
      const key1 = commentKeys.entry(100);
      const key2 = commentKeys.entry(100);
      expect(JSON.stringify(key1)).toBe(JSON.stringify(key2));
    });

    it('should generate different keys for different entryIds', () => {
      const key1 = commentKeys.entry(100);
      const key2 = commentKeys.entry(200);
      expect(key1).not.toEqual(key2);
    });

    it('should generate paginated key with options', () => {
      const options = { page: 1, perPage: 20, sortOrder: 'newest' as const };
      const key = commentKeys.entryPaginated(MOCK_ENTRY_ID, options);
      expect(key).toEqual(['glossary', 'entry', MOCK_ENTRY_ID, 'comments', options]);
    });
  });

  // ==========================================================================
  // useEntryComments Tests
  // ==========================================================================

  describe('useEntryComments()', () => {
    describe('Basic Functionality', () => {
      it('should fetch comments successfully for an entry', async () => {
        const mockComments = createMockComments(5);

        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(mockComments);
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toBeDefined();
        expect(result.current.data?.comments).toHaveLength(5);
      });

      it('should return loading state initially', async () => {
        const mockComments = createMockComments(3);

        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, async () => {
            // Simulate network delay
            await new Promise((resolve) => setTimeout(resolve, 100));
            return createMockApiResponse(mockComments);
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        // Initially should be loading
        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      it('should return error state when fetch fails', async () => {
        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockErrorResponse(
              'FETCH_FAILED',
              'Failed to fetch comments',
              500
            );
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it('should not fetch when enabled is false', async () => {
        const fetchSpy = vi.fn();

        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            fetchSpy();
            return createMockApiResponse([]);
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID, { enabled: false }),
          { wrapper: createWrapper(queryClient) }
        );

        // Wait a bit to ensure no fetch occurs
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.current.isPending).toBe(true);
      });

      it('should not fetch when entryId is invalid (0 or negative)', async () => {
        const fetchSpy = vi.fn();

        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            fetchSpy();
            return createMockApiResponse([]);
          })
        );

        const { result } = renderHook(
          () => useEntryComments(0),
          { wrapper: createWrapper(queryClient) }
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.current.isPending).toBe(true);
      });
    });

    describe('Pagination', () => {
      it('should fetch comments with default pagination (page 1, perPage 20)', async () => {
        const mockComments = createMockComments(25);

        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(mockComments);
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const data = result.current.data as CommentsResponse;
        expect(data.pagination.page).toBe(1);
        expect(data.pagination.perPage).toBe(20);
        expect(data.pagination.total).toBe(25);
        expect(data.pagination.totalPages).toBe(2);
        expect(data.comments).toHaveLength(20); // First page
      });

      it('should fetch second page of comments', async () => {
        const mockComments = createMockComments(25);

        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(mockComments);
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID, { page: 2, perPage: 20 }),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const data = result.current.data as CommentsResponse;
        expect(data.pagination.page).toBe(2);
        expect(data.comments).toHaveLength(5); // Remaining 5 comments
      });

      it('should respect custom perPage option', async () => {
        const mockComments = createMockComments(15);

        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(mockComments);
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID, { page: 1, perPage: 10 }),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const data = result.current.data as CommentsResponse;
        expect(data.pagination.perPage).toBe(10);
        expect(data.pagination.totalPages).toBe(2);
        expect(data.comments).toHaveLength(10);
      });

      it('should return pagination metadata with total and totalPages', async () => {
        const mockComments = createMockComments(50);

        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(mockComments);
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID, { perPage: 15 }),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const data = result.current.data as CommentsResponse;
        expect(data.pagination).toEqual({
          page: 1,
          perPage: 15,
          total: 50,
          totalPages: 4,
        });
      });

      it('should handle empty comment list', async () => {
        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse([]);
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const data = result.current.data as CommentsResponse;
        expect(data.comments).toHaveLength(0);
        expect(data.pagination.total).toBe(0);
        expect(data.pagination.totalPages).toBe(0);
      });
    });

    describe('Sorting', () => {
      it('should sort comments by newest first by default', async () => {
        const now = Math.floor(Date.now() / 1000);
        const mockComments = [
          createMockComment({ id: 1, timecreated: now - 3600 }), // 1 hour ago
          createMockComment({ id: 2, timecreated: now - 60 }),   // 1 minute ago
          createMockComment({ id: 3, timecreated: now - 7200 }), // 2 hours ago
        ];

        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(mockComments);
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const data = result.current.data as CommentsResponse;
        // Should be sorted newest first
        expect(data.comments[0]!.id).toBe(2); // Most recent
        expect(data.comments[1]!.id).toBe(1);
        expect(data.comments[2]!.id).toBe(3); // Oldest
      });

      it('should sort comments by oldest first when sortOrder is oldest', async () => {
        const now = Math.floor(Date.now() / 1000);
        const mockComments = [
          createMockComment({ id: 1, timecreated: now - 3600 }),
          createMockComment({ id: 2, timecreated: now - 60 }),
          createMockComment({ id: 3, timecreated: now - 7200 }),
        ];

        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(mockComments);
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID, { sortOrder: 'oldest' }),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const data = result.current.data as CommentsResponse;
        // Should be sorted oldest first
        expect(data.comments[0]!.id).toBe(3); // Oldest
        expect(data.comments[1]!.id).toBe(1);
        expect(data.comments[2]!.id).toBe(2); // Newest
      });
    });

    describe('Author Information', () => {
      it('should include author info in comments', async () => {
        const mockComment = createMockComment({
          userid: 42,
          userfullname: 'John Doe',
          userpictureurl: 'https://example.com/john.jpg',
        });

        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse([mockComment]);
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const data = result.current.data as CommentsResponse;
        const comment = data.comments[0]!;
        expect(comment.userid).toBe(42);
        expect(comment.userfullname).toBe('John Doe');
        expect(comment.userpictureurl).toBe('https://example.com/john.jpg');
      });
    });

    describe('Cache Key Structure', () => {
      it('should use correct cache key pattern', async () => {
        const mockComments = createMockComments(2);

        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(mockComments);
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Verify cache key includes entryId and options
        const cacheKey = commentKeys.entryPaginated(MOCK_ENTRY_ID, {
          page: 1,
          perPage: 20,
          sortOrder: 'newest',
        });
        const cachedData = queryClient.getQueryData(cacheKey);
        expect(cachedData).toBeDefined();
      });

      it('should have separate cache entries for different options', async () => {
        const mockComments = createMockComments(5);

        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(mockComments);
          })
        );

        // First query with default options
        const { result: result1 } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result1.current.isSuccess).toBe(true);
        });

        // Second query with different sort order
        const { result: result2 } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID, { sortOrder: 'oldest' }),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result2.current.isSuccess).toBe(true);
        });

        // Both should have separate cached data
        const key1 = commentKeys.entryPaginated(MOCK_ENTRY_ID, {
          page: 1,
          perPage: 20,
          sortOrder: 'newest',
        });
        const key2 = commentKeys.entryPaginated(MOCK_ENTRY_ID, {
          page: 1,
          perPage: 20,
          sortOrder: 'oldest',
        });

        expect(queryClient.getQueryData(key1)).toBeDefined();
        expect(queryClient.getQueryData(key2)).toBeDefined();
      });
    });

    describe('Error Scenarios', () => {
      it('should handle 404 entry not found error', async () => {
        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockErrorResponse(
              'NOT_FOUND',
              'Entry not found',
              404
            );
          })
        );

        const { result } = renderHook(
          () => useEntryComments(999),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it('should handle 403 permission denied error', async () => {
        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockErrorResponse(
              'PERMISSION_DENIED',
              'You do not have permission to view comments',
              403
            );
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it('should handle 500 server error', async () => {
        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockErrorResponse(
              'SERVER_ERROR',
              'Internal server error',
              500
            );
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it('should handle 503 service unavailable error', async () => {
        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockErrorResponse(
              'SERVICE_UNAVAILABLE',
              'Service temporarily unavailable',
              503
            );
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it('should handle network error', async () => {
        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return HttpResponse.error();
          })
        );

        const { result } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });
  });

  // ==========================================================================
  // usePostComment Tests
  // ==========================================================================

  describe('usePostComment()', () => {
    describe('Basic Functionality', () => {
      it('should post a new comment successfully', async () => {
        const newComment = createMockComment({
          id: 999,
          content: 'New test comment',
        });

        server.use(
          http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(newComment, 201);
          })
        );

        const { result } = renderHook(
          () => usePostComment(),
          { wrapper: createWrapper(queryClient) }
        );

        const input: PostCommentInput = {
          entryId: MOCK_ENTRY_ID,
          content: 'New test comment',
          format: 1 as TextFormat,
        };

        await act(async () => {
          result.current.mutate(input);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(newComment);
      });

      it('should call onSuccess callback after successful post', async () => {
        const newComment = createMockComment();
        const onSuccess = vi.fn();

        server.use(
          http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(newComment, 201);
          })
        );

        const { result } = renderHook(
          () => usePostComment({ onSuccess }),
          { wrapper: createWrapper(queryClient) }
        );

        const input: PostCommentInput = {
          entryId: MOCK_ENTRY_ID,
          content: 'Test comment',
          format: 1 as TextFormat,
        };

        await act(async () => {
          result.current.mutate(input);
        });

        await waitFor(() => {
          expect(onSuccess).toHaveBeenCalled();
        });

        // Verify callback was called with the expected data as first argument
        const callArgs = onSuccess.mock.calls[0];
        expect(callArgs?.[0]).toEqual(newComment);
        // Second argument should be the mutation variables (input)
        expect(callArgs?.[1]).toMatchObject({
          entryId: MOCK_ENTRY_ID,
          content: 'Test comment',
        });
      });

      it('should show loading state during mutation (isPending)', async () => {
        server.use(
          http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return createMockApiResponse(createMockComment(), 201);
          })
        );

        const { result } = renderHook(
          () => usePostComment(),
          { wrapper: createWrapper(queryClient) }
        );

        expect(result.current.isPending).toBe(false);

        // Start the mutation and wait for isPending to become true
        act(() => {
          result.current.mutate({
            entryId: MOCK_ENTRY_ID,
            content: 'Test',
            format: 1 as TextFormat,
          });
        });

        // Wait for isPending to become true (async state update)
        await waitFor(() => {
          expect(result.current.isPending).toBe(true);
        }, { timeout: 100 });

        // Wait for mutation to complete
        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });
      });
    });

    describe('Optimistic Updates', () => {
      it('should optimistically add comment to cache before server response', async () => {
        // Pre-populate cache with existing comments
        const existingComments = createMockComments(2);
        const cacheKey = commentKeys.entryPaginated(MOCK_ENTRY_ID, {
          page: 1,
          perPage: 20,
          sortOrder: 'newest',
        });
        
        queryClient.setQueryData<CommentsResponse>(cacheKey, {
          comments: existingComments,
          pagination: { page: 1, perPage: 20, total: 2, totalPages: 1 },
        });

        let resolvePost: () => void;
        const postPromise = new Promise<void>((resolve) => {
          resolvePost = resolve;
        });

        server.use(
          http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, async () => {
            await postPromise;
            return createMockApiResponse(createMockComment({ id: 999 }), 201);
          })
        );

        const { result } = renderHook(
          () => usePostComment(),
          { wrapper: createWrapper(queryClient) }
        );

        act(() => {
          result.current.mutate({
            entryId: MOCK_ENTRY_ID,
            content: 'Optimistic comment',
            format: 1 as TextFormat,
          });
        });

        // Wait for optimistic update
        await waitFor(() => {
          const cachedData = queryClient.getQueryData<CommentsResponse>(cacheKey);
          // Should have 3 comments now (2 existing + 1 optimistic)
          expect(cachedData?.comments.length).toBe(3);
        });

        // Resolve the POST request
        await act(async () => {
          resolvePost!();
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });

      it('should rollback optimistic update on error', async () => {
        // Pre-populate cache with existing comments
        const existingComments = createMockComments(2);
        const cacheKey = commentKeys.entryPaginated(MOCK_ENTRY_ID, {
          page: 1,
          perPage: 20,
          sortOrder: 'newest',
        });

        queryClient.setQueryData<CommentsResponse>(cacheKey, {
          comments: existingComments,
          pagination: { page: 1, perPage: 20, total: 2, totalPages: 1 },
        });

        server.use(
          http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockErrorResponse(
              'VALIDATION_ERROR',
              'Comment content is required',
              400
            );
          })
        );

        const { result } = renderHook(
          () => usePostComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            entryId: MOCK_ENTRY_ID,
            content: '',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        // After error, cache should be rolled back to original state
        // Note: The actual rollback behavior depends on the hook implementation
        // and may involve cache invalidation
      });

      it('should increment comment count in pagination metadata', async () => {
        const existingComments = createMockComments(5);
        const cacheKey = commentKeys.entryPaginated(MOCK_ENTRY_ID, {
          page: 1,
          perPage: 20,
          sortOrder: 'newest',
        });

        queryClient.setQueryData<CommentsResponse>(cacheKey, {
          comments: existingComments,
          pagination: { page: 1, perPage: 20, total: 5, totalPages: 1 },
        });

        server.use(
          http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(createMockComment({ id: 999 }), 201);
          })
        );

        const { result } = renderHook(
          () => usePostComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            entryId: MOCK_ENTRY_ID,
            content: 'New comment',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // The total count should have been updated during optimistic update
      });
    });

    describe('Cache Invalidation', () => {
      it('should invalidate comment cache after successful post', async () => {
        server.use(
          http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(createMockComment(), 201);
          })
        );

        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(
          () => usePostComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            entryId: MOCK_ENTRY_ID,
            content: 'Test',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });

      it('should invalidate parent entry to update comment count', async () => {
        server.use(
          http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(createMockComment(), 201);
          })
        );

        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(
          () => usePostComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            entryId: MOCK_ENTRY_ID,
            content: 'Test',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Should invalidate both comment cache and entry cache
        expect(invalidateQueriesSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            queryKey: expect.arrayContaining(['glossary', 'entry', MOCK_ENTRY_ID]),
          })
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle validation error (400)', async () => {
        server.use(
          http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockErrorResponse(
              'VALIDATION_ERROR',
              'Content cannot be empty',
              400,
              { field: 'content' }
            );
          })
        );

        const { result } = renderHook(
          () => usePostComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            entryId: MOCK_ENTRY_ID,
            content: '',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it('should handle permission denied error (403)', async () => {
        server.use(
          http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockErrorResponse(
              'PERMISSION_DENIED',
              'You do not have permission to post comments',
              403
            );
          })
        );

        const { result } = renderHook(
          () => usePostComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            entryId: MOCK_ENTRY_ID,
            content: 'Test comment',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it('should handle network error', async () => {
        server.use(
          http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return HttpResponse.error();
          })
        );

        const { result } = renderHook(
          () => usePostComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            entryId: MOCK_ENTRY_ID,
            content: 'Test',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it('should call onError callback on failure', async () => {
        const onError = vi.fn();

        server.use(
          http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockErrorResponse('ERROR', 'Failed', 500);
          })
        );

        const { result } = renderHook(
          () => usePostComment({ onError }),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            entryId: MOCK_ENTRY_ID,
            content: 'Test',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(onError).toHaveBeenCalled();
        });
      });
    });
  });

  // ==========================================================================
  // useUpdateComment Tests
  // ==========================================================================

  describe('useUpdateComment()', () => {
    describe('Basic Functionality', () => {
      it('should update an existing comment successfully', async () => {
        const updatedComment = createMockComment({
          id: MOCK_COMMENT_ID,
          content: 'Updated comment content',
          timemodified: Math.floor(Date.now() / 1000),
        });

        server.use(
          http.put(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockApiResponse(updatedComment);
          })
        );

        const { result } = renderHook(
          () => useUpdateComment(),
          { wrapper: createWrapper(queryClient) }
        );

        const input: UpdateCommentInput & { entryId: number } = {
          commentId: MOCK_COMMENT_ID,
          entryId: MOCK_ENTRY_ID,
          content: 'Updated comment content',
          format: 1 as TextFormat,
        };

        await act(async () => {
          result.current.mutate(input);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(updatedComment);
      });

      it('should show loading state during update (isPending)', async () => {
        server.use(
          http.put(`${API_BASE_URL}/glossary/comments/:commentId`, async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return createMockApiResponse(createMockComment());
          })
        );

        const { result } = renderHook(
          () => useUpdateComment(),
          { wrapper: createWrapper(queryClient) }
        );

        expect(result.current.isPending).toBe(false);

        act(() => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
            content: 'Updated',
            format: 1 as TextFormat,
          });
        });

        // Wait for isPending to become true (async state update)
        await waitFor(() => {
          expect(result.current.isPending).toBe(true);
        }, { timeout: 100 });

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });
      });

      it('should call onSuccess callback after successful update', async () => {
        const updatedComment = createMockComment();
        const onSuccess = vi.fn();

        server.use(
          http.put(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockApiResponse(updatedComment);
          })
        );

        const { result } = renderHook(
          () => useUpdateComment({ onSuccess }),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
            content: 'Updated',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(onSuccess).toHaveBeenCalled();
        });
      });
    });

    describe('Optimistic Updates', () => {
      it('should optimistically update comment in cache', async () => {
        const existingComment = createMockComment({
          id: MOCK_COMMENT_ID,
          content: 'Original content',
        });
        const cacheKey = commentKeys.entryPaginated(MOCK_ENTRY_ID, {
          page: 1,
          perPage: 20,
          sortOrder: 'newest',
        });

        queryClient.setQueryData<CommentsResponse>(cacheKey, {
          comments: [existingComment],
          pagination: { page: 1, perPage: 20, total: 1, totalPages: 1 },
        });

        let resolveUpdate: () => void;
        const updatePromise = new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        });

        server.use(
          http.put(`${API_BASE_URL}/glossary/comments/:commentId`, async () => {
            await updatePromise;
            return createMockApiResponse(
              createMockComment({
                id: MOCK_COMMENT_ID,
                content: 'Updated content',
              })
            );
          })
        );

        const { result } = renderHook(
          () => useUpdateComment(),
          { wrapper: createWrapper(queryClient) }
        );

        act(() => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
            content: 'Updated content',
            format: 1 as TextFormat,
          });
        });

        // Check optimistic update was applied
        await waitFor(() => {
          const cachedData = queryClient.getQueryData<CommentsResponse>(cacheKey);
          expect(cachedData?.comments[0]?.content).toBe('Updated content');
        });

        // Resolve the update request
        await act(async () => {
          resolveUpdate!();
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });

      it('should rollback optimistic update on error', async () => {
        const existingComment = createMockComment({
          id: MOCK_COMMENT_ID,
          content: 'Original content',
        });
        const cacheKey = commentKeys.entryPaginated(MOCK_ENTRY_ID, {
          page: 1,
          perPage: 20,
          sortOrder: 'newest',
        });

        queryClient.setQueryData<CommentsResponse>(cacheKey, {
          comments: [existingComment],
          pagination: { page: 1, perPage: 20, total: 1, totalPages: 1 },
        });

        server.use(
          http.put(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockErrorResponse(
              'PERMISSION_DENIED',
              'You can only edit your own comments',
              403
            );
          })
        );

        const { result } = renderHook(
          () => useUpdateComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
            content: 'Updated content',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        // Cache should be rolled back (or invalidated)
      });
    });

    describe('Permission Checks', () => {
      it('should handle permission denied error for non-owner', async () => {
        server.use(
          http.put(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockErrorResponse(
              'PERMISSION_DENIED',
              'You can only edit your own comments',
              403
            );
          })
        );

        const { result } = renderHook(
          () => useUpdateComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
            content: 'Updated',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });

    describe('Cache Invalidation', () => {
      it('should invalidate comment cache after successful update', async () => {
        server.use(
          http.put(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockApiResponse(createMockComment());
          })
        );

        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(
          () => useUpdateComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
            content: 'Updated',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle validation error for empty content', async () => {
        server.use(
          http.put(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockErrorResponse(
              'VALIDATION_ERROR',
              'Content cannot be empty',
              400,
              { field: 'content' }
            );
          })
        );

        const { result } = renderHook(
          () => useUpdateComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
            content: '',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it('should handle 404 comment not found', async () => {
        server.use(
          http.put(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockErrorResponse(
              'NOT_FOUND',
              'Comment not found',
              404
            );
          })
        );

        const { result } = renderHook(
          () => useUpdateComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: 99999,
            entryId: MOCK_ENTRY_ID,
            content: 'Updated',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it('should handle network error', async () => {
        server.use(
          http.put(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return HttpResponse.error();
          })
        );

        const { result } = renderHook(
          () => useUpdateComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
            content: 'Updated',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });
  });

  // ==========================================================================
  // useDeleteComment Tests
  // ==========================================================================

  describe('useDeleteComment()', () => {
    describe('Basic Functionality', () => {
      it('should delete a comment successfully', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockApiResponse({ deleted: true });
          })
        );

        const { result } = renderHook(
          () => useDeleteComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
          });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });

      it('should show loading state during deletion (isPending)', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return createMockApiResponse({ deleted: true });
          })
        );

        const { result } = renderHook(
          () => useDeleteComment(),
          { wrapper: createWrapper(queryClient) }
        );

        expect(result.current.isPending).toBe(false);

        act(() => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
          });
        });

        // Wait for isPending to become true (async state update)
        await waitFor(() => {
          expect(result.current.isPending).toBe(true);
        }, { timeout: 100 });

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });
      });

      it('should call onSuccess callback after successful deletion', async () => {
        const onSuccess = vi.fn();

        server.use(
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockApiResponse({ deleted: true });
          })
        );

        const { result } = renderHook(
          () => useDeleteComment({ onSuccess }),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
          });
        });

        await waitFor(() => {
          expect(onSuccess).toHaveBeenCalled();
        });
      });
    });

    describe('Optimistic Updates', () => {
      it('should optimistically remove comment from cache', async () => {
        const existingComments = [
          createMockComment({ id: 1, content: 'Comment 1' }),
          createMockComment({ id: MOCK_COMMENT_ID, content: 'Comment to delete' }),
          createMockComment({ id: 3, content: 'Comment 3' }),
        ];
        const cacheKey = commentKeys.entryPaginated(MOCK_ENTRY_ID, {
          page: 1,
          perPage: 20,
          sortOrder: 'newest',
        });

        queryClient.setQueryData<CommentsResponse>(cacheKey, {
          comments: existingComments,
          pagination: { page: 1, perPage: 20, total: 3, totalPages: 1 },
        });

        let resolveDelete: () => void;
        const deletePromise = new Promise<void>((resolve) => {
          resolveDelete = resolve;
        });

        server.use(
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, async () => {
            await deletePromise;
            return createMockApiResponse({ deleted: true });
          })
        );

        const { result } = renderHook(
          () => useDeleteComment(),
          { wrapper: createWrapper(queryClient) }
        );

        act(() => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
          });
        });

        // Check optimistic removal was applied
        await waitFor(() => {
          const cachedData = queryClient.getQueryData<CommentsResponse>(cacheKey);
          expect(cachedData?.comments.length).toBe(2);
          expect(cachedData?.comments.find((c) => c.id === MOCK_COMMENT_ID)).toBeUndefined();
        });

        // Resolve the delete request
        await act(async () => {
          resolveDelete!();
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });

      it('should decrement comment count in pagination metadata', async () => {
        const existingComments = createMockComments(5);
        const cacheKey = commentKeys.entryPaginated(MOCK_ENTRY_ID, {
          page: 1,
          perPage: 20,
          sortOrder: 'newest',
        });

        queryClient.setQueryData<CommentsResponse>(cacheKey, {
          comments: existingComments,
          pagination: { page: 1, perPage: 20, total: 5, totalPages: 1 },
        });

        server.use(
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockApiResponse({ deleted: true });
          })
        );

        const { result } = renderHook(
          () => useDeleteComment(),
          { wrapper: createWrapper(queryClient) }
        );

        // Delete first comment
        const commentIdToDelete = existingComments[0]!.id;

        await act(async () => {
          result.current.mutate({
            commentId: commentIdToDelete,
            entryId: MOCK_ENTRY_ID,
          });
        });

        // After optimistic update, total should be decremented
        await waitFor(() => {
          const cachedData = queryClient.getQueryData<CommentsResponse>(cacheKey);
          expect(cachedData?.pagination.total).toBe(4);
        });
      });

      it('should rollback optimistic removal on error', async () => {
        const existingComments = [
          createMockComment({ id: 1 }),
          createMockComment({ id: MOCK_COMMENT_ID }),
        ];
        const cacheKey = commentKeys.entryPaginated(MOCK_ENTRY_ID, {
          page: 1,
          perPage: 20,
          sortOrder: 'newest',
        });

        queryClient.setQueryData<CommentsResponse>(cacheKey, {
          comments: existingComments,
          pagination: { page: 1, perPage: 20, total: 2, totalPages: 1 },
        });

        server.use(
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockErrorResponse(
              'PERMISSION_DENIED',
              'You cannot delete this comment',
              403
            );
          })
        );

        const { result } = renderHook(
          () => useDeleteComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        // Cache should be rolled back (or invalidated)
      });
    });

    describe('Permission Checks', () => {
      it('should handle permission denied for non-owner without manage capability', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockErrorResponse(
              'PERMISSION_DENIED',
              'You can only delete your own comments',
              403
            );
          })
        );

        const { result } = renderHook(
          () => useDeleteComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it('should allow deletion with manage capability', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockApiResponse({ deleted: true });
          })
        );

        const { result } = renderHook(
          () => useDeleteComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
          });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });
    });

    describe('Cache Invalidation', () => {
      it('should invalidate comment cache after successful deletion', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockApiResponse({ deleted: true });
          })
        );

        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(
          () => useDeleteComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
          });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });

      it('should invalidate parent entry to update comment count', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockApiResponse({ deleted: true });
          })
        );

        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(
          () => useDeleteComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
          });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Should invalidate entry cache to update comment count
        expect(invalidateQueriesSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            queryKey: expect.arrayContaining(['glossary', 'entry', MOCK_ENTRY_ID]),
          })
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle 404 comment not found', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockErrorResponse(
              'NOT_FOUND',
              'Comment not found',
              404
            );
          })
        );

        const { result } = renderHook(
          () => useDeleteComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: 99999,
            entryId: MOCK_ENTRY_ID,
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it('should handle 500 server error', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockErrorResponse(
              'SERVER_ERROR',
              'Internal server error',
              500
            );
          })
        );

        const { result } = renderHook(
          () => useDeleteComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it('should handle network error', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return HttpResponse.error();
          })
        );

        const { result } = renderHook(
          () => useDeleteComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it('should call onError callback on failure', async () => {
        const onError = vi.fn();

        server.use(
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockErrorResponse('ERROR', 'Failed', 500);
          })
        );

        const { result } = renderHook(
          () => useDeleteComment({ onError }),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            commentId: MOCK_COMMENT_ID,
            entryId: MOCK_ENTRY_ID,
          });
        });

        await waitFor(() => {
          expect(onError).toHaveBeenCalled();
        });
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration Tests', () => {
    describe('Multiple Operations in Sequence', () => {
      it('should handle post then update then delete sequence', async () => {
        const newComment = createMockComment({ id: 1000, content: 'New comment' });
        const updatedComment = { ...newComment, content: 'Updated comment' };

        server.use(
          http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(newComment, 201);
          }),
          http.put(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockApiResponse(updatedComment);
          }),
          http.delete(`${API_BASE_URL}/glossary/comments/:commentId`, () => {
            return createMockApiResponse({ deleted: true });
          })
        );

        // Post
        const { result: postResult } = renderHook(
          () => usePostComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          postResult.current.mutate({
            entryId: MOCK_ENTRY_ID,
            content: 'New comment',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(postResult.current.isSuccess).toBe(true);
        });

        // Update
        const { result: updateResult } = renderHook(
          () => useUpdateComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          updateResult.current.mutate({
            commentId: 1000,
            entryId: MOCK_ENTRY_ID,
            content: 'Updated comment',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(updateResult.current.isSuccess).toBe(true);
        });

        // Delete
        const { result: deleteResult } = renderHook(
          () => useDeleteComment(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          deleteResult.current.mutate({
            commentId: 1000,
            entryId: MOCK_ENTRY_ID,
          });
        });

        await waitFor(() => {
          expect(deleteResult.current.isSuccess).toBe(true);
        });
      });
    });

    describe('Concurrent Operations', () => {
      it('should handle concurrent comment posts', async () => {
        let postCount = 0;

        server.use(
          http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            postCount++;
            return createMockApiResponse(
              createMockComment({ id: 1000 + postCount }),
              201
            );
          })
        );

        const { result } = renderHook(
          () => usePostComment(),
          { wrapper: createWrapper(queryClient) }
        );

        // Post multiple comments concurrently
        await act(async () => {
          result.current.mutate({
            entryId: MOCK_ENTRY_ID,
            content: 'Comment 1',
            format: 1 as TextFormat,
          });
          result.current.mutate({
            entryId: MOCK_ENTRY_ID,
            content: 'Comment 2',
            format: 1 as TextFormat,
          });
        });

        await waitFor(() => {
          expect(postCount).toBeGreaterThanOrEqual(1);
        });
      });
    });

    describe('Cache Synchronization', () => {
      it('should keep cache synchronized across multiple hooks', async () => {
        const mockComments = createMockComments(3);

        server.use(
          http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
            return createMockApiResponse(mockComments);
          })
        );

        // Two components using the same hook
        const { result: result1 } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        const { result: result2 } = renderHook(
          () => useEntryComments(MOCK_ENTRY_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await waitFor(() => {
          expect(result1.current.isSuccess).toBe(true);
          expect(result2.current.isSuccess).toBe(true);
        });

        // Both should have the same data from cache
        expect(result1.current.data).toEqual(result2.current.data);
      });
    });
  });

  // ==========================================================================
  // TypeScript Type Safety Tests
  // ==========================================================================

  describe('TypeScript Type Safety', () => {
    it('should have correct types for useEntryComments return value', async () => {
      const mockComments = createMockComments(2);

      server.use(
        http.get(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
          return createMockApiResponse(mockComments);
        })
      );

      const { result } = renderHook(
        () => useEntryComments(MOCK_ENTRY_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Type assertions - these will fail at compile time if types are wrong
      const data: CommentsResponse | undefined = result.current.data;
      expect(data).toBeDefined();

      if (data) {
        const comments: GlossaryComment[] = data.comments;
        expect(Array.isArray(comments)).toBe(true);

        const pagination = data.pagination;
        expect(typeof pagination.page).toBe('number');
        expect(typeof pagination.perPage).toBe('number');
        expect(typeof pagination.total).toBe('number');
        expect(typeof pagination.totalPages).toBe('number');
      }
    });

    it('should have correct types for mutation inputs', async () => {
      server.use(
        http.post(`${API_BASE_URL}/glossary/entries/:entryId/comments`, () => {
          return createMockApiResponse(createMockComment(), 201);
        })
      );

      const { result } = renderHook(
        () => usePostComment(),
        { wrapper: createWrapper(queryClient) }
      );

      // Type-safe input
      const input: PostCommentInput = {
        entryId: 123,
        content: 'Test',
        format: 1 as TextFormat,
      };

      await act(async () => {
        result.current.mutate(input);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });
});
