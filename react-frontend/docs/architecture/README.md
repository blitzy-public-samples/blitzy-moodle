# Moodle React Frontend Architecture

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [Target Architecture](#target-architecture)
4. [Architectural Transformation Strategy](#architectural-transformation-strategy)
5. [Core Architectural Patterns](#core-architectural-patterns)
6. [System Components](#system-components)
7. [Data Flow Patterns](#data-flow-patterns)
8. [Authentication Architecture](#authentication-architecture)
9. [State Management Strategy](#state-management-strategy)
10. [Component Interaction Patterns](#component-interaction-patterns)
11. [API Layer Architecture](#api-layer-architecture)
12. [Performance Architecture](#performance-architecture)
13. [Security Architecture](#security-architecture)
14. [Backward Compatibility Strategy](#backward-compatibility-strategy)
15. [Testing Architecture](#testing-architecture)
16. [Directory Structure](#directory-structure)
17. [Architecture Decision Records](#architecture-decision-records)
18. [Conclusion](#conclusion)

---

## Executive Summary

This document describes the comprehensive architecture for transforming Moodle's PHP server-side rendering (SSR) system into a modern React 18 single-page application (SPA) while maintaining **100% backward compatibility** with all existing Moodle functionality.

### Key Architectural Principles

1. **Zero Backend Modification**: All existing PHP business logic remains completely untouched
2. **Thin API Wrapper Pattern**: New REST API endpoints wrap existing Moodle core functions
3. **Frontend Modernization**: React 18 SPA with TypeScript, Material-UI v5, and modern state management
4. **Gradual Migration**: Feature flags enable coexistence of PHP and React interfaces during transition
5. **Performance First**: Code splitting, lazy loading, and optimistic updates for superior UX

### Transformation Scope

- **New Files Created**: 451 (320 React components + 131 API endpoints)
- **Existing Files Modified**: 3 (append-only: config.php, composer.json, web server config)
- **Business Logic Preserved**: 17,875 PHP files remain unchanged (100%)
- **Database Schema Changes**: Zero (complete immutability)

---

## Current Architecture

### PHP Server-Side Rendering Pattern

```
┌─────────────────────────────────────────────────────────┐
│                   User Browser                          │
│  HTTP GET /course/view.php?id=5                         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────┐
│           Apache/NGINX + PHP-FPM Server                 │
│                                                           │
│  1. Authenticate session (sesskey validation)            │
│  2. Check permissions (require_capability)               │
│  3. Execute business logic (get_course, check_enrol)     │
│  4. Query database ($DB->get_record)                     │
│  5. Render HTML with mustache templates                  │
│  6. Return complete HTML page (200 OK)                   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────┐
│            Browser Renders HTML                          │
│  • Full page reload on every navigation                  │
│  • Session-based authentication (cookies)                │
│  • Server generates all HTML content                     │
│  • Limited client-side interactivity                     │
└─────────────────────────────────────────────────────────┘
```

### Current Architecture Characteristics

| Aspect | Implementation | Challenges |
|--------|----------------|------------|
| **Rendering** | Server-side HTML generation | Full page reloads, slow navigation |
| **State Management** | PHP sessions, URL parameters | Poor UX, no optimistic updates |
| **Authentication** | Session cookies (sesskey) | Difficult to scale horizontally |
| **Data Transfer** | Full HTML pages (100-500KB) | High bandwidth usage |
| **Interactivity** | Limited jQuery/YUI scripts | Inconsistent behavior |
| **Mobile Experience** | Responsive CSS | Separate mobile app needed |

---

## Target Architecture

### React 18 SPA with RESTful API

```
┌─────────────────────────────────────────────────────────┐
│              React SPA (Static Bundle)                   │
│                                                           │
│  • Client-side routing (React Router v6)                 │
│  • Component-based UI (Material-UI v5)                   │
│  • JWT token authentication                              │
│  • Optimistic updates with React Query                   │
│  • Redux Toolkit for global state                        │
└──────────────────────┬──────────────────────────────────┘
                       │ API Request
                       │ GET /api/v1/courses/5
                       │ Authorization: Bearer <jwt_token>
                       ↓
┌─────────────────────────────────────────────────────────┐
│                 API Gateway Layer                        │
│                 /api/v1/* endpoints                      │
│                                                           │
│  1. Validate JWT token (signature + expiration)          │
│  2. Extract user ID from token payload                   │
│  3. Handle CORS preflight requests                       │
│  4. Route to appropriate endpoint handler                │
└──────────────────────┬──────────────────────────────────┘
                       │ Call existing function
                       │ $course = get_course($id)
                       ↓
┌─────────────────────────────────────────────────────────┐
│           Existing PHP Business Logic                    │
│           (COMPLETELY PRESERVED)                         │
│                                                           │
│  • get_course($id) - Course retrieval                    │
│  • require_capability() - Permission check               │
│  • $DB->get_record() - Database query                    │
│  • validate_context() - Context validation               │
│  • Return data array to API layer                        │
└──────────────────────┬──────────────────────────────────┘
                       │ JSON Response
                       │ {"success": true, "data": {...}}
                       ↓
┌─────────────────────────────────────────────────────────┐
│          React State Management Layer                    │
│                                                           │
│  • React Query caches response (5min stale time)         │
│  • Redux updates global state if needed                  │
│  • Components automatically re-render                    │
│  • Optimistic UI updates before server response          │
└─────────────────────────────────────────────────────────┘
```

### Target Architecture Characteristics

| Aspect | Implementation | Benefits |
|--------|----------------|----------|
| **Rendering** | Client-side React components | Instant navigation, smooth UX |
| **State Management** | Redux + React Query | Clear separation of concerns |
| **Authentication** | JWT tokens (stateless) | Horizontal scaling, mobile-friendly |
| **Data Transfer** | JSON payloads (5-50KB) | 80% bandwidth reduction |
| **Interactivity** | React 18 concurrent features | Consistent, predictable behavior |
| **Mobile Experience** | Progressive Web App (PWA) | Single codebase, offline support |

---

## Architectural Transformation Strategy

### Transformation Principles

1. **Addition, Not Modification**
   - Create 451 new files (320 React + 131 API)
   - Modify only 3 existing files (append-only)
   - Preserve all 17,875 PHP files without changes

2. **Wrapper Pattern**
   - API endpoints are thin wrappers around existing functions
   - Zero business logic duplication
   - Permission checks use existing `require_capability()`

3. **Gradual Rollout**
   - Feature flags control React vs PHP interface per user
   - Both interfaces coexist during transition
   - Rollback capability via configuration change

4. **Zero Breaking Changes**
   - All existing APIs continue functioning
   - Plugin ecosystem maintains compatibility
   - Database schema remains identical

### Transformation Mapping

```
PHP PAGE                    →  REACT COMPONENT + API ENDPOINT
────────────────────────────────────────────────────────────
/login/index.php            →  LoginPage.tsx + POST /api/v1/auth/login
/course/view.php?id=5       →  CourseDetailPage.tsx + GET /api/v1/courses/5
/mod/assign/view.php?id=10  →  AssignmentPage.tsx + GET /api/v1/assignments/10
/mod/quiz/attempt.php       →  QuizAttemptPage.tsx + POST /api/v1/quizzes/{id}/attempt
/grade/report/user/         →  StudentGradebookPage.tsx + GET /api/v1/gradebook/user/{id}
/my/index.php               →  DashboardPage.tsx + GET /api/v1/users/{id}/dashboard
```

---

## Core Architectural Patterns

### 1. Separation of Concerns

```
┌──────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│                      (React Components)                      │
│                                                               │
│  • Material-UI v5 styled components                          │
│  • Responsive design with MUI breakpoints                    │
│  • Accessibility (WCAG 2.1 AA)                               │
│  • Client-side routing and navigation                        │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT LAYER                    │
│                                                               │
│  GLOBAL STATE (Redux Toolkit)     SERVER STATE (React Query) │
│  • Authentication status           • Courses data             │
│  • User profile                    • Assignments             │
│  • Theme preferences               • Grades                  │
│  • UI state (modals, etc.)         • Messages                │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                       API CLIENT LAYER                       │
│                                                               │
│  • Axios HTTP client with interceptors                       │
│  • JWT token management (refresh on expiry)                  │
│  • Request/response transformation                           │
│  • Error handling and retry logic                            │
└───────────────────────────┬──────────────────────────────────┘
                            │ REST API (JSON)
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                       │
│                    (/api/v1/* endpoints)                     │
│                                                               │
│  • JWT validation middleware                                 │
│  • CORS handling                                             │
│  • Rate limiting (1000 req/hour/user)                        │
│  • Request routing                                           │
└───────────────────────────┬──────────────────────────────────┘
                            │ Function calls
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                     BUSINESS LOGIC LAYER                     │
│                   (Existing PHP Functions)                   │
│                                                               │
│  • Course management (get_course, create_course)             │
│  • Enrollment logic (enrol_try_internal_enrol)               │
│  • Permission checks (require_capability)                    │
│  • Grade calculations (grade_get_grades)                     │
│  • File operations (get_file_storage)                        │
└───────────────────────────┬──────────────────────────────────┘
                            │ Database queries
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                       DATA ACCESS LAYER                      │
│                    (Moodle Database Abstraction)             │
│                                                               │
│  • $DB->get_record() / get_records()                         │
│  • $DB->insert_record() / update_record()                    │
│  • Transaction management                                    │
│  • Query caching                                             │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                          │
│                  (MySQL 8.0+ / PostgreSQL 13+)               │
│                                                               │
│  • Existing schema (ZERO changes)                            │
│  • All tables preserved                                      │
│  • Indexes unchanged                                         │
└──────────────────────────────────────────────────────────────┘
```

### 2. Repository Pattern

API endpoints act as repositories that delegate to existing Moodle functions:

```typescript
// React Hook (Frontend)
export function useCourse(courseId: number) {
  return useQuery({
    queryKey: ['courses', courseId],
    queryFn: () => apiClient.get(`/api/v1/courses/${courseId}`),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });
}

// Component Usage
function CourseDetailPage({ courseId }: Props) {
  const { data: course, isLoading, error } = useCourse(courseId);
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert error={error} />;
  
  return <CourseDetail course={course} />;
}
```

```php
// API Endpoint (Backend) - /api/v1/courses/show.php
<?php
require_once(__DIR__ . '/../../lib/api_base.php');

class CourseShowEndpoint extends ApiBase {
    protected function handle_get() {
        $courseid = required_param('id', PARAM_INT);
        
        // Use existing Moodle function (NO business logic duplication)
        $course = get_course($courseid);
        
        // Permission check using existing function
        $context = context_course::instance($courseid);
        require_capability('moodle/course:view', $context);
        
        // Return JSON response
        return $this->json_response($course);
    }
}
```

### 3. Dependency Injection Pattern

API client is injected via React Context for loose coupling:

```typescript
// API Provider Setup
import { createContext, useContext } from 'react';
import { apiClient } from '@/services/api/client';

const ApiContext = createContext(apiClient);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  return (
    <ApiContext.Provider value={apiClient}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within ApiProvider');
  }
  return context;
}
```

### 4. Factory Pattern for Activity Components

Different activity types render appropriate components:

```typescript
// Activity Component Factory
export function ActivityRenderer({ activity }: { activity: Activity }) {
  const Component = activityFactory(activity.type);
  return <Component activity={activity} />;
}

function activityFactory(type: ActivityType): React.ComponentType<ActivityProps> {
  switch (type) {
    case 'assign':
      return AssignmentView;
    case 'quiz':
      return QuizView;
    case 'forum':
      return ForumView;
    case 'resource':
      return ResourceView;
    case 'page':
      return PageView;
    case 'url':
      return URLView;
    // ... 17 more activity types
    default:
      return GenericActivityView;
  }
}
```

---

## System Components

### 1. React Frontend Components

```
react-frontend/
├── src/
│   ├── app/                      # Application Setup
│   │   ├── store.ts              # Redux store configuration
│   │   ├── router.tsx            # Route definitions
│   │   └── providers.tsx         # Context providers wrapper
│   │
│   ├── features/                 # Feature Modules (280 files)
│   │   ├── auth/                 # Authentication (15 files)
│   │   │   ├── components/       # LoginForm, LogoutButton
│   │   │   ├── pages/            # LoginPage, PasswordResetPage
│   │   │   ├── hooks/            # useAuth, usePermissions
│   │   │   ├── api/              # authApi.ts (React Query)
│   │   │   ├── store/            # authSlice.ts (Redux)
│   │   │   └── types/            # auth.types.ts
│   │   │
│   │   ├── courses/              # Course Management (25 files)
│   │   ├── dashboard/            # User Dashboard (18 files)
│   │   ├── activities/           # Activity Modules (95 files)
│   │   │   ├── assignments/      # Assignment feature (20 files)
│   │   │   ├── quizzes/          # Quiz feature (25 files)
│   │   │   ├── forums/           # Forum feature (18 files)
│   │   │   └── resources/        # Resource feature (12 files)
│   │   ├── gradebook/            # Gradebook (15 files)
│   │   ├── messaging/            # Messaging (12 files)
│   │   ├── admin/                # Administration (30 files)
│   │   └── profile/              # User Profile (10 files)
│   │
│   ├── components/               # Shared Components (30 files)
│   │   ├── layouts/              # AppLayout, DashboardLayout
│   │   ├── navigation/           # Header, Sidebar, Breadcrumbs
│   │   ├── forms/                # FormInput, FormSelect
│   │   ├── data-display/         # DataTable, Card, List
│   │   └── feedback/             # Alert, Modal, Toast
│   │
│   ├── hooks/                    # Custom Hooks (8 files)
│   ├── services/                 # Services (6 files)
│   ├── types/                    # Global Types (5 files)
│   ├── utils/                    # Utilities (6 files)
│   ├── styles/                   # Styles (3 files)
│   └── config/                   # Configuration (2 files)
```

### 2. API Gateway Layer

```
api/
├── lib/                          # API Utilities (4 files)
│   ├── api_base.php              # Abstract base class for endpoints
│   ├── auth_jwt.php              # JWT generation/validation
│   ├── api_response.php          # Standard response formatter
│   └── api_exception.php         # Exception handling
│
└── v1/                           # API Version 1 (127 endpoints)
    ├── auth/                     # Authentication (4 endpoints)
    ├── courses/                  # Course CRUD (7 endpoints)
    ├── users/                    # User management (6 endpoints)
    ├── assignments/              # Assignment operations (6 endpoints)
    ├── quizzes/                  # Quiz engine (8 endpoints)
    ├── forums/                   # Forum operations (9 endpoints)
    ├── gradebook/                # Grade management (7 endpoints)
    ├── messages/                 # Messaging (7 endpoints)
    ├── admin/                    # Administration (15 endpoints)
    └── [12 more modules]         # Additional activity modules
```

### 3. Existing PHP Backend (Preserved)

```
public/
├── lib/                          # Core Functions (847 files)
│   ├── accesslib.php             # Permission checking (PRESERVED)
│   ├── datalib.php               # Database operations (PRESERVED)
│   ├── moodlelib.php             # Core functions (PRESERVED)
│   ├── gradelib.php              # Grade calculations (PRESERVED)
│   └── ...                       # All preserved
│
├── mod/                          # Activity Modules
│   ├── assign/lib.php            # Assignment logic (PRESERVED)
│   ├── quiz/lib.php              # Quiz engine (PRESERVED)
│   └── ...                       # All 23 modules preserved
│
└── [All other directories]       # 17,875 files PRESERVED
```

---

## Data Flow Patterns

### 1. Read Operation Flow (Course View Example)

```
USER ACTION: Click on "View Course"
    │
    ↓
┌───────────────────────────────────────────────┐
│  React Router Navigation                      │
│  /courses/5 → <CourseDetailPage courseId=5>  │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  React Component Mounts                       │
│  useCourse(5) hook executes                   │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  React Query Check                            │
│  Is course#5 in cache?                        │
│  • YES → Return cached data (instant)         │
│  • NO → Fetch from API ↓                      │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  HTTP Request                                 │
│  GET /api/v1/courses/5                        │
│  Authorization: Bearer <jwt_token>            │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  API Gateway (/api/v1/courses/show.php)       │
│  1. Validate JWT signature                    │
│  2. Check token expiration                    │
│  3. Extract user ID from payload              │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  Permission Check (Existing PHP)              │
│  $context = context_course::instance(5);      │
│  require_capability('moodle/course:view');    │
│  → PASS: Continue                             │
│  → FAIL: Return 403 Forbidden                 │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  Business Logic (Existing PHP)                │
│  $course = get_course(5);                     │
│  • Queries mdl_course table                   │
│  • Validates course exists                    │
│  • Returns course object                      │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  API Response (JSON)                          │
│  {                                            │
│    "success": true,                           │
│    "data": {                                  │
│      "id": 5,                                 │
│      "fullname": "Introduction to React",     │
│      "shortname": "REACT101",                 │
│      "summary": "Learn React...",             │
│      ...                                      │
│    }                                          │
│  }                                            │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  React Query Caching                          │
│  • Store course#5 in cache                    │
│  • Set staleTime: 5 minutes                   │
│  • Set cacheTime: 30 minutes                  │
│  • Trigger component re-render                │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  Component Update                             │
│  <CourseDetail course={data} />               │
│  → Course information displayed               │
│  → User sees course content (fast!)           │
└───────────────────────────────────────────────┘
```

### 2. Write Operation Flow (Course Enrollment Example)

```
USER ACTION: Click "Enroll in Course" button
    │
    ↓
┌───────────────────────────────────────────────┐
│  React Component Event                        │
│  <EnrollButton onClick={handleEnroll} />      │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  Optimistic Update (Optional)                 │
│  • Update UI immediately                      │
│  • Show "Enrolling..." state                  │
│  • Disable button                             │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  React Query Mutation                         │
│  useEnrollInCourse().mutate(courseId)         │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  HTTP Request                                 │
│  POST /api/v1/courses/5/enroll                │
│  Authorization: Bearer <jwt_token>            │
│  Content-Type: application/json               │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  API Gateway (/api/v1/courses/enroll.php)     │
│  1. Validate JWT token                        │
│  2. Extract user ID from token                │
│  3. Validate request body                     │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  Permission Check (Existing PHP)              │
│  require_capability('moodle/course:enrol');   │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  Business Logic (Existing PHP)                │
│  enrol_try_internal_enrol($courseid, $userid);│
│  • Validates enrollment method                │
│  • Checks capacity limits                     │
│  • Creates enrollment record                  │
│  • Triggers events (user_enrolled)            │
│  • Returns enrollment status                  │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  API Response (JSON)                          │
│  {                                            │
│    "success": true,                           │
│    "data": {                                  │
│      "courseId": 5,                           │
│      "enrolled": true,                        │
│      "enrollmentId": 12345                    │
│    }                                          │
│  }                                            │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  React Query Cache Invalidation               │
│  queryClient.invalidateQueries(['courses',5]) │
│  • Refetch course data                        │
│  • Update enrollment status                   │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  Component Update                             │
│  • Button shows "Enrolled ✓"                  │
│  • Success toast notification                 │
│  • Course page updates enrollment status      │
│  • User gains access to course content        │
└───────────────────────────────────────────────┘
```

### 3. File Upload Flow (Assignment Submission)

```
USER ACTION: Drag file into DropZone component
    │
    ↓
┌───────────────────────────────────────────────┐
│  Client-Side Validation                       │
│  • Check file type (PDF, DOCX, etc.)          │
│  • Check file size (<50MB)                    │
│  • Validate file name                         │
│  → PASS: Continue                             │
│  → FAIL: Show error, stop                     │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  FormData Preparation                         │
│  const formData = new FormData();             │
│  formData.append('file', file);               │
│  formData.append('assignmentId', 10);         │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  HTTP Request (Multipart)                     │
│  POST /api/v1/assignments/10/submit           │
│  Authorization: Bearer <jwt_token>            │
│  Content-Type: multipart/form-data            │
│  Body: FormData with file                     │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  API Gateway (file handling)                  │
│  • Validate JWT token                         │
│  • Check file upload limits                   │
│  • Validate assignment exists                 │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  Permission Check                             │
│  require_capability('mod/assign:submit');     │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  Business Logic (Existing PHP)                │
│  assign_save_submission($assignmentid, $file);│
│  • Store file via get_file_storage()          │
│  • Create submission record                   │
│  • Update submission status                   │
│  • Trigger submission_created event           │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  API Response                                 │
│  {                                            │
│    "success": true,                           │
│    "data": {                                  │
│      "submissionId": 12345,                   │
│      "file": {                                │
│        "name": "report.pdf",                  │
│        "size": 2048000,                       │
│        "url": "/pluginfile.php/..."          │
│      },                                       │
│      "submittedAt": "2024-01-15T10:30:00Z"   │
│    }                                          │
│  }                                            │
└────────────────┬──────────────────────────────┘
                 │
                 ↓
┌───────────────────────────────────────────────┐
│  Component Update                             │
│  • Show success message                       │
│  • Display uploaded file preview              │
│  • Update submission status badge             │
│  • Enable "View Submission" button            │
└───────────────────────────────────────────────┘
```

---

## Authentication Architecture

### JWT Token-Based Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: User Login                                          │
│  ┌─────────────┐                                             │
│  │   Browser   │ POST /api/v1/auth/login                     │
│  │   (React)   │ { username, password }                      │
│  └──────┬──────┘                                             │
│         │                                                     │
│         ↓                                                     │
│  ┌────────────────────────────────────────┐                  │
│  │  API: /api/v1/auth/login.php           │                  │
│  │  • Sanitize input (clean_param)        │                  │
│  │  • Call authenticate_user_login()       │                  │
│  │    (Existing Moodle function)          │                  │
│  │  • Supports LDAP, OAuth, SAML, Local   │                  │
│  └────────────────┬───────────────────────┘                  │
│                   │                                           │
│         Authentication FAILED?                                │
│                   │                                           │
│         YES ← ────┴──── → NO                                  │
│          │                 │                                  │
│          ↓                 ↓                                  │
│    Return 401         Generate JWT Tokens                    │
│    Unauthorized       ┌─────────────────────┐                │
│                       │  Access Token:       │                │
│                       │  • Expiry: 1 hour    │                │
│                       │  • Payload:          │                │
│                       │    - sub: user_id    │                │
│                       │    - roles: [...]    │                │
│                       │    - iat, exp        │                │
│                       │  • Algorithm: HS256  │                │
│                       └──────────┬───────────┘                │
│                                  │                            │
│                       ┌─────────────────────┐                │
│                       │  Refresh Token:      │                │
│                       │  • Expiry: 7 days    │                │
│                       │  • Stored in Redis   │                │
│                       │  • One-time use      │                │
│                       └──────────┬───────────┘                │
│                                  │                            │
│                                  ↓                            │
│         Return JSON Response:                                 │
│         {                                                     │
│           "success": true,                                    │
│           "data": {                                           │
│             "accessToken": "eyJ...",                          │
│             "refreshToken": "eyJ...",                         │
│             "expiresIn": 3600,                                │
│             "user": { id, name, email, roles }                │
│           }                                                   │
│         }                                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Store Tokens (React)                                │
│  ┌─────────────┐                                             │
│  │   Browser   │ Receive tokens                              │
│  │   (React)   │ Store securely:                             │
│  └──────┬──────┘ • httpOnly cookie (recommended), OR        │
│         │        • localStorage (with XSS protection)        │
│         │                                                     │
│         ↓                                                     │
│  Redux authSlice updates:                                    │
│  {                                                            │
│    isAuthenticated: true,                                    │
│    user: { id, name, email, roles },                         │
│    accessToken: "eyJ...",                                    │
│    refreshToken: "eyJ..."                                    │
│  }                                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Authenticated API Requests                          │
│  ┌─────────────┐                                             │
│  │   Browser   │ GET /api/v1/courses/5                       │
│  │   (React)   │ Authorization: Bearer <access_token>        │
│  └──────┬──────┘                                             │
│         │                                                     │
│         ↓                                                     │
│  ┌────────────────────────────────────────┐                  │
│  │  API Gateway Middleware                │                  │
│  │  • Extract token from header           │                  │
│  │  • Validate JWT signature              │                  │
│  │  • Check expiration                    │                  │
│  │  • Verify token not blacklisted        │                  │
│  └────────────────┬───────────────────────┘                  │
│                   │                                           │
│         Token INVALID or EXPIRED?                             │
│                   │                                           │
│         YES ← ────┴──── → NO                                  │
│          │                 │                                  │
│          ↓                 ↓                                  │
│    Return 401         Extract user_id from token             │
│    (trigger refresh)   Process request with user context     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Token Refresh Flow                                  │
│  ┌─────────────┐                                             │
│  │   Browser   │ Access token expired (401 response)         │
│  │   (React)   │                                             │
│  └──────┬──────┘                                             │
│         │                                                     │
│         ↓                                                     │
│  Axios Interceptor Detects 401                               │
│  Automatically sends:                                         │
│  POST /api/v1/auth/refresh                                   │
│  { refreshToken: "eyJ..." }                                  │
│         │                                                     │
│         ↓                                                     │
│  ┌────────────────────────────────────────┐                  │
│  │  API: /api/v1/auth/refresh.php         │                  │
│  │  • Validate refresh token              │                  │
│  │  • Check Redis for token validity      │                  │
│  │  • Generate new access token           │                  │
│  │  • Invalidate old refresh token        │                  │
│  │  • Issue new refresh token             │                  │
│  └────────────────┬───────────────────────┘                  │
│                   │                                           │
│         Refresh Token VALID?                                  │
│                   │                                           │
│         YES ← ────┴──── → NO                                  │
│          │                 │                                  │
│          ↓                 ↓                                  │
│    Return new tokens   Return 401                            │
│    Retry original      Redirect to login                     │
│    request             Clear auth state                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Logout Flow                                         │
│  ┌─────────────┐                                             │
│  │   Browser   │ POST /api/v1/auth/logout                    │
│  │   (React)   │ { refreshToken }                            │
│  └──────┬──────┘                                             │
│         │                                                     │
│         ↓                                                     │
│  ┌────────────────────────────────────────┐                  │
│  │  API: /api/v1/auth/logout.php          │                  │
│  │  • Add access token to blacklist       │                  │
│  │  • Invalidate refresh token in Redis   │                  │
│  │  • Clear server-side session           │                  │
│  └────────────────┬───────────────────────┘                  │
│                   │                                           │
│                   ↓                                           │
│         Return 200 OK                                         │
│         │                                                     │
│         ↓                                                     │
│  ┌─────────────┐                                             │
│  │   Browser   │ Clear Redux auth state                      │
│  │   (React)   │ Remove tokens from storage                  │
│  │             │ Redirect to login page                      │
│  └─────────────┘                                             │
└─────────────────────────────────────────────────────────────┘
```

### JWT Token Structure

**Access Token Payload:**
```json
{
  "iss": "https://moodle.example.com",
  "sub": 12345,
  "iat": 1705320000,
  "exp": 1705323600,
  "roles": ["student", "teacher"],
  "capabilities": ["moodle/course:view", "mod/assign:submit"],
  "username": "johndoe"
}
```

**Security Considerations:**

1. **Token Storage**: httpOnly cookies prevent XSS attacks accessing tokens
2. **Token Rotation**: Refresh tokens are one-time use, rotated on each refresh
3. **Token Blacklist**: Redis stores blacklisted tokens until expiration
4. **HTTPS Only**: All token transmission requires encrypted connection
5. **Short Expiration**: 1-hour access tokens limit exposure window
6. **Signature Validation**: HS256 with 256-bit secret prevents tampering

---

## State Management Strategy

### Redux Toolkit (Global Application State)

```typescript
// Global State Structure
{
  auth: {
    isAuthenticated: boolean;
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    permissions: string[];
  },
  ui: {
    sidebarOpen: boolean;
    theme: 'light' | 'dark';
    notifications: Notification[];
    modals: {
      [modalId: string]: boolean;
    };
  },
  preferences: {
    language: string;
    timezone: string;
    dateFormat: string;
    emailNotifications: boolean;
  }
}
```

**When to Use Redux:**
- Authentication status (persists across app)
- User profile information (accessed globally)
- UI state (theme, sidebar, modals)
- User preferences (language, timezone)

**Redux Slice Example:**

```typescript
// features/auth/store/authSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    isAuthenticated: false,
    user: null,
    accessToken: null,
  } as AuthState,
  reducers: {
    setAuth(state, action: PayloadAction<{ user: User; accessToken: string }>) {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
    },
    clearAuth(state) {
      state.isAuthenticated = false;
      state.user = null;
      state.accessToken = null;
    },
  },
});

export const { setAuth, clearAuth } = authSlice.actions;
export default authSlice.reducer;
```

### React Query (Server State Management)

```typescript
// Server State Categories
{
  courses: QueryCache,      // Course catalog, details, contents
  assignments: QueryCache,  // Assignment data, submissions
  quizzes: QueryCache,      // Quiz attempts, questions
  grades: QueryCache,       // Gradebook data
  messages: QueryCache,     // Messages, notifications
  users: QueryCache,        // User profiles, lists
  // ... all data from server
}
```

**When to Use React Query:**
- Data fetched from API (courses, assignments, grades)
- Automatic caching and background refetching
- Optimistic updates for mutations
- Automatic retry on failure
- Request deduplication

**React Query Hook Example:**

```typescript
// features/courses/hooks/useCourses.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';

export function useCourses(filters?: CourseFilters) {
  return useQuery({
    queryKey: ['courses', filters],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/courses', {
        params: filters,
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: true,
  });
}

export function useEnrollInCourse() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (courseId: number) => {
      const response = await apiClient.post(`/api/v1/courses/${courseId}/enroll`);
      return response.data.data;
    },
    onSuccess: (_, courseId) => {
      // Invalidate course cache to refetch updated data
      queryClient.invalidateQueries(['courses', courseId]);
      queryClient.invalidateQueries(['users', 'me', 'courses']);
    },
  });
}
```

### State Management Decision Tree

```
Is the data...
│
├─ Fetched from server/API?
│  └─ YES → Use React Query
│      • Automatic caching
│      • Background sync
│      • Optimistic updates
│
├─ Global UI state (theme, modals)?
│  └─ YES → Use Redux Toolkit
│      • Persists across navigation
│      • Accessed by many components
│
├─ Component-tree scoped?
│  └─ YES → Use React Context
│      • Share within feature module
│      • Not needed globally
│
└─ UI-only (form inputs, dropdowns)?
   └─ YES → Use Local State (useState)
       • Component-specific
       • Doesn't affect other components
```

---

## Component Interaction Patterns

### Feature Module Structure

Each feature module follows a consistent structure:

```
features/courses/
├── components/           # Feature-specific components
│   ├── CourseCard.tsx
│   ├── CourseList.tsx
│   └── CourseDetail.tsx
│
├── pages/                # Route-level page components
│   ├── CourseCatalogPage.tsx
│   ├── CourseDetailPage.tsx
│   └── CourseEditPage.tsx
│
├── hooks/                # Custom hooks for this feature
│   ├── useCourses.ts     # React Query hook
│   ├── useCourse.ts      # Single course hook
│   └── useEnrollment.ts  # Enrollment mutation
│
├── api/                  # API client functions
│   └── courseApi.ts      # Axios calls to /api/v1/courses/*
│
├── store/                # Redux slice (if needed)
│   └── courseSlice.ts    # Global course state (rarely needed)
│
└── types/                # TypeScript interfaces
    └── course.types.ts   # Course, CourseFilters, etc.
```

### Component Hierarchy Example

```
<App>
  └─ <QueryClientProvider>         # React Query provider
      └─ <ReduxProvider>           # Redux store provider
          └─ <ThemeProvider>       # MUI theme provider
              └─ <BrowserRouter>   # React Router
                  └─ <AppLayout>   # Main layout component
                      ├─ <Header>  # Navigation header
                      ├─ <Sidebar> # Side navigation
                      └─ <Routes>  # Route definitions
                          ├─ <Route path="/courses">
                          │   └─ <CourseCatalogPage>
                          │       ├─ <CourseFilters>
                          │       └─ <CourseList>
                          │           └─ <CourseCard> (×N)
                          │
                          ├─ <Route path="/courses/:id">
                          │   └─ <CourseDetailPage>
                          │       ├─ <CourseHeader>
                          │       ├─ <EnrollButton>
                          │       ├─ <SectionList>
                          │       │   └─ <ActivityRenderer> (×N)
                          │       │       ├─ <AssignmentView>
                          │       │       ├─ <QuizView>
                          │       │       └─ <ForumView>
                          │       └─ <CourseProgress>
                          │
                          └─ <Route path="/assignments/:id">
                              └─ <AssignmentPage>
                                  ├─ <AssignmentDetail>
                                  ├─ <SubmissionForm>
                                  │   └─ <FileUploadZone>
                                  └─ <SubmissionHistory>
```

### Data Fetching Pattern

```typescript
// Page Component (CourseDetailPage.tsx)
export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data: course, isLoading, error } = useCourse(Number(courseId));
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert error={error} />;
  if (!course) return <NotFound />;
  
  return (
    <Box>
      <CourseHeader course={course} />
      <EnrollButton courseId={course.id} />
      <SectionList sections={course.sections} />
    </Box>
  );
}

// Child Component (EnrollButton.tsx)
export function EnrollButton({ courseId }: { courseId: number }) {
  const { mutate, isLoading } = useEnrollInCourse();
  const { user } = useAuth();
  const course = useCourse(courseId).data;
  
  const isEnrolled = course?.enrolledUsers?.includes(user.id);
  
  if (isEnrolled) {
    return <Chip label="Enrolled" color="success" icon={<CheckIcon />} />;
  }
  
  return (
    <Button
      onClick={() => mutate(courseId)}
      loading={isLoading}
      variant="contained"
    >
      Enroll in Course
    </Button>
  );
}
```

---

## API Layer Architecture

### API Endpoint Structure

All API endpoints extend a base class for consistency:

```php
<?php
// api/lib/api_base.php
abstract class ApiBase {
    protected $userid;
    protected $token;
    
    public function __construct() {
        // Validate JWT token
        $this->token = $this->validate_jwt();
        $this->userid = $this->token->sub;
        
        // Set up Moodle environment
        $this->setup_moodle_environment();
    }
    
    public function handle_request() {
        $method = $_SERVER['REQUEST_METHOD'];
        
        switch ($method) {
            case 'GET':
                return $this->handle_get();
            case 'POST':
                return $this->handle_post();
            case 'PUT':
                return $this->handle_put();
            case 'DELETE':
                return $this->handle_delete();
            default:
                return $this->error_response('Method not allowed', 405);
        }
    }
    
    protected function validate_jwt() {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
            $this->error_response('Missing authorization token', 401);
        }
        
        $token = $matches[1];
        return JWTHelper::validate($token);
    }
    
    protected function json_response($data, $success = true) {
        header('Content-Type: application/json');
        echo json_encode([
            'success' => $success,
            'data' => $data
        ]);
        exit;
    }
    
    protected function error_response($message, $code = 400) {
        header('Content-Type: application/json');
        http_response_code($code);
        echo json_encode([
            'success' => false,
            'error' => [
                'code' => $code,
                'message' => $message
            ]
        ]);
        exit;
    }
    
    // Abstract methods to be implemented by endpoints
    abstract protected function handle_get();
    protected function handle_post() {
        $this->error_response('Method not implemented', 501);
    }
    protected function handle_put() {
        $this->error_response('Method not implemented', 501);
    }
    protected function handle_delete() {
        $this->error_response('Method not implemented', 501);
    }
}
```

### Endpoint Implementation Example

```php
<?php
// api/v1/courses/show.php
require_once(__DIR__ . '/../../lib/api_base.php');
require_once($CFG->dirroot . '/course/lib.php');

class CourseShowEndpoint extends ApiBase {
    protected function handle_get() {
        // Get course ID from query parameter
        $courseid = required_param('id', PARAM_INT);
        
        // Use existing Moodle function (NO business logic duplication)
        try {
            $course = get_course($courseid);
        } catch (Exception $e) {
            return $this->error_response('Course not found', 404);
        }
        
        // Permission check using existing function
        $context = context_course::instance($courseid);
        try {
            require_capability('moodle/course:view', $context, $this->userid);
        } catch (Exception $e) {
            return $this->error_response('Access denied', 403);
        }
        
        // Get additional course data
        $coursecontents = get_course_contents($courseid);
        $enrolledusers = count_enrolled_users($context);
        
        // Build response data
        $data = [
            'id' => $course->id,
            'fullname' => $course->fullname,
            'shortname' => $course->shortname,
            'summary' => $course->summary,
            'startdate' => $course->startdate,
            'enddate' => $course->enddate,
            'visible' => (bool)$course->visible,
            'format' => $course->format,
            'enrolledUsers' => $enrolledusers,
            'sections' => $coursecontents
        ];
        
        return $this->json_response($data);
    }
}

// Execute endpoint
$endpoint = new CourseShowEndpoint();
$endpoint->handle_request();
```

### API Response Standards

**Success Response:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "fullname": "Introduction to React",
    "shortname": "REACT101",
    "summary": "Learn React from scratch",
    "startdate": 1704067200,
    "enddate": 1711843200,
    "visible": true,
    "format": "topics",
    "enrolledUsers": 45,
    "sections": [...]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "v1"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to view this course",
    "details": {
      "required_capability": "moodle/course:view",
      "context": "course",
      "courseId": 5
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "v1"
  }
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "fullname": "Course 1", ... },
    { "id": 2, "fullname": "Course 2", ... }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "perPage": 20,
      "total": 150,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

---

## Performance Architecture

### Code Splitting Strategy

```typescript
// Route-based code splitting with React.lazy
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// Lazy load page components
const CourseCatalogPage = lazy(() => import('@/features/courses/pages/CourseCatalogPage'));
const CourseDetailPage = lazy(() => import('@/features/courses/pages/CourseDetailPage'));
const AssignmentPage = lazy(() => import('@/features/activities/assignments/pages/AssignmentPage'));
const QuizAttemptPage = lazy(() => import('@/features/activities/quizzes/pages/QuizAttemptPage'));

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/courses" element={<CourseCatalogPage />} />
        <Route path="/courses/:id" element={<CourseDetailPage />} />
        <Route path="/assignments/:id" element={<AssignmentPage />} />
        <Route path="/quizzes/:id/attempt" element={<QuizAttemptPage />} />
      </Routes>
    </Suspense>
  );
}
```

### Component Optimization

```typescript
// React.memo for expensive components
import { memo } from 'react';

export const CourseCard = memo(function CourseCard({ course }: Props) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">{course.fullname}</Typography>
        <Typography variant="body2">{course.summary}</Typography>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function
  return prevProps.course.id === nextProps.course.id &&
         prevProps.course.fullname === nextProps.course.fullname;
});

// Virtual scrolling for long lists
import { FixedSizeList } from 'react-window';

export function CourseList({ courses }: { courses: Course[] }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={courses.length}
      itemSize={120}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <CourseCard course={courses[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

### Bundle Size Optimization

**Vite Configuration:**

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for stable dependencies
          vendor: ['react', 'react-dom', 'react-router-dom'],
          
          // MUI components in separate chunk
          mui: ['@mui/material', '@mui/icons-material'],
          
          // State management libraries
          state: ['@reduxjs/toolkit', 'react-redux', '@tanstack/react-query'],
          
          // Feature-based chunks
          courses: ['./src/features/courses'],
          activities: ['./src/features/activities'],
          admin: ['./src/features/admin'],
        },
      },
    },
    // Target modern browsers
    target: 'es2020',
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
      },
    },
  },
});
```

### Caching Strategy

```typescript
// React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: Data considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      
      // Cache time: Keep unused data in cache for 30 minutes
      cacheTime: 30 * 60 * 1000,
      
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
      
      // Retry failed requests 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

### Performance Targets

| Metric | Target | Measurement Tool |
|--------|--------|------------------|
| **First Contentful Paint (FCP)** | <1.5s on 3G | Lighthouse |
| **Largest Contentful Paint (LCP)** | <2.5s | Lighthouse |
| **Time to Interactive (TTI)** | <5s | Lighthouse |
| **First Input Delay (FID)** | <100ms | Real User Monitoring |
| **Cumulative Layout Shift (CLS)** | <0.1 | Lighthouse |
| **Main Bundle Size** | <300KB gzipped | Webpack Bundle Analyzer |
| **API Response Time (P95)** | <1s | Server monitoring |
| **Lighthouse Score** | >90 | Lighthouse CI |

---

## Security Architecture

### Multi-Layer Security Approach

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: Transport Security                                 │
│  • HTTPS required (TLS 1.2+)                                 │
│  • HSTS headers (Strict-Transport-Security)                  │
│  • Certificate pinning for mobile apps                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: Authentication                                     │
│  • JWT tokens with HS256 signature                          │
│  • 1-hour access token expiration                           │
│  • 7-day refresh token expiration                           │
│  • Token blacklist in Redis                                 │
│  • Existing Moodle auth plugins (LDAP, SSO, OAuth)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: Authorization                                      │
│  • require_capability() on every API endpoint               │
│  • Context-based permission checks                          │
│  • Role-based access control (RBAC)                         │
│  • Capability matrix validation                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4: Input Validation                                   │
│  • Server-side validation (clean_param, required_param)      │
│  • Client-side validation with Zod schemas                  │
│  • SQL injection prevention (parameterized queries)         │
│  • XSS prevention (React auto-escaping + DOMPurify)         │
│  • File upload validation (type, size, content)             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 5: Rate Limiting & CORS                               │
│  • 1000 requests/hour/user (configurable)                   │
│  • CORS whitelist (no wildcard in production)               │
│  • Preflight request handling                               │
│  • IP-based rate limiting                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 6: CSRF Protection                                    │
│  • CSRF tokens on state-changing operations                 │
│  • SameSite cookie attribute                                │
│  • Double-submit cookie pattern                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 7: Content Security Policy (CSP)                      │
│  • Strict CSP headers                                        │
│  • Script nonce validation                                  │
│  • No inline scripts in production                          │
│  • Frame-ancestors restriction                              │
└─────────────────────────────────────────────────────────────┘
```

### XSS Prevention

**React Automatic Escaping:**
```typescript
// Safe: React automatically escapes user input
function CourseTitle({ title }: { title: string }) {
  return <h1>{title}</h1>; // Escaped automatically
}

// Dangerous: Only use with trusted HTML
function CourseSummary({ html }: { html: string }) {
  // Sanitize with DOMPurify before rendering
  const sanitized = DOMPurify.sanitize(html);
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

**Server-Side Sanitization:**
```php
<?php
// Clean all user input
$coursename = clean_param($input['fullname'], PARAM_TEXT);
$summary = clean_param($input['summary'], PARAM_CLEANHTML);
$url = clean_param($input['url'], PARAM_URL);

// Use existing Moodle sanitization functions
$safecontent = format_text($content, FORMAT_HTML, [
    'trusted' => false,
    'noclean' => false
]);
```

### SQL Injection Prevention

```php
<?php
// CORRECT: Parameterized queries (existing Moodle pattern)
$courses = $DB->get_records('course', ['category' => $categoryid]);

// CORRECT: Named parameters
$sql = "SELECT * FROM {course} WHERE fullname LIKE :search";
$params = ['search' => '%' . $DB->sql_like_escape($search) . '%'];
$results = $DB->get_records_sql($sql, $params);

// INCORRECT: Never concatenate user input
// $sql = "SELECT * FROM course WHERE fullname LIKE '%$search%'"; // VULNERABLE!
```

### File Upload Security

```typescript
// Client-side validation
const allowedTypes = ['application/pdf', 'application/msword', 'image/jpeg'];
const maxSize = 50 * 1024 * 1024; // 50MB

function validateFile(file: File): string | null {
  if (!allowedTypes.includes(file.type)) {
    return 'Invalid file type. Allowed: PDF, DOCX, JPEG';
  }
  if (file.size > maxSize) {
    return 'File too large. Maximum size: 50MB';
  }
  return null; // Valid
}
```

```php
<?php
// Server-side validation (MANDATORY)
$file = $_FILES['submission'];

// Check file type by content, not extension
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

$allowed = ['application/pdf', 'application/msword', 'image/jpeg'];
if (!in_array($mime, $allowed)) {
    api_error('Invalid file type', 400);
}

// Check file size
if ($file['size'] > 50 * 1024 * 1024) {
    api_error('File too large', 400);
}

// Use existing Moodle file storage (virus scanning included)
$fs = get_file_storage();
$filerecord = [
    'contextid' => $context->id,
    'component' => 'mod_assign',
    'filearea' => 'submission_files',
    'itemid' => $submissionid,
    'filepath' => '/',
    'filename' => clean_filename($file['name'])
];
$storedfile = $fs->create_file_from_pathname($filerecord, $file['tmp_name']);
```

---

## Backward Compatibility Strategy

### Dual Interface Support

During the transition period, both PHP-rendered and React interfaces coexist:

**Feature Flag Configuration:**

```php
// config.php (append-only)
$CFG->react_features = [
    'enabled' => true,
    'default_interface' => 'react', // 'react' or 'php'
    'modules' => [
        'dashboard' => true,      // React dashboard enabled
        'courses' => true,        // React course pages enabled
        'assignments' => false,   // Keep PHP assignments
        'quizzes' => false,       // Keep PHP quizzes
        'gradebook' => false,     // Keep PHP gradebook
        'forums' => true,         // React forums enabled
        'messaging' => true,      // React messaging enabled
        'admin' => false,         // Keep PHP admin interface
    ],
    'user_override' => true,      // Allow users to choose interface
    'force_users' => [],          // Force specific users to React
];
```

**Interface Selection Logic:**

```php
<?php
// Existing entry point (e.g., course/view.php)
require_once(__DIR__ . '/../config.php');

// Check if React interface is enabled for courses
if (should_use_react_interface('courses', $USER->id)) {
    // Redirect to React SPA
    header('Location: /react-frontend/index.html#/courses/' . $courseid);
    exit;
}

// Otherwise, continue with existing PHP rendering
// ... existing code unchanged ...

function should_use_react_interface($module, $userid) {
    global $CFG, $USER;
    
    // Check if React is globally enabled
    if (empty($CFG->react_features['enabled'])) {
        return false;
    }
    
    // Check if module is enabled for React
    if (empty($CFG->react_features['modules'][$module])) {
        return false;
    }
    
    // Check if user is forced to React
    if (in_array($userid, $CFG->react_features['force_users'])) {
        return true;
    }
    
    // Check user preference
    if ($CFG->react_features['user_override']) {
        $preference = get_user_preferences('interface_preference', 'default', $userid);
        if ($preference === 'react') {
            return true;
        }
        if ($preference === 'php') {
            return false;
        }
    }
    
    // Use default setting
    return $CFG->react_features['default_interface'] === 'react';
}
```

### Plugin Compatibility

**React Extension Points:**

```typescript
// Plugin integration interface
interface MoodlePlugin {
  id: string;
  name: string;
  version: string;
  renderComponent?: React.ComponentType<any>;
  hooks?: {
    onCourseLoad?: (course: Course) => void;
    onActivityRender?: (activity: Activity) => React.ReactNode;
  };
}

// Plugin registry
class PluginRegistry {
  private plugins: Map<string, MoodlePlugin> = new Map();
  
  register(plugin: MoodlePlugin) {
    this.plugins.set(plugin.id, plugin);
  }
  
  getPluginComponent(pluginId: string): React.ComponentType | null {
    const plugin = this.plugins.get(pluginId);
    return plugin?.renderComponent ?? null;
  }
  
  executeHook(hookName: string, ...args: any[]) {
    this.plugins.forEach(plugin => {
      const hook = plugin.hooks?.[hookName];
      if (hook) {
        hook(...args);
      }
    });
  }
}

// Usage in activity renderer
function ActivityRenderer({ activity }: Props) {
  const pluginComponent = pluginRegistry.getPluginComponent(activity.pluginId);
  
  if (pluginComponent) {
    // Render React plugin component
    return <pluginComponent activity={activity} />;
  }
  
  if (activity.hasLegacyPlugin) {
    // Fallback: Embed legacy PHP plugin in iframe
    return <IframePluginWrapper src={activity.legacyUrl} />;
  }
  
  // Default: Standard activity rendering
  return <StandardActivityView activity={activity} />;
}
```

### URL Compatibility

Preserve existing URL patterns for bookmarks and SEO:

```typescript
// React Router routes mirror PHP URLs
const routes = [
  // Old: /course/view.php?id=5
  { path: '/course/view.php', element: <LegacyRedirect to="/courses/:id" /> },
  { path: '/courses/:id', element: <CourseDetailPage /> },
  
  // Old: /mod/assign/view.php?id=10
  { path: '/mod/assign/view.php', element: <LegacyRedirect to="/assignments/:id" /> },
  { path: '/assignments/:id', element: <AssignmentPage /> },
  
  // Old: /my/index.php
  { path: '/my/index.php', element: <Navigate to="/dashboard" /> },
  { path: '/dashboard', element: <DashboardPage /> },
];

// Legacy redirect component
function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const id = searchParams.get('id');
  
  const newPath = to.replace(':id', id || '');
  return <Navigate to={newPath} replace />;
}
```

---

## Testing Architecture

### Testing Pyramid

```
                 /\
                /  \
               /    \
              / E2E  \         15 tests (Critical journeys)
             /--------\
            /          \
           / Integration\      50 tests (API + component integration)
          /--------------\
         /                \
        /   Unit Tests     \   200+ tests (Components, hooks, utils)
       /--------------------\
      
  • Unit Tests: Fast, isolated, 90%+ coverage
  • Integration Tests: API + React Query + components
  • E2E Tests: Full user journeys with Playwright
```

### Unit Testing (Vitest + React Testing Library)

```typescript
// features/courses/components/CourseCard.test.tsx
import { render, screen } from '@testing-library/react';
import { CourseCard } from './CourseCard';

describe('CourseCard', () => {
  const mockCourse = {
    id: 1,
    fullname: 'Introduction to React',
    shortname: 'REACT101',
    summary: 'Learn React from scratch',
    enrolledUsers: 45,
  };
  
  it('renders course name', () => {
    render(<CourseCard course={mockCourse} />);
    expect(screen.getByText('Introduction to React')).toBeInTheDocument();
  });
  
  it('renders course summary', () => {
    render(<CourseCard course={mockCourse} />);
    expect(screen.getByText('Learn React from scratch')).toBeInTheDocument();
  });
  
  it('displays enrollment count', () => {
    render(<CourseCard course={mockCourse} />);
    expect(screen.getByText(/45 students/i)).toBeInTheDocument();
  });
});
```

### Integration Testing (API Mocking with MSW)

```typescript
// tests/integration/enrollment.test.tsx
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CourseDetailPage } from '@/features/courses/pages/CourseDetailPage';

const server = setupServer(
  rest.get('/api/v1/courses/5', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: {
        id: 5,
        fullname: 'Test Course',
        isEnrolled: false,
      }
    }));
  }),
  
  rest.post('/api/v1/courses/5/enroll', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: { enrolled: true, enrollmentId: 123 }
    }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Course Enrollment', () => {
  it('allows user to enroll in course', async () => {
    render(<CourseDetailPage courseId={5} />);
    
    // Wait for course to load
    await screen.findByText('Test Course');
    
    // Click enroll button
    const enrollButton = screen.getByRole('button', { name: /enroll/i });
    await userEvent.click(enrollButton);
    
    // Verify enrollment success
    await waitFor(() => {
      expect(screen.getByText(/enrolled/i)).toBeInTheDocument();
    });
  });
});
```

### E2E Testing (Playwright)

```typescript
// tests/e2e/course-enrollment.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Course Enrollment Journey', () => {
  test('student can discover and enroll in course', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[name="username"]', 'student1');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
    
    // 2. Navigate to course catalog
    await page.click('text=Browse Courses');
    await expect(page).toHaveURL('/courses');
    
    // 3. Search for course
    await page.fill('input[placeholder="Search courses"]', 'React');
    await page.waitForTimeout(500); // Debounce
    
    // 4. View course details
    await page.click('text=Introduction to React');
    await expect(page).toHaveURL(/\/courses\/\d+/);
    
    // 5. Enroll in course
    await page.click('button:has-text("Enroll in Course")');
    await expect(page.locator('text=Enrolled')).toBeVisible();
    
    // 6. Verify access to course content
    await expect(page.locator('text=Week 1')).toBeVisible();
    await expect(page.locator('text=Assignment 1')).toBeVisible();
  });
});
```

### Test Coverage Requirements

| Component Type | Coverage Target | Justification |
|----------------|----------------|---------------|
| **Business Logic Hooks** | 95%+ | Critical for correctness |
| **UI Components** | 85%+ | Visual testing + unit tests |
| **API Client Functions** | 90%+ | Integration with backend |
| **Utility Functions** | 95%+ | Pure functions, easy to test |
| **Redux Slices** | 90%+ | State management critical |

### Continuous Integration

```yaml
# .github/workflows/react-ci.yml
name: React Frontend CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          
      - name: Install dependencies
        run: npm ci
        working-directory: react-frontend
        
      - name: Lint
        run: npm run lint
        working-directory: react-frontend
        
      - name: Type check
        run: npm run type-check
        working-directory: react-frontend
        
      - name: Unit tests
        run: npm run test -- --coverage
        working-directory: react-frontend
        
      - name: E2E tests
        run: npm run test:e2e
        working-directory: react-frontend
        
      - name: Build
        run: npm run build
        working-directory: react-frontend
        
      - name: Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            https://staging.example.com
          uploadArtifacts: true
```

---

## Directory Structure

### Complete React Frontend Structure

```
react-frontend/
├── public/                          # Static assets
│   ├── index.html                   # HTML template
│   ├── favicon.ico                  # Site icon
│   ├── robots.txt                   # SEO robots file
│   └── manifest.json                # PWA manifest
│
├── src/                             # Source code
│   ├── main.tsx                     # Application entry point
│   ├── App.tsx                      # Root component
│   │
│   ├── app/                         # Application setup (6 files)
│   │   ├── store.ts                 # Redux store configuration
│   │   ├── router.tsx               # Route definitions
│   │   └── providers.tsx            # Context providers wrapper
│   │
│   ├── features/                    # Feature modules (280 files)
│   │   ├── auth/                    # Authentication (15 files)
│   │   ├── courses/                 # Course management (25 files)
│   │   ├── dashboard/               # User dashboard (18 files)
│   │   ├── activities/              # Activity modules (95 files)
│   │   ├── gradebook/               # Gradebook (15 files)
│   │   ├── messaging/               # Messaging (12 files)
│   │   ├── admin/                   # Administration (30 files)
│   │   └── profile/                 # User profile (10 files)
│   │
│   ├── components/                  # Shared components (30 files)
│   │   ├── layouts/                 # Page layouts
│   │   ├── navigation/              # Navigation components
│   │   ├── forms/                   # Form components
│   │   ├── data-display/            # Data display components
│   │   └── feedback/                # Feedback components
│   │
│   ├── hooks/                       # Custom hooks (8 files)
│   │   ├── useApi.ts
│   │   ├── useAuth.ts
│   │   ├── usePermissions.ts
│   │   └── useToast.ts
│   │
│   ├── services/                    # Services (6 files)
│   │   ├── api/
│   │   │   ├── client.ts            # Axios instance
│   │   │   ├── endpoints.ts         # API endpoint constants
│   │   │   └── interceptors.ts      # Request/response interceptors
│   │   ├── auth/
│   │   │   └── authService.ts       # Auth token management
│   │   └── storage/
│   │       └── storageService.ts    # LocalStorage wrapper
│   │
│   ├── types/                       # Global TypeScript types (5 files)
│   │   ├── api.ts
│   │   ├── entities.ts
│   │   ├── common.ts
│   │   └── index.ts
│   │
│   ├── utils/                       # Utility functions (6 files)
│   │   ├── date.ts
│   │   ├── string.ts
│   │   ├── validation.ts
│   │   └── permissions.ts
│   │
│   ├── styles/                      # Global styles (3 files)
│   │   ├── theme.ts                 # MUI theme configuration
│   │   ├── global.css               # Global CSS
│   │   └── variables.css            # CSS variables
│   │
│   └── config/                      # Configuration (2 files)
│       ├── constants.ts             # Application constants
│       └── env.ts                   # Environment variables
│
├── tests/                           # Test files (150+ files)
│   ├── unit/                        # Unit tests
│   ├── integration/                 # Integration tests
│   └── e2e/                         # E2E tests
│
├── docs/                            # Documentation (current document)
│   ├── architecture/
│   │   ├── README.md                # This file
│   │   └── decisions/               # ADRs
│   └── development/
│       └── setup.md
│
├── .env.example                     # Environment template
├── .env.development                 # Dev environment (gitignored)
├── .eslintrc.cjs                    # ESLint configuration
├── .prettierrc                      # Prettier configuration
├── .gitignore                       # Git ignore rules
├── package.json                     # NPM dependencies
├── package-lock.json                # NPM lock file
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite build configuration
├── vitest.config.ts                 # Vitest test configuration
├── playwright.config.ts             # Playwright E2E configuration
└── README.md                        # Frontend documentation
```

### Complete API Layer Structure

```
api/
├── lib/                             # API utilities (4 files)
│   ├── api_base.php                 # Abstract base class
│   ├── auth_jwt.php                 # JWT generation/validation
│   ├── api_response.php             # Response formatter
│   └── api_exception.php            # Exception handling
│
└── v1/                              # API Version 1 (127 endpoints)
    ├── auth/                        # Authentication (4 files)
    │   ├── login.php
    │   ├── logout.php
    │   ├── refresh.php
    │   └── me.php
    │
    ├── courses/                     # Course endpoints (7 files)
    │   ├── index.php                # GET /api/v1/courses
    │   ├── show.php                 # GET /api/v1/courses/{id}
    │   ├── create.php               # POST /api/v1/courses
    │   ├── update.php               # PUT /api/v1/courses/{id}
    │   ├── delete.php               # DELETE /api/v1/courses/{id}
    │   ├── enroll.php               # POST /api/v1/courses/{id}/enroll
    │   └── contents.php             # GET /api/v1/courses/{id}/contents
    │
    ├── users/                       # User endpoints (6 files)
    ├── assignments/                 # Assignment endpoints (6 files)
    ├── quizzes/                     # Quiz endpoints (8 files)
    ├── forums/                      # Forum endpoints (9 files)
    ├── gradebook/                   # Gradebook endpoints (7 files)
    ├── messages/                    # Messaging endpoints (7 files)
    ├── admin/                       # Admin endpoints (15 files)
    └── [12 more modules]            # Additional activity modules
```

---

## Architecture Decision Records

Detailed Architecture Decision Records (ADRs) are maintained in the `/decisions/` subdirectory:

1. **[ADR-001: JWT Authentication](/decisions/ADR-001-jwt-authentication.md)**
   - Why JWT over session-based auth
   - Token expiration strategy
   - Refresh token rotation

2. **[ADR-002: Redux Toolkit + React Query](/decisions/ADR-002-state-management.md)**
   - Separation of global vs server state
   - Why two state management libraries
   - Cache invalidation strategy

3. **[ADR-003: Material-UI v5](/decisions/ADR-003-ui-library.md)**
   - Component library selection rationale
   - Theming and customization approach
   - Accessibility compliance

4. **[ADR-004: Thin API Wrapper Pattern](/decisions/ADR-004-api-wrapper-pattern.md)**
   - Zero business logic duplication principle
   - Permission enforcement strategy
   - Error handling standards

5. **[ADR-005: Feature Flags for Gradual Rollout](/decisions/ADR-005-feature-flags.md)**
   - Coexistence of PHP and React interfaces
   - Rollback capability
   - User preference management

6. **[ADR-006: TypeScript Strict Mode](/decisions/ADR-006-typescript-strict.md)**
   - Type safety enforcement
   - Zero `any` types policy
   - Interface design patterns

7. **[ADR-007: Code Splitting Strategy](/decisions/ADR-007-code-splitting.md)**
   - Route-based splitting
   - Vendor chunk optimization
   - Bundle size targets

8. **[ADR-008: Testing Pyramid Approach](/decisions/ADR-008-testing-pyramid.md)**
   - Unit, integration, E2E test distribution
   - Coverage targets per component type
   - CI/CD integration

9. **[ADR-009: Database Immutability](/decisions/ADR-009-database-immutability.md)**
   - Zero schema changes policy
   - Existing data preservation
   - Migration avoidance rationale

10. **[ADR-010: Plugin Compatibility Strategy](/decisions/ADR-010-plugin-compatibility.md)**
    - React extension points
    - Iframe fallback for legacy plugins
    - Plugin migration guide

---

## Conclusion

### Summary of Architectural Transformation

This architecture represents a complete frontend modernization of Moodle while maintaining **100% backward compatibility** with all existing functionality:

**Key Achievements:**

1. **Zero Backend Risk**: All 17,875 PHP files remain unchanged, preserving battle-tested business logic
2. **Modern User Experience**: React 18 SPA with optimistic updates, client-side routing, and instant navigation
3. **Scalable Authentication**: Stateless JWT tokens enable horizontal scaling and mobile-friendly auth
4. **Performance Gains**: 80% bandwidth reduction, <3s page loads, 90+ Lighthouse scores
5. **Gradual Rollout**: Feature flags enable risk-free phased deployment with instant rollback
6. **Developer Experience**: TypeScript strict mode, component library, comprehensive testing

**Architectural Principles Maintained:**

- **Separation of Concerns**: Clear boundaries between presentation, state, API, and business logic layers
- **Single Responsibility**: Each component, hook, and endpoint has one clear purpose
- **Open/Closed Principle**: Extension points for plugins without modifying core
- **Dependency Inversion**: Interfaces define contracts, implementations are injected
- **Zero Duplication**: API endpoints wrap existing functions, never reimplementing logic

**Next Steps:**

1. Review Architecture Decision Records in `/decisions/` for detailed rationale
2. Set up development environment following `/development/setup.md`
3. Understand component patterns in Storybook documentation
4. Begin implementation following the transformation roadmap
5. Establish CI/CD pipeline with automated testing and Lighthouse checks

**Questions or Clarifications:**

For architecture questions or clarification on design decisions, please:
- Review the relevant ADR in `/decisions/`
- Consult the development team
- Refer to component documentation in Storybook

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-15  
**Maintainers**: Blitzy Platform Engineering Team  
**Review Cycle**: Quarterly or on major architectural changes
