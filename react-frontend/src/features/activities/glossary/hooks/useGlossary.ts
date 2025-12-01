/**
 * useGlossary Hooks
 *
 * React Query hooks for fetching glossary activity data with automatic caching,
 * background revalidation, and intelligent server state management. Provides
 * type-safe access to glossary configuration and entries with pagination.
 *
 * Based on Moodle's glossary module functionality in public/mod/glossary/view.php
 * which supports multiple browse modes (letter, category, date, author) and
 * various filtering, sorting, and search options.
 *
 * Features:
 * - useGlossary(): Fetch single glossary instance by ID with configuration and metadata
 * - useGlossaryEntries(): Fetch paginated entries with multiple display modes
 * - Support for letter, category, date, author, and search browse modes
 * - Automatic caching with configurable stale time
 * - TypeScript interfaces for query parameters and return types
 * - Integration with /api/v1/glossary endpoints
 *
 * Performance Targets (from Agent Action Plan):
 * - Subsequent navigation: <500ms
 * - API P50 response time: <300ms
 * - API P95 response time: <1 second
 *
 * @module features/activities/glossary/hooks/useGlossary
 * @see public/mod/glossary/view.php - Moodle glossary view entry point
 * @see public/mod/glossary/lib.php - Moodle glossary library functions
 */

import { useQuery, type UseQueryResult, type UseQueryOptions } from '@tanstack/react-query';
import { getGlossary, getEntries } from '../api/glossaryApi';
import type { 
  Glossary, 
  GlossaryEntry, 
  GlossaryBrowseMode,
  GlossaryFilters,
} from '../types/glossary.types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Query key factory for glossary-related queries
 *
 * Using a factory pattern ensures consistent query keys across the application
 * for effective cache invalidation and management.
 *
 * @example
 * ```typescript
 * // Single glossary key
 * glossaryKeys.detail(42) // ['glossary', 42]
 *
 * // Entries with filters
 * glossaryKeys.entries(42, { mode: 'letter', hook: 'A' })
 * // ['glossary', 42, 'entries', { mode: 'letter', hook: 'A' }]
 *
 * // Invalidate all glossary queries
 * queryClient.invalidateQueries({ queryKey: glossaryKeys.all });
 * ```
 */
export const glossaryKeys = {
  /** Base key for all glossary queries */
  all: ['glossary'] as const,
  /** Generate key for a specific glossary by ID */
  detail: (id: number) => ['glossary', id] as const,
  /** Generate base key for entries of a specific glossary */
  entriesBase: (glossaryId: number) => ['glossary', glossaryId, 'entries'] as const,
  /** Generate key for entries with specific parameters */
  entries: (glossaryId: number, params: GlossaryEntriesParams) => 
    [...glossaryKeys.entriesBase(glossaryId), params] as const,
} as const;

/**
 * Default stale time for glossary data (5 minutes in milliseconds)
 *
 * Glossary data doesn't change frequently during a user session, so a 5-minute
 * stale time provides good performance while ensuring data doesn't become
 * too outdated. This aligns with the Agent Action Plan requirement for
 * <500ms subsequent navigation.
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Default stale time for entries data (2 minutes in milliseconds)
 *
 * Entry lists may update more frequently than glossary configuration,
 * especially in active glossaries with many contributors.
 */
const DEFAULT_ENTRIES_STALE_TIME = 2 * 60 * 1000; // 2 minutes

/**
 * Default cache time for inactive queries (30 minutes in milliseconds)
 *
 * Inactive queries (no active observers) are kept in cache for 30 minutes
 * before being garbage collected. This allows for quick restoration when
 * users navigate back to previously viewed glossaries.
 */
const DEFAULT_GC_TIME = 30 * 60 * 1000; // 30 minutes

/**
 * Default number of entries per page
 *
 * Matches Moodle's default glossary entries per page setting.
 */
const DEFAULT_LIMIT = 20;

// ============================================================================
// Types
// ============================================================================

/**
 * Glossary display/browse mode type
 *
 * Represents the different ways entries can be browsed in a glossary.
 * Based on the mode parameter in Moodle's glossary view.php:
 * - 'letter': Alphabetical browsing by first letter
 * - 'cat': Browse by category
 * - 'date': Browse by creation/modification date
 * - 'author': Browse by entry author
 * - 'search': Full-text search mode
 * - 'entry': View a specific entry
 * - 'term': Search for entries matching a term
 * - 'approval': View entries pending approval (teachers only)
 */
export type GlossaryMode = 
  | 'letter' 
  | 'cat' 
  | 'date' 
  | 'author' 
  | 'search' 
  | 'entry' 
  | 'term' 
  | 'approval';

/**
 * Parameters for fetching glossary entries
 *
 * Based on Moodle's glossary view.php URL parameters:
 * - mode: Browse mode (letter, cat, date, author, search, etc.)
 * - hook: Filter value based on mode (letter, category ID, search term, etc.)
 * - offset: Number of entries to skip for pagination
 * - limit: Number of entries per page
 * - sortkey: Sort field (CREATION, UPDATE, FIRSTNAME, LASTNAME)
 * - sortorder: Sort direction (asc, desc)
 * - fullsearch: Whether to search in definitions (not just concepts)
 *
 * @example
 * ```typescript
 * // Browse entries starting with 'A'
 * const params: GlossaryEntriesParams = {
 *   mode: 'letter',
 *   hook: 'A',
 *   limit: 20,
 *   offset: 0
 * };
 *
 * // Search entries
 * const searchParams: GlossaryEntriesParams = {
 *   mode: 'search',
 *   hook: 'react',
 *   fullsearch: true
 * };
 *
 * // Browse by category
 * const categoryParams: GlossaryEntriesParams = {
 *   mode: 'cat',
 *   hook: '5' // category ID as string
 * };
 * ```
 */
export interface GlossaryEntriesParams {
  /**
   * Browse/display mode for entries.
   * Determines how entries are filtered and displayed.
   * @default 'letter'
   */
  mode?: GlossaryMode;

  /**
   * Filter value based on the selected mode:
   * - For 'letter' mode: The letter to filter by (e.g., 'A', 'B', 'ALL', 'SPECIAL')
   * - For 'cat' mode: Category ID as string
   * - For 'date' mode: Usually 'ALL' or specific date filter
   * - For 'author' mode: User ID or 'ALL'
   * - For 'search' mode: The search query string
   * - For 'term' mode: The term to search for
   * @default 'ALL'
   */
  hook?: string;

  /**
   * Number of entries to skip for pagination.
   * Used together with limit for offset-based pagination.
   * @default 0
   */
  offset?: number;

  /**
   * Maximum number of entries to return per page.
   * @default 20
   */
  limit?: number;

  /**
   * Sort key for ordering entries:
   * - 'CREATION': Sort by creation date
   * - 'UPDATE': Sort by last update date
   * - 'FIRSTNAME': Sort by author's first name
   * - 'LASTNAME': Sort by author's last name
   */
  sortkey?: 'CREATION' | 'UPDATE' | 'FIRSTNAME' | 'LASTNAME';

  /**
   * Sort order direction.
   * @default 'asc'
   */
  sortorder?: 'asc' | 'desc';

  /**
   * Whether to perform a full-text search.
   * When true, searches in both concept and definition.
   * When false, searches only in concept.
   * Only applicable for 'search' mode.
   * @default false
   */
  fullsearch?: boolean;
}

/**
 * Options for the useGlossary hook
 */
export interface UseGlossaryOptions {
  /**
   * Whether the query should execute.
   * Useful for conditional fetching based on glossaryId availability.
   * @default true
   */
  enabled?: boolean;

  /**
   * Time in milliseconds after which data is considered stale.
   * @default 300000 (5 minutes)
   */
  staleTime?: number;

  /**
   * Time in milliseconds that unused/inactive cache data remains in memory.
   * @default 1800000 (30 minutes)
   */
  gcTime?: number;

  /**
   * Whether to refetch on window focus.
   * @default true
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Whether to refetch when network reconnects.
   * @default true
   */
  refetchOnReconnect?: boolean;

  /**
   * Whether to retry failed requests.
   * @default 3
   */
  retry?: boolean | number;

  /**
   * Initial data to use before the query completes.
   */
  initialData?: Glossary;
}

/**
 * Options for the useGlossaryEntries hook
 */
export interface UseGlossaryEntriesOptions {
  /**
   * Whether the query should execute.
   * @default true
   */
  enabled?: boolean;

  /**
   * Time in milliseconds after which data is considered stale.
   * @default 120000 (2 minutes)
   */
  staleTime?: number;

  /**
   * Time in milliseconds that unused/inactive cache data remains in memory.
   * @default 1800000 (30 minutes)
   */
  gcTime?: number;

  /**
   * Whether to refetch on window focus.
   * @default true
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Whether to keep previous data while fetching new data.
   * Prevents layout shift during pagination.
   * @default true
   */
  keepPreviousData?: boolean;

  /**
   * Whether to retry failed requests.
   * @default 3
   */
  retry?: boolean | number;
}

/**
 * Result type for glossary entries query
 *
 * Contains the entries array with pagination metadata.
 */
export interface GlossaryEntriesResult {
  /** Array of glossary entries */
  entries: GlossaryEntry[];
  /** Total number of entries matching the filter */
  total: number;
}

/**
 * Return type for the useGlossary hook
 *
 * Extends React Query's UseQueryResult with typed data.
 */
export type UseGlossaryResult = UseQueryResult<Glossary, Error>;

/**
 * Return type for the useGlossaryEntries hook
 *
 * Extends React Query's UseQueryResult with typed entries result.
 */
export type UseGlossaryEntriesResult = UseQueryResult<GlossaryEntriesResult, Error>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts GlossaryEntriesParams to GlossaryFilters for the API
 *
 * Maps the hook parameters to the API filter format expected by getEntries().
 *
 * @param params - The hook parameters
 * @returns GlossaryFilters for the API call
 */
function paramsToFilters(params: GlossaryEntriesParams): GlossaryFilters {
  const filters: GlossaryFilters = {};

  // Map mode to browseMode
  if (params.mode) {
    // Map our GlossaryMode to GlossaryBrowseMode
    const modeMapping: Record<string, GlossaryBrowseMode | undefined> = {
      'letter': 'letter' as GlossaryBrowseMode,
      'cat': 'cat' as GlossaryBrowseMode,
      'date': 'date' as GlossaryBrowseMode,
      'author': 'author' as GlossaryBrowseMode,
    };
    
    if (modeMapping[params.mode]) {
      filters.browseMode = modeMapping[params.mode];
    }
  }

  // Handle hook parameter based on mode
  if (params.hook) {
    switch (params.mode) {
      case 'letter':
        filters.letter = params.hook;
        break;
      case 'cat':
        filters.categoryId = parseInt(params.hook, 10);
        break;
      case 'author':
        if (params.hook !== 'ALL') {
          filters.userId = parseInt(params.hook, 10);
        }
        break;
      case 'search':
      case 'term':
        filters.search = params.hook;
        break;
      case 'approval':
        filters.approved = false;
        break;
    }
  }

  // Map sorting parameters
  if (params.sortkey) {
    const sortMapping: Record<string, 'concept' | 'author' | 'created' | 'modified'> = {
      'CREATION': 'created',
      'UPDATE': 'modified',
      'FIRSTNAME': 'author',
      'LASTNAME': 'author',
    };
    filters.sortBy = sortMapping[params.sortkey] ?? 'concept';
  }

  if (params.sortorder) {
    filters.sortOrder = params.sortorder;
  }

  // Map pagination
  if (params.limit !== undefined) {
    filters.perPage = params.limit;
  }

  if (params.offset !== undefined && params.limit) {
    // Convert offset to page number (1-based)
    filters.page = Math.floor(params.offset / params.limit);
  }

  return filters;
}

// ============================================================================
// Hook Implementations
// ============================================================================

/**
 * React Query hook for fetching a single glossary instance
 *
 * Retrieves complete glossary configuration including display settings,
 * entry settings, rating configuration, completion criteria, and
 * current user's permissions.
 *
 * @param glossaryId - The unique identifier of the glossary to fetch
 * @param options - Optional configuration for query behavior
 * @returns UseQueryResult containing glossary data and query state
 *
 * @example
 * ```typescript
 * // Basic usage
 * function GlossaryView({ glossaryId }: { glossaryId: number }) {
 *   const { data: glossary, isLoading, isError, error } = useGlossary(glossaryId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (isError) return <ErrorMessage error={error} />;
 *   if (!glossary) return <NotFound />;
 *
 *   return (
 *     <div>
 *       <h1>{glossary.name}</h1>
 *       <div dangerouslySetInnerHTML={{ __html: glossary.intro }} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Conditional fetching
 * const { data: glossary } = useGlossary(glossaryId, {
 *   enabled: glossaryId > 0,
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Custom stale time for frequently updated glossaries
 * const { data: glossary } = useGlossary(glossaryId, {
 *   staleTime: 60 * 1000, // 1 minute
 * });
 * ```
 */
export function useGlossary(
  glossaryId: number,
  options: UseGlossaryOptions = {}
): UseGlossaryResult {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_GC_TIME,
    refetchOnWindowFocus = true,
    refetchOnReconnect = true,
    retry = 3,
    initialData,
  } = options;

  /**
   * Determine if the query should be enabled
   *
   * The query is disabled if:
   * - The `enabled` option is explicitly false
   * - The glossaryId is not a valid positive number
   */
  const shouldFetch = enabled && typeof glossaryId === 'number' && glossaryId > 0;

  /**
   * Build the query options object for React Query
   */
  const queryOptions: UseQueryOptions<Glossary, Error> = {
    queryKey: glossaryKeys.detail(glossaryId),
    queryFn: async (): Promise<Glossary> => {
      return getGlossary(glossaryId);
    },
    enabled: shouldFetch,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    refetchOnReconnect,
    retry,
    initialData,
  };

  return useQuery<Glossary, Error>(queryOptions);
}

/**
 * React Query hook for fetching glossary entries with pagination
 *
 * Retrieves paginated glossary entries with support for multiple display modes
 * (letter, category, date, author, search), filtering, and sorting options.
 *
 * @param glossaryId - The unique identifier of the glossary
 * @param params - Parameters for filtering, sorting, and pagination
 * @param options - Optional configuration for query behavior
 * @returns UseQueryResult containing entries array and pagination metadata
 *
 * @example
 * ```typescript
 * // Basic usage - fetch all entries
 * function GlossaryEntryList({ glossaryId }: { glossaryId: number }) {
 *   const { data, isLoading, isError } = useGlossaryEntries(glossaryId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (isError) return <ErrorMessage />;
 *
 *   return (
 *     <ul>
 *       {data?.entries.map(entry => (
 *         <li key={entry.id}>{entry.concept}: {entry.definition}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Browse by letter
 * const { data } = useGlossaryEntries(glossaryId, {
 *   mode: 'letter',
 *   hook: 'A',
 *   limit: 20,
 *   offset: 0,
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Search entries with full-text search
 * const { data } = useGlossaryEntries(glossaryId, {
 *   mode: 'search',
 *   hook: searchQuery,
 *   fullsearch: true,
 *   sortkey: 'UPDATE',
 *   sortorder: 'desc',
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Browse by category
 * const { data } = useGlossaryEntries(glossaryId, {
 *   mode: 'cat',
 *   hook: categoryId.toString(),
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Browse by author
 * const { data } = useGlossaryEntries(glossaryId, {
 *   mode: 'author',
 *   hook: userId.toString(),
 *   sortkey: 'FIRSTNAME',
 *   sortorder: 'asc',
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Browse by date with pagination
 * const [offset, setOffset] = useState(0);
 * const limit = 20;
 *
 * const { data } = useGlossaryEntries(glossaryId, {
 *   mode: 'date',
 *   sortkey: 'UPDATE',
 *   sortorder: 'desc',
 *   offset,
 *   limit,
 * });
 *
 * const handleNextPage = () => setOffset(prev => prev + limit);
 * const handlePrevPage = () => setOffset(prev => Math.max(0, prev - limit));
 * ```
 */
export function useGlossaryEntries(
  glossaryId: number,
  params: GlossaryEntriesParams = {},
  options: UseGlossaryEntriesOptions = {}
): UseGlossaryEntriesResult {
  const {
    enabled = true,
    staleTime = DEFAULT_ENTRIES_STALE_TIME,
    gcTime = DEFAULT_GC_TIME,
    refetchOnWindowFocus = true,
    keepPreviousData = true,
    retry = 3,
  } = options;

  // Apply default values to params
  const normalizedParams: GlossaryEntriesParams = {
    mode: params.mode ?? 'letter',
    hook: params.hook ?? 'ALL',
    offset: params.offset ?? 0,
    limit: params.limit ?? DEFAULT_LIMIT,
    sortkey: params.sortkey,
    sortorder: params.sortorder ?? 'asc',
    fullsearch: params.fullsearch ?? false,
  };

  /**
   * Determine if the query should be enabled
   */
  const shouldFetch = enabled && typeof glossaryId === 'number' && glossaryId > 0;

  /**
   * Convert params to API filters
   */
  const filters = paramsToFilters(normalizedParams);

  /**
   * Build the query options object for React Query
   */
  const queryOptions: UseQueryOptions<GlossaryEntriesResult, Error> = {
    queryKey: glossaryKeys.entries(glossaryId, normalizedParams),
    queryFn: async (): Promise<GlossaryEntriesResult> => {
      const result = await getEntries(glossaryId, filters);
      return {
        entries: result.entries,
        total: result.total,
      };
    },
    enabled: shouldFetch,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    placeholderData: keepPreviousData 
      ? (previousData) => previousData 
      : undefined,
    retry,
  };

  return useQuery<GlossaryEntriesResult, Error>(queryOptions);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate pagination metadata from entries result
 *
 * Helper function to compute page information for UI pagination components.
 *
 * @param total - Total number of entries
 * @param offset - Current offset
 * @param limit - Entries per page
 * @returns Pagination metadata
 *
 * @example
 * ```typescript
 * const { data } = useGlossaryEntries(glossaryId, { offset: 40, limit: 20 });
 * const pagination = calculatePagination(data.total, 40, 20);
 * // { currentPage: 3, totalPages: 5, hasNext: true, hasPrev: true }
 * ```
 */
export function calculatePagination(
  total: number,
  offset: number,
  limit: number
): {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  startIndex: number;
  endIndex: number;
} {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;
  const startIndex = offset + 1;
  const endIndex = Math.min(offset + limit, total);

  return {
    currentPage,
    totalPages,
    hasNext,
    hasPrev,
    startIndex,
    endIndex,
  };
}

/**
 * Get the next offset for pagination
 *
 * @param currentOffset - Current offset
 * @param limit - Entries per page
 * @param total - Total number of entries
 * @returns Next offset or current offset if at the end
 */
export function getNextOffset(
  currentOffset: number,
  limit: number,
  total: number
): number {
  const nextOffset = currentOffset + limit;
  return nextOffset < total ? nextOffset : currentOffset;
}

/**
 * Get the previous offset for pagination
 *
 * @param currentOffset - Current offset
 * @param limit - Entries per page
 * @returns Previous offset or 0 if at the beginning
 */
export function getPreviousOffset(currentOffset: number, limit: number): number {
  return Math.max(0, currentOffset - limit);
}

/**
 * Prefetch glossary data into the query cache
 *
 * Useful for preloading glossary data before navigation.
 *
 * @param queryClient - React Query client instance
 * @param glossaryId - Glossary ID to prefetch
 *
 * @example
 * ```typescript
 * import { useQueryClient } from '@tanstack/react-query';
 * import { prefetchGlossary } from '@/features/activities/glossary/hooks/useGlossary';
 *
 * function GlossaryLink({ glossaryId }: { glossaryId: number }) {
 *   const queryClient = useQueryClient();
 *
 *   return (
 *     <Link
 *       to={`/glossary/${glossaryId}`}
 *       onMouseEnter={() => prefetchGlossary(queryClient, glossaryId)}
 *     >
 *       View Glossary
 *     </Link>
 *   );
 * }
 * ```
 */
export async function prefetchGlossary(
  queryClient: { prefetchQuery: (options: UseQueryOptions<Glossary, Error>) => Promise<void> },
  glossaryId: number
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: glossaryKeys.detail(glossaryId),
    queryFn: () => getGlossary(glossaryId),
    staleTime: DEFAULT_STALE_TIME,
  });
}

/**
 * Prefetch glossary entries into the query cache
 *
 * Useful for preloading entry data for the next page.
 *
 * @param queryClient - React Query client instance
 * @param glossaryId - Glossary ID
 * @param params - Entry fetch parameters
 *
 * @example
 * ```typescript
 * // Prefetch next page on hover
 * const handleHoverNextPage = () => {
 *   prefetchGlossaryEntries(queryClient, glossaryId, {
 *     ...params,
 *     offset: offset + limit,
 *   });
 * };
 * ```
 */
export async function prefetchGlossaryEntries(
  queryClient: { prefetchQuery: (options: UseQueryOptions<GlossaryEntriesResult, Error>) => Promise<void> },
  glossaryId: number,
  params: GlossaryEntriesParams = {}
): Promise<void> {
  const normalizedParams: GlossaryEntriesParams = {
    mode: params.mode ?? 'letter',
    hook: params.hook ?? 'ALL',
    offset: params.offset ?? 0,
    limit: params.limit ?? DEFAULT_LIMIT,
    sortkey: params.sortkey,
    sortorder: params.sortorder ?? 'asc',
    fullsearch: params.fullsearch ?? false,
  };

  const filters = paramsToFilters(normalizedParams);

  await queryClient.prefetchQuery({
    queryKey: glossaryKeys.entries(glossaryId, normalizedParams),
    queryFn: async (): Promise<GlossaryEntriesResult> => {
      const result = await getEntries(glossaryId, filters);
      return {
        entries: result.entries,
        total: result.total,
      };
    },
    staleTime: DEFAULT_ENTRIES_STALE_TIME,
  });
}
