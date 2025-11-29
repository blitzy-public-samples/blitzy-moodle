/**
 * Dashboard API Client Module
 *
 * This module provides API functions and React Query hooks for fetching and managing
 * dashboard data in the Moodle React frontend. It handles communication with the
 * backend API endpoints for user dashboards, calendar widgets, timeline, recent
 * activity, online users, course overview, badges, and comments.
 *
 * Based on Moodle's dashboard structure:
 * - public/my/index.php (main dashboard)
 * - public/my/lib.php (dashboard utilities)
 * - public/my/courses.php (course overview)
 * - public/blocks/calendar_month (calendar widget)
 * - public/blocks/calendar_upcoming (upcoming events)
 * - public/blocks/timeline (timeline widget)
 * - public/blocks/myoverview (course overview)
 * - public/blocks/recent_activity (recent activity)
 * - public/blocks/online_users (online users)
 *
 * Features:
 * - Type-safe API calls with TypeScript interfaces
 * - React Query hooks for data fetching, caching, and automatic background refetching
 * - Appropriate stale time configuration based on data freshness requirements
 * - Standard API response envelope handling
 * - Error handling and type guards
 *
 * @module features/dashboard/api/dashboardApi
 * @package react-frontend
 * @copyright 2024 Moodle React Frontend
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/services/api/client';
import type { ApiResponse } from '@/types/api';
import type { CourseId } from '@/types/common';
import type {
  Badge,
  CalendarEvent,
  Comment,
  CourseOverview,
  CourseOverviewPreferences,
  DashboardData,
  OnlineUser,
  RecentActivityItem,
  TimelineItem,
  TimelinePreferences,
  WidgetConfig,
} from '@/features/dashboard/types/dashboard.types';

// ============================================================================
// API Endpoint Constants
// ============================================================================

/**
 * User dashboard endpoint pattern
 * @param userId - The user ID to fetch dashboard for
 * @returns The API endpoint path
 */
const USER_DASHBOARD_ENDPOINT = (userId: number): string => `/users/${userId}/dashboard`;

/**
 * Block/widget endpoint constants
 */
const BLOCK_ENDPOINTS = {
  CALENDAR: '/blocks/calendar',
  UPCOMING: '/blocks/upcoming',
  TIMELINE: '/blocks/timeline',
  OVERVIEW: '/blocks/overview',
  RECENT_ACTIVITY: '/blocks/recent',
  ONLINE_USERS: '/blocks/online',
  BADGES: '/blocks/badges',
  COMMENTS: '/blocks/comments',
} as const;

// ============================================================================
// Query Key Factories
// ============================================================================

/**
 * Query key factory for dashboard-related queries
 * Provides consistent, cacheable query keys for React Query
 */
export const dashboardQueryKeys = {
  /** Root key for all dashboard queries */
  all: ['dashboard'] as const,

  /** Key for user dashboard data */
  dashboard: (userId: number) => [...dashboardQueryKeys.all, 'user', userId] as const,

  /** Key for calendar widget data */
  calendar: (courseId?: CourseId, categoryId?: number) =>
    [...dashboardQueryKeys.all, 'calendar', { courseId, categoryId }] as const,

  /** Key for upcoming events data */
  upcomingEvents: (courseId?: CourseId, categoryId?: number) =>
    [...dashboardQueryKeys.all, 'upcoming', { courseId, categoryId }] as const,

  /** Key for timeline data */
  timeline: (preferences?: TimelinePreferences) =>
    [...dashboardQueryKeys.all, 'timeline', preferences ?? {}] as const,

  /** Key for course overview data */
  courseOverview: (preferences?: CourseOverviewPreferences) =>
    [...dashboardQueryKeys.all, 'overview', preferences ?? {}] as const,

  /** Key for recent activity data */
  recentActivity: (courseId: CourseId, timeStart?: number) =>
    [...dashboardQueryKeys.all, 'recent', { courseId, timeStart }] as const,

  /** Key for online users data */
  onlineUsers: (courseId?: CourseId, groupId?: number) =>
    [...dashboardQueryKeys.all, 'online', { courseId, groupId }] as const,

  /** Key for badges data */
  badges: (userId: number) => [...dashboardQueryKeys.all, 'badges', userId] as const,

  /** Key for comments data */
  comments: (contextId?: number) => [...dashboardQueryKeys.all, 'comments', contextId] as const,
} as const;

// ============================================================================
// Response Type Definitions
// ============================================================================

/**
 * Calendar widget response data structure
 */
export interface CalendarWidgetData {
  /** Calendar events for the month */
  readonly events: readonly CalendarEvent[];
  /** Current month (1-12) */
  readonly month: number;
  /** Current year */
  readonly year: number;
  /** Navigation links */
  readonly navigation: {
    readonly prevMonth: string;
    readonly nextMonth: string;
    readonly today: string;
  };
}

/**
 * Upcoming events response data structure
 */
export interface UpcomingEventsData {
  /** List of upcoming events */
  readonly events: readonly CalendarEvent[];
  /** Whether there are more events to load */
  readonly hasMore: boolean;
  /** Total count of upcoming events */
  readonly total: number;
}

/**
 * Timeline response data structure
 */
export interface TimelineData {
  /** Timeline items */
  readonly items: readonly TimelineItem[];
  /** Current preferences */
  readonly preferences: TimelinePreferences;
  /** Whether there are more items to load */
  readonly hasMore: boolean;
  /** Total count of timeline items */
  readonly total: number;
}

/**
 * Course overview response data structure
 */
export interface CourseOverviewData {
  /** Course overview items */
  readonly courses: readonly CourseOverview[];
  /** Current preferences */
  readonly preferences: CourseOverviewPreferences;
  /** Whether there are more courses to load */
  readonly hasMore: boolean;
  /** Total count of courses */
  readonly total: number;
}

/**
 * Recent activity response data structure
 */
export interface RecentActivityData {
  /** Recent activity items */
  readonly items: readonly RecentActivityItem[];
  /** Whether there are more items to load */
  readonly hasMore: boolean;
  /** Total count of activities */
  readonly total: number;
}

/**
 * Online users response data structure
 */
export interface OnlineUsersData {
  /** List of online users */
  readonly users: readonly OnlineUser[];
  /** Total count of online users */
  readonly count: number;
  /** Time window in minutes for determining "online" status */
  readonly timeWindow: number;
}

/**
 * Badges response data structure
 */
export interface BadgesData {
  /** List of user badges */
  readonly badges: readonly Badge[];
  /** Total count of badges earned */
  readonly total: number;
}

/**
 * Comments response data structure
 */
export interface CommentsData {
  /** List of recent comments */
  readonly comments: readonly Comment[];
  /** Whether there are more comments to load */
  readonly hasMore: boolean;
  /** Total count of comments */
  readonly total: number;
}

/**
 * Widget configuration update request
 */
export interface WidgetConfigUpdate {
  /** Widget ID */
  readonly widgetId: string;
  /** Configuration updates to apply */
  readonly config: Partial<WidgetConfig>;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch user dashboard data
 *
 * Retrieves the complete dashboard configuration and data for a specific user,
 * including block layout, user preferences, and widget configurations.
 *
 * @param userId - The user ID to fetch dashboard for
 * @returns Promise resolving to dashboard data
 * @throws Error if the API request fails
 *
 * @example
 * ```typescript
 * const dashboard = await fetchUserDashboard(123);
 * console.log(dashboard.widgets);
 * ```
 */
export async function fetchUserDashboard(userId: number): Promise<DashboardData> {
  const response = await apiClient.get<ApiResponse<DashboardData>>(
    USER_DASHBOARD_ENDPOINT(userId)
  );
  return response.data.data;
}

/**
 * Fetch calendar widget data
 *
 * Retrieves calendar events for the month view widget, optionally filtered
 * by course or category context.
 *
 * @param courseId - Optional course ID to filter events
 * @param categoryId - Optional category ID to filter events
 * @returns Promise resolving to calendar widget data
 * @throws Error if the API request fails
 *
 * @example
 * ```typescript
 * // Fetch all calendar events
 * const calendar = await fetchCalendarWidget();
 *
 * // Fetch calendar for specific course
 * const courseCalendar = await fetchCalendarWidget(101);
 * ```
 */
export async function fetchCalendarWidget(
  courseId?: CourseId,
  categoryId?: number
): Promise<CalendarWidgetData> {
  const params = new URLSearchParams();
  if (courseId !== undefined) {
    params.append('courseid', String(courseId));
  }
  if (categoryId !== undefined) {
    params.append('categoryid', String(categoryId));
  }

  const queryString = params.toString();
  const url = queryString
    ? `${BLOCK_ENDPOINTS.CALENDAR}?${queryString}`
    : BLOCK_ENDPOINTS.CALENDAR;

  const response = await apiClient.get<ApiResponse<CalendarWidgetData>>(url);
  return response.data.data;
}

/**
 * Fetch upcoming events
 *
 * Retrieves upcoming calendar events, optionally filtered by course or category.
 * Events are sorted by date ascending.
 *
 * @param courseId - Optional course ID to filter events
 * @param categoryId - Optional category ID to filter events
 * @returns Promise resolving to upcoming events data
 * @throws Error if the API request fails
 *
 * @example
 * ```typescript
 * const events = await fetchUpcomingEvents();
 * events.events.forEach(event => {
 *   console.log(`${event.name} - ${new Date(event.timestart * 1000)}`);
 * });
 * ```
 */
export async function fetchUpcomingEvents(
  courseId?: CourseId,
  categoryId?: number
): Promise<UpcomingEventsData> {
  const params = new URLSearchParams();
  if (courseId !== undefined) {
    params.append('courseid', String(courseId));
  }
  if (categoryId !== undefined) {
    params.append('categoryid', String(categoryId));
  }

  const queryString = params.toString();
  const url = queryString
    ? `${BLOCK_ENDPOINTS.UPCOMING}?${queryString}`
    : BLOCK_ENDPOINTS.UPCOMING;

  const response = await apiClient.get<ApiResponse<UpcomingEventsData>>(url);
  return response.data.data;
}

/**
 * Fetch timeline items
 *
 * Retrieves timeline activities based on user preferences for sort order,
 * filter criteria, and item limit. Timeline shows upcoming activities and
 * deadlines across all enrolled courses.
 *
 * @param preferences - Optional timeline preferences (sort, filter, limit)
 * @returns Promise resolving to timeline data
 * @throws Error if the API request fails
 *
 * @example
 * ```typescript
 * const timeline = await fetchTimeline({
 *   sort: 'sortbydates',
 *   filter: 'next7days',
 *   limit: 10
 * });
 * ```
 */
export async function fetchTimeline(preferences?: TimelinePreferences): Promise<TimelineData> {
  const params = new URLSearchParams();
  if (preferences) {
    if (preferences.sort) {
      params.append('sort', preferences.sort);
    }
    if (preferences.filter) {
      params.append('filter', preferences.filter);
    }
    if (preferences.limit) {
      params.append('limit', String(preferences.limit));
    }
  }

  const queryString = params.toString();
  const url = queryString
    ? `${BLOCK_ENDPOINTS.TIMELINE}?${queryString}`
    : BLOCK_ENDPOINTS.TIMELINE;

  const response = await apiClient.get<ApiResponse<TimelineData>>(url);
  return response.data.data;
}

/**
 * Fetch course overview data
 *
 * Retrieves course cards with progress, enrollment status, and access info.
 * Supports grouping (all, in progress, future, past, favourites, hidden),
 * sorting, view mode, and paging preferences.
 *
 * @param preferences - Optional course overview preferences
 * @returns Promise resolving to course overview data
 * @throws Error if the API request fails
 *
 * @example
 * ```typescript
 * const overview = await fetchCourseOverview({
 *   grouping: 'inprogress',
 *   sort: 'lastaccessed',
 *   view: 'card',
 *   paging: 12
 * });
 * ```
 */
export async function fetchCourseOverview(
  preferences?: CourseOverviewPreferences
): Promise<CourseOverviewData> {
  const params = new URLSearchParams();
  if (preferences) {
    if (preferences.grouping) {
      params.append('grouping', preferences.grouping);
    }
    if (preferences.sort) {
      params.append('sort', preferences.sort);
    }
    if (preferences.view) {
      params.append('view', preferences.view);
    }
    if (preferences.paging) {
      params.append('paging', String(preferences.paging));
    }
    if (preferences.customfieldvalue) {
      params.append('customfieldvalue', preferences.customfieldvalue);
    }
  }

  const queryString = params.toString();
  const url = queryString
    ? `${BLOCK_ENDPOINTS.OVERVIEW}?${queryString}`
    : BLOCK_ENDPOINTS.OVERVIEW;

  const response = await apiClient.get<ApiResponse<CourseOverviewData>>(url);
  return response.data.data;
}

/**
 * Fetch recent activity
 *
 * Retrieves recent activity within a course context, including forum posts,
 * assignment submissions, grade changes, and content updates.
 *
 * @param courseId - The course ID to fetch activity for
 * @param timeStart - Optional Unix timestamp to filter activity from
 * @returns Promise resolving to recent activity data
 * @throws Error if the API request fails
 *
 * @example
 * ```typescript
 * // Fetch activity from last 7 days
 * const weekAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
 * const activity = await fetchRecentActivity(101, weekAgo);
 * ```
 */
export async function fetchRecentActivity(
  courseId: CourseId,
  timeStart?: number
): Promise<RecentActivityData> {
  const params = new URLSearchParams();
  params.append('courseid', String(courseId));
  if (timeStart !== undefined) {
    params.append('timestart', String(timeStart));
  }

  const url = `${BLOCK_ENDPOINTS.RECENT_ACTIVITY}?${params.toString()}`;
  const response = await apiClient.get<ApiResponse<RecentActivityData>>(url);
  return response.data.data;
}

/**
 * Fetch online users
 *
 * Retrieves list of users currently active (within configurable time window),
 * optionally filtered by course or group context.
 *
 * @param courseId - Optional course ID to filter users
 * @param groupId - Optional group ID to filter users
 * @returns Promise resolving to online users data
 * @throws Error if the API request fails
 *
 * @example
 * ```typescript
 * const onlineUsers = await fetchOnlineUsers(101);
 * console.log(`${onlineUsers.count} users online in course`);
 * ```
 */
export async function fetchOnlineUsers(
  courseId?: CourseId,
  groupId?: number
): Promise<OnlineUsersData> {
  const params = new URLSearchParams();
  if (courseId !== undefined) {
    params.append('courseid', String(courseId));
  }
  if (groupId !== undefined) {
    params.append('groupid', String(groupId));
  }

  const queryString = params.toString();
  const url = queryString
    ? `${BLOCK_ENDPOINTS.ONLINE_USERS}?${queryString}`
    : BLOCK_ENDPOINTS.ONLINE_USERS;

  const response = await apiClient.get<ApiResponse<OnlineUsersData>>(url);
  return response.data.data;
}

/**
 * Fetch user badges
 *
 * Retrieves badges earned by a user, including badge name, description,
 * image URL, and issue date.
 *
 * @param userId - The user ID to fetch badges for
 * @returns Promise resolving to badges data
 * @throws Error if the API request fails
 *
 * @example
 * ```typescript
 * const badges = await fetchBadges(123);
 * badges.badges.forEach(badge => {
 *   console.log(`Badge: ${badge.name} - Earned: ${new Date(badge.issuedate * 1000)}`);
 * });
 * ```
 */
export async function fetchBadges(userId: number): Promise<BadgesData> {
  const params = new URLSearchParams();
  params.append('userid', String(userId));

  const url = `${BLOCK_ENDPOINTS.BADGES}?${params.toString()}`;
  const response = await apiClient.get<ApiResponse<BadgesData>>(url);
  return response.data.data;
}

/**
 * Fetch recent comments
 *
 * Retrieves recent comment activity, optionally filtered by context.
 *
 * @param contextId - Optional context ID to filter comments
 * @returns Promise resolving to comments data
 * @throws Error if the API request fails
 *
 * @example
 * ```typescript
 * const comments = await fetchComments();
 * comments.comments.forEach(comment => {
 *   console.log(`${comment.username}: ${comment.content}`);
 * });
 * ```
 */
export async function fetchComments(contextId?: number): Promise<CommentsData> {
  const params = new URLSearchParams();
  if (contextId !== undefined) {
    params.append('contextid', String(contextId));
  }

  const queryString = params.toString();
  const url = queryString
    ? `${BLOCK_ENDPOINTS.COMMENTS}?${queryString}`
    : BLOCK_ENDPOINTS.COMMENTS;

  const response = await apiClient.get<ApiResponse<CommentsData>>(url);
  return response.data.data;
}

/**
 * Fetch generic dashboard data
 *
 * Generic function to fetch dashboard data by user ID. This is an alias
 * for fetchUserDashboard for consistency with naming conventions.
 *
 * @param userId - The user ID to fetch dashboard for
 * @returns Promise resolving to dashboard data
 * @throws Error if the API request fails
 */
export async function fetchDashboardData(userId: number): Promise<DashboardData> {
  return fetchUserDashboard(userId);
}

/**
 * Fetch widget data by type
 *
 * Generic function to fetch data for a specific widget type. Supports
 * all block types with appropriate parameters.
 *
 * @param widgetType - The type of widget to fetch data for
 * @param params - Optional parameters for the widget
 * @returns Promise resolving to widget-specific data
 * @throws Error if the API request fails or widget type is unknown
 *
 * @example
 * ```typescript
 * const calendarData = await fetchWidgetData('calendar', { courseId: 101 });
 * const timelineData = await fetchWidgetData('timeline', { preferences: { limit: 10 } });
 * ```
 */
export async function fetchWidgetData(
  widgetType: string,
  params?: Record<string, unknown>
): Promise<unknown> {
  switch (widgetType) {
    case 'calendar':
      return fetchCalendarWidget(
        params?.courseId as CourseId | undefined,
        params?.categoryId as number | undefined
      );
    case 'upcoming':
      return fetchUpcomingEvents(
        params?.courseId as CourseId | undefined,
        params?.categoryId as number | undefined
      );
    case 'timeline':
      return fetchTimeline(params?.preferences as TimelinePreferences | undefined);
    case 'overview':
      return fetchCourseOverview(params?.preferences as CourseOverviewPreferences | undefined);
    case 'recent':
      return fetchRecentActivity(
        params?.courseId as CourseId,
        params?.timeStart as number | undefined
      );
    case 'online':
      return fetchOnlineUsers(
        params?.courseId as CourseId | undefined,
        params?.groupId as number | undefined
      );
    case 'badges':
      return fetchBadges(params?.userId as number);
    case 'comments':
      return fetchComments(params?.contextId as number | undefined);
    default:
      throw new Error(`Unknown widget type: ${widgetType}`);
  }
}

/**
 * Update widget configuration
 *
 * Updates the configuration for a specific widget on the user's dashboard.
 * This includes visibility, position, and widget-specific settings.
 *
 * @param widgetId - The ID of the widget to update
 * @param config - The configuration updates to apply
 * @returns Promise resolving to the updated widget configuration
 * @throws Error if the API request fails
 *
 * @example
 * ```typescript
 * await updateWidgetConfig('timeline_widget', {
 *   visible: true,
 *   collapsed: false,
 *   config: { limit: 20 }
 * });
 * ```
 */
export async function updateWidgetConfig(
  widgetId: string,
  config: Partial<WidgetConfig>
): Promise<WidgetConfig> {
  const response = await apiClient.get<ApiResponse<WidgetConfig>>(
    `/users/me/widgets/${widgetId}`,
    { params: { config: JSON.stringify(config) } }
  );
  return response.data.data;
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Stale time constants for different data types
 * Configured based on data freshness requirements
 */
const STALE_TIMES = {
  /** Dashboard configuration - 5 minutes */
  DASHBOARD: 5 * 60 * 1000,
  /** Calendar data - 5 minutes */
  CALENDAR: 5 * 60 * 1000,
  /** Upcoming events - 5 minutes */
  UPCOMING_EVENTS: 5 * 60 * 1000,
  /** Timeline - 2 minutes (updates frequently with deadlines) */
  TIMELINE: 2 * 60 * 1000,
  /** Course overview - 5 minutes */
  COURSE_OVERVIEW: 5 * 60 * 1000,
  /** Recent activity - 1 minute (frequent updates) */
  RECENT_ACTIVITY: 1 * 60 * 1000,
  /** Online users - 30 seconds (real-time feel) */
  ONLINE_USERS: 30 * 1000,
  /** Badges - 10 minutes (rarely changes) */
  BADGES: 10 * 60 * 1000,
  /** Comments - 1 minute */
  COMMENTS: 1 * 60 * 1000,
} as const;

/**
 * Hook for fetching user dashboard data
 *
 * Fetches and caches the complete dashboard configuration for a user,
 * including block layout, widgets, and user preferences.
 *
 * @param userId - The user ID to fetch dashboard for
 * @returns React Query result object with dashboard data
 *
 * @example
 * ```typescript
 * const { data: dashboard, isLoading, error } = useDashboard(userId);
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 *
 * return <DashboardLayout widgets={dashboard.widgets} />;
 * ```
 */
export function useDashboard(userId: number) {
  return useQuery({
    queryKey: dashboardQueryKeys.dashboard(userId),
    queryFn: () => fetchUserDashboard(userId),
    staleTime: STALE_TIMES.DASHBOARD,
    enabled: userId > 0,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for fetching calendar widget data
 *
 * Fetches calendar events for the month view widget with optional
 * course or category filtering. Automatically refetches in background.
 *
 * @param courseId - Optional course ID to filter events
 * @param categoryId - Optional category ID to filter events
 * @returns React Query result object with calendar widget data
 *
 * @example
 * ```typescript
 * const { data: calendar, isLoading } = useCalendarWidget(courseId);
 *
 * return (
 *   <Calendar
 *     events={calendar?.events}
 *     month={calendar?.month}
 *     year={calendar?.year}
 *   />
 * );
 * ```
 */
export function useCalendarWidget(courseId?: CourseId, categoryId?: number) {
  return useQuery({
    queryKey: dashboardQueryKeys.calendar(courseId, categoryId),
    queryFn: () => fetchCalendarWidget(courseId, categoryId),
    staleTime: STALE_TIMES.CALENDAR,
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook for fetching upcoming events
 *
 * Fetches upcoming calendar events with 5-minute stale time for balance
 * between freshness and performance.
 *
 * @param courseId - Optional course ID to filter events
 * @param categoryId - Optional category ID to filter events
 * @returns React Query result object with upcoming events data
 *
 * @example
 * ```typescript
 * const { data: events, refetch } = useUpcomingEvents(courseId);
 *
 * return (
 *   <EventList
 *     events={events?.events}
 *     hasMore={events?.hasMore}
 *     onRefresh={refetch}
 *   />
 * );
 * ```
 */
export function useUpcomingEvents(courseId?: CourseId, categoryId?: number) {
  return useQuery({
    queryKey: dashboardQueryKeys.upcomingEvents(courseId, categoryId),
    queryFn: () => fetchUpcomingEvents(courseId, categoryId),
    staleTime: STALE_TIMES.UPCOMING_EVENTS,
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook for fetching timeline data
 *
 * Fetches timeline activities with user preference support for sort order,
 * filter criteria, and item limit. Uses 2-minute stale time for timely
 * deadline updates.
 *
 * @param preferences - Optional timeline preferences (sort, filter, limit)
 * @returns React Query result object with timeline data
 *
 * @example
 * ```typescript
 * const { data: timeline, isLoading } = useTimeline({
 *   sort: 'sortbydates',
 *   filter: 'next7days',
 *   limit: 10
 * });
 *
 * return <Timeline items={timeline?.items} />;
 * ```
 */
export function useTimeline(preferences?: TimelinePreferences) {
  return useQuery({
    queryKey: dashboardQueryKeys.timeline(preferences),
    queryFn: () => fetchTimeline(preferences),
    staleTime: STALE_TIMES.TIMELINE,
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook for fetching course overview data
 *
 * Fetches course cards with progress, enrollment, and access info.
 * Supports grouping, sorting, view mode, and paging preferences.
 *
 * @param preferences - Optional course overview preferences
 * @returns React Query result object with course overview data
 *
 * @example
 * ```typescript
 * const { data: overview, isLoading } = useCourseOverview({
 *   grouping: 'inprogress',
 *   sort: 'lastaccessed',
 *   view: 'card',
 *   paging: 12
 * });
 *
 * return <CourseGrid courses={overview?.courses} />;
 * ```
 */
export function useCourseOverview(preferences?: CourseOverviewPreferences) {
  return useQuery({
    queryKey: dashboardQueryKeys.courseOverview(preferences),
    queryFn: () => fetchCourseOverview(preferences),
    staleTime: STALE_TIMES.COURSE_OVERVIEW,
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook for fetching recent activity
 *
 * Fetches recent activity within a course context. Uses 1-minute stale
 * time to show timely updates for forum posts, submissions, etc.
 *
 * @param courseId - The course ID to fetch activity for
 * @param timeStart - Optional Unix timestamp to filter activity from
 * @returns React Query result object with recent activity data
 *
 * @example
 * ```typescript
 * const { data: activity, isLoading } = useRecentActivity(courseId);
 *
 * return <ActivityFeed items={activity?.items} />;
 * ```
 */
export function useRecentActivity(courseId: CourseId, timeStart?: number) {
  return useQuery({
    queryKey: dashboardQueryKeys.recentActivity(courseId, timeStart),
    queryFn: () => fetchRecentActivity(courseId, timeStart),
    staleTime: STALE_TIMES.RECENT_ACTIVITY,
    enabled: courseId > 0,
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook for fetching online users
 *
 * Fetches list of users currently active with 30-second stale time
 * for a real-time feel. Automatically refetches in background.
 *
 * @param courseId - Optional course ID to filter users
 * @param groupId - Optional group ID to filter users
 * @returns React Query result object with online users data
 *
 * @example
 * ```typescript
 * const { data: onlineUsers, isLoading } = useOnlineUsers(courseId);
 *
 * return (
 *   <OnlineUsersList
 *     users={onlineUsers?.users}
 *     count={onlineUsers?.count}
 *   />
 * );
 * ```
 */
export function useOnlineUsers(courseId?: CourseId, groupId?: number) {
  return useQuery({
    queryKey: dashboardQueryKeys.onlineUsers(courseId, groupId),
    queryFn: () => fetchOnlineUsers(courseId, groupId),
    staleTime: STALE_TIMES.ONLINE_USERS,
    refetchInterval: STALE_TIMES.ONLINE_USERS, // Auto-refetch for real-time feel
    retry: 1,
    retryDelay: 500,
  });
}

/**
 * Hook for fetching user badges
 *
 * Fetches badges earned by a user with 10-minute stale time since
 * badges rarely change frequently.
 *
 * @param userId - The user ID to fetch badges for
 * @returns React Query result object with badges data
 *
 * @example
 * ```typescript
 * const { data: badges, isLoading } = useBadges(userId);
 *
 * return <BadgeGallery badges={badges?.badges} />;
 * ```
 */
export function useBadges(userId: number) {
  return useQuery({
    queryKey: dashboardQueryKeys.badges(userId),
    queryFn: () => fetchBadges(userId),
    staleTime: STALE_TIMES.BADGES,
    enabled: userId > 0,
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook for fetching recent comments
 *
 * Fetches recent comment activity with optional context filtering.
 * Uses 1-minute stale time for timely updates.
 *
 * @param contextId - Optional context ID to filter comments
 * @returns React Query result object with comments data
 *
 * @example
 * ```typescript
 * const { data: comments, isLoading } = useComments(contextId);
 *
 * return <CommentsList comments={comments?.comments} />;
 * ```
 */
export function useComments(contextId?: number) {
  return useQuery({
    queryKey: dashboardQueryKeys.comments(contextId),
    queryFn: () => fetchComments(contextId),
    staleTime: STALE_TIMES.COMMENTS,
    retry: 2,
    retryDelay: 1000,
  });
}

// ============================================================================
// Type exports summary
// ============================================================================
//
// The following types are exported from this module and available for use
// in consuming components:
//
// Response Data Types (defined in this module):
// - CalendarWidgetData: Month view calendar data with events
// - UpcomingEventsData: Upcoming calendar events
// - TimelineData: Timeline items with preferences
// - CourseOverviewData: Course cards with progress
// - RecentActivityData: Recent activity items
// - OnlineUsersData: Active users list
// - BadgesData: User badges
// - CommentsData: Recent comments
// - WidgetConfigUpdate: Widget configuration update request
//
// These types are already exported at their definition points above.
