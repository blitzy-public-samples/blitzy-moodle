/**
 * Unit tests for date utility functions
 *
 * This test suite validates all date formatting, parsing, manipulation, and
 * comparison functions. Tests cover:
 * - Date formatting with various format strings and inputs
 * - Relative time display ("2 hours ago", "in 3 days")
 * - Date parsing from ISO strings
 * - Date validation for various input types
 * - Duration formatting (seconds to human-readable)
 * - Date arithmetic operations (add/subtract days)
 * - Date comparison functions (past, future, today)
 * - Edge cases and error handling
 *
 * All time-dependent tests use vi.setSystemTime() for deterministic results.
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

 

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatRelativeTime,
  parseDate,
  isValidDate,
  formatDuration,
  getStartOfDay,
  getEndOfDay,
  addDays,
  differenceInDays,
  isToday,
  isPast,
  isFuture,
  DATE_FORMAT_SHORT,
  DATE_FORMAT_LONG,
  DATETIME_FORMAT,
  TIME_FORMAT,
} from '@/utils/date';

describe('date utilities', () => {
  // Mock current time for consistent tests
  // Set to Monday, January 15, 2024, 12:00:00 PM UTC
  const MOCK_NOW = new Date('2024-01-15T12:00:00.000Z');

  beforeEach(() => {
    // Set system time to a fixed point for deterministic testing
    vi.setSystemTime(MOCK_NOW);
  });

  afterEach(() => {
    // Restore real time after each test
    vi.useRealTimers();
  });

  // ============================================================================
  // formatDate Tests
  // ============================================================================

  describe('formatDate', () => {
    it('should format date with default format (MM/dd/yyyy)', () => {
      const date = new Date('2024-12-31T15:45:00Z');
      const result = formatDate(date);
      expect(result).toBe('12/31/2024');
    });

    it('should format date with custom format string (yyyy-MM-dd)', () => {
      const date = new Date('2024-12-31T15:45:00Z');
      const result = formatDate(date, 'yyyy-MM-dd');
      expect(result).toBe('2024-12-31');
    });

    it('should format date with long format', () => {
      const date = new Date('2024-12-31T15:45:00Z');
      const result = formatDate(date, DATE_FORMAT_LONG);
      expect(result).toBe('December 31, 2024');
    });

    it('should accept Unix timestamp (number) as input', () => {
      // December 31, 2024 at 15:45:00 UTC
      const timestamp = new Date('2024-12-31T15:45:00Z').getTime();
      const result = formatDate(timestamp);
      expect(result).toBe('12/31/2024');
    });

    it('should format date with various custom patterns', () => {
      const date = new Date('2024-12-31T15:45:30Z');
      
      expect(formatDate(date, 'yyyy')).toBe('2024');
      expect(formatDate(date, 'MM')).toBe('12');
      expect(formatDate(date, 'dd')).toBe('31');
      expect(formatDate(date, 'MMM')).toBe('Dec');
      expect(formatDate(date, 'MMMM')).toBe('December');
    });

    it('should throw TypeError for null date', () => {
      expect(() => formatDate(null as any)).toThrow(TypeError);
      expect(() => formatDate(null as any)).toThrow('Date parameter cannot be null or undefined');
    });

    it('should throw TypeError for undefined date', () => {
      expect(() => formatDate(undefined as any)).toThrow(TypeError);
      expect(() => formatDate(undefined as any)).toThrow('Date parameter cannot be null or undefined');
    });

    it('should throw TypeError for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => formatDate(invalidDate)).toThrow(TypeError);
      expect(() => formatDate(invalidDate)).toThrow('Invalid date provided');
    });

    it('should handle invalid format pattern gracefully', () => {
      const date = new Date('2024-12-31T15:45:00Z');
      // Invalid format pattern should fall back to default
      const result = formatDate(date, 'invalid-pattern-###');
      // Should still return a formatted date (fallback to DATE_FORMAT_SHORT)
      expect(result).toBe('12/31/2024');
    });

    it('should format dates at year boundaries', () => {
      const endOfYear = new Date('2024-12-31T23:59:59Z');
      const startOfYear = new Date('2024-01-01T00:00:00Z');
      
      expect(formatDate(endOfYear)).toBe('12/31/2024');
      expect(formatDate(startOfYear)).toBe('01/01/2024');
    });

    it('should handle leap year dates', () => {
      const leapDay = new Date('2024-02-29T12:00:00Z');
      expect(formatDate(leapDay)).toBe('02/29/2024');
    });
  });

  // ============================================================================
  // formatDateTime Tests
  // ============================================================================

  describe('formatDateTime', () => {
    it('should format date and time together', () => {
      const date = new Date('2024-12-31T15:45:00Z');
      const result = formatDateTime(date);
      // Format: MM/dd/yyyy h:mm a
      expect(result).toMatch(/12\/31\/2024 \d{1,2}:\d{2} [AP]M/);
    });

    it('should accept Unix timestamp', () => {
      const timestamp = new Date('2024-12-31T15:45:00Z').getTime();
      const result = formatDateTime(timestamp);
      expect(result).toMatch(/12\/31\/2024 \d{1,2}:\d{2} [AP]M/);
    });

    it('should format past date correctly', () => {
      const pastDate = new Date('2020-06-15T09:30:00Z');
      const result = formatDateTime(pastDate);
      expect(result).toMatch(/06\/15\/2020 \d{1,2}:\d{2} [AP]M/);
    });

    it('should format future date correctly', () => {
      const futureDate = new Date('2025-03-20T18:20:00Z');
      const result = formatDateTime(futureDate);
      expect(result).toMatch(/03\/20\/2025 \d{1,2}:\d{2} [AP]M/);
    });

    it('should throw TypeError for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => formatDateTime(invalidDate)).toThrow(TypeError);
    });
  });

  // ============================================================================
  // formatTime Tests
  // ============================================================================

  describe('formatTime', () => {
    it('should format time only', () => {
      const date = new Date('2024-12-31T15:45:00Z');
      const result = formatTime(date);
      // Format: h:mm a (e.g., "3:45 PM")
      expect(result).toMatch(/\d{1,2}:\d{2} [AP]M/);
    });

    it('should handle midnight (00:00)', () => {
      const midnight = new Date('2024-01-15T00:00:00Z');
      const result = formatTime(midnight);
      expect(result).toMatch(/12:00 AM/);
    });

    it('should handle noon (12:00)', () => {
      const noon = new Date('2024-01-15T12:00:00Z');
      const result = formatTime(noon);
      expect(result).toMatch(/12:00 PM/);
    });

    it('should format morning time correctly', () => {
      const morning = new Date('2024-01-15T09:30:00Z');
      const result = formatTime(morning);
      expect(result).toMatch(/\d{1,2}:30 AM/);
    });

    it('should format evening time correctly', () => {
      const evening = new Date('2024-01-15T18:15:00Z');
      const result = formatTime(evening);
      expect(result).toMatch(/\d{1,2}:15 PM/);
    });

    it('should accept Unix timestamp', () => {
      const timestamp = new Date('2024-01-15T15:45:00Z').getTime();
      const result = formatTime(timestamp);
      expect(result).toMatch(/\d{1,2}:45 [AP]M/);
    });

    it('should throw TypeError for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => formatTime(invalidDate)).toThrow(TypeError);
    });
  });

  // ============================================================================
  // formatRelativeTime Tests
  // ============================================================================

  describe('formatRelativeTime', () => {
    it('should display "less than a minute ago" for very recent times', () => {
      // 30 seconds ago
      const recentDate = new Date(MOCK_NOW.getTime() - 30 * 1000);
      const result = formatRelativeTime(recentDate);
      // date-fns formatDistanceToNow returns "1 minute ago" for ~30 seconds
      expect(result).toMatch(/\d+ minutes? ago/i);
    });

    it('should display "X minutes ago" for recent past', () => {
      // 5 minutes ago
      const minutesAgo = new Date(MOCK_NOW.getTime() - 5 * 60 * 1000);
      const result = formatRelativeTime(minutesAgo);
      expect(result).toMatch(/\d+ minutes? ago/i);
    });

    it('should display "X hours ago" for hours in the past', () => {
      // 2 hours ago
      const hoursAgo = new Date(MOCK_NOW.getTime() - 2 * 60 * 60 * 1000);
      const result = formatRelativeTime(hoursAgo);
      expect(result).toMatch(/\d+ hours? ago/i);
    });

    it('should display "X days ago" for days in the past', () => {
      // 3 days ago
      const daysAgo = new Date(MOCK_NOW.getTime() - 3 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(daysAgo);
      expect(result).toMatch(/\d+ days? ago/i);
    });

    it('should display "in X minutes" for near future', () => {
      // 10 minutes from now
      const futureMinutes = new Date(MOCK_NOW.getTime() + 10 * 60 * 1000);
      const result = formatRelativeTime(futureMinutes);
      expect(result).toMatch(/in \d+ minutes?/i);
    });

    it('should display "in X hours" for future hours', () => {
      // 4 hours from now
      const futureHours = new Date(MOCK_NOW.getTime() + 4 * 60 * 60 * 1000);
      const result = formatRelativeTime(futureHours);
      // date-fns may include "about" in the output
      expect(result).toMatch(/in (about )?\d+ hours?/i);
    });

    it('should display "in X days" for future days', () => {
      // 5 days from now
      const futureDays = new Date(MOCK_NOW.getTime() + 5 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(futureDays);
      expect(result).toMatch(/in \d+ days?/i);
    });

    it('should display months for distant past', () => {
      // 3 months ago
      const monthsAgo = new Date(MOCK_NOW.getTime() - 90 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(monthsAgo);
      expect(result).toMatch(/\d+ months? ago/i);
    });

    it('should display years for very distant past', () => {
      // 2 years ago
      const yearsAgo = new Date(MOCK_NOW.getTime() - 730 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(yearsAgo);
      expect(result).toMatch(/\d+ years? ago/i);
    });

    it('should accept Unix timestamp', () => {
      const timestamp = MOCK_NOW.getTime() - 30 * 60 * 1000; // 30 minutes ago
      const result = formatRelativeTime(timestamp);
      expect(result).toMatch(/\d+ minutes? ago/i);
    });

    it('should throw TypeError for null date', () => {
      expect(() => formatRelativeTime(null as any)).toThrow(TypeError);
      expect(() => formatRelativeTime(null as any)).toThrow('Date parameter cannot be null or undefined');
    });

    it('should throw TypeError for undefined date', () => {
      expect(() => formatRelativeTime(undefined as any)).toThrow(TypeError);
    });

    it('should throw TypeError for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => formatRelativeTime(invalidDate)).toThrow(TypeError);
      expect(() => formatRelativeTime(invalidDate)).toThrow('Invalid date provided');
    });
  });

  // ============================================================================
  // parseDate Tests
  // ============================================================================

  describe('parseDate', () => {
    it('should parse valid ISO 8601 date string', () => {
      const result = parseDate('2024-12-31T15:45:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(11); // December is month 11 (0-indexed)
      expect(result?.getDate()).toBe(31);
    });

    it('should parse ISO date without time', () => {
      const result = parseDate('2024-12-31');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(11);
      expect(result?.getDate()).toBe(31);
    });

    it('should parse ISO datetime with timezone offset', () => {
      const result = parseDate('2024-12-31T15:45:00+00:00');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
    });

    it('should return null for invalid date string', () => {
      const result = parseDate('invalid-date');
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = parseDate('');
      expect(result).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(parseDate(null as any)).toBeNull();
      expect(parseDate(undefined as any)).toBeNull();
      expect(parseDate(123 as any)).toBeNull();
      expect(parseDate({} as any)).toBeNull();
    });

    it('should parse dates at year boundaries', () => {
      const endOfYear = parseDate('2024-12-31T23:59:59Z');
      const startOfYear = parseDate('2024-01-01T00:00:00Z');
      
      expect(endOfYear).toBeInstanceOf(Date);
      expect(startOfYear).toBeInstanceOf(Date);
      expect(endOfYear?.getDate()).toBe(31);
      expect(startOfYear?.getDate()).toBe(1);
    });

    it('should parse leap year dates', () => {
      const leapDay = parseDate('2024-02-29');
      expect(leapDay).toBeInstanceOf(Date);
      expect(leapDay?.getMonth()).toBe(1); // February is month 1
      expect(leapDay?.getDate()).toBe(29);
    });

    it('should return null for invalid leap year date', () => {
      // 2023 was not a leap year
      const invalidLeapDay = parseDate('2023-02-29');
      expect(invalidLeapDay).toBeNull();
    });
  });

  // ============================================================================
  // isValidDate Tests
  // ============================================================================

  describe('isValidDate', () => {
    it('should return true for valid Date object', () => {
      const validDate = new Date('2024-12-31');
      expect(isValidDate(validDate)).toBe(true);
    });

    it('should return true for Date created from timestamp', () => {
      const validDate = new Date(1704067200000);
      expect(isValidDate(validDate)).toBe(true);
    });

    it('should return true for current date', () => {
      const now = new Date();
      expect(isValidDate(now)).toBe(true);
    });

    it('should return false for invalid Date object', () => {
      const invalidDate = new Date('invalid');
      expect(isValidDate(invalidDate)).toBe(false);
    });

    it('should return false for date string (not Date object)', () => {
      expect(isValidDate('2024-12-31')).toBe(false);
    });

    it('should return false for Unix timestamp number', () => {
      expect(isValidDate(1704067200000)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidDate(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidDate(undefined)).toBe(false);
    });

    it('should return false for boolean', () => {
      expect(isValidDate(true)).toBe(false);
      expect(isValidDate(false)).toBe(false);
    });

    it('should return false for plain object', () => {
      expect(isValidDate({})).toBe(false);
      expect(isValidDate({ date: '2024-12-31' })).toBe(false);
    });

    it('should return false for array', () => {
      expect(isValidDate([])).toBe(false);
      expect(isValidDate([2024, 12, 31])).toBe(false);
    });
  });

  // ============================================================================
  // formatDuration Tests
  // ============================================================================

  describe('formatDuration', () => {
    it('should format zero seconds', () => {
      expect(formatDuration(0)).toBe('0 seconds');
    });

    it('should format seconds only (< 60 seconds)', () => {
      expect(formatDuration(1)).toBe('1 second');
      expect(formatDuration(45)).toBe('45 seconds');
      expect(formatDuration(59)).toBe('59 seconds');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(60)).toBe('1 minute');
      expect(formatDuration(90)).toBe('1 minute 30 seconds');
      expect(formatDuration(150)).toBe('2 minutes 30 seconds');
      expect(formatDuration(125)).toBe('2 minutes 5 seconds');
    });

    it('should format hours and minutes (without seconds)', () => {
      // Implementation omits "0 minutes" when there are no minutes
      expect(formatDuration(3600)).toBe('1 hour');
      expect(formatDuration(3660)).toBe('1 hour 1 minute');
      expect(formatDuration(3720)).toBe('1 hour 2 minutes');
      expect(formatDuration(7200)).toBe('2 hours');
      expect(formatDuration(7322)).toBe('2 hours 2 minutes');
    });

    it('should format large durations', () => {
      // 25 hours - implementation omits "0 minutes"
      expect(formatDuration(90000)).toBe('25 hours');
      // 2 days in seconds (48 hours) - implementation omits "0 minutes"
      expect(formatDuration(172800)).toBe('48 hours');
    });

    it('should handle edge case: exactly 1 minute', () => {
      expect(formatDuration(60)).toBe('1 minute');
    });

    it('should handle edge case: exactly 1 hour', () => {
      // Implementation omits "0 minutes" when there are no minutes
      expect(formatDuration(3600)).toBe('1 hour');
    });

    it('should not display seconds when hours are present', () => {
      // 1 hour, 2 minutes, 30 seconds
      const result = formatDuration(3750);
      expect(result).toBe('1 hour 2 minutes');
      expect(result).not.toContain('seconds');
    });

    it('should throw RangeError for negative seconds', () => {
      expect(() => formatDuration(-1)).toThrow(RangeError);
      expect(() => formatDuration(-1)).toThrow('Duration cannot be negative');
      expect(() => formatDuration(-100)).toThrow(RangeError);
    });

    it('should handle fractional seconds by flooring', () => {
      expect(formatDuration(45.7)).toBe('45 seconds');
      expect(formatDuration(90.9)).toBe('1 minute 30 seconds');
    });
  });

  // ============================================================================
  // getStartOfDay Tests
  // ============================================================================

  describe('getStartOfDay', () => {
    it('should return date with time set to 00:00:00.000', () => {
      const date = new Date('2024-12-31T15:45:30.500Z');
      const result = getStartOfDay(date);
      
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should not modify original date', () => {
      const original = new Date('2024-12-31T15:45:30Z');
      const originalTime = original.getTime();
      
      getStartOfDay(original);
      
      // Original should be unchanged
      expect(original.getTime()).toBe(originalTime);
    });

    it('should preserve the date portion', () => {
      const date = new Date('2024-12-31T15:45:30Z');
      const result = getStartOfDay(date);
      
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getDate()).toBe(31);
    });

    it('should handle dates already at start of day', () => {
      const midnight = new Date('2024-12-31T00:00:00.000Z');
      const result = getStartOfDay(midnight);
      
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it('should throw TypeError for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => getStartOfDay(invalidDate)).toThrow(TypeError);
      expect(() => getStartOfDay(invalidDate)).toThrow('Invalid date provided');
    });

    it('should throw TypeError for null', () => {
      expect(() => getStartOfDay(null as any)).toThrow(TypeError);
    });
  });

  // ============================================================================
  // getEndOfDay Tests
  // ============================================================================

  describe('getEndOfDay', () => {
    it('should return date with time set to 23:59:59.999', () => {
      const date = new Date('2024-12-31T15:45:30Z');
      const result = getEndOfDay(date);
      
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });

    it('should not modify original date', () => {
      const original = new Date('2024-12-31T15:45:30Z');
      const originalTime = original.getTime();
      
      getEndOfDay(original);
      
      // Original should be unchanged
      expect(original.getTime()).toBe(originalTime);
    });

    it('should preserve the date portion', () => {
      const date = new Date('2024-12-31T15:45:30Z');
      const result = getEndOfDay(date);
      
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getDate()).toBe(31);
    });

    it('should handle dates already at end of day', () => {
      const endOfDay = new Date('2024-12-31T23:59:59.999Z');
      const result = getEndOfDay(endOfDay);
      
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });

    it('should throw TypeError for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => getEndOfDay(invalidDate)).toThrow(TypeError);
      expect(() => getEndOfDay(invalidDate)).toThrow('Invalid date provided');
    });

    it('should throw TypeError for null', () => {
      expect(() => getEndOfDay(null as any)).toThrow(TypeError);
    });
  });

  // ============================================================================
  // addDays Tests
  // ============================================================================

  describe('addDays', () => {
    it('should add positive days to date', () => {
      const date = new Date('2024-12-31T12:00:00Z');
      const result = addDays(date, 1);
      
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(1);
    });

    it('should subtract days with negative value', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const result = addDays(date, -1);
      
      expect(result.getFullYear()).toBe(2023);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getDate()).toBe(31);
    });

    it('should return same date when adding zero days', () => {
      const date = new Date('2024-06-15T12:00:00Z');
      const result = addDays(date, 0);
      
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(5); // June
      expect(result.getDate()).toBe(15);
    });

    it('should handle month boundary crossing', () => {
      const date = new Date('2024-01-30T12:00:00Z');
      const result = addDays(date, 5);
      
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(4);
    });

    it('should handle year boundary crossing forward', () => {
      const date = new Date('2024-12-30T12:00:00Z');
      const result = addDays(date, 5);
      
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(4);
    });

    it('should handle year boundary crossing backward', () => {
      const date = new Date('2024-01-02T12:00:00Z');
      const result = addDays(date, -5);
      
      expect(result.getFullYear()).toBe(2023);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getDate()).toBe(28);
    });

    it('should not modify original date', () => {
      const original = new Date('2024-06-15T12:00:00Z');
      const originalTime = original.getTime();
      
      addDays(original, 7);
      
      // Original should be unchanged
      expect(original.getTime()).toBe(originalTime);
    });

    it('should add large number of days', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const result = addDays(date, 365);
      
      expect(result.getFullYear()).toBe(2024); // Leap year, so still 2024
      expect(result.getMonth()).toBe(11); // December
      expect(result.getDate()).toBe(31);
    });

    it('should handle leap year edge case', () => {
      const date = new Date('2024-02-28T12:00:00Z');
      const result = addDays(date, 1);
      
      // 2024 is a leap year, so Feb 29 exists
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(29);
    });

    it('should throw TypeError for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => addDays(invalidDate, 1)).toThrow(TypeError);
      expect(() => addDays(invalidDate, 1)).toThrow('Invalid date provided');
    });

    it('should throw TypeError for non-finite days parameter', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(() => addDays(date, NaN)).toThrow(TypeError);
      expect(() => addDays(date, NaN)).toThrow('Days parameter must be a finite number');
      expect(() => addDays(date, Infinity)).toThrow(TypeError);
    });
  });

  // ============================================================================
  // differenceInDays Tests
  // ============================================================================

  describe('differenceInDays', () => {
    it('should return positive difference when first date is later', () => {
      const date1 = new Date('2024-12-31T12:00:00Z');
      const date2 = new Date('2025-01-03T12:00:00Z');
      
      const result = differenceInDays(date2, date1);
      expect(result).toBe(3);
    });

    it('should return negative difference when first date is earlier', () => {
      const date1 = new Date('2024-12-31T12:00:00Z');
      const date2 = new Date('2025-01-03T12:00:00Z');
      
      const result = differenceInDays(date1, date2);
      expect(result).toBe(-3);
    });

    it('should return zero for same date', () => {
      const date1 = new Date('2024-12-31T12:00:00Z');
      const date2 = new Date('2024-12-31T15:00:00Z'); // Same day, different time
      
      const result = differenceInDays(date1, date2);
      expect(result).toBe(0);
    });

    it('should calculate large date differences', () => {
      const date1 = new Date('2024-01-01T12:00:00Z');
      const date2 = new Date('2024-12-31T12:00:00Z');
      
      const result = differenceInDays(date2, date1);
      expect(result).toBe(365); // 2024 is a leap year
    });

    it('should handle dates far apart', () => {
      const date1 = new Date('2020-01-01T12:00:00Z');
      const date2 = new Date('2024-01-01T12:00:00Z');
      
      const result = differenceInDays(date2, date1);
      expect(result).toBeGreaterThan(1460); // More than 4 years (including leap year)
    });

    it('should handle month boundary differences', () => {
      const date1 = new Date('2024-01-30T12:00:00Z');
      const date2 = new Date('2024-02-05T12:00:00Z');
      
      const result = differenceInDays(date2, date1);
      expect(result).toBe(6);
    });

    it('should handle year boundary differences', () => {
      const date1 = new Date('2023-12-30T12:00:00Z');
      const date2 = new Date('2024-01-03T12:00:00Z');
      
      const result = differenceInDays(date2, date1);
      expect(result).toBe(4);
    });

    it('should throw TypeError for invalid first date', () => {
      const validDate = new Date('2024-01-15T12:00:00Z');
      const invalidDate = new Date('invalid');
      
      expect(() => differenceInDays(invalidDate, validDate)).toThrow(TypeError);
      expect(() => differenceInDays(invalidDate, validDate)).toThrow('Invalid dateLeft provided');
    });

    it('should throw TypeError for invalid second date', () => {
      const validDate = new Date('2024-01-15T12:00:00Z');
      const invalidDate = new Date('invalid');
      
      expect(() => differenceInDays(validDate, invalidDate)).toThrow(TypeError);
      expect(() => differenceInDays(validDate, invalidDate)).toThrow('Invalid dateRight provided');
    });
  });

  // ============================================================================
  // isToday Tests
  // ============================================================================

  describe('isToday', () => {
    it('should return true for current date', () => {
      // MOCK_NOW is set to 2024-01-15T12:00:00Z
      const today = new Date('2024-01-15T12:00:00Z');
      expect(isToday(today)).toBe(true);
    });

    it('should return true for different time on same day', () => {
      const morningToday = new Date('2024-01-15T06:00:00Z');
      const eveningToday = new Date('2024-01-15T20:00:00Z');
      
      expect(isToday(morningToday)).toBe(true);
      expect(isToday(eveningToday)).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date('2024-01-14T12:00:00Z');
      expect(isToday(yesterday)).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date('2024-01-16T12:00:00Z');
      expect(isToday(tomorrow)).toBe(false);
    });

    it('should return false for dates far in the past', () => {
      const past = new Date('2020-01-15T12:00:00Z');
      expect(isToday(past)).toBe(false);
    });

    it('should return false for dates far in the future', () => {
      const future = new Date('2025-01-15T12:00:00Z');
      expect(isToday(future)).toBe(false);
    });

    it('should throw TypeError for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => isToday(invalidDate)).toThrow(TypeError);
      expect(() => isToday(invalidDate)).toThrow('Invalid date provided');
    });

    it('should throw TypeError for null', () => {
      expect(() => isToday(null as any)).toThrow(TypeError);
    });
  });

  // ============================================================================
  // isPast Tests
  // ============================================================================

  describe('isPast', () => {
    it('should return true for past date', () => {
      // MOCK_NOW is 2024-01-15T12:00:00Z
      const past = new Date('2020-01-01T12:00:00Z');
      expect(isPast(past)).toBe(true);
    });

    it('should return true for yesterday', () => {
      const yesterday = new Date('2024-01-14T12:00:00Z');
      expect(isPast(yesterday)).toBe(true);
    });

    it('should return true for one second ago', () => {
      const justPast = new Date(MOCK_NOW.getTime() - 1000);
      expect(isPast(justPast)).toBe(true);
    });

    it('should return false for future date', () => {
      const future = new Date('2099-12-31T12:00:00Z');
      expect(isPast(future)).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date('2024-01-16T12:00:00Z');
      expect(isPast(tomorrow)).toBe(false);
    });

    it('should handle current moment as edge case', () => {
      // Current exact moment might be edge case
      // date-fns isPast returns false for exactly now
      const now = new Date(MOCK_NOW.getTime());
      expect(isPast(now)).toBe(false);
    });

    it('should throw TypeError for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => isPast(invalidDate)).toThrow(TypeError);
      expect(() => isPast(invalidDate)).toThrow('Invalid date provided');
    });

    it('should throw TypeError for null', () => {
      expect(() => isPast(null as any)).toThrow(TypeError);
    });
  });

  // ============================================================================
  // isFuture Tests
  // ============================================================================

  describe('isFuture', () => {
    it('should return true for future date', () => {
      // MOCK_NOW is 2024-01-15T12:00:00Z
      const future = new Date('2099-12-31T12:00:00Z');
      expect(isFuture(future)).toBe(true);
    });

    it('should return true for tomorrow', () => {
      const tomorrow = new Date('2024-01-16T12:00:00Z');
      expect(isFuture(tomorrow)).toBe(true);
    });

    it('should return true for one second from now', () => {
      const justFuture = new Date(MOCK_NOW.getTime() + 1000);
      expect(isFuture(justFuture)).toBe(true);
    });

    it('should return false for past date', () => {
      const past = new Date('2020-01-01T12:00:00Z');
      expect(isFuture(past)).toBe(false);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date('2024-01-14T12:00:00Z');
      expect(isFuture(yesterday)).toBe(false);
    });

    it('should handle current moment as edge case', () => {
      // Current exact moment might be edge case
      // date-fns isFuture returns false for exactly now
      const now = new Date(MOCK_NOW.getTime());
      expect(isFuture(now)).toBe(false);
    });

    it('should throw TypeError for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => isFuture(invalidDate)).toThrow(TypeError);
      expect(() => isFuture(invalidDate)).toThrow('Invalid date provided');
    });

    it('should throw TypeError for null', () => {
      expect(() => isFuture(null as any)).toThrow(TypeError);
    });
  });

  // ============================================================================
  // Format Constants Tests
  // ============================================================================

  describe('format constants', () => {
    it('should export DATE_FORMAT_SHORT', () => {
      expect(DATE_FORMAT_SHORT).toBe('MM/dd/yyyy');
    });

    it('should export DATE_FORMAT_LONG', () => {
      expect(DATE_FORMAT_LONG).toBe('MMMM dd, yyyy');
    });

    it('should export DATETIME_FORMAT', () => {
      expect(DATETIME_FORMAT).toBe('MM/dd/yyyy h:mm a');
    });

    it('should export TIME_FORMAT', () => {
      expect(TIME_FORMAT).toBe('h:mm a');
    });
  });
});
