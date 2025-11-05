/**
 * Date Mocking and Testing Utilities
 * 
 * Comprehensive utilities for testing time-sensitive features like quiz timers,
 * assignment due dates, calendar events, and activity timestamps.
 * 
 * Provides deterministic date/time manipulation for reliable testing.
 * 
 * @module tests/helpers/dateUtils
 */

import { expect } from 'vitest';
import { differenceInMilliseconds } from 'date-fns';

/**
 * Stored system time for restoration
 */
let frozenTime: Date | null = null;

// ====================
// TIME FREEZING UTILITIES
// ====================

/**
 * Freeze time to a specific date/time for deterministic testing.
 * Uses Vitest's vi.setSystemTime() to mock Date.now() and new Date().
 * 
 * **Timezone Handling:** Freezes to the exact moment provided. Be mindful
 * of timezone differences when comparing frozen time with timezone-aware dates.
 * 
 * @param date - Date to freeze to. Accepts Date object, ISO string, or Unix timestamp.
 *               Defaults to current time if not provided.
 * 
 * @example
 * ```typescript
 * // Freeze to specific date
 * freezeTime(new Date('2024-01-15T10:30:00Z'));
 * 
 * // Freeze to timestamp
 * freezeTime(1705318200000);
 * 
 * // Freeze to ISO string
 * freezeTime('2024-01-15T10:30:00Z');
 * 
 * // Freeze to current time
 * freezeTime();
 * ```
 */
export function freezeTime(date?: Date | string | number): void {
  const targetDate = date ? new Date(date) : new Date();
  frozenTime = targetDate;
  vi.setSystemTime(targetDate);
}

/**
 * Restore real Date behavior after freezing time.
 * Call this in afterEach hooks to ensure test isolation.
 * 
 * @example
 * ```typescript
 * afterEach(() => {
 *   unfreezeTime();
 * });
 * ```
 */
export function unfreezeTime(): void {
  frozenTime = null;
  vi.useRealTimers();
}

/**
 * Advance frozen time by specified milliseconds.
 * Throws error if time is not currently frozen.
 * 
 * @param ms - Milliseconds to advance
 * 
 * @example
 * ```typescript
 * freezeTime(new Date('2024-01-15T10:00:00Z'));
 * advanceTime(5000); // Advance by 5 seconds
 * // Time is now 2024-01-15T10:00:05Z
 * ```
 */
export function advanceTime(ms: number): void {
  if (!frozenTime) {
    throw new Error('Cannot advance time: time is not frozen. Call freezeTime() first.');
  }
  
  const newTime = new Date(frozenTime.getTime() + ms);
  frozenTime = newTime;
  vi.setSystemTime(newTime);
}

/**
 * Advance frozen time by specified number of days.
 * Convenience wrapper around advanceTime().
 * 
 * @param days - Number of days to advance (can be fractional)
 * 
 * @example
 * ```typescript
 * freezeTime(new Date('2024-01-15T10:00:00Z'));
 * advanceTimeByDays(2); // Advance by 2 days
 * // Time is now 2024-01-17T10:00:00Z
 * ```
 */
export function advanceTimeByDays(days: number): void {
  const ms = days * 24 * 60 * 60 * 1000;
  advanceTime(ms);
}

/**
 * Advance frozen time by specified number of hours.
 * Convenience wrapper around advanceTime().
 * 
 * @param hours - Number of hours to advance (can be fractional)
 * 
 * @example
 * ```typescript
 * freezeTime(new Date('2024-01-15T10:00:00Z'));
 * advanceTimeByHours(2.5); // Advance by 2.5 hours
 * // Time is now 2024-01-15T12:30:00Z
 * ```
 */
export function advanceTimeByHours(hours: number): void {
  const ms = hours * 60 * 60 * 1000;
  advanceTime(ms);
}

// ====================
// DATE FACTORY FUNCTIONS
// ====================

/**
 * Create a date relative to the current time (or frozen time).
 * 
 * **Timezone Handling:** Returns Date in system timezone. Use .toISOString()
 * for UTC representation.
 * 
 * @param daysOffset - Days from now (positive = future, negative = past)
 * @param hoursOffset - Additional hours offset (defaults to 0)
 * @returns Date object
 * 
 * @example
 * ```typescript
 * const tomorrow = createDate(1);
 * const yesterday = createDate(-1);
 * const inTwoDaysAndThreeHours = createDate(2, 3);
 * ```
 */
export function createDate(daysOffset: number = 0, hoursOffset: number = 0): Date {
  const now = new Date();
  const totalMs = (daysOffset * 24 * 60 * 60 * 1000) + (hoursOffset * 60 * 60 * 1000);
  return new Date(now.getTime() + totalMs);
}

/**
 * Create a date in the past relative to now.
 * 
 * @param daysAgo - Number of days in the past
 * @returns Date object
 * 
 * @example
 * ```typescript
 * const lastWeek = createPastDate(7);
 * const yesterday = createPastDate(1);
 * ```
 */
export function createPastDate(daysAgo: number): Date {
  return createDate(-Math.abs(daysAgo));
}

/**
 * Create a date in the future relative to now.
 * 
 * @param daysFromNow - Number of days in the future
 * @returns Date object
 * 
 * @example
 * ```typescript
 * const nextWeek = createFutureDate(7);
 * const tomorrow = createFutureDate(1);
 * ```
 */
export function createFutureDate(daysFromNow: number): Date {
  return createDate(Math.abs(daysFromNow));
}

/**
 * Create a Unix timestamp (seconds since epoch) relative to now.
 * Moodle uses Unix timestamps for most date storage.
 * 
 * @param daysOffset - Days from now (positive = future, negative = past)
 * @returns Unix timestamp in seconds
 * 
 * @example
 * ```typescript
 * const tomorrowTimestamp = createTimestamp(1);
 * const yesterdayTimestamp = createTimestamp(-1);
 * ```
 */
export function createTimestamp(daysOffset: number = 0): number {
  const date = createDate(daysOffset);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Create an ISO 8601 date string relative to now.
 * 
 * @param daysOffset - Days from now (positive = future, negative = past)
 * @returns ISO 8601 date string in UTC
 * 
 * @example
 * ```typescript
 * const tomorrowISO = createISOString(1);
 * // Returns: "2024-01-16T10:30:00.000Z"
 * ```
 */
export function createISOString(daysOffset: number = 0): string {
  const date = createDate(daysOffset);
  return date.toISOString();
}

// ====================
// DATE ASSERTIONS
// ====================

/**
 * Assert that two dates are equal (within 1 second tolerance).
 * Accepts Date objects, ISO strings, or Unix timestamps.
 * 
 * **Timezone Handling:** Compares absolute time values, ignoring timezone display.
 * 
 * @param actual - Actual date value
 * @param expected - Expected date value
 * @throws AssertionError if dates don't match
 * 
 * @example
 * ```typescript
 * expectDateToBe(response.duedate, createTimestamp(7));
 * expectDateToBe(new Date('2024-01-15'), '2024-01-15T00:00:00Z');
 * ```
 */
export function expectDateToBe(
  actual: Date | string | number,
  expected: Date | string | number
): void {
  const actualDate = new Date(actual);
  const expectedDate = new Date(expected);
  
  const diff = Math.abs(actualDate.getTime() - expectedDate.getTime());
  const tolerance = 1000; // 1 second tolerance
  
  if (diff > tolerance) {
    expect.fail(
      `Expected date to be ${expectedDate.toISOString()}, ` +
      `but got ${actualDate.toISOString()} ` +
      `(difference: ${diff}ms)`
    );
  }
}

/**
 * Assert that a date is after another date.
 * 
 * @param date - Date to check
 * @param afterDate - Date that should be earlier
 * @throws AssertionError if date is not after afterDate
 * 
 * @example
 * ```typescript
 * expectDateToBeAfter(assignment.duedate, assignment.availablefrom);
 * ```
 */
export function expectDateToBeAfter(
  date: Date | string,
  afterDate: Date | string
): void {
  const dateObj = new Date(date);
  const afterDateObj = new Date(afterDate);
  
  if (dateObj.getTime() <= afterDateObj.getTime()) {
    expect.fail(
      `Expected ${dateObj.toISOString()} to be after ${afterDateObj.toISOString()}`
    );
  }
}

/**
 * Assert that a date is before another date.
 * 
 * @param date - Date to check
 * @param beforeDate - Date that should be later
 * @throws AssertionError if date is not before beforeDate
 * 
 * @example
 * ```typescript
 * expectDateToBeBefore(assignment.availablefrom, assignment.duedate);
 * ```
 */
export function expectDateToBeBefore(
  date: Date | string,
  beforeDate: Date | string
): void {
  const dateObj = new Date(date);
  const beforeDateObj = new Date(beforeDate);
  
  if (dateObj.getTime() >= beforeDateObj.getTime()) {
    expect.fail(
      `Expected ${dateObj.toISOString()} to be before ${beforeDateObj.toISOString()}`
    );
  }
}

/**
 * Assert that a date is today (same calendar day).
 * 
 * **Timezone Handling:** Compares in system timezone.
 * 
 * @param date - Date to check
 * @throws AssertionError if date is not today
 * 
 * @example
 * ```typescript
 * expectDateToBeToday(lastLogin);
 * ```
 */
export function expectDateToBeToday(date: Date | string): void {
  const dateObj = new Date(date);
  const today = new Date();
  
  const isToday = 
    dateObj.getFullYear() === today.getFullYear() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getDate() === today.getDate();
  
  if (!isToday) {
    expect.fail(
      `Expected ${dateObj.toISOString()} to be today, ` +
      `but today is ${today.toISOString()}`
    );
  }
}

/**
 * Assert that a date is between two other dates (inclusive).
 * 
 * @param date - Date to check
 * @param start - Start of range (inclusive)
 * @param end - End of range (inclusive)
 * @throws AssertionError if date is not in range
 * 
 * @example
 * ```typescript
 * expectDateToBeBetween(
 *   submission.timecreated,
 *   assignment.availablefrom,
 *   assignment.duedate
 * );
 * ```
 */
export function expectDateToBeBetween(
  date: Date,
  start: Date,
  end: Date
): void {
  const dateTime = date.getTime();
  const startTime = start.getTime();
  const endTime = end.getTime();
  
  if (dateTime < startTime || dateTime > endTime) {
    expect.fail(
      `Expected ${date.toISOString()} to be between ` +
      `${start.toISOString()} and ${end.toISOString()}`
    );
  }
}

// ====================
// DATE COMPARISON UTILITIES
// ====================

/**
 * Check if two dates are on the same calendar day.
 * 
 * **Timezone Handling:** Compares in system timezone.
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if same day, false otherwise
 * 
 * @example
 * ```typescript
 * if (isSameDay(submission.timecreated, assignment.duedate)) {
 *   // Submitted on due date
 * }
 * ```
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if a due date is coming up soon (within threshold).
 * Useful for "due soon" warnings in UI.
 * 
 * @param dueDate - Due date to check
 * @param thresholdHours - Hours threshold (defaults to 24)
 * @returns true if due within threshold, false otherwise
 * 
 * @example
 * ```typescript
 * if (isDueSoon(assignment.duedate, 48)) {
 *   // Show "Due in 2 days" warning
 * }
 * ```
 */
export function isDueSoon(dueDate: Date, thresholdHours: number = 24): boolean {
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return diffHours > 0 && diffHours <= thresholdHours;
}

/**
 * Check if a date is in the past (overdue).
 * 
 * @param dueDate - Date to check
 * @returns true if date is in the past, false otherwise
 * 
 * @example
 * ```typescript
 * if (isOverdue(assignment.duedate)) {
 *   // Show overdue indicator
 * }
 * ```
 */
export function isOverdue(dueDate: Date): boolean {
  const now = new Date();
  return dueDate.getTime() < now.getTime();
}

// ====================
// FORMATTING HELPERS
// ====================

/**
 * Format a date for test output with consistent formatting.
 * Uses ISO 8601 format for clarity.
 * 
 * @param date - Date to format
 * @returns Formatted date string
 * 
 * @example
 * ```typescript
 * console.log(`Due date: ${formatDateForTest(assignment.duedate)}`);
 * // Output: "Due date: 2024-01-15T10:30:00.000Z"
 * ```
 */
export function formatDateForTest(date: Date): string {
  return date.toISOString();
}

/**
 * Parse a date string from test fixtures.
 * Handles ISO 8601, Unix timestamps, and common date formats.
 * 
 * @param dateString - Date string to parse
 * @returns Parsed Date object
 * @throws Error if string cannot be parsed
 * 
 * @example
 * ```typescript
 * const date = parseTestDate('2024-01-15T10:30:00Z');
 * const dateFromTimestamp = parseTestDate('1705318200');
 * ```
 */
export function parseTestDate(dateString: string): Date {
  // Try parsing as Unix timestamp (seconds)
  const timestamp = Number(dateString);
  if (!isNaN(timestamp) && timestamp > 0) {
    return new Date(timestamp * 1000);
  }
  
  // Parse as ISO string or other format
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Cannot parse date string: ${dateString}`);
  }
  
  return date;
}

// ====================
// COMMON TEST SCENARIOS
// ====================

/**
 * Create a realistic assignment due date timestamp.
 * Returns Unix timestamp (seconds) as used by Moodle API.
 * 
 * @param daysFromNow - Days until assignment is due
 * @returns Unix timestamp in seconds
 * 
 * @example
 * ```typescript
 * const assignment = createMockAssignment({
 *   duedate: createAssignmentDueDate(7), // Due in 7 days
 * });
 * ```
 */
export function createAssignmentDueDate(daysFromNow: number): number {
  return createTimestamp(daysFromNow);
}

/**
 * Create quiz time limit in seconds.
 * Moodle stores quiz time limits as seconds.
 * 
 * @param minutes - Time limit in minutes
 * @returns Time limit in seconds
 * 
 * @example
 * ```typescript
 * const quiz = createMockQuiz({
 *   timelimit: createQuizTimeLimit(60), // 60 minute quiz
 * });
 * ```
 */
export function createQuizTimeLimit(minutes: number): number {
  return minutes * 60;
}

/**
 * Create timestamps for an upcoming calendar event.
 * Returns start and end timestamps in seconds.
 * 
 * @param daysFromNow - Days until event starts
 * @returns Object with start and end Unix timestamps
 * 
 * @example
 * ```typescript
 * const event = createUpcomingEvent(3);
 * // Returns: { start: 1705491000, end: 1705494600 }
 * // Event in 3 days, 1 hour duration
 * ```
 */
export function createUpcomingEvent(daysFromNow: number): { start: number; end: number } {
  const startDate = createDate(daysFromNow);
  const endDate = new Date(startDate.getTime() + (60 * 60 * 1000)); // 1 hour duration
  
  return {
    start: Math.floor(startDate.getTime() / 1000),
    end: Math.floor(endDate.getTime() / 1000),
  };
}

// Global vi mock (provided by Vitest in test environment)
declare const vi: {
  setSystemTime: (date: Date) => void;
  useRealTimers: () => void;
};
