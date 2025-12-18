/**
 * GradingInterface Component
 *
 * Comprehensive grading interface component for teachers to grade student submissions
 * with grade input, feedback text, feedback files, and grading status management.
 *
 * Features:
 * - Display submitted work (files and text)
 * - Grade input field with validation against assignment maximum grade
 * - Rich text editor for feedback comments
 * - Feedback file uploads
 * - Marking workflow state management
 * - Navigation between submissions
 * - Quick grading mode for fast turnaround
 * - Grade calculation for different grading types (point, scale, none)
 *
 * References:
 * - public/mod/assign/gradingtable.php (quick grading interface)
 * - public/mod/assign/locallib.php (grading methods)
 * - public/mod/assign/quickgradingform.php (quick grading form)
 * - public/mod/assign/grading/form.php (grading form)
 *
 * @package    react-frontend
 * @module     features/activities/assignments/components/GradingInterface
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import type React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Divider,
  Chip,
  IconButton,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Tooltip,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  FormHelperText,
} from '@mui/material';
import {
  Grade as GradeIcon,
  Save,
  NavigateBefore,
  NavigateNext,
  Download,
  Visibility,
  ExpandMore,
  ExpandLess,
  InsertDriveFile,
  PictureAsPdf,
  Image as ImageIcon,
  Description,
  Warning,
  CheckCircle,
  AccessTime,
} from '@mui/icons-material';
import { format } from 'date-fns';

// Internal imports from depends_on_files
import FileUploadZone from './FileUploadZone';
import RichTextEditor from '@/components/editor/RichTextEditor';
import type { Assignment, Submission, Grade, AssignmentFile } from '../types/assignment.types';
import { useGradeSubmission, useSaveFeedback } from '../hooks/useSubmission';

// ============================================================================
// Constants
// ============================================================================

/**
 * Marking workflow states based on Moodle's ASSIGN_MARKING_WORKFLOW_STATE constants
 * from locallib.php
 */
const WORKFLOW_STATES = [
  { value: 'notmarked', label: 'Not marked' },
  { value: 'inmarking', label: 'In marking' },
  { value: 'readyforreview', label: 'Ready for review' },
  { value: 'inreview', label: 'In review' },
  { value: 'readyforrelease', label: 'Ready for release' },
  { value: 'released', label: 'Released' },
] as const;

/**
 * Default accepted file types for feedback files
 */
const DEFAULT_FEEDBACK_FILE_TYPES = [
  '.pdf',
  '.doc',
  '.docx',
  'image/*',
  '.txt',
  '.zip',
];

/**
 * Maximum number of feedback files allowed
 */
const MAX_FEEDBACK_FILES = 5;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for the GradingInterface component
 */
export interface GradingInterfaceProps {
  /** Assignment configuration and settings */
  assignment: Assignment;
  /** Student submission to grade */
  submission: Submission;
  /** Callback function after successful grading operation */
  onGradeSuccess?: (grade: Grade) => void;
  /** Navigate to previous submission in list */
  onNavigatePrevious?: () => void;
  /** Navigate to next submission in list */
  onNavigateNext?: () => void;
  /** Enable quick grading mode with minimal UI */
  quickGrading?: boolean;
  /** Current submission index (1-based) for navigation display */
  currentIndex?: number;
  /** Total number of submissions for navigation display */
  totalSubmissions?: number;
  /** Existing grade data if previously graded */
  existingGrade?: Grade;
  /** Existing feedback text */
  existingFeedbackText?: string;
  /** Existing feedback files */
  existingFeedbackFiles?: AssignmentFile[];
  /** Whether navigation to previous is disabled */
  disablePrevious?: boolean;
  /** Whether navigation to next is disabled */
  disableNext?: boolean;
}

/**
 * Form data interface for the grading form
 */
export interface GradingFormData {
  /** Grade value (number for points, string for scale) */
  grade: number | string;
  /** Teacher feedback comments in HTML format */
  feedbackText: string;
  /** Feedback file attachments */
  feedbackFiles: File[];
  /** Marking workflow state if enabled */
  workflowState?: string;
  /** Whether to notify student of grade */
  notifyStudent?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format file size in human-readable format
 *
 * @param bytes - File size in bytes
 * @returns Formatted size string (e.g., "1.5 MB")
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) {return '0 Bytes';}
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get the appropriate icon for a file based on its MIME type
 *
 * @param mimetype - The file MIME type
 * @returns React icon component
 */
function getFileIcon(mimetype: string): React.ReactElement {
  if (mimetype.startsWith('image/')) {
    return <ImageIcon color="primary" />;
  }
  if (mimetype === 'application/pdf') {
    return <PictureAsPdf color="error" />;
  }
  if (
    mimetype.includes('word') ||
    mimetype.includes('document') ||
    mimetype === 'application/msword'
  ) {
    return <Description color="info" />;
  }
  return <InsertDriveFile color="action" />;
}

/**
 * Parse HTML content safely for display
 * Sanitizes content to prevent XSS attacks
 *
 * @param html - HTML content string
 * @returns Sanitized HTML string
 */
function sanitizeHtml(html: string): string {
  // Create a temporary div element
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Remove script tags and event handlers
  const scripts = tempDiv.querySelectorAll('script');
  scripts.forEach((script) => script.remove());

  // Remove onclick, onerror, etc. attributes
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return tempDiv.innerHTML;
}

/**
 * Count words in text content
 *
 * @param text - Text content (HTML or plain)
 * @returns Word count
 */
function countWords(text: string): number {
  // Strip HTML tags
  const plainText = text.replace(/<[^>]*>/g, ' ');
  // Split by whitespace and filter empty strings
  const words = plainText.split(/\s+/).filter((word) => word.length > 0);
  return words.length;
}

/**
 * Check if submission is late
 *
 * @param submission - The submission to check
 * @param assignment - The assignment with due date
 * @returns Boolean indicating if submission is late
 */
function isSubmissionLate(submission: Submission, assignment: Assignment): boolean {
  if (assignment.duedate === 0) {return false;}
  return submission.timemodified > assignment.duedate;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * GradingInterface - Comprehensive grading interface for teachers
 *
 * Provides a full-featured grading experience with submission viewing,
 * grade input with validation, rich text feedback, file attachments,
 * and marking workflow management.
 */
function GradingInterface({
  assignment,
  submission,
  onGradeSuccess,
  onNavigatePrevious,
  onNavigateNext,
  quickGrading = false,
  currentIndex = 1,
  totalSubmissions = 1,
  existingGrade,
  existingFeedbackText = '',
  existingFeedbackFiles = [],
  disablePrevious = false,
  disableNext = false,
}: GradingInterfaceProps): React.ReactElement {
  // ============================================================================
  // State Management
  // ============================================================================

  const [showGradingHistory, setShowGradingHistory] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // ============================================================================
  // Form Setup with react-hook-form
  // ============================================================================

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<GradingFormData>({
    mode: 'onChange',
    defaultValues: {
      grade: existingGrade?.grade ?? '',
      feedbackText: existingFeedbackText,
      feedbackFiles: [],
      workflowState: submission.gradingstatus === 'graded' ? 'released' : 'notmarked',
      notifyStudent: true,
    },
  });

  // Watch form values for display calculations
  const watchedGrade = watch('grade');
  const watchedFeedbackText = watch('feedbackText');

  // ============================================================================
  // Mutation Hooks
  // ============================================================================

  const gradeMutation = useGradeSubmission({
    onSuccess: (data) => {
      setSuccessMessage('Grade saved successfully!');
      setErrorMessage('');
      if (data.grade && onGradeSuccess) {
        onGradeSuccess(data.grade);
      }
    },
    onError: (error) => {
      setErrorMessage(error.message || 'Failed to save grade. Please try again.');
      setSuccessMessage('');
    },
  });

  const feedbackMutation = useSaveFeedback({
    onSuccess: () => {
      // Feedback saved as part of grading flow
    },
    onError: (error) => {
      setErrorMessage(error.message || 'Failed to save feedback. Please try again.');
    },
  });

  const isLoading = gradeMutation.isPending || feedbackMutation.isPending;

  // ============================================================================
  // Computed Values
  // ============================================================================

  /**
   * Calculate maximum grade based on assignment configuration
   * Negative grade values indicate scale usage in Moodle
   */
  const maxGrade = useMemo(() => {
    if (assignment.grade < 0) {
      // Scale grades - return 0 to indicate scale
      return 0;
    }
    return assignment.grade;
  }, [assignment.grade]);

  /**
   * Check if assignment uses scale grading
   */
  const usesScale = useMemo(() => {
    return assignment.grade < 0;
  }, [assignment.grade]);

  /**
   * Check if marking workflow is enabled
   */
  const markingWorkflowEnabled = useMemo(() => {
    return assignment.markingworkflow === 1;
  }, [assignment.markingworkflow]);

  /**
   * Calculate grade as percentage
   */
  const gradePercentage = useMemo(() => {
    if (usesScale || maxGrade === 0) {return null;}
    const gradeNum = typeof watchedGrade === 'number' ? watchedGrade : parseFloat(String(watchedGrade));
    if (isNaN(gradeNum)) {return null;}
    return ((gradeNum / maxGrade) * 100).toFixed(1);
  }, [watchedGrade, maxGrade, usesScale]);

  /**
   * Check if submission was late
   */
  const isLate = useMemo(() => {
    return isSubmissionLate(submission, assignment);
  }, [submission, assignment]);

  /**
   * Get submission files from plugins
   */
  const submissionFiles = useMemo(() => {
    const files: AssignmentFile[] = [];
    if (submission.plugins) {
      submission.plugins.forEach((plugin) => {
        if (plugin.fileareas) {
          plugin.fileareas.forEach((area) => {
            if (area.files) {
              files.push(...area.files);
            }
          });
        }
      });
    }
    return files;
  }, [submission.plugins]);

  /**
   * Get online text submission content
   */
  const onlineTextContent = useMemo(() => {
    if (submission.plugins) {
      const onlineTextPlugin = submission.plugins.find((p) => p.type === 'onlinetext');
      if (onlineTextPlugin?.editorfields?.[0]) {
        return onlineTextPlugin.editorfields[0].text;
      }
    }
    return null;
  }, [submission.plugins]);

  /**
   * Count words in online text submission
   */
  const onlineTextWordCount = useMemo(() => {
    if (!onlineTextContent) {return 0;}
    return countWords(onlineTextContent);
  }, [onlineTextContent]);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Reset form when submission changes
   */
  useEffect(() => {
    reset({
      grade: existingGrade?.grade ?? '',
      feedbackText: existingFeedbackText,
      feedbackFiles: [],
      workflowState: submission.gradingstatus === 'graded' ? 'released' : 'notmarked',
      notifyStudent: true,
    });
    setSuccessMessage('');
    setErrorMessage('');
  }, [submission.id, submission.gradingstatus, existingGrade, existingFeedbackText, reset]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle feedback files change from FileUploadZone
   */
  const handleFeedbackFilesChange = useCallback(
    (files: File[]) => {
      setValue('feedbackFiles', files, { shouldDirty: true });
    },
    [setValue]
  );

  /**
   * Handle form submission - save grade and feedback
   */
  const onSubmit = useCallback(
    async (data: GradingFormData, action: 'save' | 'saveAndNext' | 'saveDraft' = 'save') => {
      setSuccessMessage('');
      setErrorMessage('');

      // Validate grade value
      const gradeValue = typeof data.grade === 'string' ? parseFloat(data.grade) : data.grade;

      if (!usesScale) {
        if (isNaN(gradeValue) || gradeValue < 0) {
          setErrorMessage('Please enter a valid grade.');
          return;
        }
        if (gradeValue > maxGrade) {
          setErrorMessage(`Grade cannot exceed ${maxGrade}.`);
          return;
        }
      }

      // Determine workflow state based on action
      let {workflowState} = data;
      if (action === 'saveDraft' && markingWorkflowEnabled) {
        workflowState = 'inmarking';
      } else if (action !== 'saveDraft' && !markingWorkflowEnabled) {
        workflowState = 'released';
      }

      try {
        // Save grade
        await gradeMutation.mutateAsync({
          assignmentId: assignment.id,
          userId: submission.userid,
          grade: gradeValue,
          attemptnumber: submission.attemptnumber,
          sendNotifications: data.notifyStudent && action !== 'saveDraft',
          workflowstate: workflowState,
        });

        // Save feedback if provided
        if (data.feedbackText || data.feedbackFiles.length > 0) {
          await feedbackMutation.mutateAsync({
            assignmentId: assignment.id,
            userId: submission.userid,
            feedbackText: data.feedbackText,
            feedbackFormat: 1, // HTML format
            feedbackFiles: data.feedbackFiles,
            draft: action === 'saveDraft',
            attemptnumber: submission.attemptnumber,
          });
        }

        // Navigate to next if requested
        if (action === 'saveAndNext' && onNavigateNext && !disableNext) {
          onNavigateNext();
        }
      } catch {
        // Errors handled by mutation callbacks
      }
    },
    [
      assignment.id,
      submission.userid,
      submission.attemptnumber,
      usesScale,
      maxGrade,
      markingWorkflowEnabled,
      gradeMutation,
      feedbackMutation,
      onNavigateNext,
      disableNext,
    ]
  );

  /**
   * Handle save and release grade action
   */
  const handleSaveAndRelease = useCallback(() => {
    void handleSubmit((data) => onSubmit(data, 'save'))();
  }, [handleSubmit, onSubmit]);

  /**
   * Handle save as draft action
   */
  const handleSaveDraft = useCallback(() => {
    void handleSubmit((data) => onSubmit(data, 'saveDraft'))();
  }, [handleSubmit, onSubmit]);

  /**
   * Handle save and navigate to next submission
   */
  const handleSaveAndNext = useCallback(() => {
    void handleSubmit((data) => onSubmit(data, 'saveAndNext'))();
  }, [handleSubmit, onSubmit]);

  /**
   * Handle file download click
   */
  const handleDownloadFile = useCallback((file: AssignmentFile) => {
    window.open(file.fileurl, '_blank');
  }, []);

  /**
   * Toggle grading history visibility
   */
  const handleToggleHistory = useCallback(() => {
    setShowGradingHistory((prev) => !prev);
  }, []);

  // ============================================================================
  // Quick Grading Mode Render
  // ============================================================================

  if (quickGrading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Controller
          name="grade"
          control={control}
          rules={{
            required: 'Grade is required',
            validate: (value) => {
              if (usesScale) {return true;}
              const num = typeof value === 'number' ? value : parseFloat(String(value));
              if (isNaN(num)) {return 'Enter a valid number';}
              if (num < 0) {return 'Grade cannot be negative';}
              if (num > maxGrade) {return `Grade cannot exceed ${maxGrade}`;}
              return true;
            },
          }}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              type="number"
              size="small"
              label={`Grade (0-${maxGrade})`}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              disabled={isLoading}
              inputProps={{
                min: 0,
                max: maxGrade,
                step: 0.01,
                'aria-label': `Grade for ${submission.studentname ?? 'student'}`,
              }}
              sx={{ width: 120 }}
            />
          )}
        />
        <Button
          variant="contained"
          size="small"
          onClick={handleSaveAndRelease}
          disabled={isLoading || !isValid}
          startIcon={isLoading ? <CircularProgress size={16} /> : <Save />}
        >
          Save
        </Button>
        {successMessage && (
          <Chip
            icon={<CheckCircle />}
            label="Saved"
            color="success"
            size="small"
          />
        )}
      </Box>
    );
  }

  // ============================================================================
  // Full Grading Interface Render
  // ============================================================================

  return (
    <Box sx={{ width: '100%' }}>
      {/* Navigation Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Tooltip title="Previous Submission">
            <span>
              <IconButton
                onClick={onNavigatePrevious}
                disabled={disablePrevious || isLoading}
                aria-label="Navigate to previous submission"
              >
                <NavigateBefore />
              </IconButton>
            </span>
          </Tooltip>

          <Typography variant="subtitle1">
            Submission {currentIndex} of {totalSubmissions}
          </Typography>

          <Tooltip title="Next Submission">
            <span>
              <IconButton
                onClick={onNavigateNext}
                disabled={disableNext || isLoading}
                aria-label="Navigate to next submission"
              >
                <NavigateNext />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Paper>

      {/* Alert Messages */}
      {successMessage && (
        <Alert
          severity="success"
          onClose={() => setSuccessMessage('')}
          sx={{ mb: 2 }}
        >
          {successMessage}
        </Alert>
      )}
      {errorMessage && (
        <Alert
          severity="error"
          onClose={() => setErrorMessage('')}
          sx={{ mb: 2 }}
        >
          {errorMessage}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left Column - Submission Details */}
        <Grid item xs={12} md={6}>
          {/* Student Submission Section */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              <GradeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Student Submission
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {/* Submission Metadata */}
            <Box sx={{ mb: 2 }}>
              {/* Student name (respect blind marking) */}
              {assignment.blindmarking !== 1 && submission.studentname && (
                <Typography variant="body1" gutterBottom>
                  <strong>Student:</strong> {submission.studentname}
                </Typography>
              )}
              {assignment.blindmarking === 1 && (
                <Typography variant="body1" gutterBottom>
                  <strong>Participant:</strong> #{submission.userid}
                </Typography>
              )}

              {/* Submission date */}
              <Typography variant="body2" color="text.secondary">
                <AccessTime sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                Submitted: {format(new Date(submission.timemodified * 1000), 'PPpp')}
              </Typography>

              {/* Attempt number */}
              {assignment.maxattempts !== 1 && (
                <Typography variant="body2" color="text.secondary">
                  Attempt: {submission.attemptnumber + 1}
                  {assignment.maxattempts === -1 ? ' (Unlimited)' : ` of ${assignment.maxattempts}`}
                </Typography>
              )}

              {/* Status chips */}
              <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                  size="small"
                  color={submission.status === 'submitted' ? 'success' : 'default'}
                />
                {isLate && (
                  <Chip
                    icon={<Warning />}
                    label="Late Submission"
                    size="small"
                    color="warning"
                  />
                )}
                {submission.gradingstatus === 'graded' && (
                  <Chip
                    icon={<CheckCircle />}
                    label="Graded"
                    size="small"
                    color="success"
                  />
                )}
              </Box>
            </Box>

            {/* Submitted Files */}
            {submissionFiles.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Submitted Files
                </Typography>
                <List dense>
                  {submissionFiles.map((file) => (
                    <ListItem key={file.fileurl}>
                      <ListItemIcon>{getFileIcon(file.mimetype)}</ListItemIcon>
                      <ListItemText
                        primary={file.filename}
                        secondary={formatFileSize(file.filesize)}
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Download File">
                          <IconButton
                            edge="end"
                            onClick={() => handleDownloadFile(file)}
                            aria-label={`Download ${file.filename}`}
                          >
                            <Download />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View File">
                          <IconButton
                            edge="end"
                            onClick={() => window.open(file.fileurl, '_blank')}
                            aria-label={`View ${file.filename}`}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Online Text Submission */}
            {onlineTextContent && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Online Text Submission
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Word count: {onlineTextWordCount}
                </Typography>
                <Card variant="outlined">
                  <CardContent>
                    <Box
                      sx={{
                        maxHeight: 300,
                        overflowY: 'auto',
                        '& img': { maxWidth: '100%', height: 'auto' },
                      }}
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(onlineTextContent),
                      }}
                    />
                  </CardContent>
                </Card>
              </Box>
            )}

            {/* No submission warning */}
            {submissionFiles.length === 0 && !onlineTextContent && (
              <Alert severity="info">
                No files or text content submitted.
              </Alert>
            )}
          </Paper>

          {/* Previous Grading History */}
          {existingGrade && (
            <Paper sx={{ p: 2 }}>
              <Box
                onClick={handleToggleHistory}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <Typography variant="subtitle2">
                  Previous Grades and Feedback
                </Typography>
                <IconButton size="small">
                  {showGradingHistory ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>
              <Collapse in={showGradingHistory}>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    <strong>Previous Grade:</strong>{' '}
                    {existingGrade.grade}
                    {!usesScale && maxGrade > 0 && ` / ${maxGrade}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Graded on: {format(new Date(existingGrade.timemodified * 1000), 'PPpp')}
                  </Typography>
                  {existingFeedbackText && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        <strong>Previous Feedback:</strong>
                      </Typography>
                      <Box
                        sx={{
                          p: 1,
                          bgcolor: 'grey.100',
                          borderRadius: 1,
                          mt: 0.5,
                        }}
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(existingFeedbackText),
                        }}
                      />
                    </Box>
                  )}
                  {existingFeedbackFiles.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        <strong>Previous Feedback Files:</strong>
                      </Typography>
                      <List dense>
                        {existingFeedbackFiles.map((file) => (
                          <ListItem key={file.fileurl} disablePadding>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              {getFileIcon(file.mimetype)}
                            </ListItemIcon>
                            <ListItemText
                              primary={file.filename}
                              secondary={formatFileSize(file.filesize)}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Paper>
          )}
        </Grid>

        {/* Right Column - Grading Form */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <GradeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Grade and Feedback
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Box component="form" onSubmit={handleSubmit((data) => onSubmit(data, 'save'))}>
              {/* Grade Input */}
              <Box sx={{ mb: 3 }}>
                {usesScale ? (
                  // Scale grading
                  <FormControl fullWidth error={!!errors.grade}>
                    <InputLabel id="grade-scale-label">Grade</InputLabel>
                    <Controller
                      name="grade"
                      control={control}
                      rules={{ required: 'Grade is required' }}
                      render={({ field }) => (
                        <Select
                          {...field}
                          labelId="grade-scale-label"
                          label="Grade"
                          disabled={isLoading}
                        >
                          <MenuItem value="">
                            <em>Select grade...</em>
                          </MenuItem>
                          {/* Scale options would be dynamically loaded */}
                          <MenuItem value="1">Unsatisfactory</MenuItem>
                          <MenuItem value="2">Satisfactory</MenuItem>
                          <MenuItem value="3">Good</MenuItem>
                          <MenuItem value="4">Excellent</MenuItem>
                        </Select>
                      )}
                    />
                    {errors.grade && (
                      <FormHelperText>{errors.grade.message}</FormHelperText>
                    )}
                  </FormControl>
                ) : (
                  // Point grading
                  <Controller
                    name="grade"
                    control={control}
                    rules={{
                      required: 'Grade is required',
                      validate: (value) => {
                        const num = typeof value === 'number' ? value : parseFloat(String(value));
                        if (isNaN(num)) {return 'Enter a valid number';}
                        if (num < 0) {return 'Grade cannot be negative';}
                        if (num > maxGrade) {return `Grade cannot exceed ${maxGrade}`;}
                        return true;
                      },
                    }}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        type="number"
                        fullWidth
                        label={`Grade (out of ${maxGrade})`}
                        error={!!fieldState.error}
                        helperText={
                          fieldState.error?.message ??
                          (gradePercentage ? `${gradePercentage}%` : 'Enter a grade')
                        }
                        disabled={isLoading}
                        inputProps={{
                          min: 0,
                          max: maxGrade,
                          step: 0.01,
                          'aria-describedby': 'grade-helper-text',
                        }}
                        InputProps={{
                          endAdornment: maxGrade > 0 && (
                            <Typography variant="body2" color="text.secondary">
                              / {maxGrade}
                            </Typography>
                          ),
                        }}
                      />
                    )}
                  />
                )}

                {/* Previous grade indicator */}
                {existingGrade && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Previous grade: {existingGrade.grade}
                    {!usesScale && maxGrade > 0 && ` / ${maxGrade}`}
                  </Typography>
                )}
              </Box>

              {/* Feedback Text Editor */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Feedback Comments
                </Typography>
                <Controller
                  name="feedbackText"
                  control={control}
                  render={({ field }) => (
                    <RichTextEditor
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Provide feedback to the student..."
                      height={200}
                      disabled={isLoading}
                    />
                  )}
                />
                {watchedFeedbackText && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Word count: {countWords(watchedFeedbackText)}
                  </Typography>
                )}
              </Box>

              {/* Feedback Files */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Feedback Files (Optional)
                </Typography>
                <FileUploadZone
                  onFilesChange={handleFeedbackFilesChange}
                  maxFiles={MAX_FEEDBACK_FILES}
                  acceptedFileTypes={DEFAULT_FEEDBACK_FILE_TYPES}
                  maxFileSize={10485760} // 10MB
                  disabled={isLoading}
                  existingFiles={existingFeedbackFiles.map((f) => ({
                    name: f.filename,
                    size: f.filesize,
                    type: f.mimetype,
                  }))}
                />
              </Box>

              {/* Marking Workflow State */}
              {markingWorkflowEnabled && (
                <Box sx={{ mb: 3 }}>
                  <FormControl fullWidth>
                    <InputLabel id="workflow-state-label">Marking Workflow State</InputLabel>
                    <Controller
                      name="workflowState"
                      control={control}
                      render={({ field }) => (
                        <Select
                          {...field}
                          labelId="workflow-state-label"
                          label="Marking Workflow State"
                          disabled={isLoading}
                        >
                          {WORKFLOW_STATES.map((state) => (
                            <MenuItem key={state.value} value={state.value}>
                              {state.label}
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    />
                    <FormHelperText>
                      Select the current marking workflow state for this submission.
                    </FormHelperText>
                  </FormControl>
                </Box>
              )}

              {/* Action Buttons */}
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {markingWorkflowEnabled && (
                  <Button
                    variant="outlined"
                    onClick={handleSaveDraft}
                    disabled={isLoading}
                    startIcon={isLoading ? <CircularProgress size={18} /> : <Save />}
                  >
                    Save Draft
                  </Button>
                )}
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveAndRelease}
                  disabled={isLoading || !isDirty}
                  startIcon={isLoading ? <CircularProgress size={18} /> : <CheckCircle />}
                >
                  Save and Release Grade
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleSaveAndNext}
                  disabled={isLoading || disableNext || !isDirty}
                  startIcon={isLoading ? <CircularProgress size={18} /> : <NavigateNext />}
                >
                  Save and Next
                </Button>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default GradingInterface;
export { GradingInterface };
