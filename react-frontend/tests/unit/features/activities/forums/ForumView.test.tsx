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

// Mock the useForum hook
vi.mock('@/features/activities/forums/hooks/useForum');

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
  courseId: 100,
  courseModuleId: 200,
  name: 'General Discussion Forum',
  description: 'This is a forum for general course discussions and announcements.',
  type: 'standard' as ForumType,
  introFormat: 1,
  assessTimeStart: 0,
  assessTimeFinish: 0,
  maxBytes: 512000,
  maxAttachments: 5,
  forceSubscribe: 0,
  trackingType: 1,
  rssType: 0,
  rssArticles: 0,
  timeModified: Date.now(),
  warnAfter: 0,
  blockAfter: 0,
  blockPeriod: 0,
  completionDiscussions: 0,
  completionReplies: 0,
  completionPosts: 0,
  displayWordCount: false,
  lockDiscussionsAfter: 0,
  dueDate: null,
  cutOffDate: null,
  ...overrides,
});

/**
 * Test helper to create mock forum statistics
 */
const createMockStatistics = (overrides?: Partial<ForumStatistics>): ForumStatistics => ({
  totalDiscussions: 15,
  totalPosts: 87,
  unreadPosts: 5,
  unreadDiscussions: 3,
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render forum header with title and description', async () => {
      const mockForum = createMockForum();
      const mockStatistics = createMockStatistics();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: mockStatistics,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      // Verify forum title
      expect(screen.getByRole('heading', { name: 'General Discussion Forum' })).toBeInTheDocument();

      // Verify forum description
      expect(screen.getByText('This is a forum for general course discussions and announcements.')).toBeInTheDocument();
    });

    it('should display forum metadata correctly', async () => {
      const mockForum = createMockForum({
        maxBytes: 1048576, // 1MB
        maxAttachments: 3,
      });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      // Verify metadata display
      expect(screen.getByText(/Maximum attachment size/i)).toBeInTheDocument();
      expect(screen.getByText(/1 MB/i)).toBeInTheDocument();
      expect(screen.getByText(/Maximum attachments/i)).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render discussion list integration', async () => {
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      // Verify DiscussionList is rendered
      expect(screen.getByTestId('discussion-list')).toBeInTheDocument();
      expect(screen.getByText('Discussion List for Forum 1')).toBeInTheDocument();
    });
  });

  describe('Forum Types', () => {
    it('should display indicator for single discussion forum', async () => {
      const mockForum = createMockForum({ type: 'single' });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/Single discussion/i)).toBeInTheDocument();
    });

    it('should display indicator for standard forum', async () => {
      const mockForum = createMockForum({ type: 'standard' });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/Standard forum/i)).toBeInTheDocument();
    });

    it('should display indicator for Q&A forum', async () => {
      const mockForum = createMockForum({ type: 'qanda' });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/Q&A forum/i)).toBeInTheDocument();
    });

    it('should display indicator for blog-style forum', async () => {
      const mockForum = createMockForum({ type: 'blog' });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/Blog-style/i)).toBeInTheDocument();
    });
  });

  describe('Subscription Functionality', () => {
    it('should display subscription button when not subscribed', async () => {
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });
      expect(subscribeButton).toBeInTheDocument();
      expect(subscribeButton).not.toHaveAttribute('aria-pressed', 'true');
    });

    it('should display unsubscribe button when subscribed', async () => {
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: true,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      const unsubscribeButton = screen.getByRole('button', { name: /Unsubscribe/i });
      expect(unsubscribeButton).toBeInTheDocument();
      expect(unsubscribeButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should call toggleSubscription when subscription button is clicked', async () => {
      const user = userEvent.setup();
      const mockForum = createMockForum();
      const mockToggleSubscription = vi.fn();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: mockToggleSubscription,
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });
      await user.click(subscribeButton);

      expect(mockToggleSubscription).toHaveBeenCalledTimes(1);
    });

    it('should disable subscription button while toggling', async () => {
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: true,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });
      expect(subscribeButton).toBeDisabled();
    });

    it('should display subscription status indicator', async () => {
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: true,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/You are subscribed/i)).toBeInTheDocument();
    });
  });

  describe('Create Discussion Button', () => {
    it('should display create discussion button with permission', async () => {
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
        canCreateDiscussion: true,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByRole('button', { name: /Add.*discussion/i })).toBeInTheDocument();
    });

    it('should not display create discussion button without permission', async () => {
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
        canCreateDiscussion: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.queryByRole('button', { name: /Add.*discussion/i })).not.toBeInTheDocument();
    });

    it('should hide create discussion button in single discussion forum', async () => {
      const mockForum = createMockForum({ type: 'single' });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
        canCreateDiscussion: true,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      // Single discussion forums don't allow creating new discussions
      expect(screen.queryByRole('button', { name: /Add.*discussion/i })).not.toBeInTheDocument();
    });
  });

  describe('Forum Statistics', () => {
    it('should display total discussions count', async () => {
      const mockForum = createMockForum();
      const mockStatistics = createMockStatistics({ totalDiscussions: 25 });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: mockStatistics,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/25.*discussion/i)).toBeInTheDocument();
    });

    it('should display total posts count', async () => {
      const mockForum = createMockForum();
      const mockStatistics = createMockStatistics({ totalPosts: 150 });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: mockStatistics,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/150.*post/i)).toBeInTheDocument();
    });

    it('should display unread posts count', async () => {
      const mockForum = createMockForum();
      const mockStatistics = createMockStatistics({ unreadPosts: 8 });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: mockStatistics,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/8.*unread/i)).toBeInTheDocument();
    });

    it('should display unread discussions count', async () => {
      const mockForum = createMockForum();
      const mockStatistics = createMockStatistics({ unreadDiscussions: 4 });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: mockStatistics,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/4.*unread.*discussion/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading skeleton during data fetch', async () => {
      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
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
      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
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
      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
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

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
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

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
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
      const mockForum = createMockForum();
      const mockStatistics = createMockStatistics({
        totalDiscussions: 0,
        totalPosts: 0,
        unreadPosts: 0,
        unreadDiscussions: 0,
      });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: mockStatistics,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
        canCreateDiscussion: true,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/No discussions yet/i)).toBeInTheDocument();
      expect(screen.getByText(/Be the first/i)).toBeInTheDocument();
    });

    it('should show appropriate message in empty state without create permission', async () => {
      const mockForum = createMockForum();
      const mockStatistics = createMockStatistics({
        totalDiscussions: 0,
        totalPosts: 0,
      });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: mockStatistics,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
        canCreateDiscussion: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/No discussions yet/i)).toBeInTheDocument();
      expect(screen.queryByText(/Be the first/i)).not.toBeInTheDocument();
    });
  });

  describe('Permission-Based Actions', () => {
    it('should display moderator actions for users with permission', async () => {
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
        canModerate: true,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByRole('button', { name: /Moderate/i })).toBeInTheDocument();
    });

    it('should not display moderator actions for regular students', async () => {
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
        canModerate: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.queryByRole('button', { name: /Moderate/i })).not.toBeInTheDocument();
    });

    it('should display move discussions option for moderators', async () => {
      const user = userEvent.setup();
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
        canModerate: true,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      const moderateButton = screen.getByRole('button', { name: /Moderate/i });
      await user.click(moderateButton);

      expect(screen.getByRole('menuitem', { name: /Move discussions/i })).toBeInTheDocument();
    });

    it('should display lock discussions option for moderators', async () => {
      const user = userEvent.setup();
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
        canModerate: true,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      const moderateButton = screen.getByRole('button', { name: /Moderate/i });
      await user.click(moderateButton);

      expect(screen.getByRole('menuitem', { name: /Lock discussions/i })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should display archived forum indicator', async () => {
      const mockForum = createMockForum({
        cutOffDate: Date.now() - 86400000, // 1 day ago
      });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
        isArchived: true,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/This forum is archived/i)).toBeInTheDocument();
    });

    it('should disable create discussion button in archived forum', async () => {
      const mockForum = createMockForum({
        cutOffDate: Date.now() - 86400000,
      });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
        canCreateDiscussion: false,
        isArchived: true,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.queryByRole('button', { name: /Add.*discussion/i })).not.toBeInTheDocument();
    });

    it('should display read-only forum indicator', async () => {
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
        isReadOnly: true,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/Read-only forum/i)).toBeInTheDocument();
    });

    it('should handle forum with due date', async () => {
      const dueDate = Date.now() + 604800000; // 7 days from now
      const mockForum = createMockForum({ dueDate });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      expect(screen.getByText(/Due:/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
      // Main forum title should be h1 or h2
      expect(headings[0]).toHaveAttribute('aria-level');
    });

    it('should have accessible subscription button labels', async () => {
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });
      expect(subscribeButton).toHaveAccessibleName();
      expect(subscribeButton).toHaveAttribute('aria-label');
    });

    it('should support keyboard navigation for actions', async () => {
      const user = userEvent.setup();
      const mockForum = createMockForum();
      const mockToggleSubscription = vi.fn();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: mockToggleSubscription,
        isTogglingSubscription: false,
        canCreateDiscussion: true,
      } as any);

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

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      const { container } = renderWithProviders(<ForumView forumId={1} />);

      // Should have main landmark
      expect(container.querySelector('main') || container.querySelector('[role="main"]')).toBeInTheDocument();
    });

    it('should announce loading state to screen readers', async () => {
      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
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
      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
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
      const mockForum = createMockForum();
      const mockStatistics = createMockStatistics({
        totalDiscussions: 15,
        totalPosts: 87,
        unreadPosts: 5,
      });

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: mockStatistics,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

      renderWithProviders(<ForumView forumId={1} />);

      // Statistics should have accessible descriptions
      expect(screen.getByLabelText(/forum statistics/i)).toBeInTheDocument();
    });
  });

  describe('Sorting and Filtering Integration', () => {
    it('should pass sorting controls to DiscussionList', async () => {
      const mockForum = createMockForum();

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: vi.fn(),
        isTogglingSubscription: false,
      } as any);

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

      const { rerender } = renderWithProviders(<ForumView forumId={1} />);

      vi.spyOn(forumHooks, 'useForum').mockReturnValue({
        data: mockForum,
        statistics: createMockStatistics(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isSubscribed: false,
        toggleSubscription: mockToggleSubscription,
        isTogglingSubscription: false,
      } as any);

      const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });
      await user.click(subscribeButton);

      // Should show loading state immediately
      expect(mockToggleSubscription).toHaveBeenCalled();
    });
  });
});
