/**
 * TypeScript Type Definitions for Moodle Book Activity Module
 *
 * This module provides comprehensive type definitions for the book activity,
 * based on the Moodle database schema (mdl_book and mdl_book_chapters tables).
 *
 * The book module allows teachers to create multi-page learning resources with
 * a book-like format, supporting main chapters and subchapters with various
 * numbering and navigation styles.
 *
 * @module features/activities/book/types
 */

import type { Id, CourseId, Timestamp } from '@/types/common';

// ============================================================================
// Enums - Numbering and Navigation Styles
// ============================================================================

/**
 * Chapter numbering styles for book table of contents
 *
 * Based on Moodle constants from mod/book/locallib.php:
 * - BOOK_NUM_NONE: No special styling, editor controls title display
 * - BOOK_NUM_NUMBERS: Chapters and subchapters numbered (1, 1.1, 1.2, 2, ...)
 * - BOOK_NUM_BULLETS: Subchapters indented with bullet points
 * - BOOK_NUM_INDENTED: Subchapters indented without bullets
 *
 * Database field: book.numbering (int 4, default 0)
 */
export enum BookNumbering {
  /** No numbering - free-form titles */
  NONE = 0,
  /** Hierarchical numbering (1, 1.1, 1.2, 2, 2.1, ...) */
  NUMBERS = 1,
  /** Subchapters displayed with bullet points */
  BULLETS = 2,
  /** Subchapters indented without visual markers */
  INDENTED = 3,
}

/**
 * Navigation style for chapter links
 *
 * Controls how navigation between chapters is displayed:
 * - TEXT: Text-based navigation links
 * - IMAGES: Image-based navigation buttons
 *
 * Database field: book.navstyle (int 4, default 1)
 */
export enum BookNavStyle {
  /** Text-based navigation links */
  TEXT = 0,
  /** Image-based navigation buttons */
  IMAGES = 1,
}

// ============================================================================
// Interfaces - Book and Chapter Entities
// ============================================================================

/**
 * Book instance entity
 *
 * Represents a complete book activity with configuration and metadata.
 * Based on the mdl_book database table structure.
 *
 * @interface Book
 */
export interface Book {
  /**
   * Unique book identifier
   * Database: book.id (int 10, primary key)
   */
  id: Id;

  /**
   * Course identifier this book belongs to
   * Database: book.course (int 10, foreign key to mdl_course)
   */
  course: CourseId;

  /**
   * Book title/name
   * Database: book.name (char 1333, required)
   */
  name: string;

  /**
   * Introduction text displayed before the book content
   * Database: book.intro (text, optional)
   * Can be null if no introduction is provided
   */
  intro: string | null;

  /**
   * Text format for the introduction field
   * Database: book.introformat (int 4, default 0)
   * Values: 0=Moodle, 1=HTML, 2=Plain, 4=Markdown
   */
  introformat: number;

  /**
   * Chapter numbering style configuration
   * Database: book.numbering (int 4, default 0)
   * See BookNumbering enum for possible values
   */
  numbering: BookNumbering;

  /**
   * Navigation style between chapters
   * Database: book.navstyle (int 4, default 1)
   * See BookNavStyle enum for possible values
   */
  navstyle: BookNavStyle;

  /**
   * Whether custom titles are enabled for chapters
   * Database: book.customtitles (int 2, default 0)
   * 0 = auto-generated titles with numbering
   * 1 = custom titles allowed
   */
  customtitles: number;

  /**
   * Book revision number, incremented on each update
   * Database: book.revision (int 10, default 0)
   * Used for cache invalidation and version tracking
   */
  revision: number;

  /**
   * Timestamp when the book was created
   * Database: book.timecreated (int 10, Unix timestamp)
   */
  timecreated: Timestamp;

  /**
   * Timestamp when the book was last modified
   * Database: book.timemodified (int 10, Unix timestamp)
   */
  timemodified: Timestamp;
}

/**
 * Book chapter entity with navigation and hierarchy information
 *
 * Represents a single chapter or subchapter within a book.
 * Based on the mdl_book_chapters database table with computed navigation properties.
 *
 * Chapters form a hierarchical structure:
 * - Main chapters (subchapter=0) can have nested subchapters
 * - Subchapters (subchapter=1) belong to the preceding main chapter
 * - Navigation links connect chapters in sequence
 *
 * @interface Chapter
 */
export interface Chapter {
  /**
   * Unique chapter identifier
   * Database: book_chapters.id (int 10, primary key)
   */
  id: Id;

  /**
   * Parent book identifier
   * Database: book_chapters.bookid (int 10, indexed)
   */
  bookid: Id;

  /**
   * Chapter sequence number (sort order)
   * Database: book_chapters.pagenum (int 10, required)
   * Determines the order chapters appear in the book
   */
  pagenum: number;

  /**
   * Whether this is a subchapter
   * Database: book_chapters.subchapter (int 10, required)
   * 0 = main chapter, 1 = subchapter
   */
  subchapter: number;

  /**
   * Chapter title
   * Database: book_chapters.title (char 1333, required)
   */
  title: string;

  /**
   * Chapter content (HTML)
   * Database: book_chapters.content (text, required)
   */
  content: string;

  /**
   * Content text format
   * Database: book_chapters.contentformat (int 4, default 0)
   * Values: 0=Moodle, 1=HTML, 2=Plain, 4=Markdown
   */
  contentformat: number;

  /**
   * Whether the chapter is hidden from students
   * Database: book_chapters.hidden (int 2, default 0)
   * 0 = visible, 1 = hidden
   */
  hidden: number;

  /**
   * Timestamp when the chapter was created
   * Database: book_chapters.timecreated (int 10, Unix timestamp)
   */
  timecreated: Timestamp;

  /**
   * Timestamp when the chapter was last modified
   * Database: book_chapters.timemodified (int 10, Unix timestamp)
   */
  timemodified: Timestamp;

  /**
   * Import source reference for imported chapters
   * Database: book_chapters.importsrc (char 255, required)
   * Empty string if not imported
   */
  importsrc: string;

  // =========================================================================
  // Computed Navigation Properties (added by book_preload_chapters)
  // =========================================================================

  /**
   * Parent chapter ID for subchapters
   * Computed property: null for main chapters, parent chapter ID for subchapters
   * Set during chapter preprocessing in book_preload_chapters()
   */
  parent: Id | null;

  /**
   * Display number for the chapter
   * Computed property: chapter number or 'x' for hidden numbered chapters
   * Format depends on book.numbering setting:
   * - NUMBERS: "1", "1.1", "1.2", "2", etc.
   * - BULLETS/INDENTED: null
   * - Hidden chapters in NUMBERS mode: "x"
   */
  number: string | number | null;

  /**
   * Previous chapter in reading sequence
   * Computed property: reference to the preceding chapter
   * Used for "Previous" navigation links
   */
  prev: ChapterNavigation | null;

  /**
   * Next chapter in reading sequence
   * Computed property: reference to the following chapter
   * Used for "Next" navigation links
   */
  next: ChapterNavigation | null;

  /**
   * Array of subchapter IDs belonging to this chapter
   * Computed property: populated only for main chapters
   * Empty array or undefined for subchapters
   */
  subchapters?: Id[];

  /**
   * Tags associated with this chapter
   * Computed property: populated from core_tag_tag::get_item_tags()
   * Array of tag objects with id, name, and displayname properties
   * Rendered as MUI Chip components in the chapter view
   */
  tags?: Tag[];
}

/**
 * Chapter navigation reference
 *
 * Lightweight reference to adjacent chapters for navigation.
 * Used in Chapter.prev and Chapter.next properties.
 *
 * @interface ChapterNavigation
 */
export interface ChapterNavigation {
  /**
   * Previous chapter in sequence
   * null if this is the first chapter
   */
  prev: Id | null;

  /**
   * Next chapter in sequence
   * null if this is the last chapter
   */
  next: Id | null;

  /**
   * Parent chapter for subchapters
   * null for main chapters
   */
  parent: Id | null;
}

/**
 * Tag entity for chapter content
 *
 * Represents a tag associated with a book chapter, retrieved from
 * Moodle's core tagging system via core_tag_tag::get_item_tags().
 * Tags enable categorization and discovery of learning content.
 *
 * @interface Tag
 */
export interface Tag {
  /**
   * Unique tag identifier
   * Database: mdl_tag.id (int 10, primary key)
   */
  id: Id;

  /**
   * Tag name (normalized, lowercase)
   * Database: mdl_tag.name (char 255)
   * Used as the canonical tag identifier
   */
  name: string;

  /**
   * Display name for the tag
   * Database: mdl_tag.rawname (char 255)
   * Preserves original capitalization and formatting
   * Shown to users in the UI
   */
  displayname: string;
}

/**
 * Book configuration settings
 *
 * Combines display and navigation settings for a book instance.
 * Used for book configuration forms and display preferences.
 *
 * @interface BookSettings
 */
export interface BookSettings {
  /**
   * Chapter numbering style
   * See BookNumbering enum for values
   */
  numbering: BookNumbering;

  /**
   * Navigation style between chapters
   * See BookNavStyle enum for values
   */
  navstyle: BookNavStyle;

  /**
   * Whether custom titles are enabled
   * 0 = auto-generated with numbering
   * 1 = custom titles allowed
   */
  customtitles: number;
}
