/**
 * PostForm Component
 *
 * Forum post creation and editing form component with comprehensive features:
 * - react-hook-form validation with Zod schema
 * - Integrated rich text editor (TinyMCE) for formatted content
 * - File attachment upload with drag-and-drop support
 * - Post subject field with character limit
 * - Private reply option for direct teacher-student communication
 * - Autosave draft functionality with debounced API calls
 * - Character/word count display with visual feedback
 * - Submit and cancel actions with optimistic updates
 * - Comprehensive error handling
 * - WCAG 2.1 AA accessibility (keyboard navigation, proper labeling, error announcements)
 *
 * Maps to PHP: public/mod/forum/post.php
 * Template reference: public/mod/forum/templates/forum_discussion_nested_v2_post_reply.mustache
 *
 * @module features/activities/forums/components/PostForm
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ChangeEvent,
} from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Typography,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Stack,
  CircularProgress,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  Send as SendIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';

// Internal imports from dependencies
import { useCreatePost, useUpdatePost } from '../hooks/useDiscussion';
import type {
  CreatePostData,
  UpdatePostData,
  DiscussionPost,
  ForumAttachment,
} from '../types/forum.types';
import { FormInput } from '@/components/forms/FormInput';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { FormFileUpload } from '@/components/forms/FormFileUpload';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/feedback/Modal';
import { Alert } from '@/components/feedback/Alert';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Form validation constants matching Moodle's forum post requirements
 */
const SUBJECT_MAX_LENGTH = 255;
const MESSAGE_MIN_LENGTH = 20;
const MESSAGE_MAX_LENGTH = 65535;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const ACCEPTED_FILE_TYPES = [
  'image/*',
  'application/pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.zip',
  '.txt',
];
const AUTOSAVE_DELAY = 2000; // 2 seconds debounce for autosave

/**
 * Local storage key prefix for draft storage
 */
const DRAFT_STORAGE_KEY_PREFIX = 'moodle_forum_draft_';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

/**
 * Zod schema for post form validation
 * Validates subject (required, max length) and message content (required, min/max length)
 */
const postFormSchema = z.object({
  subject: z
    .string()
    .max(SUBJECT_MAX_LENGTH, {
      message: `Subject must be ${SUBJECT_MAX_LENGTH} characters or less`,
    })
    .optional()
    .or(z.literal('')),
  message: z
    .string()
    .min(MESSAGE_MIN_LENGTH, {
      message: `Message must be at least ${MESSAGE_MIN_LENGTH} characters`,
    })
    .max(MESSAGE_MAX_LENGTH, {
      message: `Message must be ${MESSAGE_MAX_LENGTH} characters or less`,
    }),
  isPrivateReply: z.boolean().default(false),
  attachments: z.array(z.instanceof(File)).optional(),
});

/**
 * Type inference from Zod schema
 */
type PostFormValues = z.infer<typeof postFormSchema>;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Post form operation mode
 */
export type PostFormMode = 'create' | 'reply' | 'edit';

/**
 * Props interface for the PostForm component
 */
export interface PostFormProps {
  /**
   * Form mode: create new discussion, reply to post, or edit existing post
   */
  mode: PostFormMode;

  /**
   * Forum ID the post belongs to
   */
  forumId: number;

  /**
   * Discussion ID (required for reply and edit modes)
   */
  discussionId?: number;

  /**
   * Parent post ID for threaded replies
   */
  parentPostId?: number;

  /**
   * Existing post data for edit mode
   */
  existingPost?: DiscussionPost;

  /**
   * Whether the current user can make private replies (e.g., teachers)
   */
  canMakePrivateReply?: boolean;

  /**
   * Whether subject field should be shown (typically for new discussions)
   */
  showSubject?: boolean;

  /**
   * Default subject value (can be prefilled for replies)
   */
  defaultSubject?: string;

  /**
   * Callback fired on successful submission
   */
  onSuccess?: (post: DiscussionPost) => void;

  /**
   * Callback fired when user cancels the form
   */
  onCancel?: () => void;

  /**
   * Custom submit button text
   */
  submitButtonText?: string;

  /**
   * Custom cancel button text
   */
  cancelButtonText?: string;

  /**
   * Whether to show autosave indicator
   * @default true
   */
  showAutosave?: boolean;

  /**
   * Whether the form should be compact (reduced padding and margins)
   * @default false
   */
  compact?: boolean;

  /**
   * Accessible label for the form (for screen readers)
   */
  'aria-label'?: string;

  /**
   * Test ID for automated testing
   */
  'data-testid'?: string;
}

/**
 * Interface for draft data stored in localStorage
 */
interface DraftData {
  subject?: string;
  message: string;
  isPrivateReply: boolean;
  timestamp: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Counts words in HTML content by stripping tags
 * @param htmlContent - HTML string to count words in
 * @returns Word count
 */
function countWords(htmlContent: string): number {
  if (!htmlContent) return 0;

  // Strip HTML tags
  const textContent = htmlContent.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  const decodedContent = textContent
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // Split by whitespace and filter empty strings
  const words = decodedContent
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  return words.length;
}

/**
 * Counts characters in HTML content by stripping tags
 * @param htmlContent - HTML string to count characters in
 * @returns Character count
 */
function countCharacters(htmlContent: string): number {
  if (!htmlContent) return 0;

  // Strip HTML tags
  const textContent = htmlContent.replace(/<[^>]*>/g, '');

  // Decode HTML entities and count
  const decodedContent = textContent
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  return decodedContent.length;
}

/**
 * Generates a unique draft key based on form context
 */
function getDraftKey(
  mode: PostFormMode,
  forumId: number,
  discussionId?: number,
  parentPostId?: number,
  postId?: number
): string {
  const keyParts = [DRAFT_STORAGE_KEY_PREFIX, mode, forumId];

  if (discussionId) keyParts.push(`d${discussionId}`);
  if (parentPostId) keyParts.push(`p${parentPostId}`);
  if (postId) keyParts.push(`e${postId}`);

  return keyParts.join('_');
}

/**
 * Saves draft to localStorage
 */
function saveDraftToStorage(key: string, data: DraftData): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    // Storage might be full or disabled - fail silently
    console.warn('Failed to save draft to localStorage:', error);
  }
}

/**
 * Loads draft from localStorage
 */
function loadDraftFromStorage(key: string): DraftData | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const data = JSON.parse(stored) as DraftData;

    // Check if draft is less than 24 hours old
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (Date.now() - data.timestamp > oneDayMs) {
      localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    console.warn('Failed to load draft from localStorage:', error);
    return null;
  }
}

/**
 * Removes draft from localStorage
 */
function removeDraftFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to remove draft from localStorage:', error);
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PostForm Component
 *
 * Comprehensive form for creating, replying to, and editing forum posts.
 * Provides rich text editing, file attachments, autosave, and full accessibility.
 */
export function PostForm({
  mode,
  forumId,
  discussionId,
  parentPostId,
  existingPost,
  canMakePrivateReply = false,
  showSubject = false,
  defaultSubject = '',
  onSuccess,
  onCancel,
  submitButtonText,
  cancelButtonText = 'Cancel',
  showAutosave = true,
  compact = false,
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
}: PostFormProps): JSX.Element {
  // ============================================================================
  // HOOKS
  // ============================================================================

  const queryClient = useQueryClient();
  const toast = useToast();

  // Mutation hooks for creating and updating posts
  const createPostMutation = useCreatePost();
  const updatePostMutation = useUpdatePost();

  // ============================================================================
  // STATE
  // ============================================================================

  // Confirmation dialog state for unsaved changes
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Autosave state
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Error state for inline alerts
  const [formError, setFormError] = useState<string | null>(null);

  // Track if form has been modified since last save
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Reference for announcements (accessibility)
  const announcementRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  // Generate draft key based on context
  const draftKey = useMemo(
    () =>
      getDraftKey(
        mode,
        forumId,
        discussionId,
        parentPostId,
        existingPost?.id
      ),
    [mode, forumId, discussionId, parentPostId, existingPost?.id]
  );

  // Determine default values (load from draft or existing post)
  const defaultValues = useMemo((): PostFormValues => {
    // Try to load from localStorage first
    const draft = loadDraftFromStorage(draftKey);

    if (draft) {
      return {
        subject: draft.subject || defaultSubject,
        message: draft.message,
        isPrivateReply: draft.isPrivateReply,
        attachments: [],
      };
    }

    // Fall back to existing post data (edit mode) or defaults
    if (existingPost) {
      return {
        subject: existingPost.subject || '',
        message: existingPost.message || '',
        isPrivateReply: existingPost.privatereplyto !== null,
        attachments: [],
      };
    }

    // Default values for new post/reply
    return {
      subject: defaultSubject,
      message: '',
      isPrivateReply: false,
      attachments: [],
    };
  }, [draftKey, existingPost, defaultSubject]);

  // ============================================================================
  // FORM SETUP
  // ============================================================================

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues,
    mode: 'onBlur',
  });

  // Watch form values for character count and autosave
  const watchedMessage = watch('message');
  const watchedSubject = watch('subject');
  const watchedIsPrivateReply = watch('isPrivateReply');

  // Debounced values for autosave
  const debouncedMessage = useDebounce(watchedMessage, AUTOSAVE_DELAY);
  const debouncedSubject = useDebounce(watchedSubject || '', AUTOSAVE_DELAY);

  // ============================================================================
  // CHARACTER/WORD COUNTS
  // ============================================================================

  const messageCharCount = useMemo(
    () => countCharacters(watchedMessage),
    [watchedMessage]
  );

  const messageWordCount = useMemo(
    () => countWords(watchedMessage),
    [watchedMessage]
  );

  const subjectCharCount = useMemo(
    () => (watchedSubject ? watchedSubject.length : 0),
    [watchedSubject]
  );

  // Progress values for visual feedback
  const messageProgress = useMemo(
    () => Math.min((messageCharCount / MESSAGE_MAX_LENGTH) * 100, 100),
    [messageCharCount]
  );

  const subjectProgress = useMemo(
    () => Math.min((subjectCharCount / SUBJECT_MAX_LENGTH) * 100, 100),
    [subjectCharCount]
  );

  // Progress color based on usage
  const getProgressColor = (
    progress: number
  ): 'primary' | 'warning' | 'error' => {
    if (progress >= 95) return 'error';
    if (progress >= 80) return 'warning';
    return 'primary';
  };

  // ============================================================================
  // AUTOSAVE EFFECT
  // ============================================================================

  useEffect(() => {
    // Don't autosave if form is pristine or being submitted
    if (!isDirty || isSubmitting) return;

    // Save draft to localStorage
    const draftData: DraftData = {
      subject: debouncedSubject,
      message: debouncedMessage,
      isPrivateReply: watchedIsPrivateReply,
      timestamp: Date.now(),
    };

    setIsSavingDraft(true);
    saveDraftToStorage(draftKey, draftData);

    // Update UI
    setLastSavedTime(new Date());
    setHasUnsavedChanges(false);
    setIsSavingDraft(false);

    // Show subtle notification
    if (showAutosave) {
      toast.info('Draft saved', { duration: 1500 });
    }
  }, [
    debouncedMessage,
    debouncedSubject,
    watchedIsPrivateReply,
    isDirty,
    isSubmitting,
    draftKey,
    showAutosave,
    toast,
  ]);

  // Track unsaved changes
  useEffect(() => {
    if (isDirty) {
      setHasUnsavedChanges(true);
    }
  }, [watchedMessage, watchedSubject, isDirty]);

  // ============================================================================
  // FORM SUBMISSION
  // ============================================================================

  const handleFormSubmit: SubmitHandler<PostFormValues> = useCallback(
    async (data) => {
      setFormError(null);

      try {
        let result: DiscussionPost;

        if (mode === 'edit' && existingPost) {
          // Update existing post
          const updateData: UpdatePostData = {
            postId: existingPost.id,
            message: data.message,
            subject: data.subject,
            attachments: data.attachments,
            removeAttachments: [], // Would be populated if UI supports removing existing attachments
          };

          result = await updatePostMutation.mutateAsync(updateData);
          toast.success('Post updated successfully');
        } else {
          // Create new post or reply
          const createData: CreatePostData = {
            forumId,
            message: data.message,
            discussionId: discussionId,
            parentPostId: parentPostId,
            subject: data.subject,
            attachments: data.attachments,
            isPrivateReply: data.isPrivateReply,
          };

          result = await createPostMutation.mutateAsync(createData);
          toast.success(
            mode === 'create' ? 'Discussion created successfully' : 'Reply posted successfully'
          );
        }

        // Clear draft on successful submission
        removeDraftFromStorage(draftKey);

        // Reset form
        reset();
        setHasUnsavedChanges(false);

        // Announce success for screen readers
        announceToScreenReader('Your post has been submitted successfully.');

        // Call success callback
        if (onSuccess) {
          onSuccess(result);
        }
      } catch (error) {
        // Handle submission error
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to submit post. Please try again.';

        setFormError(errorMessage);
        toast.error(errorMessage);

        // Announce error for screen readers
        announceToScreenReader(`Error: ${errorMessage}`);
      }
    },
    [
      mode,
      forumId,
      discussionId,
      parentPostId,
      existingPost,
      createPostMutation,
      updatePostMutation,
      toast,
      draftKey,
      reset,
      onSuccess,
    ]
  );

  // ============================================================================
  // CANCEL HANDLING
  // ============================================================================

  const handleCancelClick = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowCancelConfirm(true);
    } else {
      onCancel?.();
    }
  }, [hasUnsavedChanges, onCancel]);

  const handleConfirmCancel = useCallback(() => {
    // Remove draft from storage
    removeDraftFromStorage(draftKey);
    setShowCancelConfirm(false);
    reset();
    onCancel?.();
  }, [draftKey, reset, onCancel]);

  const handleDismissCancelConfirm = useCallback(() => {
    setShowCancelConfirm(false);
  }, []);

  // ============================================================================
  // ACCESSIBILITY HELPERS
  // ============================================================================

  /**
   * Announces a message to screen readers using ARIA live region
   */
  const announceToScreenReader = useCallback((message: string) => {
    if (announcementRef.current) {
      announcementRef.current.textContent = message;
    }
  }, []);

  // ============================================================================
  // BUTTON TEXT
  // ============================================================================

  const resolvedSubmitText = useMemo(() => {
    if (submitButtonText) return submitButtonText;

    switch (mode) {
      case 'create':
        return 'Post to forum';
      case 'reply':
        return 'Submit reply';
      case 'edit':
        return 'Save changes';
      default:
        return 'Submit';
    }
  }, [mode, submitButtonText]);

  // ============================================================================
  // FORM LABEL
  // ============================================================================

  const formAriaLabel = useMemo(() => {
    if (ariaLabel) return ariaLabel;

    switch (mode) {
      case 'create':
        return 'Create new forum discussion';
      case 'reply':
        return 'Reply to forum post';
      case 'edit':
        return 'Edit forum post';
      default:
        return 'Forum post form';
    }
  }, [mode, ariaLabel]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const isLoading = createPostMutation.isPending || updatePostMutation.isPending;

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(handleFormSubmit)}
      aria-label={formAriaLabel}
      data-testid={dataTestId || 'post-form'}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 2 : 3,
        p: compact ? 2 : 3,
        bgcolor: 'background.paper',
        borderRadius: 1,
        boxShadow: 1,
      }}
    >
      {/* Screen reader announcements (visually hidden) */}
      <Box
        ref={announcementRef}
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      />

      {/* Form Error Alert */}
      <Collapse in={Boolean(formError)}>
        {formError && (
          <Alert
            severity="error"
            title="Submission Error"
            message={formError}
            closeable
            onClose={() => setFormError(null)}
            data-testid="post-form-error"
          />
        )}
      </Collapse>

      {/* Subject Field (conditional) */}
      {showSubject && (
        <Box>
          <FormInput
            name="subject"
            control={control}
            label="Subject"
            placeholder="Enter discussion subject"
            required={mode === 'create'}
            maxLength={SUBJECT_MAX_LENGTH}
            disabled={isLoading}
            aria-describedby="subject-hint subject-progress"
            data-testid="post-form-subject"
          />
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 0.5,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              id="subject-hint"
            >
              A clear, descriptive subject helps others find your discussion
            </Typography>
            <Typography
              variant="caption"
              color={
                subjectCharCount > SUBJECT_MAX_LENGTH
                  ? 'error.main'
                  : 'text.secondary'
              }
              id="subject-progress"
              aria-live="polite"
            >
              {subjectCharCount}/{SUBJECT_MAX_LENGTH}
            </Typography>
          </Box>
          {subjectCharCount > 0 && (
            <LinearProgress
              variant="determinate"
              value={subjectProgress}
              color={getProgressColor(subjectProgress)}
              sx={{ mt: 0.5, height: 2 }}
              aria-hidden="true"
            />
          )}
        </Box>
      )}

      {/* Message Field with Rich Text Editor */}
      <Box>
        <Typography
          component="label"
          variant="subtitle2"
          fontWeight="medium"
          sx={{ mb: 1, display: 'block' }}
          id="message-label"
        >
          Message <span aria-hidden="true">*</span>
          <Typography component="span" className="visually-hidden">
            (required)
          </Typography>
        </Typography>

        <Controller
          name="message"
          control={control}
          render={({ field, fieldState }) => (
            <RichTextEditor
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              toolbar="full"
              placeholder="Write your message here..."
              minHeight={200}
              maxHeight={500}
              disabled={isLoading}
              error={Boolean(fieldState.error)}
              errorMessage={fieldState.error?.message}
              aria-labelledby="message-label"
              aria-describedby="message-hint message-count"
              aria-invalid={Boolean(fieldState.error)}
              data-testid="post-form-message"
            />
          )}
        />

        {/* Message statistics */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 1,
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            id="message-hint"
          >
            Minimum {MESSAGE_MIN_LENGTH} characters required
          </Typography>
          <Stack direction="row" spacing={2}>
            <Typography
              variant="caption"
              color="text.secondary"
              aria-live="polite"
            >
              {messageWordCount} {messageWordCount === 1 ? 'word' : 'words'}
            </Typography>
            <Typography
              variant="caption"
              color={
                messageCharCount > MESSAGE_MAX_LENGTH
                  ? 'error.main'
                  : messageCharCount < MESSAGE_MIN_LENGTH
                  ? 'warning.main'
                  : 'text.secondary'
              }
              id="message-count"
              aria-live="polite"
            >
              {messageCharCount}/{MESSAGE_MAX_LENGTH} characters
            </Typography>
          </Stack>
        </Box>
        {messageCharCount > 0 && (
          <LinearProgress
            variant="determinate"
            value={messageProgress}
            color={getProgressColor(messageProgress)}
            sx={{ mt: 0.5, height: 2 }}
            aria-hidden="true"
          />
        )}

        {/* Validation error for message */}
        {errors.message && (
          <Alert
            severity="error"
            message={errors.message.message || 'Please enter a valid message'}
            variant="standard"
            sx={{ mt: 1 }}
            role="alert"
          />
        )}
      </Box>

      {/* File Attachments */}
      <Box>
        <Typography
          component="label"
          variant="subtitle2"
          fontWeight="medium"
          sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
          id="attachments-label"
        >
          <AttachFileIcon fontSize="small" />
          Attachments
        </Typography>

        <Controller
          name="attachments"
          control={control}
          render={({ field, fieldState }) => (
            <FormFileUpload
              name="attachments"
              control={control}
              label="Upload files"
              helperText={`Drag and drop files here or click to browse. Max ${MAX_FILES} files, ${MAX_FILE_SIZE / (1024 * 1024)}MB each.`}
              accept={ACCEPTED_FILE_TYPES.join(',')}
              maxSize={MAX_FILE_SIZE}
              maxFiles={MAX_FILES}
              multiple
              disabled={isLoading}
              showPreview
              aria-labelledby="attachments-label"
              data-testid="post-form-attachments"
            />
          )}
        />
      </Box>

      {/* Private Reply Option (conditional) */}
      {canMakePrivateReply && mode === 'reply' && (
        <Controller
          name="isPrivateReply"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Checkbox
                  checked={field.value}
                  onChange={field.onChange}
                  disabled={isLoading}
                  inputProps={{
                    'aria-describedby': 'private-reply-hint',
                  }}
                  data-testid="post-form-private-reply"
                />
              }
              label={
                <Box>
                  <Typography variant="body2">
                    Make this a private reply
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    id="private-reply-hint"
                  >
                    Only visible to you and the student you are replying to
                  </Typography>
                </Box>
              }
            />
          )}
        />
      )}

      {/* Autosave Status */}
      {showAutosave && isDirty && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'text.secondary',
          }}
          aria-live="polite"
        >
          {isSavingDraft ? (
            <>
              <CircularProgress size={12} />
              <Typography variant="caption">Saving draft...</Typography>
            </>
          ) : lastSavedTime ? (
            <>
              <SaveIcon fontSize="small" sx={{ fontSize: 14 }} />
              <Typography variant="caption">
                Draft saved at {lastSavedTime.toLocaleTimeString()}
              </Typography>
            </>
          ) : hasUnsavedChanges ? (
            <Typography variant="caption">Unsaved changes</Typography>
          ) : null}
        </Box>
      )}

      {/* Form Actions */}
      <Stack
        direction="row"
        spacing={2}
        justifyContent="flex-end"
        sx={{ mt: 2 }}
      >
        {onCancel && (
          <Tooltip title="Cancel and discard changes">
            <Button
              type="button"
              variant="outlined"
              color="inherit"
              onClick={handleCancelClick}
              disabled={isLoading}
              startIcon={<CancelIcon />}
              aria-label={cancelButtonText}
              data-testid="post-form-cancel"
            >
              {cancelButtonText}
            </Button>
          </Tooltip>
        )}

        <Tooltip title={isLoading ? 'Submitting...' : resolvedSubmitText}>
          <span> {/* Wrapper for disabled button tooltip */}
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isLoading || messageCharCount < MESSAGE_MIN_LENGTH}
              startIcon={
                isLoading ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SendIcon />
                )
              }
              aria-label={resolvedSubmitText}
              aria-busy={isLoading}
              data-testid="post-form-submit"
            >
              {isLoading ? 'Submitting...' : resolvedSubmitText}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {/* Cancel Confirmation Modal */}
      <Modal
        open={showCancelConfirm}
        onClose={handleDismissCancelConfirm}
        title="Discard unsaved changes?"
        maxWidth="xs"
        actions={[
          {
            label: 'Keep editing',
            onClick: handleDismissCancelConfirm,
            variant: 'outlined',
          },
          {
            label: 'Discard',
            onClick: handleConfirmCancel,
            color: 'error',
            variant: 'contained',
          },
        ]}
        aria-describedby="cancel-confirm-description"
        data-testid="post-form-cancel-confirm"
      >
        <Typography id="cancel-confirm-description">
          You have unsaved changes. If you cancel now, your draft will be lost.
        </Typography>
      </Modal>
    </Box>
  );
}

// Default export
export default PostForm;
