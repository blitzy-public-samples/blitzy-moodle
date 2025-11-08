/**
 * Custom React hook for managing SCORM attempt state and operations
 * 
 * This hook provides comprehensive SCORM attempt management including:
 * - Fetching current/last user attempts
 * - Creating new attempts with validation
 * - Checking attempt permissions and limits
 * - Managing attempt modes (normal, browse, review)
 * 
 * @module useScormAttempt
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';

/**
 * SCORM attempt mode types
 */
export type ScormAttemptMode = 'normal' | 'browse' | 'review';

/**
 * SCORM force new attempt settings
 */
export enum ScormForceAttempt {
  NO = 0,
  ON_COMPLETE = 1,
  ALWAYS = 2,
}

/**
 * SCORM completion status values
 */
export type ScormCompletionStatus = 
  | 'completed' 
  | 'incomplete' 
  | 'not attempted' 
  | 'passed' 
  | 'failed' 
  | 'unknown';

/**
 * SCORM attempt data structure
 */
export interface ScormAttempt {
  id: number;
  scormId: number;
  userId: number;
  attemptNumber: number;
  startTime: number;
  timeModified: number;
  status: ScormCompletionStatus;
  scoreRaw: number | null;
  scoreScaled: number | null;
  scoreMin: number | null;
  scoreMax: number | null;
  sessionTime: string | null;
  totalTime: string | null;
  isCompleted: boolean;
  isIncomplete: boolean;
}

/**
 * SCORM configuration for attempt validation
 */
export interface ScormConfig {
  id: number;
  maxAttempt: number;
  forceNewAttempt: ScormForceAttempt;
  hideBrowse: boolean;
  lastattemptlock: boolean;
  displayAttempStatus: boolean;
}

/**
 * Parameters for creating a new SCORM attempt
 */
export interface CreateAttemptParams {
  scormId: number;
  userId: number;
  mode?: ScormAttemptMode;
  newAttempt?: boolean;
}

/**
 * API response for attempts list
 */
interface AttemptsResponse {
  success: boolean;
  data: {
    attempts: ScormAttempt[];
    lastAttempt: ScormAttempt | null;
    scormConfig: ScormConfig;
    totalAttempts: number;
  };
}

/**
 * API response for single attempt
 */
interface AttemptResponse {
  success: boolean;
  data: {
    attempt: ScormAttempt;
  };
}

/**
 * Return type for useScormAttempt hook
 */
export interface UseScormAttemptReturn {
  /** Current/last attempt data */
  attempt: ScormAttempt | null;
  /** Loading state for attempt query */
  isLoading: boolean;
  /** Error object if attempt fetch failed */
  error: Error | null;
  /** Mutation function to create a new attempt */
  createAttempt: (params?: { mode?: ScormAttemptMode; force?: boolean }) => Promise<ScormAttempt>;
  /** Whether user can start a new attempt */
  canStartNewAttempt: boolean;
  /** Number of attempts remaining (null if unlimited) */
  attemptsLeft: number | null;
  /** Whether attempt creation is in progress */
  isCreating: boolean;
  /** All attempts for this SCORM and user */
  allAttempts: ScormAttempt[];
  /** Total number of attempts made */
  totalAttempts: number;
  /** SCORM configuration settings */
  scormConfig: ScormConfig | null;
  /** Refresh attempt data */
  refetch: () => Promise<void>;
}

/**
 * Fetches SCORM attempts for a user
 * 
 * @param scormId - The SCORM package ID
 * @param userId - The user ID
 * @returns Promise resolving to attempts response
 */
async function fetchScormAttempts(
  scormId: number,
  userId: number
): Promise<AttemptsResponse> {
  const response = await apiClient.get<AttemptsResponse>(
    `/api/v1/scorm/${scormId}/attempts`,
    {
      params: { userId },
    }
  );
  return response.data;
}

/**
 * Creates a new SCORM attempt
 * 
 * @param params - Attempt creation parameters
 * @returns Promise resolving to created attempt
 */
async function createScormAttempt(
  params: CreateAttemptParams
): Promise<ScormAttempt> {
  const response = await apiClient.post<AttemptResponse>(
    `/api/v1/scorm/${params.scormId}/attempt`,
    {
      userId: params.userId,
      mode: params.mode ?? 'normal',
      newAttempt: params.newAttempt !== false,
    }
  );
  return response.data.data.attempt;
}

/**
 * Validates if a new attempt can be started based on SCORM settings
 * 
 * @param scormConfig - SCORM configuration
 * @param totalAttempts - Total attempts made so far
 * @param lastAttempt - Last attempt data (if any)
 * @returns Whether a new attempt can be started
 */
function validateCanStartNewAttempt(
  scormConfig: ScormConfig | null,
  totalAttempts: number,
  lastAttempt: ScormAttempt | null
): boolean {
  if (!scormConfig) {
    return false;
  }

  // Check if maxAttempt limit is reached (0 = unlimited)
  if (scormConfig.maxAttempt > 0 && totalAttempts >= scormConfig.maxAttempt) {
    return false;
  }

  // Check if last attempt is locked (lastattemptlock setting)
  if (scormConfig.lastattemptlock && lastAttempt && lastAttempt.isIncomplete) {
    return false;
  }

  // If force new attempt is set to ALWAYS, always allow new attempts (within maxAttempt limit)
  if (scormConfig.forceNewAttempt === ScormForceAttempt.ALWAYS) {
    return true;
  }

  // If there's no last attempt, first attempt is always allowed
  if (!lastAttempt) {
    return true;
  }

  // If last attempt is incomplete, cannot start new attempt (must continue)
  if (lastAttempt.isIncomplete) {
    return false;
  }

  // If last attempt is complete and force new attempt is ON_COMPLETE, allow new attempt
  if (
    lastAttempt.isCompleted && 
    scormConfig.forceNewAttempt === ScormForceAttempt.ON_COMPLETE
  ) {
    return true;
  }

  // If last attempt is complete and no force setting, allow new attempt
  if (lastAttempt.isCompleted) {
    return true;
  }

  // Default to not allowing new attempt
  return false;
}

/**
 * Calculates the number of attempts remaining
 * 
 * @param scormConfig - SCORM configuration
 * @param totalAttempts - Total attempts made so far
 * @returns Number of attempts remaining, or null if unlimited
 */
function calculateAttemptsLeft(
  scormConfig: ScormConfig | null,
  totalAttempts: number
): number | null {
  if (!scormConfig) {
    return null;
  }

  // 0 = unlimited attempts
  if (scormConfig.maxAttempt === 0) {
    return null;
  }

  const remaining = scormConfig.maxAttempt - totalAttempts;
  return Math.max(0, remaining);
}

/**
 * Custom React hook for managing SCORM attempt state and operations
 * 
 * This hook provides complete SCORM attempt management with automatic
 * caching, optimistic updates, and validation logic.
 * 
 * @param scormId - The SCORM package ID
 * @param userId - The user ID
 * @returns Object containing attempt data and operations
 * 
 * @example
 * ```tsx
 * function ScormPlayer({ scormId, userId }) {
 *   const {
 *     attempt,
 *     isLoading,
 *     error,
 *     createAttempt,
 *     canStartNewAttempt,
 *     attemptsLeft
 *   } = useScormAttempt(scormId, userId);
 * 
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 * 
 *   return (
 *     <div>
 *       {attempt ? (
 *         <AttemptView attempt={attempt} />
 *       ) : (
 *         <Button 
 *           onClick={() => createAttempt()}
 *           disabled={!canStartNewAttempt}
 *         >
 *           Start Attempt {attemptsLeft !== null && `(${attemptsLeft} left)`}
 *         </Button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export default function useScormAttempt(
  scormId: number,
  userId: number
): UseScormAttemptReturn {
  const queryClient = useQueryClient();

  // Query for fetching attempts
  const {
    data: attemptsData,
    isLoading,
    error,
    refetch: refetchQuery,
  } = useQuery({
    queryKey: ['scorm', 'attempts', scormId, userId],
    queryFn: () => fetchScormAttempts(scormId, userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 2,
    refetchOnWindowFocus: true,
  });

  // Mutation for creating new attempts
  const createAttemptMutation = useMutation({
    mutationFn: (params: { mode?: ScormAttemptMode; force?: boolean }) =>
      createScormAttempt({
        scormId,
        userId,
        mode: params.mode,
        newAttempt: params.force !== false,
      }),
    onMutate: async () => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ['scorm', 'attempts', scormId, userId],
      });

      // Snapshot previous value
      const previousAttempts = queryClient.getQueryData([
        'scorm',
        'attempts',
        scormId,
        userId,
      ]);

      // Optimistically update the attempt count
      if (attemptsData) {
        queryClient.setQueryData(
          ['scorm', 'attempts', scormId, userId],
          {
            ...attemptsData,
            data: {
              ...attemptsData.data,
              totalAttempts: attemptsData.data.totalAttempts + 1,
            },
          }
        );
      }

      return { previousAttempts };
    },
    onError: (_error, _variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousAttempts) {
        queryClient.setQueryData(
          ['scorm', 'attempts', scormId, userId],
          context.previousAttempts
        );
      }
    },
    onSuccess: () => {
      // Invalidate and refetch attempt queries
      void queryClient.invalidateQueries({
        queryKey: ['scorm', 'attempts', scormId, userId],
      });

      // Also invalidate the specific SCORM details query
      void queryClient.invalidateQueries({
        queryKey: ['scorm', scormId],
      });

      // Invalidate user progress queries
      void queryClient.invalidateQueries({
        queryKey: ['scorm', 'progress', scormId, userId],
      });
    },
  });

  // Extract data from query response
  const lastAttempt = attemptsData?.data.lastAttempt ?? null;
  const allAttempts = attemptsData?.data.attempts ?? [];
  const totalAttempts = attemptsData?.data.totalAttempts ?? 0;
  const scormConfig = attemptsData?.data.scormConfig ?? null;

  // Calculate validation results
  const canStartNewAttempt = validateCanStartNewAttempt(
    scormConfig,
    totalAttempts,
    lastAttempt
  );

  const attemptsLeft = calculateAttemptsLeft(scormConfig, totalAttempts);

  // Wrapper for refetch with proper typing
  const refetch = async (): Promise<void> => {
    await refetchQuery();
  };

  // Wrapper for createAttempt with proper typing
  const createAttempt = async (
    params?: { mode?: ScormAttemptMode; force?: boolean }
  ): Promise<ScormAttempt> => {
    return createAttemptMutation.mutateAsync(params ?? {});
  };

  return {
    attempt: lastAttempt,
    isLoading,
    error,
    createAttempt,
    canStartNewAttempt,
    attemptsLeft,
    isCreating: createAttemptMutation.isPending,
    allAttempts,
    totalAttempts,
    scormConfig,
    refetch,
  };
}
