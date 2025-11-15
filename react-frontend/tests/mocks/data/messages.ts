/**
 * Mock Message Data Generators
 * 
 * Factory functions for creating realistic Moodle message, conversation, and notification
 * entities for testing. Provides mockMessage(), mockConversation(), mockNotification() and
 * related helpers with sensible defaults for all message properties including sender/recipient,
 * timestamps, read status, and customizable overrides.
 * 
 * All generated mock data matches the Message, Conversation, and Notification interface
 * structures and includes realistic timestamps, message content, and notification metadata
 * based on actual Moodle messaging patterns.
 * 
 * @module tests/mocks/data/messages
 * @see react-frontend/src/types/entities.ts - Message, Conversation, Notification interfaces
 * @see public/message/lib.php - Moodle messaging reference
 */

import type { Message, Conversation, Notification } from '@/types/entities';
import type { Id, MessageId, UserId } from '@/types/common';
import { mockUser } from './users';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * DeepPartial utility type for nested partial objects
 * Allows partial overrides of nested properties in interfaces
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : DeepPartial<T[P]>
    : T[P];
};

// ============================================================================
// ID and Timestamp Generation
// ============================================================================

/**
 * Counter for generating sequential message IDs
 */
let messageIdCounter = 1;

/**
 * Counter for generating sequential conversation IDs
 */
let conversationIdCounter = 1;

/**
 * Counter for generating sequential notification IDs
 */
let notificationIdCounter = 1;

/**
 * Generates a unique sequential message ID
 * 
 * @returns {MessageId} Sequential message ID starting from 1
 * 
 * @example
 * const id1 = generateMessageId(); // 1
 * const id2 = generateMessageId(); // 2
 */
export function generateMessageId(): MessageId {
  return messageIdCounter++;
}

/**
 * Generates a unique sequential conversation ID
 * 
 * @returns {Id} Sequential conversation ID starting from 1
 */
function generateConversationId(): Id {
  return conversationIdCounter++;
}

/**
 * Generates a unique sequential notification ID
 * 
 * @returns {Id} Sequential notification ID starting from 1
 */
function generateNotificationId(): Id {
  return notificationIdCounter++;
}

/**
 * Generates a realistic Unix timestamp
 * 
 * @param {number} [minutesAgo=0] - Number of minutes in the past (0 = now)
 * @returns {number} Unix timestamp in seconds
 * 
 * @example
 * const now = generateTimestamp();
 * const fiveMinutesAgo = generateTimestamp(5);
 * const oneHourAgo = generateTimestamp(60);
 */
export function generateTimestamp(minutesAgo: number = 0): number {
  const now = Date.now();
  const minutesInMs = minutesAgo * 60 * 1000;
  return Math.floor((now - minutesInMs) / 1000);
}

// ============================================================================
// Component and Event Type Helpers
// ============================================================================

/**
 * Returns a random Moodle component name
 * Based on common Moodle components that generate messages/notifications
 * 
 * @returns {string} Random component name
 */
export function getRandomComponent(): string {
  const components = [
    'mod_assign',
    'mod_quiz',
    'mod_forum',
    'mod_workshop',
    'mod_lesson',
    'core',
    'moodle',
    'enrol_manual',
    'core_message',
    'core_badges',
  ];
  return components[Math.floor(Math.random() * components.length)];
}

/**
 * Returns a random event type
 * Based on common Moodle event types that trigger notifications
 * 
 * @returns {string} Random event type
 */
export function getRandomEventType(): string {
  const eventTypes = [
    'assign_notification',
    'quiz_attempt_submitted',
    'forum_post_created',
    'message_sent',
    'badge_awarded',
    'course_module_completion',
    'submission_graded',
    'assignment_due',
    'course_enrolment',
    'discussion_reply',
  ];
  return eventTypes[Math.floor(Math.random() * eventTypes.length)];
}

// ============================================================================
// Message Factory Functions
// ============================================================================

/**
 * Creates a mock Moodle message with realistic default values
 * 
 * Generates a complete Message object with all required and optional fields populated
 * with sensible defaults matching actual Moodle message data. Accepts partial overrides
 * for customization in specific test scenarios.
 * 
 * Default values based on Moodle message table schema:
 * - User IDs: sender=1, recipient=2
 * - Subject: 'Test Message'
 * - Format: 1 (HTML)
 * - Notification: false (regular message)
 * - Timestamps: Created now, unread
 * - Status: Not deleted by either party
 * 
 * @param {DeepPartial<Message>} [overrides={}] - Partial message properties to override defaults
 * @returns {Message} Complete message object with all fields populated
 * 
 * @example
 * // Basic message with all defaults
 * const message = mockMessage();
 * 
 * @example
 * // Read message from specific user
 * const readMessage = mockMessage({
 *   useridfrom: 5,
 *   timeread: generateTimestamp(10)
 * });
 * 
 * @example
 * // Notification message with context
 * const notification = mockMessage({
 *   notification: true,
 *   component: 'mod_assign',
 *   eventtype: 'assign_notification',
 *   contexturl: '/mod/assign/view.php?id=1'
 * });
 */
export function mockMessage(overrides: DeepPartial<Message> = {}): Message {
  const defaultMessage: Message = {
    id: generateMessageId(),
    useridfrom: 1,
    useridto: 2,
    subject: 'Test Message',
    fullmessage: 'This is a test message for unit testing',
    fullmessageformat: 1,
    fullmessagehtml: '<p>This is a test message for unit testing</p>',
    smallmessage: 'Test message',
    notification: false,
    contexturl: undefined,
    contexturlname: undefined,
    timecreated: generateTimestamp(),
    timeread: undefined,
    timeuserfromdeleted: undefined,
    timeusertodeleted: undefined,
    component: undefined,
    eventtype: undefined,
    customdata: undefined,
    userfromfullname: undefined,
    usertofullname: undefined,
    conversationid: undefined,
  };

  return {
    ...defaultMessage,
    ...overrides,
  };
}

/**
 * Creates a mock read message
 * 
 * Convenience factory for creating messages that have been read by the recipient.
 * Sets timecreated to 10 minutes ago and timeread to 5 minutes ago by default.
 * 
 * @param {DeepPartial<Message>} [overrides={}] - Partial message properties to override
 * @returns {Message} Message with timeread set
 * 
 * @example
 * const readMessage = mockReadMessage();
 * console.log(readMessage.timeread); // timestamp 5 minutes ago
 * console.log(readMessage.timecreated); // timestamp 10 minutes ago
 * 
 * @example
 * // Read message 1 hour ago
 * const oldReadMessage = mockReadMessage({
 *   timeread: generateTimestamp(60)
 * });
 */
export function mockReadMessage(overrides: DeepPartial<Message> = {}): Message {
  return mockMessage({
    timecreated: generateTimestamp(10),
    timeread: generateTimestamp(5),
    ...overrides,
  });
}

/**
 * Creates a mock unread message
 * 
 * Convenience factory for creating messages that have not been read by the recipient.
 * Explicitly sets timeread to undefined.
 * 
 * @param {DeepPartial<Message>} [overrides={}] - Partial message properties to override
 * @returns {Message} Message with timeread undefined
 * 
 * @example
 * const unreadMessage = mockUnreadMessage();
 * console.log(unreadMessage.timeread); // undefined
 */
export function mockUnreadMessage(overrides: DeepPartial<Message> = {}): Message {
  return mockMessage({
    timeread: undefined,
    ...overrides,
  });
}

/**
 * Creates an array of mock messages
 * 
 * Generates multiple messages with unique IDs and sequential timestamps.
 * Useful for testing message lists and pagination.
 * 
 * @param {number} count - Number of messages to generate
 * @param {UserId} [useridfrom] - Sender user ID for all messages
 * @param {UserId} [useridto] - Recipient user ID for all messages
 * @param {DeepPartial<Message>} [overrides={}] - Overrides applied to all messages
 * @returns {Message[]} Array of messages with unique IDs
 * 
 * @example
 * // Generate 10 messages from user 5 to user 2
 * const messages = mockMessageArray(10, 5, 2);
 * 
 * @example
 * // Generate 5 unread messages
 * const unreadMessages = mockMessageArray(5, undefined, undefined, {
 *   timeread: undefined
 * });
 */
export function mockMessageArray(
  count: number = 5,
  useridfrom?: UserId,
  useridto?: UserId,
  overrides: DeepPartial<Message> = {}
): Message[] {
  return Array.from({ length: count }, (_, index) =>
    mockMessage({
      id: index + 1,
      useridfrom: useridfrom ?? 1,
      useridto: useridto ?? 2,
      timecreated: generateTimestamp(count - index),
      ...overrides,
    })
  );
}

// ============================================================================
// Notification Factory Functions
// ============================================================================

/**
 * Creates a mock Moodle notification with realistic default values
 * 
 * Generates a complete Notification object with all required and optional fields populated
 * with sensible defaults matching actual Moodle notification data. Notifications differ
 * from regular messages by always having component and eventtype defined.
 * 
 * Default values based on Moodle notification patterns:
 * - User IDs: sender=1, recipient=2
 * - Component: 'mod_assign'
 * - Event type: 'assign_notification'
 * - Context: Assignment view URL
 * - Format: 1 (HTML)
 * - Status: Unread
 * 
 * @param {DeepPartial<Notification>} [overrides={}] - Partial notification properties to override
 * @returns {Notification} Complete notification object with all fields populated
 * 
 * @example
 * // Basic notification with defaults
 * const notification = mockNotification();
 * 
 * @example
 * // Read notification for quiz attempt
 * const quizNotification = mockNotification({
 *   component: 'mod_quiz',
 *   eventtype: 'quiz_attempt_submitted',
 *   contexturl: '/mod/quiz/review.php?attempt=123',
 *   timeread: generateTimestamp(30)
 * });
 * 
 * @example
 * // Badge awarded notification
 * const badgeNotification = mockNotification({
 *   component: 'core_badges',
 *   eventtype: 'badge_awarded',
 *   subject: 'You earned a badge!',
 *   smallmessage: 'Badge: Course Completion'
 * });
 */
export function mockNotification(overrides: DeepPartial<Notification> = {}): Notification {
  const defaultNotification: Notification = {
    id: generateNotificationId(),
    useridfrom: 1,
    useridto: 2,
    subject: 'Test Notification',
    fullmessage: 'This is a test notification',
    fullmessageformat: 1,
    fullmessagehtml: '<p>This is a test notification</p>',
    smallmessage: 'Test notification',
    component: 'mod_assign',
    eventtype: 'assign_notification',
    contexturl: '/mod/assign/view.php?id=1',
    contexturlname: 'Assignment',
    timeread: undefined,
    timecreated: generateTimestamp(),
  };

  return {
    ...defaultNotification,
    ...overrides,
  };
}

/**
 * Creates an array of mock notifications
 * 
 * Generates multiple notifications with unique IDs, random components/event types,
 * and sequential timestamps. Useful for testing notification lists and feeds.
 * 
 * @param {number} [count=5] - Number of notifications to generate
 * @param {UserId} [useridto] - Recipient user ID for all notifications (defaults to 2)
 * @param {DeepPartial<Notification>} [overrides={}] - Overrides applied to all notifications
 * @returns {Notification[]} Array of notifications with unique IDs
 * 
 * @example
 * // Generate 5 notifications with default settings
 * const notifications = mockNotificationArray();
 * 
 * @example
 * // Generate 3 notifications for user 10
 * const notifications = mockNotificationArray(3, 10);
 * 
 * @example
 * // Generate 3 read notifications
 * const readNotifications = mockNotificationArray(3, 5, {
 *   timeread: generateTimestamp(10)
 * });
 * 
 * @example
 * // Generate 10 assignment notifications
 * const assignNotifications = mockNotificationArray(10, 8, {
 *   component: 'mod_assign',
 *   eventtype: 'assign_notification'
 * });
 */
export function mockNotificationArray(
  count: number = 5,
  useridto?: UserId,
  overrides: DeepPartial<Notification> = {}
): Notification[] {
  return Array.from({ length: count }, (_, index) =>
    mockNotification({
      id: index + 1,
      useridto: useridto ?? 2,
      timecreated: generateTimestamp(count - index),
      component: getRandomComponent(),
      eventtype: getRandomEventType(),
      ...overrides,
    })
  );
}

// ============================================================================
// Conversation Factory Functions
// ============================================================================

/**
 * Creates a mock Moodle conversation with realistic default values
 * 
 * Generates a complete Conversation object with all required and optional fields populated
 * with sensible defaults matching actual Moodle conversation data.
 * 
 * Default values based on Moodle conversation table schema:
 * - Type: 1 (individual conversation)
 * - Name: undefined (individual conversations don't have names)
 * - Enabled: true
 * - Timestamps: Created and modified now
 * 
 * @param {DeepPartial<Conversation>} [overrides={}] - Partial conversation properties to override
 * @returns {Conversation} Complete conversation object with all fields populated
 * 
 * @example
 * // Basic individual conversation
 * const conversation = mockConversation();
 * console.log(conversation.type); // 1 (individual)
 * 
 * @example
 * // Disabled conversation
 * const disabledConversation = mockConversation({
 *   enabled: false
 * });
 * 
 * @example
 * // Conversation with custom ID and timestamps
 * const oldConversation = mockConversation({
 *   id: 100,
 *   timecreated: generateTimestamp(10080), // 1 week ago
 *   timemodified: generateTimestamp(60)
 * });
 */
export function mockConversation(overrides: DeepPartial<Conversation> = {}): Conversation {
  const defaultConversation: Conversation = {
    id: generateConversationId(),
    type: 1,
    name: undefined,
    enabled: true,
    timecreated: generateTimestamp(),
    timemodified: generateTimestamp(),
  };

  return {
    ...defaultConversation,
    ...overrides,
  };
}

/**
 * Creates a mock group conversation
 * 
 * Convenience factory for creating group conversations (type 2) with a name.
 * Group conversations require a name and are used for multi-user discussions.
 * 
 * @param {DeepPartial<Conversation>} [overrides={}] - Partial conversation properties to override
 * @returns {Conversation} Group conversation with type 2 and name
 * 
 * @example
 * const groupChat = mockGroupConversation();
 * console.log(groupChat.type); // 2 (group)
 * console.log(groupChat.name); // 'Group Chat'
 * 
 * @example
 * // Custom group name
 * const projectGroup = mockGroupConversation({
 *   name: 'Project Team Discussion'
 * });
 */
export function mockGroupConversation(overrides: DeepPartial<Conversation> = {}): Conversation {
  return mockConversation({
    type: 2,
    name: 'Group Chat',
    ...overrides,
  });
}

/**
 * Creates a complete conversation structure with messages
 * 
 * Generates a conversation along with an array of messages belonging to that conversation.
 * Useful for testing conversation views and message threads.
 * 
 * @param {number} [messageCount=5] - Number of messages to generate
 * @param {object} [overrides] - Overrides for conversation and messages
 * @param {DeepPartial<Conversation>} [overrides.conversation] - Conversation property overrides
 * @param {DeepPartial<Message>} [overrides.messages] - Message property overrides applied to all messages
 * @returns {{ conversation: Conversation; messages: Message[] }} Object containing conversation and messages
 * 
 * @example
 * // Conversation with 5 messages
 * const { conversation, messages } = mockConversationWithMessages();
 * 
 * @example
 * // Group conversation with 10 messages
 * const groupConv = mockConversationWithMessages(10, {
 *   conversation: { type: 2, name: 'Study Group' }
 * });
 * 
 * @example
 * // Conversation with unread messages
 * const unreadConv = mockConversationWithMessages(3, {
 *   messages: { timeread: undefined }
 * });
 */
export function mockConversationWithMessages(
  messageCount: number = 5,
  overrides?: {
    conversation?: DeepPartial<Conversation>;
    messages?: DeepPartial<Message>;
  }
): { conversation: Conversation; messages: Message[] } {
  const conversation = mockConversation(overrides?.conversation);
  const messages = mockMessageArray(
    messageCount,
    undefined,
    undefined,
    {
      conversationid: conversation.id,
      ...overrides?.messages,
    }
  );

  return {
    conversation,
    messages,
  };
}

// ============================================================================
// Reset Functions (for test isolation)
// ============================================================================

/**
 * Resets all ID counters to their initial values
 * 
 * Call this function in test setup/teardown to ensure consistent IDs across test runs.
 * Prevents ID conflicts and ensures reproducible test data.
 * 
 * @example
 * // In test setup
 * beforeEach(() => {
 *   resetMessageCounters();
 * });
 */
export function resetMessageCounters(): void {
  messageIdCounter = 1;
  conversationIdCounter = 1;
  notificationIdCounter = 1;
}
