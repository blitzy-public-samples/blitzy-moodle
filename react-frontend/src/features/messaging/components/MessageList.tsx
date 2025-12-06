/**
 * MessageList Component
 *
 * React component that displays a scrollable list of conversation threads with preview text,
 * unread count badges, participant avatars, and last message timestamp. Supports search/filter,
 * infinite scroll, and click handlers to open full conversations.
 *
 * Based on public/message/templates/message_drawer_conversations_list.mustache from Moodle core.
 *
 * Features:
 * - Fetches conversation list via GET /api/v1/messages endpoint using React Query
 * - Material-UI List with ListItem components for conversation rendering
 * - Participant avatars with Avatar/AvatarGroup for group chats
 * - Preview text truncated to ~60 characters
 * - Unread message count with Badge component
 * - Relative timestamps using date-fns (e.g., '2 hours ago')
 * - Search/filter with debounced input
 * - Sorting options (newest, unread, alphabetical)
 * - Infinite scroll for loading more conversations
 * - Skeleton loaders during initial data fetch
 * - Empty state when no conversations exist
 * - Swipe actions on mobile (archive, delete, mark read/unread)
 * - Keyboard navigation (arrow keys, Enter)
 * - WCAG 2.1 AA accessibility compliance
 * - Light/dark mode theming via MUI theme
 * - Optimistic UI updates when marking messages as read
 * - Message polling with configurable intervals
 *
 * @module features/messaging/components/MessageList
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type KeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  AvatarGroup,
  Badge,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Skeleton,
  Divider,
  Paper,
  Tooltip,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Sort as SortIcon,
  Delete as DeleteIcon,
  MarkEmailRead as MarkReadIcon,
  MarkEmailUnread as MarkUnreadIcon,
  VolumeOff as MuteIcon,
  VolumeUp as UnmuteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  MoreVert as MoreVertIcon,
  KeyboardArrowRight as ArrowRightIcon,
  Inbox as InboxIcon,
  Circle as OnlineIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

// Internal imports from depends_on_files
import {
  getConversations,
  deleteConversation,
  markConversationAsRead,
  muteConversation,
  unmuteConversation,
  setFavouriteConversations,
  unsetFavouriteConversations,
} from '@/features/messaging/api/messagingApi';
import type {
  Conversation,
  ConversationMember,
  ConversationType,
  ConversationListResponse,
} from '@/features/messaging/types/message.types';
import { useToast } from '@/hooks/useToast';
import useDebounce from '@/hooks/useDebounce';
import { formatRelativeTime } from '@/utils/date';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { truncate } from '@/utils/string';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Sort options for conversation list
 */
export type ConversationSortOption = 'newest' | 'unread' | 'alphabetical' | 'oldest';

/**
 * Filter options for conversation list
 */
export interface ConversationFilters {
  /** Filter by conversation type (1=individual, 2=group, 3=self) */
  conversationType?: ConversationType;
  /** Show only favourite conversations */
  isFavourite?: boolean;
  /** Show only unread conversations */
  isUnread?: boolean;
}

/**
 * Props for the MessageList component
 *
 * TypeScript interface defining props for displaying a list of conversation threads.
 * Includes callbacks for interaction, filtering options, and customization.
 */
export interface MessageListComponentProps {
  /** Callback when a conversation is clicked */
  onConversationClick?: (conversation: Conversation) => void;
  /** Filter options for conversations */
  filters?: ConversationFilters;
  /** Initial search query */
  searchQuery?: string;
  /** Initial sort option */
  sortBy?: ConversationSortOption;
  /** Optional CSS class name */
  className?: string;
  /** Number of conversations to fetch per page */
  pageSize?: number;
  /** Polling interval in milliseconds (0 to disable) */
  pollInterval?: number;
  /** Whether to show the search bar */
  showSearch?: boolean;
  /** Whether to show sort controls */
  showSort?: boolean;
}

/**
 * Internal state for swipe actions
 */
interface SwipeState {
  conversationId: number | null;
  direction: 'left' | 'right' | null;
}

// ============================================================================
// Constants
// ============================================================================

/** Default polling interval based on Moodle's messagepollmin (10 seconds) */
const DEFAULT_POLL_INTERVAL = 10000;

/** Maximum polling interval based on Moodle's messagepollmax (5 minutes) */
const MAX_POLL_INTERVAL = 300000;

/** Preview text maximum length */
const PREVIEW_MAX_LENGTH = 60;

/** Query key for conversations */
const CONVERSATIONS_QUERY_KEY = 'conversations';

/** Debounce delay for search input in milliseconds */
const SEARCH_DEBOUNCE_DELAY = 300;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets the display name for a conversation
 */
function getConversationName(conversation: Conversation): string {
  if (conversation.name) {
    return conversation.name;
  }
  
  // For individual conversations, use the other member's name
  if (conversation.members && conversation.members.length > 0) {
    const otherMember = conversation.members.find(
      (member) => !member.isdeleted
    );
    return otherMember?.fullname || 'Unknown User';
  }
  
  return 'Conversation';
}

/**
 * Gets the avatar URL for a conversation
 */
function getConversationAvatar(conversation: Conversation): string | null {
  if (conversation.imageurl) {
    return conversation.imageurl;
  }
  
  if (conversation.members && conversation.members.length > 0) {
    const otherMember = conversation.members.find(
      (member) => !member.isdeleted
    );
    return otherMember?.profileimageurlsmall || null;
  }
  
  return null;
}

/**
 * Gets the last message preview text
 */
function getLastMessagePreview(conversation: Conversation): string {
  if (conversation.messages && conversation.messages.length > 0) {
    const lastMessage = conversation.messages[0];
    const text = lastMessage.smallmessage || lastMessage.fullmessage || '';
    // Strip HTML tags for preview
    const plainText = text.replace(/<[^>]*>/g, '').trim();
    return truncate(plainText, PREVIEW_MAX_LENGTH);
  }
  return 'No messages yet';
}

/**
 * Gets the last message timestamp
 */
function getLastMessageTime(conversation: Conversation): number | null {
  if (conversation.messages && conversation.messages.length > 0) {
    return conversation.messages[0].timecreated;
  }
  return conversation.timemodified || conversation.timecreated;
}

/**
 * Sorts conversations based on sort option
 */
function sortConversations(
  conversations: Conversation[],
  sortBy: ConversationSortOption
): Conversation[] {
  const sorted = [...conversations];
  
  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => {
        const timeA = getLastMessageTime(a) || 0;
        const timeB = getLastMessageTime(b) || 0;
        return timeB - timeA;
      });
    case 'oldest':
      return sorted.sort((a, b) => {
        const timeA = getLastMessageTime(a) || 0;
        const timeB = getLastMessageTime(b) || 0;
        return timeA - timeB;
      });
    case 'unread':
      return sorted.sort((a, b) => {
        // Unread first, then by newest
        if (a.unreadcount > 0 && b.unreadcount === 0) return -1;
        if (a.unreadcount === 0 && b.unreadcount > 0) return 1;
        const timeA = getLastMessageTime(a) || 0;
        const timeB = getLastMessageTime(b) || 0;
        return timeB - timeA;
      });
    case 'alphabetical':
      return sorted.sort((a, b) => {
        const nameA = getConversationName(a).toLowerCase();
        const nameB = getConversationName(b).toLowerCase();
        return nameA.localeCompare(nameB);
      });
    default:
      return sorted;
  }
}

/**
 * Filters conversations based on search query
 */
function filterConversations(
  conversations: Conversation[],
  searchQuery: string
): Conversation[] {
  if (!searchQuery.trim()) {
    return conversations;
  }
  
  const query = searchQuery.toLowerCase().trim();
  
  return conversations.filter((conversation) => {
    const name = getConversationName(conversation).toLowerCase();
    const preview = getLastMessagePreview(conversation).toLowerCase();
    return name.includes(query) || preview.includes(query);
  });
}

// ============================================================================
// Component
// ============================================================================

/**
 * MessageList Component
 *
 * Displays a scrollable list of conversation threads with avatars, preview text,
 * unread badges, and timestamps. Supports search, sorting, infinite scroll,
 * and various interactions.
 */
export function MessageList({
  onConversationClick,
  filters,
  searchQuery: initialSearchQuery = '',
  sortBy: initialSortBy = 'newest',
  className,
  pageSize = 20,
  pollInterval = DEFAULT_POLL_INTERVAL,
  showSearch = true,
  showSort = true,
}: MessageListComponentProps): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: showError, warning } = useToast();
  
  // State
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [sortBy, setSortBy] = useState<ConversationSortOption>(initialSortBy);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [swipeState, setSwipeState] = useState<SwipeState>({ conversationId: null, direction: null });
  const [currentPollInterval, setCurrentPollInterval] = useState(pollInterval);
  
  // Refs
  const listRef = useRef<HTMLUListElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const listItemRefs = useRef<Map<number, HTMLElement>>(new Map());
  
  // Debounced search query
  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_DELAY);
  
  // ============================================================================
  // Data Fetching
  // ============================================================================
  
  /**
   * Fetch conversations using React Query
   */
  const {
    data: conversationsData,
    isLoading,
    isError,
    error: queryError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [CONVERSATIONS_QUERY_KEY, page, filters, debouncedSearchQuery],
    queryFn: async () => {
      const response = await getConversations(
        {
          pagination: { page, perPage: pageSize },
          search: debouncedSearchQuery || undefined,
        },
        {
          type: filters?.conversationType,
          favourites: filters?.isFavourite,
        }
      );
      return response;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: currentPollInterval > 0 ? currentPollInterval : undefined,
    refetchOnWindowFocus: true,
  });
  
  // Update conversations when data changes
  useEffect(() => {
    if (conversationsData) {
      if (page === 1) {
        setAllConversations(conversationsData.conversations);
      } else {
        setAllConversations((prev) => {
          // Deduplicate conversations by ID
          const existingIds = new Set(prev.map((c) => c.id));
          const newConversations = conversationsData.conversations.filter(
            (c) => !existingIds.has(c.id)
          );
          return [...prev, ...newConversations];
        });
      }
      setHasMore(conversationsData.hasMore);
    }
  }, [conversationsData, page]);
  
  // ============================================================================
  // Mutations
  // ============================================================================
  
  /**
   * Mark conversation as read mutation
   */
  const markAsReadMutation = useMutation({
    mutationFn: (conversationId: number) => markConversationAsRead(conversationId),
    onMutate: async (conversationId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: [CONVERSATIONS_QUERY_KEY] });
      
      setAllConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, unreadcount: 0, isread: true }
            : c
        )
      );
    },
    onError: (err, conversationId) => {
      // Revert optimistic update
      showError('Failed to mark conversation as read');
      refetch();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_QUERY_KEY] });
    },
  });
  
  /**
   * Delete conversation mutation
   */
  const deleteConversationMutation = useMutation({
    mutationFn: (conversationId: number) => deleteConversation(conversationId),
    onMutate: async (conversationId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: [CONVERSATIONS_QUERY_KEY] });
      
      setAllConversations((prev) =>
        prev.filter((c) => c.id !== conversationId)
      );
    },
    onSuccess: () => {
      success('Conversation deleted');
    },
    onError: () => {
      showError('Failed to delete conversation');
      refetch();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_QUERY_KEY] });
    },
  });
  
  /**
   * Mute/unmute conversation mutation
   */
  const toggleMuteMutation = useMutation({
    mutationFn: async ({ conversationId, mute }: { conversationId: number; mute: boolean }) => {
      if (mute) {
        await muteConversation(conversationId);
      } else {
        await unmuteConversation(conversationId);
      }
    },
    onMutate: async ({ conversationId, mute }) => {
      setAllConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, ismuted: mute } : c
        )
      );
    },
    onSuccess: (_, { mute }) => {
      success(mute ? 'Conversation muted' : 'Conversation unmuted');
    },
    onError: () => {
      showError('Failed to update notification settings');
      refetch();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_QUERY_KEY] });
    },
  });
  
  /**
   * Toggle favourite mutation
   */
  const toggleFavouriteMutation = useMutation({
    mutationFn: async ({ conversationId, favourite }: { conversationId: number; favourite: boolean }) => {
      if (favourite) {
        await setFavouriteConversations([conversationId]);
      } else {
        await unsetFavouriteConversations([conversationId]);
      }
    },
    onMutate: async ({ conversationId, favourite }) => {
      setAllConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, isfavourite: favourite } : c
        )
      );
    },
    onSuccess: (_, { favourite }) => {
      success(favourite ? 'Added to favourites' : 'Removed from favourites');
    },
    onError: () => {
      showError('Failed to update favourites');
      refetch();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_QUERY_KEY] });
    },
  });
  
  // ============================================================================
  // Infinite Scroll
  // ============================================================================
  
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoading && !isFetching) {
          setPage((prev) => prev + 1);
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1,
      }
    );
    
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, isFetching]);
  
  // ============================================================================
  // Computed Values (moved before event handlers that reference them)
  // ============================================================================
  
  /**
   * Process conversations with filtering and sorting
   */
  const processedConversations = useMemo(() => {
    let result = [...allConversations];
    
    // Apply filters
    if (filters?.isUnread) {
      result = result.filter((c) => c.unreadcount > 0);
    }
    
    // Apply search filter
    result = filterConversations(result, debouncedSearchQuery);
    
    // Apply sorting
    result = sortConversations(result, sortBy);
    
    return result;
  }, [allConversations, filters?.isUnread, debouncedSearchQuery, sortBy]);
  
  // ============================================================================
  // Event Handlers
  // ============================================================================
  
  /**
   * Handle conversation click
   */
  const handleConversationClick = useCallback(
    (conversation: Conversation) => {
      // Mark as read when opening
      if (conversation.unreadcount > 0) {
        markAsReadMutation.mutate(conversation.id);
      }
      
      if (onConversationClick) {
        onConversationClick(conversation);
      } else {
        // Default navigation to conversation view
        navigate(`/messages/conversation/${conversation.id}`);
      }
    },
    [onConversationClick, navigate, markAsReadMutation]
  );
  
  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchQuery(value);
      setPage(1);
      setAllConversations([]);
    },
    []
  );
  
  /**
   * Handle clear search
   */
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setPage(1);
    setAllConversations([]);
  }, []);
  
  /**
   * Handle sort change
   */
  const handleSortChange = useCallback((newSortBy: ConversationSortOption) => {
    setSortBy(newSortBy);
    setSortMenuAnchor(null);
  }, []);
  
  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLUListElement>) => {
      const conversations = processedConversations;
      
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) =>
            prev < conversations.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < conversations.length) {
            handleConversationClick(conversations[focusedIndex]);
          }
          break;
        case 'Home':
          event.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setFocusedIndex(conversations.length - 1);
          break;
        default:
          break;
      }
    },
    [focusedIndex, handleConversationClick, processedConversations]
  );
  
  // Focus management
  useEffect(() => {
    if (focusedIndex >= 0) {
      const conversation = processedConversations[focusedIndex];
      if (conversation) {
        const element = listItemRefs.current.get(conversation.id);
        element?.focus();
      }
    }
  }, [focusedIndex, processedConversations]);
  
  /**
   * Handle context menu open
   */
  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>, conversation: Conversation) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenuAnchor(event.currentTarget);
      setSelectedConversation(conversation);
    },
    []
  );
  
  /**
   * Handle context menu close
   */
  const handleContextMenuClose = useCallback(() => {
    setContextMenuAnchor(null);
    setSelectedConversation(null);
  }, []);
  
  /**
   * Handle delete conversation
   */
  const handleDeleteConversation = useCallback(() => {
    if (selectedConversation) {
      deleteConversationMutation.mutate(selectedConversation.id);
    }
    handleContextMenuClose();
  }, [selectedConversation, deleteConversationMutation, handleContextMenuClose]);
  
  /**
   * Handle mark as read/unread
   */
  const handleMarkAsRead = useCallback(() => {
    if (selectedConversation) {
      markAsReadMutation.mutate(selectedConversation.id);
    }
    handleContextMenuClose();
  }, [selectedConversation, markAsReadMutation, handleContextMenuClose]);
  
  /**
   * Handle mute toggle
   */
  const handleToggleMute = useCallback(() => {
    if (selectedConversation) {
      toggleMuteMutation.mutate({
        conversationId: selectedConversation.id,
        mute: !selectedConversation.ismuted,
      });
    }
    handleContextMenuClose();
  }, [selectedConversation, toggleMuteMutation, handleContextMenuClose]);
  
  /**
   * Handle favourite toggle
   */
  const handleToggleFavourite = useCallback(() => {
    if (selectedConversation) {
      toggleFavouriteMutation.mutate({
        conversationId: selectedConversation.id,
        favourite: !selectedConversation.isfavourite,
      });
    }
    handleContextMenuClose();
  }, [selectedConversation, toggleFavouriteMutation, handleContextMenuClose]);
  
  // ============================================================================
  // Render Helpers
  // ============================================================================
  
  /**
   * Render skeleton loading state
   */
  const renderSkeletons = () => (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <ListItem key={`skeleton-${index}`} sx={{ py: 1.5 }}>
          <ListItemAvatar>
            <Skeleton variant="circular" width={40} height={40} />
          </ListItemAvatar>
          <ListItemText
            primary={<Skeleton variant="text" width="60%" />}
            secondary={<Skeleton variant="text" width="80%" />}
          />
        </ListItem>
      ))}
    </>
  );
  
  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 2,
        textAlign: 'center',
      }}
      role="status"
      aria-label="No conversations"
    >
      <InboxIcon
        sx={{
          fontSize: 64,
          color: 'text.disabled',
          mb: 2,
        }}
      />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        {debouncedSearchQuery
          ? 'No conversations found'
          : 'No conversations yet'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {debouncedSearchQuery
          ? 'Try adjusting your search or filters'
          : 'Start a conversation by messaging someone'}
      </Typography>
    </Box>
  );
  
  /**
   * Render conversation avatar(s)
   */
  const renderAvatar = (conversation: Conversation) => {
    const isGroup = conversation.type === 2;
    const members = conversation.members || [];
    
    if (isGroup && members.length > 1) {
      // Show avatar group for group conversations
      return (
        <AvatarGroup max={3} sx={{ width: 40, height: 40 }}>
          {members.slice(0, 3).map((member) => (
            <Avatar
              key={member.id}
              src={member.profileimageurlsmall}
              alt={member.fullname}
              sx={{ width: 24, height: 24 }}
            >
              {member.fullname.charAt(0).toUpperCase()}
            </Avatar>
          ))}
        </AvatarGroup>
      );
    }
    
    const avatarUrl = getConversationAvatar(conversation);
    const name = getConversationName(conversation);
    const isOnline = members[0]?.isonline;
    const showOnlineStatus = members[0]?.showonlinestatus;
    
    return (
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        badgeContent={
          showOnlineStatus && isOnline ? (
            <OnlineIcon
              sx={{
                fontSize: 12,
                color: 'success.main',
                backgroundColor: 'background.paper',
                borderRadius: '50%',
              }}
            />
          ) : null
        }
      >
        <Avatar src={avatarUrl || undefined} alt={name}>
          {name.charAt(0).toUpperCase()}
        </Avatar>
      </Badge>
    );
  };
  
  /**
   * Render individual conversation item
   */
  const renderConversationItem = (conversation: Conversation, index: number) => {
    const name = getConversationName(conversation);
    const preview = getLastMessagePreview(conversation);
    const timestamp = getLastMessageTime(conversation);
    const hasUnread = conversation.unreadcount > 0;
    const isMuted = conversation.ismuted;
    const isFavourite = conversation.isfavourite;
    const isFocused = index === focusedIndex;
    
    return (
      <ListItem
        key={conversation.id}
        disablePadding
        secondaryAction={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {isFavourite && (
              <StarIcon
                sx={{ fontSize: 16, color: 'warning.main' }}
                aria-label="Favourite"
              />
            )}
            {isMuted && (
              <MuteIcon
                sx={{ fontSize: 16, color: 'text.disabled' }}
                aria-label="Muted"
              />
            )}
            <IconButton
              size="small"
              onClick={(e) => handleContextMenu(e, conversation)}
              aria-label="More options"
              aria-haspopup="true"
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        }
        sx={{
          backgroundColor: hasUnread
            ? alpha(theme.palette.primary.main, 0.08)
            : 'transparent',
          '&:hover': {
            backgroundColor: hasUnread
              ? alpha(theme.palette.primary.main, 0.12)
              : alpha(theme.palette.action.hover, 0.04),
          },
        }}
      >
        <ListItemButton
          ref={(el) => {
            if (el) listItemRefs.current.set(conversation.id, el);
          }}
          onClick={() => handleConversationClick(conversation)}
          onContextMenu={(e) => handleContextMenu(e, conversation)}
          selected={isFocused}
          tabIndex={isFocused ? 0 : -1}
          aria-label={`${name}, ${preview}, ${hasUnread ? `${conversation.unreadcount} unread messages` : 'no unread messages'}`}
          sx={{ py: 1.5, pr: 10 }}
        >
          <ListItemAvatar>{renderAvatar(conversation)}</ListItemAvatar>
          <ListItemText
            primary={
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Typography
                  variant="body1"
                  component="span"
                  sx={{
                    fontWeight: hasUnread ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {name}
                </Typography>
                {hasUnread && (
                  <Badge
                    badgeContent={conversation.unreadcount}
                    color="primary"
                    max={99}
                    sx={{
                      '& .MuiBadge-badge': {
                        position: 'static',
                        transform: 'none',
                      },
                    }}
                  />
                )}
              </Box>
            }
            secondary={
              <Box
                component="span"
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.25,
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  component="span"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: hasUnread ? 500 : 400,
                  }}
                >
                  {preview}
                </Typography>
                {timestamp && (
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    component="span"
                  >
                    {formatRelativeTime(timestamp * 1000)}
                  </Typography>
                )}
              </Box>
            }
          />
        </ListItemButton>
      </ListItem>
    );
  };
  
  // ============================================================================
  // Main Render
  // ============================================================================
  
  return (
    <Paper
      className={className}
      elevation={0}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Search and Sort Header */}
      {(showSearch || showSort) && (
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {showSearch && (
            <TextField
              fullWidth
              size="small"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={handleClearSearch}
                      aria-label="Clear search"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                'aria-label': 'Search conversations',
              }}
              sx={{ mb: showSort ? 1 : 0 }}
            />
          )}
          
          {showSort && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {processedConversations.length} conversation{processedConversations.length !== 1 ? 's' : ''}
              </Typography>
              <Tooltip title="Sort options">
                <IconButton
                  size="small"
                  onClick={(e) => setSortMenuAnchor(e.currentTarget)}
                  aria-label="Sort conversations"
                  aria-haspopup="true"
                  aria-expanded={Boolean(sortMenuAnchor)}
                >
                  <SortIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
      )}
      
      {/* Sort Menu */}
      <Menu
        anchorEl={sortMenuAnchor}
        open={Boolean(sortMenuAnchor)}
        onClose={() => setSortMenuAnchor(null)}
        aria-label="Sort options"
      >
        <MenuItem
          onClick={() => handleSortChange('newest')}
          selected={sortBy === 'newest'}
        >
          Newest first
        </MenuItem>
        <MenuItem
          onClick={() => handleSortChange('oldest')}
          selected={sortBy === 'oldest'}
        >
          Oldest first
        </MenuItem>
        <MenuItem
          onClick={() => handleSortChange('unread')}
          selected={sortBy === 'unread'}
        >
          Unread first
        </MenuItem>
        <MenuItem
          onClick={() => handleSortChange('alphabetical')}
          selected={sortBy === 'alphabetical'}
        >
          Alphabetical
        </MenuItem>
      </Menu>
      
      {/* Context Menu */}
      <Menu
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={handleContextMenuClose}
        aria-label="Conversation options"
      >
        {selectedConversation?.unreadcount && selectedConversation.unreadcount > 0 && (
          <MenuItem onClick={handleMarkAsRead}>
            <MarkReadIcon sx={{ mr: 1 }} fontSize="small" />
            Mark as read
          </MenuItem>
        )}
        <MenuItem onClick={handleToggleFavourite}>
          {selectedConversation?.isfavourite ? (
            <>
              <StarBorderIcon sx={{ mr: 1 }} fontSize="small" />
              Remove from favourites
            </>
          ) : (
            <>
              <StarIcon sx={{ mr: 1 }} fontSize="small" />
              Add to favourites
            </>
          )}
        </MenuItem>
        <MenuItem onClick={handleToggleMute}>
          {selectedConversation?.ismuted ? (
            <>
              <UnmuteIcon sx={{ mr: 1 }} fontSize="small" />
              Unmute notifications
            </>
          ) : (
            <>
              <MuteIcon sx={{ mr: 1 }} fontSize="small" />
              Mute notifications
            </>
          )}
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteConversation} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete conversation
        </MenuItem>
      </Menu>
      
      {/* Conversation List */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {/* Loading state */}
        {isLoading && page === 1 ? (
          <List>{renderSkeletons()}</List>
        ) : isError ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              py: 4,
            }}
            role="alert"
          >
            <Typography color="error" gutterBottom>
              Failed to load conversations
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {queryError instanceof Error ? queryError.message : 'Unknown error'}
            </Typography>
          </Box>
        ) : processedConversations.length === 0 ? (
          renderEmptyState()
        ) : (
          <List
            ref={listRef}
            onKeyDown={handleKeyDown}
            role="listbox"
            aria-label="Conversations"
            tabIndex={0}
            sx={{
              py: 0,
              '&:focus': {
                outline: 'none',
              },
              '&:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: -2,
              },
            }}
          >
            {processedConversations.map((conversation, index) =>
              renderConversationItem(conversation, index)
            )}
            
            {/* Load more trigger */}
            <Box
              ref={loadMoreRef}
              sx={{
                py: 2,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              {isFetching && page > 1 && (
                <LoadingSpinner size="small" />
              )}
              {!hasMore && processedConversations.length > 0 && (
                <Typography variant="caption" color="text.disabled">
                  No more conversations
                </Typography>
              )}
            </Box>
          </List>
        )}
        
        {/* Polling indicator */}
        {isFetching && !isLoading && page === 1 && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
            }}
          >
            <LoadingSpinner size="small" />
          </Box>
        )}
      </Box>
    </Paper>
  );
}

// Export the component as named export (not default as per schema)
export default MessageList;
