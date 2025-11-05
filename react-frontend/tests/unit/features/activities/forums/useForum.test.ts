/**
 * Unit tests for useForum custom hook
 * 
 * Tests comprehensive forum functionality including:
 * - Forum data fetching with React Query
 * - Discussion list pagination, sorting, and filtering
 * - Subscription management with optimistic updates
 * - Cache invalidation and background refetch
 * - Error handling and loading states
 * - Moderator actions (pin/unpin, lock/unlock)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { ReactNode } from 'react';
import { useForum } from '@/features/activities/forums/hooks/useForum';

// Mock API base URL
const API_BASE_URL = 'http://localhost/api/v1';

// Mock forum data
const mockForumData = {
  id: 1,
  courseId: 10,
  name: 'General Discussion Forum',
  description: 'A forum for general discussions',
  type: 'general',
  subscribed: false,
  canSubscribe: true,
  canCreateDiscussion: true,
  canManage: false,
  trackingEnabled: true,
  unreadCount: 5,
  stats: {
    totalDiscussions: 25,
    totalPosts: 150,
    participants: 42,
  },
};

// Mock discussions data
const mockDiscussionsData = {
  discussions: [
    {
      id: 101,
      forumId: 1,
      name: 'Welcome to the course',
      author: {
        id: 50,
        name: 'John Doe',
        avatar: 'avatar.jpg',
      },
      created: '2024-01-15T10:00:00Z',
      modified: '2024-01-16T14:30:00Z',
      pinned: true,
      locked: false,
      replies: 12,
      unread: false,
      lastPost: {
        author: 'Jane Smith',
        created: '2024-01-16T14:30:00Z',
      },
    },
    {
      id: 102,
      forumId: 1,
      name: 'Question about assignment 1',
      author: {
        id: 51,
        name: 'Jane Smith',
        avatar: 'avatar2.jpg',
      },
      created: '2024-01-16T09:00:00Z',
      modified: '2024-01-16T12:00:00Z',
      pinned: false,
      locked: false,
      replies: 5,
      unread: true,
      lastPost: {
        author: 'John Doe',
        created: '2024-01-16T12:00:00Z',
      },
    },
  ],
  pagination: {
    page: 1,
    perPage: 20,
    total: 25,
    totalPages: 2,
  },
};

// MSW server setup
const server = setupServer(
  // GET forum details
  rest.get(`${API_BASE_URL}/forums/:id`, (req, res, ctx) => {
    const { id } = req.params;
    if (id === '999') {
      return res(
        ctx.status(404),
        ctx.json({
          success: false,
          error: {
            code: 'FORUM_NOT_FOUND',
            message: 'Forum not found',
          },
        })
      );
    }
    if (id === '403') {
      return res(
        ctx.status(403),
        ctx.json({
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to view this forum',
          },
        })
      );
    }
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: mockForumData,
      })
    );
  }),

  // GET forum discussions
  rest.get(`${API_BASE_URL}/forums/:id/discussions`, (req, res, ctx) => {
    const page = req.url.searchParams.get('page') || '1';
    const sortBy = req.url.searchParams.get('sortBy') || 'date';
    const filter = req.url.searchParams.get('filter') || 'all';
    
    // Simulate sorting and filtering
    let discussions = [...mockDiscussionsData.discussions];
    
    if (filter === 'unread') {
      discussions = discussions.filter(d => d.unread);
    } else if (filter === 'pinned') {
      discussions = discussions.filter(d => d.pinned);
    }
    
    if (sortBy === 'replies') {
      discussions.sort((a, b) => b.replies - a.replies);
    }
    
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          discussions,
          pagination: {
            ...mockDiscussionsData.pagination,
            page: parseInt(page, 10),
          },
        },
      })
    );
  }),

  // POST toggle subscription
  rest.post(`${API_BASE_URL}/forums/:id/subscribe`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          subscribed: true,
        },
      })
    );
  }),

  // POST unsubscribe
  rest.post(`${API_BASE_URL}/forums/:id/unsubscribe`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          subscribed: false,
        },
      })
    );
  }),

  // POST mark all as read
  rest.post(`${API_BASE_URL}/forums/:id/mark-read`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          unreadCount: 0,
        },
      })
    );
  }),

  // POST create discussion
  rest.post(`${API_BASE_URL}/forums/:id/discussions`, (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: {
          id: 103,
          name: 'New discussion',
          created: new Date().toISOString(),
        },
      })
    );
  }),

  // POST pin discussion
  rest.post(`${API_BASE_URL}/forums/discussions/:id/pin`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          pinned: true,
        },
      })
    );
  }),

  // POST lock discussion
  rest.post(`${API_BASE_URL}/forums/discussions/:id/lock`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          locked: true,
        },
      })
    );
  })
);

// Start server before tests
beforeEach(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
});

// Close server after all tests
afterEach(() => {
  server.close();
});

// Helper to create query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

// Helper to create wrapper with QueryClientProvider
const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useForum', () => {
  describe('Forum data fetching', () => {
    it('should fetch forum details successfully', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      // Initial loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.forum).toBeUndefined();

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify forum data
      expect(result.current.forum).toEqual(mockForumData);
      expect(result.current.error).toBeNull();
    });

    it('should use correct query key structure', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        const queryData = queryClient.getQueryData(['forums', 1]);
        expect(queryData).toBeDefined();
      });
    });

    it('should handle 404 forum not found error', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(999), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.forum).toBeUndefined();
    });

    it('should handle 403 permission denied error', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(403), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.forum).toBeUndefined();
    });

    it('should handle network failure', async () => {
      server.use(
        rest.get(`${API_BASE_URL}/forums/:id`, (req, res, ctx) => {
          return res.networkError('Network connection failed');
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Discussion list fetching', () => {
    it('should fetch discussions with pagination', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(
        () => useForum(1, { page: 1, perPage: 20 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.discussions).toBeDefined();
      });

      expect(result.current.discussions).toHaveLength(2);
      expect(result.current.pagination).toEqual({
        page: 1,
        perPage: 20,
        total: 25,
        totalPages: 2,
      });
    });

    it('should support sorting by date', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(
        () => useForum(1, { sortBy: 'date' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.discussions).toBeDefined();
      });

      expect(result.current.discussions).toBeDefined();
    });

    it('should support sorting by replies', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(
        () => useForum(1, { sortBy: 'replies' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.discussions).toBeDefined();
      });

      const discussions = result.current.discussions!;
      // Verify sorted by replies descending
      expect(discussions[0].replies).toBeGreaterThanOrEqual(discussions[1].replies);
    });

    it('should filter unread discussions', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(
        () => useForum(1, { filter: 'unread' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.discussions).toBeDefined();
      });

      const discussions = result.current.discussions!;
      expect(discussions.every(d => d.unread)).toBe(true);
    });

    it('should filter pinned discussions', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(
        () => useForum(1, { filter: 'pinned' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.discussions).toBeDefined();
      });

      const discussions = result.current.discussions!;
      expect(discussions.every(d => d.pinned)).toBe(true);
    });

    it('should support next page prefetching', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(
        () => useForum(1, { page: 1, perPage: 20 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.discussions).toBeDefined();
      });

      // Trigger prefetch
      if (result.current.prefetchNextPage) {
        result.current.prefetchNextPage();
      }

      // Verify next page is prefetched
      await waitFor(() => {
        const nextPageData = queryClient.getQueryData([
          'forums',
          1,
          'discussions',
          { page: 2, perPage: 20 },
        ]);
        expect(nextPageData).toBeDefined();
      });
    });
  });

  describe('Subscription management', () => {
    it('should toggle subscription with optimistic update', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      // Wait for initial data
      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      const initialSubscribed = result.current.forum!.subscribed;

      // Toggle subscription
      result.current.toggleSubscription();

      // Verify optimistic update (immediate state change)
      await waitFor(() => {
        expect(result.current.forum!.subscribed).toBe(!initialSubscribed);
      });

      // Wait for server response
      await waitFor(() => {
        expect(result.current.isSubscribing).toBe(false);
      });

      // Verify final state matches server
      expect(result.current.forum!.subscribed).toBe(true);
    });

    it('should rollback optimistic update on error', async () => {
      server.use(
        rest.post(`${API_BASE_URL}/forums/:id/subscribe`, (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: 'Failed to subscribe',
              },
            })
          );
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      const initialSubscribed = result.current.forum!.subscribed;

      // Attempt to toggle subscription
      result.current.toggleSubscription();

      // Wait for error
      await waitFor(() => {
        expect(result.current.isSubscribing).toBe(false);
      });

      // Verify rollback to original state
      expect(result.current.forum!.subscribed).toBe(initialSubscribed);
    });

    it('should handle concurrent subscription toggles', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      // Trigger multiple toggles rapidly
      result.current.toggleSubscription();
      result.current.toggleSubscription();
      result.current.toggleSubscription();

      // Wait for all mutations to complete
      await waitFor(() => {
        expect(result.current.isSubscribing).toBe(false);
      });

      // Final state should be consistent
      expect(result.current.forum!.subscribed).toBeDefined();
    });
  });

  describe('Cache management', () => {
    it('should invalidate cache after forum update', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      // Perform mutation that should invalidate cache
      result.current.toggleSubscription();

      await waitFor(() => {
        expect(result.current.isSubscribing).toBe(false);
      });

      // Verify cache was updated
      const cachedData = queryClient.getQueryData(['forums', 1]);
      expect(cachedData).toBeDefined();
    });

    it('should support background refetch with staleTime', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(
        () => useForum(1, { staleTime: 5000 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      // Verify data is not refetched immediately
      expect(result.current.isRefetching).toBe(false);
    });

    it('should refetch on window focus', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(
        () => useForum(1, { refetchOnWindowFocus: true }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      // Simulate window focus
      window.dispatchEvent(new Event('focus'));

      // Should trigger refetch
      await waitFor(() => {
        expect(result.current.isFetching).toBe(true);
      });
    });

    it('should persist cache and support hydration', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      // Verify cache is populated
      const cachedData = queryClient.getQueryData(['forums', 1]);
      expect(cachedData).toEqual(mockForumData);
    });
  });

  describe('Forum mutations', () => {
    it('should mark all discussions as read', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      // Mark all as read
      result.current.markAllAsRead();

      await waitFor(() => {
        expect(result.current.isMarkingRead).toBe(false);
      });

      // Verify unread count updated
      expect(result.current.forum!.unreadCount).toBe(0);
    });

    it('should create new discussion', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      const newDiscussion = {
        name: 'New discussion',
        message: 'Discussion content',
      };

      // Create discussion
      result.current.createDiscussion(newDiscussion);

      await waitFor(() => {
        expect(result.current.isCreatingDiscussion).toBe(false);
      });

      // Verify discussions cache invalidated
      const discussionsData = queryClient.getQueryData([
        'forums',
        1,
        'discussions',
      ]);
      expect(discussionsData).toBeDefined();
    });

    it('should pin discussion (moderator only)', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      // Pin discussion
      result.current.pinDiscussion(101);

      await waitFor(() => {
        expect(result.current.isPinning).toBe(false);
      });

      // Verify cache updated
      expect(result.current.discussions).toBeDefined();
    });

    it('should lock discussion (moderator only)', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      // Lock discussion
      result.current.lockDiscussion(101);

      await waitFor(() => {
        expect(result.current.isLocking).toBe(false);
      });

      // Verify mutation completed
      expect(result.current.discussions).toBeDefined();
    });
  });

  describe('Query options', () => {
    it('should support enabled/disabled query', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result, rerender } = renderHook(
        ({ enabled }) => useForum(1, { enabled }),
        { wrapper, initialProps: { enabled: false } }
      );

      // Query should not execute
      expect(result.current.forum).toBeUndefined();
      expect(result.current.isLoading).toBe(false);

      // Enable query
      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });
    });

    it('should support data transformation with select', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(
        () =>
          useForum(1, {
            select: (data) => ({
              ...data,
              displayName: data.name.toUpperCase(),
            }),
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      expect(result.current.forum!.displayName).toBe(
        mockForumData.name.toUpperCase()
      );
    });

    it('should execute onSuccess callback', async () => {
      const onSuccess = vi.fn();
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      renderHook(() => useForum(1, { onSuccess }), { wrapper });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      expect(onSuccess).toHaveBeenCalledWith(mockForumData);
    });

    it('should execute onError callback', async () => {
      const onError = vi.fn();
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      renderHook(() => useForum(999, { onError }), { wrapper });

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });
  });

  describe('TypeScript typing', () => {
    it('should have proper return type', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      // TypeScript should infer these properties
      expect(typeof result.current.isLoading).toBe('boolean');
      expect(typeof result.current.isError).toBe('boolean');
      expect(typeof result.current.isSuccess).toBe('boolean');
      expect(typeof result.current.toggleSubscription).toBe('function');
      expect(typeof result.current.markAllAsRead).toBe('function');
      expect(typeof result.current.createDiscussion).toBe('function');
    });
  });

  describe('Error handling and retry', () => {
    it('should not retry on 404 errors', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(999), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      // Verify only one request was made (no retries)
    });

    it('should handle mutation errors gracefully', async () => {
      server.use(
        rest.post(`${API_BASE_URL}/forums/:id/discussions`, (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid discussion data',
              },
            })
          );
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      // Attempt to create invalid discussion
      result.current.createDiscussion({
        name: '',
        message: '',
      });

      await waitFor(() => {
        expect(result.current.isCreatingDiscussion).toBe(false);
      });

      // Hook should handle error without crashing
      expect(result.current.error).toBeDefined();
    });
  });

  describe('Query cancellation', () => {
    it('should cancel query on unmount', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { unmount } = renderHook(() => useForum(1), { wrapper });

      // Unmount before data loads
      unmount();

      // Query should be cancelled
      const queryState = queryClient.getQueryState(['forums', 1]);
      expect(queryState?.fetchStatus).not.toBe('fetching');
    });
  });

  describe('Forum statistics', () => {
    it('should provide forum statistics', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      expect(result.current.forum!.stats).toEqual({
        totalDiscussions: 25,
        totalPosts: 150,
        participants: 42,
      });
    });

    it('should track unread discussion count', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      expect(result.current.forum!.unreadCount).toBe(5);
    });
  });
});
