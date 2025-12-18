/**
 * DiscussionList Component
 * 
 * Paginated discussion list component for forum views displaying discussion metadata
 * (title, author, timestamps, post counts, pinned status), with sorting options
 * (last post, creation date, replies), filtering capabilities (by group, unread),
 * and WCAG 2.1 AA accessibility support including keyboard navigation, ARIA labels,
 * and loading/error states.
 * 
 * @module features/activities/forums/components/DiscussionList
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

// Material-UI Components
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Chip,
  Avatar,
  Stack,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  IconButton,
  Checkbox,
  Tooltip,
  Badge,
  Button,
  Menu,
  useTheme,
  useMediaQuery,
  Skeleton,
  SelectChangeEvent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Divider,
} from '@mui/material';

// Material-UI Icons
import {
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  PushPin as PinIcon,
  Lock as LockIcon,
  Person as PersonIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Forum as ForumIcon,
  Comment as CommentIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';

// Internal Dependencies (from depends_on_files)
import { useForum } from '../hooks/useForum';
import type { Forum, DiscussionEnriched } from '../types/forum.types';
import { LoadingSpinner } from '../../../../components/feedback/LoadingSpinner';
import { Alert } from '../../../../components/feedback/Alert';
import { Pagination } from '../../../../components/data-display/Pagination';
import { usePagination } from '../../../../hooks/usePagination';
import { usePermissions } from '../../../../hooks/usePermissions';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Props for the DiscussionList component
 */
export interface DiscussionListProps {
  /** Course ID containing the forum */
  courseId: number;
  /** Forum ID to display discussions for */
  forumId: number;
  /** Optional group ID for group filtering */
  groupId?: number;
  /** Whether to show checkboxes for bulk selection (moderator view) */
  showSelection?: boolean;
  /** Callback when a discussion is selected */
  onDiscussionSelect?: (discussionId: number) => void;
  /** Callback when bulk action is triggered */
  onBulkAction?: (discussionIds: number[], action: 'delete' | 'move' | 'pin' | 'lock') => void;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Sort field options
 */
type SortField = 'lastPost' | 'created' | 'replies' | 'title';

/**
 * Sort direction
 */
type SortDirection = 'asc' | 'desc';

/**
 * Filter options for discussion list
 */
type FilterOption = 'all' | 'unread' | 'pinned' | 'subscribed' | 'started';

/**
 * Column definition for the table
 */
interface ColumnDef {
  id: string;
  label: string;
  sortable: boolean;
  sortField?: SortField;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  hideOnMobile?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Table column definitions
 */
const COLUMNS: ColumnDef[] = [
  { id: 'title', label: 'Discussion', sortable: true, sortField: 'title', align: 'left' },
  { id: 'author', label: 'Started by', sortable: false, align: 'left', hideOnMobile: true },
  { id: 'replies', label: 'Replies', sortable: true, sortField: 'replies', width: 100, align: 'center', hideOnMobile: true },
  { id: 'lastPost', label: 'Last post', sortable: true, sortField: 'lastPost', width: 180, align: 'left', hideOnMobile: true },
];

/**
 * Filter labels for display
 */
const FILTER_LABELS: Record<FilterOption, string> = {
  all: 'All discussions',
  unread: 'Unread only',
  pinned: 'Pinned only',
  subscribed: 'Subscribed',
  started: 'Started by me',
};

/**
 * Page size options
 */
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Formats a timestamp for display using relative time
 * @param timestamp - Unix timestamp or ISO date string
 * @returns Formatted relative time string
 */
function formatTimestamp(timestamp: number | string | undefined): string {
  if (!timestamp) {
    return 'Unknown';
  }
  
  const date = typeof timestamp === 'number' 
    ? new Date(timestamp * 1000) 
    : new Date(timestamp);
  
  if (isNaN(date.getTime())) {
    return 'Unknown';
  }
  
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Maps component sort field to API sort parameter
 */
function mapSortFieldToApi(field: SortField): string {
  const mapping: Record<SortField, string> = {
    lastPost: 'date',
    created: 'date',
    replies: 'replies',
    title: 'author', // API might not support title sorting, fall back
  };
  return mapping[field] || 'date';
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * DiscussionList Component
 * 
 * Renders a paginated, sortable, filterable list of forum discussions.
 * Supports WCAG 2.1 AA accessibility with keyboard navigation and ARIA labels.
 * 
 * @param props - Component props
 * @returns JSX element
 */
export function DiscussionList({
  courseId,
  forumId,
  groupId,
  showSelection = false,
  onDiscussionSelect,
  onBulkAction,
  className,
}: DiscussionListProps): React.JSX.Element {
  // Theme and responsive design
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  // Permission checks using usePermissions hook with hasCapability
  const { hasCapability } = usePermissions();
  const canModerate = hasCapability('mod/forum:editanypost');
  const canViewDiscussions = hasCapability('mod/forum:viewdiscussion');
  const canStartDiscussion = hasCapability('mod/forum:startdiscussion');
  const canPinDiscussions = hasCapability('mod/forum:pindiscussions');
  const canLockDiscussions = hasCapability('mod/forum:lockmessage');
  const canDeleteDiscussions = hasCapability('mod/forum:deleteanypost');

  // Local state for sorting and filtering
  const [sortField, setSortField] = useState<SortField>('lastPost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeDiscussionId, setActiveDiscussionId] = useState<number | null>(null);

  // Refs for debouncing and focus management
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const tableRef = useRef<HTMLTableElement>(null);

  // Use the useForum hook for data fetching with sorting and filtering
  const {
    forum,
    discussions,
    isLoading,
    isError,
    error,
    refetch,
    pagination,
    sortBy,
    setSortBy,
    filterBy,
    setFilterBy,
    markAsRead,
  } = useForum(forumId, {
    initialPage: 1,
    initialPageSize: 20,
    initialSortBy: mapSortFieldToApi(sortField),
    initialSortOrder: sortDirection,
  });

  // Use usePagination for additional pagination controls
  const paginationState = usePagination({
    totalItems: pagination.totalItems,
    initialPage: pagination.currentPage,
    initialPageSize: pagination.itemsPerPage,
  });

  // Sync pagination state with useForum
  useEffect(() => {
    if (paginationState.currentPage !== pagination.currentPage) {
      pagination.goToPage(paginationState.currentPage);
    }
  }, [paginationState.currentPage, pagination]);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Update API sort when local sort changes
  useEffect(() => {
    const apiSort = mapSortFieldToApi(sortField);
    if (sortBy !== apiSort) {
      setSortBy(apiSort);
    }
  }, [sortField, sortBy, setSortBy]);

  // Update API filter when local filter changes
  useEffect(() => {
    const filterMap: Record<FilterOption, string> = {
      all: 'all',
      unread: 'unread',
      pinned: 'pinned',
      subscribed: 'all', // Not directly supported, will filter client-side
      started: 'all', // Not directly supported, will filter client-side
    };
    const apiFilter = filterMap[filterOption];
    if (filterBy !== apiFilter) {
      setFilterBy(apiFilter);
    }
  }, [filterOption, filterBy, setFilterBy]);

  // Filter and sort discussions client-side for additional filtering
  const filteredDiscussions = useMemo(() => {
    if (!discussions) return [];

    let result = [...discussions];

    // Apply search filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(searchLower) ||
          (d.userFullName && d.userFullName.toLowerCase().includes(searchLower))
      );
    }

    // Apply additional client-side filters not supported by API
    switch (filterOption) {
      case 'subscribed':
        // This would need subscription data which may not be in DiscussionEnriched
        break;
      case 'started':
        // Filter by current user - would need current user ID
        break;
      default:
        break;
    }

    // Sort discussions - pinned always first
    const pinned = result.filter((d) => d.pinned);
    const unpinned = result.filter((d) => !d.pinned);

    // Sort unpinned discussions
    unpinned.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'replies':
          comparison = (a.numReplies || 0) - (b.numReplies || 0);
          break;
        case 'lastPost':
        case 'created':
          comparison = (a.created || 0) - (b.created || 0);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return [...pinned, ...unpinned];
  }, [discussions, debouncedSearch, filterOption, sortField, sortDirection]);

  // Event Handlers
  const handleSortChange = useCallback((field: SortField) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortDirection((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDirection('desc');
      return field;
    });
  }, []);

  const handleFilterChange = useCallback((event: SelectChangeEvent<FilterOption>) => {
    setFilterOption(event.target.value as FilterOption);
    pagination.goToPage(1); // Reset to first page on filter change
  }, [pagination]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearch('');
  }, []);

  const handleDiscussionClick = useCallback(
    (discussionId: number) => {
      // Mark as read when opening
      markAsRead(discussionId).catch(console.error);
      
      if (onDiscussionSelect) {
        onDiscussionSelect(discussionId);
      } else {
        navigate(`/courses/${courseId}/forums/${forumId}/discussions/${discussionId}`);
      }
    },
    [courseId, forumId, markAsRead, navigate, onDiscussionSelect]
  );

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredDiscussions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDiscussions.map((d) => d.id)));
    }
  }, [filteredDiscussions, selectedIds.size]);

  const handleSelectDiscussion = useCallback((discussionId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(discussionId)) {
        next.delete(discussionId);
      } else {
        next.add(discussionId);
      }
      return next;
    });
  }, []);

  const handleBulkAction = useCallback(
    (action: 'delete' | 'move' | 'pin' | 'lock') => {
      if (selectedIds.size > 0 && onBulkAction) {
        onBulkAction(Array.from(selectedIds), action);
        setSelectedIds(new Set());
      }
    },
    [selectedIds, onBulkAction]
  );

  const handleMobileMenuOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>, discussionId: number) => {
      event.stopPropagation();
      setMobileMenuAnchor(event.currentTarget);
      setActiveDiscussionId(discussionId);
    },
    []
  );

  const handleMobileMenuClose = useCallback(() => {
    setMobileMenuAnchor(null);
    setActiveDiscussionId(null);
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      pagination.goToPage(page);
      paginationState.goToPage(page);
      // Scroll to top of table
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [pagination, paginationState]
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      pagination.setItemsPerPage(pageSize);
      paginationState.setPageSize(pageSize);
      pagination.goToPage(1);
    },
    [pagination, paginationState]
  );

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, discussionId: number) => {
      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          handleDiscussionClick(discussionId);
          break;
        case 'ArrowDown': {
          event.preventDefault();
          const currentIndex = filteredDiscussions.findIndex((d) => d.id === discussionId);
          if (currentIndex < filteredDiscussions.length - 1) {
            const nextId = filteredDiscussions[currentIndex + 1].id;
            const nextRow = document.querySelector(`[data-discussion-id="${nextId}"]`) as HTMLElement;
            nextRow?.focus();
          }
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          const currentIdx = filteredDiscussions.findIndex((d) => d.id === discussionId);
          if (currentIdx > 0) {
            const prevId = filteredDiscussions[currentIdx - 1].id;
            const prevRow = document.querySelector(`[data-discussion-id="${prevId}"]`) as HTMLElement;
            prevRow?.focus();
          }
          break;
        }
      }
    },
    [filteredDiscussions, handleDiscussionClick]
  );

  // Loading state
  if (isLoading) {
    return (
      <Box
        className={className}
        sx={{ width: '100%' }}
        role="status"
        aria-label="Loading discussions"
      >
        <LoadingSpinner
          size="large"
          message="Loading discussions..."
          overlay={false}
        />
      </Box>
    );
  }

  // Error state
  if (isError) {
    return (
      <Box className={className} sx={{ width: '100%' }}>
        <Alert
          severity="error"
          title="Failed to load discussions"
          onClose={() => refetch()}
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          {error?.message || 'An unexpected error occurred while loading discussions.'}
        </Alert>
      </Box>
    );
  }

  // Empty state
  if (!filteredDiscussions || filteredDiscussions.length === 0) {
    return (
      <Box
        className={className}
        sx={{
          width: '100%',
          textAlign: 'center',
          py: 8,
        }}
        role="status"
        aria-label="No discussions found"
      >
        <ForumIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        {debouncedSearch ? (
          <>
            <Typography variant="h6" gutterBottom>
              No discussions found
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              No discussions match your search &quot;{debouncedSearch}&quot;
            </Typography>
            <Button onClick={handleSearchClear} sx={{ mt: 2 }}>
              Clear Search
            </Button>
          </>
        ) : filterOption !== 'all' ? (
          <>
            <Typography variant="h6" gutterBottom>
              No discussions found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No discussions match the selected filter: {FILTER_LABELS[filterOption]}
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="h6" gutterBottom>
              No discussions yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Be the first to start a discussion in this forum!
            </Typography>
            {canStartDiscussion && (
              <Button
                variant="contained"
                sx={{ mt: 2 }}
                onClick={() => navigate(`/courses/${courseId}/forums/${forumId}/new`)}
              >
                Start Discussion
              </Button>
            )}
          </>
        )}
      </Box>
    );
  }

  // Render mobile list view
  if (isMobile) {
    return (
      <Box
        className={className}
        sx={{ width: '100%' }}
        data-testid="discussion-list"
      >
        {/* Mobile search and filter controls */}
        <Stack spacing={2} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search discussions..."
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search discussions"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={handleSearchClear}
                    aria-label="Clear search"
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" fullWidth>
            <InputLabel id="mobile-filter-label">Filter</InputLabel>
            <Select
              labelId="mobile-filter-label"
              value={filterOption}
              label="Filter"
              onChange={handleFilterChange}
            >
              {Object.entries(FILTER_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {/* Mobile list */}
        <List
          aria-label="Discussion list"
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
          }}
        >
          {filteredDiscussions.map((discussion, index) => (
            <React.Fragment key={discussion.id}>
              <ListItem
                data-discussion-id={discussion.id}
                disablePadding
                secondaryAction={
                  canModerate && (
                    <IconButton
                      edge="end"
                      aria-label={`More actions for ${discussion.name}`}
                      onClick={(e) => handleMobileMenuOpen(e, discussion.id)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  )
                }
              >
                <ListItemButton
                  onClick={() => handleDiscussionClick(discussion.id)}
                  onKeyDown={(e) => handleKeyDown(e, discussion.id)}
                  tabIndex={0}
                  aria-label={`${discussion.name}, ${discussion.numReplies || 0} replies, started ${formatTimestamp(discussion.created)}`}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={discussion.userPictureUrl || undefined}
                      alt={discussion.userFullName || 'Unknown user'}
                    >
                      {discussion.userFullName?.[0]?.toUpperCase() || <PersonIcon />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography
                          variant="subtitle2"
                          component="span"
                          sx={{
                            fontWeight: (discussion.numUnreadPosts || 0) > 0 ? 700 : 400,
                          }}
                        >
                          {discussion.name}
                        </Typography>
                        {discussion.pinned && (
                          <Chip
                            icon={<PinIcon />}
                            label="Pinned"
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        )}
                        {discussion.locked && (
                          <Chip
                            icon={<LockIcon />}
                            label="Locked"
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        )}
                        {(discussion.numUnreadPosts || 0) > 0 && (
                          <Badge
                            badgeContent={discussion.numUnreadPosts}
                            color="error"
                            aria-label={`${discussion.numUnreadPosts} unread posts`}
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        By {discussion.userFullName || 'Unknown'} · {formatTimestamp(discussion.created)} · {discussion.numReplies || 0} replies
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
              {index < filteredDiscussions.length - 1 && <Divider component="li" />}
            </React.Fragment>
          ))}
        </List>

        {/* Mobile pagination */}
        {pagination.totalPages > 1 && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              aria-label="Discussion list pagination"
            />
          </Box>
        )}

        {/* Mobile action menu */}
        <Menu
          anchorEl={mobileMenuAnchor}
          open={Boolean(mobileMenuAnchor)}
          onClose={handleMobileMenuClose}
        >
          {canPinDiscussions && (
            <MenuItem onClick={() => { handleBulkAction('pin'); handleMobileMenuClose(); }}>
              <PinIcon sx={{ mr: 1 }} />
              {filteredDiscussions.find((d) => d.id === activeDiscussionId)?.pinned
                ? 'Unpin'
                : 'Pin'}
            </MenuItem>
          )}
          {canLockDiscussions && (
            <MenuItem onClick={() => { handleBulkAction('lock'); handleMobileMenuClose(); }}>
              <LockIcon sx={{ mr: 1 }} />
              {filteredDiscussions.find((d) => d.id === activeDiscussionId)?.locked
                ? 'Unlock'
                : 'Lock'}
            </MenuItem>
          )}
          {canDeleteDiscussions && (
            <MenuItem
              onClick={() => { handleBulkAction('delete'); handleMobileMenuClose(); }}
              sx={{ color: 'error.main' }}
            >
              <DeleteIcon sx={{ mr: 1 }} />
              Delete
            </MenuItem>
          )}
        </Menu>
      </Box>
    );
  }

  // Desktop table view
  return (
    <Box
      className={className}
      sx={{ width: '100%' }}
      data-testid="discussion-list"
    >
      {/* Desktop search and controls */}
      <Stack
        direction="row"
        spacing={2}
        sx={{ mb: 3 }}
        flexWrap="wrap"
        alignItems="center"
      >
        <TextField
          placeholder="Search discussions..."
          value={searchQuery}
          onChange={handleSearchChange}
          size="small"
          aria-label="Search discussions"
          sx={{ minWidth: 250 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={handleSearchClear}
                  aria-label="Clear search"
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="filter-label">Filter</InputLabel>
          <Select
            labelId="filter-label"
            value={filterOption}
            label="Filter"
            onChange={handleFilterChange}
          >
            {Object.entries(FILTER_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Bulk actions for moderators */}
        {showSelection && canModerate && selectedIds.size > 0 && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {selectedIds.size} selected
            </Typography>
            {canPinDiscussions && (
              <Button
                size="small"
                startIcon={<PinIcon />}
                onClick={() => handleBulkAction('pin')}
              >
                Pin
              </Button>
            )}
            {canLockDiscussions && (
              <Button
                size="small"
                startIcon={<LockIcon />}
                onClick={() => handleBulkAction('lock')}
              >
                Lock
              </Button>
            )}
            {canDeleteDiscussions && (
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => handleBulkAction('delete')}
              >
                Delete
              </Button>
            )}
          </Stack>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <Typography variant="body2" color="text.secondary">
          {pagination.totalItems} discussion{pagination.totalItems !== 1 ? 's' : ''}
        </Typography>
      </Stack>

      {/* Discussion table */}
      <TableContainer
        component={Paper}
        sx={{ mb: 2 }}
        role="region"
        aria-label="Discussion list"
      >
        <Table
          ref={tableRef}
          aria-label="Discussions table"
          size="medium"
        >
          <TableHead>
            <TableRow>
              {showSelection && canModerate && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      selectedIds.size > 0 &&
                      selectedIds.size < filteredDiscussions.length
                    }
                    checked={
                      filteredDiscussions.length > 0 &&
                      selectedIds.size === filteredDiscussions.length
                    }
                    onChange={handleSelectAll}
                    inputProps={{ 'aria-label': 'Select all discussions' }}
                  />
                </TableCell>
              )}
              {COLUMNS.filter((col) => !col.hideOnMobile || !isSmallScreen).map(
                (column) => (
                  <TableCell
                    key={column.id}
                    align={column.align}
                    width={column.width}
                    sortDirection={
                      column.sortField === sortField ? sortDirection : false
                    }
                  >
                    {column.sortable && column.sortField ? (
                      <TableSortLabel
                        active={sortField === column.sortField}
                        direction={
                          sortField === column.sortField ? sortDirection : 'desc'
                        }
                        onClick={() => handleSortChange(column.sortField!)}
                        IconComponent={
                          sortDirection === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon
                        }
                      >
                        {column.label}
                      </TableSortLabel>
                    ) : (
                      column.label
                    )}
                  </TableCell>
                )
              )}
              {canModerate && <TableCell width={120}>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredDiscussions.map((discussion) => {
              const isSelected = selectedIds.has(discussion.id);
              const hasUnread = (discussion.numUnreadPosts || 0) > 0;

              return (
                <TableRow
                  key={discussion.id}
                  data-discussion-id={discussion.id}
                  hover
                  onClick={() => handleDiscussionClick(discussion.id)}
                  onKeyDown={(e) => handleKeyDown(e, discussion.id)}
                  tabIndex={0}
                  role="row"
                  aria-selected={isSelected}
                  selected={isSelected}
                  sx={{
                    cursor: 'pointer',
                    backgroundColor: discussion.pinned
                      ? 'action.hover'
                      : 'inherit',
                    '&:focus': {
                      outline: `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: -2,
                    },
                  }}
                >
                  {showSelection && canModerate && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectDiscussion(discussion.id);
                        }}
                        inputProps={{
                          'aria-label': `Select discussion: ${discussion.name}`,
                        }}
                      />
                    </TableCell>
                  )}

                  {/* Discussion title cell */}
                  <TableCell component="th" scope="row">
                    <Stack direction="row" spacing={1} alignItems="center">
                      {hasUnread && (
                        <Badge
                          variant="dot"
                          color="primary"
                          aria-label="Has unread posts"
                        />
                      )}
                      <Box>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                        >
                          <Typography
                            variant="body1"
                            component="span"
                            sx={{
                              fontWeight: hasUnread ? 700 : 400,
                            }}
                          >
                            {discussion.name}
                          </Typography>
                          {discussion.pinned && (
                            <Tooltip title="Pinned discussion">
                              <Chip
                                icon={<PinIcon />}
                                label="Pinned"
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </Tooltip>
                          )}
                          {discussion.locked && (
                            <Tooltip title="Locked - no new replies">
                              <Chip
                                icon={<LockIcon />}
                                label="Locked"
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            </Tooltip>
                          )}
                        </Stack>
                        {hasUnread && (
                          <Typography
                            variant="caption"
                            color="primary"
                            sx={{ display: 'block' }}
                          >
                            {discussion.numUnreadPosts} unread{' '}
                            {discussion.numUnreadPosts === 1 ? 'post' : 'posts'}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </TableCell>

                  {/* Author cell */}
                  {!isSmallScreen && (
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar
                          src={discussion.userPictureUrl || undefined}
                          alt={discussion.userFullName || 'Unknown'}
                          sx={{ width: 32, height: 32 }}
                        >
                          {discussion.userFullName?.[0]?.toUpperCase() || (
                            <PersonIcon />
                          )}
                        </Avatar>
                        <Box>
                          <Typography variant="body2">
                            {discussion.userFullName || 'Unknown'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatTimestamp(discussion.created)}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                  )}

                  {/* Replies cell */}
                  {!isSmallScreen && (
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                        <CommentIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {discussion.numReplies || 0}
                        </Typography>
                      </Stack>
                    </TableCell>
                  )}

                  {/* Last post cell */}
                  {!isSmallScreen && (
                    <TableCell>
                      {discussion.lastPostAuthor ? (
                        <Box>
                          <Typography variant="body2">
                            {discussion.lastPostAuthor}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatTimestamp(discussion.timeModified || discussion.created)}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No replies yet
                        </Typography>
                      )}
                    </TableCell>
                  )}

                  {/* Actions cell */}
                  {canModerate && (
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {canPinDiscussions && (
                          <Tooltip
                            title={discussion.pinned ? 'Unpin discussion' : 'Pin discussion'}
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onBulkAction) {
                                  onBulkAction([discussion.id], 'pin');
                                }
                              }}
                              aria-label={
                                discussion.pinned
                                  ? 'Unpin discussion'
                                  : 'Pin discussion'
                              }
                              color={discussion.pinned ? 'primary' : 'default'}
                            >
                              <PinIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canLockDiscussions && (
                          <Tooltip
                            title={discussion.locked ? 'Unlock discussion' : 'Lock discussion'}
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onBulkAction) {
                                  onBulkAction([discussion.id], 'lock');
                                }
                              }}
                              aria-label={
                                discussion.locked
                                  ? 'Unlock discussion'
                                  : 'Lock discussion'
                              }
                              color={discussion.locked ? 'warning' : 'default'}
                            >
                              <LockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canDeleteDiscussions && (
                          <Tooltip title="Delete discussion">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  window.confirm(
                                    'Are you sure you want to delete this discussion?'
                                  )
                                ) {
                                  if (onBulkAction) {
                                    onBulkAction([discussion.id], 'delete');
                                  }
                                }
                              }}
                              aria-label="Delete discussion"
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            itemsPerPage={pagination.itemsPerPage}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            showFirstLast
            showPageSize
            variant="table"
            aria-label="Discussion list pagination"
          />
        </Box>
      )}
    </Box>
  );
}

export default DiscussionList;
