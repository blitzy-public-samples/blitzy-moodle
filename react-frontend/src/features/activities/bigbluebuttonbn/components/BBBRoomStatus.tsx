/**
 * BigBlueButton Room Status Component
 *
 * Real-time room status display component that shows the current state of a
 * BigBlueButton conference room including session running state, start time,
 * moderator and participant counts, and status messages.
 *
 * This component implements automatic polling to refresh room status every 30 seconds
 * when the component is mounted, providing users with up-to-date meeting information.
 *
 * Based on the status bar section from the original Moodle template:
 * public/mod/bigbluebuttonbn/templates/room_view.mustache (lines 36-61)
 *
 * Features:
 * - Real-time status updates via polling
 * - Session start time display when meeting is running
 * - Moderator count with proper singular/plural labels
 * - Participant/viewer count with proper singular/plural labels
 * - Status messages for meeting state information
 * - Accessible and responsive design with Material-UI
 *
 * @module features/activities/bigbluebuttonbn/components/BBBRoomStatus
 * @copyright 2024 Moodle React Frontend
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useEffect, useMemo } from 'react';
import { Box, Typography, Skeleton, Alert, Chip } from '@mui/material';
import {
  PlayCircleOutline as RunningIcon,
  PauseCircleOutline as NotRunningIcon,
  Group as ParticipantIcon,
  SupervisorAccount as ModeratorIcon,
  Schedule as TimeIcon,
} from '@mui/icons-material';

import { useBBBMeetingInfo } from '@/features/activities/bigbluebuttonbn/hooks/useBBB';
import type { BBBRoomStatus as BBBRoomStatusType } from '@/features/activities/bigbluebuttonbn/types/bbb.types';
import { formatTime } from '@/utils/date';
import type { Id } from '@/types/common';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Extended room status type that includes startedAt timestamp.
 * The API returns this field when a meeting is running, allowing us to display
 * when the session began.
 */
interface ExtendedBBBRoomStatus extends BBBRoomStatusType {
  /** Unix timestamp (in milliseconds) when the meeting session started */
  startedAt?: number | null;
}

/**
 * Props for the BBBRoomStatus component.
 */
interface BBBRoomStatusProps {
  /**
   * The BBB instance ID to fetch status for.
   * Must be a positive integer representing a valid BigBlueButton instance.
   */
  instanceId: Id;

  /**
   * Whether to enable automatic polling for status updates.
   * When true, the component will refresh every 30 seconds.
   * @default true
   */
  enablePolling?: boolean;

  /**
   * Custom polling interval in milliseconds.
   * Only used when enablePolling is true.
   * @default 30000 (30 seconds)
   */
  pollingInterval?: number;

  /**
   * Callback fired when the room status changes.
   * Useful for parent components that need to react to status updates.
   */
  onStatusChange?: (status: ExtendedBBBRoomStatus) => void;

  /**
   * Whether to show a compact version of the status display.
   * Compact mode shows only essential information.
   * @default false
   */
  compact?: boolean;
}

// ============================================================================
// Styling Constants
// ============================================================================

/**
 * Common styling for status container boxes.
 */
const STATUS_CONTAINER_SX = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5,
  p: 2,
  borderRadius: 1,
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
} as const;

/**
 * Styling for individual status row items.
 */
const STATUS_ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
} as const;

/**
 * Styling for status labels (bold text).
 */
const LABEL_SX = {
  fontWeight: 'bold',
  color: 'text.primary',
} as const;

/**
 * Styling for status values.
 */
const VALUE_SX = {
  color: 'text.secondary',
} as const;

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Loading skeleton component for the room status.
 * Displays placeholder content while data is being fetched.
 */
function RoomStatusSkeleton(): React.ReactElement {
  return (
    <Box sx={STATUS_CONTAINER_SX} data-testid="bbb-room-status-skeleton">
      <Skeleton variant="rectangular" width="100%" height={24} />
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="text" width="40%" />
      <Skeleton variant="text" width="50%" />
    </Box>
  );
}

/**
 * Error display component for failed status fetches.
 *
 * @param error - The error that occurred during fetch
 */
function RoomStatusError({ error }: { error: Error }): React.ReactElement {
  return (
    <Alert
      severity="error"
      data-testid="bbb-room-status-error"
      sx={{ mb: 2 }}
    >
      <Typography variant="body2">
        Unable to load room status. {error.message}
      </Typography>
    </Alert>
  );
}

/**
 * Status chip component showing running/not running state.
 *
 * @param isRunning - Whether the meeting is currently running
 */
function RunningStatusChip({
  isRunning,
}: {
  isRunning: boolean;
}): React.ReactElement {
  return (
    <Chip
      icon={isRunning ? <RunningIcon /> : <NotRunningIcon />}
      label={isRunning ? 'Meeting in Progress' : 'Meeting Not Started'}
      color={isRunning ? 'success' : 'default'}
      variant={isRunning ? 'filled' : 'outlined'}
      size="small"
      data-testid="bbb-running-status-chip"
      aria-label={isRunning ? 'Meeting is currently running' : 'Meeting has not started'}
    />
  );
}

/**
 * Displays the session start time when meeting is running.
 *
 * @param startedAt - Unix timestamp when the session started
 */
function SessionStartTime({
  startedAt,
}: {
  startedAt: number | null | undefined;
}): React.ReactElement | null {
  // Don't render if no start time provided
  if (!startedAt) {
    return null;
  }

  // Format the start time for display
  // The API returns timestamps in seconds, convert to milliseconds for formatTime
  const formattedTime = useMemo(() => {
    try {
      // Assume timestamp could be in seconds (Unix) or milliseconds
      // If the number is less than 10 digits, it's likely seconds
      const timestampMs = startedAt < 10000000000 ? startedAt * 1000 : startedAt;
      return formatTime(timestampMs);
    } catch {
      return 'Unknown';
    }
  }, [startedAt]);

  return (
    <Box sx={STATUS_ROW_SX} data-testid="bbb-session-start-time">
      <TimeIcon fontSize="small" color="action" aria-hidden="true" />
      <Typography component="span" variant="body2" sx={LABEL_SX}>
        Session started at:
      </Typography>
      <Typography component="span" variant="body2" sx={VALUE_SX}>
        {formattedTime}
      </Typography>
    </Box>
  );
}

/**
 * Displays the moderator count with proper singular/plural label.
 *
 * @param count - Number of moderators
 * @param plural - Whether to use plural form
 */
function ModeratorCount({
  count,
  plural,
}: {
  count: number;
  plural: boolean;
}): React.ReactElement {
  const label = plural ? 'Moderators' : 'Moderator';

  return (
    <Box sx={STATUS_ROW_SX} data-testid="bbb-moderator-count">
      <ModeratorIcon fontSize="small" color="action" aria-hidden="true" />
      <Typography component="span" variant="body2" sx={LABEL_SX}>
        {label}:
      </Typography>
      <Typography
        component="span"
        variant="body2"
        sx={VALUE_SX}
        aria-label={`${count} ${label.toLowerCase()}`}
      >
        {count}
      </Typography>
    </Box>
  );
}

/**
 * Displays the participant/viewer count with proper singular/plural label.
 *
 * @param count - Number of participants/viewers
 * @param plural - Whether to use plural form
 */
function ParticipantCount({
  count,
  plural,
}: {
  count: number;
  plural: boolean;
}): React.ReactElement {
  // Match the original Moodle template which uses "Viewers" terminology
  const label = plural ? 'Viewers' : 'Viewer';

  return (
    <Box sx={STATUS_ROW_SX} data-testid="bbb-participant-count">
      <ParticipantIcon fontSize="small" color="action" aria-hidden="true" />
      <Typography component="span" variant="body2" sx={LABEL_SX}>
        {label}:
      </Typography>
      <Typography
        component="span"
        variant="body2"
        sx={VALUE_SX}
        aria-label={`${count} ${label.toLowerCase()}`}
      >
        {count}
      </Typography>
    </Box>
  );
}

/**
 * Displays the status message for the meeting room.
 *
 * @param message - The status message to display
 */
function StatusMessage({
  message,
}: {
  message: string;
}): React.ReactElement | null {
  // Don't render if no message
  if (!message || message.trim() === '') {
    return null;
  }

  return (
    <Box
      sx={{ ...STATUS_ROW_SX, mt: 1 }}
      data-testid="bbb-status-message"
    >
      <Typography
        variant="body2"
        color="text.secondary"
        className="status-message"
        sx={{ fontStyle: 'italic' }}
      >
        {message}
      </Typography>
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * BigBlueButton Room Status Component
 *
 * Displays real-time status information for a BigBlueButton conference room.
 * Automatically polls the server for updates to keep the display current.
 *
 * The component shows different information based on the meeting state:
 * - When running: Session start time, moderator count, participant count, status message
 * - When not running: Only the status message
 *
 * @example
 * ```tsx
 * // Basic usage
 * <BBBRoomStatus instanceId={123} />
 *
 * // With custom polling interval
 * <BBBRoomStatus
 *   instanceId={123}
 *   pollingInterval={15000}
 *   onStatusChange={(status) => console.log('Status updated:', status)}
 * />
 *
 * // Compact mode without polling
 * <BBBRoomStatus
 *   instanceId={123}
 *   compact
 *   enablePolling={false}
 * />
 * ```
 */
export function BBBRoomStatus({
  instanceId,
  enablePolling = true,
  pollingInterval = 30000,
  onStatusChange,
  compact = false,
}: BBBRoomStatusProps): React.ReactElement {
  // Fetch meeting status with automatic polling
  const {
    data: status,
    isLoading,
    isError,
    error,
  } = useBBBMeetingInfo(instanceId, {
    enabled: instanceId > 0,
    refetchInterval: enablePolling ? pollingInterval : false,
  });

  // Cast the status to our extended type that includes startedAt
  const extendedStatus = status as ExtendedBBBRoomStatus | undefined;

  // Notify parent when status changes
  useEffect(() => {
    if (extendedStatus && onStatusChange) {
      onStatusChange(extendedStatus);
    }
  }, [extendedStatus, onStatusChange]);

  // Memoize computed values for performance
  const isRunning = useMemo(
    () => extendedStatus?.statusRunning ?? false,
    [extendedStatus?.statusRunning]
  );

  const moderatorCount = useMemo(
    () => extendedStatus?.moderatorCount ?? 0,
    [extendedStatus?.moderatorCount]
  );

  const participantCount = useMemo(
    () => extendedStatus?.participantCount ?? 0,
    [extendedStatus?.participantCount]
  );

  const moderatorPlural = useMemo(
    () => extendedStatus?.moderatorPlural ?? moderatorCount !== 1,
    [extendedStatus?.moderatorPlural, moderatorCount]
  );

  const participantPlural = useMemo(
    () => extendedStatus?.participantPlural ?? participantCount !== 1,
    [extendedStatus?.participantPlural, participantCount]
  );

  const statusMessage = useMemo(
    () => extendedStatus?.statusMessage ?? '',
    [extendedStatus?.statusMessage]
  );

  const startedAt = useMemo(
    () => extendedStatus?.startedAt ?? null,
    [extendedStatus?.startedAt]
  );

  // Show loading skeleton while fetching initial data
  if (isLoading) {
    return <RoomStatusSkeleton />;
  }

  // Show error message if fetch failed
  if (isError && error) {
    return <RoomStatusError error={error as Error} />;
  }

  // Don't render anything if no status data available
  if (!extendedStatus) {
    return (
      <Box sx={STATUS_CONTAINER_SX} data-testid="bbb-room-status-empty">
        <Typography variant="body2" color="text.secondary">
          Room status unavailable.
        </Typography>
      </Box>
    );
  }

  // Render compact version if requested
  if (compact) {
    return (
      <Box
        id="bigbluebuttonbn-status-bar-compact"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
        data-testid="bbb-room-status-compact"
        role="status"
        aria-live="polite"
      >
        <RunningStatusChip isRunning={isRunning} />
        {isRunning && (
          <>
            <Typography variant="body2" color="text.secondary">
              {moderatorCount} {moderatorPlural ? 'moderators' : 'moderator'} •{' '}
              {participantCount} {participantPlural ? 'viewers' : 'viewer'}
            </Typography>
          </>
        )}
      </Box>
    );
  }

  // Render full status display
  return (
    <Box
      id="bigbluebuttonbn-status-bar"
      sx={STATUS_CONTAINER_SX}
      data-testid="bbb-room-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Running/Not Running Status Indicator */}
      <Box sx={{ mb: 1 }}>
        <RunningStatusChip isRunning={isRunning} />
      </Box>

      {/* Meeting is running - show detailed information */}
      {isRunning && (
        <>
          {/* Session start time */}
          <SessionStartTime startedAt={startedAt} />

          {/* Moderator count */}
          <ModeratorCount count={moderatorCount} plural={moderatorPlural} />

          {/* Participant/Viewer count */}
          <ParticipantCount count={participantCount} plural={participantPlural} />
        </>
      )}

      {/* Status message (shown whether running or not) */}
      <StatusMessage message={statusMessage} />
    </Box>
  );
}

// ============================================================================
// Export
// ============================================================================

export default BBBRoomStatus;
