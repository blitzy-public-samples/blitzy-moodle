/**
 * Data formatting utility functions
 *
 * This module provides comprehensive formatting utilities for displaying various
 * data types in human-readable formats throughout the React application.
 *
 * Key features:
 * - Number formatting with locale support using Intl API
 * - Currency formatting with multiple currency support
 * - File size formatting (bytes to KB/MB/GB/TB)
 * - Percentage and grade formatting
 * - User name formatting with configurable patterns
 * - List formatting with proper conjunctions
 * - Phone number formatting
 * - Duration formatting (delegates to date.ts)
 * - Pluralization utilities
 * - Large number abbreviation (1.2K, 3.5M, etc.)
 *
 * All functions follow TypeScript strict mode with no `any` types and include
 * comprehensive error handling and edge case management.
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { formatDuration as formatDurationFromDate } from './date';

// ============================================================================
// Number Formatting Functions
// ============================================================================

/**
 * Format a number with locale-specific thousands separators and decimal places
 *
 * Uses the Intl.NumberFormat API for locale-aware formatting. Defaults to
 * the user's browser locale. Handles edge cases like NaN, Infinity, and null.
 *
 * @param value - The number to format
 * @param decimals - Optional number of decimal places (defaults to 0)
 * @returns Formatted number string with locale-specific separators
 * @throws TypeError if value is not a valid number
 *
 * @example
 * formatNumber(1234567) // "1,234,567" (US locale)
 * formatNumber(1234.5678, 2) // "1,234.57"
 * formatNumber(1000, 0) // "1,000"
 */
export function formatNumber(value: number, decimals: number = 0): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('Invalid number provided to formatNumber');
  }

  try {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch (error) {
    // Fallback to simple toFixed if Intl fails
    return value.toFixed(decimals);
  }
}

/**
 * Format a monetary value with currency symbol and proper decimal places
 *
 * Supports multiple currencies through ISO 4217 currency codes. Uses Intl.NumberFormat
 * for proper currency symbol placement and formatting rules per locale.
 *
 * @param value - The monetary value to format
 * @param currency - ISO 4217 currency code (defaults to 'USD')
 * @param decimals - Number of decimal places (defaults to 2, overrides currency default)
 * @returns Formatted currency string with symbol
 * @throws TypeError if value is not a valid number
 *
 * @example
 * formatCurrency(1234.56) // "$1,234.56"
 * formatCurrency(1234.56, 'EUR') // "€1,234.56"
 * formatCurrency(1234.567, 'USD', 3) // "$1,234.567"
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  decimals?: number
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('Invalid number provided to formatCurrency');
  }

  try {
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: currency.toUpperCase(),
    };

    if (decimals !== undefined) {
      options.minimumFractionDigits = decimals;
      options.maximumFractionDigits = decimals;
    }

    return new Intl.NumberFormat(undefined, options).format(value);
  } catch (error) {
    // Fallback if currency code is invalid or Intl fails
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency;
    const decimalsToUse = decimals ?? 2;
    return `${symbol}${formatNumber(value, decimalsToUse)}`;
  }
}

/**
 * Format a number as a percentage with specified decimal places
 *
 * Converts a decimal value to percentage display. Handles values as decimals
 * (e.g., 0.85 = 85%) or as already-percentages (e.g., 85 = 85%) based on magnitude.
 *
 * @param value - The value to format as percentage (0-1 range for decimals, or 0-100 for percentages)
 * @param decimals - Number of decimal places (defaults to 0)
 * @returns Formatted percentage string with % symbol
 * @throws TypeError if value is not a valid number
 *
 * @example
 * formatPercentage(0.856) // "85.6%" (assumes decimal)
 * formatPercentage(85.6) // "85.6%" (assumes already percentage)
 * formatPercentage(0.8567, 2) // "85.67%"
 * formatPercentage(100) // "100%"
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('Invalid number provided to formatPercentage');
  }

  // If value is between 0 and 1, assume it's a decimal representation
  const percentageValue = value > 0 && value <= 1 ? value * 100 : value;

  return `${formatNumber(percentageValue, decimals)}%`;
}

/**
 * Format a grade score with maximum grade context
 *
 * Displays a grade as "score/max" format with proper decimal handling.
 * Useful for displaying assignment grades, quiz scores, etc.
 *
 * @param grade - The grade score achieved
 * @param maxGrade - The maximum possible grade
 * @param decimals - Number of decimal places for the grade (defaults to 1)
 * @returns Formatted grade string (e.g., "87.5/100")
 * @throws TypeError if grade or maxGrade are not valid numbers
 * @throws RangeError if maxGrade is zero or negative
 *
 * @example
 * formatGrade(87.5, 100) // "87.5/100"
 * formatGrade(17, 20, 0) // "17/20"
 * formatGrade(95.678, 100, 2) // "95.68/100"
 */
export function formatGrade(
  grade: number,
  maxGrade: number,
  decimals: number = 1
): string {
  if (typeof grade !== 'number' || !Number.isFinite(grade)) {
    throw new TypeError('Invalid grade provided to formatGrade');
  }

  if (typeof maxGrade !== 'number' || !Number.isFinite(maxGrade) || maxGrade <= 0) {
    throw new TypeError('Invalid maxGrade provided to formatGrade (must be positive number)');
  }

  const formattedGrade = formatNumber(grade, decimals);
  const formattedMaxGrade = formatNumber(maxGrade, decimals);

  return `${formattedGrade}/${formattedMaxGrade}`;
}

/**
 * Abbreviate large numbers with K, M, B, T suffixes
 *
 * Converts large numbers to compact notation with SI suffixes.
 * Useful for displaying large counts, followers, views, etc.
 *
 * @param value - The number to abbreviate
 * @returns Abbreviated number string (e.g., "1.2K", "3.5M")
 * @throws TypeError if value is not a valid number
 *
 * @example
 * abbreviateNumber(1234) // "1.2K"
 * abbreviateNumber(1234567) // "1.2M"
 * abbreviateNumber(1234567890) // "1.2B"
 * abbreviateNumber(999) // "999"
 */
export function abbreviateNumber(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('Invalid number provided to abbreviateNumber');
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue < 1000) {
    return `${sign}${absValue}`;
  }

  const units = [
    { threshold: 1e12, suffix: 'T' }, // Trillion
    { threshold: 1e9, suffix: 'B' },  // Billion
    { threshold: 1e6, suffix: 'M' },  // Million
    { threshold: 1e3, suffix: 'K' },  // Thousand
  ];

  for (const unit of units) {
    if (absValue >= unit.threshold) {
      const abbreviated = absValue / unit.threshold;
      const formatted = abbreviated >= 10 ? abbreviated.toFixed(0) : abbreviated.toFixed(1);
      return `${sign}${formatted}${unit.suffix}`;
    }
  }

  return `${sign}${absValue}`;
}

// ============================================================================
// File Size Formatting Functions
// ============================================================================

/**
 * Format byte count to human-readable file size (KB, MB, GB, TB)
 *
 * Converts raw byte values to the most appropriate unit for readability.
 * Uses binary (1024-based) calculations which are standard for file sizes.
 *
 * @param bytes - Number of bytes to format
 * @returns Formatted file size string with appropriate unit
 * @throws TypeError if bytes is not a valid number
 * @throws RangeError if bytes is negative
 *
 * @example
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(1536) // "1.5 KB"
 * formatFileSize(1048576) // "1 MB"
 * formatFileSize(2621440) // "2.5 MB"
 * formatFileSize(1073741824) // "1 GB"
 */
export function formatFileSize(bytes: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) {
    throw new TypeError('Invalid bytes value provided to formatFileSize');
  }

  if (bytes < 0) {
    throw new RangeError('Bytes value cannot be negative');
  }

  if (bytes === 0) {
    return '0 Bytes';
  }

  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, units.length - 1);

  const value = bytes / Math.pow(k, unitIndex);
  const decimals = unitIndex === 0 ? 0 : 1;

  return `${formatNumber(value, decimals)} ${units[unitIndex]}`;
}

/**
 * Alternative file size formatter with configurable decimal places
 *
 * Similar to formatFileSize but allows explicit control over decimal precision.
 * Useful when consistent decimal places are required across multiple displays.
 *
 * @param bytes - Number of bytes to format
 * @param decimals - Number of decimal places (defaults to 2)
 * @returns Formatted file size string with appropriate unit
 * @throws TypeError if bytes is not a valid number
 * @throws RangeError if bytes is negative
 *
 * @example
 * formatBytes(1536, 2) // "1.50 KB"
 * formatBytes(2621440, 1) // "2.5 MB"
 * formatBytes(1073741824, 0) // "1 GB"
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) {
    throw new TypeError('Invalid bytes value provided to formatBytes');
  }

  if (bytes < 0) {
    throw new RangeError('Bytes value cannot be negative');
  }

  if (bytes === 0) {
    return '0 Bytes';
  }

  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, units.length - 1);

  const value = bytes / Math.pow(k, unitIndex);

  return `${formatNumber(value, decimals)} ${units[unitIndex]}`;
}

// ============================================================================
// User Data Formatting Functions
// ============================================================================

/**
 * Format user's full name according to specified pattern
 *
 * Supports common name display patterns used across different cultures.
 * Handles empty names gracefully and trims whitespace.
 *
 * @param firstName - User's first/given name
 * @param lastName - User's last/family name
 * @param format - Name order format ('firstlast' or 'lastfirst'), defaults to 'firstlast'
 * @returns Formatted full name string
 *
 * @example
 * formatUserName('John', 'Doe') // "John Doe"
 * formatUserName('John', 'Doe', 'lastfirst') // "Doe, John"
 * formatUserName('', 'Doe') // "Doe"
 * formatUserName('John', '') // "John"
 */
export function formatUserName(
  firstName: string,
  lastName: string,
  format: 'firstlast' | 'lastfirst' = 'firstlast'
): string {
  const trimmedFirstName = firstName?.trim() || '';
  const trimmedLastName = lastName?.trim() || '';

  // Handle cases where one or both names are empty
  if (!trimmedFirstName && !trimmedLastName) {
    return '';
  }

  if (!trimmedFirstName) {
    return trimmedLastName;
  }

  if (!trimmedLastName) {
    return trimmedFirstName;
  }

  // Format according to specified pattern
  if (format === 'lastfirst') {
    return `${trimmedLastName}, ${trimmedFirstName}`;
  }

  return `${trimmedFirstName} ${trimmedLastName}`;
}

/**
 * Format phone number with consistent styling
 *
 * Attempts to format phone numbers in a standard US format (XXX) XXX-XXXX
 * for 10-digit numbers. Falls back to original string for other formats.
 *
 * @param phone - Phone number string (may contain non-numeric characters)
 * @returns Formatted phone number string
 *
 * @example
 * formatPhoneNumber('1234567890') // "(123) 456-7890"
 * formatPhoneNumber('123-456-7890') // "(123) 456-7890"
 * formatPhoneNumber('+1-123-456-7890') // "+1 (123) 456-7890"
 * formatPhoneNumber('12345') // "12345" (no formatting for non-standard lengths)
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Extract only digits
  const digits = phone.replace(/\D/g, '');

  // Handle US 10-digit numbers (with or without country code)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits[0] === '1') {
    // US number with country code
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // For non-standard lengths, return with minimal formatting
  if (digits.length > 0) {
    return digits;
  }

  // Return original if no digits found
  return phone;
}

// ============================================================================
// List and Text Formatting Functions
// ============================================================================

/**
 * Format an array of items as a comma-separated list with conjunction
 *
 * Creates grammatically correct lists with proper conjunction placement.
 * Handles edge cases like empty arrays, single items, and two items.
 *
 * @param items - Array of strings to format as a list
 * @param conjunction - Conjunction word to use ('and' or 'or'), defaults to 'and'
 * @returns Formatted list string
 *
 * @example
 * formatList(['apple']) // "apple"
 * formatList(['apple', 'orange']) // "apple and orange"
 * formatList(['apple', 'orange', 'banana']) // "apple, orange, and banana"
 * formatList(['red', 'blue', 'green'], 'or') // "red, blue, or green"
 * formatList([]) // ""
 */
export function formatList(
  items: string[],
  conjunction: 'and' | 'or' = 'and'
): string {
  if (!Array.isArray(items)) {
    return '';
  }

  const filteredItems = items.filter(item => item && typeof item === 'string' && item.trim() !== '');

  if (filteredItems.length === 0) {
    return '';
  }

  if (filteredItems.length === 1) {
    const [first] = filteredItems;
    return first ?? '';
  }

  if (filteredItems.length === 2) {
    const [first, second] = filteredItems;
    return `${first ?? ''} ${conjunction} ${second ?? ''}`;
  }

  // Oxford comma style for 3+ items
  const allButLast = filteredItems.slice(0, -1).join(', ');
  const lastItem = filteredItems.at(-1) ?? '';

  return `${allButLast}, ${conjunction} ${lastItem}`;
}

/**
 * Handle singular/plural forms based on count
 *
 * Automatically selects singular or plural form of a word based on count.
 * Supports custom plural form or uses simple 's' suffix.
 *
 * @param count - The count that determines singular vs plural
 * @param singular - The singular form of the word
 * @param plural - Optional custom plural form (defaults to singular + 's')
 * @returns The count followed by the appropriate word form
 *
 * @example
 * pluralize(1, 'item') // "1 item"
 * pluralize(5, 'item') // "5 items"
 * pluralize(1, 'person', 'people') // "1 person"
 * pluralize(5, 'person', 'people') // "5 people"
 * pluralize(0, 'result') // "0 results"
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    throw new TypeError('Invalid count provided to pluralize');
  }

  if (!singular || typeof singular !== 'string') {
    throw new TypeError('Invalid singular form provided to pluralize');
  }

  const pluralForm = plural ?? `${singular}s`;
  const word = count === 1 ? singular : pluralForm;

  return `${count} ${word}`;
}

// ============================================================================
// Duration Formatting Functions
// ============================================================================

/**
 * Format duration in seconds to human-readable format
 *
 * Delegates to the formatDuration function from date.ts for consistent
 * duration formatting across the application. Formats as "X hours Y minutes Z seconds".
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "2 hours 30 minutes", "45 minutes")
 * @throws RangeError if seconds is negative
 *
 * @example
 * formatDuration(90) // "1 minute 30 seconds"
 * formatDuration(3665) // "1 hour 1 minute"
 * formatDuration(7200) // "2 hours"
 * formatDuration(0) // "0 seconds"
 *
 * @see {@link date.ts#formatDuration} for the underlying implementation
 */
export function formatDuration(seconds: number): string {
  return formatDurationFromDate(seconds);
}
