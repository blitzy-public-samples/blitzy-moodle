/**
 * Wiki Activity API Module
 *
 * Provides comprehensive TypeScript API integration for the wiki activity module.
 * All functions call REST API endpoints that wrap existing Moodle PHP wiki functions
 * from locallib.php without reimplementing any business logic.
 *
 * @module features/activities/wiki/api/wikiApi
 * @packageDocumentation
 *
 * Backend References:
 * - public/mod/wiki/locallib.php (wiki_get_page, wiki_save_page, wiki_create_page)
 * - public/mod/wiki/view.php (page viewing)
 * - public/mod/wiki/edit.php (page editing)
 * - public/mod/wiki/history.php (version history)
 *
 * API Endpoints:
 * - GET    /api/v1/wiki/{id}                           - Get wiki details
 * - GET    /api/v1/wiki/{wikiId}/page/{title}          - Get page by title
 * - GET    /api/v1/wiki/{id}/firstpage                 - Get first page
 * - POST   /api/v1/wiki/{id}/save                      - Save wiki page
 * - POST   /api/v1/wiki/{id}/savesection               - Save wiki page section
 * - POST   /api/v1/wiki/{id}/create                    - Create new page
 * - GET    /api/v1/wiki/page/{pageId}/history          - Get page history
 * - GET    /api/v1/wiki/page/{pageId}/version/{verId}  - Get specific version
 * - POST   /api/v1/wiki/page/{pageId}/restore/{verId}  - Restore version
 * - GET    /api/v1/wiki/{id}/pages                     - List wiki pages
 * - GET    /api/v1/wiki/{id}/search                    - Search wiki pages
 * - GET    /api/v1/wiki/page/{pageId}/links            - Get linked pages
 * - GET    /api/v1/wiki/page/{pageId}/lock             - Check page lock
 * - POST   /api/v1/wiki/page/{pageId}/lock             - Acquire page lock
 * - DELETE /api/v1/wiki/page/{pageId}/lock             - Release page lock
 * - POST   /api/v1/wiki/page/{pageId}/lock/heartbeat   - Lock heartbeat
 * - POST   /api/v1/wiki/page/{pageId}/preview          - Preview page content
 */

import { apiClient, extractData } from '@/services/api/client';
import type { ApiResponse } from '@/types/api';
import { WIKI_ENDPOINTS } from '@/services/api/endpoints';
import type {
  Wiki,
  WikiPage,
  WikiVersion,
  WikiPageLock,
  WikiLink,
  WikiPageListResponse,
  WikiVersionListResponse,
  CreateWikiPageParams,
  SaveWikiPageResult,
  WikiSaveRequest,
  WikiPreviewResponse,
  WikiFormat,
} from '../types/wiki.types';

// ============================================================================
// TYPE DEFINITIONS FOR API RESPONSES
// ============================================================================

/**
 * Response for wiki page by title lookup
 */
interface WikiPageByTitleResponse {
  page: WikiPage;
}

/**
 * Response for first page retrieval
 */
interface WikiFirstPageResponse {
  page: WikiPage;
  subwikiid: number;
}

/**
 * Parameters for saving a wiki page
 */
interface SaveWikiPageParams {
  /** Page ID to save */
  pageid: number;
  /** Page content */
  content: string;
  /** Content format (html, creole, nwiki) */
  contentformat: WikiFormat;
}

/**
 * Parameters for saving a wiki page section
 */
interface SaveWikiSectionParams {
  /** Page ID containing the section */
  pageid: number;
  /** Section identifier/name */
  section: string;
  /** Section content */
  content: string;
  /** Content format */
  contentformat: WikiFormat;
}

/**
 * Response for page version retrieval
 */
interface WikiVersionResponse {
  version: WikiVersion;
  /** Rendered HTML content of this version */
  renderedContent?: string;
}

/**
 * Parameters for restoring a page version
 */
interface RestoreVersionParams {
  /** Optional comment explaining the restore */
  comment?: string;
}

/**
 * Result of a version restore operation
 */
interface RestoreVersionResult {
  /** Whether the restore was successful */
  success: boolean;
  /** New page version number after restore */
  newVersion: number;
  /** Page ID that was restored */
  pageid: number;
  /** Optional message about the restore */
  message?: string;
}

/**
 * Parameters for wiki page search
 */
interface SearchWikiPagesParams {
  /** Search query string */
  query: string;
  /** Whether to search in content as well as titles */
  includeContent?: boolean;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Response for wiki page search
 */
interface WikiSearchResponse {
  /** Matching pages */
  pages: WikiPage[];
  /** Total count of matching pages */
  total: number;
}

/**
 * Parameters for fetching page list
 */
interface FetchPageListParams {
  /** Field to sort by */
  sortby?: 'title' | 'timemodified' | 'timecreated';
  /** Sort direction */
  sortdirection?: 'ASC' | 'DESC';
  /** Whether to include page content */
  includecontent?: boolean;
  /** Subwiki ID to filter by */
  subwikiid?: number;
}

/**
 * Response for linked pages retrieval
 */
interface WikiLinkedPagesResponse {
  /** Pages that link TO the specified page (inbound links) */
  inboundLinks: WikiLink[];
  /** Pages that the specified page links TO (outbound links) */
  outboundLinks: WikiLink[];
}

/**
 * Response for page lock status check
 */
interface LockStatusResponse {
  /** Whether the page is currently locked */
  locked: boolean;
  /** Lock details if page is locked */
  lock?: WikiPageLock;
  /** Whether the current user holds the lock */
  ownedByCurrentUser: boolean;
  /** Time remaining on the lock in seconds */
  timeRemaining?: number;
}

/**
 * Response for lock acquisition
 */
interface LockAcquireResponse {
  /** Whether lock was successfully acquired */
  success: boolean;
  /** Lock details if acquired */
  lock?: WikiPageLock;
  /** Message about lock status */
  message: string;
  /** Time until lock expires in seconds */
  expiresIn?: number;
}

/**
 * Response for lock release
 */
interface LockReleaseResponse {
  /** Whether lock was successfully released */
  success: boolean;
  /** Message about unlock status */
  message: string;
}

/**
 * Parameters for lock acquisition
 */
interface AcquireLockParams {
  /** Optional section name if locking a specific section */
  section?: string;
}

/**
 * Response for lock heartbeat
 */
interface LockHeartbeatResponse {
  /** Whether heartbeat was successful */
  success: boolean;
  /** Time until lock expires in seconds (reset by heartbeat) */
  expiresIn: number;
  /** Message about heartbeat status */
  message?: string;
}

// ============================================================================
// API FUNCTIONS - WIKI RETRIEVAL
// ============================================================================

/**
 * Fetch wiki activity details
 *
 * Retrieves comprehensive wiki information including configuration, mode,
 * editing settings, and current user permissions.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/{id}
 * Wraps: wiki_get_wiki() from lib.php
 *
 * @param wikiId - Wiki module instance ID
 * @returns Promise resolving to Wiki data with configuration and permissions
 * @throws Error if wiki not found or user lacks access permission
 *
 * @example
 * ```typescript
 * const wiki = await fetchWiki(123);
 * console.log(wiki.name, wiki.wikimode);
 * ```
 */
export async function fetchWiki(wikiId: number): Promise<Wiki> {
  const response = await apiClient.get<ApiResponse<Wiki>>(
    WIKI_ENDPOINTS.DETAIL(wikiId)
  );
  return extractData(response);
}

/**
 * Fetch a specific wiki page by ID
 *
 * Retrieves complete page information including content, metadata,
 * version number, and edit permissions. The content returned is the
 * cached rendered HTML content.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/{id}
 * Wraps: wiki_get_page() from locallib.php
 *
 * @param pageId - Wiki page ID to retrieve
 * @returns Promise resolving to WikiPage with content and metadata
 * @throws Error if page not found or user lacks access permission
 *
 * @example
 * ```typescript
 * const page = await fetchWikiPage(456);
 * console.log(page.title, page.cachedcontent);
 * ```
 */
export async function fetchWikiPage(pageId: number): Promise<WikiPage> {
  const response = await apiClient.get<ApiResponse<WikiPage>>(
    WIKI_ENDPOINTS.DETAIL(pageId)
  );
  return extractData(response);
}

/**
 * Fetch a wiki page by its title
 *
 * Retrieves a page using its title within a specific wiki/subwiki context.
 * Useful for following internal wiki links where only the title is known.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/{wikiId}/page/{title}
 * Wraps: wiki_get_page_by_title() from locallib.php
 *
 * @param wikiId - Wiki module instance ID
 * @param title - Page title to search for (case-sensitive)
 * @returns Promise resolving to WikiPage if found
 * @throws Error if page not found or user lacks access permission
 *
 * @example
 * ```typescript
 * const page = await fetchWikiByTitle(123, 'Introduction');
 * console.log(page.id, page.content);
 * ```
 */
export async function fetchWikiByTitle(
  wikiId: number,
  title: string
): Promise<WikiPage> {
  const response = await apiClient.get<ApiResponse<WikiPageByTitleResponse>>(
    WIKI_ENDPOINTS.BY_TITLE(wikiId, title)
  );
  const data = extractData(response);
  return data.page;
}

/**
 * Fetch the first/main page of a wiki
 *
 * Retrieves the designated first page of a wiki, which is the landing page
 * displayed when entering the wiki activity. The first page title is configured
 * in the wiki settings.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/{id}/firstpage
 * Wraps: wiki_get_first_page() from locallib.php
 *
 * @param wikiId - Wiki module instance ID
 * @returns Promise resolving to the first WikiPage
 * @throws Error if wiki has no pages yet or user lacks access permission
 *
 * @example
 * ```typescript
 * const firstPage = await fetchFirstPage(123);
 * // Navigate user to the first page
 * navigateToPage(firstPage.id);
 * ```
 */
export async function fetchFirstPage(wikiId: number): Promise<WikiPage> {
  const response = await apiClient.get<ApiResponse<WikiFirstPageResponse>>(
    WIKI_ENDPOINTS.FIRST_PAGE(wikiId)
  );
  const data = extractData(response);
  return data.page;
}

// ============================================================================
// API FUNCTIONS - PAGE EDITING
// ============================================================================

/**
 * Save/update a wiki page
 *
 * Saves changes to an existing wiki page, creating a new version in the
 * history. The user must hold an active edit lock on the page before saving.
 * After successful save, the lock should be released.
 *
 * Maps to PHP endpoint: POST /api/v1/wiki/{id}/save
 * Wraps: wiki_save_page() from locallib.php
 *
 * @param pageId - Page ID to update
 * @param params - Save parameters including content and format
 * @returns Promise resolving to save result with new version number
 * @throws Error if no lock held, content validation fails, or access denied
 *
 * @example
 * ```typescript
 * const result = await saveWikiPage(456, {
 *   content: '== Updated Content ==\nNew paragraph here.',
 *   contentFormat: 'creole'
 * });
 * console.log(`Saved as version ${result.version}`);
 * ```
 */
export async function saveWikiPage(
  pageId: number,
  params: WikiSaveRequest
): Promise<SaveWikiPageResult> {
  const requestBody: SaveWikiPageParams = {
    pageid: pageId,
    content: params.content,
    contentformat: params.contentFormat,
  };

  const response = await apiClient.post<ApiResponse<SaveWikiPageResult>>(
    WIKI_ENDPOINTS.SAVE(pageId),
    requestBody
  );
  return extractData(response);
}

/**
 * Save a specific section of a wiki page
 *
 * Saves changes to a specific named section within a wiki page while
 * preserving other sections. Useful for large pages where users only
 * want to edit part of the content. Creates a new version in history.
 *
 * Maps to PHP endpoint: POST /api/v1/wiki/{id}/savesection
 * Wraps: wiki_save_section() from locallib.php
 *
 * @param pageId - Page ID containing the section
 * @param section - Section identifier/name to update
 * @param params - Save parameters including section content and format
 * @returns Promise resolving to save result with new version number
 * @throws Error if section not found, no lock held, or access denied
 *
 * @example
 * ```typescript
 * const result = await saveWikiSection(456, 'introduction', {
 *   content: '== Introduction ==\nUpdated intro text.',
 *   contentFormat: 'creole'
 * });
 * ```
 */
export async function saveWikiSection(
  pageId: number,
  section: string,
  params: WikiSaveRequest
): Promise<SaveWikiPageResult> {
  const requestBody: SaveWikiSectionParams = {
    pageid: pageId,
    section,
    content: params.content,
    contentformat: params.contentFormat,
  };

  const response = await apiClient.post<ApiResponse<SaveWikiPageResult>>(
    WIKI_ENDPOINTS.SAVE_SECTION(pageId),
    requestBody
  );
  return extractData(response);
}

/**
 * Create a new wiki page
 *
 * Creates a new page within a wiki with the specified title and initial content.
 * The first version is automatically created. The page title must be unique
 * within the subwiki.
 *
 * Maps to PHP endpoint: POST /api/v1/wiki/{wikiId}/create
 * Wraps: wiki_create_page() from locallib.php
 *
 * @param wikiId - Wiki module instance ID
 * @param params - Page creation parameters (title, content, format, subwikiid)
 * @returns Promise resolving to created page details with ID and version
 * @throws Error if title already exists, validation fails, or access denied
 *
 * @example
 * ```typescript
 * const result = await createWikiPage(123, {
 *   title: 'New Chapter',
 *   content: '== New Chapter ==\nContent goes here.',
 *   contentformat: 'creole',
 *   subwikiid: 456
 * });
 * console.log(`Created page ${result.pageid}`);
 * ```
 */
export async function createWikiPage(
  wikiId: number,
  params: CreateWikiPageParams
): Promise<SaveWikiPageResult> {
  const response = await apiClient.post<ApiResponse<SaveWikiPageResult>>(
    WIKI_ENDPOINTS.CREATE(wikiId),
    params
  );
  return extractData(response);
}

/**
 * Preview wiki page content
 *
 * Renders wiki markup content to HTML for preview without saving changes.
 * Useful for showing real-time preview while editing so users can see
 * how their content will appear before committing changes.
 *
 * Maps to PHP endpoint: POST /api/v1/wiki/page/{pageId}/preview
 * Wraps: wiki_parse_content() from parser/
 *
 * @param pageId - Page ID being edited (for context)
 * @param params - Preview parameters (content, contentFormat)
 * @returns Promise resolving to rendered HTML and any parser warnings
 * @throws Error if rendering fails or invalid format specified
 *
 * @example
 * ```typescript
 * const preview = await previewWikiPage(456, {
 *   content: '== Test ==\nPreview this content.',
 *   contentFormat: 'creole'
 * });
 * previewContainer.innerHTML = preview.html;
 * ```
 */
export async function previewWikiPage(
  pageId: number,
  params: WikiSaveRequest
): Promise<WikiPreviewResponse> {
  const response = await apiClient.post<ApiResponse<WikiPreviewResponse>>(
    `/wiki/page/${pageId}/preview`,
    {
      content: params.content,
      contentformat: params.contentFormat,
    }
  );
  return extractData(response);
}

// ============================================================================
// API FUNCTIONS - VERSION HISTORY
// ============================================================================

/**
 * Fetch page version history
 *
 * Retrieves all versions of a page showing the complete edit history.
 * Each version includes content, author information, and timestamp.
 * Versions are ordered from newest to oldest.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/page/{pageId}/history
 * Wraps: wiki_get_wiki_page_versions() from locallib.php
 *
 * @param pageId - Page ID to get versions for
 * @returns Promise resolving to array of page versions
 * @throws Error if page not found or user lacks access permission
 *
 * @example
 * ```typescript
 * const versions = await fetchPageHistory(456);
 * versions.forEach(v => {
 *   console.log(`Version ${v.version} by user ${v.userid} at ${v.timecreated}`);
 * });
 * ```
 */
export async function fetchPageHistory(pageId: number): Promise<WikiVersion[]> {
  const response = await apiClient.get<ApiResponse<WikiVersionListResponse>>(
    WIKI_ENDPOINTS.HISTORY(pageId)
  );
  const data = extractData(response);
  return data.versions;
}

/**
 * Fetch a specific page version
 *
 * Retrieves the content and metadata of a specific version from a page's
 * history. Includes both raw content and optionally rendered HTML.
 * Useful for comparing versions or viewing historical content.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/page/{pageId}/version/{versionId}
 * Wraps: wiki_get_version() from locallib.php
 *
 * @param pageId - Page ID containing the version
 * @param versionId - Specific version ID to retrieve
 * @returns Promise resolving to version content and metadata
 * @throws Error if version not found or user lacks access permission
 *
 * @example
 * ```typescript
 * const version = await fetchPageVersion(456, 3);
 * console.log(`Version ${version.version}: ${version.content}`);
 * ```
 */
export async function fetchPageVersion(
  pageId: number,
  versionId: number
): Promise<WikiVersion> {
  const response = await apiClient.get<ApiResponse<WikiVersionResponse>>(
    WIKI_ENDPOINTS.VERSION(pageId, versionId)
  );
  const data = extractData(response);
  return data.version;
}

/**
 * Restore a previous page version
 *
 * Restores the page content to a previous version, creating a new version
 * in the history. This is a non-destructive operation - the history is
 * preserved and a new entry is created with the restored content.
 *
 * Maps to PHP endpoint: POST /api/v1/wiki/page/{pageId}/restore/{versionId}
 * Wraps: wiki_restore_page() from locallib.php
 *
 * @param pageId - Page ID to restore
 * @param versionId - Version ID to restore to
 * @param comment - Optional comment explaining the restore action
 * @returns Promise resolving to restore result with new version number
 * @throws Error if version not found or user lacks edit permission
 *
 * @example
 * ```typescript
 * const result = await restorePageVersion(456, 3, 'Reverting vandalism');
 * console.log(`Restored to version ${result.newVersion}`);
 * ```
 */
export async function restorePageVersion(
  pageId: number,
  versionId: number,
  comment?: string
): Promise<RestoreVersionResult> {
  const params: RestoreVersionParams = {};
  if (comment) {
    params.comment = comment;
  }

  const response = await apiClient.post<ApiResponse<RestoreVersionResult>>(
    WIKI_ENDPOINTS.RESTORE(pageId, versionId),
    params
  );
  return extractData(response);
}

// ============================================================================
// API FUNCTIONS - PAGE LISTING AND SEARCH
// ============================================================================

/**
 * Fetch list of all pages in a wiki
 *
 * Retrieves all pages within a wiki with optional sorting and filtering.
 * Can include or exclude full page content based on performance needs.
 * Results can be filtered to a specific subwiki.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/{id}/pages
 * Wraps: wiki_get_page_list() from locallib.php
 *
 * @param wikiId - Wiki module instance ID
 * @param params - Optional parameters for sorting, filtering, and content inclusion
 * @returns Promise resolving to array of wiki pages
 * @throws Error if wiki not found or user lacks access permission
 *
 * @example
 * ```typescript
 * const pages = await fetchPageList(123, {
 *   sortby: 'title',
 *   sortdirection: 'ASC',
 *   includecontent: false
 * });
 * console.log(`Found ${pages.length} pages`);
 * ```
 */
export async function fetchPageList(
  wikiId: number,
  params?: FetchPageListParams
): Promise<WikiPage[]> {
  const response = await apiClient.get<ApiResponse<WikiPageListResponse>>(
    WIKI_ENDPOINTS.LIST(wikiId),
    { params }
  );
  const data = extractData(response);
  return data.pages;
}

/**
 * Search wiki pages by title or content
 *
 * Performs a search across wiki pages matching the query string.
 * By default searches page titles, but can optionally include
 * full-text content search.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/{id}/search
 * Wraps: wiki_search_title() from locallib.php
 *
 * @param wikiId - Wiki module instance ID
 * @param params - Search parameters including query and options
 * @returns Promise resolving to array of matching pages with total count
 * @throws Error if wiki not found or user lacks access permission
 *
 * @example
 * ```typescript
 * const results = await searchWikiPages(123, {
 *   query: 'introduction',
 *   includeContent: true,
 *   limit: 20
 * });
 * console.log(`Found ${results.total} matches`);
 * ```
 */
export async function searchWikiPages(
  wikiId: number,
  params: SearchWikiPagesParams
): Promise<WikiSearchResponse> {
  const response = await apiClient.get<ApiResponse<WikiSearchResponse>>(
    WIKI_ENDPOINTS.SEARCH(wikiId),
    { params }
  );
  return extractData(response);
}

/**
 * Fetch linked pages for a wiki page
 *
 * Retrieves both inbound links (pages linking TO this page) and outbound
 * links (pages this page links TO). Useful for navigation, orphan page
 * detection, and understanding page relationships.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/page/{pageId}/links
 * Wraps: wiki_get_linked_to_pages() and wiki_get_linked_from_pages() from locallib.php
 *
 * @param pageId - Page ID to get links for
 * @returns Promise resolving to inbound and outbound link arrays
 * @throws Error if page not found or user lacks access permission
 *
 * @example
 * ```typescript
 * const links = await fetchLinkedPages(456);
 * console.log(`Linked from ${links.inboundLinks.length} pages`);
 * console.log(`Links to ${links.outboundLinks.length} pages`);
 * ```
 */
export async function fetchLinkedPages(
  pageId: number
): Promise<WikiLinkedPagesResponse> {
  const response = await apiClient.get<ApiResponse<WikiLinkedPagesResponse>>(
    WIKI_ENDPOINTS.LINKS(pageId)
  );
  return extractData(response);
}

// ============================================================================
// API FUNCTIONS - PAGE LOCKING
// ============================================================================

/**
 * Check the lock status of a wiki page
 *
 * Queries the current lock status of a page without attempting to acquire
 * a lock. Returns information about whether the page is locked, who holds
 * the lock, and if the current user owns it.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/page/{pageId}/lock
 * Wraps: wiki_is_page_section_locked() from locallib.php
 *
 * @param pageId - Page ID to check lock status for
 * @returns Promise resolving to lock status information
 * @throws Error if page not found or user lacks access permission
 *
 * @example
 * ```typescript
 * const status = await checkPageLock(456);
 * if (status.locked && !status.ownedByCurrentUser) {
 *   showMessage('Page is being edited by another user');
 * }
 * ```
 */
export async function checkPageLock(pageId: number): Promise<LockStatusResponse> {
  const response = await apiClient.get<ApiResponse<LockStatusResponse>>(
    `/wiki/page/${pageId}/lock`
  );
  return extractData(response);
}

/**
 * Acquire an edit lock on a wiki page
 *
 * Obtains an exclusive lock for editing a page to prevent concurrent edits.
 * The lock expires after a configured timeout (typically 30 minutes) unless
 * renewed via heartbeat. Only one user can hold a lock on a page at a time.
 *
 * Maps to PHP endpoint: POST /api/v1/wiki/page/{pageId}/lock
 * Wraps: wiki_set_lock() from locallib.php
 *
 * @param pageId - Page ID to lock
 * @param section - Optional specific section name to lock (for section editing)
 * @returns Promise resolving to lock acquisition result
 * @throws Error if page already locked by another user or access denied
 *
 * @example
 * ```typescript
 * const result = await acquirePageLock(456);
 * if (result.success) {
 *   // Start editing the page
 *   startLockHeartbeat(456);
 * } else {
 *   showError(result.message);
 * }
 * ```
 */
export async function acquirePageLock(
  pageId: number,
  section?: string
): Promise<LockAcquireResponse> {
  const params: AcquireLockParams = {};
  if (section) {
    params.section = section;
  }

  const response = await apiClient.post<ApiResponse<LockAcquireResponse>>(
    `/wiki/page/${pageId}/lock`,
    params
  );
  return extractData(response);
}

/**
 * Release an edit lock on a wiki page
 *
 * Releases the current user's lock on a page, allowing others to edit.
 * Should be called when canceling an edit or after a successful save.
 * Only the lock owner can release their own lock.
 *
 * Maps to PHP endpoint: DELETE /api/v1/wiki/page/{pageId}/lock
 * Wraps: wiki_delete_locks() from locallib.php
 *
 * @param pageId - Page ID to release lock for
 * @returns Promise resolving to unlock confirmation
 * @throws Error if no lock held by current user
 *
 * @example
 * ```typescript
 * // After saving or canceling edit
 * await releasePageLock(456);
 * stopLockHeartbeat();
 * ```
 */
export async function releasePageLock(pageId: number): Promise<LockReleaseResponse> {
  const response = await apiClient.delete<ApiResponse<LockReleaseResponse>>(
    `/wiki/page/${pageId}/lock`
  );
  return extractData(response);
}

/**
 * Send a heartbeat to keep page lock alive
 *
 * Sends a periodic heartbeat to prevent the lock from expiring while
 * the user is still editing. Should be called at regular intervals
 * (typically every 5 minutes) during an edit session.
 *
 * Maps to PHP endpoint: POST /api/v1/wiki/page/{pageId}/lock/heartbeat
 * Wraps: wiki_set_lock() renewal logic from locallib.php
 *
 * @param pageId - Page ID with active lock
 * @returns Promise resolving to heartbeat response with new expiration time
 * @throws Error if lock not held or already expired
 *
 * @example
 * ```typescript
 * // Setup periodic heartbeat during editing
 * const heartbeatInterval = setInterval(async () => {
 *   try {
 *     const result = await sendLockHeartbeat(pageId);
 *     console.log(`Lock renewed, expires in ${result.expiresIn}s`);
 *   } catch (error) {
 *     handleLockLost();
 *   }
 * }, 5 * 60 * 1000); // Every 5 minutes
 * ```
 */
export async function sendLockHeartbeat(
  pageId: number
): Promise<LockHeartbeatResponse> {
  const response = await apiClient.post<ApiResponse<LockHeartbeatResponse>>(
    `/wiki/page/${pageId}/lock/heartbeat`
  );
  return extractData(response);
}
