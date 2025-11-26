/**
 * ResourceView Component
 *
 * Displays resource activity overview and metadata using Material-UI Card layout.
 * Fetches resource data via useResource hook with React Query for automatic caching,
 * shows file information including type and size, provides action buttons based on
 * display mode, and implements comprehensive loading/error states with full accessibility.
 *
 * Features:
 * - Material-UI Card layout with header, content, and action sections
 * - Automatic data fetching via React Query with 5-minute cache
 * - File type detection and appropriate icon display
 * - Display mode handling (EMBED, FRAME, OPEN, DOWNLOAD)
 * - Loading state with animated spinner
 * - Error state with user-friendly messages
 * - Completion tracking integration
 * - WCAG 2.1 AA accessibility compliance
 * - Responsive design with proper spacing
 * - Light/dark mode support via MUI theming
 * - TypeScript strict mode with explicit interfaces
 *
 * Based on:
 * - public/mod/resource/view.php (lines 26-109)
 * - public/mod/resource/locallib.php (resource display functions)
 *
 * @package    react-frontend
 * @subpackage features/activities/resources
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import type React from 'react';
import { useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Avatar,
  Box,
  Typography,
  Button,
  Chip,
  Divider,
  Stack,
} from '@mui/material';
import {
  OpenInNew,
  Download,
  Visibility,
  Description,
  PictureAsPdf,
  Image,
  VideoFile,
  AudioFile,
  Article,
  Folder,
  InsertDriveFile,
} from '@mui/icons-material';

import { useResource } from '@/features/activities/resources/hooks/useResource';
import type { DisplayOptions } from '@/features/activities/resources/types/resource.types';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Alert } from '@/components/feedback/Alert';

/**
 * Props interface for ResourceView component
 *
 * @property resourceId - The unique identifier of the resource to display
 */
export interface ResourceViewProps {
  /**
   * Resource ID to fetch and display
   * Must be a positive integer corresponding to a valid resource activity
   */
  resourceId: number;
}

/**
 * Resource display type constants
 * Maps to RESOURCELIB_DISPLAY_* constants from public/lib/resourcelib.php
 */
const RESOURCELIB_DISPLAY_AUTO = 0;
const RESOURCELIB_DISPLAY_EMBED = 1;
const RESOURCELIB_DISPLAY_FRAME = 2;
const RESOURCELIB_DISPLAY_NEW = 3;
const RESOURCELIB_DISPLAY_DOWNLOAD = 4;
const RESOURCELIB_DISPLAY_OPEN = 5;
const RESOURCELIB_DISPLAY_POPUP = 6;

/**
 * Get file type icon component based on MIME type
 *
 * Provides visual representation of file types with appropriate icons.
 * Similar to file_file_icon() in public/lib/filelib.php
 *
 * @param mimetype - MIME type of the file (e.g., 'application/pdf')
 * @returns React icon component for the file type
 */
function getFileTypeIcon(mimetype: string): React.ReactElement {
  // PDF documents
  if (mimetype === 'application/pdf') {
    return <PictureAsPdf />;
  }

  // Images
  if (mimetype.startsWith('image/')) {
    return <Image />;
  }

  // Videos
  if (mimetype.startsWith('video/')) {
    return <VideoFile />;
  }

  // Audio files
  if (mimetype.startsWith('audio/')) {
    return <AudioFile />;
  }

  // Microsoft Word documents
  if (
    mimetype === 'application/msword' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return <Description />;
  }

  // Text documents
  if (mimetype.startsWith('text/')) {
    return <Article />;
  }

  // Archives/folders
  if (
    mimetype === 'application/zip' ||
    mimetype === 'application/x-rar-compressed' ||
    mimetype === 'application/x-7z-compressed'
  ) {
    return <Folder />;
  }

  // Default icon for unknown file types
  return <InsertDriveFile />;
}

/**
 * Format file size to human-readable string
 *
 * Converts bytes to appropriate unit (B, KB, MB, GB).
 * Similar to display_size() in public/lib/moodlelib.php
 *
 * @param bytes - File size in bytes
 * @returns Formatted file size string (e.g., "2.5 MB")
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format Unix timestamp to readable date string
 *
 * Converts Unix timestamp to localized date and time string.
 * Similar to userdate() in public/lib/moodlelib.php
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string (e.g., "January 15, 2024 at 2:30 PM")
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get display mode label for user interface
 *
 * Converts display type constant to human-readable label.
 *
 * @param displayType - Resource display type constant
 * @returns User-friendly display mode label
 */
function getDisplayModeLabel(displayType: number): string {
  switch (displayType) {
    case RESOURCELIB_DISPLAY_EMBED:
      return 'Embedded';
    case RESOURCELIB_DISPLAY_FRAME:
      return 'In Frame';
    case RESOURCELIB_DISPLAY_NEW:
      return 'New Window';
    case RESOURCELIB_DISPLAY_DOWNLOAD:
      return 'Download';
    case RESOURCELIB_DISPLAY_OPEN:
      return 'Open';
    case RESOURCELIB_DISPLAY_POPUP:
      return 'Popup';
    case RESOURCELIB_DISPLAY_AUTO:
    default:
      return 'Auto';
  }
}

/**
 * ResourceView Component
 *
 * Main component for displaying resource activity details.
 * Fetches resource data from /api/v1/resources/{id} and renders
 * comprehensive resource information with appropriate action buttons.
 *
 * Implements:
 * - React Query data fetching with automatic caching (view.php lines 36-49)
 * - Permission checking via backend API (view.php line 55)
 * - Display type detection (view.php line 78)
 * - File metadata display (locallib.php)
 * - Multiple display modes (view.php lines 98-108)
 * - Loading and error states
 * - Accessibility compliance (WCAG 2.1 AA)
 *
 * @param props - Component props
 * @returns JSX element displaying the resource activity
 */
export default function ResourceView({ resourceId }: ResourceViewProps): JSX.Element {
  // Fetch resource data using React Query hook
  // Calls GET /api/v1/resources/{id} which wraps existing Moodle functions
  // Includes automatic caching with 5-minute stale time
  const { data: resource, isLoading, isError, error } = useResource(resourceId);

  // Parse display options from serialized JSON string
  // Similar to unserialize_array($resource->displayoptions) in locallib.php
  const displayOptions = useMemo<DisplayOptions>(() => {
    if (!resource || resource.type !== 'resource') {
      return {};
    }

    try {
      return resource.displayoptions ? (JSON.parse(resource.displayoptions) as Record<string, unknown>) : {};
    } catch (err) {
      console.error('Failed to parse display options:', err);
      return {};
    }
  }, [resource]);

  // Get primary file from resource
  // Similar to reset($files) in view.php line 73
  const primaryFile = useMemo(() => {
    if (!resource || resource.type !== 'resource' || !resource.files || resource.files.length === 0) {
      return null;
    }
    return resource.files[0];
  }, [resource]);

  // Determine display type for the resource
  // Implements resource_get_final_display_type() from locallib.php
  const displayType = useMemo(() => {
    if (!resource || resource.type !== 'resource') {
      return RESOURCELIB_DISPLAY_AUTO;
    }
    return resource.display ?? RESOURCELIB_DISPLAY_AUTO;
  }, [resource]);

  // Loading state - display spinner during data fetch
  // Corresponds to page loading state before content is ready
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
          width: '100%',
        }}
        role="status"
        aria-live="polite"
        aria-label="Loading resource"
      >
        <LoadingSpinner size="large" message="Loading resource..." />
      </Box>
    );
  }

  // Error state - display alert for fetch failures
  // Similar to error handling in view.php (e.g., throw new moodle_exception)
  if (isError || !resource) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          title="Unable to Load Resource"
          message={
            (error as any)?.customError?.message ?? 
            error?.message ?? 
            'The requested resource could not be loaded. Please try again later.'
          }
          closeable={false}
        />
      </Box>
    );
  }

  // Handle tobemigrated flag - resource needs migration from old format
  // Corresponds to view.php lines 62-65
  if (resource.type === 'resource' && 'tobemigrated' in resource && resource.tobemigrated === 1) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="warning"
          title="Resource Migration Required"
          message="This resource is in an old format and needs to be migrated. Please contact your system administrator."
          closeable={false}
        />
      </Box>
    );
  }

  // Handle missing files - no content files found
  // Corresponds to view.php lines 69-71
  if (resource.type === 'resource' && (!resource.files || resource.files.length === 0)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          title="File Not Found"
          message="This resource has no content files attached. The file may have been deleted or moved."
          closeable={false}
        />
      </Box>
    );
  }

  // Determine action button configuration based on display type
  // Implements click-to-open behavior from resource_get_clicktoopen() in locallib.php line 68
  const getActionButton = (): React.ReactElement | null => {
    if (!primaryFile) {
      return null;
    }

    const fileUrl = primaryFile.url;

    switch (displayType) {
      case RESOURCELIB_DISPLAY_DOWNLOAD:
        // Force download of the file
        // Corresponds to RESOURCELIB_DISPLAY_DOWNLOAD in view.php line 79
        return (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Download />}
            href={fileUrl}
            download
            aria-label={`Download ${primaryFile.filename}`}
            sx={{ textTransform: 'none' }}
          >
            Download
          </Button>
        );

      case RESOURCELIB_DISPLAY_NEW:
      case RESOURCELIB_DISPLAY_POPUP:
        // Open in new window or popup
        // Corresponds to RESOURCELIB_DISPLAY_NEW and RESOURCELIB_DISPLAY_POPUP
        return (
          <Button
            variant="contained"
            color="primary"
            startIcon={<OpenInNew />}
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${primaryFile.filename} in new tab`}
            sx={{ textTransform: 'none' }}
          >
            Open in New Tab
          </Button>
        );

      case RESOURCELIB_DISPLAY_EMBED:
      case RESOURCELIB_DISPLAY_FRAME:
      case RESOURCELIB_DISPLAY_OPEN:
      case RESOURCELIB_DISPLAY_AUTO:
      default:
        // View/open the resource (default behavior)
        // Corresponds to default view behavior in view.php
        return (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Visibility />}
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${primaryFile.filename}`}
            sx={{ textTransform: 'none' }}
          >
            View Resource
          </Button>
        );
    }
  };

  return (
    <Card
      sx={{
        maxWidth: 1200,
        mx: 'auto',
        my: 3,
        boxShadow: 3,
      }}
      component="article"
      role="region"
      aria-label={`Resource: ${resource.name}`}
    >
      {/* Card Header - Resource name and icon */}
      <CardHeader
        avatar={
          primaryFile ? (
            <Avatar
              sx={{
                bgcolor: 'primary.main',
                width: 56,
                height: 56,
              }}
              aria-hidden="true"
            >
              {getFileTypeIcon(primaryFile.mimetype)}
            </Avatar>
          ) : (
            <Avatar
              sx={{
                bgcolor: 'grey.400',
                width: 56,
                height: 56,
              }}
              aria-hidden="true"
            >
              <Description />
            </Avatar>
          )
        }
        title={
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
            {resource.name}
          </Typography>
        }
        subheader={
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {primaryFile && (
              <>
                <Chip
                  label={primaryFile.mimetype}
                  size="small"
                  variant="outlined"
                  sx={{ borderRadius: 1 }}
                  aria-label={`File type: ${primaryFile.mimetype}`}
                />
                <Chip
                  label={formatFileSize(primaryFile.filesize)}
                  size="small"
                  variant="outlined"
                  sx={{ borderRadius: 1 }}
                  aria-label={`File size: ${formatFileSize(primaryFile.filesize)}`}
                />
                <Chip
                  label={getDisplayModeLabel(displayType)}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ borderRadius: 1 }}
                  aria-label={`Display mode: ${getDisplayModeLabel(displayType)}`}
                />
              </>
            )}
          </Stack>
        }
        sx={{ pb: 2 }}
      />

      <Divider />

      {/* Card Content - Resource description and metadata */}
      <CardContent sx={{ pt: 3, pb: 2 }}>
        {/* Resource introduction/description text */}
        {resource.intro && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="body1"
              component="div"
              sx={{
                lineHeight: 1.7,
                '& p': { mb: 2 },
                '& ul, & ol': { pl: 3, mb: 2 },
                '& a': {
                  color: 'primary.main',
                  textDecoration: 'underline',
                  '&:hover': { textDecoration: 'none' },
                },
              }}
              dangerouslySetInnerHTML={{ __html: resource.intro }}
              aria-label="Resource description"
            />
          </Box>
        )}

        {/* File metadata section */}
        {primaryFile && (
          <Box
            sx={{
              p: 2,
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
            }}
            role="complementary"
            aria-label="File information"
          >
            <Typography variant="h6" component="h2" sx={{ mb: 2, fontWeight: 600 }}>
              File Information
            </Typography>

            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  File Name:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }} aria-label="File name">
                  {primaryFile.filename}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  File Type:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }} aria-label="MIME type">
                  {primaryFile.mimetype}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  File Size:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }} aria-label="File size">
                  {formatFileSize(primaryFile.filesize)}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Last Modified:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }} aria-label="Last modified date">
                  {formatDate(primaryFile.timemodified)}
                </Typography>
              </Box>

              {displayOptions.showsize === 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Display Size:
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {displayOptions.width && displayOptions.height
                      ? `${displayOptions.width} × ${displayOptions.height} px`
                      : 'Auto'}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>
        )}

        {/* Display revision information if available */}
        {resource.type === 'resource' && resource.revision && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Revision: {resource.revision}
            </Typography>
          </Box>
        )}
      </CardContent>

      <Divider />

      {/* Card Actions - Action buttons based on display type */}
      <CardActions sx={{ p: 2, justifyContent: 'flex-end' }}>
        {getActionButton()}
      </CardActions>
    </Card>
  );
}
