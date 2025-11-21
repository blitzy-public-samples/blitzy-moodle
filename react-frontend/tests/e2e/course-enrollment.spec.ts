/**
 * E2E Test: Course Enrollment Workflow
 * 
 * Comprehensive end-to-end test suite validating course enrollment functionality including:
 * - Self-enrollment without restrictions
 * - Enrollment with enrollment keys (valid and invalid)
 * - Enrollment restrictions (capacity, dates, permissions)
 * - Multiple enrollment methods
 * - Unenrollment and re-enrollment
 * - Enrollment persistence across sessions
 * 
 * References:
 * - public/enrol/index.php (enrollment methods and restrictions)
 * - public/enrol/self/enrol.php (self-enrollment logic)
 * - public/course/view.php (course access verification)
 */

import { test, expect } from './setup/msw';
import type { Page } from '@playwright/test';
import { CoursePage } from './pages/CoursePage';
import { EnrollmentPage } from './pages/EnrollmentPage';
import { CourseCatalogPage } from './pages/CourseCatalogPage';
import { DashboardPage } from './pages/DashboardPage';
import { login, loginAsStudent, isAuthenticated, logout, clearAuthenticationState } from './utils/auth';
import { testCourse1, testCourse2, testCourse3, testCourse4, createCourse, getCourseWithActivities } from './fixtures/courses';
import { TEST_PASSWORD, testTeacher } from './fixtures/users';

test.describe('Course Enrollment Workflow', () => {
  let page: Page;
  let coursePage: CoursePage;
  let enrollmentPage: EnrollmentPage;
  let catalogPage: CourseCatalogPage;
  let dashboardPage: DashboardPage;
  
  // Track courses enrolled during tests for cleanup
  const enrolledCourseIds: number[] = [];

  /**
   * Global setup: Ensure clean authentication state before all tests
   */
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await clearAuthenticationState(page);
    await page.close();
    await context.close();
  });

  /**
   * Setup: Initialize page objects and authenticate as student before each test
   */
  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    
    // Initialize page objects
    coursePage = new CoursePage(page);
    enrollmentPage = new EnrollmentPage(page);
    catalogPage = new CourseCatalogPage(page);
    dashboardPage = new DashboardPage(page);
    
    // Authenticate as student user for enrollment testing
    await loginAsStudent(page);
    
    // Verify authentication succeeded
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);
    
    // Navigate to course catalog as starting point
    await catalogPage.waitForCatalog();
  });

  /**
   * Cleanup: Unenroll from test courses and logout after each test
   */
  test.afterEach(async () => {
    // Unenroll from any courses enrolled during test
    for (const courseId of enrolledCourseIds) {
      try {
        await page.goto(`/courses/${courseId}`);
        await coursePage.waitForCourse();
        
        // Only unenroll if currently enrolled
        const isEnrolled = await coursePage.isEnrolled();
        if (isEnrolled) {
          await coursePage.clickUnenroll();
          await enrollmentPage.confirmEnrollment();
          await enrollmentPage.waitForEnrollmentSuccess();
        }
      } catch (error) {
        // Log but continue cleanup if unenrollment fails
        console.error(`Failed to unenroll from course ${courseId}:`, error);
      }
    }
    
    // Clear enrollment tracking
    enrolledCourseIds.length = 0;
    
    // Logout user
    await logout(page);
    
    // Close page and context
    await page.close();
  });

  /**
   * Global cleanup: Clear authentication state after all tests
   */
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const cleanupPage = await context.newPage();
    await clearAuthenticationState(cleanupPage);
    await cleanupPage.close();
    await context.close();
  });

  /**
   * Test 1: Course without enrollment shows "Enroll me" button
   */
  test('should display "Enroll me" button for unenrolled course', async () => {
    // Navigate to course catalog and search for test course
    await catalogPage.searchCourses(testCourse1.fullname);
    const courseCards = await catalogPage.getCourseCards();
    
    // Verify test course appears in search results
    expect(courseCards.length).toBeGreaterThan(0);
    const targetCard = courseCards.find(card => card.title === testCourse1.fullname);
    expect(targetCard).toBeDefined();
    
    // Click on course card to navigate to course detail page
    await catalogPage.clickCourseCard(testCourse1.fullname);
    await coursePage.waitForCourse();
    
    // Verify course information loads correctly
    const courseInfo = await coursePage.getCourseInfo();
    expect(courseInfo.title).toBe(testCourse1.fullname);
    expect(courseInfo.description).toContain(testCourse1.summary);
    
    // Verify user is not enrolled
    const enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(false);
    
    // Verify "Enroll me" button is visible and enabled
    const enrollButton = page.locator('button:has-text("Enroll me")');
    await expect(enrollButton).toBeVisible();
    await expect(enrollButton).toBeEnabled();
  });

  /**
   * Test 2: Self-enrollment displays confirmation dialog
   */
  test('should show enrollment confirmation dialog on "Enroll me" click', async () => {
    // Navigate to test course
    await page.goto(`/courses/${testCourse1.id}`);
    await coursePage.waitForCourse();
    
    // Click "Enroll me" button
    await coursePage.clickEnroll();
    
    // Verify enrollment dialog appears
    await enrollmentPage.waitForEnrollmentDialog();
    
    // Verify dialog contains enrollment information
    const dialogVisible = await page.locator('[role="dialog"]').isVisible();
    expect(dialogVisible).toBe(true);
    
    // Verify enrollment method is shown
    const enrollmentMethods = await enrollmentPage.getEnrollmentMethods();
    expect(enrollmentMethods.length).toBeGreaterThan(0);
    expect(enrollmentMethods).toContain('Self enrollment');
  });

  /**
   * Test 3: Enrollment confirmation successfully enrolls user
   */
  test('should successfully enroll user after confirmation', async () => {
    // Navigate to test course
    await page.goto(`/courses/${testCourse1.id}`);
    await coursePage.waitForCourse();
    
    // Initiate enrollment
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    
    // Confirm enrollment
    await enrollmentPage.confirmEnrollment();
    
    // Wait for enrollment success
    await enrollmentPage.waitForEnrollmentSuccess();
    
    // Verify success message appears
    const successMessage = await enrollmentPage.getSuccessMessage();
    expect(successMessage).toContain('successfully enrolled');
    
    // Verify enrollment status changed
    await enrollmentPage.verifyEnrolled();
    const enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(true);
    
    // Track for cleanup
    enrolledCourseIds.push(testCourse1.id);
  });

  /**
   * Test 4: Course content becomes visible after enrollment
   */
  test('should display course content after successful enrollment', async () => {
    // Navigate to test course
    await page.goto(`/courses/${testCourse1.id}`);
    await coursePage.waitForCourse();
    
    // Enroll in course
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    await enrollmentPage.confirmEnrollment();
    await enrollmentPage.waitForEnrollmentSuccess();
    
    enrolledCourseIds.push(testCourse1.id);
    
    // Verify course sections are now visible
    const sections = await coursePage.getSections();
    expect(sections.length).toBeGreaterThan(0);
    
    // Verify course activities are visible
    const activities = await coursePage.getActivities();
    expect(activities.length).toBeGreaterThan(0);
    
    // Verify specific course content from fixture
    const courseWithActivities = getCourseWithActivities({ id: testCourse1.id });
    expect(sections.length).toBe(courseWithActivities.sections?.length ?? 0);
  });

  /**
   * Test 5: Enrollment with key prompts for enrollment key input
   */
  test('should prompt for enrollment key when required', async () => {
    // Navigate to course requiring enrollment key (testCourse2)
    await page.goto(`/courses/${testCourse2.id}`);
    await coursePage.waitForCourse();
    
    // Click enroll button
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    
    // Verify enrollment key input field is present
    const keyInput = page.locator('input[name="enrollmentkey"]');
    await expect(keyInput).toBeVisible();
    
    // Verify enrollment method indicates key requirement
    const enrollmentMethods = await enrollmentPage.getEnrollmentMethods();
    expect(enrollmentMethods).toContain('Self enrollment (Enrollment key)');
  });

  /**
   * Test 6: Invalid enrollment key shows error message
   */
  test('should display error message for invalid enrollment key', async () => {
    // Navigate to course requiring enrollment key
    await page.goto(`/courses/${testCourse2.id}`);
    await coursePage.waitForCourse();
    
    // Initiate enrollment
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    
    // Enter invalid enrollment key
    const invalidKey = 'WRONG_KEY_123';
    await enrollmentPage.enterEnrollmentKey(invalidKey);
    
    // Attempt to confirm enrollment
    await enrollmentPage.confirmEnrollment();
    
    // Verify error message appears
    const errorMessage = await enrollmentPage.getErrorMessage();
    expect(errorMessage).toContain('Invalid enrollment key');
    expect(errorMessage).toContain('incorrect');
    
    // Verify user is not enrolled
    await page.waitForTimeout(1000); // Wait for any async enrollment processing
    const enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(false);
  });

  /**
   * Test 7: Valid enrollment key successfully enrolls user
   */
  test('should successfully enroll with valid enrollment key', async () => {
    // Navigate to course requiring enrollment key
    await page.goto(`/courses/${testCourse2.id}`);
    await coursePage.waitForCourse();
    
    // Initiate enrollment
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    
    // Enter valid enrollment key from fixture
    const validKey = testCourse2.enrollmentmethods[0]!.password;
    if (!validKey) {
      throw new Error('Test course 2 must have an enrollment key configured');
    }
    await enrollmentPage.enterEnrollmentKey(validKey);
    
    // Confirm enrollment
    await enrollmentPage.confirmEnrollment();
    
    // Wait for enrollment success
    await enrollmentPage.waitForEnrollmentSuccess();
    
    // Verify success message
    const successMessage = await enrollmentPage.getSuccessMessage();
    expect(successMessage).toContain('successfully enrolled');
    
    // Verify enrollment status
    const enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(true);
    
    enrolledCourseIds.push(testCourse2.id);
  });

  /**
   * Test 8: Course at capacity shows enrollment restriction message
   */
  test('should display capacity restriction message for full course', async () => {
    // Create test course with capacity limit reached
    // Note: Capacity restrictions would need to be configured via API or Moodle settings
    const fullCourse = createCourse({
      fullname: 'Full Course Test',
    });
    
    // Navigate to full course
    await page.goto(`/courses/${fullCourse.id}`);
    await coursePage.waitForCourse();
    
    // Attempt to enroll
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    
    // Verify enrollment restriction message
    const restrictionMessage = await enrollmentPage.verifyEnrollmentRestriction();
    expect(restrictionMessage).toContain('course is full');
    expect(restrictionMessage).toContain('capacity');
    
    // Verify enrollment button is disabled or missing
    const confirmButton = page.locator('button:has-text("Confirm enrollment")');
    const isDisabled = await confirmButton.isDisabled().catch(() => true);
    expect(isDisabled).toBe(true);
  });

  /**
   * Test 9: Enrollment outside date range shows date restriction message
   */
  test('should display date restriction message for course outside enrollment period', async () => {
    // testCourse4 has enrollment date restrictions
    await page.goto(`/courses/${testCourse4.id}`);
    await coursePage.waitForCourse();
    
    // Attempt to enroll
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    
    // Verify date restriction message
    const restrictionMessage = await enrollmentPage.verifyEnrollmentRestriction();
    expect(restrictionMessage).toMatch(/enrollment period|enrollment not available|enrollment date/i);
    
    // Verify enrollment is blocked
    const confirmButton = page.locator('button:has-text("Confirm enrollment")');
    const isDisabled = await confirmButton.isDisabled().catch(() => true);
    expect(isDisabled).toBe(true);
  });

  /**
   * Test 10: Multiple enrollment methods are displayed
   */
  test('should list all available enrollment methods for course', async () => {
    // Create course with multiple enrollment methods
    const multiMethodCourse = createCourse({
      fullname: 'Multi-Method Course',
      enrollmentmethods: [
        { type: 'self', enabled: true, roleid: 5 },
        { type: 'manual', enabled: true, roleid: 5 },
        { type: 'cohort', enabled: true, roleid: 5 }
      ]
    });
    
    // Navigate to course
    await page.goto(`/courses/${multiMethodCourse.id}`);
    await coursePage.waitForCourse();
    
    // Open enrollment dialog
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    
    // Verify all enrollment methods are listed
    const enrollmentMethods = await enrollmentPage.getEnrollmentMethods();
    expect(enrollmentMethods.length).toBeGreaterThanOrEqual(2);
    expect(enrollmentMethods).toContain('Self enrollment');
    
    // Verify user can select enrollment method
    await enrollmentPage.selectEnrollmentMethod('Self enrollment');
    
    // Verify method selection changes dialog content
    const selectedMethod = await page.locator('[data-selected="true"]').textContent();
    expect(selectedMethod).toContain('Self enrollment');
  });

  /**
   * Test 11: Enrolled badge appears on course card after enrollment
   */
  test('should display "Enrolled" badge on course card after enrollment', async () => {
    // Enroll in test course first
    await page.goto(`/courses/${testCourse1.id}`);
    await coursePage.waitForCourse();
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    await enrollmentPage.confirmEnrollment();
    await enrollmentPage.waitForEnrollmentSuccess();
    
    enrolledCourseIds.push(testCourse1.id);
    
    // Navigate back to course catalog
    await page.goto('/courses');
    await catalogPage.waitForCatalog();
    
    // Search for the enrolled course
    await catalogPage.searchCourses(testCourse1.fullname);
    const courseCards = await catalogPage.getCourseCards();
    
    // Find the course card
    const enrolledCard = courseCards.find(card => card.title === testCourse1.fullname);
    expect(enrolledCard).toBeDefined();
    
    // Verify badge on course page
    await page.goto(`/courses/${testCourse1.id}`);
    await coursePage.waitForCourse();
    await coursePage.verifyEnrollmentBadge();
  });

  /**
   * Test 12: Unenrollment removes course access
   */
  test('should successfully unenroll and remove course access', async () => {
    // First enroll in course
    await page.goto(`/courses/${testCourse1.id}`);
    await coursePage.waitForCourse();
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    await enrollmentPage.confirmEnrollment();
    await enrollmentPage.waitForEnrollmentSuccess();
    
    // Verify enrollment
    let enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(true);
    
    // Initiate unenrollment
    await coursePage.clickUnenroll();
    await enrollmentPage.waitForEnrollmentDialog();
    
    // Confirm unenrollment
    await enrollmentPage.confirmEnrollment();
    await enrollmentPage.waitForEnrollmentSuccess();
    
    // Verify unenrollment success message
    const successMessage = await enrollmentPage.getSuccessMessage();
    expect(successMessage).toContain('unenrolled');
    
    // Verify enrollment status changed to not enrolled
    enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(false);
    
    // Verify course content is no longer visible
    await page.reload();
    await coursePage.waitForCourse();
    
    const sections = await coursePage.getSections();
    expect(sections.length).toBe(0);
    
    // Verify "Enroll me" button appears again
    const enrollButton = page.locator('button:has-text("Enroll me")');
    await expect(enrollButton).toBeVisible();
  });

  /**
   * Test 13: Re-enrollment is allowed after unenrollment
   */
  test('should allow re-enrollment in same course after unenrollment', async () => {
    // Enroll, unenroll, then re-enroll
    await page.goto(`/courses/${testCourse1.id}`);
    await coursePage.waitForCourse();
    
    // First enrollment
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    await enrollmentPage.confirmEnrollment();
    await enrollmentPage.waitForEnrollmentSuccess();
    
    let enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(true);
    
    // Unenroll
    await coursePage.clickUnenroll();
    await enrollmentPage.waitForEnrollmentDialog();
    await enrollmentPage.confirmEnrollment();
    await enrollmentPage.waitForEnrollmentSuccess();
    
    enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(false);
    
    // Re-enroll
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    await enrollmentPage.confirmEnrollment();
    await enrollmentPage.waitForEnrollmentSuccess();
    
    // Verify re-enrollment succeeded
    enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(true);
    
    // Verify course access restored
    const sections = await coursePage.getSections();
    expect(sections.length).toBeGreaterThan(0);
    
    enrolledCourseIds.push(testCourse1.id);
  });

  /**
   * Test 14: Enrollment persists after logout and login
   */
  test('should maintain enrollment status after logout and login', async () => {
    // Enroll in course
    await page.goto(`/courses/${testCourse1.id}`);
    await coursePage.waitForCourse();
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    await enrollmentPage.confirmEnrollment();
    await enrollmentPage.waitForEnrollmentSuccess();
    
    let enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(true);
    
    // Logout
    await logout(page);
    
    // Verify logged out
    let authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(false);
    
    // Login again as same student
    await loginAsStudent(page);
    
    // Verify logged in
    authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);
    
    // Navigate to enrolled course
    await page.goto(`/courses/${testCourse1.id}`);
    await coursePage.waitForCourse();
    
    // Verify still enrolled
    enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(true);
    
    // Verify course content still visible
    const sections = await coursePage.getSections();
    expect(sections.length).toBeGreaterThan(0);
    
    enrolledCourseIds.push(testCourse1.id);
  });

  /**
   * Test 15: Enrolled course appears in "My courses" on dashboard
   */
  test('should display enrolled course in "My courses" section on dashboard', async () => {
    // Enroll in course
    await page.goto(`/courses/${testCourse1.id}`);
    await coursePage.waitForCourse();
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    await enrollmentPage.confirmEnrollment();
    await enrollmentPage.waitForEnrollmentSuccess();
    
    enrolledCourseIds.push(testCourse1.id);
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await dashboardPage.waitForDashboard();
    
    // Get course overview from dashboard
    const enrolledCourses = await dashboardPage.getCourseOverview();
    
    // Verify enrolled course appears in list
    expect(enrolledCourses.length).toBeGreaterThan(0);
    const enrolledCourse = enrolledCourses.find(
      course => course.courseId === testCourse1.id.toString() || course.courseName === testCourse1.fullname
    );
    expect(enrolledCourse).toBeDefined();
    expect(enrolledCourse!.courseName).toBe(testCourse1.fullname);
    
    // Verify can click course card to navigate to course
    await dashboardPage.clickCourseCard(testCourse1.fullname);
    await coursePage.waitForCourse();
    
    const courseInfo = await coursePage.getCourseInfo();
    expect(courseInfo.title).toBe(testCourse1.fullname);
  });

  /**
   * Test 16: Enrollment without permission shows error
   */
  test('should prevent enrollment when user lacks permission', async () => {
    // Logout as student
    await logout(page);
    
    // Login as teacher (who may not have student enrollment permission)
    await login(page, { username: testTeacher.username, password: TEST_PASSWORD });
    
    // Navigate to course
    await page.goto(`/courses/${testCourse1.id}`);
    await coursePage.waitForCourse();
    
    // Attempt to enroll
    const enrollButton = page.locator('button:has-text("Enroll me")');
    
    // Verify enroll button either doesn't appear or shows permission error
    const buttonExists = await enrollButton.count();
    
    if (buttonExists > 0) {
      await coursePage.clickEnroll();
      await enrollmentPage.waitForEnrollmentDialog();
      await enrollmentPage.confirmEnrollment();
      
      // Verify error message about permissions
      const errorMessage = await enrollmentPage.getErrorMessage();
      expect(errorMessage).toMatch(/permission|not allowed|access denied/i);
    } else {
      // Button not shown - permission restriction enforced at UI level
      expect(buttonExists).toBe(0);
    }
    
    // Cleanup: logout teacher
    await logout(page);
    
    // Re-login as student for subsequent tests
    await loginAsStudent(page);
  });

  /**
   * Test 17: Enrollment in hidden course shows restriction
   */
  test('should prevent enrollment in hidden course', async () => {
    // testCourse3 is hidden course
    await page.goto(`/courses/${testCourse3.id}`);
    
    // Verify course page either doesn't load or shows access restriction
    const pageTitle = await page.title();
    const accessDenied = pageTitle.includes('Access denied') || 
                        pageTitle.includes('Not found') ||
                        await page.locator('text="Access denied"').count() > 0 ||
                        await page.locator('text="Course not available"').count() > 0;
    
    if (!accessDenied) {
      // If page loads, enrollment should be restricted
      await coursePage.waitForCourse();
      
      const enrollButton = page.locator('button:has-text("Enroll me")');
      const buttonVisible = await enrollButton.isVisible().catch(() => false);
      
      if (buttonVisible) {
        await coursePage.clickEnroll();
        await enrollmentPage.waitForEnrollmentDialog();
        
        // Verify restriction message
        const restrictionMessage = await enrollmentPage.verifyEnrollmentRestriction();
        expect(restrictionMessage).toMatch(/not available|hidden|not accessible/i);
      } else {
        // Enrollment button not shown for hidden course
        expect(buttonVisible).toBe(false);
      }
    } else {
      // Access denied as expected for hidden course
      expect(accessDenied).toBe(true);
    }
  });

  /**
   * Test 18: Cancel enrollment dialog doesn't enroll user
   */
  test('should cancel enrollment when user closes dialog', async () => {
    // Navigate to course
    await page.goto(`/courses/${testCourse1.id}`);
    await coursePage.waitForCourse();
    
    // Verify not enrolled
    let enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(false);
    
    // Open enrollment dialog
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    
    // Cancel enrollment
    await enrollmentPage.cancelEnrollment();
    
    // Wait for dialog to close
    await page.waitForTimeout(500);
    
    // Verify still not enrolled
    enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(false);
    
    // Verify course content not visible
    const sections = await coursePage.getSections();
    expect(sections.length).toBe(0);
  });

  /**
   * Test 19: Enrollment status updates in real-time
   */
  test('should update enrollment status immediately after enrollment', async () => {
    // Navigate to course
    await page.goto(`/courses/${testCourse1.id}`);
    await coursePage.waitForCourse();
    
    // Verify initial state
    let enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(false);
    
    // Enroll
    await coursePage.clickEnroll();
    await enrollmentPage.waitForEnrollmentDialog();
    await enrollmentPage.confirmEnrollment();
    
    // Wait for enrollment to process
    await enrollmentPage.waitForEnrollmentSuccess();
    
    // Verify enrollment status updated without page reload
    enrolled = await coursePage.isEnrolled();
    expect(enrolled).toBe(true);
    
    // Verify UI reflects enrollment immediately
    const enrollButton = page.locator('button:has-text("Enroll me")');
    const buttonVisible = await enrollButton.isVisible().catch(() => false);
    expect(buttonVisible).toBe(false);
    
    // Verify course content appears without reload
    const sections = await coursePage.getSections();
    expect(sections.length).toBeGreaterThan(0);
    
    enrolledCourseIds.push(testCourse1.id);
  });

  /**
   * Test 20: Multiple courses enrollment tracking
   */
  test('should track enrollment across multiple courses', async () => {
    const coursesToEnroll = [testCourse1, testCourse2];
    
    // Enroll in multiple courses
    for (const course of coursesToEnroll) {
      await page.goto(`/courses/${course.id}`);
      await coursePage.waitForCourse();
      
      await coursePage.clickEnroll();
      await enrollmentPage.waitForEnrollmentDialog();
      
      // Enter enrollment key if required
      const enrollmentMethod = course.enrollmentmethods?.find(m => m.password);
      if (enrollmentMethod?.password) {
        await enrollmentPage.enterEnrollmentKey(enrollmentMethod.password);
      }
      
      await enrollmentPage.confirmEnrollment();
      await enrollmentPage.waitForEnrollmentSuccess();
      
      const enrolled = await coursePage.isEnrolled();
      expect(enrolled).toBe(true);
      
      enrolledCourseIds.push(course.id);
    }
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await dashboardPage.waitForDashboard();
    
    // Verify all enrolled courses appear
    const enrolledCourses = await dashboardPage.getCourseOverview();
    expect(enrolledCourses.length).toBeGreaterThanOrEqual(coursesToEnroll.length);
    
    // Verify each course is in the list
    for (const course of coursesToEnroll) {
      const foundCourse = enrolledCourses.find(c => 
        c.courseId === course.id.toString() || c.courseName === course.fullname
      );
      expect(foundCourse).toBeDefined();
    }
  });
});
