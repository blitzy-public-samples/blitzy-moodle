/**
 * Workshop Submission Form Component
 *
 * React form component for creating and editing workshop submissions.
 * Handles text content input via rich text editor, file attachments with
 * drag-and-drop upload, and submission metadata.
 *
 * Features:
 * - Rich text editor for submission content with formatting options
 * - Drag-and-drop file upload with progress indicators and file previews
 * - Validates file types against workshop configuration (maxbytes, maxfiles, allowedfiletypes)
 * - Displays submission instructions and grading criteria during editing
 * - Auto-save draft functionality with debouncing (2 second delay)
 * - Submission deadline countdown timer
 * - Confirmation dialog for final submission
 * - Handles both create and edit modes based on submission ID
 * - Permission checks (mod/workshop:submit capability)
 * - Optimistic updates with React Query mutations
 *
 * Architecture:
 * - Uses React Hook Form for form state management and validation
 * - Uses Material-UI components for consistent styling
 * - Integrates with workshop hooks for data fetching and mutations
 * - Client-side permission checks (backend must re-validate via require_capability)
 *
 * Usage:
 * ```tsx
 * // Create mode
 * <SubmissionForm workshopId={123} onSuccess={() => navigate('/workshop/123')} />
 *
 * // Edit mode
 * <SubmissionForm workshopId={123} submissionId={456} onSuccess={() => navigate(-1)} />
 * ```
 *
 * @module features/activities/workshop/components/SubmissionForm
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  Button,
  Typography,
  TextField,
  Alert,
  Paper,
  Divider,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Save as SaveIcon,
  Send as SendIcon,
  Schedule as ScheduleIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, isPast, differenceInSeconds } from 'date-fns';

// Internal imports - Editor and Form components
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { FormFileUpload } from '@/components/forms/FormFileUpload';

// Internal imports - Feedback components
import { Modal } from '@/components/feedback/Modal';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';

// Internal imports - Workshop feature hooks and types
import type {
  WorkshopSubmission,
  SubmissionFormData,
  Workshop,
} from '../types/workshop.types';
import { useWorkshop } from '../hooks/useWorkshop';
import {
  useSubmission,
  useCreateSubmission,
  useUpdateSubmission,
} from '../hooks/useSubmission';

// Internal imports - Utility hooks
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/useToast';
import { usePermissions } from '@/hooks/usePermissions';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for SubmissionForm component
 */
export interface SubmissionFormProps {
  /**
   * Workshop ID for the submission context
   * Required to fetch workshop configuration and validate submission
   */
  workshopId: number;

  /**
   * Optional submission ID for edit mode
   * If provided, form will load existing submission data
   * If omitted, form operates in create mode
   */
  submissionId?: number;

  /**
   * Callback function invoked after successful submission
   * Receives the saved submission object
   */
  onSuccess?: (submission: WorkshopSubmission) => void;

  /**
   * Optional callback for cancellation
   * Invoked when user clicks Cancel button
   */
  onCancel?: () => void;
}

/**
 * Form field values interface
 * Internal type for React Hook Form state management
 */
interface FormFields {
  /** Submission title (required) */
  title: string;
  /** Submission content in HTML format (required) */
  content: string;
  /** Content format: 1 = HTML (default) */
  contentformat: number;
  /** File attachments array */
  attachments: File[];
}

/**
 * Zod validation schema for form fields
 */
const formSchema = z.object({
  title: z
    .string()
    .min(1, 'Submission title is required')
    .max(255, 'Title must be 255 characters or less'),
  content: z.string().min(1, 'Submission content is required'),
  contentformat: z.number().default(1),
  attachments: z.array(z.instanceof(File)).default([]),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats file size in human-readable format
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Parses allowed file types string into array
 * Workshop stores file types as comma-separated string
 *
 * @param typeString - Comma-separated file types (e.g., ".pdf,.doc,.docx")
 * @returns Array of file extensions or MIME types
 */
function parseAllowedFileTypes(typeString: string | null | undefined): string {
  if (!typeString || typeString === '*') {
    return '*';
  }
  // Return as-is since FormFileUpload accepts accept string
  return typeString;
}

/**
 * Checks if the workshop is currently in submission phase
 *
 * @param workshop - Workshop object with phase info
 * @returns true if submissions are currently allowed
 */
function isSubmissionPhase(workshop: Workshop): boolean {
  return workshop.phase === 'submission' || workshop.phase === 'setup';
}

/**
 * Gets the time remaining until deadline
 *
 * @param deadline - Deadline timestamp (seconds or Date)
 * @returns Formatted time remaining string
 */
function getTimeRemaining(deadline: number | Date | null): string | null {
  if (!deadline) return null;

  const deadlineDate =
    typeof deadline === 'number' ? new Date(deadline * 1000) : deadline;

  if (isPast(deadlineDate)) {
    return 'Deadline passed';
  }

  return formatDistanceToNow(deadlineDate, { addSuffix: true });
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * Workshop Submission Form Component
 *
 * Provides a comprehensive form interface for creating and editing workshop
 * submissions. Includes rich text editing, file uploads, auto-save drafts,
 * deadline countdown, and final submission confirmation.
 *
 * @param props - Component props
 * @returns React element containing the submission form
 */
export default function SubmissionForm({
  workshopId,
  submissionId,
  onSuccess,
  onCancel,
}: SubmissionFormProps): React.ReactElement {
  // ============================================================================
  // Hooks and State
  // ============================================================================

  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasCapability } = usePermissions();

  // Track whether we're in edit mode
  const isEditMode = Boolean(submissionId);

  // Modal state for confirmation dialog
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Auto-save status tracking
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Deadline countdown state
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  // ============================================================================
  // Data Fetching Hooks
  // ============================================================================

  // Fetch workshop configuration
  const {
    workshop,
    isLoading: isLoadingWorkshop,
    error: workshopError,
  } = useWorkshop(workshopId);

  // Fetch existing submission if in edit mode
  const {
    submission: existingSubmission,
    isLoading: isLoadingSubmission,
    error: submissionError,
  } = useSubmission(workshopId, submissionId);

  // ============================================================================
  // Mutation Hooks
  // ============================================================================

  const createSubmission = useCreateSubmission();
  const updateSubmission = useUpdateSubmission();

  // Determine which mutation to use based on mode
  const saveMutation = isEditMode ? updateSubmission : createSubmission;

  // ============================================================================
  // Form Configuration
  // ============================================================================

  const defaultValues: FormFields = useMemo(() => {
    if (existingSubmission) {
      return {
        title: existingSubmission.title || '',
        content: existingSubmission.content || '',
        contentformat: existingSubmission.contentformat || 1,
        attachments: [],
      };
    }
    return {
      title: '',
      content: '',
      contentformat: 1,
      attachments: [],
    };
  }, [existingSubmission]);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormFields>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: 'onChange',
  });

  // Reset form when existing submission loads
  useEffect(() => {
    if (existingSubmission) {
      reset({
        title: existingSubmission.title || '',
        content: existingSubmission.content || '',
        contentformat: existingSubmission.contentformat || 1,
        attachments: [],
      });
    }
  }, [existingSubmission, reset]);

  // Watch form values for auto-save
  const watchedTitle = watch('title');
  const watchedContent = watch('content');

  // Debounce form values for auto-save (2 second delay)
  const debouncedTitle = useDebounce(watchedTitle, 2000);
  const debouncedContent = useDebounce(watchedContent, 2000);

  // ============================================================================
  // Permission Checks
  // ============================================================================

  // Check if user has permission to submit to workshops
  const canSubmit = useMemo(() => {
    return hasCapability('mod/workshop:submit');
  }, [hasCapability]);

  // Check if submission is currently editable based on workshop phase
  const isEditable = useMemo(() => {
    if (!workshop) return false;

    // Check workshop phase allows submissions
    if (!isSubmissionPhase(workshop)) {
      return false;
    }

    // Check deadline hasn't passed
    if (workshop.submissionEnd) {
      const deadline = new Date(workshop.submissionEnd * 1000);
      if (isPast(deadline)) {
        return false;
      }
    }

    return true;
  }, [workshop]);

  // ============================================================================
  // Deadline Timer Effect
  // ============================================================================

  useEffect(() => {
    if (!workshop?.submissionEnd) {
      setTimeRemaining(null);
      return;
    }

    const deadline = new Date(workshop.submissionEnd * 1000);

    // Update time remaining immediately
    setTimeRemaining(getTimeRemaining(deadline));

    // Set up interval to update every second
    const intervalId = setInterval(() => {
      const remaining = getTimeRemaining(deadline);
      setTimeRemaining(remaining);

      // Clear interval if deadline passed
      if (remaining === 'Deadline passed') {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [workshop?.submissionEnd]);

  // ============================================================================
  // Auto-Save Effect
  // ============================================================================

  useEffect(() => {
    // Skip auto-save if:
    // - No workshop loaded yet
    // - Form is not dirty
    // - Currently submitting
    // - Not in edit mode (don't auto-save new submissions)
    // - Not editable (deadline passed, wrong phase)
    if (
      !workshop ||
      !isDirty ||
      isSubmitting ||
      !isEditMode ||
      !submissionId ||
      !isEditable
    ) {
      return;
    }

    // Skip if title or content is empty
    if (!debouncedTitle.trim() || !debouncedContent.trim()) {
      return;
    }

    const performAutoSave = async () => {
      setIsAutoSaving(true);

      try {
        const formData: SubmissionFormData = {
          title: debouncedTitle,
          content: debouncedContent,
          contentformat: 1,
          attachments: [],
        };

        await updateSubmission.mutateAsync({
          workshopId,
          submissionId,
          data: formData,
        });

        setLastSaved(new Date());
        // Don't show toast for auto-save to avoid notification fatigue
      } catch (error) {
        console.error('Auto-save failed:', error);
        // Silent failure for auto-save - user can manually save
      } finally {
        setIsAutoSaving(false);
      }
    };

    performAutoSave();
  }, [
    debouncedTitle,
    debouncedContent,
    workshop,
    workshopId,
    submissionId,
    isDirty,
    isSubmitting,
    isEditMode,
    isEditable,
    updateSubmission,
  ]);

  // ============================================================================
  // Form Handlers
  // ============================================================================

  /**
   * Handles saving draft without final submission
   */
  const handleSaveDraft: SubmitHandler<FormFields> = useCallback(
    async (data) => {
      if (!workshop) return;

      try {
        const formData: SubmissionFormData = {
          title: data.title,
          content: data.content,
          contentformat: data.contentformat,
          attachments: data.attachments,
        };

        let savedSubmission: WorkshopSubmission;

        if (isEditMode && submissionId) {
          savedSubmission = await updateSubmission.mutateAsync({
            workshopId,
            submissionId,
            data: formData,
          });
        } else {
          savedSubmission = await createSubmission.mutateAsync({
            workshopId,
            data: formData,
          });
        }

        setLastSaved(new Date());
        toast.success('Draft saved successfully');

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({
          queryKey: ['workshop', workshopId],
        });
        queryClient.invalidateQueries({
          queryKey: ['workshop-submissions', workshopId],
        });
      } catch (error) {
        console.error('Failed to save draft:', error);
        toast.error('Failed to save draft. Please try again.');
      }
    },
    [
      workshop,
      workshopId,
      submissionId,
      isEditMode,
      createSubmission,
      updateSubmission,
      queryClient,
      toast,
    ]
  );

  /**
   * Opens confirmation modal before final submission
   */
  const handleSubmitClick = useCallback(() => {
    setShowConfirmModal(true);
  }, []);

  /**
   * Handles final submission after confirmation
   */
  const handleConfirmSubmit: SubmitHandler<FormFields> = useCallback(
    async (data) => {
      if (!workshop) return;

      try {
        const formData: SubmissionFormData = {
          title: data.title,
          content: data.content,
          contentformat: data.contentformat,
          attachments: data.attachments,
        };

        let savedSubmission: WorkshopSubmission;

        if (isEditMode && submissionId) {
          savedSubmission = await updateSubmission.mutateAsync({
            workshopId,
            submissionId,
            data: formData,
          });
        } else {
          savedSubmission = await createSubmission.mutateAsync({
            workshopId,
            data: formData,
          });
        }

        // Close modal
        setShowConfirmModal(false);

        toast.success('Submission completed successfully!');

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({
          queryKey: ['workshop', workshopId],
        });
        queryClient.invalidateQueries({
          queryKey: ['workshop-submissions', workshopId],
        });

        // Call success callback if provided
        if (onSuccess) {
          onSuccess(savedSubmission);
        }
      } catch (error) {
        console.error('Failed to submit:', error);
        toast.error('Failed to submit. Please try again.');
        setShowConfirmModal(false);
      }
    },
    [
      workshop,
      workshopId,
      submissionId,
      isEditMode,
      createSubmission,
      updateSubmission,
      queryClient,
      toast,
      onSuccess,
    ]
  );

  /**
   * Handles modal close (cancel confirmation)
   */
  const handleCloseModal = useCallback(() => {
    setShowConfirmModal(false);
  }, []);

  // ============================================================================
  // Computed Values
  // ============================================================================

  // File upload configuration from workshop settings
  const maxFileSize = workshop?.maxBytes || 10 * 1024 * 1024; // Default 10MB
  const maxFiles = workshop?.nAttachments || 5;
  const allowedFileTypes = parseAllowedFileTypes(workshop?.submissionFileTypes);

  // Loading state
  const isLoading = isLoadingWorkshop || (isEditMode && isLoadingSubmission);

  // Error state
  const error = workshopError || submissionError;

  // Mutation loading state
  const isSaving =
    createSubmission.isPending ||
    updateSubmission.isPending ||
    isAutoSaving;

  // ============================================================================
  // Render Conditions
  // ============================================================================

  // Show loading spinner while fetching data
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 300,
        }}
      >
        <LoadingSpinner size={40} text="Loading submission form..." />
      </Box>
    );
  }

  // Show error if data fetch failed
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load workshop data. Please try refreshing the page.
        {error instanceof Error && `: ${error.message}`}
      </Alert>
    );
  }

  // Show error if workshop not found
  if (!workshop) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Workshop not found. Please check the URL and try again.
      </Alert>
    );
  }

  // Show permission denied if user cannot submit
  if (!canSubmit) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        You do not have permission to submit to this workshop.
      </Alert>
    );
  }

  // Show error if not in submission phase
  if (!isEditable && !isEditMode) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Submissions are not currently open for this workshop.
        {workshop.phase !== 'submission' && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Current phase: <strong>{workshop.phase}</strong>
          </Typography>
        )}
      </Alert>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Box component="form" noValidate>
      {/* Header Section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          {isEditMode ? 'Edit Submission' : 'New Submission'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {workshop.name}
        </Typography>
      </Box>

      {/* Deadline Warning */}
      {timeRemaining && (
        <Alert
          severity={timeRemaining === 'Deadline passed' ? 'error' : 'warning'}
          icon={<ScheduleIcon />}
          sx={{ mb: 3 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">
              <strong>Submission deadline:</strong>{' '}
              {timeRemaining === 'Deadline passed'
                ? 'The submission deadline has passed.'
                : `Deadline ${timeRemaining}`}
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Auto-save Status */}
      {isEditMode && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 2,
            color: 'text.secondary',
          }}
        >
          {isAutoSaving ? (
            <>
              <CircularProgress size={14} />
              <Typography variant="caption">Saving...</Typography>
            </>
          ) : lastSaved ? (
            <Typography variant="caption">
              Last saved: {lastSaved.toLocaleTimeString()}
            </Typography>
          ) : null}
        </Box>
      )}

      {/* Submission Instructions */}
      {workshop.instructAuthors && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <InfoIcon color="info" fontSize="small" />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Submission Instructions
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                dangerouslySetInnerHTML={{ __html: workshop.instructAuthors }}
              />
            </Box>
          </Box>
        </Paper>
      )}

      {/* Form Fields */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        {/* Title Field */}
        <Controller
          name="title"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Submission Title"
              placeholder="Enter a descriptive title for your submission"
              fullWidth
              required
              error={Boolean(errors.title)}
              helperText={errors.title?.message}
              disabled={!isEditable || isSaving}
              sx={{ mb: 3 }}
              inputProps={{
                maxLength: 255,
                'aria-describedby': 'title-helper-text',
              }}
            />
          )}
        />

        {/* Content Field with Rich Text Editor */}
        <Box sx={{ mb: 3 }}>
          <RichTextEditor
            control={control}
            name="content"
            label="Submission Content"
            placeholder="Enter your submission content here..."
            minHeight={300}
            disabled={!isEditable || isSaving}
            error={Boolean(errors.content)}
            helperText={errors.content?.message}
            toolbar="full"
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* File Attachments Section */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Attachments
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload files to include with your submission.
            {maxFiles > 0 && ` Maximum ${maxFiles} file(s).`}
            {maxFileSize > 0 && ` Maximum file size: ${formatFileSize(maxFileSize)}.`}
          </Typography>

          {/* File Type Restrictions Info */}
          {allowedFileTypes !== '*' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Allowed file types: {allowedFileTypes}
              </Typography>
            </Box>
          )}

          <FormFileUpload
            control={control}
            name="attachments"
            label="Upload Files"
            accept={allowedFileTypes}
            maxSize={maxFileSize}
            maxFiles={maxFiles}
            disabled={!isEditable || isSaving}
            helperText="Drag and drop files here, or click to select files"
          />

          {/* Display existing attachments for edit mode */}
          {isEditMode && existingSubmission?.attachment && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Existing attachments:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                <Chip
                  label={existingSubmission.attachment}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Grading Criteria Display */}
      {workshop.instructReviewers && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <WarningIcon color="warning" fontSize="small" />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Assessment Criteria
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Your submission will be assessed based on the following criteria:
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                dangerouslySetInnerHTML={{ __html: workshop.instructReviewers }}
              />
            </Box>
          </Box>
        </Paper>
      )}

      {/* Action Buttons */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 2,
          mt: 3,
        }}
      >
        {/* Cancel Button */}
        {onCancel && (
          <Button variant="outlined" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        )}

        {/* Save Draft Button */}
        <Button
          variant="outlined"
          color="primary"
          startIcon={
            isSaving ? <CircularProgress size={18} /> : <SaveIcon />
          }
          onClick={handleSubmit(handleSaveDraft)}
          disabled={!isEditable || isSaving}
        >
          Save Draft
        </Button>

        {/* Submit Button */}
        <Button
          variant="contained"
          color="primary"
          startIcon={
            isSubmitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />
          }
          onClick={handleSubmit((data) => {
            // Store data and show confirmation modal
            handleSubmitClick();
          })}
          disabled={!isEditable || isSaving}
        >
          Submit
        </Button>
      </Box>

      {/* Confirmation Modal */}
      <Modal
        open={showConfirmModal}
        onClose={handleCloseModal}
        title="Confirm Submission"
        maxWidth="sm"
        fullWidth
        actions={
          <>
            <Button onClick={handleCloseModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit(handleConfirmSubmit)}
              disabled={isSubmitting}
              startIcon={
                isSubmitting ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SendIcon />
                )
              }
            >
              {isSubmitting ? 'Submitting...' : 'Confirm Submit'}
            </Button>
          </>
        }
      >
        <Box>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to submit your work?
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Once submitted, your work will be available for peer assessment.
              {isEditable && ' You may still be able to edit your submission until the deadline.'}
            </Typography>
          </Alert>
        </Box>
      </Modal>
    </Box>
  );
}
