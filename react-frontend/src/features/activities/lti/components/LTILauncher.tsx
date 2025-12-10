/**
 * LTILauncher - React Component for Launching LTI External Tools
 *
 * This component handles launching LTI (Learning Tools Interoperability) external tools
 * with support for both LTI 1.1 (OAuth 1.0a) and LTI 1.3 (OIDC/JWT) protocols.
 * It provides multiple launch container modes including iframe embedding, new window
 * popup, and window replacement.
 *
 * Features:
 * - LTI 1.1 OAuth 1.0a signature handling
 * - LTI 1.3 OIDC authentication flow with JWT tokens
 * - Multiple launch containers: embed, embed_no_blocks, window, replace_moodle_window
 * - Iframe embedding with proper security attributes (allow permissions)
 * - Auto-resizing iframe based on viewport
 * - Support for different message types (basic-lti-launch-request, LtiSubmissionReviewRequest, gradeReport)
 * - Material-UI integration for consistent styling
 * - React Query integration for data fetching
 *
 * Based on Moodle's LTI implementation:
 * - public/mod/lti/launch.php - Launch logic and OIDC initiation
 * - public/mod/lti/view.php - Iframe rendering and launch container handling
 * - public/mod/lti/locallib.php - LTI constants and launch functions
 *
 * @module features/activities/lti/components/LTILauncher
 */

import type React from 'react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { Box, Alert, CircularProgress, Typography, Button, Link } from '@mui/material';
import { OpenInNew as OpenInNewIcon, Refresh as RefreshIcon } from '@mui/icons-material';

import { useLTILaunch, type LtiLaunchData } from '../hooks/useLTILaunch';
import { LaunchContainer } from '../types/lti.types';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * LTI action type for different launch scenarios
 */
export type LtiAction = '' | 'gradeReport' | 'ContentItemSelection';

/**
 * Props interface for the LTILauncher component
 * Exported as part of the public API
 */
export interface LTILauncherProps {
  /**
   * The LTI tool instance ID (course module ID)
   * This corresponds to the 'id' parameter in public/mod/lti/launch.php
   */
  ltiId: number;

  /**
   * Launch container mode determining how the tool is displayed
   * Maps to LTI_LAUNCH_CONTAINER_* constants from locallib.php lines 70-74
   * @default LaunchContainer.DEFAULT
   */
  container?: LaunchContainer;

  /**
   * Optional action parameter for the launch
   * - 'gradeReport': Triggers LtiSubmissionReviewRequest message type
   * - 'ContentItemSelection': For deep linking scenarios
   * - '': Standard basic-lti-launch-request
   * Based on action parameter handling in launch.php lines 55-76
   */
  action?: LtiAction;

  /**
   * Optional user ID to launch on behalf of
   * Used by teachers/admins to view the tool as a specific student
   * Maps to 'user' parameter in launch.php line 56
   */
  forUserId?: number;

  /**
   * Callback invoked when the launch completes successfully
   * Receives the launch data containing endpoint and parameters
   */
  onLaunchSuccess?: (launchData: LtiLaunchData) => void;

  /**
   * Callback invoked when the launch fails
   * Receives the error with details about the failure
   */
  onLaunchError?: (error: Error) => void;

  /**
   * Optional custom title for the tool display
   */
  title?: string;

  /**
   * Whether to auto-launch on component mount
   * @default true
   */
  autoLaunch?: boolean;

  /**
   * Initial height for the iframe in embed mode
   * @default '600px'
   */
  iframeHeight?: string;

  /**
   * Whether to show the loading indicator
   * @default true
   */
  showLoading?: boolean;

  /**
   * Whether to show error alerts
   * @default true
   */
  showErrors?: boolean;

  /**
   * Custom CSS class for the container
   */
  className?: string;

  /**
   * Whether to trigger view completion tracking
   * @default true
   */
  triggerView?: boolean;
}

/**
 * Internal state for iframe resizing
 */
interface IframeState {
  height: string;
  isLoaded: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default iframe height for embedded tools
 */
const DEFAULT_IFRAME_HEIGHT = '600px';

/**
 * Padding added to iframe height calculations to account for borders
 * Based on view.php line 203
 */
const IFRAME_HEIGHT_PADDING = 15;

/**
 * Iframe security permissions for LTI tools
 * Based on view.php lines 185-190
 */
const IFRAME_ALLOW_PERMISSIONS = [
  'microphone',
  'camera',
  'geolocation',
  'midi',
  'encrypted-media',
  'autoplay',
] as const;

/**
 * Map action to LTI message type
 * Based on launch.php lines 72-75
 */
const ACTION_TO_MESSAGE_TYPE: Record<LtiAction, string> = {
  '': 'basic-lti-launch-request',
  gradeReport: 'LtiSubmissionReviewRequest',
  ContentItemSelection: 'ContentItemSelectionRequest',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Constructs the allowed origin URL for iframe security policies
 * Parses the tool URL and extracts scheme://host:port
 * Based on view.php lines 167-177
 *
 * @param toolUrl - The tool's base URL
 * @returns The allowed origin string or empty string if URL is invalid
 */
function constructAllowedOrigin(toolUrl: string): string {
  if (!toolUrl) {
    return '';
  }

  try {
    const url = new URL(toolUrl);
    // Construct origin from scheme, host, and optional port
    let origin = `${url.protocol}//${url.hostname}`;
    if (url.port) {
      origin += `:${url.port}`;
    }
    return origin;
  } catch {
    // If URL parsing fails, return empty string
    return '';
  }
}

/**
 * Generates the iframe 'allow' attribute value with proper origin restrictions
 * Based on view.php lines 185-190
 *
 * @param toolUrl - The tool's URL for origin extraction
 * @returns The allow attribute string
 */
function generateIframeAllowAttribute(toolUrl: string): string {
  const origin = constructAllowedOrigin(toolUrl);

  return IFRAME_ALLOW_PERMISSIONS
    .map((permission) => `${permission} ${origin}`)
    .join('; ');
}

/**
 * Calculates the optimal iframe height based on viewport
 * Based on the YUI resize script in view.php lines 197-218
 *
 * @param iframeTop - The Y position of the iframe
 * @param viewportHeight - The current viewport height
 * @returns The calculated height in pixels
 */
function calculateIframeHeight(iframeTop: number, viewportHeight: number): number {
  return Math.max(viewportHeight - iframeTop - IFRAME_HEIGHT_PADDING, 400);
}

/**
 * Determines the iframe name based on launch container and LTI ID
 * Used for form submission targets
 *
 * @param container - The launch container mode
 * @param ltiId - The LTI tool instance ID
 * @returns The iframe name
 */
function getIframeName(container: LaunchContainer, ltiId: number): string {
  switch (container) {
    case LaunchContainer.EMBED:
      return `lti-embed-${ltiId}`;
    case LaunchContainer.EMBED_NO_BLOCKS:
      return `lti-embed-noblocks-${ltiId}`;
    default:
      return `lti-frame-${ltiId}`;
  }
}

/**
 * Determines if the container mode requires an iframe
 */
function isEmbedContainer(container: LaunchContainer): boolean {
  return (
    container === LaunchContainer.DEFAULT ||
    container === LaunchContainer.EMBED ||
    container === LaunchContainer.EMBED_NO_BLOCKS
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Loading state display component
 */
interface LoadingStateProps {
  message?: string;
}

function LoadingState({ message = 'Launching external tool...' }: LoadingStateProps): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        gap: 2,
      }}
    >
      <CircularProgress size={40} />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}

/**
 * New window launch link component
 * Rendered when launch container is WINDOW
 * Based on view.php lines 161-163
 */
interface NewWindowLinkProps {
  launchUrl: string;
  ltiId: number;
  title?: string;
  onLaunch: () => void;
}

function NewWindowLink({
  launchUrl,
  ltiId,
  title,
  onLaunch,
}: NewWindowLinkProps): React.ReactElement {
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      window.open(launchUrl, `lti-${ltiId}`, 'resizable=yes,scrollbars=yes,status=yes');
      onLaunch();
    },
    [launchUrl, ltiId, onLaunch]
  );

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body1" gutterBottom>
        {title ?? 'External tool launched in a new window.'}
      </Typography>
      <Link
        href={launchUrl}
        onClick={handleClick}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        Open in new window
        <OpenInNewIcon fontSize="small" />
      </Link>
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * LTILauncher Component
 *
 * React component for launching LTI external tools with support for multiple
 * launch protocols (LTI 1.1/1.3) and container modes (embed, window, replace).
 *
 * @param props - Component props
 * @returns The rendered LTI launcher component
 *
 * @example Basic embedded launch
 * ```tsx
 * <LTILauncher
 *   ltiId={123}
 *   container={LaunchContainer.EMBED}
 * />
 * ```
 *
 * @example Launch with callbacks
 * ```tsx
 * <LTILauncher
 *   ltiId={123}
 *   container={LaunchContainer.WINDOW}
 *   onLaunchSuccess={(data) => console.log('Launched:', data)}
 *   onLaunchError={(error) => console.error('Failed:', error)}
 * />
 * ```
 *
 * @example Launch as different user (admin/teacher use case)
 * ```tsx
 * <LTILauncher
 *   ltiId={123}
 *   forUserId={456}
 *   action="gradeReport"
 * />
 * ```
 */
function LTILauncher({
  ltiId,
  container = LaunchContainer.DEFAULT,
  action = '',
  forUserId,
  onLaunchSuccess,
  onLaunchError,
  title,
  autoLaunch = true,
  iframeHeight = DEFAULT_IFRAME_HEIGHT,
  showLoading = true,
  showErrors = true,
  className,
  triggerView = true,
}: LTILauncherProps): React.ReactElement {
  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasLaunched = useRef(false);

  // State
  const [iframeState, setIframeState] = useState<IframeState>({
    height: iframeHeight,
    isLoaded: false,
  });
  const [windowLaunched, setWindowLaunched] = useState(false);

  // Determine message type based on action
  const messageType = useMemo(() => {
    return ACTION_TO_MESSAGE_TYPE[action] || 'basic-lti-launch-request';
  }, [action]) as 'basic-lti-launch-request' | 'LtiSubmissionReviewRequest';

  // Use the LTI launch hook
  const {
    launchTool,
    isLaunching,
    error,
    launchData,
    reset,
  } = useLTILaunch(ltiId);

  /**
   * Handle iframe resize based on viewport changes
   * Implements the resize behavior from view.php lines 197-218
   */
  const handleResize = useCallback(() => {
    if (!iframeRef.current || !containerRef.current) {
      return;
    }

    const iframe = iframeRef.current;
    const iframeRect = iframe.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const newHeight = calculateIframeHeight(iframeRect.top, viewportHeight);

    setIframeState((prev) => ({
      ...prev,
      height: `${newHeight}px`,
    }));
  }, []);

  /**
   * Handle iframe load event
   */
  const handleIframeLoad = useCallback(() => {
    setIframeState((prev) => ({
      ...prev,
      isLoaded: true,
    }));

    // Trigger initial resize after load
    handleResize();
  }, [handleResize]);

  /**
   * Handle window launch callback
   */
  const handleWindowLaunch = useCallback(() => {
    setWindowLaunched(true);
  }, []);

  /**
   * Execute the tool launch
   * Note: We track `hasLaunched` to prevent auto-launch from re-triggering.
   * This flag is only reset by explicit retry action (handleRetry), not on error.
   * This prevents infinite loops when autoLaunch is enabled and errors occur.
   */
  const executeLaunch = useCallback(async () => {
    // Prevent re-launch if we've already attempted (successful or not)
    if (hasLaunched.current) {
      return;
    }

    hasLaunched.current = true;

    try {
      const data = await launchTool({
        launchContainer: container,
        messageType,
        forUserId,
        triggerView,
      });

      onLaunchSuccess?.(data);
    } catch (launchError) {
      // Do NOT reset hasLaunched.current here!
      // The retry should only be triggered via handleRetry, not auto-launch.
      const err = launchError instanceof Error ? launchError : new Error(String(launchError));
      onLaunchError?.(err);
    }
  }, [
    container,
    messageType,
    forUserId,
    triggerView,
    launchTool,
    onLaunchSuccess,
    onLaunchError,
    // Note: removed `error` from dependencies - it was causing infinite re-renders
  ]);

  /**
   * Handle retry after error
   */
  const handleRetry = useCallback(() => {
    reset();
    hasLaunched.current = false;
    void executeLaunch();
  }, [reset, executeLaunch]);

  // Auto-launch on mount if enabled
  useEffect(() => {
    if (autoLaunch && ltiId > 0) {
      void executeLaunch();
    }
  }, [autoLaunch, ltiId, executeLaunch]);

  // Set up resize listener for embed containers
  useEffect(() => {
    if (!isEmbedContainer(container)) {
      return;
    }

    window.addEventListener('resize', handleResize);

    // Initial resize
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [container, handleResize]);

  // Generate iframe name for form submission target
  const iframeName = useMemo(
    () => getIframeName(container, ltiId),
    [container, ltiId]
  );

  // Generate iframe allow attribute for security
  const iframeAllow = useMemo(() => {
    if (launchData?.endpoint) {
      return generateIframeAllowAttribute(launchData.endpoint);
    }
    return '';
  }, [launchData?.endpoint]);

  // Render error state
  if (error && showErrors) {
    return (
      <Box
        ref={containerRef}
        className={className}
        sx={{ width: '100%' }}
      >
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleRetry}
              startIcon={<RefreshIcon />}
            >
              Retry
            </Button>
          }
          sx={{ mb: 2 }}
        >
          <Typography variant="subtitle2" component="div" sx={{ fontWeight: 'medium' }}>
            Failed to launch external tool
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {error.message || 'An unexpected error occurred while launching the tool.'}
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Render loading state
  if (isLaunching && showLoading) {
    return (
      <Box
        ref={containerRef}
        className={className}
        sx={{ width: '100%' }}
      >
        <LoadingState message="Preparing external tool..." />
      </Box>
    );
  }

  // Render window container mode
  if (container === LaunchContainer.WINDOW) {
    // For window mode, the hook handles opening the popup
    // We show a link to re-open if needed
    if (launchData && [launchData.contentUrl, launchData.endpoint].some(Boolean)) {
      return (
        <Box
          ref={containerRef}
          className={className}
          sx={{ width: '100%' }}
        >
          <NewWindowLink
            launchUrl={launchData.contentUrl ?? launchData.endpoint ?? ''}
            ltiId={ltiId}
            title={title}
            onLaunch={handleWindowLaunch}
          />
          {windowLaunched && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
              If the window didn&apos;t open, please check your popup blocker settings.
            </Typography>
          )}
        </Box>
      );
    }

    // Still loading/launching for window mode
    if (showLoading) {
      return (
        <Box
          ref={containerRef}
          className={className}
          sx={{ width: '100%' }}
        >
          <LoadingState message="Opening tool in new window..." />
        </Box>
      );
    }
  }

  // Render replace window mode
  if (container === LaunchContainer.REPLACE_MOODLE_WINDOW) {
    // The hook handles navigation for REPLACE mode
    // Show a message while redirecting
    return (
      <Box
        ref={containerRef}
        className={className}
        sx={{ width: '100%' }}
      >
        <LoadingState message="Redirecting to external tool..." />
      </Box>
    );
  }

  // Render embed container modes (DEFAULT, EMBED, EMBED_NO_BLOCKS)
  return (
    <Box
      ref={containerRef}
      className={className}
      sx={{
        width: '100%',
        position: 'relative',
        // Remove blocks for EMBED_NO_BLOCKS mode - handled by parent layout
      }}
    >
      {/* Loading overlay while iframe is loading */}
      {!iframeState.isLoaded && showLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'background.paper',
            zIndex: 1,
          }}
        >
          <LoadingState message="Loading external tool..." />
        </Box>
      )}

      {/* LTI Iframe */}
      <Box
        component="iframe"
        ref={iframeRef}
        id="contentframe"
        name={iframeName}
        title={title ?? 'LTI External Tool'}
        allow={iframeAllow}
        allowFullScreen
        onLoad={handleIframeLoad}
        sx={{
          width: '100%',
          height: iframeState.height,
          border: 'none',
          display: 'block',
          // Fade in when loaded
          opacity: iframeState.isLoaded ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out',
        }}
      />
    </Box>
  );
}

// ============================================================================
// Export
// ============================================================================

export default LTILauncher;

// Re-export types for convenience
export { LaunchContainer } from '../types/lti.types';
export type { LtiLaunchData } from '../hooks/useLTILaunch';
