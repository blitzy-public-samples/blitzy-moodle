/**
 * Quiz Navigation Component
 *
 * Sidebar navigation showing all quiz questions with their status
 * (answered/not answered/flagged) and allowing quick navigation between questions.
 * Includes progress tracking, question status indicators, flag toggle functionality,
 * and finish attempt confirmation.
 *
 * @module features/activities/quizzes/components/QuizNavigation
 */

import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Button,
  Grid,
  Tooltip,
  LinearProgress,
  Typography,
  Divider,
  IconButton,
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Flag as FlagIcon,
  FlagOutlined as FlagOutlinedIcon,
} from '@mui/icons-material';
import type { QuestionNavigationState } from '../types/quiz.types';
import { Modal } from '@/components/feedback/Modal';

/**
 * QuizNavigation Props
 */
export interface QuizNavigationProps {
  /** Array of question navigation states */
  questions: QuestionNavigationState[];
  /** Index of the currently displayed question (0-based) */
  currentQuestionIndex: number;
  /** Callback when a question button is clicked */
  onQuestionClick: (index: number) => void;
  /** Callback when flag toggle is clicked for a question */
  onFlagToggle: (index: number) => void;
  /** Callback when finish attempt button is clicked */
  onFinishAttempt: () => void;
  /** Navigation mode: 'free' or 'sequential' */
  navigationMode?: 'free' | 'sequential';
  /** Whether sequential navigation is enforced */
  isSequential?: boolean;
}

/**
 * QuizNavigation Component
 *
 * Displays a grid of question numbers with status indicators,
 * progress tracking, flag toggles, and enables navigation between questions
 */
export const QuizNavigation: React.FC<QuizNavigationProps> = ({
  questions,
  currentQuestionIndex,
  onQuestionClick,
  onFlagToggle,
  onFinishAttempt,
  navigationMode = 'free',
  isSequential = false,
}) => {
  // State for finish attempt confirmation modal
  const [showFinishModal, setShowFinishModal] = useState(false);

  /**
   * Calculate progress statistics
   */
  const stats = useMemo(() => {
    const answered = questions.filter((q) => q.answered).length;
    const flagged = questions.filter((q) => q.flagged).length;
    const total = questions.length;
    const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;

    return {
      answered,
      flagged,
      total,
      percentage,
      notAnswered: total - answered,
    };
  }, [questions]);

  /**
   * Check if navigation to a question is allowed
   */
  const canNavigateToQuestion = useCallback(
    (index: number): boolean => {
      if (navigationMode === 'free' || !isSequential) {
        return true;
      }
      // In sequential mode, use the question's canNavigate property
      return questions[index]?.canNavigate ?? false;
    },
    [navigationMode, isSequential, questions]
  );

  /**
   * Handle question click
   */
  const handleQuestionClick = useCallback(
    (index: number) => {
      if (canNavigateToQuestion(index)) {
        onQuestionClick(index);
      }
    },
    [canNavigateToQuestion, onQuestionClick]
  );

  /**
   * Handle flag toggle
   */
  const handleFlagToggle = useCallback(
    (index: number, event: React.MouseEvent) => {
      event.stopPropagation();
      onFlagToggle(index);
    },
    [onFlagToggle]
  );

  /**
   * Handle finish attempt confirmation
   */
  const handleFinishConfirm = useCallback(() => {
    setShowFinishModal(false);
    onFinishAttempt();
  }, [onFinishAttempt]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, currentIndex: number) => {
      let targetIndex: number | null = null;

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          // Navigate to next question
          if (currentIndex < questions.length - 1) {
            targetIndex = currentIndex + 1;
          }
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          // Navigate to previous question
          if (currentIndex > 0) {
            targetIndex = currentIndex - 1;
          }
          break;
        default:
          return;
      }

      if (targetIndex !== null) {
        event.preventDefault();
        const targetButton = document.querySelector(
          `[data-question-index="${targetIndex}"]`
        ) as HTMLButtonElement;
        if (targetButton && !targetButton.disabled) {
          targetButton.focus();
        }
      }
    },
    [questions.length]
  );

  /**
   * Get accessible name for question button
   */
  const getQuestionAccessibleName = (
    index: number,
    question: QuestionNavigationState
  ): string => {
    let name = `Navigate to question ${index + 1}`;
    if (question.answered) {
      name += ' (answered)';
    }
    if (question.flagged) {
      name += ' (flagged)';
    }
    return name;
  };

  /**
   * Get tooltip text for question button
   */
  const getTooltipText = (
    index: number,
    question: QuestionNavigationState,
    canNavigate: boolean
  ): string => {
    if (!canNavigate) {
      return 'Complete previous questions first';
    }
    
    const parts: string[] = [`Question ${index + 1}`];
    
    if (question.answered) {
      parts.push('Answered');
    } else {
      parts.push('Not answered');
    }
    
    if (question.flagged) {
      parts.push('Flagged for review');
    }
    
    return parts.join(' - ');
  };

  return (
    <Box
      sx={{
        position: 'sticky',
        padding: '16px',
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
      }}
      data-testid="quiz-navigation"
    >
      {/* Header */}
      <Typography variant="h6" gutterBottom>
        Quiz Navigation
      </Typography>

      {/* Progress Section */}
      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {stats.answered} of {stats.total} answered
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {stats.percentage}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={stats.percentage}
          sx={{ height: 8, borderRadius: 1 }}
        />
      </Box>

      {stats.flagged > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 2,
          }}
        >
          <FlagIcon color="warning" fontSize="small" />
          <Typography variant="body2" color="text.secondary">
            {stats.flagged} flagged
          </Typography>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Sequential Navigation Info */}
      {isSequential && (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            bgcolor: 'info.light',
            borderRadius: 1,
          }}
        >
          <Typography variant="body2" color="info.contrastText">
            Sequential navigation - answer questions in order
          </Typography>
        </Box>
      )}

      {/* Questions Section */}
      <Typography variant="subtitle2" gutterBottom>
        Questions
      </Typography>

      <Grid container spacing={1} sx={{ mb: 2 }}>
        {questions.map((question, index) => {
          const isCurrent = index === currentQuestionIndex;
          const canNavigate = canNavigateToQuestion(index);
          const tooltipText = getTooltipText(index, question, canNavigate);
          const accessibleName = getQuestionAccessibleName(index, question);

          // Determine button color based on state
          // Priority: current > answered > flagged > default
          let buttonColor: 'primary' | 'success' | 'warning' | 'inherit' = 'inherit';
          if (isCurrent) {
            buttonColor = 'primary';
          } else if (question.answered) {
            buttonColor = 'success';
          } else if (question.flagged) {
            buttonColor = 'warning';
          }

          return (
            <Grid item xs={3} key={index}>
              <Tooltip title={tooltipText} arrow>
                <Box sx={{ position: 'relative' }}>
                  <Button
                    variant={isCurrent ? 'contained' : 'outlined'}
                    color={buttonColor}
                    fullWidth
                    onClick={() => handleQuestionClick(index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    disabled={!canNavigate}
                    aria-label={accessibleName}
                    aria-current={isCurrent ? 'true' : undefined}
                    data-question-index={index}
                    sx={{
                      minWidth: 0,
                      fontWeight: isCurrent ? 600 : 400,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.5,
                    }}
                  >
                    {question.answered && (
                      <CheckCircle sx={{ fontSize: 16 }} />
                    )}
                    {index + 1}
                  </Button>

                  {/* Flag toggle button */}
                  <IconButton
                    size="small"
                    onClick={(e) => handleFlagToggle(index, e)}
                    aria-label={question.flagged ? 'remove flag' : 'flag for review'}
                    sx={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      backgroundColor: 'background.paper',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    {question.flagged ? (
                      <FlagIcon color="warning" fontSize="small" />
                    ) : (
                      <FlagOutlinedIcon color="disabled" fontSize="small" />
                    )}
                  </IconButton>
                </Box>
              </Tooltip>
            </Grid>
          );
        })}
      </Grid>

      {/* Legend */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
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
            <CheckCircle color="success" sx={{ fontSize: 16 }} />
            <Typography variant="caption" color="text.secondary">
              Answered
            </Typography>
          </Box>
          {stats.flagged > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FlagIcon color="warning" sx={{ fontSize: 16 }} />
              <Typography variant="caption" color="text.secondary">
                Flagged for review
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RadioButtonUnchecked color="disabled" sx={{ fontSize: 16 }} />
            <Typography variant="caption" color="text.secondary">
              Not answered
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Finish Button */}
      <Button
        variant="contained"
        color="primary"
        fullWidth
        onClick={() => setShowFinishModal(true)}
        aria-label="finish quiz attempt"
        sx={{ fontWeight: 600 }}
      >
        Finish Attempt
      </Button>

      {/* Finish Confirmation Modal */}
      <Modal
        open={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        title="Finish Quiz Attempt?"
      >
        <Box>
          <Typography variant="body1" gutterBottom>
            {stats.answered} of {stats.total} questions answered
          </Typography>

          {stats.notAnswered > 0 && (
            <Typography variant="body2" color="warning.main" gutterBottom>
              You have not answered all questions.
            </Typography>
          )}

          {stats.flagged > 0 && (
            <Typography variant="body2" color="info.main" gutterBottom>
              {stats.flagged} {stats.flagged === 1 ? 'question' : 'questions'} flagged for review
            </Typography>
          )}

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1,
              mt: 2,
            }}
          >
            <Button
              variant="outlined"
              onClick={() => setShowFinishModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleFinishConfirm}
            >
              Finish Attempt
            </Button>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

export default QuizNavigation;
