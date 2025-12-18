/**
 * QuizTimer Component
 *
 * Timer component for timed quizzes that displays remaining time, syncs with server,
 * and triggers auto-submission when time expires. Implements countdown with visual
 * feedback, warnings for low time, and automatic background synchronization.
 *
 * This component mirrors the timer functionality from Moodle's quiz attempt system:
 * - Timer display mirrors the quiz timer JavaScript in attempt.php
 * - Visual warnings at configurable thresholds (default 5 min warning, 1 min critical)
 * - Auto-submission trigger when time expires
 * - Server synchronization to prevent client-side drift
 *
 * Features:
 * - Real-time countdown display in HH:MM:SS format
 * - Visual progress bar showing time elapsed/remaining
 * - Color-coded warnings (yellow at warning threshold, red at critical threshold)
 * - Auto-submission callback when time expires
 * - Performance optimized with React.memo
 * - Accessible with proper ARIA attributes
 *
 * @module features/activities/quizzes/components/QuizTimer
 * @see public/mod/quiz/attempt.php - PHP quiz attempt page with timer
 * @see react-frontend/src/features/activities/quizzes/hooks/useQuizTimer.ts - Timer logic hook
 */

import { memo, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Paper,
  useTheme,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

import { useQuizTimer } from '../hooks/useQuizTimer';
import { Alert } from '../../../../components/feedback/Alert';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Props interface for the QuizTimer component
 *
 * Defines all configurable properties for the quiz timer including
 * time limits, thresholds, and callback functions.
 */
export interface QuizTimerProps {
  /**
   * The ID of the quiz attempt being timed
   * Used for server synchronization and auto-save operations
   */
  attemptId: number;

  /**
   * Total time limit for the quiz attempt in seconds
   * Set to 0 for no time limit (unlimited time)
   */
  timeLimit: number;

  /**
   * Unix timestamp (in seconds) when the attempt started
   * Used to calculate elapsed time and remaining time
   */
  timeStart: number;

  /**
   * Callback function invoked when time expires
   * Should trigger auto-submission of the quiz
   */
  onTimeExpired: () => void;

  /**
   * Time threshold in seconds for showing warning state (yellow)
   * @default 300 (5 minutes)
   */
  warningThreshold?: number;

  /**
   * Time threshold in seconds for showing critical state (red)
   * @default 60 (1 minute)
   */
  criticalThreshold?: number;
}

/**
 * Internal state for timer display styling
 */
type TimerDisplayState = 'normal' | 'warning' | 'critical' | 'expired';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine the current display state based on time remaining
 *
 * @param timeRemaining - Seconds remaining (null if no time limit)
 * @param warningThreshold - Threshold for warning state in seconds
 * @param criticalThreshold - Threshold for critical state in seconds
 * @param isExpired - Whether the timer has expired
 * @returns The current display state for styling
 */
function getDisplayState(
  timeRemaining: number | null,
  warningThreshold: number,
  criticalThreshold: number,
  isExpired: boolean
): TimerDisplayState {
  if (isExpired || timeRemaining === 0) {
    return 'expired';
  }

  if (timeRemaining === null) {
    return 'normal';
  }

  if (timeRemaining <= criticalThreshold) {
    return 'critical';
  }

  if (timeRemaining <= warningThreshold) {
    return 'warning';
  }

  return 'normal';
}

/**
 * Get the progress bar color based on display state
 *
 * @param state - Current display state
 * @returns MUI color value for the progress bar
 */
function getProgressColor(
  state: TimerDisplayState
): 'primary' | 'warning' | 'error' | 'inherit' {
  switch (state) {
    case 'critical':
    case 'expired':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'primary';
  }
}

/**
 * Get accessibility label for the timer
 *
 * @param formattedTime - Formatted time string (HH:MM:SS)
 * @param state - Current display state
 * @returns Accessible label describing the timer state
 */
function getAriaLabel(
  formattedTime: string,
  state: TimerDisplayState
): string {
  switch (state) {
    case 'expired':
      return 'Time has expired. Quiz will be submitted automatically.';
    case 'critical':
      return `Critical warning: Less than 1 minute remaining. Time remaining: ${formattedTime}`;
    case 'warning':
      return `Warning: Less than 5 minutes remaining. Time remaining: ${formattedTime}`;
    default:
      return `Time remaining: ${formattedTime}`;
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Timer display sub-component showing the formatted time
 */
interface TimerDisplayProps {
  formattedTime: string;
  state: TimerDisplayState;
}

function TimerDisplay({ formattedTime, state }: TimerDisplayProps): JSX.Element {
  const theme = useTheme();

  // Determine text color based on state
  const getTextColor = (): string => {
    switch (state) {
      case 'expired':
      case 'critical':
        return theme.palette.error.main;
      case 'warning':
        return theme.palette.warning.main;
      default:
        return theme.palette.text.primary;
    }
  };

  // Determine icon based on state
  const getIcon = (): JSX.Element => {
    switch (state) {
      case 'expired':
      case 'critical':
        return <ErrorIcon sx={{ fontSize: 24, color: theme.palette.error.main }} />;
      case 'warning':
        return <WarningIcon sx={{ fontSize: 24, color: theme.palette.warning.main }} />;
      default:
        return <AccessTimeIcon sx={{ fontSize: 24, color: theme.palette.primary.main }} />;
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      {getIcon()}
      <Typography
        variant="h5"
        component="span"
        sx={{
          fontFamily: 'monospace',
          fontWeight: 'bold',
          color: getTextColor(),
          fontSize: { xs: '1.25rem', sm: '1.5rem' },
        }}
        aria-hidden="true"
      >
        {formattedTime}
      </Typography>
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * QuizTimer - Timer component for timed quiz attempts
 *
 * Displays a countdown timer with visual feedback for timed quizzes.
 * Shows warnings when time is running low and triggers auto-submission
 * when time expires. Uses the useQuizTimer hook for timer logic and
 * server synchronization.
 *
 * @param props - Component props
 * @returns JSX element rendering the quiz timer
 *
 * @example
 * ```tsx
 * <QuizTimer
 *   attemptId={123}
 *   timeLimit={3600}
 *   timeStart={1699900000}
 *   onTimeExpired={() => handleSubmit()}
 *   warningThreshold={300}
 *   criticalThreshold={60}
 * />
 * ```
 */
function QuizTimerComponent({
  attemptId,
  timeLimit,
  timeStart,
  onTimeExpired,
  warningThreshold = 300, // 5 minutes default
  criticalThreshold = 60, // 1 minute default
}: QuizTimerProps): JSX.Element | null {
  const theme = useTheme();

  // Callback for time warning events
  const handleTimeWarning = useCallback(
    (remaining: number) => {
      // Log warning for debugging purposes
      if (process.env.NODE_ENV === 'development') {
        console.log(`Quiz timer warning: ${remaining} seconds remaining`);
      }
    },
    []
  );

  // Callback for time expiration
  const handleTimeExpired = useCallback(() => {
    // Trigger the parent's onTimeExpired callback
    onTimeExpired();
  }, [onTimeExpired]);

  // Initialize the quiz timer hook
  const {
    timeRemaining,
    formattedTime,
    isExpired,
    isPaused,
    percentage,
  } = useQuizTimer(attemptId, {
    timeLimit,
    timeStart,
    autoSaveInterval: 60, // Auto-save every 60 seconds
    onTimeWarning: handleTimeWarning,
    onTimeExpired: handleTimeExpired,
    warningThreshold,
    enabled: timeLimit > 0,
  });

  // Determine current display state
  const displayState = getDisplayState(
    timeRemaining,
    warningThreshold,
    criticalThreshold,
    isExpired
  );

  // Get progress bar color
  const progressColor = getProgressColor(displayState);

  // Get accessibility label
  const ariaLabel = getAriaLabel(formattedTime, displayState);

  // Handle expiration side effect
  useEffect(() => {
    if (isExpired && onTimeExpired) {
      // Timer has expired, trigger auto-submission
      // Note: The hook already calls onTimeExpired, but we add this
      // as a safety net in case the hook's callback wasn't triggered
      onTimeExpired();
    }
  }, [isExpired, onTimeExpired]);

  // Don't render if there's no time limit
  if (timeLimit <= 0 || timeRemaining === null) {
    return null;
  }

  return (
    <Paper
      elevation={2}
      sx={{
        padding: 2,
        borderRadius: 2,
        backgroundColor:
          displayState === 'critical' || displayState === 'expired'
            ? theme.palette.error.light + '20'
            : displayState === 'warning'
            ? theme.palette.warning.light + '20'
            : theme.palette.background.paper,
        border: `1px solid ${
          displayState === 'critical' || displayState === 'expired'
            ? theme.palette.error.main
            : displayState === 'warning'
            ? theme.palette.warning.main
            : theme.palette.divider
        }`,
        transition: 'all 0.3s ease-in-out',
      }}
      role="timer"
      aria-label={ariaLabel}
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Timer Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 1.5,
        }}
      >
        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{ fontWeight: 500 }}
        >
          Time Remaining
        </Typography>
        {isPaused && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              backgroundColor: theme.palette.action.disabledBackground,
              padding: '2px 8px',
              borderRadius: 1,
            }}
          >
            Paused
          </Typography>
        )}
      </Box>

      {/* Timer Display */}
      <Box sx={{ marginBottom: 2 }}>
        <TimerDisplay formattedTime={formattedTime} state={displayState} />
      </Box>

      {/* Progress Bar */}
      <Box sx={{ marginBottom: 2 }}>
        <LinearProgress
          variant="determinate"
          value={100 - percentage}
          color={progressColor}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.palette.action.disabledBackground,
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              transition: 'transform 1s linear',
            },
          }}
          aria-hidden="true"
        />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 0.5,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {Math.round(percentage)}% elapsed
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {Math.round(100 - percentage)}% remaining
          </Typography>
        </Box>
      </Box>

      {/* Warning Alerts */}
      {displayState === 'warning' && (
        <Alert
          severity="warning"
          title="Time Warning"
          message="Less than 5 minutes remaining. Please finish and submit your quiz soon."
          data-testid="timer-warning-alert"
        />
      )}

      {displayState === 'critical' && (
        <Alert
          severity="error"
          title="Critical Time Warning"
          message="Less than 1 minute remaining! Your quiz will be submitted automatically when time expires."
          data-testid="timer-critical-alert"
        />
      )}

      {displayState === 'expired' && (
        <Alert
          severity="error"
          title="Time Expired"
          message="Time has expired. Your quiz is being submitted automatically."
          data-testid="timer-expired-alert"
        />
      )}
    </Paper>
  );
}

// ============================================================================
// Memoized Export
// ============================================================================

/**
 * Memoized QuizTimer component
 *
 * Wrapped with React.memo for performance optimization to prevent
 * unnecessary re-renders when parent components update but the
 * timer props haven't changed.
 */
const QuizTimer = memo(QuizTimerComponent);

// Set display name for React DevTools
QuizTimer.displayName = 'QuizTimer';

export default QuizTimer;
export { QuizTimer };
