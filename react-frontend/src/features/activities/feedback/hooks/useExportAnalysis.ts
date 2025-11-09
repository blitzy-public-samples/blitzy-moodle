/**
 * Custom React hook for exporting feedback analysis to Excel format.
 *
 * This hook provides a mutation for triggering Excel export download of feedback analysis data.
 * It wraps the GET /api/v1/feedback/{id}/export endpoint that calls existing Moodle
 * analysis_to_excel functions.
 *
 * @module features/activities/feedback/hooks/useExportAnalysis
 */

import type { UseMutationResult } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';

/**
 * Parameters for exporting feedback analysis
 */
export interface ExportAnalysisParams {
  /** Feedback activity ID */
  feedbackId: number;
  /** Optional course ID for filtering */
  courseId?: number;
}

/**
 * Error structure returned from the API
 */
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Options for the export analysis mutation
 */
export interface UseExportAnalysisOptions {
  /** Callback invoked on successful export */
  onSuccess?: (filename: string) => void;
  /** Callback invoked on export error */
  onError?: (error: Error) => void;
}

/**
 * Triggers download of a blob file in the browser
 *
 * @param blob - The file blob to download
 * @param filename - The filename to use for the download
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Extracts filename from Content-Disposition header
 *
 * @param contentDisposition - The Content-Disposition header value
 * @returns The extracted filename or a default filename
 */
function extractFilename(contentDisposition: string | null): string {
  if (!contentDisposition) {
    return `feedback_analysis_${Date.now()}.xls`;
  }

  // Try to match filename*=UTF-8''filename or filename="filename"
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''(.+)/);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const filenameMatch = contentDisposition.match(/filename="?(.+?)"?(?:;|$)/);
  if (filenameMatch?.[1]) {
    return filenameMatch[1];
  }

  return `feedback_analysis_${Date.now()}.xls`;
}

/**
 * Fetches the Excel file from the API
 *
 * @param params - Export parameters including feedbackId and optional courseId
 * @returns Promise resolving to the filename that was downloaded
 * @throws Error if the request fails or returns an error
 */
async function exportAnalysis(params: ExportAnalysisParams): Promise<string> {
  const { feedbackId, courseId } = params;

  // Build URL with query parameters
  const url = new URL(`/api/v1/feedback/${feedbackId}/export`, window.location.origin);
  if (courseId !== undefined && courseId !== null) {
    url.searchParams.append('courseid', courseId.toString());
  }

  // Fetch the file as a blob
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.ms-excel',
    },
    credentials: 'include', // Include cookies for authentication
  });

  // Check if response is successful
  if (!response.ok) {
    // Try to parse error response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const errorData = (await response.json()) as ApiError;
      throw new Error(errorData.error.message || 'Failed to export feedback analysis');
    }

    throw new Error(`Failed to export feedback analysis: ${response.statusText}`);
  }

  // Get the filename from Content-Disposition header
  const contentDisposition = response.headers.get('Content-Disposition');
  const filename = extractFilename(contentDisposition);

  // Get the blob data
  const blob = await response.blob();

  // Trigger download
  triggerDownload(blob, filename);

  return filename;
}

/**
 * Custom hook for exporting feedback analysis to Excel format.
 *
 * This hook provides a mutation that triggers an Excel export of feedback analysis data.
 * The export includes:
 * - Feedback metadata (date, completed count, question count)
 * - All feedback items with their responses
 * - Analysis data formatted as an Excel spreadsheet
 *
 * The hook handles:
 * - File download triggering
 * - Loading states during export
 * - Error handling with user-friendly messages
 * - Success callbacks with filename
 *
 * @param options - Optional callbacks for success and error handling
 * @returns Mutation result with mutate function, loading state, and error
 *
 * @example
 * ```tsx
 * function ExportButton({ feedbackId }: { feedbackId: number }) {
 *   const { mutate, isLoading, error } = useExportAnalysis({
 *     onSuccess: (filename) => {
 *       toast.success(`Downloaded ${filename}`);
 *     },
 *     onError: (error) => {
 *       toast.error(error.message);
 *     }
 *   });
 *
 *   return (
 *     <Button
 *       onClick={() => mutate({ feedbackId, courseId: 5 })}
 *       disabled={isLoading}
 *     >
 *       {isLoading ? 'Exporting...' : 'Export to Excel'}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useExportAnalysis(
  options?: UseExportAnalysisOptions
): UseMutationResult<string, Error, ExportAnalysisParams, unknown> {
  return useMutation<string, Error, ExportAnalysisParams>({
    mutationFn: exportAnalysis,
    onSuccess: (filename) => {
      if (options?.onSuccess) {
        options.onSuccess(filename);
      }
    },
    onError: (error) => {
      if (options?.onError) {
        options.onError(error);
      }
    },
  });
}
