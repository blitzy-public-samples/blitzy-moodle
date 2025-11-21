/**
 * MSW Request Handlers for Messaging and Notifications API
 * 
 * Provides comprehensive mock handlers for all messaging and notification endpoints,
 * enabling isolated frontend testing without backend dependencies. Supports various
 * test scenarios including message sending, conversation threading, read/unread states,
 * blocking, and notifications.
 * 
 * @module tests/mocks/handlers/messages
 */

import { http, HttpResponse } from 'msw';
import type { User, Message, Notification, ApiResponse } from '@/types';

// ============================================================================
// Mock Data
// ============================================================================

/**
 * Mock users for messaging scenarios
 */
const mockUsers: Record<number, User> = {
  1: {
    id: 1,
    username: 'student1',
    firstname: 'John',
    lastname: 'Student',
    fullname: 'John Student',
    email: 'john.student@example.com',
    emailstop: false,
    country: 'US',
    lang: 'en',
    timezone: 'America/New_York',
    firstaccess: 1609459200,
    lastaccess: Date.now() / 1000,
    lastlogin: Date.now() / 1000 - 3600,
    currentlogin: Date.now() / 1000,
    suspended: false,
    confirmed: true,
    auth: 'manual',
    calendartype: 'gregorian',
    profileimageurl: 'https://example.com/user1.jpg',
    profileimageurlsmall: 'https://example.com/user1_small.jpg',
  },
  2: {
    id: 2,
    username: 'teacher1',
    firstname: 'Jane',
    lastname: 'Teacher',
    fullname: 'Jane Teacher',
    email: 'jane.teacher@example.com',
    emailstop: false,
    country: 'US',
    lang: 'en',
    timezone: 'America/New_York',
    firstaccess: 1577836800,
    lastaccess: Date.now() / 1000 - 300,
    lastlogin: Date.now() / 1000 - 1800,
    currentlogin: Date.now() / 1000 - 300,
    suspended: false,
    confirmed: true,
    auth: 'manual',
    calendartype: 'gregorian',
    profileimageurl: 'https://example.com/user2.jpg',
    profileimageurlsmall: 'https://example.com/user2_small.jpg',
  },
  3: {
    id: 3,
    username: 'student2',
    firstname: 'Alice',
    lastname: 'Johnson',
    fullname: 'Alice Johnson',
    email: 'alice.johnson@example.com',
    emailstop: false,
    country: 'CA',
    lang: 'en',
    timezone: 'America/Toronto',
    firstaccess: 1612137600,
    lastaccess: Date.now() / 1000 - 86400,
    lastlogin: Date.now() / 1000 - 90000,
    currentlogin: Date.now() / 1000 - 86400,
    suspended: false,
    confirmed: true,
    auth: 'manual',
    calendartype: 'gregorian',
    profileimageurl: 'https://example.com/user3.jpg',
    profileimageurlsmall: 'https://example.com/user3_small.jpg',
  },
  4: {
    id: 4,
    username: 'blockeduser',
    firstname: 'Blocked',
    lastname: 'User',
    fullname: 'Blocked User',
    email: 'blocked@example.com',
    emailstop: false,
    country: 'US',
    lang: 'en',
    timezone: 'America/Los_Angeles',
    firstaccess: 1614556800,
    lastaccess: Date.now() / 1000 - 172800,
    lastlogin: Date.now() / 1000 - 180000,
    currentlogin: Date.now() / 1000 - 172800,
    suspended: false,
    confirmed: true,
    auth: 'manual',
    calendartype: 'gregorian',
    profileimageurl: 'https://example.com/user4.jpg',
    profileimageurlsmall: 'https://example.com/user4_small.jpg',
  },
};

/**
 * Mock messages with realistic data
 */
const mockMessages: Message[] = [
  {
    id: 1,
    useridfrom: 2,
    useridto: 1,
    subject: 'Assignment Feedback',
    fullmessage: 'Great work on your assignment! I have some feedback for you regarding the implementation.',
    fullmessageformat: 1,
    fullmessagehtml: '<p>Great work on your assignment! I have some feedback for you regarding the implementation.</p>',
    smallmessage: 'Great work on your assignment!',
    notification: false,
    timecreated: Date.now() / 1000 - 3600,
    timeread: Date.now() / 1000 - 1800,
  },
  {
    id: 2,
    useridfrom: 1,
    useridto: 2,
    subject: 'Re: Assignment Feedback',
    fullmessage: 'Thank you for the feedback! Could you provide more details about what I should improve?',
    fullmessageformat: 1,
    fullmessagehtml: '<p>Thank you for the feedback! Could you provide more details about what I should improve?</p>',
    smallmessage: 'Thank you for the feedback!',
    notification: false,
    timecreated: Date.now() / 1000 - 1800,
  },
  {
    id: 3,
    useridfrom: 3,
    useridto: 1,
    subject: 'Study Group Meeting',
    fullmessage: 'Hey! Are you available for a study group meeting this Friday at 3 PM?',
    fullmessageformat: 1,
    fullmessagehtml: '<p>Hey! Are you available for a study group meeting this Friday at 3 PM?</p>',
    smallmessage: 'Hey! Are you available for a study group meeting...',
    notification: false,
    timecreated: Date.now() / 1000 - 7200,
  },
  {
    id: 4,
    useridfrom: 2,
    useridto: 1,
    subject: 'Course Update',
    fullmessage: 'I wanted to inform you about some changes to the course schedule. Please check the updated syllabus.',
    fullmessageformat: 1,
    fullmessagehtml: '<p>I wanted to inform you about some changes to the course schedule. Please check the updated syllabus.</p>',
    smallmessage: 'I wanted to inform you about some changes...',
    notification: false,
    timecreated: Date.now() / 1000 - 86400,
    timeread: Date.now() / 1000 - 43200,
  },
  {
    id: 5,
    useridfrom: 1,
    useridto: 3,
    subject: 'Re: Study Group Meeting',
    fullmessage: 'Yes, I am available! Should we meet at the library or online?',
    fullmessageformat: 1,
    fullmessagehtml: '<p>Yes, I am available! Should we meet at the library or online?</p>',
    smallmessage: 'Yes, I am available!',
    notification: false,
    timecreated: Date.now() / 1000 - 5400,
    timeread: Date.now() / 1000 - 3600,
  },
];

/**
 * Mock notifications with various types
 */
const mockNotifications: Notification[] = [
  {
    id: 1,
    useridfrom: 2,
    useridto: 1,
    subject: 'New Assignment Posted',
    fullmessage: 'A new assignment "React Component Design" has been posted in your Web Development course.',
    fullmessageformat: 1,
    fullmessagehtml: '<p>A new assignment "React Component Design" has been posted in your Web Development course.</p>',
    smallmessage: 'New assignment posted',
    component: 'mod_assign',
    eventtype: 'assign_notification',
    contexturl: '/mod/assign/view.php?id=123',
    contexturlname: 'View Assignment',
    timecreated: Date.now() / 1000 - 1800,
  },
  {
    id: 2,
    useridfrom: 2,
    useridto: 1,
    subject: 'Grade Posted',
    fullmessage: 'Your grade for "Database Design Project" has been posted. You received 95/100.',
    fullmessageformat: 1,
    fullmessagehtml: '<p>Your grade for "Database Design Project" has been posted. You received 95/100.</p>',
    smallmessage: 'Grade posted: 95/100',
    component: 'mod_assign',
    eventtype: 'grade_posted',
    contexturl: '/mod/assign/view.php?id=456',
    contexturlname: 'View Submission',
    timeread: Date.now() / 1000 - 3600,
    timecreated: Date.now() / 1000 - 7200,
  },
  {
    id: 3,
    useridfrom: 3,
    useridto: 1,
    subject: 'Forum Post Reply',
    fullmessage: 'Alice Johnson replied to your post in the "General Discussion" forum.',
    fullmessageformat: 1,
    fullmessagehtml: '<p>Alice Johnson replied to your post in the "General Discussion" forum.</p>',
    smallmessage: 'New forum reply',
    component: 'mod_forum',
    eventtype: 'forum_post',
    contexturl: '/mod/forum/discuss.php?d=789',
    contexturlname: 'View Discussion',
    timecreated: Date.now() / 1000 - 14400,
  },
  {
    id: 4,
    useridfrom: 0,
    useridto: 1,
    subject: 'Course Announcement',
    fullmessage: 'Important: The final exam date has been changed to December 20th. Please mark your calendars.',
    fullmessageformat: 1,
    fullmessagehtml: '<p><strong>Important:</strong> The final exam date has been changed to December 20th. Please mark your calendars.</p>',
    smallmessage: 'Final exam date changed',
    component: 'moodle',
    eventtype: 'course_announcement',
    contexturl: '/course/view.php?id=10',
    contexturlname: 'View Course',
    timeread: Date.now() / 1000 - 7200,
    timecreated: Date.now() / 1000 - 86400,
  },
  {
    id: 5,
    useridfrom: 2,
    useridto: 1,
    subject: 'Assignment Due Soon',
    fullmessage: 'Reminder: Your assignment "React Component Design" is due in 2 days.',
    fullmessageformat: 1,
    fullmessagehtml: '<p><strong>Reminder:</strong> Your assignment "React Component Design" is due in 2 days.</p>',
    smallmessage: 'Assignment due in 2 days',
    component: 'mod_assign',
    eventtype: 'assign_due_reminder',
    contexturl: '/mod/assign/view.php?id=123',
    contexturlname: 'View Assignment',
    timecreated: Date.now() / 1000 - 300,
  },
  {
    id: 6,
    useridfrom: 0,
    useridto: 1,
    subject: 'System Update',
    fullmessage: 'The learning management system will undergo maintenance tonight from 11 PM to 2 AM.',
    fullmessageformat: 1,
    fullmessagehtml: '<p>The learning management system will undergo maintenance tonight from 11 PM to 2 AM.</p>',
    smallmessage: 'System maintenance tonight',
    component: 'moodle',
    eventtype: 'system_update',
    timecreated: Date.now() / 1000 - 172800,
  },
];

/**
 * Blocked users list (user IDs)
 */
let blockedUsers: number[] = [4];

/**
 * Starred/favorite contacts
 */
const starredContacts: number[] = [2];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get user info with online status
 */
function getUserWithOnlineStatus(userId: number): User & { isonline: boolean } {
  const user = mockUsers[userId];
  if (!user) {
    return {
      id: userId,
      username: `user${userId}`,
      firstname: 'Unknown',
      lastname: 'User',
      fullname: 'Unknown User',
      email: `user${userId}@example.com`,
      emailstop: false,
      country: 'US',
      lang: 'en',
      timezone: 'UTC',
      firstaccess: 0,
      lastaccess: 0,
      lastlogin: 0,
      currentlogin: 0,
      suspended: false,
      confirmed: true,
      auth: 'manual',
      calendartype: 'gregorian',
      isonline: false,
    };
  }

  // Consider online if last access within 5 minutes
  const isonline = (Date.now() / 1000 - user.lastaccess) < 300;

  return { ...user, isonline };
}

/**
 * Format message with user information
 */
function formatMessageWithUsers(message: Message) {
  return {
    ...message,
    userfrom: getUserWithOnlineStatus(message.useridfrom),
    userto: getUserWithOnlineStatus(message.useridto),
    read: !!message.timeread,
    starred: false,
    conversationid: getConversationIdForUsers(message.useridfrom, message.useridto),
  };
}

/**
 * Get conversation ID for two users
 */
function getConversationIdForUsers(user1: number, user2: number): number {
  // Simple deterministic conversation ID based on user IDs
  if (user1 === 1 && user2 === 2 || user1 === 2 && user2 === 1) {return 1;}
  if (user1 === 1 && user2 === 3 || user1 === 3 && user2 === 1) {return 2;}
  return Math.abs(user1 * 1000 + user2); // Fallback
}

/**
 * Filter messages based on query parameters
 */
function filterMessages(
  messages: Message[],
  currentUserId: number,
  params: {
    type?: string;
    read?: string;
    search?: string;
  }
) {
  let filtered = messages.filter(
    (msg) => msg.useridfrom === currentUserId || msg.useridto === currentUserId
  );

  // Filter by type
  if (params.type === 'sent') {
    filtered = filtered.filter((msg) => msg.useridfrom === currentUserId);
  } else if (params.type === 'received') {
    filtered = filtered.filter((msg) => msg.useridto === currentUserId);
  }

  // Filter by read status
  if (params.read === 'true') {
    filtered = filtered.filter((msg) => msg.timeread !== undefined);
  } else if (params.read === 'false') {
    filtered = filtered.filter((msg) => msg.timeread === undefined);
  }

  // Search filter
  if (params.search) {
    const searchLower = params.search.toLowerCase();
    filtered = filtered.filter(
      (msg) =>
        msg.subject.toLowerCase().includes(searchLower) ||
        msg.fullmessage.toLowerCase().includes(searchLower)
    );
  }

  return filtered;
}

/**
 * Apply pagination to array
 */
function paginateArray<T>(
  items: T[],
  page: number = 1,
  perPage: number = 20
): { items: T[]; total: number; totalPages: number } {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const paginatedItems = items.slice(start, end);

  return {
    items: paginatedItems,
    total: items.length,
    totalPages: Math.ceil(items.length / perPage),
  };
}

/**
 * Simulate network latency
 */
function delay(ms: number = 150): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Request Handlers
// ============================================================================

/**
 * GET /api/v1/messages - List messages
 */
const listMessagesHandler = http.get('/api/v1/messages', async ({ request }) => {
  await delay();

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'all';
  const read = url.searchParams.get('read') || 'all';
  const search = url.searchParams.get('search') || '';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const perPage = parseInt(url.searchParams.get('perPage') || '20', 10);

  // Assume current user is ID 1 for testing
  const currentUserId = 1;

  const filtered = filterMessages(mockMessages, currentUserId, { type, read, search });

  // Sort by most recent first
  filtered.sort((a, b) => b.timecreated - a.timecreated);

  const paginated = paginateArray(filtered, page, perPage);

  const formattedMessages = paginated.items.map(formatMessageWithUsers);

  // Calculate unread count
  const unreadCount = mockMessages.filter(
    (msg) => msg.useridto === currentUserId && !msg.timeread
  ).length;

  const response = {
    success: true,
    data: {
      messages: formattedMessages,
    },
    meta: {
      pagination: {
        page,
        perPage,
        total: paginated.total,
        totalPages: paginated.totalPages,
      },
      unreadCount,
    },
  };

  return HttpResponse.json(response);
});

/**
 * POST /api/v1/messages - Send message
 */
const sendMessageHandler = http.post('/api/v1/messages', async ({ request }) => {
  await delay(200);

  const body = await request.json() as {
    useridto: number | number[];
    subject?: string;
    message: string;
    format?: number;
  };

  // Validation
  if (!body.message || body.message.trim().length === 0) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Message text is required',
          details: { field: 'message', constraint: 'required' },
        },
      },
      { status: 422 }
    );
  }

  if (body.message.length > 5000) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Message text is too long (maximum 5000 characters)',
          details: { field: 'message', constraint: 'maxLength', maxLength: 5000 },
        },
      },
      { status: 422 }
    );
  }

  // Check if recipient exists
  const recipientIds = Array.isArray(body.useridto) ? body.useridto : [body.useridto];
  
  for (const recipientId of recipientIds) {
    if (!mockUsers[recipientId]) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `User with ID ${recipientId} not found`,
            details: { resourceType: 'user', resourceId: recipientId },
          },
        },
        { status: 404 }
      );
    }

    // Check if user is blocked
    if (blockedUsers.includes(recipientId)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Cannot send message to blocked user',
            details: { reason: 'user_blocked', userId: recipientId },
          },
        },
        { status: 403 }
      );
    }
  }

  // Create new message(s)
  const currentUserId = 1;
  const now = Date.now() / 1000;
  const newMessages = recipientIds.map((recipientId, index) => {
    const newMessage: Message = {
      id: mockMessages.length + 1 + index,
      useridfrom: currentUserId,
      useridto: recipientId,
      subject: body.subject || 'No Subject',
      fullmessage: body.message,
      fullmessageformat: body.format || 1,
      fullmessagehtml: body.format === 1 ? `<p>${body.message}</p>` : undefined,
      smallmessage: body.message.substring(0, 100),
      notification: false,
      timecreated: now,
    };

    mockMessages.push(newMessage);
    return newMessage;
  });

  const formattedMessages = newMessages.map(formatMessageWithUsers);

  // Return single message or array based on number of recipients
  const response = recipientIds.length === 1
    ? {
        success: true,
        data: {
          message: formattedMessages[0],
        },
      }
    : {
        success: true,
        data: {
          messages: formattedMessages,
        },
      };

  return HttpResponse.json(response, { status: 201 });
});

/**
 * GET /api/v1/messages/conversation/:id - Get conversation
 */
const getConversationHandler = http.get(
  '/api/v1/messages/conversation/:id',
  async ({ params, request }) => {
    await delay();

    const conversationId = parseInt(params.id as string, 10);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('perPage') || '50', 10);

    // Assume current user is ID 1
    const currentUserId = 1;

    // Find messages in this conversation
    const conversationMessages = mockMessages.filter((msg) => {
      const msgConvId = getConversationIdForUsers(msg.useridfrom, msg.useridto);
      return msgConvId === conversationId;
    });

    if (conversationMessages.length === 0) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Conversation with ID ${conversationId} not found`,
            details: { resourceType: 'conversation', resourceId: conversationId },
          },
        },
        { status: 404 }
      );
    }

    // Sort by creation time (oldest first for conversation view)
    conversationMessages.sort((a, b) => a.timecreated - b.timecreated);

    // Mark unread messages as read (simulate opening conversation)
    conversationMessages.forEach((msg) => {
      if (msg.useridto === currentUserId && !msg.timeread) {
        msg.timeread = Date.now() / 1000;
      }
    });

    const paginated = paginateArray(conversationMessages, page, perPage);
    const formattedMessages = paginated.items.map(formatMessageWithUsers);

    // Get participant info
    const participantIds = new Set(
      conversationMessages.flatMap((msg) => [msg.useridfrom, msg.useridto])
    );
    const participants = Array.from(participantIds).map(getUserWithOnlineStatus);

    const response: ApiResponse<{
      messages: typeof formattedMessages;
      participants: typeof participants;
    }> = {
      success: true,
      data: {
        messages: formattedMessages,
        participants,
      },
      meta: {
        pagination: {
          page,
          perPage,
          total: paginated.total,
          totalPages: paginated.totalPages,
        },
      },
    };

    return HttpResponse.json(response);
  }
);

/**
 * PUT /api/v1/messages/:id/read - Mark message as read
 */
const markMessageReadHandler = http.put(
  '/api/v1/messages/:id/read',
  async ({ params }) => {
    await delay(100);

    const messageId = parseInt(params.id as string, 10);
    const currentUserId = 1;

    const message = mockMessages.find((msg) => msg.id === messageId);

    if (!message) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Message with ID ${messageId} not found`,
            details: { resourceType: 'message', resourceId: messageId },
          },
        },
        { status: 404 }
      );
    }

    // Check if current user is the recipient
    if (message.useridto !== currentUserId) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You can only mark your own messages as read',
            details: { reason: 'not_recipient' },
          },
        },
        { status: 403 }
      );
    }

    // Mark as read
    message.timeread = Date.now() / 1000;

    const response: ApiResponse<{ message: ReturnType<typeof formatMessageWithUsers> }> = {
      success: true,
      data: {
        message: formatMessageWithUsers(message),
      },
    };

    return HttpResponse.json(response);
  }
);

/**
 * DELETE /api/v1/messages/:id - Delete message
 */
const deleteMessageHandler = http.delete('/api/v1/messages/:id', async ({ params }) => {
  await delay(100);

  const messageId = parseInt(params.id as string, 10);
  const currentUserId = 1;

  const messageIndex = mockMessages.findIndex((msg) => msg.id === messageId);

  if (messageIndex === -1) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Message with ID ${messageId} not found`,
          details: { resourceType: 'message', resourceId: messageId },
        },
      },
      { status: 404 }
    );
  }

  const message = mockMessages[messageIndex]!;

  // Check if current user is involved in the message
  if (message.useridfrom !== currentUserId && message.useridto !== currentUserId) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You can only delete your own messages',
          details: { reason: 'not_authorized' },
        },
      },
      { status: 403 }
      );
  }

  // Soft delete - mark deletion timestamp
  if (message.useridfrom === currentUserId) {
    message.timeuserfromdeleted = Date.now() / 1000;
  } else {
    message.timeusertodeleted = Date.now() / 1000;
  }

  const response: ApiResponse<{ deleted: boolean; messageId: number }> = {
    success: true,
    data: {
      deleted: true,
      messageId,
    },
  };

  return HttpResponse.json(response);
});

/**
 * GET /api/v1/messages/contacts - Get contacts
 */
const getContactsHandler = http.get('/api/v1/messages/contacts', async ({ request }) => {
  await delay();

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const currentUserId = 1;

  // Get users the current user has messaged
  const contactIds = new Set<number>();
  mockMessages.forEach((msg) => {
    if (msg.useridfrom === currentUserId) {
      contactIds.add(msg.useridto);
    } else if (msg.useridto === currentUserId) {
      contactIds.add(msg.useridfrom);
    }
  });

  let contacts = Array.from(contactIds).map((userId) => {
    const user = getUserWithOnlineStatus(userId);

    // Get last message with this contact
    const messagesWithContact = mockMessages
      .filter(
        (msg) =>
          (msg.useridfrom === currentUserId && msg.useridto === userId) ||
          (msg.useridfrom === userId && msg.useridto === currentUserId)
      )
      .sort((a, b) => b.timecreated - a.timecreated);

    const lastMessage = messagesWithContact[0];
    const unreadCount = messagesWithContact.filter(
      (msg) => msg.useridto === currentUserId && !msg.timeread
    ).length;

    return {
      ...user,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            text: lastMessage.smallmessage,
            timecreated: lastMessage.timecreated,
          }
        : null,
      unreadCount,
      isStarred: starredContacts.includes(userId),
      isBlocked: blockedUsers.includes(userId),
    };
  });

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    contacts = contacts.filter(
      (contact) =>
        contact.fullname?.toLowerCase().includes(searchLower) ||
        contact.username.toLowerCase().includes(searchLower) ||
        contact.email.toLowerCase().includes(searchLower)
    );
  }

  // Sort by last message time
  contacts.sort((a, b) => {
    const aTime = a.lastMessage?.timecreated || 0;
    const bTime = b.lastMessage?.timecreated || 0;
    return bTime - aTime;
  });

  const response = {
    success: true,
    data: {
      contacts,
    },
  };

  return HttpResponse.json(response);
});

/**
 * POST /api/v1/messages/contacts/:id/block - Block user
 */
const blockUserHandler = http.post(
  '/api/v1/messages/contacts/:id/block',
  async ({ params }) => {
    await delay(100);

    const userId = parseInt(params.id as string, 10);

    if (!mockUsers[userId]) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `User with ID ${userId} not found`,
            details: { resourceType: 'user', resourceId: userId },
          },
        },
        { status: 404 }
      );
    }

    if (!blockedUsers.includes(userId)) {
      blockedUsers.push(userId);
    }

    const response: ApiResponse<{ blocked: boolean; userId: number }> = {
      success: true,
      data: {
        blocked: true,
        userId,
      },
    };

    return HttpResponse.json(response);
  }
);

/**
 * DELETE /api/v1/messages/contacts/:id/block - Unblock user
 */
const unblockUserHandler = http.delete(
  '/api/v1/messages/contacts/:id/block',
  async ({ params }) => {
    await delay(100);

    const userId = parseInt(params.id as string, 10);

    if (!mockUsers[userId]) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `User with ID ${userId} not found`,
            details: { resourceType: 'user', resourceId: userId },
          },
        },
        { status: 404 }
      );
    }

    blockedUsers = blockedUsers.filter((id) => id !== userId);

    const response: ApiResponse<{ unblocked: boolean; userId: number }> = {
      success: true,
      data: {
        unblocked: true,
        userId,
      },
    };

    return HttpResponse.json(response);
  }
);

/**
 * GET /api/v1/notifications - Get notifications
 */
const getNotificationsHandler = http.get('/api/v1/notifications', async ({ request }) => {
  await delay();

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'all';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const perPage = parseInt(url.searchParams.get('perPage') || '20', 10);
  const currentUserId = 1;

  // Filter notifications for current user
  let filtered = mockNotifications.filter((notif) => notif.useridto === currentUserId);

  // Filter by type
  if (type === 'unread') {
    filtered = filtered.filter((notif) => !notif.timeread);
  } else if (type === 'course-related') {
    filtered = filtered.filter((notif) =>
      ['mod_assign', 'mod_quiz', 'mod_forum'].includes(notif.component)
    );
  } else if (type === 'assignment-due') {
    filtered = filtered.filter(
      (notif) => notif.component === 'mod_assign' && notif.eventtype.includes('due')
    );
  } else if (type === 'grade-updated') {
    filtered = filtered.filter(
      (notif) => notif.component === 'mod_assign' && notif.eventtype.includes('grade')
    );
  } else if (type === 'forum-post') {
    filtered = filtered.filter((notif) => notif.component === 'mod_forum');
  }

  // Sort by most recent first
  filtered.sort((a, b) => b.timecreated - a.timecreated);

  const paginated = paginateArray(filtered, page, perPage);

  // Add user from info
  const formattedNotifications = paginated.items.map((notif) => ({
    ...notif,
    userfrom: notif.useridfrom > 0 ? getUserWithOnlineStatus(notif.useridfrom) : null,
    read: !!notif.timeread,
  }));

  // Calculate unread count
  const unreadCount = mockNotifications.filter(
    (notif) => notif.useridto === currentUserId && !notif.timeread
  ).length;

  const response = {
    success: true,
    data: {
      notifications: formattedNotifications,
    },
    meta: {
      pagination: {
        page,
        perPage,
        total: paginated.total,
        totalPages: paginated.totalPages,
      },
      unreadCount,
    },
  };

  return HttpResponse.json(response);
});

/**
 * PUT /api/v1/notifications/:id/read - Mark notification as read
 */
const markNotificationReadHandler = http.put(
  '/api/v1/notifications/:id/read',
  async ({ params }) => {
    await delay(100);

    const notificationId = parseInt(params.id as string, 10);
    const currentUserId = 1;

    const notification = mockNotifications.find((notif) => notif.id === notificationId);

    if (!notification) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Notification with ID ${notificationId} not found`,
            details: { resourceType: 'notification', resourceId: notificationId },
          },
        },
        { status: 404 }
      );
    }

    // Check if current user is the recipient
    if (notification.useridto !== currentUserId) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You can only mark your own notifications as read',
            details: { reason: 'not_recipient' },
          },
        },
        { status: 403 }
      );
    }

    // Mark as read
    notification.timeread = Date.now() / 1000;

    const response = {
      success: true,
      data: {
        notification: {
          ...notification,
          userfrom:
            notification.useridfrom > 0
              ? getUserWithOnlineStatus(notification.useridfrom)
              : null,
          read: true,
        },
      },
    };

    return HttpResponse.json(response);
  }
);

/**
 * DELETE /api/v1/notifications/:id - Delete notification
 */
const deleteNotificationHandler = http.delete(
  '/api/v1/notifications/:id',
  async ({ params }) => {
    await delay(100);

    const notificationId = parseInt(params.id as string, 10);
    const currentUserId = 1;

    const notificationIndex = mockNotifications.findIndex(
      (notif) => notif.id === notificationId
    );

    if (notificationIndex === -1) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Notification with ID ${notificationId} not found`,
            details: { resourceType: 'notification', resourceId: notificationId },
          },
        },
        { status: 404 }
      );
    }

    const notification = mockNotifications[notificationIndex]!;

    // Check if current user is the recipient
    if (notification.useridto !== currentUserId) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You can only delete your own notifications',
            details: { reason: 'not_recipient' },
          },
        },
        { status: 403 }
      );
    }

    // Remove notification
    mockNotifications.splice(notificationIndex, 1);

    const response: ApiResponse<{ deleted: boolean; notificationId: number }> = {
      success: true,
      data: {
        deleted: true,
        notificationId,
      },
    };

    return HttpResponse.json(response);
  }
);

// ============================================================================
// Export Handlers
// ============================================================================

/**
 * Array of all messaging and notification MSW request handlers
 */
export const messagesHandlers = [
  listMessagesHandler,
  sendMessageHandler,
  getConversationHandler,
  markMessageReadHandler,
  deleteMessageHandler,
  getContactsHandler,
  blockUserHandler,
  unblockUserHandler,
  getNotificationsHandler,
  markNotificationReadHandler,
  deleteNotificationHandler,
];
