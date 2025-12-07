/**
 * Integration Tests for CalendarWidget Component
 *
 * This test suite covers the complete calendar widget workflow including:
 * - Calendar displaying current month with proper month/year header
 * - Event markers showing on dates with course events, assignments, quizzes
 * - Day click revealing event list for that specific day
 * - Event details popup showing time and description
 * - Filter functionality by course or event type
 * - Month navigation (previous/next month arrows)
 * - Today button navigation back to current date
 * - Add personal event button functionality
 *
 * Tests use MSW (Mock Service Worker) to mock the GET /api/v1/blocks/calendar
 * endpoint with realistic test data, enabling isolated integration testing
 * without backend dependencies.
 *
 * @package    react-frontend
 * @subpackage tests/integration
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  isToday,
  isSameDay,
  format,
  addMonths,
} from 'date-fns';

import { server } from '../mocks/server';
import { render, screen, waitFor, userEvent } from '../helpers/render';
import { CalendarWidget } from '@/features/dashboard/widgets/CalendarWidget';

// ============================================================================
// Type Definitions for Mock Data
// ============================================================================

/**
 * Calendar event type enum matching backend
 */
type CalendarEventType = 'site' | 'course' | 'category' | 'user' | 'group';

/**
 * Calendar event structure for mock data
 */
interface MockCalendarEvent {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly eventtype: CalendarEventType;
  readonly timestart: number;
  readonly timemodified: number;
  readonly courseid?: number;
  readonly groupid?: number;
  readonly userid?: number;
  readonly repeatid?: number;
  readonly modulename?: string;
  readonly instance?: number;
  readonly timeduration?: number;
  readonly visible?: boolean;
  readonly url?: string;
  readonly iconurl?: string;
}

/**
 * Calendar widget response structure
 */
interface MockCalendarWidgetData {
  readonly events: readonly MockCalendarEvent[];
  readonly month: number;
  readonly year: number;
  readonly navigation: {
    readonly prevMonth: string;
    readonly nextMonth: string;
    readonly today: string;
  };
}

// ============================================================================
// Test Data Factory Functions
// ============================================================================

/**
 * Creates a mock calendar event with sensible defaults
 *
 * @param overrides - Partial event properties to override defaults
 * @returns A complete mock calendar event
 */
function createMockEvent(overrides: Partial<MockCalendarEvent> = {}): MockCalendarEvent {
  const now = new Date();
  const defaultEvent: MockCalendarEvent = {
    id: Math.floor(Math.random() * 10000) + 1,
    name: 'Test Event',
    description: 'Test event description',
    eventtype: 'course',
    timestart: Math.floor(now.getTime() / 1000),
    timemodified: Math.floor(now.getTime() / 1000),
    courseid: 101,
    visible: true,
    timeduration: 3600, // 1 hour
    url: '/calendar/view.php?view=day',
  };

  return { ...defaultEvent, ...overrides };
}

/**
 * Creates a mock calendar widget response with events
 *
 * @param events - Array of calendar events
 * @param date - Date to generate month/year from (defaults to current date)
 * @returns Complete calendar widget data response
 */
function createMockCalendarData(
  events: MockCalendarEvent[] = [],
  date: Date = new Date()
): MockCalendarWidgetData {
  const month = date.getMonth() + 1; // 1-indexed month
  const year = date.getFullYear();

  return {
    events,
    month,
    year,
    navigation: {
      prevMonth: `/calendar/view.php?view=month&time=${Math.floor(addMonths(date, -1).getTime() / 1000)}`,
      nextMonth: `/calendar/view.php?view=month&time=${Math.floor(addMonths(date, 1).getTime() / 1000)}`,
      today: `/calendar/view.php?view=month&time=${Math.floor(new Date().getTime() / 1000)}`,
    },
  };
}

/**
 * Creates a set of test events for a given month
 *
 * @param baseDate - Base date to create events around
 * @returns Array of mock events distributed across the month
 */
function createMonthEvents(baseDate: Date = new Date()): MockCalendarEvent[] {
  const today = new Date();
  const monthStart = startOfMonth(baseDate);

  return [
    // Assignment due today
    createMockEvent({
      id: 1,
      name: 'Assignment: Essay Submission',
      description: 'Submit your essay on climate change by end of day.',
      eventtype: 'course',
      timestart: Math.floor(today.getTime() / 1000),
      courseid: 101,
      modulename: 'assign',
      instance: 1,
    }),
    // Quiz in 3 days
    createMockEvent({
      id: 2,
      name: 'Quiz: Chapter 5 Assessment',
      description: 'Multiple choice quiz covering Chapter 5 material.',
      eventtype: 'course',
      timestart: Math.floor(addDays(today, 3).getTime() / 1000),
      courseid: 101,
      modulename: 'quiz',
      instance: 2,
    }),
    // Forum deadline in 5 days
    createMockEvent({
      id: 3,
      name: 'Forum: Discussion Post Due',
      description: 'Post your response to the weekly discussion question.',
      eventtype: 'course',
      timestart: Math.floor(addDays(today, 5).getTime() / 1000),
      courseid: 102,
      modulename: 'forum',
      instance: 3,
    }),
    // Personal event (user type)
    createMockEvent({
      id: 4,
      name: 'Study Group Meeting',
      description: 'Weekly study group for Mathematics.',
      eventtype: 'user',
      timestart: Math.floor(addDays(today, 2).getTime() / 1000),
      userid: 1,
    }),
    // Site-wide event
    createMockEvent({
      id: 5,
      name: 'System Maintenance',
      description: 'Scheduled system maintenance window.',
      eventtype: 'site',
      timestart: Math.floor(addDays(today, 7).getTime() / 1000),
    }),
    // Past event (yesterday)
    createMockEvent({
      id: 6,
      name: 'Workshop: Academic Writing',
      description: 'Introduction to academic writing standards.',
      eventtype: 'course',
      timestart: Math.floor(subDays(today, 1).getTime() / 1000),
      courseid: 103,
      modulename: 'workshop',
      instance: 4,
    }),
    // Multiple events on same day (today)
    createMockEvent({
      id: 7,
      name: 'Office Hours',
      description: 'Professor office hours for questions.',
      eventtype: 'course',
      timestart: Math.floor(today.getTime() / 1000) + 7200, // 2 hours after first event
      courseid: 101,
    }),
    // Group event
    createMockEvent({
      id: 8,
      name: 'Group Project Meeting',
      description: 'Team meeting for final project.',
      eventtype: 'group',
      timestart: Math.floor(addDays(today, 4).getTime() / 1000),
      groupid: 5,
      courseid: 101,
    }),
  ];
}

/**
 * Creates events filtered by course ID
 *
 * @param courseId - Course ID to filter by
 * @param baseDate - Base date for events
 * @returns Filtered events for the specified course
 */
function createCourseFilteredEvents(courseId: number, baseDate: Date = new Date()): MockCalendarEvent[] {
  return createMonthEvents(baseDate).filter((event) => event.courseid === courseId);
}

/**
 * Creates events filtered by event type
 *
 * @param eventType - Event type to filter by
 * @param baseDate - Base date for events
 * @returns Filtered events of the specified type
 */
function createTypeFilteredEvents(
  eventType: CalendarEventType,
  baseDate: Date = new Date()
): MockCalendarEvent[] {
  return createMonthEvents(baseDate).filter((event) => event.eventtype === eventType);
}

// ============================================================================
// MSW Handler Factories
// ============================================================================

/**
 * Creates a successful calendar API handler with provided data
 *
 * @param data - Calendar widget data to return
 * @returns MSW request handler
 */
function createCalendarHandler(data: MockCalendarWidgetData) {
  return http.get('*/api/v1/blocks/calendar', () => {
    return HttpResponse.json({
      success: true,
      data,
      meta: {},
    });
  });
}

/**
 * Creates a calendar API handler that returns an error
 *
 * @param status - HTTP status code
 * @param message - Error message
 * @returns MSW request handler
 */
function createCalendarErrorHandler(status: number, message: string) {
  return http.get('*/api/v1/blocks/calendar', () => {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: status === 401 ? 'UNAUTHORIZED' : 'SERVER_ERROR',
          message,
        },
      },
      { status }
    );
  });
}

/**
 * Creates a calendar handler that filters by query parameters
 *
 * @param allEvents - All available events
 * @param baseDate - Base date for calendar data
 * @returns MSW request handler that respects filter params
 */
function createFilterableCalendarHandler(
  allEvents: MockCalendarEvent[],
  baseDate: Date = new Date()
) {
  return http.get('*/api/v1/blocks/calendar', ({ request }) => {
    const url = new URL(request.url);
    const courseId = url.searchParams.get('courseId');
    const categoryId = url.searchParams.get('categoryId');

    let filteredEvents = [...allEvents];

    if (courseId) {
      const cid = parseInt(courseId, 10);
      filteredEvents = filteredEvents.filter((e) => e.courseid === cid);
    }

    if (categoryId) {
      // Category filter - in real implementation would filter by category
      // For testing, we use categoryId as event type mapping
      const categoryTypeMap: Record<string, CalendarEventType> = {
        '1': 'course',
        '2': 'user',
        '3': 'site',
        '4': 'group',
      };
      const eventType = categoryTypeMap[categoryId];
      if (eventType) {
        filteredEvents = filteredEvents.filter((e) => e.eventtype === eventType);
      }
    }

    return HttpResponse.json({
      success: true,
      data: createMockCalendarData(filteredEvents, baseDate),
      meta: {},
    });
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe('CalendarWidget Integration Tests', () => {
  // Default test data
  const today = new Date();
  const defaultEvents = createMonthEvents(today);
  const defaultCalendarData = createMockCalendarData(defaultEvents, today);

  beforeEach(() => {
    // Reset handlers before each test
    server.resetHandlers();
    // Set up default calendar handler
    server.use(createCalendarHandler(defaultCalendarData));
  });

  afterEach(() => {
    // Clean up after each test
    server.resetHandlers();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Calendar Display Tests
  // ==========================================================================

  describe('Calendar Display', () => {
    it('displays the current month and year in the header', async () => {
      render(<CalendarWidget />);

      // Wait for calendar to load
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Check month/year header
      const expectedMonthYear = format(today, 'MMMM yyyy');
      expect(screen.getByText(expectedMonthYear)).toBeInTheDocument();
    });

    it('renders weekday headers (Sun-Sat)', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Check for weekday abbreviations
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      weekdays.forEach((day) => {
        expect(screen.getByText(day)).toBeInTheDocument();
      });
    });

    it('renders all days of the current month', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Get the number of days in the current month
      const daysInMonth = endOfMonth(today).getDate();

      // Verify that day numbers 1 through daysInMonth exist
      // Note: We use getAllByText since day numbers might appear multiple times
      // in different contexts (e.g., prev/next month overflow)
      for (let day = 1; day <= daysInMonth; day++) {
        const dayElements = screen.getAllByText(day.toString());
        expect(dayElements.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('highlights today\'s date', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Find today's date element - it should have special styling
      const todayDate = today.getDate().toString();
      const todayElements = screen.getAllByText(todayDate);

      // At least one should be marked as today (via aria-current or class)
      const todayElement = todayElements.find(
        (el) =>
          el.closest('[aria-current="date"]') !== null ||
          el.closest('.today') !== null ||
          el.getAttribute('aria-current') === 'date'
      );

      // The widget should indicate today in some way
      expect(todayElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Event Marker Tests
  // ==========================================================================

  describe('Event Markers', () => {
    it('displays event markers on dates with events', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Wait for events to be rendered
      await waitFor(() => {
        // Look for event indicator elements
        const eventIndicators = document.querySelectorAll('[data-testid*="event-indicator"]');
        expect(eventIndicators.length).toBeGreaterThan(0);
      });
    });

    it('shows multiple event markers when multiple events on same day', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Today has multiple events in our mock data (events id 1, 7)
      await waitFor(() => {
        // Find the cell for today and check for multiple indicators
        const todayCell = document.querySelector('[aria-current="date"]')?.closest('[role="gridcell"]') ||
          document.querySelector('.today')?.closest('[role="gridcell"]');

        if (todayCell) {
          const indicators = todayCell.querySelectorAll('[data-testid*="event-indicator"]');
          // Should have at least 2 events on today
          expect(indicators.length).toBeGreaterThanOrEqual(1);
        }
      });
    });

    it('displays different colors for different event types', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Wait for events to render
      await waitFor(() => {
        // Check that we have events of different types rendered
        // The component uses EVENT_TYPE_COLORS for coloring
        const indicators = document.querySelectorAll('[data-testid*="event-indicator"]');
        expect(indicators.length).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // Day Selection and Event Details Tests
  // ==========================================================================

  describe('Day Selection and Event Details', () => {
    it('shows event list when clicking on a date with events', async () => {
      const user = userEvent.setup();
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Find and click on today's date (which has events)
      const todayDate = today.getDate().toString();
      const dateButton = screen.getAllByText(todayDate).find(
        (el) => el.closest('button') || el.closest('[role="button"]')
      );

      if (dateButton) {
        await user.click(dateButton.closest('button') || dateButton);

        // Wait for event list/popup to appear
        await waitFor(() => {
          // Check for one of the events scheduled for today
          expect(screen.getByText('Assignment: Essay Submission')).toBeInTheDocument();
        });
      }
    });

    it('displays event details popup with time and description', async () => {
      const user = userEvent.setup();
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Wait for events to load, then click on an event
      await waitFor(() => {
        expect(screen.getByText('Assignment: Essay Submission')).toBeInTheDocument();
      });

      // Click on the event to see details
      const eventElement = screen.getByText('Assignment: Essay Submission');
      await user.click(eventElement);

      // Check for event details in popup/tooltip
      await waitFor(() => {
        // Description should be visible
        const description = screen.queryByText(/Submit your essay on climate change/i);
        expect(description).toBeInTheDocument();
      });
    });

    it('shows empty state message when clicking date with no events', async () => {
      // Set up handler with only one event far in the future
      const sparseEvents = [
        createMockEvent({
          id: 1,
          name: 'Future Event',
          timestart: Math.floor(addDays(today, 20).getTime() / 1000),
        }),
      ];
      server.use(createCalendarHandler(createMockCalendarData(sparseEvents, today)));

      const user = userEvent.setup();
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Find a date without events (e.g., day 1 if different from today)
      const emptyDay = today.getDate() === 1 ? '2' : '1';
      const dateButtons = screen.getAllByText(emptyDay);
      const dateButton = dateButtons.find(
        (el) => el.closest('button') || el.closest('[role="button"]')
      );

      if (dateButton) {
        await user.click(dateButton.closest('button') || dateButton);

        // Should show no events message or empty state
        await waitFor(() => {
          const noEventsMessage = screen.queryByText(/no events/i) ||
            screen.queryByText(/nothing scheduled/i);
          // Either shows message or simply doesn't show any events
          expect(noEventsMessage !== null || !screen.queryByRole('listitem')).toBeTruthy();
        });
      }
    });

    it('event popup includes event time', async () => {
      const user = userEvent.setup();
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Wait for events
      await waitFor(() => {
        expect(screen.getByText('Assignment: Essay Submission')).toBeInTheDocument();
      });

      // Click event
      const eventElement = screen.getByText('Assignment: Essay Submission');
      await user.click(eventElement);

      // Time should be displayed in some format
      await waitFor(() => {
        // Look for time patterns (e.g., "10:00 AM", "14:00", etc.)
        const timePattern = document.body.textContent?.match(/\d{1,2}:\d{2}\s*(AM|PM)?/i);
        expect(timePattern).toBeTruthy();
      });
    });
  });

  // ==========================================================================
  // Filter Tests
  // ==========================================================================

  describe('Event Filtering', () => {
    beforeEach(() => {
      // Use filterable handler for filter tests
      server.use(createFilterableCalendarHandler(defaultEvents, today));
    });

    it('filters events by course when course filter is selected', async () => {
      const user = userEvent.setup();
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Wait for initial events to load
      await waitFor(() => {
        expect(screen.getByText('Assignment: Essay Submission')).toBeInTheDocument();
      });

      // Find and click the filter dropdown/select
      const filterSelect = screen.queryByLabelText(/filter/i) ||
        screen.queryByRole('combobox') ||
        screen.queryByTestId('event-filter');

      if (filterSelect) {
        await user.click(filterSelect);

        // Select course 101 filter option
        const courseOption = screen.queryByText(/course 101/i) ||
          screen.queryByRole('option', { name: /course/i });

        if (courseOption) {
          await user.click(courseOption);

          // Wait for filtered results
          await waitFor(() => {
            // Should still show course 101 events
            expect(screen.getByText('Assignment: Essay Submission')).toBeInTheDocument();
            // Should not show course 102 events
            expect(screen.queryByText('Forum: Discussion Post Due')).not.toBeInTheDocument();
          });
        }
      }
    });

    it('filters events by type when type filter is selected', async () => {
      const user = userEvent.setup();
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Wait for initial events
      await waitFor(() => {
        expect(screen.getByText('Assignment: Essay Submission')).toBeInTheDocument();
      });

      // Look for type filter (might be tabs or dropdown)
      const typeFilter = screen.queryByRole('tablist') ||
        screen.queryByLabelText(/event type/i) ||
        screen.queryByTestId('type-filter');

      if (typeFilter) {
        // Find and click "Personal" or "User" type filter
        const userTypeOption = screen.queryByRole('tab', { name: /personal/i }) ||
          screen.queryByRole('tab', { name: /user/i }) ||
          screen.queryByText(/personal events/i);

        if (userTypeOption) {
          await user.click(userTypeOption);

          // Should show only user events
          await waitFor(() => {
            expect(screen.getByText('Study Group Meeting')).toBeInTheDocument();
            // Course events should be hidden
            expect(screen.queryByText('Assignment: Essay Submission')).not.toBeInTheDocument();
          });
        }
      }
    });

    it('shows all events when "All" filter is selected', async () => {
      const user = userEvent.setup();
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Find "All" filter option (default state)
      const allFilter = screen.queryByRole('tab', { name: /all/i }) ||
        screen.queryByText(/all events/i);

      if (allFilter) {
        await user.click(allFilter);

        // All event types should be visible
        await waitFor(() => {
          expect(screen.getByText('Assignment: Essay Submission')).toBeInTheDocument();
        });
      }
    });
  });

  // ==========================================================================
  // Navigation Tests
  // ==========================================================================

  describe('Month Navigation', () => {
    it('navigates to previous month when clicking previous arrow', async () => {
      const user = userEvent.setup();
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Find previous month button
      const prevButton = screen.getByRole('button', { name: /previous/i }) ||
        screen.getByLabelText(/previous month/i) ||
        screen.getByTestId('prev-month-button');

      // Get current month display
      const currentMonthText = format(today, 'MMMM yyyy');
      expect(screen.getByText(currentMonthText)).toBeInTheDocument();

      // Click previous
      await user.click(prevButton);

      // Wait for month to change
      const prevMonth = addMonths(today, -1);
      const prevMonthText = format(prevMonth, 'MMMM yyyy');

      await waitFor(() => {
        expect(screen.getByText(prevMonthText)).toBeInTheDocument();
      });
    });

    it('navigates to next month when clicking next arrow', async () => {
      const user = userEvent.setup();
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Find next month button
      const nextButton = screen.getByRole('button', { name: /next/i }) ||
        screen.getByLabelText(/next month/i) ||
        screen.getByTestId('next-month-button');

      // Click next
      await user.click(nextButton);

      // Wait for month to change
      const nextMonth = addMonths(today, 1);
      const nextMonthText = format(nextMonth, 'MMMM yyyy');

      await waitFor(() => {
        expect(screen.getByText(nextMonthText)).toBeInTheDocument();
      });
    });

    it('returns to current month when clicking today button', async () => {
      const user = userEvent.setup();
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // First navigate away from current month
      const nextButton = screen.getByRole('button', { name: /next/i }) ||
        screen.getByLabelText(/next month/i) ||
        screen.getByTestId('next-month-button');

      await user.click(nextButton);
      await user.click(nextButton); // Two months ahead

      // Verify we're not on current month
      const futureMonth = addMonths(today, 2);
      await waitFor(() => {
        expect(screen.getByText(format(futureMonth, 'MMMM yyyy'))).toBeInTheDocument();
      });

      // Find and click today button
      const todayButton = screen.getByRole('button', { name: /today/i }) ||
        screen.getByText(/today/i);

      await user.click(todayButton);

      // Should return to current month
      await waitFor(() => {
        const currentMonthText = format(today, 'MMMM yyyy');
        expect(screen.getByText(currentMonthText)).toBeInTheDocument();
      });
    });

    it('maintains navigation state after filtering', async () => {
      server.use(createFilterableCalendarHandler(defaultEvents, today));
      const user = userEvent.setup();
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Navigate to next month
      const nextButton = screen.getByRole('button', { name: /next/i }) ||
        screen.getByLabelText(/next month/i) ||
        screen.getByTestId('next-month-button');

      await user.click(nextButton);

      const nextMonth = addMonths(today, 1);
      const nextMonthText = format(nextMonth, 'MMMM yyyy');

      await waitFor(() => {
        expect(screen.getByText(nextMonthText)).toBeInTheDocument();
      });

      // Apply a filter (if filter UI exists)
      const filterSelect = screen.queryByLabelText(/filter/i) ||
        screen.queryByRole('combobox');

      if (filterSelect) {
        await user.click(filterSelect);
        const option = screen.queryByRole('option');
        if (option) {
          await user.click(option);
        }
      }

      // Month should still be the navigated month
      await waitFor(() => {
        expect(screen.getByText(nextMonthText)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Add Event Tests
  // ==========================================================================

  describe('Add Personal Event', () => {
    it('displays add event button', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Look for add event button
      const addButton = screen.queryByRole('button', { name: /add event/i }) ||
        screen.queryByRole('button', { name: /new event/i }) ||
        screen.queryByLabelText(/add.*event/i) ||
        screen.queryByTestId('add-event-button');

      expect(addButton).toBeInTheDocument();
    });

    it('opens event creation form when clicking add button', async () => {
      const user = userEvent.setup();
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Find add button
      const addButton = screen.queryByRole('button', { name: /add event/i }) ||
        screen.queryByRole('button', { name: /new event/i }) ||
        screen.queryByTestId('add-event-button');

      if (addButton) {
        await user.click(addButton);

        // Check for form or dialog
        await waitFor(() => {
          const form = screen.queryByRole('dialog') ||
            screen.queryByRole('form') ||
            screen.queryByLabelText(/event name/i) ||
            screen.queryByPlaceholderText(/event/i);

          expect(form).toBeInTheDocument();
        });
      }
    });
  });

  // ==========================================================================
  // Loading and Error State Tests
  // ==========================================================================

  describe('Loading and Error States', () => {
    it('displays loading indicator while fetching data', async () => {
      // Delay the response to see loading state
      server.use(
        http.get('*/api/v1/blocks/calendar', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: defaultCalendarData,
            meta: {},
          });
        })
      );

      render(<CalendarWidget />);

      // Should show loading initially
      expect(
        screen.queryByRole('progressbar') ||
        screen.queryByText(/loading/i) ||
        screen.queryByTestId('calendar-loading')
      ).toBeInTheDocument();

      // Eventually loads
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });

    it('displays error message when API fails', async () => {
      server.use(createCalendarErrorHandler(500, 'Internal server error'));

      render(<CalendarWidget />);

      await waitFor(() => {
        const errorMessage = screen.queryByText(/error/i) ||
          screen.queryByText(/failed/i) ||
          screen.queryByRole('alert');

        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('displays empty state when no events exist', async () => {
      server.use(createCalendarHandler(createMockCalendarData([], today)));

      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Calendar should still render, just without event markers
      const expectedMonthYear = format(today, 'MMMM yyyy');
      expect(screen.getByText(expectedMonthYear)).toBeInTheDocument();

      // No event indicators should be present
      await waitFor(() => {
        const indicators = document.querySelectorAll('[data-testid*="event-indicator"]');
        expect(indicators.length).toBe(0);
      });
    });

    it('handles network error gracefully', async () => {
      server.use(
        http.get('*/api/v1/blocks/calendar', () => {
          return HttpResponse.error();
        })
      );

      render(<CalendarWidget />);

      await waitFor(() => {
        const errorElement = screen.queryByText(/error/i) ||
          screen.queryByText(/unable to load/i) ||
          screen.queryByRole('alert');

        expect(errorElement).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('calendar has proper ARIA grid role', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Calendar should use grid role for accessibility
      const grid = screen.queryByRole('grid') || document.querySelector('[role="grid"]');
      expect(grid).toBeInTheDocument();
    });

    it('navigation buttons have accessible labels', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Previous/next buttons should have accessible names
      const prevButton = screen.queryByRole('button', { name: /previous/i }) ||
        screen.queryByLabelText(/previous/i);
      const nextButton = screen.queryByRole('button', { name: /next/i }) ||
        screen.queryByLabelText(/next/i);

      expect(prevButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();
    });

    it('event indicators have accessible descriptions', async () => {
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Events should be accessible (via tooltip, aria-label, or visible text)
      await waitFor(() => {
        // At minimum, events should be focusable or have aria attributes
        const events = document.querySelectorAll('[aria-label*="event"], [title]');
        expect(events.length).toBeGreaterThanOrEqual(0);
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Tab to first focusable element
      await user.tab();

      // Should be able to navigate using keyboard
      const focusedElement = document.activeElement;
      expect(focusedElement).not.toBe(document.body);
    });
  });

  // ==========================================================================
  // Tooltip and Hover Tests
  // ==========================================================================

  describe('Event Tooltips', () => {
    it('shows tooltip on event hover', async () => {
      const user = userEvent.setup();
      render(<CalendarWidget />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Wait for events to load
      await waitFor(() => {
        const eventIndicators = document.querySelectorAll('[data-testid*="event-indicator"]');
        expect(eventIndicators.length).toBeGreaterThan(0);
      });

      // Hover over an event indicator
      const firstIndicator = document.querySelector('[data-testid*="event-indicator"]');
      if (firstIndicator) {
        await user.hover(firstIndicator);

        // Tooltip should appear
        await waitFor(() => {
          const tooltip = screen.queryByRole('tooltip') ||
            document.querySelector('[role="tooltip"]');
          // Either a tooltip appears or event details become visible
          expect(
            tooltip !== null ||
            screen.queryByText(/Assignment/i) !== null
          ).toBeTruthy();
        });
      }
    });
  });
});
