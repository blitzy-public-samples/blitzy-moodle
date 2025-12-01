/**
 * Custom React hook for updating LTI tool configuration settings
 *
 * This hook manages LTI configuration updates through React Query mutation,
 * wrapping the PUT /api/v1/lti/{id}/config API endpoint. The endpoint wraps
 * Moodle's update_record on lti table and lti_update_instance function from lib.php.
 *
 * Features:
 * - Updates tool URL, authentication credentials, launch container options
 * - Manages privacy settings, grade passback configuration, display preferences
 * - Provides mutation state management with loading, error, and success states
 * - Integrates with React Query cache invalidation for automatic data refresh
 * - Implements optimistic updates for better user experience
 * - Comprehensive error handling for validation, permission, and network errors
 *
 * Configuration Fields (from mod_form.php and edit_form.php):
 * - toolurl: Tool launch URL (PARAM_URL validated)
 * - securetoolurl: Secure tool URL for HTTPS (PARAM_URL validated)
 * - resourcekey: OAuth consumer key (PARAM_TEXT)
 * - password: OAuth shared secret (PARAM_TEXT)
 * - instructorcustomparameters: Custom parameters from instructor (PARAM_TEXT)
 * - launchcontainer: Launch display mode (1-5, see LaunchContainer enum)
 * - showtitlelaunch: Show title on launch (0 or 1)
 * - showdescriptionlaunch: Show description on launch (0 or 1)
 * - instructorchoicesendname: Send user name to tool (0 or 1)
 * - instructorchoicesendemailaddr: Send user email to tool (0 or 1)
 * - instructorchoiceacceptgrades: Accept grades from tool (0 or 1)
 * - icon: Tool icon URL
 * - secureicon: Secure tool icon URL
 * - grade: Grade scale value
 * - typeid: Reference to preconfigured tool type
 *
 * Permission Requirements:
 * - mod/lti:addinstance or mod/lti:addcourseinstance capability required
 *
 * @module features/activities/lti/hooks/useUpdateLTIConfig
 * @see public/mod/lti/mod_form.php - Configuration form field definitions
 * @see public/mod/lti/edit_form.php - Tool type configuration patterns
 * @see public/mod/lti/lib.php - lti_update_instance function
 */

import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import { apiClient } from '@/services/api/client';
import type { LtiTool } from '@/features/activities/lti/types/lti.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * API error response structure from Moodle backend
 * Matches the standard error envelope from api_exception.php
 */
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * API success response structure from Moodle backend
 * Matches the standard success envelope from api_response.php
 */
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Parameters for updating LTI tool configuration
 *
 * All fields are optional to allow partial updates. Only provided fields
 * will be updated; omitted fields retain their current values.
 *
 * Field validation follows Moodle patterns from mod_form.php:
 * - URLs: PARAM_URL validation (must be valid URL format)
 * - Text fields: PARAM_TEXT (general text, sanitized)
 * - Numeric fields: Integer values within allowed ranges
 * - Boolean fields: 0 or 1 values
 */
export interface UpdateLTIConfigParams {
  /** Tool launch URL - must be valid URL (PARAM_URL) */
  toolurl?: string;

  /** Secure tool launch URL (HTTPS) - must be valid URL (PARAM_URL) */
  securetoolurl?: string;

  /** OAuth consumer key / resource key (PARAM_TEXT) */
  resourcekey?: string;

  /** OAuth shared secret / password (PARAM_TEXT) */
  password?: string;

  /** Custom parameters provided by instructor (PARAM_TEXT, one per line) */
  instructorcustomparameters?: string;

  /** Launch container mode (1-5):
   * 1=DEFAULT, 2=EMBED, 3=EMBED_NO_BLOCKS, 4=WINDOW, 5=REPLACE_MOODLE_WINDOW
   */
  launchcontainer?: number;

  /** Show title on launch (0=no, 1=yes) */
  showtitlelaunch?: number;

  /** Show description on launch (0=no, 1=yes) */
  showdescriptionlaunch?: number;

  /** Send user's name to tool provider (0=no, 1=yes) */
  instructorchoicesendname?: number;

  /** Send user's email address to tool provider (0=no, 1=yes) */
  instructorchoicesendemailaddr?: number;

  /** Accept grades from tool provider (0=no, 1=yes) */
  instructorchoiceacceptgrades?: number;

  /** Tool icon URL */
  icon?: string;

  /** Secure tool icon URL (HTTPS) */
  secureicon?: string;

  /** Grade scale value (0-100 or negative for scale ID) */
  grade?: number;

  /** Reference to preconfigured tool type ID */
  typeid?: number;

  /** Enable debug launch mode (0=no, 1=yes) */
  debuglaunch?: number;

  /** Allow roster retrieval (0=no, 1=yes) */
  instructorchoiceallowroster?: number;

  /** Allow tool to store settings (0=no, 1=yes) */
  instructorchoiceallowsetting?: number;
}

/**
 * Error type categories for LTI configuration updates
 */
export type LTIConfigErrorType =
  | 'VALIDATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'TOOL_TYPE_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Structured error object for LTI configuration update failures
 */
export interface LTIConfigError {
  /** Error type category */
  type: LTIConfigErrorType;

  /** Human-readable error message */
  message: string;

  /** Specific error code from server */
  code?: string;

  /** Additional error details */
  details?: Record<string, unknown>;

  /** HTTP status code (if applicable) */
  status?: number;

  /** Original error object */
  originalError?: unknown;
}

/**
 * Hook configuration options
 */
export interface UseUpdateLTIConfigOptions {
  /**
   * Callback function executed on successful configuration update
   * @param data - Updated LTI tool data
   * @param variables - Configuration parameters that were sent
   */
  onSuccess?: (data: LtiTool, variables: UpdateLTIConfigParams) => void;

  /**
   * Callback function executed on configuration update failure
   * @param error - Structured error object
   * @param variables - Configuration parameters that were sent
   */
  onError?: (error: LTIConfigError, variables: UpdateLTIConfigParams) => void;

  /**
   * Number of retry attempts for transient failures (default: 3)
   */
  retryCount?: number;

  /**
   * Enable optimistic updates (default: true)
   */
  enableOptimisticUpdates?: boolean;
}

/**
 * Return type for useUpdateLTIConfig hook
 *
 * Provides mutation functionality and state for LTI configuration updates
 */
export interface UseUpdateLTIConfigResult {
  /**
   * Function to trigger configuration update mutation
   * @param params - Configuration parameters to update
   * @returns Promise that resolves with updated LTI tool data
   */
  updateConfig: (params: UpdateLTIConfigParams) => Promise<LtiTool>;

  /**
   * Indicates whether a configuration update is currently in progress
   */
  isUpdating: boolean;

  /**
   * Error object if the last mutation failed, null otherwise
   */
  error: LTIConfigError | null;

  /**
   * Indicates whether the last mutation was successful
   */
  isSuccess: boolean;

  /**
   * Resets the mutation state to initial values
   */
  reset: () => void;

  /**
   * Indicates whether the mutation is idle (hasn't been triggered yet)
   */
  isIdle: boolean;

  /**
   * Indicates whether the mutation has been triggered at least once
   */
  isSubmitted: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Query key factory for LTI-related cache keys
 */
const LTI_QUERY_KEYS = {
  all: ['lti'] as const,
  tool: (id: number) => ['lti', id] as const,
  config: (id: number) => ['lti', id, 'config'] as const,
  toolTypes: () => ['lti', 'types'] as const,
};

/**
 * Valid launch container values (from locallib.php lines 70-74)
 */
const VALID_LAUNCH_CONTAINERS = [1, 2, 3, 4, 5] as const;

/**
 * Default retry count for transient failures
 */
const DEFAULT_RETRY_COUNT = 3;

/**
 * Retry delay calculation (exponential backoff)
 * 1s, 2s, 4s for attempts 0, 1, 2
 */
const calculateRetryDelay = (attemptIndex: number): number => {
  return Math.min(1000 * Math.pow(2, attemptIndex), 10000);
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates URL format (matches PARAM_URL validation in Moodle)
 * @param url - URL string to validate
 * @returns true if valid URL, false otherwise
 */
function isValidUrl(url: string): boolean {
  if (!url || url.trim() === '') {
    return true; // Empty is valid (optional field)
  }

  try {
    const parsedUrl = new URL(url);
    // Accept only http and https protocols
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates launch container value
 * @param container - Launch container number
 * @returns true if valid container value
 */
function isValidLaunchContainer(container: number): boolean {
  return VALID_LAUNCH_CONTAINERS.includes(container as 1 | 2 | 3 | 4 | 5);
}

/**
 * Validates boolean field value (0 or 1)
 * @param value - Value to validate
 * @returns true if valid boolean (0 or 1)
 */
function isValidBooleanField(value: number): boolean {
  return value === 0 || value === 1;
}

/**
 * Validates all configuration parameters before submission
 * @param params - Configuration parameters to validate
 * @returns Array of validation error messages (empty if valid)
 */
function validateConfigParams(params: UpdateLTIConfigParams): string[] {
  const errors: string[] = [];

  // Validate URLs
  if (params.toolurl !== undefined && !isValidUrl(params.toolurl)) {
    errors.push('Invalid tool URL format. Must be a valid HTTP or HTTPS URL.');
  }

  if (params.securetoolurl !== undefined && !isValidUrl(params.securetoolurl)) {
    errors.push('Invalid secure tool URL format. Must be a valid HTTPS URL.');
  }

  if (params.icon !== undefined && !isValidUrl(params.icon)) {
    errors.push('Invalid icon URL format.');
  }

  if (params.secureicon !== undefined && !isValidUrl(params.secureicon)) {
    errors.push('Invalid secure icon URL format.');
  }

  // Validate secure URLs use HTTPS
  if (params.securetoolurl && params.securetoolurl.trim() !== '') {
    try {
      const url = new URL(params.securetoolurl);
      if (url.protocol !== 'https:') {
        errors.push('Secure tool URL must use HTTPS protocol.');
      }
    } catch {
      // Already validated above
    }
  }

  // Validate launch container
  if (
    params.launchcontainer !== undefined &&
    !isValidLaunchContainer(params.launchcontainer)
  ) {
    errors.push('Invalid launch container value. Must be between 1 and 5.');
  }

  // Validate boolean fields
  const booleanFields: Array<keyof UpdateLTIConfigParams> = [
    'showtitlelaunch',
    'showdescriptionlaunch',
    'instructorchoicesendname',
    'instructorchoicesendemailaddr',
    'instructorchoiceacceptgrades',
    'debuglaunch',
    'instructorchoiceallowroster',
    'instructorchoiceallowsetting',
  ];

  for (const field of booleanFields) {
    const value = params[field];
    if (value !== undefined && typeof value === 'number' && !isValidBooleanField(value)) {
      errors.push(`Invalid value for ${field}. Must be 0 or 1.`);
    }
  }

  // Validate grade value
  if (params.grade !== undefined) {
    // Grade can be 0-100 for point grades, or negative for scale IDs
    if (typeof params.grade !== 'number' || (params.grade > 0 && params.grade > 100)) {
      errors.push('Invalid grade value. Must be 0-100 for points or negative for scale.');
    }
  }

  return errors;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Determines if an error is retryable (transient failure)
 * @param error - Axios error object
 * @returns true if the error should be retried
 */
function isRetryableError(error: AxiosError): boolean {
  // Network errors are retryable
  if (!error.response) {
    return true;
  }

  // Specific HTTP status codes that indicate transient failures
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  return retryableStatuses.includes(error.response.status);
}

/**
 * Parses an API error into a structured LTIConfigError
 * @param error - Error from API call
 * @returns Structured error object
 */
function parseApiError(error: unknown): LTIConfigError {
  if (!error) {
    return {
      type: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      originalError: error,
    };
  }

  // If already an LTIConfigError, return as-is
  if (typeof error === 'object' && error !== null && 'type' in error) {
    const errorObj = error as LTIConfigError;
    if (
      errorObj.type === 'VALIDATION_ERROR' ||
      errorObj.type === 'PERMISSION_DENIED' ||
      errorObj.type === 'NOT_FOUND' ||
      errorObj.type === 'NETWORK_ERROR' ||
      errorObj.type === 'TOOL_TYPE_NOT_FOUND' ||
      errorObj.type === 'UNKNOWN_ERROR'
    ) {
      return errorObj;
    }
  }

  // Handle Axios errors
  const axiosError = error as AxiosError<ApiErrorResponse>;

  if (axiosError.isAxiosError) {
    const status = axiosError.response?.status;
    const responseData = axiosError.response?.data;

    // Network error (no response)
    if (!axiosError.response) {
      return {
        type: 'NETWORK_ERROR',
        message: 'Unable to connect to the server. Please check your network connection.',
        code: 'NETWORK_ERROR',
        originalError: error,
      };
    }

    // Permission denied (403)
    if (status === 403) {
      return {
        type: 'PERMISSION_DENIED',
        message:
          responseData?.error?.message ||
          'You do not have permission to update this LTI tool configuration. Required capability: mod/lti:addinstance or mod/lti:addcourseinstance.',
        code: responseData?.error?.code || 'PERMISSION_DENIED',
        details: responseData?.error?.details,
        status,
        originalError: error,
      };
    }

    // Not found (404)
    if (status === 404) {
      return {
        type: 'NOT_FOUND',
        message:
          responseData?.error?.message || 'The LTI tool configuration was not found.',
        code: responseData?.error?.code || 'NOT_FOUND',
        status,
        originalError: error,
      };
    }

    // Validation error (400, 422)
    if (status === 400 || status === 422) {
      const errorCode = responseData?.error?.code || 'VALIDATION_ERROR';
      const errorType: LTIConfigErrorType =
        errorCode === 'TOOL_TYPE_NOT_FOUND' ? 'TOOL_TYPE_NOT_FOUND' : 'VALIDATION_ERROR';

      return {
        type: errorType,
        message:
          responseData?.error?.message ||
          'Invalid configuration data. Please check the provided values.',
        code: errorCode,
        details: responseData?.error?.details,
        status,
        originalError: error,
      };
    }

    // Unauthorized (401)
    if (status === 401) {
      return {
        type: 'PERMISSION_DENIED',
        message: 'Your session has expired. Please log in again.',
        code: 'UNAUTHORIZED',
        status,
        originalError: error,
      };
    }

    // Generic server error
    return {
      type: 'UNKNOWN_ERROR',
      message:
        responseData?.error?.message ||
        'An error occurred while updating the configuration.',
      code: responseData?.error?.code,
      details: responseData?.error?.details,
      status,
      originalError: error,
    };
  }

  // Handle validation errors thrown locally
  if (error instanceof Error && error.message.includes('Validation failed')) {
    return {
      type: 'VALIDATION_ERROR',
      message: error.message,
      code: 'VALIDATION_ERROR',
      originalError: error,
    };
  }

  // Generic error
  return {
    type: 'UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : 'An unknown error occurred',
    originalError: error,
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Makes API call to update LTI tool configuration
 * @param ltiId - LTI tool instance ID
 * @param params - Configuration parameters to update
 * @returns Promise with updated LTI tool data
 */
async function updateLTIConfigApi(
  ltiId: number,
  params: UpdateLTIConfigParams
): Promise<LtiTool> {
  // Client-side validation
  const validationErrors = validateConfigParams(params);
  if (validationErrors.length > 0) {
    // Throw structured error for client-side validation failures
    const error: LTIConfigError = {
      type: 'VALIDATION_ERROR',
      message: validationErrors.join(' '),
      code: 'CLIENT_VALIDATION_FAILED',
      details: { validationErrors },
    };
    throw error;
  }

  try {
    // Make API request
    const response = await apiClient.put<ApiSuccessResponse<LtiTool>>(
      `/lti/${ltiId}/config`,
      params
    );

    return response.data.data;
  } catch (error) {
    // Parse and rethrow as structured LTIConfigError
    // This ensures retry logic and error handlers receive properly typed errors
    throw parseApiError(error);
  }
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Custom React hook for updating LTI tool configuration settings
 *
 * This hook provides a mutation interface for updating LTI tool configuration
 * through the PUT /api/v1/lti/{id}/config API endpoint. It handles:
 * - Optimistic updates for immediate UI feedback
 * - Automatic cache invalidation on success
 * - Comprehensive error handling with categorization
 * - Retry logic for transient failures
 * - TypeScript strict typing throughout
 *
 * @param ltiId - LTI tool instance ID
 * @param options - Optional configuration for callbacks and behavior
 * @returns Object containing mutation function and state
 *
 * @example
 * ```tsx
 * function LTIConfigForm({ ltiId }: { ltiId: number }) {
 *   const { updateConfig, isUpdating, error, isSuccess } = useUpdateLTIConfig(ltiId, {
 *     onSuccess: (data) => {
 *       toast.success('Configuration updated successfully');
 *     },
 *     onError: (error) => {
 *       toast.error(error.message);
 *     },
 *   });
 *
 *   const handleSubmit = async (formData: UpdateLTIConfigParams) => {
 *     try {
 *       await updateConfig(formData);
 *     } catch (e) {
 *       // Error already handled by onError callback
 *     }
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {error && <Alert severity="error">{error.message}</Alert>}
 *       {isSuccess && <Alert severity="success">Configuration saved!</Alert>}
 *       // ... form fields
 *       <Button type="submit" disabled={isUpdating}>
 *         {isUpdating ? 'Saving...' : 'Save Configuration'}
 *       </Button>
 *     </form>
 *   );
 * }
 * ```
 */
function useUpdateLTIConfig(
  ltiId: number,
  options: UseUpdateLTIConfigOptions = {}
): UseUpdateLTIConfigResult {
  const {
    onSuccess,
    onError,
    retryCount = DEFAULT_RETRY_COUNT,
    enableOptimisticUpdates = true,
  } = options;

  const queryClient = useQueryClient();

  // Track submission state
  const hasSubmittedRef = useRef(false);

  // Create mutation
  const mutation = useMutation<
    LtiTool,
    LTIConfigError,
    UpdateLTIConfigParams,
    { previousTool: LtiTool | undefined; previousConfig: unknown }
  >({
    mutationFn: async (params: UpdateLTIConfigParams) => {
      hasSubmittedRef.current = true;
      return updateLTIConfigApi(ltiId, params);
    },

    // Optimistic update: update cache immediately before server response
    onMutate: async (params: UpdateLTIConfigParams) => {
      if (!enableOptimisticUpdates) {
        return { previousTool: undefined, previousConfig: undefined };
      }

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: LTI_QUERY_KEYS.tool(ltiId) });
      await queryClient.cancelQueries({ queryKey: LTI_QUERY_KEYS.config(ltiId) });

      // Snapshot current values for rollback
      const previousTool = queryClient.getQueryData<LtiTool>(LTI_QUERY_KEYS.tool(ltiId));
      const previousConfig = queryClient.getQueryData(LTI_QUERY_KEYS.config(ltiId));

      // Optimistically update the cache
      if (previousTool) {
        queryClient.setQueryData<LtiTool>(LTI_QUERY_KEYS.tool(ltiId), (old) => {
          if (!old) return old;
          return {
            ...old,
            ...params,
            timemodified: Math.floor(Date.now() / 1000),
          };
        });
      }

      return { previousTool, previousConfig };
    },

    // Rollback on error
    onError: (error: LTIConfigError, variables, context) => {
      // Restore previous values on error
      if (context?.previousTool !== undefined) {
        queryClient.setQueryData(LTI_QUERY_KEYS.tool(ltiId), context.previousTool);
      }
      if (context?.previousConfig !== undefined) {
        queryClient.setQueryData(LTI_QUERY_KEYS.config(ltiId), context.previousConfig);
      }

      // Call user's error callback
      onError?.(error, variables);
    },

    // Invalidate cache on success to ensure fresh data
    onSuccess: (data: LtiTool, variables) => {
      // Invalidate related queries to trigger refetch
      void queryClient.invalidateQueries({ queryKey: LTI_QUERY_KEYS.tool(ltiId) });
      void queryClient.invalidateQueries({ queryKey: LTI_QUERY_KEYS.config(ltiId) });

      // Update the tool data in cache with server response
      queryClient.setQueryData<LtiTool>(LTI_QUERY_KEYS.tool(ltiId), data);

      // Call user's success callback
      onSuccess?.(data, variables);
    },

    // Retry configuration for transient failures
    retry: (failureCount, error) => {
      // Don't retry non-retryable errors
      const originalError = error.originalError as AxiosError | undefined;
      if (originalError?.isAxiosError && !isRetryableError(originalError)) {
        return false;
      }

      // Don't retry validation errors
      if (error.type === 'VALIDATION_ERROR' || error.type === 'PERMISSION_DENIED') {
        return false;
      }

      return failureCount < retryCount;
    },

    retryDelay: calculateRetryDelay,

    // Transform errors to our structured format
    throwOnError: false,
  });

  // Memoized update function that returns a promise
  const updateConfig = useCallback(
    async (params: UpdateLTIConfigParams): Promise<LtiTool> => {
      // Validate ltiId
      if (!ltiId || ltiId <= 0) {
        const error: LTIConfigError = {
          type: 'VALIDATION_ERROR',
          message: 'Invalid LTI tool ID',
          code: 'INVALID_LTI_ID',
        };
        throw error;
      }

      // Ensure params is not empty
      if (!params || Object.keys(params).length === 0) {
        const error: LTIConfigError = {
          type: 'VALIDATION_ERROR',
          message: 'No configuration changes provided',
          code: 'EMPTY_PARAMS',
        };
        throw error;
      }

      try {
        return await mutation.mutateAsync(params);
      } catch (error) {
        // Re-throw the structured error
        throw parseApiError(error);
      }
    },
    [ltiId, mutation]
  );

  // Reset function
  const reset = useCallback(() => {
    mutation.reset();
    hasSubmittedRef.current = false;
  }, [mutation]);

  return {
    updateConfig,
    isUpdating: mutation.isPending,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset,
    isIdle: mutation.isIdle,
    isSubmitted: hasSubmittedRef.current,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default useUpdateLTIConfig;

export { useUpdateLTIConfig };
