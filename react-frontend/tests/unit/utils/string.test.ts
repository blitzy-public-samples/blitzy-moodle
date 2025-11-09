/**
 * Unit Tests for String Utilities
 *
 * Comprehensive test suite validating all string manipulation functions including
 * truncation, capitalization, HTML sanitization, and formatting operations.
 * Tests cover happy paths, edge cases, boundary conditions, and security concerns.
 *
 * @module tests/unit/utils/string
 */

import { describe, it, expect } from 'vitest';
import {
  isEmpty,
  truncate,
  capitalize,
  capitalizeWords,
  escapeHtml,
  stripHtml,
  sanitizeHtml,
  breakLongWords,
  slugify,
  formatFullName,
} from '@/utils/string';

describe('string utilities', () => {
  describe('isEmpty', () => {
    it('should return true for null', () => {
      expect(isEmpty(null)).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(isEmpty(undefined)).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(isEmpty('')).toBe(true);
    });

    it('should return true for whitespace-only string', () => {
      expect(isEmpty('   ')).toBe(true);
      expect(isEmpty('\t')).toBe(true);
      expect(isEmpty('\n')).toBe(true);
      expect(isEmpty('  \t\n  ')).toBe(true);
    });

    it('should return false for non-empty string', () => {
      expect(isEmpty('hello')).toBe(false);
      expect(isEmpty('a')).toBe(false);
      expect(isEmpty(' text ')).toBe(false);
    });
  });

  describe('truncate', () => {
    it('should truncate long strings with default ellipsis', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...');
      expect(truncate('This is a longer sentence', 10)).toBe('This is...');
    });

    it('should truncate with custom ellipsis', () => {
      expect(truncate('Hello World', 8, '…')).toBe('Hello …');
      expect(truncate('Long text here', 9, ' [more]')).toBe('L [more]');
    });

    it('should not truncate strings shorter than maxLength', () => {
      expect(truncate('Short', 10)).toBe('Short');
      expect(truncate('Test', 20)).toBe('Test');
    });

    it('should handle exact maxLength boundary', () => {
      expect(truncate('Exactly10!', 10)).toBe('Exactly10!');
      expect(truncate('Exactly11!!', 11)).toBe('Exactly11!!');
    });

    it('should return empty string for empty input', () => {
      expect(truncate('', 5)).toBe('');
    });

    it('should handle maxLength smaller than ellipsis', () => {
      expect(truncate('Hello World', 2, '...')).toBe('..');
      expect(truncate('Test', 1, '...')).toBe('.');
    });

    it('should handle zero or negative maxLength', () => {
      expect(truncate('Test', 0)).toBe('');
      expect(truncate('Test', -5)).toBe('');
    });

    it('should trim whitespace before adding ellipsis', () => {
      expect(truncate('Hello World Test', 11)).toBe('Hello...');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter of lowercase string', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('world')).toBe('World');
    });

    it('should handle already capitalized string', () => {
      expect(capitalize('Hello')).toBe('Hello');
      expect(capitalize('World')).toBe('World');
    });

    it('should handle all uppercase string', () => {
      expect(capitalize('HELLO')).toBe('HELLO');
      expect(capitalize('WORLD')).toBe('WORLD');
    });

    it('should return empty string for empty input', () => {
      expect(capitalize('')).toBe('');
    });

    it('should capitalize single character', () => {
      expect(capitalize('h')).toBe('H');
      expect(capitalize('a')).toBe('A');
    });

    it('should handle string starting with number', () => {
      expect(capitalize('123hello')).toBe('123hello');
      expect(capitalize('9test')).toBe('9test');
    });

    it('should capitalize first letter only, leaving rest unchanged', () => {
      expect(capitalize('hELLO')).toBe('HELLO');
      expect(capitalize('mixedCase')).toBe('MixedCase');
    });
  });

  describe('capitalizeWords', () => {
    it('should transform to title case', () => {
      expect(capitalizeWords('hello world')).toBe('Hello World');
      expect(capitalizeWords('the quick brown fox')).toBe('The Quick Brown Fox');
    });

    it('should capitalize multiple words separated by spaces', () => {
      expect(capitalizeWords('one two three')).toBe('One Two Three');
      expect(capitalizeWords('react is awesome')).toBe('React Is Awesome');
    });

    it('should handle words with mixed case', () => {
      expect(capitalizeWords('hELLO wORLD')).toBe('HELLO WORLD');
      expect(capitalizeWords('mIxEd CaSe')).toBe('MIxEd CaSe');
    });

    it('should return empty string for empty input', () => {
      expect(capitalizeWords('')).toBe('');
    });

    it('should capitalize single word', () => {
      expect(capitalizeWords('hello')).toBe('Hello');
      expect(capitalizeWords('test')).toBe('Test');
    });

    it('should handle multiple spaces between words', () => {
      expect(capitalizeWords('hello  world')).toBe('Hello  World');
      expect(capitalizeWords('one   two    three')).toBe('One   Two    Three');
    });

    it('should capitalize after hyphens and other word boundaries', () => {
      expect(capitalizeWords('hello-world')).toBe('Hello-World');
      expect(capitalizeWords('test_case')).toBe('Test_Case');
    });
  });

  describe('escapeHtml', () => {
    it('should escape less than to &lt;', () => {
      expect(escapeHtml('<')).toBe('&lt;');
      expect(escapeHtml('< div')).toBe('&lt; div');
    });

    it('should escape greater than to &gt;', () => {
      expect(escapeHtml('>')).toBe('&gt;');
      expect(escapeHtml('div >')).toBe('div &gt;');
    });

    it('should escape ampersand to &amp;', () => {
      expect(escapeHtml('&')).toBe('&amp;');
      expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    it('should escape double quotes to &quot;', () => {
      expect(escapeHtml('"')).toBe('&quot;');
      expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    });

    it('should escape single quotes to &#x27;', () => {
      expect(escapeHtml("'")).toBe('&#x27;');
      expect(escapeHtml("it's")).toBe('it&#x27;s');
    });

    it('should escape complete HTML tags', () => {
      expect(escapeHtml('<div>Hello</div>')).toBe('&lt;div&gt;Hello&lt;/div&gt;');
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('should handle string without special characters', () => {
      expect(escapeHtml('plain text')).toBe('plain text');
      expect(escapeHtml('1234567890')).toBe('1234567890');
    });

    it('should return empty string for empty input', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle multiple special characters', () => {
      expect(escapeHtml('<div class="test" data-value=\'5\'>A & B</div>')).toBe(
        '&lt;div class=&quot;test&quot; data-value=&#x27;5&#x27;&gt;A &amp; B&lt;/div&gt;'
      );
    });
  });

  describe('stripHtml', () => {
    it('should remove simple HTML tags', () => {
      expect(stripHtml('<p>Hello</p>')).toBe('Hello');
      expect(stripHtml('<div>Test</div>')).toBe('Test');
      expect(stripHtml('<span>Text</span>')).toBe('Text');
    });

    it('should remove nested tags', () => {
      expect(stripHtml('<div><p>Hello <strong>World</strong></p></div>')).toBe(
        'Hello World'
      );
      expect(stripHtml('<ul><li>Item 1</li><li>Item 2</li></ul>')).toBe('Item 1 Item 2');
    });

    it('should remove self-closing tags', () => {
      expect(stripHtml('Line 1<br/>Line 2')).toBe('Line 1 Line 2');
      expect(stripHtml('Image: <img src="test.jpg" />')).toBe('Image:');
    });

    it('should preserve string without HTML tags', () => {
      expect(stripHtml('No tags here')).toBe('No tags here');
      expect(stripHtml('Plain text content')).toBe('Plain text content');
    });

    it('should return empty string for empty input', () => {
      expect(stripHtml('')).toBe('');
    });

    it('should remove script tags', () => {
      expect(stripHtml('<script>alert("xss")</script>')).toBe('alert("xss")');
      expect(stripHtml('Before<script>code</script>After')).toBe('Before code After');
    });

    it('should decode HTML entities', () => {
      expect(stripHtml('&amp;')).toBe('&');
      expect(stripHtml('&lt;&gt;')).toBe('<>');
      expect(stripHtml('&quot;')).toBe('"');
      expect(stripHtml('&nbsp;')).toBe(' ');
    });

    it('should collapse multiple spaces to single space', () => {
      expect(stripHtml('<p>Multiple   spaces</p>')).toBe('Multiple spaces');
      expect(stripHtml('<div>Text    with     gaps</div>')).toBe('Text with gaps');
    });

    it('should handle complex HTML structures', () => {
      const html = '<div class="content"><h1>Title</h1><p>Paragraph <em>text</em></p></div>';
      expect(stripHtml(html)).toBe('Title Paragraph text');
    });
  });

  describe('sanitizeHtml', () => {
    it('should preserve safe HTML tags', () => {
      expect(sanitizeHtml('<p>Safe content</p>')).toBe('<p>Safe content</p>');
      expect(sanitizeHtml('<strong>Bold text</strong>')).toBe('<strong>Bold text</strong>');
      expect(sanitizeHtml('<em>Italic</em>')).toBe('<em>Italic</em>');
    });

    it('should remove script tags completely', () => {
      expect(sanitizeHtml('<script>alert("xss")</script>')).toBe('');
      expect(sanitizeHtml('Before<script>code</script>After')).toBe('BeforeAfter');
    });

    it('should remove style tags completely', () => {
      expect(sanitizeHtml('<style>body{color:red}</style>')).toBe('');
      expect(sanitizeHtml('Text<style>.class{}</style>More')).toBe('TextMore');
    });

    it('should remove event handlers from tags', () => {
      expect(sanitizeHtml('<p onclick="alert()">Text</p>')).toBe('<p>Text</p>');
      expect(sanitizeHtml('<div onload="malicious()">Content</div>')).toBe(
        '<div>Content</div>'
      );
      expect(sanitizeHtml('<a href="#" onmouseover="hack()">Link</a>')).toBe('<a>Link</a>');
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizeHtml('<a href="javascript:alert()">Link</a>')).not.toContain(
        'javascript:'
      );
    });

    it('should remove data: protocol', () => {
      expect(sanitizeHtml('<img src="data:text/html,<script>alert()</script>">')).not.toContain(
        'data:text/html'
      );
    });

    it('should return empty string for empty input', () => {
      expect(sanitizeHtml('')).toBe('');
    });

    it('should strip disallowed tags', () => {
      expect(sanitizeHtml('<iframe>content</iframe>')).toBe('content');
      expect(sanitizeHtml('<object>data</object>')).toBe('data');
      expect(sanitizeHtml('<embed>plugin</embed>')).toBe('plugin');
    });

    it('should preserve safe link tags with href', () => {
      const result = sanitizeHtml('<a href="https://example.com">Link</a>');
      expect(result).toContain('<a href=');
      expect(result).toContain('example.com');
      expect(result).toContain('Link</a>');
    });

    it('should handle nested safe tags', () => {
      expect(sanitizeHtml('<p>Text with <strong>bold</strong> and <em>italic</em></p>')).toBe(
        '<p>Text with <strong>bold</strong> and <em>italic</em></p>'
      );
    });

    it('should protect against XSS attack vectors', () => {
      const xssAttempts = [
        '<img src=x onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '<body onload="alert(1)">',
        '<input onfocus="alert(1)" autofocus>',
      ];

      xssAttempts.forEach((xss) => {
        const result = sanitizeHtml(xss);
        expect(result).not.toContain('alert');
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('onload');
        expect(result).not.toContain('onfocus');
      });
    });

    it('should handle mixed safe and dangerous content', () => {
      const mixed = '<p>Safe</p><script>alert(1)</script><strong>Bold</strong>';
      const result = sanitizeHtml(mixed);
      expect(result).toContain('<p>Safe</p>');
      expect(result).toContain('<strong>Bold</strong>');
      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
    });
  });

  describe('breakLongWords', () => {
    it('should break words longer than maxLength', () => {
      expect(breakLongWords('verylongwordthatkeepsgoing', 10)).toBe(
        'verylongwo rdthatkeep sgoing'
      );
      expect(breakLongWords('superlongtext', 5)).toBe('super longt ext');
    });

    it('should preserve short words', () => {
      expect(breakLongWords('short words here', 20)).toBe('short words here');
      expect(breakLongWords('test case', 10)).toBe('test case');
    });

    it('should break with custom maxLength', () => {
      expect(breakLongWords('verylongword', 4)).toBe('very long word');
      expect(breakLongWords('teststring', 3)).toBe('tes tst rin g');
    });

    it('should use default maxLength of 20', () => {
      const longWord = 'a'.repeat(25);
      const result = breakLongWords(longWord);
      expect(result).toContain(' ');
      expect(result.split(' ')[0]).toHaveLength(20);
    });

    it('should return empty string for empty input', () => {
      expect(breakLongWords('')).toBe('');
    });

    it('should handle multiple long words', () => {
      const text = 'verylongfirstword anotherlongword';
      const result = breakLongWords(text, 8);
      expect(result).toBe('verylong firstwor d anotherlo ngword');
    });

    it('should preserve whitespace between words', () => {
      expect(breakLongWords('short  long', 5)).toBe('short  long');
      expect(breakLongWords('a   b', 3)).toBe('a   b');
    });

    it('should handle zero or negative maxLength', () => {
      expect(breakLongWords('test', 0)).toBe('');
      expect(breakLongWords('test', -5)).toBe('');
    });

    it('should handle URLs and long identifiers', () => {
      const url = 'http://example.com/very/long/path/to/resource';
      const result = breakLongWords(url, 15);
      expect(result).toContain(' ');
      // Each segment should be max 15 characters
      result.split(' ').forEach((segment) => {
        expect(segment.length).toBeLessThanOrEqual(15);
      });
    });
  });

  describe('slugify', () => {
    it('should convert spaces to hyphens', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('My Course Title')).toBe('my-course-title');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello World!')).toBe('hello-world');
      expect(slugify('Special @#$ Characters')).toBe('special-characters');
      expect(slugify('Test & Example')).toBe('test-example');
    });

    it('should convert to lowercase', () => {
      expect(slugify('UPPERCASE')).toBe('uppercase');
      expect(slugify('MixedCase')).toBe('mixedcase');
    });

    it('should handle accented characters', () => {
      expect(slugify('café')).toBe('cafe');
      expect(slugify('naïve')).toBe('naive');
      expect(slugify('résumé')).toBe('resume');
    });

    it('should replace multiple consecutive spaces', () => {
      expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
      expect(slugify('Too    Many     Gaps')).toBe('too-many-gaps');
    });

    it('should return empty string for empty input', () => {
      expect(slugify('')).toBe('');
    });

    it('should handle numbers in strings', () => {
      expect(slugify('Course 2024')).toBe('course-2024');
      expect(slugify('Assignment 1.5')).toBe('assignment-15');
    });

    it('should remove consecutive hyphens', () => {
      expect(slugify('Test---Multiple---Hyphens')).toBe('test-multiple-hyphens');
      expect(slugify('Word--With--Doubles')).toBe('word-with-doubles');
    });

    it('should trim hyphens from start and end', () => {
      expect(slugify('-Leading Hyphen')).toBe('leading-hyphen');
      expect(slugify('Trailing Hyphen-')).toBe('trailing-hyphen');
      expect(slugify('-Both-')).toBe('both');
    });

    it('should handle underscores', () => {
      expect(slugify('test_with_underscores')).toBe('test-with-underscores');
      expect(slugify('mixed_and spaces')).toBe('mixed-and-spaces');
    });

    it('should create valid URL slugs', () => {
      expect(slugify('My Course Title 2024')).toBe('my-course-title-2024');
      expect(slugify('Introduction to React.js')).toBe('introduction-to-reactjs');
      expect(slugify('Advanced C++ Programming')).toBe('advanced-c-programming');
    });
  });

  describe('formatFullName', () => {
    it('should format with firstlast format (default)', () => {
      expect(formatFullName('John', 'Doe')).toBe('John Doe');
      expect(formatFullName('Jane', 'Smith')).toBe('Jane Smith');
    });

    it('should format with lastfirst format', () => {
      expect(formatFullName('John', 'Doe', 'lastfirst')).toBe('Doe, John');
      expect(formatFullName('Jane', 'Smith', 'lastfirst')).toBe('Smith, Jane');
    });

    it('should handle empty firstName', () => {
      expect(formatFullName('', 'Doe')).toBe('Doe');
      expect(formatFullName('', 'Smith', 'lastfirst')).toBe('Smith');
    });

    it('should handle empty lastName', () => {
      expect(formatFullName('John', '')).toBe('John');
      expect(formatFullName('Jane', '', 'lastfirst')).toBe('Jane');
    });

    it('should return empty string when both names are empty', () => {
      expect(formatFullName('', '')).toBe('');
      expect(formatFullName('', '', 'lastfirst')).toBe('');
    });

    it('should trim whitespace from names', () => {
      expect(formatFullName('  John  ', '  Doe  ')).toBe('John Doe');
      expect(formatFullName(' Jane ', ' Smith ', 'lastfirst')).toBe('Smith, Jane');
    });

    it('should handle single-character names', () => {
      expect(formatFullName('J', 'D')).toBe('J D');
      expect(formatFullName('A', 'B', 'lastfirst')).toBe('B, A');
    });

    it('should handle names with multiple parts', () => {
      expect(formatFullName('Mary Jane', 'Watson')).toBe('Mary Jane Watson');
      expect(formatFullName('Mary', 'Smith Jones', 'lastfirst')).toBe('Smith Jones, Mary');
    });

    it('should handle whitespace-only names as empty', () => {
      expect(formatFullName('   ', 'Doe')).toBe('Doe');
      expect(formatFullName('John', '   ')).toBe('John');
      expect(formatFullName('   ', '   ')).toBe('');
    });
  });
});
