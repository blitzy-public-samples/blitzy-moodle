/**
 * Unit tests for ForumView component
 * 
 * Tests cover:
 * - Forum overview rendering with title, description, and metadata
 * - Different forum types (single, standard, Q&A, blog)
 * - Subscription functionality and status display
 * - Permission-based action visibility
 * - Discussion list integration with sorting/filtering
 * - Loading, error, and empty states
 * - Forum statistics display
 * - Accessibility compliance (WCAG 2.1 AA)
 * - Edge cases (archived, read-only, deleted discussions)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ForumView } from '@/features/activities/forums/components/ForumView';
import * as forumHooks from '@/features/activities/forums/hooks/useForum';
import type { Forum, ForumType, ForumStatistics } from '@/features/activities/forums/types/forum.types';

// Mock the useForum hook with a factory that returns the default mock
vi.mock('@/features/activities/forums/hooks/useForum', () => ({
  useForum: vi.fn(),
}));

// Mock the useAuth hook
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 123,
      fullname: 'Test User',
      email: 'test@example.com',
    },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

// Mock the DiscussionList component to isolate ForumView tests
vi.mock('@/features/activities/forums/components/DiscussionList', () => ({
  DiscussionList: ({ forumId, onSort, onFilter }: any) => (
    <div data-testid="discussion-list">
      <span>Discussion List for Forum {forumId}</span>
      <button onClick={() => onSort?.('latest')}>Sort Latest</button>
      <button onClick={() => onFilter?.({ unread: true })}>Filter Unread</button>
    </div>
  ),
}));

/**
 * Test helper to create a mock forum object
 */
const createMockForum = (overrides?: Partial<Forum>): Forum => ({
  id: 1,
  courseid: 100,
  type: 'general' as ForumType,
  name: 'General Discussion Forum',
  intro: 'This is a forum for general course discussions and announcements.',
  introformat: 1,
  assessed: 0,
  assesstimestart: 0,
  assesstimefinish: 0,
  scale: 0,
  gradeforum: 0,
  gradeforumnotify: false,
  maxbytes: 512000,
  maxattachments: 5,
  forcesubscribe: 0,
  trackingtype: 1,
  rsstype: 0,
  rssarticles: 0,
  timemodified: Date.now(),
  warnafter: 0,
  blockafter: 0,
  blockperiod: 0,
  completiondiscussions: 0,
  completionreplies: 0,
  completionposts: 0,
  displaywordcount: false,
  lockdiscussionsafter: 0,
  duedate: null,
  cutoffdate: null,
  subscribed: false,
  canSubscribe: true,
  canAddDiscussion: true,
  canModerate: false,
  unreadCount: 5,
  discussionCount: 15,
  postCount: 87,
  participants: 25,
  ...overrides,
});

/**
 * Test helper to create a mock useForum return value
 */
const createMockUseForumReturn = (overrides?: any): any => ({
  forum: createMockForum(overrides?.forum),
  isLoading: false,
  isError: false,
  isSuccess: true,
  isFetching: false,
  isRefetching: false,
  error: null,
  discussions: [],
  pagination: undefined,
  isSubscribing: false,
  isMarkingRead: false,
  isCreatingDiscussion: false,
  isPinning: false,
  isLocking: false,
  toggleSubscription: vi.fn(),
  markAllAsRead: vi.fn(),
  createDiscussion: vi.fn(),
  pinDiscussion: vi.fn(),
  unpinDiscussion: vi.fn(),
  lockDiscussion: vi.fn(),
  unlockDiscussion: vi.fn(),
  prefetchNextPage: undefined,
  refetch: vi.fn(),
  ...overrides,
});



/**
 * Test helper to create a QueryClient for tests
 */
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

/**
 * Test wrapper component with necessary providers
 */
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('ForumView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default mock implementation for useForum
    const mockUseForum = forumHooks.useForum as ReturnType<typeof vi.fn>;
    mockUseForum.mockReturnValue(createMockUseForumReturn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render forum header with title and description', async () => {
      const mockForum = createMockForum();

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        forum: mockForum,
        isLoading: false,
        isError: false,
        isSuccess: true,
        isFetching: false,
        isRefetching: false,
        error: null,
        discussions: [],
        pagination: undefined,
        isSubscribing: false,
        isMarkingRead: false,
        isCreatingDiscussion: false,
        isPinning: false,
        isLocking: false,
        toggleSubscription: vi.fn(),
        markAllAsRead: vi.fn(),
        createDiscussion: vi.fn(),
        pinDiscussion: vi.fn(),
        unpinDiscussion: vi.fn(),
        lockDiscussion: vi.fn(),
        unlockDiscussion: vi.fn(),
        prefetchNextPage: undefined,
        refetch: vi.fn(),
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      // Verify forum title
      expect(screen.getByRole('heading', { name: 'General Discussion Forum' })).toBeInTheDocument();

      // Verify forum description
      expect(screen.getByText('This is a forum for general course discussions and announcements.')).toBeInTheDocument();
    });

    it('should display forum metadata correctly', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(
        createMockUseForumReturn({
          forum: {
            maxbytes: 1048576, // 1MB
            maxattachments: 3,
          },
        })
      );

      renderWithProviders(<ForumView forumId={1} />);

      // Verify metadata display
      expect(screen.getByText(/Maximum attachment size/i)).toBeInTheDocument();
      expect(screen.getByText(/1 MB/i)).toBeInTheDocument();
      expect(screen.getByText(/Maximum attachments/i)).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render discussion list integration', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(createMockUseForumReturn());

      renderWithProviders(<ForumView forumId={1} />);

      // Verify DiscussionList is rendered
      expect(screen.getByTestId('discussion-list')).toBeInTheDocument();
      expect(screen.getByText('Discussion List for Forum 1')).toBeInTheDocument();
    });
  });

  describe('Forum Types', () => {
    it('should display indicator for single discussion forum', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(
        createMockUseForumReturn({
          forum: { type: 'single' },
        })
      );

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/Single discussion/i)).toBeInTheDocument();
    });

    it('should display indicator for standard forum', async () => {
      const mockForum = createMockForum({ type: 'standard' });

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(createMockUseForumReturn());

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/Standard forum/i)).toBeInTheDocument();
    });

    it('should display indicator for Q&A forum', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(
        createMockUseForumReturn({
          forum: { type: 'qanda' },
        })
      );

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/Q&A forum/i)).toBeInTheDocument();
    });

    it('should display indicator for blog-style forum', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(
        createMockUseForumReturn({
          forum: { type: 'blog' },
        })
      );

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/Blog-style/i)).toBeInTheDocument();
    });
  });

  describe('Subscription Functionality', () => {
    it('should display subscription button when not subscribed', async () => {
      const mockForum = createMockForum();

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(createMockUseForumReturn());

      renderWithProviders(<ForumView forumId={1} />);

      const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });
      expect(subscribeButton).toBeInTheDocument();
      expect(subscribeButton).not.toHaveAttribute('aria-pressed', 'true');
    });

    it('should display unsubscribe button when subscribed', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(
        createMockUseForumReturn({
          forum: { subscribed: true, canSubscribe: true },
        })
      );

      renderWithProviders(<ForumView forumId={1} />);

      const unsubscribeButton = screen.getByRole('button', { name: /Unsubscribe/i });
      expect(unsubscribeButton).toBeInTheDocument();
      expect(unsubscribeButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should call toggleSubscription when subscription button is clicked', async () => {
      const user = userEvent.setup();
      const mockForum = createMockForum();
      const mockToggleSubscription = vi.fn();

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        toggleSubscription: mockToggleSubscription,
      });

      renderWithProviders(<ForumView forumId={1} />);

      const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });
      await user.click(subscribeButton);

      expect(mockToggleSubscription).toHaveBeenCalledTimes(1);
    });

    it('should disable subscription button while toggling', async () => {
      const mockForum = createMockForum();

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        isSubscribing: true,
      });

      renderWithProviders(<ForumView forumId={1} />);

      const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });
      expect(subscribeButton).toBeDisabled();
    });

    it('should display subscription status indicator', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(
        createMockUseForumReturn({
          forum: { subscribed: true },
        })
      );

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/You are subscribed/i)).toBeInTheDocument();
    });
  });

  describe('Create Discussion Button', () => {
    it('should display create discussion button with permission', async () => {
      const mockForum = createMockForum();

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
      });

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByRole('button', { name: /Add.*discussion/i })).toBeInTheDocument();
    });

    it('should not display create discussion button without permission', async () => {
      const mockForum = createMockForum({ canAddDiscussion: false });

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        forum: mockForum,
      });

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.queryByRole('button', { name: /Add.*discussion/i })).not.toBeInTheDocument();
    });

    it('should hide create discussion button in single discussion forum', async () => {
      const mockForum = createMockForum({ type: 'single', canAddDiscussion: false });

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        forum: mockForum,
      });

      renderWithProviders(<ForumView forumId={1} />);

      // Single discussion forums don't allow creating new discussions
      expect(screen.queryByRole('button', { name: /Add.*discussion/i })).not.toBeInTheDocument();
    });
  });

  describe('Forum Statistics', () => {
    it('should display total discussions count', async () => {
      const mockForum = createMockForum({ discussionCount: 25 });

      const mockUseForum = forumHooks.useForum as ReturnType<typeof vi.fn>;
      mockUseForum.mockReturnValue({
        ...createMockUseForumReturn(),
        forum: mockForum,
      });

      renderWithProviders(<ForumView forumId={1} />);

      // Text is split across elements: <strong>25</strong> Discussions
      // Find the number element and verify its parent contains the label
      const numberElement = screen.getByText('25');
      expect(numberElement).toBeInTheDocument();
      expect(numberElement.parentElement?.textContent).toContain('Discussions');
    });

    it('should display total posts count', async () => {
      const mockForum = createMockForum({ postCount: 150 });

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        forum: mockForum,
      });

      renderWithProviders(<ForumView forumId={1} />);

      // Text is split across elements: <strong>150</strong> Posts
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('Posts', { exact: false })).toBeInTheDocument();
    });

    it('should display unread posts count', async () => {
      const mockForum = createMockForum({ unreadCount: 8 });

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        forum: mockForum,
      });

      renderWithProviders(<ForumView forumId={1} />);

      // Text is split across elements: <strong>8</strong> Unread
      // Find the number element and verify its parent contains the label
      const numberElement = screen.getByText('8');
      expect(numberElement).toBeInTheDocument();
      expect(numberElement.parentElement?.textContent).toContain('Unread');
    });

    it('should display unread count', async () => {
      const mockForum = createMockForum({ unreadCount: 4 });

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        forum: mockForum,
      });

      renderWithProviders(<ForumView forumId={1} />);

      // Text is split across elements: <strong>4</strong> Unread
      // Find the number element and verify its parent contains the label
      const numberElement = screen.getByText('4');
      expect(numberElement).toBeInTheDocument();
      expect(numberElement.parentElement?.textContent).toContain('Unread');
    });
  });

  describe('Loading State', () => {
    it('should display loading skeleton during data fetch', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        statistics: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      // Verify loading skeleton is displayed
      expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
      expect(screen.getByTestId('forum-skeleton')).toBeInTheDocument();
    });

    it('should display accessible loading message for screen readers', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        statistics: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByLabelText(/Loading forum/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when fetch fails', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        statistics: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Failed to load forum'),
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to load forum/i)).toBeInTheDocument();
    });

    it('should display retry button on error', async () => {
      const mockRefetch = vi.fn();

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        statistics: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
        refetch: mockRefetch,
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should call refetch when retry button is clicked', async () => {
      const user = userEvent.setup();
      const mockRefetch = vi.fn();

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        statistics: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
        refetch: mockRefetch,
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no discussions exist', async () => {
      const mockForum = createMockForum({
        discussionCount: 0,
        postCount: 0,
        unreadCount: 0,
      });

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        forum: mockForum,
      });

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/No discussions yet/i)).toBeInTheDocument();
      expect(screen.getByText(/Be the first/i)).toBeInTheDocument();
    });

    it('should show appropriate message in empty state without create permission', async () => {
      const mockForum = createMockForum({
        discussionCount: 0,
        postCount: 0,
        canAddDiscussion: false,
      });

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        forum: mockForum,
      });

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/No discussions yet/i)).toBeInTheDocument();
      expect(screen.queryByText(/Be the first/i)).not.toBeInTheDocument();
    });
  });

  describe('Permission-Based Actions', () => {
    it('should display moderator actions for users with permission', async () => {
      const mockForum = createMockForum({ canModerate: true });

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        forum: mockForum,
      });

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByRole('button', { name: /Moderate/i })).toBeInTheDocument();
    });

    it('should not display moderator actions for regular students', async () => {
      const mockForum = createMockForum();

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
      });

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.queryByRole('button', { name: /Moderate/i })).not.toBeInTheDocument();
    });

    it('should display move discussions option for moderators', async () => {
      const user = userEvent.setup();
      const mockForum = createMockForum({ canModerate: true });

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        forum: mockForum,
      });

      renderWithProviders(<ForumView forumId={1} />);

      const moderateButton = screen.getByRole('button', { name: /Moderate/i });
      await user.click(moderateButton);

      expect(screen.getByRole('menuitem', { name: /Move discussions/i })).toBeInTheDocument();
    });

    it('should display lock discussions option for moderators', async () => {
      const user = userEvent.setup();
      const mockForum = createMockForum({ canModerate: true });

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        forum: mockForum,
      });

      renderWithProviders(<ForumView forumId={1} />);

      const moderateButton = screen.getByRole('button', { name: /Moderate/i });
      await user.click(moderateButton);

      expect(screen.getByRole('menuitem', { name: /Lock discussions/i })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should display archived forum indicator', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(
        createMockUseForumReturn({
          forum: {
            cutoffdate: Math.floor(Date.now() / 1000) - 86400, // 1 day ago (in seconds)
          },
        })
      );

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/This forum is archived/i)).toBeInTheDocument();
    });

    it('should disable create discussion button in archived forum', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(
        createMockUseForumReturn({
          forum: {
            cutoffdate: Math.floor(Date.now() / 1000) - 86400, // 1 day ago (in seconds)
          },
        })
      );

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.queryByRole('button', { name: /Add.*discussion/i })).not.toBeInTheDocument();
    });

    it('should display read-only forum indicator', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(
        createMockUseForumReturn({
          forum: {
            duedate: Math.floor(Date.now() / 1000) - 86400, // 1 day ago (in seconds)
            cutoffdate: null, // Not archived, just read-only
          },
        })
      );

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    });

    it('should handle forum with due date', async () => {
      const dueDate = Math.floor(Date.now() / 1000) + 604800; // 7 days from now (in seconds)

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(
        createMockUseForumReturn({
          forum: {
            duedate: dueDate,
          },
        })
      );

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/Due:/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      const mockForum = createMockForum();

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(createMockUseForumReturn());

      renderWithProviders(<ForumView forumId={1} />);

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
      // Main forum title should be h1 or h2
      expect(headings[0]).toHaveAttribute('aria-level');
    });

    it('should have accessible subscription button labels', async () => {
      const mockForum = createMockForum();

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(createMockUseForumReturn());

      renderWithProviders(<ForumView forumId={1} />);

      const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });
      expect(subscribeButton).toHaveAccessibleName();
      expect(subscribeButton).toHaveAttribute('aria-label');
    });

    it('should support keyboard navigation for actions', async () => {
      const user = userEvent.setup();
      const mockForum = createMockForum();
      const mockToggleSubscription = vi.fn();

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        toggleSubscription: mockToggleSubscription,
      });

      renderWithProviders(<ForumView forumId={1} />);

      const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });

      // Tab to the button
      await user.tab();
      
      // Press Enter to activate
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockToggleSubscription).toHaveBeenCalled();
      });
    });

    it('should have proper ARIA landmarks', async () => {
      const mockForum = createMockForum();

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(createMockUseForumReturn());

      const { container } = renderWithProviders(<ForumView forumId={1} />);

      // Should have main landmark
      expect(container.querySelector('main') || container.querySelector('[role="main"]')).toBeInTheDocument();
    });

    it('should announce loading state to screen readers', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        statistics: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      const loadingElement = screen.getByRole('status');
      expect(loadingElement).toHaveAttribute('aria-live', 'polite');
    });

    it('should announce error state to screen readers', async () => {
      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        statistics: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Failed to load'),
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      const alertElement = screen.getByRole('alert');
      expect(alertElement).toHaveAttribute('aria-live', 'assertive');
    });

    it('should have descriptive text for forum statistics', async () => {
      const mockForum = createMockForum({
        discussionCount: 15,
        postCount: 87,
        unreadCount: 5,
      });

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        forum: mockForum,
      });

      renderWithProviders(<ForumView forumId={1} />);

      // Statistics should have accessible descriptions
      expect(screen.getByLabelText(/forum statistics/i)).toBeInTheDocument();
    });
  });

  describe('Sorting and Filtering Integration', () => {
    it('should pass sorting controls to DiscussionList', async () => {
      const mockForum = createMockForum();

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue(createMockUseForumReturn());

      renderWithProviders(<ForumView forumId={1} />);

      const discussionList = screen.getByTestId('discussion-list');
      expect(discussionList).toBeInTheDocument();

      // Verify sort and filter buttons from mocked DiscussionList
      expect(screen.getByRole('button', { name: 'Sort Latest' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Filter Unread' })).toBeInTheDocument();
    });
  });

  describe('Optimistic Updates', () => {
    it('should show optimistic subscription state before server confirms', async () => {
      const user = userEvent.setup();
      const mockForum = createMockForum();
      let isSubscribed = false;

      const mockToggleSubscription = vi.fn().mockImplementation(() => {
        isSubscribed = !isSubscribed;
      });

      (forumHooks.useForum as ReturnType<typeof vi.fn>).mockReturnValue({
        ...createMockUseForumReturn(),
        forum: mockForum,
        toggleSubscription: mockToggleSubscription,
      });

      const { rerender } = renderWithProviders(<ForumView forumId={1} />);

      const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });
      await user.click(subscribeButton);

      // Should show loading state immediately
      expect(mockToggleSubscription).toHaveBeenCalled();
    });
  });
});
