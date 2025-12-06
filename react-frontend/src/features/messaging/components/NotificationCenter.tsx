/**
 * NotificationCenter Component
 *
 * A comprehensive notification center component for displaying system notifications,
 * message alerts, and activity updates in the application header. Features a notification
 * bell icon with unread count badge, dropdown popover with categorized notifications,
 * mark-as-read functionality, and navigation to relevant content.
 *
 * Features:
 * - Material-UI Badge with unread notification count on bell icon
 * - Popover dropdown showing recent notifications when clicked
 * - Notifications grouped by type (messages, system, activity)
 * - Unread indicator (blue dot) for unread notifications
 * - Click handler to navigate to relevant content (course, activity, message)
 * - Mark as read when notification is clicked
 * - Mark all as read / Clear all actions in popover footer
 * - Skeleton loaders during notification fetch
 * - Empty state when no notifications exist
 * - Notification polling using configurable intervals (matches Moodle's messagepollmin)
 * - Filtering tabs (all, unread, messages only)
 * - Toast notifications for new real-time notifications
 * - WCAG 2.1 AA compliant with proper ARIA labels and keyboard navigation
 * - Light/dark mode support via MUI theme
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 *
 * @see public/message/classes/helper.php - Reference for polling intervals
 * @see public/message/templates/message_drawer.mustache - Reference for UI structure
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

// Material-UI Components
import {
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  ListSubheader,
  Button,
  Typography,
  Box,
  Divider,
  Skeleton,
  Tabs,
  Tab,
  Tooltip,
  useTheme,
  alpha,
  type PopoverOrigin,
} from '@mui/material';

// Material-UI Icons
import {
  Notifications as NotificationsIcon,
  Circle as CircleIcon,
  Message as MessageIcon,
  School as SchoolIcon,
  Assignment as AssignmentIcon,
  QuestionAnswer as ForumIcon,
  Quiz as QuizIcon,
  Grade as GradeIcon,
  Info as InfoIcon,
  DoneAll as DoneAllIcon,
  DeleteSweep as DeleteSweepIcon,
  FilterList as FilterListIcon,
  ChevronRight as ChevronRightIcon,
  NotificationsOff as NotificationsOffIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

// Internal imports from messaging feature
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotifications,
  messagingKeys,
} from '@/features/messaging/api/messagingApi';
import type {
  Notification,
  NotificationFilters,
  NotificationListResponse,
} from '@/features/messaging/types/message.types';
import { NotificationType } from '@/features/messaging/types/message.types';

// Internal imports from shared modules
import { useToast } from '@/hooks/useToast';
import { formatRelativeTime } from '@/utils/date';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Filter tab value type for notification filtering
 */
type NotificationFilterTab = 'all' | 'unread' | 'messages';

/**
 * Notification group structure for categorized display
 */
interface NotificationGroup {
  /** Group type identifier */
  type: NotificationType | 'other';
  /** Human-readable group label */
  label: string;
  /** Icon component for the group */
  icon: React.ReactNode;
  /** Notifications in this group */
  notifications: Notification[];
}

/**
 * Props interface for the NotificationCenter component
 */
export interface NotificationCenterProps {
  /**
   * Maximum number of notifications to display in the dropdown
   * @default 20
   */
  maxDisplayCount?: number;

  /**
   * Polling interval in seconds for checking new notifications
   * Based on Moodle's messagepollmin configuration
   * @default 10
   */
  pollInterval?: number;

  /**
   * Whether to enable sound alerts for new notifications
   * @default false
   */
  enableSoundAlerts?: boolean;

  /**
   * Whether to show toast for new notifications
   * @default true
   */
  showToastOnNew?: boolean;

  /**
   * Custom aria-label for the notification button
   * @default 'Open notification center'
   */
  ariaLabel?: string;

  /**
   * Callback fired when a notification is clicked
   */
  onNotificationClick?: (notification: Notification) => void;

  /**
   * Callback fired when all notifications are marked as read
   */
  onMarkAllRead?: () => void;

  /**
   * Callback fired when all notifications are cleared
   */
  onClearAll?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default polling interval in milliseconds (10 seconds)
 * Based on Moodle's MESSAGE_DEFAULT_MIN_POLL_IN_SECONDS
 */
const DEFAULT_POLL_INTERVAL_MS = 10 * 1000;

/**
 * Default maximum number of notifications to display
 */
const DEFAULT_MAX_DISPLAY_COUNT = 20;

/**
 * Stale time for notification queries (30 seconds)
 */
const NOTIFICATION_STALE_TIME = 30 * 1000;

/**
 * Popover anchor origin configuration
 */
const POPOVER_ANCHOR_ORIGIN: PopoverOrigin = {
  vertical: 'bottom',
  horizontal: 'right',
};

/**
 * Popover transform origin configuration
 */
const POPOVER_TRANSFORM_ORIGIN: PopoverOrigin = {
  vertical: 'top',
  horizontal: 'right',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps notification component/eventtype to NotificationType enum
 *
 * @param component - Moodle component name (e.g., 'mod_assign', 'core_message')
 * @param eventType - Moodle event type (e.g., 'assign_notification', 'message')
 * @returns Mapped NotificationType or 'other'
 */
function getNotificationTypeFromComponent(
  component: string,
  eventType: string
): NotificationType | 'other' {
  // Message-related notifications
  if (component === 'moodle' && eventType === 'instantmessage') {
    return NotificationType.MESSAGE;
  }
  if (component.includes('message')) {
    return NotificationType.MESSAGE;
  }

  // Assignment notifications
  if (component === 'mod_assign' || component.includes('assign')) {
    return NotificationType.ASSIGNMENT;
  }

  // Forum notifications
  if (component === 'mod_forum' || component.includes('forum')) {
    return NotificationType.FORUM_POST;
  }

  // Quiz notifications
  if (component === 'mod_quiz' || component.includes('quiz')) {
    return NotificationType.QUIZ;
  }

  // Grade notifications
  if (component.includes('grade') || eventType.includes('grade')) {
    return NotificationType.GRADE;
  }

  // Course notifications
  if (component.includes('course') || component === 'moodle' && eventType.includes('course')) {
    return NotificationType.COURSE;
  }

  // System notifications
  if (component === 'moodle' || component === 'core') {
    return NotificationType.SYSTEM;
  }

  return 'other';
}

/**
 * Returns the appropriate icon for a notification type
 *
 * @param type - The notification type
 * @returns React element for the icon
 */
function getNotificationIcon(type: NotificationType | 'other'): React.ReactNode {
  switch (type) {
    case NotificationType.MESSAGE:
      return <MessageIcon color="primary" />;
    case NotificationType.ASSIGNMENT:
      return <AssignmentIcon color="warning" />;
    case NotificationType.FORUM_POST:
      return <ForumIcon color="info" />;
    case NotificationType.QUIZ:
      return <QuizIcon color="secondary" />;
    case NotificationType.GRADE:
      return <GradeIcon color="success" />;
    case NotificationType.COURSE:
      return <SchoolIcon color="primary" />;
    case NotificationType.SYSTEM:
      return <InfoIcon color="action" />;
    default:
      return <NotificationsIcon color="action" />;
  }
}

/**
 * Returns the display label for a notification type
 *
 * @param type - The notification type
 * @returns Human-readable label string
 */
function getNotificationTypeLabel(type: NotificationType | 'other'): string {
  switch (type) {
    case NotificationType.MESSAGE:
      return 'Messages';
    case NotificationType.ASSIGNMENT:
      return 'Assignments';
    case NotificationType.FORUM_POST:
      return 'Forum Posts';
    case NotificationType.QUIZ:
      return 'Quizzes';
    case NotificationType.GRADE:
      return 'Grades';
    case NotificationType.COURSE:
      return 'Courses';
    case NotificationType.SYSTEM:
      return 'System';
    default:
      return 'Other';
  }
}

/**
 * Groups notifications by their type for categorized display
 *
 * @param notifications - Array of notifications to group
 * @returns Array of NotificationGroup objects
 */
function groupNotificationsByType(notifications: Notification[]): NotificationGroup[] {
  const groups = new Map<NotificationType | 'other', Notification[]>();

  // Group notifications by type
  notifications.forEach((notification) => {
    const type = getNotificationTypeFromComponent(
      notification.component,
      notification.eventtype
    );

    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type)!.push(notification);
  });

  // Convert map to array of NotificationGroup objects
  const result: NotificationGroup[] = [];

  // Define order for groups
  const groupOrder: (NotificationType | 'other')[] = [
    NotificationType.MESSAGE,
    NotificationType.ASSIGNMENT,
    NotificationType.QUIZ,
    NotificationType.FORUM_POST,
    NotificationType.GRADE,
    NotificationType.COURSE,
    NotificationType.SYSTEM,
    'other',
  ];

  groupOrder.forEach((type) => {
    const typeNotifications = groups.get(type);
    if (typeNotifications && typeNotifications.length > 0) {
      result.push({
        type,
        label: getNotificationTypeLabel(type),
        icon: getNotificationIcon(type),
        notifications: typeNotifications,
      });
    }
  });

  return result;
}

/**
 * Extracts navigation path from notification contexturl
 *
 * @param contextUrl - The context URL from notification
 * @returns Navigation path for React Router
 */
function getNavigationPath(contextUrl: string | null): string {
  if (!contextUrl) {
    return '/notifications';
  }

  try {
    // Parse the URL to extract the path
    const url = new URL(contextUrl, window.location.origin);
    const path = url.pathname;

    // Map common Moodle paths to React routes
    if (path.includes('/course/view.php')) {
      const courseId = url.searchParams.get('id');
      return courseId ? `/courses/${courseId}` : '/courses';
    }

    if (path.includes('/mod/assign/')) {
      const assignId = url.searchParams.get('id');
      return assignId ? `/activities/assignments/${assignId}` : '/activities';
    }

    if (path.includes('/mod/quiz/')) {
      const quizId = url.searchParams.get('id');
      return quizId ? `/activities/quizzes/${quizId}` : '/activities';
    }

    if (path.includes('/mod/forum/')) {
      const forumId = url.searchParams.get('id');
      const discussionId = url.searchParams.get('d');
      if (discussionId) {
        return `/activities/forums/discussions/${discussionId}`;
      }
      return forumId ? `/activities/forums/${forumId}` : '/activities';
    }

    if (path.includes('/message/')) {
      return '/messages';
    }

    if (path.includes('/grade/')) {
      return '/gradebook';
    }

    if (path.includes('/user/profile.php')) {
      const userId = url.searchParams.get('id');
      return userId ? `/users/${userId}` : '/profile';
    }

    // Default: return the path as-is (fallback)
    return path;
  } catch {
    // If URL parsing fails, return default
    return '/notifications';
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Skeleton loader for notification items during loading state
 */
function NotificationSkeleton(): React.ReactElement {
  return (
    <ListItem>
      <ListItemIcon>
        <Skeleton variant="circular" width={24} height={24} />
      </ListItemIcon>
      <ListItemText
        primary={<Skeleton width="70%" />}
        secondary={<Skeleton width="40%" />}
      />
    </ListItem>
  );
}

/**
 * Empty state component when no notifications exist
 */
function EmptyNotifications(): React.ReactElement {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        px: 2,
        textAlign: 'center',
      }}
    >
      <NotificationsOffIcon
        sx={{
          fontSize: 64,
          color: theme.palette.text.disabled,
          mb: 2,
        }}
      />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        No notifications
      </Typography>
      <Typography variant="body2" color="text.disabled">
        You&apos;re all caught up! Check back later for updates.
      </Typography>
    </Box>
  );
}

/**
 * Props for individual notification item component
 */
interface NotificationItemProps {
  notification: Notification;
  onRead: (id: number) => void;
  onClick: (notification: Notification) => void;
  isMarking: boolean;
}

/**
 * Individual notification item component
 */
function NotificationItem({
  notification,
  onRead,
  onClick,
  isMarking,
}: NotificationItemProps): React.ReactElement {
  const theme = useTheme();
  const isUnread = notification.timeread === null;
  const notificationType = getNotificationTypeFromComponent(
    notification.component,
    notification.eventtype
  );

  /**
   * Handle keyboard interaction for accessibility
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick(notification);
      }
    },
    [notification, onClick]
  );

  /**
   * Handle click on the notification item
   */
  const handleClick = useCallback(() => {
    onClick(notification);
  }, [notification, onClick]);

  // Format timestamp safely
  let timeDisplay: string;
  try {
    timeDisplay = formatRelativeTime(notification.timecreated * 1000);
  } catch {
    timeDisplay = 'Unknown time';
  }

  return (
    <ListItem
      disablePadding
      sx={{
        bgcolor: isUnread ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
        borderLeft: isUnread
          ? `3px solid ${theme.palette.primary.main}`
          : '3px solid transparent',
        '&:hover': {
          bgcolor: alpha(theme.palette.primary.main, 0.08),
        },
      }}
    >
      <ListItemButton
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={isMarking}
        aria-label={`${isUnread ? 'Unread notification: ' : ''}${notification.subject}. ${timeDisplay}`}
        sx={{ py: 1.5, px: 2 }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          {getNotificationIcon(notificationType)}
        </ListItemIcon>
        <ListItemText
          primary={
            <Typography
              variant="body2"
              sx={{
                fontWeight: isUnread ? 600 : 400,
                color: theme.palette.text.primary,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {notification.subject}
            </Typography>
          }
          secondary={
            <Box
              component="span"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mt: 0.5,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  flex: 1,
                }}
              >
                {notification.smallmessage || notification.fullmessage}
              </Typography>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {timeDisplay}
              </Typography>
            </Box>
          }
        />
        {isUnread && (
          <ListItemSecondaryAction>
            <Tooltip title="Unread">
              <CircleIcon
                sx={{
                  fontSize: 10,
                  color: theme.palette.primary.main,
                }}
                aria-hidden="true"
              />
            </Tooltip>
          </ListItemSecondaryAction>
        )}
      </ListItemButton>
    </ListItem>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * NotificationCenter Component
 *
 * Displays a notification bell icon in the app header with unread count badge,
 * showing a dropdown list of recent notifications when clicked.
 *
 * @param props - Component props
 * @returns React element
 *
 * @example
 * ```tsx
 * // Basic usage in app header
 * <NotificationCenter />
 *
 * // With custom configuration
 * <NotificationCenter
 *   maxDisplayCount={15}
 *   pollInterval={30}
 *   enableSoundAlerts={true}
 *   onNotificationClick={(n) => console.log('Clicked:', n)}
 * />
 * ```
 */
export function NotificationCenter({
  maxDisplayCount = DEFAULT_MAX_DISPLAY_COUNT,
  pollInterval = 10,
  enableSoundAlerts = false,
  showToastOnNew = true,
  ariaLabel = 'Open notification center',
  onNotificationClick,
  onMarkAllRead,
  onClearAll,
}: NotificationCenterProps): React.ReactElement {
  // Hooks
  const theme = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: showError, info } = useToast();

  // Refs
  const anchorRef = useRef<HTMLButtonElement>(null);
  const previousCountRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationFilterTab>('all');

  // Calculate poll interval in milliseconds
  const pollIntervalMs = useMemo(
    () => pollInterval * 1000 || DEFAULT_POLL_INTERVAL_MS,
    [pollInterval]
  );

  // ============================================================================
  // Queries
  // ============================================================================

  /**
   * Query for unread notification count (polled)
   */
  const unreadCountQuery = useQuery({
    queryKey: messagingKeys.unreadNotificationCount(),
    queryFn: getUnreadNotificationCount,
    staleTime: NOTIFICATION_STALE_TIME,
    refetchInterval: pollIntervalMs,
    refetchIntervalInBackground: false,
  });

  /**
   * Build notification filters based on active tab
   */
  const notificationFilters = useMemo((): NotificationFilters | undefined => {
    switch (activeTab) {
      case 'unread':
        return { read: false };
      case 'messages':
        return { type: NotificationType.MESSAGE };
      default:
        return undefined;
    }
  }, [activeTab]);

  /**
   * Query for notification list (only when popover is open)
   */
  const notificationsQuery = useQuery({
    queryKey: [...messagingKeys.notifications(), { filters: notificationFilters }],
    queryFn: () =>
      getNotifications(
        { pagination: { page: 1, perPage: maxDisplayCount } },
        notificationFilters
      ),
    enabled: isOpen,
    staleTime: NOTIFICATION_STALE_TIME,
  });

  // ============================================================================
  // Mutations
  // ============================================================================

  /**
   * Mutation to mark a single notification as read
   */
  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      // Invalidate notification queries to refresh the list
      queryClient.invalidateQueries({ queryKey: messagingKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: messagingKeys.unreadNotificationCount() });
    },
    onError: (err) => {
      console.error('Failed to mark notification as read:', err);
      showError('Failed to mark notification as read');
    },
  });

  /**
   * Mutation to mark all notifications as read
   */
  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: messagingKeys.unreadNotificationCount() });
      success('All notifications marked as read');
      onMarkAllRead?.();
    },
    onError: (err) => {
      console.error('Failed to mark all notifications as read:', err);
      showError('Failed to mark all notifications as read');
    },
  });

  /**
   * Mutation to clear all notifications
   */
  const clearAllMutation = useMutation({
    mutationFn: clearNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: messagingKeys.unreadNotificationCount() });
      success('All notifications cleared');
      onClearAll?.();
    },
    onError: (err) => {
      console.error('Failed to clear notifications:', err);
      showError('Failed to clear notifications');
    },
  });

  // ============================================================================
  // Derived State
  // ============================================================================

  const unreadCount = unreadCountQuery.data ?? 0;
  const notifications = notificationsQuery.data?.notifications ?? [];
  const isLoading = notificationsQuery.isLoading;
  const isAnyMutating =
    markReadMutation.isPending ||
    markAllReadMutation.isPending ||
    clearAllMutation.isPending;

  /**
   * Group notifications by type for display
   */
  const groupedNotifications = useMemo(
    () => groupNotificationsByType(notifications),
    [notifications]
  );

  /**
   * Flat list for non-grouped display (used for filtered tabs)
   */
  const flatNotifications = useMemo(() => {
    return notifications.slice(0, maxDisplayCount);
  }, [notifications, maxDisplayCount]);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Handle new notification alerts
   * Shows toast and plays sound when new notifications arrive
   */
  useEffect(() => {
    if (unreadCount > previousCountRef.current && previousCountRef.current > 0) {
      const newCount = unreadCount - previousCountRef.current;

      // Show toast notification
      if (showToastOnNew) {
        info(
          newCount === 1
            ? 'You have a new notification'
            : `You have ${newCount} new notifications`
        );
      }

      // Play notification sound if enabled
      if (enableSoundAlerts && audioRef.current) {
        audioRef.current.play().catch(() => {
          // Ignore audio play errors (e.g., user hasn't interacted with page)
        });
      }
    }

    previousCountRef.current = unreadCount;
  }, [unreadCount, showToastOnNew, enableSoundAlerts, info]);

  /**
   * Initialize audio element for sound alerts
   */
  useEffect(() => {
    if (enableSoundAlerts) {
      audioRef.current = new Audio('/sounds/notification.mp3');
      audioRef.current.volume = 0.5;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, [enableSoundAlerts]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Toggle popover open/close
   */
  const handleTogglePopover = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  /**
   * Close popover
   */
  const handleClosePopover = useCallback(() => {
    setIsOpen(false);
  }, []);

  /**
   * Handle keyboard navigation on icon button
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Escape' && isOpen) {
        handleClosePopover();
        anchorRef.current?.focus();
      }
    },
    [isOpen, handleClosePopover]
  );

  /**
   * Handle notification item click
   * Marks as read and navigates to relevant content
   */
  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      // Mark as read if unread
      if (notification.timeread === null) {
        markReadMutation.mutate(notification.id);
      }

      // Call custom click handler if provided
      onNotificationClick?.(notification);

      // Close popover
      handleClosePopover();

      // Navigate to relevant content
      const navPath = getNavigationPath(notification.contexturl);
      navigate(navPath);
    },
    [markReadMutation, onNotificationClick, handleClosePopover, navigate]
  );

  /**
   * Handle mark all as read button click
   */
  const handleMarkAllRead = useCallback(() => {
    markAllReadMutation.mutate();
  }, [markAllReadMutation]);

  /**
   * Handle clear all button click
   */
  const handleClearAll = useCallback(() => {
    clearAllMutation.mutate();
  }, [clearAllMutation]);

  /**
   * Handle tab change for filtering
   */
  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, newValue: NotificationFilterTab) => {
      setActiveTab(newValue);
    },
    []
  );

  /**
   * Handle view all click
   */
  const handleViewAll = useCallback(() => {
    handleClosePopover();
    navigate('/notifications');
  }, [handleClosePopover, navigate]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <>
      {/* Notification Bell Icon Button */}
      <Tooltip title={ariaLabel}>
        <IconButton
          ref={anchorRef}
          onClick={handleTogglePopover}
          onKeyDown={handleKeyDown}
          color="inherit"
          aria-label={ariaLabel}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-controls={isOpen ? 'notification-center-popover' : undefined}
          sx={{
            position: 'relative',
          }}
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            max={99}
            overlap="circular"
            aria-label={`${unreadCount} unread notifications`}
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.7rem',
                height: 18,
                minWidth: 18,
              },
            }}
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Notification Popover */}
      <Popover
        id="notification-center-popover"
        open={isOpen}
        anchorEl={anchorRef.current}
        onClose={handleClosePopover}
        anchorOrigin={POPOVER_ANCHOR_ORIGIN}
        transformOrigin={POPOVER_TRANSFORM_ORIGIN}
        slotProps={{
          paper: {
            sx: {
              width: 400,
              maxHeight: 500,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            },
            role: 'dialog',
            'aria-labelledby': 'notification-center-title',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography
            id="notification-center-title"
            variant="h6"
            component="h2"
            sx={{ fontWeight: 600 }}
          >
            Notifications
          </Typography>
          <IconButton
            size="small"
            onClick={handleClosePopover}
            aria-label="Close notification center"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Filter Tabs */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          aria-label="Notification filter tabs"
          sx={{
            minHeight: 40,
            borderBottom: `1px solid ${theme.palette.divider}`,
            '& .MuiTab-root': {
              minHeight: 40,
              py: 0,
              fontSize: '0.875rem',
            },
          }}
        >
          <Tab
            label="All"
            value="all"
            id="notification-tab-all"
            aria-controls="notification-tabpanel-all"
          />
          <Tab
            label="Unread"
            value="unread"
            id="notification-tab-unread"
            aria-controls="notification-tabpanel-unread"
          />
          <Tab
            label="Messages"
            value="messages"
            id="notification-tab-messages"
            aria-controls="notification-tabpanel-messages"
          />
        </Tabs>

        {/* Notification List */}
        <Box
          role="tabpanel"
          id={`notification-tabpanel-${activeTab}`}
          aria-labelledby={`notification-tab-${activeTab}`}
          sx={{
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {isLoading ? (
            // Loading skeleton
            <List disablePadding>
              {Array.from({ length: 5 }).map((_, index) => (
                <NotificationSkeleton key={`skeleton-${index}`} />
              ))}
            </List>
          ) : flatNotifications.length === 0 ? (
            // Empty state
            <EmptyNotifications />
          ) : activeTab === 'all' ? (
            // Grouped notifications for "all" tab
            <List
              disablePadding
              aria-label="Notifications list"
              sx={{ width: '100%' }}
            >
              {groupedNotifications.map((group, groupIndex) => (
                <React.Fragment key={group.type}>
                  {groupIndex > 0 && <Divider />}
                  <ListSubheader
                    component="div"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 0.5,
                      lineHeight: '36px',
                      bgcolor: alpha(theme.palette.background.default, 0.9),
                    }}
                  >
                    {group.icon}
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {group.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 'auto' }}
                    >
                      {group.notifications.length}
                    </Typography>
                  </ListSubheader>
                  {group.notifications.slice(0, 5).map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onRead={(id) => markReadMutation.mutate(id)}
                      onClick={handleNotificationClick}
                      isMarking={markReadMutation.isPending}
                    />
                  ))}
                </React.Fragment>
              ))}
            </List>
          ) : (
            // Flat list for filtered tabs
            <List
              disablePadding
              aria-label="Notifications list"
              sx={{ width: '100%' }}
            >
              {flatNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={(id) => markReadMutation.mutate(id)}
                  onClick={handleNotificationClick}
                  isMarking={markReadMutation.isPending}
                />
              ))}
            </List>
          )}
        </Box>

        {/* Footer Actions */}
        <Divider />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1,
            py: 1,
            bgcolor: alpha(theme.palette.background.default, 0.5),
          }}
        >
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              startIcon={<DoneAllIcon />}
              onClick={handleMarkAllRead}
              disabled={isAnyMutating || unreadCount === 0}
              sx={{ textTransform: 'none' }}
            >
              Mark All Read
            </Button>
            <Button
              size="small"
              startIcon={<DeleteSweepIcon />}
              onClick={handleClearAll}
              disabled={isAnyMutating || flatNotifications.length === 0}
              color="error"
              sx={{ textTransform: 'none' }}
            >
              Clear All
            </Button>
          </Box>
          <Button
            size="small"
            endIcon={<ChevronRightIcon />}
            onClick={handleViewAll}
            sx={{ textTransform: 'none' }}
          >
            View All
          </Button>
        </Box>
      </Popover>

      {/* Hidden live region for screen reader announcements */}
      <Box
        role="status"
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {unreadCount > 0 && `You have ${unreadCount} unread notifications`}
      </Box>
    </>
  );
}

// Default export for convenience
export default NotificationCenter;
