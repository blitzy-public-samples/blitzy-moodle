/**
 * Custom React hook for managing multiple file uploads
 * 
 * Provides state management for handling multiple file attachments
 * with validation, progress tracking, and error handling.
 * 
 * @example
 * ```tsx
 * const {
 *   files,
 *   addFiles,
 *   removeFile,
 *   clearFiles,
 *   isMaxFilesReached,
 *   totalSize
 * } = useMultiFileUpload({
 *   maxFiles: 5,
 *   maxSize: 10 * 1024 * 1024, // 10 MB
 *   allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
 * });
 * ```
 */

import { useState, useCallback } from 'react';

/**
 * Interface representing a file in the upload queue
 */
export interface FileState {
  /** Unique identifier for the file */
  id: string;
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  type: string;
  /** Upload progress (0-100) */
  progress: number;
  /** The actual File object */
  file: File;
  /** Error message if validation or upload failed */
  error?: string;
}

/**
 * Configuration options for the multi-file upload hook
 */
export interface MultiFileUploadOptions {
  /** Maximum number of files allowed (default: 10) */
  maxFiles?: number;
  /** Maximum file size in bytes (default: 10MB) */
  maxSize?: number;
  /** Maximum total size of all files in bytes (default: 50MB) */
  maxTotalSize?: number;
  /** Allowed MIME types (default: common document and image types) */
  allowedTypes?: string[];
  /** Callback fired when files are successfully added */
  onFilesAdded?: (files: FileState[]) => void;
  /** Callback fired when a file is removed */
  onFileRemoved?: (fileId: string) => void;
  /** Callback fired when validation fails */
  onValidationError?: (error: string) => void;
}

/**
 * Return value from the useMultiFileUpload hook
 */
export interface UseMultiFileUploadReturn {
  /** Array of files currently managed */
  files: FileState[];
  /** Add new files to the collection */
  addFiles: (newFiles: File[]) => void;
  /** Remove a file by its ID */
  removeFile: (fileId: string) => void;
  /** Clear all files */
  clearFiles: () => void;
  /** Update upload progress for a specific file */
  updateProgress: (fileId: string, progress: number) => void;
  /** Set an error message for a specific file */
  setFileError: (fileId: string, error: string) => void;
  /** Whether the maximum number of files has been reached */
  isMaxFilesReached: boolean;
  /** Total size of all files in bytes */
  totalSize: number;
}

/**
 * Default allowed MIME types for file uploads
 */
const DEFAULT_ALLOWED_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text
  'text/plain',
  'text/csv',
  'text/html',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
];

/**
 * Generate a unique ID for a file
 */
const generateFileId = (): string => {
  return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Custom hook for managing multiple file uploads
 * 
 * Handles file validation, state management, progress tracking,
 * and error handling for multiple file attachments.
 * 
 * @param options - Configuration options for file upload behavior
 * @returns Object containing file management functions and state
 */
export function useMultiFileUpload(
  options: MultiFileUploadOptions = {}
): UseMultiFileUploadReturn {
  const {
    maxFiles = 10,
    maxSize = 10 * 1024 * 1024, // 10 MB default
    maxTotalSize = 50 * 1024 * 1024, // 50 MB default
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    onFilesAdded,
    onFileRemoved,
    onValidationError,
  } = options;

  const [files, setFiles] = useState<FileState[]>([]);

  /**
   * Calculate total size of all files
   */
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  /**
   * Check if maximum number of files has been reached
   */
  const isMaxFilesReached = files.length >= maxFiles;

  /**
   * Validate a single file against size and type constraints
   */
  const validateFile = useCallback(
    (file: File): { valid: boolean; error?: string } => {
      // Check file size
      if (file.size > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
        return {
          valid: false,
          error: `File size exceeds maximum limit of ${maxSizeMB} MB`,
        };
      }

      // Check file type
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
        return {
          valid: false,
          error: 'File type not allowed',
        };
      }

      return { valid: true };
    },
    [maxSize, allowedTypes]
  );

  /**
   * Add new files to the collection with validation
   */
  const addFiles = useCallback(
    (newFiles: File[]): void => {
      // Check if adding these files would exceed the max file count
      if (files.length + newFiles.length > maxFiles) {
        const error = `Cannot add ${newFiles.length} file(s). Maximum ${maxFiles} files allowed.`;
        if (onValidationError) {
          onValidationError(error);
        }
        return;
      }

      // Convert File objects to FileState objects with validation
      const fileStates: FileState[] = [];
      const invalidFiles: string[] = [];

      for (const file of newFiles) {
        const validation = validateFile(file);
        
        if (validation.valid) {
          // Check if adding this file would exceed total size limit
          const newTotalSize = totalSize + file.size + fileStates.reduce((sum, f) => sum + f.size, 0);
          
          if (newTotalSize > maxTotalSize) {
            const maxTotalSizeMB = (maxTotalSize / (1024 * 1024)).toFixed(1);
            if (onValidationError) {
              onValidationError(`Total file size would exceed maximum limit of ${maxTotalSizeMB} MB`);
            }
            break;
          }

          fileStates.push({
            id: generateFileId(),
            name: file.name,
            size: file.size,
            type: file.type,
            progress: 0,
            file,
          });
        } else {
          // Create a file state with error for invalid files
          const fileState: FileState = {
            id: generateFileId(),
            name: file.name,
            size: file.size,
            type: file.type,
            progress: 0,
            file,
            error: validation.error,
          };
          fileStates.push(fileState);
          invalidFiles.push(file.name);
        }
      }

      if (fileStates.length > 0) {
        setFiles((prevFiles) => [...prevFiles, ...fileStates]);
        
        if (onFilesAdded) {
          onFilesAdded(fileStates);
        }
      }

      // Notify about validation errors
      if (invalidFiles.length > 0 && onValidationError) {
        onValidationError(`Invalid files: ${invalidFiles.join(', ')}`);
      }
    },
    [files.length, maxFiles, totalSize, maxTotalSize, validateFile, onFilesAdded, onValidationError]
  );

  /**
   * Remove a file from the collection by its ID
   */
  const removeFile = useCallback(
    (fileId: string): void => {
      setFiles((prevFiles) => {
        const fileToRemove = prevFiles.find(f => f.id === fileId);
        const updatedFiles = prevFiles.filter(f => f.id !== fileId);
        
        if (fileToRemove && onFileRemoved) {
          onFileRemoved(fileId);
        }
        
        return updatedFiles;
      });
    },
    [onFileRemoved]
  );

  /**
   * Clear all files from the collection
   */
  const clearFiles = useCallback((): void => {
    setFiles([]);
  }, []);

  /**
   * Update the upload progress for a specific file
   */
  const updateProgress = useCallback((fileId: string, progress: number): void => {
    setFiles((prevFiles) =>
      prevFiles.map((file) =>
        file.id === fileId ? { ...file, progress: Math.min(100, Math.max(0, progress)) } : file
      )
    );
  }, []);

  /**
   * Set an error message for a specific file
   */
  const setFileError = useCallback((fileId: string, error: string): void => {
    setFiles((prevFiles) =>
      prevFiles.map((file) =>
        file.id === fileId ? { ...file, error, progress: 0 } : file
      )
    );
  }, []);

  return {
    files,
    addFiles,
    removeFile,
    clearFiles,
    updateProgress,
    setFileError,
    isMaxFilesReached,
    totalSize,
  };
}
