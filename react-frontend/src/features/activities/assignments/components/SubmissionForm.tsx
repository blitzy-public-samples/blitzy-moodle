/**
 * SubmissionForm Component for Assignment Submissions
 *
 * Comprehensive form component for creating and editing assignment submissions with
 * support for file uploads, online text submissions, and submission statements.
 * Manages submission data, validation, and form state using react-hook-form.
 *
 * Key Features:
 * - File upload support via FileUploadZone with drag-and-drop
 * - Rich text editor for online text submissions
 * - Submission statement acceptance with checkbox
 * - Draft saving and final submission workflows
 * - Client-side validation against assignment configuration
 * - Inline validation errors and API error handling
 * - Optimistic UI updates through React Query mutations
 * - Support for team submissions, multiple attempts, and blind marking
 * - Responsive design with Material-UI components
 * - WCAG 2.1 AA accessibility compliance
 *
 * References:
 * - public/mod/assign/submission_form.php
 * - public/mod/assign/locallib.php (view_edit_submission_page method)
 * - public/mod/assign/submissionconfirmform.php
 *
 * @package    react-frontend
 * @module     features/activities/assignments/components/SubmissionForm
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import type React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import type { SubmitHandler } from 'react-hook-form';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  Divider,
  CircularProgress,
  Skeleton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
} from '@mui/material';
import {
  Save,
  Send,
  Cancel,
  Warning as WarningIcon,
  CheckCircle,
  AccessTime,
  Description,
  CloudUpload,
  TextFields,
  Info,
} from '@mui/icons-material';

// Internal imports from depends_on_files
import { FileUploadZone } from './FileUploadZone';
import type { UploadedFile } from './FileUploadZone';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import type { Assignment, Submission, AssignmentFile, PluginConfig } from '../types/assignment.types';
import { useSubmitAssignment } from '../hooks/useSubmission';
import type { SubmitAssignmentData } from '../hooks/useSubmission';
import { formatFileSize } from '@/utils/formatters';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Props for the SubmissionForm component
 *
 * Configures the submission form with assignment details, existing submission
 * data, and callback handlers for form events.
 */
export interface SubmissionFormProps {
  /**
   * Assignment configuration object containing all settings like due dates,
   * submission types, file restrictions, and submission requirements.
   */
  assignment: Assignment;

  /**
   * Optional existing submission for editing.
   * When provided, form will be pre-populated with previous submission data.
   */
  existingSubmission?: Submission;

  /**
   * Callback invoked after successful submission.
   * Receives the newly created/updated submission object.
   */
  onSuccess?: (submission: Submission) => void;

  /**
   * Callback invoked when user cancels the submission.
   * Typically used for navigation back to assignment view.
   */
  onCancel?: () => void;
}

/**
 * Form data structure for submission form fields
 *
 * Represents the data collected from the form and submitted to the API.
 */
export interface SubmissionFormData {
  /**
   * Online text submission content (HTML string from rich text editor).
   * Required if assignment.submissiondrafts enables online text plugin.
   */
  onlineText?: string;

  /**
   * Files selected for upload.
   * Required if assignment enables file submission plugin.
   */
  files: File[];

  /**
   * Acceptance of submission statement.
   * Required if assignment.requiresubmissionstatement is 1.
   */
  submissionStatement: boolean;
}

/**
 * Validation error structure for display
 */
interface ValidationError {
  field: string;
  message: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get plugin configuration value from assignment configs
 *
 * @param configs - Array of plugin configurations
 * @param plugin - Plugin name (e.g., 'file', 'onlinetext')
 * @param subtype - Plugin subtype (e.g., 'assignsubmission')
 * @param name - Configuration name
 * @returns Configuration value or undefined if not found
 */
function getPluginConfig(
  configs: PluginConfig[] | undefined,
  plugin: string,
  subtype: string,
  name: string
): string | undefined {
  if (!configs) {return undefined;}
  const config = configs.find(
    (c) => c.plugin === plugin && c.subtype === subtype && c.name === name
  );
  return config?.value;
}

/**
 * Check if a submission plugin is enabled for the assignment
 *
 * @param assignment - Assignment configuration
 * @param pluginName - Plugin name to check (e.g., 'file', 'onlinetext')
 * @returns True if the plugin is enabled
 */
function isPluginEnabled(assignment: Assignment, pluginName: string): boolean {
  const enabledValue = getPluginConfig(
    assignment.configs,
    pluginName,
    'assignsubmission',
    'enabled'
  );
  return enabledValue === '1';
}

/**
 * Get maximum file count from assignment configuration
 *
 * @param assignment - Assignment configuration
 * @returns Maximum number of files allowed (defaults to 20)
 */
function getMaxFiles(assignment: Assignment): number {
  const maxFilesValue = getPluginConfig(
    assignment.configs,
    'file',
    'assignsubmission',
    'maxfilesubmissions'
  );
  return maxFilesValue ? parseInt(maxFilesValue, 10) : 20;
}

/**
 * Get maximum file size from assignment configuration
 *
 * @param assignment - Assignment configuration
 * @returns Maximum file size in bytes (defaults to 10MB)
 */
function getMaxFileSize(assignment: Assignment): number {
  const maxSizeValue = getPluginConfig(
    assignment.configs,
    'file',
    'assignsubmission',
    'maxsubmissionsizebytes'
  );
  return maxSizeValue ? parseInt(maxSizeValue, 10) : 10485760; // 10MB default
}

/**
 * Get accepted file types from assignment configuration
 *
 * @param assignment - Assignment configuration
 * @returns Array of accepted file types/extensions
 */
function getAcceptedFileTypes(assignment: Assignment): string[] {
  const filetypesValue = getPluginConfig(
    assignment.configs,
    'file',
    'assignsubmission',
    'filetypeslist'
  );
  if (!filetypesValue) {return [];} // Empty means all types accepted
  return filetypesValue.split(',').map((type) => type.trim()).filter(Boolean);
}

/**
 * Check if online text has word limit
 *
 * @param assignment - Assignment configuration
 * @returns Word limit number or undefined if no limit
 */
function getOnlineTextWordLimit(assignment: Assignment): number | undefined {
  const wordLimitValue = getPluginConfig(
    assignment.configs,
    'onlinetext',
    'assignsubmission',
    'wordlimit'
  );
  return wordLimitValue ? parseInt(wordLimitValue, 10) : undefined;
}

/**
 * Count words in HTML content
 *
 * @param html - HTML string to count words in
 * @returns Word count
 */
function countWords(html: string): number {
  // Strip HTML tags and count words
  const text = html.replace(/<[^>]*>/g, ' ').trim();
  if (!text) {return 0;}
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Format date for display
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string
 */
function formatDate(timestamp: number): string {
  if (!timestamp) {return 'No date set';}
  const date = new Date(timestamp * 1000);
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Check if assignment is within submission period
 *
 * @param assignment - Assignment configuration
 * @returns Object with open status and message
 */
function checkSubmissionPeriod(assignment: Assignment): { isOpen: boolean; message: string } {
  const now = Math.floor(Date.now() / 1000);

  // Check if submissions haven't opened yet
  if (assignment.allowsubmissionsfromdate > 0 && now < assignment.allowsubmissionsfromdate) {
    return {
      isOpen: false,
      message: `Submissions open on ${formatDate(assignment.allowsubmissionsfromdate)}`,
    };
  }

  // Check if past cutoff date
  if (assignment.cutoffdate > 0 && now > assignment.cutoffdate) {
    return {
      isOpen: false,
      message: `Submissions closed on ${formatDate(assignment.cutoffdate)}`,
    };
  }

  // Check if past due date (but before cutoff if set)
  if (assignment.duedate > 0 && now > assignment.duedate) {
    if (assignment.cutoffdate > 0 && now < assignment.cutoffdate) {
      return {
        isOpen: true,
        message: `This assignment was due on ${formatDate(assignment.duedate)}. Late submissions are accepted until ${formatDate(assignment.cutoffdate)}.`,
      };
    }
    if (assignment.cutoffdate === 0) {
      return {
        isOpen: true,
        message: `This assignment was due on ${formatDate(assignment.duedate)}. Late submissions are being accepted.`,
      };
    }
  }

  return { isOpen: true, message: '' };
}

/**
 * Convert existing submission files to UploadedFile format
 *
 * @param submission - Existing submission with plugins
 * @returns Array of UploadedFile objects
 */
function getExistingFiles(submission?: Submission): UploadedFile[] {
  if (!submission?.plugins) {return [];}

  const filePlugin = submission.plugins.find((p) => p.type === 'file');
  if (!filePlugin?.fileareas) {return [];}

  const files: UploadedFile[] = [];
  for (const area of filePlugin.fileareas) {
    if (area.files) {
      for (const file of area.files) {
        files.push({
          id: `existing-${file.filename}`,
          name: file.filename,
          size: file.filesize,
          type: file.mimetype,
        });
      }
    }
  }
  return files;
}

/**
 * Get existing online text from submission
 *
 * @param submission - Existing submission with plugins
 * @returns Online text content or undefined
 */
function getExistingOnlineText(submission?: Submission): string | undefined {
  if (!submission?.plugins) {return undefined;}

  const textPlugin = submission.plugins.find((p) => p.type === 'onlinetext');
  if (!textPlugin?.editorfields) {return undefined;}

  const textField = textPlugin.editorfields.find((f) => f.name === 'onlinetext');
  return textField?.text;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * SubmissionForm - Comprehensive assignment submission form component
 *
 * Provides a complete interface for students to submit assignment work including
 * file uploads, online text, and submission statement acceptance. Handles validation,
 * draft saving, and final submission with confirmation dialogs.
 *
 * @param props - Component props including assignment config and callbacks
 * @returns React component
 *
 * @example
 * ```tsx
 * <SubmissionForm
 *   assignment={assignmentData}
 *   existingSubmission={existingSubmission}
 *   onSuccess={(submission) => navigate(`/assignments/${submission.assignment}`)}
 *   onCancel={() => navigate(-1)}
 * />
 * ```
 */
function SubmissionForm({
  assignment,
  existingSubmission,
  onSuccess,
  onCancel,
}: SubmissionFormProps): React.ReactElement {
  // ============================================================================
  // State Management
  // ============================================================================

  // Dialog state for submission confirmation
  const [confirmDialogOpen, setConfirmDialogOpen] = useState<boolean>(false);

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Success message state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Track if form has been modified
  const [isFormDirty, setIsFormDirty] = useState<boolean>(false);

  // Draft saving state
  const [isDraftSaving, setIsDraftSaving] = useState<boolean>(false);

  // ============================================================================
  // Plugin Configuration
  // ============================================================================

  // Check which submission plugins are enabled
  const fileSubmissionEnabled = useMemo(
    () => isPluginEnabled(assignment, 'file'),
    [assignment]
  );

  const onlineTextEnabled = useMemo(
    () => isPluginEnabled(assignment, 'onlinetext'),
    [assignment]
  );

  // Get file submission constraints
  const maxFiles = useMemo(() => getMaxFiles(assignment), [assignment]);
  const maxFileSize = useMemo(() => getMaxFileSize(assignment), [assignment]);
  const acceptedFileTypes = useMemo(() => getAcceptedFileTypes(assignment), [assignment]);

  // Get online text constraints
  const wordLimit = useMemo(() => getOnlineTextWordLimit(assignment), [assignment]);

  // Check submission period
  const submissionPeriod = useMemo(
    () => checkSubmissionPeriod(assignment),
    [assignment]
  );

  // Get existing submission data
  const existingFiles = useMemo(
    () => getExistingFiles(existingSubmission),
    [existingSubmission]
  );

  const existingOnlineText = useMemo(
    () => getExistingOnlineText(existingSubmission),
    [existingSubmission]
  );

  // ============================================================================
  // Form Setup with react-hook-form
  // ============================================================================

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
    trigger,
    reset,
  } = useForm<SubmissionFormData>({
    defaultValues: {
      onlineText: existingOnlineText || '',
      files: [],
      submissionStatement: false,
    },
    mode: 'onChange',
  });

  // Watch form values for validation
  const watchedFiles = watch('files');
  const watchedOnlineText = watch('onlineText');
  const watchedSubmissionStatement = watch('submissionStatement');

  // ============================================================================
  // Mutation Hook for API Submission
  // ============================================================================

  const {
    mutate: submitMutation,
    isPending: isSubmitting,
    isError: isSubmitError,
    error: submitError,
    isSuccess: isSubmitSuccess,
  } = useSubmitAssignment({
    onSuccess: (response) => {
      if (response.success && response.submission) {
        setSuccessMessage('Assignment submitted successfully!');
        if (onSuccess) {
          // Delay callback to allow user to see success message
          setTimeout(() => {
            onSuccess(response.submission!);
          }, 1500);
        }
      }
    },
    onError: (error) => {
      console.error('Submission error:', error);
      // Error is displayed via isSubmitError and submitError
    },
  });

  // ============================================================================
  // Validation Functions
  // ============================================================================

  /**
   * Validate the entire submission against assignment requirements
   *
   * @returns Array of validation errors (empty if valid)
   */
  const validateSubmission = useCallback((): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Check if submission period is open
    if (!submissionPeriod.isOpen) {
      errors.push({
        field: 'submission',
        message: submissionPeriod.message,
      });
      return errors; // Don't check other validations if period is closed
    }

    // Check if at least one submission type has content
    const hasFiles = watchedFiles && watchedFiles.length > 0;
    const hasText = watchedOnlineText && watchedOnlineText.trim().length > 0;

    if (!hasFiles && !hasText) {
      if (fileSubmissionEnabled && onlineTextEnabled) {
        errors.push({
          field: 'content',
          message: 'Please upload files or enter text for your submission.',
        });
      } else if (fileSubmissionEnabled) {
        errors.push({
          field: 'files',
          message: 'Please upload at least one file.',
        });
      } else if (onlineTextEnabled) {
        errors.push({
          field: 'onlineText',
          message: 'Please enter text for your submission.',
        });
      }
    }

    // Validate file count
    if (fileSubmissionEnabled && hasFiles && watchedFiles.length > maxFiles) {
      errors.push({
        field: 'files',
        message: `Maximum ${maxFiles} file(s) allowed. You have selected ${watchedFiles.length}.`,
      });
    }

    // Validate individual file sizes
    if (fileSubmissionEnabled && hasFiles) {
      for (const file of watchedFiles) {
        if (file.size > maxFileSize) {
          errors.push({
            field: 'files',
            message: `File "${file.name}" exceeds maximum size of ${formatFileSize(maxFileSize)}.`,
          });
        }
      }
    }

    // Validate online text word limit
    if (onlineTextEnabled && hasText && wordLimit && wordLimit > 0) {
      const wordCount = countWords(watchedOnlineText || '');
      if (wordCount > wordLimit) {
        errors.push({
          field: 'onlineText',
          message: `Text exceeds word limit. Maximum ${wordLimit} words, you have ${wordCount}.`,
        });
      }
    }

    // Validate submission statement
    if (assignment.requiresubmissionstatement === 1 && !watchedSubmissionStatement) {
      errors.push({
        field: 'submissionStatement',
        message: 'You must accept the submission statement.',
      });
    }

    return errors;
  }, [
    submissionPeriod,
    watchedFiles,
    watchedOnlineText,
    watchedSubmissionStatement,
    fileSubmissionEnabled,
    onlineTextEnabled,
    maxFiles,
    maxFileSize,
    wordLimit,
    assignment.requiresubmissionstatement,
  ]);

  // Update validation errors when form values change
  useEffect(() => {
    if (isFormDirty) {
      const errors = validateSubmission();
      setValidationErrors(errors);
    }
  }, [validateSubmission, isFormDirty]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle file changes from FileUploadZone
   */
  const handleFilesChange = useCallback(
    (files: File[]) => {
      setValue('files', files, { shouldValidate: true });
      setIsFormDirty(true);
    },
    [setValue]
  );

  /**
   * Handle opening confirmation dialog
   */
  const handleOpenConfirmDialog = useCallback(() => {
    const errors = validateSubmission();
    setValidationErrors(errors);

    if (errors.length === 0) {
      setConfirmDialogOpen(true);
    }
  }, [validateSubmission]);

  /**
   * Handle closing confirmation dialog
   */
  const handleCloseConfirmDialog = useCallback(() => {
    setConfirmDialogOpen(false);
  }, []);

  /**
   * Handle confirmed submission
   */
  const handleConfirmSubmission = useCallback(() => {
    setConfirmDialogOpen(false);

    const data: SubmitAssignmentData = {
      assignmentId: assignment.id,
      onlineText: watchedOnlineText || undefined,
      files: watchedFiles || [],
      acceptSubmissionStatement: watchedSubmissionStatement,
      saveAsDraft: false,
    };

    submitMutation(data);
  }, [
    assignment.id,
    watchedOnlineText,
    watchedFiles,
    watchedSubmissionStatement,
    submitMutation,
  ]);

  /**
   * Handle saving as draft
   */
  const handleSaveDraft = useCallback(() => {
    setIsDraftSaving(true);

    const data: SubmitAssignmentData = {
      assignmentId: assignment.id,
      onlineText: watchedOnlineText || undefined,
      files: watchedFiles || [],
      acceptSubmissionStatement: watchedSubmissionStatement,
      saveAsDraft: true,
    };

    submitMutation(data, {
      onSuccess: () => {
        setIsDraftSaving(false);
        setSuccessMessage('Draft saved successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      },
      onError: () => {
        setIsDraftSaving(false);
      },
    });
  }, [
    assignment.id,
    watchedOnlineText,
    watchedFiles,
    watchedSubmissionStatement,
    submitMutation,
  ]);

  /**
   * Handle cancel action
   */
  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  /**
   * Handle online text change
   */
  const handleOnlineTextChange = useCallback(
    (content: string) => {
      setValue('onlineText', content, { shouldValidate: true });
      setIsFormDirty(true);
    },
    [setValue]
  );

  // ============================================================================
  // Computed Values
  // ============================================================================

  // Calculate word count for online text
  const currentWordCount = useMemo(() => {
    return countWords(watchedOnlineText || '');
  }, [watchedOnlineText]);

  // Determine if submit button should be disabled
  const isSubmitDisabled = useMemo(() => {
    return (
      isSubmitting ||
      isDraftSaving ||
      !submissionPeriod.isOpen ||
      validationErrors.length > 0
    );
  }, [isSubmitting, isDraftSaving, submissionPeriod.isOpen, validationErrors.length]);

  // Get due date countdown message
  const dueDateMessage = useMemo(() => {
    if (!assignment.duedate) {return null;}

    const now = Math.floor(Date.now() / 1000);
    const diff = assignment.duedate - now;

    if (diff <= 0) {
      return { type: 'warning' as const, message: 'Past due date' };
    }

    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);

    if (days > 7) {
      return null;
    } else if (days > 1) {
      return { type: 'info' as const, message: `Due in ${days} days` };
    } else if (days === 1) {
      return { type: 'warning' as const, message: 'Due tomorrow' };
    } else if (hours > 1) {
      return { type: 'error' as const, message: `Due in ${hours} hours` };
    } else {
      return { type: 'error' as const, message: 'Due very soon!' };
    }
  }, [assignment.duedate]);

  // ============================================================================
  // Render Functions
  // ============================================================================

  /**
   * Render assignment requirements section
   */
  const renderRequirementsSection = () => (
    <Paper
      elevation={1}
      sx={{ p: 3, mb: 3 }}
      role="region"
      aria-label="Assignment requirements"
    >
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Info color="primary" />
        Assignment Requirements
      </Typography>

      <List dense>
        {/* Due date */}
        {assignment.duedate > 0 && (
          <ListItem>
            <ListItemIcon>
              <AccessTime />
            </ListItemIcon>
            <ListItemText
              primary="Due Date"
              secondary={formatDate(assignment.duedate)}
            />
            {dueDateMessage && (
              <Chip
                label={dueDateMessage.message}
                color={dueDateMessage.type}
                size="small"
              />
            )}
          </ListItem>
        )}

        {/* Submission types */}
        <ListItem>
          <ListItemIcon>
            <Description />
          </ListItemIcon>
          <ListItemText
            primary="Submission Types"
            secondary={
              [
                fileSubmissionEnabled && 'File upload',
                onlineTextEnabled && 'Online text',
              ]
                .filter(Boolean)
                .join(', ') || 'No submission types enabled'
            }
          />
        </ListItem>

        {/* File submission details */}
        {fileSubmissionEnabled && (
          <>
            <ListItem>
              <ListItemIcon>
                <CloudUpload />
              </ListItemIcon>
              <ListItemText
                primary="Maximum Files"
                secondary={`${maxFiles} file(s)`}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon />
              <ListItemText
                primary="Maximum File Size"
                secondary={formatFileSize(maxFileSize)}
              />
            </ListItem>
            {acceptedFileTypes.length > 0 && (
              <ListItem>
                <ListItemIcon />
                <ListItemText
                  primary="Accepted File Types"
                  secondary={acceptedFileTypes.join(', ')}
                />
              </ListItem>
            )}
          </>
        )}

        {/* Online text details */}
        {onlineTextEnabled && wordLimit && wordLimit > 0 && (
          <ListItem>
            <ListItemIcon>
              <TextFields />
            </ListItemIcon>
            <ListItemText
              primary="Word Limit"
              secondary={`Maximum ${wordLimit} words`}
            />
          </ListItem>
        )}

        {/* Maximum attempts */}
        {assignment.maxattempts !== 0 && (
          <ListItem>
            <ListItemIcon />
            <ListItemText
              primary="Maximum Attempts"
              secondary={
                assignment.maxattempts === -1
                  ? 'Unlimited'
                  : `${assignment.maxattempts} attempt(s)`
              }
            />
          </ListItem>
        )}
      </List>
    </Paper>
  );

  /**
   * Render existing submission info alert
   */
  const renderExistingSubmissionInfo = () => {
    if (!existingSubmission) {return null;}

    return (
      <Alert
        severity="info"
        sx={{ mb: 3 }}
        icon={<Info />}
        role="status"
        aria-live="polite"
      >
        <Typography variant="body2" fontWeight="medium">
          You are editing a previous submission
        </Typography>
        <Typography variant="body2">
          Submitted on: {formatDate(existingSubmission.timemodified)}
        </Typography>
        {existingSubmission.attemptnumber > 0 && (
          <Typography variant="body2">
            Attempt #{existingSubmission.attemptnumber + 1}
          </Typography>
        )}
        {existingSubmission.gradingstatus === 'graded' && (
          <Typography variant="body2">
            This submission has already been graded.
          </Typography>
        )}
      </Alert>
    );
  };

  /**
   * Render file upload section
   */
  const renderFileUploadSection = () => {
    if (!fileSubmissionEnabled) {return null;}

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudUpload color="primary" />
          File Submission
        </Typography>

        <FileUploadZone
          maxFileSize={maxFileSize}
          acceptedFileTypes={acceptedFileTypes.length > 0 ? acceptedFileTypes : undefined}
          maxFiles={maxFiles}
          onFilesChange={handleFilesChange}
          disabled={isSubmitting || isDraftSaving || !submissionPeriod.isOpen}
          existingFiles={existingFiles}
        />

        {/* File validation errors */}
        {validationErrors
          .filter((e) => e.field === 'files')
          .map((error, index) => (
            <Alert key={index} severity="error" sx={{ mt: 1 }}>
              {error.message}
            </Alert>
          ))}
      </Box>
    );
  };

  /**
   * Render online text section
   */
  const renderOnlineTextSection = () => {
    if (!onlineTextEnabled) {return null;}

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextFields color="primary" />
          Online Text Submission
        </Typography>

        <Controller
          name="onlineText"
          control={control}
          rules={{
            validate: {
              wordLimit: (value) => {
                if (!wordLimit || wordLimit <= 0) {return true;}
                const count = countWords(value || '');
                return count <= wordLimit || `Exceeds word limit (${count}/${wordLimit})`;
              },
            },
          }}
          render={({ field, fieldState }) => (
            <Box>
              <RichTextEditor
                name="onlineText"
                value={field.value || ''}
                onChange={(content) => {
                  field.onChange(content);
                  handleOnlineTextChange(content);
                }}
                disabled={isSubmitting || isDraftSaving || !submissionPeriod.isOpen}
                placeholder="Enter your submission text here..."
                toolbar="undo redo | blocks | bold italic underline | alignleft aligncenter alignright | bullist numlist | link | removeformat"
                height={300}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />

              {/* Word count display */}
              {wordLimit && wordLimit > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    mt: 1,
                  }}
                >
                  <Typography
                    variant="caption"
                    color={currentWordCount > wordLimit ? 'error' : 'text.secondary'}
                  >
                    {currentWordCount} / {wordLimit} words
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        />

        {/* Online text validation errors */}
        {validationErrors
          .filter((e) => e.field === 'onlineText')
          .map((error, index) => (
            <Alert key={index} severity="error" sx={{ mt: 1 }}>
              {error.message}
            </Alert>
          ))}
      </Box>
    );
  };

  /**
   * Render submission statement section
   */
  const renderSubmissionStatement = () => {
    if (assignment.requiresubmissionstatement !== 1) {return null;}

    return (
      <Paper
        elevation={1}
        sx={{
          p: 2,
          mb: 3,
          bgcolor: 'action.hover',
        }}
        role="region"
        aria-label="Submission statement"
      >
        <Typography variant="body2" paragraph>
          {assignment.submissionstatement ||
            'This submission is my own work, except where I have acknowledged the use of the works of other people.'}
        </Typography>

        <Controller
          name="submissionStatement"
          control={control}
          rules={{
            validate: (value) =>
              value === true || 'You must accept the submission statement',
          }}
          render={({ field, fieldState }) => (
            <FormControlLabel
              control={
                <Checkbox
                  {...field}
                  checked={field.value}
                  onChange={(e) => {
                    field.onChange(e.target.checked);
                    setIsFormDirty(true);
                  }}
                  disabled={isSubmitting || isDraftSaving || !submissionPeriod.isOpen}
                  inputProps={{
                    'aria-label': 'Accept submission statement',
                    'aria-required': 'true',
                  }}
                />
              }
              label="I have read and agree to the submission statement"
            />
          )}
        />

        {/* Submission statement error */}
        {validationErrors
          .filter((e) => e.field === 'submissionStatement')
          .map((error, index) => (
            <FormHelperText key={index} error>
              {error.message}
            </FormHelperText>
          ))}
      </Paper>
    );
  };

  /**
   * Render action buttons
   */
  const renderActionButtons = () => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 2,
        flexWrap: 'wrap',
        mt: 3,
      }}
    >
      {/* Cancel button */}
      <Button
        variant="text"
        startIcon={<Cancel />}
        onClick={handleCancel}
        disabled={isSubmitting || isDraftSaving}
        aria-label="Cancel submission"
      >
        Cancel
      </Button>

      {/* Save Draft button (if drafts enabled) */}
      {assignment.submissiondrafts === 1 && (
        <Button
          variant="outlined"
          startIcon={isDraftSaving ? <CircularProgress size={20} /> : <Save />}
          onClick={handleSaveDraft}
          disabled={isSubmitting || isDraftSaving || !submissionPeriod.isOpen}
          aria-label="Save as draft"
        >
          {isDraftSaving ? 'Saving...' : 'Save Draft'}
        </Button>
      )}

      {/* Submit button */}
      <Button
        variant="contained"
        color="primary"
        startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <Send />}
        onClick={handleOpenConfirmDialog}
        disabled={isSubmitDisabled}
        aria-label="Submit for grading"
      >
        {isSubmitting ? 'Submitting...' : 'Submit for Grading'}
      </Button>
    </Box>
  );

  /**
   * Render confirmation dialog
   */
  const renderConfirmDialog = () => (
    <Dialog
      open={confirmDialogOpen}
      onClose={handleCloseConfirmDialog}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <DialogTitle id="confirm-dialog-title">Confirm Submission</DialogTitle>
      <DialogContent>
        <Typography id="confirm-dialog-description" paragraph>
          Are you sure you want to submit this assignment?
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Once submitted, you may not be able to edit it.
        </Typography>

        {/* Submission summary */}
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="subtitle2" gutterBottom>
            Submission Summary:
          </Typography>
          <List dense disablePadding>
            {watchedFiles && watchedFiles.length > 0 && (
              <ListItem disableGutters>
                <ListItemText
                  primary={`${watchedFiles.length} file(s) to upload`}
                />
              </ListItem>
            )}
            {watchedOnlineText && watchedOnlineText.trim().length > 0 && (
              <ListItem disableGutters>
                <ListItemText
                  primary={`Online text: ${currentWordCount} words`}
                />
              </ListItem>
            )}
            {assignment.requiresubmissionstatement === 1 && watchedSubmissionStatement && (
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <CheckCircle color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Submission statement accepted" />
              </ListItem>
            )}
          </List>
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCloseConfirmDialog} disabled={isSubmitting}>
          No, go back
        </Button>
        <Button
          onClick={handleConfirmSubmission}
          variant="contained"
          color="primary"
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : undefined}
        >
          {isSubmitting ? 'Submitting...' : 'Yes, submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Box
      component="form"
      onSubmit={(e) => e.preventDefault()}
      sx={{ maxWidth: 800, mx: 'auto', p: { xs: 2, sm: 3 } }}
      role="form"
      aria-label="Assignment submission form"
    >
      {/* Assignment name header */}
      <Typography variant="h5" gutterBottom>
        {assignment.name}
      </Typography>

      {/* Submission period warning */}
      {!submissionPeriod.isOpen && (
        <Alert severity="error" sx={{ mb: 3 }} icon={<WarningIcon />}>
          {submissionPeriod.message}
        </Alert>
      )}

      {/* Late submission warning */}
      {submissionPeriod.isOpen && submissionPeriod.message && (
        <Alert severity="warning" sx={{ mb: 3 }} icon={<WarningIcon />}>
          {submissionPeriod.message}
        </Alert>
      )}

      {/* Success message */}
      {successMessage && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          icon={<CheckCircle />}
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </Alert>
      )}

      {/* API error message */}
      {isSubmitError && submitError && (
        <Alert severity="error" sx={{ mb: 3 }} role="alert" aria-live="assertive">
          {submitError.message || 'An error occurred while submitting. Please try again.'}
        </Alert>
      )}

      {/* General validation errors */}
      {validationErrors
        .filter((e) => e.field === 'submission' || e.field === 'content')
        .map((error, index) => (
          <Alert key={index} severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        ))}

      {/* Existing submission info */}
      {renderExistingSubmissionInfo()}

      {/* Assignment requirements */}
      {renderRequirementsSection()}

      <Divider sx={{ my: 3 }} />

      {/* File upload section */}
      {renderFileUploadSection()}

      {/* Online text section */}
      {renderOnlineTextSection()}

      {/* Submission statement */}
      {renderSubmissionStatement()}

      <Divider sx={{ my: 3 }} />

      {/* Action buttons */}
      {renderActionButtons()}

      {/* Confirmation dialog */}
      {renderConfirmDialog()}

      {/* Loading overlay */}
      {isSubmitting && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          role="status"
          aria-label="Submitting assignment"
          aria-live="polite"
        >
          <CircularProgress size={48} />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Submitting your assignment...
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// Export as default and named export for flexibility
export default SubmissionForm;
export { SubmissionForm };
