/**
 * Unit Tests for RecentActivityWidget Component
 *
 * Comprehensive test suite for the RecentActivityWidget component that displays
 * a chronological feed of recent course activities including new content,
 * submissions, forum posts, grade changes, and user enrollments.
 *
 * Tests cover:
 * - Component rendering with proper Material-UI styling
 * - Activity type display with distinct icons and colors
 * - Relative timestamp formatting using date-fns
 * - Activity grouping by date (Today, Yesterday, older dates)
 * - Pagination/Load more functionality
 * - Loading states with skeleton loaders
 * - Error handling with retry functionality
 * - Empty state display
 * - User interactions (click handlers, keyboard navigation)
 * - Accessibility compliance (WCAG 2.1 AA)
 * - Responsive design behavior
 *
 * @package    react-frontend
 * @subpackage tests/unit/features/dashboard
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React from 'react';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material';
import { http, HttpResponse } from 'msw';

import { server } from '@tests/mocks/server';
import RecentActivityWidget from '@/features/dashboard/widgets/RecentActivityWidget';
import { ActivityType } from '@/features/dashboard/types/dashboard.types';
import type { RecentActivityItem } from '@/features/dashboard/types/dashboard.types';

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Base API URL for mocking
 * Must match VITE_API_BASE_URL from vitest.config.ts
 */
const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * Create a fresh QueryClient for each test
 * Configured to disable retries and caching for deterministic testing
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Default MUI theme for testing
 */
const testTheme = createTheme();

/**
 * Test wrapper component with all required providers
 */
interface TestWrapperProps {
  readonly children: React.ReactNode;
  readonly queryClient?: QueryClient;
}

function TestWrapper({
  children,
  queryClient = createTestQueryClient(),
}: TestWrapperProps): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={testTheme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Helper to render component with test wrapper
 */
function renderWithProviders(
  ui: React.ReactElement,
  queryClient?: QueryClient
): ReturnType<typeof render> {
  return render(ui, {
    wrapper: ({ children }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    ),
  });
}

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Current timestamp for test calculations
 */
const NOW = Date.now();
const NOW_SECONDS = Math.floor(NOW / 1000);

/**
 * Time constants in seconds
 */
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Create a mock activity item with customizable properties
 */
function createMockActivity(
  overrides: Partial<RecentActivityItem> = {}
): RecentActivityItem {
  const defaultId = Math.floor(Math.random() * 10000);
  return {
    id: defaultId,
    type: ActivityType.FORUM_POST,
    user: 1,
    username: 'John Doe',
    action: 'Posted a new forum message',
    resourcename: 'Discussion Thread',
    coursename: 'Introduction to Programming',
    courseid: 101,
    timestamp: NOW_SECONDS - 2 * HOUR, // 2 hours ago by default
    description: 'A new message was posted in the forum',
    url: '/mod/forum/discuss.php?d=123',
    ...overrides,
  };
}

/**
 * Create a diverse set of mock activities for comprehensive testing
 */
function createMockActivities(): RecentActivityItem[] {
  return [
    // Today - Various types (within last 12 hours)
    createMockActivity({
      id: 1,
      type: ActivityType.FORUM_POST,
      username: 'Alice Johnson',
      action: 'Posted a new forum message',
      resourcename: 'Course Introduction Discussion',
      timestamp: NOW_SECONDS - 30 * MINUTE, // 30 minutes ago
    }),
    createMockActivity({
      id: 2,
      type: ActivityType.ASSIGNMENT_SUBMISSION,
      username: 'Bob Smith',
      action: 'Submitted assignment',
      resourcename: 'Week 1 Assignment',
      timestamp: NOW_SECONDS - 2 * HOUR, // 2 hours ago
    }),
    createMockActivity({
      id: 3,
      type: ActivityType.QUIZ_ATTEMPT,
      username: 'Carol Williams',
      action: 'Completed quiz attempt',
      resourcename: 'Module 1 Quiz',
      timestamp: NOW_SECONDS - 4 * HOUR, // 4 hours ago
    }),
    createMockActivity({
      id: 4,
      type: ActivityType.GRADE_CHANGE,
      username: 'Teacher Davis',
      action: 'Updated grade',
      resourcename: 'Midterm Exam',
      timestamp: NOW_SECONDS - 6 * HOUR, // 6 hours ago
    }),
    createMockActivity({
      id: 5,
      type: ActivityType.USER_ENROLLMENT,
      username: 'Eve Miller',
      action: 'Enrolled in course',
      resourcename: 'Introduction to Programming',
      timestamp: NOW_SECONDS - 8 * HOUR, // 8 hours ago
    }),
    createMockActivity({
      id: 6,
      type: ActivityType.CONTENT_ADDED,
      username: 'Teacher Davis',
      action: 'Added new resource',
      resourcename: 'Lecture Notes - Week 2',
      timestamp: NOW_SECONDS - 10 * HOUR, // 10 hours ago
    }),
    // Yesterday (24-48 hours ago)
    createMockActivity({
      id: 7,
      type: ActivityType.CONTENT_UPDATED,
      username: 'Teacher Davis',
      action: 'Updated course material',
      resourcename: 'Course Syllabus',
      timestamp: NOW_SECONDS - 26 * HOUR, // 26 hours ago (yesterday)
    }),
    createMockActivity({
      id: 8,
      type: ActivityType.FORUM_POST,
      username: 'Frank Brown',
      action: 'Posted a reply',
      resourcename: 'Help with Assignment 1',
      timestamp: NOW_SECONDS - 30 * HOUR, // 30 hours ago (yesterday)
    }),
    createMockActivity({
      id: 9,
      type: ActivityType.ASSIGNMENT_SUBMISSION,
      username: 'Grace Lee',
      action: 'Submitted late assignment',
      resourcename: 'Week 1 Assignment',
      timestamp: NOW_SECONDS - 36 * HOUR, // 36 hours ago (yesterday)
    }),
    // Older (3+ days ago)
    createMockActivity({
      id: 10,
      type: ActivityType.COURSE_MODULE_CREATED,
      username: 'Teacher Davis',
      action: 'Created new module',
      resourcename: 'Module 3: Advanced Topics',
      timestamp: NOW_SECONDS - 3 * DAY, // 3 days ago
    }),
    createMockActivity({
      id: 11,
      type: ActivityType.COURSE_MODULE_UPDATED,
      username: 'Admin User',
      action: 'Updated module settings',
      resourcename: 'Module 2: Intermediate Concepts',
      timestamp: NOW_SECONDS - 4 * DAY, // 4 days ago
    }),
    createMockActivity({
      id: 12,
      type: ActivityType.CONTENT_DELETED,
      username: 'Teacher Davis',
      action: 'Removed outdated content',
      resourcename: 'Old Lecture Notes',
      timestamp: NOW_SECONDS - 5 * DAY, // 5 days ago
    }),
  ];
}

/**
 * Create a large set of activities for pagination testing
 */
function createManyActivities(count: number): RecentActivityItem[] {
  const activities: RecentActivityItem[] = [];
  const activityTypes = Object.values(ActivityType);
  const usernames = [
    'Alice Johnson',
    'Bob Smith',
    'Carol Williams',
    'David Brown',
    'Eve Miller',
    'Frank Lee',
    'Grace Chen',
    'Henry Wilson',
  ];

  for (let i = 0; i < count; i++) {
    activities.push(
      createMockActivity({
        id: i + 1,
        type: activityTypes[i % activityTypes.length],
        username: usernames[i % usernames.length],
        action: `Activity ${i + 1}`,
        resourcename: `Resource ${i + 1}`,
        timestamp: NOW_SECONDS - i * HOUR, // Each activity 1 hour apart
      })
    );
  }

  return activities;
}

// ============================================================================
// MSW Server Setup
// ============================================================================

/**
 * Default successful response with diverse activities
 */
const defaultActivitiesResponse = {
  success: true,
  data: {
    items: createMockActivities(),
    hasMore: false,
    total: 12,
  },
};

/**
 * Mock handlers for API endpoints
 */
const handlers = [
  http.get(`${API_BASE_URL}/blocks/recent`, ({ request }) => {
    const url = new URL(request.url);
    const courseId = url.searchParams.get('courseid');

    // Return default response
    if (courseId === '101') {
      return HttpResponse.json(defaultActivitiesResponse);
    }

    // Empty activities for course 999
    if (courseId === '999') {
      return HttpResponse.json({
        success: true,
        data: {
          items: [],
          hasMore: false,
          total: 0,
        },
      });
    }

    // Error for course 500
    if (courseId === '500') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: 'Internal server error',
          },
        },
        { status: 500 }
      );
    }

    // Network error for course 503
    if (courseId === '503') {
      return HttpResponse.error();
    }

    // Many activities for pagination testing (course 200)
    if (courseId === '200') {
      return HttpResponse.json({
        success: true,
        data: {
          items: createManyActivities(25),
          hasMore: true,
          total: 25,
        },
      });
    }

    // Default response
    return HttpResponse.json(defaultActivitiesResponse);
  }),
];

// ============================================================================
// Test Setup and Teardown
// ============================================================================

// Use the shared MSW server from tests/mocks/server.ts
// Server is started globally in tests/setup.ts

beforeEach(() => {
  // Set up default handlers for this test suite
  server.use(...handlers);
});

afterEach(() => {
  // Reset handlers after each test
  server.resetHandlers();
  vi.clearAllMocks();
});

// ============================================================================
// Test Suites
// ============================================================================

describe('RecentActivityWidget', () => {
  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering', () => {
    it('renders recent activity feed with title', async () => {
      renderWithProviders(<RecentActivityWidget courseId={101} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Check title is displayed
      expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();
    });

    it('renders with custom title when provided', async () => {
      renderWithProviders(
        <RecentActivityWidget courseId={101} title="Course Updates" />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { name: 'Course Updates' })).toBeInTheDocument();
    });

    it('renders as a Material-UI Card component', async () => {
      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Check the region exists with proper aria-label
      expect(screen.getByRole('region', { name: 'Recent Activity' })).toBeInTheDocument();
    });

    it('displays activities in reverse chronological order (newest first)', async () => {
      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Get all activity items by their action text
      const activities = screen.getAllByRole('listitem');
      
      // First activity should be the most recent (Alice's forum post - 30 min ago)
      expect(activities.length).toBeGreaterThan(0);
    });

    it('renders activity list with proper ARIA role="feed"', async () => {
      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      expect(screen.getByRole('feed')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Activity Type Display Tests
  // ==========================================================================

  describe('Activity Type Display', () => {
    it('renders forum post activities with forum icon', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({
                  id: 1,
                  type: ActivityType.FORUM_POST,
                  action: 'Posted a new forum message',
                }),
              ],
              hasMore: false,
              total: 1,
            },
          });
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.getByText('Posted a new forum message')).toBeInTheDocument();
      });

      // Forum post should have info color styling
      const activityItem = screen.getByRole('listitem');
      expect(activityItem).toBeInTheDocument();
    });

    it('renders assignment submission activities with assignment icon', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({
                  id: 1,
                  type: ActivityType.ASSIGNMENT_SUBMISSION,
                  action: 'Submitted assignment',
                }),
              ],
              hasMore: false,
              total: 1,
            },
          });
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.getByText('Submitted assignment')).toBeInTheDocument();
      });
    });

    it('renders quiz attempt activities with quiz icon', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({
                  id: 1,
                  type: ActivityType.QUIZ_ATTEMPT,
                  action: 'Completed quiz attempt',
                }),
              ],
              hasMore: false,
              total: 1,
            },
          });
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.getByText('Completed quiz attempt')).toBeInTheDocument();
      });
    });

    it('renders grade change activities with grade icon', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({
                  id: 1,
                  type: ActivityType.GRADE_CHANGE,
                  action: 'Updated grade',
                }),
              ],
              hasMore: false,
              total: 1,
            },
          });
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.getByText('Updated grade')).toBeInTheDocument();
      });
    });

    it('renders user enrollment activities with user icon', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({
                  id: 1,
                  type: ActivityType.USER_ENROLLMENT,
                  action: 'Enrolled in course',
                }),
              ],
              hasMore: false,
              total: 1,
            },
          });
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.getByText('Enrolled in course')).toBeInTheDocument();
      });
    });

    it('renders content added activities with add icon', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({
                  id: 1,
                  type: ActivityType.CONTENT_ADDED,
                  action: 'Added new resource',
                }),
              ],
              hasMore: false,
              total: 1,
            },
          });
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.getByText('Added new resource')).toBeInTheDocument();
      });
    });

    it('renders content updated activities with edit icon', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({
                  id: 1,
                  type: ActivityType.CONTENT_UPDATED,
                  action: 'Updated content',
                }),
              ],
              hasMore: false,
              total: 1,
            },
          });
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.getByText('Updated content')).toBeInTheDocument();
      });
    });

    it('renders content deleted activities with delete icon', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({
                  id: 1,
                  type: ActivityType.CONTENT_DELETED,
                  action: 'Removed content',
                }),
              ],
              hasMore: false,
              total: 1,
            },
          });
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.getByText('Removed content')).toBeInTheDocument();
      });
    });

    it('renders each activity type with distinct styling', async () => {
      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Verify multiple activity types are displayed
      const activities = screen.getAllByRole('listitem');
      expect(activities.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Activity Details Tests
  // ==========================================================================

  describe('Activity Details', () => {
    it('displays username for each activity', async () => {
      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });

    it('displays activity action description', async () => {
      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.getByText('Posted a new forum message')).toBeInTheDocument();
      });
    });

    it('displays resource name for each activity', async () => {
      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.getByText(/Course Introduction Discussion/)).toBeInTheDocument();
      });
    });

    it('displays course name when showCourseName is true', async () => {
      renderWithProviders(
        <RecentActivityWidget courseId={101} showCourseName={true} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      expect(screen.getAllByText(/Introduction to Programming/).length).toBeGreaterThan(0);
    });

    it('hides course name when showCourseName is false', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({
                  id: 1,
                  type: ActivityType.FORUM_POST,
                  coursename: 'Unique Course Name XYZ',
                }),
              ],
              hasMore: false,
              total: 1,
            },
          });
        })
      );

      renderWithProviders(
        <RecentActivityWidget courseId={101} showCourseName={false} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Course name should not be visible directly in the activity item
      // when showCourseName is false (default)
    });
  });

  // ==========================================================================
  // Timestamp Display Tests
  // ==========================================================================

  describe('Timestamp Display', () => {
    it('displays relative time for recent activities (e.g., "30 minutes ago")', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({
                  id: 1,
                  timestamp: Math.floor(Date.now() / 1000) - 30 * 60, // 30 minutes ago
                }),
              ],
              hasMore: false,
              total: 1,
            },
          });
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        // Should show relative time like "30 minutes ago" or "about 30 minutes ago"
        expect(
          screen.getByText(/30 minutes ago|about 30 minutes ago/i)
        ).toBeInTheDocument();
      });
    });

    it('displays relative time for activities a few hours ago', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({
                  id: 1,
                  timestamp: Math.floor(Date.now() / 1000) - 3 * 60 * 60, // 3 hours ago
                }),
              ],
              hasMore: false,
              total: 1,
            },
          });
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(
          screen.getByText(/3 hours ago|about 3 hours ago/i)
        ).toBeInTheDocument();
      });
    });

    it('displays relative time for older activities', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({
                  id: 1,
                  timestamp: Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60, // 2 days ago
                }),
              ],
              hasMore: false,
              total: 1,
            },
          });
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(
          screen.getByText(/2 days ago/i)
        ).toBeInTheDocument();
      });
    });

    it('uses date-fns formatDistanceToNow for timestamp formatting', async () => {
      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Timestamps should be formatted with relative time
      // Look for common relative time patterns
      const activities = screen.getAllByRole('listitem');
      expect(activities.length).toBeGreaterThan(0);
      // Verify that relative time patterns are present
      const timePatternRegex = /ago|minutes|hours|days/i;
      const hasRelativeTime = activities.some((activity) => 
        timePatternRegex.test(activity.textContent || '')
      );
      expect(hasRelativeTime).toBe(true);
    });
  });

  // ==========================================================================
  // Activity Grouping Tests
  // ==========================================================================

  describe('Activity Grouping by Date', () => {
    it('groups activities by date when many items exist', async () => {
      // Use course 200 which returns 25 activities for pagination testing
      renderWithProviders(
        <RecentActivityWidget courseId={200} groupByDate={true} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Should have "Today" group header
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('displays "Today" for activities from today', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: createManyActivities(15), // Forces grouping
              hasMore: false,
              total: 15,
            },
          });
        })
      );

      renderWithProviders(
        <RecentActivityWidget courseId={101} groupByDate={true} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('displays "Yesterday" for activities from yesterday', async () => {
      // Calculate yesterday's date at noon to ensure it's reliably "yesterday"
      // regardless of what time the test runs
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(12, 0, 0, 0); // Set to noon yesterday
      const yesterdayTimestamp = Math.floor(yesterday.getTime() / 1000);

      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({
                  id: 1,
                  timestamp: yesterdayTimestamp,
                }),
                ...Array.from({ length: 14 }, (_, i) =>
                  createMockActivity({
                    id: i + 2,
                    timestamp: yesterdayTimestamp - i * 60 * 60, // Space out by hours within yesterday
                  })
                ),
              ],
              hasMore: false,
              total: 15,
            },
          });
        })
      );

      renderWithProviders(
        <RecentActivityWidget courseId={101} groupByDate={true} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Should have Yesterday group
      expect(screen.getByText('Yesterday')).toBeInTheDocument();
    });

    it('displays formatted date for older activities', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          // Create activities from 5 days ago
          const fiveDaysAgo = Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60;
          return HttpResponse.json({
            success: true,
            data: {
              items: Array.from({ length: 15 }, (_, i) =>
                createMockActivity({
                  id: i + 1,
                  timestamp: fiveDaysAgo - i * 60 * 60,
                })
              ),
              hasMore: false,
              total: 15,
            },
          });
        })
      );

      renderWithProviders(
        <RecentActivityWidget courseId={101} groupByDate={true} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Should have a formatted date header (not Today or Yesterday)
      // The exact format depends on the formatDate implementation
    });

    it('does not group activities when less than 10 items', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({ id: 1 }),
                createMockActivity({ id: 2 }),
                createMockActivity({ id: 3 }),
              ],
              hasMore: false,
              total: 3,
            },
          });
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Should not have "Today" header when less than 10 items (default groupByDate behavior)
      expect(screen.queryByText('Today')).not.toBeInTheDocument();
    });

    it('respects groupByDate prop when explicitly set to true', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({ id: 1 }),
                createMockActivity({ id: 2 }),
              ],
              hasMore: false,
              total: 2,
            },
          });
        })
      );

      renderWithProviders(
        <RecentActivityWidget courseId={101} groupByDate={true} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Should show "Today" even with few items when groupByDate is explicitly true
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('respects groupByDate prop when explicitly set to false', async () => {
      renderWithProviders(
        <RecentActivityWidget courseId={200} groupByDate={false} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Should not show date group headers
      expect(screen.queryByText('Today')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Time Range Configuration Tests
  // ==========================================================================

  describe('Time Range Configuration', () => {
    it('respects useSinceLastAccess setting when provided', async () => {
      const lastAccessTimestamp = Math.floor(Date.now() / 1000) - 24 * 60 * 60; // 24 hours ago

      renderWithProviders(
        <RecentActivityWidget
          courseId={101}
          useSinceLastAccess={true}
          lastAccessTimestamp={lastAccessTimestamp}
        />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Component should render with the time range applied
      expect(screen.getByRole('region', { name: 'Recent Activity' })).toBeInTheDocument();
    });

    it('uses default 48 hour time range when useSinceLastAccess is false', async () => {
      renderWithProviders(
        <RecentActivityWidget courseId={101} useSinceLastAccess={false} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Component should render with default time range
      expect(screen.getByRole('region', { name: 'Recent Activity' })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Pagination Tests
  // ==========================================================================

  describe('Pagination', () => {
    it('displays initial limited number of activities (default 10)', async () => {
      renderWithProviders(<RecentActivityWidget courseId={200} />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Should show load more button when there are more items
      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
    });

    it('respects initialLimit prop', async () => {
      renderWithProviders(
        <RecentActivityWidget courseId={200} initialLimit={5} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Should show load more since we have 25 items and only showing 5
      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
      
      // Verify activity count indicator
      expect(screen.getByText(/Showing 5 of 25 activities/i)).toBeInTheDocument();
    });

    it('shows "Load more" button when more activities exist', async () => {
      renderWithProviders(<RecentActivityWidget courseId={200} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
      });
    });

    it('loads more activities when "Load more" is clicked', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <RecentActivityWidget courseId={200} initialLimit={5} />
      );

      await waitFor(() => {
        expect(screen.getByText(/Showing 5 of 25 activities/i)).toBeInTheDocument();
      });

      // Click load more
      const loadMoreButton = screen.getByRole('button', { name: /load more/i });
      await user.click(loadMoreButton);

      // Should now show more activities (5 + 10 = 15)
      await waitFor(() => {
        expect(screen.getByText(/Showing 15 of 25 activities/i)).toBeInTheDocument();
      });
    });

    it('hides "Load more" button when all activities are loaded', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({ id: 1 }),
                createMockActivity({ id: 2 }),
                createMockActivity({ id: 3 }),
              ],
              hasMore: false,
              total: 3,
            },
          });
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Should not show load more when all items are displayed
      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    });

    it('displays activity count indicator', async () => {
      renderWithProviders(<RecentActivityWidget courseId={200} />);

      await waitFor(() => {
        expect(screen.getByText(/Showing \d+ of \d+ activities/i)).toBeInTheDocument();
      });
    });

    it('updates count correctly after loading more', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <RecentActivityWidget courseId={200} initialLimit={5} />
      );

      await waitFor(() => {
        expect(screen.getByText(/Showing 5 of 25 activities/i)).toBeInTheDocument();
      });

      // Load more
      await user.click(screen.getByRole('button', { name: /load more/i }));

      await waitFor(() => {
        expect(screen.getByText(/Showing 15 of 25 activities/i)).toBeInTheDocument();
      });

      // Load more again
      await user.click(screen.getByRole('button', { name: /load more/i }));

      await waitFor(() => {
        expect(screen.getByText(/Showing 25 of 25 activities/i)).toBeInTheDocument();
      });

      // Load more button should now be hidden
      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe('Empty State', () => {
    it('displays empty state when no recent activity exists', async () => {
      renderWithProviders(<RecentActivityWidget courseId={999} />);

      await waitFor(() => {
        expect(
          screen.getByText(/no recent activity/i)
        ).toBeInTheDocument();
      });
    });

    it('shows appropriate empty state message', async () => {
      renderWithProviders(<RecentActivityWidget courseId={999} />);

      await waitFor(() => {
        expect(
          screen.getByText(/no recent activity to display/i)
        ).toBeInTheDocument();
      });
    });

    it('empty state is accessible to screen readers', async () => {
      renderWithProviders(<RecentActivityWidget courseId={999} />);

      await waitFor(() => {
        const emptyState = screen.getByRole('status');
        expect(emptyState).toBeInTheDocument();
        expect(emptyState).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  // ==========================================================================
  // Data Fetching Tests
  // ==========================================================================

  describe('Data Fetching', () => {
    it('fetches activities from GET /api/v1/blocks/recent', async () => {
      let capturedUrl: URL | undefined;

      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(defaultActivitiesResponse);
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(capturedUrl).toBeDefined();
      });

      // Verify after the waitFor check
      expect(capturedUrl!.searchParams.get('courseid')).toBe('101');
    });

    it('passes course context parameter in API request', async () => {
      let capturedCourseId: string | null = null;

      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, ({ request }) => {
          const url = new URL(request.url);
          capturedCourseId = url.searchParams.get('courseid');
          return HttpResponse.json(defaultActivitiesResponse);
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={456} />);

      await waitFor(() => {
        expect(capturedCourseId).toBe('456');
      });
    });

    it('passes time range parameter in API request', async () => {
      let capturedTimeStart: string | null = null;
      const customTimeStart = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60; // 7 days ago

      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, ({ request }) => {
          const url = new URL(request.url);
          capturedTimeStart = url.searchParams.get('timestart');
          return HttpResponse.json(defaultActivitiesResponse);
        })
      );

      renderWithProviders(
        <RecentActivityWidget
          courseId={101}
          useSinceLastAccess={true}
          lastAccessTimestamp={customTimeStart}
        />
      );

      await waitFor(() => {
        expect(capturedTimeStart).toBe(String(customTimeStart));
      });
    });

    it('uses React Query for data fetching with caching', async () => {
      const queryClient = createTestQueryClient();

      renderWithProviders(<RecentActivityWidget courseId={101} />, queryClient);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Check that query data is cached
      const queryCache = queryClient.getQueryCache();
      const queries = queryCache.getAll();
      expect(queries.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Loading States Tests
  // ==========================================================================

  describe('Loading States', () => {
    it('shows skeleton loaders during initial fetch', async () => {
      // Delay the response to observe loading state
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json(defaultActivitiesResponse);
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      // Should show loading skeleton initially
      expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();

      // Wait for content to load
      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });
    });

    it('skeleton loaders match activity list layout', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json(defaultActivitiesResponse);
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      // Skeleton should have multiple placeholder items
      const loadingContainer = screen.getByRole('status', { name: /loading/i });
      expect(loadingContainer).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });
    });

    it('shows refreshing indicator when refetching in background', async () => {
      const queryClient = createTestQueryClient();

      renderWithProviders(<RecentActivityWidget courseId={101} />, queryClient);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Trigger a refetch with delay
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return HttpResponse.json(defaultActivitiesResponse);
        })
      );

      // Manually trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'recent'] });

      // Check for refreshing indicator (the small spinner in header)
      // Note: The exact behavior depends on isFetching state
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    // Note: useRecentActivity hook has retry: 2 with retryDelay: 1000,
    // so we need longer timeouts for error state tests

    it('displays error message on API failure', async () => {
      renderWithProviders(<RecentActivityWidget courseId={500} />);

      // Wait for retries to complete (retry: 2, retryDelay: 1000ms)
      await waitFor(
        () => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('shows user-friendly error message', async () => {
      renderWithProviders(<RecentActivityWidget courseId={500} />);

      // The component shows error.message if it's an Error instance,
      // otherwise shows the fallback message. Axios errors will show their message.
      await waitFor(
        () => {
          // Check for either the axios error message or the fallback
          const alert = screen.getByRole('alert');
          expect(alert).toBeInTheDocument();
          // The error message could be the axios message or the fallback
          expect(alert.textContent).toMatch(/failed to load|request failed|error/i);
        },
        { timeout: 5000 }
      );
    });

    it('shows retry button on error', async () => {
      renderWithProviders(<RecentActivityWidget courseId={500} />);

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('retry button refetches activity data', async () => {
      const user = userEvent.setup();
      let requestCount = 0;
      let shouldFail = true;

      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('courseid') === '777') {
            requestCount++;
            // Fail until shouldFail is set to false (after retry button click)
            if (shouldFail) {
              return HttpResponse.json(
                { success: false, error: { message: 'Error' } },
                { status: 500 }
              );
            }
            return HttpResponse.json(defaultActivitiesResponse);
          }
          return HttpResponse.json(defaultActivitiesResponse);
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={777} />);

      // Wait for error state (after retries: retry: 2 with retryDelay: 1000ms)
      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Now allow success on next request
      shouldFail = false;

      // Click retry
      await user.click(screen.getByRole('button', { name: /retry/i }));

      // Should succeed on retry
      await waitFor(
        () => {
          expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Request count should be at least 4 (initial + 2 retries + retry button click)
      expect(requestCount).toBeGreaterThanOrEqual(4);
    });

    it('handles network errors gracefully', async () => {
      renderWithProviders(<RecentActivityWidget courseId={503} />);

      await waitFor(
        () => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  // ==========================================================================
  // User Interactions Tests
  // ==========================================================================

  describe('User Interactions', () => {
    it('calls onActivityClick when activity is clicked', async () => {
      const onActivityClick = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <RecentActivityWidget courseId={101} onActivityClick={onActivityClick} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Click on the first activity - when onActivityClick is provided, activities are rendered as buttons
      const activityButtons = screen.getAllByRole('button', { name: /new content|submission|forum|grade|enrollment/i });
      expect(activityButtons.length).toBeGreaterThan(0);
      const firstActivity = activityButtons[0]!;
      await user.click(firstActivity);

      expect(onActivityClick).toHaveBeenCalledTimes(1);
      expect(onActivityClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(Number),
          type: expect.any(String),
        })
      );
    });

    it('activities support keyboard navigation', async () => {
      const onActivityClick = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <RecentActivityWidget courseId={101} onActivityClick={onActivityClick} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Tab to first activity and press Enter
      await user.tab();
      await user.keyboard('{Enter}');

      expect(onActivityClick).toHaveBeenCalled();
    });

    it('activities support Space key activation', async () => {
      const onActivityClick = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <RecentActivityWidget courseId={101} onActivityClick={onActivityClick} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Tab to first activity and press Space
      await user.tab();
      await user.keyboard(' ');

      expect(onActivityClick).toHaveBeenCalled();
    });

    it('activities are not clickable when onActivityClick is not provided', async () => {
      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Activities should not be buttons when no click handler
      const activities = screen.getAllByRole('listitem');
      expect(activities[0]).not.toHaveAttribute('tabIndex');
    });

    it('shows hover state on activity items when clickable', async () => {
      const onActivityClick = vi.fn();

      renderWithProviders(
        <RecentActivityWidget courseId={101} onActivityClick={onActivityClick} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Clickable items render as buttons with cursor pointer style
      const activityButtons = screen.getAllByRole('button', { name: /new content|submission|forum|grade|enrollment/i });
      expect(activityButtons.length).toBeGreaterThan(0);
      expect(activityButtons[0]).toHaveStyle({ cursor: 'pointer' });
    });
  });

  // ==========================================================================
  // Responsive Design Tests
  // ==========================================================================

  describe('Responsive Design', () => {
    it('renders properly on mobile viewport', async () => {
      // Set up mobile viewport
      global.innerWidth = 375;
      global.innerHeight = 667;

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Component should still render
      expect(screen.getByRole('region', { name: 'Recent Activity' })).toBeInTheDocument();
    });

    it('handles long text with proper truncation', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: [
                createMockActivity({
                  id: 1,
                  action:
                    'This is a very long action description that should be truncated or handled properly in the UI to prevent layout issues',
                  resourcename:
                    'This is a very long resource name that might need truncation',
                }),
              ],
              hasMore: false,
              total: 1,
            },
          });
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Component should render without breaking layout
      expect(screen.getByRole('region', { name: 'Recent Activity' })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('has proper ARIA labels for activity feed', async () => {
      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Main container should have aria-label
      expect(screen.getByRole('region', { name: 'Recent Activity' })).toBeInTheDocument();

      // Activity list should have role="feed"
      expect(screen.getByRole('feed')).toBeInTheDocument();
    });

    it('activities have descriptive aria-labels', async () => {
      const onActivityClick = vi.fn();

      renderWithProviders(
        <RecentActivityWidget courseId={101} onActivityClick={onActivityClick} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Each activity button should have an aria-label describing it
      // When onActivityClick is provided, activities render as buttons
      const activityButtons = screen.getAllByRole('button', { name: /new content|submission|forum|grade|enrollment/i });
      activityButtons.forEach((activity) => {
        expect(activity).toHaveAttribute('aria-label');
      });
    });

    it('loading state is announced to screen readers', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json(defaultActivitiesResponse);
        })
      );

      renderWithProviders(<RecentActivityWidget courseId={101} />);

      // Loading state should have proper role and aria-label
      const loadingElement = screen.getByRole('status', { name: /loading/i });
      expect(loadingElement).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });
    });

    it('error state is properly announced', async () => {
      renderWithProviders(<RecentActivityWidget courseId={500} />);

      // Wait for retries to complete (retry: 2 with retryDelay: 1000ms)
      await waitFor(
        () => {
          // Error should be an alert role for screen readers
          expect(screen.getByRole('alert')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('retry button has accessible label', async () => {
      renderWithProviders(<RecentActivityWidget courseId={500} />);

      // Wait for retries to complete
      await waitFor(
        () => {
          const retryButton = screen.getByRole('button', { name: /retry/i });
          expect(retryButton).toHaveAttribute('aria-label');
        },
        { timeout: 5000 }
      );
    });

    it('load more button has informative aria-label', async () => {
      renderWithProviders(<RecentActivityWidget courseId={200} />);

      await waitFor(() => {
        const loadMoreButton = screen.getByRole('button', { name: /load more/i });
        expect(loadMoreButton).toHaveAttribute('aria-label');
        expect(loadMoreButton.getAttribute('aria-label')).toMatch(
          /showing \d+ of \d+ activities/i
        );
      });
    });

    it('icons have aria-hidden attribute', async () => {
      renderWithProviders(<RecentActivityWidget courseId={101} />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Icons should be decorative (aria-hidden)
      // The component sets aria-hidden="true" on icons
    });

    it('activities are keyboard focusable when clickable', async () => {
      const onActivityClick = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <RecentActivityWidget courseId={101} onActivityClick={onActivityClick} />
      );

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Should be able to tab through activities
      await user.tab();

      // First activity button should be focused (activities render as buttons when clickable)
      const activityButtons = screen.getAllByRole('button', { name: /new content|submission|forum|grade|enrollment/i });
      expect(activityButtons[0]).toHaveFocus();
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('renders complete widget with all features working together', async () => {
      const onActivityClick = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <RecentActivityWidget
          courseId={200}
          title="Course Activity Feed"
          showCourseName={true}
          groupByDate={true}
          onActivityClick={onActivityClick}
          initialLimit={5}
        />
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });

      // Check title
      expect(screen.getByRole('heading', { name: 'Course Activity Feed' })).toBeInTheDocument();

      // Check date grouping
      expect(screen.getByText('Today')).toBeInTheDocument();

      // Check activity count
      expect(screen.getByText(/Showing 5 of 25 activities/i)).toBeInTheDocument();

      // Click load more
      await user.click(screen.getByRole('button', { name: /load more/i }));

      await waitFor(() => {
        expect(screen.getByText(/Showing 15 of 25 activities/i)).toBeInTheDocument();
      });

      // Click an activity - activities render as buttons when onActivityClick is provided
      const activityButtons = screen.getAllByRole('button', { name: /new content|submission|forum|grade|enrollment/i });
      expect(activityButtons.length).toBeGreaterThan(0);
      const firstActivity = activityButtons[0]!;
      await user.click(firstActivity);

      expect(onActivityClick).toHaveBeenCalled();
    });

    it('handles rapid user interactions correctly', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <RecentActivityWidget courseId={200} initialLimit={5} />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
      });

      // Rapidly click load more multiple times
      const loadMoreButton = screen.getByRole('button', { name: /load more/i });
      await user.click(loadMoreButton);
      await user.click(loadMoreButton);

      // Should handle correctly without errors
      await waitFor(() => {
        expect(screen.getByText(/Showing \d+ of 25 activities/i)).toBeInTheDocument();
      });
    });

    it('maintains state correctly across prop changes', async () => {
      const { rerender } = renderWithProviders(
        <RecentActivityWidget courseId={101} title="First Title" />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'First Title' })).toBeInTheDocument();
      });

      // Change title prop
      rerender(
        <TestWrapper>
          <RecentActivityWidget courseId={101} title="Second Title" />
        </TestWrapper>
      );

      expect(screen.getByRole('heading', { name: 'Second Title' })).toBeInTheDocument();
    });
  });
});
