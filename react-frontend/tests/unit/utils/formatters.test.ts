/**
 * Unit tests for formatters.ts utility file
 *
 * Comprehensive test suite validating data formatting functions for display including:
 * - formatNumber: thousands separators, decimals
 * - formatCurrency: locale-aware currency formatting
 * - formatFileSize: bytes to KB/MB/GB/TB conversion
 * - formatPercentage: percentage formatting with decimals
 * - formatGrade: grade out of max formatting
 * - formatUserName: first/last name order variations
 * - formatList: comma-separated lists with conjunctions
 * - formatPhoneNumber: phone number formatting
 * - formatDuration: seconds to human-readable time
 * - pluralize: singular/plural form handling
 * - abbreviateNumber: K, M, B notation
 * - formatBytes: custom decimal file size formatting
 *
 * Tests cover various numeric inputs, edge cases (zero, negative, very large numbers),
 * locale-specific formatting, decimal precision, and proper unit conversions.
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatCurrency,
  formatFileSize,
  formatPercentage,
  formatGrade,
  formatUserName,
  formatList,
  formatPhoneNumber,
  formatDuration,
  pluralize,
  abbreviateNumber,
  formatBytes,
} from '@/utils/formatters';

// ============================================================================
// Number Formatting Tests
// ============================================================================

describe('formatNumber', () => {
  it('should format whole numbers with thousands separators', () => {
    const result = formatNumber(1000);
    expect(result).toMatch(/1[,\s]000/); // Allow locale variations
  });

  it('should format numbers with decimal places', () => {
    const result = formatNumber(1234.5678, 2);
    expect(result).toMatch(/1[,\s]234[.,]57/); // Allow locale variations for separators
  });

  it('should format very large numbers', () => {
    const result = formatNumber(1234567890);
    expect(result).toMatch(/1[,\s]234[,\s]567[,\s]890/);
  });

  it('should format zero correctly', () => {
    const result = formatNumber(0);
    expect(result).toBe('0');
  });

  it('should format negative numbers', () => {
    const result = formatNumber(-1234, 0);
    expect(result).toMatch(/-1[,\s]234/);
  });

  it('should handle custom decimal places', () => {
    const result = formatNumber(100.123456, 3);
    expect(result).toMatch(/100[.,]123/);
  });

  it('should format very small decimals', () => {
    const result = formatNumber(0.0123, 4);
    expect(result).toMatch(/0[.,]0123/);
  });

  it('should throw TypeError for invalid input', () => {
    expect(() => formatNumber(NaN)).toThrow(TypeError);
    expect(() => formatNumber(Infinity)).toThrow(TypeError);
    expect(() => formatNumber(-Infinity)).toThrow(TypeError);
  });
});

// ============================================================================
// Currency Formatting Tests
// ============================================================================

describe('formatCurrency', () => {
  it('should format USD with default settings', () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain('1,234.56');
    expect(result).toMatch(/[$]|USD/); // May be $ or USD depending on locale
  });

  it('should format EUR currency', () => {
    const result = formatCurrency(1234.56, 'EUR');
    expect(result).toContain('1,234.56');
    expect(result).toMatch(/[€]|EUR/);
  });

  it('should format GBP currency', () => {
    const result = formatCurrency(1234.56, 'GBP');
    expect(result).toContain('1,234.56');
    expect(result).toMatch(/[£]|GBP/);
  });

  it('should handle custom decimal places', () => {
    const result = formatCurrency(1234.567, 'USD', 3);
    expect(result).toContain('1,234.567');
  });

  it('should format zero correctly', () => {
    const result = formatCurrency(0);
    expect(result).toMatch(/0[.,]00/);
  });

  it('should format negative values', () => {
    const result = formatCurrency(-100.50);
    expect(result).toMatch(/-|[(]/); // May use - or () for negative
    expect(result).toContain('100');
  });

  it('should format large amounts', () => {
    const result = formatCurrency(1000000);
    expect(result).toContain('1,000,000');
  });

  it('should throw TypeError for invalid input', () => {
    expect(() => formatCurrency(NaN)).toThrow(TypeError);
    expect(() => formatCurrency(Infinity)).toThrow(TypeError);
  });
});

// ============================================================================
// Percentage Formatting Tests
// ============================================================================

describe('formatPercentage', () => {
  it('should format decimal values as percentages', () => {
    const result = formatPercentage(0.5);
    expect(result).toBe('50%');
  });

  it('should format values already in percentage form', () => {
    const result = formatPercentage(85);
    expect(result).toBe('85%');
  });

  it('should handle decimal precision', () => {
    const result = formatPercentage(0.123, 1);
    expect(result).toMatch(/12[.,]3%/);
  });

  it('should format 100% correctly', () => {
    const result = formatPercentage(1);
    expect(result).toBe('100%');
  });

  it('should format 0% correctly', () => {
    const result = formatPercentage(0);
    expect(result).toBe('0%');
  });

  it('should handle values greater than 100%', () => {
    const result = formatPercentage(1.5);
    expect(result).toBe('150%');
  });

  it('should handle negative percentages', () => {
    const result = formatPercentage(-0.25);
    expect(result).toMatch(/-25%/);
  });

  it('should handle multiple decimal places', () => {
    const result = formatPercentage(0.8567, 2);
    expect(result).toMatch(/85[.,]67%/);
  });

  it('should throw TypeError for invalid input', () => {
    expect(() => formatPercentage(NaN)).toThrow(TypeError);
  });
});

// ============================================================================
// Grade Formatting Tests
// ============================================================================

describe('formatGrade', () => {
  it('should format full marks', () => {
    const result = formatGrade(100, 100);
    expect(result).toMatch(/100[.,]0\/100[.,]0/);
  });

  it('should format partial grades', () => {
    const result = formatGrade(75, 100);
    expect(result).toMatch(/75[.,]0\/100[.,]0/);
  });

  it('should format grades with decimal precision', () => {
    const result = formatGrade(87.5, 100, 1);
    expect(result).toMatch(/87[.,]5\/100[.,]0/);
  });

  it('should format zero grade', () => {
    const result = formatGrade(0, 100);
    expect(result).toMatch(/0[.,]0\/100[.,]0/);
  });

  it('should format grades with different max values', () => {
    const result = formatGrade(45, 50, 0);
    expect(result).toMatch(/45\/50/);
  });

  it('should format grades with custom decimals', () => {
    const result = formatGrade(95.678, 100, 2);
    expect(result).toMatch(/95[.,]68\/100[.,]00/);
  });

  it('should format grades out of non-100 max', () => {
    const result = formatGrade(17, 20, 0);
    expect(result).toMatch(/17\/20/);
  });

  it('should throw TypeError for invalid grade', () => {
    expect(() => formatGrade(NaN, 100)).toThrow(TypeError);
  });

  it('should throw TypeError for invalid maxGrade', () => {
    expect(() => formatGrade(50, 0)).toThrow(TypeError);
    expect(() => formatGrade(50, -100)).toThrow(TypeError);
    expect(() => formatGrade(50, NaN)).toThrow(TypeError);
  });
});

// ============================================================================
// Number Abbreviation Tests
// ============================================================================

describe('abbreviateNumber', () => {
  it('should not abbreviate numbers less than 1000', () => {
    expect(abbreviateNumber(999)).toBe('999');
    expect(abbreviateNumber(500)).toBe('500');
    expect(abbreviateNumber(0)).toBe('0');
  });

  it('should abbreviate thousands with K', () => {
    const result = abbreviateNumber(1500);
    expect(result).toMatch(/1[.,]5K/);
  });

  it('should abbreviate millions with M', () => {
    const result = abbreviateNumber(2500000);
    expect(result).toMatch(/2[.,]5M/);
  });

  it('should abbreviate billions with B', () => {
    const result = abbreviateNumber(3000000000);
    expect(result).toBe('3B');
  });

  it('should abbreviate trillions with T', () => {
    const result = abbreviateNumber(1500000000000);
    expect(result).toMatch(/1[.,]5T/);
  });

  it('should handle negative numbers', () => {
    const result = abbreviateNumber(-1500);
    expect(result).toMatch(/-1[.,]5K/);
  });

  it('should format large K values without decimals', () => {
    const result = abbreviateNumber(15000);
    expect(result).toBe('15K');
  });

  it('should format large M values without decimals', () => {
    const result = abbreviateNumber(25000000);
    expect(result).toBe('25M');
  });

  it('should throw TypeError for invalid input', () => {
    expect(() => abbreviateNumber(NaN)).toThrow(TypeError);
    expect(() => abbreviateNumber(Infinity)).toThrow(TypeError);
  });
});

// ============================================================================
// File Size Formatting Tests
// ============================================================================

describe('formatFileSize', () => {
  it('should format bytes correctly', () => {
    expect(formatFileSize(500)).toBe('500 Bytes');
  });

  it('should format kilobytes correctly', () => {
    const result = formatFileSize(1024);
    expect(result).toMatch(/1[.,]0 KB/);
  });

  it('should format fractional kilobytes', () => {
    const result = formatFileSize(1536);
    expect(result).toMatch(/1[.,]5 KB/);
  });

  it('should format megabytes correctly', () => {
    const result = formatFileSize(1048576);
    expect(result).toMatch(/1[.,]0 MB/);
  });

  it('should format fractional megabytes', () => {
    const result = formatFileSize(2621440);
    expect(result).toMatch(/2[.,]5 MB/);
  });

  it('should format gigabytes correctly', () => {
    const result = formatFileSize(1073741824);
    expect(result).toMatch(/1[.,]0 GB/);
  });

  it('should format terabytes correctly', () => {
    const result = formatFileSize(1099511627776);
    expect(result).toMatch(/1[.,]0 TB/);
  });

  it('should format zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
  });

  it('should throw RangeError for negative values', () => {
    expect(() => formatFileSize(-100)).toThrow(RangeError);
  });

  it('should throw TypeError for invalid input', () => {
    expect(() => formatFileSize(NaN)).toThrow(TypeError);
  });
});

// ============================================================================
// formatBytes Tests (with custom decimals)
// ============================================================================

describe('formatBytes', () => {
  it('should format bytes with custom decimals', () => {
    expect(formatBytes(500, 2)).toBe('500 Bytes');
  });

  it('should format kilobytes with 2 decimals', () => {
    const result = formatBytes(1536, 2);
    expect(result).toMatch(/1[.,]50 KB/);
  });

  it('should format megabytes with 1 decimal', () => {
    const result = formatBytes(2621440, 1);
    expect(result).toMatch(/2[.,]5 MB/);
  });

  it('should format gigabytes with 0 decimals', () => {
    const result = formatBytes(1073741824, 0);
    expect(result).toMatch(/1 GB/);
  });

  it('should format zero bytes', () => {
    expect(formatBytes(0, 2)).toBe('0 Bytes');
  });

  it('should use default 2 decimals when not specified', () => {
    const result = formatBytes(1536);
    expect(result).toMatch(/1[.,]50 KB/);
  });

  it('should throw RangeError for negative values', () => {
    expect(() => formatBytes(-100, 2)).toThrow(RangeError);
  });

  it('should throw TypeError for invalid input', () => {
    expect(() => formatBytes(NaN, 2)).toThrow(TypeError);
  });
});

// ============================================================================
// User Name Formatting Tests
// ============================================================================

describe('formatUserName', () => {
  it('should format firstlast order by default', () => {
    expect(formatUserName('John', 'Doe')).toBe('John Doe');
  });

  it('should format lastfirst order when specified', () => {
    expect(formatUserName('John', 'Doe', 'lastfirst')).toBe('Doe, John');
  });

  it('should handle empty firstName', () => {
    expect(formatUserName('', 'Doe')).toBe('Doe');
  });

  it('should handle empty lastName', () => {
    expect(formatUserName('John', '')).toBe('John');
  });

  it('should handle both empty names', () => {
    expect(formatUserName('', '')).toBe('');
  });

  it('should trim whitespace from names', () => {
    expect(formatUserName('  John  ', '  Doe  ')).toBe('John Doe');
  });

  it('should handle whitespace-only names as empty', () => {
    expect(formatUserName('   ', 'Doe')).toBe('Doe');
  });
});

// ============================================================================
// List Formatting Tests
// ============================================================================

describe('formatList', () => {
  it('should format single item', () => {
    expect(formatList(['apple'])).toBe('apple');
  });

  it('should format two items with and', () => {
    expect(formatList(['apple', 'banana'])).toBe('apple and banana');
  });

  it('should format three items with Oxford comma', () => {
    expect(formatList(['apple', 'banana', 'cherry'])).toBe('apple, banana, and cherry');
  });

  it('should format two items with or', () => {
    expect(formatList(['red', 'blue'], 'or')).toBe('red or blue');
  });

  it('should format three items with or', () => {
    expect(formatList(['red', 'blue', 'green'], 'or')).toBe('red, blue, or green');
  });

  it('should handle empty array', () => {
    expect(formatList([])).toBe('');
  });

  it('should filter out empty strings', () => {
    expect(formatList(['apple', '', 'banana'])).toBe('apple and banana');
  });

  it('should filter out whitespace-only strings', () => {
    expect(formatList(['apple', '   ', 'banana'])).toBe('apple and banana');
  });

  it('should handle four or more items', () => {
    expect(formatList(['a', 'b', 'c', 'd'])).toBe('a, b, c, and d');
  });
});

// ============================================================================
// Phone Number Formatting Tests
// ============================================================================

describe('formatPhoneNumber', () => {
  it('should format 10-digit phone number', () => {
    expect(formatPhoneNumber('1234567890')).toBe('(123) 456-7890');
  });

  it('should format phone number with existing formatting', () => {
    expect(formatPhoneNumber('123-456-7890')).toBe('(123) 456-7890');
  });

  it('should format 11-digit number with country code', () => {
    expect(formatPhoneNumber('11234567890')).toBe('+1 (123) 456-7890');
  });

  it('should handle phone numbers with parentheses', () => {
    expect(formatPhoneNumber('(123) 456-7890')).toBe('(123) 456-7890');
  });

  it('should return digits only for non-standard lengths', () => {
    expect(formatPhoneNumber('12345')).toBe('12345');
  });

  it('should handle empty string', () => {
    expect(formatPhoneNumber('')).toBe('');
  });

  it('should handle phone with spaces', () => {
    expect(formatPhoneNumber('123 456 7890')).toBe('(123) 456-7890');
  });

  it('should extract digits from mixed format', () => {
    expect(formatPhoneNumber('+1 (123) 456-7890')).toBe('+1 (123) 456-7890');
  });
});

// ============================================================================
// Duration Formatting Tests
// ============================================================================

describe('formatDuration', () => {
  it('should format seconds only', () => {
    const result = formatDuration(45);
    expect(result).toContain('45');
    expect(result).toMatch(/second/i);
  });

  it('should format minutes and seconds', () => {
    const result = formatDuration(90);
    expect(result).toMatch(/minute/i);
    expect(result).toMatch(/30/);
  });

  it('should format hours, minutes, and seconds', () => {
    const result = formatDuration(3665);
    expect(result).toMatch(/hour/i);
    expect(result).toMatch(/minute/i);
  });

  it('should format zero seconds', () => {
    const result = formatDuration(0);
    expect(result).toContain('0');
    expect(result).toMatch(/second/i);
  });

  it('should format hours exactly', () => {
    const result = formatDuration(7200);
    expect(result).toMatch(/2/);
    expect(result).toMatch(/hour/i);
  });

  it('should handle singular second', () => {
    const result = formatDuration(1);
    expect(result).toMatch(/1 second(?!s)/i); // Should be singular
  });

  it('should handle plural seconds', () => {
    const result = formatDuration(2);
    expect(result).toMatch(/2 seconds/i); // Should be plural
  });
});

// ============================================================================
// Pluralization Tests
// ============================================================================

describe('pluralize', () => {
  it('should use singular form for count of 1', () => {
    expect(pluralize(1, 'item')).toBe('1 item');
  });

  it('should use plural form for count of 2', () => {
    expect(pluralize(2, 'item')).toBe('2 items');
  });

  it('should use custom plural form', () => {
    expect(pluralize(2, 'person', 'people')).toBe('2 people');
  });

  it('should use singular for count of 1 with custom plural', () => {
    expect(pluralize(1, 'person', 'people')).toBe('1 person');
  });

  it('should use plural form for count of 0', () => {
    expect(pluralize(0, 'item')).toBe('0 items');
  });

  it('should auto-add s when plural not provided', () => {
    expect(pluralize(5, 'cat')).toBe('5 cats');
  });

  it('should handle irregular plurals', () => {
    expect(pluralize(1, 'child', 'children')).toBe('1 child');
    expect(pluralize(3, 'child', 'children')).toBe('3 children');
  });

  it('should handle large counts', () => {
    expect(pluralize(1000, 'result')).toBe('1000 results');
  });

  it('should throw TypeError for invalid count', () => {
    expect(() => pluralize(NaN, 'item')).toThrow(TypeError);
  });

  it('should throw TypeError for invalid singular', () => {
    expect(() => pluralize(5, '')).toThrow(TypeError);
  });
});
