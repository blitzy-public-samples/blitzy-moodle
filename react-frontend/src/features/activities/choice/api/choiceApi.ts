/**
 * Choice Activity API Client Module
 *
 * TypeScript API client module for Choice activity operations providing methods
 * to fetch choice data, submit responses, retrieve results, and manage choice
 * options with React Query integration for the /api/v1/choices endpoints.
 *
 * This module transforms PHP choice operations from public/mod/choice/ into
 * TypeScript API client methods that call REST endpoints at /api/v1/choices/.
 *
 * @package    react-frontend
 * @subpackage features/activities/choice/api
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 *
 * API Endpoints:
 * - GET    /api/v1/choices/{id}                    - Get choice details with options
 * - POST   /api/v1/choices/{id}/responses          - Submit choice response(s)
 * - GET    /api/v1/choices/{id}/results            - Get choice results with statistics
 * - GET    /api/v1/choices/{id}/responses/{userId} - Get specific user's response
 * - GET    /api/v1/choices/{id}/responses/me       - Get current user's response
 * - DELETE /api/v1/choices/{id}/responses          - Delete user's response
 * - GET    /api/v1/choices/{id}/response-data      - Get detailed response data
 * - GET    /api/v1/choices/{id}/availability       - Get availability status
 *
 * Backend References:
 * - public/mod/choice/lib.php (choice_get_choice, choice_user_submit_response,
 *   choice_get_response_data, choice_get_availability_status, choice_get_user_response)
 * - public/mod/choice/locallib.php (choice_set_events)
 *
 * Error Handling:
 * The API handles specific choice-related errors:
 * - atleastoneoption: At least one option must be selected
 * - multiplenotallowederror: Multiple selections not allowed for this choice
 * - cannotsubmit: User cannot submit response (invalid option or locked)
 * - choicesexceeded: Selected option has reached its response limit
 * - choicefull: The choice option is full (limit reached)
 */

import type { AxiosResponse } from 'axios';
import apiClient from '@/services/api/client';
import type { ApiResponse } from '@/types/api';
import type {
  Choice,
  ChoiceResponse,
  ChoiceResults,
  ChoiceResultsResponse,
  SubmitChoiceResponse,
  ChoiceOptionForDisplay,
} from '../types/choice.types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Options for fetching choice results
 */
export interface GetChoiceResultsOptions {
  /** Group ID to filter responses (optional) */
  groupId?: number;
  /** Whether to include responses from inactive users */
  includeInactive?: boolean;
}

/**
 * Options for fetching response data
 */
export interface GetResponseDataOptions {
  /** Group ID to filter responses (optional, 0 for all groups) */
  groupId?: number;
  /** Whether to only include active enrolled users (default: true) */
  onlyActive?: boolean;
}

/**
 * Choice availability status response
 *
 * Based on choice_get_availability_status from public/mod/choice/lib.php
 */
export interface ChoiceAvailabilityStatus {
  /** Whether the choice is currently available for responses */
  available: boolean;
  /** Warning messages explaining why choice is not available */
  warnings: ChoiceAvailabilityWarning[];
  /** Whether the choice is open (time-based) */
  isOpen: boolean;
  /** Whether the choice is closed (time-based) */
  isClosed: boolean;
  /** Whether the user has already responded */
  hasResponded: boolean;
  /** Whether updates to responses are allowed */
  canUpdate: boolean;
  /** Whether this is a preview period (before open time) */
  isPreview: boolean;
  /** Open timestamp (0 if no restriction) */
  timeOpen: number;
  /** Close timestamp (0 if no restriction) */
  timeClose: number;
}

/**
 * Individual warning about choice availability
 */
export interface ChoiceAvailabilityWarning {
  /** Warning type identifier */
  type: 'notopenyet' | 'expired' | 'choicesaved' | 'previewonly';
  /** Human-readable warning message */
  message: string;
  /** Associated timestamp for time-related warnings */
  timestamp?: number;
}

/**
 * Request payload for submitting choice responses
 */
export interface SubmitResponsePayload {
  /** Array of option IDs to select */
  answers: number[];
}

/**
 * Extended choice data with options for display
 */
export interface ChoiceWithOptions extends Choice {
  /** Array of options with display properties */
  options: ChoiceOptionForDisplay[];
  /** Whether current user has capability to choose */
  hasCapability: boolean;
  /** Whether updates are allowed (user has existing response and allowupdate is true) */
  allowUpdateEnabled: boolean;
  /** Whether this is preview only mode */
  previewOnly: boolean;
}

/**
 * API error codes specific to choice operations
 */
export type ChoiceApiErrorCode =
  | 'atleastoneoption'
  | 'multiplenotallowederror'
  | 'cannotsubmit'
  | 'choicesexceeded'
  | 'choicefull'
  | 'notopenyet'
  | 'expired'
  | 'choicesaved'
  | 'nopermission';

/**
 * Choice-specific API error
 */
export interface ChoiceApiError extends Error {
  code: ChoiceApiErrorCode;
  details?: Record<string, unknown>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates a ChoiceApiError from an API error response
 *
 * @param code - Error code identifier
 * @param message - Error message
 * @param details - Additional error details
 * @returns ChoiceApiError instance
 */
function createChoiceError(
  code: ChoiceApiErrorCode,
  message: string,
  details?: Record<string, unknown>
): ChoiceApiError {
  const error = new Error(message) as ChoiceApiError;
  error.name = 'ChoiceApiError';
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Extracts data from standard API response envelope
 *
 * @template T - Type of the data payload
 * @param response - Axios response containing ApiResponse envelope
 * @returns The extracted data payload
 * @throws Error if response indicates failure
 */
function extractResponseData<T>(response: AxiosResponse<ApiResponse<T>>): T {
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error('API request failed');
}

/**
 * Maps API error response to ChoiceApiError
 *
 * @param error - Error from API request
 * @returns ChoiceApiError with appropriate code and message
 */
function handleChoiceApiError(error: unknown): ChoiceApiError {
  // Check if error has response data with error details
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: unknown } }).response?.data === 'object'
  ) {
    const responseData = (error as { response: { data: Record<string, unknown> } }).response.data;

    // Check for known error codes
    if (typeof responseData.error === 'object' && responseData.error !== null) {
      const errorInfo = responseData.error as { code?: string; message?: string; details?: Record<string, unknown> };

      const errorCode = errorInfo.code as ChoiceApiErrorCode | undefined;
      const errorMessage = errorInfo.message || 'An error occurred';

      // Map known Moodle choice error strings to error codes
      if (errorCode) {
        return createChoiceError(errorCode, errorMessage, errorInfo.details);
      }
    }

    // Check for error message in string format
    if (typeof responseData.message === 'string') {
      const message = responseData.message.toLowerCase();

      if (message.includes('at least one option')) {
        return createChoiceError('atleastoneoption', responseData.message as string);
      }
      if (message.includes('multiple') && message.includes('not allowed')) {
        return createChoiceError('multiplenotallowederror', responseData.message as string);
      }
      if (message.includes('cannot submit')) {
        return createChoiceError('cannotsubmit', responseData.message as string);
      }
      if (message.includes('exceeded') || message.includes('full')) {
        return createChoiceError('choicesexceeded', responseData.message as string);
      }
      if (message.includes('not open') || message.includes('not yet')) {
        return createChoiceError('notopenyet', responseData.message as string);
      }
      if (message.includes('expired') || message.includes('closed')) {
        return createChoiceError('expired', responseData.message as string);
      }
    }
  }

  // Default error handling
  const message = error instanceof Error ? error.message : 'An unknown error occurred';
  return createChoiceError('cannotsubmit', message);
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetches choice activity details with options and configuration
 *
 * Makes a GET request to /api/v1/choices/{id} to retrieve the complete
 * choice activity data including all available options, their current
 * response counts, and configuration settings.
 *
 * Backend Reference: Wraps choice_get_choice() from public/mod/choice/lib.php
 * which fetches the choice record with all associated options.
 *
 * @param choiceId - The ID of the choice activity
 * @returns Promise resolving to choice data with options
 * @throws ChoiceApiError if the API request fails or choice not found
 *
 * @example
 * ```typescript
 * // Fetch choice details
 * const choice = await getChoice(42);
 * console.log(choice.name, choice.options);
 *
 * // Use with React Query
 * const { data: choice } = useQuery({
 *   queryKey: ['choice', choiceId],
 *   queryFn: () => getChoice(choiceId)
 * });
 * ```
 */
export async function getChoice(choiceId: number): Promise<ChoiceWithOptions> {
  try {
    const response = await apiClient.get<ApiResponse<ChoiceWithOptions>>(
      `/choices/${choiceId}`
    );

    return extractResponseData(response);
  } catch (error) {
    throw handleChoiceApiError(error);
  }
}

/**
 * Submits user response(s) to a choice activity
 *
 * Makes a POST request to /api/v1/choices/{id}/responses to submit
 * the user's selected option(s). Supports both single and multiple
 * choice selections based on the choice configuration.
 *
 * Backend Reference: Wraps choice_user_submit_response() from
 * public/mod/choice/lib.php which handles validation, limit checking,
 * and database operations for saving user responses.
 *
 * Error Codes:
 * - atleastoneoption: No options were selected
 * - multiplenotallowederror: Multiple options selected but not allowed
 * - cannotsubmit: Invalid option ID or submission not allowed
 * - choicesexceeded: Selected option has reached its response limit
 *
 * @param choiceId - The ID of the choice activity
 * @param answers - Array of option IDs to select (single or multiple)
 * @returns Promise resolving to submission result with answer IDs
 * @throws ChoiceApiError with specific code if submission fails
 *
 * @example
 * ```typescript
 * // Submit single choice
 * const result = await submitResponse(42, [1]);
 *
 * // Submit multiple choices (if allowed)
 * const result = await submitResponse(42, [1, 3, 5]);
 *
 * // Use with React Query mutation
 * const mutation = useMutation({
 *   mutationFn: ({ choiceId, answers }) => submitResponse(choiceId, answers),
 *   onSuccess: () => queryClient.invalidateQueries(['choice', choiceId])
 * });
 * ```
 */
export async function submitResponse(
  choiceId: number,
  answers: number[]
): Promise<SubmitChoiceResponse> {
  // Validate that at least one answer is provided
  if (!answers || answers.length === 0) {
    throw createChoiceError(
      'atleastoneoption',
      'At least one option must be selected'
    );
  }

  try {
    const payload: SubmitResponsePayload = { answers };

    const response = await apiClient.post<ApiResponse<SubmitChoiceResponse>>(
      `/choices/${choiceId}/responses`,
      payload
    );

    return extractResponseData(response);
  } catch (error) {
    throw handleChoiceApiError(error);
  }
}

/**
 * Retrieves choice results with response statistics
 *
 * Makes a GET request to /api/v1/choices/{id}/results to fetch
 * the aggregated results including response counts per option,
 * percentages, and optionally user details based on publish settings.
 *
 * Backend Reference: Wraps prepare_choice_show_results() and
 * choice_can_view_results() from public/mod/choice/lib.php to
 * check permissions and prepare result data.
 *
 * @param choiceId - The ID of the choice activity
 * @returns Promise resolving to choice results with statistics
 * @throws ChoiceApiError if results cannot be viewed
 *
 * @example
 * ```typescript
 * // Fetch results
 * const results = await getResults(42);
 * results.options.forEach(opt => {
 *   console.log(`${opt.text}: ${opt.numberofuser} responses (${opt.percentageamount}%)`);
 * });
 *
 * // Use with React Query
 * const { data: results } = useQuery({
 *   queryKey: ['choice-results', choiceId],
 *   queryFn: () => getResults(choiceId),
 *   enabled: canViewResults
 * });
 * ```
 */
export async function getResults(choiceId: number): Promise<ChoiceResults> {
  try {
    const response = await apiClient.get<ApiResponse<ChoiceResults>>(
      `/choices/${choiceId}/results`
    );

    return extractResponseData(response);
  } catch (error) {
    throw handleChoiceApiError(error);
  }
}

/**
 * Retrieves a specific user's response to a choice activity
 *
 * Makes a GET request to /api/v1/choices/{id}/responses/{userId} to fetch
 * the specified user's response(s) to the choice. Returns an array since
 * multiple-choice choices allow multiple responses per user.
 *
 * Backend Reference: Wraps choice_get_user_response() from
 * public/mod/choice/lib.php (line 881-884) which queries the
 * choice_answers table for the user's selections.
 *
 * @param choiceId - The ID of the choice activity
 * @param userId - The ID of the user whose response to fetch
 * @returns Promise resolving to array of user's responses
 * @throws ChoiceApiError if user response cannot be retrieved
 *
 * @example
 * ```typescript
 * // Fetch specific user's response
 * const responses = await getUserResponse(42, 15);
 * responses.forEach(response => {
 *   console.log(`Option ${response.optionid} selected at ${response.timemodified}`);
 * });
 *
 * // Use with React Query
 * const { data: responses } = useQuery({
 *   queryKey: ['choice-user-response', choiceId, userId],
 *   queryFn: () => getUserResponse(choiceId, userId)
 * });
 * ```
 */
export async function getUserResponse(
  choiceId: number,
  userId: number
): Promise<ChoiceResponse[]> {
  try {
    const response = await apiClient.get<ApiResponse<ChoiceResponse[]>>(
      `/choices/${choiceId}/responses/${userId}`
    );

    return extractResponseData(response);
  } catch (error) {
    throw handleChoiceApiError(error);
  }
}

/**
 * Retrieves the current user's response to a choice activity
 *
 * Makes a GET request to /api/v1/choices/{id}/responses/me to fetch
 * the current authenticated user's response(s). This is a convenience
 * method that doesn't require passing the user ID.
 *
 * Backend Reference: Wraps choice_get_my_response() from
 * public/mod/choice/lib.php (line 893-896) which internally calls
 * choice_get_user_response() with the current $USER->id.
 *
 * @param choiceId - The ID of the choice activity
 * @returns Promise resolving to array of current user's responses
 * @throws ChoiceApiError if response cannot be retrieved
 *
 * @example
 * ```typescript
 * // Check if current user has responded
 * const myResponses = await getMyResponse(42);
 * const hasResponded = myResponses.length > 0;
 *
 * // Get selected option IDs
 * const selectedOptions = myResponses.map(r => r.optionid);
 *
 * // Use with React Query
 * const { data: myResponse } = useQuery({
 *   queryKey: ['choice-my-response', choiceId],
 *   queryFn: () => getMyResponse(choiceId)
 * });
 * ```
 */
export async function getMyResponse(choiceId: number): Promise<ChoiceResponse[]> {
  try {
    const response = await apiClient.get<ApiResponse<ChoiceResponse[]>>(
      `/choices/${choiceId}/responses/me`
    );

    return extractResponseData(response);
  } catch (error) {
    throw handleChoiceApiError(error);
  }
}

/**
 * Deletes the current user's response from a choice activity
 *
 * Makes a DELETE request to /api/v1/choices/{id}/responses to remove
 * the current user's response(s) from the choice. This action is only
 * available if the choice allows response updates (allowupdate setting).
 *
 * Backend Reference: Wraps choice_delete_responses() from
 * public/mod/choice/lib.php (line 560-589) which handles deletion
 * from choice_answers table and completion state updates.
 *
 * @param choiceId - The ID of the choice activity
 * @returns Promise resolving to void on successful deletion
 * @throws ChoiceApiError if deletion is not allowed or fails
 *
 * @example
 * ```typescript
 * // Delete current user's response
 * await deleteResponse(42);
 *
 * // Use with React Query mutation
 * const mutation = useMutation({
 *   mutationFn: (choiceId: number) => deleteResponse(choiceId),
 *   onSuccess: () => {
 *     queryClient.invalidateQueries(['choice-my-response', choiceId]);
 *     queryClient.invalidateQueries(['choice-results', choiceId]);
 *   }
 * });
 * ```
 */
export async function deleteResponse(choiceId: number): Promise<void> {
  try {
    await apiClient.delete<ApiResponse<null>>(
      `/choices/${choiceId}/responses`
    );
  } catch (error) {
    throw handleChoiceApiError(error);
  }
}

/**
 * Retrieves detailed response data for a choice activity
 *
 * Makes a GET request to /api/v1/choices/{id}/response-data to fetch
 * comprehensive response data including user details, group memberships,
 * and response timestamps. Supports filtering by group.
 *
 * Backend Reference: Wraps choice_get_response_data() from
 * public/mod/choice/lib.php (line 769-822) which builds a matrix of
 * responses: allresponses[optionid][userid] = responseobject.
 *
 * @param choiceId - The ID of the choice activity
 * @param options - Optional filtering parameters
 * @returns Promise resolving to detailed response data
 * @throws ChoiceApiError if data cannot be retrieved
 *
 * @example
 * ```typescript
 * // Fetch all response data
 * const data = await getResponseData(42);
 *
 * // Fetch response data for a specific group
 * const groupData = await getResponseData(42, { groupId: 5 });
 *
 * // Exclude inactive users (default behavior)
 * const activeData = await getResponseData(42, { onlyActive: true });
 *
 * // Use with React Query
 * const { data } = useQuery({
 *   queryKey: ['choice-response-data', choiceId, groupId],
 *   queryFn: () => getResponseData(choiceId, { groupId })
 * });
 * ```
 */
export async function getResponseData(
  choiceId: number,
  options?: GetResponseDataOptions
): Promise<ChoiceResultsResponse> {
  try {
    // Build query parameters
    const params: Record<string, string | number> = {};

    if (options?.groupId !== undefined && options.groupId > 0) {
      params.groupId = options.groupId;
    }

    if (options?.onlyActive !== undefined) {
      params.onlyActive = options.onlyActive ? 1 : 0;
    }

    const response = await apiClient.get<ApiResponse<ChoiceResultsResponse>>(
      `/choices/${choiceId}/response-data`,
      { params }
    );

    return extractResponseData(response);
  } catch (error) {
    throw handleChoiceApiError(error);
  }
}

/**
 * Checks if a choice activity is available for the current user
 *
 * Makes a GET request to /api/v1/choices/{id}/availability to determine
 * if the choice is currently open for responses, considering time
 * restrictions, existing responses, and update permissions.
 *
 * Backend Reference: Wraps choice_get_availability_status() from
 * public/mod/choice/lib.php (line 985-1005) which checks timeopen,
 * timeclose, allowupdate, and existing user responses.
 *
 * Warning Types:
 * - notopenyet: Choice has not opened yet (includes open timestamp)
 * - expired: Choice has closed (includes close timestamp)
 * - choicesaved: User has already responded and updates not allowed
 * - previewonly: Choice is in preview mode before opening
 *
 * @param choiceId - The ID of the choice activity
 * @returns Promise resolving to availability status with warnings
 * @throws ChoiceApiError if status cannot be determined
 *
 * @example
 * ```typescript
 * // Check availability before showing choice form
 * const status = await getAvailabilityStatus(42);
 * if (status.available) {
 *   // Show choice options
 * } else {
 *   // Show warning messages
 *   status.warnings.forEach(w => console.log(w.message));
 * }
 *
 * // Use with React Query
 * const { data: status } = useQuery({
 *   queryKey: ['choice-availability', choiceId],
 *   queryFn: () => getAvailabilityStatus(choiceId),
 *   staleTime: 60000 // Refresh every minute
 * });
 *
 * // Check specific conditions
 * if (status.isPreview) {
 *   console.log('Choice opens at:', new Date(status.timeOpen * 1000));
 * }
 * ```
 */
export async function getAvailabilityStatus(
  choiceId: number
): Promise<ChoiceAvailabilityStatus> {
  try {
    const response = await apiClient.get<ApiResponse<ChoiceAvailabilityStatus>>(
      `/choices/${choiceId}/availability`
    );

    return extractResponseData(response);
  } catch (error) {
    throw handleChoiceApiError(error);
  }
}

// ============================================================================
// HOOK-COMPATIBLE WRAPPER FUNCTIONS
// ============================================================================

/**
 * Options for fetching choice results with user response data
 * Compatible with the useChoiceResults hook parameter expectations
 */
export interface GetChoiceResultsOptions {
  /** Optional group ID to filter responses by group */
  groupId?: number;
  /** Whether to include responses from inactive users (default: false) */
  includeinactive?: boolean;
}

/**
 * Retrieves detailed choice results with user response data
 *
 * This is a hook-compatible wrapper around getResponseData that provides
 * the parameter interface expected by the useChoiceResults hook.
 *
 * Makes a GET request to /api/v1/choices/{id}/response-data to fetch
 * comprehensive results including user responses with full details,
 * group memberships, selected options, and response timestamps.
 *
 * Backend Reference: Wraps choice_get_response_data() and
 * choice_get_all_responses() from public/mod/choice/lib.php.
 *
 * @param choiceId - The ID of the choice activity
 * @param options - Optional filtering options
 * @param options.groupId - Optional group ID to filter responses
 * @param options.includeinactive - Whether to include inactive users (default: false)
 * @returns Promise resolving to choice results response with user data
 * @throws ChoiceApiError if results cannot be retrieved
 *
 * @example
 * ```typescript
 * // Fetch all results (active users only)
 * const results = await getChoiceResults(42);
 *
 * // Fetch results including inactive users
 * const results = await getChoiceResults(42, { includeinactive: true });
 *
 * // Fetch results for a specific group
 * const groupResults = await getChoiceResults(42, { groupId: 5 });
 *
 * // Use with React Query
 * const { data } = useQuery({
 *   queryKey: ['choice-results', choiceId, groupId],
 *   queryFn: () => getChoiceResults(choiceId, { groupId })
 * });
 * ```
 */
export async function getChoiceResults(
  choiceId: number,
  options?: GetChoiceResultsOptions
): Promise<ChoiceResultsResponse> {
  // Transform includeinactive to onlyActive (inverse logic)
  // includeinactive=true means onlyActive=false
  // includeinactive=false (or undefined) means onlyActive=true
  const transformedOptions: GetResponseDataOptions = {};

  if (options?.groupId !== undefined) {
    transformedOptions.groupId = options.groupId;
  }

  if (options?.includeinactive !== undefined) {
    // Invert the logic: includeinactive is the opposite of onlyActive
    transformedOptions.onlyActive = !options.includeinactive;
  }

  // Use the existing getResponseData function
  return getResponseData(choiceId, transformedOptions);
}

// ============================================================================
// RE-EXPORTS FOR CONVENIENCE
// ============================================================================

/**
 * Re-export types that consumers of this API module commonly need
 */
export type {
  Choice,
  ChoiceOption,
  ChoiceResponse,
  ChoiceResults,
  ChoiceResultsResponse,
  ChoiceOptionResult,
  ChoiceOptionForDisplay,
  SubmitChoiceResponse,
  UserResponse,
  ChoiceUserResponse,
} from '../types/choice.types';
