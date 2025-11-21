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
import { run as axeRun, type AxeResults } from 'axe-core';

// Type guard helpers
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Helper function to create consistent matcher messages
 */
function formatMatcherMessage(
  pass: boolean,
  _matcherName: string,
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
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
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
  toBeEnrolled(received: unknown, courseid: number) {
    const enrollments = isRecord(received) && ('enrollments' in received || 'courses' in received)
      ? (received.enrollments as unknown[] || received.courses as unknown[] || [])
      : [];
    
    const isEnrolled = Array.isArray(enrollments) && 
      enrollments.some((enrollment: unknown) => {
        if (!isRecord(enrollment)) {
          return false;
        }
        const enrollmentCourseid = 'courseid' in enrollment ? enrollment.courseid : undefined;
        const enrollmentId = 'id' in enrollment ? enrollment.id : undefined;
        return enrollmentCourseid === courseid || enrollmentId === courseid;
      });

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
  toBeUnenrolled(received: unknown, courseid: number) {
    const enrollments = isRecord(received) && ('enrollments' in received || 'courses' in received)
      ? (received.enrollments as unknown[] || received.courses as unknown[] || [])
      : [];
    
    const isEnrolled = Array.isArray(enrollments) && 
      enrollments.some((enrollment: unknown) => {
        if (!isRecord(enrollment)) {
          return false;
        }
        const enrollmentCourseid = 'courseid' in enrollment ? enrollment.courseid : undefined;
        const enrollmentId = 'id' in enrollment ? enrollment.id : undefined;
        return enrollmentCourseid === courseid || enrollmentId === courseid;
      });

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
  toHaveEnrollmentMethod(received: unknown, method: string) {
    const enrolmethod = isRecord(received) && 'enrolmethod' in received ? received.enrolmethod : undefined;
    const methodValue = isRecord(received) && 'method' in received ? received.method : undefined;
    const hasMethod = enrolmethod === method || methodValue === method;

    return {
      pass: hasMethod,
      message: () =>
        formatMatcherMessage(
          hasMethod,
          'toHaveEnrollmentMethod',
          enrolmethod || methodValue,
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
  toHaveCapability(received: unknown, capability: string, context?: string) {
    const capabilities = isRecord(received) && ('capabilities' in received || 'permissions' in received)
      ? (received.capabilities as unknown[] || received.permissions as unknown[] || [])
      : [];
    
    const hasCapability = Array.isArray(capabilities) &&
      capabilities.some((cap: unknown) => {
        if (typeof cap === 'string') {
          return cap === capability;
        }
        if (!isRecord(cap)) {
          return false;
        }
        
        const capName = 'name' in cap ? cap.name : undefined;
        const capCapability = 'capability' in cap ? cap.capability : undefined;
        const capContext = 'context' in cap ? cap.context : undefined;
        
        const capMatch = capName === capability || capCapability === capability;
        const contextMatch = !context || capContext === context;
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
  toLackCapability(received: unknown, capability: string) {
    const capabilities = isRecord(received) && ('capabilities' in received || 'permissions' in received)
      ? (received.capabilities as unknown[] || received.permissions as unknown[] || [])
      : [];
    
    const hasCapability = Array.isArray(capabilities) &&
      capabilities.some((cap: unknown) => {
        if (typeof cap === 'string') {
          return cap === capability;
        }
        if (!isRecord(cap)) {
          return false;
        }
        
        const capName = 'name' in cap ? cap.name : undefined;
        const capCapability = 'capability' in cap ? cap.capability : undefined;
        
        return capName === capability || capCapability === capability;
      });

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
  toBeRole(received: unknown, role: 'student' | 'teacher' | 'admin' | 'guest') {
    if (!isRecord(received)) {
      return {
        pass: false,
        message: () => formatMatcherMessage(false, 'toBeRole', received, role, `user to have role "${role}"`, `user to NOT have role "${role}"`),
      };
    }
    
    let userRole: unknown = undefined;
    if ('role' in received) {
      userRole = received.role;
    } else if ('rolename' in received) {
      userRole = received.rolename;
    } else if ('roles' in received && Array.isArray(received.roles) && received.roles.length > 0) {
      userRole = received.roles[0] as unknown;
    }
    
    const roles = 'roles' in received && Array.isArray(received.roles) ? received.roles : [];
    const hasRole = userRole === role || roles.includes(role);

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
  toHaveGrade(received: unknown, expected: number | { min: number; max: number }) {
    let gradeValue: unknown;
    if (isRecord(received)) {
      gradeValue = ('grade' in received ? received.grade : undefined) ?? ('finalgrade' in received ? received.finalgrade : undefined);
    } else {
      gradeValue = received;
    }
    
    let pass: boolean;
    if (typeof expected === 'number') {
      pass = gradeValue === expected;
    } else {
      pass = typeof gradeValue === 'number' && gradeValue >= expected.min && gradeValue <= expected.max;
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
  toBePassingGrade(received: unknown, passingGrade: number) {
    let gradeValue: unknown;
    if (isRecord(received)) {
      gradeValue = ('grade' in received ? received.grade : undefined) ?? ('finalgrade' in received ? received.finalgrade : undefined);
    } else {
      gradeValue = received;
    }
    
    const pass = typeof gradeValue === 'number' && gradeValue >= passingGrade;
    const gradeStr = String(gradeValue);

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toBePassingGrade',
          gradeValue,
          passingGrade,
          `grade ${gradeStr} to be passing (>= ${passingGrade})`,
          `grade ${gradeStr} to NOT be passing (< ${passingGrade})`
        ),
    };
  },

  /**
   * Assert that a grade is failing
   * 
   * @example
   * expect(grade).toBeFailingGrade(60);
   */
  toBeFailingGrade(received: unknown, passingGrade: number) {
    let gradeValue: unknown;
    if (isRecord(received)) {
      gradeValue = ('grade' in received ? received.grade : undefined) ?? ('finalgrade' in received ? received.finalgrade : undefined);
    } else {
      gradeValue = received;
    }
    
    const pass = typeof gradeValue === 'number' && gradeValue < passingGrade;
    const gradeStr = String(gradeValue);

    return {
      pass,
      message: () =>
        formatMatcherMessage(
          pass,
          'toBeFailingGrade',
          gradeValue,
          passingGrade,
          `grade ${gradeStr} to be failing (< ${passingGrade})`,
          `grade ${gradeStr} to NOT be failing (>= ${passingGrade})`
        ),
    };
  },

  /**
   * Assert that a grade percentage matches expected value
   * 
   * @example
   * expect(grade).toHaveGradePercentage(85);
   */
  toHaveGradePercentage(received: unknown, percentage: number) {
    let gradePercentage: unknown;
    
    if (isRecord(received)) {
      if ('percentage' in received) {
        gradePercentage = received.percentage;
      } else if ('grade' in received && 'grademax' in received && 
                 typeof received.grade === 'number' && typeof received.grademax === 'number') {
        gradePercentage = (received.grade / received.grademax * 100);
      } else {
        gradePercentage = received;
      }
    } else {
      gradePercentage = received;
    }
    
    const pass = typeof gradePercentage === 'number' && Math.abs(gradePercentage - percentage) < 0.01;

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
  toBeCompleted(received: unknown) {
    const isCompleted = isRecord(received) && (
      ('completed' in received && received.completed === true) || 
      ('completion' in received && received.completion === 1) || 
      ('completionstate' in received && received.completionstate === 1) ||
      ('state' in received && received.state === 'completed')
    );

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
  toBeInProgress(received: unknown) {
    const inProgress = isRecord(received) && (
      ('state' in received && received.state === 'in_progress') || 
      ('completionstate' in received && received.completionstate === 2) ||
      ('progress' in received && typeof received.progress === 'number' && received.progress > 0 && received.progress < 100)
    );

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
  toBeNotStarted(received: unknown) {
    const notStarted = isRecord(received) && (
      ('state' in received && received.state === 'not_started') || 
      ('completionstate' in received && received.completionstate === 0) ||
      ('progress' in received && received.progress === 0)
    );

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
  toHaveCompletionPercentage(received: unknown, percentage: number) {
    let completionPercentage: number = 0;
    if (isRecord(received)) {
      if ('progress' in received && typeof received.progress === 'number') {
        completionPercentage = received.progress;
      } else if ('percentage' in received && typeof received.percentage === 'number') {
        completionPercentage = received.percentage;
      }
    }
    
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
  toHaveSubmission(received: unknown) {
    const hasSubmission = isRecord(received) && (
      ('submission' in received && received.submission !== null && received.submission !== undefined) ||
      ('hassubmission' in received && received.hassubmission === true)
    );

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
  toBeGraded(received: unknown) {
    const isGraded = isRecord(received) && (
      ('graded' in received && received.graded === true) || 
      ('grade' in received && received.grade !== null && received.grade !== undefined) ||
      ('status' in received && received.status === 'graded')
    );

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
  toHaveFeedback(received: unknown) {
    const hasFeedback: boolean = isRecord(received) && (
      ('feedback' in received && typeof received.feedback === 'string' && received.feedback.length > 0) ||
      ('feedbackcomment' in received && typeof received.feedbackcomment === 'string' && received.feedbackcomment.length > 0) ||
      ('teachercomment' in received && typeof received.teachercomment === 'string' && received.teachercomment.length > 0)
    );

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
  toBeOverdue(received: unknown) {
    let duedate: unknown;
    if (isRecord(received)) {
      duedate = ('duedate' in received ? received.duedate : undefined) ?? ('due' in received ? received.due : undefined);
    }
    
    const now = Math.floor(Date.now() / 1000);
    const isOverdue = typeof duedate === 'number' && duedate < now;

    return {
      pass: isOverdue,
      message: () =>
        formatMatcherMessage(
          isOverdue,
          'toBeOverdue',
          typeof duedate === 'number' ? new Date(duedate * 1000) : null,
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
  toHaveAttempts(received: unknown, count: number) {
    let attemptCount: number = 0;
    
    if (isRecord(received)) {
      if ('attempts' in received && Array.isArray(received.attempts)) {
        attemptCount = received.attempts.length;
      } else if ('attemptscount' in received && typeof received.attemptscount === 'number') {
        attemptCount = received.attemptscount;
      }
    }
    
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
  toBeQuizOpen(received: unknown) {
    const now = Math.floor(Date.now() / 1000);
    let timeopen: number = 0;
    let timeclose: number = Number.MAX_SAFE_INTEGER;
    
    if (isRecord(received)) {
      if ('timeopen' in received && typeof received.timeopen === 'number') {
        timeopen = received.timeopen;
      }
      if ('timeclose' in received && typeof received.timeclose === 'number') {
        timeclose = received.timeclose;
      }
    }
    
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
  toBeQuizClosed(received: unknown) {
    const now = Math.floor(Date.now() / 1000);
    let timeclose: number = Number.MAX_SAFE_INTEGER;
    
    if (isRecord(received) && 'timeclose' in received && typeof received.timeclose === 'number') {
      timeclose = received.timeclose;
    }
    
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
  toHaveTimeRemaining(received: unknown, seconds: number) {
    let timeRemaining: number = 0;
    
    if (isRecord(received)) {
      if ('timeremaining' in received && typeof received.timeremaining === 'number') {
        timeRemaining = received.timeremaining;
      } else if ('timeleft' in received && typeof received.timeleft === 'number') {
        timeRemaining = received.timeleft;
      }
    }
    
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
  toHaveLoadingState(received: unknown) {
    let hasLoadingIndicator = false;
    
    if (isRecord(received)) {
      if ('textContent' in received && typeof received.textContent === 'string' && received.textContent.includes('Loading')) {
        hasLoadingIndicator = true;
      } else if ('querySelector' in received && typeof received.querySelector === 'function') {
        const container = received as { querySelector: (selector: string) => Element | null };
        const loadingEl = container.querySelector('[data-testid="loading"]') ||
          container.querySelector('.loading') ||
          container.querySelector('[role="progressbar"]');
        hasLoadingIndicator = !!loadingEl;
      }
    }

    return {
      pass: hasLoadingIndicator,
      message: () =>
        formatMatcherMessage(
          hasLoadingIndicator,
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
  toHaveErrorState(received: unknown, message?: string) {
    let errorElement: unknown = null;
    
    if (isRecord(received) && 'querySelector' in received && typeof received.querySelector === 'function') {
      errorElement = received.querySelector('[data-testid="error"]') ||
        received.querySelector('.error') ||
        received.querySelector('[role="alert"]');
    }
    
    const hasError = !!errorElement;
    const errorText = (isRecord(errorElement) && 'textContent' in errorElement && typeof errorElement.textContent === 'string') 
      ? errorElement.textContent 
      : '';
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
  toHaveEmptyState(received: unknown) {
    let hasEmptyIndicator = false;
    
    if (isRecord(received)) {
      if ('textContent' in received && typeof received.textContent === 'string') {
        if (received.textContent.includes('No data') || received.textContent.includes('Empty')) {
          hasEmptyIndicator = true;
        }
      }
      
      if (!hasEmptyIndicator && 'querySelector' in received && typeof received.querySelector === 'function') {
        const container = received as { querySelector: (selector: string) => Element | null };
        const emptyEl = container.querySelector('[data-testid="empty"]') ||
          container.querySelector('.empty-state');
        hasEmptyIndicator = !!emptyEl;
      }
    }

    return {
      pass: hasEmptyIndicator,
      message: () =>
        formatMatcherMessage(
          hasEmptyIndicator,
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
  async toBeAccessible(received: unknown) {
    try {
      const results: AxeResults = await axeRun(received);
      const {violations} = results;
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
        message: () => `Failed to run accessibility check: ${String(error)}`,
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
  toMatchMoodleTimestamp(received: unknown, expected: number, toleranceMs: number = 0) {
    let receivedTimestamp: number;
    
    if (typeof received === 'number') {
      receivedTimestamp = received;
    } else if (typeof received === 'string') {
      receivedTimestamp = parseInt(received, 10);
    } else {
      receivedTimestamp = NaN;
    }
    
    const diff = Math.abs(receivedTimestamp - expected);
    const pass = !isNaN(receivedTimestamp) && diff <= toleranceMs / 1000;

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
  toBeValidMoodleId(received: unknown) {
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
  toHaveMoodleStructure(received: unknown, shape: Record<string, string>) {
    const errors: string[] = [];

    if (!isRecord(received)) {
      errors.push(`Expected object, got ${typeof received}`);
    } else {
      for (const [key, expectedType] of Object.entries(shape)) {
        const actualValue = received[key];
        const actualType = typeof actualValue;

        if (actualType !== expectedType) {
          errors.push(`Property "${key}": expected type "${expectedType}", got "${actualType}"`);
        }
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
  toBeSuccessResponse(received: unknown) {
    const isSuccess = isRecord(received) && 
      received.success === true && 
      'data' in received && 
      received.data !== undefined;

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
  toBeErrorResponse(received: unknown, code?: string) {
    const isError = isRecord(received) && 
      received.success === false && 
      'error' in received && 
      received.error !== undefined;
    
    const codeMatch = !code || (isRecord(received) && isRecord(received.error) && received.error.code === code);
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
  toHavePagination(received: unknown) {
    let hasPagination = false;
    let paginationData: unknown = undefined;
    
    if (isRecord(received) && 'meta' in received && isRecord(received.meta)) {
      const {meta} = received;
      if ('pagination' in meta && isRecord(meta.pagination)) {
        const {pagination} = meta;
        paginationData = pagination;
        hasPagination = typeof pagination.page === 'number' &&
          typeof pagination.perPage === 'number' &&
          typeof pagination.total === 'number';
      }
    }

    return {
      pass: hasPagination,
      message: () =>
        formatMatcherMessage(
          hasPagination,
          'toHavePagination',
          paginationData,
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
  toBeWithinDays(received: unknown, days: number) {
    let date: Date;
    
    if (typeof received === 'number') {
      date = new Date(received * 1000);
    } else if (typeof received === 'string') {
      date = new Date(received);
    } else {
      date = new Date(NaN);
    }
    
    const now = new Date();
    const diffMs = Math.abs(date.getTime() - now.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const pass = !isNaN(date.getTime()) && diffDays <= days;

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
  toBeInFuture(received: unknown) {
    let date: Date;
    
    if (typeof received === 'number') {
      date = new Date(received * 1000);
    } else if (typeof received === 'string') {
      date = new Date(received);
    } else {
      date = new Date(NaN);
    }
    
    const now = new Date();
    const pass = !isNaN(date.getTime()) && date > now;

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
  toBeInPast(received: unknown) {
    let date: Date;
    
    if (typeof received === 'number') {
      date = new Date(received * 1000);
    } else if (typeof received === 'string') {
      date = new Date(received);
    } else {
      date = new Date(NaN);
    }
    
    const now = new Date();
    const pass = !isNaN(date.getTime()) && date < now;

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
