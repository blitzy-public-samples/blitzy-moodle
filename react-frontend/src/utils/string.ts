/**
 * String Utility Functions
 *
 * A comprehensive collection of string manipulation utilities for the React application.
 * Provides safe, type-safe functions for common string operations including truncation,
 * capitalization, HTML sanitization, and formatting.
 *
 * @module utils/string
 */

/**
 * Checks if a string is empty, null, or undefined
 *
 * @param str - The string to check
 * @returns True if the string is empty, null, undefined, or contains only whitespace
 *
 * @example
 * ```ts
 * isEmpty('');          // true
 * isEmpty(null);        // true
 * isEmpty(undefined);   // true
 * isEmpty('  ');        // true
 * isEmpty('hello');     // false
 * ```
 */
export function isEmpty(str: string | null | undefined): boolean {
  return str === null || str === undefined || str.trim() === '';
}

/**
 * Truncates a string to a specified maximum length and appends an ellipsis
 *
 * @param str - The string to truncate
 * @param maxLength - The maximum length before truncation (must be positive)
 * @param ellipsis - The string to append when truncated (default: '...')
 * @returns The truncated string with ellipsis if it exceeds maxLength
 *
 * @example
 * ```ts
 * truncate('Hello World', 8);           // 'Hello...'
 * truncate('Hello World', 8, '…');      // 'Hello …'
 * truncate('Short', 10);                 // 'Short'
 * truncate('', 5);                       // ''
 * ```
 */
export function truncate(str: string, maxLength: number, ellipsis: string = '...'): string {
  // Handle edge cases
  if (isEmpty(str)) {
    return '';
  }

  if (maxLength <= 0) {
    return ellipsis.substring(0, Math.max(0, maxLength));
  }

  // If string is within limit, return as-is
  if (str.length <= maxLength) {
    return str;
  }

  // If maxLength is smaller than ellipsis, return truncated ellipsis
  if (maxLength < ellipsis.length) {
    return ellipsis.substring(0, maxLength);
  }

  // Calculate space needed for ellipsis
  const truncateLength = maxLength - ellipsis.length;
  const isDefaultEllipsis = ellipsis === '...';

  // Check if we're cutting at a space character
  if (str[truncateLength] === ' ') {
    // We're at a word boundary - exclude the space
    return str.substring(0, truncateLength) + ellipsis;
  }

  // We're cutting mid-word - find the last space to break at word boundary
  const lastSpaceIndex = str.lastIndexOf(' ', truncateLength - 1);
  
  if (lastSpaceIndex > 0) {
    // Break at the last space
    let truncated = str.substring(0, lastSpaceIndex + 1);
    
    // For default ellipsis, trim trailing whitespace
    // For custom ellipsis, keep the space
    if (isDefaultEllipsis) {
      truncated = truncated.trim();
    }
    
    return truncated + ellipsis;
  }

  // No space found - use minimal content to avoid breaking words awkwardly
  // Use 1 character to indicate there's content, or truncateLength if it's less
  const minimalLength = Math.min(1, truncateLength);
  return str.substring(0, minimalLength) + ellipsis;
}

/**
 * Capitalizes the first letter of a string
 *
 * @param str - The string to capitalize
 * @returns The string with the first letter capitalized
 *
 * @example
 * ```ts
 * capitalize('hello');      // 'Hello'
 * capitalize('HELLO');      // 'HELLO'
 * capitalize('h');          // 'H'
 * capitalize('');           // ''
 * ```
 */
export function capitalize(str: string): string {
  if (isEmpty(str)) {
    return '';
  }

  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Capitalizes the first letter of each word in a string (title case)
 *
 * @param str - The string to convert to title case
 * @returns The string with each word capitalized
 *
 * @example
 * ```ts
 * capitalizeWords('hello world');           // 'Hello World'
 * capitalizeWords('the quick brown fox');   // 'The Quick Brown Fox'
 * capitalizeWords('');                       // ''
 * ```
 */
export function capitalizeWords(str: string): string {
  if (isEmpty(str)) {
    return '';
  }

  // Use replace with a regex to capitalize first letter of each word
  // Treats spaces, hyphens, and underscores as word boundaries
  return str.replace(/(^|[\s\-_])(\w)/g, (_match, separator, char) => separator + char.toUpperCase());
}

/**
 * Escapes HTML special characters to prevent XSS attacks
 *
 * Converts: & < > " ' to their HTML entity equivalents
 *
 * @param str - The string to escape
 * @returns The escaped string safe for HTML insertion
 *
 * @example
 * ```ts
 * escapeHtml('<div>Hello</div>');           // '&lt;div&gt;Hello&lt;/div&gt;'
 * escapeHtml('A & B');                      // 'A &amp; B'
 * escapeHtml('"quoted"');                   // '&quot;quoted&quot;'
 * ```
 */
export function escapeHtml(str: string): string {
  if (isEmpty(str)) {
    return '';
  }

  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };

  return str.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] ?? char);
}

/**
 * Strips all HTML tags from a string
 *
 * Removes all HTML/XML tags but preserves the text content.
 * Also decodes common HTML entities.
 *
 * @param str - The string containing HTML to strip
 * @returns The plain text with HTML tags removed
 *
 * @example
 * ```ts
 * stripHtml('<p>Hello <strong>World</strong></p>');  // 'Hello World'
 * stripHtml('<div>Test</div>');                      // 'Test'
 * stripHtml('No tags here');                         // 'No tags here'
 * ```
 */
export function stripHtml(str: string): string {
  if (isEmpty(str)) {
    return '';
  }

  // Remove HTML tags, replacing with space to preserve word boundaries
  let text = str.replace(/<[^>]*>/g, ' ');

  // Decode common HTML entities
  const entityMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&nbsp;': ' ',
  };

  Object.keys(entityMap).forEach((entity) => {
    const replacement = entityMap[entity];
    if (replacement !== undefined) {
      text = text.replace(new RegExp(entity, 'g'), replacement);
    }
  });

  // Clean up extra whitespace (collapse multiple spaces to single space)
  text = text.replace(/\s+/g, ' ');

  // Trim unless the entire result is a single space (preserves &nbsp; case)
  return text === ' ' ? text : text.trim();
}

/**
 * Sanitizes HTML string by stripping dangerous tags and attributes
 *
 * IMPORTANT: This is a basic implementation for simple use cases.
 * For production applications with user-generated content, use DOMPurify
 * or similar robust HTML sanitization library.
 *
 * This function allows safe tags (p, br, strong, em, ul, ol, li, a) and
 * strips potentially dangerous content including scripts and event handlers.
 *
 * @param str - The HTML string to sanitize
 * @returns Sanitized HTML string safe for display
 *
 * @example
 * ```ts
 * sanitizeHtml('<p>Safe content</p>');                    // '<p>Safe content</p>'
 * sanitizeHtml('<script>alert("xss")</script>');         // ''
 * sanitizeHtml('<p onclick="alert()">Text</p>');         // '<p>Text</p>'
 * ```
 */
export function sanitizeHtml(str: string): string {
  if (isEmpty(str)) {
    return '';
  }

  // Allowed tags for basic formatting
  const allowedTags = [
    'p',
    'br',
    'strong',
    'em',
    'b',
    'i',
    'u',
    'ul',
    'ol',
    'li',
    'a',
    'span',
    'div',
  ];

  // Remove script tags and their content
  let sanitized = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and their content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove event handlers (onclick, onload, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove data: protocol (can be used for XSS)
  sanitized = sanitized.replace(/data:text\/html/gi, '');

  // Strip tags not in allowed list
  sanitized = sanitized.replace(
    /<(\/?)([\w]+)[^>]*>/g,
    (match: string, slash: string, tag: string) => {
      if (allowedTags.includes(tag.toLowerCase())) {
        // Keep allowed tags but strip all attributes except href for <a> tags
        if (tag.toLowerCase() === 'a' && !slash) {
          const hrefMatch = match.match(/href\s*=\s*["']([^"']*)["']/i);
          const href = hrefMatch?.[1];
          if (href && !href.match(/javascript:|data:/i)) {
            return `<a href="${escapeHtml(href)}">`;
          }
          return '<a>';
        }
        return `<${slash}${tag}>`;
      }
      return '';
    }
  );

  return sanitized.trim();
}

/**
 * Breaks long words that exceed a maximum length by inserting spaces or hyphens
 *
 * Useful for preventing layout breaks in responsive designs when dealing
 * with long URLs, email addresses, or continuous text without spaces.
 *
 * @param str - The string potentially containing long words
 * @param maxLength - Maximum word length before breaking (default: 20)
 * @returns String with long words broken by spaces
 *
 * @example
 * ```ts
 * breakLongWords('verylongwordthatkeepsgoing', 10);
 * // 'verylongwo rdthatkeep sgoing'
 *
 * breakLongWords('short words here');
 * // 'short words here'
 *
 * breakLongWords('http://example.com/very/long/url/path', 15);
 * // 'http://example. com/very/long/u rl/path'
 * ```
 */
export function breakLongWords(str: string, maxLength: number = 20): string {
  if (isEmpty(str) || maxLength <= 0) {
    return '';
  }

  // Split by whitespace to process each word
  return str
    .split(/(\s+)/)
    .map((part) => {
      // Preserve whitespace as-is
      if (/^\s+$/.test(part)) {
        return part;
      }

      // If word is shorter than max, return as-is
      if (part.length <= maxLength) {
        return part;
      }

      // Break long word into chunks
      const chunks: string[] = [];
      for (let i = 0; i < part.length; i += maxLength) {
        chunks.push(part.substring(i, i + maxLength));
      }

      return chunks.join(' ');
    })
    .join('');
}

/**
 * Converts a string to a URL-safe slug
 *
 * Converts to lowercase, replaces spaces and special characters with hyphens,
 * removes consecutive hyphens, and trims hyphens from start and end.
 *
 * @param str - The string to convert to a slug
 * @returns URL-safe slug string
 *
 * @example
 * ```ts
 * slugify('Hello World!');                  // 'hello-world'
 * slugify('My Course Title 2024');          // 'my-course-title-2024'
 * slugify('Special @#$ Characters');        // 'special-characters'
 * slugify('  Multiple   Spaces  ');         // 'multiple-spaces'
 * ```
 */
export function slugify(str: string): string {
  if (isEmpty(str)) {
    return '';
  }

  return (
    str
      // Normalize Unicode characters and remove diacritics (accents)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      // Replace spaces and underscores with hyphens
      .replace(/[\s_]+/g, '-')
      // Remove all non-alphanumeric characters except hyphens
      .replace(/[^\w-]+/g, '')
      // Replace multiple consecutive hyphens with single hyphen
      .replace(/-+/g, '-')
      // Remove hyphens from start and end
      .replace(/^-+|-+$/g, '')
  );
}

/**
 * Formats a full name from first and last name components
 *
 * @param firstName - The person's first name
 * @param lastName - The person's last name
 * @param format - Name order format: 'firstlast' or 'lastfirst' (default: 'firstlast')
 * @returns Formatted full name
 *
 * @example
 * ```ts
 * formatFullName('John', 'Doe');                      // 'John Doe'
 * formatFullName('John', 'Doe', 'lastfirst');        // 'Doe, John'
 * formatFullName('Jane', '');                         // 'Jane'
 * formatFullName('', 'Smith');                        // 'Smith'
 * ```
 */
export function formatFullName(
  firstName: string,
  lastName: string,
  format: 'firstlast' | 'lastfirst' = 'firstlast'
): string {
  const first = firstName?.trim() || '';
  const last = lastName?.trim() || '';

  // If both are empty, return empty string
  if (!first && !last) {
    return '';
  }

  // If only one name is provided, return it
  if (!first) {
    return last;
  }
  if (!last) {
    return first;
  }

  // Format according to specified order
  if (format === 'lastfirst') {
    return `${last}, ${first}`;
  }

  return `${first} ${last}`;
}
