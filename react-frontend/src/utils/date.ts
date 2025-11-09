/**
 * Date formatting and manipulation utility functions
 *
 * This module provides comprehensive date and time utilities using the date-fns library.
 * All functions handle edge cases, timezone considerations, and provide consistent
 * formatting across the application.
 *
 * Key features:
 * - Date formatting with multiple preset formats
 * - Relative time calculations (e.g., "2 hours ago", "in 3 days")
 * - Date parsing and validation
 * - Duration calculations
 * - Date comparison utilities
 * - Start/end of day calculations
 * - Date arithmetic operations
 *
 * All date formatting follows date-fns patterns which are compatible with Unicode
 * Technical Standard #35. See: https://date-fns.org/docs/format
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {
  format,
  formatDistanceToNow,
  parseISO,
  isValid,
  startOfDay as dateFnsStartOfDay,
  endOfDay as dateFnsEndOfDay,
  addDays as dateFnsAddDays,
  differenceInDays as dateFnsDifferenceInDays,
  isToday as dateFnsIsToday,
  isPast as dateFnsIsPast,
  isFuture as dateFnsIsFuture,
} from 'date-fns';

import {
  DATE_FORMAT_SHORT,
  DATE_FORMAT_LONG,
  DATETIME_FORMAT,
  TIME_FORMAT,
} from './constants';

// ============================================================================
// Format Constants Re-exports
// ============================================================================

/**
 * Short date format for display (e.g., "12/31/2024")
 * Compatible with date-fns format function
 */
export { DATE_FORMAT_SHORT };

/**
 * Long date format for display (e.g., "December 31, 2024")
 * Compatible with date-fns format function
 */
export { DATE_FORMAT_LONG };

/**
 * Date and time format for display (e.g., "12/31/2024 3:45 PM")
 * Compatible with date-fns format function
 */
export { DATETIME_FORMAT };

/**
 * Time-only format for display (e.g., "3:45 PM")
 * Compatible with date-fns format function
 */
export { TIME_FORMAT };

// ============================================================================
// Date Formatting Functions
// ============================================================================

/**
 * Format a date using a specified or default format pattern
 *
 * This is the primary date formatting function. It accepts both Date objects
 * and Unix timestamps (in milliseconds), making it flexible for various use cases.
 *
 * @param date - Date object or Unix timestamp in milliseconds
 * @param formatPattern - Optional format pattern (defaults to DATE_FORMAT_SHORT)
 *                        Uses date-fns format tokens (see https://date-fns.org/docs/format)
 * @returns Formatted date string
 * @throws TypeError if date is invalid or null
 *
 * @example
 * formatDate(new Date('2024-12-31')) // "12/31/2024"
 * formatDate(1704067200000) // "12/31/2024"
 * formatDate(new Date(), 'yyyy-MM-dd') // "2024-12-31"
 * formatDate(new Date(), DATE_FORMAT_LONG) // "December 31, 2024"
 */
export function formatDate(
  date: Date | number,
  formatPattern: string = DATE_FORMAT_SHORT
): string {
  if (date === null || date === undefined) {
    throw new TypeError('Date parameter cannot be null or undefined');
  }

  const dateObj = typeof date === 'number' ? new Date(date) : date;

  if (!isValid(dateObj)) {
    throw new TypeError('Invalid date provided');
  }

  try {
    return format(dateObj, formatPattern);
  } catch (error) {
    // Handle invalid format patterns gracefully
    console.error('Invalid date format pattern:', formatPattern, error);
    return format(dateObj, DATE_FORMAT_SHORT);
  }
}

/**
 * Format a date with time using the standard datetime format
 *
 * Convenience function for displaying both date and time components.
 * Uses the DATETIME_FORMAT constant for consistency.
 *
 * @param date - Date object or Unix timestamp in milliseconds
 * @returns Formatted datetime string (e.g., "12/31/2024 3:45 PM")
 * @throws TypeError if date is invalid or null
 *
 * @example
 * formatDateTime(new Date('2024-12-31T15:45:00')) // "12/31/2024 3:45 PM"
 * formatDateTime(1704067500000) // "12/31/2024 3:45 PM"
 */
export function formatDateTime(date: Date | number): string {
  return formatDate(date, DATETIME_FORMAT);
}

/**
 * Format only the time component of a date
 *
 * Extracts and formats just the time portion, useful for showing
 * times without dates (e.g., quiz start times, deadline times).
 *
 * @param date - Date object or Unix timestamp in milliseconds
 * @returns Formatted time string (e.g., "3:45 PM")
 * @throws TypeError if date is invalid or null
 *
 * @example
 * formatTime(new Date('2024-12-31T15:45:00')) // "3:45 PM"
 * formatTime(1704067500000) // "3:45 PM"
 */
export function formatTime(date: Date | number): string {
  return formatDate(date, TIME_FORMAT);
}

/**
 * Format a date as a relative time string
 *
 * Displays how long ago (or how soon) a date is relative to the current time.
 * Useful for showing submission times, post dates, and upcoming deadlines.
 *
 * @param date - Date object or Unix timestamp in milliseconds
 * @returns Relative time string (e.g., "2 hours ago", "in 3 days")
 * @throws TypeError if date is invalid or null
 *
 * @example
 * // If current time is 2024-12-31 15:45:00
 * formatRelativeTime(new Date('2024-12-31T13:45:00')) // "2 hours ago"
 * formatRelativeTime(new Date('2025-01-03T15:45:00')) // "in 3 days"
 * formatRelativeTime(new Date('2024-12-31T15:40:00')) // "5 minutes ago"
 */
export function formatRelativeTime(date: Date | number): string {
  if (date === null || date === undefined) {
    throw new TypeError('Date parameter cannot be null or undefined');
  }

  const dateObj = typeof date === 'number' ? new Date(date) : date;

  if (!isValid(dateObj)) {
    throw new TypeError('Invalid date provided');
  }

  try {
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'Invalid date';
  }
}

// ============================================================================
// Date Parsing and Validation Functions
// ============================================================================

/**
 * Parse a date string into a Date object
 *
 * Safely parses ISO 8601 date strings and returns null for invalid inputs
 * instead of throwing errors. This makes it suitable for user input validation.
 *
 * Supports formats:
 * - ISO 8601: "2024-12-31T15:45:00Z"
 * - ISO date: "2024-12-31"
 * - ISO datetime with offset: "2024-12-31T15:45:00+00:00"
 *
 * @param dateString - ISO 8601 formatted date string
 * @returns Date object if valid, null if invalid
 *
 * @example
 * parseDate('2024-12-31T15:45:00Z') // Date object
 * parseDate('2024-12-31') // Date object
 * parseDate('invalid') // null
 * parseDate('') // null
 */
export function parseDate(dateString: string): Date | null {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  try {
    const parsed = parseISO(dateString);
    return isValid(parsed) ? parsed : null;
  } catch (error) {
    console.error('Error parsing date string:', dateString, error);
    return null;
  }
}

/**
 * Validate if a value is a valid Date object
 *
 * Type guard function that checks if a value is a Date object and
 * represents a valid date (not Invalid Date).
 *
 * @param date - Value to check
 * @returns True if valid Date object, false otherwise
 *
 * @example
 * isValidDate(new Date()) // true
 * isValidDate(new Date('2024-12-31')) // true
 * isValidDate(new Date('invalid')) // false
 * isValidDate('2024-12-31') // false
 * isValidDate(null) // false
 * isValidDate(undefined) // false
 * isValidDate(1704067200000) // false (number, not Date object)
 */
export function isValidDate(date: any): date is Date {
  return date instanceof Date && isValid(date);
}

// ============================================================================
// Duration Formatting Function
// ============================================================================

/**
 * Format a duration in seconds to a human-readable string
 *
 * Converts a duration in seconds to a formatted string showing hours,
 * minutes, and seconds. Useful for displaying video durations, quiz time
 * limits, and time spent on activities.
 *
 * Output format:
 * - >= 1 hour: "X hours Y minutes"
 * - >= 1 minute: "X minutes Y seconds"
 * - < 1 minute: "X seconds"
 *
 * @param seconds - Duration in seconds (must be non-negative)
 * @returns Human-readable duration string
 * @throws RangeError if seconds is negative
 *
 * @example
 * formatDuration(0) // "0 seconds"
 * formatDuration(45) // "45 seconds"
 * formatDuration(90) // "1 minute 30 seconds"
 * formatDuration(150) // "2 minutes 30 seconds"
 * formatDuration(3661) // "1 hour 1 minute"
 * formatDuration(7200) // "2 hours 0 minutes"
 * formatDuration(7322) // "2 hours 2 minutes"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) {
    throw new RangeError('Duration cannot be negative');
  }

  if (seconds === 0) {
    return '0 seconds';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }

  // Only show seconds if no hours are present
  if (hours === 0 && remainingSeconds > 0) {
    parts.push(`${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'}`);
  }

  return parts.join(' ');
}

// ============================================================================
// Date Manipulation Functions
// ============================================================================

/**
 * Get the start of day (midnight) for a given date
 *
 * Returns a new Date object set to 00:00:00.000 of the specified date.
 * Useful for date range queries and filtering events by day.
 *
 * @param date - Date object to process
 * @returns New Date object at start of day (midnight)
 * @throws TypeError if date is invalid or null
 *
 * @example
 * const date = new Date('2024-12-31T15:45:30');
 * getStartOfDay(date) // Date object: 2024-12-31T00:00:00.000
 */
export function getStartOfDay(date: Date): Date {
  if (!isValidDate(date)) {
    throw new TypeError('Invalid date provided');
  }

  return dateFnsStartOfDay(date);
}

/**
 * Get the end of day (23:59:59.999) for a given date
 *
 * Returns a new Date object set to 23:59:59.999 of the specified date.
 * Useful for date range queries that should include the entire day.
 *
 * @param date - Date object to process
 * @returns New Date object at end of day (23:59:59.999)
 * @throws TypeError if date is invalid or null
 *
 * @example
 * const date = new Date('2024-12-31T15:45:30');
 * getEndOfDay(date) // Date object: 2024-12-31T23:59:59.999
 */
export function getEndOfDay(date: Date): Date {
  if (!isValidDate(date)) {
    throw new TypeError('Invalid date provided');
  }

  return dateFnsEndOfDay(date);
}

/**
 * Add a specified number of days to a date
 *
 * Returns a new Date object with the specified number of days added.
 * Accepts both positive (future) and negative (past) day values.
 *
 * @param date - Date object to modify
 * @param days - Number of days to add (can be negative)
 * @returns New Date object with days added
 * @throws TypeError if date is invalid or null
 *
 * @example
 * const date = new Date('2024-12-31');
 * addDays(date, 1) // Date object: 2025-01-01
 * addDays(date, -1) // Date object: 2024-12-30
 * addDays(date, 0) // Date object: 2024-12-31 (unchanged)
 * addDays(date, 7) // Date object: 2025-01-07
 */
export function addDays(date: Date, days: number): Date {
  if (!isValidDate(date)) {
    throw new TypeError('Invalid date provided');
  }

  if (!Number.isFinite(days)) {
    throw new TypeError('Days parameter must be a finite number');
  }

  return dateFnsAddDays(date, days);
}

// ============================================================================
// Date Comparison Functions
// ============================================================================

/**
 * Calculate the difference in days between two dates
 *
 * Returns the number of full days between two dates. The result is positive
 * if dateLeft is later than dateRight, negative if earlier.
 *
 * @param dateLeft - First date
 * @param dateRight - Second date
 * @returns Number of days difference (can be negative)
 * @throws TypeError if either date is invalid or null
 *
 * @example
 * const date1 = new Date('2024-12-31');
 * const date2 = new Date('2025-01-03');
 * differenceInDays(date2, date1) // 3
 * differenceInDays(date1, date2) // -3
 * differenceInDays(date1, date1) // 0
 */
export function differenceInDays(dateLeft: Date, dateRight: Date): number {
  if (!isValidDate(dateLeft)) {
    throw new TypeError('Invalid dateLeft provided');
  }

  if (!isValidDate(dateRight)) {
    throw new TypeError('Invalid dateRight provided');
  }

  return dateFnsDifferenceInDays(dateLeft, dateRight);
}

/**
 * Check if a date is today
 *
 * Compares the date portion (ignoring time) to determine if it's the same
 * calendar day as today.
 *
 * @param date - Date object to check
 * @returns True if date is today, false otherwise
 * @throws TypeError if date is invalid or null
 *
 * @example
 * isToday(new Date()) // true
 * isToday(new Date('2024-12-31')) // false (unless today is Dec 31, 2024)
 * isToday(addDays(new Date(), -1)) // false (yesterday)
 */
export function isToday(date: Date): boolean {
  if (!isValidDate(date)) {
    throw new TypeError('Invalid date provided');
  }

  return dateFnsIsToday(date);
}

/**
 * Check if a date is in the past
 *
 * Compares the date to the current time. Returns true if the date
 * represents any moment before right now.
 *
 * @param date - Date object to check
 * @returns True if date is in the past, false otherwise
 * @throws TypeError if date is invalid or null
 *
 * @example
 * isPast(new Date('2020-01-01')) // true
 * isPast(new Date('2099-12-31')) // false
 * isPast(addDays(new Date(), -1)) // true (yesterday)
 */
export function isPast(date: Date): boolean {
  if (!isValidDate(date)) {
    throw new TypeError('Invalid date provided');
  }

  return dateFnsIsPast(date);
}

/**
 * Check if a date is in the future
 *
 * Compares the date to the current time. Returns true if the date
 * represents any moment after right now. Useful for identifying upcoming
 * deadlines, scheduled events, and future quiz availability.
 *
 * @param date - Date object to check
 * @returns True if date is in the future, false otherwise
 * @throws TypeError if date is invalid or null
 *
 * @example
 * isFuture(new Date('2099-12-31')) // true
 * isFuture(new Date('2020-01-01')) // false
 * isFuture(addDays(new Date(), 1)) // true (tomorrow)
 */
export function isFuture(date: Date): boolean {
  if (!isValidDate(date)) {
    throw new TypeError('Invalid date provided');
  }

  return dateFnsIsFuture(date);
}
