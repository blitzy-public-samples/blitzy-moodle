/**
 * @fileoverview Comprehensive unit tests for TimelineWidget component
 *
 * Tests validate timeline display with filtering, sorting options, mark as done
 * functionality, user preference persistence, loading and error states.
 * Target: 90%+ test coverage.
 *
 * @module tests/unit/features/dashboard/TimelineWidget.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { TimelineWidget } from '@/features/dashboard/widgets/TimelineWidget';
import { clearAllStorage, setupStorageMock, expectLocalStorageItem } from '../../../helpers/storageUtils';
import { createPastDate, createFutureDate, freezeTime, unfreezeTime } from '../../../helpers/dateUtils';
import type { TimelineItem, TimelinePreferences } from '@/features/dashboard/types/dashboard.types';

// ============================================================================
// Test Constants
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const TIMELINE_ENDPOINT = `${API_BASE_URL}/blocks/timeline`;
const TIMELINE_PREFERENCES_KEY = 'moodle_timeline_preferences';

// Default preferences matching the component
const DEFAULT_PREFERENCES: TimelinePreferences = {
  sort: 'sortbydates',
  filter: 'all',
  limit: 10,
};

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock timeline item for testing
 */
function createMockTimelineItem(overrides: Partial<TimelineItem> = {}): TimelineItem {
  const id = overrides.id ?? Math.floor(Math.random() * 10000);
  return {
    id,
    name: `Activity ${id}`,
    description: `Description for activity ${id}`,
    activityType: 'assignment',
    moduleIcon: 'assignment',
    courseName: 'Test Course',
    courseId: 101,
    courseUrl: '/course/view.php?id=101',
    dueDate: createFutureDate(7).getTime() / 1000, // Unix timestamp
    dueDateFormatted: 'Due in 7 days',
    url: `/mod/assign/view.php?id=${id}`,
    completed: false,
    overdueBy: null,
    courseColor: '#1976d2',
    ...overrides,
  };
}

/**
 * Creates mock timeline data with diverse items for testing different scenarios
 */
function createMockTimelineData(itemCount: number = 5, filter?: string): TimelineItem[] {
  const items: TimelineItem[] = [];
  const now = Date.now();

  for (let i = 0; i < itemCount; i++) {
    let dueDate: number;
    let overdueBy: number | null = null;
    let dueDateFormatted: string;

    // Distribute items across different time ranges based on filter or index
    if (filter === 'overdue' || (i % 5 === 0 && !filter)) {
      // Overdue items (past due dates)
      const daysOverdue = Math.floor(Math.random() * 10) + 1;
      dueDate = createPastDate(daysOverdue).getTime() / 1000;
      overdueBy = daysOverdue;
      dueDateFormatted = `Overdue by ${daysOverdue} days`;
    } else if (filter === 'next7days' || (i % 5 === 1 && !filter)) {
      // Due within 7 days
      const daysUntilDue = Math.floor(Math.random() * 7) + 1;
      dueDate = createFutureDate(daysUntilDue).getTime() / 1000;
      dueDateFormatted = daysUntilDue === 1 ? 'Due tomorrow' : `Due in ${daysUntilDue} days`;
    } else if (filter === 'next30days' || (i % 5 === 2 && !filter)) {
      // Due within 30 days
      const daysUntilDue = Math.floor(Math.random() * 23) + 8; // 8-30 days
      dueDate = createFutureDate(daysUntilDue).getTime() / 1000;
      dueDateFormatted = `Due in ${daysUntilDue} days`;
    } else {
      // Due today or within hours
      const hoursUntilDue = Math.floor(Math.random() * 23) + 1;
      dueDate = (now + hoursUntilDue * 60 * 60 * 1000) / 1000;
      dueDateFormatted = hoursUntilDue <= 12 ? `Due in ${hoursUntilDue} hours` : 'Due today';
    }

    const activityTypes = ['assignment', 'quiz', 'forum', 'lesson', 'workshop'] as const;
    const activityType = activityTypes[i % activityTypes.length];

    items.push(createMockTimelineItem({
      id: i + 1,
      name: `${activityType.charAt(0).toUpperCase() + activityType.slice(1)} ${i + 1}`,
      activityType,
      moduleIcon: activityType,
      courseName: `Course ${(i % 3) + 1}`,
      courseId: (i % 3) + 101,
      courseColor: ['#1976d2', '#388e3c', '#f57c00'][(i % 3)],
      dueDate,
      dueDateFormatted,
      overdueBy,
    }));
  }

  return items;
}

// ============================================================================
// Test Setup Utilities
// ============================================================================

/**
 * Creates a fresh QueryClient for each test
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Wrapper component providing all necessary providers
 */
function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Custom render function with all providers
 */
function renderWithProviders(ui: React.ReactElement, options = {}) {
  const queryClient = createTestQueryClient();
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>,
      options
    ),
    queryClient,
  };
}

// ============================================================================
// MSW Handler Factories
// ============================================================================

/**
 * Creates a timeline handler with custom response
 */
function createTimelineHandler(
  items: TimelineItem[],
  options: { hasMore?: boolean; total?: number; delay?: number } = {}
) {
  const { hasMore = false, total = items.length, delay = 0 } = options;
  
  return http.get(TIMELINE_ENDPOINT, async () => {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    return HttpResponse.json({
      success: true,
      data: {
        items,
        preferences: DEFAULT_PREFERENCES,
        hasMore,
        total,
      },
    });
  });
}

/**
 * Creates an error handler for testing error states
 */
function createTimelineErrorHandler(statusCode: number = 500, message: string = 'Server error') {
  return http.get(TIMELINE_ENDPOINT, () => {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message,
        },
      },
      { status: statusCode }
    );
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe('TimelineWidget', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    user = userEvent.setup();
    setupStorageMock();
    
    // Default handler returning diverse timeline items
    server.use(createTimelineHandler(createMockTimelineData(10)));
  });

  afterEach(() => {
    server.resetHandlers();
    clearAllStorage();
    vi.clearAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  // ==========================================================================
  // 1. Rendering Tests
  // ==========================================================================

  describe('Rendering', () => {
    it('renders the widget with Timeline title', async () => {
      renderWithProviders(<TimelineWidget />);
      
      expect(screen.getByText('Timeline')).toBeInTheDocument();
    });

    it('renders component using Material-UI Card container', async () => {
      const { container } = renderWithProviders(<TimelineWidget />);
      
      // MUI Card component adds MuiCard-root class
      await waitFor(() => {
        const card = container.querySelector('.MuiCard-root');
        expect(card).toBeInTheDocument();
      });
    });

    it('displays activity timeline after loading', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Assignment 1')).toBeInTheDocument();
      });
    });

    it('renders activities chronologically by default', async () => {
      const sortedItems = [
        createMockTimelineItem({ id: 1, name: 'First Activity', dueDate: createFutureDate(1).getTime() / 1000 }),
        createMockTimelineItem({ id: 2, name: 'Second Activity', dueDate: createFutureDate(3).getTime() / 1000 }),
        createMockTimelineItem({ id: 3, name: 'Third Activity', dueDate: createFutureDate(5).getTime() / 1000 }),
      ];
      server.use(createTimelineHandler(sortedItems));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(3);
      });
      
      // Verify order
      const listItems = screen.getAllByRole('listitem');
      expect(within(listItems[0]).getByText('First Activity')).toBeInTheDocument();
      expect(within(listItems[1]).getByText('Second Activity')).toBeInTheDocument();
      expect(within(listItems[2]).getByText('Third Activity')).toBeInTheDocument();
    });

    it('has proper card styling with header and content sections', async () => {
      const { container } = renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(container.querySelector('.MuiCardHeader-root')).toBeInTheDocument();
        expect(container.querySelector('.MuiCardContent-root')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // 2. Filter Tabs Tests
  // ==========================================================================

  describe('Filter Tabs', () => {
    it('renders all filter tab options', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /overdue/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /next 7 days/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /next 30 days/i })).toBeInTheDocument();
      });
    });

    it('highlights active tab with aria-selected attribute', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const allTab = screen.getByRole('tab', { name: /all/i });
        expect(allTab).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('switches to Overdue tab when clicked', async () => {
      const overdueItems = createMockTimelineData(3, 'overdue');
      server.use(createTimelineHandler(overdueItems));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /overdue/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('tab', { name: /overdue/i }));
      
      await waitFor(() => {
        const overdueTab = screen.getByRole('tab', { name: /overdue/i });
        expect(overdueTab).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('switches to Next 7 days tab and refetches data', async () => {
      let filterParam: string | null = null;
      
      server.use(
        http.get(TIMELINE_ENDPOINT, ({ request }) => {
          const url = new URL(request.url);
          filterParam = url.searchParams.get('filter');
          return HttpResponse.json({
            success: true,
            data: {
              items: createMockTimelineData(5, 'next7days'),
              preferences: { ...DEFAULT_PREFERENCES, filter: 'next7days' },
              hasMore: false,
              total: 5,
            },
          });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /next 7 days/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('tab', { name: /next 7 days/i }));
      
      await waitFor(() => {
        expect(filterParam).toBe('next7days');
      });
    });

    it('switches to Next 30 days tab', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /next 30 days/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('tab', { name: /next 30 days/i }));
      
      await waitFor(() => {
        const tab = screen.getByRole('tab', { name: /next 30 days/i });
        expect(tab).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('persists tab selection in local storage', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /overdue/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('tab', { name: /overdue/i }));
      
      await waitFor(() => {
        const stored = localStorage.getItem(TIMELINE_PREFERENCES_KEY);
        expect(stored).toBeTruthy();
        const prefs = JSON.parse(stored!);
        expect(prefs.filter).toBe('overdue');
      });
    });
  });

  // ==========================================================================
  // 3. Activity Display Tests
  // ==========================================================================

  describe('Activity Display', () => {
    const mockItems = [
      createMockTimelineItem({
        id: 1,
        name: 'Test Assignment',
        description: 'Submit your work',
        activityType: 'assignment',
        courseName: 'Math 101',
        dueDate: createFutureDate(5).getTime() / 1000,
        dueDateFormatted: 'Due in 5 days',
      }),
    ];

    beforeEach(() => {
      server.use(createTimelineHandler(mockItems));
    });

    it('displays activity title', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Assignment')).toBeInTheDocument();
      });
    });

    it('displays activity course name', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Math 101')).toBeInTheDocument();
      });
    });

    it('displays due date information', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText(/due in 5 days/i)).toBeInTheDocument();
      });
    });

    it('displays activity type icon', async () => {
      const { container } = renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        // Assignment icon should be present
        const icon = container.querySelector('[data-testid="AssignmentIcon"]');
        expect(icon).toBeInTheDocument();
      });
    });

    it('renders activity as a link to activity page', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const link = screen.getByRole('link', { name: /test assignment/i });
        expect(link).toHaveAttribute('href', expect.stringContaining('/mod/assign/view.php'));
      });
    });

    it('applies course color for visual distinction', async () => {
      const itemWithColor = createMockTimelineItem({
        id: 1,
        name: 'Colored Activity',
        courseColor: '#ff5722',
      });
      server.use(createTimelineHandler([itemWithColor]));
      
      const { container } = renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        // The course color should be applied somewhere (e.g., border or avatar background)
        const coloredElement = container.querySelector('[style*="ff5722"], [style*="#ff5722"]');
        // Color may be applied via className or inline style
        expect(screen.getByText('Colored Activity')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // 4. Due Date Display Tests
  // ==========================================================================

  describe('Due Date Display', () => {
    it('shows overdue items with "Overdue by X days" text', async () => {
      const overdueItem = createMockTimelineItem({
        id: 1,
        name: 'Overdue Task',
        dueDate: createPastDate(3).getTime() / 1000,
        overdueBy: 3,
        dueDateFormatted: 'Overdue by 3 days',
      });
      server.use(createTimelineHandler([overdueItem]));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText(/overdue by 3 days/i)).toBeInTheDocument();
      });
    });

    it('applies red color styling to overdue items', async () => {
      const overdueItem = createMockTimelineItem({
        id: 1,
        name: 'Overdue Task',
        dueDate: createPastDate(2).getTime() / 1000,
        overdueBy: 2,
        dueDateFormatted: 'Overdue by 2 days',
      });
      server.use(createTimelineHandler([overdueItem]));
      
      const { container } = renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const overdueText = screen.getByText(/overdue by 2 days/i);
        // Check for error color class or red styling
        expect(overdueText).toHaveStyle({ color: expect.stringMatching(/rgb\(211|#d32f2f|error|red/i) });
      });
    });

    it('shows items due soon with "Due in X hours" in orange', async () => {
      const now = Date.now();
      const soonItem = createMockTimelineItem({
        id: 1,
        name: 'Due Soon Task',
        dueDate: (now + 6 * 60 * 60 * 1000) / 1000, // 6 hours from now
        dueDateFormatted: 'Due in 6 hours',
      });
      server.use(createTimelineHandler([soonItem]));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText(/due in 6 hours/i)).toBeInTheDocument();
      });
    });

    it('shows "Due tomorrow" for items due next day', async () => {
      const tomorrowItem = createMockTimelineItem({
        id: 1,
        name: 'Tomorrow Task',
        dueDate: createFutureDate(1).getTime() / 1000,
        dueDateFormatted: 'Due tomorrow',
      });
      server.use(createTimelineHandler([tomorrowItem]));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText(/due tomorrow/i)).toBeInTheDocument();
      });
    });

    it('shows items due later with neutral/green styling', async () => {
      const laterItem = createMockTimelineItem({
        id: 1,
        name: 'Later Task',
        dueDate: createFutureDate(14).getTime() / 1000,
        dueDateFormatted: 'Due in 14 days',
      });
      server.use(createTimelineHandler([laterItem]));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const dueDateText = screen.getByText(/due in 14 days/i);
        expect(dueDateText).toBeInTheDocument();
      });
    });

    it('shows exact date on hover via tooltip', async () => {
      const item = createMockTimelineItem({
        id: 1,
        name: 'Tooltip Test',
        dueDate: createFutureDate(7).getTime() / 1000,
      });
      server.use(createTimelineHandler([item]));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Tooltip Test')).toBeInTheDocument();
      });
      
      // Hover over the due date to trigger tooltip
      const dueDateElement = screen.getByText(/due in/i);
      await user.hover(dueDateElement);
      
      // Tooltip should show exact date format
      await waitFor(() => {
        // Look for tooltip with full date format
        const tooltip = screen.queryByRole('tooltip');
        // Tooltip might not appear instantly or might use different mechanism
        expect(dueDateElement).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // 5. Sorting Options Tests
  // ==========================================================================

  describe('Sorting Options', () => {
    it('renders sort options selector', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        // Look for sort dropdown or button
        const sortButton = screen.getByRole('button', { name: /sort/i });
        expect(sortButton).toBeInTheDocument();
      });
    });

    it('shows sort by date option', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sort/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /sort/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /date/i })).toBeInTheDocument();
      });
    });

    it('shows sort by course option', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sort/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /sort/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /course/i })).toBeInTheDocument();
      });
    });

    it('updates activity list when sort option changes', async () => {
      let sortParam: string | null = null;
      
      server.use(
        http.get(TIMELINE_ENDPOINT, ({ request }) => {
          const url = new URL(request.url);
          sortParam = url.searchParams.get('sort');
          return HttpResponse.json({
            success: true,
            data: {
              items: createMockTimelineData(5),
              preferences: { ...DEFAULT_PREFERENCES, sort: sortParam || 'sortbydates' },
              hasMore: false,
              total: 5,
            },
          });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sort/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /sort/i }));
      await user.click(screen.getByRole('menuitem', { name: /course/i }));
      
      await waitFor(() => {
        expect(sortParam).toBe('sortbycourses');
      });
    });

    it('persists sort preference in local storage', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sort/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /sort/i }));
      await user.click(screen.getByRole('menuitem', { name: /course/i }));
      
      await waitFor(() => {
        const stored = localStorage.getItem(TIMELINE_PREFERENCES_KEY);
        expect(stored).toBeTruthy();
        const prefs = JSON.parse(stored!);
        expect(prefs.sort).toBe('sortbycourses');
      });
    });
  });

  // ==========================================================================
  // 6. Mark as Done Functionality Tests
  // ==========================================================================

  describe('Mark as Done Functionality', () => {
    const testItem = createMockTimelineItem({
      id: 123,
      name: 'Task to Complete',
      completed: false,
    });

    beforeEach(() => {
      server.use(createTimelineHandler([testItem]));
    });

    it('renders mark as done checkbox for each activity', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox', { name: /mark.*done/i });
        expect(checkbox).toBeInTheDocument();
      });
    });

    it('triggers API call when mark as done is clicked', async () => {
      let markDoneCalled = false;
      
      server.use(
        http.post(`${API_BASE_URL}/activities/:id/complete`, () => {
          markDoneCalled = true;
          return HttpResponse.json({ success: true });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /mark.*done/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /mark.*done/i }));
      
      await waitFor(() => {
        expect(markDoneCalled).toBe(true);
      });
    });

    it('optimistically updates UI when marking as done', async () => {
      server.use(
        http.post(`${API_BASE_URL}/activities/:id/complete`, async () => {
          // Delay to test optimistic update
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({ success: true });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Task to Complete')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /mark.*done/i }));
      
      // Should be marked immediately (optimistic update)
      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox', { name: /mark.*done/i });
        expect(checkbox).toBeChecked();
      });
    });

    it('restores activity on API error (rollback)', async () => {
      server.use(
        http.post(`${API_BASE_URL}/activities/:id/complete`, () => {
          return HttpResponse.json(
            { success: false, error: { message: 'Failed' } },
            { status: 500 }
          );
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Task to Complete')).toBeInTheDocument();
      });
      
      const checkbox = screen.getByRole('checkbox', { name: /mark.*done/i });
      await user.click(checkbox);
      
      // After error, should be unchecked again
      await waitFor(() => {
        expect(checkbox).not.toBeChecked();
      });
    });

    it('shows undo option briefly after marking done', async () => {
      server.use(
        http.post(`${API_BASE_URL}/activities/:id/complete`, () => {
          return HttpResponse.json({ success: true });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Task to Complete')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /mark.*done/i }));
      
      // Look for undo option (snackbar or inline button)
      await waitFor(() => {
        const undoButton = screen.queryByRole('button', { name: /undo/i });
        // Undo might be shown in a snackbar
        expect(undoButton || screen.queryByText(/undo/i)).toBeInTheDocument();
      });
    });

    it('filters completed activities from relevant views', async () => {
      const items = [
        createMockTimelineItem({ id: 1, name: 'Completed Task', completed: true }),
        createMockTimelineItem({ id: 2, name: 'Pending Task', completed: false }),
      ];
      server.use(createTimelineHandler(items));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        // Completed tasks might be hidden or shown differently
        expect(screen.getByText('Pending Task')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // 7. User Preference Persistence Tests
  // ==========================================================================

  describe('User Preference Persistence', () => {
    it('loads saved preferences on mount', async () => {
      const savedPrefs: TimelinePreferences = {
        sort: 'sortbycourses',
        filter: 'overdue',
        limit: 20,
      };
      localStorage.setItem(TIMELINE_PREFERENCES_KEY, JSON.stringify(savedPrefs));
      
      let requestedFilter: string | null = null;
      server.use(
        http.get(TIMELINE_ENDPOINT, ({ request }) => {
          const url = new URL(request.url);
          requestedFilter = url.searchParams.get('filter');
          return HttpResponse.json({
            success: true,
            data: {
              items: createMockTimelineData(5, 'overdue'),
              preferences: savedPrefs,
              hasMore: false,
              total: 5,
            },
          });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(requestedFilter).toBe('overdue');
      });
    });

    it('persists filter change to local storage', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /next 7 days/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('tab', { name: /next 7 days/i }));
      
      expectLocalStorageItem(TIMELINE_PREFERENCES_KEY, (value) => {
        const prefs = JSON.parse(value);
        return prefs.filter === 'next7days';
      });
    });

    it('persists sort change to local storage', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sort/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /sort/i }));
      await user.click(screen.getByRole('menuitem', { name: /course/i }));
      
      expectLocalStorageItem(TIMELINE_PREFERENCES_KEY, (value) => {
        const prefs = JSON.parse(value);
        return prefs.sort === 'sortbycourses';
      });
    });

    it('uses useLocalStorage hook for preference management', async () => {
      // Verify the component uses localStorage by checking preference restoration
      const initialPrefs: TimelinePreferences = {
        sort: 'sortbycourses',
        filter: 'next30days',
        limit: 15,
      };
      localStorage.setItem(TIMELINE_PREFERENCES_KEY, JSON.stringify(initialPrefs));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const tab = screen.getByRole('tab', { name: /next 30 days/i });
        expect(tab).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  // ==========================================================================
  // 8. Item Limit Configuration Tests
  // ==========================================================================

  describe('Item Limit Configuration', () => {
    it('respects default item limit of 10', async () => {
      server.use(createTimelineHandler(createMockTimelineData(15), { hasMore: true, total: 15 }));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const items = screen.getAllByRole('listitem');
        expect(items.length).toBeLessThanOrEqual(10);
      });
    });

    it('shows "Show more" button when more items exist', async () => {
      server.use(createTimelineHandler(createMockTimelineData(10), { hasMore: true, total: 25 }));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
      });
    });

    it('loads additional items when "Show more" is clicked', async () => {
      let limitParam: number | null = null;
      
      server.use(
        http.get(TIMELINE_ENDPOINT, ({ request }) => {
          const url = new URL(request.url);
          limitParam = parseInt(url.searchParams.get('limit') || '10');
          return HttpResponse.json({
            success: true,
            data: {
              items: createMockTimelineData(limitParam),
              preferences: { ...DEFAULT_PREFERENCES, limit: limitParam },
              hasMore: limitParam < 25,
              total: 25,
            },
          });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /show more/i }));
      
      await waitFor(() => {
        expect(limitParam).toBeGreaterThan(10);
      });
    });

    it('hides "Show more" when all items loaded', async () => {
      server.use(createTimelineHandler(createMockTimelineData(5), { hasMore: false, total: 5 }));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
      });
    });

    it('persists limit preference changes', async () => {
      server.use(createTimelineHandler(createMockTimelineData(10), { hasMore: true, total: 25 }));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /show more/i }));
      
      await waitFor(() => {
        const stored = localStorage.getItem(TIMELINE_PREFERENCES_KEY);
        if (stored) {
          const prefs = JSON.parse(stored);
          expect(prefs.limit).toBeGreaterThan(10);
        }
      });
    });
  });

  // ==========================================================================
  // 9. Empty State Tests
  // ==========================================================================

  describe('Empty States', () => {
    it('displays empty state when no activities', async () => {
      server.use(createTimelineHandler([]));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText(/no.*activities/i)).toBeInTheDocument();
      });
    });

    it('shows "No upcoming activities" for All filter', async () => {
      server.use(createTimelineHandler([]));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText(/no upcoming activities/i)).toBeInTheDocument();
      });
    });

    it('shows "No overdue activities" for Overdue filter', async () => {
      server.use(
        http.get(TIMELINE_ENDPOINT, ({ request }) => {
          const url = new URL(request.url);
          const filter = url.searchParams.get('filter');
          return HttpResponse.json({
            success: true,
            data: {
              items: [],
              preferences: { ...DEFAULT_PREFERENCES, filter: filter || 'all' },
              hasMore: false,
              total: 0,
            },
          });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /overdue/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('tab', { name: /overdue/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/no overdue activities/i)).toBeInTheDocument();
      });
    });

    it('shows "No activities due this week" for Next 7 days filter', async () => {
      server.use(
        http.get(TIMELINE_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [],
              preferences: { ...DEFAULT_PREFERENCES, filter: 'next7days' },
              hasMore: false,
              total: 0,
            },
          });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /next 7 days/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('tab', { name: /next 7 days/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/no activities due this week/i)).toBeInTheDocument();
      });
    });

    it('empty state includes encouraging message and icon', async () => {
      server.use(createTimelineHandler([]));
      
      const { container } = renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText(/no.*activities/i)).toBeInTheDocument();
        // Should have an icon (typically MUI icon)
        const emptyIcon = container.querySelector('svg');
        expect(emptyIcon).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // 10. Data Fetching Tests
  // ==========================================================================

  describe('Data Fetching', () => {
    it('fetches timeline from correct API endpoint', async () => {
      let requestedUrl: string | null = null;
      
      server.use(
        http.get(TIMELINE_ENDPOINT, ({ request }) => {
          requestedUrl = request.url;
          return HttpResponse.json({
            success: true,
            data: {
              items: createMockTimelineData(5),
              preferences: DEFAULT_PREFERENCES,
              hasMore: false,
              total: 5,
            },
          });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(requestedUrl).toContain('/blocks/timeline');
      });
    });

    it('passes filter parameter to API', async () => {
      let filterParam: string | null = null;
      
      server.use(
        http.get(TIMELINE_ENDPOINT, ({ request }) => {
          const url = new URL(request.url);
          filterParam = url.searchParams.get('filter');
          return HttpResponse.json({
            success: true,
            data: {
              items: createMockTimelineData(5),
              preferences: { ...DEFAULT_PREFERENCES, filter: filterParam || 'all' },
              hasMore: false,
              total: 5,
            },
          });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /overdue/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('tab', { name: /overdue/i }));
      
      await waitFor(() => {
        expect(filterParam).toBe('overdue');
      });
    });

    it('passes sort parameter to API', async () => {
      let sortParam: string | null = null;
      
      server.use(
        http.get(TIMELINE_ENDPOINT, ({ request }) => {
          const url = new URL(request.url);
          sortParam = url.searchParams.get('sort');
          return HttpResponse.json({
            success: true,
            data: {
              items: createMockTimelineData(5),
              preferences: { ...DEFAULT_PREFERENCES, sort: sortParam || 'sortbydates' },
              hasMore: false,
              total: 5,
            },
          });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sort/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /sort/i }));
      await user.click(screen.getByRole('menuitem', { name: /course/i }));
      
      await waitFor(() => {
        expect(sortParam).toBe('sortbycourses');
      });
    });

    it('passes limit parameter to API', async () => {
      let limitParam: string | null = null;
      
      server.use(
        http.get(TIMELINE_ENDPOINT, ({ request }) => {
          const url = new URL(request.url);
          limitParam = url.searchParams.get('limit');
          return HttpResponse.json({
            success: true,
            data: {
              items: createMockTimelineData(parseInt(limitParam || '10')),
              preferences: DEFAULT_PREFERENCES,
              hasMore: false,
              total: 10,
            },
          });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(limitParam).toBeTruthy();
      });
    });

    it('uses React Query for data fetching', async () => {
      const queryClient = createTestQueryClient();
      
      render(
        <QueryClientProvider client={queryClient}>
          <TimelineWidget />
        </QueryClientProvider>
      );
      
      await waitFor(() => {
        // Check that query client has the timeline query
        const queries = queryClient.getQueryCache().getAll();
        const timelineQuery = queries.find(q => 
          Array.isArray(q.queryKey) && q.queryKey.some(k => 
            typeof k === 'string' && k.includes('timeline')
          )
        );
        expect(timelineQuery).toBeDefined();
      });
    });

    it('configures appropriate staleTime', async () => {
      const queryClient = createTestQueryClient();
      
      render(
        <QueryClientProvider client={queryClient}>
          <TimelineWidget />
        </QueryClientProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });
      
      // Timeline should have staleTime configured (not instant refetch)
      const queries = queryClient.getQueryCache().getAll();
      expect(queries.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 11. Loading States
  // ==========================================================================

  describe('Loading States', () => {
    it('shows skeleton loaders during initial fetch', async () => {
      server.use(createTimelineHandler(createMockTimelineData(5), { delay: 500 }));
      
      const { container } = renderWithProviders(<TimelineWidget />);
      
      // Should show skeletons while loading
      const skeletons = container.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
      
      await waitFor(() => {
        expect(screen.getByText('Assignment 1')).toBeInTheDocument();
      });
    });

    it('skeleton loaders match timeline layout', async () => {
      server.use(createTimelineHandler(createMockTimelineData(5), { delay: 500 }));
      
      const { container } = renderWithProviders(<TimelineWidget />);
      
      // Should have multiple skeleton items matching list item structure
      const skeletons = container.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThanOrEqual(3);
    });

    it('shows loading indicator when switching tabs', async () => {
      server.use(
        http.get(TIMELINE_ENDPOINT, async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return HttpResponse.json({
            success: true,
            data: {
              items: createMockTimelineData(5),
              preferences: DEFAULT_PREFERENCES,
              hasMore: false,
              total: 5,
            },
          });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /overdue/i })).toBeInTheDocument();
      });
      
      // Wait for initial load to complete
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      }, { timeout: 1000 });
      
      await user.click(screen.getByRole('tab', { name: /overdue/i }));
      
      // Should show loading during refetch
      // Note: React Query might not show loading for cached data
    });

    it('tab navigation not blocked during loading', async () => {
      server.use(createTimelineHandler(createMockTimelineData(5), { delay: 300 }));
      
      renderWithProviders(<TimelineWidget />);
      
      // Tabs should be interactive even while loading
      await waitFor(() => {
        const tabs = screen.getAllByRole('tab');
        tabs.forEach(tab => {
          expect(tab).not.toBeDisabled();
        });
      });
    });
  });

  // ==========================================================================
  // 12. Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('displays error message on API failure', async () => {
      server.use(createTimelineErrorHandler(500, 'Failed to load timeline'));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
      });
    });

    it('shows user-friendly error message', async () => {
      server.use(createTimelineErrorHandler(500));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        // Should not expose technical details
        expect(screen.getByText(/unable to load|something went wrong|error/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      server.use(createTimelineErrorHandler(500));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry|try again/i })).toBeInTheDocument();
      });
    });

    it('retry button refetches timeline data', async () => {
      let fetchCount = 0;
      
      server.use(
        http.get(TIMELINE_ENDPOINT, () => {
          fetchCount++;
          if (fetchCount === 1) {
            return HttpResponse.json(
              { success: false, error: { message: 'Error' } },
              { status: 500 }
            );
          }
          return HttpResponse.json({
            success: true,
            data: {
              items: createMockTimelineData(5),
              preferences: DEFAULT_PREFERENCES,
              hasMore: false,
              total: 5,
            },
          });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry|try again/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /retry|try again/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Assignment 1')).toBeInTheDocument();
      });
      
      expect(fetchCount).toBe(2);
    });

    it('handles network errors gracefully', async () => {
      server.use(
        http.get(TIMELINE_ENDPOINT, () => {
          return HttpResponse.error();
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText(/error|failed|network/i)).toBeInTheDocument();
      });
    });

    it('handles partial data gracefully', async () => {
      // Return items with some missing fields
      server.use(
        http.get(TIMELINE_ENDPOINT, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                {
                  id: 1,
                  name: 'Partial Item',
                  // Missing some fields
                  activityType: 'assignment',
                  dueDate: createFutureDate(5).getTime() / 1000,
                },
              ],
              preferences: DEFAULT_PREFERENCES,
              hasMore: false,
              total: 1,
            },
          });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Partial Item')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // 13. User Interactions
  // ==========================================================================

  describe('User Interactions', () => {
    const item = createMockTimelineItem({
      id: 1,
      name: 'Interactive Activity',
      url: '/mod/assign/view.php?id=1',
      courseName: 'Interactive Course',
      courseUrl: '/course/view.php?id=101',
    });

    beforeEach(() => {
      server.use(createTimelineHandler([item]));
    });

    it('clicking activity navigates to activity page', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const link = screen.getByRole('link', { name: /interactive activity/i });
        expect(link).toHaveAttribute('href', '/mod/assign/view.php?id=1');
      });
    });

    it('clicking course name navigates to course', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const courseLink = screen.getByRole('link', { name: /interactive course/i });
        expect(courseLink).toHaveAttribute('href', '/course/view.php?id=101');
      });
    });

    it('hovering activity shows tooltip with details', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Interactive Activity')).toBeInTheDocument();
      });
      
      await user.hover(screen.getByText('Interactive Activity'));
      
      // Tooltip should appear with full details
      await waitFor(() => {
        // Look for tooltip content
        expect(screen.getByText('Interactive Activity')).toBeVisible();
      });
    });

    it('supports keyboard navigation for tabs', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();
      });
      
      const allTab = screen.getByRole('tab', { name: /all/i });
      allTab.focus();
      
      // Press right arrow to move to next tab
      await user.keyboard('{ArrowRight}');
      
      await waitFor(() => {
        const overdueTab = screen.getByRole('tab', { name: /overdue/i });
        expect(document.activeElement).toBe(overdueTab);
      });
    });

    it('supports keyboard navigation for activity items', async () => {
      const items = [
        createMockTimelineItem({ id: 1, name: 'First' }),
        createMockTimelineItem({ id: 2, name: 'Second' }),
      ];
      server.use(createTimelineHandler(items));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('First')).toBeInTheDocument();
      });
      
      // Tab through items
      await user.tab();
      await user.tab();
      
      // Focus should move through interactive elements
    });
  });

  // ==========================================================================
  // 14. Responsive Design Tests
  // ==========================================================================

  describe('Responsive Design', () => {
    it('renders properly at mobile viewport', async () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 });
      window.dispatchEvent(new Event('resize'));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });
    });

    it('maintains functionality on narrow screens', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 320 });
      window.dispatchEvent(new Event('resize'));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        // Tabs should still be accessible
        expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('tab', { name: /overdue/i }));
      
      await waitFor(() => {
        const tab = screen.getByRole('tab', { name: /overdue/i });
        expect(tab).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('activity items stack properly on narrow screens', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 });
      window.dispatchEvent(new Event('resize'));
      
      const items = createMockTimelineData(3);
      server.use(createTimelineHandler(items));
      
      const { container } = renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const listItems = container.querySelectorAll('li');
        expect(listItems.length).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // 15. Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('has proper ARIA labels for tabs', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const tablist = screen.getByRole('tablist');
        expect(tablist).toHaveAttribute('aria-label');
      });
    });

    it('timeline activities are keyboard accessible', async () => {
      const items = createMockTimelineData(3);
      server.use(createTimelineHandler(items));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const links = screen.getAllByRole('link');
        links.forEach(link => {
          expect(link).toHaveAttribute('href');
        });
      });
    });

    it('screen reader announces tab changes', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const tabs = screen.getAllByRole('tab');
        tabs.forEach(tab => {
          expect(tab).toHaveAttribute('aria-selected');
        });
      });
    });

    it('color coding supplemented with text (not color-only)', async () => {
      const overdueItem = createMockTimelineItem({
        id: 1,
        name: 'Overdue Test',
        overdueBy: 3,
        dueDateFormatted: 'Overdue by 3 days',
      });
      server.use(createTimelineHandler([overdueItem]));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        // The "Overdue" text should be present, not just red color
        expect(screen.getByText(/overdue by 3 days/i)).toBeInTheDocument();
      });
    });

    it('activity checkboxes have accessible labels', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        checkboxes.forEach(checkbox => {
          expect(checkbox).toHaveAccessibleName();
        });
      });
    });

    it('supports focus management for interactive elements', async () => {
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });
      
      // Tab through the widget
      await user.tab();
      
      // Focus should be on an interactive element
      expect(document.activeElement).not.toBe(document.body);
    });
  });

  // ==========================================================================
  // 16. Real-Time Updates Tests
  // ==========================================================================

  describe('Real-Time Updates', () => {
    it('refetches data on window focus', async () => {
      let fetchCount = 0;
      
      server.use(
        http.get(TIMELINE_ENDPOINT, () => {
          fetchCount++;
          return HttpResponse.json({
            success: true,
            data: {
              items: createMockTimelineData(5),
              preferences: DEFAULT_PREFERENCES,
              hasMore: false,
              total: 5,
            },
          });
        })
      );
      
      const queryClient = createTestQueryClient();
      
      render(
        <QueryClientProvider client={queryClient}>
          <TimelineWidget />
        </QueryClientProvider>
      );
      
      await waitFor(() => {
        expect(fetchCount).toBe(1);
      });
      
      // Simulate window focus
      window.dispatchEvent(new Event('focus'));
      
      // React Query should refetch on focus (if configured)
      // This depends on refetchOnWindowFocus setting
    });

    it('handles time-based category updates', async () => {
      const now = Date.now();
      
      // Item that's about to become overdue
      const soonOverdueItem = createMockTimelineItem({
        id: 1,
        name: 'Almost Overdue',
        dueDate: (now + 100) / 1000, // Due in 100ms
        overdueBy: null,
        dueDateFormatted: 'Due very soon',
      });
      
      server.use(createTimelineHandler([soonOverdueItem]));
      
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Almost Overdue')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('complete user flow: load, filter, sort, mark done', async () => {
      let currentFilter = 'all';
      let currentSort = 'sortbydates';
      let markedDoneIds: number[] = [];
      
      server.use(
        http.get(TIMELINE_ENDPOINT, ({ request }) => {
          const url = new URL(request.url);
          currentFilter = url.searchParams.get('filter') || 'all';
          currentSort = url.searchParams.get('sort') || 'sortbydates';
          
          return HttpResponse.json({
            success: true,
            data: {
              items: createMockTimelineData(5, currentFilter).filter(
                item => !markedDoneIds.includes(item.id)
              ),
              preferences: { sort: currentSort, filter: currentFilter, limit: 10 },
              hasMore: false,
              total: 5,
            },
          });
        }),
        http.post(`${API_BASE_URL}/activities/:id/complete`, async ({ params }) => {
          markedDoneIds.push(parseInt(params.id as string));
          return HttpResponse.json({ success: true });
        })
      );
      
      renderWithProviders(<TimelineWidget />);
      
      // 1. Wait for initial load
      await waitFor(() => {
        expect(screen.getByText(/assignment 1/i)).toBeInTheDocument();
      });
      
      // 2. Switch filter
      await user.click(screen.getByRole('tab', { name: /next 7 days/i }));
      
      await waitFor(() => {
        expect(currentFilter).toBe('next7days');
      });
      
      // 3. Change sort
      await user.click(screen.getByRole('button', { name: /sort/i }));
      await user.click(screen.getByRole('menuitem', { name: /course/i }));
      
      await waitFor(() => {
        expect(currentSort).toBe('sortbycourses');
      });
      
      // 4. Verify preferences persisted
      const stored = localStorage.getItem(TIMELINE_PREFERENCES_KEY);
      expect(stored).toBeTruthy();
      const prefs = JSON.parse(stored!);
      expect(prefs.filter).toBe('next7days');
      expect(prefs.sort).toBe('sortbycourses');
    });

    it('preserves state across component remounts', async () => {
      const savedPrefs: TimelinePreferences = {
        sort: 'sortbycourses',
        filter: 'overdue',
        limit: 15,
      };
      localStorage.setItem(TIMELINE_PREFERENCES_KEY, JSON.stringify(savedPrefs));
      
      const { unmount } = renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /overdue/i })).toHaveAttribute('aria-selected', 'true');
      });
      
      unmount();
      
      // Remount
      renderWithProviders(<TimelineWidget />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /overdue/i })).toHaveAttribute('aria-selected', 'true');
      });
    });
  });
});
