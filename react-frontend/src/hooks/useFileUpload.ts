/**
 * Custom React hook for handling file upload operations
 *
 * Provides comprehensive file upload functionality with progress tracking,
 * validation, error handling, and cancellation support. Integrates with
 * axios for HTTP requests and toast notifications for user feedback.
 *
 * Features:
 * - File validation (size, MIME type)
 * - Upload progress tracking with real-time updates
 * - Cancellation of in-progress uploads
 * - Toast notifications for success/error states
 * - Reusable across assignment submissions, profile avatars, and resources
 *
 * @example
 * ```tsx
 * function SubmissionForm() {
 *   const { uploadFile, cancelUpload, state, reset } = useFileUpload({
 *     maxSize: 10 * 1024 * 1024, // 10MB
 *     allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
 *     onSuccess: (response) => {
 *       console.log('File uploaded:', response.data.fileId);
 *     },
 *     onError: (error) => {
 *       console.error('Upload failed:', error.message);
 *     }
 *   });
 *
 *   const handleFileSelect = async (file: File) => {
 *     await uploadFile(file, '/api/v1/assignments/123/submit');
 *   };
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={(e) => handleFileSelect(e.target.files[0])} />
 *       {state.status === 'uploading' && (
 *         <div>
 *           <progress value={state.progress} max={100} />
 *           <button onClick={cancelUpload}>Cancel</button>
 *         </div>
 *       )}
 *       {state.status === 'error' && <p>Error: {state.error}</p>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @module hooks/useFileUpload
 */

import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse, CancelTokenSource } from 'axios';
import { useToast } from './useToast';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Upload status enumeration
 */
export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

/**
 * File upload state interface
 *
 * Tracks the current state of file upload operation including status,
 * progress percentage, error messages, and the file being uploaded.
 */
export interface FileUploadState {
  /** Current upload status */
  status: UploadStatus;
  /** Upload progress percentage (0-100) */
  progress: number;
  /** Error message if upload fails, null otherwise */
  error: string | null;
  /** The file being uploaded, null if no upload in progress */
  file: File | null;
}

/**
 * File upload configuration options
 *
 * Provides configuration for file validation and callback handlers
 * for successful uploads and errors.
 */
export interface FileUploadOptions {
  /**
   * Maximum file size in bytes
   * Default: 10MB (10 * 1024 * 1024)
   * Based on Moodle default file upload limits
   */
  maxSize?: number;
  /**
   * Allowed MIME types for file validation
   * Examples: ['image/jpeg', 'image/png', 'application/pdf']
   * Default: All types allowed if not specified
   */
  allowedTypes?: string[];
  /**
   * Callback function executed on successful upload
   * Receives the axios response object containing server response
   */
  onSuccess?: (response: AxiosResponse<unknown>) => void;
  /**
   * Callback function executed on upload error
   * Receives the Error object with details about the failure
   */
  onError?: (error: Error) => void;
}

/**
 * Return type for useFileUpload hook
 *
 * Provides methods for file upload operations and current state
 */
export interface UseFileUploadReturn {
  /**
   * Upload a file to the specified URL
   *
   * Validates the file, creates FormData, tracks progress, and handles
   * success/error states with toast notifications.
   *
   * @param file - The File object to upload
   * @param url - The API endpoint URL for upload
   * @param options - Optional axios request configuration
   * @returns Promise that resolves when upload completes or rejects on error
   */
  uploadFile: (file: File, url: string, options?: AxiosRequestConfig) => Promise<void>;
  /**
   * Cancel the currently in-progress upload
   *
   * Aborts the axios request and resets state to idle
   */
  cancelUpload: () => void;
  /**
   * Current upload state
   *
   * Contains status, progress, error message, and file reference
   */
  state: FileUploadState;
  /**
   * Reset upload state to initial idle state
   *
   * Clears progress, error messages, and file reference
   */
  reset: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default maximum file size (10MB)
 * Aligned with common Moodle file upload limits
 */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Initial upload state
 */
const INITIAL_STATE: FileUploadState = {
  status: 'idle',
  progress: 0,
  error: null,
  file: null,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format file size for user-friendly display
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.5 MB", "1.2 GB")
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Validate file size against maximum limit
 *
 * @param file - File to validate
 * @param maxSize - Maximum allowed size in bytes
 * @returns Error message if validation fails, null if valid
 */
function validateFileSize(file: File, maxSize: number): string | null {
  if (file.size > maxSize) {
    const fileSize = formatFileSize(file.size);
    const maxSizeFormatted = formatFileSize(maxSize);
    return `File size (${fileSize}) exceeds maximum allowed size of ${maxSizeFormatted}`;
  }
  return null;
}

/**
 * Validate file MIME type against allowed types
 *
 * @param file - File to validate
 * @param allowedTypes - Array of allowed MIME types
 * @returns Error message if validation fails, null if valid
 */
function validateFileType(file: File, allowedTypes: string[]): string | null {
  if (!file.type) {
    return 'File type could not be determined';
  }

  const isAllowed = allowedTypes.some((type) => {
    // Support wildcards like "image/*"
    if (type.endsWith('/*')) {
      const prefix = type.slice(0, -2);
      return file.type.startsWith(prefix);
    }
    return file.type === type;
  });

  if (!isAllowed) {
    const fileExtension = file.name.split('.').pop() ?? 'unknown';
    return `File type "${file.type}" (${fileExtension}) is not allowed`;
  }

  return null;
}

/**
 * Validate file against all constraints
 *
 * @param file - File to validate
 * @param options - Validation options (maxSize, allowedTypes)
 * @returns Error message if validation fails, null if valid
 */
function validateFile(file: File, options: FileUploadOptions): string | null {
  // Validate file size
  const maxSize = options.maxSize ?? DEFAULT_MAX_FILE_SIZE;
  const sizeError = validateFileSize(file, maxSize);
  if (sizeError) {
    return sizeError;
  }

  // Validate file type if allowedTypes is specified
  if (options.allowedTypes && options.allowedTypes.length > 0) {
    const typeError = validateFileType(file, options.allowedTypes);
    if (typeError) {
      return typeError;
    }
  }

  return null;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Custom hook for file upload operations
 *
 * Manages file upload state, validation, progress tracking, and error handling.
 * Integrates with axios for HTTP requests and toast notifications for user feedback.
 * Supports cancellation of in-progress uploads.
 *
 * @param options - Configuration options for file validation and callbacks
 * @returns File upload methods and current state
 *
 * @example
 * ```tsx
 * // Assignment submission
 * const { uploadFile, state } = useFileUpload({
 *   maxSize: 50 * 1024 * 1024, // 50MB
 *   allowedTypes: ['application/pdf', 'application/msword'],
 *   onSuccess: (response) => {
 *     console.log('Submission uploaded:', response.data.submissionId);
 *     navigate('/assignments/123/success');
 *   }
 * });
 *
 * // Profile avatar upload
 * const { uploadFile, state, reset } = useFileUpload({
 *   maxSize: 5 * 1024 * 1024, // 5MB
 *   allowedTypes: ['image/*'],
 *   onSuccess: (response) => {
 *     setAvatarUrl(response.data.avatarUrl);
 *     reset();
 *   }
 * });
 * ```
 */
export default function useFileUpload(options: FileUploadOptions = {}): UseFileUploadReturn {
  // State management
  const [state, setState] = useState<FileUploadState>(INITIAL_STATE);

  // Cancel token for aborting uploads
  const cancelTokenSourceRef = useRef<CancelTokenSource | null>(null);

  // Toast notifications
  const { success, error: showError } = useToast();

  /**
   * Upload file to server with progress tracking
   */
  const uploadFile = useCallback(
    async (file: File, url: string, axiosOptions?: AxiosRequestConfig): Promise<void> => {
      try {
        // Validate file before upload
        const validationError = validateFile(file, options);
        if (validationError) {
          setState({
            status: 'error',
            progress: 0,
            error: validationError,
            file: null,
          });
          showError(validationError);
          options.onError?.(new Error(validationError));
          return;
        }

        // Create cancel token for this upload
        cancelTokenSourceRef.current = axios.CancelToken.source();

        // Set uploading state
        setState({
          status: 'uploading',
          progress: 0,
          error: null,
          file,
        });

        // Prepare FormData
        const formData = new FormData();
        formData.append('file', file);

        // Merge additional form fields from axios options if provided
        if (axiosOptions?.data && typeof axiosOptions.data === 'object' && !Array.isArray(axiosOptions.data)) {
          Object.entries(axiosOptions.data as Record<string, unknown>).forEach(([key, value]) => {
            formData.append(key, value as string | Blob);
          });
        }

        // Configure axios request with progress tracking
        const config: AxiosRequestConfig = {
          ...axiosOptions,
          data: formData,
          cancelToken: cancelTokenSourceRef.current.token,
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total ?? 0;
            const loaded = progressEvent.loaded ?? 0;
            const percentCompleted = total > 0 ? Math.round((loaded * 100) / total) : 0;

            setState((prev) => ({
              ...prev,
              progress: percentCompleted,
            }));
          },
          headers: {
            ...axiosOptions?.headers,
            'Content-Type': 'multipart/form-data',
          },
        };

        // Execute upload request
        const response = await axios.post(url, formData, config);

        // Set success state
        setState({
          status: 'success',
          progress: 100,
          error: null,
          file,
        });

        // Show success notification
        success(`File "${file.name}" uploaded successfully`);

        // Call success callback
        options.onSuccess?.(response);
      } catch (err) {
        // Handle cancellation separately (don't treat as error)
        if (axios.isCancel(err)) {
          setState({
            status: 'idle',
            progress: 0,
            error: null,
            file: null,
          });
          return;
        }

        // Handle upload error
        const errorMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred during upload';

        setState({
          status: 'error',
          progress: 0,
          error: errorMessage,
          file: null,
        });

        // Show error notification
        showError(`Upload failed: ${errorMessage}`);

        // Call error callback
        options.onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        // Clean up cancel token
        cancelTokenSourceRef.current = null;
      }
    },
    [options, success, showError]
  );

  /**
   * Cancel in-progress upload
   */
  const cancelUpload = useCallback(() => {
    if (cancelTokenSourceRef.current) {
      cancelTokenSourceRef.current.cancel('Upload cancelled by user');
      cancelTokenSourceRef.current = null;

      setState({
        status: 'idle',
        progress: 0,
        error: null,
        file: null,
      });

      showError('Upload cancelled');
    }
  }, [showError]);

  /**
   * Reset state to initial values
   */
  const reset = useCallback(() => {
    // Cancel any in-progress upload first
    if (cancelTokenSourceRef.current) {
      cancelTokenSourceRef.current.cancel('Upload reset');
      cancelTokenSourceRef.current = null;
    }

    setState(INITIAL_STATE);
  }, []);

  return {
    uploadFile,
    cancelUpload,
    state,
    reset,
  };
}
