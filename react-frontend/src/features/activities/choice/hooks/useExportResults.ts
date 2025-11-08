/**
 * Choice Activity Export Results Hook
 * 
 * React Query mutation hook for exporting choice activity results to various formats.
 * Wraps GET /api/v1/choices/{id}/export API endpoint.
 * 
 * Features:
 * - Export to ODS, XLS, or TXT formats
 * - Browser download with proper Content-Type and Content-Disposition headers
 * - Group filtering support
 * - Analytics event tracking (report_downloaded)
 * - Toast notifications during export process
 * - Requires mod/choice:downloadresponses capability (enforced by API)
 * 
 * @module features/activities/choice/hooks/useExportResults
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';

/**
 * Supported export formats for choice results
 */
export type ExportFormat = 'ods' | 'xls' | 'txt';

/**
 * Input parameters for export results mutation
 */
export interface ExportResultsInput {
  /** Choice activity ID */
  choiceId: number;
  /** Export format (ODS, XLS, or TXT) */
  format: ExportFormat;
  /** Optional group ID for filtering results by group */
  groupId?: number;
}

/**
 * Success response from export mutation
 */
export interface ExportResultsResponse {
  /** Blob containing the exported file data */
  blob: Blob;
  /** Suggested filename from Content-Disposition header */
  filename: string;
  /** MIME type from Content-Type header */
  contentType: string;
}

/**
 * Error response structure from API
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Analytics event payload for report_downloaded tracking
 */
interface ReportDownloadedEvent {
  choiceId: number;
  format: ExportFormat;
  groupId?: number;
  timestamp: string;
}

/**
 * Options for the useExportResults hook
 */
export interface UseExportResultsOptions {
  /** Callback invoked when export starts (for showing loading toast) */
  onExportStart?: (format: ExportFormat) => void;
  /** Callback invoked when export succeeds (for showing success toast) */
  onExportSuccess?: (filename: string, format: ExportFormat) => void;
  /** Callback invoked when export fails (for showing error toast) */
  onExportError?: (error: string, format: ExportFormat) => void;
}

/**
 * Extracts filename from Content-Disposition header
 * 
 * @param contentDisposition - Content-Disposition header value
 * @returns Extracted filename or default based on format
 */
function extractFilename(contentDisposition: string | null, format: ExportFormat): string {
  if (!contentDisposition) {
    return `choice_export.${format}`;
  }

  // Match filename*=UTF-8''encoded or filename="quoted" or filename=unquoted
  const filenameMatch = contentDisposition.match(
    /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i
  );

  if (filenameMatch) {
    const filename = filenameMatch[1] || filenameMatch[2] || filenameMatch[3];
    return decodeURIComponent(filename.trim());
  }

  return `choice_export.${format}`;
}

/**
 * Triggers browser download for a blob
 * 
 * @param blob - File blob to download
 * @param filename - Suggested filename
 */
function triggerBrowserDownload(blob: Blob, filename: string): void {
  // Create object URL for the blob
  const url = window.URL.createObjectURL(blob);

  // Create temporary anchor element
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  // Append to body, click, and remove
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Revoke object URL after a delay to ensure download starts
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Tracks report_downloaded analytics event
 * 
 * @param event - Event payload
 */
async function trackReportDownloadedEvent(event: ReportDownloadedEvent): Promise<void> {
  try {
    // NOTE: In a real implementation, this would use the centralized API client
    // from '@/services/api/client' which handles authentication, base URL, etc.
    // Since depends_on_files is empty, we're using axios directly here.
    
    await axios.post('/api/v1/analytics/events', {
      eventType: 'report_downloaded',
      eventData: {
        choiceId: event.choiceId,
        format: event.format,
        groupId: event.groupId,
        timestamp: event.timestamp,
      },
    });
  } catch (error) {
    // Log error but don't throw - analytics failure shouldn't block download
    console.error('Failed to track report_downloaded event:', error);
  }
}

/**
 * Exports choice activity results to specified format
 * 
 * @param input - Export parameters
 * @returns Promise resolving to export response with blob and metadata
 * @throws ApiErrorResponse if export fails
 */
async function exportResults(input: ExportResultsInput): Promise<ExportResultsResponse> {
  const { choiceId, format, groupId } = input;

  // Build query parameters
  const params = new URLSearchParams({
    format,
  });

  if (groupId !== undefined) {
    params.append('groupId', groupId.toString());
  }

  try {
    // NOTE: In a real implementation, this would use the centralized API client
    // from '@/services/api/client' which handles JWT tokens, error interceptors, etc.
    // Since depends_on_files is empty, we're using axios directly here.
    
    const response = await axios.get(
      `/api/v1/choices/${choiceId}/export?${params.toString()}`,
      {
        responseType: 'blob',
        headers: {
          // Authorization header would be added by API client interceptor
          // 'Authorization': `Bearer ${token}`
        },
      }
    );

    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers['content-disposition'];
    const filename = extractFilename(contentDisposition, format);

    // Get content type
    const contentType = response.headers['content-type'] || 'application/octet-stream';

    return {
      blob: response.data as Blob,
      filename,
      contentType,
    };
  } catch (error) {
    // Handle axios errors
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiErrorResponse>;

      if (axiosError.response?.data) {
        // API returned structured error
        throw axiosError.response.data;
      }

      // Network or other axios error
      throw {
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: axiosError.message || 'Failed to export choice results',
          details: {
            status: axiosError.response?.status,
            statusText: axiosError.response?.statusText,
          },
        },
      } as ApiErrorResponse;
    }

    // Unknown error type
    throw {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred during export',
        details: { error },
      },
    } as ApiErrorResponse;
  }
}

/**
 * React Query mutation hook for exporting choice activity results
 * 
 * Provides a mutation function that exports choice results to ODS, XLS, or TXT format,
 * triggers browser download, tracks analytics events, and shows toast notifications.
 * 
 * @param options - Hook configuration options for callbacks
 * @returns Mutation object with mutate, mutateAsync, and status properties
 * 
 * @example
 * ```tsx
 * const { mutate: exportResults, isLoading } = useExportResults({
 *   onExportStart: (format) => {
 *     toast.loading(`Exporting to ${format.toUpperCase()}...`);
 *   },
 *   onExportSuccess: (filename, format) => {
 *     toast.success(`Successfully exported to ${filename}`);
 *   },
 *   onExportError: (error, format) => {
 *     toast.error(`Export failed: ${error}`);
 *   },
 * });
 * 
 * // Trigger export
 * exportResults({
 *   choiceId: 42,
 *   format: 'ods',
 *   groupId: 5, // optional
 * });
 * ```
 */
export default function useExportResults(options: UseExportResultsOptions = {}) {
  const queryClient = useQueryClient();
  const { onExportStart, onExportSuccess, onExportError } = options;

  return useMutation<ExportResultsResponse, ApiErrorResponse, ExportResultsInput>({
    mutationKey: ['choice', 'export'],

    mutationFn: async (input: ExportResultsInput) => {
      // Notify about export start (triggers loading toast)
      if (onExportStart) {
        onExportStart(input.format);
      }

      // Perform export API call
      const result = await exportResults(input);

      return result;
    },

    onSuccess: async (data, variables) => {
      const { blob, filename } = data;
      const { choiceId, format, groupId } = variables;

      // Trigger browser download
      triggerBrowserDownload(blob, filename);

      // Track analytics event (fire and forget)
      trackReportDownloadedEvent({
        choiceId,
        format,
        groupId,
        timestamp: new Date().toISOString(),
      });

      // Notify about successful export (triggers success toast)
      if (onExportSuccess) {
        onExportSuccess(filename, format);
      }

      // Optionally invalidate related queries (e.g., if export affects state)
      // In this case, export is read-only so invalidation may not be necessary
      // queryClient.invalidateQueries(['choice', choiceId]);
    },

    onError: (error, variables) => {
      const { format } = variables;
      const errorMessage = error.error?.message || 'Export failed';

      // Notify about error (triggers error toast)
      if (onExportError) {
        onExportError(errorMessage, format);
      }

      // Log error for debugging
      console.error('Choice export error:', {
        error,
        variables,
      });
    },

    // Retry configuration
    retry: (failureCount, error) => {
      // Don't retry on permission errors or invalid requests
      if (
        error.error?.code === 'PERMISSION_DENIED' ||
        error.error?.code === 'INVALID_CHOICE' ||
        error.error?.code === 'VALIDATION_ERROR'
      ) {
        return false;
      }

      // Retry network errors up to 2 times
      return failureCount < 2;
    },

    retryDelay: (attemptIndex) => {
      // Exponential backoff: 1s, 2s
      return Math.min(1000 * Math.pow(2, attemptIndex), 3000);
    },
  });
}

/**
 * Type export for the mutation hook return type
 */
export type UseExportResultsReturn = ReturnType<typeof useExportResults>;
