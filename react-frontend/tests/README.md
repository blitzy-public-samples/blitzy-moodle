# Testing Guide

## Overview

This directory contains all tests for the Moodle React Frontend application. Our testing strategy ensures high-quality, maintainable code through comprehensive test coverage across unit, integration, and end-to-end testing levels.

### Testing Philosophy

- **Test behavior, not implementation**: Focus on what the component does, not how it does it
- **Comprehensive coverage**: Target 90%+ code coverage for critical paths
- **Fast feedback**: Unit and integration tests run quickly for rapid development cycles
- **Real-world scenarios**: E2E tests simulate actual user workflows
- **Confidence in refactoring**: Comprehensive tests enable safe code changes

### Coverage Requirements

| Test Type | Target Coverage | Purpose |
|-----------|----------------|---------|
| **Unit Tests** | 90%+ for utilities, hooks, and pure functions | Verify individual functions work correctly |
| **Integration Tests** | 85%+ for components and features | Verify components work together correctly |
| **E2E Tests** | 15 critical user journeys | Verify complete workflows from user perspective |

## Directory Structure

```
tests/
├── unit/                           # Unit tests
│   ├── components/                 # Shared component tests
│   ├── hooks/                      # Custom hook tests
│   ├── services/                   # Service layer tests
│   ├── utils/                      # Utility function tests
│   └── features/                   # Feature-specific unit tests
│       ├── auth/
│       ├── courses/
│       ├── dashboard/
│       └── ...
│
├── integration/                    # Integration tests
│   ├── features/                   # Feature integration tests
│   │   ├── auth/                   # Auth flow tests
│   │   ├── courses/                # Course workflows
│   │   ├── assignments/            # Assignment workflows
│   │   └── ...
│   └── api/                        # API integration tests
│
├── e2e/                            # End-to-end tests
│   ├── critical-journeys/          # Critical user workflows
│   │   ├── student-submission.spec.ts
│   │   ├── teacher-grading.spec.ts
│   │   ├── course-enrollment.spec.ts
│   │   └── ...
│   ├── fixtures/                   # Test data and fixtures
│   └── utils/                      # E2E test utilities
│
├── mocks/                          # Mock data and handlers
│   ├── handlers/                   # MSW API handlers
│   │   ├── auth.handlers.ts
│   │   ├── courses.handlers.ts
│   │   └── ...
│   ├── data/                       # Mock data generators
│   └── server.ts                   # MSW server setup
│
├── helpers/                        # Test utilities and helpers
│   ├── render.tsx                  # Custom render with providers
│   ├── test-utils.tsx              # Common test utilities
│   └── setup.ts                    # Global test setup
│
└── README.md                       # This file
```

## Testing Tools

### Core Testing Libraries

| Tool | Version | Purpose |
|------|---------|---------|
| **Vitest** | ^1.0.4 | Fast unit test framework with Vite integration |
| **React Testing Library** | ^14.1.2 | Component testing utilities focused on user behavior |
| **@testing-library/user-event** | ^14.5.1 | Simulates user interactions |
| **@testing-library/jest-dom** | ^6.1.5 | Custom Jest matchers for DOM assertions |
| **Playwright** | ^1.40.1 | End-to-end testing across browsers |
| **MSW** (Mock Service Worker) | ^2.0.11 | API mocking for integration tests |

### Why These Tools?

- **Vitest**: Lightning-fast tests with native TypeScript support and Vite integration
- **React Testing Library**: Encourages testing from user perspective, not implementation details
- **Playwright**: Reliable cross-browser E2E testing with excellent developer experience
- **MSW**: Intercepts network requests at the service worker level for realistic API mocking

## Running Tests

### Quick Commands

```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode (recommended for development)
npm test -- --watch

# Run tests with UI (interactive test explorer)
npm run test:ui

# Run tests with coverage report
npm run coverage

# Run E2E tests (headless)
npm run test:e2e

# Run E2E tests with UI (interactive)
npm run test:e2e:ui

# Run specific test file
npm test src/features/auth/hooks/useAuth.test.ts

# Run tests matching pattern
npm test -- --grep "login"
```

### Continuous Integration

Tests automatically run on:
- Every pull request
- Every commit to main branch
- Before deployment to staging/production

CI Pipeline requirements:
- All unit/integration tests must pass (no failures)
- Coverage must meet 90% threshold for critical paths
- E2E tests must pass for all critical journeys
- No TypeScript compilation errors

## Unit Testing

### Testing Components

Unit tests for components verify their rendering, user interactions, and state management in isolation.

**Example: Testing a Button Component**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    
    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows loading indicator when loading', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
```

### Testing Custom Hooks

**Example: Testing useAuth Hook**

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuth } from './useAuth';
import { wrapper } from '../../../tests/helpers/render';

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns unauthenticated state initially', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('authenticates user on login', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await result.current.login({ username: 'student1', password: 'password' });
    
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toMatchObject({
        username: 'student1',
        roles: expect.arrayContaining(['student'])
      });
    });
  });

  it('clears user on logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    // Login first
    await result.current.login({ username: 'student1', password: 'password' });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    
    // Then logout
    await result.current.logout();
    
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });
});
```

### Testing Utility Functions

**Example: Testing Date Formatting Utility**

```typescript
import { describe, it, expect } from 'vitest';
import { formatDate, parseDate, isDateInPast } from './date';

describe('date utilities', () => {
  describe('formatDate', () => {
    it('formats date in default format', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(formatDate(date)).toBe('Jan 15, 2024');
    });

    it('formats date with custom format', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(formatDate(date, 'yyyy-MM-dd')).toBe('2024-01-15');
    });

    it('handles invalid dates gracefully', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
    });
  });

  describe('isDateInPast', () => {
    it('returns true for past dates', () => {
      const pastDate = new Date('2020-01-01');
      expect(isDateInPast(pastDate)).toBe(true);
    });

    it('returns false for future dates', () => {
      const futureDate = new Date('2030-01-01');
      expect(isDateInPast(futureDate)).toBe(false);
    });
  });
});
```

## Integration Testing

Integration tests verify that multiple components, hooks, and services work together correctly. They use MSW to mock API responses.

### Setting Up MSW Handlers

**Example: Auth API Handlers**

```typescript
// tests/mocks/handlers/auth.handlers.ts
import { http, HttpResponse } from 'msw';

export const authHandlers = [
  // Login endpoint
  http.post('/api/v1/auth/login', async ({ request }) => {
    const { username, password } = await request.json();
    
    if (username === 'student1' && password === 'password') {
      return HttpResponse.json({
        success: true,
        data: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          user: {
            id: 1,
            username: 'student1',
            email: 'student1@example.com',
            roles: ['student']
          }
        }
      });
    }
    
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password'
        }
      },
      { status: 401 }
    );
  }),

  // Get current user
  http.get('/api/v1/auth/me', ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader === 'Bearer mock-access-token') {
      return HttpResponse.json({
        success: true,
        data: {
          id: 1,
          username: 'student1',
          email: 'student1@example.com',
          roles: ['student']
        }
      });
    }
    
    return HttpResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
      { status: 401 }
    );
  }),
];
```

### Integration Test Example

**Example: Login Flow Integration Test**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { renderWithProviders } from '../../../helpers/render';

describe('Login Flow Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('completes full login flow successfully', async () => {
    const user = userEvent.setup();
    const { router } = renderWithProviders(<LoginPage />);
    
    // Fill in credentials
    await user.type(screen.getByLabelText(/username/i), 'student1');
    await user.type(screen.getByLabelText(/password/i), 'password');
    
    // Submit form
    await user.click(screen.getByRole('button', { name: /log in/i }));
    
    // Wait for redirect to dashboard
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard');
    });
    
    // Verify user is authenticated
    expect(screen.getByText(/welcome, student1/i)).toBeInTheDocument();
  });

  it('shows error message on invalid credentials', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    
    await user.type(screen.getByLabelText(/username/i), 'invalid');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid username or password/i);
    });
  });

  it('persists authentication across page reloads', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(<LoginPage />);
    
    // Login
    await user.type(screen.getByLabelText(/username/i), 'student1');
    await user.type(screen.getByLabelText(/password/i), 'password');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    
    await waitFor(() => {
      expect(localStorage.getItem('accessToken')).toBeTruthy();
    });
    
    // Simulate page reload by re-rendering
    rerender(<LoginPage />);
    
    // User should still be authenticated
    await waitFor(() => {
      expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument();
    });
  });
});
```

### Testing with React Query

**Example: Course List with Data Fetching**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CourseCatalogPage } from '@/features/courses/pages/CourseCatalogPage';
import { renderWithProviders } from '../../../helpers/render';

describe('Course Catalog Integration', () => {
  it('loads and displays courses', async () => {
    renderWithProviders(<CourseCatalogPage />);
    
    // Shows loading state
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    
    // Waits for courses to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Displays course list
    expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
    expect(screen.getByText('Advanced Mathematics')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    // MSW handler can be overridden for this test to return error
    renderWithProviders(<CourseCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load courses/i)).toBeInTheDocument();
    });
    
    // Shows retry button
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
```

## End-to-End Testing

E2E tests use Playwright to simulate real user interactions across the entire application stack.

### E2E Test Structure

**Example: Student Assignment Submission Journey**

```typescript
// tests/e2e/critical-journeys/student-submission.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Student Assignment Submission', () => {
  test.beforeEach(async ({ page }) => {
    // Login as student
    await page.goto('/login');
    await page.getByLabel('Username').fill('student1');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: /log in/i }).click();
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('submits assignment successfully', async ({ page }) => {
    // Navigate to course
    await page.getByRole('link', { name: 'Introduction to Programming' }).click();
    
    // Navigate to assignment
    await page.getByRole('link', { name: 'Week 1 Assignment' }).click();
    await expect(page.getByRole('heading', { name: 'Week 1 Assignment' })).toBeVisible();
    
    // Upload file
    const fileInput = page.getByLabel('Upload submission');
    await fileInput.setInputFiles('tests/fixtures/sample-submission.pdf');
    
    // Wait for upload confirmation
    await expect(page.getByText(/file uploaded successfully/i)).toBeVisible();
    
    // Add submission text
    await page.getByLabel('Submission text').fill('This is my completed assignment.');
    
    // Submit assignment
    await page.getByRole('button', { name: /submit assignment/i }).click();
    
    // Verify success message
    await expect(page.getByRole('alert')).toContainText('Assignment submitted successfully');
    
    // Verify submission status updated
    await expect(page.getByText(/status: submitted/i)).toBeVisible();
    
    // Verify file is listed
    await expect(page.getByText('sample-submission.pdf')).toBeVisible();
  });

  test('shows validation errors for empty submission', async ({ page }) => {
    await page.getByRole('link', { name: 'Introduction to Programming' }).click();
    await page.getByRole('link', { name: 'Week 1 Assignment' }).click();
    
    // Try to submit without file or text
    await page.getByRole('button', { name: /submit assignment/i }).click();
    
    // Should show validation error
    await expect(page.getByText(/please provide a file or text submission/i)).toBeVisible();
  });

  test('allows resubmission if allowed', async ({ page }) => {
    await page.getByRole('link', { name: 'Introduction to Programming' }).click();
    await page.getByRole('link', { name: 'Week 1 Assignment' }).click();
    
    // Initial submission
    await page.getByLabel('Submission text').fill('First submission');
    await page.getByRole('button', { name: /submit assignment/i }).click();
    await expect(page.getByText(/submitted successfully/i)).toBeVisible();
    
    // Edit submission
    await page.getByRole('button', { name: /edit submission/i }).click();
    await page.getByLabel('Submission text').clear();
    await page.getByLabel('Submission text').fill('Updated submission');
    await page.getByRole('button', { name: /submit assignment/i }).click();
    
    // Verify updated
    await expect(page.getByText('Updated submission')).toBeVisible();
  });
});
```

### E2E Test Best Practices

1. **Use Realistic Test Data**: Use fixtures that resemble real data
2. **Test Critical Paths**: Focus on user journeys that impact core functionality
3. **Keep Tests Independent**: Each test should be able to run in isolation
4. **Use Page Object Model**: For complex pages, create page objects to reduce duplication
5. **Handle Async Operations**: Use Playwright's built-in waiting mechanisms
6. **Test Across Browsers**: Run tests on Chromium, Firefox, and WebKit

### Page Object Example

```typescript
// tests/e2e/pages/LoginPage.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.loginButton = page.getByRole('button', { name: /log in/i });
    this.errorAlert = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async expectError(message: string | RegExp) {
    await this.errorAlert.waitFor();
    await expect(this.errorAlert).toContainText(message);
  }
}

// Usage in test
test('login with invalid credentials', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('invalid', 'wrong');
  await loginPage.expectError(/invalid username or password/i);
});
```

## Best Practices

### 1. Test Behavior, Not Implementation

❌ **Bad**: Testing internal state
```tsx
it('sets loading state to true', () => {
  const { result } = renderHook(() => useAuth());
  result.current.login({ username: 'test', password: 'test' });
  expect(result.current.isLoading).toBe(true); // Testing internal state
});
```

✅ **Good**: Testing observable behavior
```tsx
it('shows loading indicator during login', async () => {
  render(<LoginForm />);
  const user = userEvent.setup();
  
  await user.type(screen.getByLabelText(/username/i), 'test');
  await user.type(screen.getByLabelText(/password/i), 'test');
  await user.click(screen.getByRole('button', { name: /log in/i }));
  
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});
```

### 2. Use data-testid Sparingly

Prefer semantic queries:
1. **getByRole**: Best for buttons, links, inputs
2. **getByLabelText**: Best for form fields
3. **getByText**: Best for static text
4. **getByPlaceholderText**: Fallback for inputs
5. **getByTestId**: Last resort only

```tsx
// Good: Semantic queries
screen.getByRole('button', { name: /submit/i });
screen.getByLabelText(/email address/i);
screen.getByText(/welcome back/i);

// Avoid unless necessary
screen.getByTestId('submit-button');
```

### 3. Mock External Dependencies

Always mock:
- API calls (use MSW)
- Browser APIs (localStorage, sessionStorage, geolocation)
- Third-party libraries (analytics, monitoring)
- Date/time functions (use vi.useFakeTimers())

```typescript
import { vi } from 'vitest';

describe('DatePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows current date by default', () => {
    render(<DatePicker />);
    expect(screen.getByText('January 15, 2024')).toBeInTheDocument();
  });
});
```

### 4. Keep Tests Isolated and Independent

Each test should:
- Set up its own data
- Clean up after itself
- Not depend on other tests
- Be runnable in any order

```typescript
describe('CourseList', () => {
  beforeEach(() => {
    // Clean slate for each test
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    // Cleanup after each test
    vi.clearAllMocks();
  });
});
```

### 5. Use Descriptive Test Names

❌ **Bad**: Vague test names
```typescript
it('works', () => { ... });
it('test login', () => { ... });
it('should render', () => { ... });
```

✅ **Good**: Descriptive test names
```typescript
it('displays error message when login fails with invalid credentials', () => { ... });
it('redirects to dashboard after successful login', () => { ... });
it('disables submit button while authentication is in progress', () => { ... });
```

### 6. Follow AAA Pattern

**Arrange, Act, Assert** - structure tests clearly:

```typescript
it('submits form with valid data', async () => {
  // Arrange: Set up test data and render component
  const user = userEvent.setup();
  const handleSubmit = vi.fn();
  render(<ContactForm onSubmit={handleSubmit} />);
  
  // Act: Perform user actions
  await user.type(screen.getByLabelText(/name/i), 'John Doe');
  await user.type(screen.getByLabelText(/email/i), 'john@example.com');
  await user.click(screen.getByRole('button', { name: /submit/i }));
  
  // Assert: Verify expected outcomes
  await waitFor(() => {
    expect(handleSubmit).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'john@example.com'
    });
  });
});
```

### 7. Test Accessibility

Include accessibility checks in component tests:

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

it('has no accessibility violations', async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

it('has proper ARIA labels', () => {
  render(<LoginForm />);
  expect(screen.getByLabelText(/username/i)).toHaveAttribute('aria-required', 'true');
});
```

### 8. Test Error Boundaries

```typescript
it('catches and displays errors gracefully', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  
  const ThrowError = () => {
    throw new Error('Test error');
  };
  
  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );
  
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  
  consoleError.mockRestore();
});
```

### 9. Use Custom Render Function

Create a custom render that includes all providers:

```tsx
// tests/helpers/render.tsx
import { render as rtlRender } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { store } from '@/app/store';
import { theme } from '@/styles/theme';

export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    ...renderOptions
  } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ThemeProvider theme={theme}>
              {children}
            </ThemeProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </Provider>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}
```

## Coverage Requirements

### Coverage Thresholds

Configure coverage thresholds in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        'src/main.tsx'
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90
      }
    }
  }
});
```

### Critical Paths Requiring 90%+ Coverage

- Authentication flows (login, logout, token refresh)
- Assignment submission and grading workflows
- Quiz attempt and submission logic
- Course enrollment and unenrollment
- Gradebook calculations and display
- Permission checks and role-based access
- File upload and download operations
- Form validation and error handling

### Viewing Coverage Reports

```bash
# Generate coverage report
npm run coverage

# Open HTML coverage report in browser
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

Coverage reports show:
- Overall coverage percentages
- Line-by-line coverage visualization
- Uncovered code branches
- Files below threshold

## CI/CD Integration

### GitHub Actions Workflow

Tests run automatically on:
- Pull requests to main/develop branches
- Commits to main/develop branches
- Manual workflow dispatch

```yaml
# .github/workflows/test.yml
name: Test

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  unit-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit and integration tests
        run: npm run coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

### Pre-commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "vitest related --run"
    ]
  }
}
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: Tests timing out

**Symptoms**: Tests hang and timeout after 5 seconds

**Solutions**:
```typescript
// Increase timeout for specific test
it('slow operation', async () => {
  // ... test code
}, 10000); // 10 second timeout

// Or globally in vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 10000
  }
});
```

#### Issue: "Cannot find module" errors

**Symptoms**: Import errors in tests

**Solutions**:
- Ensure path aliases are configured in `tsconfig.json` and `vitest.config.ts`
- Check that `@` alias points to `src/` directory
- Verify file extensions are correct (`.ts`, `.tsx`)

#### Issue: React Query tests failing

**Symptoms**: Tests fail with "No QueryClient set" error

**Solutions**:
```typescript
// Wrap components with QueryClientProvider in tests
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

function wrapper({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

renderHook(() => useQuery(...), { wrapper });
```

#### Issue: MSW handlers not intercepting requests

**Symptoms**: Real API calls made instead of mocked responses

**Solutions**:
```typescript
// Ensure MSW server is started in setup file
// tests/helpers/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from '../mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

#### Issue: Flaky E2E tests

**Symptoms**: Tests pass/fail inconsistently

**Solutions**:
- Use Playwright's built-in waiting: `await expect(locator).toBeVisible()`
- Avoid hardcoded delays: Don't use `page.waitForTimeout()`
- Wait for network idle: `await page.waitForLoadState('networkidle')`
- Take screenshots on failure: `await page.screenshot({ path: 'failure.png' })`

#### Issue: Memory leaks in tests

**Symptoms**: Tests slow down over time, "out of memory" errors

**Solutions**:
```typescript
afterEach(() => {
  // Clean up timers
  vi.clearAllTimers();
  
  // Clear all mocks
  vi.clearAllMocks();
  
  // Reset modules
  vi.resetModules();
  
  // Clean storage
  localStorage.clear();
  sessionStorage.clear();
});
```

#### Issue: Accessibility tests failing

**Symptoms**: jest-axe reports violations

**Solutions**:
- Ensure all form inputs have labels
- Add `aria-label` or `aria-labelledby` to interactive elements
- Provide alternative text for images
- Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- Test with screen reader simulation

### Getting Help

- **Documentation**: Check [Vitest](https://vitest.dev/), [Testing Library](https://testing-library.com/), [Playwright](https://playwright.dev/) docs
- **Team Chat**: Ask in #frontend-testing Slack channel
- **Code Review**: Request help in pull request comments
- **Office Hours**: Frontend testing office hours every Thursday 2-3pm

## Additional Resources

### External Documentation

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

### Internal Resources

- Architecture Decision Records (ADRs) in `/docs/architecture/decisions/`
- Component Documentation in Storybook: `npm run storybook`
- API Documentation: `/docs/api/README.md`
- Development Guide: `/react-frontend/docs/development/setup.md`

### Example Test Suites

Refer to these well-tested features for examples:
- `/tests/unit/features/auth/` - Comprehensive auth testing
- `/tests/integration/features/courses/` - Course workflow testing
- `/tests/e2e/critical-journeys/student-submission.spec.ts` - E2E example

---

**Last Updated**: January 2024  
**Maintained By**: Frontend Team  
**Questions?**: Contact #frontend-testing on Slack
