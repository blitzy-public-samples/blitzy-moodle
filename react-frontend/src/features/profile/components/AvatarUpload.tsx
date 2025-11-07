/**
 * AvatarUpload Component
 *
 * Component for uploading and managing user profile avatars.
 * Supports drag-and-drop, file validation, preview, and deletion.
 *
 * @module features/profile/components
 */

import type React from 'react';
import { useState, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Avatar,
  Button,
  IconButton,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  PhotoCamera as CameraIcon,
} from '@mui/icons-material';
import { useUploadAvatar, useDeleteAvatar } from '../hooks/useUpdateProfile';
import type { AvatarConstraints } from '../types/profile.types';

/**
 * Props for AvatarUpload component
 */
export interface AvatarUploadProps {
  /**
   * User ID for avatar upload
   */
  userId: number;

  /**
   * Current avatar URL
   */
  currentAvatarUrl?: string;

  /**
   * Callback on successful upload
   */
  onUploadSuccess?: (url: string) => void;

  /**
   * Callback on successful deletion
   */
  onDeleteSuccess?: () => void;

  /**
   * Whether to allow avatar deletion
   * @default true
   */
  allowDelete?: boolean;

  /**
   * Custom avatar constraints
   */
  constraints?: Partial<AvatarConstraints>;

  /**
   * Size variant
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Additional CSS class name
   */
  className?: string;
}

/**
 * Default avatar constraints
 */
const DEFAULT_CONSTRAINTS: AvatarConstraints = {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  minWidth: 100,
  minHeight: 100,
  maxWidth: 4096,
  maxHeight: 4096,
};

/**
 * Avatar size configurations
 */
const AVATAR_SIZES = {
  small: { size: 80, iconSize: 32 },
  medium: { size: 120, iconSize: 48 },
  large: { size: 180, iconSize: 64 },
};

/**
 * AvatarUpload Component
 *
 * Interactive component for managing user avatars with drag-and-drop support,
 * validation, preview, and deletion capabilities.
 *
 * @example
 * ```tsx
 * <AvatarUpload
 *   userId={currentUser.id}
 *   currentAvatarUrl={currentUser.profileimageurl}
 *   onUploadSuccess={(url) => {
 *     toast.success('Avatar updated!');
 *   }}
 * />
 * ```
 */
export function AvatarUpload({
  userId,
  currentAvatarUrl,
  onUploadSuccess,
  onDeleteSuccess,
  allowDelete = true,
  constraints = {},
  size = 'medium',
  className,
}: AvatarUploadProps) {
  // State
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Merge constraints with defaults
  const finalConstraints: AvatarConstraints = useMemo(
    () => ({
      ...DEFAULT_CONSTRAINTS,
      ...constraints,
    }),
    [constraints]
  );

  // Get size configuration
  const sizeConfig = AVATAR_SIZES[size];

  // Mutations
  const {
    mutate: uploadAvatar,
    isPending: isUploading,
    error: uploadError,
  } = useUploadAvatar(userId, {
    onSuccess: (response) => {
      if (response.success) {
        setPreview(null);
        setValidationError(null);
        onUploadSuccess?.(response.profileimageurl);
      } else if (response.error) {
        setValidationError(response.error.message);
      }
    },
    onError: (error) => {
      setValidationError(error.message);
    },
  });

  const { mutate: deleteAvatar, isPending: isDeleting } = useDeleteAvatar(userId, {
    onSuccess: () => {
      setPreview(null);
      setValidationError(null);
      onDeleteSuccess?.();
    },
  });

  /**
   * Validate file before upload
   */
  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file size
      if (file.size > finalConstraints.maxSize) {
        return `File size exceeds ${(finalConstraints.maxSize / 1024 / 1024).toFixed(1)}MB limit`;
      }

      // Check file type
      if (!finalConstraints.allowedTypes.includes(file.type)) {
        return `Invalid file type. Allowed types: ${finalConstraints.allowedTypes
          .map((t) => t.split('/')[1]?.toUpperCase() ?? t)
          .join(', ')}`;
      }

      return null;
    },
    [finalConstraints]
  );

  /**
   * Validate image dimensions
   */
  const validateImageDimensions = useCallback(
    (file: File): Promise<string | null> => {
      return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
          URL.revokeObjectURL(objectUrl);

          const { width, height } = img;

          // Check minimum dimensions if specified
          if (finalConstraints.minWidth !== undefined && finalConstraints.minHeight !== undefined) {
            if (width < finalConstraints.minWidth || height < finalConstraints.minHeight) {
              resolve(
                `Image dimensions too small. Minimum: ${finalConstraints.minWidth}x${finalConstraints.minHeight}px`
              );
              return;
            }
          }

          // Check maximum dimensions if specified
          if (finalConstraints.maxWidth !== undefined && finalConstraints.maxHeight !== undefined) {
            if (width > finalConstraints.maxWidth || height > finalConstraints.maxHeight) {
              resolve(
                `Image dimensions too large. Maximum: ${finalConstraints.maxWidth}x${finalConstraints.maxHeight}px`
              );
              return;
            }
          }

          resolve(null);
        };

        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve('Failed to load image for validation');
        };

        img.src = objectUrl;
      });
    },
    [finalConstraints]
  );

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(
    async (file: File) => {
      // Reset previous errors
      setValidationError(null);

      // Validate file
      const fileError = validateFile(file);
      if (fileError) {
        setValidationError(fileError);
        return;
      }

      // Validate dimensions
      const dimensionError = await validateImageDimensions(file);
      if (dimensionError) {
        setValidationError(dimensionError);
        return;
      }

      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      // Upload file
      uploadAvatar(file);
    },
    [validateFile, validateImageDimensions, uploadAvatar]
  );

  /**
   * Handle file input change
   */
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void handleFileSelect(file);
      }
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFileSelect]
  );

  /**
   * Handle drag events
   */
  const handleDrag = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  /**
   * Handle drop event
   */
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);

      const file = event.dataTransfer?.files?.[0];
      if (file) {
        void handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  /**
   * Handle click to open file dialog
   */
  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Handle delete avatar
   */
  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete your avatar?')) {
      deleteAvatar();
    }
  }, [deleteAvatar]);

  /**
   * Get display URL (preview or current avatar)
   */
  const displayUrl = preview ?? currentAvatarUrl;

  const isProcessing = isUploading || isDeleting;

  return (
    <Box className={className} display="flex" flexDirection="column" alignItems="center" gap={2}>
      {/* Avatar Display with Upload Zone */}
      <Box sx={{ position: 'relative', display: 'inline-block' }}>
        <Paper
          role="button"
          tabIndex={0}
          aria-label="Upload avatar image"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick();
            }
          }}
          sx={{
            position: 'relative',
            borderRadius: '50%',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            border: dragActive ? '3px dashed' : '3px solid transparent',
            borderColor: dragActive ? 'primary.main' : 'transparent',
            transition: 'all 0.3s ease',
            '&:hover': {
              borderColor: isProcessing ? 'transparent' : 'primary.light',
              transform: isProcessing ? 'none' : 'scale(1.05)',
            },
          }}
        >
          <Avatar
            src={displayUrl}
            alt="User avatar"
            sx={{
              width: sizeConfig.size,
              height: sizeConfig.size,
              opacity: isProcessing ? 0.5 : 1,
            }}
          />

          {/* Upload Overlay */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              opacity: 0,
              transition: 'opacity 0.3s ease',
              '&:hover': {
                opacity: isProcessing ? 0 : 1,
              },
            }}
          >
            {isProcessing ? (
              <CircularProgress size={sizeConfig.iconSize} sx={{ color: 'white' }} />
            ) : (
              <CameraIcon sx={{ fontSize: sizeConfig.iconSize, color: 'white' }} />
            )}
          </Box>

          {/* Instructions - positioned inside Paper for accessibility */}
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: 1,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {dragActive ? (
              'Drop image here'
            ) : (
              <>
                Click or drag image to upload
                <br />
                Max size: {(finalConstraints.maxSize / 1024 / 1024).toFixed(1)}MB
              </>
            )}
          </Typography>
        </Paper>
      </Box>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={finalConstraints.allowedTypes.join(',')}
        onChange={handleInputChange}
        style={{ display: 'none' }}
        disabled={isProcessing}
        aria-label="Upload avatar image"
      />

      {/* Action Buttons */}
      <Box display="flex" gap={1}>
        <Button
          variant="outlined"
          startIcon={<UploadIcon />}
          onClick={handleClick}
          disabled={isProcessing}
          size="small"
        >
          Choose File
        </Button>

        {allowDelete && currentAvatarUrl && (
          <Tooltip title="Remove avatar">
            <IconButton color="error" onClick={handleDelete} disabled={isProcessing} size="small">
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Validation Error */}
      {validationError && (
        <Alert severity="error" aria-live="assertive" sx={{ width: '100%', maxWidth: 400 }}>
          {validationError}
        </Alert>
      )}

      {/* Upload Error */}
      {uploadError && (
        <Alert severity="error" aria-live="assertive" sx={{ width: '100%', maxWidth: 400 }}>
          {uploadError.message || 'Failed to upload avatar'}
        </Alert>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <Alert severity="info" aria-live="polite" sx={{ width: '100%', maxWidth: 400 }}>
          Uploading avatar...
        </Alert>
      )}
    </Box>
  );
}

export default AvatarUpload;
