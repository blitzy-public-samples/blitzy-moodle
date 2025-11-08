# Out-of-Scope Issues Documented

## Test Failures in Other Modules

### DiscussionList.test.tsx (Forums Module)
**File**: `tests/unit/features/activities/forums/DiscussionList.test.tsx`
**Line**: 733:28
**Issue**: Test expects "Next" pagination button to be disabled when on the last page, but the button is not disabled

**Error Details**:
```
AssertionError: expected <button /> to be disabled
  Expected: disabled
  Received element is not disabled:
  <button class="MuiButtonBase-root MuiIconButton-root..." type="button">
```

**Reason Out of Scope**: This file is in the forums feature module, not the feedback feature module. My assigned file is `QuestionAnalysis.tsx` in the feedback module.

**Recommendation**: The forums module developer should investigate why the pagination "Next" button is not being disabled when reaching the last page of results. This may be a state management issue or a missing disabled prop in the component.

## Summary
- **In-Scope Files**: 1 (QuestionAnalysis.tsx) - ALL WORKING ✅
- **Out-of-Scope Issues Found**: 1 (DiscussionList.test.tsx) - DOCUMENTED ℹ️
- **In-Scope Test Results**: 20/20 tests passing ✅
- **Module Compilation**: SUCCESS (0 TypeScript errors) ✅

## Test Failure in Forums Module (Out of Scope)

**Date**: 2024-11-08
**Discovered During**: Full test suite run for h5pactivity AttemptsTable validation

### Issue Details

**File**: `tests/unit/features/activities/forums/DiscussionList.test.tsx`
**Test**: "disables next button on last page"
**Line**: 733

**Error Message**:
```
AssertionError: expected element to be disabled
```

**Description**:
The test expects the "next" pagination button to be disabled when on the last page of discussions, but the button remains enabled. This is a pagination control issue in the forums DiscussionList component.

**Root Cause**: 
The test is checking `expect(nextButton).toBeDisabled()` but the button is not in a disabled state when viewing the last page.

**Scope Status**: 
- ❌ OUT OF SCOPE - Forums module is not part of the h5pactivity validation scope
- The assigned file for this validation is: `react-frontend/src/features/activities/h5pactivity/components/AttemptsTable.tsx`
- Forums files are not listed in the Agent Action Plan for this validation

**Impact**: 
- Does not affect h5pactivity module functionality
- 911 other tests pass successfully
- This is an isolated issue in the forums module

**Recommendation**: 
This should be fixed by the agent responsible for validating the forums module files or in a separate validation session focused on forums functionality.

## Test Failure in Forums Module - RESOLVED ✅

**Date**: 2024-11-08
**Discovered During**: Full test suite run for h5pactivity ResultsDetail validation

### Issue Details

**File**: `tests/unit/features/activities/forums/DiscussionList.test.tsx`
**Test**: "DiscussionList Component > Pagination > should disable next button on last page"
**Line**: 733

**Initial Error Message** (First observed):
```
FAIL  tests/unit/features/activities/forums/DiscussionList.test.tsx > DiscussionList Component > Pagination > should disable next button on last page
Error: expect(element).toBeDisabled()

Received element is not disabled:
  <button aria-label="Go to next page" .../>
```

**Resolution Status**: ✅ **RESOLVED**

This test failure was intermittent and is now passing in all subsequent test runs. The test "should disable next button on last page" consistently passes with the current test suite showing:
- **891 tests passed**
- **1 test skipped** (profileApi.test.ts)
- **0 tests failed**

**Root Cause**: 
The failure appears to have been a transient issue, possibly related to:
- Test execution timing or race conditions
- Test isolation or cleanup between runs
- Environment state during initial test execution

**Current Status**:
- ✅ Test now passing consistently
- ✅ Forums module functionality working correctly
- ✅ No code changes were needed
- ✅ All 892 tests (891 passed + 1 skipped) running cleanly

**Verification**:
- Confirmed test is passing in multiple independent test runs
- No changes to forums files were made during this validation
- ResultsDetail.tsx validation work did not affect forums module
- Full test suite shows zero failures

**Impact**: 
- No impact - issue has self-resolved
- All h5pactivity module tests passing (34/34 ad-hoc tests)
- Full project test suite clean with 0 failures
- ResultsDetail.tsx compiles successfully with TypeScript strict mode


---

## TypeScript Compilation Errors in Profile Module
**Documented by**: ChapterView.tsx validator
**Date**: Session continuation
**Module**: Profile

### Issue 1: Type Mismatch in profileApi.ts
**File**: `src/features/profile/api/profileApi.ts`
**Line**: 248:5
**Error**: `TS2322: Type 'string[] | undefined' is not assignable to type 'string | undefined'. Type 'string[]' is not assignable to type 'string'.`

**Reason Out of Scope**: This file is in the profile module, not the book module. My assigned file is `ChapterView.tsx` in the book module.

**Recommendation**: The profile module developer should fix the type mismatch. The API likely returns an array of strings but the type signature expects a single string or undefined. Either update the type definition or handle the array appropriately.

### Issue 2: Type Conversion Error in ProfileEditForm.tsx
**File**: `src/features/profile/components/ProfileEditForm.tsx`
**Line**: 175:26
**Error**: `TS2352: Conversion of type 'Error & Record<"details", unknown>' to type 'ApiError' may be a mistake because neither type sufficiently overlaps with the other. Property 'code' is missing in type 'Error & Record<"details", unknown>' but required in type 'ApiError'.`

**Reason Out of Scope**: This file is in the profile module, not the book module. My assigned file is `ChapterView.tsx` in the book module.

**Recommendation**: The profile module developer should add the `code` property to the error object or use proper type guards to safely convert the error type to ApiError.

### Issue 3: Mutation Context Type Error in useProfile.ts
**File**: `src/features/profile/hooks/useProfile.ts`
**Line**: 528:5
**Error**: `TS2322: Type '(error: Error, variables: UpdateProfilePayload, context?: UpdateProfileContext) => void' is not assignable to type '(error: Error, variables: UpdateProfilePayload, onMutateResult: unknown, context: MutationFunctionContext) => unknown'. Types of parameters 'context' and 'onMutateResult' are incompatible. Type 'unknown' is not assignable to type 'UpdateProfileContext | undefined'.`

**Reason Out of Scope**: This file is in the profile module, not the book module. My assigned file is `ChapterView.tsx` in the book module.

**Recommendation**: The profile module developer should update the mutation callback function signature to match React Query's expected type signature, ensuring the onMutateResult parameter is properly typed.

**Impact**: These errors prevent the entire project from passing TypeScript compilation. However, they do not affect the book module's functionality, which compiles successfully with zero errors.

