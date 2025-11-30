/**
 * LTI (Learning Tools Interoperability) API Client
 *
 * React Query hooks and API functions for LTI external tool operations.
 * Integrates with REST API endpoints at /api/v1/lti/ that wrap Moodle's
 * core LTI functions including lti_get_launch_data, lti_initiate_login,
 * lti_launch_tool, lti_get_tool_by_url_match, and lti_get_type_config.
 *
 * Supports:
 * - LTI 1.0/1.1 with OAuth 1.0a signatures
 * - LTI 1.3 with OIDC/JWT authentication
 * - Grade passback from external tools
 * - Multiple launch container modes (embed, window, replace)
 *
 * @module features/activities/lti/api/ltiApi
 */

import type { UseQueryResult, UseMutationResult, QueryKey } from '@tanstack/react-query';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import type { ApiResponse } from '@/types/api';
import type {
  LtiTool,
  LtiToolType,
  LtiGradeResult,
} from '../types/lti.types';
import {
  LaunchContainer} from '../types/lti.types';
import type {
  LtiVersion,
  LtiToolState
} from '../types/lti.types';

// ============================================================================
// API Endpoint Constants
// ============================================================================

/**
 * LTI API endpoint URL builder functions
 * Following the pattern from quiz API endpoints
 */
const LTI_ENDPOINTS = {
  /** GET /api/v1/lti/{id} - Get LTI tool details */
  DETAIL: (id: number): string => `/lti/${id}`,

  /** POST /api/v1/lti/{id}/launch - Generate launch parameters */
  LAUNCH: (id: number): string => `/lti/${id}/launch`,

  /** GET /api/v1/lti/{id}/config - Get tool configuration */
  CONFIG: (id: number): string => `/lti/${id}/config`,

  /** GET /api/v1/lti/types - List available tool types */
  TYPES: '/lti/types',

  /** GET /api/v1/lti/types/{id} - Get specific tool type */
  TYPE_DETAIL: (id: number): string => `/lti/types/${id}`,

  /** GET /api/v1/lti/types/{id}/config - Get tool type configuration */
  TYPE_CONFIG: (id: number): string => `/lti/types/${id}/config`,

  /** GET /api/v1/lti/{id}/grades - Get grade passback results */
  GRADES: (id: number): string => `/lti/${id}/grades`,

  /** POST /api/v1/lti/{id}/grades - Submit grade passback */
  GRADE_PASSBACK: (id: number): string => `/lti/${id}/grades`,

  /** POST /api/v1/lti/{id}/initiate-login - LTI 1.3 OIDC initiate login */
  INITIATE_LOGIN: (id: number): string => `/lti/${id}/initiate-login`,

  /** GET /api/v1/lti/{id}/content-item - Content item selection */
  CONTENT_ITEM: (id: number): string => `/lti/${id}/content-item`,

  /** GET /api/v1/lti/proxies - List LTI 2.0 tool proxies */
  PROXIES: '/lti/proxies',

  /** GET /api/v1/lti/proxies/{id} - Get specific tool proxy */
  PROXY_DETAIL: (id: number): string => `/lti/proxies/${id}`,
} as const;

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for LTI-related queries
 * Ensures consistent cache key structure across all LTI queries
 */
export const ltiQueryKeys = {
  /** Base key for all LTI queries */
  all: ['lti'] as const,

  /** Tool instance queries */
  tools: () => [...ltiQueryKeys.all, 'tools'] as const,
  tool: (id: number) => [...ltiQueryKeys.tools(), id] as const,
  toolConfig: (id: number) => [...ltiQueryKeys.tool(id), 'config'] as const,
  toolGrades: (id: number) => [...ltiQueryKeys.tool(id), 'grades'] as const,
  toolLaunch: (id: number) => [...ltiQueryKeys.tool(id), 'launch'] as const,

  /** Tool type queries */
  types: () => [...ltiQueryKeys.all, 'types'] as const,
  type: (id: number) => [...ltiQueryKeys.types(), id] as const,
  typeConfig: (id: number) => [...ltiQueryKeys.type(id), 'config'] as const,

  /** Tool proxy queries (LTI 2.0) */
  proxies: () => [...ltiQueryKeys.all, 'proxies'] as const,
  proxy: (id: number) => [...ltiQueryKeys.proxies(), id] as const,
} as const;

// ============================================================================
// Types - API Request/Response Interfaces
// ============================================================================

/**
 * LTI tool details response with additional metadata
 */
export interface LtiToolDetailResponse {
  /** The LTI tool instance */
  tool: LtiTool;
  /** Associated tool type (if using preconfigured type) */
  toolType: LtiToolType | null;
  /** Whether the current user can launch the tool */
  canLaunch: boolean;
  /** Whether the tool is configured and ready */
  isConfigured: boolean;
  /** LTI version being used */
  ltiVersion: LtiVersion | string;
  /** Course module ID */
  cmid: number;
  /** Course ID */
  courseId: number;
}

/**
 * LTI launch data response including all parameters needed for launch
 */
export interface LtiLaunchDataResponse {
  /** Launch endpoint URL */
  endpoint: string;
  /** Launch parameters as key-value pairs */
  parameters: Array<{ name: string; value: string }>;
  /** Launch container mode */
  launchContainer: LaunchContainer;
  /** LTI version */
  ltiVersion: LtiVersion | string;
  /** Whether this is an LTI 1.3 launch requiring OIDC flow */
  requiresOidc: boolean;
  /** OIDC login hint (for LTI 1.3) */
  loginHint?: string;
  /** OIDC redirect URL (for LTI 1.3) */
  oidcRedirectUrl?: string;
  /** OAuth signature (for LTI 1.0/1.1) */
  oauthSignature?: string;
  /** Content URL for iframe embedding */
  contentUrl?: string;
  /** Window title for new window launches */
  windowTitle?: string;
  /** Window features for new window launches */
  windowFeatures?: string;
}

/**
 * LTI tool configuration response
 */
export interface LtiToolConfigResponse {
  /** Configuration key-value pairs */
  config: Record<string, string>;
  /** Tool privacy settings */
  privacy: {
    sendName: boolean;
    sendEmail: boolean;
    acceptGrades: boolean;
  };
  /** Custom parameters */
  customParams: string[];
  /** Resource link ID */
  resourceLinkId: string;
  /** Service endpoints for tool communication */
  services: {
    outcomesUrl?: string;
    membershipsUrl?: string;
    settingsUrl?: string;
  };
}

/**
 * LTI tool types list response with filtering
 */
export interface LtiToolTypesResponse {
  /** List of available tool types */
  types: LtiToolType[];
  /** Total count before pagination */
  total: number;
  /** Applied filters */
  filters: {
    state?: LtiToolState;
    courseId?: number;
    includeGlobal?: boolean;
  };
}

/**
 * LTI grade passback request
 */
export interface LtiGradePassbackRequest {
  /** User ID to grade */
  userId: number;
  /** Grade as percentage (0-100) */
  grade: number;
  /** Optional activity result data */
  activityProgress?: 'Initialized' | 'Started' | 'InProgress' | 'Submitted' | 'Completed';
  /** Optional grading progress */
  gradingProgress?: 'FullyGraded' | 'Pending' | 'PendingManual' | 'Failed' | 'NotReady';
  /** Optional comment/feedback */
  comment?: string;
  /** Optional timestamp for submission */
  timestamp?: number;
}

/**
 * LTI grade passback response
 */
export interface LtiGradePassbackResponse {
  /** Whether the operation was successful */
  success: boolean;
  /** Message from the grade service */
  message: string;
  /** The updated grade result */
  gradeResult: LtiGradeResult;
}

/**
 * LTI grades list response
 */
export interface LtiGradesResponse {
  /** List of grade results */
  grades: LtiGradeResult[];
  /** Total submissions count */
  total: number;
  /** Grade item ID in gradebook */
  gradeItemId: number;
  /** Maximum grade value */
  maxGrade: number;
}

/**
 * LTI 1.3 OIDC initiate login request
 */
export interface LtiOidcLoginRequest {
  /** Target link URI */
  targetLinkUri?: string;
  /** LTI message hint */
  ltiMessageHint?: string;
  /** Client ID */
  clientId?: string;
}

/**
 * LTI 1.3 OIDC initiate login response
 */
export interface LtiOidcLoginResponse {
  /** OIDC authentication request URL */
  authRequestUrl: string;
  /** State parameter for CSRF protection */
  state: string;
  /** Nonce for replay protection */
  nonce: string;
  /** Login hint */
  loginHint: string;
  /** LTI message hint */
  ltiMessageHint: string;
}

/**
 * Filter options for tool types query
 */
export interface LtiToolTypesFilterOptions {
  /** Filter by state */
  state?: LtiToolState;
  /** Filter by course ID (0 for site-wide only) */
  courseId?: number;
  /** Include global/site-wide tool types */
  includeGlobal?: boolean;
  /** Search term for tool name */
  search?: string;
}

/**
 * Options for launch data request
 */
export interface LtiLaunchOptions {
  /** Preferred launch container mode */
  launchContainer?: LaunchContainer;
  /** Force a specific LTI version */
  forceVersion?: LtiVersion;
  /** Additional custom parameters */
  customParams?: Record<string, string>;
  /** Target link URI for deep linking */
  targetLinkUri?: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch LTI tool details and associated metadata
 *
 * Calls GET /api/v1/lti/{id} which wraps existing Moodle lti_get_lti_instance()
 * and retrieves tool type configuration.
 *
 * @param id - LTI tool instance ID
 * @returns Tool details with metadata
 */
export async function fetchLtiTool(id: number): Promise<LtiToolDetailResponse> {
  const response = await apiClient.get<ApiResponse<LtiToolDetailResponse>>(
    LTI_ENDPOINTS.DETAIL(id)
  );

  return response.data.data;
}

/**
 * Fetch launch data for an LTI tool
 *
 * Calls POST /api/v1/lti/{id}/launch which wraps existing Moodle
 * lti_get_launch_data() function and generates OAuth signatures or
 * prepares OIDC flow for LTI 1.3.
 *
 * @param id - LTI tool instance ID
 * @param options - Optional launch configuration
 * @returns Launch data with endpoint and parameters
 */
export async function fetchLtiLaunchData(
  id: number,
  options?: LtiLaunchOptions
): Promise<LtiLaunchDataResponse> {
  const response = await apiClient.post<ApiResponse<LtiLaunchDataResponse>>(
    LTI_ENDPOINTS.LAUNCH(id),
    options ?? {}
  );

  return response.data.data;
}

/**
 * Fetch LTI tool configuration
 *
 * Calls GET /api/v1/lti/{id}/config which wraps existing Moodle
 * lti_get_type_config() and lti_get_type_type_config() functions.
 *
 * @param id - LTI tool instance ID
 * @returns Tool configuration
 */
export async function fetchLtiToolConfig(id: number): Promise<LtiToolConfigResponse> {
  const response = await apiClient.get<ApiResponse<LtiToolConfigResponse>>(
    LTI_ENDPOINTS.CONFIG(id)
  );

  return response.data.data;
}

/**
 * Fetch available LTI tool types
 *
 * Calls GET /api/v1/lti/types which retrieves all configured tool types
 * available for the current user and context.
 *
 * @param filters - Optional filtering options
 * @returns List of tool types
 */
export async function fetchLtiToolTypes(
  filters?: LtiToolTypesFilterOptions
): Promise<LtiToolTypesResponse> {
  const params = new URLSearchParams();

  if (filters?.state !== undefined) {
    params.append('state', String(filters.state));
  }
  if (filters?.courseId !== undefined) {
    params.append('courseId', String(filters.courseId));
  }
  if (filters?.includeGlobal !== undefined) {
    params.append('includeGlobal', String(filters.includeGlobal));
  }
  if (filters?.search) {
    params.append('search', filters.search);
  }

  const queryString = params.toString();
  const url = queryString ? `${LTI_ENDPOINTS.TYPES}?${queryString}` : LTI_ENDPOINTS.TYPES;

  const response = await apiClient.get<ApiResponse<LtiToolTypesResponse>>(url);

  return response.data.data;
}

/**
 * Fetch LTI tool type configuration
 *
 * Calls GET /api/v1/lti/types/{id}/config which retrieves the configuration
 * for a specific tool type.
 *
 * @param typeId - Tool type ID
 * @returns Tool type configuration
 */
export async function fetchLtiTypeConfig(typeId: number): Promise<Record<string, string>> {
  const response = await apiClient.get<ApiResponse<Record<string, string>>>(
    LTI_ENDPOINTS.TYPE_CONFIG(typeId)
  );

  return response.data.data;
}

/**
 * Fetch grades/submissions for an LTI tool
 *
 * Calls GET /api/v1/lti/{id}/grades which retrieves all grade passback
 * results from the external tool.
 *
 * @param id - LTI tool instance ID
 * @returns List of grade results
 */
export async function fetchLtiGrades(id: number): Promise<LtiGradesResponse> {
  const response = await apiClient.get<ApiResponse<LtiGradesResponse>>(
    LTI_ENDPOINTS.GRADES(id)
  );

  return response.data.data;
}

/**
 * Submit grade passback to update a user's grade
 *
 * Calls POST /api/v1/lti/{id}/grades which wraps existing Moodle
 * grade passback service to update grades in the gradebook.
 *
 * @param ltiId - LTI tool instance ID
 * @param request - Grade passback request data
 * @returns Passback result
 */
export async function submitLtiGradePassback(
  ltiId: number,
  request: LtiGradePassbackRequest
): Promise<LtiGradePassbackResponse> {
  const response = await apiClient.post<ApiResponse<LtiGradePassbackResponse>>(
    LTI_ENDPOINTS.GRADE_PASSBACK(ltiId),
    request
  );

  return response.data.data;
}

/**
 * Initiate LTI 1.3 OIDC login flow
 *
 * Calls POST /api/v1/lti/{id}/initiate-login which wraps existing Moodle
 * lti_initiate_login() function to start the OIDC authentication flow.
 *
 * @param id - LTI tool instance ID
 * @param request - Optional login request parameters
 * @returns OIDC login response with auth URL
 */
export async function initiateLtiOidcLogin(
  id: number,
  request?: LtiOidcLoginRequest
): Promise<LtiOidcLoginResponse> {
  const response = await apiClient.post<ApiResponse<LtiOidcLoginResponse>>(
    LTI_ENDPOINTS.INITIATE_LOGIN(id),
    request ?? {}
  );

  return response.data.data;
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch LTI tool details with React Query
 *
 * Provides automatic caching, background refetching, and error handling
 * for LTI tool data.
 *
 * @param ltiId - LTI tool instance ID
 * @param enabled - Whether query should run automatically (default: true)
 * @returns Query result with tool details
 *
 * @example
 * ```tsx
 * function LtiToolView({ toolId }: { toolId: number }) {
 *   const { data, isLoading, error } = useLtiTool(toolId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return <div>{data.tool.name}</div>;
 * }
 * ```
 */
export function useLtiTool(
  ltiId: number,
  enabled: boolean = true
): UseQueryResult<LtiToolDetailResponse, Error> {
  return useQuery({
    queryKey: ltiQueryKeys.tool(ltiId),
    queryFn: () => fetchLtiTool(ltiId),
    enabled: enabled && ltiId > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

/**
 * Hook to fetch LTI launch data with React Query
 *
 * Fetches the launch parameters and endpoint needed to launch an LTI tool.
 * Handles both LTI 1.0/1.1 OAuth signatures and LTI 1.3 OIDC flow preparation.
 *
 * @param ltiId - LTI tool instance ID
 * @param options - Optional launch configuration
 * @param enabled - Whether query should run automatically (default: true)
 * @returns Query result with launch data
 *
 * @example
 * ```tsx
 * function LtiLauncher({ toolId }: { toolId: number }) {
 *   const { data, isLoading, refetch } = useLtiLaunchData(toolId, {
 *     launchContainer: LaunchContainer.WINDOW
 *   });
 *
 *   const handleLaunch = () => {
 *     if (data) {
 *       if (data.requiresOidc) {
 *         window.location.href = data.oidcRedirectUrl!;
 *       } else {
 *         // Submit form with launch parameters
 *       }
 *     }
 *   };
 *
 *   return <Button onClick={handleLaunch}>Launch Tool</Button>;
 * }
 * ```
 */
export function useLtiLaunchData(
  ltiId: number,
  options?: LtiLaunchOptions,
  enabled: boolean = true
): UseQueryResult<LtiLaunchDataResponse, Error> {
  return useQuery({
    queryKey: [...ltiQueryKeys.toolLaunch(ltiId), options] as QueryKey,
    queryFn: () => fetchLtiLaunchData(ltiId, options),
    enabled: enabled && ltiId > 0,
    staleTime: 30 * 1000, // 30 seconds - launch data may include time-sensitive tokens
    gcTime: 60 * 1000, // 1 minute
    // Don't refetch on window focus as launch parameters may be time-sensitive
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch LTI tool configuration with React Query
 *
 * Retrieves the configuration settings for an LTI tool including
 * privacy settings, custom parameters, and service URLs.
 *
 * @param ltiId - LTI tool instance ID
 * @param enabled - Whether query should run automatically (default: true)
 * @returns Query result with tool configuration
 */
export function useLtiToolConfig(
  ltiId: number,
  enabled: boolean = true
): UseQueryResult<LtiToolConfigResponse, Error> {
  return useQuery({
    queryKey: ltiQueryKeys.toolConfig(ltiId),
    queryFn: () => fetchLtiToolConfig(ltiId),
    enabled: enabled && ltiId > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes - config changes infrequently
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook to fetch available LTI tool types with React Query
 *
 * Retrieves the list of configured tool types available for use,
 * with optional filtering by state, course, or search term.
 *
 * @param filters - Optional filtering options
 * @param enabled - Whether query should run automatically (default: true)
 * @returns Query result with tool types list
 *
 * @example
 * ```tsx
 * function ToolTypeSelector() {
 *   const { data, isLoading } = useLtiToolTypes({
 *     state: LtiToolState.CONFIGURED,
 *     includeGlobal: true
 *   });
 *
 *   return (
 *     <Select>
 *       {data?.types.map(type => (
 *         <Option key={type.id} value={type.id}>{type.name}</Option>
 *       ))}
 *     </Select>
 *   );
 * }
 * ```
 */
export function useLtiToolTypes(
  filters?: LtiToolTypesFilterOptions,
  enabled: boolean = true
): UseQueryResult<LtiToolTypesResponse, Error> {
  return useQuery({
    queryKey: [...ltiQueryKeys.types(), filters] as QueryKey,
    queryFn: () => fetchLtiToolTypes(filters),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

/**
 * Hook to fetch LTI grades with React Query
 *
 * Retrieves all grade passback results for an LTI tool,
 * useful for displaying student progress and grades.
 *
 * @param ltiId - LTI tool instance ID
 * @param enabled - Whether query should run automatically (default: true)
 * @returns Query result with grades list
 *
 * @example
 * ```tsx
 * function LtiGradesList({ toolId }: { toolId: number }) {
 *   const { data, isLoading } = useLtiGrades(toolId);
 *
 *   return (
 *     <GradeTable
 *       grades={data?.grades ?? []}
 *       maxGrade={data?.maxGrade ?? 100}
 *     />
 *   );
 * }
 * ```
 */
export function useLtiGrades(
  ltiId: number,
  enabled: boolean = true
): UseQueryResult<LtiGradesResponse, Error> {
  return useQuery({
    queryKey: ltiQueryKeys.toolGrades(ltiId),
    queryFn: () => fetchLtiGrades(ltiId),
    enabled: enabled && ltiId > 0,
    staleTime: 30 * 1000, // 30 seconds - grades may update frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for LTI grade passback mutation
 *
 * Provides a mutation function to submit grade updates to the LTI tool
 * with automatic cache invalidation on success.
 *
 * @returns Mutation result for grade passback
 *
 * @example
 * ```tsx
 * function GradeSubmitter({ toolId, userId }: Props) {
 *   const { mutate, isPending, error } = useLtiGradePassback();
 *
 *   const handleSubmit = (grade: number) => {
 *     mutate({
 *       ltiId: toolId,
 *       request: {
 *         userId,
 *         grade,
 *         gradingProgress: 'FullyGraded'
 *       }
 *     });
 *   };
 *
 *   return <GradeForm onSubmit={handleSubmit} loading={isPending} />;
 * }
 * ```
 */
export function useLtiGradePassback(): UseMutationResult<
  LtiGradePassbackResponse,
  Error,
  { ltiId: number; request: LtiGradePassbackRequest },
  { previousGrades?: LtiGradesResponse }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ltiId, request }) => submitLtiGradePassback(ltiId, request),

    // Optimistic update: Update the cache before the request completes
    onMutate: async ({ ltiId, request }) => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ltiQueryKeys.toolGrades(ltiId) });

      // Snapshot the previous value
      const previousGrades = queryClient.getQueryData<LtiGradesResponse>(
        ltiQueryKeys.toolGrades(ltiId)
      );

      // Optimistically update the cache
      if (previousGrades) {
        const now = Math.floor(Date.now() / 1000);
        const updatedGrades = previousGrades.grades.map((grade) => {
          if (grade.userid === request.userId) {
            return {
              ...grade,
              gradepercent: request.grade,
              dateupdated: now,
            };
          }
          return grade;
        });

        queryClient.setQueryData<LtiGradesResponse>(ltiQueryKeys.toolGrades(ltiId), {
          ...previousGrades,
          grades: updatedGrades,
        });
      }

      return { previousGrades };
    },

    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (_err, { ltiId }, context) => {
      if (context?.previousGrades) {
        queryClient.setQueryData(ltiQueryKeys.toolGrades(ltiId), context.previousGrades);
      }
    },

    // Always refetch after error or success to ensure data consistency
    onSettled: (_data, _error, { ltiId }) => {
      void queryClient.invalidateQueries({ queryKey: ltiQueryKeys.toolGrades(ltiId) });
      // Also invalidate any related gradebook queries
      void queryClient.invalidateQueries({ queryKey: ['gradebook'] });
    },
  });
}

/**
 * Hook for initiating LTI 1.3 OIDC login
 *
 * Provides a mutation function to start the OIDC authentication flow
 * for LTI 1.3 tools.
 *
 * @returns Mutation result for OIDC login initiation
 *
 * @example
 * ```tsx
 * function Lti13Launcher({ toolId }: { toolId: number }) {
 *   const { mutate, isPending } = useLtiOidcLogin();
 *
 *   const handleLaunch = () => {
 *     mutate(
 *       { ltiId: toolId },
 *       {
 *         onSuccess: (data) => {
 *           // Redirect to the OIDC auth endpoint
 *           window.location.href = data.authRequestUrl;
 *         }
 *       }
 *     );
 *   };
 *
 *   return <Button onClick={handleLaunch} loading={isPending}>Launch</Button>;
 * }
 * ```
 */
export function useLtiOidcLogin(): UseMutationResult<
  LtiOidcLoginResponse,
  Error,
  { ltiId: number; request?: LtiOidcLoginRequest },
  unknown
> {
  return useMutation({
    mutationFn: ({ ltiId, request }) => initiateLtiOidcLogin(ltiId, request),
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Build a launch form and submit it
 *
 * Creates and submits an HTML form with the LTI launch parameters.
 * This is the standard method for launching LTI 1.0/1.1 tools.
 *
 * @param launchData - Launch data from the API
 * @param target - Target window/frame name (default: '_blank')
 */
export function submitLtiLaunchForm(
  launchData: LtiLaunchDataResponse,
  target: string = '_blank'
): void {
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

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

/**
 * Get the appropriate window features for a new window launch
 *
 * @param launchData - Launch data from the API
 * @returns Window features string or undefined
 */
export function getLtiWindowFeatures(launchData: LtiLaunchDataResponse): string | undefined {
  if (launchData.launchContainer !== LaunchContainer.WINDOW) {
    // Not a WINDOW launch
    return undefined;
  }

  return launchData.windowFeatures ?? 'width=800,height=600,resizable=yes,scrollbars=yes';
}

/**
 * Determine the launch target based on launch container mode
 *
 * @param launchContainer - Launch container mode
 * @param ltiId - LTI tool instance ID (for unique frame name)
 * @returns Target string for form submission or window.open
 */
export function getLtiLaunchTarget(launchContainer: LaunchContainer, ltiId: number): string {
  switch (launchContainer) {
    case LaunchContainer.DEFAULT:
      return `lti-frame-${ltiId}`;
    case LaunchContainer.EMBED:
      return `lti-embed-${ltiId}`;
    case LaunchContainer.EMBED_NO_BLOCKS:
      return `lti-embed-${ltiId}`;
    case LaunchContainer.WINDOW:
      return '_blank';
    case LaunchContainer.REPLACE_MOODLE_WINDOW:
      return '_self';
    default:
      return `lti-frame-${ltiId}`;
  }
}

/**
 * Check if an LTI tool uses LTI 1.3 (requires OIDC flow)
 *
 * @param ltiVersion - LTI version string
 * @returns True if LTI 1.3, false otherwise
 */
export function isLti13(ltiVersion: LtiVersion | string): boolean {
  return ltiVersion === '1.3.0' || ltiVersion === 'LTI-1p3';
}

/**
 * Check if an LTI tool uses LTI 2.0
 *
 * @param ltiVersion - LTI version string
 * @returns True if LTI 2.0, false otherwise
 */
export function isLti20(ltiVersion: LtiVersion | string): boolean {
  return ltiVersion === 'LTI-2p0';
}

/**
 * Check if an LTI tool uses legacy LTI 1.0/1.1
 *
 * @param ltiVersion - LTI version string
 * @returns True if LTI 1.0/1.1, false otherwise
 */
export function isLti1x(ltiVersion: LtiVersion | string): boolean {
  return ltiVersion === 'LTI-1p0' || !ltiVersion;
}

// ============================================================================
// Type Re-exports for Convenience
// ============================================================================

export type {
  LtiTool,
  LtiToolType,
  LtiLaunchData,
  LtiGradeResult,
  LtiTypesConfig,
  LtiToolSettings,
  LtiToolProxy,
} from '../types/lti.types';

export {
  LtiVersion,
  LaunchContainer,
  LtiToolState,
  LtiToolProxyState,
} from '../types/lti.types';
