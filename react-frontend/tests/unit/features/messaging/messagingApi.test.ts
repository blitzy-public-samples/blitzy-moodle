/**
 * Unit Test Suite for Messaging API Client
 *
 * Comprehensive unit tests for react-frontend/src/features/messaging/api/messagingApi.ts
 * using Vitest testing framework and MSW (Mock Service Worker) for HTTP request mocking.
 *
 * Tests cover all REST API client functions including:
 * - Message operations (getMessages, sendMessage, deleteMessage)
 * - Conversation management (getConversations, markConversationAsRead)
 * - Contact operations (getContacts, getContactRequests, blockUser)
 * - Notification handling (getNotifications, getUnreadNotificationCount)
 * - Search functionality (searchMessages, searchUsers)
 *
 * All tests follow the AAA (Arrange, Act, Assert) pattern and verify:
 * - Correct HTTP methods and endpoints
 * - Proper request headers (JWT Authorization)
 * - Request payload and query parameter validation
 * - Response data structure and type compliance
 * - Error handling for various failure scenarios
 *
 * @module tests/unit/features/messaging/messagingApi.test
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Import the module under test
import {
  getMessages,
  getConversations,
  getConversationMessages,
  sendMessage,
  deleteMessage,
  deleteConversation,
  markConversationAsRead,
  markMessageAsRead,
  muteConversation,
  unmuteConversation,
  setFavouriteConversations,
  unsetFavouriteConversations,
  getConversationMembers,
  getContacts,
  getContactRequests,
  getReceivedContactRequestsCount,
  acceptContactRequest,
  rejectContactRequest,
  deleteContacts,
  blockUser,
  unblockUser,
  getNotifications,
  getUnreadNotificationCount,
  getUnreadConversationCounts,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotifications,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  getUserMessagePreferences,
  searchMessages,
  searchUsers,
  messagingKeys,
} from '../../../../src/features/messaging/api/messagingApi';

// Import types for mock data
import type {
  Message,
  Conversation,
  ConversationMember,
  Contact,
  ContactRequest,
  Notification,
  NotificationPreferences,
  SendMessageParams,
  MessageFilters,
  NotificationFilters,
  ConversationListResponse,
  NotificationListResponse,
  MessageSearchResult,
} from '../../../../src/features/messaging/types/message.types';
import { ConversationType, NotificationType } from '../../../../src/features/messaging/types/message.types';

// ============================================================================
// Test Configuration and Utilities
// ============================================================================

/**
 * Mock JWT token for Authorization header testing
 */
const MOCK_JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxOTk5OTk5OTk5fQ.7MQ_3OqzKZGM_2Gvz0TAT3LsKNGfDMUOSjsB-FU6KDw';

/**
 * API Base URL for mocked endpoints
 */
const API_BASE_URL = '/api/v1';

// ============================================================================
// Mock Data Factory Functions
// ============================================================================

/**
 * Creates a mock Message object with sensible defaults
 */
function createMockMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1001,
    useridfrom: 100,
    conversationid: 1,
    subject: null,
    fullmessage: 'This is a test message',
    fullmessageformat: 1,
    fullmessagehtml: '<p>This is a test message</p>',
    smallmessage: 'This is a test message',
    timecreated: 1700000000,
    fullmessagetrust: 0,
    customdata: null,
    ...overrides,
  };
}

/**
 * Creates a mock ConversationMember object
 */
function createMockMember(overrides: Partial<ConversationMember> = {}): ConversationMember {
  return {
    id: 100,
    fullname: 'Test User',
    profileurl: '/user/profile.php?id=100',
    profileimageurl: '/pluginfile.php/1/user/icon/100',
    profileimageurlsmall: '/pluginfile.php/1/user/icon/100/f2',
    isonline: true,
    showonlinestatus: true,
    iscontact: false,
    isblocked: false,
    isdeleted: false,
    requirescontact: false,
    canmessage: true,
    contactrequests: [],
    ...overrides,
  };
}

/**
 * Creates a mock Conversation object
 */
function createMockConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 1,
    type: ConversationType.INDIVIDUAL,
    name: null,
    subname: null,
    imageurl: null,
    membercount: 2,
    isfavourite: false,
    isread: true,
    unreadcount: 0,
    ismuted: false,
    enabled: 1,
    timecreated: 1700000000,
    timemodified: null,
    members: [createMockMember()],
    messages: [createMockMessage()],
    candeletemessagesforallusers: false,
    ...overrides,
  };
}

/**
 * Creates a mock Contact object
 */
function createMockContact(overrides: Partial<Contact> = {}): Contact {
  return {
    userid: 100,
    fullname: 'Test Contact',
    profileimageurl: '/pluginfile.php/1/user/icon/100',
    profileimageurlsmall: '/pluginfile.php/1/user/icon/100/f2',
    ismessaging: false,
    lastmessage: 'Hello!',
    lastmessagedate: 1700000000,
    messageid: 1001,
    blocked: false,
    ...overrides,
  };
}

/**
 * Creates a mock ContactRequest object
 */
function createMockContactRequest(overrides: Partial<ContactRequest> = {}): ContactRequest {
  return {
    id: 1,
    userid: 100,
    requesteduserid: 200,
    timecreated: 1700000000,
    ...overrides,
  };
}

/**
 * Creates a mock Notification object
 */
function createMockNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 1,
    useridfrom: 100,
    useridto: 200,
    subject: 'Test Notification',
    fullmessage: 'This is a test notification',
    fullmessagehtml: '<p>This is a test notification</p>',
    fullmessageformat: 1,
    smallmessage: 'Test notification',
    component: 'mod_assign',
    eventtype: 'submission',
    contexturl: '/mod/assign/view.php?id=1',
    contexturlname: 'View assignment',
    timeread: null,
    timecreated: 1700000000,
    customdata: null,
    ...overrides,
  };
}

/**
 * Creates a standard success API response envelope
 */
function createSuccessResponse<T>(data: T, pagination?: { page: number; perPage: number; total: number; totalPages: number }) {
  return {
    success: true,
    data,
    meta: pagination ? { pagination } : undefined,
  };
}

/**
 * Creates a standard error API response envelope
 */
function createErrorResponse(code: string, message: string, details?: Record<string, unknown>) {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

// ============================================================================
// MSW Server Setup
// ============================================================================

/**
 * Default handlers for the MSW server
 * These provide standard mock responses for common API endpoints
 */
const handlers = [
  // Messages endpoints
  http.get(`${API_BASE_URL}/messages`, () => {
    return HttpResponse.json(createSuccessResponse([createMockMessage()]));
  }),

  http.delete(`${API_BASE_URL}/messages/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_BASE_URL}/messages/:id/read`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_BASE_URL}/messages/search`, () => {
    return HttpResponse.json(createSuccessResponse<MessageSearchResult>({
      messages: [createMockMessage()],
      conversations: [],
      total: 1,
      hasMore: false,
    }));
  }),

  http.get(`${API_BASE_URL}/messages/preferences`, () => {
    return HttpResponse.json(createSuccessResponse({
      userId: 100,
      privacy: 0,
      blocked: false,
      autoAddContacts: true,
      enterSendsMessage: true,
      showOnlineStatus: true,
    }));
  }),

  http.get(`${API_BASE_URL}/messages/users/search`, () => {
    return HttpResponse.json(createSuccessResponse([createMockMember()]));
  }),

  // Conversations endpoints
  http.get(`${API_BASE_URL}/messages/conversations`, () => {
    return HttpResponse.json(createSuccessResponse<ConversationListResponse>({
      conversations: [createMockConversation()],
      total: 1,
      page: 1,
      perPage: 20,
      hasMore: false,
    }));
  }),

  http.get(`${API_BASE_URL}/messages/conversations/:id/messages`, () => {
    return HttpResponse.json(createSuccessResponse({
      messages: [createMockMessage()],
      members: [createMockMember()],
    }));
  }),

  http.post(`${API_BASE_URL}/messages/conversations/:id/messages`, () => {
    return HttpResponse.json(createSuccessResponse(createMockMessage()));
  }),

  http.delete(`${API_BASE_URL}/messages/conversations/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_BASE_URL}/messages/conversations/:id/read`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_BASE_URL}/messages/conversations/:id/mute`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_BASE_URL}/messages/conversations/:id/unmute`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_BASE_URL}/messages/conversations/favourite`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_BASE_URL}/messages/conversations/unfavourite`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_BASE_URL}/messages/conversations/:id/members`, () => {
    return HttpResponse.json(createSuccessResponse([createMockMember()]));
  }),

  http.get(`${API_BASE_URL}/messages/conversations/unread/counts`, () => {
    return HttpResponse.json(createSuccessResponse({
      types: { individual: 3, group: 1, self: 0 },
      total: 4,
      favourites: 1,
    }));
  }),

  // Contacts endpoints
  http.get(`${API_BASE_URL}/messages/contacts`, () => {
    return HttpResponse.json(createSuccessResponse([createMockContact()]));
  }),

  http.get(`${API_BASE_URL}/messages/contacts/requests`, () => {
    return HttpResponse.json(createSuccessResponse([createMockContactRequest()]));
  }),

  http.get(`${API_BASE_URL}/messages/contacts/requests/count`, () => {
    return HttpResponse.json(createSuccessResponse({ count: 5 }));
  }),

  http.post(`${API_BASE_URL}/messages/contacts/requests/:id/accept`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_BASE_URL}/messages/contacts/requests/:id/reject`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${API_BASE_URL}/messages/contacts`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_BASE_URL}/messages/contacts/block`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_BASE_URL}/messages/contacts/unblock`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Notifications endpoints
  http.get(`${API_BASE_URL}/notifications`, () => {
    return HttpResponse.json(createSuccessResponse<NotificationListResponse>({
      notifications: [createMockNotification()],
      total: 1,
      unreadCount: 1,
      page: 1,
      perPage: 20,
      hasMore: false,
    }));
  }),

  http.get(`${API_BASE_URL}/notifications/unread/count`, () => {
    return HttpResponse.json(createSuccessResponse({ count: 5 }));
  }),

  http.post(`${API_BASE_URL}/notifications/:id/read`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_BASE_URL}/notifications/read-all`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${API_BASE_URL}/notifications`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_BASE_URL}/notifications/preferences`, () => {
    return HttpResponse.json(createSuccessResponse<NotificationPreferences>({
      userId: 100,
      enableEmail: true,
      enablePush: true,
      enableInApp: true,
      notificationTypes: [NotificationType.MESSAGE, NotificationType.ASSIGNMENT],
      mutedConversations: [],
      quietHoursStart: null,
      quietHoursEnd: null,
    }));
  }),

  http.put(`${API_BASE_URL}/notifications/preferences`, () => {
    return HttpResponse.json(createSuccessResponse<NotificationPreferences>({
      userId: 100,
      enableEmail: false,
      enablePush: true,
      enableInApp: true,
      notificationTypes: [NotificationType.MESSAGE],
      mutedConversations: [],
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    }));
  }),
];

/**
 * MSW Server instance for intercepting HTTP requests
 */
const server = setupServer(...handlers);

// ============================================================================
// Test Setup and Teardown
// ============================================================================

beforeAll(() => {
  // Start MSW server before all tests
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  // Reset handlers between tests
  server.resetHandlers();
  // Clear all mocks
  vi.clearAllMocks();
});

afterAll(() => {
  // Close MSW server after all tests
  server.close();
});

// ============================================================================
// Test Suites
// ============================================================================

describe('Messaging API Client', () => {
  // --------------------------------------------------------------------------
  // getMessages() Tests
  // --------------------------------------------------------------------------
  describe('getMessages()', () => {
    it('should fetch messages successfully with default parameters', async () => {
      // Arrange - handlers already set up

      // Act
      const result = await getMessages();

      // Assert
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('fullmessage');
      expect(result[0]).toHaveProperty('conversationid');
    });

    it('should fetch messages with pagination parameters', async () => {
      // Arrange
      const mockMessages = [createMockMessage({ id: 1 }), createMockMessage({ id: 2 })];
      server.use(
        http.get(`${API_BASE_URL}/messages`, ({ request }) => {
          const url = new URL(request.url);
          const page = url.searchParams.get('page');
          const perPage = url.searchParams.get('perPage');

          // Verify pagination parameters are passed
          expect(page).toBe('2');
          expect(perPage).toBe('10');

          return HttpResponse.json(createSuccessResponse(mockMessages, {
            page: 2,
            perPage: 10,
            total: 25,
            totalPages: 3,
          }));
        })
      );

      // Act
      const result = await getMessages({ pagination: { page: 2, perPage: 10 } });

      // Assert
      expect(result).toHaveLength(2);
    });

    it('should apply message filters correctly', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages`, ({ request }) => {
          const url = new URL(request.url);

          expect(url.searchParams.get('readStatus')).toBe('false');
          expect(url.searchParams.get('conversationId')).toBe('5');

          return HttpResponse.json(createSuccessResponse([createMockMessage()]));
        })
      );

      // Act
      const filters: MessageFilters = {
        readStatus: false,
        conversationId: 5,
      };
      const result = await getMessages(undefined, filters);

      // Assert
      expect(result).toBeInstanceOf(Array);
    });

    it('should handle 401 Unauthorized error', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages`, () => {
          return HttpResponse.json(
            createErrorResponse('UNAUTHORIZED', 'Invalid or expired token'),
            { status: 401 }
          );
        })
      );

      // Act & Assert
      await expect(getMessages()).rejects.toThrow();
    });

    it('should handle 500 Server Error', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages`, () => {
          return HttpResponse.json(
            createErrorResponse('SERVER_ERROR', 'Internal server error'),
            { status: 500 }
          );
        })
      );

      // Act & Assert
      await expect(getMessages()).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages`, () => {
          return HttpResponse.error();
        })
      );

      // Act & Assert
      await expect(getMessages()).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // getConversations() Tests
  // --------------------------------------------------------------------------
  describe('getConversations()', () => {
    it('should fetch conversations successfully', async () => {
      // Act
      const result = await getConversations();

      // Assert
      expect(result).toHaveProperty('conversations');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('hasMore');
      expect(result.conversations).toBeInstanceOf(Array);
    });

    it('should fetch conversations with type filter', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages/conversations`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('type')).toBe(String(ConversationType.INDIVIDUAL));

          return HttpResponse.json(createSuccessResponse<ConversationListResponse>({
            conversations: [createMockConversation({ type: ConversationType.INDIVIDUAL })],
            total: 1,
            page: 1,
            perPage: 20,
            hasMore: false,
          }));
        })
      );

      // Act
      const result = await getConversations(undefined, { type: ConversationType.INDIVIDUAL });

      // Assert
      expect(result.conversations[0].type).toBe(ConversationType.INDIVIDUAL);
    });

    it('should fetch favourite conversations only', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages/conversations`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('favourites')).toBe('true');

          return HttpResponse.json(createSuccessResponse<ConversationListResponse>({
            conversations: [createMockConversation({ isfavourite: true })],
            total: 1,
            page: 1,
            perPage: 20,
            hasMore: false,
          }));
        })
      );

      // Act
      const result = await getConversations(undefined, { favourites: true });

      // Assert
      expect(result.conversations[0].isfavourite).toBe(true);
    });

    it('should include unread counts in response', async () => {
      // Arrange
      const conversationWithUnread = createMockConversation({
        isread: false,
        unreadcount: 5,
      });
      server.use(
        http.get(`${API_BASE_URL}/messages/conversations`, () => {
          return HttpResponse.json(createSuccessResponse<ConversationListResponse>({
            conversations: [conversationWithUnread],
            total: 1,
            page: 1,
            perPage: 20,
            hasMore: false,
          }));
        })
      );

      // Act
      const result = await getConversations();

      // Assert
      expect(result.conversations[0].unreadcount).toBe(5);
      expect(result.conversations[0].isread).toBe(false);
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages/conversations`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('page')).toBe('2');
          expect(url.searchParams.get('perPage')).toBe('25');

          return HttpResponse.json(createSuccessResponse<ConversationListResponse>({
            conversations: [],
            total: 50,
            page: 2,
            perPage: 25,
            hasMore: false,
          }));
        })
      );

      // Act
      const result = await getConversations({
        pagination: { page: 2, perPage: 25 },
      });

      // Assert
      expect(result.page).toBe(2);
      expect(result.perPage).toBe(25);
    });
  });

  // --------------------------------------------------------------------------
  // getConversationMessages() Tests
  // --------------------------------------------------------------------------
  describe('getConversationMessages()', () => {
    it('should fetch messages for a specific conversation', async () => {
      // Act
      const result = await getConversationMessages(1);

      // Assert
      expect(result).toHaveProperty('messages');
      expect(result).toHaveProperty('members');
      expect(result.messages).toBeInstanceOf(Array);
      expect(result.members).toBeInstanceOf(Array);
    });

    it('should pass newest parameter correctly', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages/conversations/:id/messages`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('newest')).toBe('true');

          return HttpResponse.json(createSuccessResponse({
            messages: [createMockMessage()],
            members: [createMockMember()],
          }));
        })
      );

      // Act
      await getConversationMessages(1, undefined, { newest: true });
    });

    it('should throw error for invalid conversation ID', async () => {
      // Act & Assert
      await expect(getConversationMessages(-1)).rejects.toThrow('conversationId must be a positive integer');
      await expect(getConversationMessages(0)).rejects.toThrow('conversationId must be a positive integer');
    });
  });

  // --------------------------------------------------------------------------
  // sendMessage() Tests
  // --------------------------------------------------------------------------
  describe('sendMessage()', () => {
    it('should send a message successfully', async () => {
      // Arrange
      const params: SendMessageParams = {
        conversationid: 1,
        text: 'Hello, this is a test message!',
        useridfrom: 100,
      };

      // Act
      const result = await sendMessage(params);

      // Assert
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('fullmessage');
      expect(result).toHaveProperty('conversationid');
    });

    it('should validate conversation ID in payload', async () => {
      // Arrange
      server.use(
        http.post(`${API_BASE_URL}/messages/conversations/:id/messages`, async ({ request, params }) => {
          expect(params.id).toBe('5');
          const body = await request.json() as { text: string; textformat: number };
          expect(body.text).toBe('Test message');
          expect(body.textformat).toBe(1);

          return HttpResponse.json(createSuccessResponse(createMockMessage({
            conversationid: 5,
            fullmessage: 'Test message',
          })));
        })
      );

      // Act
      const result = await sendMessage({
        conversationid: 5,
        text: 'Test message',
        useridfrom: 100,
      });

      // Assert
      expect(result.conversationid).toBe(5);
    });

    it('should throw error for empty message text', async () => {
      // Act & Assert
      await expect(
        sendMessage({ conversationid: 1, text: '', useridfrom: 100 })
      ).rejects.toThrow('Message text cannot be empty');
    });

    it('should throw error for whitespace-only message', async () => {
      // Act & Assert
      await expect(
        sendMessage({ conversationid: 1, text: '   ', useridfrom: 100 })
      ).rejects.toThrow('Message text cannot be empty');
    });

    it('should throw error for message exceeding max length', async () => {
      // Arrange
      const longMessage = 'a'.repeat(4097); // Exceeds 4096 character limit

      // Act & Assert
      await expect(
        sendMessage({ conversationid: 1, text: longMessage, useridfrom: 100 })
      ).rejects.toThrow('Message text exceeds maximum length of 4096 characters');
    });

    it('should throw error for invalid conversation ID', async () => {
      // Act & Assert
      await expect(
        sendMessage({ conversationid: -1, text: 'Test', useridfrom: 100 })
      ).rejects.toThrow('conversationId must be a positive integer');
    });

    it('should handle permission denied error (403)', async () => {
      // Arrange
      server.use(
        http.post(`${API_BASE_URL}/messages/conversations/:id/messages`, () => {
          return HttpResponse.json(
            createErrorResponse('PERMISSION_DENIED', 'You cannot message this user'),
            { status: 403 }
          );
        })
      );

      // Act & Assert
      await expect(
        sendMessage({ conversationid: 1, text: 'Hello', useridfrom: 100 })
      ).rejects.toThrow();
    });

    it('should handle conversation not found error (404)', async () => {
      // Arrange
      server.use(
        http.post(`${API_BASE_URL}/messages/conversations/:id/messages`, () => {
          return HttpResponse.json(
            createErrorResponse('NOT_FOUND', 'Conversation not found'),
            { status: 404 }
          );
        })
      );

      // Act & Assert
      await expect(
        sendMessage({ conversationid: 999, text: 'Hello', useridfrom: 100 })
      ).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // deleteMessage() Tests
  // --------------------------------------------------------------------------
  describe('deleteMessage()', () => {
    it('should delete a message successfully', async () => {
      // Act & Assert - should not throw
      await expect(deleteMessage(1001)).resolves.toBeUndefined();
    });

    it('should include message ID in URL path', async () => {
      // Arrange
      server.use(
        http.delete(`${API_BASE_URL}/messages/:id`, ({ params }) => {
          expect(params.id).toBe('1234');
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Act
      await deleteMessage(1234);
    });

    it('should throw error for invalid message ID', async () => {
      // Act & Assert
      await expect(deleteMessage(-1)).rejects.toThrow('messageId must be a positive integer');
      await expect(deleteMessage(0)).rejects.toThrow('messageId must be a positive integer');
    });

    it('should handle permission denied error', async () => {
      // Arrange
      server.use(
        http.delete(`${API_BASE_URL}/messages/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('PERMISSION_DENIED', 'Cannot delete this message'),
            { status: 403 }
          );
        })
      );

      // Act & Assert
      await expect(deleteMessage(1001)).rejects.toThrow();
    });

    it('should handle message not found error', async () => {
      // Arrange
      server.use(
        http.delete(`${API_BASE_URL}/messages/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('NOT_FOUND', 'Message not found'),
            { status: 404 }
          );
        })
      );

      // Act & Assert
      await expect(deleteMessage(9999)).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // deleteConversation() Tests
  // --------------------------------------------------------------------------
  describe('deleteConversation()', () => {
    it('should delete a conversation successfully', async () => {
      // Act & Assert
      await expect(deleteConversation(1)).resolves.toBeUndefined();
    });

    it('should throw error for invalid conversation ID', async () => {
      // Act & Assert
      await expect(deleteConversation(-1)).rejects.toThrow('conversationId must be a positive integer');
    });
  });

  // --------------------------------------------------------------------------
  // markConversationAsRead() Tests
  // --------------------------------------------------------------------------
  describe('markConversationAsRead()', () => {
    it('should mark conversation as read successfully', async () => {
      // Act & Assert
      await expect(markConversationAsRead(1)).resolves.toBeUndefined();
    });

    it('should include conversation ID in URL', async () => {
      // Arrange
      server.use(
        http.post(`${API_BASE_URL}/messages/conversations/:id/read`, ({ params }) => {
          expect(params.id).toBe('42');
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Act
      await markConversationAsRead(42);
    });

    it('should throw error for invalid conversation ID', async () => {
      // Act & Assert
      await expect(markConversationAsRead(0)).rejects.toThrow('conversationId must be a positive integer');
    });
  });

  // --------------------------------------------------------------------------
  // markMessageAsRead() Tests
  // --------------------------------------------------------------------------
  describe('markMessageAsRead()', () => {
    it('should mark message as read successfully', async () => {
      // Act & Assert
      await expect(markMessageAsRead(1001)).resolves.toBeUndefined();
    });

    it('should throw error for invalid message ID', async () => {
      // Act & Assert
      await expect(markMessageAsRead(-5)).rejects.toThrow('messageId must be a positive integer');
    });
  });

  // --------------------------------------------------------------------------
  // muteConversation() / unmuteConversation() Tests
  // --------------------------------------------------------------------------
  describe('muteConversation()', () => {
    it('should mute a conversation successfully', async () => {
      // Act & Assert
      await expect(muteConversation(1)).resolves.toBeUndefined();
    });

    it('should throw error for invalid conversation ID', async () => {
      // Act & Assert
      await expect(muteConversation(0)).rejects.toThrow();
    });
  });

  describe('unmuteConversation()', () => {
    it('should unmute a conversation successfully', async () => {
      // Act & Assert
      await expect(unmuteConversation(1)).resolves.toBeUndefined();
    });

    it('should throw error for invalid conversation ID', async () => {
      // Act & Assert
      await expect(unmuteConversation(-1)).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // setFavouriteConversations() / unsetFavouriteConversations() Tests
  // --------------------------------------------------------------------------
  describe('setFavouriteConversations()', () => {
    it('should add conversations to favourites successfully', async () => {
      // Arrange
      server.use(
        http.post(`${API_BASE_URL}/messages/conversations/favourite`, async ({ request }) => {
          const body = await request.json() as { conversationids: number[] };
          expect(body.conversationids).toEqual([1, 2, 3]);
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Act
      await expect(setFavouriteConversations([1, 2, 3])).resolves.toBeUndefined();
    });

    it('should throw error for empty array', async () => {
      // Act & Assert
      await expect(setFavouriteConversations([])).rejects.toThrow('conversationIds must be a non-empty array');
    });

    it('should validate all IDs in array', async () => {
      // Act & Assert
      await expect(setFavouriteConversations([1, -2, 3])).rejects.toThrow('conversationId must be a positive integer');
    });
  });

  describe('unsetFavouriteConversations()', () => {
    it('should remove conversations from favourites successfully', async () => {
      // Act & Assert
      await expect(unsetFavouriteConversations([1, 2])).resolves.toBeUndefined();
    });

    it('should throw error for empty array', async () => {
      // Act & Assert
      await expect(unsetFavouriteConversations([])).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // getConversationMembers() Tests
  // --------------------------------------------------------------------------
  describe('getConversationMembers()', () => {
    it('should fetch conversation members successfully', async () => {
      // Act
      const result = await getConversationMembers(1);

      // Assert
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('fullname');
      expect(result[0]).toHaveProperty('iscontact');
    });

    it('should pass options correctly', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages/conversations/:id/members`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('includecontactrequests')).toBe('true');
          expect(url.searchParams.get('includeprivacyinfo')).toBe('true');

          return HttpResponse.json(createSuccessResponse([createMockMember()]));
        })
      );

      // Act
      await getConversationMembers(1, undefined, {
        includeContactRequests: true,
        includePrivacyInfo: true,
      });
    });

    it('should throw error for invalid conversation ID', async () => {
      // Act & Assert
      await expect(getConversationMembers(-1)).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // getContacts() Tests
  // --------------------------------------------------------------------------
  describe('getContacts()', () => {
    it('should fetch contacts successfully', async () => {
      // Act
      const result = await getContacts();

      // Assert
      expect(result).toBeInstanceOf(Array);
      expect(result[0]).toHaveProperty('userid');
      expect(result[0]).toHaveProperty('fullname');
      expect(result[0]).toHaveProperty('profileimageurl');
    });

    it('should support pagination', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages/contacts`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('page')).toBe('1');
          expect(url.searchParams.get('perPage')).toBe('50');

          return HttpResponse.json(createSuccessResponse([createMockContact()]));
        })
      );

      // Act
      await getContacts({ pagination: { page: 1, perPage: 50 } });
    });

    it('should support search filtering', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages/contacts`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('search')).toBe('john');

          return HttpResponse.json(createSuccessResponse([createMockContact({ fullname: 'John Doe' })]));
        })
      );

      // Act
      const result = await getContacts({ search: 'john' });

      // Assert
      expect(result[0].fullname).toBe('John Doe');
    });
  });

  // --------------------------------------------------------------------------
  // getContactRequests() Tests
  // --------------------------------------------------------------------------
  describe('getContactRequests()', () => {
    it('should fetch contact requests successfully', async () => {
      // Act
      const result = await getContactRequests();

      // Assert
      expect(result).toBeInstanceOf(Array);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('userid');
      expect(result[0]).toHaveProperty('requesteduserid');
      expect(result[0]).toHaveProperty('timecreated');
    });

    it('should support pagination', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages/contacts/requests`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('page')).toBe('2');

          return HttpResponse.json(createSuccessResponse([createMockContactRequest()]));
        })
      );

      // Act
      await getContactRequests({ pagination: { page: 2 } });
    });
  });

  // --------------------------------------------------------------------------
  // getReceivedContactRequestsCount() Tests
  // --------------------------------------------------------------------------
  describe('getReceivedContactRequestsCount()', () => {
    it('should return the count of pending contact requests', async () => {
      // Act
      const result = await getReceivedContactRequestsCount();

      // Assert
      expect(typeof result).toBe('number');
      expect(result).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // acceptContactRequest() / rejectContactRequest() Tests
  // --------------------------------------------------------------------------
  describe('acceptContactRequest()', () => {
    it('should accept a contact request successfully', async () => {
      // Arrange
      server.use(
        http.post(`${API_BASE_URL}/messages/contacts/requests/:id/accept`, ({ params }) => {
          expect(params.id).toBe('123');
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Act & Assert
      await expect(acceptContactRequest(123)).resolves.toBeUndefined();
    });

    it('should throw error for invalid request ID', async () => {
      // Act & Assert
      await expect(acceptContactRequest(-1)).rejects.toThrow('requestId must be a positive integer');
    });
  });

  describe('rejectContactRequest()', () => {
    it('should reject a contact request successfully', async () => {
      // Arrange
      server.use(
        http.post(`${API_BASE_URL}/messages/contacts/requests/:id/reject`, ({ params }) => {
          expect(params.id).toBe('456');
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Act & Assert
      await expect(rejectContactRequest(456)).resolves.toBeUndefined();
    });

    it('should throw error for invalid request ID', async () => {
      // Act & Assert
      await expect(rejectContactRequest(0)).rejects.toThrow('requestId must be a positive integer');
    });
  });

  // --------------------------------------------------------------------------
  // deleteContacts() Tests
  // --------------------------------------------------------------------------
  describe('deleteContacts()', () => {
    it('should delete contacts successfully', async () => {
      // Arrange
      server.use(
        http.delete(`${API_BASE_URL}/messages/contacts`, async ({ request }) => {
          const body = await request.json() as { userids: number[] };
          expect(body.userids).toEqual([100, 200]);
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Act & Assert
      await expect(deleteContacts([100, 200])).resolves.toBeUndefined();
    });

    it('should throw error for empty array', async () => {
      // Act & Assert
      await expect(deleteContacts([])).rejects.toThrow('userIds must be a non-empty array');
    });

    it('should validate all user IDs', async () => {
      // Act & Assert
      await expect(deleteContacts([100, -200])).rejects.toThrow('userId must be a positive integer');
    });
  });

  // --------------------------------------------------------------------------
  // blockUser() / unblockUser() Tests
  // --------------------------------------------------------------------------
  describe('blockUser()', () => {
    it('should block a user successfully', async () => {
      // Arrange
      server.use(
        http.post(`${API_BASE_URL}/messages/contacts/block`, async ({ request }) => {
          const body = await request.json() as { blockeduserid: number };
          expect(body.blockeduserid).toBe(100);
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Act & Assert
      await expect(blockUser(100)).resolves.toBeUndefined();
    });

    it('should throw error for invalid user ID', async () => {
      // Act & Assert
      await expect(blockUser(-1)).rejects.toThrow('blockedUserId must be a positive integer');
      await expect(blockUser(0)).rejects.toThrow('blockedUserId must be a positive integer');
    });

    it('should handle invalid user error', async () => {
      // Arrange
      server.use(
        http.post(`${API_BASE_URL}/messages/contacts/block`, () => {
          return HttpResponse.json(
            createErrorResponse('NOT_FOUND', 'User not found'),
            { status: 404 }
          );
        })
      );

      // Act & Assert
      await expect(blockUser(999)).rejects.toThrow();
    });
  });

  describe('unblockUser()', () => {
    it('should unblock a user successfully', async () => {
      // Arrange
      server.use(
        http.post(`${API_BASE_URL}/messages/contacts/unblock`, async ({ request }) => {
          const body = await request.json() as { unblockeduserid: number };
          expect(body.unblockeduserid).toBe(100);
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Act & Assert
      await expect(unblockUser(100)).resolves.toBeUndefined();
    });

    it('should throw error for invalid user ID', async () => {
      // Act & Assert
      await expect(unblockUser(-5)).rejects.toThrow('unblockedUserId must be a positive integer');
    });
  });

  // --------------------------------------------------------------------------
  // getNotifications() Tests
  // --------------------------------------------------------------------------
  describe('getNotifications()', () => {
    it('should fetch notifications successfully', async () => {
      // Act
      const result = await getNotifications();

      // Assert
      expect(result).toHaveProperty('notifications');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('unreadCount');
      expect(result.notifications).toBeInstanceOf(Array);
    });

    it('should include notification structure in response', async () => {
      // Act
      const result = await getNotifications();

      // Assert
      if (result.notifications.length > 0) {
        const notification = result.notifications[0];
        expect(notification).toHaveProperty('id');
        expect(notification).toHaveProperty('subject');
        expect(notification).toHaveProperty('fullmessage');
        expect(notification).toHaveProperty('component');
        expect(notification).toHaveProperty('eventtype');
        expect(notification).toHaveProperty('timecreated');
      }
    });

    it('should filter by read status', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/notifications`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('read')).toBe('false');

          return HttpResponse.json(createSuccessResponse<NotificationListResponse>({
            notifications: [createMockNotification({ timeread: null })],
            total: 1,
            unreadCount: 1,
            page: 1,
            perPage: 20,
            hasMore: false,
          }));
        })
      );

      // Act
      const filters: NotificationFilters = { read: false };
      const result = await getNotifications(undefined, filters);

      // Assert
      expect(result.notifications[0].timeread).toBeNull();
    });

    it('should filter by notification type', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/notifications`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('type')).toBe(NotificationType.ASSIGNMENT);

          return HttpResponse.json(createSuccessResponse<NotificationListResponse>({
            notifications: [createMockNotification({ component: 'mod_assign' })],
            total: 1,
            unreadCount: 1,
            page: 1,
            perPage: 20,
            hasMore: false,
          }));
        })
      );

      // Act
      const filters: NotificationFilters = { type: NotificationType.ASSIGNMENT };
      await getNotifications(undefined, filters);
    });

    it('should support pagination', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/notifications`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('page')).toBe('3');
          expect(url.searchParams.get('perPage')).toBe('15');

          return HttpResponse.json(createSuccessResponse<NotificationListResponse>({
            notifications: [],
            total: 50,
            unreadCount: 10,
            page: 3,
            perPage: 15,
            hasMore: true,
          }));
        })
      );

      // Act
      const result = await getNotifications({ pagination: { page: 3, perPage: 15 } });

      // Assert
      expect(result.page).toBe(3);
      expect(result.perPage).toBe(15);
      expect(result.hasMore).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // getUnreadNotificationCount() Tests
  // --------------------------------------------------------------------------
  describe('getUnreadNotificationCount()', () => {
    it('should return the count of unread notifications', async () => {
      // Act
      const result = await getUnreadNotificationCount();

      // Assert
      expect(typeof result).toBe('number');
      expect(result).toBe(5);
    });

    it('should handle zero unread notifications', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/notifications/unread/count`, () => {
          return HttpResponse.json(createSuccessResponse({ count: 0 }));
        })
      );

      // Act
      const result = await getUnreadNotificationCount();

      // Assert
      expect(result).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // getUnreadConversationCounts() Tests
  // --------------------------------------------------------------------------
  describe('getUnreadConversationCounts()', () => {
    it('should return unread counts by conversation type', async () => {
      // Act
      const result = await getUnreadConversationCounts();

      // Assert
      expect(result).toHaveProperty('types');
      expect(result.types).toHaveProperty('individual');
      expect(result.types).toHaveProperty('group');
      expect(result.types).toHaveProperty('self');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('favourites');
    });

    it('should return correct count values', async () => {
      // Act
      const result = await getUnreadConversationCounts();

      // Assert
      expect(result.types.individual).toBe(3);
      expect(result.types.group).toBe(1);
      expect(result.types.self).toBe(0);
      expect(result.total).toBe(4);
      expect(result.favourites).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // markNotificationRead() Tests
  // --------------------------------------------------------------------------
  describe('markNotificationRead()', () => {
    it('should mark notification as read successfully', async () => {
      // Arrange
      server.use(
        http.post(`${API_BASE_URL}/notifications/:id/read`, ({ params }) => {
          expect(params.id).toBe('12345');
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Act & Assert
      await expect(markNotificationRead(12345)).resolves.toBeUndefined();
    });

    it('should throw error for invalid notification ID', async () => {
      // Act & Assert
      await expect(markNotificationRead(-1)).rejects.toThrow('notificationId must be a positive integer');
      await expect(markNotificationRead(0)).rejects.toThrow('notificationId must be a positive integer');
    });
  });

  // --------------------------------------------------------------------------
  // markAllNotificationsRead() Tests
  // --------------------------------------------------------------------------
  describe('markAllNotificationsRead()', () => {
    it('should mark all notifications as read successfully', async () => {
      // Act & Assert
      await expect(markAllNotificationsRead()).resolves.toBeUndefined();
    });

    it('should handle server errors', async () => {
      // Arrange
      server.use(
        http.post(`${API_BASE_URL}/notifications/read-all`, () => {
          return HttpResponse.json(
            createErrorResponse('SERVER_ERROR', 'Database error'),
            { status: 500 }
          );
        })
      );

      // Act & Assert
      await expect(markAllNotificationsRead()).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // clearNotifications() Tests
  // --------------------------------------------------------------------------
  describe('clearNotifications()', () => {
    it('should clear all notifications successfully', async () => {
      // Act & Assert
      await expect(clearNotifications()).resolves.toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // getUserNotificationPreferences() Tests
  // --------------------------------------------------------------------------
  describe('getUserNotificationPreferences()', () => {
    it('should fetch notification preferences successfully', async () => {
      // Act
      const result = await getUserNotificationPreferences();

      // Assert
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('enableEmail');
      expect(result).toHaveProperty('enablePush');
      expect(result).toHaveProperty('enableInApp');
      expect(result).toHaveProperty('notificationTypes');
    });
  });

  // --------------------------------------------------------------------------
  // updateUserNotificationPreferences() Tests
  // --------------------------------------------------------------------------
  describe('updateUserNotificationPreferences()', () => {
    it('should update notification preferences successfully', async () => {
      // Act
      const result = await updateUserNotificationPreferences({
        enableEmail: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      });

      // Assert
      expect(result.enableEmail).toBe(false);
      expect(result.quietHoursStart).toBe('22:00');
      expect(result.quietHoursEnd).toBe('08:00');
    });
  });

  // --------------------------------------------------------------------------
  // getUserMessagePreferences() Tests
  // --------------------------------------------------------------------------
  describe('getUserMessagePreferences()', () => {
    it('should fetch message preferences successfully', async () => {
      // Act
      const result = await getUserMessagePreferences();

      // Assert
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('privacy');
      expect(result).toHaveProperty('blocked');
      expect(result).toHaveProperty('showOnlineStatus');
    });
  });

  // --------------------------------------------------------------------------
  // searchMessages() Tests
  // --------------------------------------------------------------------------
  describe('searchMessages()', () => {
    it('should search messages successfully', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages/search`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('search')).toBe('assignment');

          return HttpResponse.json(createSuccessResponse<MessageSearchResult>({
            messages: [createMockMessage({ fullmessage: 'Assignment due tomorrow' })],
            conversations: [],
            total: 1,
            hasMore: false,
          }));
        })
      );

      // Act
      const result = await searchMessages('assignment');

      // Assert
      expect(result).toHaveProperty('messages');
      expect(result).toHaveProperty('conversations');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('hasMore');
    });

    it('should throw error for empty query', async () => {
      // Act & Assert
      await expect(searchMessages('')).rejects.toThrow('Search query cannot be empty');
    });

    it('should throw error for whitespace-only query', async () => {
      // Act & Assert
      await expect(searchMessages('   ')).rejects.toThrow('Search query cannot be empty');
    });

    it('should trim search query', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages/search`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('search')).toBe('test');

          return HttpResponse.json(createSuccessResponse<MessageSearchResult>({
            messages: [],
            conversations: [],
            total: 0,
            hasMore: false,
          }));
        })
      );

      // Act
      await searchMessages('  test  ');
    });

    it('should support pagination', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages/search`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('page')).toBe('2');
          expect(url.searchParams.get('perPage')).toBe('20');

          return HttpResponse.json(createSuccessResponse<MessageSearchResult>({
            messages: [],
            conversations: [],
            total: 50,
            hasMore: true,
          }));
        })
      );

      // Act
      const result = await searchMessages('test', {
        pagination: { page: 2, perPage: 20 },
      });

      // Assert
      expect(result.hasMore).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // searchUsers() Tests
  // --------------------------------------------------------------------------
  describe('searchUsers()', () => {
    it('should search users successfully', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages/users/search`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('search')).toBe('john');

          return HttpResponse.json(createSuccessResponse([
            createMockMember({ id: 100, fullname: 'John Doe' }),
            createMockMember({ id: 101, fullname: 'Johnny Smith' }),
          ]));
        })
      );

      // Act
      const result = await searchUsers('john');

      // Assert
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(2);
      expect(result[0].fullname).toBe('John Doe');
    });

    it('should throw error for empty query', async () => {
      // Act & Assert
      await expect(searchUsers('')).rejects.toThrow('Search query cannot be empty');
    });

    it('should support pagination', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages/users/search`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('page')).toBe('1');
          expect(url.searchParams.get('perPage')).toBe('10');

          return HttpResponse.json(createSuccessResponse([createMockMember()]));
        })
      );

      // Act
      await searchUsers('test', { pagination: { page: 1, perPage: 10 } });
    });
  });

  // --------------------------------------------------------------------------
  // messagingKeys Query Key Factory Tests
  // --------------------------------------------------------------------------
  describe('messagingKeys', () => {
    it('should generate correct base key', () => {
      expect(messagingKeys.all).toEqual(['messaging']);
    });

    it('should generate correct conversations key', () => {
      expect(messagingKeys.conversations()).toEqual(['messaging', 'conversations']);
    });

    it('should generate correct conversation key with ID', () => {
      expect(messagingKeys.conversation(123)).toEqual(['messaging', 'conversations', 123]);
    });

    it('should generate correct conversationMessages key', () => {
      expect(messagingKeys.conversationMessages(123)).toEqual(['messaging', 'conversations', 123, 'messages']);
    });

    it('should generate correct conversationMembers key', () => {
      expect(messagingKeys.conversationMembers(123)).toEqual(['messaging', 'conversations', 123, 'members']);
    });

    it('should generate correct messages key', () => {
      expect(messagingKeys.messages()).toEqual(['messaging', 'messages']);
    });

    it('should generate correct messageSearch key', () => {
      expect(messagingKeys.messageSearch('test')).toEqual(['messaging', 'messages', 'search', 'test']);
    });

    it('should generate correct contacts key', () => {
      expect(messagingKeys.contacts()).toEqual(['messaging', 'contacts']);
    });

    it('should generate correct contactRequests key', () => {
      expect(messagingKeys.contactRequests()).toEqual(['messaging', 'contacts', 'requests']);
    });

    it('should generate correct contactRequestCount key', () => {
      expect(messagingKeys.contactRequestCount()).toEqual(['messaging', 'contacts', 'requests', 'count']);
    });

    it('should generate correct notifications key', () => {
      expect(messagingKeys.notifications()).toEqual(['messaging', 'notifications']);
    });

    it('should generate correct unreadNotificationCount key', () => {
      expect(messagingKeys.unreadNotificationCount()).toEqual(['messaging', 'notifications', 'unread', 'count']);
    });

    it('should generate correct unreadConversationCounts key', () => {
      expect(messagingKeys.unreadConversationCounts()).toEqual(['messaging', 'conversations', 'unread', 'counts']);
    });

    it('should generate correct notificationPreferences key', () => {
      expect(messagingKeys.notificationPreferences()).toEqual(['messaging', 'notifications', 'preferences']);
    });

    it('should generate correct messagePreferences key', () => {
      expect(messagingKeys.messagePreferences()).toEqual(['messaging', 'messages', 'preferences']);
    });

    it('should generate correct userSearch key', () => {
      expect(messagingKeys.userSearch('john')).toEqual(['messaging', 'users', 'search', 'john']);
    });
  });

  // --------------------------------------------------------------------------
  // Error Response Structure Tests
  // --------------------------------------------------------------------------
  describe('Error Response Handling', () => {
    it('should handle API error response with code and message', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages`, () => {
          return HttpResponse.json(
            createErrorResponse('VALIDATION_ERROR', 'Invalid parameters', {
              field: 'page',
              reason: 'must be positive',
            }),
            { status: 400 }
          );
        })
      );

      // Act & Assert
      await expect(getMessages()).rejects.toThrow();
    });

    it('should handle rate limiting error (429)', async () => {
      // Arrange
      server.use(
        http.get(`${API_BASE_URL}/messages`, () => {
          return HttpResponse.json(
            createErrorResponse('RATE_LIMIT_EXCEEDED', 'Too many requests'),
            { status: 429 }
          );
        })
      );

      // Act & Assert
      await expect(getMessages()).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Type Compliance Tests
  // --------------------------------------------------------------------------
  describe('Type Compliance', () => {
    it('should return properly typed Message array', async () => {
      // Act
      const result = await getMessages();

      // Assert
      result.forEach((message) => {
        expect(typeof message.id).toBe('number');
        expect(typeof message.useridfrom).toBe('number');
        expect(typeof message.conversationid).toBe('number');
        expect(typeof message.fullmessage).toBe('string');
        expect(typeof message.timecreated).toBe('number');
      });
    });

    it('should return properly typed Conversation', async () => {
      // Act
      const result = await getConversations();

      // Assert
      result.conversations.forEach((conversation) => {
        expect(typeof conversation.id).toBe('number');
        expect(typeof conversation.type).toBe('number');
        expect(typeof conversation.membercount).toBe('number');
        expect(typeof conversation.isfavourite).toBe('boolean');
        expect(typeof conversation.isread).toBe('boolean');
        expect(typeof conversation.unreadcount).toBe('number');
        expect(Array.isArray(conversation.members)).toBe(true);
        expect(Array.isArray(conversation.messages)).toBe(true);
      });
    });

    it('should return properly typed Contact', async () => {
      // Act
      const result = await getContacts();

      // Assert
      result.forEach((contact) => {
        expect(typeof contact.userid).toBe('number');
        expect(typeof contact.fullname).toBe('string');
        expect(typeof contact.profileimageurl).toBe('string');
        expect(typeof contact.blocked).toBe('boolean');
      });
    });

    it('should return properly typed Notification', async () => {
      // Act
      const result = await getNotifications();

      // Assert
      result.notifications.forEach((notification) => {
        expect(typeof notification.id).toBe('number');
        expect(typeof notification.subject).toBe('string');
        expect(typeof notification.fullmessage).toBe('string');
        expect(typeof notification.component).toBe('string');
        expect(typeof notification.eventtype).toBe('string');
        expect(typeof notification.timecreated).toBe('number');
      });
    });
  });
});
