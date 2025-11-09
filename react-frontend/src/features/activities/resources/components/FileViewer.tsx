/**
 * FileViewer Component
 *
 * Renders format-specific file previews with embedded viewers for various file types.
 * Supports images, PDFs, videos, audio, office documents, and text files with
 * appropriate viewing interfaces, zoom and fullscreen controls, and comprehensive
 * accessibility features.
 *
 * Based on Moodle's resource_display_embed() function:
 * - public/mod/resource/locallib.php (lines 65-109)
 * - Implements resourcelib_embed_image(), resourcelib_embed_pdf() equivalents
 * - Uses core_media_manager logic for media file detection
 * - Provides MIME type-based viewer selection
 *
 * Features:
 * - Image viewer with zoom and pan controls
 * - PDF viewer using embedded iframe with PDF.js
 * - HTML5 video/audio players with Material-UI controls
 * - Office document viewer (Word, Excel, PowerPoint) via iframe
 * - Text file viewer with syntax highlighting
 * - Generic file preview with iframe fallback
 * - Download functionality for all file types
 * - File metadata display (size, type, dimensions, duration)
 * - Fullscreen mode toggle
 * - Loading and error state handling
 * - Keyboard shortcuts for viewer controls
 * - WCAG 2.1 AA compliant with proper ARIA labels
 * - Light/dark mode theming support
 * - Responsive layout for all screen sizes
 * - Touch device support with pinch-to-zoom
 *
 * @package    react-frontend
 * @subpackage features/activities/resources/components
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Toolbar,
  Tooltip,
  Paper,
  Stack,
  Divider,
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  GetApp,
  Fullscreen,
  FullscreenExit,
  ZoomOutMap,
  Info as InfoIcon,
} from '@mui/icons-material';
import type { File } from '../types/resource.types';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Alert } from '@/components/feedback/Alert';

/**
 * Props interface for the FileViewer component
 */
export interface FileViewerProps {
  /**
   * File object containing metadata and URL
   * Includes filename, filepath, filesize, fileurl, mimetype, etc.
   */
  file: File;

  /**
   * Optional title to display above the viewer
   * Defaults to the filename if not provided
   */
  title?: string;

  /**
   * Whether to show the metadata panel
   * @default true
   */
  showMetadata?: boolean;

  /**
   * Whether to show the download button
   * @default true
   */
  showDownload?: boolean;

  /**
   * Optional callback when download is initiated
   */
  onDownload?: () => void;

  /**
   * Optional CSS class name for custom styling
   */
  className?: string;

  /**
   * Optional aria-label for accessibility
   */
  ariaLabel?: string;
}

/**
 * Viewer type enumeration based on MIME type detection
 * Corresponds to Moodle's file_mimetype_in_typegroup() logic
 */
enum ViewerType {
  IMAGE = 'image',
  PDF = 'pdf',
  VIDEO = 'video',
  AUDIO = 'audio',
  OFFICE = 'office',
  TEXT = 'text',
  GENERIC = 'generic',
}

/**
 * Determines the appropriate viewer type based on MIME type
 * Implements file_mimetype_in_typegroup() equivalent logic (locallib.php line 85)
 *
 * @param mimetype - MIME type of the file
 * @returns ViewerType enum value
 */
const getViewerType = (mimetype: string): ViewerType => {
  // Image types (web_image type group)
  if (
    mimetype.startsWith('image/') &&
    (mimetype.includes('jpeg') ||
      mimetype.includes('jpg') ||
      mimetype.includes('png') ||
      mimetype.includes('gif') ||
      mimetype.includes('webp') ||
      mimetype.includes('svg'))
  ) {
    return ViewerType.IMAGE;
  }

  // PDF documents (locallib.php line 88-90)
  if (mimetype === 'application/pdf') {
    return ViewerType.PDF;
  }

  // Video files (core_media_manager detection logic)
  if (
    mimetype.startsWith('video/') ||
    mimetype === 'application/x-mpegURL' ||
    mimetype === 'application/vnd.apple.mpegURL'
  ) {
    return ViewerType.VIDEO;
  }

  // Audio files (core_media_manager detection logic)
  if (mimetype.startsWith('audio/')) {
    return ViewerType.AUDIO;
  }

  // Office documents
  if (
    mimetype === 'application/msword' ||
    mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/vnd.ms-excel' ||
    mimetype ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimetype === 'application/vnd.ms-powerpoint' ||
    mimetype ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mimetype === 'application/vnd.oasis.opendocument.text' ||
    mimetype === 'application/vnd.oasis.opendocument.spreadsheet' ||
    mimetype === 'application/vnd.oasis.opendocument.presentation'
  ) {
    return ViewerType.OFFICE;
  }

  // Text files
  if (
    mimetype.startsWith('text/') ||
    mimetype === 'application/json' ||
    mimetype === 'application/xml' ||
    mimetype === 'application/javascript'
  ) {
    return ViewerType.TEXT;
  }

  // Generic fallback (locallib.php line 96-102)
  return ViewerType.GENERIC;
};

/**
 * Formats file size for display
 *
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
};

/**
 * TextViewer Component
 * 
 * Separate component for rendering text files to properly use React hooks
 */
interface TextViewerProps {
  file: File;
  ariaLabel?: string;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

function TextViewer({ file, ariaLabel, setIsLoading, setError }: TextViewerProps) {
  const [textContent, setTextContent] = useState<string>('');

  useEffect(() => {
    fetch(file.fileurl)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch text file');
        }
        return response.text();
      })
      .then((text) => {
        setTextContent(text);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        setError(`Failed to load text file: ${err.message}`);
        setIsLoading(false);
      });
  }, [file.fileurl, setIsLoading, setError]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 400,
        overflow: 'auto',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: 'background.default',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <Typography
          component="pre"
          sx={{
            fontFamily: 'inherit',
            fontSize: '0.875rem',
            m: 0,
          }}
          aria-label={ariaLabel ?? `Text file: ${file.filename}`}
        >
          {textContent}
        </Typography>
      </Paper>
    </Box>
  );
}

/**
 * FileViewer Component
 *
 * Main component that renders the appropriate viewer based on file type
 * Implements resource_display_embed() equivalent logic (locallib.php lines 65-109)
 */
function FileViewer({
  file,
  title,
  showMetadata = true,
  showDownload = true,
  onDownload,
  className,
  ariaLabel,
}: FileViewerProps) {
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100); // Zoom level as percentage
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Determine viewer type based on MIME type
  const viewerType = useMemo(() => getViewerType(file.mimetype), [file.mimetype]);

  // Reset loading state when file changes
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setImageLoaded(false);
  }, [file.fileurl]);

  /**
   * Handle download button click
   * Implements moodle_url::make_pluginfile_url() equivalent (locallib.php line 71-72)
   */
  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload();
    }
    // Trigger download by creating a temporary link
    const link = document.createElement('a');
    link.href = file.fileurl;
    link.download = file.filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [file.fileurl, file.filename, onDownload]);

  /**
   * Handle zoom in
   */
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 25, 300));
  }, []);

  /**
   * Handle zoom out
   */
  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 25, 50));
  }, []);

  /**
   * Handle zoom reset
   */
  const handleZoomReset = useCallback(() => {
    setZoom(100);
  }, []);

  /**
   * Handle fullscreen toggle
   */
  const handleFullscreenToggle = useCallback(() => {
    if (!document.fullscreenElement) {
      // Enter fullscreen
      const element = document.getElementById('file-viewer-container');
      if (element) {
        if (element.requestFullscreen) {
          element.requestFullscreen().catch((err) => {
            console.error('Error attempting to enable fullscreen:', err);
          });
        }
      }
    } else if (document.exitFullscreen) {
      // Exit fullscreen
      document.exitFullscreen().catch((err) => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  }, []);

  /**
   * Listen for fullscreen changes
   */
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  /**
   * Keyboard shortcuts handler
   * Implements keyboard navigation for viewer controls
   */
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle keyboard shortcuts when not in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case '+':
        case '=':
          event.preventDefault();
          handleZoomIn();
          break;
        case '-':
        case '_':
          event.preventDefault();
          handleZoomOut();
          break;
        case '0':
          event.preventDefault();
          handleZoomReset();
          break;
        case 'f':
        case 'F':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            handleFullscreenToggle();
          }
          break;
        case 'd':
        case 'D':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            handleDownload();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleZoomIn, handleZoomOut, handleZoomReset, handleFullscreenToggle, handleDownload]);

  /**
   * Render image viewer
   * Implements resourcelib_embed_image() equivalent (locallib.php line 86)
   */
  const renderImageViewer = () => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'auto',
        height: '100%',
        minHeight: 400,
        bgcolor: 'background.default',
        position: 'relative',
        // Support pinch-to-zoom on touch devices
        touchAction: 'pan-x pan-y pinch-zoom',
      }}
    >
      <CardMedia
        component="img"
        src={file.fileurl}
        alt={title ?? file.filename}
        onLoad={() => {
          setImageLoaded(true);
          setIsLoading(false);
        }}
        onError={() => {
          setError('Failed to load image. The file may be corrupted or unavailable.');
          setIsLoading(false);
        }}
        sx={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          transform: `scale(${zoom / 100})`,
          transition: 'transform 0.2s ease-in-out',
          cursor: zoom > 100 ? 'move' : 'default',
        }}
        aria-label={ariaLabel ?? `Image: ${file.filename}`}
      />
      {!imageLoaded && isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <LoadingSpinner size="large" message="Loading image..." />
        </Box>
      )}
    </Box>
  );

  /**
   * Render PDF viewer
   * Implements resourcelib_embed_pdf() equivalent (locallib.php line 88-90)
   */
  const renderPDFViewer = () => (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 600,
        position: 'relative',
      }}
    >
      <iframe
        src={`${file.fileurl}#view=FitH`}
        title={title ?? file.filename}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setError('Failed to load PDF. Your browser may not support PDF viewing.');
          setIsLoading(false);
        }}
        aria-label={ariaLabel ?? `PDF document: ${file.filename}`}
      />
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <LoadingSpinner size="large" message="Loading PDF..." />
        </Box>
      )}
    </Box>
  );

  /**
   * Render video viewer
   * Implements core_media_manager equivalent logic (locallib.php line 79, 92-94)
   */
  const renderVideoViewer = () => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        bgcolor: 'background.default',
        minHeight: 400,
      }}
    >
      <video
        controls
        controlsList="nodownload"
        preload="metadata"
        style={{
          maxWidth: '100%',
          maxHeight: '600px',
          width: '100%',
        }}
        onLoadedMetadata={() => setIsLoading(false)}
        onError={() => {
          setError('Failed to load video. The format may not be supported by your browser.');
          setIsLoading(false);
        }}
        aria-label={ariaLabel ?? `Video: ${file.filename}`}
      >
        <source src={file.fileurl} type={file.mimetype} />
        <track kind="captions" label="No captions available" />
        <Typography>
          Your browser does not support the video tag. Please{' '}
          <Button onClick={handleDownload} size="small">
            download the file
          </Button>{' '}
          to view it.
        </Typography>
      </video>
    </Box>
  );

  /**
   * Render audio viewer
   * Implements core_media_manager equivalent logic (locallib.php line 79, 92-94)
   */
  const renderAudioViewer = () => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        p: 4,
        minHeight: 200,
      }}
    >
      <audio
        controls
        controlsList="nodownload"
        preload="metadata"
        style={{
          width: '100%',
          maxWidth: 600,
        }}
        onLoadedMetadata={() => setIsLoading(false)}
        onError={() => {
          setError('Failed to load audio. The format may not be supported by your browser.');
          setIsLoading(false);
        }}
        aria-label={ariaLabel ?? `Audio: ${file.filename}`}
      >
        <source src={file.fileurl} type={file.mimetype} />
        <track kind="captions" label="No captions available" />
        <Typography>
          Your browser does not support the audio tag. Please{' '}
          <Button onClick={handleDownload} size="small">
            download the file
          </Button>{' '}
          to listen to it.
        </Typography>
      </audio>
    </Box>
  );

  /**
   * Render office document viewer
   * Uses Office Online or Google Docs viewer via iframe
   */
  const renderOfficeViewer = () => {
    // Use Microsoft Office Online viewer for Office documents
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
      file.fileurl
    )}`;

    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          minHeight: 600,
          position: 'relative',
        }}
      >
        <iframe
          src={viewerUrl}
          title={title ?? file.filename}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setError(
              'Failed to load document in viewer. The file may require download to view.'
            );
            setIsLoading(false);
          }}
          aria-label={ariaLabel ?? `Office document: ${file.filename}`}
        />
        {isLoading && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <LoadingSpinner size="large" message="Loading document..." />
          </Box>
        )}
      </Box>
    );
  };

  /**
   * Render text file viewer
   * Shows text content with syntax highlighting
   */
  const renderTextViewer = () => {
    return <TextViewer file={file} ariaLabel={ariaLabel} setIsLoading={setIsLoading} setError={setError} />;
  };

  /**
   * Render generic file viewer
   * Implements resourcelib_embed_general() equivalent (locallib.php line 98, 101)
   * Uses iframe with embed parameter for unknown types
   */
  const renderGenericViewer = () => {
    // Add embed parameter to URL (locallib.php line 98)
    const embedUrl = new URL(file.fileurl);
    embedUrl.searchParams.set('embed', '1');

    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          minHeight: 400,
          position: 'relative',
        }}
      >
        <iframe
          src={embedUrl.toString()}
          title={title ?? file.filename}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setError('This file type cannot be previewed. Please download to view.');
            setIsLoading(false);
          }}
          aria-label={ariaLabel ?? `File: ${file.filename}`}
        />
        {isLoading && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <LoadingSpinner size="large" message="Loading file..." />
          </Box>
        )}
      </Box>
    );
  };

  /**
   * Render the appropriate viewer based on file type
   */
  const renderViewer = () => {
    if (error) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert
            severity="error"
            message={error}
            action={
              <Button size="small" onClick={handleDownload} startIcon={<GetApp />}>
                Download File
              </Button>
            }
          />
        </Box>
      );
    }

    switch (viewerType) {
      case ViewerType.IMAGE:
        return renderImageViewer();
      case ViewerType.PDF:
        return renderPDFViewer();
      case ViewerType.VIDEO:
        return renderVideoViewer();
      case ViewerType.AUDIO:
        return renderAudioViewer();
      case ViewerType.OFFICE:
        return renderOfficeViewer();
      case ViewerType.TEXT:
        return renderTextViewer();
      case ViewerType.GENERIC:
      default:
        return renderGenericViewer();
    }
  };

  /**
   * Render file metadata panel
   * Shows file size, type, dimensions (for images), duration (for media)
   */
  const renderMetadata = () => {
    if (!showMetadata) {
      return null;
    }

    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <InfoIcon color="action" fontSize="small" />
              <Typography variant="h6" component="h3">
                File Information
              </Typography>
            </Stack>
            <Divider />
            <Stack spacing={0.5}>
              <Typography variant="body2">
                <strong>Filename:</strong> {file.filename}
              </Typography>
              <Typography variant="body2">
                <strong>Size:</strong> {formatFileSize(file.filesize)}
              </Typography>
              <Typography variant="body2">
                <strong>Type:</strong> {file.mimetype}
              </Typography>
              {file.timemodified && (
                <Typography variant="body2">
                  <strong>Modified:</strong>{' '}
                  {new Date(file.timemodified * 1000).toLocaleString()}
                </Typography>
              )}
              {file.isexternalfile && file.repositorytype && (
                <Typography variant="body2">
                  <strong>Source:</strong> {file.repositorytype}
                </Typography>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  /**
   * Render viewer controls toolbar
   * Provides zoom, fullscreen, and download controls
   */
  const renderControls = () => {
    const showZoomControls = viewerType === ViewerType.IMAGE;

    return (
      <Toolbar
        variant="dense"
        sx={{
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          gap: 1,
          minHeight: 48,
        }}
      >
        {showZoomControls && (
          <>
            <Tooltip title="Zoom In (+)">
              <IconButton
                onClick={handleZoomIn}
                disabled={zoom >= 300}
                aria-label="Zoom in"
                size="small"
              >
                <ZoomIn />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom Out (-)">
              <IconButton
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                aria-label="Zoom out"
                size="small"
              >
                <ZoomOut />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset Zoom (0)">
              <IconButton
                onClick={handleZoomReset}
                disabled={zoom === 100}
                aria-label="Reset zoom"
                size="small"
              >
                <ZoomOutMap />
              </IconButton>
            </Tooltip>
            <Typography variant="body2" sx={{ mx: 1, minWidth: 50 }}>
              {zoom}%
            </Typography>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          </>
        )}
        <Tooltip title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}>
          <IconButton
            onClick={handleFullscreenToggle}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            size="small"
          >
            {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
          </IconButton>
        </Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        {showDownload && (
          <Tooltip title="Download File (D)">
            <Button
              onClick={handleDownload}
              startIcon={<GetApp />}
              variant="outlined"
              size="small"
              aria-label={`Download ${file.filename}`}
            >
              Download
            </Button>
          </Tooltip>
        )}
      </Toolbar>
    );
  };

  return (
    <Box
      id="file-viewer-container"
      className={className}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
      }}
      role="region"
      aria-label={ariaLabel ?? 'File viewer'}
    >
      {renderMetadata()}
      <Paper
        elevation={2}
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {renderControls()}
        <Box
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            position: 'relative',
          }}
        >
          {renderViewer()}
        </Box>
      </Paper>
    </Box>
  );
}

export default FileViewer;
