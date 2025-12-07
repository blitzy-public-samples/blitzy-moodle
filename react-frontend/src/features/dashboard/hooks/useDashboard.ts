/**
 * Dashboard Aggregation Hook - useDashboard
 *
 * Custom React hook that aggregates dashboard data from multiple API endpoints
 * including user dashboard, calendar, upcoming events, recent activity, and widget data.
 * Manages dashboard state with React Query for caching and background revalidation.
 *
 * This hook provides:
 * - Unified dashboard data aggregation from multiple sources
 * - Role-based dashboard layouts (student, teacher, admin)
 * - Widget visibility controls and configuration management
 * - Intelligent caching with 5-minute stale time
 * - Background revalidation on window focus
 * - Optimistic updates for widget configuration changes
 * - TypeScript-safe methods with explicit types
 *
 * Architecture Overview:
 * - Uses useAuth to get current authenticated user
 * - Fetches main dashboard data via GET /api/v1/users/{id}/dashboard
 * - Fetches widget data via GET /api/v1/blocks/* endpoints in parallel
 * - Uses React Query's useQueries for parallel widget fetching
 * - Uses useMutation for widget configuration updates
 *
 * Backend Integration:
 * - All API calls wrap existing Moodle functions (my_get_page, block rendering)
 * - Backend handles all permission checks via require_capability()
 * - No business logic duplication - all calculations done on PHP backend
 *
 * Based on Moodle source files:
 * - public/my/index.php (main dashboard)
 * - public/my/lib.php (dashboard utilities)
 * - public/blocks/calendar_month/block_calendar_month.php (calendar widget)
 * - public/blocks/calendar_upcoming/block_calendar_upcoming.php (upcoming events)
 * - public/blocks/recent_activity/block_recent_activity.php (activity feed)
 * - public/blocks/online_users/block_online_users.php (online users)
 *
 * @module features/dashboard/hooks/useDashboard
 * @package react-frontend
 * @copyright 2024 Moodle React Frontend
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  fetchUserDashboard,
  fetchCalendarWidget,
  fetchUpcomingEvents,
  fetchTimeline,
  fetchCourseOverview,
  fetchRecentActivity,
  fetchOnlineUsers,
  fetchBadges,
  fetchComments,
  updateWidgetConfig,
  dashboardQueryKeys,
  type CalendarWidgetData,
  type UpcomingEventsData,
  type TimelineData,
  type CourseOverviewData,
  type RecentActivityData,
  type OnlineUsersData,
  type BadgesData,
  type CommentsData,
} from '@/features/dashboard/api/dashboardApi';
import type {
  DashboardData,
  WidgetConfig,
  UserRole,
} from '@/features/dashboard/types/dashboard.types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Stale time for dashboard data (5 minutes)
 * Balance between freshness and API call reduction
 */
const DASHBOARD_STALE_TIME = 5 * 60 * 1000;

/**
 * Widget type identifier strings used in API calls
 */
const WIDGET_TYPES = {
  CALENDAR: 'calendar',
  UPCOMING: 'upcoming',
  TIMELINE: 'timeline',
  OVERVIEW: 'overview',
  RECENT: 'recent',
  ONLINE: 'online',
  BADGES: 'badges',
  COMMENTS: 'comments',
} as const;

/**
 * WidgetType union type for widget identification
 */
export type WidgetType = typeof WIDGET_TYPES[keyof typeof WIDGET_TYPES];

/**
 * Default widgets configuration by user role
 * Determines which widgets are shown by default for each role
 */
const DEFAULT_WIDGETS_BY_ROLE: Record<string, readonly WidgetType[]> = {
  student: [
    WIDGET_TYPES.CALENDAR,
    WIDGET_TYPES.UPCOMING,
    WIDGET_TYPES.TIMELINE,
    WIDGET_TYPES.OVERVIEW,
    WIDGET_TYPES.BADGES,
  ],
  teacher: [
    WIDGET_TYPES.CALENDAR,
    WIDGET_TYPES.UPCOMING,
    WIDGET_TYPES.RECENT,
    WIDGET_TYPES.ONLINE,
    WIDGET_TYPES.OVERVIEW,
  ],
  editingteacher: [
    WIDGET_TYPES.CALENDAR,
    WIDGET_TYPES.UPCOMING,
    WIDGET_TYPES.RECENT,
    WIDGET_TYPES.ONLINE,
    WIDGET_TYPES.OVERVIEW,
  ],
  manager: [
    WIDGET_TYPES.CALENDAR,
    WIDGET_TYPES.RECENT,
    WIDGET_TYPES.ONLINE,
    WIDGET_TYPES.OVERVIEW,
    WIDGET_TYPES.COMMENTS,
  ],
  admin: [
    WIDGET_TYPES.CALENDAR,
    WIDGET_TYPES.RECENT,
    WIDGET_TYPES.ONLINE,
    WIDGET_TYPES.OVERVIEW,
    WIDGET_TYPES.COMMENTS,
  ],
  guest: [
    WIDGET_TYPES.CALENDAR,
    WIDGET_TYPES.UPCOMING,
  ],
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Dashboard layout type based on user role
 * Determines the overall dashboard structure and widget arrangement
 */
export type DashboardLayout = 'student' | 'teacher' | 'admin' | 'guest';

/**
 * Aggregated widget data structure
 * Contains the fetched data for a specific widget type
 */
export interface WidgetData {
  readonly type: WidgetType;
  readonly data: CalendarWidgetData | UpcomingEventsData | TimelineData |
    CourseOverviewData | RecentActivityData | OnlineUsersData |
    BadgesData | CommentsData | null;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly visible: boolean;
  readonly order: number;
}

/**
 * Widget configuration state for managing visibility and order
 */
interface WidgetVisibilityConfig {
  [widgetType: string]: {
    visible: boolean;
    order: number;
  };
}

/**
 * Dashboard hook return interface
 * Comprehensive API for dashboard state and operations
 */
export interface DashboardHookReturn {
  /**
   * Aggregated dashboard data with all widgets
   * Contains page, user, capabilities, blocks, and widgets data
   */
  readonly dashboard: DashboardData | null;

  /**
   * Array of widget data for current user
   * Each widget includes type, data, loading state, and visibility
   */
  readonly widgets: readonly WidgetData[];

  /**
   * True when any query is loading (dashboard or widgets)
   */
  readonly isLoading: boolean;

  /**
   * Error from any failed query
   */
  readonly error: Error | null;

  /**
   * Manually refetch all dashboard data
   * Invalidates all dashboard and widget queries
   */
  readonly refetch: () => Promise<void>;

  /**
   * Get specific widget by type
   * @param type - The widget type to retrieve
   * @returns Widget data or null if not found
   */
  readonly getWidget: (type: WidgetType) => WidgetData | null;

  /**
   * Check if a widget is currently visible
   * @param type - The widget type to check
   * @returns True if widget is visible
   */
  readonly isWidgetVisible: (type: WidgetType) => boolean;

  /**
   * Toggle widget visibility (show/hide)
   * Performs optimistic update and syncs with server
   * @param type - The widget type to toggle
   */
  readonly toggleWidget: (type: WidgetType) => Promise<void>;

  /**
   * Change widget order by providing new widget order array
   * Performs optimistic update and syncs with server
   * @param widgetIds - Array of widget type strings in desired order
   */
  readonly reorderWidgets: (widgetIds: string[]) => Promise<void>;

  /**
   * Current layout based on user role (student/teacher/admin/guest)
   */
  readonly layout: DashboardLayout;

  /**
   * Refresh a single widget's data
   * @param type - The widget type to refresh
   */
  readonly refreshWidget: (type: WidgetType) => Promise<void>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine the primary role from user roles array
 * Uses role priority to select the most privileged role
 *
 * @param roles - Array of user roles
 * @returns The primary role string
 */
function getPrimaryRole(roles: readonly string[]): UserRole {
  // Role priority order (highest to lowest)
  const rolePriority: UserRole[] = [
    'admin',
    'manager',
    'editingteacher',
    'teacher',
    'student',
    'guest',
  ];

  for (const priorityRole of rolePriority) {
    if (roles.includes(priorityRole)) {
      return priorityRole;
    }
  }

  // Default to student if no matching role found
  return 'student';
}

/**
 * Determine dashboard layout from user role
 *
 * @param role - User's primary role
 * @returns Dashboard layout type
 */
function getLayoutFromRole(role: UserRole): DashboardLayout {
  switch (role) {
    case 'admin':
    case 'manager':
      return 'admin';
    case 'editingteacher':
    case 'teacher':
      return 'teacher';
    case 'guest':
      return 'guest';
    case 'student':
    default:
      return 'student';
  }
}

/**
 * Get default widgets for a specific role
 *
 * @param role - User's primary role
 * @returns Array of default widget types for the role
 */
function getDefaultWidgetsForRole(role: UserRole): readonly WidgetType[] {
  return DEFAULT_WIDGETS_BY_ROLE[role] ?? DEFAULT_WIDGETS_BY_ROLE['student'] ?? [];
}

// ============================================================================
// Main Hook Implementation
// ============================================================================

/**
 * Custom hook for aggregating dashboard data from multiple API endpoints
 *
 * This hook provides a unified interface for fetching and managing dashboard data,
 * including user dashboard configuration, calendar events, timeline activities,
 * recent activity, online users, badges, and comments.
 *
 * Features:
 * - Automatic role detection and layout selection
 * - Parallel widget data fetching with React Query
 * - 5-minute stale time for intelligent caching
 * - Background revalidation on window focus
 * - Optimistic updates for widget configuration
 * - Complete TypeScript type safety
 *
 * @example
 * ```tsx
 * function DashboardPage() {
 *   const {
 *     dashboard,
 *     widgets,
 *     isLoading,
 *     error,
 *     layout,
 *     toggleWidget,
 *     getWidget
 *   } = useDashboard();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *
 *   const calendarWidget = getWidget('calendar');
 *
 *   return (
 *     <DashboardLayout layout={layout}>
 *       {widgets.filter(w => w.visible).map(widget => (
 *         <WidgetRenderer key={widget.type} widget={widget} />
 *       ))}
 *     </DashboardLayout>
 *   );
 * }
 * ```
 *
 * @returns DashboardHookReturn object with dashboard state and methods
 */
export default function useDashboard(): DashboardHookReturn {
  // Get query client for cache management
  const queryClient = useQueryClient();

  // Get current authenticated user
  const { user, isAuthenticated } = useAuth();

  // Extract user ID safely
  const userId = user?.id ?? 0;

  // Determine user's primary role and layout
  // Extract role shortnames from Role objects for role matching
  const userRoleShortnames = useMemo(
    () => (user?.roles ?? []).map((role) => role.shortname),
    [user?.roles]
  );
  const primaryRole = useMemo(
    () => getPrimaryRole(userRoleShortnames),
    [userRoleShortnames]
  );

  const layout = useMemo(
    () => getLayoutFromRole(primaryRole),
    [primaryRole]
  );

  // Get default widgets for user's role
  const defaultWidgets = useMemo(
    () => getDefaultWidgetsForRole(primaryRole),
    [primaryRole]
  );

  // ============================================================================
  // Main Dashboard Query
  // ============================================================================

  /**
   * Fetch main dashboard data
   * Wraps existing Moodle my_get_page() PHP function
   */
  const dashboardQuery = useQuery({
    queryKey: dashboardQueryKeys.dashboard(userId),
    queryFn: () => fetchUserDashboard(userId),
    staleTime: DASHBOARD_STALE_TIME,
    enabled: isAuthenticated && userId > 0,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Extract widget configuration from dashboard data
  const widgetConfig = useMemo<WidgetVisibilityConfig>(() => {
    if (!dashboardQuery.data?.widgets) {
      // Use default visibility based on role
      const config: WidgetVisibilityConfig = {};
      defaultWidgets.forEach((type, index) => {
        config[type] = { visible: true, order: index };
      });
      return config;
    }

    // Build config from dashboard widgets
    const config: WidgetVisibilityConfig = {};
    dashboardQuery.data.widgets.forEach((widget, index) => {
      const widgetType = widget.type.toLowerCase().replace(/_/g, '');
      config[widgetType] = {
        visible: widget.config.visible,
        order: widget.config.position.order ?? index,
      };
    });

    return config;
  }, [dashboardQuery.data?.widgets, defaultWidgets]);

  // ============================================================================
  // Widget Queries (Parallel Fetching)
  // ============================================================================

  /**
   * Create parallel queries for all widget types
   * Uses useQueries for efficient parallel data fetching
   */
  const widgetQueries = useQueries({
    queries: [
      // Calendar widget - wraps calendar_month block
      {
        queryKey: dashboardQueryKeys.calendar(),
        queryFn: () => fetchCalendarWidget(),
        staleTime: DASHBOARD_STALE_TIME,
        enabled: isAuthenticated && defaultWidgets.includes(WIDGET_TYPES.CALENDAR),
        refetchOnWindowFocus: true,
      },
      // Upcoming events - wraps calendar_upcoming block
      {
        queryKey: dashboardQueryKeys.upcomingEvents(),
        queryFn: () => fetchUpcomingEvents(),
        staleTime: DASHBOARD_STALE_TIME,
        enabled: isAuthenticated && defaultWidgets.includes(WIDGET_TYPES.UPCOMING),
        refetchOnWindowFocus: true,
      },
      // Timeline - wraps timeline block
      {
        queryKey: dashboardQueryKeys.timeline(),
        queryFn: () => fetchTimeline(),
        staleTime: DASHBOARD_STALE_TIME,
        enabled: isAuthenticated && defaultWidgets.includes(WIDGET_TYPES.TIMELINE),
        refetchOnWindowFocus: true,
      },
      // Course overview - wraps myoverview block
      {
        queryKey: dashboardQueryKeys.courseOverview(),
        queryFn: () => fetchCourseOverview(),
        staleTime: DASHBOARD_STALE_TIME,
        enabled: isAuthenticated && defaultWidgets.includes(WIDGET_TYPES.OVERVIEW),
        refetchOnWindowFocus: true,
      },
      // Recent activity - wraps recent_activity block (requires courseId, using 0 for site-wide)
      {
        queryKey: dashboardQueryKeys.recentActivity(0),
        queryFn: () => fetchRecentActivity(0),
        staleTime: 60 * 1000, // 1 minute for activity
        enabled: isAuthenticated && defaultWidgets.includes(WIDGET_TYPES.RECENT),
        refetchOnWindowFocus: true,
      },
      // Online users - wraps online_users block
      {
        queryKey: dashboardQueryKeys.onlineUsers(),
        queryFn: () => fetchOnlineUsers(),
        staleTime: 30 * 1000, // 30 seconds for real-time feel
        enabled: isAuthenticated && defaultWidgets.includes(WIDGET_TYPES.ONLINE),
        refetchOnWindowFocus: true,
        refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
      },
      // Badges - wraps badges block
      {
        queryKey: dashboardQueryKeys.badges(userId),
        queryFn: () => fetchBadges(userId),
        staleTime: 10 * 60 * 1000, // 10 minutes for badges
        enabled: isAuthenticated && userId > 0 && defaultWidgets.includes(WIDGET_TYPES.BADGES),
        refetchOnWindowFocus: true,
      },
      // Comments - wraps comments block
      {
        queryKey: dashboardQueryKeys.comments(),
        queryFn: () => fetchComments(),
        staleTime: 60 * 1000, // 1 minute for comments
        enabled: isAuthenticated && defaultWidgets.includes(WIDGET_TYPES.COMMENTS),
        refetchOnWindowFocus: true,
      },
    ],
  });

  // ============================================================================
  // Aggregate Widget Data
  // ============================================================================

  /**
   * Map widget query results to WidgetData array
   */
  const widgets = useMemo<readonly WidgetData[]>(() => {
    const widgetTypes: WidgetType[] = [
      WIDGET_TYPES.CALENDAR,
      WIDGET_TYPES.UPCOMING,
      WIDGET_TYPES.TIMELINE,
      WIDGET_TYPES.OVERVIEW,
      WIDGET_TYPES.RECENT,
      WIDGET_TYPES.ONLINE,
      WIDGET_TYPES.BADGES,
      WIDGET_TYPES.COMMENTS,
    ];

    return widgetTypes.map((type, index) => {
      const query = widgetQueries[index];
      const config = widgetConfig[type];

      return {
        type,
        data: query?.data ?? null,
        isLoading: query?.isLoading ?? false,
        error: query?.error instanceof Error ? query.error : null,
        visible: config?.visible ?? defaultWidgets.includes(type),
        order: config?.order ?? index,
      } as WidgetData;
    }).sort((a, b) => a.order - b.order);
  }, [widgetQueries, widgetConfig, defaultWidgets]);

  // ============================================================================
  // Combined Loading and Error States
  // ============================================================================

  /**
   * Combined loading state from dashboard and widget queries
   */
  const isLoading = useMemo(
    () => dashboardQuery.isLoading || widgetQueries.some((query) => query.isLoading),
    [dashboardQuery.isLoading, widgetQueries]
  );

  /**
   * Combined error state - returns first error found
   */
  const error = useMemo<Error | null>(() => {
    if (dashboardQuery.error instanceof Error) {
      return dashboardQuery.error;
    }

    const widgetError = widgetQueries.find((query) => query.error);
    if (widgetError?.error instanceof Error) {
      return widgetError.error;
    }

    return null;
  }, [dashboardQuery.error, widgetQueries]);

  // ============================================================================
  // Widget Configuration Mutation
  // ============================================================================

  /**
   * Mutation for updating widget configuration
   * Handles optimistic updates and cache invalidation
   */
  const widgetConfigMutation = useMutation({
    mutationFn: async ({
      widgetId,
      config,
    }: {
      widgetId: string;
      config: Partial<WidgetConfig>;
    }) => {
      return updateWidgetConfig(widgetId, config);
    },
    onSuccess: () => {
      // Invalidate dashboard query to refresh widget config
      void queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.dashboard(userId),
      });
    },
    onError: (err) => {
      console.error('Failed to update widget configuration:', err);
    },
  });

  // ============================================================================
  // Hook Methods
  // ============================================================================

  /**
   * Get a specific widget by type
   */
  const getWidget = useCallback(
    (type: WidgetType): WidgetData | null => {
      return widgets.find((widget) => widget.type === type) ?? null;
    },
    [widgets]
  );

  /**
   * Check if a widget is visible
   */
  const isWidgetVisible = useCallback(
    (type: WidgetType): boolean => {
      const widget = widgets.find((w) => w.type === type);
      return widget?.visible ?? false;
    },
    [widgets]
  );

  /**
   * Toggle widget visibility
   * Performs optimistic update and syncs with server
   */
  const toggleWidget = useCallback(
    async (type: WidgetType): Promise<void> => {
      const widget = widgets.find((w) => w.type === type);
      if (!widget) {
        console.warn(`Widget type "${type}" not found`);
        return;
      }

      const newVisibility = !widget.visible;

      // Optimistic update - update local cache immediately
      queryClient.setQueryData<DashboardData>(
        dashboardQueryKeys.dashboard(userId),
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            widgets: oldData.widgets.map((w) => {
              // Match widget by type (case-insensitive comparison)
              const widgetType = w.type.toLowerCase().replace(/_/g, '');
              if (widgetType === type) {
                return {
                  ...w,
                  config: {
                    ...w.config,
                    visible: newVisibility,
                  },
                };
              }
              return w;
            }),
          };
        }
      );

      // Sync with server
      try {
        await widgetConfigMutation.mutateAsync({
          widgetId: type,
          config: { visible: newVisibility },
        });
      } catch (err) {
        // Revert optimistic update on error
        void queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.dashboard(userId),
        });
        throw err;
      }
    },
    [widgets, userId, queryClient, widgetConfigMutation]
  );

  /**
   * Reorder widgets by providing new order array
   * Performs optimistic update and syncs with server
   */
  const reorderWidgets = useCallback(
    async (widgetIds: string[]): Promise<void> => {
      // Validate all widget IDs
      const validWidgetIds = widgetIds.filter((id) =>
        widgets.some((w) => w.type === id)
      );

      if (validWidgetIds.length === 0) {
        console.warn('No valid widget IDs provided for reordering');
        return;
      }

      // Optimistic update - update local cache immediately
      queryClient.setQueryData<DashboardData>(
        dashboardQueryKeys.dashboard(userId),
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            widgets: oldData.widgets.map((w) => {
              const widgetType = w.type.toLowerCase().replace(/_/g, '');
              const newOrder = validWidgetIds.indexOf(widgetType);
              if (newOrder >= 0) {
                return {
                  ...w,
                  config: {
                    ...w.config,
                    position: {
                      ...w.config.position,
                      order: newOrder,
                    },
                  },
                };
              }
              return w;
            }),
          };
        }
      );

      // Sync with server - update each widget's order
      try {
        await Promise.all(
          validWidgetIds.map((widgetId, index) =>
            widgetConfigMutation.mutateAsync({
              widgetId,
              config: {
                position: {
                  region: 'content' as const,
                  order: index,
                },
              },
            })
          )
        );
      } catch (err) {
        // Revert optimistic update on error
        void queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.dashboard(userId),
        });
        throw err;
      }
    },
    [widgets, userId, queryClient, widgetConfigMutation]
  );

  /**
   * Refetch all dashboard data
   * Invalidates all dashboard and widget queries
   */
  const refetch = useCallback(async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.all,
      }),
      dashboardQuery.refetch(),
      ...widgetQueries.map((query) => query.refetch()),
    ]);
  }, [queryClient, dashboardQuery, widgetQueries]);

  /**
   * Refresh a single widget's data
   */
  const refreshWidget = useCallback(
    async (type: WidgetType): Promise<void> => {
      const widgetTypes: WidgetType[] = [
        WIDGET_TYPES.CALENDAR,
        WIDGET_TYPES.UPCOMING,
        WIDGET_TYPES.TIMELINE,
        WIDGET_TYPES.OVERVIEW,
        WIDGET_TYPES.RECENT,
        WIDGET_TYPES.ONLINE,
        WIDGET_TYPES.BADGES,
        WIDGET_TYPES.COMMENTS,
      ];

      const index = widgetTypes.indexOf(type);
      if (index >= 0 && widgetQueries[index]) {
        await widgetQueries[index].refetch();
      } else {
        console.warn(`Widget type "${type}" not found for refresh`);
      }
    },
    [widgetQueries]
  );

  // ============================================================================
  // Return Hook Value
  // ============================================================================

  return {
    dashboard: dashboardQuery.data ?? null,
    widgets,
    isLoading,
    error,
    refetch,
    getWidget,
    isWidgetVisible,
    toggleWidget,
    reorderWidgets,
    layout,
    refreshWidget,
  };
}

// ============================================================================
// Named Export for Convenience
// ============================================================================

/**
 * Named export alias for useDashboard hook
 * Provides flexibility in import syntax
 */
export { useDashboard };
