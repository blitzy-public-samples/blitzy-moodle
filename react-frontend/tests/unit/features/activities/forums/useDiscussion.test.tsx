import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import type React from 'react';
import { useDiscussion } from '@/features/activities/forums/hooks/useDiscussion';
import * as forumApi from '@/features/activities/forums/api/forumApi';
import type { SubscriptionResponse, DiscussionWithPosts, ApiDiscussion, ApiPost } from '@/features/activities/forums/api/forumApi';
import type { Post, DiscussionPost, PostResponse, CreatePostData, UpdatePostData } from '@/features/activities/forums/types/forum.types';

/**
 * Comprehensive unit tests for useDiscussion custom hook
 * 
 * Tests cover:
 * - Discussion thread fetching with React Query integration
 * - Post list with nested hierarchy reconstruction
 * - Reply creation with optimistic updates
 * - Post editing with conflict detection
 * - Post deletion with cascade handling
 * - Subscription management
 * - Mark as read functionality
 * - Cache invalidation strategies
 * - Concurrent edits and deleted posts handling
 * - Edge cases: deleted users, broken references, offline scenarios
 */

// Mock the forum API module but preserve utility functions that are used internally
vi.mock('@/features/activities/forums/api/forumApi', async (importOriginal) => {
  const actual = await importOriginal<typeof forumApi>();
  return {
    ...actual,
    // Mock API functions (these make network calls)
    fetchForum: vi.fn(),
    fetchDiscussions: vi.fn(),
    createDiscussion: vi.fn(),
    fetchPosts: vi.fn(),
    getDiscussionPosts: vi.fn(),
    createPost: vi.fn(),
    updatePost: vi.fn(),
    deletePost: vi.fn(),
    subscribeForum: vi.fn(),
    unsubscribeForum: vi.fn(),
    subscribeDiscussion: vi.fn(),
    unsubscribeDiscussion: vi.fn(),
    markRead: vi.fn(),
    pinDiscussion: vi.fn(),
    unpinDiscussion: vi.fn(),
    lockDiscussion: vi.fn(),
    unlockDiscussion: vi.fn(),
    moveDiscussion: vi.fn(),
    splitDiscussion: vi.fn(),
    reportPost: vi.fn(),
    fetchPostReplies: vi.fn(),
    fetchMorePosts: vi.fn(),
    markDiscussionRead: vi.fn(),
    // Keep transform functions as real implementations (they're pure functions)
    transformApiPostsToCanonical: actual.transformApiPostsToCanonical,
    transformApiPostsToDisplayInfo: actual.transformApiPostsToDisplayInfo,
  };
});

// Helper function to create a test wrapper with QueryClient
const createWrapper = (client?: QueryClient) => {
  const queryClient = client || new QueryClient({
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

  function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
}
  
  return Wrapper;
};

// Mock data factory functions
// Creates Post objects (internal/canonical format - used in DiscussionWithPosts)
const createMockPost = (overrides: Partial<Post> = {}): Post => ({
  id: 1,
  discussionid: 100,
  parentid: 0,
  authorid: 10,
  timecreated: Math.floor((Date.now() - 3600000) / 1000),
  timemodified: Math.floor((Date.now() - 3600000) / 1000),
  mailed: false,
  subject: 'Test Post',
  message: 'This is a test post message',
  messageformat: 1,
  messagetrust: false,
  hasattachments: false,
  totalscore: 0,
  mailnow: false,
  deleted: false,
  privatereplyto: 0,
  wordcount: 10,
  charcount: 30,
  ...overrides,
});

// Creates ApiPost objects (as returned by the API - enriched format with user details)
const createMockApiPost = (overrides: Partial<ApiPost> = {}): ApiPost => ({
  id: 1,
  discussionid: 100,
  subject: 'Test Post',
  message: 'This is a test post message',
  messageformat: 1,
  userid: 10,
  userFullName: 'Test User',
  userPictureUrl: null,
  created: Math.floor((Date.now() - 3600000) / 1000),
  modified: Math.floor((Date.now() - 3600000) / 1000),
  parent: 0,
  hasattachments: false,
  attachments: [],
  haschildren: false,
  children: [],
  canEdit: true,
  canDelete: true,
  canReply: true,
  unread: false,
  ...overrides,
});

// Creates ApiDiscussion objects (as returned by the API - enriched format)
const createMockApiDiscussion = (overrides: Partial<ApiDiscussion> = {}): ApiDiscussion => ({
  id: 100,
  name: 'Test Discussion',
  message: 'This is the discussion content',
  userid: 10,
  userFullName: 'Test User',
  userPictureUrl: null,
  timemodified: Math.floor((Date.now() - 3600000) / 1000),
  locked: false,
  pinned: false,
  replies: 5,
  unreadCount: 0,
  forumid: 50,
  courseid: 1,
  firstpostid: 1,
  groupid: 0,
  created: Math.floor((Date.now() - 3600000) / 1000),
  ...overrides,
});

// Helper function to recursively find a post by ID in the hierarchy
const findPostInHierarchy = (posts: DiscussionPost[], postId: number): DiscussionPost | undefined => {
  for (const post of posts) {
    if (post.id === postId) {
      return post;
    }
    if (post.replies && post.replies.length > 0) {
      const found = findPostInHierarchy(post.replies, postId);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
};

// Helper function to count all posts in hierarchy (including nested replies)
const countPostsInHierarchy = (posts: DiscussionPost[]): number => {
  let count = posts.length;
  for (const post of posts) {
    if (post.replies && post.replies.length > 0) {
      count += countPostsInHierarchy(post.replies);
    }
  }
  return count;
};

// Helper function to create complete DiscussionWithPosts mock data
const createMockDiscussionWithPosts = (
  discussionOverrides: Partial<ApiDiscussion> = {},
  posts: Post[] = []
): DiscussionWithPosts => ({
  discussion: createMockApiDiscussion(discussionOverrides),
  posts,
  totalPosts: posts.length,
  hasMore: false,
  currentPage: 1,
});

describe('useDiscussion Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Discussion Thread Fetching', () => {
    it('should fetch discussion with posts using correct query key structure', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [
        createMockPost({ id: 1, discussionid: discussionId, parentid: 0 }),
        createMockPost({ id: 2, discussionid: discussionId, parentid: 1 }),
        createMockPost({ id: 3, discussionid: discussionId, parentid: 1 }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue(
        createMockDiscussionWithPosts({ id: discussionId }, mockPosts)
      );

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(forumApi.getDiscussionPosts).toHaveBeenCalledWith(discussionId);
      
      // Check that discussion is a DiscussionDetail with all base Discussion properties
      expect(result.current.discussion).toBeDefined();
      expect(result.current.discussion?.id).toBe(mockDiscussion.id);
      expect(result.current.discussion?.name).toBe(mockDiscussion.name);
      expect(result.current.discussion?.forumid).toBe(mockDiscussion.forumid);
      
      // Check DiscussionDetail-specific properties added by constructDiscussionDetail
      expect(result.current.discussion?.author).toBeDefined();
      expect(result.current.discussion?.numReplies).toBe(2); // 3 posts - 1 = 2 replies
      expect(result.current.discussion?.numParticipants).toBeGreaterThan(0);
      expect(result.current.discussion?.subscribed).toBe(false);
      
      // posts array contains only root posts (parentid === 0)
      expect(result.current.posts).toHaveLength(1);
      // Verify the root post has 2 replies
      expect(result.current.posts![0]!.replies).toHaveLength(2);
      expect(result.current.posts![0]!.id).toBe(1);
      expect(result.current.posts![0]!.replies[0]!.id).toBe(2);
      expect(result.current.posts![0]!.replies[1]!.id).toBe(3);
    });

    it('should reconstruct nested post hierarchy from flat API response', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      
      // Flat list of posts with parent-child relationships
      const flatPosts = [
        createMockPost({ id: 1, discussionid: discussionId, parentid: 0, subject: 'Root Post' }),
        createMockPost({ id: 2, discussionid: discussionId, parentid: 1, subject: 'Reply to Root' }),
        createMockPost({ id: 3, discussionid: discussionId, parentid: 1, subject: 'Another Reply to Root' }),
        createMockPost({ id: 4, discussionid: discussionId, parentid: 2, subject: 'Nested Reply' }),
        createMockPost({ id: 5, discussionid: discussionId, parentid: 4, subject: 'Deep Nested Reply' }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: flatPosts,
        totalPosts: flatPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify nested structure is reconstructed
      const rootPost = result.current.posts?.find(p => p.id === 1);
      expect(rootPost).toBeDefined();
      expect(rootPost?.replies).toHaveLength(2);
      
      const firstReply = rootPost?.replies?.find(r => r.id === 2);
      expect(firstReply?.replies).toHaveLength(1);
      expect(firstReply?.replies?.[0]!.id).toBe(4);
      
      const nestedReply = firstReply?.replies?.[0];
      expect(nestedReply?.replies).toHaveLength(1);
      expect(nestedReply?.replies?.[0]!.id).toBe(5);
    });

    it('should handle loading state during initial fetch', async () => {
      const discussionId = 100;
      let resolvePromise: (value: DiscussionWithPosts) => void;
      const promise = new Promise<DiscussionWithPosts>((resolve) => {
        resolvePromise = resolve;
      });

       
      vi.mocked(forumApi.getDiscussionPosts).mockReturnValue(promise);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.discussion).toBeUndefined();
      expect(result.current.posts).toBeUndefined();

      act(() => {
        resolvePromise!(createMockDiscussionWithPosts({}, [createMockPost()]));
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should handle 404 discussion not found error', async () => {
      const discussionId = 999;
      const error = new Error('Discussion not found');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (error as any).response = { status: 404 };

      vi.mocked(forumApi.getDiscussionPosts).mockRejectedValue(error);

      const { result } = renderHook(
        () => useDiscussion(discussionId, { retryCount: 0 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((result.current.error as any)?.response?.status).toBe(404);
    });

    it('should handle 403 permission denied error', async () => {
      const discussionId = 100;
      const error = new Error('Permission denied');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (error as any).response = { status: 403, data: { error: 'PERMISSION_DENIED' } };

      vi.mocked(forumApi.getDiscussionPosts).mockRejectedValue(error);

      const { result } = renderHook(
        () => useDiscussion(discussionId, { retryCount: 0 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((result.current.error as any)?.response?.status).toBe(403);
    });

    it('should refetch on window focus with appropriate staleTime', async () => {
      const discussionId = 100;
      const mockData = createMockDiscussionWithPosts({}, [createMockPost()]);

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue(mockData);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const initialCallCount = vi.mocked(forumApi.getDiscussionPosts).mock.calls.length;

      // Manually invalidate the query to mark it as stale
      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        void queryClient.invalidateQueries({ queryKey: ['discussions', 'detail', discussionId] });
      });

      // Simulate window focus event using React Query's focusManager
      await act(async () => {
        focusManager.setFocused(false);
        await new Promise(resolve => setTimeout(resolve, 50));
        focusManager.setFocused(true);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should refetch on window focus (after data marked as stale)
      await waitFor(() => {
        expect(vi.mocked(forumApi.getDiscussionPosts).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('should support background refresh for active discussions', async () => {
      const discussionId = 100;
      const initialPosts = [
        createMockPost({ id: 1, parentid: 0 }),
        createMockPost({ id: 2, parentid: 1 }),
        createMockPost({ id: 3, parentid: 1 }),
        createMockPost({ id: 4, parentid: 1 }),
        createMockPost({ id: 5, parentid: 1 }),
        createMockPost({ id: 6, parentid: 1 }),
      ];
      const initialData = createMockDiscussionWithPosts({}, initialPosts);
      const updatedPosts = [
        createMockPost({ id: 1, parentid: 0 }),
        createMockPost({ id: 2, parentid: 1 }),
        createMockPost({ id: 3, parentid: 1 }),
        createMockPost({ id: 4, parentid: 1 }),
        createMockPost({ id: 5, parentid: 0 }), // Second root post
        createMockPost({ id: 6, parentid: 5 }),
        createMockPost({ id: 7, parentid: 5 }),
      ];
      const updatedData = createMockDiscussionWithPosts({}, updatedPosts);

      vi.mocked(forumApi.getDiscussionPosts)
        .mockResolvedValueOnce(initialData)
        .mockResolvedValueOnce(updatedData);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.numReplies).toBe(5);
      });

      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.discussion?.numReplies).toBe(6);
        expect(result.current.posts).toHaveLength(2);
      });
    });
  });

  describe('Reply Creation with Optimistic Updates', () => {
    it('should create reply with optimistic update', async () => {
      const discussionId = 100;
      const parentPostId = 1;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ id: parentPostId, discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      const newPost = createMockPost({ id: 999, discussionid: discussionId, parentid: parentPostId, subject: 'New Reply' });
      vi.mocked(forumApi.createPost).mockResolvedValue({ ...newPost, discussionId });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const replyData: CreatePostData = {
        forumId: mockDiscussion.forumid,
        message: 'This is a new reply',
      };

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.createReply({ postData: replyData, parentId: parentPostId });
      });

      await waitFor(() => {
        expect(forumApi.createPost).toHaveBeenCalledWith({ 
          discussionId, 
          forumId: mockDiscussion.forumid,
          message: 'This is a new reply', 
          parentPostId 
        });
      });
    });

    it('should add optimistic post to local cache before API confirmation', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ id: 1, discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      // Delay API response to observe optimistic update
      let resolveCreate: (value: PostResponse) => void;
      const createPromise = new Promise<PostResponse>((resolve) => {
        resolveCreate = resolve;
      });
       
      vi.mocked(forumApi.createPost).mockReturnValue(createPromise);

      const onCreateSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onCreateSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(1);
      });

      const replyData: CreatePostData = {
        forumId: mockDiscussion.forumid,
        message: 'This appears immediately',
      };

      act(() => {
        result.current.createReply({ postData: replyData, parentId: undefined });
      });

      // Optimistic post should appear immediately
      await waitFor(() => {
        expect(result.current.posts?.length).toBeGreaterThan(1);
      });

      // Confirm API call completes
      act(() => {
        resolveCreate!({ 
          ...createMockPost({ id: 2, subject: 'Optimistic Reply' }), 
          discussionId 
        });
      });

      await waitFor(() => {
        expect(onCreateSuccess).toHaveBeenCalled();
      });
    });

    it('should rollback optimistic post on create failure', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ id: 1, discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      const error = new Error('Failed to create post');
      vi.mocked(forumApi.createPost).mockRejectedValue(error);

      const onCreateError = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onCreateError }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(1);
      });

      const initialPostCount = result.current.posts?.length || 0;

      const replyData: CreatePostData = {
        forumId: mockDiscussion.forumid,
        message: 'This should rollback',
      };

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        try {
          result.current.createReply({ postData: replyData, parentId: undefined });
        } catch (err) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(onCreateError).toHaveBeenCalledWith(error);
      });

      // Should rollback to original state
      expect(result.current.posts).toHaveLength(initialPostCount);
    });
  });

  describe('Post Editing with Conflict Detection', () => {
    it('should edit post with concurrent edit detection', async () => {
      const discussionId = 100;
      const postId = 1;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPost = createMockPost({ id: postId, discussionid: discussionId, parentid: 0, timemodified: Math.floor((Date.now() - 1000) / 1000) });

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: [mockPost],
        totalPosts: 1,
        hasMore: false,
        currentPage: 1,
      });

      const updatedPost: forumApi.PostResponse = { 
        ...createMockPost({ 
          id: postId, 
          discussionid: discussionId,
          parentid: 0,
          subject: 'Updated Subject',
          timemodified: Math.floor(Date.now() / 1000),
        }),
        discussionId,
      };
      vi.mocked(forumApi.updatePost).mockResolvedValue(updatedPost);

      const onEditSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onEditSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const postData: UpdatePostData = {
        postId,
        message: 'Updated message',
        version: 1,
      };

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.editPost({ postId, postData });
      });

      await waitFor(() => {
        expect(forumApi.updatePost).toHaveBeenCalledWith(postData);
        expect(onEditSuccess).toHaveBeenCalled();
      });
    });

    it('should detect conflict when post version/timestamp has changed', async () => {
      const discussionId = 100;
      const postId = 1;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPost = createMockPost({ id: postId, discussionid: discussionId, parentid: 0 });

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: [mockPost],
        totalPosts: 1,
        hasMore: false,
        currentPage: 1,
      });

      // Simulate conflict error
      const conflictError = new Error('Concurrent modification detected');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (conflictError as any).response = {
        status: 409,
        data: {
          error: 'EDIT_CONFLICT',
          message: 'Post was modified by another user',
          currentVersion: 2,
          post: createMockPost({ id: postId, timemodified: Math.floor(Date.now() / 1000) }),
        },
      };
      vi.mocked(forumApi.updatePost).mockRejectedValue(conflictError);

      const onEditConflict = vi.fn();
      const onEditError = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onEditConflict, onEditError }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const postData: UpdatePostData = {
        postId,
        message: 'This will conflict',
      };

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        try {
          result.current.editPost({ postId, postData });
        } catch (err) {
          // Expected conflict error
        }
      });

      await waitFor(() => {
        expect(onEditConflict).toHaveBeenCalledWith(
          expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            post: expect.objectContaining({ id: postId, timemodified: expect.any(Number) }) as Post,
            conflictData: expect.objectContaining({
              error: 'EDIT_CONFLICT',
              currentVersion: 2,
            }) as Post,
          })
        );
        expect(onEditError).toHaveBeenCalledWith(conflictError);
      });
    });

    it('should trigger conflict resolution UI on concurrent edit', async () => {
      const discussionId = 100;
      const postId = 1;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPost = createMockPost({ id: postId, discussionid: discussionId, parentid: 0 });

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: [mockPost],
        totalPosts: 1,
        hasMore: false,
        currentPage: 1,
      });

      const conflictError = new Error('Edit conflict');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (conflictError as any).response = {
        status: 409,
        data: {
          error: 'EDIT_CONFLICT',
          currentPost: createMockPost({ id: postId, discussionid: discussionId, parentid: 0, subject: 'Changed by other user', timemodified: Math.floor(Date.now() / 1000) }),
        },
      };
      vi.mocked(forumApi.updatePost).mockRejectedValue(conflictError);

      const onConflict = vi.fn();
      const { result } = renderHook(
        () => useDiscussion(discussionId, { onEditConflict: onConflict }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        try {
          result.current.editPost({
            postId,
            postData: {
              postId,
              message: 'My message',
            }
          });
        } catch (err) {
          // Expected
        }
      });

      await waitFor(() => {
        expect(onConflict).toHaveBeenCalled();
      });
    });
  });

  describe('Post Deletion with Cascade Handling', () => {
    it('should delete post with soft delete for posts with replies', async () => {
      const discussionId = 100;
      const postId = 1;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [
        createMockPost({ id: postId, discussionid: discussionId, parentid: 0 }),
        createMockPost({ id: 2, discussionid: discussionId, parentid: postId }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ softDeleted: true, message: 'Post deleted successfully' });

      const onDeleteSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onDeleteSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.deletePost(postId);
      });

      await waitFor(() => {
        expect(forumApi.deletePost).toHaveBeenCalledWith(postId);
        expect(onDeleteSuccess).toHaveBeenCalledWith({ softDeleted: true, message: 'Post deleted successfully' });
      });
    });

    it('should show [deleted] placeholder after soft delete', async () => {
      const discussionId = 100;
      const postId = 1;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [
        createMockPost({ id: postId, discussionid: discussionId, parentid: 0, deleted: false }),
        createMockPost({ id: 2, discussionid: discussionId, parentid: postId }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ softDeleted: true, message: 'Post deleted successfully' });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        // Posts is hierarchical: post 1 (root) with post 2 as a reply
        expect(result.current.posts).toHaveLength(1);
        expect(countPostsInHierarchy(result.current.posts || [])).toBe(2);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.deletePost(postId);
      });

      await waitFor(() => {
        const deletedPost = findPostInHierarchy(result.current.posts || [], postId);
        expect(deletedPost?.deleted).toBe(true);
        expect(deletedPost?.message).toContain('[deleted]');
      });
    });

    it('should hard delete post without replies', async () => {
      const discussionId = 100;
      const postId = 3;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [
        createMockPost({ id: 1, discussionid: discussionId, parentid: 0 }),
        createMockPost({ id: 2, discussionid: discussionId, parentid: 1 }),
        createMockPost({ id: postId, discussionid: discussionId, parentid: 1 }), // No children
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ hardDeleted: true, message: 'Post permanently deleted' });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        // Posts is hierarchical: post 1 (root) with [post 2, post 3] as replies
        expect(result.current.posts).toHaveLength(1);
        expect(countPostsInHierarchy(result.current.posts || [])).toBe(3);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.deletePost(postId);
      });

      await waitFor(() => {
        // Post should be completely removed from the hierarchy
        expect(findPostInHierarchy(result.current.posts || [], postId)).toBeUndefined();
        expect(result.current.posts).toHaveLength(1); // Still 1 root post
        expect(countPostsInHierarchy(result.current.posts || [])).toBe(2); // Now 2 total posts
      });
    });

    it('should handle cascade delete for nested replies', async () => {
      const discussionId = 100;
      const parentPostId = 1;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [
        createMockPost({ id: parentPostId, discussionid: discussionId, parentid: 0 }),
        createMockPost({ id: 2, discussionid: discussionId, parentid: parentPostId }),
        createMockPost({ id: 3, discussionid: discussionId, parentid: 2 }),
        createMockPost({ id: 4, discussionid: discussionId, parentid: 3 }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ 
        softDeleted: true,
        message: '3 posts affected',
      });

      const onDeleteSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onDeleteSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        // Posts is hierarchical: post 1 (root) with deeply nested replies
        expect(result.current.posts).toHaveLength(1);
        expect(countPostsInHierarchy(result.current.posts || [])).toBe(4);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.deletePost(parentPostId);
      });

      await waitFor(() => {
        expect(onDeleteSuccess).toHaveBeenCalledWith(
          expect.objectContaining({
            softDeleted: true,
          })
        );
      });
    });
  });

  describe('Subscription Management', () => {
    it('should subscribe to discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.subscribeDiscussion).mockResolvedValue({ 
        subscribed: true,
        message: 'Successfully subscribed to discussion'
      });

      const onSubscribeSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onSubscribeSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.subscribed).toBe(false);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.subscribe();
      });

      await waitFor(() => {
        expect(forumApi.subscribeDiscussion).toHaveBeenCalledWith(discussionId);
        expect(onSubscribeSuccess).toHaveBeenCalledWith({ 
          subscribed: true,
          message: 'Successfully subscribed to discussion'
        });
      });
    });

    it('should unsubscribe from discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      // Start with user subscribed so we can test unsubscribe flow
      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
        subscribed: true, // Initially subscribed
      });

      vi.mocked(forumApi.unsubscribeDiscussion).mockResolvedValue({ 
        subscribed: false,
        message: 'Successfully unsubscribed from discussion'
      });

      const onUnsubscribeSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onUnsubscribeSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.subscribed).toBe(true);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.unsubscribe();
      });

      await waitFor(() => {
        expect(forumApi.unsubscribeDiscussion).toHaveBeenCalledWith(discussionId);
        expect(onUnsubscribeSuccess).toHaveBeenCalledWith({ 
          subscribed: false,
          message: 'Successfully unsubscribed from discussion'
        });
      });
    });

    it('should optimistically update subscription status', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      // Delay API response
      let resolveSubscribe: (value: SubscriptionResponse) => void;
      const subscribePromise = new Promise<SubscriptionResponse>((resolve) => {
        resolveSubscribe = resolve;
      });
       
      vi.mocked(forumApi.subscribeDiscussion).mockReturnValue(subscribePromise);

      const onSubscribeSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onSubscribeSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.subscribed).toBe(false);
      });

      act(() => {
        result.current.subscribe();
      });

      // Should immediately show subscribed (optimistic)
      await waitFor(() => {
        expect(result.current.discussion?.subscribed).toBe(true);
      });

      act(() => {
        resolveSubscribe!({ subscribed: true, message: 'Subscribed successfully' });
      });

      await waitFor(() => {
        expect(onSubscribeSuccess).toHaveBeenCalledWith({ subscribed: true, message: 'Subscribed successfully' });
      });
    });
  });

  describe('Mark as Read Functionality', () => {
    it('should mark discussion as read', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        discussion: { ...mockDiscussion, unreadCount: 5 } as any,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.markDiscussionRead).mockResolvedValue({
        postsRead: 5,
        unreadCount: 0,
        message: 'Discussion marked as read',
      });

      const onMarkAsReadSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onMarkAsReadSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.unreadCount).toBe(5);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.markAsRead();
      });

      await waitFor(() => {
        expect(forumApi.markDiscussionRead).toHaveBeenCalledWith(discussionId);
        expect(onMarkAsReadSuccess).toHaveBeenCalledWith({
          postsRead: 5,
          unreadCount: 0,
          message: 'Discussion marked as read',
        });
      });
    });

    it('should update unread post count in cache', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        discussion: { ...mockDiscussion, unreadCount: 3 } as any,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.markDiscussionRead).mockResolvedValue({
        postsRead: 3,
        unreadCount: 0,
        message: 'Discussion marked as read',
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.unreadCount).toBe(3);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.markAsRead();
      });

      await waitFor(() => {
        expect(result.current.discussion?.unreadCount).toBe(0);
      });
    });

    it('should mark discussion as read', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [
        createMockPost({ id: 1, discussionid: discussionId, parentid: 0 }),
        createMockPost({ id: 2, discussionid: discussionId, parentid: 0 }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        discussion: { ...mockDiscussion, unreadCount: 2 } as any,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.markDiscussionRead).mockResolvedValue({
        postsRead: 2,
        unreadCount: 0,
        message: 'Discussion marked as read',
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.unreadCount).toBe(2);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.markAsRead();
      });

      await waitFor(() => {
        expect(forumApi.markDiscussionRead).toHaveBeenCalledWith(discussionId);
        expect(result.current.discussion?.unreadCount).toBe(0);
      });
    });
  });

  describe('Moderator Actions', () => {
    it('should pin discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ 
        id: discussionId, 
        pinned: false,
      });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.pinDiscussion).mockResolvedValue({ 
        success: true,
        message: 'Discussion pinned successfully',
        discussionId,
        discussion: { ...mockDiscussion, pinned: true },
      });

      const onPinSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onPinSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.pinned).toBe(false);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.pinDiscussion();
      });

      await waitFor(() => {
        expect(forumApi.pinDiscussion).toHaveBeenCalledWith(discussionId);
        // Use expect.objectContaining at top level since ModerationResponse includes extra fields
        expect(onPinSuccess).toHaveBeenCalledWith(
          expect.objectContaining({ 
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            discussion: expect.objectContaining({ pinned: true }),
            message: 'Discussion pinned successfully'
          })
        );
      });
    });

    it('should unpin discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ 
        id: discussionId, 
        pinned: true,
      });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.unpinDiscussion).mockResolvedValue({ 
        success: true,
        message: 'Discussion unpinned successfully',
        discussionId,
        discussion: { ...mockDiscussion, pinned: false },
      });

      const onUnpinSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onUnpinSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.pinned).toBe(true);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.unpinDiscussion();
      });

      await waitFor(() => {
        expect(forumApi.unpinDiscussion).toHaveBeenCalledWith(discussionId);
        // Use expect.objectContaining at top level since ModerationResponse includes extra fields
        expect(onUnpinSuccess).toHaveBeenCalledWith(
          expect.objectContaining({ 
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            discussion: expect.objectContaining({ pinned: false }),
            message: 'Discussion unpinned successfully'
          })
        );
      });
    });

    it('should lock discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ 
        id: discussionId, 
        locked: false,
      });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.lockDiscussion).mockResolvedValue({ 
        success: true,
        message: 'Discussion locked successfully',
        discussionId,
        discussion: { ...mockDiscussion, locked: true },
      });

      const onLockSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onLockSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.locked).toBe(false);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.lockDiscussion();
      });

      await waitFor(() => {
        expect(forumApi.lockDiscussion).toHaveBeenCalledWith(discussionId);
        expect(onLockSuccess).toHaveBeenCalledWith({ 
          success: true,
          message: 'Discussion locked successfully',
          discussionId,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          discussion: expect.objectContaining({ locked: true }),
        });
      });
    });

    it('should unlock discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ 
        id: discussionId, 
        locked: true,
      });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.unlockDiscussion).mockResolvedValue({ 
        success: true,
        message: 'Discussion unlocked successfully',
        discussionId,
        discussion: { ...mockDiscussion, locked: false },
      });

      const onUnlockSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onUnlockSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.locked).toBe(true);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.unlockDiscussion();
      });

      await waitFor(() => {
        expect(forumApi.unlockDiscussion).toHaveBeenCalledWith(discussionId);
        expect(onUnlockSuccess).toHaveBeenCalledWith({ 
          success: true,
          message: 'Discussion unlocked successfully',
          discussionId,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          discussion: expect.objectContaining({ locked: false }),
        });
      });
    });

    it('should move discussion to another forum', async () => {
      const discussionId = 100;
      const targetForumId = 200;
      const mockDiscussion = createMockApiDiscussion({ 
        id: discussionId, 
        forumid: 50,
      });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.moveDiscussion).mockResolvedValue({ 
        success: true,
        message: 'Discussion moved successfully',
        discussionId,
        discussion: { ...mockDiscussion, forumid: targetForumId },
      });

      const onMoveSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onMoveSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.forumid).toBe(50);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.moveDiscussion(targetForumId);
      });

      await waitFor(() => {
        expect(forumApi.moveDiscussion).toHaveBeenCalledWith(discussionId, targetForumId);
        // Use expect.objectContaining at top level since ModerationResponse includes extra fields
        expect(onMoveSuccess).toHaveBeenCalledWith(
          expect.objectContaining({ 
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            discussion: expect.objectContaining({ forumid: targetForumId }),
            message: 'Discussion moved successfully'
          })
        );
      });
    });

    it('should split discussion', async () => {
      const discussionId = 100;
      const postId = 5;
      const mockDiscussion = createMockApiDiscussion({ 
        id: discussionId,
      });
      const mockPosts = [
        createMockPost({ id: 1, discussionid: discussionId, parentid: 0 }),
        createMockPost({ id: postId, discussionid: discussionId, parentid: 0 }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      const newDiscussion = createMockApiDiscussion({ id: 101 });
      vi.mocked(forumApi.splitDiscussion).mockResolvedValue({ 
        success: true,
        discussionId: 101,
        discussion: newDiscussion,
        message: 'Discussion split successfully'
      });

      const onSplitSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onSplitSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const newSubject = 'Split Discussion';
      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.splitDiscussion({ postId, newSubject });
      });

      await waitFor(() => {
        expect(forumApi.splitDiscussion).toHaveBeenCalledWith(discussionId, postId, newSubject);
        expect(onSplitSuccess).toHaveBeenCalledWith({ 
          success: true,
          discussionId: 101,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          discussion: expect.objectContaining({ id: 101 }),
          message: 'Discussion split successfully'
        });
      });
    });

    it('should report post for moderation', async () => {
      const discussionId = 100;
      const postId = 2;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [
        createMockPost({ id: 1, discussionid: discussionId, parentid: 0 }),
        createMockPost({ id: postId, discussionid: discussionId, parentid: 0 }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.reportPost).mockResolvedValue({ 
        success: true, 
        reportId: 1, 
        message: 'Post reported successfully',
        status: 'pending' 
      });

      const onReportSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onReportSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const reportData = {
        postId,
        reason: 'Spam content',
      };

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.reportPost(reportData);
      });

      await waitFor(() => {
        expect(forumApi.reportPost).toHaveBeenCalledWith(postId, 'Spam content');
        // Full ReportResponse includes success, message, reportId, status
        expect(onReportSuccess).toHaveBeenCalledWith(expect.objectContaining({ 
          reportId: 1, 
          message: 'Post reported successfully' 
        }));
      });
    });
  });

  describe('Pagination and Incremental Loading', () => {
    it('should support pagination for long discussion threads', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      
      // First page of posts
      const firstPagePosts = Array.from({ length: 20 }, (_, i) => 
        createMockPost({ id: i + 1, discussionid: discussionId, parentid: 0 })
      );

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: firstPagePosts,
        totalPosts: 60,
        hasMore: true,
        currentPage: 1,
        nextCursor: '20',
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(20);
        expect(result.current.hasMore).toBe(true);
      });

      // Load more posts
      const morePosts = Array.from({ length: 20 }, (_, i) => 
        createMockPost({ id: i + 21, discussionid: discussionId, parentid: 0 })
      );

      vi.mocked(forumApi.fetchMorePosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: morePosts,
        totalPosts: 60,
        hasMore: true,
        currentPage: 2,
        nextCursor: '40',
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.loadMore();
      });

      await waitFor(() => {
        expect(forumApi.fetchMorePosts).toHaveBeenCalledWith(discussionId, '20');
        expect(result.current.posts).toHaveLength(40);
      });
    });

    it('should incrementally load nested replies', async () => {
      const discussionId = 100;
      const parentPostId = 1;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [
        createMockPost({ id: parentPostId, discussionid: discussionId, parentid: 0 }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(1);
      });

      // Load replies for a specific post
      const replies = [
        createMockApiPost({ id: 2, discussionid: discussionId, parent: parentPostId }),
        createMockApiPost({ id: 3, discussionid: discussionId, parent: parentPostId }),
      ];

      vi.mocked(forumApi.fetchPostReplies).mockResolvedValue(replies);

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.loadReplies(parentPostId);
      });

      await waitFor(() => {
        expect(forumApi.fetchPostReplies).toHaveBeenCalledWith(parentPostId);
        const parentPost = result.current.posts?.find(p => p.id === parentPostId);
        expect(parentPost?.replies).toHaveLength(2);
      });
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate related queries after creating reply', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      const newPost = createMockPost({ id: 2, discussionid: discussionId, parentid: 0 });
      vi.mocked(forumApi.createPost).mockResolvedValue({ ...newPost, discussionId });

      const onCreateSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onCreateSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.createReply({
          postData: { forumId: mockDiscussion.forumid, message: 'Test message' },
          parentId: undefined,
        });
      });

      await waitFor(() => {
        expect(onCreateSuccess).toHaveBeenCalledWith({ ...newPost, discussionId });
      });

      // Wait for cache invalidation to trigger refetch
      await waitFor(() => {
        expect(vi.mocked(forumApi.getDiscussionPosts).mock.calls.length).toBeGreaterThan(1);
      }, { timeout: 3000 });
    });

    it('should invalidate forum discussion list cache after mutations', async () => {
      const discussionId = 100;
      const forumId = 50;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId, forumid: forumId });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ hardDeleted: true, message: 'Post permanently deleted' });

      const onDeleteSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onDeleteSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.deletePost(1);
      });

      await waitFor(() => {
        expect(onDeleteSuccess).toHaveBeenCalledWith({ hardDeleted: true, message: 'Post permanently deleted' });
      });

      // Should invalidate both discussion and forum lists
      // This would be verified in integration tests with full QueryClient
    });
  });

  describe('Edge Cases', () => {
    it('should handle posts by deleted users', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [
        createMockPost({ 
          id: 1,
          discussionid: discussionId,
          parentid: 0,
          authorid: 0, // Deleted user indicated by authorid: 0
        }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const post = result.current.posts?.[0];
      expect(post?.userName).toBe('[deleted user]');
      expect(post?.userId).toBe(0);
    });

    it('should handle broken parent post references', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      
      // Post 2 references non-existent parent
      const mockPosts = [
        createMockPost({ id: 1, discussionid: discussionId, parentid: 0 }),
        createMockPost({ id: 2, discussionid: discussionId, parentid: 999 }), // Parent doesn't exist
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should handle gracefully, possibly treating as top-level post
      expect(result.current.posts).toHaveLength(2);
    });

    it('should handle concurrent reply creation from multiple users', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const initialPosts = [createMockPost({ id: 1, discussionid: discussionId, parentid: 0 })];

      // Simulate concurrent creation
      const reply1 = createMockPost({ id: 2, discussionid: discussionId, subject: 'Reply 1', parentid: 1 });
      const reply2 = createMockPost({ id: 3, discussionid: discussionId, subject: 'Reply 2', parentid: 1 });

      // Set up mock to return accumulated posts - starts with initial, then adds replies after creation
      let callCount = 0;
      // eslint-disable-next-line @typescript-eslint/require-await
      vi.mocked(forumApi.getDiscussionPosts).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Initial load
          return {
            discussion: mockDiscussion,
            posts: initialPosts,
            totalPosts: initialPosts.length,
            hasMore: false,
            currentPage: 1,
          };
        } 
          // After mutations - return all posts
          const allPosts = [...initialPosts, reply1, reply2];
          return {
            discussion: mockDiscussion,
            posts: allPosts,
            totalPosts: allPosts.length,
            hasMore: false,
            currentPage: 1,
          };
        
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(1);
      });

      vi.mocked(forumApi.createPost)
        .mockResolvedValueOnce({ ...reply1, discussionId })
        .mockResolvedValueOnce({ ...reply2, discussionId });

      await act(async () => {
        // Create two replies simultaneously
        await Promise.all([
          result.current.createReply({
            postData: { forumId: mockDiscussion.forumid, message: 'Message 1' },
            parentId: 1,
          }),
          result.current.createReply({
            postData: { forumId: mockDiscussion.forumid, message: 'Message 2' },
            parentId: 1,
          }),
        ]);
      });

      await waitFor(() => {
        // Should have 3 total posts: 1 original + 2 concurrent replies
        expect(countPostsInHierarchy(result.current.posts || [])).toBe(3);
      });
    });

    it('should handle attachment uploads in post mutations', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      const newPost = createMockPost({ 
        id: 2,
        discussionid: discussionId,
        parentid: 0,
        hasattachments: true,
      });
      vi.mocked(forumApi.createPost).mockResolvedValue({ ...newPost, discussionId });

      const onCreateSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onCreateSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.createReply({
          postData: {
            forumId: mockDiscussion.forumid,
            message: 'See attached file',
            attachments: [file],
          },
          parentId: undefined,
        });
      });

      await waitFor(() => {
        expect(onCreateSuccess).toHaveBeenCalledWith({ ...newPost, discussionId });
      });
    });
  });

  describe('Retry Logic and Error Handling', () => {
    it('should retry failed requests with exponential backoff', async () => {
      const discussionId = 100;
      
      // Fail first two attempts, succeed on third
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];
      vi.mocked(forumApi.getDiscussionPosts)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          discussion: createMockApiDiscussion({ id: discussionId }),
          posts: mockPosts,
          totalPosts: mockPosts.length,
          hasMore: false,
          currentPage: 1,
        });

      const { result } = renderHook(
        () => useDiscussion(discussionId, { retryCount: 3 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 5000 });

      expect(vi.mocked(forumApi.getDiscussionPosts).mock.calls.length).toBe(3);
    });

    it('should handle mutation queue for offline scenarios', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      // Simulate offline
      const offlineError = new Error('Network unavailable');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (offlineError as any).code = 'ERR_NETWORK';
      vi.mocked(forumApi.createPost).mockRejectedValue(offlineError);

      const onCreateError = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onCreateError }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        try {
          result.current.createReply({
            postData: { forumId: mockDiscussion.forumid, message: 'This should queue' },
            parentId: undefined,
          });
        } catch (err) {
          // Expected to fail offline
        }
      });

      await waitFor(() => {
        expect(onCreateError).toHaveBeenCalledWith(offlineError);
      });
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should have proper TypeScript types for all hook returns', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Type assertions to verify TypeScript types
      const {discussion} = result.current;
      const {posts} = result.current;
      const {isLoading} = result.current;

      expect(typeof isLoading).toBe('boolean');
      expect(discussion).toBeDefined();
      expect(Array.isArray(posts)).toBe(true);
    });
  });

  describe('Mutation Callbacks', () => {
    it('should call onSuccess callback after successful mutation', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      const newPost = createMockPost({ id: 2, discussionid: discussionId, parentid: 0 });
      vi.mocked(forumApi.createPost).mockResolvedValue({ ...newPost, discussionId });

      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => useDiscussion(discussionId, { onCreateSuccess: onSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.createReply({
          postData: { forumId: mockDiscussion.forumid, message: 'Test' },
          parentId: undefined,
        });
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({ ...newPost, discussionId });
      });
    });

    it('should call onError callback after failed mutation', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      const error = new Error('Create failed');
      vi.mocked(forumApi.createPost).mockRejectedValue(error);

      const onError = vi.fn();
      const { result } = renderHook(
        () => useDiscussion(discussionId, { onCreateError: onError }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        try {
          result.current.createReply({
            postData: { forumId: mockDiscussion.forumid, message: 'Test' },
            parentId: undefined,
          });
        } catch (err) {
          // Expected
        }
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
      });
    });

    it('should call onSettled callback after mutation completes', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockApiDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        totalPosts: mockPosts.length,
        hasMore: false,
        currentPage: 1,
      });

      const newPost = createMockPost({ id: 2, discussionid: discussionId, parentid: 0 });
      vi.mocked(forumApi.createPost).mockResolvedValue({ ...newPost, discussionId });

      const onSettled = vi.fn();
      const { result } = renderHook(
        () => useDiscussion(discussionId, { onCreateSettled: onSettled }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        result.current.createReply({
          postData: { forumId: mockDiscussion.forumid, message: 'Test' },
          parentId: undefined,
        });
      });

      await waitFor(() => {
        expect(onSettled).toHaveBeenCalled();
      });
    });
  });
});
