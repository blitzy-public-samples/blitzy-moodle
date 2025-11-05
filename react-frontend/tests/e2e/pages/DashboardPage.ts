import { Page, Locator } from '@playwright/test';

/**
 * Interface representing a calendar event on the dashboard
 */
export interface CalendarEvent {
  eventId: string;
  title: string;
  date: Date;
  type: string;
  courseId?: string;
  courseName?: string;
  url?: string;
  description?: string;
}

/**
 * Interface representing a timeline activity item
 */
export interface TimelineItem {
  itemId: string;
  type: string;
  activityType: string;
  title: string;
  courseName: string;
  courseId: string;
  dueDate?: Date;
  timestamp: Date;
  iconUrl?: string;
  url: string;
  isOverdue?: boolean;
}

/**
 * Interface representing a recent activity item
 */
export interface ActivityItem {
  activityId: string;
  type: string;
  description: string;
  courseName: string;
  courseId: string;
  timestamp: Date;
  userFullName?: string;
  userId?: string;
  url?: string;
}

/**
 * Interface representing an online user
 */
export interface OnlineUser {
  userId: string;
  fullName: string;
  profileImageUrl: string;
  lastAccess: Date;
  isOnline: boolean;
}

/**
 * Interface representing a course overview card
 */
export interface CourseOverview {
  courseId: string;
  courseName: string;
  courseImageUrl?: string;
  progress: number;
  totalActivities: number;
  completedActivities: number;
  upcomingDeadlines: number;
  lastAccessed?: Date;
  instructorName?: string;
  url: string;
}

/**
 * Page Object Model for the user dashboard interface
 * Encapsulates all dashboard widgets and their interactions
 */
export class DashboardPage {
  private readonly page: Page;
  private readonly calendarWidget: Locator;
  private readonly timelineWidget: Locator;
  private readonly upcomingEventsWidget: Locator;
  private readonly recentActivityWidget: Locator;
  private readonly onlineUsersWidget: Locator;
  private readonly courseOverviewWidget: Locator;
  private readonly widgetCustomizeButton: Locator;
  private readonly notificationBadge: Locator;

  /**
   * Initialize the DashboardPage with locators for all widgets
   */
  constructor(page: Page) {
    this.page = page;
    
    // Initialize locators for dashboard widgets using data-testid attributes
    this.calendarWidget = page.locator('[data-testid="calendar-widget"]');
    this.timelineWidget = page.locator('[data-testid="timeline-widget"]');
    this.upcomingEventsWidget = page.locator('[data-testid="upcoming-events-widget"]');
    this.recentActivityWidget = page.locator('[data-testid="recent-activity-widget"]');
    this.onlineUsersWidget = page.locator('[data-testid="online-users-widget"]');
    this.courseOverviewWidget = page.locator('[data-testid="course-overview-widget"]');
    this.widgetCustomizeButton = page.locator('[data-testid="widget-customize-button"]');
    this.notificationBadge = page.locator('[data-testid="notification-badge"]');
  }

  /**
   * Wait for dashboard to load completely with all widgets
   * Ensures all async widget data has been fetched
   */
  async waitForDashboard(): Promise<void> {
    // Wait for the main dashboard container to be visible
    await this.page.waitForSelector('[data-testid="dashboard-container"]', { 
      state: 'visible',
      timeout: 10000 
    });
    
    // Wait for at least one widget to be rendered
    await this.page.waitForSelector('[data-testid*="widget"]', { 
      state: 'visible',
      timeout: 5000 
    });
    
    // Wait for all network requests to complete (widget data loading)
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Extract calendar event data from the calendar widget
   * @returns Array of calendar events with all details
   */
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    await this.calendarWidget.waitFor({ state: 'visible' });
    
    const eventElements = this.calendarWidget.locator('[data-testid="calendar-event"]');
    const count = await eventElements.count();
    const events: CalendarEvent[] = [];

    for (let i = 0; i < count; i++) {
      const eventElement = eventElements.nth(i);
      
      const eventId = await eventElement.getAttribute('data-event-id') || '';
      const title = await eventElement.locator('[data-testid="event-title"]').textContent() || '';
      const dateStr = await eventElement.getAttribute('data-event-date') || '';
      const type = await eventElement.getAttribute('data-event-type') || '';
      const courseId = await eventElement.getAttribute('data-course-id') || undefined;
      const courseName = await eventElement.locator('[data-testid="event-course"]').textContent() || undefined;
      const url = await eventElement.getAttribute('href') || undefined;
      const description = await eventElement.locator('[data-testid="event-description"]').textContent() || undefined;

      events.push({
        eventId,
        title,
        date: new Date(dateStr),
        type,
        courseId,
        courseName,
        url,
        description
      });
    }

    return events;
  }

  /**
   * Navigate calendar to next or previous month
   * @param direction - 'next' or 'previous' month navigation
   */
  async navigateCalendarMonth(direction: 'next' | 'previous'): Promise<void> {
    await this.calendarWidget.waitFor({ state: 'visible' });
    
    const navigationButton = direction === 'next'
      ? this.calendarWidget.locator('[data-testid="calendar-next-month"]')
      : this.calendarWidget.locator('[data-testid="calendar-previous-month"]');
    
    await navigationButton.click();
    
    // Wait for calendar to re-render with new month data
    await this.page.waitForTimeout(500);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Extract timeline activity items showing upcoming and recent activities
   * @returns Array of timeline items with due dates and metadata
   */
  async getTimelineItems(): Promise<TimelineItem[]> {
    await this.timelineWidget.waitFor({ state: 'visible' });
    
    const itemElements = this.timelineWidget.locator('[data-testid="timeline-item"]');
    const count = await itemElements.count();
    const items: TimelineItem[] = [];

    for (let i = 0; i < count; i++) {
      const itemElement = itemElements.nth(i);
      
      const itemId = await itemElement.getAttribute('data-item-id') || '';
      const type = await itemElement.getAttribute('data-item-type') || '';
      const activityType = await itemElement.getAttribute('data-activity-type') || '';
      const title = await itemElement.locator('[data-testid="timeline-title"]').textContent() || '';
      const courseName = await itemElement.locator('[data-testid="timeline-course"]').textContent() || '';
      const courseId = await itemElement.getAttribute('data-course-id') || '';
      const dueDateStr = await itemElement.getAttribute('data-due-date') || undefined;
      const timestampStr = await itemElement.getAttribute('data-timestamp') || '';
      const iconUrl = await itemElement.locator('[data-testid="timeline-icon"]').getAttribute('src') || undefined;
      const url = await itemElement.locator('[data-testid="timeline-link"]').getAttribute('href') || '';
      const isOverdue = await itemElement.getAttribute('data-overdue') === 'true';

      items.push({
        itemId,
        type,
        activityType,
        title,
        courseName,
        courseId,
        dueDate: dueDateStr ? new Date(dueDateStr) : undefined,
        timestamp: new Date(timestampStr),
        iconUrl,
        url,
        isOverdue
      });
    }

    return items;
  }

  /**
   * Filter timeline by specific activity type (assignment, quiz, forum, etc.)
   * @param activityType - The activity type to filter by
   */
  async filterTimelineByType(activityType: string): Promise<void> {
    await this.timelineWidget.waitFor({ state: 'visible' });
    
    const filterDropdown = this.timelineWidget.locator('[data-testid="timeline-filter"]');
    await filterDropdown.click();
    
    const filterOption = this.page.locator(`[data-testid="timeline-filter-option"][data-value="${activityType}"]`);
    await filterOption.click();
    
    // Wait for filtered results to load
    await this.page.waitForTimeout(300);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Extract recent activity feed showing latest actions across all courses
   * @returns Array of activity items with user and course information
   */
  async getRecentActivity(): Promise<ActivityItem[]> {
    await this.recentActivityWidget.waitFor({ state: 'visible' });
    
    const activityElements = this.recentActivityWidget.locator('[data-testid="activity-item"]');
    const count = await activityElements.count();
    const activities: ActivityItem[] = [];

    for (let i = 0; i < count; i++) {
      const activityElement = activityElements.nth(i);
      
      const activityId = await activityElement.getAttribute('data-activity-id') || '';
      const type = await activityElement.getAttribute('data-activity-type') || '';
      const description = await activityElement.locator('[data-testid="activity-description"]').textContent() || '';
      const courseName = await activityElement.locator('[data-testid="activity-course"]').textContent() || '';
      const courseId = await activityElement.getAttribute('data-course-id') || '';
      const timestampStr = await activityElement.getAttribute('data-timestamp') || '';
      const userFullName = await activityElement.locator('[data-testid="activity-user"]').textContent() || undefined;
      const userId = await activityElement.getAttribute('data-user-id') || undefined;
      const url = await activityElement.locator('[data-testid="activity-link"]').getAttribute('href') || undefined;

      activities.push({
        activityId,
        type,
        description,
        courseName,
        courseId,
        timestamp: new Date(timestampStr),
        userFullName,
        userId,
        url
      });
    }

    return activities;
  }

  /**
   * Get list of currently online users
   * @returns Array of online users with profile information
   */
  async getOnlineUsers(): Promise<OnlineUser[]> {
    await this.onlineUsersWidget.waitFor({ state: 'visible' });
    
    const userElements = this.onlineUsersWidget.locator('[data-testid="online-user"]');
    const count = await userElements.count();
    const users: OnlineUser[] = [];

    for (let i = 0; i < count; i++) {
      const userElement = userElements.nth(i);
      
      const userId = await userElement.getAttribute('data-user-id') || '';
      const fullName = await userElement.locator('[data-testid="user-name"]').textContent() || '';
      const profileImageUrl = await userElement.locator('[data-testid="user-avatar"]').getAttribute('src') || '';
      const lastAccessStr = await userElement.getAttribute('data-last-access') || '';
      const isOnline = await userElement.getAttribute('data-is-online') === 'true';

      users.push({
        userId,
        fullName,
        profileImageUrl,
        lastAccess: new Date(lastAccessStr),
        isOnline
      });
    }

    return users;
  }

  /**
   * Extract enrolled courses with progress and activity information
   * @returns Array of course overview cards with completion data
   */
  async getCourseOverview(): Promise<CourseOverview[]> {
    await this.courseOverviewWidget.waitFor({ state: 'visible' });
    
    const courseElements = this.courseOverviewWidget.locator('[data-testid="course-card"]');
    const count = await courseElements.count();
    const courses: CourseOverview[] = [];

    for (let i = 0; i < count; i++) {
      const courseElement = courseElements.nth(i);
      
      const courseId = await courseElement.getAttribute('data-course-id') || '';
      const courseName = await courseElement.locator('[data-testid="course-name"]').textContent() || '';
      const courseImageUrl = await courseElement.locator('[data-testid="course-image"]').getAttribute('src') || undefined;
      const progressStr = await courseElement.getAttribute('data-progress') || '0';
      const totalActivitiesStr = await courseElement.getAttribute('data-total-activities') || '0';
      const completedActivitiesStr = await courseElement.getAttribute('data-completed-activities') || '0';
      const upcomingDeadlinesStr = await courseElement.getAttribute('data-upcoming-deadlines') || '0';
      const lastAccessedStr = await courseElement.getAttribute('data-last-accessed') || undefined;
      const instructorName = await courseElement.locator('[data-testid="course-instructor"]').textContent() || undefined;
      const url = await courseElement.getAttribute('href') || '';

      courses.push({
        courseId,
        courseName,
        courseImageUrl,
        progress: parseInt(progressStr, 10),
        totalActivities: parseInt(totalActivitiesStr, 10),
        completedActivities: parseInt(completedActivitiesStr, 10),
        upcomingDeadlines: parseInt(upcomingDeadlinesStr, 10),
        lastAccessed: lastAccessedStr ? new Date(lastAccessedStr) : undefined,
        instructorName,
        url
      });
    }

    return courses;
  }

  /**
   * Navigate to a specific course by clicking its overview card
   * @param courseId - The unique identifier of the course
   */
  async clickCourseCard(courseId: string): Promise<void> {
    await this.courseOverviewWidget.waitFor({ state: 'visible' });
    
    const courseCard = this.courseOverviewWidget.locator(`[data-testid="course-card"][data-course-id="${courseId}"]`);
    await courseCard.waitFor({ state: 'visible' });
    await courseCard.click();
    
    // Wait for navigation to complete
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Open the widget customization interface to add/remove/reorder widgets
   */
  async customizeWidgets(): Promise<void> {
    await this.widgetCustomizeButton.waitFor({ state: 'visible' });
    await this.widgetCustomizeButton.click();
    
    // Wait for customization modal or panel to appear
    await this.page.waitForSelector('[data-testid="widget-customization-panel"]', { 
      state: 'visible',
      timeout: 5000 
    });
  }

  /**
   * Add a new widget to the dashboard
   * @param widgetType - The type of widget to add (e.g., 'calendar', 'timeline')
   */
  async addWidget(widgetType: string): Promise<void> {
    // Ensure customization panel is open
    const customizationPanel = this.page.locator('[data-testid="widget-customization-panel"]');
    const isVisible = await customizationPanel.isVisible().catch(() => false);
    
    if (!isVisible) {
      await this.customizeWidgets();
    }
    
    // Click the add button for the specified widget type
    const addButton = this.page.locator(`[data-testid="add-widget-${widgetType}"]`);
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();
    
    // Wait for widget to be added to dashboard
    await this.page.waitForTimeout(500);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Remove a widget from the dashboard
   * @param widgetType - The type of widget to remove
   */
  async removeWidget(widgetType: string): Promise<void> {
    const widget = this.page.locator(`[data-testid="${widgetType}-widget"]`);
    await widget.waitFor({ state: 'visible' });
    
    // Click the remove button on the widget
    const removeButton = widget.locator('[data-testid="widget-remove-button"]');
    await removeButton.waitFor({ state: 'visible' });
    await removeButton.click();
    
    // Handle confirmation dialog if it appears
    const confirmButton = this.page.locator('[data-testid="confirm-remove-widget"]');
    const confirmVisible = await confirmButton.isVisible().catch(() => false);
    
    if (confirmVisible) {
      await confirmButton.click();
    }
    
    // Wait for widget to be removed from DOM
    await widget.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Refresh widget data to fetch latest information
   * @param widgetType - The type of widget to refresh
   */
  async refreshWidget(widgetType: string): Promise<void> {
    const widget = this.page.locator(`[data-testid="${widgetType}-widget"]`);
    await widget.waitFor({ state: 'visible' });
    
    // Click the refresh button on the widget
    const refreshButton = widget.locator('[data-testid="widget-refresh-button"]');
    await refreshButton.waitFor({ state: 'visible' });
    await refreshButton.click();
    
    // Wait for loading indicator to appear and then disappear
    const loadingIndicator = widget.locator('[data-testid="widget-loading"]');
    await loadingIndicator.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
    await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    
    // Ensure all network activity has completed
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Internal helper to get the appropriate widget locator by type.
   * Maps widget type strings to their pre-initialized Locator instances for type safety.
   * 
   * @param widgetType - The widget type identifier
   * @returns The corresponding Locator, or dynamically created one if not pre-defined
   */
  private getWidgetLocatorByType(widgetType: string): Locator {
    // Map widget types to their pre-initialized locators for performance and consistency
    const widgetLocators: Record<string, Locator> = {
      'calendar': this.calendarWidget,
      'timeline': this.timelineWidget,
      'upcoming-events': this.upcomingEventsWidget,
      'recent-activity': this.recentActivityWidget,
      'online-users': this.onlineUsersWidget,
      'course-overview': this.courseOverviewWidget,
    };
    
    // Return pre-defined locator if available, otherwise create dynamic locator
    return widgetLocators[widgetType] || this.page.locator(`[data-testid="${widgetType}-widget"]`);
  }

  /**
   * Internal helper to check for notification badge presence.
   * Used internally to detect if any notifications are available.
   * 
   * @returns true if notification badge is visible, false otherwise
   */
  private async hasNotifications(): Promise<boolean> {
    try {
      return await this.notificationBadge.isVisible({ timeout: 1000 });
    } catch {
      return false;
    }
  }

  /**
   * Verify that a widget is properly loaded and displayed
   * @param widgetType - The type of widget to verify
   * @returns true if widget is loaded and displaying content, false otherwise
   */
  async verifyWidgetLoaded(widgetType: string): Promise<boolean> {
    // Use pre-defined locator for better performance and type safety
    const widget = this.getWidgetLocatorByType(widgetType);
    
    try {
      // Check if widget element is visible on the page
      await widget.waitFor({ state: 'visible', timeout: 5000 });
      
      // Check if widget is showing an error state
      const hasError = await widget.locator('[data-testid="widget-error"]').isVisible().catch(() => false);
      if (hasError) {
        return false;
      }
      
      // Check if widget has loaded content (not empty)
      const hasContent = await widget.locator('[data-testid*="widget-content"]').isVisible().catch(() => false);
      
      // Additionally check notification state for widgets that may have notification indicators
      await this.hasNotifications(); // Internal check for notification state
      
      return hasContent;
    } catch (error) {
      // Widget not found or not visible
      return false;
    }
  }
}
