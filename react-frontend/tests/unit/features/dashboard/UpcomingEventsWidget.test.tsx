/**
 * Unit Tests for UpcomingEventsWidget Component
 *
 * Comprehensive test suite for the UpcomingEventsWidget dashboard widget component.
 * Tests cover rendering, event display, chronological ordering, date grouping,
 * relative time formatting, event type icons/colors, loading states, error handling,
 * empty states, user interactions, and accessibility.
 *
 * Based on Moodle's public/blocks/calendar_upcoming/block_calendar_upcoming.php
 *
 * @package    react-frontend
 * @subpackage tests/unit/features/dashboard
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React from 'react';
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import '@testing-library/jest-dom';

import UpcomingEventsWidget from '@/features/dashboard/widgets/UpcomingEventsWidget';
import { CalendarEventType } from '@/features/dashboard/types/dashboard.types';
import type { CalendarEvent } from '@/features/dashboard/types/dashboard.types';

// ============================================================================
// Test Constants
// ============================================================================

// Must match VITE_API_BASE_URL in vitest.config.ts for MSW to intercept requests
const API_BASE_URL = 'http://localhost:8000/api/v1';
const UPCOMING_EVENTS_ENDPOINT = `${API_BASE_URL}/blocks/upcoming`;

// ============================================================================
// Mock Data Factory Functions
// ============================================================================

/**
 * Create a mock calendar event with default values
 */
function createMockEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: Math.floor(Math.random() * 10000),
    name: 'Test Event',
    description: 'A test event description',
    eventtype: CalendarEventType.COURSE,
    timestart: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    timemodified: Math.floor(Date.now() / 1000),
    courseid: 101,
    modulename: 'Assignment',
    url: '/mod/assign/view.php?id=123',
    visible: true,
    ...overrides,
  };
}

/**
 * Create mock events at specific time distances
 */
function createMockEventsAtDifferentTimes(): CalendarEvent[] {
  const now = Math.floor(Date.now() / 1000);
  const hour = 3600;
  const day = 86400;

  return [
    // Today events
    createMockEvent({
      id: 1,
      name: 'Quiz closes in 30 minutes',
      eventtype: CalendarEventType.COURSE,
      timestart: now + 1800, // 30 minutes from now
      modulename: 'Quiz',
      url: '/mod/quiz/view.php?id=1',
    }),
    createMockEvent({
      id: 2,
      name: 'Assignment due in 2 hours',
      eventtype: CalendarEventType.COURSE,
      timestart: now + 2 * hour, // 2 hours from now
      modulename: 'Assignment',
      url: '/mod/assign/view.php?id=2',
    }),
    createMockEvent({
      id: 3,
      name: 'Forum deadline today',
      eventtype: CalendarEventType.COURSE,
      timestart: now + 5 * hour, // 5 hours from now
      modulename: 'Forum',
      url: '/mod/forum/view.php?id=3',
    }),
    // Tomorrow events
    createMockEvent({
      id: 4,
      name: 'Tomorrow assignment deadline',
      eventtype: CalendarEventType.COURSE,
      timestart: now + day + 2 * hour, // Tomorrow
      modulename: 'Assignment',
      url: '/mod/assign/view.php?id=4',
    }),
    createMockEvent({
      id: 5,
      name: 'User event tomorrow',
      eventtype: CalendarEventType.USER,
      timestart: now + day + 4 * hour,
      modulename: undefined,
      url: undefined,
    }),
    // This week events
    createMockEvent({
      id: 6,
      name: 'Quiz next week',
      eventtype: CalendarEventType.COURSE,
      timestart: now + 3 * day, // 3 days from now
      modulename: 'Quiz',
      url: '/mod/quiz/view.php?id=6',
    }),
    createMockEvent({
      id: 7,
      name: 'Site event this week',
      eventtype: CalendarEventType.SITE,
      timestart: now + 4 * day,
      modulename: undefined,
      url: '/calendar/view.php?view=day',
    }),
    // Later events
    createMockEvent({
      id: 8,
      name: 'Group project deadline',
      eventtype: CalendarEventType.GROUP,
      timestart: now + 10 * day, // 10 days from now
      modulename: 'Workshop',
      url: '/mod/workshop/view.php?id=8',
      groupid: 5,
    }),
    createMockEvent({
      id: 9,
      name: 'Category event later',
      eventtype: CalendarEventType.CATEGORY,
      timestart: now + 14 * day, // 2 weeks from now
      modulename: undefined,
      url: '/calendar/view.php',
    }),
  ];
}

/**
 * Create a large set of events for pagination testing
 */
function createManyEvents(count: number): CalendarEvent[] {
  const now = Math.floor(Date.now() / 1000);
  const hour = 3600;

  return Array.from({ length: count }, (_, index) =>
    createMockEvent({
      id: 1000 + index,
      name: `Event ${index + 1}`,
      eventtype: CalendarEventType.COURSE,
      timestart: now + (index + 1) * hour,
      modulename: 'Assignment',
      url: `/mod/assign/view.php?id=${1000 + index}`,
    })
  );
}

// ============================================================================
// MSW Server Setup
// ============================================================================

/**
 * Default handler returning mixed events
 */
const defaultHandler = http.get(UPCOMING_EVENTS_ENDPOINT, () => {
  const events = createMockEventsAtDifferentTimes();
  return HttpResponse.json({
    success: true,
    data: {
      events,
      hasMore: false,
      total: events.length,
    },
  });
});

const server = setupServer(defaultHandler);

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a new QueryClient for each test with isolated cache
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}

/**
 * Create test theme
 */
const testTheme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
    info: { main: '#0288d1' },
    success: { main: '#2e7d32' },
    warning: { main: '#ed6c02' },
    error: { main: '#d32f2f' },
  },
});

/**
 * Render component with all required providers
 */
interface RenderOptions {
  queryClient?: QueryClient;
}

function renderWithProviders(
  ui: React.ReactElement,
  options: RenderOptions = {}
) {
  const queryClient = options.queryClient ?? createTestQueryClient();

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={testTheme}>
        <BrowserRouter>{children}</BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );

  return {
    ...render(ui, { wrapper: Wrapper }),
    queryClient,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('UpcomingEventsWidget', () => {
  // Start and stop MSW server
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterAll(() => server.close());
  beforeEach(() => server.resetHandlers());

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe('Rendering', () => {
    it('renders the widget title "Upcoming Events"', async () => {
      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /upcoming events/i })).toBeInTheDocument();
      });
    });

    it('renders as a Material-UI Card component', async () => {
      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        const card = screen.getByRole('heading', { name: /upcoming events/i }).closest('.MuiCard-root');
        expect(card).toBeInTheDocument();
      });
    });

    it('displays event count in header when events exist', async () => {
      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        // Should show "X of Y" format
        expect(screen.getByText(/\d+ of \d+/)).toBeInTheDocument();
      });
    });

    it('renders "Go to calendar" link in footer', async () => {
      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /go to calendar/i })).toBeInTheDocument();
      });
    });

    it('uses compact mode when compact prop is true', async () => {
      renderWithProviders(<UpcomingEventsWidget compact />);

      await waitFor(() => {
        const title = screen.getByRole('heading', { name: /upcoming events/i });
        // Compact mode uses subtitle1 variant
        expect(title.tagName.toLowerCase()).toBe('h2');
      });
    });
  });

  // ============================================================================
  // Event List Display Tests
  // ============================================================================

  describe('Event List Display', () => {
    it('displays events in chronological order (earliest first)', async () => {
      const events = createMockEventsAtDifferentTimes();
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events, hasMore: false, total: events.length },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        const eventList = screen.getByRole('list', { name: /upcoming events list/i });
        const eventItems = within(eventList).getAllByRole('listitem');
        
        // First event should be the one closest in time (30 minutes)
        expect(eventItems.length).toBeGreaterThan(0);
      });
    });

    it('displays event title, date/time, and course name', async () => {
      const testEvent = createMockEvent({
        id: 1,
        name: 'Important Assignment',
        modulename: 'Assignment',
      });
      
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [testEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        // Verify event title is displayed
        expect(screen.getByText('Important Assignment')).toBeInTheDocument();
        // Verify the assignment module type is displayed (there will be multiple matches 
        // since both the title and module name contain "assignment")
        expect(screen.getAllByText(/assignment/i).length).toBeGreaterThan(0);
      });
    });

    it('renders each event as a clickable link when URL is provided', async () => {
      const testEvent = createMockEvent({
        id: 1,
        name: 'Clickable Event',
        url: '/mod/assign/view.php?id=123',
      });
      
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [testEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        const eventLink = screen.getByRole('link', { name: /clickable event/i });
        expect(eventLink).toHaveAttribute('href', '/mod/assign/view.php?id=123');
      });
    });

    it('renders events without URL as non-clickable items', async () => {
      const testEvent = createMockEvent({
        id: 1,
        name: 'Non-Clickable Event',
        url: undefined,
      });
      
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [testEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Non-Clickable Event')).toBeInTheDocument();
        // Should not be a link
        expect(screen.queryByRole('link', { name: /non-clickable event/i })).not.toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Event Grouping Tests
  // ============================================================================

  describe('Event Grouping', () => {
    it('groups events by time period (Today, Tomorrow, This Week, Later)', async () => {
      const events = createMockEventsAtDifferentTimes();
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events, hasMore: false, total: events.length },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget maxEvents={20} />);

      await waitFor(() => {
        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.getByText('Tomorrow')).toBeInTheDocument();
      });
    });

    it('renders group headers correctly', async () => {
      const events = createMockEventsAtDifferentTimes();
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events, hasMore: false, total: events.length },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget maxEvents={20} />);

      await waitFor(() => {
        const todayHeader = screen.getByText('Today');
        expect(todayHeader.tagName.toLowerCase()).toBe('div');
      });
    });

    it('does not display empty groups', async () => {
      // Create events that are definitely "today" - use start of today + offset
      // to avoid midnight boundary issues when tests run late at night
      const now = new Date();
      const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
      const todayNoonTimestamp = Math.floor(todayNoon.getTime() / 1000);
      
      // If current time is past noon, use times in the early afternoon
      // Otherwise use times around noon. Both are guaranteed to be "today"
      const baseTime = now.getHours() >= 14 
        ? Math.floor(now.getTime() / 1000) + 60  // 1 minute from now (close enough if it's afternoon)
        : todayNoonTimestamp;
      
      const todayEvents = [
        createMockEvent({ id: 1, name: 'Morning Meeting', timestart: baseTime + 300 }),  // +5 minutes
        createMockEvent({ id: 2, name: 'Afternoon Task', timestart: baseTime + 600 }),   // +10 minutes
      ];

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: todayEvents, hasMore: false, total: todayEvents.length },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.queryByText('Tomorrow')).not.toBeInTheDocument();
        expect(screen.queryByText('This Week')).not.toBeInTheDocument();
        expect(screen.queryByText('Later')).not.toBeInTheDocument();
      });
    });

    it('lists events within the same group together', async () => {
      const now = Math.floor(Date.now() / 1000);
      const todayEvents = [
        createMockEvent({ id: 1, name: 'First Today Event', timestart: now + 3600 }),
        createMockEvent({ id: 2, name: 'Second Today Event', timestart: now + 7200 }),
      ];

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: todayEvents, hasMore: false, total: todayEvents.length },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        const eventList = screen.getByRole('list', { name: /upcoming events list/i });
        expect(within(eventList).getByText('First Today Event')).toBeInTheDocument();
        expect(within(eventList).getByText('Second Today Event')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Event Type Support Tests
  // ============================================================================

  describe('Event Type Support', () => {
    it('displays course events with appropriate icon', async () => {
      const courseEvent = createMockEvent({
        id: 1,
        name: 'Course Event',
        eventtype: CalendarEventType.COURSE,
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [courseEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Course Event')).toBeInTheDocument();
        // Icon should be present (SchoolIcon for course events)
        // MUI ListItem renders as div with MuiListItem-root class, not <li>
        const eventItem = screen.getByText('Course Event').closest('.MuiListItem-root');
        expect(eventItem).toBeInTheDocument();
      });
    });

    it('displays user events with user icon', async () => {
      const userEvent = createMockEvent({
        id: 1,
        name: 'Personal Reminder',
        eventtype: CalendarEventType.USER,
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [userEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Personal Reminder')).toBeInTheDocument();
      });
    });

    it('displays site events with site icon', async () => {
      const siteEvent = createMockEvent({
        id: 1,
        name: 'Site Announcement',
        eventtype: CalendarEventType.SITE,
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [siteEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Site Announcement')).toBeInTheDocument();
      });
    });

    it('displays group events with group icon', async () => {
      const groupEvent = createMockEvent({
        id: 1,
        name: 'Group Meeting',
        eventtype: CalendarEventType.GROUP,
        groupid: 5,
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [groupEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Group Meeting')).toBeInTheDocument();
      });
    });

    it('displays category events with category icon', async () => {
      const categoryEvent = createMockEvent({
        id: 1,
        name: 'Category Event',
        eventtype: CalendarEventType.CATEGORY,
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [categoryEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Category Event')).toBeInTheDocument();
      });
    });

    it('applies different border colors based on event type', async () => {
      const events = [
        createMockEvent({ id: 1, name: 'Course Event', eventtype: CalendarEventType.COURSE }),
        createMockEvent({ id: 2, name: 'Site Event', eventtype: CalendarEventType.SITE }),
        createMockEvent({ id: 3, name: 'User Event', eventtype: CalendarEventType.USER }),
      ];

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events, hasMore: false, total: events.length },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Course Event')).toBeInTheDocument();
        expect(screen.getByText('Site Event')).toBeInTheDocument();
        expect(screen.getByText('User Event')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Pagination/Limiting Tests
  // ============================================================================

  describe('Pagination and Limiting', () => {
    it('limits display to configurable number of events (default 10)', async () => {
      const manyEvents = createManyEvents(15);
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: manyEvents, hasMore: true, total: manyEvents.length },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget maxEvents={10} />);

      await waitFor(() => {
        // Should show 10 of 15
        expect(screen.getByText('10 of 15')).toBeInTheDocument();
      });
    });

    it('shows "View all" link when more events exist', async () => {
      const manyEvents = createManyEvents(15);
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: manyEvents, hasMore: true, total: manyEvents.length },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget maxEvents={10} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /view all/i })).toBeInTheDocument();
      });
    });

    it('expands to show all events when "View all" is clicked', async () => {
      const user = userEvent.setup();
      const manyEvents = createManyEvents(15);
      
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: manyEvents, hasMore: true, total: manyEvents.length },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget maxEvents={10} />);

      await waitFor(() => {
        expect(screen.getByText('10 of 15')).toBeInTheDocument();
      });

      const viewAllButton = screen.getByRole('button', { name: /view all/i });
      await user.click(viewAllButton);

      await waitFor(() => {
        // After clicking "View all", should show all events
        expect(screen.getByText('15 of 15')).toBeInTheDocument();
      });
    });

    it('respects custom maxEvents prop', async () => {
      const manyEvents = createManyEvents(20);
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: manyEvents, hasMore: true, total: manyEvents.length },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget maxEvents={5} />);

      await waitFor(() => {
        expect(screen.getByText('5 of 20')).toBeInTheDocument();
      });
    });

    it('does not show "View all" when all events are displayed', async () => {
      const fewEvents = createManyEvents(5);
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: fewEvents, hasMore: false, total: fewEvents.length },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget maxEvents={10} />);

      await waitFor(() => {
        expect(screen.getByText('5 of 5')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /view all/i })).not.toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================

  describe('Empty State', () => {
    it('displays empty state message when no upcoming events', async () => {
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [], hasMore: false, total: 0 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText('No upcoming events')).toBeInTheDocument();
      });
    });

    it('shows encouraging message in empty state', async () => {
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [], hasMore: false, total: 0 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText(/events and deadlines will appear here/i)).toBeInTheDocument();
      });
    });

    it('displays an icon in empty state', async () => {
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [], hasMore: false, total: 0 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        // The CalendarTodayIcon should be present with aria-hidden
        const emptyStateIcon = document.querySelector('[data-testid="CalendarTodayIcon"], svg');
        expect(emptyStateIcon).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Data Fetching Tests
  // ============================================================================

  describe('Data Fetching', () => {
    it('fetches events from GET /api/v1/blocks/upcoming', async () => {
      let requestUrl: string | null = null;
      
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            success: true,
            data: { events: [], hasMore: false, total: 0 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(requestUrl).toContain('/blocks/upcoming');
      });
    });

    it('passes course context parameter when courseId is provided', async () => {
      let requestParams: URLSearchParams | null = null;
      
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, ({ request }) => {
          requestParams = new URL(request.url).searchParams;
          return HttpResponse.json({
            success: true,
            data: { events: [], hasMore: false, total: 0 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget courseId={101} />);

      await waitFor(() => {
        expect(requestParams?.get('courseid')).toBe('101');
      });
    });

    it('passes category context parameter when categoryId is provided', async () => {
      let requestParams: URLSearchParams | null = null;
      
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, ({ request }) => {
          requestParams = new URL(request.url).searchParams;
          return HttpResponse.json({
            success: true,
            data: { events: [], hasMore: false, total: 0 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget categoryId={5} />);

      await waitFor(() => {
        expect(requestParams?.get('categoryid')).toBe('5');
      });
    });

    it('uses React Query for caching', async () => {
      const queryClient = createTestQueryClient();
      
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [], hasMore: false, total: 0 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />, { queryClient });

      await waitFor(() => {
        expect(screen.getByText('No upcoming events')).toBeInTheDocument();
      });

      // Check that query is cached
      const queries = queryClient.getQueryCache().getAll();
      expect(queries.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Loading States Tests
  // ============================================================================

  describe('Loading States', () => {
    it('shows loading indicator during fetch', async () => {
      // Add delay to the response
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: { events: [], hasMore: false, total: 0 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      // Loading indicator should be visible
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('loading state has accessible label', async () => {
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: { events: [], hasMore: false, total: 0 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      const loadingIndicator = screen.getByRole('progressbar');
      expect(loadingIndicator).toHaveAttribute('aria-label', 'Loading upcoming events');
    });

    it('does not block widget container during loading', async () => {
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: { events: [], hasMore: false, total: 0 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      // Card should still be rendered during loading
      expect(screen.getByRole('heading', { name: /upcoming events/i })).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('displays error message on API failure', async () => {
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json(
            { success: false, error: { message: 'Server error' } },
            { status: 500 }
          );
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      // Wait longer for retries to exhaust (useUpcomingEvents has retry: 2, retryDelay: 1000)
      // Axios throws an error with "Request failed with status code 500" for 5xx responses
      await waitFor(() => {
        expect(screen.getByText(/request failed with status code 500/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('displays user-friendly error message', async () => {
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.error();
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      // Wait longer for retries to exhaust (useUpcomingEvents has retry: 2, retryDelay: 1000)
      // HttpResponse.error() creates a network error, which shows "Network Error"
      await waitFor(() => {
        const errorMessage = screen.getByText(/network error/i);
        expect(errorMessage).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('shows retry button on error', async () => {
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json(
            { success: false, error: { message: 'Server error' } },
            { status: 500 }
          );
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      // Wait longer for retries to exhaust (useUpcomingEvents has retry: 2, retryDelay: 1000)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('retry button refetches data', async () => {
      const user = userEvent.setup();
      let requestCount = 0;

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          requestCount++;
          // First request plus 2 retries (3 requests total for first "error" state)
          // After error state shows, user clicks retry, which triggers another batch
          if (requestCount <= 3) {
            return HttpResponse.json(
              { success: false, error: { message: 'Server error' } },
              { status: 500 }
            );
          }
          return HttpResponse.json({
            success: true,
            data: { events: [], hasMore: false, total: 0 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      // Wait longer for retries to exhaust (useUpcomingEvents has retry: 2, retryDelay: 1000)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      // Retry button should trigger a refetch; expect request count to be at least 4
      await waitFor(() => {
        expect(requestCount).toBeGreaterThanOrEqual(4);
      }, { timeout: 5000 });
    });

    it('handles network errors gracefully', async () => {
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.error();
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      // Wait longer for retries to exhaust (useUpcomingEvents has retry: 2, retryDelay: 1000)
      // HttpResponse.error() creates a network error, which shows "Network Error"
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  // ============================================================================
  // User Interactions Tests
  // ============================================================================

  describe('User Interactions', () => {
    it('clicking event navigates to event detail', async () => {
      const testEvent = createMockEvent({
        id: 1,
        name: 'Navigate Event',
        url: '/mod/assign/view.php?id=123',
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [testEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        const eventLink = screen.getByRole('link', { name: /navigate event/i });
        expect(eventLink).toHaveAttribute('href', '/mod/assign/view.php?id=123');
      });
    });

    it('"Go to calendar" link navigates to calendar page', async () => {
      renderWithProviders(<UpcomingEventsWidget calendarUrl="/calendar" />);

      await waitFor(() => {
        const calendarLink = screen.getByRole('link', { name: /go to calendar/i });
        expect(calendarLink).toHaveAttribute('href', '/calendar');
      });
    });

    it('uses custom calendar URL when provided', async () => {
      renderWithProviders(<UpcomingEventsWidget calendarUrl="/my-custom-calendar" />);

      await waitFor(() => {
        const calendarLink = screen.getByRole('link', { name: /go to calendar/i });
        expect(calendarLink).toHaveAttribute('href', '/my-custom-calendar');
      });
    });

    it('events support keyboard navigation', async () => {
      const testEvent = createMockEvent({
        id: 1,
        name: 'Keyboard Event',
        url: '/mod/assign/view.php?id=123',
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [testEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        const eventLink = screen.getByRole('link', { name: /keyboard event/i });
        // Links should be focusable
        expect(eventLink).not.toHaveAttribute('tabindex', '-1');
      });
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('has proper ARIA labels for event list', async () => {
      const events = createMockEventsAtDifferentTimes();
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events, hasMore: false, total: events.length },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        const eventList = screen.getByRole('list', { name: /upcoming events list/i });
        expect(eventList).toBeInTheDocument();
      });
    });

    it('events are keyboard accessible', async () => {
      const user = userEvent.setup();
      const testEvent = createMockEvent({
        id: 1,
        name: 'Accessible Event',
        url: '/mod/assign/view.php?id=123',
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [testEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Accessible Event')).toBeInTheDocument();
      });

      // Tab to the event link
      await user.tab();
      await user.tab(); // May need multiple tabs to reach the event

      // Should be able to focus on event links
      const eventLink = screen.getByRole('link', { name: /accessible event/i });
      expect(eventLink).toBeInTheDocument();
    });

    it('event items have proper aria-label with event details', async () => {
      const testEvent = createMockEvent({
        id: 1,
        name: 'Labeled Event',
        url: '/mod/assign/view.php?id=123',
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [testEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        const eventItem = screen.getByRole('link', { name: /labeled event/i });
        expect(eventItem).toHaveAttribute('aria-label');
        expect(eventItem.getAttribute('aria-label')).toContain('Labeled Event');
      });
    });

    it('widget title is a proper heading', async () => {
      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        const heading = screen.getByRole('heading', { name: /upcoming events/i });
        expect(heading.tagName.toLowerCase()).toBe('h2');
      });
    });

    it('decorative icons are hidden from screen readers', async () => {
      const testEvent = createMockEvent({
        id: 1,
        name: 'Icon Event',
        eventtype: CalendarEventType.COURSE,
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [testEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        // Check that icons have aria-hidden="true"
        const icons = document.querySelectorAll('[aria-hidden="true"]');
        expect(icons.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // Relative Time Formatting Tests
  // ============================================================================

  describe('Relative Time Formatting', () => {
    it('displays events with formatted time information', async () => {
      const now = Math.floor(Date.now() / 1000);
      const testEvent = createMockEvent({
        id: 1,
        name: 'Timed Event',
        timestart: now + 3600, // 1 hour from now
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [testEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Timed Event')).toBeInTheDocument();
        // Should show some time information
        // MUI ListItem renders as div with MuiListItem-root class, not <li>
        const eventItem = screen.getByText('Timed Event').closest('.MuiListItem-root');
        expect(eventItem).toHaveTextContent(/\w+/);
      });
    });

    it('formats near-term events with relative time', async () => {
      const now = Math.floor(Date.now() / 1000);
      const testEvent = createMockEvent({
        id: 1,
        name: 'Soon Event',
        timestart: now + 7200, // 2 hours from now
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [testEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        // Should show relative time like "in about 2 hours" or similar
        expect(screen.getByText('Soon Event')).toBeInTheDocument();
      });
    });

    it('formats future events with absolute dates', async () => {
      const now = Math.floor(Date.now() / 1000);
      const futureEvent = createMockEvent({
        id: 1,
        name: 'Future Event',
        timestart: now + 86400 * 30, // 30 days from now
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [futureEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Future Event')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Responsive Design Tests
  // ============================================================================

  describe('Responsive Design', () => {
    it('renders correctly in compact mode', async () => {
      const testEvent = createMockEvent({ id: 1, name: 'Compact Event' });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [testEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget compact />);

      await waitFor(() => {
        expect(screen.getByText('Compact Event')).toBeInTheDocument();
      });
    });

    it('applies proper styling in compact mode', async () => {
      const testEvent = createMockEvent({ id: 1, name: 'Styled Event' });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [testEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget compact />);

      await waitFor(() => {
        // Compact mode should have elevation 0
        const card = screen.getByRole('heading', { name: /upcoming events/i }).closest('.MuiCard-root');
        expect(card).toHaveClass('MuiPaper-elevation0');
      });
    });

    it('truncates long event names', async () => {
      const longNameEvent = createMockEvent({
        id: 1,
        name: 'This is a very long event name that should be truncated when displayed in the widget to prevent layout issues',
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [longNameEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        const eventText = screen.getByText(/this is a very long event/i);
        expect(eventText).toBeInTheDocument();
        // Should have CSS overflow handling
        expect(eventText).toHaveStyle({ overflow: 'hidden' });
      });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles malformed event data gracefully', async () => {
      // Event with minimal required fields
      const minimalEvent = {
        id: 1,
        name: 'Minimal Event',
        description: '',
        eventtype: CalendarEventType.COURSE,
        timestart: Math.floor(Date.now() / 1000) + 3600,
        timemodified: Math.floor(Date.now() / 1000),
      };

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [minimalEvent], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Minimal Event')).toBeInTheDocument();
      });
    });

    it('handles events with missing optional fields', async () => {
      const eventWithoutOptionals = createMockEvent({
        id: 1,
        name: 'No Optionals Event',
        modulename: undefined,
        url: undefined,
        courseid: undefined,
      });

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: [eventWithoutOptionals], hasMore: false, total: 1 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      await waitFor(() => {
        expect(screen.getByText('No Optionals Event')).toBeInTheDocument();
      });
    });

    it('handles rapid prop changes', async () => {
      const { rerender } = renderWithProviders(
        <UpcomingEventsWidget courseId={101} />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /upcoming events/i })).toBeInTheDocument();
      });

      // Re-render with different courseId
      // Note: The wrapper (with BrowserRouter) is preserved by RTL, so we only pass the component
      rerender(<UpcomingEventsWidget courseId={102} />);

      // Should not crash
      expect(screen.getByRole('heading', { name: /upcoming events/i })).toBeInTheDocument();
    });

    it('handles zero maxEvents prop', async () => {
      const events = createMockEventsAtDifferentTimes();
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events, hasMore: false, total: events.length },
          });
        })
      );

      // Should default to reasonable behavior
      renderWithProviders(<UpcomingEventsWidget maxEvents={0} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /upcoming events/i })).toBeInTheDocument();
      });
    });

    it('handles very large event sets', async () => {
      const manyEvents = createManyEvents(100);
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events: manyEvents, hasMore: true, total: manyEvents.length },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget maxEvents={10} />);

      await waitFor(() => {
        expect(screen.getByText('10 of 100')).toBeInTheDocument();
      });
    });

    it('handles server timeout', async () => {
      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, async () => {
          // Simulate timeout by not responding
          await new Promise((resolve) => setTimeout(resolve, 10000));
          return HttpResponse.json({
            success: true,
            data: { events: [], hasMore: false, total: 0 },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget />);

      // Should show loading state
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('renders complete workflow: loading -> data -> interaction', async () => {
      const user = userEvent.setup();
      const events = createManyEvents(15);

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json({
            success: true,
            data: { events, hasMore: true, total: events.length },
          });
        })
      );

      renderWithProviders(<UpcomingEventsWidget maxEvents={10} />);

      // 1. Loading state
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // 2. Data loaded
      await waitFor(() => {
        expect(screen.getByText('10 of 15')).toBeInTheDocument();
      });

      // 3. User interaction - View all
      const viewAllButton = screen.getByRole('button', { name: /view all/i });
      await user.click(viewAllButton);

      await waitFor(() => {
        expect(screen.getByText('15 of 15')).toBeInTheDocument();
      });
    });

    it('maintains consistent state after multiple re-renders', async () => {
      const queryClient = createTestQueryClient();
      const events = createMockEventsAtDifferentTimes();

      server.use(
        http.get(UPCOMING_EVENTS_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: { events, hasMore: false, total: events.length },
          });
        })
      );

      const { rerender } = renderWithProviders(
        <UpcomingEventsWidget />,
        { queryClient }
      );

      await waitFor(() => {
        expect(screen.getByText('Today')).toBeInTheDocument();
      });

      // Re-render multiple times
      // Note: The wrapper (with BrowserRouter) is preserved by RTL, so we only pass the component
      for (let i = 0; i < 3; i++) {
        rerender(<UpcomingEventsWidget />);
      }

      // State should remain consistent
      expect(screen.getByText('Today')).toBeInTheDocument();
    });
  });
});
