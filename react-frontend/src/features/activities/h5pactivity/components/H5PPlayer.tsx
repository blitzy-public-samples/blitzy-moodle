/**
 * H5PPlayer Component
 *
 * React component for embedding and rendering H5P interactive content with
 * xAPI statement tracking and event handling. Provides iframe-based H5P content
 * player that loads H5P packages from API endpoints, handles xAPI statement
 * capture for learning analytics tracking, and manages player display options.
 *
 * Features:
 * - Iframe-based H5P content embedding with secure cross-origin communication
 * - xAPI statement capture for learning analytics (experienced, answered, completed)
 * - Display options control (frame, export, embed, copyright)
 * - User interaction tracking with API persistence
 * - Responsive resize handling using ResizeObserver and postMessage
 * - Fullscreen mode toggle with Fullscreen API and fallback
 * - Player controls UI with Material-UI components
 * - Content loading states with Skeleton placeholder
 * - Error handling for content loading failures
 * - Preview mode support for teachers with disabled tracking
 * - CORS handling for cross-origin iframe communication
 * - Accessibility features including keyboard navigation and screen reader support
 *
 * Based on:
 * - public/mod/h5pactivity/view.php - H5P content embedding patterns
 * - public/mod/h5pactivity/classes/xapi/handler.php - xAPI statement processing
 * - public/mod/h5pactivity/classes/local/manager.php - tracking and capabilities
 *
 * @package    react-frontend
 * @subpackage features/activities/h5pactivity/components
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
  Skeleton,
} from '@mui/material';
import {
  Fullscreen,
  FullscreenExit,
  Settings,
  Refresh,
  Download,
  Code,
  Copyright,
  Info,
} from '@mui/icons-material';

// Internal imports from depends_on_files
import useH5PActivity from '../hooks/useH5PActivity';
import * as h5pApi from '../api/h5pApi';
import type { H5PStatement, H5PDisplayOptions } from '../types/h5p.types';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Alert } from '@/components/feedback/Alert';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Props interface for the H5PPlayer component
 */
export interface H5PPlayerProps {
  /**
   * H5P activity module ID to load and play
   */
  activityId: number;

  /**
   * Course module ID for context
   */
  cmId: number;

  /**
   * Context ID for file URL generation
   */
  contextId: number;

  /**
   * Base URL for the Moodle installation
   */
  baseUrl: string;

  /**
   * Whether to enable preview mode (tracking disabled, for teachers)
   * @default false
   */
  previewMode?: boolean;

  /**
   * Optional callback when an xAPI statement is received
   */
  onStatement?: (statement: H5PStatement) => void;

  /**
   * Optional callback when content finishes loading
   */
  onContentLoaded?: () => void;

  /**
   * Optional callback when an error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Optional custom height for the player container
   * @default 'auto'
   */
  height?: number | string;

  /**
   * Optional custom width for the player container
   * @default '100%'
   */
  width?: number | string;

  /**
   * Optional className for custom styling
   */
  className?: string;
}

/**
 * Internal state for tracking H5P content status
 */
interface H5PContentState {
  /** Whether the iframe is currently loading */
  isLoading: boolean;
  /** Whether there was an error loading content */
  hasError: boolean;
  /** Error message if loading failed */
  errorMessage: string | null;
  /** Current iframe height (for responsive resize) */
  iframeHeight: number;
  /** Whether fullscreen mode is active */
  isFullscreen: boolean;
  /** Whether the content has been marked as viewed */
  hasBeenViewed: boolean;
}

/**
 * H5P postMessage event data structure for xAPI statements
 */
interface H5PPostMessageData {
  /** Type of H5P message */
  type?: string;
  /** xAPI statement data */
  statement?: H5PStatement;
  /** Resize height value */
  height?: number;
  /** Action type for H5P events */
  action?: string;
  /** Content ID for context */
  contentId?: string;
}

/**
 * Valid xAPI verbs that trigger statement persistence
 * Based on public/mod/h5pactivity/classes/xapi/handler.php
 */
const TRACKED_XAPI_VERBS = [
  'http://adlnet.gov/expapi/verbs/answered',
  'http://adlnet.gov/expapi/verbs/completed',
  'http://adlnet.gov/expapi/verbs/experienced',
  'http://adlnet.gov/expapi/verbs/attempted',
  'http://adlnet.gov/expapi/verbs/interacted',
] as const;

/**
 * Default iframe height in pixels
 */
const DEFAULT_IFRAME_HEIGHT = 500;

/**
 * Minimum iframe height in pixels
 */
const MIN_IFRAME_HEIGHT = 100;

/**
 * Maximum iframe height in pixels
 */
const MAX_IFRAME_HEIGHT = 2000;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * H5PPlayer Component
 *
 * Embeds and renders H5P interactive content with xAPI tracking capabilities.
 * Handles all communication with the H5P iframe including statement capture,
 * resize events, and player controls.
 *
 * @param props - Component props including activityId, cmId, and options
 * @returns React component rendering the H5P player
 *
 * @example
 * Basic usage:
 * ```tsx
 * <H5PPlayer
 *   activityId={123}
 *   cmId={456}
 *   contextId={789}
 *   baseUrl="https://moodle.example.com"
 * />
 * ```
 *
 * @example
 * With preview mode and callbacks:
 * ```tsx
 * <H5PPlayer
 *   activityId={123}
 *   cmId={456}
 *   contextId={789}
 *   baseUrl="https://moodle.example.com"
 *   previewMode={true}
 *   onStatement={(stmt) => console.log('Statement:', stmt)}
 *   onContentLoaded={() => console.log('Content loaded')}
 *   onError={(err) => console.error('Error:', err)}
 * />
 * ```
 */
function H5PPlayer({
  activityId,
  cmId,
  contextId,
  baseUrl,
  previewMode = false,
  onStatement,
  onContentLoaded,
  onError,
  height = 'auto',
  width = '100%',
  className,
}: H5PPlayerProps): React.ReactElement {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  // Fetch activity data and access permissions
  const {
    activity,
    access,
    isLoading: isActivityLoading,
    isError: isActivityError,
    error: activityError,
    parseDisplayOptions,
    isTrackingEnabled,
    canViewReports,
  } = useH5PActivity(activityId);

  // Internal state for content loading and display
  const [state, setState] = useState<H5PContentState>({
    isLoading: true,
    hasError: false,
    errorMessage: null,
    iframeHeight: DEFAULT_IFRAME_HEIGHT,
    isFullscreen: false,
    hasBeenViewed: false,
  });

  // Settings menu anchor element
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);

  // Refs for DOM elements and cleanup
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Parse display options from activity data
  const displayOptions: H5PDisplayOptions = activity
    ? parseDisplayOptions(activity.displayoptions.toString())
    : { frame: true, download: false, embed: false, copyright: false, about: false };

  // Determine if tracking should be active
  const shouldTrack = !previewMode && isTrackingEnabled() && access?.cansubmit;

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Generate the H5P content URL for the iframe
   * Constructs the pluginfile URL for the H5P package
   */
  const getH5PContentUrl = useCallback((): string => {
    // Build the H5P player URL
    // Format: {baseUrl}/mod/h5pactivity/embed.php?id={cmId}
    const url = new URL(`${baseUrl}/mod/h5pactivity/embed.php`);
    url.searchParams.append('id', cmId.toString());
    
    // Add preview mode flag if needed
    if (previewMode) {
      url.searchParams.append('preview', '1');
    }

    return url.toString();
  }, [baseUrl, cmId, previewMode]);

  /**
   * Check if a verb ID is one we should track
   */
  const isTrackedVerb = useCallback((verbId: string): boolean => {
    return TRACKED_XAPI_VERBS.some((trackedVerb) => verbId.includes(trackedVerb));
  }, []);

  /**
   * Validate and sanitize xAPI statement data
   */
  const validateStatement = useCallback((data: unknown): H5PStatement | null => {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const statement = data as Partial<H5PStatement>;

    // Check required properties
    if (!statement.actor || !statement.verb || !statement.object) {
      return null;
    }

    // Validate actor
    if (!statement.actor.name || !statement.actor.mbox || !statement.actor.objectType) {
      return null;
    }

    // Validate verb
    if (!statement.verb.id || !statement.verb.display) {
      return null;
    }

    // Validate object
    if (!statement.object.id || !statement.object.objectType) {
      return null;
    }

    return statement as H5PStatement;
  }, []);

  /**
   * Submit xAPI statement to the API
   */
  const submitStatement = useCallback(
    async (statement: H5PStatement): Promise<void> => {
      if (!shouldTrack) {
        return;
      }

      try {
        // Use the h5pApi to submit the statement
        await h5pApi.submitXAPIStatement(activityId, statement);

        // Call optional callback
        if (onStatement) {
          onStatement(statement);
        }
      } catch (error) {
        console.error('Failed to submit xAPI statement:', error);
        // Don't throw - statement submission failures shouldn't break the player
      }
    },
    [activityId, shouldTrack, onStatement]
  );

  /**
   * Handle xAPI statements from H5P iframe postMessage
   */
  const handleXAPIStatement = useCallback(
    (statementData: unknown): void => {
      const statement = validateStatement(statementData);

      if (!statement) {
        console.warn('Invalid xAPI statement received:', statementData);
        return;
      }

      // Check if this is a verb we want to track
      if (!isTrackedVerb(statement.verb.id)) {
        return;
      }

      // Submit the statement asynchronously
      void submitStatement(statement);
    },
    [validateStatement, isTrackedVerb, submitStatement]
  );

  /**
   * Handle resize messages from H5P iframe
   */
  const handleResize = useCallback((newHeight: number): void => {
    // Clamp height to reasonable bounds
    const clampedHeight = Math.min(
      Math.max(newHeight, MIN_IFRAME_HEIGHT),
      MAX_IFRAME_HEIGHT
    );

    setState((prev) => ({
      ...prev,
      iframeHeight: clampedHeight,
    }));
  }, []);

  /**
   * Mark the activity as viewed
   */
  const markAsViewed = useCallback(async (): Promise<void> => {
    if (state.hasBeenViewed || previewMode) {
      return;
    }

    try {
      await h5pApi.viewH5PActivity(activityId);
      setState((prev) => ({ ...prev, hasBeenViewed: true }));
    } catch (error) {
      console.error('Failed to mark activity as viewed:', error);
    }
  }, [activityId, previewMode, state.hasBeenViewed]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Handle postMessage events from the H5P iframe
   * Processes xAPI statements, resize events, and other H5P communications
   */
  const handlePostMessage = useCallback(
    (event: MessageEvent): void => {
      // Validate message origin for security
      if (!event.origin.includes(new URL(baseUrl).hostname)) {
        return;
      }

      // Parse message data
      let messageData: H5PPostMessageData;
      try {
        messageData =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        // Not a JSON message, ignore
        return;
      }

      if (!messageData || typeof messageData !== 'object') {
        return;
      }

      // Handle different message types
      switch (messageData.type) {
        case 'h5pResize':
        case 'resize':
          if (typeof messageData.height === 'number') {
            handleResize(messageData.height);
          }
          break;

        case 'xAPIStatement':
        case 'statement':
          if (messageData.statement) {
            handleXAPIStatement(messageData.statement);
          }
          break;

        case 'contentLoaded':
        case 'ready':
          setState((prev) => ({ ...prev, isLoading: false }));
          if (onContentLoaded) {
            onContentLoaded();
          }
          // Mark as viewed when content loads
          void markAsViewed();
          break;

        case 'error':
          setState((prev) => ({
            ...prev,
            isLoading: false,
            hasError: true,
            errorMessage: 'H5P content failed to load',
          }));
          if (onError) {
            onError(new Error('H5P content failed to load'));
          }
          break;

        default:
          // Handle action-based messages
          if (messageData.action === 'resize' && typeof messageData.height === 'number') {
            handleResize(messageData.height);
          }
          break;
      }
    },
    [baseUrl, handleResize, handleXAPIStatement, markAsViewed, onContentLoaded, onError]
  );

  /**
   * Handle iframe load event
   */
  const handleIframeLoad = useCallback((): void => {
    setState((prev) => ({ ...prev, isLoading: false }));

    // Mark as viewed when iframe loads
    void markAsViewed();

    if (onContentLoaded) {
      onContentLoaded();
    }
  }, [markAsViewed, onContentLoaded]);

  /**
   * Handle iframe error event
   */
  const handleIframeError = useCallback((): void => {
    const errorMessage = 'Failed to load H5P content';
    setState((prev) => ({
      ...prev,
      isLoading: false,
      hasError: true,
      errorMessage,
    }));

    if (onError) {
      onError(new Error(errorMessage));
    }
  }, [onError]);

  /**
   * Toggle fullscreen mode
   */
  const toggleFullscreen = useCallback(async (): Promise<void> => {
    if (!containerRef.current) {
      return;
    }

    try {
      if (!state.isFullscreen) {
        // Enter fullscreen
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
          await (containerRef.current as HTMLDivElement & { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
        } else if ((containerRef.current as HTMLDivElement & { msRequestFullscreen?: () => Promise<void> }).msRequestFullscreen) {
          await (containerRef.current as HTMLDivElement & { msRequestFullscreen: () => Promise<void> }).msRequestFullscreen();
        }
        setState((prev) => ({ ...prev, isFullscreen: true }));
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen) {
          await (document as Document & { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen();
        } else if ((document as Document & { msExitFullscreen?: () => Promise<void> }).msExitFullscreen) {
          await (document as Document & { msExitFullscreen: () => Promise<void> }).msExitFullscreen();
        }
        setState((prev) => ({ ...prev, isFullscreen: false }));
      }
    } catch (error) {
      console.error('Fullscreen toggle failed:', error);
    }
  }, [state.isFullscreen]);

  /**
   * Handle fullscreen change events (from browser fullscreen controls)
   */
  const handleFullscreenChange = useCallback((): void => {
    const isFullscreen = Boolean(
      document.fullscreenElement ||
        (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
        (document as Document & { msFullscreenElement?: Element }).msFullscreenElement
    );
    setState((prev) => ({ ...prev, isFullscreen }));
  }, []);

  /**
   * Reload the H5P content
   */
  const reloadContent = useCallback((): void => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      hasError: false,
      errorMessage: null,
    }));

    if (iframeRef.current) {
      iframeRef.current.src = getH5PContentUrl();
    }
  }, [getH5PContentUrl]);

  /**
   * Open settings menu
   */
  const handleSettingsClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>): void => {
      setSettingsAnchor(event.currentTarget);
    },
    []
  );

  /**
   * Close settings menu
   */
  const handleSettingsClose = useCallback((): void => {
    setSettingsAnchor(null);
  }, []);

  /**
   * Handle keyboard navigation for accessibility
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent): void => {
      switch (event.key) {
        case 'f':
        case 'F':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            void toggleFullscreen();
          }
          break;
        case 'Escape':
          if (state.isFullscreen) {
            void toggleFullscreen();
          }
          break;
        case 'r':
        case 'R':
          if (event.ctrlKey || event.metaKey && event.shiftKey) {
            event.preventDefault();
            reloadContent();
          }
          break;
        default:
          break;
      }
    },
    [state.isFullscreen, toggleFullscreen, reloadContent]
  );

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Set up postMessage listener for H5P communication
   */
  useEffect(() => {
    window.addEventListener('message', handlePostMessage);

    return () => {
      window.removeEventListener('message', handlePostMessage);
    };
  }, [handlePostMessage]);

  /**
   * Set up fullscreen change listener
   */
  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [handleFullscreenChange]);

  /**
   * Set up ResizeObserver for responsive container handling
   */
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Send resize message to iframe if it needs to know container size
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              type: 'containerResize',
              width: entry.contentRect.width,
              height: entry.contentRect.height,
            },
            '*'
          );
        }
      }
    });

    resizeObserverRef.current.observe(containerRef.current);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * Render the player controls toolbar
   */
  const renderControls = (): React.ReactElement => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 1,
        p: 1,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      {/* Preview mode indicator */}
      {previewMode && (
        <Typography
          variant="caption"
          sx={{
            mr: 'auto',
            px: 1,
            py: 0.5,
            bgcolor: 'info.light',
            color: 'info.contrastText',
            borderRadius: 1,
          }}
        >
          Preview Mode - Tracking Disabled
        </Typography>
      )}

      {/* Reload button */}
      <Tooltip title="Reload content (Ctrl+Shift+R)">
        <IconButton
          onClick={reloadContent}
          size="small"
          aria-label="Reload H5P content"
        >
          <Refresh />
        </IconButton>
      </Tooltip>

      {/* Fullscreen toggle */}
      <Tooltip title={state.isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen (Ctrl+F)'}>
        <IconButton
          onClick={() => void toggleFullscreen()}
          size="small"
          aria-label={state.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {state.isFullscreen ? <FullscreenExit /> : <Fullscreen />}
        </IconButton>
      </Tooltip>

      {/* Settings menu */}
      {(displayOptions.download || displayOptions.embed || displayOptions.copyright) && (
        <>
          <Tooltip title="Settings">
            <IconButton
              onClick={handleSettingsClick}
              size="small"
              aria-label="Open settings menu"
              aria-haspopup="true"
              aria-expanded={Boolean(settingsAnchor)}
            >
              <Settings />
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={settingsAnchor}
            open={Boolean(settingsAnchor)}
            onClose={handleSettingsClose}
            aria-label="H5P player settings"
          >
            {displayOptions.download && (
              <MenuItem onClick={handleSettingsClose}>
                <ListItemIcon>
                  <Download fontSize="small" />
                </ListItemIcon>
                <ListItemText>Download Content</ListItemText>
              </MenuItem>
            )}

            {displayOptions.embed && (
              <MenuItem onClick={handleSettingsClose}>
                <ListItemIcon>
                  <Code fontSize="small" />
                </ListItemIcon>
                <ListItemText>Embed Code</ListItemText>
              </MenuItem>
            )}

            {displayOptions.copyright && (
              <MenuItem onClick={handleSettingsClose}>
                <ListItemIcon>
                  <Copyright fontSize="small" />
                </ListItemIcon>
                <ListItemText>Copyright Information</ListItemText>
              </MenuItem>
            )}

            {displayOptions.about && (
              <MenuItem onClick={handleSettingsClose}>
                <ListItemIcon>
                  <Info fontSize="small" />
                </ListItemIcon>
                <ListItemText>About H5P</ListItemText>
              </MenuItem>
            )}
          </Menu>
        </>
      )}

      {/* View reports link for teachers */}
      {canViewReports() && isTrackingEnabled() && (
        <Tooltip title="View all attempts">
          <IconButton
            size="small"
            aria-label="View attempt reports"
            component="a"
            href={`${baseUrl}/mod/h5pactivity/report.php?id=${cmId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Info />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );

  /**
   * Render loading skeleton placeholder
   */
  const renderLoadingSkeleton = (): React.ReactElement => (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.paper',
        zIndex: 1,
      }}
    >
      <LoadingSpinner size="large" message="Loading H5P content..." />
      <Skeleton
        variant="rectangular"
        width="90%"
        height={300}
        sx={{ mt: 3, borderRadius: 1 }}
      />
    </Box>
  );

  /**
   * Render error state
   */
  const renderError = (): React.ReactElement => (
    <Box
      sx={{
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Alert
        severity="error"
        title="Content Loading Failed"
        message={state.errorMessage || 'An error occurred while loading the H5P content. Please try again.'}
        action={
          <IconButton
            color="inherit"
            size="small"
            onClick={reloadContent}
            aria-label="Retry loading content"
          >
            <Refresh />
          </IconButton>
        }
      />
    </Box>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  // Show loading state while fetching activity data
  if (isActivityLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 200,
        }}
      >
        <LoadingSpinner size="large" message="Loading activity..." />
      </Box>
    );
  }

  // Show error if activity fetch failed
  if (isActivityError || !activity) {
    return (
      <Alert
        severity="error"
        title="Failed to Load Activity"
        message={activityError?.message || 'Unable to load the H5P activity. Please check your permissions and try again.'}
      />
    );
  }

  // Check access permissions
  if (!access?.canview) {
    return (
      <Alert
        severity="warning"
        title="Access Denied"
        message="You do not have permission to view this H5P activity."
      />
    );
  }

  return (
    <Paper
      ref={containerRef}
      className={className}
      elevation={displayOptions.frame ? 2 : 0}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label={`H5P Activity: ${activity.name}`}
      sx={{
        width,
        position: 'relative',
        overflow: 'hidden',
        outline: 'none',
        borderRadius: displayOptions.frame ? 1 : 0,
        '&:focus-visible': {
          boxShadow: (theme) => `0 0 0 3px ${theme.palette.primary.main}`,
        },
        ...(state.isFullscreen && {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9999,
          borderRadius: 0,
        }),
      }}
    >
      {/* Controls toolbar */}
      {displayOptions.frame && renderControls()}

      {/* Content container */}
      <Box
        sx={{
          position: 'relative',
          height: height === 'auto' ? state.iframeHeight : height,
          minHeight: MIN_IFRAME_HEIGHT,
          overflow: 'hidden',
          ...(state.isFullscreen && {
            height: `calc(100vh - ${displayOptions.frame ? '56px' : '0px'})`,
          }),
        }}
      >
        {/* Loading overlay */}
        {state.isLoading && renderLoadingSkeleton()}

        {/* Error state */}
        {state.hasError && renderError()}

        {/* H5P iframe */}
        {!state.hasError && (
          <iframe
            ref={iframeRef}
            src={getH5PContentUrl()}
            title={`H5P Activity: ${activity.name}`}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            allow="fullscreen; autoplay; geolocation; microphone; camera; midi; encrypted-media"
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: state.isLoading ? 'none' : 'block',
            }}
            aria-label={`Interactive H5P content: ${activity.name}`}
          />
        )}
      </Box>

      {/* Screen reader status announcements */}
      <Box
        role="status"
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {state.isLoading && 'Loading H5P content, please wait...'}
        {state.hasError && `Error: ${state.errorMessage}`}
        {!state.isLoading && !state.hasError && 'H5P content loaded successfully'}
      </Box>
    </Paper>
  );
}

export default H5PPlayer;
