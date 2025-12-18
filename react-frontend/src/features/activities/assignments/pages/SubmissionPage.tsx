/**
 * SubmissionPage Component
 *
 * React page component for the student submission workflow that allows students
 * to submit their assignment work including text submissions and file uploads.
 * This component serves as the React equivalent of Moodle's edit submission
 * functionality from public/mod/assign/view.php (action='editsubmission') and
 * locallib.php view_edit_submission_page() method.
 *
 * Features:
 * - Multi-step form interface with assignment context display
 * - Online text editor (if enabled) with RichTextEditor component
 * - File upload zone with drag-and-drop support via FileUploadZone
 * - Submission confirmation with statement acceptance
 * - Previous submissions display if multiple attempts are allowed
 * - Form validation and loading states during file upload
 * - Success/error feedback with navigation back to assignment view
 * - Material-UI components following design system
 * - React Hook Form for form state management
 *
 * References:
 * - public/mod/assign/view.php - Entry point for edit submission action
 * - public/mod/assign/locallib.php - view_edit_submission_page() implementation
 * - public/mod/assign/submission_form.php - Moodle submission form
 *
 * @module features/activities/assignments/pages/SubmissionPage
 * @package react-frontend
 * @copyright 2024 Moodle React Frontend
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Alert,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Divider,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Backdrop,
  Snackbar,
  AlertTitle,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Send as SubmitIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Description as DescriptionIcon,
  CalendarToday as CalendarIcon,
  Grade as GradeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Assignment as AssignmentIcon,
  AccessTime as TimeIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';

// Internal imports from dependency files
import { useAssignment } from '../hooks/useAssignment';
import { useSubmitAssignment } from '../hooks/useSubmission';
import type { Submission, Assignment as AssignmentType } from '../types/assignment.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { FileUploadZone } from '../components/FileUploadZone';
import { RichTextEditor } from '@/components/editor/RichTextEditor';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * URL parameters interface for the submission page route
 */
interface SubmissionPageParams {
  /** Assignment ID from URL */
  assignmentId: string;
}

/**
 * Form data structure for submission
 */
interface SubmissionFormData {
  /** Online text content (HTML string) */
  onlineText: string;
  /** Files for file submission */
  files: File[];
  /** Whether submission statement is accepted */
  acceptSubmissionStatement: boolean;
}

/**
 * Stepper step configuration
 */
interface SubmissionStep {
  /** Step label */
  label: string;
  /** Step description */
  description: string;
  /** Step icon */
  icon: React.ReactNode;
}

// ============================================================================
// Constants
// ============================================================================

/** Submission steps for the stepper */
const SUBMISSION_STEPS: SubmissionStep[] = [
  {
    label: 'Review Assignment',
    description: 'Review the assignment requirements',
    icon: <AssignmentIcon />,
  },
  {
    label: 'Add Submission',
    description: 'Enter your submission content',
    icon: <DescriptionIcon />,
  },
  {
    label: 'Confirm & Submit',
    description: 'Review and submit your work',
    icon: <CheckCircleIcon />,
  },
];

/** Countdown thresholds in seconds */
const COUNTDOWN_WARNING_THRESHOLD = 24 * 60 * 60; // 24 hours
const COUNTDOWN_DANGER_THRESHOLD = 60 * 60; // 1 hour

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a Unix timestamp to a localized date string
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string
 */
function formatDateTime(timestamp: number): string {
  if (!timestamp || timestamp === 0) {
    return 'Not set';
  }
  const date = new Date(timestamp * 1000);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate time remaining until a deadline
 *
 * @param deadline - Unix timestamp in seconds
 * @returns Object with time remaining details
 */
function getTimeRemaining(deadline: number): {
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
  formattedString: string;
} {
  if (!deadline || deadline === 0) {
    return {
      totalSeconds: Infinity,
      days: 0,
      hours: 0,
      minutes: 0,
      isPast: false,
      formattedString: 'No due date',
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const diff = deadline - now;
  const isPast = diff < 0;
  const absDiff = Math.abs(diff);

  const days = Math.floor(absDiff / (24 * 60 * 60));
  const hours = Math.floor((absDiff % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((absDiff % (60 * 60)) / 60);

  let formattedString = '';
  if (isPast) {
    formattedString = 'Past due';
    if (days > 0) formattedString += ` by ${days} day${days !== 1 ? 's' : ''}`;
    else if (hours > 0) formattedString += ` by ${hours} hour${hours !== 1 ? 's' : ''}`;
    else formattedString += ` by ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    if (days > 0) {
      formattedString = `${days} day${days !== 1 ? 's' : ''} remaining`;
    } else if (hours > 0) {
      formattedString = `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} min remaining`;
    } else {
      formattedString = `${minutes} minute${minutes !== 1 ? 's' : ''} remaining`;
    }
  }

  return {
    totalSeconds: diff,
    days,
    hours,
    minutes,
    isPast,
    formattedString,
  };
}

/**
 * Check if submissions are currently open for an assignment
 *
 * @param assignment - Assignment data
 * @returns Object with submission status details
 */
function checkSubmissionsOpen(assignment: AssignmentType): {
  isOpen: boolean;
  reason: string | null;
  canSubmit: boolean;
} {
  const now = Math.floor(Date.now() / 1000);

  // Check if submissions have started
  if (assignment.allowsubmissionsfromdate && assignment.allowsubmissionsfromdate > now) {
    return {
      isOpen: false,
      reason: `Submissions open on ${formatDateTime(assignment.allowsubmissionsfromdate)}`,
      canSubmit: false,
    };
  }

  // Check if submissions have closed (cutoff date)
  if (assignment.cutoffdate && assignment.cutoffdate > 0 && assignment.cutoffdate < now) {
    return {
      isOpen: false,
      reason: 'Submissions are closed. The cut-off date has passed.',
      canSubmit: false,
    };
  }

  // Submissions are open
  const isPastDue = assignment.duedate > 0 && assignment.duedate < now;

  return {
    isOpen: true,
    reason: isPastDue ? 'Assignment is past due. Late submissions may incur a penalty.' : null,
    canSubmit: true,
  };
}

/**
 * Get submission status display configuration
 *
 * @param status - Submission status string
 * @returns Status display configuration
 */
function getSubmissionStatusConfig(status: string): {
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  label: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'submitted':
      return {
        color: 'success',
        label: 'Submitted',
        icon: <CheckCircleIcon fontSize="small" />,
      };
    case 'draft':
      return {
        color: 'warning',
        label: 'Draft',
        icon: <SaveIcon fontSize="small" />,
      };
    case 'new':
      return {
        color: 'default',
        label: 'Not submitted',
        icon: <InfoIcon fontSize="small" />,
      };
    case 'reopened':
      return {
        color: 'info',
        label: 'Reopened for changes',
        icon: <HistoryIcon fontSize="small" />,
      };
    default:
      return {
        color: 'default',
        label: status || 'Unknown',
        icon: <InfoIcon fontSize="small" />,
      };
  }
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * SubmissionPage Component
 *
 * Main page component for student assignment submission workflow. Provides a
 * comprehensive interface for submitting assignments including file uploads
 * and online text submissions.
 *
 * @component
 * @example
 * ```tsx
 * // Used as a route component
 * <Route path="/assignments/:assignmentId/submit" element={<SubmissionPage />} />
 * ```
 */
function SubmissionPage(): React.ReactElement {
  // ============================================================================
  // Routing & Navigation
  // ============================================================================

  const { assignmentId } = useParams<SubmissionPageParams>();
  const navigate = useNavigate();
  const parsedAssignmentId = assignmentId ? parseInt(assignmentId, 10) : null;

  // ============================================================================
  // Authentication
  // ============================================================================

  const { user, isAuthenticated } = useAuth();

  // ============================================================================
  // Data Fetching Hooks
  // ============================================================================

  const {
    data: assignment,
    isLoading: isAssignmentLoading,
    error: assignmentError,
  } = useAssignment(parsedAssignmentId);

  // ============================================================================
  // Mutations
  // ============================================================================

  const submitAssignmentMutation = useSubmitAssignment({
    onSuccess: () => {
      setSubmissionSuccess(true);
      setShowSuccessSnackbar(true);
    },
    onError: (error) => {
      setSubmissionError(error.message || 'An error occurred during submission');
    },
  });

  // ============================================================================
  // Component State
  // ============================================================================

  /** Current step in the submission workflow (0-indexed) */
  const [activeStep, setActiveStep] = useState<number>(0);

  /** Files selected for upload */
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  /** Show confirmation dialog before final submission */
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);

  /** Whether to save as draft instead of submitting */
  const [saveAsDraft, setSaveAsDraft] = useState<boolean>(false);

  /** Submission success state */
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false);

  /** Submission error message */
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  /** Show success snackbar */
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState<boolean>(false);

  /** Expand previous submissions section */
  const [showPreviousSubmissions, setShowPreviousSubmissions] = useState<boolean>(false);

  // ============================================================================
  // Form Setup
  // ============================================================================

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty, isValid },
    reset,
  } = useForm<SubmissionFormData>({
    defaultValues: {
      onlineText: '',
      files: [],
      acceptSubmissionStatement: false,
    },
    mode: 'onChange',
  });

  // Watch form values for validation and display
  const watchedOnlineText = watch('onlineText');
  const watchedAcceptStatement = watch('acceptSubmissionStatement');

  // ============================================================================
  // Memoized Computations
  // ============================================================================

  /**
   * Check if online text submission is enabled for this assignment
   */
  const isOnlineTextEnabled = useMemo(() => {
    if (!assignment) return false;
    // Check submission plugins for online text plugin
    return assignment.configs?.some(
      (config) => config.plugin === 'onlinetext' && config.name === 'enabled' && config.value === '1'
    ) ?? false;
  }, [assignment]);

  /**
   * Check if file submission is enabled for this assignment
   */
  const isFileSubmissionEnabled = useMemo(() => {
    if (!assignment) return false;
    // Check submission plugins for file plugin
    return assignment.configs?.some(
      (config) => config.plugin === 'file' && config.name === 'enabled' && config.value === '1'
    ) ?? false;
  }, [assignment]);

  /**
   * Get maximum number of files allowed
   */
  const maxFilesAllowed = useMemo(() => {
    if (!assignment?.configs) return 1;
    const maxFilesConfig = assignment.configs.find(
      (config) => config.plugin === 'file' && config.name === 'maxfilesubmissions'
    );
    return maxFilesConfig ? parseInt(maxFilesConfig.value, 10) : 1;
  }, [assignment]);

  /**
   * Get maximum file size allowed in bytes
   */
  const maxFileSizeBytes = useMemo(() => {
    if (!assignment?.configs) return 10 * 1024 * 1024; // Default 10MB
    const maxSizeConfig = assignment.configs.find(
      (config) => config.plugin === 'file' && config.name === 'maxsubmissionsizebytes'
    );
    return maxSizeConfig ? parseInt(maxSizeConfig.value, 10) : 10 * 1024 * 1024;
  }, [assignment]);

  /**
   * Get accepted file types
   */
  const acceptedFileTypes = useMemo(() => {
    if (!assignment?.configs) return ['*'];
    const typesConfig = assignment.configs.find(
      (config) => config.plugin === 'file' && config.name === 'filetypeslist'
    );
    if (typesConfig && typesConfig.value) {
      return typesConfig.value.split(',').map((type) => type.trim());
    }
    return ['*'];
  }, [assignment]);

  /**
   * Check submission open status
   */
  const submissionStatus = useMemo(() => {
    if (!assignment) return { isOpen: false, reason: 'Loading...', canSubmit: false };
    return checkSubmissionsOpen(assignment);
  }, [assignment]);

  /**
   * Time remaining until due date
   */
  const timeRemaining = useMemo(() => {
    if (!assignment?.duedate) return null;
    return getTimeRemaining(assignment.duedate);
  }, [assignment]);

  /**
   * Whether submission statement is required
   */
  const requiresSubmissionStatement = useMemo(() => {
    return assignment?.requiresubmissionstatement === 1;
  }, [assignment]);

  /**
   * Whether draft submissions are enabled
   */
  const draftsEnabled = useMemo(() => {
    return assignment?.submissiondrafts === 1;
  }, [assignment]);

  /**
   * Check if form can be submitted
   */
  const canSubmit = useMemo(() => {
    if (!submissionStatus.canSubmit) return false;
    if (requiresSubmissionStatement && !watchedAcceptStatement) return false;

    // Must have either text or files if those types are enabled
    const hasOnlineText = isOnlineTextEnabled && watchedOnlineText && watchedOnlineText.trim().length > 0;
    const hasFiles = isFileSubmissionEnabled && selectedFiles.length > 0;

    if (isOnlineTextEnabled && isFileSubmissionEnabled) {
      // At least one required if both enabled
      return hasOnlineText || hasFiles;
    }
    if (isOnlineTextEnabled) return hasOnlineText;
    if (isFileSubmissionEnabled) return hasFiles;

    return true;
  }, [
    submissionStatus.canSubmit,
    requiresSubmissionStatement,
    watchedAcceptStatement,
    isOnlineTextEnabled,
    isFileSubmissionEnabled,
    watchedOnlineText,
    selectedFiles.length,
  ]);

  // ============================================================================
  // Callbacks
  // ============================================================================

  /**
   * Handle file selection changes from FileUploadZone
   */
  const handleFilesChange = useCallback((files: File[]) => {
    setSelectedFiles(files);
    setValue('files', files, { shouldDirty: true, shouldValidate: true });
  }, [setValue]);

  /**
   * Navigate back to assignment view page
   */
  const handleCancel = useCallback(() => {
    if (parsedAssignmentId) {
      navigate(`/assignments/${parsedAssignmentId}`);
    } else {
      navigate(-1);
    }
  }, [navigate, parsedAssignmentId]);

  /**
   * Move to next step in the stepper
   */
  const handleNextStep = useCallback(() => {
    setActiveStep((prev) => Math.min(prev + 1, SUBMISSION_STEPS.length - 1));
  }, []);

  /**
   * Move to previous step in the stepper
   */
  const handlePreviousStep = useCallback(() => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  }, []);

  /**
   * Open confirmation dialog before final submission
   */
  const handleOpenConfirmDialog = useCallback(() => {
    setSaveAsDraft(false);
    setShowConfirmDialog(true);
  }, []);

  /**
   * Open confirmation dialog for save as draft
   */
  const handleOpenDraftDialog = useCallback(() => {
    setSaveAsDraft(true);
    setShowConfirmDialog(true);
  }, []);

  /**
   * Close confirmation dialog
   */
  const handleCloseConfirmDialog = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  /**
   * Close success snackbar
   */
  const handleCloseSuccessSnackbar = useCallback(() => {
    setShowSuccessSnackbar(false);
    // Navigate to assignment view after closing snackbar
    if (submissionSuccess && parsedAssignmentId) {
      navigate(`/assignments/${parsedAssignmentId}`);
    }
  }, [submissionSuccess, navigate, parsedAssignmentId]);

  /**
   * Toggle previous submissions section visibility
   */
  const handleTogglePreviousSubmissions = useCallback(() => {
    setShowPreviousSubmissions((prev) => !prev);
  }, []);

  /**
   * Form submission handler
   */
  const onSubmit = useCallback(
    (data: SubmissionFormData) => {
      if (!parsedAssignmentId) {
        setSubmissionError('Invalid assignment ID');
        return;
      }

      setSubmissionError(null);

      submitAssignmentMutation.mutate({
        assignmentId: parsedAssignmentId,
        onlineText: isOnlineTextEnabled ? data.onlineText : undefined,
        files: isFileSubmissionEnabled ? selectedFiles : undefined,
        acceptSubmissionStatement: data.acceptSubmissionStatement,
        saveAsDraft,
      });

      setShowConfirmDialog(false);
    },
    [
      parsedAssignmentId,
      submitAssignmentMutation,
      isOnlineTextEnabled,
      isFileSubmissionEnabled,
      selectedFiles,
      saveAsDraft,
    ]
  );

  /**
   * Confirm and submit handler (called from dialog)
   */
  const handleConfirmSubmit = useCallback(() => {
    handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Redirect unauthenticated users
   */
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', {
        state: {
          from: `/assignments/${assignmentId}/submit`,
          message: 'Please log in to submit your assignment.',
        },
      });
    }
  }, [isAuthenticated, navigate, assignmentId]);

  /**
   * Clear error when form values change
   */
  useEffect(() => {
    if (submissionError) {
      setSubmissionError(null);
    }
  }, [watchedOnlineText, selectedFiles.length]);

  // ============================================================================
  // Render: Loading State
  // ============================================================================

  if (isAssignmentLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 2,
        }}
      >
        <CircularProgress size={48} />
        <Typography variant="body1" color="text.secondary">
          Loading assignment details...
        </Typography>
      </Box>
    );
  }

  // ============================================================================
  // Render: Error State
  // ============================================================================

  if (assignmentError) {
    return (
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Alert
          severity="error"
          icon={<ErrorIcon />}
          action={
            <Button color="inherit" size="small" onClick={handleCancel}>
              Go Back
            </Button>
          }
        >
          <AlertTitle>Error Loading Assignment</AlertTitle>
          {assignmentError.message || 'Unable to load assignment details. Please try again later.'}
        </Alert>
      </Box>
    );
  }

  // ============================================================================
  // Render: No Assignment Found
  // ============================================================================

  if (!assignment) {
    return (
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={handleCancel}>
              Go Back
            </Button>
          }
        >
          <AlertTitle>Assignment Not Found</AlertTitle>
          The assignment you are looking for could not be found. It may have been deleted or you may
          not have permission to access it.
        </Alert>
      </Box>
    );
  }

  // ============================================================================
  // Render: Submission Success State
  // ============================================================================

  if (submissionSuccess) {
    return (
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 72, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            {saveAsDraft ? 'Draft Saved!' : 'Submission Successful!'}
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            {saveAsDraft
              ? 'Your work has been saved as a draft. You can return to edit and submit it later.'
              : 'Your assignment has been submitted successfully. You can view your submission details on the assignment page.'}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AssignmentIcon />}
            onClick={() => navigate(`/assignments/${parsedAssignmentId}`)}
            sx={{ mt: 2 }}
          >
            View Assignment
          </Button>
        </Paper>
      </Box>
    );
  }

  // ============================================================================
  // Render: Submissions Closed State
  // ============================================================================

  if (!submissionStatus.canSubmit) {
    return (
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Alert
          severity="error"
          icon={<WarningIcon />}
          action={
            <Button color="inherit" size="small" onClick={handleCancel}>
              Go Back
            </Button>
          }
        >
          <AlertTitle>Submissions Unavailable</AlertTitle>
          {submissionStatus.reason}
        </Alert>
      </Box>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1000, mx: 'auto' }}>
      {/* Page Header */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Submit Assignment
        </Typography>
        <Typography variant="h6" color="text.secondary">
          {assignment.name}
        </Typography>
      </Paper>

      {/* Error Alert */}
      {submissionError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSubmissionError(null)}>
          <AlertTitle>Submission Error</AlertTitle>
          {submissionError}
        </Alert>
      )}

      {/* Late Submission Warning */}
      {submissionStatus.reason && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          {submissionStatus.reason}
        </Alert>
      )}

      {/* Stepper Navigation */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {SUBMISSION_STEPS.map((step) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Step Content */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        {/* Step 0: Review Assignment */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon color="primary" />
              Assignment Overview
            </Typography>
            <Divider sx={{ my: 2 }} />

            {/* Assignment Description */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Description
                </Typography>
                <Typography
                  variant="body2"
                  component="div"
                  dangerouslySetInnerHTML={{ __html: assignment.intro || 'No description provided.' }}
                />
              </CardContent>
            </Card>

            {/* Assignment Details */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Assignment Details
                </Typography>
                <List dense>
                  {/* Due Date */}
                  <ListItem>
                    <ListItemIcon>
                      <CalendarIcon color="action" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Due Date"
                      secondary={
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {formatDateTime(assignment.duedate)}
                          {timeRemaining && !timeRemaining.isPast && (
                            <Chip
                              size="small"
                              label={timeRemaining.formattedString}
                              color={
                                timeRemaining.totalSeconds < COUNTDOWN_DANGER_THRESHOLD
                                  ? 'error'
                                  : timeRemaining.totalSeconds < COUNTDOWN_WARNING_THRESHOLD
                                    ? 'warning'
                                    : 'default'
                              }
                            />
                          )}
                          {timeRemaining?.isPast && (
                            <Chip size="small" label={timeRemaining.formattedString} color="error" />
                          )}
                        </Box>
                      }
                    />
                  </ListItem>

                  {/* Cut-off Date (if set) */}
                  {assignment.cutoffdate > 0 && (
                    <ListItem>
                      <ListItemIcon>
                        <TimeIcon color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Cut-off Date"
                        secondary={`${formatDateTime(assignment.cutoffdate)} (No submissions accepted after this date)`}
                      />
                    </ListItem>
                  )}

                  {/* Grade */}
                  <ListItem>
                    <ListItemIcon>
                      <GradeIcon color="action" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Maximum Grade"
                      secondary={assignment.grade > 0 ? `${assignment.grade} points` : 'Not graded'}
                    />
                  </ListItem>

                  {/* Time Limit (if set) */}
                  {assignment.timelimit && assignment.timelimit > 0 && (
                    <ListItem>
                      <ListItemIcon>
                        <TimeIcon color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Time Limit"
                        secondary={`${Math.floor(assignment.timelimit / 60)} minutes`}
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>

            {/* Submission Requirements */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Submission Requirements
                </Typography>
                <List dense>
                  {isFileSubmissionEnabled && (
                    <>
                      <ListItem>
                        <ListItemIcon>
                          <UploadIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary="File Upload"
                          secondary={`Upload up to ${maxFilesAllowed} file(s)`}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <DescriptionIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Maximum File Size"
                          secondary={`${Math.round(maxFileSizeBytes / (1024 * 1024))} MB per file`}
                        />
                      </ListItem>
                      {acceptedFileTypes.length > 0 && acceptedFileTypes[0] !== '*' && (
                        <ListItem>
                          <ListItemIcon>
                            <DescriptionIcon color="action" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Accepted File Types"
                            secondary={acceptedFileTypes.join(', ')}
                          />
                        </ListItem>
                      )}
                    </>
                  )}
                  {isOnlineTextEnabled && (
                    <ListItem>
                      <ListItemIcon>
                        <DescriptionIcon color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Online Text"
                        secondary="Text entry is enabled for this assignment"
                      />
                    </ListItem>
                  )}
                  {requiresSubmissionStatement && (
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Submission Statement"
                        secondary="You must accept the submission statement before submitting"
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>

            {/* Previous Submissions (if any) */}
            {assignment.submission && (
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                    onClick={handleTogglePreviousSubmissions}
                  >
                    <Typography variant="subtitle1" fontWeight="bold">
                      Previous Submission
                    </Typography>
                    <IconButton size="small">
                      {showPreviousSubmissions ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Collapse in={showPreviousSubmissions}>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <HistoryIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Status"
                          secondary={
                            <Chip
                              size="small"
                              {...getSubmissionStatusConfig(assignment.submission.status)}
                            />
                          }
                        />
                      </ListItem>
                      {assignment.submission.timemodified > 0 && (
                        <ListItem>
                          <ListItemIcon>
                            <CalendarIcon color="action" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Last Modified"
                            secondary={formatDateTime(assignment.submission.timemodified)}
                          />
                        </ListItem>
                      )}
                      {assignment.submission.attemptnumber !== undefined && (
                        <ListItem>
                          <ListItemIcon>
                            <HistoryIcon color="action" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Attempt Number"
                            secondary={`Attempt ${assignment.submission.attemptnumber + 1}`}
                          />
                        </ListItem>
                      )}
                    </List>
                  </Collapse>
                </CardContent>
              </Card>
            )}

            {/* Step Actions */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
              <Button variant="outlined" startIcon={<CancelIcon />} onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="contained" onClick={handleNextStep}>
                Continue
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 1: Add Submission */}
        {activeStep === 1 && (
          <Box component="form" noValidate>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon color="primary" />
              Add Your Submission
            </Typography>
            <Divider sx={{ my: 2 }} />

            {/* Online Text Submission */}
            {isOnlineTextEnabled && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Online Text
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Enter your submission text below. You can use formatting to enhance your content.
                </Typography>
                <RichTextEditor
                  name="onlineText"
                  control={control}
                  label="Submission Text"
                  toolbar="full"
                  error={!!errors.onlineText}
                />
                {errors.onlineText && (
                  <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                    {errors.onlineText.message}
                  </Typography>
                )}
              </Box>
            )}

            {/* File Submission */}
            {isFileSubmissionEnabled && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  File Upload
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Upload your submission files. You can drag and drop files or click to browse.
                </Typography>
                <FileUploadZone
                  maxFileSize={maxFileSizeBytes}
                  acceptedFileTypes={acceptedFileTypes}
                  maxFiles={maxFilesAllowed}
                  onFilesChange={handleFilesChange}
                  disabled={submitAssignmentMutation.isPending}
                  existingFiles={[]}
                />
                {selectedFiles.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {selectedFiles.length} file(s) selected
                  </Typography>
                )}
              </Box>
            )}

            {/* Validation Messages */}
            {!isOnlineTextEnabled && !isFileSubmissionEnabled && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                No submission types are enabled for this assignment. Please contact your instructor.
              </Alert>
            )}

            {(isOnlineTextEnabled || isFileSubmissionEnabled) &&
              !watchedOnlineText?.trim() &&
              selectedFiles.length === 0 && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  Please add your submission content above. You need to provide{' '}
                  {isOnlineTextEnabled && isFileSubmissionEnabled
                    ? 'either text or file uploads'
                    : isOnlineTextEnabled
                      ? 'text content'
                      : 'file uploads'}{' '}
                  to proceed.
                </Alert>
              )}

            {/* Step Actions */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 3 }}>
              <Button variant="outlined" onClick={handlePreviousStep}>
                Back
              </Button>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="outlined" startIcon={<CancelIcon />} onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleNextStep}
                  disabled={
                    !watchedOnlineText?.trim() && selectedFiles.length === 0 && (isOnlineTextEnabled || isFileSubmissionEnabled)
                  }
                >
                  Continue to Review
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {/* Step 2: Confirm & Submit */}
        {activeStep === 2 && (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon color="primary" />
              Review & Submit
            </Typography>
            <Divider sx={{ my: 2 }} />

            {/* Submission Summary */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Submission Summary
                </Typography>
                <List dense>
                  {isOnlineTextEnabled && (
                    <ListItem>
                      <ListItemIcon>
                        <DescriptionIcon color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Online Text"
                        secondary={
                          watchedOnlineText?.trim()
                            ? `${watchedOnlineText.replace(/<[^>]*>/g, '').length} characters`
                            : 'Not provided'
                        }
                      />
                    </ListItem>
                  )}
                  {isFileSubmissionEnabled && (
                    <ListItem>
                      <ListItemIcon>
                        <UploadIcon color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Files"
                        secondary={
                          selectedFiles.length > 0
                            ? selectedFiles.map((f) => f.name).join(', ')
                            : 'No files selected'
                        }
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>

            {/* Submission Statement */}
            {requiresSubmissionStatement && (
              <Card
                variant="outlined"
                sx={{
                  mb: 3,
                  borderColor: watchedAcceptStatement ? 'success.main' : 'warning.main',
                }}
              >
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Submission Statement
                  </Typography>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      This submission is my own work, except where I have acknowledged the use of
                      the works of other people.
                    </Typography>
                  </Alert>
                  <Controller
                    name="acceptSubmissionStatement"
                    control={control}
                    rules={{ required: 'You must accept the submission statement' }}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Checkbox
                            {...field}
                            checked={field.value}
                            color="primary"
                          />
                        }
                        label={
                          <Typography variant="body2">
                            I confirm that I have read and accept the submission statement above.
                          </Typography>
                        }
                      />
                    )}
                  />
                  {errors.acceptSubmissionStatement && (
                    <Typography variant="caption" color="error" display="block" sx={{ mt: 1 }}>
                      {errors.acceptSubmissionStatement.message}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Submission Actions */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Submit Your Work
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {draftsEnabled
                    ? 'You can save your work as a draft to continue later, or submit it for grading now.'
                    : 'Once submitted, your assignment will be available for grading.'}
                </Typography>

                {!canSubmit && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    {!submissionStatus.canSubmit
                      ? submissionStatus.reason
                      : requiresSubmissionStatement && !watchedAcceptStatement
                        ? 'Please accept the submission statement to submit.'
                        : 'Please add content to your submission.'}
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Step Actions */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                gap: 2,
                mt: 3,
              }}
            >
              <Button variant="outlined" onClick={handlePreviousStep}>
                Back
              </Button>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 2,
                }}
              >
                <Button variant="outlined" startIcon={<CancelIcon />} onClick={handleCancel}>
                  Cancel
                </Button>
                {draftsEnabled && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<SaveIcon />}
                    onClick={handleOpenDraftDialog}
                    disabled={submitAssignmentMutation.isPending}
                  >
                    Save Draft
                  </Button>
                )}
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SubmitIcon />}
                  onClick={handleOpenConfirmDialog}
                  disabled={!canSubmit || submitAssignmentMutation.isPending}
                >
                  Submit for Grading
                </Button>
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={handleCloseConfirmDialog}
        aria-labelledby="confirm-submission-dialog-title"
        aria-describedby="confirm-submission-dialog-description"
      >
        <DialogTitle id="confirm-submission-dialog-title">
          {saveAsDraft ? 'Save as Draft?' : 'Confirm Submission'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-submission-dialog-description">
            {saveAsDraft
              ? 'Your work will be saved as a draft. You can return to edit and submit it later.'
              : `Are you sure you want to submit this assignment? ${
                  draftsEnabled
                    ? 'Once submitted, you may not be able to make changes.'
                    : 'This action cannot be undone.'
                }`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirmDialog} disabled={submitAssignmentMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSubmit}
            color="primary"
            variant="contained"
            disabled={submitAssignmentMutation.isPending}
            autoFocus
          >
            {submitAssignmentMutation.isPending ? (
              <CircularProgress size={24} color="inherit" />
            ) : saveAsDraft ? (
              'Save Draft'
            ) : (
              'Submit'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loading Overlay */}
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={submitAssignmentMutation.isPending}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress color="inherit" />
          <Typography variant="body1" sx={{ mt: 2 }}>
            {saveAsDraft ? 'Saving draft...' : 'Submitting assignment...'}
          </Typography>
        </Box>
      </Backdrop>

      {/* Success Snackbar */}
      <Snackbar
        open={showSuccessSnackbar}
        autoHideDuration={3000}
        onClose={handleCloseSuccessSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSuccessSnackbar} severity="success" sx={{ width: '100%' }}>
          {saveAsDraft ? 'Draft saved successfully!' : 'Assignment submitted successfully!'}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ============================================================================
// Export
// ============================================================================

export default SubmissionPage;
