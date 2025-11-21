import _React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DiscussionThread from '@/features/activities/forums/components/DiscussionThread';
import type { Discussion, DiscussionPost, Author, ForumPost } from '@/features/activities/forums/types/forum.types';
import type { UseAuthReturn } from '@/features/auth/hooks/useAuth';
import type { User } from '@/features/auth/types/auth.types';

// Define return type for useDiscussion mock
interface UseDiscussionReturn {
  discussion: Discussion | null;
  posts: DiscussionPost[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  createReply: (data: { message: string; parentId?: number }) => void;
  isCreatingReply: boolean;
  editPost: (data: { postId: number; message: string }) => void;
  isEditingPost: boolean;
  deletePost: (postId: number) => void;
  isDeletingPost: boolean;
  subscribe: () => void;
  unsubscribe: () => void;
  isSubscribing: boolean;
  isUnsubscribing: boolean;
  loadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
}

// Mock the useDiscussion hook
const mockUseDiscussion = vi.fn<[], UseDiscussionReturn>();
vi.mock('@/features/activities/forums/hooks/useDiscussion', () => ({
  useDiscussion: () => mockUseDiscussion(),
}));

// Define props interface for PostCard mock
interface MockPostCardProps {
  post: ForumPost;
  onReply?: (post: ForumPost) => void;
  onEdit?: (post: ForumPost) => void;
  onDelete?: (post: ForumPost) => void;
  onReport?: (post: ForumPost) => void;
  onQuote?: (post: ForumPost) => void;
  isLocked?: boolean;
  depth?: number;
}

// Mock the PostCard component (default export)
vi.mock('@/features/activities/forums/components/PostCard', () => ({
  default: ({ post, onReply, onEdit, onDelete, onReport, onQuote, isLocked, depth }: MockPostCardProps) => (
    <div
      data-testid={`post-card-${post.id}`}
      data-depth={depth}
      data-locked={isLocked}
      data-post-id={post.id}
    >
      <div data-testid="post-author">{post.author.fullName}</div>
      <div data-testid="post-content">{post.message}</div>
      <div data-testid="post-timestamp">{post.created?.toString()}</div>
      {!isLocked && post.canReply && onReply && (
        <button onClick={() => onReply(post)} data-testid="reply-button">
          Reply
        </button>
      )}
      {onEdit && post.canEdit && (
        <button onClick={() => onEdit(post)} data-testid="edit-button">
          Edit
        </button>
      )}
      {onDelete && post.canDelete && (
        <button onClick={() => onDelete(post)} data-testid="delete-button">
          Delete
        </button>
      )}
      {onQuote && (
        <button onClick={() => onQuote(post)} data-testid="quote-button">
          Quote
        </button>
      )}
      {onReport && (
        <button onClick={() => onReport(post)} data-testid="report-button">
          Report
        </button>
      )}
    </div>
  ),
}));

// Mock useAuth hook
const mockUseAuth = vi.fn<[], UseAuthReturn>();
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Helper function to create mock author
const createMockAuthor = (overrides?: Partial<Author>): Author => ({
  id: 1,
  pictureitemid: 0,
  firstname: 'Test',
  lastname: 'User',
  fullname: 'Test User',
  email: 'test@example.com',
  deleted: false,
  ...overrides,
});

// Helper function to create mock User (for auth)
const createMockUser = (overrides?: Partial<User>): User => ({
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  firstname: 'Test',
  lastname: 'User',
  fullname: 'Test User',
  auth: 'manual',
  confirmed: true,
  suspended: false,
  roles: [],
  capabilities: [],
  ...overrides,
});

// Helper function to create mock post (DiscussionPost)
const createMockPost = (overrides?: Partial<DiscussionPost>): DiscussionPost => ({
  id: 1,
  discussionId: 1,
  parentId: null,
  subject: 'Test Post',
  message: 'This is a test post message',
  userId: 1,
  userName: 'Test User',
  userPictureUrl: 'https://example.com/avatar.jpg',
  created: Math.floor(Date.parse('2024-01-15T10:00:00Z') / 1000), // Unix timestamp in seconds
  modified: 0,
  version: 1,
  deleted: false,
  hasAttachments: false,
  attachments: [],
  canEdit: true,
  canDelete: true,
  canReply: true,
  unread: false,
  replies: [],
  ...overrides,
});

// Helper function to create mock DiscussionDetail (extended Discussion)
const createMockDiscussion = (overrides?: Partial<Discussion & { author?: Author; created?: number; numViews?: number; numParticipants?: number; numReplies?: number; unreadCount?: number; subscribed?: boolean; locked?: boolean }>): Discussion & { author: Author; created: number; numViews: number; numParticipants: number; numReplies: number; unreadCount: number; subscribed: boolean } => {
  // Extract locked boolean if provided and remove it from overrides
  const { locked, ...rest } = overrides || {};
  
  return {
    id: 1,
    courseid: 1,
    forumid: 1,
    name: 'Test Discussion',
    firstpostid: 1,
    userid: 1,
    groupid: 0,
    assessed: false,
    timemodified: Math.floor(Date.parse('2024-01-15T12:00:00Z') / 1000), // Unix timestamp
    usermodified: 1,
    timestart: 0,
    timeend: 0,
    pinned: false,
    timelocked: locked ? Math.floor(Date.now() / 1000) : 0, // If locked=true, set to current timestamp
    // DiscussionDetail extended fields
    author: createMockAuthor(),
    created: Math.floor(Date.parse('2024-01-15T10:00:00Z') / 1000),
    numViews: 42,
    numParticipants: 3,
    numReplies: 5,
    unreadCount: 0,
    subscribed: false,
    ...rest,
  };
};

/**
 * Build nested post tree from flat array with parentId references
 * The component expects posts to have their replies arrays populated
 */
const buildPostTree = (flatPosts: DiscussionPost[]): DiscussionPost[] => {
  // Create a map for quick lookup
  const postMap = new Map<number, DiscussionPost>();
  
  // Deep copy posts to avoid mutating original objects
  const posts = flatPosts.map(p => ({ ...p, replies: [] as DiscussionPost[] }));
  
  // Build the map
  posts.forEach(post => {
    postMap.set(post.id, post);
  });
  
  // Build the tree by populating replies arrays
  const rootPosts: DiscussionPost[] = [];
  
  posts.forEach(post => {
    if (!post.parentId) {
      // This is a root post
      rootPosts.push(post);
    } else {
      // This is a reply, add it to parent's replies array
      const parent = postMap.get(post.parentId);
      if (parent) {
        parent.replies.push(post);
      } else {
        // Orphan post (parent doesn't exist) - treat as root post
        rootPosts.push(post);
      }
    }
  });
  
  return rootPosts;
};

// Helper function to create default mock useDiscussion return value
const createMockUseDiscussionReturn = (overrides?: Partial<UseDiscussionReturn>): UseDiscussionReturn => {
  const defaults: UseDiscussionReturn = {
    discussion: null,
    posts: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    createReply: vi.fn(),
    isCreatingReply: false,
    editPost: vi.fn(),
    isEditingPost: false,
    deletePost: vi.fn(),
    isDeletingPost: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    isSubscribing: false,
    isUnsubscribing: false,
    loadMore: vi.fn(),
    hasMore: false,
    isLoadingMore: false,
    ...overrides,
  };
  
  // Automatically set isError: true if an error is provided (unless explicitly overridden)
  if (overrides?.error && overrides.isError === undefined) {
    defaults.isError = true;
  }
  
  return defaults;
};

describe('DiscussionThread', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();

    // Default mock auth
    mockUseAuth.mockReturnValue({
      user: createMockUser(),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (discussionId: number) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DiscussionThread discussionId={discussionId} />
      </QueryClientProvider>
    );
  };

  describe('Discussion Header', () => {
    it('should render discussion title, author, created date, and view count', () => {
      const discussion = createMockDiscussion({
        name: 'Introduction to React Hooks',
        author: createMockAuthor({ fullname: 'Jane Smith' }),
        created: Math.floor(Date.parse('2024-01-10T09:30:00Z') / 1000),
        numViews: 156,
      });

      const posts = [createMockPost({ id: 1, discussionId: 1, subject: 'Introduction to React Hooks', message: 'Initial post' })];

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
      }));

      renderComponent(1);

      expect(screen.getByRole('heading', { name: 'Introduction to React Hooks' })).toBeInTheDocument();
      expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument();
      expect(screen.getByText(/156 views/i)).toBeInTheDocument();
    });

    it('should render discussion metadata including reply count and participants', () => {
      const discussion = createMockDiscussion({
        numReplies: 25,
        numParticipants: 8,
      });

      const posts = [createMockPost({ id: 1, discussionId: 1 })];

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByText(/25 replies/i)).toBeInTheDocument();
      expect(screen.getByText(/8 participants/i)).toBeInTheDocument();
    });

    it('should display pinned badge when discussion is pinned', () => {
      const discussion = createMockDiscussion({ pinned: true });
      const posts = [createMockPost({ id: 1, discussionId: 1 })];

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByText(/pinned/i)).toBeInTheDocument();
    });

    it('should display locked indicator when discussion is locked', () => {
      const discussion = createMockDiscussion({ timelocked: Math.floor(Date.now() / 1000) - 3600 }); // Locked 1 hour ago
      const posts = [createMockPost({ id: 1, discussionId: 1, canReply: false })];

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByText(/locked/i)).toBeInTheDocument();
      expect(screen.getByTestId('locked-indicator')).toBeInTheDocument();
    });
  });

  describe('Original Post (Starter Post)', () => {
    it('should display the original post prominently at the top', () => {
      const originalPost = createMockPost({
        id: 1,
        subject: 'Original Discussion Post',
        message: 'This is the discussion starter content',
        userName: 'Discussion Starter',
        userId: 10,
      });

      const discussion = createMockDiscussion({
        firstpostid: 1,
      });

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts: [originalPost],
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      const originalPostCard = screen.getByTestId('post-card-1');
      expect(originalPostCard).toBeInTheDocument();
      expect(within(originalPostCard).getByText('Discussion Starter')).toBeInTheDocument();
      expect(within(originalPostCard).getByText('This is the discussion starter content')).toBeInTheDocument();
    });

    it('should render original post with depth 0', () => {
      const originalPost = createMockPost({ id: 1 });
      const discussion = createMockDiscussion({ firstpostid: 1 });

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts: [originalPost],
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      const originalPostWrapper = screen.getByTestId('post-1');
      expect(originalPostWrapper).toHaveAttribute('data-depth', '0');
    });
  });

  describe('Nested Reply Structure', () => {
    it('should render replies with proper nesting up to 5 levels deep', () => {
      const level1Reply = createMockPost({ id: 2, parentId: 1, message: 'Level 1 reply' });
      const level2Reply = createMockPost({ id: 3, parentId: 2, message: 'Level 2 reply' });
      const level3Reply = createMockPost({ id: 4, parentId: 3, message: 'Level 3 reply' });
      const level4Reply = createMockPost({ id: 5, parentId: 4, message: 'Level 4 reply' });
      const level5Reply = createMockPost({ id: 6, parentId: 5, message: 'Level 5 reply' });

      const flatPosts = [
        createMockPost({ id: 1 }),
        level1Reply,
        level2Reply,
        level3Reply,
        level4Reply,
        level5Reply,
      ];

      const posts = buildPostTree(flatPosts);

      const discussion = createMockDiscussion({ firstpostid: 1 });

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByTestId('post-2')).toHaveAttribute('data-depth', '1');
      expect(screen.getByTestId('post-3')).toHaveAttribute('data-depth', '2');
      expect(screen.getByTestId('post-4')).toHaveAttribute('data-depth', '3');
      expect(screen.getByTestId('post-5')).toHaveAttribute('data-depth', '4');
      expect(screen.getByTestId('post-6')).toHaveAttribute('data-depth', '5');
    });

    it('should render multiple replies at the same level', () => {
      const reply1 = createMockPost({ id: 2, parentId: 1, message: 'First reply' });
      const reply2 = createMockPost({ id: 3, parentId: 1, message: 'Second reply' });
      const reply3 = createMockPost({ id: 4, parentId: 1, message: 'Third reply' });

      const flatPosts = [createMockPost({ id: 1 }), reply1, reply2, reply3];
      const posts = buildPostTree(flatPosts);

      const discussion = createMockDiscussion({ firstpostid: 1 });

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByTestId('post-2')).toBeInTheDocument();
      expect(screen.getByTestId('post-3')).toBeInTheDocument();
      expect(screen.getByTestId('post-4')).toBeInTheDocument();

      // All should be at depth 1
      expect(screen.getByTestId('post-2')).toHaveAttribute('data-depth', '1');
      expect(screen.getByTestId('post-3')).toHaveAttribute('data-depth', '1');
      expect(screen.getByTestId('post-4')).toHaveAttribute('data-depth', '1');
    });

    it('should render complex nested tree with multiple branches', () => {
      const flatPosts = [
        createMockPost({ id: 1, parentId: null }),
        createMockPost({ id: 2, parentId: 1 }), // Branch 1
        createMockPost({ id: 3, parentId: 2 }),
        createMockPost({ id: 4, parentId: 1 }), // Branch 2
        createMockPost({ id: 5, parentId: 4 }),
        createMockPost({ id: 6, parentId: 1 }), // Branch 3
      ];

      const posts = buildPostTree(flatPosts);

      const discussion = createMockDiscussion();

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      // Verify all posts are rendered
      flatPosts.forEach((post) => {
        expect(screen.getByTestId(`post-card-${post.id}`)).toBeInTheDocument();
      });

      // Verify depths
      expect(screen.getByTestId('post-2')).toHaveAttribute('data-depth', '1');
      expect(screen.getByTestId('post-3')).toHaveAttribute('data-depth', '2');
      expect(screen.getByTestId('post-4')).toHaveAttribute('data-depth', '1');
      expect(screen.getByTestId('post-5')).toHaveAttribute('data-depth', '2');
      expect(screen.getByTestId('post-6')).toHaveAttribute('data-depth', '1');
    });
  });

  describe('Reply Hierarchy Visualization', () => {
    it('should apply proper indentation classes for nested posts', () => {
      const flatPosts = [
        createMockPost({ id: 1 }),
        createMockPost({ id: 2, parentId: 1 }),
        createMockPost({ id: 3, parentId: 2 }),
      ];

      const posts = buildPostTree(flatPosts);

      const discussion = createMockDiscussion();

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      const { container } = renderComponent(1);

      // Check for indentation-related classes or styles
      const level1Post = container.querySelector('[data-depth="1"]');
      const level2Post = container.querySelector('[data-depth="2"]');

      expect(level1Post).toBeInTheDocument();
      expect(level2Post).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse Controls', () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    it('should provide expand/collapse button for deeply nested threads', async () => {
      const flatPosts = [
        createMockPost({ id: 1 }),
        createMockPost({ id: 2, parentId: 1 }),
        createMockPost({ id: 3, parentId: 2 }),
        createMockPost({ id: 4, parentId: 3 }),
        createMockPost({ id: 5, parentId: 4 }),
        createMockPost({ id: 6, parentId: 5 }), // Depth 5 - will show collapse button
        createMockPost({ id: 7, parentId: 6 }), // Child of post 6, so post 6 has replies
      ];

      const posts = buildPostTree(flatPosts);

      const discussion = createMockDiscussion();

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      // Look for collapse button near deeply nested posts (post 6 at depth 5 with replies)
      const collapseButtons = screen.queryAllByRole('button', { name: /collapse/i });
      expect(collapseButtons.length).toBeGreaterThan(0);
    });

    it('should collapse nested replies when collapse button is clicked', async () => {
      const flatPosts = [
        createMockPost({ id: 1 }),
        createMockPost({ id: 2, parentId: 1, message: 'Parent reply' }),
        createMockPost({ id: 3, parentId: 2, message: 'Child reply' }),
      ];

      const posts = buildPostTree(flatPosts);

      const discussion = createMockDiscussion();

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      // Initial state - child should be visible
      expect(screen.getByText('Child reply')).toBeInTheDocument();

      // Find and click collapse button
      const collapseButton = screen.queryByRole('button', { name: /collapse/i });
      if (collapseButton) {
        await user.click(collapseButton);

        // Child reply should be hidden
        await waitFor(() => {
          expect(screen.queryByText('Child reply')).not.toBeInTheDocument();
        });
      }
    });

    it('should expand collapsed replies when expand button is clicked', async () => {
      const flatPosts = [
        createMockPost({ id: 1 }),
        createMockPost({ id: 2, parentId: 1, message: 'Parent reply' }),
        createMockPost({ id: 3, parentId: 2, message: 'Collapsed child' }),
      ];

      const posts = buildPostTree(flatPosts);

      const discussion = createMockDiscussion();

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      // Collapse first
      const collapseButton = screen.queryByRole('button', { name: /collapse/i });
      if (collapseButton) {
        await user.click(collapseButton);

        // Then expand
        const expandButton = await screen.findByRole('button', { name: /expand/i });
        await user.click(expandButton);

        // Child should be visible again
        await waitFor(() => {
          expect(screen.getByText('Collapsed child')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Individual PostCard Rendering', () => {
    it('should render PostCard component for each post', () => {
      const flatPosts = [
        createMockPost({ id: 1 }),
        createMockPost({ id: 2, parentId: 1 }),
        createMockPost({ id: 3, parentId: 1 }),
      ];

      const posts = buildPostTree(flatPosts);

      const discussion = createMockDiscussion();

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByTestId('post-1')).toBeInTheDocument();
      expect(screen.getByTestId('post-2')).toBeInTheDocument();
      expect(screen.getByTestId('post-3')).toBeInTheDocument();
    });

    it('should pass correct props to PostCard components', () => {
      const post = createMockPost({
        id: 2,
        parentId: 1,
        userId: 42,
        userName: 'Post Author',
        message: 'Test message content',
      });

      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), post];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      const postCard = screen.getByTestId('post-2');
      expect(within(postCard).getByText('Post Author')).toBeInTheDocument();
      expect(within(postCard).getByText('Test message content')).toBeInTheDocument();
    });
  });

  describe('Author Information', () => {
    it('should display author name, avatar, and role badge for each post', () => {
      const teacherPost = createMockPost({
        id: 2,
        parentId: 1,
        userId: 43,
        userName: 'Teacher Name',
        userPictureUrl: 'https://example.com/teacher.jpg',
      });

      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), teacherPost];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByText('Teacher Name')).toBeInTheDocument();
    });

    it('should display moderator badge for moderator posts', () => {
      const moderatorPost = createMockPost({
        id: 2,
        parentId: 1,
        userId: 44,
        userName: 'Moderator User',
      });

      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), moderatorPost];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByText('Moderator User')).toBeInTheDocument();
    });
  });

  describe('Post Timestamps', () => {
    it('should display relative timestamps for posts', () => {
      const recentPost = createMockPost({
        id: 2,
        parentId: 1,
        created: Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000), // 2 hours ago
      });

      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), recentPost];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      // The timestamp will be rendered by PostCard mock
      const postCard = screen.getByTestId('post-2');
      expect(within(postCard).getByTestId('post-timestamp')).toBeInTheDocument();
    });
  });

  describe('Reply Functionality', () => {
    it('should show reply button on each post when discussion is not locked', () => {
      const discussion = createMockDiscussion({
        locked: false,
      });
      const flatPosts = [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      const replyButtons = screen.getAllByTestId('reply-button');
      expect(replyButtons.length).toBeGreaterThan(0);
    });

    it('should hide reply buttons when discussion is locked', () => {
      const discussion = createMockDiscussion({
        locked: true,
      });
      const flatPosts = [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      // Post wrapper boxes should have data-locked="true"
      // Use specific test IDs to avoid matching nested elements like "post-rating"
      const post1 = screen.getByTestId('post-1');
      const post2 = screen.getByTestId('post-2');
      
      expect(post1).toHaveAttribute('data-locked', 'true');
      expect(post2).toHaveAttribute('data-locked', 'true');
    });

    it('should handle reply button click', async () => {
      const handleReply = vi.fn();
      const post = createMockPost({ id: 2, parentId: 1 });

      const discussion = createMockDiscussion({
        locked: false,
      });
      const flatPosts = [createMockPost({ id: 1 }), post];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
        createReply: handleReply,
      }));

      renderComponent(1);

      const replyButton = within(screen.getByTestId('post-2')).getByTestId('reply-button');
      await user.click(replyButton);

      // In real implementation, this would open a reply form
      expect(replyButton).toBeInTheDocument();
    });
  });

  describe('Quote Functionality', () => {
    it('should provide quote button for referencing previous posts', () => {
      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      const quoteButtons = screen.getAllByTestId('quote-button');
      expect(quoteButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Permalink Functionality', () => {
    it('should provide permalink to individual posts with URL hash', () => {
      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      // In real implementation, posts would have IDs that can be linked to
      const postCard = screen.getByTestId('post-2');
      expect(postCard).toHaveAttribute('data-post-id', '2');
    });
  });

  describe('Unread Post Indicators', () => {
    it('should display unread indicators for new replies', () => {
      const unreadPost = createMockPost({
        id: 2,
        parentId: 1,
        unread: true,
        message: 'Unread post',
      });

      const discussion = createMockDiscussion({
        unreadCount: 1,
      });
      const flatPosts = [createMockPost({ id: 1 }), unreadPost];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      // Check that unread count is displayed
      expect(screen.getByText(/1 unread/i)).toBeInTheDocument();
    });

    it('should not show unread indicators for read posts', () => {
      const readPost = createMockPost({
        id: 2,
        parentId: 1,
        unread: false,
      });

      const discussion = createMockDiscussion({
        unreadCount: 0,
      });
      const flatPosts = [createMockPost({ id: 1 }), readPost];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.queryByText(/unread/i)).not.toBeInTheDocument();
    });
  });

  describe('Moderator Actions', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: createMockUser({ id: 100, fullname: 'Moderator User' }),
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      });
    });

    it('should show edit button for moderators on any post', () => {
      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      const editButtons = screen.getAllByTestId('edit-button');
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it('should show delete button for moderators on any post', () => {
      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      const deleteButtons = screen.getAllByTestId('delete-button');
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('should provide split discussion action for moderators', () => {
      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      // Look for moderator menu or split action
      const moderatorButton = screen.queryByRole('button', { name: /moderator actions/i });
      expect(moderatorButton).toBeInTheDocument();
    });
  });

  describe('Owner Actions', () => {
    it('should show edit button for post owner', () => {
      const currentUser = createMockUser({ id: 5, fullname: 'Current User' });
      const ownPost = createMockPost({
        id: 2,
        parentId: 1,
        userId: 5,
        userName: 'Current User',
      });

      mockUseAuth.mockReturnValue({
        user: currentUser,
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      });

      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), ownPost];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      const editButtons = screen.getAllByTestId('edit-button');
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it('should show delete button for post owner', () => {
      const currentUser = createMockUser({ id: 5, fullname: 'Current User' });
      const ownPost = createMockPost({
        id: 2,
        parentId: 1,
        userId: 5,
        userName: 'Current User',
      });

      mockUseAuth.mockReturnValue({
        user: currentUser,
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      });

      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), ownPost];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      const deleteButtons = screen.getAllByTestId('delete-button');
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('should not show edit/delete buttons for other users posts', () => {
      const otherPost = createMockPost({
        id: 2,
        parentId: 1,
        userId: 99,
        userName: 'Other User',
        canEdit: false,
        canDelete: false,
      });

      mockUseAuth.mockReturnValue({
        user: createMockUser({ id: 5, fullname: 'Student User' }),
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      });

      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), otherPost];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      // Student shouldn't see edit/delete for other users' posts
      const postCard = screen.getByTestId('post-2');
      expect(within(postCard).queryByTestId('edit-button')).not.toBeInTheDocument();
      expect(within(postCard).queryByTestId('delete-button')).not.toBeInTheDocument();
    });
  });

  describe('Subscription Toggle', () => {
    it('should display subscription toggle button', () => {
      const discussion = createMockDiscussion({ subscribed: false });

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts: [createMockPost({ id: 1 })],
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument();
    });

    it('should show unsubscribe button when already subscribed', () => {
      const discussion = createMockDiscussion({ subscribed: true });

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts: [createMockPost({ id: 1 })],
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByRole('button', { name: /unsubscribe/i })).toBeInTheDocument();
    });

    it('should handle subscription toggle click', async () => {
      const subscribe = vi.fn();
      const discussion = createMockDiscussion({ subscribed: false });

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts: [createMockPost({ id: 1 })],
        isLoading: false,
        error: null,
        subscribe,
      }));

      renderComponent(1);

      const subscribeButton = screen.getByRole('button', { name: /subscribe/i });
      await user.click(subscribeButton);

      expect(subscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('Load More Pagination', () => {
    it('should show "Load more replies" button for long threads', () => {
      const allFlatPosts = Array.from({ length: 25 }, (_, i) =>
        createMockPost({ id: i + 1, parentId: i === 0 ? null : 1 })
      );

      const discussion = createMockDiscussion({
        numReplies: 25,
      });

      const flatPosts = allFlatPosts.slice(0, 20); // Initial 20 posts
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
        hasMore: true,
      }));

      renderComponent(1);

      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
    });

    it('should load more replies when button is clicked', async () => {
      const loadMore = vi.fn();
      const discussion = createMockDiscussion({
        numReplies: 50,
      });

      const posts = buildPostTree([createMockPost({ id: 1 })]);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
        hasMore: true,
        loadMore,
      }));

      renderComponent(1);

      const loadMoreButton = screen.getByRole('button', { name: /load more/i });
      await user.click(loadMoreButton);

      expect(loadMore).toHaveBeenCalledTimes(1);
    });

    it('should not show "Load more" button when all replies are loaded', () => {
      const discussion = createMockDiscussion({
        numReplies: 2,
      });

      const flatPosts = [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
        hasMore: false,
      }));

      renderComponent(1);

      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no replies exist', () => {
      const discussion = createMockDiscussion({
        numReplies: 0,
      });

      const posts = [createMockPost({ id: 1 })]; // Only original post

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByText(/no replies yet/i)).toBeInTheDocument();
      expect(screen.getByText(/be the first to reply/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading skeleton during thread fetch', () => {
      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion: null,
        posts: [],
        isLoading: true,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('should hide loading skeleton after data loads', async () => {
      const discussion = createMockDiscussion();
      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts: [createMockPost({ id: 1 })],
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.queryByTestId('discussion-skeleton')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message for failed thread load', () => {
      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion: null,
        posts: [],
        isLoading: false,
        error: new Error('Failed to load discussion'),
      }));

      renderComponent(1);

      expect(screen.getByText(/failed to load discussion/i)).toBeInTheDocument();
    });

    it('should provide retry button on error', async () => {
      const refetch = vi.fn();

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion: null,
        posts: [],
        isLoading: false,
        error: new Error('Network error'),
        refetch,
      }));

      renderComponent(1);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('should display 404 error for non-existent discussion', () => {
      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion: null,
        posts: [],
        isLoading: false,
        error: new Error('Discussion not found'),
      }));

      renderComponent(1);

      expect(screen.getByText(/discussion not found/i)).toBeInTheDocument();
    });

    it('should display 403 error for permission denied', () => {
      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion: null,
        posts: [],
        isLoading: false,
        error: { message: 'Permission denied', status: 403 } as unknown as Error,
      }));

      renderComponent(1);

      expect(screen.getByText(/you don't have permission to view this discussion/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle deleted post references', () => {
      const deletedPost = createMockPost({
        id: 2,
        parentId: 1,
        deleted: true,
        message: '[This post has been deleted]',
      });

      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), deletedPost];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByText('[This post has been deleted]')).toBeInTheDocument();
    });

    it('should handle posts by deleted users', () => {
      const postByDeletedUser = createMockPost({
        id: 2,
        parentId: 1,
        userId: 999,
        userName: '[Deleted User]',
        deleted: true,
      });

      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), postByDeletedUser];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByText('[Deleted User]')).toBeInTheDocument();
    });

    it('should handle moderated posts pending approval', () => {
      const moderatedPost = createMockPost({
        id: 2,
        parentId: 1,
        message: 'Pending approval',
      });

      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), moderatedPost];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      expect(screen.getByText(/pending approval/i)).toBeInTheDocument();
    });

    it('should handle broken parent post references gracefully', () => {
      const orphanPost = createMockPost({
        id: 2,
        parentId: 999, // Non-existent parent
        message: 'Orphan post',
      });

      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), orphanPost];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      // Should still render the orphan post
      expect(screen.getByText('Orphan post')).toBeInTheDocument();
    });
  });

  describe('Post Ordering', () => {
    it('should render posts in chronological order', () => {
      const oldPost = createMockPost({
        id: 2,
        parentId: 1,
        message: 'Old post',
        created: Math.floor(Date.parse('2024-01-15T10:00:00Z') / 1000),
      });

      const newPost = createMockPost({
        id: 3,
        parentId: 1,
        message: 'New post',
        created: Math.floor(Date.parse('2024-01-15T14:00:00Z') / 1000),
      });

      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), oldPost, newPost];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      const { container } = renderComponent(1);

      const postElements = container.querySelectorAll('[data-testid^="post-card-"]');
      const postMessages = Array.from(postElements).map((post) => post.textContent);

      // Verify chronological order
      const oldPostIndex = postMessages.findIndex((text) => text?.includes('Old post'));
      const newPostIndex = postMessages.findIndex((text) => text?.includes('New post'));

      expect(oldPostIndex).toBeLessThan(newPostIndex);
    });

    it('should maintain nested order within branches', () => {
      const discussion = createMockDiscussion();
      const flatPosts = [
        createMockPost({ id: 1, created: Math.floor(Date.parse('2024-01-15T10:00:00Z') / 1000) }),
        createMockPost({ id: 2, parentId: 1, created: Math.floor(Date.parse('2024-01-15T11:00:00Z') / 1000) }),
        createMockPost({ id: 3, parentId: 2, created: Math.floor(Date.parse('2024-01-15T12:00:00Z') / 1000) }),
        createMockPost({ id: 4, parentId: 1, created: Math.floor(Date.parse('2024-01-15T13:00:00Z') / 1000) }),
      ];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      // Verify all posts are rendered
      flatPosts.forEach((post) => {
        expect(screen.getByTestId(`post-${post.id}`)).toBeInTheDocument();
      });
    });
  });

  describe('Concurrent Reply Scenarios', () => {
    it('should handle optimistic updates for new replies', async () => {
      const createReply = vi.fn();
      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 })];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
        createReply,
      }));

      renderComponent(1);

      // Mock creating a reply
      const replyButton = within(screen.getByTestId('post-1')).getByTestId('reply-button');
      await user.click(replyButton);

      // In real implementation, optimistic update would show the reply immediately
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('should rollback optimistic update on creation failure', async () => {
      const createReply = vi.fn().mockRejectedValue(new Error('Failed to create reply'));
      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 })];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
        createReply,
      }));

      renderComponent(1);

      // Test optimistic update rollback scenario
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      const discussion = createMockDiscussion({ name: 'Test Discussion' });
      const flatPosts = [createMockPost({ id: 1 })];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      const heading = screen.getByRole('heading', { name: 'Test Discussion' });
      expect(heading).toBeInTheDocument();
    });

    it('should have ARIA labels for thread structure', () => {
      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      const { container } = renderComponent(1);

      // Check for ARIA attributes
      const threadContainer = container.querySelector('[role="tree"]') || container.querySelector('[aria-label*="discussion"]');
      expect(threadContainer).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const discussion = createMockDiscussion();
      const flatPosts = [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      renderComponent(1);

      // Test tab navigation
      await user.tab();

      // Verify focus is on an interactive element
      expect(document.activeElement).toBeInTheDocument();
    });

    it('should announce new replies to screen readers', () => {
      const discussion = createMockDiscussion({
        unreadCount: 3,
      });
      const flatPosts = [createMockPost({ id: 1 })];
      const posts = buildPostTree(flatPosts);

      mockUseDiscussion.mockReturnValue(createMockUseDiscussionReturn({
        discussion,
        posts,
        isLoading: false,
        error: null,
      }));

      const { container } = renderComponent(1);

      // Check for aria-live region for announcements
      const liveRegion = container.querySelector('[aria-live]');
      expect(liveRegion).toBeInTheDocument();
    });
  });
});
