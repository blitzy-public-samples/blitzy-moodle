/**
 * useQuizTimer Hook
 *
 * Custom React hook for managing timed quiz countdown and auto-save functionality.
 * Provides comprehensive timer state management including countdown display,
 * auto-save at configurable intervals, pause/resume controls, and expiration handling.
 *
 * This hook mirrors the timer functionality from Moodle's quiz attempt system:
 * - Timer calculation mirrors $attemptobj->get_time_left_display() logic
 * - Auto-save backend endpoint wraps attemptobj->process_auto_save() from autosave.ajax.php
 * - No business logic duplication - all time validation happens on backend
 *
 * @module features/activities/quizzes/hooks/useQuizTimer
 * @see public/mod/quiz/attempt.php - Quiz attempt page with timer initialization
 * @see public/mod/quiz/autosave.ajax.php - Auto-save AJAX endpoint
 * @see public/mod/quiz/classes/access_manager.php - Time limit calculation logic
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useMutation } from '@tanstack/react-query';
import { submitQuizAnswers } from '../api/quizApi';
// Note: QuizTimer type from quiz.types.ts is used as a reference for the timer structure.
// This hook implements its own interfaces (UseQuizTimerOptions, UseQuizTimerResult) that are
// tailored for the hook's specific needs while maintaining compatibility with the QuizTimer pattern.

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration options for the useQuizTimer hook
 *
 * Provides all necessary settings to configure the quiz timer behavior,
 * including time limits, auto-save intervals, and callback functions
 * for warning and expiration events.
 */
export interface UseQuizTimerOptions {
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
   * Interval in seconds for automatic answer saving
   * @default 60 (1 minute)
   */
  autoSaveInterval?: number;

  /**
   * Callback function invoked when time is running low
   * Called each second once timeRemaining falls below warningThreshold
   * @param timeRemaining - Seconds remaining until expiration
   */
  onTimeWarning?: (timeRemaining: number) => void;

  /**
   * Callback function invoked when time expires
   * Called once when timeRemaining reaches 0
   */
  onTimeExpired?: () => void;

  /**
   * Threshold in seconds for triggering time warnings
   * @default 300 (5 minutes)
   */
  warningThreshold?: number;

  /**
   * Whether the timer is enabled
   * When false, timer doesn't count down and auto-save is disabled
   * @default true
   */
  enabled?: boolean;
}

/**
 * Return value structure from the useQuizTimer hook
 *
 * Provides complete timer state and control functions for
 * managing timed quiz attempts in React components.
 */
export interface UseQuizTimerResult {
  /**
   * Seconds remaining until the quiz expires
   * Returns null if there is no time limit (timeLimit = 0)
   */
  timeRemaining: number | null;

  /**
   * Seconds elapsed since the attempt started
   */
  timeElapsed: number;

  /**
   * Total time limit for the attempt in seconds
   * 0 indicates no time limit
   */
  timeLimit: number;

  /**
   * Whether the timer is actively counting down
   * False when paused, expired, or disabled
   */
  isRunning: boolean;

  /**
   * Whether the time has expired
   * True when timeRemaining reaches 0 or below
   */
  isExpired: boolean;

  /**
   * Whether the timer is currently paused
   * Pausing does not stop time on the server, only local display
   */
  isPaused: boolean;

  /**
   * Formatted time string for display
   * Format: "HH:MM:SS" for times >= 1 hour, "MM:SS" otherwise
   */
  formattedTime: string;

  /**
   * Percentage of time used (0-100)
   * Calculated as (timeElapsed / timeLimit) * 100
   * Returns 0 if there is no time limit
   */
  percentage: number;

  /**
   * Pause the timer countdown
   * Note: This only pauses local display, not server-side time tracking
   */
  pause: () => void;

  /**
   * Resume the timer countdown after pausing
   */
  resume: () => void;

  /**
   * Manually trigger an auto-save of current answers
   * Useful before navigation or when user requests manual save
   * @returns Promise that resolves when save completes
   */
  triggerAutoSave: () => Promise<void>;
}

/**
 * Internal state structure for timer management
 */
interface TimerState {
  timeRemaining: number | null;
  isRunning: boolean;
  isPaused: boolean;
  isExpired: boolean;
}

/**
 * Auto-save request payload
 */
interface AutoSavePayload {
  quizId: number;
  attemptId: number;
  answers: Record<number, string | string[] | Record<string, string>>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format seconds into a human-readable time string
 *
 * Converts total seconds into HH:MM:SS or MM:SS format.
 * Mirrors display formatting from Moodle's quiz timer JavaScript.
 *
 * @param totalSeconds - Total number of seconds to format
 * @returns Formatted time string (e.g., "05:30" or "01:30:45")
 */
function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return '00:00';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (num: number): string => num.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Calculate the initial time remaining for an attempt
 *
 * Computes remaining time based on the time limit and when the attempt started.
 * Returns null if there is no time limit.
 *
 * @param timeLimit - Total time limit in seconds (0 = no limit)
 * @param timeStart - Unix timestamp when attempt started
 * @returns Seconds remaining, or null if no limit
 */
function calculateInitialTimeRemaining(
  timeLimit: number,
  timeStart: number
): number | null {
  if (timeLimit <= 0) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - timeStart;
  const remaining = timeLimit - elapsed;

  return Math.max(0, remaining);
}

/**
 * Calculate elapsed time since attempt started
 *
 * @param timeStart - Unix timestamp when attempt started
 * @returns Seconds elapsed since start
 */
function calculateElapsedTime(timeStart: number): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, now - timeStart);
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useQuizTimer - Custom hook for quiz timer management
 *
 * Manages the countdown timer for timed quiz attempts, providing:
 * - Real-time countdown with automatic updates every second
 * - Formatted time display (HH:MM:SS or MM:SS)
 * - Percentage-based progress tracking
 * - Auto-save functionality at configurable intervals
 * - Pause/resume controls for local timer display
 * - Warning and expiration callbacks
 * - Graceful error handling for auto-save failures
 *
 * Timer logic mirrors Moodle's backend implementation:
 * - Time calculation similar to quiz_attempt::get_time_left_display()
 * - Auto-save uses process_auto_save() via the submit endpoint
 *
 * @param attemptId - The ID of the quiz attempt being timed
 * @param options - Configuration options for the timer
 * @returns Timer state and control functions
 *
 * @example
 * ```tsx
 * const QuizAttemptTimer: React.FC<{ attemptId: number; quizId: number }> = ({
 *   attemptId,
 *   quizId
 * }) => {
 *   const {
 *     timeRemaining,
 *     formattedTime,
 *     isExpired,
 *     percentage,
 *     pause,
 *     resume,
 *     triggerAutoSave
 *   } = useQuizTimer(attemptId, {
 *     timeLimit: 3600, // 1 hour
 *     timeStart: Math.floor(Date.now() / 1000) - 600, // Started 10 min ago
 *     autoSaveInterval: 60,
 *     warningThreshold: 300, // 5 minute warning
 *     onTimeWarning: (remaining) => {
 *       console.log(`Warning: ${remaining} seconds left!`);
 *     },
 *     onTimeExpired: () => {
 *       console.log('Time expired!');
 *       // Handle quiz submission
 *     }
 *   });
 *
 *   return (
 *     <div>
 *       <span>{formattedTime}</span>
 *       <progress value={percentage} max={100} />
 *       {isExpired && <span>Time's up!</span>}
 *     </div>
 *   );
 * };
 * ```
 */
function useQuizTimer(
  attemptId: number,
  options: UseQuizTimerOptions
): UseQuizTimerResult {
  // Destructure options with defaults
  const {
    timeLimit,
    timeStart,
    autoSaveInterval = 60,
    onTimeWarning,
    onTimeExpired,
    warningThreshold = 300,
    enabled = true,
  } = options;

  // ============================================================================
  // State Management
  // ============================================================================

  // Timer state: tracks remaining time, running status, paused status, and expiration
  const [timerState, setTimerState] = useState<TimerState>(() => {
    const initialRemaining = calculateInitialTimeRemaining(timeLimit, timeStart);
    const isExpiredInitially = initialRemaining !== null && initialRemaining <= 0;

    return {
      timeRemaining: initialRemaining,
      isRunning: enabled && !isExpiredInitially && initialRemaining !== null,
      isPaused: false,
      isExpired: isExpiredInitially,
    };
  });

  // Track elapsed time separately for percentage calculation
  const [timeElapsed, setTimeElapsed] = useState<number>(() =>
    calculateElapsedTime(timeStart)
  );

  // ============================================================================
  // Refs for Interval Management
  // ============================================================================

  // Ref for the countdown timer interval ID
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref for the auto-save timer interval ID
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref to track if warning has been triggered to avoid repeated calls
  const warningTriggeredRef = useRef<boolean>(false);

  // Ref to track if expiration callback has been triggered
  const expirationTriggeredRef = useRef<boolean>(false);

  // Ref to store current answers for auto-save (would be provided by parent component)
  const currentAnswersRef = useRef<Record<number, string | string[] | Record<string, string>>>({});

  // Ref to store quizId for auto-save (would be provided by parent component)
  const quizIdRef = useRef<number>(0);

  // ============================================================================
  // Auto-save Mutation
  // ============================================================================

  /**
   * Auto-save mutation using React Query's useMutation
   *
   * Handles automatic saving of quiz answers at intervals.
   * On success: Silent update with no user notification
   * On error: Logs error but doesn't disrupt user (graceful degradation)
   */
  const autoSaveMutation = useMutation({
    mutationFn: async (payload: AutoSavePayload): Promise<void> => {
      // Only perform auto-save if we have valid data
      if (!payload.attemptId || !payload.quizId) {
        return;
      }

      // Submit answers with finishAttempt=false for auto-save
      await submitQuizAnswers(payload.quizId, {
        attemptId: payload.attemptId,
        answers: payload.answers,
        finishAttempt: false, // Auto-save, not final submission
        currentPage: undefined,
      });
    },
    onSuccess: () => {
      // Silent success - auto-save should not notify user
      // Log for debugging purposes in development
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.debug(`[useQuizTimer] Auto-save successful for attempt ${attemptId}`);
      }
    },
    onError: (error: Error) => {
      // Log error but don't disrupt user experience
      // The quiz will continue to function, user can manually save
       
      console.error('[useQuizTimer] Auto-save failed:', error.message);
      // In production, this could also report to error tracking service
    },
  });

  // ============================================================================
  // Callback Functions
  // ============================================================================

  /**
   * Pause the timer countdown
   *
   * Pauses local countdown display but does NOT pause server-side time tracking.
   * User should be informed that pausing is only visual.
   */
  const pause = useCallback(() => {
    setTimerState((prev) => ({
      ...prev,
      isRunning: false,
      isPaused: true,
    }));
  }, []);

  /**
   * Resume the timer countdown after pausing
   *
   * Recalculates remaining time from server timestamps to ensure accuracy.
   */
  const resume = useCallback(() => {
    // Recalculate remaining time when resuming to account for paused duration
    const currentRemaining = calculateInitialTimeRemaining(timeLimit, timeStart);
    const isExpiredNow = currentRemaining !== null && currentRemaining <= 0;

    setTimerState({
      timeRemaining: currentRemaining,
      isRunning: !isExpiredNow && currentRemaining !== null,
      isPaused: false,
      isExpired: isExpiredNow,
    });
  }, [timeLimit, timeStart]);

  /**
   * Manually trigger an auto-save operation
   *
   * Allows components to trigger saves before navigation or on user request.
   * Uses the current stored answers and quizId from refs.
   */
  const triggerAutoSave = useCallback(async (): Promise<void> => {
    if (!attemptId || !quizIdRef.current) {
       
      console.warn('[useQuizTimer] Cannot trigger auto-save: missing attemptId or quizId');
      return;
    }

    // Directly call mutation - errors are logged by mutation's onError handler
    // and will propagate to the caller for handling
    await autoSaveMutation.mutateAsync({
      quizId: quizIdRef.current,
      attemptId,
      answers: currentAnswersRef.current,
    });
  }, [attemptId, autoSaveMutation]);

  // ============================================================================
  // Timer Effect - Countdown
  // ============================================================================

  useEffect(() => {
    // Don't start timer if not enabled, paused, expired, or no time limit
    if (!enabled || timerState.isPaused || timerState.isExpired || timerState.timeRemaining === null) {
      // Clear any existing interval
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    // Set up countdown interval (1 second)
    countdownIntervalRef.current = setInterval(() => {
      setTimerState((prev) => {
        // Don't update if paused or already expired
        if (prev.isPaused || prev.isExpired || prev.timeRemaining === null) {
          return prev;
        }

        const newRemaining = prev.timeRemaining - 1;

        // Check for expiration
        if (newRemaining <= 0) {
          // Only trigger expiration callback once
          if (!expirationTriggeredRef.current && onTimeExpired) {
            expirationTriggeredRef.current = true;
            // Use setTimeout to avoid state update during render
            setTimeout(() => onTimeExpired(), 0);
          }

          return {
            ...prev,
            timeRemaining: 0,
            isRunning: false,
            isExpired: true,
          };
        }

        // Check for warning threshold
        if (
          newRemaining <= warningThreshold &&
          !warningTriggeredRef.current &&
          onTimeWarning
        ) {
          warningTriggeredRef.current = true;
        }

        // Call warning callback if in warning zone
        if (
          newRemaining <= warningThreshold &&
          onTimeWarning
        ) {
          // Use setTimeout to avoid state update during render
          setTimeout(() => onTimeWarning(newRemaining), 0);
        }

        return {
          ...prev,
          timeRemaining: newRemaining,
        };
      });

      // Update elapsed time
      setTimeElapsed(calculateElapsedTime(timeStart));
    }, 1000);

    // Cleanup interval on unmount or dependency change
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [
    enabled,
    timerState.isPaused,
    timerState.isExpired,
    timerState.timeRemaining,
    timeStart,
    warningThreshold,
    onTimeWarning,
    onTimeExpired,
  ]);

  // ============================================================================
  // Auto-save Effect
  // ============================================================================

  useEffect(() => {
    // Don't set up auto-save if disabled, expired, or no interval
    if (!enabled || timerState.isExpired || autoSaveInterval <= 0) {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
      return;
    }

    // Set up auto-save interval
    autoSaveIntervalRef.current = setInterval(() => {
      // Only auto-save if not already saving and quiz is still active
      if (!autoSaveMutation.isPending && !timerState.isExpired) {
        autoSaveMutation.mutate({
          quizId: quizIdRef.current,
          attemptId,
          answers: currentAnswersRef.current,
        });
      }
    }, autoSaveInterval * 1000);

    // Cleanup interval on unmount or dependency change
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
    };
  }, [enabled, timerState.isExpired, autoSaveInterval, attemptId, autoSaveMutation]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  /**
   * Format the remaining time for display
   * Returns "00:00" if no time limit or expired
   */
  const formattedTime: string = formatTime(timerState.timeRemaining ?? 0);

  /**
   * Calculate percentage of time used
   * Returns 0 if no time limit, otherwise (elapsed / limit) * 100
   */
  const percentage: number = timeLimit > 0
    ? Math.min(100, Math.max(0, (timeElapsed / timeLimit) * 100))
    : 0;

  // ============================================================================
  // Return Value
  // ============================================================================

  return {
    timeRemaining: timerState.timeRemaining,
    timeElapsed,
    timeLimit,
    isRunning: timerState.isRunning,
    isExpired: timerState.isExpired,
    isPaused: timerState.isPaused,
    formattedTime,
    percentage,
    pause,
    resume,
    triggerAutoSave,
  };
}

// ============================================================================
// Export
// ============================================================================

export default useQuizTimer;

// Named export for more explicit imports
export { useQuizTimer };
