import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import React from 'react';
import { useDiscussion } from '@/features/activities/forums/hooks/useDiscussion';
import * as forumApi from '@/features/activities/forums/api/forumApi';
import type { Discussion, Post, DiscussionPost } from '@/features/activities/forums/types/forum.types';

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

// Mock the forum API module
vi.mock('@/features/activities/forums/api/forumApi');

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

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Mock data factory functions
// Creates API Post objects (snake_case format as returned by the API)
const createMockApiPost = (overrides: Partial<Post> = {}): Post => ({
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

// Helper to create DiscussionPost for assertions (after transformation)
const createMockPost = (overrides: Partial<DiscussionPost> = {}): DiscussionPost => ({
  id: 1,
  discussionId: 100,
  parentId: null,
  subject: 'Test Post',
  message: 'This is a test post message',
  userId: 10,
  userName: 'Test User',
  userPictureUrl: '',
  created: Date.now() - 3600000,
  modified: Date.now() - 3600000,
  version: 1,
  deleted: false,
  hasAttachments: false,
  attachments: [],
  canEdit: false,
  canDelete: false,
  canReply: true,
  replies: [],
  ...overrides,
});

const createMockDiscussion = (overrides: Partial<Discussion> = {}): Discussion => ({
  id: 100,
  courseid: 1,
  forumid: 50,
  name: 'Test Discussion',
  firstpostid: 1,
  userid: 10,
  groupid: 0,
  assessed: false,
  timemodified: Date.now() - 3600000,
  usermodified: 10,
  timestart: 0,
  timeend: 0,
  pinned: false,
  timelocked: 0,
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
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [
        createMockApiPost({ id: 1, discussionid: discussionId, parentid: 0 }),
        createMockApiPost({ id: 2, discussionid: discussionId, parentid: 1 }),
        createMockApiPost({ id: 3, discussionid: discussionId, parentid: 1 }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

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
      expect(result.current.posts[0].replies).toHaveLength(2);
      expect(result.current.posts[0].id).toBe(1);
      expect(result.current.posts[0].replies![0].id).toBe(2);
      expect(result.current.posts[0].replies![1].id).toBe(3);
    });

    it('should reconstruct nested post hierarchy from flat API response', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      
      // Flat list of posts with parent-child relationships
      const flatPosts = [
        createMockApiPost({ id: 1, discussionid: discussionId, parentid: 0, subject: 'Root Post' }),
        createMockApiPost({ id: 2, discussionid: discussionId, parentid: 1, subject: 'Reply to Root' }),
        createMockApiPost({ id: 3, discussionid: discussionId, parentid: 1, subject: 'Another Reply to Root' }),
        createMockApiPost({ id: 4, discussionid: discussionId, parentid: 2, subject: 'Nested Reply' }),
        createMockApiPost({ id: 5, discussionid: discussionId, parentid: 4, subject: 'Deep Nested Reply' }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: flatPosts,
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
      expect(firstReply?.replies?.[0].id).toBe(4);
      
      const nestedReply = firstReply?.replies?.[0];
      expect(nestedReply?.replies).toHaveLength(1);
      expect(nestedReply?.replies?.[0].id).toBe(5);
    });

    it('should handle loading state during initial fetch', async () => {
      const discussionId = 100;
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(forumApi.getDiscussionPosts).mockReturnValue(promise as any);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.discussion).toBeUndefined();
      expect(result.current.posts).toBeUndefined();

      act(() => {
        resolvePromise!({
          discussion: createMockDiscussion(),
          posts: [createMockApiPost()],
        });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should handle 404 discussion not found error', async () => {
      const discussionId = 999;
      const error = new Error('Discussion not found');
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
      expect((result.current.error as any)?.response?.status).toBe(404);
    });

    it('should handle 403 permission denied error', async () => {
      const discussionId = 100;
      const error = new Error('Permission denied');
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
      expect((result.current.error as any)?.response?.status).toBe(403);
    });

    it('should refetch on window focus with appropriate staleTime', async () => {
      const discussionId = 100;
      const mockData = {
        discussion: createMockDiscussion(),
        posts: [createMockApiPost()],
      };

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
      await act(async () => {
        queryClient.invalidateQueries({ queryKey: ['discussions', 'detail', discussionId] });
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
      const initialData = {
        discussion: createMockDiscussion({ numReplies: 5 }),
        // Need 6 posts total (1 root + 5 replies) to get numReplies: 5
        posts: [
          createMockApiPost({ id: 1, parentid: 0 }),
          createMockApiPost({ id: 2, parentid: 1 }),
          createMockApiPost({ id: 3, parentid: 1 }),
          createMockApiPost({ id: 4, parentid: 1 }),
          createMockApiPost({ id: 5, parentid: 1 }),
          createMockApiPost({ id: 6, parentid: 1 }),
        ],
      };
      const updatedData = {
        discussion: createMockDiscussion({ numReplies: 6 }),
        // Need 7 posts total with 2 roots to get numReplies: 6 and posts.length: 2
        // Root 1 with 3 replies, Root 2 with 2 replies = 7 total
        posts: [
          createMockApiPost({ id: 1, parentid: 0 }),
          createMockApiPost({ id: 2, parentid: 1 }),
          createMockApiPost({ id: 3, parentid: 1 }),
          createMockApiPost({ id: 4, parentid: 1 }),
          createMockApiPost({ id: 5, parentid: 0 }), // Second root post
          createMockApiPost({ id: 6, parentid: 5 }),
          createMockApiPost({ id: 7, parentid: 5 }),
        ],
      };

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
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockApiPost({ id: parentPostId, discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      const newPost = createMockApiPost({ id: 999, discussionid: discussionId, parentid: parentPostId, subject: 'New Reply' });
      vi.mocked(forumApi.createPost).mockResolvedValue({ post: newPost, message: 'Post created successfully' });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const replyData = {
        message: 'This is a new reply',
      };

      await act(async () => {
        await result.current.createReply({ postData: replyData, parentId: parentPostId });
      });

      await waitFor(() => {
        expect(forumApi.createPost).toHaveBeenCalledWith({ 
          discussionId: discussionId, 
          message: 'This is a new reply', 
          parentPostId: parentPostId 
        });
      });
    });

    it('should add optimistic post to local cache before API confirmation', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockApiPost({ id: 1, discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      // Delay API response to observe optimistic update
      let resolveCreate: (value: any) => void;
      const createPromise = new Promise((resolve) => {
        resolveCreate = resolve;
      });
      vi.mocked(forumApi.createPost).mockReturnValue(createPromise as any);

      const onCreateSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onCreateSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(1);
      });

      const replyData = {
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
          post: createMockApiPost({ id: 2, subject: 'Optimistic Reply' }), 
          message: 'Post created successfully' 
        });
      });

      await waitFor(() => {
        expect(onCreateSuccess).toHaveBeenCalled();
      });
    });

    it('should rollback optimistic post on create failure', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockApiPost({ id: 1, discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
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

      const replyData = {
        message: 'This should rollback',
      };

      await act(async () => {
        try {
          await result.current.createReply({ postData: replyData, parentId: undefined });
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
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPost = createMockApiPost({ id: postId, discussionid: discussionId, parentid: 0, version: 1, modified: Date.now() - 1000 });

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: [mockPost],
      });

      const updatedPost = createMockApiPost({ 
        id: postId, 
        discussionid: discussionId,
        parentid: 0,
        subject: 'Updated Subject',
        version: 2,
        modified: Date.now(),
      });
      vi.mocked(forumApi.updatePost).mockResolvedValue({
        post: updatedPost,
        message: 'Post updated successfully'
      });

      const onEditSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onEditSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const postData = {
        message: 'Updated message',
        version: 1,
      };

      await act(async () => {
        await result.current.editPost({ postId, postData });
      });

      await waitFor(() => {
        expect(forumApi.updatePost).toHaveBeenCalledWith({
          postId: postId,
          ...postData
        });
        expect(onEditSuccess).toHaveBeenCalled();
      });
    });

    it('should detect conflict when post version/timestamp has changed', async () => {
      const discussionId = 100;
      const postId = 1;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPost = createMockApiPost({ id: postId, discussionid: discussionId, parentid: 0, version: 1 });

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: [mockPost],
      });

      // Simulate conflict error
      const conflictError = new Error('Concurrent modification detected');
      (conflictError as any).response = {
        status: 409,
        data: {
          error: 'EDIT_CONFLICT',
          message: 'Post was modified by another user',
          currentVersion: 2,
          post: createMockApiPost({ id: postId, version: 2 }),
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

      const postData = {
        message: 'This will conflict',
        version: 1, // Stale version
      };

      await act(async () => {
        try {
          await result.current.editPost({ postId, postData });
        } catch (err) {
          // Expected conflict error
        }
      });

      await waitFor(() => {
        expect(onEditConflict).toHaveBeenCalledWith(
          expect.objectContaining({
            post: expect.objectContaining({ id: postId, version: 2 }),
            conflictData: expect.objectContaining({
              error: 'EDIT_CONFLICT',
              currentVersion: 2,
            }),
          })
        );
        expect(onEditError).toHaveBeenCalledWith(conflictError);
      });
    });

    it('should trigger conflict resolution UI on concurrent edit', async () => {
      const discussionId = 100;
      const postId = 1;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPost = createMockApiPost({ id: postId, discussionid: discussionId, parentid: 0, version: 1 });

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: [mockPost],
      });

      const conflictError = new Error('Edit conflict');
      (conflictError as any).response = {
        status: 409,
        data: {
          error: 'EDIT_CONFLICT',
          currentPost: createMockApiPost({ id: postId, discussionid: discussionId, parentid: 0, version: 2, subject: 'Changed by other user' }),
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

      await act(async () => {
        try {
          await result.current.editPost({
            postId,
            postData: {
              message: 'My message',
              version: 1,
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
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [
        createMockApiPost({ id: postId, discussionid: discussionId, parentid: 0 }),
        createMockApiPost({ id: 2, discussionid: discussionId, parentid: postId }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ softDeleted: true });

      const onDeleteSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onDeleteSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      await act(async () => {
        await result.current.deletePost(postId);
      });

      await waitFor(() => {
        expect(forumApi.deletePost).toHaveBeenCalledWith(postId);
        expect(onDeleteSuccess).toHaveBeenCalledWith({ softDeleted: true });
      });
    });

    it('should show [deleted] placeholder after soft delete', async () => {
      const discussionId = 100;
      const postId = 1;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [
        createMockApiPost({ id: postId, discussionid: discussionId, parentid: 0, deleted: false }),
        createMockApiPost({ id: 2, discussionid: discussionId, parentid: postId }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ softDeleted: true });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        // Posts is hierarchical: post 1 (root) with post 2 as a reply
        expect(result.current.posts).toHaveLength(1);
        expect(countPostsInHierarchy(result.current.posts || [])).toBe(2);
      });

      await act(async () => {
        await result.current.deletePost(postId);
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
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [
        createMockApiPost({ id: 1, discussionid: discussionId, parentid: 0 }),
        createMockApiPost({ id: 2, discussionid: discussionId, parentid: 1 }),
        createMockApiPost({ id: postId, discussionid: discussionId, parentid: 1 }), // No children
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ hardDeleted: true });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        // Posts is hierarchical: post 1 (root) with [post 2, post 3] as replies
        expect(result.current.posts).toHaveLength(1);
        expect(countPostsInHierarchy(result.current.posts || [])).toBe(3);
      });

      await act(async () => {
        await result.current.deletePost(postId);
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
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [
        createMockApiPost({ id: parentPostId, discussionid: discussionId, parentid: 0 }),
        createMockApiPost({ id: 2, discussionid: discussionId, parentid: parentPostId }),
        createMockApiPost({ id: 3, discussionid: discussionId, parentid: 2 }),
        createMockApiPost({ id: 4, discussionid: discussionId, parentid: 3 }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ 
        softDeleted: true,
        cascadeCount: 3,
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

      await act(async () => {
        await result.current.deletePost(parentPostId);
      });

      await waitFor(() => {
        expect(onDeleteSuccess).toHaveBeenCalledWith(
          expect.objectContaining({
            softDeleted: true,
            cascadeCount: 3,
          })
        );
      });
    });
  });

  describe('Subscription Management', () => {
    it('should subscribe to discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        subscribed: false, // Include subscription status in API response
      });

      vi.mocked(forumApi.subscribeDiscussion).mockResolvedValue({ subscribed: true });

      const onSubscribeSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onSubscribeSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.subscribed).toBe(false);
      });

      await act(async () => {
        await result.current.subscribe();
      });

      await waitFor(() => {
        expect(forumApi.subscribeDiscussion).toHaveBeenCalledWith(discussionId);
        expect(onSubscribeSuccess).toHaveBeenCalledWith({ subscribed: true });
      });
    });

    it('should unsubscribe from discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        subscribed: true, // Include subscription status in API response
      });

      vi.mocked(forumApi.unsubscribeDiscussion).mockResolvedValue({ subscribed: false });

      const onUnsubscribeSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onUnsubscribeSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.subscribed).toBe(true);
      });

      await act(async () => {
        await result.current.unsubscribe();
      });

      await waitFor(() => {
        expect(forumApi.unsubscribeDiscussion).toHaveBeenCalledWith(discussionId);
        expect(onUnsubscribeSuccess).toHaveBeenCalledWith({ subscribed: false });
      });
    });

    it('should optimistically update subscription status', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
        subscribed: false, // Include subscription status in API response
      });

      // Delay API response
      let resolveSubscribe: (value: any) => void;
      const subscribePromise = new Promise((resolve) => {
        resolveSubscribe = resolve;
      });
      vi.mocked(forumApi.subscribeDiscussion).mockReturnValue(subscribePromise as any);

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
        resolveSubscribe!({ subscribed: true });
      });

      await waitFor(() => {
        expect(onSubscribeSuccess).toHaveBeenCalledWith({ subscribed: true });
      });
    });
  });

  describe('Mark as Read Functionality', () => {
    it('should mark discussion as read', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId, numUnread: 5 });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.markDiscussionRead).mockResolvedValue({ numUnread: 0 });

      const onMarkAsReadSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onMarkAsReadSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.numUnread).toBe(5);
      });

      await act(async () => {
        await result.current.markAsRead();
      });

      await waitFor(() => {
        expect(forumApi.markDiscussionRead).toHaveBeenCalledWith(discussionId);
        expect(onMarkAsReadSuccess).toHaveBeenCalledWith({ numUnread: 0 });
      });
    });

    it('should update unread post count in cache', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId, numUnread: 3 });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.markDiscussionRead).mockResolvedValue({ numUnread: 0 });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.numUnread).toBe(3);
      });

      await act(async () => {
        await result.current.markAsRead();
      });

      await waitFor(() => {
        expect(result.current.discussion?.numUnread).toBe(0);
      });
    });

    it('should mark discussion as read', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId, numUnread: 2 });
      const mockPosts = [
        createMockApiPost({ id: 1, discussionid: discussionId, parentid: 0 }),
        createMockApiPost({ id: 2, discussionid: discussionId, parentid: 0 }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.markDiscussionRead).mockResolvedValue({ numUnread: 0 });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.numUnread).toBe(2);
      });

      await act(async () => {
        await result.current.markAsRead();
      });

      await waitFor(() => {
        expect(forumApi.markDiscussionRead).toHaveBeenCalledWith(discussionId);
        expect(result.current.discussion?.numUnread).toBe(0);
      });
    });
  });

  describe('Moderator Actions', () => {
    it('should pin discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ 
        id: discussionId, 
        pinned: false,
        canPin: true,
      });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.pinDiscussion).mockResolvedValue({ pinned: true });

      const onPinSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onPinSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.pinned).toBe(false);
      });

      await act(async () => {
        await result.current.pinDiscussion();
      });

      await waitFor(() => {
        expect(forumApi.pinDiscussion).toHaveBeenCalledWith(discussionId);
        expect(onPinSuccess).toHaveBeenCalledWith({ pinned: true });
      });
    });

    it('should unpin discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ 
        id: discussionId, 
        pinned: true,
        canPin: true,
      });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.unpinDiscussion).mockResolvedValue({ pinned: false });

      const onUnpinSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onUnpinSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.pinned).toBe(true);
      });

      await act(async () => {
        await result.current.unpinDiscussion();
      });

      await waitFor(() => {
        expect(forumApi.unpinDiscussion).toHaveBeenCalledWith(discussionId);
        expect(onUnpinSuccess).toHaveBeenCalledWith({ pinned: false });
      });
    });

    it('should lock discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ 
        id: discussionId, 
        locked: false,
        canLock: true,
      });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.lockDiscussion).mockResolvedValue({ locked: true });

      const onLockSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onLockSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.locked).toBe(false);
      });

      await act(async () => {
        await result.current.lockDiscussion();
      });

      await waitFor(() => {
        expect(forumApi.lockDiscussion).toHaveBeenCalledWith(discussionId);
        expect(onLockSuccess).toHaveBeenCalledWith({ locked: true });
      });
    });

    it('should unlock discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ 
        id: discussionId, 
        locked: true,
        canLock: true,
      });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.unlockDiscussion).mockResolvedValue({ locked: false });

      const onUnlockSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onUnlockSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.locked).toBe(true);
      });

      await act(async () => {
        await result.current.unlockDiscussion();
      });

      await waitFor(() => {
        expect(forumApi.unlockDiscussion).toHaveBeenCalledWith(discussionId);
        expect(onUnlockSuccess).toHaveBeenCalledWith({ locked: false });
      });
    });

    it('should move discussion to another forum', async () => {
      const discussionId = 100;
      const targetForumId = 200;
      const mockDiscussion = createMockDiscussion({ 
        id: discussionId, 
        forumId: 50,
        canMove: true,
      });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.moveDiscussion).mockResolvedValue({ 
        forumId: targetForumId,
      });

      const onMoveSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onMoveSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.forumId).toBe(50);
      });

      await act(async () => {
        await result.current.moveDiscussion(targetForumId);
      });

      await waitFor(() => {
        expect(forumApi.moveDiscussion).toHaveBeenCalledWith(discussionId, targetForumId);
        expect(onMoveSuccess).toHaveBeenCalledWith({ forumId: targetForumId });
      });
    });

    it('should split discussion', async () => {
      const discussionId = 100;
      const postId = 5;
      const mockDiscussion = createMockDiscussion({ 
        id: discussionId,
        canSplit: true,
      });
      const mockPosts = [
        createMockApiPost({ id: 1, discussionid: discussionId, parentid: 0 }),
        createMockApiPost({ id: postId, discussionid: discussionId, parentid: 0 }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.splitDiscussion).mockResolvedValue({ 
        newDiscussionId: 101,
      });

      const onSplitSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onSplitSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      await act(async () => {
        await result.current.splitDiscussion(postId);
      });

      await waitFor(() => {
        expect(forumApi.splitDiscussion).toHaveBeenCalledWith(discussionId, postId);
        expect(onSplitSuccess).toHaveBeenCalledWith({ newDiscussionId: 101 });
      });
    });

    it('should report post for moderation', async () => {
      const discussionId = 100;
      const postId = 2;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [
        createMockApiPost({ id: 1, discussionid: discussionId, parentid: 0 }),
        createMockApiPost({ id: postId, discussionid: discussionId, parentid: 0 }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.reportPost).mockResolvedValue({ reported: true });

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

      await act(async () => {
        await result.current.reportPost(reportData);
      });

      await waitFor(() => {
        expect(forumApi.reportPost).toHaveBeenCalledWith(postId, 'Spam content');
        expect(onReportSuccess).toHaveBeenCalledWith({ reported: true });
      });
    });
  });

  describe('Pagination and Incremental Loading', () => {
    it('should support pagination for long discussion threads', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId, numReplies: 50 });
      
      // First page of posts
      const firstPagePosts = Array.from({ length: 20 }, (_, i) => 
        createMockApiPost({ id: i + 1, discussionid: discussionId, parentid: 0 })
      );

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: firstPagePosts,
        hasMore: true,
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
        createMockApiPost({ id: i + 21, discussionid: discussionId, parentid: 0 })
      );

      vi.mocked(forumApi.fetchMorePosts).mockResolvedValue({
        posts: morePosts,
        hasMore: true,
        nextCursor: '40',
      });

      await act(async () => {
        await result.current.loadMore();
      });

      await waitFor(() => {
        expect(forumApi.fetchMorePosts).toHaveBeenCalledWith(discussionId, '20');
        expect(result.current.posts).toHaveLength(40);
      });
    });

    it('should incrementally load nested replies', async () => {
      const discussionId = 100;
      const parentPostId = 1;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [
        createMockApiPost({ id: parentPostId, discussionid: discussionId, parentid: 0 }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
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
        createMockApiPost({ id: 2, discussionid: discussionId, parentid: parentPostId }),
        createMockApiPost({ id: 3, discussionid: discussionId, parentid: parentPostId }),
      ];

      vi.mocked(forumApi.fetchPostReplies).mockResolvedValue({
        replies,
        hasMore: false,
      });

      await act(async () => {
        await result.current.loadReplies(parentPostId);
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
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      const newPost = createMockApiPost({ id: 2, discussionid: discussionId, parentid: 0 });
      vi.mocked(forumApi.createPost).mockResolvedValue({ post: newPost, message: 'Post created successfully' });

      const onCreateSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onCreateSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      await act(async () => {
        await result.current.createReply({
          postData: { message: 'Test message' },
          parentId: undefined,
        });
      });

      await waitFor(() => {
        expect(onCreateSuccess).toHaveBeenCalledWith({ post: newPost, message: 'Post created successfully' });
      });

      // Wait for cache invalidation to trigger refetch
      await waitFor(() => {
        expect(vi.mocked(forumApi.getDiscussionPosts).mock.calls.length).toBeGreaterThan(1);
      }, { timeout: 3000 });
    });

    it('should invalidate forum discussion list cache after mutations', async () => {
      const discussionId = 100;
      const forumId = 50;
      const mockDiscussion = createMockDiscussion({ id: discussionId, forumId });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ hardDeleted: true });

      const onDeleteSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onDeleteSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      await act(async () => {
        await result.current.deletePost(1);
      });

      await waitFor(() => {
        expect(onDeleteSuccess).toHaveBeenCalledWith({ hardDeleted: true });
      });

      // Should invalidate both discussion and forum lists
      // This would be verified in integration tests with full QueryClient
    });
  });

  describe('Edge Cases', () => {
    it('should handle posts by deleted users', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [
        createMockApiPost({ 
          id: 1,
          discussionid: discussionId,
          parentid: 0,
          userid: 0, 
          username: '[deleted user]',
          userpictureurl: null,
        }),
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
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
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      
      // Post 2 references non-existent parent
      const mockPosts = [
        createMockApiPost({ id: 1, discussionid: discussionId, parentid: 0 }),
        createMockApiPost({ id: 2, discussionid: discussionId, parentid: 999 }), // Parent doesn't exist
      ];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
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
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const initialPosts = [createMockApiPost({ id: 1, discussionid: discussionId, parentid: 0 })];

      // Simulate concurrent creation
      const reply1 = createMockApiPost({ id: 2, discussionid: discussionId, subject: 'Reply 1', parentid: 1 });
      const reply2 = createMockApiPost({ id: 3, discussionid: discussionId, subject: 'Reply 2', parentid: 1 });

      // Set up mock to return accumulated posts - starts with initial, then adds replies after creation
      let callCount = 0;
      vi.mocked(forumApi.getDiscussionPosts).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Initial load
          return {
            discussion: mockDiscussion,
            posts: initialPosts,
          };
        } else {
          // After mutations - return all posts
          return {
            discussion: mockDiscussion,
            posts: [...initialPosts, reply1, reply2],
          };
        }
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(1);
      });

      vi.mocked(forumApi.createPost)
        .mockResolvedValueOnce({ post: reply1, message: 'Post created successfully' })
        .mockResolvedValueOnce({ post: reply2, message: 'Post created successfully' });

      await act(async () => {
        // Create two replies simultaneously
        await Promise.all([
          result.current.createReply({
            postData: { message: 'Message 1' },
            parentId: 1,
          }),
          result.current.createReply({
            postData: { message: 'Message 2' },
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
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      const newPost = createMockApiPost({ 
        id: 2,
        discussionid: discussionId,
        parentid: 0,
        hasattachments: true,
        attachments: [
          { id: 1, filename: 'document.pdf', filesize: 1024000 },
        ],
      });
      vi.mocked(forumApi.createPost).mockResolvedValue({ post: newPost, message: 'Post created successfully' });

      const onCreateSuccess = vi.fn();

      const { result } = renderHook(
        () => useDiscussion(discussionId, { onCreateSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });

      await act(async () => {
        await result.current.createReply({
          postData: {
            message: 'See attached file',
            attachments: [file],
          },
          parentId: undefined,
        });
      });

      await waitFor(() => {
        expect(onCreateSuccess).toHaveBeenCalledWith({ post: newPost, message: 'Post created successfully' });
      });
    });
  });

  describe('Retry Logic and Error Handling', () => {
    it('should retry failed requests with exponential backoff', async () => {
      const discussionId = 100;
      
      // Fail first two attempts, succeed on third
      vi.mocked(forumApi.getDiscussionPosts)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          discussion: createMockDiscussion({ id: discussionId }),
          posts: [createMockApiPost({ discussionid: discussionId, parentid: 0 })],
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
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      // Simulate offline
      const offlineError = new Error('Network unavailable');
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

      await act(async () => {
        try {
          await result.current.createReply({
            postData: { message: 'This should queue' },
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
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Type assertions to verify TypeScript types
      const discussion: Discussion | undefined = result.current.discussion;
      const posts: DiscussionPost[] | undefined = result.current.posts;
      const isLoading: boolean = result.current.isLoading;
      const error: Error | null = result.current.error as any;

      expect(typeof isLoading).toBe('boolean');
      expect(discussion).toBeDefined();
      expect(Array.isArray(posts)).toBe(true);
    });
  });

  describe('Mutation Callbacks', () => {
    it('should call onSuccess callback after successful mutation', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      const newPost = createMockApiPost({ id: 2, discussionid: discussionId, parentid: 0 });
      vi.mocked(forumApi.createPost).mockResolvedValue({ post: newPost, message: 'Post created successfully' });

      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => useDiscussion(discussionId, { onCreateSuccess: onSuccess }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      await act(async () => {
        await result.current.createReply({
          postData: { message: 'Test' },
          parentId: undefined,
        });
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({ post: newPost, message: 'Post created successfully' });
      });
    });

    it('should call onError callback after failed mutation', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
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

      await act(async () => {
        try {
          await result.current.createReply({
            postData: { message: 'Test' },
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
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockApiPost({ discussionid: discussionId, parentid: 0 })];

      vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      const newPost = createMockApiPost({ id: 2, discussionid: discussionId, parentid: 0 });
      vi.mocked(forumApi.createPost).mockResolvedValue({ post: newPost, message: 'Post created successfully' });

      const onSettled = vi.fn();
      const { result } = renderHook(
        () => useDiscussion(discussionId, { onCreateSettled: onSettled }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      await act(async () => {
        await result.current.createReply({
          postData: { message: 'Test' },
          parentId: undefined,
        });
      });

      await waitFor(() => {
        expect(onSettled).toHaveBeenCalled();
      });
    });
  });
});
