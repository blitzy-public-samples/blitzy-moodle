/**
 * Input Validation Utility Functions
 *
 * Comprehensive validation utilities for form data validation including:
 * - Email format validation
 * - Username pattern validation (Moodle conventions)
 * - Password strength and complexity checking
 * - URL validation
 * - Numeric validation (integers, floats, ranges)
 * - File type and size validation
 * - General field validation (required, length, patterns)
 *
 * Compatible with React Hook Form and Zod schema validation.
 *
 * @module utils/validation
 * @package react-frontend
 * @copyright 2024 Moodle React Frontend
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Import constants from our constants file
import {
  EMAIL_REGEX as IMPORTED_EMAIL_REGEX,
  USERNAME_REGEX as IMPORTED_USERNAME_REGEX,
  URL_REGEX as IMPORTED_URL_REGEX,
  MIN_PASSWORD_LENGTH,
  PASSWORD_REQUIRES_UPPERCASE,
  PASSWORD_REQUIRES_LOWERCASE,
  PASSWORD_REQUIRES_DIGIT,
  PASSWORD_REQUIRES_SPECIAL,
  MAX_FILE_SIZE,
} from './constants';

// Import string utilities
import { isEmpty } from './string';

// ============================================================================
// Re-export Regex Constants
// ============================================================================

/**
 * Email validation regex pattern
 * Validates standard email address format: user@domain.tld
 */
export const EMAIL_REGEX = IMPORTED_EMAIL_REGEX;

/**
 * Username validation regex pattern
 * Allows alphanumeric characters, underscores, hyphens, periods, and @ symbols
 * Matches Moodle's PARAM_USERNAME validation
 */
export const USERNAME_REGEX = IMPORTED_USERNAME_REGEX;

/**
 * URL validation regex pattern
 * Validates URLs with http or https protocol
 */
export const URL_REGEX = IMPORTED_URL_REGEX;

// ============================================================================
// Email Validation
// ============================================================================

/**
 * Validates email address format
 *
 * Checks if the provided email string matches standard email format patterns.
 * Uses a comprehensive regex that validates:
 * - Local part (before @): alphanumeric, dots, underscores, percent, plus, hyphen
 * - Domain part: alphanumeric with hyphens and dots
 * - TLD: at least 2 characters
 *
 * @param email - The email address to validate
 * @returns True if the email format is valid, false otherwise
 *
 * @example
 * ```ts
 * isValidEmail('user@example.com');     // true
 * isValidEmail('invalid.email');        // false
 * isValidEmail('user+tag@domain.co.uk'); // true
 * isValidEmail('');                      // false
 * ```
 */
export function isValidEmail(email: string): boolean {
  if (isEmpty(email)) {
    return false;
  }

  return EMAIL_REGEX.test(email.trim());
}

// ============================================================================
// Username Validation
// ============================================================================

/**
 * Validates username against Moodle naming conventions
 *
 * Checks if the username follows Moodle's PARAM_USERNAME rules:
 * - Contains only alphanumeric characters, underscores, hyphens, periods, and @ symbols
 * - No spaces allowed
 * - Case-insensitive
 *
 * @param username - The username to validate
 * @returns True if the username matches Moodle conventions, false otherwise
 *
 * @example
 * ```ts
 * isValidUsername('john_doe');      // true
 * isValidUsername('user.name-123'); // true
 * isValidUsername('user@domain');   // true
 * isValidUsername('user name');     // false (contains space)
 * isValidUsername('user#123');      // false (invalid character)
 * ```
 */
export function isValidUsername(username: string): boolean {
  if (isEmpty(username)) {
    return false;
  }

  return USERNAME_REGEX.test(username.trim());
}

// ============================================================================
// Password Validation
// ============================================================================

/**
 * Password validation result interface
 */
export interface PasswordValidationResult {
  /** Whether the password meets all requirements */
  valid: boolean;
  /** Array of error messages describing which requirements failed */
  errors: string[];
}

/**
 * Validates password strength and complexity requirements
 *
 * Checks password against configurable requirements:
 * - Minimum length (default: 8 characters)
 * - At least one uppercase letter (if required)
 * - At least one lowercase letter (if required)
 * - At least one digit (if required)
 * - At least one special character (if required)
 *
 * Returns detailed error messages for each failed requirement.
 *
 * @param password - The password to validate
 * @returns Object with valid flag and array of error messages
 *
 * @example
 * ```ts
 * isValidPassword('weak');
 * // { valid: false, errors: ['Password must be at least 8 characters long', ...] }
 *
 * isValidPassword('StrongP@ss123');
 * // { valid: true, errors: [] }
 * ```
 */
export function isValidPassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Check if password is empty
  if (isEmpty(password)) {
    errors.push('Password is required');
    return { valid: false, errors };
  }

  // Check minimum length
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  // Check for uppercase letter
  if (PASSWORD_REQUIRES_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letter
  if (PASSWORD_REQUIRES_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for digit
  if (PASSWORD_REQUIRES_DIGIT && !/\d/.test(password)) {
    errors.push('Password must contain at least one digit');
  }

  // Check for special character
  if (PASSWORD_REQUIRES_SPECIAL && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validates URL format
 *
 * Checks if the provided string is a valid HTTP or HTTPS URL.
 * Validates:
 * - Protocol (http:// or https://)
 * - Domain name
 * - Optional path, query parameters, and fragments
 *
 * @param url - The URL string to validate
 * @returns True if the URL format is valid, false otherwise
 *
 * @example
 * ```ts
 * isValidUrl('https://example.com');              // true
 * isValidUrl('http://sub.domain.com/path?q=1');   // true
 * isValidUrl('ftp://example.com');                // false (wrong protocol)
 * isValidUrl('not-a-url');                        // false
 * ```
 */
export function isValidUrl(url: string): boolean {
  if (isEmpty(url)) {
    return false;
  }

  return URL_REGEX.test(url.trim());
}

// ============================================================================
// Numeric Validation
// ============================================================================

/**
 * Validates if a value is a valid integer
 *
 * Checks if the value can be parsed as an integer without decimal places.
 * Accepts numeric strings and number types.
 *
 * @param value - The value to validate (string or number)
 * @returns True if the value is a valid integer, false otherwise
 *
 * @example
 * ```ts
 * isValidInteger(42);        // true
 * isValidInteger('123');     // true
 * isValidInteger('12.5');    // false
 * isValidInteger('abc');     // false
 * isValidInteger(null);      // false
 * ```
 */
export function isValidInteger(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }

  const num = Number(value);
  return !isNaN(num) && Number.isInteger(num);
}

/**
 * Validates if a value is a valid float (decimal number)
 *
 * Checks if the value can be parsed as a valid floating-point number.
 * Accepts numeric strings, integers, and floats.
 *
 * @param value - The value to validate (string or number)
 * @returns True if the value is a valid float, false otherwise
 *
 * @example
 * ```ts
 * isValidFloat(3.14);        // true
 * isValidFloat('2.5');       // true
 * isValidFloat(42);          // true (integers are valid floats)
 * isValidFloat('abc');       // false
 * isValidFloat(NaN);         // false
 * ```
 */
export function isValidFloat(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }

  const num = Number(value);
  return !isNaN(num) && isFinite(num);
}

/**
 * Validates if a number is within a specified range (inclusive)
 *
 * Checks if the value falls between min and max values, inclusive of both boundaries.
 *
 * @param value - The numeric value to check
 * @param min - The minimum allowed value (inclusive)
 * @param max - The maximum allowed value (inclusive)
 * @returns True if the value is within the range [min, max], false otherwise
 *
 * @example
 * ```ts
 * isInRange(5, 1, 10);       // true
 * isInRange(1, 1, 10);       // true (inclusive)
 * isInRange(10, 1, 10);      // true (inclusive)
 * isInRange(0, 1, 10);       // false
 * isInRange(11, 1, 10);      // false
 * ```
 */
export function isInRange(value: number, min: number, max: number): boolean {
  if (!isValidFloat(value) || !isValidFloat(min) || !isValidFloat(max)) {
    return false;
  }

  return value >= min && value <= max;
}

// ============================================================================
// File Validation
// ============================================================================

/**
 * Validates file type by checking file extension
 *
 * Checks if the file's extension matches one of the allowed types.
 * Case-insensitive comparison.
 *
 * @param filename - The name of the file (with extension)
 * @param allowedTypes - Array of allowed file extensions (e.g., ['pdf', 'jpg', 'png'])
 * @returns True if the file type is allowed, false otherwise
 *
 * @example
 * ```ts
 * isValidFileType('document.pdf', ['pdf', 'doc']);       // true
 * isValidFileType('image.JPG', ['jpg', 'png']);          // true (case-insensitive)
 * isValidFileType('script.exe', ['pdf', 'jpg']);         // false
 * isValidFileType('noextension', ['txt']);               // false
 * ```
 */
export function isValidFileType(filename: string, allowedTypes: string[]): boolean {
  if (isEmpty(filename) || !allowedTypes || allowedTypes.length === 0) {
    return false;
  }

  // Extract file extension
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    // No extension or dot is the last character
    return false;
  }

  const extension = filename.substring(lastDotIndex + 1).toLowerCase();

  // Check if extension is in allowed types (case-insensitive)
  return allowedTypes.some((type) => type.toLowerCase() === extension);
}

/**
 * Validates file size against maximum allowed size
 *
 * Checks if the file size is within the allowed limit.
 * Uses MAX_FILE_SIZE constant as default maximum.
 *
 * @param fileSize - The size of the file in bytes
 * @param maxSize - The maximum allowed size in bytes (defaults to MAX_FILE_SIZE)
 * @returns True if the file size is within the limit, false otherwise
 *
 * @example
 * ```ts
 * isValidFileSize(1024, 2048);                    // true (1KB < 2KB)
 * isValidFileSize(3000, 2048);                    // false (3KB > 2KB)
 * isValidFileSize(50000000);                      // true (uses MAX_FILE_SIZE default)
 * ```
 */
export function isValidFileSize(fileSize: number, maxSize: number = MAX_FILE_SIZE): boolean {
  if (!isValidFloat(fileSize) || fileSize < 0) {
    return false;
  }

  if (!isValidFloat(maxSize) || maxSize <= 0) {
    return false;
  }

  return fileSize <= maxSize;
}

// ============================================================================
// General Field Validation
// ============================================================================

/**
 * Validates that a field has a non-empty value
 *
 * Checks if the value is not null, undefined, or empty (after trimming).
 * Works with strings, numbers, arrays, and objects.
 *
 * @param value - The value to check
 * @returns True if the value is present and non-empty, false otherwise
 *
 * @example
 * ```ts
 * validateRequired('hello');      // true
 * validateRequired('   ');        // false (whitespace only)
 * validateRequired('');           // false
 * validateRequired(null);         // false
 * validateRequired(undefined);    // false
 * validateRequired(0);            // true (zero is a valid value)
 * validateRequired([]);           // false (empty array)
 * validateRequired([1, 2]);       // true
 * ```
 */
export function validateRequired(value: unknown): boolean {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return false;
  }

  // Handle strings
  if (typeof value === 'string') {
    return !isEmpty(value);
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  // Handle numbers (including 0)
  if (typeof value === 'number') {
    return !isNaN(value);
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return true;
  }

  // Handle objects
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return false;
}

/**
 * Validates that a string meets minimum length requirement
 *
 * Checks if the string length is at least the specified minimum.
 * Trims whitespace before checking length.
 *
 * @param value - The string to validate
 * @param minLength - The minimum required length
 * @returns True if the string meets the minimum length, false otherwise
 *
 * @example
 * ```ts
 * validateMinLength('hello', 3);       // true (5 >= 3)
 * validateMinLength('hi', 3);          // false (2 < 3)
 * validateMinLength('   text   ', 4);  // true (trims to 'text', 4 >= 4)
 * ```
 */
export function validateMinLength(value: string, minLength: number): boolean {
  if (isEmpty(value)) {
    return false;
  }

  if (!isValidInteger(minLength) || minLength < 0) {
    return false;
  }

  return value.trim().length >= minLength;
}

/**
 * Validates that a string does not exceed maximum length
 *
 * Checks if the string length is at most the specified maximum.
 * Trims whitespace before checking length.
 *
 * @param value - The string to validate
 * @param maxLength - The maximum allowed length
 * @returns True if the string is within the maximum length, false otherwise
 *
 * @example
 * ```ts
 * validateMaxLength('hello', 10);      // true (5 <= 10)
 * validateMaxLength('very long text', 5); // false (14 > 5)
 * validateMaxLength('', 5);            // true (empty string is valid)
 * ```
 */
export function validateMaxLength(value: string, maxLength: number): boolean {
  if (!isValidInteger(maxLength) || maxLength < 0) {
    return false;
  }

  // Empty strings are valid (use validateRequired separately if needed)
  if (isEmpty(value)) {
    return true;
  }

  return value.trim().length <= maxLength;
}

/**
 * Validates that a string matches a specified regex pattern
 *
 * Checks if the value matches the provided regular expression.
 * Useful for custom validation patterns like phone numbers, postal codes, etc.
 *
 * @param value - The string to validate
 * @param pattern - The regular expression pattern to match against
 * @returns True if the string matches the pattern, false otherwise
 *
 * @example
 * ```ts
 * validatePattern('12345', /^\d+$/);              // true (digits only)
 * validatePattern('abc123', /^\d+$/);             // false (contains letters)
 * validatePattern('(123) 456-7890', /^\(\d{3}\) \d{3}-\d{4}$/); // true
 * ```
 */
export function validatePattern(value: string, pattern: RegExp): boolean {
  if (isEmpty(value)) {
    return false;
  }

  return pattern.test(value);
}
