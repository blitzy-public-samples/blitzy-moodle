/**
 * QuizSummary Component
 *
 * Quiz attempt summary component displayed before final submission, showing all questions
 * with their answer status, flagged questions, and submission confirmation. Provides the
 * last chance to review and navigate to unanswered questions before submitting the quiz.
 *
 * Features:
 * - Display quiz attempt information (attempt number, time taken, due date)
 * - Show list of all questions with status indicators
 * - Color-coded questions by status (answered: green, unanswered: red, flagged: orange)
 * - Navigation back to specific questions for review
 * - Warning message for unanswered questions
 * - Submit confirmation dialog with warning about finality
 * - Statistics summary (total questions, answered, unanswered, flagged)
 * - Integration with QuizNavigation component
 * - React Query mutation for quiz submission
 * - Loading state handling during submission
 * - Success/error feedback using toast notifications
 * - Print view support
 * - Access rules warnings display
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Divider,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Stack,
  Grid,
  Link,
  CircularProgress,
} from '@mui/material';
import {
  Print as PrintIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Flag as FlagIcon,
  Timer as TimerIcon,
  Event as EventIcon,
  Assignment as AssignmentIcon,
  Send as SendIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

// Internal imports from dependencies
import type { AttemptSummary, QuizAttempt, QuestionNavigationState, Question } from '../types/quiz.types';
import { QuestionState } from '../types/quiz.types';
import { QuizNavigation } from './QuizNavigation';
import useQuizAttempt from '../hooks/useQuizAttempt';
import { getAttemptSummary } from '../api/quizApi';
import { Modal } from '@/components/feedback/Modal';
import { Alert } from '@/components/feedback/Alert';
import Card from '@/components/data-display/Card';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { formatDateTime } from '@/utils/date';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Props interface for the QuizSummary component
 */
export interface QuizSummaryProps {
  /**
   * Optional attempt ID override (uses URL params by default)
   */
  attemptId?: number;

  /**
   * Optional quiz ID for navigation purposes
   */
  quizId?: number;

  /**
   * Callback function called after successful submission
   */
  onSubmitSuccess?: (attemptId: number) => void;

  /**
   * Callback function to return to attempt for editing
   */
  onReturnToAttempt?: (questionNumber: number) => void;
}

/**
 * Question status type for display purposes
 */
type QuestionStatus = 'answered' | 'unanswered' | 'flagged';

/**
 * Statistics about the quiz attempt
 */
interface AttemptStatistics {
  total: number;
  answered: number;
  unanswered: number;
  flagged: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine the status of a question for display purposes
 * Uses the Question type's state property to determine if answered
 *
 * @param question - Question data from attempt summary
 * @returns The status of the question
 */
function getQuestionStatus(question: Question): QuestionStatus {
  if (question.flagged) {
    return 'flagged';
  }
  // Check if question has been answered based on state
  // A question is answered if state is not TODO or undefined
  const isAnswered = question.state && question.state !== QuestionState.TODO;
  if (isAnswered) {
    return 'answered';
  }
  return 'unanswered';
}

/**
 * Get the color associated with a question status
 *
 * @param status - The question status
 * @returns MUI color string for the status
 */
function getStatusColor(status: QuestionStatus): 'success' | 'error' | 'warning' {
  switch (status) {
    case 'answered':
      return 'success';
    case 'unanswered':
      return 'error';
    case 'flagged':
      return 'warning';
  }
}

/**
 * Get the icon component for a question status
 *
 * @param status - The question status
 * @returns React element for the status icon
 */
function getStatusIcon(status: QuestionStatus): React.ReactElement {
  switch (status) {
    case 'answered':
      return <CheckCircleIcon fontSize="small" color="success" />;
    case 'unanswered':
      return <CancelIcon fontSize="small" color="error" />;
    case 'flagged':
      return <FlagIcon fontSize="small" color="warning" />;
  }
}

/**
 * Get human-readable status label
 *
 * @param status - The question status
 * @returns Human-readable label for the status
 */
function getStatusLabel(status: QuestionStatus): string {
  switch (status) {
    case 'answered':
      return 'Answered';
    case 'unanswered':
      return 'Not yet answered';
    case 'flagged':
      return 'Flagged for review';
  }
}

/**
 * Format time remaining in human-readable format
 *
 * @param seconds - Time remaining in seconds
 * @returns Formatted time string
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) {
    return 'Time expired';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }
  if (remainingSeconds > 0 && hours === 0) {
    parts.push(`${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`);
  }

  return parts.join(', ') || '0 seconds';
}

/**
 * Format duration from seconds to human-readable format
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
function formatDuration(seconds: number): string {
  if (seconds <= 0) {
    return '0 seconds';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds}s`);
  }

  return parts.join(' ');
}

/**
 * Calculate attempt statistics from summary data
 *
 * @param summary - The attempt summary data
 * @returns Calculated statistics
 */
function calculateStatistics(summary: AttemptSummary): AttemptStatistics {
  return {
    total: summary.total,
    answered: summary.answered,
    unanswered: summary.total - summary.answered,
    flagged: summary.flagged,
  };
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Component for displaying attempt information header
 */
interface AttemptInfoHeaderProps {
  attempt: QuizAttempt;
  timeRemaining: number;
}

function AttemptInfoHeader({ attempt, timeRemaining }: AttemptInfoHeaderProps): React.ReactElement {
  return (
    <Card
      title={
        <Typography variant="h5" component="h1">
          <AssignmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Quiz Summary
        </Typography>
      }
      elevation={2}
      sx={{ mb: 3 }}
    >
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <AssignmentIcon sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Attempt Number
            </Typography>
          </Box>
          <Typography variant="h6">{attempt.attempt}</Typography>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <TimerIcon sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Time Taken
            </Typography>
          </Box>
          <Typography variant="h6">
            {attempt.timefinish && attempt.timestart
              ? formatDuration(attempt.timefinish - attempt.timestart)
              : formatDuration(Math.floor(Date.now() / 1000) - attempt.timestart)}
          </Typography>
        </Grid>

        {timeRemaining > 0 && (
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <TimerIcon sx={{ mr: 1, color: 'warning.main' }} fontSize="small" />
              <Typography variant="body2" color="text.secondary">
                Time Remaining
              </Typography>
            </Box>
            <Typography variant="h6" color="warning.main">
              {formatTimeRemaining(timeRemaining)}
            </Typography>
          </Grid>
        )}

        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <EventIcon sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Started
            </Typography>
          </Box>
          <Typography variant="h6">
            {formatDateTime(new Date(attempt.timestart * 1000))}
          </Typography>
        </Grid>
      </Grid>
    </Card>
  );
}

/**
 * Component for displaying statistics summary
 */
interface StatisticsSummaryProps {
  statistics: AttemptStatistics;
}

function StatisticsSummary({ statistics }: StatisticsSummaryProps): React.ReactElement {
  return (
    <Paper sx={{ p: 2, mb: 3 }} elevation={1}>
      <Typography variant="h6" gutterBottom>
        Summary Statistics
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary.main">
              {statistics.total}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Questions
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">
              {statistics.answered}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Answered
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="error.main">
              {statistics.unanswered}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Unanswered
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="warning.main">
              {statistics.flagged}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Flagged
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}

/**
 * Component for displaying the questions table
 */
interface QuestionsTableProps {
  questions: Question[];
  onNavigateToQuestion: (questionNumber: number) => void;
}

function QuestionsTable({ questions, onNavigateToQuestion }: QuestionsTableProps): React.ReactElement {
  return (
    <TableContainer component={Paper} sx={{ mb: 3 }}>
      <Table aria-label="Quiz questions summary">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>Question</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Marks</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }} align="right">
              Action
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {questions.map((question, index) => {
            const status = getQuestionStatus(question);
            const statusColor = getStatusColor(status);
            const statusIcon = getStatusIcon(status);
            const statusLabel = getStatusLabel(status);
            // Use question.id or index for key, slot may be undefined
            const questionKey = question.slot ?? question.id ?? index;
            // Use question.name for display, fallback to truncated questiontext
            const questionSummary = question.name || 
              (question.questiontext?.substring(0, 50) + (question.questiontext?.length > 50 ? '...' : ''));

            return (
              <TableRow
                key={questionKey}
                sx={{
                  '&:last-child td, &:last-child th': { border: 0 },
                  backgroundColor:
                    status === 'unanswered'
                      ? 'error.lighter'
                      : status === 'flagged'
                      ? 'warning.lighter'
                      : 'inherit',
                }}
              >
                <TableCell component="th" scope="row">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                      Question {index + 1}
                    </Typography>
                    {question.flagged && (
                      <FlagIcon
                        sx={{ ml: 1, color: 'warning.main' }}
                        fontSize="small"
                        titleAccess="Flagged for review"
                      />
                    )}
                  </Box>
                  {questionSummary && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {questionSummary}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    icon={statusIcon}
                    label={statusLabel}
                    color={statusColor}
                    variant="outlined"
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {question.maxmark !== undefined ? `${question.maxmark} marks` : '-'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => onNavigateToQuestion(index + 1)}
                    sx={{ cursor: 'pointer' }}
                    underline="hover"
                  >
                    Return to attempt
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/**
 * Component for displaying access rules warnings
 */
interface AccessRulesWarningsProps {
  warnings: string[];
}

function AccessRulesWarnings({ warnings }: AccessRulesWarningsProps): React.ReactElement | null {
  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      {warnings.map((warning, index) => (
        <Alert
          key={index}
          severity="warning"
          message={warning}
          sx={{ mb: 1 }}
        />
      ))}
    </Box>
  );
}

/**
 * Submission confirmation dialog component
 */
interface SubmitConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  hasUnanswered: boolean;
  unansweredCount: number;
  isSubmitting: boolean;
}

function SubmitConfirmDialog({
  open,
  onClose,
  onConfirm,
  hasUnanswered,
  unansweredCount,
  isSubmitting,
}: SubmitConfirmDialogProps): React.ReactElement {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit Quiz?"
      maxWidth="sm"
      disableBackdropClick={isSubmitting}
      disableEscapeKeyDown={isSubmitting}
      loading={isSubmitting}
      actions={[
        {
          label: 'Cancel',
          onClick: onClose,
          variant: 'text',
          disabled: isSubmitting,
        },
        {
          label: isSubmitting ? 'Submitting...' : 'Submit all and finish',
          onClick: onConfirm,
          color: 'primary',
          variant: 'contained',
          disabled: isSubmitting,
          loading: isSubmitting,
          autoFocus: true,
        },
      ]}
    >
      <Box>
        <Alert
          severity="warning"
          message="Once you submit, you will no longer be able to change your answers for this attempt."
          sx={{ mb: 2 }}
        />

        {hasUnanswered && (
          <Alert
            severity="error"
            message={
              <span>
                <strong>Warning:</strong> You have {unansweredCount} unanswered{' '}
                {unansweredCount === 1 ? 'question' : 'questions'}. Are you sure you want to
                submit without answering {unansweredCount === 1 ? 'it' : 'them'}?
              </span>
            }
            sx={{ mb: 2 }}
          />
        )}

        <Typography variant="body1" color="text.secondary">
          Are you sure you want to submit this quiz? This action cannot be undone.
        </Typography>
      </Box>
    </Modal>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * QuizSummary Component
 *
 * Displays the quiz attempt summary before final submission, allowing users to review
 * their answers, navigate to specific questions, and confirm submission.
 *
 * @param props - Component props
 * @returns React element
 */
export default function QuizSummary({
  attemptId: propAttemptId,
  quizId: propQuizId,
  onSubmitSuccess,
  onReturnToAttempt,
}: QuizSummaryProps): React.ReactElement {
  // Extract attempt ID from URL params or props
  const params = useParams<{ attemptId: string; quizId?: string }>();
  const navigate = useNavigate();

  // Resolve attempt ID from props or URL params
  const attemptId = propAttemptId ?? parseInt(params.attemptId ?? '0', 10);
  const quizId = propQuizId ?? parseInt(params.quizId ?? '0', 10);

  // State for submission confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);

  // Toast notifications
  const { success, error } = useToast();

  // Quiz attempt hook for submission
  const { finishAttempt, isSubmitting } = useQuizAttempt({ quizId, attemptId });

  // Fetch attempt summary data
  const {
    data: summaryData,
    isLoading,
    isError,
    error: fetchError,
    refetch,
  } = useQuery<AttemptSummary, Error>({
    queryKey: ['quiz', 'attempt', attemptId, 'summary'],
    queryFn: () => getAttemptSummary(attemptId),
    enabled: attemptId > 0,
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  // Calculate statistics from summary data
  const statistics = summaryData ? calculateStatistics(summaryData) : null;

  // Check for unanswered questions
  const hasUnanswered = statistics ? statistics.unanswered > 0 : false;
  const unansweredCount = statistics?.unanswered ?? 0;

  /**
   * Handle navigation back to a specific question
   *
   * @param questionNumber - The question number to navigate to
   */
  const handleNavigateToQuestion = (questionNumber: number): void => {
    if (onReturnToAttempt) {
      onReturnToAttempt(questionNumber);
    } else {
      // Default navigation using React Router
      navigate(`/quizzes/${quizId}/attempt/${attemptId}?page=${questionNumber - 1}`);
    }
  };

  /**
   * Handle opening the submission confirmation dialog
   */
  const handleOpenConfirmDialog = (): void => {
    setShowConfirmDialog(true);
  };

  /**
   * Handle closing the submission confirmation dialog
   */
  const handleCloseConfirmDialog = (): void => {
    if (!isSubmitting) {
      setShowConfirmDialog(false);
    }
  };

  /**
   * Handle quiz submission
   */
  const handleSubmit = async (): Promise<void> => {
    try {
      // finishAttempt takes no arguments - the hook already has attemptId context
      await finishAttempt();

      // Close dialog
      setShowConfirmDialog(false);

      // Show success message
      success('Quiz submitted successfully! Your answers have been recorded.');

      // Call success callback or navigate to review
      if (onSubmitSuccess) {
        onSubmitSuccess(attemptId);
      } else {
        // Navigate to review page
        navigate(`/quizzes/${quizId}/attempt/${attemptId}/review`);
      }
    } catch (err) {
      // Show error message
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit quiz';
      error(`Submission failed: ${errorMessage}. Please try again.`);

      // Don't close dialog on error - let user retry
    }
  };

  /**
   * Handle print view
   */
  const handlePrint = (): void => {
    window.print();
  };

  /**
   * Handle return to attempt button
   */
  const handleReturnToAttempt = (): void => {
    handleNavigateToQuestion(1);
  };

  /**
   * Handle flag toggle for a question
   * On the summary page, this navigates back to the question
   * where the user can toggle the flag
   *
   * @param index - The 0-based index of the question
   */
  const handleFlagToggle = (index: number): void => {
    // Navigate back to the question to allow flag toggling
    handleNavigateToQuestion(index + 1);
  };

  /**
   * Handle finish attempt from navigation component
   * Opens the confirmation dialog
   */
  const handleFinishAttempt = (): void => {
    handleOpenConfirmDialog();
  };

  /**
   * Transform QuestionSummary array to QuestionNavigationState array
   * for compatibility with QuizNavigation component
   */
  const getNavigationQuestions = (): QuestionNavigationState[] => {
    if (!summaryData?.questions) {
      return [];
    }

    return summaryData.questions.map((q, index) => {
      // Determine if question has been answered based on state
      const isAnswered = q.state !== undefined && q.state !== QuestionState.TODO;
      
      return {
        slot: q.slot ?? index + 1,
        number: String(q.displaynumber ?? index + 1),
        answered: isAnswered,
        flagged: q.flagged ?? false,
        page: q.page ?? Math.floor(index / 10) + 1,
        isCurrentQuestion: false, // No current question on summary page
        state: q.state ?? QuestionState.TODO,
      };
    });
  };

  // Memoize navigation questions to avoid recalculation
  const navigationQuestions = useMemo(() => getNavigationQuestions(), [summaryData?.questions]);

  // Loading state
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <LoadingSpinner size="large" message="Loading quiz summary..." />
      </Box>
    );
  }

  // Error state
  if (isError || !summaryData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          title="Error Loading Summary"
          message={
            fetchError?.message ?? 'Failed to load quiz summary. Please try again.'
          }
          action={
            <Button onClick={() => refetch()} size="small" variant="outlined">
              Retry
            </Button>
          }
        />
      </Box>
    );
  }

  // Validate attempt ID
  if (attemptId <= 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          title="Invalid Attempt"
          message="No valid attempt ID provided. Please return to the quiz and try again."
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: 1200,
        mx: 'auto',
        p: 3,
        '@media print': {
          p: 1,
        },
      }}
    >
      {/* Attempt Information Header */}
      <AttemptInfoHeader
        attempt={summaryData.attempt}
        timeRemaining={summaryData.timeremaining}
      />

      {/* Access Rules Warnings */}
      {summaryData.warnings && (
        <AccessRulesWarnings warnings={summaryData.warnings} />
      )}

      {/* Warning for Unanswered Questions */}
      {hasUnanswered && (
        <Alert
          severity="warning"
          title="Unanswered Questions"
          message={
            <span>
              You have <strong>{unansweredCount}</strong> unanswered{' '}
              {unansweredCount === 1 ? 'question' : 'questions'}. You may want to
              review and answer {unansweredCount === 1 ? 'it' : 'them'} before
              submitting.
            </span>
          }
          sx={{ mb: 3 }}
        />
      )}

      {/* Statistics Summary */}
      {statistics && <StatisticsSummary statistics={statistics} />}

      <Divider sx={{ my: 3 }} />

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Questions Table */}
        <Grid item xs={12} md={8}>
          <Typography variant="h6" gutterBottom>
            Question Summary
          </Typography>
          <QuestionsTable
            questions={summaryData.questions}
            onNavigateToQuestion={handleNavigateToQuestion}
          />
        </Grid>

        {/* Quiz Navigation Sidebar */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, position: { md: 'sticky' }, top: { md: 16 } }} elevation={1}>
            <Typography variant="h6" gutterBottom>
              Quick Navigation
            </Typography>
            <QuizNavigation
              questions={navigationQuestions}
              currentQuestionIndex={0}
              onQuestionClick={handleNavigateToQuestion}
              onFlagToggle={handleFlagToggle}
              onFinishAttempt={handleFinishAttempt}
            />
          </Paper>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Action Buttons */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          '@media print': {
            display: 'none',
          },
        }}
      >
        {/* Left Actions */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleReturnToAttempt}
          >
            Return to attempt
          </Button>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ display: { xs: 'none', sm: 'flex' } }}
          >
            Print summary
          </Button>
        </Stack>

        {/* Right Actions */}
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
          onClick={handleOpenConfirmDialog}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit all and finish'}
        </Button>
      </Box>

      {/* Submission Confirmation Dialog */}
      <SubmitConfirmDialog
        open={showConfirmDialog}
        onClose={handleCloseConfirmDialog}
        onConfirm={handleSubmit}
        hasUnanswered={hasUnanswered}
        unansweredCount={unansweredCount}
        isSubmitting={isSubmitting}
      />
    </Box>
  );
}
