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
import type { CreateDiscussionData } from '../types/forum.types';
import type { PaginationParams } from '@/types/common';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Forum entity returned from API
 * Maps to mod_forum database table and forum entity class
 */
export interface Forum {
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
}

/**
 * Discussion entity returned from API
 * Enriched with user info and counts for display
 */
export interface Discussion {
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
 */
export interface Post {
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
  children: Post[];
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

/**
 * Parameters for fetching discussions list
 * Extends pagination with forum-specific options
 */
export interface DiscussionFetchParams extends Partial<PaginationParams> {
  /** Search query string */
  search?: string;
  /** Sort order (1=oldest first, -1=newest first) */
  sortOrder?: number;
  /** Filter type */
  filter?: 'all' | 'unread' | 'pinned';
  /** Group ID filter */
  groupid?: number;
}

/**
 * Data for creating a new post/reply
 */
export interface CreatePostData {
  /** Post subject (optional for replies) */
  subject?: string;
  /** Post message content */
  message: string;
  /** Parent post ID for nested replies */
  parent?: number;
  /** Whether this is a private reply */
  privatereply?: boolean;
  /** File attachments */
  attachments?: File[];
}

/**
 * Data for updating an existing post
 */
export interface UpdatePostData {
  /** Updated subject */
  subject?: string;
  /** Updated message content */
  message: string;
  /** New attachments to add */
  attachments?: File[];
  /** Attachment IDs to remove */
  removeAttachments?: number[];
}

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
 * Paginated response for discussions list
 */
export interface PaginatedDiscussionsResponse {
  /** Array of discussions */
  discussions: Discussion[];
  /** Total count of discussions */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  perPage: number;
  /** Total number of pages */
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
 */
export interface PostMutationResponse {
  /** Created or updated post */
  post: Post;
  /** Discussion ID */
  discussionId: number;
  /** Success message */
  message: string;
}

/**
 * Discussion creation response
 */
export interface DiscussionResponse {
  /** Created discussion */
  discussion: Discussion;
  /** Success message */
  message: string;
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
        return new Error(apiError?.message || 'You do not have permission to perform this action');
      case 404:
        return new Error(apiError?.message || 'The requested resource was not found');
      case 409:
        return new Error(apiError?.message || 'A conflict occurred. Please refresh and try again');
      case 422:
        return new Error(apiError?.message || 'Invalid data provided');
      case 429:
        return new Error('Too many requests. Please wait a moment and try again');
      case 500:
      case 502:
      case 503:
        return new Error('A server error occurred. Please try again later');
      default:
        return new Error(apiError?.message || axiosError.message || 'An unexpected error occurred');
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
    const response = await apiClient.get<ApiResponse<Forum>>(`/forums/${id}`);
    return extractData(response);
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

    const response = await apiClient.get<ApiResponse<PaginatedDiscussionsResponse>>(
      `/forums/${forumId}/discussions`,
      { params: queryParams }
    );
    return extractData(response);
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
 * 
 * Based on public/mod/forum/discuss.php lines 43-49 which retrieve discussion and posts.
 *
 * @param discussionId - Discussion ID
 * @returns Promise resolving to array of posts
 * @throws Error if discussion not found (404) or access denied (403)
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const posts = await fetchPosts(456);
 * posts.forEach(post => console.log(post.subject, post.message));
 * 
 * // Access nested replies
 * const posts = await fetchPosts(456);
 * posts.forEach(post => {
 *   if (post.haschildren) {
 *     post.children.forEach(reply => console.log(reply.subject));
 *   }
 * });
 * 
 * // With React Query
 * const { data, isLoading } = useQuery({
 *   queryKey: ['discussions', discussionId, 'posts'],
 *   queryFn: () => fetchPosts(discussionId)
 * });
 * ```
 */
export async function fetchPosts(discussionId: number): Promise<Post[]> {
  try {
    const response = await apiClient.get<ApiResponse<{ posts: Post[] }>>(
      `/forums/discussions/${discussionId}/posts`
    );
    const data = extractData(response);
    return data.posts;
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
  discussionId: number,
  data: CreatePostData
): Promise<PostMutationResponse> {
  try {
    // Use FormData for file upload support
    const formData = new FormData();
    formData.append('message', data.message);

    // Add subject if provided
    if (data.subject !== undefined && data.subject.trim() !== '') {
      formData.append('subject', data.subject);
    }

    // Add parent post ID for nested replies
    if (data.parent !== undefined) {
      formData.append('parent', String(data.parent));
    }

    // Add private reply flag
    if (data.privatereply !== undefined) {
      formData.append('privatereply', data.privatereply ? '1' : '0');
    }

    // Add file attachments
    if (data.attachments && data.attachments.length > 0) {
      data.attachments.forEach((file, index) => {
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
  postId: number,
  data: UpdatePostData
): Promise<PostMutationResponse> {
  try {
    // Use FormData for file upload support
    const formData = new FormData();
    formData.append('message', data.message);

    // Add subject if provided
    if (data.subject !== undefined) {
      formData.append('subject', data.subject);
    }

    // Add new file attachments
    if (data.attachments && data.attachments.length > 0) {
      data.attachments.forEach((file, index) => {
        formData.append(`attachments[${index}]`, file);
      });
    }

    // Add attachment IDs to remove
    if (data.removeAttachments && data.removeAttachments.length > 0) {
      formData.append('removeAttachments', JSON.stringify(data.removeAttachments));
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
export async function deletePost(postId: number): Promise<{ message: string }> {
  try {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
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
