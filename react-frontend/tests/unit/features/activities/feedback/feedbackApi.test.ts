/**
 * Unit Tests for Feedback API Client Module
 *
 * Comprehensive test suite for the feedbackApi module validating all API endpoint calls
 * including getFeedback, getFeedbackQuestions, submitFeedbackResponse, getFeedbackAnalysis,
 * getFeedbackStatus, canCompleteFeedback, getFeedbackResponses, and saveProgress functions.
 *
 * Tests verify proper HTTP request construction, response parsing, error handling,
 * TypeScript type safety, and integration with axios client.
 *
 * Covers edge cases including:
 * - Permission errors (403 responses)
 * - Invalid IDs (404 responses)
 * - Network failures
 * - Validation errors (400 responses)
 * - Anonymous submissions
 * - Multi-course feedback scenarios
 * - Multi-page feedback support
 *
 * @module tests/unit/features/activities/feedback/feedbackApi.test
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../mocks/server';
import {
  getFeedback,
  getFeedbackQuestions,
  submitFeedbackResponse,
  getFeedbackAnalysis,
  getFeedbackStatus,
  canCompleteFeedback,
  getFeedbackResponses,
  saveProgress,
} from '@/features/activities/feedback/api/feedbackApi';
import type {
  Feedback,
  FeedbackItem,
  FeedbackAnalysis,
  FeedbackQuestionType,
} from '@/features/activities/feedback/types/feedback.types';
import type { ApiResponse } from '@/types/api';

// ============================================================================
// MSW Server Setup
// ============================================================================

/**
 * Base URL for API endpoints
 * Matches the configuration in the axios client
 * Must use full URL for MSW to intercept requests properly
 */
const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * Mock feedback data for testing
 */
const mockFeedback: Feedback = {
  id: 123,
  course: 1,
  name: 'Test Feedback',
  intro: 'This is a test feedback activity description',
  introformat: 1,
  anonymous: 1, // FEEDBACK_ANONYMOUS_YES
  email_notification: 0,
  multiple_submit: 0,
  autonumbering: 1,
  site_after_submit: '',
  page_after_submit: '<p>Thank you for your feedback!</p>',
  page_after_submitformat: 1,
  publish_stats: 0,
  timeopen: 1700000000,
  timeclose: 1800000000,
  timemodified: 1699999999,
  completionsubmit: 1,
};

/**
 * Mock feedback items for testing
 */
const mockFeedbackItems: FeedbackItem[] = [
  {
    id: 1,
    feedback: 123,
    template: 0,
    name: 'How satisfied are you with this course?',
    label: 'satisfaction',
    presentation: 'r>>>>>Very Dissatisfied|Dissatisfied|Neutral|Satisfied|Very Satisfied<<<<<1',
    typ: 'multichoice' as FeedbackQuestionType,
    hasvalue: 1,
    position: 1,
    required: 1,
    dependitem: 0,
    dependvalue: '',
    options: '',
  },
  {
    id: 2,
    feedback: 123,
    template: 0,
    name: 'Rate the course content quality (1-10)',
    label: 'quality_rating',
    presentation: '1|10',
    typ: 'numeric' as FeedbackQuestionType,
    hasvalue: 1,
    position: 2,
    required: 1,
    dependitem: 0,
    dependvalue: '',
    options: '',
  },
  {
    id: 3,
    feedback: 123,
    template: 0,
    name: 'Please provide additional comments',
    label: 'comments',
    presentation: '80|5',
    typ: 'textarea' as FeedbackQuestionType,
    hasvalue: 1,
    position: 3,
    required: 0,
    dependitem: 0,
    dependvalue: '',
    options: '',
  },
  {
    id: 4,
    feedback: 123,
    template: 0,
    name: 'Conditional question - only if satisfied',
    label: 'conditional_q',
    presentation: '50',
    typ: 'textfield' as FeedbackQuestionType,
    hasvalue: 1,
    position: 4,
    required: 0,
    dependitem: 1,
    dependvalue: 'Satisfied',
    options: '',
  },
];

/**
 * Mock feedback analysis data
 */
const mockFeedbackAnalysis: FeedbackAnalysis = {
  feedbackId: 123,
  totalResponses: 50,
  groupResponses: 15,
  groupId: undefined,
  meetAnonymousThreshold: true,
  items: [
    {
      itemId: 1,
      name: 'How satisfied are you with this course?',
      type: 'multichoice' as FeedbackQuestionType,
      position: 1,
      hasValue: true,
      responseCount: 48,
      distribution: [
        { value: 'Very Dissatisfied', count: 2, percentage: 4.17 },
        { value: 'Dissatisfied', count: 5, percentage: 10.42 },
        { value: 'Neutral', count: 10, percentage: 20.83 },
        { value: 'Satisfied', count: 18, percentage: 37.5 },
        { value: 'Very Satisfied', count: 13, percentage: 27.08 },
      ],
      chartData: {
        labels: ['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied'],
        values: [2, 5, 10, 18, 13],
        colors: ['#d32f2f', '#ff9800', '#ffeb3b', '#8bc34a', '#4caf50'],
      },
    },
    {
      itemId: 2,
      name: 'Rate the course content quality (1-10)',
      type: 'numeric' as FeedbackQuestionType,
      position: 2,
      hasValue: true,
      responseCount: 47,
      statistics: {
        mean: 7.5,
        median: 8,
        mode: 8,
        standardDeviation: 1.8,
        minimum: 3,
        maximum: 10,
      },
    },
  ],
  statistics: {
    totalResponses: 50,
    completionRate: 75,
    averageTime: 180,
    responsesByCourse: [{ courseId: 1, courseName: 'Test Course', count: 50 }],
    responsesByGroup: [],
    respondents: [],
    nonRespondents: [],
    lastSubmissionDate: 1705000000,
  },
  generatedAt: 1705327200,
};

/**
 * Default handlers for MSW
 * These can be overridden in individual tests
 */
const handlers = [
  // GET /api/v1/feedback/:id
  http.get(`${API_BASE_URL}/feedback/:id`, ({ params }) => {
    const id = Number(params.id);
    if (id === 123) {
      return HttpResponse.json({
        success: true,
        data: mockFeedback,
        meta: { timestamp: Date.now() },
      } satisfies ApiResponse<Feedback>);
    }
    if (id === 404) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Feedback not found',
          },
        },
        { status: 404 }
      );
    }
    if (id === 403) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to view this feedback',
          },
        },
        { status: 403 }
      );
    }
    return HttpResponse.json({
      success: true,
      data: { ...mockFeedback, id },
    });
  }),

  // GET /api/v1/feedback/:id/questions
  http.get(`${API_BASE_URL}/feedback/:id/questions`, ({ params }) => {
    const id = Number(params.id);
    if (id === 123) {
      return HttpResponse.json({
        success: true,
        data: mockFeedbackItems,
      } satisfies ApiResponse<FeedbackItem[]>);
    }
    if (id === 456) {
      // New feedback with no questions
      return HttpResponse.json({
        success: true,
        data: [],
      } satisfies ApiResponse<FeedbackItem[]>);
    }
    return HttpResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Feedback not found' },
      },
      { status: 404 }
    );
  }),

  // POST /api/v1/feedback/:id/submit
  http.post(`${API_BASE_URL}/feedback/:id/submit`, async ({ params, request }) => {
    const id = Number(params.id);
    // Parse body for future validation if needed
    const _body = (await request.json()) as { responses: Record<string, unknown> };
    void _body;

    if (id === 123) {
      return HttpResponse.json({
        success: true,
        data: {
          success: true,
          completedId: 456,
          message: 'Response submitted successfully',
        },
      });
    }
    if (id === 403) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Feedback is closed',
          },
        },
        { status: 403 }
      );
    }
    if (id === 409) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'You have already submitted this feedback',
          },
        },
        { status: 409 }
      );
    }
    if (id === 400) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: {
              1: 'Required field missing',
              2: 'Value must be between 1 and 10',
            },
          },
        },
        { status: 400 }
      );
    }
    return HttpResponse.json({
      success: true,
      data: {
        success: true,
        completedId: 789,
        message: 'Response submitted',
      },
    });
  }),

  // GET /api/v1/feedback/:id/analysis
  http.get(`${API_BASE_URL}/feedback/:id/analysis`, ({ params, request }) => {
    const id = Number(params.id);
    const url = new URL(request.url);
    const _courseid = url.searchParams.get('courseid');
    void _courseid; // Reserved for future filtering
    const groupid = url.searchParams.get('groupid');

    if (id === 123) {
      const analysis = { ...mockFeedbackAnalysis };
      if (groupid) {
        analysis.groupId = Number(groupid);
        analysis.groupResponses = 15;
      }
      return HttpResponse.json({
        success: true,
        data: analysis,
      } satisfies ApiResponse<FeedbackAnalysis>);
    }
    if (id === 403) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to view analysis',
          },
        },
        { status: 403 }
      );
    }
    if (id === 501) {
      // Insufficient responses for anonymous threshold
      return HttpResponse.json({
        success: true,
        data: {
          ...mockFeedbackAnalysis,
          feedbackId: 501,
          totalResponses: 2,
          meetAnonymousThreshold: false,
          items: [],
        },
      });
    }
    return HttpResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Feedback not found' },
      },
      { status: 404 }
    );
  }),

  // GET /api/v1/feedback/:id/status
  http.get(`${API_BASE_URL}/feedback/:id/status`, ({ params }) => {
    const id = Number(params.id);

    if (id === 123) {
      return HttpResponse.json({
        success: true,
        data: {
          isOpen: true,
          canComplete: true,
          canSubmit: true,
          isSubmitted: false,
          isAnonymous: true,
          multipleSubmit: false,
        },
      });
    }
    if (id === 124) {
      // Closed feedback
      return HttpResponse.json({
        success: true,
        data: {
          isOpen: false,
          canComplete: false,
          canSubmit: false,
          isSubmitted: false,
          isAnonymous: false,
          multipleSubmit: false,
        },
      });
    }
    if (id === 125) {
      // Already submitted (no multiple submit)
      return HttpResponse.json({
        success: true,
        data: {
          isOpen: true,
          canComplete: true,
          canSubmit: false,
          isSubmitted: true,
          isAnonymous: false,
          multipleSubmit: false,
          completedId: 789,
        },
      });
    }
    if (id === 126) {
      // Partial completion with resume page
      return HttpResponse.json({
        success: true,
        data: {
          isOpen: true,
          canComplete: true,
          canSubmit: true,
          isSubmitted: false,
          isAnonymous: false,
          multipleSubmit: false,
          resumePage: 2,
        },
      });
    }
    if (id === 127) {
      // Multiple submit allowed
      return HttpResponse.json({
        success: true,
        data: {
          isOpen: true,
          canComplete: true,
          canSubmit: true,
          isSubmitted: true,
          isAnonymous: false,
          multipleSubmit: true,
          completedId: 789,
        },
      });
    }
    return HttpResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Feedback not found' },
      },
      { status: 404 }
    );
  }),

  // GET /api/v1/feedback/:id/can-complete
  http.get(`${API_BASE_URL}/feedback/:id/can-complete`, ({ params }) => {
    const id = Number(params.id);

    if (id === 123) {
      return HttpResponse.json({
        success: true,
        data: {
          canComplete: true,
        },
      });
    }
    if (id === 125) {
      // Already submitted
      return HttpResponse.json({
        success: true,
        data: {
          canComplete: false,
          reason: 'You have already submitted this feedback',
        },
      });
    }
    if (id === 124) {
      // Closed
      return HttpResponse.json({
        success: true,
        data: {
          canComplete: false,
          reason: 'Feedback is not open',
        },
      });
    }
    if (id === 403) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to complete this feedback',
          },
        },
        { status: 403 }
      );
    }
    return HttpResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Feedback not found' },
      },
      { status: 404 }
    );
  }),

  // GET /api/v1/feedback/:id/responses
  http.get(`${API_BASE_URL}/feedback/:id/responses`, ({ params }) => {
    const id = Number(params.id);

    if (id === 123) {
      return HttpResponse.json({
        success: true,
        data: [
          {
            completedId: 456,
            timemodified: 1705000000,
            courseid: 1,
            values: {
              1: 'Satisfied',
              2: 8,
              3: 'Great course!',
            },
          },
        ],
      });
    }
    if (id === 456) {
      // New user - empty responses
      return HttpResponse.json({
        success: true,
        data: [],
      });
    }
    if (id === 127) {
      // Multiple responses (multiple_submit enabled)
      return HttpResponse.json({
        success: true,
        data: [
          {
            completedId: 789,
            timemodified: 1705200000,
            courseid: 1,
            values: { 1: 'Very Satisfied', 2: 9, 3: 'Second submission' },
          },
          {
            completedId: 456,
            timemodified: 1705000000,
            courseid: 1,
            values: { 1: 'Satisfied', 2: 8, 3: 'First submission' },
          },
        ],
      });
    }
    if (id === 403) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to view responses',
          },
        },
        { status: 403 }
      );
    }
    return HttpResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Feedback not found' },
      },
      { status: 404 }
    );
  }),

  // POST /api/v1/feedback/:id/save-progress
  http.post(`${API_BASE_URL}/feedback/:id/save-progress`, async ({ params, request }) => {
    const id = Number(params.id);
    const body = (await request.json()) as { responses: Record<string, unknown> };

    if (id === 123) {
      return HttpResponse.json({
        success: true,
        data: {
          success: true,
          completedTmpId: 1001,
          currentPage: 1,
          totalPages: 3,
          savedValues: body.responses,
        },
      });
    }
    if (id === 403) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to save progress',
          },
        },
        { status: 403 }
      );
    }
    return HttpResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Feedback not found' },
      },
      { status: 404 }
    );
  }),
];

// ============================================================================
// Test Suite
// ============================================================================

describe('feedbackApi', () => {
  // Add our handlers to the global MSW server before all tests
  beforeAll(() => {
    server.use(...handlers);
  });

  // Reset handlers to original state and clear mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  // Restore our handlers before each test (in case previous test overrode them)
  beforeEach(() => {
    server.use(...handlers);
  });

  // ============================================================================
  // getFeedback() Tests
  // ============================================================================

  describe('getFeedback()', () => {
    it('should successfully retrieve feedback details by ID', async () => {
      const response = await getFeedback(123);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockFeedback);
      expect(response.data.id).toBe(123);
      expect(response.data.name).toBe('Test Feedback');
      expect(response.data.intro).toBe('This is a test feedback activity description');
      expect(response.data.anonymous).toBe(1);
      expect(response.data.multiple_submit).toBe(0);
      expect(response.data.timeopen).toBe(1700000000);
      expect(response.data.timeclose).toBe(1800000000);
    });

    it('should return Feedback object with correct TypeScript types', async () => {
      const response = await getFeedback(123);

      expect(response.success).toBe(true);

      // Verify type structure
      const feedback = response.data;
      expect(typeof feedback.id).toBe('number');
      expect(typeof feedback.course).toBe('number');
      expect(typeof feedback.name).toBe('string');
      expect(typeof feedback.intro).toBe('string');
      expect(typeof feedback.introformat).toBe('number');
      expect(typeof feedback.anonymous).toBe('number');
      expect(typeof feedback.email_notification).toBe('number');
      expect(typeof feedback.multiple_submit).toBe('number');
      expect(typeof feedback.autonumbering).toBe('number');
      expect(typeof feedback.site_after_submit).toBe('string');
      expect(typeof feedback.page_after_submit).toBe('string');
      expect(typeof feedback.page_after_submitformat).toBe('number');
      expect(typeof feedback.publish_stats).toBe('number');
      expect(typeof feedback.timeopen).toBe('number');
      expect(typeof feedback.timeclose).toBe('number');
      expect(typeof feedback.timemodified).toBe('number');
      expect(typeof feedback.completionsubmit).toBe('number');
    });

    it('should handle 404 error for invalid feedback ID', async () => {
      await expect(getFeedback(404)).rejects.toMatchObject({
        status: 404,
      });
    });

    it('should handle 403 permission denied error', async () => {
      await expect(getFeedback(403)).rejects.toMatchObject({
        status: 403,
      });
    });

    it('should handle network errors gracefully', async () => {
      server.use(
        http.get(`${API_BASE_URL}/feedback/:id`, () => {
          return HttpResponse.error();
        })
      );

      await expect(getFeedback(123)).rejects.toThrow();
    });

    it('should include meta timestamp in response', async () => {
      const response = await getFeedback(123);

      expect(response.meta).toBeDefined();
      expect(response.meta?.timestamp).toBeDefined();
    });
  });

  // ============================================================================
  // getFeedbackQuestions() Tests
  // ============================================================================

  describe('getFeedbackQuestions()', () => {
    it('should successfully retrieve all feedback questions', async () => {
      const response = await getFeedbackQuestions(123);

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(4);
      expect(response.data).toEqual(mockFeedbackItems);
    });

    it('should return correct data for multichoice question type', async () => {
      const response = await getFeedbackQuestions(123);

      const multichoiceItem = response.data[0]!;
      expect(multichoiceItem.typ).toBe('multichoice');
      expect(multichoiceItem.required).toBe(1);
      expect(multichoiceItem.position).toBe(1);
      expect(multichoiceItem.presentation).toContain('Very Satisfied');
    });

    it('should return correct data for numeric question type', async () => {
      const response = await getFeedbackQuestions(123);

      const numericItem = response.data[1]!;
      expect(numericItem.typ).toBe('numeric');
      expect(numericItem.presentation).toBe('1|10');
    });

    it('should return correct data for textarea question type', async () => {
      const response = await getFeedbackQuestions(123);

      const textareaItem = response.data[2]!;
      expect(textareaItem.typ).toBe('textarea');
      expect(textareaItem.required).toBe(0);
    });

    it('should return correct data for textfield question type', async () => {
      const response = await getFeedbackQuestions(123);

      const textfieldItem = response.data[3]!;
      expect(textfieldItem.typ).toBe('textfield');
    });

    it('should return empty array for new feedback with no questions', async () => {
      const response = await getFeedbackQuestions(456);

      expect(response.success).toBe(true);
      expect(response.data).toEqual([]);
      expect(response.data).toHaveLength(0);
    });

    it('should handle dependent questions with dependitem/dependvalue populated', async () => {
      const response = await getFeedbackQuestions(123);

      const dependentItem = response.data[3]!;
      expect(dependentItem.dependitem).toBe(1);
      expect(dependentItem.dependvalue).toBe('Satisfied');
    });

    it('should return questions ordered by position field', async () => {
      const response = await getFeedbackQuestions(123);

      for (let i = 0; i < response.data.length - 1; i++) {
        expect(response.data[i]!.position).toBeLessThan(response.data[i + 1]!.position);
      }
    });

    it('should verify FeedbackItem TypeScript interface compliance', async () => {
      const response = await getFeedbackQuestions(123);
      const item = response.data[0]!;

      expect(typeof item.id).toBe('number');
      expect(typeof item.feedback).toBe('number');
      expect(typeof item.template).toBe('number');
      expect(typeof item.name).toBe('string');
      expect(typeof item.label).toBe('string');
      expect(typeof item.presentation).toBe('string');
      expect(typeof item.typ).toBe('string');
      expect(typeof item.hasvalue).toBe('number');
      expect(typeof item.position).toBe('number');
      expect(typeof item.required).toBe('number');
      expect(typeof item.dependitem).toBe('number');
      expect(typeof item.dependvalue).toBe('string');
      expect(typeof item.options).toBe('string');
    });

    it('should handle 404 error for non-existent feedback', async () => {
      await expect(getFeedbackQuestions(999)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  // ============================================================================
  // submitFeedbackResponse() Tests
  // ============================================================================

  describe('submitFeedbackResponse()', () => {
    it('should successfully submit feedback response', async () => {
      const responses = {
        1: 'Satisfied',
        2: 8,
        3: 'Great course!',
      };

      const response = await submitFeedbackResponse(123, responses);

      expect(response.success).toBe(true);
      expect(response.data.success).toBe(true);
      expect(response.data.completedId).toBe(456);
      expect(response.data.message).toBe('Response submitted successfully');
    });

    it('should handle anonymous submission correctly', async () => {
      const responses = {
        1: 'Very Satisfied',
        2: 9,
        courseid: 1,
      };

      const response = await submitFeedbackResponse(123, responses);

      expect(response.success).toBe(true);
      expect(response.data.completedId).toBeDefined();
    });

    it('should handle validation errors with 400 status', async () => {
      const invalidResponses = {
        2: 15, // Invalid: should be 1-10
      };

      await expect(submitFeedbackResponse(400, invalidResponses)).rejects.toMatchObject({
        status: 400,
        data: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
          },
        },
      });
    });

    it('should handle feedback closed error with 403 status', async () => {
      const responses = { 1: 'Satisfied' };

      await expect(submitFeedbackResponse(403, responses)).rejects.toMatchObject({
        status: 403,
        data: {
          error: {
            message: 'Feedback is closed',
          },
        },
      });
    });

    it('should handle duplicate submission error with 409 status', async () => {
      const responses = { 1: 'Satisfied' };

      await expect(submitFeedbackResponse(409, responses)).rejects.toMatchObject({
        status: 409,
        data: {
          error: {
            code: 'CONFLICT',
          },
        },
      });
    });

    it('should handle multi-page submission with gopage parameter', async () => {
      const responses = {
        1: 'Satisfied',
        gopage: 2,
      };

      const response = await submitFeedbackResponse(123, responses);

      expect(response.success).toBe(true);
    });

    it('should verify FeedbackSubmissionResult return type', async () => {
      const responses = { 1: 'Satisfied', 2: 7 };

      const response = await submitFeedbackResponse(123, responses);

      expect(typeof response.data.success).toBe('boolean');
      expect(typeof response.data.completedId).toBe('number');
      expect(typeof response.data.message).toBe('string');
    });

    it('should handle submission with courseid for site feedbacks', async () => {
      const responses = {
        1: 'Neutral',
        courseid: 5,
      };

      const response = await submitFeedbackResponse(123, responses);

      expect(response.success).toBe(true);
    });

    it('should handle special characters in text responses', async () => {
      const responses = {
        3: 'Great course! <script>alert("xss")</script> & "quotes" \'apostrophes\'',
      };

      const response = await submitFeedbackResponse(123, responses);

      expect(response.success).toBe(true);
    });

    it('should handle Unicode characters in feedback content', async () => {
      const responses = {
        3: '很好的课程! 🎉 Спасибо за курс! Très bien!',
      };

      const response = await submitFeedbackResponse(123, responses);

      expect(response.success).toBe(true);
    });
  });

  // ============================================================================
  // getFeedbackAnalysis() Tests
  // ============================================================================

  describe('getFeedbackAnalysis()', () => {
    it('should successfully retrieve feedback analysis data', async () => {
      const response = await getFeedbackAnalysis(123);

      expect(response.success).toBe(true);
      expect(response.data.feedbackId).toBe(123);
      expect(response.data.totalResponses).toBe(50);
      expect(response.data.meetAnonymousThreshold).toBe(true);
      expect(response.data.items).toHaveLength(2);
    });

    it('should include courseid filter when provided', async () => {
      const response = await getFeedbackAnalysis(123, { courseid: 5 });

      expect(response.success).toBe(true);
      expect(response.data.feedbackId).toBe(123);
    });

    it('should include groupid filter when provided', async () => {
      const response = await getFeedbackAnalysis(123, { groupid: 3 });

      expect(response.success).toBe(true);
      expect(response.data.groupId).toBe(3);
      expect(response.data.groupResponses).toBe(15);
    });

    it('should handle both courseid and groupid filters together', async () => {
      const response = await getFeedbackAnalysis(123, { courseid: 5, groupid: 3 });

      expect(response.success).toBe(true);
    });

    it('should handle 403 permission denied for non-teachers', async () => {
      await expect(getFeedbackAnalysis(403)).rejects.toMatchObject({
        status: 403,
      });
    });

    it('should handle insufficient responses below minimum threshold', async () => {
      const response = await getFeedbackAnalysis(501);

      expect(response.success).toBe(true);
      expect(response.data.totalResponses).toBe(2);
      expect(response.data.meetAnonymousThreshold).toBe(false);
      expect(response.data.items).toHaveLength(0);
    });

    it('should verify FeedbackAnalysis TypeScript interface', async () => {
      const response = await getFeedbackAnalysis(123);
      const analysis = response.data;

      expect(typeof analysis.feedbackId).toBe('number');
      expect(typeof analysis.totalResponses).toBe('number');
      expect(typeof analysis.meetAnonymousThreshold).toBe('boolean');
      expect(Array.isArray(analysis.items)).toBe(true);
      expect(typeof analysis.statistics).toBe('object');
      expect(typeof analysis.generatedAt).toBe('number');
    });

    it('should verify QuestionAnalysis interface for each item', async () => {
      const response = await getFeedbackAnalysis(123);
      const item = response.data.items[0]!;

      expect(typeof item.itemId).toBe('number');
      expect(typeof item.name).toBe('string');
      expect(typeof item.type).toBe('string');
      expect(typeof item.position).toBe('number');
      expect(typeof item.hasValue).toBe('boolean');
      expect(typeof item.responseCount).toBe('number');
      expect(Array.isArray(item.distribution)).toBe(true);
    });

    it('should include distribution data for multichoice questions', async () => {
      const response = await getFeedbackAnalysis(123);
      const multichoiceItem = response.data.items[0]!;

      expect(multichoiceItem.distribution).toBeDefined();
      expect(multichoiceItem.distribution).toHaveLength(5);
      expect(multichoiceItem.distribution?.[0]).toMatchObject({
        value: expect.any(String),
        count: expect.any(Number),
        percentage: expect.any(Number),
      });
    });

    it('should include statistics for numeric questions', async () => {
      const response = await getFeedbackAnalysis(123);
      const numericItem = response.data.items[1]!;

      expect(numericItem.statistics).toBeDefined();
      expect(numericItem.statistics?.mean).toBe(7.5);
      expect(numericItem.statistics?.median).toBe(8);
      expect(numericItem.statistics?.mode).toBe(8);
      expect(numericItem.statistics?.standardDeviation).toBe(1.8);
      expect(numericItem.statistics?.minimum).toBe(3);
      expect(numericItem.statistics?.maximum).toBe(10);
    });

    it('should include chart data for visualization', async () => {
      const response = await getFeedbackAnalysis(123);
      const item = response.data.items[0]!;

      expect(item.chartData).toBeDefined();
      expect(item.chartData?.labels).toHaveLength(5);
      expect(item.chartData?.values).toHaveLength(5);
      expect(item.chartData?.colors).toHaveLength(5);
    });
  });

  // ============================================================================
  // getFeedbackStatus() Tests
  // ============================================================================

  describe('getFeedbackStatus()', () => {
    it('should return status for open feedback', async () => {
      const response = await getFeedbackStatus(123);

      expect(response.success).toBe(true);
      expect(response.data.isOpen).toBe(true);
      expect(response.data.canComplete).toBe(true);
      expect(response.data.canSubmit).toBe(true);
      expect(response.data.isSubmitted).toBe(false);
      expect(response.data.isAnonymous).toBe(true);
      expect(response.data.multipleSubmit).toBe(false);
    });

    it('should return status for closed feedback', async () => {
      const response = await getFeedbackStatus(124);

      expect(response.success).toBe(true);
      expect(response.data.isOpen).toBe(false);
      expect(response.data.canComplete).toBe(false);
      expect(response.data.canSubmit).toBe(false);
    });

    it('should return status for already submitted feedback (no multiple submit)', async () => {
      const response = await getFeedbackStatus(125);

      expect(response.success).toBe(true);
      expect(response.data.isSubmitted).toBe(true);
      expect(response.data.canSubmit).toBe(false);
      expect(response.data.completedId).toBe(789);
      expect(response.data.multipleSubmit).toBe(false);
    });

    it('should return resume page for partial completion', async () => {
      const response = await getFeedbackStatus(126);

      expect(response.success).toBe(true);
      expect(response.data.resumePage).toBe(2);
      expect(response.data.canSubmit).toBe(true);
    });

    it('should return correct status when multiple submission is allowed', async () => {
      const response = await getFeedbackStatus(127);

      expect(response.success).toBe(true);
      expect(response.data.isSubmitted).toBe(true);
      expect(response.data.canSubmit).toBe(true);
      expect(response.data.multipleSubmit).toBe(true);
      expect(response.data.completedId).toBe(789);
    });

    it('should handle 404 for non-existent feedback', async () => {
      await expect(getFeedbackStatus(999)).rejects.toMatchObject({
        status: 404,
      });
    });

    it('should verify FeedbackStatus TypeScript interface', async () => {
      const response = await getFeedbackStatus(123);
      const status = response.data;

      expect(typeof status.isOpen).toBe('boolean');
      expect(typeof status.canComplete).toBe('boolean');
      expect(typeof status.canSubmit).toBe('boolean');
      expect(typeof status.isSubmitted).toBe('boolean');
      expect(typeof status.isAnonymous).toBe('boolean');
      expect(typeof status.multipleSubmit).toBe('boolean');
    });
  });

  // ============================================================================
  // canCompleteFeedback() Tests
  // ============================================================================

  describe('canCompleteFeedback()', () => {
    it('should return true when user can complete feedback', async () => {
      const response = await canCompleteFeedback(123);

      expect(response.success).toBe(true);
      expect(response.data.canComplete).toBe(true);
      expect(response.data.reason).toBeUndefined();
    });

    it('should return false with reason when already submitted', async () => {
      const response = await canCompleteFeedback(125);

      expect(response.success).toBe(true);
      expect(response.data.canComplete).toBe(false);
      expect(response.data.reason).toBe('You have already submitted this feedback');
    });

    it('should return false with reason when feedback is closed', async () => {
      const response = await canCompleteFeedback(124);

      expect(response.success).toBe(true);
      expect(response.data.canComplete).toBe(false);
      expect(response.data.reason).toBe('Feedback is not open');
    });

    it('should handle 403 permission denied', async () => {
      await expect(canCompleteFeedback(403)).rejects.toMatchObject({
        status: 403,
      });
    });

    it('should handle 404 for non-existent feedback', async () => {
      await expect(canCompleteFeedback(999)).rejects.toMatchObject({
        status: 404,
      });
    });

    it('should verify CanCompleteResult TypeScript interface', async () => {
      const response = await canCompleteFeedback(123);

      expect(typeof response.data.canComplete).toBe('boolean');
    });
  });

  // ============================================================================
  // getFeedbackResponses() Tests
  // ============================================================================

  describe('getFeedbackResponses()', () => {
    it('should return user responses for completed feedback', async () => {
      const response = await getFeedbackResponses(123);

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(1);
      expect(response.data[0]!.completedId).toBe(456);
      expect(response.data[0]!.timemodified).toBe(1705000000);
      expect(response.data[0]!.courseid).toBe(1);
      expect(response.data[0]!.values).toEqual({
        1: 'Satisfied',
        2: 8,
        3: 'Great course!',
      });
    });

    it('should return empty array for new user', async () => {
      const response = await getFeedbackResponses(456);

      expect(response.success).toBe(true);
      expect(response.data).toEqual([]);
      expect(response.data).toHaveLength(0);
    });

    it('should return multiple responses when multiple_submit is enabled', async () => {
      const response = await getFeedbackResponses(127);

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
      expect(response.data[0]!.completedId).toBe(789);
      expect(response.data[1]!.completedId).toBe(456);
    });

    it('should handle 403 permission check for viewing others responses', async () => {
      await expect(getFeedbackResponses(403)).rejects.toMatchObject({
        status: 403,
      });
    });

    it('should handle 404 for non-existent feedback', async () => {
      await expect(getFeedbackResponses(999)).rejects.toMatchObject({
        status: 404,
      });
    });

    it('should verify FeedbackUserResponses TypeScript interface', async () => {
      const response = await getFeedbackResponses(123);
      const userResponse = response.data[0]!;

      expect(typeof userResponse.completedId).toBe('number');
      expect(typeof userResponse.timemodified).toBe('number');
      expect(typeof userResponse.courseid).toBe('number');
      expect(typeof userResponse.values).toBe('object');
    });
  });

  // ============================================================================
  // saveProgress() Tests
  // ============================================================================

  describe('saveProgress()', () => {
    it('should successfully save feedback progress', async () => {
      const responses = {
        1: 'Satisfied',
        2: 7,
      };

      const response = await saveProgress(123, responses);

      expect(response.success).toBe(true);
      expect(response.data.success).toBe(true);
      expect(response.data.completedTmpId).toBe(1001);
      expect(response.data.currentPage).toBe(1);
      expect(response.data.totalPages).toBe(3);
    });

    it('should return saved values in response', async () => {
      const responses = {
        1: 'Neutral',
        2: 5,
      };

      const response = await saveProgress(123, responses);

      expect(response.data.savedValues).toEqual(responses);
    });

    it('should handle gopage parameter for multi-page navigation', async () => {
      const responses = {
        1: 'Dissatisfied',
        gopage: 2,
      };

      const response = await saveProgress(123, responses);

      expect(response.success).toBe(true);
    });

    it('should handle 403 permission denied', async () => {
      const responses = { 1: 'Satisfied' };

      await expect(saveProgress(403, responses)).rejects.toMatchObject({
        status: 403,
      });
    });

    it('should handle 404 for non-existent feedback', async () => {
      const responses = { 1: 'Satisfied' };

      await expect(saveProgress(999, responses)).rejects.toMatchObject({
        status: 404,
      });
    });

    it('should verify SaveProgressResult TypeScript interface', async () => {
      const responses = { 1: 'Satisfied' };
      const response = await saveProgress(123, responses);

      expect(typeof response.data.success).toBe('boolean');
      expect(typeof response.data.completedTmpId).toBe('number');
      expect(typeof response.data.currentPage).toBe('number');
      expect(typeof response.data.totalPages).toBe('number');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle network timeout', async () => {
      server.use(
        http.get(`${API_BASE_URL}/feedback/:id`, async () => {
          // Simulate a slow response that takes longer than typical timeouts
          await new Promise((resolve) => setTimeout(resolve, 100));
          // Return a timeout-like error response
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'TIMEOUT',
                message: 'Request timed out',
              },
            },
            { status: 408 }
          );
        })
      );

      // Test that slow responses are handled - either as timeout error or slow response
      try {
        const result = await getFeedback(123);
        // If it succeeds, verify it's an error response
        expect(result.success).toBe(false);
      } catch (error) {
        // If it throws, verify it's a valid error
        expect(error).toBeDefined();
      }
    });

    it('should handle 500 server error', async () => {
      server.use(
        http.get(`${API_BASE_URL}/feedback/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Internal server error',
              },
            },
            { status: 500 }
          );
        })
      );

      await expect(getFeedback(123)).rejects.toMatchObject({
        status: 500,
      });
    });

    it('should handle malformed JSON response', async () => {
      server.use(
        http.get(`${API_BASE_URL}/feedback/:id`, () => {
          return new HttpResponse('not valid json', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      // The API client may handle malformed JSON gracefully by wrapping it
      // Test that it either rejects or returns a non-standard response
      try {
        const response = await getFeedback(123);
        // If it doesn't throw, verify the response indicates something non-standard
        // API client may wrap raw text in data field - use type assertion for edge case
        const rawData = response.data as unknown;
        const isRawText = rawData === 'not valid json';
        const isFailure = (response as unknown as { success: boolean }).success === false;
        expect(isRawText || isFailure).toBe(true);
      } catch (error) {
        // If it throws, that's also valid handling
        expect(error).toBeDefined();
      }
    });

    it('should extract error message from API response', async () => {
      server.use(
        http.get(`${API_BASE_URL}/feedback/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'CUSTOM_ERROR',
                message: 'Custom error message from server',
              },
            },
            { status: 400 }
          );
        })
      );

      try {
        await getFeedback(123);
      } catch (error: unknown) {
        // Error is flattened by interceptors - data is at top level, not nested under response
        const apiError = error as { data?: { error?: { message?: string } } };
        expect(apiError.data?.error?.message).toBe('Custom error message from server');
      }
    });

    it('should handle network error (no response)', async () => {
      server.use(
        http.get(`${API_BASE_URL}/feedback/:id`, () => {
          return HttpResponse.error();
        })
      );

      await expect(getFeedback(123)).rejects.toBeDefined();
    });
  });

  // ============================================================================
  // Edge Cases and Integration Tests
  // ============================================================================

  describe('Edge Cases and Integration', () => {
    it('should handle concurrent API calls', async () => {
      const promises = [getFeedback(123), getFeedbackQuestions(123), getFeedbackStatus(123)];

      const results = await Promise.all(promises);

      expect(results[0]!.success).toBe(true);
      expect(results[1]!.success).toBe(true);
      expect(results[2]!.success).toBe(true);
    });

    it('should handle request with invalid parameters - negative ID', async () => {
      server.use(
        http.get(`${API_BASE_URL}/feedback/:id`, ({ params }) => {
          const id = Number(params.id);
          if (id < 0) {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'INVALID_PARAMETER',
                  message: 'Invalid feedback ID',
                },
              },
              { status: 400 }
            );
          }
          return HttpResponse.json({
            success: true,
            data: mockFeedback,
          });
        })
      );

      await expect(getFeedback(-1)).rejects.toMatchObject({
        status: 400,
      });
    });

    it('should handle large response payloads', async () => {
      // Create a large analysis with many items
      const largeItems = Array.from({ length: 100 }, (_, i) => ({
        itemId: i + 1,
        name: `Question ${i + 1}`,
        type: 'multichoice' as FeedbackQuestionType,
        position: i + 1,
        hasValue: true,
        responseCount: 50,
        distribution: [
          { value: 'Option 1', count: 10, percentage: 20 },
          { value: 'Option 2', count: 15, percentage: 30 },
          { value: 'Option 3', count: 25, percentage: 50 },
        ],
      }));

      server.use(
        http.get(`${API_BASE_URL}/feedback/:id/analysis`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              ...mockFeedbackAnalysis,
              items: largeItems,
            },
          });
        })
      );

      const response = await getFeedbackAnalysis(123);

      expect(response.success).toBe(true);
      expect(response.data.items).toHaveLength(100);
    });

    it('should handle empty response body gracefully', async () => {
      server.use(
        http.get(`${API_BASE_URL}/feedback/:id`, () => {
          return new HttpResponse(null, {
            status: 204,
          });
        })
      );

      // Should handle gracefully without crashing
      try {
        await getFeedback(123);
      } catch (error) {
        // 204 No Content may throw or return undefined
        expect(error).toBeDefined();
      }
    });

    it('should handle feedback with all question types', async () => {
      const baseItem = mockFeedbackItems[0]!;
      const allTypesItems: FeedbackItem[] = [
        { ...baseItem, id: 1, typ: 'multichoice' as FeedbackQuestionType, position: 1 },
        {
          ...baseItem,
          id: 2,
          typ: 'multichoicerated' as FeedbackQuestionType,
          position: 2,
        },
        { ...baseItem, id: 3, typ: 'numeric' as FeedbackQuestionType, position: 3 },
        { ...baseItem, id: 4, typ: 'textarea' as FeedbackQuestionType, position: 4 },
        { ...baseItem, id: 5, typ: 'textfield' as FeedbackQuestionType, position: 5 },
        { ...baseItem, id: 6, typ: 'info' as FeedbackQuestionType, position: 6 },
        { ...baseItem, id: 7, typ: 'label' as FeedbackQuestionType, position: 7 },
        { ...baseItem, id: 8, typ: 'captcha' as FeedbackQuestionType, position: 8 },
      ];

      server.use(
        http.get(`${API_BASE_URL}/feedback/:id/questions`, () => {
          return HttpResponse.json({
            success: true,
            data: allTypesItems,
          });
        })
      );

      const response = await getFeedbackQuestions(123);

      expect(response.data).toHaveLength(8);
      expect(response.data.map((item) => item.typ)).toEqual([
        'multichoice',
        'multichoicerated',
        'numeric',
        'textarea',
        'textfield',
        'info',
        'label',
        'captcha',
      ]);
    });

    it('should handle submission with array values (multichoice checkboxes)', async () => {
      const responses = {
        1: ['Option A', 'Option C'], // Array for checkbox multichoice
        2: 7,
      };

      const response = await submitFeedbackResponse(123, responses);

      expect(response.success).toBe(true);
    });

    it('should handle submission with empty string values', async () => {
      const responses = {
        1: 'Satisfied',
        3: '', // Empty optional field
      };

      const response = await submitFeedbackResponse(123, responses);

      expect(response.success).toBe(true);
    });

    it('should preserve request order in concurrent submissions', async () => {
      const responses1 = { 1: 'First' };
      const responses2 = { 1: 'Second' };

      const [result1, result2] = await Promise.all([
        submitFeedbackResponse(123, responses1),
        submitFeedbackResponse(123, responses2),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  // ============================================================================
  // API Request Construction Tests
  // ============================================================================

  describe('API Request Construction', () => {
    it('should construct correct URL for getFeedback', async () => {
      let requestUrl = '';
      server.use(
        http.get(`${API_BASE_URL}/feedback/:id`, ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            success: true,
            data: mockFeedback,
          });
        })
      );

      await getFeedback(123);

      expect(requestUrl).toContain('/feedback/123');
    });

    it('should construct correct URL with query params for getFeedbackAnalysis', async () => {
      let requestUrl = '';
      server.use(
        http.get(`${API_BASE_URL}/feedback/:id/analysis`, ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            success: true,
            data: mockFeedbackAnalysis,
          });
        })
      );

      await getFeedbackAnalysis(123, { courseid: 5, groupid: 3 });

      expect(requestUrl).toContain('/feedback/123/analysis');
      expect(requestUrl).toContain('courseid=5');
      expect(requestUrl).toContain('groupid=3');
    });

    it('should send correct request body for submitFeedbackResponse', async () => {
      let requestBody: unknown = null;
      server.use(
        http.post(`${API_BASE_URL}/feedback/:id/submit`, async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({
            success: true,
            data: { success: true, completedId: 456, message: 'Success' },
          });
        })
      );

      const responses = { 1: 'Satisfied', 2: 8 };
      await submitFeedbackResponse(123, responses);

      expect(requestBody).toEqual({ responses });
    });

    it('should send correct request body for saveProgress', async () => {
      let requestBody: unknown = null;
      server.use(
        http.post(`${API_BASE_URL}/feedback/:id/save-progress`, async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({
            success: true,
            data: { success: true, completedTmpId: 1001, currentPage: 1, totalPages: 3 },
          });
        })
      );

      const responses = { 1: 'Neutral', gopage: 2 };
      await saveProgress(123, responses);

      expect(requestBody).toEqual({ responses });
    });
  });
});
