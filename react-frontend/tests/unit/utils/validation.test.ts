/**
 * Unit Tests for Input Validation Utilities
 *
 * Comprehensive test suite validating all input validation functions including:
 * - Email format validation (isValidEmail)
 * - Username pattern validation (isValidUsername)
 * - Password strength validation with detailed error reporting (isValidPassword)
 * - URL format validation (isValidUrl)
 * - Numeric validation: integers, floats, and range checking
 * - File type and size validation
 * - General field validation: required, length constraints, custom patterns
 *
 * Tests cover valid inputs, invalid formats, edge cases (null, undefined, empty),
 * boundary conditions, and comprehensive validation rule verification.
 *
 * @module tests/unit/utils/validation
 * @package react-frontend
 * @copyright 2024 Moodle React Frontend
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidUsername,
  isValidPassword,
  isValidUrl,
  isValidInteger,
  isValidFloat,
  isInRange,
  isValidFileType,
  isValidFileSize,
  validateRequired,
  validateMinLength,
  validateMaxLength,
  validatePattern,
} from '@/utils/validation';

// ============================================================================
// Email Validation Tests
// ============================================================================

describe('isValidEmail', () => {
  describe('valid email formats', () => {
    it('should validate standard email format', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
    });

    it('should validate email with dot in local part', () => {
      expect(isValidEmail('user.name@example.com')).toBe(true);
    });

    it('should validate email with plus sign (subaddressing)', () => {
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('should validate email with subdomain', () => {
      expect(isValidEmail('user@mail.example.com')).toBe(true);
    });

    it('should validate email with country code TLD', () => {
      expect(isValidEmail('user@example.co.uk')).toBe(true);
    });

    it('should validate email with hyphen in domain', () => {
      expect(isValidEmail('user@my-domain.com')).toBe(true);
    });

    it('should validate email with underscore in local part', () => {
      expect(isValidEmail('user_name@example.com')).toBe(true);
    });

    it('should validate email with numbers', () => {
      expect(isValidEmail('user123@example456.com')).toBe(true);
    });
  });

  describe('invalid email formats', () => {
    it('should reject email missing @ symbol', () => {
      expect(isValidEmail('userexample.com')).toBe(false);
    });

    it('should reject email missing domain', () => {
      expect(isValidEmail('user@')).toBe(false);
    });

    it('should reject email missing local part', () => {
      expect(isValidEmail('@example.com')).toBe(false);
    });

    it('should reject email with multiple @ symbols', () => {
      expect(isValidEmail('user@@example.com')).toBe(false);
    });

    it('should reject email with spaces', () => {
      expect(isValidEmail('user name@example.com')).toBe(false);
    });

    it('should reject email missing TLD', () => {
      expect(isValidEmail('user@domain')).toBe(false);
    });

    it('should reject email with invalid characters', () => {
      expect(isValidEmail('user#name@example.com')).toBe(false);
    });

    it('should reject plain text without email format', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should reject empty string', () => {
      expect(isValidEmail('')).toBe(false);
    });

    it('should trim and validate email with surrounding whitespace', () => {
      expect(isValidEmail('  user@example.com  ')).toBe(true);
    });

    it('should reject whitespace-only string', () => {
      expect(isValidEmail('   ')).toBe(false);
    });
  });
});

// ============================================================================
// Username Validation Tests
// ============================================================================

describe('isValidUsername', () => {
  describe('valid username formats', () => {
    it('should validate alphanumeric username', () => {
      expect(isValidUsername('user123')).toBe(true);
    });

    it('should validate username with underscore', () => {
      expect(isValidUsername('user_name')).toBe(true);
    });

    it('should validate username with hyphen', () => {
      expect(isValidUsername('user-name')).toBe(true);
    });

    it('should validate username with period', () => {
      expect(isValidUsername('user.name')).toBe(true);
    });

    it('should validate username with @ symbol', () => {
      expect(isValidUsername('user@domain')).toBe(true);
    });

    it('should validate username with mixed valid characters', () => {
      expect(isValidUsername('user.name-123_test@domain')).toBe(true);
    });

    it('should validate lowercase username', () => {
      expect(isValidUsername('johnsmith')).toBe(true);
    });

    it('should validate uppercase username', () => {
      expect(isValidUsername('JOHNSMITH')).toBe(true);
    });

    it('should validate mixed case username', () => {
      expect(isValidUsername('JohnSmith')).toBe(true);
    });
  });

  describe('invalid username formats', () => {
    it('should reject username with spaces', () => {
      expect(isValidUsername('user name')).toBe(false);
    });

    it('should reject username with hash symbol', () => {
      expect(isValidUsername('user#name')).toBe(false);
    });

    it('should reject username with exclamation mark', () => {
      expect(isValidUsername('user!name')).toBe(false);
    });

    it('should reject username with special characters', () => {
      expect(isValidUsername('user$name')).toBe(false);
    });

    it('should reject username with parentheses', () => {
      expect(isValidUsername('user(name)')).toBe(false);
    });

    it('should reject username with brackets', () => {
      expect(isValidUsername('user[name]')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should reject empty string', () => {
      expect(isValidUsername('')).toBe(false);
    });

    it('should trim and validate username with surrounding whitespace', () => {
      expect(isValidUsername('  username  ')).toBe(true);
    });

    it('should reject whitespace-only string', () => {
      expect(isValidUsername('   ')).toBe(false);
    });
  });
});

// ============================================================================
// Password Validation Tests
// ============================================================================

describe('isValidPassword', () => {
  describe('valid passwords', () => {
    it('should validate password meeting all requirements', () => {
      const result = isValidPassword('StrongP@ss123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate password with multiple special characters', () => {
      const result = isValidPassword('P@ssw0rd!#$');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate long password', () => {
      const result = isValidPassword('VeryLongP@ssw0rd123WithManyCharacters');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('invalid passwords - length requirement', () => {
    it('should reject password that is too short', () => {
      const result = isValidPassword('Short1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject very short password', () => {
      const result = isValidPassword('Aa1!');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('invalid passwords - missing character types', () => {
    it('should reject password missing uppercase letter', () => {
      const result = isValidPassword('password123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password missing lowercase letter', () => {
      const result = isValidPassword('PASSWORD123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password missing digit', () => {
      const result = isValidPassword('Password!@#');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one digit');
    });

    it('should reject password missing special character', () => {
      const result = isValidPassword('Password123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });

  describe('invalid passwords - multiple failures', () => {
    it('should return multiple errors for password failing several requirements', () => {
      const result = isValidPassword('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should identify all missing requirements', () => {
      const result = isValidPassword('password');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should reject empty password', () => {
      const result = isValidPassword('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should validate password with whitespace (if allowed)', () => {
      const result = isValidPassword('Strong P@ss 123');
      // Whitespace should be allowed as long as other requirements are met
      expect(result.valid).toBe(true);
    });

    it('should validate very long password', () => {
      const longPassword = 'P@ssw0rd' + 'a'.repeat(100);
      const result = isValidPassword(longPassword);
      expect(result.valid).toBe(true);
    });
  });

  describe('return value structure', () => {
    it('should return object with valid and errors properties', () => {
      const result = isValidPassword('StrongP@ss123');
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should return empty errors array for valid password', () => {
      const result = isValidPassword('ValidP@ss123');
      expect(result.errors).toEqual([]);
    });

    it('should return non-empty errors array for invalid password', () => {
      const result = isValidPassword('weak');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// URL Validation Tests
// ============================================================================

describe('isValidUrl', () => {
  describe('valid URL formats', () => {
    it('should validate simple HTTP URL', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should validate simple HTTPS URL', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('should validate URL with subdomain', () => {
      expect(isValidUrl('https://www.example.com')).toBe(true);
    });

    it('should validate URL with path', () => {
      expect(isValidUrl('https://example.com/path/to/page')).toBe(true);
    });

    it('should validate URL with query parameters', () => {
      expect(isValidUrl('https://example.com/page?query=value')).toBe(true);
    });

    it('should validate URL with multiple query parameters', () => {
      expect(isValidUrl('https://example.com/page?param1=value1&param2=value2')).toBe(true);
    });

    it('should validate URL with fragment', () => {
      expect(isValidUrl('https://example.com/page#section')).toBe(true);
    });

    it('should validate URL with port', () => {
      expect(isValidUrl('https://example.com:8080/path')).toBe(true);
    });

    it('should validate URL with hyphenated domain', () => {
      expect(isValidUrl('https://my-domain.com')).toBe(true);
    });
  });

  describe('invalid URL formats', () => {
    it('should reject URL missing protocol', () => {
      expect(isValidUrl('example.com')).toBe(false);
    });

    it('should reject URL with FTP protocol', () => {
      expect(isValidUrl('ftp://example.com')).toBe(false);
    });

    it('should reject URL with file protocol', () => {
      expect(isValidUrl('file:///path/to/file')).toBe(false);
    });

    it('should reject malformed URL', () => {
      expect(isValidUrl('http:/example.com')).toBe(false);
    });

    it('should reject URL with spaces', () => {
      expect(isValidUrl('http://example .com')).toBe(false);
    });

    it('should reject plain text', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
    });

    it('should reject URL with invalid characters', () => {
      expect(isValidUrl('https://example.com/<script>')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should reject empty string', () => {
      expect(isValidUrl('')).toBe(false);
    });

    it('should trim and validate URL with surrounding whitespace', () => {
      expect(isValidUrl('  https://example.com  ')).toBe(true);
    });

    it('should reject whitespace-only string', () => {
      expect(isValidUrl('   ')).toBe(false);
    });
  });
});

// ============================================================================
// Integer Validation Tests
// ============================================================================

describe('isValidInteger', () => {
  describe('valid integers', () => {
    it('should validate positive integer', () => {
      expect(isValidInteger(42)).toBe(true);
    });

    it('should validate negative integer', () => {
      expect(isValidInteger(-10)).toBe(true);
    });

    it('should validate zero', () => {
      expect(isValidInteger(0)).toBe(true);
    });

    it('should validate large integer', () => {
      expect(isValidInteger(1000000)).toBe(true);
    });

    it('should validate integer string', () => {
      expect(isValidInteger('123')).toBe(true);
    });

    it('should validate negative integer string', () => {
      expect(isValidInteger('-456')).toBe(true);
    });

    it('should validate zero string', () => {
      expect(isValidInteger('0')).toBe(true);
    });
  });

  describe('invalid integers', () => {
    it('should reject float number', () => {
      expect(isValidInteger(3.14)).toBe(false);
    });

    it('should reject float string', () => {
      expect(isValidInteger('3.14')).toBe(false);
    });

    it('should reject string with letters', () => {
      expect(isValidInteger('abc')).toBe(false);
    });

    it('should reject mixed alphanumeric string', () => {
      expect(isValidInteger('123abc')).toBe(false);
    });

    it('should reject NaN', () => {
      expect(isValidInteger(NaN)).toBe(false);
    });

    it('should reject Infinity', () => {
      expect(isValidInteger(Infinity)).toBe(false);
    });

    it('should reject -Infinity', () => {
      expect(isValidInteger(-Infinity)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should reject null', () => {
      expect(isValidInteger(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidInteger(undefined)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidInteger('')).toBe(false);
    });

    it('should reject boolean true', () => {
      expect(isValidInteger(true)).toBe(false);
    });

    it('should reject boolean false', () => {
      expect(isValidInteger(false)).toBe(false);
    });

    it('should reject array', () => {
      expect(isValidInteger([1, 2, 3])).toBe(false);
    });

    it('should reject object', () => {
      expect(isValidInteger({ value: 123 })).toBe(false);
    });
  });
});

// ============================================================================
// Float Validation Tests
// ============================================================================

describe('isValidFloat', () => {
  describe('valid floats', () => {
    it('should validate positive float', () => {
      expect(isValidFloat(3.14)).toBe(true);
    });

    it('should validate negative float', () => {
      expect(isValidFloat(-2.5)).toBe(true);
    });

    it('should validate float with many decimal places', () => {
      expect(isValidFloat(3.14159265359)).toBe(true);
    });

    it('should validate float string', () => {
      expect(isValidFloat('1.5')).toBe(true);
    });

    it('should validate negative float string', () => {
      expect(isValidFloat('-2.5')).toBe(true);
    });

    it('should validate integer as float', () => {
      expect(isValidFloat(42)).toBe(true);
    });

    it('should validate integer string as float', () => {
      expect(isValidFloat('100')).toBe(true);
    });

    it('should validate zero', () => {
      expect(isValidFloat(0)).toBe(true);
    });

    it('should validate zero float', () => {
      expect(isValidFloat(0.0)).toBe(true);
    });
  });

  describe('invalid floats', () => {
    it('should reject string with letters', () => {
      expect(isValidFloat('abc')).toBe(false);
    });

    it('should reject mixed alphanumeric string', () => {
      expect(isValidFloat('1.5abc')).toBe(false);
    });

    it('should reject NaN', () => {
      expect(isValidFloat(NaN)).toBe(false);
    });

    it('should reject Infinity', () => {
      expect(isValidFloat(Infinity)).toBe(false);
    });

    it('should reject -Infinity', () => {
      expect(isValidFloat(-Infinity)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should reject null', () => {
      expect(isValidFloat(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidFloat(undefined)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidFloat('')).toBe(false);
    });

    it('should reject boolean', () => {
      expect(isValidFloat(true)).toBe(false);
    });

    it('should reject array', () => {
      expect(isValidFloat([1.5])).toBe(false);
    });

    it('should reject object', () => {
      expect(isValidFloat({ value: 1.5 })).toBe(false);
    });
  });
});

// ============================================================================
// Range Validation Tests
// ============================================================================

describe('isInRange', () => {
  describe('values within range', () => {
    it('should validate value in middle of range', () => {
      expect(isInRange(5, 1, 10)).toBe(true);
    });

    it('should validate value at minimum boundary (inclusive)', () => {
      expect(isInRange(1, 1, 10)).toBe(true);
    });

    it('should validate value at maximum boundary (inclusive)', () => {
      expect(isInRange(10, 1, 10)).toBe(true);
    });

    it('should validate float within range', () => {
      expect(isInRange(5.5, 1.0, 10.0)).toBe(true);
    });

    it('should validate zero in range including zero', () => {
      expect(isInRange(0, -10, 10)).toBe(true);
    });
  });

  describe('values outside range', () => {
    it('should reject value below minimum', () => {
      expect(isInRange(0, 1, 10)).toBe(false);
    });

    it('should reject value above maximum', () => {
      expect(isInRange(11, 1, 10)).toBe(false);
    });

    it('should reject value far below minimum', () => {
      expect(isInRange(-100, 1, 10)).toBe(false);
    });

    it('should reject value far above maximum', () => {
      expect(isInRange(1000, 1, 10)).toBe(false);
    });
  });

  describe('negative ranges', () => {
    it('should validate value in negative range', () => {
      expect(isInRange(-5, -10, -1)).toBe(true);
    });

    it('should validate at negative range boundaries', () => {
      expect(isInRange(-10, -10, -1)).toBe(true);
      expect(isInRange(-1, -10, -1)).toBe(true);
    });

    it('should reject value outside negative range', () => {
      expect(isInRange(-11, -10, -1)).toBe(false);
      expect(isInRange(0, -10, -1)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle range where min equals max', () => {
      expect(isInRange(5, 5, 5)).toBe(true);
      expect(isInRange(4, 5, 5)).toBe(false);
      expect(isInRange(6, 5, 5)).toBe(false);
    });

    it('should reject NaN value', () => {
      expect(isInRange(NaN, 1, 10)).toBe(false);
    });

    it('should reject when min is NaN', () => {
      expect(isInRange(5, NaN, 10)).toBe(false);
    });

    it('should reject when max is NaN', () => {
      expect(isInRange(5, 1, NaN)).toBe(false);
    });

    it('should handle very small floating point differences', () => {
      expect(isInRange(0.1 + 0.2, 0.3, 0.3)).toBe(true);
    });
  });
});

// ============================================================================
// File Type Validation Tests
// ============================================================================

describe('isValidFileType', () => {
  describe('valid file types', () => {
    it('should validate PDF file', () => {
      expect(isValidFileType('document.pdf', ['pdf', 'doc'])).toBe(true);
    });

    it('should validate JPG image', () => {
      expect(isValidFileType('photo.jpg', ['jpg', 'png', 'gif'])).toBe(true);
    });

    it('should validate PNG image', () => {
      expect(isValidFileType('image.png', ['jpg', 'png'])).toBe(true);
    });

    it('should validate case-insensitive extension (uppercase)', () => {
      expect(isValidFileType('IMAGE.JPG', ['jpg', 'png'])).toBe(true);
    });

    it('should validate case-insensitive extension (mixed case)', () => {
      expect(isValidFileType('Photo.JpG', ['jpg', 'png'])).toBe(true);
    });

    it('should validate file with multiple dots in name', () => {
      expect(isValidFileType('my.file.name.pdf', ['pdf', 'doc'])).toBe(true);
    });

    it('should validate file with long extension', () => {
      expect(isValidFileType('archive.tar.gz', ['tar.gz'])).toBe(false); // Only checks last extension
      expect(isValidFileType('archive.tar.gz', ['gz'])).toBe(true);
    });
  });

  describe('invalid file types', () => {
    it('should reject disallowed extension', () => {
      expect(isValidFileType('script.exe', ['pdf', 'jpg'])).toBe(false);
    });

    it('should reject file with no extension', () => {
      expect(isValidFileType('noextension', ['pdf', 'txt'])).toBe(false);
    });

    it('should reject file ending with dot', () => {
      expect(isValidFileType('filename.', ['pdf', 'txt'])).toBe(false);
    });

    it('should reject different extension', () => {
      expect(isValidFileType('document.docx', ['pdf', 'txt'])).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should reject empty filename', () => {
      expect(isValidFileType('', ['pdf', 'jpg'])).toBe(false);
    });

    it('should reject when allowed types is empty array', () => {
      expect(isValidFileType('document.pdf', [])).toBe(false);
    });

    it('should validate single character extension', () => {
      expect(isValidFileType('file.c', ['c', 'h'])).toBe(true);
    });

    it('should handle allowed types with different cases', () => {
      expect(isValidFileType('file.PDF', ['PDF'])).toBe(true);
      expect(isValidFileType('file.pdf', ['PDF'])).toBe(true);
    });

    it('should reject dot-only filename', () => {
      expect(isValidFileType('.', ['pdf'])).toBe(false);
    });

    it('should handle hidden files (starting with dot)', () => {
      expect(isValidFileType('.htaccess', ['htaccess'])).toBe(false); // No extension after dot
    });
  });
});

// ============================================================================
// File Size Validation Tests
// ============================================================================

describe('isValidFileSize', () => {
  describe('valid file sizes', () => {
    it('should validate size within limit', () => {
      expect(isValidFileSize(1024, 2048)).toBe(true);
    });

    it('should validate size at exact limit (boundary)', () => {
      expect(isValidFileSize(2048, 2048)).toBe(true);
    });

    it('should validate very small file', () => {
      expect(isValidFileSize(1, 1000)).toBe(true);
    });

    it('should validate zero size file', () => {
      expect(isValidFileSize(0, 1000)).toBe(true);
    });

    it('should validate with default max size', () => {
      expect(isValidFileSize(1000)).toBe(true);
    });
  });

  describe('invalid file sizes', () => {
    it('should reject size over limit', () => {
      expect(isValidFileSize(3000, 2048)).toBe(false);
    });

    it('should reject size far over limit', () => {
      expect(isValidFileSize(100000, 2048)).toBe(false);
    });

    it('should reject negative file size', () => {
      expect(isValidFileSize(-100, 2048)).toBe(false);
    });

    it('should reject negative max size', () => {
      expect(isValidFileSize(1000, -1)).toBe(false);
    });

    it('should reject zero max size', () => {
      expect(isValidFileSize(1000, 0)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should reject NaN file size', () => {
      expect(isValidFileSize(NaN, 2048)).toBe(false);
    });

    it('should reject NaN max size', () => {
      expect(isValidFileSize(1024, NaN)).toBe(false);
    });

    it('should reject Infinity file size', () => {
      expect(isValidFileSize(Infinity, 2048)).toBe(false);
    });

    it('should handle very large file sizes', () => {
      expect(isValidFileSize(5 * 1024 * 1024, 10 * 1024 * 1024)).toBe(true);
    });

    it('should handle boundary condition precisely', () => {
      expect(isValidFileSize(1024, 1024)).toBe(true);
      expect(isValidFileSize(1025, 1024)).toBe(false);
    });
  });
});

// ============================================================================
// Required Field Validation Tests
// ============================================================================

describe('validateRequired', () => {
  describe('valid non-empty values', () => {
    it('should validate non-empty string', () => {
      expect(validateRequired('hello')).toBe(true);
    });

    it('should validate string with content', () => {
      expect(validateRequired('some text')).toBe(true);
    });

    it('should validate number zero', () => {
      expect(validateRequired(0)).toBe(true);
    });

    it('should validate positive number', () => {
      expect(validateRequired(123)).toBe(true);
    });

    it('should validate negative number', () => {
      expect(validateRequired(-456)).toBe(true);
    });

    it('should validate boolean true', () => {
      expect(validateRequired(true)).toBe(true);
    });

    it('should validate boolean false', () => {
      expect(validateRequired(false)).toBe(true);
    });

    it('should validate non-empty array', () => {
      expect(validateRequired([1, 2, 3])).toBe(true);
    });

    it('should validate non-empty object', () => {
      expect(validateRequired({ key: 'value' })).toBe(true);
    });
  });

  describe('invalid empty values', () => {
    it('should reject empty string', () => {
      expect(validateRequired('')).toBe(false);
    });

    it('should reject whitespace-only string', () => {
      expect(validateRequired('   ')).toBe(false);
    });

    it('should reject null', () => {
      expect(validateRequired(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(validateRequired(undefined)).toBe(false);
    });

    it('should reject empty array', () => {
      expect(validateRequired([])).toBe(false);
    });

    it('should reject empty object', () => {
      expect(validateRequired({})).toBe(false);
    });

    it('should reject NaN', () => {
      expect(validateRequired(NaN)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should validate string with only newline', () => {
      expect(validateRequired('\n')).toBe(true);
    });

    it('should validate string with tab character', () => {
      expect(validateRequired('\t')).toBe(true);
    });

    it('should handle single space (after trim)', () => {
      expect(validateRequired(' ')).toBe(false);
    });
  });
});

// ============================================================================
// Minimum Length Validation Tests
// ============================================================================

describe('validateMinLength', () => {
  describe('strings meeting minimum length', () => {
    it('should validate string longer than minimum', () => {
      expect(validateMinLength('hello', 3)).toBe(true);
    });

    it('should validate string at exact minimum length (boundary)', () => {
      expect(validateMinLength('abc', 3)).toBe(true);
    });

    it('should validate long string', () => {
      expect(validateMinLength('this is a long string', 5)).toBe(true);
    });

    it('should trim whitespace before checking length', () => {
      expect(validateMinLength('   text   ', 4)).toBe(true);
    });

    it('should validate with minimum length of 0', () => {
      expect(validateMinLength('', 0)).toBe(false); // Empty string still fails
      expect(validateMinLength('a', 0)).toBe(true);
    });

    it('should validate with minimum length of 1', () => {
      expect(validateMinLength('a', 1)).toBe(true);
    });
  });

  describe('strings shorter than minimum length', () => {
    it('should reject string shorter than minimum', () => {
      expect(validateMinLength('hi', 3)).toBe(false);
    });

    it('should reject single character when minimum is 2', () => {
      expect(validateMinLength('a', 2)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateMinLength('', 5)).toBe(false);
    });

    it('should reject whitespace-only string shorter than minimum', () => {
      expect(validateMinLength('  ', 3)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should reject negative minimum length', () => {
      expect(validateMinLength('hello', -5)).toBe(false);
    });

    it('should handle very large minimum length', () => {
      expect(validateMinLength('short', 1000)).toBe(false);
    });

    it('should handle string with special characters', () => {
      expect(validateMinLength('hello!@#', 5)).toBe(true);
    });

    it('should count Unicode characters correctly', () => {
      expect(validateMinLength('😀😀😀', 3)).toBe(true); // Emoji count as 3 characters with proper handling
      expect(validateMinLength('hello', 5)).toBe(true);
    });
  });
});

// ============================================================================
// Maximum Length Validation Tests
// ============================================================================

describe('validateMaxLength', () => {
  describe('strings within maximum length', () => {
    it('should validate string shorter than maximum', () => {
      expect(validateMaxLength('hello', 10)).toBe(true);
    });

    it('should validate string at exact maximum length (boundary)', () => {
      expect(validateMaxLength('hello', 5)).toBe(true);
    });

    it('should validate empty string', () => {
      expect(validateMaxLength('', 5)).toBe(true);
    });

    it('should trim whitespace before checking length', () => {
      expect(validateMaxLength('   text   ', 4)).toBe(true);
    });

    it('should validate single character', () => {
      expect(validateMaxLength('a', 5)).toBe(true);
    });
  });

  describe('strings exceeding maximum length', () => {
    it('should reject string longer than maximum', () => {
      expect(validateMaxLength('very long text', 5)).toBe(false);
    });

    it('should reject string one character over maximum', () => {
      expect(validateMaxLength('hello!', 5)).toBe(false);
    });

    it('should reject very long string', () => {
      expect(validateMaxLength('a'.repeat(100), 50)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should reject negative maximum length', () => {
      expect(validateMaxLength('hello', -5)).toBe(false);
    });

    it('should validate with maximum length of 0', () => {
      expect(validateMaxLength('', 0)).toBe(true);
      expect(validateMaxLength('a', 0)).toBe(false);
    });

    it('should handle very large maximum length', () => {
      expect(validateMaxLength('short', 1000000)).toBe(true);
    });

    it('should handle string with special characters', () => {
      expect(validateMaxLength('hi!', 5)).toBe(true);
    });

    it('should handle whitespace string within limit', () => {
      expect(validateMaxLength('   ', 5)).toBe(true);
    });
  });
});

// ============================================================================
// Pattern Validation Tests
// ============================================================================

describe('validatePattern', () => {
  describe('matching patterns', () => {
    it('should validate string matching digits-only pattern', () => {
      expect(validatePattern('12345', /^\d+$/)).toBe(true);
    });

    it('should validate string matching letters-only pattern', () => {
      expect(validatePattern('hello', /^[a-z]+$/)).toBe(true);
    });

    it('should validate string matching phone number pattern', () => {
      expect(validatePattern('(123) 456-7890', /^\(\d{3}\) \d{3}-\d{4}$/)).toBe(true);
    });

    it('should validate string matching email-like pattern', () => {
      expect(validatePattern('user@example.com', /^[\w.]+@[\w.]+\.\w+$/)).toBe(true);
    });

    it('should validate string matching alphanumeric pattern', () => {
      expect(validatePattern('abc123', /^[a-z0-9]+$/)).toBe(true);
    });

    it('should validate string matching postal code pattern', () => {
      expect(validatePattern('12345', /^\d{5}$/)).toBe(true);
    });

    it('should validate string matching hex color pattern', () => {
      expect(validatePattern('#FF5733', /^#[0-9A-F]{6}$/i)).toBe(true);
    });
  });

  describe('non-matching patterns', () => {
    it('should reject string not matching digits-only pattern', () => {
      expect(validatePattern('abc123', /^\d+$/)).toBe(false);
    });

    it('should reject string not matching letters-only pattern', () => {
      expect(validatePattern('hello123', /^[a-z]+$/)).toBe(false);
    });

    it('should reject string not matching phone number pattern', () => {
      expect(validatePattern('1234567890', /^\(\d{3}\) \d{3}-\d{4}$/)).toBe(false);
    });

    it('should reject partial match when full match required', () => {
      expect(validatePattern('123abc', /^\d+$/)).toBe(false);
    });

    it('should reject empty string matching against pattern', () => {
      expect(validatePattern('', /^\d+$/)).toBe(false);
    });
  });

  describe('various regex patterns', () => {
    it('should validate URL pattern', () => {
      expect(validatePattern('https://example.com', /^https?:\/\/.+/)).toBe(true);
    });

    it('should validate date pattern (YYYY-MM-DD)', () => {
      expect(validatePattern('2024-01-15', /^\d{4}-\d{2}-\d{2}$/)).toBe(true);
      expect(validatePattern('24-01-15', /^\d{4}-\d{2}-\d{2}$/)).toBe(false);
    });

    it('should validate time pattern (HH:MM)', () => {
      expect(validatePattern('14:30', /^\d{2}:\d{2}$/)).toBe(true);
    });

    it('should validate IPv4 address pattern', () => {
      const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      expect(validatePattern('192.168.1.1', ipv4Pattern)).toBe(true);
    });

    it('should validate custom identifier pattern', () => {
      expect(validatePattern('ID_12345', /^ID_\d{5}$/)).toBe(true);
      expect(validatePattern('ID_123', /^ID_\d{5}$/)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should reject empty string', () => {
      expect(validatePattern('', /^.+$/)).toBe(false);
    });

    it('should reject whitespace-only string', () => {
      expect(validatePattern('   ', /^\S+$/)).toBe(false);
    });

    it('should handle case-sensitive patterns', () => {
      expect(validatePattern('HELLO', /^[a-z]+$/)).toBe(false);
      expect(validatePattern('HELLO', /^[A-Z]+$/)).toBe(true);
    });

    it('should handle case-insensitive patterns', () => {
      expect(validatePattern('Hello', /^[a-z]+$/i)).toBe(true);
    });

    it('should validate pattern with special regex characters', () => {
      expect(validatePattern('test.file', /^[\w.]+$/)).toBe(true);
    });
  });
});
