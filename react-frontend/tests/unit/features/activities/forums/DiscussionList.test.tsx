/**
 * Unit tests for DiscussionList component
 * 
 * Tests cover:
 * - Discussion list rendering with proper structure
 * - Sorting options (newest, oldest, most replies, recently updated)
 * - Filtering (all, unread only, my discussions, pinned only)
 * - Pagination with page size controls
 * - Pinned discussions appearing at top
 * - Locked discussion indicators
 * - Unread badges and indicators
 * - Last post metadata display
 * - Author information and profile links
 * - Action buttons based on permissions
 * - Bulk actions for moderators
 * - Search with debounce
 * - Empty states and loading states
 * - Error handling
 * - Edge cases (deleted authors, no replies)
 * - Navigation to discussion thread
 * - Optimistic updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { DiscussionList } from '@/features/activities/forums/components/DiscussionList';

// Mock React Router's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock React Query hooks
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useMutation: (...args: any[]) => mockUseMutation(...args),
  };
});

// Mock data: discussions
const mockDiscussions = [
  {
    id: 1,
    title: 'Welcome to the course!',
    author: {
      id: 101,
      name: 'John Teacher',
      avatarUrl: '/avatars/101.jpg',
    },
    createdAt: '2024-01-15T10:00:00Z',
    replyCount: 15,
    unreadCount: 3,
    isPinned: true,
    isLocked: false,
    lastPost: {
      author: 'Jane Student',
      timestamp: '2024-01-20T14:30:00Z',
      preview: 'Thanks for the warm welcome!',
    },
  },
  {
    id: 2,
    title: 'Assignment 1 Questions',
    author: {
      id: 102,
      name: 'Alice Student',
      avatarUrl: '/avatars/102.jpg',
    },
    createdAt: '2024-01-16T09:00:00Z',
    replyCount: 8,
    unreadCount: 0,
    isPinned: false,
    isLocked: false,
    lastPost: {
      author: 'John Teacher',
      timestamp: '2024-01-19T16:45:00Z',
      preview: 'Make sure to read the rubric carefully.',
    },
  },
  {
    id: 3,
    title: 'Course Schedule Changes',
    author: {
      id: 101,
      name: 'John Teacher',
      avatarUrl: '/avatars/101.jpg',
    },
    createdAt: '2024-01-17T11:00:00Z',
    replyCount: 5,
    unreadCount: 2,
    isPinned: true,
    isLocked: true,
    lastPost: {
      author: 'John Teacher',
      timestamp: '2024-01-18T10:00:00Z',
      preview: 'This discussion is now locked.',
    },
  },
  {
    id: 4,
    title: 'Study Group Formation',
    author: {
      id: 103,
      name: 'Bob Student',
      avatarUrl: '/avatars/103.jpg',
    },
    createdAt: '2024-01-18T08:00:00Z',
    replyCount: 0,
    unreadCount: 0,
    isPinned: false,
    isLocked: false,
    lastPost: null,
  },
  {
    id: 5,
    title: 'Discussion with deleted author',
    author: {
      id: 999,
      name: 'Deleted User',
      avatarUrl: null,
      isDeleted: true,
    },
    createdAt: '2024-01-10T12:00:00Z',
    replyCount: 2,
    unreadCount: 0,
    isPinned: false,
    isLocked: false,
    lastPost: {
      author: 'Current Student',
      timestamp: '2024-01-11T09:00:00Z',
      preview: 'Still relevant discussion.',
    },
  },
];

// Mock user permissions
const mockPermissions = {
  canModerate: false,
  canPin: false,
  canLock: false,
  canDelete: false,
};

const mockModeratorPermissions = {
  canModerate: true,
  canPin: true,
  canLock: true,
  canDelete: true,
};

// Mock current user
const mockCurrentUser = {
  id: 102,
  name: 'Alice Student',
};

// Helper function to render component with providers
const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </QueryClientProvider>,
    options
  );
};

// Default props for DiscussionList
const defaultProps = {
  forumId: 1,
  currentUser: mockCurrentUser,
  permissions: mockPermissions,
};

describe('DiscussionList Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Default successful query mock
    mockUseQuery.mockReturnValue({
      data: {
        discussions: mockDiscussions,
        totalCount: mockDiscussions.length,
        hasMore: false,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    // Default mutation mock
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isLoading: false,
      isError: false,
      isSuccess: false,
      reset: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic Rendering', () => {
    it('should render discussion list with proper structure', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      // Check for main list container
      const listContainer = screen.getByRole('list', { name: /discussions/i });
      expect(listContainer).toBeInTheDocument();

      // Verify all discussions are rendered
      const discussionItems = screen.getAllByRole('listitem');
      expect(discussionItems).toHaveLength(mockDiscussions.length);
    });

    it('should display discussion titles correctly', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      mockDiscussions.forEach((discussion) => {
        expect(screen.getByText(discussion.title)).toBeInTheDocument();
      });
    });

    it('should display author information with avatar and name', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      mockDiscussions.forEach((discussion) => {
        expect(screen.getByText(discussion.author.name)).toBeInTheDocument();
        
        if (discussion.author.avatarUrl && !discussion.author.isDeleted) {
          const avatar = screen.getByAltText(`${discussion.author.name} avatar`);
          expect(avatar).toBeInTheDocument();
          expect(avatar).toHaveAttribute('src', discussion.author.avatarUrl);
        }
      });
    });

    it('should display reply count for each discussion', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      mockDiscussions.forEach((discussion) => {
        const replyText = discussion.replyCount === 1 ? '1 reply' : `${discussion.replyCount} replies`;
        expect(screen.getByText(replyText)).toBeInTheDocument();
      });
    });

    it('should display created date in readable format', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      // Check that dates are displayed (format may vary)
      expect(screen.getAllByText(/Jan|January|2024/)).toHaveLength(mockDiscussions.length);
    });
  });

  describe('Pinned Discussions', () => {
    it('should display pinned badge for pinned discussions', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const pinnedDiscussions = mockDiscussions.filter(d => d.isPinned);
      pinnedDiscussions.forEach((discussion) => {
        const discussionElement = screen.getByText(discussion.title).closest('li');
        expect(within(discussionElement!).getByText(/pinned/i)).toBeInTheDocument();
      });
    });

    it('should render pinned discussions at the top of the list', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const discussionItems = screen.getAllByRole('listitem');
      const pinnedDiscussions = mockDiscussions.filter(d => d.isPinned);
      
      // First items should be pinned
      pinnedDiscussions.forEach((_, index) => {
        expect(within(discussionItems[index]).getByText(/pinned/i)).toBeInTheDocument();
      });
    });

    it('should show pin/unpin button for moderators on pinned discussions', () => {
      renderWithProviders(
        <DiscussionList 
          {...defaultProps} 
          permissions={mockModeratorPermissions}
        />
      );

      const pinnedDiscussion = mockDiscussions.find(d => d.isPinned);
      const discussionElement = screen.getByText(pinnedDiscussion!.title).closest('li');
      
      expect(within(discussionElement!).getByLabelText(/unpin discussion/i)).toBeInTheDocument();
    });
  });

  describe('Locked Discussions', () => {
    it('should display locked indicator for locked discussions', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const lockedDiscussion = mockDiscussions.find(d => d.isLocked);
      const discussionElement = screen.getByText(lockedDiscussion!.title).closest('li');
      
      expect(within(discussionElement!).getByLabelText(/locked/i)).toBeInTheDocument();
    });

    it('should show lock/unlock button for moderators on locked discussions', () => {
      renderWithProviders(
        <DiscussionList 
          {...defaultProps} 
          permissions={mockModeratorPermissions}
        />
      );

      const lockedDiscussion = mockDiscussions.find(d => d.isLocked);
      const discussionElement = screen.getByText(lockedDiscussion!.title).closest('li');
      
      expect(within(discussionElement!).getByLabelText(/unlock discussion/i)).toBeInTheDocument();
    });

    it('should not show reply action for locked discussions to regular users', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const lockedDiscussion = mockDiscussions.find(d => d.isLocked);
      const discussionElement = screen.getByText(lockedDiscussion!.title).closest('li');
      
      expect(within(discussionElement!).queryByLabelText(/reply/i)).not.toBeInTheDocument();
    });
  });

  describe('Unread Indicators', () => {
    it('should display unread badge for discussions with unread posts', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const discussionsWithUnread = mockDiscussions.filter(d => d.unreadCount > 0);
      discussionsWithUnread.forEach((discussion) => {
        const discussionElement = screen.getByText(discussion.title).closest('li');
        const badge = within(discussionElement!).getByText(discussion.unreadCount.toString());
        
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveAttribute('aria-label', `${discussion.unreadCount} unread posts`);
      });
    });

    it('should not display unread badge for discussions with no unread posts', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const discussionsRead = mockDiscussions.filter(d => d.unreadCount === 0);
      discussionsRead.forEach((discussion) => {
        const discussionElement = screen.getByText(discussion.title).closest('li');
        expect(within(discussionElement!).queryByLabelText(/unread posts/i)).not.toBeInTheDocument();
      });
    });

    it('should highlight unread discussions visually', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const discussionWithUnread = mockDiscussions.find(d => d.unreadCount > 0);
      const discussionElement = screen.getByText(discussionWithUnread!.title).closest('li');
      
      expect(discussionElement).toHaveClass(/unread/i);
    });
  });

  describe('Last Post Metadata', () => {
    it('should display last post author and timestamp', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const discussionWithLastPost = mockDiscussions.find(d => d.lastPost);
      const discussionElement = screen.getByText(discussionWithLastPost!.title).closest('li');
      
      expect(within(discussionElement!).getByText(discussionWithLastPost!.lastPost!.author)).toBeInTheDocument();
    });

    it('should display last post preview text', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const discussionWithLastPost = mockDiscussions.find(d => d.lastPost);
      const discussionElement = screen.getByText(discussionWithLastPost!.title).closest('li');
      
      expect(within(discussionElement!).getByText(discussionWithLastPost!.lastPost!.preview)).toBeInTheDocument();
    });

    it('should show "No replies yet" for discussions with no last post', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const discussionWithoutReplies = mockDiscussions.find(d => !d.lastPost && d.replyCount === 0);
      const discussionElement = screen.getByText(discussionWithoutReplies!.title).closest('li');
      
      expect(within(discussionElement!).getByText(/no replies yet/i)).toBeInTheDocument();
    });
  });

  describe('Sorting Options', () => {
    it('should render sorting dropdown with all options', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const sortDropdown = screen.getByLabelText(/sort by/i);
      expect(sortDropdown).toBeInTheDocument();

      user.click(sortDropdown);

      expect(screen.getByText(/newest first/i)).toBeInTheDocument();
      expect(screen.getByText(/oldest first/i)).toBeInTheDocument();
      expect(screen.getByText(/most replies/i)).toBeInTheDocument();
      expect(screen.getByText(/recently updated/i)).toBeInTheDocument();
    });

    it('should sort by newest first when selected', async () => {
      const refetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions, totalCount: mockDiscussions.length },
        isLoading: false,
        isError: false,
        refetch,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const sortDropdown = screen.getByLabelText(/sort by/i);
      await user.click(sortDropdown);
      await user.click(screen.getByText(/newest first/i));

      await waitFor(() => {
        expect(refetch).toHaveBeenCalled();
      });
    });

    it('should sort by oldest first when selected', async () => {
      const refetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions, totalCount: mockDiscussions.length },
        isLoading: false,
        isError: false,
        refetch,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const sortDropdown = screen.getByLabelText(/sort by/i);
      await user.click(sortDropdown);
      await user.click(screen.getByText(/oldest first/i));

      await waitFor(() => {
        expect(refetch).toHaveBeenCalled();
      });
    });

    it('should sort by most replies when selected', async () => {
      const refetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions, totalCount: mockDiscussions.length },
        isLoading: false,
        isError: false,
        refetch,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const sortDropdown = screen.getByLabelText(/sort by/i);
      await user.click(sortDropdown);
      await user.click(screen.getByText(/most replies/i));

      await waitFor(() => {
        expect(refetch).toHaveBeenCalled();
      });
    });
  });

  describe('Filtering Controls', () => {
    it('should render filter dropdown with all options', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const filterDropdown = screen.getByLabelText(/filter discussions/i);
      expect(filterDropdown).toBeInTheDocument();

      user.click(filterDropdown);

      expect(screen.getByText(/all discussions/i)).toBeInTheDocument();
      expect(screen.getByText(/unread only/i)).toBeInTheDocument();
      expect(screen.getByText(/my discussions/i)).toBeInTheDocument();
      expect(screen.getByText(/pinned only/i)).toBeInTheDocument();
    });

    it('should filter to show only unread discussions', async () => {
      const refetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions.filter(d => d.unreadCount > 0), totalCount: 2 },
        isLoading: false,
        isError: false,
        refetch,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const filterDropdown = screen.getByLabelText(/filter discussions/i);
      await user.click(filterDropdown);
      await user.click(screen.getByText(/unread only/i));

      await waitFor(() => {
        const discussionItems = screen.getAllByRole('listitem');
        discussionItems.forEach((item) => {
          expect(within(item).getByLabelText(/unread posts/i)).toBeInTheDocument();
        });
      });
    });

    it('should filter to show only my discussions', async () => {
      const myDiscussions = mockDiscussions.filter(d => d.author.id === mockCurrentUser.id);
      const refetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: { discussions: myDiscussions, totalCount: myDiscussions.length },
        isLoading: false,
        isError: false,
        refetch,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const filterDropdown = screen.getByLabelText(/filter discussions/i);
      await user.click(filterDropdown);
      await user.click(screen.getByText(/my discussions/i));

      await waitFor(() => {
        expect(refetch).toHaveBeenCalled();
      });
    });

    it('should filter to show only pinned discussions', async () => {
      const pinnedDiscussions = mockDiscussions.filter(d => d.isPinned);
      const refetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: { discussions: pinnedDiscussions, totalCount: pinnedDiscussions.length },
        isLoading: false,
        isError: false,
        refetch,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const filterDropdown = screen.getByLabelText(/filter discussions/i);
      await user.click(filterDropdown);
      await user.click(screen.getByText(/pinned only/i));

      await waitFor(() => {
        const discussionItems = screen.getAllByRole('listitem');
        discussionItems.forEach((item) => {
          expect(within(item).getByText(/pinned/i)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Pagination', () => {
    it('should render pagination controls', () => {
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions, totalCount: 100, hasMore: true },
        isLoading: false,
        isError: false,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      expect(screen.getByLabelText(/pagination/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/next page/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/previous page/i)).toBeInTheDocument();
    });

    it('should display current page information', () => {
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions, totalCount: 100, hasMore: true },
        isLoading: false,
        isError: false,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      expect(screen.getByText(/page 1/i)).toBeInTheDocument();
    });

    it('should navigate to next page when next button clicked', async () => {
      const refetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions, totalCount: 100, hasMore: true },
        isLoading: false,
        isError: false,
        refetch,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const nextButton = screen.getByLabelText(/next page/i);
      await user.click(nextButton);

      await waitFor(() => {
        expect(refetch).toHaveBeenCalled();
      });
    });

    it('should navigate to previous page when previous button clicked', async () => {
      const refetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions, totalCount: 100, hasMore: true },
        isLoading: false,
        isError: false,
        refetch,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      // First go to page 2
      const nextButton = screen.getByLabelText(/next page/i);
      await user.click(nextButton);

      // Then go back
      const previousButton = screen.getByLabelText(/previous page/i);
      await user.click(previousButton);

      await waitFor(() => {
        expect(refetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should disable previous button on first page', () => {
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions, totalCount: 100, hasMore: true },
        isLoading: false,
        isError: false,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const previousButton = screen.getByLabelText(/previous page/i);
      expect(previousButton).toBeDisabled();
    });

    it('should disable next button on last page', () => {
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions, totalCount: 5, hasMore: false },
        isLoading: false,
        isError: false,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const nextButton = screen.getByLabelText(/next page/i);
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Page Size Controls', () => {
    it('should render page size dropdown', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const pageSizeDropdown = screen.getByLabelText(/items per page/i);
      expect(pageSizeDropdown).toBeInTheDocument();
    });

    it('should have options for 10, 20, and 50 items per page', async () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const pageSizeDropdown = screen.getByLabelText(/items per page/i);
      await user.click(pageSizeDropdown);

      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should update page size when option selected', async () => {
      const refetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions, totalCount: 100 },
        isLoading: false,
        isError: false,
        refetch,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const pageSizeDropdown = screen.getByLabelText(/items per page/i);
      await user.click(pageSizeDropdown);
      await user.click(screen.getByText('50'));

      await waitFor(() => {
        expect(refetch).toHaveBeenCalled();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should render search input', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search discussions/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('should debounce search input', async () => {
      vi.useFakeTimers();
      const refetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions, totalCount: 5 },
        isLoading: false,
        isError: false,
        refetch,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search discussions/i);
      await user.type(searchInput, 'assignment');

      // Should not trigger immediately
      expect(refetch).not.toHaveBeenCalled();

      // Fast-forward time past debounce delay
      vi.advanceTimersByTime(500);

      await waitFor(() => {
        expect(refetch).toHaveBeenCalled();
      });

      vi.useRealTimers();
    });

    it('should clear search when clear button clicked', async () => {
      const refetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions, totalCount: 5 },
        isLoading: false,
        isError: false,
        refetch,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search discussions/i);
      await user.type(searchInput, 'assignment');

      const clearButton = screen.getByLabelText(/clear search/i);
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Empty States', () => {
    it('should display empty state when no discussions exist', () => {
      mockUseQuery.mockReturnValue({
        data: { discussions: [], totalCount: 0, hasMore: false },
        isLoading: false,
        isError: false,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      expect(screen.getByText(/no discussions yet/i)).toBeInTheDocument();
      expect(screen.getByText(/be the first to start a discussion/i)).toBeInTheDocument();
    });

    it('should display empty state when no discussions match filter', () => {
      mockUseQuery.mockReturnValue({
        data: { discussions: [], totalCount: 0, hasMore: false },
        isLoading: false,
        isError: false,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      // Apply a filter
      const filterDropdown = screen.getByLabelText(/filter discussions/i);
      user.click(filterDropdown);
      user.click(screen.getByText(/unread only/i));

      expect(screen.getByText(/no discussions match your filter/i)).toBeInTheDocument();
    });

    it('should display empty state when search returns no results', async () => {
      mockUseQuery.mockReturnValue({
        data: { discussions: [], totalCount: 0, hasMore: false },
        isLoading: false,
        isError: false,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search discussions/i);
      await user.type(searchInput, 'nonexistent topic');

      await waitFor(() => {
        expect(screen.getByText(/no discussions found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should display loading skeleton while fetching discussions', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      expect(screen.getByLabelText(/loading discussions/i)).toBeInTheDocument();
      expect(screen.getAllByRole('status')).toHaveLength(3); // Skeleton items
    });

    it('should display loading skeleton for individual items', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const skeletons = screen.getAllByTestId('discussion-skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should not display loading state when data is available', () => {
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions, totalCount: 5 },
        isLoading: false,
        isError: false,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      expect(screen.queryByLabelText(/loading discussions/i)).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when fetch fails', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Failed to fetch discussions'),
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      expect(screen.getByText(/failed to load discussions/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to fetch discussions/i)).toBeInTheDocument();
    });

    it('should display retry button on error', () => {
      const refetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
        refetch,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should retry fetch when retry button clicked', async () => {
      const refetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
        refetch,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      expect(refetch).toHaveBeenCalled();
    });
  });

  describe('Action Buttons', () => {
    it('should show pin button for moderators on unpinned discussions', () => {
      renderWithProviders(
        <DiscussionList 
          {...defaultProps} 
          permissions={mockModeratorPermissions}
        />
      );

      const unpinnedDiscussion = mockDiscussions.find(d => !d.isPinned);
      const discussionElement = screen.getByText(unpinnedDiscussion!.title).closest('li');
      
      expect(within(discussionElement!).getByLabelText(/pin discussion/i)).toBeInTheDocument();
    });

    it('should show lock button for moderators on unlocked discussions', () => {
      renderWithProviders(
        <DiscussionList 
          {...defaultProps} 
          permissions={mockModeratorPermissions}
        />
      );

      const unlockedDiscussion = mockDiscussions.find(d => !d.isLocked);
      const discussionElement = screen.getByText(unlockedDiscussion!.title).closest('li');
      
      expect(within(discussionElement!).getByLabelText(/lock discussion/i)).toBeInTheDocument();
    });

    it('should show delete button for moderators', () => {
      renderWithProviders(
        <DiscussionList 
          {...defaultProps} 
          permissions={mockModeratorPermissions}
        />
      );

      const discussion = mockDiscussions[0];
      const discussionElement = screen.getByText(discussion.title).closest('li');
      
      expect(within(discussionElement!).getByLabelText(/delete discussion/i)).toBeInTheDocument();
    });

    it('should show delete button for discussion owner', () => {
      const ownDiscussion = mockDiscussions.find(d => d.author.id === mockCurrentUser.id);
      
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const discussionElement = screen.getByText(ownDiscussion!.title).closest('li');
      
      expect(within(discussionElement!).getByLabelText(/delete discussion/i)).toBeInTheDocument();
    });

    it('should not show moderator actions for regular users', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const otherUserDiscussion = mockDiscussions.find(
        d => d.author.id !== mockCurrentUser.id
      );
      const discussionElement = screen.getByText(otherUserDiscussion!.title).closest('li');
      
      expect(within(discussionElement!).queryByLabelText(/pin discussion/i)).not.toBeInTheDocument();
      expect(within(discussionElement!).queryByLabelText(/lock discussion/i)).not.toBeInTheDocument();
    });
  });

  describe('Bulk Actions', () => {
    it('should show bulk action controls for moderators', () => {
      renderWithProviders(
        <DiscussionList 
          {...defaultProps} 
          permissions={mockModeratorPermissions}
        />
      );

      expect(screen.getByLabelText(/select all/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bulk actions/i })).toBeInTheDocument();
    });

    it('should not show bulk action controls for regular users', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      expect(screen.queryByLabelText(/select all/i)).not.toBeInTheDocument();
    });

    it('should select all discussions when select all is checked', async () => {
      renderWithProviders(
        <DiscussionList 
          {...defaultProps} 
          permissions={mockModeratorPermissions}
        />
      );

      const selectAllCheckbox = screen.getByLabelText(/select all/i);
      await user.click(selectAllCheckbox);

      const checkboxes = screen.getAllByRole('checkbox');
      // All discussion checkboxes should be checked (plus the select all checkbox)
      checkboxes.forEach((checkbox) => {
        expect(checkbox).toBeChecked();
      });
    });

    it('should enable bulk actions when discussions are selected', async () => {
      renderWithProviders(
        <DiscussionList 
          {...defaultProps} 
          permissions={mockModeratorPermissions}
        />
      );

      const selectAllCheckbox = screen.getByLabelText(/select all/i);
      await user.click(selectAllCheckbox);

      const bulkActionsButton = screen.getByRole('button', { name: /bulk actions/i });
      expect(bulkActionsButton).not.toBeDisabled();
    });

    it('should show bulk delete option in bulk actions menu', async () => {
      renderWithProviders(
        <DiscussionList 
          {...defaultProps} 
          permissions={mockModeratorPermissions}
        />
      );

      const selectAllCheckbox = screen.getByLabelText(/select all/i);
      await user.click(selectAllCheckbox);

      const bulkActionsButton = screen.getByRole('button', { name: /bulk actions/i });
      await user.click(bulkActionsButton);

      expect(screen.getByText(/delete selected/i)).toBeInTheDocument();
    });

    it('should show bulk move option in bulk actions menu', async () => {
      renderWithProviders(
        <DiscussionList 
          {...defaultProps} 
          permissions={mockModeratorPermissions}
        />
      );

      const selectAllCheckbox = screen.getByLabelText(/select all/i);
      await user.click(selectAllCheckbox);

      const bulkActionsButton = screen.getByRole('button', { name: /bulk actions/i });
      await user.click(bulkActionsButton);

      expect(screen.getByText(/move selected/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to discussion thread when discussion clicked', async () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const discussion = mockDiscussions[0];
      const discussionLink = screen.getByText(discussion.title);
      
      await user.click(discussionLink);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(`/forums/discussions/${discussion.id}`);
      });
    });

    it('should navigate to author profile when author name clicked', async () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const discussion = mockDiscussions[0];
      const authorLink = screen.getAllByText(discussion.author.name)[0];
      
      await user.click(authorLink);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(`/users/${discussion.author.id}`);
      });
    });

    it('should open discussion in same window on normal click', async () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const discussion = mockDiscussions[0];
      const discussionLink = screen.getByText(discussion.title);
      
      await user.click(discussionLink);

      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle discussion with deleted author gracefully', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const deletedAuthorDiscussion = mockDiscussions.find(d => d.author.isDeleted);
      expect(screen.getByText(deletedAuthorDiscussion!.title)).toBeInTheDocument();
      expect(screen.getByText('Deleted User')).toBeInTheDocument();
    });

    it('should show placeholder avatar for deleted author', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const deletedAuthorDiscussion = mockDiscussions.find(d => d.author.isDeleted);
      const discussionElement = screen.getByText(deletedAuthorDiscussion!.title).closest('li');
      
      const avatar = within(discussionElement!).getByLabelText(/deleted user avatar/i);
      expect(avatar).toBeInTheDocument();
    });

    it('should not allow navigation to deleted author profile', async () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const deletedAuthorDiscussion = mockDiscussions.find(d => d.author.isDeleted);
      const authorName = within(
        screen.getByText(deletedAuthorDiscussion!.title).closest('li')!
      ).getByText('Deleted User');
      
      await user.click(authorName);

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should handle discussion with no replies correctly', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const noReplyDiscussion = mockDiscussions.find(d => d.replyCount === 0);
      const discussionElement = screen.getByText(noReplyDiscussion!.title).closest('li');
      
      expect(within(discussionElement!).getByText('0 replies')).toBeInTheDocument();
      expect(within(discussionElement!).getByText(/no replies yet/i)).toBeInTheDocument();
    });

    it('should handle very long discussion titles with ellipsis', () => {
      const longTitleDiscussion = {
        ...mockDiscussions[0],
        title: 'This is a very long discussion title that should be truncated with ellipsis when displayed in the list to prevent layout issues',
      };

      mockUseQuery.mockReturnValue({
        data: { discussions: [longTitleDiscussion], totalCount: 1 },
        isLoading: false,
        isError: false,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const titleElement = screen.getByText(longTitleDiscussion.title);
      expect(titleElement).toHaveStyle({ overflow: 'hidden', textOverflow: 'ellipsis' });
    });
  });

  describe('Optimistic Updates', () => {
    it('should optimistically update UI when pinning discussion', async () => {
      const mutateFn = vi.fn().mockResolvedValue({ success: true });
      mockUseMutation.mockReturnValue({
        mutate: mutateFn,
        mutateAsync: mutateFn,
        isLoading: false,
        isError: false,
      });

      renderWithProviders(
        <DiscussionList 
          {...defaultProps} 
          permissions={mockModeratorPermissions}
        />
      );

      const unpinnedDiscussion = mockDiscussions.find(d => !d.isPinned);
      const discussionElement = screen.getByText(unpinnedDiscussion!.title).closest('li');
      
      const pinButton = within(discussionElement!).getByLabelText(/pin discussion/i);
      await user.click(pinButton);

      // Should immediately show pinned badge before server responds
      await waitFor(() => {
        expect(within(discussionElement!).getByText(/pinned/i)).toBeInTheDocument();
      });
    });

    it('should optimistically update UI when locking discussion', async () => {
      const mutateFn = vi.fn().mockResolvedValue({ success: true });
      mockUseMutation.mockReturnValue({
        mutate: mutateFn,
        mutateAsync: mutateFn,
        isLoading: false,
        isError: false,
      });

      renderWithProviders(
        <DiscussionList 
          {...defaultProps} 
          permissions={mockModeratorPermissions}
        />
      );

      const unlockedDiscussion = mockDiscussions.find(d => !d.isLocked);
      const discussionElement = screen.getByText(unlockedDiscussion!.title).closest('li');
      
      const lockButton = within(discussionElement!).getByLabelText(/lock discussion/i);
      await user.click(lockButton);

      // Should immediately show locked indicator
      await waitFor(() => {
        expect(within(discussionElement!).getByLabelText(/locked/i)).toBeInTheDocument();
      });
    });

    it('should revert optimistic update if mutation fails', async () => {
      const mutateFn = vi.fn().mockRejectedValue(new Error('Failed to pin'));
      mockUseMutation.mockReturnValue({
        mutate: mutateFn,
        mutateAsync: mutateFn,
        isLoading: false,
        isError: true,
      });

      renderWithProviders(
        <DiscussionList 
          {...defaultProps} 
          permissions={mockModeratorPermissions}
        />
      );

      const unpinnedDiscussion = mockDiscussions.find(d => !d.isPinned);
      const discussionElement = screen.getByText(unpinnedDiscussion!.title).closest('li');
      
      const pinButton = within(discussionElement!).getByLabelText(/pin discussion/i);
      await user.click(pinButton);

      // Should revert back to unpinned state
      await waitFor(() => {
        expect(within(discussionElement!).queryByText(/pinned/i)).not.toBeInTheDocument();
      });

      // Should show error message
      expect(screen.getByText(/failed to pin discussion/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Layout', () => {
    it('should render in mobile layout on small screens', () => {
      // Mock small viewport
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const listContainer = screen.getByRole('list');
      expect(listContainer).toHaveClass(/mobile/i);
    });

    it('should render in desktop layout on large screens', () => {
      // Mock large viewport
      global.innerWidth = 1920;
      global.dispatchEvent(new Event('resize'));

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const listContainer = screen.getByRole('list');
      expect(listContainer).toHaveClass(/desktop/i);
    });

    it('should hide author avatar on mobile', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const avatars = screen.queryAllByAltText(/avatar/i);
      avatars.forEach((avatar) => {
        expect(avatar).toHaveClass(/hidden-mobile/i);
      });
    });

    it('should show simplified metadata on mobile', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      renderWithProviders(<DiscussionList {...defaultProps} />);

      // Should show only essential info on mobile
      expect(screen.queryByText(/last post by/i)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for discussions', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const list = screen.getByRole('list', { name: /discussions/i });
      expect(list).toBeInTheDocument();

      const items = screen.getAllByRole('listitem');
      items.forEach((item) => {
        expect(item).toHaveAttribute('aria-label');
      });
    });

    it('should have accessible sort dropdown', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const sortDropdown = screen.getByLabelText(/sort by/i);
      expect(sortDropdown).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('should have accessible filter dropdown', () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const filterDropdown = screen.getByLabelText(/filter discussions/i);
      expect(filterDropdown).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('should announce loading state to screen readers', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const loadingAnnouncement = screen.getByLabelText(/loading discussions/i);
      expect(loadingAnnouncement).toHaveAttribute('aria-live', 'polite');
    });

    it('should announce errors to screen readers', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Failed to load'),
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      const errorAnnouncement = screen.getByRole('alert');
      expect(errorAnnouncement).toHaveAttribute('aria-live', 'assertive');
    });

    it('should support keyboard navigation between discussions', async () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const firstDiscussion = screen.getByText(mockDiscussions[0].title);
      firstDiscussion.focus();

      // Press Tab to move to next discussion
      await user.keyboard('{Tab}');

      const secondDiscussion = screen.getByText(mockDiscussions[1].title);
      expect(secondDiscussion).toHaveFocus();
    });

    it('should support Enter key to open discussion', async () => {
      renderWithProviders(<DiscussionList {...defaultProps} />);

      const firstDiscussion = screen.getByText(mockDiscussions[0].title);
      firstDiscussion.focus();

      await user.keyboard('{Enter}');

      expect(mockNavigate).toHaveBeenCalledWith(`/forums/discussions/${mockDiscussions[0].id}`);
    });
  });

  describe('Concurrent Edits', () => {
    it('should handle concurrent post edits gracefully', async () => {
      const initialData = { discussions: mockDiscussions, totalCount: 5 };
      const updatedData = {
        discussions: mockDiscussions.map(d => 
          d.id === 1 ? { ...d, replyCount: d.replyCount + 1 } : d
        ),
        totalCount: 5,
      };

      let callCount = 0;
      mockUseQuery.mockImplementation(() => {
        callCount++;
        return {
          data: callCount === 1 ? initialData : updatedData,
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        };
      });

      const { rerender } = renderWithProviders(<DiscussionList {...defaultProps} />);

      // Initial render
      expect(screen.getByText('15 replies')).toBeInTheDocument();

      // Simulate concurrent edit by another user
      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <BrowserRouter>
            <DiscussionList {...defaultProps} />
          </BrowserRouter>
        </QueryClientProvider>
      );

      // Should update to show new reply count
      await waitFor(() => {
        expect(screen.getByText('16 replies')).toBeInTheDocument();
      });
    });

    it('should show notification when discussions are updated by others', async () => {
      const refetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: { discussions: mockDiscussions, totalCount: 5 },
        isLoading: false,
        isError: false,
        refetch,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      // Simulate websocket notification of new post
      const newPostEvent = new CustomEvent('forum:new-post', {
        detail: { discussionId: 1 },
      });
      window.dispatchEvent(newPostEvent);

      await waitFor(() => {
        expect(screen.getByText(/new posts available/i)).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      expect(refetch).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should virtualize long lists for better performance', () => {
      const manyDiscussions = Array.from({ length: 100 }, (_, i) => ({
        ...mockDiscussions[0],
        id: i + 1,
        title: `Discussion ${i + 1}`,
      }));

      mockUseQuery.mockReturnValue({
        data: { discussions: manyDiscussions, totalCount: 100 },
        isLoading: false,
        isError: false,
      });

      renderWithProviders(<DiscussionList {...defaultProps} />);

      // With virtualization, not all items should be rendered
      const renderedItems = screen.getAllByRole('listitem');
      expect(renderedItems.length).toBeLessThan(manyDiscussions.length);
    });

    it('should memoize discussion items to prevent unnecessary re-renders', () => {
      const { rerender } = renderWithProviders(<DiscussionList {...defaultProps} />);

      const firstRender = screen.getAllByRole('listitem');

      // Re-render with same props
      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <BrowserRouter>
            <DiscussionList {...defaultProps} />
          </BrowserRouter>
        </QueryClientProvider>
      );

      const secondRender = screen.getAllByRole('listitem');

      // Items should be the same instances (memoized)
      expect(firstRender[0]).toBe(secondRender[0]);
    });
  });
});

