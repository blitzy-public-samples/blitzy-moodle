/**
 * ChapterList Component Test Suite
 *
 * Comprehensive Vitest + React Testing Library tests for ChapterList component
 * covering hierarchical table of contents (TOC) rendering with:
 * - Multiple numbering schemes (none, numbers, bullets, indented)
 * - Nested chapter structure with proper parent-child relationships
 * - Hidden chapter visibility based on viewhiddenchapters capability
 * - Current chapter highlighting with MUI selected styling
 * - Navigation click handlers with callback verification
 *
 * Tests validate that React component behavior matches the PHP implementation
 * in public/mod/book/locallib.php (book_get_toc function).
 *
 * @module tests/unit/features/activities/book/ChapterList
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@/tests/helpers/render';
import '@testing-library/jest-dom';

// Component under test
import ChapterList from '@/features/activities/book/components/ChapterList';

// Types
import { BookNumbering } from '@/features/activities/book/types/book.types';
import type { Chapter, Book } from '@/features/activities/book/types/book.types';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock chapter object for testing
 */
function createMockChapter(
  id: number,
  title: string,
  options: {
    subchapter?: number;
    hidden?: number;
    pagenum?: number;
  } = {}
): Chapter {
  return {
    id,
    bookid: 1,
    pagenum: options.pagenum ?? id,
    subchapter: options.subchapter ?? 0,
    title,
    content: `Content for chapter ${id}`,
    contentformat: 1,
    hidden: options.hidden ?? 0,
    timecreated: Date.now() / 1000,
    timemodified: Date.now() / 1000,
    importsrc: null,
  };
}

/**
 * Creates a mock book configuration object for testing
 */
function createMockBook(
  numbering: BookNumbering,
  options: {
    customtitles?: number;
  } = {}
): Pick<Book, 'numbering' | 'customtitles'> {
  return {
    numbering,
    customtitles: options.customtitles ?? 0,
  };
}

// ============================================================================
// Test Suite Organization
// ============================================================================

describe('ChapterList Component', () => {
  let mockOnChapterClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChapterClick = vi.fn();
  });

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe('Empty State', () => {
    it('should render "No chapters available" message when chapters array is empty', () => {
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={[]}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      expect(screen.getByText('No chapters available')).toBeInTheDocument();
    });

    it('should render "No chapters available" when all chapters are hidden and user cannot view hidden', () => {
      const chapters = [
        createMockChapter(1, 'Hidden Chapter 1', { hidden: 1 }),
        createMockChapter(2, 'Hidden Chapter 2', { hidden: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      expect(screen.getByText('No chapters available')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Numbering Scheme Tests - NONE
  // ==========================================================================

  describe('Numbering Scheme: NONE', () => {
    it('should render chapters without numbering when numbering is NONE', () => {
      const chapters = [
        createMockChapter(1, 'Introduction'),
        createMockChapter(2, 'Chapter Two'),
        createMockChapter(3, 'Conclusion'),
      ];
      const book = createMockBook(BookNumbering.NONE);

      const { container } = render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      // Verify CSS class
      const tocElement = container.querySelector('.book_toc_none');
      expect(tocElement).toBeInTheDocument();
      expect(tocElement).toHaveClass('book_toc', 'book_toc_none', 'clearfix');

      // Verify chapter titles appear without numbers
      expect(screen.getByText('Introduction')).toBeInTheDocument();
      expect(screen.getByText('Chapter Two')).toBeInTheDocument();
      expect(screen.getByText('Conclusion')).toBeInTheDocument();

      // Ensure no numbers are present
      expect(screen.queryByText(/^1\./)).not.toBeInTheDocument();
      expect(screen.queryByText(/^2\./)).not.toBeInTheDocument();
    });

    it('should render nested subchapters without numbering when numbering is NONE', () => {
      const chapters = [
        createMockChapter(1, 'Main Chapter'),
        createMockChapter(2, 'Subchapter One', { subchapter: 1 }),
        createMockChapter(3, 'Subchapter Two', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.NONE);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      expect(screen.getByText('Main Chapter')).toBeInTheDocument();
      expect(screen.getByText('Subchapter One')).toBeInTheDocument();
      expect(screen.getByText('Subchapter Two')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Numbering Scheme Tests - NUMBERS
  // ==========================================================================

  describe('Numbering Scheme: NUMBERS', () => {
    it('should render main chapters with number format "1.", "2.", "3."', () => {
      const chapters = [
        createMockChapter(1, 'Introduction'),
        createMockChapter(2, 'Chapter Two'),
        createMockChapter(3, 'Conclusion'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      const { container } = render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      // Verify CSS class
      const tocElement = container.querySelector('.book_toc_numbered');
      expect(tocElement).toBeInTheDocument();
      expect(tocElement).toHaveClass('book_toc', 'book_toc_numbered', 'clearfix');

      // Verify numbered titles
      expect(screen.getByText('1. Introduction')).toBeInTheDocument();
      expect(screen.getByText('2. Chapter Two')).toBeInTheDocument();
      expect(screen.getByText('3. Conclusion')).toBeInTheDocument();
    });

    it('should render subchapters with format "1.1.", "1.2.", "2.1."', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Section One', { subchapter: 1 }),
        createMockChapter(3, 'Section Two', { subchapter: 1 }),
        createMockChapter(4, 'Chapter Two'),
        createMockChapter(5, 'Section One', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      // Main chapter numbers
      expect(screen.getByText('1. Chapter One')).toBeInTheDocument();
      expect(screen.getByText('2. Chapter Two')).toBeInTheDocument();

      // Subchapter numbers
      expect(screen.getByText('1.1 Section One')).toBeInTheDocument();
      expect(screen.getByText('1.2 Section Two')).toBeInTheDocument();
      expect(screen.getByText('2.1 Section One')).toBeInTheDocument();
    });

    it('should render hidden main chapter with "x." prefix', () => {
      const chapters = [
        createMockChapter(1, 'Visible Chapter'),
        createMockChapter(2, 'Hidden Chapter', { hidden: 1 }),
        createMockChapter(3, 'Another Visible'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={true}
        />
      );

      expect(screen.getByText('1. Visible Chapter')).toBeInTheDocument();
      expect(screen.getByText('x. Hidden Chapter')).toBeInTheDocument();
      expect(screen.getByText('2. Another Visible')).toBeInTheDocument();
    });

    it('should render hidden subchapter with "1.x" prefix when parent is visible', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Visible Subchapter', { subchapter: 1 }),
        createMockChapter(3, 'Hidden Subchapter', { subchapter: 1, hidden: 1 }),
        createMockChapter(4, 'Another Visible', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={true}
        />
      );

      expect(screen.getByText('1. Chapter One')).toBeInTheDocument();
      expect(screen.getByText('1.1 Visible Subchapter')).toBeInTheDocument();
      expect(screen.getByText('1.x Hidden Subchapter')).toBeInTheDocument();
      expect(screen.getByText('1.2 Another Visible')).toBeInTheDocument();
    });

    it('should render hidden subchapter with "x.x" prefix when parent is hidden', () => {
      const chapters = [
        createMockChapter(1, 'Hidden Chapter', { hidden: 1 }),
        createMockChapter(2, 'Hidden Subchapter', { subchapter: 1, hidden: 1 }),
        createMockChapter(3, 'Another Hidden Sub', { subchapter: 1, hidden: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={true}
        />
      );

      expect(screen.getByText('x. Hidden Chapter')).toBeInTheDocument();
      expect(screen.getByText('x.x Hidden Subchapter')).toBeInTheDocument();
      expect(screen.getByText('x.x Another Hidden Sub')).toBeInTheDocument();
    });

    it('should reset subchapter numbering for each main chapter', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Section 1.1', { subchapter: 1 }),
        createMockChapter(3, 'Section 1.2', { subchapter: 1 }),
        createMockChapter(4, 'Section 1.3', { subchapter: 1 }),
        createMockChapter(5, 'Chapter Two'),
        createMockChapter(6, 'Section 2.1', { subchapter: 1 }),
        createMockChapter(7, 'Section 2.2', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      // Chapter 1 subchapters
      expect(screen.getByText('1.1 Section 1.1')).toBeInTheDocument();
      expect(screen.getByText('1.2 Section 1.2')).toBeInTheDocument();
      expect(screen.getByText('1.3 Section 1.3')).toBeInTheDocument();

      // Chapter 2 subchapters (reset to 1)
      expect(screen.getByText('2.1 Section 2.1')).toBeInTheDocument();
      expect(screen.getByText('2.2 Section 2.2')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Numbering Scheme Tests - BULLETS
  // ==========================================================================

  describe('Numbering Scheme: BULLETS', () => {
    it('should render with bullets CSS class', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Subchapter', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.BULLETS);

      const { container } = render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      const tocElement = container.querySelector('.book_toc_bullets');
      expect(tocElement).toBeInTheDocument();
      expect(tocElement).toHaveClass('book_toc', 'book_toc_bullets', 'clearfix');
    });

    it('should render chapters without explicit numbering in bullets mode', () => {
      const chapters = [
        createMockChapter(1, 'Main Chapter'),
        createMockChapter(2, 'Subchapter One', { subchapter: 1 }),
        createMockChapter(3, 'Subchapter Two', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.BULLETS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      // Chapters appear without numbers
      expect(screen.getByText('Main Chapter')).toBeInTheDocument();
      expect(screen.getByText('Subchapter One')).toBeInTheDocument();
      expect(screen.getByText('Subchapter Two')).toBeInTheDocument();

      // No numbering should appear
      expect(screen.queryByText(/^1\./)).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Numbering Scheme Tests - INDENTED
  // ==========================================================================

  describe('Numbering Scheme: INDENTED', () => {
    it('should render with indented CSS class', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Subchapter', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.INDENTED);

      const { container } = render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      const tocElement = container.querySelector('.book_toc_indented');
      expect(tocElement).toBeInTheDocument();
      expect(tocElement).toHaveClass('book_toc', 'book_toc_indented', 'clearfix');
    });

    it('should render chapters without explicit numbering in indented mode', () => {
      const chapters = [
        createMockChapter(1, 'Main Chapter'),
        createMockChapter(2, 'Subchapter One', { subchapter: 1 }),
        createMockChapter(3, 'Subchapter Two', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.INDENTED);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      expect(screen.getByText('Main Chapter')).toBeInTheDocument();
      expect(screen.getByText('Subchapter One')).toBeInTheDocument();
      expect(screen.getByText('Subchapter Two')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Nested Structure Tests
  // ==========================================================================

  describe('Nested Chapter Structure', () => {
    it('should render nested subchapters under main chapters', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Section 1.1', { subchapter: 1 }),
        createMockChapter(3, 'Section 1.2', { subchapter: 1 }),
        createMockChapter(4, 'Chapter Two'),
        createMockChapter(5, 'Section 2.1', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      const { container } = render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      // All chapters should be present
      expect(screen.getByText('1. Chapter One')).toBeInTheDocument();
      expect(screen.getByText('1.1 Section 1.1')).toBeInTheDocument();
      expect(screen.getByText('1.2 Section 1.2')).toBeInTheDocument();
      expect(screen.getByText('2. Chapter Two')).toBeInTheDocument();
      expect(screen.getByText('2.1 Section 2.1')).toBeInTheDocument();

      // Verify nested List components exist
      const nestedLists = container.querySelectorAll('ul ul');
      expect(nestedLists.length).toBeGreaterThan(0);
    });

    it('should apply proper indentation to subchapters', () => {
      const chapters = [
        createMockChapter(1, 'Main Chapter'),
        createMockChapter(2, 'Subchapter', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      const { container } = render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      // Find the subchapter list item
      const subchapterText = screen.getByText('1.1 Subchapter');
      const listItem = subchapterText.closest('li');

      // Subchapters should have padding-left styling
      expect(listItem).toHaveStyle({ paddingLeft: expect.any(String) });
    });

    it('should handle mixed structure with multiple subchapter groups', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Sub 1.1', { subchapter: 1 }),
        createMockChapter(3, 'Sub 1.2', { subchapter: 1 }),
        createMockChapter(4, 'Chapter Two'),
        createMockChapter(5, 'Chapter Three'),
        createMockChapter(6, 'Sub 3.1', { subchapter: 1 }),
        createMockChapter(7, 'Chapter Four'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      expect(screen.getByText('1. Chapter One')).toBeInTheDocument();
      expect(screen.getByText('1.1 Sub 1.1')).toBeInTheDocument();
      expect(screen.getByText('1.2 Sub 1.2')).toBeInTheDocument();
      expect(screen.getByText('2. Chapter Two')).toBeInTheDocument();
      expect(screen.getByText('3. Chapter Three')).toBeInTheDocument();
      expect(screen.getByText('3.1 Sub 3.1')).toBeInTheDocument();
      expect(screen.getByText('4. Chapter Four')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Current Chapter Highlighting Tests
  // ==========================================================================

  describe('Current Chapter Highlighting', () => {
    it('should highlight current chapter with bold text', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Chapter Two'),
        createMockChapter(3, 'Chapter Three'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={2}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      const currentChapter = screen.getByText('2. Chapter Two');
      expect(currentChapter).toHaveStyle({ fontWeight: 'bold' });
    });

    it('should render current chapter as non-clickable', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Chapter Two'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={2}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      const currentChapter = screen.getByText('2. Chapter Two');
      const listItemButton = currentChapter.closest('button');

      // Current chapter should not be in a button
      expect(listItemButton).toBeNull();
    });

    it('should render non-current chapters as clickable buttons', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Chapter Two'),
        createMockChapter(3, 'Chapter Three'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={2}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      const chapterOne = screen.getByText('1. Chapter One');
      const chapterThree = screen.getByText('3. Chapter Three');

      expect(chapterOne.closest('button')).toBeInTheDocument();
      expect(chapterThree.closest('button')).toBeInTheDocument();
    });

    it('should highlight current subchapter correctly', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Sub 1.1', { subchapter: 1 }),
        createMockChapter(3, 'Sub 1.2', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={2}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      const currentSubchapter = screen.getByText('1.1 Sub 1.1');
      expect(currentSubchapter).toHaveStyle({ fontWeight: 'bold' });
    });
  });

  // ==========================================================================
  // Hidden Chapter Visibility Tests
  // ==========================================================================

  describe('Hidden Chapter Visibility', () => {
    it('should hide hidden chapters when canViewHidden is false', () => {
      const chapters = [
        createMockChapter(1, 'Visible Chapter'),
        createMockChapter(2, 'Hidden Chapter', { hidden: 1 }),
        createMockChapter(3, 'Another Visible'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      expect(screen.getByText('1. Visible Chapter')).toBeInTheDocument();
      expect(screen.queryByText(/Hidden Chapter/)).not.toBeInTheDocument();
      expect(screen.getByText('2. Another Visible')).toBeInTheDocument();
    });

    it('should show hidden chapters with dimmed styling when canViewHidden is true', () => {
      const chapters = [
        createMockChapter(1, 'Visible Chapter'),
        createMockChapter(2, 'Hidden Chapter', { hidden: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={true}
        />
      );

      const hiddenChapter = screen.getByText('x. Hidden Chapter');
      expect(hiddenChapter).toBeInTheDocument();
      
      // Hidden chapters should have disabled text color
      expect(hiddenChapter).toHaveStyle({ color: expect.any(String) });
    });

    it('should hide hidden subchapters when canViewHidden is false', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Visible Sub', { subchapter: 1 }),
        createMockChapter(3, 'Hidden Sub', { subchapter: 1, hidden: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      expect(screen.getByText('1. Chapter One')).toBeInTheDocument();
      expect(screen.getByText('1.1 Visible Sub')).toBeInTheDocument();
      expect(screen.queryByText(/Hidden Sub/)).not.toBeInTheDocument();
    });

    it('should show hidden subchapters with "x" prefix when canViewHidden is true', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Visible Sub', { subchapter: 1 }),
        createMockChapter(3, 'Hidden Sub', { subchapter: 1, hidden: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={true}
        />
      );

      expect(screen.getByText('1. Chapter One')).toBeInTheDocument();
      expect(screen.getByText('1.1 Visible Sub')).toBeInTheDocument();
      expect(screen.getByText('1.x Hidden Sub')).toBeInTheDocument();
    });

    it('should render hidden main chapter subchapters as hidden', () => {
      const chapters = [
        createMockChapter(1, 'Hidden Main', { hidden: 1 }),
        createMockChapter(2, 'Subchapter', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={true}
        />
      );

      // Both should be hidden with x prefix
      expect(screen.getByText('x. Hidden Main')).toBeInTheDocument();
      expect(screen.getByText('x.x Subchapter')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Click Navigation Tests
  // ==========================================================================

  describe('Chapter Click Navigation', () => {
    it('should call onChapterClick with correct chapter ID when chapter is clicked', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Chapter Two'),
        createMockChapter(3, 'Chapter Three'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      const chapterTwo = screen.getByText('2. Chapter Two');
      const button = chapterTwo.closest('button');

      fireEvent.click(button!);

      expect(mockOnChapterClick).toHaveBeenCalledTimes(1);
      expect(mockOnChapterClick).toHaveBeenCalledWith(2);
    });

    it('should call onChapterClick with correct ID for subchapter clicks', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Subchapter 1.1', { subchapter: 1 }),
        createMockChapter(3, 'Subchapter 1.2', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      const subchapter = screen.getByText('1.2 Subchapter 1.2');
      const button = subchapter.closest('button');

      fireEvent.click(button!);

      expect(mockOnChapterClick).toHaveBeenCalledWith(3);
    });

    it('should not call onChapterClick when current chapter is clicked', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Chapter Two'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={2}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      const currentChapter = screen.getByText('2. Chapter Two');
      
      // Current chapter is not in a button, so clicking the text won't trigger callback
      fireEvent.click(currentChapter);

      expect(mockOnChapterClick).not.toHaveBeenCalled();
    });

    it('should call onChapterClick for hidden chapter when visible to editor', () => {
      const chapters = [
        createMockChapter(1, 'Visible Chapter'),
        createMockChapter(2, 'Hidden Chapter', { hidden: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={true}
        />
      );

      const hiddenChapter = screen.getByText('x. Hidden Chapter');
      const button = hiddenChapter.closest('button');

      fireEvent.click(button!);

      expect(mockOnChapterClick).toHaveBeenCalledWith(2);
    });
  });

  // ==========================================================================
  // Edge Case Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle deeply nested chapters (3+ levels conceptually)', () => {
      // Note: Book module only supports 2 levels (main + sub), but test data structure
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Sub 1.1', { subchapter: 1 }),
        createMockChapter(3, 'Sub 1.2', { subchapter: 1 }),
        createMockChapter(4, 'Sub 1.3', { subchapter: 1 }),
        createMockChapter(5, 'Sub 1.4', { subchapter: 1 }),
        createMockChapter(6, 'Sub 1.5', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      expect(screen.getByText('1. Chapter One')).toBeInTheDocument();
      expect(screen.getByText('1.1 Sub 1.1')).toBeInTheDocument();
      expect(screen.getByText('1.2 Sub 1.2')).toBeInTheDocument();
      expect(screen.getByText('1.3 Sub 1.3')).toBeInTheDocument();
      expect(screen.getByText('1.4 Sub 1.4')).toBeInTheDocument();
      expect(screen.getByText('1.5 Sub 1.5')).toBeInTheDocument();
    });

    it('should handle large book with 50+ chapters', () => {
      const chapters: Chapter[] = [];
      
      // Create 25 main chapters, each with 2 subchapters
      for (let i = 1; i <= 25; i++) {
        chapters.push(createMockChapter(i * 3 - 2, `Chapter ${i}`));
        chapters.push(createMockChapter(i * 3 - 1, `Section ${i}.1`, { subchapter: 1 }));
        chapters.push(createMockChapter(i * 3, `Section ${i}.2`, { subchapter: 1 }));
      }

      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      // Verify first chapter
      expect(screen.getByText('1. Chapter 1')).toBeInTheDocument();
      expect(screen.getByText('1.1 Section 1.1')).toBeInTheDocument();

      // Verify last chapter
      expect(screen.getByText('25. Chapter 25')).toBeInTheDocument();
      expect(screen.getByText('25.2 Section 25.2')).toBeInTheDocument();
    });

    it('should handle chapters with special characters in titles', () => {
      const chapters = [
        createMockChapter(1, 'Chapter & Section'),
        createMockChapter(2, 'Quotes "Test" Chapter'),
        createMockChapter(3, 'Apostrophe\'s Chapter'),
        createMockChapter(4, '<HTML> Tags'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      expect(screen.getByText('1. Chapter & Section')).toBeInTheDocument();
      expect(screen.getByText('2. Quotes "Test" Chapter')).toBeInTheDocument();
      expect(screen.getByText('3. Apostrophe\'s Chapter')).toBeInTheDocument();
      expect(screen.getByText('4. <HTML> Tags')).toBeInTheDocument();
    });

    it('should handle book with only subchapters (edge case)', () => {
      // First chapter should be converted to main chapter
      const chapters = [
        createMockChapter(1, 'First Sub', { subchapter: 1 }),
        createMockChapter(2, 'Second Sub', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      // Component should handle gracefully - check that chapters render
      expect(screen.getByText(/First Sub/)).toBeInTheDocument();
      expect(screen.getByText(/Second Sub/)).toBeInTheDocument();
    });

    it('should handle long chapter titles without breaking layout', () => {
      const longTitle = 'This is a very long chapter title that should wrap properly and not break the layout of the table of contents component';
      
      const chapters = [
        createMockChapter(1, longTitle),
        createMockChapter(2, 'Normal Title'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      expect(screen.getByText(`1. ${longTitle}`)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have proper ARIA label for navigation list', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Chapter Two'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      const nav = screen.getByLabelText('Book chapters');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute('aria-label', 'Book chapters');
    });

    it('should render list items with proper structure for screen readers', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Subchapter', { subchapter: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      const { container } = render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      // Should have ul/li structure
      const lists = container.querySelectorAll('ul');
      expect(lists.length).toBeGreaterThan(0);

      const listItems = container.querySelectorAll('li');
      expect(listItems.length).toBe(2);
    });

    it('should have title attribute on chapter links for tooltips', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Chapter Two'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      const chapterOne = screen.getByText('1. Chapter One');
      const button = chapterOne.closest('button');
      
      // Button should contain span with title attribute
      const titleElement = button?.querySelector('[title]');
      expect(titleElement).toHaveAttribute('title', 'Chapter One');
    });

    it('should render buttons as keyboard accessible', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Chapter Two'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      const chapterOne = screen.getByText('1. Chapter One');
      const button = chapterOne.closest('button');

      expect(button).toHaveAttribute('type', 'button');
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration Scenarios', () => {
    it('should render complete book structure with all features', () => {
      const chapters = [
        createMockChapter(1, 'Introduction'),
        createMockChapter(2, 'Background', { subchapter: 1 }),
        createMockChapter(3, 'Overview', { subchapter: 1 }),
        createMockChapter(4, 'Main Content'),
        createMockChapter(5, 'Hidden Section', { subchapter: 1, hidden: 1 }),
        createMockChapter(6, 'Visible Section', { subchapter: 1 }),
        createMockChapter(7, 'Conclusion'),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      render(
        <ChapterList
          chapters={chapters}
          currentChapterId={4}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={true}
        />
      );

      // Main chapters
      expect(screen.getByText('1. Introduction')).toBeInTheDocument();
      expect(screen.getByText('2. Main Content')).toBeInTheDocument();
      expect(screen.getByText('3. Conclusion')).toBeInTheDocument();

      // Subchapters
      expect(screen.getByText('1.1 Background')).toBeInTheDocument();
      expect(screen.getByText('1.2 Overview')).toBeInTheDocument();
      expect(screen.getByText('2.x Hidden Section')).toBeInTheDocument();
      expect(screen.getByText('2.1 Visible Section')).toBeInTheDocument();

      // Current chapter should be bold
      const currentChapter = screen.getByText('2. Main Content');
      expect(currentChapter).toHaveStyle({ fontWeight: 'bold' });
    });

    it('should handle switching numbering schemes dynamically', () => {
      const chapters = [
        createMockChapter(1, 'Chapter One'),
        createMockChapter(2, 'Subchapter', { subchapter: 1 }),
      ];

      // First render with NUMBERS
      const { container, rerender } = render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={createMockBook(BookNumbering.NUMBERS)}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      expect(container.querySelector('.book_toc_numbered')).toBeInTheDocument();
      expect(screen.getByText('1. Chapter One')).toBeInTheDocument();

      // Rerender with BULLETS
      rerender(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={createMockBook(BookNumbering.BULLETS)}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      expect(container.querySelector('.book_toc_bullets')).toBeInTheDocument();
      expect(screen.getByText('Chapter One')).toBeInTheDocument();
    });

    it('should update when canViewHidden permission changes', () => {
      const chapters = [
        createMockChapter(1, 'Visible'),
        createMockChapter(2, 'Hidden', { hidden: 1 }),
      ];
      const book = createMockBook(BookNumbering.NUMBERS);

      // First render without permission
      const { rerender } = render(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={false}
        />
      );

      expect(screen.queryByText(/Hidden/)).not.toBeInTheDocument();

      // Rerender with permission
      rerender(
        <ChapterList
          chapters={chapters}
          currentChapterId={null}
          book={book}
          onChapterClick={mockOnChapterClick}
          canViewHidden={true}
        />
      );

      expect(screen.getByText('x. Hidden')).toBeInTheDocument();
    });
  });
});
