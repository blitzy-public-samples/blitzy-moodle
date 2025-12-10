/**
 * LTI Results View Component
 *
 * React component for displaying LTI grade passback results from external tools.
 * Supports both LTI Outcome Service (LTI 1.1) and Assignment and Grade Service (LTI 1.3),
 * showing grade values, completion status, and timestamps with Material-UI table layout.
 *
 * Features:
 * - Display grade passback results from external LTI tools
 * - Show user grades received via LTI Outcome Service or AGS
 * - Render grade value, score given, score maximum, and submission status
 * - Show timestamp of when grade was last updated
 * - Display grade activity completion status with color-coded chips
 * - Handle different grade types (scale, point, pass/fail)
 * - Show formatted grade display based on grade scale configuration
 * - Render error states when grade retrieval fails
 * - Display loading skeleton while fetching grade information
 * - Show empty state when no grades are available
 * - Format dates using date-fns library
 * - Handle grade visibility and permission checks
 *
 * Based on:
 * - public/mod/lti/grade.php - Grade display logic
 * - public/mod/lti/servicelib.php - Grade passback handling
 * - public/mod/lti/locallib.php - LTI utility functions
 *
 * @package    react-frontend
 * @subpackage features/activities/lti/components
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  Paper,
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  ErrorOutline as ErrorOutlineIcon,
  HelpOutline as HelpOutlineIcon,
  Refresh as RefreshIcon,
  Grade as GradeIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

import { useLTIGrades, type GradeStatus } from '../hooks/useLTIGrades';
import type { LtiGradeResult } from '../types/lti.types';
import { LoadingSpinner } from '../../../../components/feedback/LoadingSpinner';

// ============================================================================
// Types
// ============================================================================

/**
 * Props interface for the LTIResultsView component
 * Defines the configuration options for displaying LTI grade results
 */
export interface LTIResultsViewProps {
  /**
   * The LTI tool instance ID for which to fetch and display grades
   * This corresponds to the lti.id in the Moodle database
   */
  ltiId: number;

  /**
   * Optional title override for the card header
   * If not provided, defaults to "Grade Results"
   */
  title?: string;

  /**
   * Optional user ID to filter grades for a specific user
   * If not provided, shows grades for all users (requires teacher capability)
   */
  userId?: number;

  /**
   * Whether to show the refresh button in the header
   * @default true
   */
  showRefreshButton?: boolean;

  /**
   * Whether to show detailed timestamps including submission and update dates
   * @default true
   */
  showDetailedTimestamps?: boolean;

  /**
   * Whether to display the original grade alongside the percentage
   * @default false
   */
  showOriginalGrade?: boolean;

  /**
   * Callback function triggered when a grade row is clicked
   * Useful for navigation to detailed grade view
   */
  onGradeClick?: (grade: LtiGradeResult) => void;

  /**
   * Optional CSS class name for custom styling
   */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Date format string for displaying grade timestamps
 * Format: "Jan 15, 2024 14:30"
 */
const DATE_FORMAT = 'MMM dd, yyyy HH:mm';

/**
 * Date format string for detailed view
 * Format: "January 15, 2024 at 2:30 PM"
 */
const DATE_FORMAT_DETAILED = "MMMM dd, yyyy 'at' h:mm a";

/**
 * Status color mapping for Material-UI Chip component
 * Based on GradeStatus from useLTIGrades hook
 */
const STATUS_COLORS: Record<GradeStatus, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  completed: 'success',
  pending: 'warning',
  not_submitted: 'default',
  failed: 'error',
  unknown: 'info',
};

/**
 * Status labels for display
 * Human-readable labels for each grade status
 */
const STATUS_LABELS: Record<GradeStatus, string> = {
  completed: 'Graded',
  pending: 'Pending',
  not_submitted: 'Not Submitted',
  failed: 'Failed',
  unknown: 'Unknown',
};

/**
 * Status icons for visual indication
 */
const STATUS_ICONS: Record<GradeStatus, React.ReactNode> = {
  completed: <CheckCircleIcon fontSize="small" />,
  pending: <ScheduleIcon fontSize="small" />,
  not_submitted: <HelpOutlineIcon fontSize="small" />,
  failed: <ErrorOutlineIcon fontSize="small" />,
  unknown: <HelpOutlineIcon fontSize="small" />,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a Unix timestamp to a human-readable date string
 *
 * @param timestamp - Unix timestamp in seconds
 * @param formatString - date-fns format string
 * @returns Formatted date string or placeholder if invalid
 */
function formatTimestamp(timestamp: number | undefined, formatString: string = DATE_FORMAT): string {
  if (!timestamp || timestamp <= 0) {
    return '—';
  }

  try {
    // Convert Unix timestamp (seconds) to milliseconds for Date constructor
    const date = new Date(timestamp * 1000);
    
    // Validate the date is valid
    if (isNaN(date.getTime())) {
      return '—';
    }
    
    return format(date, formatString);
  } catch {
    return '—';
  }
}

/**
 * Get a descriptive tooltip text for the grade status
 *
 * @param status - The grade status
 * @returns Tooltip text explaining the status
 */
function getStatusTooltip(status: GradeStatus): string {
  switch (status) {
    case 'completed':
      return 'Grade has been received from the external tool';
    case 'pending':
      return 'Submission received, awaiting grade from external tool';
    case 'not_submitted':
      return 'No submission recorded from external tool';
    case 'failed':
      return 'Grade passback failed - please contact your instructor';
    case 'unknown':
    default:
      return 'Grade status could not be determined';
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Loading skeleton component for the grade results table
 * Displays placeholder content while data is being fetched
 * Uses skeleton rows for table layout and optional spinner overlay
 *
 * @param props - Component props
 * @param props.showSpinner - Whether to show a centered spinner overlay
 */
interface GradeResultsSkeletonProps {
  showSpinner?: boolean;
}

function GradeResultsSkeleton({ showSpinner = false }: GradeResultsSkeletonProps): JSX.Element {
  // If spinner mode is enabled, show centered loading spinner
  if (showSpinner) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 6,
        }}
      >
        <LoadingSpinner size="medium" />
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Loading grade results">
        <TableHead>
          <TableRow>
            <TableCell>
              <Skeleton width={80} />
            </TableCell>
            <TableCell>
              <Skeleton width={100} />
            </TableCell>
            <TableCell>
              <Skeleton width={80} />
            </TableCell>
            <TableCell>
              <Skeleton width={120} />
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {[1, 2, 3].map((row) => (
            <TableRow key={row}>
              <TableCell>
                <Skeleton width={60} />
              </TableCell>
              <TableCell>
                <Skeleton width={80} />
              </TableCell>
              <TableCell>
                <Skeleton width={70} height={24} sx={{ borderRadius: 2 }} />
              </TableCell>
              <TableCell>
                <Skeleton width={100} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/**
 * Empty state component when no grades are available
 * Provides informational message to the user
 */
function EmptyGradesState(): JSX.Element {
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
      <GradeIcon
        sx={{
          fontSize: 64,
          color: 'text.disabled',
          mb: 2,
        }}
      />
      <Typography
        variant="h6"
        color="text.secondary"
        gutterBottom
      >
        No Grades Available
      </Typography>
      <Typography
        variant="body2"
        color="text.disabled"
        sx={{ maxWidth: 360 }}
      >
        Grades from the external tool have not been received yet.
        Complete activities in the external tool to receive grades.
      </Typography>
    </Box>
  );
}

/**
 * Error state component for displaying grade retrieval errors
 *
 * @param props - Component props
 * @param props.error - The error object
 * @param props.onRetry - Callback function for retry button
 */
function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}): JSX.Element {
  // Determine error type and provide appropriate message
  const errorMessage = error.message.toLowerCase();
  
  let severity: 'error' | 'warning' = 'error';
  let title = 'Error Loading Grades';
  let description = 'An error occurred while loading grade results. Please try again.';
  
  if (
    errorMessage.includes('permission') ||
    errorMessage.includes('forbidden') ||
    errorMessage.includes('access denied')
  ) {
    title = 'Permission Denied';
    description = 'You do not have permission to view grade results for this activity.';
    severity = 'error';
  } else if (
    errorMessage.includes('not found') ||
    errorMessage.includes('404')
  ) {
    title = 'Grades Not Found';
    description = 'The requested grade results could not be found. The LTI tool may not be configured for grade passback.';
    severity = 'warning';
  } else if (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout')
  ) {
    title = 'Connection Error';
    description = 'Unable to connect to the server. Please check your internet connection and try again.';
    severity = 'warning';
  } else if (
    errorMessage.includes('grades disabled') ||
    errorMessage.includes('not accepting grades')
  ) {
    title = 'Grade Passback Disabled';
    description = 'Grade passback is not enabled for this LTI tool. Contact your instructor for assistance.';
    severity = 'warning';
  }

  return (
    <Alert
      severity={severity}
      action={
        <IconButton
          aria-label="retry loading grades"
          color="inherit"
          size="small"
          onClick={onRetry}
        >
          <RefreshIcon fontSize="inherit" />
        </IconButton>
      }
      sx={{ mb: 2 }}
    >
      <Typography variant="subtitle2" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2">
        {description}
      </Typography>
    </Alert>
  );
}

/**
 * Grade row component for displaying a single grade result
 */
interface GradeRowProps {
  grade: LtiGradeResult;
  formatGradePercent: (grade: LtiGradeResult) => string;
  formatGradeValue: (grade: LtiGradeResult) => string;
  getGradeStatus: (grade: LtiGradeResult) => GradeStatus;
  showOriginalGrade: boolean;
  showDetailedTimestamps: boolean;
  onClick?: () => void;
}

function GradeRow({
  grade,
  formatGradePercent,
  formatGradeValue,
  getGradeStatus,
  showOriginalGrade,
  showDetailedTimestamps,
  onClick,
}: GradeRowProps): JSX.Element {
  const status = getGradeStatus(grade);
  const statusLabel = STATUS_LABELS[status];
  const statusColor = STATUS_COLORS[status];
  const statusIcon = STATUS_ICONS[status];
  const statusTooltip = getStatusTooltip(status);

  // Determine the most relevant timestamp to display
  const primaryTimestamp = grade.dategraded || grade.dateupdated || grade.datesubmitted;

  return (
    <TableRow
      hover={!!onClick}
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        '&:last-child td, &:last-child th': { border: 0 },
      }}
    >
      {/* Grade Percentage */}
      <TableCell component="th" scope="row">
        <Typography
          variant="body2"
          fontWeight={status === 'completed' ? 'medium' : 'normal'}
          color={status === 'completed' ? 'text.primary' : 'text.secondary'}
        >
          {formatGradePercent(grade)}
        </Typography>
      </TableCell>

      {/* Grade Value (Score / Max) */}
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {formatGradeValue(grade)}
        </Typography>
        {showOriginalGrade && grade.originalgrade !== undefined && (
          <Typography variant="caption" color="text.disabled" display="block">
            Original: {grade.originalgrade.toFixed(1)}
          </Typography>
        )}
      </TableCell>

      {/* Status Chip */}
      <TableCell>
        <Tooltip title={statusTooltip} arrow placement="top">
          <Chip
            icon={statusIcon}
            label={statusLabel}
            color={statusColor}
            size="small"
            variant="outlined"
            sx={{
              fontWeight: 'medium',
              '& .MuiChip-icon': {
                fontSize: 16,
              },
            }}
          />
        </Tooltip>
      </TableCell>

      {/* Timestamp */}
      <TableCell>
        <Tooltip
          title={
            showDetailedTimestamps
              ? formatTimestamp(primaryTimestamp, DATE_FORMAT_DETAILED)
              : ''
          }
          arrow
          placement="top"
        >
          <Typography variant="body2" color="text.secondary">
            {formatTimestamp(primaryTimestamp)}
          </Typography>
        </Tooltip>
        {showDetailedTimestamps && grade.datesubmitted && grade.dategraded && (
          <Typography variant="caption" color="text.disabled" display="block">
            Submitted: {formatTimestamp(grade.datesubmitted)}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * LTIResultsView Component
 *
 * Displays LTI grade passback results from external tools in a tabular format.
 * Uses React Query via useLTIGrades hook for data fetching with proper
 * loading, error, and empty states.
 *
 * The component renders a Material-UI Card with:
 * - Header with title and optional refresh button
 * - Table showing grade percentage, value, status, and timestamp
 * - Loading skeleton during data fetch
 * - Empty state when no grades exist
 * - Error state with retry capability
 *
 * @param props - Component props
 * @returns Rendered LTI results view component
 *
 * @example
 * ```tsx
 * // Basic usage
 * <LTIResultsView ltiId={123} />
 *
 * // With custom title and click handler
 * <LTIResultsView
 *   ltiId={123}
 *   title="External Tool Grades"
 *   onGradeClick={(grade) => navigate(`/grades/${grade.id}`)}
 * />
 *
 * // Filter for specific user
 * <LTIResultsView
 *   ltiId={123}
 *   userId={456}
 *   showDetailedTimestamps={false}
 * />
 * ```
 */
function LTIResultsView({
  ltiId,
  title = 'Grade Results',
  userId,
  showRefreshButton = true,
  showDetailedTimestamps = true,
  showOriginalGrade = false,
  onGradeClick,
  className,
}: LTIResultsViewProps): JSX.Element {
  // Fetch grades using the custom hook
  const {
    grades,
    isLoading,
    error,
    refetch,
    hasGrades,
    maxGrade,
    totalSubmissions,
    formatGradePercent,
    formatGradeValue,
    getGradeStatus,
  } = useLTIGrades(ltiId);

  // Filter grades by userId if provided
  const filteredGrades = React.useMemo(() => {
    if (!userId) {
      return grades;
    }
    return grades.filter((grade) => grade.userid === userId);
  }, [grades, userId]);

  // Handle refresh button click
  const handleRefresh = React.useCallback(() => {
    refetch();
  }, [refetch]);

  // Render loading state
  if (isLoading) {
    return (
      <Card className={className} variant="outlined">
        <CardHeader
          title={
            <Skeleton width={150} height={28} />
          }
          action={
            showRefreshButton && (
              <Skeleton variant="circular" width={40} height={40} />
            )
          }
        />
        <CardContent>
          <GradeResultsSkeleton />
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card className={className} variant="outlined">
        <CardHeader
          title={title}
          titleTypographyProps={{
            variant: 'h6',
            component: 'h2',
          }}
          avatar={
            <GradeIcon color="action" />
          }
          action={
            showRefreshButton && (
              <Tooltip title="Refresh grades">
                <IconButton
                  aria-label="refresh grades"
                  onClick={handleRefresh}
                  size="small"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )
          }
        />
        <CardContent>
          <ErrorState error={error} onRetry={handleRefresh} />
        </CardContent>
      </Card>
    );
  }

  // Render empty state
  if (!hasGrades || filteredGrades.length === 0) {
    return (
      <Card className={className} variant="outlined">
        <CardHeader
          title={title}
          titleTypographyProps={{
            variant: 'h6',
            component: 'h2',
          }}
          avatar={
            <GradeIcon color="action" />
          }
          action={
            showRefreshButton && (
              <Tooltip title="Refresh grades">
                <IconButton
                  aria-label="refresh grades"
                  onClick={handleRefresh}
                  size="small"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )
          }
        />
        <Divider />
        <CardContent sx={{ p: 0 }}>
          <EmptyGradesState />
        </CardContent>
      </Card>
    );
  }

  // Render grades table
  return (
    <Card className={className} variant="outlined">
      <CardHeader
        title={title}
        titleTypographyProps={{
          variant: 'h6',
          component: 'h2',
        }}
        subheader={
          totalSubmissions > 0
            ? `${totalSubmissions} submission${totalSubmissions !== 1 ? 's' : ''} • Max: ${maxGrade}`
            : undefined
        }
        subheaderTypographyProps={{
          variant: 'body2',
        }}
        avatar={
          <GradeIcon color="primary" />
        }
        action={
          showRefreshButton && (
            <Tooltip title="Refresh grades">
              <IconButton
                aria-label="refresh grades"
                onClick={handleRefresh}
                size="small"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )
        }
      />
      <Divider />
      <TableContainer>
        <Table
          size="small"
          aria-label="LTI grade results"
          sx={{
            '& .MuiTableCell-head': {
              fontWeight: 'bold',
              backgroundColor: 'background.default',
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell>Grade</TableCell>
              <TableCell>Score</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredGrades.map((grade) => (
              <GradeRow
                key={grade.id}
                grade={grade}
                formatGradePercent={formatGradePercent}
                formatGradeValue={formatGradeValue}
                getGradeStatus={getGradeStatus}
                showOriginalGrade={showOriginalGrade}
                showDetailedTimestamps={showDetailedTimestamps}
                onClick={
                  onGradeClick
                    ? () => onGradeClick(grade)
                    : undefined
                }
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Summary footer */}
      {filteredGrades.length > 1 && (
        <>
          <Divider />
          <Box
            sx={{
              px: 2,
              py: 1.5,
              backgroundColor: 'background.default',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Showing {filteredGrades.length} grade{filteredGrades.length !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {filteredGrades.filter((g) => getGradeStatus(g) === 'completed').length} completed
            </Typography>
          </Box>
        </>
      )}
    </Card>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { LTIResultsView };
export default LTIResultsView;
