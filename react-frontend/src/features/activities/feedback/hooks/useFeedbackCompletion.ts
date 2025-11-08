/**
 * Custom React Query hook for managing feedback completion state and multi-page navigation.
 * 
 * This hook provides comprehensive feedback completion management including:
 * - Fetching completion data (current page, completed pages, draft responses, submission status)
 * - Page navigation with validation (next/previous page with strict checking)
 * - Draft response saving for unfinished attempts
 * - Final submission handling
 * - State synchronization with server
 * 
 * Wraps GET /api/v1/feedback/{id}/completion endpoint that calls existing Moodle
 * mod_feedback_completion class methods without duplicating business logic.
 * 
 * @module useFeedbackCompletion
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';

/**
 * Represents a single item/question in the feedback
 */
interface FeedbackItem {
  id: number;
  typ: string;
  name: string;
  label: string;
  presentation: string;
  required: boolean;
  hasvalue: boolean;
  position: number;
  dependitem: number | null;
  dependvalue: string | null;
}

/**
 * Represents a page of feedback items
 */
interface FeedbackPage {
  pageIndex: number;
  items: FeedbackItem[];
  hasValueItems: boolean;
}

/**
 * Represents a draft response for an item
 */
interface DraftResponse {
  itemId: number;
  value: string;
  timeModified: number;
}

/**
 * Represents temporary completion record for unfinished attempts
 */
interface CompletedTmp {
  id: number;
  feedbackId: number;
  courseId: number | null;
  userId: number | null;
  guestId: string | null;
  timeModified: number;
  anonymousResponse: number;
}

/**
 * Represents completed feedback submission
 */
interface CompletedRecord {
  id: number;
  feedbackId: number;
  courseId: number;
  userId: number;
  timeModified: number;
  anonymousResponse: number;
}

/**
 * Complete feedback completion state returned by the API
 */
interface FeedbackCompletionData {
  feedbackId: number;
  courseId: number | null;
  currentPage: number;
  totalPages: number;
  pages: FeedbackPage[];
  completedPages: number[];
  incompletedPages: number[];
  lastCompletedPage: number | null;
  firstIncompletedPage: number | null;
  resumePage: number;
  draftResponses: DraftResponse[];
  completedTmp: CompletedTmp | null;
  completed: CompletedRecord | null;
  isCompleted: boolean;
  isAlreadySubmitted: boolean;
  canComplete: boolean;
  canSubmit: boolean;
  isOpen: boolean;
  isEmpty: boolean;
  isAnonymous: boolean;
  multipleSubmit: boolean;
  justCompleted: boolean;
}

/**
 * Request payload for saving draft responses
 */
interface SaveDraftRequest {
  feedbackId: number;
  page: number;
  responses: Record<string, string>;
}

/**
 * Request payload for submitting feedback
 */
interface SubmitFeedbackRequest {
  feedbackId: number;
  page: number;
  responses: Record<string, string>;
}

/**
 * Page navigation options
 */
interface NavigationOptions {
  strictCheck?: boolean;
  validateRequired?: boolean;
}

/**
 * Response from API operations
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Error response structure for failed HTTP requests
 */
interface ErrorResponse {
  error?: {
    message?: string;
  };
}

/**
 * Hook return type with all completion management functions
 */
interface UseFeedbackCompletionReturn {
  // Query state
  completionData: FeedbackCompletionData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  
  // Navigation functions
  goToNextPage: (options?: NavigationOptions) => number | null;
  goToPreviousPage: (options?: NavigationOptions) => number | null;
  goToPage: (pageIndex: number) => number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  
  // Response management
  saveDraft: (responses: Record<string, string>) => Promise<void>;
  submitFeedback: (responses: Record<string, string>) => Promise<void>;
  isSavingDraft: boolean;
  isSubmitting: boolean;
  
  // State helpers
  getCurrentPageItems: () => FeedbackItem[];
  getPageCompletionStatus: (pageIndex: number) => 'completed' | 'incompleted' | 'empty';
  getDraftResponseForItem: (itemId: number) => string | null;
  isPageValid: (pageIndex: number) => boolean;
  
  // Refresh function
  refetch: () => Promise<void>;
}

/**
 * Custom React Query hook for managing feedback completion state and multi-page navigation.
 * 
 * This hook handles:
 * - Fetching and caching completion data from the server
 * - Managing page navigation with validation
 * - Saving draft responses as users progress through pages
 * - Final feedback submission
 * - Optimistic updates for better UX
 * 
 * @param feedbackId - The ID of the feedback activity
 * @param options - Optional configuration for the hook
 * @returns Object containing completion data and management functions
 * 
 * @example
 * ```tsx
 * const {
 *   completionData,
 *   isLoading,
 *   goToNextPage,
 *   saveDraft,
 *   submitFeedback,
 * } = useFeedbackCompletion(feedbackId);
 * 
 * // Navigate to next page after saving draft
 * await saveDraft({ 'item_123': 'response value' });
 * await goToNextPage();
 * ```
 */
export function useFeedbackCompletion(
  feedbackId: number,
  options: {
    enabled?: boolean;
    refetchOnWindowFocus?: boolean;
    staleTime?: number;
  } = {}
): UseFeedbackCompletionReturn {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState<number>(0);

  // Query key for React Query caching
  const queryKey = useMemo(
    () => ['feedback', feedbackId, 'completion', currentPage],
    [feedbackId, currentPage]
  );

  /**
   * Fetch completion data from the API
   * Calls GET /api/v1/feedback/{id}/completion?page={page}
   */
  const {
    data: completionData,
    isLoading,
    isError,
    error,
    refetch: refetchQuery,
  } = useQuery<FeedbackCompletionData, Error>({
    queryKey,
    queryFn: async (): Promise<FeedbackCompletionData> => {
      const response = await fetch(
        `/api/v1/feedback/${feedbackId}/completion?page=${currentPage}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = (await response.json()) as ErrorResponse;
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch {
          // If parsing fails, use default error message
        }
        throw new Error(errorMessage);
      }

      const result = (await response.json()) as ApiResponse<FeedbackCompletionData>;
      
      if (!result.success) {
        throw new Error(result.error?.message ?? 'Failed to fetch completion data');
      }

      return result.data;
    },
    enabled: options.enabled !== false && feedbackId > 0,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
    staleTime: options.staleTime ?? 5 * 60 * 1000, // 5 minutes default
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  /**
   * Mutation for saving draft responses
   * Calls POST /api/v1/feedback/{id}/completion/save-draft
   */
  const saveDraftMutation = useMutation<
    ApiResponse<{ saved: boolean; timeModified: number }>,
    Error,
    SaveDraftRequest
  >({
    mutationFn: async (request: SaveDraftRequest) => {
      const response = await fetch(
        `/api/v1/feedback/${feedbackId}/completion/save-draft`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            page: request.page,
            responses: request.responses,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = (await response.json()) as ErrorResponse;
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch {
          // If parsing fails, use default error message
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate completion query to refetch updated data
      void queryClient.invalidateQueries({ queryKey: ['feedback', feedbackId, 'completion'] });
    },
    onError: (error: Error) => {
      console.error('Failed to save draft:', error);
    },
  });

  /**
   * Mutation for submitting feedback
   * Calls POST /api/v1/feedback/{id}/completion/submit
   */
  const submitMutation = useMutation<
    ApiResponse<{ completedId: number; timeModified: number }>,
    Error,
    SubmitFeedbackRequest
  >({
    mutationFn: async (request: SubmitFeedbackRequest) => {
      const response = await fetch(
        `/api/v1/feedback/${feedbackId}/completion/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            page: request.page,
            responses: request.responses,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate all feedback-related queries
      void queryClient.invalidateQueries({ queryKey: ['feedback', feedbackId] });
    },
    onError: (error: Error) => {
      console.error('Failed to submit feedback:', error);
    },
  });

  /**
   * Navigate to the next page with validation
   * 
   * @param options - Navigation options including strict check flag
   * @returns Next page index or null if no next page
   */
  const goToNextPage = useCallback(
    (options: NavigationOptions = {}): number | null => {
      if (!completionData) {
        throw new Error('Completion data not loaded');
      }

      const { strictCheck = true } = options;

      // Calculate next page based on completion data
      let nextPage: number | null = null;

      if (strictCheck) {
        // Check if there are incomplete pages before the current page
        const { firstIncompletedPage } = completionData;
        if (firstIncompletedPage !== null && firstIncompletedPage <= currentPage) {
          nextPage = firstIncompletedPage;
        }
      }

      if (nextPage === null) {
        // Find next page with items
        const {pages} = completionData;
        for (let i = currentPage + 1; i < pages.length; i++) {
          const page = pages[i];
          if (page && page.items.length > 0) {
            nextPage = i;
            break;
          }
        }
      }

      if (nextPage !== null) {
        setCurrentPage(nextPage);
        return nextPage;
      }

      return null;
    },
    [completionData, currentPage]
  );

  /**
   * Navigate to the previous page with validation
   * 
   * @param options - Navigation options including strict check flag
   * @returns Previous page index or null if no previous page
   */
  const goToPreviousPage = useCallback(
    (options: NavigationOptions = {}): number | null => {
      if (!completionData) {
        throw new Error('Completion data not loaded');
      }

      if (currentPage === 0) {
        return null;
      }

      const { strictCheck = true } = options;
      const {pages} = completionData;
      let previousPage: number | null = null;

      // Find previous page with items
      for (let i = currentPage - 1; i >= 0; i--) {
        const page = pages[i];
        if (page && page.items.length > 0) {
          previousPage = i;
          break;
        }
      }

      if (previousPage === null) {
        return null;
      }

      if (previousPage > 0 && strictCheck) {
        // Check if this page is not past the first incompleted page
        const { firstIncompletedPage } = completionData;
        if (firstIncompletedPage !== null && firstIncompletedPage < previousPage) {
          previousPage = firstIncompletedPage;
        }
      }

      setCurrentPage(previousPage);
      return previousPage;
    },
    [completionData, currentPage]
  );

  /**
   * Navigate directly to a specific page
   * 
   * @param pageIndex - The target page index
   * @returns The page index
   */
  const goToPage = useCallback(
    (pageIndex: number): number => {
      if (!completionData) {
        throw new Error('Completion data not loaded');
      }

      if (pageIndex < 0 || pageIndex >= completionData.totalPages) {
        throw new Error(`Invalid page index: ${pageIndex}`);
      }

      setCurrentPage(pageIndex);
      return pageIndex;
    },
    [completionData]
  );

  /**
   * Save draft responses for the current page
   * 
   * @param responses - Map of item keys to response values
   * @returns Promise that resolves when draft is saved
   */
  const saveDraft = useCallback(
    async (responses: Record<string, string>): Promise<void> => {
      await saveDraftMutation.mutateAsync({
        feedbackId,
        page: currentPage,
        responses,
      });
    },
    [feedbackId, currentPage, saveDraftMutation]
  );

  /**
   * Submit the feedback (final submission)
   * 
   * @param responses - Map of item keys to response values for the last page
   * @returns Promise that resolves when feedback is submitted
   */
  const submitFeedback = useCallback(
    async (responses: Record<string, string>): Promise<void> => {
      await submitMutation.mutateAsync({
        feedbackId,
        page: currentPage,
        responses,
      });
    },
    [feedbackId, currentPage, submitMutation]
  );

  /**
   * Get items for the current page
   * 
   * @returns Array of feedback items on the current page
   */
  const getCurrentPageItems = useCallback((): FeedbackItem[] => {
    if (!completionData?.pages[currentPage]) {
      return [];
    }
    return completionData.pages[currentPage].items;
  }, [completionData, currentPage]);

  /**
   * Get completion status for a specific page
   * 
   * @param pageIndex - The page index to check
   * @returns Completion status: 'completed', 'incompleted', or 'empty'
   */
  const getPageCompletionStatus = useCallback(
    (pageIndex: number): 'completed' | 'incompleted' | 'empty' => {
      if (!completionData) {
        return 'empty';
      }

      if (completionData.completedPages.includes(pageIndex)) {
        return 'completed';
      }

      if (completionData.incompletedPages.includes(pageIndex)) {
        return 'incompleted';
      }

      return 'empty';
    },
    [completionData]
  );

  /**
   * Get draft response value for a specific item
   * 
   * @param itemId - The item ID to look up
   * @returns The draft response value or null if not found
   */
  const getDraftResponseForItem = useCallback(
    (itemId: number): string | null => {
      if (!completionData) {
        return null;
      }

      const draftResponse = completionData.draftResponses.find(
        (response) => response.itemId === itemId
      );

      return draftResponse?.value ?? null;
    },
    [completionData]
  );

  /**
   * Check if a page has all required items completed
   * 
   * @param pageIndex - The page index to validate
   * @returns True if page is valid (all required items answered)
   */
  const isPageValid = useCallback(
    (pageIndex: number): boolean => {
      if (!completionData?.pages[pageIndex]) {
        return false;
      }

      const page = completionData.pages[pageIndex];
      const requiredItems = page.items.filter((item) => item.required && item.hasvalue);

      // Check if all required items have draft responses
      return requiredItems.every((item) => {
        const draftValue = getDraftResponseForItem(item.id);
        return draftValue !== null && draftValue.trim() !== '';
      });
    },
    [completionData, getDraftResponseForItem]
  );

  /**
   * Check if user can navigate to next page
   */
  const canGoNext = useMemo(() => {
    if (!completionData) {
      return false;
    }

    // Check if there's a next page with items
    for (let i = currentPage + 1; i < completionData.pages.length; i++) {
      const page = completionData.pages[i];
      if (page && page.items.length > 0) {
        return true;
      }
    }

    return false;
  }, [completionData, currentPage]);

  /**
   * Check if user can navigate to previous page
   */
  const canGoPrevious = useMemo(() => {
    if (!completionData || currentPage === 0) {
      return false;
    }

    // Check if there's a previous page with items
    for (let i = currentPage - 1; i >= 0; i--) {
      const page = completionData.pages[i];
      if (page && page.items.length > 0) {
        return true;
      }
    }

    return false;
  }, [completionData, currentPage]);

  /**
   * Refetch completion data
   */
  const refetch = useCallback(async (): Promise<void> => {
    await refetchQuery();
  }, [refetchQuery]);

  return {
    // Query state
    completionData,
    isLoading,
    isError,
    error,

    // Navigation functions
    goToNextPage,
    goToPreviousPage,
    goToPage,
    canGoNext,
    canGoPrevious,

    // Response management
    saveDraft,
    submitFeedback,
    isSavingDraft: saveDraftMutation.isPending,
    isSubmitting: submitMutation.isPending,

    // State helpers
    getCurrentPageItems,
    getPageCompletionStatus,
    getDraftResponseForItem,
    isPageValid,

    // Refresh function
    refetch,
  };
}
