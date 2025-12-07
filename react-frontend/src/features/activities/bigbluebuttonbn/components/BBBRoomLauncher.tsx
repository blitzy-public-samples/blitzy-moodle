/**
 * BigBlueButton Room Launcher Component
 *
 * Provides the primary interface for launching BigBlueButton conference rooms
 * with role-based actions and controls. This component handles:
 * - Join/start meeting functionality with permission checks
 * - End session controls for moderators
 * - Guest access link display for moderators
 * - Presentation files list with download links
 *
 * The component integrates with BBBRoomStatus for real-time room state and
 * uses the useEndBBBMeeting hook for terminating meetings.
 *
 * Based on the following Moodle templates:
 * - public/mod/bigbluebuttonbn/templates/room_view.mustache (lines 64-98)
 * - public/mod/bigbluebuttonbn/templates/end_session_button.mustache
 * - public/mod/bigbluebuttonbn/templates/guest_links.mustache
 *
 * Features:
 * - Role-based visibility (moderator vs participant)
 * - Opens meeting in new browser tab/window
 * - Confirmation dialog before ending session
 * - Presentation files with icons and download links
 * - Guest access URL display for sharing
 * - Real-time status integration via BBBRoomStatus
 * - Full accessibility support (WCAG 2.1 AA)
 *
 * @module features/activities/bigbluebuttonbn/components/BBBRoomLauncher
 * @copyright 2024 Moodle React Frontend
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Tooltip,
  Alert,
  Divider,
  CircularProgress,
  Collapse,
} from '@mui/material';
import {
  InsertDriveFile,
  VideoCall as JoinIcon,
  StopCircle as EndIcon,
  PersonAdd as GuestIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

import { BBBRoomStatus } from '@/features/activities/bigbluebuttonbn/components/BBBRoomStatus';
import { Modal } from '@/components/feedback/Modal';
import type { BBBInstance, BBBPresentation, BBBRoomStatus as BBBRoomStatusType } from '@/features/activities/bigbluebuttonbn/types/bbb.types';
import { useEndBBBMeeting } from '@/features/activities/bigbluebuttonbn/api/bbbApi';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Extended room status with additional fields returned from API
 * that may not be in the base BBBRoomStatus type.
 */
interface ExtendedRoomStatus extends BBBRoomStatusType {
  /** Unix timestamp when the session started (if running) */
  startedAt?: number | null;
}

/**
 * Props for the BBBRoomLauncher component.
 */
interface BBBRoomLauncherProps {
  /**
   * BBB instance configuration containing settings, presentations, and metadata.
   * Required to display the launcher with correct permissions and options.
   */
  instance: BBBInstance;

  /**
   * URL for joining the meeting, typically obtained from the meeting API.
   * When clicked, opens this URL in a new browser tab/window.
   */
  joinUrl: string;

  /**
   * Whether the current user has permission to join the meeting.
   * When false, the join button is disabled.
   * @default false
   */
  canJoin?: boolean;

  /**
   * Whether the current user has moderator privileges.
   * Moderators can see additional controls like end session and guest links.
   * @default false
   */
  isModerator?: boolean;

  /**
   * Whether guest access is enabled for this meeting.
   * When true and user is moderator, guest access link section is shown.
   * @default false
   */
  guestAccessEnabled?: boolean;

  /**
   * URL for guests to join the meeting without authentication.
   * Only displayed when guestAccessEnabled is true and user is moderator.
   */
  guestJoinUrl?: string | null;

  /**
   * Password required for guests to join (if applicable).
   * Displayed alongside guest URL for moderators to share.
   */
  guestPassword?: string | null;

  /**
   * Whether to show the presentations section.
   * When false, presentations are hidden even if available.
   * @default true
   */
  showPresentations?: boolean;

  /**
   * Group ID for group-specific meeting instances.
   * Used for API calls that require group context.
   * @default 0
   */
  groupId?: number;

  /**
   * Callback fired when a user successfully joins the meeting.
   * Called after the meeting window opens.
   */
  onJoin?: () => void;

  /**
   * Callback fired when the meeting is ended by a moderator.
   * Called after successful end meeting API response.
   */
  onEnd?: () => void;

  /**
   * Callback fired when room status changes (from BBBRoomStatus component).
   */
  onStatusChange?: (status: ExtendedRoomStatus) => void;
}

// ============================================================================
// Styling Constants
// ============================================================================

/**
 * Container styling for the launcher section.
 */
const LAUNCHER_CONTAINER_SX = {
  display: 'flex',
  flexDirection: { xs: 'column', md: 'row' },
  gap: 3,
  p: 2,
  bgcolor: 'background.paper',
  borderRadius: 1,
} as const;

/**
 * Action buttons container styling.
 */
const ACTION_BUTTONS_SX = {
  display: 'flex',
  flexDirection: { xs: 'column-reverse', md: 'row' },
  gap: 1,
  mt: { xs: 2, md: 0 },
  ml: { xs: 0, md: 'auto' },
  alignItems: 'flex-start',
} as const;

/**
 * Guest access section styling.
 */
const GUEST_SECTION_SX = {
  p: 2,
  bgcolor: 'grey.50',
  borderRadius: 1,
  mb: 2,
} as const;

/**
 * Presentations section styling.
 */
const PRESENTATIONS_SECTION_SX = {
  mt: 2,
} as const;

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Props for the PresentationsList helper component.
 */
interface PresentationsListProps {
  /** Array of presentation files to display */
  presentations: BBBPresentation[];
  /** Whether the list is initially expanded */
  defaultExpanded?: boolean;
}

/**
 * Displays a collapsible list of presentation files with download links.
 *
 * @param props - Component props
 * @returns Presentations list or null if no presentations
 */
function PresentationsList({
  presentations,
  defaultExpanded = true,
}: PresentationsListProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(defaultExpanded);

  /**
   * Toggle the expanded state of the presentations list.
   */
  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // Don't render if no presentations available
  if (!presentations || presentations.length === 0) {
    return null;
  }

  return (
    <Box sx={PRESENTATIONS_SECTION_SX} data-testid="bbb-presentations-section">
      <Button
        onClick={handleToggle}
        endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ mb: 1, textTransform: 'none' }}
        aria-expanded={expanded}
        aria-controls="presentations-list"
      >
        <Typography variant="subtitle1" component="span" fontWeight="medium">
          Presentations ({presentations.length})
        </Typography>
      </Button>

      <Collapse in={expanded} id="presentations-list">
        <Paper variant="outlined">
          <List dense disablePadding>
            {presentations.map((presentation, index) => (
              <ListItem
                key={`${presentation.name}-${index}`}
                component="a"
                href={presentation.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                  borderBottom:
                    index < presentations.length - 1 ? 1 : 0,
                  borderColor: 'divider',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
                data-testid={`bbb-presentation-item-${index}`}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <InsertDriveFile
                    color="action"
                    titleAccess={presentation.iconDesc || 'Presentation file'}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={presentation.name}
                  primaryTypographyProps={{
                    variant: 'body2',
                    sx: { wordBreak: 'break-word' },
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Collapse>
    </Box>
  );
}

/**
 * Props for the GuestAccessSection helper component.
 */
interface GuestAccessSectionProps {
  /** URL for guests to join the meeting */
  guestJoinUrl: string;
  /** Password for guest access (optional) */
  guestPassword?: string | null;
}

/**
 * Displays guest access information for moderators to share.
 * Includes copy-to-clipboard functionality for URLs and passwords.
 *
 * @param props - Component props
 * @returns Guest access section element
 */
function GuestAccessSection({
  guestJoinUrl,
  guestPassword,
}: GuestAccessSectionProps): React.ReactElement {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  /**
   * Copy the guest join URL to clipboard.
   */
  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(guestJoinUrl);
      setCopiedUrl(true);
      // Reset after 2 seconds
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (error) {
      // Clipboard API may not be available in all environments
      console.error('Failed to copy URL to clipboard:', error);
    }
  }, [guestJoinUrl]);

  /**
   * Copy the guest password to clipboard.
   */
  const handleCopyPassword = useCallback(async () => {
    if (!guestPassword) return;
    try {
      await navigator.clipboard.writeText(guestPassword);
      setCopiedPassword(true);
      // Reset after 2 seconds
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch (error) {
      console.error('Failed to copy password to clipboard:', error);
    }
  }, [guestPassword]);

  return (
    <Box sx={GUEST_SECTION_SX} data-testid="bbb-guest-access-section">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <GuestIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2" fontWeight="medium">
          Guest Access
        </Typography>
      </Box>

      {/* Guest Join URL */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          Share this link with guests:
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1,
            bgcolor: 'background.paper',
            borderRadius: 0.5,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
            }}
            title={guestJoinUrl}
          >
            {guestJoinUrl}
          </Typography>
          <Tooltip title={copiedUrl ? 'Copied!' : 'Copy URL'}>
            <IconButton
              size="small"
              onClick={handleCopyUrl}
              aria-label="Copy guest join URL"
              color={copiedUrl ? 'success' : 'default'}
            >
              {copiedUrl ? (
                <CheckIcon fontSize="small" />
              ) : (
                <CopyIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Guest Password (if applicable) */}
      {guestPassword && (
        <Box>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Guest password:
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1,
              bgcolor: 'background.paper',
              borderRadius: 0.5,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: '0.75rem',
              }}
            >
              {guestPassword}
            </Typography>
            <Tooltip title={copiedPassword ? 'Copied!' : 'Copy password'}>
              <IconButton
                size="small"
                onClick={handleCopyPassword}
                aria-label="Copy guest password"
                color={copiedPassword ? 'success' : 'default'}
              >
                {copiedPassword ? (
                  <CheckIcon fontSize="small" />
                ) : (
                  <CopyIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}
    </Box>
  );
}

/**
 * Props for the EndSessionConfirmModal helper component.
 */
interface EndSessionConfirmModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when confirm is clicked */
  onConfirm: () => void;
  /** Whether the end meeting operation is loading */
  loading: boolean;
}

/**
 * Confirmation modal for ending a meeting session.
 * Warns users that all participants will be disconnected.
 *
 * @param props - Component props
 * @returns Confirmation modal element
 */
function EndSessionConfirmModal({
  open,
  onClose,
  onConfirm,
  loading,
}: EndSessionConfirmModalProps): React.ReactElement {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="End Meeting?"
      maxWidth="sm"
      loading={loading}
      actions={[
        {
          label: 'Cancel',
          onClick: onClose,
          variant: 'text',
          disabled: loading,
        },
        {
          label: loading ? 'Ending...' : 'End Meeting',
          onClick: onConfirm,
          color: 'error',
          variant: 'contained',
          disabled: loading,
          autoFocus: true,
        },
      ]}
      disableBackdropClick={loading}
      disableEscapeKeyDown={loading}
    >
      <Alert severity="warning" sx={{ mb: 2 }}>
        This action will end the meeting for all participants.
      </Alert>
      <Typography variant="body2" color="text.secondary">
        All participants will be disconnected from the meeting immediately.
        Any ongoing activities or discussions will be terminated.
        {' '}
        If recording is enabled, the recording will be processed and made
        available shortly after the meeting ends.
      </Typography>
    </Modal>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * BigBlueButton Room Launcher Component
 *
 * Provides the primary interface for joining and managing BigBlueButton
 * conference rooms. Displays role-appropriate controls based on user permissions.
 *
 * For moderators:
 * - Join/Start meeting button
 * - End session button (when meeting is running)
 * - Guest access links (when guest access is enabled)
 * - Presentation files list
 *
 * For participants:
 * - Join meeting button (when permitted)
 * - Presentation files list
 *
 * @example
 * ```tsx
 * // Basic usage
 * <BBBRoomLauncher
 *   instance={bbbInstance}
 *   joinUrl="https://bbb.example.com/join/abc123"
 *   canJoin={true}
 * />
 *
 * // Moderator with guest access
 * <BBBRoomLauncher
 *   instance={bbbInstance}
 *   joinUrl={joinUrl}
 *   canJoin={true}
 *   isModerator={true}
 *   guestAccessEnabled={true}
 *   guestJoinUrl="https://bbb.example.com/guest/xyz789"
 *   guestPassword="secretpass"
 *   onEnd={() => showToast('Meeting ended')}
 * />
 * ```
 */
export function BBBRoomLauncher({
  instance,
  joinUrl,
  canJoin = false,
  isModerator = false,
  guestAccessEnabled = false,
  guestJoinUrl,
  guestPassword,
  showPresentations = true,
  groupId = 0,
  onJoin,
  onEnd,
  onStatusChange,
}: BBBRoomLauncherProps): React.ReactElement {
  // State for end session confirmation modal
  const [endSessionModalOpen, setEndSessionModalOpen] = useState(false);

  // State to track if meeting is currently running (from BBBRoomStatus)
  const [isRunning, setIsRunning] = useState(false);

  // End meeting mutation hook
  const endMeetingMutation = useEndBBBMeeting(instance.id, {
    onSuccess: () => {
      setEndSessionModalOpen(false);
      if (onEnd) {
        onEnd();
      }
    },
  });

  /**
   * Handle join button click.
   * Opens the meeting in a new browser tab/window.
   */
  const handleJoinClick = useCallback(() => {
    if (!joinUrl || !canJoin) {
      return;
    }

    // Open meeting in new tab/window
    const meetingWindow = window.open(joinUrl, '_blank', 'noopener,noreferrer');

    // Call onJoin callback if window was successfully opened
    if (meetingWindow && onJoin) {
      onJoin();
    }
  }, [joinUrl, canJoin, onJoin]);

  /**
   * Handle end session button click.
   * Opens confirmation modal.
   */
  const handleEndSessionClick = useCallback(() => {
    setEndSessionModalOpen(true);
  }, []);

  /**
   * Handle end session modal close.
   */
  const handleEndSessionClose = useCallback(() => {
    if (!endMeetingMutation.isPending) {
      setEndSessionModalOpen(false);
    }
  }, [endMeetingMutation.isPending]);

  /**
   * Handle end session confirmation.
   * Calls the end meeting API.
   */
  const handleEndSessionConfirm = useCallback(() => {
    endMeetingMutation.mutate();
  }, [endMeetingMutation]);

  /**
   * Handle status change from BBBRoomStatus component.
   * Updates local state and calls parent callback.
   */
  const handleStatusChange = useCallback(
    (status: ExtendedRoomStatus) => {
      setIsRunning(status.statusRunning);
      if (onStatusChange) {
        onStatusChange(status);
      }
    },
    [onStatusChange]
  );

  // Determine if presentations should be shown
  const hasPresentations =
    instance.presentations && instance.presentations.length > 0;
  const shouldShowPresentations = showPresentations && hasPresentations;

  // Determine if guest access section should be shown
  const shouldShowGuestAccess =
    isModerator && guestAccessEnabled && guestJoinUrl;

  return (
    <Box
      id="bigbluebuttonbn-room-view"
      data-bbb-id={instance.id}
      data-group-id={groupId}
      data-testid="bbb-room-launcher"
    >
      <Paper sx={LAUNCHER_CONTAINER_SX} elevation={0} variant="outlined">
        {/* Left section: Status and presentations */}
        <Box
          id="bigbluebuttonbn-information"
          sx={{ flex: 1, minWidth: 0 }}
        >
          {/* Room Status Display */}
          <BBBRoomStatus
            instanceId={instance.id}
            enablePolling={true}
            onStatusChange={handleStatusChange}
          />

          {/* Control Panel with Presentations */}
          {shouldShowPresentations && (
            <Box
              id="bigbluebuttonbn-room-view-control-panel"
              data-bbb-id={instance.id}
            >
              <PresentationsList
                presentations={instance.presentations}
                defaultExpanded={true}
              />
            </Box>
          )}
        </Box>

        {/* Right section: Action buttons */}
        <Box
          id="bigbluebuttonbn-view-action-button-box"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: { xs: 'stretch', md: 'flex-end' },
            minWidth: { md: 200 },
          }}
        >
          {/* Moderator-only controls */}
          {isModerator && (
            <>
              {/* Guest Access Section */}
              {shouldShowGuestAccess && (
                <GuestAccessSection
                  guestJoinUrl={guestJoinUrl}
                  guestPassword={guestPassword}
                />
              )}

              {/* Divider between guest section and buttons */}
              {shouldShowGuestAccess && <Divider sx={{ mb: 2 }} />}
            </>
          )}

          {/* Action buttons container */}
          <Box
            id="bigbluebuttonbn-room-view-action-buttons"
            sx={ACTION_BUTTONS_SX}
          >
            {/* Moderator: End Session Button (only when running) */}
            {isModerator && isRunning && (
              <Button
                id="end_button_input"
                variant="outlined"
                color="inherit"
                startIcon={
                  endMeetingMutation.isPending ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <EndIcon />
                  )
                }
                onClick={handleEndSessionClick}
                disabled={endMeetingMutation.isPending}
                data-action="end"
                data-bbb-id={instance.id}
                data-group-id={groupId}
                sx={{ m: 0.5 }}
                aria-label="End meeting session"
              >
                End Session
              </Button>
            )}

            {/* Join Button */}
            {canJoin && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<JoinIcon />}
                onClick={handleJoinClick}
                data-action="join"
                sx={{
                  m: 0.5,
                  minWidth: 120,
                }}
                aria-label="Join meeting in new window"
              >
                Join Meeting
              </Button>
            )}

            {/* Message when user cannot join */}
            {!canJoin && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ m: 0.5, fontStyle: 'italic' }}
              >
                You cannot join this meeting at this time.
              </Typography>
            )}
          </Box>

          {/* Error message if end meeting failed */}
          {endMeetingMutation.isError && endMeetingMutation.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Failed to end meeting: {endMeetingMutation.error.message}
            </Alert>
          )}
        </Box>
      </Paper>

      {/* End Session Confirmation Modal */}
      <EndSessionConfirmModal
        open={endSessionModalOpen}
        onClose={handleEndSessionClose}
        onConfirm={handleEndSessionConfirm}
        loading={endMeetingMutation.isPending}
      />
    </Box>
  );
}
