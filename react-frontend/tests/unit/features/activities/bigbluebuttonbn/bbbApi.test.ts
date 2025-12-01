/**
 * BigBlueButton API Integration Tests
 *
 * Comprehensive unit tests for the BigBlueButton API client module. Tests all
 * API functions including instance fetching, meeting operations (join, create, end),
 * recording management, and error handling scenarios.
 *
 * Test Coverage:
 * - fetchBBBInstance: GET /api/v1/bigbluebuttonbn/{id}
 * - fetchBBBMeetingStatus: GET /api/v1/bigbluebuttonbn/{id}/status
 * - fetchBBBRecordings: GET /api/v1/bigbluebuttonbn/{id}/recordings
 * - joinBBBMeeting: POST /api/v1/bigbluebuttonbn/{id}/join
 * - createBBBMeeting: POST /api/v1/bigbluebuttonbn/{id}/create
 * - endBBBMeeting: POST /api/v1/bigbluebuttonbn/{id}/end
 * - publishBBBRecording: POST /api/v1/bigbluebuttonbn/recordings/{id}/publish
 * - deleteBBBRecording: DELETE /api/v1/bigbluebuttonbn/recordings/{id}
 * - importBBBRecording: POST /api/v1/bigbluebuttonbn/recordings/import
 *
 * Error Scenarios Tested:
 * - 404 Instance/Recording not found
 * - 403 Permission denied (non-moderator)
 * - 409 Meeting already running
 * - 503 BBB server unavailable
 * - Network timeouts and failures
 * - Malformed response handling
 * - Meeting full scenarios
 * - Meeting not started scenarios
 * - Concurrent join requests
 *
 * @module tests/unit/features/activities/bigbluebuttonbn/bbbApi.test
 */

import { describe, it, expect, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@tests/mocks/server';
import {
  fetchBBBInstance,
  fetchBBBMeetingStatus,
  fetchBBBRecordings,
  joinBBBMeeting,
  createBBBMeeting,
  endBBBMeeting,
  publishBBBRecording,
  deleteBBBRecording,
  importBBBRecording,
  bbbQueryKeys,
} from '@/features/activities/bigbluebuttonbn/api/bbbApi';
import type {
  BBBInstance,
  BBBRoomStatus,
  BBBRecording,
  BBBInstanceType,
  BBBRecordingStatus,
} from '@/features/activities/bigbluebuttonbn/types/bbb.types';
import type { ApiResponse } from '@/types/api';

// ============================================================================
// Test Configuration and Setup
// ============================================================================

/**
 * Base API URL for all BBB endpoints
 */
const API_BASE_URL = process.env.VITE_API_BASE_URL || '/api/v1';

/**
 * Test constants for mock data
 */
const TEST_INSTANCE_ID = 123;
const TEST_RECORDING_ID = 456;
const TEST_TARGET_INSTANCE_ID = 789;

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock BBBInstance object with configurable overrides
 */
function createMockBBBInstance(overrides: Partial<BBBInstance> = {}): BBBInstance {
  return {
    id: TEST_INSTANCE_ID,
    courseId: 1,
    name: 'Weekly Team Meeting',
    intro: '<p>Join our weekly team sync meeting</p>',
    meetingId: 'bbb-meeting-123-abc',
    type: 0 as BBBInstanceType, // BBBInstanceType.ALL
    openingTime: null,
    closingTime: null,
    userLimit: 100,
    welcome: 'Welcome to the meeting!',
    groupId: null,
    recordings: true,
    chat: true,
    polls: true,
    presentations: [
      {
        url: 'https://example.com/slide.pdf',
        name: 'Weekly Agenda',
        iconName: 'pdf',
        iconDesc: 'PDF Document',
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock BBBRoomStatus object with configurable overrides
 */
function createMockBBBRoomStatus(overrides: Partial<BBBRoomStatus> = {}): BBBRoomStatus {
  return {
    statusRunning: false,
    statusClosed: false,
    statusOpen: true,
    statusMessage: 'Room is open. Click to join.',
    moderatorCount: 0,
    participantCount: 0,
    moderatorPlural: false,
    participantPlural: false,
    canJoin: true,
    openingTime: null,
    closingTime: null,
    ...overrides,
  };
}

/**
 * Creates a mock BBBRecording object with configurable overrides
 */
function createMockBBBRecording(overrides: Partial<BBBRecording> = {}): BBBRecording {
  return {
    id: TEST_RECORDING_ID,
    recordingId: 'rec-abc123',
    bigbluebuttonbnId: TEST_INSTANCE_ID,
    courseId: 1,
    name: 'Team Meeting Recording - January 15',
    description: 'Recording of the weekly team meeting',
    startTime: 1705327200, // Unix timestamp
    endTime: 1705330800,
    published: true,
    protected: false,
    playbacks: [
      {
        type: 'presentation',
        url: 'https://bbb.example.com/playback/presentation/rec-abc123',
        length: 3600000, // 1 hour in milliseconds
      },
      {
        type: 'video',
        url: 'https://bbb.example.com/playback/video/rec-abc123',
        length: 3600000,
      },
    ],
    headless: false,
    imported: false,
    status: 2 as BBBRecordingStatus, // BBBRecordingStatus.PROCESSED
    groupId: null,
    ...overrides,
  };
}

/**
 * Creates a standard API success response envelope
 */
function createApiResponse<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
  return {
    success: true,
    data,
    meta,
  };
}

/**
 * Creates a standard API error response envelope
 */
function createApiErrorResponse(code: string, message: string, details?: Record<string, unknown>) {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

// ============================================================================
// Test Suite Setup
// ============================================================================

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

afterAll(() => {
  server.close();
});

// ============================================================================
// fetchBBBInstance Tests
// ============================================================================

describe('fetchBBBInstance', () => {
  describe('successful requests', () => {
    it('should fetch BBB instance data successfully', async () => {
      const mockInstance = createMockBBBInstance();

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id`, ({ params }) => {
          expect(params.id).toBe(String(TEST_INSTANCE_ID));
          return HttpResponse.json(createApiResponse(mockInstance));
        })
      );

      const result = await fetchBBBInstance(TEST_INSTANCE_ID);

      expect(result).toEqual(mockInstance);
      expect(result.id).toBe(TEST_INSTANCE_ID);
      expect(result.name).toBe('Weekly Team Meeting');
    });

    it('should correctly parse instance with room only type', async () => {
      const mockInstance = createMockBBBInstance({
        type: 1 as BBBInstanceType, // BBBInstanceType.ROOM_ONLY
        recordings: false,
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id`, () => {
          return HttpResponse.json(createApiResponse(mockInstance));
        })
      );

      const result = await fetchBBBInstance(TEST_INSTANCE_ID);

      expect(result.type).toBe(1);
      expect(result.recordings).toBe(false);
    });

    it('should correctly parse instance with scheduled opening/closing times', async () => {
      const openingTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const closingTime = openingTime + 7200; // 2 hours after opening

      const mockInstance = createMockBBBInstance({
        openingTime,
        closingTime,
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id`, () => {
          return HttpResponse.json(createApiResponse(mockInstance));
        })
      );

      const result = await fetchBBBInstance(TEST_INSTANCE_ID);

      expect(result.openingTime).toBe(openingTime);
      expect(result.closingTime).toBe(closingTime);
    });

    it('should correctly parse instance with user limit configuration', async () => {
      const mockInstance = createMockBBBInstance({
        userLimit: 50,
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id`, () => {
          return HttpResponse.json(createApiResponse(mockInstance));
        })
      );

      const result = await fetchBBBInstance(TEST_INSTANCE_ID);

      expect(result.userLimit).toBe(50);
    });

    it('should correctly parse instance with multiple presentations', async () => {
      const mockInstance = createMockBBBInstance({
        presentations: [
          { url: 'https://example.com/slide1.pdf', name: 'Agenda', iconName: 'pdf', iconDesc: 'PDF' },
          { url: 'https://example.com/slide2.pptx', name: 'Report', iconName: 'pptx', iconDesc: 'PowerPoint' },
        ],
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id`, () => {
          return HttpResponse.json(createApiResponse(mockInstance));
        })
      );

      const result = await fetchBBBInstance(TEST_INSTANCE_ID);

      expect(result.presentations).toHaveLength(2);
      expect(result.presentations[0]?.name).toBe('Agenda');
      expect(result.presentations[1]?.name).toBe('Report');
    });

    it('should correctly parse instance with group settings', async () => {
      const mockInstance = createMockBBBInstance({
        groupId: 5,
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id`, () => {
          return HttpResponse.json(createApiResponse(mockInstance));
        })
      );

      const result = await fetchBBBInstance(TEST_INSTANCE_ID);

      expect(result.groupId).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should handle 404 instance not found error', async () => {
      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id`, () => {
          return HttpResponse.json(
            createApiErrorResponse('NOT_FOUND', 'BigBlueButton instance not found'),
            { status: 404 }
          );
        })
      );

      await expect(fetchBBBInstance(999)).rejects.toThrow();
    });

    it('should handle 403 permission denied error', async () => {
      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id`, () => {
          return HttpResponse.json(
            createApiErrorResponse('PERMISSION_DENIED', 'You do not have permission to access this resource', {
              required_capability: 'mod/bigbluebuttonbn:view',
              context: 'course',
            }),
            { status: 403 }
          );
        })
      );

      await expect(fetchBBBInstance(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle network failure', async () => {
      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id`, () => {
          return HttpResponse.error();
        })
      );

      await expect(fetchBBBInstance(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle malformed response', async () => {
      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id`, () => {
          return HttpResponse.json({ invalid: 'response' });
        })
      );

      // The interceptor wraps non-standard responses in the standard envelope
      // So { invalid: 'response' } becomes { success: true, data: { invalid: 'response' }, meta: {} }
      // And fetchBBBInstance returns response.data.data which is the original malformed object
      const result = await fetchBBBInstance(TEST_INSTANCE_ID);
      expect(result).toEqual({ invalid: 'response' });
    });
  });
});

// ============================================================================
// fetchBBBMeetingStatus Tests
// ============================================================================

describe('fetchBBBMeetingStatus', () => {
  describe('successful requests', () => {
    it('should fetch meeting status when room is open but not running', async () => {
      const mockStatus = createMockBBBRoomStatus({
        statusRunning: false,
        statusOpen: true,
        statusClosed: false,
        canJoin: true,
        statusMessage: 'Room is open. Click to join.',
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/status`, ({ params }) => {
          expect(params.id).toBe(String(TEST_INSTANCE_ID));
          return HttpResponse.json(createApiResponse(mockStatus));
        })
      );

      const result = await fetchBBBMeetingStatus(TEST_INSTANCE_ID);

      expect(result.statusRunning).toBe(false);
      expect(result.statusOpen).toBe(true);
      expect(result.canJoin).toBe(true);
    });

    it('should fetch meeting status when meeting is running with participants', async () => {
      const mockStatus = createMockBBBRoomStatus({
        statusRunning: true,
        statusOpen: true,
        statusClosed: false,
        moderatorCount: 2,
        participantCount: 15,
        moderatorPlural: true,
        participantPlural: true,
        canJoin: true,
        statusMessage: '15 participants in meeting',
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/status`, () => {
          return HttpResponse.json(createApiResponse(mockStatus));
        })
      );

      const result = await fetchBBBMeetingStatus(TEST_INSTANCE_ID);

      expect(result.statusRunning).toBe(true);
      expect(result.participantCount).toBe(15);
      expect(result.moderatorCount).toBe(2);
      expect(result.participantPlural).toBe(true);
    });

    it('should fetch meeting status when room is closed', async () => {
      const mockStatus = createMockBBBRoomStatus({
        statusRunning: false,
        statusOpen: false,
        statusClosed: true,
        canJoin: false,
        statusMessage: 'This room is closed',
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/status`, () => {
          return HttpResponse.json(createApiResponse(mockStatus));
        })
      );

      const result = await fetchBBBMeetingStatus(TEST_INSTANCE_ID);

      expect(result.statusClosed).toBe(true);
      expect(result.canJoin).toBe(false);
    });

    it('should correctly parse scheduled opening and closing times', async () => {
      const openingTime = Math.floor(Date.now() / 1000) + 3600;
      const closingTime = openingTime + 7200;

      const mockStatus = createMockBBBRoomStatus({
        openingTime,
        closingTime,
        statusOpen: false,
        canJoin: false,
        statusMessage: 'Room opens in 1 hour',
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/status`, () => {
          return HttpResponse.json(createApiResponse(mockStatus));
        })
      );

      const result = await fetchBBBMeetingStatus(TEST_INSTANCE_ID);

      expect(result.openingTime).toBe(openingTime);
      expect(result.closingTime).toBe(closingTime);
      expect(result.canJoin).toBe(false);
    });

    it('should correctly handle single moderator/participant (no plural)', async () => {
      const mockStatus = createMockBBBRoomStatus({
        statusRunning: true,
        moderatorCount: 1,
        participantCount: 1,
        moderatorPlural: false,
        participantPlural: false,
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/status`, () => {
          return HttpResponse.json(createApiResponse(mockStatus));
        })
      );

      const result = await fetchBBBMeetingStatus(TEST_INSTANCE_ID);

      expect(result.moderatorPlural).toBe(false);
      expect(result.participantPlural).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle 404 instance not found error', async () => {
      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/status`, () => {
          return HttpResponse.json(
            createApiErrorResponse('NOT_FOUND', 'BigBlueButton instance not found'),
            { status: 404 }
          );
        })
      );

      await expect(fetchBBBMeetingStatus(999)).rejects.toThrow();
    });

    it('should handle 503 BBB server unavailable', async () => {
      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/status`, () => {
          return HttpResponse.json(
            createApiErrorResponse('BBB_SERVER_UNAVAILABLE', 'BigBlueButton server is not responding'),
            { status: 503 }
          );
        })
      );

      await expect(fetchBBBMeetingStatus(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle network timeout', async () => {
      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/status`, () => {
          // Use HttpResponse.error() to simulate a network error (timeout, connection refused, etc.)
          // MSW will reject the request immediately with a network error
          return HttpResponse.error();
        })
      );

      // Network errors cause axios to reject the promise
      await expect(fetchBBBMeetingStatus(TEST_INSTANCE_ID)).rejects.toThrow();
    });
  });
});

// ============================================================================
// fetchBBBRecordings Tests
// ============================================================================

describe('fetchBBBRecordings', () => {
  describe('successful requests', () => {
    it('should fetch recordings list successfully', async () => {
      const mockRecordings = [
        createMockBBBRecording({ id: 1, name: 'Recording 1' }),
        createMockBBBRecording({ id: 2, name: 'Recording 2' }),
        createMockBBBRecording({ id: 3, name: 'Recording 3' }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/recordings`, ({ params }) => {
          expect(params.id).toBe(String(TEST_INSTANCE_ID));
          return HttpResponse.json(createApiResponse(mockRecordings));
        })
      );

      const result = await fetchBBBRecordings(TEST_INSTANCE_ID);

      expect(result).toHaveLength(3);
      expect(result[0]?.name).toBe('Recording 1');
      expect(result[2]?.name).toBe('Recording 3');
    });

    it('should return empty array when no recordings exist', async () => {
      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/recordings`, () => {
          return HttpResponse.json(createApiResponse([]));
        })
      );

      const result = await fetchBBBRecordings(TEST_INSTANCE_ID);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should correctly parse recording with multiple playback formats', async () => {
      const mockRecording = createMockBBBRecording({
        playbacks: [
          { type: 'presentation', url: 'https://bbb.example.com/presentation', length: 3600000 },
          { type: 'video', url: 'https://bbb.example.com/video', length: 3600000 },
          { type: 'podcast', url: 'https://bbb.example.com/podcast', length: 3600000 },
        ],
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/recordings`, () => {
          return HttpResponse.json(createApiResponse([mockRecording]));
        })
      );

      const result = await fetchBBBRecordings(TEST_INSTANCE_ID);

      expect(result[0]?.playbacks).toHaveLength(3);
      expect(result[0]?.playbacks?.[0]?.type).toBe('presentation');
      expect(result[0]?.playbacks?.[1]?.type).toBe('video');
      expect(result[0]?.playbacks?.[2]?.type).toBe('podcast');
    });

    it('should correctly parse published and unpublished recordings', async () => {
      const mockRecordings = [
        createMockBBBRecording({ id: 1, published: true }),
        createMockBBBRecording({ id: 2, published: false }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/recordings`, () => {
          return HttpResponse.json(createApiResponse(mockRecordings));
        })
      );

      const result = await fetchBBBRecordings(TEST_INSTANCE_ID);

      expect(result[0]?.published).toBe(true);
      expect(result[1]?.published).toBe(false);
    });

    it('should correctly parse imported recordings', async () => {
      const mockRecording = createMockBBBRecording({
        imported: true,
        headless: false,
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/recordings`, () => {
          return HttpResponse.json(createApiResponse([mockRecording]));
        })
      );

      const result = await fetchBBBRecordings(TEST_INSTANCE_ID);

      expect(result[0]?.imported).toBe(true);
    });

    it('should correctly parse recordings with various status values', async () => {
      const mockRecordings = [
        createMockBBBRecording({ id: 1, status: 0 as BBBRecordingStatus }), // AWAITING
        createMockBBBRecording({ id: 2, status: 2 as BBBRecordingStatus }), // PROCESSED
        createMockBBBRecording({ id: 3, status: 5 as BBBRecordingStatus }), // DELETED
      ];

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/recordings`, () => {
          return HttpResponse.json(createApiResponse(mockRecordings));
        })
      );

      const result = await fetchBBBRecordings(TEST_INSTANCE_ID);

      expect(result[0]?.status).toBe(0);
      expect(result[1]?.status).toBe(2);
      expect(result[2]?.status).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should handle 404 instance not found error', async () => {
      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/recordings`, () => {
          return HttpResponse.json(
            createApiErrorResponse('NOT_FOUND', 'BigBlueButton instance not found'),
            { status: 404 }
          );
        })
      );

      await expect(fetchBBBRecordings(999)).rejects.toThrow();
    });

    it('should handle 403 permission denied for viewing recordings', async () => {
      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/recordings`, () => {
          return HttpResponse.json(
            createApiErrorResponse('PERMISSION_DENIED', 'You do not have permission to view recordings'),
            { status: 403 }
          );
        })
      );

      await expect(fetchBBBRecordings(TEST_INSTANCE_ID)).rejects.toThrow();
    });
  });
});

// ============================================================================
// joinBBBMeeting Tests
// ============================================================================

describe('joinBBBMeeting', () => {
  describe('successful requests', () => {
    it('should join meeting as moderator successfully', async () => {
      const mockJoinResponse = {
        joinUrl: 'https://bbb.example.com/join?meetingID=abc123&fullName=Teacher&password=mod123',
        isModerator: true,
        meetingId: 'abc123',
      };

      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, async ({ params }) => {
          expect(params.id).toBe(String(TEST_INSTANCE_ID));
          return HttpResponse.json(createApiResponse(mockJoinResponse));
        })
      );

      const result = await joinBBBMeeting(TEST_INSTANCE_ID);

      expect(result.joinUrl).toContain('bbb.example.com/join');
      expect(result.isModerator).toBe(true);
      expect(result.meetingId).toBe('abc123');
    });

    it('should join meeting as attendee successfully', async () => {
      const mockJoinResponse = {
        joinUrl: 'https://bbb.example.com/join?meetingID=abc123&fullName=Student&password=att123',
        isModerator: false,
        meetingId: 'abc123',
      };

      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, () => {
          return HttpResponse.json(createApiResponse(mockJoinResponse));
        })
      );

      const result = await joinBBBMeeting(TEST_INSTANCE_ID);

      expect(result.isModerator).toBe(false);
    });

    it('should join meeting with custom options', async () => {
      const mockJoinResponse = {
        joinUrl: 'https://bbb.example.com/join?meetingID=abc123',
        isModerator: true,
        meetingId: 'abc123',
      };

      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, async ({ request }) => {
          const body = await request.json() as Record<string, unknown>;
          expect(body.redirect).toBe(true);
          expect(body.joinViaHtml5).toBe(true);
          return HttpResponse.json(createApiResponse(mockJoinResponse));
        })
      );

      const result = await joinBBBMeeting(TEST_INSTANCE_ID, {
        redirect: true,
        joinViaHtml5: true,
      });

      expect(result.joinUrl).toBeDefined();
    });

    it('should join meeting with guest credentials', async () => {
      const mockJoinResponse = {
        joinUrl: 'https://bbb.example.com/join?meetingID=abc123&guest=true',
        isModerator: false,
        meetingId: 'abc123',
      };

      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, async ({ request }) => {
          const body = await request.json() as Record<string, unknown>;
          expect(body.guestName).toBe('Guest User');
          expect(body.guestPassword).toBe('guest123');
          return HttpResponse.json(createApiResponse(mockJoinResponse));
        })
      );

      const result = await joinBBBMeeting(TEST_INSTANCE_ID, {
        guestName: 'Guest User',
        guestPassword: 'guest123',
      });

      expect(result.isModerator).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle meeting full error (user limit reached)', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, () => {
          return HttpResponse.json(
            createApiErrorResponse('USER_LIMIT_REACHED', 'The meeting has reached its maximum capacity', {
              userLimit: 50,
              currentUsers: 50,
            }),
            { status: 409 }
          );
        })
      );

      await expect(joinBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle meeting not started (wait for moderator) error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, () => {
          return HttpResponse.json(
            createApiErrorResponse('WAIT_FOR_MODERATOR', 'A moderator must start the meeting before you can join'),
            { status: 403 }
          );
        })
      );

      await expect(joinBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle room closed error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, () => {
          return HttpResponse.json(
            createApiErrorResponse('ROOM_CLOSED', 'This meeting room is currently closed'),
            { status: 403 }
          );
        })
      );

      await expect(joinBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle room not yet open error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, () => {
          return HttpResponse.json(
            createApiErrorResponse('ROOM_NOT_OPEN', 'This meeting room has not opened yet', {
              openingTime: Math.floor(Date.now() / 1000) + 3600,
            }),
            { status: 403 }
          );
        })
      );

      await expect(joinBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle 403 permission denied error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, () => {
          return HttpResponse.json(
            createApiErrorResponse('PERMISSION_DENIED', 'You do not have permission to join this meeting'),
            { status: 403 }
          );
        })
      );

      await expect(joinBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle 503 BBB server unavailable', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, () => {
          return HttpResponse.json(
            createApiErrorResponse('BBB_SERVER_UNAVAILABLE', 'BigBlueButton server is not responding'),
            { status: 503 }
          );
        })
      );

      await expect(joinBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle invalid guest password error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, () => {
          return HttpResponse.json(
            createApiErrorResponse('INVALID_GUEST_PASSWORD', 'The guest password is incorrect'),
            { status: 401 }
          );
        })
      );

      await expect(
        joinBBBMeeting(TEST_INSTANCE_ID, { guestPassword: 'wrongpassword' })
      ).rejects.toThrow();
    });

    it('should handle network failure', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, () => {
          return HttpResponse.error();
        })
      );

      await expect(joinBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });
  });

  describe('concurrent join requests', () => {
    it('should handle multiple simultaneous join requests', async () => {
      let requestCount = 0;

      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, async () => {
          requestCount++;
          // Simulate slight delay to ensure requests overlap
          await new Promise((resolve) => setTimeout(resolve, 10));
          return HttpResponse.json(
            createApiResponse({
              joinUrl: `https://bbb.example.com/join?seq=${requestCount}`,
              isModerator: false,
              meetingId: 'abc123',
            })
          );
        })
      );

      // Fire multiple concurrent requests
      const results = await Promise.all([
        joinBBBMeeting(TEST_INSTANCE_ID),
        joinBBBMeeting(TEST_INSTANCE_ID),
        joinBBBMeeting(TEST_INSTANCE_ID),
      ]);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.joinUrl).toBeDefined();
        expect(result.meetingId).toBe('abc123');
      });
    });
  });
});

// ============================================================================
// createBBBMeeting Tests
// ============================================================================

describe('createBBBMeeting', () => {
  describe('successful requests', () => {
    it('should create meeting successfully', async () => {
      const mockCreateResponse = {
        created: true,
        internalMeetingId: 'internal-abc123',
        meetingId: 'bbb-meeting-123-abc',
        joinUrl: 'https://bbb.example.com/join?meetingID=bbb-meeting-123-abc',
      };

      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/create`, ({ params }) => {
          expect(params.id).toBe(String(TEST_INSTANCE_ID));
          return HttpResponse.json(createApiResponse(mockCreateResponse));
        })
      );

      const result = await createBBBMeeting(TEST_INSTANCE_ID);

      expect(result.created).toBe(true);
      expect(result.internalMeetingId).toBe('internal-abc123');
      expect(result.meetingId).toBe('bbb-meeting-123-abc');
      expect(result.joinUrl).toContain('bbb.example.com/join');
    });
  });

  describe('error handling', () => {
    it('should handle 409 meeting already running error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/create`, () => {
          return HttpResponse.json(
            createApiErrorResponse('MEETING_ALREADY_RUNNING', 'A meeting is already in progress'),
            { status: 409 }
          );
        })
      );

      await expect(createBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle 403 permission denied (non-moderator) error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/create`, () => {
          return HttpResponse.json(
            createApiErrorResponse('PERMISSION_DENIED', 'Only moderators can create meetings', {
              required_capability: 'mod/bigbluebuttonbn:manage',
            }),
            { status: 403 }
          );
        })
      );

      await expect(createBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle 503 BBB server unavailable', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/create`, () => {
          return HttpResponse.json(
            createApiErrorResponse('BBB_SERVER_UNAVAILABLE', 'BigBlueButton server is not responding'),
            { status: 503 }
          );
        })
      );

      await expect(createBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle room closed error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/create`, () => {
          return HttpResponse.json(
            createApiErrorResponse('ROOM_CLOSED', 'This meeting room is currently closed'),
            { status: 403 }
          );
        })
      );

      await expect(createBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle BBB configuration error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/create`, () => {
          return HttpResponse.json(
            createApiErrorResponse('BBB_CONFIG_ERROR', 'BigBlueButton server is misconfigured'),
            { status: 500 }
          );
        })
      );

      await expect(createBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });
  });
});

// ============================================================================
// endBBBMeeting Tests
// ============================================================================

describe('endBBBMeeting', () => {
  describe('successful requests', () => {
    it('should end meeting successfully', async () => {
      const mockEndResponse = {
        ended: true,
        message: 'The meeting has been ended successfully',
      };

      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/end`, ({ params }) => {
          expect(params.id).toBe(String(TEST_INSTANCE_ID));
          return HttpResponse.json(createApiResponse(mockEndResponse));
        })
      );

      const result = await endBBBMeeting(TEST_INSTANCE_ID);

      expect(result.ended).toBe(true);
      expect(result.message).toBe('The meeting has been ended successfully');
    });
  });

  describe('error handling', () => {
    it('should handle 403 permission denied (non-moderator) error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/end`, () => {
          return HttpResponse.json(
            createApiErrorResponse('PERMISSION_DENIED', 'Only moderators can end meetings', {
              required_capability: 'mod/bigbluebuttonbn:manage',
            }),
            { status: 403 }
          );
        })
      );

      await expect(endBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle meeting not running error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/end`, () => {
          return HttpResponse.json(
            createApiErrorResponse('MEETING_NOT_RUNNING', 'There is no active meeting to end'),
            { status: 404 }
          );
        })
      );

      await expect(endBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle 503 BBB server unavailable', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/end`, () => {
          return HttpResponse.json(
            createApiErrorResponse('BBB_SERVER_UNAVAILABLE', 'BigBlueButton server is not responding'),
            { status: 503 }
          );
        })
      );

      await expect(endBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle network failure', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/end`, () => {
          return HttpResponse.error();
        })
      );

      await expect(endBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });
  });
});

// ============================================================================
// publishBBBRecording Tests
// ============================================================================

describe('publishBBBRecording', () => {
  describe('successful requests', () => {
    it('should publish recording successfully', async () => {
      const mockRecording = createMockBBBRecording({ published: true });
      const mockResponse = {
        success: true,
        recording: mockRecording,
        message: 'Recording has been published',
      };

      server.use(
        http.post(
          `${API_BASE_URL}/bigbluebuttonbn/recordings/:recordingId/publish`,
          async ({ params, request }) => {
            expect(params.recordingId).toBe(String(TEST_RECORDING_ID));
            const body = await request.json() as Record<string, unknown>;
            expect(body.published).toBe(true);
            return HttpResponse.json(createApiResponse(mockResponse));
          }
        )
      );

      const result = await publishBBBRecording(TEST_RECORDING_ID, true);

      expect(result.success).toBe(true);
      expect(result.recording?.published).toBe(true);
    });

    it('should unpublish recording successfully', async () => {
      const mockRecording = createMockBBBRecording({ published: false });
      const mockResponse = {
        success: true,
        recording: mockRecording,
        message: 'Recording has been unpublished',
      };

      server.use(
        http.post(
          `${API_BASE_URL}/bigbluebuttonbn/recordings/:recordingId/publish`,
          async ({ request }) => {
            const body = await request.json() as Record<string, unknown>;
            expect(body.published).toBe(false);
            return HttpResponse.json(createApiResponse(mockResponse));
          }
        )
      );

      const result = await publishBBBRecording(TEST_RECORDING_ID, false);

      expect(result.success).toBe(true);
      expect(result.recording?.published).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle 404 recording not found error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/:recordingId/publish`, () => {
          return HttpResponse.json(
            createApiErrorResponse('NOT_FOUND', 'Recording not found'),
            { status: 404 }
          );
        })
      );

      await expect(publishBBBRecording(999, true)).rejects.toThrow();
    });

    it('should handle 403 permission denied error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/:recordingId/publish`, () => {
          return HttpResponse.json(
            createApiErrorResponse('PERMISSION_DENIED', 'You do not have permission to manage recordings'),
            { status: 403 }
          );
        })
      );

      await expect(publishBBBRecording(TEST_RECORDING_ID, true)).rejects.toThrow();
    });

    it('should handle 503 BBB server unavailable', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/:recordingId/publish`, () => {
          return HttpResponse.json(
            createApiErrorResponse('BBB_SERVER_UNAVAILABLE', 'BigBlueButton server is not responding'),
            { status: 503 }
          );
        })
      );

      await expect(publishBBBRecording(TEST_RECORDING_ID, true)).rejects.toThrow();
    });
  });
});

// ============================================================================
// deleteBBBRecording Tests
// ============================================================================

describe('deleteBBBRecording', () => {
  describe('successful requests', () => {
    it('should delete recording successfully', async () => {
      const mockResponse = {
        success: true,
        recording: null,
        message: 'Recording has been deleted',
      };

      server.use(
        http.delete(
          `${API_BASE_URL}/bigbluebuttonbn/recordings/:recordingId`,
          ({ params }) => {
            expect(params.recordingId).toBe(String(TEST_RECORDING_ID));
            return HttpResponse.json(createApiResponse(mockResponse));
          }
        )
      );

      const result = await deleteBBBRecording(TEST_RECORDING_ID);

      expect(result.success).toBe(true);
      expect(result.recording).toBeNull();
      expect(result.message).toBe('Recording has been deleted');
    });
  });

  describe('error handling', () => {
    it('should handle 404 recording not found error', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/bigbluebuttonbn/recordings/:recordingId`, () => {
          return HttpResponse.json(
            createApiErrorResponse('NOT_FOUND', 'Recording not found or already deleted'),
            { status: 404 }
          );
        })
      );

      await expect(deleteBBBRecording(999)).rejects.toThrow();
    });

    it('should handle 403 permission denied (non-moderator) error', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/bigbluebuttonbn/recordings/:recordingId`, () => {
          return HttpResponse.json(
            createApiErrorResponse('PERMISSION_DENIED', 'Only moderators can delete recordings'),
            { status: 403 }
          );
        })
      );

      await expect(deleteBBBRecording(TEST_RECORDING_ID)).rejects.toThrow();
    });

    it('should handle protected recording error', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/bigbluebuttonbn/recordings/:recordingId`, () => {
          return HttpResponse.json(
            createApiErrorResponse('RECORDING_PROTECTED', 'This recording is protected and cannot be deleted'),
            { status: 403 }
          );
        })
      );

      await expect(deleteBBBRecording(TEST_RECORDING_ID)).rejects.toThrow();
    });

    it('should handle 503 BBB server unavailable', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/bigbluebuttonbn/recordings/:recordingId`, () => {
          return HttpResponse.json(
            createApiErrorResponse('BBB_SERVER_UNAVAILABLE', 'BigBlueButton server is not responding'),
            { status: 503 }
          );
        })
      );

      await expect(deleteBBBRecording(TEST_RECORDING_ID)).rejects.toThrow();
    });

    it('should handle network failure', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/bigbluebuttonbn/recordings/:recordingId`, () => {
          return HttpResponse.error();
        })
      );

      await expect(deleteBBBRecording(TEST_RECORDING_ID)).rejects.toThrow();
    });
  });
});

// ============================================================================
// importBBBRecording Tests
// ============================================================================

describe('importBBBRecording', () => {
  describe('successful requests', () => {
    it('should import recording successfully', async () => {
      const mockImportedRecording = createMockBBBRecording({
        id: 999,
        bigbluebuttonbnId: TEST_TARGET_INSTANCE_ID,
        imported: true,
      });
      const mockResponse = {
        success: true,
        recording: mockImportedRecording,
        message: 'Recording has been imported successfully',
      };

      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/import`, async ({ request }) => {
          const body = await request.json() as Record<string, unknown>;
          expect(body.sourceRecordingId).toBe(TEST_RECORDING_ID);
          expect(body.targetInstanceId).toBe(TEST_TARGET_INSTANCE_ID);
          return HttpResponse.json(createApiResponse(mockResponse));
        })
      );

      const result = await importBBBRecording(TEST_RECORDING_ID, TEST_TARGET_INSTANCE_ID);

      expect(result.success).toBe(true);
      expect(result.recording?.imported).toBe(true);
      expect(result.recording?.bigbluebuttonbnId).toBe(TEST_TARGET_INSTANCE_ID);
    });
  });

  describe('error handling', () => {
    it('should handle 404 source recording not found error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/import`, () => {
          return HttpResponse.json(
            createApiErrorResponse('SOURCE_NOT_FOUND', 'Source recording not found'),
            { status: 404 }
          );
        })
      );

      await expect(importBBBRecording(999, TEST_TARGET_INSTANCE_ID)).rejects.toThrow();
    });

    it('should handle 404 target instance not found error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/import`, () => {
          return HttpResponse.json(
            createApiErrorResponse('TARGET_NOT_FOUND', 'Target BigBlueButton instance not found'),
            { status: 404 }
          );
        })
      );

      await expect(importBBBRecording(TEST_RECORDING_ID, 999)).rejects.toThrow();
    });

    it('should handle 403 permission denied error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/import`, () => {
          return HttpResponse.json(
            createApiErrorResponse('PERMISSION_DENIED', 'You do not have permission to import recordings'),
            { status: 403 }
          );
        })
      );

      await expect(
        importBBBRecording(TEST_RECORDING_ID, TEST_TARGET_INSTANCE_ID)
      ).rejects.toThrow();
    });

    it('should handle 409 recording already imported error', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/recordings/import`, () => {
          return HttpResponse.json(
            createApiErrorResponse('ALREADY_IMPORTED', 'This recording has already been imported to the target instance'),
            { status: 409 }
          );
        })
      );

      await expect(
        importBBBRecording(TEST_RECORDING_ID, TEST_TARGET_INSTANCE_ID)
      ).rejects.toThrow();
    });
  });
});

// ============================================================================
// Query Keys Tests
// ============================================================================

describe('bbbQueryKeys', () => {
  it('should generate correct all query key', () => {
    expect(bbbQueryKeys.all).toEqual(['bigbluebuttonbn']);
  });

  it('should generate correct instances query key', () => {
    expect(bbbQueryKeys.instances()).toEqual(['bigbluebuttonbn', 'instances']);
  });

  it('should generate correct instance query key with id', () => {
    expect(bbbQueryKeys.instance(123)).toEqual(['bigbluebuttonbn', 123, 'instance']);
  });

  it('should generate correct statuses query key', () => {
    expect(bbbQueryKeys.statuses()).toEqual(['bigbluebuttonbn', 'statuses']);
  });

  it('should generate correct status query key with id', () => {
    expect(bbbQueryKeys.status(123)).toEqual(['bigbluebuttonbn', 123, 'status']);
  });

  it('should generate correct recordings query key', () => {
    expect(bbbQueryKeys.recordings()).toEqual(['bigbluebuttonbn', 'recordings']);
  });

  it('should generate correct instance recordings query key', () => {
    expect(bbbQueryKeys.instanceRecordings(123)).toEqual(['bigbluebuttonbn', 123, 'recordings']);
  });

  it('should generate correct recording query key with id', () => {
    expect(bbbQueryKeys.recording(456)).toEqual(['bigbluebuttonbn', 'recording', 456]);
  });
});

// ============================================================================
// API Envelope Parsing Tests
// ============================================================================

describe('API envelope parsing', () => {
  it('should correctly parse success response with data', async () => {
    const mockInstance = createMockBBBInstance();

    server.use(
      http.get(`${API_BASE_URL}/bigbluebuttonbn/:id`, () => {
        return HttpResponse.json({
          success: true,
          data: mockInstance,
          meta: {
            timestamp: Date.now(),
          },
        });
      })
    );

    const result = await fetchBBBInstance(TEST_INSTANCE_ID);

    expect(result).toEqual(mockInstance);
  });

  it('should correctly parse success response with pagination metadata', async () => {
    const mockRecordings = [createMockBBBRecording()];

    server.use(
      http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/recordings`, () => {
        return HttpResponse.json({
          success: true,
          data: mockRecordings,
          meta: {
            pagination: {
              page: 1,
              perPage: 20,
              total: 1,
              totalPages: 1,
            },
          },
        });
      })
    );

    const result = await fetchBBBRecordings(TEST_INSTANCE_ID);

    expect(result).toHaveLength(1);
  });

  it('should handle error response with proper error code and message', async () => {
    server.use(
      http.get(`${API_BASE_URL}/bigbluebuttonbn/:id`, () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'BigBlueButton instance not found',
              details: {
                requestedId: 999,
              },
            },
          },
          { status: 404 }
        );
      })
    );

    await expect(fetchBBBInstance(999)).rejects.toThrow();
  });
});

// ============================================================================
// TypeScript Type Inference Tests
// ============================================================================

describe('TypeScript type inference', () => {
  it('should correctly infer BBBInstance type from fetchBBBInstance', async () => {
    const mockInstance = createMockBBBInstance();

    server.use(
      http.get(`${API_BASE_URL}/bigbluebuttonbn/:id`, () => {
        return HttpResponse.json(createApiResponse(mockInstance));
      })
    );

    const result = await fetchBBBInstance(TEST_INSTANCE_ID);

    // TypeScript type assertions
    const id: number = result.id;
    const name: string = result.name;
    const courseId: number = result.courseId;
    const type: BBBInstanceType = result.type;

    expect(id).toBe(TEST_INSTANCE_ID);
    expect(name).toBe('Weekly Team Meeting');
    expect(typeof courseId).toBe('number');
    expect(typeof type).toBe('number');
  });

  it('should correctly infer BBBRoomStatus type from fetchBBBMeetingStatus', async () => {
    const mockStatus = createMockBBBRoomStatus();

    server.use(
      http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/status`, () => {
        return HttpResponse.json(createApiResponse(mockStatus));
      })
    );

    const result = await fetchBBBMeetingStatus(TEST_INSTANCE_ID);

    // TypeScript type assertions
    const statusRunning: boolean = result.statusRunning;
    const statusClosed: boolean = result.statusClosed;
    const statusOpen: boolean = result.statusOpen;
    const moderatorCount: number = result.moderatorCount;
    const participantCount: number = result.participantCount;
    const canJoin: boolean = result.canJoin;

    expect(typeof statusRunning).toBe('boolean');
    expect(typeof statusClosed).toBe('boolean');
    expect(typeof statusOpen).toBe('boolean');
    expect(typeof moderatorCount).toBe('number');
    expect(typeof participantCount).toBe('number');
    expect(typeof canJoin).toBe('boolean');
  });

  it('should correctly infer BBBRecording[] type from fetchBBBRecordings', async () => {
    const mockRecordings = [createMockBBBRecording()];

    server.use(
      http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/recordings`, () => {
        return HttpResponse.json(createApiResponse(mockRecordings));
      })
    );

    const result = await fetchBBBRecordings(TEST_INSTANCE_ID);

    // TypeScript type assertions
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      const recording = result[0];
      if (recording) {
        const id: number = recording.id;
        const name: string | null = recording.name;
        const published: boolean | null = recording.published;
        const status: BBBRecordingStatus = recording.status;

        expect(typeof id).toBe('number');
        expect(typeof status).toBe('number');
        // Use variables to satisfy TypeScript strict mode
        expect(name === null || typeof name === 'string').toBe(true);
        expect(published === null || typeof published === 'boolean').toBe(true);
      }
    }
  });
});

// ============================================================================
// Edge Cases and Integration Scenarios
// ============================================================================

describe('edge cases and integration scenarios', () => {
  describe('meeting not started scenarios', () => {
    it('should handle participant joining before moderator starts meeting', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, () => {
          return HttpResponse.json(
            createApiErrorResponse(
              'WAIT_FOR_MODERATOR',
              'Please wait for a moderator to start the meeting',
              { waitingForModerator: true }
            ),
            { status: 403 }
          );
        })
      );

      await expect(joinBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });
  });

  describe('maximum participants limit', () => {
    it('should handle meeting at capacity with configured limit', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, () => {
          return HttpResponse.json(
            createApiErrorResponse(
              'USER_LIMIT_REACHED',
              'The meeting has reached its maximum capacity of 50 participants',
              {
                userLimit: 50,
                currentUsers: 50,
                waitingList: 3,
              }
            ),
            { status: 409 }
          );
        })
      );

      await expect(joinBBBMeeting(TEST_INSTANCE_ID)).rejects.toThrow();
    });
  });

  describe('guest access handling', () => {
    it('should handle guest access when enabled', async () => {
      const mockJoinResponse = {
        joinUrl: 'https://bbb.example.com/join?guest=true&name=Guest',
        isModerator: false,
        meetingId: 'abc123',
      };

      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, async ({ request }) => {
          const body = await request.json() as Record<string, unknown>;
          if (body.guestName) {
            return HttpResponse.json(createApiResponse(mockJoinResponse));
          }
          return HttpResponse.json(
            createApiErrorResponse('GUEST_NAME_REQUIRED', 'Guest name is required'),
            { status: 400 }
          );
        })
      );

      const result = await joinBBBMeeting(TEST_INSTANCE_ID, {
        guestName: 'Guest User',
      });

      expect(result.joinUrl).toContain('guest=true');
    });

    it('should handle guest access when disabled', async () => {
      server.use(
        http.post(`${API_BASE_URL}/bigbluebuttonbn/:id/join`, () => {
          return HttpResponse.json(
            createApiErrorResponse('GUEST_ACCESS_DISABLED', 'Guest access is not enabled for this meeting'),
            { status: 403 }
          );
        })
      );

      await expect(
        joinBBBMeeting(TEST_INSTANCE_ID, { guestName: 'Guest User' })
      ).rejects.toThrow();
    });
  });

  describe('recording management edge cases', () => {
    it('should handle orphaned recording (headless)', async () => {
      const mockRecording = createMockBBBRecording({
        headless: true,
        bigbluebuttonbnId: 0, // No associated instance
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/recordings`, () => {
          return HttpResponse.json(createApiResponse([mockRecording]));
        })
      );

      const result = await fetchBBBRecordings(TEST_INSTANCE_ID);

      expect(result[0]?.headless).toBe(true);
    });

    it('should handle recording with null playbacks', async () => {
      const mockRecording = createMockBBBRecording({
        playbacks: null,
        status: 0 as BBBRecordingStatus, // AWAITING
      });

      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/recordings`, () => {
          return HttpResponse.json(createApiResponse([mockRecording]));
        })
      );

      const result = await fetchBBBRecordings(TEST_INSTANCE_ID);

      expect(result[0]?.playbacks).toBeNull();
      expect(result[0]?.status).toBe(0);
    });
  });

  describe('authentication token handling', () => {
    it('should handle authentication error (401)', async () => {
      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id`, () => {
          return HttpResponse.json(
            createApiErrorResponse('AUTHENTICATION_REQUIRED', 'Authentication token is invalid or expired'),
            { status: 401 }
          );
        })
      );

      await expect(fetchBBBInstance(TEST_INSTANCE_ID)).rejects.toThrow();
    });
  });

  describe('request timeout scenarios', () => {
    it('should handle very slow responses', async () => {
      server.use(
        http.get(`${API_BASE_URL}/bigbluebuttonbn/:id/status`, async () => {
          // Simulate slow response
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json(createApiResponse(createMockBBBRoomStatus()));
        })
      );

      const result = await fetchBBBMeetingStatus(TEST_INSTANCE_ID);

      expect(result).toBeDefined();
      expect(result.statusOpen).toBe(true);
    });
  });
});
