/**
 * Custom React hook for fetching and managing wiki instance data.
 *
 * This hook encapsulates wiki instance data fetching logic using React Query,
 * providing automatic caching, background refetching, and comprehensive state
 * management for wiki metadata including course, name, intro, wikimode
 * (collaborative/individual), defaultformat (editor type), firstpagetitle,
 * and time periods for editing restrictions.
 *
 * @module features/activities/wiki/hooks/useWiki
 * @packageDocumentation
 *
 * Backend References:
 * - public/mod/wiki/locallib.php: wiki_get_wiki() function (lines 57-61)
 * - public/mod/wiki/view.php: Wiki instance retrieval (lines 76-79)
 * - public/mod/wiki/db/install.xml: Wiki table schema
 *
 * API Endpoint:
 * - GET /api/v1/wiki/{id} - Fetches wiki instance details
 *
 * Features:
 * - Automatic caching with 5-minute staleTime for efficient data management
 * - Background refetching on window focus for fresh data
 * - Loading, error, and success states via React Query
 * - TypeScript strict mode with explicit return types
 * - Support for query invalidation on updates
 * - Wiki mode support for collaborative and individual wikis
 * - Editor format configuration (creole, html, nwiki)
 *
 * @example
 * ```tsx
 * import { useWiki } from '@/features/activities/wiki/hooks/useWiki';
 *
 * function WikiPage({ wikiId }: { wikiId: number }) {
 *   const { data: wiki, isLoading, error } = useWiki(wikiId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!wiki) return <NotFound />;
 *
 *   return (
 *     <div>
 *       <h1>{wiki.name}</h1>
 *       <p>Mode: {wiki.wikimode}</p>
 *       <p>Format: {wiki.defaultformat}</p>
 *     </div>
 *   );
 * }
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { fetchWiki } from '../api/wikiApi';
import type { Wiki } from '../types/wiki.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Query key factory for wiki-related queries.
 * Ensures consistent cache key generation across the application.
 */
const WIKI_QUERY_KEYS = {
  /**
   * Base key for all wiki queries
   */
  all: ['wikis'] as const,

  /**
   * Generates a cache key for a specific wiki instance
   * @param wikiId - The wiki instance ID
   */
  detail: (wikiId: number) => ['wikis', wikiId] as const,
} as const;

/**
 * Default stale time for wiki queries (5 minutes in milliseconds).
 * Wiki configuration data rarely changes, so a longer stale time
 * reduces unnecessary network requests while keeping data reasonably fresh.
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Default garbage collection time for wiki queries (10 minutes in milliseconds).
 * Keeps inactive wiki data in cache for potential quick re-access.
 */
const DEFAULT_GC_TIME = 10 * 60 * 1000; // 10 minutes

// ============================================================================
// HOOK OPTIONS INTERFACE
// ============================================================================

/**
 * Configuration options for the useWiki hook.
 * Allows customization of React Query behavior per use case.
 */
export interface UseWikiOptions {
  /**
   * Whether the query should automatically run.
   * Set to false to disable automatic fetching (useful for conditional queries).
   * @default true
   */
  enabled?: boolean;

  /**
   * Time in milliseconds after which cached data is considered stale.
   * Stale data may be returned from cache but will trigger a background refetch.
   * @default 300000 (5 minutes)
   */
  staleTime?: number;

  /**
   * Whether to refetch data when the window regains focus.
   * Helps ensure users see fresh data after switching browser tabs.
   * @default true
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Whether to refetch data when the component remounts.
   * @default false
   */
  refetchOnMount?: boolean | 'always';

  /**
   * Whether to refetch data when network connectivity is restored.
   * @default true
   */
  refetchOnReconnect?: boolean;

  /**
   * Number of times to retry failed queries.
   * @default 3
   */
  retry?: number | boolean;

  /**
   * Delay between retry attempts in milliseconds.
   * Can be a function receiving the attempt number for exponential backoff.
   * @default (attempt) => Math.min(1000 * 2 ** attempt, 30000)
   */
  retryDelay?: number | ((attemptIndex: number) => number);
}

// ============================================================================
// HOOK RETURN TYPE
// ============================================================================

/**
 * Return type for the useWiki hook.
 * Extends React Query's UseQueryResult with wiki-specific typing.
 */
export type UseWikiResult = UseQueryResult<Wiki, Error>;

// ============================================================================
// MAIN HOOK IMPLEMENTATION
// ============================================================================

/**
 * Custom hook for fetching and caching wiki instance data.
 *
 * Uses React Query to manage server state, providing automatic caching,
 * background refetching, and comprehensive loading/error state management.
 * The hook fetches wiki configuration including mode settings, editor format
 * preferences, and editing time restrictions.
 *
 * The wiki data structure includes:
 * - **id**: Wiki instance ID
 * - **course**: Course ID this wiki belongs to
 * - **name**: Wiki activity name displayed to users
 * - **intro**: Description/introduction text for the wiki
 * - **introformat**: Format of the intro field (HTML, Markdown, etc.)
 * - **firstpagetitle**: Title of the wiki's landing page
 * - **wikimode**: 'collaborative' (shared) or 'individual' (per-user)
 * - **defaultformat**: Default editor format ('html', 'creole', 'nwiki')
 * - **forceformat**: Whether users must use the default format
 * - **editbegin**: Timestamp when editing period starts (0 = no restriction)
 * - **editend**: Timestamp when editing period ends (0 = no restriction)
 * - **timecreated**: Wiki creation timestamp
 * - **timemodified**: Last modification timestamp
 * - **cancreatepages**: Whether current user can create new pages
 *
 * @param wikiId - The ID of the wiki instance to fetch
 * @param options - Optional configuration for React Query behavior
 * @returns UseQueryResult containing wiki data, loading state, and error state
 *
 * @example Basic usage
 * ```tsx
 * function WikiHeader({ wikiId }: { wikiId: number }) {
 *   const { data: wiki, isLoading, isError, error } = useWiki(wikiId);
 *
 *   if (isLoading) {
 *     return <Skeleton variant="text" width={200} />;
 *   }
 *
 *   if (isError) {
 *     return <Alert severity="error">{error.message}</Alert>;
 *   }
 *
 *   return <Typography variant="h4">{wiki?.name}</Typography>;
 * }
 * ```
 *
 * @example With custom options
 * ```tsx
 * function WikiDetails({ wikiId }: { wikiId: number }) {
 *   const { data: wiki } = useWiki(wikiId, {
 *     staleTime: 10 * 60 * 1000, // 10 minutes
 *     refetchOnWindowFocus: false,
 *     retry: 2,
 *   });
 *
 *   // Component implementation...
 * }
 * ```
 *
 * @example Conditional fetching
 * ```tsx
 * function ConditionalWiki({ wikiId }: { wikiId: number | null }) {
 *   const { data: wiki } = useWiki(wikiId ?? 0, {
 *     enabled: wikiId !== null && wikiId > 0,
 *   });
 *
 *   // Only fetches when wikiId is valid
 * }
 * ```
 *
 * @example Checking wiki mode
 * ```tsx
 * function WikiModeIndicator({ wikiId }: { wikiId: number }) {
 *   const { data: wiki } = useWiki(wikiId);
 *
 *   if (!wiki) return null;
 *
 *   const isCollaborative = wiki.wikimode === 'collaborative';
 *   const isIndividual = wiki.wikimode === 'individual';
 *
 *   return (
 *     <Chip
 *       label={isCollaborative ? 'Collaborative Wiki' : 'Individual Wiki'}
 *       color={isCollaborative ? 'primary' : 'secondary'}
 *     />
 *   );
 * }
 * ```
 *
 * @example Checking editing restrictions
 * ```tsx
 * function EditingStatus({ wikiId }: { wikiId: number }) {
 *   const { data: wiki } = useWiki(wikiId);
 *
 *   if (!wiki) return null;
 *
 *   const now = Math.floor(Date.now() / 1000);
 *   const hasEditingWindow = wiki.editbegin > 0 || wiki.editend > 0;
 *   const isWithinWindow =
 *     (wiki.editbegin === 0 || now >= wiki.editbegin) &&
 *     (wiki.editend === 0 || now <= wiki.editend);
 *
 *   if (!hasEditingWindow) {
 *     return <Typography>Editing always allowed</Typography>;
 *   }
 *
 *   return (
 *     <Alert severity={isWithinWindow ? 'success' : 'warning'}>
 *       {isWithinWindow ? 'Editing is currently allowed' : 'Editing is restricted'}
 *     </Alert>
 *   );
 * }
 * ```
 */
export function useWiki(
  wikiId: number,
  options: UseWikiOptions = {}
): UseWikiResult {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    refetchOnWindowFocus = true,
    refetchOnMount = false,
    refetchOnReconnect = true,
    retry = 3,
    retryDelay,
  } = options;

  return useQuery<Wiki, Error>({
    // Unique cache key for this wiki instance
    queryKey: WIKI_QUERY_KEYS.detail(wikiId),

    // Async function that fetches the wiki data from the API
    // Wraps wiki_get_wiki() from public/mod/wiki/locallib.php (lines 57-61)
    queryFn: () => fetchWiki(wikiId),

    // Only enable the query when the wikiId is valid and enabled option is true
    enabled: enabled && wikiId > 0,

    // Time in milliseconds before data is considered stale (5 minutes default)
    // Wiki configuration rarely changes, so longer stale time is appropriate
    staleTime,

    // Time in milliseconds before unused/inactive cache data is garbage collected
    gcTime: DEFAULT_GC_TIME,

    // Refetch data when window regains focus to ensure fresh data
    refetchOnWindowFocus,

    // Whether to refetch when the component mounts
    refetchOnMount,

    // Refetch when network connectivity is restored
    refetchOnReconnect,

    // Number of retry attempts for failed queries
    retry,

    // Delay between retries (defaults to exponential backoff if not specified)
    ...(retryDelay !== undefined ? { retryDelay } : {}),

    // Metadata for debugging and devtools
    meta: {
      description: 'Fetches wiki instance configuration and metadata',
      endpoint: `GET /api/v1/wiki/${wikiId}`,
    },
  });
}

// ============================================================================
// UTILITY FUNCTIONS FOR QUERY KEY MANAGEMENT
// ============================================================================

/**
 * Gets the query key for a specific wiki instance.
 * Useful for manual cache invalidation or prefetching.
 *
 * @param wikiId - The wiki instance ID
 * @returns The query key array for the specified wiki
 *
 * @example Invalidating wiki cache
 * ```tsx
 * import { useQueryClient } from '@tanstack/react-query';
 * import { getWikiQueryKey } from '@/features/activities/wiki/hooks/useWiki';
 *
 * function WikiActions({ wikiId }: { wikiId: number }) {
 *   const queryClient = useQueryClient();
 *
 *   const handleRefresh = () => {
 *     queryClient.invalidateQueries({
 *       queryKey: getWikiQueryKey(wikiId),
 *     });
 *   };
 *
 *   return <Button onClick={handleRefresh}>Refresh</Button>;
 * }
 * ```
 */
export function getWikiQueryKey(wikiId: number): readonly ['wikis', number] {
  return WIKI_QUERY_KEYS.detail(wikiId);
}

/**
 * Gets the base query key for all wiki queries.
 * Useful for invalidating all wiki-related cache entries at once.
 *
 * @returns The base query key array for all wikis
 *
 * @example Invalidating all wiki caches
 * ```tsx
 * import { useQueryClient } from '@tanstack/react-query';
 * import { getAllWikisQueryKey } from '@/features/activities/wiki/hooks/useWiki';
 *
 * function RefreshAllWikis() {
 *   const queryClient = useQueryClient();
 *
 *   const handleRefreshAll = () => {
 *     queryClient.invalidateQueries({
 *       queryKey: getAllWikisQueryKey(),
 *     });
 *   };
 *
 *   return <Button onClick={handleRefreshAll}>Refresh All Wikis</Button>;
 * }
 * ```
 */
export function getAllWikisQueryKey(): readonly ['wikis'] {
  return WIKI_QUERY_KEYS.all;
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Re-export Wiki type for convenience when using this hook
export type { Wiki } from '../types/wiki.types';
