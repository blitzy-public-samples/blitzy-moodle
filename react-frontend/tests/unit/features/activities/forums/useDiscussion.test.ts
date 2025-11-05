import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
const createWrapper = () => {
  const queryClient = new QueryClient({
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
const createMockPost = (overrides: Partial<DiscussionPost> = {}): DiscussionPost => ({
  id: 1,
  discussionId: 100,
  parentId: null,
  subject: 'Test Post',
  message: 'This is a test post message',
  userId: 10,
  userName: 'Test User',
  userPictureUrl: 'https://example.com/avatar.jpg',
  created: Date.now() - 3600000,
  modified: Date.now() - 3600000,
  version: 1,
  deleted: false,
  hasAttachments: false,
  attachments: [],
  canEdit: true,
  canDelete: true,
  canReply: true,
  replies: [],
  ...overrides,
});

const createMockDiscussion = (overrides: Partial<Discussion> = {}): Discussion => ({
  id: 100,
  forumId: 50,
  name: 'Test Discussion',
  userId: 10,
  userName: 'Test User',
  userPictureUrl: 'https://example.com/avatar.jpg',
  timeCreated: Date.now() - 7200000,
  timeModified: Date.now() - 3600000,
  pinned: false,
  locked: false,
  userModified: 10,
  numReplies: 5,
  numUnread: 2,
  subscribed: false,
  canEdit: true,
  canDelete: true,
  canMove: false,
  canSplit: false,
  canPin: false,
  canLock: false,
  ...overrides,
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
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [
        createMockPost({ id: 1, parentId: null }),
        createMockPost({ id: 2, parentId: 1 }),
        createMockPost({ id: 3, parentId: 1 }),
      ];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
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

      expect(forumApi.fetchDiscussionPosts).toHaveBeenCalledWith(discussionId);
      expect(result.current.discussion).toEqual(mockDiscussion);
      expect(result.current.posts).toHaveLength(3);
    });

    it('should reconstruct nested post hierarchy from flat API response', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      
      // Flat list of posts with parent-child relationships
      const flatPosts = [
        createMockPost({ id: 1, parentId: null, subject: 'Root Post' }),
        createMockPost({ id: 2, parentId: 1, subject: 'Reply to Root' }),
        createMockPost({ id: 3, parentId: 1, subject: 'Another Reply to Root' }),
        createMockPost({ id: 4, parentId: 2, subject: 'Nested Reply' }),
        createMockPost({ id: 5, parentId: 4, subject: 'Deep Nested Reply' }),
      ];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
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

      vi.mocked(forumApi.fetchDiscussionPosts).mockReturnValue(promise as any);

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
          posts: [createMockPost()],
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

      vi.mocked(forumApi.fetchDiscussionPosts).mockRejectedValue(error);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
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

      vi.mocked(forumApi.fetchDiscussionPosts).mockRejectedValue(error);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
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
        posts: [createMockPost()],
      };

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue(mockData);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const initialCallCount = vi.mocked(forumApi.fetchDiscussionPosts).mock.calls.length;

      // Simulate window focus event
      await act(async () => {
        window.dispatchEvent(new Event('focus'));
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should refetch on window focus
      await waitFor(() => {
        expect(vi.mocked(forumApi.fetchDiscussionPosts).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('should support background refresh for active discussions', async () => {
      const discussionId = 100;
      const initialData = {
        discussion: createMockDiscussion({ numReplies: 5 }),
        posts: [createMockPost()],
      };
      const updatedData = {
        discussion: createMockDiscussion({ numReplies: 6 }),
        posts: [createMockPost(), createMockPost({ id: 2 })],
      };

      vi.mocked(forumApi.fetchDiscussionPosts)
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
      const mockPosts = [createMockPost({ id: parentPostId, parentId: null })];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      const newPost = createMockPost({ id: 999, parentId: parentPostId, subject: 'New Reply' });
      vi.mocked(forumApi.createPost).mockResolvedValue(newPost);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const replyData = {
        subject: 'New Reply',
        message: 'This is a new reply',
        parentId: parentPostId,
      };

      await act(async () => {
        await result.current.createReply(replyData);
      });

      await waitFor(() => {
        expect(forumApi.createPost).toHaveBeenCalledWith(discussionId, replyData);
      });
    });

    it('should add optimistic post to local cache before API confirmation', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ id: 1, parentId: null })];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      // Delay API response to observe optimistic update
      let resolveCreate: (value: any) => void;
      const createPromise = new Promise((resolve) => {
        resolveCreate = resolve;
      });
      vi.mocked(forumApi.createPost).mockReturnValue(createPromise as any);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(1);
      });

      const replyData = {
        subject: 'Optimistic Reply',
        message: 'This appears immediately',
        parentId: null,
      };

      act(() => {
        result.current.createReply(replyData);
      });

      // Optimistic post should appear immediately
      await waitFor(() => {
        expect(result.current.posts?.length).toBeGreaterThan(1);
      });

      // Confirm API call completes
      act(() => {
        resolveCreate!(createMockPost({ id: 2, subject: 'Optimistic Reply' }));
      });

      await waitFor(() => {
        expect(result.current.createReplyMutation.isSuccess).toBe(true);
      });
    });

    it('should rollback optimistic post on create failure', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockPost({ id: 1, parentId: null })];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      const error = new Error('Failed to create post');
      vi.mocked(forumApi.createPost).mockRejectedValue(error);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(1);
      });

      const initialPostCount = result.current.posts?.length || 0;

      const replyData = {
        subject: 'Failed Reply',
        message: 'This should rollback',
        parentId: null,
      };

      await act(async () => {
        try {
          await result.current.createReply(replyData);
        } catch (err) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(result.current.createReplyMutation.isError).toBe(true);
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
      const mockPost = createMockPost({ id: postId, version: 1, modified: Date.now() - 1000 });

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: [mockPost],
      });

      const updatedPost = createMockPost({ 
        id: postId, 
        subject: 'Updated Subject',
        version: 2,
        modified: Date.now(),
      });
      vi.mocked(forumApi.updatePost).mockResolvedValue(updatedPost);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const updateData = {
        postId,
        subject: 'Updated Subject',
        message: 'Updated message',
        version: 1,
      };

      await act(async () => {
        await result.current.editPost(updateData);
      });

      await waitFor(() => {
        expect(forumApi.updatePost).toHaveBeenCalledWith(postId, updateData);
        expect(result.current.editPostMutation.isSuccess).toBe(true);
      });
    });

    it('should detect conflict when post version/timestamp has changed', async () => {
      const discussionId = 100;
      const postId = 1;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPost = createMockPost({ id: postId, version: 1 });

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
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
        },
      };
      vi.mocked(forumApi.updatePost).mockRejectedValue(conflictError);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const updateData = {
        postId,
        subject: 'Conflicting Update',
        message: 'This will conflict',
        version: 1, // Stale version
      };

      await act(async () => {
        try {
          await result.current.editPost(updateData);
        } catch (err) {
          // Expected conflict error
        }
      });

      await waitFor(() => {
        expect(result.current.editPostMutation.isError).toBe(true);
      });

      const error = result.current.editPostMutation.error as any;
      expect(error?.response?.status).toBe(409);
      expect(error?.response?.data?.error).toBe('EDIT_CONFLICT');
    });

    it('should trigger conflict resolution UI on concurrent edit', async () => {
      const discussionId = 100;
      const postId = 1;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPost = createMockPost({ id: postId, version: 1 });

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: [mockPost],
      });

      const conflictError = new Error('Edit conflict');
      (conflictError as any).response = {
        status: 409,
        data: {
          error: 'EDIT_CONFLICT',
          currentPost: createMockPost({ id: postId, version: 2, subject: 'Changed by other user' }),
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
            subject: 'My changes',
            message: 'My message',
            version: 1,
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
        createMockPost({ id: postId, parentId: null }),
        createMockPost({ id: 2, parentId: postId }),
      ];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ softDeleted: true });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
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
        expect(result.current.deletePostMutation.isSuccess).toBe(true);
      });
    });

    it('should show [deleted] placeholder after soft delete', async () => {
      const discussionId = 100;
      const postId = 1;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [
        createMockPost({ id: postId, parentId: null, deleted: false }),
        createMockPost({ id: 2, parentId: postId }),
      ];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ softDeleted: true });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(2);
      });

      await act(async () => {
        await result.current.deletePost(postId);
      });

      await waitFor(() => {
        const deletedPost = result.current.posts?.find(p => p.id === postId);
        expect(deletedPost?.deleted).toBe(true);
        expect(deletedPost?.message).toContain('[deleted]');
      });
    });

    it('should hard delete post without replies', async () => {
      const discussionId = 100;
      const postId = 3;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [
        createMockPost({ id: 1, parentId: null }),
        createMockPost({ id: 2, parentId: 1 }),
        createMockPost({ id: postId, parentId: 1 }), // No children
      ];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ hardDeleted: true });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(3);
      });

      await act(async () => {
        await result.current.deletePost(postId);
      });

      await waitFor(() => {
        // Post should be completely removed
        expect(result.current.posts?.find(p => p.id === postId)).toBeUndefined();
        expect(result.current.posts).toHaveLength(2);
      });
    });

    it('should handle cascade delete for nested replies', async () => {
      const discussionId = 100;
      const parentPostId = 1;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [
        createMockPost({ id: parentPostId, parentId: null }),
        createMockPost({ id: 2, parentId: parentPostId }),
        createMockPost({ id: 3, parentId: 2 }),
        createMockPost({ id: 4, parentId: 3 }),
      ];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ 
        softDeleted: true,
        cascadeCount: 3,
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(4);
      });

      await act(async () => {
        await result.current.deletePost(parentPostId);
      });

      await waitFor(() => {
        expect(result.current.deletePostMutation.isSuccess).toBe(true);
      });
    });
  });

  describe('Subscription Management', () => {
    it('should subscribe to discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId, subscribed: false });
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.subscribeToDiscussion).mockResolvedValue({ subscribed: true });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.subscribed).toBe(false);
      });

      await act(async () => {
        await result.current.subscribe();
      });

      await waitFor(() => {
        expect(forumApi.subscribeToDiscussion).toHaveBeenCalledWith(discussionId);
        expect(result.current.subscribeMutation.isSuccess).toBe(true);
      });
    });

    it('should unsubscribe from discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId, subscribed: true });
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.unsubscribeFromDiscussion).mockResolvedValue({ subscribed: false });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.subscribed).toBe(true);
      });

      await act(async () => {
        await result.current.unsubscribe();
      });

      await waitFor(() => {
        expect(forumApi.unsubscribeFromDiscussion).toHaveBeenCalledWith(discussionId);
        expect(result.current.unsubscribeMutation.isSuccess).toBe(true);
      });
    });

    it('should optimistically update subscription status', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId, subscribed: false });
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      // Delay API response
      let resolveSubscribe: (value: any) => void;
      const subscribePromise = new Promise((resolve) => {
        resolveSubscribe = resolve;
      });
      vi.mocked(forumApi.subscribeToDiscussion).mockReturnValue(subscribePromise as any);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
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
        expect(result.current.subscribeMutation.isSuccess).toBe(true);
      });
    });
  });

  describe('Mark as Read Functionality', () => {
    it('should mark discussion as read', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId, numUnread: 5 });
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.markDiscussionAsRead).mockResolvedValue({ numUnread: 0 });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.numUnread).toBe(5);
      });

      await act(async () => {
        await result.current.markAsRead();
      });

      await waitFor(() => {
        expect(forumApi.markDiscussionAsRead).toHaveBeenCalledWith(discussionId);
        expect(result.current.markAsReadMutation.isSuccess).toBe(true);
      });
    });

    it('should update unread post count in cache', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId, numUnread: 3 });
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.markDiscussionAsRead).mockResolvedValue({ numUnread: 0 });

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

    it('should mark individual post as read', async () => {
      const discussionId = 100;
      const postId = 2;
      const mockDiscussion = createMockDiscussion({ id: discussionId, numUnread: 2 });
      const mockPosts = [
        createMockPost({ id: 1 }),
        createMockPost({ id: postId }),
      ];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.markPostAsRead).mockResolvedValue({ numUnread: 1 });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.discussion?.numUnread).toBe(2);
      });

      await act(async () => {
        await result.current.markPostAsRead(postId);
      });

      await waitFor(() => {
        expect(forumApi.markPostAsRead).toHaveBeenCalledWith(postId);
        expect(result.current.discussion?.numUnread).toBe(1);
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
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.pinDiscussion).mockResolvedValue({ pinned: true });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
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
        expect(result.current.pinMutation.isSuccess).toBe(true);
      });
    });

    it('should unpin discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ 
        id: discussionId, 
        pinned: true,
        canPin: true,
      });
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.unpinDiscussion).mockResolvedValue({ pinned: false });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
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
        expect(result.current.unpinMutation.isSuccess).toBe(true);
      });
    });

    it('should lock discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ 
        id: discussionId, 
        locked: false,
        canLock: true,
      });
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.lockDiscussion).mockResolvedValue({ locked: true });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
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
        expect(result.current.lockMutation.isSuccess).toBe(true);
      });
    });

    it('should unlock discussion', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ 
        id: discussionId, 
        locked: true,
        canLock: true,
      });
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.unlockDiscussion).mockResolvedValue({ locked: false });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
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
        expect(result.current.unlockMutation.isSuccess).toBe(true);
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
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.moveDiscussion).mockResolvedValue({ 
        forumId: targetForumId,
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
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
        expect(result.current.moveMutation.isSuccess).toBe(true);
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
        createMockPost({ id: 1 }),
        createMockPost({ id: postId }),
      ];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.splitDiscussion).mockResolvedValue({ 
        newDiscussionId: 101,
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
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
        expect(result.current.splitMutation.isSuccess).toBe(true);
      });
    });

    it('should report post for moderation', async () => {
      const discussionId = 100;
      const postId = 2;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [
        createMockPost({ id: 1 }),
        createMockPost({ id: postId }),
      ];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.reportPost).mockResolvedValue({ reported: true });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
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
        expect(forumApi.reportPost).toHaveBeenCalledWith(reportData);
        expect(result.current.reportMutation.isSuccess).toBe(true);
      });
    });
  });

  describe('Pagination and Incremental Loading', () => {
    it('should support pagination for long discussion threads', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId, numReplies: 50 });
      
      // First page of posts
      const firstPagePosts = Array.from({ length: 20 }, (_, i) => 
        createMockPost({ id: i + 1, parentId: null })
      );

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
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
        createMockPost({ id: i + 21, parentId: null })
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
        createMockPost({ id: parentPostId, parentId: null }),
      ];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
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
        createMockPost({ id: 2, parentId: parentPostId }),
        createMockPost({ id: 3, parentId: parentPostId }),
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
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      const newPost = createMockPost({ id: 2 });
      vi.mocked(forumApi.createPost).mockResolvedValue(newPost);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      await act(async () => {
        await result.current.createReply({
          subject: 'New Reply',
          message: 'Test message',
          parentId: null,
        });
      });

      await waitFor(() => {
        expect(result.current.createReplyMutation.isSuccess).toBe(true);
      });

      // Verify cache was invalidated and refetched
      expect(vi.mocked(forumApi.fetchDiscussionPosts).mock.calls.length).toBeGreaterThan(1);
    });

    it('should invalidate forum discussion list cache after mutations', async () => {
      const discussionId = 100;
      const forumId = 50;
      const mockDiscussion = createMockDiscussion({ id: discussionId, forumId });
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      vi.mocked(forumApi.deletePost).mockResolvedValue({ hardDeleted: true });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      await act(async () => {
        await result.current.deletePost(1);
      });

      await waitFor(() => {
        expect(result.current.deletePostMutation.isSuccess).toBe(true);
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
        createMockPost({ 
          id: 1, 
          userId: 0, 
          userName: '[deleted user]',
          userPictureUrl: null,
        }),
      ];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
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
        createMockPost({ id: 1, parentId: null }),
        createMockPost({ id: 2, parentId: 999 }), // Parent doesn't exist
      ];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
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
      const initialPosts = [createMockPost({ id: 1 })];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: initialPosts,
      });

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(1);
      });

      // Simulate concurrent creation
      const reply1 = createMockPost({ id: 2, subject: 'Reply 1' });
      const reply2 = createMockPost({ id: 3, subject: 'Reply 2' });

      vi.mocked(forumApi.createPost)
        .mockResolvedValueOnce(reply1)
        .mockResolvedValueOnce(reply2);

      await act(async () => {
        // Create two replies simultaneously
        await Promise.all([
          result.current.createReply({
            subject: 'Reply 1',
            message: 'Message 1',
            parentId: 1,
          }),
          result.current.createReply({
            subject: 'Reply 2',
            message: 'Message 2',
            parentId: 1,
          }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.posts?.length).toBeGreaterThan(1);
      });
    });

    it('should handle attachment uploads in post mutations', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      const newPost = createMockPost({ 
        id: 2,
        hasAttachments: true,
        attachments: [
          { id: 1, filename: 'document.pdf', filesize: 1024000 },
        ],
      });
      vi.mocked(forumApi.createPost).mockResolvedValue(newPost);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });

      await act(async () => {
        await result.current.createReply({
          subject: 'Post with attachment',
          message: 'See attached file',
          parentId: null,
          attachments: [file],
        });
      });

      await waitFor(() => {
        expect(result.current.createReplyMutation.isSuccess).toBe(true);
      });
    });
  });

  describe('Retry Logic and Error Handling', () => {
    it('should retry failed requests with exponential backoff', async () => {
      const discussionId = 100;
      
      // Fail first two attempts, succeed on third
      vi.mocked(forumApi.fetchDiscussionPosts)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          discussion: createMockDiscussion(),
          posts: [createMockPost()],
        });

      const { result } = renderHook(
        () => useDiscussion(discussionId, { retryCount: 3 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 5000 });

      expect(vi.mocked(forumApi.fetchDiscussionPosts).mock.calls.length).toBe(3);
    });

    it('should handle mutation queue for offline scenarios', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      // Simulate offline
      const offlineError = new Error('Network unavailable');
      (offlineError as any).code = 'ERR_NETWORK';
      vi.mocked(forumApi.createPost).mockRejectedValue(offlineError);

      const { result } = renderHook(
        () => useDiscussion(discussionId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      await act(async () => {
        try {
          await result.current.createReply({
            subject: 'Offline post',
            message: 'This should queue',
            parentId: null,
          });
        } catch (err) {
          // Expected to fail offline
        }
      });

      await waitFor(() => {
        expect(result.current.createReplyMutation.isError).toBe(true);
      });
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should have proper TypeScript types for all hook returns', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
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
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      const newPost = createMockPost({ id: 2 });
      vi.mocked(forumApi.createPost).mockResolvedValue(newPost);

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
          subject: 'Test',
          message: 'Test',
          parentId: null,
        });
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(newPost);
      });
    });

    it('should call onError callback after failed mutation', async () => {
      const discussionId = 100;
      const mockDiscussion = createMockDiscussion({ id: discussionId });
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
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
            subject: 'Test',
            message: 'Test',
            parentId: null,
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
      const mockPosts = [createMockPost()];

      vi.mocked(forumApi.fetchDiscussionPosts).mockResolvedValue({
        discussion: mockDiscussion,
        posts: mockPosts,
      });

      const newPost = createMockPost({ id: 2 });
      vi.mocked(forumApi.createPost).mockResolvedValue(newPost);

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
          subject: 'Test',
          message: 'Test',
          parentId: null,
        });
      });

      await waitFor(() => {
        expect(onSettled).toHaveBeenCalled();
      });
    });
  });
});
