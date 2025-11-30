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

/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */

import type React from 'react';
import { useMemo } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import type { Chapter, Book } from '../types/book.types';

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
function ChapterList({
  chapters,
  currentChapterId,
  book,
  onChapterClick,
  canViewHidden,
  isEditing: _isEditing = false,
}: ChapterListProps) {
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
    chapters.forEach((ch) => {
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

      let isHidden = Boolean(ch.hidden);
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
          subchapterNumber = 0; // Reset subchapter counter for hidden main chapters
          if (book.numbering === 1) {
            displayNumber = 'x.';
          }
        }
      } else {
        // Subchapter processing
        const parentChapter = chapterParentMap.get(ch.id);
        const isParentHidden = parentChapter?.hidden;

        // If parent is hidden, treat subchapter as hidden regardless of its own flag
        if (isParentHidden) {
          isHidden = true; // Treat as hidden when parent is hidden
          if (book.numbering === 1) {
            displayNumber = 'x.x';
          }
        } else if (!isHidden) {
          // Visible subchapter under visible parent
          subchapterNumber++;

          if (book.numbering === 1) {
            // BookNumbering.NUMBERS
            displayNumber = `${chapterNumber}.${subchapterNumber}`;
          }
        } else if (book.numbering === 1) {
          // Hidden subchapter under visible parent with numbered display
          displayNumber = `${chapterNumber}.x`;
        }
      }

      const isDimmed = isHidden && canViewHidden;

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
    _index: number
  ): React.ReactNode => {
    const { chapter, displayNumber, isDimmed, level } = processedChapter;
    const isCurrentChapter = chapter.id === currentChapterId;
    const chapterTitle = `${displayNumber} ${chapter.title}`.trim();

    return (
      <ListItem
        key={chapter.id}
        component="li"
        disablePadding
        sx={{
          pl: level * 3, // Indent subchapters
          display: 'block',
        }}
      >
        {isCurrentChapter ? (
          // Current chapter - render as non-clickable, bold text
          <Typography
            component="div"
            style={{
              fontWeight: 'bold',
              ...(isDimmed && { color: 'rgba(0, 0, 0, 0.38)' }),
            }}
            sx={{
              py: 1,
              px: 2,
              ...(!isDimmed && { color: 'text.primary' }),
            }}
          >
            {chapterTitle}
          </Typography>
        ) : (
          // Other chapters - render as clickable buttons
          <ListItemButton
            component="button"
            onClick={() => onChapterClick(chapter.id)}
            selected={false}
            sx={{
              py: 1,
              px: 2,
            }}
          >
            <Typography
              component="span"
              title={chapter.title} // Tooltip with unescaped title
              style={isDimmed ? { color: 'rgba(0, 0, 0, 0.38)' } : undefined}
              sx={{
                ...(!isDimmed && { color: 'text.primary' }),
                textDecoration: 'none',
              }}
            >
              {chapterTitle}
            </Typography>
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
   * - Subchapters are nested under their parent chapter INSIDE the parent's ListItem
   *
   * The structure creates proper ul > li > ul nesting
   */
  const renderChapterHierarchy = (): React.ReactNode => {
    const result: React.ReactNode[] = [];
    let i = 0;

    while (i < processedChapters.length) {
      const processedChapter = processedChapters[i];
      if (!processedChapter) {
        i++;
        continue;
      }
      const { level, chapter } = processedChapter;

      if (level === 0) {
        // Main chapter - collect its subchapters
        const subchapterElements: React.ReactNode[] = [];
        let j = i + 1;

        // Find all consecutive subchapters
        while (j < processedChapters.length) {
          const subchapter = processedChapters[j];
          if (!subchapter || subchapter.level === 0) {break;}
          subchapterElements.push(renderChapter(subchapter, j));
          j++;
        }

        // Render main chapter with nested subchapters inside the same ListItem
        result.push(
          <ListItem
            key={chapter.id}
            component="li"
            disablePadding
            sx={{
              display: 'block',
            }}
          >
            {renderChapterContent(processedChapter)}
            {subchapterElements.length > 0 && (
              <List component="ul" disablePadding sx={{ pl: 2 }}>
                {subchapterElements}
              </List>
            )}
          </ListItem>
        );

        i = j; // Skip past the subchapters we just processed
      } else {
        // Orphan subchapter (no parent) - render in a nested list
        const orphanSubchapters: React.ReactNode[] = [];
        while (i < processedChapters.length) {
          const orphan = processedChapters[i];
          if (!orphan || orphan.level === 0) {break;}
          orphanSubchapters.push(renderChapter(orphan, i));
          i++;
        }

        result.push(
          <List key="orphans" component="ul" disablePadding sx={{ pl: 2 }}>
            {orphanSubchapters}
          </List>
        );
      }
    }

    return result;
  };

  /**
   * Render just the chapter content (without the wrapping ListItem)
   */
  const renderChapterContent = (
    processedChapter: ProcessedChapter
  ): React.ReactNode => {
    const { chapter, displayNumber, isDimmed } = processedChapter;
    const isCurrentChapter = chapter.id === currentChapterId;
    const chapterTitle = `${displayNumber} ${chapter.title}`.trim();

    if (isCurrentChapter) {
      // Current chapter - render as non-clickable, bold text
      return (
        <Typography
          component="div"
          style={{
            fontWeight: 'bold',
            ...(isDimmed && { color: 'rgba(0, 0, 0, 0.38)' }),
          }}
          sx={{
            py: 1,
            px: 2,
            ...(!isDimmed && { color: 'text.primary' }),
          }}
        >
          {chapterTitle}
        </Typography>
      );
    } 
      // Other chapters - render as clickable buttons
      return (
        <ListItemButton
          component="button"
          onClick={() => onChapterClick(chapter.id)}
          selected={false}
          sx={{
            py: 1,
            px: 2,
          }}
        >
          <Typography
            component="span"
            title={chapter.title} // Tooltip with unescaped title
            style={isDimmed ? { color: 'rgba(0, 0, 0, 0.38)' } : undefined}
            sx={{
              ...(!isDimmed && { color: 'text.primary' }),
              textDecoration: 'none',
            }}
          >
            {chapterTitle}
          </Typography>
        </ListItemButton>
      );
    
  };

  // Empty state handling - check processedChapters instead of chapters
  // because chapters may be filtered out based on visibility permissions
  if (processedChapters.length === 0) {
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
        component="ul"
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
}

export default ChapterList;
