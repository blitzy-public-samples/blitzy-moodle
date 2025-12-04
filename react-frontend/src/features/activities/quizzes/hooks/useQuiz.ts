/**
 * Custom React Query Hook for Fetching Quiz Data
 *
 * This hook provides a comprehensive interface for fetching quiz details using
 * React Query's powerful caching, background refetching, and optimistic update
 * capabilities. It integrates with the backend API endpoint GET /api/v1/quizzes/{id}
 * which wraps existing Moodle quiz_settings::create_for_cmid() function.
 *
 * Key Features:
 * - Intelligent caching with configurable stale time (default: 5 minutes)
 * - Background refetching for fresh data
 * - Loading and error states
 * - Manual refetch capability
 * - Optional auto-refetch interval for real-time updates
 * - TypeScript strict mode with no 'any' types
 *
 * Backend Integration:
 * - Calls GET /api/v1/quizzes/{id} endpoint
 * - Wraps existing quiz_settings::create_for_cmid() from view.php
 * - Permission checks handled by backend via require_capability('mod/quiz:view')
 * - No business logic duplication - all quiz data comes from existing PHP functions
 *
 * @module features/activities/quizzes/hooks/useQuiz
 * @see public/mod/quiz/view.php - Original PHP implementation for quiz details
 * @see api/v1/quizzes/show.php - API endpoint that wraps PHP functions
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchQuizDetails } from '../api/quizApi';
import type { Quiz } from '../types/quiz.types';

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query key factory for quiz-related queries
 *
 * Using a factory pattern ensures consistent query keys across the application
 * and enables easy cache invalidation.
 */
export const quizQueryKeys = {
  /** Base key for all quiz queries */
  all: ['quiz'] as const,

  /** Key for a specific quiz by ID */
  detail: (quizId: number) => ['quiz', quizId] as const,
} as const;

// ============================================================================
// Hook Options and Result Interfaces
// ============================================================================

/**
 * Options for the useQuiz hook
 *
 * Allows customization of query behavior including conditional execution,
 * auto-refetch intervals, and success/error callbacks.
 */
export interface UseQuizOptions {
  /**
   * Whether the query should run automatically.
   * When set to false, the query will not execute until manually refetched.
   * @default true
   */
  enabled?: boolean;

  /**
   * Auto-refetch interval in milliseconds.
   * When set, the query will automatically refetch at the specified interval.
   * Useful for real-time updates during quiz monitoring.
   * Set to 0 or undefined to disable auto-refetching.
   * @example 30000 // Refetch every 30 seconds
   */
  refetchInterval?: number;

  /**
   * Callback function executed when quiz data is successfully fetched.
   * Receives the fetched Quiz object as a parameter.
   * @param data - The fetched quiz data
   */
  onSuccess?: (data: Quiz) => void;

  /**
   * Callback function executed when an error occurs during fetching.
   * Receives the Error object as a parameter.
   * @param error - The error that occurred
   */
  onError?: (error: Error) => void;
}

/**
 * Return type for the useQuiz hook
 *
 * Provides comprehensive access to quiz data, loading states, error information,
 * and refetch capability.
 */
export interface UseQuizResult {
  /**
   * The fetched quiz data, or undefined if not yet loaded or on error.
   * Contains all quiz settings and configuration from the Moodle quiz table.
   */
  quiz: Quiz | undefined;

  /**
   * Whether the query is in its initial loading state.
   * True when the query is fetching for the first time and has no cached data.
   */
  isLoading: boolean;

  /**
   * Whether the query is currently fetching data (including background refetches).
   * True during any fetch operation, including refetches and initial loads.
   */
  isFetching: boolean;

  /**
   * Whether the query encountered an error.
   * When true, the error property will contain the error details.
   */
  isError: boolean;

  /**
   * The error object if the query failed, null otherwise.
   * Contains error message and optional error code from the API.
   */
  error: Error | null;

  /**
   * Function to manually trigger a refetch of the quiz data.
   * Returns a promise that resolves when the refetch completes.
   * Useful for refreshing data after a mutation or user action.
   */
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for fetching and caching quiz data
 *
 * This hook provides a convenient way to fetch quiz details with automatic
 * caching, loading states, and error handling. It leverages React Query's
 * powerful caching mechanism to minimize unnecessary API calls while keeping
 * data fresh.
 *
 * Caching Behavior:
 * - Data is considered fresh for 5 minutes (staleTime)
 * - Stale data is returned while refetching in the background
 * - Cache entries are garbage collected after 30 minutes of inactivity (gcTime)
 * - Automatic retries on failure (3 attempts with exponential backoff)
 *
 * Permission Handling:
 * - All permission checks are performed on the backend
 * - Backend calls require_capability('mod/quiz:view') before returning data
 * - If user lacks permission, the API returns an error which is surfaced here
 *
 * @param quizId - The ID of the quiz to fetch. Must be a positive integer.
 * @param options - Optional configuration for the query behavior
 * @returns UseQuizResult containing quiz data, loading states, and utilities
 *
 * @example
 * Basic usage:
 * ```typescript
 * function QuizComponent({ quizId }: { quizId: number }) {
 *   const { quiz, isLoading, isError, error } = useQuiz(quizId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (isError) return <ErrorDisplay error={error} />;
 *   if (!quiz) return null;
 *
 *   return <QuizDetails quiz={quiz} />;
 * }
 * ```
 *
 * @example
 * With options:
 * ```typescript
 * function QuizMonitor({ quizId }: { quizId: number }) {
 *   const { quiz, isLoading, refetch } = useQuiz(quizId, {
 *     // Refetch every 30 seconds for real-time updates
 *     refetchInterval: 30000,
 *     onSuccess: (data) => {
 *       console.log('Quiz data updated:', data.name);
 *     },
 *     onError: (error) => {
 *       console.error('Failed to fetch quiz:', error.message);
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       {quiz && <QuizInfo quiz={quiz} />}
 *       <button onClick={() => refetch()}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * Conditional fetching:
 * ```typescript
 * function ConditionalQuiz({ quizId, shouldFetch }: Props) {
 *   const { quiz, isLoading } = useQuiz(quizId, {
 *     // Only fetch when shouldFetch is true
 *     enabled: shouldFetch && quizId > 0,
 *   });
 *
 *   // Hook won't fetch until conditions are met
 *   if (!shouldFetch) return <div>Select a quiz to view</div>;
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   return quiz ? <QuizDetails quiz={quiz} /> : null;
 * }
 * ```
 */
export function useQuiz(
  quizId: number,
  options?: UseQuizOptions
): UseQuizResult {
  // Destructure options with defaults
  const {
    enabled = true,
    refetchInterval,
    onSuccess,
    onError,
  } = options ?? {};

  // Track if callbacks have been invoked to prevent duplicate calls
  const successCalledRef = useRef(false);
  const errorCalledRef = useRef(false);
  const previousDataRef = useRef<Quiz | undefined>(undefined);
  const previousErrorRef = useRef<Error | null>(null);

  // Execute the query using React Query
  const queryResult = useQuery({
    // Unique query key for caching and invalidation
    queryKey: quizQueryKeys.detail(quizId),

    // Query function that fetches quiz details from the API
    queryFn: async (): Promise<Quiz> => {
      const response = await fetchQuizDetails(quizId);
      // Extract the quiz object from the response
      return response.quiz;
    },

    // Only enable the query if:
    // 1. quizId is a valid positive number
    // 2. enabled option is not explicitly set to false
    enabled: quizId > 0 && enabled !== false,

    // Data is considered fresh for 5 minutes
    // During this time, cached data is returned without refetching
    staleTime: 5 * 60 * 1000,

    // Keep inactive cache entries for 30 minutes before garbage collection
    // This allows quick navigation back to previously viewed quizzes
    gcTime: 30 * 60 * 1000,

    // Auto-refetch interval (when specified)
    // Useful for real-time monitoring of quiz status
    refetchInterval: refetchInterval && refetchInterval > 0 
      ? refetchInterval 
      : undefined,

    // Refetch when window regains focus (default React Query behavior)
    refetchOnWindowFocus: true,

    // Retry configuration with custom logic
    // Don't retry on client errors (4xx status codes like permission denied)
    retry: (failureCount: number, error: Error): boolean => {
      // Check if it's a client error (4xx status codes)
      const errorWithCode = error as Error & { code?: string };
      const isClientError = errorWithCode.code?.startsWith('4') ?? false;
      
      // Don't retry client errors
      if (isClientError) {
        return false;
      }
      
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },

    // Exponential backoff for retries
    retryDelay: (attemptIndex: number): number => {
      return Math.min(1000 * 2 ** attemptIndex, 30000);
    },
  });

  // Handle success callback using useEffect
  // React Query v5 removed onSuccess/onError options from useQuery
  // We implement callback behavior using effects to track state changes
  useEffect(() => {
    if (queryResult.isSuccess && queryResult.data && onSuccess) {
      // Check if data has changed to prevent duplicate callbacks
      if (previousDataRef.current !== queryResult.data) {
        previousDataRef.current = queryResult.data;
        onSuccess(queryResult.data);
      }
    }
  }, [queryResult.isSuccess, queryResult.data, onSuccess]);

  // Handle error callback using useEffect
  useEffect(() => {
    if (queryResult.isError && queryResult.error && onError) {
      // Check if error has changed to prevent duplicate callbacks
      if (previousErrorRef.current !== queryResult.error) {
        previousErrorRef.current = queryResult.error;
        onError(queryResult.error);
      }
    }
  }, [queryResult.isError, queryResult.error, onError]);

  // Reset tracking refs when quizId changes
  useEffect(() => {
    successCalledRef.current = false;
    errorCalledRef.current = false;
    previousDataRef.current = undefined;
    previousErrorRef.current = null;
  }, [quizId]);

  // Create the refetch function that returns a Promise<void>
  // Using useCallback to maintain stable reference
  const refetch = useCallback(async (): Promise<void> => {
    const result = await queryResult.refetch();
    
    // If refetch is successful and we have data, call onSuccess
    if (result.isSuccess && result.data && onSuccess) {
      onSuccess(result.data);
    }
    
    // If refetch failed, call onError
    if (result.isError && result.error && onError) {
      onError(result.error);
    }
  }, [queryResult, onSuccess, onError]);

  // Return the result object with proper typing
  return {
    quiz: queryResult.data,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    isError: queryResult.isError,
    error: queryResult.error,
    refetch,
  };
}

// Default export for convenient importing
export default useQuiz;
