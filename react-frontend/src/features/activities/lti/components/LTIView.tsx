/**
 * LTIView - React Component for Displaying LTI External Tool Activity
 *
 * This component displays LTI (Learning Tools Interoperability) external tool
 * activity views with comprehensive tool information, launch options, and
 * container-specific rendering based on LTI launch settings.
 *
 * Features:
 * - Displays LTI activity instance information (name, description, tool config)
 * - Supports multiple launch containers (embed, new window, replace, embed_no_blocks)
 * - Renders launch button or iframe embed based on container settings
 * - Integrates with LTILauncher component for tool launching
 * - Handles error states for missing tool types
 * - Shows title/description based on showtitlelaunch and showdescriptionlaunch settings
 * - Material-UI integration for consistent styling
 * - React Query integration via useLTI hook for data fetching
 * - Completion tracking and view trigger support
 *
 * Based on Moodle's LTI implementation:
 * - public/mod/lti/view.php - View logic and container handling
 * - public/mod/lti/lib.php - Core LTI functions
 * - public/mod/lti/locallib.php - LTI constants and utility functions
 *
 * @module features/activities/lti/components/LTIView
 * @see {@link https://www.imsglobal.org/activity/learning-tools-interoperability|LTI Specification}
 */

import type React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Divider,
  Chip,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  PlayArrow as PlayArrowIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Extension as ExtensionIcon,
} from '@mui/icons-material';

import { LTILauncher } from './LTILauncher';
import { useLTI } from '../hooks/useLTI';
import type { LtiTool } from '../types/lti.types';
import { LaunchContainer } from '../types/lti.types';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Alert } from '@/components/feedback/Alert';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * LTI action type for different launch scenarios
 * Empty string represents standard basic-lti-launch-request
 */
export type LtiViewAction = '' | 'gradeReport' | 'ContentItemSelection';

/**
 * Props interface for the LTIView component
 * Exported as part of the public API
 */
export interface LTIViewProps {
  /**
   * The LTI tool instance ID (course module ID)
   * This corresponds to the 'id' parameter in public/mod/lti/view.php
   */
  ltiId: number;

  /**
   * The course ID this LTI tool belongs to
   * Used for context and navigation
   */
  courseId: number;

  /**
   * Optional user ID to view tool as a specific user
   * Used by teachers/admins to view the tool as a specific student
   * Maps to 'user' parameter in view.php line 57
   */
  forUserId?: number;

  /**
   * Optional action parameter for the view
   * - 'gradeReport': View grade submission review
   * - 'ContentItemSelection': Content item selection mode
   * - '': Standard tool view (default)
   * Based on action parameter handling in view.php line 56
   */
  action?: LtiViewAction;
}

/**
 * Internal state for managing view mode
 */
interface ViewState {
  /** Whether the tool has been launched */
  hasLaunched: boolean;
  /** Whether to show the launch confirmation dialog */
  showLaunchConfirmation: boolean;
  /** Error from launch attempt */
  launchError: Error | null;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default description format (Moodle HTML format)
 */
const DEFAULT_INTRO_FORMAT = 1;

/**
 * Launch container display names for UI
 */
const LAUNCH_CONTAINER_LABELS: Record<LaunchContainer, string> = {
  [LaunchContainer.DEFAULT]: 'Embedded',
  [LaunchContainer.EMBED]: 'Embedded',
  [LaunchContainer.EMBED_NO_BLOCKS]: 'Embedded (Full Width)',
  [LaunchContainer.WINDOW]: 'New Window',
  [LaunchContainer.REPLACE_MOODLE_WINDOW]: 'Replace Window',
};

/**
 * Launch container descriptions for accessibility
 */
const LAUNCH_CONTAINER_DESCRIPTIONS: Record<LaunchContainer, string> = {
  [LaunchContainer.DEFAULT]: 'The external tool will be embedded in this page',
  [LaunchContainer.EMBED]: 'The external tool will be embedded with course navigation',
  [LaunchContainer.EMBED_NO_BLOCKS]: 'The external tool will be embedded without side blocks',
  [LaunchContainer.WINDOW]: 'The external tool will open in a new browser window',
  [LaunchContainer.REPLACE_MOODLE_WINDOW]: 'This window will be replaced by the external tool',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines if the launch container mode requires embedded display
 *
 * @param container - The launch container mode
 * @returns true if the container mode uses iframe embedding
 */
function isEmbeddedContainer(container: LaunchContainer): boolean {
  return (
    container === LaunchContainer.DEFAULT ||
    container === LaunchContainer.EMBED ||
    container === LaunchContainer.EMBED_NO_BLOCKS
  );
}

/**
 * Determines if the launch container opens in a new window
 *
 * @param container - The launch container mode
 * @returns true if the container mode opens a new window
 */
function isWindowContainer(container: LaunchContainer): boolean {
  return container === LaunchContainer.WINDOW;
}

/**
 * Determines if the launch container replaces the current window
 *
 * @param container - The launch container mode
 * @returns true if the container mode replaces the window
 */
function isReplaceContainer(container: LaunchContainer): boolean {
  return container === LaunchContainer.REPLACE_MOODLE_WINDOW;
}

/**
 * Safely parses HTML content for display
 * Strips dangerous tags while preserving formatting
 *
 * @param html - HTML string to parse
 * @returns Sanitized HTML string
 */
function sanitizeHtmlDescription(html: string | undefined): string {
  if (!html) {
    return '';
  }
  // Basic sanitization - in production, use a proper sanitizer like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');
}

/**
 * Gets a human-readable LTI version label
 *
 * @param version - The LTI version string
 * @returns Human-readable version label
 */
function getLtiVersionLabel(version: string | undefined): string {
  if (!version) {
    return 'LTI 1.0';
  }
  switch (version) {
    case 'LTI-1p0':
      return 'LTI 1.0';
    case 'LTI-2p0':
      return 'LTI 2.0';
    case '1.3.0':
      return 'LTI 1.3 (Advantage)';
    default:
      return `LTI ${version}`;
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Component for displaying tool information card
 */
interface ToolInfoCardProps {
  tool: LtiTool;
  ltiVersion: string | undefined;
  isConfigured: boolean;
}

function ToolInfoCard({ tool, ltiVersion, isConfigured }: ToolInfoCardProps): JSX.Element {
  const launchContainer = tool.launchcontainer as LaunchContainer;

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        borderRadius: 2,
        '&:hover': {
          boxShadow: 1,
        },
      }}
    >
      <CardContent>
        {/* Tool Header with Icon */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Box
            sx={{
              bgcolor: 'primary.light',
              color: 'primary.contrastText',
              p: 1.5,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ExtensionIcon fontSize="large" />
          </Box>
          <Box sx={{ flex: 1 }}>
            {/* Show title based on showtitlelaunch setting */}
            {tool.showtitlelaunch === 1 && (
              <Typography variant="h5" component="h1" gutterBottom>
                {tool.name}
              </Typography>
            )}

            {/* Tool metadata chips */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              <Tooltip title={LAUNCH_CONTAINER_DESCRIPTIONS[launchContainer]}>
                <Chip
                  size="small"
                  label={LAUNCH_CONTAINER_LABELS[launchContainer]}
                  color="primary"
                  variant="outlined"
                />
              </Tooltip>
              <Chip
                size="small"
                label={getLtiVersionLabel(ltiVersion)}
                color="secondary"
                variant="outlined"
              />
              {isConfigured ? (
                <Chip size="small" label="Configured" color="success" variant="outlined" />
              ) : (
                <Chip size="small" label="Not Configured" color="warning" variant="outlined" />
              )}
            </Box>
          </Box>
        </Box>

        {/* Show description based on showdescriptionlaunch setting */}
        {tool.showdescriptionlaunch === 1 && tool.intro && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box
              sx={{
                '& p': { mb: 1 },
                '& a': { color: 'primary.main' },
              }}
            >
              <Typography
                variant="body1"
                component="div"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtmlDescription(tool.intro),
                }}
              />
            </Box>
          </>
        )}

        {/* Tool URL info (for debugging/admin view) */}
        {tool.debuglaunch === 1 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Debug Information
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                Tool URL: {tool.toolurl}
              </Typography>
              {tool.typeid && (
                <Typography variant="body2" fontFamily="monospace">
                  Tool Type ID: {tool.typeid}
                </Typography>
              )}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Component for displaying launch actions based on container type
 */
interface LaunchActionsProps {
  tool: LtiTool;
  onLaunch: () => void;
  isLaunching: boolean;
  containerType: LaunchContainer;
}

function LaunchActions({
  tool,
  onLaunch,
  isLaunching,
  containerType,
}: LaunchActionsProps): JSX.Element {
  // For window-based launches, show a launch button
  if (isWindowContainer(containerType)) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          textAlign: 'center',
        }}
      >
        <Typography variant="body1" color="text.secondary" gutterBottom>
          This external tool will open in a new window
        </Typography>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={isLaunching ? undefined : <OpenInNewIcon />}
          onClick={onLaunch}
          disabled={isLaunching}
          sx={{ mt: 2 }}
        >
          {isLaunching ? 'Opening...' : 'Open in New Window'}
        </Button>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
          <InfoIcon fontSize="inherit" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
          If the window doesn&apos;t open, check your browser&apos;s popup blocker settings
        </Typography>
      </Paper>
    );
  }

  // For replace window launches, show a confirmation prompt
  if (isReplaceContainer(containerType)) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          bgcolor: 'warning.light',
          border: '1px solid',
          borderColor: 'warning.main',
          borderRadius: 2,
          textAlign: 'center',
        }}
      >
        <WarningIcon color="warning" sx={{ fontSize: 48, mb: 1 }} />
        <Typography variant="body1" gutterBottom>
          This external tool will replace the current page
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          You will leave Moodle and be redirected to the external tool.
          Use your browser&apos;s back button to return.
        </Typography>
        <Button
          variant="contained"
          color="warning"
          size="large"
          startIcon={isLaunching ? undefined : <PlayArrowIcon />}
          onClick={onLaunch}
          disabled={isLaunching}
          sx={{ mt: 2 }}
        >
          {isLaunching ? 'Launching...' : 'Launch External Tool'}
        </Button>
      </Paper>
    );
  }

  // For embedded containers, no separate action needed - embedding handled by LTILauncher
  return (
    <Box sx={{ textAlign: 'center', py: 2 }}>
      <Typography variant="body2" color="text.secondary">
        The external tool is loading below...
      </Typography>
    </Box>
  );
}

// ============================================================================
// Main Component Implementation
// ============================================================================

/**
 * LTIView Component
 *
 * Main component for displaying LTI external tool activity view.
 * Handles data fetching, launch container determination, and tool launching.
 *
 * @param props - Component props containing ltiId, courseId, forUserId, and action
 * @returns React component displaying the LTI tool view
 *
 * @example
 * ```tsx
 * // Basic usage
 * <LTIView ltiId={123} courseId={456} />
 *
 * // With action and user override
 * <LTIView
 *   ltiId={123}
 *   courseId={456}
 *   forUserId={789}
 *   action="gradeReport"
 * />
 * ```
 */
function LTIView({
  ltiId,
  courseId,
  forUserId,
  action = '',
}: LTIViewProps): JSX.Element {
  // ============ State Management ============
  const [viewState, setViewState] = useState<ViewState>({
    hasLaunched: false,
    showLaunchConfirmation: false,
    launchError: null,
  });

  // ============ Data Fetching ============
  const {
    tool: toolData,
    toolConfig,
    isLoading,
    error,
    hasToolData,
    isReady,
    refetchTool,
  } = useLTI(ltiId, {
    enabled: ltiId > 0,
    fetchGrades: true,
    fetchConfig: true,
    fetchToolTypes: false, // Don't need full types list for view
  });

  // ============ Derived Values ============
  const tool = toolData?.tool;
  const toolType = toolData?.toolType;
  const ltiVersion = toolData?.ltiVersion;
  const isConfigured = toolData?.isConfigured ?? false;
  const canLaunch = toolData?.canLaunch ?? false;

  // Determine launch container from tool settings
  const launchContainer = useMemo<LaunchContainer>(() => {
    if (!tool) {
      return LaunchContainer.DEFAULT;
    }
    return (tool.launchcontainer as LaunchContainer) || LaunchContainer.DEFAULT;
  }, [tool]);

  // Check if this is a missing tool type error (from view.php line 101-105)
  const isMissingToolType = useMemo(() => {
    if (!tool) {
      return false;
    }
    // Tool has typeid but no associated tool type found
    return tool.typeid && tool.typeid > 0 && !toolType;
  }, [tool, toolType]);

  // ============ Event Handlers ============

  /**
   * Handles manual launch trigger for window/replace container modes
   */
  const handleManualLaunch = useCallback(() => {
    setViewState((prev) => ({
      ...prev,
      hasLaunched: true,
      launchError: null,
    }));
  }, []);

  /**
   * Handles launch success callback
   */
  const handleLaunchSuccess = useCallback(() => {
    setViewState((prev) => ({
      ...prev,
      hasLaunched: true,
    }));
  }, []);

  /**
   * Handles launch error callback
   */
  const handleLaunchError = useCallback((launchError: Error) => {
    setViewState((prev) => ({
      ...prev,
      launchError,
    }));
  }, []);

  /**
   * Handles retry after error
   */
  const handleRetry = useCallback(() => {
    setViewState({
      hasLaunched: false,
      showLaunchConfirmation: false,
      launchError: null,
    });
    refetchTool();
  }, [refetchTool]);

  // ============ Effects ============

  /**
   * Auto-launch for embedded containers when data is ready
   */
  useEffect(() => {
    if (hasToolData && isReady && canLaunch && isEmbeddedContainer(launchContainer)) {
      setViewState((prev) => ({
        ...prev,
        hasLaunched: true,
      }));
    }
  }, [hasToolData, isReady, canLaunch, launchContainer]);

  // ============ Render Logic ============

  // Loading state
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 300,
          py: 4,
        }}
      >
        <LoadingSpinner
          size="large"
          message="Loading external tool..."
          ariaLabel="Loading LTI external tool"
        />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ py: 2 }}>
        <Alert
          severity="error"
          title="Error Loading External Tool"
          message={
            <Box>
              <Typography variant="body2" gutterBottom>
                {error.message || 'An error occurred while loading the external tool.'}
              </Typography>
              {error.type === 'PERMISSION_DENIED' && (
                <Typography variant="body2" color="text.secondary">
                  You may not have permission to access this tool. Please contact your instructor.
                </Typography>
              )}
            </Box>
          }
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Retry
            </Button>
          }
        />
      </Box>
    );
  }

  // Missing tool type error (from view.php line 101-105)
  if (isMissingToolType) {
    return (
      <Box sx={{ py: 2 }}>
        <Alert
          severity="error"
          title="Tool Configuration Error"
          message={
            <Box>
              <Typography variant="body2" gutterBottom>
                The external tool type could not be found. This tool may have been deleted or
                is no longer available.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please contact your administrator to resolve this issue.
              </Typography>
            </Box>
          }
        />
      </Box>
    );
  }

  // No tool data loaded
  if (!tool) {
    return (
      <Box sx={{ py: 2 }}>
        <Alert
          severity="warning"
          title="Tool Not Found"
          message="The requested external tool could not be found."
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Retry
            </Button>
          }
        />
      </Box>
    );
  }

  // Cannot launch (permission or configuration issue)
  if (!canLaunch && !isConfigured) {
    return (
      <Box sx={{ py: 2 }}>
        <ToolInfoCard tool={tool} ltiVersion={ltiVersion} isConfigured={isConfigured} />
        <Alert
          severity="warning"
          title="Tool Not Available"
          message={
            <Typography variant="body2">
              This external tool is not properly configured or you don&apos;t have permission
              to launch it. Please contact your instructor or administrator.
            </Typography>
          }
        />
      </Box>
    );
  }

  // Launch error state
  if (viewState.launchError) {
    return (
      <Box sx={{ py: 2 }}>
        <ToolInfoCard tool={tool} ltiVersion={ltiVersion} isConfigured={isConfigured} />
        <Alert
          severity="error"
          title="Launch Failed"
          message={
            <Box>
              <Typography variant="body2" gutterBottom>
                {viewState.launchError.message || 'Failed to launch the external tool.'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please try again or contact your administrator if the problem persists.
              </Typography>
            </Box>
          }
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Try Again
            </Button>
          }
        />
      </Box>
    );
  }

  // ============ Main Render ============

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
      }}
      role="main"
      aria-label={`External tool: ${tool.name}`}
    >
      {/* Tool Information Card */}
      <ToolInfoCard tool={tool} ltiVersion={ltiVersion} isConfigured={isConfigured} />

      {/* Launch Actions for non-embedded containers */}
      {!isEmbeddedContainer(launchContainer) && !viewState.hasLaunched && (
        <LaunchActions
          tool={tool}
          onLaunch={handleManualLaunch}
          isLaunching={false}
          containerType={launchContainer}
        />
      )}

      {/* LTI Launcher Component */}
      {viewState.hasLaunched && (
        <Box
          sx={{
            mt: 2,
            borderRadius: 2,
            overflow: 'hidden',
            border: isEmbeddedContainer(launchContainer) ? '1px solid' : 'none',
            borderColor: 'divider',
          }}
        >
          <LTILauncher
            ltiId={ltiId}
            container={launchContainer}
            action={action}
            forUserId={forUserId}
            onLaunchSuccess={handleLaunchSuccess}
            onLaunchError={handleLaunchError}
            autoLaunch={true}
            iframeHeight={isEmbeddedContainer(launchContainer) ? '600px' : undefined}
            showLoading={true}
            showErrors={true}
            triggerView={true}
          />
        </Box>
      )}

      {/* Window launch link - shown after window launch attempt */}
      {isWindowContainer(launchContainer) && viewState.hasLaunched && (
        <Paper
          elevation={0}
          sx={{
            mt: 2,
            p: 2,
            bgcolor: 'info.light',
            border: '1px solid',
            borderColor: 'info.main',
            borderRadius: 2,
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" gutterBottom>
            The external tool should have opened in a new window.
          </Typography>
          <Button
            variant="outlined"
            color="info"
            size="small"
            startIcon={<OpenInNewIcon />}
            onClick={handleManualLaunch}
            sx={{ mt: 1 }}
          >
            Click here if it didn&apos;t open
          </Button>
        </Paper>
      )}
    </Box>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default LTIView;
