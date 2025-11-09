/**
 * PageNavigation Component
 *
 * Provides navigation controls for multi-page feedback forms with:
 * - Previous/Next navigation buttons with proper disabled states
 * - Page indicators showing current position
 * - Progress bar displaying completion percentage
 * - Submit button on final page
 * - Validation state management
 * - Full keyboard accessibility (WCAG 2.1 AA compliant)
 *
 * @module features/activities/feedback/components/PageNavigation
 */

import type React from 'react';
import {
  Box,
  Button,
  LinearProgress,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
  Send as SendIcon,
} from '@mui/icons-material';

/**
 * Props interface for PageNavigation component
 */
export interface PageNavigationProps {
  /**
   * Current page number (0-indexed)
   */
  currentPage: number;

  /**
   * Total number of pages in the feedback form
   */
  totalPages: number;

  /**
   * Callback function invoked when user navigates to previous page
   */
  onPrevious: () => void;

  /**
   * Callback function invoked when user navigates to next page
   */
  onNext: () => void;

  /**
   * Callback function invoked when user submits the form on final page
   */
  onSubmit: () => void;

  /**
   * Whether the current page has valid responses
   * Controls whether Next/Submit button is enabled
   * @default true
   */
  isValid?: boolean;

  /**
   * Whether the form is currently being submitted
   * Disables all navigation during submission
   * @default false
   */
  isSubmitting?: boolean;

  /**
   * Whether all navigation should be disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Optional labels for page steps
   * If provided, length must match totalPages
   */
  pageLabels?: string[];

  /**
   * Whether to show the stepper component
   * @default true
   */
  showStepper?: boolean;

  /**
   * Whether to show the progress bar
   * @default true
   */
  showProgress?: boolean;

  /**
   * Custom label for the previous button
   * @default "Previous"
   */
  previousLabel?: string;

  /**
   * Custom label for the next button
   * @default "Next"
   */
  nextLabel?: string;

  /**
   * Custom label for the submit button
   * @default "Submit"
   */
  submitLabel?: string;
}

/**
 * PageNavigation Component
 *
 * Renders navigation controls for multi-page feedback forms including
 * previous/next buttons, page indicators, and progress display.
 *
 * @example
 * ```tsx
 * <PageNavigation
 *   currentPage={1}
 *   totalPages={5}
 *   onPrevious={() => setPage(page - 1)}
 *   onNext={() => setPage(page + 1)}
 *   onSubmit={handleSubmit}
 *   isValid={currentPageIsValid}
 *   isSubmitting={isSubmitting}
 * />
 * ```
 */
export function PageNavigation({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
  onSubmit,
  isValid = true,
  isSubmitting = false,
  disabled = false,
  pageLabels,
  showStepper = true,
  showProgress = true,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  submitLabel = 'Submit',
}: PageNavigationProps): React.JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // Validate props
  if (currentPage < 0 || currentPage >= totalPages) {
    console.error(`Invalid currentPage: ${currentPage}. Must be between 0 and ${totalPages - 1}`);
  }

  if (totalPages <= 0) {
    console.error(`Invalid totalPages: ${totalPages}. Must be greater than 0`);
  }

  if (pageLabels && pageLabels.length !== totalPages) {
    console.error(`pageLabels length (${pageLabels.length}) must match totalPages (${totalPages})`);
  }

  // Calculate progress percentage
  const progressPercentage = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0;

  // Determine if we're on the first or last page
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === totalPages - 1;

  // Determine if navigation should be disabled
  const navigationDisabled = disabled || isSubmitting;

  /**
   * Handle previous button click with error boundary
   */
  const handlePrevious = (): void => {
    if (!isFirstPage && !navigationDisabled) {
      try {
        onPrevious();
      } catch (error) {
        console.error('Error navigating to previous page:', error);
      }
    }
  };

  /**
   * Handle next button click with error boundary
   */
  const handleNext = (): void => {
    if (!isLastPage && !navigationDisabled && isValid) {
      try {
        onNext();
      } catch (error) {
        console.error('Error navigating to next page:', error);
      }
    }
  };

  /**
   * Handle submit button click with error boundary
   */
  const handleSubmit = (): void => {
    if (isLastPage && !navigationDisabled && isValid) {
      try {
        onSubmit();
      } catch (error) {
        console.error('Error submitting feedback:', error);
      }
    }
  };

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    // Allow Ctrl+Enter to submit on any page
    if (event.ctrlKey && event.key === 'Enter' && isValid && !navigationDisabled) {
      try {
        onSubmit();
      } catch (error) {
        console.error('Error submitting feedback:', error);
      }
      return;
    }

    // Prevent default arrow key scrolling
    if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
    }

    // Navigate with arrow keys
    if (event.key === 'ArrowLeft' && !isFirstPage && !navigationDisabled) {
      handlePrevious();
    } else if (event.key === 'ArrowRight' && !isLastPage && !navigationDisabled && isValid) {
      handleNext();
    }
  };

  return (
    <Box
      component="nav"
      aria-label="Feedback page navigation"
      onKeyDown={handleKeyDown}
      sx={{
        width: '100%',
        mt: 3,
        mb: 2,
      }}
    >
      {/* Progress Bar */}
      {showProgress && (
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Page {currentPage + 1} of {totalPages}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(progressPercentage)}% Complete
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progressPercentage}
            aria-label={`Progress: ${Math.round(progressPercentage)}% complete`}
            sx={{
              height: 8,
              borderRadius: 1,
              backgroundColor: theme.palette.action.disabledBackground,
              '& .MuiLinearProgress-bar': {
                borderRadius: 1,
                backgroundColor: theme.palette.primary.main,
              },
            }}
          />
        </Box>
      )}

      {/* Stepper - Hidden on mobile for better UX */}
      {showStepper && !isMobile && totalPages <= 10 && (
        <Box sx={{ mb: 3 }}>
          <Stepper
            activeStep={currentPage}
            alternativeLabel={!isTablet}
            orientation={isTablet ? 'vertical' : 'horizontal'}
            aria-label="Feedback form progress"
          >
            {Array.from({ length: totalPages }, (_, index) => (
              <Step key={index} completed={index < currentPage}>
                <StepLabel>
                  {pageLabels?.[index] ? pageLabels[index] : `Page ${index + 1}`}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}

      {/* Navigation Buttons */}
      <Stack
        direction="row"
        spacing={2}
        justifyContent="space-between"
        alignItems="center"
        sx={{
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          gap: isMobile ? 1 : 2,
        }}
      >
        {/* Previous Button */}
        <Button
          variant="outlined"
          startIcon={<NavigateBeforeIcon />}
          onClick={handlePrevious}
          disabled={isFirstPage || navigationDisabled}
          aria-label={`Go to previous page (Page ${currentPage})`}
          aria-disabled={isFirstPage || navigationDisabled}
          sx={{
            minWidth: isMobile ? '100%' : 140,
            order: isMobile ? 2 : 1,
          }}
        >
          {previousLabel}
        </Button>

        {/* Page Indicator (Mobile Only) */}
        {isMobile && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              order: 1,
              width: '100%',
              textAlign: 'center',
              py: 1,
            }}
            role="status"
            aria-live="polite"
          >
            Page {currentPage + 1} of {totalPages}
          </Typography>
        )}

        {/* Next or Submit Button */}
        {isLastPage ? (
          <Button
            variant="contained"
            color="primary"
            endIcon={<SendIcon />}
            onClick={handleSubmit}
            disabled={!isValid || navigationDisabled}
            aria-label={isSubmitting ? 'Submitting feedback...' : 'Submit feedback form'}
            aria-disabled={!isValid || navigationDisabled}
            sx={{
              minWidth: isMobile ? '100%' : 140,
              order: isMobile ? 3 : 2,
            }}
          >
            {isSubmitting ? 'Submitting...' : submitLabel}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            endIcon={<NavigateNextIcon />}
            onClick={handleNext}
            disabled={!isValid || navigationDisabled}
            aria-label={`Go to next page (Page ${currentPage + 2})`}
            aria-disabled={!isValid || navigationDisabled}
            sx={{
              minWidth: isMobile ? '100%' : 140,
              order: isMobile ? 3 : 2,
            }}
          >
            {nextLabel}
          </Button>
        )}
      </Stack>

      {/* Validation Message */}
      {!isValid && !navigationDisabled && (
        <Typography
          variant="caption"
          color="error"
          sx={{
            display: 'block',
            mt: 1,
            textAlign: 'center',
          }}
          role="alert"
          aria-live="assertive"
        >
          Please answer all required questions before proceeding
        </Typography>
      )}

      {/* Keyboard Shortcut Hint */}
      {!isMobile && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            mt: 2,
            textAlign: 'center',
            fontStyle: 'italic',
          }}
          role="note"
        >
          Tip: Use arrow keys to navigate • Ctrl+Enter to submit
        </Typography>
      )}
    </Box>
  );
}

export default PageNavigation;
