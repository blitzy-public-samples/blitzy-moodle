/**
 * File Upload Hook
 *
 * Custom hook for managing file attachments with validation, preview generation,
 * and progress tracking.
 *
 * @module hooks/useFileUpload
 */

import { useState, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * File attachment with metadata
 */
export interface FileAttachment {
  /** Unique identifier */
  id: string;
  /** The actual File object */
  file: File;
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  type: string;
  /** Upload progress percentage (0-100) */
  progress: number;
  /** Preview URL for image files */
  preview?: string;
  /** Error message if validation or upload fails */
  error?: string;
}

/**
 * Options for useFileUpload hook
 */
export interface UseFileUploadOptions {
  /** Maximum file size in bytes (default: 10MB) */
  maxFileSize?: number;
  /** Maximum number of files allowed (default: 5) */
  maxFiles?: number;
  /** Allowed file types (MIME types or extensions) */
  allowedTypes?: string[];
  /** Callback when files are successfully added */
  onFilesAdded?: (files: FileAttachment[]) => void;
  /** Callback when a file is removed */
  onFileRemoved?: (fileId: string) => void;
  /** Callback when validation error occurs */
  onValidationError?: (error: string) => void;
}

/**
 * Return type for useFileUpload hook
 */
export interface UseFileUploadReturn {
  /** List of file attachments */
  files: FileAttachment[];
  /** Add files to the attachment list */
  addFiles: (files: File[]) => void;
  /** Remove a file from the attachment list */
  removeFile: (fileId: string) => void;
  /** Clear all files */
  clearFiles: () => void;
  /** Update upload progress for a file */
  updateProgress: (fileId: string, progress: number) => void;
  /** Set error message for a file */
  setFileError: (fileId: string, error: string) => void;
  /** Whether maximum file limit is reached */
  isMaxFilesReached: boolean;
  /** Total size of all files in bytes */
  totalSize: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_FILES = 5;

const DEFAULT_ALLOWED_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique ID for file
 */
function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate file size
 */
function validateFileSize(file: File, maxSize: number): string | null {
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return `File size exceeds maximum allowed size of ${maxSizeMB}MB`;
  }
  return null;
}

/**
 * Validate file type
 */
function validateFileType(file: File, allowedTypes: string[]): string | null {
  const fileType = file.type;
  const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  
  const isAllowed = allowedTypes.some(
    (type) => fileType === type || fileExtension === type
  );
  
  if (!isAllowed) {
    return `File type "${file.type || fileExtension}" is not allowed`;
  }
  
  return null;
}

/**
 * Create preview URL for image files
 */
function createPreviewUrl(file: File): string | undefined {
  if (file.type.startsWith('image/')) {
    return URL.createObjectURL(file);
  }
  return undefined;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for managing file attachments
 *
 * @param options - Configuration options
 * @returns File management functions and state
 *
 * @example
 * ```tsx
 * const {
 *   files,
 *   addFiles,
 *   removeFile,
 *   clearFiles,
 *   isMaxFilesReached,
 * } = useFileUpload({
 *   maxFileSize: 10 * 1024 * 1024,
 *   maxFiles: 5,
 *   onValidationError: (error) => {
 *     alert(error);
 *   },
 * });
 *
 * const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
 *   const selectedFiles = Array.from(event.target.files || []);
 *   addFiles(selectedFiles);
 * };
 * ```
 */
export function useFileUpload(options: UseFileUploadOptions = {}): UseFileUploadReturn {
  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    maxFiles = DEFAULT_MAX_FILES,
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    onFilesAdded,
    onFileRemoved,
    onValidationError,
  } = options;

  const [files, setFiles] = useState<FileAttachment[]>([]);

  /**
   * Add files to the attachment list
   */
  const addFiles = useCallback(
    (newFiles: File[]) => {
      const validatedFiles: FileAttachment[] = [];
      
      for (const file of newFiles) {
        // Check if max files limit is reached
        if (files.length + validatedFiles.length >= maxFiles) {
          onValidationError?.(`Maximum of ${maxFiles} files allowed`);
          break;
        }
        
        // Validate file size
        const sizeError = validateFileSize(file, maxFileSize);
        if (sizeError) {
          onValidationError?.(sizeError);
          continue;
        }
        
        // Validate file type
        const typeError = validateFileType(file, allowedTypes);
        if (typeError) {
          onValidationError?.(typeError);
          continue;
        }
        
        // Create file attachment
        const attachment: FileAttachment = {
          id: generateFileId(),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          progress: 0,
          preview: createPreviewUrl(file),
        };
        
        validatedFiles.push(attachment);
      }
      
      if (validatedFiles.length > 0) {
        setFiles((prev) => [...prev, ...validatedFiles]);
        onFilesAdded?.(validatedFiles);
      }
    },
    [files.length, maxFiles, maxFileSize, allowedTypes, onFilesAdded, onValidationError]
  );

  /**
   * Remove a file from the attachment list
   */
  const removeFile = useCallback(
    (fileId: string) => {
      setFiles((prev) => {
        const file = prev.find((f) => f.id === fileId);
        
        // Revoke preview URL to free memory
        if (file?.preview) {
          URL.revokeObjectURL(file.preview);
        }
        
        return prev.filter((f) => f.id !== fileId);
      });
      
      onFileRemoved?.(fileId);
    },
    [onFileRemoved]
  );

  /**
   * Clear all files
   */
  const clearFiles = useCallback(() => {
    // Revoke all preview URLs
    files.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    
    setFiles([]);
  }, [files]);

  /**
   * Update upload progress for a file
   */
  const updateProgress = useCallback((fileId: string, progress: number) => {
    setFiles((prev) =>
      prev.map((file) =>
        file.id === fileId ? { ...file, progress } : file
      )
    );
  }, []);

  /**
   * Set error for a file
   */
  const setFileError = useCallback((fileId: string, error: string) => {
    setFiles((prev) =>
      prev.map((file) =>
        file.id === fileId ? { ...file, error } : file
      )
    );
  }, []);

  /**
   * Calculate total size of all files
   */
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return {
    files,
    addFiles,
    removeFile,
    clearFiles,
    updateProgress,
    setFileError,
    isMaxFilesReached: files.length >= maxFiles,
    totalSize,
  };
}
