/**
 * Custom Vitest Matchers for Moodle React Frontend Testing
 * 
 * This module extends Vitest's expect API with Moodle-specific and React-specific
 * custom matchers to make tests more readable and maintainable.
 * 
 * Usage:
 * Import in tests/setup.ts to make matchers globally available:
 * ```typescript
 * import './helpers/customMatchers';
 * ```
 * 
 * Then use in tests:
 * ```typescript
 * expect(user).toBeEnrolled(courseId);
 * expect(component).toHaveLoadingState();
 * ```
 */

import { expect } from 'vitest';
import { run as axeRun, type Result as AxeResults } from 'axe-core';

/**
 * Helper function to create consistent matcher messages
 */
function formatMatcherMessage(
  pass: boolean,
  matcherName: string,
  received: unknown,
  expected: unknown,
  positiveMessage: string,
  negativeMessage: string
): string {
  const prefix = pass ? 'Expected NOT' : 'Expected';
  const message = pass ? negativeMessage : positiveMessage;
  return `${prefix}: ${message}\n\nReceived: ${JSON.stringify(received, null, 2)}\nExpected: ${JSON.stringify(expected, null, 2)}`;
}

/**
 * Type definitions for custom matchers
 */
interface CustomMatchers<R = unknown> {
  // Enrollment Matchers
  toBeEnrolled(courseid: number): R;
  toBeUnenrolled(courseid: number): R;
  toHaveEnrollmentMethod(method: string): R;

  // Permission Matchers
  toHaveCapability(capability: string, context?: string): R;
  toLackCapability(capability: string): R;
  toBeRole(role: 'student' | 'teacher' | 'admin' | 'guest'): R;

  // Grade Matchers
  toHaveGrade(expected: number | { min: number; max: number }): R;
  toBePassingGrade(passingGrade: number): R;
  toBeFailingGrade(passingGrade: number): R;
  toHaveGradePercentage(percentage: number): R;

  // Activity Completion Matchers
  toBeCompleted(): R;
  toBeInProgress(): R;
  toBeNotStarted(): R;
  toHaveCompletionPercentage(percentage: number): R;

  // Assignment Matchers
  toHaveSubmission(): R;
  toBeGraded(): R;
  toHaveFeedback(): R;
  toBeOverdue(): R;

  // Quiz Matchers
  toHaveAttempts(count: number): R;
  toBeQuizOpen(): R;
  toBeQuizClosed(): R;
  toHaveTimeRemaining(seconds: number): R;

  // React Component Matchers
  toHaveLoadingState(): R;
  toHaveErrorState(message?: string): R;
  toHaveEmptyState(): R;
  toBeAccessible(): Promise<R>;

  // Data Structure Matchers
  toMatchMoodleTimestamp(expected: number, toleranceMs?: number): R;
  toBeValidMoodleId(): R;
  toHaveMoodleStructure(shape: object): R;

  // API Response Matchers
  toBeSuccessResponse(): R;
  toBeErrorResponse(code?: string): R;
  toHavePagination(): R;

  // Date/Time Matchers
  toBeWithinDays(days: number): R;
  toBeInFuture(): R;
  toBeInPast(): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

/**
 * Register all custom matchers with Vitest
 */
expect.extend({
  // ========================
  // ENROLLMENT MATCHERS
  // ========================

  /**
   * Assert that a user is enrolled in a specific course
   * 
   * @example
   * expect(user).toBeEnrolled(5); // User should be enrolled in course 5
   * expect(user).not.toBeEnrolled(10); // User should not be enrolled in course 10
   */
  toBeEnrolled(received: any, courseid: number) {
    const enrollments = received?.enrollments || received?.courses || [];
    const isEnrolled = Array.isArray(enrollments) && 
      enrollments.some((enrollment: any) => 
        enrollment.courseid === courseid || enrollment.id === courseid
      );

    return {
      pass: isEnrolled,
      message: () =>
        formatMatcherMessage(
          isEnrolled,
          'toBeEnrolled',
          received,
          courseid,
          `user to be enrolled in course ${courseid}`,
          `user to NOT be enrolled in course ${courseid}`
        ),
    };
  },

  /**
   * Assert that a user is NOT enrolled in a specific course
   * 
   * @example
   * expect(user).toBeUnenrolled(5);
   */
  toBeUnenrolled(received: any, courseid: number) {
    const enrollments = received?.enrollments || received?.courses || [];
    const isEnrolled = Array.isArray(enrollments) && 
      enrollments.some((enrollment: any) => 
        enrollment.courseid === courseid || enrollment.id === courseid
      );

    return {
      pass: !isEnrolled,
      message: () =>
        formatMatcherMessage(
          !isEnrolled,
          'toBeUnenrolled',
          received,
          courseid,
          `user to be unenrolled from course ${courseid}`,
          `user to be enrolled in course ${courseid}`
        ),
    };
  },

  /**
   * Assert that an enrollment has a specific method type
   * 
   * @example
   * expect(enrollment).toHaveEnrollmentMethod('manual');
   * expect(enrollment).toHaveEnrollmentMethod('self');
   */
  toHaveEnrollmentMethod(received: any, method: string) {
    const hasMethod = received?.enrolmethod === method || received?.method === method;

    return {
      pass: hasMethod,
      message: () =>
        formatMatcherMessage(
          hasMethod,
          'toHaveEnrollmentMethod',
          received?.enrolmethod || received?.method,
          method,
          `enrollment to have method "${method}"`,
          `enrollment to NOT have method "${method}"`
        ),
    };
  },

  // ========================
  // PERMISSION MATCHERS
  // ========================

  /**
   * Assert that a user has a specific capability
   * 
   * @example
   * expect(user).toHaveCapability('moodle/course:view');
   * expect(user).toHaveCapability('mod/assign:grade', 'course');
   */
  toHaveCapability(received: any, capability: string, context?: string) {
    const capabilities = received?.capabilities || received?.permissions || [];
    const hasCapability = Array.isArray(capabilities) &&
      capabilities.some((cap: any) => {
        const capMatch = cap.name === capability || cap.capability === capability || cap === capability;
        const contextMatch = !context || cap.context === context;
        return capMatch && contextMatch;
      });

    return {
      pass: hasCapability,
      message: () =>
        formatMatcherMessage(
          hasCapability,
          'toHaveCapability',
          capabilities,
          capability,
          `user to have capability "${capability}"${context ? ` in context "${context}"` : ''}`,
          `user to NOT have capability "${capability}"${context ? ` in context "${context}"` : ''}`
        ),
    };
  },

  /**
   * Assert that a user lacks a specific capability
   * 
   * @example
   * expect(user).toLackCapability('moodle/course:delete');
   */
  toLackCapability(received: any, capability: string) {
    const capabilities = received?.capabilities || received?.permissions || [];
    const hasCapability = Array.isArray(capabilities) &&
      capabilities.some((cap: any) => 
        cap.name === capability || cap.capability === capability || cap === capability
      );

    return {
      pass: !hasCapability,
      message: () =>
        formatMatcherMessage(
          !hasCapability,
          'toLackCapability',
          capabilities,
          capability,
          `user to lack capability "${capability}"`,
          `user to have capability "${capability}"`
        ),
    };
  },

  /**
   * Assert that a user has a specific role
   * 
   * @example
   * expect(user).toBeRole('student');
   * expect(user).toBeRole('teacher');
   */
  toBeRole(received: any, role: 'student' | 'teacher' | 'admin' | 'guest') {
    const userRole = received?.role || received?.rolename || received?.roles?.[0];
    const hasRole = userRole === role || 
      (Array.isArray(received?.roles) && received.roles.includes(role));

    return {
      pass: hasRole,
      message: () =>
        formatMatcherMessage(
          hasRole,
          'toBeRole',
          userRole,
          role,
          `user to have role "${role}"`,
          `user to NOT have role "${role}"`
        ),
    };
  },

  // ========================
  // GRADE MATCHERS
  // ========================

  /**
   * Assert that a grade matches an expected value or range
   * 
   * @example
   * expect(grade).toHaveGrade(85);
   * expect(grade).toHaveGrade({ min: 80, max: 90 });
   */
  toHaveGrade(received: any, expected: number | { min: number; max: number }) {
    const gradeValue = received?.grade ?? received?.finalgrade ?? received;
    
    let pass: boolean;
    if (typeof expected === 'number') {
      pass = gradeValue === expected;
    } else {
      pass = gradeValue >= expected.min && gradeValue <= expected.max;
    }

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toHaveGrade',
          gradeValue,
          expected,
          typeof expected === 'number' 
            ? `grade to be ${expected}`
            : `grade to be between ${expected.min} and ${expected.max}`,
          typeof expected === 'number'
            ? `grade to NOT be ${expected}`
            : `grade to NOT be between ${expected.min} and ${expected.max}`
        ),
    };
  },

  /**
   * Assert that a grade is passing
   * 
   * @example
   * expect(grade).toBePassingGrade(60);
   */
  toBePassingGrade(received: any, passingGrade: number) {
    const gradeValue = received?.grade ?? received?.finalgrade ?? received;
    const pass = gradeValue >= passingGrade;

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toBePassingGrade',
          gradeValue,
          passingGrade,
          `grade ${gradeValue} to be passing (>= ${passingGrade})`,
          `grade ${gradeValue} to NOT be passing (< ${passingGrade})`
        ),
    };
  },

  /**
   * Assert that a grade is failing
   * 
   * @example
   * expect(grade).toBeFailingGrade(60);
   */
  toBeFailingGrade(received: any, passingGrade: number) {
    const gradeValue = received?.grade ?? received?.finalgrade ?? received;
    const pass = gradeValue < passingGrade;

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toBeFailingGrade',
          gradeValue,
          passingGrade,
          `grade ${gradeValue} to be failing (< ${passingGrade})`,
          `grade ${gradeValue} to NOT be failing (>= ${passingGrade})`
        ),
    };
  },

  /**
   * Assert that a grade percentage matches expected value
   * 
   * @example
   * expect(grade).toHaveGradePercentage(85);
   */
  toHaveGradePercentage(received: any, percentage: number) {
    const gradePercentage = received?.percentage ?? 
      (received?.grade / received?.grademax * 100) ?? 
      received;
    
    const pass = Math.abs(gradePercentage - percentage) < 0.01;

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toHaveGradePercentage',
          gradePercentage,
          percentage,
          `grade percentage to be ${percentage}%`,
          `grade percentage to NOT be ${percentage}%`
        ),
    };
  },

  // ========================
  // ACTIVITY COMPLETION MATCHERS
  // ========================

  /**
   * Assert that an activity is marked as completed
   * 
   * @example
   * expect(activity).toBeCompleted();
   */
  toBeCompleted(received: any) {
    const isCompleted = received?.completed === true || 
      received?.completion === 1 || 
      received?.completionstate === 1 ||
      received?.state === 'completed';

    return {
      pass: isCompleted,
      message: () =>
        formatMatcherMessage(
          isCompleted,
          'toBeCompleted',
          received,
          'completed',
          `activity to be completed`,
          `activity to NOT be completed`
        ),
    };
  },

  /**
   * Assert that an activity is in progress
   * 
   * @example
   * expect(activity).toBeInProgress();
   */
  toBeInProgress(received: any) {
    const inProgress = received?.state === 'in_progress' || 
      received?.completionstate === 2 ||
      (received?.progress > 0 && received?.progress < 100);

    return {
      pass: inProgress,
      message: () =>
        formatMatcherMessage(
          inProgress,
          'toBeInProgress',
          received,
          'in_progress',
          `activity to be in progress`,
          `activity to NOT be in progress`
        ),
    };
  },

  /**
   * Assert that an activity has not been started
   * 
   * @example
   * expect(activity).toBeNotStarted();
   */
  toBeNotStarted(received: any) {
    const notStarted = received?.state === 'not_started' || 
      received?.completionstate === 0 ||
      received?.progress === 0;

    return {
      pass: notStarted,
      message: () =>
        formatMatcherMessage(
          notStarted,
          'toBeNotStarted',
          received,
          'not_started',
          `activity to not be started`,
          `activity to be started`
        ),
    };
  },

  /**
   * Assert that an activity has a specific completion percentage
   * 
   * @example
   * expect(activity).toHaveCompletionPercentage(75);
   */
  toHaveCompletionPercentage(received: any, percentage: number) {
    const completionPercentage = received?.progress ?? received?.percentage ?? 0;
    const pass = Math.abs(completionPercentage - percentage) < 0.01;

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toHaveCompletionPercentage',
          completionPercentage,
          percentage,
          `completion percentage to be ${percentage}%`,
          `completion percentage to NOT be ${percentage}%`
        ),
    };
  },

  // ========================
  // ASSIGNMENT MATCHERS
  // ========================

  /**
   * Assert that an assignment has a submission
   * 
   * @example
   * expect(assignment).toHaveSubmission();
   */
  toHaveSubmission(received: any) {
    const hasSubmission = received?.submission !== null && 
      received?.submission !== undefined &&
      received?.hassubmission === true;

    return {
      pass: hasSubmission,
      message: () =>
        formatMatcherMessage(
          hasSubmission,
          'toHaveSubmission',
          received,
          'submission',
          `assignment to have a submission`,
          `assignment to NOT have a submission`
        ),
    };
  },

  /**
   * Assert that a submission is graded
   * 
   * @example
   * expect(submission).toBeGraded();
   */
  toBeGraded(received: any) {
    const isGraded = received?.graded === true || 
      received?.grade !== null && received?.grade !== undefined ||
      received?.status === 'graded';

    return {
      pass: isGraded,
      message: () =>
        formatMatcherMessage(
          isGraded,
          'toBeGraded',
          received,
          'graded',
          `submission to be graded`,
          `submission to NOT be graded`
        ),
    };
  },

  /**
   * Assert that a submission has feedback
   * 
   * @example
   * expect(submission).toHaveFeedback();
   */
  toHaveFeedback(received: any) {
    const hasFeedback = (received?.feedback && received.feedback.length > 0) ||
      received?.feedbackcomment ||
      received?.teachercomment;

    return {
      pass: hasFeedback,
      message: () =>
        formatMatcherMessage(
          hasFeedback,
          'toHaveFeedback',
          received,
          'feedback',
          `submission to have feedback`,
          `submission to NOT have feedback`
        ),
    };
  },

  /**
   * Assert that an assignment is overdue
   * 
   * @example
   * expect(assignment).toBeOverdue();
   */
  toBeOverdue(received: any) {
    const duedate = received?.duedate ?? received?.due;
    const now = Math.floor(Date.now() / 1000);
    const isOverdue = duedate && duedate < now;

    return {
      pass: isOverdue,
      message: () =>
        formatMatcherMessage(
          isOverdue,
          'toBeOverdue',
          duedate ? new Date(duedate * 1000) : null,
          'overdue',
          `assignment to be overdue`,
          `assignment to NOT be overdue`
        ),
    };
  },

  // ========================
  // QUIZ MATCHERS
  // ========================

  /**
   * Assert that a quiz has a specific number of attempts
   * 
   * @example
   * expect(quiz).toHaveAttempts(3);
   */
  toHaveAttempts(received: any, count: number) {
    const attemptCount = received?.attempts?.length ?? received?.attemptscount ?? 0;
    const pass = attemptCount === count;

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toHaveAttempts',
          attemptCount,
          count,
          `quiz to have ${count} attempt(s)`,
          `quiz to NOT have ${count} attempt(s)`
        ),
    };
  },

  /**
   * Assert that a quiz is currently open/available
   * 
   * @example
   * expect(quiz).toBeQuizOpen();
   */
  toBeQuizOpen(received: any) {
    const now = Math.floor(Date.now() / 1000);
    const timeopen = received?.timeopen ?? 0;
    const timeclose = received?.timeclose ?? Number.MAX_SAFE_INTEGER;
    const isOpen = now >= timeopen && now <= timeclose;

    return {
      pass: isOpen,
      message: () =>
        formatMatcherMessage(
          isOpen,
          'toBeQuizOpen',
          { now, timeopen, timeclose },
          'open',
          `quiz to be open`,
          `quiz to NOT be open`
        ),
    };
  },

  /**
   * Assert that a quiz is currently closed
   * 
   * @example
   * expect(quiz).toBeQuizClosed();
   */
  toBeQuizClosed(received: any) {
    const now = Math.floor(Date.now() / 1000);
    const timeclose = received?.timeclose ?? Number.MAX_SAFE_INTEGER;
    const isClosed = now > timeclose;

    return {
      pass: isClosed,
      message: () =>
        formatMatcherMessage(
          isClosed,
          'toBeQuizClosed',
          { now, timeclose },
          'closed',
          `quiz to be closed`,
          `quiz to NOT be closed`
        ),
    };
  },

  /**
   * Assert that a quiz attempt has specific time remaining
   * 
   * @example
   * expect(attempt).toHaveTimeRemaining(600); // 10 minutes
   */
  toHaveTimeRemaining(received: any, seconds: number) {
    const timeRemaining = received?.timeremaining ?? received?.timeleft ?? 0;
    const pass = Math.abs(timeRemaining - seconds) < 5; // 5 second tolerance

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toHaveTimeRemaining',
          timeRemaining,
          seconds,
          `${seconds} seconds remaining`,
          `NOT ${seconds} seconds remaining`
        ),
    };
  },

  // ========================
  // REACT COMPONENT MATCHERS
  // ========================

  /**
   * Assert that a component is in loading state
   * 
   * @example
   * expect(container).toHaveLoadingState();
   */
  toHaveLoadingState(received: any) {
    const hasLoadingIndicator = received?.textContent?.includes('Loading') ||
      received?.querySelector?.('[data-testid="loading"]') ||
      received?.querySelector?.('.loading') ||
      received?.querySelector?.('[role="progressbar"]');

    return {
      pass: !!hasLoadingIndicator,
      message: () =>
        formatMatcherMessage(
          !!hasLoadingIndicator,
          'toHaveLoadingState',
          received,
          'loading indicator',
          `component to have loading state`,
          `component to NOT have loading state`
        ),
    };
  },

  /**
   * Assert that a component is displaying an error state
   * 
   * @example
   * expect(container).toHaveErrorState();
   * expect(container).toHaveErrorState('Failed to load');
   */
  toHaveErrorState(received: any, message?: string) {
    const errorElement = received?.querySelector?.('[data-testid="error"]') ||
      received?.querySelector?.('.error') ||
      received?.querySelector?.('[role="alert"]');
    
    const hasError = !!errorElement;
    const errorText = errorElement?.textContent || '';
    const messageMatch = !message || errorText.includes(message);

    const pass = hasError && messageMatch;

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toHaveErrorState',
          errorText,
          message || 'error',
          message 
            ? `component to have error state with message "${message}"`
            : `component to have error state`,
          message
            ? `component to NOT have error state with message "${message}"`
            : `component to NOT have error state`
        ),
    };
  },

  /**
   * Assert that a component is displaying an empty state
   * 
   * @example
   * expect(container).toHaveEmptyState();
   */
  toHaveEmptyState(received: any) {
    const hasEmptyIndicator = received?.textContent?.includes('No data') ||
      received?.textContent?.includes('Empty') ||
      received?.querySelector?.('[data-testid="empty"]') ||
      received?.querySelector?.('.empty-state');

    return {
      pass: !!hasEmptyIndicator,
      message: () =>
        formatMatcherMessage(
          !!hasEmptyIndicator,
          'toHaveEmptyState',
          received,
          'empty state',
          `component to have empty state`,
          `component to NOT have empty state`
        ),
    };
  },

  /**
   * Assert that a component passes WCAG 2.1 AA accessibility checks
   * 
   * @example
   * await expect(container).toBeAccessible();
   */
  async toBeAccessible(received: any) {
    try {
      const results: AxeResults = await axeRun(received);
      const violations = results.violations;
      const pass = violations.length === 0;

      return {
        pass,
        message: () => {
          if (pass) {
            return 'Expected component to have accessibility violations, but found none';
          }
          
          const violationDetails = violations
            .map(v => `  - ${v.id}: ${v.description}\n    Impact: ${v.impact}\n    Nodes: ${v.nodes.length}`)
            .join('\n');

          return `Expected component to be accessible (WCAG 2.1 AA), but found ${violations.length} violation(s):\n\n${violationDetails}`;
        },
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Failed to run accessibility check: ${error}`,
      };
    }
  },

  // ========================
  // DATA STRUCTURE MATCHERS
  // ========================

  /**
   * Assert that a timestamp matches Moodle's Unix timestamp format
   * 
   * @example
   * expect(timestamp).toMatchMoodleTimestamp(1609459200);
   * expect(timestamp).toMatchMoodleTimestamp(1609459200, 1000); // 1 second tolerance
   */
  toMatchMoodleTimestamp(received: any, expected: number, toleranceMs: number = 0) {
    const receivedTimestamp = typeof received === 'number' ? received : parseInt(received);
    const diff = Math.abs(receivedTimestamp - expected);
    const pass = diff <= toleranceMs / 1000;

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toMatchMoodleTimestamp',
          receivedTimestamp,
          expected,
          `timestamp to match ${expected} (within ${toleranceMs}ms)`,
          `timestamp to NOT match ${expected}`
        ),
    };
  },

  /**
   * Assert that a value is a valid Moodle ID (positive integer)
   * 
   * @example
   * expect(courseId).toBeValidMoodleId();
   */
  toBeValidMoodleId(received: any) {
    const isValid = typeof received === 'number' && 
      Number.isInteger(received) && 
      received > 0;

    return {
      pass: isValid,
      message: () =>
        formatMatcherMessage(
          isValid,
          'toBeValidMoodleId',
          received,
          'positive integer',
          `value to be a valid Moodle ID (positive integer)`,
          `value to NOT be a valid Moodle ID`
        ),
    };
  },

  /**
   * Assert that an object matches a Moodle API structure shape
   * 
   * @example
   * expect(course).toHaveMoodleStructure({
   *   id: 'number',
   *   fullname: 'string',
   *   shortname: 'string'
   * });
   */
  toHaveMoodleStructure(received: any, shape: object) {
    const errors: string[] = [];

    for (const [key, expectedType] of Object.entries(shape)) {
      const actualValue = received?.[key];
      const actualType = typeof actualValue;

      if (actualType !== expectedType) {
        errors.push(`Property "${key}": expected type "${expectedType}", got "${actualType}"`);
      }
    }

    const pass = errors.length === 0;

    return {
      pass,
      message: () => {
        if (pass) {
          return `Expected object to NOT match Moodle structure, but it does`;
        }
        return `Expected object to match Moodle structure, but found errors:\n${errors.join('\n')}`;
      },
    };
  },

  // ========================
  // API RESPONSE MATCHERS
  // ========================

  /**
   * Assert that a response follows Moodle API success format
   * 
   * @example
   * expect(response).toBeSuccessResponse();
   */
  toBeSuccessResponse(received: any) {
    const isSuccess = received?.success === true && 
      received?.data !== undefined;

    return {
      pass: isSuccess,
      message: () =>
        formatMatcherMessage(
          isSuccess,
          'toBeSuccessResponse',
          received,
          '{ success: true, data: ... }',
          `response to be a success response`,
          `response to NOT be a success response`
        ),
    };
  },

  /**
   * Assert that a response follows Moodle API error format
   * 
   * @example
   * expect(response).toBeErrorResponse();
   * expect(response).toBeErrorResponse('PERMISSION_DENIED');
   */
  toBeErrorResponse(received: any, code?: string) {
    const isError = received?.success === false && 
      received?.error !== undefined;
    
    const codeMatch = !code || received?.error?.code === code;
    const pass = isError && codeMatch;

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toBeErrorResponse',
          received,
          code || '{ success: false, error: ... }',
          code
            ? `response to be an error response with code "${code}"`
            : `response to be an error response`,
          code
            ? `response to NOT be an error response with code "${code}"`
            : `response to NOT be an error response`
        ),
    };
  },

  /**
   * Assert that a response includes pagination metadata
   * 
   * @example
   * expect(response).toHavePagination();
   */
  toHavePagination(received: any) {
    const hasPagination = received?.meta?.pagination !== undefined &&
      typeof received?.meta?.pagination?.page === 'number' &&
      typeof received?.meta?.pagination?.perPage === 'number' &&
      typeof received?.meta?.pagination?.total === 'number';

    return {
      pass: hasPagination,
      message: () =>
        formatMatcherMessage(
          hasPagination,
          'toHavePagination',
          received?.meta?.pagination,
          'pagination metadata',
          `response to have pagination metadata`,
          `response to NOT have pagination metadata`
        ),
    };
  },

  // ========================
  // DATE/TIME MATCHERS
  // ========================

  /**
   * Assert that a date is within a specific number of days from now
   * 
   * @example
   * expect(timestamp).toBeWithinDays(7);
   */
  toBeWithinDays(received: any, days: number) {
    const date = typeof received === 'number' 
      ? new Date(received * 1000) 
      : new Date(received);
    
    const now = new Date();
    const diffMs = Math.abs(date.getTime() - now.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const pass = diffDays <= days;

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toBeWithinDays',
          date,
          `within ${days} days`,
          `date to be within ${days} days of now`,
          `date to NOT be within ${days} days of now`
        ),
    };
  },

  /**
   * Assert that a date is in the future
   * 
   * @example
   * expect(duedate).toBeInFuture();
   */
  toBeInFuture(received: any) {
    const date = typeof received === 'number' 
      ? new Date(received * 1000) 
      : new Date(received);
    
    const now = new Date();
    const pass = date > now;

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toBeInFuture',
          date,
          'future date',
          `date to be in the future`,
          `date to NOT be in the future`
        ),
    };
  },

  /**
   * Assert that a date is in the past
   * 
   * @example
   * expect(completeddate).toBeInPast();
   */
  toBeInPast(received: any) {
    const date = typeof received === 'number' 
      ? new Date(received * 1000) 
      : new Date(received);
    
    const now = new Date();
    const pass = date < now;

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toBeInPast',
          date,
          'past date',
          `date to be in the past`,
          `date to NOT be in the past`
        ),
    };
  },
});

// Export type augmentation for better IDE support
export type { CustomMatchers };
