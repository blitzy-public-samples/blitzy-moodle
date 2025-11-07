# Out-of-Scope Issues Documentation

## Summary
During validation of assigned files in the React frontend, the full test suite revealed failures in modules outside the scope of validation tasks, including API test failures, TypeScript compilation errors, and a flaky test. This document consolidates findings from multiple validation sessions:
- Initial validation: `react-frontend/tests/unit/features/profile/ProfileView.test.tsx`
- Current validation: `react-frontend/src/features/activities/choice/hooks/useChoiceResults.ts`

## Out-of-Scope Test Failures

### 1. Feedback Module
**File:** `tests/unit/features/activities/feedback/api/feedbackApi.test.ts`

**Failed Tests:** 40 test failures including:
- getFeedback() > should successfully fetch feedback details with correct endpoint URL
- getFeedback() > should include JWT authorization header in request
- getFeedback() > should parse response into correct Feedback TypeScript interface
- getFeedback() > should handle 403 Forbidden error for insufficient permissions
- getFeedback() > should handle network error scenarios
- getFeedbackQuestions() > should successfully fetch feedback questions/items
- getFeedbackQuestions() > should parse different question types correctly
- getFeedbackQuestions() > should handle empty feedback (no questions)
- getFeedbackQuestions() > should handle permission error for questions retrieval
- submitFeedbackResponse() / completeFeedback() > should successfully submit feedback response
- submitFeedbackResponse() / completeFeedback() > should include response data in request body
- submitFeedbackResponse() / completeFeedback() > should support optimistic updates pattern
- getFeedbackStatus() > should successfully fetch feedback completion status
- getFeedbackStatus() > should indicate completion state (completed/incomplete)
- getFeedbackStatus() > should include response metadata (submission timestamp, attempt number)
- getFeedbackStatus() > should support multiple completion status
- getFeedbackStatus() > should handle anonymous feedback status
- canCompleteFeedback() > should return true when user can complete feedback
- canCompleteFeedback() > should return false with reason when user cannot complete
- canCompleteFeedback() > should handle already submitted scenario
- getFeedbackResponses() > should successfully fetch user feedback responses
- getFeedbackResponses() > should return responses for current user only
- getFeedbackResponses() > should include completed and in-progress submissions
- getFeedbackResponses() > should handle empty response history
- saveProgress() > should successfully save in-progress feedback responses
- saveProgress() > should allow resuming from saved page
- getFeedbackAnalysis() > should successfully fetch analysis data
- getFeedbackAnalysis() > should include statistics and charts data in response
- getFeedbackAnalysis() > should support filtering by course parameter
- getFeedbackAnalysis() > should support filtering by group parameter
- getFeedbackAnalysis() > should handle empty analysis (no responses yet)
- getFeedbackAnalysis() > should validate TypeScript types for analysis data structure
- React Query Integration > should support mutation success callbacks
- React Query Integration > should verify refetch behavior expectations
- Error Handling > should parse standard error envelope
- Error Handling > should map error codes correctly
- Error Handling > should handle timeout scenarios
- TypeScript Type Safety > should validate union types for different response states
- TypeScript Type Safety > should handle optional fields correctly

**Error Pattern:**
```
Error: Answers object is required
Code: VALIDATION_ERROR
Status: 400
```

**Root Cause:**
Test mock setup issue where API calls are not receiving properly formatted data in the test environment. Likely missing or incorrect MSW request handlers.

**Impact:** 40 test failures
**Status:** DOCUMENTED ONLY (out of scope - not assigned in Agent Action Plan)

---

### 2. Forums Module (forumApi.test.ts)
**File:** `tests/unit/features/activities/forums/forumApi.test.ts`

**Failed Tests:** 37 test failures including:
- getForum > should include JWT token in Authorization header
- getDiscussions > should fetch discussion list with default options
- getDiscussions > should support pagination with page and perPage parameters
- getDiscussions > should filter discussions by "all"
- getDiscussions > should filter discussions by "unread"
- getDiscussions > should filter discussions by "pinned"
- getDiscussions > should handle empty discussion list
- getDiscussionPosts > should fetch complete discussion thread
- getDiscussionPosts > should return posts array with nested structure
- getDiscussionPosts > should handle discussion with no replies
- getDiscussionPosts > should handle discussion with deeply nested replies
- getDiscussionPosts > should include unread post indicators
- createDiscussion > should create discussion successfully
- createDiscussion > should include all required fields in request body
- createDiscussion > should return created discussion in response
- createDiscussion > should handle file attachment upload with FormData
- createPost > should create reply successfully
- createPost > should include message and parentId in request body
- updatePost > should update post successfully
- updatePost > should include message in request body
- updatePost > should return updated post with edit metadata
- deletePost > should return 204 No Content response
- markDiscussionRead > should mark discussion and all posts as read
- markDiscussionRead > should update unread count in response
- subscribeForum > should include subscription preferences in request body
- pinDiscussion > should pin discussion as moderator
- unpinDiscussion > should unpin discussion
- lockDiscussion > should lock discussion to prevent replies
- unlockDiscussion > should unlock discussion
- reportPost > should report inappropriate post
- reportPost > should include reason in request body
- Error Handling > should handle network timeout error
- Error Handling > should handle 401 Unauthorized (expired/invalid JWT)
- Error Handling > should handle 429 Too Many Requests (rate limiting)
- Error Handling > should handle 500 Internal Server Error
- TypeScript Type Safety > should enforce Post type for createPost response
- Request Configuration > should include CORS headers in requests
- File Upload > should track file upload progress
- File Upload > should handle multiple concurrent file uploads

**Root Cause:**
Missing or incorrect MSW mock handlers for forum API endpoints causing requests to fail with validation errors.

**Impact:** 37 test failures
**Status:** DOCUMENTED ONLY (out of scope - not assigned in Agent Action Plan)

---

### 3. Forums Module (useForum.test.tsx)
**File:** `tests/unit/features/activities/forums/useForum.test.tsx`

**Failed Tests:** 14 test failures including:
- Discussion list fetching > should fetch discussions with pagination
- Discussion list fetching > should filter unread discussions
- Discussion list fetching > should filter pinned discussions
- Discussion list fetching > should support sorting by replies
- Discussion list fetching > should support next page prefetching
- Forum mutations > should create new discussion
- Forum mutations > should pin discussion (moderator only)
- Forum mutations > should lock discussion (moderator only)
- Forum mutations > should mark all discussions as read
- Cache management > should refetch on window focus
- Cache management > should persist cache and support hydration
- Forum statistics > should provide forum statistics
- Forum statistics > should track unread discussion count
- Query options > should execute onSuccess callback

**Unhandled Error:**
```
Error: Discussion name and message are required
Code: VALIDATION_ERROR
Status: 400
Details: { missing_fields: ['name'] }
```

**Root Cause:**
Test cleanup issue where `createDiscussion` API call is being invoked without required fields, causing unhandled promise rejection that propagates across tests. The test "should pin discussion (moderator only)" triggers this error.

**Impact:** 14 test failures + 1 unhandled error affecting test suite stability
**Status:** DOCUMENTED ONLY (out of scope - not assigned in Agent Action Plan)

---

### 4. Forums Module (PostCard.test.tsx)
**File:** `tests/unit/features/activities/forums/PostCard.test.tsx`

**Failed Tests:** 1 test file failure (specific test count not individually listed)

**Root Cause:**
Test file likely affected by the same unhandled error from useForum.test.tsx causing test environment instability.

**Impact:** Test file failed
**Status:** DOCUMENTED ONLY (out of scope - not assigned in Agent Action Plan)

---

### 5. Forums Module (DiscussionList.test.tsx) - Flaky Test
**File:** `tests/unit/features/activities/forums/DiscussionList.test.tsx`

**Failed Test:** 
- "DiscussionList Component > Pagination > should disable next button on last page"

**Error:**
```
AssertionError: expected element to be disabled
```

**Flaky Test Behavior:**
- **Fails:** When run as part of the full test suite (`npm test -- --run`)
- **Passes:** When run in isolation (`npm test -- --run tests/unit/features/activities/forums/DiscussionList.test.tsx`)
- **Pre-existing:** Failure occurs even without any modifications to the forums module

**Investigation Details:**
1. Initially discovered during validation of `useChoiceResults.ts` after fixing a linting warning
2. Suspected regression was ruled out by:
   - Confirming only change was type-only import modification in choice module
   - Stashing changes and re-running tests showed same failure
   - Running DiscussionList.test.tsx in isolation resulted in all 83 tests passing
3. Conclusion: This is a pre-existing flaky test caused by test suite interactions or timing issues

**Root Cause:**
Likely test timing issue or improper cleanup/setup between tests in the full suite. The "next button disabled" assertion may depend on asynchronous state that isn't properly awaited when tests run in parallel or after other forum tests.

**Impact:** 1 intermittent test failure affecting full suite reliability
**Status:** DOCUMENTED ONLY (out of scope - DiscussionList component not assigned in Agent Action Plan)

**Recommendation:** Investigate test isolation and async state handling in DiscussionList.test.tsx pagination tests. Consider adding proper waitFor() assertions or improving test cleanup to prevent state leakage between tests.

---

## Out-of-Scope TypeScript Compilation Errors

### ProfilePage.tsx
**File:** `react-frontend/src/features/profile/pages/ProfilePage.tsx`

**Error:**
```
src/features/profile/pages/ProfilePage.tsx:29:35 - error TS2339: Property 'id' does not exist on type '{}'.
```

**Root Cause:**
The `params` object from `useParams()` is typed as `{}` instead of the expected type containing `id: string`. This is likely due to missing route type definitions.

**Impact:** TypeScript compilation error (does not prevent tests from running)
**Status:** DOCUMENTED ONLY (out of scope - ProfilePage.tsx is not listed in depends_on_files for ProfileView.test.tsx)

---

## Full Test Suite Statistics
- **Test Files:** 5 failed (out of scope) | 12 passed (including in-scope)
- **Tests:** 93 failed (out of scope) | 695 passed | 1 skipped
- **Unhandled Errors:** 1 error (in out-of-scope forum tests)
- **Flaky Tests:** 1 test (DiscussionList pagination test)
- **Total:** 789 tests

## In-Scope Status (Choice Activity - useChoiceResults Hook)
✅ **All in-scope tests passing:**
- `useChoiceResults.test.ts`: All tests passing ✅
- `choiceApi.test.ts`: All tests passing ✅

**Component Under Test:**
- `useChoiceResults.ts`: All TypeScript compilation errors fixed ✅
- `choiceApi.ts`: All TypeScript type definitions correct ✅

**Test Coverage:**
- Rendering with valid user data
- Profile fields display (name, email, department, city, country, custom fields)
- Avatar display with default fallback
- Edit button visibility based on permissions
- Loading skeleton during data fetch
- Error handling for missing/deleted users
- useProfile hook integration with React Query cache
- Accessibility validation (semantic HTML, keyboard navigation, ARIA labels, WCAG 2.1 AA color contrast)
- Responsive layouts (mobile, tablet, desktop)

## Recommendations for Future Work
1. **Feedback Module:** Fix MSW request handlers to properly format test data for all feedback API endpoints
2. **Forums Module:** 
   - Fix MSW request handlers for forum API endpoints
   - Investigate test cleanup to prevent unhandled rejections in useForum.test.tsx
   - Ensure proper error handling in async operations
   - **Fix flaky DiscussionList pagination test:** Add proper `waitFor()` assertions or improve test isolation to prevent intermittent failures when run in full suite
3. **ProfilePage.tsx:** Add proper route type definitions for useParams() to resolve TypeScript error
4. **Test Isolation:** Consider adding better test isolation to prevent error propagation across test files and to address flaky test behavior
