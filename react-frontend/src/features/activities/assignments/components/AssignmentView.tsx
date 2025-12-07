/**
 * AssignmentView Component
 *
 * Primary component for displaying comprehensive assignment details including title,
 * description, dates, grade configuration, submission settings, and role-based actions.
 * This component serves as the foundation of AssignmentPage and provides a comprehensive
 * overview of assignment details before users take specific actions like submitting or grading.
 *
 * Features:
 * - Assignment metadata display (due date, available from, cut-off, max grade, submission types)
 * - Formatted description content rendering with HTML support
 * - Submission status indicators for students (not submitted, draft, submitted, graded)
 * - Role-based action buttons (Submit for students, View/Grade for teachers)
 * - Support for team submissions, blind marking, multiple attempts, marking workflows
 * - Countdown timers for approaching due dates
 * - Late submission penalty indicators
 *
 * References:
 * - public/mod/assign/view.php - Entry point for assignment viewing
 * - public/mod/assign/locallib.php - view() and view_submission_page() methods
 *
 * @module features/activities/assignments/components/AssignmentView
 */

import React, { useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Divider,
  Alert,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Tooltip,
  Collapse,
  IconButton,
  Badge,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  CalendarToday,
  Grade as GradeIcon,
  Upload,
  People,
  Visibility,
  Edit,
  Info,
  Schedule,
  CheckCircle,
  Warning,
  Description,
  AttachFile,
  Timer,
  ExpandMore,
  ExpandLess,
  Person,
  Group,
  VisibilityOff,
  TextFields,
  InsertDriveFile,
} from '@mui/icons-material';
import { format, formatDistanceToNow, isAfter, isBefore, differenceInDays } from 'date-fns';

import type { Assignment, Submission } from '../types/assignment.types';
import { SubmissionStatus, GradingStatus } from '../types/assignment.types';
import { useAuth } from '@/features/auth/hooks/useAuth';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for AssignmentView component
 *
 * Defines all required and optional properties for rendering the assignment view.
 * Follows the pattern from Moodle's view.php which requires assignment data and
 * optionally includes user submission for students.
 */
export interface AssignmentViewProps {
  /**
   * Full assignment object containing all configuration and settings.
   * Required for rendering assignment details, dates, and requirements.
   */
  assignment: Assignment;

  /**
   * Current user's submission for this assignment (if student role).
   * Used to display submission status, grade, and attempt history.
   * Optional - will be undefined for teachers or if student hasn't started.
   */
  userSubmission?: Submission;

  /**
   * Callback to navigate to the submission page.
   * Called when student clicks "Submit Assignment" or "Edit Submission" button.
   */
  onSubmit?: () => void;

  /**
   * Callback to navigate to the submissions list/grading page.
   * Called when teacher clicks "View All Submissions" button.
   */
  onViewSubmissions?: () => void;

  /**
   * Callback to navigate to the grading interface.
   * Called when teacher clicks "Grade Submissions" button.
   */
  onGrade?: () => void;

  /**
   * Optional loading state for displaying skeleton placeholders.
   * When true, shows loading skeletons instead of actual content.
   */
  isLoading?: boolean;

  /**
   * Optional error message to display.
   * When provided, shows an error alert at the top of the component.
   */
  error?: string;

  /**
   * Optional teacher statistics for grading summary.
   * Only applicable when user has grading permissions.
   */
  teacherStats?: TeacherStatistics;

  /**
   * Optional array of previous submission attempts.
   * Used for displaying submission history when multiple attempts are allowed.
   */
  previousAttempts?: Submission[];
}

/**
 * Teacher statistics interface for grading summary display
 */
interface TeacherStatistics {
  /** Total number of students enrolled in the course */
  totalStudents: number;
  /** Number of submissions received */
  submissionsReceived: number;
  /** Number of submissions that have been graded */
  gradedCount: number;
  /** Number of submissions awaiting grading */
  notGradedCount: number;
  /** Average grade (percentage) if grades exist */
  averageGrade?: number;
}

/**
 * Internal interface for computed date status
 */
interface DateStatus {
  /** Assignment is not yet open for submissions */
  isNotYetOpen: boolean;
  /** Assignment is currently open for submissions */
  isOpen: boolean;
  /** Assignment is closed (past cutoff date) */
  isClosed: boolean;
  /** Number of days until due date (can be negative if overdue) */
  daysUntilDue: number | null;
  /** Submission is overdue (past due date but before cutoff) */
  isOverdue: boolean;
  /** Current time is past the cutoff date */
  isPastCutoff: boolean;
}

/**
 * Internal interface for user submission status
 */
type UserSubmissionStatus = 'not-started' | 'draft' | 'submitted' | 'graded';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format file size in human-readable format
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Convert Unix timestamp to Date object
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Date object or null if timestamp is 0 or undefined
 */
function timestampToDate(timestamp: number | undefined): Date | null {
  if (!timestamp || timestamp === 0) return null;
  return new Date(timestamp * 1000);
}

/**
 * Format date for display
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string or 'Not set'
 */
function formatDate(timestamp: number | undefined): string {
  const date = timestampToDate(timestamp);
  if (!date) return 'Not set';
  return format(date, 'PPpp'); // e.g., "Apr 29, 2023, 9:30 AM"
}

/**
 * Get relative time string
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Relative time string (e.g., "in 3 days")
 */
function getRelativeTime(timestamp: number | undefined): string {
  const date = timestampToDate(timestamp);
  if (!date) return '';
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Check if user has teacher/grading role
 *
 * @param roles - Array of user roles
 * @returns true if user has teacher or editing teacher role
 */
function hasTeacherRole(roles: Array<{ shortname: string }>): boolean {
  const teacherRoles = ['teacher', 'editingteacher', 'manager', 'coursecreator'];
  return roles.some((role) => teacherRoles.includes(role.shortname));
}

/**
 * Sanitize HTML content for safe rendering
 * Basic sanitization - in production, use a library like DOMPurify
 *
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string
 */
function sanitizeHtml(html: string | undefined): string {
  if (!html) return '';
  // Remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Loading skeleton for the assignment view
 */
const AssignmentViewSkeleton: React.FC = () => (
  <Box sx={{ p: 3 }}>
    <Skeleton variant="text" width="60%" height={40} sx={{ mb: 2 }} />
    <Skeleton variant="rectangular" height={120} sx={{ mb: 2, borderRadius: 1 }} />
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
      </Grid>
      <Grid item xs={12} md={6}>
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
      </Grid>
    </Grid>
    <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
      <Skeleton variant="rectangular" width={150} height={40} sx={{ borderRadius: 1 }} />
      <Skeleton variant="rectangular" width={150} height={40} sx={{ borderRadius: 1 }} />
    </Box>
  </Box>
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * AssignmentView Component
 *
 * Displays comprehensive assignment details with role-based content and actions.
 * Renders different UI elements based on whether user is a student or teacher.
 */
const AssignmentView: React.FC<AssignmentViewProps> = ({
  assignment,
  userSubmission,
  onSubmit,
  onViewSubmissions,
  onGrade,
  isLoading = false,
  error,
  teacherStats,
  previousAttempts = [],
}) => {
  const { user, isAuthenticated } = useAuth();
  const [showAdvancedSettings, setShowAdvancedSettings] = React.useState(false);

  // ============================================================================
  // Memoized Calculations
  // ============================================================================

  /**
   * Calculate date-related status flags
   */
  const dateStatus = useMemo<DateStatus>(() => {
    const now = new Date();
    const allowFromDate = timestampToDate(assignment.allowsubmissionsfromdate);
    const dueDate = timestampToDate(assignment.duedate);
    const cutoffDate = timestampToDate(assignment.cutoffdate);

    // Determine if assignment is not yet open
    const isNotYetOpen = allowFromDate ? isBefore(now, allowFromDate) : false;

    // Determine if past cutoff date
    const isPastCutoff = cutoffDate ? isAfter(now, cutoffDate) : false;

    // Determine if overdue (past due date)
    const isOverdue = dueDate ? isAfter(now, dueDate) : false;

    // Assignment is open if:
    // - We're past the allow from date (or it's not set)
    // - We're not past the cutoff date (or it's not set)
    const isOpen = !isNotYetOpen && !isPastCutoff;

    // Assignment is closed if past cutoff date
    const isClosed = isPastCutoff;

    // Calculate days until due
    const daysUntilDue = dueDate ? differenceInDays(dueDate, now) : null;

    return {
      isNotYetOpen,
      isOpen,
      isClosed,
      daysUntilDue,
      isOverdue,
      isPastCutoff,
    };
  }, [assignment.allowsubmissionsfromdate, assignment.duedate, assignment.cutoffdate]);

  /**
   * Determine current user's submission status
   */
  const submissionStatus = useMemo<UserSubmissionStatus>(() => {
    if (!userSubmission) return 'not-started';

    // Check if graded
    if (
      userSubmission.gradingstatus === GradingStatus.GRADED ||
      (userSubmission.grade !== undefined && userSubmission.grade !== null && userSubmission.grade !== '')
    ) {
      return 'graded';
    }

    // Check submission status
    if (userSubmission.status === SubmissionStatus.SUBMITTED) {
      return 'submitted';
    }

    if (userSubmission.status === SubmissionStatus.DRAFT) {
      return 'draft';
    }

    return 'not-started';
  }, [userSubmission]);

  /**
   * Determine if user has teacher/grading permissions
   */
  const isTeacher = useMemo(() => {
    if (!user || !user.roles) return false;
    return hasTeacherRole(user.roles);
  }, [user]);

  /**
   * Determine submission types allowed
   */
  const submissionTypesText = useMemo(() => {
    const configs = assignment.configs || [];
    const fileEnabled = configs.some(
      (c) => c.subtype === 'assignsubmission' && c.plugin === 'file' && c.name === 'enabled' && c.value === '1'
    );
    const textEnabled = configs.some(
      (c) => c.subtype === 'assignsubmission' && c.plugin === 'onlinetext' && c.name === 'enabled' && c.value === '1'
    );

    if (fileEnabled && textEnabled) return 'File submission & Online text';
    if (fileEnabled) return 'File submission';
    if (textEnabled) return 'Online text';
    return 'No submission required';
  }, [assignment.configs]);

  /**
   * Get maximum files configuration
   */
  const maxFiles = useMemo(() => {
    const configs = assignment.configs || [];
    const maxFilesConfig = configs.find(
      (c) => c.subtype === 'assignsubmission' && c.plugin === 'file' && c.name === 'maxfilesubmissions'
    );
    return maxFilesConfig ? parseInt(maxFilesConfig.value, 10) : 1;
  }, [assignment.configs]);

  /**
   * Get maximum file size configuration
   */
  const maxFileSize = useMemo(() => {
    const configs = assignment.configs || [];
    const maxSizeConfig = configs.find(
      (c) => c.subtype === 'assignsubmission' && c.plugin === 'file' && c.name === 'maxsubmissionsizebytes'
    );
    return maxSizeConfig ? parseInt(maxSizeConfig.value, 10) : 0;
  }, [assignment.configs]);

  /**
   * Get accepted file types
   */
  const acceptedFileTypes = useMemo(() => {
    const configs = assignment.configs || [];
    const fileTypesConfig = configs.find(
      (c) => c.subtype === 'assignsubmission' && c.plugin === 'file' && c.name === 'filetypeslist'
    );
    return fileTypesConfig && fileTypesConfig.value ? fileTypesConfig.value.split(',') : [];
  }, [assignment.configs]);

  // ============================================================================
  // Callbacks
  // ============================================================================

  /**
   * Handle submit button click
   */
  const handleSubmit = useCallback(() => {
    if (onSubmit) {
      onSubmit();
    }
  }, [onSubmit]);

  /**
   * Handle view submissions button click
   */
  const handleViewSubmissions = useCallback(() => {
    if (onViewSubmissions) {
      onViewSubmissions();
    }
  }, [onViewSubmissions]);

  /**
   * Handle grade button click
   */
  const handleGrade = useCallback(() => {
    if (onGrade) {
      onGrade();
    }
  }, [onGrade]);

  /**
   * Toggle advanced settings visibility
   */
  const handleToggleAdvancedSettings = useCallback(() => {
    setShowAdvancedSettings((prev) => !prev);
  }, []);

  // ============================================================================
  // Render: Loading State
  // ============================================================================

  if (isLoading) {
    return <AssignmentViewSkeleton />;
  }

  // ============================================================================
  // Render: Error State
  // ============================================================================

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="outlined" onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </Box>
    );
  }

  // ============================================================================
  // Render: Main Content
  // ============================================================================

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Assignment Header */}
      <Paper
        elevation={2}
        sx={{
          mb: 3,
          overflow: 'hidden',
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            p: 3,
            background: (theme) =>
              `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: 'white',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <AssignmentIcon sx={{ fontSize: 40, mt: 0.5 }} aria-hidden="true" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
                {assignment.name}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {/* Status Chip */}
                {dateStatus.isNotYetOpen && (
                  <Chip
                    icon={<Schedule />}
                    label="Not Yet Open"
                    color="default"
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                )}
                {dateStatus.isOpen && !dateStatus.isOverdue && (
                  <Chip
                    icon={<CheckCircle />}
                    label="Open"
                    color="success"
                    size="small"
                    sx={{ bgcolor: 'rgba(76,175,80,0.8)' }}
                  />
                )}
                {dateStatus.isOpen && dateStatus.isOverdue && (
                  <Chip
                    icon={<Warning />}
                    label="Overdue"
                    color="warning"
                    size="small"
                    sx={{ bgcolor: 'rgba(255,152,0,0.9)' }}
                  />
                )}
                {dateStatus.isClosed && (
                  <Chip
                    icon={<Warning />}
                    label="Closed"
                    color="error"
                    size="small"
                    sx={{ bgcolor: 'rgba(244,67,54,0.9)' }}
                  />
                )}
                {/* Team Submission Indicator */}
                {assignment.teamsubmission === 1 && (
                  <Chip
                    icon={<People />}
                    label="Team Submission"
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                )}
                {/* Blind Marking Indicator */}
                {assignment.blindmarking === 1 && (
                  <Chip
                    icon={<VisibilityOff />}
                    label="Blind Marking"
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Left Column - Dates and Description */}
        <Grid item xs={12} md={8}>
          {/* Important Dates Card */}
          <Card sx={{ mb: 3, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarToday color="primary" aria-hidden="true" />
                Important Dates
              </Typography>
              <List disablePadding>
                {/* Available From Date */}
                {assignment.allowsubmissionsfromdate > 0 && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Schedule color="action" aria-hidden="true" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Available From"
                      secondary={
                        <Box component="span">
                          {formatDate(assignment.allowsubmissionsfromdate)}
                          {dateStatus.isNotYetOpen && (
                            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                              ({getRelativeTime(assignment.allowsubmissionsfromdate)})
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                )}

                {/* Due Date */}
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <CalendarToday
                      color={dateStatus.isOverdue ? 'error' : 'action'}
                      aria-hidden="true"
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary="Due Date"
                    secondary={
                      <Box component="span">
                        <Typography
                          component="span"
                          variant="body2"
                          color={dateStatus.isOverdue ? 'error.main' : 'text.secondary'}
                          sx={{ fontWeight: dateStatus.isOverdue ? 600 : 400 }}
                        >
                          {assignment.duedate > 0 ? formatDate(assignment.duedate) : 'No due date'}
                        </Typography>
                        {assignment.duedate > 0 && dateStatus.daysUntilDue !== null && (
                          <Typography
                            component="span"
                            variant="body2"
                            color={dateStatus.isOverdue ? 'error.main' : dateStatus.daysUntilDue <= 3 ? 'warning.main' : 'text.secondary'}
                            sx={{ ml: 1, fontWeight: 500 }}
                          >
                            {dateStatus.isOverdue
                              ? `(${Math.abs(dateStatus.daysUntilDue)} days overdue)`
                              : dateStatus.daysUntilDue === 0
                                ? '(Due today!)'
                                : dateStatus.daysUntilDue === 1
                                  ? '(Due tomorrow)'
                                  : `(Due in ${dateStatus.daysUntilDue} days)`}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>

                {/* Cut-off Date */}
                {assignment.cutoffdate > 0 && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Warning color="warning" aria-hidden="true" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Cut-off Date"
                      secondary={
                        <Box component="span">
                          {formatDate(assignment.cutoffdate)}
                          <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}>
                            Late submissions not accepted after this date
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                )}

                {/* Grading Due Date (for teachers) */}
                {isTeacher && assignment.gradingduedate > 0 && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <GradeIcon color="action" aria-hidden="true" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Grading Due Date"
                      secondary={formatDate(assignment.gradingduedate)}
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>

          {/* Description Card */}
          <Card sx={{ mb: 3, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Description color="primary" aria-hidden="true" />
                Description
              </Typography>
              {assignment.intro ? (
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'grey.200',
                    '& img': { maxWidth: '100%', height: 'auto' },
                    '& ul, & ol': { pl: 3 },
                    '& a': { color: 'primary.main' },
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.intro) }}
                  aria-label="Assignment description"
                />
              ) : (
                <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No description provided.
                </Typography>
              )}

              {/* Introduction Attachments */}
              {assignment.introattachments && assignment.introattachments.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AttachFile fontSize="small" aria-hidden="true" />
                    Attachments
                  </Typography>
                  <List dense disablePadding>
                    {assignment.introattachments.map((file, index) => (
                      <ListItem key={index} sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <InsertDriveFile fontSize="small" color="action" aria-hidden="true" />
                        </ListItemIcon>
                        <ListItemText
                          primary={file.filename}
                          secondary={formatFileSize(file.filesize)}
                        />
                        <Button
                          size="small"
                          href={file.fileurl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Download ${file.filename}`}
                        >
                          Download
                        </Button>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Student Submission Status */}
          {!isTeacher && isAuthenticated && (
            <Box sx={{ mb: 3 }}>
              {submissionStatus === 'not-started' && (
                <Alert severity="info" icon={<Info />}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    You have not submitted yet.
                  </Typography>
                  {assignment.duedate > 0 && !dateStatus.isOverdue && (
                    <Typography variant="body2">
                      Make sure to submit before the due date.
                    </Typography>
                  )}
                </Alert>
              )}
              {submissionStatus === 'draft' && (
                <Alert severity="warning" icon={<Edit />}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    You have a draft submission.
                  </Typography>
                  <Typography variant="body2">
                    Remember to submit your work when you're ready.
                  </Typography>
                </Alert>
              )}
              {submissionStatus === 'submitted' && userSubmission && (
                <Alert severity="success" icon={<CheckCircle />}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    Submitted on {formatDate(userSubmission.timemodified)}
                  </Typography>
                  {assignment.maxattempts !== 1 && userSubmission.attemptnumber !== undefined && (
                    <Typography variant="body2">
                      Attempt {userSubmission.attemptnumber + 1}
                      {assignment.maxattempts > 0 ? ` of ${assignment.maxattempts}` : ' (Unlimited attempts)'}
                    </Typography>
                  )}
                </Alert>
              )}
              {submissionStatus === 'graded' && userSubmission && (
                <Alert severity="success" icon={<GradeIcon />}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    Graded: {userSubmission.grade}
                    {assignment.grade > 0 ? ` / ${assignment.grade}` : ''}
                  </Typography>
                  {userSubmission.timemodified && (
                    <Typography variant="body2">
                      Submitted on {formatDate(userSubmission.timemodified)}
                    </Typography>
                  )}
                </Alert>
              )}

              {/* Late Submission Warning */}
              {dateStatus.isOverdue && !dateStatus.isClosed && assignment.cutoffdate > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }} icon={<Warning />}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    Submissions are now late.
                  </Typography>
                  {assignment.gradepenalty > 0 && (
                    <Typography variant="body2">
                      Late penalties may be applied to your grade.
                    </Typography>
                  )}
                </Alert>
              )}
              {dateStatus.isClosed && (
                <Alert severity="error" sx={{ mt: 2 }} icon={<Warning />}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    Late submissions are not accepted.
                  </Typography>
                  <Typography variant="body2">
                    The cut-off date has passed.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}

          {/* Previous Attempts Section (for students with multiple attempts) */}
          {!isTeacher && previousAttempts.length > 0 && assignment.maxattempts !== 1 && (
            <Card sx={{ mb: 3, borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" component="h2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Timer color="primary" aria-hidden="true" />
                  Previous Submissions
                </Typography>
                <List disablePadding>
                  {previousAttempts.map((attempt, index) => (
                    <ListItem key={attempt.id} sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: 'grey.200',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                          }}
                        >
                          {index + 1}
                        </Typography>
                      </ListItemIcon>
                      <ListItemText
                        primary={`Attempt ${attempt.attemptnumber + 1}`}
                        secondary={
                          <Box component="span">
                            {formatDate(attempt.timemodified)}
                            {attempt.gradingstatus === GradingStatus.GRADED && attempt.grade && (
                              <Typography component="span" variant="body2" color="primary" sx={{ ml: 1 }}>
                                Grade: {attempt.grade}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <Chip
                        label={attempt.status}
                        size="small"
                        color={attempt.status === SubmissionStatus.SUBMITTED ? 'success' : 'default'}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Right Column - Requirements and Actions */}
        <Grid item xs={12} md={4}>
          {/* Submission Requirements Card */}
          <Card sx={{ mb: 3, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Upload color="primary" aria-hidden="true" />
                Submission Requirements
              </Typography>
              <List disablePadding dense>
                {/* Submission Types */}
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {submissionTypesText.includes('File') ? (
                      <InsertDriveFile fontSize="small" color="action" aria-hidden="true" />
                    ) : (
                      <TextFields fontSize="small" color="action" aria-hidden="true" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary="Submission Type"
                    secondary={submissionTypesText}
                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1' }}
                  />
                </ListItem>

                {/* Maximum Files */}
                {submissionTypesText.includes('File') && maxFiles > 0 && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <AttachFile fontSize="small" color="action" aria-hidden="true" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Maximum Files"
                      secondary={`${maxFiles} file${maxFiles > 1 ? 's' : ''}`}
                      primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                )}

                {/* File Size Limit */}
                {submissionTypesText.includes('File') && maxFileSize > 0 && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Info fontSize="small" color="action" aria-hidden="true" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Maximum File Size"
                      secondary={formatFileSize(maxFileSize)}
                      primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                )}

                {/* Accepted File Types */}
                {acceptedFileTypes.length > 0 && (
                  <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
                    <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                      <InsertDriveFile fontSize="small" color="action" aria-hidden="true" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Accepted Types"
                      secondary={acceptedFileTypes.join(', ')}
                      primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body1', sx: { wordBreak: 'break-word' } }}
                    />
                  </ListItem>
                )}

                {/* Submission Statement */}
                {assignment.requiresubmissionstatement === 1 && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircle fontSize="small" color="success" aria-hidden="true" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Submission Statement"
                      secondary="Required"
                      primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>

          {/* Grading Information Card */}
          <Card sx={{ mb: 3, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <GradeIcon color="primary" aria-hidden="true" />
                Grading
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Maximum Grade:</strong>{' '}
                {assignment.grade > 0 ? `${assignment.grade} points` : 'No grade'}
              </Typography>
              {assignment.gradepenalty > 0 && (
                <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
                  Late penalty: {assignment.gradepenalty}% per day
                </Typography>
              )}
              {assignment.maxattempts !== 1 && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Attempts:</strong>{' '}
                  {assignment.maxattempts === -1 ? 'Unlimited' : assignment.maxattempts}
                </Typography>
              )}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                {assignment.blindmarking === 1 && (
                  <Chip
                    icon={<VisibilityOff fontSize="small" />}
                    label="Blind Marking"
                    size="small"
                    variant="outlined"
                  />
                )}
                {assignment.teamsubmission === 1 && (
                  <Chip
                    icon={<People fontSize="small" />}
                    label="Team Submission"
                    size="small"
                    variant="outlined"
                  />
                )}
                {assignment.markingworkflow === 1 && (
                  <Chip
                    icon={<Edit fontSize="small" />}
                    label="Marking Workflow"
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Teacher Statistics Card */}
          {isTeacher && teacherStats && (
            <Card sx={{ mb: 3, borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" component="h2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person color="primary" aria-hidden="true" />
                  Submission Statistics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="h4" color="primary" sx={{ fontWeight: 600 }}>
                      {teacherStats.totalStudents}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Students
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h4" color="info.main" sx={{ fontWeight: 600 }}>
                      {teacherStats.submissionsReceived}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Submissions
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h4" color="success.main" sx={{ fontWeight: 600 }}>
                      {teacherStats.gradedCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Graded
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h4" color="warning.main" sx={{ fontWeight: 600 }}>
                      {teacherStats.notGradedCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Not Graded
                    </Typography>
                  </Grid>
                  {teacherStats.averageGrade !== undefined && (
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="body1">
                        <strong>Average Grade:</strong> {teacherStats.averageGrade.toFixed(1)}%
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Advanced Settings (Collapsible) */}
          <Card sx={{ mb: 3, borderRadius: 2 }}>
            <CardContent sx={{ pb: 0 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
                onClick={handleToggleAdvancedSettings}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleToggleAdvancedSettings();
                  }
                }}
                aria-expanded={showAdvancedSettings}
                aria-controls="advanced-settings-content"
              >
                <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Info color="action" aria-hidden="true" />
                  Advanced Settings
                </Typography>
                <IconButton size="small" aria-label={showAdvancedSettings ? 'Collapse' : 'Expand'}>
                  {showAdvancedSettings ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>
            </CardContent>
            <Collapse in={showAdvancedSettings} id="advanced-settings-content">
              <CardContent sx={{ pt: 1 }}>
                <List dense disablePadding>
                  {assignment.sendnotifications === 1 && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText primary="Notify graders on submission" />
                      <Chip label="Enabled" size="small" color="primary" variant="outlined" />
                    </ListItem>
                  )}
                  {assignment.sendlatenotifications === 1 && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText primary="Notify graders of late submissions" />
                      <Chip label="Enabled" size="small" color="primary" variant="outlined" />
                    </ListItem>
                  )}
                  {assignment.sendstudentnotifications === 1 && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText primary="Notify students when graded" />
                      <Chip label="Enabled" size="small" color="primary" variant="outlined" />
                    </ListItem>
                  )}
                  {assignment.submissiondrafts === 1 && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText primary="Require submission button" />
                      <Chip label="Yes" size="small" color="primary" variant="outlined" />
                    </ListItem>
                  )}
                  {assignment.timelimit && assignment.timelimit > 0 && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary="Time limit"
                        secondary={`${Math.floor(assignment.timelimit / 60)} minutes`}
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Collapse>
          </Card>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Divider sx={{ my: 3 }} />
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: { xs: 'center', sm: 'flex-start' },
        }}
      >
        {/* Student Action Buttons */}
        {!isTeacher && isAuthenticated && (
          <>
            <Tooltip
              title={
                dateStatus.isNotYetOpen
                  ? 'Assignment not yet open'
                  : dateStatus.isClosed
                    ? 'Submissions are closed'
                    : ''
              }
            >
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={submissionStatus === 'draft' ? <Edit /> : <Upload />}
                  onClick={handleSubmit}
                  disabled={dateStatus.isNotYetOpen || dateStatus.isClosed}
                  sx={{ minWidth: 180, minHeight: 44 }}
                  aria-label={
                    submissionStatus === 'draft'
                      ? 'Edit your submission'
                      : submissionStatus === 'submitted' || submissionStatus === 'graded'
                        ? 'View your submission'
                        : 'Submit assignment'
                  }
                >
                  {submissionStatus === 'draft'
                    ? 'Edit Submission'
                    : submissionStatus === 'submitted' || submissionStatus === 'graded'
                      ? 'View Submission'
                      : 'Submit Assignment'}
                </Button>
              </span>
            </Tooltip>
          </>
        )}

        {/* Teacher Action Buttons */}
        {isTeacher && (
          <>
            <Badge
              badgeContent={teacherStats?.submissionsReceived || 0}
              color="primary"
              max={999}
              showZero
            >
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<Visibility />}
                onClick={handleViewSubmissions}
                sx={{ minWidth: 180, minHeight: 44 }}
                aria-label="View all submissions"
              >
                View All Submissions
              </Button>
            </Badge>
            <Badge
              badgeContent={teacherStats?.notGradedCount || 0}
              color="warning"
              max={999}
            >
              <Button
                variant="outlined"
                color="primary"
                size="large"
                startIcon={<GradeIcon />}
                onClick={handleGrade}
                sx={{ minWidth: 180, minHeight: 44 }}
                aria-label="Grade submissions"
              >
                Grade Submissions
              </Button>
            </Badge>
          </>
        )}

        {/* Not authenticated message */}
        {!isAuthenticated && (
          <Alert severity="info" sx={{ width: '100%' }}>
            Please log in to view submission options.
          </Alert>
        )}
      </Box>
    </Box>
  );
};

// Export the component as default
export default AssignmentView;
