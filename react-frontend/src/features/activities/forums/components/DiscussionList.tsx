/**
 * DiscussionList Component
 *
 * Displays a list of forum discussions with sorting, filtering, pagination,
 * search, and moderator actions.
 *
 * Features:
 * - Discussion rendering with titles, authors, reply counts, and unread indicators
 * - Pinned discussions appear at the top
 * - Locked discussion indicators
 * - Sorting: newest, oldest, most replies, recently updated
 * - Filtering: all, unread only, my discussions, pinned only
 * - Pagination with page size controls
 * - Debounced search functionality
 * - Bulk actions for moderators (select, delete, move)
 * - Optimistic UI updates for pin/lock actions
 * - Responsive layout for mobile and desktop
 * - Accessibility features (ARIA labels, keyboard navigation)
 *
 * @module features/activities/forums/components/DiscussionList
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Chip,
  IconButton,
  Checkbox,
  Button,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Pagination,
  Skeleton,
  Alert,
  Badge,
  Tooltip,
  Stack,
  Divider,
  Menu,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  PushPin as PinIcon,
  Lock as LockIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Discussion data structure for the list
 */
export interface DiscussionListItem {
  /** Discussion ID */
  id: number;
  /** Discussion title */
  title: string;
  /** Discussion author */
  author: {
    id: number;
    name: string;
    avatarUrl: string | null;
    isDeleted?: boolean;
  };
  /** Creation timestamp */
  createdAt: string;
  /** Number of replies */
  replyCount: number;
  /** Number of unread replies for current user */
  unreadCount: number;
  /** Whether discussion is pinned */
  isPinned: boolean;
  /** Whether discussion is locked */
  isLocked: boolean;
  /** Last post information */
  lastPost: {
    author: string;
    timestamp: string;
    preview: string;
  } | null;
}

/**
 * User permissions for discussion actions
 */
export interface DiscussionPermissions {
  /** Can perform moderator actions */
  canModerate: boolean;
  /** Can pin/unpin discussions */
  canPin: boolean;
  /** Can lock/unlock discussions */
  canLock: boolean;
  /** Can delete discussions */
  canDelete: boolean;
}

/**
 * Current user information
 */
export interface CurrentUser {
  /** User ID */
  id: number;
  /** User display name */
  name: string;
}

/**
 * Props for DiscussionList component
 */
export interface DiscussionListProps {
  /** Forum ID */
  forumId: number;
  /** Current user */
  currentUser: CurrentUser;
  /** User permissions */
  permissions: DiscussionPermissions;
}

/**
 * Sort options for discussions
 */
type SortOption = 'newest' | 'oldest' | 'most-replies' | 'recently-updated';

/**
 * Filter options for discussions
 */
type FilterOption = 'all' | 'unread' | 'my-discussions' | 'pinned';

/**
 * Page size options
 */
type PageSizeOption = 10 | 20 | 50;

// ============================================================================
// COMPONENT
// ============================================================================

export const DiscussionList: React.FC<DiscussionListProps> = ({
  forumId,
  currentUser,
  permissions,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State management
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDiscussions, setSelectedDiscussions] = useState<Set<number>>(new Set());
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activeDiscussionId, setActiveDiscussionId] = useState<number | null>(null);

  // Refs
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page on new search
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Fetch discussions using React Query
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['discussions', forumId, sortBy, filterBy, currentPage, pageSize, debouncedSearch],
    staleTime: 30000, // 30 seconds
  });

  // Pin/Unpin mutation
  const pinMutation = useMutation({
    mutationFn: async (discussionId: number) => {
      // API call to pin/unpin discussion
      return { discussionId };
    },
    onMutate: async (discussionId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['discussions', forumId] });
      
      const previousData = queryClient.getQueryData(['discussions', forumId]);
      
      // Optimistically update the discussion
      queryClient.setQueryData(
        ['discussions', forumId, sortBy, filterBy, currentPage, pageSize, debouncedSearch],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            discussions: old.discussions.map((d: DiscussionListItem) =>
              d.id === discussionId ? { ...d, isPinned: !d.isPinned } : d
            ),
          };
        }
      );
      
      return { previousData };
    },
    onError: (err, discussionId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['discussions', forumId], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['discussions', forumId] });
    },
  });

  // Lock/Unlock mutation
  const lockMutation = useMutation({
    mutationFn: async (discussionId: number) => {
      // API call to lock/unlock discussion
      return { discussionId };
    },
    onMutate: async (discussionId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['discussions', forumId] });
      
      const previousData = queryClient.getQueryData(['discussions', forumId]);
      
      queryClient.setQueryData(
        ['discussions', forumId, sortBy, filterBy, currentPage, pageSize, debouncedSearch],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            discussions: old.discussions.map((d: DiscussionListItem) =>
              d.id === discussionId ? { ...d, isLocked: !d.isLocked } : d
            ),
          };
        }
      );
      
      return { previousData };
    },
    onError: (err, discussionId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['discussions', forumId], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['discussions', forumId] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (discussionId: number) => {
      // API call to delete discussion
      return { discussionId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discussions', forumId] });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (discussionIds: number[]) => {
      // API call to bulk delete discussions
      return { discussionIds };
    },
    onSuccess: () => {
      setSelectedDiscussions(new Set());
      queryClient.invalidateQueries({ queryKey: ['discussions', forumId] });
    },
  });

  // Bulk move mutation
  const bulkMoveMutation = useMutation({
    mutationFn: async ({ discussionIds, targetForumId }: { discussionIds: number[]; targetForumId: number }) => {
      // API call to bulk move discussions
      return { discussionIds, targetForumId };
    },
    onSuccess: () => {
      setSelectedDiscussions(new Set());
      queryClient.invalidateQueries({ queryKey: ['discussions', forumId] });
    },
  });

  // Sorted and filtered discussions
  const discussions = useMemo(() => {
    if (!data?.discussions) return [];

    let result = [...data.discussions];

    // Apply filter
    switch (filterBy) {
      case 'unread':
        result = result.filter(d => d.unreadCount > 0);
        break;
      case 'my-discussions':
        result = result.filter(d => d.author.id === currentUser.id);
        break;
      case 'pinned':
        result = result.filter(d => d.isPinned);
        break;
      case 'all':
      default:
        break;
    }

    // Apply search
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      result = result.filter(d => 
        d.title.toLowerCase().includes(searchLower) ||
        d.author.name.toLowerCase().includes(searchLower)
      );
    }

    // Apply sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'most-replies':
          return b.replyCount - a.replyCount;
        case 'recently-updated':
          const aTime = a.lastPost ? new Date(a.lastPost.timestamp).getTime() : new Date(a.createdAt).getTime();
          const bTime = b.lastPost ? new Date(b.lastPost.timestamp).getTime() : new Date(b.createdAt).getTime();
          return bTime - aTime;
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    // Pinned discussions always at top
    const pinned = result.filter(d => d.isPinned);
    const unpinned = result.filter(d => !d.isPinned);
    
    return [...pinned, ...unpinned];
  }, [data?.discussions, filterBy, debouncedSearch, sortBy, currentUser.id]);

  // Handlers
  const handleDiscussionClick = useCallback((discussionId: number) => {
    navigate(`/forums/${forumId}/discussions/${discussionId}`);
  }, [navigate, forumId]);

  const handleAuthorClick = useCallback((e: React.MouseEvent, authorId: number) => {
    e.stopPropagation();
    navigate(`/users/${authorId}`);
  }, [navigate]);

  const handlePinClick = useCallback((e: React.MouseEvent, discussionId: number) => {
    e.stopPropagation();
    pinMutation.mutate(discussionId);
  }, [pinMutation]);

  const handleLockClick = useCallback((e: React.MouseEvent, discussionId: number) => {
    e.stopPropagation();
    lockMutation.mutate(discussionId);
  }, [lockMutation]);

  const handleDeleteClick = useCallback((e: React.MouseEvent, discussionId: number) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this discussion?')) {
      deleteMutation.mutate(discussionId);
    }
  }, [deleteMutation]);

  const handleSelectAll = useCallback(() => {
    if (selectedDiscussions.size === discussions.length) {
      setSelectedDiscussions(new Set());
    } else {
      setSelectedDiscussions(new Set(discussions.map(d => d.id)));
    }
  }, [discussions, selectedDiscussions.size]);

  const handleSelectDiscussion = useCallback((discussionId: number) => {
    setSelectedDiscussions(prev => {
      const next = new Set(prev);
      if (next.has(discussionId)) {
        next.delete(discussionId);
      } else {
        next.add(discussionId);
      }
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (selectedDiscussions.size > 0) {
      if (window.confirm(`Delete ${selectedDiscussions.size} discussion(s)?`)) {
        bulkDeleteMutation.mutate(Array.from(selectedDiscussions));
      }
    }
  }, [selectedDiscussions, bulkDeleteMutation]);

  const handleBulkMove = useCallback((targetForumId: number) => {
    if (selectedDiscussions.size > 0) {
      bulkMoveMutation.mutate({
        discussionIds: Array.from(selectedDiscussions),
        targetForumId,
      });
    }
  }, [selectedDiscussions, bulkMoveMutation]);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearch('');
  }, []);

  const handleMenuOpen = useCallback((e: React.MouseEvent<HTMLElement>, discussionId: number) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setActiveDiscussionId(discussionId);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    setActiveDiscussionId(null);
  }, []);

  // Format date for display
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }, []);

  // Calculate total pages
  const totalPages = data ? Math.ceil(data.totalCount / pageSize) : 1;

  // Loading skeleton
  if (isLoading) {
    return (
      <Box sx={{ width: '100%' }}>
        {/* Search and controls skeleton */}
        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Skeleton variant="rectangular" width={300} height={56} />
          <Skeleton variant="rectangular" width={150} height={56} />
          <Skeleton variant="rectangular" width={150} height={56} />
        </Box>

        {/* Discussion list skeleton */}
        <List aria-label="Loading discussions">
          {[1, 2, 3, 4, 5].map((i) => (
            <ListItem key={i} divider>
              <ListItemAvatar>
                <Skeleton variant="circular" width={40} height={40} />
              </ListItemAvatar>
              <ListItemText
                primary={<Skeleton variant="text" width="60%" />}
                secondary={<Skeleton variant="text" width="40%" />}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  }

  // Error state
  if (isError) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      >
        {error instanceof Error ? error.message : 'Failed to load discussions'}
      </Alert>
    );
  }

  // Empty state
  if (!discussions || discussions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        {debouncedSearch ? (
          <>
            <Typography variant="h6" gutterBottom>
              No discussions found
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              No discussions match your search query "{debouncedSearch}"
            </Typography>
            <Button onClick={handleSearchClear} sx={{ mt: 2 }}>
              Clear Search
            </Button>
          </>
        ) : filterBy !== 'all' ? (
          <>
            <Typography variant="h6" gutterBottom>
              No discussions found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              There are no discussions matching the selected filter
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="h6" gutterBottom>
              No discussions yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Be the first to start a discussion!
            </Typography>
          </>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Search and controls */}
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
          {/* Search input */}
          <TextField
            fullWidth={isMobile}
            placeholder="Search discussions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
            sx={{ minWidth: isMobile ? 'auto' : 300 }}
          />

          {/* Sort dropdown */}
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel id="sort-label">Sort by</InputLabel>
            <Select
              labelId="sort-label"
              value={sortBy}
              label="Sort by"
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <MenuItem value="newest">Newest first</MenuItem>
              <MenuItem value="oldest">Oldest first</MenuItem>
              <MenuItem value="most-replies">Most replies</MenuItem>
              <MenuItem value="recently-updated">Recently updated</MenuItem>
            </Select>
          </FormControl>

          {/* Filter dropdown */}
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel id="filter-label">Filter</InputLabel>
            <Select
              labelId="filter-label"
              value={filterBy}
              label="Filter"
              onChange={(e) => setFilterBy(e.target.value as FilterOption)}
            >
              <MenuItem value="all">All discussions</MenuItem>
              <MenuItem value="unread">Unread only</MenuItem>
              <MenuItem value="my-discussions">My discussions</MenuItem>
              <MenuItem value="pinned">Pinned only</MenuItem>
            </Select>
          </FormControl>

          {/* Page size dropdown */}
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel id="pagesize-label">Per page</InputLabel>
            <Select
              labelId="pagesize-label"
              value={pageSize}
              label="Per page"
              onChange={(e) => {
                setPageSize(e.target.value as PageSizeOption);
                setCurrentPage(1);
              }}
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {/* Bulk actions */}
        {permissions.canModerate && (
          <Stack direction="row" spacing={2} alignItems="center">
            <Checkbox
              checked={selectedDiscussions.size === discussions.length && discussions.length > 0}
              indeterminate={selectedDiscussions.size > 0 && selectedDiscussions.size < discussions.length}
              onChange={handleSelectAll}
              inputProps={{ 'aria-label': 'Select all discussions' }}
            />
            <Typography variant="body2" color="text.secondary">
              {selectedDiscussions.size > 0
                ? `${selectedDiscussions.size} selected`
                : 'Select all'}
            </Typography>
            {selectedDiscussions.size > 0 && (
              <>
                <Button
                  size="small"
                  startIcon={<DeleteIcon />}
                  onClick={handleBulkDelete}
                  color="error"
                >
                  Bulk Delete
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    // This would open a dialog to select target forum
                    const targetId = prompt('Enter target forum ID:');
                    if (targetId) {
                      handleBulkMove(parseInt(targetId, 10));
                    }
                  }}
                >
                  Bulk Move
                </Button>
              </>
            )}
          </Stack>
        )}
      </Stack>

      {/* Discussion list */}
      <List
        aria-label="Discussions"
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
        }}
      >
        {discussions.map((discussion, index) => {
          const isSelected = selectedDiscussions.has(discussion.id);
          const canPin = permissions.canPin;
          const canLock = permissions.canLock;
          const canDelete = permissions.canDelete || discussion.author.id === currentUser.id;

          return (
            <React.Fragment key={discussion.id}>
              <ListItem
                disablePadding
                secondaryAction={
                  !isMobile && (canPin || canLock || canDelete) ? (
                    <Stack direction="row" spacing={1}>
                      {canPin && (
                        <Tooltip title={discussion.isPinned ? 'Unpin' : 'Pin'}>
                          <IconButton
                            edge="end"
                            aria-label={discussion.isPinned ? 'Unpin discussion' : 'Pin discussion'}
                            onClick={(e) => handlePinClick(e, discussion.id)}
                            color={discussion.isPinned ? 'primary' : 'default'}
                          >
                            <PinIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canLock && (
                        <Tooltip title={discussion.isLocked ? 'Unlock' : 'Lock'}>
                          <IconButton
                            edge="end"
                            aria-label={discussion.isLocked ? 'Unlock discussion' : 'Lock discussion'}
                            onClick={(e) => handleLockClick(e, discussion.id)}
                            color={discussion.isLocked ? 'warning' : 'default'}
                          >
                            <LockIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip title="Delete">
                          <IconButton
                            edge="end"
                            aria-label="Delete discussion"
                            onClick={(e) => handleDeleteClick(e, discussion.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  ) : isMobile && (canPin || canLock || canDelete) ? (
                    <IconButton
                      edge="end"
                      aria-label="More actions"
                      onClick={(e) => handleMenuOpen(e, discussion.id)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  ) : null
                }
              >
                <ListItemButton
                  onClick={() => handleDiscussionClick(discussion.id)}
                  sx={{ pl: permissions.canModerate ? 1 : 2 }}
                >
                  {permissions.canModerate && (
                    <Checkbox
                      edge="start"
                      checked={isSelected}
                      tabIndex={-1}
                      disableRipple
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectDiscussion(discussion.id);
                      }}
                      inputProps={{ 'aria-label': `Select ${discussion.title}` }}
                      sx={{ mr: 1 }}
                    />
                  )}

                  <ListItemAvatar>
                    <Tooltip title={discussion.author.name}>
                      <Avatar
                        src={discussion.author.avatarUrl || undefined}
                        alt={discussion.author.name}
                        onClick={(e) => handleAuthorClick(e, discussion.author.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        {discussion.author.isDeleted ? (
                          <PersonIcon />
                        ) : (
                          discussion.author.name.charAt(0).toUpperCase()
                        )}
                      </Avatar>
                    </Tooltip>
                  </ListItemAvatar>

                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography
                          variant="subtitle1"
                          component="span"
                          sx={{
                            fontWeight: discussion.unreadCount > 0 ? 600 : 400,
                          }}
                        >
                          {discussion.title}
                        </Typography>
                        
                        {discussion.isPinned && (
                          <Chip
                            icon={<PinIcon />}
                            label="Pinned"
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        )}
                        
                        {discussion.isLocked && (
                          <Chip
                            icon={<LockIcon />}
                            label="Locked"
                            size="small"
                            color="warning"
                            variant="outlined"
                            aria-label="Locked discussion"
                          />
                        )}
                        
                        {discussion.unreadCount > 0 && (
                          <Badge
                            badgeContent={discussion.unreadCount}
                            color="error"
                            aria-label={`${discussion.unreadCount} unread ${discussion.unreadCount === 1 ? 'reply' : 'replies'}`}
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          Started by{' '}
                          <Typography
                            component="span"
                            variant="body2"
                            color="primary"
                            sx={{
                              cursor: 'pointer',
                              '&:hover': { textDecoration: 'underline' },
                            }}
                            onClick={(e) => handleAuthorClick(e, discussion.author.id)}
                          >
                            {discussion.author.name}
                          </Typography>
                          {' · '}
                          {formatDate(discussion.createdAt)}
                          {!isMobile && (
                            <>
                              {' · '}
                              {discussion.replyCount}{' '}
                              {discussion.replyCount === 1 ? 'reply' : 'replies'}
                            </>
                          )}
                        </Typography>

                        {!isMobile && discussion.lastPost && (
                          <Typography variant="caption" color="text.secondary">
                            Last post by {discussion.lastPost.author}{' '}
                            {formatDate(discussion.lastPost.timestamp)}
                            {discussion.lastPost.preview && (
                              <> · {discussion.lastPost.preview.substring(0, 100)}...</>
                            )}
                          </Typography>
                        )}

                        {isMobile && (
                          <Typography variant="caption" color="text.secondary">
                            {discussion.replyCount}{' '}
                            {discussion.replyCount === 1 ? 'reply' : 'replies'}
                          </Typography>
                        )}
                      </Stack>
                    }
                  />
                </ListItemButton>
              </ListItem>
              
              {index < discussions.length - 1 && <Divider component="li" />}
            </React.Fragment>
          );
        })}
      </List>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(_, page) => setCurrentPage(page)}
            color="primary"
            showFirstButton
            showLastButton
            aria-label="Discussion list pagination"
          />
        </Box>
      )}

      {/* Mobile action menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {activeDiscussionId && permissions.canPin && (
          <MenuItem
            onClick={() => {
              handlePinClick({} as any, activeDiscussionId);
              handleMenuClose();
            }}
          >
            <PinIcon sx={{ mr: 1 }} />
            {discussions.find(d => d.id === activeDiscussionId)?.isPinned ? 'Unpin' : 'Pin'}
          </MenuItem>
        )}
        {activeDiscussionId && permissions.canLock && (
          <MenuItem
            onClick={() => {
              handleLockClick({} as any, activeDiscussionId);
              handleMenuClose();
            }}
          >
            <LockIcon sx={{ mr: 1 }} />
            {discussions.find(d => d.id === activeDiscussionId)?.isLocked ? 'Unlock' : 'Lock'}
          </MenuItem>
        )}
        {activeDiscussionId && permissions.canDelete && (
          <MenuItem
            onClick={() => {
              handleDeleteClick({} as any, activeDiscussionId);
              handleMenuClose();
            }}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default DiscussionList;
