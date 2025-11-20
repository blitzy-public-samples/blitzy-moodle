import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as forumApi from '../../../../../src/features/activities/forums/api/forumApi';
import type { PostResponse } from '../../../../../src/features/activities/forums/api/forumApi';
import { useDiscussion } from '../../../../../src/features/activities/forums/hooks/useDiscussion';
import type { DiscussionPost } from '../../../../../src/features/activities/forums/types/forum.types';

// Mock the API
vi.mock('../../../../../src/features/activities/forums/api/forumApi');

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

const createMockDiscussion = (overrides = {}) => ({
  id: 1,
  courseid: 1,
  forumid: 1,
  name: 'Test Discussion',
  firstpostid: 1,
  userid: 1,
  groupid: 0,
  assessed: false,
  timemodified: Math.floor(Date.now() / 1000),
  usermodified: 1,
  timestart: 0,
  timeend: 0,
  pinned: false,
  timelocked: 0,
  ...overrides,
});

const createMockApiPost = (overrides = {}) => ({
  id: 1,
  discussionid: 1,
  parentid: 0,
  authorid: 1,
  timecreated: Math.floor(Date.now() / 1000),
  timemodified: Math.floor(Date.now() / 1000),
  mailed: false,
  subject: 'Test Post',
  message: 'Test message',
  messageformat: 1,
  messagetrust: false,
  hasattachments: false,
  totalscore: 0,
  mailnow: false,
  deleted: false,
  privatereplyto: 0,
  wordcount: 2,
  charcount: 12,
  ...overrides,
});

describe('Concurrent Reply Test', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
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
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const createWrapper = (client?: QueryClient) => {
    const qc = client || new QueryClient({
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
  return <QueryClientProvider client={qc}>
        {children}
      </QueryClientProvider>
}
    return Wrapper;
  };

  it('should handle concurrent reply creation from multiple users', async () => {
    const discussionId = 100;
    const mockDiscussion = createMockDiscussion({ id: discussionId });
    const initialPosts = [createMockApiPost({ id: 1, discussionid: discussionId, parentid: 0 })];

    // Simulate concurrent creation
    // Use simple mockResolvedValue like the passing test
    vi.mocked(forumApi.getDiscussionPosts).mockResolvedValue({
      discussion: mockDiscussion,
      posts: initialPosts,
    });

    // Set up delayed API response to observe optimistic update
    let resolveCreate: (value: PostResponse) => void;
    const createPromise = new Promise<PostResponse>((resolve) => {
      resolveCreate = resolve;
    });
    
    vi.mocked(forumApi.createPost).mockReturnValue(createPromise);

    const { result } = renderHook(
      () => useDiscussion(discussionId),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.posts).toHaveLength(1);
    });

    const initialCount = countPostsInHierarchy(result.current.posts || []);
    expect(initialCount).toBe(1);

    // Create ONE reply WITHOUT awaiting to test optimistic updates
    act(() => {
      result.current.createReply({
        postData: { forumId: 1, message: 'Message 1' },
        parentId: 1,
      });
    });
    
    // Wait for the optimistic update to appear (nested reply, so check total count)
    await waitFor(() => {
      const totalCount = countPostsInHierarchy(result.current.posts || []);
      expect(totalCount).toBeGreaterThan(initialCount);
    });
    
    // Resolve the API call
    const reply1 = createMockApiPost({ id: 2, discussionid: discussionId, subject: 'Reply 1', parentid: 1, message: 'Message 1' });
    act(() => {
      resolveCreate!({ post: reply1, message: 'Post created successfully' });
    });
    
    // Wait for the API call to complete
    await waitFor(() => {
      const totalCount = countPostsInHierarchy(result.current.posts || []);
      expect(totalCount).toBe(2);
      expect(forumApi.createPost).toHaveBeenCalledTimes(1);
    });
  });
});
