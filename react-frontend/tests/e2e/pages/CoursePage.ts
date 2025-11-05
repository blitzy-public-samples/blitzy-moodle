import { type Page, type Locator } from '@playwright/test';

/**
 * Interface representing course information displayed on the course detail page
 */
export interface CourseInfo {
  /** Course title displayed in the header */
  title: string;
  /** Course description or summary text */
  description: string;
  /** Name of the course instructor/teacher */
  instructor: string;
  /** Whether the current user is enrolled in this course */
  enrollmentStatus: boolean;
  /** Optional course completion progress percentage (0-100) */
  progress?: number;
  /** Optional URL to the course image/banner */
  imageUrl?: string;
}

/**
 * Interface representing an activity within a course section
 */
export interface CourseActivity {
  /** Unique identifier for the activity */
  activityId: string;
  /** Type of activity (e.g., 'assignment', 'quiz', 'forum', 'resource') */
  activityType: string;
  /** Display name of the activity */
  name: string;
  /** Whether the activity has been completed by the user */
  completed?: boolean;
  /** Optional date when the activity becomes available */
  availableFrom?: Date;
  /** Optional date when the activity is no longer available */
  availableUntil?: Date;
}

/**
 * Interface representing a course section containing activities
 */
export interface CourseSection {
  /** Section number (e.g., 0 for general section, 1+ for numbered sections) */
  sectionNumber: number;
  /** Display name of the section */
  sectionName: string;
  /** List of activities contained in this section */
  activities: CourseActivity[];
  /** Whether the section is currently expanded in the UI */
  isExpanded: boolean;
}

/**
 * Page Object Model for the Course Detail page
 * 
 * Encapsulates all UI elements and interactions for the course detail view,
 * including course information, enrollment status, sections, activities,
 * and navigation. Used by E2E tests to interact with course pages in a
 * maintainable and type-safe manner.
 * 
 * @example
 * ```typescript
 * const coursePage = new CoursePage(page);
 * await coursePage.waitForCourse();
 * const courseInfo = await coursePage.getCourseInfo();
 * const isEnrolled = await coursePage.isEnrolled();
 * if (!isEnrolled) {
 *   await coursePage.clickEnroll();
 * }
 * const sections = await coursePage.getSections();
 * await coursePage.clickActivity('123', 'assignment');
 * ```
 */
export class CoursePage {
  private readonly page: Page;
  
  // Primary course information locators
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
   * @param page - Playwright Page object for browser interactions
   */
  constructor(page: Page) {
    this.page = page;
    
    // Initialize locators using Playwright's recommended selectors
    // Using data-testid attributes for reliable element identification
    this.courseTitle = page.locator('[data-testid="course-title"]');
    this.courseDescription = page.locator('[data-testid="course-description"]');
    this.enrollButton = page.locator('[data-testid="enroll-button"]');
    this.courseImage = page.locator('[data-testid="course-image"]');
    this.sectionList = page.locator('[data-testid="course-sections"]');
    this.activityList = page.locator('[data-testid="activity-list"]');
    this.courseProgress = page.locator('[data-testid="course-progress"]');
    this.unenrollButton = page.locator('[data-testid="unenroll-button"]');
    this.courseTabs = page.locator('[data-testid="course-tabs"]');
  }

  /**
   * Waits for the course page to fully load
   * 
   * Ensures that critical course elements are visible and interactive
   * before proceeding with test actions. Uses Playwright's automatic
   * waiting mechanisms with a reasonable timeout.
   * 
   * @throws {Error} If the course page does not load within timeout
   */
  async waitForCourse(): Promise<void> {
    // Wait for the course title to be visible as primary indicator of page load
    await this.courseTitle.waitFor({ state: 'visible', timeout: 10000 });
    
    // Wait for course sections container to ensure content is loaded
    await this.sectionList.waitFor({ state: 'visible', timeout: 10000 });
    
    // Additional wait for network idle to ensure all async data is loaded
    await this.page.waitForLoadState('networkidle', { timeout: 15000 });
  }

  /**
   * Extracts and returns comprehensive course information
   * 
   * Retrieves all visible course details including title, description,
   * instructor information, enrollment status, and progress metrics.
   * 
   * @returns Promise resolving to CourseInfo object with course details
   * @throws {Error} If required elements are not found or data cannot be extracted
   */
  async getCourseInfo(): Promise<CourseInfo> {
    // Extract course title
    const title = await this.courseTitle.textContent() || '';
    
    // Extract course description
    const description = await this.courseDescription.textContent() || '';
    
    // Extract instructor name from instructor element
    const instructorElement = this.page.locator('[data-testid="course-instructor"]');
    const instructor = await instructorElement.textContent() || 'Unknown';
    
    // Determine enrollment status by checking for enrolled badge or unenroll button
    const enrollmentStatus = await this.isEnrolled();
    
    // Extract progress if available
    let progress: number | undefined;
    try {
      const progressText = await this.courseProgress.getAttribute('aria-valuenow');
      if (progressText) {
        progress = parseInt(progressText, 10);
      }
    } catch {
      // Progress not available for this course or user
      progress = undefined;
    }
    
    // Extract course image URL if available
    let imageUrl: string | undefined;
    try {
      imageUrl = await this.courseImage.getAttribute('src') || undefined;
    } catch {
      // Course image not available
      imageUrl = undefined;
    }
    
    return {
      title: title.trim(),
      description: description.trim(),
      instructor: instructor.trim(),
      enrollmentStatus,
      progress,
      imageUrl,
    };
  }

  /**
   * Checks whether the current user is enrolled in the course
   * 
   * Determines enrollment status by checking for the presence of
   * enrollment indicators (enrolled badge, unenroll button) or
   * absence of enroll button.
   * 
   * @returns Promise resolving to true if user is enrolled, false otherwise
   */
  async isEnrolled(): Promise<boolean> {
    // Check if enrolled badge is visible
    const enrolledBadge = this.page.locator('[data-testid="enrolled-badge"]');
    const badgeVisible = await enrolledBadge.isVisible().catch(() => false);
    
    if (badgeVisible) {
      return true;
    }
    
    // Check if unenroll button is visible (indicates enrollment)
    const unenrollVisible = await this.unenrollButton.isVisible().catch(() => false);
    
    if (unenrollVisible) {
      return true;
    }
    
    // Check if enroll button is NOT visible (may indicate already enrolled)
    const enrollVisible = await this.enrollButton.isVisible().catch(() => false);
    
    // If enroll button is not visible, user might be enrolled
    return !enrollVisible;
  }

  /**
   * Clicks the enrollment button to enroll in the course
   * 
   * Initiates the enrollment process by clicking the enroll button
   * and waits for the enrollment action to complete. This may trigger
   * a confirmation dialog or redirect to enrollment options.
   * 
   * @throws {Error} If enroll button is not visible or clickable
   */
  async clickEnroll(): Promise<void> {
    // Ensure the enroll button is visible and enabled
    await this.enrollButton.waitFor({ state: 'visible', timeout: 5000 });
    
    // Click the enroll button
    await this.enrollButton.click();
    
    // Wait for enrollment to process (may show confirmation or redirect)
    await this.page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Wait a brief moment for UI updates
    await this.page.waitForTimeout(1000);
  }

  /**
   * Navigates to the unenrollment interface
   * 
   * Clicks the unenroll button to begin the unenrollment process.
   * This typically opens a confirmation dialog or navigates to
   * an unenrollment page.
   * 
   * @throws {Error} If unenroll button is not visible (user not enrolled)
   */
  async clickUnenroll(): Promise<void> {
    // Ensure the unenroll button is visible
    await this.unenrollButton.waitFor({ state: 'visible', timeout: 5000 });
    
    // Click the unenroll button
    await this.unenrollButton.click();
    
    // Wait for navigation or modal to appear
    await this.page.waitForLoadState('networkidle', { timeout: 10000 });
  }

  /**
   * Retrieves all course sections with their activities
   * 
   * Extracts a structured list of all course sections, including
   * section metadata and nested activity information. Useful for
   * verifying course structure and navigating to specific sections.
   * 
   * @returns Promise resolving to array of CourseSection objects
   */
  async getSections(): Promise<CourseSection[]> {
    const sections: CourseSection[] = [];
    
    // Find all section elements
    const sectionElements = await this.sectionList.locator('[data-testid^="section-"]').all();
    
    for (const sectionElement of sectionElements) {
      // Extract section number from data attribute
      const sectionNumberStr = await sectionElement.getAttribute('data-section-number');
      const sectionNumber = sectionNumberStr ? parseInt(sectionNumberStr, 10) : 0;
      
      // Extract section name
      const sectionNameElement = sectionElement.locator('[data-testid="section-name"]');
      const sectionName = await sectionNameElement.textContent() || `Section ${sectionNumber}`;
      
      // Check if section is expanded
      const expandedAttr = await sectionElement.getAttribute('data-expanded');
      const isExpanded = expandedAttr === 'true';
      
      // Extract activities within this section
      const activityElements = await sectionElement.locator('[data-testid^="activity-"]').all();
      const activities: CourseActivity[] = [];
      
      for (const activityElement of activityElements) {
        const activityId = await activityElement.getAttribute('data-activity-id') || '';
        const activityType = await activityElement.getAttribute('data-activity-type') || '';
        const nameElement = activityElement.locator('[data-testid="activity-name"]');
        const name = await nameElement.textContent() || '';
        
        // Check if activity is completed
        const completedAttr = await activityElement.getAttribute('data-completed');
        const completed = completedAttr === 'true';
        
        activities.push({
          activityId,
          activityType,
          name: name.trim(),
          completed,
        });
      }
      
      sections.push({
        sectionNumber,
        sectionName: sectionName.trim(),
        activities,
        isExpanded,
      });
    }
    
    return sections;
  }

  /**
   * Retrieves all activities across all course sections
   * 
   * Provides a flattened list of all activities in the course,
   * regardless of section organization. Useful for searching
   * specific activities or verifying activity presence.
   * 
   * @returns Promise resolving to array of CourseActivity objects
   */
  async getActivities(): Promise<CourseActivity[]> {
    const activities: CourseActivity[] = [];
    
    // Find all activity elements across all sections
    const activityElements = await this.activityList.locator('[data-testid^="activity-"]').all();
    
    for (const activityElement of activityElements) {
      const activityId = await activityElement.getAttribute('data-activity-id') || '';
      const activityType = await activityElement.getAttribute('data-activity-type') || '';
      const nameElement = activityElement.locator('[data-testid="activity-name"]');
      const name = await nameElement.textContent() || '';
      
      // Check completion status
      const completedAttr = await activityElement.getAttribute('data-completed');
      const completed = completedAttr === 'true';
      
      // Extract availability dates if present
      let availableFrom: Date | undefined;
      let availableUntil: Date | undefined;
      
      try {
        const availableFromStr = await activityElement.getAttribute('data-available-from');
        if (availableFromStr) {
          availableFrom = new Date(availableFromStr);
        }
      } catch {
        availableFrom = undefined;
      }
      
      try {
        const availableUntilStr = await activityElement.getAttribute('data-available-until');
        if (availableUntilStr) {
          availableUntil = new Date(availableUntilStr);
        }
      } catch {
        availableUntil = undefined;
      }
      
      activities.push({
        activityId,
        activityType,
        name: name.trim(),
        completed,
        availableFrom,
        availableUntil,
      });
    }
    
    return activities;
  }

  /**
   * Clicks on a specific activity to navigate to its detail page
   * 
   * Locates the activity by ID and type, then clicks it to navigate
   * to the activity detail page (e.g., assignment view, quiz page).
   * Waits for navigation to complete before returning.
   * 
   * @param activityId - Unique identifier of the activity
   * @param activityType - Type of activity (e.g., 'assignment', 'quiz')
   * @throws {Error} If activity is not found or not clickable
   */
  async clickActivity(activityId: string, activityType: string): Promise<void> {
    // Construct specific locator for the activity
    const activityLocator = this.page.locator(
      `[data-testid="activity-${activityId}"][data-activity-type="${activityType}"]`
    );
    
    // Ensure activity is visible
    await activityLocator.waitFor({ state: 'visible', timeout: 5000 });
    
    // Click the activity
    await activityLocator.click();
    
    // Wait for navigation to activity page
    await this.page.waitForLoadState('networkidle', { timeout: 10000 });
  }

  /**
   * Expands a collapsed course section to show its activities
   * 
   * Locates the section by number and expands it if currently collapsed.
   * Waits for the expansion animation to complete and activities to
   * become visible.
   * 
   * @param sectionNumber - Section number to expand (0 for general section)
   * @throws {Error} If section is not found
   */
  async expandSection(sectionNumber: number): Promise<void> {
    // Locate the section by number
    const sectionLocator = this.page.locator(`[data-testid="section-${sectionNumber}"]`);
    
    // Check if section is already expanded
    const expandedAttr = await sectionLocator.getAttribute('data-expanded');
    const isExpanded = expandedAttr === 'true';
    
    if (!isExpanded) {
      // Find and click the expand button/toggle
      const expandButton = sectionLocator.locator('[data-testid="section-toggle"]');
      await expandButton.waitFor({ state: 'visible', timeout: 5000 });
      await expandButton.click();
      
      // Wait for expansion animation
      await this.page.waitForTimeout(500);
      
      // Verify section is now expanded
      await sectionLocator.waitFor({ state: 'visible', timeout: 5000 });
    }
  }

  /**
   * Collapses an expanded course section to hide its activities
   * 
   * Locates the section by number and collapses it if currently expanded.
   * Waits for the collapse animation to complete.
   * 
   * @param sectionNumber - Section number to collapse
   * @throws {Error} If section is not found
   */
  async collapseSection(sectionNumber: number): Promise<void> {
    // Locate the section by number
    const sectionLocator = this.page.locator(`[data-testid="section-${sectionNumber}"]`);
    
    // Check if section is already collapsed
    const expandedAttr = await sectionLocator.getAttribute('data-expanded');
    const isExpanded = expandedAttr === 'true';
    
    if (isExpanded) {
      // Find and click the collapse button/toggle
      const collapseButton = sectionLocator.locator('[data-testid="section-toggle"]');
      await collapseButton.waitFor({ state: 'visible', timeout: 5000 });
      await collapseButton.click();
      
      // Wait for collapse animation
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Retrieves the user's course completion progress percentage
   * 
   * Extracts the completion percentage from the progress indicator.
   * Returns undefined if progress tracking is not enabled for the course
   * or the user.
   * 
   * @returns Promise resolving to progress percentage (0-100) or undefined
   */
  async getCourseProgress(): Promise<number | undefined> {
    try {
      // Check if progress element is visible
      const progressVisible = await this.courseProgress.isVisible();
      
      if (!progressVisible) {
        return undefined;
      }
      
      // Extract progress value from ARIA attribute
      const progressValue = await this.courseProgress.getAttribute('aria-valuenow');
      
      if (progressValue) {
        const progress = parseInt(progressValue, 10);
        // Validate progress is within expected range
        return isNaN(progress) ? undefined : Math.max(0, Math.min(100, progress));
      }
      
      return undefined;
    } catch {
      // Progress not available
      return undefined;
    }
  }

  /**
   * Verifies that the enrollment badge is displayed correctly
   * 
   * Checks for the presence and visibility of the enrollment badge,
   * which indicates the user's enrollment status in the course.
   * Useful for post-enrollment verification in tests.
   * 
   * @returns Promise resolving to true if badge is visible, false otherwise
   */
  async verifyEnrollmentBadge(): Promise<boolean> {
    try {
      const enrolledBadge = this.page.locator('[data-testid="enrolled-badge"]');
      const isVisible = await enrolledBadge.isVisible({ timeout: 5000 });
      
      if (isVisible) {
        // Verify badge text contains enrollment indicator
        const badgeText = await enrolledBadge.textContent();
        return badgeText?.toLowerCase().includes('enrolled') || false;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Switches between different course tabs (e.g., Content, Participants, Grades)
   * 
   * Navigates to different course views by clicking the specified tab.
   * Waits for the tab content to load before returning.
   * 
   * @param tabName - Name of the tab to switch to (e.g., 'Content', 'Participants', 'Grades')
   * @throws {Error} If tab is not found or not clickable
   */
  async switchTab(tabName: string): Promise<void> {
    // Locate the tab by its accessible name
    const tabLocator = this.courseTabs.locator(`[role="tab"][aria-label="${tabName}"]`);
    
    // Alternative: locate by text content if aria-label not available
    const tabByText = this.courseTabs.locator(`[role="tab"]:has-text("${tabName}")`);
    
    // Try to find tab by aria-label first, fall back to text
    let targetTab: Locator;
    const hasAriaLabel = await tabLocator.count() > 0;
    
    if (hasAriaLabel) {
      targetTab = tabLocator;
    } else {
      targetTab = tabByText;
    }
    
    // Ensure tab is visible
    await targetTab.waitFor({ state: 'visible', timeout: 5000 });
    
    // Check if tab is already selected
    const isSelected = await targetTab.getAttribute('aria-selected');
    
    if (isSelected !== 'true') {
      // Click the tab to switch
      await targetTab.click();
      
      // Wait for tab content to load
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Additional wait for content rendering
      await this.page.waitForTimeout(500);
    }
  }
}
