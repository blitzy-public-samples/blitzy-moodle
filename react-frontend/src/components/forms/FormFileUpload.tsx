/**
 * FormFileUpload Component
 *
 * A comprehensive React form component for file uploads with drag-and-drop functionality.
 * Integrates seamlessly with React Hook Form for form state management and validation.
 * Built with Material-UI components following Material Design principles.
 *
 * Features:
 * - Drag-and-drop file upload with visual feedback
 * - Traditional file picker fallback
 * - Single and multiple file upload support
 * - File type (MIME type) validation
 * - File size validation with customizable limits
 * - Maximum file count enforcement
 * - Real-time upload progress tracking
 * - File list display with remove functionality
 * - Image preview thumbnails
 * - File type icons for better UX
 * - Comprehensive error handling and display
 * - Accessibility features (ARIA labels, keyboard navigation, screen reader support)
 * - Responsive design for all screen sizes
 *
 * Usage Example:
 * ```tsx
 * import { useForm } from 'react-hook-form';
 * import { FormFileUpload } from '@/components/forms/FormFileUpload';
 *
 * function AssignmentSubmissionForm() {
 *   const { control, handleSubmit } = useForm();
 *
 *   const onSubmit = (data) => {
 *     console.log('Uploaded files:', data.submission);
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit(onSubmit)}>
 *       <FormFileUpload
 *         name="submission"
 *         label="Upload Assignment"
 *         control={control}
 *         required
 *         accept="application/pdf,image/*"
 *         maxSize={10 * 1024 * 1024}
 *         multiple
 *         maxFiles={5}
 *         uploadUrl="/api/v1/assignments/123/submit"
 *         helperText="Upload PDF or image files (max 10MB each, up to 5 files)"
 *       />
 *       <button type="submit">Submit</button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @module components/forms/FormFileUpload
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Controller,
  Control,
  FieldError,
  FieldValues,
} from 'react-hook-form';
import {
  Box,
  Button,
  Typography,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  FormHelperText,
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  AttachFile,
  InsertDriveFile,
  Image as ImageIcon,
  PictureAsPdf,
} from '@mui/icons-material';
import { useFileUpload } from '../../hooks/useFileUpload';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Props interface for FormFileUpload component
 *
 * Defines all configuration options for the file upload component including
 * validation rules, upload settings, and React Hook Form integration.
 */
export interface FormFileUploadProps {
  /**
   * Field name for React Hook Form registration
   * Used to identify the field in form data
   */
  name: string;

  /**
   * Label text displayed above the upload zone
   * Should describe what files are being uploaded
   */
  label: string;

  /**
   * Whether the field is required for form submission
   * If true, form validation will enforce at least one file
   */
  required?: boolean;

  /**
   * Accepted MIME types for file validation
   * Comma-separated string (e.g., "image/*,application/pdf")
   * If not specified, all file types are allowed
   */
  accept?: string;

  /**
   * Maximum file size in bytes
   * Files exceeding this size will be rejected with validation error
   * Default: 10MB (10 * 1024 * 1024)
   */
  maxSize?: number;

  /**
   * Whether to allow multiple file uploads
   * If false, only one file can be selected at a time
   * Default: false (single file)
   */
  multiple?: boolean;

  /**
   * Maximum number of files allowed when multiple is true
   * Ignored if multiple is false
   * If not specified, unlimited files allowed
   */
  maxFiles?: number;

  /**
   * React Hook Form control object
   * Required for integration with form state and validation
   */
  control: Control<FieldValues>;

  /**
   * Helper text displayed below the upload zone
   * Use for additional instructions or validation requirements
   */
  helperText?: string;

  /**
   * Whether the upload component is disabled
   * When true, prevents all file selection and upload interactions
   */
  disabled?: boolean;

  /**
   * API endpoint URL for file upload
   * Files will be uploaded to this URL when selected
   * If not provided, files are only stored in form state without upload
   */
  uploadUrl?: string;
}

/**
 * Internal state interface for selected files with metadata
 */
interface FileWithMetadata {
  /** Original File object */
  file: File;
  /** Unique identifier for list key */
  id: string;
  /** Preview URL for image files (data URL or blob URL) */
  preview?: string;
  /** Upload progress percentage (0-100) for this specific file */
  uploadProgress?: number;
  /** Whether this file upload completed successfully */
  uploaded?: boolean;
  /** Error message if upload failed for this file */
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default maximum file size (10MB)
 * Aligned with Moodle's typical upload limits
 */
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;

/**
 * File type icon mapping
 * Maps MIME type prefixes to Material-UI icons
 */
const FILE_TYPE_ICONS: Record<string, React.ReactElement> = {
  'image/': <ImageIcon />,
  'application/pdf': <PictureAsPdf />,
  'default': <InsertDriveFile />,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format file size for user-friendly display
 *
 * Converts bytes to appropriate unit (Bytes, KB, MB, GB) with
 * two decimal places for readability.
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.50 MB", "1.20 GB")
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
 * Get appropriate icon for file type
 *
 * Returns Material-UI icon component based on MIME type.
 * Falls back to generic file icon for unknown types.
 *
 * @param mimeType - File MIME type
 * @returns React icon element
 */
function getFileIcon(mimeType: string): React.ReactElement {
  for (const [prefix, icon] of Object.entries(FILE_TYPE_ICONS)) {
    if (prefix !== 'default' && mimeType.startsWith(prefix)) {
      return icon;
    }
  }
  return FILE_TYPE_ICONS.default;
}

/**
 * Check if file is an image type
 *
 * Used to determine if preview thumbnail should be generated
 *
 * @param mimeType - File MIME type
 * @returns True if image type, false otherwise
 */
function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Create preview URL for image files
 *
 * Generates a data URL that can be used as img src for preview.
 * Returns promise to handle FileReader async API.
 *
 * @param file - File object to create preview for
 * @returns Promise resolving to data URL string
 */
function createPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        resolve(e.target.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Validate file against accept attribute
 *
 * Checks if file MIME type matches any of the accepted types.
 * Supports wildcards (e.g., "image/*") and specific types.
 *
 * @param file - File to validate
 * @param accept - Accepted MIME types (comma-separated)
 * @returns True if valid, false if rejected
 */
function validateFileType(file: File, accept: string | undefined): boolean {
  if (!accept) {
    return true; // No restrictions
  }

  const acceptedTypes = accept.split(',').map(type => type.trim());
  const fileMimeType = file.type.toLowerCase();

  return acceptedTypes.some(acceptedType => {
    acceptedType = acceptedType.toLowerCase();

    // Handle wildcard (e.g., "image/*")
    if (acceptedType.endsWith('/*')) {
      const prefix = acceptedType.slice(0, -2);
      return fileMimeType.startsWith(prefix);
    }

    // Exact match
    if (acceptedType === fileMimeType) {
      return true;
    }

    // Handle file extensions (e.g., ".pdf")
    if (acceptedType.startsWith('.')) {
      const extension = acceptedType.slice(1);
      return file.name.toLowerCase().endsWith(`.${extension}`);
    }

    return false;
  });
}

/**
 * Validate file size against maximum limit
 *
 * @param file - File to validate
 * @param maxSize - Maximum allowed size in bytes
 * @returns True if valid, false if too large
 */
function validateFileSize(file: File, maxSize: number): boolean {
  return file.size <= maxSize;
}

/**
 * Generate unique ID for file
 *
 * Creates identifier based on file name, size, and timestamp
 * to uniquely identify files in the list.
 *
 * @param file - File object
 * @returns Unique string identifier
 */
function generateFileId(file: File): string {
  return `${file.name}-${file.size}-${Date.now()}`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * FormFileUpload Component
 *
 * Comprehensive file upload component with drag-and-drop support,
 * validation, progress tracking, and React Hook Form integration.
 *
 * @param props - Component props as defined in FormFileUploadProps
 * @returns React component
 */
export const FormFileUpload: React.FC<FormFileUploadProps> = ({
  name,
  label,
  required = false,
  accept,
  maxSize = DEFAULT_MAX_SIZE,
  multiple = false,
  maxFiles,
  control,
  helperText,
  disabled = false,
  uploadUrl,
}) => {
  // ============================================================================
  // STATE & REFS
  // ============================================================================

  // Track drag-and-drop active state for visual feedback
  const [isDragActive, setIsDragActive] = useState(false);

  // Track selected files with metadata (previews, upload status)
  const [filesWithMetadata, setFilesWithMetadata] = useState<FileWithMetadata[]>([]);

  // Reference to hidden file input element
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload hook for handling upload operations
  const { uploadFile, cancelUpload, state: uploadState, reset: resetUpload } = useFileUpload({
    maxSize,
    allowedTypes: accept?.split(',').map(t => t.trim()),
  });

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  /**
   * Compute accept attribute for file input
   * Handles both MIME types and file extensions
   */
  const acceptAttribute = useMemo(() => {
    return accept || undefined;
  }, [accept]);

  /**
   * Check if maximum file count reached
   */
  const isMaxFilesReached = useMemo(() => {
    if (!multiple || !maxFiles) {
      return false;
    }
    return filesWithMetadata.length >= maxFiles;
  }, [multiple, maxFiles, filesWithMetadata.length]);

  // ============================================================================
  // FILE HANDLING LOGIC
  // ============================================================================

  /**
   * Process and validate files
   *
   * Validates file type and size, creates preview for images,
   * and adds files to state with metadata.
   *
   * @param files - FileList or File array to process
   * @param onChange - React Hook Form onChange callback
   */
  const processFiles = useCallback(
    async (files: FileList | File[], onChange: (value: File | FileList | null) => void) => {
      const fileArray = Array.from(files);

      // Validate file count for multiple uploads
      if (multiple && maxFiles) {
        const totalFiles = filesWithMetadata.length + fileArray.length;
        if (totalFiles > maxFiles) {
          // Reject files exceeding limit
          return;
        }
      }

      // Process each file
      const newFilesWithMetadata: FileWithMetadata[] = [];

      for (const file of fileArray) {
        // Validate file type
        if (!validateFileType(file, accept)) {
          // Skip invalid file type (could show error toast here)
          continue;
        }

        // Validate file size
        if (!validateFileSize(file, maxSize)) {
          // Skip oversized file (could show error toast here)
          continue;
        }

        const fileId = generateFileId(file);
        let preview: string | undefined;

        // Create preview for image files
        if (isImageFile(file.type)) {
          try {
            preview = await createPreview(file);
          } catch (error) {
            // Preview generation failed, continue without preview
            console.error('Failed to create preview:', error);
          }
        }

        newFilesWithMetadata.push({
          file,
          id: fileId,
          preview,
          uploaded: false,
        });

        // If uploadUrl is provided, upload the file immediately
        if (uploadUrl) {
          try {
            await uploadFile(file, uploadUrl);
            // Update file metadata to mark as uploaded
            setFilesWithMetadata(prev =>
              prev.map(f =>
                f.id === fileId ? { ...f, uploaded: true, uploadProgress: 100 } : f
              )
            );
          } catch (error) {
            // Update file metadata with error
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';
            setFilesWithMetadata(prev =>
              prev.map(f =>
                f.id === fileId ? { ...f, error: errorMessage } : f
              )
            );
          }
        }
      }

      // Update state with new files
      if (multiple) {
        const updatedFiles = [...filesWithMetadata, ...newFilesWithMetadata];
        setFilesWithMetadata(updatedFiles);
        // Create FileList-like object for React Hook Form
        const dataTransfer = new DataTransfer();
        updatedFiles.forEach(f => dataTransfer.items.add(f.file));
        onChange(dataTransfer.files);
      } else {
        // Single file mode - replace existing file
        if (newFilesWithMetadata.length > 0) {
          setFilesWithMetadata([newFilesWithMetadata[0]]);
          onChange(newFilesWithMetadata[0].file);
        }
      }
    },
    [
      multiple,
      maxFiles,
      filesWithMetadata,
      accept,
      maxSize,
      uploadUrl,
      uploadFile,
    ]
  );

  /**
   * Handle file input change event
   *
   * Triggered when user selects files via file picker dialog
   */
  const handleFileInputChange = useCallback(
    (
      event: React.ChangeEvent<HTMLInputElement>,
      onChange: (value: File | FileList | null) => void
    ) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        processFiles(files, onChange);
      }
      // Reset input value to allow selecting the same file again
      event.target.value = '';
    },
    [processFiles]
  );

  /**
   * Remove file from list
   *
   * Removes file from state and updates React Hook Form value
   */
  const handleRemoveFile = useCallback(
    (fileId: string, onChange: (value: File | FileList | null) => void) => {
      const updatedFiles = filesWithMetadata.filter(f => f.id !== fileId);
      setFilesWithMetadata(updatedFiles);

      // Revoke preview URL if exists to prevent memory leak
      const fileToRemove = filesWithMetadata.find(f => f.id === fileId);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }

      // Update React Hook Form value
      if (multiple) {
        if (updatedFiles.length === 0) {
          onChange(null);
        } else {
          const dataTransfer = new DataTransfer();
          updatedFiles.forEach(f => dataTransfer.items.add(f.file));
          onChange(dataTransfer.files);
        }
      } else {
        onChange(null);
      }
    },
    [filesWithMetadata, multiple]
  );

  /**
   * Open file picker dialog
   *
   * Programmatically triggers click on hidden file input
   */
  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  // ============================================================================
  // DRAG AND DROP HANDLERS
  // ============================================================================

  /**
   * Handle drag enter event
   */
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragActive(true);
    }
  }, [disabled]);

  /**
   * Handle drag over event
   */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  /**
   * Handle drop event
   *
   * Processes dropped files and validates them
   */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, onChange: (value: File | FileList | null) => void) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled) {
        return;
      }

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFiles(files, onChange);
      }
    },
    [disabled, processFiles]
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: required ? `${label} is required` : false,
      }}
      render={({ field: { onChange, value }, fieldState: { error } }) => {
        // Type-safe error handling
        const fieldError = error as FieldError | undefined;

        return (
          <Box sx={{ width: '100%' }}>
            {/* Label */}
            <Typography
              variant="body2"
              component="label"
              sx={{
                display: 'block',
                mb: 1,
                fontWeight: 500,
                color: disabled ? 'text.disabled' : 'text.primary',
              }}
              htmlFor={`${name}-file-input`}
            >
              {label}
              {required && (
                <Typography
                  component="span"
                  sx={{ color: 'error.main', ml: 0.5 }}
                  aria-label="required"
                >
                  *
                </Typography>
              )}
            </Typography>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              id={`${name}-file-input`}
              accept={acceptAttribute}
              multiple={multiple}
              disabled={disabled}
              onChange={(e) => handleFileInputChange(e, onChange)}
              style={{ display: 'none' }}
              aria-label={label}
            />

            {/* Drag and drop zone */}
            <Box
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, onChange)}
              onClick={handleClick}
              sx={{
                border: 2,
                borderStyle: 'dashed',
                borderColor: isDragActive
                  ? 'primary.main'
                  : fieldError
                  ? 'error.main'
                  : 'divider',
                borderRadius: 1,
                p: 3,
                textAlign: 'center',
                cursor: disabled ? 'not-allowed' : 'pointer',
                backgroundColor: isDragActive
                  ? 'action.hover'
                  : disabled
                  ? 'action.disabledBackground'
                  : 'background.paper',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: disabled ? 'divider' : 'primary.main',
                  backgroundColor: disabled ? 'action.disabledBackground' : 'action.hover',
                },
              }}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`Upload ${label}`}
              aria-disabled={disabled}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                  e.preventDefault();
                  handleClick();
                }
              }}
            >
              <CloudUpload
                sx={{
                  fontSize: 48,
                  color: disabled ? 'action.disabled' : 'primary.main',
                  mb: 2,
                }}
              />
              <Typography
                variant="body1"
                sx={{
                  mb: 1,
                  color: disabled ? 'text.disabled' : 'text.primary',
                }}
              >
                {isDragActive
                  ? 'Drop files here'
                  : 'Drag and drop files here, or click to select'}
              </Typography>
              {maxSize && (
                <Typography
                  variant="body2"
                  sx={{ color: disabled ? 'text.disabled' : 'text.secondary' }}
                >
                  Maximum file size: {formatFileSize(maxSize)}
                </Typography>
              )}
              {multiple && maxFiles && (
                <Typography
                  variant="body2"
                  sx={{ color: disabled ? 'text.disabled' : 'text.secondary' }}
                >
                  Maximum {maxFiles} files allowed
                </Typography>
              )}
            </Box>

            {/* Helper text */}
            {helperText && !fieldError && (
              <FormHelperText sx={{ mt: 1 }}>
                {helperText}
              </FormHelperText>
            )}

            {/* Error message */}
            {fieldError && (
              <FormHelperText error sx={{ mt: 1 }}>
                {fieldError.message}
              </FormHelperText>
            )}

            {/* Upload progress indicator */}
            {uploadState.status === 'uploading' && (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ mr: 1 }}>
                    Uploading...
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {uploadState.progress}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={uploadState.progress}
                  sx={{ height: 6, borderRadius: 3 }}
                />
                <Button
                  size="small"
                  onClick={cancelUpload}
                  sx={{ mt: 1 }}
                >
                  Cancel Upload
                </Button>
              </Box>
            )}

            {/* File list */}
            {filesWithMetadata.length > 0 && (
              <List sx={{ mt: 2 }} aria-label="Selected files">
                {filesWithMetadata.map((fileData) => (
                  <ListItem
                    key={fileData.id}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                      backgroundColor: fileData.error
                        ? 'error.light'
                        : fileData.uploaded
                        ? 'success.light'
                        : 'background.paper',
                    }}
                  >
                    {/* File icon or preview thumbnail */}
                    <Box
                      sx={{
                        mr: 2,
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 1,
                        backgroundColor: 'action.hover',
                        overflow: 'hidden',
                      }}
                    >
                      {fileData.preview ? (
                        <img
                          src={fileData.preview}
                          alt={fileData.file.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        getFileIcon(fileData.file.type)
                      )}
                    </Box>

                    {/* File information */}
                    <ListItemText
                      primary={
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {fileData.file.name}
                        </Typography>
                      }
                      secondary={
                        <Box component="span">
                          <Typography
                            variant="caption"
                            component="span"
                            sx={{ color: 'text.secondary' }}
                          >
                            {formatFileSize(fileData.file.size)}
                          </Typography>
                          {fileData.uploaded && (
                            <Typography
                              variant="caption"
                              component="span"
                              sx={{ color: 'success.main', ml: 1 }}
                            >
                              • Uploaded
                            </Typography>
                          )}
                          {fileData.error && (
                            <Typography
                              variant="caption"
                              component="span"
                              sx={{ color: 'error.main', ml: 1 }}
                            >
                              • Error: {fileData.error}
                            </Typography>
                          )}
                        </Box>
                      }
                    />

                    {/* Remove button */}
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        aria-label={`Remove ${fileData.file.name}`}
                        onClick={() => handleRemoveFile(fileData.id, onChange)}
                        disabled={disabled}
                        size="small"
                      >
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}

            {/* Max files warning */}
            {isMaxFilesReached && (
              <FormHelperText sx={{ mt: 1, color: 'warning.main' }}>
                Maximum number of files reached ({maxFiles})
              </FormHelperText>
            )}
          </Box>
        );
      }}
    />
  );
};
