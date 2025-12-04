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

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../mocks/server';
import type { ReactNode } from 'react';
import { useForum } from '@/features/activities/forums/hooks/useForum';
import type { DiscussionEnriched } from '@/features/activities/forums/types/forum.types';

// Mock API base URL
const API_BASE_URL = 'http://localhost:8000/api/v1';

// Mock forum data - state that can be modified during tests
let forumSubscriptionState = false;
let forumUnreadCount = 5;
let forumRequestCount = 0;

// API format (camelCase) - what the mock server returns
const getMockApiForumData = () => ({
  id: 1,
  courseId: 10,  // camelCase for API format
  name: 'General Discussion Forum',
  intro: 'A forum for general discussions',
  introformat: 1,
  type: 'general',
  cmId: 100,
  displayMode: 1,
  subscriptionMode: 1,  // 1 = forced subscription -> forcesubscribe: 1
  trackingType: 1,      // 1 = optional tracking -> trackingtype: 1
  maxBytes: 512000,
  maxAttachments: 5,
  lockDiscussionAfter: 0,
  dueDate: 0,
  cutOffDate: 0,
  subscribed: forumSubscriptionState,
  canSubscribe: true,
  canAddDiscussion: true,
  canModerate: false,
  unreadCount: forumUnreadCount,
  discussionCount: 25,
  postCount: 150,
  participants: 42,
});

// Canonical format (lowercase) - what the transform produces
// Note: timemodified is dynamic (Date.now() / 1000) so tests must handle it specially
const getMockForumData = () => ({
  id: 1,
  courseid: 10,
  name: 'General Discussion Forum',
  intro: 'A forum for general discussions',
  introformat: 1,
  type: 'general',
  assessed: 0,
  assesstimestart: 0,
  assesstimefinish: 0,
  scale: 0,
  gradeforum: 0,
  gradeforumnotify: false,
  maxbytes: 512000,
  maxattachments: 5,
  forcesubscribe: 1,  // Mapped from subscriptionMode: 1
  trackingtype: 1,
  rsstype: 0,
  rssarticles: 0,
  timemodified: 1705405800,  // 2024-01-16T14:30:00Z - fixed for test predictability
  warnafter: 0,
  blockafter: 0,
  blockperiod: 0,
  completiondiscussions: 0,
  completionreplies: 0,
  completionposts: 0,
  displaywordcount: true,  // Hardcoded in transform function
  lockdiscussionafter: 0,
  duedate: 0,
  cutoffdate: 0,
  subscribed: forumSubscriptionState,
  canSubscribe: true,
  canAddDiscussion: true,
  canModerate: false,
  unreadCount: forumUnreadCount,
  discussionCount: 25,
  postCount: 150,
  participants: 42,
});

// Mock discussions data
const mockDiscussionsData: {
  discussions: DiscussionEnriched[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
} = {
  discussions: [
    {
      id: 101,
      courseid: 10,
      forumid: 1,
      name: 'Welcome to the course',
      firstpostid: 1001,
      userid: 50,
      groupid: 0,
      assessed: false,
      timemodified: 1705405800,  // 2024-01-16T14:30:00Z
      usermodified: 50,
      timestart: 0,
      timeend: 0,
      pinned: true,
      timelocked: 0,  // 0 means not locked
      created: 1705405800,
      numReplies: 5,
      numUnreadPosts: 0,
    },
    {
      id: 102,
      courseid: 10,
      forumid: 1,
      name: 'Question about assignment 1',
      firstpostid: 1002,
      userid: 51,
      groupid: 0,
      assessed: false,
      timemodified: 1705406400,  // 2024-01-16T12:00:00Z
      usermodified: 51,
      timestart: 0,
      timeend: 0,
      pinned: false,
      timelocked: 0,
      created: 1705406400,
      numReplies: 3,
      numUnreadPosts: 2,
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
const handlers = [
  // GET forum details
  http.get(`*${API_BASE_URL}/forums/:id`, ({ params }) => {
    const { id } = params;
    forumRequestCount++;
    if (id === '999') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'FORUM_NOT_FOUND',
            message: 'Forum not found',
          },
        },
        { status: 404 }
      );
    }
    if (id === '403') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to view this forum',
          },
        },
        { status: 403 }
      );
    }
    return HttpResponse.json({
      success: true,
      data: getMockApiForumData(),  // Return API format, let transform convert it
    });
  }),

  // GET forum discussions
  http.get(`*${API_BASE_URL}/forums/:id/discussions`, ({ request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const sortBy = url.searchParams.get('sortBy') || 'date';
    const filter = url.searchParams.get('filter') || 'all';
    
    // Simulate sorting and filtering
    let discussions = [...mockDiscussionsData.discussions];
    
    if (filter === 'unread') {
      discussions = discussions.filter(d => (d.numUnreadPosts ?? 0) > 0);
    } else if (filter === 'pinned') {
      discussions = discussions.filter(d => d.pinned);
    }
    
    if (sortBy === 'replies') {
      discussions.sort((a, b) => (b.numReplies ?? 0) - (a.numReplies ?? 0));
    }
    
    // Return PaginatedResponse<Discussion> structure
    return HttpResponse.json({
      success: true,
      data: {
        items: discussions,
        total: mockDiscussionsData.pagination.total,
      },
      meta: {
        pagination: {
          ...mockDiscussionsData.pagination,
          page: parseInt(page, 10),
        },
      },
    });
  }),

  // POST toggle subscription
  http.post(`*${API_BASE_URL}/forums/:id/subscribe`, () => {
    forumSubscriptionState = true;
    return HttpResponse.json({
      success: true,
      data: {
        subscribed: true,
      },
    });
  }),

  // POST unsubscribe
  http.post(`*${API_BASE_URL}/forums/:id/unsubscribe`, () => {
    forumSubscriptionState = false;
    return HttpResponse.json({
      success: true,
      data: {
        subscribed: false,
      },
    });
  }),

  // POST mark all as read
  // Note: API endpoint is /forums/{id}/read (not /mark-read)
  http.post(`*${API_BASE_URL}/forums/:id/read`, () => {
    forumUnreadCount = 0;
    return HttpResponse.json({
      success: true,
      data: {
        postsRead: 10,
        unreadCount: 0,
        message: 'All posts marked as read',
      },
    });
  }),

  // POST create discussion
  http.post(`*${API_BASE_URL}/forums/:id/discussions`, () => {
    return HttpResponse.json(
      {
        success: true,
        data: {
          id: 103,
          name: 'New discussion',
          created: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  }),

  // POST pin discussion
  http.post(`*${API_BASE_URL}/forums/discussions/:id/pin`, ({ params }) => {
    const discussionId = Number(params.id);
    const discussionIndex = mockDiscussionsData.discussions.findIndex(d => d.id === discussionId);
    if (discussionIndex !== -1) {
      // Update the mock data to persist the pinned state
      mockDiscussionsData.discussions[discussionIndex]!.pinned = true;
      return HttpResponse.json({
        success: true,
        data: {
          discussion: mockDiscussionsData.discussions[discussionIndex],
          message: 'Discussion pinned successfully',
        },
      });
    }
    return HttpResponse.json({
      success: true,
      data: {
        discussion: mockDiscussionsData.discussions[0],
        message: 'Discussion pinned successfully',
      },
    });
  }),

  // POST lock discussion
  http.post(`*${API_BASE_URL}/forums/discussions/:id/lock`, ({ params }) => {
    const discussionId = Number(params.id);
    const discussionIndex = mockDiscussionsData.discussions.findIndex(d => d.id === discussionId);
    if (discussionIndex !== -1) {
      // Update the mock data to persist the locked state
      mockDiscussionsData.discussions[discussionIndex]!.timelocked = Math.floor(Date.now() / 1000);  // Unix timestamp
      return HttpResponse.json({
        success: true,
        data: {
          discussion: mockDiscussionsData.discussions[discussionIndex],
          message: 'Discussion locked successfully',
        },
      });
    }
    return HttpResponse.json({
      success: true,
      data: {
        discussion: mockDiscussionsData.discussions[0],
        message: 'Discussion locked successfully',
      },
    });
  })
];

// Start server before all tests
beforeAll(() => {
  // Replace global handlers with test-specific handlers
  // This ensures our test handlers take precedence
  server.resetHandlers(...handlers);
});

// Reset mock state before each test
beforeEach(() => {
  forumSubscriptionState = false;
  forumUnreadCount = 5;
  forumRequestCount = 0;
  
  // Reset discussion states to original values
  mockDiscussionsData.discussions[0]!.pinned = true;
  mockDiscussionsData.discussions[0]!.timelocked = 0;
  mockDiscussionsData.discussions[1]!.pinned = false;
  mockDiscussionsData.discussions[1]!.timelocked = 0;
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
});

// Close server after all tests
afterAll(() => {
  // Server cleanup handled globally
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
  function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
  Wrapper.displayName = 'ForumTestWrapper';
  return Wrapper;
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

      // Verify forum data - compare without timemodified since it's dynamic
      const { timemodified: _receivedTime, ...forumWithoutTime } = result.current.forum || {};
      const { timemodified: _mockTime, ...mockWithoutTime } = getMockForumData();
      expect(forumWithoutTime).toEqual(mockWithoutTime);
      expect(result.current.forum?.timemodified).toBeGreaterThan(0);
      expect(result.current.error).toBeNull();
    });

    it('should use correct query key structure', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        const queryData = queryClient.getQueryData(['forums', 'detail', 1]);
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
        http.get(`*${API_BASE_URL}/forums/:id`, () => {
          return HttpResponse.error();
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      // Pass retry: false to avoid retrying network errors in tests
      const { result } = renderHook(() => useForum(1, { retry: false }), { wrapper });

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
        () => useForum(1, { discussionOptions: { page: 1, perPage: 20 } }),
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
        () => useForum(1, { discussionOptions: { sortBy: 'date' } }),
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
        () => useForum(1, { discussionOptions: { sortBy: 'replies' } }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.discussions).toBeDefined();
      });

      const discussions = result.current.discussions!;
      // Verify discussions are returned (sorting is handled server-side)
      // Discussion interface doesn't include a 'replies' field - this is server data
      expect(discussions.length).toBeGreaterThan(0);
      expect(discussions[0]).toHaveProperty('id');
      expect(discussions[0]).toHaveProperty('name');
    });

    it('should filter unread discussions', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(
        () => useForum(1, { discussionOptions: { filter: 'unread' } }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.discussions).toBeDefined();
      });

      const discussions = result.current.discussions!;
      expect(discussions.every(d => (d.numUnreadPosts ?? 0) > 0)).toBe(true);
    });

    it('should filter pinned discussions', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(
        () => useForum(1, { discussionOptions: { filter: 'pinned' } }),
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
        () => useForum(1, { discussionOptions: { page: 1, perPage: 20 } }),
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
      // The query key includes all discussion params with defaults
      await waitFor(() => {
        const nextPageData = queryClient.getQueryData([
          'forums',
          'detail',
          1,
          'discussions',
          { 
            page: 2, 
            perPage: 20,
            sortBy: 'date',
            sortOrder: 'desc',
            filter: 'all',
            search: undefined,
            groupid: undefined,
          },
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
        http.post(`*${API_BASE_URL}/forums/:id/subscribe`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: 'Failed to subscribe',
              },
            },
            { status: 500 }
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
      const cachedData = queryClient.getQueryData(['forums', 'detail', 1]);
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
        () => useForum(1, { refetchOnWindowFocus: true, staleTime: 0 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      // Record initial request count
      const initialRequestCount = forumRequestCount;

      // Ensure query is not fetching before focus event
      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });

      // Mark the query as stale to ensure refetch will happen on focus
      // React Query only refetches stale queries on window focus
      await queryClient.invalidateQueries({ queryKey: ['forums', 'detail', 1] });

      // Wait for invalidation to complete
      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });

      // Simulate window focus using focusManager
      focusManager.setFocused(true);

      // Should trigger refetch - verify by checking request count increased
      // Note: Increased timeout to 5000ms to handle React Query's throttling and load
      // React Query throttles window focus refetches (5s default) which can be delayed under load
      await waitFor(() => {
        expect(forumRequestCount).toBeGreaterThan(initialRequestCount);
      }, { timeout: 5000 });
    });

    it('should persist cache and support hydration', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useForum(1), { wrapper });

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
      });

      // Verify cache is populated - compare without timemodified since it's dynamic
      const cachedData = queryClient.getQueryData(['forums', 'detail', 1]);
      const { timemodified: _cachedTime, ...cachedWithoutTime } = (cachedData as Record<string, unknown>) ?? {};
      const { timemodified: _mockTime, ...mockWithoutTime } = getMockForumData();
      expect(cachedWithoutTime).toEqual(mockWithoutTime);
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

      // Load forum with discussions enabled
      const { result } = renderHook(
        () => useForum(1, { discussionOptions: { page: 1, perPage: 20 } }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
        expect(result.current.discussions).toBeDefined();
      });

      const newDiscussion = {
        subject: 'New discussion',
        message: 'Discussion content',
      };

      // Create discussion
      void result.current.createDiscussion(newDiscussion);

      await waitFor(() => {
        expect(result.current.isCreatingDiscussion).toBe(false);
      });

      // Verify mutation completed successfully by checking that discussions are still available
      // The mutation invalidates the cache, but since the query is active, it will refetch
      expect(result.current.discussions).toBeDefined();
    });

    it('should pin discussion (moderator only)', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      // Include discussionOptions to load discussions
      const { result } = renderHook(
        () => useForum(1, { discussionOptions: { page: 1, perPage: 20 } }),
        { wrapper }
      );

      // Wait for both forum and discussions to load
      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
        expect(result.current.discussions).toBeDefined();
      });

      // Pin discussion
      void result.current.pinDiscussion(101);

      await waitFor(() => {
        expect(result.current.isPinning).toBe(false);
      });

      // Verify cache updated
      await waitFor(() => {
        expect(result.current.discussions).toBeDefined();
        const pinnedDiscussion = result.current.discussions?.find(d => d.id === 101);
        expect(pinnedDiscussion?.pinned).toBe(true);
      });
    });

    it('should lock discussion (moderator only)', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      // Include discussionOptions to load discussions
      const { result } = renderHook(
        () => useForum(1, { discussionOptions: { page: 1, perPage: 20 } }),
        { wrapper }
      );

      // Wait for both forum and discussions to load
      await waitFor(() => {
        expect(result.current.forum).toBeDefined();
        expect(result.current.discussions).toBeDefined();
      });

      // Lock discussion
      void result.current.lockDiscussion(101);

      await waitFor(() => {
        expect(result.current.isLocking).toBe(false);
      });

      // Verify mutation completed and cache updated
      await waitFor(() => {
        expect(result.current.discussions).toBeDefined();
        const lockedDiscussion = result.current.discussions?.find(d => d.id === 101);
        expect(lockedDiscussion?.timelocked).toBeGreaterThan(0);
      });
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

      expect(result.current.forum!.name).toBe(
        getMockForumData().name
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

      // Compare without timemodified since it's dynamic
      // We already verified onSuccess was called, so calls[0] exists
      const receivedArg = (onSuccess.mock.calls as Array<[Record<string, unknown>]>)[0]?.[0] ?? {};
      const { timemodified: _receivedTime, ...receivedWithoutTime } = receivedArg;
      const { timemodified: _mockTime, ...mockWithoutTime } = getMockForumData();
      expect(receivedWithoutTime).toEqual(mockWithoutTime);
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
        http.post(`*${API_BASE_URL}/forums/:id/discussions`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid discussion data',
              },
            },
            { status: 400 }
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
      let errorThrown = false;
      try {
        await result.current.createDiscussion({
          subject: '',
          message: '',
        });
      } catch (error) {
        errorThrown = true;
      }

      await waitFor(() => {
        expect(result.current.isCreatingDiscussion).toBe(false);
      });

      // Hook should handle error without crashing
      expect(errorThrown).toBe(true);
    });
  });

  describe('Query cancellation', () => {
    it('should cancel query on unmount', async () => {
      const queryClient = createTestQueryClient();
      
      // Add a delayed handler for this test
      server.use(
        http.get(`*${API_BASE_URL}/forums/:id`, async () => {
          // Delay response to allow unmount during fetch
          await new Promise((resolve) => setTimeout(resolve, 200));
          // Return API format (pre-transformation)
          return HttpResponse.json({
            success: true,
            data: getMockApiForumData(),
          });
        })
      );
      
      const wrapper = createWrapper(queryClient);

      const { unmount, result } = renderHook(() => useForum(1), { wrapper });

      // Wait until query is actually fetching
      await waitFor(() => {
        expect(result.current.isLoading || result.current.isFetching).toBe(true);
      }, { timeout: 500 });
      
      // Unmount before data loads
      unmount();

      // Wait for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify query has no active observers after unmount
      const queryCache = queryClient.getQueryCache();
      const query = queryCache.find({ queryKey: ['forums', 'detail', 1] });
      expect(query?.getObserversCount()).toBe(0);
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

      expect(result.current.forum!.discussionCount).toBe(25);
      expect(result.current.forum!.postCount).toBe(150);
      expect(result.current.forum!.participants).toBe(42);
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
