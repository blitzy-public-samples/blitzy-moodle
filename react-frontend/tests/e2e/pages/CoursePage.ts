/**
 * Page Object Model for Course Detail View
 * 
 * Encapsulates selectors and interactions for the course detail page,
 * including course information, sections, activities, and enrollment actions.
 * 
 * @module tests/e2e/pages/CoursePage
 */

import { Page, Locator } from '@playwright/test';

/**
 * Interface representing course information displayed on the course page
 */
export interface CourseInfo {
  /** Course title/name */
  title: string;
  /** Course description text */
  description: string;
  /** Course instructor/teacher name */
  instructor: string;
  /** Whether the user is currently enrolled */
  enrollmentStatus: boolean;
  /** Course completion progress percentage (0-100) */
  progress?: number;
  /** URL to the course image */
  imageUrl?: string;
}

/**
 * Interface representing a course activity/module
 */
export interface CourseActivity {
  /** Unique identifier for the activity */
  activityId: string;
  /** Type of activity (e.g., 'assignment', 'quiz', 'forum') */
  activityType: string;
  /** Display name of the activity */
  name: string;
  /** Whether the activity has been completed by the user */
  completed?: boolean;
  /** Date when the activity becomes available */
  availableFrom?: Date;
  /** Date when the activity is no longer available */
  availableUntil?: Date;
}

/**
 * Interface representing a course section containing activities
 */
export interface CourseSection {
  /** Section number (0-based or 1-based depending on course format) */
  sectionNumber: number;
  /** Display name of the section */
  sectionName: string;
  /** List of activities within this section */
  activities: CourseActivity[];
  /** Whether the section is currently expanded in the UI */
  isExpanded: boolean;
}

/**
 * Page Object Model for the Course Detail Page
 * 
 * Provides methods to interact with course detail view including:
 * - Viewing course information
 * - Managing enrollment status
 * - Navigating course sections and activities
 * - Checking course progress
 * - Switching between course tabs
 */
export class CoursePage {
  /** Playwright page instance */
  private readonly page: Page;

  // Locators for course page elements
  private readonly courseTitle: Locator;
  private readonly courseDescription: Locator;
  private readonly enrollButton: Locator;
  private readonly courseImage: Locator;
  private readonly sectionList: Locator;
  private readonly activityList: Locator;
  private readonly courseProgress: Locator;
  private readonly unenrollButton: Locator;
  private readonly courseTabs: Locator;

  /**
   * Creates a new CoursePage instance
   * 
   * @param page - Playwright Page object
   */
  constructor(page: Page) {
    this.page = page;

    // Initialize locators with semantic selectors
    this.courseTitle = page.locator('[data-testid="course-title"], h1.course-title, .course-header h1');
    this.courseDescription = page.locator('[data-testid="course-description"], .course-description, .course-summary');
    this.enrollButton = page.locator('[data-testid="enroll-button"], button:has-text("Enroll"), a:has-text("Enroll")');
    this.courseImage = page.locator('[data-testid="course-image"], .course-image img, .course-header img');
    this.sectionList = page.locator('[data-testid="course-sections"], .course-sections, .course-content');
    this.activityList = page.locator('[data-testid="activity-list"], .activity-list, .section-activities');
    this.courseProgress = page.locator('[data-testid="course-progress"], .course-progress, .progress-bar');
    this.unenrollButton = page.locator('[data-testid="unenroll-button"], button:has-text("Unenroll"), a:has-text("Unenroll")');
    this.courseTabs = page.locator('[data-testid="course-tabs"], .course-tabs, [role="tablist"]');
  }

  /**
   * Wait for the course page to fully load
   * 
   * Waits for the course title and main content to be visible,
   * ensuring the page is ready for interaction.
   * 
   * @param timeout - Maximum wait time in milliseconds (default: 30000)
   * @throws Error if course page doesn't load within timeout
   */
  async waitForCourse(timeout: number = 30000): Promise<void> {
    try {
      await this.courseTitle.waitFor({ state: 'visible', timeout });
      await this.sectionList.waitFor({ state: 'visible', timeout });
    } catch (error) {
      throw new Error(`Course page failed to load within ${timeout}ms: ${error}`);
    }
  }

  /**
   * Extract course information from the page
   * 
   * Retrieves the course title, description, instructor name,
   * enrollment status, progress, and image URL.
   * 
   * @returns Promise resolving to CourseInfo object
   * @throws Error if required course information is not found
   */
  async getCourseInfo(): Promise<CourseInfo> {
    try {
      const title = await this.courseTitle.textContent() || '';
      const description = await this.courseDescription.textContent() || '';
      
      // Extract instructor from course metadata
      const instructorLocator = this.page.locator('[data-testid="course-instructor"], .course-instructor, .instructor-name');
      const instructor = await instructorLocator.textContent() || 'Unknown';
      
      // Check enrollment status
      const enrollmentStatus = await this.isEnrolled();
      
      // Extract progress if available
      let progress: number | undefined;
      if (await this.courseProgress.isVisible()) {
        const progressText = await this.courseProgress.getAttribute('aria-valuenow') || 
                           await this.courseProgress.getAttribute('data-progress') ||
                           await this.courseProgress.textContent() || '0';
        progress = parseInt(progressText.replace(/[^0-9]/g, ''), 10);
      }
      
      // Extract image URL if available
      let imageUrl: string | undefined;
      if (await this.courseImage.isVisible()) {
        imageUrl = await this.courseImage.getAttribute('src') || undefined;
      }

      return {
        title: title.trim(),
        description: description.trim(),
        instructor: instructor.trim(),
        enrollmentStatus,
        progress,
        imageUrl,
      };
    } catch (error) {
      throw new Error(`Failed to extract course information: ${error}`);
    }
  }

  /**
   * Check if the user is enrolled in the course
   * 
   * Determines enrollment status by checking for enrollment badge,
   * the presence of an unenroll button, or absence of enroll button.
   * 
   * @returns Promise resolving to true if enrolled, false otherwise
   */
  async isEnrolled(): Promise<boolean> {
    try {
      // Check for enrollment badge
      const enrolledBadge = this.page.locator('[data-testid="enrolled-badge"], .enrolled-badge, .enrollment-status:has-text("Enrolled")');
      if (await enrolledBadge.isVisible()) {
        return true;
      }

      // Check if unenroll button is visible (indicates enrollment)
      if (await this.unenrollButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        return true;
      }

      // Check if enroll button is NOT visible (might indicate enrollment)
      const enrollVisible = await this.enrollButton.isVisible({ timeout: 1000 }).catch(() => false);
      
      // If enroll button is not visible and we're on the course page, likely enrolled
      return !enrollVisible;
    } catch (error) {
      // Default to false if unable to determine enrollment status
      return false;
    }
  }

  /**
   * Click the enroll button to enroll in the course
   * 
   * Waits for the enroll button to be visible and clickable,
   * then performs the click action.
   * 
   * @throws Error if enroll button is not found or not clickable
   */
  async clickEnroll(): Promise<void> {
    try {
      await this.enrollButton.waitFor({ state: 'visible', timeout: 5000 });
      await this.enrollButton.click();
      
      // Wait for enrollment to complete (button should disappear or change)
      await this.page.waitForTimeout(1000);
    } catch (error) {
      throw new Error(`Failed to click enroll button: ${error}`);
    }
  }

  /**
   * Navigate to unenrollment flow
   * 
   * Clicks the unenroll button to begin the unenrollment process.
   * 
   * @throws Error if unenroll button is not found or not clickable
   */
  async clickUnenroll(): Promise<void> {
    try {
      await this.unenrollButton.waitFor({ state: 'visible', timeout: 5000 });
      await this.unenrollButton.click();
      
      // Wait for navigation or modal to appear
      await this.page.waitForTimeout(1000);
    } catch (error) {
      throw new Error(`Failed to click unenroll button: ${error}`);
    }
  }

  /**
   * Get list of course sections
   * 
   * Retrieves all visible course sections with their metadata
   * including section names, activities, and expansion state.
   * 
   * @returns Promise resolving to array of CourseSection objects
   */
  async getSections(): Promise<CourseSection[]> {
    try {
      const sections: CourseSection[] = [];
      
      // Find all section elements
      const sectionElements = await this.page.locator('[data-testid="course-section"], .course-section, .section').all();
      
      for (let i = 0; i < sectionElements.length; i++) {
        const sectionElement = sectionElements[i];
        
        // Extract section number
        const sectionNumberAttr = await sectionElement.getAttribute('data-section-number') || 
                                  await sectionElement.getAttribute('data-section') || 
                                  String(i);
        const sectionNumber = parseInt(sectionNumberAttr, 10);
        
        // Extract section name
        const sectionNameLocator = sectionElement.locator('.section-title, .section-name, h3, h2').first();
        const sectionName = await sectionNameLocator.textContent() || `Section ${sectionNumber}`;
        
        // Check if section is expanded
        const isExpanded = await sectionElement.getAttribute('data-expanded') === 'true' ||
                          await sectionElement.getAttribute('aria-expanded') === 'true' ||
                          !await sectionElement.locator('.section-content').isHidden();
        
        // Get activities in this section
        const activities = await this.getActivitiesInSection(sectionElement);
        
        sections.push({
          sectionNumber,
          sectionName: sectionName.trim(),
          activities,
          isExpanded,
        });
      }
      
      return sections;
    } catch (error) {
      throw new Error(`Failed to retrieve course sections: ${error}`);
    }
  }

  /**
   * Get activities within a specific section element
   * 
   * @param sectionElement - Locator for the section element
   * @returns Promise resolving to array of CourseActivity objects
   * @private
   */
  private async getActivitiesInSection(sectionElement: Locator): Promise<CourseActivity[]> {
    const activities: CourseActivity[] = [];
    
    const activityElements = await sectionElement.locator('[data-testid="activity"], .activity, .activity-item').all();
    
    for (const activityElement of activityElements) {
      const activityId = await activityElement.getAttribute('data-activity-id') || 
                        await activityElement.getAttribute('data-id') || 
                        '';
      
      const activityType = await activityElement.getAttribute('data-activity-type') ||
                          await activityElement.getAttribute('data-type') ||
                          'unknown';
      
      const nameLocator = activityElement.locator('.activity-name, .activity-title, a').first();
      const name = await nameLocator.textContent() || 'Unnamed Activity';
      
      // Check completion status
      const completed = await activityElement.getAttribute('data-completed') === 'true' ||
                       await activityElement.locator('.completion-icon.completed').isVisible().catch(() => false);
      
      // Extract availability dates if present
      const availableFromAttr = await activityElement.getAttribute('data-available-from');
      const availableUntilAttr = await activityElement.getAttribute('data-available-until');
      
      activities.push({
        activityId,
        activityType,
        name: name.trim(),
        completed,
        availableFrom: availableFromAttr ? new Date(availableFromAttr) : undefined,
        availableUntil: availableUntilAttr ? new Date(availableUntilAttr) : undefined,
      });
    }
    
    return activities;
  }

  /**
   * Get all activities across all course sections
   * 
   * @returns Promise resolving to flat array of all CourseActivity objects
   */
  async getActivities(): Promise<CourseActivity[]> {
    try {
      const sections = await this.getSections();
      const allActivities: CourseActivity[] = [];
      
      for (const section of sections) {
        allActivities.push(...section.activities);
      }
      
      return allActivities;
    } catch (error) {
      throw new Error(`Failed to retrieve course activities: ${error}`);
    }
  }

  /**
   * Click on a specific activity to navigate to it
   * 
   * @param activityId - Unique identifier of the activity
   * @param activityType - Type of activity (e.g., 'assignment', 'quiz')
   * @throws Error if activity is not found
   */
  async clickActivity(activityId: string, activityType: string): Promise<void> {
    try {
      // Try multiple selector strategies
      const activityLocator = this.page.locator(
        `[data-activity-id="${activityId}"], ` +
        `[data-id="${activityId}"], ` +
        `[data-activity-id="${activityId}"][data-activity-type="${activityType}"]`
      ).first();
      
      await activityLocator.waitFor({ state: 'visible', timeout: 5000 });
      
      // Click the activity link within the element
      const linkLocator = activityLocator.locator('a').first();
      await linkLocator.click();
      
      // Wait for navigation
      await this.page.waitForLoadState('domcontentloaded');
    } catch (error) {
      throw new Error(`Failed to click activity ${activityId} (${activityType}): ${error}`);
    }
  }

  /**
   * Expand a course section to show its contents
   * 
   * @param sectionNumber - Number of the section to expand
   * @throws Error if section is not found
   */
  async expandSection(sectionNumber: number): Promise<void> {
    try {
      const sectionLocator = this.page.locator(
        `[data-section-number="${sectionNumber}"], ` +
        `[data-section="${sectionNumber}"]`
      ).first();
      
      await sectionLocator.waitFor({ state: 'visible', timeout: 5000 });
      
      // Check if already expanded
      const isExpanded = await sectionLocator.getAttribute('data-expanded') === 'true' ||
                        await sectionLocator.getAttribute('aria-expanded') === 'true';
      
      if (!isExpanded) {
        // Click the section header or expand button
        const expandButton = sectionLocator.locator('.section-toggle, .expand-button, .section-title').first();
        await expandButton.click();
        
        // Wait for expansion animation
        await this.page.waitForTimeout(300);
      }
    } catch (error) {
      throw new Error(`Failed to expand section ${sectionNumber}: ${error}`);
    }
  }

  /**
   * Collapse a course section to hide its contents
   * 
   * @param sectionNumber - Number of the section to collapse
   * @throws Error if section is not found
   */
  async collapseSection(sectionNumber: number): Promise<void> {
    try {
      const sectionLocator = this.page.locator(
        `[data-section-number="${sectionNumber}"], ` +
        `[data-section="${sectionNumber}"]`
      ).first();
      
      await sectionLocator.waitFor({ state: 'visible', timeout: 5000 });
      
      // Check if already collapsed
      const isExpanded = await sectionLocator.getAttribute('data-expanded') === 'true' ||
                        await sectionLocator.getAttribute('aria-expanded') === 'true';
      
      if (isExpanded) {
        // Click the section header or collapse button
        const collapseButton = sectionLocator.locator('.section-toggle, .collapse-button, .section-title').first();
        await collapseButton.click();
        
        // Wait for collapse animation
        await this.page.waitForTimeout(300);
      }
    } catch (error) {
      throw new Error(`Failed to collapse section ${sectionNumber}: ${error}`);
    }
  }

  /**
   * Get the course completion progress percentage
   * 
   * @returns Promise resolving to progress percentage (0-100), or null if not available
   */
  async getCourseProgress(): Promise<number | null> {
    try {
      if (!await this.courseProgress.isVisible({ timeout: 2000 }).catch(() => false)) {
        return null;
      }
      
      // Try multiple methods to extract progress
      const progressValue = await this.courseProgress.getAttribute('aria-valuenow') ||
                           await this.courseProgress.getAttribute('data-progress') ||
                           await this.courseProgress.getAttribute('value');
      
      if (progressValue) {
        return parseInt(progressValue, 10);
      }
      
      // Try to extract from text content
      const progressText = await this.courseProgress.textContent() || '0';
      const matches = progressText.match(/(\d+)%?/);
      if (matches && matches[1]) {
        return parseInt(matches[1], 10);
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify that the enrollment badge is displayed
   * 
   * Checks for the presence and visibility of an enrollment status indicator.
   * 
   * @returns Promise resolving to true if enrollment badge is visible
   */
  async verifyEnrollmentBadge(): Promise<boolean> {
    try {
      const enrolledBadge = this.page.locator(
        '[data-testid="enrolled-badge"], ' +
        '.enrolled-badge, ' +
        '.enrollment-status:has-text("Enrolled"), ' +
        '[aria-label*="Enrolled"]'
      );
      
      return await enrolledBadge.isVisible({ timeout: 3000 }).catch(() => false);
    } catch (error) {
      return false;
    }
  }

  /**
   * Switch to a different tab in the course interface
   * 
   * @param tabName - Name of the tab to switch to (e.g., 'Overview', 'Participants', 'Grades')
   * @throws Error if tab is not found
   */
  async switchTab(tabName: string): Promise<void> {
    try {
      await this.courseTabs.waitFor({ state: 'visible', timeout: 5000 });
      
      // Find the tab by text or aria-label
      const tabLocator = this.courseTabs.locator(
        `button:has-text("${tabName}"), ` +
        `a:has-text("${tabName}"), ` +
        `[role="tab"]:has-text("${tabName}"), ` +
        `[aria-label="${tabName}"]`
      ).first();
      
      await tabLocator.waitFor({ state: 'visible', timeout: 3000 });
      await tabLocator.click();
      
      // Wait for tab content to load
      await this.page.waitForTimeout(500);
    } catch (error) {
      throw new Error(`Failed to switch to tab "${tabName}": ${error}`);
    }
  }
}
