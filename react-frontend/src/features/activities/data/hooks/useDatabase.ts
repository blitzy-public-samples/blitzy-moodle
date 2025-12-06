/**
 * useDatabase Hook
 *
 * React Query hook for fetching Database activity configuration and metadata.
 * Retrieves database instance data including all settings, field definitions,
 * approval requirements, time restrictions, and template configurations.
 *
 * This hook wraps the getDatabase API function and provides:
 * - Automatic caching with configurable stale time
 * - Background refetching for data freshness
 * - Loading, error, and success states
 * - Type-safe database configuration data
 *
 * Based on Moodle's Database activity module:
 * - public/mod/data/lib.php
 * - public/mod/data/locallib.php
 * - public/mod/data/view.php
 *
 * @module features/activities/data/hooks/useDatabase
 */

import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';

import { getDatabase, dataQueryKeys } from '@/features/activities/data/api/dataApi';
import type { Database } from '@/features/activities/data/types/data.types';
import type { Id } from '@/types/common';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default stale time for database configuration data (5 minutes).
 * Database configuration changes infrequently, so a longer stale time is appropriate.
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

/**
 * Default garbage collection time (30 minutes).
 * Unused data is removed from cache after this period.
 */
const DEFAULT_GC_TIME = 30 * 60 * 1000;

// ============================================================================
// Hook Options Interface
// ============================================================================

/**
 * Configuration options for the useDatabase hook.
 *
 * Extends React Query options to allow customization of caching behavior,
 * refetch strategies, and error handling.
 */
export interface UseDatabaseOptions
  extends Omit<
    UseQueryOptions<Database, Error, Database, readonly unknown[]>,
    'queryKey' | 'queryFn'
  > {
  /**
   * Whether to enable the query.
   * When false, the query will not execute.
   * Useful for conditional data fetching.
   * @default true
   */
  enabled?: boolean;

  /**
   * Time in milliseconds after data is considered stale.
   * Stale data will be refetched in the background when accessed.
   * @default 300000 (5 minutes)
   */
  staleTime?: number;

  /**
   * Time in milliseconds that unused/inactive cache data remains in memory.
   * After this time, the cache entry will be garbage collected.
   * @default 1800000 (30 minutes)
   */
  gcTime?: number;

  /**
   * Whether to refetch on window focus.
   * When true, stale data will be refetched when the user focuses the window.
   * @default true
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Whether to refetch when network reconnects.
   * When true, stale data will be refetched when network connection is restored.
   * @default true
   */
  refetchOnReconnect?: boolean;

  /**
   * Whether to retry failed requests.
   * Can be a boolean or a number indicating max retry attempts.
   * @default 3
   */
  retry?: boolean | number;
}

// ============================================================================
// Hook Return Type
// ============================================================================

/**
 * Return type for the useDatabase hook.
 *
 * Extends React Query's UseQueryResult with the Database type,
 * providing type-safe access to database configuration data.
 */
export type UseDatabaseResult = UseQueryResult<Database, Error>;

// ============================================================================
// Main Hook Implementation
// ============================================================================

/**
 * React Query hook for fetching Database activity configuration.
 *
 * Fetches complete database instance configuration by calling
 * GET /api/v1/data/{id} endpoint. Returns database settings,
 * field definitions, approval requirements, time restrictions,
 * and template configurations.
 *
 * The hook automatically handles:
 * - Caching with configurable stale time (default: 5 minutes)
 * - Background refetching for data freshness
 * - Loading, error, and success states
 * - Retry logic for failed requests
 * - Cache invalidation via query keys
 *
 * @param dataId - The unique identifier of the database activity instance
 * @param options - Optional configuration for query behavior
 * @returns Query result with database configuration data and query state
 *
 * @example
 * Basic usage:
 * ```typescript
 * function DatabasePage({ dataId }: { dataId: number }) {
 *   const { data: database, isLoading, error } = useDatabase(dataId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorDisplay error={error} />;
 *
 *   return (
 *     <div>
 *       <h1>{database.name}</h1>
 *       <p>{database.intro}</p>
 *       <p>Max entries: {database.maxentries || 'Unlimited'}</p>
 *       <p>Approval required: {database.approval ? 'Yes' : 'No'}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * With custom options:
 * ```typescript
 * function DatabaseConfig({ dataId }: { dataId: number }) {
 *   const {
 *     data: database,
 *     isLoading,
 *     isRefetching,
 *     refetch,
 *   } = useDatabase(dataId, {
 *     staleTime: 1000 * 60 * 10, // 10 minutes
 *     refetchOnWindowFocus: false,
 *     retry: 2,
 *   });
 *
 *   // Access database configuration
 *   if (database) {
 *     console.log('Database:', database.name);
 *     console.log('Comments enabled:', database.comments);
 *     console.log('Rating scale:', database.scale);
 *   }
 * }
 * ```
 *
 * @example
 * Conditional fetching:
 * ```typescript
 * function ConditionalDatabase({ dataId, shouldFetch }: Props) {
 *   const { data: database } = useDatabase(dataId, {
 *     enabled: shouldFetch && dataId > 0,
 *   });
 *
 *   return database ? <DatabaseView database={database} /> : null;
 * }
 * ```
 *
 * @example
 * Accessing database settings:
 * ```typescript
 * function DatabaseSettings({ dataId }: { dataId: number }) {
 *   const { data: database } = useDatabase(dataId);
 *
 *   if (!database) return null;
 *
 *   return (
 *     <SettingsPanel>
 *       <SettingItem label="Name" value={database.name} />
 *       <SettingItem label="Course ID" value={database.course} />
 *       <SettingItem label="Max Entries" value={database.maxentries || 'Unlimited'} />
 *       <SettingItem label="Required Entries" value={database.requiredentries} />
 *       <SettingItem label="Entries to View" value={database.requiredentriestoview} />
 *       <SettingItem label="Comments" value={database.comments ? 'Enabled' : 'Disabled'} />
 *       <SettingItem label="Approval" value={database.approval ? 'Required' : 'Not required'} />
 *       <TimeRestrictions
 *         availableFrom={database.timeavailablefrom}
 *         availableTo={database.timeavailableto}
 *         viewFrom={database.timeviewfrom}
 *         viewTo={database.timeviewto}
 *       />
 *     </SettingsPanel>
 *   );
 * }
 * ```
 */
export function useDatabase(
  dataId: Id,
  options?: UseDatabaseOptions
): UseDatabaseResult {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_GC_TIME,
    refetchOnWindowFocus = true,
    refetchOnReconnect = true,
    retry = 3,
    ...restOptions
  } = options ?? {};

  return useQuery<Database, Error, Database, readonly unknown[]>({
    /**
     * Query key for caching and invalidation.
     * Uses dataQueryKeys factory for consistency across the application.
     */
    queryKey: dataQueryKeys.database(dataId),

    /**
     * Query function that fetches database configuration.
     * Calls the getDatabase API function which wraps GET /api/v1/data/{id}.
     */
    queryFn: () => getDatabase(dataId),

    /**
     * Enable/disable the query.
     * Also validates that dataId is a positive number before fetching.
     */
    enabled: enabled && typeof dataId === 'number' && dataId > 0,

    /**
     * Time in milliseconds after data is considered stale.
     * Database configuration changes infrequently, so a longer stale time is appropriate.
     */
    staleTime,

    /**
     * Time in milliseconds that unused/inactive cache data remains in memory.
     */
    gcTime,

    /**
     * Refetch on window focus for data freshness.
     */
    refetchOnWindowFocus,

    /**
     * Refetch on network reconnect for resilience.
     */
    refetchOnReconnect,

    /**
     * Retry configuration for failed requests.
     * Helps handle transient network errors gracefully.
     */
    retry,

    /**
     * Custom retry delay with exponential backoff.
     * First retry after 1s, second after 2s, third after 4s, max 30s.
     */
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    /**
     * Pass through any additional React Query options.
     */
    ...restOptions,
  });
}

/**
 * Default export for convenient importing.
 *
 * @example
 * ```typescript
 * import useDatabase from '@/features/activities/data/hooks/useDatabase';
 *
 * const { data: database } = useDatabase(123);
 * ```
 */
export default useDatabase;
