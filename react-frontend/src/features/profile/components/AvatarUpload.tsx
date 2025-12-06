/**
 * AvatarUpload Component
 *
 * React component for uploading and cropping user profile avatar images with
 * drag-and-drop support, image preview, client-side validation (file type, size),
 * and cropping functionality before upload.
 *
 * Features:
 * - Drag-and-drop file upload using react-dropzone
 * - Real-time image preview
 * - Client-side file type and size validation (max 100MB default)
 * - Cropping functionality placeholder for future integration
 * - Material-UI styling and responsive design
 * - WCAG 2.1 AA accessibility compliance with proper ARIA labels
 * - Integration with profile API for avatar submission
 * - Comprehensive error handling and user feedback
 *
 * Based on Moodle profile picture handling from:
 * - public/user/edit.php - Profile edit form with picture upload
 * - public/user/edit_form.php - Form definition for profile editing
 *
 * @module features/profile/components
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Button,
  Avatar,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Crop as CropIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import type { AvatarUploadResponse } from '../types/profile.types';
import { uploadAvatar } from '../api/profileApi';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for AvatarUpload component
 *
 * Defines the configuration options for the avatar upload component including
 * current avatar URL, callbacks for success/error handling, and constraints
 * for file uploads.
 */
export interface AvatarUploadProps {
  /**
   * User ID for avatar upload - required for API call
   * The ID of the user whose avatar is being uploaded
   */
  userId: number;

  /**
   * Current avatar URL to display as initial preview
   * If not provided, a default avatar placeholder is shown
   */
  currentAvatarUrl?: string;

  /**
   * Callback invoked when avatar upload succeeds
   * Receives the new avatar URL as parameter
   *
   * @param url - The new profile image URL returned by the server
   */
  onUploadSuccess: (url: string) => void;

  /**
   * Callback invoked when avatar upload fails
   * Receives the error object with details
   *
   * @param error - Error object containing failure details
   */
  onUploadError: (error: Error) => void;

  /**
   * Maximum file size in bytes for uploaded images
   * Defaults to 100MB (104857600 bytes) as per requirements
   */
  maxFileSize?: number;

  /**
   * Array of accepted MIME types for upload
   * Defaults to ['image/jpeg', 'image/png', 'image/gif']
   */
  acceptedFormats?: string[];
}

/**
 * Default maximum file size: 100MB in bytes
 */
const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Default accepted image formats
 */
const DEFAULT_ACCEPTED_FORMATS = ['image/jpeg', 'image/png', 'image/gif'];

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * AvatarUpload Component
 *
 * Interactive component for managing user avatars with drag-and-drop support,
 * validation, preview, and upload capabilities. Uses react-dropzone for
 * accessible file selection and Material-UI for consistent styling.
 *
 * @example
 * ```tsx
 * <AvatarUpload
 *   userId={currentUser.id}
 *   currentAvatarUrl={currentUser.profileimageurl}
 *   onUploadSuccess={(url) => {
 *     console.log('New avatar URL:', url);
 *     updateUserProfile({ profileimageurl: url });
 *   }}
 *   onUploadError={(error) => {
 *     console.error('Upload failed:', error.message);
 *     showErrorToast(error.message);
 *   }}
 *   maxFileSize={5 * 1024 * 1024} // 5MB
 * />
 * ```
 */
function AvatarUpload({
  userId,
  currentAvatarUrl,
  onUploadSuccess,
  onUploadError,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
}: AvatarUploadProps): React.ReactElement {
  // ============================================================================
  // Component State
  // ============================================================================

  /**
   * Currently selected file for upload
   * Null when no file is selected
   */
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  /**
   * Preview URL for the selected image
   * Generated using URL.createObjectURL() for local preview
   * Null when no file is selected or after cleanup
   */
  const [preview, setPreview] = useState<string | null>(null);

  /**
   * Upload in progress flag
   * True while the upload API call is being processed
   */
  const [isUploading, setIsUploading] = useState<boolean>(false);

  /**
   * Error message to display to user
   * Null when there are no errors
   */
  const [error, setError] = useState<string | null>(null);

  /**
   * Flag to control crop dialog visibility
   * Placeholder for future cropping library integration
   */
  const [showCropDialog, setShowCropDialog] = useState<boolean>(false);

  // ============================================================================
  // Cleanup Effect
  // ============================================================================

  /**
   * Cleanup effect to revoke object URLs on unmount
   * Prevents memory leaks by releasing object URL resources
   */
  useEffect(() => {
    // Cleanup function
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // ============================================================================
  // File Handling Functions
  // ============================================================================

  /**
   * Validates the selected file against constraints
   *
   * Checks file type against accepted formats and file size against maximum.
   * Returns validation error message or null if valid.
   *
   * @param file - The file to validate
   * @returns Error message string if invalid, null if valid
   */
  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file type
      if (!acceptedFormats.includes(file.type)) {
        const formatNames = acceptedFormats
          .map((format) => format.split('/')[1]?.toUpperCase() ?? format)
          .join(', ');
        return `Invalid file type. Accepted formats: ${formatNames}`;
      }

      // Check file size
      if (file.size > maxFileSize) {
        const maxSizeMB = (maxFileSize / (1024 * 1024)).toFixed(1);
        return `File size exceeds ${maxSizeMB}MB limit`;
      }

      return null;
    },
    [acceptedFormats, maxFileSize]
  );

  /**
   * Handles file drop from dropzone
   *
   * Validates the dropped file, creates a preview URL, and stores
   * the file for upload. Displays validation errors if file is invalid.
   *
   * @param acceptedFiles - Array of files accepted by dropzone
   */
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      // Clear previous errors
      setError(null);

      // Get the first file (single file mode)
      const file = acceptedFiles[0];

      if (!file) {
        return;
      }

      // Validate the file
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      // Revoke previous preview URL if exists
      if (preview) {
        URL.revokeObjectURL(preview);
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);

      // Update state
      setSelectedFile(file);
      setPreview(previewUrl);
    },
    [preview, validateFile]
  );

  /**
   * Handles file upload to server
   *
   * Creates FormData with the selected file and calls the profile API
   * endpoint to upload the avatar. Invokes success/error callbacks
   * based on the result.
   */
  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      setError('No file selected');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Call the uploadAvatar API function
      const response: AvatarUploadResponse = await uploadAvatar(userId, selectedFile);

      if (response.success) {
        // Upload succeeded - invoke success callback with new avatar URL
        onUploadSuccess(response.profileimageurl);

        // Clear the selected file and preview after successful upload
        if (preview) {
          URL.revokeObjectURL(preview);
        }
        setSelectedFile(null);
        setPreview(null);
      } else {
        // Server returned an error response
        const errorMessage = response.error?.message ?? 'Upload failed';
        setError(errorMessage);
        onUploadError(new Error(errorMessage));
      }
    } catch (uploadError) {
      // Handle network or unexpected errors
      const errorMessage =
        uploadError instanceof Error ? uploadError.message : 'Failed to upload avatar';
      setError(errorMessage);
      onUploadError(uploadError instanceof Error ? uploadError : new Error(errorMessage));
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, userId, onUploadSuccess, onUploadError, preview]);

  /**
   * Handles removal of selected file
   *
   * Clears the selected file and preview, revoking the object URL
   * to prevent memory leaks.
   */
  const handleRemove = useCallback(() => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setSelectedFile(null);
    setPreview(null);
    setError(null);
  }, [preview]);

  /**
   * Handles opening the crop dialog
   *
   * Placeholder function for future cropping library integration.
   * Currently opens a dialog indicating cropping feature is coming.
   */
  const handleCrop = useCallback(() => {
    setShowCropDialog(true);
  }, []);

  /**
   * Handles closing the crop dialog
   */
  const handleCloseCropDialog = useCallback(() => {
    setShowCropDialog(false);
  }, []);

  // ============================================================================
  // Dropzone Configuration
  // ============================================================================

  /**
   * Configure react-dropzone hook
   *
   * Sets up drag-and-drop file selection with:
   * - Accepted file types (image/jpeg, image/png, image/gif)
   * - Maximum file size constraint
   * - Single file mode (multiple: false)
   * - onDrop callback for file handling
   */
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
    },
    maxSize: maxFileSize,
    multiple: false,
    disabled: isUploading,
  });

  // ============================================================================
  // Display Logic
  // ============================================================================

  /**
   * Determine the image URL to display
   * Priority: preview (selected file) > current avatar > none
   */
  const displayImageUrl = preview ?? currentAvatarUrl;

  /**
   * Format file size for display
   *
   * @param bytes - File size in bytes
   * @returns Formatted string with appropriate unit (KB or MB)
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        width: '100%',
        maxWidth: 400,
      }}
    >
      {/* Dropzone Area */}
      <Paper
        {...getRootProps()}
        elevation={isDragActive ? 4 : 1}
        sx={{
          width: '100%',
          p: 3,
          border: '2px dashed',
          borderColor: isDragReject
            ? 'error.main'
            : isDragActive
              ? 'primary.main'
              : 'divider',
          borderRadius: 2,
          backgroundColor: isDragActive
            ? 'action.hover'
            : 'background.paper',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease-in-out',
          opacity: isUploading ? 0.7 : 1,
          '&:hover': {
            borderColor: isUploading ? 'divider' : 'primary.main',
            backgroundColor: isUploading ? 'background.paper' : 'action.hover',
          },
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        }}
        role="button"
        tabIndex={0}
        aria-label="Drop zone for avatar image upload. Click or drag and drop an image file."
        aria-describedby="dropzone-description"
      >
        {/* Hidden file input */}
        <input {...getInputProps()} aria-label="Upload avatar image file" />

        {/* Dropzone Content */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {/* Avatar Preview */}
          <Avatar
            src={displayImageUrl}
            alt="Avatar preview"
            sx={{
              width: 120,
              height: 120,
              border: '3px solid',
              borderColor: 'primary.main',
              boxShadow: 2,
            }}
          >
            {/* Default icon when no image */}
            {!displayImageUrl && (
              <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
            )}
          </Avatar>

          {/* Upload Instructions */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="body1"
              color={isDragActive ? 'primary' : 'text.primary'}
              fontWeight="medium"
            >
              {isDragActive
                ? 'Drop image here...'
                : 'Drag & drop an image or click to browse'}
            </Typography>
            <Typography
              id="dropzone-description"
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Accepted formats: JPEG, PNG, GIF (max {(maxFileSize / (1024 * 1024)).toFixed(0)}MB)
            </Typography>
          </Box>

          {/* Loading Spinner */}
          {isUploading && (
            <CircularProgress
              size={24}
              aria-label="Uploading avatar..."
              sx={{ mt: 1 }}
            />
          )}
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          sx={{ width: '100%' }}
          onClose={() => setError(null)}
          role="alert"
        >
          {error}
        </Alert>
      )}

      {/* Selected File Info */}
      {selectedFile && (
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            p: 2,
            backgroundColor: 'grey.50',
            borderRadius: 1,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="body2" fontWeight="medium" noWrap>
                {selectedFile.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatFileSize(selectedFile.size)}
              </Typography>
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {/* Crop Button (placeholder for future functionality) */}
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  handleCrop();
                }}
                disabled={isUploading}
                size="small"
                aria-label="Crop image"
                title="Crop image"
              >
                <CropIcon fontSize="small" />
              </IconButton>

              {/* Remove Button */}
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                disabled={isUploading}
                size="small"
                color="error"
                aria-label="Remove selected image"
                title="Remove image"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Upload Button */}
      {selectedFile && (
        <Button
          variant="contained"
          color="primary"
          onClick={handleUpload}
          disabled={isUploading || !selectedFile}
          startIcon={
            isUploading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <CloudUploadIcon />
            )
          }
          fullWidth
          sx={{ mt: 1 }}
          aria-label={isUploading ? 'Uploading avatar...' : 'Upload avatar image'}
        >
          {isUploading ? 'Uploading...' : 'Upload Avatar'}
        </Button>
      )}

      {/* Crop Dialog (Placeholder for future cropping library integration) */}
      <Dialog
        open={showCropDialog}
        onClose={handleCloseCropDialog}
        maxWidth="sm"
        fullWidth
        aria-labelledby="crop-dialog-title"
      >
        <DialogTitle id="crop-dialog-title">Crop Image</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              py: 3,
            }}
          >
            {preview && (
              <Avatar
                src={preview}
                alt="Image to crop"
                sx={{
                  width: 200,
                  height: 200,
                  border: '2px dashed',
                  borderColor: 'primary.main',
                }}
              />
            )}
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Image cropping functionality will be available in a future update.
              For now, please ensure your image is already cropped to your preference.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCropDialog} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Default export as specified in exports schema
export default AvatarUpload;
