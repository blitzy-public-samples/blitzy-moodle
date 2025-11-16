/**
 * MSW Request Handlers for H5P Activity API Endpoints
 * 
 * This file provides Mock Service Worker (MSW) handlers for H5P activity
 * API endpoints, enabling isolated frontend testing without backend dependencies.
 * 
 * Handlers include:
 * - POST /api/v1/h5p/attempts - Get H5P attempts (admin/teacher view)
 * - POST /api/v1/h5p/user-attempts - Get H5P attempts for specific users
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
 * Individual H5P attempt data
 */
interface H5PAttemptData {
  /** Attempt ID */
  id: number;
  /** H5P activity ID */
  h5pactivityid: number;
  /** User ID who made the attempt */
  userid: number;
  /** User's first name */
  firstname: string;
  /** User's last name */
  lastname: string;
  /** User's email */
  email: string;
  /** Attempt number for this user */
  attempt: number;
  /** Raw score achieved (can be null if not graded) */
  rawscore: number | null;
  /** Maximum possible score */
  maxscore: number;
  /** Scaled score (0.0 to 1.0) */
  scaled: number | null;
  /** Duration in seconds */
  duration: number;
  /** Completion status: 'completed', 'incomplete', 'not attempted' */
  completion: string;
  /** Success status: 'passed', 'failed', null */
  success: string | null;
  /** Timestamp when attempt was created */
  timecreated: number;
  /** Timestamp when attempt was last modified */
  timemodified: number;
}

/**
 * Complete H5P attempts response from the API
 */
interface H5PAttemptsResponse {
  /** Array of H5P attempts */
  attempts: H5PAttemptData[];
  /** Total count of attempts matching filters */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  perPage: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Request parameters for H5P attempts endpoint
 */
interface H5PAttemptsRequestParams {
  /** H5P activity ID */
  activityId: number;
  /** User IDs to filter by (optional) */
  userIds?: number[];
  /** Page number for pagination */
  page?: number;
  /** Items per page */
  perPage?: number;
  /** Sort field */
  sortBy?: 'attempt' | 'timecreated' | 'score';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Filter by first name initial */
  firstInitial?: string;
  /** Filter by last name initial */
  lastInitial?: string;
}

// ============================================================================
// Mock Data
// ============================================================================

/**
 * Mock H5P attempts data for testing
 * Keyed by activity ID
 */
const MOCK_H5P_ATTEMPTS: Record<number, H5PAttemptData[]> = {
  1: [
    {
      id: 101,
      h5pactivityid: 1,
      userid: 1,
      firstname: 'John',
      lastname: 'Doe',
      email: 'john.doe@example.com',
      attempt: 1,
      rawscore: 85,
      maxscore: 100,
      scaled: 0.85,
      duration: 300,
      completion: 'completed',
      success: 'passed',
      timecreated: 1699564800,
      timemodified: 1699565100
    },
    {
      id: 102,
      h5pactivityid: 1,
      userid: 2,
      firstname: 'Jane',
      lastname: 'Smith',
      email: 'jane.smith@example.com',
      attempt: 1,
      rawscore: 92,
      maxscore: 100,
      scaled: 0.92,
      duration: 450,
      completion: 'completed',
      success: 'passed',
      timecreated: 1699651200,
      timemodified: 1699651650
    },
    {
      id: 103,
      h5pactivityid: 1,
      userid: 3,
      firstname: 'Bob',
      lastname: 'Johnson',
      email: 'bob.johnson@example.com',
      attempt: 1,
      rawscore: 58,
      maxscore: 100,
      scaled: 0.58,
      duration: 200,
      completion: 'completed',
      success: 'failed',
      timecreated: 1699737600,
      timemodified: 1699737800
    },
    {
      id: 104,
      h5pactivityid: 1,
      userid: 3,
      firstname: 'Bob',
      lastname: 'Johnson',
      email: 'bob.johnson@example.com',
      attempt: 2,
      rawscore: 78,
      maxscore: 100,
      scaled: 0.78,
      duration: 350,
      completion: 'completed',
      success: 'passed',
      timecreated: 1699824000,
      timemodified: 1699824350
    },
    {
      id: 105,
      h5pactivityid: 1,
      userid: 4,
      firstname: 'Alice',
      lastname: 'Williams',
      email: 'alice.williams@example.com',
      attempt: 1,
      rawscore: null,
      maxscore: 100,
      scaled: null,
      duration: 120,
      completion: 'incomplete',
      success: null,
      timecreated: 1699910400,
      timemodified: 1699910520
    },
    {
      id: 106,
      h5pactivityid: 1,
      userid: 5,
      firstname: 'Charlie',
      lastname: 'Brown',
      email: 'charlie.brown@example.com',
      attempt: 1,
      rawscore: 95,
      maxscore: 100,
      scaled: 0.95,
      duration: 400,
      completion: 'completed',
      success: 'passed',
      timecreated: 1699996800,
      timemodified: 1699997200
    }
  ],
  2: [
    {
      id: 201,
      h5pactivityid: 2,
      userid: 1,
      firstname: 'John',
      lastname: 'Doe',
      email: 'john.doe@example.com',
      attempt: 1,
      rawscore: 70,
      maxscore: 100,
      scaled: 0.70,
      duration: 250,
      completion: 'completed',
      success: 'passed',
      timecreated: 1700083200,
      timemodified: 1700083450
    }
  ],
  999: []
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Simulates network delay for realistic testing
 * @param min - Minimum delay in milliseconds (default: 50)
 * @param max - Maximum delay in milliseconds (default: 150)
 */
async function simulateNetworkDelay(min = 50, max = 150): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Filters attempts by user IDs
 * @param attempts - Array of H5P attempts
 * @param userIds - Array of user IDs to filter by
 * @returns Filtered array of attempts
 */
function filterByUserIds(attempts: H5PAttemptData[], userIds: number[]): H5PAttemptData[] {
  if (!userIds || userIds.length === 0) {
    return attempts;
  }
  return attempts.filter(attempt => userIds.includes(attempt.userid));
}

/**
 * Filters attempts by first name initial
 * @param attempts - Array of H5P attempts
 * @param initial - First name initial to filter by
 * @returns Filtered array of attempts
 */
function filterByFirstInitial(attempts: H5PAttemptData[], initial: string): H5PAttemptData[] {
  if (!initial) {
    return attempts;
  }
  return attempts.filter(attempt =>
    attempt.firstname.toUpperCase().startsWith(initial.toUpperCase())
  );
}

/**
 * Filters attempts by last name initial
 * @param attempts - Array of H5P attempts
 * @param initial - Last name initial to filter by
 * @returns Filtered array of attempts
 */
function filterByLastInitial(attempts: H5PAttemptData[], initial: string): H5PAttemptData[] {
  if (!initial) {
    return attempts;
  }
  return attempts.filter(attempt =>
    attempt.lastname.toUpperCase().startsWith(initial.toUpperCase())
  );
}

/**
 * Sorts attempts by specified field and order
 * @param attempts - Array of H5P attempts
 * @param sortBy - Field to sort by
 * @param sortOrder - Sort order (asc or desc)
 * @returns Sorted array of attempts
 */
function sortAttempts(
  attempts: H5PAttemptData[],
  sortBy: 'attempt' | 'timecreated' | 'score' = 'timecreated',
  sortOrder: 'asc' | 'desc' = 'desc'
): H5PAttemptData[] {
  const sorted = [...attempts].sort((a, b) => {
    let aValue: number;
    let bValue: number;

    switch (sortBy) {
      case 'attempt':
        aValue = a.attempt;
        bValue = b.attempt;
        break;
      case 'score':
        aValue = a.scaled ?? -1;
        bValue = b.scaled ?? -1;
        break;
      case 'timecreated':
      default:
        aValue = a.timecreated;
        bValue = b.timecreated;
        break;
    }

    if (sortOrder === 'asc') {
      return aValue - bValue;
    } 
      return bValue - aValue;
    
  });

  return sorted;
}

/**
 * Paginates attempts array
 * @param attempts - Array of H5P attempts
 * @param page - Page number (1-indexed)
 * @param perPage - Items per page
 * @returns Paginated array of attempts
 */
function paginateAttempts(
  attempts: H5PAttemptData[],
  page: number,
  perPage: number
): H5PAttemptData[] {
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  return attempts.slice(startIndex, endIndex);
}

// ============================================================================
// MSW Request Handlers
// ============================================================================

/**
 * POST /api/v1/h5p/attempts
 * Fetch H5P attempts for an activity (admin/teacher view)
 * 
 * Request body contains filtering, sorting, and pagination parameters
 */
const getH5PAttemptsHandler = http.post('*/api/v1/h5p/attempts', async ({ request }) => {
  await simulateNetworkDelay();

  let params: H5PAttemptsRequestParams;
  try {
    params = await request.json() as H5PAttemptsRequestParams;
  } catch (error) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          details: {}
        }
      },
      { status: 400 }
    );
  }

  const {
    activityId,
    userIds,
    page = 1,
    perPage = 20,
    sortBy = 'timecreated',
    sortOrder = 'desc',
    firstInitial,
    lastInitial
  } = params;

  // Validate activityId
  if (!activityId || typeof activityId !== 'number') {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_ACTIVITY_ID',
          message: 'Activity ID is required and must be a number',
          details: { activityId }
        }
      },
      { status: 400 }
    );
  }

  // Get attempts for the activity
  let attempts = MOCK_H5P_ATTEMPTS[activityId];

  if (!attempts) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'ACTIVITY_NOT_FOUND',
          message: `H5P activity with ID ${activityId} not found`,
          details: { activityId }
        }
      },
      { status: 404 }
    );
  }

  // Apply filters
  attempts = filterByUserIds(attempts, userIds || []);
  attempts = filterByFirstInitial(attempts, firstInitial || '');
  attempts = filterByLastInitial(attempts, lastInitial || '');

  // Apply sorting
  attempts = sortAttempts(attempts, sortBy, sortOrder);

  // Calculate pagination
  const total = attempts.length;
  const totalPages = Math.ceil(total / perPage);

  // Apply pagination
  const paginatedAttempts = paginateAttempts(attempts, page, perPage);

  // Construct response
  const response: H5PAttemptsResponse = {
    attempts: paginatedAttempts,
    total,
    page,
    perPage,
    totalPages
  };

  return HttpResponse.json({
    success: true,
    data: response
  });
});

/**
 * POST /api/v1/h5p/user-attempts
 * Fetch H5P attempts for specific users (student view)
 * 
 * Request body contains filtering, sorting, and pagination parameters
 */
const getH5PUserAttemptsHandler = http.post('*/api/v1/h5p/user-attempts', async ({ request }) => {
  await simulateNetworkDelay();

  let params: H5PAttemptsRequestParams;
  try {
    params = await request.json() as H5PAttemptsRequestParams;
  } catch (error) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          details: {}
        }
      },
      { status: 400 }
    );
  }

  const {
    activityId,
    userIds,
    page = 1,
    perPage = 20,
    sortBy = 'timecreated',
    sortOrder = 'desc',
    firstInitial,
    lastInitial
  } = params;

  // Validate activityId
  if (!activityId || typeof activityId !== 'number') {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_ACTIVITY_ID',
          message: 'Activity ID is required and must be a number',
          details: { activityId }
        }
      },
      { status: 400 }
    );
  }

  // Get attempts for the activity
  let attempts = MOCK_H5P_ATTEMPTS[activityId];

  if (!attempts) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'ACTIVITY_NOT_FOUND',
          message: `H5P activity with ID ${activityId} not found`,
          details: { activityId }
        }
      },
      { status: 404 }
    );
  }

  // Apply filters
  attempts = filterByUserIds(attempts, userIds || []);
  attempts = filterByFirstInitial(attempts, firstInitial || '');
  attempts = filterByLastInitial(attempts, lastInitial || '');

  // Apply sorting
  attempts = sortAttempts(attempts, sortBy, sortOrder);

  // Calculate pagination
  const total = attempts.length;
  const totalPages = Math.ceil(total / perPage);

  // Apply pagination
  const paginatedAttempts = paginateAttempts(attempts, page, perPage);

  // Construct response
  const response: H5PAttemptsResponse = {
    attempts: paginatedAttempts,
    total,
    page,
    perPage,
    totalPages
  };

  return HttpResponse.json({
    success: true,
    data: response
  });
});

// ============================================================================
// Export Handlers
// ============================================================================

/**
 * Array of all H5P-related MSW request handlers
 * 
 * Usage in test setup:
 * ```typescript
 * import { h5pHandlers } from './mocks/handlers/h5p';
 * 
 * const server = setupServer(...h5pHandlers);
 * 
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 */
export const h5pHandlers = [
  getH5PAttemptsHandler,
  getH5PUserAttemptsHandler,
];
