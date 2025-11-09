/**
 * ChapterView Component
 * 
 * Container component that orchestrates the complete chapter view by composing
 * ChapterContent, ChapterNavigation, and ChapterActionMenu components.
 * 
 * Provides responsive layout using MUI Box and Paper components.
 * Handles chapter visibility indicators (dimmed text for hidden chapters).
 * Manages the overall structure of a chapter display including title, content,
 * navigation controls, and action menu.
 * 
 * @package    react-frontend
 * @subpackage activities/book
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { Box, Paper, useTheme, useMediaQuery } from '@mui/material';
import ChapterContent from './ChapterContent';
import ChapterNavigation from './ChapterNavigation';
import ChapterActionMenu from './ChapterActionMenu';

/**
 * Chapter interface representing a book chapter
 */
export interface Chapter {
  /** Unique chapter identifier */
  id: number;
  /** Book identifier this chapter belongs to */
  bookid: number;
  /** Page number/sequence */
  pagenum: number;
  /** Whether this is a subchapter */
  subchapter: boolean;
  /** Chapter title */
  title: string;
  /** Chapter HTML content */
  content: string;
  /** Content format (HTML, Markdown, etc.) */
  contentformat: number;
  /** Whether chapter is hidden from students */
  hidden: boolean;
  /** Timestamp when created */
  timecreated: number;
  /** Timestamp when last modified */
  timemodified: number;
  /** Import reference (for imported books) */
  importsrc: string;
  /** Parent chapter ID if this is a subchapter */
  parent?: number;
  /** Tags associated with this chapter */
  tags?: string[];
}

/**
 * Book interface representing a book activity
 */
export interface Book {
  /** Unique book identifier */
  id: number;
  /** Course this book belongs to */
  course: number;
  /** Book name/title */
  name: string;
  /** Book introduction/description */
  intro: string;
  /** Introduction format */
  introformat: number;
  /** Numbering style (0=none, 1=numbers, 2=bullets, 3=indented) */
  numbering: number;
  /** Whether to use custom titles */
  customtitles: boolean;
  /** Revision number */
  revision: number;
  /** Timestamp when created */
  timecreated: number;
  /** Timestamp when last modified */
  timemodified: number;
}

/**
 * Props for ChapterView component
 */
export interface ChapterViewProps {
  /** The chapter to display */
  chapter: Chapter;
  /** The book this chapter belongs to */
  book: Book;
  /** ID of the previous chapter (for navigation) */
  previousChapterId: number | null;
  /** ID of the next chapter (for navigation) */
  nextChapterId: number | null;
  /** Whether the current user can edit the book */
  canEdit: boolean;
  /** Whether the current user can view hidden chapters */
  canViewHidden: boolean;
  /** Course module ID for the book */
  courseModuleId: number;
  /** All chapters in the book (for navigation context) */
  allChapters: Chapter[];
}

/**
 * ChapterView Container Component
 * 
 * Orchestrates the display of a book chapter by composing multiple sub-components.
 * Provides the overall structure and layout for chapter viewing.
 * 
 * @param props - Component props
 * @returns Rendered chapter view
 */
function ChapterView({
  chapter,
  book,
  previousChapterId,
  nextChapterId,
  canEdit,
  canViewHidden,
  courseModuleId: _courseModuleId, // Received but not used in current implementation
  allChapters: _allChapters, // Received but not used in current implementation
}: ChapterViewProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  /**
   * Determine if chapter should be displayed with dimmed styling.
   * Hidden chapters are shown dimmed to users who have permission to view them.
   */
  const shouldDimContent = chapter.hidden && canViewHidden;

  /**
   * Calculate responsive spacing based on screen size
   */
  const containerPadding = isMobile ? 2 : isTablet ? 3 : 4;
  const contentMarginBottom = isMobile ? 3 : 4;

  /**
   * Handle chapter deletion
   * TODO: Implement API call to delete chapter
   */
  const handleDelete = (chapterId: number): void => {
    console.warn(`Delete chapter ${chapterId} - API implementation needed`);
    // Future implementation: await deleteChapter(book.id, chapterId);
  };

  /**
   * Handle chapter visibility toggle
   * TODO: Implement API call to toggle chapter visibility
   */
  const handleToggleVisibility = (chapterId: number, currentHiddenState: boolean): void => {
    console.warn(`Toggle visibility for chapter ${chapterId} (currently ${currentHiddenState ? 'hidden' : 'visible'}) - API implementation needed`);
    // Future implementation: await updateChapterVisibility(book.id, chapterId, !currentHiddenState);
  };

  /**
   * Handle chapter movement (up/down in order)
   * TODO: Implement API call to reorder chapters
   */
  const handleMove = (chapterId: number, direction: 'up' | 'down'): void => {
    console.warn(`Move chapter ${chapterId} ${direction} - API implementation needed`);
    // Future implementation: await moveChapter(book.id, chapterId, direction);
  };

  return (
    <Paper
      elevation={1}
      sx={{
        width: '100%',
        minHeight: '400px',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: theme.palette.background.paper,
        borderRadius: isMobile ? 0 : 1,
        // Apply dimmed styling to entire container when chapter is hidden
        opacity: shouldDimContent ? 0.7 : 1,
        transition: 'opacity 0.3s ease-in-out',
      }}
    >
      <Box
        sx={{
          padding: containerPadding,
          position: 'relative',
        }}
      >
        {/* Action Menu - Top Right Position (Only visible to editors) */}
        {canEdit && (
          <Box
            sx={{
              position: 'absolute',
              top: isMobile ? 8 : 16,
              right: isMobile ? 8 : 16,
              zIndex: 10,
            }}
          >
            <ChapterActionMenu
              chapterId={chapter.id}
              bookId={book.id}
              canEdit={canEdit}
              isHidden={chapter.hidden}
              onDelete={handleDelete}
              onToggleVisibility={handleToggleVisibility}
              onMove={handleMove}
            />
          </Box>
        )}

        {/* Chapter Content Area */}
        <Box
          sx={{
            marginBottom: contentMarginBottom,
            marginTop: canEdit ? (isMobile ? 5 : 6) : 0,
            // Additional dimmed text color when chapter is hidden
            color: shouldDimContent
              ? theme.palette.text.secondary
              : theme.palette.text.primary,
          }}
        >
          <ChapterContent
            chapter={chapter}
            book={book}
            canViewHidden={canViewHidden}
            shouldDimContent={shouldDimContent}
          />
        </Box>

        {/* Chapter Navigation Controls - Bottom */}
        <Box
          sx={{
            marginTop: 'auto',
            paddingTop: 3,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <ChapterNavigation
            currentChapterId={chapter.id}
            previousChapterId={previousChapterId}
            nextChapterId={nextChapterId}
            bookId={book.id}
          />
        </Box>
      </Box>
    </Paper>
  );
}

export default ChapterView;
