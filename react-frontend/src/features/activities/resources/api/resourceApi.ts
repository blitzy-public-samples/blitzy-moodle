/**
 * Resource API Client Module
 *
 * Provides React Query integration for resource activities in the Moodle LMS.
 * This module exports functions for fetching resource details, file information,
 * page content, URL resources, and folder contents using Axios with JWT authentication
 * and standardized error handling for all /api/v1/resources/* endpoints.
 *
 * Based on Moodle PHP source files:
 * - public/mod/resource/view.php - Resource module viewing logic
 * - public/mod/page/view.php - Page content viewing logic
 * - public/mod/url/view.php - URL resource viewing logic
 * - public/mod/folder/view.php - Folder contents viewing logic
 * - public/mod/resource/lib.php - Resource library functions
 *
 * Architecture:
 * - Thin API wrapper that delegates to backend Moodle PHP functions
 * - All business logic remains in PHP backend (zero duplication)
 * - Backend handles all permission checks via require_capability()
 * - Returns typed data for React Query consumption
 *
 * Usage with React Query:
 * ```typescript
 * const { data, isLoading, error } = useQuery({
 *   queryKey: ['resources', resourceId],
 *   queryFn: () => fetchResource(resourceId)
 * });
 * ```
 *
 * @module features/activities/resources/api/resourceApi
 * @package react-frontend
 */

import type { AxiosError } from 'axios';
import apiClient from '@/services/api/client';
import type { ApiResponse } from '@/types/api';
import type {
  File,
  Resource,
  Page,
  URL,
  Folder,
} from '@/features/activities/resources/types/resource.types';

// ============================================================================
// API Endpoints Configuration
// ============================================================================

/**
 * API endpoint paths for resource activities
 *
 * These paths are relative to the API base URL configured in apiClient.
 * Backend routes these to corresponding PHP API handlers that wrap
 * existing Moodle functions.
 */
const ENDPOINTS = {
  /** GET /api/v1/resources/{id} - Fetch resource by ID */
  RESOURCE: (id: number) => `/resources/${id}`,
  /** GET /api/v1/resources/files/{id} - Fetch resource files by ID */
  RESOURCE_FILES: (id: number) => `/resources/files/${id}`,
  /** GET /api/v1/resources/pages/{id} - Fetch page content by ID */
  PAGE: (id: number) => `/resources/pages/${id}`,
  /** GET /api/v1/resources/urls/{id} - Fetch URL resource by ID */
  URL: (id: number) => `/resources/urls/${id}`,
  /** GET /api/v1/resources/folders/{id} - Fetch folder contents by ID */
  FOLDER: (id: number) => `/resources/folders/${id}`,
} as const;

// ============================================================================
// Error Handling
// ============================================================================

/**
 * API Error structure for consistent error handling
 *
 * Matches the error response envelope from the backend API:
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "code": "RESOURCE_NOT_FOUND",
 *     "message": "The requested resource does not exist",
 *     "details": { ... }
 *   }
 * }
 * ```
 */
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Custom error class for resource API errors
 *
 * Provides structured error information including HTTP status code,
 * error code, and user-friendly message for display in React components.
 */
export class ResourceApiError extends Error {
  /** HTTP status code from the response */
  public readonly status: number;
  /** Error code from the API (e.g., 'RESOURCE_NOT_FOUND', 'PERMISSION_DENIED') */
  public readonly code: string;
  /** Additional error details from the API */
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ResourceApiError';
    this.status = status;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ResourceApiError);
    }
  }
}

/**
 * Transform Axios errors into user-friendly ResourceApiError instances
 *
 * Handles common error scenarios:
 * - 404: Resource not found
 * - 403: Permission denied (user lacks required capability)
 * - 401: Unauthorized (JWT token expired or invalid)
 * - 400: Bad request (invalid parameters)
 * - 500: Server error
 * - Network errors (no response)
 *
 * @param error - The Axios error to transform
 * @param resourceType - Type of resource for contextual error messages
 * @returns Transformed ResourceApiError with user-friendly message
 */
function handleApiError(
  error: AxiosError<ApiErrorResponse>,
  resourceType: 'resource' | 'file' | 'page' | 'url' | 'folder'
): ResourceApiError {
  // Handle API error response with error envelope
  if (error.response?.data?.error) {
    const { code, message, details } = error.response.data.error;
    return new ResourceApiError(
      message,
      error.response.status,
      code,
      details
    );
  }

  // Handle HTTP status codes without error envelope
  if (error.response) {
    const {status} = error.response;

    switch (status) {
      case 400:
        return new ResourceApiError(
          `Invalid request for ${resourceType}. Please check the provided ID.`,
          status,
          'BAD_REQUEST'
        );
      case 401:
        return new ResourceApiError(
          'Your session has expired. Please log in again.',
          status,
          'UNAUTHORIZED'
        );
      case 403:
        return new ResourceApiError(
          `You do not have permission to view this ${resourceType}.`,
          status,
          'PERMISSION_DENIED'
        );
      case 404:
        return new ResourceApiError(
          `The requested ${resourceType} was not found. It may have been deleted or you may not have access.`,
          status,
          'NOT_FOUND'
        );
      case 500:
        return new ResourceApiError(
          `A server error occurred while loading the ${resourceType}. Please try again later.`,
          status,
          'SERVER_ERROR'
        );
      default:
        return new ResourceApiError(
          `An unexpected error occurred (${status}). Please try again.`,
          status,
          'UNKNOWN_ERROR'
        );
    }
  }

  // Handle network errors (no response received)
  if (error.request) {
    return new ResourceApiError(
      'Unable to connect to the server. Please check your internet connection.',
      0,
      'NETWORK_ERROR'
    );
  }

  // Handle request setup errors
  return new ResourceApiError(
    'An error occurred while preparing the request.',
    0,
    'REQUEST_SETUP_ERROR'
  );
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch resource (file/document) details by ID
 *
 * Retrieves complete resource metadata including name, description, file details,
 * display type, and course information. The backend PHP handler wraps the existing
 * Moodle function get_coursemodule_from_id() and $DB->get_record('resource').
 *
 * Corresponds to: public/mod/resource/view.php
 * - Lines 36-49: Fetches resource record by ID
 * - Lines 67-75: Uses get_file_storage() to retrieve file metadata
 * - Line 78: Gets final display type via resource_get_final_display_type()
 *
 * Required capability: mod/resource:view (enforced by backend)
 *
 * @param id - Resource instance ID (resource.id from database)
 * @returns Promise resolving to Resource object with all metadata
 * @throws ResourceApiError on API or network errors
 *
 * @example
 * ```typescript
 * // In a React component with React Query
 * const { data: resource } = useQuery({
 *   queryKey: ['resources', resourceId],
 *   queryFn: () => fetchResource(resourceId)
 * });
 *
 * // Or directly
 * const resource = await fetchResource(42);
 * console.log(resource.name, resource.contentfiles);
 * ```
 */
export async function fetchResource(id: number): Promise<Resource> {
  try {
    const response = await apiClient.get<ApiResponse<Resource>>(
      ENDPOINTS.RESOURCE(id)
    );
    return response.data.data;
  } catch (error) {
    throw handleApiError(error as AxiosError<ApiErrorResponse>, 'resource');
  }
}

/**
 * Fetch files associated with a resource
 *
 * Retrieves detailed file metadata for all files attached to a resource,
 * including filename, filesize, mimetype, download URL, and modification time.
 * The backend uses get_file_storage()->get_area_files() to retrieve file records.
 *
 * Corresponds to: public/mod/resource/view.php lines 67-75
 * ```php
 * $fs = get_file_storage();
 * $files = $fs->get_area_files($context->id, 'mod_resource', 'content', 0,
 *                              'sortorder DESC, id ASC', false);
 * ```
 *
 * Required capability: mod/resource:view (enforced by backend)
 *
 * @param id - Resource instance ID
 * @returns Promise resolving to array of File objects with metadata
 * @throws ResourceApiError on API or network errors
 *
 * @example
 * ```typescript
 * const files = await fetchResourceFiles(42);
 * files.forEach(file => {
 *   console.log(`${file.filename}: ${file.filesize} bytes`);
 *   console.log(`Download: ${file.fileurl}`);
 * });
 * ```
 */
export async function fetchResourceFiles(id: number): Promise<File[]> {
  try {
    const response = await apiClient.get<ApiResponse<File[]>>(
      ENDPOINTS.RESOURCE_FILES(id)
    );
    return response.data.data;
  } catch (error) {
    throw handleApiError(error as AxiosError<ApiErrorResponse>, 'file');
  }
}

/**
 * Fetch page content by ID
 *
 * Retrieves HTML page activity including content, intro, display options,
 * and formatting information. The backend wraps existing Moodle functions
 * and applies file_rewrite_pluginfile_urls() for embedded files.
 *
 * Corresponds to: public/mod/page/view.php
 * - Lines 35-46: Fetches page record by ID
 * - Line 59: Parses display options from serialized JSON
 * - Line 88: Rewrites pluginfile URLs for embedded content
 * - Line 93: Formats content with format_text()
 *
 * Required capability: mod/page:view (enforced by backend)
 *
 * @param id - Page instance ID (page.id from database)
 * @returns Promise resolving to Page object with HTML content
 * @throws ResourceApiError on API or network errors
 *
 * @example
 * ```typescript
 * const page = await fetchPageContent(38);
 * // Render HTML content safely
 * <div dangerouslySetInnerHTML={{ __html: page.content }} />
 * ```
 */
export async function fetchPageContent(id: number): Promise<Page> {
  try {
    const response = await apiClient.get<ApiResponse<Page>>(
      ENDPOINTS.PAGE(id)
    );
    return response.data.data;
  } catch (error) {
    throw handleApiError(error as AxiosError<ApiErrorResponse>, 'page');
  }
}

/**
 * Fetch URL resource by ID
 *
 * Retrieves external URL link resource including the target URL, display type
 * (open, popup, embed, frame), and URL metadata. The backend validates the URL
 * format and handles redirect logic for tracking.
 *
 * Corresponds to: public/mod/url/view.php
 * - Lines 36-43: Fetches URL record by ID
 * - Line 58: Validates external URL is not empty
 * - Line 67: Gets final display type via url_get_final_display_type()
 * - Line 86: Constructs full URL with url_get_full_url()
 *
 * Required capability: mod/url:view (enforced by backend)
 *
 * @param id - URL instance ID (url.id from database)
 * @returns Promise resolving to URL object with external link details
 * @throws ResourceApiError on API or network errors
 *
 * @example
 * ```typescript
 * const urlResource = await fetchUrlResource(44);
 * if (urlResource.display === ResourceDisplayType.NEW) {
 *   window.open(urlResource.externalurl, '_blank');
 * }
 * ```
 */
export async function fetchUrlResource(id: number): Promise<URL> {
  try {
    const response = await apiClient.get<ApiResponse<URL>>(
      ENDPOINTS.URL(id)
    );
    return response.data.data;
  } catch (error) {
    throw handleApiError(error as AxiosError<ApiErrorResponse>, 'url');
  }
}

/**
 * Fetch folder contents by ID
 *
 * Retrieves folder activity with all contained files, folder display options,
 * and navigation information. The backend uses the folder renderer to gather
 * complete file structure.
 *
 * Corresponds to: public/mod/folder/view.php
 * - Lines 34-41: Fetches folder record by ID
 * - Line 48: Checks for inline display mode (FOLDER_DISPLAY_INLINE)
 * - Lines 74-78: Uses folder renderer to display contents
 *
 * The files array includes all files in the folder with their paths,
 * enabling hierarchical display of nested folder structures.
 *
 * Required capability: mod/folder:view (enforced by backend)
 *
 * @param id - Folder instance ID (folder.id from database)
 * @returns Promise resolving to Folder object with files array
 * @throws ResourceApiError on API or network errors
 *
 * @example
 * ```typescript
 * const folder = await fetchFolderContents(51);
 * // Group files by directory for tree view
 * const filesByPath = folder.files.reduce((acc, file) => {
 *   const path = file.filepath || '/';
 *   acc[path] = acc[path] || [];
 *   acc[path].push(file);
 *   return acc;
 * }, {} as Record<string, File[]>);
 * ```
 */
export async function fetchFolderContents(id: number): Promise<Folder> {
  try {
    const response = await apiClient.get<ApiResponse<Folder>>(
      ENDPOINTS.FOLDER(id)
    );
    return response.data.data;
  } catch (error) {
    throw handleApiError(error as AxiosError<ApiErrorResponse>, 'folder');
  }
}

// ============================================================================
// Query Key Factories (for React Query)
// ============================================================================

/**
 * Query key factory for resource-related queries
 *
 * Provides consistent query keys for React Query cache management.
 * Use these keys for query invalidation and prefetching.
 *
 * @example
 * ```typescript
 * // In a hook
 * const { data } = useQuery({
 *   queryKey: resourceKeys.detail(resourceId),
 *   queryFn: () => fetchResource(resourceId)
 * });
 *
 * // For cache invalidation
 * queryClient.invalidateQueries({ queryKey: resourceKeys.files(resourceId) });
 *
 * // Invalidate all resource queries
 * queryClient.invalidateQueries({ queryKey: resourceKeys.all });
 * ```
 */
export const resourceKeys = {
  /** Base key for all resource queries */
  all: ['resources'] as const,
  /** Key for single resource detail */
  detail: (id: number) => ['resources', id] as const,
  /** Key for resource files */
  files: (id: number) => ['resources', id, 'files'] as const,
  /** Key for page content */
  page: (id: number) => ['resources', 'pages', id] as const,
  /** Key for URL resource */
  url: (id: number) => ['resources', 'urls', id] as const,
  /** Key for folder contents */
  folder: (id: number) => ['resources', 'folders', id] as const,
} as const;
