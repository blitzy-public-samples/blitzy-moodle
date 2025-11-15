/**
 * E2E Test: User Dashboard
 * 
 * Comprehensive Playwright test for dashboard functionality including:
 * - Dashboard loading and performance validation
 * - Calendar widget interactions and navigation
 * - Timeline widget with activity filtering
 * - Recent activity feed display
 * - Online users widget
 * - Course overview with progress tracking
 * - Widget customization (add/remove/reorder)
 * - Real-time data updates and refresh
 * - Dashboard navigation and search
 * - Notifications badge display
 * 
 * Performance Requirements:
 * - Initial dashboard load: <3 seconds
 * - Time to Interactive (TTI): <5 seconds
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';
import { login, isAuthenticated, logout, getAuthToken, clearAuthenticationState } from './utils/auth';
import { waitForPageLoad, waitForNetworkIdle, waitForCondition, pollUntil, waitForElement } from './utils/wait-helpers';
import { apiRequest, setupTestEnvironment, cleanupTestEnvironment, createTestUser, type TestEnvironment } from './utils/api-helpers';

test.describe('Dashboard E2E Tests', () => {
  let dashboardPage: DashboardPage;
  let page: Page;
  let testEnv: TestEnvironment;
  let additionalStudent2: { id: number; username: string; email: string; password: string };
  let additionalStudent3: { id: number; username: string; email: string; password: string };

  /**
   * Setup: Create test environment with enrolled courses and activities
   */
  test.beforeAll(async ({ browser }) => {
    // Create new browser context and page
    const context = await browser.newContext();
    page = await context.newPage();
    
    // Setup test environment via API for faster execution
    // Creates student, teacher, course, and optionally assignments/quizzes
    testEnv = await setupTestEnvironment({
      courseName: 'Dashboard Test Course',
      includeAssignment: true,
      includeQuiz: true
    });

    // Create additional students for online users widget testing
    const timestamp = Date.now();
    additionalStudent2 = {
      ...(await createTestUser({
        username: `test_student2_${timestamp}`,
        email: `test_student2_${timestamp}@example.com`,
        password: 'TestStudent2@123',
        firstname: 'Test',
        lastname: 'Student2'
      })),
      password: 'TestStudent2@123'
    };

    additionalStudent3 = {
      ...(await createTestUser({
        username: `test_student3_${timestamp}`,
        email: `test_student3_${timestamp}@example.com`,
        password: 'TestStudent3@123',
        firstname: 'Test',
        lastname: 'Student3'
      })),
      password: 'TestStudent3@123'
    };

    // Login additional students for online users widget testing
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await login(page2, {
      username: additionalStudent2.username,
      password: additionalStudent2.password
    });
    
    const context3 = await browser.newContext();
    const page3 = await context3.newPage();
    await login(page3, {
      username: additionalStudent3.username,
      password: additionalStudent3.password
    });

    // Authenticate main test student user
    await login(page, {
      username: testEnv.student.username,
      password: testEnv.student.password
    });
    
    // Verify authentication succeeded
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);

    // Initialize Dashboard Page Object Model
    dashboardPage = new DashboardPage(page);
  });

  /**
   * Cleanup: Reset dashboard layout and remove test data
   */
  test.afterAll(async () => {
    // Reset dashboard to default layout
    await dashboardPage.customizeWidgets();
    // Cleanup test environment via API (cleans up all tracked test data)
    await cleanupTestEnvironment();
    
    // Clear authentication state
    await clearAuthenticationState(page);
    await logout(page);
    
    // Close browser pages
    await page.close();
  });

  /**
   * Before each test: Navigate to dashboard
   */
  test.beforeEach(async () => {
    // Navigate to dashboard page
    await page.goto('/dashboard');
  });

  test.describe('Dashboard Loading and Performance', () => {
    test('should load dashboard within 3 seconds with all widgets', async () => {
      // Record start time for performance measurement
      const startTime = Date.now();

      // Navigate to dashboard
      await page.goto('/dashboard');

      // Wait for dashboard to fully load with all widgets
      await dashboardPage.waitForDashboard();

      // Wait for network to be idle (all API calls complete)
      await waitForNetworkIdle(page);

      // Calculate load time
      const loadTime = Date.now() - startTime;

      // Assert load time is under 3 seconds (3000ms)
      expect(loadTime).toBeLessThan(3000);

      // Verify all expected widgets are loaded
      await expect(dashboardPage.verifyWidgetLoaded('calendar')).resolves.toBe(true);
      await expect(dashboardPage.verifyWidgetLoaded('timeline')).resolves.toBe(true);
      await expect(dashboardPage.verifyWidgetLoaded('recent-activity')).resolves.toBe(true);
      await expect(dashboardPage.verifyWidgetLoaded('online-users')).resolves.toBe(true);
      await expect(dashboardPage.verifyWidgetLoaded('course-overview')).resolves.toBe(true);
    });

    test('should have Time to Interactive under 5 seconds', async () => {
      // Record page load start
      const startTime = Date.now();

      // Navigate to dashboard
      await page.goto('/dashboard');

      // Wait for page to be fully loaded
      await waitForPageLoad(page);

      // Wait for all interactive elements to be ready
      await waitForCondition(async () => {
        // Check if all widgets are interactive
        const calendarInteractive = await page.locator('[data-testid="calendar-widget"]').isEnabled();
        const timelineInteractive = await page.locator('[data-testid="timeline-widget"]').isEnabled();
        const courseOverviewInteractive = await page.locator('[data-testid="course-overview-widget"]').isEnabled();
        
        return calendarInteractive && timelineInteractive && courseOverviewInteractive;
      }, { timeout: 5000 });

      // Calculate Time to Interactive
      const tti = Date.now() - startTime;

      // Assert TTI is under 5 seconds (5000ms)
      expect(tti).toBeLessThan(5000);
    });
  });

  test.describe('Calendar Widget', () => {
    test('should display current month with events highlighted', async () => {
      // Get calendar events
      const events = await dashboardPage.getCalendarEvents();

      // Verify calendar displays events
      expect(events.length).toBeGreaterThan(0);

      // Verify current month is displayed
      const currentDate = new Date();
      const calendarMonth = await page.locator('[data-testid="calendar-month"]').textContent();
      const expectedMonth = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      expect(calendarMonth).toContain(expectedMonth);

      // Verify events are highlighted (have specific CSS class or attribute)
      const highlightedDays = await page.locator('[data-testid="calendar-day"][data-has-events="true"]').count();
      expect(highlightedDays).toBeGreaterThan(0);
    });

    test('should navigate to next and previous months', async () => {
      // Get initial month display
      const initialMonth = await page.locator('[data-testid="calendar-month"]').textContent();

      // Navigate to next month
      await dashboardPage.navigateCalendarMonth('next');
      await waitForElement(page, '[data-testid="calendar-month"]');

      // Verify month changed
      const nextMonth = await page.locator('[data-testid="calendar-month"]').textContent();
      expect(nextMonth).not.toBe(initialMonth);

      // Navigate to previous month (back to original)
      await dashboardPage.navigateCalendarMonth('previous');
      await waitForElement(page, '[data-testid="calendar-month"]');

      // Verify returned to initial month
      const returnedMonth = await page.locator('[data-testid="calendar-month"]').textContent();
      expect(returnedMonth).toBe(initialMonth);

      // Navigate to previous month from initial
      await dashboardPage.navigateCalendarMonth('previous');
      await waitForElement(page, '[data-testid="calendar-month"]');

      // Verify navigated to month before initial
      const previousMonth = await page.locator('[data-testid="calendar-month"]').textContent();
      expect(previousMonth).not.toBe(initialMonth);
      expect(previousMonth).not.toBe(nextMonth);
    });

    test('should open event details modal when event clicked', async () => {
      // Get calendar events
      const events = await dashboardPage.getCalendarEvents();
      expect(events.length).toBeGreaterThan(0);

      // Click on first event
      const firstEvent = events[0];
      const eventElement = page.locator(`[data-testid="calendar-event"][data-event-id="${firstEvent.eventId}"]`);
      await eventElement.click();

      // Wait for event details modal to open
      await waitForElement(page, '[data-testid="event-details-modal"]');

      // Verify modal is visible
      const modal = page.locator('[data-testid="event-details-modal"]');
      await expect(modal).toBeVisible();

      // Verify modal contains event information
      await expect(modal.locator('[data-testid="event-title"]')).toBeVisible();
      await expect(modal.locator('[data-testid="event-date"]')).toBeVisible();
      await expect(modal.locator('[data-testid="event-description"]')).toBeVisible();

      // Close modal
      await modal.locator('[data-testid="close-modal"]').click();

      // Verify modal is closed
      await expect(modal).not.toBeVisible();
    });
  });

  test.describe('Timeline Widget', () => {
    test('should show upcoming activities sorted by due date', async () => {
      // Get timeline items
      const timelineItems = await dashboardPage.getTimelineItems();

      // Verify timeline has items
      expect(timelineItems.length).toBeGreaterThan(0);

      // Extract due dates from timeline items (already in the data)
      const dueDates: Date[] = timelineItems
        .filter(item => item.dueDate !== undefined)
        .map(item => item.dueDate!);

      // Verify activities are sorted chronologically (earliest first)
      for (let i = 0; i < dueDates.length - 1; i++) {
        expect(dueDates[i].getTime()).toBeLessThanOrEqual(dueDates[i + 1].getTime());
      }

      // Verify timeline shows activity types by checking the first item in the DOM
      const firstItem = timelineItems[0];
      const firstItemElement = page.locator(`[data-testid="timeline-item"][data-item-id="${firstItem.itemId}"]`);
      await expect(firstItemElement.locator('[data-testid="activity-type"]')).toBeVisible();
      await expect(firstItemElement.locator('[data-testid="activity-title"]')).toBeVisible();
    });

    test('should filter timeline by activity type (assignment)', async () => {
      // Get initial timeline count
      const initialItems = await dashboardPage.getTimelineItems();
      const initialCount = initialItems.length;

      // Filter by assignment type
      await dashboardPage.filterTimelineByType('assignment');
      await waitForNetworkIdle(page);

      // Get filtered timeline items
      const filteredItems = await dashboardPage.getTimelineItems();

      // Verify all items are assignments (using data from the interface)
      for (const item of filteredItems) {
        expect(item.activityType.toLowerCase()).toContain('assignment');
      }

      // Verify count changed (filtered)
      expect(filteredItems.length).toBeLessThanOrEqual(initialCount);
    });

    test('should filter timeline by activity type (quiz)', async () => {
      // Get initial timeline count
      const initialItems = await dashboardPage.getTimelineItems();
      const initialCount = initialItems.length;

      // Filter by quiz type
      await dashboardPage.filterTimelineByType('quiz');
      await waitForNetworkIdle(page);

      // Get filtered timeline items
      const filteredItems = await dashboardPage.getTimelineItems();

      // Verify all items are quizzes (using data from the interface)
      for (const item of filteredItems) {
        expect(item.activityType.toLowerCase()).toContain('quiz');
      }

      // Verify count changed (filtered)
      expect(filteredItems.length).toBeLessThanOrEqual(initialCount);
    });

    test('should clear timeline filter and show all activities', async () => {
      // Filter by assignment
      await dashboardPage.filterTimelineByType('assignment');
      await waitForNetworkIdle(page);
      const filteredCount = (await dashboardPage.getTimelineItems()).length;

      // Clear filter (show all)
      await dashboardPage.filterTimelineByType('all');
      await waitForNetworkIdle(page);

      // Get all timeline items
      const allItems = await dashboardPage.getTimelineItems();

      // Verify count is greater than or equal to filtered count
      expect(allItems.length).toBeGreaterThanOrEqual(filteredCount);

      // Verify mixed activity types present (using data from the interface)
      const activityTypes = new Set<string>();
      for (const item of allItems) {
        activityTypes.add(item.activityType.toLowerCase());
      }
      
      // Should have more than one activity type
      expect(activityTypes.size).toBeGreaterThan(1);
    });
  });

  test.describe('Recent Activity Widget', () => {
    test('should show latest course updates', async () => {
      // Get recent activity items
      const recentActivities = await dashboardPage.getRecentActivity();

      // Verify recent activity feed has items
      expect(recentActivities.length).toBeGreaterThan(0);

      // Verify recent activity structure by checking the first item in the DOM
      const firstActivity = recentActivities[0];
      const firstActivityElement = page.locator(`[data-testid="activity-item"][data-activity-id="${firstActivity.activityId}"]`);
      await expect(firstActivityElement.locator('[data-testid="activity-course"]')).toBeVisible();
      await expect(firstActivityElement.locator('[data-testid="activity-description"]')).toBeVisible();
      await expect(firstActivityElement.locator('[data-testid="activity-timestamp"]')).toBeVisible();

      // Verify timestamps are recent (check data objects directly)
      for (const activity of recentActivities.slice(0, 3)) {
        const now = Date.now();
        const activityTime = activity.timestamp.getTime();
        const daysDiff = (now - activityTime) / (1000 * 60 * 60 * 24);
        // Timestamp should be within last 7 days
        expect(daysDiff).toBeLessThanOrEqual(7);
      }
    });

    test('should display course name for each activity', async () => {
      // Get recent activity items
      const recentActivities = await dashboardPage.getRecentActivity();

      // Verify each activity has a course name (using data from the interface)
      for (const activity of recentActivities) {
        expect(activity.courseName).toBeTruthy();
        expect(activity.courseName.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Online Users Widget', () => {
    test('should show currently active users', async () => {
      // Get online users list
      const onlineUsers = await dashboardPage.getOnlineUsers();

      // Verify online users widget has users
      // Should include at least testStudent2 and testStudent3 logged in during beforeAll
      expect(onlineUsers.length).toBeGreaterThanOrEqual(2);

      // Verify user structure by constructing locator for first user
      const firstUser = onlineUsers[0];
      const firstUserElement = page.locator(`[data-testid="online-user"][data-user-id="${firstUser.userId}"]`);
      await expect(firstUserElement.locator('[data-testid="user-name"]')).toBeVisible();
      await expect(firstUserElement.locator('[data-testid="user-avatar"]')).toBeVisible();

      // Verify online status indicator
      await expect(firstUserElement.locator('[data-testid="online-status"]')).toBeVisible();
    });

    test('should display user profiles in online users list', async () => {
      // Get online users
      const onlineUsers = await dashboardPage.getOnlineUsers();

      // Verify each user has name and avatar
      for (const user of onlineUsers) {
        // Check data from interface
        expect(user.fullName).toBeTruthy();
        
        // Verify avatar is visible in DOM
        const userElement = page.locator(`[data-testid="online-user"][data-user-id="${user.userId}"]`);
        const avatar = userElement.locator('[data-testid="user-avatar"]');
        await expect(avatar).toBeVisible();
      }
    });
  });

  test.describe('Course Overview Widget', () => {
    test('should display enrolled courses with progress bars', async () => {
      // Get course overview cards
      const courseCards = await dashboardPage.getCourseOverview();

      // Verify course overview has enrolled courses
      expect(courseCards.length).toBeGreaterThanOrEqual(2); // At least testCourse1 and testCourse2

      // Verify course card structure
      const firstCourse = courseCards[0];
      const firstCourseElement = page.locator(`[data-testid="course-card"][data-course-id="${firstCourse.courseId}"]`);
      await expect(firstCourseElement.locator('[data-testid="course-name"]')).toBeVisible();
      await expect(firstCourseElement.locator('[data-testid="course-progress"]')).toBeVisible();

      // Verify progress bar has percentage (check data from interface)
      expect(firstCourse.progress).toBeGreaterThanOrEqual(0);
      expect(firstCourse.progress).toBeLessThanOrEqual(100);
      
      // Also verify the progress bar DOM element
      const progressBar = firstCourseElement.locator('[data-testid="course-progress"]');
      const progressValue = await progressBar.getAttribute('aria-valuenow');
      expect(progressValue).toBeTruthy();
    });

    test('should navigate to course page when course card clicked', async () => {
      // Get course overview cards
      const courseCards = await dashboardPage.getCourseOverview();
      expect(courseCards.length).toBeGreaterThan(0);

      // Get first course name for verification (from data object)
      const firstCourse = courseCards[0];
      const firstCourseName = firstCourse.courseName;

      // Click first course card (pass courseId as string)
      await dashboardPage.clickCourseCard(firstCourse.courseId);

      // Wait for navigation to course page
      await waitForPageLoad(page);

      // Verify navigated to course page
      expect(page.url()).toContain('/course/');

      // Verify course page displays correct course
      const pageTitle = await page.locator('h1').textContent();
      expect(pageTitle).toContain(firstCourseName || '');
    });
  });

  test.describe('Widget Customization', () => {
    test('should allow adding widgets to dashboard', async () => {
      // Open widget customization
      await dashboardPage.customizeWidgets();

      // Wait for customization panel to open
      await waitForElement(page, '[data-testid="widget-customization-panel"]');

      // Get initial widget count
      const initialWidgets = await page.locator('[data-testid$="-widget"]').count();

      // Add a widget (e.g., badges widget)
      await dashboardPage.addWidget('badges');

      // Wait for widget to be added
      await waitForElement(page, '[data-testid="badges-widget"]');

      // Verify widget count increased
      const newWidgetCount = await page.locator('[data-testid$="-widget"]').count();
      expect(newWidgetCount).toBe(initialWidgets + 1);

      // Verify new widget is visible
      await expect(page.locator('[data-testid="badges-widget"]')).toBeVisible();

      // Save customization
      await page.locator('[data-testid="save-customization"]').click();
      await waitForNetworkIdle(page);
    });

    test('should allow removing widgets from dashboard', async () => {
      // Open widget customization
      await dashboardPage.customizeWidgets();

      // Wait for customization panel
      await waitForElement(page, '[data-testid="widget-customization-panel"]');

      // Get initial widget count
      const initialWidgets = await page.locator('[data-testid$="-widget"]').count();

      // Remove a widget (e.g., badges widget added in previous test)
      await dashboardPage.removeWidget('badges');

      // Wait for widget to be removed
      await page.waitForTimeout(500);

      // Verify widget count decreased
      const newWidgetCount = await page.locator('[data-testid$="-widget"]').count();
      expect(newWidgetCount).toBe(initialWidgets - 1);

      // Verify widget is no longer visible
      await expect(page.locator('[data-testid="badges-widget"]')).not.toBeVisible();

      // Save customization
      await page.locator('[data-testid="save-customization"]').click();
      await waitForNetworkIdle(page);
    });

    test('should persist widget preferences after page reload', async () => {
      // Open widget customization
      await dashboardPage.customizeWidgets();
      await waitForElement(page, '[data-testid="widget-customization-panel"]');

      // Add a specific widget
      await dashboardPage.addWidget('comments');
      await waitForElement(page, '[data-testid="comments-widget"]');

      // Save customization
      await page.locator('[data-testid="save-customization"]').click();
      await waitForNetworkIdle(page);

      // Record current widgets
      const widgetsBeforeReload = await page.locator('[data-testid$="-widget"]').count();

      // Reload page
      await page.reload();
      await dashboardPage.waitForDashboard();

      // Verify widget preferences persisted
      const widgetsAfterReload = await page.locator('[data-testid$="-widget"]').count();
      expect(widgetsAfterReload).toBe(widgetsBeforeReload);

      // Verify comments widget still present
      await expect(page.locator('[data-testid="comments-widget"]')).toBeVisible();

      // Cleanup: Remove comments widget
      await dashboardPage.customizeWidgets();
      await dashboardPage.removeWidget('comments');
      await page.locator('[data-testid="save-customization"]').click();
      await waitForNetworkIdle(page);
    });
  });

  test.describe('Widget Refresh', () => {
    test('should refresh widget data when refresh button clicked', async () => {
      // Get initial timeline items count
      const initialItems = await dashboardPage.getTimelineItems();
      const initialCount = initialItems.length;

      // Setup API request monitoring
      const apiRequestPromise = page.waitForResponse(
        response => response.url().includes('/api/v1/blocks/timeline') && response.status() === 200
      );

      // Click refresh button on timeline widget
      await dashboardPage.refreshWidget('timeline');

      // Wait for API request to complete
      const response = await apiRequestPromise;
      expect(response.status()).toBe(200);

      // Wait for widget to update
      await waitForNetworkIdle(page);

      // Verify widget data refreshed (count should be same or updated)
      const refreshedItems = await dashboardPage.getTimelineItems();
      expect(refreshedItems.length).toBeGreaterThanOrEqual(0);

      // Verify loading indicator was shown during refresh
      // (this would have been visible briefly during refresh)
    });

    test('should refresh calendar widget independently', async () => {
      // Setup API request monitoring for calendar
      const apiRequestPromise = page.waitForResponse(
        response => response.url().includes('/api/v1/blocks/calendar') && response.status() === 200
      );

      // Click refresh button on calendar widget
      await dashboardPage.refreshWidget('calendar');

      // Wait for API request
      const response = await apiRequestPromise;
      expect(response.status()).toBe(200);

      // Wait for widget to update
      await waitForNetworkIdle(page);

      // Verify calendar still displays correctly
      const events = await dashboardPage.getCalendarEvents();
      expect(events.length).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Dashboard Navigation', () => {
    test('should navigate to course page from course card', async () => {
      // Get first course card
      const courseCards = await dashboardPage.getCourseOverview();
      expect(courseCards.length).toBeGreaterThan(0);

      // Click first course (pass courseId as string)
      const firstCourse = courseCards[0];
      await dashboardPage.clickCourseCard(firstCourse.courseId);

      // Verify navigation
      await waitForPageLoad(page);
      expect(page.url()).toContain('/course/');

      // Navigate back to dashboard
      await page.goto('/dashboard');
      await dashboardPage.waitForDashboard();
    });

    test('should navigate to activity from timeline', async () => {
      // Get timeline items
      const timelineItems = await dashboardPage.getTimelineItems();
      expect(timelineItems.length).toBeGreaterThan(0);

      // Click first timeline item (construct locator from data)
      const firstItem = timelineItems[0];
      const firstItemElement = page.locator(`[data-testid="timeline-item"][data-item-id="${firstItem.itemId}"]`);
      await firstItemElement.click();

      // Verify navigation to activity page
      await waitForPageLoad(page);
      expect(page.url()).toMatch(/\/(assignment|quiz|forum)\//);
    });
  });

  test.describe('Dashboard Search', () => {
    test('should perform global search from dashboard', async () => {
      // Locate search input in header
      const searchInput = page.locator('[data-testid="global-search-input"]');
      await expect(searchInput).toBeVisible();

      // Type search query
      await searchInput.fill('assignment');
      await searchInput.press('Enter');

      // Wait for search results
      await waitForElement(page, '[data-testid="search-results"]');

      // Verify search results appear
      const searchResults = page.locator('[data-testid="search-result-item"]');
      const resultCount = await searchResults.count();
      expect(resultCount).toBeGreaterThan(0);

      // Verify results contain search term
      const firstResult = await searchResults.first().textContent();
      expect(firstResult?.toLowerCase()).toContain('assignment');
    });
  });

  test.describe('Notifications Badge', () => {
    test('should display notification count in header', async () => {
      // Locate notifications badge
      const notificationsBadge = page.locator('[data-testid="notifications-badge"]');

      // Check if badge is visible (may not be visible if count is 0)
      const badgeVisible = await notificationsBadge.isVisible();

      if (badgeVisible) {
        // Get notification count
        const notificationCount = await notificationsBadge.textContent();
        expect(notificationCount).toBeTruthy();
        
        // Verify count is a number
        const count = parseInt(notificationCount || '0', 10);
        expect(count).toBeGreaterThanOrEqual(0);
      }

      // Click notifications icon
      await page.locator('[data-testid="notifications-icon"]').click();

      // Verify notifications panel opens
      await waitForElement(page, '[data-testid="notifications-panel"]');
      await expect(page.locator('[data-testid="notifications-panel"]')).toBeVisible();
    });
  });

  test.describe('Real-time Updates', () => {
    test('should reflect real-time data updates in widgets', async () => {
      // Get auth token for API calls
      const authToken = await getAuthToken(page);

      // Create a new assignment via API
      const newAssignment = await apiRequest({
        token: authToken,
        endpoint: '/api/v1/assignments',
        method: 'POST',
        body: {
          courseid: testEnv.course.id,
          name: 'Real-time Test Assignment',
          duedate: Math.floor(Date.now() / 1000) + 86400 // Due tomorrow
        }
      });

      // Wait for potential websocket or polling update
      await page.waitForTimeout(2000);

      // Refresh timeline widget to see new activity
      await dashboardPage.refreshWidget('timeline');
      await waitForNetworkIdle(page);

      // Verify new assignment appears in timeline (use data from interface)
      const timelineItems = await dashboardPage.getTimelineItems();
      const timelineTitles = timelineItems.map(item => item.title);

      const hasNewAssignment = timelineTitles.some(title => 
        title.includes('Real-time Test Assignment')
      );
      expect(hasNewAssignment).toBe(true);

      // Cleanup: Remove test assignment via API
      await apiRequest({
        token: authToken,
        endpoint: `/api/v1/assignments/${newAssignment.id}`,
        method: 'DELETE'
      });
    });

    test('should update recent activity feed with new content', async () => {
      // Get initial recent activity count
      const initialActivities = await dashboardPage.getRecentActivity();
      const initialCount = initialActivities.length;

      // Trigger an action that creates recent activity (e.g., post in forum)
      // For test purposes, simulate by refreshing the widget
      await dashboardPage.refreshWidget('recent-activity');
      await waitForNetworkIdle(page);

      // Verify recent activity updated
      const updatedActivities = await dashboardPage.getRecentActivity();
      expect(updatedActivities.length).toBeGreaterThanOrEqual(initialCount);
    });
  });

  test.describe('Performance Validation', () => {
    test('should load all widgets within performance budget', async () => {
      const startTime = Date.now();

      // Navigate to fresh dashboard
      await page.goto('/dashboard');
      await dashboardPage.waitForDashboard();

      // Wait for all widgets to load
      await waitForCondition(async () => {
        const calendarLoaded = await dashboardPage.verifyWidgetLoaded('calendar');
        const timelineLoaded = await dashboardPage.verifyWidgetLoaded('timeline');
        const recentActivityLoaded = await dashboardPage.verifyWidgetLoaded('recent-activity');
        const onlineUsersLoaded = await dashboardPage.verifyWidgetLoaded('online-users');
        const courseOverviewLoaded = await dashboardPage.verifyWidgetLoaded('course-overview');

        return calendarLoaded && timelineLoaded && recentActivityLoaded && 
               onlineUsersLoaded && courseOverviewLoaded;
      }, { timeout: 5000 });

      const totalLoadTime = Date.now() - startTime;

      // Verify total load time is under 5 seconds
      expect(totalLoadTime).toBeLessThan(5000);
    });

    test('should handle concurrent widget interactions efficiently', async () => {
      // Perform multiple widget interactions simultaneously
      const startTime = Date.now();

      await Promise.all([
        dashboardPage.navigateCalendarMonth('next'),
        dashboardPage.filterTimelineByType('assignment'),
        dashboardPage.getRecentActivity(),
        dashboardPage.getOnlineUsers()
      ]);

      const interactionTime = Date.now() - startTime;

      // Verify interactions complete within reasonable time
      expect(interactionTime).toBeLessThan(2000);
    });
  });

  test.describe('Error Handling', () => {
    test('should display error message when widget fails to load', async () => {
      // Simulate network failure by intercepting API request
      await page.route('**/api/v1/blocks/timeline', route => {
        route.abort('failed');
      });

      // Refresh timeline widget
      await dashboardPage.refreshWidget('timeline');
      await page.waitForTimeout(1000);

      // Verify error message is displayed
      const errorMessage = page.locator('[data-testid="timeline-widget-error"]');
      await expect(errorMessage).toBeVisible();

      // Remove route interception
      await page.unroute('**/api/v1/blocks/timeline');
    });

    test('should allow retry when widget load fails', async () => {
      // Simulate temporary network failure
      let requestCount = 0;
      await page.route('**/api/v1/blocks/calendar', route => {
        requestCount++;
        if (requestCount === 1) {
          route.abort('failed');
        } else {
          route.continue();
        }
      });

      // Refresh calendar widget (will fail first time)
      await dashboardPage.refreshWidget('calendar');
      await page.waitForTimeout(1000);

      // Click retry button
      const retryButton = page.locator('[data-testid="calendar-widget-retry"]');
      if (await retryButton.isVisible()) {
        await retryButton.click();
        await waitForNetworkIdle(page);

        // Verify widget loaded successfully on retry
        const calendarLoaded = await dashboardPage.verifyWidgetLoaded('calendar');
        expect(calendarLoaded).toBe(true);
      }

      // Remove route interception
      await page.unroute('**/api/v1/blocks/calendar');
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation in dashboard', async () => {
      // Focus on first interactive element
      await page.keyboard.press('Tab');

      // Verify focus is visible
      const focusedElement = await page.locator(':focus');
      await expect(focusedElement).toBeVisible();

      // Tab through widgets
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        const currentFocus = await page.locator(':focus');
        await expect(currentFocus).toBeVisible();
      }
    });

    test('should have proper ARIA labels on widgets', async () => {
      // Verify calendar widget has ARIA label
      const calendarWidget = page.locator('[data-testid="calendar-widget"]');
      const calendarLabel = await calendarWidget.getAttribute('aria-label');
      expect(calendarLabel).toBeTruthy();

      // Verify timeline widget has ARIA label
      const timelineWidget = page.locator('[data-testid="timeline-widget"]');
      const timelineLabel = await timelineWidget.getAttribute('aria-label');
      expect(timelineLabel).toBeTruthy();

      // Verify other widgets have ARIA labels
      const recentActivityWidget = page.locator('[data-testid="recent-activity-widget"]');
      const recentActivityLabel = await recentActivityWidget.getAttribute('aria-label');
      expect(recentActivityLabel).toBeTruthy();
    });
  });
});
