/**
 * AssignmentPage Component
 *
 * Main entry point for viewing a Moodle assignment activity. This page component
 * orchestrates the display of assignment details, submission status, and available
 * actions based on user role (student vs teacher/grader).
 *
 * This component serves as the React equivalent of Moodle's mod/assign/view.php,
 * providing the same functionality with modern React patterns:
 * - Client-side routing via React Router v6
 * - Server state management via React Query (useAssignment hook)
 * - Authentication context via useAuth hook
 * - Material-UI components for consistent styling
 *
 * Features:
 * - Assignment information display (name, description, dates, grade settings)
 * - Role-based action buttons (Submit for students, Grade for teachers)
 * - Submission status indicators with visual chips
 * - Proper loading states and error handling with retry capability
 * - Responsive layout following Material Design guidelines
 * - Full accessibility support (WCAG 2.1 AA compliant)
 *
 * Architecture:
 * - All business logic remains in the API layer (thin wrapper pattern)
 * - Permission checks are enforced by the backend API
 * - This component only handles presentation and navigation
 *
 * @module features/activities/assignments/pages/AssignmentPage
 * @see {@link file://public/mod/assign/view.php} - Original Moodle implementation
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Stack,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
  Grade as GradeIcon,
  Groups as GroupsIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Edit as EditIcon,
  Send as SendIcon,
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  AttachFile as AttachFileIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import { format, isPast, isFuture, isWithinInterval } from 'date-fns';

// Internal imports
import { useAssignment, isValidAssignmentId, getAssignmentErrorMessage } from '../hooks/useAssignment';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { Assignment } from '../types/assignment.types';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * URL parameters expected by this page
 */
interface AssignmentPageParams {
  /** Assignment ID from URL */
  assignmentId?: string;
}

/**
 * Submission availability status for display purposes
 */
type SubmissionAvailability = 'open' | 'closed' | 'not_yet_open' | 'unknown';

/**
 * Props for the AssignmentStatusChip component
 */
interface StatusChipProps {
  /** Current submission availability status */
  status: SubmissionAvailability;
}

/**
 * Props for the DateInfoItem component
 */
interface DateInfoItemProps {
  /** Icon to display */
  icon: React.ReactNode;
  /** Label text */
  label: string;
  /** Date timestamp in seconds (Unix timestamp) */
  timestamp: number;
  /** Optional additional context text */
  context?: string;
  /** Whether this date represents a warning condition */
  warning?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Date format string for displaying dates throughout the component
 * Format: "Jan 15, 2024 14:30"
 */
const DATE_FORMAT = 'MMM dd, yyyy HH:mm';

/**
 * Roles that have grading permissions
 * Used for determining which UI to show (student vs teacher)
 */
const GRADING_ROLES = ['teacher', 'editingteacher', 'manager', 'admin'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines the submission availability status based on assignment dates
 *
 * @param assignment - The assignment object with date fields
 * @returns SubmissionAvailability status string
 */
function getSubmissionAvailability(assignment: Assignment): SubmissionAvailability {
  const now = Date.now();
  const allowSubmissionsFrom = assignment.allowsubmissionsfromdate
    ? assignment.allowsubmissionsfromdate * 1000
    : 0;
  const cutoffDate = assignment.cutoffdate
    ? assignment.cutoffdate * 1000
    : 0;
  const dueDate = assignment.duedate
    ? assignment.duedate * 1000
    : 0;

  // Check if submissions haven't opened yet
  if (allowSubmissionsFrom > 0 && now < allowSubmissionsFrom) {
    return 'not_yet_open';
  }

  // Check if we're past the cutoff date (hard deadline)
  if (cutoffDate > 0 && now > cutoffDate) {
    return 'closed';
  }

  // If no cutoff date, check due date (soft deadline)
  if (cutoffDate === 0 && dueDate > 0 && now > dueDate) {
    // Past due date but no cutoff, submissions might still be allowed (late)
    // This depends on assignment settings, but we'll show as 'open' for now
    return 'open';
  }

  // Submissions are open
  if (allowSubmissionsFrom === 0 || now >= allowSubmissionsFrom) {
    return 'open';
  }

  return 'unknown';
}

/**
 * Checks if the current user has grading permissions based on their roles
 *
 * @param userRoles - Array of role objects from the user
 * @returns true if user has any grading role
 */
function hasGradingPermission(userRoles: Array<{ shortname: string }>): boolean {
  if (!userRoles || userRoles.length === 0) {
    return false;
  }
  return userRoles.some(role =>
    GRADING_ROLES.includes(role.shortname.toLowerCase())
  );
}

/**
 * Formats a Unix timestamp to a human-readable date string
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string or 'Not set' if timestamp is 0
 */
function formatTimestamp(timestamp: number): string {
  if (!timestamp || timestamp === 0) {
    return 'Not set';
  }
  return format(new Date(timestamp * 1000), DATE_FORMAT);
}

/**
 * Converts a Unix timestamp to a Date object
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Date object or null if timestamp is invalid
 */
function timestampToDate(timestamp: number): Date | null {
  if (!timestamp || timestamp === 0) {
    return null;
  }
  return new Date(timestamp * 1000);
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Renders a status chip indicating submission availability
 */
const AssignmentStatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const getChipProps = (): {
    label: string;
    color: 'success' | 'error' | 'warning' | 'default';
    icon: React.ReactElement;
  } => {
    switch (status) {
      case 'open':
        return {
          label: 'Submissions Open',
          color: 'success',
          icon: <CheckCircleIcon />,
        };
      case 'closed':
        return {
          label: 'Submissions Closed',
          color: 'error',
          icon: <ErrorIcon />,
        };
      case 'not_yet_open':
        return {
          label: 'Not Yet Open',
          color: 'warning',
          icon: <WarningIcon />,
        };
      default:
        return {
          label: 'Unknown Status',
          color: 'default',
          icon: <WarningIcon />,
        };
    }
  };

  const chipProps = getChipProps();

  return (
    <Chip
      icon={chipProps.icon}
      label={chipProps.label}
      color={chipProps.color}
      size="small"
      aria-label={`Assignment status: ${chipProps.label}`}
    />
  );
};

/**
 * Renders a date information item with icon, label, and formatted date
 */
const DateInfoItem: React.FC<DateInfoItemProps> = ({
  icon,
  label,
  timestamp,
  context,
  warning = false,
}) => {
  const date = timestampToDate(timestamp);
  const formattedDate = formatTimestamp(timestamp);
  const isPastDate = date ? isPast(date) : false;

  return (
    <ListItem disablePadding sx={{ py: 0.5 }}>
      <ListItemIcon sx={{ minWidth: 40 }}>
        {icon}
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography
            variant="body2"
            color={warning || (isPastDate && timestamp > 0) ? 'error.main' : 'text.primary'}
          >
            <strong>{label}:</strong> {formattedDate}
          </Typography>
        }
        secondary={context}
      />
    </ListItem>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * AssignmentPage - Main assignment view page component
 *
 * Displays complete assignment information and provides role-appropriate actions.
 * For students: Shows assignment details and submit button
 * For teachers: Shows assignment details and grading access
 *
 * @returns JSX element rendering the assignment page
 *
 * @example
 * ```tsx
 * // Used in React Router configuration
 * <Route path="/assignments/:assignmentId" element={<AssignmentPage />} />
 * ```
 */
const AssignmentPage: React.FC = () => {
  // ============================================================================
  // Hooks and State
  // ============================================================================

  // Extract assignmentId from URL parameters
  const { assignmentId: assignmentIdParam } = useParams<AssignmentPageParams>();
  const navigate = useNavigate();

  // Parse assignment ID from string to number
  const assignmentId = useMemo(() => {
    if (!assignmentIdParam) {
      return null;
    }
    const parsed = parseInt(assignmentIdParam, 10);
    return isNaN(parsed) ? null : parsed;
  }, [assignmentIdParam]);

  // Fetch assignment data using React Query hook
  const {
    data: assignment,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAssignment(assignmentId);

  // Get authentication context
  const { user, isAuthenticated } = useAuth();

  // Local state for tracking any UI-specific states
  const [isNavigating, setIsNavigating] = useState(false);

  // ============================================================================
  // Computed Values
  // ============================================================================

  // Determine if current user has grading permissions
  // Uses both user object and isAuthenticated state from useAuth
  const canGrade = useMemo(() => {
    // Must be authenticated and have user data with roles
    if (!isAuthenticated || !user || !user.roles) {
      return false;
    }
    return hasGradingPermission(user.roles);
  }, [user, isAuthenticated]);

  // Determine submission availability status
  const submissionStatus = useMemo((): SubmissionAvailability => {
    if (!assignment) {
      return 'unknown';
    }
    return getSubmissionAvailability(assignment);
  }, [assignment]);

  // Check if submissions are currently allowed
  // Requires user to be authenticated and submission window to be open
  const canSubmit = useMemo(() => {
    if (!isAuthenticated || !assignment) {
      return false;
    }
    if (canGrade) {
      // Teachers typically don't submit
      return false;
    }
    return submissionStatus === 'open';
  }, [assignment, submissionStatus, canGrade, isAuthenticated]);

  // Check if assignment has team submission enabled
  const isTeamSubmission = useMemo(() => {
    return assignment?.teamsubmission === 1;
  }, [assignment]);

  // Check if blind marking is enabled
  const isBlindMarking = useMemo(() => {
    return assignment?.blindmarking === 1;
  }, [assignment]);

  // Check if submission drafts are enabled
  const hasDrafts = useMemo(() => {
    return assignment?.submissiondrafts === 1;
  }, [assignment]);

  // ============================================================================
  // Navigation Handlers
  // ============================================================================

  /**
   * Navigates to the submission page for this assignment
   */
  const handleSubmitClick = useCallback(() => {
    if (!assignmentId) return;
    setIsNavigating(true);
    navigate(`/assignments/${assignmentId}/submit`);
  }, [assignmentId, navigate]);

  /**
   * Navigates to the grading page for this assignment
   */
  const handleGradingClick = useCallback(() => {
    if (!assignmentId) return;
    setIsNavigating(true);
    navigate(`/assignments/${assignmentId}/grading`);
  }, [assignmentId, navigate]);

  /**
   * Navigates back to the course view
   */
  const handleBackClick = useCallback(() => {
    if (assignment?.course) {
      navigate(`/courses/${assignment.course}`);
    } else {
      navigate(-1);
    }
  }, [assignment, navigate]);

  /**
   * Handles retry when an error occurs
   */
  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  // ============================================================================
  // Effect Hooks
  // ============================================================================

  // Reset navigation state when component unmounts or assignment changes
  useEffect(() => {
    return () => {
      setIsNavigating(false);
    };
  }, [assignmentId]);

  // ============================================================================
  // Render: Invalid Assignment ID
  // ============================================================================

  if (!isValidAssignmentId(assignmentId)) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          p: 3,
        }}
      >
        <Alert
          severity="error"
          sx={{ mb: 2, maxWidth: 600 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleBackClick}
              startIcon={<ArrowBackIcon />}
            >
              Go Back
            </Button>
          }
        >
          <Typography variant="body1">
            Invalid assignment ID provided. The assignment ID must be a valid positive number.
          </Typography>
        </Alert>
      </Box>
    );
  }

  // ============================================================================
  // Render: Loading State
  // ============================================================================

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          p: 3,
        }}
        role="status"
        aria-label="Loading assignment"
      >
        <CircularProgress size={48} aria-hidden="true" />
        <Typography variant="body1" sx={{ mt: 2 }} color="text.secondary">
          Loading assignment...
        </Typography>
      </Box>
    );
  }

  // ============================================================================
  // Render: Error State
  // ============================================================================

  if (isError || !assignment) {
    const errorMessage = error ? getAssignmentErrorMessage(error) : 'Failed to load assignment';

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          p: 3,
        }}
      >
        <Alert
          severity="error"
          sx={{ mb: 2, maxWidth: 600 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button
                color="inherit"
                size="small"
                onClick={handleRetry}
                startIcon={<RefreshIcon />}
                disabled={isFetching}
              >
                {isFetching ? 'Retrying...' : 'Retry'}
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={handleBackClick}
                startIcon={<ArrowBackIcon />}
              >
                Go Back
              </Button>
            </Stack>
          }
        >
          <Typography variant="body1">{errorMessage}</Typography>
        </Alert>
      </Box>
    );
  }

  // ============================================================================
  // Render: Main Assignment View
  // ============================================================================

  return (
    <Box
      component="main"
      sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}
      role="main"
      aria-labelledby="assignment-title"
    >
      {/* Back Navigation */}
      <Box sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBackClick}
          color="inherit"
          size="small"
          aria-label="Go back to course"
        >
          Back to Course
        </Button>
      </Box>

      {/* Header Section */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <AssignmentIcon
            sx={{ fontSize: 40, color: 'primary.main', mt: 0.5 }}
            aria-hidden="true"
          />
          <Box sx={{ flexGrow: 1 }}>
            <Typography
              variant="h4"
              component="h1"
              id="assignment-title"
              gutterBottom
              sx={{ fontWeight: 500 }}
            >
              {assignment.name}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <AssignmentStatusChip status={submissionStatus} />
              {isTeamSubmission && (
                <Chip
                  icon={<GroupsIcon />}
                  label="Team Submission"
                  size="small"
                  color="info"
                  aria-label="This assignment requires team submission"
                />
              )}
              {isBlindMarking && (
                <Chip
                  icon={<VisibilityOffIcon />}
                  label="Blind Marking"
                  size="small"
                  color="secondary"
                  aria-label="This assignment uses blind marking"
                />
              )}
              {hasDrafts && (
                <Chip
                  icon={<EditIcon />}
                  label="Draft Submissions"
                  size="small"
                  variant="outlined"
                  aria-label="Draft submissions are enabled"
                />
              )}
            </Stack>
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ mt: 3 }}>
          {canGrade ? (
            /* Teacher/Grader Actions */
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleGradingClick}
                startIcon={<GradeIcon />}
                disabled={isNavigating}
                aria-label="View and grade submissions"
              >
                View Submissions
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleGradingClick}
                startIcon={<EditIcon />}
                disabled={isNavigating}
                aria-label="Grade submissions"
              >
                Grade Submissions
              </Button>
            </Stack>
          ) : (
            /* Student Actions */
            <Tooltip
              title={
                !canSubmit
                  ? submissionStatus === 'not_yet_open'
                    ? 'Submissions are not open yet'
                    : 'Submissions are closed'
                  : ''
              }
              placement="top"
            >
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSubmitClick}
                  startIcon={<SendIcon />}
                  disabled={!canSubmit || isNavigating}
                  aria-label={canSubmit ? 'Submit assignment' : 'Submissions are not available'}
                >
                  Submit Assignment
                </Button>
              </span>
            </Tooltip>
          )}
        </Box>
      </Paper>

      {/* Description Section */}
      {assignment.intro && (
        <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
          <Typography
            variant="h6"
            component="h2"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <DescriptionIcon color="action" aria-hidden="true" />
            Description
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box
            className="assignment-description"
            sx={{
              '& p': { mt: 0, mb: 2 },
              '& a': { color: 'primary.main' },
              '& img': { maxWidth: '100%', height: 'auto' },
              '& ul, & ol': { pl: 3 },
            }}
            dangerouslySetInnerHTML={{
              __html: assignment.intro,
            }}
            aria-label="Assignment description"
          />
        </Paper>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {/* Dates Section */}
        <Card sx={{ flex: '1 1 300px', minWidth: 280 }}>
          <CardContent>
            <Typography
              variant="h6"
              component="h2"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <CalendarIcon color="action" aria-hidden="true" />
              Important Dates
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List dense disablePadding>
              {assignment.allowsubmissionsfromdate > 0 && (
                <DateInfoItem
                  icon={<ScheduleIcon color="action" fontSize="small" />}
                  label="Available from"
                  timestamp={assignment.allowsubmissionsfromdate}
                  context={
                    isFuture(new Date(assignment.allowsubmissionsfromdate * 1000))
                      ? 'Submissions will open at this time'
                      : 'Submissions are open'
                  }
                />
              )}
              {assignment.duedate > 0 && (
                <DateInfoItem
                  icon={<CalendarIcon color="action" fontSize="small" />}
                  label="Due date"
                  timestamp={assignment.duedate}
                  warning={isPast(new Date(assignment.duedate * 1000))}
                  context={
                    isPast(new Date(assignment.duedate * 1000))
                      ? 'Past due'
                      : undefined
                  }
                />
              )}
              {assignment.cutoffdate > 0 && (
                <DateInfoItem
                  icon={<ErrorIcon color="error" fontSize="small" />}
                  label="Cut-off date"
                  timestamp={assignment.cutoffdate}
                  warning={isPast(new Date(assignment.cutoffdate * 1000))}
                  context="No submissions accepted after this date"
                />
              )}
              {canGrade && assignment.gradingduedate && assignment.gradingduedate > 0 && (
                <DateInfoItem
                  icon={<GradeIcon color="action" fontSize="small" />}
                  label="Grading due"
                  timestamp={assignment.gradingduedate}
                  context="Expected completion date for grading"
                />
              )}
              {assignment.timemodified > 0 && (
                <DateInfoItem
                  icon={<ScheduleIcon color="action" fontSize="small" />}
                  label="Last modified"
                  timestamp={assignment.timemodified}
                />
              )}
            </List>
          </CardContent>
        </Card>

        {/* Grade Settings Section */}
        <Card sx={{ flex: '1 1 300px', minWidth: 280 }}>
          <CardContent>
            <Typography
              variant="h6"
              component="h2"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <GradeIcon color="action" aria-hidden="true" />
              Grade Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List dense disablePadding>
              <ListItem disablePadding sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <GradeIcon fontSize="small" color="action" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body2">
                      <strong>Maximum grade:</strong>{' '}
                      {assignment.grade > 0
                        ? assignment.grade
                        : assignment.grade < 0
                        ? 'Scale'
                        : 'No grade'}
                    </Typography>
                  }
                />
              </ListItem>
              {assignment.maxattempts !== 0 && (
                <ListItem disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <RefreshIcon fontSize="small" color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2">
                        <strong>Maximum attempts:</strong>{' '}
                        {assignment.maxattempts === -1
                          ? 'Unlimited'
                          : assignment.maxattempts}
                      </Typography>
                    }
                  />
                </ListItem>
              )}
              {assignment.markingworkflow === 1 && (
                <ListItem disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <CheckCircleIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2">
                        <strong>Marking workflow:</strong> Enabled
                      </Typography>
                    }
                    secondary="Grades follow a workflow before release"
                  />
                </ListItem>
              )}
            </List>
          </CardContent>
        </Card>

        {/* Submission Settings Section */}
        <Card sx={{ flex: '1 1 300px', minWidth: 280 }}>
          <CardContent>
            <Typography
              variant="h6"
              component="h2"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <AttachFileIcon color="action" aria-hidden="true" />
              Submission Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List dense disablePadding>
              {assignment.submissiondrafts === 1 && (
                <ListItem disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <EditIcon fontSize="small" color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2">
                        <strong>Draft submissions:</strong> Enabled
                      </Typography>
                    }
                    secondary="You can save drafts before final submission"
                  />
                </ListItem>
              )}
              {assignment.requiresubmissionstatement === 1 && (
                <ListItem disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <CheckCircleIcon fontSize="small" color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2">
                        <strong>Submission statement:</strong> Required
                      </Typography>
                    }
                    secondary="You must accept the submission statement"
                  />
                </ListItem>
              )}
              {assignment.teamsubmission === 1 && (
                <ListItem disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <GroupsIcon fontSize="small" color="info" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2">
                        <strong>Team submission:</strong> Enabled
                      </Typography>
                    }
                    secondary={
                      assignment.requireallteammemberssubmit === 1
                        ? 'All team members must submit'
                        : 'One submission per team'
                    }
                  />
                </ListItem>
              )}
              {assignment.timelimit && assignment.timelimit > 0 && (
                <ListItem disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <TimerIcon fontSize="small" color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2">
                        <strong>Time limit:</strong>{' '}
                        {Math.floor(assignment.timelimit / 60)} minutes
                      </Typography>
                    }
                    secondary="Submission must be completed within this time"
                  />
                </ListItem>
              )}
              {assignment.nosubmissions === 1 && (
                <ListItem disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <WarningIcon fontSize="small" color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2">
                        <strong>Submission type:</strong> Offline only
                      </Typography>
                    }
                    secondary="No online submission required"
                  />
                </ListItem>
              )}
            </List>
          </CardContent>
        </Card>
      </Box>

      {/* Additional Information Section (for Teachers) */}
      {canGrade && (
        <Paper elevation={1} sx={{ p: 3, mt: 3 }}>
          <Typography
            variant="h6"
            component="h2"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <PersonIcon color="action" aria-hidden="true" />
            Grading Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            {assignment.blindmarking === 1 && (
              <Alert severity="info" icon={<VisibilityOffIcon />}>
                <Typography variant="body2">
                  <strong>Blind marking is enabled.</strong> Student identities are hidden
                  during grading.
                  {assignment.revealidentities === 1 &&
                    ' Identities have been revealed for this assignment.'}
                </Typography>
              </Alert>
            )}
            {assignment.markingallocation === 1 && (
              <Alert severity="info" icon={<PersonIcon />}>
                <Typography variant="body2">
                  <strong>Marking allocation is enabled.</strong> Submissions can be
                  allocated to specific markers.
                </Typography>
              </Alert>
            )}
            {assignment.sendnotifications === 1 && (
              <Alert severity="info" icon={<CheckCircleIcon />}>
                <Typography variant="body2">
                  <strong>Grader notifications are enabled.</strong> Graders will receive
                  notifications when students submit.
                </Typography>
              </Alert>
            )}
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

// ============================================================================
// Export
// ============================================================================

/**
 * Default export for AssignmentPage component
 *
 * This is the main entry point for the assignment view route.
 * Use with React Router:
 *
 * @example
 * ```tsx
 * import AssignmentPage from '@/features/activities/assignments/pages/AssignmentPage';
 *
 * <Route path="/assignments/:assignmentId" element={<AssignmentPage />} />
 * ```
 */
export default AssignmentPage;
