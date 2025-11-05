# End-to-End Testing Documentation

## Overview

This directory contains the comprehensive end-to-end (E2E) test suite for the Moodle React frontend. The test suite validates 15 critical user journeys across the application, ensuring that all major workflows function correctly from the user's perspective.

### Purpose

The E2E test suite serves multiple critical functions:

- **User Journey Validation**: Ensures complete workflows (login → enroll → submit → grade) work as expected
- **Cross-Browser Compatibility**: Tests run across Chromium, Firefox, and WebKit to ensure consistent behavior
- **Regression Prevention**: Catches breaking changes before they reach production
- **Integration Testing**: Validates that React frontend, API layer, and PHP backend work together correctly
- **Confidence in Deployment**: Provides assurance that critical functionality works before releasing

### Test Framework

We use **Playwright** as our E2E testing framework for the following reasons:

- Multi-browser support (Chromium, Firefox, WebKit)
- Fast and reliable test execution
- Excellent debugging tools (Playwright Inspector, trace viewer)
- Built-in screenshot and video capture on failures
- Strong TypeScript support
- Parallel test execution

### Critical User Journeys Covered

The test suite covers 15 essential user journeys that represent the most common and critical workflows in Moodle:

1. **Authentication & Authorization** - Login with JWT tokens
2. **Course Catalog Browsing** - Search and filter courses
3. **Course Enrollment** - Self-enrollment workflow
4. **Assignment Submission** - Upload files and submit work
5. **Quiz Attempts** - Take timed quizzes with auto-save
6. **Student Gradebook** - View grades and feedback
7. **Teacher Grading** - Grade assignments and provide feedback
8. **Forum Discussions** - Create posts and reply to threads
9. **Private Messaging** - Send and receive messages
10. **Dashboard Widgets** - View upcoming events, calendar, timeline
11. **Profile Management** - Update user profile and preferences
12. **Global Search** - Search across courses and content
13. **File Repository** - Upload, download, and manage files
14. **Admin User Management** - Create, edit, and delete users
15. **Admin Role Assignment** - Assign roles and permissions

## Test Structure

```
tests/e2e/
├── README.md                          # This file
├── fixtures/                          # Test data and setup helpers
│   ├── users.ts                       # User account fixtures
│   ├── courses.ts                     # Course data fixtures
│   ├── assignments.ts                 # Assignment fixtures
│   └── testData.ts                    # Shared test data utilities
├── pages/                             # Page Object Models
│   ├── LoginPage.ts                   # Login page POM
│   ├── CourseCatalogPage.ts          # Course catalog POM
│   ├── CourseDetailPage.ts           # Course detail POM
│   ├── AssignmentPage.ts             # Assignment POM
│   ├── QuizPage.ts                   # Quiz POM
│   ├── GradebookPage.ts              # Gradebook POM
│   ├── ForumPage.ts                  # Forum POM
│   ├── MessagingPage.ts              # Messaging POM
│   ├── DashboardPage.ts              # Dashboard POM
│   └── AdminPage.ts                  # Admin interface POM
├── utils/                             # Shared utility functions
│   ├── auth.ts                        # Authentication helpers
│   ├── fileUpload.ts                  # File upload utilities
│   ├── wait.ts                        # Wait and retry helpers
│   └── screenshot.ts                  # Screenshot utilities
├── auth.spec.ts                       # Authentication tests
├── course-catalog.spec.ts             # Course browsing tests
├── course-enrollment.spec.ts          # Enrollment workflow tests
├── assignment.spec.ts                 # Assignment submission tests
├── quiz.spec.ts                       # Quiz attempt tests
├── gradebook-student.spec.ts          # Student gradebook tests
├── gradebook-teacher.spec.ts          # Teacher grading tests
├── forum.spec.ts                      # Forum discussion tests
├── messaging.spec.ts                  # Messaging tests
├── dashboard.spec.ts                  # Dashboard widget tests
├── profile.spec.ts                    # Profile update tests
├── search.spec.ts                     # Global search tests
├── file-repository.spec.ts            # File operation tests
├── admin-user-management.spec.ts      # User management tests
├── admin-role-assignment.spec.ts      # Role assignment tests
└── logout.spec.ts                     # Logout tests
```

## Prerequisites

Before running E2E tests, ensure you have the following:

### Required Software

- **Node.js 20+**: Required for Playwright and test execution
- **npm 9+**: Package manager (comes with Node.js)

### Running Services

1. **React Frontend**: The development server must be running
   ```bash
   cd react-frontend
   npm run dev
   # Default: http://localhost:5173
   ```

2. **PHP Backend API**: The API layer must be accessible
   ```bash
   # Ensure your local Moodle instance is running
   # API should be accessible at http://localhost/moodle/api/v1/
   ```

3. **Test Database**: A dedicated test database with seed data
   - Use a separate database from development/production
   - Seed with test users, courses, and content
   - Database can be reset between test runs

### Environment Configuration

Create a `.env.test` file in `react-frontend/`:

```env
VITE_API_BASE_URL=http://localhost/moodle/api/v1
VITE_APP_URL=http://localhost:5173
TEST_USER_EMAIL=student@example.com
TEST_USER_PASSWORD=TestPassword123!
TEST_TEACHER_EMAIL=teacher@example.com
TEST_TEACHER_PASSWORD=TeacherPass123!
TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=AdminPass123!
```

## Running Tests

### Basic Commands

```bash
# Run all E2E tests (headless mode)
npm run test:e2e

# Run tests with Playwright Inspector (UI mode)
npm run test:e2e:ui

# Run specific test file
npx playwright test auth.spec.ts

# Run tests with visible browser (headed mode)
npx playwright test --headed

# Run with step-by-step debugger
npx playwright test --debug

# Run tests in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Run tests matching a pattern
npx playwright test --grep "login"

# Run tests in parallel (default)
npx playwright test --workers=4

# Run tests serially (one at a time)
npx playwright test --workers=1
```

### Advanced Commands

```bash
# Generate test report
npx playwright show-report

# Update Playwright browsers
npx playwright install

# Record a new test interactively
npx playwright codegen http://localhost:5173

# Run tests and generate trace
npx playwright test --trace on

# View trace for failed tests
npx playwright show-trace trace.zip

# Run only failed tests from last run
npx playwright test --last-failed
```

## Browser Support

By default, tests run in three browsers to ensure cross-browser compatibility:

- **Chromium**: Google Chrome and Microsoft Edge behavior
- **Firefox**: Mozilla Firefox behavior  
- **WebKit**: Safari behavior

Browser configuration is defined in `playwright.config.ts`. You can modify which browsers to test by updating the `projects` array in that file.

## Test Organization

Each test file covers a specific user journey or feature area:

### Foundational Tests

#### `auth.spec.ts` - Authentication and JWT

Tests the authentication flow with JWT token generation and validation:

- Login with valid credentials
- Receive JWT access and refresh tokens
- Token stored in httpOnly cookie or localStorage
- Protected route access with valid token
- Login failure with invalid credentials
- Token refresh workflow
- Session persistence across page reloads

**Why First**: All other tests depend on authentication working correctly.

### Course Management Tests

#### `course-catalog.spec.ts` - Course Browsing and Search

Tests course discovery and filtering:

- View course catalog with pagination
- Search courses by name
- Filter by category
- Sort courses (alphabetical, newest, popularity)
- View course details
- Check enrollment requirements

#### `course-enrollment.spec.ts` - Course Enrollment Workflow

Tests the complete enrollment process:

- Self-enrollment in open courses
- View enrollment confirmation
- Course appears in "My Courses"
- Access course content after enrollment
- Unenrollment workflow
- Enrollment restrictions respected

### Learning Activity Tests

#### `assignment.spec.ts` - Assignment Submission

Tests assignment submission with file uploads:

- View assignment instructions
- Upload file via drag-and-drop
- Submit assignment before deadline
- View submission confirmation
- Edit submission before deadline
- File size and type validation
- Late submission handling
- Submission status tracking

#### `quiz.spec.ts` - Quiz Attempts with Timer

Tests quiz-taking functionality:

- Start new quiz attempt
- Answer multiple question types (multiple choice, true/false, short answer)
- Auto-save answers periodically
- Quiz timer countdown display
- Navigation between questions
- Submit quiz before time expires
- View immediate feedback (if enabled)
- Review past attempts

#### `forum.spec.ts` - Forum Discussions

Tests forum interaction:

- View forum discussion list
- Create new discussion thread
- Reply to existing posts
- Edit own posts
- Delete own posts
- Subscribe to forum
- Mark discussions as read
- Search within forum

### Gradebook Tests

#### `gradebook-student.spec.ts` - Student Grade Viewing

Tests student gradebook interface:

- View grades for all courses
- Filter grades by course
- View grade details and feedback
- See grade item weight and category
- View overall course grade
- Export gradebook as PDF/CSV

#### `gradebook-teacher.spec.ts` - Teacher Grading

Tests teacher grading workflow:

- View all student submissions
- Grade individual submission
- Provide text feedback
- Upload feedback files
- Set grade and save
- Bulk grade multiple submissions
- Grade override functionality
- Gradebook aggregation calculations

### Communication Tests

#### `messaging.spec.ts` - Private Messaging

Tests messaging system:

- Send message to user
- Receive message notification
- View conversation thread
- Reply to message
- Mark messages as read
- Delete messages
- Search message history
- Block/unblock users

### Dashboard and Profile Tests

#### `dashboard.spec.ts` - Dashboard Widgets

Tests dashboard widget functionality:

- View calendar widget with events
- See upcoming assignments/quizzes
- View recent activity feed
- Check online users
- View timeline of due dates
- Course overview widget
- Customize dashboard layout

#### `profile.spec.ts` - Profile Updates

Tests user profile management:

- View own profile
- Edit profile fields (name, email, bio)
- Upload profile picture
- Update preferences (language, timezone)
- Change email notifications
- View public profile as other users see it

### Search and Files Tests

#### `search.spec.ts` - Global Search

Tests global search functionality:

- Search across all courses
- Search for users
- Filter search results
- View search result relevance
- Navigate to search results

#### `file-repository.spec.ts` - File Operations

Tests file management:

- Browse file repository
- Upload files to repository
- Download files
- Create folders
- Move files between folders
- Delete files
- View file thumbnails
- File search within repository

### Administration Tests

#### `admin-user-management.spec.ts` - User Management

Tests admin user operations (requires admin role):

- View user list with pagination
- Search users by name/email
- Create new user account
- Edit user details
- Suspend/activate user
- Delete user account
- Bulk user operations
- Export user list

#### `admin-role-assignment.spec.ts` - Role Management

Tests role and permission management (requires admin role):

- View roles list
- Assign role to user in course context
- Assign role to user in system context
- View role capabilities
- Remove role assignment
- Create custom role
- Edit role permissions

### Session Management Tests

#### `logout.spec.ts` - Logout and Session Cleanup

Tests logout workflow:

- Logout from application
- JWT token invalidated
- Redirect to login page
- Protected routes inaccessible after logout
- Session cleared from storage

## Page Object Models (POM)

Page Object Models encapsulate page interactions into reusable classes, making tests more maintainable and readable.

### Why Use Page Object Models?

**Benefits:**
- **Maintainability**: When UI changes, update the page object instead of every test
- **Reusability**: Share common page interactions across multiple tests
- **Readability**: Tests read like user stories, not DOM manipulation code
- **Type Safety**: TypeScript ensures correct method usage

### Page Object Structure

```typescript
// pages/LoginPage.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('[data-testid="email-input"]');
    this.passwordInput = page.locator('[data-testid="password-input"]');
    this.loginButton = page.locator('[data-testid="login-button"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
  }

  async navigate() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async getErrorMessage(): Promise<string> {
    return await this.errorMessage.textContent() || '';
  }

  async waitForRedirect() {
    await this.page.waitForURL('/dashboard');
  }
}
```

### Using Page Objects in Tests

```typescript
// auth.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test('successful login redirects to dashboard', async ({ page }) => {
  const loginPage = new LoginPage(page);
  
  await loginPage.navigate();
  await loginPage.login('student@example.com', 'TestPassword123!');
  await loginPage.waitForRedirect();
  
  expect(page.url()).toContain('/dashboard');
});
```

### Creating New Page Objects

When creating a new page object:

1. **Extend from a base if needed** (for common functionality)
2. **Use data-testid attributes** for stable selectors
3. **Encapsulate all page interactions** in methods
4. **Return promises** for async operations
5. **Add TypeScript types** for method parameters and return values

## Test Fixtures

Fixtures provide test data and setup helpers to make tests more reliable and maintainable.

### User Fixtures

```typescript
// fixtures/users.ts
export const testUsers = {
  student: {
    email: 'student@example.com',
    password: 'TestPassword123!',
    role: 'student',
    firstName: 'Test',
    lastName: 'Student'
  },
  teacher: {
    email: 'teacher@example.com',
    password: 'TeacherPass123!',
    role: 'teacher',
    firstName: 'Test',
    lastName: 'Teacher'
  },
  admin: {
    email: 'admin@example.com',
    password: 'AdminPass123!',
    role: 'admin',
    firstName: 'Test',
    lastName: 'Admin'
  }
};
```

### Course Fixtures

```typescript
// fixtures/courses.ts
export const testCourses = {
  mathCourse: {
    id: 1,
    shortname: 'MATH101',
    fullname: 'Introduction to Mathematics',
    category: 'Mathematics',
    enrollmentMethod: 'self'
  },
  scienceCourse: {
    id: 2,
    shortname: 'SCI101',
    fullname: 'General Science',
    category: 'Science',
    enrollmentMethod: 'manual'
  }
};
```

### Test Data Generation

```typescript
// fixtures/testData.ts
export function generateTestFile(sizeInKB: number): File {
  const content = 'x'.repeat(sizeInKB * 1024);
  return new File([content], `test-file-${Date.now()}.txt`, {
    type: 'text/plain'
  });
}

export function generateRandomEmail(): string {
  return `test-${Date.now()}@example.com`;
}

export function generateCourseData() {
  return {
    shortname: `TEST${Date.now()}`,
    fullname: `Test Course ${Date.now()}`,
    summary: 'Auto-generated test course',
    category: 1
  };
}
```

### Using Fixtures in Tests

```typescript
import { test, expect } from '@playwright/test';
import { testUsers } from './fixtures/users';
import { testCourses } from './fixtures/courses';

test('student can enroll in course', async ({ page }) => {
  const { student } = testUsers;
  const { mathCourse } = testCourses;
  
  // Use fixture data in test
  await loginAsUser(page, student);
  await enrollInCourse(page, mathCourse.id);
  
  // Assertions...
});
```

## Test Utilities

Utility functions provide reusable helpers for common test operations.

### Authentication Helpers

```typescript
// utils/auth.ts
import { Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

export async function loginAsStudent(page: Page) {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login(
    process.env.TEST_USER_EMAIL!,
    process.env.TEST_USER_PASSWORD!
  );
  await loginPage.waitForRedirect();
}

export async function loginAsTeacher(page: Page) {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login(
    process.env.TEST_TEACHER_EMAIL!,
    process.env.TEST_TEACHER_PASSWORD!
  );
  await loginPage.waitForRedirect();
}

export async function getAuthToken(page: Page): Promise<string> {
  // Extract JWT token from cookie or localStorage
  const token = await page.evaluate(() => {
    return localStorage.getItem('accessToken');
  });
  return token || '';
}

export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('/login');
}
```

### File Upload Helpers

```typescript
// utils/fileUpload.ts
import { Page, FileChooser } from '@playwright/test';

export async function uploadFile(
  page: Page,
  inputSelector: string,
  filePath: string
) {
  const fileInput = page.locator(inputSelector);
  await fileInput.setInputFiles(filePath);
}

export async function uploadFileViaDropZone(
  page: Page,
  dropZoneSelector: string,
  filePath: string
) {
  const dropZone = page.locator(dropZoneSelector);
  
  // Simulate drag and drop
  await dropZone.dispatchEvent('drop', {
    dataTransfer: {
      files: [filePath]
    }
  });
}
```

### Wait and Retry Utilities

```typescript
// utils/wait.ts
import { Page } from '@playwright/test';

export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout: number = 10000
) {
  return page.waitForResponse(
    response => {
      const url = response.url();
      return typeof urlPattern === 'string'
        ? url.includes(urlPattern)
        : urlPattern.test(url);
    },
    { timeout }
  );
}

export async function retryUntilSuccess<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Retry failed');
}

export async function waitForLoadingToFinish(page: Page) {
  await page.waitForSelector('[data-testid="loading-spinner"]', {
    state: 'detached',
    timeout: 10000
  });
}
```

### Screenshot Utilities

```typescript
// utils/screenshot.ts
import { Page } from '@playwright/test';
import * as path from 'path';

export async function takeScreenshot(
  page: Page,
  name: string
) {
  const screenshotPath = path.join(
    process.cwd(),
    'test-results',
    'screenshots',
    `${name}-${Date.now()}.png`
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved: ${screenshotPath}`);
}

export async function takeScreenshotOnFailure(
  page: Page,
  testInfo: any
) {
  if (testInfo.status !== testInfo.expectedStatus) {
    const screenshotPath = testInfo.outputPath(`failure-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
}
```

## Writing New Tests

### Test Structure

Follow this structure for new E2E tests:

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { testUsers } from './fixtures/users';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Login, navigate, etc.
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(testUsers.student.email, testUsers.student.password);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: Delete test data, logout, etc.
  });

  test('should perform specific action', async ({ page }) => {
    // Arrange: Set up test preconditions
    await page.goto('/feature-url');
    
    // Act: Perform user action
    await page.click('[data-testid="action-button"]');
    
    // Assert: Verify expected outcome
    await expect(page.locator('[data-testid="success-message"]'))
      .toBeVisible();
    expect(page.url()).toContain('/expected-route');
  });

  test('should handle error case', async ({ page }) => {
    // Test error scenarios
  });
});
```

### Setup and Teardown Patterns

```typescript
// Global setup (runs once before all tests)
test.beforeAll(async () => {
  // Database seeding, global configuration
});

// Global teardown (runs once after all tests)
test.afterAll(async () => {
  // Cleanup global state
});

// Per-test setup (runs before each test)
test.beforeEach(async ({ page }) => {
  // Login, navigate to starting point
});

// Per-test teardown (runs after each test)
test.afterEach(async ({ page, context }) => {
  // Clear cookies, local storage
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
});
```

### Using Page Object Models

```typescript
import { CourseDetailPage } from './pages/CourseDetailPage';

test('should display course information', async ({ page }) => {
  const coursePage = new CourseDetailPage(page);
  
  await coursePage.navigate(123); // course ID
  await coursePage.waitForLoad();
  
  const courseName = await coursePage.getCourseName();
  expect(courseName).toBe('Introduction to Mathematics');
  
  const isEnrolled = await coursePage.isUserEnrolled();
  expect(isEnrolled).toBe(false);
});
```

### Handling Async Operations

```typescript
test('should wait for API response', async ({ page }) => {
  // Wait for specific API call
  const responsePromise = page.waitForResponse(
    response => response.url().includes('/api/v1/courses') && response.status() === 200
  );
  
  await page.click('[data-testid="load-courses-button"]');
  const response = await responsePromise;
  
  const data = await response.json();
  expect(data.success).toBe(true);
});

test('should wait for element to appear', async ({ page }) => {
  // Wait for element with timeout
  await page.waitForSelector('[data-testid="course-list"]', {
    state: 'visible',
    timeout: 5000
  });
});
```

### Error Handling and Debugging

```typescript
test('should handle errors gracefully', async ({ page }) => {
  try {
    await page.click('[data-testid="submit-button"]');
    await page.waitForSelector('[data-testid="success-message"]', {
      timeout: 5000
    });
  } catch (error) {
    // Take screenshot on error
    await page.screenshot({ path: 'error-screenshot.png' });
    throw error;
  }
});

test('debug test with pause', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Pause execution for manual inspection
  await page.pause();
  
  await page.click('[data-testid="some-button"]');
});
```

## Best Practices

### Use Stable Selectors

**Good**: Use data-testid attributes
```typescript
await page.click('[data-testid="submit-button"]');
```

**Bad**: Use CSS classes or complex selectors
```typescript
await page.click('.btn.btn-primary.submit'); // Fragile
```

### Keep Tests Independent

Each test should be able to run in isolation:

```typescript
// Good: Self-contained test
test('should submit assignment', async ({ page }) => {
  await loginAsStudent(page);
  await navigateToAssignment(page, 123);
  await uploadFile(page, 'test.pdf');
  await submitAssignment(page);
  
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});

// Bad: Depends on previous test state
test('should submit assignment', async ({ page }) => {
  // Assumes user is already logged in
  await page.click('[data-testid="submit-button"]');
});
```

### Clean Up Test Data

```typescript
test('should create and delete user', async ({ page }) => {
  const testEmail = generateRandomEmail();
  
  try {
    // Create user
    await createUser(page, testEmail);
    
    // Test functionality
    await verifyUserExists(page, testEmail);
  } finally {
    // Always clean up, even if test fails
    await deleteUser(page, testEmail);
  }
});
```

### Use Meaningful Test Names

```typescript
// Good: Descriptive test names
test('should display error when submitting assignment after deadline', async ({ page }) => {
  // ...
});

test('should allow teacher to grade multiple submissions at once', async ({ page }) => {
  // ...
});

// Bad: Vague test names
test('test assignment', async ({ page }) => {
  // ...
});

test('grading works', async ({ page }) => {
  // ...
});
```

### Test User Behavior, Not Implementation

```typescript
// Good: Tests what user sees and does
test('should enroll in course', async ({ page }) => {
  await page.click('[data-testid="enroll-button"]');
  await expect(page.locator('[data-testid="enrolled-badge"]')).toBeVisible();
});

// Bad: Tests implementation details
test('should call enrollment API', async ({ page }) => {
  const apiCalled = false;
  // Testing internal API call instead of user outcome
});
```

### Handle Timing Issues Properly

```typescript
// Good: Wait for specific condition
await page.waitForSelector('[data-testid="success-message"]', {
  state: 'visible'
});

// Bad: Arbitrary waits
await page.waitForTimeout(3000); // Fragile
```

### Use Test Context

```typescript
test('should maintain authentication', async ({ page, context }) => {
  // Login
  await loginAsStudent(page);
  
  // Get cookies from context
  const cookies = await context.cookies();
  const authCookie = cookies.find(c => c.name === 'auth_token');
  
  expect(authCookie).toBeDefined();
  expect(authCookie?.httpOnly).toBe(true);
});
```

## Debugging Failed Tests

### Screenshots on Failure

Playwright automatically captures screenshots when tests fail:

```
test-results/
├── auth-spec-ts-should-login-successfully-chromium/
│   ├── test-failed-1.png
│   └── trace.zip
```

To view screenshots:
```bash
# Navigate to test-results directory
ls test-results/

# Open specific screenshot
open test-results/[test-name]/test-failed-1.png
```

### Videos for Failed Tests

Enable video recording in `playwright.config.ts`:

```typescript
use: {
  video: 'retain-on-failure', // or 'on' to record all tests
}
```

Videos are saved in `test-results/[test-name]/video.webm`.

### Playwright Trace Viewer

Traces provide a complete timeline of test execution:

```bash
# Run tests with trace
npx playwright test --trace on

# View trace for failed test
npx playwright show-trace test-results/[test-name]/trace.zip
```

The trace viewer shows:
- Screenshots at each step
- Network requests and responses
- Console logs
- DOM snapshots
- Action timeline

### Common Issues and Solutions

#### Issue: Element not found

**Problem**: `Error: Locator resolved to no elements`

**Solutions**:
- Check if element is rendered (React component loaded)
- Wait for element to appear: `await page.waitForSelector('[data-testid="element"]')`
- Verify data-testid attribute exists in component
- Check if element is hidden or behind modal

#### Issue: Test timeout

**Problem**: `Test timeout of 30000ms exceeded`

**Solutions**:
- Increase timeout: `test.setTimeout(60000)`
- Check if API is responding
- Verify network requests complete successfully
- Look for loading spinners that never finish

#### Issue: Flaky tests

**Problem**: Tests pass sometimes, fail other times

**Solutions**:
- Use explicit waits instead of arbitrary timeouts
- Wait for network idle: `await page.waitForLoadState('networkidle')`
- Check for race conditions in React components
- Ensure test data is properly seeded

#### Issue: Authentication fails

**Problem**: Cannot log in during tests

**Solutions**:
- Verify test credentials in `.env.test`
- Check if JWT secret is configured correctly
- Ensure API is accessible from test environment
- Clear cookies/localStorage before login: `await context.clearCookies()`

## CI/CD Integration

### Running Tests in CI

Tests automatically run on pull requests via GitHub Actions:

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
        working-directory: react-frontend
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
        working-directory: react-frontend
      
      - name: Run E2E tests
        run: npm run test:e2e
        working-directory: react-frontend
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: react-frontend/playwright-report/
```

### Parallel Execution in CI

Tests run in parallel to reduce total execution time:

```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 2 : undefined, // Use 2 workers in CI
  retries: process.env.CI ? 2 : 0, // Retry failed tests in CI
});
```

### Test Result Reporting

Test results are published as CI artifacts and visible in the GitHub Actions UI. HTML reports are generated with detailed information about each test run.

## Performance Considerations

### Execution Time Target

**Goal**: All 15 E2E tests should complete in **under 10 minutes**.

Current breakdown:
- Authentication: ~30 seconds
- Course operations: ~2 minutes
- Learning activities: ~3 minutes
- Gradebook: ~1 minute
- Messaging/profile: ~1 minute
- Admin operations: ~1.5 minutes
- Cleanup: ~30 seconds

**Total**: ~9 minutes (with parallelization)

### Parallel Execution

Configure parallel execution in `playwright.config.ts`:

```typescript
workers: process.env.CI ? 2 : 4, // Run 4 tests in parallel locally
```

Tests are isolated and can run concurrently without conflicts.

### Browser Reuse

Playwright reuses browser contexts between tests for speed:

```typescript
use: {
  reuseExistingServer: true,
  // Browser context is reused for tests in same file
}
```

### Optimizations Applied

1. **Shared Authentication**: Login once and reuse auth state across tests
2. **Lazy Loading**: Only load test fixtures when needed
3. **Minimal Navigation**: Navigate directly to test pages instead of clicking through UI
4. **Fast Selectors**: Use data-testid for instant element location
5. **Parallel Workers**: Multiple tests run simultaneously
6. **Browser Context Reuse**: Avoid launching new browsers for each test

## Additional Resources

- **Playwright Documentation**: https://playwright.dev/
- **Playwright Best Practices**: https://playwright.dev/docs/best-practices
- **React Testing Best Practices**: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library
- **CI/CD Integration Guide**: https://playwright.dev/docs/ci

## Support and Contributions

### Getting Help

- Check this README for common issues
- Review existing test files for examples
- Consult Playwright documentation
- Ask the team in #testing Slack channel

### Contributing New Tests

When adding new E2E tests:

1. **Follow naming conventions**: `feature-name.spec.ts`
2. **Create Page Object Model**: Add to `pages/` directory
3. **Add test fixtures** if needed: Add to `fixtures/` directory
4. **Document in this README**: Add entry to Test Organization section
5. **Run tests locally**: Ensure they pass before PR
6. **Update CI configuration** if needed: Modify `.github/workflows/e2e-tests.yml`

### Code Review Checklist

- [ ] Tests follow Page Object Model pattern
- [ ] Selectors use data-testid attributes
- [ ] Tests are independent and can run in any order
- [ ] Test data is cleaned up after test execution
- [ ] Meaningful test and assertion messages
- [ ] No arbitrary timeouts (use explicit waits)
- [ ] Tests pass in all three browsers (Chromium, Firefox, WebKit)
- [ ] Documentation updated in this README

---

**Last Updated**: December 2024  
**Maintained By**: Moodle React Frontend Team  
**Version**: 1.0.0
