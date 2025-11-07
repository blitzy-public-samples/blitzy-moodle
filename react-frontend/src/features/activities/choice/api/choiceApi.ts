/**
 * Choice Activity API Module
 *
 * Provides API functions for choice activities including results fetching,
 * response submission, and choice analytics. All functions call the backend API
 * layer which wraps existing Moodle choice functions.
 *
 * @package    react-frontend
 * @subpackage features/activities/choice/api
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 *
 * API Endpoints:
 * - GET    /api/v1/choices/{id}             - Get choice details
 * - GET    /api/v1/choices/{id}/results     - Get choice results
 * - POST   /api/v1/choices/{id}/respond     - Submit choice response
 * - DELETE /api/v1/choices/{id}/respond     - Delete choice response
 *
 * Backend References:
 * - public/mod/choice/lib.php (choice_get_choice, choice_user_submit_response)
 * - public/mod/choice/classes/local/choice.php
 */

import { apiClient } from '@/services/api/client';
import type { ApiResponse } from '@/types/api';
import type { ChoiceResultsResponse } from '../types/choice.types';

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
  includeinactive?: boolean;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetches detailed choice results and response data
 *
 * Makes a GET request to /api/v1/choices/{id}/results with optional
 * query parameters for group filtering and inactive user inclusion.
 *
 * @param choiceId - The ID of the choice activity
 * @param options - Optional parameters for filtering results
 * @returns Promise resolving to choice results data
 * @throws Error if the API request fails
 *
 * @example
 * ```typescript
 * // Fetch all results
 * const results = await getChoiceResults(42);
 *
 * // Fetch results for a specific group
 * const groupResults = await getChoiceResults(42, { groupId: 5 });
 *
 * // Fetch results including inactive users
 * const allResults = await getChoiceResults(42, { includeinactive: true });
 * ```
 */
export async function getChoiceResults(
  choiceId: number,
  options?: GetChoiceResultsOptions
): Promise<ChoiceResultsResponse> {
  // Build query parameters
  const params = new URLSearchParams();
  
  if (options?.groupId !== undefined && options.groupId > 0) {
    params.append('groupId', options.groupId.toString());
  }
  
  if (options?.includeinactive !== undefined) {
    params.append('includeinactive', options.includeinactive ? '1' : '0');
  }

  // Make API request using the configured apiClient
  // The apiClient handles base URL resolution, authentication headers, and error handling
  const response = await apiClient.get<ApiResponse<ChoiceResultsResponse>>(
    `/choices/${choiceId}/results`,
    { params }
  );

  // Extract and return data from the standard API response envelope
  if (response.data.success && response.data.data) {
    return response.data.data;
  }

  // Handle application-level errors
  throw new Error(
    response.data.error?.message || 'Failed to fetch choice results'
  );
}
