/**
 * Wiki Activity API Module
 *
 * Provides API functions for wiki activities including page management, editing,
 * versioning, locking, and content rendering. All functions call the backend API
 * layer which wraps existing Moodle wiki functions.
 *
 * @package    react-frontend
 * @subpackage features/activities/wiki/api
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 *
 * API Endpoints:
 * - GET    /api/v1/wiki/{id}                    - Get wiki activity details
 * - GET    /api/v1/wiki/{id}/pages              - Get list of pages in wiki
 * - GET    /api/v1/wiki/pages/{id}              - Get specific page details
 * - POST   /api/v1/wiki/{id}/pages              - Create new wiki page
 * - POST   /api/v1/wiki/pages/{id}/save         - Save/update wiki page
 * - POST   /api/v1/wiki/pages/{id}/preview      - Preview rendered content
 * - GET    /api/v1/wiki/pages/{id}/versions     - Get page version history
 * - POST   /api/v1/wiki/pages/{id}/lock         - Acquire page edit lock
 * - DELETE /api/v1/wiki/pages/{id}/lock         - Release page edit lock
 * - GET    /api/v1/wiki/pages/{id}/lock         - Check page lock status
 * - GET    /api/v1/wiki/{id}/subwikis           - Get subwiki list
 *
 * Backend References:
 * - public/mod/wiki/lib.php (wiki_get_wiki, wiki_save_page)
 * - public/mod/wiki/locallib.php (wiki_create_page, wiki_lock_page)
 * - public/mod/wiki/parser/ (wiki content rendering)
 */

import { apiClient, extractData } from '@/services/api/client';
import type { ApiResponse } from '@/types/api';
import type {
  Wiki,
  WikiPage,
  WikiVersion,
  WikiPageLock,
  WikiSubwiki,
  WikiPageListResponse,
  WikiVersionListResponse,
  WikiSubwikiListResponse,
  CreateWikiPageParams,
  SaveWikiPageResult,
  WikiPageFetchOptions,
  WikiSaveRequest,
  WikiPreviewResponse,
} from '../types/wiki.types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Response data for lock acquisition
 */
export interface LockResponse {
  /** Lock details if successfully acquired */
  lock: WikiPageLock;
  /** Whether lock was successfully acquired */
  success: boolean;
  /** Message about lock status */
  message: string;
}

/**
 * Response data for lock status check
 */
export interface LockStatusResponse {
  /** Whether page is currently locked */
  locked: boolean;
  /** Lock details if page is locked */
  lock?: WikiPageLock;
  /** Whether current user holds the lock */
  ownedByCurrentUser?: boolean;
}

/**
 * Response data for lock release
 */
export interface UnlockResponse {
  /** Whether lock was successfully released */
  success: boolean;
  /** Message about unlock status */
  message: string;
}

// ============================================================================
// API FUNCTIONS - WIKI OPERATIONS
// ============================================================================

/**
 * Get wiki activity details
 *
 * Retrieves comprehensive wiki information including configuration, mode,
 * editing settings, and current user permissions.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/{id}
 * Wraps: wiki_get_wiki() from lib.php
 *
 * @param wikiId - Wiki module ID
 * @returns Promise resolving to API response with Wiki data
 * @throws Error if wiki not found or access denied
 */
export async function getWiki(wikiId: number): Promise<Wiki> {
  const response = await apiClient.get<ApiResponse<Wiki>>(`/wiki/${wikiId}`);
  return extractData(response);
}

/**
 * Get list of pages in a wiki
 *
 * Retrieves all pages within a wiki instance with support for sorting
 * and optional content inclusion.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/{id}/pages
 * Wraps: wiki_get_pages() from locallib.php
 *
 * @param wikiId - Wiki module ID
 * @param options - Optional sorting and content inclusion parameters
 * @returns Promise resolving to list of wiki pages
 * @throws Error if wiki not found or access denied
 */
export async function getWikiPages(
  wikiId: number,
  options?: WikiPageFetchOptions
): Promise<WikiPage[]> {
  const response = await apiClient.get<ApiResponse<WikiPageListResponse>>(
    `/wiki/${wikiId}/pages`,
    { params: options }
  );
  const data = extractData(response);
  return data.pages;
}

/**
 * Get specific wiki page details
 *
 * Retrieves complete page information including content, metadata,
 * and current version number.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/pages/{id}
 * Wraps: wiki_get_page() from locallib.php
 *
 * @param pageId - Wiki page ID
 * @returns Promise resolving to API response with WikiPage data
 * @throws Error if page not found or access denied
 */
export async function getWikiPage(pageId: number): Promise<WikiPage> {
  const response = await apiClient.get<ApiResponse<WikiPage>>(`/wiki/pages/${pageId}`);
  return extractData(response);
}

/**
 * Create a new wiki page
 *
 * Creates a new page within a subwiki with initial content.
 * First version is automatically created.
 *
 * Maps to PHP endpoint: POST /api/v1/wiki/{wikiId}/pages
 * Wraps: wiki_create_page() from locallib.php
 *
 * @param wikiId - Wiki module ID
 * @param params - Page creation parameters (title, content, format, subwikiid)
 * @returns Promise resolving to created page details
 * @throws Error if creation fails or access denied
 */
export async function createWikiPage(
  wikiId: number,
  params: CreateWikiPageParams
): Promise<SaveWikiPageResult> {
  const response = await apiClient.post<ApiResponse<SaveWikiPageResult>>(
    `/wiki/${wikiId}/pages`,
    params
  );
  return extractData(response);
}

/**
 * Save/update a wiki page
 *
 * Saves changes to an existing page, creating a new version in the history.
 * Requires an active page lock before saving.
 *
 * Maps to PHP endpoint: POST /api/v1/wiki/pages/{pageId}/save
 * Wraps: wiki_save_page() from locallib.php
 *
 * @param pageId - Page ID to update
 * @param params - Edit parameters (content, contentFormat)
 * @returns Promise resolving to save result with new version number
 * @throws Error if save fails, no lock held, or access denied
 */
export async function saveWikiPage(
  pageId: number,
  params: WikiSaveRequest
): Promise<SaveWikiPageResult> {
  const response = await apiClient.post<ApiResponse<SaveWikiPageResult>>(
    `/wiki/pages/${pageId}/save`,
    {
      content: params.content,
      contentformat: params.contentFormat,
    }
  );
  return extractData(response);
}

/**
 * Preview wiki page content
 *
 * Renders wiki content to HTML for preview without saving.
 * Useful for showing real-time preview while editing.
 *
 * Maps to PHP endpoint: POST /api/v1/wiki/pages/{pageId}/preview
 * Wraps: wiki_parse_content() from parser/
 *
 * @param pageId - Page ID being edited
 * @param params - Preview parameters (content, contentFormat)
 * @returns Promise resolving to rendered HTML
 * @throws Error if rendering fails
 */
export async function previewWikiPage(
  pageId: number,
  params: WikiSaveRequest
): Promise<WikiPreviewResponse> {
  const response = await apiClient.post<ApiResponse<WikiPreviewResponse>>(
    `/wiki/pages/${pageId}/preview`,
    { content: params.content, contentformat: params.contentFormat }
  );
  return extractData(response);
}

/**
 * Get page version history
 *
 * Retrieves all versions of a page showing the edit history.
 * Each version includes content, author, and timestamp.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/pages/{pageId}/versions
 * Wraps: wiki_get_page_versions() from locallib.php
 *
 * @param pageId - Page ID to get versions for
 * @returns Promise resolving to list of page versions
 * @throws Error if page not found or access denied
 */
export async function getPageVersions(pageId: number): Promise<WikiVersion[]> {
  const response = await apiClient.get<ApiResponse<WikiVersionListResponse>>(
    `/wiki/pages/${pageId}/versions`
  );
  const data = extractData(response);
  return data.versions;
}

/**
 * Acquire edit lock on a page
 *
 * Obtains an exclusive lock for editing a page to prevent concurrent edits.
 * Lock expires after a configured timeout (typically 30 minutes).
 *
 * Maps to PHP endpoint: POST /api/v1/wiki/pages/{pageId}/lock
 * Wraps: wiki_set_lock() from locallib.php
 *
 * @param pageId - Page ID to lock
 * @param section - Optional specific section name to lock
 * @returns Promise resolving to lock details
 * @throws Error if page already locked by another user or access denied
 */
export async function acquirePageLock(
  pageId: number,
  section?: string
): Promise<LockResponse> {
  const response = await apiClient.post<ApiResponse<LockResponse>>(
    `/wiki/pages/${pageId}/lock`,
    { section: section ?? null }
  );
  return extractData(response);
}

/**
 * Release edit lock on a page
 *
 * Releases the current user's lock on a page, allowing others to edit.
 * Should be called when canceling edit or after successful save.
 *
 * Maps to PHP endpoint: DELETE /api/v1/wiki/pages/{pageId}/lock
 * Wraps: wiki_release_lock() from locallib.php
 *
 * @param pageId - Page ID to unlock
 * @returns Promise resolving to unlock confirmation
 * @throws Error if no lock held by current user
 */
export async function releasePageLock(pageId: number): Promise<UnlockResponse> {
  const response = await apiClient.delete<ApiResponse<UnlockResponse>>(
    `/wiki/pages/${pageId}/lock`
  );
  return extractData(response);
}

/**
 * Check page lock status
 *
 * Queries current lock status of a page without attempting to acquire lock.
 * Useful for displaying lock information to users.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/pages/{pageId}/lock
 * Wraps: wiki_get_lock() from locallib.php
 *
 * @param pageId - Page ID to check lock status
 * @returns Promise resolving to lock status information
 * @throws Error if page not found or access denied
 */
export async function checkPageLockStatus(pageId: number): Promise<LockStatusResponse> {
  const response = await apiClient.get<ApiResponse<LockStatusResponse>>(
    `/wiki/pages/${pageId}/lock`
  );
  return extractData(response);
}

/**
 * Get list of subwikis in a wiki
 *
 * Retrieves all subwiki instances (group or individual) within a wiki.
 * Each subwiki has its own set of pages.
 *
 * Maps to PHP endpoint: GET /api/v1/wiki/{wikiId}/subwikis
 * Wraps: wiki_get_subwikis() from locallib.php
 *
 * @param wikiId - Wiki module ID
 * @returns Promise resolving to list of subwikis
 * @throws Error if wiki not found or access denied
 */
export async function getSubwikis(wikiId: number): Promise<WikiSubwiki[]> {
  const response = await apiClient.get<ApiResponse<WikiSubwikiListResponse>>(
    `/wiki/${wikiId}/subwikis`
  );
  const data = extractData(response);
  return data.subwikis;
}
