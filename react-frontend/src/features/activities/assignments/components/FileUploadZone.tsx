/**
 * File Upload Zone Component for Assignment Submissions
 *
 * Provides a drag-and-drop file upload interface for assignment submissions.
 * Replicates and enhances the file submission functionality from Moodle's
 * assignment module (public/mod/assign/submission/file/).
 *
 * Key features:
 * - Drag-and-drop support with visual feedback
 * - File validation (type, size, count)
 * - Upload progress tracking with percentage indicators
 * - File list management with remove capability
 * - Support for single and multiple file uploads
 * - Accessibility features including keyboard navigation
 * - Material-UI consistent styling with theme support
 * - Responsive design for mobile and desktop
 *
 * References:
 * - public/mod/assign/submission_form.php
 * - public/mod/assign/submission/file/locallib.php
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import type React from 'react';
import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  useTheme,
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  InsertDriveFile,
  Error as ErrorIcon,
  CheckCircle,
} from '@mui/icons-material';
import { formatFileSize } from '@/utils/formatters';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Represents an uploaded or uploading file with metadata
 */
export interface UploadedFile {
  /** Optional unique identifier for the file */
  id?: string;
  /** File name with extension */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type of the file */
  type: string;
  /** Upload progress percentage (0-100), undefined if not uploading */
  uploadProgress?: number;
  /** Error message if validation or upload failed */
  error?: string;
  /** The actual File object for uploading */
  file?: File;
}

/**
 * Props for the FileUploadZone component
 */
export interface FileUploadZoneProps {
  /**
   * Maximum allowed file size in bytes (from assignment configuration).
   * Files exceeding this size will be rejected with an error message.
   * Default: 10MB (10485760 bytes)
   */
  maxFileSize?: number;

  /**
   * Array of accepted file types/extensions.
   * Examples: ['.pdf', '.doc', '.docx', 'image/*', 'application/pdf']
   * Supports MIME types and file extensions.
   * Default: All files accepted
   */
  acceptedFileTypes?: string[];

  /**
   * Maximum number of files allowed to be uploaded.
   * Default: Unlimited (undefined)
   */
  maxFiles?: number;

  /**
   * Callback function invoked when the file list changes.
   * Receives the current array of File objects.
   */
  onFilesChange: (files: File[]) => void;

  /**
   * Disable the upload zone during form submission or processing.
   * Default: false
   */
  disabled?: boolean;

  /**
   * Array of previously uploaded files to display in the list.
   * Used when editing an existing submission.
   * Default: Empty array
   */
  existingFiles?: UploadedFile[];
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * FileUploadZone - Drag-and-drop file upload component
 *
 * A modern React component that provides an intuitive file upload interface
 * with drag-and-drop support, client-side validation, and progress tracking.
 * Integrates with Material-UI for consistent styling and accessibility.
 */
function FileUploadZone({
  maxFileSize = 10485760, // 10MB default
  acceptedFileTypes,
  maxFiles,
  onFilesChange,
  disabled = false,
  existingFiles = [],
}: FileUploadZoneProps) {
  const theme = useTheme();

  // ============================================================================
  // State Management
  // ============================================================================

  const [files, setFiles] = useState<UploadedFile[]>(existingFiles);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================================================
  // File Validation Logic
  // ============================================================================

  /**
   * Validate a single file against size, type, and count constraints
   *
   * @param file - The File object to validate
   * @returns Validation result with valid flag and optional error message
   */
  const validateFile = useCallback(
    (file: File): { valid: boolean; error?: string } => {
      // Check file size (maxFileSize = 0 means unlimited)
      if (maxFileSize > 0 && file.size > maxFileSize) {
        return {
          valid: false,
          error: `File "${file.name}" is too large. Maximum size is ${formatFileSize(maxFileSize)}.`,
        };
      }

      // Check file type if acceptedFileTypes is specified
      if (acceptedFileTypes && acceptedFileTypes.length > 0) {
        // Extract file name and extensions (handle compound extensions like .tar.gz)
        const fileName = file.name.toLowerCase();
        const nameParts = fileName.split('.');
        const fileMimeType = file.type.toLowerCase();

        // Get both simple extension (.gz) and potential compound extension (.tar.gz)
        const simpleExtension = nameParts.length > 1 ? `.${nameParts[nameParts.length - 1]}` : '';
        const compoundExtension = nameParts.length > 2 
          ? `.${nameParts[nameParts.length - 2]}.${nameParts[nameParts.length - 1]}` 
          : simpleExtension;

        const isAccepted = acceptedFileTypes.some((acceptedType) => {
          const normalizedType = acceptedType.toLowerCase().trim();

          // Check for wildcard MIME types (e.g., "image/*")
          if (normalizedType.includes('*')) {
            const [category] = normalizedType.split('/');
            return fileMimeType.startsWith(`${category}/`);
          }

          // Check for exact MIME type match
          if (normalizedType.includes('/')) {
            return fileMimeType === normalizedType;
          }

          // Check for file extension match (try compound first, then simple)
          if (normalizedType.startsWith('.')) {
            return compoundExtension === normalizedType || simpleExtension === normalizedType;
          }

          // Check for extension without dot (try compound first, then simple)
          return compoundExtension === `.${normalizedType}` || simpleExtension === `.${normalizedType}`;
        });

        if (!isAccepted) {
          return {
            valid: false,
            error: `File "${file.name}" has an invalid file type. Accepted types: ${acceptedFileTypes.join(', ')}.`,
          };
        }
      }

      return { valid: true };
    },
    [maxFileSize, acceptedFileTypes]
  );

  // ============================================================================
  // File List Management
  // ============================================================================

  /**
   * Add new files to the upload list after validation
   *
   * @param newFiles - FileList or File array to add
   */
  const handleAddFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const filesArray = Array.from(newFiles);
      const newErrors: string[] = [];
      const validFiles: UploadedFile[] = [];

      // Check if adding these files would exceed maxFiles limit
      if (maxFiles !== undefined && files.length + filesArray.length > maxFiles) {
        newErrors.push(
          `Cannot upload more than ${maxFiles} file${maxFiles > 1 ? 's' : ''}. Currently ${files.length} file${files.length !== 1 ? 's' : ''} uploaded.`
        );
        setErrors(newErrors);
        return;
      }

      // Validate and process each file
      filesArray.forEach((file) => {
        const validation = validateFile(file);

        if (validation.valid) {
          validFiles.push({
            name: file.name,
            size: file.size,
            type: file.type,
            file,
            uploadProgress: 0,
          });
        } else if (validation.error) {
            newErrors.push(validation.error);
          }
      });

      // Update state with valid files
      if (validFiles.length > 0) {
        const updatedFiles = [...files, ...validFiles];
        setFiles(updatedFiles);

        // Notify parent component with File objects
        const fileObjects = updatedFiles.map((f) => f.file).filter((f): f is File => f !== undefined);
        onFilesChange(fileObjects);

        // Clear previous errors if valid files were added
        if (newErrors.length === 0) {
          setErrors([]);
        }
      }

      // Set new errors if any validation failed
      if (newErrors.length > 0) {
        setErrors(newErrors);
      }
    },
    [files, maxFiles, validateFile, onFilesChange]
  );

  /**
   * Remove a file from the upload list
   *
   * @param index - Index of the file to remove
   */
  const handleRemoveFile = useCallback(
    (index: number) => {
      const updatedFiles = files.filter((_, i) => i !== index);
      setFiles(updatedFiles);

      // Notify parent component
      const fileObjects = updatedFiles.map((f) => f.file).filter((f): f is File => f !== undefined);
      onFilesChange(fileObjects);

      // Clear errors when files are removed
      setErrors([]);

      // Announce to screen readers
      const removedFile = files[index];
      if (removedFile) {
        const announcement = `File ${removedFile.name} removed`;
        announceToScreenReader(announcement);
      }
    },
    [files, onFilesChange]
  );

  // ============================================================================
  // Drag and Drop Handlers
  // ============================================================================

  /**
   * Handle drag enter event - activate drop zone visual feedback
   */
  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (!disabled) {
        setIsDragActive(true);
      }
    },
    [disabled]
  );

  /**
   * Handle drag leave event - deactivate drop zone visual feedback
   */
  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      // Only deactivate if leaving the drop zone container
      if (e.currentTarget === e.target) {
        setIsDragActive(false);
      }
    },
    []
  );

  /**
   * Handle drag over event - required to enable drop
   */
  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    },
    []
  );

  /**
   * Handle drop event - process dropped files
   */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled) {
        return;
      }

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        handleAddFiles(droppedFiles);

        // Announce to screen readers
        announceToScreenReader(`${droppedFiles.length} file${droppedFiles.length > 1 ? 's' : ''} dropped`);
      }
    },
    [disabled, handleAddFiles]
  );

  // ============================================================================
  // File Selection Handlers
  // ============================================================================

  /**
   * Handle click on upload zone - trigger file input
   */
  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  /**
   * Handle file input change - process selected files
   */
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        handleAddFiles(selectedFiles);

        // Announce to screen readers
        announceToScreenReader(`${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`);
      }

      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleAddFiles]
  );

  /**
   * Handle keyboard navigation for accessibility
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
        e.preventDefault();
        handleClick();
      }
    },
    [disabled, handleClick]
  );

  // ============================================================================
  // Accessibility Helper
  // ============================================================================

  /**
   * Announce messages to screen readers
   *
   * @param message - Message to announce
   */
  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      // Check if document and element still exist before removing
      // This prevents errors when test environment is torn down
      if (document?.body?.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 1000);
  };

  // ============================================================================
  // Memoized Values
  // ============================================================================

  /**
   * Calculate accepted file types display string
   */
  const acceptedTypesDisplay = useMemo(() => {
    if (!acceptedFileTypes || acceptedFileTypes.length === 0) {
      return 'All file types accepted';
    }

    return `Accepted: ${acceptedFileTypes.join(', ')}`;
  }, [acceptedFileTypes]);

  /**
   * Calculate file count display
   */
  const fileCountDisplay = useMemo(() => {
    if (maxFiles === undefined) {
      return null;
    }

    return `${files.length}/${maxFiles}`;
  }, [files.length, maxFiles]);

  // ============================================================================
  // Render Component
  // ============================================================================

  return (
    <Box sx={{ width: '100%' }}>
      {/* Error Messages */}
      {errors.length > 0 && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setErrors([])}
        >
          <Typography variant="body2" component="div">
            {errors.map((error) => (
              <Box key={error} sx={{ mb: 0.5 }}>
                {error}
              </Box>
            ))}
          </Typography>
        </Alert>
      )}

      {/* Upload Zone */}
      <Box
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label="File upload area"
        aria-disabled={disabled}
        sx={{
          border: `2px dashed ${
            isDragActive
              ? theme.palette.primary.main
              : theme.palette.mode === 'dark'
              ? theme.palette.grey[700]
              : theme.palette.grey[300]
          }`,
          borderRadius: theme.shape.borderRadius,
          padding: theme.spacing(4),
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundColor: isDragActive
            ? theme.palette.mode === 'dark'
              ? theme.palette.primary.dark
              : theme.palette.primary.light
            : theme.palette.mode === 'dark'
            ? theme.palette.grey[900]
            : theme.palette.grey[50],
          transition: 'all 0.3s ease',
          opacity: disabled ? 0.6 : 1,
          '&:hover': {
            backgroundColor: disabled
              ? undefined
              : theme.palette.mode === 'dark'
              ? theme.palette.grey[800]
              : theme.palette.grey[100],
            borderColor: disabled ? undefined : theme.palette.primary.main,
          },
          '&:focus': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px',
          },
          // Mobile touch optimizations
          [theme.breakpoints.down('sm')]: {
            padding: theme.spacing(3),
          },
        }}
      >
        <CloudUpload
          sx={{
            fontSize: 48,
            color: isDragActive ? theme.palette.primary.main : theme.palette.text.secondary,
            mb: 2,
            transition: 'color 0.3s ease',
          }}
        />

        {!disabled && (
          <Typography
            variant="h6"
            color={isDragActive ? 'primary' : 'textPrimary'}
            gutterBottom
            sx={{
              fontWeight: 500,
              transition: 'color 0.3s ease',
            }}
          >
            {isDragActive
              ? 'Drop files here'
              : 'Drag and drop files here, or click to select'}
          </Typography>
        )}
        
        {disabled && (
          <Typography
            variant="h6"
            color="textSecondary"
            gutterBottom
            sx={{
              fontWeight: 500,
            }}
          >
            Upload disabled
          </Typography>
        )}

        <Typography
          variant="body2"
          color="textSecondary"
          sx={{ mb: 2 }}
        >
          {acceptedTypesDisplay}
          {' • '}
          Max size: {formatFileSize(maxFileSize)}
        </Typography>

        <Button
          variant="contained"
          color="primary"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          sx={{
            minHeight: 44, // Touch-friendly minimum
            minWidth: 120,
          }}
        >
          Select Files
        </Button>
      </Box>

      {/* Hidden file input - placed outside clickable zone to prevent event bubbling */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={maxFiles === undefined || maxFiles > 1}
        accept={acceptedFileTypes?.join(',')}
        onChange={handleFileInputChange}
        disabled={disabled}
        style={{ display: 'none' }}
        aria-label="File input"
      />

      {/* File Count Indicator */}
      {fileCountDisplay && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Chip
            label={`Files: ${fileCountDisplay}`}
            color={files.length >= (maxFiles ?? 0) ? 'warning' : 'default'}
            size="small"
          />
        </Box>
      )}

      {/* File List */}
      {files.length > 0 && (
        <List sx={{ mt: 2 }}>
          {files.map((file, index) => (
            <ListItem
              key={file.id ?? `${file.name}-${file.size}-${index}`}
              sx={{
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: theme.shape.borderRadius,
                mb: 1,
                backgroundColor: file.error
                  ? theme.palette.mode === 'dark'
                    ? 'rgba(211, 47, 47, 0.1)'
                    : 'rgba(211, 47, 47, 0.05)'
                  : theme.palette.background.paper,
                '&:last-child': {
                  mb: 0,
                },
              }}
            >
              {/* File Icon */}
              <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                {file.error ? (
                  <ErrorIcon color="error" />
                ) : file.uploadProgress === 100 ? (
                  <CheckCircle sx={{ color: theme.palette.success.main }} />
                ) : (
                  <InsertDriveFile color="action" />
                )}
              </Box>

              {/* File Info */}
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      wordBreak: 'break-word',
                    }}
                  >
                    {file.name}
                  </Typography>
                }
                secondary={
                  <Box>
                    <Typography variant="caption" color="textSecondary">
                      {formatFileSize(file.size)}
                    </Typography>

                    {/* Upload Progress */}
                    {file.uploadProgress !== undefined &&
                      file.uploadProgress < 100 &&
                      !file.error && (
                        <Box sx={{ mt: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={file.uploadProgress}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            sx={{ mt: 0.5, display: 'block' }}
                          >
                            {file.uploadProgress}%
                          </Typography>
                        </Box>
                      )}

                    {/* Error Message */}
                    {file.error && (
                      <Typography
                        variant="caption"
                        color="error"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        {file.error}
                      </Typography>
                    )}
                  </Box>
                }
              />

              {/* Delete Button */}
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => handleRemoveFile(index)}
                  disabled={disabled}
                  sx={{
                    minWidth: 44, // Touch-friendly minimum
                    minHeight: 44,
                  }}
                >
                  <Delete />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}

export default FileUploadZone;
