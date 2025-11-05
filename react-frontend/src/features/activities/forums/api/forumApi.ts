/**
 * Forum Activity API Module
 *
 * Provides API functions for forum activities including discussions, posts,
 * subscriptions, and moderation actions. All functions call the backend API
 * layer which wraps existing Moodle forum functions.
 *
 * @package    react-frontend
 * @subpackage features/activities/forums/api
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 *
 * API Endpoints:
 * - GET    /api/v1/forums/{id}                           - Get forum details
 * - GET    /api/v1/forums/{id}/discussions               - Get discussion list
 * - GET    /api/v1/forums/discussions/{id}/posts         - Get discussion posts
 * - POST   /api/v1/forums/{id}/discussions               - Create discussion
 * - POST   /api/v1/forums/discussions/{id}/posts         - Create post/reply
 * - PUT    /api/v1/forums/posts/{id}                     - Update post
 * - DELETE /api/v1/forums/posts/{id}                     - Delete post
 * - POST   /api/v1/forums/{id}/subscribe                 - Subscribe to forum
 * - POST   /api/v1/forums/{id}/unsubscribe               - Unsubscribe from forum
 * - POST   /api/v1/forums/discussions/{id}/subscribe     - Subscribe to discussion
 * - POST   /api/v1/forums/discussions/{id}/unsubscribe   - Unsubscribe from discussion
 * - POST   /api/v1/forums/discussions/{id}/read          - Mark discussion as read
 * - POST   /api/v1/forums/discussions/{id}/pin           - Pin discussion
 * - POST   /api/v1/forums/discussions/{id}/unpin         - Unpin discussion
 * - POST   /api/v1/forums/discussions/{id}/lock          - Lock discussion
 * - POST   /api/v1/forums/discussions/{id}/unlock        - Unlock discussion
 * - POST   /api/v1/forums/posts/{id}/report              - Report post
 *
 * Backend References:
 * - public/mod/forum/lib.php (forum_get_forum, forum_add_discussion, forum_add_new_post)
 * - public/mod/forum/classes/local/entities/forum.php
 * - public/mod/forum/classes/local/entities/discussion.php
 * - public/mod/forum/classes/local/entities/post.php
 */

import { apiClient, extractData } from '@/services/api/client';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type {
  Forum,
  Discussion,
  Post,
  CreateDiscussionData,
  CreatePostData,
  UpdatePostData,
  DiscussionListOptions,
  SubscriptionPreferences,
} from '../types/forum.types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Response data when creating or updating a discussion
 */
export interface DiscussionResponse {
  /** Created or updated discussion */
  discussion: Discussion;
  /** Success message */
  message: string;
}

/**
 * Response data when creating or updating a post
 */
export interface PostResponse {
  /** Created or updated post */
  post: Post;
  /** Success message */
  message: string;
}

/**
 * Response data for subscription operations
 */
export interface SubscriptionResponse {
  /** Whether user is subscribed */
  subscribed: boolean;
  /** Success message */
  message: string;
}

/**
 * Response data for marking discussion as read
 */
export interface MarkReadResponse {
  /** Number of posts marked as read */
  postsRead: number;
  /** Updated unread count for forum */
  unreadCount: number;
  /** Success message */
  message: string;
}

/**
 * Response data for moderation actions (pin, lock, etc.)
 */
export interface ModerationResponse {
  /** Updated discussion */
  discussion: Discussion;
  /** Success message */
  message: string;
}

/**
 * Response data for reporting a post
 */
export interface ReportResponse {
  /** Report ID */
  reportId: number;
  /** Success message */
  message: string;
}

/**
 * Response data for getting discussion with posts
 */
export interface DiscussionWithPosts {
  /** Discussion metadata */
  discussion: Discussion;
  /** All posts in the discussion (flat array) */
  posts: Post[];
  /** Whether there are more posts to load */
  hasMore?: boolean;
  /** Cursor for next page of posts */
  nextCursor?: string;
}

// ============================================================================
// API FUNCTIONS - FORUM OPERATIONS
// ============================================================================

/**
 * Get forum activity details
 *
 * Retrieves comprehensive forum information including configuration, type,
 * subscription mode, tracking settings, and current user permissions.
 *
 * Maps to PHP endpoint: GET /api/v1/forums/{id}
 * Wraps: forum_get_forum() from lib.php
 *
 * @param forumId - Forum module ID
 * @returns Promise resolving to API response with Forum data
 * @throws Error if forum not found or access denied
 */
export async function getForum(forumId: number): Promise<Forum> {
  const response = await apiClient.get<ApiResponse<Forum>>(`/forums/${forumId}`);
  return extractData(response);
}

/**
 * Get paginated list of discussions in a forum
 *
 * Retrieves discussions with support for pagination, sorting, and filtering.
 * Supports filtering by read status, pinned status, and group membership.
 *
 * Maps to PHP endpoint: GET /api/v1/forums/{id}/discussions
 * Wraps: forum_get_discussions() from lib.php
 *
 * @param forumId - Forum module ID
 * @param options - Optional pagination, sorting, and filtering parameters
 * @returns Promise resolving to paginated response with Discussion array
 * @throws Error if forum not found or access denied
 */
export async function getDiscussions(
  forumId: number,
  options?: DiscussionListOptions
): Promise<PaginatedResponse<Discussion>> {
  const response = await apiClient.get<PaginatedResponse<Discussion>>(
    `/forums/${forumId}/discussions`,
    { params: options }
  );
  return response.data;
}

/**
 * Get all posts in a discussion thread
 *
 * Retrieves complete discussion thread with all posts including nested replies.
 * Posts are returned with parent-child relationships and read status indicators.
 * Also includes the discussion metadata.
 *
 * Maps to PHP endpoint: GET /api/v1/forums/discussions/{id}/posts
 * Wraps: forum_get_all_discussion_posts() from lib.php
 *
 * @param discussionId - Discussion ID
 * @returns Promise resolving to API response with Discussion and Post array
 * @throws Error if discussion not found or access denied
 */
export async function getDiscussionPosts(
  discussionId: number
): Promise<DiscussionWithPosts> {
  const response = await apiClient.get<ApiResponse<DiscussionWithPosts>>(
    `/forums/discussions/${discussionId}/posts`
  );
  return extractData(response);
}

/**
 * Fetch more posts for pagination in a discussion
 *
 * Retrieves the next page of posts using cursor-based pagination.
 * Used for loading additional posts in long discussion threads.
 *
 * Maps to PHP endpoint: GET /api/v1/forums/discussions/{id}/posts?cursor={cursor}
 *
 * @param discussionId - Discussion ID to fetch posts for
 * @param cursor - Pagination cursor from previous response
 * @returns Promise resolving to paginated posts with next cursor
 */
export async function fetchMorePosts(
  discussionId: number,
  cursor: string
): Promise<{ posts: Post[]; hasMore: boolean; nextCursor?: string }> {
  const response = await apiClient.get<ApiResponse<{ posts: Post[]; hasMore: boolean; nextCursor?: string }>>(
    `/forums/discussions/${discussionId}/posts`,
    { params: { cursor } }
  );
  return extractData(response);
}

/**
 * Fetch replies for a specific post (incremental loading of nested replies)
 *
 * Retrieves nested replies for a parent post. Used for incrementally
 * loading deeply nested conversation threads.
 *
 * Maps to PHP endpoint: GET /api/v1/forums/posts/{parentPostId}/replies
 *
 * @param parentPostId - Parent post ID to fetch replies for
 * @returns Promise resolving to replies with pagination info
 */
export async function fetchPostReplies(
  parentPostId: number
): Promise<{ replies: Post[]; hasMore: boolean }> {
  const response = await apiClient.get<ApiResponse<{ replies: Post[]; hasMore: boolean }>>(
    `/forums/posts/${parentPostId}/replies`
  );
  return extractData(response);
}

// ============================================================================
// API FUNCTIONS - DISCUSSION & POST CREATION/EDITING
// ============================================================================

/**
 * Create a new discussion in a forum
 *
 * Creates a new discussion topic with the first post. Supports file attachments
 * and automatic subscription options. Validates subject and message requirements.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/{id}/discussions
 * Wraps: forum_add_discussion() from lib.php
 *
 * @param forumId - Forum module ID
 * @param data - Discussion creation data (subject, message, attachments, subscribe)
 * @returns Promise resolving to API response with created Discussion
 * @throws Error if validation fails or creation not allowed
 */
export async function createDiscussion(
  forumId: number,
  data: CreateDiscussionData
): Promise<DiscussionResponse> {
  const formData = new FormData();
  formData.append('subject', data.subject);
  formData.append('message', data.message);
  
  if (data.subscribe !== undefined) {
    formData.append('subscribe', String(data.subscribe));
  }
  
  if (data.pinned !== undefined) {
    formData.append('pinned', String(data.pinned));
  }
  
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
}

/**
 * Create a new post (reply) in a discussion
 *
 * Adds a reply to an existing discussion. Supports nested replies via parentId
 * and file attachments. Validates message content and parent post existence.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/discussions/{id}/posts
 * Wraps: forum_add_new_post() from lib.php
 *
 * @param discussionId - Discussion ID to post in
 * @param data - Post creation data (message, parentId, attachments)
 * @returns Promise resolving to API response with created Post
 * @throws Error if validation fails or discussion is locked
 */
export async function createPost(
  discussionId: number,
  data: CreatePostData
): Promise<PostResponse> {
  const formData = new FormData();
  formData.append('message', data.message);
  
  if (data.parentId !== undefined) {
    formData.append('parentId', String(data.parentId));
  }
  
  if (data.attachments && data.attachments.length > 0) {
    data.attachments.forEach((file, index) => {
      formData.append(`attachments[${index}]`, file);
    });
  }

  const response = await apiClient.post<ApiResponse<PostResponse>>(
    `/forums/discussions/${discussionId}/posts`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return extractData(response);
}

/**
 * Update an existing post
 *
 * Edits post message and manages attachments (add/remove). Includes concurrent
 * edit detection via version/timestamp to prevent conflicts.
 *
 * Maps to PHP endpoint: PUT /api/v1/forums/posts/{id}
 * Wraps: forum_update_post() from lib.php
 *
 * @param postId - Post ID to update
 * @param data - Post update data (message, attachments to add/remove)
 * @returns Promise resolving to API response with updated Post
 * @throws Error if unauthorized, post not found, or concurrent edit detected (409)
 */
export async function updatePost(
  postId: number,
  data: UpdatePostData
): Promise<PostResponse> {
  const formData = new FormData();
  formData.append('message', data.message);
  
  if (data.attachments && data.attachments.length > 0) {
    data.attachments.forEach((file, index) => {
      formData.append(`attachments[${index}]`, file);
    });
  }
  
  if (data.removeAttachments && data.removeAttachments.length > 0) {
    formData.append('removeAttachments', JSON.stringify(data.removeAttachments));
  }

  const response = await apiClient.put<ApiResponse<PostResponse>>(
    `/forums/posts/${postId}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return extractData(response);
}

/**
 * Delete a post
 *
 * Removes a post from the forum. For parent posts with replies, implements
 * cascade delete or converts to deleted placeholder based on forum settings.
 *
 * Maps to PHP endpoint: DELETE /api/v1/forums/posts/{id}
 * Wraps: forum_delete_post() from lib.php
 *
 * @param postId - Post ID to delete
 * @returns Promise resolving with deletion details (soft/hard delete status)
 * @throws Error if unauthorized or post not found
 */
export async function deletePost(
  postId: number
): Promise<{ softDeleted?: boolean; hardDeleted?: boolean; message?: string }> {
  const response = await apiClient.delete<
    ApiResponse<{ softDeleted?: boolean; hardDeleted?: boolean; message?: string }>
  >(`/forums/posts/${postId}`);
  return extractData(response);
}

// ============================================================================
// API FUNCTIONS - SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Subscribe to a forum
 *
 * Subscribes current user to receive notifications for all new discussions
 * and posts in the forum. Supports custom subscription preferences.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/{id}/subscribe
 * Wraps: forum_subscribe() from lib.php
 *
 * @param forumId - Forum module ID
 * @param preferences - Optional subscription preferences (email, digest settings)
 * @returns Promise resolving to API response with subscription status
 * @throws Error if subscription not allowed
 */
export async function subscribeForum(
  forumId: number,
  preferences?: SubscriptionPreferences
): Promise<SubscriptionResponse> {
  const response = await apiClient.post<ApiResponse<SubscriptionResponse>>(
    `/forums/${forumId}/subscribe`,
    preferences
  );
  return extractData(response);
}

/**
 * Unsubscribe from a forum
 *
 * Removes current user's subscription from the forum, stopping all
 * notification emails for discussions and posts.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/{id}/unsubscribe
 * Wraps: forum_unsubscribe() from lib.php
 *
 * @param forumId - Forum module ID
 * @returns Promise resolving to API response with subscription status
 * @throws Error if unsubscribe not allowed (forced subscription)
 */
export async function unsubscribeForum(
  forumId: number
): Promise<SubscriptionResponse> {
  const response = await apiClient.post<ApiResponse<SubscriptionResponse>>(
    `/forums/${forumId}/unsubscribe`
  );
  return extractData(response);
}

/**
 * Subscribe to a specific discussion
 *
 * Subscribes current user to receive notifications for new posts in a
 * specific discussion, independent of forum subscription.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/discussions/{id}/subscribe
 * Wraps: forum_discussion_subscribe() from lib.php
 *
 * @param discussionId - Discussion ID
 * @returns Promise resolving to API response with subscription status
 */
export async function subscribeDiscussion(
  discussionId: number
): Promise<SubscriptionResponse> {
  const response = await apiClient.post<ApiResponse<SubscriptionResponse>>(
    `/forums/discussions/${discussionId}/subscribe`
  );
  return extractData(response);
}

/**
 * Unsubscribe from a specific discussion
 *
 * Removes current user's subscription from a specific discussion,
 * stopping notification emails for new posts in that discussion.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/discussions/{id}/unsubscribe
 * Wraps: forum_discussion_unsubscribe() from lib.php
 *
 * @param discussionId - Discussion ID
 * @returns Promise resolving to API response with subscription status
 */
export async function unsubscribeDiscussion(
  discussionId: number
): Promise<SubscriptionResponse> {
  const response = await apiClient.post<ApiResponse<SubscriptionResponse>>(
    `/forums/discussions/${discussionId}/unsubscribe`
  );
  return extractData(response);
}

// ============================================================================
// API FUNCTIONS - READ TRACKING
// ============================================================================

/**
 * Mark discussion and all posts as read
 *
 * Marks a complete discussion and all its posts as read for the current user.
 * Updates unread count and tracking metadata.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/discussions/{id}/read
 * Wraps: forum_mark_posts_read() from lib.php
 *
 * @param discussionId - Discussion ID
 * @returns Promise resolving to API response with read count and updated unread total
 */
export async function markDiscussionRead(
  discussionId: number
): Promise<MarkReadResponse> {
  const response = await apiClient.post<ApiResponse<MarkReadResponse>>(
    `/forums/discussions/${discussionId}/read`
  );
  return extractData(response);
}

/**
 * Mark all discussions in a forum as read
 *
 * Marks all discussions and their posts in a forum as read for the current user.
 * Resets the unread count for the forum to zero.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/{id}/mark-read
 * Wraps: forum_mark_all_read() from lib.php
 *
 * @param forumId - Forum module ID
 * @returns Promise resolving to API response with read count and updated unread total
 */
export async function markForumRead(
  forumId: number
): Promise<MarkReadResponse> {
  const response = await apiClient.post<ApiResponse<MarkReadResponse>>(
    `/forums/${forumId}/mark-read`
  );
  return extractData(response);
}

// ============================================================================
// API FUNCTIONS - MODERATION ACTIONS
// ============================================================================

/**
 * Pin a discussion to the top of the forum
 *
 * Moderator action to pin a discussion, keeping it at the top of the discussion
 * list regardless of latest post date. Requires moderation permissions.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/discussions/{id}/pin
 * Wraps: forum_discussion_pin() from lib.php
 *
 * @param discussionId - Discussion ID
 * @returns Promise resolving to API response with updated discussion
 * @throws Error if user lacks moderation permissions (403)
 */
export async function pinDiscussion(
  discussionId: number
): Promise<ModerationResponse> {
  const response = await apiClient.post<ApiResponse<ModerationResponse>>(
    `/forums/discussions/${discussionId}/pin`
  );
  return extractData(response);
}

/**
 * Unpin a discussion
 *
 * Moderator action to remove pin status from a discussion, allowing it to
 * be sorted normally by latest post date.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/discussions/{id}/unpin
 * Wraps: forum_discussion_unpin() from lib.php
 *
 * @param discussionId - Discussion ID
 * @returns Promise resolving to API response with updated discussion
 * @throws Error if user lacks moderation permissions (403)
 */
export async function unpinDiscussion(
  discussionId: number
): Promise<ModerationResponse> {
  const response = await apiClient.post<ApiResponse<ModerationResponse>>(
    `/forums/discussions/${discussionId}/unpin`
  );
  return extractData(response);
}

/**
 * Lock a discussion to prevent new replies
 *
 * Moderator action to lock a discussion, preventing all users (except moderators)
 * from adding new posts. Existing posts remain visible.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/discussions/{id}/lock
 * Wraps: forum_discussion_lock() from lib.php
 *
 * @param discussionId - Discussion ID
 * @returns Promise resolving to API response with updated discussion
 * @throws Error if user lacks moderation permissions (403)
 */
export async function lockDiscussion(
  discussionId: number
): Promise<ModerationResponse> {
  const response = await apiClient.post<ApiResponse<ModerationResponse>>(
    `/forums/discussions/${discussionId}/lock`
  );
  return extractData(response);
}

/**
 * Unlock a discussion to allow replies
 *
 * Moderator action to unlock a previously locked discussion, allowing
 * all users to post replies again.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/discussions/{id}/unlock
 * Wraps: forum_discussion_unlock() from lib.php
 *
 * @param discussionId - Discussion ID
 * @returns Promise resolving to API response with updated discussion
 * @throws Error if user lacks moderation permissions (403)
 */
export async function unlockDiscussion(
  discussionId: number
): Promise<ModerationResponse> {
  const response = await apiClient.post<ApiResponse<ModerationResponse>>(
    `/forums/discussions/${discussionId}/unlock`
  );
  return extractData(response);
}

/**
 * Report an inappropriate post
 *
 * Allows users to report posts that violate forum rules or contain inappropriate
 * content. Creates a report for moderators to review.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/posts/{id}/report
 * Wraps: forum_report_post() from lib.php
 *
 * @param postId - Post ID to report
 * @param reason - Reason for reporting (required)
 * @returns Promise resolving to API response with report ID
 * @throws Error if reason is empty or reporting fails
 */
export async function reportPost(
  postId: number,
  reason: string
): Promise<ReportResponse> {
  const response = await apiClient.post<ApiResponse<ReportResponse>>(
    `/forums/posts/${postId}/report`,
    { reason }
  );
  return extractData(response);
}

/**
 * Move discussion to another forum (Moderator action)
 *
 * Moves an entire discussion thread including all posts to a different forum.
 * Requires moderator permissions in both source and target forums.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/discussions/{id}/move
 * Wraps: forum_move_discussion() from lib.php
 *
 * @param discussionId - Discussion ID to move
 * @param targetForumId - Target forum ID
 * @returns Promise resolving to API response with updated discussion
 * @throws Error if missing permissions or target forum invalid
 */
export async function moveDiscussion(
  discussionId: number,
  targetForumId: number
): Promise<ModerationResponse> {
  const response = await apiClient.post<ApiResponse<ModerationResponse>>(
    `/forums/discussions/${discussionId}/move`,
    { targetForumId }
  );
  return extractData(response);
}

/**
 * Split discussion into separate thread (Moderator action)
 *
 * Creates a new discussion from a specific post onwards, moving that post
 * and all its replies to a new discussion thread.
 *
 * Maps to PHP endpoint: POST /api/v1/forums/discussions/{id}/split
 * Wraps: forum_split_discussion() from lib.php
 *
 * @param discussionId - Source discussion ID
 * @param postId - Post ID to split from (becomes first post of new discussion)
 * @returns Promise resolving to API response with new discussion details
 * @throws Error if missing permissions or invalid post reference
 */
export async function splitDiscussion(
  discussionId: number,
  postId: number
): Promise<ModerationResponse> {
  const response = await apiClient.post<ApiResponse<ModerationResponse>>(
    `/forums/discussions/${discussionId}/split`,
    { postId }
  );
  return extractData(response);
}
