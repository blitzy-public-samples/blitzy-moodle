/**
 * Upcoming Events Widget Component
 *
 * A dashboard widget component that displays upcoming calendar events and deadlines
 * in chronological order. This React component is the equivalent of Moodle's
 * block_calendar_upcoming PHP block, providing a modern Material-UI interface
 * for viewing upcoming events.
 *
 * Features:
 * - Displays events grouped by date (Today, Tomorrow, This Week, Later)
 * - Shows event name, date/time, course name, and type-specific icons
 * - Relative timing for near-term events ("in 2 hours")
 * - Absolute dates for events further in the future
 * - Link to full calendar view
 * - Configurable number of events to display
 * - Loading and empty state handling
 * - Responsive design for mobile devices
 *
 * Based on Moodle's public/blocks/calendar_upcoming/block_calendar_upcoming.php
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
  CardActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  CircularProgress,
  Link,
  Divider,
} from '@mui/material';
import {
  Event as EventIcon,
  School as SchoolIcon,
  Public as PublicIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  CalendarToday as CalendarTodayIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';

import { useUpcomingEvents } from '@/features/dashboard/api/dashboardApi';
import { formatDate, formatRelativeTime } from '@/utils/date';
import { CalendarEventType } from '@/features/dashboard/types/dashboard.types';
import type { CalendarEvent } from '@/features/dashboard/types/dashboard.types';
import type { CourseId } from '@/types/common';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for the UpcomingEventsWidget component
 */
interface UpcomingEventsWidgetProps {
  /** Optional course ID to filter events by course */
  courseId?: CourseId;
  /** Optional category ID to filter events by category */
  categoryId?: number;
  /** Maximum number of events to display (default: 10) */
  maxEvents?: number;
  /** URL for the full calendar view link */
  calendarUrl?: string;
  /** Enable compact mode for smaller displays */
  compact?: boolean;
}

/**
 * Date group labels for event categorization
 */
type DateGroup = 'Today' | 'Tomorrow' | 'This Week' | 'Later';

/**
 * Grouped events structure
 */
interface GroupedEvents {
  Today: CalendarEvent[];
  Tomorrow: CalendarEvent[];
  'This Week': CalendarEvent[];
  Later: CalendarEvent[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the appropriate icon component for a calendar event type
 *
 * @param eventType - The type of calendar event
 * @returns The Material-UI icon component for the event type
 */
function getEventIcon(eventType: CalendarEventType): React.ReactElement {
  switch (eventType) {
    case CalendarEventType.COURSE:
      return <SchoolIcon />;
    case CalendarEventType.SITE:
      return <PublicIcon />;
    case CalendarEventType.USER:
      return <PersonIcon />;
    case CalendarEventType.GROUP:
      return <GroupIcon />;
    case CalendarEventType.CATEGORY:
      return <CalendarTodayIcon />;
    default:
      return <EventIcon />;
  }
}

/**
 * Get the color for an event type for visual differentiation
 *
 * @param eventType - The type of calendar event
 * @returns The MUI color name or hex color for the event type
 */
function getEventColor(eventType: CalendarEventType): string {
  switch (eventType) {
    case CalendarEventType.COURSE:
      return 'primary.main';
    case CalendarEventType.SITE:
      return 'secondary.main';
    case CalendarEventType.USER:
      return 'info.main';
    case CalendarEventType.GROUP:
      return 'success.main';
    case CalendarEventType.CATEGORY:
      return 'warning.main';
    default:
      return 'text.secondary';
  }
}

/**
 * Determine which date group an event belongs to
 *
 * @param eventTimestamp - Unix timestamp of the event start time
 * @returns The date group label for the event
 */
function getDateGroup(eventTimestamp: number): DateGroup {
  const eventDate = new Date(eventTimestamp * 1000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const eventDay = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate()
  );

  if (eventDay.getTime() === today.getTime()) {
    return 'Today';
  } else if (eventDay.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  } else if (eventDay < nextWeek) {
    return 'This Week';
  } else {
    return 'Later';
  }
}

/**
 * Format the event time display based on proximity to current time
 *
 * For events within the next 24 hours, shows relative time (e.g., "in 2 hours")
 * For events further out, shows the formatted date
 *
 * @param eventTimestamp - Unix timestamp of the event start time
 * @returns Formatted time string for display
 */
function formatEventTime(eventTimestamp: number): string {
  const eventDate = new Date(eventTimestamp * 1000);
  const now = new Date();
  const hoursUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  // For events within the next 24 hours, show relative time
  if (hoursUntil > 0 && hoursUntil <= 24) {
    return formatRelativeTime(eventDate);
  }

  // For past events or events beyond 24 hours, show date
  return formatDate(eventDate, 'MMM d, h:mm a');
}

/**
 * Group events by date category
 *
 * @param events - Array of calendar events to group
 * @returns Object with events grouped by date category
 */
function groupEventsByDate(events: readonly CalendarEvent[]): GroupedEvents {
  const grouped: GroupedEvents = {
    Today: [],
    Tomorrow: [],
    'This Week': [],
    Later: [],
  };

  events.forEach((event) => {
    const group = getDateGroup(event.timestart);
    grouped[group].push(event);
  });

  return grouped;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Loading state component for the widget
 */
function LoadingState(): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
        p: 3,
      }}
    >
      <CircularProgress size={40} aria-label="Loading upcoming events" />
    </Box>
  );
}

/**
 * Empty state component when no events are found
 */
function EmptyState(): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 150,
        p: 3,
        textAlign: 'center',
      }}
    >
      <CalendarTodayIcon
        sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }}
        aria-hidden="true"
      />
      <Typography variant="body1" color="text.secondary">
        No upcoming events
      </Typography>
      <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
        Events and deadlines will appear here
      </Typography>
    </Box>
  );
}

/**
 * Error state component when data fetching fails
 */
interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 150,
        p: 3,
        textAlign: 'center',
      }}
    >
      <Typography variant="body1" color="error" gutterBottom>
        {message || 'Failed to load upcoming events'}
      </Typography>
      {onRetry && (
        <Link
          component="button"
          variant="body2"
          onClick={onRetry}
          sx={{ mt: 1, cursor: 'pointer' }}
        >
          Try again
        </Link>
      )}
    </Box>
  );
}

/**
 * Date group header component
 */
interface DateGroupHeaderProps {
  label: DateGroup;
}

function DateGroupHeader({ label }: DateGroupHeaderProps): React.ReactElement {
  return (
    <ListItem
      sx={{
        py: 0.5,
        backgroundColor: 'action.hover',
      }}
    >
      <Typography
        variant="overline"
        component="div"
        color="text.secondary"
        sx={{ fontWeight: 'medium' }}
      >
        {label}
      </Typography>
    </ListItem>
  );
}

/**
 * Single event item component
 */
interface EventItemProps {
  event: CalendarEvent;
  compact?: boolean;
}

function EventItem({ event, compact }: EventItemProps): React.ReactElement {
  const eventUrl = event.url || '#';
  const eventColor = getEventColor(event.eventtype);
  const formattedTime = formatEventTime(event.timestart);

  // Build secondary text with course name and time
  const secondaryParts: string[] = [];
  if (event.modulename) {
    secondaryParts.push(event.modulename);
  }
  secondaryParts.push(formattedTime);
  const secondaryText = secondaryParts.join(' • ');

  return (
    <ListItem
      component={event.url ? 'a' : 'div'}
      href={event.url}
      sx={{
        py: compact ? 0.75 : 1.5,
        px: 2,
        textDecoration: 'none',
        color: 'inherit',
        '&:hover': {
          backgroundColor: 'action.hover',
        },
        borderLeft: 3,
        borderLeftColor: eventColor,
      }}
      aria-label={`${event.name}, ${formattedTime}`}
    >
      <ListItemIcon
        sx={{
          minWidth: compact ? 36 : 40,
          color: eventColor,
        }}
      >
        {getEventIcon(event.eventtype)}
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography
            variant={compact ? 'body2' : 'body1'}
            component="span"
            sx={{
              fontWeight: 'medium',
              display: '-webkit-box',
              WebkitLineClamp: compact ? 1 : 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {event.name}
          </Typography>
        }
        secondary={
          <Typography
            variant="caption"
            component="span"
            color="text.secondary"
            sx={{
              display: 'block',
              mt: 0.25,
            }}
          >
            {secondaryText}
          </Typography>
        }
      />
      {event.url && (
        <ChevronRightIcon
          sx={{ color: 'text.disabled', ml: 1 }}
          aria-hidden="true"
        />
      )}
    </ListItem>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Upcoming Events Widget Component
 *
 * Displays a list of upcoming calendar events and deadlines in chronological order,
 * grouped by date (Today, Tomorrow, This Week, Later). Provides visual
 * differentiation for different event types with appropriate icons and colors.
 *
 * @param props - Component props
 * @returns The rendered widget component
 *
 * @example
 * ```tsx
 * // Basic usage
 * <UpcomingEventsWidget />
 *
 * // With course filter
 * <UpcomingEventsWidget courseId={101} maxEvents={5} />
 *
 * // Compact mode for smaller displays
 * <UpcomingEventsWidget compact maxEvents={5} />
 * ```
 */
function UpcomingEventsWidget({
  courseId,
  categoryId,
  maxEvents = 10,
  calendarUrl = '/calendar',
  compact = false,
}: UpcomingEventsWidgetProps): React.ReactElement {
  // State for showing all events when "View all" is clicked
  const [showAll, setShowAll] = useState(false);

  // Fetch upcoming events using React Query
  const {
    data: eventsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useUpcomingEvents(courseId, categoryId);

  // Memoize the grouped events calculation
  const groupedEvents = useMemo(() => {
    if (!eventsData?.events || eventsData.events.length === 0) {
      return null;
    }

    // Sort events by timestart ascending
    const sortedEvents = [...eventsData.events].sort(
      (a, b) => a.timestart - b.timestart
    );

    // Limit events if not showing all
    const displayEvents = showAll
      ? sortedEvents
      : sortedEvents.slice(0, maxEvents);

    return groupEventsByDate(displayEvents);
  }, [eventsData?.events, maxEvents, showAll]);

  // Memoize the date groups that have events
  const activeGroups = useMemo(() => {
    if (!groupedEvents) return [];

    const groups: DateGroup[] = ['Today', 'Tomorrow', 'This Week', 'Later'];
    return groups.filter((group) => groupedEvents[group].length > 0);
  }, [groupedEvents]);

  // Handle retry callback
  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle "View all" click
  const handleViewAllClick = useCallback(() => {
    setShowAll(true);
  }, []);

  // Check if there are more events to show
  const hasMoreEvents = useMemo(() => {
    if (!eventsData?.events) return false;
    return eventsData.events.length > maxEvents && !showAll;
  }, [eventsData?.events, maxEvents, showAll]);

  // Calculate total visible events
  const visibleEventCount = useMemo(() => {
    if (!eventsData?.events) return 0;
    return showAll
      ? eventsData.events.length
      : Math.min(eventsData.events.length, maxEvents);
  }, [eventsData?.events, maxEvents, showAll]);

  // Render content based on state
  const renderContent = (): React.ReactElement => {
    if (isLoading) {
      return <LoadingState />;
    }

    if (isError) {
      return (
        <ErrorState
          message={error instanceof Error ? error.message : undefined}
          onRetry={handleRetry}
        />
      );
    }

    if (!groupedEvents || activeGroups.length === 0) {
      return <EmptyState />;
    }

    return (
      <List disablePadding aria-label="Upcoming events list">
        {activeGroups.map((group, groupIndex) => (
          <React.Fragment key={group}>
            {/* Date group header */}
            <DateGroupHeader label={group} />

            {/* Events in this group */}
            {groupedEvents[group].map((event, eventIndex) => (
              <React.Fragment key={event.id}>
                <EventItem event={event} compact={compact} />
                {/* Add divider between events within a group */}
                {eventIndex < groupedEvents[group].length - 1 && (
                  <Divider component="li" variant="inset" />
                )}
              </React.Fragment>
            ))}

            {/* Add divider between groups */}
            {groupIndex < activeGroups.length - 1 && <Divider component="li" />}
          </React.Fragment>
        ))}
      </List>
    );
  };

  return (
    <Card
      elevation={compact ? 0 : 1}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...(compact && {
          border: 1,
          borderColor: 'divider',
        }),
      }}
    >
      {/* Widget Header */}
      <CardHeader
        title={
          <Typography
            variant={compact ? 'subtitle1' : 'h6'}
            component="h2"
            sx={{ fontWeight: 'medium' }}
          >
            Upcoming Events
          </Typography>
        }
        avatar={
          !compact && (
            <CalendarTodayIcon
              sx={{ color: 'primary.main' }}
              aria-hidden="true"
            />
          )
        }
        action={
          eventsData?.total !== undefined && eventsData.total > 0 ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, mr: 1 }}
            >
              {visibleEventCount} of {eventsData.total}
            </Typography>
          ) : undefined
        }
        sx={{
          pb: 0,
          ...(compact && { py: 1 }),
        }}
      />

      {/* Widget Content */}
      <CardContent
        sx={{
          flex: 1,
          p: 0,
          overflow: 'auto',
          '&:last-child': { pb: 0 },
        }}
      >
        {renderContent()}
      </CardContent>

      {/* Widget Footer with Calendar Link */}
      <CardActions
        sx={{
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderTop: 1,
          borderTopColor: 'divider',
        }}
      >
        <Link
          href={calendarUrl}
          variant="body2"
          underline="hover"
          sx={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          Go to calendar
          <ChevronRightIcon fontSize="small" sx={{ ml: 0.5 }} />
        </Link>

        {hasMoreEvents && (
          <Link
            component="button"
            variant="body2"
            underline="hover"
            onClick={handleViewAllClick}
            sx={{ cursor: 'pointer' }}
          >
            View all ({eventsData?.events?.length})
          </Link>
        )}
      </CardActions>
    </Card>
  );
}

// ============================================================================
// Export
// ============================================================================

export default UpcomingEventsWidget;
