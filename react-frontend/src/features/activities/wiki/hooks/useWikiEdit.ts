/**
 * Custom React hook for managing wiki page editing operations
 *
 * This hook encapsulates all wiki page editing logic including:
 * - Saving wiki content with optimistic updates
 * - Previewing changes before saving
 * - Canceling edits with confirmation
 * - Auto-saving draft content to localStorage
 * - Integration with page lock system
 * - Form validation and error handling
 *
 * @packageDocumentation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import useDebounce from '@/hooks/useDebounce';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useWikiLock } from './useWikiLock';
import { saveWikiPage, previewWikiPage } from '../api/wikiApi';
import type {
  WikiFormat,
  WikiPage,
  WikiSaveRequest,
  WikiPreviewResponse,
  WikiValidationError,
} from '../types/wiki.types';

/**
 * Parameters for the useWikiEdit hook
 */
interface UseWikiEditParams {
  /** The ID of the wiki page being edited */
  pageId: number;
  /** Initial content to populate the editor */
  initialContent: string;
  /** Content format (html, creole, nwiki) */
  contentFormat: WikiFormat;
}

/**
 * Edit state tracking
 */
interface EditState {
  /** Whether content has been modified from initial state */
  isDirty: boolean;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Timestamp of last successful save */
  lastSaved: Date | null;
  /** Current content being edited */
  currentContent: string;
}

/**
 * Validation result
 */
interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Validation errors if any */
  errors: WikiValidationError[];
}

/**
 * Return type for the useWikiEdit hook
 */
interface UseWikiEditReturn {
  /** Function to save the current page content */
  savePage: () => Promise<void>;
  /** Function to preview changes without saving */
  previewPage: () => Promise<WikiPreviewResponse>;
  /** Function to cancel editing and return to view */
  cancelEdit: () => Promise<void>;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Whether a preview operation is in progress */
  isPreviewing: boolean;
  /** Current edit state */
  editState: EditState;
  /** Draft content from localStorage */
  draftContent: string;
  /** Function to clear draft from localStorage */
  clearDraft: () => void;
  /** Function to update current content */
  updateContent: (content: string) => void;
  /** Function to validate current content */
  validate: () => ValidationResult;
}

/**
 * Content length limits for validation
 */
const CONTENT_LIMITS = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 1000000, // 1MB of text
  MAX_TITLE_LENGTH: 255,
} as const;

/**
 * Auto-save interval in milliseconds
 */
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

/**
 * Custom hook for managing wiki page editing operations
 *
 * Provides comprehensive wiki editing functionality including save, preview, cancel,
 * auto-save to localStorage, validation, and integration with the page lock system.
 *
 * @param params - Configuration parameters for the edit session
 * @returns Object containing edit functions and state
 *
 * @example
 * ```tsx
 * const {
 *   savePage,
 *   previewPage,
 *   cancelEdit,
 *   isSaving,
 *   editState,
 *   updateContent
 * } = useWikiEdit({
 *   pageId: 123,
 *   initialContent: '<p>Initial content</p>',
 *   contentFormat: 'html'
 * });
 * ```
 */
export function useWikiEdit({
  pageId,
  initialContent,
  contentFormat,
}: UseWikiEditParams): UseWikiEditReturn {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State management
  const [currentContent, setCurrentContent] = useState<string>(initialContent);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Track initial content to detect changes
  const initialContentRef = useRef<string>(initialContent);

  // localStorage key for draft content
  const draftKey = `wiki-draft-${pageId}`;

  // Auto-save to localStorage
  const [draftContent, setDraftContent, clearDraft] = useLocalStorage<string>(
    draftKey,
    initialContent
  );

  // Debounce content updates for auto-save
  const debouncedContent = useDebounce(currentContent, AUTO_SAVE_INTERVAL);

  // Page lock integration
  const { acquireLock, releaseLock, hasLock } = useWikiLock({ pageId });

  // Auto-save effect
  useEffect(() => {
    if (debouncedContent !== initialContentRef.current && hasLock) {
      setDraftContent(debouncedContent);
    }
  }, [debouncedContent, setDraftContent, hasLock]);

  // Track dirty state
  useEffect(() => {
    const contentChanged = currentContent !== initialContentRef.current;
    setIsDirty(contentChanged);
    setHasUnsavedChanges(contentChanged);
  }, [currentContent]);

  // Acquire lock when component mounts
  useEffect(() => {
    void acquireLock();

    // Cleanup: release lock on unmount
    return () => {
      void releaseLock();
    };
  }, [acquireLock, releaseLock]);

  /**
   * Validate wiki content before saving
   *
   * Checks:
   * - Content is not empty
   * - Content length is within limits
   * - Required fields are present
   *
   * @returns Validation result with errors if any
   */
  const validate = useCallback(
    (content?: string): ValidationResult => {
      const errors: WikiValidationError[] = [];
      const contentToValidate = content ?? currentContent;

      // Check if content is empty
      const trimmedContent = contentToValidate.trim();
      if (trimmedContent.length < CONTENT_LIMITS.MIN_LENGTH) {
        errors.push({
          field: 'content',
          message: 'Content cannot be empty',
          code: 'CONTENT_REQUIRED',
        });
      }

      // Check content length
      if (contentToValidate.length > CONTENT_LIMITS.MAX_LENGTH) {
        errors.push({
          field: 'content',
          message: `Content exceeds maximum length of ${CONTENT_LIMITS.MAX_LENGTH} characters`,
          code: 'CONTENT_TOO_LONG',
        });
      }

      // Check if content format is valid
      const validFormats: WikiFormat[] = ['html', 'creole', 'nwiki'];
      if (!validFormats.includes(contentFormat)) {
        errors.push({
          field: 'contentFormat',
          message: 'Invalid content format',
          code: 'INVALID_FORMAT',
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    },
    [currentContent, contentFormat]
  );

  /**
   * Save wiki page mutation
   *
   * Sends save request to API and handles success/error states
   */
  const saveMutation = useMutation({
    mutationFn: async (data: WikiSaveRequest) => {
      return saveWikiPage(pageId, data);
    },
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['wiki', 'page', pageId] });

      // Snapshot the previous value
      const previousPage = queryClient.getQueryData<WikiPage>(['wiki', 'page', pageId]);

      // Optimistically update the cache
      queryClient.setQueryData<WikiPage>(['wiki', 'page', pageId], (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          content: data.content,
          timemodified: Date.now() / 1000,
        };
      });

      return { previousPage };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousPage) {
        queryClient.setQueryData(['wiki', 'page', pageId], context.previousPage);
      }
    },
    onSuccess: (_data) => {
      // Update state on successful save
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      setIsDirty(false);

      // Update initial content reference
      initialContentRef.current = currentContent;

      // Clear draft from localStorage
      clearDraft();

      // Invalidate queries to refetch fresh data
      void queryClient.invalidateQueries({ queryKey: ['wiki', 'page', pageId] });
      void queryClient.invalidateQueries({ queryKey: ['wiki', 'pages'] });
      void queryClient.invalidateQueries({ queryKey: ['wiki', 'history', pageId] });
    },
  });

  /**
   * Preview wiki page mutation
   *
   * Renders preview of content without saving
   */
  const previewMutation = useMutation({
    mutationFn: async () => {
      return previewWikiPage(pageId, {
        content: currentContent,
        contentFormat,
      });
    },
  });

  /**
   * Update content and track changes
   *
   * @param content - New content value
   */
  const updateContent = useCallback((content: string) => {
    setCurrentContent(content);
  }, []);

  /**
   * Save the current wiki page content
   *
   * Validates content, checks for page lock, calls save API,
   * and navigates to view page on success
   *
   * @throws Error if validation fails or lock is not held
   */
  const savePage = useCallback(async () => {
    // Validate content
    const validationResult = validate();
    if (!validationResult.isValid) {
      const errorMessage = validationResult.errors.map((e) => e.message).join(', ');
      throw new Error(`Validation failed: ${errorMessage}`);
    }

    // Check if we have the lock
    if (!hasLock) {
      throw new Error('Cannot save: page lock not held. Another user may be editing this page.');
    }

    // Perform save
    await saveMutation.mutateAsync({
      content: currentContent,
      contentFormat,
    });

    // Release lock after successful save
    await releaseLock();

    // Navigate to view page
    navigate(`/wiki/${pageId}`);
  }, [
    validate,
    hasLock,
    currentContent,
    contentFormat,
    saveMutation,
    releaseLock,
    navigate,
    pageId,
  ]);

  /**
   * Preview changes without saving
   *
   * Renders a preview of the current content to show
   * how it will appear after saving
   *
   * @returns Promise resolving to preview HTML
   */
  const previewPage = useCallback(async (): Promise<WikiPreviewResponse> => {
    const result = await previewMutation.mutateAsync();
    return result;
  }, [previewMutation]);

  /**
   * Cancel editing and return to view page
   *
   * Prompts for confirmation if there are unsaved changes,
   * releases the page lock, and navigates back to view
   */
  const cancelEdit = useCallback(async () => {
    // Check for unsaved changes
    if (hasUnsavedChanges) {
      const confirmMessage =
        'You have unsaved changes. Are you sure you want to cancel editing? All changes will be lost.';

      const confirmed = window.confirm(confirmMessage);

      if (!confirmed) {
        return;
      }
    }

    try {
      // Release the page lock
      await releaseLock();

      // Clear draft from localStorage
      clearDraft();

      // Navigate back to view page
      navigate(`/wiki/${pageId}`);
    } catch (error) {
      // Even if lock release fails, navigate away
      console.error('Error releasing lock:', error);
      navigate(`/wiki/${pageId}`);
    }
  }, [hasUnsavedChanges, releaseLock, clearDraft, navigate, pageId]);

  // Edit state object
  const editState: EditState = {
    isDirty,
    hasUnsavedChanges,
    lastSaved,
    currentContent,
  };

  return {
    savePage,
    previewPage,
    cancelEdit,
    isSaving: saveMutation.isPending,
    isPreviewing: previewMutation.isPending,
    editState,
    draftContent,
    clearDraft,
    updateContent,
    validate,
  };
}
