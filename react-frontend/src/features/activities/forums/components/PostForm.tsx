/**
 * PostForm Component
 *
 * Form component for creating, replying to, and editing forum posts.
 * Supports rich text editing, file attachments, draft auto-save, and preview.
 *
 * Features:
 * - Three modes: new discussion, reply to post, edit existing post
 * - Rich text editing with formatting controls
 * - File attachment with drag-and-drop support
 * - Auto-save drafts every 30 seconds
 * - Form validation and error handling
 * - Preview mode
 * - Moderator options (pin, lock)
 * - Subscription management
 * - Accessibility compliant
 *
 * @module features/activities/forums/components/PostForm
 */

import type React from 'react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Typography,
  Alert,
  Paper,
  Divider,
  IconButton,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import {
  AttachFile as AttachFileIcon,
  Delete as DeleteIcon,
  Preview as PreviewIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Close as CloseIcon,
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  InsertLink as InsertLinkIcon,
  FormatListBulleted as FormatListBulletedIcon,
  EmojiEmotions as EmojiEmotionsIcon,
} from '@mui/icons-material';
import { useCreatePost } from '../hooks/useCreatePost';
import { useCreateDiscussion } from '../hooks/useCreateDiscussion';
import { useUpdatePost } from '../hooks/useUpdatePost';
import { useSaveDraft } from '../hooks/useSaveDraft';
import { useMultiFileUpload } from '@/hooks/useMultiFileUpload';
import type { Post, PostResponse } from '../types/forum.types';
import type { DiscussionResponse } from '../api/forumApi';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Form data structure
 */
interface PostFormData {
  /** Subject of the discussion (for new discussions only) */
  subject?: string;
  /** Message content */
  message: string;
  /** Whether user wants to subscribe to the discussion */
  subscribe: boolean;
  /** Email notification preference */
  emailNotification: 'none' | 'digest' | 'immediate';
  /** Pin discussion (moderator only, new discussions only) */
  pinned?: boolean;
  /** Lock discussion (moderator only, new discussions only) */
  locked?: boolean;
  /** Tags or categories */
  tags?: string[];
}

/**
 * Error structure with field-level validation errors
 */
interface ErrorWithFields {
  code?: string;
  message?: string;
  fields?: Record<string, string>;
}

/**
 * Type guard to check if error has field-level validation errors
 */
function hasFieldErrors(error: unknown): error is ErrorWithFields {
  return (
    typeof error === 'object' &&
    error !== null &&
    'fields' in error &&
    typeof (error as ErrorWithFields).fields === 'object'
  );
}

/**
 * Type guard to check if error has a code property
 */
function hasErrorCode(error: unknown): error is ErrorWithFields {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as ErrorWithFields).code === 'string'
  );
}

/**
 * Props for the PostForm component
 */
export interface PostFormProps {
  /** Forum ID */
  forumId: number;
  /** Discussion ID (null for new discussion) */
  discussionId: number | null;
  /** Parent post ID (for replies) */
  parentPostId?: number | null;
  /** Parent post to quote/reply to (includes author and message) */
  parentPost?: {
    id?: number;
    author?: string;
    subject?: string;
    message: string;
  } | null;
  /** Post to edit (null for new post/discussion) */
  post?: Post | null;
  /** Existing draft data */
  draft?: {
    subject?: string;
    message: string;
    subscribe?: boolean;
  } | null;
  /** Whether user can moderate (pin, lock discussions) */
  canModerate?: boolean;
  /** Whether forum supports tags */
  supportsTags?: boolean;
  /** Available tags */
  availableTags?: string[];
  /** Callback on successful submission */
  onSubmitSuccess?: (response: PostResponse | DiscussionResponse) => void;
  /** Callback on cancel */
  onCancel?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SUBJECT_MIN_LENGTH = 3;
const SUBJECT_MAX_LENGTH = 255;
const MESSAGE_MIN_LENGTH = 10;
const MESSAGE_MAX_LENGTH = 30000;
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PostForm Component
 *
 * Comprehensive form for creating, replying to, and editing forum posts
 *
 * @param props - Component props
 * @returns PostForm component
 */
export function PostForm({
  forumId,
  discussionId,
  parentPostId = null,
  parentPost = null,
  post = null,
  draft = null,
  canModerate = false,
  supportsTags = false,
  availableTags = [],
  onSubmitSuccess,
  onCancel,
}: PostFormProps): JSX.Element {
  // ============================================================================
  // STATE AND REFS
  // ============================================================================

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [concurrentEditError, setConcurrentEditError] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string>('');
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);

  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // ============================================================================
  // DETERMINE MODE
  // ============================================================================

  const isNewDiscussion = discussionId === null;
  const isEditing = post !== null;
  const isReplying = !isNewDiscussion && !isEditing;

  // ============================================================================
  // FORM SETUP
  // ============================================================================

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isDirty },
    reset,
    setError,
  } = useForm<PostFormData>({
    defaultValues: {
      subject: draft?.subject ?? post?.subject ?? '',
      message: draft?.message ?? post?.message ?? '',
      subscribe: draft?.subscribe ?? false,
      emailNotification: 'digest',
      pinned: post?.pinned ?? false,
      locked: post?.locked ?? false,
      tags: post?.tags ?? [],
    },
  });

  const formData = watch();

  // ============================================================================
  // HOOKS
  // ============================================================================

  // Draft management
  const draftKey = isNewDiscussion
    ? `forum-${forumId}-new-discussion`
    : isEditing
      ? `forum-${forumId}-edit-post-${post.id}`
      : `forum-${forumId}-reply-${discussionId}`;

  const { saveDraft, loadDraft, deleteDraft, lastSavedAt } = useSaveDraft({
    draftKey,
    autoSaveInterval: AUTO_SAVE_INTERVAL,
  });

  // File management constants
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_FILES = 5;

  // File upload management using custom hook
  const {
    files,
    addFiles,
    removeFile,
    clearFiles,
    totalSize,
  } = useMultiFileUpload({
    maxFiles: MAX_FILES,
    maxSize: MAX_FILE_SIZE,
    maxTotalSize: 50 * 1024 * 1024, // 50MB total
    allowedTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/zip',
    ],
    onValidationError: (error) => {
      setValidationErrors((prev) => [...prev, error]);
    },
  });

  // Create preview URLs for image files (manage cleanup)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  // Track all created URLs for cleanup using ref to avoid circular dependency
  const createdUrlsRef = useRef<Set<string>>(new Set());

  // Generate preview URLs for new image files
  useEffect(() => {
    const newPreviews: Record<string, string> = {};
    const urlsToRevoke: string[] = [];

    // Create previews for new files
    setPreviewUrls((prevUrls) => {
      files.forEach((file) => {
        if (file.file.type.startsWith('image/') && !prevUrls[file.id]) {
          const url = URL.createObjectURL(file.file);
          newPreviews[file.id] = url;
          createdUrlsRef.current.add(url); // Track created URL
        }
      });

      // Find URLs to revoke (files that were removed)
      Object.keys(prevUrls).forEach((fileId) => {
        if (!files.find((f) => f.id === fileId)) {
          const url = prevUrls[fileId];
          if (url) {
            urlsToRevoke.push(url);
            createdUrlsRef.current.delete(url); // Remove from tracking
          }
        }
      });

      // Update preview URLs
      if (Object.keys(newPreviews).length > 0 || urlsToRevoke.length > 0) {
        const updated = { ...prevUrls, ...newPreviews };
        urlsToRevoke.forEach((url) => {
          const key = Object.keys(prevUrls).find((k) => prevUrls[k] === url);
          if (key) {
            delete updated[key];
          }
        });
        return updated;
      }

      return prevUrls;
    });

    // Revoke old URLs
    urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));

    // Cleanup on unmount: capture current URLs to revoke at effect run time
    // We only revoke URLs that exist at the time this effect runs, which is correct
    // because the next effect run will handle newly created URLs
    const urlsToCleanup = Array.from(createdUrlsRef.current);
    return () => {
      urlsToCleanup.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  // Create post mutation
  const {
    createPost,
    isLoading: isCreating,
    isError: isCreateError,
    error: createError,
  } = useCreatePost({
    onSuccess: (data) => {
      setIsSubmittingLocal(false);
      deleteDraft();
      clearFiles();
      reset();
      onSubmitSuccess?.(data);
    },
    onError: (error) => {
      setIsSubmittingLocal(false);
      if (error.message.includes('409')) {
        setConcurrentEditError(true);
      } else {
        setNetworkError(error.message);
      }
    },
  });

  // Create discussion mutation
  const {
    createDiscussion,
    isLoading: isCreatingDiscussion,
    isError: isCreateDiscussionError,
    error: createDiscussionError,
  } = useCreateDiscussion({
    onSuccess: (data) => {
      setIsSubmittingLocal(false);
      deleteDraft();
      clearFiles();
      reset();
      onSubmitSuccess?.(data);
    },
    onError: (error) => {
      setIsSubmittingLocal(false);
      if (error.message.includes('409')) {
        setConcurrentEditError(true);
      } else {
        setNetworkError(error.message);
      }
    },
  });

  // Update post mutation
  const {
    updatePost,
    isLoading: isUpdating,
    isError: isUpdateError,
    error: updateError,
  } = useUpdatePost({
    onSuccess: (data) => {
      setIsSubmittingLocal(false);
      deleteDraft();
      clearFiles();
      reset();
      onSubmitSuccess?.(data);
    },
    onError: (error) => {
      setIsSubmittingLocal(false);
      if (error.message.includes('409')) {
        setConcurrentEditError(true);
      } else {
        setNetworkError(error.message);
      }
    },
  });

  const isSubmitting = isCreating || isCreatingDiscussion || isUpdating || isSubmittingLocal;

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load draft on mount
  useEffect(() => {
    if (!isEditing && !draft) {
      const savedDraft = loadDraft();
      if (savedDraft) {
        setValue('subject', savedDraft.subject ?? '');
        setValue('message', savedDraft.message);
        setValue('subscribe', savedDraft.subscribe ?? true);
      }
    }
  }, [isEditing, draft, loadDraft, setValue]);

  // Handle mutation errors
  useEffect(() => {
    if (isUpdateError && updateError) {
      // Cast to unknown to use type guards
      const err = updateError as unknown;

      if (hasErrorCode(err) && err.code === 'CONCURRENT_EDIT') {
        setConcurrentEditError(true);
      } else if (updateError.message?.includes('409')) {
        setConcurrentEditError(true);
      } else if (hasFieldErrors(err)) {
        // Handle server validation errors with field-level errors
        const fieldErrors = err.fields;
        if (fieldErrors) {
          Object.keys(fieldErrors).forEach((field) => {
            const errorMessage = fieldErrors[field];
            if (errorMessage) {
              setError(field as keyof PostFormData, {
                type: 'server',
                message: errorMessage,
              });
            }
          });
        }
      } else {
        const errorMessage = updateError.message ?? 'An error occurred';
        setNetworkError(errorMessage);
      }
    }
  }, [isUpdateError, updateError, setError]);

  useEffect(() => {
    if (isCreateError && createError) {
      // Cast to unknown to use type guards
      const err = createError as unknown;

      if (hasErrorCode(err) && err.code === 'CONCURRENT_EDIT') {
        setConcurrentEditError(true);
      } else if (createError.message?.includes('409')) {
        setConcurrentEditError(true);
      } else if (hasFieldErrors(err)) {
        // Handle server validation errors with field-level errors
        const fieldErrors = err.fields;
        if (fieldErrors) {
          Object.keys(fieldErrors).forEach((field) => {
            const errorMessage = fieldErrors[field];
            if (errorMessage) {
              setError(field as keyof PostFormData, {
                type: 'server',
                message: errorMessage,
              });
            }
          });
        }
      } else {
        const errorMessage = createError.message ?? 'An error occurred';
        setNetworkError(errorMessage);
      }
    }
  }, [isCreateError, createError, setError]);

  useEffect(() => {
    if (isCreateDiscussionError && createDiscussionError) {
      // Cast to unknown to use type guards
      const err = createDiscussionError as unknown;

      if (hasErrorCode(err) && err.code === 'CONCURRENT_EDIT') {
        setConcurrentEditError(true);
      } else if (createDiscussionError.message?.includes('409')) {
        setConcurrentEditError(true);
      } else if (hasFieldErrors(err)) {
        // Handle server validation errors with field-level errors
        const fieldErrors = err.fields;
        if (fieldErrors) {
          Object.keys(fieldErrors).forEach((field) => {
            const errorMessage = fieldErrors[field];
            if (errorMessage) {
              setError(field as keyof PostFormData, {
                type: 'server',
                message: errorMessage,
              });
            }
          });
        }
      } else {
        const errorMessage = createDiscussionError.message ?? 'An error occurred';
        setNetworkError(errorMessage);
      }
    }
  }, [isCreateDiscussionError, createDiscussionError, setError]);

  // Auto-save draft
  useEffect(() => {
    if (isDirty && !isSubmitting) {
      autoSaveTimerRef.current = setTimeout(() => {
        saveDraft({
          subject: formData.subject,
          message: formData.message,
          subscribe: formData.subscribe,
          attachmentNames: files.map((f) => f.name),
        });
      }, AUTO_SAVE_INTERVAL);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData, files, isDirty, isSubmitting, saveDraft]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      clearFiles();
    };
  }, [clearFiles]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  /**
   * Handle form submission
   */
  const onSubmit = handleSubmit((data) => {
    // Prevent rapid successive submissions
    if (isSubmittingLocal) {
      return;
    }
    setIsSubmittingLocal(true);

    // Clear previous errors
    setValidationErrors([]);
    setNetworkError(null);
    setConcurrentEditError(false);

    // Validate
    const errors: string[] = [];

    if (isNewDiscussion && !data.subject?.trim()) {
      errors.push('Subject is required for new discussions');
    }

    if (isNewDiscussion && data.subject && data.subject.length < SUBJECT_MIN_LENGTH) {
      errors.push(`Subject must be at least ${SUBJECT_MIN_LENGTH} characters`);
    }

    if (isNewDiscussion && data.subject && data.subject.length > SUBJECT_MAX_LENGTH) {
      errors.push(`Subject must not exceed ${SUBJECT_MAX_LENGTH} characters`);
    }

    if (!data.message?.trim()) {
      errors.push('Message is required');
    }

    if (data.message && data.message.length < MESSAGE_MIN_LENGTH) {
      errors.push(`Message must be at least ${MESSAGE_MIN_LENGTH} characters`);
    }

    if (data.message && data.message.length > MESSAGE_MAX_LENGTH) {
      errors.push(`Message must not exceed ${MESSAGE_MAX_LENGTH} characters`);
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      setIsSubmittingLocal(false);
      return;
    }

    // Prepare submission data based on mode
    if (isEditing) {
      // Update existing post
      const updateData = {
        postId: post.id,
        message: data.message,
        ...(isNewDiscussion && { subject: data.subject }),
        attachments: files.map((f) => f.file),
      };
      updatePost(updateData);
    } else {
      // Create new post or discussion
      if (isNewDiscussion) {
        // Create new discussion
        const discussionData = {
          subject: data.subject!,
          message: data.message,
          subscribe: data.subscribe,
          attachments: files.map((f) => f.file),
          ...(canModerate && { pinned: data.pinned, locked: data.locked }),
        };
        createDiscussion(forumId, discussionData);
      } else {
        // Create reply post
        const postData = {
          forumId,
          discussionId,
          ...(parentPostId && { parentPostId }),
          message: data.message,
          subscribe: data.subscribe,
          attachments: files.map((f) => f.file),
          ...(supportsTags && { tags: data.tags }),
        };
        createPost(postData);
      }
    }
  });

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      addFiles(selectedFiles);

      // Reset input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [addFiles]
  );

  /**
   * Handle file drop
   */
  const handleFileDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const droppedFiles = Array.from(event.dataTransfer.files);
      addFiles(droppedFiles);
    },
    [addFiles]
  );

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  /**
   * Handle manual draft save
   */
  const handleSaveDraft = useCallback(() => {
    saveDraft({
      subject: formData.subject,
      message: formData.message,
      subscribe: formData.subscribe,
      attachmentNames: files.map((f) => f.name),
    });
  }, [formData, files, saveDraft]);

  /**
   * Handle cancel with unsaved changes check
   */
  const handleCancel = useCallback(() => {
    if (isDirty) {
      setShowUnsavedWarning(true);
    } else {
      onCancel?.();
    }
  }, [isDirty, onCancel]);

  /**
   * Confirm cancel without saving
   */
  const handleConfirmCancel = useCallback(() => {
    setShowUnsavedWarning(false);
    deleteDraft();
    clearFiles();
    onCancel?.();
  }, [deleteDraft, clearFiles, onCancel]);

  /**
   * Toggle preview mode
   */
  const handleTogglePreview = useCallback(() => {
    setIsPreviewMode((prev) => !prev);
  }, []);

  /**
   * Insert formatted text into message
   */
  const insertFormattedText = useCallback(
    (before: string, after: string) => {
      const textarea = messageInputRef.current;
      if (!textarea) {
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = getValues('message') || '';
      const selectedText = currentValue.substring(start, end);

      const newValue =
        currentValue.substring(0, start) +
        before +
        selectedText +
        after +
        currentValue.substring(end);

      setValue('message', newValue, { shouldDirty: true });

      // Restore focus and selection
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + before.length + selectedText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [getValues, setValue]
  );

  /**
   * Handle bold formatting
   */
  const handleBold = useCallback(() => {
    insertFormattedText('**', '**');
  }, [insertFormattedText]);

  /**
   * Handle italic formatting
   */
  const handleItalic = useCallback(() => {
    insertFormattedText('*', '*');
  }, [insertFormattedText]);

  /**
   * Handle insert link
   */
  const handleInsertLink = useCallback(() => {
    insertFormattedText('[', '](url)');
  }, [insertFormattedText]);

  /**
   * Handle bullet list
   */
  const handleBulletList = useCallback(() => {
    const textarea = messageInputRef.current;
    if (!textarea) {
      return;
    }

    const currentValue = getValues('message') || '';
    const lines = currentValue.split('\n');
    const newLines = lines.map((line) => (line.trim() ? `- ${line}` : line));

    setValue('message', newLines.join('\n'), { shouldDirty: true });
  }, [getValues, setValue]);

  /**
   * Handle emoji picker toggle
   */
  const handleEmojiToggle = useCallback(() => {
    setShowEmojiPicker((prev) => !prev);
  }, []);

  /**
   * Handle emoji selection
   */
  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      const currentValue = getValues('message') || '';
      setValue('message', currentValue + emoji, { shouldDirty: true });
      setShowEmojiPicker(false);
      messageInputRef.current?.focus();
    },
    [getValues, setValue]
  );

  /**
   * Handle message input change to detect mentions
   */
  const handleMessageChange = useCallback((value: string) => {
    // Detect @ mentions
    const cursorPos = messageInputRef.current?.selectionStart ?? 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1] ?? '');
      setShowMentionSuggestions(true);
    } else {
      setShowMentionSuggestions(false);
      setMentionQuery('');
    }
  }, []);

  /**
   * Insert mention into message
   */
  const handleInsertMention = useCallback(
    (username: string) => {
      const textarea = messageInputRef.current;
      if (!textarea) {
        return;
      }

      const currentValue = getValues('message') || '';
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = currentValue.substring(0, cursorPos);
      const textAfterCursor = currentValue.substring(cursorPos);

      // Replace the @query with @username
      const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
      if (mentionMatch) {
        const beforeMention = textBeforeCursor.substring(0, mentionMatch.index);
        const newValue = `${beforeMention}@${username} ${textAfterCursor}`;
        setValue('message', newValue, { shouldDirty: true });
        setShowMentionSuggestions(false);
        setMentionQuery('');

        // Restore focus
        setTimeout(() => {
          textarea.focus();
          const newCursorPos = beforeMention.length + username.length + 2;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      }
    },
    [getValues, setValue]
  );

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (but not from textarea - that should insert newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      const target = e.target as HTMLElement;
      // Don't submit if Enter is pressed in a textarea
      if (target.tagName === 'TEXTAREA') {
        return;
      }
      // Submit form if Enter is pressed elsewhere
      e.preventDefault();
      void onSubmit();
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Paper
      elevation={2}
      sx={{ p: 3 }}
      component="form"
      onSubmit={onSubmit}
      onKeyDown={handleKeyDown}
      noValidate
      aria-label={
        isNewDiscussion
          ? 'Create new discussion form'
          : isEditing
            ? 'Edit post form'
            : 'Reply to post form'
      }
    >
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" component="h2">
          {isNewDiscussion
            ? 'Create New Discussion'
            : isEditing
              ? 'Edit Post'
              : 'Reply to Discussion'}
        </Typography>
      </Box>

      {/* Reply context */}
      {parentPost && isReplying && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Replying to{parentPost.author ? ` ${parentPost.author}` : ''}:
          </Typography>
          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
            {parentPost.message.substring(0, 200)}
            {parentPost.message.length > 200 && '...'}
          </Typography>
        </Paper>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setValidationErrors([])}
          aria-label="Form has errors"
        >
          <Typography variant="subtitle2" gutterBottom>
            Please fix the following errors:
          </Typography>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* React Hook Form validation errors summary */}
      {Object.keys(errors).length > 1 && (
        <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-label="Form has errors">
          <Typography variant="subtitle2" gutterBottom>
            Please fix the following errors:
          </Typography>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            {Object.keys(errors).map((field) => (
              <li key={field}>
                {field === 'subject' ? 'Subject' : field === 'message' ? 'Message body' : field}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Network error */}
      {networkError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setNetworkError(null)}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setNetworkError(null);
                void onSubmit();
              }}
            >
              Retry
            </Button>
          }
        >
          {networkError}
        </Alert>
      )}

      {/* Concurrent edit error */}
      {concurrentEditError && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          onClose={() => setConcurrentEditError(false)}
          action={
            <Button color="inherit" size="small" onClick={() => window.location.reload()}>
              Reload latest version
            </Button>
          }
        >
          Post has been modified by another user
        </Alert>
      )}

      {/* Preview mode */}
      {isPreviewMode ? (
        <Box>
          <Typography variant="h6" gutterBottom>
            Preview Mode
          </Typography>
          <Paper
            variant="outlined"
            sx={{ p: 3, mb: 2, minHeight: 200 }}
            data-testid="message-preview"
          >
            {isNewDiscussion && (
              <Typography variant="h6" gutterBottom>
                {formData.subject}
              </Typography>
            )}
            <Typography
              variant="body1"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              dangerouslySetInnerHTML={{ __html: formData.message }}
            />
            {files.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Attachments:
                </Typography>
                {files.map((file) => (
                  <Chip key={file.id} label={file.name} size="small" sx={{ mr: 1, mb: 1 }} />
                ))}
              </Box>
            )}
          </Paper>
          <Button
            variant="outlined"
            startIcon={<CloseIcon />}
            onClick={handleTogglePreview}
            fullWidth
          >
            Edit
          </Button>
        </Box>
      ) : (
        <>
          {/* Subject field (new discussions only) */}
          {isNewDiscussion && (
            <Controller
              name="subject"
              control={control}
              rules={{
                required: 'Subject is required',
                minLength: {
                  value: SUBJECT_MIN_LENGTH,
                  message: `Subject must be at least ${SUBJECT_MIN_LENGTH} characters`,
                },
                maxLength: {
                  value: SUBJECT_MAX_LENGTH,
                  message: `Subject must not exceed ${SUBJECT_MAX_LENGTH} characters`,
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Subject"
                  required
                  disabled={isSubmitting}
                  error={!!errors.subject}
                  helperText={
                    errors.subject?.message ??
                    `${field.value?.length ?? 0} / ${SUBJECT_MAX_LENGTH} characters`
                  }
                  sx={{ mb: 2 }}
                  inputProps={{
                    'aria-label': 'Discussion subject',
                    'aria-required': 'true',
                    maxLength: SUBJECT_MAX_LENGTH,
                  }}
                  FormHelperTextProps={{
                    role: errors.subject ? 'alert' : undefined,
                    'aria-live': errors.subject ? 'polite' : undefined,
                  }}
                />
              )}
            />
          )}

          {/* Message field */}
          <Controller
            name="message"
            control={control}
            rules={{
              required: 'Message is required',
              minLength: {
                value: MESSAGE_MIN_LENGTH,
                message: `Message must be at least ${MESSAGE_MIN_LENGTH} characters`,
              },
              maxLength: {
                value: MESSAGE_MAX_LENGTH,
                message: `Message must not exceed ${MESSAGE_MAX_LENGTH} characters`,
              },
            }}
            render={({ field }) => (
              <>
                {/* Rich text editor toolbar */}
                <Box
                  sx={{
                    display: 'flex',
                    gap: 0.5,
                    mb: 1,
                    p: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '4px 4px 0 0',
                    bgcolor: 'grey.50',
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={handleBold}
                    disabled={isSubmitting}
                    title="Bold"
                    aria-label="bold"
                    tabIndex={-1}
                  >
                    <FormatBoldIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleItalic}
                    disabled={isSubmitting}
                    title="Italic"
                    aria-label="italic"
                    tabIndex={-1}
                  >
                    <FormatItalicIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleInsertLink}
                    disabled={isSubmitting}
                    title="Insert link"
                    aria-label="insert link"
                    tabIndex={-1}
                  >
                    <InsertLinkIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleBulletList}
                    disabled={isSubmitting}
                    title="Bullet list"
                    aria-label="bullet list"
                    tabIndex={-1}
                  >
                    <FormatListBulletedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleEmojiToggle}
                    disabled={isSubmitting}
                    title="Insert emoji"
                    aria-label="Insert emoji"
                    tabIndex={-1}
                  >
                    <EmojiEmotionsIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Emoji picker dropdown */}
                {showEmojiPicker && (
                  <Box
                    role="dialog"
                    aria-label="Emoji picker"
                    sx={{
                      position: 'absolute',
                      zIndex: 10,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 1,
                      boxShadow: 2,
                      display: 'flex',
                      gap: 0.5,
                      flexWrap: 'wrap',
                      maxWidth: 300,
                    }}
                  >
                    {[
                      '😀',
                      '😁',
                      '😂',
                      '🤣',
                      '😃',
                      '😄',
                      '😅',
                      '😆',
                      '😉',
                      '😊',
                      '😋',
                      '😎',
                      '😍',
                      '😘',
                      '🥰',
                      '😗',
                      '🤗',
                      '🤔',
                      '🤨',
                      '😐',
                      '😑',
                      '😶',
                      '🙄',
                      '😏',
                      '😣',
                      '😥',
                      '😮',
                      '🤐',
                      '😯',
                      '😪',
                      '😫',
                      '🥱',
                      '😴',
                    ].map((emoji) => (
                      <Button
                        key={emoji}
                        size="small"
                        onClick={() => handleEmojiSelect(emoji)}
                        sx={{ minWidth: 'auto', p: 0.5 }}
                      >
                        {emoji}
                      </Button>
                    ))}
                    <IconButton
                      size="small"
                      onClick={() => setShowEmojiPicker(false)}
                      sx={{ ml: 'auto' }}
                      aria-label="Close emoji picker"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}

                {/* Mention suggestions dropdown */}
                {showMentionSuggestions && mentionQuery !== '' && (
                  <Box
                    role="listbox"
                    aria-label="User suggestions"
                    sx={{
                      position: 'absolute',
                      zIndex: 10,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      boxShadow: 2,
                      maxWidth: 300,
                    }}
                  >
                    {[
                      { username: 'johndoe', displayName: 'john doe' },
                      { username: 'janesmith', displayName: 'jane smith' },
                      { username: 'adminuser', displayName: 'admin user' },
                    ]
                      .filter((user) =>
                        user.username.toLowerCase().includes(mentionQuery.toLowerCase())
                      )
                      .map((user) => (
                        <Button
                          key={user.username}
                          fullWidth
                          onClick={() => handleInsertMention(user.username)}
                          sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                          role="option"
                        >
                          {user.displayName}
                        </Button>
                      ))}
                  </Box>
                )}

                <TextField
                  {...field}
                  inputRef={messageInputRef}
                  fullWidth
                  multiline
                  minRows={6}
                  maxRows={20}
                  label="Message body"
                  required
                  disabled={isSubmitting}
                  error={!!errors.message}
                  helperText={
                    errors.message?.message ??
                    `${field.value?.length ?? 0} / ${MESSAGE_MAX_LENGTH} characters`
                  }
                  onChange={(e) => {
                    field.onChange(e);
                    handleMessageChange(e.target.value);
                  }}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '0 0 4px 4px',
                    },
                  }}
                  inputProps={{
                    'aria-label': 'Message body',
                    'aria-required': 'true',
                    maxLength: MESSAGE_MAX_LENGTH,
                  }}
                  FormHelperTextProps={{
                    role: errors.message ? 'alert' : undefined,
                    'aria-live': errors.message ? 'polite' : undefined,
                  }}
                />
              </>
            )}
          />

          {/* File attachments */}
          <Box sx={{ mb: 2 }}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
              aria-label="File input"
              data-testid="attachment-upload"
            />

            <Box
              onDrop={handleFileDrop}
              onDragOver={handleDragOver}
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                p: 3,
                textAlign: 'center',
                bgcolor: 'grey.50',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'grey.100',
                },
              }}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Drag and drop files or click to select"
            >
              <AttachFileIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Drag and drop files here or click to select
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Maximum 5 files, 10MB each
              </Typography>
            </Box>

            {/* File list */}
            {files.length > 0 && (
              <Box sx={{ mt: 2 }}>
                {files.map((file) => (
                  <Paper key={file.id} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {previewUrls[file.id] ? (
                        <Box
                          component="img"
                          src={previewUrls[file.id]}
                          alt={file.name}
                          sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1 }}
                        />
                      ) : (
                        <AttachFileIcon />
                      )}
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {file.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(file.size)}
                        </Typography>
                        {file.progress !== undefined && file.progress > 0 && file.progress < 100 && (
                          <LinearProgress variant="determinate" value={file.progress} />
                        )}
                        {file.error && (
                          <Typography variant="caption" color="error">
                            {file.error}
                          </Typography>
                        )}
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.id);
                        }}
                        aria-label={`Remove ${file.name}`}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Paper>
                ))}
                <Typography variant="caption" color="text.secondary">
                  Total size: {formatFileSize(totalSize)}
                </Typography>
              </Box>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Subscription options */}
          <Box sx={{ mb: 2 }}>
            <Controller
              name="subscribe"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      {...field}
                      checked={field.value}
                      inputProps={{ 'aria-label': 'Subscribe to this discussion' }}
                    />
                  }
                  label="Subscribe to this discussion"
                />
              )}
            />

            <Controller
              name="emailNotification"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                  <InputLabel id="email-notification-label">Email Notifications</InputLabel>
                  <Select
                    {...field}
                    labelId="email-notification-label"
                    label="Email Notifications"
                    inputProps={{ 'aria-label': 'Email notification preference' }}
                  >
                    <MenuItem value="none">No email notifications</MenuItem>
                    <MenuItem value="digest">Daily digest</MenuItem>
                    <MenuItem value="immediate">Immediate notifications</MenuItem>
                  </Select>
                  <FormHelperText>Choose how you want to receive updates</FormHelperText>
                </FormControl>
              )}
            />
          </Box>

          {/* Tags (if supported) */}
          {supportsTags && availableTags.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Controller
                name="tags"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel id="tags-label">Tags</InputLabel>
                    <Select
                      {...field}
                      labelId="tags-label"
                      label="Tags"
                      multiple
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => (
                            <Chip key={value} label={value} size="small" />
                          ))}
                        </Box>
                      )}
                      inputProps={{ 'aria-label': 'Discussion tags' }}
                    >
                      {availableTags.map((tag) => (
                        <MenuItem key={tag} value={tag}>
                          {tag}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Box>
          )}

          {/* Moderator options (new discussions only) */}
          {canModerate && isNewDiscussion && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Moderator Options
              </Typography>
              <Controller
                name="pinned"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...field}
                        checked={field.value}
                        inputProps={{ 'aria-label': 'Pin discussion' }}
                      />
                    }
                    label="Pin discussion"
                  />
                )}
              />
              <Controller
                name="locked"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...field}
                        checked={field.value}
                        inputProps={{ 'aria-label': 'Lock discussion' }}
                      />
                    }
                    label="Lock discussion"
                  />
                )}
              />
            </Box>
          )}

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SendIcon />}
              disabled={isSubmitting}
              aria-label={
                isSubmitting
                  ? 'Posting'
                  : isEditing
                    ? 'Update post'
                    : isReplying
                      ? 'Post reply'
                      : 'Post discussion'
              }
            >
              {isSubmitting
                ? 'Posting...'
                : isEditing
                  ? 'Update Post'
                  : isReplying
                    ? 'Post Reply'
                    : 'Post Discussion'}
            </Button>

            <Button
              variant="outlined"
              startIcon={<PreviewIcon />}
              onClick={handleTogglePreview}
              disabled={isSubmitting}
              aria-label="Preview message"
            >
              Preview
            </Button>

            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              aria-label="Save draft"
            >
              Save Draft
            </Button>

            {lastSavedAt && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                Draft saved
              </Typography>
            )}

            {onCancel && (
              <Button
                variant="text"
                onClick={handleCancel}
                disabled={isSubmitting}
                aria-label="Cancel"
              >
                Cancel
              </Button>
            )}
          </Box>
        </>
      )}

      {/* Unsaved changes warning dialog */}
      <Dialog
        open={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        aria-labelledby="unsaved-warning-title"
      >
        <DialogTitle id="unsaved-warning-title">Unsaved Changes</DialogTitle>
        <DialogContent>
          <Typography>
            You have unsaved changes. Are you sure you want to cancel without saving?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUnsavedWarning(false)}>Keep editing</Button>
          <Button onClick={handleConfirmCancel} color="error">
            Discard changes
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
