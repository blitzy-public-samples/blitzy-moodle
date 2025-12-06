/**
 * CalendarWidget Component
 *
 * A React component that displays a monthly calendar view with events,
 * similar to Moodle's PHP block_calendar_month widget. This component
 * provides an interactive calendar interface with:
 *
 * - Monthly calendar grid with proper week alignment
 * - Navigation between months (previous, next, today)
 * - Event display with color-coded indicators by event type
 * - Responsive design for mobile and desktop views
 * - Loading and error state handling
 * - Accessibility support (WCAG 2.1 AA compliant)
 *
 * Based on Moodle's existing PHP implementation:
 * - public/blocks/calendar_month/block_calendar_month.php
 *
 * Features:
 * - Material-UI Card-based layout with header and content areas
 * - React Query integration for data fetching with automatic caching
 * - date-fns for reliable date manipulation and formatting
 * - Event tooltips showing event details on hover
 * - Badge indicators for days with multiple events
 * - Keyboard navigation support for month switching
 *
 * @package    react-frontend
 * @subpackage features/dashboard/widgets
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Box,
  IconButton,
  CircularProgress,
  Alert,
  Tooltip,
  Badge,
  Divider,
  Grid,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Today,
  CalendarToday,
  Circle,
} from '@mui/icons-material';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  addMonths,
  format,
} from 'date-fns';

import { useCalendarWidget } from '@/features/dashboard/api/dashboardApi';
import { formatDate } from '@/utils/date';
import { CalendarEventType } from '@/features/dashboard/types/dashboard.types';
import type { CalendarEvent } from '@/features/dashboard/types/dashboard.types';
import type { CourseId } from '@/types/common';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for the CalendarWidget component
 */
export interface CalendarWidgetProps {
  /**
   * Optional course ID to filter calendar events
   * When provided, only events related to this course will be displayed
   */
  readonly courseId?: CourseId;

  /**
   * Optional category ID to filter calendar events
   * When provided, only events related to this category will be displayed
   */
  readonly categoryId?: number;

  /**
   * Optional custom title for the widget
   * Defaults to "Calendar" if not provided
   */
  readonly title?: string;

  /**
   * Optional callback when a date is selected
   * Receives the selected date as a parameter
   */
  readonly onDateSelect?: (date: Date) => void;

  /**
   * Optional callback when an event is clicked
   * Receives the clicked event as a parameter
   */
  readonly onEventClick?: (event: CalendarEvent) => void;
}

/**
 * Day cell data structure for rendering calendar grid
 */
interface DayCell {
  readonly date: Date;
  readonly isCurrentMonth: boolean;
  readonly isToday: boolean;
  readonly events: readonly CalendarEvent[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Weekday labels for calendar header
 * Starting from Sunday as per standard calendar layout
 */
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Color mapping for different event types
 * Provides visual distinction between site, course, category, user, and group events
 */
const EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  [CalendarEventType.SITE]: '#1976d2', // Blue - site-wide events
  [CalendarEventType.COURSE]: '#2e7d32', // Green - course events
  [CalendarEventType.CATEGORY]: '#ed6c02', // Orange - category events
  [CalendarEventType.USER]: '#9c27b0', // Purple - user events
  [CalendarEventType.GROUP]: '#d32f2f', // Red - group events
};

/**
 * Maximum number of event indicators to show on a single day
 * Additional events are indicated with a "+X more" badge
 */
const MAX_VISIBLE_EVENT_INDICATORS = 3;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the color for a calendar event based on its type
 *
 * @param eventType - The type of calendar event
 * @returns The hex color code for the event type
 */
function getEventColor(eventType: CalendarEventType): string {
  return EVENT_TYPE_COLORS[eventType] || EVENT_TYPE_COLORS[CalendarEventType.SITE];
}

/**
 * Get a human-readable label for an event type
 *
 * @param eventType - The type of calendar event
 * @returns A human-readable string for the event type
 */
function getEventTypeLabel(eventType: CalendarEventType): string {
  const labels: Record<CalendarEventType, string> = {
    [CalendarEventType.SITE]: 'Site Event',
    [CalendarEventType.COURSE]: 'Course Event',
    [CalendarEventType.CATEGORY]: 'Category Event',
    [CalendarEventType.USER]: 'User Event',
    [CalendarEventType.GROUP]: 'Group Event',
  };
  return labels[eventType] || 'Event';
}

/**
 * Convert Unix timestamp (seconds) to Date object
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Date object
 */
function timestampToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Weekday header row component
 * Displays the day names at the top of the calendar grid
 */
const WeekdayHeader: React.FC = React.memo(() => (
  <Grid container spacing={0}>
    {WEEKDAY_LABELS.map((day) => (
      <Grid item xs key={day}>
        <Box
          sx={{
            py: 1,
            textAlign: 'center',
            fontWeight: 'medium',
            color: 'text.secondary',
            fontSize: '0.75rem',
          }}
        >
          <Typography variant="caption" fontWeight="bold">
            {day}
          </Typography>
        </Box>
      </Grid>
    ))}
  </Grid>
));

WeekdayHeader.displayName = 'WeekdayHeader';

/**
 * Event indicator component
 * Displays a small colored dot to indicate an event on a date
 */
interface EventIndicatorProps {
  readonly event: CalendarEvent;
  readonly onClick?: () => void;
}

const EventIndicator: React.FC<EventIndicatorProps> = React.memo(({ event, onClick }) => {
  const color = getEventColor(event.eventtype);
  const eventDate = timestampToDate(event.timestart);
  const tooltipContent = `${event.name} - ${formatDate(eventDate, 'h:mm a')}`;

  return (
    <Tooltip title={tooltipContent} arrow placement="top">
      <IconButton
        size="small"
        onClick={onClick}
        aria-label={`Event: ${event.name}`}
        sx={{
          p: 0,
          minWidth: 'auto',
          '&:hover': {
            backgroundColor: 'transparent',
          },
        }}
      >
        <Circle
          sx={{
            fontSize: '8px',
            color,
            cursor: 'pointer',
          }}
        />
      </IconButton>
    </Tooltip>
  );
});

EventIndicator.displayName = 'EventIndicator';

/**
 * Day cell component
 * Renders a single day in the calendar grid with date number and event indicators
 */
interface DayCellComponentProps {
  readonly dayCell: DayCell;
  readonly selectedDate: Date | null;
  readonly onDateSelect?: (date: Date) => void;
  readonly onEventClick?: (event: CalendarEvent) => void;
}

const DayCellComponent: React.FC<DayCellComponentProps> = React.memo(
  ({ dayCell, selectedDate, onDateSelect, onEventClick }) => {
    const { date, isCurrentMonth, isToday: isTodayFlag, events } = dayCell;
    const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
    const hasEvents = events.length > 0;
    const additionalEventsCount = Math.max(0, events.length - MAX_VISIBLE_EVENT_INDICATORS);

    const handleDateClick = useCallback(() => {
      onDateSelect?.(date);
    }, [date, onDateSelect]);

    const handleEventClick = useCallback(
      (event: CalendarEvent) => (e: React.MouseEvent) => {
        e.stopPropagation();
        onEventClick?.(event);
      },
      [onEventClick]
    );

    return (
      <Grid item xs>
        <Box
          onClick={handleDateClick}
          role="button"
          tabIndex={0}
          aria-label={`${format(date, 'MMMM d, yyyy')}${hasEvents ? `, ${events.length} events` : ''}`}
          aria-pressed={isSelected}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleDateClick();
            }
          }}
          sx={{
            minHeight: { xs: 40, sm: 60 },
            p: 0.5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            borderRadius: 1,
            transition: 'all 0.2s ease-in-out',
            backgroundColor: isSelected
              ? 'primary.light'
              : isTodayFlag
                ? 'action.selected'
                : 'transparent',
            opacity: isCurrentMonth ? 1 : 0.4,
            '&:hover': {
              backgroundColor: isSelected ? 'primary.light' : 'action.hover',
            },
            '&:focus': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: '-2px',
            },
          }}
        >
          {/* Day number */}
          <Badge
            badgeContent={additionalEventsCount > 0 ? `+${additionalEventsCount}` : 0}
            color="primary"
            invisible={additionalEventsCount === 0}
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.6rem',
                minWidth: '14px',
                height: '14px',
                top: -2,
                right: -8,
              },
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: isTodayFlag ? 'bold' : isSelected ? 'medium' : 'regular',
                color: isTodayFlag
                  ? 'primary.main'
                  : isSelected
                    ? 'primary.contrastText'
                    : isCurrentMonth
                      ? 'text.primary'
                      : 'text.disabled',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                backgroundColor: isTodayFlag && !isSelected ? 'primary.lighter' : 'transparent',
              }}
            >
              {format(date, 'd')}
            </Typography>
          </Badge>

          {/* Event indicators */}
          {hasEvents && (
            <Box
              sx={{
                display: 'flex',
                gap: 0.25,
                mt: 0.25,
                flexWrap: 'wrap',
                justifyContent: 'center',
                maxWidth: '100%',
              }}
            >
              {events.slice(0, MAX_VISIBLE_EVENT_INDICATORS).map((event) => (
                <EventIndicator
                  key={event.id}
                  event={event}
                  onClick={handleEventClick(event) as unknown as () => void}
                />
              ))}
            </Box>
          )}
        </Box>
      </Grid>
    );
  }
);

DayCellComponent.displayName = 'DayCellComponent';

// ============================================================================
// Main Component
// ============================================================================

/**
 * CalendarWidget Component
 *
 * Displays a monthly calendar view with events fetched from the Moodle API.
 * Supports navigation between months, date selection, and event interaction.
 *
 * @param props - Component props including courseId, categoryId, and callbacks
 * @returns The rendered calendar widget
 *
 * @example
 * ```tsx
 * // Basic usage
 * <CalendarWidget />
 *
 * // With course filter
 * <CalendarWidget courseId={101} />
 *
 * // With callbacks
 * <CalendarWidget
 *   onDateSelect={(date) => console.log('Selected:', date)}
 *   onEventClick={(event) => console.log('Event:', event)}
 * />
 * ```
 */
function CalendarWidget({
  courseId,
  categoryId,
  title = 'Calendar',
  onDateSelect,
  onEventClick,
}: CalendarWidgetProps): React.ReactElement {
  // -------------------------------------------------------------------------
  // State Management
  // -------------------------------------------------------------------------

  /**
   * Current month being displayed in the calendar
   * Defaults to the current date
   */
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());

  /**
   * Currently selected date (highlighted in the calendar)
   */
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // -------------------------------------------------------------------------
  // Data Fetching with React Query
  // -------------------------------------------------------------------------

  /**
   * Fetch calendar events from the API
   * Uses React Query for automatic caching, background refetching, and error handling
   */
  const {
    data: calendarData,
    isLoading,
    isError,
    error,
    refetch,
  } = useCalendarWidget(courseId, categoryId);

  // -------------------------------------------------------------------------
  // Computed Values (Memoized)
  // -------------------------------------------------------------------------

  /**
   * Generate the calendar grid for the current month
   * Includes padding days from previous/next months to fill complete weeks
   */
  const calendarDays = useMemo((): DayCell[] => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const events = calendarData?.events ?? [];

    return days.map((date) => {
      // Find events for this date
      const dayEvents = events.filter((event) => {
        const eventDate = timestampToDate(event.timestart);
        return isSameDay(eventDate, date);
      });

      return {
        date,
        isCurrentMonth: isSameMonth(date, currentMonth),
        isToday: isToday(date),
        events: dayEvents,
      };
    });
  }, [currentMonth, calendarData?.events]);

  /**
   * Group calendar days into weeks for grid rendering
   */
  const calendarWeeks = useMemo((): DayCell[][] => {
    const weeks: DayCell[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }
    return weeks;
  }, [calendarDays]);

  /**
   * Format the current month for display in the header
   */
  const formattedMonth = useMemo((): string => {
    return format(currentMonth, 'MMMM yyyy');
  }, [currentMonth]);

  /**
   * Calculate total events for the current month
   */
  const totalEventsThisMonth = useMemo((): number => {
    return calendarDays
      .filter((day) => day.isCurrentMonth)
      .reduce((sum, day) => sum + day.events.length, 0);
  }, [calendarDays]);

  // -------------------------------------------------------------------------
  // Event Handlers (Memoized)
  // -------------------------------------------------------------------------

  /**
   * Navigate to the previous month
   */
  const handlePreviousMonth = useCallback(() => {
    setCurrentMonth((prev) => addMonths(prev, -1));
  }, []);

  /**
   * Navigate to the next month
   */
  const handleNextMonth = useCallback(() => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  }, []);

  /**
   * Navigate to today's date
   */
  const handleGoToToday = useCallback(() => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
    onDateSelect?.(today);
  }, [onDateSelect]);

  /**
   * Handle date selection
   */
  const handleDateSelect = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      onDateSelect?.(date);
    },
    [onDateSelect]
  );

  /**
   * Handle event click
   */
  const handleEventClick = useCallback(
    (event: CalendarEvent) => {
      onEventClick?.(event);
    },
    [onEventClick]
  );

  // -------------------------------------------------------------------------
  // Render Logic
  // -------------------------------------------------------------------------

  /**
   * Render loading state
   */
  if (isLoading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardHeader
          avatar={<CalendarToday color="primary" />}
          title={title}
          titleTypographyProps={{ variant: 'h6' }}
        />
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 200,
            }}
          >
            <CircularProgress aria-label="Loading calendar" />
          </Box>
        </CardContent>
      </Card>
    );
  }

  /**
   * Render error state
   */
  if (isError) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardHeader
          avatar={<CalendarToday color="primary" />}
          title={title}
          titleTypographyProps={{ variant: 'h6' }}
        />
        <CardContent>
          <Alert
            severity="error"
            action={
              <IconButton
                aria-label="Retry loading calendar"
                color="inherit"
                size="small"
                onClick={() => refetch()}
              >
                <Today />
              </IconButton>
            }
          >
            {error instanceof Error
              ? error.message
              : 'Failed to load calendar events. Please try again.'}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  /**
   * Render main calendar view
   */
  return (
    <Card sx={{ height: '100%' }}>
      {/* Calendar Header */}
      <CardHeader
        avatar={<CalendarToday color="primary" />}
        title={title}
        titleTypographyProps={{ variant: 'h6' }}
        subheader={
          totalEventsThisMonth > 0
            ? `${totalEventsThisMonth} event${totalEventsThisMonth !== 1 ? 's' : ''} this month`
            : undefined
        }
        action={
          <Tooltip title="Go to today">
            <IconButton
              aria-label="Go to today"
              onClick={handleGoToToday}
              color="primary"
              size="small"
            >
              <Today />
            </IconButton>
          </Tooltip>
        }
      />

      <Divider />

      <CardContent sx={{ pt: 2 }}>
        {/* Month Navigation */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Tooltip title="Previous month">
            <IconButton
              aria-label="Previous month"
              onClick={handlePreviousMonth}
              size="small"
            >
              <ChevronLeft />
            </IconButton>
          </Tooltip>

          <Typography
            variant="subtitle1"
            fontWeight="bold"
            component="h3"
            sx={{ textAlign: 'center' }}
          >
            {formattedMonth}
          </Typography>

          <Tooltip title="Next month">
            <IconButton
              aria-label="Next month"
              onClick={handleNextMonth}
              size="small"
            >
              <ChevronRight />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Weekday Headers */}
        <WeekdayHeader />

        <Divider sx={{ my: 1 }} />

        {/* Calendar Grid */}
        <Box
          role="grid"
          aria-label={`Calendar for ${formattedMonth}`}
          sx={{ mt: 1 }}
        >
          {calendarWeeks.map((week, weekIndex) => (
            <Grid
              container
              spacing={0}
              key={`week-${week[0]?.date.toISOString() ?? weekIndex}`}
              role="row"
              sx={{
                borderBottom:
                  weekIndex < calendarWeeks.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
              }}
            >
              {week.map((dayCell) => (
                <DayCellComponent
                  key={dayCell.date.toISOString()}
                  dayCell={dayCell}
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  onEventClick={handleEventClick}
                />
              ))}
            </Grid>
          ))}
        </Box>

        {/* Event Legend */}
        <Box sx={{ mt: 2 }}>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="caption" color="text.secondary" component="div">
            Event types:
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              mt: 0.5,
            }}
          >
            {Object.entries(EVENT_TYPE_COLORS).map(([type, color]) => (
              <Box
                key={type}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <Circle sx={{ fontSize: 8, color }} />
                <Typography variant="caption" color="text.secondary">
                  {getEventTypeLabel(type as CalendarEventType)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// Export as default as per the export schema
export default CalendarWidget;
