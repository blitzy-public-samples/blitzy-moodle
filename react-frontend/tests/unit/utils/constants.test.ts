/**
 * Unit tests for constants.ts utility file
 *
 * Validates that all application-wide constants are defined with correct values and types:
 * - API configuration (base URLs, timeouts, rate limits)
 * - Pagination defaults
 * - Validation rules and regex patterns
 * - Date and time formatting strings
 * - Moodle capability names
 * - Context level identifiers
 * - File upload constraints
 * - Grade aggregation methods
 * - User role identifiers
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { describe, it, expect } from 'vitest';
import {
  API_BASE_URL,
  API_TIMEOUT,
  API_RATE_LIMIT,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  MAX_USERNAME_LENGTH,
  EMAIL_REGEX,
  USERNAME_REGEX,
  URL_REGEX,
  DATE_FORMAT_SHORT,
  DATE_FORMAT_LONG,
  DATETIME_FORMAT,
  TIME_FORMAT,
  CAPABILITY_VIEW_COURSE,
  CAPABILITY_EDIT_COURSE,
  CAPABILITY_GRADE_ASSIGNMENT,
  CAPABILITY_SUBMIT_ASSIGNMENT,
  CAPABILITY_MANAGE_USERS,
  CONTEXT_SYSTEM,
  CONTEXT_COURSE,
  CONTEXT_MODULE,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
  GRADE_AGGREGATE_MEAN,
  GRADE_AGGREGATE_SUM,
  GRADE_AGGREGATE_WEIGHTED_MEAN,
  ROLE_STUDENT,
  ROLE_TEACHER,
  ROLE_ADMIN,
} from '@/utils/constants';

describe('constants', () => {
  // ==========================================================================
  // API Configuration Constants
  // ==========================================================================

  describe('API Configuration', () => {
    it('should define API_BASE_URL as a string', () => {
      expect(API_BASE_URL).toBeDefined();
      expect(typeof API_BASE_URL).toBe('string');
      expect(API_BASE_URL.length).toBeGreaterThan(0);
    });

    it('should have API_BASE_URL as a valid URL path', () => {
      expect(API_BASE_URL).toBeDefined();
      // Should either be /api/v1 or a full URL
      expect(
        API_BASE_URL.startsWith('/') || API_BASE_URL.startsWith('http')
      ).toBe(true);
    });

    it('should define API_TIMEOUT as a positive number', () => {
      expect(API_TIMEOUT).toBeDefined();
      expect(typeof API_TIMEOUT).toBe('number');
      expect(API_TIMEOUT).toBeGreaterThan(0);
    });

    it('should have API_TIMEOUT in reasonable range (5-60 seconds)', () => {
      expect(API_TIMEOUT).toBeGreaterThanOrEqual(5000); // At least 5 seconds
      expect(API_TIMEOUT).toBeLessThanOrEqual(60000); // At most 60 seconds
    });

    it('should define API_RATE_LIMIT as a positive number', () => {
      expect(API_RATE_LIMIT).toBeDefined();
      expect(typeof API_RATE_LIMIT).toBe('number');
      expect(API_RATE_LIMIT).toBeGreaterThan(0);
    });

    it('should have API_RATE_LIMIT in reasonable range', () => {
      expect(API_RATE_LIMIT).toBeGreaterThanOrEqual(100); // At least 100 requests
      expect(API_RATE_LIMIT).toBeLessThanOrEqual(10000); // At most 10,000 requests
    });
  });

  // ==========================================================================
  // Pagination Constants
  // ==========================================================================

  describe('Pagination', () => {
    it('should define DEFAULT_PAGE_SIZE as a positive integer', () => {
      expect(DEFAULT_PAGE_SIZE).toBeDefined();
      expect(typeof DEFAULT_PAGE_SIZE).toBe('number');
      expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
      expect(Number.isInteger(DEFAULT_PAGE_SIZE)).toBe(true);
    });

    it('should have DEFAULT_PAGE_SIZE in reasonable range (10-50)', () => {
      expect(DEFAULT_PAGE_SIZE).toBeGreaterThanOrEqual(10);
      expect(DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(50);
    });

    it('should define MAX_PAGE_SIZE as a positive integer', () => {
      expect(MAX_PAGE_SIZE).toBeDefined();
      expect(typeof MAX_PAGE_SIZE).toBe('number');
      expect(MAX_PAGE_SIZE).toBeGreaterThan(0);
      expect(Number.isInteger(MAX_PAGE_SIZE)).toBe(true);
    });

    it('should have MAX_PAGE_SIZE greater than DEFAULT_PAGE_SIZE', () => {
      expect(MAX_PAGE_SIZE).toBeGreaterThan(DEFAULT_PAGE_SIZE);
    });

    it('should have MAX_PAGE_SIZE in reasonable range (50-200)', () => {
      expect(MAX_PAGE_SIZE).toBeGreaterThanOrEqual(50);
      expect(MAX_PAGE_SIZE).toBeLessThanOrEqual(200);
    });
  });

  // ==========================================================================
  // Validation Rules - Regular Expressions
  // ==========================================================================

  describe('Validation Rules - Regular Expressions', () => {
    it('should define EMAIL_REGEX as a RegExp object', () => {
      expect(EMAIL_REGEX).toBeDefined();
      expect(EMAIL_REGEX instanceof RegExp).toBe(true);
    });

    it('should validate EMAIL_REGEX matches valid email addresses', () => {
      expect(EMAIL_REGEX.test('user@example.com')).toBe(true);
      expect(EMAIL_REGEX.test('test.user+tag@domain.co.uk')).toBe(true);
      expect(EMAIL_REGEX.test('user_name@sub.domain.com')).toBe(true);
    });

    it('should validate EMAIL_REGEX rejects invalid email addresses', () => {
      expect(EMAIL_REGEX.test('invalid')).toBe(false);
      expect(EMAIL_REGEX.test('@example.com')).toBe(false);
      expect(EMAIL_REGEX.test('user@')).toBe(false);
      expect(EMAIL_REGEX.test('user@.com')).toBe(false);
    });

    it('should define USERNAME_REGEX as a RegExp object', () => {
      expect(USERNAME_REGEX).toBeDefined();
      expect(USERNAME_REGEX instanceof RegExp).toBe(true);
    });

    it('should validate USERNAME_REGEX matches valid usernames', () => {
      expect(USERNAME_REGEX.test('john_doe')).toBe(true);
      expect(USERNAME_REGEX.test('user.name')).toBe(true);
      expect(USERNAME_REGEX.test('user-name')).toBe(true);
      expect(USERNAME_REGEX.test('user@domain')).toBe(true);
      expect(USERNAME_REGEX.test('username123')).toBe(true);
    });

    it('should validate USERNAME_REGEX rejects invalid characters', () => {
      expect(USERNAME_REGEX.test('user name')).toBe(false); // space
      expect(USERNAME_REGEX.test('user#name')).toBe(false); // special char
      expect(USERNAME_REGEX.test('user!name')).toBe(false); // special char
    });

    it('should define URL_REGEX as a RegExp object', () => {
      expect(URL_REGEX).toBeDefined();
      expect(URL_REGEX instanceof RegExp).toBe(true);
    });

    it('should validate URL_REGEX matches valid URLs', () => {
      expect(URL_REGEX.test('http://example.com')).toBe(true);
      expect(URL_REGEX.test('https://example.com')).toBe(true);
      expect(URL_REGEX.test('https://www.example.com/path')).toBe(true);
      expect(URL_REGEX.test('https://sub.domain.com/path?query=value')).toBe(
        true
      );
    });

    it('should validate URL_REGEX rejects invalid URLs', () => {
      expect(URL_REGEX.test('not a url')).toBe(false);
      expect(URL_REGEX.test('ftp://example.com')).toBe(false); // ftp not allowed
      expect(URL_REGEX.test('example.com')).toBe(false); // missing protocol
    });
  });

  // ==========================================================================
  // Validation Rules - Username Constraints
  // ==========================================================================

  describe('Validation Rules - Username Constraints', () => {
    it('should define MIN_USERNAME_LENGTH as a positive integer', () => {
      expect(MIN_USERNAME_LENGTH).toBeDefined();
      expect(typeof MIN_USERNAME_LENGTH).toBe('number');
      expect(MIN_USERNAME_LENGTH).toBeGreaterThan(0);
      expect(Number.isInteger(MIN_USERNAME_LENGTH)).toBe(true);
    });

    it('should have MIN_USERNAME_LENGTH in reasonable range (1-5)', () => {
      expect(MIN_USERNAME_LENGTH).toBeGreaterThanOrEqual(1);
      expect(MIN_USERNAME_LENGTH).toBeLessThanOrEqual(5);
    });

    it('should define MAX_USERNAME_LENGTH as a positive integer', () => {
      expect(MAX_USERNAME_LENGTH).toBeDefined();
      expect(typeof MAX_USERNAME_LENGTH).toBe('number');
      expect(MAX_USERNAME_LENGTH).toBeGreaterThan(0);
      expect(Number.isInteger(MAX_USERNAME_LENGTH)).toBe(true);
    });

    it('should have MAX_USERNAME_LENGTH greater than MIN_USERNAME_LENGTH', () => {
      expect(MAX_USERNAME_LENGTH).toBeGreaterThan(MIN_USERNAME_LENGTH);
    });

    it('should have MAX_USERNAME_LENGTH match Moodle database field constraint', () => {
      expect(MAX_USERNAME_LENGTH).toBe(100);
    });
  });

  // ==========================================================================
  // Validation Rules - Password Requirements
  // ==========================================================================

  describe('Validation Rules - Password Requirements', () => {
    it('should define MIN_PASSWORD_LENGTH as a positive integer', () => {
      expect(MIN_PASSWORD_LENGTH).toBeDefined();
      expect(typeof MIN_PASSWORD_LENGTH).toBe('number');
      expect(MIN_PASSWORD_LENGTH).toBeGreaterThan(0);
      expect(Number.isInteger(MIN_PASSWORD_LENGTH)).toBe(true);
    });

    it('should have MIN_PASSWORD_LENGTH be at least 8 characters (security best practice)', () => {
      expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8);
    });

    it('should have reasonable MIN_PASSWORD_LENGTH (8-20)', () => {
      expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8);
      expect(MIN_PASSWORD_LENGTH).toBeLessThanOrEqual(20);
    });
  });

  // ==========================================================================
  // File Upload Constants
  // ==========================================================================

  describe('File Upload Constants', () => {
    it('should define MAX_FILE_SIZE as a positive number', () => {
      expect(MAX_FILE_SIZE).toBeDefined();
      expect(typeof MAX_FILE_SIZE).toBe('number');
      expect(MAX_FILE_SIZE).toBeGreaterThan(0);
    });

    it('should have MAX_FILE_SIZE in reasonable range (at least 1MB, at most 1GB)', () => {
      const ONE_MB = 1024 * 1024;
      const ONE_GB = 1024 * 1024 * 1024;
      expect(MAX_FILE_SIZE).toBeGreaterThanOrEqual(ONE_MB);
      expect(MAX_FILE_SIZE).toBeLessThanOrEqual(ONE_GB);
    });

    it('should define ALLOWED_FILE_TYPES as an array', () => {
      expect(ALLOWED_FILE_TYPES).toBeDefined();
      expect(Array.isArray(ALLOWED_FILE_TYPES)).toBe(true);
    });

    it('should have ALLOWED_FILE_TYPES contain at least one MIME type', () => {
      expect(ALLOWED_FILE_TYPES.length).toBeGreaterThan(0);
    });

    it('should have ALLOWED_FILE_TYPES contain only strings', () => {
      ALLOWED_FILE_TYPES.forEach((type) => {
        expect(typeof type).toBe('string');
      });
    });

    it('should have ALLOWED_FILE_TYPES contain valid MIME type format', () => {
      ALLOWED_FILE_TYPES.forEach((type) => {
        // MIME types should be in format: type/subtype
        expect(type).toMatch(/^[a-z]+\/[a-z0-9\-+.]+$/i);
      });
    });

    it('should include common document MIME types', () => {
      expect(ALLOWED_FILE_TYPES).toContain('application/pdf');
      expect(ALLOWED_FILE_TYPES).toContain('text/plain');
    });

    it('should include common image MIME types', () => {
      expect(ALLOWED_FILE_TYPES).toContain('image/jpeg');
      expect(ALLOWED_FILE_TYPES).toContain('image/png');
    });
  });

  // ==========================================================================
  // Date and Time Format Constants
  // ==========================================================================

  describe('Date and Time Format Constants', () => {
    it('should define DATE_FORMAT_SHORT as a non-empty string', () => {
      expect(DATE_FORMAT_SHORT).toBeDefined();
      expect(typeof DATE_FORMAT_SHORT).toBe('string');
      expect(DATE_FORMAT_SHORT.length).toBeGreaterThan(0);
    });

    it('should have DATE_FORMAT_SHORT as a valid date-fns format pattern', () => {
      // date-fns uses specific tokens like MM, dd, yyyy
      expect(DATE_FORMAT_SHORT).toMatch(/[MdyHhmsaAZ]/);
    });

    it('should define DATE_FORMAT_LONG as a non-empty string', () => {
      expect(DATE_FORMAT_LONG).toBeDefined();
      expect(typeof DATE_FORMAT_LONG).toBe('string');
      expect(DATE_FORMAT_LONG.length).toBeGreaterThan(0);
    });

    it('should have DATE_FORMAT_LONG as a valid date-fns format pattern', () => {
      // date-fns uses specific tokens like MMMM, dd, yyyy
      expect(DATE_FORMAT_LONG).toMatch(/[MdyHhmsaAZ]/);
    });

    it('should define DATETIME_FORMAT as a non-empty string', () => {
      expect(DATETIME_FORMAT).toBeDefined();
      expect(typeof DATETIME_FORMAT).toBe('string');
      expect(DATETIME_FORMAT.length).toBeGreaterThan(0);
    });

    it('should have DATETIME_FORMAT as a valid date-fns format pattern', () => {
      // Should include both date and time tokens
      expect(DATETIME_FORMAT).toMatch(/[Mdy]/); // date part
      expect(DATETIME_FORMAT).toMatch(/[Hhma]/); // time part
    });

    it('should define TIME_FORMAT as a non-empty string', () => {
      expect(TIME_FORMAT).toBeDefined();
      expect(typeof TIME_FORMAT).toBe('string');
      expect(TIME_FORMAT.length).toBeGreaterThan(0);
    });

    it('should have TIME_FORMAT as a valid date-fns format pattern', () => {
      // Should include time tokens
      expect(TIME_FORMAT).toMatch(/[Hhma]/);
    });

    it('should have DATE_FORMAT_LONG be longer than DATE_FORMAT_SHORT', () => {
      // Long format typically includes more detail
      expect(DATE_FORMAT_LONG.length).toBeGreaterThanOrEqual(
        DATE_FORMAT_SHORT.length
      );
    });
  });

  // ==========================================================================
  // Moodle Capability Constants
  // ==========================================================================

  describe('Moodle Capability Constants', () => {
    it('should define CAPABILITY_VIEW_COURSE as a string', () => {
      expect(CAPABILITY_VIEW_COURSE).toBeDefined();
      expect(typeof CAPABILITY_VIEW_COURSE).toBe('string');
    });

    it('should have CAPABILITY_VIEW_COURSE follow area/object:action pattern', () => {
      expect(CAPABILITY_VIEW_COURSE).toMatch(/^[a-z]+\/[a-z]+:[a-z]+$/);
    });

    it('should have CAPABILITY_VIEW_COURSE be a Moodle core capability', () => {
      expect(CAPABILITY_VIEW_COURSE).toBe('moodle/course:view');
    });

    it('should define CAPABILITY_EDIT_COURSE as a string', () => {
      expect(CAPABILITY_EDIT_COURSE).toBeDefined();
      expect(typeof CAPABILITY_EDIT_COURSE).toBe('string');
    });

    it('should have CAPABILITY_EDIT_COURSE follow area/object:action pattern', () => {
      expect(CAPABILITY_EDIT_COURSE).toMatch(/^[a-z]+\/[a-z]+:[a-z]+$/);
    });

    it('should define CAPABILITY_SUBMIT_ASSIGNMENT as a string', () => {
      expect(CAPABILITY_SUBMIT_ASSIGNMENT).toBeDefined();
      expect(typeof CAPABILITY_SUBMIT_ASSIGNMENT).toBe('string');
    });

    it('should have CAPABILITY_SUBMIT_ASSIGNMENT follow mod/activity:action pattern', () => {
      expect(CAPABILITY_SUBMIT_ASSIGNMENT).toMatch(/^mod\/[a-z]+:[a-z]+$/);
    });

    it('should have CAPABILITY_SUBMIT_ASSIGNMENT be an assignment module capability', () => {
      expect(CAPABILITY_SUBMIT_ASSIGNMENT).toBe('mod/assign:submit');
    });

    it('should define CAPABILITY_GRADE_ASSIGNMENT as a string', () => {
      expect(CAPABILITY_GRADE_ASSIGNMENT).toBeDefined();
      expect(typeof CAPABILITY_GRADE_ASSIGNMENT).toBe('string');
    });

    it('should have CAPABILITY_GRADE_ASSIGNMENT follow mod/activity:action pattern', () => {
      expect(CAPABILITY_GRADE_ASSIGNMENT).toMatch(/^mod\/[a-z]+:[a-z]+$/);
    });

    it('should have CAPABILITY_GRADE_ASSIGNMENT be an assignment module capability', () => {
      expect(CAPABILITY_GRADE_ASSIGNMENT).toBe('mod/assign:grade');
    });

    it('should define CAPABILITY_MANAGE_USERS as a string', () => {
      expect(CAPABILITY_MANAGE_USERS).toBeDefined();
      expect(typeof CAPABILITY_MANAGE_USERS).toBe('string');
    });

    it('should have CAPABILITY_MANAGE_USERS follow area/object:action pattern', () => {
      expect(CAPABILITY_MANAGE_USERS).toMatch(/^[a-z]+\/[a-z]+:[a-z]+$/);
    });

    it('should have CAPABILITY_MANAGE_USERS be a Moodle user capability', () => {
      expect(CAPABILITY_MANAGE_USERS).toBe('moodle/user:update');
    });
  });

  // ==========================================================================
  // Context Level Constants
  // ==========================================================================

  describe('Context Level Constants', () => {
    it('should define CONTEXT_SYSTEM as a number', () => {
      expect(CONTEXT_SYSTEM).toBeDefined();
      expect(typeof CONTEXT_SYSTEM).toBe('number');
    });

    it('should have CONTEXT_SYSTEM match Moodle system context level', () => {
      expect(CONTEXT_SYSTEM).toBe(10);
    });

    it('should define CONTEXT_COURSE as a number', () => {
      expect(CONTEXT_COURSE).toBeDefined();
      expect(typeof CONTEXT_COURSE).toBe('number');
    });

    it('should have CONTEXT_COURSE match Moodle course context level', () => {
      expect(CONTEXT_COURSE).toBe(50);
    });

    it('should define CONTEXT_MODULE as a number', () => {
      expect(CONTEXT_MODULE).toBeDefined();
      expect(typeof CONTEXT_MODULE).toBe('number');
    });

    it('should have CONTEXT_MODULE match Moodle module context level', () => {
      expect(CONTEXT_MODULE).toBe(70);
    });

    it('should have context levels in ascending order', () => {
      // System < Course < Module in Moodle hierarchy
      expect(CONTEXT_SYSTEM).toBeLessThan(CONTEXT_COURSE);
      expect(CONTEXT_COURSE).toBeLessThan(CONTEXT_MODULE);
    });
  });

  // ==========================================================================
  // Grade Aggregation Method Constants
  // ==========================================================================

  describe('Grade Aggregation Method Constants', () => {
    it('should define GRADE_AGGREGATE_MEAN as a number', () => {
      expect(GRADE_AGGREGATE_MEAN).toBeDefined();
      expect(typeof GRADE_AGGREGATE_MEAN).toBe('number');
    });

    it('should have GRADE_AGGREGATE_MEAN match Moodle mean aggregation constant', () => {
      expect(GRADE_AGGREGATE_MEAN).toBe(0);
    });

    it('should define GRADE_AGGREGATE_WEIGHTED_MEAN as a number', () => {
      expect(GRADE_AGGREGATE_WEIGHTED_MEAN).toBeDefined();
      expect(typeof GRADE_AGGREGATE_WEIGHTED_MEAN).toBe('number');
    });

    it('should have GRADE_AGGREGATE_WEIGHTED_MEAN match Moodle weighted mean aggregation constant', () => {
      expect(GRADE_AGGREGATE_WEIGHTED_MEAN).toBe(10);
    });

    it('should define GRADE_AGGREGATE_SUM as a number', () => {
      expect(GRADE_AGGREGATE_SUM).toBeDefined();
      expect(typeof GRADE_AGGREGATE_SUM).toBe('number');
    });

    it('should have GRADE_AGGREGATE_SUM match Moodle sum aggregation constant', () => {
      expect(GRADE_AGGREGATE_SUM).toBe(13);
    });

    it('should have all aggregation methods be non-negative', () => {
      expect(GRADE_AGGREGATE_MEAN).toBeGreaterThanOrEqual(0);
      expect(GRADE_AGGREGATE_WEIGHTED_MEAN).toBeGreaterThanOrEqual(0);
      expect(GRADE_AGGREGATE_SUM).toBeGreaterThanOrEqual(0);
    });

    it('should have unique values for different aggregation methods', () => {
      const methods = [
        GRADE_AGGREGATE_MEAN,
        GRADE_AGGREGATE_WEIGHTED_MEAN,
        GRADE_AGGREGATE_SUM,
      ];
      const uniqueMethods = new Set(methods);
      expect(uniqueMethods.size).toBe(methods.length);
    });
  });

  // ==========================================================================
  // User Role Constants
  // ==========================================================================

  describe('User Role Constants', () => {
    it('should define ROLE_STUDENT as a string', () => {
      expect(ROLE_STUDENT).toBeDefined();
      expect(typeof ROLE_STUDENT).toBe('string');
      expect(ROLE_STUDENT.length).toBeGreaterThan(0);
    });

    it('should have ROLE_STUDENT match Moodle student role shortname', () => {
      expect(ROLE_STUDENT).toBe('student');
    });

    it('should define ROLE_TEACHER as a string', () => {
      expect(ROLE_TEACHER).toBeDefined();
      expect(typeof ROLE_TEACHER).toBe('string');
      expect(ROLE_TEACHER.length).toBeGreaterThan(0);
    });

    it('should have ROLE_TEACHER match Moodle editing teacher role shortname', () => {
      expect(ROLE_TEACHER).toBe('editingteacher');
    });

    it('should define ROLE_ADMIN as a string', () => {
      expect(ROLE_ADMIN).toBeDefined();
      expect(typeof ROLE_ADMIN).toBe('string');
      expect(ROLE_ADMIN.length).toBeGreaterThan(0);
    });

    it('should have ROLE_ADMIN match Moodle administrator role shortname', () => {
      expect(ROLE_ADMIN).toBe('admin');
    });

    it('should have unique values for different roles', () => {
      const roles = [ROLE_STUDENT, ROLE_TEACHER, ROLE_ADMIN];
      const uniqueRoles = new Set(roles);
      expect(uniqueRoles.size).toBe(roles.length);
    });

    it('should have role values contain only lowercase alphanumeric characters', () => {
      [ROLE_STUDENT, ROLE_TEACHER, ROLE_ADMIN].forEach((role) => {
        expect(role).toMatch(/^[a-z0-9]+$/);
      });
    });
  });
});
