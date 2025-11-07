# ADR 0008: React 18 Concurrent Rendering Patterns

## Status
ACCEPTED

## Context
React 18 introduces concurrent rendering capabilities that fundamentally change how React handles updates. Key features:

**Concurrent Rendering Benefits**:
- **Automatic Batching**: Multiple state updates batched into single re-render (even in async)
- **Suspense for Data Fetching**: Declarative loading states with component-level boundaries
- **Transitions**: Mark non-urgent updates to keep UI responsive
- **Streaming SSR**: (Not applicable for SPA, but future consideration)

**Moodle Performance Requirements**:
- Subsequent navigation: <500ms
- Time to Interactive (TTI): <5 seconds
- Lighthouse performance score: >90
- Support 1000+ concurrent users per server

**Challenges Without Concurrent Features**:
- Heavy computations block UI thread (e.g., rendering large gradebook)
- Multiple API calls trigger multiple renders
- Loading states difficult to coordinate across component tree
- Slow transitions feel janky to users

The refactoring creates complex interfaces (gradebook with 100+ students, quiz with 50+ questions, forum with nested discussions) that benefit significantly from concurrent rendering.

## Decision
We will **fully adopt React 18 concurrent features** as core patterns:

1. **Automatic Batching (Always On)**:
   React 18 automatically batches state updates everywhere:
   ```typescript
   // All updates batched into single render
   function handleSubmit() {
     setLoading(true);
     setError(null);
     setData(newData);
     // Single render, not three
   }
   
   // Even in async callbacks
   async function fetchData() {
     const data = await api.get('/courses');
     setData(data);      // Batched
     setLoading(false);  // Together
   }
   ```

2. **Suspense for Data Fetching**:
   ```typescript
   // Feature-level Suspense boundary
   <Suspense fallback={<CourseListSkeleton />}>
     <CourseList />  {/* Can suspend while fetching */}
   </Suspense>
   
   // React Query integration
   function CourseList() {
     const { data: courses } = useQuery({
       queryKey: ['courses'],
       queryFn: fetchCourses,
       suspense: true  // Enable Suspense mode
     });
     
     // No loading state needed - Suspense handles it
     return courses.map(course => <CourseCard key={course.id} course={course} />);
   }
   ```

3. **useTransition for Non-Urgent Updates**:
   ```typescript
   function SearchResults() {
     const [query, setQuery] = useState('');
     const [results, setResults] = useState([]);
     const [isPending, startTransition] = useTransition();
     
     function handleSearch(newQuery: string) {
       setQuery(newQuery);  // Urgent: update input immediately
       
       startTransition(() => {
         // Non-urgent: search can be delayed if user still typing
         setResults(filterCourses(newQuery));
       });
     }
     
     return (
       <>
         <input value={query} onChange={e => handleSearch(e.target.value)} />
         {isPending && <Spinner />}
         <ResultsList results={results} />
       </>
     );
   }
   ```

4. **useDeferredValue for Expensive Computations**:
   ```typescript
   function Gradebook({ courseId }) {
     const [filter, setFilter] = useState('');
     const deferredFilter = useDeferredValue(filter);
     
     // grades uses deferred value, so re-computation delayed
     const grades = useMemo(() => 
       expensiveGradeCalculation(deferredFilter),
       [deferredFilter]
     );
     
     return (
       <>
         <input value={filter} onChange={e => setFilter(e.target.value)} />
         {/* Input stays responsive while grades recalculate */}
         <GradeTable grades={grades} />
       </>
     );
   }
   ```

5. **Lazy Loading with Suspense**:
   ```typescript
   // Code-split route components
   const Dashboard = lazy(() => import('./features/dashboard/pages/DashboardPage'));
   const CourseDetail = lazy(() => import('./features/courses/pages/CourseDetailPage'));
   
   // Router with Suspense
   <Suspense fallback={<PageLoadingSpinner />}>
     <Routes>
       <Route path="/dashboard" element={<Dashboard />} />
       <Route path="/courses/:id" element={<CourseDetail />} />
     </Routes>
   </Suspense>
   ```

6. **Error Boundaries with Suspense**:
   ```typescript
   <ErrorBoundary fallback={<ErrorDisplay />}>
     <Suspense fallback={<Loading />}>
       <FeatureComponent />
     </Suspense>
   </ErrorBoundary>
   ```

7. **Concurrent Rendering Best Practices**:
   - Use React.memo for expensive components
   - Avoid blocking the main thread (use Web Workers for heavy computation)
   - Virtualize long lists (react-window)
   - Optimize images (lazy loading, WebP format)
   - Code split by route and feature module

## Consequences

**Positive**:
- **Improved Responsiveness**: UI stays responsive during heavy updates
- **Better User Experience**: Smooth transitions, no janky scrolling
- **Automatic Optimization**: Batching happens automatically
- **Simpler Loading States**: Suspense handles loading UI declaratively
- **Performance Gains**: Concurrent rendering prioritizes user interactions
- **Future-Proof**: Foundation for future React features (Server Components, etc.)

**Negative**:
- **Learning Curve**: Developers must understand concurrent patterns
- **Testing Complexity**: Suspense and transitions need specific testing strategies
- **Debugging**: Concurrent updates harder to debug than synchronous
- **React Query Integration**: Need to enable suspense mode explicitly

**Trade-offs**:
- Complexity of concurrent patterns vs UX benefits (clear benefit)
- Slightly harder debugging vs better performance (acceptable)

## Alternatives Considered

**Alternative 1: Stick with React 17 Patterns**
- Use React 18 but avoid concurrent features
- REJECTED: Leaves performance benefits on the table
- Manual optimizations more difficult to implement correctly
- Future React features will assume concurrent mode

**Alternative 2: Manual Batching with Schedulers**
- Implement own batching and scheduling logic
- REJECTED: Reinventing what React 18 provides built-in
- Error-prone and difficult to maintain
- React 18 batching is highly optimized

**Alternative 3: Third-Party Concurrency Libraries**
- Use libraries like React Concurrent Mode (pre-React 18)
- REJECTED: React 18 makes these obsolete
- Native implementation is better integrated

**Alternative 4: Defer React 18 Upgrade**
- Start with React 17, upgrade later
- REJECTED: Migration effort wasted, building on old foundation
- Greenfield project should use latest stable version

## Implementation Patterns

**Suspense Boundary Strategy**:
```typescript
// App-level boundary for route loading
<Suspense fallback={<AppShellSkeleton />}>
  <Router />
</Suspense>

// Feature-level boundaries for data fetching
function CoursePage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<CourseDetailSkeleton />}>
        <CourseDetail />
      </Suspense>
      <Suspense fallback={<ActivityListSkeleton />}>
        <ActivityList />
      </Suspense>
    </ErrorBoundary>
  );
}
```

**Transition Patterns**:
```typescript
// Search with transition
function SearchBox() {
  const [isPending, startTransition] = useTransition();
  const navigate = useNavigate();
  
  function handleSearch(query: string) {
    startTransition(() => {
      navigate(`/search?q=${query}`);
    });
  }
  
  return (
    <>
      <input onChange={e => handleSearch(e.target.value)} />
      {isPending && <LoadingIndicator />}
    </>
  );
}

// Tab switching with transition
function TabPanel() {
  const [tab, setTab] = useState('overview');
  const [isPending, startTransition] = useTransition();
  
  function switchTab(newTab: string) {
    startTransition(() => {
      setTab(newTab);  // Heavy re-render deferred
    });
  }
  
  return <Tabs value={tab} onChange={switchTab} />;
}
```

**Deferred Value Patterns**:
```typescript
// Filter large lists
function StudentList({ students }) {
  const [filter, setFilter] = useState('');
  const deferredFilter = useDeferredValue(filter);
  
  const filtered = useMemo(() => 
    students.filter(s => s.name.includes(deferredFilter)),
    [students, deferredFilter]
  );
  
  return (
    <>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      <VirtualList items={filtered} />
    </>
  );
}
```

**React Query Suspense Integration**:
```typescript
// Configure React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      suspense: false,  // Opt-in per query
      useErrorBoundary: true
    }
  }
});

// Enable Suspense for specific query
function CourseDetail({ id }) {
  const { data: course } = useQuery({
    queryKey: ['courses', id],
    queryFn: () => fetchCourse(id),
    suspense: true  // This query suspends
  });
  
  return <CourseInfo course={course} />;
}
```

## Performance Monitoring

**Metrics to Track**:
- Time to Interactive (TTI): <5 seconds
- First Contentful Paint (FCP): <1.5 seconds
- Largest Contentful Paint (LCP): <2.5 seconds
- Cumulative Layout Shift (CLS): <0.1
- First Input Delay (FID): <100ms
- Navigation timing: <500ms

**React DevTools Profiler**:
- Measure component render times
- Identify performance bottlenecks
- Verify concurrent rendering working correctly

**Lighthouse Audits**:
- Performance score >90
- Accessibility score >95
- Best Practices score >90

## Migration Notes

- Enable React.StrictMode in development for concurrent mode checks
- Test all features with Suspense boundaries
- Profile performance before and after concurrent features
- Monitor for waterfall requests (use parallel fetching)

## Common Pitfalls

**Pitfall 1: Over-using Suspense**
- Don't Suspense for trivial loading states
- Causes unnecessary component unmounting

**Pitfall 2: Waterfall Requests**
- Suspending components can create request waterfalls
- Solution: Preload data at route level, or parallel fetching

**Pitfall 3: Ignoring isPending State**
- Transitions appear instant without isPending feedback
- Always show loading indicator when isPending=true

**Pitfall 4: Blocking Transitions**
- Synchronous heavy computation blocks transitions
- Solution: Use Web Workers or defer computation

## References
- Agent Action Plan Section 0.1: React 18 Concurrent Features
- Agent Action Plan Section 0.7: Performance Requirements
- React 18 Docs: https://react.dev/blog/2022/03/29/react-v18
- Concurrent Rendering: https://react.dev/learn/render-and-commit#concurrent-rendering
- Implementation: All React components in `react-frontend/src/`
