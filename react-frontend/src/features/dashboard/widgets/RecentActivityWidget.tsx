/**
 * Recent Activity Widget Component
 *
 * A dashboard widget that displays a chronological feed of recent course activities
 * including new content, submissions, forum posts, grade changes, and user enrollments.
 * This component provides a Material-UI styled interface with React Query data fetching.
 *
 * Based on Moodle's recent_activity block:
 * - public/blocks/recent_activity/block_recent_activity.php
 * - public/blocks/recent_activity/renderer.php
 *
 * Features:
 * - Chronological activity display with relative timestamps
 * - Activity type-specific icons from Material-UI icons library
 * - Date grouping for improved organization when many items exist
 * - Configurable time range (since last access or last 48 hours)
 * - Load more pagination for infinite scroll behavior
 * - Loading skeleton during fetch
 * - Empty state handling with informative messages
 * - Full accessibility support (WCAG 2.1 AA compliant)
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  CircularProgress,
  Button,
  Divider,
  Skeleton,
  Alert,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Quiz as QuizIcon,
  Forum as ForumIcon,
  Edit as EditIcon,
  PersonAdd as PersonAddIcon,
  Grade as GradeIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Update as UpdateIcon,
} from '@mui/icons-material';

import { useRecentActivity } from '@/features/dashboard/api/dashboardApi';
import { formatDate, formatRelativeTime } from '@/utils/date';
import { ActivityType } from '@/features/dashboard/types/dashboard.types';
import type { RecentActivityItem } from '@/features/dashboard/types/dashboard.types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default number of activities to display initially
 */
const DEFAULT_ITEMS_LIMIT = 10;

/**
 * Number of additional items to load on "Load more" click
 */
const LOAD_MORE_INCREMENT = 10;

/**
 * Default time range in seconds (48 hours)
 */
const DEFAULT_TIME_RANGE_SECONDS = 48 * 60 * 60;

/**
 * Date format for date group headers
 */
const DATE_GROUP_FORMAT = 'EEEE, MMMM d, yyyy';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the RecentActivityWidget component
 */
export interface RecentActivityWidgetProps {
  /**
   * Course ID to fetch recent activity for
   */
  readonly courseId: number;
  
  /**
   * Optional title override for the widget
   * @default "Recent Activity"
   */
  readonly title?: string;
  
  /**
   * Use time since last access instead of fixed time range
   * @default false
   */
  readonly useSinceLastAccess?: boolean;
  
  /**
   * Unix timestamp of last access (required if useSinceLastAccess is true)
   */
  readonly lastAccessTimestamp?: number;
  
  /**
   * Initial number of items to display
   * @default 10
   */
  readonly initialLimit?: number;
  
  /**
   * Whether to group activities by date
   * @default true when more than 10 items
   */
  readonly groupByDate?: boolean;
  
  /**
   * Whether to show the course name in activity items
   * @default false
   */
  readonly showCourseName?: boolean;
  
  /**
   * Callback when an activity item is clicked
   */
  readonly onActivityClick?: (activity: RecentActivityItem) => void;
}

/**
 * Activity grouped by date for display
 */
interface DateGroup {
  readonly date: string;
  readonly displayDate: string;
  readonly items: readonly RecentActivityItem[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the appropriate icon component for an activity type
 *
 * Maps each ActivityType to a corresponding Material-UI icon for
 * visual identification in the activity feed.
 *
 * @param type - The activity type
 * @returns React element with the appropriate icon
 */
function getActivityIcon(type: ActivityType): React.ReactElement {
  switch (type) {
    case ActivityType.FORUM_POST:
      return <ForumIcon aria-hidden="true" />;
    case ActivityType.ASSIGNMENT_SUBMISSION:
      return <AssignmentIcon aria-hidden="true" />;
    case ActivityType.QUIZ_ATTEMPT:
      return <QuizIcon aria-hidden="true" />;
    case ActivityType.GRADE_CHANGE:
      return <GradeIcon aria-hidden="true" />;
    case ActivityType.USER_ENROLLMENT:
      return <PersonAddIcon aria-hidden="true" />;
    case ActivityType.CONTENT_ADDED:
    case ActivityType.COURSE_MODULE_CREATED:
      return <AddIcon aria-hidden="true" />;
    case ActivityType.CONTENT_UPDATED:
    case ActivityType.COURSE_MODULE_UPDATED:
      return <EditIcon aria-hidden="true" />;
    case ActivityType.CONTENT_DELETED:
    case ActivityType.COURSE_MODULE_DELETED:
      return <DeleteIcon aria-hidden="true" />;
    default:
      return <UpdateIcon aria-hidden="true" />;
  }
}

/**
 * Get the color for an activity type icon
 *
 * Provides visual differentiation between activity types through
 * consistent color coding.
 *
 * @param type - The activity type
 * @returns Material-UI color string
 */
function getActivityColor(
  type: ActivityType
): 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' {
  switch (type) {
    case ActivityType.FORUM_POST:
      return 'info';
    case ActivityType.ASSIGNMENT_SUBMISSION:
      return 'primary';
    case ActivityType.QUIZ_ATTEMPT:
      return 'secondary';
    case ActivityType.GRADE_CHANGE:
      return 'success';
    case ActivityType.USER_ENROLLMENT:
      return 'success';
    case ActivityType.CONTENT_ADDED:
    case ActivityType.COURSE_MODULE_CREATED:
      return 'success';
    case ActivityType.CONTENT_UPDATED:
    case ActivityType.COURSE_MODULE_UPDATED:
      return 'warning';
    case ActivityType.CONTENT_DELETED:
    case ActivityType.COURSE_MODULE_DELETED:
      return 'error';
    default:
      return 'primary';
  }
}

/**
 * Get a human-readable label for an activity type
 *
 * @param type - The activity type
 * @returns Localized activity type label
 */
function getActivityTypeLabel(type: ActivityType): string {
  switch (type) {
    case ActivityType.FORUM_POST:
      return 'Forum post';
    case ActivityType.ASSIGNMENT_SUBMISSION:
      return 'Assignment submission';
    case ActivityType.QUIZ_ATTEMPT:
      return 'Quiz attempt';
    case ActivityType.GRADE_CHANGE:
      return 'Grade change';
    case ActivityType.USER_ENROLLMENT:
      return 'User enrollment';
    case ActivityType.CONTENT_ADDED:
      return 'Content added';
    case ActivityType.CONTENT_UPDATED:
      return 'Content updated';
    case ActivityType.CONTENT_DELETED:
      return 'Content deleted';
    case ActivityType.COURSE_MODULE_CREATED:
      return 'Module created';
    case ActivityType.COURSE_MODULE_UPDATED:
      return 'Module updated';
    case ActivityType.COURSE_MODULE_DELETED:
      return 'Module deleted';
    default:
      return 'Activity';
  }
}

/**
 * Get a display-friendly date string for grouping
 *
 * Returns "Today", "Yesterday", or the formatted date for older dates.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Display-friendly date string
 */
function getDateGroupLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Check if same day
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return 'Today';
  }

  // Check if yesterday
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday';
  }

  // Return formatted date for older dates
  return formatDate(timestamp, DATE_GROUP_FORMAT);
}

/**
 * Get the date key for grouping (YYYY-MM-DD format)
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Date key string
 */
function getDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Group activities by date
 *
 * Organizes activities into date groups for better visual organization
 * when displaying many items.
 *
 * @param items - Array of activity items
 * @returns Array of date groups with activities
 */
function groupActivitiesByDate(items: readonly RecentActivityItem[]): readonly DateGroup[] {
  const groups = new Map<string, RecentActivityItem[]>();

  // Group items by date
  for (const item of items) {
    // Convert Unix timestamp (seconds) to milliseconds for JS Date
    const timestampMs = item.timestamp * 1000;
    const dateKey = getDateKey(timestampMs);
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(dateKey, [item]);
    }
  }

  // Convert map to array and sort by date (newest first)
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  return sortedKeys.map((dateKey) => {
    const groupItems = groups.get(dateKey) ?? [];
    // Get timestamp from first item for display date calculation
    const firstItemTimestamp = groupItems[0]?.timestamp ?? Date.now() / 1000;
    return {
      date: dateKey,
      displayDate: getDateGroupLabel(firstItemTimestamp * 1000),
      items: groupItems,
    };
  });
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Loading skeleton for the widget
 */
function ActivitySkeleton(): React.ReactElement {
  return (
    <Box role="status" aria-label="Loading activities">
      {[1, 2, 3, 4, 5].map((index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', py: 1, px: 2 }}>
          <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={20} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Empty state component when no activities are found
 */
interface EmptyStateProps {
  readonly message?: string;
}

function EmptyState({ message }: EmptyStateProps): React.ReactElement {
  return (
    <Alert
      severity="info"
      sx={{ m: 2 }}
      role="status"
      aria-live="polite"
    >
      {message ?? 'No recent activity to display. Check back later for updates.'}
    </Alert>
  );
}

/**
 * Single activity item component
 */
interface ActivityItemProps {
  readonly activity: RecentActivityItem;
  readonly showCourseName: boolean;
  readonly onClick?: (activity: RecentActivityItem) => void;
}

function ActivityItem({
  activity,
  showCourseName,
  onClick,
}: ActivityItemProps): React.ReactElement {
  const handleClick = useCallback(() => {
    onClick?.(activity);
  }, [activity, onClick]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick?.(activity);
      }
    },
    [activity, onClick]
  );

  // Convert Unix timestamp (seconds) to milliseconds for relative time
  const relativeTime = formatRelativeTime(activity.timestamp * 1000);
  const activityLabel = getActivityTypeLabel(activity.type);
  const iconColor = getActivityColor(activity.type);

  const primaryText = (
    <Typography
      component="span"
      variant="body2"
      sx={{ fontWeight: 500 }}
    >
      {activity.action}
    </Typography>
  );

  const secondaryContent = (
    <Box component="span" sx={{ display: 'flex', flexDirection: 'column' }}>
      <Typography
        component="span"
        variant="body2"
        color="text.secondary"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
      >
        <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
          {activity.username}
        </Typography>
        {' • '}
        <Typography component="span" variant="body2">
          {activity.resourcename}
        </Typography>
      </Typography>
      <Typography
        component="span"
        variant="caption"
        color="text.secondary"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}
      >
        {showCourseName && (
          <>
            <Typography component="span" variant="caption">
              {activity.coursename}
            </Typography>
            {' • '}
          </>
        )}
        <Typography component="span" variant="caption">
          {relativeTime}
        </Typography>
      </Typography>
    </Box>
  );

  return (
    <ListItem
      component={onClick ? 'button' : 'li'}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      sx={{
        py: 1.5,
        px: 2,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick
          ? {
              backgroundColor: 'action.hover',
            }
          : undefined,
        border: 'none',
        background: 'none',
        width: '100%',
        textAlign: 'left',
      }}
      aria-label={`${activityLabel}: ${activity.action} by ${activity.username}, ${relativeTime}`}
      tabIndex={onClick ? 0 : undefined}
    >
      <ListItemIcon
        sx={{
          minWidth: 48,
          color: `${iconColor}.main`,
        }}
      >
        {getActivityIcon(activity.type)}
      </ListItemIcon>
      <ListItemText
        primary={primaryText}
        secondary={secondaryContent}
        primaryTypographyProps={{
          component: 'div',
        }}
        secondaryTypographyProps={{
          component: 'div',
        }}
      />
    </ListItem>
  );
}

/**
 * Date group header component
 */
interface DateGroupHeaderProps {
  readonly displayDate: string;
}

function DateGroupHeader({ displayDate }: DateGroupHeaderProps): React.ReactElement {
  return (
    <Box
      sx={{
        px: 2,
        py: 1,
        backgroundColor: 'grey.100',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Typography
        variant="subtitle2"
        color="text.secondary"
        sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}
      >
        {displayDate}
      </Typography>
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * RecentActivityWidget Component
 *
 * Displays a chronological feed of recent course activities including new content,
 * submissions, forum posts, grade changes, and user enrollments. The widget uses
 * Material-UI styling and React Query for efficient data fetching with caching.
 *
 * @param props - Component props
 * @returns React element
 *
 * @example
 * ```tsx
 * // Basic usage
 * <RecentActivityWidget courseId={101} />
 *
 * // With custom configuration
 * <RecentActivityWidget
 *   courseId={101}
 *   title="Course Updates"
 *   useSinceLastAccess
 *   lastAccessTimestamp={1704067200}
 *   initialLimit={15}
 *   showCourseName
 *   onActivityClick={(activity) => navigate(activity.url)}
 * />
 * ```
 */
function RecentActivityWidget({
  courseId,
  title = 'Recent Activity',
  useSinceLastAccess = false,
  lastAccessTimestamp,
  initialLimit = DEFAULT_ITEMS_LIMIT,
  groupByDate,
  showCourseName = false,
  onActivityClick,
}: RecentActivityWidgetProps): React.ReactElement {
  // ============================================================================
  // State
  // ============================================================================

  /**
   * Current number of items to display (for pagination)
   */
  const [displayLimit, setDisplayLimit] = useState<number>(initialLimit);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  /**
   * Calculate the time start parameter based on configuration
   *
   * If useSinceLastAccess is true and lastAccessTimestamp is provided,
   * use that timestamp. Otherwise, use the default time range (48 hours ago).
   */
  const timeStart = useMemo(() => {
    if (useSinceLastAccess && lastAccessTimestamp !== undefined) {
      return lastAccessTimestamp;
    }
    // Default: 48 hours ago (in Unix seconds)
    return Math.floor(Date.now() / 1000) - DEFAULT_TIME_RANGE_SECONDS;
  }, [useSinceLastAccess, lastAccessTimestamp]);

  /**
   * Fetch recent activity using React Query
   */
  const {
    data: activityData,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useRecentActivity(courseId, timeStart);

  // ============================================================================
  // Memoized Values
  // ============================================================================

  /**
   * Activity items limited by current display limit
   */
  const displayedItems = useMemo(() => {
    if (!activityData?.items) {
      return [];
    }
    return activityData.items.slice(0, displayLimit);
  }, [activityData?.items, displayLimit]);

  /**
   * Determine whether to group by date
   *
   * Group by date if explicitly enabled, or if there are more than 10 items
   */
  const shouldGroupByDate = useMemo(() => {
    if (groupByDate !== undefined) {
      return groupByDate;
    }
    return displayedItems.length > 10;
  }, [groupByDate, displayedItems.length]);

  /**
   * Activities grouped by date (if grouping is enabled)
   */
  const dateGroups = useMemo(() => {
    if (!shouldGroupByDate) {
      return null;
    }
    return groupActivitiesByDate(displayedItems);
  }, [shouldGroupByDate, displayedItems]);

  /**
   * Whether there are more items to load
   */
  const hasMore = useMemo(() => {
    if (!activityData?.items) {
      return false;
    }
    return displayLimit < activityData.items.length;
  }, [activityData?.items, displayLimit]);

  // ============================================================================
  // Callbacks
  // ============================================================================

  /**
   * Handle "Load more" button click
   */
  const handleLoadMore = useCallback(() => {
    setDisplayLimit((prev) => prev + LOAD_MORE_INCREMENT);
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Card
      elevation={1}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      role="region"
      aria-label={title}
    >
      {/* Card Header */}
      <CardHeader
        title={
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
        }
        action={
          isFetching && !isLoading ? (
            <CircularProgress
              size={20}
              aria-label="Refreshing activities"
            />
          ) : null
        }
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          pb: 1,
        }}
      />

      {/* Card Content */}
      <CardContent
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 0,
          '&:last-child': {
            pb: 0,
          },
        }}
      >
        {/* Loading State */}
        {isLoading && <ActivitySkeleton />}

        {/* Error State */}
        {isError && !isLoading && (
          <Alert
            severity="error"
            sx={{ m: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => refetch()}
                aria-label="Retry loading activities"
              >
                Retry
              </Button>
            }
          >
            {error instanceof Error
              ? error.message
              : 'Failed to load recent activity. Please try again.'}
          </Alert>
        )}

        {/* Empty State */}
        {!isLoading && !isError && displayedItems.length === 0 && (
          <EmptyState />
        )}

        {/* Activity List - Grouped by Date */}
        {!isLoading && !isError && shouldGroupByDate && dateGroups && (
          <Box component="div" role="feed" aria-label="Recent activities by date">
            {dateGroups.map((group, groupIndex) => (
              <Box key={group.date} component="section" aria-labelledby={`date-group-${group.date}`}>
                <DateGroupHeader displayDate={group.displayDate} />
                <List disablePadding>
                  {group.items.map((activity, itemIndex) => (
                    <React.Fragment key={activity.id}>
                      <ActivityItem
                        activity={activity}
                        showCourseName={showCourseName}
                        onClick={onActivityClick}
                      />
                      {/* Add divider between items within a group */}
                      {itemIndex < group.items.length - 1 && (
                        <Divider component="li" variant="inset" />
                      )}
                    </React.Fragment>
                  ))}
                </List>
                {/* Add divider between groups */}
                {groupIndex < dateGroups.length - 1 && (
                  <Divider />
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* Activity List - Ungrouped */}
        {!isLoading && !isError && !shouldGroupByDate && displayedItems.length > 0 && (
          <List
            disablePadding
            role="feed"
            aria-label="Recent activities"
          >
            {displayedItems.map((activity, index) => (
              <React.Fragment key={activity.id}>
                <ActivityItem
                  activity={activity}
                  showCourseName={showCourseName}
                  onClick={onActivityClick}
                />
                {/* Add divider between items */}
                {index < displayedItems.length - 1 && (
                  <Divider component="li" variant="inset" />
                )}
              </React.Fragment>
            ))}
          </List>
        )}

        {/* Load More Button */}
        {!isLoading && !isError && hasMore && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              py: 2,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Button
              variant="text"
              onClick={handleLoadMore}
              aria-label={`Load more activities. Currently showing ${displayedItems.length} of ${activityData?.total ?? 0} activities.`}
              sx={{ textTransform: 'none' }}
            >
              Load more
            </Button>
          </Box>
        )}

        {/* Activity count indicator */}
        {!isLoading && !isError && displayedItems.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              py: 1,
              borderTop: hasMore ? 0 : 1,
              borderColor: 'divider',
              backgroundColor: 'grey.50',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Showing {displayedItems.length} of {activityData?.total ?? displayedItems.length} activities
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default RecentActivityWidget;
