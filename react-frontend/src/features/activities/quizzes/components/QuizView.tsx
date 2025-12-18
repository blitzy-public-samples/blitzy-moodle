/**
 * QuizView Component
 *
 * Quiz overview component displaying quiz information, instructions, access
 * restrictions, previous attempts, and action buttons (start attempt, continue
 * attempt, view results). Entry point for students accessing a quiz activity
 * with comprehensive quiz metadata and attempt history.
 *
 * Features:
 * - Quiz header with name, description, and image using MUI Card
 * - Quiz metadata table (time limit, attempts allowed, grading method, dates)
 * - Quiz instructions display using Alert/Paper component
 * - Access restrictions (password, IP) with appropriate warnings
 * - Previous attempts table with attempt number, state, marks, grade, review link
 * - Best attempt highlighting when grading method is "highest grade"
 * - Current grade summary using emphasized typography
 * - "Start attempt" button with enabling logic based on quiz rules
 * - "Continue attempt" button if unfinished attempt exists
 * - "Preview quiz" button for teachers/admins
 * - Attempt state badges (In progress, Finished, Abandoned) using MUI Chip
 * - Countdown timer if quiz has opening date in future
 * - Closing date warning if quiz is closing soon
 * - Grade feedback based on achieved grade percentage
 * - "Review attempt" links for completed attempts
 * - React Query for data fetching
 * - Different UI for user roles (student, teacher, admin)
 * - Loading state with MUI Skeleton
 * - Error states with retry options
 * - Quiz settings accordion for detailed information
 * - Responsive layout for mobile devices
 *
 * Reference: public/mod/quiz/view.php for backend implementation
 *
 * @package    react-frontend/features/activities/quizzes
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Link,
  Skeleton,
  Stack,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ExpandMore,
  PlayArrow,
  Replay,
  Preview,
  CheckCircle,
  HourglassEmpty,
  Cancel,
  Warning,
  AccessTime,
  Assessment,
  Timer,
} from '@mui/icons-material';

// Internal imports from quiz feature
import type { Quiz } from '../types/quiz.types';
import { GradeMethod, QuizNavMethod } from '../types/quiz.types';
import { useQuiz } from '../hooks/useQuiz';
import useQuizAttempt from '../hooks/useQuizAttempt';

// Shared types (QuizAttempt from entities to match hook return types)
import type { QuizAttempt } from '@/types/entities';

// Shared components
import Card from '@/components/data-display/Card';
import { Alert } from '@/components/feedback/Alert';

// Utility functions
import { formatDuration } from '@/utils/date';
import { formatNumber } from '@/utils/formatters';

// Permission hook
import { usePermissions } from '@/hooks/usePermissions';

// ============================================================================
// Constants for Attempt States (matching backend strings)
// ============================================================================
const ATTEMPT_STATE = {
  IN_PROGRESS: 'inprogress' as const,
  OVERDUE: 'overdue' as const,
  FINISHED: 'finished' as const,
  ABANDONED: 'abandoned' as const,
};

// Type alias for attempt state values (matching entities.ts)
type AttemptState = 'inprogress' | 'overdue' | 'finished' | 'abandoned';

// ============================================================================
// Component Interfaces
// ============================================================================

/**
 * Props for the QuizView component
 *
 * The component can receive quizId as a prop or extract it from URL params.
 */
export interface QuizViewProps {
  /** Optional quiz ID (if not provided, extracted from URL params) */
  quizId?: number;
  /** Optional callback when attempt is started */
  onAttemptStart?: (attemptId: number) => void;
  /** Optional callback when user navigates to review */
  onReviewClick?: (attemptId: number) => void;
}

/**
 * Interface for formatted attempt data displayed in table
 */
interface FormattedAttemptRow {
  id: number;
  attemptNumber: number;
  state: AttemptState;
  stateLabel: string;
  timeStarted: string;
  timeFinished: string | null;
  sumGrades: number | null;
  grade: number | null;
  gradePercentage: number | null;
  isBestAttempt: boolean;
  canReview: boolean;
}

/**
 * Interface for quiz metadata items
 */
interface QuizMetadataItem {
  label: string;
  value: string | React.ReactNode;
  icon?: React.ReactNode;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the display label for an attempt state
 */
function getAttemptStateLabel(state: AttemptState): string {
  switch (state) {
    case ATTEMPT_STATE.IN_PROGRESS:
      return 'In progress';
    case ATTEMPT_STATE.FINISHED:
      return 'Finished';
    case ATTEMPT_STATE.OVERDUE:
      return 'Overdue';
    case ATTEMPT_STATE.ABANDONED:
      return 'Abandoned';
    default:
      return 'Unknown';
  }
}

/**
 * Get the chip color variant for an attempt state
 */
function getAttemptStateColor(
  state: AttemptState
): 'success' | 'warning' | 'error' | 'info' | 'default' {
  switch (state) {
    case ATTEMPT_STATE.FINISHED:
      return 'success';
    case ATTEMPT_STATE.IN_PROGRESS:
      return 'info';
    case ATTEMPT_STATE.OVERDUE:
      return 'warning';
    case ATTEMPT_STATE.ABANDONED:
      return 'error';
    default:
      return 'default';
  }
}

/**
 * Get the icon for an attempt state
 */
function getAttemptStateIcon(state: AttemptState): React.ReactNode {
  switch (state) {
    case ATTEMPT_STATE.FINISHED:
      return <CheckCircle fontSize="small" />;
    case ATTEMPT_STATE.IN_PROGRESS:
      return <HourglassEmpty fontSize="small" />;
    case ATTEMPT_STATE.OVERDUE:
      return <Warning fontSize="small" />;
    case ATTEMPT_STATE.ABANDONED:
      return <Cancel fontSize="small" />;
    default:
      return null;
  }
}

/**
 * Get the grading method display name
 */
function getGradingMethodName(method: GradeMethod): string {
  switch (method) {
    case GradeMethod.HIGHEST:
      return 'Highest grade';
    case GradeMethod.AVERAGE:
      return 'Average grade';
    case GradeMethod.FIRST:
      return 'First attempt';
    case GradeMethod.LAST:
      return 'Last attempt';
    default:
      return String(method);
  }
}

/**
 * Format a date for display
 */
function formatDateDisplay(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return 'Not set';
  }
  return new Date(timestamp * 1000).toLocaleString();
}

/**
 * Calculate time remaining until a date
 */
function getTimeRemaining(timestamp: number): string {
  const now = Date.now();
  const target = timestamp * 1000;
  const diff = target - now;

  if (diff <= 0) {
    return 'now';
  }

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  return `${seconds} second${seconds > 1 ? 's' : ''}`;
}

/**
 * Check if quiz is closing soon (within 24 hours)
 */
function isClosingSoon(timeClose: number | null | undefined): boolean {
  if (!timeClose) {
    return false;
  }
  const now = Date.now();
  const closeTime = timeClose * 1000;
  const hoursRemaining = (closeTime - now) / (1000 * 60 * 60);
  return hoursRemaining > 0 && hoursRemaining <= 24;
}

/**
 * Get grade feedback message based on percentage
 */
function getGradeFeedback(percentage: number): { message: string; severity: 'success' | 'info' | 'warning' | 'error' } {
  if (percentage >= 90) {
    return { message: 'Excellent work! You have achieved an outstanding grade.', severity: 'success' };
  }
  if (percentage >= 70) {
    return { message: 'Good job! You have achieved a passing grade.', severity: 'success' };
  }
  if (percentage >= 50) {
    return { message: 'You have passed. Consider reviewing areas where you lost marks.', severity: 'info' };
  }
  return { message: 'You did not pass. Please review the material and try again if attempts remain.', severity: 'warning' };
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Loading skeleton for the quiz view
 */
function QuizViewSkeleton(): React.ReactElement {
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Header skeleton */}
      <Skeleton variant="rectangular" height={200} sx={{ mb: 3, borderRadius: 2 }} />
      
      {/* Metadata skeleton */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Skeleton variant="text" width="30%" height={32} sx={{ mb: 2 }} />
        <Stack spacing={1}>
          {[1, 2, 3, 4].map((i) => (
            <Box key={i} display="flex" justifyContent="space-between">
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="30%" />
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* Instructions skeleton */}
      <Skeleton variant="rectangular" height={80} sx={{ mb: 3, borderRadius: 1 }} />

      {/* Table skeleton */}
      <Paper sx={{ p: 2 }}>
        <Skeleton variant="text" width="20%" height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={150} />
      </Paper>

      {/* Button skeleton */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <Skeleton variant="rectangular" width={180} height={42} sx={{ borderRadius: 1 }} />
      </Box>
    </Box>
  );
}

/**
 * Quiz header card component
 */
interface QuizHeaderProps {
  quiz: Quiz;
}

function QuizHeader({ quiz }: QuizHeaderProps): React.ReactElement {
  return (
    <Card
      title={quiz.name}
      subtitle={`Course ID: ${quiz.course}`}
    >
      {quiz.intro && (
        <Box sx={{ mt: 2 }}>
          <Typography
            variant="body1"
            color="text.secondary"
            dangerouslySetInnerHTML={{ __html: quiz.intro }}
          />
        </Box>
      )}
    </Card>
  );
}

/**
 * Quiz metadata table component
 */
interface QuizMetadataProps {
  quiz: Quiz;
  attempts: QuizAttempt[];
}

function QuizMetadata({ quiz, attempts }: QuizMetadataProps): React.ReactElement {
  const metadataItems: QuizMetadataItem[] = useMemo(() => {
    const items: QuizMetadataItem[] = [];

    // Time limit
    if (quiz.timelimit && quiz.timelimit > 0) {
      items.push({
        label: 'Time limit',
        value: formatDuration(quiz.timelimit),
        icon: <Timer fontSize="small" />,
      });
    }

    // Attempts allowed
    items.push({
      label: 'Attempts allowed',
      value: quiz.attempts === 0 ? 'Unlimited' : String(quiz.attempts),
      icon: <Replay fontSize="small" />,
    });

    // Attempts used
    const finishedAttempts = attempts.filter((a) => a.state === ATTEMPT_STATE.FINISHED).length;
    items.push({
      label: 'Attempts used',
      value: `${finishedAttempts}${quiz.attempts > 0 ? ` / ${quiz.attempts}` : ''}`,
    });

    // Grading method
    if (quiz.grademethod) {
      items.push({
        label: 'Grading method',
        value: getGradingMethodName(quiz.grademethod),
        icon: <Assessment fontSize="small" />,
      });
    }

    // Open date
    if (quiz.timeopen) {
      items.push({
        label: 'Opens',
        value: formatDateDisplay(quiz.timeopen),
        icon: <AccessTime fontSize="small" />,
      });
    }

    // Close date
    if (quiz.timeclose) {
      items.push({
        label: 'Closes',
        value: formatDateDisplay(quiz.timeclose),
        icon: <AccessTime fontSize="small" />,
      });
    }

    return items;
  }, [quiz, attempts]);

  return (
    <TableContainer component={Paper} sx={{ mb: 3 }}>
      <Table size="small">
        <TableBody>
          {metadataItems.map((item) => (
            <TableRow key={item.label}>
              <TableCell sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {item.icon}
                <Typography variant="body2" fontWeight="medium">
                  {item.label}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2">{item.value}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/**
 * Access restrictions warnings component
 * Shows warnings about password protection, subnet restrictions, etc.
 */
interface AccessRestrictionsProps {
  quiz: Quiz;
}

function AccessRestrictions({ quiz }: AccessRestrictionsProps): React.ReactElement | null {
  const restrictions: string[] = [];
  
  // Check for password protection
  if (quiz.password) {
    restrictions.push('This quiz requires a password to access.');
  }
  
  // Check for subnet/IP restrictions
  if (quiz.subnet) {
    restrictions.push('This quiz can only be accessed from specific network locations.');
  }
  
  // Check for browser security
  if (quiz.browsersecurity && quiz.browsersecurity !== 'none') {
    restrictions.push('This quiz requires specific browser security settings.');
  }
  
  if (restrictions.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      {restrictions.map((reason: string, index: number) => (
        <Alert
          key={index}
          severity="warning"
          title="Access Restriction"
          message={reason}
          sx={{ mb: 1 }}
        />
      ))}
    </Box>
  );
}

/**
 * Previous attempts table component
 */
interface AttemptsTableProps {
  attempts: QuizAttempt[];
  quiz: Quiz;
  bestAttemptId: number | null;
  onReviewClick: (attemptId: number) => void;
  onContinueClick: (attemptId: number) => void;
}

function AttemptsTable({
  attempts,
  quiz,
  bestAttemptId,
  onReviewClick,
  onContinueClick,
}: AttemptsTableProps): React.ReactElement | null {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (attempts.length === 0) {
    return null;
  }

  // Format attempts for display
  const formattedAttempts: FormattedAttemptRow[] = attempts.map((attempt, index) => {
    // Convert undefined to null for sumgrades
    const sumGrades = attempt.sumgrades ?? null;
    
    const gradePercentage =
      sumGrades !== null && quiz.sumgrades && quiz.sumgrades > 0
        ? (sumGrades / quiz.sumgrades) * 100
        : null;

    // Calculate grade from sumgrades
    const calculatedGrade =
      sumGrades !== null && quiz.sumgrades && quiz.sumgrades > 0
        ? (sumGrades / quiz.sumgrades) * quiz.grade
        : null;

    return {
      id: attempt.id,
      attemptNumber: index + 1,
      state: attempt.state as AttemptState,
      stateLabel: getAttemptStateLabel(attempt.state as AttemptState),
      timeStarted: formatDateDisplay(attempt.timestart),
      timeFinished: attempt.timefinish ? formatDateDisplay(attempt.timefinish) : null,
      sumGrades,
      grade: calculatedGrade,
      gradePercentage,
      isBestAttempt: attempt.id === bestAttemptId && quiz.grademethod === GradeMethod.HIGHEST,
      canReview: attempt.state === ATTEMPT_STATE.FINISHED,
    };
  });

  return (
    <Paper sx={{ mb: 3 }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">Your previous attempts</Typography>
      </Box>
      <TableContainer>
        <Table size={isMobile ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              <TableCell>Attempt</TableCell>
              <TableCell>State</TableCell>
              {!isMobile && <TableCell>Started</TableCell>}
              {!isMobile && <TableCell>Completed</TableCell>}
              <TableCell align="right">Marks</TableCell>
              <TableCell align="right">Grade</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {formattedAttempts.map((row) => (
              <TableRow
                key={row.id}
                sx={{
                  backgroundColor: row.isBestAttempt
                    ? theme.palette.mode === 'dark'
                      ? 'rgba(76, 175, 80, 0.1)'
                      : 'rgba(76, 175, 80, 0.08)'
                    : undefined,
                }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">
                      {row.attemptNumber}
                    </Typography>
                    {row.isBestAttempt && (
                      <Chip
                        label="Best"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    icon={getAttemptStateIcon(row.state) as React.ReactElement}
                    label={row.stateLabel}
                    size="small"
                    color={getAttemptStateColor(row.state)}
                    variant="filled"
                  />
                </TableCell>
                {!isMobile && <TableCell>{row.timeStarted}</TableCell>}
                {!isMobile && <TableCell>{row.timeFinished || '-'}</TableCell>}
                <TableCell align="right">
                  {row.sumGrades !== null ? (
                    <Typography variant="body2">
                      {formatNumber(row.sumGrades, 2)} / {formatNumber(quiz.sumgrades || 0, 2)}
                    </Typography>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell align="right">
                  {row.grade !== null ? (
                    <Typography variant="body2" fontWeight="medium">
                      {formatNumber(row.grade, 2)}%
                    </Typography>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell align="center">
                  {row.state === ATTEMPT_STATE.IN_PROGRESS ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onContinueClick(row.id)}
                    >
                      Continue
                    </Button>
                  ) : row.canReview ? (
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => onReviewClick(row.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      Review
                    </Link>
                  ) : (
                    '-'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

/**
 * Grade summary component
 */
interface GradeSummaryProps {
  currentGrade: number | null;
  maxGrade: number;
  gradeMethod: GradeMethod;
}

function GradeSummary({ currentGrade, maxGrade, gradeMethod }: GradeSummaryProps): React.ReactElement | null {
  if (currentGrade === null) {
    return null;
  }

  const percentage = maxGrade > 0 ? (currentGrade / maxGrade) * 100 : 0;
  const feedback = getGradeFeedback(percentage);

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Your current grade
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2 }}>
        <Typography variant="h3" color="primary" fontWeight="bold">
          {formatNumber(currentGrade, 2)}
        </Typography>
        <Typography variant="h5" color="text.secondary">
          / {formatNumber(maxGrade, 2)}
        </Typography>
        <Chip
          label={`${formatNumber(percentage, 1)}%`}
          color={percentage >= 50 ? 'success' : 'error'}
          variant="filled"
          sx={{ ml: 2 }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Grade calculated using: {getGradingMethodName(gradeMethod)}
      </Typography>
      <Alert severity={feedback.severity} message={feedback.message} />
    </Paper>
  );
}

/**
 * Quiz settings accordion component
 */
interface QuizSettingsAccordionProps {
  quiz: Quiz;
}

function QuizSettingsAccordion({ quiz }: QuizSettingsAccordionProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <Accordion
      expanded={expanded}
      onChange={() => setExpanded(!expanded)}
      sx={{ mb: 3 }}
    >
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Typography variant="subtitle1">Quiz settings and information</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Question behavior
            </Typography>
            <Typography variant="body2">
              {quiz.preferredbehaviour || 'Deferred feedback'}
            </Typography>
          </Box>

          {quiz.shuffleanswers !== undefined && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Shuffle answers
              </Typography>
              <Typography variant="body2">
                {quiz.shuffleanswers ? 'Yes' : 'No'}
              </Typography>
            </Box>
          )}

          {quiz.questionsperpage !== undefined && quiz.questionsperpage > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Questions per page
              </Typography>
              <Typography variant="body2">
                {quiz.questionsperpage}
              </Typography>
            </Box>
          )}

          {quiz.navmethod && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Navigation method
              </Typography>
              <Typography variant="body2">
                {quiz.navmethod === QuizNavMethod.FREE ? 'Free navigation' : 'Sequential'}
              </Typography>
            </Box>
          )}

          {quiz.browsersecurity && quiz.browsersecurity !== 'none' && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Browser security
              </Typography>
              <Typography variant="body2">
                {quiz.browsersecurity === 'securewindow'
                  ? 'Full screen popup with some JavaScript security'
                  : quiz.browsersecurity}
              </Typography>
            </Box>
          )}

          {quiz.overduehandling && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Overdue handling
              </Typography>
              <Typography variant="body2">
                {quiz.overduehandling === 'autosubmit'
                  ? 'Auto-submit'
                  : quiz.overduehandling === 'graceperiod'
                  ? 'Grace period'
                  : 'Auto-abandon'}
              </Typography>
            </Box>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

/**
 * Countdown timer component for quiz opening
 */
interface CountdownTimerProps {
  targetTime: number;
  onExpire?: () => void;
}

function CountdownTimer({ targetTime, onExpire }: CountdownTimerProps): React.ReactElement {
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining(targetTime));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeRemaining(targetTime);
      setTimeRemaining(remaining);

      if (remaining === 'now' && onExpire) {
        onExpire();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime, onExpire]);

  return (
    <Alert 
      severity="info" 
      title="Quiz not yet available"
      message={`This quiz will open in ${timeRemaining}. Opens at: ${formatDateDisplay(targetTime)}`}
    />
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * QuizView Component
 *
 * Main quiz overview component that displays comprehensive quiz information
 * and provides actions for starting or continuing quiz attempts.
 */
export function QuizView({
  quizId: propQuizId,
  onAttemptStart,
  onReviewClick: propOnReviewClick,
}: QuizViewProps): React.ReactElement {
  // ============================================================================
  // Hooks and State
  // ============================================================================

  const navigate = useNavigate();
  const params = useParams<{ quizId: string }>();
  const { hasCapability: _hasCapability, isTeacher, isAdmin } = usePermissions();

  // Determine quiz ID from props or URL params
  const quizId = propQuizId ?? (params.quizId ? parseInt(params.quizId, 10) : undefined);

  // Fetch quiz data - pass 0 when undefined to satisfy hook's required parameter
  const {
    quiz,
    isLoading: quizLoading,
    error: quizError,
    refetch: refetchQuiz,
  } = useQuiz(quizId ?? 0);

  // Quiz attempt management - pass options object with quizId
  const {
    currentAttempt: _currentAttempt,
    attempts,
    startAttempt,
    isSubmitting,
    isLoading: _attemptsLoading, // Prefixed since we use quizLoading as main indicator
  } = useQuizAttempt({ quizId: quizId ?? 0 });

  // Local state
  const [isStartingAttempt, setIsStartingAttempt] = useState(false);

  // ============================================================================
  // Computed Values
  // ============================================================================

  // Find in-progress attempt
  const inProgressAttempt = useMemo(() => {
    return attempts.find((a: QuizAttempt) => a.state === ATTEMPT_STATE.IN_PROGRESS);
  }, [attempts]);

  // Helper function to get grade from attempt (calculate from sumgrades if needed)
  const getAttemptGrade = useCallback((attempt: QuizAttempt): number | null => {
    // Check for undefined or null sumgrades
    if (attempt.sumgrades == null || !quiz?.sumgrades || quiz.sumgrades === 0) {
      return null;
    }
    return (attempt.sumgrades / quiz.sumgrades) * quiz.grade;
  }, [quiz]);

  // Find best attempt (highest grade)
  const bestAttemptId = useMemo(() => {
    if (!quiz || quiz.grademethod !== GradeMethod.HIGHEST || attempts.length === 0) {
      return null;
    }

    const finishedAttempts = attempts.filter(
      (a: QuizAttempt) => a.state === ATTEMPT_STATE.FINISHED && a.sumgrades != null
    );

    if (finishedAttempts.length === 0) {
      return null;
    }

    return finishedAttempts.reduce((best: QuizAttempt, current: QuizAttempt) => {
      const bestGrade = getAttemptGrade(best) ?? 0;
      const currentGrade = getAttemptGrade(current) ?? 0;
      return currentGrade > bestGrade ? current : best;
    }).id;
  }, [quiz, attempts, getAttemptGrade]);

  // Calculate current grade based on grading method
  const currentGrade = useMemo((): number | null => {
    if (!quiz || attempts.length === 0) {
      return null;
    }

    const finishedAttemptsForGrade = attempts.filter(
      (a: QuizAttempt) => a.state === ATTEMPT_STATE.FINISHED && a.sumgrades != null
    );

    if (finishedAttemptsForGrade.length === 0) {
      return null;
    }

    const grades = finishedAttemptsForGrade.map((a: QuizAttempt) => getAttemptGrade(a) ?? 0);

    switch (quiz.grademethod) {
      case GradeMethod.HIGHEST:
        return Math.max(...grades);
      case GradeMethod.AVERAGE: {
        const sum = grades.reduce((acc: number, g: number) => acc + g, 0);
        return sum / grades.length;
      }
      case GradeMethod.FIRST:
        return grades[0] ?? null;
      case GradeMethod.LAST:
        return grades[grades.length - 1] ?? null;
      default:
        return null;
    }
  }, [quiz, attempts, getAttemptGrade]);

  // Check if user can start a new attempt
  const canStartAttempt = useMemo(() => {
    if (!quiz) {
      return false;
    }

    // Check if quiz is open
    const now = Date.now() / 1000;
    if (quiz.timeopen && now < quiz.timeopen) {
      return false;
    }
    if (quiz.timeclose && now > quiz.timeclose) {
      return false;
    }

    // Check attempts limit (quiz.attempts is max allowed, 0 = unlimited)
    const finishedCount = attempts.filter((a: QuizAttempt) => a.state === ATTEMPT_STATE.FINISHED).length;
    if (quiz.attempts > 0 && finishedCount >= quiz.attempts) {
      return false;
    }

    // Check for in-progress attempt
    if (inProgressAttempt) {
      return false;
    }

    return true;
  }, [quiz, attempts, inProgressAttempt]);

  // Check if quiz is not yet open
  const quizNotYetOpen = useMemo(() => {
    if (!quiz?.timeopen) {
      return false;
    }
    const now = Date.now() / 1000;
    return now < quiz.timeopen;
  }, [quiz]);

  // Check if quiz is closed
  const quizClosed = useMemo(() => {
    if (!quiz?.timeclose) {
      return false;
    }
    const now = Date.now() / 1000;
    return now > quiz.timeclose;
  }, [quiz]);

  // Check if user can preview (teacher/admin)
  const canPreview = useMemo(() => {
    return isTeacher || isAdmin;
  }, [isTeacher, isAdmin]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle starting a new attempt
   */
  const handleStartAttempt = useCallback(async () => {
    if (!quizId || !canStartAttempt) {
      return;
    }

    try {
      setIsStartingAttempt(true);
      const result = await startAttempt();

      if (result?.id) {
        if (onAttemptStart) {
          onAttemptStart(result.id);
        } else {
          navigate(`/mod/quiz/attempt/${result.id}`);
        }
      }
    } catch (error) {
      console.error('Failed to start quiz attempt:', error);
    } finally {
      setIsStartingAttempt(false);
    }
  }, [quizId, canStartAttempt, startAttempt, onAttemptStart, navigate]);

  /**
   * Handle continuing an in-progress attempt
   */
  const handleContinueAttempt = useCallback(
    (attemptId: number) => {
      navigate(`/mod/quiz/attempt/${attemptId}`);
    },
    [navigate]
  );

  /**
   * Handle reviewing a completed attempt
   */
  const handleReviewClick = useCallback(
    (attemptId: number) => {
      if (propOnReviewClick) {
        propOnReviewClick(attemptId);
      } else {
        navigate(`/mod/quiz/review/${attemptId}`);
      }
    },
    [propOnReviewClick, navigate]
  );

  /**
   * Handle preview quiz (for teachers)
   */
  const handlePreviewQuiz = useCallback(() => {
    if (quizId) {
      navigate(`/mod/quiz/attempt?preview=1&quizid=${quizId}`);
    }
  }, [quizId, navigate]);

  /**
   * Handle countdown expiration
   */
  const handleCountdownExpire = useCallback(() => {
    refetchQuiz();
  }, [refetchQuiz]);

  // ============================================================================
  // Render States
  // ============================================================================

  // Loading state
  if (quizLoading) {
    return <QuizViewSkeleton />;
  }

  // Error state
  if (quizError || !quiz) {
    const errorMessage = quizError instanceof Error
      ? quizError.message
      : 'Unable to load quiz information. Please try again.';
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
        <Alert
          severity="error"
          title="Error loading quiz"
          message={errorMessage}
          action={
            <Button onClick={() => refetchQuiz()} size="small">
              Retry
            </Button>
          }
        />
      </Box>
    );
  }

  // Invalid quiz ID
  if (!quizId) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
        <Alert 
          severity="error" 
          title="Invalid quiz"
          message="No quiz ID provided. Please navigate to this page from a valid quiz link."
        />
      </Box>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Quiz Header */}
      <Box sx={{ mb: 3 }}>
        <QuizHeader quiz={quiz} />
      </Box>

      {/* Quiz not yet open countdown */}
      {quizNotYetOpen && quiz.timeopen && (
        <Box sx={{ mb: 3 }}>
          <CountdownTimer
            targetTime={quiz.timeopen}
            onExpire={handleCountdownExpire}
          />
        </Box>
      )}

      {/* Quiz closed warning */}
      {quizClosed && quiz.timeclose && (
        <Box sx={{ mb: 3 }}>
          <Alert 
            severity="error" 
            title="Quiz closed"
            message={`This quiz closed on ${formatDateDisplay(quiz.timeclose)}. No more attempts can be made.`}
          />
        </Box>
      )}

      {/* Closing soon warning */}
      {!quizClosed && quiz.timeclose && isClosingSoon(quiz.timeclose) && (
        <Box sx={{ mb: 3 }}>
          <Alert 
            severity="warning" 
            title="Quiz closing soon"
            message={`This quiz will close in ${getTimeRemaining(quiz.timeclose)}. Make sure to submit your attempt before the deadline.`}
          />
        </Box>
      )}

      {/* Access restrictions */}
      <AccessRestrictions quiz={quiz} />

      {/* Quiz instructions */}
      {quiz.intro && (
        <Box sx={{ mb: 3 }}>
          <Alert 
            severity="info" 
            title="Instructions"
            message={quiz.intro}
          />
        </Box>
      )}

      {/* Quiz metadata */}
      <QuizMetadata quiz={quiz} attempts={attempts} />

      {/* Quiz settings accordion */}
      <QuizSettingsAccordion quiz={quiz} />

      {/* Grade summary */}
      {currentGrade !== null && quiz.sumgrades && (
        <GradeSummary
          currentGrade={currentGrade}
          maxGrade={quiz.sumgrades}
          gradeMethod={quiz.grademethod}
        />
      )}

      {/* Previous attempts table */}
      <AttemptsTable
        attempts={attempts}
        quiz={quiz}
        bestAttemptId={bestAttemptId}
        onReviewClick={handleReviewClick}
        onContinueClick={handleContinueAttempt}
      />

      {/* Action buttons */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'center',
          gap: 2,
          mt: 4,
        }}
      >
        {/* Continue attempt button */}
        {inProgressAttempt && (
          <Button
            variant="contained"
            color="warning"
            size="large"
            startIcon={<Replay />}
            onClick={() => handleContinueAttempt(inProgressAttempt.id)}
          >
            Continue your attempt
          </Button>
        )}

        {/* Start attempt button */}
        {!inProgressAttempt && canStartAttempt && (
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<PlayArrow />}
            onClick={handleStartAttempt}
            disabled={isStartingAttempt || isSubmitting}
          >
            {isStartingAttempt ? 'Starting...' : 'Attempt quiz now'}
          </Button>
        )}

        {/* Preview button (for teachers/admins) */}
        {canPreview && (
          <Button
            variant="outlined"
            color="secondary"
            size="large"
            startIcon={<Preview />}
            onClick={handlePreviewQuiz}
          >
            Preview quiz
          </Button>
        )}
      </Box>

      {/* Attempts exhausted message */}
      {!canStartAttempt &&
        !inProgressAttempt &&
        !quizNotYetOpen &&
        !quizClosed &&
        quiz.attempts > 0 && (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Alert 
              severity="info"
              message={`You have used all ${quiz.attempts} allowed attempts for this quiz.`}
            />
          </Box>
        )}

      {/* No attempts yet message */}
      {attempts.length === 0 && !quizNotYetOpen && !quizClosed && canStartAttempt && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            You have not attempted this quiz yet. Click the button above to begin.
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default QuizView;
