/**
 * Course Overview Widget Component
 *
 * A comprehensive dashboard widget that displays user's enrolled courses as summary cards
 * with progress indicators, filtering, sorting, and pagination capabilities.
 *
 * This component is the React equivalent of Moodle's block_myoverview PHP block:
 * @see public/blocks/myoverview/block_myoverview.php
 *
 * Features:
 * - Course cards with images, titles, and progress bars
 * - Filtering by course status (all, in progress, future, past, favourites, hidden)
 * - Sorting options (by name, last accessed, creation date)
 * - Multiple view modes (card, list, summary)
 * - Pagination for large course lists
 * - Persistent user preferences via localStorage
 * - Loading skeleton states during data fetch
 * - Empty state handling when user has no courses
 * - Responsive grid layout with Material-UI breakpoints
 * - WCAG 2.1 AA accessibility compliance
 *
 * @module features/dashboard/widgets/CourseOverviewWidget
 * @package react-frontend
 * @copyright 2024 Moodle React Frontend
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Grid,
  Typography,
  Box,
  LinearProgress,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Pagination,
  Skeleton,
  Alert,
  FormControl,
  Select,
  Tooltip,
  Button,
} from '@mui/material';
import {
  School,
  CheckCircle,
  Schedule,
  Event,
  FilterList,
  Sort,
  ViewModule,
  ViewList,
  ViewComfy,
  ArrowForward,
  Star,
  MoreVert,
} from '@mui/icons-material';

import { useCourseOverview } from '@/features/dashboard/api/dashboardApi';
import type { Course } from '@/types/entities';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type {
  CourseOverviewPreferences,
  CourseOverview,
  CourseGrouping,
  CourseSort,
  CourseView,
  CoursePaging,
} from '@/features/dashboard/types/dashboard.types';
import useLocalStorage from '@/hooks/useLocalStorage';
import usePagination from '@/hooks/usePagination';

// ============================================================================
// Constants
// ============================================================================

/**
 * Local storage key for course overview widget preferences
 */
const PREFERENCES_STORAGE_KEY = 'moodle_course_overview_preferences';

/**
 * Default course overview preferences
 */
const DEFAULT_PREFERENCES: CourseOverviewPreferences = {
  grouping: 'all',
  sort: 'lastaccessed',
  view: 'card',
  paging: 12,
};

/**
 * Grouping filter options with labels and icons
 */
const GROUPING_OPTIONS: Array<{
  value: CourseGrouping;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: 'all', label: 'All courses', icon: <School fontSize="small" /> },
  { value: 'inprogress', label: 'In progress', icon: <Schedule fontSize="small" /> },
  { value: 'future', label: 'Future', icon: <Event fontSize="small" /> },
  { value: 'past', label: 'Past', icon: <CheckCircle fontSize="small" /> },
  { value: 'favourites', label: 'Starred', icon: <Star fontSize="small" /> },
  { value: 'hidden', label: 'Hidden', icon: <ViewComfy fontSize="small" /> },
];

/**
 * Sort options with labels
 */
const SORT_OPTIONS: Array<{ value: CourseSort; label: string }> = [
  { value: 'fullname', label: 'Course name' },
  { value: 'shortname', label: 'Short name' },
  { value: 'lastaccessed', label: 'Last accessed' },
  { value: 'timecreated', label: 'Date created' },
];

/**
 * View mode options with icons
 */
const VIEW_OPTIONS: Array<{
  value: CourseView;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: 'card', label: 'Card view', icon: <ViewModule /> },
  { value: 'list', label: 'List view', icon: <ViewList /> },
  { value: 'summary', label: 'Summary view', icon: <ViewComfy /> },
];

/**
 * Items per page options
 */
const PAGING_OPTIONS: CoursePaging[] = [12, 24, 48, 96];

/**
 * Default course image when course has no image set
 */
const DEFAULT_COURSE_IMAGE = '/images/course-placeholder.png';

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Props for CourseCard component
 */
interface CourseCardProps {
  /** Course data to display */
  course: CourseOverview;
  /** Current view mode */
  viewMode: CourseView;
}

/**
 * Individual course card component
 * Renders course information based on the selected view mode
 */
const CourseCard: React.FC<CourseCardProps> = React.memo(({ course, viewMode }) => {
  /**
   * Get status chip based on course dates and progress
   */
  const getStatusChip = useCallback(() => {
    const now = Date.now() / 1000;

    if (course.progress !== undefined && course.progress >= 100) {
      return (
        <Chip
          icon={<CheckCircle />}
          label="Completed"
          size="small"
          color="success"
          sx={{ ml: 1 }}
        />
      );
    }

    if (course.startdate > now) {
      return (
        <Chip
          icon={<Event />}
          label="Future"
          size="small"
          color="info"
          sx={{ ml: 1 }}
        />
      );
    }

    if (course.enddate > 0 && course.enddate < now) {
      return (
        <Chip
          icon={<CheckCircle />}
          label="Past"
          size="small"
          color="default"
          sx={{ ml: 1 }}
        />
      );
    }

    if (course.hasprogress) {
      return (
        <Chip
          icon={<Schedule />}
          label="In progress"
          size="small"
          color="primary"
          sx={{ ml: 1 }}
        />
      );
    }

    return null;
  }, [course]);

  /**
   * Format date for display
   */
  const formatDate = useCallback((timestamp: number): string => {
    if (!timestamp || timestamp === 0) return '';
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  // Card view layout
  if (viewMode === 'card') {
    return (
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          },
        }}
        component="article"
        aria-label={`Course: ${course.fullname}`}
      >
        <Link
          to={course.viewurl || `/courses/${course.id}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
          aria-label={`View ${course.fullname}`}
        >
          <CardMedia
            component="img"
            height="140"
            image={course.courseimage || DEFAULT_COURSE_IMAGE}
            alt={`${course.fullname} course image`}
            sx={{
              objectFit: 'cover',
              backgroundColor: 'grey.200',
            }}
          />
        </Link>
        <CardContent sx={{ flexGrow: 1, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Typography
              gutterBottom
              variant="h6"
              component="h3"
              sx={{
                fontSize: '1rem',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              <Link
                to={course.viewurl || `/courses/${course.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                {course.fullnamedisplay || course.fullname}
              </Link>
            </Typography>
            {course.isfavourite && (
              <Tooltip title="Starred course">
                <Star color="warning" fontSize="small" aria-label="Starred" />
              </Tooltip>
            )}
          </Box>
          {course.showshortname && course.shortname && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {course.shortname}
            </Typography>
          )}
          {course.coursecategory && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              {course.coursecategory}
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
            {getStatusChip()}
          </Box>
        </CardContent>
        {course.hasprogress && course.progress !== undefined && (
          <Box sx={{ px: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Progress
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {Math.round(course.progress)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={course.progress}
              sx={{ height: 6, borderRadius: 3 }}
              aria-label={`Course progress: ${Math.round(course.progress)}%`}
            />
          </Box>
        )}
        <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
          <Button
            component={Link}
            to={course.viewurl || `/courses/${course.id}`}
            size="small"
            endIcon={<ArrowForward />}
            aria-label={`Go to ${course.fullname}`}
          >
            View course
          </Button>
        </CardActions>
      </Card>
    );
  }

  // List view layout
  if (viewMode === 'list') {
    return (
      <Card
        sx={{
          display: 'flex',
          mb: 1,
          transition: 'box-shadow 0.2s ease-in-out',
          '&:hover': {
            boxShadow: 2,
          },
        }}
        component="article"
        aria-label={`Course: ${course.fullname}`}
      >
        <CardMedia
          component="img"
          sx={{ width: 120, minHeight: 80, objectFit: 'cover' }}
          image={course.courseimage || DEFAULT_COURSE_IMAGE}
          alt={`${course.fullname} course image`}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <CardContent sx={{ flex: '1 0 auto', py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography
                component="h3"
                variant="subtitle1"
                fontWeight={600}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <Link
                  to={course.viewurl || `/courses/${course.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  {course.fullnamedisplay || course.fullname}
                </Link>
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {course.isfavourite && (
                  <Star color="warning" fontSize="small" aria-label="Starred" />
                )}
                {getStatusChip()}
              </Box>
            </Box>
            {course.showshortname && course.shortname && (
              <Typography variant="body2" color="text.secondary">
                {course.shortname}
              </Typography>
            )}
            {course.hasprogress && course.progress !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={course.progress}
                  sx={{ flex: 1, height: 6, borderRadius: 3 }}
                  aria-label={`Course progress: ${Math.round(course.progress)}%`}
                />
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {Math.round(course.progress)}%
                </Typography>
              </Box>
            )}
          </CardContent>
        </Box>
        <CardActions sx={{ alignItems: 'center' }}>
          <IconButton
            component={Link}
            to={course.viewurl || `/courses/${course.id}`}
            size="small"
            aria-label={`Go to ${course.fullname}`}
          >
            <ArrowForward />
          </IconButton>
        </CardActions>
      </Card>
    );
  }

  // Summary view layout
  return (
    <Card
      sx={{
        mb: 1,
        transition: 'box-shadow 0.2s ease-in-out',
        '&:hover': {
          boxShadow: 2,
        },
      }}
      component="article"
      aria-label={`Course: ${course.fullname}`}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
            <School color="action" fontSize="small" />
            <Typography
              component="h3"
              variant="body1"
              fontWeight={500}
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <Link
                to={course.viewurl || `/courses/${course.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                {course.fullnamedisplay || course.fullname}
              </Link>
            </Typography>
            {course.isfavourite && (
              <Star color="warning" fontSize="small" aria-label="Starred" />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {course.hasprogress && course.progress !== undefined && (
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {Math.round(course.progress)}%
              </Typography>
            )}
            {getStatusChip()}
            <IconButton
              component={Link}
              to={course.viewurl || `/courses/${course.id}`}
              size="small"
              aria-label={`Go to ${course.fullname}`}
            >
              <ArrowForward fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
});

CourseCard.displayName = 'CourseCard';

/**
 * Loading skeleton component for course cards
 */
interface LoadingSkeletonProps {
  viewMode: CourseView;
  count?: number;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ viewMode, count = 6 }) => {
  const skeletons = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

  if (viewMode === 'card') {
    return (
      <Grid container spacing={2}>
        {skeletons.map((index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
            <Card>
              <Skeleton variant="rectangular" height={140} animation="wave" />
              <CardContent>
                <Skeleton variant="text" height={28} width="80%" animation="wave" />
                <Skeleton variant="text" height={20} width="60%" animation="wave" />
                <Box sx={{ mt: 2 }}>
                  <Skeleton variant="rectangular" height={6} animation="wave" sx={{ borderRadius: 3 }} />
                </Box>
              </CardContent>
              <CardActions sx={{ justifyContent: 'flex-end' }}>
                <Skeleton variant="rectangular" width={100} height={30} animation="wave" />
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (viewMode === 'list') {
    return (
      <Box>
        {skeletons.map((index) => (
          <Card key={index} sx={{ display: 'flex', mb: 1 }}>
            <Skeleton variant="rectangular" width={120} height={80} animation="wave" />
            <Box sx={{ flex: 1, p: 1.5 }}>
              <Skeleton variant="text" height={24} width="60%" animation="wave" />
              <Skeleton variant="text" height={20} width="40%" animation="wave" />
              <Skeleton variant="rectangular" height={6} width="100%" animation="wave" sx={{ mt: 1, borderRadius: 3 }} />
            </Box>
          </Card>
        ))}
      </Box>
    );
  }

  // Summary view skeleton
  return (
    <Box>
      {skeletons.map((index) => (
        <Card key={index} sx={{ mb: 1 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Skeleton variant="circular" width={24} height={24} animation="wave" />
              <Skeleton variant="text" height={24} width="50%" animation="wave" />
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

/**
 * Empty state component when no courses are found
 */
interface EmptyStateProps {
  grouping: CourseGrouping;
  onResetFilter: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ grouping, onResetFilter }) => {
  const getMessage = useCallback(() => {
    switch (grouping) {
      case 'inprogress':
        return 'You have no courses currently in progress.';
      case 'future':
        return 'You have no upcoming courses.';
      case 'past':
        return 'You have no completed or past courses.';
      case 'favourites':
        return 'You have not starred any courses yet.';
      case 'hidden':
        return 'You have no hidden courses.';
      default:
        return 'You are not enrolled in any courses.';
    }
  }, [grouping]);

  return (
    <Alert
      severity="info"
      icon={<School />}
      sx={{ mt: 2 }}
      action={
        grouping !== 'all' && (
          <Button color="inherit" size="small" onClick={onResetFilter}>
            Show all courses
          </Button>
        )
      }
    >
      <Typography variant="body2">{getMessage()}</Typography>
    </Alert>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Course Overview Widget
 *
 * Main dashboard widget displaying user's enrolled courses with filtering,
 * sorting, and pagination capabilities. Mimics the functionality of Moodle's
 * block_myoverview block with a modern React/Material-UI implementation.
 *
 * @returns The rendered CourseOverviewWidget component
 *
 * @example
 * ```tsx
 * // Basic usage in dashboard
 * <CourseOverviewWidget />
 *
 * // The widget manages its own state and preferences
 * ```
 */
const CourseOverviewWidget: React.FC = () => {
  // ============================================================================
  // Hooks and State
  // ============================================================================

  // Get authenticated user
  const { user, isAuthenticated } = useAuth();

  // Persistent preferences from localStorage
  const [preferences, setPreferences, resetPreferences] = useLocalStorage<CourseOverviewPreferences>(
    PREFERENCES_STORAGE_KEY,
    DEFAULT_PREFERENCES
  );

  // Menu anchor states
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  const [moreAnchorEl, setMoreAnchorEl] = useState<null | HTMLElement>(null);

  // Fetch course data using React Query
  const {
    data: courseData,
    isLoading,
    isError,
    error,
    refetch,
  } = useCourseOverview(preferences);

  // Pagination hook
  const pagination = usePagination({
    totalItems: courseData?.total ?? 0,
    itemsPerPage: preferences.paging,
    initialPage: 1,
  });

  // ============================================================================
  // Memoized Values
  // ============================================================================

  /**
   * Get paginated courses for display
   */
  const displayedCourses = useMemo(() => {
    if (!courseData?.courses) return [];
    return courseData.courses.slice(pagination.startIndex, pagination.endIndex);
  }, [courseData?.courses, pagination.startIndex, pagination.endIndex]);

  /**
   * Get grid columns based on view mode and screen size
   */
  const gridColumns = useMemo(() => {
    if (preferences.view === 'card') {
      return { xs: 12, sm: 6, md: 4, lg: 3 };
    }
    return { xs: 12 };
  }, [preferences.view]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle grouping filter change
   */
  const handleGroupingChange = useCallback(
    (grouping: CourseGrouping) => {
      setPreferences((prev) => ({ ...prev, grouping }));
      setFilterAnchorEl(null);
      pagination.firstPage();
    },
    [setPreferences, pagination]
  );

  /**
   * Handle sort option change
   */
  const handleSortChange = useCallback(
    (sort: CourseSort) => {
      setPreferences((prev) => ({ ...prev, sort }));
      setSortAnchorEl(null);
    },
    [setPreferences]
  );

  /**
   * Handle view mode change
   */
  const handleViewChange = useCallback(
    (view: CourseView) => {
      setPreferences((prev) => ({ ...prev, view }));
    },
    [setPreferences]
  );

  /**
   * Handle items per page change
   */
  const handlePagingChange = useCallback(
    (paging: CoursePaging) => {
      setPreferences((prev) => ({ ...prev, paging }));
      setMoreAnchorEl(null);
      pagination.firstPage();
    },
    [setPreferences, pagination]
  );

  /**
   * Reset filter to show all courses
   */
  const handleResetFilter = useCallback(() => {
    setPreferences((prev) => ({ ...prev, grouping: 'all' }));
    pagination.firstPage();
  }, [setPreferences, pagination]);

  /**
   * Handle pagination page change
   */
  const handlePageChange = useCallback(
    (_event: React.ChangeEvent<unknown>, page: number) => {
      pagination.goToPage(page);
    },
    [pagination]
  );

  // ============================================================================
  // Menu Handlers
  // ============================================================================

  const openFilterMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  }, []);

  const closeFilterMenu = useCallback(() => {
    setFilterAnchorEl(null);
  }, []);

  const openSortMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setSortAnchorEl(event.currentTarget);
  }, []);

  const closeSortMenu = useCallback(() => {
    setSortAnchorEl(null);
  }, []);

  const openMoreMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMoreAnchorEl(event.currentTarget);
  }, []);

  const closeMoreMenu = useCallback(() => {
    setMoreAnchorEl(null);
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  // Don't render if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Error state
  if (isError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <Typography variant="body2">
          Failed to load courses.{' '}
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Try again
          </Button>
        </Typography>
      </Alert>
    );
  }

  // Get current filter and sort labels
  const currentGroupingLabel =
    GROUPING_OPTIONS.find((opt) => opt.value === preferences.grouping)?.label || 'All courses';
  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.value === preferences.sort)?.label || 'Last accessed';

  return (
    <Box
      component="section"
      aria-labelledby="course-overview-title"
      sx={{ width: '100%' }}
    >
      {/* Header with controls */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Typography
          id="course-overview-title"
          variant="h6"
          component="h2"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <School />
          Course Overview
        </Typography>

        {/* Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          {/* Filter button */}
          <Tooltip title="Filter courses">
            <Button
              size="small"
              startIcon={<FilterList />}
              onClick={openFilterMenu}
              aria-haspopup="menu"
              aria-expanded={Boolean(filterAnchorEl)}
              aria-label={`Filter: ${currentGroupingLabel}`}
            >
              {currentGroupingLabel}
            </Button>
          </Tooltip>
          <Menu
            anchorEl={filterAnchorEl}
            open={Boolean(filterAnchorEl)}
            onClose={closeFilterMenu}
            MenuListProps={{ 'aria-label': 'Filter options' }}
          >
            {GROUPING_OPTIONS.map((option) => (
              <MenuItem
                key={option.value}
                selected={preferences.grouping === option.value}
                onClick={() => handleGroupingChange(option.value)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {option.icon}
                  {option.label}
                </Box>
              </MenuItem>
            ))}
          </Menu>

          {/* Sort button */}
          <Tooltip title="Sort courses">
            <Button
              size="small"
              startIcon={<Sort />}
              onClick={openSortMenu}
              aria-haspopup="menu"
              aria-expanded={Boolean(sortAnchorEl)}
              aria-label={`Sort: ${currentSortLabel}`}
            >
              {currentSortLabel}
            </Button>
          </Tooltip>
          <Menu
            anchorEl={sortAnchorEl}
            open={Boolean(sortAnchorEl)}
            onClose={closeSortMenu}
            MenuListProps={{ 'aria-label': 'Sort options' }}
          >
            {SORT_OPTIONS.map((option) => (
              <MenuItem
                key={option.value}
                selected={preferences.sort === option.value}
                onClick={() => handleSortChange(option.value)}
              >
                {option.label}
              </MenuItem>
            ))}
          </Menu>

          {/* View mode toggles */}
          <Box sx={{ display: 'flex', ml: 1 }}>
            {VIEW_OPTIONS.map((option) => (
              <Tooltip key={option.value} title={option.label}>
                <IconButton
                  size="small"
                  onClick={() => handleViewChange(option.value)}
                  color={preferences.view === option.value ? 'primary' : 'default'}
                  aria-label={option.label}
                  aria-pressed={preferences.view === option.value}
                >
                  {option.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Box>

          {/* More options menu */}
          <Tooltip title="More options">
            <IconButton
              size="small"
              onClick={openMoreMenu}
              aria-haspopup="menu"
              aria-expanded={Boolean(moreAnchorEl)}
              aria-label="More options"
            >
              <MoreVert />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={moreAnchorEl}
            open={Boolean(moreAnchorEl)}
            onClose={closeMoreMenu}
            MenuListProps={{ 'aria-label': 'More options' }}
          >
            <MenuItem disabled>
              <Typography variant="caption" color="text.secondary">
                Items per page
              </Typography>
            </MenuItem>
            {PAGING_OPTIONS.map((option) => (
              <MenuItem
                key={option}
                selected={preferences.paging === option}
                onClick={() => handlePagingChange(option)}
              >
                {option} courses
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </Box>

      {/* Course list */}
      {isLoading ? (
        <LoadingSkeleton viewMode={preferences.view} count={preferences.paging} />
      ) : displayedCourses.length === 0 ? (
        <EmptyState grouping={preferences.grouping} onResetFilter={handleResetFilter} />
      ) : (
        <>
          {preferences.view === 'card' ? (
            <Grid container spacing={2}>
              {displayedCourses.map((course) => (
                <Grid item {...gridColumns} key={course.id}>
                  <CourseCard course={course} viewMode={preferences.view} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box>
              {displayedCourses.map((course) => (
                <CourseCard key={course.id} course={course} viewMode={preferences.view} />
              ))}
            </Box>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mt: 3,
              }}
            >
              <Pagination
                count={pagination.totalPages}
                page={pagination.currentPage}
                onChange={handlePageChange}
                color="primary"
                showFirstButton
                showLastButton
                aria-label="Course pagination"
              />
            </Box>
          )}

          {/* Course count info */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', textAlign: 'center', mt: 1 }}
          >
            Showing {pagination.startIndex + 1}–{Math.min(pagination.endIndex, courseData?.total ?? 0)} of{' '}
            {courseData?.total ?? 0} courses
          </Typography>
        </>
      )}
    </Box>
  );
};

export default CourseOverviewWidget;
