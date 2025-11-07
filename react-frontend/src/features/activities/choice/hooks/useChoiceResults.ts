import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getChoiceResults } from '../api/choiceApi';

/**
 * Parameters for fetching choice results
 */
interface UseChoiceResultsParams {
  /** The ID of the choice activity */
  choiceId: number;
  /** Optional group ID to filter responses by group */
  groupId?: number;
  /** Whether to include responses from inactive users (default: false) */
  includeinactive?: boolean;
}

/**
 * Group information for a user
 */
interface UserGroup {
  /** Group ID */
  id: number;
  /** Group name */
  name: string;
}

/**
 * Choice option that was selected by a user
 */
interface SelectedOption {
  /** Option ID */
  id: number;
  /** Option text/description */
  text: string;
  /** Maximum number of answers allowed for this option (if limited) */
  maxanswers?: number;
}

/**
 * Individual user response data with full details
 */
interface UserResponseData {
  /** User ID */
  id: number;
  /** User's first name */
  firstname: string;
  /** User's last name */
  lastname: string;
  /** User's email address */
  email?: string;
  /** User's ID number */
  idnumber?: string;
  /** User's department */
  department?: string;
  /** User's institution */
  institution?: string;
  /** User's phone number */
  phone1?: string;
  /** User's alternate phone number */
  phone2?: string;
  /** User's city */
  city?: string;
  /** User's country code */
  country?: string;
  /** Groups the user belongs to */
  groups: UserGroup[];
  /** Options selected by the user */
  selectedOptions: SelectedOption[];
  /** Timestamp when the response was last modified */
  timemodified: number;
  /** Answer ID for tracking purposes */
  answerid?: number;
}

/**
 * Complete choice results response from the API
 */
interface ChoiceResultsResponse {
  /** Array of all user responses with comprehensive details */
  responses: UserResponseData[];
  /** Total count of responses */
  totalCount: number;
  /** The choice activity ID */
  choiceId: number;
  /** The group ID used for filtering (if applicable) */
  groupId?: number;
  /** Whether inactive users are included in results */
  includeinactive: boolean;
}

/**
 * Fetches detailed choice results data from the API
 * 
 * Makes a GET request to /api/v1/choices/{id}/results with optional
 * query parameters for group filtering and inactive user inclusion.
 * This function is a simple wrapper around the choiceApi getChoiceResults
 * function to maintain compatibility with the hook's query function signature.
 * 
 * @param choiceId - The ID of the choice activity
 * @param groupId - Optional group ID to filter responses
 * @param includeinactive - Whether to include responses from inactive users
 * @returns Promise resolving to choice results response
 * @throws Error if the API request fails or returns an error
 */
async function fetchChoiceResults(
  choiceId: number,
  groupId?: number,
  includeinactive?: boolean
): Promise<ChoiceResultsResponse> {
  // Call the API function with proper options structure
  return getChoiceResults(choiceId, {
    groupId,
    includeinactive,
  });
}

/**
 * React Query hook for fetching detailed choice results and response data
 * 
 * Retrieves comprehensive results including user responses with full details,
 * group memberships, selected options, and response timestamps. Supports
 * filtering by group and inclusion of inactive users.
 * 
 * The hook uses React Query for efficient data fetching, caching, and
 * automatic refetching. Results are cached for 2 minutes (staleTime) to
 * balance data freshness with server load for frequently changing data.
 * 
 * @param params - Parameters for fetching choice results
 * @param params.choiceId - The ID of the choice activity (required, must be > 0)
 * @param params.groupId - Optional group ID to filter responses by specific group
 * @param params.includeinactive - Whether to include responses from inactive users (default: false)
 * 
 * @returns UseQueryResult with choice results data and query state
 * 
 * @example
 * Basic usage - fetch all active users' responses:
 * ```typescript
 * const { data, isLoading, error } = useChoiceResults({
 *   choiceId: 42
 * });
 * 
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 * 
 * return (
 *   <div>
 *     <h2>Total Responses: {data.totalCount}</h2>
 *     {data.responses.map(response => (
 *       <UserResponseCard key={response.id} response={response} />
 *     ))}
 *   </div>
 * );
 * ```
 * 
 * @example
 * Filter by group and include inactive users:
 * ```typescript
 * const { data, isLoading } = useChoiceResults({
 *   choiceId: 42,
 *   groupId: 5,
 *   includeinactive: true
 * });
 * ```
 * 
 * @example
 * Access specific fields from responses:
 * ```typescript
 * const { data } = useChoiceResults({ choiceId: 42 });
 * 
 * data?.responses.forEach(response => {
 *   console.log(`${response.firstname} ${response.lastname}`);
 *   console.log(`Groups: ${response.groups.map(g => g.name).join(', ')}`);
 *   console.log(`Selected: ${response.selectedOptions.map(o => o.text).join(', ')}`);
 *   console.log(`Modified: ${new Date(response.timemodified * 1000).toLocaleString()}`);
 * });
 * ```
 */
function useChoiceResults({
  choiceId,
  groupId,
  includeinactive = false,
}: UseChoiceResultsParams): UseQueryResult<ChoiceResultsResponse, Error> {
  return useQuery<ChoiceResultsResponse, Error>({
    // Query key includes all parameters that affect the data
    // This ensures proper cache isolation for different parameter combinations
    queryKey: ['choices', choiceId, 'results', { groupId, includeinactive }],
    
    // Query function that fetches the data
    queryFn: () => fetchChoiceResults(choiceId, groupId, includeinactive),
    
    // Cache data for 2 minutes (120,000 ms)
    // Results data changes frequently as users submit responses
    // 2 minutes balances freshness with reduced server load
    staleTime: 2 * 60 * 1000,
    
    // Only run the query if choiceId is valid
    // Prevents unnecessary API calls with invalid IDs
    enabled: !!choiceId && choiceId > 0,
    
    // Retry failed requests up to 2 times
    // Helps handle transient network issues
    retry: 2,
    
    // Exponential backoff for retries
    // Delays: 1s, 2s, capped at 30s
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    
    // Refetch on window focus to keep data fresh
    // Useful when user returns to the tab
    refetchOnWindowFocus: true,
  });
}

export default useChoiceResults;
