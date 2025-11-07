# Testing Guide

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Testing Stack Overview](#testing-stack-overview)
- [Unit Testing](#unit-testing)
- [Component Testing](#component-testing)
- [Integration Testing](#integration-testing)
- [End-to-End (E2E) Testing](#end-to-end-e2e-testing)
- [API Mocking with MSW](#api-mocking-with-msw)
- [Accessibility Testing](#accessibility-testing)
- [Coverage Requirements](#coverage-requirements)
- [Testing Best Practices](#testing-best-practices)
- [Validation Tests](#validation-tests)
- [Continuous Integration](#continuous-integration)
- [Troubleshooting](#troubleshooting)

## Testing Philosophy

The Moodle React frontend maintains rigorous testing standards to ensure reliability, maintainability, and functional parity with the existing PHP implementation.

### Core Principles

1. **High Coverage Target**: We aim for **90%+ test coverage** for critical business logic to catch regressions early and maintain confidence in refactoring efforts.

2. **Testing Pyramid Approach**: Our test distribution follows the testing pyramid:
   - **Base (70%)**: Unit tests - fast, isolated, numerous
   - **Middle (20%)**: Integration tests - feature workflows, component interactions
   - **Top (10%)**: E2E tests - critical user journeys, end-to-end scenarios

3. **Functional Parity**: All tests must verify that the React frontend produces identical outcomes to the PHP version, especially for:
   - Grade calculations
   - Permission checks
   - Enrollment workflows
   - File operations
   - Quiz attempt handling

4. **User-Centric Testing**: Tests should focus on user behavior and outcomes, not implementation details. If a refactor maintains the same user-facing behavior, tests should continue passing.

5. **Accessibility as a Priority**: WCAG 2.1 AA compliance is validated through automated and manual testing for every user-facing component.

## Testing Stack Overview

Our comprehensive testing infrastructure leverages modern, industry-standard tools:

### Unit & Integration Testing

**Vitest** (^1.0.4) - Our primary test framework
- ⚡ Fast execution with Vite's native speed
- 🔄 Watch mode for instant feedback during development
- 📊 Built-in coverage reporting with c8
- 🎯 Jest-compatible API for easy migration
- 🧩 ESM and TypeScript support out of the box

**React Testing Library** (@testing-library/react ^14.1.2)
- 👤 User-centric testing approach
- ♿ Accessibility-focused queries
- 🎭 Tests behavior, not implementation
- 🔍 Encourages best practices

### E2E Testing

**Playwright** (@playwright/test ^1.40.1)
- 🌐 Cross-browser support (Chromium, Firefox, WebKit)
- 📱 Mobile viewport emulation
- 🎥 Video and screenshot capture on failure
- 🔧 Powerful debugging tools
- ⚡ Parallel test execution

### API Mocking

**MSW (Mock Service Worker)** (^2.0.11)
- 🌐 Network request interception
- 🎯 REST API mocking
- 🔄 Reusable mock handlers
- 🧪 Works in both Node and browser environments

### Accessibility Testing

**jest-axe** (@testing-library/jest-dom ^6.1.5)
- ♿ Automated WCAG 2.1 AA compliance checks
- 🔍 Detects common accessibility issues
- 🎯 Integrates seamlessly with testing workflow

## Unit Testing

Unit tests verify individual functions, hooks, and utilities in isolation.

### Running Unit Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode (interactive)
npm run test:ui

# Run tests with coverage
npm run coverage

# Run specific test file
npm test -- src/utils/date.test.ts

# Run tests matching a pattern
npm test -- --grep="formatDate"
```

### Test File Conventions

- Test files must be co-located with source files or in `tests/unit/`
- Naming convention: `*.test.ts` or `*.test.tsx`
- One test file per source file

**Example Structure:**
```
src/
  utils/
    date.ts           # Source file
    date.test.ts      # Test file
  hooks/
    useAuth.ts        # Source file
    useAuth.test.ts   # Test file
```

### Writing Unit Tests

#### Testing Utilities

```typescript
// src/utils/date.test.ts
import { describe, it, expect } from 'vitest';
import { formatDate, isWithinDeadline, calculateDuration } from './date';

describe('date utilities', () => {
  describe('formatDate', () => {
    it('should format date to ISO 8601 string', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = formatDate(date, 'yyyy-MM-dd');
      
      expect(result).toBe('2024-01-15');
    });

    it('should handle invalid dates gracefully', () => {
      const result = formatDate(null, 'yyyy-MM-dd');
      
      expect(result).toBe('');
    });

    it('should support custom formats', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = formatDate(date, 'MMM dd, yyyy');
      
      expect(result).toBe('Jan 15, 2024');
    });
  });

  describe('isWithinDeadline', () => {
    it('should return true when date is before deadline', () => {
      const currentDate = new Date('2024-01-10');
      const deadline = new Date('2024-01-15');
      
      const result = isWithinDeadline(currentDate, deadline);
      
      expect(result).toBe(true);
    });

    it('should return false when date is after deadline', () => {
      const currentDate = new Date('2024-01-20');
      const deadline = new Date('2024-01-15');
      
      const result = isWithinDeadline(currentDate, deadline);
      
      expect(result).toBe(false);
    });

    it('should return true when date equals deadline', () => {
      const currentDate = new Date('2024-01-15T00:00:00Z');
      const deadline = new Date('2024-01-15T23:59:59Z');
      
      const result = isWithinDeadline(currentDate, deadline);
      
      expect(result).toBe(true);
    });
  });
});
```

#### Testing Custom Hooks

```typescript
// src/hooks/usePagination.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from './usePagination';

describe('usePagination', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100 }));
    
    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(20);
    expect(result.current.totalPages).toBe(5);
  });

  it('should navigate to next page', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100 }));
    
    act(() => {
      result.current.nextPage();
    });
    
    expect(result.current.currentPage).toBe(2);
  });

  it('should not exceed total pages', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100 }));
    
    // Go to last page
    act(() => {
      result.current.goToPage(5);
    });
    
    // Attempt to go beyond
    act(() => {
      result.current.nextPage();
    });
    
    expect(result.current.currentPage).toBe(5);
  });

  it('should navigate to previous page', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100 }));
    
    act(() => {
      result.current.goToPage(3);
    });
    
    act(() => {
      result.current.previousPage();
    });
    
    expect(result.current.currentPage).toBe(2);
  });

  it('should calculate correct start and end indices', () => {
    const { result } = renderHook(() => usePagination({ 
      totalItems: 100,
      pageSize: 10 
    }));
    
    act(() => {
      result.current.goToPage(3);
    });
    
    expect(result.current.startIndex).toBe(20);
    expect(result.current.endIndex).toBe(30);
  });
});
```

### Mocking Dependencies

#### Mocking External Libraries

```typescript
import { vi, describe, it, expect } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('API client', () => {
  it('should make GET request with correct headers', async () => {
    const mockData = { id: 1, name: 'Test Course' };
    vi.mocked(axios.get).mockResolvedValue({ data: mockData });
    
    const result = await fetchCourse(1);
    
    expect(axios.get).toHaveBeenCalledWith('/api/v1/courses/1', {
      headers: expect.objectContaining({
        'Authorization': expect.stringContaining('Bearer ')
      })
    });
    expect(result).toEqual(mockData);
  });
});
```

#### Mocking Internal Modules

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/services/auth/authService', () => ({
  getToken: vi.fn(() => 'mock-jwt-token'),
  isAuthenticated: vi.fn(() => true),
}));

describe('Component with auth dependency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use token from auth service', () => {
    // Test implementation
  });
});
```

## Component Testing

Component tests verify that React components render correctly and respond appropriately to user interactions.

### React Testing Library Principles

1. **Query by Role**: Prefer accessible queries (`getByRole`, `getByLabelText`)
2. **Test User Behavior**: Simulate real user interactions
3. **Avoid Implementation Details**: Don't test state, props, or component methods directly
4. **Wait for Async Updates**: Use `waitFor`, `findBy` queries for async behavior

### Writing Component Tests

#### Basic Component Test

```typescript
// src/components/forms/FormInput.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormInput } from './FormInput';

describe('FormInput', () => {
  it('should render input with label', () => {
    render(
      <FormInput 
        name="email" 
        label="Email Address" 
        type="email" 
      />
    );
    
    const input = screen.getByLabelText('Email Address');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'email');
  });

  it('should handle user input', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    
    render(
      <FormInput 
        name="email" 
        label="Email Address" 
        onChange={handleChange}
      />
    );
    
    const input = screen.getByLabelText('Email Address');
    await user.type(input, 'test@example.com');
    
    expect(input).toHaveValue('test@example.com');
    expect(handleChange).toHaveBeenCalled();
  });

  it('should display error message when validation fails', () => {
    render(
      <FormInput 
        name="email" 
        label="Email Address" 
        error="Invalid email format"
      />
    );
    
    const errorMessage = screen.getByText('Invalid email format');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveAttribute('role', 'alert');
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <FormInput 
        name="email" 
        label="Email Address" 
        disabled 
      />
    );
    
    const input = screen.getByLabelText('Email Address');
    expect(input).toBeDisabled();
  });

  it('should mark field as required with asterisk', () => {
    render(
      <FormInput 
        name="email" 
        label="Email Address" 
        required 
      />
    );
    
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});
```

#### Testing with Context Providers

```typescript
// src/features/courses/components/CourseCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { CourseCard } from './CourseCard';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('CourseCard', () => {
  const mockCourse = {
    id: 1,
    fullname: 'Introduction to React',
    shortname: 'REACT101',
    summary: 'Learn React fundamentals',
    enrollmentCount: 150,
    imageUrl: '/course-image.jpg',
  };

  it('should display course information', () => {
    render(<CourseCard course={mockCourse} />, {
      wrapper: createWrapper(),
    });
    
    expect(screen.getByText('Introduction to React')).toBeInTheDocument();
    expect(screen.getByText('REACT101')).toBeInTheDocument();
    expect(screen.getByText(/Learn React fundamentals/i)).toBeInTheDocument();
    expect(screen.getByText('150 students enrolled')).toBeInTheDocument();
  });

  it('should navigate to course detail on click', async () => {
    const user = userEvent.setup();
    
    render(<CourseCard course={mockCourse} />, {
      wrapper: createWrapper(),
    });
    
    const card = screen.getByRole('article');
    await user.click(card);
    
    // Verify navigation occurred
    expect(window.location.pathname).toBe('/courses/1');
  });
});
```

#### Testing Async Behavior

```typescript
// src/features/courses/components/CourseList.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { CourseList } from './CourseList';

const server = setupServer(
  rest.get('/api/v1/courses', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: [
        { id: 1, fullname: 'Course 1', shortname: 'C1' },
        { id: 2, fullname: 'Course 2', shortname: 'C2' },
      ],
    }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('CourseList', () => {
  it('should display loading state initially', () => {
    render(<CourseList />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display courses after loading', async () => {
    render(<CourseList />);
    
    await waitFor(() => {
      expect(screen.getByText('Course 1')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Course 2')).toBeInTheDocument();
  });

  it('should display error message on API failure', async () => {
    server.use(
      rest.get('/api/v1/courses', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({
          success: false,
          error: { message: 'Server error' },
        }));
      })
    );
    
    render(<CourseList />);
    
    await waitFor(() => {
      expect(screen.getByText(/error loading courses/i)).toBeInTheDocument();
    });
  });

  it('should display empty state when no courses', async () => {
    server.use(
      rest.get('/api/v1/courses', (req, res, ctx) => {
        return res(ctx.json({ success: true, data: [] }));
      })
    );
    
    render(<CourseList />);
    
    await waitFor(() => {
      expect(screen.getByText(/no courses available/i)).toBeInTheDocument();
    });
  });
});
```

## Integration Testing

Integration tests verify that multiple components, hooks, and services work together correctly in realistic workflows.

### Testing Feature Workflows

```typescript
// tests/integration/enrollment.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { store } from '@/app/store';
import { CourseDetailPage } from '@/features/courses/pages/CourseDetailPage';

const server = setupServer(
  rest.get('/api/v1/courses/:id', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: {
        id: 1,
        fullname: 'Test Course',
        enrolled: false,
        canEnroll: true,
      },
    }));
  }),
  rest.post('/api/v1/courses/:id/enroll', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: { enrolled: true },
    }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </Provider>
    </BrowserRouter>
  );
};

describe('Course Enrollment Integration', () => {
  it('should complete enrollment workflow', async () => {
    const user = userEvent.setup();
    
    render(<CourseDetailPage />, { wrapper: createWrapper() });
    
    // Wait for course to load
    await waitFor(() => {
      expect(screen.getByText('Test Course')).toBeInTheDocument();
    });
    
    // Click enroll button
    const enrollButton = screen.getByRole('button', { name: /enroll/i });
    expect(enrollButton).toBeEnabled();
    
    await user.click(enrollButton);
    
    // Verify optimistic update (button becomes disabled)
    expect(enrollButton).toBeDisabled();
    
    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText(/successfully enrolled/i)).toBeInTheDocument();
    });
    
    // Verify button state updated
    expect(screen.getByRole('button', { name: /view course/i })).toBeInTheDocument();
  });

  it('should handle enrollment failure gracefully', async () => {
    const user = userEvent.setup();
    
    server.use(
      rest.post('/api/v1/courses/:id/enroll', (req, res, ctx) => {
        return res(ctx.status(403), ctx.json({
          success: false,
          error: { message: 'You do not have permission to enroll' },
        }));
      })
    );
    
    render(<CourseDetailPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Test Course')).toBeInTheDocument();
    });
    
    const enrollButton = screen.getByRole('button', { name: /enroll/i });
    await user.click(enrollButton);
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/you do not have permission/i)).toBeInTheDocument();
    });
    
    // Verify button reverted to original state
    expect(screen.getByRole('button', { name: /enroll/i })).toBeEnabled();
  });
});
```

### Testing Redux State Integration

```typescript
// tests/integration/auth-state.test.tsx
import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, { setUser, logout } from '@/features/auth/store/authSlice';

describe('Auth State Integration', () => {
  it('should handle user login flow', () => {
    const store = configureStore({
      reducer: { auth: authReducer },
    });
    
    // Initial state
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.isAuthenticated).toBe(false);
    
    // User logs in
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      roles: ['student'],
    };
    
    store.dispatch(setUser(mockUser));
    
    // State updated
    expect(store.getState().auth.user).toEqual(mockUser);
    expect(store.getState().auth.isAuthenticated).toBe(true);
    
    // User logs out
    store.dispatch(logout());
    
    // State cleared
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.isAuthenticated).toBe(false);
  });
});
```

## End-to-End (E2E) Testing

E2E tests validate critical user journeys across the entire application, from the user's perspective.

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/login.spec.ts

# Run in specific browser
npx playwright test --project=chromium

# Debug mode with Playwright Inspector
npx playwright test --debug
```

### Playwright Configuration

E2E tests are configured in `playwright.config.ts` with:
- Cross-browser support (Chromium, Firefox, WebKit)
- Mobile viewport emulation
- Video recording on failure
- Screenshot capture on failure
- Parallel execution

### Critical User Journeys (15 Tests)

1. **Authentication Flow** - Login, logout, token refresh
2. **Course Enrollment** - Browse catalog, enroll in course
3. **Assignment Submission** - Upload file, submit assignment
4. **Quiz Attempt** - Start quiz, answer questions, submit
5. **Grading Workflow** - Teacher grades submission
6. **Forum Posting** - Create discussion, add reply
7. **Messaging** - Send message, receive notification
8. **Profile Update** - Edit user profile, upload avatar
9. **Dashboard Navigation** - Access widgets, view activities
10. **File Download** - Access course resource, download file
11. **Grade Viewing** - Student views gradebook
12. **Admin User Management** - Create user, assign role
13. **Course Creation** - Admin creates new course
14. **Search Functionality** - Search courses, filter results
15. **Accessibility Navigation** - Keyboard navigation, screen reader

### Writing E2E Tests

#### Page Object Model Pattern

```typescript
// tests/e2e/pages/LoginPage.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.errorMessage = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent();
  }
}
```

#### E2E Test Example

```typescript
// tests/e2e/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

test.describe('Authentication', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.login('student', 'password123');

    // Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Verify user greeting
    await expect(dashboardPage.userGreeting).toContainText('Welcome, Student');
    
    // Verify token stored
    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(token).toBeTruthy();
  });

  test('should display error with invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login('invaliduser', 'wrongpassword');

    // Verify error message
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain('Invalid username or password');
    
    // Verify still on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should logout successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login first
    await loginPage.goto();
    await loginPage.login('student', 'password123');
    await expect(page).toHaveURL(/\/dashboard/);

    // Logout
    await dashboardPage.userMenu.click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();

    // Verify redirect to login
    await expect(page).toHaveURL(/\/login/);
    
    // Verify token removed
    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(token).toBeNull();
  });
});
```

#### Assignment Submission E2E Test

```typescript
// tests/e2e/assignment-submission.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Assignment Submission', () => {
  test.beforeEach(async ({ page }) => {
    // Login as student
    await page.goto('/login');
    await page.getByLabel('Username').fill('student');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should submit assignment with file upload', async ({ page }) => {
    // Navigate to course
    await page.goto('/courses/1');
    await expect(page.getByRole('heading', { name: /course name/i })).toBeVisible();

    // Click on assignment
    await page.getByText('Assignment 1').click();
    await expect(page).toHaveURL(/\/assignments\/1/);

    // Upload file
    const filePath = path.join(__dirname, 'fixtures', 'sample-assignment.pdf');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // Verify file appears in upload zone
    await expect(page.getByText('sample-assignment.pdf')).toBeVisible();

    // Add submission text
    await page.getByLabel('Submission comments').fill('This is my submission');

    // Submit assignment
    await page.getByRole('button', { name: 'Submit Assignment' }).click();

    // Verify success message
    await expect(page.getByText(/successfully submitted/i)).toBeVisible();

    // Verify submission appears in list
    await expect(page.getByText('Submitted')).toBeVisible();
    await expect(page.getByText(new RegExp(new Date().toDateString()))).toBeVisible();
  });

  test('should prevent submission after deadline', async ({ page }) => {
    // Navigate to overdue assignment
    await page.goto('/assignments/2');

    // Verify submission button is disabled
    const submitButton = page.getByRole('button', { name: 'Submit Assignment' });
    await expect(submitButton).toBeDisabled();

    // Verify deadline warning
    await expect(page.getByText(/deadline has passed/i)).toBeVisible();
  });
});
```

## API Mocking with MSW

Mock Service Worker (MSW) intercepts network requests at the network level, providing realistic API mocking for tests.

### Setting Up MSW

```typescript
// src/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  // Auth endpoints
  rest.post('/api/v1/auth/login', (req, res, ctx) => {
    const { username, password } = req.body as any;

    if (username === 'student' && password === 'password123') {
      return res(
        ctx.json({
          success: true,
          data: {
            accessToken: 'mock-jwt-token',
            refreshToken: 'mock-refresh-token',
            user: {
              id: 1,
              username: 'student',
              email: 'student@example.com',
              roles: ['student'],
            },
          },
        })
      );
    }

    return res(
      ctx.status(401),
      ctx.json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        },
      })
    );
  }),

  // Course endpoints
  rest.get('/api/v1/courses', (req, res, ctx) => {
    const page = req.url.searchParams.get('page') || '1';
    const perPage = req.url.searchParams.get('perPage') || '20';

    return res(
      ctx.json({
        success: true,
        data: [
          {
            id: 1,
            fullname: 'Introduction to React',
            shortname: 'REACT101',
            enrolled: true,
          },
          {
            id: 2,
            fullname: 'Advanced TypeScript',
            shortname: 'TS201',
            enrolled: false,
          },
        ],
        meta: {
          pagination: {
            page: parseInt(page),
            perPage: parseInt(perPage),
            total: 50,
            totalPages: 3,
          },
        },
      })
    );
  }),

  rest.get('/api/v1/courses/:id', (req, res, ctx) => {
    const { id } = req.params;

    return res(
      ctx.json({
        success: true,
        data: {
          id: parseInt(id as string),
          fullname: 'Introduction to React',
          shortname: 'REACT101',
          summary: 'Learn React fundamentals',
          enrolled: true,
          sections: [
            {
              id: 1,
              name: 'Week 1',
              activities: [
                { id: 1, type: 'assignment', name: 'Assignment 1' },
                { id: 2, type: 'quiz', name: 'Quiz 1' },
              ],
            },
          ],
        },
      })
    );
  }),

  // Assignment endpoints
  rest.post('/api/v1/assignments/:id/submit', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: {
          submissionId: 123,
          status: 'submitted',
          submittedAt: new Date().toISOString(),
        },
      })
    );
  }),
];
```

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// vitest.setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './src/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Testing Error Scenarios

```typescript
// tests/integration/error-handling.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { server } from '@/mocks/server';
import { CourseList } from '@/features/courses/components/CourseList';

describe('Error Handling', () => {
  it('should handle 404 errors', async () => {
    server.use(
      rest.get('/api/v1/courses', (req, res, ctx) => {
        return res(
          ctx.status(404),
          ctx.json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Resource not found',
            },
          })
        );
      })
    );

    render(<CourseList />);

    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it('should handle network errors', async () => {
    server.use(
      rest.get('/api/v1/courses', (req, res) => {
        return res.networkError('Network connection failed');
      })
    );

    render(<CourseList />);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('should handle timeout errors', async () => {
    server.use(
      rest.get('/api/v1/courses', (req, res, ctx) => {
        return res(ctx.delay('infinite'));
      })
    );

    render(<CourseList />);

    await waitFor(() => {
      expect(screen.getByText(/request timeout/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
```

## Accessibility Testing

Accessibility testing ensures WCAG 2.1 AA compliance for all user-facing components.

### Automated Accessibility Checks

```typescript
// src/components/forms/FormInput.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FormInput } from './FormInput';

expect.extend(toHaveNoViolations);

describe('FormInput Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(
      <FormInput 
        name="email" 
        label="Email Address" 
        type="email"
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with error state', async () => {
    const { container } = render(
      <FormInput 
        name="email" 
        label="Email Address" 
        error="Invalid email format"
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    const { getByLabelText, getByRole } = render(
      <FormInput 
        name="email" 
        label="Email Address" 
        error="Invalid email format"
        required
      />
    );

    const input = getByLabelText('Email Address');
    
    // Verify required attribute
    expect(input).toHaveAttribute('aria-required', 'true');
    
    // Verify error association
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby');
    
    // Verify error has alert role
    const errorMessage = getByRole('alert');
    expect(errorMessage).toBeInTheDocument();
  });
});
```

### Keyboard Navigation Testing

```typescript
// tests/integration/keyboard-navigation.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '@/components/feedback/Modal';

describe('Keyboard Navigation', () => {
  it('should trap focus within modal', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <Modal open onClose={handleClose} title="Test Modal">
        <input placeholder="First input" />
        <input placeholder="Second input" />
        <button>Submit</button>
      </Modal>
    );

    // Focus should be on first focusable element (close button)
    const closeButton = screen.getByLabelText('Close');
    expect(closeButton).toHaveFocus();

    // Tab to first input
    await user.tab();
    expect(screen.getByPlaceholderText('First input')).toHaveFocus();

    // Tab to second input
    await user.tab();
    expect(screen.getByPlaceholderText('Second input')).toHaveFocus();

    // Tab to submit button
    await user.tab();
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveFocus();

    // Tab should wrap back to close button
    await user.tab();
    expect(closeButton).toHaveFocus();

    // Shift+Tab should go backwards
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveFocus();
  });

  it('should close modal on Escape key', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <Modal open onClose={handleClose} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    );

    await user.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalled();
  });

  it('should navigate dropdown with arrow keys', async () => {
    const user = userEvent.setup();

    render(
      <select aria-label="Course selector">
        <option value="1">Course 1</option>
        <option value="2">Course 2</option>
        <option value="3">Course 3</option>
      </select>
    );

    const select = screen.getByLabelText('Course selector');
    select.focus();

    await user.keyboard('{ArrowDown}');
    expect(select).toHaveValue('2');

    await user.keyboard('{ArrowDown}');
    expect(select).toHaveValue('3');

    await user.keyboard('{ArrowUp}');
    expect(select).toHaveValue('2');
  });
});
```

### Manual Accessibility Testing Checklist

Perform these manual checks for critical user flows:

- [ ] **Keyboard Navigation**
  - [ ] All interactive elements reachable with Tab
  - [ ] Logical tab order
  - [ ] Focus visible indicator on all elements
  - [ ] No keyboard traps

- [ ] **Screen Reader**
  - [ ] All content announced correctly
  - [ ] ARIA labels accurate and descriptive
  - [ ] Form errors announced immediately
  - [ ] Dynamic content changes announced

- [ ] **Visual**
  - [ ] Color contrast meets WCAG AA (4.5:1 for text, 3:1 for large text)
  - [ ] Text resizable up to 200% without loss of content
  - [ ] No information conveyed by color alone
  - [ ] Focus indicators clearly visible

- [ ] **Forms**
  - [ ] All inputs have associated labels
  - [ ] Required fields indicated programmatically
  - [ ] Error messages associated with inputs
  - [ ] Clear submission feedback

- [ ] **Media**
  - [ ] Images have alt text
  - [ ] Decorative images marked with empty alt=""
  - [ ] Videos have captions
  - [ ] Audio alternatives provided

## Coverage Requirements

### Coverage Targets

We maintain a **90%+ coverage target** for critical business logic:

- **Statements**: 90%
- **Branches**: 85%
- **Functions**: 90%
- **Lines**: 90%

### Running Coverage Reports

```bash
# Generate coverage report
npm run coverage

# Generate HTML coverage report
npm run coverage -- --reporter=html

# View coverage in browser
open coverage/index.html
```

### Coverage Configuration

Coverage thresholds are enforced in `vitest.config.ts`:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html', 'lcov'],
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mocks/**',
        '**/types/**',
      ],
    },
  },
});
```

### Interpreting Coverage Reports

```
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------------------|---------|----------|---------|---------|-------------------
src/utils/date.ts     |   95.24 |    88.89 |     100 |   95.24 | 42-43
src/hooks/useAuth.ts  |     100 |      100 |     100 |     100 | 
src/services/api.ts   |   91.67 |    83.33 |     100 |   91.67 | 78,92
----------------------|---------|----------|---------|---------|-------------------
All files             |   92.15 |    87.45 |   94.32 |   92.15 |
```

**Reading the Report:**
- **% Stmts**: Percentage of statements executed
- **% Branch**: Percentage of conditional branches tested
- **% Funcs**: Percentage of functions called
- **% Lines**: Percentage of lines executed
- **Uncovered Line #s**: Specific lines not covered by tests

### Excluding Files from Coverage

Some files can be legitimately excluded:
- Type definition files (`*.d.ts`)
- Configuration files (`*.config.ts`)
- Mock data (`/mocks/`)
- Storybook stories (`*.stories.tsx`)
- Test utilities (`/tests/utils/`)

## Testing Best Practices

### General Principles

1. **Test One Thing Per Test**
   ```typescript
   // ❌ Bad: Testing multiple concerns
   it('should handle user input and validation', async () => {
     // Tests both input handling AND validation
   });

   // ✅ Good: Separate tests
   it('should update value on user input', async () => {
     // Tests only input handling
   });

   it('should display error on invalid input', () => {
     // Tests only validation
   });
   ```

2. **Use Descriptive Test Names**
   ```typescript
   // ❌ Bad: Vague test name
   it('works', () => {});

   // ✅ Good: Clear intent
   it('should display loading spinner while fetching courses', () => {});
   ```

3. **Arrange-Act-Assert Pattern**
   ```typescript
   it('should enroll user in course', async () => {
     // Arrange: Set up test data and dependencies
     const mockCourse = { id: 1, name: 'Test Course' };
     const user = userEvent.setup();

     // Act: Perform the action being tested
     render(<EnrollButton course={mockCourse} />);
     await user.click(screen.getByRole('button', { name: /enroll/i }));

     // Assert: Verify the expected outcome
     expect(screen.getByText(/enrolled/i)).toBeInTheDocument();
   });
   ```

4. **Avoid Testing Implementation Details**
   ```typescript
   // ❌ Bad: Testing state directly
   it('should update count state', () => {
     const { result } = renderHook(() => useCounter());
     expect(result.current.count).toBe(0); // Testing internal state
   });

   // ✅ Good: Testing behavior
   it('should display incremented count', () => {
     render(<Counter />);
     userEvent.click(screen.getByRole('button', { name: /increment/i }));
     expect(screen.getByText('Count: 1')).toBeInTheDocument();
   });
   ```

5. **Keep Tests Isolated and Independent**
   ```typescript
   describe('CourseList', () => {
     // ❌ Bad: Tests depend on execution order
     let courses = [];
     
     it('should initialize courses', () => {
       courses = [{ id: 1 }];
     });

     it('should have courses', () => {
       expect(courses).toHaveLength(1); // Depends on previous test
     });

     // ✅ Good: Each test is independent
     it('should initialize with empty array', () => {
       const courses = [];
       expect(courses).toHaveLength(0);
     });

     it('should add course to array', () => {
       const courses = [];
       courses.push({ id: 1 });
       expect(courses).toHaveLength(1);
     });
   });
   ```

6. **Clean Up After Tests**
   ```typescript
   import { afterEach } from 'vitest';

   describe('Component with side effects', () => {
     afterEach(() => {
       // Clear mocks
       vi.clearAllMocks();
       
       // Clear local storage
       localStorage.clear();
       
       // Reset DOM
       document.body.innerHTML = '';
     });
   });
   ```

7. **Use Realistic Test Data**
   ```typescript
   // ❌ Bad: Unrealistic data
   const mockUser = { id: 1, name: 'User' };

   // ✅ Good: Realistic data
   const mockUser = {
     id: 12345,
     username: 'john.doe',
     email: 'john.doe@example.com',
     firstName: 'John',
     lastName: 'Doe',
     roles: ['student'],
     enrolledCourses: [1, 2, 3],
   };
   ```

### Component Testing Best Practices

1. **Query by Accessible Roles**
   ```typescript
   // Priority order for queries:
   // 1. getByRole
   // 2. getByLabelText
   // 3. getByPlaceholderText
   // 4. getByText
   // 5. getByTestId (last resort)

   // ✅ Good
   screen.getByRole('button', { name: /submit/i });
   screen.getByLabelText('Email Address');
   
   // ❌ Avoid
   screen.getByTestId('submit-button');
   ```

2. **Use userEvent Over fireEvent**
   ```typescript
   import userEvent from '@testing-library/user-event';

   // ❌ Bad: fireEvent doesn't simulate real user behavior
   fireEvent.click(button);

   // ✅ Good: userEvent simulates complete user interaction
   const user = userEvent.setup();
   await user.click(button);
   ```

3. **Wait for Async Updates**
   ```typescript
   // ✅ Good: Use waitFor for async updates
   await waitFor(() => {
     expect(screen.getByText('Loaded')).toBeInTheDocument();
   });

   // ✅ Good: Use findBy for appearing elements
   const element = await screen.findByText('Loaded');
   expect(element).toBeInTheDocument();
   ```

### Hook Testing Best Practices

1. **Use renderHook from Testing Library**
   ```typescript
   import { renderHook } from '@testing-library/react';

   it('should increment counter', () => {
     const { result } = renderHook(() => useCounter());
     
     act(() => {
       result.current.increment();
     });
     
     expect(result.current.count).toBe(1);
   });
   ```

2. **Provide Necessary Context**
   ```typescript
   const wrapper = ({ children }) => (
     <QueryClientProvider client={queryClient}>
       {children}
     </QueryClientProvider>
   );

   const { result } = renderHook(() => useCourse(1), { wrapper });
   ```

## Validation Tests

Validation tests ensure functional parity with the existing PHP implementation.

### Grade Calculation Parity

```typescript
// tests/validation/grade-calculations.test.ts
import { describe, it, expect } from 'vitest';
import { calculateWeightedMean, calculateSumOfGrades } from '@/utils/grades';

describe('Grade Calculation Parity', () => {
  it('should calculate weighted mean identical to PHP version', () => {
    const grades = [
      { value: 85, weight: 0.3 },
      { value: 90, weight: 0.5 },
      { value: 78, weight: 0.2 },
    ];

    // Expected value from PHP implementation
    const expected = 85.9;
    const result = calculateWeightedMean(grades);

    expect(result).toBeCloseTo(expected, 2);
  });

  it('should handle grade aggregation with dropped lowest', () => {
    const grades = [75, 82, 90, 68, 88];
    
    // PHP implementation drops lowest grade (68)
    const expected = (75 + 82 + 90 + 88) / 4; // 83.75
    const result = calculateSumOfGrades(grades, { dropLowest: 1 });

    expect(result).toBeCloseTo(expected, 2);
  });
});
```

### Permission Check Consistency

```typescript
// tests/validation/permissions.test.ts
import { describe, it, expect } from 'vitest';
import { rest } from 'msw';
import { server } from '@/mocks/server';
import { checkCapability } from '@/utils/permissions';

describe('Permission Check Parity', () => {
  it('should deny access without required capability', async () => {
    server.use(
      rest.get('/api/v1/courses/:id', (req, res, ctx) => {
        return res(
          ctx.status(403),
          ctx.json({
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'You do not have permission to view this course',
              details: {
                required_capability: 'moodle/course:view',
              },
            },
          })
        );
      })
    );

    const hasPermission = await checkCapability('moodle/course:view', 1);
    expect(hasPermission).toBe(false);
  });

  it('should grant access with required capability', async () => {
    const hasPermission = await checkCapability('moodle/course:view', 1);
    expect(hasPermission).toBe(true);
  });
});
```

### File Upload/Download Functionality

```typescript
// tests/validation/file-operations.test.ts
import { describe, it, expect } from 'vitest';
import { uploadFile, downloadFile } from '@/services/fileService';

describe('File Operations Parity', () => {
  it('should upload file with correct format', async () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const result = await uploadFile(file, { courseId: 1, assignmentId: 5 });

    expect(result).toMatchObject({
      success: true,
      data: {
        filename: 'test.pdf',
        filesize: expect.any(Number),
        mimetype: 'application/pdf',
        filepath: expect.stringMatching(/^\/files\//),
      },
    });
  });

  it('should download file with correct headers', async () => {
    const fileId = 123;
    const response = await downloadFile(fileId);

    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
  });
});
```

### Token Refresh Flow

```typescript
// tests/validation/token-refresh.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { rest } from 'msw';
import { server } from '@/mocks/server';
import { refreshToken } from '@/services/auth/authService';

describe('Token Refresh Parity', () => {
  it('should refresh token before expiration', async () => {
    const expiredToken = 'expired-jwt-token';
    const newToken = 'new-jwt-token';

    server.use(
      rest.post('/api/v1/auth/refresh', (req, res, ctx) => {
        return res(
          ctx.json({
            success: true,
            data: {
              accessToken: newToken,
              expiresIn: 3600,
            },
          })
        );
      })
    );

    const result = await refreshToken(expiredToken);

    expect(result.accessToken).toBe(newToken);
    expect(result.expiresIn).toBe(3600);
  });

  it('should handle refresh token expiration', async () => {
    server.use(
      rest.post('/api/v1/auth/refresh', (req, res, ctx) => {
        return res(
          ctx.status(401),
          ctx.json({
            success: false,
            error: {
              code: 'REFRESH_TOKEN_EXPIRED',
              message: 'Refresh token has expired',
            },
          })
        );
      })
    );

    await expect(refreshToken('expired-refresh-token')).rejects.toThrow(
      'Refresh token has expired'
    );
  });
});
```

## Continuous Integration

All tests run automatically in our CI/CD pipeline on every commit.

### GitHub Actions Workflow

```yaml
# .github/workflows/react-ci.yml
name: React Frontend CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20.x'
          cache: 'npm'
          cache-dependency-path: react-frontend/package-lock.json
      
      - name: Install dependencies
        working-directory: ./react-frontend
        run: npm ci
      
      - name: Run linter
        working-directory: ./react-frontend
        run: npm run lint
      
      - name: Type check
        working-directory: ./react-frontend
        run: npm run type-check
      
      - name: Run unit tests
        working-directory: ./react-frontend
        run: npm test -- --coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./react-frontend/coverage/lcov.info
          flags: unittests
      
      - name: Install Playwright browsers
        working-directory: ./react-frontend
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        working-directory: ./react-frontend
        run: npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: react-frontend/playwright-report/
```

### CI Requirements

- ✅ All unit tests must pass
- ✅ All E2E tests must pass
- ✅ Code coverage must meet 90% threshold
- ✅ No ESLint warnings
- ✅ TypeScript type checking must pass
- ✅ Accessibility tests must pass

**Pull requests cannot be merged until all CI checks pass.**

## Troubleshooting

### Common Issues and Solutions

#### Flaky Tests

**Problem**: Tests pass sometimes but fail randomly.

**Solutions**:
```typescript
// 1. Use waitFor for async operations
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
}, { timeout: 5000 });

// 2. Avoid fixed delays
// ❌ Bad
await new Promise(resolve => setTimeout(resolve, 1000));

// ✅ Good
await waitFor(() => {
  expect(element).toBeVisible();
});

// 3. Clean up timers
afterEach(() => {
  vi.clearAllTimers();
});
```

#### Timeout Issues

**Problem**: Tests fail with timeout errors.

**Solutions**:
```typescript
// 1. Increase timeout for specific test
it('should load large dataset', async () => {
  // Test implementation
}, { timeout: 10000 });

// 2. Adjust global timeout in config
// vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 10000,
  },
});

// 3. Use findBy queries (built-in wait)
const element = await screen.findByText('Loaded', {}, { timeout: 5000 });
```

#### Mock Data Setup Problems

**Problem**: Tests fail because mock data doesn't match expected format.

**Solutions**:
```typescript
// 1. Use TypeScript interfaces for mock data
import type { Course } from '@/types/entities';

const mockCourse: Course = {
  id: 1,
  fullname: 'Test Course',
  shortname: 'TEST101',
  // ... all required fields
};

// 2. Create factory functions
const createMockCourse = (overrides?: Partial<Course>): Course => ({
  id: 1,
  fullname: 'Test Course',
  shortname: 'TEST101',
  ...overrides,
});

// 3. Validate API responses match TypeScript types
it('should return valid course data', async () => {
  const course = await fetchCourse(1);
  expect(course).toMatchObject({
    id: expect.any(Number),
    fullname: expect.any(String),
    shortname: expect.any(String),
  });
});
```

#### Playwright Browser Installation

**Problem**: Playwright tests fail with "browser not found" error.

**Solutions**:
```bash
# Install browsers
npx playwright install

# Install browsers with system dependencies
npx playwright install --with-deps

# Install specific browser
npx playwright install chromium

# Check installation
npx playwright --version
```

#### React Query Cache Issues

**Problem**: Tests fail due to stale React Query cache.

**Solutions**:
```typescript
import { QueryClient } from '@tanstack/react-query';

describe('Component with queries', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create fresh query client for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          cacheTime: 0,
        },
      },
    });
  });

  afterEach(() => {
    // Clear cache after each test
    queryClient.clear();
  });
});
```

### Getting Help

If you encounter issues not covered here:

1. **Check the Console**: Look for error messages and stack traces
2. **Enable Debug Mode**: Run tests with `DEBUG=true npm test`
3. **Isolate the Problem**: Run single test file to narrow down issue
4. **Review Documentation**:
   - [Vitest Docs](https://vitest.dev/)
   - [Testing Library Docs](https://testing-library.com/)
   - [Playwright Docs](https://playwright.dev/)
   - [MSW Docs](https://mswjs.io/)
5. **Ask the Team**: Post in #frontend-testing Slack channel

---

## Summary

This testing guide provides comprehensive coverage of:
- ✅ Unit testing utilities, hooks, and services with Vitest
- ✅ Component testing with React Testing Library
- ✅ Integration testing for feature workflows
- ✅ E2E testing of critical user journeys with Playwright
- ✅ API mocking with MSW
- ✅ Accessibility testing for WCAG 2.1 AA compliance
- ✅ 90%+ coverage requirements and reporting
- ✅ Validation tests ensuring PHP parity
- ✅ Best practices and troubleshooting

**Remember**: Tests are not just for catching bugs—they're documentation of how the system works and insurance against future regressions. Write tests that would help a new developer understand the codebase.
