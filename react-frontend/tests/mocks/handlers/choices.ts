/**
 * MSW Request Handlers for Choice API Endpoints
 * 
 * This file provides Mock Service Worker (MSW) handlers for choice activity
 * API endpoints, enabling isolated frontend testing without backend dependencies.
 * 
 * Handlers include:
 * - GET /api/v1/choices/:id/results - Get detailed choice response data
 * 
 * @package    react-frontend
 * @subpackage tests/mocks/handlers
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { http, HttpResponse } from 'msw';

// ============================================================================
// TypeScript Type Definitions
// ============================================================================

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

// ============================================================================
// Mock Data
// ============================================================================

/**
 * Mock choice results data for testing
 * Keyed by choice ID
 */
const MOCK_CHOICE_RESULTS: Record<number, ChoiceResultsResponse> = {
  42: {
    responses: [
      {
        id: 1,
        firstname: 'John',
        lastname: 'Doe',
        email: 'john.doe@example.com',
        idnumber: 'STU001',
        department: 'Computer Science',
        institution: 'Example University',
        phone1: '+1-555-0001',
        phone2: '',
        city: 'New York',
        country: 'US',
        groups: [
          { id: 1, name: 'Group A' },
          { id: 3, name: 'Section 101' }
        ],
        selectedOptions: [
          { id: 1, text: 'Option 1', maxanswers: 30 }
        ],
        timemodified: 1699564800,
        answerid: 101
      },
      {
        id: 2,
        firstname: 'Jane',
        lastname: 'Smith',
        email: 'jane.smith@example.com',
        idnumber: 'STU002',
        department: 'Mathematics',
        institution: 'Example University',
        phone1: '+1-555-0002',
        city: 'Boston',
        country: 'US',
        groups: [
          { id: 2, name: 'Group B' }
        ],
        selectedOptions: [
          { id: 2, text: 'Option 2', maxanswers: 25 }
        ],
        timemodified: 1699651200,
        answerid: 102
      },
      {
        id: 3,
        firstname: 'Bob',
        lastname: 'Johnson',
        email: 'bob.johnson@example.com',
        idnumber: 'STU003',
        department: 'Physics',
        institution: 'Example University',
        groups: [
          { id: 1, name: 'Group A' }
        ],
        selectedOptions: [
          { id: 1, text: 'Option 1', maxanswers: 30 }
        ],
        timemodified: 1699737600,
        answerid: 103
      },
      {
        id: 4,
        firstname: 'Alice',
        lastname: 'Williams',
        email: 'alice.williams@example.com',
        idnumber: 'STU004',
        groups: [
          { id: 2, name: 'Group B' }
        ],
        selectedOptions: [
          { id: 3, text: 'Option 3' }
        ],
        timemodified: 1699824000,
        answerid: 104
      }
    ],
    totalCount: 4,
    choiceId: 42,
    includeinactive: false
  },
  100: {
    responses: [
      {
        id: 10,
        firstname: 'Test',
        lastname: 'User',
        email: 'test@example.com',
        groups: [],
        selectedOptions: [
          { id: 1, text: 'Yes' }
        ],
        timemodified: 1699564800,
        answerid: 200
      }
    ],
    totalCount: 1,
    choiceId: 100,
    includeinactive: false
  },
  999: {
    responses: [],
    totalCount: 0,
    choiceId: 999,
    includeinactive: false
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Filters responses by group ID
 * @param responses - Array of user responses
 * @param groupId - Group ID to filter by
 * @returns Filtered array of responses
 */
function filterByGroup(responses: UserResponseData[], groupId: number): UserResponseData[] {
  return responses.filter(response =>
    response.groups.some(group => group.id === groupId)
  );
}

/**
 * Filters responses by active/inactive status
 * In a real system, this would check user status from the database.
 * For testing, we'll assume all mock users are active.
 * @param responses - Array of user responses
 * @param includeinactive - Whether to include inactive users
 * @returns Filtered array of responses
 */
function filterByActiveStatus(responses: UserResponseData[], _includeinactive: boolean): UserResponseData[] {
  // In mock data, we'll assume all users are active
  // If we wanted to test inactive users, we could add a property to UserResponseData
  return responses;
}

// ============================================================================
// MSW Request Handlers
// ============================================================================

/**
 * GET /api/v1/choices/:id/results
 * Fetch detailed choice results with user responses
 * 
 * Query parameters:
 * - groupId (optional): Filter responses by group ID
 * - includeinactive (optional): Include inactive users (0 or 1)
 */
 
const getChoiceResultsHandler = http.get('*/api/v1/choices/:id/results', async ({ params, request }) => {
  console.log('[MSW Handler] getChoiceResultsHandler called with params:', params, 'URL:', request.url);
  
  // Temporarily disable network delay for debugging
  // await simulateNetworkDelay();
  
  const choiceId = Number(params.id);
  const url = new URL(request.url);
  const groupIdParam = url.searchParams.get('groupId');
  const includeinactiveParam = url.searchParams.get('includeinactive');
  
  const groupId = groupIdParam ? Number(groupIdParam) : undefined;
  const includeinactive = includeinactiveParam === '1';
  
  console.log('[MSW Handler] choiceId:', choiceId, 'groupId:', groupId, 'includeinactive:', includeinactive);
  
  // Check if choice exists
  const results = MOCK_CHOICE_RESULTS[choiceId];
  
  console.log('[MSW Handler] results found:', !!results);
  
  if (!results) {
    console.log('[MSW Handler] Returning 404 error');
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'CHOICE_NOT_FOUND',
          message: `Choice activity with ID ${choiceId} not found`,
          details: { choiceId }
        }
      },
      { status: 404 }
    );
  }
  
  // Clone the results to avoid mutating the mock data
  let responses = [...results.responses];
  
  // Apply group filter if specified
  if (groupId !== undefined && groupId > 0) {
    responses = filterByGroup(responses, groupId);
  }
  
  // Apply active status filter
  responses = filterByActiveStatus(responses, includeinactive);
  
  // Construct filtered response
  const filteredResults: ChoiceResultsResponse = {
    responses,
    totalCount: responses.length,
    choiceId,
    groupId,
    includeinactive
  };
  
  return HttpResponse.json({
    success: true,
    data: filteredResults
  });
});

// ============================================================================
// Export Handlers
// ============================================================================

/**
 * Array of all choice-related MSW request handlers
 * 
 * Usage in test setup:
 * ```typescript
 * import { choicesHandlers } from './mocks/handlers/choices';
 * 
 * const server = setupServer(...choicesHandlers);
 * 
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 */
export const choicesHandlers = [
  getChoiceResultsHandler,
];
