/**
 * Forum Activity API Client Module
 *
 * TypeScript API client module for forum activities providing React Query integration.
 * Exports functions for forum operations including fetching forums, discussions, posts,
 * creating content, and managing subscriptions.
 *
 * All API calls use Axios client with JWT authentication and standardized error handling
 * for all /api/v1/forums/* endpoints. Functions are designed to work with React Query
 * useQuery and useMutation hooks.
 *
 * @package    react-frontend
 * @subpackage features/activities/forums/api
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 *
 * API Endpoints:
 * - GET    /api/v1/forums/{id}                     - Get forum details
 * - GET    /api/v1/forums/{id}/discussions         - Get discussion list
 * - POST   /api/v1/forums/{id}/discussions         - Create discussion
 * - GET    /api/v1/forums/discussions/{id}/posts   - Get discussion posts
 * - POST   /api/v1/forums/discussions/{id}/posts   - Create post/reply
 * - PUT    /api/v1/forums/posts/{id}               - Update post
 * - DELETE /api/v1/forums/posts/{id}               - Delete post
 * - POST   /api/v1/forums/{id}/subscribe           - Subscribe to forum
 * - POST   /api/v1/forums/discussions/{id}/read    - Mark discussion as read
 *
 * Backend References:
 * - public/mod/forum/view.php (forum viewing with forumvault)
 * - public/mod/forum/discuss.php (discussion and posts retrieval)
 * - public/mod/forum/post.php (post creation, editing, deletion)
 * - public/mod/forum/subscribe.php (subscription management)
 * - public/mod/forum/lib.php (core forum functions)
 */

import { apiClient } from '@/services/api/client';
import type {
  CreateDiscussionData,
  CreatePostData,
  UpdatePostData,
  Post,
  DiscussionEnriched,
  Forum,
} from '../types/forum.types';

// Import enums as values (not type-only) since they're used as runtime values
import {
  ForumType,
  ForumSubscriptionMode,
  ForumTrackingType,
} from '../types/forum.types';
import type { PaginationParams } from '@/types/common';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Forum entity returned from API
 * Maps to mod_forum database table and forum entity class
 * Named 'ApiForum' to avoid conflict with canonical Forum type in forum.types.ts
 */
export interface ApiForum {
  /** Forum ID (primary key) */
  id: number;
  /** Forum name/title */
  name: string;
  /** Introduction/description text (HTML) */
  intro: string;
  /** Introduction text format (1=HTML, 2=plain, etc.) */
  introformat: number;
  /** Forum type (general, single, eachuser, qanda, blog, news, social) */
  type: string;
  /** Course ID this forum belongs to */
  courseId: number;
  /** Course module ID (cmid) */
  cmId: number;
  /** Display mode (flat, threaded, nested) */
  displayMode: number;
  /** Subscription mode (0=optional, 1=forced, 2=initial, 3=disabled) */
  subscriptionMode: number;
  /** Tracking type (0=off, 1=optional, 2=forced) */
  trackingType: number;
  /** Maximum attachment size in bytes */
  maxBytes: number;
  /** Maximum number of attachments per post */
  maxAttachments: number;
  /** Whether discussions lock after specified time */
  lockDiscussionAfter: number;
  /** Due date timestamp (0 if none) */
  dueDate: number;
  /** Cut-off date timestamp (0 if none) */
  cutOffDate: number;
  /** Whether current user is subscribed */
  subscribed: boolean;
  /** Whether current user can subscribe/unsubscribe */
  canSubscribe: boolean;
  /** Whether current user can create discussions */
  canAddDiscussion: boolean;
  /** Whether current user has moderation rights */
  canModerate: boolean;
  /** Number of unread posts for current user */
  unreadCount: number;
  /** Total number of discussions */
  discussionCount: number;
  /** Total number of posts */
  postCount: number;
  /** Number of participants */
  participants: number;
}

/**
 * Discussion entity returned from API
 * Enriched with user info and counts for display
 * Named 'ApiDiscussion' to avoid conflict with canonical Discussion type in forum.types.ts
 */
export interface ApiDiscussion {
  /** Discussion ID */
  id: number;
  /** Discussion name/subject */
  name: string;
  /** First post message content */
  message: string;
  /** User ID who created the discussion */
  userid: number;
  /** Full name of discussion creator */
  userFullName: string;
  /** URL to user's profile picture */
  userPictureUrl: string | null;
  /** Timestamp of last modification */
  timemodified: number;
  /** Whether the discussion is locked */
  locked: boolean;
  /** Whether the discussion is pinned */
  pinned: boolean;
  /** Number of replies in the discussion */
  replies: number;
  /** Number of unread posts for current user */
  unreadCount: number;
  /** Forum ID this discussion belongs to */
  forumid: number;
  /** Course ID */
  courseid: number;
  /** ID of the first post */
  firstpostid: number;
  /** Group ID (0 for all groups) */
  groupid: number;
  /** Creation timestamp */
  created: number;
}

/**
 * Post entity returned from API
 * Represents a single post within a discussion
 * Named 'ApiPost' to avoid conflict with canonical Post type in forum.types.ts
 */
export interface ApiPost {
  /** Post ID */
  id: number;
  /** Discussion ID this post belongs to */
  discussionid: number;
  /** Post subject/title */
  subject: string;
  /** Post message content (HTML) */
  message: string;
  /** Message format */
  messageformat: number;
  /** User ID of post author */
  userid: number;
  /** Full name of post author */
  userFullName: string;
  /** URL to author's profile picture */
  userPictureUrl: string | null;
  /** Creation timestamp */
  created: number;
  /** Last modification timestamp */
  modified: number;
  /** Parent post ID (0 for first post) */
  parent: number;
  /** Whether post has attachments */
  hasattachments: boolean;
  /** Array of attachment info */
  attachments: PostAttachment[];
  /** Whether post has child replies */
  haschildren: boolean;
  /** Nested child posts (if threaded display) */
  children: ApiPost[];
  /** Whether current user can edit this post */
  canEdit: boolean;
  /** Whether current user can delete this post */
  canDelete: boolean;
  /** Whether current user can reply to this post */
  canReply: boolean;
  /** Whether this post is unread */
  unread: boolean;
}

/**
 * Post attachment information
 */
export interface PostAttachment {
  /** Attachment ID */
  id: number;
  /** Original filename */
  filename: string;
  /** File size in bytes */
  filesize: number;
  /** MIME type */
  mimetype: string;
  /** Download URL */
  url: string;
}

// ============================================================================
// TRANSFORMATION FUNCTIONS
// ============================================================================

/**
 * Transform an API post to the canonical Post type
 * Maps API field names to the Moodle entity field names used in forum.types.ts
 *
 * @param apiPost - The post returned from the API
 * @returns Post in canonical format
 */
function transformApiPostToCanonical(apiPost: ApiPost): Post {
  return {
    id: apiPost.id,
    discussionid: apiPost.discussionid,
    parentid: apiPost.parent, // API uses 'parent', canonical uses 'parentid'
    authorid: apiPost.userid, // API uses 'userid', canonical uses 'authorid'
    timecreated: apiPost.created, // API uses 'created', canonical uses 'timecreated'
    timemodified: apiPost.modified, // API uses 'modified', canonical uses 'timemodified'
    subject: apiPost.subject,
    message: apiPost.message,
    messageformat: apiPost.messageformat,
    hasattachments: apiPost.hasattachments,
    // Default values for fields not provided by API
    mailed: true, // Assume mailed since it's visible
    messagetrust: false,
    totalscore: 0,
    mailnow: false,
    deleted: false,
    privatereplyto: 0,
    wordcount: apiPost.message.split(/\s+/).filter(Boolean).length,
    charcount: apiPost.message.length,
  };
}

/**
 * Transform an array of API posts to canonical Post array
 * Also handles nested children recursively
 *
 * @param apiPosts - Array of posts from API
 * @returns Array of posts in canonical format
 */
export function transformApiPostsToCanonical(apiPosts: ApiPost[]): Post[] {
  return apiPosts.map(transformApiPostToCanonical);
}

/**
 * Extended Post type with display properties
 * Used internally for API responses that include extra display data
 */
export interface PostWithDisplayInfo extends Post {
  /** Full name of post author */
  userFullName?: string;
  /** URL to author's profile picture */
  userPictureUrl?: string | null;
  /** Whether post has child replies */
  haschildren?: boolean;
  /** Nested child posts (if threaded display) */
  children?: PostWithDisplayInfo[];
  /** Whether current user can edit this post */
  canEdit?: boolean;
  /** Whether current user can delete this post */
  canDelete?: boolean;
  /** Whether current user can reply to this post */
  canReply?: boolean;
  /** Whether this post is unread */
  unread?: boolean;
  /** Array of attachment info */
  attachments?: PostAttachment[];
}

/**
 * Transform an API post to PostWithDisplayInfo
 * Preserves both canonical fields and display-specific fields
 *
 * @param apiPost - The post returned from the API
 * @returns PostWithDisplayInfo with all display properties
 */
function transformApiPostToDisplayInfo(apiPost: ApiPost): PostWithDisplayInfo {
  const canonicalPost = transformApiPostToCanonical(apiPost);
  return {
    ...canonicalPost,
    userFullName: apiPost.userFullName,
    userPictureUrl: apiPost.userPictureUrl,
    haschildren: apiPost.haschildren,
    children: apiPost.children?.map(transformApiPostToDisplayInfo) ?? [],
    canEdit: apiPost.canEdit,
    canDelete: apiPost.canDelete,
    canReply: apiPost.canReply,
    unread: apiPost.unread,
    attachments: apiPost.attachments,
  };
}

/**
 * Transform array of API posts to PostWithDisplayInfo array
 *
 * @param apiPosts - Array of posts from API
 * @returns Array of posts with display info
 */
export function transformApiPostsToDisplayInfo(apiPosts: ApiPost[]): PostWithDisplayInfo[] {
  return apiPosts.map(transformApiPostToDisplayInfo);
}

/**
 * Map API subscription mode number to canonical ForumSubscriptionMode enum
 * ForumSubscriptionMode is an enum with numeric values: CHOOSE=0, FORCE=1, INITIAL=2, DISALLOW=3
 */
function mapSubscriptionMode(mode: number): ForumSubscriptionMode {
  // API uses 0=choose, 1=force, 2=initial, 3=disallow - same as enum
  const validModes = [
    ForumSubscriptionMode.CHOOSE,
    ForumSubscriptionMode.FORCE,
    ForumSubscriptionMode.INITIAL,
    ForumSubscriptionMode.DISALLOW,
  ];
  if (validModes.includes(mode)) {
    return mode as ForumSubscriptionMode;
  }
  return ForumSubscriptionMode.CHOOSE; // Default fallback
}

/**
 * Map API tracking type number to canonical ForumTrackingType enum
 * ForumTrackingType is an enum with numeric values: OFF=0, OPTIONAL=1, FORCED=2
 */
function mapTrackingType(type: number): ForumTrackingType {
  // API uses 0=off, 1=optional, 2=forced - same as enum
  const validTypes = [
    ForumTrackingType.OFF,
    ForumTrackingType.OPTIONAL,
    ForumTrackingType.FORCED,
  ];
  if (validTypes.includes(type)) {
    return type as ForumTrackingType;
  }
  return ForumTrackingType.OFF; // Default fallback
}

/**
 * Map API forum type string to canonical ForumType enum
 * ForumType is an enum with string values like 'general', 'single', etc.
 */
function mapForumType(type: string): ForumType {
  // Mapping from API string to ForumType enum value
  const typeMap: Record<string, ForumType> = {
    'general': ForumType.GENERAL,
    'single': ForumType.SINGLE,
    'eachuser': ForumType.EACHUSER,
    'qanda': ForumType.QANDA,
    'blog': ForumType.BLOG,
    'news': ForumType.NEWS,
    'social': ForumType.SOCIAL,
  };
  return typeMap[type] ?? ForumType.GENERAL; // Default fallback
}

/**
 * Transform an API forum to the canonical Forum type
 * Maps API field names and values to the Moodle entity structure
 *
 * @param apiForum - The forum returned from the API
 * @returns Forum in canonical format with default values for missing fields
 */
function transformApiForumToCanonical(apiForum: ApiForum): Forum {
  return {
    id: apiForum.id,
    courseid: apiForum.courseId, // API uses courseId, canonical uses courseid
    type: mapForumType(apiForum.type),
    name: apiForum.name,
    intro: apiForum.intro,
    introformat: apiForum.introformat,
    // Assessment fields - default to 0 (disabled) since API doesn't provide
    assessed: 0,
    assesstimestart: 0,
    assesstimefinish: 0,
    scale: 0,
    // Grade fields - default to 0
    gradeforum: 0,
    gradeforumnotify: false,
    // Attachment limits from API
    maxbytes: apiForum.maxBytes,
    maxattachments: apiForum.maxAttachments,
    // Subscription and tracking settings
    forcesubscribe: mapSubscriptionMode(apiForum.subscriptionMode),
    trackingtype: mapTrackingType(apiForum.trackingType),
    // RSS settings - default to 0 (disabled)
    rsstype: 0,
    rssarticles: 0,
    // Timestamps
    timemodified: Date.now() / 1000, // Use current time as fallback
    // Posting limits - default to 0 (unlimited)
    warnafter: 0,
    blockafter: 0,
    blockperiod: 0,
    // Completion settings - default to 0 (disabled)
    completiondiscussions: 0,
    completionreplies: 0,
    completionposts: 0,
    // Display settings from API
    displaywordcount: true,
    lockdiscussionafter: apiForum.lockDiscussionAfter,
    duedate: apiForum.dueDate,
    cutoffdate: apiForum.cutOffDate,
    // User-specific context fields (defaults for API which may not include these)
    // These should be populated from user context when available
    subscribed: apiForum.subscribed ?? false,
    canSubscribe: apiForum.canSubscribe ?? true,
    canAddDiscussion: apiForum.canAddDiscussion ?? true,
    canModerate: apiForum.canModerate ?? false,
    // Statistics fields - defaults, should be populated from separate API calls if needed
    unreadCount: apiForum.unreadCount ?? 0,
    discussionCount: apiForum.discussionCount ?? 0,
    postCount: apiForum.postCount ?? 0,
    participants: apiForum.participants ?? 0,
  };
}

// ============================================================================
// FETCH PARAMETERS
// ============================================================================

/**
 * Parameters for fetching discussions list
 * Extends pagination with forum-specific options
 */
export interface DiscussionFetchParams extends Partial<PaginationParams> {
  /** Search query string */
  search?: string;
  /** Sort field */
  sortBy?: 'date' | 'replies' | 'author';
  /** Sort order ('asc' ascending, 'desc' descending) */
  sortOrder?: 'asc' | 'desc';
  /** Filter type */
  filter?: 'all' | 'unread' | 'pinned';
  /** Group ID filter */
  groupid?: number;
}

/**
 * Re-export CreatePostData and UpdatePostData from forum.types.ts for backward compatibility
 * These are the canonical types used across the module
 */
export type { CreatePostData, UpdatePostData } from '../types/forum.types';

/**
 * Re-export canonical types from forum.types.ts for consumers
 * that need the Moodle-aligned entity types
 */
export type {
  Forum,
  Discussion,
  Post,
  Author,
  DiscussionDetail,
  DiscussionEnriched,
  PostResponse,
} from '../types/forum.types';

/**
 * Standard API response envelope
 */
interface ApiResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data payload */
  data: T;
  /** Error information (when success=false) */
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  /** Response metadata */
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Paginated discussions response from API
 * 
 * The response structure matches what frontend components expect:
 * - `data.items` contains the array of discussions
 * - `data.total` contains the total count
 * - Additional pagination metadata is in `meta`
 */
export interface PaginatedDiscussionsResponse {
  /** Data container with items and total for component compatibility */
  data: {
    /** Array of discussions (aliased as items for component compatibility) */
    items: DiscussionEnriched[];
    /** Total count of discussions */
    total: number;
  };
  /** Pagination metadata */
  meta: {
    /** Current page number */
    page: number;
    /** Items per page */
    perPage: number;
    /** Total number of pages */
    totalPages: number;
    /** Whether there are more pages */
    hasMore: boolean;
  };
  // Legacy properties for backward compatibility with older components
  /** Array of discussions (legacy - use data.items instead) */
  discussions: DiscussionEnriched[];
  /** Total count of discussions (legacy - use data.total instead) */
  total: number;
  /** Current page number (legacy) */
  page: number;
  /** Items per page (legacy) */
  perPage: number;
  /** Total number of pages (legacy) */
  totalPages: number;
}

/**
 * Subscription response from API
 */
export interface SubscriptionResponse {
  /** Whether user is now subscribed */
  subscribed: boolean;
  /** Success message */
  message: string;
}

/**
 * Mark read response from API
 */
export interface MarkReadResponse {
  /** Number of posts marked as read */
  postsRead: number;
  /** Updated unread count */
  unreadCount: number;
  /** Success message */
  message: string;
}

/**
 * Post mutation response (create/update)
 * Extends canonical Post with the mutated data plus success/error info
 * 
 * Note: We use `statusMessage` instead of `message` since Post already has a required
 * `message` field for the post content.
 */
export interface PostMutationResponse extends Post {
  /** Discussion ID (alias for discussionid) */
  discussionId: number;
  /** Success/status message from the API (not to be confused with post content) */
  statusMessage?: string;
  /** The raw API post object (for advanced use) */
  _apiPost?: ApiPost;
}

/**
 * Discussion creation response
 */
export interface DiscussionResponse {
  /** Created discussion */
  discussion: ApiDiscussion;
  /** Success message */
  message: string;
}

/**
 * Moderation action response (pin, unpin, lock, unlock, move, split)
 */
export interface ModerationResponse {
  /** Whether the action was successful */
  success: boolean;
  /** Success or error message */
  message: string;
  /** ID of the affected discussion */
  discussionId: number;
  /** The discussion object (for optimistic updates) */
  discussion?: ApiDiscussion;
  /** Updated state after moderation (e.g., isPinned, isLocked) */
  state?: {
    pinned?: boolean;
    locked?: boolean;
    forumId?: number;
    newDiscussionId?: number;
  };
}

/**
 * Report post response
 */
export interface ReportResponse {
  /** Whether the report was submitted successfully */
  success: boolean;
  /** Confirmation message */
  message: string;
  /** Report ID for tracking */
  reportId: number;
  /** Status of the report (pending, reviewed, resolved) */
  status: 'pending' | 'reviewed' | 'resolved';
}

/**
 * Discussion with its posts for combined fetching
 * Uses canonical Post type for consistency with the rest of the module
 */
export interface DiscussionWithPosts {
  /** Discussion details (enriched API format) */
  discussion: ApiDiscussion;
  /** Array of posts in the discussion (canonical format) */
  posts: Post[];
  /** Total number of posts */
  totalPosts: number;
  /** Whether there are more posts to load */
  hasMore: boolean;
  /** Current page (for pagination) */
  currentPage: number;
  /** Cursor for next page (for cursor-based pagination) */
  nextCursor?: string;
  /** Whether user is subscribed to this discussion */
  subscribed?: boolean;
}

/**
 * Data for locking/unlocking a discussion
 */
export interface LockDiscussionData {
  /** Discussion ID to lock/unlock */
  discussionId: number;
  /** Reason for locking (optional) */
  reason?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract data from API response envelope
 * 
 * Validates the response structure and extracts the data payload.
 * Throws an error if the response indicates failure.
 *
 * @template T - Type of the data payload
 * @param response - Axios response containing the API envelope
 * @returns The extracted data payload
 * @throws Error if the API response indicates failure
 */
function extractData<T>(response: { data: ApiResponse<T> }): T {
  if (!response.data.success && response.data.error) {
    const error = new Error(response.data.error.message);
    (error as Error & { code: string }).code = response.data.error.code;
    throw error;
  }
  return response.data.data;
}

/**
 * Transform API error to user-friendly error
 * 
 * Handles common HTTP error codes and API-specific error responses,
 * converting them to descriptive error messages for the UI.
 *
 * @param error - The caught error (axios or API error)
 * @returns Error with user-friendly message
 */
function handleApiError(error: unknown): Error {
  // Handle axios errors
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as {
      response?: {
        status: number;
        data?: ApiResponse<unknown>;
      };
      message: string;
    };

    const status = axiosError.response?.status;
    const apiError = axiosError.response?.data?.error;

    // Map status codes to user-friendly messages
    switch (status) {
      case 401:
        return new Error('You must be logged in to perform this action');
      case 403:
        return new Error(apiError?.message ?? 'You do not have permission to perform this action');
      case 404:
        return new Error(apiError?.message ?? 'The requested resource was not found');
      case 409:
        return new Error(apiError?.message ?? 'A conflict occurred. Please refresh and try again');
      case 422:
        return new Error(apiError?.message ?? 'Invalid data provided');
      case 429:
        return new Error('Too many requests. Please wait a moment and try again');
      case 500:
      case 502:
      case 503:
        return new Error('A server error occurred. Please try again later');
      default:
        return new Error(apiError?.message ?? axiosError.message ?? 'An unexpected error occurred');
    }
  }

  // Handle other errors
  if (error instanceof Error) {
    return error;
  }

  return new Error('An unexpected error occurred');
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch forum activity details
 *
 * Retrieves comprehensive forum information including configuration, type,
 * subscription mode, tracking settings, and current user permissions.
 * 
 * Based on public/mod/forum/view.php which uses forumvault to get forum by ID.
 *
 * @param id - Forum module ID
 * @returns Promise resolving to Forum data
 * @throws Error if forum not found (404) or access denied (403)
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const forum = await fetchForum(123);
 * console.log(forum.name, forum.type);
 * 
 * // With React Query
 * const { data, isLoading } = useQuery({
 *   queryKey: ['forums', forumId],
 *   queryFn: () => fetchForum(forumId)
 * });
 * ```
 */
export async function fetchForum(id: number): Promise<Forum> {
  try {
    const response = await apiClient.get<ApiResponse<ApiForum>>(`/forums/${id}`);
    const apiForum = extractData(response);
    // Transform the API response to the canonical Forum type
    return transformApiForumToCanonical(apiForum);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Fetch paginated list of discussions in a forum
 *
 * Retrieves discussions with support for pagination, sorting, and filtering.
 * Returns enriched discussion data including user info and reply counts.
 * 
 * Based on public/mod/forum/view.php lines 35-45 which use discussionlistvault.
 *
 * @param forumId - Forum module ID
 * @param params - Optional pagination and filter parameters
 * @returns Promise resolving to paginated discussions response
 * @throws Error if forum not found (404) or access denied (403)
 * 
 * @example
 * ```typescript
 * // Basic usage with pagination
 * const result = await fetchDiscussions(123, { page: 1, perPage: 20 });
 * console.log(result.discussions, result.total);
 * 
 * // With search and sort
 * const result = await fetchDiscussions(123, {
 *   page: 1,
 *   perPage: 10,
 *   search: 'assignment',
 *   sortOrder: -1 // newest first
 * });
 * 
 * // With React Query
 * const { data, isLoading } = useQuery({
 *   queryKey: ['forums', forumId, 'discussions', params],
 *   queryFn: () => fetchDiscussions(forumId, params)
 * });
 * ```
 */
export async function fetchDiscussions(
  forumId: number,
  params?: DiscussionFetchParams
): Promise<PaginatedDiscussionsResponse> {
  try {
    // Build query parameters
    const queryParams: Record<string, string | number | undefined> = {};
    
    if (params?.page !== undefined) {
      queryParams.page = params.page;
    }
    if (params?.perPage !== undefined) {
      queryParams.perPage = params.perPage;
    }
    if (params?.search !== undefined && params.search.trim() !== '') {
      queryParams.search = params.search.trim();
    }
    if (params?.sortOrder !== undefined) {
      queryParams.sortOrder = params.sortOrder;
    }
    if (params?.filter !== undefined) {
      queryParams.filter = params.filter;
    }
    if (params?.groupid !== undefined) {
      queryParams.groupid = params.groupid;
    }
    // Map sortBy from component format to API format
    if (params?.sortBy !== undefined) {
      queryParams.sortBy = params.sortBy;
    }

    // API may return different formats depending on version, so we handle both
    const response = await apiClient.get<ApiResponse<{
      discussions?: DiscussionEnriched[];
      data?: DiscussionEnriched[] | { items: DiscussionEnriched[]; total: number };
      items?: DiscussionEnriched[];
      total?: number;
      page?: number;
      perPage?: number;
      totalPages?: number;
      hasMore?: boolean;
      meta?: {
        total?: number;
        page?: number;
        perPage?: number;
        totalPages?: number;
        hasMore?: boolean;
      };
    }>>(
      `/forums/${forumId}/discussions`,
      { params: queryParams }
    );
    
    const rawData = extractData(response);
    
    // Normalize the response to the expected format
    // API may return discussions in different properties
    let discussions: DiscussionEnriched[];
    let total: number;
    
    // Check various possible response formats from the API
    if (Array.isArray(rawData.data)) {
      // Format: { data: Discussion[], meta: {...} }
      discussions = rawData.data;
      total = rawData.meta?.total ?? rawData.total ?? discussions.length;
    } else if (rawData.data && 'items' in rawData.data) {
      // Format: { data: { items: Discussion[], total: number }, meta: {...} }
      ({ items: discussions, total } = rawData.data);
    } else if (rawData.discussions) {
      // Format: { discussions: Discussion[], total: number, ... }
      ({ discussions } = rawData);
      total = rawData.total ?? discussions.length;
    } else if (rawData.items) {
      // Format: { items: Discussion[], total: number, ... }
      discussions = rawData.items;
      total = rawData.total ?? discussions.length;
    } else {
      // Fallback: assume rawData is the discussions array
      discussions = [];
      total = 0;
    }
    
    // Extract pagination info
    const page = rawData.meta?.page ?? rawData.page ?? params?.page ?? 1;
    const perPage = rawData.meta?.perPage ?? rawData.perPage ?? params?.perPage ?? 20;
    const totalPages = rawData.meta?.totalPages ?? rawData.totalPages ?? Math.ceil(total / perPage);
    const hasMore = rawData.meta?.hasMore ?? rawData.hasMore ?? (page < totalPages);
    
    // Construct the normalized response
    return {
      data: {
        items: discussions,
        total,
      },
      meta: {
        page,
        perPage,
        totalPages,
        hasMore,
      },
      // Legacy properties
      discussions,
      total,
      page,
      perPage,
      totalPages,
    };
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Create a new discussion in a forum
 *
 * Creates a new discussion topic with the first post. Supports file attachments
 * and automatic subscription options.
 * 
 * Based on public/mod/forum/post.php which creates discussions with forum_add_discussion().
 *
 * @param forumId - Forum module ID
 * @param data - Discussion creation data (subject, message, attachments)
 * @returns Promise resolving to created discussion
 * @throws Error if validation fails, forum not found, or creation not allowed
 * 
 * @example
 * ```typescript
 * // Basic discussion creation
 * const result = await createDiscussion(123, {
 *   subject: 'New Topic',
 *   message: '<p>Discussion content here</p>'
 * });
 * 
 * // With attachments
 * const result = await createDiscussion(123, {
 *   subject: 'Topic with File',
 *   message: 'See attached document',
 *   attachments: [fileObject]
 * });
 * 
 * // With React Query mutation
 * const mutation = useMutation({
 *   mutationFn: (data) => createDiscussion(forumId, data),
 *   onSuccess: () => queryClient.invalidateQueries(['forums', forumId, 'discussions'])
 * });
 * ```
 */
export async function createDiscussion(
  forumId: number,
  data: CreateDiscussionData
): Promise<DiscussionResponse> {
  try {
    // Use FormData for file upload support
    const formData = new FormData();
    formData.append('subject', data.subject);
    formData.append('message', data.message);

    // Add subscription preference if provided
    if (data.subscribe !== undefined) {
      formData.append('subscribe', String(data.subscribe));
    }

    // Add pinned status if provided (moderator only)
    if (data.pinned !== undefined) {
      formData.append('pinned', String(data.pinned));
    }

    // Add file attachments
    if (data.attachments && data.attachments.length > 0) {
      data.attachments.forEach((file, index) => {
        formData.append(`attachments[${index}]`, file);
      });
    }

    const response = await apiClient.post<ApiResponse<DiscussionResponse>>(
      `/forums/${forumId}/discussions`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Fetch posts in a discussion thread
 *
 * Retrieves all posts in a discussion with threaded structure support.
 * Posts are returned with parent-child relationships, user info, and permissions.
 * Also returns discussion metadata for combined fetching.
 * 
 * Based on public/mod/forum/discuss.php lines 43-49 which retrieve discussion and posts.
 *
 * @param discussionId - Discussion ID
 * @returns Promise resolving to DiscussionWithPosts containing posts, discussion info, and pagination
 * @throws Error if discussion not found (404) or access denied (403)
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const result = await fetchPosts(456);
 * result.posts.forEach(post => console.log(post.subject, post.message));
 * 
 * // Access discussion and pagination info
 * console.log(result.discussion.name, result.hasMore);
 * 
 * // With React Query
 * const { data, isLoading } = useQuery({
 *   queryKey: ['discussions', discussionId, 'posts'],
 *   queryFn: () => fetchPosts(discussionId)
 * });
 * ```
 */
export async function fetchPosts(discussionId: number): Promise<DiscussionWithPosts> {
  try {
    // API returns discussion metadata along with posts
    const response = await apiClient.get<ApiResponse<{
      discussion: ApiDiscussion;
      posts: ApiPost[];
      totalPosts: number;
      hasMore: boolean;
      nextCursor?: string;
      subscribed?: boolean;
    }>>(
      `/forums/discussions/${discussionId}/posts`
    );
    const data = extractData(response);
    
    // Transform API posts to canonical Post type
    const transformedPosts = data.posts.map(transformApiPostToCanonical);
    
    return {
      discussion: data.discussion,
      posts: transformedPosts,
      totalPosts: data.totalPosts ?? data.posts.length,
      hasMore: data.hasMore ?? false,
      currentPage: 1,
      nextCursor: data.nextCursor,
      subscribed: data.subscribed,
    };
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Create a new post (reply) in a discussion
 *
 * Adds a reply to an existing discussion. Supports nested replies via parent
 * post ID and file attachments. Private replies are visible only to the poster
 * and instructors.
 * 
 * Based on public/mod/forum/post.php lines 29-42 which handle reply creation.
 *
 * @param discussionId - Discussion ID to post in
 * @param data - Post creation data (message, parent, attachments)
 * @returns Promise resolving to created post
 * @throws Error if validation fails or discussion is locked
 * 
 * @example
 * ```typescript
 * // Simple reply
 * const result = await createPost(456, {
 *   message: '<p>My reply content</p>'
 * });
 * 
 * // Nested reply to specific post
 * const result = await createPost(456, {
 *   subject: 'Re: Original Subject',
 *   message: 'Reply to your point',
 *   parent: 789  // Parent post ID
 * });
 * 
 * // With React Query mutation
 * const mutation = useMutation({
 *   mutationFn: (data) => createPost(discussionId, data),
 *   onSuccess: () => queryClient.invalidateQueries(['discussions', discussionId, 'posts'])
 * });
 * ```
 */
export async function createPost(
  data: CreatePostData
): Promise<PostMutationResponse> {
  // Extract discussionId from data - required for posting to a discussion
  const { discussionId, parentPostId, subject, message, subscribe, attachments } = data;
  
  if (!discussionId) {
    throw new Error('discussionId is required to create a post');
  }
  
  try {
    // Use FormData for file upload support
    const formData = new FormData();
    formData.append('message', message);

    // Add subject if provided
    if (subject !== undefined && subject.trim() !== '') {
      formData.append('subject', subject);
    }

    // Add parent post ID for nested replies
    if (parentPostId !== undefined) {
      formData.append('parent', String(parentPostId));
    }

    // Add subscription preference
    if (subscribe !== undefined) {
      formData.append('subscribe', subscribe ? '1' : '0');
    }

    // Add file attachments
    if (attachments && attachments.length > 0) {
      attachments.forEach((file, index) => {
        formData.append(`attachments[${index}]`, file);
      });
    }

    const response = await apiClient.post<ApiResponse<PostMutationResponse>>(
      `/forums/discussions/${discussionId}/posts`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Update an existing post
 *
 * Edits post subject and/or message content. Supports adding new attachments
 * and removing existing ones. Validates user permission to edit.
 * 
 * Based on public/mod/forum/post.php edit parameter which modifies existing posts.
 *
 * @param postId - Post ID to update
 * @param data - Updated post data (subject, message, attachments)
 * @returns Promise resolving to updated post
 * @throws Error if unauthorized (403), not found (404), or concurrent edit (409)
 * 
 * @example
 * ```typescript
 * // Update message only
 * const result = await updatePost(789, {
 *   message: '<p>Updated content</p>'
 * });
 * 
 * // Update subject and message
 * const result = await updatePost(789, {
 *   subject: 'Updated Subject',
 *   message: 'Updated content'
 * });
 * 
 * // Remove attachments
 * const result = await updatePost(789, {
 *   message: 'Content without files',
 *   removeAttachments: [attachmentId1, attachmentId2]
 * });
 * 
 * // With React Query mutation
 * const mutation = useMutation({
 *   mutationFn: ({ postId, data }) => updatePost(postId, data),
 *   onSuccess: () => queryClient.invalidateQueries(['discussions'])
 * });
 * ```
 */
export async function updatePost(
  data: UpdatePostData
): Promise<PostMutationResponse> {
  // Extract postId from data - required for identifying the post to update
  const { postId, subject, message, attachments, removeAttachments, version } = data;
  
  if (!postId) {
    throw new Error('postId is required to update a post');
  }
  
  try {
    // Use FormData for file upload support
    const formData = new FormData();
    formData.append('message', message);

    // Add subject if provided
    if (subject !== undefined) {
      formData.append('subject', subject);
    }

    // Add new file attachments
    if (attachments && attachments.length > 0) {
      attachments.forEach((file, index) => {
        formData.append(`attachments[${index}]`, file);
      });
    }

    // Add attachment IDs to remove
    if (removeAttachments && removeAttachments.length > 0) {
      formData.append('removeAttachments', JSON.stringify(removeAttachments));
    }
    
    // Add version for concurrent edit detection
    if (version !== undefined) {
      formData.append('version', String(version));
    }

    const response = await apiClient.put<ApiResponse<PostMutationResponse>>(
      `/forums/posts/${postId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Delete a post
 *
 * Removes a post from the discussion. If the post has child replies,
 * behavior depends on forum settings (cascade delete or soft delete).
 * Requires confirmation before deletion on the backend.
 * 
 * Based on public/mod/forum/post.php delete parameter which removes posts.
 *
 * @param postId - Post ID to delete
 * @returns Promise resolving to success confirmation
 * @throws Error if unauthorized (403) or not found (404)
 * 
 * @example
 * ```typescript
 * // Delete a post
 * const result = await deletePost(789);
 * console.log(result.message);
 * 
 * // With React Query mutation
 * const mutation = useMutation({
 *   mutationFn: (postId) => deletePost(postId),
 *   onSuccess: () => queryClient.invalidateQueries(['discussions'])
 * });
 * ```
 */
/**
 * Delete response indicating whether the post was soft or hard deleted
 */
export interface DeletePostResponse {
  /** Success message */
  message: string;
  /** True if the post was soft deleted (marked as deleted but preserved) */
  softDeleted?: boolean;
  /** True if the post was hard deleted (permanently removed) */
  hardDeleted?: boolean;
}

export async function deletePost(postId: number): Promise<DeletePostResponse> {
  try {
    const response = await apiClient.delete<ApiResponse<DeletePostResponse>>(
      `/forums/posts/${postId}`
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Subscribe or unsubscribe from a forum
 *
 * Manages the current user's subscription to receive notifications for new
 * discussions and posts in the forum. Pass true to subscribe, false to unsubscribe.
 * 
 * Based on public/mod/forum/subscribe.php which manages forum subscriptions
 * using forum_subscribe() or forum_unsubscribe().
 *
 * @param forumId - Forum module ID
 * @param subscribe - True to subscribe, false to unsubscribe
 * @returns Promise resolving to subscription status
 * @throws Error if subscription not allowed (forced subscription mode)
 * 
 * @example
 * ```typescript
 * // Subscribe to forum
 * const result = await subscribeForum(123, true);
 * console.log(result.subscribed); // true
 * 
 * // Unsubscribe from forum
 * const result = await subscribeForum(123, false);
 * console.log(result.subscribed); // false
 * 
 * // With React Query mutation
 * const mutation = useMutation({
 *   mutationFn: ({ forumId, subscribe }) => subscribeForum(forumId, subscribe),
 *   onSuccess: () => queryClient.invalidateQueries(['forums', forumId])
 * });
 * ```
 */
export async function subscribeForum(
  forumId: number,
  subscribe: boolean
): Promise<SubscriptionResponse> {
  try {
    const endpoint = subscribe
      ? `/forums/${forumId}/subscribe`
      : `/forums/${forumId}/unsubscribe`;

    const response = await apiClient.post<ApiResponse<SubscriptionResponse>>(endpoint);
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Mark a discussion as read
 *
 * Marks all posts in a discussion as read for the current user.
 * Updates the unread count and tracking metadata. Only effective
 * when forum tracking is enabled.
 * 
 * Based on public/mod/forum/discuss.php mark parameter which tracks read status.
 *
 * @param discussionId - Discussion ID to mark as read
 * @returns Promise resolving to read operation result
 * @throws Error if discussion not found (404)
 * 
 * @example
 * ```typescript
 * // Mark discussion as read
 * const result = await markRead(456);
 * console.log(`${result.postsRead} posts marked as read`);
 * console.log(`Remaining unread: ${result.unreadCount}`);
 * 
 * // With React Query mutation
 * const mutation = useMutation({
 *   mutationFn: (discussionId) => markRead(discussionId),
 *   onSuccess: () => {
 *     queryClient.invalidateQueries(['forums']);
 *     queryClient.invalidateQueries(['discussions']);
 *   }
 * });
 * ```
 */
export async function markRead(discussionId: number): Promise<MarkReadResponse> {
  try {
    const response = await apiClient.post<ApiResponse<MarkReadResponse>>(
      `/forums/discussions/${discussionId}/read`
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

// ============================================================================
// QUERY KEY FACTORY
// ============================================================================

/**
 * Query key factory for React Query cache management
 * 
 * Provides consistent query keys for forum-related data to enable
 * proper cache invalidation and data synchronization.
 * 
 * @example
 * ```typescript
 * // Use in queries
 * useQuery({
 *   queryKey: forumKeys.detail(forumId),
 *   queryFn: () => fetchForum(forumId)
 * });
 * 
 * // Invalidate all forum data
 * queryClient.invalidateQueries(forumKeys.all);
 * 
 * // Invalidate specific forum's discussions
 * queryClient.invalidateQueries(forumKeys.discussions(forumId));
 * ```
 */
export const forumKeys = {
  /** Base key for all forum queries */
  all: ['forums'] as const,
  
  /** Key for forum lists */
  lists: () => [...forumKeys.all, 'list'] as const,
  
  /** Key for forum list with filters */
  list: (filters: Record<string, unknown>) => [...forumKeys.lists(), filters] as const,
  
  /** Key for all forum detail queries */
  details: () => [...forumKeys.all, 'detail'] as const,
  
  /** Key for specific forum detail */
  detail: (id: number) => [...forumKeys.details(), id] as const,
  
  /** Key for forum discussions list */
  discussions: (forumId: number) => [...forumKeys.detail(forumId), 'discussions'] as const,
  
  /** Key for discussions with params */
  discussionList: (forumId: number, params: DiscussionFetchParams) =>
    [...forumKeys.discussions(forumId), params] as const,
  
  /** Key for discussion posts */
  posts: (discussionId: number) => ['discussions', discussionId, 'posts'] as const,
} as const;

// ============================================================================
// FUNCTION ALIASES FOR BACKWARD COMPATIBILITY
// ============================================================================

/**
 * Alias for fetchForum - gets forum details by ID
 * @see fetchForum
 */
export const getForum = fetchForum;

/**
 * Alias for fetchDiscussions - gets discussions list for a forum
 * @see fetchDiscussions
 */
export const getDiscussions = fetchDiscussions;

/**
 * Alias for fetchPosts - gets posts for a discussion
 * @see fetchPosts
 */
export const getDiscussionPosts = fetchPosts;

/**
 * Alias for markRead - marks a discussion as read
 * @see markRead
 */
export const markDiscussionRead = markRead;

// ============================================================================
// ADDITIONAL API FUNCTIONS
// ============================================================================

/**
 * Fetch more posts for pagination (cursor-based)
 * 
 * Retrieves additional posts for a discussion beyond the initial page.
 * Used for infinite scroll or "load more" patterns.
 * Supports cursor-based pagination for efficient scrolling.
 *
 * @param discussionId - Discussion ID to fetch posts from
 * @param cursor - Cursor string for the next page (optional for first page)
 * @returns Promise resolving to DiscussionWithPosts with posts and pagination info
 */
export async function fetchMorePosts(
  discussionId: number,
  cursor?: string
): Promise<DiscussionWithPosts> {
  try {
    // Build params - support cursor-based pagination
    const params: Record<string, string | number> = {};
    if (cursor) {
      // If cursor looks like a number, treat as page number (backward compatibility)
      if (/^\d+$/.test(cursor)) {
        params.page = parseInt(cursor, 10);
      } else {
        // Otherwise it's a cursor string
        params.cursor = cursor;
      }
    }
    
    const response = await apiClient.get<ApiResponse<{
      discussion: ApiDiscussion;
      posts: ApiPost[];
      totalPosts: number;
      hasMore: boolean;
      nextCursor?: string;
      currentPage?: number;
      subscribed?: boolean;
    }>>(
      `/forums/discussions/${discussionId}/posts`,
      { params }
    );
    const data = extractData(response);
    
    return {
      discussion: data.discussion,
      posts: data.posts.map(transformApiPostToCanonical),
      totalPosts: data.totalPosts ?? data.posts.length,
      hasMore: data.hasMore ?? false,
      currentPage: data.currentPage ?? 1,
      nextCursor: data.nextCursor,
      subscribed: data.subscribed,
    };
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Fetch replies to a specific post
 *
 * Retrieves direct child posts (replies) for a given post.
 * Used for lazy loading nested replies.
 *
 * @param postId - Parent post ID to fetch replies for
 * @returns Promise resolving to array of reply posts
 */
export async function fetchPostReplies(postId: number): Promise<ApiPost[]> {
  try {
    const response = await apiClient.get<ApiResponse<ApiPost[]>>(
      `/forums/posts/${postId}/replies`
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Unsubscribe from a forum
 *
 * Removes user's subscription to a forum, stopping email notifications
 * for new discussions and posts.
 *
 * @param forumId - Forum ID to unsubscribe from
 * @returns Promise resolving to subscription response
 */
export async function unsubscribeForum(forumId: number): Promise<SubscriptionResponse> {
  try {
    const response = await apiClient.post<ApiResponse<SubscriptionResponse>>(
      `/forums/${forumId}/subscribe`,
      { subscribe: false }
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Subscribe to a discussion
 *
 * Subscribes the user to a specific discussion for notifications.
 * Different from forum-level subscription.
 *
 * @param discussionId - Discussion ID to subscribe to
 * @returns Promise resolving to subscription response
 */
export async function subscribeDiscussion(discussionId: number): Promise<SubscriptionResponse> {
  try {
    const response = await apiClient.post<ApiResponse<SubscriptionResponse>>(
      `/forums/discussions/${discussionId}/subscribe`,
      { subscribe: true }
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Unsubscribe from a discussion
 *
 * Removes user's subscription to a specific discussion.
 *
 * @param discussionId - Discussion ID to unsubscribe from
 * @returns Promise resolving to subscription response
 */
export async function unsubscribeDiscussion(discussionId: number): Promise<SubscriptionResponse> {
  try {
    const response = await apiClient.post<ApiResponse<SubscriptionResponse>>(
      `/forums/discussions/${discussionId}/subscribe`,
      { subscribe: false }
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Mark all discussions in a forum as read
 *
 * Marks all posts in all discussions within a forum as read for the current user.
 *
 * @param forumId - Forum ID to mark as read
 * @returns Promise resolving to mark read response
 */
export async function markForumRead(forumId: number): Promise<MarkReadResponse> {
  try {
    const response = await apiClient.post<ApiResponse<MarkReadResponse>>(
      `/forums/${forumId}/read`
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Pin a discussion
 *
 * Pins a discussion to the top of the forum. Requires moderator permissions.
 *
 * @param discussionId - Discussion ID to pin
 * @returns Promise resolving to moderation response
 */
export async function pinDiscussion(discussionId: number): Promise<ModerationResponse> {
  try {
    const response = await apiClient.post<ApiResponse<ModerationResponse>>(
      `/forums/discussions/${discussionId}/pin`
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Unpin a discussion
 *
 * Removes pin status from a discussion. Requires moderator permissions.
 *
 * @param discussionId - Discussion ID to unpin
 * @returns Promise resolving to moderation response
 */
export async function unpinDiscussion(discussionId: number): Promise<ModerationResponse> {
  try {
    const response = await apiClient.post<ApiResponse<ModerationResponse>>(
      `/forums/discussions/${discussionId}/unpin`
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Lock a discussion
 *
 * Locks a discussion preventing further replies. Requires moderator permissions.
 *
 * @param discussionIdOrData - Discussion ID or lock data object
 * @param reason - Optional reason for locking (when first arg is number)
 * @returns Promise resolving to moderation response
 */
export async function lockDiscussion(
  discussionIdOrData: number | LockDiscussionData,
  reason?: string
): Promise<ModerationResponse> {
  try {
    // Support both number and LockDiscussionData
    const discussionId = typeof discussionIdOrData === 'number' 
      ? discussionIdOrData 
      : discussionIdOrData.discussionId;
    const lockReason = typeof discussionIdOrData === 'number'
      ? reason
      : discussionIdOrData.reason;

    const response = await apiClient.post<ApiResponse<ModerationResponse>>(
      `/forums/discussions/${discussionId}/lock`,
      lockReason ? { reason: lockReason } : {}
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Unlock a discussion
 *
 * Unlocks a previously locked discussion. Requires moderator permissions.
 *
 * @param discussionId - Discussion ID to unlock
 * @returns Promise resolving to moderation response
 */
export async function unlockDiscussion(discussionId: number): Promise<ModerationResponse> {
  try {
    const response = await apiClient.post<ApiResponse<ModerationResponse>>(
      `/forums/discussions/${discussionId}/unlock`
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Move a discussion to another forum
 *
 * Moves a discussion from one forum to another. Requires moderator permissions.
 *
 * @param discussionId - Discussion ID to move
 * @param targetForumId - Target forum ID
 * @returns Promise resolving to moderation response
 */
export async function moveDiscussion(
  discussionId: number,
  targetForumId: number
): Promise<ModerationResponse> {
  try {
    const response = await apiClient.post<ApiResponse<ModerationResponse>>(
      `/forums/discussions/${discussionId}/move`,
      { targetForumId }
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Split a discussion at a specific post
 *
 * Creates a new discussion starting from a specific post.
 * Requires moderator permissions.
 *
 * @param discussionId - Original discussion ID
 * @param postId - Post ID to start the new discussion from
 * @param newSubject - Subject for the new discussion
 * @returns Promise resolving to moderation response with new discussion ID
 */
export async function splitDiscussion(
  discussionId: number,
  postId: number,
  newSubject: string
): Promise<ModerationResponse> {
  try {
    const response = await apiClient.post<ApiResponse<ModerationResponse>>(
      `/forums/discussions/${discussionId}/split`,
      { postId, newSubject }
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Report a post for moderation
 *
 * Submits a report for a post to be reviewed by moderators.
 *
 * @param postId - Post ID to report
 * @param reason - Reason for reporting
 * @returns Promise resolving to report response
 */
export async function reportPost(postId: number, reason: string): Promise<ReportResponse> {
  try {
    const response = await apiClient.post<ApiResponse<ReportResponse>>(
      `/forums/posts/${postId}/report`,
      { reason }
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Delete a discussion
 *
 * Permanently removes a discussion and all its posts.
 * Requires moderator or discussion owner permissions.
 *
 * @param discussionId - Discussion ID to delete
 * @returns Promise resolving to delete response
 */
export async function deleteDiscussion(discussionId: number): Promise<{ success: boolean; message: string }> {
  try {
    const response = await apiClient.delete<ApiResponse<{ success: boolean; message: string }>>(
      `/forums/discussions/${discussionId}`
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Bulk delete multiple discussions
 *
 * Permanently removes multiple discussions at once.
 * Requires moderator permissions.
 *
 * @param discussionIds - Array of discussion IDs to delete
 * @returns Promise resolving to bulk operation response
 */
export async function bulkDeleteDiscussions(
  discussionIds: number[]
): Promise<{ success: boolean; deletedCount: number; failedIds: number[]; message: string }> {
  try {
    const response = await apiClient.post<ApiResponse<{
      success: boolean;
      deletedCount: number;
      failedIds: number[];
      message: string;
    }>>(
      '/forums/discussions/bulk-delete',
      { discussionIds }
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Bulk move multiple discussions to another forum
 *
 * Moves multiple discussions to a target forum at once.
 * Requires moderator permissions.
 *
 * @param discussionIds - Array of discussion IDs to move
 * @param targetForumId - Target forum ID to move discussions to
 * @returns Promise resolving to bulk operation response
 */
export async function bulkMoveDiscussions(
  discussionIds: number[],
  targetForumId: number
): Promise<{ success: boolean; movedCount: number; failedIds: number[]; message: string }> {
  try {
    const response = await apiClient.post<ApiResponse<{
      success: boolean;
      movedCount: number;
      failedIds: number[];
      message: string;
    }>>(
      '/forums/discussions/bulk-move',
      { discussionIds, targetForumId }
    );
    return extractData(response);
  } catch (error) {
    throw handleApiError(error);
  }
}
