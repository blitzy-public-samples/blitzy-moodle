/**
 * Centralized API Endpoint Constants
 *
 * This file serves as the single source of truth for all API endpoint URLs
 * used throughout the Moodle React application. All endpoints are organized
 * by feature domain for maintainability and consistency.
 *
 * The endpoints map to the backend REST API at /api/v1/ and support dynamic
 * URL parameters using template strings or functions that return strings.
 *
 * Usage:
 * ```typescript
 * import { COURSE_ENDPOINTS, AUTH_ENDPOINTS } from '@/services/api/endpoints';
 *
 * // Static endpoint
 * const response = await apiClient.get(COURSE_ENDPOINTS.LIST);
 *
 * // Dynamic endpoint with parameter
 * const course = await apiClient.get(COURSE_ENDPOINTS.DETAIL(courseId));
 * ```
 *
 * @module services/api/endpoints
 */

/**
 * Base URL for all API endpoints
 * Reads from environment variable VITE_API_BASE_URL with fallback to '/api/v1'
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';

/**
 * Current API version
 */
export const API_VERSION = 'v1';

/**
 * Authentication and authorization endpoints
 *
 * These endpoints handle user login, logout, token refresh, and user profile retrieval.
 * All authentication uses JWT tokens with httpOnly cookies or Authorization header.
 *
 * HTTP Methods:
 * - LOGIN: POST
 * - LOGOUT: POST
 * - REFRESH: POST
 * - ME: GET
 * 
 * NOTE: Endpoints are relative paths since apiClient already has baseURL set to /api/v1
 */
export const AUTH_ENDPOINTS = {
  /** POST - User login with username/password credentials */
  LOGIN: '/auth/login',

  /** POST - Logout user and invalidate JWT token (adds to blacklist) */
  LOGOUT: '/auth/logout',

  /** POST - Refresh expired access token using refresh token */
  REFRESH: '/auth/refresh',

  /** GET - Retrieve current user profile from JWT token */
  ME: '/auth/me',
} as const;

/**
 * Course management endpoints
 *
 * These endpoints handle course catalog browsing, course details, enrollment,
 * course creation/updates (admin), and course content retrieval.
 *
 * HTTP Methods:
 * - LIST: GET
 * - DETAIL: GET
 * - CREATE: POST
 * - UPDATE: PUT
 * - DELETE: DELETE
 * - ENROLL: POST
 * - CONTENTS: GET
 */
export const COURSE_ENDPOINTS = {
  /** GET - Retrieve paginated list of courses with optional filters */
  LIST: '/courses',

  /** GET - Retrieve detailed information for a specific course */
  DETAIL: (id: number) => `/courses/${id}`,

  /** POST - Create a new course (requires admin/teacher capability) */
  CREATE: '/courses',

  /** PUT - Update course settings and metadata */
  UPDATE: (id: number) => `/courses/${id}`,

  /** DELETE - Delete a course (requires admin capability) */
  DELETE: (id: number) => `/courses/${id}`,

  /** POST - Enroll current user in a course */
  ENROLL: (id: number) => `/courses/${id}/enroll`,

  /** GET - Retrieve course contents (sections, activities, resources) */
  CONTENTS: (id: number) => `/courses/${id}/contents`,
} as const;

/**
 * User management endpoints
 *
 * These endpoints handle user profiles, preferences, dashboards, and user lists.
 *
 * HTTP Methods:
 * - LIST: GET
 * - DETAIL: GET
 * - UPDATE: PUT
 * - DASHBOARD: GET
 * - COURSES: GET
 * - PREFERENCES: PUT
 */
export const USER_ENDPOINTS = {
  /** GET - Retrieve paginated list of users (requires appropriate capability) */
  LIST: '/users',

  /** GET - Retrieve detailed user profile information */
  DETAIL: (id: number) => `/users/${id}`,

  /** PUT - Update user profile information */
  UPDATE: (id: number) => `/users/${id}`,

  /** GET - Retrieve user's personalized dashboard data */
  DASHBOARD: (id: number) => `/users/${id}/dashboard`,

  /** GET - Retrieve list of courses user is enrolled in */
  COURSES: (id: number) => `/users/${id}/courses`,

  /** PUT - Update user preferences and settings */
  PREFERENCES: (id: number) => `/users/${id}/preferences`,
} as const;

/**
 * Assignment activity endpoints
 *
 * These endpoints handle assignment submissions, grading, feedback, and file management.
 *
 * HTTP Methods:
 * - DETAIL: GET
 * - SUBMIT: POST
 * - GRADE: POST
 * - SUBMISSIONS: GET
 * - FEEDBACK: POST
 * - FILES: GET
 */
export const ASSIGNMENT_ENDPOINTS = {
  /** GET - Retrieve assignment details and requirements */
  DETAIL: (id: number) => `/assignments/${id}`,

  /** POST - Submit assignment work (with optional file uploads) */
  SUBMIT: (id: number) => `/assignments/${id}/submit`,

  /** POST - Grade a student's assignment submission (teacher only) */
  GRADE: (id: number) => `/assignments/${id}/grade`,

  /** GET - Retrieve list of submissions for an assignment (teacher view) */
  SUBMISSIONS: (id: number) => `/assignments/${id}/submissions`,

  /** POST - Provide feedback on a submission */
  FEEDBACK: (id: number) => `/assignments/${id}/feedback`,

  /** GET - Retrieve list of files associated with assignment */
  FILES: (id: number) => `/assignments/${id}/files`,
} as const;

/**
 * Quiz activity endpoints
 *
 * These endpoints handle quiz attempts, question retrieval, submission, and review.
 *
 * HTTP Methods:
 * - DETAIL: GET
 * - ATTEMPT: POST
 * - SUBMIT: POST
 * - RESULTS: GET
 * - ATTEMPTS: GET
 * - QUESTIONS: GET
 * - REVIEW: GET
 * - SUMMARY: GET
 */
export const QUIZ_ENDPOINTS = {
  /** GET - Retrieve quiz details and settings */
  DETAIL: (id: number) => `/quizzes/${id}`,

  /** POST - Start a new quiz attempt */
  ATTEMPT: (id: number) => `/quizzes/${id}/attempt`,

  /** POST - Submit quiz answers for grading */
  SUBMIT: (id: number) => `/quizzes/${id}/submit`,

  /** GET - Retrieve results for a specific quiz attempt */
  RESULTS: (attemptId: number) => `/quizzes/attempts/${attemptId}`,

  /** GET - Retrieve list of user's quiz attempts */
  ATTEMPTS: (id: number) => `/quizzes/${id}/attempts`,

  /** GET - Retrieve quiz questions for an attempt */
  QUESTIONS: (id: number) => `/quizzes/${id}/questions`,

  /** GET - Review a completed quiz attempt with correct answers */
  REVIEW: (attemptId: number) => `/quizzes/attempts/${attemptId}/review`,

  /** GET - Retrieve attempt summary before submission */
  SUMMARY: (attemptId: number) => `/quizzes/attempts/${attemptId}/summary`,
} as const;

/**
 * Forum activity endpoints
 *
 * These endpoints handle forum discussions, posts, subscriptions, and marking read.
 *
 * HTTP Methods:
 * - DETAIL: GET
 * - DISCUSSIONS: GET
 * - CREATE_DISCUSSION: POST
 * - POSTS: GET
 * - CREATE_POST: POST
 * - UPDATE_POST: PUT
 * - DELETE_POST: DELETE
 * - SUBSCRIBE: POST
 * - MARK_READ: POST
 */
export const FORUM_ENDPOINTS = {
  /** GET - Retrieve forum details and settings */
  DETAIL: (id: number) => `/forums/${id}`,

  /** GET - Retrieve list of discussions in a forum */
  DISCUSSIONS: (id: number) => `/forums/${id}/discussions`,

  /** POST - Create a new discussion thread in a forum */
  CREATE_DISCUSSION: (id: number) => `/forums/${id}/discussions`,

  /** GET - Retrieve posts in a specific discussion thread */
  POSTS: (discussionId: number) => `/forums/discussions/${discussionId}/posts`,

  /** POST - Create a new post in a discussion thread */
  CREATE_POST: (discussionId: number) => `/forums/discussions/${discussionId}/posts`,

  /** PUT - Update an existing forum post */
  UPDATE_POST: (postId: number) => `/forums/posts/${postId}`,

  /** DELETE - Delete a forum post */
  DELETE_POST: (postId: number) => `/forums/posts/${postId}`,

  /** POST - Subscribe to forum notifications */
  SUBSCRIBE: (id: number) => `/forums/${id}/subscribe`,

  /** POST - Mark a discussion as read */
  MARK_READ: (discussionId: number) => `/forums/discussions/${discussionId}/read`,
} as const;

/**
 * Gradebook endpoints
 *
 * These endpoints handle grade retrieval, updates, categories, and reporting.
 *
 * HTTP Methods:
 * - COURSE: GET
 * - USER: GET
 * - ITEMS: GET
 * - UPDATE_GRADE: PUT
 * - CATEGORIES: GET
 * - EXPORT: GET
 * - REPORT: GET
 */
export const GRADEBOOK_ENDPOINTS = {
  /** GET - Retrieve all grades for a specific course */
  COURSE: (courseId: number) => `/gradebook/course/${courseId}`,

  /** GET - Retrieve all grades for a specific user */
  USER: (userId: number) => `/gradebook/user/${userId}`,

  /** GET - Retrieve list of grade items */
  ITEMS: '/gradebook/items',

  /** PUT - Update a grade item */
  UPDATE_GRADE: (itemId: number) => `/gradebook/items/${itemId}`,

  /** GET - Retrieve grade categories */
  CATEGORIES: '/gradebook/categories',

  /** GET - Export gradebook data (CSV, Excel, etc.) */
  EXPORT: '/gradebook/export',

  /** GET - Generate gradebook report */
  REPORT: '/gradebook/report',
} as const;

/**
 * Messaging endpoints
 *
 * These endpoints handle private messages, conversations, notifications, and contacts.
 *
 * HTTP Methods:
 * - LIST: GET
 * - SEND: POST
 * - CONVERSATION: GET
 * - MARK_READ: PUT
 * - DELETE: DELETE
 * - CONTACTS: GET
 * - NOTIFICATIONS: GET
 */
export const MESSAGE_ENDPOINTS = {
  /** GET - Retrieve list of user's messages */
  LIST: '/messages',

  /** POST - Send a new message to another user */
  SEND: '/messages',

  /** GET - Retrieve conversation thread with a specific user */
  CONVERSATION: (conversationId: number) =>
    `/messages/conversation/${conversationId}`,

  /** PUT - Mark a message as read */
  MARK_READ: (messageId: number) => `/messages/${messageId}/read`,

  /** DELETE - Delete a message */
  DELETE: (messageId: number) => `/messages/${messageId}`,

  /** GET - Retrieve list of user's contacts */
  CONTACTS: '/messages/contacts',

  /** GET - Retrieve user's notifications */
  NOTIFICATIONS: '/notifications',
} as const;

/**
 * Administration endpoints
 *
 * These endpoints handle system administration tasks including user management,
 * course administration, role assignment, settings, and plugin configuration.
 * Requires admin or manager capabilities.
 *
 * HTTP Methods vary by sub-category
 */
export const ADMIN_ENDPOINTS = {
  /**
   * User administration endpoints
   */
  USERS: {
    /** GET - Retrieve list of all users in the system */
    LIST: '/admin/users',

    /** POST - Create a new user account */
    CREATE: '/admin/users',

    /** PUT - Update user account details */
    UPDATE: (id: number) => `/admin/users/${id}`,

    /** DELETE - Delete a user account */
    DELETE: (id: number) => `/admin/users/${id}`,

    /** POST - Perform bulk user operations (create, update, delete) */
    BULK: '/admin/users/bulk',
  },

  /**
   * Course administration endpoints
   */
  COURSES: {
    /** GET - Retrieve list of all courses in the system */
    LIST: '/admin/courses',

    /** GET - Retrieve course categories */
    CATEGORIES: '/admin/courses/categories',

    /** POST - Perform bulk course operations */
    BULK: '/admin/courses/bulk',
  },

  /**
   * Role management endpoints
   */
  ROLES: {
    /** GET - Retrieve list of all roles in the system */
    LIST: '/admin/roles',

    /** POST - Assign a role to a user in a context */
    ASSIGN: '/admin/roles/assign',

    /** GET - Retrieve capabilities for a role */
    CAPABILITIES: '/admin/roles/capabilities',
  },

  /**
   * System settings endpoints
   */
  SETTINGS: {
    /** GET - Retrieve system settings */
    LIST: '/admin/settings',

    /** PUT - Update system settings */
    UPDATE: '/admin/settings',
  },

  /**
   * Plugin management endpoints
   */
  PLUGINS: {
    /** GET - Retrieve list of installed plugins */
    LIST: '/admin/plugins',

    /** PUT - Configure plugin settings */
    CONFIGURE: (id: string) => `/admin/plugins/${id}`,
  },
} as const;

/**
 * File management endpoints
 *
 * These endpoints handle file uploads, downloads, deletion, and repository browsing.
 *
 * HTTP Methods:
 * - UPLOAD: POST
 * - DOWNLOAD: GET
 * - DELETE: DELETE
 * - LIST: GET
 * - REPOSITORY: GET
 * - THUMBNAIL: GET
 */
export const FILE_ENDPOINTS = {
  /** POST - Upload a file (multipart/form-data) */
  UPLOAD: '/files/upload',

  /** GET - Download a file by ID */
  DOWNLOAD: (id: number) => `/files/download/${id}`,

  /** DELETE - Delete a file */
  DELETE: (id: number) => `/files/${id}`,

  /** GET - Retrieve list of user's files */
  LIST: '/files',

  /** GET - Browse file repository */
  REPOSITORY: '/files/repository',

  /** GET - Retrieve file thumbnail/preview */
  THUMBNAIL: (id: number) => `/files/thumbnail/${id}`,
} as const;

/**
 * Dashboard block/widget endpoints
 *
 * These endpoints provide data for dashboard widgets including calendar,
 * upcoming events, recent activity, online users, timeline, and badges.
 *
 * HTTP Methods: All GET
 */
export const BLOCK_ENDPOINTS = {
  /** GET - Retrieve calendar events data */
  CALENDAR: '/blocks/calendar',

  /** GET - Retrieve upcoming events and deadlines */
  UPCOMING: '/blocks/upcoming',

  /** GET - Retrieve recent activity in user's courses */
  RECENT_ACTIVITY: '/blocks/recent',

  /** GET - Retrieve list of online users */
  ONLINE_USERS: '/blocks/online',

  /** GET - Retrieve timeline of upcoming activities */
  TIMELINE: '/blocks/timeline',

  /** GET - Retrieve course overview data */
  OVERVIEW: '/blocks/overview',

  /** GET - Retrieve user's badges */
  BADGES: '/blocks/badges',

  /** GET - Retrieve recent comments */
  COMMENTS: '/blocks/comments',
} as const;

/**
 * Enrollment endpoints
 *
 * These endpoints handle course enrollment operations including self-enrollment,
 * manual enrollment, unenrollment, and enrollment method management.
 *
 * HTTP Methods:
 * - METHODS: GET
 * - ENROLL: POST
 * - UNENROLL: POST
 * - ENROLLED_USERS: GET
 * - SELF_ENROLL: POST
 */
export const ENROLLMENT_ENDPOINTS = {
  /** GET - Retrieve available enrollment methods for a course */
  METHODS: '/enrollment/methods',

  /** POST - Enroll a user in a course (admin/teacher) */
  ENROLL: '/enrollment/enroll',

  /** POST - Unenroll a user from a course */
  UNENROLL: '/enrollment/unenroll',

  /** GET - Retrieve list of enrolled users in a course */
  ENROLLED_USERS: (courseId: number) => `/enrollment/${courseId}/users`,

  /** POST - Self-enroll in a course */
  SELF_ENROLL: (courseId: number) => `/enrollment/self/${courseId}`,
} as const;

/**
 * Search endpoints
 *
 * These endpoints handle global and specific search functionality for courses,
 * users, and other content.
 *
 * HTTP Methods: All GET
 */
export const SEARCH_ENDPOINTS = {
  /** GET - Search for courses */
  COURSES: '/search/courses',

  /** GET - Search for users */
  USERS: '/search/users',

  /** GET - Global search across all content */
  GLOBAL: '/search',
} as const;

/**
 * Resource activity endpoints
 *
 * These endpoints handle various resource types including files, pages, URLs, and folders.
 *
 * HTTP Methods: All GET
 */
export const RESOURCE_ENDPOINTS = {
  /** GET - Retrieve resource details */
  DETAIL: (id: number) => `/resources/${id}`,

  /** GET - Retrieve files associated with a resource */
  FILES: (id: number) => `/resources/${id}/files`,

  /** GET - Retrieve page resource content */
  PAGES: (id: number) => `/resources/pages/${id}`,

  /** GET - Retrieve URL resource details */
  URLS: (id: number) => `/resources/urls/${id}`,

  /** GET - Retrieve folder resource contents */
  FOLDERS: (id: number) => `/resources/folders/${id}`,
} as const;

/**
 * Wiki activity endpoints
 *
 * These endpoints handle wiki page creation, editing, viewing, version history,
 * and search functionality.
 *
 * HTTP Methods:
 * - DETAIL, BY_TITLE, FIRST_PAGE: GET
 * - SAVE, SAVE_SECTION, CREATE: POST
 * - HISTORY, VERSION, RESTORE: GET/POST
 * - LIST, SEARCH, LINKS: GET
 */
export const WIKI_ENDPOINTS = {
  /** GET - Retrieve wiki details and configuration */
  DETAIL: (id: number) => `/wiki/${id}`,

  /** GET - Retrieve wiki page by title */
  BY_TITLE: (wikiId: number, title: string) =>
    `/wiki/${wikiId}/page/${encodeURIComponent(title)}`,

  /** GET - Retrieve first/main page of a wiki */
  FIRST_PAGE: (id: number) => `/wiki/${id}/firstpage`,

  /** POST - Save wiki page content */
  SAVE: (id: number) => `/wiki/${id}/save`,

  /** POST - Save a specific section of a wiki page */
  SAVE_SECTION: (id: number) => `/wiki/${id}/savesection`,

  /** POST - Create a new wiki page */
  CREATE: (id: number) => `/wiki/${id}/create`,

  /** GET - Retrieve version history of a wiki page */
  HISTORY: (pageId: number) => `/wiki/page/${pageId}/history`,

  /** GET - Retrieve specific version of a wiki page */
  VERSION: (pageId: number, versionId: number) =>
    `/wiki/page/${pageId}/version/${versionId}`,

  /** POST - Restore a previous version of a wiki page */
  RESTORE: (pageId: number, versionId: number) =>
    `/wiki/page/${pageId}/restore/${versionId}`,

  /** GET - Retrieve list of all wiki pages */
  LIST: (id: number) => `/wiki/${id}/pages`,

  /** GET - Search wiki pages */
  SEARCH: (id: number) => `/wiki/${id}/search`,

  /** GET - Retrieve links within wiki pages */
  LINKS: (pageId: number) => `/wiki/page/${pageId}/links`,
} as const;

/**
 * Lesson activity endpoints
 *
 * These endpoints handle lesson progression, page navigation, timer management,
 * and attempt tracking.
 *
 * HTTP Methods:
 * - DETAIL, PAGE, PAGES, PROGRESS, ATTEMPT: GET
 * - START, SUBMIT, NEXT_PAGE, FINISH, RESTART, UPDATE_TIMER: POST
 */
export const LESSON_ENDPOINTS = {
  /** GET - Retrieve lesson details and settings */
  DETAIL: (id: number) => `/lesson/${id}`,

  /** POST - Start a new lesson attempt */
  START: (id: number) => `/lesson/${id}/start`,

  /** POST - Submit answer for a lesson page */
  SUBMIT: (id: number) => `/lesson/${id}/submit`,

  /** GET - Retrieve specific lesson page content */
  PAGE: (id: number, pageId: number) => `/lesson/${id}/page/${pageId}`,

  /** POST - Navigate to next lesson page */
  NEXT_PAGE: (id: number) => `/lesson/${id}/nextpage`,

  /** POST - Finish lesson attempt */
  FINISH: (id: number) => `/lesson/${id}/finish`,

  /** POST - Restart lesson from beginning */
  RESTART: (id: number) => `/lesson/${id}/restart`,

  /** GET - Retrieve list of lesson pages */
  PAGES: (id: number) => `/lesson/${id}/pages`,

  /** GET - Retrieve user's progress in lesson */
  PROGRESS: (id: number) => `/lesson/${id}/progress`,

  /** POST - Update lesson timer */
  UPDATE_TIMER: (id: number) => `/lesson/${id}/timer`,

  /** GET - Retrieve lesson attempt information */
  ATTEMPT: (id: number) => `/lesson/${id}/attempt`,
} as const;

/**
 * Workshop activity endpoints
 *
 * These endpoints handle workshop submissions, peer assessments, allocation,
 * grading, and phase management.
 *
 * HTTP Methods vary by operation
 */
export const WORKSHOP_ENDPOINTS = {
  /** GET - Retrieve workshop details and current phase */
  DETAIL: (id: number) => `/workshop/${id}`,

  /** GET - Retrieve workshop submissions */
  SUBMISSIONS: (id: number) => `/workshop/${id}/submissions`,

  /** POST - Create a new workshop submission */
  CREATE_SUBMISSION: (id: number) => `/workshop/${id}/submissions`,

  /** PUT - Update workshop submission */
  UPDATE_SUBMISSION: (submissionId: number) =>
    `/workshop/submissions/${submissionId}`,

  /** DELETE - Delete workshop submission */
  DELETE_SUBMISSION: (submissionId: number) =>
    `/workshop/submissions/${submissionId}`,

  /** GET - Retrieve peer assessments for a submission */
  ASSESSMENTS: (submissionId: number) =>
    `/workshop/submissions/${submissionId}/assessments`,

  /** POST - Create a new peer assessment */
  CREATE_ASSESSMENT: (submissionId: number) =>
    `/workshop/submissions/${submissionId}/assessments`,

  /** PUT - Update peer assessment */
  UPDATE_ASSESSMENT: (assessmentId: number) =>
    `/workshop/assessments/${assessmentId}`,

  /** POST - Switch workshop to next phase */
  SWITCH_PHASE: (id: number) => `/workshop/${id}/switchphase`,

  /** POST - Allocate submissions for peer assessment */
  ALLOCATE: (id: number) => `/workshop/${id}/allocate`,

  /** GET - Retrieve workshop grades */
  GRADES: (id: number) => `/workshop/${id}/grades`,

  /** PUT - Update workshop grade */
  UPDATE_GRADE: (id: number) => `/workshop/${id}/grade`,

  /** GET - Retrieve user's assessment plan */
  USER_PLAN: (id: number) => `/workshop/${id}/userplan`,

  /** GET - Retrieve example submissions */
  EXAMPLES: (id: number) => `/workshop/${id}/examples`,
} as const;

/**
 * Glossary activity endpoints
 *
 * These endpoints handle glossary entries, categories, and search functionality.
 *
 * HTTP Methods:
 * - DETAIL, ENTRIES, ENTRY, CATEGORIES, SEARCH: GET
 * - CREATE_ENTRY: POST
 * - UPDATE_ENTRY: PUT
 * - DELETE_ENTRY: DELETE
 */
export const GLOSSARY_ENDPOINTS = {
  /** GET - Retrieve glossary details and settings */
  DETAIL: (id: number) => `/glossary/${id}`,

  /** GET - Retrieve all entries in a glossary */
  ENTRIES: (id: number) => `/glossary/${id}/entries`,

  /** GET - Retrieve specific glossary entry */
  ENTRY: (entryId: number) => `/glossary/entries/${entryId}`,

  /** POST - Create a new glossary entry */
  CREATE_ENTRY: (id: number) => `/glossary/${id}/entries`,

  /** PUT - Update a glossary entry */
  UPDATE_ENTRY: (entryId: number) => `/glossary/entries/${entryId}`,

  /** DELETE - Delete a glossary entry */
  DELETE_ENTRY: (entryId: number) => `/glossary/entries/${entryId}`,

  /** GET - Retrieve glossary categories */
  CATEGORIES: (id: number) => `/glossary/${id}/categories`,

  /** GET - Search glossary entries */
  SEARCH: (id: number) => `/glossary/${id}/search`,
} as const;

/**
 * SCORM package endpoints
 *
 * These endpoints handle SCORM package launching, tracking, and result retrieval.
 *
 * HTTP Methods:
 * - DETAIL, PLAYER, RESULTS: GET
 * - LAUNCH, TRACK: POST
 */
export const SCORM_ENDPOINTS = {
  /** GET - Retrieve SCORM package details */
  DETAIL: (id: number) => `/scorm/${id}`,

  /** POST - Launch SCORM package and create attempt */
  LAUNCH: (id: number) => `/scorm/${id}/launch`,

  /** GET - Retrieve SCORM player interface */
  PLAYER: (id: number) => `/scorm/${id}/player`,

  /** POST - Track SCORM activity and progress */
  TRACK: (id: number) => `/scorm/${id}/track`,

  /** GET - Retrieve SCORM attempt results */
  RESULTS: (id: number) => `/scorm/${id}/results`,
} as const;

/**
 * Book module endpoints
 *
 * These endpoints handle book chapter viewing and navigation.
 *
 * HTTP Methods: All GET
 */
export const BOOK_ENDPOINTS = {
  /** GET - Retrieve book details and settings */
  DETAIL: (id: number) => `/book/${id}`,

  /** GET - Retrieve list of book chapters */
  CHAPTERS: (id: number) => `/book/${id}/chapters`,

  /** GET - Retrieve specific book chapter content */
  CHAPTER: (id: number, chapterId: number) => `/book/${id}/chapter/${chapterId}`,

  /** GET - Retrieve book table of contents */
  TOC: (id: number) => `/book/${id}/toc`,
} as const;

/**
 * H5P activity endpoints
 *
 * These endpoints handle H5P interactive content launching, tracking, and results.
 *
 * HTTP Methods:
 * - DETAIL, RESULTS, ATTEMPTS: GET
 * - LAUNCH: POST
 */
export const H5P_ENDPOINTS = {
  /** GET - Retrieve H5P activity details */
  DETAIL: (id: number) => `/h5p/${id}`,

  /** POST - Launch H5P content and track interaction */
  LAUNCH: (id: number) => `/h5p/${id}/launch`,

  /** GET - Retrieve H5P activity results */
  RESULTS: (id: number) => `/h5p/${id}/results`,

  /** GET - Retrieve user's H5P attempts */
  ATTEMPTS: (id: number) => `/h5p/${id}/attempts`,
} as const;
