/**
 * TypeScript Type Definitions for Moodle Messaging System
 *
 * Comprehensive type definitions based on Moodle's core_message data structures
 * from public/message/classes/api.php, helper.php, and database schema.
 *
 * These types ensure type safety and API compatibility between the React frontend
 * and the PHP backend messaging API endpoints.
 *
 * @module features/messaging/types/message.types
 */

import type { Timestamp } from '@/types/common';

// ============================================================================
// Enums - Based on Moodle core_message API constants
// ============================================================================

/**
 * Conversation types as defined in core_message\api
 * Maps to MESSAGE_CONVERSATION_TYPE_* constants
 */
export enum ConversationType {
  /** One-to-one conversation between two users */
  INDIVIDUAL = 1,
  /** Group conversation with multiple members */
  GROUP = 2,
  /** Self conversation (user messaging themselves for notes) */
  SELF = 3,
}

/**
 * Message privacy settings for who can message a user
 * Maps to MESSAGE_PRIVACY_* constants in core_message\api
 */
export enum MessagePrivacy {
  /** Can be messaged by anyone within courses user is member of */
  COURSEMEMBER = 0,
  /** Can only be messaged by contacts */
  ONLYCONTACTS = 1,
  /** Can be messaged by anyone on the site */
  SITE = 2,
}

/**
 * Message user actions
 * Maps to MESSAGE_ACTION_* constants in core_message\api
 */
export enum MessageAction {
  /** Message has been read by user */
  READ = 1,
  /** Message has been deleted by user */
  DELETED = 2,
}

/**
 * Conversation user actions
 * Maps to CONVERSATION_ACTION_* constants in core_message\api
 */
export enum ConversationAction {
  /** Conversation has been muted by user */
  MUTED = 1,
}

/**
 * Notification types for categorizing different kinds of notifications
 */
export enum NotificationType {
  /** Message notification */
  MESSAGE = 'message',
  /** Assignment-related notification */
  ASSIGNMENT = 'assignment',
  /** Forum post notification */
  FORUM_POST = 'forum_post',
  /** Quiz-related notification */
  QUIZ = 'quiz',
  /** Grade notification */
  GRADE = 'grade',
  /** Course-related notification */
  COURSE = 'course',
  /** System notification */
  SYSTEM = 'system',
}

// ============================================================================
// Core Interfaces - Based on Moodle database tables and API responses
// ============================================================================

/**
 * Message interface based on mdl_messages table structure
 * Represents a single message sent within a conversation
 *
 * Source: public/message/classes/helper.php - get_conversation_messages() SQL query
 * Database: mdl_messages table in public/lib/db/install.xml
 */
export interface Message {
  /** Message ID (int 10) */
  id: number;
  /** User ID of sender (int 10) */
  useridfrom: number;
  /** Conversation ID this message belongs to (int 10) */
  conversationid: number;
  /** Message subject (varchar 255, nullable) */
  subject: string | null;
  /** Full message text (text) */
  fullmessage: string;
  /** Message format (int 4): 0=MOODLE, 1=HTML, 2=PLAIN, 4=MARKDOWN */
  fullmessageformat: number;
  /** Full message HTML version (text) */
  fullmessagehtml: string;
  /** Short version of message for notifications (text) */
  smallmessage: string;
  /** Unix timestamp when message was created (int 10) */
  timecreated: Timestamp;
  /** Whether full message HTML can be trusted (int 1) */
  fullmessagetrust: number;
  /** Custom data JSON string (text, nullable) */
  customdata: string | null;
}

/**
 * Conversation interface based on mdl_message_conversations table and api.php get_conversation()
 * Represents a messaging conversation between users
 *
 * Source: public/message/classes/api.php - get_conversation() return structure
 * Database: mdl_message_conversations table in public/lib/db/install.xml
 */
export interface Conversation {
  /** Conversation ID (int 10) */
  id: number;
  /** Conversation type: 1=INDIVIDUAL, 2=GROUP, 3=SELF (int 2) */
  type: ConversationType;
  /** Conversation name (varchar 255, nullable) */
  name: string | null;
  /** Conversation subname (varchar 255, nullable) */
  subname: string | null;
  /** URL to conversation image (text, nullable) */
  imageurl: string | null;
  /** Number of members in conversation (int 10) */
  membercount: number;
  /** Whether conversation is marked as favourite by current user (boolean) */
  isfavourite: boolean;
  /** Whether all messages have been read (boolean) */
  isread: boolean;
  /** Count of unread messages (int 10) */
  unreadcount: number;
  /** Whether conversation is muted by current user (boolean) */
  ismuted: boolean;
  /** Whether conversation is enabled: 1=enabled, 0=disabled (int 1) */
  enabled: number;
  /** Unix timestamp when conversation was created (int 10) */
  timecreated: Timestamp;
  /** Unix timestamp when conversation was last modified (int 10, nullable) */
  timemodified: Timestamp | null;
  /** Array of conversation members */
  members: ConversationMember[];
  /** Array of recent messages in conversation */
  messages: Message[];
  /** Whether current user can delete messages for all users (boolean) */
  candeletemessagesforallusers: boolean;
}

/**
 * Conversation member interface based on helper.php get_member_info()
 * Represents a user who is member of a conversation
 *
 * Source: public/message/classes/helper.php - get_member_info() return structure
 */
export interface ConversationMember {
  /** User ID (int 10) */
  id: number;
  /** User's full name (string) */
  fullname: string;
  /** URL to user profile page (string) */
  profileurl: string;
  /** URL to user's profile image (string) */
  profileimageurl: string;
  /** URL to user's small profile image (string) */
  profileimageurlsmall: string;
  /** Whether user is currently online (boolean) */
  isonline: boolean;
  /** Whether to show online status for this user (boolean) */
  showonlinestatus: boolean;
  /** Whether user is in current user's contacts (boolean) */
  iscontact: boolean;
  /** Whether user is blocked by current user (boolean) */
  isblocked: boolean;
  /** Whether user account has been deleted (boolean) */
  isdeleted: boolean;
  /** Whether user requires contact request before messaging (boolean) */
  requirescontact: boolean;
  /** Whether current user can message this user (boolean) */
  canmessage: boolean;
  /** Array of pending contact requests related to this user */
  contactrequests: ContactRequest[];
}

/**
 * Contact interface based on helper.php create_contact() structure
 * Represents a user in the contact list
 *
 * Source: public/message/classes/helper.php - create_contact() structure
 */
export interface Contact {
  /** User ID of the contact (int 10) */
  userid: number;
  /** Contact's full name (string) */
  fullname: string;
  /** URL to contact's profile image (string) */
  profileimageurl: string;
  /** URL to contact's small profile image (string) */
  profileimageurlsmall: string;
  /** Whether currently in a messaging session with this contact (boolean) */
  ismessaging: boolean;
  /** Last message text sent/received (string, nullable) */
  lastmessage: string | null;
  /** Unix timestamp of last message (int 10, nullable) */
  lastmessagedate: Timestamp | null;
  /** ID of last message (int 10, nullable) */
  messageid: number | null;
  /** Whether contact is blocked (boolean) */
  blocked: boolean;
}

/**
 * Contact request interface based on mdl_message_contact_requests table
 * Represents a pending contact request between users
 *
 * Database: mdl_message_contact_requests table in public/lib/db/install.xml
 */
export interface ContactRequest {
  /** Contact request ID (int 10) */
  id: number;
  /** User ID who sent the request (int 10) */
  userid: number;
  /** User ID who received the request (int 10) */
  requesteduserid: number;
  /** Unix timestamp when request was created (int 10) */
  timecreated: Timestamp;
}

/**
 * Notification interface based on mdl_notifications table structure
 * Represents a system notification sent to a user
 *
 * Database: mdl_notifications table in public/lib/db/install.xml
 */
export interface Notification {
  /** Notification ID (int 10) */
  id: number;
  /** User ID of sender (int 10, nullable) */
  useridfrom: number | null;
  /** User ID of recipient (int 10) */
  useridto: number;
  /** Notification subject (text) */
  subject: string;
  /** Full notification message text (text) */
  fullmessage: string;
  /** Full notification message HTML (text, nullable) */
  fullmessagehtml: string | null;
  /** Message format (int 4): 0=MOODLE, 1=HTML, 2=PLAIN, 4=MARKDOWN */
  fullmessageformat: number;
  /** Short message for mobile/email (text) */
  smallmessage: string;
  /** Component that generated notification (varchar 100) */
  component: string;
  /** Event type that triggered notification (varchar 100) */
  eventtype: string;
  /** URL for context of notification (text, nullable) */
  contexturl: string | null;
  /** Name/title for context URL (text, nullable) */
  contexturlname: string | null;
  /** Unix timestamp when notification was read (int 10, nullable) */
  timeread: Timestamp | null;
  /** Unix timestamp when notification was created (int 10) */
  timecreated: Timestamp;
  /** Custom data JSON string (text, nullable) */
  customdata: string | null;
}

// ============================================================================
// Permission and Counts Interfaces
// ============================================================================

/**
 * Conversation permissions for current user
 * Defines what actions current user can perform in a conversation
 *
 * Source: Based on Moodle capability checks in message API
 */
export interface ConversationPermissions {
  /** Whether user can delete messages in conversation (boolean) */
  candelete: boolean;
  /** Whether user can edit conversation settings (boolean) */
  canedit: boolean;
  /** Whether user can mute conversation (boolean) */
  canmute: boolean;
  /** Whether user can remove members from conversation (boolean) */
  canremovemembers: boolean;
  /** Whether user can add members to conversation (boolean) */
  canaddmembers: boolean;
}

/**
 * Conversation counts for overview/summary displays
 * Provides counts of different conversation types
 *
 * Source: Based on message area API response structure
 */
export interface ConversationCounts {
  /** Total number of conversations (int) */
  total: number;
  /** Number of conversations with unread messages (int) */
  unread: number;
  /** Number of favourite conversations (int) */
  favourites: number;
  /** Number of individual (1-on-1) conversations (int) */
  individual: number;
  /** Number of group conversations (int) */
  group: number;
  /** Number of self conversations (int) */
  self: number;
}

// ============================================================================
// Filter and Search Interfaces
// ============================================================================

/**
 * Message filtering criteria for API requests
 * Used to filter messages in queries
 */
export interface MessageFilters {
  /** Filter by specific user ID (optional) */
  userId?: number;
  /** Filter by conversation ID (optional) */
  conversationId?: number;
  /** Filter by read status: true=read, false=unread (optional) */
  readStatus?: boolean;
  /** Filter by date range (optional) */
  dateRange?: {
    /** Start date as Unix timestamp */
    from: Timestamp;
    /** End date as Unix timestamp */
    to: Timestamp;
  };
  /** Search term for message content (optional) */
  searchTerm?: string;
}

/**
 * Notification filtering criteria for API requests
 * Used to filter notifications in queries
 */
export interface NotificationFilters {
  /** Filter by notification type (optional) */
  type?: NotificationType;
  /** Filter by read status: true=read, false=unread, undefined=all (optional) */
  read?: boolean;
  /** Filter from date as Unix timestamp (optional) */
  dateFrom?: Timestamp;
  /** Filter to date as Unix timestamp (optional) */
  dateTo?: Timestamp;
  /** Filter by component name (optional) */
  component?: string;
  /** Filter by event type (optional) */
  eventType?: string;
}

/**
 * Message search results interface
 * Returned from search API endpoint
 *
 * Source: Based on message search API response structure
 */
export interface MessageSearchResult {
  /** Array of messages matching search criteria */
  messages: Message[];
  /** Array of conversations matching search criteria */
  conversations: Conversation[];
  /** Total number of results found (int) */
  total: number;
  /** Whether there are more results available (boolean) */
  hasMore: boolean;
}

// ============================================================================
// API Parameter Interfaces
// ============================================================================

/**
 * Parameters for sending a new message
 * Used in POST /api/v1/messages endpoint
 *
 * Source: Based on message send API parameters
 */
export interface SendMessageParams {
  /** Conversation ID to send message to (int 10) */
  conversationid: number;
  /** Message text content (string, max 4096 chars) */
  text: string;
  /** User ID of sender (int 10) */
  useridfrom: number;
}

/**
 * Parameters for creating a new conversation
 * Used in POST /api/v1/conversations endpoint
 *
 * Source: Based on conversation creation API parameters
 */
export interface CreateConversationParams {
  /** Type of conversation to create */
  type: ConversationType;
  /** Name for group conversations (optional for individual) */
  name?: string;
  /** Array of user IDs to add as members (minimum 1 for individual, 2+ for group) */
  members: number[];
}

// ============================================================================
// Notification Preferences Interface
// ============================================================================

/**
 * User notification preferences
 * Controls how and when user receives notifications
 *
 * Source: Based on Moodle user preferences for messaging
 */
export interface NotificationPreferences {
  /** User ID these preferences belong to (int 10) */
  userId: number;
  /** Whether to enable email notifications (boolean) */
  enableEmail: boolean;
  /** Whether to enable push notifications (boolean) */
  enablePush: boolean;
  /** Whether to enable in-app notifications (boolean) */
  enableInApp: boolean;
  /** Array of notification types to receive */
  notificationTypes: NotificationType[];
  /** Array of conversation IDs that are muted */
  mutedConversations: number[];
  /** Start time for quiet hours (24h format: "22:00", nullable) */
  quietHoursStart: string | null;
  /** End time for quiet hours (24h format: "08:00", nullable) */
  quietHoursEnd: string | null;
}

// ============================================================================
// Component Props Type Definitions
// ============================================================================

/**
 * Props for MessageComposer component
 * Component for composing and sending new messages
 */
export type MessageComposerProps = {
  /** Conversation ID to send message to */
  conversationId: number;
  /** Callback when message is successfully sent */
  onMessageSent?: (message: Message) => void;
  /** Callback when composition is cancelled */
  onCancel?: () => void;
  /** Whether composer should auto-focus on mount */
  autoFocus?: boolean;
  /** Maximum message length (default: 4096) */
  maxLength?: number;
  /** Placeholder text for input field */
  placeholder?: string;
  /** Whether to show file attachment option */
  allowAttachments?: boolean;
  /** Whether composer is in loading state */
  isLoading?: boolean;
  /** Current draft message text */
  draftMessage?: string;
  /** Callback when draft changes */
  onDraftChange?: (text: string) => void;
};

/**
 * Props for MessageList component
 * Component for displaying list of messages in a conversation
 */
export type MessageListProps = {
  /** Array of messages to display */
  messages: Message[];
  /** Current user ID for determining message alignment */
  currentUserId: number;
  /** Whether messages are currently loading */
  isLoading?: boolean;
  /** Whether there are more messages to load */
  hasMore?: boolean;
  /** Callback to load more messages (for infinite scroll) */
  onLoadMore?: () => void;
  /** Callback when a message is clicked */
  onMessageClick?: (message: Message) => void;
  /** Callback when a message action is triggered (delete, etc.) */
  onMessageAction?: (messageId: number, action: MessageAction) => void;
  /** Whether to show timestamps for messages */
  showTimestamps?: boolean;
  /** Whether to group consecutive messages from same user */
  groupMessages?: boolean;
  /** Date format string for timestamps */
  dateFormat?: string;
};

/**
 * Props for MessageThread component
 * Component for displaying a conversation thread with messages
 */
export type MessageThreadProps = {
  /** Conversation to display */
  conversation: Conversation;
  /** Current user ID */
  currentUserId: number;
  /** Whether conversation is loading */
  isLoading?: boolean;
  /** Callback when back button is clicked */
  onBack?: () => void;
  /** Callback when conversation settings are clicked */
  onSettings?: () => void;
  /** Callback when a message is sent */
  onMessageSent?: (message: Message) => void;
  /** Whether to show conversation header */
  showHeader?: boolean;
  /** Whether to show message composer */
  showComposer?: boolean;
  /** Custom header actions */
  headerActions?: React.ReactNode;
};

/**
 * Props for ContactList component
 * Component for displaying user's contact list
 */
export type ContactListProps = {
  /** Array of contacts to display */
  contacts: Contact[];
  /** Whether contacts are loading */
  isLoading?: boolean;
  /** Search query for filtering contacts */
  searchQuery?: string;
  /** Callback when search query changes */
  onSearchChange?: (query: string) => void;
  /** Callback when a contact is clicked */
  onContactClick?: (contact: Contact) => void;
  /** Callback when block/unblock is triggered */
  onBlockToggle?: (userId: number, blocked: boolean) => void;
  /** Callback when delete contact is triggered */
  onDeleteContact?: (userId: number) => void;
  /** Whether to show online status indicators */
  showOnlineStatus?: boolean;
  /** Whether to show last message preview */
  showLastMessage?: boolean;
  /** Sort order: 'name' | 'recent' | 'online' */
  sortBy?: 'name' | 'recent' | 'online';
};

// ============================================================================
// Type Guards and Utility Types
// ============================================================================

/**
 * Type guard to check if a value is a valid ConversationType
 */
export function isConversationType(value: number): value is ConversationType {
  return (
    value === ConversationType.INDIVIDUAL ||
    value === ConversationType.GROUP ||
    value === ConversationType.SELF
  );
}

/**
 * Type guard to check if a value is a valid MessageAction
 */
export function isMessageAction(value: number): value is MessageAction {
  return value === MessageAction.READ || value === MessageAction.DELETED;
}

/**
 * Type guard to check if a conversation has unread messages
 */
export function hasUnreadMessages(conversation: Conversation): boolean {
  return conversation.unreadcount > 0;
}

/**
 * Type guard to check if a notification has been read
 */
export function isNotificationRead(notification: Notification): boolean {
  return notification.timeread !== null;
}

/**
 * Utility type for partial message updates
 */
export type MessageUpdate = Partial<Omit<Message, 'id' | 'conversationid' | 'useridfrom' | 'timecreated'>>;

/**
 * Utility type for partial conversation updates
 */
export type ConversationUpdate = Partial<Omit<Conversation, 'id' | 'type' | 'timecreated'>>;

/**
 * Utility type for message with sender information
 */
export type MessageWithSender = Message & {
  sender: ConversationMember;
};

/**
 * Utility type for conversation with pagination metadata
 */
export type ConversationListResponse = {
  conversations: Conversation[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
};

/**
 * Utility type for notification list response with pagination
 */
export type NotificationListResponse = {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  perPage: number;
  hasMore: boolean;
};
