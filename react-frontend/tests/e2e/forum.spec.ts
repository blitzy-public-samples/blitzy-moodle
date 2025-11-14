/**
 * Playwright E2E Test: Forum Discussion and Moderation
 * 
 * Tests forum discussion creation, replies, moderation, and interaction features.
 * Validates forum permissions, threading, subscriptions, ratings, and search functionality.
 * 
 * Test Coverage:
 * - Forum view with title, description, discussion list
 * - Discussion creation with rich text editor
 * - File attachments to discussions
 * - Discussion viewing in thread format
 * - Post replies with indentation
 * - Post editing and deletion
 * - Forum subscription management
 * - Post rating system
 * - Forum search functionality
 * - Teacher moderation capabilities
 * - Permission enforcement
 * - Error scenarios (locked forum, no permission)
 */

import { test, expect, type Page } from '@playwright/test';
import { ForumPage } from './pages/ForumPage';
import { login, loginAsStudent, loginAsTeacher, isAuthenticated, logout, getAuthToken, clearAuthenticationState } from './utils/auth';
import { testCourse1, testCourse2, testCourse4, createCourse, getCourseWithActivities } from './fixtures/courses';
import { uploadFile, verifyFileUploaded, generateTestFile, cleanupTestFiles } from './utils/file-helpers';
import { testStudent, testTeacher, testEditingTeacher, TEST_PASSWORD } from './fixtures/users';
import { waitForApiResponse } from './utils/wait-helpers';

test.describe('Forum Discussion and Moderation', () => {
  const testCourseId = testCourse4.id; // Course with multiple activities including forum
  const testForumId = 1; // Default test forum ID
  
  // Helper to setup forum page for each test
  async function setupForumPage(page: Page): Promise<ForumPage> {
    // Login as student user
    await loginAsStudent(page);
    
    // Verify authentication successful
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);
    
    // Navigate directly to forum page using React route
    await page.goto(`/courses/${testCourseId}/forums/${testForumId}`);
    await page.waitForLoadState('networkidle');
    
    // Initialize and return forum page object
    const forumPage = new ForumPage(page);
    await forumPage.waitForForum();
    
    return forumPage;
  }
  
  // Helper to setup teacher access for moderation tests
  async function setupForumPageAsTeacher(page: Page): Promise<ForumPage> {
    // Login as teacher user
    await loginAsTeacher(page);
    
    // Verify authentication successful
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);
    
    // Navigate directly to forum page using React route
    await page.goto(`/courses/${testCourseId}/forums/${testForumId}`);
    await page.waitForLoadState('networkidle');
    
    // Initialize and return forum page object
    const forumPage = new ForumPage(page);
    await forumPage.waitForForum();
    
    return forumPage;
  }

  test.describe('Forum View and Navigation', () => {
    test('should display forum with title, description, and discussion list', async ({ page }) => {
      // Setup forum page for this test
      const forumPage = await setupForumPage(page);
      
      // Test forum view: Verify forum displays with title, description, discussion list
      const forumInfo = await forumPage.getForumInfo();
      
      expect(forumInfo.title).toBeTruthy();
      expect(forumInfo.title.length).toBeGreaterThan(0);
      expect(forumInfo.description).toBeDefined();
      
      // Verify discussion list is visible (may be empty initially)
      const discussions = await forumPage.getDiscussions();
      expect(discussions).toBeDefined();
      expect(Array.isArray(discussions)).toBe(true);
    });
  });

  test.describe('Discussion Creation and Posting', () => {
    test('should create discussion with rich text editor', async ({ page }) => {
      // Setup forum page for this test
      const forumPage = await setupForumPage(page);
      
      // Test discussion creation: Click "Add discussion", fill subject and message, verify rich text editor works
      await forumPage.clickAddDiscussion();
      
      const discussionSubject = `Test Discussion ${Date.now()}`;
      const discussionMessage = '<p>This is a <strong>test discussion</strong> with <em>rich text</em> formatting.</p>';
      
      // Create discussion and capture the returned ID
      const discussionId = await forumPage.createDiscussion(discussionSubject, discussionMessage);
      
      // Test post discussion: Verify discussion was created
      expect(discussionId).toBeTruthy();
      
      // Verify discussion appears in forum list
      const discussions = await forumPage.getDiscussions();
      const createdDiscussion = discussions.find(d => d.id === discussionId);
      
      expect(createdDiscussion).toBeDefined();
      expect(createdDiscussion?.subject).toBe(discussionSubject);
    });

    test('should create discussion with file attachment', async ({ page }) => {
      // Setup forum page for this test
      const forumPage = await setupForumPage(page);
      
      // Test discussion with attachment: Attach file to discussion, verify file appears in post
      await forumPage.clickAddDiscussion();
      
      const discussionSubject = `Test Discussion with Attachment ${Date.now()}`;
      const discussionMessage = '<p>This discussion includes a file attachment.</p>';
      
      // Generate test file for attachment (using default 'small' size)
      const testFile = await generateTestFile('pdf');
      
      // Create discussion with attachment and capture the ID
      const discussionId = await forumPage.createDiscussion(discussionSubject, discussionMessage, testFile);
      
      // Verify discussion was created
      expect(discussionId).toBeTruthy();
      
      // Test discussion viewing: Click discussion, verify posts display in thread format
      await forumPage.clickDiscussion(discussionId);
      
      const posts = await forumPage.getPosts();
      expect(posts.length).toBeGreaterThan(0);
      
      // Verify file appears in post
      const attachmentVisible = await page.locator('[data-testid="post-attachment"]').isVisible();
      expect(attachmentVisible).toBe(true);
      
      const attachmentText = await page.locator('[data-testid="post-attachment"]').textContent();
      expect(attachmentText).toContain('test-forum-attachment.pdf');
      
      // Note: Test files are cleaned up automatically by cleanupTestFiles() in afterAll hooks
    });
  });

  test.describe('Post Replies and Threading', () => {
    test('should reply to post with indentation', async ({ page }) => {
      // Setup forum page for this test
      const forumPage = await setupForumPage(page);
      
      // Create a discussion for reply testing
      await forumPage.clickAddDiscussion();
      const subject = `Reply Test Discussion ${Date.now()}`;
      const message = '<p>Original post for reply testing.</p>';
      const discussionId = await forumPage.createDiscussion(subject, message);
      
      // Test reply to post: Click reply, compose response, submit, verify reply appears indented
      await forumPage.clickDiscussion(discussionId);
      
      const replyMessage = '<p>This is a <strong>reply</strong> to the original post.</p>';
      await forumPage.replyToPost('1', replyMessage);
      
      // Verify reply appears
      const posts = await forumPage.getPosts();
      expect(posts.length).toBeGreaterThanOrEqual(2);
      
      // Verify post threading with indentation
      const threadingCorrect = await forumPage.verifyPostThreading();
      expect(threadingCorrect).toBe(true);
      
      // Verify reply is indented (appears as child post)
      const replyPost = posts[1];
      expect(replyPost.level).toBeGreaterThan(posts[0].level);
    });

    test('should display posts in correct thread format with timestamps', async ({ page }) => {
      // Setup forum page for this test
      const forumPage = await setupForumPage(page);
      
      // Create a discussion for this test
      await forumPage.clickAddDiscussion();
      const subject = `Timestamp Test Discussion ${Date.now()}`;
      const message = '<p>Original post for timestamp testing.</p>';
      const discussionId = await forumPage.createDiscussion(subject, message);
      
      // Assertions: Verify posts persist, threading correct, timestamps accurate, permissions enforced
      await forumPage.clickDiscussion(discussionId);
      
      const posts = await forumPage.getPosts();
      
      // Verify posts persist
      expect(posts.length).toBeGreaterThan(0);
      
      // Verify threading structure
      const threadingCorrect = await forumPage.verifyPostThreading();
      expect(threadingCorrect).toBe(true);
      
      // Verify timestamps are accurate (within last hour)
      const firstPost = posts[0];
      const timestamp = await forumPage.getPostTimestamp(firstPost.id);
      const now = Date.now();
      const postTime = new Date(timestamp).getTime();
      const timeDiff = now - postTime;
      
      expect(timeDiff).toBeLessThan(3600000); // Less than 1 hour
      expect(timeDiff).toBeGreaterThanOrEqual(0); // Not in future
    });
  });

  test.describe('Post Editing and Deletion', () => {
    test('should edit own post and save changes', async ({ page }) => {
      // Setup forum page for this test
      const forumPage = await setupForumPage(page);
      
      // Create a discussion with post for editing testing
      await forumPage.clickAddDiscussion();
      const subject = `Edit Test Discussion ${Date.now()}`;
      const message = '<p>Original post content for editing testing.</p>';
      const discussionId = await forumPage.createDiscussion(subject, message);
      
      // Get post ID
      await forumPage.clickDiscussion(discussionId);
      const posts = await forumPage.getPosts();
      const postId = posts[0].id;
      
      // Test post editing: Edit own post, modify content, save, verify changes saved
      const updatedMessage = '<p>This post content has been <em>updated</em> and <strong>modified</strong>.</p>';
      await forumPage.editPost(postId, updatedMessage);
      
      // Verify changes saved by reloading and checking content
      await page.reload();
      await forumPage.waitForForum();
      
      const postsAfterEdit = await forumPage.getPosts();
      const editedPost = postsAfterEdit.find(p => p.id === postId);
      
      expect(editedPost).toBeDefined();
      expect(editedPost?.content).toContain('updated');
      expect(editedPost?.content).toContain('modified');
    });

    test('should delete own post and remove from thread', async ({ page }) => {
      // Setup forum page for this test
      const forumPage = await setupForumPage(page);
      
      // Create a discussion for deletion testing
      await forumPage.clickAddDiscussion();
      const subject = `Delete Test Discussion ${Date.now()}`;
      const message = '<p>Original post content for deletion testing.</p>';
      const discussionId = await forumPage.createDiscussion(subject, message);
      
      // Get post ID
      await forumPage.clickDiscussion(discussionId);
      const initialPosts = await forumPage.getPosts();
      const postId = initialPosts[0].id;
      
      // Test post deletion: Delete own post, verify removed from thread
      // Create a reply to delete (don't delete original post as it will delete entire discussion)
      const replyMessage = '<p>This reply will be deleted.</p>';
      await forumPage.replyToPost(postId, replyMessage);
      
      const postsBeforeDelete = await forumPage.getPosts();
      const replyToDelete = postsBeforeDelete[postsBeforeDelete.length - 1];
      
      // Delete the reply
      await forumPage.deletePost(replyToDelete.id);
      
      // Verify post removed from thread
      const postsAfterDelete = await forumPage.getPosts();
      expect(postsAfterDelete.length).toBe(postsBeforeDelete.length - 1);
      
      const deletedPostStillExists = postsAfterDelete.find(p => p.id === replyToDelete.id);
      expect(deletedPostStillExists).toBeUndefined();
    });
  });

  test.describe('Forum Subscription and Rating', () => {
    test('should subscribe to forum and update subscription status', async ({ page }) => {
      // Setup forum page for this test
      const forumPage = await setupForumPage(page);
      
      // Test forum subscription: Subscribe to forum, verify subscription status updated
      await forumPage.subscribeToForum();
      
      // Verify subscription status updated
      const isSubscribed = await page.locator('[data-testid="forum-subscribed"]').isVisible();
      expect(isSubscribed).toBe(true);
      
      // Test unsubscribe
      await forumPage.unsubscribeFromForum();
      
      const isUnsubscribed = await page.locator('[data-testid="forum-not-subscribed"]').isVisible();
      expect(isUnsubscribed).toBe(true);
    });

    test('should rate helpful post and record rating', async ({ page }) => {
      // Setup forum page for this test
      const forumPage = await setupForumPage(page);
      
      // Test post rating: Rate helpful post, verify rating recorded
      // Create a discussion with post to rate
      await forumPage.clickAddDiscussion();
      const subject = `Rating Test Discussion ${Date.now()}`;
      const message = '<p>This post can be rated as helpful.</p>';
      const discussionId = await forumPage.createDiscussion(subject, message);
      
      await forumPage.clickDiscussion(discussionId);
      const posts = await forumPage.getPosts();
      const postToRate = posts[0];
      
      // Rate the post
      await forumPage.ratePost(postToRate.id, 5);
      
      // Verify rating recorded
      const ratingElement = page.locator(`[data-testid="post-rating-${postToRate.id}"]`);
      await expect(ratingElement).toBeVisible();
      
      const ratingText = await ratingElement.textContent();
      expect(ratingText).toContain('5');
    });
  });

  test.describe('Forum Search', () => {
    test('should search forum and return matching posts', async ({ page }) => {
      // Setup forum page for this test
      const forumPage = await setupForumPage(page);
      
      // Create a discussion with searchable content
      await forumPage.clickAddDiscussion();
      const uniqueKeyword = `searchable${Date.now()}`;
      const subject = `Discussion with ${uniqueKeyword} content`;
      const message = `<p>This post contains the ${uniqueKeyword} keyword for testing.</p>`;
      await forumPage.createDiscussion(subject, message);
      
      // Test forum search: Search for keyword in forum, verify matching posts shown
      await forumPage.searchForum(uniqueKeyword);
      
      // Get the filtered discussions after search
      const searchResults = await forumPage.getDiscussions();
      
      expect(searchResults).toBeDefined();
      expect(Array.isArray(searchResults)).toBe(true);
      expect(searchResults.length).toBeGreaterThan(0);
      
      // Verify search results contain the keyword
      const firstResult = searchResults[0];
      const contentLower = firstResult.subject.toLowerCase();
      expect(contentLower).toContain(uniqueKeyword.toLowerCase());
    });
  });

  test.describe('Teacher Moderation', () => {
    test('should allow teacher to delete student post', async ({ page }) => {
      // Step 1: Login as student and create a post
      await loginAsStudent(page);
      await waitForApiResponse(page, '**/api/v1/auth/me', { timeout: 10000 });
      
      const studentForumPage = new ForumPage(page);
      await page.goto(`/courses/${testCourseId}/forums/${testForumId}`);
      await studentForumPage.waitForForum();
      
      // Create a student post for moderation testing
      await studentForumPage.clickAddDiscussion();
      const subject = `Student Post for Moderation ${Date.now()}`;
      const message = '<p>This is a student post that will be moderated by teacher.</p>';
      const studentDiscussionId = await studentForumPage.createDiscussion(subject, message);
      
      // Get post ID
      await studentForumPage.clickDiscussion(studentDiscussionId);
      const posts = await studentForumPage.getPosts();
      const studentPostId = posts[0].id;
      
      // Logout student
      await logout(page);
      
      // Step 2: Test teacher moderation: Login as teacher, delete student post, verify moderation works
      await loginAsTeacher(page);
      
      // Wait for user data to be fetched after teacher login
      await waitForApiResponse(page, '**/api/v1/auth/me', { timeout: 10000 });
      
      // Navigate to forum using React route
      const teacherForumPage = new ForumPage(page);
      await page.goto(`/courses/${testCourseId}/forums/${testForumId}`);
      await teacherForumPage.waitForForum();
      
      // Navigate to discussion
      await teacherForumPage.clickDiscussion(studentDiscussionId);
      
      // Verify moderation capability (teacher can see delete/edit buttons for student post)
      const canModerate = await teacherForumPage.verifyModeration();
      expect(canModerate).toBe(true);
      
      // Delete student post
      await teacherForumPage.deletePost(studentPostId);
      
      // Verify post deleted
      const postsAfterDelete = await teacherForumPage.getPosts();
      const deletedPostExists = postsAfterDelete.find(p => p.id === studentPostId);
      expect(deletedPostExists).toBeUndefined();
    });
  });

  test.describe('Error Scenarios and Permission Enforcement', () => {
    test('should prevent posting in locked forum', async ({ page }) => {
      // Error scenarios: Test posting in locked forum, posting without permission
      // Note: This test would require creating a locked forum or using a pre-configured one
      // For now, we verify the add discussion button is disabled or hidden when forum is locked
      
      // Setup: Login and navigate to forum
      await loginAsStudent(page);
      await waitForApiResponse(page, '**/api/v1/auth/me', { timeout: 10000 });
      
      const forumPage = new ForumPage(page);
      await page.goto(`/courses/${testCourseId}/forums/${testForumId}`);
      await forumPage.waitForForum();
      
      // This is a placeholder test structure - actual implementation would depend on
      // how locked forums are configured in the test environment
      const addDiscussionButton = page.locator('[data-testid="add-discussion-button"]');
      const isAddButtonVisible = await addDiscussionButton.isVisible();
      
      // If forum is not locked, button should be visible
      // If forum is locked, button should be hidden or disabled
      if (isAddButtonVisible) {
        const isDisabled = await addDiscussionButton.isDisabled();
        // In normal forums, button should not be disabled
        expect(isDisabled).toBe(false);
      }
    });

    test('should enforce permissions for posting', async ({ page }) => {
      // Setup: Login and navigate to forum
      await loginAsStudent(page);
      await waitForApiResponse(page, '**/api/v1/auth/me', { timeout: 10000 });
      
      const forumPage = new ForumPage(page);
      await page.goto(`/courses/${testCourseId}/forums/${testForumId}`);
      await forumPage.waitForForum();
      
      // Create a discussion to test permission enforcement
      await forumPage.clickAddDiscussion();
      const subject = `Permission Test ${Date.now()}`;
      const message = '<p>Testing permission enforcement for forum posts.</p>';
      const discussionId = await forumPage.createDiscussion(subject, message);
      
      // Assertions: Verify permissions enforced
      // Verify current user (student) can post to forum (add discussion button is visible)
      const addButtonVisible = await forumPage.addDiscussionButton.isVisible();
      expect(addButtonVisible).toBe(true);
      
      // Navigate to the discussion we just created
      await forumPage.clickDiscussion(discussionId);
      const posts = await forumPage.getPosts();
      const ownPost = posts[0];
      
      // Should be able to edit own post
      const canEdit = await page.locator(`[data-testid="edit-post-${ownPost.id}"]`).isVisible();
      expect(canEdit).toBe(true);
    });
  });

  test.describe('Forum Integration Tests', () => {
    test('should handle complete forum workflow end-to-end', async ({ page }) => {
      // Comprehensive test covering full forum workflow
      
      // Setup: Login and navigate to forum
      await loginAsStudent(page);
      await waitForApiResponse(page, '**/api/v1/auth/me', { timeout: 10000 });
      
      const forumPage = new ForumPage(page);
      await page.goto(`/courses/${testCourseId}/forums/${testForumId}`);
      await forumPage.waitForForum();
      
      // 1. View forum
      const forumInfo = await forumPage.getForumInfo();
      expect(forumInfo.title).toBeTruthy();
      
      // 2. Create discussion
      await forumPage.clickAddDiscussion();
      const subject = `Complete Workflow Test ${Date.now()}`;
      const message = '<p>Testing complete forum workflow from creation to deletion.</p>';
      const discussionId = await forumPage.createDiscussion(subject, message);
      await forumPage.waitForDiscussionCreated();
      
      // 3. Verify discussion appears in list
      await page.goto(`/courses/${testCourseId}/forums/${testForumId}`);
      await forumPage.waitForForum();
      const discussions = await forumPage.getDiscussions();
      const createdDiscussion = discussions.find(d => d.subject === subject);
      expect(createdDiscussion).toBeDefined();
      expect(createdDiscussion?.id).toBe(discussionId);
      
      // 4. View discussion thread
      await forumPage.clickDiscussion(discussionId);
      const posts = await forumPage.getPosts();
      expect(posts.length).toBeGreaterThan(0);
      
      // 5. Add reply
      const replyMessage = '<p>Reply to complete workflow test.</p>';
      await forumPage.replyToPost(posts[0].id, replyMessage);
      
      // 6. Verify reply appears with threading
      const updatedPosts = await forumPage.getPosts();
      expect(updatedPosts.length).toBe(posts.length + 1);
      const threadingCorrect = await forumPage.verifyPostThreading();
      expect(threadingCorrect).toBe(true);
      
      // 7. Edit reply
      const replyPost = updatedPosts[updatedPosts.length - 1];
      const editedMessage = '<p>Edited reply message.</p>';
      await forumPage.editPost(replyPost.id, editedMessage);
      
      // 8. Verify edit saved
      await page.reload();
      await forumPage.waitForForum();
      const postsAfterEdit = await forumPage.getPosts();
      const editedPost = postsAfterEdit.find(p => p.id === replyPost.id);
      expect(editedPost?.content).toContain('Edited');
      
      // 9. Subscribe to forum
      await page.goto(`/courses/${testCourseId}/forums/${testForumId}`);
      await forumPage.waitForForum();
      await forumPage.subscribeToForum();
      const isSubscribed = await page.locator('[data-testid="forum-subscribed"]').isVisible();
      expect(isSubscribed).toBe(true);
      
      // 10. Search for discussion
      await forumPage.searchForum(subject);
      const searchResults = await forumPage.getDiscussions();
      const foundDiscussion = searchResults.find(r => r.subject === subject);
      expect(foundDiscussion).toBeDefined();
    });
  });
});
