/**
 * Main custom React hook for LTI (Learning Tools Interoperability) tool data management
 *
 * Provides comprehensive LTI tool state management including tool configuration retrieval,
 * tool type information, grade passback results, and launch readiness checks.
 * Wraps multiple React Query hooks from ltiApi.ts with automatic caching, 5-minute staleTime,
 * and loading/error state management.
 *
 * @module features/activities/lti/hooks/useLTI
 * @see {@link https://www.imsglobal.org/activity/learning-tools-interoperability|LTI Specification}
 */

import { useCallback } from 'react';
import {
  useLtiTool,
  useLtiToolConfig,
  useLtiToolTypes,
  useLtiGrades,
  ltiQueryKeys,
} from '../api/ltiApi';
import type {
  LtiToolDetailResponse,
  LtiToolConfigResponse,
  LtiToolTypesResponse,
  LtiGradesResponse,
  LtiToolTypesFilterOptions,
} from '../api/ltiApi';
import { LtiVersion } from '../types/lti.types';
import type { LtiToolType } from '../types/lti.types';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Error types specific to LTI operations
 * Provides categorized error handling for LTI-specific failures
 */
export type LtiErrorType =
  | 'MISSING_TOOL_TYPE'
  | 'INVALID_CONFIGURATION'
  | 'DELETED_TOOL'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Extended error interface for LTI-specific errors
 */
export interface LtiError extends Error {
  /** Categorized error type for handling */
  type: LtiErrorType;
  /** Original error that caused this LTI error */
  cause?: Error;
  /** Additional context about the error */
  details?: Record<string, unknown>;
}

/**
 * Configuration options for the useLTI hook
 */
export interface UseLTIOptions {
  /**
   * Whether queries should run automatically.
   * When false, queries will not execute until enabled.
   * @default true
   */
  enabled?: boolean;

  /**
   * Filter options for tool types query.
   * Used to filter the available tool types list.
   */
  toolTypesFilter?: LtiToolTypesFilterOptions;

  /**
   * Whether to fetch grades data.
   * Set to false if grade data is not needed to reduce API calls.
   * @default true
   */
  fetchGrades?: boolean;

  /**
   * Whether to fetch tool configuration.
   * Set to false if configuration data is not needed.
   * @default true
   */
  fetchConfig?: boolean;

  /**
   * Whether to fetch available tool types.
   * Set to false if tool types are not needed.
   * @default true
   */
  fetchToolTypes?: boolean;
}

/**
 * Return type interface for the useLTI hook
 *
 * Provides comprehensive access to LTI tool data, loading states,
 * error information, and helper functions for checking tool capabilities.
 */
export interface UseLTIResult {
  // ============ Data Properties ============

  /**
   * LTI tool instance data with metadata
   * Contains the tool details, associated tool type, and configuration status
   */
  tool: LtiToolDetailResponse | undefined;

  /**
   * Tool configuration settings
   * Contains privacy settings, custom parameters, and service endpoints
   */
  toolConfig: LtiToolConfigResponse | undefined;

  /**
   * List of available tool types
   * Contains preconfigured tool types that can be used
   */
  toolTypes: LtiToolTypesResponse | undefined;

  /**
   * Grade passback results from the LTI tool
   * Contains grade submissions and sync status
   */
  grades: LtiGradesResponse | undefined;

  // ============ State Properties ============

  /**
   * Combined loading state for all queries
   * Returns true if any of the queries is currently loading
   */
  isLoading: boolean;

  /**
   * Combined error state for all queries
   * Returns the first error encountered from any query
   */
  error: LtiError | null;

  /**
   * Individual loading states for each query
   */
  loadingStates: {
    tool: boolean;
    config: boolean;
    types: boolean;
    grades: boolean;
  };

  /**
   * Individual error states for each query
   */
  errorStates: {
    tool: Error | null;
    config: Error | null;
    types: Error | null;
    grades: Error | null;
  };

  // ============ Capability Check Functions ============

  /**
   * Checks if the tool is configured to accept grades from the external tool.
   * Returns true if the tool can receive grade passback.
   * @returns boolean indicating grade acceptance capability
   */
  canAcceptGrades: () => boolean;

  /**
   * Checks if the tool allows roster/membership retrieval.
   * Returns true if the tool can access course membership data.
   * @returns boolean indicating roster access capability
   */
  canAllowRoster: () => boolean;

  /**
   * Checks if the tool supports content item selection (deep linking).
   * Returns true if the tool can provide content items for embedding.
   * @returns boolean indicating content selection support
   */
  supportsContentSelection: () => boolean;

  /**
   * Checks if the tool uses LTI 1.3 (Advantage) protocol.
   * LTI 1.3 uses OIDC/JWT authentication instead of OAuth 1.0a.
   * @returns boolean indicating LTI 1.3 usage
   */
  isLTI1p3: () => boolean;

  // ============ Refetch Functions ============

  /**
   * Manually refetch the tool instance data.
   * Useful for refreshing data after external changes.
   */
  refetchTool: () => Promise<void>;

  /**
   * Manually refetch the tool configuration.
   * Useful after configuration changes.
   */
  refetchConfig: () => Promise<void>;

  /**
   * Manually refetch the grades data.
   * Useful for getting latest grade passback results.
   */
  refetchGrades: () => Promise<void>;

  /**
   * Manually refetch all LTI data.
   * Convenience method to refresh all queries at once.
   */
  refetchAll: () => Promise<void>;

  // ============ Additional Utilities ============

  /**
   * Query keys for cache manipulation
   * Useful for invalidating or updating cache entries externally
   */
  queryKeys: {
    tool: readonly string[];
    config: readonly string[];
    grades: readonly string[];
    types: readonly string[];
  };

  /**
   * Whether the tool data has been successfully loaded at least once
   */
  hasToolData: boolean;

  /**
   * Whether the tool is fully configured and ready to launch
   */
  isReady: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Categorizes an error into an LTI-specific error type
 *
 * @param error - The original error to categorize
 * @returns Categorized LtiError with type and details
 */
function categorizeLtiError(error: Error | null): LtiError | null {
  if (!error) {
    return null;
  }

  const errorMessage = error.message.toLowerCase();
  let errorType: LtiErrorType = 'UNKNOWN_ERROR';
  const details: Record<string, unknown> = {};

  // Categorize based on error message patterns
  if (
    errorMessage.includes('tool type') ||
    errorMessage.includes('typeid') ||
    errorMessage.includes('missing type')
  ) {
    errorType = 'MISSING_TOOL_TYPE';
  } else if (
    errorMessage.includes('configuration') ||
    errorMessage.includes('config') ||
    errorMessage.includes('invalid')
  ) {
    errorType = 'INVALID_CONFIGURATION';
  } else if (
    errorMessage.includes('deleted') ||
    errorMessage.includes('not found') ||
    errorMessage.includes('does not exist')
  ) {
    errorType = 'DELETED_TOOL';
  } else if (
    errorMessage.includes('permission') ||
    errorMessage.includes('access denied') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('forbidden')
  ) {
    errorType = 'PERMISSION_DENIED';
  } else if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('connection')
  ) {
    errorType = 'NETWORK_ERROR';
  }

  const ltiError: LtiError = {
    ...error,
    name: 'LtiError',
    type: errorType,
    cause: error,
    details,
  };

  return ltiError;
}

/**
 * Checks if a tool type supports content selection based on capabilities
 *
 * @param toolType - The tool type to check
 * @returns boolean indicating content selection support
 */
function checkContentSelectionSupport(toolType: LtiToolType | null | undefined): boolean {
  if (!toolType) {
    return false;
  }

  // Check enabled capabilities for content item selection
  const capabilities = toolType.enabledcapability ?? '';
  return (
    capabilities.includes('ContentItemSelection') ||
    capabilities.includes('ContentItem') ||
    capabilities.includes('DeepLinking')
  );
}

// ============================================================================
// Main Hook Implementation
// ============================================================================

/**
 * Main hook for LTI tool data fetching and management
 *
 * Provides a unified interface for accessing LTI tool data, configuration,
 * available tool types, and grade passback results. Implements query coordination
 * to ensure dependent data is loaded in the correct order.
 *
 * @param ltiId - The LTI tool instance ID to fetch data for
 * @param options - Optional configuration options for the hook
 * @returns UseLTIResult object containing data, states, and helper functions
 *
 * @example
 * ```tsx
 * function LtiToolComponent({ toolId }: { toolId: number }) {
 *   const {
 *     tool,
 *     toolConfig,
 *     isLoading,
 *     error,
 *     canAcceptGrades,
 *     isLTI1p3,
 *     refetchTool,
 *   } = useLTI(toolId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorDisplay error={error} />;
 *
 *   return (
 *     <div>
 *       <h2>{tool?.tool.name}</h2>
 *       {canAcceptGrades() && <GradeDisplay />}
 *       {isLTI1p3() && <Lti13Badge />}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Conditional fetching
 * function ConditionalLtiTool({ toolId, shouldFetch }: Props) {
 *   const { tool, isLoading } = useLTI(toolId, {
 *     enabled: shouldFetch,
 *     fetchGrades: false, // Don't need grades for this component
 *   });
 *
 *   // ...
 * }
 * ```
 */
function useLTI(ltiId: number, options: UseLTIOptions = {}): UseLTIResult {
  const {
    enabled = true,
    toolTypesFilter,
    fetchGrades = true,
    fetchConfig = true,
    fetchToolTypes = true,
  } = options;

  // Calculate whether queries should be enabled
  const isValidId = ltiId > 0;
  const shouldFetch = enabled && isValidId;

  // ============ Execute Queries ============

  // Primary query: Fetch tool instance data
  // This is always fetched first as other queries may depend on it
  const toolQuery = useLtiTool(ltiId, shouldFetch);

  // Dependent query: Fetch tool configuration
  // Only fetch after tool data is loaded successfully
  const configQuery = useLtiToolConfig(
    ltiId,
    shouldFetch && fetchConfig && !toolQuery.isLoading && !!toolQuery.data
  );

  // Independent query: Fetch available tool types
  // This can be fetched independently of tool data
  const toolTypesQuery = useLtiToolTypes(
    toolTypesFilter,
    shouldFetch && fetchToolTypes
  );

  // Dependent query: Fetch grades
  // Only fetch after tool data is loaded and tool accepts grades
  const shouldFetchGrades =
    shouldFetch &&
    fetchGrades &&
    !toolQuery.isLoading &&
    !!toolQuery.data;

  const gradesQuery = useLtiGrades(ltiId, shouldFetchGrades);

  // ============ Aggregate States ============

  // Combined loading state: true if any query is loading
  const isLoading =
    toolQuery.isLoading ||
    (fetchConfig && configQuery.isLoading) ||
    (fetchToolTypes && toolTypesQuery.isLoading) ||
    (fetchGrades && gradesQuery.isLoading);

  // Individual loading states
  const loadingStates = {
    tool: toolQuery.isLoading,
    config: configQuery.isLoading,
    types: toolTypesQuery.isLoading,
    grades: gradesQuery.isLoading,
  };

  // Individual error states
  const errorStates = {
    tool: toolQuery.error,
    config: configQuery.error,
    types: toolTypesQuery.error,
    grades: gradesQuery.error,
  };

  // Combined error: return first error encountered (prioritizing tool errors)
  const firstError =
    toolQuery.error ??
    configQuery.error ??
    toolTypesQuery.error ??
    gradesQuery.error;

  const error = categorizeLtiError(firstError);

  // ============ Capability Check Functions ============

  /**
   * Check if tool can accept grades from external tool
   */
  const canAcceptGrades = useCallback((): boolean => {
    // Check tool instance setting
    if (toolQuery.data?.tool.instructorchoiceacceptgrades === 1) {
      return true;
    }

    // Check tool configuration privacy settings
    if (configQuery.data?.privacy?.acceptGrades === true) {
      return true;
    }

    // Default to false if no explicit setting
    return false;
  }, [toolQuery.data, configQuery.data]);

  /**
   * Check if tool allows roster/membership retrieval
   */
  const canAllowRoster = useCallback((): boolean => {
    // Check tool instance setting
    if (toolQuery.data?.tool.instructorchoiceallowroster === 1) {
      return true;
    }

    // Check if membership service is available in config
    if (configQuery.data?.services?.membershipsUrl) {
      return true;
    }

    return false;
  }, [toolQuery.data, configQuery.data]);

  /**
   * Check if tool supports content item selection (deep linking)
   */
  const supportsContentSelection = useCallback((): boolean => {
    // Get the tool type from the tool data
    const toolType = toolQuery.data?.toolType;

    // Check tool type capabilities
    if (checkContentSelectionSupport(toolType)) {
      return true;
    }

    // Check enabled capabilities in tool configuration
    const toolTypeInList = toolTypesQuery.data?.types.find(
      (type) => type.id === toolQuery.data?.tool.typeid
    );

    return checkContentSelectionSupport(toolTypeInList);
  }, [toolQuery.data, toolTypesQuery.data]);

  /**
   * Check if tool uses LTI 1.3 (Advantage) protocol
   */
  const isLTI1p3 = useCallback((): boolean => {
    // Check the LTI version from tool response
    const ltiVersion = toolQuery.data?.ltiVersion;

    if (ltiVersion === LtiVersion.LTI_1P3 || ltiVersion === '1.3.0') {
      return true;
    }

    // Check the tool type's LTI version
    const toolType = toolQuery.data?.toolType;
    if (toolType?.ltiversion === LtiVersion.LTI_1P3 || toolType?.ltiversion === '1.3.0') {
      return true;
    }

    return false;
  }, [toolQuery.data]);

  // ============ Refetch Functions ============

  /**
   * Refetch tool instance data
   */
  const refetchTool = useCallback(async (): Promise<void> => {
    await toolQuery.refetch();
  }, [toolQuery]);

  /**
   * Refetch tool configuration
   */
  const refetchConfig = useCallback(async (): Promise<void> => {
    await configQuery.refetch();
  }, [configQuery]);

  /**
   * Refetch grades data
   */
  const refetchGrades = useCallback(async (): Promise<void> => {
    await gradesQuery.refetch();
  }, [gradesQuery]);

  /**
   * Refetch all LTI data
   */
  const refetchAll = useCallback(async (): Promise<void> => {
    await Promise.all([
      toolQuery.refetch(),
      configQuery.refetch(),
      toolTypesQuery.refetch(),
      gradesQuery.refetch(),
    ]);
  }, [toolQuery, configQuery, toolTypesQuery, gradesQuery]);

  // ============ Query Keys for External Cache Manipulation ============

  const queryKeys = {
    tool: ltiQueryKeys.tool(ltiId) as unknown as readonly string[],
    config: ltiQueryKeys.toolConfig(ltiId) as unknown as readonly string[],
    grades: ltiQueryKeys.toolGrades(ltiId) as unknown as readonly string[],
    types: ltiQueryKeys.types() as unknown as readonly string[],
  };

  // ============ Computed Properties ============

  /**
   * Whether tool data has been successfully loaded
   */
  const hasToolData = !!toolQuery.data?.tool;

  /**
   * Whether the tool is fully configured and ready to launch
   */
  const isReady =
    hasToolData &&
    toolQuery.data?.isConfigured === true &&
    toolQuery.data?.canLaunch === true;

  // ============ Return Result ============

  return {
    // Data
    tool: toolQuery.data,
    toolConfig: configQuery.data,
    toolTypes: toolTypesQuery.data,
    grades: gradesQuery.data,

    // Combined states
    isLoading,
    error,

    // Individual states
    loadingStates,
    errorStates,

    // Capability checks
    canAcceptGrades,
    canAllowRoster,
    supportsContentSelection,
    isLTI1p3,

    // Refetch functions
    refetchTool,
    refetchConfig,
    refetchGrades,
    refetchAll,

    // Utilities
    queryKeys,
    hasToolData,
    isReady,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default useLTI;
export { useLTI };
