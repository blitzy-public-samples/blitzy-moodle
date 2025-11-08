/**
 * ChapterNavigation Component
 * 
 * Provides previous/next chapter navigation for the Book activity module.
 * Supports keyboard shortcuts (Arrow Left/Right) and maintains accessibility standards.
 * 
 * @package    mod_book
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { NavigateBefore as NavigateBeforeIcon, NavigateNext as NavigateAfterIcon } from '@mui/icons-material';

/**
 * Props interface for ChapterNavigation component
 */
interface ChapterNavigationProps {
  /**
   * Current chapter ID being displayed
   */
  currentChapterId: number;
  
  /**
   * Previous chapter ID (null if on first chapter)
   */
  previousChapterId: number | null;
  
  /**
   * Next chapter ID (null if on last chapter)
   */
  nextChapterId: number | null;
  
  /**
   * Book activity ID
   */
  bookId: number;
}

/**
 * ChapterNavigation Component
 * 
 * Renders navigation buttons for moving between book chapters with keyboard support.
 * 
 * @param {ChapterNavigationProps} props - Component props
 * @returns {JSX.Element} Navigation buttons container
 */
export function ChapterNavigation({
  currentChapterId: _currentChapterId,
  previousChapterId,
  nextChapterId,
  bookId,
}: ChapterNavigationProps): JSX.Element {
  const navigate = useNavigate();

  /**
   * Navigate to a specific chapter
   * 
   * @param {number} chapterId - Target chapter ID
   */
  const navigateToChapter = useCallback((chapterId: number): void => {
    navigate(`/activities/book/${bookId}/chapter/${chapterId}`);
  }, [navigate, bookId]);

  /**
   * Handle previous chapter navigation
   */
  const handlePrevious = useCallback((): void => {
    if (previousChapterId !== null) {
      navigateToChapter(previousChapterId);
    }
  }, [previousChapterId, navigateToChapter]);

  /**
   * Handle next chapter navigation
   */
  const handleNext = useCallback((): void => {
    if (nextChapterId !== null) {
      navigateToChapter(nextChapterId);
    }
  }, [nextChapterId, navigateToChapter]);

  /**
   * Setup keyboard navigation shortcuts
   * ArrowLeft: Previous chapter
   * ArrowRight: Next chapter
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Prevent navigation when user is typing in an input field
      const target = event.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable;
      
      if (isInputField) {
        return;
      }

      // Handle arrow key navigation
      if (event.key === 'ArrowLeft' && previousChapterId !== null) {
        event.preventDefault();
        handlePrevious();
      } else if (event.key === 'ArrowRight' && nextChapterId !== null) {
        event.preventDefault();
        handleNext();
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove event listener on unmount
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previousChapterId, nextChapterId, handlePrevious, handleNext]); // Re-run effect when dependencies change

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        padding: { xs: 1, sm: 2 },
        gap: 2,
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
      role="navigation"
      aria-label="Chapter navigation"
    >
      {/* Previous Chapter Button */}
      <Button
        variant="outlined"
        startIcon={<NavigateBeforeIcon />}
        onClick={handlePrevious}
        disabled={previousChapterId === null}
        aria-label={previousChapterId !== null ? `Navigate to previous chapter ${previousChapterId}` : 'No previous chapter'}
        sx={{
          minWidth: { xs: '100px', sm: '140px' },
          textTransform: 'none',
          fontSize: { xs: '0.875rem', sm: '1rem' },
        }}
      >
        Previous
      </Button>

      {/* Next Chapter Button */}
      <Button
        variant="outlined"
        endIcon={<NavigateAfterIcon />}
        onClick={handleNext}
        disabled={nextChapterId === null}
        aria-label={nextChapterId !== null ? `Navigate to next chapter ${nextChapterId}` : 'No next chapter'}
        sx={{
          minWidth: { xs: '100px', sm: '140px' },
          textTransform: 'none',
          fontSize: { xs: '0.875rem', sm: '1rem' },
        }}
      >
        Next
      </Button>
    </Box>
  );
}

export default ChapterNavigation;
