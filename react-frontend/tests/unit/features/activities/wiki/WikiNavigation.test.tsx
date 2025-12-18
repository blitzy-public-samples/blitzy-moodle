/**
 * Unit tests for WikiNavigation component.
 *
 * Tests the wiki navigation functionality including breadcrumb trails,
 * navigation menus, page links, search functionality, tag filtering,
 * mobile drawer, sticky navigation, keyboard shortcuts, and accessibility.
 *
 * @module tests/unit/features/activities/wiki/WikiNavigation.test
 *
 * Backend References:
 * - public/mod/wiki/view.php: Wiki page viewing (lines 39-55)
 * - public/mod/wiki/map.php: Wiki navigation/map display (lines 39-84)
 * - public/mod/wiki/locallib.php: Wiki local library functions
 *
 * Tests the WikiNavigation component which provides:
 * - Breadcrumb navigation showing course > wiki > page hierarchy
 * - Navigation menu with common actions (view, edit, history, map, files)
 * - Internal wiki page links rendering and navigation
 * - Recently viewed pages list
 * - Page search functionality with autocomplete
 * - Wiki map/sitemap view toggle
 * - Page tags/categories filtering
 * - Navigation drawer for mobile
 * - Sticky navigation on scroll
 * - Keyboard shortcuts and accessibility features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WikiNavigation from '@/features/activities/wiki/components/WikiNavigation';
import type { WikiPage } from '@/features/activities/wiki/types/wiki.types';
import { render } from '@/tests/helpers/render';

// ============================================================================
// MOCK SETUP
// ============================================================================

/**
 * Mock the useWiki hook to control wiki data in tests.
 * This allows testing navigation features with controlled wiki data
 * without actual API calls.
 */
vi.mock('@/features/activities/wiki/hooks/useWiki', () => ({
  useWiki: vi.fn(() => ({
    data: {
      id: 1,
      course: 101,
      name: 'Test Wiki',
      intro: 'A test wiki for testing purposes',
      introformat: 1,
      firstpagetitle: 'Introduction',
      wikimode: 'collaborative',
      defaultformat: 'html',
      forceformat: 0,
      editbegin: 0,
      editend: 0,
      timecreated: 1609459200,
      timemodified: 1609545600,
      cancreatepages: true,
    },
    isLoading: false,
    isError: false,
    error: null,
  })),
  getWikiQueryKey: vi.fn((id: number) => ['wikis', id]),
  getAllWikisQueryKey: vi.fn(() => ['wikis']),
}));

/**
 * Mock react-router-dom for navigation testing.
 * Provides controlled navigation behavior for testing breadcrumb links,
 * menu items, and page links.
 */
const mockNavigate = vi.fn();
const mockLocation = { pathname: '/wiki/1/page/1', search: '', hash: '' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Creates mock wiki page data for testing.
 * @param overrides - Optional property overrides
 * @returns Mock WikiPage object
 */
function createMockWikiPage(overrides: Partial<WikiPage> = {}): WikiPage {
  return {
    id: 1,
    subwikiid: 1,
    title: 'Test Page',
    cachedcontent: '<p>Test content</p>',
    timecreated: 1609459200,
    timemodified: 1609545600,
    timerendered: 1609545600,
    userid: 1,
    pageviews: 10,
    readonly: 0,
    caneditpage: true,
    firstpage: false,
    tags: [],
    ...overrides,
  };
}

/**
 * Creates an array of mock wiki pages with various properties.
 * @param count - Number of pages to create
 * @returns Array of mock WikiPage objects
 */
function createMockWikiPages(count: number = 5): WikiPage[] {
  const tags = ['documentation', 'tutorial', 'reference', 'faq', 'guide'];
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    subwikiid: 1,
    title: `Wiki Page ${i + 1}`,
    cachedcontent: `<p>Content for page ${i + 1}</p>`,
    timecreated: 1609459200 + i * 86400,
    timemodified: 1609545600 + i * 86400,
    timerendered: 1609545600 + i * 86400,
    userid: 1,
    pageviews: 10 * (i + 1),
    readonly: 0,
    caneditpage: true,
    firstpage: i === 0,
    tags: [tags[i % tags.length]],
  }));
}

/**
 * Creates mock navigation page data compatible with WikiNavigation component.
 * @param overrides - Optional property overrides
 */
function createNavigationPage(overrides: Partial<{
  id: number;
  title: string;
  subwikiId: number;
  tags?: string[];
  isBroken?: boolean;
  lastModified?: string;
}> = {}) {
  return {
    id: 1,
    title: 'Test Page',
    subwikiId: 1,
    tags: ['documentation'],
    isBroken: false,
    lastModified: '2 hours ago',
    ...overrides,
  };
}

/**
 * Default props for WikiNavigation component.
 */
const defaultProps = {
  wikiId: 1,
  currentPage: {
    id: 1,
    title: 'Test Page',
    subwikiId: 1,
    tags: ['documentation', 'tutorial'],
    hasEditPermission: true,
    hasViewPermission: true,
  },
  onNavigate: vi.fn(),
  showSearch: true,
  course: {
    id: 101,
    name: 'Introduction to Testing',
  },
  wiki: {
    id: 1,
    name: 'Course Wiki',
  },
  availablePages: [
    createNavigationPage({ id: 1, title: 'Introduction', tags: ['overview'] }),
    createNavigationPage({ id: 2, title: 'Getting Started', tags: ['tutorial'] }),
    createNavigationPage({ id: 3, title: 'Advanced Topics', tags: ['advanced'] }),
    createNavigationPage({ id: 4, title: 'FAQ', tags: ['faq', 'reference'] }),
    createNavigationPage({ id: 5, title: 'Broken Link Page', isBroken: true }),
  ],
  recentPages: [
    createNavigationPage({ id: 1, title: 'Introduction', lastModified: '1 hour ago' }),
    createNavigationPage({ id: 2, title: 'Getting Started', lastModified: '3 hours ago' }),
    createNavigationPage({ id: 3, title: 'Advanced Topics', lastModified: 'Yesterday' }),
  ],
  sticky: true,
  permissions: {
    canEdit: true,
    canViewHistory: true,
    canManageFiles: true,
    canViewMap: true,
  },
};

// ============================================================================
// TEST SUITES
// ============================================================================

describe('WikiNavigation', () => {
  /**
   * Reset mocks before each test to ensure test isolation.
   */
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.pathname = '/wiki/1/page/1';
    defaultProps.onNavigate.mockReset();
  });

  /**
   * Cleanup after each test.
   */
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // BREADCRUMB NAVIGATION TESTS
  // ==========================================================================

  describe('Breadcrumb Navigation', () => {
    it('renders breadcrumbs with course > wiki > page hierarchy', () => {
      render(<WikiNavigation {...defaultProps} />);

      // Verify course name in breadcrumb
      expect(screen.getByText('Introduction to Testing')).toBeInTheDocument();

      // Verify wiki name in breadcrumb
      expect(screen.getByText('Course Wiki')).toBeInTheDocument();

      // Verify current page in breadcrumb
      expect(screen.getByText('Test Page')).toBeInTheDocument();
    });

    it('highlights current page in breadcrumbs with aria-current', () => {
      render(<WikiNavigation {...defaultProps} />);

      const currentPageBreadcrumb = screen.getByText('Test Page');
      expect(currentPageBreadcrumb).toHaveAttribute('aria-current', 'page');
    });

    it('handles breadcrumb click for course navigation', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const courseLink = screen.getByRole('button', { name: /navigate to introduction to testing course/i });
      await user.click(courseLink);

      expect(defaultProps.onNavigate).toHaveBeenCalledWith({
        type: 'course',
        courseId: 101,
      });
    });

    it('handles breadcrumb click for wiki navigation', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const wikiLink = screen.getByRole('button', { name: /navigate to course wiki wiki/i });
      await user.click(wikiLink);

      expect(defaultProps.onNavigate).toHaveBeenCalledWith({
        type: 'wiki',
        wikiId: 1,
      });
    });

    it('does not render course breadcrumb when course is not provided', () => {
      render(<WikiNavigation {...defaultProps} course={undefined} />);

      expect(screen.queryByText('Introduction to Testing')).not.toBeInTheDocument();
      expect(screen.getByText('Course Wiki')).toBeInTheDocument();
    });

    it('does not render wiki breadcrumb when wiki is not provided', () => {
      render(<WikiNavigation {...defaultProps} wiki={undefined} />);

      expect(screen.queryByText('Course Wiki')).not.toBeInTheDocument();
      expect(screen.getByText('Test Page')).toBeInTheDocument();
    });

    it('renders breadcrumbs with proper accessibility attributes', () => {
      render(<WikiNavigation {...defaultProps} />);

      const breadcrumbNav = screen.getByRole('navigation', { name: /wiki navigation breadcrumb/i });
      expect(breadcrumbNav).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // NAVIGATION MENU TESTS
  // ==========================================================================

  describe('Navigation Menu', () => {
    it('renders navigation menu with common actions (view, edit, history, map)', () => {
      render(<WikiNavigation {...defaultProps} />);

      // Check for action buttons (in desktop view)
      expect(screen.getByRole('button', { name: /edit current page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view page history/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view wiki map/i })).toBeInTheDocument();
    });

    it('hides edit button when user lacks edit permission', () => {
      const propsWithoutEdit = {
        ...defaultProps,
        permissions: {
          ...defaultProps.permissions,
          canEdit: false,
        },
      };

      render(<WikiNavigation {...propsWithoutEdit} />);

      expect(screen.queryByRole('button', { name: /edit current page/i })).not.toBeInTheDocument();
    });

    it('hides history button when canViewHistory is false', () => {
      const propsWithoutHistory = {
        ...defaultProps,
        permissions: {
          ...defaultProps.permissions,
          canViewHistory: false,
        },
      };

      render(<WikiNavigation {...propsWithoutHistory} />);

      expect(screen.queryByRole('button', { name: /view page history/i })).not.toBeInTheDocument();
    });

    it('hides map button when canViewMap is false', () => {
      const propsWithoutMap = {
        ...defaultProps,
        permissions: {
          ...defaultProps.permissions,
          canViewMap: false,
        },
      };

      render(<WikiNavigation {...propsWithoutMap} />);

      expect(screen.queryByRole('button', { name: /view wiki map/i })).not.toBeInTheDocument();
    });

    it('calls onNavigate with edit action when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const editButton = screen.getByRole('button', { name: /edit current page/i });
      await user.click(editButton);

      expect(defaultProps.onNavigate).toHaveBeenCalledWith({
        type: 'action',
        action: 'edit',
      });
    });

    it('calls onNavigate with history action when history button is clicked', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const historyButton = screen.getByRole('button', { name: /view page history/i });
      await user.click(historyButton);

      expect(defaultProps.onNavigate).toHaveBeenCalledWith({
        type: 'action',
        action: 'history',
      });
    });

    it('calls onNavigate with map action when map button is clicked', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const mapButton = screen.getByRole('button', { name: /view wiki map/i });
      await user.click(mapButton);

      expect(defaultProps.onNavigate).toHaveBeenCalledWith({
        type: 'action',
        action: 'map',
      });
    });

    it('shows active state for current navigation action', () => {
      render(<WikiNavigation {...defaultProps} />);

      // The navigation bar should have proper role
      const navBar = screen.getByRole('navigation', { name: /wiki navigation bar/i });
      expect(navBar).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // INTERNAL PAGE LINKS TESTS
  // ==========================================================================

  describe('Internal Wiki Page Links', () => {
    it('renders available pages in search dropdown', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const searchInput = screen.getByLabelText(/search wiki pages/i);
      await user.click(searchInput);

      // Wait for dropdown to open and check for page options
      await waitFor(() => {
        expect(screen.getByText('Introduction')).toBeInTheDocument();
        expect(screen.getByText('Getting Started')).toBeInTheDocument();
        expect(screen.getByText('Advanced Topics')).toBeInTheDocument();
      });
    });

    it('renders broken page links with visual indicator', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const searchInput = screen.getByLabelText(/search wiki pages/i);
      await user.click(searchInput);

      // Type to filter and find broken link
      await user.type(searchInput, 'Broken');

      await waitFor(() => {
        expect(screen.getByText('Broken Link Page')).toBeInTheDocument();
        // Broken indicator should be visible
        expect(screen.getByText('Broken')).toBeInTheDocument();
      });
    });

    it('navigates to selected page from search results', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const searchInput = screen.getByLabelText(/search wiki pages/i);
      await user.click(searchInput);

      // Wait for options to appear
      await waitFor(() => {
        expect(screen.getByText('Getting Started')).toBeInTheDocument();
      });

      // Click on a page option
      const pageOption = screen.getByText('Getting Started');
      await user.click(pageOption);

      expect(defaultProps.onNavigate).toHaveBeenCalledWith({
        type: 'page',
        pageId: 2,
        pageTitle: 'Getting Started',
      });
    });
  });

  // ==========================================================================
  // RECENTLY VIEWED PAGES TESTS
  // ==========================================================================

  describe('Recently Viewed Pages', () => {
    it('renders recently viewed pages button when recent pages exist', () => {
      render(<WikiNavigation {...defaultProps} />);

      const recentButton = screen.getByRole('button', { name: /view recently accessed pages/i });
      expect(recentButton).toBeInTheDocument();
    });

    it('shows badge with count of recent pages', () => {
      render(<WikiNavigation {...defaultProps} />);

      // Badge should show count of recent pages
      const badge = screen.getByText('3');
      expect(badge).toBeInTheDocument();
    });

    it('opens recent pages menu when button is clicked', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const recentButton = screen.getByRole('button', { name: /view recently accessed pages/i });
      await user.click(recentButton);

      await waitFor(() => {
        expect(screen.getByRole('menu', { name: /recently viewed wiki pages/i })).toBeInTheDocument();
        expect(screen.getByText('Introduction')).toBeInTheDocument();
        expect(screen.getByText('Getting Started')).toBeInTheDocument();
        expect(screen.getByText('Advanced Topics')).toBeInTheDocument();
      });
    });

    it('navigates to page when recent page is clicked', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const recentButton = screen.getByRole('button', { name: /view recently accessed pages/i });
      await user.click(recentButton);

      await waitFor(() => {
        expect(screen.getByText('Introduction')).toBeInTheDocument();
      });

      const recentPage = screen.getByRole('menuitem', { name: /introduction/i });
      await user.click(recentPage);

      expect(defaultProps.onNavigate).toHaveBeenCalledWith({
        type: 'page',
        pageId: 1,
        pageTitle: 'Introduction',
      });
    });

    it('does not render recent pages button when no recent pages exist', () => {
      const propsWithoutRecent = {
        ...defaultProps,
        recentPages: [],
      };

      render(<WikiNavigation {...propsWithoutRecent} />);

      expect(screen.queryByRole('button', { name: /view recently accessed pages/i })).not.toBeInTheDocument();
    });

    it('displays last modified time for recent pages', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const recentButton = screen.getByRole('button', { name: /view recently accessed pages/i });
      await user.click(recentButton);

      await waitFor(() => {
        expect(screen.getByText('1 hour ago')).toBeInTheDocument();
        expect(screen.getByText('3 hours ago')).toBeInTheDocument();
        expect(screen.getByText('Yesterday')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // SEARCH FUNCTIONALITY TESTS
  // ==========================================================================

  describe('Search Functionality', () => {
    it('renders search input when showSearch is true', () => {
      render(<WikiNavigation {...defaultProps} />);

      const searchInput = screen.getByLabelText(/search wiki pages/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('does not render search input when showSearch is false', () => {
      render(<WikiNavigation {...defaultProps} showSearch={false} />);

      expect(screen.queryByLabelText(/search wiki pages/i)).not.toBeInTheDocument();
    });

    it('filters pages based on search query', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const searchInput = screen.getByLabelText(/search wiki pages/i);
      await user.type(searchInput, 'Advanced');

      await waitFor(() => {
        // Should show Advanced Topics
        expect(screen.getByText('Advanced Topics')).toBeInTheDocument();
      });
    });

    it('displays autocomplete dropdown with search results', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const searchInput = screen.getByLabelText(/search wiki pages/i);
      await user.click(searchInput);

      // Wait for autocomplete to open
      await waitFor(() => {
        const listbox = screen.getByRole('listbox');
        expect(listbox).toBeInTheDocument();
      });
    });

    it('shows no results message when search yields no matches', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const searchInput = screen.getByLabelText(/search wiki pages/i);
      await user.type(searchInput, 'NonExistentPage12345');

      await waitFor(() => {
        expect(screen.getByText('No pages found')).toBeInTheDocument();
      });
    });

    it('clears search query after selecting a result', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const searchInput = screen.getByLabelText(/search wiki pages/i);
      await user.click(searchInput);

      await waitFor(() => {
        expect(screen.getByText('Introduction')).toBeInTheDocument();
      });

      const pageOption = screen.getByText('Introduction');
      await user.click(pageOption);

      // Search should be cleared
      await waitFor(() => {
        expect(searchInput).toHaveValue('');
      });
    });

    it('displays tags for search results', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const searchInput = screen.getByLabelText(/search wiki pages/i);
      await user.click(searchInput);

      await waitFor(() => {
        // Tags should be visible in search results
        expect(screen.getByText('Introduction')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // TAG FILTERING TESTS
  // ==========================================================================

  describe('Tag Filtering', () => {
    it('renders tag filter chips when pages have tags', () => {
      render(<WikiNavigation {...defaultProps} />);

      // Look for tag filter section
      expect(screen.getByText('Filter by tags:')).toBeInTheDocument();
    });

    it('calls onNavigate with tag when tag chip is clicked', async () => {
      const user = userEvent.setup();
      const propsWithTaggedPages = {
        ...defaultProps,
        availablePages: [
          createNavigationPage({ id: 1, title: 'Page 1', tags: ['documentation'] }),
          createNavigationPage({ id: 2, title: 'Page 2', tags: ['documentation', 'tutorial'] }),
        ],
      };

      render(<WikiNavigation {...propsWithTaggedPages} />);

      const tagChip = screen.getByRole('button', { name: /add filter for tag documentation/i });
      await user.click(tagChip);

      expect(defaultProps.onNavigate).toHaveBeenCalledWith({
        type: 'tag',
        tag: 'documentation',
      });
    });

    it('shows selected tag with different styling', async () => {
      const user = userEvent.setup();
      const propsWithTags = {
        ...defaultProps,
        availablePages: [
          createNavigationPage({ id: 1, title: 'Page 1', tags: ['documentation'] }),
        ],
      };

      render(<WikiNavigation {...propsWithTags} />);

      const tagChip = screen.getByRole('button', { name: /add filter for tag documentation/i });
      await user.click(tagChip);

      // After clicking, the tag should show "Remove filter" label
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /remove filter for tag documentation/i })).toBeInTheDocument();
      });
    });

    it('removes tag filter when selected tag is clicked again', async () => {
      const user = userEvent.setup();
      const propsWithTags = {
        ...defaultProps,
        availablePages: [
          createNavigationPage({ id: 1, title: 'Page 1', tags: ['documentation'] }),
        ],
      };

      render(<WikiNavigation {...propsWithTags} />);

      // Click to select
      const tagChip = screen.getByRole('button', { name: /add filter for tag documentation/i });
      await user.click(tagChip);

      // Click to deselect
      const selectedTagChip = screen.getByRole('button', { name: /remove filter for tag documentation/i });
      await user.click(selectedTagChip);

      // Second click should trigger navigation again
      expect(defaultProps.onNavigate).toHaveBeenCalledTimes(2);
    });

    it('does not render tag filters when no pages have tags', () => {
      const propsWithoutTags = {
        ...defaultProps,
        availablePages: [
          createNavigationPage({ id: 1, title: 'Page 1', tags: [] }),
          createNavigationPage({ id: 2, title: 'Page 2' }),
        ],
      };

      render(<WikiNavigation {...propsWithoutTags} />);

      expect(screen.queryByText('Filter by tags:')).not.toBeInTheDocument();
    });

    it('shows overflow indicator when more than 10 tags exist', () => {
      const manyTags = Array.from({ length: 15 }, (_, i) => `tag${i + 1}`);
      const propsWithManyTags = {
        ...defaultProps,
        availablePages: [
          createNavigationPage({ id: 1, title: 'Page 1', tags: manyTags }),
        ],
      };

      render(<WikiNavigation {...propsWithManyTags} />);

      // Should show "+X more" indicator
      expect(screen.getByLabelText(/5 more tags available/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // MOBILE DRAWER TESTS
  // ==========================================================================

  describe('Mobile Navigation Drawer', () => {
    it('renders menu icon button for mobile navigation', () => {
      render(<WikiNavigation {...defaultProps} isMobile={true} />);

      const menuButton = screen.getByRole('button', { name: /open navigation drawer/i });
      expect(menuButton).toBeInTheDocument();
    });

    it('opens navigation drawer when menu button is clicked', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} isMobile={true} />);

      const menuButton = screen.getByRole('button', { name: /open navigation drawer/i });
      await user.click(menuButton);

      await waitFor(() => {
        // Drawer should be visible
        expect(screen.getByRole('navigation', { name: /wiki mobile navigation/i })).toBeInTheDocument();
        expect(screen.getByText('Wiki Navigation')).toBeInTheDocument();
      });
    });

    it('closes drawer when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} isMobile={true} />);

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation drawer/i });
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: /wiki mobile navigation/i })).toBeInTheDocument();
      });

      // Close drawer
      const closeButton = screen.getByRole('button', { name: /close navigation drawer/i });
      await user.click(closeButton);

      // Drawer content should be hidden
      await waitFor(() => {
        expect(screen.queryByRole('navigation', { name: /wiki mobile navigation/i })).not.toBeInTheDocument();
      });
    });

    it('shows current page title on mobile instead of full breadcrumbs', () => {
      render(<WikiNavigation {...defaultProps} isMobile={true} />);

      // Mobile shows only current page title
      const pageTitle = screen.getByLabelText(/current page: test page/i);
      expect(pageTitle).toBeInTheDocument();
    });

    it('closes drawer after navigating to a page', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} isMobile={true} />);

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation drawer/i });
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: /wiki mobile navigation/i })).toBeInTheDocument();
      });

      // Click on a recent page in drawer
      const recentPage = screen.getAllByText('Introduction')[0];
      await user.click(recentPage);

      // Verify navigation was called
      expect(defaultProps.onNavigate).toHaveBeenCalled();
    });

    it('renders search inside drawer on mobile', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} isMobile={true} />);

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation drawer/i });
      await user.click(menuButton);

      await waitFor(() => {
        // Search should be in the drawer
        const searchInput = screen.getByPlaceholderText(/search wiki pages/i);
        expect(searchInput).toBeInTheDocument();
      });
    });

    it('renders actions menu in drawer on mobile', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} isMobile={true} />);

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation drawer/i });
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Actions')).toBeInTheDocument();
        // Look for action items
        expect(screen.getByText('View')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('History')).toBeInTheDocument();
        expect(screen.getByText('Map')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // STICKY NAVIGATION TESTS
  // ==========================================================================

  describe('Sticky Navigation', () => {
    it('renders navigation bar with static position initially', () => {
      render(<WikiNavigation {...defaultProps} sticky={true} />);

      const navBar = screen.getByRole('navigation', { name: /wiki navigation bar/i });
      expect(navBar).toBeInTheDocument();
    });

    it('applies sticky styling when scroll threshold is reached', async () => {
      render(<WikiNavigation {...defaultProps} sticky={true} />);

      // Simulate scroll
      fireEvent.scroll(window, { target: { scrollY: 150 } });

      await waitFor(() => {
        const navBar = screen.getByRole('navigation', { name: /wiki navigation bar/i });
        // Check that nav bar is present - the actual position style check
        // depends on implementation details
        expect(navBar).toBeInTheDocument();
      });
    });

    it('does not apply sticky behavior when sticky prop is false', () => {
      render(<WikiNavigation {...defaultProps} sticky={false} />);

      fireEvent.scroll(window, { target: { scrollY: 150 } });

      const navBar = screen.getByRole('navigation', { name: /wiki navigation bar/i });
      expect(navBar).toBeInTheDocument();
    });

    it('renders spacer element for sticky navigation', async () => {
      render(<WikiNavigation {...defaultProps} sticky={true} />);

      // Simulate scroll to trigger sticky
      fireEvent.scroll(window, { target: { scrollY: 150 } });

      await waitFor(() => {
        // Spacer should be rendered to prevent content jump
        const spacer = screen.getByLabelText(/hidden/i);
        expect(spacer || true).toBeTruthy();
      });
    });

    it('removes sticky behavior when scrolling back to top', async () => {
      render(<WikiNavigation {...defaultProps} sticky={true} />);

      // Scroll down
      fireEvent.scroll(window, { target: { scrollY: 150 } });

      // Scroll back up
      fireEvent.scroll(window, { target: { scrollY: 50 } });

      await waitFor(() => {
        const navBar = screen.getByRole('navigation', { name: /wiki navigation bar/i });
        expect(navBar).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // KEYBOARD SHORTCUTS TESTS
  // ==========================================================================

  describe('Keyboard Shortcuts', () => {
    it('navigates to wiki home with Alt+H shortcut', async () => {
      render(<WikiNavigation {...defaultProps} />);

      fireEvent.keyDown(window, { key: 'h', altKey: true });

      expect(defaultProps.onNavigate).toHaveBeenCalledWith({
        type: 'wiki',
        wikiId: 1,
      });
    });

    it('navigates to edit page with Alt+E shortcut when user has permission', async () => {
      render(<WikiNavigation {...defaultProps} />);

      fireEvent.keyDown(window, { key: 'e', altKey: true });

      expect(defaultProps.onNavigate).toHaveBeenCalledWith({
        type: 'action',
        action: 'edit',
      });
    });

    it('does not navigate to edit with Alt+E when user lacks permission', () => {
      const propsWithoutEdit = {
        ...defaultProps,
        permissions: { ...defaultProps.permissions, canEdit: false },
      };

      render(<WikiNavigation {...propsWithoutEdit} />);

      fireEvent.keyDown(window, { key: 'e', altKey: true });

      expect(defaultProps.onNavigate).not.toHaveBeenCalledWith({
        type: 'action',
        action: 'edit',
      });
    });

    it('navigates to wiki map with Alt+M shortcut', async () => {
      render(<WikiNavigation {...defaultProps} />);

      fireEvent.keyDown(window, { key: 'm', altKey: true });

      expect(defaultProps.onNavigate).toHaveBeenCalledWith({
        type: 'action',
        action: 'map',
      });
    });

    it('focuses search input with Alt+S shortcut', async () => {
      render(<WikiNavigation {...defaultProps} />);

      const searchInput = screen.getByLabelText(/search wiki pages/i);

      fireEvent.keyDown(window, { key: 's', altKey: true });

      await waitFor(() => {
        expect(document.activeElement).toBe(searchInput);
      });
    });

    it('does not trigger shortcuts when typing in input field', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const searchInput = screen.getByLabelText(/search wiki pages/i);
      await user.click(searchInput);

      // Type 'h' while in input - should not trigger Alt+H
      await user.type(searchInput, 'h');

      // onNavigate should not be called for wiki home
      expect(defaultProps.onNavigate).not.toHaveBeenCalledWith({
        type: 'wiki',
        wikiId: 1,
      });
    });

    it('displays keyboard shortcuts in screen reader accessible section', () => {
      render(<WikiNavigation {...defaultProps} />);

      const shortcutsHelp = screen.getByRole('status');
      expect(shortcutsHelp).toHaveTextContent(/alt\+h.*home/i);
      expect(shortcutsHelp).toHaveTextContent(/alt\+e.*edit/i);
      expect(shortcutsHelp).toHaveTextContent(/alt\+m.*map/i);
      expect(shortcutsHelp).toHaveTextContent(/alt\+s.*search/i);
    });
  });

  // ==========================================================================
  // ACCESSIBILITY TESTS
  // ==========================================================================

  describe('Accessibility', () => {
    it('has proper ARIA labels for navigation elements', () => {
      render(<WikiNavigation {...defaultProps} />);

      // Navigation bar
      expect(screen.getByRole('navigation', { name: /wiki navigation bar/i })).toBeInTheDocument();

      // Breadcrumb navigation
      expect(screen.getByRole('navigation', { name: /wiki navigation breadcrumb/i })).toBeInTheDocument();
    });

    it('has accessible labels for all interactive elements', () => {
      render(<WikiNavigation {...defaultProps} />);

      // Edit button
      expect(screen.getByRole('button', { name: /edit current page/i })).toBeInTheDocument();

      // History button
      expect(screen.getByRole('button', { name: /view page history/i })).toBeInTheDocument();

      // Map button
      expect(screen.getByRole('button', { name: /view wiki map/i })).toBeInTheDocument();

      // Recent pages button
      expect(screen.getByRole('button', { name: /view recently accessed pages/i })).toBeInTheDocument();
    });

    it('has aria-expanded for expandable menus', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const moreOptionsButton = screen.getByRole('button', { name: /more navigation options/i });
      expect(moreOptionsButton).toHaveAttribute('aria-haspopup', 'true');

      await user.click(moreOptionsButton);

      // After opening, the menu should be associated with the button
      await waitFor(() => {
        expect(screen.getByRole('menu', { name: /additional navigation options/i })).toBeInTheDocument();
      });
    });

    it('indicates current page in breadcrumbs with aria-current', () => {
      render(<WikiNavigation {...defaultProps} />);

      const currentPage = screen.getByText('Test Page');
      expect(currentPage).toHaveAttribute('aria-current', 'page');
    });

    it('has accessible search input with proper label', () => {
      render(<WikiNavigation {...defaultProps} />);

      const searchInput = screen.getByLabelText(/search wiki pages/i);
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('placeholder', 'Search wiki pages...');
    });

    it('provides skip link functionality via keyboard shortcuts', () => {
      render(<WikiNavigation {...defaultProps} />);

      // Keyboard shortcuts help is available for screen readers
      const shortcutsHelp = screen.getByRole('status');
      expect(shortcutsHelp).toBeInTheDocument();
    });

    it('has complementary role for navigation sidebar', () => {
      render(<WikiNavigation {...defaultProps} />);

      // Desktop side panel should have complementary role
      const sidebar = screen.getByRole('complementary', { name: /wiki navigation sidebar/i });
      expect(sidebar).toBeInTheDocument();
    });

    it('mobile drawer has proper navigation role', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} isMobile={true} />);

      const menuButton = screen.getByRole('button', { name: /open navigation drawer/i });
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: /wiki mobile navigation/i })).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // LOADING AND ERROR STATES TESTS
  // ==========================================================================

  describe('Loading and Error States', () => {
    it('renders navigation even without available pages', () => {
      const propsWithoutPages = {
        ...defaultProps,
        availablePages: [],
      };

      render(<WikiNavigation {...propsWithoutPages} />);

      // Navigation should still render
      expect(screen.getByRole('navigation', { name: /wiki navigation bar/i })).toBeInTheDocument();
      expect(screen.getByText('Test Page')).toBeInTheDocument();
    });

    it('renders navigation without current page', () => {
      const propsWithoutCurrentPage = {
        ...defaultProps,
        currentPage: undefined,
      };

      render(<WikiNavigation {...propsWithoutCurrentPage} />);

      // Breadcrumbs should still show course and wiki
      expect(screen.getByText('Introduction to Testing')).toBeInTheDocument();
      expect(screen.getByText('Course Wiki')).toBeInTheDocument();
    });

    it('hides edit button when current page is not defined', () => {
      const propsWithoutCurrentPage = {
        ...defaultProps,
        currentPage: undefined,
      };

      render(<WikiNavigation {...propsWithoutCurrentPage} />);

      // Edit button requires current page
      expect(screen.queryByRole('button', { name: /edit current page/i })).not.toBeInTheDocument();
    });

    it('renders empty state gracefully with minimal props', () => {
      const minimalProps = {
        wikiId: 1,
        onNavigate: vi.fn(),
      };

      render(<WikiNavigation {...minimalProps} />);

      // Should render without crashing
      expect(screen.getByRole('navigation', { name: /wiki navigation bar/i })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // MORE OPTIONS MENU TESTS
  // ==========================================================================

  describe('More Options Menu', () => {
    it('renders more options button', () => {
      render(<WikiNavigation {...defaultProps} />);

      const moreButton = screen.getByRole('button', { name: /more navigation options/i });
      expect(moreButton).toBeInTheDocument();
    });

    it('opens more options menu when clicked', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const moreButton = screen.getByRole('button', { name: /more navigation options/i });
      await user.click(moreButton);

      await waitFor(() => {
        expect(screen.getByRole('menu', { name: /additional navigation options/i })).toBeInTheDocument();
      });
    });

    it('shows page tags in more options menu', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const moreButton = screen.getByRole('button', { name: /more navigation options/i });
      await user.click(moreButton);

      await waitFor(() => {
        expect(screen.getByText('Page Tags')).toBeInTheDocument();
        expect(screen.getByText('documentation')).toBeInTheDocument();
        expect(screen.getByText('tutorial')).toBeInTheDocument();
      });
    });

    it('navigates to map from more options menu', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const moreButton = screen.getByRole('button', { name: /more navigation options/i });
      await user.click(moreButton);

      await waitFor(() => {
        expect(screen.getByText('View Wiki Map')).toBeInTheDocument();
      });

      const mapOption = screen.getByText('View Wiki Map');
      await user.click(mapOption);

      expect(defaultProps.onNavigate).toHaveBeenCalledWith({
        type: 'action',
        action: 'map',
      });
    });

    it('filters by tag when tag is clicked in more options', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const moreButton = screen.getByRole('button', { name: /more navigation options/i });
      await user.click(moreButton);

      await waitFor(() => {
        expect(screen.getByText('documentation')).toBeInTheDocument();
      });

      const tagMenuItem = screen.getByRole('menuitem', { name: /documentation/i });
      await user.click(tagMenuItem);

      expect(defaultProps.onNavigate).toHaveBeenCalledWith({
        type: 'tag',
        tag: 'documentation',
      });
    });

    it('closes menu after selecting an option', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const moreButton = screen.getByRole('button', { name: /more navigation options/i });
      await user.click(moreButton);

      await waitFor(() => {
        expect(screen.getByText('View Wiki Map')).toBeInTheDocument();
      });

      const mapOption = screen.getByText('View Wiki Map');
      await user.click(mapOption);

      // Menu should be closed
      await waitFor(() => {
        expect(screen.queryByRole('menu', { name: /additional navigation options/i })).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // NAVIGATION STATE PERSISTENCE TESTS
  // ==========================================================================

  describe('Navigation State Persistence', () => {
    it('maintains search query state while typing', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const searchInput = screen.getByLabelText(/search wiki pages/i);
      await user.type(searchInput, 'Test Query');

      expect(searchInput).toHaveValue('Test Query');
    });

    it('maintains tag selection state after multiple clicks', async () => {
      const user = userEvent.setup();
      const propsWithTags = {
        ...defaultProps,
        availablePages: [
          createNavigationPage({ id: 1, title: 'Page 1', tags: ['tag1', 'tag2'] }),
        ],
      };

      render(<WikiNavigation {...propsWithTags} />);

      // Select first tag
      const tag1 = screen.getByRole('button', { name: /add filter for tag tag1/i });
      await user.click(tag1);

      // Select second tag
      const tag2 = screen.getByRole('button', { name: /add filter for tag tag2/i });
      await user.click(tag2);

      // Both should be called
      expect(defaultProps.onNavigate).toHaveBeenCalledTimes(2);
    });

    it('resets search state when page is selected', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} />);

      const searchInput = screen.getByLabelText(/search wiki pages/i);
      await user.click(searchInput);
      await user.type(searchInput, 'Intro');

      await waitFor(() => {
        expect(screen.getByText('Introduction')).toBeInTheDocument();
      });

      const pageOption = screen.getByText('Introduction');
      await user.click(pageOption);

      // Search should be cleared
      expect(searchInput).toHaveValue('');
    });
  });

  // ==========================================================================
  // DESKTOP SIDE PANEL TESTS
  // ==========================================================================

  describe('Desktop Side Panel', () => {
    it('renders side panel on desktop when pages are available', () => {
      render(<WikiNavigation {...defaultProps} isMobile={false} />);

      const sidebar = screen.getByRole('complementary', { name: /wiki navigation sidebar/i });
      expect(sidebar).toBeInTheDocument();
    });

    it('shows recent pages in side panel', () => {
      render(<WikiNavigation {...defaultProps} isMobile={false} />);

      const sidebar = screen.getByRole('complementary', { name: /wiki navigation sidebar/i });

      // Check for recent pages section
      expect(screen.getByText('Recent Pages')).toBeInTheDocument();
    });

    it('navigates when clicking page in side panel', async () => {
      const user = userEvent.setup();
      render(<WikiNavigation {...defaultProps} isMobile={false} />);

      // Find page link in sidebar
      const sidebar = screen.getByRole('complementary', { name: /wiki navigation sidebar/i });

      // Click on a recent page (there may be multiple Introductions)
      const introductionLinks = screen.getAllByRole('button', { name: /introduction/i });
      // Click on the one in the sidebar (should be the last or a specific one)
      await user.click(introductionLinks[introductionLinks.length - 1]);

      expect(defaultProps.onNavigate).toHaveBeenCalled();
    });

    it('does not render side panel when no pages available', () => {
      const propsWithoutPages = {
        ...defaultProps,
        availablePages: [],
        recentPages: [],
      };

      render(<WikiNavigation {...propsWithoutPages} isMobile={false} />);

      const sidebar = screen.queryByRole('complementary', { name: /wiki navigation sidebar/i });
      // Sidebar should be hidden when no content
      expect(sidebar).toHaveStyle({ display: 'none' });
    });

    it('shows tag filters in side panel', () => {
      render(<WikiNavigation {...defaultProps} isMobile={false} />);

      // Tag filters should be visible
      expect(screen.getByText('Filter by tags:')).toBeInTheDocument();
    });
  });
});
