/**
 * MSW Request Handlers for File Management API Endpoints
 * 
 * Provides mock handlers for file-related API operations including:
 * - File upload
 * - File listing
 * - File download
 * - File deletion
 * - File organization (folders, rename)
 * 
 * All handlers return realistic mock data matching Moodle API response envelope format
 * and support various test scenarios including success and error cases.
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
 * StoredFile interface representing an uploaded file in storage
 */
interface StoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  createdDate: string;
  modifiedDate: string;
  author: string;
  path: string; // Folder path where file is located, e.g., "/" or "/folder1/"
}

// ============================================================================
// Mock Data Storage (persisted across page reloads via sessionStorage)
// ============================================================================

/**
 * SessionStorage key for persisting mock file data across page reloads
 */
const STORAGE_KEY = 'msw_mock_file_storage';

/**
 * Load file storage from sessionStorage
 * 
 * This ensures mock file data persists across page reloads during E2E tests.
 * When the page reloads (e.g., via page.goto()), the handlers are re-initialized,
 * but we restore the previous state from sessionStorage.
 * 
 * @returns Map of stored files, loaded from sessionStorage if available
 */
function loadFileStorage(): Map<string, StoredFile> {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('[MSW Files] Loaded file storage from sessionStorage:', Object.keys(parsed).length, 'files');
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.warn('[MSW Files] Failed to load file storage from sessionStorage:', error);
  }
  console.log('[MSW Files] No existing storage found, initializing empty Map');
  return new Map<string, StoredFile>();
}

/**
 * Save file storage to sessionStorage
 * 
 * Persists the current file storage state to sessionStorage so it survives
 * page reloads during E2E tests.
 * 
 * @param storage - The file storage Map to persist
 */
function saveFileStorage(storage: Map<string, StoredFile>): void {
  try {
    const obj = Object.fromEntries(storage.entries());
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    console.log('[MSW Files] Saved file storage to sessionStorage:', Object.keys(obj).length, 'files');
  } catch (error) {
    console.warn('[MSW Files] Failed to save file storage to sessionStorage:', error);
  }
}

/**
 * In-memory storage for uploaded files during E2E tests
 * 
 * This Map stores file metadata (not actual file contents) and persists across
 * page reloads via sessionStorage. Each page reload restores the previous state.
 * 
 * Key: file ID (string)
 * Value: StoredFile metadata object
 */
const mockFileStorage = loadFileStorage();

/**
 * Get the current mock file storage.
 * 
 * @returns Map of file ID to StoredFile objects
 */
function getFileStorage(): Map<string, StoredFile> {
  return mockFileStorage;
}

/**
 * Update the mock file storage and persist to sessionStorage
 * 
 * This ensures that changes to the file storage are saved and will be
 * available after page reloads.
 * 
 * @param storage - Map of file ID to StoredFile objects
 */
function updateFileStorage(storage: Map<string, StoredFile>): void {
  saveFileStorage(storage);
}

/**
 * Clear all mock file storage
 * 
 * This function clears both the in-memory Map and the sessionStorage,
 * providing a clean slate for tests.
 */
export function clearMockFileStorage(): void {
  mockFileStorage.clear();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    console.log('[MSW Files] Cleared all mock file storage');
  } catch (error) {
    console.warn('[MSW Files] Failed to clear sessionStorage:', error);
  }
}

// ============================================================================
// Request Handlers
// ============================================================================

/**
 * POST /api/v1/files/upload
 * 
 * Handles file upload requests. Accepts multipart/form-data with file.
 * Returns the uploaded file metadata.
 * 
 * Request body:
 * - file: File (binary)
 * - contextId: number (optional - course ID or context)
 * 
 * Success Response (201):
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "id": "test.pdf",
 *     "name": "test.pdf",
 *     "size": 1024,
 *     "type": "application/pdf",
 *     "url": "/files/test.pdf",
 *     "createdDate": "2024-01-15T10:30:00Z",
 *     "modifiedDate": "2024-01-15T10:30:00Z",
 *     "author": "Test User"
 *   }
 * }
 * ```
 */
const handleFileUpload = http.post('*/api/v1/files/upload', async ({ request }) => {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as globalThis.File;
    
    if (!file) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_FILE',
            message: 'No file provided in request',
          },
        },
        { status: 400 }
      );
    }

    // Simulate upload delay for large files (>10MB) to allow E2E tests to observe progress bar
    // This delay is only for testing purposes to simulate real-world network conditions
    const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
    const UPLOAD_DELAY_MS = 1500; // 1.5 seconds for large files
    
    if (file.size > LARGE_FILE_THRESHOLD) {
      console.log(`[MSW Files] Simulating upload delay for large file: ${file.name} (${file.size} bytes)`);
      await new Promise(resolve => setTimeout(resolve, UPLOAD_DELAY_MS));
    }

    // Create file metadata
    const now = new Date().toISOString();
    const fileData: StoredFile = {
      id: file.name,
      name: file.name,
      size: file.size,
      type: file.type,
      url: `/files/${file.name}`,
      createdDate: now,
      modifiedDate: now,
      author: 'Test User',
      path: '/', // New files are placed in root directory by default
    };

    // Store in mock storage (shared across contexts via service worker)
    const storage = getFileStorage();
    storage.set(file.name, fileData);
    updateFileStorage(storage);

    // Return success response
    return HttpResponse.json(
      {
        success: true,
        data: fileData,
      },
      { status: 201 }
    );
  } catch (error) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'File upload failed',
          details: { error: String(error) },
        },
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/v1/files
 * 
 * Returns list of files for the current context.
 * 
 * Query parameters:
 * - contextId: number (optional - course ID or context)
 * - page: number (default: 1)
 * - perPage: number (default: 20)
 * 
 * Success Response (200):
 * ```json
 * {
 *   "success": true,
 *   "data": [
 *     { "id": "test.pdf", "name": "test.pdf", ... }
 *   ],
 *   "meta": {
 *     "pagination": {
 *       "page": 1,
 *       "perPage": 20,
 *       "total": 1,
 *       "totalPages": 1
 *     }
 *   }
 * }
 * ```
 */
const handleGetFiles = http.get('*/api/v1/files', ({ request }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const perPage = parseInt(url.searchParams.get('perPage') || '20', 10);

  // Load files from persistent storage
  const storage = getFileStorage();
  const files = Array.from(storage.values());
  const total = files.length;
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const paginatedFiles = files.slice(start, end);

  return HttpResponse.json(
    {
      success: true,
      data: paginatedFiles,
      meta: {
        pagination: {
          page,
          perPage,
          total,
          totalPages,
        },
      },
    },
    { status: 200 }
  );
});

/**
 * DELETE /api/v1/files/:id
 * 
 * Deletes a file by ID.
 * 
 * Success Response (200):
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "message": "File deleted successfully"
 *   }
 * }
 * ```
 */
const handleDeleteFile = http.delete('*/api/v1/files/:id', ({ params }) => {
  const { id } = params;
  const fileId = String(id);

  // Load files from persistent storage
  const storage = getFileStorage();
  
  if (!storage.has(fileId)) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found',
        },
      },
      { status: 404 }
    );
  }

  // Delete file and persist changes
  storage.delete(fileId);
  updateFileStorage(storage);

  return HttpResponse.json(
    {
      success: true,
      data: {
        message: 'File deleted successfully',
      },
    },
    { status: 200 }
  );
});

/**
 * GET /api/v1/files/download/:id
 * 
 * Downloads a file by ID.
 * Returns the file content with appropriate headers.
 */
const handleDownloadFile = http.get('*/api/v1/files/download/:id', ({ params }) => {
  const { id } = params;
  const fileId = String(id);

  // Load files from persistent storage
  const storage = getFileStorage();
  const file = storage.get(fileId);
  
  if (!file) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found',
        },
      },
      { status: 404 }
    );
  }

  // Return mock file content
  return new HttpResponse('Mock file content', {
    status: 200,
    headers: {
      'Content-Type': file.type,
      'Content-Disposition': `attachment; filename="${file.name}"`,
      'Content-Length': String(file.size),
    },
  });
});

/**
 * POST /api/v1/files/:id/move
 * 
 * Moves a file to a different folder location.
 * 
 * Request body:
 * - destination: string (folder path, e.g., "/" or "/folder1/")
 * 
 * Success Response (200):
 * ```json
 * {
 *   "success": true,
 *   "data": { "id": "test.pdf", "name": "test.pdf", "path": "/folder1/", ... }
 * }
 * ```
 * 
 * Error Response (404):
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "code": "FILE_NOT_FOUND",
 *     "message": "File not found"
 *   }
 * }
 * ```
 */
const handleMoveFile = http.post('*/api/v1/files/:id/move', async ({ request, params }) => {
  const { id } = params;
  const fileId = String(id);
  
  try {
    // Parse request body
    const body = await request.json() as { destination: string };
    const { destination } = body;
    
    // Load files from persistent storage
    const storage = getFileStorage();
    const file = storage.get(fileId);
    
    if (!file) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found',
          },
        },
        { status: 404 }
      );
    }
    
    // Update file path
    file.path = destination;
    file.modifiedDate = new Date().toISOString();
    
    // Save to storage
    storage.set(fileId, file);
    updateFileStorage(storage);
    
    console.log(`[MSW Files] Moved file ${fileId} to ${destination}`);
    
    return HttpResponse.json(
      {
        success: true,
        data: file,
      },
      { status: 200 }
    );
  } catch (error) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'MOVE_FAILED',
          message: 'Failed to move file',
          details: { error: String(error) },
        },
      },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/v1/files/:id
 * 
 * Updates a file (currently supports renaming).
 * 
 * Request body:
 * - name: string (new file name)
 * 
 * Success Response (200):
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "file": { "id": "test.pdf", "name": "renamed.pdf", ... }
 *   }
 * }
 * ```
 * 
 * Error Response (404):
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "code": "FILE_NOT_FOUND",
 *     "message": "File not found"
 *   }
 * }
 * ```
 */
const handleRenameFile = http.put('*/api/v1/files/:id', async ({ request, params }) => {
  const { id } = params;
  const fileId = String(id);
  
  try {
    // Parse request body
    const body = await request.json() as { name: string };
    const { name } = body;
    
    // Load files from persistent storage
    const storage = getFileStorage();
    const file = storage.get(fileId);
    
    if (!file) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found',
          },
        },
        { status: 404 }
      );
    }
    
    // Update file name and modified date
    const oldName = file.name;
    file.name = name;
    file.modifiedDate = new Date().toISOString();
    
    // If the file ID was based on the old name, we may need to update the ID
    // For simplicity, we'll keep the same ID but update the name
    storage.set(fileId, file);
    updateFileStorage(storage);
    
    console.log(`[MSW Files] Renamed file ${fileId} from ${oldName} to ${name}`);
    
    return HttpResponse.json(
      {
        success: true,
        data: {
          file: file,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'RENAME_FAILED',
          message: 'Failed to rename file',
          details: { error: String(error) },
        },
      },
      { status: 500 }
    );
  }
});

// ============================================================================
// Export Handlers Array
// ============================================================================

/**
 * Array of all file-related MSW request handlers
 * 
 * This array contains all handlers for file management endpoints and can be
 * spread into the main handlers array or used standalone in specific tests.
 */
export const filesHandlers = [
  handleFileUpload,
  handleGetFiles,
  handleDeleteFile,
  handleDownloadFile,
  handleMoveFile,
  handleRenameFile,
];
