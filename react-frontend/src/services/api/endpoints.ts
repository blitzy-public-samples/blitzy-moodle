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
 */
export const AUTH_ENDPOINTS = {
  /** POST - User login with username/password credentials */
  LOGIN: `${API_BASE_URL}/auth/login`,

  /** POST - Logout user and invalidate JWT token (adds to blacklist) */
  LOGOUT: `${API_BASE_URL}/auth/logout`,

  /** POST - Refresh expired access token using refresh token */
  REFRESH: `${API_BASE_URL}/auth/refresh`,

  /** GET - Retrieve current user profile from JWT token */
  ME: `${API_BASE_URL}/auth/me`,
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
  LIST: `${API_BASE_URL}/courses`,

  /** GET - Retrieve detailed information for a specific course */
  DETAIL: (id: number) => `${API_BASE_URL}/courses/${id}`,

  /** POST - Create a new course (requires admin/teacher capability) */
  CREATE: `${API_BASE_URL}/courses`,

  /** PUT - Update course settings and metadata */
  UPDATE: (id: number) => `${API_BASE_URL}/courses/${id}`,

  /** DELETE - Delete a course (requires admin capability) */
  DELETE: (id: number) => `${API_BASE_URL}/courses/${id}`,

  /** POST - Enroll current user in a course */
  ENROLL: (id: number) => `${API_BASE_URL}/courses/${id}/enroll`,

  /** GET - Retrieve course contents (sections, activities, resources) */
  CONTENTS: (id: number) => `${API_BASE_URL}/courses/${id}/contents`,
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
  LIST: `${API_BASE_URL}/users`,

  /** GET - Retrieve detailed user profile information */
  DETAIL: (id: number) => `${API_BASE_URL}/users/${id}`,

  /** PUT - Update user profile information */
  UPDATE: (id: number) => `${API_BASE_URL}/users/${id}`,

  /** GET - Retrieve user's personalized dashboard data */
  DASHBOARD: (id: number) => `${API_BASE_URL}/users/${id}/dashboard`,

  /** GET - Retrieve list of courses user is enrolled in */
  COURSES: (id: number) => `${API_BASE_URL}/users/${id}/courses`,

  /** PUT - Update user preferences and settings */
  PREFERENCES: (id: number) => `${API_BASE_URL}/users/${id}/preferences`,
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
  DETAIL: (id: number) => `${API_BASE_URL}/assignments/${id}`,

  /** POST - Submit assignment work (with optional file uploads) */
  SUBMIT: (id: number) => `${API_BASE_URL}/assignments/${id}/submit`,

  /** POST - Grade a student's assignment submission (teacher only) */
  GRADE: (id: number) => `${API_BASE_URL}/assignments/${id}/grade`,

  /** GET - Retrieve list of submissions for an assignment (teacher view) */
  SUBMISSIONS: (id: number) => `${API_BASE_URL}/assignments/${id}/submissions`,

  /** POST - Provide feedback on a submission */
  FEEDBACK: (id: number) => `${API_BASE_URL}/assignments/${id}/feedback`,

  /** GET - Retrieve list of files associated with assignment */
  FILES: (id: number) => `${API_BASE_URL}/assignments/${id}/files`,
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
  DETAIL: (id: number) => `${API_BASE_URL}/quizzes/${id}`,

  /** POST - Start a new quiz attempt */
  ATTEMPT: (id: number) => `${API_BASE_URL}/quizzes/${id}/attempt`,

  /** POST - Submit quiz answers for grading */
  SUBMIT: (id: number) => `${API_BASE_URL}/quizzes/${id}/submit`,

  /** GET - Retrieve results for a specific quiz attempt */
  RESULTS: (attemptId: number) => `${API_BASE_URL}/quizzes/attempts/${attemptId}`,

  /** GET - Retrieve list of user's quiz attempts */
  ATTEMPTS: (id: number) => `${API_BASE_URL}/quizzes/${id}/attempts`,

  /** GET - Retrieve quiz questions for an attempt */
  QUESTIONS: (id: number) => `${API_BASE_URL}/quizzes/${id}/questions`,

  /** GET - Review a completed quiz attempt with correct answers */
  REVIEW: (attemptId: number) => `${API_BASE_URL}/quizzes/attempts/${attemptId}/review`,

  /** GET - Retrieve attempt summary before submission */
  SUMMARY: (attemptId: number) => `${API_BASE_URL}/quizzes/attempts/${attemptId}/summary`,
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
  DETAIL: (id: number) => `${API_BASE_URL}/forums/${id}`,

  /** GET - Retrieve list of discussions in a forum */
  DISCUSSIONS: (id: number) => `${API_BASE_URL}/forums/${id}/discussions`,

  /** POST - Create a new discussion thread in a forum */
  CREATE_DISCUSSION: (id: number) => `${API_BASE_URL}/forums/${id}/discussions`,

  /** GET - Retrieve posts in a specific discussion thread */
  POSTS: (discussionId: number) => `${API_BASE_URL}/forums/discussions/${discussionId}/posts`,

  /** POST - Create a new post in a discussion thread */
  CREATE_POST: (discussionId: number) => `${API_BASE_URL}/forums/discussions/${discussionId}/posts`,

  /** PUT - Update an existing forum post */
  UPDATE_POST: (postId: number) => `${API_BASE_URL}/forums/posts/${postId}`,

  /** DELETE - Delete a forum post */
  DELETE_POST: (postId: number) => `${API_BASE_URL}/forums/posts/${postId}`,

  /** POST - Subscribe to forum notifications */
  SUBSCRIBE: (id: number) => `${API_BASE_URL}/forums/${id}/subscribe`,

  /** POST - Mark a discussion as read */
  MARK_READ: (discussionId: number) => `${API_BASE_URL}/forums/discussions/${discussionId}/read`,
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
  COURSE: (courseId: number) => `${API_BASE_URL}/gradebook/course/${courseId}`,

  /** GET - Retrieve all grades for a specific user */
  USER: (userId: number) => `${API_BASE_URL}/gradebook/user/${userId}`,

  /** GET - Retrieve list of grade items */
  ITEMS: `${API_BASE_URL}/gradebook/items`,

  /** PUT - Update a grade item */
  UPDATE_GRADE: (itemId: number) => `${API_BASE_URL}/gradebook/items/${itemId}`,

  /** GET - Retrieve grade categories */
  CATEGORIES: `${API_BASE_URL}/gradebook/categories`,

  /** GET - Export gradebook data (CSV, Excel, etc.) */
  EXPORT: `${API_BASE_URL}/gradebook/export`,

  /** GET - Generate gradebook report */
  REPORT: `${API_BASE_URL}/gradebook/report`,
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
  LIST: `${API_BASE_URL}/messages`,

  /** POST - Send a new message to another user */
  SEND: `${API_BASE_URL}/messages`,

  /** GET - Retrieve conversation thread with a specific user */
  CONVERSATION: (conversationId: number) =>
    `${API_BASE_URL}/messages/conversation/${conversationId}`,

  /** PUT - Mark a message as read */
  MARK_READ: (messageId: number) => `${API_BASE_URL}/messages/${messageId}/read`,

  /** DELETE - Delete a message */
  DELETE: (messageId: number) => `${API_BASE_URL}/messages/${messageId}`,

  /** GET - Retrieve list of user's contacts */
  CONTACTS: `${API_BASE_URL}/messages/contacts`,

  /** GET - Retrieve user's notifications */
  NOTIFICATIONS: `${API_BASE_URL}/notifications`,
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
    LIST: `${API_BASE_URL}/admin/users`,

    /** POST - Create a new user account */
    CREATE: `${API_BASE_URL}/admin/users`,

    /** PUT - Update user account details */
    UPDATE: (id: number) => `${API_BASE_URL}/admin/users/${id}`,

    /** DELETE - Delete a user account */
    DELETE: (id: number) => `${API_BASE_URL}/admin/users/${id}`,

    /** POST - Perform bulk user operations (create, update, delete) */
    BULK: `${API_BASE_URL}/admin/users/bulk`,
  },

  /**
   * Course administration endpoints
   */
  COURSES: {
    /** GET - Retrieve list of all courses in the system */
    LIST: `${API_BASE_URL}/admin/courses`,

    /** GET - Retrieve course categories */
    CATEGORIES: `${API_BASE_URL}/admin/courses/categories`,

    /** POST - Perform bulk course operations */
    BULK: `${API_BASE_URL}/admin/courses/bulk`,
  },

  /**
   * Role management endpoints
   */
  ROLES: {
    /** GET - Retrieve list of all roles in the system */
    LIST: `${API_BASE_URL}/admin/roles`,

    /** POST - Assign a role to a user in a context */
    ASSIGN: `${API_BASE_URL}/admin/roles/assign`,

    /** GET - Retrieve capabilities for a role */
    CAPABILITIES: `${API_BASE_URL}/admin/roles/capabilities`,
  },

  /**
   * System settings endpoints
   */
  SETTINGS: {
    /** GET - Retrieve system settings */
    LIST: `${API_BASE_URL}/admin/settings`,

    /** PUT - Update system settings */
    UPDATE: `${API_BASE_URL}/admin/settings`,
  },

  /**
   * Plugin management endpoints
   */
  PLUGINS: {
    /** GET - Retrieve list of installed plugins */
    LIST: `${API_BASE_URL}/admin/plugins`,

    /** PUT - Configure plugin settings */
    CONFIGURE: (id: string) => `${API_BASE_URL}/admin/plugins/${id}`,
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
  UPLOAD: `${API_BASE_URL}/files/upload`,

  /** GET - Download a file by ID */
  DOWNLOAD: (id: number) => `${API_BASE_URL}/files/download/${id}`,

  /** DELETE - Delete a file */
  DELETE: (id: number) => `${API_BASE_URL}/files/${id}`,

  /** GET - Retrieve list of user's files */
  LIST: `${API_BASE_URL}/files`,

  /** GET - Browse file repository */
  REPOSITORY: `${API_BASE_URL}/files/repository`,

  /** GET - Retrieve file thumbnail/preview */
  THUMBNAIL: (id: number) => `${API_BASE_URL}/files/thumbnail/${id}`,
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
  CALENDAR: `${API_BASE_URL}/blocks/calendar`,

  /** GET - Retrieve upcoming events and deadlines */
  UPCOMING: `${API_BASE_URL}/blocks/upcoming`,

  /** GET - Retrieve recent activity in user's courses */
  RECENT_ACTIVITY: `${API_BASE_URL}/blocks/recent`,

  /** GET - Retrieve list of online users */
  ONLINE_USERS: `${API_BASE_URL}/blocks/online`,

  /** GET - Retrieve timeline of upcoming activities */
  TIMELINE: `${API_BASE_URL}/blocks/timeline`,

  /** GET - Retrieve course overview data */
  OVERVIEW: `${API_BASE_URL}/blocks/overview`,

  /** GET - Retrieve user's badges */
  BADGES: `${API_BASE_URL}/blocks/badges`,

  /** GET - Retrieve recent comments */
  COMMENTS: `${API_BASE_URL}/blocks/comments`,
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
  METHODS: `${API_BASE_URL}/enrollment/methods`,

  /** POST - Enroll a user in a course (admin/teacher) */
  ENROLL: `${API_BASE_URL}/enrollment/enroll`,

  /** POST - Unenroll a user from a course */
  UNENROLL: `${API_BASE_URL}/enrollment/unenroll`,

  /** GET - Retrieve list of enrolled users in a course */
  ENROLLED_USERS: (courseId: number) => `${API_BASE_URL}/enrollment/${courseId}/users`,

  /** POST - Self-enroll in a course */
  SELF_ENROLL: (courseId: number) => `${API_BASE_URL}/enrollment/self/${courseId}`,
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
  COURSES: `${API_BASE_URL}/search/courses`,

  /** GET - Search for users */
  USERS: `${API_BASE_URL}/search/users`,

  /** GET - Global search across all content */
  GLOBAL: `${API_BASE_URL}/search`,
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
  DETAIL: (id: number) => `${API_BASE_URL}/resources/${id}`,

  /** GET - Retrieve files associated with a resource */
  FILES: (id: number) => `${API_BASE_URL}/resources/${id}/files`,

  /** GET - Retrieve page resource content */
  PAGES: (id: number) => `${API_BASE_URL}/resources/pages/${id}`,

  /** GET - Retrieve URL resource details */
  URLS: (id: number) => `${API_BASE_URL}/resources/urls/${id}`,

  /** GET - Retrieve folder resource contents */
  FOLDERS: (id: number) => `${API_BASE_URL}/resources/folders/${id}`,
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
  DETAIL: (id: number) => `${API_BASE_URL}/wiki/${id}`,

  /** GET - Retrieve wiki page by title */
  BY_TITLE: (wikiId: number, title: string) =>
    `${API_BASE_URL}/wiki/${wikiId}/page/${encodeURIComponent(title)}`,

  /** GET - Retrieve first/main page of a wiki */
  FIRST_PAGE: (id: number) => `${API_BASE_URL}/wiki/${id}/firstpage`,

  /** POST - Save wiki page content */
  SAVE: (id: number) => `${API_BASE_URL}/wiki/${id}/save`,

  /** POST - Save a specific section of a wiki page */
  SAVE_SECTION: (id: number) => `${API_BASE_URL}/wiki/${id}/savesection`,

  /** POST - Create a new wiki page */
  CREATE: (id: number) => `${API_BASE_URL}/wiki/${id}/create`,

  /** GET - Retrieve version history of a wiki page */
  HISTORY: (pageId: number) => `${API_BASE_URL}/wiki/page/${pageId}/history`,

  /** GET - Retrieve specific version of a wiki page */
  VERSION: (pageId: number, versionId: number) =>
    `${API_BASE_URL}/wiki/page/${pageId}/version/${versionId}`,

  /** POST - Restore a previous version of a wiki page */
  RESTORE: (pageId: number, versionId: number) =>
    `${API_BASE_URL}/wiki/page/${pageId}/restore/${versionId}`,

  /** GET - Retrieve list of all wiki pages */
  LIST: (id: number) => `${API_BASE_URL}/wiki/${id}/pages`,

  /** GET - Search wiki pages */
  SEARCH: (id: number) => `${API_BASE_URL}/wiki/${id}/search`,

  /** GET - Retrieve links within wiki pages */
  LINKS: (pageId: number) => `${API_BASE_URL}/wiki/page/${pageId}/links`,
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
  DETAIL: (id: number) => `${API_BASE_URL}/lesson/${id}`,

  /** POST - Start a new lesson attempt */
  START: (id: number) => `${API_BASE_URL}/lesson/${id}/start`,

  /** POST - Submit answer for a lesson page */
  SUBMIT: (id: number) => `${API_BASE_URL}/lesson/${id}/submit`,

  /** GET - Retrieve specific lesson page content */
  PAGE: (id: number, pageId: number) => `${API_BASE_URL}/lesson/${id}/page/${pageId}`,

  /** POST - Navigate to next lesson page */
  NEXT_PAGE: (id: number) => `${API_BASE_URL}/lesson/${id}/nextpage`,

  /** POST - Finish lesson attempt */
  FINISH: (id: number) => `${API_BASE_URL}/lesson/${id}/finish`,

  /** POST - Restart lesson from beginning */
  RESTART: (id: number) => `${API_BASE_URL}/lesson/${id}/restart`,

  /** GET - Retrieve list of lesson pages */
  PAGES: (id: number) => `${API_BASE_URL}/lesson/${id}/pages`,

  /** GET - Retrieve user's progress in lesson */
  PROGRESS: (id: number) => `${API_BASE_URL}/lesson/${id}/progress`,

  /** POST - Update lesson timer */
  UPDATE_TIMER: (id: number) => `${API_BASE_URL}/lesson/${id}/timer`,

  /** GET - Retrieve lesson attempt information */
  ATTEMPT: (id: number) => `${API_BASE_URL}/lesson/${id}/attempt`,
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
  DETAIL: (id: number) => `${API_BASE_URL}/workshop/${id}`,

  /** GET - Retrieve workshop submissions */
  SUBMISSIONS: (id: number) => `${API_BASE_URL}/workshop/${id}/submissions`,

  /** POST - Create a new workshop submission */
  CREATE_SUBMISSION: (id: number) => `${API_BASE_URL}/workshop/${id}/submissions`,

  /** PUT - Update workshop submission */
  UPDATE_SUBMISSION: (submissionId: number) =>
    `${API_BASE_URL}/workshop/submissions/${submissionId}`,

  /** DELETE - Delete workshop submission */
  DELETE_SUBMISSION: (submissionId: number) =>
    `${API_BASE_URL}/workshop/submissions/${submissionId}`,

  /** GET - Retrieve peer assessments for a submission */
  ASSESSMENTS: (submissionId: number) =>
    `${API_BASE_URL}/workshop/submissions/${submissionId}/assessments`,

  /** POST - Create a new peer assessment */
  CREATE_ASSESSMENT: (submissionId: number) =>
    `${API_BASE_URL}/workshop/submissions/${submissionId}/assessments`,

  /** PUT - Update peer assessment */
  UPDATE_ASSESSMENT: (assessmentId: number) =>
    `${API_BASE_URL}/workshop/assessments/${assessmentId}`,

  /** POST - Switch workshop to next phase */
  SWITCH_PHASE: (id: number) => `${API_BASE_URL}/workshop/${id}/switchphase`,

  /** POST - Allocate submissions for peer assessment */
  ALLOCATE: (id: number) => `${API_BASE_URL}/workshop/${id}/allocate`,

  /** GET - Retrieve workshop grades */
  GRADES: (id: number) => `${API_BASE_URL}/workshop/${id}/grades`,

  /** PUT - Update workshop grade */
  UPDATE_GRADE: (id: number) => `${API_BASE_URL}/workshop/${id}/grade`,

  /** GET - Retrieve user's assessment plan */
  USER_PLAN: (id: number) => `${API_BASE_URL}/workshop/${id}/userplan`,

  /** GET - Retrieve example submissions */
  EXAMPLES: (id: number) => `${API_BASE_URL}/workshop/${id}/examples`,
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
  DETAIL: (id: number) => `${API_BASE_URL}/glossary/${id}`,

  /** GET - Retrieve all entries in a glossary */
  ENTRIES: (id: number) => `${API_BASE_URL}/glossary/${id}/entries`,

  /** GET - Retrieve specific glossary entry */
  ENTRY: (entryId: number) => `${API_BASE_URL}/glossary/entries/${entryId}`,

  /** POST - Create a new glossary entry */
  CREATE_ENTRY: (id: number) => `${API_BASE_URL}/glossary/${id}/entries`,

  /** PUT - Update a glossary entry */
  UPDATE_ENTRY: (entryId: number) => `${API_BASE_URL}/glossary/entries/${entryId}`,

  /** DELETE - Delete a glossary entry */
  DELETE_ENTRY: (entryId: number) => `${API_BASE_URL}/glossary/entries/${entryId}`,

  /** GET - Retrieve glossary categories */
  CATEGORIES: (id: number) => `${API_BASE_URL}/glossary/${id}/categories`,

  /** GET - Search glossary entries */
  SEARCH: (id: number) => `${API_BASE_URL}/glossary/${id}/search`,
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
  DETAIL: (id: number) => `${API_BASE_URL}/scorm/${id}`,

  /** POST - Launch SCORM package and create attempt */
  LAUNCH: (id: number) => `${API_BASE_URL}/scorm/${id}/launch`,

  /** GET - Retrieve SCORM player interface */
  PLAYER: (id: number) => `${API_BASE_URL}/scorm/${id}/player`,

  /** POST - Track SCORM activity and progress */
  TRACK: (id: number) => `${API_BASE_URL}/scorm/${id}/track`,

  /** GET - Retrieve SCORM attempt results */
  RESULTS: (id: number) => `${API_BASE_URL}/scorm/${id}/results`,
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
  DETAIL: (id: number) => `${API_BASE_URL}/book/${id}`,

  /** GET - Retrieve list of book chapters */
  CHAPTERS: (id: number) => `${API_BASE_URL}/book/${id}/chapters`,

  /** GET - Retrieve specific book chapter content */
  CHAPTER: (id: number, chapterId: number) => `${API_BASE_URL}/book/${id}/chapter/${chapterId}`,

  /** GET - Retrieve book table of contents */
  TOC: (id: number) => `${API_BASE_URL}/book/${id}/toc`,
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
  DETAIL: (id: number) => `${API_BASE_URL}/h5p/${id}`,

  /** POST - Launch H5P content and track interaction */
  LAUNCH: (id: number) => `${API_BASE_URL}/h5p/${id}/launch`,

  /** GET - Retrieve H5P activity results */
  RESULTS: (id: number) => `${API_BASE_URL}/h5p/${id}/results`,

  /** GET - Retrieve user's H5P attempts */
  ATTEMPTS: (id: number) => `${API_BASE_URL}/h5p/${id}/attempts`,
} as const;
