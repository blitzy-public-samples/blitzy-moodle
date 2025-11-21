/**
 * Page Object Model for Forum Discussion Interface
 * 
 * Encapsulates selectors and interactions for forum view, discussion list,
 * discussion creation, post display, reply functionality, post editing/deletion,
 * forum subscription, post rating, and forum search capabilities.
 * 
 * @package react-frontend
 * @copyright 2024 Moodle React Frontend
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { type Locator, type Page } from '@playwright/test';

/**
 * Interface representing forum information
 */
export interface ForumInfo {
  title: string;
  description: string;
}

/**
 * Interface representing a forum discussion
 */
export interface Discussion {
  id: string;
  subject: string;
  author: string;
  replies: number;
  lastPost: string;
  pinned?: boolean;
}

/**
 * Interface representing a forum post
 */
export interface Post {
  id: string;
  author: string;
  subject: string;
  content: string;
  timestamp: string;
  level: number;
  attachments?: string[];
  rating?: number;
}

/**
 * Page Object Model for Forum Discussion Interface
 * 
 * Provides methods for interacting with forum features including:
 * - Viewing forum information
 * - Creating and managing discussions
 * - Posting and replying to discussions
 * - Editing and deleting posts
 * - Subscribing to forums
 * - Rating posts
 * - Searching forum content
 */
export class ForumPage {
  readonly page: Page;

  // Forum information locators
  readonly forumTitle: Locator;
  readonly forumDescription: Locator;

  // Discussion list locators
  readonly discussionList: Locator;
  readonly addDiscussionButton: Locator;

  // Discussion creation form locators
  readonly discussionSubjectInput: Locator;
  readonly discussionMessageEditor: Locator;
  readonly attachmentUpload: Locator;
  readonly postButton: Locator;

  // Discussion thread locators
  readonly discussionThread: Locator;
  readonly replyButton: Locator;
  readonly postContent: Locator;

  // Post management locators
  readonly editPostButton: Locator;
  readonly deletePostButton: Locator;

  // Forum subscription locators
  readonly subscribeButton: Locator;

  // Post rating locators
  readonly ratingWidget: Locator;

  // Search locators
  readonly searchInput: Locator;

  /**
   * Constructor for ForumPage
   * 
   * @param page - Playwright Page object
   */
  constructor(page: Page) {
    this.page = page;

    // Initialize forum information locators
    this.forumTitle = page.locator('[data-testid="forum-title"], h1.forum-title, .forum-header h1');
    this.forumDescription = page.locator('[data-testid="forum-description"], .forum-description, .forum-intro');

    // Initialize discussion list locators
    this.discussionList = page.locator('[data-testid="discussion-list"], .discussion-list, .forum-discussions');
    this.addDiscussionButton = page.locator(
      '[data-testid="add-discussion-button"], button:has-text("Add discussion"), button:has-text("Add a new discussion")'
    );

    // Initialize discussion creation form locators
    this.discussionSubjectInput = page.locator(
      '[data-testid="discussion-subject"], input[name="subject"], #id_subject'
    );
    this.discussionMessageEditor = page.locator(
      '[data-testid="discussion-message"], [data-testid="message-editor"], textarea[name="message"], #id_message'
    );
    this.attachmentUpload = page.locator(
      '[data-testid="attachment-upload"], input[type="file"][name="attachment"], #id_attachment'
    );
    this.postButton = page.locator(
      '[data-testid="post-button"], button:has-text("Post to forum"), button[type="submit"]:has-text("Post")'
    );

    // Initialize discussion thread locators
    this.discussionThread = page.locator('[data-testid="discussion-thread"], .discussion-thread, .forum-posts');
    this.replyButton = page.locator('[data-testid="reply-button"], button:has-text("Reply")');
    this.postContent = page.locator('[data-testid="post-content"], .post-content, .forum-post-message');

    // Initialize post management locators
    this.editPostButton = page.locator('[data-testid="edit-post-button"], button:has-text("Edit")');
    this.deletePostButton = page.locator('[data-testid="delete-post-button"], button:has-text("Delete")');

    // Initialize forum subscription locators
    this.subscribeButton = page.locator(
      '[data-testid="subscribe-button"], button:has-text("Subscribe"), button:has-text("Unsubscribe")'
    );

    // Initialize post rating locators
    this.ratingWidget = page.locator('[data-testid="rating-widget"], .rating-widget, .forum-rating');

    // Initialize search locators
    this.searchInput = page.locator(
      '[data-testid="forum-search"], input[placeholder*="Search"], input[name="search"]'
    );
  }

  /**
   * Wait for the forum page to fully load
   * 
   * @throws Error if forum page fails to load within timeout
   */
  async waitForForum(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.forumTitle.waitFor({ state: 'visible', timeout: 10000 });
    await this.discussionList.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Extract forum title and description
   * 
   * @returns Forum information object containing title and description
   */
  async getForumInfo(): Promise<ForumInfo> {
    await this.forumTitle.waitFor({ state: 'visible' });
    
    const title = await this.forumTitle.textContent() || '';
    const description = await this.forumDescription.textContent() || '';

    return {
      title: title.trim(),
      description: description.trim(),
    };
  }

  /**
   * Get list of discussions in the forum
   * 
   * @returns Array of discussion objects
   */
  async getDiscussions(): Promise<Discussion[]> {
    await this.discussionList.waitFor({ state: 'visible' });
    
    const discussionElements = await this.page.locator(
      '[data-testid="discussion-item"], .discussion-item, .forum-discussion'
    ).all();

    const discussions: Discussion[] = [];

    for (const element of discussionElements) {
      const id = await element.getAttribute('data-discussion-id') || 
                 await element.getAttribute('id') || 
                 `discussion-${discussions.length}`;
      
      const subjectElement = element.locator('.discussion-subject, .discussion-title, h3, h4').first();
      const subject = await subjectElement.textContent() || '';
      
      const authorElement = element.locator('.discussion-author, .author-name, .posted-by').first();
      const author = await authorElement.textContent() || 'Unknown';
      
      const repliesElement = element.locator('.discussion-replies, .reply-count').first();
      const repliesText = await repliesElement.textContent();
      const replies = repliesText ? parseInt(repliesText.match(/\d+/)?.[0] || '0', 10) : 0;
      
      const lastPostElement = element.locator('.discussion-lastpost, .last-post-time').first();
      const lastPost = await lastPostElement.textContent() || '';
      
      const pinnedElement = element.locator('.discussion-pinned, .pinned-icon').first();
      const pinned = await pinnedElement.count() > 0;

      discussions.push({
        id: id.trim(),
        subject: subject.trim(),
        author: author.trim(),
        replies,
        lastPost: lastPost.trim(),
        pinned,
      });
    }

    return discussions;
  }

  /**
   * Click the "Add discussion" button to open the discussion creation form
   */
  async clickAddDiscussion(): Promise<void> {
    await this.addDiscussionButton.waitFor({ state: 'visible' });
    await this.addDiscussionButton.click();
    
    // Wait for the form to appear
    await this.discussionSubjectInput.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Create a new discussion with subject, message, and optional attachment
   * 
   * @param subject - Discussion subject/title
   * @param message - Discussion message content
   * @param attachment - Optional file path for attachment
   * @returns The ID of the newly created discussion
   */
  async createDiscussion(subject: string, message: string, attachment?: string): Promise<string> {
    // Fill in the subject
    await this.discussionSubjectInput.waitFor({ state: 'visible' });
    await this.discussionSubjectInput.fill(subject);

    // Fill in the message
    await this.discussionMessageEditor.waitFor({ state: 'visible' });
    await this.discussionMessageEditor.fill(message);

    // Upload attachment if provided
    if (attachment) {
      // Note: The file input has display:none, so we wait for 'attached' not 'visible'
      await this.attachmentUpload.waitFor({ state: 'attached' });
      await this.attachmentUpload.setInputFiles(attachment);
      
      // Wait for upload confirmation (if any)
      await this.page.waitForTimeout(1000);
    }

    // Submit the form
    await this.postButton.waitFor({ state: 'visible' });
    await this.postButton.click();
    
    // Wait for discussion to be created and get its ID
    const discussionId = await this.waitForDiscussionCreated();
    return discussionId;
  }

  /**
   * Click on a specific discussion to open the discussion thread
   * 
   * @param discussionId - ID of the discussion to open
   */
  async clickDiscussion(discussionId: string): Promise<void> {
    const discussionLink = this.page.locator(
      `[data-discussion-id="${discussionId}"] a, #${discussionId} a, [data-testid="discussion-${discussionId}"] a`
    ).first();
    
    await discussionLink.waitFor({ state: 'visible' });
    await discussionLink.click();
    
    // Wait for discussion thread to load
    await this.discussionThread.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Get all posts in the current discussion thread
   * 
   * @returns Array of post objects with content and metadata
   */
  async getPosts(): Promise<Post[]> {
    await this.discussionThread.waitFor({ state: 'visible' });
    
    const postElements = await this.page.locator(
      '[data-testid="forum-post"], .forum-post, .discussion-post'
    ).all();

    const posts: Post[] = [];

    for (const element of postElements) {
      const id = await element.getAttribute('data-post-id') || 
                 await element.getAttribute('id') || 
                 `post-${posts.length}`;
      
      const authorElement = element.locator('.post-author, .author-name').first();
      const author = await authorElement.textContent() || 'Unknown';
      
      const subjectElement = element.locator('.post-subject, .post-title, h4').first();
      const subject = await subjectElement.textContent() || '';
      
      const contentElement = element.locator('.post-content, .post-message').first();
      const content = await contentElement.textContent() || '';
      
      const timestampElement = element.locator('.post-timestamp, .post-time, time').first();
      const timestamp = await timestampElement.textContent() || '';
      
      // Determine post level (indentation) for threading
      const levelAttr = await element.getAttribute('data-level');
      const level = levelAttr ? parseInt(levelAttr, 10) : 0;
      
      // Get attachments if present
      const attachmentElements = await element.locator('.post-attachment, .attachment-item').all();
      const attachments: string[] = [];
      for (const attachmentElement of attachmentElements) {
        const attachmentName = await attachmentElement.textContent();
        if (attachmentName) {
          attachments.push(attachmentName.trim());
        }
      }
      
      // Get rating if present
      const ratingElement = element.locator('.post-rating, [data-rating]').first();
      const ratingText = await ratingElement.textContent();
      const rating = ratingText ? parseInt(ratingText.match(/\d+/)?.[0] || '0', 10) : undefined;

      posts.push({
        id: id.trim(),
        author: author.trim(),
        subject: subject.trim(),
        content: content.trim(),
        timestamp: timestamp.trim(),
        level,
        attachments: attachments.length > 0 ? attachments : undefined,
        rating,
      });
    }

    return posts;
  }

  /**
   * Reply to a specific post with message and optional attachment
   * 
   * @param postId - ID of the post to reply to
   * @param message - Reply message content
   * @param attachment - Optional file path for attachment
   */
  async replyToPost(postId: string, message: string, attachment?: string): Promise<void> {
    // Find and click the reply button for the specific post
    const postReplyButton = this.page.locator(
      `[data-post-id="${postId}"] [data-testid="reply-button"], #${postId} button:has-text("Reply")`
    ).first();
    
    await postReplyButton.waitFor({ state: 'visible' });
    await postReplyButton.click();

    // Wait for reply form to appear
    const replyEditor = this.page.locator(
      `[data-post-id="${postId}"] [data-testid="reply-editor"], [data-testid="reply-message-editor"], textarea[name="message"]`
    ).first();
    await replyEditor.waitFor({ state: 'visible', timeout: 5000 });

    // Fill in the reply message
    await replyEditor.fill(message);

    // Upload attachment if provided
    if (attachment) {
      const replyAttachmentUpload = this.page.locator(
        `[data-post-id="${postId}"] input[type="file"], input[type="file"][name="attachment"]`
      ).first();
      await replyAttachmentUpload.waitFor({ state: 'visible' });
      await replyAttachmentUpload.setInputFiles(attachment);
      
      // Wait for upload confirmation
      await this.page.waitForTimeout(1000);
    }

    // Submit the reply
    const submitReplyButton = this.page.locator(
      `[data-post-id="${postId}"] [data-testid="submit-reply-button"], button:has-text("Post reply"), button[type="submit"]:has-text("Post")`
    ).first();
    await submitReplyButton.waitFor({ state: 'visible' });
    await submitReplyButton.click();
  }

  /**
   * Edit an existing post with new message content
   * 
   * @param postId - ID of the post to edit
   * @param newMessage - New message content
   */
  async editPost(postId: string, newMessage: string): Promise<void> {
    // Find and click the edit button for the specific post
    const postEditButton = this.page.locator(
      `[data-post-id="${postId}"] [data-testid="edit-post-button"], #${postId} button:has-text("Edit")`
    ).first();
    
    await postEditButton.waitFor({ state: 'visible' });
    await postEditButton.click();

    // Wait for edit form to appear
    const editEditor = this.page.locator(
      `[data-post-id="${postId}"] [data-testid="edit-editor"], textarea[name="message"]`
    ).first();
    await editEditor.waitFor({ state: 'visible', timeout: 5000 });

    // Clear and fill in the new message
    await editEditor.fill('');
    await editEditor.fill(newMessage);

    // Submit the edit
    const submitEditButton = this.page.locator(
      `[data-post-id="${postId}"] [data-testid="submit-edit-button"], button:has-text("Save changes"), button[type="submit"]:has-text("Save")`
    ).first();
    await submitEditButton.waitFor({ state: 'visible' });
    await submitEditButton.click();

    // Wait for edit to be processed
    await this.page.waitForTimeout(1000);
  }

  /**
   * Delete a specific post
   * 
   * @param postId - ID of the post to delete
   */
  async deletePost(postId: string): Promise<void> {
    // Find and click the delete button for the specific post
    const postDeleteButton = this.page.locator(
      `[data-post-id="${postId}"] [data-testid="delete-post-button"], #${postId} button:has-text("Delete")`
    ).first();
    
    await postDeleteButton.waitFor({ state: 'visible' });
    await postDeleteButton.click();

    // Wait for confirmation dialog
    const confirmDeleteButton = this.page.locator(
      '[data-testid="confirm-delete-button"], button:has-text("Delete"), button:has-text("Confirm")'
    ).first();
    
    await confirmDeleteButton.waitFor({ state: 'visible', timeout: 5000 });
    await confirmDeleteButton.click();

    // Wait for deletion to be processed
    await this.page.waitForTimeout(1000);
  }

  /**
   * Subscribe to the current forum
   */
  async subscribeToForum(): Promise<void> {
    await this.subscribeButton.waitFor({ state: 'visible' });
    
    // Check if already subscribed
    const buttonText = await this.subscribeButton.textContent();
    
    if (buttonText && buttonText.toLowerCase().includes('subscribe') && 
        !buttonText.toLowerCase().includes('unsubscribe')) {
      await this.subscribeButton.click();
      
      // Wait for subscription confirmation
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Unsubscribe from the current forum
   */
  async unsubscribeFromForum(): Promise<void> {
    await this.subscribeButton.waitFor({ state: 'visible' });
    
    // Check if subscribed
    const buttonText = await this.subscribeButton.textContent();
    
    if (buttonText && buttonText.toLowerCase().includes('unsubscribe')) {
      await this.subscribeButton.click();
      
      // Wait for unsubscription confirmation
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Rate a specific post
   * 
   * @param postId - ID of the post to rate
   * @param rating - Rating value (typically 1-5)
   */
  async ratePost(postId: string, rating: number): Promise<void> {
    // Find the rating widget for the specific post
    const postRatingWidget = this.page.locator(
      `[data-post-id="${postId}"] [data-testid="rating-widget"], #${postId} .rating-widget`
    ).first();
    
    await postRatingWidget.waitFor({ state: 'visible' });

    // Find and click the specific rating star/button
    const ratingButton = postRatingWidget.locator(
      `[data-rating="${rating}"], button[aria-label*="${rating}"], .rating-star:nth-child(${rating})`
    ).first();
    
    await ratingButton.click();

    // Wait for rating to be processed
    await this.page.waitForTimeout(1000);
  }

  /**
   * Search forum content using the search input
   * 
   * @param query - Search query string
   */
  async searchForum(query: string): Promise<void> {
    await this.searchInput.waitFor({ state: 'visible' });
    await this.searchInput.fill(query);
    
    // Press Enter or click search button
    await this.searchInput.press('Enter');
    
    // Wait for search results to load
    await this.page.waitForLoadState('networkidle');
    await this.discussionList.waitFor({ state: 'visible' });
  }

  /**
   * Verify that post threading (indentation) is displayed correctly
   * 
   * @returns True if post threading is properly rendered
   */
  async verifyPostThreading(): Promise<boolean> {
    const posts = await this.getPosts();
    
    if (posts.length === 0) {
      return false;
    }

    // Check if posts have varying levels (indicating threading)
    const levels = posts.map(post => post.level);
    const hasMultipleLevels = new Set(levels).size > 1;
    
    // Verify visual indentation by checking CSS classes or attributes
    const threadedPosts = await this.page.locator('[data-level], .post-level-1, .post-level-2').count();
    
    return hasMultipleLevels || threadedPosts > 0;
  }

  /**
   * Get the timestamp of a specific post
   * 
   * @param postId - ID of the post
   * @returns Post timestamp string
   */
  async getPostTimestamp(postId: string): Promise<string> {
    const timestampElement = this.page.locator(
      `[data-post-id="${postId}"] .post-timestamp, #${postId} .post-time, [data-post-id="${postId}"] time`
    ).first();
    
    await timestampElement.waitFor({ state: 'visible' });
    const timestamp = await timestampElement.textContent();
    
    return timestamp ? timestamp.trim() : '';
  }

  /**
   * Wait for discussion creation success confirmation
   */
  async waitForDiscussionCreated(): Promise<string> {
    // After creating a discussion, the app navigates to the discussion detail page
    // Wait for the URL to change to the discussion detail page
    await this.page.waitForURL(/\/discussions\/\d+/, { timeout: 10000 });
    
    // Ensure page has fully loaded
    await this.page.waitForLoadState('networkidle');
    
    // Extract discussionId from the current URL
    const currentUrl = this.page.url();
    const discussionMatch = currentUrl.match(/\/discussions\/(\d+)/);
    const discussionId = discussionMatch ? discussionMatch[1]! : '';
    
    // Extract courseId and forumId from the current URL and navigate back to forum list
    const urlMatch = currentUrl.match(/\/courses\/(\d+)\/forums\/(\d+)/);
    
    if (urlMatch) {
      // Navigate back to the forum list page using browser history
      // This triggers client-side navigation via React Router instead of a full page reload
      // which preserves the MSW worker state and avoids race conditions
      await this.page.goBack();
      await this.page.waitForLoadState('networkidle');
      await this.waitForForum();
      
      // Wait for the newly created discussion to appear in the list
      if (discussionId) {
        await this.page.locator(`[data-discussion-id="${discussionId}"]`).waitFor({ 
          state: 'visible', 
          timeout: 5000 
        });
      }
    }
    
    return discussionId;
  }

  /**
   * Verify that moderation controls are visible for moderators
   * 
   * @returns True if moderation controls are present and visible
   */
  async verifyModeration(): Promise<boolean> {
    // Check for moderation controls
    const moderationControls = [
      this.editPostButton,
      this.deletePostButton,
      this.page.locator('[data-testid="pin-discussion"], button:has-text("Pin")'),
      this.page.locator('[data-testid="lock-discussion"], button:has-text("Lock")'),
      this.page.locator('[data-testid="move-discussion"], button:has-text("Move")'),
    ];

    let visibleControls = 0;
    
    for (const control of moderationControls) {
      const count = await control.count();
      if (count > 0) {
        try {
          await control.first().waitFor({ state: 'visible', timeout: 2000 });
          visibleControls++;
        } catch {
          // Control not visible, continue checking others
        }
      }
    }

    // Return true if at least 2 moderation controls are visible
    return visibleControls >= 2;
  }
}
