/**
 * Timeline Widget Component
 *
 * A dashboard widget that displays a chronological view of upcoming and overdue
 * activities with sorting and filtering options. Based on Moodle's block_timeline
 * (public/blocks/timeline/block_timeline.php).
 *
 * Features:
 * - Filter tabs (All, Overdue, Next 7 days, Next 30 days, etc.)
 * - Sort options (by date or by course)
 * - Activity type icons with visual distinction
 * - Relative due dates with color coding (red for overdue, orange for soon, green for future)
 * - Mark as done functionality with optimistic updates
 * - Local storage persistence for user preferences
 * - Loading and empty states
 *
 * @package    react-frontend
 * @subpackage dashboard/widgets
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Tabs,
  Tab,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  CircularProgress,
  IconButton,
  Badge,
  Divider,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Quiz as QuizIcon,
  Event as EventIcon,
  Forum as ForumIcon,
  Check as CheckIcon,
  CheckCircle as CheckCircleIcon,
  Sort as SortIcon,
  MoreVert as MoreVertIcon,
  School as SchoolIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

import { useTimeline } from '@/features/dashboard/api/dashboardApi';
import type {
  TimelineItem,
  TimelinePreferences,
} from '@/features/dashboard/types/dashboard.types';
import { TimelineFilter, TimelineSort, TimelineLimit } from '@/features/dashboard/types/dashboard.types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { formatDate } from '@/utils/date';

// ============================================================================
// Constants
// ============================================================================

/**
 * Local storage key for timeline preferences
 */
const TIMELINE_PREFERENCES_KEY = 'moodle_timeline_preferences';

/**
 * Default preferences for timeline display
 */
const DEFAULT_PREFERENCES: TimelinePreferences = {
  sort: TimelineSort.BY_DATES,
  filter: TimelineFilter.ALL,
  limit: 10 as TimelineLimit,
};

/**
 * Filter tab labels for user display
 */
const FILTER_LABELS: Record<TimelineFilter, string> = {
  [TimelineFilter.ALL]: 'All',
  [TimelineFilter.OVERDUE]: 'Overdue',
  [TimelineFilter.NEXT_7_DAYS]: 'Next 7 days',
  [TimelineFilter.NEXT_30_DAYS]: 'Next 30 days',
  [TimelineFilter.NEXT_3_MONTHS]: 'Next 3 months',
  [TimelineFilter.NEXT_6_MONTHS]: 'Next 6 months',
};

/**
 * Sort option labels for user display
 */
const SORT_LABELS: Record<TimelineSort, string> = {
  [TimelineSort.BY_DATES]: 'Sort by dates',
  [TimelineSort.BY_COURSES]: 'Sort by courses',
};

/**
 * Available item limit options
 */
const LIMIT_OPTIONS: TimelineLimit[] = [5, 10, 15, 20];

/**
 * Map activity types to their corresponding icons
 */
const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  assign: <AssignmentIcon />,
  assignment: <AssignmentIcon />,
  quiz: <QuizIcon />,
  forum: <ForumIcon />,
  lesson: <SchoolIcon />,
  workshop: <SchoolIcon />,
  default: <EventIcon />,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the icon for an activity type
 *
 * @param activityType - The type of activity (e.g., 'assign', 'quiz', 'forum')
 * @returns The corresponding Material-UI icon component
 */
function getActivityIcon(activityType: string): React.ReactNode {
  const normalizedType = activityType.toLowerCase();
  return ACTIVITY_ICONS[normalizedType] || ACTIVITY_ICONS.default;
}

/**
 * Format a due date as a relative string with color indication
 *
 * @param dueDate - Unix timestamp in seconds
 * @param overdue - Whether the item is overdue
 * @returns Object containing text and color for the due date
 */
function formatDueDate(dueDate: number, overdue: boolean): { text: string; color: string } {
  const now = Date.now();
  const dueDateMs = dueDate * 1000; // Convert to milliseconds
  const diffMs = dueDateMs - now;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (overdue) {
    const overdueDays = Math.abs(diffDays);
    if (overdueDays === 0) {
      return { text: 'Overdue today', color: 'error.main' };
    } else if (overdueDays === 1) {
      return { text: 'Overdue by 1 day', color: 'error.main' };
    }
    return { text: `Overdue by ${overdueDays} days`, color: 'error.main' };
  }

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    if (overdueDays === 1) {
      return { text: 'Overdue by 1 day', color: 'error.main' };
    }
    return { text: `Overdue by ${overdueDays} days`, color: 'error.main' };
  }

  if (diffDays === 0) {
    return { text: 'Due today', color: 'warning.main' };
  }

  if (diffDays === 1) {
    return { text: 'Due tomorrow', color: 'warning.main' };
  }

  if (diffDays <= 3) {
    return { text: `Due in ${diffDays} days`, color: 'warning.main' };
  }

  if (diffDays <= 7) {
    return { text: `Due in ${diffDays} days`, color: 'info.main' };
  }

  return { text: `Due in ${diffDays} days`, color: 'success.main' };
}

/**
 * Get the color for a course based on its ID
 * Creates a consistent color for each course using a hash
 *
 * @param courseId - The course ID
 * @returns A hex color string
 */
function getCourseColor(courseId: number): string {
  const colors: readonly string[] = [
    '#1976d2', // Blue
    '#388e3c', // Green
    '#f57c00', // Orange
    '#7b1fa2', // Purple
    '#c62828', // Red
    '#00838f', // Teal
    '#6d4c41', // Brown
    '#455a64', // Blue Grey
  ] as const;
  // Use non-null assertion since we know the array has elements and modulo guarantees valid index
  return colors[courseId % colors.length] ?? '#1976d2';
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Props for the TimelineItemRow component
 */
interface TimelineItemRowProps {
  item: TimelineItem;
  onMarkDone: (itemId: number) => void;
}

/**
 * Individual timeline item row component
 *
 * Displays a single activity item with its icon, name, course, due date,
 * and mark as done button.
 */
const TimelineItemRow: React.FC<TimelineItemRowProps> = React.memo(({ item, onMarkDone }) => {
  const dueInfo = formatDueDate(item.duedate, item.overdue);
  const courseColor = getCourseColor(item.courseid);

  const handleMarkDone = useCallback(() => {
    onMarkDone(item.id);
  }, [item.id, onMarkDone]);

  const handleItemClick = useCallback(() => {
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  }, [item.url]);

  return (
    <ListItem
      sx={{
        py: 1.5,
        px: 2,
        '&:hover': {
          backgroundColor: 'action.hover',
          cursor: item.url ? 'pointer' : 'default',
        },
        opacity: item.completed ? 0.6 : 1,
      }}
      secondaryAction={
        <Tooltip title={item.completed ? 'Completed' : 'Mark as done'}>
          <IconButton
            edge="end"
            aria-label={item.completed ? 'Completed' : 'Mark as done'}
            onClick={handleMarkDone}
            color={item.completed ? 'success' : 'default'}
            size="small"
          >
            {item.completed ? <CheckCircleIcon /> : <CheckIcon />}
          </IconButton>
        </Tooltip>
      }
    >
      <ListItemIcon
        sx={{
          minWidth: 40,
          color: item.overdue ? 'error.main' : 'primary.main',
        }}
      >
        {item.overdue && !item.completed ? (
          <Badge
            badgeContent={<WarningIcon sx={{ fontSize: 12 }} />}
            color="error"
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            {getActivityIcon(item.activitytype)}
          </Badge>
        ) : (
          getActivityIcon(item.activitytype)
        )}
      </ListItemIcon>
      <ListItemText
        onClick={handleItemClick}
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                textDecoration: item.completed ? 'line-through' : 'none',
              }}
            >
              {item.name}
            </Typography>
            <Chip
              label={item.course}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                backgroundColor: courseColor,
                color: 'white',
              }}
            />
          </Box>
        }
        secondary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: dueInfo.color }}>
              {dueInfo.text}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              • {formatDate(item.duedate * 1000)}
            </Typography>
          </Box>
        }
      />
    </ListItem>
  );
});

TimelineItemRow.displayName = 'TimelineItemRow';

/**
 * Empty state component when no timeline items are found
 */
interface EmptyStateProps {
  filter: TimelineFilter;
}

const EmptyState: React.FC<EmptyStateProps> = ({ filter }) => {
  const getMessage = (): string => {
    switch (filter) {
      case TimelineFilter.OVERDUE:
        return 'No overdue activities. Great job staying on track!';
      case TimelineFilter.NEXT_7_DAYS:
        return 'No activities due in the next 7 days.';
      case TimelineFilter.NEXT_30_DAYS:
        return 'No activities due in the next 30 days.';
      case TimelineFilter.NEXT_3_MONTHS:
        return 'No activities due in the next 3 months.';
      case TimelineFilter.NEXT_6_MONTHS:
        return 'No activities due in the next 6 months.';
      default:
        return 'No upcoming activities found.';
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        px: 2,
        textAlign: 'center',
      }}
    >
      <EventIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
      <Typography variant="body1" color="text.secondary">
        {getMessage()}
      </Typography>
    </Box>
  );
};

/**
 * Loading state component
 */
const LoadingState: React.FC = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      py: 6,
    }}
  >
    <CircularProgress size={32} />
    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
      Loading timeline...
    </Typography>
  </Box>
);

/**
 * Error state component
 */
interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      py: 6,
      px: 2,
      textAlign: 'center',
    }}
  >
    <ErrorIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
    <Typography variant="body1" color="error" sx={{ mb: 2 }}>
      {message}
    </Typography>
    <Chip
      label="Retry"
      onClick={onRetry}
      color="primary"
      clickable
    />
  </Box>
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * Timeline Widget Component
 *
 * Displays a chronological list of upcoming activities with filtering,
 * sorting, and mark-as-done functionality. Persists user preferences
 * to localStorage.
 *
 * @example
 * ```tsx
 * <TimelineWidget />
 * ```
 */
const TimelineWidget: React.FC = () => {
  // Persist preferences to localStorage
  const [preferences, setPreferences] = useLocalStorage<TimelinePreferences>(
    TIMELINE_PREFERENCES_KEY,
    DEFAULT_PREFERENCES
  );

  // Menu state for sort options
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null);
  const sortMenuOpen = Boolean(sortMenuAnchor);

  // Menu state for more options (limit)
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const moreMenuOpen = Boolean(moreMenuAnchor);

  // Local state for optimistically marked items
  const [markedItems, setMarkedItems] = useState<Set<number>>(new Set());

  // Fetch timeline data using React Query
  const {
    data: timelineData,
    isLoading,
    isError,
    error,
    refetch,
  } = useTimeline(preferences);

  // Get the current filter tab index
  const filterValues = Object.values(TimelineFilter);
  const currentTabIndex = filterValues.indexOf(preferences.filter);

  /**
   * Handle filter tab change
   */
  const handleFilterChange = useCallback(
    (_event: React.SyntheticEvent, newValue: number) => {
      const newFilter = filterValues[newValue];
      // Only update if we got a valid filter value
      if (newFilter !== undefined) {
        setPreferences((prev) => ({
          ...prev,
          filter: newFilter,
        }));
      }
    },
    [filterValues, setPreferences]
  );

  /**
   * Handle sort menu open
   */
  const handleSortMenuOpen = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setSortMenuAnchor(event.currentTarget);
  }, []);

  /**
   * Handle sort menu close
   */
  const handleSortMenuClose = useCallback(() => {
    setSortMenuAnchor(null);
  }, []);

  /**
   * Handle sort option selection
   */
  const handleSortChange = useCallback(
    (sort: TimelineSort) => {
      setPreferences((prev) => ({
        ...prev,
        sort,
      }));
      handleSortMenuClose();
    },
    [setPreferences, handleSortMenuClose]
  );

  /**
   * Handle more menu open
   */
  const handleMoreMenuOpen = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setMoreMenuAnchor(event.currentTarget);
  }, []);

  /**
   * Handle more menu close
   */
  const handleMoreMenuClose = useCallback(() => {
    setMoreMenuAnchor(null);
  }, []);

  /**
   * Handle limit change
   */
  const handleLimitChange = useCallback(
    (limit: TimelineLimit) => {
      setPreferences((prev) => ({
        ...prev,
        limit,
      }));
      handleMoreMenuClose();
    },
    [setPreferences, handleMoreMenuClose]
  );

  /**
   * Handle marking an item as done (optimistic update)
   */
  const handleMarkDone = useCallback((itemId: number) => {
    setMarkedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
    // In a real implementation, this would call an API to persist the change
    // For now, we just toggle the local state
  }, []);

  /**
   * Handle retry on error
   */
  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  /**
   * Memoized timeline items with optimistic updates applied
   */
  const displayItems = useMemo(() => {
    if (!timelineData?.items) {
      return [];
    }

    return timelineData.items.map((item) => ({
      ...item,
      completed: item.completed || markedItems.has(item.id),
    }));
  }, [timelineData?.items, markedItems]);

  /**
   * Count of overdue items for badge display
   */
  const overdueCount = useMemo(() => {
    if (!timelineData?.items) {
      return 0;
    }
    return timelineData.items.filter(
      (item) => item.overdue && !item.completed && !markedItems.has(item.id)
    ).length;
  }, [timelineData?.items, markedItems]);

  return (
    <Card elevation={1} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" component="span">
              Timeline
            </Typography>
            {overdueCount > 0 && (
              <Chip
                label={overdueCount}
                size="small"
                color="error"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={SORT_LABELS[preferences.sort]}>
              <IconButton
                size="small"
                onClick={handleSortMenuOpen}
                aria-label="Sort options"
                aria-haspopup="true"
                aria-expanded={sortMenuOpen ? 'true' : undefined}
              >
                <SortIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="More options">
              <IconButton
                size="small"
                onClick={handleMoreMenuOpen}
                aria-label="More options"
                aria-haspopup="true"
                aria-expanded={moreMenuOpen ? 'true' : undefined}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        }
        sx={{ pb: 0 }}
      />

      {/* Sort Menu */}
      <Menu
        anchorEl={sortMenuAnchor}
        open={sortMenuOpen}
        onClose={handleSortMenuClose}
        MenuListProps={{
          'aria-labelledby': 'sort-button',
        }}
      >
        {Object.entries(SORT_LABELS).map(([value, label]) => (
          <MenuItem
            key={value}
            onClick={() => handleSortChange(value as TimelineSort)}
            selected={preferences.sort === value}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>

      {/* More Options Menu */}
      <Menu
        anchorEl={moreMenuAnchor}
        open={moreMenuOpen}
        onClose={handleMoreMenuClose}
        MenuListProps={{
          'aria-labelledby': 'more-button',
        }}
      >
        <MenuItem disabled sx={{ opacity: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Show items
          </Typography>
        </MenuItem>
        {LIMIT_OPTIONS.map((limit) => (
          <MenuItem
            key={limit}
            onClick={() => handleLimitChange(limit)}
            selected={preferences.limit === limit}
          >
            {limit} items
          </MenuItem>
        ))}
      </Menu>

      {/* Filter Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}>
        <Tabs
          value={currentTabIndex >= 0 ? currentTabIndex : 0}
          onChange={handleFilterChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Timeline filter tabs"
          sx={{
            minHeight: 36,
            '& .MuiTab-root': {
              minHeight: 36,
              py: 0.5,
              px: 1.5,
              fontSize: '0.75rem',
              textTransform: 'none',
            },
          }}
        >
          {filterValues.map((filter) => (
            <Tab
              key={filter}
              label={
                filter === TimelineFilter.OVERDUE && overdueCount > 0 ? (
                  <Badge badgeContent={overdueCount} color="error" max={99}>
                    <Box component="span" sx={{ pr: 1.5 }}>
                      {FILTER_LABELS[filter]}
                    </Box>
                  </Badge>
                ) : (
                  FILTER_LABELS[filter]
                )
              }
              id={`timeline-tab-${filter}`}
              aria-controls={`timeline-tabpanel-${filter}`}
            />
          ))}
        </Tabs>
      </Box>

      {/* Content */}
      <CardContent
        sx={{
          flex: 1,
          p: 0,
          overflow: 'auto',
          '&:last-child': { pb: 0 },
        }}
      >
        {isLoading && <LoadingState />}

        {isError && (
          <ErrorState
            message={error instanceof Error ? error.message : 'Failed to load timeline'}
            onRetry={handleRetry}
          />
        )}

        {!isLoading && !isError && displayItems.length === 0 && (
          <EmptyState filter={preferences.filter} />
        )}

        {!isLoading && !isError && displayItems.length > 0 && (
          <List disablePadding>
            {displayItems.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <Divider component="li" />}
                <TimelineItemRow item={item} onMarkDone={handleMarkDone} />
              </React.Fragment>
            ))}
          </List>
        )}

        {/* Show more indicator */}
        {!isLoading && !isError && timelineData?.hasMore && (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Showing {displayItems.length} of {timelineData.total} items
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default TimelineWidget;
