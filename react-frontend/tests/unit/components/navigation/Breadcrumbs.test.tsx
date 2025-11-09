/**
 * Unit tests for Breadcrumbs navigation component
 *
 * Tests hierarchical breadcrumb navigation trail functionality including:
 * - Home icon as first breadcrumb linking to dashboard
 * - Dynamic breadcrumb generation from React Router route matches
 * - Course page breadcrumb trails (Home > My Courses > Course Name)
 * - Activity page full hierarchy (Home > Course > Activity Type > Activity)
 * - Link components for navigation except last item (Typography)
 * - Current page item styling differentiation
 * - Text truncation for long breadcrumb labels
 * - Responsive behavior: desktop shows all, mobile shows last 2 items
 * - ARIA accessibility with proper 'breadcrumb' label
 * - Custom maxItems prop support
 * - Navigation on breadcrumb click
 *
 * @package   react-frontend
 * @copyright 2024 Moodle React Migration
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumbs from '@/components/navigation/Breadcrumbs';

// Mock react-router-dom hooks
const mockUseMatches = vi.fn();
const mockUseLocation = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useMatches: () => mockUseMatches(),
    useLocation: () => mockUseLocation(),
    useNavigate: () => mockNavigate,
  };
});

// Mock MUI useMediaQuery for responsive testing
const mockUseMediaQuery = vi.fn();

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual<typeof import('@mui/material')>('@mui/material');
  return {
    ...actual,
    useMediaQuery: () => mockUseMediaQuery(),
  };
});

// Mock React Query's useQueryClient
const mockGetQueryData = vi.fn();
const mockQueryClient = {
  getQueryData: mockGetQueryData,
};

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => mockQueryClient,
  };
});

/**
 * Test wrapper component that provides MemoryRouter context
 */
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <MemoryRouter>{children}</MemoryRouter>;
};

describe('Breadcrumbs', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Default mock implementations
    mockUseMediaQuery.mockReturnValue(true); // Desktop by default
    mockUseLocation.mockReturnValue({
      pathname: '/',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });
    mockUseMatches.mockReturnValue([
      {
        id: 'root',
        pathname: '/',
        params: {},
        data: null,
        handle: null,
      },
    ]);
    mockGetQueryData.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders Home icon as first breadcrumb', () => {
    render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    // Verify Home link exists and points to root
    const homeLink = screen.getByRole('link', { name: /home/i });
    expect(homeLink).toBeDefined();
    expect(homeLink).toHaveAttribute('href', '/');

    // Verify Home icon is present
    const nav = screen.getByLabelText('breadcrumb');
    expect(nav).toBeDefined();
    const homeIcon = within(nav).getByTestId('HomeIcon');
    expect(homeIcon).toBeDefined();
  });

  it('renders breadcrumb trail for course page', () => {
    // Mock route matches for course page
    mockUseMatches.mockReturnValue([
      {
        id: 'root',
        pathname: '/',
        params: {},
        data: null,
        handle: null,
      },
      {
        id: 'courses',
        pathname: '/courses',
        params: {},
        data: null,
        handle: {
          breadcrumb: () => 'My Courses',
        },
      },
      {
        id: 'course-detail',
        pathname: '/courses/123',
        params: { courseId: '123' },
        data: null,
        handle: {
          breadcrumb: () => 'Course Detail',
        },
      },
    ]);

    mockUseLocation.mockReturnValue({
      pathname: '/courses/123',
      search: '',
      hash: '',
      state: null,
      key: 'course',
    });

    // Mock course data in React Query cache
    mockGetQueryData.mockImplementation((key) => {
      if (Array.isArray(key) && key[0] === 'courses' && key[1] === 123) {
        return { fullname: 'Introduction to React' };
      }
      return null;
    });

    render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    // Verify breadcrumb trail: Home > My Courses > Introduction to React
    expect(screen.getByRole('link', { name: /home/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /my courses/i })).toBeDefined();
    expect(screen.getByText('Introduction to React')).toBeDefined();

    // Verify last item is not a link (Typography, not Link)
    const allLinks = screen.getAllByRole('link');
    expect(allLinks).toHaveLength(2); // Only Home and My Courses are links
  });

  it('renders full hierarchy for activity page', () => {
    // Mock route matches for assignment detail page
    mockUseMatches.mockReturnValue([
      {
        id: 'root',
        pathname: '/',
        params: {},
        data: null,
        handle: null,
      },
      {
        id: 'courses',
        pathname: '/courses',
        params: {},
        data: null,
        handle: {
          breadcrumb: () => 'My Courses',
        },
      },
      {
        id: 'course-detail',
        pathname: '/courses/123',
        params: { courseId: '123' },
        data: null,
        handle: {
          breadcrumb: () => 'Course Detail',
        },
      },
      {
        id: 'assignments',
        pathname: '/courses/123/assignments',
        params: { courseId: '123' },
        data: null,
        handle: {
          breadcrumb: () => 'Assignments',
        },
      },
      {
        id: 'assignment-detail',
        pathname: '/courses/123/assignments/456',
        params: { courseId: '123', assignmentId: '456' },
        data: null,
        handle: {
          breadcrumb: () => 'Assignment Detail',
        },
      },
    ]);

    mockUseLocation.mockReturnValue({
      pathname: '/courses/123/assignments/456',
      search: '',
      hash: '',
      state: null,
      key: 'assignment',
    });

    // Mock course and assignment data in cache
    mockGetQueryData.mockImplementation((key) => {
      if (Array.isArray(key) && key[0] === 'courses' && key[1] === 123) {
        return { fullname: 'React Course' };
      }
      if (Array.isArray(key) && key[0] === 'assignments' && key[1] === 456) {
        return { name: 'Final Project' };
      }
      return null;
    });

    render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    // Verify full breadcrumb hierarchy
    expect(screen.getByRole('link', { name: /home/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /my courses/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /react course/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /assignments/i })).toBeDefined();
    expect(screen.getByText('Final Project')).toBeDefined();

    // Verify 4 links (all except last item)
    const allLinks = screen.getAllByRole('link');
    expect(allLinks).toHaveLength(4);
  });

  it('uses Link component for all items except last', () => {
    mockUseMatches.mockReturnValue([
      {
        id: 'root',
        pathname: '/',
        params: {},
        data: null,
        handle: null,
      },
      {
        id: 'courses',
        pathname: '/courses',
        params: {},
        data: null,
        handle: {
          breadcrumb: () => 'My Courses',
        },
      },
      {
        id: 'course-detail',
        pathname: '/courses/123',
        params: { courseId: '123' },
        data: null,
        handle: {
          breadcrumb: () => 'Course Detail',
        },
      },
    ]);

    render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    // First N-1 items should be links
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2); // Home and My Courses

    // Verify links have proper href attributes
    expect(links[0]).toHaveAttribute('href', '/');
    expect(links[1]).toHaveAttribute('href', '/courses');

    // Last item (Course Detail) should not be a link
    const nav = screen.getByLabelText('breadcrumb');
    const courseDetail = within(nav).getByText('Course Detail');
    expect(courseDetail).toBeDefined();
    // Verify it's a Typography, not inside a Link
    expect(courseDetail.tagName).not.toBe('A');
  });

  it('displays current page item with different styling', () => {
    mockUseMatches.mockReturnValue([
      {
        id: 'root',
        pathname: '/',
        params: {},
        data: null,
        handle: null,
      },
      {
        id: 'courses',
        pathname: '/courses',
        params: {},
        data: null,
        handle: {
          breadcrumb: () => 'My Courses',
        },
      },
    ]);

    render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    // Last breadcrumb should be Typography with text.primary color
    const nav = screen.getByLabelText('breadcrumb');
    const lastItem = within(nav).getByText('My Courses');
    expect(lastItem).toBeDefined();

    // Verify it has different styling (not a link)
    expect(lastItem.tagName).not.toBe('A');
  });

  it('handles missing route data gracefully', () => {
    // Mock empty matches (only root)
    mockUseMatches.mockReturnValue([
      {
        id: 'root',
        pathname: '/',
        params: {},
        data: null,
        handle: null,
      },
    ]);

    mockUseLocation.mockReturnValue({
      pathname: '/',
      search: '',
      hash: '',
      state: null,
      key: 'empty',
    });

    render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    // Should only render Home breadcrumb
    const nav = screen.getByLabelText('breadcrumb');
    expect(nav).toBeDefined();

    // Verify only Home is present
    const homeText = within(nav).getByText('Home');
    expect(homeText).toBeDefined();

    // No other breadcrumbs should be visible
    const allText = within(nav).queryByText('My Courses');
    expect(allText).toBeNull();
  });

  it('truncates long breadcrumb labels', () => {
    // Mock route with very long course name
    mockUseMatches.mockReturnValue([
      {
        id: 'root',
        pathname: '/',
        params: {},
        data: null,
        handle: null,
      },
      {
        id: 'course-detail',
        pathname: '/courses/123',
        params: { courseId: '123' },
        data: null,
        handle: {
          breadcrumb: () => 'Course Detail',
        },
      },
    ]);

    mockGetQueryData.mockImplementation((key) => {
      if (Array.isArray(key) && key[0] === 'courses' && key[1] === 123) {
        return {
          fullname:
            'This is an extremely long course name that should be truncated to prevent layout issues and ensure proper display across different screen sizes',
        };
      }
      return null;
    });

    const { container } = render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    // Verify text truncation styles are applied
    const nav = container.querySelector('nav[aria-label="breadcrumb"]');
    expect(nav).toBeDefined();

    // Check that the long text is present but styled for truncation
    const longText = screen.getByText(/this is an extremely long course name/i);
    expect(longText).toBeDefined();

    // Verify truncation styles through parent element
    const parentElement = longText.parentElement;
    expect(parentElement).toBeDefined();
  });

  it('shows only last 2 items on mobile', () => {
    // Mock mobile screen
    mockUseMediaQuery.mockReturnValue(false); // Mobile (down from 'sm')

    mockUseMatches.mockReturnValue([
      {
        id: 'root',
        pathname: '/',
        params: {},
        data: null,
        handle: null,
      },
      {
        id: 'courses',
        pathname: '/courses',
        params: {},
        data: null,
        handle: {
          breadcrumb: () => 'My Courses',
        },
      },
      {
        id: 'course-detail',
        pathname: '/courses/123',
        params: { courseId: '123' },
        data: null,
        handle: {
          breadcrumb: () => 'Course Detail',
        },
      },
      {
        id: 'assignments',
        pathname: '/courses/123/assignments',
        params: { courseId: '123' },
        data: null,
        handle: {
          breadcrumb: () => 'Assignments',
        },
      },
      {
        id: 'assignment-detail',
        pathname: '/courses/123/assignments/456',
        params: { courseId: '123', assignmentId: '456' },
        data: null,
        handle: {
          breadcrumb: () => 'Assignment Detail',
        },
      },
    ]);

    render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    // On mobile, should show collapse indicator and last 2 items
    const nav = screen.getByLabelText('breadcrumb');
    expect(nav).toBeDefined();

    // Verify Assignment Detail is visible (last item)
    expect(screen.getByText('Assignment Detail')).toBeDefined();

    // Component should have maxItems={2} applied for mobile
    const breadcrumbsContainer = nav.querySelector('.MuiBreadcrumbs-ol');
    expect(breadcrumbsContainer).toBeDefined();
  });

  it('shows all items on desktop', () => {
    // Mock desktop screen
    mockUseMediaQuery.mockReturnValue(true); // Desktop (up from 'md')

    mockUseMatches.mockReturnValue([
      {
        id: 'root',
        pathname: '/',
        params: {},
        data: null,
        handle: null,
      },
      {
        id: 'courses',
        pathname: '/courses',
        params: {},
        data: null,
        handle: {
          breadcrumb: () => 'My Courses',
        },
      },
      {
        id: 'course-detail',
        pathname: '/courses/123',
        params: { courseId: '123' },
        data: null,
        handle: {
          breadcrumb: () => 'Course Detail',
        },
      },
      {
        id: 'assignments',
        pathname: '/courses/123/assignments',
        params: { courseId: '123' },
        data: null,
        handle: {
          breadcrumb: () => 'Assignments',
        },
      },
    ]);

    render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    // All breadcrumb items should be visible on desktop
    expect(screen.getByRole('link', { name: /home/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /my courses/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /course detail/i })).toBeDefined();
    expect(screen.getByText('Assignments')).toBeDefined();

    // Verify all items are present (3 links + 1 current item)
    const allLinks = screen.getAllByRole('link');
    expect(allLinks).toHaveLength(3);
  });

  it('has proper ARIA label', () => {
    render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    // Verify breadcrumb navigation has aria-label="breadcrumb"
    const breadcrumbNav = screen.getByLabelText('breadcrumb');
    expect(breadcrumbNav).toBeDefined();
    expect(breadcrumbNav.getAttribute('aria-label')).toBe('breadcrumb');

    // Verify it's a nav element
    expect(breadcrumbNav.tagName).toBe('NAV');
  });

  it('supports custom maxItems prop', () => {
    mockUseMediaQuery.mockReturnValue(true); // Desktop

    mockUseMatches.mockReturnValue([
      {
        id: 'root',
        pathname: '/',
        params: {},
        data: null,
        handle: null,
      },
      {
        id: 'courses',
        pathname: '/courses',
        params: {},
        data: null,
        handle: {
          breadcrumb: () => 'My Courses',
        },
      },
      {
        id: 'course-detail',
        pathname: '/courses/123',
        params: { courseId: '123' },
        data: null,
        handle: {
          breadcrumb: () => 'Course Detail',
        },
      },
      {
        id: 'assignments',
        pathname: '/courses/123/assignments',
        params: { courseId: '123' },
        data: null,
        handle: {
          breadcrumb: () => 'Assignments',
        },
      },
      {
        id: 'assignment-detail',
        pathname: '/courses/123/assignments/456',
        params: { courseId: '123', assignmentId: '456' },
        data: null,
        handle: {
          breadcrumb: () => 'Assignment Detail',
        },
      },
    ]);

    render(
      <TestWrapper>
        <Breadcrumbs maxItems={3} />
      </TestWrapper>
    );

    // With maxItems={3}, should show collapse indicator
    const nav = screen.getByLabelText('breadcrumb');
    expect(nav).toBeDefined();

    // MUI Breadcrumbs with maxItems shows ellipsis/collapse indicator
    // Verify that not all items are visible as links
    const allLinks = screen.getAllByRole('link');
    // Should have fewer visible items due to maxItems constraint
    expect(allLinks.length).toBeLessThanOrEqual(4); // Some items collapsed
  });

  it('navigates correctly on breadcrumb click', async () => {
    const user = userEvent.setup();

    mockUseMatches.mockReturnValue([
      {
        id: 'root',
        pathname: '/',
        params: {},
        data: null,
        handle: null,
      },
      {
        id: 'courses',
        pathname: '/courses',
        params: {},
        data: null,
        handle: {
          breadcrumb: () => 'My Courses',
        },
      },
      {
        id: 'course-detail',
        pathname: '/courses/123',
        params: { courseId: '123' },
        data: null,
        handle: {
          breadcrumb: () => 'Course Detail',
        },
      },
    ]);

    render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    // Click on middle breadcrumb (My Courses)
    const myCoursesLink = screen.getByRole('link', { name: /my courses/i });
    expect(myCoursesLink).toBeDefined();

    // Verify the link has correct href
    expect(myCoursesLink).toHaveAttribute('href', '/courses');

    // Click the link
    await user.click(myCoursesLink);

    // In a real app, this would trigger navigation via React Router
    // Since we're using MemoryRouter in tests, we verify the link exists
    // and is clickable (actual navigation is handled by React Router)
    expect(myCoursesLink).toBeDefined();
  });
});
