import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

/**
 * Props interface for LessonTimer component
 */
export interface LessonTimerProps {
  /**
   * Time remaining in seconds
   */
  timeRemaining: number;

  /**
   * Callback triggered when timer expires (reaches 0)
   */
  onTimeExpired: () => void;

  /**
   * Whether the timer is actively counting down
   */
  isActive: boolean;

  /**
   * Display variant for the timer
   * - 'compact': Shows time only
   * - 'full': Shows icon and time
   */
  variant?: 'compact' | 'full';
}

/**
 * Urgency level for visual feedback
 */
type UrgencyLevel = 'normal' | 'warning' | 'critical';

/**
 * LessonTimer Component
 *
 * Displays a countdown timer for timed lessons with real-time updates.
 * Provides visual warning indicators when time is running low and triggers
 * auto-submission when the timer expires.
 *
 * Features:
 * - Real-time countdown with second-by-second updates
 * - Color-coded urgency states:
 *   - Green (normal): >5 minutes remaining
 *   - Amber (warning): 1-5 minutes remaining
 *   - Red (critical): <1 minute remaining
 * - Accessible ARIA labels for screen readers
 * - Supports pause/resume via isActive prop
 * - Auto-submission trigger at expiration
 * - Flexible display variants (compact/full)
 *
 * @example
 * ```tsx
 * <LessonTimer
 *   timeRemaining={300}
 *   onTimeExpired={() => handleSubmit()}
 *   isActive={true}
 *   variant="full"
 * />
 * ```
 */
function LessonTimer({
  timeRemaining: initialTimeRemaining,
  onTimeExpired,
  isActive,
  variant = 'full',
}: LessonTimerProps): React.JSX.Element {
  const theme = useTheme();

  // Local state for countdown synchronized with parent prop
  const [timeRemaining, setTimeRemaining] = useState<number>(initialTimeRemaining);

  // Track if expiration callback has been called to prevent duplicate calls
  const [hasExpired, setHasExpired] = useState<boolean>(false);

  /**
   * Synchronize local state with prop changes
   * This allows parent to reset or update the timer
   */
  useEffect(() => {
    setTimeRemaining(initialTimeRemaining);
    // Reset expiration flag if time is reset to a positive value
    if (initialTimeRemaining > 0) {
      setHasExpired(false);
    }
  }, [initialTimeRemaining]);

  /**
   * Determine urgency level based on time remaining
   * - normal: >300 seconds (5 minutes)
   * - warning: 60-300 seconds (1-5 minutes)
   * - critical: <60 seconds (1 minute)
   */
  const getUrgencyLevel = useCallback((seconds: number): UrgencyLevel => {
    if (seconds > 300) {
      return 'normal';
    }
    if (seconds > 60) {
      return 'warning';
    }
    return 'critical';
  }, []);

  /**
   * Get color for current urgency level using MUI theme palette
   */
  const getUrgencyColor = useCallback(
    (urgency: UrgencyLevel): string => {
      switch (urgency) {
        case 'critical':
          return theme.palette.error.main;
        case 'warning':
          return theme.palette.warning.main;
        case 'normal':
        default:
          return theme.palette.success.main;
      }
    },
    [theme.palette]
  );

  /**
   * Format time as HH:MM:SS or MM:SS based on duration
   * Uses HH:MM:SS if time is 1 hour or more, otherwise MM:SS
   */
  const formatTime = useCallback((seconds: number): string => {
    // Ensure non-negative value
    const totalSeconds = Math.max(0, seconds);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    // Pad with leading zeros
    const padZero = (num: number): string => num.toString().padStart(2, '0');

    // Use HH:MM:SS format if 1 hour or more
    if (hours > 0) {
      return `${padZero(hours)}:${padZero(minutes)}:${padZero(secs)}`;
    }

    // Use MM:SS format for less than 1 hour
    return `${padZero(minutes)}:${padZero(secs)}`;
  }, []);

  /**
   * Get human-readable time string for ARIA label
   */
  const getAriaLabel = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    }

    if (minutes > 0) {
      parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    }

    if (secs > 0 || parts.length === 0) {
      parts.push(`${secs} ${secs === 1 ? 'second' : 'seconds'}`);
    }

    return `${parts.join(', ')} remaining`;
  }, []);

  /**
   * Timer effect - decrements time every second when active
   * Cleans up interval on unmount or when dependencies change
   */
  useEffect(() => {
    // Only run timer if active and time remaining
    if (!isActive || timeRemaining <= 0) {
      return;
    }

    // Set up interval to decrement timer every second
    const intervalId = setInterval(() => {
      setTimeRemaining((prevTime) => {
        const newTime = prevTime - 1;

        // Trigger expiration callback when reaching 0
        if (newTime <= 0 && !hasExpired) {
          setHasExpired(true);
          // Call expiration callback asynchronously to avoid state update during render
          setTimeout(() => {
            onTimeExpired();
          }, 0);
          return 0;
        }

        return newTime;
      });
    }, 1000);

    // Cleanup interval on unmount or dependency change
    return () => {
      clearInterval(intervalId);
    };
  }, [isActive, timeRemaining, hasExpired, onTimeExpired]);

  // Calculate current urgency level and color
  const urgency = getUrgencyLevel(timeRemaining);
  const color = getUrgencyColor(urgency);
  const formattedTime = formatTime(timeRemaining);
  const ariaLabel = getAriaLabel(timeRemaining);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: variant === 'full' ? 1 : 0,
        padding: variant === 'full' ? 1.5 : 0.5,
        borderRadius: 1,
        backgroundColor: variant === 'full' ? `${color}15` : 'transparent',
        border: variant === 'full' ? `2px solid ${color}` : 'none',
        transition: 'all 0.3s ease-in-out',
      }}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      aria-label={ariaLabel}
    >
      {variant === 'full' && (
        <AccessTimeIcon
          sx={{
            color,
            fontSize: '1.5rem',
            animation: urgency === 'critical' ? 'pulse 1s infinite' : 'none',
            '@keyframes pulse': {
              '0%, 100%': {
                opacity: 1,
              },
              '50%': {
                opacity: 0.5,
              },
            },
          }}
          aria-hidden="true"
        />
      )}

      <Typography
        variant={variant === 'full' ? 'h6' : 'body2'}
        component="span"
        sx={{
          color,
          fontWeight: urgency === 'critical' ? 'bold' : 'medium',
          fontFamily: 'monospace',
          fontSize: variant === 'full' ? '1.5rem' : '0.875rem',
          letterSpacing: '0.05em',
          transition: 'all 0.3s ease-in-out',
        }}
      >
        {formattedTime}
      </Typography>
    </Box>
  );
}

export default LessonTimer;
