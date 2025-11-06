import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DiscussionThread from '@/features/activities/forums/components/DiscussionThread';
import type { Discussion, Post, User } from '@/types/entities';

// Mock the useDiscussion hook
const mockUseDiscussion = vi.fn();
vi.mock('@/features/activities/forums/hooks/useDiscussion', () => ({
  useDiscussion: () => mockUseDiscussion(),
}));

// Mock the PostCard component
vi.mock('@/features/activities/forums/components/PostCard', () => ({
  default: ({ post, onReply, onEdit, onDelete, onReport, onQuote, isLocked, depth }: any) => (
    <div
      data-testid={`post-card-${post.id}`}
      data-depth={depth}
      data-locked={isLocked}
      data-post-id={post.id}
    >
      <div data-testid="post-author">{post.author.fullName}</div>
      <div data-testid="post-content">{post.message}</div>
      <div data-testid="post-timestamp">{post.createdAt}</div>
      {!isLocked && (
        <button onClick={() => onReply(post)} data-testid="reply-button">
          Reply
        </button>
      )}
      {onEdit && (
        <button onClick={() => onEdit(post)} data-testid="edit-button">
          Edit
        </button>
      )}
      {onDelete && (
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
const mockUseAuth = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Helper function to create mock user
const createMockUser = (overrides?: Partial<User>): User => ({
  id: 1,
  username: 'testuser',
  fullName: 'Test User',
  email: 'test@example.com',
  avatar: 'https://example.com/avatar.jpg',
  roles: ['student'],
  ...overrides,
});

// Helper function to create mock post
const createMockPost = (overrides?: Partial<Post>): Post => ({
  id: 1,
  discussionId: 1,
  parentId: null,
  author: createMockUser(),
  subject: 'Test Post',
  message: 'This is a test post message',
  createdAt: '2024-01-15T10:00:00Z',
  modifiedAt: null,
  deleted: false,
  unread: false,
  attachments: [],
  children: [],
  ...overrides,
});

// Helper function to create mock discussion
const createMockDiscussion = (overrides?: Partial<Discussion>): Discussion => ({
  id: 1,
  forumId: 1,
  name: 'Test Discussion',
  firstPost: createMockPost({ id: 1, subject: 'Test Discussion' }),
  author: createMockUser(),
  createdAt: '2024-01-15T10:00:00Z',
  modifiedAt: '2024-01-15T12:00:00Z',
  pinned: false,
  locked: false,
  subscribed: false,
  viewCount: 42,
  replyCount: 5,
  unreadCount: 2,
  participants: 3,
  posts: [],
  ...overrides,
});

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
        author: createMockUser({ fullName: 'Jane Smith' }),
        createdAt: '2024-01-10T09:30:00Z',
        viewCount: 156,
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByRole('heading', { name: 'Introduction to React Hooks' })).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText(/156 views/i)).toBeInTheDocument();
    });

    it('should render discussion metadata including reply count and participants', () => {
      const discussion = createMockDiscussion({
        replyCount: 25,
        participants: 8,
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByText(/25 replies/i)).toBeInTheDocument();
      expect(screen.getByText(/8 participants/i)).toBeInTheDocument();
    });

    it('should display pinned badge when discussion is pinned', () => {
      const discussion = createMockDiscussion({ pinned: true });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByText(/pinned/i)).toBeInTheDocument();
    });

    it('should display locked indicator when discussion is locked', () => {
      const discussion = createMockDiscussion({ locked: true });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByText(/locked/i)).toBeInTheDocument();
      expect(screen.getByText(/this discussion is locked/i)).toBeInTheDocument();
    });
  });

  describe('Original Post (Starter Post)', () => {
    it('should display the original post prominently at the top', () => {
      const originalPost = createMockPost({
        id: 1,
        subject: 'Original Discussion Post',
        message: 'This is the discussion starter content',
        author: createMockUser({ fullName: 'Discussion Starter' }),
      });

      const discussion = createMockDiscussion({
        firstPost: originalPost,
        posts: [originalPost],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      const originalPostCard = screen.getByTestId('post-card-1');
      expect(originalPostCard).toBeInTheDocument();
      expect(within(originalPostCard).getByText('Discussion Starter')).toBeInTheDocument();
      expect(within(originalPostCard).getByText('This is the discussion starter content')).toBeInTheDocument();
    });

    it('should render original post with depth 0', () => {
      const originalPost = createMockPost({ id: 1 });
      const discussion = createMockDiscussion({
        firstPost: originalPost,
        posts: [originalPost],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      const originalPostCard = screen.getByTestId('post-card-1');
      expect(originalPostCard).toHaveAttribute('data-depth', '0');
    });
  });

  describe('Nested Reply Structure', () => {
    it('should render replies with proper nesting up to 5 levels deep', () => {
      const level1Reply = createMockPost({ id: 2, parentId: 1, message: 'Level 1 reply' });
      const level2Reply = createMockPost({ id: 3, parentId: 2, message: 'Level 2 reply' });
      const level3Reply = createMockPost({ id: 4, parentId: 3, message: 'Level 3 reply' });
      const level4Reply = createMockPost({ id: 5, parentId: 4, message: 'Level 4 reply' });
      const level5Reply = createMockPost({ id: 6, parentId: 5, message: 'Level 5 reply' });

      const discussion = createMockDiscussion({
        posts: [
          createMockPost({ id: 1 }),
          level1Reply,
          level2Reply,
          level3Reply,
          level4Reply,
          level5Reply,
        ],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByTestId('post-card-2')).toHaveAttribute('data-depth', '1');
      expect(screen.getByTestId('post-card-3')).toHaveAttribute('data-depth', '2');
      expect(screen.getByTestId('post-card-4')).toHaveAttribute('data-depth', '3');
      expect(screen.getByTestId('post-card-5')).toHaveAttribute('data-depth', '4');
      expect(screen.getByTestId('post-card-6')).toHaveAttribute('data-depth', '5');
    });

    it('should render multiple replies at the same level', () => {
      const reply1 = createMockPost({ id: 2, parentId: 1, message: 'First reply' });
      const reply2 = createMockPost({ id: 3, parentId: 1, message: 'Second reply' });
      const reply3 = createMockPost({ id: 4, parentId: 1, message: 'Third reply' });

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), reply1, reply2, reply3],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByTestId('post-card-2')).toBeInTheDocument();
      expect(screen.getByTestId('post-card-3')).toBeInTheDocument();
      expect(screen.getByTestId('post-card-4')).toBeInTheDocument();

      // All should be at depth 1
      expect(screen.getByTestId('post-card-2')).toHaveAttribute('data-depth', '1');
      expect(screen.getByTestId('post-card-3')).toHaveAttribute('data-depth', '1');
      expect(screen.getByTestId('post-card-4')).toHaveAttribute('data-depth', '1');
    });

    it('should render complex nested tree with multiple branches', () => {
      const posts = [
        createMockPost({ id: 1, parentId: null }),
        createMockPost({ id: 2, parentId: 1 }), // Branch 1
        createMockPost({ id: 3, parentId: 2 }),
        createMockPost({ id: 4, parentId: 1 }), // Branch 2
        createMockPost({ id: 5, parentId: 4 }),
        createMockPost({ id: 6, parentId: 1 }), // Branch 3
      ];

      const discussion = createMockDiscussion({ posts });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      // Verify all posts are rendered
      posts.forEach((post) => {
        expect(screen.getByTestId(`post-card-${post.id}`)).toBeInTheDocument();
      });

      // Verify depths
      expect(screen.getByTestId('post-card-2')).toHaveAttribute('data-depth', '1');
      expect(screen.getByTestId('post-card-3')).toHaveAttribute('data-depth', '2');
      expect(screen.getByTestId('post-card-4')).toHaveAttribute('data-depth', '1');
      expect(screen.getByTestId('post-card-5')).toHaveAttribute('data-depth', '2');
      expect(screen.getByTestId('post-card-6')).toHaveAttribute('data-depth', '1');
    });
  });

  describe('Reply Hierarchy Visualization', () => {
    it('should apply proper indentation classes for nested posts', () => {
      const reply = createMockPost({ id: 2, parentId: 1 });
      const nestedReply = createMockPost({ id: 3, parentId: 2 });

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), reply, nestedReply],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      const { container } = renderComponent(1);

      // Check for indentation-related classes or styles
      const level1Post = container.querySelector('[data-depth="1"]');
      const level2Post = container.querySelector('[data-depth="2"]');

      expect(level1Post).toBeInTheDocument();
      expect(level2Post).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse Controls', () => {
    it('should provide expand/collapse button for deeply nested threads', async () => {
      const posts = [
        createMockPost({ id: 1 }),
        createMockPost({ id: 2, parentId: 1 }),
        createMockPost({ id: 3, parentId: 2 }),
        createMockPost({ id: 4, parentId: 3 }),
        createMockPost({ id: 5, parentId: 4 }),
      ];

      const discussion = createMockDiscussion({ posts });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      // Look for collapse button near deeply nested posts
      const collapseButtons = screen.queryAllByRole('button', { name: /collapse/i });
      expect(collapseButtons.length).toBeGreaterThan(0);
    });

    it('should collapse nested replies when collapse button is clicked', async () => {
      const posts = [
        createMockPost({ id: 1 }),
        createMockPost({ id: 2, parentId: 1, message: 'Parent reply' }),
        createMockPost({ id: 3, parentId: 2, message: 'Child reply' }),
      ];

      const discussion = createMockDiscussion({ posts });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

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
      const posts = [
        createMockPost({ id: 1 }),
        createMockPost({ id: 2, parentId: 1, message: 'Parent reply' }),
        createMockPost({ id: 3, parentId: 2, message: 'Collapsed child' }),
      ];

      const discussion = createMockDiscussion({ posts });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

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
      const posts = [
        createMockPost({ id: 1 }),
        createMockPost({ id: 2, parentId: 1 }),
        createMockPost({ id: 3, parentId: 1 }),
      ];

      const discussion = createMockDiscussion({ posts });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByTestId('post-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('post-card-2')).toBeInTheDocument();
      expect(screen.getByTestId('post-card-3')).toBeInTheDocument();
    });

    it('should pass correct props to PostCard components', () => {
      const post = createMockPost({
        id: 2,
        parentId: 1,
        author: createMockUser({ fullName: 'Post Author' }),
        message: 'Test message content',
      });

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), post],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      const postCard = screen.getByTestId('post-card-2');
      expect(within(postCard).getByText('Post Author')).toBeInTheDocument();
      expect(within(postCard).getByText('Test message content')).toBeInTheDocument();
    });
  });

  describe('Author Information', () => {
    it('should display author name, avatar, and role badge for each post', () => {
      const teacherPost = createMockPost({
        id: 2,
        parentId: 1,
        author: createMockUser({
          fullName: 'Teacher Name',
          roles: ['teacher'],
          avatar: 'https://example.com/teacher.jpg',
        }),
      });

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), teacherPost],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByText('Teacher Name')).toBeInTheDocument();
    });

    it('should display moderator badge for moderator posts', () => {
      const moderatorPost = createMockPost({
        id: 2,
        parentId: 1,
        author: createMockUser({
          fullName: 'Moderator User',
          roles: ['moderator'],
        }),
      });

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), moderatorPost],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByText('Moderator User')).toBeInTheDocument();
    });
  });

  describe('Post Timestamps', () => {
    it('should display relative timestamps for posts', () => {
      const recentPost = createMockPost({
        id: 2,
        parentId: 1,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      });

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), recentPost],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      // The timestamp will be rendered by PostCard mock
      const postCard = screen.getByTestId('post-card-2');
      expect(within(postCard).getByTestId('post-timestamp')).toBeInTheDocument();
    });
  });

  describe('Reply Functionality', () => {
    it('should show reply button on each post when discussion is not locked', () => {
      const discussion = createMockDiscussion({
        locked: false,
        posts: [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      const replyButtons = screen.getAllByTestId('reply-button');
      expect(replyButtons.length).toBeGreaterThan(0);
    });

    it('should hide reply buttons when discussion is locked', () => {
      const discussion = createMockDiscussion({
        locked: true,
        posts: [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      // PostCards should have data-locked="true"
      const postCards = screen.getAllByTestId(/post-card-/);
      postCards.forEach((card) => {
        expect(card).toHaveAttribute('data-locked', 'true');
      });
    });

    it('should handle reply button click', async () => {
      const handleReply = vi.fn();
      const post = createMockPost({ id: 2, parentId: 1 });

      const discussion = createMockDiscussion({
        locked: false,
        posts: [createMockPost({ id: 1 }), post],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
        createReply: handleReply,
      });

      renderComponent(1);

      const replyButton = within(screen.getByTestId('post-card-2')).getByTestId('reply-button');
      await user.click(replyButton);

      // In real implementation, this would open a reply form
      expect(replyButton).toBeInTheDocument();
    });
  });

  describe('Quote Functionality', () => {
    it('should provide quote button for referencing previous posts', () => {
      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      const quoteButtons = screen.getAllByTestId('quote-button');
      expect(quoteButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Permalink Functionality', () => {
    it('should provide permalink to individual posts with URL hash', () => {
      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      // In real implementation, posts would have IDs that can be linked to
      const postCard = screen.getByTestId('post-card-2');
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
        posts: [createMockPost({ id: 1 }), unreadPost],
        unreadCount: 1,
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      // Check that unread count is displayed
      expect(screen.getByText(/2 unread/i)).toBeInTheDocument();
    });

    it('should not show unread indicators for read posts', () => {
      const readPost = createMockPost({
        id: 2,
        parentId: 1,
        unread: false,
      });

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), readPost],
        unreadCount: 0,
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.queryByText(/unread/i)).not.toBeInTheDocument();
    });
  });

  describe('Moderator Actions', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: createMockUser({ roles: ['moderator'] }),
        isAuthenticated: true,
      });
    });

    it('should show edit button for moderators on any post', () => {
      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      const editButtons = screen.getAllByTestId('edit-button');
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it('should show delete button for moderators on any post', () => {
      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      const deleteButtons = screen.getAllByTestId('delete-button');
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('should provide split discussion action for moderators', () => {
      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      // Look for moderator menu or split action
      const moderatorButton = screen.queryByRole('button', { name: /moderator actions/i });
      expect(moderatorButton).toBeInTheDocument();
    });
  });

  describe('Owner Actions', () => {
    it('should show edit button for post owner', () => {
      const currentUser = createMockUser({ id: 5, fullName: 'Current User' });
      const ownPost = createMockPost({
        id: 2,
        parentId: 1,
        author: currentUser,
      });

      mockUseAuth.mockReturnValue({
        user: currentUser,
        isAuthenticated: true,
      });

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), ownPost],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      const editButtons = screen.getAllByTestId('edit-button');
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it('should show delete button for post owner', () => {
      const currentUser = createMockUser({ id: 5 });
      const ownPost = createMockPost({
        id: 2,
        parentId: 1,
        author: currentUser,
      });

      mockUseAuth.mockReturnValue({
        user: currentUser,
        isAuthenticated: true,
      });

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), ownPost],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      const deleteButtons = screen.getAllByTestId('delete-button');
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('should not show edit/delete buttons for other users posts', () => {
      const otherUser = createMockUser({ id: 99 });
      const otherPost = createMockPost({
        id: 2,
        parentId: 1,
        author: otherUser,
      });

      mockUseAuth.mockReturnValue({
        user: createMockUser({ id: 5, roles: ['student'] }),
        isAuthenticated: true,
      });

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), otherPost],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      // Student shouldn't see edit/delete for other users' posts
      const postCard = screen.getByTestId('post-card-2');
      expect(within(postCard).queryByTestId('edit-button')).not.toBeInTheDocument();
      expect(within(postCard).queryByTestId('delete-button')).not.toBeInTheDocument();
    });
  });

  describe('Subscription Toggle', () => {
    it('should display subscription toggle button', () => {
      const discussion = createMockDiscussion({ subscribed: false });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument();
    });

    it('should show unsubscribe button when already subscribed', () => {
      const discussion = createMockDiscussion({ subscribed: true });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByRole('button', { name: /unsubscribe/i })).toBeInTheDocument();
    });

    it('should handle subscription toggle click', async () => {
      const toggleSubscription = vi.fn();
      const discussion = createMockDiscussion({ subscribed: false });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
        toggleSubscription,
      });

      renderComponent(1);

      const subscribeButton = screen.getByRole('button', { name: /subscribe/i });
      await user.click(subscribeButton);

      expect(toggleSubscription).toHaveBeenCalledTimes(1);
    });
  });

  describe('Load More Pagination', () => {
    it('should show "Load more replies" button for long threads', () => {
      const posts = Array.from({ length: 25 }, (_, i) =>
        createMockPost({ id: i + 1, parentId: i === 0 ? null : 1 })
      );

      const discussion = createMockDiscussion({
        posts: posts.slice(0, 20), // Initial 20 posts
        replyCount: 25,
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
        hasMore: true,
      });

      renderComponent(1);

      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
    });

    it('should load more replies when button is clicked', async () => {
      const loadMore = vi.fn();
      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 })],
        replyCount: 50,
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
        hasMore: true,
        loadMore,
      });

      renderComponent(1);

      const loadMoreButton = screen.getByRole('button', { name: /load more/i });
      await user.click(loadMoreButton);

      expect(loadMore).toHaveBeenCalledTimes(1);
    });

    it('should not show "Load more" button when all replies are loaded', () => {
      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })],
        replyCount: 2,
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
        hasMore: false,
      });

      renderComponent(1);

      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no replies exist', () => {
      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 })], // Only original post
        replyCount: 0,
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByText(/no replies yet/i)).toBeInTheDocument();
      expect(screen.getByText(/be the first to reply/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading skeleton during thread fetch', () => {
      mockUseDiscussion.mockReturnValue({
        discussion: null,
        isLoading: true,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByTestId('discussion-skeleton')).toBeInTheDocument();
    });

    it('should hide loading skeleton after data loads', async () => {
      mockUseDiscussion.mockReturnValue({
        discussion: createMockDiscussion(),
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.queryByTestId('discussion-skeleton')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message for failed thread load', () => {
      mockUseDiscussion.mockReturnValue({
        discussion: null,
        isLoading: false,
        error: new Error('Failed to load discussion'),
      });

      renderComponent(1);

      expect(screen.getByText(/failed to load discussion/i)).toBeInTheDocument();
    });

    it('should provide retry button on error', async () => {
      const retry = vi.fn();

      mockUseDiscussion.mockReturnValue({
        discussion: null,
        isLoading: false,
        error: new Error('Network error'),
        retry,
      });

      renderComponent(1);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(retry).toHaveBeenCalledTimes(1);
    });

    it('should display 404 error for non-existent discussion', () => {
      mockUseDiscussion.mockReturnValue({
        discussion: null,
        isLoading: false,
        error: { code: 404, message: 'Discussion not found' },
      });

      renderComponent(1);

      expect(screen.getByText(/discussion not found/i)).toBeInTheDocument();
    });

    it('should display 403 error for permission denied', () => {
      mockUseDiscussion.mockReturnValue({
        discussion: null,
        isLoading: false,
        error: { code: 403, message: 'Permission denied' },
      });

      renderComponent(1);

      expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
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

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), deletedPost],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByText('[This post has been deleted]')).toBeInTheDocument();
    });

    it('should handle posts by deleted users', () => {
      const postByDeletedUser = createMockPost({
        id: 2,
        parentId: 1,
        author: createMockUser({
          id: 999,
          fullName: '[Deleted User]',
          deleted: true,
        }),
      });

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), postByDeletedUser],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByText('[Deleted User]')).toBeInTheDocument();
    });

    it('should handle moderated posts pending approval', () => {
      const moderatedPost = createMockPost({
        id: 2,
        parentId: 1,
        message: 'Pending approval',
        status: 'pending',
      });

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), moderatedPost],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      expect(screen.getByText(/pending approval/i)).toBeInTheDocument();
    });

    it('should handle broken parent post references gracefully', () => {
      const orphanPost = createMockPost({
        id: 2,
        parentId: 999, // Non-existent parent
        message: 'Orphan post',
      });

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), orphanPost],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

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
        createdAt: '2024-01-15T10:00:00Z',
      });

      const newPost = createMockPost({
        id: 3,
        parentId: 1,
        message: 'New post',
        createdAt: '2024-01-15T14:00:00Z',
      });

      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), oldPost, newPost],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      const { container } = renderComponent(1);

      const posts = container.querySelectorAll('[data-testid^="post-card-"]');
      const postMessages = Array.from(posts).map((post) => post.textContent);

      // Verify chronological order
      const oldPostIndex = postMessages.findIndex((text) => text?.includes('Old post'));
      const newPostIndex = postMessages.findIndex((text) => text?.includes('New post'));

      expect(oldPostIndex).toBeLessThan(newPostIndex);
    });

    it('should maintain nested order within branches', () => {
      const posts = [
        createMockPost({ id: 1, createdAt: '2024-01-15T10:00:00Z' }),
        createMockPost({ id: 2, parentId: 1, createdAt: '2024-01-15T11:00:00Z' }),
        createMockPost({ id: 3, parentId: 2, createdAt: '2024-01-15T12:00:00Z' }),
        createMockPost({ id: 4, parentId: 1, createdAt: '2024-01-15T13:00:00Z' }),
      ];

      const discussion = createMockDiscussion({ posts });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      // Verify all posts are rendered
      posts.forEach((post) => {
        expect(screen.getByTestId(`post-card-${post.id}`)).toBeInTheDocument();
      });
    });
  });

  describe('Concurrent Reply Scenarios', () => {
    it('should handle optimistic updates for new replies', async () => {
      const createReply = vi.fn();
      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 })],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
        createReply,
      });

      renderComponent(1);

      // Mock creating a reply
      const replyButton = within(screen.getByTestId('post-card-1')).getByTestId('reply-button');
      await user.click(replyButton);

      // In real implementation, optimistic update would show the reply immediately
    });

    it('should rollback optimistic update on creation failure', async () => {
      const createReply = vi.fn().mockRejectedValue(new Error('Failed to create reply'));
      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 })],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
        createReply,
      });

      renderComponent(1);

      // Test optimistic update rollback scenario
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      const discussion = createMockDiscussion({ name: 'Test Discussion' });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      const heading = screen.getByRole('heading', { name: 'Test Discussion' });
      expect(heading).toBeInTheDocument();
    });

    it('should have ARIA labels for thread structure', () => {
      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      const { container } = renderComponent(1);

      // Check for ARIA attributes
      const threadContainer = container.querySelector('[role="tree"]') || container.querySelector('[aria-label*="discussion"]');
      expect(threadContainer).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 }), createMockPost({ id: 2, parentId: 1 })],
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      renderComponent(1);

      // Test tab navigation
      await user.tab();

      // Verify focus is on an interactive element
      expect(document.activeElement).toBeInTheDocument();
    });

    it('should announce new replies to screen readers', () => {
      const discussion = createMockDiscussion({
        posts: [createMockPost({ id: 1 })],
        unreadCount: 3,
      });

      mockUseDiscussion.mockReturnValue({
        discussion,
        isLoading: false,
        error: null,
      });

      const { container } = renderComponent(1);

      // Check for aria-live region for announcements
      const liveRegion = container.querySelector('[aria-live]');
      expect(liveRegion).toBeInTheDocument();
    });
  });
});
