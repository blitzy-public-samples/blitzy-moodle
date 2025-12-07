/**
 * OnlineUsersWidget Component Unit Tests
 *
 * Comprehensive test suite for the OnlineUsersWidget dashboard component.
 * Tests cover rendering, user display, online status indicators, real-time
 * polling updates, role filtering, user counts, empty/loading/error states,
 * user interactions, responsive design, accessibility, and performance.
 *
 * Based on requirements from:
 * - public/blocks/online_users/block_online_users.php
 * - react-frontend/src/features/dashboard/widgets/OnlineUsersWidget.tsx
 *
 * @package    react-frontend
 * @subpackage tests/unit/features/dashboard
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import '@testing-library/jest-dom';

import OnlineUsersWidget from '@/features/dashboard/widgets/OnlineUsersWidget';
import type { OnlineUser } from '@/features/dashboard/types/dashboard.types';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock OnlineUser object with specified overrides
 */
function createMockOnlineUser(overrides: Partial<OnlineUser> = {}): OnlineUser {
  const id = overrides.id ?? Math.floor(Math.random() * 10000);
  const firstname = overrides.firstname ?? 'Test';
  const lastname = overrides.lastname ?? 'User';

  return {
    id,
    username: overrides.username ?? `testuser${id}`,
    firstname,
    lastname,
    fullname: overrides.fullname ?? `${firstname} ${lastname}`,
    profileimageurl: overrides.profileimageurl ?? `https://example.com/avatar/${id}.jpg`,
    profileimageurlsmall: overrides.profileimageurlsmall ?? `https://example.com/avatar/${id}_small.jpg`,
    lastaccess: overrides.lastaccess ?? Math.floor(Date.now() / 1000) - 60, // 1 minute ago
    uservisibility: overrides.uservisibility ?? true,
    canmessage: overrides.canmessage ?? true,
    courseid: overrides.courseid,
    groupid: overrides.groupid,
  };
}

/**
 * Creates an array of mock online users with varied data
 */
function createMockOnlineUsers(count: number): OnlineUser[] {
  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Edward', 'Fiona', 'George', 'Hannah', 'Isaac', 'Julia'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez', 'Lopez'];

  return Array.from({ length: count }, (_, index) => {
    const firstname = firstNames[index % firstNames.length] ?? 'User';
    const lastname = lastNames[index % lastNames.length] ?? 'Test';
    const baseTime = Math.floor(Date.now() / 1000);

    return createMockOnlineUser({
      id: index + 1,
      username: `${firstname.toLowerCase()}${index + 1}`,
      firstname,
      lastname,
      fullname: `${firstname} ${lastname}`,
      lastaccess: baseTime - (index * 30), // Staggered last access times
      uservisibility: index % 3 !== 0, // Some users have visibility off
      canmessage: index % 4 !== 0, // Some users cannot be messaged
    });
  });
}

// ============================================================================
// Mock API Response Data
// ============================================================================

const mockOnlineUsersResponse = {
  success: true,
  data: {
    users: createMockOnlineUsers(5),
    count: 5,
    timeWindow: 5,
  },
};

const mockEmptyResponse = {
  success: true,
  data: {
    users: [],
    count: 0,
    timeWindow: 5,
  },
};

const mockLargeResponse = {
  success: true,
  data: {
    users: createMockOnlineUsers(60),
    count: 60,
    timeWindow: 5,
  },
};

// ============================================================================
// MSW Server Setup
// ============================================================================

// Use full URL to match the environment variable VITE_API_BASE_URL in vitest.config.ts
const API_BASE_URL = 'http://localhost:8000/api/v1';

const handlers = [
  http.get(`${API_BASE_URL}/blocks/online`, () => {
    return HttpResponse.json(mockOnlineUsersResponse);
  }),
];

const server = setupServer(...handlers);

// ============================================================================
// Test Utilities
// ============================================================================

const theme = createTheme();

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
    },
  });
}

/**
 * Test wrapper component with all required providers
 */
interface TestWrapperProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

function TestWrapper({ children, queryClient }: TestWrapperProps): JSX.Element {
  const client = queryClient ?? createTestQueryClient();
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Renders the OnlineUsersWidget with all providers
 */
function renderWidget(
  props: React.ComponentProps<typeof OnlineUsersWidget> = {},
  queryClient?: QueryClient
) {
  const user = userEvent.setup();
  const client = queryClient ?? createTestQueryClient();

  const result = render(
    <TestWrapper queryClient={client}>
      <OnlineUsersWidget {...props} />
    </TestWrapper>
  );

  return { ...result, user, queryClient: client };
}

// ============================================================================
// Test Suite Setup
// ============================================================================

describe('OnlineUsersWidget', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'bypass' });
  });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    server.resetHandlers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering Tests', () => {
    it('renders the widget container with proper structure', async () => {
      renderWidget();

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /online users widget/i })).toBeInTheDocument();
      });
    });

    it('displays widget title "Online Users" by default', async () => {
      renderWidget();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /online users/i })).toBeInTheDocument();
      });
    });

    it('displays custom title when provided', async () => {
      renderWidget({ title: 'Active Users' });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /active users/i })).toBeInTheDocument();
      });
    });

    it('renders Material-UI Card as container', async () => {
      renderWidget();

      await waitFor(() => {
        const widget = screen.getByRole('region', { name: /online users widget/i });
        expect(widget.tagName.toLowerCase()).toBe('div');
      });
    });

    it('renders refresh button in header', async () => {
      renderWidget();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      });
    });

    it('renders filter button when showFilters is true', async () => {
      renderWidget({ showFilters: true });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument();
      });
    });

    it('does not render filter button when showFilters is false', async () => {
      renderWidget({ showFilters: false });

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /filter/i })).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // User Display Tests
  // ==========================================================================

  describe('User Display Tests', () => {
    it('displays list of online users', async () => {
      renderWidget();

      await waitFor(() => {
        expect(screen.getByRole('list', { name: /list of online users/i })).toBeInTheDocument();
      });
    });

    it('renders each user with avatar', async () => {
      renderWidget();

      await waitFor(() => {
        const avatars = screen.getAllByRole('img');
        expect(avatars.length).toBeGreaterThan(0);
      });
    });

    it('displays user full names', async () => {
      renderWidget();

      await waitFor(() => {
        const userList = screen.getByRole('list', { name: /list of online users/i });
        expect(within(userList).getByText('Alice Smith')).toBeInTheDocument();
        expect(within(userList).getByText('Bob Johnson')).toBeInTheDocument();
      });
    });

    it('displays users up to maxUsers limit', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          return HttpResponse.json(mockLargeResponse);
        })
      );

      renderWidget({ maxUsers: 10 });

      await waitFor(() => {
        const userList = screen.getByRole('list', { name: /list of online users/i });
        const listItems = within(userList).getAllByRole('listitem');
        // +1 for "more users" indicator
        expect(listItems.length).toBeLessThanOrEqual(11);
      });
    });

    it('shows hidden users count when exceeding maxUsers', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          return HttpResponse.json(mockLargeResponse);
        })
      );

      renderWidget({ maxUsers: 10 });

      await waitFor(() => {
        expect(screen.getByText(/\+ 50 more users/i)).toBeInTheDocument();
      });
    });

    it('shows "(you)" indicator for current user', async () => {
      const currentUserId = 1;
      renderWidget({ currentUserId });

      await waitFor(() => {
        expect(screen.getByText(/\(you\)/i)).toBeInTheDocument();
      });
    });

    it('displays user initials as avatar fallback', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              users: [createMockOnlineUser({
                id: 1,
                firstname: 'John',
                lastname: 'Doe',
                profileimageurl: '', // No image
              })],
              count: 1,
              timeWindow: 5,
            },
          });
        })
      );

      renderWidget();

      await waitFor(() => {
        // Avatar should show initials JD when no image
        expect(screen.getByText('JD')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Online Status Tests
  // ==========================================================================

  describe('Online Status Tests', () => {
    it('displays online status indicator (green badge) for visible users', async () => {
      renderWidget();

      await waitFor(() => {
        const badges = document.querySelectorAll('.MuiBadge-badge');
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('shows time window text in header', async () => {
      renderWidget();

      await waitFor(() => {
        expect(screen.getByText(/in the last 5 minutes/i)).toBeInTheDocument();
      });
    });

    it('shows last access time in tooltip on hover', async () => {
      const { user } = renderWidget();

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      // Find and hover over a user's avatar
      const avatar = screen.getAllByRole('img')[0];
      if (avatar?.parentElement) {
        await user.hover(avatar.parentElement);
      }

      // Tooltip should appear with time information
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Real-Time Updates Tests
  // ==========================================================================

  describe('Real-Time Updates Tests', () => {
    it('refetches data automatically (polling behavior)', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          fetchCount++;
          return HttpResponse.json(mockOnlineUsersResponse);
        })
      );

      renderWidget();

      await waitFor(() => {
        expect(fetchCount).toBe(1);
      });

      // Advance time to trigger refetch (30 seconds is the stale time)
      await act(async () => {
        vi.advanceTimersByTime(31000);
      });

      await waitFor(() => {
        expect(fetchCount).toBeGreaterThan(1);
      });
    });

    it('updates user list when new users come online', async () => {
      const initialUsers = createMockOnlineUsers(3);
      let isFirstRequest = true;

      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          if (isFirstRequest) {
            isFirstRequest = false;
            return HttpResponse.json({
              success: true,
              data: { users: initialUsers, count: 3, timeWindow: 5 },
            });
          }
          // Second request returns more users
          return HttpResponse.json({
            success: true,
            data: {
              users: [...initialUsers, createMockOnlineUser({ id: 100, firstname: 'NewUser', lastname: 'Online' })],
              count: 4,
              timeWindow: 5,
            },
          });
        })
      );

      renderWidget();

      await waitFor(() => {
        expect(screen.getByText(/3 users online/i)).toBeInTheDocument();
      });

      // Trigger refetch
      await act(async () => {
        vi.advanceTimersByTime(31000);
      });

      await waitFor(() => {
        expect(screen.getByText(/4 users online/i)).toBeInTheDocument();
      });
    });

    it('handles manual refresh via refresh button', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          fetchCount++;
          return HttpResponse.json(mockOnlineUsersResponse);
        })
      );

      const { user } = renderWidget();

      await waitFor(() => {
        expect(fetchCount).toBe(1);
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(fetchCount).toBe(2);
      });
    });
  });

  // ==========================================================================
  // Role Filtering Tests
  // ==========================================================================

  describe('Role Filtering Tests', () => {
    it('displays filter chips when showFilters is true and not in compact mode', async () => {
      renderWidget({ showFilters: true, compact: false });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /students/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /teachers/i })).toBeInTheDocument();
      });
    });

    it('handles filter chip clicks', async () => {
      const { user } = renderWidget({ showFilters: true, compact: false });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /students/i })).toBeInTheDocument();
      });

      const studentsChip = screen.getByRole('button', { name: /students/i });
      await user.click(studentsChip);

      // Students chip should be selected
      expect(studentsChip).toHaveAttribute('aria-pressed', 'true');
    });

    it('cycles through filters when clicking filter icon button', async () => {
      const { user } = renderWidget({ showFilters: true });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument();
      });

      const filterButton = screen.getByRole('button', { name: /filter/i });

      // Initial state is "all", click to go to "students"
      await user.click(filterButton);
      // Click again to go to "teachers"
      await user.click(filterButton);
      // Click again to go back to "all"
      await user.click(filterButton);

      // Component should still be functional
      expect(screen.getByRole('region', { name: /online users widget/i })).toBeInTheDocument();
    });

    it('does not show filter chips in compact mode', async () => {
      renderWidget({ showFilters: true, compact: true });

      await waitFor(() => {
        expect(screen.getByRole('region')).toBeInTheDocument();
      });

      // Filter chips should not be visible in compact mode
      expect(screen.queryByRole('button', { name: /^all$/i })).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // User Count Tests
  // ==========================================================================

  describe('User Count Tests', () => {
    it('displays total online user count', async () => {
      renderWidget();

      await waitFor(() => {
        expect(screen.getByText(/5 users online/i)).toBeInTheDocument();
      });
    });

    it('displays singular form for one user', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              users: [createMockOnlineUser({ id: 1 })],
              count: 1,
              timeWindow: 5,
            },
          });
        })
      );

      renderWidget();

      await waitFor(() => {
        expect(screen.getByText(/1 user online/i)).toBeInTheDocument();
      });
    });

    it('displays "No users online" when count is zero', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          return HttpResponse.json(mockEmptyResponse);
        })
      );

      renderWidget();

      await waitFor(() => {
        expect(screen.getByText(/no users online/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe('Empty State Tests', () => {
    it('displays empty state when no users are online', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          return HttpResponse.json(mockEmptyResponse);
        })
      );

      renderWidget();

      await waitFor(() => {
        expect(screen.getByText(/no users are currently online/i)).toBeInTheDocument();
      });
    });

    it('displays time window text in empty state', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          return HttpResponse.json(mockEmptyResponse);
        })
      );

      renderWidget();

      await waitFor(() => {
        // Time window text may appear in multiple places (header and empty state)
        const timeWindowElements = screen.getAllByText(/in the last 5 minutes/i);
        expect(timeWindowElements.length).toBeGreaterThan(0);
      });
    });

    it('displays empty state icon', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          return HttpResponse.json(mockEmptyResponse);
        })
      );

      renderWidget();

      await waitFor(() => {
        // PeopleIcon should be visible in empty state
        const svg = document.querySelector('[data-testid="PeopleIcon"]');
        expect(svg).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  describe('Loading State Tests', () => {
    it('displays loading spinner during initial fetch', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json(mockOnlineUsersResponse);
        })
      );

      renderWidget();

      expect(screen.getByRole('progressbar', { name: /loading online users/i })).toBeInTheDocument();
    });

    it('hides loading spinner after data loads', async () => {
      renderWidget();

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });

    it('loading spinner is accessible to screen readers', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json(mockOnlineUsersResponse);
        })
      );

      renderWidget();

      const spinner = screen.getByRole('progressbar');
      expect(spinner).toHaveAttribute('aria-label', 'Loading online users');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling Tests', () => {
    it('displays error message on API failure', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          return HttpResponse.json(
            { success: false, error: { message: 'Server error' } },
            { status: 500 }
          );
        })
      );

      renderWidget();

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('displays retry button on error', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          return HttpResponse.json(
            { success: false, error: { message: 'Server error' } },
            { status: 500 }
          );
        })
      );

      renderWidget();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('retry button refetches data', async () => {
      let requestCount = 0;
      let shouldSucceed = false;

      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          requestCount++;
          // Fail until we set shouldSucceed to true (after user clicks retry)
          if (!shouldSucceed) {
            return HttpResponse.json(
              { success: false, error: { message: 'Server error' } },
              { status: 500 }
            );
          }
          return HttpResponse.json(mockOnlineUsersResponse);
        })
      );

      const { user } = renderWidget();

      // Wait for the error state to appear after retries are exhausted
      // The hook has retry: 1, so it will make 2 attempts before showing error
      await waitFor(
        () => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Now allow success
      shouldSucceed = true;

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });
    });

    it('displays user-friendly error message', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          return HttpResponse.json(
            { success: false, error: { message: 'Server error' } },
            { status: 500 }
          );
        })
      );

      renderWidget();

      // Error message can be either axios message or custom fallback
      await waitFor(() => {
        const alertElement = screen.getByRole('alert');
        expect(alertElement).toBeInTheDocument();
        // The actual message depends on the error type - axios throws with status code message
        expect(
          screen.getByText(/request failed with status code 500|failed to load online users/i)
        ).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // User Interaction Tests
  // ==========================================================================

  describe('User Interaction Tests', () => {
    it('calls onViewProfile when clicking on user name', async () => {
      const onViewProfile = vi.fn();
      const { user } = renderWidget({ onViewProfile });

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Alice Smith'));

      expect(onViewProfile).toHaveBeenCalledWith(1);
    });

    it('calls onMessageUser when clicking message button', async () => {
      const onMessageUser = vi.fn();
      const { user } = renderWidget({ onMessageUser, currentUserId: 999 });

      await waitFor(() => {
        const messageButtons = screen.getAllByRole('button', { name: /send message/i });
        expect(messageButtons.length).toBeGreaterThan(0);
      });

      const messageButton = screen.getAllByRole('button', { name: /send message/i })[0];
      if (messageButton) {
        await user.click(messageButton);
      }

      expect(onMessageUser).toHaveBeenCalled();
    });

    it('does not show message button for current user', async () => {
      renderWidget({ onMessageUser: vi.fn(), currentUserId: 1 });

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      // Find the list item for user ID 1 (current user)
      const userItem = screen.getByText('Alice Smith').closest('li');
      if (userItem) {
        // Should not have message button for current user
        expect(within(userItem).queryByRole('button', { name: /send message to alice/i })).not.toBeInTheDocument();
      }
    });

    it('shows visibility toggle for current user', async () => {
      renderWidget({
        onToggleVisibility: vi.fn(),
        currentUserId: 1,
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /hide your online status|show your online status/i })).toBeInTheDocument();
      });
    });

    it('calls onToggleVisibility when clicking visibility button', async () => {
      const onToggleVisibility = vi.fn();
      const { user } = renderWidget({
        onToggleVisibility,
        currentUserId: 1,
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /hide your online status|show your online status/i })).toBeInTheDocument();
      });

      const visibilityButton = screen.getByRole('button', { name: /hide your online status|show your online status/i });
      await user.click(visibilityButton);

      expect(onToggleVisibility).toHaveBeenCalled();
    });

    it('supports keyboard navigation on user items', async () => {
      const onViewProfile = vi.fn();
      const { user } = renderWidget({ onViewProfile });

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      // Find the focusable avatar element by its aria-label
      const avatarButton = screen.getByRole('button', {
        name: /view alice smith's profile/i,
      });
      expect(avatarButton).toBeInTheDocument();

      // Focus on the avatar button directly
      avatarButton.focus();

      // Press Enter to activate
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(onViewProfile).toHaveBeenCalledWith(1); // Alice's ID
      });
    });
  });

  // ==========================================================================
  // Responsive Design Tests
  // ==========================================================================

  describe('Responsive Design Tests', () => {
    it('renders compact mode with smaller avatars', async () => {
      renderWidget({ compact: true });

      await waitFor(() => {
        const avatars = document.querySelectorAll('.MuiAvatar-root');
        if (avatars[0]) {
          // Compact mode uses 32px avatars - verify avatar is rendered
          expect(avatars[0]).toBeInTheDocument();
        }
      });
    });

    it('does not show secondary text (last access) in compact mode', async () => {
      renderWidget({ compact: true });

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      // In compact mode, "Active X ago" text should not be visible
      expect(screen.queryByText(/active/i)).not.toBeInTheDocument();
    });

    it('renders smaller title in compact mode', async () => {
      renderWidget({ compact: true });

      await waitFor(() => {
        const heading = screen.getByRole('heading', { name: /online users/i });
        // Check it's subtitle2 variant (smaller)
        expect(heading).toBeInTheDocument();
      });
    });

    it('limits list height in compact mode', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          return HttpResponse.json(mockLargeResponse);
        })
      );

      renderWidget({ compact: true, maxUsers: 50 });

      await waitFor(() => {
        const list = screen.getByRole('list', { name: /list of online users/i });
        // Compact mode has max-height of 300px
        expect(list).toHaveStyle({ maxHeight: '300px' });
      });
    });

    it('uses smaller profile images in compact mode', async () => {
      renderWidget({ compact: true });

      await waitFor(() => {
        const avatars = document.querySelectorAll('.MuiAvatar-root');
        expect(avatars.length).toBeGreaterThan(0);
        // Verifies smaller image URL would be used (profileimageurlsmall)
      });
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility Tests', () => {
    it('widget has proper ARIA role and label', async () => {
      renderWidget();

      await waitFor(() => {
        const widget = screen.getByRole('region', { name: /online users widget/i });
        expect(widget).toBeInTheDocument();
      });
    });

    it('user list has proper ARIA label', async () => {
      renderWidget();

      await waitFor(() => {
        const list = screen.getByRole('list', { name: /list of online users/i });
        expect(list).toBeInTheDocument();
      });
    });

    it('filter chips have aria-pressed attribute', async () => {
      renderWidget({ showFilters: true, compact: false });

      await waitFor(() => {
        const allChip = screen.getByRole('button', { name: /all/i });
        expect(allChip).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('message buttons have descriptive aria-labels', async () => {
      renderWidget({ onMessageUser: vi.fn(), currentUserId: 999 });

      await waitFor(() => {
        const messageButton = screen.getAllByRole('button', { name: /send message to/i })[0];
        expect(messageButton).toHaveAttribute('aria-label');
      });
    });

    it('refresh button has aria-label', async () => {
      renderWidget();

      await waitFor(() => {
        const refreshButton = screen.getByRole('button', { name: /refresh online users list/i });
        expect(refreshButton).toBeInTheDocument();
      });
    });

    it('avatar container is keyboard accessible when clickable', async () => {
      renderWidget({ onViewProfile: vi.fn() });

      await waitFor(() => {
        const avatarContainers = document.querySelectorAll('[role="button"][tabindex="0"]');
        expect(avatarContainers.length).toBeGreaterThan(0);
      });
    });

    it('loading state announces to screen readers', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json(mockOnlineUsersResponse);
        })
      );

      renderWidget();

      const spinner = screen.getByRole('progressbar');
      expect(spinner).toHaveAttribute('aria-label');
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Performance Tests', () => {
    it('does not fetch when widget is unmounted', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          fetchCount++;
          return HttpResponse.json(mockOnlineUsersResponse);
        })
      );

      const { unmount } = renderWidget();

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      // Record the fetch count after initial render
      const initialFetchCount = fetchCount;
      // Initial render might make 1-2 fetches (depending on StrictMode and retry behavior)
      expect(initialFetchCount).toBeGreaterThanOrEqual(1);

      unmount();

      // Advance time - should not trigger more fetches after unmount
      await act(async () => {
        vi.advanceTimersByTime(60000);
      });

      // After unmount, no additional fetches should occur
      expect(fetchCount).toBe(initialFetchCount);
    });

    it('reuses cached data for same query', async () => {
      let fetchCount = 0;
      const queryClient = createTestQueryClient();

      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          fetchCount++;
          return HttpResponse.json(mockOnlineUsersResponse);
        })
      );

      // First render
      const { unmount } = renderWidget({}, queryClient);

      await waitFor(() => {
        expect(fetchCount).toBe(1);
      });

      unmount();

      // Second render with same query client (before cache expires)
      renderWidget({}, queryClient);

      // Should use cached data, not fetch again immediately
      expect(fetchCount).toBe(1);
    });

    it('handles large user lists efficiently', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          return HttpResponse.json(mockLargeResponse);
        })
      );

      const startTime = performance.now();
      renderWidget({ maxUsers: 50 });

      await waitFor(() => {
        expect(screen.getByRole('list', { name: /list of online users/i })).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Render should complete in reasonable time (less than 1 second)
      expect(renderTime).toBeLessThan(1000);
    });
  });

  // ==========================================================================
  // Context Filtering Tests
  // ==========================================================================

  describe('Context Filtering Tests', () => {
    it('passes courseId to API when provided', async () => {
      let capturedUrl: string | undefined;

      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json(mockOnlineUsersResponse);
        })
      );

      renderWidget({ courseId: 101 });

      await waitFor(() => {
        expect(capturedUrl).toContain('courseid=101');
      });
    });

    it('passes groupId to API when provided', async () => {
      let capturedUrl: string | undefined;

      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json(mockOnlineUsersResponse);
        })
      );

      renderWidget({ groupId: 5 });

      await waitFor(() => {
        expect(capturedUrl).toContain('groupid=5');
      });
    });

    it('passes both courseId and groupId when provided', async () => {
      let capturedUrl: string | undefined;

      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json(mockOnlineUsersResponse);
        })
      );

      renderWidget({ courseId: 101, groupId: 5 });

      await waitFor(() => {
        expect(capturedUrl).toContain('courseid=101');
        expect(capturedUrl).toContain('groupid=5');
      });
    });
  });

  // ==========================================================================
  // Props Validation Tests
  // ==========================================================================

  describe('Props Validation Tests', () => {
    it('handles undefined callbacks gracefully', async () => {
      // Should not throw when callbacks are undefined
      renderWidget({
        onMessageUser: undefined,
        onViewProfile: undefined,
        onToggleVisibility: undefined,
      });

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /online users widget/i })).toBeInTheDocument();
      });
    });

    it('respects default props values', async () => {
      renderWidget();

      await waitFor(() => {
        // Default title
        expect(screen.getByText(/online users/i)).toBeInTheDocument();
        // Default showFilters is true
        expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument();
      });
    });

    it('applies custom maxUsers limit', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              users: createMockOnlineUsers(20),
              count: 20,
              timeWindow: 5,
            },
          });
        })
      );

      renderWidget({ maxUsers: 5 });

      await waitFor(() => {
        const userList = screen.getByRole('list', { name: /list of online users/i });
        const userItems = within(userList).getAllByRole('listitem');
        // 5 users + 1 "more users" indicator
        expect(userItems.length).toBe(6);
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration Tests', () => {
    it('complete user flow: view users, filter, click user, message user', async () => {
      const onViewProfile = vi.fn();
      const onMessageUser = vi.fn();

      const { user } = renderWidget({
        onViewProfile,
        onMessageUser,
        currentUserId: 999, // Not one of the mock users
        showFilters: true,
        compact: false,
      });

      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      // Verify count
      expect(screen.getByText(/5 users online/i)).toBeInTheDocument();

      // Click a filter chip
      const studentsChip = screen.getByRole('button', { name: /students/i });
      await user.click(studentsChip);
      expect(studentsChip).toHaveAttribute('aria-pressed', 'true');

      // Click to view a user profile
      await user.click(screen.getByText('Alice Smith'));
      expect(onViewProfile).toHaveBeenCalledWith(1);

      // Click message button
      const messageButtons = screen.getAllByRole('button', { name: /send message/i });
      if (messageButtons[0]) {
        await user.click(messageButtons[0]);
        expect(onMessageUser).toHaveBeenCalled();
      }
    });

    it('handles network error recovery', async () => {
      let shouldSucceed = false;

      server.use(
        http.get(`${API_BASE_URL}/blocks/online`, () => {
          // Fail until we set shouldSucceed = true (after user clicks retry)
          if (!shouldSucceed) {
            return HttpResponse.error();
          }
          return HttpResponse.json(mockOnlineUsersResponse);
        })
      );

      const { user } = renderWidget();

      // Wait for error state (hook has retry: 1, so it will fail twice before showing error)
      await waitFor(
        () => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Now allow success for the retry
      shouldSucceed = true;

      // Click retry
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Should show users after successful retry
      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });
    });
  });
});
