/**
 * Book Navigation Component
 *
 * Provides Previous/Next chapter navigation controls for the Moodle book activity module.
 * This component renders Material-UI buttons with icons for navigating between chapters,
 * supports keyboard shortcuts, and handles edge cases (first/last chapter).
 *
 * Based on Moodle's book module navigation functionality from:
 * - public/mod/book/view.php (lines 118-126)
 * - public/mod/book/templates/main_action_menu.mustache
 *
 * Features:
 * - Previous/Next buttons with Material-UI styling
 * - Keyboard navigation support (ArrowLeft/ArrowRight)
 * - Edge case handling (disabled at first/last chapter)
 * - Full accessibility with ARIA labels
 * - Responsive flexbox layout
 *
 * @module features/activities/book/components
 */

import React, { useEffect } from 'react';
import { Box, Button } from '@mui/material';
import { NavigateBefore, NavigateNext } from '@mui/icons-material';
import type { Chapter } from '../types/book.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for BookNavigation component
 *
 * @interface BookNavigationProps
 */
export interface BookNavigationProps {
  /**
   * ID of the currently displayed chapter
   */
  currentChapterId: number;

  /**
   * Array of all chapters in the book (sorted by pagenum)
   * Used to determine previous/next chapters and edge cases
   */
  chapters: Chapter[];

  /**
   * Callback function invoked when user navigates to a different chapter
   * @param chapterId - ID of the chapter to navigate to
   */
  onNavigate: (chapterId: number) => void;
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * BookNavigation Component
 *
 * Renders navigation controls for moving between book chapters with keyboard
 * and mouse support. Automatically disables Previous button on first chapter
 * and Next button on last chapter.
 *
 * @param props - Component props
 * @returns React element containing navigation buttons
 *
 * @example
 * ```tsx
 * <BookNavigation
 *   currentChapterId={5}
 *   chapters={chapters}
 *   onNavigate={(chapterId) => navigate(`/book/${bookId}/chapter/${chapterId}`)}
 * />
 * ```
 */
const BookNavigation: React.FC<BookNavigationProps> = ({
  currentChapterId,
  chapters,
  onNavigate,
}) => {
  // ==========================================================================
  // Navigation State Computation
  // ==========================================================================

  /**
   * Find the index of the current chapter in the chapters array
   * Returns -1 if chapter not found
   */
  const currentIndex = chapters.findIndex((ch) => ch.id === currentChapterId);

  /**
   * Determine if Previous button should be disabled
   * True when on first chapter or chapter not found
   */
  const isPreviousDisabled = currentIndex <= 0;

  /**
   * Determine if Next button should be disabled
   * True when on last chapter or chapter not found
   */
  const isNextDisabled = currentIndex === -1 || currentIndex >= chapters.length - 1;

  /**
   * Get the previous chapter, if available
   * Returns null if on first chapter or chapter not found
   */
  const previousChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;

  /**
   * Get the next chapter, if available
   * Returns null if on last chapter or chapter not found
   */
  const nextChapter =
    currentIndex !== -1 && currentIndex < chapters.length - 1
      ? chapters[currentIndex + 1]
      : null;

  // ==========================================================================
  // Navigation Handlers
  // ==========================================================================

  /**
   * Handle navigation to previous chapter
   * Calls onNavigate callback with previous chapter ID
   */
  const handlePrevious = (): void => {
    if (previousChapter) {
      onNavigate(previousChapter.id);
    }
  };

  /**
   * Handle navigation to next chapter
   * Calls onNavigate callback with next chapter ID
   */
  const handleNext = (): void => {
    if (nextChapter) {
      onNavigate(nextChapter.id);
    }
  };

  // ==========================================================================
  // Keyboard Navigation
  // ==========================================================================

  /**
   * Setup keyboard event listeners for arrow key navigation
   * ArrowLeft: Previous chapter
   * ArrowRight: Next chapter
   *
   * Effect cleanup removes event listener on unmount
   */
  useEffect(() => {
    /**
     * Keyboard event handler for arrow key navigation
     * @param event - Keyboard event
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Only handle arrow keys when no input/textarea is focused
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          // Navigate to previous chapter
          if (!isPreviousDisabled) {
            event.preventDefault();
            handlePrevious();
          }
          break;

        case 'ArrowRight':
          // Navigate to next chapter
          if (!isNextDisabled) {
            event.preventDefault();
            handleNext();
          }
          break;

        default:
          // Ignore other keys
          break;
      }
    };

    // Add keyboard event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup: remove event listener on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentIndex, chapters, onNavigate]); // Re-setup when navigation state changes

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
      id="mod_book-chaptersnavigation"
    >
      {/* Previous Chapter Button */}
      <Box>
        <Button
          variant="text"
          startIcon={<NavigateBefore />}
          onClick={handlePrevious}
          disabled={isPreviousDisabled}
          aria-label={
            previousChapter
              ? `Previous chapter: ${previousChapter.title}`
              : 'Previous chapter (not available)'
          }
          title={previousChapter ? previousChapter.title : undefined}
          sx={{
            textTransform: 'none',
            fontSize: '0.875rem',
          }}
        >
          Previous
        </Button>
      </Box>

      {/* Next Chapter Button */}
      <Box sx={{ marginLeft: 'auto' }}>
        <Button
          variant="text"
          endIcon={<NavigateNext />}
          onClick={handleNext}
          disabled={isNextDisabled}
          aria-label={
            nextChapter
              ? `Next chapter: ${nextChapter.title}`
              : 'Next chapter (not available)'
          }
          title={nextChapter ? nextChapter.title : undefined}
          sx={{
            textTransform: 'none',
            fontSize: '0.875rem',
          }}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
};

// ============================================================================
// Exports
// ============================================================================

export default BookNavigation;
