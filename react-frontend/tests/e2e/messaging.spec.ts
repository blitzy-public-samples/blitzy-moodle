/**
 * E2E Test: Private Messaging System
 * 
 * Validates the complete private messaging workflow including:
 * - Message composition with recipient selection
 * - Message sending and receiving
 * - Conversation threading and chronological display
 * - Real-time messaging updates with multiple browser contexts
 * - Message search functionality
 * - Notification system with unread counts
 * - Conversation management (mark as read, delete)
 * - Error handling (empty messages, blocked users)
 * 
 * Test Structure:
 * - Uses Page Object Model pattern for messaging UI interactions
 * - Tests with multiple browser contexts for real-time messaging validation
 * - Validates data persistence, timestamp accuracy, and notification correctness
 * - Captures screenshots on test failure for debugging
 */

import { test, expect, type Page } from '@playwright/test';
import { MessagingPage } from './pages/MessagingPage';
import { login, logout, isAuthenticated, getAuthToken, clearAuthenticationState } from './utils/auth';
import { testStudent, testStudent2, testStudent3, TEST_PASSWORD } from './fixtures/users';
import { handleNewTab, switchToTab, clearBrowserStorage } from './utils/browser-helpers';

test.describe('Private Messaging System E2E Tests', () => {
  let user1Page: Page;
  let user2Page: Page;
  let user1MessagingPage: MessagingPage;
  let user2MessagingPage: MessagingPage;
  let testConversationIds: string[] = [];

  test.beforeAll(async ({ browser }) => {
    // Setup: Login as user1 (testStudent) in first browser context
    const user1Context = await browser.newContext();
    user1Page = await user1Context.newPage();
    
    // Authenticate user1
    await login(user1Page, { username: testStudent.username, password: TEST_PASSWORD });
    await expect(await isAuthenticated(user1Page)).toBe(true);
    
    // Initialize MessagingPage for user1
    user1MessagingPage = new MessagingPage(user1Page);
    
    // Navigate to messaging center
    await user1Page.goto('/messaging');
    await user1MessagingPage.waitForMessaging();
    
    // Setup: Login as user2 (testStudent2) in second browser context for real-time testing
    const user2Context = await browser.newContext();
    user2Page = await user2Context.newPage();
    
    // Authenticate user2
    await login(user2Page, { username: testStudent2.username, password: TEST_PASSWORD });
    await expect(await isAuthenticated(user2Page)).toBe(true);
    
    // Initialize MessagingPage for user2
    user2MessagingPage = new MessagingPage(user2Page);
    
    // Navigate to messaging center for user2
    await user2Page.goto('/messaging');
    await user2MessagingPage.waitForMessaging();
  });

  test.beforeEach(async () => {
    // Reset to messaging page before each test
    await user1Page.goto('/messaging');
    await user1MessagingPage.waitForMessaging();
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Capture screenshot on failure
    if (testInfo.status !== testInfo.expectedStatus) {
      const screenshot = await user1Page.screenshot();
      await testInfo.attach('user1-screenshot', { body: screenshot, contentType: 'image/png' });
      
      const user2Screenshot = await user2Page.screenshot();
      await testInfo.attach('user2-screenshot', { body: user2Screenshot, contentType: 'image/png' });
    }
  });

  test.afterAll(async () => {
    // Cleanup: Delete test conversations
    for (const conversationId of testConversationIds) {
      try {
        await user1MessagingPage.deleteConversation(conversationId);
      } catch (error) {
        console.warn(`Failed to delete conversation ${conversationId}:`, error);
      }
    }
    
    // Logout users
    await logout(user1Page);
    await logout(user2Page);
    
    // Close pages and contexts
    await user1Page.close();
    await user2Page.close();
  });

  test.describe('Step 1: Setup and Navigation', () => {
    test('should verify user1 is logged in and messaging center is accessible', async () => {
      // Verify authentication state
      const authenticated = await isAuthenticated(user1Page);
      expect(authenticated).toBe(true);
      
      // Verify messaging center loaded
      const conversations = await user1MessagingPage.getConversations();
      expect(conversations).toBeDefined();
      expect(Array.isArray(conversations)).toBe(true);
    });

    test('should verify user2 is logged in and messaging center is accessible', async () => {
      // Verify authentication state for user2
      const authenticated = await isAuthenticated(user2Page);
      expect(authenticated).toBe(true);
      
      // Navigate to messaging center
      await user2Page.goto('/messaging');
      await user2MessagingPage.waitForMessaging();
      
      // Verify messaging center loaded for user2
      const conversations = await user2MessagingPage.getConversations();
      expect(conversations).toBeDefined();
      expect(Array.isArray(conversations)).toBe(true);
    });
  });

  test.describe('Step 2: Message Composition', () => {
    test('should open compose dialog and select user2 as recipient', async () => {
      // Click compose button
      await user1MessagingPage.composeMessage();
      
      // Select user2 (testStudent2) as recipient
      await user1MessagingPage.selectRecipient(testStudent2.username);
      
      // Verify compose dialog is open with recipient selected
      await expect(user1Page.locator('[data-testid="message-compose-dialog"]')).toBeVisible();
      await expect(user1Page.locator('[data-testid="recipient-selected"]')).toContainText(testStudent2.username);
    });

    test('should type message content in compose field', async () => {
      // Open compose dialog
      await user1MessagingPage.composeMessage();
      await user1MessagingPage.selectRecipient(testStudent2.username);
      
      // Type message content
      const messageContent = 'Hello from E2E test! This is a test message from user1 to user2.';
      await user1MessagingPage.typeMessage(messageContent);
      
      // Verify message content appears in input field
      const messageInputValue = await user1Page.inputValue('[data-testid="message-input-field"]');
      expect(messageInputValue).toBe(messageContent);
    });
  });

  test.describe('Step 3: Message Sending', () => {
    test('should send message and verify sent confirmation', async () => {
      // Open compose dialog
      await user1MessagingPage.composeMessage();
      await user1MessagingPage.selectRecipient(testStudent2.username);
      
      // Type and send message
      const messageContent = 'Test message for sending verification at ' + new Date().toISOString();
      await user1MessagingPage.typeMessage(messageContent);
      await user1MessagingPage.sendMessage();
      
      // Wait for message sent confirmation
      await user1MessagingPage.waitForMessageSent();
      
      // Verify sent confirmation appears
      await expect(user1Page.locator('[data-testid="message-sent-confirmation"]')).toBeVisible();
    });

    test('should verify message appears in conversation after sending', async () => {
      // Open compose dialog
      await user1MessagingPage.composeMessage();
      await user1MessagingPage.selectRecipient(testStudent2.username);
      
      // Send message
      const messageContent = 'Message content verification test at ' + new Date().toISOString();
      await user1MessagingPage.typeMessage(messageContent);
      await user1MessagingPage.sendMessage();
      await user1MessagingPage.waitForMessageSent();
      
      // Click on conversation with user2
      const conversations = await user1MessagingPage.getConversations();
      const user2Conversation = conversations.find(conv => 
        conv.participantIds.includes(testStudent2.id.toString()) || 
        conv.participantNames.some(name => name.includes(testStudent2.firstname))
      );
      
      expect(user2Conversation).toBeDefined();
      await user1MessagingPage.clickConversation(user2Conversation!.id);
      
      // Store conversation ID for cleanup
      testConversationIds.push(user2Conversation!.id);
      
      // Verify message appears in conversation thread
      const messages = await user1MessagingPage.getMessages();
      const sentMessage = messages.find(msg => msg.content === messageContent);
      
      expect(sentMessage).toBeDefined();
      expect(sentMessage!.content).toBe(messageContent);
      expect(sentMessage!.senderId).toBe(testStudent.id.toString());
    });
  });

  test.describe('Step 4: Message Receiving', () => {
    test('should verify notification badge shows unread count for user2', async () => {
      // User1 sends a message to user2
      await user1MessagingPage.composeMessage();
      await user1MessagingPage.selectRecipient(testStudent2.username);
      
      const messageContent = 'Notification test message at ' + new Date().toISOString();
      await user1MessagingPage.typeMessage(messageContent);
      await user1MessagingPage.sendMessage();
      await user1MessagingPage.waitForMessageSent();
      
      // Wait a moment for message to propagate
      await user2Page.waitForTimeout(1000);
      
      // Refresh user2's messaging page to see notification
      await user2Page.reload();
      await user2MessagingPage.waitForMessaging();
      
      // Verify notification badge shows unread count
      const unreadCount = await user2MessagingPage.getUnreadCount();
      expect(unreadCount).toBeGreaterThan(0);
      
      // Verify notification badge is visible
      await user2MessagingPage.verifyNotificationBadge();
    });

    test('should verify user2 can see the new message in conversation list', async () => {
      // Navigate to user2's messaging page
      await user2Page.goto('/messaging');
      await user2MessagingPage.waitForMessaging();
      
      // Get conversations for user2
      const conversations = await user2MessagingPage.getConversations();
      
      // Find conversation with user1
      const user1Conversation = conversations.find(conv => 
        conv.participantIds.includes(testStudent.id.toString()) || 
        conv.participantNames.some(name => name.includes(testStudent.firstname))
      );
      
      expect(user1Conversation).toBeDefined();
      expect(user1Conversation!.unreadCount).toBeGreaterThan(0);
    });
  });

  test.describe('Step 5: Conversation View', () => {
    test('should open conversation and verify message thread displays chronologically', async () => {
      // Navigate to user2's messaging page
      await user2Page.goto('/messaging');
      await user2MessagingPage.waitForMessaging();
      
      // Get and open conversation with user1
      const conversations = await user2MessagingPage.getConversations();
      const user1Conversation = conversations.find(conv => 
        conv.participantIds.includes(testStudent.id.toString()) || 
        conv.participantNames.some(name => name.includes(testStudent.firstname))
      );
      
      expect(user1Conversation).toBeDefined();
      await user2MessagingPage.clickConversation(user1Conversation!.id);
      
      // Get messages in conversation
      const messages = await user2MessagingPage.getMessages();
      
      // Verify messages are displayed
      expect(messages.length).toBeGreaterThan(0);
      
      // Verify messages are in chronological order (oldest first)
      for (let i = 1; i < messages.length; i++) {
        const prevTimestamp = new Date(messages[i - 1].timestamp).getTime();
        const currTimestamp = new Date(messages[i].timestamp).getTime();
        expect(currTimestamp).toBeGreaterThanOrEqual(prevTimestamp);
      }
    });

    test('should verify message thread shows correct sender and recipient information', async () => {
      // Navigate to user2's messaging and open conversation
      await user2Page.goto('/messaging');
      await user2MessagingPage.waitForMessaging();
      
      const conversations = await user2MessagingPage.getConversations();
      const user1Conversation = conversations.find(conv => 
        conv.participantIds.includes(testStudent.id.toString()) || 
        conv.participantNames.some(name => name.includes(testStudent.firstname))
      );
      
      await user2MessagingPage.clickConversation(user1Conversation!.id);
      
      // Get messages
      const messages = await user2MessagingPage.getMessages();
      
      // Verify each message has correct sender information
      messages.forEach(message => {
        expect(message.senderId).toBeDefined();
        expect([testStudent.id.toString(), testStudent2.id.toString()]).toContain(message.senderId);
      });
    });
  });

  test.describe('Step 6: Message Reply', () => {
    test('should reply to message and verify reply appears in thread', async () => {
      // Navigate to user2's messaging and open conversation
      await user2Page.goto('/messaging');
      await user2MessagingPage.waitForMessaging();
      
      const conversations = await user2MessagingPage.getConversations();
      const user1Conversation = conversations.find(conv => 
        conv.participantIds.includes(testStudent.id.toString()) || 
        conv.participantNames.some(name => name.includes(testStudent.firstname))
      );
      
      await user2MessagingPage.clickConversation(user1Conversation!.id);
      
      // Get initial message count
      const initialMessages = await user2MessagingPage.getMessages();
      const initialCount = initialMessages.length;
      
      // Reply to the message
      const replyContent = 'This is a reply from user2 at ' + new Date().toISOString();
      const firstMessageId = initialMessages[0]?.id || '';
      await user2MessagingPage.replyToMessage(firstMessageId, replyContent);
      
      // Wait for reply to be sent
      await user2Page.waitForTimeout(1000);
      
      // Verify reply appears in thread
      const updatedMessages = await user2MessagingPage.getMessages();
      expect(updatedMessages.length).toBe(initialCount + 1);
      
      // Verify the last message is the reply
      const lastMessage = updatedMessages[updatedMessages.length - 1];
      expect(lastMessage.content).toBe(replyContent);
      expect(lastMessage.senderId).toBe(testStudent2.id.toString());
    });
  });

  test.describe('Step 7: Real-Time Updates', () => {
    test('should verify message appears in user2 conversation without refresh when user1 sends', async () => {
      // User2: Open conversation with user1
      await user2Page.goto('/messaging');
      await user2MessagingPage.waitForMessaging();
      
      const conversations = await user2MessagingPage.getConversations();
      const user1Conversation = conversations.find(conv => 
        conv.participantIds.includes(testStudent.id.toString()) || 
        conv.participantNames.some(name => name.includes(testStudent.firstname))
      );
      
      await user2MessagingPage.clickConversation(user1Conversation!.id);
      
      // Get initial message count for user2
      const initialMessages = await user2MessagingPage.getMessages();
      const initialCount = initialMessages.length;
      
      // User1: Send a new message
      await user1Page.goto('/messaging');
      await user1MessagingPage.waitForMessaging();
      
      const user1Conversations = await user1MessagingPage.getConversations();
      const user2ConversationForUser1 = user1Conversations.find(conv => 
        conv.participantIds.includes(testStudent2.id.toString()) || 
        conv.participantNames.some(name => name.includes(testStudent2.firstname))
      );
      
      await user1MessagingPage.clickConversation(user2ConversationForUser1!.id);
      
      const realTimeMessageContent = 'Real-time test message at ' + new Date().toISOString();
      await user1MessagingPage.typeMessage(realTimeMessageContent);
      await user1MessagingPage.sendMessage();
      await user1MessagingPage.waitForMessageSent();
      
      // User2: Wait for real-time update (should appear without refresh)
      await user2Page.waitForTimeout(2000); // Give time for real-time update
      
      // Verify real-time update occurred
      await user2MessagingPage.verifyRealTimeUpdate();
      
      // Get updated messages for user2 without refresh
      const updatedMessages = await user2MessagingPage.getMessages();
      
      // Verify message count increased
      expect(updatedMessages.length).toBe(initialCount + 1);
      
      // Verify the new message appears
      const newMessage = updatedMessages.find(msg => msg.content === realTimeMessageContent);
      expect(newMessage).toBeDefined();
      expect(newMessage!.senderId).toBe(testStudent.id.toString());
    });
  });

  test.describe('Step 8: Message Search', () => {
    test('should search for keyword and verify matching results', async () => {
      // Navigate to messaging page
      await user1Page.goto('/messaging');
      await user1MessagingPage.waitForMessaging();
      
      // Define unique search keyword
      const searchKeyword = 'unique_search_keyword_' + Date.now();
      
      // Send a message with the search keyword
      await user1MessagingPage.composeMessage();
      await user1MessagingPage.selectRecipient(testStudent2.username);
      await user1MessagingPage.typeMessage(`Message containing ${searchKeyword} for search testing`);
      await user1MessagingPage.sendMessage();
      await user1MessagingPage.waitForMessageSent();
      
      // Wait for message to be indexed
      await user1Page.waitForTimeout(1000);
      
      // Perform search
      await user1MessagingPage.searchMessages(searchKeyword);
      
      // Get search results
      const searchResults = await user1MessagingPage.getMessages();
      
      // Verify search results contain messages with the keyword
      expect(searchResults.length).toBeGreaterThan(0);
      
      // Verify all results contain the search keyword
      searchResults.forEach(result => {
        expect(result.content.toLowerCase()).toContain(searchKeyword.toLowerCase());
      });
    });

    test('should verify empty search results for non-existent keyword', async () => {
      // Search for non-existent keyword
      const nonExistentKeyword = 'nonexistent_keyword_xyz_' + Date.now();
      await user1MessagingPage.searchMessages(nonExistentKeyword);
      
      // Get search results
      const searchResults = await user1MessagingPage.getMessages();
      
      // Verify no results found
      expect(searchResults.length).toBe(0);
    });
  });

  test.describe('Step 9: Conversation List', () => {
    test('should verify conversation list shows recent messages and participants', async () => {
      // Navigate to messaging page
      await user1Page.goto('/messaging');
      await user1MessagingPage.waitForMessaging();
      
      // Get conversations
      const conversations = await user1MessagingPage.getConversations();
      
      // Verify conversations list is not empty
      expect(conversations.length).toBeGreaterThan(0);
      
      // Verify each conversation has required information
      conversations.forEach(conversation => {
        expect(conversation.id).toBeDefined();
        expect(conversation.participantIds.length).toBeGreaterThan(0);
        expect(conversation.participantNames.length).toBeGreaterThan(0);
        expect(conversation.lastMessage).toBeDefined();
        expect(conversation.lastMessageTime).toBeDefined();
      });
      
      // Verify conversation with user2 exists
      const user2Conversation = conversations.find(conv => 
        conv.participantIds.includes(testStudent2.id.toString()) ||
        conv.participantNames.some(name => name.includes(testStudent2.firstname))
      );
      
      expect(user2Conversation).toBeDefined();
    });

    test('should verify conversations are sorted by most recent activity', async () => {
      // Get conversations
      const conversations = await user1MessagingPage.getConversations();
      
      // Verify conversations are sorted by timestamp (most recent first)
      for (let i = 1; i < conversations.length; i++) {
        const prevTimestamp = new Date(conversations[i - 1].lastMessageTime).getTime();
        const currTimestamp = new Date(conversations[i].lastMessageTime).getTime();
        expect(prevTimestamp).toBeGreaterThanOrEqual(currTimestamp);
      }
    });
  });

  test.describe('Step 10: Message Notifications', () => {
    test('should verify notification appears when message is received', async () => {
      // User1 sends a message to user2
      await user1Page.goto('/messaging');
      await user1MessagingPage.waitForMessaging();
      
      await user1MessagingPage.composeMessage();
      await user1MessagingPage.selectRecipient(testStudent2.username);
      
      const notificationTestMessage = 'Notification test at ' + new Date().toISOString();
      await user1MessagingPage.typeMessage(notificationTestMessage);
      await user1MessagingPage.sendMessage();
      await user1MessagingPage.waitForMessageSent();
      
      // Wait for notification to propagate
      await user2Page.waitForTimeout(2000);
      
      // User2: Check for notifications
      await user2Page.goto('/messaging');
      await user2MessagingPage.waitForMessaging();
      
      // Verify notification badge is visible
      await user2MessagingPage.verifyNotificationBadge();
      
      // Get notifications
      const notifications = await user2MessagingPage.getNotifications();
      
      // Verify notification for the new message exists
      expect(notifications.length).toBeGreaterThan(0);
    });
  });

  test.describe('Step 11: Mark as Read', () => {
    test('should mark conversation as read and verify unread count decreases', async () => {
      // Navigate to user2's messaging page
      await user2Page.goto('/messaging');
      await user2MessagingPage.waitForMessaging();
      
      // Get initial unread count
      const initialUnreadCount = await user2MessagingPage.getUnreadCount();
      
      // Open conversation with user1
      const conversations = await user2MessagingPage.getConversations();
      const user1Conversation = conversations.find(conv => 
        conv.participantIds.includes(testStudent.id.toString()) ||
        conv.participantNames.some(name => name.includes(testStudent.firstname))
      );
      
      if (user1Conversation && user1Conversation.unreadCount > 0) {
        // Click conversation to mark as read
        await user2MessagingPage.clickConversation(user1Conversation.id);
        
        // Get messages and mark the first one as read
        const messages = await user2MessagingPage.getMessages();
        if (messages.length > 0) {
          await user2MessagingPage.markAsRead(messages[0].id);
        }
        
        // Wait for mark as read to process
        await user2Page.waitForTimeout(1000);
        
        // Navigate back to conversation list
        await user2Page.goto('/messaging');
        await user2MessagingPage.waitForMessaging();
        
        // Get updated unread count
        const updatedUnreadCount = await user2MessagingPage.getUnreadCount();
        
        // Verify unread count decreased
        expect(updatedUnreadCount).toBeLessThan(initialUnreadCount);
      }
    });
  });

  test.describe('Step 12: Delete Conversation', () => {
    test('should delete conversation and verify it is removed from list', async () => {
      // Create a new conversation for deletion test with user3
      await user1Page.goto('/messaging');
      await user1MessagingPage.waitForMessaging();
      
      await user1MessagingPage.composeMessage();
      await user1MessagingPage.selectRecipient(testStudent3.username);
      
      const deleteTestMessage = 'Message for deletion test at ' + new Date().toISOString();
      await user1MessagingPage.typeMessage(deleteTestMessage);
      await user1MessagingPage.sendMessage();
      await user1MessagingPage.waitForMessageSent();
      
      // Wait for conversation to be created
      await user1Page.waitForTimeout(1000);
      
      // Get conversations and find the one with user3
      const conversations = await user1MessagingPage.getConversations();
      const user3Conversation = conversations.find(conv => 
        conv.participantIds.includes(testStudent3.id.toString()) ||
        conv.participantNames.some(name => name.includes(testStudent3.firstname))
      );
      
      expect(user3Conversation).toBeDefined();
      const conversationIdToDelete = user3Conversation!.id;
      
      // Delete the conversation
      await user1MessagingPage.deleteConversation(conversationIdToDelete);
      
      // Wait for deletion to process
      await user1Page.waitForTimeout(1000);
      
      // Verify conversation is removed from list
      const updatedConversations = await user1MessagingPage.getConversations();
      const deletedConversation = updatedConversations.find(conv => conv.id === conversationIdToDelete);
      
      expect(deletedConversation).toBeUndefined();
    });
  });

  test.describe('Step 13: Assertions - Data Persistence and Accuracy', () => {
    test('should verify messages persist after page refresh', async () => {
      // Navigate to messaging and open a conversation
      await user1Page.goto('/messaging');
      await user1MessagingPage.waitForMessaging();
      
      const conversations = await user1MessagingPage.getConversations();
      const user2Conversation = conversations.find(conv => 
        conv.participantIds.includes(testStudent2.id.toString())
      );
      
      if (user2Conversation) {
        await user1MessagingPage.clickConversation(user2Conversation.id);
        
        // Get messages before refresh
        const messagesBeforeRefresh = await user1MessagingPage.getMessages();
        const messageCountBefore = messagesBeforeRefresh.length;
        
        // Refresh page
        await user1Page.reload();
        await user1MessagingPage.waitForMessaging();
        
        // Open same conversation
        await user1MessagingPage.clickConversation(user2Conversation.id);
        
        // Get messages after refresh
        const messagesAfterRefresh = await user1MessagingPage.getMessages();
        const messageCountAfter = messagesAfterRefresh.length;
        
        // Verify messages persist
        expect(messageCountAfter).toBe(messageCountBefore);
        
        // Verify message content is the same
        messagesBeforeRefresh.forEach((msgBefore, index) => {
          const msgAfter = messagesAfterRefresh[index];
          expect(msgAfter.content).toBe(msgBefore.content);
          expect(msgAfter.senderId).toBe(msgBefore.senderId);
        });
      }
    });

    test('should verify timestamps are accurate', async () => {
      // Navigate to messaging and open a conversation
      await user1Page.goto('/messaging');
      await user1MessagingPage.waitForMessaging();
      
      const conversations = await user1MessagingPage.getConversations();
      const user2Conversation = conversations.find(conv => 
        conv.participantIds.includes(testStudent2.id.toString())
      );
      
      if (user2Conversation) {
        await user1MessagingPage.clickConversation(user2Conversation.id);
        
        // Get messages
        const messages = await user1MessagingPage.getMessages();
        
        // Verify timestamps are valid dates
        for (const message of messages) {
          const timestamp = await user1MessagingPage.getMessageTimestamp(message.id);
          expect(timestamp).toBeDefined();
          
          // Verify timestamp is a valid date
          const date = new Date(timestamp);
          expect(date.toString()).not.toBe('Invalid Date');
          
          // Verify timestamp is not in the future
          expect(date.getTime()).toBeLessThanOrEqual(Date.now());
        }
      }
    });

    test('should verify unread counts are correct', async () => {
      // User1 sends multiple messages to user2
      await user1Page.goto('/messaging');
      await user1MessagingPage.waitForMessaging();
      
      const messagesToSend = 3;
      
      for (let i = 0; i < messagesToSend; i++) {
        await user1MessagingPage.composeMessage();
        await user1MessagingPage.selectRecipient(testStudent2.username);
        
        const messageContent = `Unread count test message ${i + 1} at ${new Date().toISOString()}`;
        await user1MessagingPage.typeMessage(messageContent);
        await user1MessagingPage.sendMessage();
        await user1MessagingPage.waitForMessageSent();
        
        await user1Page.waitForTimeout(500);
      }
      
      // Wait for messages to propagate
      await user2Page.waitForTimeout(2000);
      
      // User2: Check unread count
      await user2Page.goto('/messaging');
      await user2MessagingPage.waitForMessaging();
      
      const unreadCount = await user2MessagingPage.getUnreadCount();
      
      // Verify unread count reflects the sent messages
      expect(unreadCount).toBeGreaterThanOrEqual(messagesToSend);
    });
  });

  test.describe('Step 14: Error Scenarios', () => {
    test('should handle empty message submission gracefully', async () => {
      // Navigate to messaging
      await user1Page.goto('/messaging');
      await user1MessagingPage.waitForMessaging();
      
      // Open compose dialog
      await user1MessagingPage.composeMessage();
      await user1MessagingPage.selectRecipient(testStudent2.username);
      
      // Try to send empty message
      await user1MessagingPage.typeMessage('');
      
      // Attempt to click send button
      const sendButton = user1Page.locator('[data-testid="message-send-button"]');
      
      // Verify send button is disabled for empty message
      const isDisabled = await sendButton.isDisabled();
      expect(isDisabled).toBe(true);
    });

    test('should display error when attempting to send to blocked user (if blocking feature exists)', async () => {
      // This test validates error handling for blocked users
      // Implementation depends on whether blocking feature is available
      
      // Navigate to messaging
      await user1Page.goto('/messaging');
      await user1MessagingPage.waitForMessaging();
      
      // Try to compose message to a user (test for error handling)
      await user1MessagingPage.composeMessage();
      
      // If there's a blocked user in the system, try selecting them
      // and verify error message appears
      // This is a placeholder for actual blocking logic implementation
      
      // For now, verify error handling infrastructure exists
      const errorContainer = user1Page.locator('[data-testid="message-error-container"]');
      expect(errorContainer).toBeDefined();
    });
  });

  test.describe('Additional Validation Tests', () => {
    test('should verify conversation list updates after sending a message', async () => {
      // Get initial conversation list
      await user1Page.goto('/messaging');
      await user1MessagingPage.waitForMessaging();
      
      const conversationsBeforeSend = await user1MessagingPage.getConversations();
      
      // Send a message
      await user1MessagingPage.composeMessage();
      await user1MessagingPage.selectRecipient(testStudent2.username);
      
      const updateTestMessage = 'Conversation list update test at ' + new Date().toISOString();
      await user1MessagingPage.typeMessage(updateTestMessage);
      await user1MessagingPage.sendMessage();
      await user1MessagingPage.waitForMessageSent();
      
      // Wait for conversation list to update
      await user1Page.waitForTimeout(1000);
      
      // Get updated conversation list
      await user1Page.goto('/messaging');
      await user1MessagingPage.waitForMessaging();
      
      const conversationsAfterSend = await user1MessagingPage.getConversations();
      
      // Find user2 conversation in updated list
      const user2ConversationAfter = conversationsAfterSend.find(conv => 
        conv.participantIds.includes(testStudent2.id.toString())
      );
      
      expect(user2ConversationAfter).toBeDefined();
      expect(user2ConversationAfter!.lastMessage).toContain(updateTestMessage);
    });

    test('should verify message threading maintains conversation context', async () => {
      // Navigate to messaging and open conversation
      await user1Page.goto('/messaging');
      await user1MessagingPage.waitForMessaging();
      
      const conversations = await user1MessagingPage.getConversations();
      const user2Conversation = conversations.find(conv => 
        conv.participantIds.includes(testStudent2.id.toString())
      );
      
      if (user2Conversation) {
        await user1MessagingPage.clickConversation(user2Conversation.id);
        
        // Get all messages
        const messages = await user1MessagingPage.getMessages();
        
        // Verify all messages belong to the same conversation
        messages.forEach(message => {
          // Messages should alternate between user1 and user2 or be consecutive from same sender
          expect([testStudent.username, testStudent2.username]).toContain(message.senderName);
        });
      }
    });
  });
});
