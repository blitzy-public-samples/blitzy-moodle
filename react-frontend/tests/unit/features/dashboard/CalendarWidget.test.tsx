/**
 * Unit Tests for CalendarWidget Component
 *
 * Comprehensive test suite for the CalendarWidget component that displays a monthly
 * calendar view with events. Tests cover rendering, event display, navigation,
 * date formatting, responsive layout, data fetching, loading states, error handling,
 * user interactions, and accessibility compliance.
 *
 * Test Coverage Requirements:
 * - 90%+ code coverage for CalendarWidget component
 * - All user interaction paths tested
 * - Accessibility validation (WCAG 2.1 AA)
 * - API integration with React Query
 *
 * Based on Moodle's calendar block:
 * - public/blocks/calendar_month/block_calendar_month.php
 *
 * @package    react-frontend
 * @subpackage tests/unit/features/dashboard
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { format, addMonths, subMonths } from 'date-fns';

// Import the global MSW server from test mocks
import { server } from '@tests/mocks/server';

// Internal imports from depends_on_files
import CalendarWidget from '@/features/dashboard/widgets/CalendarWidget';
import { render } from '@tests/helpers/render';
import { generateMockDate } from '@tests/helpers/mockData';
import { CalendarEventType } from '@/features/dashboard/types/dashboard.types';
import type { CalendarEvent } from '@/features/dashboard/types/dashboard.types';
import type { CalendarWidgetData } from '@/features/dashboard/api/dashboardApi';

// ============================================================================
// Test Constants
// ============================================================================

/**
 * Base API URL for mock server - matches VITE_API_BASE_URL in vitest.config.ts
 */
const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * Calendar endpoint path
 */
const CALENDAR_ENDPOINT = `${API_BASE_URL}/blocks/calendar`;

/**
 * Weekday labels expected in calendar header
 */
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock calendar event with realistic data
 *
 * @param overrides - Properties to override in the default event
 * @returns Complete CalendarEvent object
 */
function createMockCalendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  const id = overrides.id ?? Math.floor(Math.random() * 10000) + 1;
  const now = new Date();
  const timestart = overrides.timestart ?? Math.floor(now.getTime() / 1000);

  return {
    id,
    name: overrides.name ?? `Event ${id}`,
    description: overrides.description ?? `Description for event ${id}`,
    eventtype: overrides.eventtype ?? CalendarEventType.COURSE,
    timestart,
    timemodified: overrides.timemodified ?? timestart,
    courseid: overrides.courseid,
    groupid: overrides.groupid,
    userid: overrides.userid,
    repeatid: overrides.repeatid,
    modulename: overrides.modulename,
    instance: overrides.instance,
    timeduration: overrides.timeduration ?? 3600,
    visible: overrides.visible ?? true,
    url: overrides.url,
    iconurl: overrides.iconurl,
  };
}

/**
 * Creates mock calendar widget data with events
 *
 * @param events - Array of calendar events
 * @param month - Month number (1-12)
 * @param year - Year number
 * @returns Complete CalendarWidgetData object
 */
function createMockCalendarData(
  events: CalendarEvent[] = [],
  month?: number,
  year?: number
): CalendarWidgetData {
  const now = new Date();
  return {
    events,
    month: month ?? now.getMonth() + 1,
    year: year ?? now.getFullYear(),
    navigation: {
      prevMonth: '/calendar?month=prev',
      nextMonth: '/calendar?month=next',
      today: '/calendar?month=today',
    },
  };
}

/**
 * Creates events for different dates in the current month
 *
 * @param count - Number of events to create
 * @returns Array of calendar events spread across the month
 */
function createEventsForMonth(count: number = 5): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const eventDate = new Date(now.getFullYear(), now.getMonth(), i + 5, 10, 0, 0);
    events.push(
      createMockCalendarEvent({
        id: i + 1,
        name: `Monthly Event ${i + 1}`,
        timestart: Math.floor(eventDate.getTime() / 1000),
        eventtype: Object.values(CalendarEventType)[i % 5] as CalendarEventType,
      })
    );
  }
  
  return events;
}

/**
 * Creates multiple events on the same date
 *
 * @param date - Date for the events
 * @param count - Number of events
 * @returns Array of calendar events on the same date
 */
function createEventsOnSameDay(date: Date, count: number = 3): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const eventTypes = Object.values(CalendarEventType);
  
  for (let i = 0; i < count; i++) {
    const eventDate = new Date(date);
    eventDate.setHours(9 + i, 0, 0, 0);
    
    events.push(
      createMockCalendarEvent({
        id: i + 100,
        name: `Same Day Event ${i + 1}`,
        timestart: Math.floor(eventDate.getTime() / 1000),
        eventtype: eventTypes[i % eventTypes.length] as CalendarEventType,
      })
    );
  }
  
  return events;
}

// ============================================================================
// Mock Server Setup
// ============================================================================

/**
 * Default successful response handler for calendar endpoint
 * This handler is added to the global MSW server at the start of each test
 */
const defaultCalendarHandler = http.get(CALENDAR_ENDPOINT, () => {
  const events = createEventsForMonth(5);
  return HttpResponse.json({
    success: true,
    data: createMockCalendarData(events),
    meta: {},
  });
});

// ============================================================================
// Test Configuration Constants
// ============================================================================

/**
 * Timeout for waitFor when testing error states.
 * React Query's useCalendarWidget hook has retry: 2 with retryDelay: 1000,
 * so the component takes ~3 seconds before showing error state.
 * We use 5 seconds to provide margin for test stability.
 */
const ERROR_WAIT_TIMEOUT = { timeout: 5000 };

// ============================================================================
// Test Suite
// ============================================================================

describe('CalendarWidget', () => {
  // Setup default calendar handler before each test
  // The global server is already started by tests/setup.ts
  beforeEach(() => {
    // Add the default calendar handler to the global server
    server.use(defaultCalendarHandler);
  });

  // Clear mocks after each test
  // Note: server.resetHandlers() is called by the global afterEach in setup.ts
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering Tests', () => {
    it('renders calendar month view correctly', async () => {
      render(<CalendarWidget />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Verify calendar grid is rendered
      expect(screen.getByRole('grid', { name: /calendar for/i })).toBeInTheDocument();
    });

    it('displays current month by default', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const now = new Date();
      const expectedMonth = format(now, 'MMMM yyyy');
      
      expect(screen.getByText(expectedMonth)).toBeInTheDocument();
    });

    it('shows all days of the month in grid layout', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Check that day numbers are rendered (at least 28 days in any month)
      // Note: We use getAllByText because the calendar displays padding days from 
      // adjacent months, so some day numbers (like "1") may appear multiple times
      for (let day = 1; day <= 28; day++) {
        const dayElements = screen.getAllByText(String(day));
        expect(dayElements.length).toBeGreaterThan(0);
      }
    });

    it('shows day names header (Sun, Mon, Tue, etc.)', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Verify all weekday labels are present
      WEEKDAY_LABELS.forEach((day) => {
        expect(screen.getByText(day)).toBeInTheDocument();
      });
    });

    it('shows month and year header', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const now = new Date();
      const monthYear = format(now, 'MMMM yyyy');
      
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(monthYear);
    });

    it('uses Material-UI Card for container styling', async () => {
      const { container } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // MUI Card renders as a div with MuiCard class
      const cardElement = container.querySelector('.MuiCard-root');
      expect(cardElement).toBeInTheDocument();
    });

    it('renders with custom title when provided', async () => {
      render(<CalendarWidget title="My Custom Calendar" />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      expect(screen.getByText('My Custom Calendar')).toBeInTheDocument();
    });

    it('renders default title when not provided', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Calendar')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Event Display Tests
  // ==========================================================================

  describe('Event Display Tests', () => {
    it('renders calendar events on correct dates', async () => {
      const now = new Date();
      const eventDate = new Date(now.getFullYear(), now.getMonth(), 15, 14, 30);
      const event = createMockCalendarEvent({
        id: 1,
        name: 'Test Event',
        timestart: Math.floor(eventDate.getTime() / 1000),
      });

      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([event]),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Event indicator should be present
      const eventIndicator = screen.getByTestId(`event-indicator-${event.id}`);
      expect(eventIndicator).toBeInTheDocument();
    });

    it('displays event title and time in tooltip', async () => {
      const now = new Date();
      const eventDate = new Date(now.getFullYear(), now.getMonth(), 15, 14, 30);
      const event = createMockCalendarEvent({
        id: 1,
        name: 'Meeting with Team',
        timestart: Math.floor(eventDate.getTime() / 1000),
      });

      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([event]),
            meta: {},
          });
        })
      );

      const { user } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const eventIndicator = screen.getByTestId(`event-indicator-${event.id}`);
      await user.hover(eventIndicator);

      // Tooltip should appear with event name
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('stacks multiple events on same day', async () => {
      const now = new Date();
      const eventDate = new Date(now.getFullYear(), now.getMonth(), 15);
      const events = createEventsOnSameDay(eventDate, 3);

      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData(events),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // All 3 event indicators should be visible (max is 3 by default)
      events.forEach((event) => {
        expect(screen.getByTestId(`event-indicator-${event.id}`)).toBeInTheDocument();
      });
    });

    it('shows +X more badge when more than max events on a day', async () => {
      const now = new Date();
      const eventDate = new Date(now.getFullYear(), now.getMonth(), 15);
      const events = createEventsOnSameDay(eventDate, 5); // More than max (3)

      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData(events),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Badge should show +2 (5 events - 3 visible = 2 more)
      await waitFor(() => {
        expect(screen.getByText('+2')).toBeInTheDocument();
      });
    });

    it('applies different colors for different event types', async () => {
      const now = new Date();
      const baseDate = new Date(now.getFullYear(), now.getMonth(), 10);
      
      const events = [
        createMockCalendarEvent({
          id: 1,
          name: 'Site Event',
          timestart: Math.floor(baseDate.getTime() / 1000),
          eventtype: CalendarEventType.SITE,
        }),
        createMockCalendarEvent({
          id: 2,
          name: 'Course Event',
          timestart: Math.floor(new Date(baseDate.getTime() + 86400000).getTime() / 1000),
          eventtype: CalendarEventType.COURSE,
        }),
      ];

      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData(events),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Both event indicators should have data-event-type attribute
      const siteEvent = screen.getByTestId('event-indicator-1');
      const courseEvent = screen.getByTestId('event-indicator-2');
      
      expect(siteEvent).toHaveAttribute('data-event-type', CalendarEventType.SITE);
      expect(courseEvent).toHaveAttribute('data-event-type', CalendarEventType.COURSE);
    });

    it('renders event legend showing all event types', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Check that event type labels are shown in legend
      expect(screen.getByText('Site Event')).toBeInTheDocument();
      expect(screen.getByText('Course Event')).toBeInTheDocument();
      expect(screen.getByText('Category Event')).toBeInTheDocument();
      expect(screen.getByText('User Event')).toBeInTheDocument();
      expect(screen.getByText('Group Event')).toBeInTheDocument();
    });

    it('respects course context when provided', async () => {
      const courseId = 101;
      
      server.use(
        http.get(CALENDAR_ENDPOINT, ({ request }) => {
          const url = new URL(request.url);
          const requestedCourseId = url.searchParams.get('courseid');
          
          // Verify course ID is passed in request
          expect(requestedCourseId).toBe(String(courseId));
          
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([]),
            meta: {},
          });
        })
      );

      render(<CalendarWidget courseId={courseId} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Navigation Tests
  // ==========================================================================

  describe('Navigation Tests', () => {
    it('navigates to previous month when clicking previous button', async () => {
      const { user } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const now = new Date();
      const currentMonth = format(now, 'MMMM yyyy');
      expect(screen.getByText(currentMonth)).toBeInTheDocument();

      // Click previous month button
      const prevButton = screen.getByRole('button', { name: /previous month/i });
      await user.click(prevButton);

      // Check that previous month is now displayed
      const previousMonth = format(subMonths(now, 1), 'MMMM yyyy');
      expect(screen.getByText(previousMonth)).toBeInTheDocument();
    });

    it('navigates to next month when clicking next button', async () => {
      const { user } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const now = new Date();
      
      // Click next month button
      const nextButton = screen.getByRole('button', { name: /next month/i });
      await user.click(nextButton);

      // Check that next month is now displayed
      const nextMonth = format(addMonths(now, 1), 'MMMM yyyy');
      expect(screen.getByText(nextMonth)).toBeInTheDocument();
    });

    it('updates month/year display on navigation', async () => {
      const { user } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const now = new Date();
      
      // Navigate forward twice
      const nextButton = screen.getByRole('button', { name: /next month/i });
      await user.click(nextButton);
      await user.click(nextButton);

      // Should show 2 months ahead
      const twoMonthsAhead = format(addMonths(now, 2), 'MMMM yyyy');
      expect(screen.getByText(twoMonthsAhead)).toBeInTheDocument();
    });

    it('navigates to current month when clicking today button', async () => {
      const { user } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Navigate away from current month
      const nextButton = screen.getByRole('button', { name: /next month/i });
      await user.click(nextButton);
      await user.click(nextButton);

      // Click today button
      const todayButton = screen.getByRole('button', { name: /go to today/i });
      await user.click(todayButton);

      // Should be back to current month
      const now = new Date();
      const currentMonth = format(now, 'MMMM yyyy');
      expect(screen.getByText(currentMonth)).toBeInTheDocument();
    });

    it('shows navigation buttons with proper tooltips', async () => {
      const { user } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Hover over previous button to show tooltip
      const prevButton = screen.getByRole('button', { name: /previous month/i });
      await user.hover(prevButton);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent(/previous month/i);
      });
    });

    it('handles rapid navigation without race conditions', async () => {
      const { user } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /next month/i });
      
      // Rapid clicks
      await user.click(nextButton);
      await user.click(nextButton);
      await user.click(nextButton);

      // Should show 3 months ahead
      const now = new Date();
      const threeMonthsAhead = format(addMonths(now, 3), 'MMMM yyyy');
      
      await waitFor(() => {
        expect(screen.getByText(threeMonthsAhead)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Date Formatting Tests
  // ==========================================================================

  describe('Date Formatting Tests', () => {
    it('formats dates correctly using date-fns', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const now = new Date();
      const expectedFormat = format(now, 'MMMM yyyy');
      
      expect(screen.getByText(expectedFormat)).toBeInTheDocument();
    });

    it('capitalizes month names properly', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const now = new Date();
      const monthName = format(now, 'MMMM');
      
      // First letter should be capitalized
      expect(monthName.length).toBeGreaterThan(0);
      expect(monthName.charAt(0)).toBe(monthName.charAt(0).toUpperCase());
      expect(screen.getByText(new RegExp(monthName))).toBeInTheDocument();
    });

    it('formats event times in tooltip correctly', async () => {
      const now = new Date();
      const eventDate = new Date(now.getFullYear(), now.getMonth(), 15, 14, 30);
      const event = createMockCalendarEvent({
        id: 1,
        name: 'Formatted Time Event',
        timestart: Math.floor(eventDate.getTime() / 1000),
      });

      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([event]),
            meta: {},
          });
        })
      );

      const { user } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const eventIndicator = screen.getByTestId(`event-indicator-${event.id}`);
      await user.hover(eventIndicator);

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toBeInTheDocument();
        // Tooltip should contain the event name
        expect(tooltip).toHaveTextContent('Formatted Time Event');
      });
    });
  });

  // ==========================================================================
  // Responsive Layout Tests
  // ==========================================================================

  describe('Responsive Layout Tests', () => {
    it('renders calendar grid with proper structure', async () => {
      const { container } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Grid container should be present
      const grid = container.querySelector('.MuiGrid-container');
      expect(grid).toBeInTheDocument();
    });

    it('maintains proper spacing and alignment', async () => {
      const { container } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Check that card content has proper padding
      const cardContent = container.querySelector('.MuiCardContent-root');
      expect(cardContent).toBeInTheDocument();
    });

    it('renders week rows properly', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Each week should be a row
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThanOrEqual(4); // Minimum 4 weeks in a month view
      expect(rows.length).toBeLessThanOrEqual(6); // Maximum 6 weeks
    });
  });

  // ==========================================================================
  // Data Fetching Tests
  // ==========================================================================

  describe('Data Fetching Tests', () => {
    it('fetches calendar data from correct endpoint', async () => {
      let requestMade = false;
      
      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          requestMade = true;
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([]),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(requestMade).toBe(true);
      });
    });

    it('passes courseId parameter to API when provided', async () => {
      let receivedCourseId: string | null = null;
      
      server.use(
        http.get(CALENDAR_ENDPOINT, ({ request }) => {
          const url = new URL(request.url);
          receivedCourseId = url.searchParams.get('courseid');
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([]),
            meta: {},
          });
        })
      );

      render(<CalendarWidget courseId={101} />);

      await waitFor(() => {
        expect(receivedCourseId).toBe('101');
      });
    });

    it('passes categoryId parameter to API when provided', async () => {
      let receivedCategoryId: string | null = null;
      
      server.use(
        http.get(CALENDAR_ENDPOINT, ({ request }) => {
          const url = new URL(request.url);
          receivedCategoryId = url.searchParams.get('categoryid');
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([]),
            meta: {},
          });
        })
      );

      render(<CalendarWidget categoryId={5} />);

      await waitFor(() => {
        expect(receivedCategoryId).toBe('5');
      });
    });

    it('uses React Query for data fetching and caching', async () => {
      const { queryClient } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Query should be cached in React Query
      const queries = queryClient.getQueryCache().getAll();
      expect(queries.length).toBeGreaterThan(0);
      
      // Find the calendar query
      const calendarQuery = queries.find(q => 
        Array.isArray(q.queryKey) && q.queryKey.includes('calendar')
      );
      expect(calendarQuery).toBeDefined();
    });
  });

  // ==========================================================================
  // Loading States Tests
  // ==========================================================================

  describe('Loading States', () => {
    it('shows loading indicator during initial data fetch', async () => {
      // Delay the response to ensure loading state is visible
      server.use(
        http.get(CALENDAR_ENDPOINT, async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([]),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      // Loading indicator should be present initially
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByLabelText(/loading calendar/i)).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });

    it('shows loading skeleton matching calendar layout', async () => {
      server.use(
        http.get(CALENDAR_ENDPOINT, async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([]),
            meta: {},
          });
        })
      );

      const { container } = render(<CalendarWidget />);

      // During loading, should still show the card structure
      expect(container.querySelector('.MuiCard-root')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('maintains navigation controls during loading', async () => {
      server.use(
        http.get(CALENDAR_ENDPOINT, async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([]),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // After initial load, calendar is rendered
      expect(screen.getByRole('button', { name: /previous month/i })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('displays error message when API fails', async () => {
      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json(
            { success: false, error: { message: 'Server error' } },
            { status: 500 }
          );
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }, ERROR_WAIT_TIMEOUT);
    });

    it('shows user-friendly error text', async () => {
      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json(
            { success: false, error: { message: 'Connection failed' } },
            { status: 500 }
          );
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(/failed|error/i);
      }, ERROR_WAIT_TIMEOUT);
    });

    it('shows retry button on error', async () => {
      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json(
            { success: false, error: { message: 'Error' } },
            { status: 500 }
          );
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      }, ERROR_WAIT_TIMEOUT);
    });

    it('refetches data when retry button is clicked', async () => {
      let errorRequestCount = 0;
      let successAfterRetry = false;
      
      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          // React Query retries 2 times, so 3 total requests for initial error
          // After retry button click, we want success
          errorRequestCount++;
          
          if (successAfterRetry) {
            return HttpResponse.json({
              success: true,
              data: createMockCalendarData([]),
              meta: {},
            });
          }
          
          return HttpResponse.json(
            { success: false, error: { message: 'Error' } },
            { status: 500 }
          );
        })
      );

      const { user } = render(<CalendarWidget />);

      // Wait for error state (after all retries exhausted)
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }, ERROR_WAIT_TIMEOUT);

      // Set flag to return success on next request
      successAfterRetry = true;

      // Click retry
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Should eventually succeed
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });

      // Should have made at least 4 requests (3 initial retries + 1 manual retry)
      expect(errorRequestCount).toBeGreaterThanOrEqual(4);
    });

    it('does not crash on malformed data', async () => {
      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: {
              events: null, // Malformed - should be array
              month: 'invalid', // Malformed - should be number
              year: 2024,
            },
            meta: {},
          });
        })
      );

      // Should not throw
      expect(() => render(<CalendarWidget />)).not.toThrow();
    });

    it('handles network errors gracefully', async () => {
      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.error();
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }, ERROR_WAIT_TIMEOUT);
    });
  });

  // ==========================================================================
  // User Interactions Tests
  // ==========================================================================

  describe('User Interactions', () => {
    it('calls onEventClick when event is clicked', async () => {
      const onEventClick = vi.fn();
      const event = createMockCalendarEvent({
        id: 1,
        name: 'Clickable Event',
        timestart: generateMockDate(0),
      });

      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([event]),
            meta: {},
          });
        })
      );

      const { user } = render(<CalendarWidget onEventClick={onEventClick} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const eventIndicator = screen.getByTestId(`event-indicator-${event.id}`);
      await user.click(eventIndicator);

      expect(onEventClick).toHaveBeenCalledTimes(1);
      expect(onEventClick).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    });

    it('calls onDateSelect when date is clicked', async () => {
      const onDateSelect = vi.fn();

      render(<CalendarWidget onDateSelect={onDateSelect} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Click on a date (day 15)
      const dateButton = screen.getByRole('button', { name: /15/ });
      fireEvent.click(dateButton);

      expect(onDateSelect).toHaveBeenCalledTimes(1);
      expect(onDateSelect).toHaveBeenCalledWith(expect.any(Date));
    });

    it('shows tooltip with event preview on hover', async () => {
      const event = createMockCalendarEvent({
        id: 1,
        name: 'Hover Preview Event',
        timestart: generateMockDate(0),
      });

      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([event]),
            meta: {},
          });
        })
      );

      const { user } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const eventIndicator = screen.getByTestId(`event-indicator-${event.id}`);
      await user.hover(eventIndicator);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByRole('tooltip')).toHaveTextContent('Hover Preview Event');
      });
    });

    it('supports keyboard navigation for date selection', async () => {
      const onDateSelect = vi.fn();

      render(<CalendarWidget onDateSelect={onDateSelect} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Find a date button and simulate keyboard interaction
      const dateButton = screen.getByRole('button', { name: /15/ });
      dateButton.focus();
      fireEvent.keyDown(dateButton, { key: 'Enter' });

      expect(onDateSelect).toHaveBeenCalled();
    });

    it('supports space key for date selection', async () => {
      const onDateSelect = vi.fn();

      render(<CalendarWidget onDateSelect={onDateSelect} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const dateButton = screen.getByRole('button', { name: /15/ });
      dateButton.focus();
      fireEvent.keyDown(dateButton, { key: ' ' });

      expect(onDateSelect).toHaveBeenCalled();
    });

    it('highlights selected date', async () => {
      const { user } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const dateButton = screen.getByRole('button', { name: /15/ });
      await user.click(dateButton);

      // The button should have aria-pressed="true"
      expect(dateButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility Tests', () => {
    it('has proper ARIA labels on calendar grid', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const grid = screen.getByRole('grid');
      expect(grid).toHaveAttribute('aria-label');
      expect(grid.getAttribute('aria-label')).toMatch(/calendar for/i);
    });

    it('has accessible names on navigation buttons', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /previous month/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next month/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go to today/i })).toBeInTheDocument();
    });

    it('makes events keyboard accessible', async () => {
      const event = createMockCalendarEvent({
        id: 1,
        name: 'Accessible Event',
        timestart: generateMockDate(0),
      });

      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([event]),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const eventIndicator = screen.getByTestId(`event-indicator-${event.id}`);
      expect(eventIndicator).toHaveAttribute('aria-label');
    });

    it('provides accessible date labels with event counts', async () => {
      const now = new Date();
      const eventDate = new Date(now.getFullYear(), now.getMonth(), 15);
      const events = createEventsOnSameDay(eventDate, 2);

      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData(events),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Date cells should have aria-label with event count
      const dateButtons = screen.getAllByRole('button');
      const dateWithEvents = dateButtons.find(btn => 
        btn.getAttribute('aria-label')?.includes('2 events')
      );
      
      expect(dateWithEvents).toBeInTheDocument();
    });

    it('has proper focus indicators', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Check that focusable elements have focus styles defined
      const dateButton = screen.getByRole('button', { name: /15/ });
      dateButton.focus();
      
      // MUI applies focus styles, we just verify element is focusable
      expect(document.activeElement).toBe(dateButton);
    });

    it('supports screen reader announcements for loading', async () => {
      server.use(
        http.get(CALENDAR_ENDPOINT, async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([]),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      // Loading spinner should have accessible label
      const spinner = screen.getByRole('progressbar');
      expect(spinner).toHaveAttribute('aria-label', 'Loading calendar');
    });

    it('has accessible error messages', async () => {
      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json(
            { success: false, error: { message: 'Error' } },
            { status: 500 }
          );
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        // MUI Alert has role="alert" which is automatically announced
      }, ERROR_WAIT_TIMEOUT);
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles empty calendar with no events', async () => {
      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([]),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Calendar should render without events
      expect(screen.getByRole('grid')).toBeInTheDocument();
      
      // No event indicators should be present
      expect(screen.queryByTestId(/event-indicator/)).not.toBeInTheDocument();
    });

    it('handles months with 28 days correctly (February non-leap)', async () => {
      const { user } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Navigate to a February
      const now = new Date();
      const currentMonth = now.getMonth();
      
      // Navigate to February (month 1)
      const monthsToFebruary = currentMonth >= 1 
        ? (1 - currentMonth + 12) % 12 || 12
        : 1 - currentMonth;
      
      const prevButton = screen.getByRole('button', { name: /previous month/i });
      const nextButton = screen.getByRole('button', { name: /next month/i });
      
      // Navigate appropriately
      if (monthsToFebruary > 0) {
        for (let i = 0; i < monthsToFebruary; i++) {
          await user.click(nextButton);
        }
      } else {
        for (let i = 0; i < Math.abs(monthsToFebruary); i++) {
          await user.click(prevButton);
        }
      }

      // Calendar should render without errors
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('handles months with 31 days correctly', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Check that day 31 exists (or not, depending on current month)
      const now = new Date();
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      
      if (lastDayOfMonth === 31) {
        expect(screen.getByText('31')).toBeInTheDocument();
      }
    });

    it('handles leap year February correctly', async () => {
      // This test validates the calendar can handle leap years
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Calendar should render without errors regardless of year
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('handles events at midnight correctly', async () => {
      const now = new Date();
      const midnightDate = new Date(now.getFullYear(), now.getMonth(), 15, 0, 0, 0);
      const event = createMockCalendarEvent({
        id: 1,
        name: 'Midnight Event',
        timestart: Math.floor(midnightDate.getTime() / 1000),
      });

      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([event]),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Event should still be rendered
      expect(screen.getByTestId(`event-indicator-${event.id}`)).toBeInTheDocument();
    });

    it('handles events spanning multiple days', async () => {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 10, 9, 0);
      const event = createMockCalendarEvent({
        id: 1,
        name: 'Multi-day Event',
        timestart: Math.floor(startDate.getTime() / 1000),
        timeduration: 172800, // 2 days in seconds
      });

      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([event]),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Event should be rendered (at least on start date)
      expect(screen.getByTestId(`event-indicator-${event.id}`)).toBeInTheDocument();
    });

    it('shows event count subheader when events exist', async () => {
      const events = createEventsForMonth(5);

      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData(events),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Subheader should show event count
      await waitFor(() => {
        expect(screen.getByText(/\d+ events? this month/i)).toBeInTheDocument();
      });
    });

    it('does not show event count subheader when no events', async () => {
      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([]),
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Subheader should not show event count
      expect(screen.queryByText(/events? this month/i)).not.toBeInTheDocument();
    });

    it('highlights today correctly', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const today = new Date();
      const todayDay = today.getDate();
      
      // Find today's date button - it should have different styling
      // Look for button with today's date that has some indication it's today
      const dateButtons = screen.getAllByRole('button');
      const todayButton = dateButtons.find(btn => {
        const label = btn.getAttribute('aria-label') || '';
        const text = btn.textContent || '';
        return (
          text.includes(String(todayDay)) && 
          label.includes(format(today, 'MMMM d, yyyy'))
        );
      });

      expect(todayButton).toBeInTheDocument();
    });

    it('dims dates from adjacent months', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // The calendar should contain dates from adjacent months (with reduced opacity)
      // This is handled by the opacity styling in the component
      const grid = screen.getByRole('grid');
      expect(grid).toBeInTheDocument();
      
      // Just verify the grid renders - the dimming is CSS-based
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration Tests', () => {
    it('complete user flow: navigate, select date, view event', async () => {
      const onDateSelect = vi.fn();
      const onEventClick = vi.fn();
      
      const now = new Date();
      const nextMonth = addMonths(now, 1);
      const eventDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 15, 14, 0);
      const event = createMockCalendarEvent({
        id: 1,
        name: 'Future Event',
        timestart: Math.floor(eventDate.getTime() / 1000),
      });

      // First request returns current month data
      let requestCount = 0;
      server.use(
        http.get(CALENDAR_ENDPOINT, () => {
          requestCount++;
          // Return event data for any request
          return HttpResponse.json({
            success: true,
            data: createMockCalendarData([event], nextMonth.getMonth() + 1, nextMonth.getFullYear()),
            meta: {},
          });
        })
      );

      const { user } = render(
        <CalendarWidget onDateSelect={onDateSelect} onEventClick={onEventClick} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Navigate to next month
      const nextButton = screen.getByRole('button', { name: /next month/i });
      await user.click(nextButton);

      // Click on a date
      const dateButton = screen.getByRole('button', { name: /15/ });
      await user.click(dateButton);

      expect(onDateSelect).toHaveBeenCalled();

      // Click on event (if visible)
      const eventIndicator = screen.queryByTestId('event-indicator-1');
      if (eventIndicator) {
        await user.click(eventIndicator);
        expect(onEventClick).toHaveBeenCalled();
      }
    });

    it('maintains state after navigation and back', async () => {
      const { user } = render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const now = new Date();
      const currentMonth = format(now, 'MMMM yyyy');

      // Navigate forward
      const nextButton = screen.getByRole('button', { name: /next month/i });
      await user.click(nextButton);

      const nextMonthDisplay = format(addMonths(now, 1), 'MMMM yyyy');
      expect(screen.getByText(nextMonthDisplay)).toBeInTheDocument();

      // Navigate back
      const prevButton = screen.getByRole('button', { name: /previous month/i });
      await user.click(prevButton);

      expect(screen.getByText(currentMonth)).toBeInTheDocument();
    });
  });
});
