/**
 * useLTILaunch - Custom React Hook for LTI Tool Launch Workflows
 *
 * Manages LTI (Learning Tools Interoperability) external tool launch workflows
 * with automatic OAuth signature generation for LTI 1.1 and OIDC initiation
 * for LTI 1.3. This hook wraps React Query mutations for launching external
 * tools via the API endpoint POST /api/v1/lti/{id}/launch.
 *
 * Features:
 * - Supports LTI 1.0/1.1 with OAuth 1.0a signatures (RFC 5849)
 * - Supports LTI 1.3 OIDC flow with JWT token handling (IMS Security Framework)
 * - Multiple launch container modes (DEFAULT, EMBED, EMBED_NO_BLOCKS, WINDOW, REPLACE_MOODLE_WINDOW)
 * - Message type support (basic-lti-launch-request, ContentItemSelectionRequest, LtiSubmissionReviewRequest)
 * - Optimistic UI updates during launch operations
 * - Comprehensive error handling for LTI-specific failures
 * - React 18 concurrent rendering patterns with useTransition
 *
 * Based on Moodle's LTI implementation:
 * - lti_get_launch_data() from locallib.php line 481
 * - Launch container constants from locallib.php lines 70-74
 * - OAuth signature handling and JWT token validation
 *
 * @module features/activities/lti/hooks/useLTILaunch
 */

import { useCallback, useState, useTransition } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { LaunchContainer } from '../types/lti.types';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * LTI Message Type enum
 * Defines the type of LTI launch message being sent
 * Based on IMS LTI specification
 */
export type LtiMessageType =
  | 'basic-lti-launch-request'
  | 'ContentItemSelectionRequest'
  | 'LtiSubmissionReviewRequest';

/**
 * LTI Launch Error Codes
 * Standardized error codes for LTI launch failures
 */
export enum LtiLaunchErrorCode {
  /** Tool configuration is missing or invalid */
  MISSING_TOOL_CONFIGURATION = 'MISSING_TOOL_CONFIGURATION',
  /** OAuth signature verification failed (LTI 1.1) */
  INVALID_OAUTH_SIGNATURE = 'INVALID_OAUTH_SIGNATURE',
  /** JWT token has expired (LTI 1.3) */
  EXPIRED_JWT_TOKEN = 'EXPIRED_JWT_TOKEN',
  /** Cannot reach the external tool URL */
  UNREACHABLE_TOOL_URL = 'UNREACHABLE_TOOL_URL',
  /** CORS policy blocked the request */
  CORS_ERROR = 'CORS_ERROR',
  /** User does not have permission to launch this tool */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  /** Tool type is not found in the system */
  TOOL_TYPE_NOT_FOUND = 'TOOL_TYPE_NOT_FOUND',
  /** LTI 1.3 OIDC initiation failed */
  OIDC_INITIATION_FAILED = 'OIDC_INITIATION_FAILED',
  /** General launch failure */
  LAUNCH_FAILED = 'LAUNCH_FAILED',
  /** Network error during launch */
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * LTI Launch Error
 * Custom error class for LTI launch failures with structured error information
 */
export class LtiLaunchError extends Error {
  public readonly code: LtiLaunchErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: LtiLaunchErrorCode,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'LtiLaunchError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, LtiLaunchError.prototype);
  }
}

/**
 * Launch options that can be configured when initiating a tool launch
 */
export interface LtiLaunchRequestOptions {
  /** Preferred launch container mode (how to display the tool) */
  launchContainer?: LaunchContainer;
  /** LTI message type for the launch */
  messageType?: LtiMessageType;
  /** User ID to launch on behalf of (admin/teacher use case) */
  forUserId?: number;
  /** Additional custom parameters to pass to the tool */
  customParams?: Record<string, string>;
  /** Target link URI for deep linking scenarios */
  targetLinkUri?: string;
  /** Whether to trigger view completion tracking */
  triggerView?: boolean;
}

/**
 * OAuth 1.0a parameters for LTI 1.1 launches
 * Following RFC 5849 specification
 */
export interface OAuthParameters {
  /** OAuth consumer key */
  oauth_consumer_key: string;
  /** OAuth signature method (typically HMAC-SHA1) */
  oauth_signature_method: string;
  /** OAuth timestamp (Unix epoch seconds) */
  oauth_timestamp: string;
  /** OAuth nonce (unique random string) */
  oauth_nonce: string;
  /** OAuth version (1.0) */
  oauth_version: string;
  /** OAuth signature (base64 encoded) */
  oauth_signature: string;
}

/**
 * LTI 1.3 OIDC parameters for initiating login
 * Following IMS Security Framework
 */
export interface OidcParameters {
  /** Client ID from tool configuration */
  client_id: string;
  /** Login hint for user identification */
  login_hint: string;
  /** LTI message hint for session context */
  lti_message_hint: string;
  /** Target link URI */
  target_link_uri: string;
  /** Redirect URI for auth response */
  redirect_uri: string;
  /** State parameter for CSRF protection */
  state: string;
  /** Nonce for replay protection */
  nonce: string;
}

/**
 * Launch parameter - key/value pair for form submission
 */
export interface LaunchParameter {
  /** Parameter name */
  name: string;
  /** Parameter value */
  value: string;
}

/**
 * Complete launch data returned from the API
 * Contains all information needed to execute the tool launch
 */
export interface LtiLaunchData {
  /** Launch endpoint URL (tool's launch URL) */
  endpoint: string;
  /** All launch parameters including LTI params and OAuth/JWT signature */
  parameters: LaunchParameter[];
  /** Launch container mode to use */
  launchContainer: LaunchContainer;
  /** LTI version being used */
  ltiVersion: string;
  /** Whether this launch requires OIDC flow (LTI 1.3) */
  requiresOidc: boolean;
  /** OAuth signature for LTI 1.0/1.1 launches */
  oauthSignature?: string;
  /** OAuth parameters for LTI 1.0/1.1 launches */
  oauthParams?: Partial<OAuthParameters>;
  /** OIDC redirect URL for LTI 1.3 launches */
  oidcRedirectUrl?: string;
  /** Login hint for LTI 1.3 OIDC */
  loginHint?: string;
  /** Content URL for iframe embedding */
  contentUrl?: string;
  /** Window title for popup launches */
  windowTitle?: string;
  /** Window features string for popup configuration */
  windowFeatures?: string;
  /** User context information */
  userContext?: {
    userId: number;
    userName?: string;
    userEmail?: string;
    roles: string[];
  };
  /** Course context information */
  courseContext?: {
    courseId: number;
    courseName?: string;
    courseLabel?: string;
  };
  /** Resource link information */
  resourceLink?: {
    id: string;
    title?: string;
    description?: string;
  };
}

/**
 * Launch request sent to the API
 */
interface LtiLaunchApiRequest {
  /** LTI tool instance ID */
  ltiId: number;
  /** Message type for the launch */
  messageType?: LtiMessageType;
  /** User ID to launch for (optional, for admin/teacher use) */
  forUserId?: number;
  /** Launch container preference */
  launchContainer?: LaunchContainer;
  /** Custom parameters */
  customParams?: Record<string, string>;
  /** Target link URI */
  targetLinkUri?: string;
  /** Trigger view completion */
  triggerView?: boolean;
}

/**
 * API response envelope for launch data
 */
interface ApiLaunchResponse {
  success: boolean;
  data: LtiLaunchData;
  meta?: {
    timestamp: number;
    processingTime: number;
  };
}

/**
 * State returned by the useLTILaunch hook
 */
export interface UseLTILaunchState {
  /** Whether a launch operation is in progress */
  isLaunching: boolean;
  /** Whether a transition is pending (React 18 concurrent) */
  isPending: boolean;
  /** The most recent launch data */
  launchData: LtiLaunchData | null;
  /** Error from the last launch attempt */
  error: LtiLaunchError | Error | null;
  /** The launch container being used */
  activeContainer: LaunchContainer | null;
}

/**
 * Actions returned by the useLTILaunch hook
 */
export interface UseLTILaunchActions {
  /** Initiate a tool launch */
  launchTool: (options?: LtiLaunchRequestOptions) => Promise<LtiLaunchData>;
  /** Reset the launch state */
  reset: () => void;
  /** Execute the launch with existing launch data */
  executeLaunch: (launchData: LtiLaunchData) => void;
}

/**
 * Complete return type for useLTILaunch hook
 */
export interface UseLTILaunchResult extends UseLTILaunchState, UseLTILaunchActions {
  /** The underlying mutation object for advanced use cases */
  mutation: UseMutationResult<LtiLaunchData, Error, LtiLaunchApiRequest, unknown>;
}

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query keys for LTI launch-related cache operations
 */
const LTI_LAUNCH_KEYS = {
  all: ['lti', 'launch'] as const,
  tool: (ltiId: number) => ['lti', 'launch', ltiId] as const,
} as const;

// ============================================================================
// API Functions
// ============================================================================

/**
 * Calls the LTI launch API endpoint to generate launch data
 *
 * This function wraps the POST /api/v1/lti/{id}/launch endpoint which
 * internally calls Moodle's lti_get_launch_data() function.
 *
 * @param request - Launch request parameters
 * @returns Promise resolving to launch data
 * @throws LtiLaunchError on failure
 */
async function fetchLaunchData(request: LtiLaunchApiRequest): Promise<LtiLaunchData> {
  const { ltiId, ...options } = request;

  try {
    const response = await apiClient.post<ApiLaunchResponse>(
      `/lti/${ltiId}/launch`,
      {
        message_type: options.messageType ?? 'basic-lti-launch-request',
        for_user_id: options.forUserId,
        launch_container: options.launchContainer,
        custom_params: options.customParams,
        target_link_uri: options.targetLinkUri,
        trigger_view: options.triggerView ?? true,
      }
    );

    if (!response.data.success) {
      throw new LtiLaunchError(
        'Launch data request failed',
        LtiLaunchErrorCode.LAUNCH_FAILED
      );
    }

    return response.data.data;
  } catch (error: unknown) {
    // Handle specific error types
    if (error instanceof LtiLaunchError) {
      throw error;
    }

    // Handle Axios/API errors
    if (isAxiosError(error)) {
      const status = error.response?.status;
      const errorData = error.response?.data as { error?: { code?: string; message?: string } } | undefined;
      const errorCode = errorData?.error?.code;
      const errorMessage = errorData?.error?.message ?? error.message;

      // Map HTTP status codes to LTI error codes
      switch (status) {
        case 403:
          throw new LtiLaunchError(
            errorMessage || 'Permission denied to launch this tool',
            LtiLaunchErrorCode.PERMISSION_DENIED,
            { status, originalError: errorCode }
          );
        case 404:
          throw new LtiLaunchError(
            errorMessage || 'Tool or tool type not found',
            LtiLaunchErrorCode.TOOL_TYPE_NOT_FOUND,
            { status, ltiId }
          );
        case 400:
          if (errorCode === 'invalid_oauth_signature') {
            throw new LtiLaunchError(
              errorMessage || 'Invalid OAuth signature',
              LtiLaunchErrorCode.INVALID_OAUTH_SIGNATURE
            );
          }
          if (errorCode === 'expired_jwt') {
            throw new LtiLaunchError(
              errorMessage || 'JWT token has expired',
              LtiLaunchErrorCode.EXPIRED_JWT_TOKEN
            );
          }
          throw new LtiLaunchError(
            errorMessage || 'Invalid launch request',
            LtiLaunchErrorCode.MISSING_TOOL_CONFIGURATION,
            { status, originalError: errorCode }
          );
        case 502:
        case 503:
        case 504:
          throw new LtiLaunchError(
            errorMessage || 'External tool is unreachable',
            LtiLaunchErrorCode.UNREACHABLE_TOOL_URL,
            { status }
          );
        default:
          if (error.message?.toLowerCase().includes('cors')) {
            throw new LtiLaunchError(
              'CORS policy blocked the launch request',
              LtiLaunchErrorCode.CORS_ERROR
            );
          }
          throw new LtiLaunchError(
            errorMessage || 'Failed to launch LTI tool',
            LtiLaunchErrorCode.LAUNCH_FAILED,
            { status, originalError: errorCode }
          );
      }
    }

    // Handle network errors
    if (error instanceof Error && error.message.includes('Network Error')) {
      throw new LtiLaunchError(
        'Network error while launching tool',
        LtiLaunchErrorCode.NETWORK_ERROR,
        { originalError: error.message }
      );
    }

    // Re-throw unknown errors wrapped in LtiLaunchError
    throw new LtiLaunchError(
      error instanceof Error ? error.message : 'Unknown launch error',
      LtiLaunchErrorCode.LAUNCH_FAILED
    );
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for Axios errors
 */
function isAxiosError(error: unknown): error is {
  response?: {
    status: number;
    data?: unknown;
  };
  message: string;
  isAxiosError: boolean;
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as { isAxiosError: boolean }).isAxiosError === true
  );
}

// ============================================================================
// Launch Execution Utilities
// ============================================================================

/**
 * Create and submit an HTML form for LTI launch
 *
 * This is the standard method for launching LTI 1.0/1.1 tools.
 * Creates a hidden form with all launch parameters and submits it.
 *
 * @param launchData - The launch data containing endpoint and parameters
 * @param target - Target window/frame name
 */
function submitLaunchForm(launchData: LtiLaunchData, target: string): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = launchData.endpoint;
  form.target = target;
  form.style.display = 'none';

  // Add all launch parameters as hidden inputs
  launchData.parameters.forEach(({ name, value }) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  // Append, submit, and clean up
  document.body.appendChild(form);
  form.submit();

  // Remove form after a short delay to ensure submission completes
  setTimeout(() => {
    if (form.parentNode) {
      form.parentNode.removeChild(form);
    }
  }, 100);
}

/**
 * Determine the appropriate launch target based on container mode
 *
 * @param launchContainer - Launch container mode
 * @param ltiId - LTI tool instance ID (used for unique iframe names)
 * @returns Target string for form submission
 */
function getLaunchTarget(launchContainer: LaunchContainer, ltiId: number): string {
  switch (launchContainer) {
    case LaunchContainer.DEFAULT:
      return `lti-frame-${ltiId}`;
    case LaunchContainer.EMBED:
      return `lti-embed-${ltiId}`;
    case LaunchContainer.EMBED_NO_BLOCKS:
      return `lti-embed-noblocks-${ltiId}`;
    case LaunchContainer.WINDOW:
      return '_blank';
    case LaunchContainer.REPLACE_MOODLE_WINDOW:
      return '_self';
    default:
      return `lti-frame-${ltiId}`;
  }
}

/**
 * Get window features for popup launches
 *
 * @param launchData - Launch data that may contain window feature preferences
 * @returns Window features string or undefined
 */
function getWindowFeatures(launchData: LtiLaunchData): string | undefined {
  if (launchData.launchContainer !== LaunchContainer.WINDOW) {
    return undefined;
  }

  return (
    launchData.windowFeatures ??
    'width=1024,height=768,resizable=yes,scrollbars=yes,status=yes,toolbar=no,menubar=no,location=no'
  );
}

/**
 * Execute the tool launch based on launch data
 *
 * Handles different launch modes:
 * - LTI 1.3: Redirects to OIDC authentication URL
 * - LTI 1.0/1.1 WINDOW: Opens popup and submits form
 * - LTI 1.0/1.1 EMBED: Creates iframe and submits form to it
 * - LTI 1.0/1.1 REPLACE: Submits form to _self
 *
 * @param launchData - Complete launch data from API
 * @param ltiId - LTI tool instance ID
 */
function executeLaunchAction(launchData: LtiLaunchData, ltiId: number): void {
  // Handle LTI 1.3 OIDC flow - redirect to auth URL
  if (launchData.requiresOidc && launchData.oidcRedirectUrl) {
    window.location.href = launchData.oidcRedirectUrl;
    return;
  }

  // Determine launch target based on container mode
  const target = getLaunchTarget(launchData.launchContainer, ltiId);

  // Handle popup window launch
  if (launchData.launchContainer === LaunchContainer.WINDOW) {
    const windowFeatures = getWindowFeatures(launchData);
    const windowTitle = launchData.windowTitle ?? 'LTI Tool';

    // Open popup window first
    const popup = window.open('about:blank', target, windowFeatures);
    if (popup) {
      popup.document.title = windowTitle;
    }
  }

  // Submit the launch form with all parameters
  submitLaunchForm(launchData, target);
}

// ============================================================================
// Main Hook Implementation
// ============================================================================

/**
 * Custom React hook for managing LTI external tool launch workflows
 *
 * Provides a comprehensive interface for launching LTI tools with support for:
 * - LTI 1.0/1.1 OAuth 1.0a signature generation
 * - LTI 1.3 OIDC/JWT authentication flows
 * - Multiple launch container modes
 * - Various LTI message types
 * - Optimistic UI updates during launch operations
 * - React 18 concurrent rendering with transitions
 *
 * @param ltiId - The LTI tool instance ID to launch
 * @returns Hook result containing state, actions, and mutation object
 *
 * @example Basic launch
 * ```tsx
 * function LtiToolLauncher({ toolId }: { toolId: number }) {
 *   const { launchTool, isLaunching, error } = useLTILaunch(toolId);
 *
 *   const handleLaunch = async () => {
 *     try {
 *       await launchTool();
 *     } catch (err) {
 *       console.error('Launch failed:', err);
 *     }
 *   };
 *
 *   return (
 *     <Button onClick={handleLaunch} disabled={isLaunching}>
 *       {isLaunching ? 'Launching...' : 'Launch Tool'}
 *     </Button>
 *   );
 * }
 * ```
 *
 * @example Launch with options
 * ```tsx
 * function LtiToolWithOptions({ toolId, studentId }: Props) {
 *   const { launchTool, isLaunching } = useLTILaunch(toolId);
 *
 *   const handleLaunchForStudent = async () => {
 *     await launchTool({
 *       launchContainer: LaunchContainer.WINDOW,
 *       forUserId: studentId,
 *       messageType: 'LtiSubmissionReviewRequest',
 *     });
 *   };
 *
 *   return <Button onClick={handleLaunchForStudent}>Review Submission</Button>;
 * }
 * ```
 *
 * @example Handling different launch containers
 * ```tsx
 * function LtiEmbeddedTool({ toolId }: { toolId: number }) {
 *   const iframeRef = useRef<HTMLIFrameElement>(null);
 *   const { launchTool, launchData, isLaunching } = useLTILaunch(toolId);
 *
 *   useEffect(() => {
 *     launchTool({ launchContainer: LaunchContainer.EMBED });
 *   }, [launchTool]);
 *
 *   return (
 *     <div>
 *       {isLaunching && <LoadingSpinner />}
 *       <iframe
 *         ref={iframeRef}
 *         name={`lti-embed-${toolId}`}
 *         title="LTI Tool"
 *         style={{ width: '100%', height: '600px' }}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useLTILaunch(ltiId: number): UseLTILaunchResult {
  // Query client for cache operations
  const queryClient = useQueryClient();

  // React 18 transition for non-urgent state updates
  const [isPending, startTransition] = useTransition();

  // Local state for launch data and active container
  const [launchData, setLaunchData] = useState<LtiLaunchData | null>(null);
  const [activeContainer, setActiveContainer] = useState<LaunchContainer | null>(null);

  // Mutation for fetching launch data and executing launch
  const mutation = useMutation<LtiLaunchData, Error, LtiLaunchApiRequest>({
    mutationFn: fetchLaunchData,

    // Optimistic update: Show loading state immediately
    onMutate: async (variables) => {
      // Cancel any outgoing refetches for this tool
      await queryClient.cancelQueries({
        queryKey: LTI_LAUNCH_KEYS.tool(variables.ltiId),
      });

      // Update active container state using transition
      startTransition(() => {
        setActiveContainer(variables.launchContainer ?? LaunchContainer.DEFAULT);
      });

      return {};
    },

    onSuccess: (data, variables) => {
      // Store launch data in state
      startTransition(() => {
        setLaunchData(data);
      });

      // Execute the actual launch
      executeLaunchAction(data, variables.ltiId);

      // Invalidate related queries to ensure fresh data
      void queryClient.invalidateQueries({
        queryKey: LTI_LAUNCH_KEYS.tool(variables.ltiId),
      });
    },

    onError: () => {
      // Reset container on error
      startTransition(() => {
        setActiveContainer(null);
      });
    },

    // Configure retry behavior
    retry: (failureCount, error) => {
      // Don't retry for permission or configuration errors
      if (error instanceof LtiLaunchError) {
        const nonRetryableCodes = [
          LtiLaunchErrorCode.PERMISSION_DENIED,
          LtiLaunchErrorCode.MISSING_TOOL_CONFIGURATION,
          LtiLaunchErrorCode.TOOL_TYPE_NOT_FOUND,
          LtiLaunchErrorCode.INVALID_OAUTH_SIGNATURE,
        ];
        if (nonRetryableCodes.includes(error.code)) {
          return false;
        }
      }
      // Retry network errors up to 2 times
      return failureCount < 2;
    },

    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  /**
   * Launch the LTI tool with optional configuration
   *
   * @param options - Optional launch configuration
   * @returns Promise resolving to launch data
   */
  const launchTool = useCallback(
    async (options?: LtiLaunchRequestOptions): Promise<LtiLaunchData> => {
      if (ltiId <= 0) {
        throw new LtiLaunchError(
          'Invalid LTI tool ID',
          LtiLaunchErrorCode.MISSING_TOOL_CONFIGURATION,
          { ltiId }
        );
      }

      const request: LtiLaunchApiRequest = {
        ltiId,
        messageType: options?.messageType ?? 'basic-lti-launch-request',
        forUserId: options?.forUserId,
        launchContainer: options?.launchContainer,
        customParams: options?.customParams,
        targetLinkUri: options?.targetLinkUri,
        triggerView: options?.triggerView,
      };

      return mutation.mutateAsync(request);
    },
    [ltiId, mutation]
  );

  /**
   * Reset the launch state to initial values
   */
  const reset = useCallback(() => {
    mutation.reset();
    startTransition(() => {
      setLaunchData(null);
      setActiveContainer(null);
    });
  }, [mutation]);

  /**
   * Execute launch with existing launch data
   * Useful when launch data was obtained separately
   *
   * @param data - Pre-fetched launch data
   */
  const executeLaunch = useCallback(
    (data: LtiLaunchData) => {
      startTransition(() => {
        setLaunchData(data);
        setActiveContainer(data.launchContainer);
      });
      executeLaunchAction(data, ltiId);
    },
    [ltiId]
  );

  // Map mutation error to LtiLaunchError if needed
  const error: LtiLaunchError | Error | null = mutation.error ?? null;

  return {
    // State
    isLaunching: mutation.isPending,
    isPending,
    launchData,
    error,
    activeContainer,

    // Actions
    launchTool,
    reset,
    executeLaunch,

    // Raw mutation for advanced use cases
    mutation,
  };
}

// ============================================================================
// Type Re-exports
// ============================================================================

export { LaunchContainer };
