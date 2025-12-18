/**
 * Custom React hook for wiki page data management.
 *
 * This hook provides comprehensive functionality for fetching, editing, and creating
 * wiki pages using React Query. It includes page content retrieval, version history
 * tracking, optimistic updates for edits, and automatic cache invalidation.
 *
 * @module features/activities/wiki/hooks/useWikiPage
 * @packageDocumentation
 *
 * Backend References:
 * - public/mod/wiki/locallib.php:
 *   - wiki_get_page() (lines 134-137) - fetches page data
 *   - wiki_get_current_version() (lines 144-155) - fetches current version
 *   - wiki_save_page() (lines 240-276) - saves page content
 *   - wiki_create_page() (lines 355-407) - creates new pages
 *   - wiki_get_subwiki() (lines 88-92) - gets subwiki context
 *   - wiki_get_linked_to_pages() (lines 454-457) - outbound links
 *   - wiki_get_linked_from_pages() (lines 463-466) - inbound links
 *
 * API Endpoints:
 * - GET    /api/v1/wiki/{id}                    - Get wiki page details
 * - GET    /api/v1/wiki/page/{pageId}/history   - Get page version history
 * - POST   /api/v1/wiki/{id}/save               - Save page content
 * - POST   /api/v1/wiki/{wikiId}/create         - Create new page
 * - GET    /api/v1/wiki/page/{pageId}/links     - Get linked pages
 *
 * Features:
 * - Page data fetching with automatic caching
 * - Version history retrieval and tracking
 * - Page editing with optimistic updates
 * - Page creation within subwikis
 * - Linked pages navigation (inbound/outbound)
 * - Integration with useWiki for wiki instance context
 * - TypeScript strict mode with comprehensive type definitions
 *
 * @example Basic usage
 * ```tsx
 * import { useWikiPage } from '@/features/activities/wiki/hooks/useWikiPage';
 *
 * function WikiPageView({ wikiId, pageId }: { wikiId: number; pageId: number }) {
 *   const {
 *     page,
 *     isLoading,
 *     error,
 *     currentVersion,
 *     versionHistory,
 *   } = useWikiPage(wikiId, pageId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!page) return <NotFound />;
 *
 *   return (
 *     <div>
 *       <h1>{page.title}</h1>
 *       <div dangerouslySetInnerHTML={{ __html: page.cachedcontent || '' }} />
 *       <p>Version: {currentVersion?.version}</p>
 *     </div>
 *   );
 * }
 * ```
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';

// Internal imports from wiki API module
import {
  fetchWikiPage,
  fetchPageHistory,
  saveWikiPage,
  createWikiPage,
  fetchLinkedPages,
} from '../api/wikiApi';

// Internal type imports from wiki types
import type {
  WikiPage,
  WikiVersion,
  WikiLink,
  CreateWikiPageParams,
  WikiSaveRequest,
  SaveWikiPageResult,
  WikiFormat,
} from '../types/wiki.types';

// Internal import from useWiki hook for wiki instance context
import { useWiki } from './useWiki';
import type { Wiki } from '../types/wiki.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Query key factory for wiki page-related queries.
 * Ensures consistent cache key generation across the application.
 */
const WIKI_PAGE_QUERY_KEYS = {
  /**
   * Base key for all wiki queries
   */
  all: ['wikis'] as const,

  /**
   * Generates a cache key for a specific wiki's pages
   * @param wikiId - The wiki instance ID
   */
  wikiPages: (wikiId: number) => ['wikis', wikiId, 'pages'] as const,

  /**
   * Generates a cache key for a specific wiki page
   * @param wikiId - The wiki instance ID
   * @param pageId - The page ID
   */
  page: (wikiId: number, pageId: number) =>
    ['wikis', wikiId, 'pages', pageId] as const,

  /**
   * Generates a cache key for a page's version history
   * @param wikiId - The wiki instance ID
   * @param pageId - The page ID
   */
  history: (wikiId: number, pageId: number) =>
    ['wikis', wikiId, 'pages', pageId, 'history'] as const,

  /**
   * Generates a cache key for a page's linked pages
   * @param wikiId - The wiki instance ID
   * @param pageId - The page ID
   */
  links: (wikiId: number, pageId: number) =>
    ['wikis', wikiId, 'pages', pageId, 'links'] as const,
} as const;

/**
 * Default stale time for page queries (2 minutes in milliseconds).
 * Wiki pages may be edited more frequently than wiki configuration,
 * so a shorter stale time ensures fresh content.
 */
const PAGE_STALE_TIME = 2 * 60 * 1000; // 2 minutes

/**
 * Default stale time for version history queries (5 minutes in milliseconds).
 * Version history is append-only, so longer stale time is acceptable.
 */
const HISTORY_STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Default garbage collection time for page queries (10 minutes).
 */
const PAGE_GC_TIME = 10 * 60 * 1000; // 10 minutes

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Configuration options for the useWikiPage hook.
 */
export interface UseWikiPageOptions {
  /**
   * Whether the query should automatically run.
   * @default true
   */
  enabled?: boolean;

  /**
   * Time in milliseconds before data is considered stale.
   * @default 120000 (2 minutes)
   */
  staleTime?: number;

  /**
   * Whether to refetch data when window regains focus.
   * @default true
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Whether to fetch version history along with page data.
   * @default true
   */
  includeHistory?: boolean;

  /**
   * Whether to fetch linked pages information.
   * @default false
   */
  includeLinks?: boolean;

  /**
   * Number of times to retry failed queries.
   * @default 3
   */
  retry?: number | boolean;
}

/**
 * Structure for linked pages data.
 */
export interface WikiLinkedPages {
  /** Pages that link TO this page */
  inboundLinks: WikiLink[];
  /** Pages that this page links TO */
  outboundLinks: WikiLink[];
}

/**
 * Parameters for editing a wiki page.
 */
export interface EditWikiPageParams {
  /** New content for the page */
  content: string;
  /** Content format (html, creole, nwiki) */
  contentFormat: WikiFormat;
}

/**
 * Parameters for creating a new wiki page.
 */
export interface CreatePageParams {
  /** Title of the new page */
  title: string;
  /** Initial content for the page */
  content: string;
  /** Content format (html, creole, nwiki) */
  contentFormat: WikiFormat;
  /** Subwiki ID where the page will be created */
  subwikiId: number;
}

/**
 * Return type for the useWikiPage hook.
 * Provides comprehensive access to page data, operations, and state.
 */
export interface UseWikiPageResult {
  // ========== Page Data ==========
  /**
   * The fetched wiki page data.
   * Contains id, subwikiid, title, cachedcontent, timestamps, userid, pageviews, readonly.
   */
  page: WikiPage | undefined;

  /**
   * The current (latest) version of the page.
   * Contains version number, content, contentformat, userid, timecreated.
   */
  currentVersion: WikiVersion | undefined;

  /**
   * Complete version history of the page (newest first).
   * Only populated if includeHistory option is true.
   */
  versionHistory: WikiVersion[];

  /**
   * Linked pages data (inbound and outbound links).
   * Only populated if includeLinks option is true.
   */
  linkedPages: WikiLinkedPages | undefined;

  /**
   * The parent wiki instance data.
   * Provides context about wiki mode, format, and permissions.
   */
  wiki: Wiki | undefined;

  // ========== Loading States ==========
  /**
   * Whether the page data is currently being fetched.
   */
  isLoading: boolean;

  /**
   * Whether the page query is currently loading for the first time.
   */
  isPageLoading: boolean;

  /**
   * Whether the version history is currently being fetched.
   */
  isHistoryLoading: boolean;

  /**
   * Whether the linked pages data is being fetched.
   */
  isLinksLoading: boolean;

  /**
   * Whether any data is being fetched in the background.
   */
  isFetching: boolean;

  // ========== Error States ==========
  /**
   * Error that occurred during page fetch, if any.
   */
  error: Error | null;

  /**
   * Error that occurred during history fetch, if any.
   */
  historyError: Error | null;

  /**
   * Error that occurred during links fetch, if any.
   */
  linksError: Error | null;

  // ========== Edit Operations ==========
  /**
   * Mutation for saving page edits.
   * Uses optimistic updates for immediate UI feedback.
   */
  editPage: UseMutationResult<SaveWikiPageResult, Error, EditWikiPageParams>;

  /**
   * Whether a page edit is currently in progress.
   */
  isEditing: boolean;

  /**
   * Error from the last edit operation, if any.
   */
  editError: Error | null;

  // ========== Create Operations ==========
  /**
   * Mutation for creating new wiki pages.
   * Automatically invalidates page list cache after creation.
   */
  createPage: UseMutationResult<SaveWikiPageResult, Error, CreatePageParams>;

  /**
   * Whether a page creation is currently in progress.
   */
  isCreating: boolean;

  /**
   * Error from the last create operation, if any.
   */
  createError: Error | null;

  // ========== Utility Functions ==========
  /**
   * Manually refetch the page data.
   */
  refetchPage: () => Promise<WikiPage | undefined>;

  /**
   * Manually refetch the version history.
   */
  refetchHistory: () => Promise<WikiVersion[] | undefined>;

  /**
   * Manually refetch the linked pages.
   */
  refetchLinks: () => Promise<WikiLinkedPages | undefined>;

  /**
   * Invalidate all cached data for this page.
   */
  invalidatePageCache: () => Promise<void>;

  // ========== Page State Helpers ==========
  /**
   * Whether the page is read-only (cannot be edited).
   */
  isReadonly: boolean;

  /**
   * Whether the current user can edit this page.
   * Combines page readonly status with wiki-level permissions.
   */
  canEdit: boolean;

  /**
   * Whether the current user can create new pages in the wiki.
   */
  canCreate: boolean;

  /**
   * The content format of the page.
   */
  contentFormat: WikiFormat | undefined;
}

// ============================================================================
// MAIN HOOK IMPLEMENTATION
// ============================================================================

/**
 * Custom hook for managing wiki page data, editing, and creation.
 *
 * This hook integrates with React Query for efficient data fetching and caching,
 * providing comprehensive functionality for wiki page operations including:
 *
 * - **Page fetching**: Retrieves page data with automatic caching
 * - **Version history**: Tracks all page versions for history/comparison
 * - **Page editing**: Saves content changes with optimistic updates
 * - **Page creation**: Creates new pages within a subwiki
 * - **Link navigation**: Retrieves inbound and outbound page links
 *
 * The hook also integrates with useWiki to provide wiki instance context,
 * including mode (collaborative/individual), editor format preferences,
 * and permission information.
 *
 * @param wikiId - The ID of the wiki instance containing the page
 * @param pageId - The ID of the page to fetch (0 or undefined for new pages)
 * @param options - Optional configuration for query behavior
 * @returns UseWikiPageResult with page data, operations, and state
 *
 * @example Viewing a page
 * ```tsx
 * function PageViewer({ wikiId, pageId }: Props) {
 *   const { page, isLoading, error, currentVersion } = useWikiPage(wikiId, pageId);
 *
 *   if (isLoading) return <Skeleton />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <article>
 *       <h1>{page?.title}</h1>
 *       <p>Version {currentVersion?.version}</p>
 *       <div dangerouslySetInnerHTML={{ __html: page?.cachedcontent || '' }} />
 *     </article>
 *   );
 * }
 * ```
 *
 * @example Editing a page
 * ```tsx
 * function PageEditor({ wikiId, pageId }: Props) {
 *   const { page, editPage, isEditing, canEdit } = useWikiPage(wikiId, pageId);
 *   const [content, setContent] = useState(page?.cachedcontent || '');
 *
 *   const handleSave = () => {
 *     editPage.mutate({
 *       content,
 *       contentFormat: 'html',
 *     });
 *   };
 *
 *   if (!canEdit) return <p>You cannot edit this page</p>;
 *
 *   return (
 *     <form onSubmit={handleSave}>
 *       <textarea value={content} onChange={(e) => setContent(e.target.value)} />
 *       <button type="submit" disabled={isEditing}>
 *         {isEditing ? 'Saving...' : 'Save'}
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @example Creating a new page
 * ```tsx
 * function CreatePage({ wikiId, subwikiId }: Props) {
 *   const { createPage, isCreating, wiki } = useWikiPage(wikiId, 0);
 *   const [title, setTitle] = useState('');
 *   const [content, setContent] = useState('');
 *
 *   const handleCreate = () => {
 *     createPage.mutate({
 *       title,
 *       content,
 *       contentFormat: wiki?.defaultformat || 'html',
 *       subwikiId,
 *     });
 *   };
 *
 *   return (
 *     <form onSubmit={handleCreate}>
 *       <input value={title} onChange={(e) => setTitle(e.target.value)} />
 *       <textarea value={content} onChange={(e) => setContent(e.target.value)} />
 *       <button type="submit" disabled={isCreating}>Create</button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @example Viewing page history
 * ```tsx
 * function PageHistory({ wikiId, pageId }: Props) {
 *   const { versionHistory, isHistoryLoading } = useWikiPage(wikiId, pageId, {
 *     includeHistory: true,
 *   });
 *
 *   if (isHistoryLoading) return <Skeleton />;
 *
 *   return (
 *     <ul>
 *       {versionHistory.map((version) => (
 *         <li key={version.id}>
 *           Version {version.version} - {new Date(version.timecreated * 1000).toLocaleString()}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useWikiPage(
  wikiId: number,
  pageId: number,
  options: UseWikiPageOptions = {}
): UseWikiPageResult {
  const {
    enabled = true,
    staleTime = PAGE_STALE_TIME,
    refetchOnWindowFocus = true,
    includeHistory = true,
    includeLinks = false,
    retry = 3,
  } = options;

  // Get query client for cache invalidation
  const queryClient = useQueryClient();

  // Fetch wiki instance data for context (mode, format, permissions)
  const wikiQuery = useWiki(wikiId, {
    enabled: enabled && wikiId > 0,
    staleTime: 5 * 60 * 1000, // Wiki config changes less frequently
  });

  // Determine if page query should run
  const shouldFetchPage = enabled && wikiId > 0 && pageId > 0;

  // ========== Page Query ==========
  const pageQuery = useQuery<WikiPage, Error>({
    queryKey: WIKI_PAGE_QUERY_KEYS.page(wikiId, pageId),
    queryFn: () => fetchWikiPage(pageId),
    enabled: shouldFetchPage,
    staleTime,
    gcTime: PAGE_GC_TIME,
    refetchOnWindowFocus,
    retry,
    meta: {
      description: 'Fetches wiki page data including content and metadata',
      endpoint: `GET /api/v1/wiki/${pageId}`,
    },
  });

  // ========== Version History Query ==========
  const historyQuery = useQuery<WikiVersion[], Error>({
    queryKey: WIKI_PAGE_QUERY_KEYS.history(wikiId, pageId),
    queryFn: () => fetchPageHistory(pageId),
    enabled: shouldFetchPage && includeHistory,
    staleTime: HISTORY_STALE_TIME,
    gcTime: PAGE_GC_TIME,
    refetchOnWindowFocus: false, // History doesn't change as frequently
    retry,
    meta: {
      description: 'Fetches wiki page version history',
      endpoint: `GET /api/v1/wiki/page/${pageId}/history`,
    },
  });

  // ========== Linked Pages Query ==========
  const linksQuery = useQuery<WikiLinkedPages, Error>({
    queryKey: WIKI_PAGE_QUERY_KEYS.links(wikiId, pageId),
    queryFn: async () => {
      const result = await fetchLinkedPages(pageId);
      return {
        inboundLinks: result.inboundLinks,
        outboundLinks: result.outboundLinks,
      };
    },
    enabled: shouldFetchPage && includeLinks,
    staleTime: HISTORY_STALE_TIME,
    gcTime: PAGE_GC_TIME,
    refetchOnWindowFocus: false,
    retry,
    meta: {
      description: 'Fetches pages linked to/from this page',
      endpoint: `GET /api/v1/wiki/page/${pageId}/links`,
    },
  });

  // ========== Edit Page Mutation ==========
  // Context type for optimistic updates - stores previous page for rollback
  type EditMutationContext = { previousPage: WikiPage | undefined };
  
  const editMutation = useMutation<SaveWikiPageResult, Error, EditWikiPageParams, EditMutationContext>({
    mutationFn: async (params: EditWikiPageParams) => {
      const saveRequest: WikiSaveRequest = {
        content: params.content,
        contentFormat: params.contentFormat,
      };
      return saveWikiPage(pageId, saveRequest);
    },
    // Optimistic update for immediate UI feedback
    onMutate: async (params: EditWikiPageParams) => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: WIKI_PAGE_QUERY_KEYS.page(wikiId, pageId),
      });

      // Snapshot the previous value for rollback
      const previousPage = queryClient.getQueryData<WikiPage>(
        WIKI_PAGE_QUERY_KEYS.page(wikiId, pageId)
      );

      // Optimistically update the page data
      if (previousPage) {
        const optimisticPage: WikiPage = {
          ...previousPage,
          cachedcontent: params.content,
          timemodified: Math.floor(Date.now() / 1000),
          contentformat: params.contentFormat,
        };
        queryClient.setQueryData<WikiPage>(
          WIKI_PAGE_QUERY_KEYS.page(wikiId, pageId),
          optimisticPage
        );
      }

      // Return context with previous value for rollback
      return { previousPage };
    },
    // Rollback on error
    onError: (_error, _params, context) => {
      if (context?.previousPage) {
        queryClient.setQueryData<WikiPage>(
          WIKI_PAGE_QUERY_KEYS.page(wikiId, pageId),
          context.previousPage
        );
      }
    },
    // Invalidate and refetch on success
    onSuccess: () => {
      // Invalidate page data to get fresh content
      queryClient.invalidateQueries({
        queryKey: WIKI_PAGE_QUERY_KEYS.page(wikiId, pageId),
      });

      // Invalidate version history since a new version was created
      queryClient.invalidateQueries({
        queryKey: WIKI_PAGE_QUERY_KEYS.history(wikiId, pageId),
      });

      // Invalidate links since content change may affect links
      queryClient.invalidateQueries({
        queryKey: WIKI_PAGE_QUERY_KEYS.links(wikiId, pageId),
      });
    },
  });

  // ========== Create Page Mutation ==========
  const createMutation = useMutation<SaveWikiPageResult, Error, CreatePageParams>({
    mutationFn: async (params: CreatePageParams) => {
      const createParams: CreateWikiPageParams = {
        title: params.title,
        content: params.content,
        contentformat: params.contentFormat,
        subwikiid: params.subwikiId,
      };
      return createWikiPage(wikiId, createParams);
    },
    // Invalidate page list cache after successful creation
    onSuccess: (result) => {
      // Invalidate the wiki's page list to include the new page
      queryClient.invalidateQueries({
        queryKey: WIKI_PAGE_QUERY_KEYS.wikiPages(wikiId),
      });

      // If we have the new page ID, we can prefetch its data
      if (result.pageid) {
        queryClient.invalidateQueries({
          queryKey: WIKI_PAGE_QUERY_KEYS.page(wikiId, result.pageid),
        });
      }
    },
  });

  // ========== Derive Current Version ==========
  // The current version is the first item in the history (newest first)
  const currentVersion =
    historyQuery.data && historyQuery.data.length > 0
      ? historyQuery.data[0]
      : undefined;

  // ========== Compute Permission Flags ==========
  const page = pageQuery.data;
  const wiki = wikiQuery.data;

  // Check if page is read-only
  const isReadonly = page?.readonly === 1;

  // Check if user can edit (page is not readonly and user has page edit permission)
  const canEdit = !isReadonly && (page?.caneditpage ?? false);

  // Check if user can create new pages (from wiki instance permissions)
  const canCreate = wiki?.cancreatepages ?? false;

  // Get content format from page or wiki default
  const contentFormat = page?.contentformat ?? wiki?.defaultformat;

  // ========== Utility Functions ==========
  const refetchPage = async (): Promise<WikiPage | undefined> => {
    const result = await pageQuery.refetch();
    return result.data;
  };

  const refetchHistory = async (): Promise<WikiVersion[] | undefined> => {
    const result = await historyQuery.refetch();
    return result.data;
  };

  const refetchLinks = async (): Promise<WikiLinkedPages | undefined> => {
    const result = await linksQuery.refetch();
    return result.data;
  };

  const invalidatePageCache = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: WIKI_PAGE_QUERY_KEYS.page(wikiId, pageId),
      }),
      queryClient.invalidateQueries({
        queryKey: WIKI_PAGE_QUERY_KEYS.history(wikiId, pageId),
      }),
      queryClient.invalidateQueries({
        queryKey: WIKI_PAGE_QUERY_KEYS.links(wikiId, pageId),
      }),
    ]);
  };

  // ========== Return Result Object ==========
  return {
    // Page data
    page: pageQuery.data,
    currentVersion,
    versionHistory: historyQuery.data ?? [],
    linkedPages: linksQuery.data,
    wiki: wikiQuery.data,

    // Loading states
    isLoading: pageQuery.isLoading || wikiQuery.isLoading,
    isPageLoading: pageQuery.isLoading,
    isHistoryLoading: historyQuery.isLoading,
    isLinksLoading: linksQuery.isLoading,
    isFetching: pageQuery.isFetching || historyQuery.isFetching || linksQuery.isFetching,

    // Error states
    error: pageQuery.error,
    historyError: historyQuery.error,
    linksError: linksQuery.error,

    // Edit operations
    editPage: editMutation,
    isEditing: editMutation.isPending,
    editError: editMutation.error,

    // Create operations
    createPage: createMutation,
    isCreating: createMutation.isPending,
    createError: createMutation.error,

    // Utility functions
    refetchPage,
    refetchHistory,
    refetchLinks,
    invalidatePageCache,

    // Permission flags
    isReadonly,
    canEdit,
    canCreate,
    contentFormat,
  };
}

// ============================================================================
// UTILITY FUNCTIONS FOR QUERY KEY MANAGEMENT
// ============================================================================

/**
 * Gets the query key for a specific wiki page.
 * Useful for manual cache invalidation or prefetching.
 *
 * @param wikiId - The wiki instance ID
 * @param pageId - The page ID
 * @returns The query key array for the specified page
 *
 * @example Prefetching a page
 * ```tsx
 * const queryClient = useQueryClient();
 *
 * // Prefetch page data when hovering over a link
 * const handleMouseEnter = (pageId: number) => {
 *   queryClient.prefetchQuery({
 *     queryKey: getWikiPageQueryKey(wikiId, pageId),
 *     queryFn: () => fetchWikiPage(pageId),
 *   });
 * };
 * ```
 */
export function getWikiPageQueryKey(
  wikiId: number,
  pageId: number
): readonly ['wikis', number, 'pages', number] {
  return WIKI_PAGE_QUERY_KEYS.page(wikiId, pageId);
}

/**
 * Gets the query key for a page's version history.
 *
 * @param wikiId - The wiki instance ID
 * @param pageId - The page ID
 * @returns The query key array for the page's history
 */
export function getWikiPageHistoryQueryKey(
  wikiId: number,
  pageId: number
): readonly ['wikis', number, 'pages', number, 'history'] {
  return WIKI_PAGE_QUERY_KEYS.history(wikiId, pageId);
}

/**
 * Gets the query key for a page's linked pages.
 *
 * @param wikiId - The wiki instance ID
 * @param pageId - The page ID
 * @returns The query key array for the page's links
 */
export function getWikiPageLinksQueryKey(
  wikiId: number,
  pageId: number
): readonly ['wikis', number, 'pages', number, 'links'] {
  return WIKI_PAGE_QUERY_KEYS.links(wikiId, pageId);
}

/**
 * Gets the query key for all pages in a wiki.
 * Useful for invalidating the entire page list cache.
 *
 * @param wikiId - The wiki instance ID
 * @returns The query key array for all pages in the wiki
 *
 * @example Invalidating all pages in a wiki
 * ```tsx
 * const queryClient = useQueryClient();
 *
 * const handleBulkUpdate = async () => {
 *   // After bulk operation, invalidate all pages
 *   await queryClient.invalidateQueries({
 *     queryKey: getWikiPagesQueryKey(wikiId),
 *   });
 * };
 * ```
 */
export function getWikiPagesQueryKey(
  wikiId: number
): readonly ['wikis', number, 'pages'] {
  return WIKI_PAGE_QUERY_KEYS.wikiPages(wikiId);
}

// ============================================================================
// TYPE EXPORTS FOR CONSUMERS
// ============================================================================

// Re-export types for convenience when using this hook
export type {
  WikiPage,
  WikiVersion,
  WikiLink,
  WikiFormat,
  CreateWikiPageParams,
  SaveWikiPageResult,
} from '../types/wiki.types';
