import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Modal,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  IconButton,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Close as CloseIcon,
  ViewList as ViewListIcon,
} from '@mui/icons-material';

/**
 * Interface for lesson page information in the overview
 */
interface LessonPage {
  id: number;
  title: string;
  completed: boolean;
  order: number;
}

/**
 * Props for the LessonNavigation component
 */
interface LessonNavigationProps {
  /** Current page ID in the lesson */
  currentPageId: number;
  /** Total number of pages in the lesson */
  totalPages: number;
  /** Current page number (1-indexed) */
  currentPageNumber: number;
  /** Whether the user can navigate backwards */
  canGoBack: boolean;
  /** Whether the user can navigate forwards */
  canGoNext: boolean;
  /** Callback function when previous button is clicked */
  onPrevious: () => void;
  /** Callback function when next button is clicked */
  onNext: () => void;
  /** Callback function when user jumps to a specific page */
  onJumpToPage: (pageId: number) => void;
  /** Whether to show the page overview button */
  showPageOverview?: boolean;
  /** Optional list of all pages for the overview modal */
  pages?: LessonPage[];
  /** Whether navigation buttons should be disabled (e.g., during submission) */
  disabled?: boolean;
}

/**
 * LessonNavigation Component
 * 
 * Provides navigation controls for lesson pages including Previous/Next buttons,
 * page position display, and optional page overview functionality. Supports
 * keyboard navigation and respects lesson branching logic constraints.
 * 
 * Features:
 * - Previous and Next navigation buttons with appropriate disabled states
 * - Current page position indicator (e.g., "Page 3 of 15")
 * - Optional page overview modal with completion status
 * - Keyboard shortcuts (ArrowLeft for previous, ArrowRight for next)
 * - Full accessibility support with ARIA labels
 * - Integrates with lesson branching logic
 * 
 * @param props - Component props
 * @returns React component for lesson navigation
 */
function LessonNavigation({
  currentPageId,
  totalPages,
  currentPageNumber,
  canGoBack,
  canGoNext,
  onPrevious,
  onNext,
  onJumpToPage,
  showPageOverview = false,
  pages = [],
  disabled = false,
}: LessonNavigationProps): React.ReactElement {
  const [overviewModalOpen, setOverviewModalOpen] = useState(false);

  /**
   * Determines if the Previous button should be disabled
   */
  const isPreviousDisabled = disabled || !canGoBack || currentPageNumber === 1;

  /**
   * Determines if the Next button should be disabled
   */
  const isNextDisabled = disabled || !canGoNext;

  /**
   * Handles the Previous button click
   */
  const handlePrevious = useCallback(() => {
    if (!isPreviousDisabled) {
      onPrevious();
    }
  }, [isPreviousDisabled, onPrevious]);

  /**
   * Handles the Next button click
   */
  const handleNext = useCallback(() => {
    if (!isNextDisabled) {
      onNext();
    }
  }, [isNextDisabled, onNext]);

  /**
   * Handles keyboard navigation shortcuts
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Only handle shortcuts when modal is not open
      if (overviewModalOpen) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          handlePrevious();
          break;
        case 'ArrowRight':
          event.preventDefault();
          handleNext();
          break;
        default:
          break;
      }
    },
    [overviewModalOpen, handlePrevious, handleNext]
  );

  /**
   * Sets up keyboard event listeners
   */
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  /**
   * Opens the page overview modal
   */
  const handleOpenOverview = () => {
    setOverviewModalOpen(true);
  };

  /**
   * Closes the page overview modal
   */
  const handleCloseOverview = () => {
    setOverviewModalOpen(false);
  };

  /**
   * Handles jumping to a specific page from the overview
   */
  const handleJumpToPageClick = (pageId: number) => {
    onJumpToPage(pageId);
    handleCloseOverview();
  };

  return (
    <>
      {/* Navigation Controls */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}
      >
        {/* Previous Button */}
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handlePrevious}
          disabled={isPreviousDisabled}
          aria-label="Go to previous page"
          sx={{ minWidth: 120 }}
        >
          Previous
        </Button>

        {/* Page Position and Overview */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexGrow: 1,
            justifyContent: 'center',
          }}
        >
          {/* Current Page Position */}
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ whiteSpace: 'nowrap' }}
            aria-live="polite"
            aria-atomic="true"
          >
            Page {currentPageNumber} of {totalPages}
          </Typography>

          {/* Page Overview Button */}
          {showPageOverview && pages.length > 0 && (
            <Button
              variant="text"
              size="small"
              startIcon={<ViewListIcon />}
              onClick={handleOpenOverview}
              aria-label="View page overview"
            >
              Overview
            </Button>
          )}
        </Box>

        {/* Next Button */}
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          onClick={handleNext}
          disabled={isNextDisabled}
          aria-label="Go to next page"
          sx={{ minWidth: 120 }}
        >
          Next
        </Button>
      </Box>

      {/* Page Overview Modal */}
      <Modal
        open={overviewModalOpen}
        onClose={handleCloseOverview}
        aria-labelledby="page-overview-title"
        aria-describedby="page-overview-description"
      >
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 600 },
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Modal Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography id="page-overview-title" variant="h6" component="h2">
              Lesson Pages
            </Typography>
            <IconButton
              onClick={handleCloseOverview}
              aria-label="Close page overview"
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Modal Content */}
          <Box
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              p: 1,
            }}
          >
            <Typography
              id="page-overview-description"
              variant="body2"
              color="text.secondary"
              sx={{ px: 2, py: 1 }}
            >
              Navigate to any page in the lesson. Completed pages are marked with a checkmark.
            </Typography>
            <Divider />
            <List>
              {pages.map((page, index) => {
                const isCurrentPage = page.id === currentPageId;
                const pageNumber = index + 1;

                return (
                  <ListItem
                    key={page.id}
                    disablePadding
                    sx={{
                      backgroundColor: isCurrentPage
                        ? 'action.selected'
                        : 'transparent',
                    }}
                  >
                    <ListItemButton
                      onClick={() => handleJumpToPageClick(page.id)}
                      disabled={isCurrentPage}
                      aria-label={`${isCurrentPage ? 'Current page: ' : 'Go to '}Page ${pageNumber}: ${page.title}`}
                      aria-current={isCurrentPage ? 'page' : undefined}
                    >
                      {/* Completion Status Icon */}
                      <ListItemIcon>
                        {page.completed ? (
                          <CheckCircleIcon
                            color="success"
                            aria-label="Completed"
                          />
                        ) : (
                          <RadioButtonUncheckedIcon
                            color="action"
                            aria-label="Not completed"
                          />
                        )}
                      </ListItemIcon>

                      {/* Page Information */}
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ minWidth: 60 }}
                            >
                              Page {pageNumber}
                            </Typography>
                            <Typography
                              variant="body1"
                              sx={{
                                fontWeight: isCurrentPage ? 600 : 400,
                              }}
                            >
                              {page.title}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>

          {/* Modal Footer */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Button onClick={handleCloseOverview} variant="outlined">
              Close
            </Button>
          </Box>
        </Paper>
      </Modal>
    </>
  );
}

export default LessonNavigation;
