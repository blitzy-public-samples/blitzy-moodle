# ADR 0002: State Management Separation (Redux Toolkit + React Query)

## Status

**ACCEPTED**

## Context

React applications require managing two fundamentally different types of state:

1. **Client State**: Application state that exists only in the browser
   - User authentication status and tokens
   - UI state (sidebar open/closed, selected theme, active modal)
   - User preferences (language, notification settings)
   - Form state for multi-step wizards

2. **Server State**: Data fetched from API that is cached client-side
   - Course catalog and course details
   - Assignment submissions and grades
   - Forum discussions and messages
   - User profiles and enrollment data

These two state types have different characteristics, lifecycles, and access patterns. Mixing them in a single state management solution leads to complexity, cache invalidation issues, and difficulty reasoning about data freshness.

The Moodle refactoring involves extensive API interactions (127 endpoints) with complex data relationships. Server state needs sophisticated caching, background refetching, optimistic updates, and automatic cache invalidation - features that are cumbersome to implement in traditional Redux.

## Decision

We will use TWO separate state management solutions, each specialized for its purpose:

### 1. Redux Toolkit for Global Client State

Used for:
- Authentication state (user object, tokens, auth status)
- User preferences (theme, language, timezone, notification settings)
- UI state that spans multiple routes (global modals, toast notifications)
- Feature flags and configuration
- Application-wide settings

### 2. React Query (TanStack Query v5) for ALL Server State

Used for:
- All data fetched from API endpoints
- Courses, assignments, quizzes, grades, messages, users
- Automatic caching with configurable stale time
- Background refetching and cache invalidation
- Optimistic updates for mutations
- Loading and error states
- Pagination and infinite scroll support

### 3. Clear Boundaries

Decision framework for choosing the appropriate tool:
- **If data comes from API**: React Query
- **If data is client-only or auth-related**: Redux Toolkit
- **React Context**: For component-tree scoped state (e.g., wizard step state)
- **Local useState**: For component-specific UI state (dropdown open, input value)

## Consequences

### Positive

- **Separation of Concerns**: Each tool handles what it does best, reducing cognitive overhead
- **Automatic Cache Management**: React Query handles caching, invalidation, and refetching automatically without manual intervention
- **Optimistic Updates**: Built-in support for optimistic UI updates on mutations, improving perceived performance
- **Stale-While-Revalidate**: Show cached data immediately while fetching fresh data in background, ensuring fast UI response
- **Reduced Boilerplate**: React Query eliminates need for Redux actions/reducers for API data, reducing code volume by ~40%
- **Better Developer Experience**: Query keys make cache invalidation explicit and predictable
- **Automatic Loading States**: No manual loading/error state management for API calls
- **Request Deduplication**: Multiple components requesting same data only trigger one network request
- **Garbage Collection**: Unused cache data automatically cleaned up after 5 minutes (configurable)
- **Retry Logic**: Automatic retry with exponential backoff for failed requests
- **Polling and Refetch**: Easy to implement automatic refetching and real-time data updates

### Negative

- **Learning Curve**: Developers need to understand TWO state management paradigms instead of one
- **Decision Overhead**: Must decide which tool to use for each piece of state, requiring clear guidelines
- **Bundle Size**: Includes both Redux Toolkit (~15KB) and React Query (~12KB) gzipped, total ~27KB
- **Debugging Complexity**: Two separate DevTools (Redux DevTools + React Query DevTools) to monitor
- **Coordination Required**: Need to coordinate between Redux and React Query for auth-dependent queries

### Trade-offs

- **Bundle Size vs Features**: Slight increase in bundle size (27KB) is acceptable given the productivity gains and automatic features
- **Two Patterns vs Clarity**: Learning two sets of patterns is mitigated by clear documentation and examples in each feature module
- **Coordination Complexity**: Auth state coordination requires careful design but enables better security (centralized auth in Redux, query-level auth checks)

## Alternatives Considered

### Alternative 1: Redux Toolkit only (RTK Query)

**Description**: Use Redux Toolkit with RTK Query for API data management

**Why Rejected**:
- RTK Query is less mature than React Query with fewer community resources
- More boilerplate required for cache invalidation tags
- Cache invalidation tags less flexible than React Query's hierarchical query keys
- React Query has better optimistic updates and background refetching out of the box
- Steeper learning curve for developers unfamiliar with Redux patterns

### Alternative 2: React Query only

**Description**: Use React Query for ALL state (including client state)

**Why Rejected**:
- React Query is optimized for server state, not ideal for client state management
- Would require custom solutions for auth state persistence across page refreshes
- Global client state patterns (actions, reducers) clearer in Redux
- Difficult to implement complex synchronous state updates without server
- No built-in middleware ecosystem for logging, analytics, or side effects

### Alternative 3: Zustand for client state

**Description**: Use Zustand (lightweight state management) instead of Redux Toolkit

**Why Rejected**:
- Redux Toolkit provides better DevTools with time-travel debugging
- Redux has larger middleware ecosystem (saga, thunk, logger)
- Redux DevTools integration superior for production debugging
- Redux patterns more familiar to larger developer community
- Redux Toolkit's RTK listeners provide powerful side-effect handling
- Team has existing Redux expertise from other projects

### Alternative 4: Apollo Client (GraphQL)

**Description**: Use GraphQL with Apollo Client instead of REST + React Query

**Why Rejected**:
- Would require rewriting all 127 API endpoints as GraphQL resolvers
- Moodle's existing function-based architecture maps naturally to REST
- GraphQL adds complexity without clear benefit for this use case
- Team lacks GraphQL expertise, increasing project risk
- REST endpoints easier to version and maintain backward compatibility
- Apollo Client cache normalization adds complexity for our data model

## Implementation Guidelines

### Redux Toolkit Usage

**Store Structure**:
```typescript
// react-frontend/src/app/store.ts
{
  auth: {
    user: User | null,
    accessToken: string | null,
    refreshToken: string | null,
    isAuthenticated: boolean,
    permissions: string[]
  },
  preferences: {
    theme: 'light' | 'dark',
    language: string,
    timezone: string,
    notifications: NotificationSettings
  },
  ui: {
    sidebarOpen: boolean,
    activeModal: string | null,
    toasts: Toast[],
    breadcrumbs: Breadcrumb[]
  }
}
```

**Example Slice**:
```typescript
// react-frontend/src/features/auth/store/authSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    accessToken: null,
    isAuthenticated: false
  },
  reducers: {
    setCredentials: (state, action: PayloadAction<Credentials>) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
    }
  }
});
```

### React Query Usage

**Query Example**:
```typescript
// react-frontend/src/features/courses/hooks/useCourses.ts
const { data: courses, isLoading, error } = useQuery({
  queryKey: ['courses', { page, limit, category }],
  queryFn: () => fetchCourses(page, limit, category),
  staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
  cacheTime: 10 * 60 * 1000, // 10 minutes - keep in cache
  refetchOnWindowFocus: true,
  retry: 3
});
```

**Mutation Example**:
```typescript
// react-frontend/src/features/courses/hooks/useEnrollment.ts
const enrollMutation = useMutation({
  mutationFn: (courseId: number) => enrollInCourse(courseId),
  onMutate: async (courseId) => {
    // Optimistic update
    await queryClient.cancelQueries(['courses', courseId]);
    const previousCourse = queryClient.getQueryData(['courses', courseId]);
    queryClient.setQueryData(['courses', courseId], (old: Course) => ({
      ...old,
      isEnrolled: true
    }));
    return { previousCourse };
  },
  onSuccess: (_, courseId) => {
    // Invalidate related queries to refetch fresh data
    queryClient.invalidateQueries(['courses', courseId]);
    queryClient.invalidateQueries(['user', 'courses']);
    queryClient.invalidateQueries(['dashboard']);
  },
  onError: (err, courseId, context) => {
    // Rollback optimistic update on error
    queryClient.setQueryData(['courses', courseId], context?.previousCourse);
  }
});
```

### Cache Invalidation Strategy

**Hierarchical Query Keys**:
```typescript
// Specific course
['courses', 123]

// Filtered course list
['courses', { page: 1, category: 'math' }]

// All courses
['courses']

// Invalidate all courses queries (including filtered)
queryClient.invalidateQueries(['courses']);

// Invalidate only specific course
queryClient.invalidateQueries(['courses', 123]);
```

**Invalidation Timing**:
- **Immediate invalidation**: After mutations that change data (enrollment, submission)
- **Background refetch**: Set `staleTime` based on data volatility
  - Course catalog: 5 minutes (changes infrequently)
  - Messages: 30 seconds (changes frequently)
  - Dashboard: 2 minutes (balanced)
- **On window focus**: Refetch stale data when user returns to tab
- **Manual refetch**: Provide refresh button for user-initiated updates

**Optimistic Updates**:
Apply optimistic updates for mutations where immediate feedback improves UX:
- Enrollment in course (instant "Enrolled" badge)
- Marking message as read (instant visual update)
- Submitting forum post (instant post appears)
- Liking content (instant like count increment)

Do NOT use optimistic updates for:
- Assignment submission (requires server validation)
- Grade updates (must be authoritative)
- User deletion (critical operation)

### Stale Time Configuration

Configure `staleTime` based on data characteristics:

```typescript
// Static/rarely changing data - 10 minutes
queryKey: ['courses', 'categories'],
staleTime: 10 * 60 * 1000

// User-specific data - 5 minutes
queryKey: ['user', userId, 'profile'],
staleTime: 5 * 60 * 1000

// Dynamic data - 1 minute
queryKey: ['forums', forumId, 'discussions'],
staleTime: 60 * 1000

// Real-time data - 30 seconds
queryKey: ['messages', 'unread'],
staleTime: 30 * 1000
```

### Auth State Coordination

**Problem**: React Query needs access token from Redux for API calls

**Solution**: Use axios interceptor that reads from Redux store

```typescript
// react-frontend/src/services/api/interceptors.ts
import { store } from '@/app/store';

apiClient.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle 401 and refresh token
    if (error.response?.status === 401) {
      // Dispatch logout action to Redux
      store.dispatch(logout());
      // Invalidate all React Query cache
      queryClient.clear();
    }
    return Promise.reject(error);
  }
);
```

## Migration Path

For existing components that might use mixed state patterns:

1. **Phase 1**: Move all API calls to React Query
2. **Phase 2**: Move auth state to Redux
3. **Phase 3**: Move preferences to Redux
4. **Phase 4**: Convert component state to appropriate tool

## Testing Strategy

### Redux Testing

```typescript
// Test reducers
describe('authSlice', () => {
  it('should handle setCredentials', () => {
    const initialState = { user: null, isAuthenticated: false };
    const credentials = { user: mockUser, accessToken: 'token123' };
    const newState = authSlice.reducer(initialState, setCredentials(credentials));
    expect(newState.isAuthenticated).toBe(true);
  });
});
```

### React Query Testing

```typescript
// Test with MSW (Mock Service Worker)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

test('useCourses returns course data', async () => {
  const { result } = renderHook(() => useCourses(), { wrapper });
  
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  
  expect(result.current.data).toHaveLength(10);
});
```

## Performance Considerations

### Bundle Size Impact

- Redux Toolkit: ~15KB gzipped
- React Query: ~12KB gzipped
- **Total**: ~27KB gzipped (~0.027MB)
- **Compared to**: Implementing equivalent functionality manually would add ~50KB+ of custom code

### Runtime Performance

- Redux: O(1) state access, minimal re-renders with selector memoization
- React Query: Efficient cache lookups, automatic request deduplication
- Combined: No measurable performance impact (<1ms for state operations)

### Memory Usage

- Redux: Single state tree, ~100KB for typical session
- React Query: Automatic garbage collection, ~500KB cache limit (configurable)
- **Total**: Well within acceptable limits for modern browsers

## Security Considerations

1. **Token Storage**: Access tokens in Redux state (memory only), refresh tokens in httpOnly cookies
2. **Query Keys**: Never include sensitive data in query keys (they're visible in DevTools)
3. **Cache Clearing**: Clear React Query cache on logout via `queryClient.clear()`
4. **Error Messages**: Filter sensitive data from React Query error responses before displaying

## Monitoring and Debugging

### Development Tools

- **Redux DevTools**: Install browser extension for Redux state inspection
- **React Query DevTools**: Built-in component shows query status, cache, and mutations
- **Combined View**: Open both DevTools side-by-side for complete state picture

### Production Monitoring

- Log Redux actions to analytics (excluding sensitive data)
- Track React Query error rates per endpoint
- Monitor cache hit ratios
- Alert on authentication failures

## References

- **Agent Action Plan Section 0.1**: State Management Rules
- **Agent Action Plan Section 0.7**: React Component Requirements  
- **Redux Toolkit Documentation**: https://redux-toolkit.js.org/
- **React Query Documentation**: https://tanstack.com/query/latest
- **Implementation Files**:
  - `react-frontend/src/app/store.ts`
  - `react-frontend/src/features/*/store/*Slice.ts`
  - `react-frontend/src/features/*/api/*Api.ts`
  - `react-frontend/src/services/api/client.ts`
  - `react-frontend/src/services/api/interceptors.ts`

## Related ADRs

- [ADR 0001: React 18 + TypeScript Frontend Architecture](./0001-react-typescript-architecture.md)
- [ADR 0003: API Client Design with Axios](./0003-api-client-design.md) *(to be created)*
- [ADR 0004: Authentication Flow with JWT](./0004-authentication-jwt.md) *(to be created)*

## Decision Date

January 2024

## Decision Makers

- Architecture Team
- Frontend Tech Lead
- Backend Tech Lead

## Review Date

July 2024 (6 months after implementation)
