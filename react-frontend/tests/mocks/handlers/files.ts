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
 * File interface representing an uploaded file
 */
interface File {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  createdDate: string;
  modifiedDate: string;
  author: string;
}

/**
 * API Response envelope for success responses
 */
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * API Response envelope for error responses
 */
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================================================
// Mock Data
// ============================================================================

/**
 * Mock storage for uploaded files (in-memory during test execution)
 */
const mockFileStorage: Map<string, File> = new Map();

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
    const file = formData.get('file') as File;
    
    if (!file) {
      return HttpResponse.json<ApiErrorResponse>(
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

    // Create file metadata
    const now = new Date().toISOString();
    const fileData: File = {
      id: file.name,
      name: file.name,
      size: file.size,
      type: file.type,
      url: `/files/${file.name}`,
      createdDate: now,
      modifiedDate: now,
      author: 'Test User',
    };

    // Store in mock storage
    mockFileStorage.set(file.name, fileData);

    // Return success response
    return HttpResponse.json<ApiSuccessResponse<File>>(
      {
        success: true,
        data: fileData,
      },
      { status: 201 }
    );
  } catch (error) {
    return HttpResponse.json<ApiErrorResponse>(
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

  const files = Array.from(mockFileStorage.values());
  const total = files.length;
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const paginatedFiles = files.slice(start, end);

  return HttpResponse.json<ApiSuccessResponse<File[]>>(
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

  if (!mockFileStorage.has(fileId)) {
    return HttpResponse.json<ApiErrorResponse>(
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

  mockFileStorage.delete(fileId);

  return HttpResponse.json<ApiSuccessResponse<{ message: string }>>(
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

  const file = mockFileStorage.get(fileId);
  if (!file) {
    return HttpResponse.json<ApiErrorResponse>(
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
];
