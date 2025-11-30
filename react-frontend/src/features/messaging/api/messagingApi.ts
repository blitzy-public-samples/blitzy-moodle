/**
 * Messaging API Client Module
 *
 * TypeScript API client module for the messaging feature containing REST API call functions
 * using axios for sending/receiving messages, managing conversations, handling contact requests,
 * marking messages as read, deleting messages, muting conversations, blocking users, and
 * fetching notifications.
 *
 * This module integrates with React Query for caching and state management, providing
 * comprehensive messaging functionality that wraps Moodle's core_message API.
 *
 * All functions use JWT authentication via Authorization header and implement the standard
 * JSON response envelope handling for success and error cases.
 *
 * @module features/messaging/api/messagingApi
 * @see public/message/externallib.php - Moodle messaging external API
 * @see public/message/lib.php - Moodle messaging library functions
 */

import type { AxiosResponse } from 'axios';
import { apiClient } from '@/services/api/client';
import type { ListParams } from '@/types/api';
import type { User } from '@/types/entities';
import type {
  Message,
  Conversation,
  ConversationMember,
  Contact,
  ContactRequest,
  Notification,
  NotificationPreferences,
  ConversationType,
  ConversationCounts,
  MessageFilters,
  NotificationFilters,
  SendMessageParams,
  MessageSearchResult,
  ConversationListResponse,
  NotificationListResponse,
} from '@/features/messaging/types/message.types';

// ============================================================================
// API Response Interfaces
// ============================================================================

/**
 * Standard API success response envelope
 */
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
    timestamp?: number;
  };
}

/**
 * Standard API error response envelope
 */
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Union type for API responses
 */
type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Message preferences for a user
 */
interface MessagePreferences {
  userId: number;
  /** Privacy setting: 0=coursemember, 1=onlycontacts, 2=site */
  privacy: number;
  /** Whether messaging is blocked */
  blocked: boolean;
  /** Auto-add contacts setting */
  autoAddContacts: boolean;
  /** Enter sends message setting */
  enterSendsMessage: boolean;
  /** Show online status */
  showOnlineStatus: boolean;
}

/**
 * Unread conversation counts by type
 */
interface UnreadConversationCounts {
  types: {
    individual: number;
    group: number;
    self: number;
  };
  total: number;
  favourites: number;
}

// ============================================================================
// API Endpoint Constants
// ============================================================================

const MESSAGES_BASE = '/messages';
const CONVERSATIONS_BASE = '/messages/conversations';
const CONTACTS_BASE = '/messages/contacts';
const NOTIFICATIONS_BASE = '/notifications';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extracts data from API response, handling both success and error cases
 *
 * @template T - Type of the expected response data
 * @param response - Axios response containing API envelope
 * @returns The data payload from successful response
 * @throws Error if response indicates failure
 */
function unwrapResponse<T>(response: AxiosResponse<ApiResponse<T>>): T {
  const result = response.data;
  if (result.success) {
    return result.data;
  }
  throw new Error(result.error.message || 'API request failed');
}

/**
 * Builds query parameters from ListParams object
 *
 * @param params - List parameters for pagination, sorting, filtering
 * @returns Record of query parameter key-value pairs
 */
function buildQueryParams<T>(params?: ListParams<T>): Record<string, string | number | boolean> {
  const queryParams: Record<string, string | number | boolean> = {};

  if (params?.pagination) {
    if (params.pagination.page !== undefined) {
      queryParams.page = params.pagination.page;
    }
    if (params.pagination.perPage !== undefined) {
      queryParams.perPage = params.pagination.perPage;
    }
  }

  if (params?.sort) {
    if (params.sort.field !== undefined) {
      queryParams.sortField = String(params.sort.field);
    }
    if (params.sort.order !== undefined) {
      queryParams.sortOrder = params.sort.order;
    }
  }

  if (params?.search) {
    queryParams.search = params.search;
  }

  if (params?.filter) {
    Object.entries(params.filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams[key] = String(value);
      }
    });
  }

  return queryParams;
}

/**
 * Validates message text content
 *
 * @param text - Message text to validate
 * @throws Error if text is invalid
 */
function validateMessageText(text: string): void {
  if (!text || text.trim().length === 0) {
    throw new Error('Message text cannot be empty');
  }
  // Moodle's MESSAGE_MAX_LENGTH is 4096
  if (text.length > 4096) {
    throw new Error('Message text exceeds maximum length of 4096 characters');
  }
}

/**
 * Validates positive integer ID
 *
 * @param id - ID to validate
 * @param fieldName - Name of the field for error message
 * @throws Error if ID is invalid
 */
function validateId(id: number, fieldName: string): void {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

/**
 * Fetch user messages with pagination and filtering
 *
 * Retrieves messages for the current user with support for filtering by
 * conversation type, read status, and pagination.
 *
 * @param params - List parameters for pagination and filtering
 * @param filters - Optional message filters
 * @returns Promise resolving to array of messages
 *
 * @example
 * ```typescript
 * const messages = await getMessages({
 *   pagination: { page: 1, perPage: 20 }
 * }, { readStatus: false });
 * ```
 */
export async function getMessages(
  params?: ListParams<Message>,
  filters?: MessageFilters
): Promise<Message[]> {
  const queryParams = buildQueryParams(params);

  if (filters) {
    if (filters.userId !== undefined) {
      queryParams.userId = filters.userId;
    }
    if (filters.conversationId !== undefined) {
      queryParams.conversationId = filters.conversationId;
    }
    if (filters.readStatus !== undefined) {
      queryParams.readStatus = filters.readStatus;
    }
    if (filters.searchTerm) {
      queryParams.search = filters.searchTerm;
    }
    if (filters.dateRange) {
      queryParams.dateFrom = filters.dateRange.from;
      queryParams.dateTo = filters.dateRange.to;
    }
  }

  const response: AxiosResponse<ApiResponse<Message[]>> = await apiClient.get(
    MESSAGES_BASE,
    { params: queryParams }
  );

  return unwrapResponse(response);
}

/**
 * Retrieve user's conversation list with unread counts and member information
 *
 * Fetches all conversations for the current user with support for filtering
 * by type, favourites, and pagination.
 *
 * @param params - List parameters for pagination and filtering
 * @param options - Optional conversation filters
 * @returns Promise resolving to conversation list response
 *
 * @example
 * ```typescript
 * const result = await getConversations({
 *   pagination: { page: 1, perPage: 20 }
 * }, { type: ConversationType.INDIVIDUAL, favourites: true });
 * ```
 */
export async function getConversations(
  params?: ListParams<Conversation>,
  options?: {
    type?: ConversationType;
    favourites?: boolean;
    mergeself?: boolean;
  }
): Promise<ConversationListResponse> {
  const queryParams = buildQueryParams(params);

  if (options) {
    if (options.type !== undefined) {
      queryParams.type = options.type;
    }
    if (options.favourites !== undefined) {
      queryParams.favourites = options.favourites;
    }
    if (options.mergeself !== undefined) {
      queryParams.mergeself = options.mergeself;
    }
  }

  const response: AxiosResponse<ApiResponse<ConversationListResponse>> = await apiClient.get(
    CONVERSATIONS_BASE,
    { params: queryParams }
  );

  return unwrapResponse(response);
}

/**
 * Get paginated messages within a specific conversation
 *
 * Retrieves messages from a conversation with member details and pagination support.
 *
 * @param conversationId - ID of the conversation
 * @param params - Pagination parameters
 * @param options - Additional options like newest first, time from
 * @returns Promise resolving to conversation messages with members
 *
 * @example
 * ```typescript
 * const result = await getConversationMessages(123, {
 *   pagination: { page: 1, perPage: 50 }
 * }, { newest: true });
 * ```
 */
export async function getConversationMessages(
  conversationId: number,
  params?: ListParams<Message>,
  options?: {
    newest?: boolean;
    timefrom?: number;
  }
): Promise<{ messages: Message[]; members: ConversationMember[] }> {
  validateId(conversationId, 'conversationId');

  const queryParams = buildQueryParams(params);

  if (options) {
    if (options.newest !== undefined) {
      queryParams.newest = options.newest;
    }
    if (options.timefrom !== undefined) {
      queryParams.timefrom = options.timefrom;
    }
  }

  const response: AxiosResponse<ApiResponse<{ messages: Message[]; members: ConversationMember[] }>> =
    await apiClient.get(`${CONVERSATIONS_BASE}/${conversationId}/messages`, { params: queryParams });

  return unwrapResponse(response);
}

/**
 * Send a message to a conversation
 *
 * Sends a text message to the specified conversation with content validation.
 *
 * @param params - Send message parameters including conversationId and text
 * @returns Promise resolving to the created message
 *
 * @example
 * ```typescript
 * const message = await sendMessage({
 *   conversationid: 123,
 *   text: 'Hello, how are you?',
 *   useridfrom: 456
 * });
 * ```
 */
export async function sendMessage(params: SendMessageParams): Promise<Message> {
  validateId(params.conversationid, 'conversationId');
  validateMessageText(params.text);

  const response: AxiosResponse<ApiResponse<Message>> = await apiClient.post(
    `${CONVERSATIONS_BASE}/${params.conversationid}/messages`,
    {
      text: params.text,
      textformat: 1, // FORMAT_HTML
    }
  );

  return unwrapResponse(response);
}

/**
 * Delete a single message by ID
 *
 * Deletes the specified message with appropriate permission checks.
 *
 * @param messageId - ID of the message to delete
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await deleteMessage(12345);
 * ```
 */
export async function deleteMessage(messageId: number): Promise<void> {
  validateId(messageId, 'messageId');

  await apiClient.delete(`${MESSAGES_BASE}/${messageId}`);
}

/**
 * Delete an entire conversation by ID
 *
 * Removes all messages in the conversation for the current user.
 *
 * @param conversationId - ID of the conversation to delete
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await deleteConversation(123);
 * ```
 */
export async function deleteConversation(conversationId: number): Promise<void> {
  validateId(conversationId, 'conversationId');

  await apiClient.delete(`${CONVERSATIONS_BASE}/${conversationId}`);
}

// ============================================================================
// CONVERSATION MANAGEMENT
// ============================================================================

/**
 * Mark all messages in a conversation as read
 *
 * Updates the read status of all messages in the specified conversation
 * to update unread counts.
 *
 * @param conversationId - ID of the conversation to mark as read
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await markConversationAsRead(123);
 * ```
 */
export async function markConversationAsRead(conversationId: number): Promise<void> {
  validateId(conversationId, 'conversationId');

  await apiClient.post(`${CONVERSATIONS_BASE}/${conversationId}/read`);
}

/**
 * Mark a specific message as read
 *
 * Updates the read status of a single message.
 *
 * @param messageId - ID of the message to mark as read
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await markMessageAsRead(12345);
 * ```
 */
export async function markMessageAsRead(messageId: number): Promise<void> {
  validateId(messageId, 'messageId');

  await apiClient.post(`${MESSAGES_BASE}/${messageId}/read`);
}

/**
 * Mute notifications for a specific conversation
 *
 * Prevents notifications from the specified conversation.
 *
 * @param conversationId - ID of the conversation to mute
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await muteConversation(123);
 * ```
 */
export async function muteConversation(conversationId: number): Promise<void> {
  validateId(conversationId, 'conversationId');

  await apiClient.post(`${CONVERSATIONS_BASE}/${conversationId}/mute`);
}

/**
 * Unmute notifications for a conversation
 *
 * Re-enables notifications for the specified conversation.
 *
 * @param conversationId - ID of the conversation to unmute
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await unmuteConversation(123);
 * ```
 */
export async function unmuteConversation(conversationId: number): Promise<void> {
  validateId(conversationId, 'conversationId');

  await apiClient.post(`${CONVERSATIONS_BASE}/${conversationId}/unmute`);
}

/**
 * Add conversations to favorites list
 *
 * Marks the specified conversations as favourites for easier access.
 *
 * @param conversationIds - Array of conversation IDs to add to favorites
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await setFavouriteConversations([123, 456, 789]);
 * ```
 */
export async function setFavouriteConversations(conversationIds: number[]): Promise<void> {
  if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
    throw new Error('conversationIds must be a non-empty array');
  }
  conversationIds.forEach((id) => validateId(id, 'conversationId'));

  await apiClient.post(`${CONVERSATIONS_BASE}/favourite`, {
    conversationids: conversationIds,
  });
}

/**
 * Remove conversations from favorites
 *
 * Removes the specified conversations from the favourites list.
 *
 * @param conversationIds - Array of conversation IDs to remove from favorites
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await unsetFavouriteConversations([123, 456]);
 * ```
 */
export async function unsetFavouriteConversations(conversationIds: number[]): Promise<void> {
  if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
    throw new Error('conversationIds must be a non-empty array');
  }
  conversationIds.forEach((id) => validateId(id, 'conversationId'));

  await apiClient.post(`${CONVERSATIONS_BASE}/unfavourite`, {
    conversationids: conversationIds,
  });
}

/**
 * Fetch list of members in a conversation
 *
 * Retrieves member details for all participants in the specified conversation.
 *
 * @param conversationId - ID of the conversation
 * @param params - Pagination parameters
 * @param options - Additional options like includeContactRequests
 * @returns Promise resolving to array of conversation members
 *
 * @example
 * ```typescript
 * const members = await getConversationMembers(123, {
 *   pagination: { page: 1, perPage: 50 }
 * });
 * ```
 */
export async function getConversationMembers(
  conversationId: number,
  params?: ListParams<ConversationMember>,
  options?: {
    includeContactRequests?: boolean;
    includePrivacyInfo?: boolean;
  }
): Promise<ConversationMember[]> {
  validateId(conversationId, 'conversationId');

  const queryParams = buildQueryParams(params);

  if (options) {
    if (options.includeContactRequests !== undefined) {
      queryParams.includecontactrequests = options.includeContactRequests;
    }
    if (options.includePrivacyInfo !== undefined) {
      queryParams.includeprivacyinfo = options.includePrivacyInfo;
    }
  }

  const response: AxiosResponse<ApiResponse<ConversationMember[]>> = await apiClient.get(
    `${CONVERSATIONS_BASE}/${conversationId}/members`,
    { params: queryParams }
  );

  return unwrapResponse(response);
}

// ============================================================================
// CONTACT OPERATIONS
// ============================================================================

/**
 * Retrieve user's contact list
 *
 * Fetches all contacts for the current user with their profile information.
 *
 * @param params - Pagination parameters
 * @returns Promise resolving to array of contacts
 *
 * @example
 * ```typescript
 * const contacts = await getContacts({
 *   pagination: { page: 1, perPage: 50 }
 * });
 * ```
 */
export async function getContacts(params?: ListParams<Contact>): Promise<Contact[]> {
  const queryParams = buildQueryParams(params);

  const response: AxiosResponse<ApiResponse<Contact[]>> = await apiClient.get(
    CONTACTS_BASE,
    { params: queryParams }
  );

  return unwrapResponse(response);
}

/**
 * Fetch pending contact requests with pagination
 *
 * Retrieves contact requests received by the current user.
 *
 * @param params - Pagination parameters
 * @returns Promise resolving to array of contact requests
 *
 * @example
 * ```typescript
 * const requests = await getContactRequests({
 *   pagination: { page: 1, perPage: 20 }
 * });
 * ```
 */
export async function getContactRequests(
  params?: ListParams<ContactRequest>
): Promise<ContactRequest[]> {
  const queryParams = buildQueryParams(params);

  const response: AxiosResponse<ApiResponse<ContactRequest[]>> = await apiClient.get(
    `${CONTACTS_BASE}/requests`,
    { params: queryParams }
  );

  return unwrapResponse(response);
}

/**
 * Get count of pending received contact requests
 *
 * Returns the number of unprocessed contact requests for badge display.
 *
 * @returns Promise resolving to count of pending requests
 *
 * @example
 * ```typescript
 * const count = await getReceivedContactRequestsCount();
 * console.log(`You have ${count} pending contact requests`);
 * ```
 */
export async function getReceivedContactRequestsCount(): Promise<number> {
  const response: AxiosResponse<ApiResponse<{ count: number }>> = await apiClient.get(
    `${CONTACTS_BASE}/requests/count`
  );

  return unwrapResponse(response).count;
}

/**
 * Accept a contact request
 *
 * Approves a pending contact request and adds the user to contacts.
 *
 * @param requestId - ID of the contact request to accept
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await acceptContactRequest(123);
 * ```
 */
export async function acceptContactRequest(requestId: number): Promise<void> {
  validateId(requestId, 'requestId');

  await apiClient.post(`${CONTACTS_BASE}/requests/${requestId}/accept`);
}

/**
 * Reject a contact request
 *
 * Declines a pending contact request without adding to contacts.
 *
 * @param requestId - ID of the contact request to reject
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await rejectContactRequest(123);
 * ```
 */
export async function rejectContactRequest(requestId: number): Promise<void> {
  validateId(requestId, 'requestId');

  await apiClient.post(`${CONTACTS_BASE}/requests/${requestId}/reject`);
}

/**
 * Remove users from contacts list
 *
 * Deletes the specified users from the current user's contact list.
 *
 * @param userIds - Array of user IDs to remove from contacts
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await deleteContacts([123, 456]);
 * ```
 */
export async function deleteContacts(userIds: number[]): Promise<void> {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new Error('userIds must be a non-empty array');
  }
  userIds.forEach((id) => validateId(id, 'userId'));

  await apiClient.delete(CONTACTS_BASE, {
    data: { userids: userIds },
  });
}

/**
 * Block a user from sending messages
 *
 * Prevents the specified user from sending messages to the current user.
 *
 * @param blockedUserId - ID of the user to block
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await blockUser(123);
 * ```
 */
export async function blockUser(blockedUserId: number): Promise<void> {
  validateId(blockedUserId, 'blockedUserId');

  await apiClient.post(`${CONTACTS_BASE}/block`, {
    blockeduserid: blockedUserId,
  });
}

/**
 * Unblock a previously blocked user
 *
 * Re-enables messaging from the specified user.
 *
 * @param unblockedUserId - ID of the user to unblock
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await unblockUser(123);
 * ```
 */
export async function unblockUser(unblockedUserId: number): Promise<void> {
  validateId(unblockedUserId, 'unblockedUserId');

  await apiClient.post(`${CONTACTS_BASE}/unblock`, {
    unblockeduserid: unblockedUserId,
  });
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Fetch user notifications with filtering and pagination
 *
 * Retrieves notifications for the current user with support for filtering
 * by type, read status, and date range.
 *
 * @param params - Pagination parameters
 * @param filters - Optional notification filters
 * @returns Promise resolving to notification list response
 *
 * @example
 * ```typescript
 * const result = await getNotifications({
 *   pagination: { page: 1, perPage: 20 }
 * }, { read: false });
 * ```
 */
export async function getNotifications(
  params?: ListParams<Notification>,
  filters?: NotificationFilters
): Promise<NotificationListResponse> {
  const queryParams = buildQueryParams(params);

  if (filters) {
    if (filters.type !== undefined) {
      queryParams.type = filters.type;
    }
    if (filters.read !== undefined) {
      queryParams.read = filters.read;
    }
    if (filters.dateFrom !== undefined) {
      queryParams.dateFrom = filters.dateFrom;
    }
    if (filters.dateTo !== undefined) {
      queryParams.dateTo = filters.dateTo;
    }
    if (filters.component) {
      queryParams.component = filters.component;
    }
    if (filters.eventType) {
      queryParams.eventtype = filters.eventType;
    }
  }

  const response: AxiosResponse<ApiResponse<NotificationListResponse>> = await apiClient.get(
    NOTIFICATIONS_BASE,
    { params: queryParams }
  );

  return unwrapResponse(response);
}

/**
 * Get count of unread notifications
 *
 * Returns the number of unread notifications for badge display.
 *
 * @returns Promise resolving to count of unread notifications
 *
 * @example
 * ```typescript
 * const count = await getUnreadNotificationCount();
 * console.log(`You have ${count} unread notifications`);
 * ```
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const response: AxiosResponse<ApiResponse<{ count: number }>> = await apiClient.get(
    `${NOTIFICATIONS_BASE}/unread/count`
  );

  return unwrapResponse(response).count;
}

/**
 * Get unread message counts grouped by conversation type
 *
 * Returns unread counts categorized by individual, group, and self conversations.
 *
 * @returns Promise resolving to unread conversation counts
 *
 * @example
 * ```typescript
 * const counts = await getUnreadConversationCounts();
 * console.log(`Unread individual: ${counts.types.individual}`);
 * ```
 */
export async function getUnreadConversationCounts(): Promise<UnreadConversationCounts> {
  const response: AxiosResponse<ApiResponse<UnreadConversationCounts>> = await apiClient.get(
    `${CONVERSATIONS_BASE}/unread/counts`
  );

  return unwrapResponse(response);
}

/**
 * Mark a notification as read
 *
 * Updates the read status of a single notification.
 *
 * @param notificationId - ID of the notification to mark as read
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await markNotificationRead(12345);
 * ```
 */
export async function markNotificationRead(notificationId: number): Promise<void> {
  validateId(notificationId, 'notificationId');

  await apiClient.post(`${NOTIFICATIONS_BASE}/${notificationId}/read`);
}

/**
 * Mark all notifications as read
 *
 * Updates the read status of all notifications for the current user.
 *
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await markAllNotificationsRead();
 * ```
 */
export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post(`${NOTIFICATIONS_BASE}/read-all`);
}

/**
 * Clear all notifications
 *
 * Deletes all notifications for the current user.
 *
 * @returns Promise resolving to void on success
 *
 * @example
 * ```typescript
 * await clearNotifications();
 * ```
 */
export async function clearNotifications(): Promise<void> {
  await apiClient.delete(NOTIFICATIONS_BASE);
}

/**
 * Retrieve user's notification preferences
 *
 * Fetches the notification settings for the current user including
 * email, push, and in-app notification toggles.
 *
 * @returns Promise resolving to notification preferences
 *
 * @example
 * ```typescript
 * const prefs = await getUserNotificationPreferences();
 * console.log(`Email notifications: ${prefs.enableEmail}`);
 * ```
 */
export async function getUserNotificationPreferences(): Promise<NotificationPreferences> {
  const response: AxiosResponse<ApiResponse<NotificationPreferences>> = await apiClient.get(
    `${NOTIFICATIONS_BASE}/preferences`
  );

  return unwrapResponse(response);
}

/**
 * Update user's notification preferences
 *
 * Updates the notification settings for the current user.
 *
 * @param preferences - Partial notification preferences to update
 * @returns Promise resolving to updated notification preferences
 *
 * @example
 * ```typescript
 * const updated = await updateUserNotificationPreferences({
 *   enableEmail: false,
 *   enablePush: true
 * });
 * ```
 */
export async function updateUserNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const response: AxiosResponse<ApiResponse<NotificationPreferences>> = await apiClient.put(
    `${NOTIFICATIONS_BASE}/preferences`,
    preferences
  );

  return unwrapResponse(response);
}

/**
 * Get user's messaging preferences
 *
 * Fetches the messaging settings for the current user including
 * privacy settings and UI preferences.
 *
 * @returns Promise resolving to message preferences
 *
 * @example
 * ```typescript
 * const prefs = await getUserMessagePreferences();
 * console.log(`Privacy setting: ${prefs.privacy}`);
 * ```
 */
export async function getUserMessagePreferences(): Promise<MessagePreferences> {
  const response: AxiosResponse<ApiResponse<MessagePreferences>> = await apiClient.get(
    `${MESSAGES_BASE}/preferences`
  );

  return unwrapResponse(response);
}

// ============================================================================
// SEARCH
// ============================================================================

/**
 * Search through user's messages by keyword
 *
 * Searches message content and conversation names with pagination support.
 *
 * @param query - Search query string
 * @param params - Pagination parameters
 * @returns Promise resolving to message search results
 *
 * @example
 * ```typescript
 * const results = await searchMessages('assignment', {
 *   pagination: { page: 1, perPage: 20 }
 * });
 * ```
 */
export async function searchMessages(
  query: string,
  params?: ListParams<Message>
): Promise<MessageSearchResult> {
  if (!query || query.trim().length === 0) {
    throw new Error('Search query cannot be empty');
  }

  const queryParams = buildQueryParams(params);
  queryParams.search = query.trim();

  const response: AxiosResponse<ApiResponse<MessageSearchResult>> = await apiClient.get(
    `${MESSAGES_BASE}/search`,
    { params: queryParams }
  );

  return unwrapResponse(response);
}

/**
 * Search for users to start new conversations
 *
 * Searches for users by name or email to initiate new conversations.
 *
 * @param query - Search query string
 * @param params - Pagination parameters
 * @returns Promise resolving to array of matching users
 *
 * @example
 * ```typescript
 * const users = await searchUsers('john', {
 *   pagination: { page: 1, perPage: 20 }
 * });
 * ```
 */
export async function searchUsers(
  query: string,
  params?: ListParams<User>
): Promise<ConversationMember[]> {
  if (!query || query.trim().length === 0) {
    throw new Error('Search query cannot be empty');
  }

  const queryParams = buildQueryParams(params);
  queryParams.search = query.trim();

  const response: AxiosResponse<ApiResponse<ConversationMember[]>> = await apiClient.get(
    `${MESSAGES_BASE}/users/search`,
    { params: queryParams }
  );

  return unwrapResponse(response);
}

// ============================================================================
// React Query Key Factory
// ============================================================================

/**
 * Query key factory for messaging-related React Query keys
 *
 * Provides consistent, type-safe query keys for caching and invalidation.
 *
 * @example
 * ```typescript
 * // Use in React Query hooks
 * const { data } = useQuery({
 *   queryKey: messagingKeys.conversations(),
 *   queryFn: () => getConversations()
 * });
 *
 * // Invalidate all messaging queries
 * queryClient.invalidateQueries({ queryKey: messagingKeys.all });
 * ```
 */
export const messagingKeys = {
  /** Base key for all messaging queries */
  all: ['messaging'] as const,

  /** Key for conversation list queries */
  conversations: () => [...messagingKeys.all, 'conversations'] as const,

  /** Key for specific conversation */
  conversation: (id: number) => [...messagingKeys.conversations(), id] as const,

  /** Key for conversation messages */
  conversationMessages: (conversationId: number) =>
    [...messagingKeys.conversation(conversationId), 'messages'] as const,

  /** Key for conversation members */
  conversationMembers: (conversationId: number) =>
    [...messagingKeys.conversation(conversationId), 'members'] as const,

  /** Key for messages list queries */
  messages: () => [...messagingKeys.all, 'messages'] as const,

  /** Key for message search */
  messageSearch: (query: string) => [...messagingKeys.messages(), 'search', query] as const,

  /** Key for contacts list */
  contacts: () => [...messagingKeys.all, 'contacts'] as const,

  /** Key for contact requests */
  contactRequests: () => [...messagingKeys.contacts(), 'requests'] as const,

  /** Key for contact request count */
  contactRequestCount: () => [...messagingKeys.contactRequests(), 'count'] as const,

  /** Key for notifications list */
  notifications: () => [...messagingKeys.all, 'notifications'] as const,

  /** Key for unread notification count */
  unreadNotificationCount: () => [...messagingKeys.notifications(), 'unread', 'count'] as const,

  /** Key for unread conversation counts */
  unreadConversationCounts: () => [...messagingKeys.conversations(), 'unread', 'counts'] as const,

  /** Key for notification preferences */
  notificationPreferences: () => [...messagingKeys.notifications(), 'preferences'] as const,

  /** Key for message preferences */
  messagePreferences: () => [...messagingKeys.messages(), 'preferences'] as const,

  /** Key for user search */
  userSearch: (query: string) => [...messagingKeys.all, 'users', 'search', query] as const,
};

// ============================================================================
// Default Export (all functions as object)
// ============================================================================

/**
 * Messaging API client object containing all messaging functions
 *
 * Provides an alternative way to access all messaging API functions
 * through a single import.
 *
 * @example
 * ```typescript
 * import messagingApi from '@/features/messaging/api/messagingApi';
 *
 * const conversations = await messagingApi.getConversations();
 * await messagingApi.sendMessage({ conversationid: 123, text: 'Hello' });
 * ```
 */
const messagingApi = {
  // Message operations
  getMessages,
  getConversations,
  getConversationMessages,
  sendMessage,
  deleteMessage,
  deleteConversation,

  // Conversation management
  markConversationAsRead,
  markMessageAsRead,
  muteConversation,
  unmuteConversation,
  setFavouriteConversations,
  unsetFavouriteConversations,
  getConversationMembers,

  // Contact operations
  getContacts,
  getContactRequests,
  getReceivedContactRequestsCount,
  acceptContactRequest,
  rejectContactRequest,
  deleteContacts,
  blockUser,
  unblockUser,

  // Notifications
  getNotifications,
  getUnreadNotificationCount,
  getUnreadConversationCounts,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotifications,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  getUserMessagePreferences,

  // Search
  searchMessages,
  searchUsers,

  // Query keys
  keys: messagingKeys,
};

export default messagingApi;
