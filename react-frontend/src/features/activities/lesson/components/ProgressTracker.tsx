/**
 * ProgressTracker Component
 *
 * Progress visualization component for lesson activity that displays user's progress
 * through branching lesson paths with completion indicators, showing visited pages,
 * current position, and remaining pages with visual progress bar and navigation breadcrumbs.
 *
 * Features:
 * - Overall progress percentage with Material-UI LinearProgress
 * - Branching path visualization with tree structure for complex lessons
 * - Current page position highlighting
 * - Visited pages with checkmarks and unvisited pages with indicators
 * - Completion status for each page (completed, in-progress, not-started)
 * - Progress statistics (pages completed, time spent, score if applicable)
 * - Collapsible sections for nested branch tables and clusters
 * - Responsive design for mobile and desktop views
 * - Accessibility labels for screen readers
 * - Support for linear, branching, and clustered lesson structures
 *
 * @see public/mod/lesson/locallib.php for lesson structure logic
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Divider,
  useTheme,
  useMediaQuery,
  Skeleton,
  Alert,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FiberManualRecord as FiberManualRecordIcon,
  QuestionAnswer as QuestionIcon,
  Description as ContentIcon,
  AccountTree as BranchIcon,
  AccessTime as TimeIcon,
  Grade as ScoreIcon,
} from '@mui/icons-material';

// Internal imports from depends_on_files
import { QuestionType } from '../types/lesson.types';
import type { LessonPage, LessonProgress } from '../types/lesson.types';
import { useLessonPages } from '../api/lessonApi';
import { ProgressBar } from '../../../../components/feedback/ProgressBar';

/**
 * Completion status for a lesson page
 */
type PageStatus = 'completed' | 'in-progress' | 'not-started';

/**
 * Props for the ProgressTracker component
 */
interface ProgressTrackerProps {
  /** The lesson ID to track progress for */
  lessonId: number;
  /** Current attempt ID for the lesson (reserved for future use) */
  _attemptId?: number;
  /** Progress data for the current attempt */
  progress?: LessonProgress;
  /** Maximum score possible for the lesson (from API maxGrade field) */
  maxScore?: number;
  /** Whether progress data is currently loading */
  isLoading?: boolean;
  /** Error that occurred while loading progress */
  error?: Error | null;
  /** Callback when a page is clicked in the tree */
  onPageClick?: (pageId: number) => void;
  /** Whether to show detailed statistics */
  showStatistics?: boolean;
  /** Whether to allow navigation by clicking pages */
  allowNavigation?: boolean;
  /** Custom className for styling */
  className?: string;
}

/**
 * Node in the lesson structure tree
 */
interface TreeNode {
  page: LessonPage;
  children: TreeNode[];
  depth: number;
  isCluster: boolean;
  isBranchTable: boolean;
}

/**
 * Formats time in seconds to a human-readable string
 * @param seconds - Time in seconds
 * @returns Formatted time string (e.g., "5m 30s" or "1h 15m")
 */
function formatTimeSpent(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (remainingSeconds > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${minutes}m`;
}

/**
 * ProgressTracker Component
 *
 * Displays user's progress through a lesson with branching paths,
 * completion indicators, and navigation breadcrumbs.
 */
const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  lessonId,
  // _attemptId is reserved for future use (tracking specific attempts)
  progress,
  maxScore,
  isLoading = false,
  error = null,
  onPageClick,
  showStatistics = true,
  allowNavigation = false,
  className,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Fetch all pages for the lesson structure
  const {
    data: pagesData,
    isLoading: pagesLoading,
    error: pagesError,
  } = useLessonPages(lessonId);

  // Track expanded state for collapsible sections
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set()
  );

  /**
   * Toggle expansion state of a branch table or cluster section
   */
  const toggleSection = useCallback((pageId: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }, []);

  /**
   * Determine the completion status of a page
   */
  const getPageStatus = useCallback(
    (pageId: number): PageStatus => {
      if (!progress) {
        return 'not-started';
      }

      if (progress.currentPageId === pageId) {
        return 'in-progress';
      }

      if (progress.visitedPages?.includes(pageId)) {
        return 'completed';
      }

      return 'not-started';
    },
    [progress]
  );

  /**
   * Build a tree structure from the flat list of pages
   * Handles linear lessons, branching paths, and clusters
   */
  const pageTree = useMemo((): TreeNode[] => {
    if (!pagesData?.pages || pagesData.pages.length === 0) {
      return [];
    }

    const {pages} = pagesData;
    const pageMap = new Map<number, LessonPage>();
    const childMap = new Map<number, number[]>();

    // Build lookup maps
    pages.forEach((page) => {
      pageMap.set(page.id, page);
    });

    // Find root pages (pages with no previous page or prevpageid = 0)
    const rootPages: LessonPage[] = [];
    pages.forEach((page) => {
      if (!page.prevpageid || page.prevpageid === 0) {
        rootPages.push(page);
      } else {
        // Track children for branching structures
        const parentId = page.prevpageid;
        if (!childMap.has(parentId)) {
          childMap.set(parentId, []);
        }
        childMap.get(parentId)!.push(page.id);
      }
    });

    /**
     * Recursively build tree nodes
     */
    const buildNode = (page: LessonPage, depth: number): TreeNode => {
      const childIds = childMap.get(page.id) || [];
      const children: TreeNode[] = [];

      // Check if this is a structural page (branch table or cluster)
      // Structural pages include branch tables (20), end of branch (21), clusters (30), end of cluster (31)
      const isBranchTable = page.qtype === QuestionType.BRANCHTABLE || page.qtype === QuestionType.ENDOFBRANCH;
      const isCluster = page.qtype === QuestionType.CLUSTER || page.qtype === QuestionType.ENDOFCLUSTER;

      // Build child nodes
      childIds.forEach((childId) => {
        const childPage = pageMap.get(childId);
        if (childPage) {
          children.push(buildNode(childPage, depth + 1));
        }
      });

      // Also follow nextpageid for linear progression
      if (page.nextpageid && page.nextpageid > 0) {
        const nextPage = pageMap.get(page.nextpageid);
        if (nextPage && !childIds.includes(page.nextpageid)) {
          // Only add if not already a child
          const existingNode = children.find((c) => c.page.id === page.nextpageid);
          if (!existingNode) {
            children.push(buildNode(nextPage, depth + 1));
          }
        }
      }

      return {
        page,
        children,
        depth,
        isCluster,
        isBranchTable,
      };
    };

    // Build tree from root pages
    return rootPages.map((page) => buildNode(page, 0));
  }, [pagesData]);

  /**
   * Calculate progress statistics from the progress data
   */
  const statistics = useMemo(() => {
    if (!progress) {
      return {
        pagesCompleted: 0,
        totalPages: pagesData?.pages?.length || 0,
        progressPercentage: 0,
        timeSpentFormatted: '0s',
        scoreDisplay: null,
      };
    }

    const pagesCompleted = progress.pagesCompleted || 0;
    const totalPages = progress.totalPages || pagesData?.pages?.length || 0;
    const progressPercentage =
      progress.progressPercentage ||
      (totalPages > 0 ? Math.round((pagesCompleted / totalPages) * 100) : 0);
    const timeSpentFormatted = formatTimeSpent(progress.timeSpent || 0);

    // Use maxScore from props if provided (from API maxGrade field)
    let scoreDisplay: string | null = null;
    if (progress.score !== undefined && maxScore !== undefined && maxScore > 0) {
      const scorePercentage = Math.round((progress.score / maxScore) * 100);
      scoreDisplay = `${progress.score}/${maxScore} (${scorePercentage}%)`;
    } else if (progress.score !== undefined && progress.score > 0) {
      // Show score without percentage if maxScore is not available
      scoreDisplay = `${progress.score} points`;
    }

    return {
      pagesCompleted,
      totalPages,
      progressPercentage,
      timeSpentFormatted,
      scoreDisplay,
    };
  }, [progress, pagesData, maxScore]);

  /**
   * Get the appropriate icon for a page based on its type
   */
  const getPageTypeIcon = useCallback((page: LessonPage): React.ReactNode => {
    // Structural pages (branch tables, clusters, and their end markers)
    if (
      page.qtype === QuestionType.BRANCHTABLE ||
      page.qtype === QuestionType.ENDOFBRANCH ||
      page.qtype === QuestionType.CLUSTER ||
      page.qtype === QuestionType.ENDOFCLUSTER
    ) {
      return <BranchIcon fontSize="small" />;
    }
    // Question pages (any qtype with a positive value that's not structural)
    if (
      page.qtype === QuestionType.SHORTANSWER ||
      page.qtype === QuestionType.TRUEFALSE ||
      page.qtype === QuestionType.MULTICHOICE ||
      page.qtype === QuestionType.MATCHING ||
      page.qtype === QuestionType.NUMERICAL ||
      page.qtype === QuestionType.ESSAY
    ) {
      return <QuestionIcon fontSize="small" />;
    }
    // Content pages (default - qtype of 0 or unknown)
    return <ContentIcon fontSize="small" />;
  }, []);

  /**
   * Get the status icon for a page
   */
  const getStatusIcon = useCallback(
    (pageId: number): React.ReactNode => {
      const status = getPageStatus(pageId);

      switch (status) {
        case 'completed':
          return (
            <CheckCircleIcon
              sx={{ color: 'success.main' }}
              aria-label="Completed"
            />
          );
        case 'in-progress':
          return (
            <FiberManualRecordIcon
              sx={{ color: 'primary.main' }}
              aria-label="Current page"
            />
          );
        case 'not-started':
        default:
          return (
            <RadioButtonUncheckedIcon
              sx={{ color: 'text.disabled' }}
              aria-label="Not started"
            />
          );
      }
    },
    [getPageStatus]
  );

  /**
   * Render a single page node in the tree
   */
  const renderPageNode = useCallback(
    (node: TreeNode, _index: number): React.ReactNode => {
      const { page, children, depth, isCluster, isBranchTable } = node;
      const hasChildren = children.length > 0;
      const isExpanded = expandedSections.has(page.id);
      const isCollapsible = (isCluster || isBranchTable) && hasChildren;
      const status = getPageStatus(page.id);
      const isCurrentPage = status === 'in-progress';

      const handleClick = () => {
        if (allowNavigation && onPageClick) {
          onPageClick(page.id);
        }
      };

      const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      };

      return (
        <React.Fragment key={page.id}>
          <ListItem
            sx={{
              pl: depth * 2 + 2,
              py: 0.5,
              bgcolor: isCurrentPage ? 'action.selected' : 'transparent',
              borderRadius: 1,
              cursor: allowNavigation ? 'pointer' : 'default',
              '&:hover': allowNavigation
                ? { bgcolor: 'action.hover' }
                : undefined,
            }}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role={allowNavigation ? 'button' : undefined}
            tabIndex={allowNavigation ? 0 : undefined}
            aria-current={isCurrentPage ? 'page' : undefined}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              {getStatusIcon(page.id)}
            </ListItemIcon>
            <ListItemIcon sx={{ minWidth: 28 }}>
              {getPageTypeIcon(page)}
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isCurrentPage ? 600 : 400,
                    color: status === 'not-started' ? 'text.secondary' : 'text.primary',
                  }}
                  noWrap={isMobile}
                >
                  {page.title || `Page ${page.id}`}
                </Typography>
              }
            />
            {(isCluster || isBranchTable) && (
              <Chip
                label={isCluster ? 'Cluster' : 'Branch'}
                size="small"
                variant="outlined"
                sx={{ mr: 1, fontSize: '0.7rem' }}
              />
            )}
            {isCollapsible && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSection(page.id);
                }}
                aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
                aria-expanded={isExpanded}
              >
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
          </ListItem>

          {/* Render children */}
          {hasChildren && (
            <Collapse in={!isCollapsible || isExpanded} timeout="auto">
              <List
                component="div"
                disablePadding
                aria-label={`Pages in ${page.title || 'section'}`}
              >
                {children.map((child, childIndex) =>
                  renderPageNode(child, childIndex)
                )}
              </List>
            </Collapse>
          )}
        </React.Fragment>
      );
    },
    [
      expandedSections,
      getPageStatus,
      getStatusIcon,
      getPageTypeIcon,
      allowNavigation,
      onPageClick,
      toggleSection,
      isMobile,
    ]
  );

  // Handle loading state
  if (isLoading || pagesLoading) {
    return (
      <Paper
        className={className}
        sx={{ p: 2 }}
        aria-label="Loading progress tracker"
        aria-busy="true"
      >
        <Skeleton variant="text" width="60%" height={28} />
        <Skeleton variant="rectangular" height={8} sx={{ my: 2, borderRadius: 1 }} />
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Skeleton variant="text" width={100} />
          <Skeleton variant="text" width={80} />
        </Box>
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
      </Paper>
    );
  }

  // Handle error state
  if (error || pagesError) {
    const errorMessage = error?.message || pagesError?.message || 'Failed to load progress data';
    return (
      <Paper className={className} sx={{ p: 2 }}>
        <Alert severity="error" aria-live="polite">
          {errorMessage}
        </Alert>
      </Paper>
    );
  }

  // Handle no data state
  if (!pagesData?.pages || pagesData.pages.length === 0) {
    return (
      <Paper className={className} sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No lesson pages available.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      className={className}
      sx={{
        p: { xs: 1.5, sm: 2 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      role="region"
      aria-label="Lesson progress tracker"
    >
      {/* Header with title */}
      <Typography
        variant="h6"
        component="h2"
        gutterBottom
        sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
      >
        Lesson Progress
      </Typography>

      {/* Progress bar */}
      <Box sx={{ mb: 2 }}>
        <ProgressBar
          value={statistics.progressPercentage}
          variant="determinate"
          color={statistics.progressPercentage === 100 ? 'success' : 'primary'}
          showLabel
          height={10}
        />
      </Box>

      {/* Statistics section */}
      {showStatistics && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: { xs: 1, sm: 2 },
            mb: 2,
          }}
          role="group"
          aria-label="Progress statistics"
        >
          <Chip
            icon={<CheckCircleIcon />}
            label={`${statistics.pagesCompleted} / ${statistics.totalPages} pages`}
            size={isMobile ? 'small' : 'medium'}
            variant="outlined"
            aria-label={`${statistics.pagesCompleted} of ${statistics.totalPages} pages completed`}
          />
          <Chip
            icon={<TimeIcon />}
            label={statistics.timeSpentFormatted}
            size={isMobile ? 'small' : 'medium'}
            variant="outlined"
            aria-label={`Time spent: ${statistics.timeSpentFormatted}`}
          />
          {statistics.scoreDisplay && (
            <Chip
              icon={<ScoreIcon />}
              label={statistics.scoreDisplay}
              size={isMobile ? 'small' : 'medium'}
              variant="outlined"
              color={
                progress?.score !== undefined &&
                maxScore !== undefined &&
                progress.score >= maxScore * 0.7
                  ? 'success'
                  : 'default'
              }
              aria-label={`Score: ${statistics.scoreDisplay}`}
            />
          )}
        </Box>
      )}

      <Divider sx={{ mb: 1 }} />

      {/* Legend for status icons */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 1,
          px: 1,
        }}
        role="group"
        aria-label="Progress legend"
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} />
          <Typography variant="caption" color="text.secondary">
            Completed
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FiberManualRecordIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography variant="caption" color="text.secondary">
            Current
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <RadioButtonUncheckedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
          <Typography variant="caption" color="text.secondary">
            Not started
          </Typography>
        </Box>
      </Box>

      {/* Page tree */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
        }}
      >
        <List
          component="nav"
          aria-label="Lesson page structure"
          dense
          sx={{ py: 0 }}
        >
          {pageTree.map((node, index) => renderPageNode(node, index))}
        </List>
      </Box>

      {/* Completion message */}
      {progress?.isCompleted && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Chip
            label="Lesson Completed!"
            color="success"
            icon={<CheckCircleIcon />}
            sx={{ fontWeight: 600 }}
          />
        </Box>
      )}
    </Paper>
  );
};

export default ProgressTracker;
