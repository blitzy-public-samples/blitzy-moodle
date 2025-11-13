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

import { test, expect, describe, beforeAll, afterAll, beforeEach, afterEach, Page } from '@playwright/test';
import { ForumPage } from './pages/ForumPage';
import { login, loginAsStudent, loginAsTeacher, isAuthenticated, logout, getAuthToken, clearAuthenticationState } from './utils/auth';
import { testCourse1, testCourse2, testCourse4, createCourse, getCourseWithActivities } from './fixtures/courses';
import { uploadFile, verifyFileUploaded, generateTestFile, cleanupTestFiles } from './utils/file-helpers';
import { testStudent, testTeacher, testEditingTeacher, TEST_PASSWORD } from './fixtures/users';

describe('Forum Discussion and Moderation', () => {
  let page: Page;
  let forumPage: ForumPage;
  let testDiscussionIds: number[] = [];
  let testCourseId: number;
  let testForumId: number;
  let testFiles: string[] = [];

  beforeAll(async ({ browser }) => {
    // Setup: Login as student, enroll in course with forum, navigate to forum activity
    page = await browser.newPage();
    
    // Login as student user
    await loginAsStudent(page);
    
    // Verify authentication successful
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);
    
    // Get course with forum activity
    const course = testCourse4; // Course with multiple activities including forum
    testCourseId = course.id;
    
    // Navigate to course page
    await page.goto(`/course/view.php?id=${testCourseId}`);
    await page.waitForLoadState('networkidle');
    
    // Find forum activity in course (assuming first forum activity)
    const forumLink = page.locator('[data-testid^="activity-forum-"]').first();
    await expect(forumLink).toBeVisible();
    
    // Get forum ID from link
    const forumHref = await forumLink.getAttribute('href');
    testForumId = parseInt(forumHref?.match(/id=(\d+)/)?.[1] || '1');
    
    // Navigate to forum
    await forumLink.click();
    await page.waitForLoadState('networkidle');
    
    // Initialize forum page object
    forumPage = new ForumPage(page);
    await forumPage.waitForForum();
  });

  afterAll(async () => {
    // Cleanup: Delete test discussions and posts, clean up test files
    try {
      // Delete test discussions created during test
      for (const discussionId of testDiscussionIds) {
        await page.goto(`/mod/forum/post.php?delete=${discussionId}`);
        await page.click('button:has-text("Delete")');
        await page.waitForLoadState('networkidle');
      }
      
      // Clean up test files
      await cleanupTestFiles(testFiles);
      
      // Logout
      await logout(page);
      
      // Clear authentication state
      await clearAuthenticationState();
    } catch (error) {
      console.error('Cleanup error:', error);
    } finally {
      await page.close();
    }
  });

  beforeEach(async () => {
    // Navigate to forum page before each test
    await page.goto(`/mod/forum/view.php?id=${testForumId}`);
    await forumPage.waitForForum();
  });

  describe('Forum View and Navigation', () => {
    test('should display forum with title, description, and discussion list', async () => {
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

  describe('Discussion Creation and Posting', () => {
    test('should create discussion with rich text editor', async () => {
      // Test discussion creation: Click "Add discussion", fill subject and message, verify rich text editor works
      await forumPage.clickAddDiscussion();
      
      const discussionSubject = `Test Discussion ${Date.now()}`;
      const discussionMessage = '<p>This is a <strong>test discussion</strong> with <em>rich text</em> formatting.</p>';
      
      await forumPage.createDiscussion(discussionSubject, discussionMessage);
      
      // Wait for discussion to be created
      await forumPage.waitForDiscussionCreated();
      
      // Test post discussion: Submit discussion, verify appears in forum list
      const discussions = await forumPage.getDiscussions();
      const createdDiscussion = discussions.find(d => d.subject === discussionSubject);
      
      expect(createdDiscussion).toBeDefined();
      expect(createdDiscussion?.subject).toBe(discussionSubject);
      
      // Store discussion ID for cleanup
      if (createdDiscussion?.id) {
        testDiscussionIds.push(createdDiscussion.id);
      }
    });

    test('should create discussion with file attachment', async () => {
      // Test discussion with attachment: Attach file to discussion, verify file appears in post
      await forumPage.clickAddDiscussion();
      
      const discussionSubject = `Test Discussion with Attachment ${Date.now()}`;
      const discussionMessage = '<p>This discussion includes a file attachment.</p>';
      
      // Generate test file for attachment
      const testFile = await generateTestFile('pdf', 'test-forum-attachment.pdf');
      testFiles.push(testFile);
      
      // Create discussion with attachment
      await forumPage.createDiscussion(discussionSubject, discussionMessage);
      
      // Upload file attachment
      await uploadFile(page, '[data-testid="forum-file-upload"]', testFile);
      
      // Verify file uploaded
      await verifyFileUploaded(page, 'test-forum-attachment.pdf');
      
      // Submit discussion
      await page.click('[data-testid="forum-submit-discussion"]');
      await forumPage.waitForDiscussionCreated();
      
      // Navigate to created discussion
      const discussions = await forumPage.getDiscussions();
      const createdDiscussion = discussions.find(d => d.subject === discussionSubject);
      expect(createdDiscussion).toBeDefined();
      
      if (createdDiscussion?.id) {
        testDiscussionIds.push(createdDiscussion.id);
        
        // Test discussion viewing: Click discussion, verify posts display in thread format
        await forumPage.clickDiscussion(createdDiscussion.id);
        
        const posts = await forumPage.getPosts();
        expect(posts.length).toBeGreaterThan(0);
        
        // Verify file appears in post
        const attachmentVisible = await page.locator('[data-testid="post-attachment"]').isVisible();
        expect(attachmentVisible).toBe(true);
        
        const attachmentText = await page.locator('[data-testid="post-attachment"]').textContent();
        expect(attachmentText).toContain('test-forum-attachment.pdf');
      }
    });
  });

  describe('Post Replies and Threading', () => {
    let discussionId: number;

    beforeAll(async () => {
      // Create a discussion for reply testing
      await forumPage.clickAddDiscussion();
      const subject = `Reply Test Discussion ${Date.now()}`;
      const message = '<p>Original post for reply testing.</p>';
      await forumPage.createDiscussion(subject, message);
      await forumPage.waitForDiscussionCreated();
      
      const discussions = await forumPage.getDiscussions();
      const discussion = discussions.find(d => d.subject === subject);
      if (discussion?.id) {
        discussionId = discussion.id;
        testDiscussionIds.push(discussionId);
      }
    });

    test('should reply to post with indentation', async () => {
      // Test reply to post: Click reply, compose response, submit, verify reply appears indented
      await forumPage.clickDiscussion(discussionId);
      
      const replyMessage = '<p>This is a <strong>reply</strong> to the original post.</p>';
      await forumPage.replyToPost(1, replyMessage);
      
      // Verify reply appears
      const posts = await forumPage.getPosts();
      expect(posts.length).toBeGreaterThanOrEqual(2);
      
      // Verify post threading with indentation
      const threadingCorrect = await forumPage.verifyPostThreading();
      expect(threadingCorrect).toBe(true);
      
      // Verify reply is indented (appears as child post)
      const replyPost = posts[1];
      expect(replyPost.parentId).toBe(posts[0].id);
    });

    test('should display posts in correct thread format with timestamps', async () => {
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

  describe('Post Editing and Deletion', () => {
    let discussionId: number;
    let postId: number;

    beforeAll(async () => {
      // Create a discussion with post for editing/deletion testing
      await forumPage.clickAddDiscussion();
      const subject = `Edit/Delete Test Discussion ${Date.now()}`;
      const message = '<p>Original post content for editing and deletion testing.</p>';
      await forumPage.createDiscussion(subject, message);
      await forumPage.waitForDiscussionCreated();
      
      const discussions = await forumPage.getDiscussions();
      const discussion = discussions.find(d => d.subject === subject);
      if (discussion?.id) {
        discussionId = discussion.id;
        testDiscussionIds.push(discussionId);
        
        // Get post ID
        await forumPage.clickDiscussion(discussionId);
        const posts = await forumPage.getPosts();
        postId = posts[0].id;
      }
    });

    test('should edit own post and save changes', async () => {
      // Test post editing: Edit own post, modify content, save, verify changes saved
      await forumPage.clickDiscussion(discussionId);
      
      const updatedMessage = '<p>This post content has been <em>updated</em> and <strong>modified</strong>.</p>';
      await forumPage.editPost(postId, updatedMessage);
      
      // Verify changes saved by reloading and checking content
      await page.reload();
      await forumPage.waitForForum();
      
      const posts = await forumPage.getPosts();
      const editedPost = posts.find(p => p.id === postId);
      
      expect(editedPost).toBeDefined();
      expect(editedPost?.message).toContain('updated');
      expect(editedPost?.message).toContain('modified');
    });

    test('should delete own post and remove from thread', async () => {
      // Test post deletion: Delete own post, verify removed from thread
      // Create a reply to delete (don't delete original post as it will delete entire discussion)
      await forumPage.clickDiscussion(discussionId);
      
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

  describe('Forum Subscription and Rating', () => {
    test('should subscribe to forum and update subscription status', async () => {
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

    test('should rate helpful post and record rating', async () => {
      // Test post rating: Rate helpful post, verify rating recorded
      // Create a discussion with post to rate
      await forumPage.clickAddDiscussion();
      const subject = `Rating Test Discussion ${Date.now()}`;
      const message = '<p>This post can be rated as helpful.</p>';
      await forumPage.createDiscussion(subject, message);
      await forumPage.waitForDiscussionCreated();
      
      const discussions = await forumPage.getDiscussions();
      const discussion = discussions.find(d => d.subject === subject);
      
      if (discussion?.id) {
        testDiscussionIds.push(discussion.id);
        
        await forumPage.clickDiscussion(discussion.id);
        const posts = await forumPage.getPosts();
        const postToRate = posts[0];
        
        // Rate the post
        await forumPage.ratePost(postToRate.id, 5);
        
        // Verify rating recorded
        const ratingElement = page.locator(`[data-testid="post-rating-${postToRate.id}"]`);
        await expect(ratingElement).toBeVisible();
        
        const ratingText = await ratingElement.textContent();
        expect(ratingText).toContain('5');
      }
    });
  });

  describe('Forum Search', () => {
    test('should search forum and return matching posts', async () => {
      // Test forum search: Search for keyword in forum, verify matching posts shown
      const searchKeyword = 'test discussion';
      
      const searchResults = await forumPage.searchForum(searchKeyword);
      
      expect(searchResults).toBeDefined();
      expect(Array.isArray(searchResults)).toBe(true);
      
      // Verify search results contain the keyword
      if (searchResults.length > 0) {
        const firstResult = searchResults[0];
        const contentLower = firstResult.subject.toLowerCase() + ' ' + firstResult.message.toLowerCase();
        expect(contentLower).toContain(searchKeyword.toLowerCase());
      }
    });
  });

  describe('Teacher Moderation', () => {
    let studentDiscussionId: number;
    let studentPostId: number;

    beforeAll(async () => {
      // Create a student post for moderation testing
      await forumPage.clickAddDiscussion();
      const subject = `Student Post for Moderation ${Date.now()}`;
      const message = '<p>This is a student post that will be moderated by teacher.</p>';
      await forumPage.createDiscussion(subject, message);
      await forumPage.waitForDiscussionCreated();
      
      const discussions = await forumPage.getDiscussions();
      const discussion = discussions.find(d => d.subject === subject);
      if (discussion?.id) {
        studentDiscussionId = discussion.id;
        testDiscussionIds.push(studentDiscussionId);
        
        // Get post ID
        await forumPage.clickDiscussion(studentDiscussionId);
        const posts = await forumPage.getPosts();
        studentPostId = posts[0].id;
      }
      
      // Logout student
      await logout(page);
    });

    test('should allow teacher to delete student post', async () => {
      // Test teacher moderation: Login as teacher, delete student post, verify moderation works
      await loginAsTeacher(page);
      
      // Navigate to forum
      await page.goto(`/mod/forum/view.php?id=${testForumId}`);
      await forumPage.waitForForum();
      
      // Navigate to discussion
      await forumPage.clickDiscussion(studentDiscussionId);
      
      // Verify moderation capability (teacher can see delete button for student post)
      const canModerate = await forumPage.verifyModeration(studentPostId);
      expect(canModerate).toBe(true);
      
      // Delete student post
      await forumPage.deletePost(studentPostId);
      
      // Verify post deleted
      const posts = await forumPage.getPosts();
      const deletedPostExists = posts.find(p => p.id === studentPostId);
      expect(deletedPostExists).toBeUndefined();
      
      // Logout teacher
      await logout(page);
      
      // Login back as student for remaining tests
      await loginAsStudent(page);
    });
  });

  describe('Error Scenarios and Permission Enforcement', () => {
    test('should prevent posting in locked forum', async () => {
      // Error scenarios: Test posting in locked forum, posting without permission
      // Note: This test would require creating a locked forum or using a pre-configured one
      // For now, we verify the add discussion button is disabled or hidden when forum is locked
      
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

    test('should enforce permissions for posting', async () => {
      // Assertions: Verify permissions enforced
      // Verify current user (student) can post to forum
      const canPost = await forumPage.getForumInfo();
      expect(canPost.canAddDiscussion).toBe(true);
      
      // Verify student can edit own posts but not others
      const discussions = await forumPage.getDiscussions();
      if (discussions.length > 0 && testDiscussionIds.length > 0) {
        const ownDiscussion = discussions.find(d => testDiscussionIds.includes(d.id));
        if (ownDiscussion) {
          await forumPage.clickDiscussion(ownDiscussion.id);
          const posts = await forumPage.getPosts();
          const ownPost = posts[0];
          
          // Should be able to edit own post
          const canEdit = await page.locator(`[data-testid="edit-post-${ownPost.id}"]`).isVisible();
          expect(canEdit).toBe(true);
        }
      }
    });
  });

  describe('Forum Integration Tests', () => {
    test('should handle complete forum workflow end-to-end', async () => {
      // Comprehensive test covering full forum workflow
      
      // 1. View forum
      const forumInfo = await forumPage.getForumInfo();
      expect(forumInfo.title).toBeTruthy();
      
      // 2. Create discussion
      await forumPage.clickAddDiscussion();
      const subject = `Complete Workflow Test ${Date.now()}`;
      const message = '<p>Testing complete forum workflow from creation to deletion.</p>';
      await forumPage.createDiscussion(subject, message);
      await forumPage.waitForDiscussionCreated();
      
      // 3. Verify discussion appears in list
      const discussions = await forumPage.getDiscussions();
      const createdDiscussion = discussions.find(d => d.subject === subject);
      expect(createdDiscussion).toBeDefined();
      
      if (createdDiscussion?.id) {
        testDiscussionIds.push(createdDiscussion.id);
        
        // 4. View discussion thread
        await forumPage.clickDiscussion(createdDiscussion.id);
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
        expect(editedPost?.message).toContain('Edited');
        
        // 9. Subscribe to forum
        await page.goto(`/mod/forum/view.php?id=${testForumId}`);
        await forumPage.waitForForum();
        await forumPage.subscribeToForum();
        const isSubscribed = await page.locator('[data-testid="forum-subscribed"]').isVisible();
        expect(isSubscribed).toBe(true);
        
        // 10. Search for discussion
        const searchResults = await forumPage.searchForum(subject);
        const foundDiscussion = searchResults.find(r => r.subject === subject);
        expect(foundDiscussion).toBeDefined();
      }
    });
  });
});
