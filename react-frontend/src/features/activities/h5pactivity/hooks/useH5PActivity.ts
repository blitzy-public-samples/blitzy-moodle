import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as h5pApi from '../api/h5pApi';
import type { H5PActivity, H5PDisplayOptions, H5PAccessInfo, H5PActivityUpdatePayload } from '../types/h5p.types';

/**
 * Options for the useH5PActivity hook.
 */
interface UseH5PActivityOptions {
  /**
   * Optional flag to enable/disable the query.
   * When false, the query will not execute.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Result object returned by the useH5PActivity hook.
 */
interface UseH5PActivityResult {
  /**
   * The H5P activity data including configuration and metadata.
   */
  activity: H5PActivity | undefined;

  /**
   * Access information with capability flags for the current user.
   */
  access: H5PAccessInfo | undefined;

  /**
   * True if either activity or access data is currently loading.
   */
  isLoading: boolean;

  /**
   * True if there was an error fetching activity or access data.
   */
  isError: boolean;

  /**
   * Error object if fetch failed, null otherwise.
   */
  error: Error | null;

  /**
   * Function to manually refetch both activity and access data.
   */
  refetch: () => void;

  /**
   * Parse display options JSON string into typed object.
   * @param displayoptions - JSON string containing display options
   * @returns Parsed display options object with boolean flags
   */
  parseDisplayOptions: (displayoptions: string) => H5PDisplayOptions;

  /**
   * Check if tracking is enabled for this activity.
   * @returns true if tracking is enabled
   */
  isTrackingEnabled: () => boolean;

  /**
   * Check if the current user can view activity reports.
   * @returns true if user has permission to review attempts
   */
  canViewReports: () => boolean;

  /**
   * Update activity configuration with optimistic updates.
   * @param updates - Partial activity data to update
   */
  updateActivity: (updates: H5PActivityUpdatePayload) => Promise<void>;

  /**
   * True if the update mutation is in progress.
   */
  isUpdating: boolean;
}

/**
 * Custom React Query hook for fetching and managing H5P activity data.
 * 
 * This hook provides comprehensive access to H5P activity configuration including:
 * - Activity metadata (id, course, name, intro, grade settings)
 * - Display options (frame, export, embed, copyright, about flags)
 * - Tracking configuration (enabletracking, grademethod, reviewmode)
 * - Access permissions (canview, cansubmit, canreviewattempts capabilities)
 * 
 * Features:
 * - Automatic caching with 5-minute stale time (activity config changes infrequently)
 * - Parallel fetching of activity data and access information
 * - Background refetching on window focus to ensure data freshness
 * - Optimistic updates for configuration changes
 * - Automatic query invalidation on successful updates
 * - Comprehensive error handling for 404, 403, and network errors
 * - Helper functions for parsing display options and checking permissions
 * 
 * @param activityId - The ID of the H5P activity to fetch (required, pass null to disable)
 * @param options - Additional options including enabled flag to control query execution
 * @returns Object containing activity data, access info, loading states, and helper functions
 * 
 * @example
 * Basic usage:
 * ```tsx
 * const { activity, access, isLoading, isError } = useH5PActivity(123);
 * 
 * if (isLoading) return <LoadingSpinner />;
 * if (isError) return <ErrorMessage />;
 * if (!activity) return <NotFound />;
 * 
 * return (
 *   <div>
 *     <h1>{activity.name}</h1>
 *     <p>{activity.intro}</p>
 *   </div>
 * );
 * ```
 * 
 * @example
 * Using helper functions:
 * ```tsx
 * const { 
 *   activity, 
 *   parseDisplayOptions, 
 *   isTrackingEnabled, 
 *   canViewReports 
 * } = useH5PActivity(activityId);
 * 
 * if (!activity) return null;
 * 
 * const displayOpts = parseDisplayOptions(activity.displayoptions);
 * 
 * return (
 *   <div>
 *     {displayOpts.frame && <Frame />}
 *     {isTrackingEnabled() && <TrackingIndicator />}
 *     {canViewReports() && <ViewReportsButton />}
 *   </div>
 * );
 * ```
 * 
 * @example
 * Updating activity configuration:
 * ```tsx
 * const { activity, updateActivity, isUpdating } = useH5PActivity(activityId);
 * 
 * const handleEnableTracking = async () => {
 *   await updateActivity({ enabletracking: 1 });
 * };
 * 
 * return (
 *   <Button 
 *     onClick={handleEnableTracking} 
 *     disabled={isUpdating}
 *   >
 *     Enable Tracking
 *   </Button>
 * );
 * ```
 * 
 * @example
 * Conditional fetching:
 * ```tsx
 * const [selectedId, setSelectedId] = useState<number | null>(null);
 * const { activity } = useH5PActivity(selectedId, { 
 *   enabled: selectedId !== null 
 * });
 * ```
 */
export default function useH5PActivity(
  activityId: number | null,
  options: UseH5PActivityOptions = {}
): UseH5PActivityResult {
  const queryClient = useQueryClient();
  const { enabled = true } = options;

  // Determine if queries should be enabled
  const shouldFetch = enabled && activityId !== null;

  /**
   * Fetch H5P activity data including metadata, configuration, and settings.
   * 
   * Returns:
   * - id: Activity instance ID
   * - course: Course ID
   * - name: Activity name
   * - intro: Activity description/introduction
   * - introformat: Text format of intro (1=HTML, etc.)
   * - grade: Maximum grade for this activity
   * - timecreated: Unix timestamp of creation
   * - timemodified: Unix timestamp of last modification
   * - displayoptions: JSON string with display configuration
   * - enabletracking: Boolean flag for attempt tracking
   * - grademethod: Integer representing grading method
   * - reviewmode: Integer representing review mode
   */
  const activityQuery = useQuery({
    queryKey: ['h5pActivity', activityId],
    queryFn: () => {
      if (!activityId) {
        throw new Error('Activity ID is required');
      }
      return h5pApi.getH5PActivity(activityId);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - activity config is relatively static
    refetchOnWindowFocus: true, // Ensure freshness when user returns
    retry: 2, // Retry twice on failure
    enabled: shouldFetch,
  });

  /**
   * Fetch access information and capability flags in parallel.
   * 
   * Returns capability flags:
   * - canview: User can view the activity
   * - cansubmit: User can submit attempts (requires tracking enabled)
   * - canreviewattempts: User can review all attempts (typically teachers)
   * - canreviewmyattempts: User can review their own attempts
   */
  const accessQuery = useQuery({
    queryKey: ['h5pActivityAccess', activityId],
    queryFn: () => {
      if (!activityId) {
        throw new Error('Activity ID is required');
      }
      return h5pApi.getAccessInformation(activityId);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - permissions rarely change
    refetchOnWindowFocus: true, // Ensure freshness when user returns
    retry: 2, // Retry twice on failure
    enabled: shouldFetch,
  });

  /**
   * Mutation for updating H5P activity configuration.
   * 
   * Implements optimistic updates:
   * 1. Immediately updates the cache with new values
   * 2. Sends update request to server
   * 3. On success: invalidates cache to refetch authoritative data
   * 4. On error: rolls back to previous cached value
   * 
   * This provides instant feedback to users while maintaining data consistency.
   */
  const updateMutation = useMutation({
    mutationFn: (updates: H5PActivityUpdatePayload) => {
      if (!activityId) {
        throw new Error('Activity ID is required for updates');
      }
      return h5pApi.updateH5PActivity(activityId, updates);
    },
    onMutate: async (updates) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['h5pActivity', activityId] });

      // Snapshot the previous value for rollback
      const previousActivity = queryClient.getQueryData<H5PActivity>(['h5pActivity', activityId]);

      // Optimistically update the cache
      if (previousActivity) {
        queryClient.setQueryData<H5PActivity>(['h5pActivity', activityId], {
          ...previousActivity,
          ...updates,
          timemodified: Math.floor(Date.now() / 1000), // Update modification timestamp
        });
      }

      // Return context with previous value for potential rollback
      return { previousActivity };
    },
    onError: (error, _variables, context) => {
      // On error, rollback to the previous cached value
      if (context?.previousActivity) {
        queryClient.setQueryData(['h5pActivity', activityId], context.previousActivity);
      }
      console.error('Failed to update H5P activity:', error);
    },
    onSuccess: () => {
      // On success, invalidate and refetch to get authoritative data from server
      queryClient.invalidateQueries({ queryKey: ['h5pActivity', activityId] });
      queryClient.invalidateQueries({ queryKey: ['h5pActivityAccess', activityId] });
    },
  });

  /**
   * Parse display options JSON string into a typed object with boolean flags.
   * 
   * Display options control how the H5P content is displayed:
   * - frame: Show the H5P frame around content
   * - export: Allow users to download/export content
   * - embed: Allow content to be embedded in other sites
   * - copyright: Display copyright information
   * - about: Show H5P about information
   * 
   * @param displayoptions - JSON string from the activity.displayoptions field
   * @returns Typed object with boolean flags, defaults to safe values on parse error
   * 
   * @example
   * ```tsx
   * const displayOpts = parseDisplayOptions(activity.displayoptions);
   * if (displayOpts.frame) {
   *   // Render with frame
   * }
   * if (displayOpts.export) {
   *   // Show download button
   * }
   * ```
   */
  const parseDisplayOptions = (displayoptions: string): H5PDisplayOptions => {
    try {
      const parsed = JSON.parse(displayoptions);
      return {
        frame: parsed.frame ?? true,
        export: parsed.export ?? false,
        embed: parsed.embed ?? false,
        copyright: parsed.copyright ?? false,
        about: parsed.about ?? false,
      };
    } catch (error) {
      // Return safe default values if parsing fails
      console.warn('Failed to parse display options, using defaults:', error);
      return {
        frame: true,
        export: false,
        embed: false,
        copyright: false,
        about: false,
      };
    }
  };

  /**
   * Check if attempt tracking is enabled for this activity.
   * 
   * When tracking is enabled:
   * - User attempts are recorded and stored
   * - Grades are calculated and reported
   * - Teachers can view attempt reports
   * - Students can review their own attempts
   * 
   * When tracking is disabled:
   * - Content is available but attempts are not recorded
   * - No grades are assigned
   * - Activity functions as content display only
   * 
   * @returns true if tracking is enabled, false otherwise
   * 
   * @example
   * ```tsx
   * if (isTrackingEnabled()) {
   *   return <AttemptTrackingUI />;
   * } else {
   *   return <PreviewModeWarning />;
   * }
   * ```
   */
  const isTrackingEnabled = (): boolean => {
    return activityQuery.data?.enabletracking === 1;
  };

  /**
   * Check if the current user has permission to view activity reports.
   * 
   * This typically means the user can:
   * - View all student attempts
   * - Access the reports page
   * - See detailed attempt data and scores
   * 
   * Usually granted to:
   * - Teachers and instructors
   * - Course managers and administrators
   * - Users with mod/h5pactivity:reviewattempts capability
   * 
   * @returns true if user can review attempts, false otherwise
   * 
   * @example
   * ```tsx
   * {canViewReports() && (
   *   <Link to={`/h5p/${activityId}/reports`}>
   *     View All Attempts
   *   </Link>
   * )}
   * ```
   */
  const canViewReports = (): boolean => {
    return accessQuery.data?.canreviewattempts ?? false;
  };

  /**
   * Manually refetch both activity data and access information.
   * 
   * Use cases:
   * - After external updates that may have changed the activity
   * - When recovering from an error state
   * - When user explicitly requests fresh data
   * - After navigating back to the activity from elsewhere
   * 
   * Note: Automatic refetching occurs on window focus, so manual
   * refetch is rarely needed.
   * 
   * @example
   * ```tsx
   * const { refetch, isLoading } = useH5PActivity(activityId);
   * 
   * return (
   *   <Button onClick={() => refetch()} disabled={isLoading}>
   *     Refresh Activity Data
   *   </Button>
   * );
   * ```
   */
  const refetch = (): void => {
    activityQuery.refetch();
    accessQuery.refetch();
  };

  /**
   * Update activity configuration with optimistic UI updates.
   * 
   * Supports updating:
   * - name: Activity name
   * - intro: Activity description
   * - displayoptions: JSON string with display configuration
   * - enabletracking: Enable/disable attempt tracking
   * - grademethod: Grading method (highest, average, first, last)
   * - reviewmode: When students can review attempts
   * - grade: Maximum grade value
   * 
   * The update is optimistic:
   * 1. UI updates immediately with new values
   * 2. Request is sent to server
   * 3. On success: server data replaces optimistic update
   * 4. On failure: UI reverts to previous values
   * 
   * @param updates - Partial activity object with fields to update
   * @returns Promise that resolves when update completes
   * @throws Error if activityId is null or update fails
   * 
   * @example
   * ```tsx
   * const { updateActivity, isUpdating } = useH5PActivity(activityId);
   * 
   * const handleToggleTracking = async () => {
   *   try {
   *     await updateActivity({ 
   *       enabletracking: activity.enabletracking === 1 ? 0 : 1 
   *     });
   *     toast.success('Tracking setting updated');
   *   } catch (error) {
   *     toast.error('Failed to update tracking setting');
   *   }
   * };
   * ```
   */
  const updateActivity = async (updates: H5PActivityUpdatePayload): Promise<void> => {
    await updateMutation.mutateAsync(updates);
  };

  // Return comprehensive result object with all data, states, and utilities
  return {
    // Core data
    activity: activityQuery.data,
    access: accessQuery.data,

    // Loading states
    isLoading: activityQuery.isLoading || accessQuery.isLoading,
    isError: activityQuery.isError || accessQuery.isError,
    error: (activityQuery.error || accessQuery.error) as Error | null,
    isUpdating: updateMutation.isPending,

    // Actions
    refetch,
    updateActivity,

    // Helper utilities
    parseDisplayOptions,
    isTrackingEnabled,
    canViewReports,
  };
}
