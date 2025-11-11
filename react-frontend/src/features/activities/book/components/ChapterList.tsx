/**
 * ChapterList Component for Moodle Book Activity Module
 *
 * Renders a hierarchical table of contents (TOC) for book chapters with support for:
 * - Multiple numbering schemes (none, numbers, bullets, indented)
 * - Nested subchapter structure
 * - Hidden chapter visibility control
 * - Current chapter highlighting
 * - Click navigation between chapters
 *
 * This component replicates the functionality of book_get_toc() from
 * public/mod/book/locallib.php (lines 199-430), transforming the PHP
 * HTML generation logic into a React component tree using Material-UI.
 *
 * @module features/activities/book/components/ChapterList
 */

import React, { useMemo } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import type { Chapter, Book, BookNumbering } from '../types/book.types';

/**
 * Props interface for ChapterList component
 */
interface ChapterListProps {
  /**
   * Array of chapter objects in the book
   * Must be pre-sorted by pagenum (chapter order)
   */
  chapters: Chapter[];

  /**
   * ID of the currently active chapter
   * Used to highlight the current chapter in the TOC
   */
  currentChapterId: number | null;

  /**
   * Book configuration object containing numbering and display settings
   */
  book: Pick<Book, 'numbering' | 'customtitles'>;

  /**
   * Callback function triggered when a chapter is clicked
   * @param chapterId - ID of the clicked chapter
   */
  onChapterClick: (chapterId: number) => void;

  /**
   * Whether the current user can view hidden chapters
   * Based on mod/book:viewhiddenchapters capability
   */
  canViewHidden: boolean;

  /**
   * Whether the interface is in editing mode
   * Editing mode shows additional controls (not implemented in this view-only component)
   */
  isEditing?: boolean;
}

/**
 * Internal interface for processed chapter data with computed numbering
 */
interface ProcessedChapter {
  chapter: Chapter;
  displayNumber: string;
  isHidden: boolean;
  isDimmed: boolean;
  level: number;
}

/**
 * ChapterList Component
 *
 * Displays a hierarchical table of contents for a Moodle book activity.
 * Supports multiple numbering schemes, nested chapters, and hidden chapter visibility.
 *
 * @example
 * ```tsx
 * <ChapterList
 *   chapters={bookChapters}
 *   currentChapterId={activeChapter.id}
 *   book={{ numbering: BookNumbering.NUMBERS, customtitles: 0 }}
 *   onChapterClick={handleChapterNavigation}
 *   canViewHidden={hasViewHiddenCapability}
 * />
 * ```
 */
const ChapterList: React.FC<ChapterListProps> = ({
  chapters,
  currentChapterId,
  book,
  onChapterClick,
  canViewHidden,
  isEditing = false,
}) => {
  /**
   * Process chapters to compute display numbers and visibility
   *
   * This implements the numbering logic from book_get_toc():
   * - Main chapters (subchapter=0) increment the chapter counter
   * - Subchapters (subchapter=1) increment the subchapter counter
   * - Hidden chapters show 'x' prefix in numbered mode
   * - Hidden subchapters show 'x.x' or 'parent.x' based on parent visibility
   */
  const processedChapters = useMemo(() => {
    const processed: ProcessedChapter[] = [];
    let chapterNumber = 0; // nch in PHP code
    let subchapterNumber = 0; // ns in PHP code
    let currentParentChapter: Chapter | null = null;

    // Build parent lookup map for subchapter numbering logic
    const chapterParentMap: Map<number, Chapter | null> = new Map();
    chapters.forEach((ch, index) => {
      if (!ch.subchapter) {
        // Main chapter - it's its own parent reference
        currentParentChapter = ch;
        chapterParentMap.set(ch.id, null);
      } else {
        // Subchapter - link to most recent main chapter
        chapterParentMap.set(ch.id, currentParentChapter);
      }
    });

    chapters.forEach((ch) => {
      // Skip hidden chapters if user doesn't have permission to view them
      if (ch.hidden && !canViewHidden) {
        return;
      }

      const isHidden = Boolean(ch.hidden);
      const isDimmed = isHidden && canViewHidden;
      let displayNumber = '';
      const level = ch.subchapter ? 1 : 0;

      if (!ch.subchapter) {
        // Main chapter processing
        if (!isHidden) {
          chapterNumber++;
          subchapterNumber = 0;

          if (book.numbering === 1) {
            // BookNumbering.NUMBERS
            displayNumber = `${chapterNumber}.`;
          }
        } else {
          // Hidden main chapter
          if (book.numbering === 1) {
            displayNumber = 'x.';
          }
        }
      } else {
        // Subchapter processing
        if (!isHidden) {
          subchapterNumber++;

          if (book.numbering === 1) {
            // BookNumbering.NUMBERS
            displayNumber = `${chapterNumber}.${subchapterNumber}.`;
          }
        } else {
          // Hidden subchapter
          if (book.numbering === 1) {
            const parentChapter = chapterParentMap.get(ch.id);
            const isParentHidden = parentChapter && parentChapter.hidden;

            if (isParentHidden) {
              displayNumber = 'x.x.';
            } else {
              displayNumber = `${chapterNumber}.x.`;
            }
          }
        }
      }

      processed.push({
        chapter: ch,
        displayNumber,
        isHidden,
        isDimmed,
        level,
      });
    });

    return processed;
  }, [chapters, book.numbering, canViewHidden]);

  /**
   * Get CSS class name for the TOC container based on numbering scheme
   */
  const getTocClassName = (): string => {
    const baseClass = 'book_toc';
    switch (book.numbering) {
      case 0: // BookNumbering.NONE
        return `${baseClass} book_toc_none clearfix`;
      case 1: // BookNumbering.NUMBERS
        return `${baseClass} book_toc_numbered clearfix`;
      case 2: // BookNumbering.BULLETS
        return `${baseClass} book_toc_bullets clearfix`;
      case 3: // BookNumbering.INDENTED
        return `${baseClass} book_toc_indented clearfix`;
      default:
        return `${baseClass} clearfix`;
    }
  };

  /**
   * Render a single chapter list item
   */
  const renderChapter = (
    processedChapter: ProcessedChapter,
    index: number
  ): React.ReactNode => {
    const { chapter, displayNumber, isDimmed, level } = processedChapter;
    const isCurrentChapter = chapter.id === currentChapterId;
    const chapterTitle = `${displayNumber} ${chapter.title}`.trim();

    return (
      <ListItem
        key={chapter.id}
        disablePadding
        sx={{
          pl: level * 3, // Indent subchapters
          display: 'block',
        }}
      >
        {isCurrentChapter ? (
          // Current chapter - render as non-clickable, bold text
          <ListItemText
            primary={chapterTitle}
            primaryTypographyProps={{
              fontWeight: 'bold',
              color: isDimmed ? 'text.disabled' : 'text.primary',
              sx: {
                py: 1,
                px: 2,
              },
            }}
          />
        ) : (
          // Other chapters - render as clickable buttons
          <ListItemButton
            onClick={() => onChapterClick(chapter.id)}
            selected={false}
            sx={{
              py: 1,
              px: 2,
            }}
          >
            <ListItemText
              primary={chapterTitle}
              primaryTypographyProps={{
                color: isDimmed ? 'text.disabled' : 'text.primary',
                sx: {
                  textDecoration: 'none',
                },
              }}
              title={chapter.title} // Tooltip with unescaped title
            />
          </ListItemButton>
        )}
      </ListItem>
    );
  };

  /**
   * Render the hierarchical chapter list
   *
   * This creates a nested list structure where:
   * - Main chapters are direct children of the root list
   * - Subchapters are nested under their parent chapter
   *
   * The structure mirrors the ul/li nesting in book_get_toc()
   */
  const renderChapterHierarchy = (): React.ReactNode => {
    const elements: React.ReactNode[] = [];
    let currentMainChapterItems: React.ReactNode[] = [];
    let subchapterElements: React.ReactNode[] = [];
    let inSubchapterGroup = false;

    processedChapters.forEach((processedChapter, index) => {
      const { chapter, level } = processedChapter;

      if (level === 0) {
        // Main chapter

        // If we were processing subchapters, close that group
        if (inSubchapterGroup && subchapterElements.length > 0) {
          currentMainChapterItems.push(
            <List key={`sub-${index}`} disablePadding sx={{ pl: 2 }}>
              {subchapterElements}
            </List>
          );
          subchapterElements = [];
          inSubchapterGroup = false;
        }

        // Add the main chapter
        currentMainChapterItems.push(renderChapter(processedChapter, index));

        // Start a new subchapter group
        inSubchapterGroup = true;
      } else {
        // Subchapter
        subchapterElements.push(renderChapter(processedChapter, index));
      }
    });

    // Close any remaining subchapter group
    if (inSubchapterGroup && subchapterElements.length > 0) {
      currentMainChapterItems.push(
        <List
          key={`sub-final`}
          disablePadding
          sx={{ pl: 2 }}
        >
          {subchapterElements}
        </List>
      );
    }

    return currentMainChapterItems;
  };

  // Empty state handling
  if (chapters.length === 0) {
    return (
      <Box className={getTocClassName()}>
        <List>
          <ListItem>
            <ListItemText
              primary="No chapters available"
              primaryTypographyProps={{
                color: 'text.secondary',
                fontStyle: 'italic',
              }}
            />
          </ListItem>
        </List>
      </Box>
    );
  }

  return (
    <Box className={getTocClassName()}>
      <List
        component="nav"
        aria-label="Book chapters"
        disablePadding
        sx={{
          width: '100%',
          bgcolor: 'background.paper',
        }}
      >
        {renderChapterHierarchy()}
      </List>
    </Box>
  );
};

export default ChapterList;
