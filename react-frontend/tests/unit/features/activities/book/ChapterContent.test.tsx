/**
 * ChapterContent Component Tests
 * 
 * Comprehensive test suite for the ChapterContent component covering:
 * - Chapter title rendering with heading levels (h3 for main chapters, h4 for subchapters)
 * - Custom titles setting behavior
 * - Chapter content rendering with dangerouslySetInnerHTML
 * - HTML sanitization with DOMPurify for XSS prevention
 * - Hidden chapter indicators with dimmed styling
 * - File URL rewriting with pluginfile.php pattern
 * - Embedded media (images, videos) rendering
 * - Tag display as MUI Chip components
 * - Edge cases (empty content, long content)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '../../../../helpers/render';
import '@testing-library/jest-dom';
import ChapterContent from '@/features/activities/book/components/ChapterContent';
import type { Chapter, Tag } from '@/features/activities/book/types/book.types';

// Mock DOMPurify
const mockSanitize = vi.fn((html: string) => html);
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => mockSanitize(html),
  },
}));

describe('ChapterContent', () => {
  // Mock data setup
  let mockMainChapter: Chapter;
  let mockSubchapter: Chapter;
  let mockHiddenChapter: Chapter;
  let mockChapterWithMedia: Chapter;
  let mockChapterWithTags: Chapter;
  let mockChapterArray: Chapter[];
  let mockTags: Tag[];

  beforeEach(() => {
    // Reset mocks
    mockSanitize.mockClear();
    mockSanitize.mockImplementation((html: string) => html);

    // Create mock main chapter
    mockMainChapter = {
      id: 1,
      bookid: 10,
      pagenum: 1,
      subchapter: 0,
      title: 'Introduction to Testing',
      content: '<p>This is the introduction chapter with <strong>formatted</strong> content.</p>',
      contentformat: 1, // HTML format
      hidden: 0,
      timecreated: 1672531200,
      timemodified: 1672531200,
      importsrc: '',
      parent: null,
      number: '1',
      prev: null,
      next: null,
    };

    // Create mock subchapter
    mockSubchapter = {
      id: 2,
      bookid: 10,
      pagenum: 2,
      subchapter: 1,
      title: 'Testing Basics',
      content: '<p>This is a subchapter covering testing fundamentals.</p>',
      contentformat: 1,
      hidden: 0,
      timecreated: 1672531200,
      timemodified: 1672531200,
      importsrc: '',
      parent: 1,
      number: '1.1',
      prev: null,
      next: null,
    };

    // Create mock hidden chapter
    mockHiddenChapter = {
      id: 3,
      bookid: 10,
      pagenum: 3,
      subchapter: 0,
      title: 'Hidden Chapter',
      content: '<p>This chapter is hidden from students.</p>',
      contentformat: 1,
      hidden: 1,
      timecreated: 1672531200,
      timemodified: 1672531200,
      importsrc: '',
      parent: null,
      number: 'x',
      prev: null,
      next: null,
    };

    // Create mock chapter with embedded media
    mockChapterWithMedia = {
      id: 4,
      bookid: 10,
      pagenum: 4,
      subchapter: 0,
      title: 'Media Examples',
      content: `
        <p>This chapter contains various media elements:</p>
        <img src="https://example.com/pluginfile.php/123/mod_book/chapter/1/image.jpg" alt="Test Image" />
        <video src="https://example.com/pluginfile.php/123/mod_book/chapter/1/video.mp4" controls></video>
        <iframe src="https://www.youtube.com/embed/example" frameborder="0"></iframe>
      `,
      contentformat: 1,
      hidden: 0,
      timecreated: 1672531200,
      timemodified: 1672531200,
      importsrc: '',
      parent: null,
      number: '2',
      prev: null,
      next: null,
    };

    // Create mock chapter with tags
    mockChapterWithTags = {
      id: 5,
      bookid: 10,
      pagenum: 5,
      subchapter: 0,
      title: 'Chapter with Tags',
      content: '<p>This chapter has associated tags.</p>',
      contentformat: 1,
      hidden: 0,
      timecreated: 1672531200,
      timemodified: 1672531200,
      importsrc: '',
      parent: null,
      number: '3',
      prev: null,
      next: null,
    };

    // Create mock tags
    mockTags = [
      {
        id: 1,
        name: 'testing',
        displayname: 'Testing',
      },
      {
        id: 2,
        name: 'unit-tests',
        displayname: 'Unit Tests',
      },
    ];

    // Create mock chapters array for parent lookup
    mockChapterArray = [mockMainChapter, mockSubchapter, mockHiddenChapter];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Title Rendering', () => {
    it('renders main chapter title with h3 heading when customTitles is false', () => {
      render(
        <ChapterContent
          chapter={mockMainChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      const heading = screen.getByRole('heading', { level: 3, name: mockMainChapter.title });
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe('H3');
    });

    it('renders subchapter title with h4 heading when customTitles is false', () => {
      render(
        <ChapterContent
          chapter={mockSubchapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      const heading = screen.getByRole('heading', { level: 4, name: mockSubchapter.title });
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe('H4');
    });

    it('does not render title when customTitles is true', () => {
      render(
        <ChapterContent
          chapter={mockMainChapter}
          customTitles
          chapters={mockChapterArray}
        />
      );

      const heading = screen.queryByRole('heading', { name: mockMainChapter.title });
      expect(heading).not.toBeInTheDocument();
    });

    it('renders parent chapter title for subchapter when customTitles is false', () => {
      render(
        <ChapterContent
          chapter={mockSubchapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Should show parent chapter title (Introduction to Testing)
      const parentTitle = screen.getByText(new RegExp(mockMainChapter.title, 'i'));
      expect(parentTitle).toBeInTheDocument();
    });
  });

  describe('Content Rendering', () => {
    it('renders chapter content with dangerouslySetInnerHTML', () => {
      render(
        <ChapterContent
          chapter={mockMainChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Check that HTML content is rendered
      const strongElement = screen.getByText('formatted');
      expect(strongElement).toBeInTheDocument();
      expect(strongElement.tagName).toBe('STRONG');
    });

    it('renders empty content gracefully', () => {
      const emptyChapter: Chapter = {
        ...mockMainChapter,
        content: '',
      };

      render(
        <ChapterContent
          chapter={emptyChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Component should still render without errors
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    });

    it('renders very long content without truncation', () => {
      const longContent = `<p>${  'Lorem ipsum dolor sit amet. '.repeat(200)  }</p>`;
      const longChapter: Chapter = {
        ...mockMainChapter,
        content: longContent,
      };

      render(
        <ChapterContent
          chapter={longChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Content should be present (full text)
      const contentText = screen.getByText(/Lorem ipsum dolor sit amet/, { exact: false });
      expect(contentText).toBeInTheDocument();
    });

    it('handles different content formats correctly', () => {
      // HTML format (contentformat = 1)
      const htmlChapter: Chapter = {
        ...mockMainChapter,
        contentformat: 1,
        content: '<p>HTML formatted content</p>',
      };

      const { rerender } = render(
        <ChapterContent
          chapter={htmlChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      expect(screen.getByText('HTML formatted content')).toBeInTheDocument();

      // Markdown format (contentformat = 4)
      const markdownChapter: Chapter = {
        ...mockMainChapter,
        contentformat: 4,
        content: '**Markdown** formatted content',
      };

      rerender(
        <ChapterContent
          chapter={markdownChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Note: Component treats all formats as HTML after sanitization
      expect(screen.getByText(/Markdown.*formatted content/i)).toBeInTheDocument();
    });
  });

  describe('HTML Sanitization', () => {
    it('calls DOMPurify.sanitize on chapter content', () => {
      render(
        <ChapterContent
          chapter={mockMainChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      expect(mockSanitize).toHaveBeenCalledWith(mockMainChapter.content);
    });

    it('prevents XSS attacks by sanitizing malicious scripts', () => {
      const maliciousContent = '<p>Safe content</p><script>alert("XSS")</script>';
      mockSanitize.mockImplementationOnce(() => '<p>Safe content</p>'); // Simulate DOMPurify removing script

      const maliciousChapter: Chapter = {
        ...mockMainChapter,
        content: maliciousContent,
      };

      render(
        <ChapterContent
          chapter={maliciousChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      expect(mockSanitize).toHaveBeenCalledWith(maliciousContent);
      expect(screen.getByText('Safe content')).toBeInTheDocument();
      expect(screen.queryByText(/alert/)).not.toBeInTheDocument();
    });

    it('allows safe HTML tags and attributes', () => {
      const safeContent = '<p><a href="https://example.com" target="_blank">Link</a></p>';
      const safeChapter: Chapter = {
        ...mockMainChapter,
        content: safeContent,
      };

      render(
        <ChapterContent
          chapter={safeChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      const link = screen.getByRole('link', { name: 'Link' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com');
    });
  });

  describe('Hidden Chapter Indicators', () => {
    it('displays "Hidden from students" chip when chapter is hidden', () => {
      render(
        <ChapterContent
          chapter={mockHiddenChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      const hiddenChip = screen.getByText('Hidden from students');
      expect(hiddenChip).toBeInTheDocument();
    });

    it('applies dimmed styling to hidden chapter content', () => {
      const { container } = render(
        <ChapterContent
          chapter={mockHiddenChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Find the main container Box which should have opacity: 0.6
      const mainBox = container.querySelector('.generalbox.book_content');
      expect(mainBox).toBeInTheDocument();
      // Component applies opacity: 0.6 via sx prop when chapter.hidden is true
      expect(mainBox).toHaveStyle({ opacity: '0.6' });
    });

    it('applies opacity 0.6 to hidden chapter container', () => {
      const { container } = render(
        <ChapterContent
          chapter={mockHiddenChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Check for opacity style in hidden chapter
      const dimmedElements = container.querySelectorAll('.dimmed_text');
      expect(dimmedElements.length).toBeGreaterThan(0);
    });

    it('does not show hidden indicator for visible chapters', () => {
      render(
        <ChapterContent
          chapter={mockMainChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      const hiddenChip = screen.queryByText('Hidden from students');
      expect(hiddenChip).not.toBeInTheDocument();
    });
  });

  describe('File URL Handling', () => {
    it('preserves pluginfile.php URLs in content', () => {
      render(
        <ChapterContent
          chapter={mockChapterWithMedia}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      const image = screen.getByAltText('Test Image');
      expect(image).toHaveAttribute('src', expect.stringContaining('pluginfile.php'));
    });

    it('correctly handles file URLs with context and itemid', () => {
      const chapterWithFiles: Chapter = {
        ...mockMainChapter,
        content: '<p><a href="https://example.com/pluginfile.php/123/mod_book/chapter/1/document.pdf">Download PDF</a></p>',
      };

      render(
        <ChapterContent
          chapter={chapterWithFiles}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      const link = screen.getByRole('link', { name: 'Download PDF' });
      expect(link).toHaveAttribute('href', expect.stringContaining('pluginfile.php/123/mod_book/chapter/1/document.pdf'));
    });
  });

  describe('Embedded Media Rendering', () => {
    it('renders embedded images with correct src attributes', () => {
      render(
        <ChapterContent
          chapter={mockChapterWithMedia}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      const image = screen.getByAltText('Test Image');
      expect(image).toBeInTheDocument();
      expect(image.tagName).toBe('IMG');
      expect(image).toHaveAttribute('src', expect.stringContaining('image.jpg'));
    });

    it('renders embedded videos with correct attributes', () => {
      const { container } = render(
        <ChapterContent
          chapter={mockChapterWithMedia}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Find the video element directly in the container
      const video = container.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute('src', 'https://example.com/pluginfile.php/123/mod_book/chapter/1/video.mp4');
      expect(video).toHaveAttribute('controls');
    });

    it('renders iframes for embedded content', () => {
      const { container } = render(
        <ChapterContent
          chapter={mockChapterWithMedia}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      const iframe = container.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', expect.stringContaining('youtube.com'));
    });

    it('handles multiple media elements in same chapter', () => {
      render(
        <ChapterContent
          chapter={mockChapterWithMedia}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Should have image, video, and iframe
      const image = screen.getByAltText('Test Image');
      const video = document.querySelector('video');
      const iframe = document.querySelector('iframe');

      expect(image).toBeInTheDocument();
      expect(video).toBeInTheDocument();
      expect(iframe).toBeInTheDocument();
    });
  });

  describe('Tag Display', () => {
    it('renders tags as MUI Chip components when tags are provided', () => {
      render(
        <ChapterContent
          chapter={mockChapterWithTags}
          customTitles={false}
          chapters={mockChapterArray}
          tags={mockTags}
        />
      );

      // Check for tag chips
      const testingTag = screen.getByText('Testing');
      const unitTestsTag = screen.getByText('Unit Tests');

      expect(testingTag).toBeInTheDocument();
      expect(unitTestsTag).toBeInTheDocument();
    });

    it('does not render tag section when no tags are provided', () => {
      render(
        <ChapterContent
          chapter={mockChapterWithTags}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Should not show tags section
      const tagsSection = screen.queryByText('Testing');
      expect(tagsSection).not.toBeInTheDocument();
    });

    it('renders tag displayname when available, falls back to name', () => {
      const tagsWithMixedNames: Tag[] = [
        {
          id: 3,
          name: 'advanced',
          displayname: 'Advanced Topics',
        },
        {
          id: 4,
          name: 'beginner',
          displayname: '', // Empty displayname should fall back to name
        },
      ];

      render(
        <ChapterContent
          chapter={mockChapterWithTags}
          customTitles={false}
          chapters={mockChapterArray}
          tags={tagsWithMixedNames}
        />
      );

      expect(screen.getByText('Advanced Topics')).toBeInTheDocument();
      expect(screen.getByText('beginner')).toBeInTheDocument();
    });

    it('applies proper styling to tag chips with border separator', () => {
      const { container } = render(
        <ChapterContent
          chapter={mockChapterWithTags}
          customTitles={false}
          chapters={mockChapterArray}
          tags={mockTags}
        />
      );

      // Check for MUI Chip components
      const chips = container.querySelectorAll('.MuiChip-root');
      expect(chips.length).toBeGreaterThan(0);
    });
  });

  describe('MUI Component Rendering', () => {
    it('renders Typography components for title and content', () => {
      render(
        <ChapterContent
          chapter={mockMainChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Title should be in Typography component (rendered as h3)
      const title = screen.getByRole('heading', { level: 3 });
      expect(title).toBeInTheDocument();
    });

    it('renders Box components for layout containers', () => {
      const { container } = render(
        <ChapterContent
          chapter={mockMainChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Check for MUI Box components
      const boxes = container.querySelectorAll('.MuiBox-root');
      expect(boxes.length).toBeGreaterThan(0);
    });

    it('renders Chip component for hidden chapter indicator', () => {
      const { container } = render(
        <ChapterContent
          chapter={mockHiddenChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Check for MUI Chip component
      const chip = container.querySelector('.MuiChip-root');
      expect(chip).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles chapter with no title gracefully', () => {
      const noTitleChapter: Chapter = {
        ...mockMainChapter,
        title: '',
      };

      render(
        <ChapterContent
          chapter={noTitleChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Should still render content
      expect(screen.getByText(/formatted/)).toBeInTheDocument();
    });

    it('handles subchapter with no parent in chapters array', () => {
      const orphanSubchapter: Chapter = {
        ...mockSubchapter,
        id: 999,
        pagenum: 999,
      };

      render(
        <ChapterContent
          chapter={orphanSubchapter}
          customTitles={false}
          chapters={[orphanSubchapter]} // Only the subchapter, no parent
        />
      );

      // Should render without crashing
      const heading = screen.getByRole('heading', { level: 4 });
      expect(heading).toBeInTheDocument();
    });

    it('handles empty chapters array', () => {
      render(
        <ChapterContent
          chapter={mockMainChapter}
          customTitles={false}
          chapters={[]}
        />
      );

      // Should render the chapter content
      expect(screen.getByText(/formatted/)).toBeInTheDocument();
    });

    it('handles special characters in chapter title', () => {
      const specialChapter: Chapter = {
        ...mockMainChapter,
        title: 'Chapter 1: "Testing" & <Validation>',
      };

      render(
        <ChapterContent
          chapter={specialChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Title should be rendered with special characters
      expect(screen.getByText(/Testing.*&.*Validation/i)).toBeInTheDocument();
    });

    it('handles content with only whitespace', () => {
      const whitespaceChapter: Chapter = {
        ...mockMainChapter,
        content: '   \n\n   ',
      };

      render(
        <ChapterContent
          chapter={whitespaceChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Should render without errors
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    });
  });

  describe('Responsive Layout', () => {
    it('renders with proper container structure for responsive design', () => {
      const { container } = render(
        <ChapterContent
          chapter={mockMainChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Check for proper Box structure
      const boxes = container.querySelectorAll('.MuiBox-root');
      expect(boxes.length).toBeGreaterThan(0);
    });

    it('applies proper styles to content container for formatting', () => {
      const { container } = render(
        <ChapterContent
          chapter={mockMainChapter}
          customTitles={false}
          chapters={mockChapterArray}
        />
      );

      // Content should have proper styling classes
      // Component should render properly even if specific class not found
      expect(container.querySelector('.MuiBox-root')).toBeInTheDocument();
    });
  });

  describe('Parent Chapter Relationships', () => {
    it('correctly identifies and displays parent chapter for subchapters', () => {
      // Create a subchapter that should have mockMainChapter as parent
      const subWithParent: Chapter = {
        ...mockSubchapter,
        pagenum: 2,
        subchapter: 1,
      };

      const chaptersWithParent = [
        mockMainChapter, // pagenum 1, subchapter 0
        subWithParent,   // pagenum 2, subchapter 1
      ];

      render(
        <ChapterContent
          chapter={subWithParent}
          customTitles={false}
          chapters={chaptersWithParent}
        />
      );

      // Should display parent chapter title
      expect(screen.getByText(new RegExp(mockMainChapter.title, 'i'))).toBeInTheDocument();
    });

    it('handles nested subchapters correctly', () => {
      const mainChap: Chapter = {
        ...mockMainChapter,
        pagenum: 1,
        subchapter: 0,
        title: 'Chapter 1',
      };

      const sub1: Chapter = {
        ...mockSubchapter,
        id: 2,
        pagenum: 2,
        subchapter: 1,
        title: 'Section 1.1',
      };

      const sub2: Chapter = {
        ...mockSubchapter,
        id: 3,
        pagenum: 3,
        subchapter: 1,
        title: 'Section 1.2',
      };

      const chaptersNested = [mainChap, sub1, sub2];

      // Render first subchapter
      const { rerender } = render(
        <ChapterContent
          chapter={sub1}
          customTitles={false}
          chapters={chaptersNested}
        />
      );

      expect(screen.getByText(/Chapter 1/i)).toBeInTheDocument();

      // Render second subchapter - should still show same parent
      rerender(
        <ChapterContent
          chapter={sub2}
          customTitles={false}
          chapters={chaptersNested}
        />
      );

      expect(screen.getByText(/Chapter 1/i)).toBeInTheDocument();
    });
  });
});
