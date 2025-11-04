# Moodle React Frontend

Modern single-page application (SPA) built with React 18, TypeScript, and Material-UI, replacing the traditional PHP server-side rendering architecture while maintaining 100% backward compatibility with all existing Moodle functionality.

## Table of Contents

- [Project Overview](#project-overview)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Building](#building)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [Project Structure](#project-structure)
- [API Integration](#api-integration)
- [State Management](#state-management)
- [Styling](#styling)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Performance](#performance)
- [Accessibility](#accessibility)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Project Overview

This React frontend is part of a comprehensive architectural transformation of Moodle's user interface. It provides a modern, responsive, and performant learning experience while preserving the robust PHP backend business logic that powers Moodle.

### Key Features

- **Modern User Experience**: Client-side routing, optimistic updates, and real-time feedback
- **Component-Based Architecture**: Reusable, testable React components with TypeScript
- **Material Design**: Consistent UI following Material-UI v5 design system
- **Progressive Enhancement**: Works alongside existing PHP interface during transition
- **Full Feature Parity**: All core Moodle features available in React interface
- **Performance Optimized**: Code splitting, lazy loading, and bundle optimization
- **Accessibility First**: WCAG 2.1 AA compliant components and workflows

### Architecture

The React frontend communicates with Moodle's PHP backend through a RESTful JSON API layer (`/api/v1/`) that wraps existing Moodle core functions. This ensures:

- **Zero Business Logic Duplication**: API endpoints call existing PHP functions
- **Consistent Behavior**: Same validation, permissions, and data operations
- **Gradual Migration**: Feature flags enable incremental rollout
- **Backward Compatibility**: Existing PHP pages remain functional

## Technology Stack

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.2.0 | UI library with concurrent rendering features |
| **TypeScript** | 5.3.3 | Type-safe JavaScript with strict mode |
| **Vite** | 5.0.8 | Fast build tool and development server |
| **Material-UI** | 5.15.0 | React component library following Material Design |

### State Management

| Library | Version | Purpose |
|---------|---------|---------|
| **Redux Toolkit** | 2.0.1 | Global application state (auth, user, preferences) |
| **React Query** | 5.14.2 | Server state management with caching and synchronization |
| **React Router** | 6.20.1 | Client-side routing and navigation |

### Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **Vitest** | 1.0.4 | Unit and integration testing framework |
| **Playwright** | 1.40.1 | End-to-end testing across browsers |
| **ESLint** | 8.56.0 | Code linting and quality enforcement |
| **Prettier** | 3.1.1 | Code formatting and style consistency |
| **Storybook** | 7.6.4 | Component documentation and development |

### Additional Libraries

- **axios** (1.6.2): HTTP client for API requests
- **react-hook-form** (7.49.2): Form management and validation
- **zod** (3.22.4): Schema validation
- **date-fns** (3.0.6): Date utility library
- **jwt-decode** (4.0.0): JWT token decoding
- **lodash-es** (4.17.21): Utility functions

## Prerequisites

Ensure you have the following installed on your development machine:

### Required

- **Node.js**: v20.x LTS (verified in `.nvmrc`)
- **npm**: v9.0.0 or higher (comes with Node.js)
- **Git**: For version control

### Recommended

- **Visual Studio Code**: With recommended extensions (ESLint, Prettier, TypeScript)
- **React Developer Tools**: Browser extension for debugging
- **Redux DevTools**: Browser extension for state debugging

### System Requirements

- **Operating System**: macOS, Linux, or Windows 10/11
- **Memory**: Minimum 4GB RAM (8GB+ recommended for optimal development experience)
- **Disk Space**: At least 2GB free space for dependencies and builds

## Installation

### 1. Clone the Repository

```bash
# If you haven't already cloned the Moodle repository
git clone <repository-url>
cd moodle-root/react-frontend
```

### 2. Install Dependencies

```bash
# Install all dependencies defined in package.json
npm install

# Alternative: Use pnpm for faster installs
# pnpm install
```

This will install:
- All production dependencies (~16 packages)
- All development dependencies (~24 packages)
- Total installation time: 1-3 minutes depending on network speed

### 3. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env.development

# Edit .env.development with your local settings
# Key variables to configure:
# - VITE_API_BASE_URL: URL to your Moodle API (e.g., http://localhost/api/v1)
# - VITE_APP_NAME: Your Moodle instance name
```

**Important Environment Variables:**

```env
# API Configuration
VITE_API_BASE_URL=http://localhost/api/v1

# Application Metadata
VITE_APP_NAME=Moodle
VITE_APP_VERSION=4.4.0-react

# Feature Flags
VITE_ENABLE_DEVTOOLS=true
VITE_ENABLE_STORYBOOK=false

# Authentication
VITE_JWT_ACCESS_TOKEN_EXPIRY=3600
VITE_JWT_REFRESH_TOKEN_EXPIRY=604800

# File Uploads
VITE_MAX_FILE_SIZE=104857600
VITE_SUPPORTED_FILE_TYPES=pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,png
```

### 4. Verify Installation

```bash
# Check TypeScript compilation
npm run type-check

# Run linter
npm run lint

# Run tests (should see 0 tests initially)
npm test -- --run
```

## Development

### Start Development Server

```bash
# Start Vite development server with hot module replacement
npm run dev

# Server will start at http://localhost:5173
# - Fast HMR: Changes reflect instantly
# - Error overlay: Compilation errors shown in browser
# - Network access: Available on local network (--host flag)
```

**Development Server Features:**

- **Hot Module Replacement (HMR)**: Changes reflect without full page reload
- **Fast Refresh**: Preserves React component state during updates
- **Error Overlay**: Compilation errors displayed in browser
- **TypeScript Checking**: Type errors shown in real-time
- **API Proxy**: Requests to `/api` proxied to backend (configured in vite.config.ts)

### Development Workflow

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/course-enrollment
   ```

2. **Make Changes**
   - Edit files in `src/`
   - Changes hot-reload automatically
   - Check browser console and network tab

3. **Write Tests**
   ```bash
   # Run tests in watch mode
   npm test
   ```

4. **Lint and Format**
   ```bash
   # Auto-fix linting issues
   npm run lint:fix
   
   # Format code
   npm run format
   ```

5. **Type Check**
   ```bash
   # Verify TypeScript types
   npm run type-check
   ```

6. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: implement course enrollment button"
   ```

### Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **dev** | `npm run dev` | Start development server on port 5173 |
| **build** | `npm run build` | Create production build in `dist/` |
| **preview** | `npm run preview` | Preview production build locally |
| **test** | `npm test` | Run unit tests in watch mode |
| **test:ui** | `npm run test:ui` | Open Vitest UI for interactive testing |
| **test:e2e** | `npm run test:e2e` | Run Playwright E2E tests |
| **test:e2e:ui** | `npm run test:e2e:ui` | Open Playwright UI for debugging E2E tests |
| **coverage** | `npm run coverage` | Generate test coverage report |
| **lint** | `npm run lint` | Run ESLint on TypeScript files |
| **lint:fix** | `npm run lint:fix` | Auto-fix ESLint issues |
| **format** | `npm run format` | Format code with Prettier |
| **format:check** | `npm run format:check` | Check code formatting |
| **type-check** | `npm run type-check` | Check TypeScript types without emitting files |
| **storybook** | `npm run storybook` | Start Storybook on port 6006 |
| **build-storybook** | `npm run build-storybook` | Build static Storybook site |

## Building

### Production Build

```bash
# Create optimized production build
npm run build

# Output directory: dist/
# - Minified JavaScript bundles
# - CSS extracted and optimized
# - Assets with cache-friendly hashes
# - Source maps for debugging
```

**Build Output:**

```
dist/
├── assets/
│   ├── index-[hash].js       # Main bundle (target: <300KB gzipped)
│   ├── vendor-[hash].js      # Third-party libraries
│   ├── Dashboard-[hash].js   # Lazy-loaded route chunk
│   ├── Courses-[hash].js     # Lazy-loaded route chunk
│   └── index-[hash].css      # Extracted CSS
├── index.html                # Entry HTML file
└── manifest.json             # PWA manifest
```

### Build Optimization

The build process includes:

1. **TypeScript Compilation**: All TypeScript code transpiled to ES2020 JavaScript
2. **Tree Shaking**: Unused code eliminated from bundles
3. **Code Splitting**: Automatic splitting by route and vendor dependencies
4. **Minification**: JavaScript and CSS minified for smaller file sizes
5. **Asset Optimization**: Images compressed, SVGs optimized
6. **Cache Busting**: Asset filenames include content hashes

### Preview Production Build

```bash
# Preview production build locally
npm run preview

# Starts local server at http://localhost:4173
# - Serves optimized production build
# - Test performance and bundle sizes
# - Verify production-only features
```

### Build Configuration

Key build settings in `vite.config.ts`:

```typescript
build: {
  target: 'es2020',
  outDir: 'dist',
  sourcemap: true,
  chunkSizeWarningLimit: 500,
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor': ['react', 'react-dom', 'react-router-dom'],
        'mui': ['@mui/material', '@mui/icons-material'],
        'state': ['@reduxjs/toolkit', 'react-redux', '@tanstack/react-query']
      }
    }
  }
}
```

## Testing

### Unit and Integration Tests (Vitest)

```bash
# Run all tests in watch mode
npm test

# Run tests once (CI mode)
npm test -- --run

# Run tests with coverage
npm run coverage

# Open Vitest UI
npm run test:ui
```

**Testing Stack:**

- **Vitest**: Fast unit test framework (Vite-native)
- **React Testing Library**: Component testing utilities
- **Jest DOM**: Custom matchers for DOM assertions
- **MSW**: API mocking for integration tests

**Test File Conventions:**

```
src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   └── LoginForm.test.tsx     # Component tests
│   │   └── hooks/
│   │       ├── useAuth.ts
│   │       └── useAuth.test.ts         # Hook tests
```

**Example Test:**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('renders username and password fields', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('submits form with credentials', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'testuser' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    
    expect(onSubmit).toHaveBeenCalledWith({
      username: 'testuser',
      password: 'password123'
    });
  });
});
```

### End-to-End Tests (Playwright)

```bash
# Run E2E tests headless
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/login.spec.ts

# Run tests in specific browser
npx playwright test --project=chromium
```

**E2E Test Organization:**

```
tests/
├── e2e/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── logout.spec.ts
│   ├── courses/
│   │   ├── enrollment.spec.ts
│   │   └── course-navigation.spec.ts
│   └── assignments/
│       └── submission.spec.ts
```

**Example E2E Test:**

```typescript
import { test, expect } from '@playwright/test';

test('user can log in successfully', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  await page.fill('[name="username"]', 'testuser');
  await page.fill('[name="password"]', 'password123');
  await page.click('button:has-text("Log in")');
  
  await expect(page).toHaveURL(/.*dashboard/);
  await expect(page.locator('text=Welcome')).toBeVisible();
});
```

### Coverage Requirements

**Target Coverage: 90%+**

- Lines: 90%
- Functions: 90%
- Branches: 90%
- Statements: 90%

```bash
# Generate coverage report
npm run coverage

# Open HTML coverage report
open coverage/index.html
```

### Testing Best Practices

1. **Test Behavior, Not Implementation**: Focus on what users see and do
2. **Use Testing Library Queries**: Prefer `getByRole`, `getByLabelText` over `getByTestId`
3. **Mock API Calls**: Use MSW to mock backend responses
4. **Test Accessibility**: Verify keyboard navigation and screen reader support
5. **Keep Tests Fast**: Unit tests should complete in milliseconds
6. **Write Descriptive Test Names**: Clearly describe expected behavior

## Code Quality

### Linting (ESLint)

```bash
# Run ESLint on all TypeScript files
npm run lint

# Auto-fix fixable issues
npm run lint:fix

# Zero warnings policy: All warnings must be fixed before merge
```

**ESLint Configuration:**

- **Parser**: @typescript-eslint/parser
- **Extends**:
  - eslint:recommended
  - @typescript-eslint/recommended
  - react/recommended
  - react/jsx-runtime
  - react-hooks/recommended
  - jsx-a11y/recommended

**Key Rules:**

- `@typescript-eslint/no-explicit-any`: error (no `any` types allowed)
- `react-hooks/rules-of-hooks`: error
- `react-hooks/exhaustive-deps`: warn
- `jsx-a11y/*`: error (accessibility rules)

### Code Formatting (Prettier)

```bash
# Format all files
npm run format

# Check if files are formatted
npm run format:check

# Prettier runs automatically on pre-commit via Husky
```

**Prettier Configuration:**

- Print width: 100 characters
- Tab width: 2 spaces
- Semicolons: Required
- Single quotes: Yes
- Trailing commas: ES5
- Bracket spacing: Yes
- Arrow function parentheses: Always

### Type Checking (TypeScript)

```bash
# Check types without emitting files
npm run type-check

# TypeScript strict mode enforced:
# - noImplicitAny
# - strictNullChecks
# - strictFunctionTypes
# - strictBindCallApply
# - strictPropertyInitialization
# - noImplicitThis
# - alwaysStrict
```

**TypeScript Standards:**

1. **Zero `any` Types**: Use explicit types or `unknown`
2. **Explicit Return Types**: Required for public APIs
3. **Strict Null Checks**: Handle undefined and null explicitly
4. **No Implicit Returns**: All code paths must return value
5. **Interface Over Type**: Prefer `interface` for object shapes

### Pre-commit Hooks

Git hooks configured with Husky and lint-staged:

```json
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{css,md,json}": [
    "prettier --write"
  ]
}
```

**Automatic Checks:**

- ESLint runs on staged TypeScript files
- Prettier formats all staged files
- Type checking runs before commit
- Commit message format validated

## Project Structure

```
react-frontend/
├── public/                     # Static assets
│   ├── index.html              # HTML template
│   ├── favicon.ico             # Site icon
│   └── manifest.json           # PWA manifest
│
├── src/                        # Source code
│   ├── main.tsx                # Application entry point
│   ├── App.tsx                 # Root component
│   │
│   ├── app/                    # Application setup
│   │   ├── store.ts            # Redux store configuration
│   │   ├── router.tsx          # Route definitions
│   │   └── providers.tsx       # Context providers wrapper
│   │
│   ├── features/               # Feature modules
│   │   ├── auth/               # Authentication
│   │   │   ├── components/     # Auth UI components
│   │   │   ├── pages/          # Auth pages
│   │   │   ├── hooks/          # Auth hooks
│   │   │   ├── api/            # Auth API calls
│   │   │   ├── store/          # Auth Redux slice
│   │   │   └── types/          # Auth TypeScript types
│   │   │
│   │   ├── courses/            # Course management
│   │   ├── dashboard/          # User dashboards
│   │   ├── activities/         # Learning activities
│   │   │   ├── assignments/    # Assignment module
│   │   │   ├── quizzes/        # Quiz module
│   │   │   ├── forums/         # Forum module
│   │   │   └── resources/      # Resource module
│   │   ├── gradebook/          # Gradebook
│   │   ├── messaging/          # Messaging system
│   │   ├── admin/              # Administration
│   │   └── profile/            # User profiles
│   │
│   ├── components/             # Shared components
│   │   ├── layouts/            # Page layouts
│   │   ├── navigation/         # Navigation components
│   │   ├── forms/              # Form components
│   │   ├── data-display/       # Data display components
│   │   └── feedback/           # Feedback components (alerts, modals)
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useApi.ts           # API client hook
│   │   ├── useDebounce.ts      # Debounce hook
│   │   ├── useLocalStorage.ts  # Local storage hook
│   │   └── usePermissions.ts   # Permission checking hook
│   │
│   ├── services/               # Services
│   │   ├── api/                # API client
│   │   │   ├── client.ts       # Axios instance
│   │   │   ├── endpoints.ts    # API endpoint constants
│   │   │   └── interceptors.ts # Request/response interceptors
│   │   ├── auth/               # Auth service
│   │   │   └── authService.ts  # Token management
│   │   └── storage/            # Storage service
│   │       └── storageService.ts
│   │
│   ├── types/                  # Global TypeScript types
│   │   ├── api.ts              # API types
│   │   ├── entities.ts         # Domain entity types
│   │   ├── common.ts           # Common types
│   │   └── index.ts            # Type exports
│   │
│   ├── utils/                  # Utility functions
│   │   ├── date.ts             # Date utilities
│   │   ├── string.ts           # String utilities
│   │   ├── validation.ts       # Validation utilities
│   │   └── formatters.ts       # Data formatters
│   │
│   ├── styles/                 # Global styles
│   │   ├── theme.ts            # MUI theme configuration
│   │   ├── global.css          # Global CSS
│   │   └── variables.css       # CSS variables
│   │
│   └── config/                 # Configuration
│       ├── constants.ts        # Application constants
│       └── env.ts              # Environment variables
│
├── tests/                      # Tests
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── e2e/                    # End-to-end tests
│
├── docs/                       # Documentation
│   ├── architecture/           # Architecture docs
│   ├── development/            # Development guides
│   └── deployment/             # Deployment guides
│
├── .storybook/                 # Storybook configuration
├── docker/                     # Docker files
├── scripts/                    # Build scripts
│
├── .env.example                # Environment template
├── .eslintrc.cjs               # ESLint configuration
├── .prettierrc                 # Prettier configuration
├── .gitignore                  # Git ignore rules
├── package.json                # NPM dependencies
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite build configuration
├── vitest.config.ts            # Vitest test configuration
├── playwright.config.ts        # Playwright E2E configuration
└── README.md                   # This file
```

### Feature Module Pattern

Each feature follows a consistent structure:

```
feature-name/
├── components/        # Feature-specific components
├── pages/             # Full page components
├── hooks/             # Feature-specific hooks
├── api/               # API integration for this feature
├── store/             # Redux slice (if needed)
└── types/             # TypeScript types for this feature
```

**Benefits:**

- **Colocation**: Related code lives together
- **Discoverability**: Easy to find feature code
- **Scalability**: Add features without refactoring
- **Reusability**: Extract common patterns to shared components

## API Integration

### React Query Pattern

All server state managed with React Query for automatic caching, background refetching, and optimistic updates.

**Query Hook Example:**

```typescript
import { useQuery } from '@tanstack/react-query';
import { getCourse } from '@/features/courses/api/courseApi';

export function useCourse(courseId: number) {
  return useQuery({
    queryKey: ['courses', courseId],
    queryFn: () => getCourse(courseId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
}
```

**Mutation Hook Example:**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enrollInCourse } from '@/features/courses/api/courseApi';

export function useEnrollInCourse() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (courseId: number) => enrollInCourse(courseId),
    onSuccess: (data, courseId) => {
      // Invalidate course query to refetch
      queryClient.invalidateQueries({ queryKey: ['courses', courseId] });
      
      // Invalidate user courses list
      queryClient.invalidateQueries({ queryKey: ['user', 'courses'] });
    },
    onError: (error) => {
      console.error('Enrollment failed:', error);
    }
  });
}
```

### API Client Configuration

**Axios Instance** (`src/services/api/client.ts`):

```typescript
import axios from 'axios';
import { getAccessToken, refreshAccessToken } from '@/services/auth/authService';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
```

### API Response Format

All API endpoints return standardized JSON responses:

**Success Response:**

```json
{
  "success": true,
  "data": {
    "id": 5,
    "fullname": "Introduction to Programming",
    "shortname": "CS101"
  },
  "meta": {
    "pagination": {
      "page": 1,
      "perPage": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to access this resource",
    "details": {
      "required_capability": "mod/assign:grade",
      "context": "course"
    }
  }
}
```

### Authentication with JWT

**Token Storage:**

- Access token: Stored in memory or httpOnly cookie (1-hour expiration)
- Refresh token: Stored in httpOnly cookie (7-day expiration)
- Token automatically included in all API requests via interceptor

**Token Refresh Flow:**

1. API returns 401 Unauthorized
2. Interceptor catches 401 error
3. Attempt to refresh token with refresh endpoint
4. Retry original request with new token
5. If refresh fails, redirect to login

## State Management

### Redux Toolkit (Global State)

Used for application-wide state that needs to persist across routes:

- **Authentication**: User session, JWT tokens, permissions
- **User Preferences**: Theme, language, UI settings
- **UI State**: Sidebar open/closed, modal states

**Store Configuration** (`src/app/store.ts`):

```typescript
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import themeReducer from '@/features/theme/store/themeSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

**Redux Slice Example** (`src/features/auth/store/authSlice.ts`):

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  roles: string[];
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  roles: [],
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.roles = action.payload.roles;
    },
    clearUser: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.roles = [];
    },
  },
});

export const { setUser, clearUser } = authSlice.actions;
export default authSlice.reducer;
```

### React Query (Server State)

Used for all data fetched from the backend API:

- **Courses**: Course list, course details, course contents
- **Assignments**: Assignment data, submissions, grades
- **Quizzes**: Quiz data, attempts, results
- **Messages**: Message threads, contacts, notifications
- **Gradebook**: Grade items, user grades

**Query Client Configuration** (`src/app/providers.tsx`):

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 3,
    },
  },
});
```

### React Context (Component-Tree State)

Used for state shared within a component tree but not globally:

- Form wizards
- Multi-step processes
- Component-specific settings

### Local State (useState)

Used for UI-only state that doesn't need to persist:

- Modal open/closed
- Dropdown expanded/collapsed
- Form field values (unless using react-hook-form)

## Styling

### Material-UI Theme

Custom theme extends Material-UI defaults:

**Theme Configuration** (`src/styles/theme.ts`):

```typescript
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light', // 'light' | 'dark'
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#9c27b0',
      light: '#ba68c8',
      dark: '#7b1fa2',
    },
    error: {
      main: '#d32f2f',
    },
    warning: {
      main: '#ed6c02',
    },
    info: {
      main: '#0288d1',
    },
    success: {
      main: '#2e7d32',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    button: {
      textTransform: 'none', // Disable uppercase buttons
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8, // Base spacing unit
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
        },
      },
    },
  },
});
```

### Theming Best Practices

1. **Use Theme Values**: Always use `theme.palette`, `theme.spacing`, etc.
2. **Responsive Design**: Use MUI breakpoints (`theme.breakpoints`)
3. **Dark Mode Support**: Test components in both light and dark modes
4. **Custom Components**: Extend MUI components, don't create from scratch
5. **Consistent Spacing**: Use `theme.spacing(n)` for all spacing

**Example Component with Theme:**

```typescript
import { Box, Button, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export function CourseCard({ course }) {
  const theme = useTheme();
  
  return (
    <Box
      sx={{
        p: theme.spacing(2),
        borderRadius: theme.shape.borderRadius,
        backgroundColor: theme.palette.background.paper,
        boxShadow: theme.shadows[2],
      }}
    >
      <Typography variant="h5" color="primary">
        {course.fullname}
      </Typography>
      <Button variant="contained" sx={{ mt: theme.spacing(2) }}>
        View Course
      </Button>
    </Box>
  );
}
```

### Global Styles

**Global CSS** (`src/styles/global.css`):

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  font-family: 'Roboto', 'Helvetica', 'Arial', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  min-height: 100vh;
}
```

## Deployment

### Docker Build

**Dockerfile** (`docker/Dockerfile`):

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Build and Run:**

```bash
# Build Docker image
docker build -f docker/Dockerfile -t moodle-react-frontend .

# Run container
docker run -p 8080:80 moodle-react-frontend

# Access at http://localhost:8080
```

### Nginx Configuration

**nginx.conf** (`docker/nginx.conf`):

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    # SPA routing: serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API requests to backend
    location /api {
        proxy_pass http://backend:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### Environment-Specific Builds

```bash
# Development build
npm run build

# Production build with environment
VITE_API_BASE_URL=https://api.moodle.example.com npm run build

# Staging build
cp .env.staging .env.production
npm run build
```

### Deployment Checklist

- [ ] Run `npm run type-check` (no errors)
- [ ] Run `npm run lint` (no warnings)
- [ ] Run `npm test -- --run` (all tests pass)
- [ ] Run `npm run coverage` (90%+ coverage)
- [ ] Run `npm run build` (successful build)
- [ ] Verify bundle sizes (<300KB main bundle gzipped)
- [ ] Test production build with `npm run preview`
- [ ] Update environment variables for target environment
- [ ] Verify API connectivity from production environment
- [ ] Test in all target browsers (Chrome, Firefox, Safari)
- [ ] Run Lighthouse audit (performance score >90)
- [ ] Verify accessibility with axe DevTools
- [ ] Check error monitoring (Sentry, etc.)
- [ ] Update deployment documentation

## Contributing

### Coding Standards

1. **TypeScript Strict Mode**: No `any` types in production code
2. **ESLint Compliance**: Zero warnings allowed
3. **Prettier Formatting**: Consistent code style
4. **Test Coverage**: 90%+ for new code
5. **Accessibility**: WCAG 2.1 AA compliance
6. **Performance**: Bundle size budget respected

### Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write code following coding standards
   - Add unit tests for new components/hooks
   - Update integration tests if needed
   - Document public APIs

3. **Test Changes**
   ```bash
   npm run type-check
   npm run lint
   npm test -- --run
   npm run coverage
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add course enrollment button"
   ```

   **Commit Message Format:**
   ```
   type(scope): subject

   body

   footer
   ```

   **Types:**
   - `feat`: New feature
   - `fix`: Bug fix
   - `docs`: Documentation changes
   - `style`: Code style changes (formatting)
   - `refactor`: Code refactoring
   - `test`: Adding or updating tests
   - `chore`: Maintenance tasks

5. **Push and Create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Pull Request Checklist

- [ ] Code follows project coding standards
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No ESLint warnings (`npm run lint`)
- [ ] Test coverage meets threshold (90%+)
- [ ] Accessibility verified (keyboard navigation, screen reader)
- [ ] Performance impact assessed
- [ ] Commits follow conventional commit format
- [ ] PR description clearly explains changes
- [ ] Related issues linked

### Code Review Guidelines

**Reviewers Should Check:**

1. **Functionality**: Does the code work as intended?
2. **Code Quality**: Is the code readable and maintainable?
3. **Tests**: Are tests comprehensive and meaningful?
4. **Performance**: Any performance implications?
5. **Security**: Any security concerns?
6. **Accessibility**: Accessible to all users?
7. **Documentation**: Is it well-documented?

## Performance

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **First Contentful Paint (FCP)** | <1.5s | 3G connection |
| **Largest Contentful Paint (LCP)** | <2.5s | Core Web Vital |
| **Time to Interactive (TTI)** | <5s | Full interactivity |
| **First Input Delay (FID)** | <100ms | Core Web Vital |
| **Cumulative Layout Shift (CLS)** | <0.1 | Core Web Vital |
| **Main Bundle Size** | <300KB | Gzipped |
| **Total Bundle Size** | <1MB | Gzipped |
| **API Response Time (P95)** | <1s | Backend performance |

### Optimization Strategies

**Code Splitting:**

```typescript
// Lazy load route components
const Dashboard = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const Courses = lazy(() => import('@/features/courses/pages/CourseCatalogPage'));

// Router with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/courses" element={<Courses />} />
  </Routes>
</Suspense>
```

**Image Optimization:**

- Use WebP format with fallbacks
- Lazy load images with `loading="lazy"`
- Use responsive image sizes with `srcset`
- Compress images before upload

**Memoization:**

```typescript
// Expensive computation
const sortedCourses = useMemo(
  () => courses.sort((a, b) => a.name.localeCompare(b.name)),
  [courses]
);

// Prevent unnecessary re-renders
const MemoizedCourseCard = memo(CourseCard);
```

**Virtual Scrolling:**

```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={courses.length}
  itemSize={100}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <CourseCard course={courses[index]} />
    </div>
  )}
</FixedSizeList>
```

### Performance Monitoring

**Lighthouse CI:**

```bash
# Run Lighthouse audit
npm install -g @lhci/cli
lhci autorun

# Target scores:
# - Performance: >90
# - Accessibility: >95
# - Best Practices: >95
# - SEO: >90
```

**Bundle Analysis:**

```bash
# Analyze bundle sizes
npm run build -- --mode analyze

# Opens visualization of bundle contents
```

## Accessibility

### WCAG 2.1 AA Compliance

All components must meet WCAG 2.1 Level AA standards:

**Keyboard Navigation:**

- All interactive elements accessible via keyboard
- Logical tab order
- Visible focus indicators
- Keyboard shortcuts documented

**Screen Reader Support:**

- Proper ARIA labels and roles
- Meaningful alt text for images
- Live regions for dynamic content
- Descriptive link text

**Color and Contrast:**

- Color contrast ratio ≥4.5:1 for normal text
- Color contrast ratio ≥3:1 for large text
- Color not the only means of conveying information

**Responsive and Adaptable:**

- Text can be resized up to 200%
- Content reflows at different viewport sizes
- Touch targets ≥44x44 pixels

### Accessibility Testing

**Automated Testing:**

```bash
# Install axe-core
npm install --save-dev @axe-core/react

# Add to test setup
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

// Test component accessibility
test('has no accessibility violations', async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**Manual Testing:**

1. **Keyboard Navigation**: Tab through entire interface
2. **Screen Reader**: Test with NVDA, JAWS, or VoiceOver
3. **Zoom**: Test at 200% zoom level
4. **Color Contrast**: Verify with browser DevTools

**Accessibility Checklist:**

- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Buttons have descriptive text
- [ ] Links have meaningful text
- [ ] ARIA roles used appropriately
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Color contrast meets standards
- [ ] Heading hierarchy logical
- [ ] Error messages clear and helpful

## Troubleshooting

### Common Issues

**Issue: Port 5173 already in use**

```bash
# Find process using port
lsof -i :5173

# Kill process
kill -9 <PID>

# Or use different port
npm run dev -- --port 3000
```

**Issue: Module not found errors after npm install**

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Issue: TypeScript errors after pulling latest changes**

```bash
# Rebuild TypeScript
npm run type-check

# If still errors, check tsconfig.json paths
```

**Issue: Tests failing with "Cannot find module"**

```bash
# Check path aliases in vitest.config.ts
# Ensure they match tsconfig.json paths
```

**Issue: API requests failing with CORS errors**

```bash
# Check VITE_API_BASE_URL in .env.development
# Verify backend CORS configuration allows frontend origin
# Check browser console for specific CORS error
```

**Issue: Hot Module Replacement not working**

```bash
# Check Vite config
# Ensure no file watchers limit (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Getting Help

- **Documentation**: Check `/docs` folder for detailed guides
- **API Reference**: See `/api/README.md` for API documentation
- **Storybook**: Run `npm run storybook` for component examples
- **GitHub Issues**: Report bugs or request features
- **Team Chat**: Ask questions in development channel

## License

This project is part of Moodle and follows the GNU General Public License v3.0. See the root LICENSE file for details.

---

**Moodle React Frontend** - Built with ❤️ by the Moodle Development Team
