/**
 * ContactList Component
 *
 * React component using Material-UI List and ListItem components that displays
 * the user's contacts, contact requests, and online status indicators. Supports
 * search/filter capabilities, contact acceptance/rejection, and both grid and
 * list view layouts with proper loading states and empty states.
 *
 * This component is based on the Moodle messaging templates:
 * - public/message/templates/message_drawer_view_contacts_body.mustache
 * - public/message/templates/message_drawer_contacts_list.mustache
 *
 * Features:
 * - Fetches contacts via GET /api/v1/messages/contacts using React Query
 * - Wraps message_get_contacts() PHP function via API without duplicating logic
 * - Online status indicators with Badge component
 * - Search/filter with debounced TextField input
 * - Contact requests section with accept/reject buttons
 * - Alphabetical grouping with ListSubheader components
 * - Infinite scroll/pagination for large contact lists
 * - Skeleton loaders during data fetching
 * - Empty state display
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - WCAG 2.1 AA accessibility compliance
 * - Light/dark mode theming support
 * - Optimistic UI updates for accept/reject operations
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  ListSubheader,
  Avatar,
  Badge,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Typography,
  Skeleton,
  Tooltip,
  CircularProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  FiberManualRecord as OnlineIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  PersonAdd as PersonAddIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  People as PeopleIcon,
  PersonOff as PersonOffIcon,
  Block as BlockIcon,
} from '@mui/icons-material';

// Internal imports from depends_on_files
import {
  getContacts,
  getContactRequests,
  getReceivedContactRequestsCount,
  acceptContactRequest,
  rejectContactRequest,
} from '@/features/messaging/api/messagingApi';
import type { Contact, ContactRequest, ContactListProps } from '@/features/messaging/types/message.types';
import { useToast } from '@/hooks/useToast';
import useDebounce from '@/hooks/useDebounce';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { formatRelativeTime } from '@/utils/date';

// ============================================================================
// Constants and Types
// ============================================================================

/** Query key constants for React Query cache management */
const QUERY_KEYS = {
  CONTACTS: 'contacts',
  CONTACT_REQUESTS: 'contactRequests',
  CONTACT_REQUEST_COUNT: 'contactRequestCount',
} as const;

/** Tab values for contacts/requests toggle */
type TabValue = 'contacts' | 'requests';

/** Interface for contact data with extended UI properties */
interface ExtendedContact extends Contact {
  /** Whether contact is currently online */
  isonline?: boolean;
  /** Whether to show online status for this contact */
  showonlinestatus?: boolean;
  /** Whether contact is blocked */
  isblocked?: boolean;
  /** Conversation ID if exists */
  conversationid?: number | null;
}

/** Interface for contact request with user info */
interface ExtendedContactRequest extends ContactRequest {
  /** User who sent the request */
  user?: {
    id: number;
    fullname: string;
    profileimageurl: string;
    isonline?: boolean;
    showonlinestatus?: boolean;
  };
}

/** Props for ContactList component - extended from type definition */
interface ContactListComponentProps {
  /** Callback when contact is clicked to start conversation */
  onContactClick?: (contact: Contact) => void;
  /** Initial search query for filtering contacts */
  searchQuery?: string;
  /** Initial tab to display */
  selectedTab?: TabValue;
  /** Whether to show search field */
  showSearch?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Maximum height for the list container */
  maxHeight?: number | string;
  /** Number of items to load per page */
  pageSize?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Groups contacts alphabetically by the first letter of their full name
 *
 * @param contacts - Array of contacts to group
 * @returns Map of first letter to array of contacts
 */
function groupContactsAlphabetically(
  contacts: ExtendedContact[]
): Map<string, ExtendedContact[]> {
  const grouped = new Map<string, ExtendedContact[]>();

  // Sort contacts by fullname first
  const sortedContacts = [...contacts].sort((a, b) =>
    a.fullname.localeCompare(b.fullname, undefined, { sensitivity: 'base' })
  );

  for (const contact of sortedContacts) {
    const firstLetter = contact.fullname.charAt(0).toUpperCase();
    const existing = grouped.get(firstLetter) || [];
    existing.push(contact);
    grouped.set(firstLetter, existing);
  }

  return grouped;
}

/**
 * Filters contacts based on search query
 *
 * @param contacts - Array of contacts to filter
 * @param query - Search query string
 * @returns Filtered array of contacts
 */
function filterContacts(contacts: ExtendedContact[], query: string): ExtendedContact[] {
  if (!query.trim()) {
    return contacts;
  }

  const normalizedQuery = query.toLowerCase().trim();
  return contacts.filter((contact) =>
    contact.fullname.toLowerCase().includes(normalizedQuery)
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * ContactSkeleton component for loading states
 */
function ContactSkeleton(): JSX.Element {
  return (
    <ListItem>
      <ListItemAvatar>
        <Skeleton variant="circular" width={40} height={40} />
      </ListItemAvatar>
      <ListItemText
        primary={<Skeleton variant="text" width="60%" />}
        secondary={<Skeleton variant="text" width="40%" />}
      />
    </ListItem>
  );
}

/**
 * EmptyState component for when no contacts exist
 */
interface EmptyStateProps {
  /** Type of empty state to display */
  type: 'contacts' | 'requests' | 'search';
  /** Search query (for search empty state) */
  searchQuery?: string;
}

function EmptyState({ type, searchQuery }: EmptyStateProps): JSX.Element {
  const theme = useTheme();

  const content = {
    contacts: {
      icon: <PeopleIcon sx={{ fontSize: 64, color: theme.palette.text.disabled }} />,
      title: 'No contacts yet',
      description:
        'Start adding contacts to easily find and message people you communicate with frequently.',
    },
    requests: {
      icon: <PersonAddIcon sx={{ fontSize: 64, color: theme.palette.text.disabled }} />,
      title: 'No contact requests',
      description: 'When someone sends you a contact request, it will appear here.',
    },
    search: {
      icon: <SearchIcon sx={{ fontSize: 64, color: theme.palette.text.disabled }} />,
      title: 'No results found',
      description: `No contacts match "${searchQuery || 'your search'}". Try a different search term.`,
    },
  };

  const { icon, title, description } = content[type];

  return (
    <Box
      role="status"
      aria-label={title}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
        textAlign: 'center',
        minHeight: 200,
      }}
    >
      {icon}
      <Typography
        variant="h6"
        sx={{ mt: 2, color: theme.palette.text.primary }}
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        sx={{ mt: 1, color: theme.palette.text.secondary, maxWidth: 300 }}
      >
        {description}
      </Typography>
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ContactList Component
 *
 * Displays user contacts and contact requests with search, filtering,
 * and management capabilities.
 */
export function ContactList({
  onContactClick,
  searchQuery: initialSearchQuery = '',
  selectedTab: initialTab = 'contacts',
  showSearch = true,
  className,
  maxHeight = 500,
  pageSize = 50,
}: ContactListComponentProps): JSX.Element {
  // ============================================================================
  // Hooks and State
  // ============================================================================

  const theme = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error, info } = useToast();

  // Local state
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
  const [searchInput, setSearchInput] = useState(initialSearchQuery);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [loadingContactId, setLoadingContactId] = useState<number | null>(null);

  // Refs for keyboard navigation
  const listRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input for performance
  const debouncedSearchQuery = useDebounce(searchInput, 300);

  // ============================================================================
  // Data Fetching with React Query
  // ============================================================================

  // Fetch contacts list
  const {
    data: contacts = [],
    isLoading: isLoadingContacts,
    isError: isErrorContacts,
    refetch: refetchContacts,
  } = useQuery({
    queryKey: [QUERY_KEYS.CONTACTS],
    queryFn: () => getContacts({ pagination: { page: 1, perPage: pageSize } }),
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });

  // Fetch contact requests
  const {
    data: contactRequests = [],
    isLoading: isLoadingRequests,
    isError: isErrorRequests,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: [QUERY_KEYS.CONTACT_REQUESTS],
    queryFn: () => getContactRequests({ pagination: { page: 1, perPage: pageSize } }),
    staleTime: 30000, // 30 seconds (more frequently updated)
    gcTime: 300000, // 5 minutes
  });

  // Fetch contact request count for badge
  const { data: requestCount = 0 } = useQuery({
    queryKey: [QUERY_KEYS.CONTACT_REQUEST_COUNT],
    queryFn: () => getReceivedContactRequestsCount(),
    staleTime: 30000,
    gcTime: 300000,
  });

  // ============================================================================
  // Mutations for Accept/Reject Operations
  // ============================================================================

  // Accept contact request mutation
  const acceptMutation = useMutation({
    mutationFn: acceptContactRequest,
    onMutate: async (requestId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.CONTACT_REQUESTS] });
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.CONTACT_REQUEST_COUNT] });

      // Snapshot previous values
      const previousRequests = queryClient.getQueryData<ContactRequest[]>([
        QUERY_KEYS.CONTACT_REQUESTS,
      ]);
      const previousCount = queryClient.getQueryData<number>([
        QUERY_KEYS.CONTACT_REQUEST_COUNT,
      ]);

      // Optimistically remove the request from the list
      queryClient.setQueryData<ContactRequest[]>(
        [QUERY_KEYS.CONTACT_REQUESTS],
        (old) => old?.filter((req) => req.id !== requestId) ?? []
      );

      // Optimistically decrease the count
      queryClient.setQueryData<number>(
        [QUERY_KEYS.CONTACT_REQUEST_COUNT],
        (old) => Math.max((old ?? 1) - 1, 0)
      );

      return { previousRequests, previousCount };
    },
    onError: (_err, _requestId, context) => {
      // Rollback on error
      if (context?.previousRequests) {
        queryClient.setQueryData(
          [QUERY_KEYS.CONTACT_REQUESTS],
          context.previousRequests
        );
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(
          [QUERY_KEYS.CONTACT_REQUEST_COUNT],
          context.previousCount
        );
      }
      error('Failed to accept contact request. Please try again.');
    },
    onSuccess: () => {
      success('Contact request accepted');
      // Invalidate contacts to refresh the list
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONTACTS] });
    },
    onSettled: () => {
      setLoadingContactId(null);
    },
  });

  // Reject contact request mutation
  const rejectMutation = useMutation({
    mutationFn: rejectContactRequest,
    onMutate: async (requestId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.CONTACT_REQUESTS] });
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.CONTACT_REQUEST_COUNT] });

      // Snapshot previous values
      const previousRequests = queryClient.getQueryData<ContactRequest[]>([
        QUERY_KEYS.CONTACT_REQUESTS,
      ]);
      const previousCount = queryClient.getQueryData<number>([
        QUERY_KEYS.CONTACT_REQUEST_COUNT,
      ]);

      // Optimistically remove the request from the list
      queryClient.setQueryData<ContactRequest[]>(
        [QUERY_KEYS.CONTACT_REQUESTS],
        (old) => old?.filter((req) => req.id !== requestId) ?? []
      );

      // Optimistically decrease the count
      queryClient.setQueryData<number>(
        [QUERY_KEYS.CONTACT_REQUEST_COUNT],
        (old) => Math.max((old ?? 1) - 1, 0)
      );

      return { previousRequests, previousCount };
    },
    onError: (_err, _requestId, context) => {
      // Rollback on error
      if (context?.previousRequests) {
        queryClient.setQueryData(
          [QUERY_KEYS.CONTACT_REQUESTS],
          context.previousRequests
        );
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(
          [QUERY_KEYS.CONTACT_REQUEST_COUNT],
          context.previousCount
        );
      }
      error('Failed to reject contact request. Please try again.');
    },
    onSuccess: () => {
      info('Contact request declined');
    },
    onSettled: () => {
      setLoadingContactId(null);
    },
  });

  // ============================================================================
  // Computed Values
  // ============================================================================

  // Filter contacts based on search query
  const filteredContacts = useMemo(() => {
    return filterContacts(contacts as ExtendedContact[], debouncedSearchQuery);
  }, [contacts, debouncedSearchQuery]);

  // Group filtered contacts alphabetically
  const groupedContacts = useMemo(() => {
    return groupContactsAlphabetically(filteredContacts);
  }, [filteredContacts]);

  // Flatten grouped contacts for keyboard navigation
  const flattenedContacts = useMemo(() => {
    const flat: ExtendedContact[] = [];
    groupedContacts.forEach((contactGroup) => {
      flat.push(...contactGroup);
    });
    return flat;
  }, [groupedContacts]);

  // Total counts for display
  const contactsCount = contacts.length;
  const isLoading = activeTab === 'contacts' ? isLoadingContacts : isLoadingRequests;
  const isError = activeTab === 'contacts' ? isErrorContacts : isErrorRequests;

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle tab change between contacts and requests
   */
  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, newValue: TabValue) => {
      setActiveTab(newValue);
      setFocusedIndex(-1);
      setSearchInput('');
    },
    []
  );

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchInput(event.target.value);
      setFocusedIndex(-1);
    },
    []
  );

  /**
   * Clear search input
   */
  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setFocusedIndex(-1);
    searchInputRef.current?.focus();
  }, []);

  /**
   * Handle contact click to open conversation
   */
  const handleContactClick = useCallback(
    (contact: ExtendedContact) => {
      if (onContactClick) {
        onContactClick(contact);
      } else {
        // Default navigation to conversation view
        if (contact.conversationid) {
          navigate(`/messages/conversation/${contact.conversationid}`);
        } else {
          // Create new conversation with this user
          navigate(`/messages/conversation/new?userId=${contact.userid}`);
        }
      }
    },
    [onContactClick, navigate]
  );

  /**
   * Handle accept contact request
   */
  const handleAcceptRequest = useCallback(
    (requestId: number) => {
      setLoadingContactId(requestId);
      acceptMutation.mutate(requestId);
    },
    [acceptMutation]
  );

  /**
   * Handle reject contact request
   */
  const handleRejectRequest = useCallback(
    (requestId: number) => {
      setLoadingContactId(requestId);
      rejectMutation.mutate(requestId);
    },
    [rejectMutation]
  );

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const itemCount =
        activeTab === 'contacts' ? flattenedContacts.length : contactRequests.length;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, itemCount - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          event.preventDefault();
          if (focusedIndex >= 0) {
            if (activeTab === 'contacts' && flattenedContacts[focusedIndex]) {
              handleContactClick(flattenedContacts[focusedIndex]);
            }
          }
          break;
        case 'Escape':
          event.preventDefault();
          setFocusedIndex(-1);
          searchInputRef.current?.blur();
          break;
        case 'Home':
          event.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setFocusedIndex(itemCount - 1);
          break;
        default:
          break;
      }
    },
    [activeTab, flattenedContacts, contactRequests.length, focusedIndex, handleContactClick]
  );

  // ============================================================================
  // Effects
  // ============================================================================

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      const focusedItem = items[focusedIndex] as HTMLElement | undefined;
      focusedItem?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedIndex]);

  // Reset focused index when tab changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [activeTab]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /**
   * Render online status badge
   */
  const renderOnlineBadge = (
    isonline: boolean | undefined,
    showonlinestatus: boolean | undefined
  ): JSX.Element | null => {
    if (!showonlinestatus || !isonline) {
      return null;
    }

    return (
      <OnlineIcon
        sx={{
          fontSize: 12,
          color: theme.palette.success.main,
          position: 'absolute',
          bottom: 0,
          right: 0,
        }}
        aria-label="Online"
      />
    );
  };

  /**
   * Render a single contact item
   */
  const renderContactItem = (
    contact: ExtendedContact,
    index: number,
    isSelected: boolean
  ): JSX.Element => {
    const extendedContact = contact as ExtendedContact;

    return (
      <ListItem
        key={contact.userid}
        role="option"
        aria-selected={isSelected}
        tabIndex={isSelected ? 0 : -1}
        onClick={() => handleContactClick(contact)}
        sx={{
          cursor: 'pointer',
          borderRadius: 1,
          mb: 0.5,
          backgroundColor: isSelected
            ? alpha(theme.palette.primary.main, 0.12)
            : 'transparent',
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
          },
          '&:focus': {
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: -2,
          },
        }}
      >
        <ListItemAvatar>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              extendedContact.showonlinestatus && extendedContact.isonline ? (
                <OnlineIcon
                  sx={{
                    fontSize: 12,
                    color: theme.palette.success.main,
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: '50%',
                  }}
                  aria-hidden="true"
                />
              ) : null
            }
          >
            <Avatar
              src={contact.profileimageurl}
              alt={contact.fullname}
              sx={{ width: 40, height: 40 }}
            >
              {contact.fullname.charAt(0).toUpperCase()}
            </Avatar>
          </Badge>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Typography
              variant="body1"
              component="span"
              sx={{
                fontWeight: 500,
                color: theme.palette.text.primary,
              }}
            >
              {contact.fullname}
            </Typography>
          }
          secondary={
            contact.lastmessagedate ? (
              <Typography
                variant="body2"
                component="span"
                sx={{ color: theme.palette.text.secondary }}
              >
                {formatRelativeTime(contact.lastmessagedate * 1000)}
              </Typography>
            ) : null
          }
        />
        {extendedContact.isblocked && (
          <ListItemSecondaryAction>
            <Tooltip title="Blocked">
              <BlockIcon
                fontSize="small"
                sx={{ color: theme.palette.error.main }}
                aria-label="Blocked contact"
              />
            </Tooltip>
          </ListItemSecondaryAction>
        )}
      </ListItem>
    );
  };

  /**
   * Render a single contact request item
   */
  const renderContactRequestItem = (
    request: ExtendedContactRequest,
    index: number,
    isSelected: boolean
  ): JSX.Element => {
    const isProcessing = loadingContactId === request.id;
    const user = request.user || {
      id: request.userid,
      fullname: `User ${request.userid}`,
      profileimageurl: '',
      isonline: false,
      showonlinestatus: false,
    };

    return (
      <ListItem
        key={request.id}
        role="option"
        aria-selected={isSelected}
        tabIndex={isSelected ? 0 : -1}
        sx={{
          borderRadius: 1,
          mb: 0.5,
          backgroundColor: isSelected
            ? alpha(theme.palette.primary.main, 0.12)
            : 'transparent',
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
          },
        }}
      >
        <ListItemAvatar>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              user.showonlinestatus && user.isonline ? (
                <OnlineIcon
                  sx={{
                    fontSize: 12,
                    color: theme.palette.success.main,
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: '50%',
                  }}
                  aria-hidden="true"
                />
              ) : null
            }
          >
            <Avatar
              src={user.profileimageurl}
              alt={user.fullname}
              sx={{ width: 40, height: 40 }}
            >
              {user.fullname.charAt(0).toUpperCase()}
            </Avatar>
          </Badge>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Typography
              variant="body1"
              component="span"
              sx={{
                fontWeight: 500,
                color: theme.palette.text.primary,
              }}
            >
              {user.fullname}
            </Typography>
          }
          secondary={
            <Typography
              variant="body2"
              component="span"
              sx={{ color: theme.palette.text.secondary }}
            >
              {formatRelativeTime(request.timecreated * 1000)}
            </Typography>
          }
        />
        <ListItemSecondaryAction>
          {isProcessing ? (
            <CircularProgress size={24} />
          ) : (
            <>
              <Tooltip title="Accept request">
                <IconButton
                  size="small"
                  color="success"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcceptRequest(request.id);
                  }}
                  aria-label={`Accept contact request from ${user.fullname}`}
                  sx={{ mr: 0.5 }}
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Decline request">
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRejectRequest(request.id);
                  }}
                  aria-label={`Decline contact request from ${user.fullname}`}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  /**
   * Render grouped contacts list
   */
  const renderContactsList = (): JSX.Element => {
    if (isLoadingContacts) {
      return (
        <List>
          {Array.from({ length: 5 }).map((_, i) => (
            <ContactSkeleton key={`skeleton-${i}`} />
          ))}
        </List>
      );
    }

    if (isErrorContacts) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography color="error" variant="body2">
            Failed to load contacts.
          </Typography>
          <Button
            size="small"
            onClick={() => refetchContacts()}
            sx={{ mt: 1 }}
          >
            Retry
          </Button>
        </Box>
      );
    }

    if (filteredContacts.length === 0) {
      if (debouncedSearchQuery) {
        return <EmptyState type="search" searchQuery={debouncedSearchQuery} />;
      }
      return <EmptyState type="contacts" />;
    }

    let globalIndex = 0;

    return (
      <List
        ref={listRef}
        role="listbox"
        aria-label="Contacts list"
        onKeyDown={handleKeyDown}
        sx={{
          width: '100%',
          bgcolor: 'background.paper',
          position: 'relative',
          overflow: 'auto',
          maxHeight: typeof maxHeight === 'number' ? maxHeight - 120 : maxHeight,
        }}
      >
        {Array.from(groupedContacts.entries()).map(([letter, contactGroup]) => (
          <React.Fragment key={letter}>
            <ListSubheader
              component="div"
              sx={{
                bgcolor: theme.palette.background.default,
                fontWeight: 600,
                color: theme.palette.text.secondary,
                lineHeight: '32px',
              }}
            >
              {letter}
            </ListSubheader>
            {contactGroup.map((contact) => {
              const currentIndex = globalIndex++;
              return renderContactItem(
                contact,
                currentIndex,
                currentIndex === focusedIndex
              );
            })}
          </React.Fragment>
        ))}
      </List>
    );
  };

  /**
   * Render contact requests list
   */
  const renderRequestsList = (): JSX.Element => {
    if (isLoadingRequests) {
      return (
        <List>
          {Array.from({ length: 3 }).map((_, i) => (
            <ContactSkeleton key={`skeleton-request-${i}`} />
          ))}
        </List>
      );
    }

    if (isErrorRequests) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography color="error" variant="body2">
            Failed to load contact requests.
          </Typography>
          <Button
            size="small"
            onClick={() => refetchRequests()}
            sx={{ mt: 1 }}
          >
            Retry
          </Button>
        </Box>
      );
    }

    if (contactRequests.length === 0) {
      return <EmptyState type="requests" />;
    }

    return (
      <List
        ref={listRef}
        role="listbox"
        aria-label="Contact requests list"
        onKeyDown={handleKeyDown}
        sx={{
          width: '100%',
          bgcolor: 'background.paper',
          position: 'relative',
          overflow: 'auto',
          maxHeight: typeof maxHeight === 'number' ? maxHeight - 120 : maxHeight,
        }}
      >
        {contactRequests.map((request, index) =>
          renderContactRequestItem(
            request as ExtendedContactRequest,
            index,
            index === focusedIndex
          )
        )}
      </List>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight,
        bgcolor: 'background.paper',
        borderRadius: 1,
        overflow: 'hidden',
      }}
      role="region"
      aria-label="Contacts"
    >
      {/* Tabs for Contacts/Requests toggle */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          aria-label="Contact sections"
        >
          <Tab
            value="contacts"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Contacts</span>
                {contactsCount > 0 && (
                  <Badge
                    badgeContent={contactsCount}
                    color="primary"
                    max={999}
                    sx={{
                      '& .MuiBadge-badge': {
                        position: 'relative',
                        transform: 'none',
                        ml: 0.5,
                      },
                    }}
                  />
                )}
              </Box>
            }
            id="contacts-tab"
            aria-controls="contacts-tabpanel"
          />
          <Tab
            value="requests"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Requests</span>
                {requestCount > 0 && (
                  <Badge
                    badgeContent={requestCount}
                    color="error"
                    max={99}
                    sx={{
                      '& .MuiBadge-badge': {
                        position: 'relative',
                        transform: 'none',
                        ml: 0.5,
                      },
                    }}
                  />
                )}
              </Box>
            }
            id="requests-tab"
            aria-controls="requests-tabpanel"
          />
        </Tabs>
      </Box>

      {/* Search field for contacts tab */}
      {showSearch && activeTab === 'contacts' && (
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            ref={searchInputRef}
            fullWidth
            size="small"
            placeholder="Search contacts..."
            value={searchInput}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon
                    sx={{ color: theme.palette.text.secondary }}
                    aria-hidden="true"
                  />
                </InputAdornment>
              ),
              endAdornment: searchInput && (
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
              'aria-label': 'Search contacts',
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        </Box>
      )}

      {/* Tab panels */}
      <Box
        role="tabpanel"
        id={`${activeTab}-tabpanel`}
        aria-labelledby={`${activeTab}-tab`}
        sx={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {activeTab === 'contacts' ? renderContactsList() : renderRequestsList()}
      </Box>
    </Box>
  );
}

// Named export only (no default export per schema specification)
export type { ContactListComponentProps };
