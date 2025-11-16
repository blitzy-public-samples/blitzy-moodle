/**
 * ChapterContent Component
 *
 * Displays formatted book chapter content with support for custom titles,
 * subchapters, rich text formatting, file attachments, and tags.
 *
 * This component mirrors the functionality of view.php lines 128-152 where
 * chapter content and tags are displayed. It handles:
 * - Chapter title rendering based on customtitles setting and hierarchy
 * - Hidden chapter indication with dimmed styling
 * - Sanitized HTML content rendering
 * - Tag display with MUI Chip components
 * - Responsive layout with Material-UI Box and Typography
 *
 * @module features/activities/book/components
 */

import type React from 'react';
import { useMemo } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import DOMPurify from 'dompurify';
import type { Chapter } from '../types/book.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Tag entity for chapter tagging
 *
 * Represents a Moodle tag associated with a book chapter
 */
interface Tag {
  /** Unique tag identifier */
  id: number;
  /** Tag name (internal identifier) */
  name: string;
  /** Display name for the tag (user-facing) */
  displayname: string;
}

/**
 * Props for ChapterContent component
 *
 * @interface ChapterContentProps
 */
interface ChapterContentProps {
  /**
   * Chapter object with content and metadata
   * Contains id, title, content, contentformat, hidden, subchapter, parent, number
   */
  chapter: Chapter;

  /**
   * Whether custom titles are enabled for the book
   * When false (0), component renders auto-generated titles
   * When true (1), titles are shown elsewhere (e.g., TOC only)
   */
  customTitles: boolean;

  /**
   * All chapters in the book for title resolution
   * Used to find parent chapter titles for subchapters
   */
  chapters: Chapter[];

  /**
   * Optional array of tags associated with this chapter
   * Only displayed if core_tag is enabled for book_chapters
   */
  tags?: Tag[];
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ChapterContent Component
 *
 * Renders a book chapter with formatted content, titles, and tags.
 * Implements the display logic from mod/book/view.php lines 128-152.
 *
 * @param props - Component properties
 * @returns Rendered chapter content with appropriate styling and structure
 */
const ChapterContent: React.FC<ChapterContentProps> = ({
  chapter,
  customTitles,
  chapters,
  tags,
}) => {
  // ==========================================================================
  // Title Generation Logic
  // ==========================================================================

  /**
   * Generate parent chapter title for subchapters
   * Memoized to avoid recalculation on every render
   */
  const parentTitle = useMemo(() => {
    if (!chapter.subchapter || !chapter.parent) {
      return null;
    }

    // Find parent chapter by ID
    const parentChapter = chapters.find((ch) => ch.id === chapter.parent);
    return parentChapter?.title || null;
  }, [chapter.subchapter, chapter.parent, chapters]);

  // ==========================================================================
  // Content Sanitization
  // ==========================================================================

  /**
   * Sanitize chapter content for safe HTML rendering
   *
   * Uses DOMPurify to remove potentially malicious scripts and attributes
   * even though API pre-sanitizes content (defense-in-depth).
   *
   * Memoized to avoid re-sanitization on every render.
   */
  const sanitizedContent = useMemo(() => {
    if (!chapter.content) {
      return '';
    }

    // DOMPurify sanitization with comprehensive allowed tags for educational content
    return DOMPurify.sanitize(chapter.content, {
      ALLOWED_TAGS: [
        // Text formatting
        'p', 'div', 'span', 'br', 'strong', 'em', 'u', 'b', 'i', 's', 'mark',
        // Headings
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        // Lists
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        // Links and media
        'a', 'img', 'figure', 'figcaption',
        // Tables
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
        // Code and quotes
        'blockquote', 'pre', 'code', 'kbd', 'samp', 'var',
        // Semantic elements
        'hr', 'sub', 'sup', 'abbr', 'cite', 'del', 'ins', 'time', 'address',
        // Embedded content
        'iframe', 'video', 'audio', 'source', 'track',
        // MathML and SVG (for educational content)
        'math', 'svg',
      ],
      ALLOWED_ATTR: [
        // Universal attributes
        'href', 'src', 'alt', 'title', 'class', 'id', 'style',
        // Link attributes
        'target', 'rel', 'download',
        // Media attributes
        'width', 'height', 'controls', 'autoplay', 'loop', 'muted', 'poster',
        // Table attributes
        'colspan', 'rowspan', 'scope',
        // Iframe attributes
        'frameborder', 'allowfullscreen', 'sandbox',
        // Accessibility attributes
        'role', 'aria-label', 'aria-describedby', 'aria-hidden',
        // Data attributes (for interactive content)
        'data-*',
      ],
      ALLOW_DATA_ATTR: true,
      // Keep relative URLs for pluginfile.php resources
      ALLOW_UNKNOWN_PROTOCOLS: true,
    });
  }, [chapter.content]);

  // ==========================================================================
  // Render Logic
  // ==========================================================================

  return (
    <Box
      className={`generalbox book_content${chapter.hidden ? ' dimmed_text' : ''}`}
      sx={{
        padding: 3,
        marginBottom: 3,
        // Apply visual dimming for hidden chapters
        opacity: chapter.hidden ? 0.6 : 1,
        backgroundColor: 'background.paper',
        borderRadius: 1,
        boxShadow: 1,
      }}
    >
      {/* Chapter Title Rendering - Based on customtitles Setting */}
      {!customTitles && (
        <>
          {/* Main Chapter Title or Parent Title for Subchapters */}
          {(chapter.subchapter === 0 || parentTitle) && (
            <Typography
              variant="h3"
              component="h3"
              gutterBottom
              sx={{
                fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
                fontWeight: 600,
                marginBottom: 2,
                color: 'text.primary',
              }}
            >
              {chapter.subchapter === 0 ? chapter.title : parentTitle}
            </Typography>
          )}

          {/* Subchapter Title - Only shown for subchapters */}
          {chapter.subchapter === 1 && (
            <Typography
              variant="h4"
              component="h4"
              gutterBottom
              sx={{
                fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
                fontWeight: 500,
                marginBottom: 2,
                marginLeft: 2,
                color: 'text.secondary',
              }}
            >
              {chapter.title}
            </Typography>
          )}
        </>
      )}

      {/* Hidden Chapter Indicator */}
      {chapter.hidden === 1 && (
        <Box sx={{ marginBottom: 2 }}>
          <Chip
            label="Hidden from students"
            size="small"
            color="warning"
            variant="outlined"
            sx={{
              fontStyle: 'italic',
              fontWeight: 500,
            }}
          />
        </Box>
      )}

      {/* Chapter Content with Sanitized HTML */}
      {sanitizedContent && (
        <Box
          sx={{
            // Responsive images
            '& img': {
              maxWidth: '100%',
              height: 'auto',
              display: 'block',
              margin: '1rem 0',
            },
            // Table styling
            '& table': {
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: 2,
              overflow: 'auto',
              display: 'block',
            },
            '& th, & td': {
              padding: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              textAlign: 'left',
            },
            '& th': {
              backgroundColor: 'action.hover',
              fontWeight: 600,
            },
            // Code blocks
            '& pre': {
              backgroundColor: 'grey.100',
              padding: 2,
              borderRadius: 1,
              overflow: 'auto',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              marginBottom: 2,
            },
            '& code': {
              backgroundColor: 'grey.100',
              padding: 0.5,
              borderRadius: 0.5,
              fontSize: '0.875rem',
              fontFamily: 'monospace',
            },
            '& pre code': {
              backgroundColor: 'transparent',
              padding: 0,
            },
            // Blockquotes
            '& blockquote': {
              borderLeft: '4px solid',
              borderColor: 'primary.main',
              paddingLeft: 2,
              marginLeft: 0,
              fontStyle: 'italic',
              color: 'text.secondary',
            },
            // Lists
            '& ul, & ol': {
              paddingLeft: 3,
              marginBottom: 2,
            },
            '& li': {
              marginBottom: 0.5,
            },
            // Headings within content
            '& h1, & h2, & h3, & h4, & h5, & h6': {
              marginTop: 3,
              marginBottom: 1.5,
              fontWeight: 600,
            },
            // Links
            '& a': {
              color: 'primary.main',
              textDecoration: 'underline',
              '&:hover': {
                color: 'primary.dark',
              },
            },
            // Embedded content
            '& iframe, & video': {
              maxWidth: '100%',
              marginBottom: 2,
            },
            // Figures and captions
            '& figure': {
              margin: '1.5rem 0',
            },
            '& figcaption': {
              fontSize: '0.875rem',
              color: 'text.secondary',
              fontStyle: 'italic',
              marginTop: 0.5,
            },
            // Horizontal rules
            '& hr': {
              margin: '2rem 0',
              borderColor: 'divider',
            },
          }}
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      )}

      {/* Tags Display - Only if enabled and tags provided */}
      {tags && tags.length > 0 && (
        <Box
          sx={{
            marginTop: 3,
            paddingTop: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: 'text.secondary',
              marginRight: 1,
            }}
          >
            Tags:
          </Typography>
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.displayname || tag.name}
              size="small"
              variant="outlined"
              clickable
              sx={{
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ChapterContent;
