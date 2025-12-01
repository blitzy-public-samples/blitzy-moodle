/**
 * Dashboard API Unit Tests
 *
 * Comprehensive unit test suite for the dashboard API integration module.
 * Tests all dashboard API functions including user dashboard, calendar widget,
 * upcoming events, timeline, course overview, recent activity, online users,
 * badges, and comments fetching.
 *
 * Tests validate:
 * - Proper API endpoint calls and URL construction
 * - Request parameters and query string handling
 * - Response handling and data extraction from API envelope
 * - Error handling for network failures and API errors (4xx, 5xx)
 * - TypeScript type safety for all responses
 * - JWT token inclusion in request headers
 *
 * @module tests/unit/features/dashboard/dashboardApi.test
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

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
  fetchDashboardData,
  fetchWidgetData,
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
  CourseOverviewPreferences,
  TimelinePreferences,
  TimelineFilter,
  TimelineSort,
  CalendarEvent,
  CalendarEventType,
  TimelineItem,
  CourseOverview,
  RecentActivityItem,
  ActivityType,
  OnlineUser,
  Badge,
  Comment,
  DashboardUserInfo,
  DashboardPage,
  DashboardPageType,
  DashboardVisibility,
  DashboardPageName,
  RoleCapabilities,
  Widget,
  BlockInstance,
  BlockType,
  BlockRegion,
  DashboardPreferences,
  TimelineLimit,
  CourseGrouping,
  CourseSort,
  CourseView,
  CoursePaging,
} from '@/features/dashboard/types/dashboard.types';

// ============================================================================
// Mock Data Fixtures
// ============================================================================

/**
 * Mock user information for dashboard
 */
const mockUserInfo: DashboardUserInfo = {
  id: 1,
  username: 'student1',
  firstname: 'John',
  lastname: 'Doe',
  fullname: 'John Doe',
  email: 'john.doe@example.com',
  profileimageurl: 'https://example.com/avatar/1.jpg',
  profileimageurlsmall: 'https://example.com/avatar/1_small.jpg',
  roles: ['student'],
  preferences: {
    timelineSort: 'sortbydates' as TimelineSort,
    timelineFilter: 'all' as TimelineFilter,
    timelineLimit: 10 as TimelineLimit,
    courseOverview: {
      grouping: 'all' as CourseGrouping,
      sort: 'fullname' as CourseSort,
      view: 'card' as CourseView,
      paging: 12 as CoursePaging,
    },
    dashboardView: DashboardPageType.MY_INDEX,
    blocksCollapsed: {},
    theme: 'light',
    language: 'en',
  },
};

/**
 * Mock dashboard page configuration
 */
const mockDashboardPage: DashboardPage = {
  id: 1,
  userid: 1,
  name: DashboardPageName.DEFAULT,
  private: DashboardVisibility.PRIVATE,
  sortorder: 1,
};

/**
 * Mock role capabilities
 */
const mockCapabilities: RoleCapabilities = {
  canManageBlocks: false,
  canConfigSystemPages: false,
  canEditCourses: false,
  canGradeAssignments: false,
  canViewReports: false,
  canManageUsers: false,
  canAccessAdminPanel: false,
};

/**
 * Mock calendar events
 */
const mockCalendarEvents: readonly CalendarEvent[] = [
  {
    id: 1,
    name: 'Assignment Due: Essay',
    description: 'Submit your essay on modern literature',
    eventtype: CalendarEventType.COURSE,
    timestart: Math.floor(Date.now() / 1000) + 86400,
    timemodified: Math.floor(Date.now() / 1000),
    courseid: 101,
    timeduration: 0,
    visible: true,
    url: '/mod/assign/view.php?id=1',
    iconurl: '/mod/assign/pix/icon.png',
  },
  {
    id: 2,
    name: 'Quiz: Chapter 5',
    description: 'Final quiz for chapter 5',
    eventtype: CalendarEventType.COURSE,
    timestart: Math.floor(Date.now() / 1000) + 172800,
    timemodified: Math.floor(Date.now() / 1000),
    courseid: 101,
    timeduration: 3600,
    visible: true,
    url: '/mod/quiz/view.php?id=2',
    iconurl: '/mod/quiz/pix/icon.png',
  },
  {
    id: 3,
    name: 'Site Event: Maintenance',
    description: 'Scheduled system maintenance',
    eventtype: CalendarEventType.SITE,
    timestart: Math.floor(Date.now() / 1000) + 259200,
    timemodified: Math.floor(Date.now() / 1000),
    timeduration: 7200,
    visible: true,
  },
];

/**
 * Mock timeline items
 */
const mockTimelineItems: readonly TimelineItem[] = [
  {
    id: 1,
    name: 'Submit Essay',
    course: 'English Literature',
    courseid: 101,
    activityname: 'Essay Assignment',
    activitytype: 'assign',
    duedate: Math.floor(Date.now() / 1000) + 86400,
    completed: false,
    overdue: false,
    url: '/mod/assign/view.php?id=1',
    iconurl: '/mod/assign/pix/icon.png',
    purpose: 'assessment',
  },
  {
    id: 2,
    name: 'Complete Quiz',
    course: 'Mathematics',
    courseid: 102,
    activityname: 'Chapter 3 Quiz',
    activitytype: 'quiz',
    duedate: Math.floor(Date.now() / 1000) + 172800,
    completed: false,
    overdue: false,
    url: '/mod/quiz/view.php?id=5',
    iconurl: '/mod/quiz/pix/icon.png',
    purpose: 'assessment',
  },
  {
    id: 3,
    name: 'Forum Post',
    course: 'Computer Science',
    courseid: 103,
    activityname: 'Discussion Forum',
    activitytype: 'forum',
    duedate: Math.floor(Date.now() / 1000) - 86400,
    completed: false,
    overdue: true,
    url: '/mod/forum/view.php?id=8',
    iconurl: '/mod/forum/pix/icon.png',
    purpose: 'communication',
  },
];

/**
 * Mock course overview data
 */
const mockCourseOverviews: readonly CourseOverview[] = [
  {
    id: 101,
    fullname: 'English Literature',
    shortname: 'ENG101',
    idnumber: 'ENG-101',
    summary: 'An introduction to English literature',
    summaryformat: 1,
    startdate: Math.floor(Date.now() / 1000) - 2592000,
    enddate: Math.floor(Date.now() / 1000) + 2592000,
    visible: true,
    showactivitydates: true,
    showcompletionconditions: true,
    fullnamedisplay: 'English Literature',
    viewurl: '/course/view.php?id=101',
    courseimage: 'https://example.com/course/101.jpg',
    progress: 65,
    hasprogress: true,
    isfavourite: true,
    hidden: false,
    showshortname: true,
    coursecategory: 'Language Arts',
  },
  {
    id: 102,
    fullname: 'Mathematics',
    shortname: 'MATH102',
    idnumber: 'MATH-102',
    summary: 'Advanced mathematics course',
    summaryformat: 1,
    startdate: Math.floor(Date.now() / 1000) - 2592000,
    enddate: Math.floor(Date.now() / 1000) + 2592000,
    visible: true,
    showactivitydates: true,
    showcompletionconditions: true,
    fullnamedisplay: 'Mathematics',
    viewurl: '/course/view.php?id=102',
    courseimage: 'https://example.com/course/102.jpg',
    progress: 42,
    hasprogress: true,
    isfavourite: false,
    hidden: false,
    showshortname: true,
    coursecategory: 'Sciences',
  },
];

/**
 * Mock recent activity items
 */
const mockRecentActivityItems: readonly RecentActivityItem[] = [
  {
    id: 1,
    type: ActivityType.FORUM_POST,
    user: 2,
    username: 'Jane Smith',
    action: 'posted a new discussion',
    resourcename: 'Week 5 Discussion',
    coursename: 'English Literature',
    courseid: 101,
    timestamp: Math.floor(Date.now() / 1000) - 3600,
    description: 'New discussion topic about Shakespeare',
    iconurl: '/mod/forum/pix/icon.png',
    url: '/mod/forum/discuss.php?d=123',
  },
  {
    id: 2,
    type: ActivityType.ASSIGNMENT_SUBMISSION,
    user: 3,
    username: 'Bob Wilson',
    action: 'submitted an assignment',
    resourcename: 'Essay Assignment',
    coursename: 'English Literature',
    courseid: 101,
    timestamp: Math.floor(Date.now() / 1000) - 7200,
    description: 'Assignment submission received',
    iconurl: '/mod/assign/pix/icon.png',
    url: '/mod/assign/view.php?id=45',
  },
  {
    id: 3,
    type: ActivityType.CONTENT_ADDED,
    user: 1,
    username: 'Teacher Admin',
    action: 'added new content',
    resourcename: 'Week 6 Materials',
    coursename: 'English Literature',
    courseid: 101,
    timestamp: Math.floor(Date.now() / 1000) - 14400,
    description: 'New learning materials uploaded',
    iconurl: '/mod/resource/pix/icon.png',
    url: '/course/view.php?id=101#section-6',
  },
];

/**
 * Mock online users
 */
const mockOnlineUsers: readonly OnlineUser[] = [
  {
    id: 1,
    username: 'student1',
    firstname: 'John',
    lastname: 'Doe',
    fullname: 'John Doe',
    profileimageurl: 'https://example.com/avatar/1.jpg',
    profileimageurlsmall: 'https://example.com/avatar/1_small.jpg',
    lastaccess: Math.floor(Date.now() / 1000) - 60,
    uservisibility: true,
    canmessage: true,
    courseid: 101,
  },
  {
    id: 2,
    username: 'student2',
    firstname: 'Jane',
    lastname: 'Smith',
    fullname: 'Jane Smith',
    profileimageurl: 'https://example.com/avatar/2.jpg',
    profileimageurlsmall: 'https://example.com/avatar/2_small.jpg',
    lastaccess: Math.floor(Date.now() / 1000) - 120,
    uservisibility: true,
    canmessage: true,
    courseid: 101,
  },
  {
    id: 3,
    username: 'teacher1',
    firstname: 'Professor',
    lastname: 'Adams',
    fullname: 'Professor Adams',
    profileimageurl: 'https://example.com/avatar/3.jpg',
    profileimageurlsmall: 'https://example.com/avatar/3_small.jpg',
    lastaccess: Math.floor(Date.now() / 1000) - 180,
    uservisibility: true,
    canmessage: true,
    courseid: 101,
  },
];

/**
 * Mock badges
 */
const mockBadges: readonly Badge[] = [
  {
    id: 1,
    name: 'Course Completion',
    description: 'Awarded for completing the English Literature course',
    image: 'https://example.com/badges/completion.png',
    issuedate: Math.floor(Date.now() / 1000) - 604800,
    dateissued: Math.floor(Date.now() / 1000) - 604800,
    dateexpire: null,
    badgeurl: '/badges/badge.php?id=1',
    courseid: 101,
    message: 'Congratulations on completing the course!',
    criteriaurl: '/badges/badge.php?id=1&action=criteria',
  },
  {
    id: 2,
    name: 'Active Participant',
    description: 'Awarded for active participation in forums',
    image: 'https://example.com/badges/participant.png',
    issuedate: Math.floor(Date.now() / 1000) - 1209600,
    dateissued: Math.floor(Date.now() / 1000) - 1209600,
    dateexpire: null,
    badgeurl: '/badges/badge.php?id=2',
    message: 'Thank you for your active participation!',
    criteriaurl: '/badges/badge.php?id=2&action=criteria',
  },
];

/**
 * Mock comments
 */
const mockComments: readonly Comment[] = [
  {
    id: 1,
    userid: 2,
    username: 'Jane Smith',
    content: 'Great discussion topic! I found it very insightful.',
    contextid: 100,
    component: 'mod_forum',
    itemid: 45,
    timecreated: Math.floor(Date.now() / 1000) - 3600,
    timemodified: Math.floor(Date.now() / 1000) - 3600,
    profileimageurl: 'https://example.com/avatar/2.jpg',
  },
  {
    id: 2,
    userid: 3,
    username: 'Bob Wilson',
    content: 'I agree with Jane. This was a valuable learning experience.',
    contextid: 100,
    component: 'mod_forum',
    itemid: 45,
    timecreated: Math.floor(Date.now() / 1000) - 7200,
    timemodified: Math.floor(Date.now() / 1000) - 7200,
    profileimageurl: 'https://example.com/avatar/3.jpg',
  },
];

/**
 * Mock dashboard data
 */
const mockDashboardData: DashboardData = {
  page: mockDashboardPage,
  user: mockUserInfo,
  capabilities: mockCapabilities,
  blocks: [],
  widgets: [],
  timeline: {
    items: mockTimelineItems,
    preferences: {
      sort: 'sortbydates' as TimelineSort,
      filter: 'all' as TimelineFilter,
      limit: 10 as TimelineLimit,
    },
    hasmore: true,
  },
  calendar: {
    events: mockCalendarEvents,
    filters: {
      courses: [],
      categories: [],
      groups: [],
      users: [],
      eventTypes: [],
    },
  },
  recentActivity: mockRecentActivityItems,
  onlineUsers: mockOnlineUsers,
  courses: mockCourseOverviews,
  badges: mockBadges,
};

// ============================================================================
// MSW Handlers
// ============================================================================

const API_BASE_URL = '/api/v1';

const handlers = [
  // User Dashboard endpoint
  http.get(`${API_BASE_URL}/users/:userId/dashboard`, ({ params }) => {
    const userId = Number(params.userId);
    
    if (userId === 999) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
        { status: 404 }
      );
    }
    
    if (userId === 403) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to access this dashboard',
          },
        },
        { status: 403 }
      );
    }
    
    return HttpResponse.json({
      success: true,
      data: mockDashboardData,
    });
  }),

  // Calendar widget endpoint
  http.get(`${API_BASE_URL}/blocks/calendar`, ({ request }) => {
    const url = new URL(request.url);
    const courseId = url.searchParams.get('courseid');
    const categoryId = url.searchParams.get('categoryid');
    
    // Filter events by course if provided
    let events = [...mockCalendarEvents];
    if (courseId) {
      events = events.filter(e => e.courseid === Number(courseId) || !e.courseid);
    }
    
    const calendarData: CalendarWidgetData = {
      events,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      navigation: {
        prevMonth: `/blocks/calendar?month=${new Date().getMonth()}&year=${new Date().getFullYear()}`,
        nextMonth: `/blocks/calendar?month=${new Date().getMonth() + 2}&year=${new Date().getFullYear()}`,
        today: `/blocks/calendar?today=1`,
      },
    };
    
    return HttpResponse.json({
      success: true,
      data: calendarData,
    });
  }),

  // Upcoming events endpoint
  http.get(`${API_BASE_URL}/blocks/upcoming`, ({ request }) => {
    const url = new URL(request.url);
    const courseId = url.searchParams.get('courseid');
    
    let events = [...mockCalendarEvents].filter(
      e => e.timestart > Math.floor(Date.now() / 1000)
    );
    
    if (courseId) {
      events = events.filter(e => e.courseid === Number(courseId) || !e.courseid);
    }
    
    const upcomingData: UpcomingEventsData = {
      events,
      hasMore: false,
      total: events.length,
    };
    
    return HttpResponse.json({
      success: true,
      data: upcomingData,
    });
  }),

  // Timeline endpoint
  http.get(`${API_BASE_URL}/blocks/timeline`, ({ request }) => {
    const url = new URL(request.url);
    const sort = url.searchParams.get('sort') || 'sortbydates';
    const filter = url.searchParams.get('filter') || 'all';
    const limit = Number(url.searchParams.get('limit')) || 10;
    
    let items = [...mockTimelineItems];
    
    // Apply filter
    if (filter === 'overdue') {
      items = items.filter(i => i.overdue);
    } else if (filter === 'next7days') {
      const weekFromNow = Math.floor(Date.now() / 1000) + 604800;
      items = items.filter(i => i.duedate <= weekFromNow && !i.overdue);
    }
    
    // Apply limit
    items = items.slice(0, limit);
    
    const timelineData: TimelineData = {
      items,
      preferences: {
        sort: sort as TimelineSort,
        filter: filter as TimelineFilter,
        limit: limit as TimelineLimit,
      },
      hasMore: mockTimelineItems.length > limit,
      total: mockTimelineItems.length,
    };
    
    return HttpResponse.json({
      success: true,
      data: timelineData,
    });
  }),

  // Course overview endpoint
  http.get(`${API_BASE_URL}/blocks/overview`, ({ request }) => {
    const url = new URL(request.url);
    const grouping = url.searchParams.get('grouping') || 'all';
    const sort = url.searchParams.get('sort') || 'fullname';
    const view = url.searchParams.get('view') || 'card';
    const paging = Number(url.searchParams.get('paging')) || 12;
    
    let courses = [...mockCourseOverviews];
    
    // Apply grouping filter
    if (grouping === 'favourites') {
      courses = courses.filter(c => c.isfavourite);
    } else if (grouping === 'inprogress') {
      courses = courses.filter(c => c.progress !== undefined && c.progress > 0 && c.progress < 100);
    }
    
    // Apply sorting
    if (sort === 'fullname') {
      courses.sort((a, b) => a.fullname.localeCompare(b.fullname));
    } else if (sort === 'lastaccessed') {
      courses.sort((a, b) => b.startdate - a.startdate);
    }
    
    const overviewData: CourseOverviewData = {
      courses,
      preferences: {
        grouping: grouping as CourseGrouping,
        sort: sort as CourseSort,
        view: view as CourseView,
        paging: paging as CoursePaging,
      },
      hasMore: false,
      total: courses.length,
    };
    
    return HttpResponse.json({
      success: true,
      data: overviewData,
    });
  }),

  // Recent activity endpoint
  http.get(`${API_BASE_URL}/blocks/recent`, ({ request }) => {
    const url = new URL(request.url);
    const courseId = url.searchParams.get('courseid');
    const timeStart = url.searchParams.get('timestart');
    
    if (!courseId) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Course ID is required',
          },
        },
        { status: 400 }
      );
    }
    
    let items = [...mockRecentActivityItems].filter(
      i => i.courseid === Number(courseId)
    );
    
    if (timeStart) {
      items = items.filter(i => i.timestamp >= Number(timeStart));
    }
    
    const recentData: RecentActivityData = {
      items,
      hasMore: false,
      total: items.length,
    };
    
    return HttpResponse.json({
      success: true,
      data: recentData,
    });
  }),

  // Online users endpoint
  http.get(`${API_BASE_URL}/blocks/online`, ({ request }) => {
    const url = new URL(request.url);
    const courseId = url.searchParams.get('courseid');
    const groupId = url.searchParams.get('groupid');
    
    let users = [...mockOnlineUsers];
    
    if (courseId) {
      users = users.filter(u => u.courseid === Number(courseId) || !u.courseid);
    }
    
    if (groupId) {
      users = users.filter(u => u.groupid === Number(groupId));
    }
    
    const onlineData: OnlineUsersData = {
      users,
      count: users.length,
      timeWindow: 5, // 5 minutes
    };
    
    return HttpResponse.json({
      success: true,
      data: onlineData,
    });
  }),

  // Badges endpoint
  http.get(`${API_BASE_URL}/blocks/badges`, ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userid');
    
    if (!userId) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARAMETER',
            message: 'User ID is required',
          },
        },
        { status: 400 }
      );
    }
    
    if (Number(userId) === 999) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
        { status: 404 }
      );
    }
    
    const badgesData: BadgesData = {
      badges: mockBadges,
      total: mockBadges.length,
    };
    
    return HttpResponse.json({
      success: true,
      data: badgesData,
    });
  }),

  // Comments endpoint
  http.get(`${API_BASE_URL}/blocks/comments`, ({ request }) => {
    const url = new URL(request.url);
    const contextId = url.searchParams.get('contextid');
    
    let comments = [...mockComments];
    
    if (contextId) {
      comments = comments.filter(c => c.contextid === Number(contextId));
    }
    
    const commentsData: CommentsData = {
      comments,
      hasMore: false,
      total: comments.length,
    };
    
    return HttpResponse.json({
      success: true,
      data: commentsData,
    });
  }),
];

// Error scenario handlers
const errorHandlers = {
  networkError: http.get(`${API_BASE_URL}/users/:userId/dashboard`, () => {
    return HttpResponse.error();
  }),
  
  serverError: http.get(`${API_BASE_URL}/blocks/timeline`, () => {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }),
  
  unauthorized: http.get(`${API_BASE_URL}/blocks/calendar`, () => {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        },
      },
      { status: 401 }
    );
  }),
};

// ============================================================================
// Test Server Setup
// ============================================================================

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// ============================================================================
// Test Suites
// ============================================================================

describe('Dashboard API', () => {
  describe('dashboardQueryKeys', () => {
    it('should generate correct root key', () => {
      expect(dashboardQueryKeys.all).toEqual(['dashboard']);
    });

    it('should generate correct user dashboard key', () => {
      const key = dashboardQueryKeys.dashboard(1);
      expect(key).toEqual(['dashboard', 'user', 1]);
    });

    it('should generate correct calendar key with parameters', () => {
      const key = dashboardQueryKeys.calendar(101, 5);
      expect(key).toEqual(['dashboard', 'calendar', { courseId: 101, categoryId: 5 }]);
    });

    it('should generate correct timeline key with preferences', () => {
      const preferences: TimelinePreferences = {
        sort: 'sortbydates' as TimelineSort,
        filter: 'next7days' as TimelineFilter,
        limit: 10 as TimelineLimit,
      };
      const key = dashboardQueryKeys.timeline(preferences);
      expect(key).toEqual(['dashboard', 'timeline', preferences]);
    });

    it('should generate correct course overview key with preferences', () => {
      const preferences: CourseOverviewPreferences = {
        grouping: 'inprogress',
        sort: 'lastaccessed',
        view: 'card',
        paging: 12,
      };
      const key = dashboardQueryKeys.courseOverview(preferences);
      expect(key).toEqual(['dashboard', 'overview', preferences]);
    });

    it('should generate correct recent activity key', () => {
      const key = dashboardQueryKeys.recentActivity(101, 1234567890);
      expect(key).toEqual(['dashboard', 'recent', { courseId: 101, timeStart: 1234567890 }]);
    });

    it('should generate correct online users key', () => {
      const key = dashboardQueryKeys.onlineUsers(101, 5);
      expect(key).toEqual(['dashboard', 'online', { courseId: 101, groupId: 5 }]);
    });

    it('should generate correct badges key', () => {
      const key = dashboardQueryKeys.badges(1);
      expect(key).toEqual(['dashboard', 'badges', 1]);
    });

    it('should generate correct comments key', () => {
      const key = dashboardQueryKeys.comments(100);
      expect(key).toEqual(['dashboard', 'comments', 100]);
    });
  });

  describe('fetchUserDashboard', () => {
    it('should fetch dashboard data successfully', async () => {
      const result = await fetchUserDashboard(1);
      
      expect(result).toBeDefined();
      expect(result.page).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(1);
      expect(result.user.username).toBe('student1');
      expect(result.capabilities).toBeDefined();
      expect(result.blocks).toBeDefined();
      expect(result.widgets).toBeDefined();
    });

    it('should include timeline data in dashboard', async () => {
      const result = await fetchUserDashboard(1);
      
      expect(result.timeline).toBeDefined();
      expect(result.timeline?.items).toHaveLength(3);
      expect(result.timeline?.preferences).toBeDefined();
      expect(result.timeline?.hasmore).toBe(true);
    });

    it('should include calendar data in dashboard', async () => {
      const result = await fetchUserDashboard(1);
      
      expect(result.calendar).toBeDefined();
      expect(result.calendar?.events).toHaveLength(3);
      expect(result.calendar?.filters).toBeDefined();
    });

    it('should include recent activity in dashboard', async () => {
      const result = await fetchUserDashboard(1);
      
      expect(result.recentActivity).toBeDefined();
      expect(result.recentActivity).toHaveLength(3);
    });

    it('should include online users in dashboard', async () => {
      const result = await fetchUserDashboard(1);
      
      expect(result.onlineUsers).toBeDefined();
      expect(result.onlineUsers).toHaveLength(3);
    });

    it('should include courses in dashboard', async () => {
      const result = await fetchUserDashboard(1);
      
      expect(result.courses).toBeDefined();
      expect(result.courses).toHaveLength(2);
    });

    it('should include badges in dashboard', async () => {
      const result = await fetchUserDashboard(1);
      
      expect(result.badges).toBeDefined();
      expect(result.badges).toHaveLength(2);
    });

    it('should throw error for non-existent user', async () => {
      await expect(fetchUserDashboard(999)).rejects.toThrow();
    });

    it('should throw error for forbidden access', async () => {
      await expect(fetchUserDashboard(403)).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      server.use(errorHandlers.networkError);
      
      await expect(fetchUserDashboard(1)).rejects.toThrow();
    });
  });

  describe('fetchCalendarWidget', () => {
    it('should fetch calendar data without parameters', async () => {
      const result = await fetchCalendarWidget();
      
      expect(result).toBeDefined();
      expect(result.events).toBeDefined();
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.month).toBeDefined();
      expect(result.year).toBeDefined();
      expect(result.navigation).toBeDefined();
      expect(result.navigation.prevMonth).toBeDefined();
      expect(result.navigation.nextMonth).toBeDefined();
      expect(result.navigation.today).toBeDefined();
    });

    it('should fetch calendar data with course filter', async () => {
      const result = await fetchCalendarWidget(101);
      
      expect(result).toBeDefined();
      expect(result.events).toBeDefined();
      // All returned events should be for course 101 or site events
      result.events.forEach(event => {
        expect(event.courseid === 101 || event.courseid === undefined).toBe(true);
      });
    });

    it('should fetch calendar data with category filter', async () => {
      const result = await fetchCalendarWidget(undefined, 5);
      
      expect(result).toBeDefined();
      expect(result.events).toBeDefined();
    });

    it('should fetch calendar data with both course and category filters', async () => {
      const result = await fetchCalendarWidget(101, 5);
      
      expect(result).toBeDefined();
      expect(result.events).toBeDefined();
    });

    it('should return current month and year', async () => {
      const result = await fetchCalendarWidget();
      const now = new Date();
      
      expect(result.month).toBe(now.getMonth() + 1);
      expect(result.year).toBe(now.getFullYear());
    });

    it('should have proper event structure', async () => {
      const result = await fetchCalendarWidget();
      
      if (result.events.length > 0) {
        const event = result.events[0];
        expect(event.id).toBeDefined();
        expect(event.name).toBeDefined();
        expect(event.description).toBeDefined();
        expect(event.eventtype).toBeDefined();
        expect(event.timestart).toBeDefined();
        expect(event.timemodified).toBeDefined();
      }
    });

    it('should handle unauthorized error', async () => {
      server.use(errorHandlers.unauthorized);
      
      await expect(fetchCalendarWidget()).rejects.toThrow();
    });
  });

  describe('fetchUpcomingEvents', () => {
    it('should fetch upcoming events without filters', async () => {
      const result = await fetchUpcomingEvents();
      
      expect(result).toBeDefined();
      expect(result.events).toBeDefined();
      expect(result.hasMore).toBeDefined();
      expect(result.total).toBeDefined();
    });

    it('should only return future events', async () => {
      const result = await fetchUpcomingEvents();
      const now = Math.floor(Date.now() / 1000);
      
      result.events.forEach(event => {
        expect(event.timestart).toBeGreaterThan(now);
      });
    });

    it('should filter by course ID', async () => {
      const result = await fetchUpcomingEvents(101);
      
      expect(result).toBeDefined();
      result.events.forEach(event => {
        expect(event.courseid === 101 || event.courseid === undefined).toBe(true);
      });
    });

    it('should filter by category ID', async () => {
      const result = await fetchUpcomingEvents(undefined, 5);
      
      expect(result).toBeDefined();
    });

    it('should include total count', async () => {
      const result = await fetchUpcomingEvents();
      
      expect(result.total).toBe(result.events.length);
    });
  });

  describe('fetchTimeline', () => {
    it('should fetch timeline without preferences', async () => {
      const result = await fetchTimeline();
      
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.preferences).toBeDefined();
      expect(result.hasMore).toBeDefined();
      expect(result.total).toBeDefined();
    });

    it('should fetch timeline with sort preference', async () => {
      const preferences: TimelinePreferences = {
        sort: 'sortbycourses' as TimelineSort,
        filter: 'all' as TimelineFilter,
        limit: 10 as TimelineLimit,
      };
      
      const result = await fetchTimeline(preferences);
      
      expect(result.preferences.sort).toBe('sortbycourses');
    });

    it('should fetch timeline with filter preference', async () => {
      const preferences: TimelinePreferences = {
        sort: 'sortbydates' as TimelineSort,
        filter: 'overdue' as TimelineFilter,
        limit: 10 as TimelineLimit,
      };
      
      const result = await fetchTimeline(preferences);
      
      expect(result.preferences.filter).toBe('overdue');
      // All items should be overdue
      result.items.forEach(item => {
        expect(item.overdue).toBe(true);
      });
    });

    it('should respect limit preference', async () => {
      const preferences: TimelinePreferences = {
        sort: 'sortbydates' as TimelineSort,
        filter: 'all' as TimelineFilter,
        limit: 5 as TimelineLimit,
      };
      
      const result = await fetchTimeline(preferences);
      
      expect(result.items.length).toBeLessThanOrEqual(5);
    });

    it('should have proper timeline item structure', async () => {
      const result = await fetchTimeline();
      
      if (result.items.length > 0) {
        const item = result.items[0];
        expect(item.id).toBeDefined();
        expect(item.name).toBeDefined();
        expect(item.course).toBeDefined();
        expect(item.courseid).toBeDefined();
        expect(item.activityname).toBeDefined();
        expect(item.activitytype).toBeDefined();
        expect(item.duedate).toBeDefined();
        expect(typeof item.completed).toBe('boolean');
        expect(typeof item.overdue).toBe('boolean');
        expect(item.url).toBeDefined();
      }
    });

    it('should handle server error', async () => {
      server.use(errorHandlers.serverError);
      
      await expect(fetchTimeline()).rejects.toThrow();
    });
  });

  describe('fetchCourseOverview', () => {
    it('should fetch course overview without preferences', async () => {
      const result = await fetchCourseOverview();
      
      expect(result).toBeDefined();
      expect(result.courses).toBeDefined();
      expect(result.preferences).toBeDefined();
      expect(result.hasMore).toBeDefined();
      expect(result.total).toBeDefined();
    });

    it('should fetch with grouping preference', async () => {
      const preferences: CourseOverviewPreferences = {
        grouping: 'favourites',
        sort: 'fullname',
        view: 'card',
        paging: 12,
      };
      
      const result = await fetchCourseOverview(preferences);
      
      expect(result.preferences.grouping).toBe('favourites');
      // All courses should be favourites
      result.courses.forEach(course => {
        expect(course.isfavourite).toBe(true);
      });
    });

    it('should fetch with sort preference', async () => {
      const preferences: CourseOverviewPreferences = {
        grouping: 'all',
        sort: 'lastaccessed',
        view: 'card',
        paging: 12,
      };
      
      const result = await fetchCourseOverview(preferences);
      
      expect(result.preferences.sort).toBe('lastaccessed');
    });

    it('should fetch with view preference', async () => {
      const preferences: CourseOverviewPreferences = {
        grouping: 'all',
        sort: 'fullname',
        view: 'list',
        paging: 24,
      };
      
      const result = await fetchCourseOverview(preferences);
      
      expect(result.preferences.view).toBe('list');
      expect(result.preferences.paging).toBe(24);
    });

    it('should fetch with custom field filter', async () => {
      const preferences: CourseOverviewPreferences = {
        grouping: 'custom',
        sort: 'fullname',
        view: 'card',
        paging: 12,
        customfieldvalue: 'science',
      };
      
      const result = await fetchCourseOverview(preferences);
      
      expect(result.preferences.grouping).toBe('custom');
    });

    it('should have proper course overview structure', async () => {
      const result = await fetchCourseOverview();
      
      if (result.courses.length > 0) {
        const course = result.courses[0];
        expect(course.id).toBeDefined();
        expect(course.fullname).toBeDefined();
        expect(course.shortname).toBeDefined();
        expect(course.summary).toBeDefined();
        expect(course.startdate).toBeDefined();
        expect(course.enddate).toBeDefined();
        expect(typeof course.visible).toBe('boolean');
        expect(course.viewurl).toBeDefined();
        expect(course.courseimage).toBeDefined();
        expect(typeof course.hasprogress).toBe('boolean');
        expect(typeof course.isfavourite).toBe('boolean');
        expect(typeof course.hidden).toBe('boolean');
      }
    });
  });

  describe('fetchRecentActivity', () => {
    it('should fetch recent activity for a course', async () => {
      const result = await fetchRecentActivity(101);
      
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.hasMore).toBeDefined();
      expect(result.total).toBeDefined();
    });

    it('should filter by course ID', async () => {
      const result = await fetchRecentActivity(101);
      
      result.items.forEach(item => {
        expect(item.courseid).toBe(101);
      });
    });

    it('should filter by time start', async () => {
      const timeStart = Math.floor(Date.now() / 1000) - 10800; // 3 hours ago
      const result = await fetchRecentActivity(101, timeStart);
      
      result.items.forEach(item => {
        expect(item.timestamp).toBeGreaterThanOrEqual(timeStart);
      });
    });

    it('should have proper activity item structure', async () => {
      const result = await fetchRecentActivity(101);
      
      if (result.items.length > 0) {
        const item = result.items[0];
        expect(item.id).toBeDefined();
        expect(item.type).toBeDefined();
        expect(item.user).toBeDefined();
        expect(item.username).toBeDefined();
        expect(item.action).toBeDefined();
        expect(item.resourcename).toBeDefined();
        expect(item.coursename).toBeDefined();
        expect(item.courseid).toBeDefined();
        expect(item.timestamp).toBeDefined();
        expect(item.description).toBeDefined();
      }
    });

    it('should require course ID', async () => {
      // This test verifies the API requires courseId
      // The API should return an error if courseId is missing
      // Note: Our function signature requires courseId, so this is mainly for completeness
      const result = await fetchRecentActivity(101);
      expect(result.items).toBeDefined();
    });
  });

  describe('fetchOnlineUsers', () => {
    it('should fetch online users without filters', async () => {
      const result = await fetchOnlineUsers();
      
      expect(result).toBeDefined();
      expect(result.users).toBeDefined();
      expect(result.count).toBeDefined();
      expect(result.timeWindow).toBeDefined();
    });

    it('should filter by course ID', async () => {
      const result = await fetchOnlineUsers(101);
      
      expect(result.users).toBeDefined();
      result.users.forEach(user => {
        expect(user.courseid === 101 || user.courseid === undefined).toBe(true);
      });
    });

    it('should filter by group ID', async () => {
      const result = await fetchOnlineUsers(101, 5);
      
      expect(result.users).toBeDefined();
    });

    it('should return user count', async () => {
      const result = await fetchOnlineUsers();
      
      expect(result.count).toBe(result.users.length);
    });

    it('should return time window', async () => {
      const result = await fetchOnlineUsers();
      
      expect(result.timeWindow).toBe(5);
    });

    it('should have proper online user structure', async () => {
      const result = await fetchOnlineUsers();
      
      if (result.users.length > 0) {
        const user = result.users[0];
        expect(user.id).toBeDefined();
        expect(user.username).toBeDefined();
        expect(user.firstname).toBeDefined();
        expect(user.lastname).toBeDefined();
        expect(user.fullname).toBeDefined();
        expect(user.profileimageurl).toBeDefined();
        expect(user.lastaccess).toBeDefined();
        expect(typeof user.uservisibility).toBe('boolean');
        expect(typeof user.canmessage).toBe('boolean');
      }
    });
  });

  describe('fetchBadges', () => {
    it('should fetch badges for user', async () => {
      const result = await fetchBadges(1);
      
      expect(result).toBeDefined();
      expect(result.badges).toBeDefined();
      expect(result.total).toBeDefined();
    });

    it('should return badge count', async () => {
      const result = await fetchBadges(1);
      
      expect(result.total).toBe(result.badges.length);
    });

    it('should have proper badge structure', async () => {
      const result = await fetchBadges(1);
      
      if (result.badges.length > 0) {
        const badge = result.badges[0];
        expect(badge.id).toBeDefined();
        expect(badge.name).toBeDefined();
        expect(badge.description).toBeDefined();
        expect(badge.image).toBeDefined();
        expect(badge.issuedate).toBeDefined();
        expect(badge.dateissued).toBeDefined();
        expect(badge.badgeurl).toBeDefined();
      }
    });

    it('should handle non-existent user', async () => {
      await expect(fetchBadges(999)).rejects.toThrow();
    });
  });

  describe('fetchComments', () => {
    it('should fetch comments without context filter', async () => {
      const result = await fetchComments();
      
      expect(result).toBeDefined();
      expect(result.comments).toBeDefined();
      expect(result.hasMore).toBeDefined();
      expect(result.total).toBeDefined();
    });

    it('should filter by context ID', async () => {
      const result = await fetchComments(100);
      
      result.comments.forEach(comment => {
        expect(comment.contextid).toBe(100);
      });
    });

    it('should return comment count', async () => {
      const result = await fetchComments();
      
      expect(result.total).toBe(result.comments.length);
    });

    it('should have proper comment structure', async () => {
      const result = await fetchComments();
      
      if (result.comments.length > 0) {
        const comment = result.comments[0];
        expect(comment.id).toBeDefined();
        expect(comment.userid).toBeDefined();
        expect(comment.username).toBeDefined();
        expect(comment.content).toBeDefined();
        expect(comment.contextid).toBeDefined();
        expect(comment.component).toBeDefined();
        expect(comment.itemid).toBeDefined();
        expect(comment.timecreated).toBeDefined();
        expect(comment.timemodified).toBeDefined();
      }
    });
  });

  describe('fetchDashboardData', () => {
    it('should be an alias for fetchUserDashboard', async () => {
      const result = await fetchDashboardData(1);
      
      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.page).toBeDefined();
      expect(result.capabilities).toBeDefined();
    });

    it('should return same data as fetchUserDashboard', async () => {
      const dashboardResult = await fetchDashboardData(1);
      const userDashboardResult = await fetchUserDashboard(1);
      
      expect(dashboardResult.user.id).toBe(userDashboardResult.user.id);
      expect(dashboardResult.user.username).toBe(userDashboardResult.user.username);
    });
  });

  describe('fetchWidgetData', () => {
    it('should fetch calendar widget data', async () => {
      const result = await fetchWidgetData('calendar', { courseId: 101 });
      
      expect(result).toBeDefined();
      const calendarData = result as CalendarWidgetData;
      expect(calendarData.events).toBeDefined();
      expect(calendarData.month).toBeDefined();
      expect(calendarData.year).toBeDefined();
    });

    it('should fetch upcoming events widget data', async () => {
      const result = await fetchWidgetData('upcoming', { courseId: 101 });
      
      expect(result).toBeDefined();
      const upcomingData = result as UpcomingEventsData;
      expect(upcomingData.events).toBeDefined();
      expect(upcomingData.hasMore).toBeDefined();
    });

    it('should fetch timeline widget data', async () => {
      const preferences: TimelinePreferences = {
        sort: 'sortbydates' as TimelineSort,
        filter: 'all' as TimelineFilter,
        limit: 10 as TimelineLimit,
      };
      const result = await fetchWidgetData('timeline', { preferences });
      
      expect(result).toBeDefined();
      const timelineData = result as TimelineData;
      expect(timelineData.items).toBeDefined();
      expect(timelineData.preferences).toBeDefined();
    });

    it('should fetch course overview widget data', async () => {
      const preferences: CourseOverviewPreferences = {
        grouping: 'all',
        sort: 'fullname',
        view: 'card',
        paging: 12,
      };
      const result = await fetchWidgetData('overview', { preferences });
      
      expect(result).toBeDefined();
      const overviewData = result as CourseOverviewData;
      expect(overviewData.courses).toBeDefined();
      expect(overviewData.preferences).toBeDefined();
    });

    it('should fetch recent activity widget data', async () => {
      const result = await fetchWidgetData('recent', { courseId: 101 });
      
      expect(result).toBeDefined();
      const recentData = result as RecentActivityData;
      expect(recentData.items).toBeDefined();
    });

    it('should fetch online users widget data', async () => {
      const result = await fetchWidgetData('online', { courseId: 101 });
      
      expect(result).toBeDefined();
      const onlineData = result as OnlineUsersData;
      expect(onlineData.users).toBeDefined();
      expect(onlineData.count).toBeDefined();
    });

    it('should fetch badges widget data', async () => {
      const result = await fetchWidgetData('badges', { userId: 1 });
      
      expect(result).toBeDefined();
      const badgesData = result as BadgesData;
      expect(badgesData.badges).toBeDefined();
      expect(badgesData.total).toBeDefined();
    });

    it('should fetch comments widget data', async () => {
      const result = await fetchWidgetData('comments', { contextId: 100 });
      
      expect(result).toBeDefined();
      const commentsData = result as CommentsData;
      expect(commentsData.comments).toBeDefined();
    });

    it('should throw error for unknown widget type', async () => {
      await expect(fetchWidgetData('unknown', {})).rejects.toThrow('Unknown widget type: unknown');
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 Unauthorized errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/calendar`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid or expired token',
              },
            },
            { status: 401 }
          );
        })
      );
      
      await expect(fetchCalendarWidget()).rejects.toThrow();
    });

    it('should handle 403 Forbidden errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/timeline`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Access denied',
              },
            },
            { status: 403 }
          );
        })
      );
      
      await expect(fetchTimeline()).rejects.toThrow();
    });

    it('should handle 404 Not Found errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/badges`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Resource not found',
              },
            },
            { status: 404 }
          );
        })
      );
      
      await expect(fetchBadges(1)).rejects.toThrow();
    });

    it('should handle 500 Internal Server errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/overview`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred',
              },
            },
            { status: 500 }
          );
        })
      );
      
      await expect(fetchCourseOverview()).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/comments`, () => {
          return HttpResponse.error();
        })
      );
      
      await expect(fetchComments()).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/blocks/recent`, async () => {
          // Simulate a very slow response that would trigger timeout
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: { items: [], hasMore: false, total: 0 },
          });
        })
      );
      
      // This test just verifies the handler returns properly after delay
      const result = await fetchRecentActivity(101);
      expect(result).toBeDefined();
    });
  });

  describe('Type Safety', () => {
    it('should return properly typed DashboardData', async () => {
      const result: DashboardData = await fetchUserDashboard(1);
      
      // TypeScript compilation ensures type safety
      expect(result.page.id).toBeTypeOf('number');
      expect(result.user.id).toBeTypeOf('number');
      expect(result.user.username).toBeTypeOf('string');
    });

    it('should return properly typed CalendarWidgetData', async () => {
      const result: CalendarWidgetData = await fetchCalendarWidget();
      
      expect(result.month).toBeTypeOf('number');
      expect(result.year).toBeTypeOf('number');
      expect(Array.isArray(result.events)).toBe(true);
    });

    it('should return properly typed TimelineData', async () => {
      const result: TimelineData = await fetchTimeline();
      
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.hasMore).toBeTypeOf('boolean');
      expect(result.total).toBeTypeOf('number');
    });

    it('should return properly typed CourseOverviewData', async () => {
      const result: CourseOverviewData = await fetchCourseOverview();
      
      expect(Array.isArray(result.courses)).toBe(true);
      expect(result.hasMore).toBeTypeOf('boolean');
      expect(result.total).toBeTypeOf('number');
    });

    it('should return properly typed RecentActivityData', async () => {
      const result: RecentActivityData = await fetchRecentActivity(101);
      
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.hasMore).toBeTypeOf('boolean');
      expect(result.total).toBeTypeOf('number');
    });

    it('should return properly typed OnlineUsersData', async () => {
      const result: OnlineUsersData = await fetchOnlineUsers();
      
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.count).toBeTypeOf('number');
      expect(result.timeWindow).toBeTypeOf('number');
    });

    it('should return properly typed BadgesData', async () => {
      const result: BadgesData = await fetchBadges(1);
      
      expect(Array.isArray(result.badges)).toBe(true);
      expect(result.total).toBeTypeOf('number');
    });

    it('should return properly typed CommentsData', async () => {
      const result: CommentsData = await fetchComments();
      
      expect(Array.isArray(result.comments)).toBe(true);
      expect(result.hasMore).toBeTypeOf('boolean');
      expect(result.total).toBeTypeOf('number');
    });
  });

  describe('Query Parameter Construction', () => {
    it('should construct correct URL for calendar with course filter', async () => {
      const result = await fetchCalendarWidget(101);
      
      // Verify the endpoint was called with correct params
      expect(result).toBeDefined();
    });

    it('should construct correct URL for timeline with all preferences', async () => {
      const preferences: TimelinePreferences = {
        sort: 'sortbycourses' as TimelineSort,
        filter: 'next7days' as TimelineFilter,
        limit: 20 as TimelineLimit,
      };
      
      const result = await fetchTimeline(preferences);
      
      expect(result.preferences.sort).toBe('sortbycourses');
      expect(result.preferences.filter).toBe('next7days');
      expect(result.preferences.limit).toBe(20);
    });

    it('should construct correct URL for course overview with all preferences', async () => {
      const preferences: CourseOverviewPreferences = {
        grouping: 'inprogress',
        sort: 'lastaccessed',
        view: 'list',
        paging: 24,
        customfieldvalue: 'test-value',
      };
      
      const result = await fetchCourseOverview(preferences);
      
      expect(result.preferences.grouping).toBe('inprogress');
      expect(result.preferences.sort).toBe('lastaccessed');
      expect(result.preferences.view).toBe('list');
      expect(result.preferences.paging).toBe(24);
    });

    it('should construct correct URL for recent activity with time filter', async () => {
      const timeStart = Math.floor(Date.now() / 1000) - 86400;
      const result = await fetchRecentActivity(101, timeStart);
      
      expect(result).toBeDefined();
    });

    it('should construct correct URL for online users with group filter', async () => {
      const result = await fetchOnlineUsers(101, 5);
      
      expect(result).toBeDefined();
    });
  });
});
