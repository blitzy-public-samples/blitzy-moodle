/**
 * MSW Request Handlers for Wiki API Endpoints
 *
 * This file provides Mock Service Worker (MSW) handlers for wiki-related
 * API endpoints, enabling isolated frontend testing without backend dependencies.
 *
 * Handlers include:
 * - GET /api/v1/wiki/:id - Wiki details retrieval
 * - GET /api/v1/wiki/:wikiId/page/:title - Get page by title
 * - GET /api/v1/wiki/:id/firstpage - Get first page
 * - POST /api/v1/wiki/:id/save - Save wiki page
 * - POST /api/v1/wiki/:id/savesection - Save wiki section
 * - POST /api/v1/wiki/:id/create - Create new page
 * - GET /api/v1/wiki/page/:pageId/history - Page version history
 * - GET /api/v1/wiki/page/:pageId/version/:verId - Get specific version
 * - POST /api/v1/wiki/page/:pageId/restore/:verId - Restore version
 * - GET /api/v1/wiki/:id/pages - List wiki pages
 * - GET /api/v1/wiki/:id/search - Search wiki pages
 * - GET /api/v1/wiki/page/:pageId/links - Get linked pages
 * - GET /api/v1/wiki/page/:pageId/lock - Check page lock status
 * - POST /api/v1/wiki/page/:pageId/lock - Acquire page lock
 * - DELETE /api/v1/wiki/page/:pageId/lock - Release page lock
 * - POST /api/v1/wiki/page/:pageId/lock/heartbeat - Lock heartbeat
 * - POST /api/v1/wiki/page/:pageId/preview - Preview page content
 *
 * @package    react-frontend
 * @subpackage tests/mocks/handlers
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { http, HttpResponse } from 'msw';

// ============================================================================
// TypeScript Type Definitions
// ============================================================================

/**
 * Wiki module instance interface
 */
interface Wiki {
  id: number;
  course: number;
  name: string;
  intro: string;
  introformat: number;
  timecreated: number;
  timemodified: number;
  firstpagetitle: string;
  wikimode: 'collaborative' | 'individual';
  defaultformat: 'html' | 'creole' | 'nwiki';
  forceformat: boolean;
  editbegin: number;
  editend: number;
  section: number;
  visible: boolean;
  groupmode: number;
  groupingid: number;
}

/**
 * Wiki page interface
 */
interface WikiPage {
  id: number;
  subwikiid: number;
  title: string;
  cachedcontent: string;
  timecreated: number;
  timemodified: number;
  timerendered: number;
  userid: number;
  pageviews: number;
  readonly: boolean;
  tags: string[];
  version: number;
  canedit: boolean;
}

/**
 * Wiki page version interface
 */
interface WikiVersion {
  id: number;
  pageid: number;
  content: string;
  contentformat: string;
  version: number;
  timecreated: number;
  userid: number;
  userFullName: string;
  userPictureUrl: string;
}

/**
 * Wiki page lock interface
 */
interface WikiPageLock {
  id: number;
  pageid: number;
  userid: number;
  userFullName: string;
  lockedat: number;
  section?: string;
}

/**
 * Wiki link interface
 */
interface WikiLink {
  id: number;
  pageid: number;
  tomissingpage: string;
  topageid: number;
}

// ============================================================================
// Mock Data Storage
// ============================================================================

/**
 * Storage for wiki pages (simulates database)
 */
const wikiPagesStorage = new Map<number, WikiPage>();

/**
 * Storage for wiki versions (simulates database)
 */
const wikiVersionsStorage = new Map<number, WikiVersion[]>();

/**
 * Storage for page locks (simulates database)
 */
const wikiLocksStorage = new Map<number, WikiPageLock>();

/**
 * Current user ID for mock authentication
 */
let currentUserId = 1;

// ============================================================================
// Mock Data
// ============================================================================

const mockWiki: Wiki = {
  id: 1,
  course: 1,
  name: 'Test Wiki',
  intro: '<p>This is a test wiki for the course.</p>',
  introformat: 1,
  timecreated: Math.floor(Date.now() / 1000) - 86400 * 30,
  timemodified: Math.floor(Date.now() / 1000),
  firstpagetitle: 'Main Page',
  wikimode: 'collaborative',
  defaultformat: 'html',
  forceformat: false,
  editbegin: 0,
  editend: 0,
  section: 0,
  visible: true,
  groupmode: 0,
  groupingid: 0,
};

const mockWikiPage: WikiPage = {
  id: 1,
  subwikiid: 1,
  title: 'Main Page',
  cachedcontent: '<p>Welcome to the wiki!</p><h2>Introduction</h2><p>This is the main page content.</p>',
  timecreated: Math.floor(Date.now() / 1000) - 86400 * 30,
  timemodified: Math.floor(Date.now() / 1000),
  timerendered: Math.floor(Date.now() / 1000),
  userid: 1,
  pageviews: 42,
  readonly: false,
  tags: ['introduction', 'main'],
  version: 1,
  canedit: true,
};

const mockVersions: WikiVersion[] = [
  {
    id: 1,
    pageid: 1,
    content: '<p>Welcome to the wiki!</p><h2>Introduction</h2><p>This is the main page content.</p>',
    contentformat: 'html',
    version: 1,
    timecreated: Math.floor(Date.now() / 1000) - 86400 * 30,
    userid: 1,
    userFullName: 'John Doe',
    userPictureUrl: '/user/pix.php/1/f1.jpg',
  },
];

// Initialize storage with mock data
wikiPagesStorage.set(1, { ...mockWikiPage });
wikiVersionsStorage.set(1, [...mockVersions]);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a standard success response envelope
 */
function successResponse<T>(data: T) {
  return HttpResponse.json({
    success: true,
    data,
  });
}

/**
 * Creates a standard error response envelope
 */
function errorResponse(message: string, code: string, status: number = 400) {
  return HttpResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

/**
 * Gets a wiki page by ID from storage
 */
function getPage(pageId: number): WikiPage | undefined {
  return wikiPagesStorage.get(pageId);
}

/**
 * Updates a wiki page in storage
 */
function updatePage(pageId: number, updates: Partial<WikiPage>): WikiPage | undefined {
  const page = wikiPagesStorage.get(pageId);
  if (!page) {return undefined;}

  const updatedPage = { ...page, ...updates };
  wikiPagesStorage.set(pageId, updatedPage);
  return updatedPage;
}

/**
 * Adds a new version for a page
 */
function addVersion(pageId: number, content: string, contentFormat: string): WikiVersion {
  const versions = wikiVersionsStorage.get(pageId) || [];
  const newVersion: WikiVersion = {
    id: versions.length + 1,
    pageid: pageId,
    content,
    contentformat: contentFormat,
    version: versions.length + 1,
    timecreated: Math.floor(Date.now() / 1000),
    userid: currentUserId,
    userFullName: 'Test User',
    userPictureUrl: `/user/pix.php/${currentUserId}/f1.jpg`,
  };
  versions.push(newVersion);
  wikiVersionsStorage.set(pageId, versions);
  return newVersion;
}

/**
 * Checks if a lock is expired (30 minutes timeout)
 */
function isLockExpired(lock: WikiPageLock): boolean {
  const lockTimeout = 30 * 60; // 30 minutes in seconds
  const now = Math.floor(Date.now() / 1000);
  return now - lock.lockedat > lockTimeout;
}

/**
 * Gets the lock for a page if it's valid
 */
function getValidLock(pageId: number): WikiPageLock | undefined {
  const lock = wikiLocksStorage.get(pageId);
  if (lock && !isLockExpired(lock)) {
    return lock;
  }
  // Clean up expired lock
  if (lock && isLockExpired(lock)) {
    wikiLocksStorage.delete(pageId);
  }
  return undefined;
}

// ============================================================================
// Request Handlers
// ============================================================================

export const wikiHandlers = [
  // =========================================================================
  // Wiki Detail
  // =========================================================================

  /**
   * GET /api/v1/wiki/:id - Get wiki details
   */
  http.get('*/api/v1/wiki/:id', ({ params }) => {
    const id = Number(params.id);

    // Only page-related endpoints should be caught by wiki/page patterns
    if (isNaN(id)) {
      return errorResponse('Invalid wiki ID', 'INVALID_ID');
    }

    // Return mock wiki, adjusting ID if needed
    const wiki = { ...mockWiki, id };
    return successResponse(wiki);
  }),

  // =========================================================================
  // Wiki Page Retrieval
  // =========================================================================

  /**
   * GET /api/v1/wiki/:wikiId/page/:title - Get page by title
   */
  http.get('*/api/v1/wiki/:wikiId/page/:title', ({ params }) => {
    // wikiId is available in params but not used in mock
    const title = decodeURIComponent(String(params.title));

    // Look for page by title
    let foundPage: WikiPage | undefined;
    wikiPagesStorage.forEach((page) => {
      if (page.title.toLowerCase() === title.toLowerCase()) {
        foundPage = page;
      }
    });

    if (!foundPage) {
      // Return not found for non-existent pages
      return errorResponse(`Page "${title}" not found`, 'PAGE_NOT_FOUND', 404);
    }

    return successResponse({ page: foundPage });
  }),

  /**
   * GET /api/v1/wiki/:id/firstpage - Get first/main page
   */
  http.get('*/api/v1/wiki/:id/firstpage', () => {
    // Return the first page (main page)
    const page = wikiPagesStorage.get(1) || mockWikiPage;

    return successResponse({
      page,
      subwikiid: 1,
    });
  }),

  // =========================================================================
  // Wiki Page Editing
  // =========================================================================

  /**
   * POST /api/v1/wiki/:id/save - Save wiki page
   */
  http.post('*/api/v1/wiki/:id/save', async ({ request }) => {
    // id is available in params but we use pageid from body
    const body = (await request.json()) as {
      pageid: number;
      content: string;
      contentformat: string;
    };

    const { pageid, content, contentformat } = body;

    // Validate content
    if (!content || content.trim().length === 0) {
      return errorResponse('Content cannot be empty', 'VALIDATION_ERROR');
    }

    // Check for valid lock (user must have the lock)
    const lock = getValidLock(pageid);
    if (lock && lock.userid !== currentUserId) {
      return errorResponse(
        'Page is locked by another user',
        'PAGE_LOCKED',
        409
      );
    }

    // Create new version
    const newVersion = addVersion(pageid, content, contentformat);

    // Update page
    updatePage(pageid, {
      cachedcontent: content,
      timemodified: Math.floor(Date.now() / 1000),
      version: newVersion.version,
    });

    // Release lock after successful save
    wikiLocksStorage.delete(pageid);

    return successResponse({
      pageid,
      version: newVersion.version,
      success: true,
      message: 'Page saved successfully',
    });
  }),

  /**
   * POST /api/v1/wiki/:id/savesection - Save wiki section
   */
  http.post('*/api/v1/wiki/:id/savesection', async ({ request }) => {
    // id is available in params but we use pageid from body
    const body = (await request.json()) as {
      pageid: number;
      section: string;
      content: string;
      contentformat: string;
    };

    // section identifies which part of the page to update
    const { pageid, content, contentformat } = body;

    // Validate content
    if (!content || content.trim().length === 0) {
      return errorResponse('Section content cannot be empty', 'VALIDATION_ERROR');
    }

    // Check for valid lock
    const lock = getValidLock(pageid);
    if (lock && lock.userid !== currentUserId) {
      return errorResponse(
        'Page is locked by another user',
        'PAGE_LOCKED',
        409
      );
    }

    // Get existing page
    const page = getPage(pageid);
    if (!page) {
      return errorResponse('Page not found', 'PAGE_NOT_FOUND', 404);
    }

    // Create new version with updated section
    // In a real implementation, this would merge the section
    const newVersion = addVersion(pageid, content, contentformat);

    // Update page
    updatePage(pageid, {
      cachedcontent: content, // Simplified - would be merged in reality
      timemodified: Math.floor(Date.now() / 1000),
      version: newVersion.version,
    });

    return successResponse({
      pageid,
      version: newVersion.version,
      success: true,
      message: 'Section saved successfully',
    });
  }),

  /**
   * POST /api/v1/wiki/:id/create - Create new wiki page
   */
  http.post('*/api/v1/wiki/:id/create', async ({ request }) => {
    // wikiId is available in params but subwikiid from body is used
    const body = (await request.json()) as {
      title: string;
      content: string;
      contentformat: string;
      subwikiid: number;
    };

    const { title, content, contentformat, subwikiid } = body;

    // Validate title
    if (!title || title.trim().length === 0) {
      return errorResponse('Title cannot be empty', 'VALIDATION_ERROR');
    }

    // Check for duplicate title
    let titleExists = false;
    wikiPagesStorage.forEach((page) => {
      if (page.title.toLowerCase() === title.toLowerCase()) {
        titleExists = true;
      }
    });

    if (titleExists) {
      return errorResponse('A page with this title already exists', 'DUPLICATE_TITLE', 409);
    }

    // Create new page
    const newId = wikiPagesStorage.size + 1;
    const now = Math.floor(Date.now() / 1000);
    const newPage: WikiPage = {
      id: newId,
      subwikiid,
      title,
      cachedcontent: content,
      timecreated: now,
      timemodified: now,
      timerendered: now,
      userid: currentUserId,
      pageviews: 0,
      readonly: false,
      tags: [],
      version: 1,
      canedit: true,
    };

    wikiPagesStorage.set(newId, newPage);

    // Create first version
    addVersion(newId, content, contentformat);

    return successResponse({
      pageid: newId,
      version: 1,
      success: true,
      message: 'Page created successfully',
    });
  }),

  /**
   * POST /api/v1/wiki/page/:pageId/preview - Preview page content
   */
  http.post('*/api/v1/wiki/page/:pageId/preview', async ({ request }) => {
    // pageId available in params but preview only needs content from body
    const body = (await request.json()) as {
      content: string;
      contentformat: string;
    };

    const { content, contentformat } = body;

    // Simple HTML rendering for preview
    // In a real implementation, this would parse creole/nwiki formats
    let html = content;
    if (contentformat === 'creole') {
      // Very basic creole-to-HTML conversion
      html = content
        .replace(/^== (.+) ==$/gm, '<h2>$1</h2>')
        .replace(/^=== (.+) ===$/gm, '<h3>$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\/\/(.+?)\/\//g, '<em>$1</em>')
        .replace(/\[\[(.+?)\]\]/g, '<a href="#">$1</a>')
        .replace(/\n/g, '<br>');
    }

    return successResponse({
      html,
      warnings: [],
    });
  }),

  // =========================================================================
  // Version History
  // =========================================================================

  /**
   * GET /api/v1/wiki/page/:pageId/history - Get page version history
   */
  http.get('*/api/v1/wiki/page/:pageId/history', ({ params }) => {
    const pageId = Number(params.pageId);

    const versions = wikiVersionsStorage.get(pageId) || [];

    return successResponse({
      versions: versions.sort((a, b) => b.version - a.version),
      total: versions.length,
    });
  }),

  /**
   * GET /api/v1/wiki/page/:pageId/version/:versionId - Get specific version
   */
  http.get('*/api/v1/wiki/page/:pageId/version/:versionId', ({ params }) => {
    const pageId = Number(params.pageId);
    const versionId = Number(params.versionId);

    const versions = wikiVersionsStorage.get(pageId) || [];
    const version = versions.find((v) => v.version === versionId);

    if (!version) {
      return errorResponse('Version not found', 'VERSION_NOT_FOUND', 404);
    }

    return successResponse({ version });
  }),

  /**
   * POST /api/v1/wiki/page/:pageId/restore/:versionId - Restore version
   */
  http.post('*/api/v1/wiki/page/:pageId/restore/:versionId', async ({ params }) => {
    const pageId = Number(params.pageId);
    const versionId = Number(params.versionId);

    // comment can be provided in body but not used in mock
    const versions = wikiVersionsStorage.get(pageId) || [];
    const versionToRestore = versions.find((v) => v.version === versionId);

    if (!versionToRestore) {
      return errorResponse('Version not found', 'VERSION_NOT_FOUND', 404);
    }

    // Create new version with restored content
    const newVersion = addVersion(pageId, versionToRestore.content, versionToRestore.contentformat);

    // Update page
    updatePage(pageId, {
      cachedcontent: versionToRestore.content,
      timemodified: Math.floor(Date.now() / 1000),
      version: newVersion.version,
    });

    return successResponse({
      success: true,
      newVersion: newVersion.version,
      message: `Restored to version ${versionId}`,
    });
  }),

  // =========================================================================
  // Page Listing and Search
  // =========================================================================

  /**
   * GET /api/v1/wiki/:id/pages - List wiki pages
   */
  http.get('*/api/v1/wiki/:id/pages', ({ request }) => {
    // id available in params but mock returns all pages regardless
    const url = new URL(request.url);
    const sortby = url.searchParams.get('sortby') || 'title';
    const sortdirection = url.searchParams.get('sortdirection') || 'ASC';
    const includecontent = url.searchParams.get('includecontent') === 'true';

    // Get all pages
    const pages: WikiPage[] = [];
    wikiPagesStorage.forEach((page) => {
      const pageCopy = { ...page };
      if (!includecontent) {
        // Exclude content for performance if not requested
        pageCopy.cachedcontent = '';
      }
      pages.push(pageCopy);
    });

    // Sort pages
    pages.sort((a, b) => {
      const aValue = (a as unknown as Record<string, unknown>)[sortby];
      const bValue = (b as unknown as Record<string, unknown>)[sortby];
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortdirection === 'ASC'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      return 0;
    });

    return successResponse({
      pages,
      total: pages.length,
    });
  }),

  /**
   * GET /api/v1/wiki/:id/search - Search wiki pages
   */
  http.get('*/api/v1/wiki/:id/search', ({ request }) => {
    // id available in params but mock searches all pages regardless
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    const includeContent = url.searchParams.get('includeContent') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    const results: WikiPage[] = [];
    const lowerQuery = query.toLowerCase();

    wikiPagesStorage.forEach((page) => {
      const titleMatch = page.title.toLowerCase().includes(lowerQuery);
      const contentMatch = includeContent && page.cachedcontent.toLowerCase().includes(lowerQuery);

      if (titleMatch || contentMatch) {
        results.push(page);
      }
    });

    return successResponse({
      pages: results.slice(0, limit),
      total: results.length,
      query,
    });
  }),

  // =========================================================================
  // Page Links
  // =========================================================================

  /**
   * GET /api/v1/wiki/page/:pageId/links - Get linked pages
   */
  http.get('*/api/v1/wiki/page/:pageId/links', ({ params }) => {
    const pageId = Number(params.pageId);

    // Mock linked pages response
    const inboundLinks: WikiLink[] = [
      {
        id: 1,
        pageid: 2,
        tomissingpage: '',
        topageid: pageId,
      },
    ];

    const outboundLinks: WikiLink[] = [
      {
        id: 2,
        pageid: pageId,
        tomissingpage: '',
        topageid: 3,
      },
    ];

    return successResponse({
      inboundLinks,
      outboundLinks,
    });
  }),

  // =========================================================================
  // Page Locking
  // =========================================================================

  /**
   * GET /api/v1/wiki/page/:pageId/lock - Check lock status
   */
  http.get('*/api/v1/wiki/page/:pageId/lock', ({ params }) => {
    const pageId = Number(params.pageId);

    const lock = getValidLock(pageId);

    if (!lock) {
      return successResponse({
        locked: false,
        ownedByCurrentUser: false,
      });
    }

    const lockTimeout = 30 * 60; // 30 minutes
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = lockTimeout - (now - lock.lockedat);

    return successResponse({
      locked: true,
      lock,
      ownedByCurrentUser: lock.userid === currentUserId,
      timeRemaining,
    });
  }),

  /**
   * POST /api/v1/wiki/page/:pageId/lock - Acquire lock
   */
  http.post('*/api/v1/wiki/page/:pageId/lock', async ({ params, request }) => {
    const pageId = Number(params.pageId);

    // Check if this is a heartbeat request
    const url = new URL(request.url);
    if (url.pathname.includes('/heartbeat')) {
      // This will be handled by the heartbeat handler
      return HttpResponse.json({ success: false });
    }

    let body: { section?: string } = {};
    try {
      body = (await request.json()) as { section?: string };
    } catch {
      // No body is okay
    }

    const existingLock = getValidLock(pageId);

    if (existingLock && existingLock.userid !== currentUserId) {
      return errorResponse(
        `Page is locked by ${existingLock.userFullName}`,
        'PAGE_LOCKED',
        409
      );
    }

    // Create or refresh lock
    const now = Math.floor(Date.now() / 1000);
    const newLock: WikiPageLock = {
      id: pageId,
      pageid: pageId,
      userid: currentUserId,
      userFullName: 'Test User',
      lockedat: now,
      section: body.section,
    };

    wikiLocksStorage.set(pageId, newLock);

    return successResponse({
      success: true,
      lock: newLock,
      message: 'Lock acquired successfully',
      expiresIn: 30 * 60, // 30 minutes
    });
  }),

  /**
   * DELETE /api/v1/wiki/page/:pageId/lock - Release lock
   */
  http.delete('*/api/v1/wiki/page/:pageId/lock', ({ params }) => {
    const pageId = Number(params.pageId);

    const lock = wikiLocksStorage.get(pageId);

    if (!lock) {
      return successResponse({
        success: true,
        message: 'No lock to release',
      });
    }

    if (lock.userid !== currentUserId) {
      return errorResponse(
        'Cannot release lock owned by another user',
        'NOT_LOCK_OWNER',
        403
      );
    }

    wikiLocksStorage.delete(pageId);

    return successResponse({
      success: true,
      message: 'Lock released successfully',
    });
  }),

  /**
   * POST /api/v1/wiki/page/:pageId/lock/heartbeat - Lock heartbeat
   */
  http.post('*/api/v1/wiki/page/:pageId/lock/heartbeat', ({ params }) => {
    const pageId = Number(params.pageId);

    const lock = wikiLocksStorage.get(pageId);

    if (!lock || lock.userid !== currentUserId) {
      return errorResponse(
        'No active lock found for this user',
        'NO_LOCK',
        404
      );
    }

    // Refresh the lock timestamp
    lock.lockedat = Math.floor(Date.now() / 1000);
    wikiLocksStorage.set(pageId, lock);

    return successResponse({
      success: true,
      expiresIn: 30 * 60, // 30 minutes
      message: 'Lock renewed successfully',
    });
  }),
];

// ============================================================================
// Exported Utility Functions for Tests
// ============================================================================

/**
 * Reset all wiki mock storage to initial state
 */
export function resetWikiStorage(): void {
  wikiPagesStorage.clear();
  wikiVersionsStorage.clear();
  wikiLocksStorage.clear();

  // Re-initialize with default mock data
  wikiPagesStorage.set(1, { ...mockWikiPage });
  wikiVersionsStorage.set(1, [...mockVersions]);
}

/**
 * Set the current user ID for mock authentication
 */
export function setCurrentUserId(userId: number): void {
  currentUserId = userId;
}

/**
 * Add a custom wiki page to storage for testing
 */
export function addMockWikiPage(page: WikiPage): void {
  wikiPagesStorage.set(page.id, page);
}

/**
 * Add a custom lock for testing
 */
export function addMockLock(lock: WikiPageLock): void {
  wikiLocksStorage.set(lock.pageid, lock);
}

/**
 * Get current lock for a page (for testing assertions)
 */
export function getMockLock(pageId: number): WikiPageLock | undefined {
  return wikiLocksStorage.get(pageId);
}

/**
 * Clear all locks (for test cleanup)
 */
export function clearMockLocks(): void {
  wikiLocksStorage.clear();
}

export default wikiHandlers;
