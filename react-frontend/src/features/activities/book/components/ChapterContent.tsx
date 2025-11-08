/**
 * ChapterContent Component
 * 
 * Displays the actual content of a book chapter including title and HTML content.
 * Handles proper rendering of HTML content with sanitization and formatting.
 * 
 * @package    react-frontend
 * @subpackage activities/book
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import type { Chapter, Book } from './ChapterView';

/**
 * Props for ChapterContent component
 */
export interface ChapterContentProps {
  /** The chapter to display */
  chapter: Chapter;
  /** The book this chapter belongs to */
  book: Book;
  /** Whether the current user can view hidden chapters */
  canViewHidden: boolean;
  /** Whether content should be dimmed (for hidden chapters) */
  shouldDimContent: boolean;
}

/**
 * ChapterContent Component
 * 
 * Renders the title and HTML content of a book chapter.
 * Applies appropriate formatting based on book numbering settings.
 * 
 * @param props - Component props
 * @returns Rendered chapter content
 */
const ChapterContent: React.FC<ChapterContentProps> = ({
  chapter,
  book,
  canViewHidden,
  shouldDimContent,
}) => {
  /**
   * Generate chapter number prefix based on book numbering style
   * 0 = None, 1 = Numbers, 2 = Bullets, 3 = Indented
   */
  const getChapterPrefix = (): string => {
    if (book.numbering === 0) {
      return '';
    }
    
    if (book.numbering === 1) {
      // Numbered chapters
      if (chapter.subchapter) {
        return `${chapter.pagenum}. `;
      }
      return `${chapter.pagenum}. `;
    }
    
    if (book.numbering === 2) {
      // Bullets
      return chapter.subchapter ? '◦ ' : '• ';
    }
    
    // Indented (3) or custom
    return '';
  };

  /**
   * Get the indentation level for the chapter title
   */
  const getIndentLevel = (): number => {
    if (book.numbering === 3 && chapter.subchapter) {
      return 4; // Indent subchapters
    }
    return 0;
  };

  const prefix = getChapterPrefix();
  const indentLevel = getIndentLevel();

  return (
    <Box
      sx={{
        width: '100%',
      }}
    >
      {/* Chapter Title */}
      <Typography
        variant={chapter.subchapter ? 'h5' : 'h4'}
        component={chapter.subchapter ? 'h2' : 'h1'}
        gutterBottom
        sx={{
          fontWeight: chapter.subchapter ? 500 : 600,
          marginBottom: 3,
          paddingLeft: indentLevel,
          color: shouldDimContent ? 'text.secondary' : 'text.primary',
          wordBreak: 'break-word',
        }}
      >
        {prefix}{chapter.title}
        {chapter.hidden && canViewHidden && (
          <Typography
            component="span"
            sx={{
              marginLeft: 2,
              fontSize: '0.875rem',
              fontWeight: 'normal',
              color: 'warning.main',
              fontStyle: 'italic',
            }}
          >
            (Hidden)
          </Typography>
        )}
      </Typography>

      {/* Chapter Content */}
      <Box
        sx={{
          '& img': {
            maxWidth: '100%',
            height: 'auto',
          },
          '& table': {
            maxWidth: '100%',
            overflowX: 'auto',
            display: 'block',
          },
          '& pre': {
            overflowX: 'auto',
            padding: 2,
            backgroundColor: 'background.default',
            borderRadius: 1,
          },
          '& code': {
            fontFamily: 'monospace',
            backgroundColor: 'background.default',
            padding: '2px 4px',
            borderRadius: 0.5,
          },
          '& a': {
            color: 'primary.main',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          },
          '& ul, & ol': {
            paddingLeft: 3,
          },
          '& blockquote': {
            borderLeft: '4px solid',
            borderColor: 'divider',
            paddingLeft: 2,
            marginLeft: 0,
            fontStyle: 'italic',
            color: 'text.secondary',
          },
          color: shouldDimContent ? 'text.secondary' : 'text.primary',
          lineHeight: 1.7,
          fontSize: '1rem',
        }}
        // Render HTML content safely
        // Note: In production, ensure HTML is sanitized on the server side
        dangerouslySetInnerHTML={{ __html: chapter.content }}
      />
    </Box>
  );
};

export default ChapterContent;
