/**
 * QuizNavigation Component
 *
 * Question navigation panel component that displays all questions in the quiz with status
 * indicators (answered, flagged, current), provides quick navigation between questions,
 * and shows overall progress. This component mirrors the functionality of Moodle's PHP
 * quiz navigation panel (mod_quiz\output\navigation_panel_attempt).
 *
 * Features:
 * - Visual status indicators using color-coded buttons (green=answered, orange=flagged,
 *   gray=not answered, blue=current question)
 * - Quick navigation to any question (in free navigation mode)
 * - Sequential navigation enforcement (in sequential mode)
 * - Progress bar showing completion percentage
 * - Summary statistics (e.g., "5 of 10 answered")
 * - Flag/unflag questions for later review
 * - Finish attempt button with confirmation dialog
 * - Sticky positioning on scroll for persistent access
 * - Responsive layout that adapts to mobile viewports
 * - Keyboard navigation support (arrow keys, Enter)
 * - Tooltips showing detailed question status on hover
 *
 * Navigation Modes:
 * - Free Navigation: Students can jump to any question at any time
 * - Sequential Navigation: Students must answer questions in order
 *
 * Color Coding:
 * - Blue (#1976d2): Current question being viewed
 * - Green (#2e7d32): Question has been answered
 * - Orange (#ed6c02): Question is flagged for review
 * - Gray (#757575): Question not yet answered
 *
 * Usage Example:
 * ```tsx
 * <QuizNavigation
 *   questions={questionNavigationStates}
 *   currentQuestionIndex={2}
 *   onQuestionClick={(index) => navigateToQuestion(index)}
 *   onFlagToggle={(index) => toggleQuestionFlag(index)}
 *   onFinishAttempt={() => submitQuizAttempt()}
 *   navigationMode="free"
 *   isSequential={false}
 * />
 * ```
 *
 * @package    react-frontend
 * @subpackage features/activities/quizzes/components
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import type React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Grid,
  Button,
  LinearProgress,
  Typography,
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Flag as FlagIcon,
  FlagOutlined as FlagOutlinedIcon,
} from '@mui/icons-material';
import { Modal } from '../../../../components/feedback/Modal';
import type { QuestionNavigationState } from '../types/quiz.types';

/**
 * Props interface for the QuizNavigation component
 * Defines all required and optional properties for navigation panel configuration
 */
export interface QuizNavigationProps {
  /**
   * Array of question navigation states
   * Each entry contains question slot, display number, answered/flagged status
   * @required
   */
  questions: QuestionNavigationState[];

  /**
   * Index of the currently displayed question (0-based)
   * Used to highlight the current question button
   * @required
   */
  currentQuestionIndex: number;

  /**
   * Callback fired when user clicks on a question button
   * Receives the question index as parameter
   * @required
   */
  onQuestionClick: (index: number) => void;

  /**
   * Callback fired when user toggles the flag status of a question
   * Receives the question index as parameter
   * @required
   */
  onFlagToggle: (index: number) => void;

  /**
   * Callback fired when user confirms finishing the attempt
   * Should trigger quiz submission logic in parent component
   * @required
   */
  onFinishAttempt: () => void;

  /**
   * Navigation mode: 'free' allows jumping to any question, 'seq' enforces sequential order
   * Maps to QuizNavMethod enum values
   * @default 'free'
   */
  navigationMode?: 'free' | 'seq';

  /**
   * Whether sequential navigation is enforced
   * When true, students can only navigate to next unanswered question
   * @default false
   */
  isSequential?: boolean;
}

/**
 * QuizNavigation Component
 *
 * Renders the quiz navigation panel with question buttons, progress indicator,
 * and finish attempt button. Handles all navigation interactions and state display.
 *
 * @param props - QuizNavigationProps configuration object
 * @returns React functional component
 */
function QuizNavigation({
  questions,
  currentQuestionIndex,
  onQuestionClick,
  onFlagToggle,
  onFinishAttempt,
  navigationMode = 'free',
  isSequential = false,
}: QuizNavigationProps): JSX.Element {
  // State for finish attempt confirmation modal
  const [showFinishModal, setShowFinishModal] = useState<boolean>(false);

  // Calculate progress statistics using useMemo for performance
  const progressStats = useMemo(() => {
    const answeredCount = questions.filter((q) => q.answered).length;
    const totalCount = questions.length;
    const progressPercentage = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;
    const flaggedCount = questions.filter((q) => q.flagged).length;

    return {
      answeredCount,
      totalCount,
      progressPercentage,
      flaggedCount,
    };
  }, [questions]);

  /**
   * Handles question button click with navigation mode enforcement
   * In sequential mode, only allows navigation to next unanswered question
   * In free mode, allows navigation to any question
   */
  const handleQuestionClick = useCallback(
    (index: number) => {
      const question = questions[index];

      // Guard against invalid index
      if (!question) {
        return;
      }

      // Check if navigation to this question is allowed
      if (isSequential && !question.canNavigate) {
        // In sequential mode, don't allow navigation to future questions
        return;
      }

      onQuestionClick(index);
    },
    [questions, isSequential, onQuestionClick]
  );

  /**
   * Handles keyboard navigation within the navigation panel
   * Arrow keys: Navigate between question buttons
   * Enter/Space: Select focused question button
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      let targetIndex = index;

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          targetIndex = Math.min(index + 1, questions.length - 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          targetIndex = Math.max(index - 1, 0);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          handleQuestionClick(index);
          return;
        default:
          return;
      }

      // Focus the target button after navigation
      const targetButton = document.querySelector(
        `[data-question-index="${targetIndex}"]`
      ) as HTMLButtonElement;
      if (targetButton) {
        targetButton.focus();
      }
    },
    [questions.length, handleQuestionClick]
  );

  /**
   * Handles flag toggle button click
   * Toggles the flagged state of the specified question
   */
  const handleFlagToggle = useCallback(
    (event: React.MouseEvent, index: number) => {
      event.stopPropagation(); // Prevent triggering question navigation
      onFlagToggle(index);
    },
    [onFlagToggle]
  );

  /**
   * Opens the finish attempt confirmation modal
   */
  const handleFinishAttemptClick = useCallback(() => {
    setShowFinishModal(true);
  }, []);

  /**
   * Closes the finish attempt confirmation modal
   */
  const handleCloseModal = useCallback(() => {
    setShowFinishModal(false);
  }, []);

  /**
   * Confirms finish attempt and triggers submission
   */
  const handleConfirmFinish = useCallback(() => {
    setShowFinishModal(false);
    onFinishAttempt();
  }, [onFinishAttempt]);

  /**
   * Determines the button color based on question state
   * Priority: current (blue) > answered (green) > flagged (orange) > default (gray)
   */
  const getQuestionButtonColor = useCallback(
    (question: QuestionNavigationState, index: number) => {
      if (index === currentQuestionIndex) {
        return 'primary'; // Blue for current question
      }
      if (question.answered) {
        return 'success'; // Green for answered
      }
      if (question.flagged) {
        return 'warning'; // Orange for flagged
      }
      return 'inherit'; // Gray for not answered
    },
    [currentQuestionIndex]
  );

  /**
   * Determines the button variant based on question state
   * Current question uses 'contained', others use 'outlined'
   */
  const getQuestionButtonVariant = useCallback(
    (index: number) => {
      return index === currentQuestionIndex ? 'contained' : 'outlined';
    },
    [currentQuestionIndex]
  );

  /**
   * Generates tooltip text with detailed question status
   */
  const getQuestionTooltip = useCallback((question: QuestionNavigationState) => {
    const parts: string[] = [`Question ${question.number}`];

    if (question.answered) {
      parts.push('Answered');
    } else {
      parts.push('Not answered');
    }

    if (question.flagged) {
      parts.push('Flagged for review');
    }

    if (question.state) {
      parts.push(`Status: ${question.state}`);
    }

    return parts.join(' • ');
  }, []);

  /**
   * Determines if navigation to a question is disabled
   * In sequential mode, only current and previous questions are enabled
   */
  const isQuestionDisabled = useCallback(
    (question: QuestionNavigationState, _index: number) => {
      if (navigationMode === 'free') {
        return false; // All questions accessible in free mode
      }

      // In sequential mode, can only navigate to current or previous questions
      if (isSequential && question.canNavigate === false) {
        return true;
      }

      return false;
    },
    [navigationMode, isSequential]
  );

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 16,
        padding: 2,
        backgroundColor: 'background.paper',
        borderRadius: 1,
        boxShadow: 2,
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto',
      }}
    >
      {/* Progress Section */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Quiz Navigation
        </Typography>

        {/* Progress Bar */}
        <Box sx={{ mb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progressStats.progressPercentage}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>

        {/* Progress Statistics */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {progressStats.answeredCount} of {progressStats.totalCount} answered
          </Typography>
          {progressStats.flaggedCount > 0 && (
            <Typography variant="body2" color="warning.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FlagIcon fontSize="small" />
              {progressStats.flaggedCount} flagged
            </Typography>
          )}
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Question Grid */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Questions
        </Typography>
        <Grid container spacing={1}>
          {questions.map((question, index) => (
            <Grid item xs={3} sm={2} md={3} key={question.slot}>
              <Tooltip title={getQuestionTooltip(question)} arrow placement="top">
                <Box sx={{ position: 'relative' }}>
                  <Button
                    fullWidth
                    variant={getQuestionButtonVariant(index)}
                    color={getQuestionButtonColor(question, index)}
                    onClick={() => handleQuestionClick(index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    disabled={isQuestionDisabled(question, index)}
                    data-question-index={index}
                    sx={{
                      minWidth: 0,
                      aspectRatio: '1/1',
                      fontSize: '0.875rem',
                      fontWeight: index === currentQuestionIndex ? 600 : 400,
                      position: 'relative',
                    }}
                    aria-label={`Navigate to question ${question.number}${
                      question.answered ? ' (answered)' : ''
                    }${question.flagged ? ' (flagged)' : ''}`}
                    aria-current={index === currentQuestionIndex ? 'true' : undefined}
                  >
                    {question.number}
                    {question.answered && (
                      <CheckCircleIcon
                        sx={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          fontSize: 12,
                          color: index === currentQuestionIndex ? 'white' : 'success.main',
                        }}
                      />
                    )}
                  </Button>

                  {/* Flag Toggle Button */}
                  <IconButton
                    size="small"
                    onClick={(e) => handleFlagToggle(e, index)}
                    sx={{
                      position: 'absolute',
                      bottom: -8,
                      right: -8,
                      backgroundColor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      padding: 0.25,
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                    aria-label={question.flagged ? 'Remove flag' : 'Flag for review'}
                  >
                    {question.flagged ? (
                      <FlagIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                    ) : (
                      <FlagOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    )}
                  </IconButton>
                </Box>
              </Tooltip>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Legend */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" display="block" gutterBottom>
          Legend:
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: 'primary.main',
                borderRadius: 0.5,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              Current question
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: 'success.main',
                borderRadius: 0.5,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              Answered
            </Typography>
          </Box>
          {progressStats.flaggedCount > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  backgroundColor: 'warning.main',
                  borderRadius: 0.5,
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Flagged for review
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 0.5,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              Not answered
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Finish Attempt Button */}
      <Button
        variant="contained"
        color="primary"
        fullWidth
        size="large"
        onClick={handleFinishAttemptClick}
        sx={{ fontWeight: 600 }}
        aria-label="Finish quiz attempt"
      >
        Finish Attempt
      </Button>

      {/* Navigation Mode Info */}
      {isSequential && (
        <Typography
          variant="caption"
          color="info.main"
          sx={{ display: 'block', mt: 1, textAlign: 'center' }}
        >
          Sequential navigation: answer questions in order
        </Typography>
      )}

      {/* Finish Attempt Confirmation Modal */}
      <Modal
        open={showFinishModal}
        onClose={handleCloseModal}
        title="Finish Quiz Attempt?"
        maxWidth="sm"
        actions={[
          {
            label: 'Cancel',
            onClick: handleCloseModal,
            color: 'inherit',
          },
          {
            label: 'Finish Attempt',
            onClick: handleConfirmFinish,
            color: 'primary',
            variant: 'contained',
            autoFocus: true,
          },
        ]}
      >
        <Typography variant="body1" paragraph>
          Are you sure you want to finish this quiz attempt?
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Once you finish, you will not be able to change your answers.
        </Typography>
        <Box
          sx={{
            p: 2,
            backgroundColor: 'info.light',
            borderRadius: 1,
            mb: 2,
          }}
        >
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Current Progress:
          </Typography>
          <Typography variant="body2">
            • {progressStats.answeredCount} of {progressStats.totalCount} questions answered
          </Typography>
          {progressStats.flaggedCount > 0 && (
            <Typography variant="body2" color="warning.dark">
              • {progressStats.flaggedCount} question{progressStats.flaggedCount !== 1 ? 's' : ''}{' '}
              flagged for review
            </Typography>
          )}
        </Box>
        {progressStats.answeredCount < progressStats.totalCount && (
          <Typography variant="body2" color="warning.main">
            <strong>Warning:</strong> You have not answered all questions. Unanswered questions
            will receive zero marks.
          </Typography>
        )}
      </Modal>
    </Box>
  );
}

export default QuizNavigation;
