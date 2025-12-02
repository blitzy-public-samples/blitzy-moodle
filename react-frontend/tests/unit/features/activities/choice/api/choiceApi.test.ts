/**
 * Choice Activity API Client Unit Tests
 *
 * Comprehensive unit tests for the Choice activity API integration module
 * validating API client methods for choice operations including getChoice,
 * submitResponse, deleteResponse, getResults, getResponseData, getUserResponse,
 * getMyResponse, and getAvailabilityStatus.
 *
 * Tests verify:
 * - Proper HTTP requests to /api/v1/choices endpoints
 * - Response transformations from PHP backend format to TypeScript interfaces
 * - Error handling for permission denied (403), validation errors, and network issues
 * - Request payload formatting
 * - Integration with React Query patterns for caching and state management
 *
 * Test runner: Vitest
 * API mocking: MSW (Mock Service Worker)
 * TypeScript: Strict mode compliance with zero 'any' types
 *
 * @module tests/unit/features/activities/choice/api/choiceApi.test
 * @see {@link react-frontend/src/features/activities/choice/api/choiceApi.ts}
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@tests/mocks/server';
import {
  getChoice,
  submitResponse,
  deleteResponse,
  getResults,
  getResponseData,
  getUserResponse,
  getMyResponse,
  getAvailabilityStatus,
  getChoiceResults,
  type ChoiceWithOptions,
  type ChoiceAvailabilityStatus,
} from '@/features/activities/choice/api/choiceApi';
import type {
  Choice,
  ChoiceOption,
  ChoiceResponse,
  ChoiceResults,
  ChoiceResultsResponse,
  SubmitChoiceResponse,
  ChoiceOptionResult,
  UserResponse,
  ChoiceUserResponse,
} from '@/features/activities/choice/types/choice.types';

// ============================================================================
// TEST CONSTANTS
// ============================================================================

/**
 * API base URL for MSW handler matching.
 * Uses wildcard prefix to match any origin (e.g., http://localhost:8000/api/v1).
 * This is necessary because vitest.config.ts sets VITE_API_BASE_URL to the full URL,
 * and MSW needs to match the complete URL that axios requests.
 */
const API_BASE_URL = '*/api/v1';

/**
 * Standard API response envelope factory
 */
function createApiResponse<T>(data: T, success = true): { success: boolean; data: T } {
  return { success, data };
}

/**
 * Standard API error response factory
 */
function createApiError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): { success: false; error: { code: string; message: string; details?: Record<string, unknown> } } {
  return {
    success: false,
    error: { code, message, details },
  };
}

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

/**
 * Creates a mock Choice activity object
 */
function createMockChoice(overrides: Partial<Choice> = {}): Choice {
  return {
    id: 1,
    course: 1,
    name: 'Test Choice Activity',
    intro: '<p>Please select your preferred option.</p>',
    introformat: 1,
    publish: 1,
    showresults: 3,
    display: 1,
    allowupdate: true,
    allowmultiple: false,
    showunanswered: false,
    includeinactive: false,
    limitanswers: false,
    timeopen: 0,
    timeclose: 0,
    showpreview: false,
    timemodified: 1704067200,
    completionsubmit: false,
    showavailable: false,
    options: [
      createMockOption({ id: 1, text: 'Option A' }),
      createMockOption({ id: 2, text: 'Option B' }),
      createMockOption({ id: 3, text: 'Option C' }),
    ],
    ...overrides,
  };
}

/**
 * Creates a mock ChoiceWithOptions object for API response
 */
function createMockChoiceWithOptions(overrides: Partial<ChoiceWithOptions> = {}): ChoiceWithOptions {
  const baseChoice = createMockChoice(overrides);
  return {
    ...baseChoice,
    options: (baseChoice.options ?? []).map((opt) => ({
      ...opt,
      displaylayout: false,
      checked: false,
      disabled: false,
    })),
    hasCapability: true,
    allowUpdateEnabled: false,
    previewOnly: false,
    ...overrides,
  } as ChoiceWithOptions;
}

/**
 * Creates a mock ChoiceOption object
 */
function createMockOption(overrides: Partial<ChoiceOption> = {}): ChoiceOption {
  return {
    id: 1,
    choiceid: 1,
    text: 'Option Text',
    maxanswers: 0,
    countanswers: 0,
    timemodified: 1704067200,
    ...overrides,
  };
}

/**
 * Creates a mock ChoiceResponse object
 */
function createMockResponse(overrides: Partial<ChoiceResponse> = {}): ChoiceResponse {
  return {
    id: 1,
    choiceid: 1,
    userid: 1,
    optionid: 1,
    timemodified: 1704067200,
    ...overrides,
  };
}

/**
 * Creates a mock UserResponse object
 */
function createMockUserResponse(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    userid: 1,
    fullname: 'John Doe',
    profileimageurl: 'https://example.com/user/1/photo.jpg',
    answerid: 1,
    timemodified: 1704067200,
    ...overrides,
  };
}

/**
 * Creates a mock ChoiceOptionResult object
 */
function createMockOptionResult(overrides: Partial<ChoiceOptionResult> = {}): ChoiceOptionResult {
  return {
    id: 1,
    text: 'Option A',
    maxanswer: 0,
    userresponses: [createMockUserResponse()],
    numberofuser: 1,
    percentageamount: 50,
    ...overrides,
  };
}

/**
 * Creates a mock ChoiceResults object
 */
function createMockChoiceResults(overrides: Partial<ChoiceResults> = {}): ChoiceResults {
  return {
    options: [
      createMockOptionResult({ id: 1, text: 'Option A', numberofuser: 5, percentageamount: 50 }),
      createMockOptionResult({ id: 2, text: 'Option B', numberofuser: 3, percentageamount: 30 }),
      createMockOptionResult({ id: 3, text: 'Option C', numberofuser: 2, percentageamount: 20 }),
    ],
    numberofuser: 10,
    percentageamount: 100,
    ...overrides,
  };
}

/**
 * Creates a mock ChoiceUserResponse object
 */
function createMockChoiceUserResponse(overrides: Partial<ChoiceUserResponse> = {}): ChoiceUserResponse {
  return {
    id: 1,
    firstname: 'John',
    lastname: 'Doe',
    email: 'john.doe@example.com',
    groups: [{ id: 1, name: 'Group A' }],
    selectedOptions: [{ id: 1, text: 'Option A' }],
    timemodified: 1704067200,
    answerid: 1,
    ...overrides,
  };
}

/**
 * Creates a mock ChoiceResultsResponse object
 */
function createMockResultsResponse(overrides: Partial<ChoiceResultsResponse> = {}): ChoiceResultsResponse {
  return {
    responses: [
      createMockChoiceUserResponse({ id: 1, firstname: 'John', lastname: 'Doe' }),
      createMockChoiceUserResponse({ id: 2, firstname: 'Jane', lastname: 'Smith' }),
    ],
    totalCount: 2,
    choiceId: 1,
    includeinactive: false,
    ...overrides,
  };
}

/**
 * Creates a mock ChoiceAvailabilityStatus object
 */
function createMockAvailabilityStatus(
  overrides: Partial<ChoiceAvailabilityStatus> = {}
): ChoiceAvailabilityStatus {
  return {
    available: true,
    warnings: [],
    isOpen: true,
    isClosed: false,
    hasResponded: false,
    canUpdate: true,
    isPreview: false,
    timeOpen: 0,
    timeClose: 0,
    ...overrides,
  };
}

/**
 * Creates a mock SubmitChoiceResponse object
 */
function createMockSubmitResponse(overrides: Partial<SubmitChoiceResponse> = {}): SubmitChoiceResponse {
  return {
    answerids: [1],
    ...overrides,
  };
}

// ============================================================================
// TEST SETUP
// ============================================================================

describe('choiceApi', () => {
  // Note: MSW server lifecycle (listen/close) is managed by global test setup in tests/setup.ts
  // We only need to reset handlers between tests and clear mocks

  // Reset handlers after each test for test isolation
  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  // ============================================================================
  // GET OPERATIONS
  // ============================================================================

  describe('getChoice', () => {
    describe('successful requests', () => {
      it('should fetch choice data by ID', async () => {
        const mockChoice = createMockChoiceWithOptions({ id: 42, name: 'My Choice Activity' });

        server.use(
          http.get(`${API_BASE_URL}/choices/42`, () => {
            return HttpResponse.json(createApiResponse(mockChoice));
          })
        );

        const result = await getChoice(42);

        expect(result).toBeDefined();
        expect(result.id).toBe(42);
        expect(result.name).toBe('My Choice Activity');
      });

      it('should return choice with all configuration properties', async () => {
        const mockChoice = createMockChoiceWithOptions({
          id: 1,
          allowupdate: true,
          allowmultiple: true,
          limitanswers: true,
          timeopen: 1704067200,
          timeclose: 1704153600,
          showresults: 3,
          publish: 1,
          showunanswered: true,
          showpreview: true,
          includeinactive: true,
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1`, () => {
            return HttpResponse.json(createApiResponse(mockChoice));
          })
        );

        const result = await getChoice(1);

        expect(result.allowupdate).toBe(true);
        expect(result.allowmultiple).toBe(true);
        expect(result.limitanswers).toBe(true);
        expect(result.timeopen).toBe(1704067200);
        expect(result.timeclose).toBe(1704153600);
        expect(result.showresults).toBe(3);
        expect(result.publish).toBe(1);
        expect(result.showunanswered).toBe(true);
        expect(result.showpreview).toBe(true);
        expect(result.includeinactive).toBe(true);
      });

      it('should return choice options array with proper structure', async () => {
        const mockChoice = createMockChoiceWithOptions({
          options: [
            { id: 1, choiceid: 1, text: 'Option A', maxanswers: 10, countanswers: 5, timemodified: 1704067200, checked: false, disabled: false },
            { id: 2, choiceid: 1, text: 'Option B', maxanswers: 0, countanswers: 3, timemodified: 1704067200, checked: true, disabled: false },
            { id: 3, choiceid: 1, text: 'Option C', maxanswers: 5, countanswers: 5, timemodified: 1704067200, checked: false, disabled: true },
          ],
        } as Partial<ChoiceWithOptions>);

        server.use(
          http.get(`${API_BASE_URL}/choices/1`, () => {
            return HttpResponse.json(createApiResponse(mockChoice));
          })
        );

        const result = await getChoice(1);

        expect(result.options).toHaveLength(3);
        expect(result.options[0]!.text).toBe('Option A');
        expect(result.options[0]!.maxanswers).toBe(10);
        expect(result.options[1]!.checked).toBe(true);
        expect(result.options[2]!.disabled).toBe(true);
      });

      it('should include capability and update status', async () => {
        const mockChoice = createMockChoiceWithOptions({
          hasCapability: true,
          allowUpdateEnabled: true,
          previewOnly: false,
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1`, () => {
            return HttpResponse.json(createApiResponse(mockChoice));
          })
        );

        const result = await getChoice(1);

        expect(result.hasCapability).toBe(true);
        expect(result.allowUpdateEnabled).toBe(true);
        expect(result.previewOnly).toBe(false);
      });
    });

    describe('error handling', () => {
      it('should throw error for 404 choice not found', async () => {
        server.use(
          http.get(`${API_BASE_URL}/choices/999`, () => {
            return HttpResponse.json(
              createApiError('cannotsubmit', 'Choice not found'),
              { status: 404 }
            );
          })
        );

        await expect(getChoice(999)).rejects.toThrow();
      });

      it('should throw error for 403 permission denied', async () => {
        server.use(
          http.get(`${API_BASE_URL}/choices/1`, () => {
            return HttpResponse.json(
              createApiError('nopermission', 'You do not have permission to view this choice'),
              { status: 403 }
            );
          })
        );

        await expect(getChoice(1)).rejects.toThrow();
      });

      it('should handle network errors gracefully', async () => {
        server.use(
          http.get(`${API_BASE_URL}/choices/1`, () => {
            return HttpResponse.error();
          })
        );

        await expect(getChoice(1)).rejects.toThrow();
      });

      it('should handle 503 service unavailable', async () => {
        server.use(
          http.get(`${API_BASE_URL}/choices/1`, () => {
            return HttpResponse.json(
              createApiError('service_unavailable', 'Database connection error'),
              { status: 503 }
            );
          })
        );

        await expect(getChoice(1)).rejects.toThrow();
      });
    });
  });

  describe('getResults', () => {
    describe('successful requests', () => {
      it('should fetch choice results with response counts per option', async () => {
        const mockResults = createMockChoiceResults();

        server.use(
          http.get(`${API_BASE_URL}/choices/1/results`, () => {
            return HttpResponse.json(createApiResponse(mockResults));
          })
        );

        const result = await getResults(1);

        expect(result).toBeDefined();
        expect(result.options).toHaveLength(3);
        expect(result.numberofuser).toBe(10);
      });

      it('should return user details for each response in named mode', async () => {
        const mockResults = createMockChoiceResults({
          options: [
            createMockOptionResult({
              id: 1,
              text: 'Option A',
              userresponses: [
                createMockUserResponse({ userid: 1, fullname: 'John Doe', timemodified: 1704067200 }),
                createMockUserResponse({ userid: 2, fullname: 'Jane Smith', timemodified: 1704067300 }),
              ],
              numberofuser: 2,
            }),
          ],
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/results`, () => {
            return HttpResponse.json(createApiResponse(mockResults));
          })
        );

        const result = await getResults(1);

        expect(result.options[0]!.userresponses).toHaveLength(2);
        expect(result.options[0]!.userresponses[0]!.fullname).toBe('John Doe');
        expect(result.options[0]!.userresponses[1]!.fullname).toBe('Jane Smith');
      });

      it('should return empty userresponses array for anonymous mode', async () => {
        const mockResults = createMockChoiceResults({
          options: [
            createMockOptionResult({
              id: 1,
              text: 'Option A',
              userresponses: [],
              numberofuser: 5,
            }),
          ],
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/results`, () => {
            return HttpResponse.json(createApiResponse(mockResults));
          })
        );

        const result = await getResults(1);

        expect(result.options[0]!.userresponses).toHaveLength(0);
        expect(result.options[0]!.numberofuser).toBe(5);
      });

      it('should include percentage calculations', async () => {
        const mockResults = createMockChoiceResults({
          options: [
            createMockOptionResult({ id: 1, numberofuser: 50, percentageamount: 50 }),
            createMockOptionResult({ id: 2, numberofuser: 30, percentageamount: 30 }),
            createMockOptionResult({ id: 3, numberofuser: 20, percentageamount: 20 }),
          ],
          percentageamount: 100,
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/results`, () => {
            return HttpResponse.json(createApiResponse(mockResults));
          })
        );

        const result = await getResults(1);

        expect(result.options[0]!.percentageamount).toBe(50);
        expect(result.options[1]!.percentageamount).toBe(30);
        expect(result.options[2]!.percentageamount).toBe(20);
        expect(result.percentageamount).toBe(100);
      });
    });

    describe('error handling', () => {
      it('should throw error when results cannot be viewed', async () => {
        server.use(
          http.get(`${API_BASE_URL}/choices/1/results`, () => {
            return HttpResponse.json(
              createApiError('nopermission', 'Results are not available'),
              { status: 403 }
            );
          })
        );

        await expect(getResults(1)).rejects.toThrow();
      });
    });
  });

  describe('getUserResponse', () => {
    describe('successful requests', () => {
      it('should fetch user response by choiceId and userId', async () => {
        const mockResponses = [
          createMockResponse({ id: 1, optionid: 2, userid: 15 }),
        ];

        server.use(
          http.get(`${API_BASE_URL}/choices/42/responses/15`, () => {
            return HttpResponse.json(createApiResponse(mockResponses));
          })
        );

        const result = await getUserResponse(42, 15);

        expect(result).toHaveLength(1);
        expect(result[0]!.optionid).toBe(2);
        expect(result[0]!.userid).toBe(15);
      });

      it('should return multiple responses for multiple-choice', async () => {
        const mockResponses = [
          createMockResponse({ id: 1, optionid: 1 }),
          createMockResponse({ id: 2, optionid: 3 }),
        ];

        server.use(
          http.get(`${API_BASE_URL}/choices/1/responses/1`, () => {
            return HttpResponse.json(createApiResponse(mockResponses));
          })
        );

        const result = await getUserResponse(1, 1);

        expect(result).toHaveLength(2);
      });

      it('should return empty array if user has not responded', async () => {
        server.use(
          http.get(`${API_BASE_URL}/choices/1/responses/1`, () => {
            return HttpResponse.json(createApiResponse([]));
          })
        );

        const result = await getUserResponse(1, 1);

        expect(result).toHaveLength(0);
      });

      it('should include timemodified timestamp', async () => {
        const mockResponses = [
          createMockResponse({ timemodified: 1704153600 }),
        ];

        server.use(
          http.get(`${API_BASE_URL}/choices/1/responses/1`, () => {
            return HttpResponse.json(createApiResponse(mockResponses));
          })
        );

        const result = await getUserResponse(1, 1);

        expect(result[0]!.timemodified).toBe(1704153600);
      });
    });
  });

  describe('getMyResponse', () => {
    describe('successful requests', () => {
      it('should fetch current user response', async () => {
        const mockResponses = [createMockResponse({ id: 1, optionid: 2 })];

        server.use(
          http.get(`${API_BASE_URL}/choices/42/responses/me`, () => {
            return HttpResponse.json(createApiResponse(mockResponses));
          })
        );

        const result = await getMyResponse(42);

        expect(result).toHaveLength(1);
        expect(result[0]!.optionid).toBe(2);
      });

      it('should return empty array if current user has not responded', async () => {
        server.use(
          http.get(`${API_BASE_URL}/choices/1/responses/me`, () => {
            return HttpResponse.json(createApiResponse([]));
          })
        );

        const result = await getMyResponse(1);

        expect(result).toHaveLength(0);
      });
    });
  });

  describe('getResponseData', () => {
    describe('successful requests', () => {
      it('should fetch detailed response data', async () => {
        const mockData = createMockResultsResponse();

        server.use(
          http.get(`${API_BASE_URL}/choices/1/response-data`, () => {
            return HttpResponse.json(createApiResponse(mockData));
          })
        );

        const result = await getResponseData(1);

        expect(result).toBeDefined();
        expect(result.responses).toHaveLength(2);
        expect(result.totalCount).toBe(2);
      });

      it('should include user enrollment data with profile fields', async () => {
        const mockData = createMockResultsResponse({
          responses: [
            createMockChoiceUserResponse({
              id: 1,
              firstname: 'John',
              lastname: 'Doe',
              email: 'john@example.com',
              department: 'Computer Science',
              institution: 'University',
            }),
          ],
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/response-data`, () => {
            return HttpResponse.json(createApiResponse(mockData));
          })
        );

        const result = await getResponseData(1);

        expect(result.responses[0]!.email).toBe('john@example.com');
        expect(result.responses[0]!.department).toBe('Computer Science');
        expect(result.responses[0]!.institution).toBe('University');
      });

      it('should support group filtering with groupId parameter', async () => {
        const mockData = createMockResultsResponse({ groupId: 5 });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/response-data`, ({ request }) => {
            const url = new URL(request.url);
            const groupId = url.searchParams.get('groupId');
            expect(groupId).toBe('5');
            return HttpResponse.json(createApiResponse(mockData));
          })
        );

        const result = await getResponseData(1, { groupId: 5 });

        expect(result.groupId).toBe(5);
      });

      it('should support onlyActive parameter to exclude suspended users', async () => {
        const mockData = createMockResultsResponse({ includeinactive: false });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/response-data`, ({ request }) => {
            const url = new URL(request.url);
            const onlyActive = url.searchParams.get('onlyActive');
            expect(onlyActive).toBe('1');
            return HttpResponse.json(createApiResponse(mockData));
          })
        );

        await getResponseData(1, { onlyActive: true });
      });

      it('should include selected options for each user', async () => {
        const mockData = createMockResultsResponse({
          responses: [
            createMockChoiceUserResponse({
              selectedOptions: [
                { id: 1, text: 'Option A' },
                { id: 3, text: 'Option C' },
              ],
            }),
          ],
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/response-data`, () => {
            return HttpResponse.json(createApiResponse(mockData));
          })
        );

        const result = await getResponseData(1);

        expect(result.responses[0]!.selectedOptions).toHaveLength(2);
        expect(result.responses[0]!.selectedOptions![0]!.text).toBe('Option A');
      });

      it('should include group memberships for each user', async () => {
        const mockData = createMockResultsResponse({
          responses: [
            createMockChoiceUserResponse({
              groups: [
                { id: 1, name: 'Group A' },
                { id: 2, name: 'Group B' },
              ],
            }),
          ],
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/response-data`, () => {
            return HttpResponse.json(createApiResponse(mockData));
          })
        );

        const result = await getResponseData(1);

        expect(result.responses[0]!.groups).toHaveLength(2);
        expect(result.responses[0]!.groups![0]!.name).toBe('Group A');
      });
    });
  });

  describe('getChoiceResults (hook-compatible)', () => {
    it('should transform includeinactive to onlyActive parameter', async () => {
      const mockData = createMockResultsResponse();

      server.use(
        http.get(`${API_BASE_URL}/choices/1/response-data`, ({ request }) => {
          const url = new URL(request.url);
          const onlyActive = url.searchParams.get('onlyActive');
          expect(onlyActive).toBe('0');
          return HttpResponse.json(createApiResponse(mockData));
        })
      );

      await getChoiceResults(1, { includeinactive: true });
    });

    it('should pass groupId parameter correctly', async () => {
      const mockData = createMockResultsResponse();

      server.use(
        http.get(`${API_BASE_URL}/choices/1/response-data`, ({ request }) => {
          const url = new URL(request.url);
          const groupId = url.searchParams.get('groupId');
          expect(groupId).toBe('10');
          return HttpResponse.json(createApiResponse(mockData));
        })
      );

      await getChoiceResults(1, { groupId: 10 });
    });
  });

  describe('getAvailabilityStatus', () => {
    describe('successful requests', () => {
      it('should return availability status with available flag', async () => {
        const mockStatus = createMockAvailabilityStatus({ available: true });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/availability`, () => {
            return HttpResponse.json(createApiResponse(mockStatus));
          })
        );

        const result = await getAvailabilityStatus(1);

        expect(result.available).toBe(true);
      });

      it('should include isOpen and isClosed flags', async () => {
        const mockStatus = createMockAvailabilityStatus({
          isOpen: true,
          isClosed: false,
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/availability`, () => {
            return HttpResponse.json(createApiResponse(mockStatus));
          })
        );

        const result = await getAvailabilityStatus(1);

        expect(result.isOpen).toBe(true);
        expect(result.isClosed).toBe(false);
      });

      it('should include hasResponded and canUpdate flags', async () => {
        const mockStatus = createMockAvailabilityStatus({
          hasResponded: true,
          canUpdate: true,
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/availability`, () => {
            return HttpResponse.json(createApiResponse(mockStatus));
          })
        );

        const result = await getAvailabilityStatus(1);

        expect(result.hasResponded).toBe(true);
        expect(result.canUpdate).toBe(true);
      });

      it('should return notopenyet warning when choice not yet open', async () => {
        const futureTime = Math.floor(Date.now() / 1000) + 86400; // Tomorrow
        const mockStatus = createMockAvailabilityStatus({
          available: false,
          isOpen: false,
          timeOpen: futureTime,
          warnings: [
            { type: 'notopenyet', message: 'Choice opens on January 3, 2024', timestamp: futureTime },
          ],
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/availability`, () => {
            return HttpResponse.json(createApiResponse(mockStatus));
          })
        );

        const result = await getAvailabilityStatus(1);

        expect(result.available).toBe(false);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]!.type).toBe('notopenyet');
        expect(result.timeOpen).toBe(futureTime);
      });

      it('should return expired warning when choice is closed', async () => {
        const pastTime = Math.floor(Date.now() / 1000) - 86400; // Yesterday
        const mockStatus = createMockAvailabilityStatus({
          available: false,
          isClosed: true,
          timeClose: pastTime,
          warnings: [
            { type: 'expired', message: 'Choice closed on January 1, 2024', timestamp: pastTime },
          ],
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/availability`, () => {
            return HttpResponse.json(createApiResponse(mockStatus));
          })
        );

        const result = await getAvailabilityStatus(1);

        expect(result.available).toBe(false);
        expect(result.isClosed).toBe(true);
        expect(result.warnings[0]!.type).toBe('expired');
      });

      it('should return choicesaved warning when user already responded and update not allowed', async () => {
        const mockStatus = createMockAvailabilityStatus({
          available: false,
          hasResponded: true,
          canUpdate: false,
          warnings: [
            { type: 'choicesaved', message: 'Your response has been saved' },
          ],
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/availability`, () => {
            return HttpResponse.json(createApiResponse(mockStatus));
          })
        );

        const result = await getAvailabilityStatus(1);

        expect(result.hasResponded).toBe(true);
        expect(result.canUpdate).toBe(false);
        expect(result.warnings[0]!.type).toBe('choicesaved');
      });

      it('should return previewonly warning when in preview mode', async () => {
        const mockStatus = createMockAvailabilityStatus({
          available: false,
          isPreview: true,
          warnings: [
            { type: 'previewonly', message: 'This is a preview. Choice is not yet open.' },
          ],
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/availability`, () => {
            return HttpResponse.json(createApiResponse(mockStatus));
          })
        );

        const result = await getAvailabilityStatus(1);

        expect(result.isPreview).toBe(true);
        expect(result.warnings[0]!.type).toBe('previewonly');
      });

      it('should include timeopen and timeclose values', async () => {
        const mockStatus = createMockAvailabilityStatus({
          timeOpen: 1704067200,
          timeClose: 1704153600,
        });

        server.use(
          http.get(`${API_BASE_URL}/choices/1/availability`, () => {
            return HttpResponse.json(createApiResponse(mockStatus));
          })
        );

        const result = await getAvailabilityStatus(1);

        expect(result.timeOpen).toBe(1704067200);
        expect(result.timeClose).toBe(1704153600);
      });
    });
  });

  // ============================================================================
  // POST MUTATIONS
  // ============================================================================

  describe('submitResponse', () => {
    describe('successful submissions', () => {
      it('should submit single answer selection', async () => {
        const mockSubmitResponse = createMockSubmitResponse({ answerids: [101] });

        server.use(
          http.post(`${API_BASE_URL}/choices/1/responses`, async ({ request }) => {
            const body = await request.json() as { answers: number[] };
            expect(body.answers).toEqual([1]);
            return HttpResponse.json(createApiResponse(mockSubmitResponse));
          })
        );

        const result = await submitResponse(1, [1]);

        expect(result.answerids).toEqual([101]);
      });

      it('should submit multiple answer selections when allowmultiple is true', async () => {
        const mockSubmitResponse = createMockSubmitResponse({ answerids: [101, 102, 103] });

        server.use(
          http.post(`${API_BASE_URL}/choices/1/responses`, async ({ request }) => {
            const body = await request.json() as { answers: number[] };
            expect(body.answers).toEqual([1, 2, 3]);
            return HttpResponse.json(createApiResponse(mockSubmitResponse));
          })
        );

        const result = await submitResponse(1, [1, 2, 3]);

        expect(result.answerids).toHaveLength(3);
      });

      it('should format request body correctly', async () => {
        server.use(
          http.post(`${API_BASE_URL}/choices/1/responses`, async ({ request }) => {
            const body = await request.json() as { answers: number[] };
            expect(body).toHaveProperty('answers');
            expect(Array.isArray(body.answers)).toBe(true);
            return HttpResponse.json(createApiResponse(createMockSubmitResponse()));
          })
        );

        await submitResponse(1, [5]);
      });

      it('should return updated answer IDs after submission', async () => {
        const mockSubmitResponse = createMockSubmitResponse({ answerids: [201] });

        server.use(
          http.post(`${API_BASE_URL}/choices/1/responses`, () => {
            return HttpResponse.json(createApiResponse(mockSubmitResponse));
          })
        );

        const result = await submitResponse(1, [2]);

        expect(result.answerids).toContain(201);
      });
    });

    describe('validation errors', () => {
      it('should throw atleastoneoption error for empty answer array', async () => {
        await expect(submitResponse(1, [])).rejects.toThrow('At least one option must be selected');
      });

      it('should handle multiplenotallowederror from API', async () => {
        server.use(
          http.post(`${API_BASE_URL}/choices/1/responses`, () => {
            return HttpResponse.json(
              createApiError('multiplenotallowederror', 'Multiple selections are not allowed for this choice'),
              { status: 400 }
            );
          })
        );

        try {
          await submitResponse(1, [1, 2]);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect((error as Error).message).toContain('not allowed');
        }
      });

      it('should handle cannotsubmit error for invalid option ID', async () => {
        server.use(
          http.post(`${API_BASE_URL}/choices/1/responses`, () => {
            return HttpResponse.json(
              createApiError('cannotsubmit', 'Cannot submit: invalid option selected'),
              { status: 400 }
            );
          })
        );

        try {
          await submitResponse(1, [999]);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect((error as Error).message).toContain('submit');
        }
      });

      it('should handle choicesexceeded error when option limit reached', async () => {
        server.use(
          http.post(`${API_BASE_URL}/choices/1/responses`, () => {
            return HttpResponse.json(
              createApiError('choicesexceeded', 'The selected option has exceeded its response limit'),
              { status: 409 }
            );
          })
        );

        try {
          await submitResponse(1, [1]);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect((error as Error).message).toContain('exceeded');
        }
      });

      it('should handle choicefull error when all slots are taken', async () => {
        server.use(
          http.post(`${API_BASE_URL}/choices/1/responses`, () => {
            return HttpResponse.json(
              { success: false, message: 'The choice option is full' },
              { status: 409 }
            );
          })
        );

        await expect(submitResponse(1, [1])).rejects.toThrow();
      });
    });

    describe('time-based restrictions', () => {
      it('should handle notopenyet error when choice not yet open', async () => {
        server.use(
          http.post(`${API_BASE_URL}/choices/1/responses`, () => {
            return HttpResponse.json(
              { success: false, message: 'Choice is not open yet' },
              { status: 400 }
            );
          })
        );

        await expect(submitResponse(1, [1])).rejects.toThrow();
      });

      it('should handle expired error when choice is closed', async () => {
        server.use(
          http.post(`${API_BASE_URL}/choices/1/responses`, () => {
            return HttpResponse.json(
              { success: false, message: 'Choice has expired and is closed' },
              { status: 400 }
            );
          })
        );

        await expect(submitResponse(1, [1])).rejects.toThrow();
      });
    });

    describe('permission errors', () => {
      it('should handle 403 permission denied', async () => {
        server.use(
          http.post(`${API_BASE_URL}/choices/1/responses`, () => {
            return HttpResponse.json(
              createApiError('nopermission', 'You do not have permission to respond to this choice'),
              { status: 403 }
            );
          })
        );

        await expect(submitResponse(1, [1])).rejects.toThrow();
      });
    });

    describe('update scenarios', () => {
      it('should allow response modification when allowupdate is true', async () => {
        const mockSubmitResponse = createMockSubmitResponse({ answerids: [102] });

        server.use(
          http.post(`${API_BASE_URL}/choices/1/responses`, () => {
            return HttpResponse.json(createApiResponse(mockSubmitResponse));
          })
        );

        // First submission
        await submitResponse(1, [1]);

        // Update submission
        const result = await submitResponse(1, [2]);
        expect(result.answerids).toContain(102);
      });
    });
  });

  // ============================================================================
  // DELETE MUTATIONS
  // ============================================================================

  describe('deleteResponse', () => {
    describe('successful deletions', () => {
      it('should delete current user response', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/choices/1/responses`, () => {
            return HttpResponse.json(createApiResponse(null));
          })
        );

        await expect(deleteResponse(1)).resolves.toBeUndefined();
      });

      it('should make DELETE request to correct endpoint', async () => {
        let requestReceived = false;

        server.use(
          http.delete(`${API_BASE_URL}/choices/42/responses`, () => {
            requestReceived = true;
            return HttpResponse.json(createApiResponse(null));
          })
        );

        await deleteResponse(42);

        expect(requestReceived).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should handle 404 response not found', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/choices/1/responses`, () => {
            return HttpResponse.json(
              createApiError('cannotsubmit', 'No response found to delete'),
              { status: 404 }
            );
          })
        );

        await expect(deleteResponse(1)).rejects.toThrow();
      });

      it('should handle 403 permission denied for non-moderator', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/choices/1/responses`, () => {
            return HttpResponse.json(
              createApiError('nopermission', 'You do not have permission to delete responses'),
              { status: 403 }
            );
          })
        );

        await expect(deleteResponse(1)).rejects.toThrow();
      });

      it('should handle deletion when updates not allowed', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/choices/1/responses`, () => {
            return HttpResponse.json(
              { success: false, message: 'Response updates are not allowed' },
              { status: 400 }
            );
          })
        );

        await expect(deleteResponse(1)).rejects.toThrow();
      });
    });
  });

  // ============================================================================
  // COMMON ERROR SCENARIOS
  // ============================================================================

  describe('common error handling', () => {
    describe('network errors', () => {
      it('should handle network timeout', async () => {
        server.use(
          http.get(`${API_BASE_URL}/choices/1`, async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.error();
          })
        );

        await expect(getChoice(1)).rejects.toThrow();
      });

      it('should handle malformed JSON response', async () => {
        server.use(
          http.get(`${API_BASE_URL}/choices/1`, () => {
            return new HttpResponse('invalid json{', {
              headers: { 'Content-Type': 'application/json' },
            });
          })
        );

        await expect(getChoice(1)).rejects.toThrow();
      });
    });

    describe('server errors', () => {
      it('should handle 500 internal server error', async () => {
        server.use(
          http.get(`${API_BASE_URL}/choices/1`, () => {
            return HttpResponse.json(
              createApiError('internal_error', 'An unexpected error occurred'),
              { status: 500 }
            );
          })
        );

        await expect(getChoice(1)).rejects.toThrow();
      });

      it('should handle 502 bad gateway', async () => {
        server.use(
          http.get(`${API_BASE_URL}/choices/1`, () => {
            return HttpResponse.json(
              createApiError('bad_gateway', 'Bad gateway'),
              { status: 502 }
            );
          })
        );

        await expect(getChoice(1)).rejects.toThrow();
      });
    });

    describe('authentication errors', () => {
      it('should handle 401 unauthorized (token expired)', async () => {
        server.use(
          http.get(`${API_BASE_URL}/choices/1`, () => {
            return HttpResponse.json(
              createApiError('token_expired', 'Authentication token has expired'),
              { status: 401 }
            );
          })
        );

        await expect(getChoice(1)).rejects.toThrow();
      });
    });
  });

  // ============================================================================
  // REQUEST HEADERS
  // ============================================================================

  describe('request headers', () => {
    it('should include Content-Type header for POST requests', async () => {
      server.use(
        http.post(`${API_BASE_URL}/choices/1/responses`, async ({ request }) => {
          const contentType = request.headers.get('Content-Type');
          expect(contentType).toContain('application/json');
          return HttpResponse.json(createApiResponse(createMockSubmitResponse()));
        })
      );

      await submitResponse(1, [1]);
    });
  });

  // ============================================================================
  // API ENVELOPE PARSING
  // ============================================================================

  describe('API envelope parsing', () => {
    it('should correctly parse success response envelope', async () => {
      const mockChoice = createMockChoiceWithOptions({ id: 1, name: 'Test' });

      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          return HttpResponse.json({
            success: true,
            data: mockChoice,
            meta: { timestamp: 1704067200 },
          });
        })
      );

      const result = await getChoice(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test');
    });

    it('should correctly parse error response envelope', async () => {
      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'cannotsubmit',
                message: 'Cannot access choice',
                details: { reason: 'Not enrolled' },
              },
            },
            { status: 400 }
          );
        })
      );

      try {
        await getChoice(1);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  // ============================================================================
  // CONCURRENT OPERATIONS
  // ============================================================================

  describe('concurrent operations', () => {
    it('should handle multiple simultaneous requests', async () => {
      const mockChoice1 = createMockChoiceWithOptions({ id: 1, name: 'Choice 1' });
      const mockChoice2 = createMockChoiceWithOptions({ id: 2, name: 'Choice 2' });
      const mockChoice3 = createMockChoiceWithOptions({ id: 3, name: 'Choice 3' });

      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          return HttpResponse.json(createApiResponse(mockChoice1));
        }),
        http.get(`${API_BASE_URL}/choices/2`, () => {
          return HttpResponse.json(createApiResponse(mockChoice2));
        }),
        http.get(`${API_BASE_URL}/choices/3`, () => {
          return HttpResponse.json(createApiResponse(mockChoice3));
        })
      );

      const [result1, result2, result3] = await Promise.all([
        getChoice(1),
        getChoice(2),
        getChoice(3),
      ]);

      expect(result1.name).toBe('Choice 1');
      expect(result2.name).toBe('Choice 2');
      expect(result3.name).toBe('Choice 3');
    });

    it('should handle concurrent submissions from different users', async () => {
      let submissionCount = 0;

      server.use(
        http.post(`${API_BASE_URL}/choices/1/responses`, () => {
          submissionCount++;
          return HttpResponse.json(createApiResponse(createMockSubmitResponse({ answerids: [submissionCount] })));
        })
      );

      const results = await Promise.all([
        submitResponse(1, [1]),
        submitResponse(1, [2]),
        submitResponse(1, [3]),
      ]);

      expect(results).toHaveLength(3);
      expect(submissionCount).toBe(3);
    });
  });

  // ============================================================================
  // LIMIT ENFORCEMENT
  // ============================================================================

  describe('limit enforcement', () => {
    it('should handle option limit exceeded during submission', async () => {
      server.use(
        http.post(`${API_BASE_URL}/choices/1/responses`, () => {
          return HttpResponse.json(
            createApiError('choicesexceeded', 'This option has reached its maximum number of responses'),
            { status: 409 }
          );
        })
      );

      try {
        await submitResponse(1, [1]);
        expect.fail('Should have thrown an error');
      } catch (error) {
        const apiError = error as { code: string };
        expect(apiError.code).toBe('choicesexceeded');
      }
    });
  });

  // ============================================================================
  // GROUP MODE SCENARIOS
  // ============================================================================

  describe('group mode scenarios', () => {
    it('should filter results by group with separate groups', async () => {
      const mockData = createMockResultsResponse({
        groupId: 5,
        responses: [
          createMockChoiceUserResponse({ id: 1, groups: [{ id: 5, name: 'Group A' }] }),
        ],
      });

      server.use(
        http.get(`${API_BASE_URL}/choices/1/response-data`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('groupId')).toBe('5');
          return HttpResponse.json(createApiResponse(mockData));
        })
      );

      const result = await getResponseData(1, { groupId: 5 });

      expect(result.groupId).toBe(5);
      expect(result.responses[0]!.groups![0]!.id).toBe(5);
    });

    it('should return all groups when groupId is 0', async () => {
      const mockData = createMockResultsResponse({
        responses: [
          createMockChoiceUserResponse({ id: 1, groups: [{ id: 1, name: 'Group A' }] }),
          createMockChoiceUserResponse({ id: 2, groups: [{ id: 2, name: 'Group B' }] }),
        ],
      });

      server.use(
        http.get(`${API_BASE_URL}/choices/1/response-data`, () => {
          return HttpResponse.json(createApiResponse(mockData));
        })
      );

      const result = await getResponseData(1);

      expect(result.responses).toHaveLength(2);
    });
  });

  // ============================================================================
  // TYPESCRIPT COMPLIANCE
  // ============================================================================

  describe('TypeScript type safety', () => {
    it('should return properly typed Choice object', async () => {
      const mockChoice = createMockChoiceWithOptions();

      server.use(
        http.get(`${API_BASE_URL}/choices/1`, () => {
          return HttpResponse.json(createApiResponse(mockChoice));
        })
      );

      const result: ChoiceWithOptions = await getChoice(1);

      // These assertions verify TypeScript inference works correctly
      const id: number = result.id;
      const name: string = result.name;
      const allowupdate: boolean = result.allowupdate;
      const options: typeof result.options = result.options;

      expect(id).toBeTypeOf('number');
      expect(name).toBeTypeOf('string');
      expect(allowupdate).toBeTypeOf('boolean');
      expect(Array.isArray(options)).toBe(true);
    });

    it('should return properly typed ChoiceResults object', async () => {
      const mockResults = createMockChoiceResults();

      server.use(
        http.get(`${API_BASE_URL}/choices/1/results`, () => {
          return HttpResponse.json(createApiResponse(mockResults));
        })
      );

      const result: ChoiceResults = await getResults(1);

      expect(result.options).toBeInstanceOf(Array);
      expect(result.numberofuser).toBeTypeOf('number');
      expect(result.percentageamount).toBeTypeOf('number');
    });

    it('should return properly typed ChoiceAvailabilityStatus object', async () => {
      const mockStatus = createMockAvailabilityStatus();

      server.use(
        http.get(`${API_BASE_URL}/choices/1/availability`, () => {
          return HttpResponse.json(createApiResponse(mockStatus));
        })
      );

      const result: ChoiceAvailabilityStatus = await getAvailabilityStatus(1);

      expect(result.available).toBeTypeOf('boolean');
      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.timeOpen).toBeTypeOf('number');
    });
  });
});
