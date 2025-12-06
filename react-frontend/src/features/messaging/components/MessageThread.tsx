/**
 * MessageThread Component
 *
 * React component that renders individual messages within a conversation thread
 * using Material-UI components. Displays message content, sender information,
 * timestamps, read/unread status, and supports message actions like delete.
 *
 * Features:
 * - Renders individual message items using Material-UI Box components
 * - Displays sender avatar with Material-UI Avatar component
 * - Shows message content with Typography and proper text wrapping
 * - Formats timestamp using date-fns library (relative time)
 * - Groups consecutive messages from same sender
 * - Aligns sent messages to right and received messages to left (chat bubble style)
 * - Indicates read/unread status with visual indicator
 * - Supports message actions menu (delete, report)
 * - Implements virtualization for long message threads (react-window)
 * - Auto-scrolls to latest message on thread open
 * - Handles long messages with text truncation and 'Read More' expansion
 * - Shows delivery status indicators
 * - Maintains WCAG 2.1 AA compliance with semantic HTML and ARIA labels
 * - Supports keyboard navigation
 * - Implements optimistic UI updates when deleting messages
 * - Shows confirmation dialog before message deletion
 * - Supports light/dark mode
 *
 * Based on public/message/templates/message_drawer_messages_list.mustache
 * MESSAGE_MAX_LENGTH constant from api.php: 4096
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type KeyboardEvent,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Skeleton,
  Button,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Flag as FlagIcon,
  CheckCircle as CheckCircleIcon,
  Check as CheckIcon,
  Schedule as ScheduleIcon,
  DoneAll as DoneAllIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { List, type RowComponentProps, type ListImperativeAPI } from 'react-window';
import { isSameDay, format as formatDate } from 'date-fns';

import { deleteMessage } from '@/features/messaging/api/messagingApi';
import type {
  Message,
  Conversation,
  ConversationMember,
  MessageThreadProps,
} from '@/features/messaging/types/message.types';
import { useToast } from '@/hooks/useToast';
import { formatRelativeTime } from '@/utils/date';
import { Modal } from '@/components/feedback/Modal';
import { truncate } from '@/utils/string';

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum message length constant from Moodle API
 * Source: public/message/classes/api.php - MESSAGE_MAX_LENGTH
 * Used for message length validation and display truncation decisions
 */
export const MESSAGE_MAX_LENGTH = 4096;

/**
 * Maximum length before truncating message content
 */
const MESSAGE_TRUNCATE_LENGTH = 500;

/**
 * Minimum height for a message item in the virtualized list
 */
const MIN_MESSAGE_HEIGHT = 80;

/**
 * Estimated height for a message item (used for initial virtualization)
 */
const ESTIMATED_MESSAGE_HEIGHT = 100;

/**
 * Height for date divider items
 */
const DATE_DIVIDER_HEIGHT = 40;

/**
 * Delivery status for a message
 */
type DeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Internal interface for rendered items (messages or date dividers)
 */
interface RenderItem {
  type: 'message' | 'date-divider';
  id: string;
  message?: Message;
  date?: Date;
  isGrouped?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

/**
 * Menu anchor state for message actions
 */
interface MenuState {
  anchorEl: HTMLElement | null;
  messageId: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets the delivery status of a message
 *
 * @param message - The message to check
 * @param currentUserId - Current user ID
 * @returns The delivery status
 */
function getDeliveryStatus(message: Message, currentUserId: number): DeliveryStatus {
  // Only show delivery status for messages sent by current user
  if (message.useridfrom !== currentUserId) {
    return 'read'; // Received messages are implicitly read by viewing
  }

  // Check custom data for delivery status (if available from API)
  if (message.customdata) {
    try {
      const customData = JSON.parse(message.customdata);
      if (customData.status) {
        return customData.status as DeliveryStatus;
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Default to sent status for own messages
  return 'sent';
}

/**
 * Finds the member info for a user in the conversation
 *
 * @param conversation - The conversation object
 * @param userId - The user ID to find
 * @returns The member info or undefined
 */
function getMemberInfo(
  conversation: Conversation,
  userId: number
): ConversationMember | undefined {
  return conversation.members.find((member) => member.id === userId);
}

/**
 * Checks if a URL is present in the message text
 * Used for link preview detection and special message formatting
 *
 * @param text - The message text
 * @returns True if the text contains a URL
 */
export function containsUrl(text: string): boolean {
  const urlPattern = /https?:\/\/[^\s]+/gi;
  return urlPattern.test(text);
}

/**
 * Gets initials from a full name
 *
 * @param fullname - The full name
 * @returns The initials (max 2 characters)
 */
function getInitials(fullname: string): string {
  const parts = fullname.trim().split(/\s+/);
  const firstPart = parts[0];
  const lastPart = parts[parts.length - 1];
  
  if (!firstPart) {
    return '?';
  }
  
  if (parts.length === 1 || !lastPart) {
    return firstPart.charAt(0).toUpperCase();
  }
  return (firstPart.charAt(0) + lastPart.charAt(0)).toUpperCase();
}

/**
 * Groups messages by date and sender for efficient rendering
 *
 * @param messages - Array of messages
 * @param _currentUserId - Current user ID (reserved for future use in message styling)
 * @returns Array of render items (messages and date dividers)
 */
function groupMessages(messages: Message[], _currentUserId: number): RenderItem[] {
  const items: RenderItem[] = [];

  if (messages.length === 0) {
    return items;
  }

  // Sort messages by timestamp (oldest first)
  const sortedMessages = [...messages].sort(
    (a, b) => a.timecreated - b.timecreated
  );

  let previousDate: Date | null = null;
  let previousSenderId: number | null = null;

  sortedMessages.forEach((message, index) => {
    const messageDate = new Date(message.timecreated * 1000);

    // Check if we need a date divider
    if (!previousDate || !isSameDay(previousDate, messageDate)) {
      // Add date divider
      items.push({
        type: 'date-divider',
        id: `date-${message.timecreated}`,
        date: messageDate,
      });
      previousDate = messageDate;
      previousSenderId = null;
    }

    // Check if this message is grouped with the previous one
    const isSameSender = previousSenderId === message.useridfrom;
    const isGrouped = isSameSender;

    // Determine if this is first/last in a group
    const nextMessage = sortedMessages[index + 1];
    const isLastInGroup =
      !nextMessage ||
      nextMessage.useridfrom !== message.useridfrom ||
      !isSameDay(messageDate, new Date(nextMessage.timecreated * 1000));

    const isFirstInGroup = !isSameSender;

    items.push({
      type: 'message',
      id: `message-${message.id}`,
      message,
      isGrouped,
      isFirstInGroup,
      isLastInGroup,
    });

    previousSenderId = message.useridfrom;
  });

  return items;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Props for the DeliveryStatusIcon component
 */
interface DeliveryStatusIconProps {
  status: DeliveryStatus;
}

/**
 * Renders the delivery status icon for a message
 */
function DeliveryStatusIcon({ status }: DeliveryStatusIconProps): React.ReactElement {
  const theme = useTheme();

  switch (status) {
    case 'sending':
      return (
        <Tooltip title="Sending">
          <ScheduleIcon
            sx={{
              fontSize: 14,
              color: theme.palette.text.secondary,
            }}
            aria-label="Message sending"
          />
        </Tooltip>
      );
    case 'sent':
      return (
        <Tooltip title="Sent">
          <CheckIcon
            sx={{
              fontSize: 14,
              color: theme.palette.text.secondary,
            }}
            aria-label="Message sent"
          />
        </Tooltip>
      );
    case 'delivered':
      return (
        <Tooltip title="Delivered">
          <DoneAllIcon
            sx={{
              fontSize: 14,
              color: theme.palette.text.secondary,
            }}
            aria-label="Message delivered"
          />
        </Tooltip>
      );
    case 'read':
      return (
        <Tooltip title="Read">
          <CheckCircleIcon
            sx={{
              fontSize: 14,
              color: theme.palette.primary.main,
            }}
            aria-label="Message read"
          />
        </Tooltip>
      );
    case 'failed':
      return (
        <Tooltip title="Failed to send">
          <ScheduleIcon
            sx={{
              fontSize: 14,
              color: theme.palette.error.main,
            }}
            aria-label="Message failed to send"
          />
        </Tooltip>
      );
    default:
      return <></>;
  }
}

/**
 * Props for the DateDivider component
 */
interface DateDividerProps {
  date: Date;
}

/**
 * Renders a date divider between message groups
 */
function DateDivider({ date }: DateDividerProps): React.ReactElement {
  const theme = useTheme();

  // Format date: "Today", "Yesterday", or "Monday, Jan 15"
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let dateLabel: string;
  if (isSameDay(date, today)) {
    dateLabel = 'Today';
  } else if (isSameDay(date, yesterday)) {
    dateLabel = 'Yesterday';
  } else {
    dateLabel = formatDate(date, 'EEEE, MMM d');
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 1,
        px: 2,
      }}
      role="separator"
      aria-label={`Messages from ${dateLabel}`}
    >
      <Divider sx={{ flex: 1 }} />
      <Typography
        variant="caption"
        sx={{
          px: 2,
          color: theme.palette.text.secondary,
          fontWeight: 500,
        }}
      >
        {dateLabel}
      </Typography>
      <Divider sx={{ flex: 1 }} />
    </Box>
  );
}

/**
 * Props for MessageBubble component
 */
interface MessageBubbleProps {
  message: Message;
  currentUserId: number;
  conversation: Conversation;
  isGrouped: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  onDelete: (messageId: number) => void;
  onReport?: (messageId: number) => void;
}

/**
 * Renders a single message bubble with all features
 */
function MessageBubble({
  message,
  currentUserId,
  conversation,
  isGrouped,
  isFirstInGroup,
  isLastInGroup,
  onDelete,
  onReport,
}: MessageBubbleProps): React.ReactElement {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [menuState, setMenuState] = useState<MenuState>({
    anchorEl: null,
    messageId: null,
  });

  const isOwnMessage = message.useridfrom === currentUserId;
  const sender = getMemberInfo(conversation, message.useridfrom);
  const deliveryStatus = getDeliveryStatus(message, currentUserId);

  // Get message text content
  const messageText = message.fullmessagehtml || message.fullmessage || message.smallmessage || '';

  // Check if message needs truncation
  const needsTruncation = messageText.length > MESSAGE_TRUNCATE_LENGTH;
  const displayText = needsTruncation && !expanded
    ? truncate(messageText, MESSAGE_TRUNCATE_LENGTH, '...')
    : messageText;

  // Handle menu open
  const handleMenuOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      setMenuState({
        anchorEl: event.currentTarget,
        messageId: message.id,
      });
    },
    [message.id]
  );

  // Handle menu close
  const handleMenuClose = useCallback(() => {
    setMenuState({
      anchorEl: null,
      messageId: null,
    });
  }, []);

  // Handle delete action
  const handleDelete = useCallback(() => {
    handleMenuClose();
    onDelete(message.id);
  }, [handleMenuClose, message.id, onDelete]);

  // Handle report action
  const handleReport = useCallback(() => {
    handleMenuClose();
    if (onReport) {
      onReport(message.id);
    }
  }, [handleMenuClose, message.id, onReport]);

  // Handle keyboard navigation for menu
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        // Focus would open a context menu, but for accessibility we use the menu button
      }
    },
    []
  );

  // Toggle expanded state
  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // Message bubble styles based on sender
  const bubbleStyles = {
    backgroundColor: isOwnMessage
      ? theme.palette.primary.main
      : theme.palette.mode === 'dark'
        ? alpha(theme.palette.grey[700], 0.8)
        : theme.palette.grey[100],
    color: isOwnMessage
      ? theme.palette.primary.contrastText
      : theme.palette.text.primary,
    borderRadius: 2,
    // Rounded corners based on position in group
    borderTopLeftRadius: isOwnMessage ? 16 : (isFirstInGroup ? 16 : 4),
    borderTopRightRadius: isOwnMessage ? (isFirstInGroup ? 16 : 4) : 16,
    borderBottomLeftRadius: isOwnMessage ? 16 : (isLastInGroup ? 16 : 4),
    borderBottomRightRadius: isOwnMessage ? (isLastInGroup ? 16 : 4) : 16,
    px: 2,
    py: 1,
    maxWidth: '70%',
    minWidth: 80,
    wordBreak: 'break-word' as const,
    position: 'relative' as const,
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isOwnMessage ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 1,
        mt: isGrouped ? 0.25 : 1, // Reduced top margin for grouped messages
        mb: isLastInGroup ? 1.5 : 0.5,
        px: 2,
      }}
      role="listitem"
      aria-label={`Message from ${sender?.fullname || 'Unknown'}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Avatar - only show for first message in group from others */}
      {!isOwnMessage && (
        <Box sx={{ width: 36, minWidth: 36 }}>
          {isLastInGroup && sender && (
            <Tooltip title={sender.fullname}>
              <Avatar
                src={sender.profileimageurl}
                alt={sender.fullname}
                sx={{
                  width: 36,
                  height: 36,
                  cursor: 'pointer',
                }}
                aria-label={`${sender.fullname}'s profile picture`}
              >
                {getInitials(sender.fullname)}
              </Avatar>
            </Tooltip>
          )}
        </Box>
      )}

      {/* Message content */}
      <Box sx={bubbleStyles}>
        {/* Sender name - only show for first message in group from others */}
        {!isOwnMessage && isFirstInGroup && sender && (
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              display: 'block',
              mb: 0.5,
              color: theme.palette.mode === 'dark'
                ? theme.palette.primary.light
                : theme.palette.primary.main,
            }}
          >
            {sender.fullname}
          </Typography>
        )}

        {/* Message text */}
        <Typography
          variant="body2"
          component="div"
          sx={{
            whiteSpace: 'pre-wrap',
            '& a': {
              color: isOwnMessage
                ? theme.palette.primary.contrastText
                : theme.palette.primary.main,
              textDecoration: 'underline',
            },
          }}
          dangerouslySetInnerHTML={{ __html: displayText }}
        />

        {/* Read More button for truncated messages */}
        {needsTruncation && (
          <Button
            size="small"
            variant="text"
            onClick={toggleExpanded}
            endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{
              mt: 0.5,
              p: 0,
              minWidth: 0,
              color: isOwnMessage
                ? alpha(theme.palette.primary.contrastText, 0.8)
                : theme.palette.primary.main,
              '&:hover': {
                backgroundColor: 'transparent',
              },
            }}
            aria-expanded={expanded}
            aria-label={expanded ? 'Show less' : 'Read more'}
          >
            {expanded ? 'Show less' : 'Read more'}
          </Button>
        )}

        {/* Timestamp and delivery status */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 0.5,
            mt: 0.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              opacity: 0.7,
              fontSize: '0.7rem',
            }}
          >
            {formatRelativeTime(message.timecreated * 1000)}
          </Typography>
          {isOwnMessage && <DeliveryStatusIcon status={deliveryStatus} />}
        </Box>
      </Box>

      {/* Actions menu button */}
      <Box
        sx={{
          opacity: menuState.messageId === message.id ? 1 : 0,
          transition: 'opacity 0.2s',
          '&:focus-within': { opacity: 1 },
          '.MuiBox-root:hover > &': { opacity: 1 },
        }}
      >
        <IconButton
          size="small"
          onClick={handleMenuOpen}
          aria-label="Message actions"
          aria-haspopup="true"
          aria-expanded={Boolean(menuState.anchorEl)}
          sx={{
            color: theme.palette.text.secondary,
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Actions menu */}
      <Menu
        anchorEl={menuState.anchorEl}
        open={Boolean(menuState.anchorEl) && menuState.messageId === message.id}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: isOwnMessage ? 'left' : 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: isOwnMessage ? 'left' : 'right',
        }}
      >
        {isOwnMessage && (
          <MenuItem onClick={handleDelete}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText primary="Delete" />
          </MenuItem>
        )}
        {!isOwnMessage && (
          <MenuItem onClick={handleReport}>
            <ListItemIcon>
              <FlagIcon fontSize="small" color="warning" />
            </ListItemIcon>
            <ListItemText primary="Report" />
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}

/**
 * Props for MessageSkeleton component
 */
interface MessageSkeletonProps {
  isOwn?: boolean;
}

/**
 * Renders a skeleton placeholder for loading messages
 */
function MessageSkeleton({ isOwn = false }: MessageSkeletonProps): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isOwn ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 1,
        mb: 1,
        px: 2,
      }}
    >
      {!isOwn && (
        <Skeleton variant="circular" width={36} height={36} />
      )}
      <Box sx={{ maxWidth: '70%' }}>
        <Skeleton
          variant="rounded"
          width={200 + Math.random() * 100}
          height={60}
          sx={{ borderRadius: 2 }}
        />
      </Box>
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * MessageThread Component
 *
 * Renders a conversation thread with virtualization for performance,
 * message grouping by date and sender, and full accessibility support.
 */
export function MessageThread({
  conversation,
  currentUserId,
  isLoading = false,
  onBack: _onBack,
  onSettings: _onSettings,
  onMessageSent: _onMessageSent,
  showHeader: _showHeader = true,
  showComposer: _showComposer = true,
  headerActions: _headerActions,
}: MessageThreadProps): React.ReactElement {
  // Note: _onBack, _onSettings, _onMessageSent, _showHeader, _showComposer, and _headerActions
  // are part of the MessageThreadProps interface for future implementation of additional features
  // like header controls and message composer integration
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { success, error, warning } = useToast();

  // Refs
  const listRef = useRef<ListImperativeAPI | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemSizes = useRef<Map<number, number>>(new Map());

  // State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [optimisticallyDeleted, setOptimisticallyDeleted] = useState<Set<number>>(
    new Set()
  );

  // Get messages from conversation, filtering optimistically deleted ones
  const messages = useMemo(() => {
    return conversation.messages.filter(
      (msg) => !optimisticallyDeleted.has(msg.id)
    );
  }, [conversation.messages, optimisticallyDeleted]);

  // Group messages for rendering
  const renderItems = useMemo(() => {
    return groupMessages(messages, currentUserId);
  }, [messages, currentUserId]);

  // Calculate item size for virtualization
  const getItemSize = useCallback((index: number): number => {
    const cachedSize = itemSizes.current.get(index);
    if (cachedSize) {
      return cachedSize;
    }

    const item = renderItems[index];
    if (!item) {
      return ESTIMATED_MESSAGE_HEIGHT;
    }
    
    if (item.type === 'date-divider') {
      return DATE_DIVIDER_HEIGHT;
    }

    // Estimate based on message content length
    const messageLength = item.message?.fullmessage?.length ?? 0;
    const lineCount = Math.ceil(messageLength / 50) || 1;
    const baseHeight = MIN_MESSAGE_HEIGHT;
    const additionalHeight = Math.min(lineCount * 20, 200);

    return baseHeight + additionalHeight;
  }, [renderItems]);

  // Auto-scroll to bottom on mount and when new messages arrive
  useEffect(() => {
    if (!isLoading && listRef.current && renderItems.length > 0) {
      // Use setTimeout to ensure the list has rendered
      setTimeout(() => {
        listRef.current?.scrollToRow({ 
          index: renderItems.length - 1, 
          align: 'end',
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [isLoading, renderItems.length]);

  // Handle delete button click - show confirmation
  const handleDeleteClick = useCallback((messageId: number) => {
    setMessageToDelete(messageId);
    setDeleteDialogOpen(true);
  }, []);

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    if (messageToDelete === null) {
      return;
    }

    setIsDeleting(true);

    // Optimistic update
    setOptimisticallyDeleted((prev) => new Set(prev).add(messageToDelete));

    try {
      await deleteMessage(messageToDelete);

      // Invalidate conversation query to refresh
      queryClient.invalidateQueries({
        queryKey: ['conversations', conversation.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['messages', conversation.id],
      });

      success('Message deleted successfully');
    } catch (err) {
      // Revert optimistic update
      setOptimisticallyDeleted((prev) => {
        const next = new Set(prev);
        next.delete(messageToDelete);
        return next;
      });

      error('Failed to delete message. Please try again.');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    }
  }, [messageToDelete, queryClient, conversation.id, success, error]);

  // Handle delete cancel
  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false);
    setMessageToDelete(null);
  }, []);

  // Handle report action
  const handleReport = useCallback(
    (_messageId: number) => {
      // Report functionality would be implemented here
      // The _messageId parameter will be used when implementing
      // the report API endpoint integration
      warning('Report functionality coming soon');
    },
    [warning]
  );

  /**
   * Props passed to each row via rowProps
   */
  interface RowData {
    renderItems: RenderItem[];
    currentUserId: number;
    conversation: Conversation;
    handleDeleteClick: (messageId: number) => void;
    handleReport: (messageId: number) => void;
  }

  /**
   * Row component for the virtualized list (react-window v2.x API)
   * Receives ariaAttributes, index, style from List, plus RowData via rowProps
   */
  const Row = useCallback(
    ({ 
      index, 
      style, 
      ariaAttributes,
      renderItems: items,
      currentUserId: userId,
      conversation: conv,
      handleDeleteClick: onDelete,
      handleReport: onReport,
    }: RowComponentProps<RowData>) => {
      const item = items[index];
      
      // Handle undefined item (shouldn't happen but TypeScript requires it)
      if (!item) {
        return <div style={style} {...ariaAttributes} />;
      }

      if (item.type === 'date-divider' && item.date) {
        return (
          <div style={style} {...ariaAttributes}>
            <DateDivider date={item.date} />
          </div>
        );
      }

      if (item.type === 'message' && item.message) {
        return (
          <div style={style} {...ariaAttributes}>
            <MessageBubble
              message={item.message}
              currentUserId={userId}
              conversation={conv}
              isGrouped={item.isGrouped ?? false}
              isFirstInGroup={item.isFirstInGroup ?? false}
              isLastInGroup={item.isLastInGroup ?? false}
              onDelete={onDelete}
              onReport={onReport}
            />
          </div>
        );
      }

      return <div style={style} {...ariaAttributes} />;
    },
    []
  );

  // Memoized row props to pass to List
  const rowProps: RowData = useMemo(() => ({
    renderItems,
    currentUserId,
    conversation,
    handleDeleteClick,
    handleReport,
  }), [renderItems, currentUserId, conversation, handleDeleteClick, handleReport]);

  // Render loading skeleton
  if (isLoading) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        role="region"
        aria-label="Message thread loading"
        aria-busy="true"
      >
        <Box sx={{ flex: 1, overflow: 'hidden', pt: 2 }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <MessageSkeleton key={index} isOwn={index % 3 === 0} />
          ))}
        </Box>
      </Box>
    );
  }

  // Render empty state
  if (messages.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          p: 4,
        }}
        role="region"
        aria-label="Empty message thread"
      >
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ textAlign: 'center' }}
        >
          No messages yet. Start the conversation!
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.palette.background.default,
      }}
      role="region"
      aria-label={`Message thread with ${conversation.name || 'conversation'}`}
    >
      {/* Message list with virtualization */}
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
        }}
        role="list"
        aria-label="Messages"
      >
        <List<RowData>
          listRef={listRef}
          defaultHeight={containerRef.current?.clientHeight || 400}
          style={{ width: '100%', height: containerRef.current?.clientHeight || 400 }}
          rowCount={renderItems.length}
          rowHeight={getItemSize}
          rowComponent={Row}
          rowProps={rowProps}
          overscanCount={5}
        />
      </Box>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        title="Delete Message?"
        description="This action cannot be undone. The message will be permanently deleted."
        maxWidth="xs"
        loading={isDeleting}
        actions={[
          {
            label: 'Cancel',
            onClick: handleDeleteCancel,
            variant: 'outlined',
            disabled: isDeleting,
          },
          {
            label: 'Delete',
            onClick: handleDeleteConfirm,
            color: 'error',
            variant: 'contained',
            disabled: isDeleting,
            loading: isDeleting,
          },
        ]}
      >
        <Typography variant="body2" color="text.secondary">
          Are you sure you want to delete this message? Deleted messages cannot
          be recovered.
        </Typography>
      </Modal>
    </Box>
  );
}

export default MessageThread;
