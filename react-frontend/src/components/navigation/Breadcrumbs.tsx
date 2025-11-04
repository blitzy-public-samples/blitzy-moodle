/**
 * Breadcrumbs Navigation Component
 *
 * Displays hierarchical breadcrumb navigation trail showing the current page location
 * within the application structure. Automatically generates breadcrumb trail from
 * current route using React Router's routing information.
 *
 * Features:
 * - Dynamic breadcrumb generation from route hierarchy
 * - Material-UI Breadcrumbs component with consistent theming
 * - Home icon as first breadcrumb item linking to dashboard
 * - Responsive design: collapses to last 2 items on mobile screens
 * - Fetches course/activity names from React Query cache when needed
 * - ARIA accessibility with proper semantic HTML
 * - Text truncation for long breadcrumb labels
 *
 * @package   react-frontend
 * @copyright 2024 Moodle React Migration
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { useMemo, useCallback } from 'react';
import { useMatches, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Breadcrumbs as MuiBreadcrumbs,
  Link,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Home, NavigateNext } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Interface for individual breadcrumb items
 */
interface BreadcrumbItem {
  /** Display label for the breadcrumb */
  label: string;
  /** Navigation path for the breadcrumb */
  path: string;
  /** Whether this is the current/last item (non-clickable) */
  isLast?: boolean;
}

/**
 * Props for the Breadcrumbs component
 */
interface BreadcrumbsProps {
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Maximum number of breadcrumb items to display before collapsing */
  maxItems?: number;
}

/**
 * Route handle interface for breadcrumb configuration
 * Routes can define a handle.breadcrumb function to provide custom labels
 */
interface RouteHandle {
  breadcrumb?: (match: RouteMatch) => string;
}

/**
 * Route match interface from React Router
 */
interface RouteMatch {
  id: string;
  pathname: string;
  params: Record<string, string | undefined>;
  data: unknown;
  handle?: RouteHandle;
}

/**
 * Breadcrumbs Component
 *
 * Renders a hierarchical breadcrumb navigation trail showing the current location
 * within the application. Uses React Router to automatically detect the current
 * route and generates appropriate breadcrumb items.
 *
 * Example breadcrumb trails:
 * - Home
 * - Home > My Courses
 * - Home > My Courses > Course Name
 * - Home > My Courses > Course Name > Assignments > Assignment Name
 *
 * @param props - Component properties
 * @returns Breadcrumb navigation component
 */
export default function Breadcrumbs({ className, maxItems }: BreadcrumbsProps): JSX.Element {
  const matches = useMatches() as RouteMatch[];
  const location = useLocation();
  const theme = useTheme();
  const queryClient = useQueryClient();

  // Detect mobile screens for responsive breadcrumb collapsing
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  /**
   * Get course name from React Query cache by course ID
   * Avoids additional API requests by reusing cached data
   */
  const getCourseNameFromCache = useCallback(
    (courseId: string): string | null => {
      try {
        const coursesCache = queryClient.getQueryData(['courses']) as Array<{
          id: number;
          fullname: string;
        }>;

        if (coursesCache) {
          const course = coursesCache.find((c) => c.id === parseInt(courseId, 10));
          if (course) {
            return course.fullname;
          }
        }

        // Try to get from individual course cache
        const courseCache = queryClient.getQueryData(['courses', parseInt(courseId, 10)]) as {
          fullname: string;
        };
        if (courseCache) {
          return courseCache.fullname;
        }
      } catch (error) {
        console.error('Error fetching course name from cache:', error);
      }

      return null;
    },
    [queryClient]
  );

  /**
   * Get activity name from React Query cache by activity type and ID
   */
  const getActivityNameFromCache = useCallback(
    (activityType: string, activityId: string): string | null => {
      try {
        const activityCache = queryClient.getQueryData([
          activityType,
          parseInt(activityId, 10),
        ]) as { name: string };
        if (activityCache) {
          return activityCache.name;
        }
      } catch (error) {
        console.error(`Error fetching ${activityType} name from cache:`, error);
      }

      return null;
    },
    [queryClient]
  );

  /**
   * Generate breadcrumb items from current route matches
   * Memoized to avoid unnecessary recalculation on every render
   */
  const breadcrumbItems = useMemo((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      {
        label: 'Home',
        path: '/',
        isLast: false,
      },
    ];

    // Process each matched route to build breadcrumb trail
    matches.forEach((match, index) => {
      const isLast = index === matches.length - 1;

      // Skip if no handle or if it's the root route
      if (!match.handle?.breadcrumb || match.pathname === '/') {
        return;
      }

      // Get custom breadcrumb label from route handle
      let label = match.handle.breadcrumb(match);

      // Handle dynamic segments - try to fetch from cache
      if (match.params.courseId) {
        const courseName = getCourseNameFromCache(match.params.courseId);
        if (courseName) {
          label = courseName;
        }
      }

      // Handle activity modules
      if (match.params.assignmentId) {
        const activityName = getActivityNameFromCache('assignments', match.params.assignmentId);
        if (activityName) {
          label = activityName;
        }
      }

      if (match.params.quizId) {
        const activityName = getActivityNameFromCache('quizzes', match.params.quizId);
        if (activityName) {
          label = activityName;
        }
      }

      if (match.params.forumId) {
        const activityName = getActivityNameFromCache('forums', match.params.forumId);
        if (activityName) {
          label = activityName;
        }
      }

      // Add breadcrumb item
      items.push({
        label,
        path: match.pathname,
        isLast,
      });
    });

    // If no custom breadcrumbs were added, try to infer from pathname
    if (items.length === 1) {
      const pathSegments = location.pathname.split('/').filter(Boolean);

      pathSegments.forEach((segment, index) => {
        const isLast = index === pathSegments.length - 1;
        const path = `/${pathSegments.slice(0, index + 1).join('/')}`;

        // Convert URL segments to readable labels
        const label = segment
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        items.push({
          label,
          path,
          isLast,
        });
      });
    }

    // Mark the last item
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      if (lastItem) {
        lastItem.isLast = true;
      }
    }

    return items;
  }, [matches, location.pathname, getCourseNameFromCache, getActivityNameFromCache]);

  /**
   * Determine max items based on screen size and prop
   * Mobile: show only last 2 items, Desktop: use prop or show all
   */
  const effectiveMaxItems = useMemo(() => {
    if (isMobile) {
      return 2;
    }
    return maxItems;
  }, [isMobile, maxItems]);

  return (
    <MuiBreadcrumbs
      aria-label="breadcrumb"
      separator={<NavigateNext fontSize="small" />}
      maxItems={effectiveMaxItems}
      className={className}
      sx={{
        mb: 2,
        '& .MuiBreadcrumbs-ol': {
          flexWrap: 'wrap',
        },
      }}
    >
      {breadcrumbItems.map((item, index) => {
        const isHome = index === 0;
        const { isLast } = item;

        if (isLast) {
          // Last item is non-clickable Typography with current page color
          return (
            <Typography
              key={item.path}
              color="text.primary"
              sx={{
                display: 'flex',
                alignItems: 'center',
                maxWidth: { xs: 150, sm: 250, md: 400 },
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {isHome && <Home sx={{ mr: 0.5 }} fontSize="inherit" />}
              {item.label}
            </Typography>
          );
        }

        // Clickable Link component for navigation
        return (
          <Link
            key={item.path}
            component={RouterLink}
            to={item.path}
            color="inherit"
            underline="hover"
            sx={{
              display: 'flex',
              alignItems: 'center',
              maxWidth: { xs: 150, sm: 250, md: 400 },
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {isHome && <Home sx={{ mr: 0.5 }} fontSize="inherit" />}
            {item.label}
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
}
