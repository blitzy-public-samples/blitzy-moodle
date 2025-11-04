/**
 * TypeScript Type Definitions for Dashboard Feature
 * 
 * This file contains comprehensive type definitions for the Moodle dashboard feature,
 * including dashboard page configurations, widget/block types, user roles, calendar events,
 * timeline items, activity records, and API response shapes.
 * 
 * Based on Moodle's dashboard structure:
 * - public/my/index.php (dashboard page structure)
 * - public/my/lib.php (page constants and functions)
 * - public/blocks/timeline (timeline widget)
 * - public/blocks/calendar_month (calendar widget)
 * - public/blocks/online_users (online users widget)
 * - public/blocks/recent_activity (activity feed)
 * 
 * @package    react-frontend
 * @subpackage dashboard
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// ============================================================================
// User Role Types
// ============================================================================

/**
 * User role type representing different user permissions in Moodle
 */
export type UserRole = 'student' | 'teacher' | 'editingteacher' | 'manager' | 'admin' | 'guest';

/**
 * User information for dashboard context
 */
export interface DashboardUserInfo {
  readonly id: number;
  readonly username: string;
  readonly firstname: string;
  readonly lastname: string;
  readonly fullname: string;
  readonly email: string;
  readonly profileimageurl: string;
  readonly profileimageurlsmall: string;
  readonly roles: readonly UserRole[];
  readonly preferences: DashboardPreferences;
}

/**
 * Role capabilities for permission checking
 */
export interface RoleCapabilities {
  readonly canManageBlocks: boolean;
  readonly canConfigSystemPages: boolean;
  readonly canEditCourses: boolean;
  readonly canGradeAssignments: boolean;
  readonly canViewReports: boolean;
  readonly canManageUsers: boolean;
  readonly canAccessAdminPanel: boolean;
}

// ============================================================================
// Dashboard Page Types (from public/my/lib.php)
// ============================================================================

/**
 * Dashboard page type identifiers
 * Based on MY_PAGE_DEFAULT and MY_PAGE_COURSES constants
 */
export enum DashboardPageType {
  MY_INDEX = 'my-index',
  MY_COURSES = 'mycourses',
  USER_PROFILE = 'user-profile',
}

/**
 * Dashboard page visibility
 * Based on MY_PAGE_PUBLIC and MY_PAGE_PRIVATE constants
 */
export enum DashboardVisibility {
  PUBLIC = 0,
  PRIVATE = 1,
}

/**
 * Dashboard page name constants
 */
export enum DashboardPageName {
  DEFAULT = '__default',
  COURSES = '__courses',
}

/**
 * Dashboard page configuration
 * Represents a my_pages database record
 */
export interface DashboardPage {
  readonly id: number;
  readonly userid: number | null; // null for system default pages
  readonly name: DashboardPageName;
  readonly private: DashboardVisibility;
  readonly sortorder: number;
}

// ============================================================================
// Block/Widget Types (from public/blocks)
// ============================================================================

/**
 * Available block types in Moodle dashboard
 */
export enum BlockType {
  CALENDAR_MONTH = 'calendar_month',
  CALENDAR_UPCOMING = 'calendar_upcoming',
  TIMELINE = 'timeline',
  RECENT_ACTIVITY = 'recent_activity',
  ONLINE_USERS = 'online_users',
  MY_OVERVIEW = 'myoverview',
  BADGES = 'badges',
  COMMENTS = 'comments',
  PRIVATE_FILES = 'private_files',
  RSS_CLIENT = 'rss_client',
  BLOG_MENU = 'blog_menu',
  BLOG_TAGS = 'blog_tags',
  BLOG_RECENT = 'blog_recent',
  COURSE_OVERVIEW = 'course_overview',
  MENTEES = 'mentees',
  MESSAGES = 'messages',
  MY_PROFILE = 'myprofile',
  NAVIGATION = 'navigation',
  SETTINGS = 'settings',
  STARRED_COURSES = 'starredcourses',
  TAGS = 'tags',
  RECENTLYACCESSEDCOURSES = 'recentlyaccessedcourses',
  RECENTLYACCESSEDITEMS = 'recentlyaccesseditems',
}

/**
 * Block region positioning
 */
export type BlockRegion = 'content' | 'side-pre' | 'side-post';

/**
 * Block configuration from database
 */
export interface BlockConfiguration {
  readonly id: number;
  readonly blockname: BlockType;
  readonly parentcontextid: number;
  readonly showinsubcontexts: boolean;
  readonly requiredbytheme: boolean;
  readonly pagetypepattern: string;
  readonly subpagepattern: string | null;
  readonly defaultregion: BlockRegion;
  readonly defaultweight: number;
  readonly configdata: string | null; // Serialized configuration
  readonly visible: boolean;
}

/**
 * Block instance on a page
 */
export interface BlockInstance extends BlockConfiguration {
  readonly region: BlockRegion;
  readonly weight: number;
}

/**
 * Generic widget configuration for dashboard components
 */
export interface WidgetConfig {
  readonly id: string;
  readonly type: BlockType;
  readonly title: string;
  readonly position: {
    readonly region: BlockRegion;
    readonly order: number;
  };
  readonly visible: boolean;
  readonly collapsible: boolean;
  readonly collapsed: boolean;
  readonly config: Record<string, unknown>;
}

/**
 * Widget component props interface
 */
export interface Widget {
  readonly id: string;
  readonly type: BlockType;
  readonly title: string;
  readonly data: unknown; // Block-specific data
  readonly config: WidgetConfig;
}

// ============================================================================
// Calendar Event Types (from calendar blocks)
// ============================================================================

/**
 * Calendar event types
 */
export enum CalendarEventType {
  SITE = 'site',
  COURSE = 'course',
  CATEGORY = 'category',
  USER = 'user',
  GROUP = 'group',
}

/**
 * Calendar event structure
 */
export interface CalendarEvent {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly eventtype: CalendarEventType;
  readonly timestart: number; // Unix timestamp
  readonly timemodified: number; // Unix timestamp
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
 * Calendar filter options
 */
export interface CalendarFilter {
  readonly courses: readonly number[];
  readonly categories: readonly number[];
  readonly groups: readonly number[];
  readonly users: readonly number[];
  readonly eventTypes: readonly CalendarEventType[];
}

// ============================================================================
// Timeline Types (from public/blocks/timeline)
// ============================================================================

/**
 * Timeline filter options
 * Based on BLOCK_TIMELINE_FILTER_BY_* constants
 */
export enum TimelineFilter {
  ALL = 'all',
  OVERDUE = 'overdue',
  NEXT_7_DAYS = 'next7days',
  NEXT_30_DAYS = 'next30days',
  NEXT_3_MONTHS = 'next3months',
  NEXT_6_MONTHS = 'next6months',
}

/**
 * Timeline sort options
 * Based on BLOCK_TIMELINE_SORT_BY_* constants
 */
export enum TimelineSort {
  BY_DATES = 'sortbydates',
  BY_COURSES = 'sortbycourses',
}

/**
 * Timeline activity limit
 * Based on BLOCK_TIMELINE_ACTIVITIES_LIMIT_DEFAULT constant
 */
export type TimelineLimit = 5 | 10 | 15 | 20;

/**
 * Timeline user preferences
 */
export interface TimelinePreferences {
  sort: TimelineSort;
  filter: TimelineFilter;
  limit: TimelineLimit;
}

/**
 * Timeline activity item
 */
export interface TimelineItem {
  readonly id: number;
  readonly name: string;
  readonly course: string;
  readonly courseid: number;
  readonly activityname: string;
  readonly activitytype: string; // e.g., 'assign', 'quiz', 'forum'
  readonly duedate: number; // Unix timestamp
  readonly completed: boolean;
  readonly overdue: boolean;
  readonly url: string;
  readonly iconurl?: string;
  readonly purpose?: string;
}

// ============================================================================
// Activity Record Types (from recent_activity block)
// ============================================================================

/**
 * Activity type enumeration
 */
export enum ActivityType {
  FORUM_POST = 'forum_post',
  ASSIGNMENT_SUBMISSION = 'assignment_submission',
  QUIZ_ATTEMPT = 'quiz_attempt',
  GRADE_CHANGE = 'grade_change',
  USER_ENROLLMENT = 'user_enrollment',
  CONTENT_ADDED = 'content_added',
  CONTENT_UPDATED = 'content_updated',
  CONTENT_DELETED = 'content_deleted',
  COURSE_MODULE_CREATED = 'course_module_created',
  COURSE_MODULE_UPDATED = 'course_module_updated',
  COURSE_MODULE_DELETED = 'course_module_deleted',
}

/**
 * Recent activity item structure
 */
export interface RecentActivityItem {
  readonly id: number;
  readonly type: ActivityType;
  readonly user: number; // User ID
  readonly username: string;
  readonly action: string; // Human-readable action description
  readonly resourcename: string;
  readonly coursename: string;
  readonly courseid: number;
  readonly timestamp: number; // Unix timestamp
  readonly description: string;
  readonly iconurl?: string;
  readonly url?: string;
}

// ============================================================================
// Online Users Types (from public/blocks/online_users)
// ============================================================================

/**
 * Online user information
 */
export interface OnlineUser {
  readonly id: number;
  readonly username: string;
  readonly firstname: string;
  readonly lastname: string;
  readonly fullname: string;
  readonly profileimageurl: string;
  readonly profileimageurlsmall: string;
  readonly lastaccess: number; // Unix timestamp
  readonly uservisibility: boolean;
  readonly canmessage: boolean;
  readonly courseid?: number;
  readonly groupid?: number;
}

// ============================================================================
// Course Overview Types (from myoverview block)
// ============================================================================

/**
 * Course overview grouping options
 */
export type CourseGrouping = 'all' | 'inprogress' | 'future' | 'past' | 'favourites' | 'hidden' | 'custom';

/**
 * Course overview sort options
 */
export type CourseSort = 'fullname' | 'shortname' | 'lastaccessed' | 'timecreated';

/**
 * Course overview view mode
 */
export type CourseView = 'card' | 'list' | 'summary';

/**
 * Course overview paging preferences
 */
export type CoursePaging = 12 | 24 | 48 | 96;

/**
 * Course overview preferences
 */
export interface CourseOverviewPreferences {
  grouping: CourseGrouping;
  sort: CourseSort;
  view: CourseView;
  paging: CoursePaging;
  customfieldvalue?: string;
}

/**
 * Course summary for overview widget
 */
export interface CourseOverview {
  readonly id: number;
  readonly fullname: string;
  readonly shortname: string;
  readonly idnumber: string;
  readonly summary: string;
  readonly summaryformat: number;
  readonly startdate: number;
  readonly enddate: number;
  readonly visible: boolean;
  readonly showactivitydates: boolean;
  readonly showcompletionconditions: boolean;
  readonly fullnamedisplay: string;
  readonly viewurl: string;
  readonly courseimage: string;
  readonly progress?: number; // Percentage
  readonly hasprogress: boolean;
  readonly isfavourite: boolean;
  readonly hidden: boolean;
  readonly showshortname: boolean;
  readonly coursecategory: string;
}

// ============================================================================
// Badge Types (from badges block)
// ============================================================================

/**
 * Badge information
 */
export interface Badge {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly image: string;
  readonly issuedate: number; // Unix timestamp
  readonly dateissued: number; // Unix timestamp
  readonly dateexpire: number | null; // Unix timestamp or null if no expiry
  readonly badgeurl: string;
  readonly courseid?: number;
  readonly message?: string;
  readonly criteriaurl?: string;
}

// ============================================================================
// Comment Types (from comments block)
// ============================================================================

/**
 * Comment information
 */
export interface Comment {
  readonly id: number;
  readonly userid: number;
  readonly username: string;
  readonly content: string;
  readonly contextid: number;
  readonly component: string;
  readonly itemid: number;
  readonly timecreated: number; // Unix timestamp
  readonly timemodified: number; // Unix timestamp
  readonly usermodified?: number;
  readonly profileimageurl?: string;
}

// ============================================================================
// Dashboard Preferences Types
// ============================================================================

/**
 * User dashboard preferences
 */
export interface DashboardPreferences {
  readonly timelineSort: TimelineSort;
  readonly timelineFilter: TimelineFilter;
  readonly timelineLimit: TimelineLimit;
  readonly courseOverview: CourseOverviewPreferences;
  readonly dashboardView: DashboardPageType;
  readonly blocksCollapsed: Record<string, boolean>;
  readonly theme: 'light' | 'dark' | 'auto';
  readonly language: string;
}

// ============================================================================
// Dashboard Data Structure
// ============================================================================

/**
 * Complete dashboard data structure
 * Aggregates all dashboard information for API responses
 */
export interface DashboardData {
  readonly page: DashboardPage;
  readonly user: DashboardUserInfo;
  readonly capabilities: RoleCapabilities;
  readonly blocks: readonly BlockInstance[];
  readonly widgets: readonly Widget[];
  readonly timeline?: {
    readonly items: readonly TimelineItem[];
    readonly preferences: TimelinePreferences;
    readonly hasmore: boolean;
  };
  readonly calendar?: {
    readonly events: readonly CalendarEvent[];
    readonly filters: CalendarFilter;
  };
  readonly recentActivity?: readonly RecentActivityItem[];
  readonly onlineUsers?: readonly OnlineUser[];
  readonly courses?: readonly CourseOverview[];
  readonly badges?: readonly Badge[];
}

// ============================================================================
// Block Data Types
// ============================================================================

/**
 * Generic block data response
 */
export interface BlockData {
  readonly blockType: BlockType;
  readonly data: unknown;
  readonly config: WidgetConfig;
}

/**
 * Timeline block specific data
 */
export interface TimelineBlockData extends BlockData {
  readonly blockType: BlockType.TIMELINE;
  readonly data: {
    readonly items: readonly TimelineItem[];
    readonly preferences: TimelinePreferences;
    readonly hasmore: boolean;
  };
}

/**
 * Calendar block specific data
 */
export interface CalendarBlockData extends BlockData {
  readonly blockType: BlockType.CALENDAR_MONTH;
  readonly data: {
    readonly events: readonly CalendarEvent[];
    readonly month: number;
    readonly year: number;
  };
}

/**
 * Recent activity block specific data
 */
export interface RecentActivityBlockData extends BlockData {
  readonly blockType: BlockType.RECENT_ACTIVITY;
  readonly data: {
    readonly items: readonly RecentActivityItem[];
  };
}

/**
 * Online users block specific data
 */
export interface OnlineUsersBlockData extends BlockData {
  readonly blockType: BlockType.ONLINE_USERS;
  readonly data: {
    readonly users: readonly OnlineUser[];
    readonly count: number;
  };
}

/**
 * Course overview block specific data
 */
export interface CourseOverviewBlockData extends BlockData {
  readonly blockType: BlockType.MY_OVERVIEW;
  readonly data: {
    readonly courses: readonly CourseOverview[];
    readonly preferences: CourseOverviewPreferences;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API pagination metadata
 */
export interface PaginationMeta {
  readonly page: number;
  readonly perPage: number;
  readonly total: number;
  readonly totalPages: number;
}

/**
 * Standard API response envelope
 */
export interface APIResponse<T> {
  readonly success: boolean;
  readonly data: T;
  readonly meta?: {
    readonly pagination?: PaginationMeta;
    readonly timestamp?: number;
  };
}

/**
 * Dashboard API response
 */
export interface DashboardAPIResponse extends APIResponse<DashboardData> {
  readonly data: DashboardData;
}

/**
 * Block data API response
 */
export interface BlockAPIResponse extends APIResponse<BlockData> {
  readonly data: BlockData;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
}

// ============================================================================
// Dashboard Action Types
// ============================================================================

/**
 * Dashboard actions for state management
 */
export type DashboardAction =
  | { type: 'LOAD_DASHBOARD_SUCCESS'; payload: DashboardData }
  | { type: 'LOAD_DASHBOARD_FAILURE'; payload: ErrorResponse }
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<DashboardPreferences> }
  | { type: 'ADD_BLOCK'; payload: BlockInstance }
  | { type: 'REMOVE_BLOCK'; payload: number }
  | { type: 'MOVE_BLOCK'; payload: { blockId: number; region: BlockRegion; weight: number } }
  | { type: 'TOGGLE_BLOCK_COLLAPSE'; payload: string }
  | { type: 'REFRESH_WIDGET'; payload: { widgetId: string; data: unknown } }
  | { type: 'UPDATE_TIMELINE_PREFERENCES'; payload: Partial<TimelinePreferences> };

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a block is a timeline block
 */
export function isTimelineBlock(block: BlockData): block is TimelineBlockData {
  return block.blockType === BlockType.TIMELINE;
}

/**
 * Type guard to check if a block is a calendar block
 */
export function isCalendarBlock(block: BlockData): block is CalendarBlockData {
  return block.blockType === BlockType.CALENDAR_MONTH;
}

/**
 * Type guard to check if a block is a recent activity block
 */
export function isRecentActivityBlock(block: BlockData): block is RecentActivityBlockData {
  return block.blockType === BlockType.RECENT_ACTIVITY;
}

/**
 * Type guard to check if a block is an online users block
 */
export function isOnlineUsersBlock(block: BlockData): block is OnlineUsersBlockData {
  return block.blockType === BlockType.ONLINE_USERS;
}

/**
 * Type guard to check if a block is a course overview block
 */
export function isCourseOverviewBlock(block: BlockData): block is CourseOverviewBlockData {
  return block.blockType === BlockType.MY_OVERVIEW;
}

/**
 * Type guard to check if a response is an error response
 */
export function isErrorResponse(response: APIResponse<unknown> | ErrorResponse): response is ErrorResponse {
  return response.success === false;
}
