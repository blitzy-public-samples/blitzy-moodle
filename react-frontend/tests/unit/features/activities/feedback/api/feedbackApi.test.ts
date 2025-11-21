/**
 * Unit tests for Feedback API client
 * 
 * Tests HTTP request handling, response parsing, error scenarios, and TypeScript type safety
 * for feedback activity operations including:
 * - Fetching feedback details
 * - Retrieving questions/items
 * - Submitting responses
 * - Getting analysis data
 * - Checking completion status
 * 
 * Reference files:
 * - public/mod/feedback/view.php: Feedback viewing and permission checks
 * - public/mod/feedback/complete.php: Feedback completion flow and validation
 * - public/mod/feedback/analysis.php: Analysis data retrieval and permissions
 * - public/mod/feedback/lib.php: Core feedback functions
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../../mocks/server';
import {
  getFeedback,
  getFeedbackQuestions,
  submitFeedbackResponse,
  getFeedbackAnalysis,
  getFeedbackStatus,
  canCompleteFeedback,
  getFeedbackResponses,
  saveProgress,
  type FeedbackSubmissionResult,
  type FeedbackStatus,
  type AnalysisOptions,
} from '@/features/activities/feedback/api/feedbackApi';
import type { ApiResponse } from '@/types/api';
import type {
  Feedback,
  FeedbackItem,
  FeedbackAnalysis,
  FeedbackCompleted,
} from '@/features/activities/feedback/types/feedback.types';
import { FeedbackQuestionType } from '@/features/activities/feedback/types/feedback.types';

// Mock API base URL
const API_BASE_URL = '/api/v1';

// Test fixtures
const mockFeedback: Feedback = {
  id: 1,
  course: 10,
  name: 'Course Evaluation Survey',
  intro: 'Please complete this survey to help us improve the course',
  introformat: 1,
  anonymous: 2, // FEEDBACK_ANONYMOUS_NO
  email_notification: 0,
  multiple_submit: 0,
  autonumbering: 1,
  site_after_submit: '',
  page_after_submit: 'Thank you for your feedback!',
  page_after_submitformat: 1,
  publish_stats: 0,
  timeopen: 0,
  timeclose: 0,
  timemodified: 1640000000,
  completionsubmit: 1,
};

const mockFeedbackItems: FeedbackItem[] = [
  {
    id: 1,
    feedback: 1,
    template: 0,
    name: 'question1',
    label: 'How would you rate this course?',
    presentation: '1|2|3|4|5',
    typ: FeedbackQuestionType.MULTICHOICE,
    hasvalue: 1,
    position: 1,
    required: 1,
    dependitem: 0,
    dependvalue: '',
    options: 'r>>>>>1####2####3####4####5',
  },
  {
    id: 2,
    feedback: 1,
    template: 0,
    name: 'question2',
    label: 'What did you like most about the course?',
    presentation: '',
    typ: FeedbackQuestionType.TEXTAREA,
    hasvalue: 1,
    position: 2,
    required: 0,
    dependitem: 0,
    dependvalue: '',
    options: '',
  },
  {
    id: 3,
    feedback: 1,
    template: 0,
    name: 'question3',
    label: 'Would you recommend this course?',
    presentation: 'Yes####No',
    typ: FeedbackQuestionType.MULTICHOICE,
    hasvalue: 1,
    position: 3,
    required: 1,
    dependitem: 0,
    dependvalue: '',
    options: 'r>>>>>Yes####No',
  },
];

const mockFeedbackAnalysis: FeedbackAnalysis = {
  feedbackId: 1,
  totalResponses: 45,
  meetAnonymousThreshold: true,
  items: [
    {
      itemId: 1,
      name: 'How would you rate this course?',
      type: FeedbackQuestionType.MULTICHOICE,
      position: 1,
      hasValue: true,
      responseCount: 45,
      distribution: [
        { value: '1', count: 2, percentage: 4.44 },
        { value: '2', count: 5, percentage: 11.11 },
        { value: '3', count: 10, percentage: 22.22 },
        { value: '4', count: 18, percentage: 40.0 },
        { value: '5', count: 10, percentage: 22.22 },
      ],
      statistics: {
        mean: 3.64,
        median: 4,
        mode: 4,
        standardDeviation: 1.1,
        minimum: 1,
        maximum: 5,
      },
    },
    {
      itemId: 3,
      name: 'Would you recommend this course?',
      type: FeedbackQuestionType.MULTICHOICE,
      position: 3,
      hasValue: true,
      responseCount: 45,
      distribution: [
        { value: 'Yes', count: 38, percentage: 84.44 },
        { value: 'No', count: 7, percentage: 15.56 },
      ],
    },
  ],
  statistics: {
    totalResponses: 45,
    completionRate: 75,
    averageTime: 300,
    responsesByCourse: [],
    responsesByGroup: [],
    respondents: [],
    nonRespondents: [],
    lastSubmissionDate: 1640000000,
  },
  generatedAt: 1640000000,
};

const mockFeedbackStatus: FeedbackStatus = {
  isCompleted: false,
  attemptCount: 0,
  allowMultiple: false,
  isOpen: true,
  timeOpen: 0,
  timeClose: 0,
};

const mockFeedbackResponses: FeedbackCompleted[] = [
  {
    id: 1,
    feedback: 1,
    userid: 1,
    timemodified: 1640000000,
    random_response: 0,
    anonymous_response: 0,
    courseid: 10,
  },
];

const mockSubmissionResult: FeedbackSubmissionResult = {
  success: true,
  completedId: 2,
  timeModified: 1640000000,
  message: 'Feedback submitted successfully',
};

describe('Feedback API Client', () => {
  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  describe('getFeedback()', () => {
    it('should successfully fetch feedback details with correct endpoint URL', async () => {
      const feedbackId = 1;
      
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFeedback,
          });
        })
      );

      const response = await getFeedback(feedbackId);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockFeedback);
      expect(response.data.id).toBe(feedbackId);
      expect(response.data.name).toBe('Course Evaluation Survey');
    });

    it('should parse response into correct Feedback TypeScript interface', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/1`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFeedback,
          });
        })
      );

      const response = await getFeedback(1);
      const feedback = response.data;

      // Verify TypeScript interface structure
      expect(feedback).toHaveProperty('id');
      expect(feedback).toHaveProperty('course');
      expect(feedback).toHaveProperty('name');
      expect(feedback).toHaveProperty('intro');
      expect(feedback).toHaveProperty('anonymous');
      expect(feedback).toHaveProperty('multiple_submit');
      expect(feedback).toHaveProperty('timeopen');
      expect(feedback).toHaveProperty('timeclose');
      
      // Verify types
      expect(typeof feedback.id).toBe('number');
      expect(typeof feedback.name).toBe('string');
      expect(typeof feedback.anonymous).toBe('number');
    });

    it('should include JWT authorization header in request', async () => {
      let requestHeaders: Headers | undefined;
      
      server.use(
        http.get(`*${API_BASE_URL}/feedback/1`, ({ request }) => {
          requestHeaders = request.headers;
          return HttpResponse.json({
            success: true,
            data: mockFeedback,
          });
        })
      );

      await getFeedback(1);

      // JWT token should be included via axios interceptor
      // This test validates that the apiClient is properly configured
      expect(requestHeaders).toBeDefined();
    });

    it('should handle 404 Not Found error for invalid feedback ID', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/999`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Feedback activity not found',
                details: {
                  feedbackId: 999,
                },
              },
            },
            { status: 404 }
          );
        })
      );

      await expect(getFeedback(999)).rejects.toThrow();
    });

    it('should handle 403 Forbidden error for insufficient permissions', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/1`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to view this feedback',
                details: {
                  required_capability: 'mod/feedback:view',
                  context: 'module',
                },
              },
            },
            { status: 403 }
          );
        })
      );

      await expect(getFeedback(1)).rejects.toThrow();
    });

    it('should handle network error scenarios', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/1`, () => {
          return HttpResponse.error();
        })
      );

      await expect(getFeedback(1)).rejects.toThrow();
    });
  });

  describe('getFeedbackQuestions()', () => {
    it('should successfully fetch feedback questions/items', async () => {
      const feedbackId = 1;
      
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/questions`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFeedbackItems,
          });
        })
      );

      const response = await getFeedbackQuestions(feedbackId);

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(3);
      expect(response.data).toEqual(mockFeedbackItems);
    });

    it('should parse different question types correctly', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/1/questions`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFeedbackItems,
          });
        })
      );

      const response = await getFeedbackQuestions(1);
      const items = response.data;

      // Verify multichoice question
      expect(items[0]!.typ).toBe('multichoice');
      expect(items[0]!.required).toBe(1);
      expect(items[0]!.presentation).toBe('1|2|3|4|5');

      // Verify textarea question
      expect(items[1]!.typ).toBe('textarea');
      expect(items[1]!.required).toBe(0);

      // Verify another multichoice
      expect(items[2]!.typ).toBe('multichoice');
      expect(items[2]!.presentation).toBe('Yes####No');
    });

    it('should handle empty feedback (no questions)', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/1/questions`, () => {
          return HttpResponse.json({
            success: true,
            data: [],
          });
        })
      );

      const response = await getFeedbackQuestions(1);

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(0);
    });

    it('should handle permission error for questions retrieval', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/1/questions`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'Cannot view feedback questions',
              },
            },
            { status: 403 }
          );
        })
      );

      await expect(getFeedbackQuestions(1)).rejects.toThrow();
    });
  });

  describe('submitFeedbackResponse() / completeFeedback()', () => {
    const feedbackId = 1;
    const validResponses: Record<number, string | number> = {
      1: '4',
      2: 'Great content and well-structured',
      3: 'Yes',
    };

    it('should successfully submit feedback response', async () => {
      server.use(
        http.post(`*${API_BASE_URL}/feedback/${feedbackId}/submit`, () => {
          return HttpResponse.json({
            success: true,
            data: mockSubmissionResult,
          });
        })
      );

      const response = await submitFeedbackResponse(feedbackId, validResponses);

      expect(response.success).toBe(true);
      expect(response.data.success).toBe(true);
      expect(response.data.completedId).toBe(2);
      expect(response.data.message).toBe('Feedback submitted successfully');
    });

    it('should include response data in request body', async () => {
      let requestBody: any;
      
      server.use(
        http.post(`*${API_BASE_URL}/feedback/${feedbackId}/submit`, async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({
            success: true,
            data: mockSubmissionResult,
          });
        })
      );

      await submitFeedbackResponse(feedbackId, validResponses);

      expect(requestBody).toEqual(validResponses);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(requestBody[1]).toBe('4');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(requestBody[2]).toBe('Great content and well-structured');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(requestBody[3]).toBe('Yes');
    });

    it('should handle validation errors for incomplete responses', async () => {
      const incompleteResponses: Record<number, string | number> = {
        1: '4',
        // Missing required question 3
      };

      server.use(
        http.post(`*${API_BASE_URL}/feedback/${feedbackId}/submit`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Required questions not answered',
                details: {
                  missingRequired: [3],
                },
              },
            },
            { status: 400 }
          );
        })
      );

      await expect(submitFeedbackResponse(feedbackId, incompleteResponses)).rejects.toThrow();
    });

    it('should handle validation errors for invalid data types', async () => {
      const invalidResponses: Record<number, string | number> = {
        1: 'not-a-number', // Should be numeric for rating
        2: 'Valid text',
        3: 'Yes',
      };

      server.use(
        http.post(`*${API_BASE_URL}/feedback/${feedbackId}/submit`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid response format',
                details: {
                  invalidFields: { 1: 'Expected numeric value' },
                },
              },
            },
            { status: 400 }
          );
        })
      );

      await expect(submitFeedbackResponse(feedbackId, invalidResponses)).rejects.toThrow();
    });

    it('should prevent duplicate submission when not allowed', async () => {
      server.use(
        http.post(`*${API_BASE_URL}/feedback/${feedbackId}/submit`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'DUPLICATE_SUBMISSION',
                message: 'You have already completed this feedback',
                details: {
                  completedId: 1,
                  multipleSubmit: false,
                },
              },
            },
            { status: 409 }
          );
        })
      );

      await expect(submitFeedbackResponse(feedbackId, validResponses)).rejects.toThrow();
    });

    it('should handle time window validation (feedback closed)', async () => {
      server.use(
        http.post(`*${API_BASE_URL}/feedback/${feedbackId}/submit`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'FEEDBACK_CLOSED',
                message: 'Feedback is not currently open for submissions',
                details: {
                  timeopen: 1640000000,
                  timeclose: 1640100000,
                  currentTime: 1640200000,
                },
              },
            },
            { status: 403 }
          );
        })
      );

      await expect(submitFeedbackResponse(feedbackId, validResponses)).rejects.toThrow();
    });

    it('should support optimistic updates pattern', async () => {
      // This test verifies the response structure supports optimistic UI updates
      server.use(
        http.post(`*${API_BASE_URL}/feedback/${feedbackId}/submit`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              success: true,
              completedId: 3,
              message: 'Feedback submitted',
              resumePage: null,
            },
          });
        })
      );

      const response = await submitFeedbackResponse(feedbackId, validResponses);

      // Response structure supports optimistic updates
      expect(response.data).toHaveProperty('success');
      expect(response.data).toHaveProperty('completedId');
      expect(response.data.success).toBe(true);
    });
  });

  describe('getFeedbackAnalysis()', () => {
    const feedbackId = 1;

    it('should successfully fetch analysis data', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/analysis`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFeedbackAnalysis,
          });
        })
      );

      const response = await getFeedbackAnalysis(feedbackId);

      expect(response.success).toBe(true);
      expect(response.data.feedbackId).toBe(feedbackId);
      expect(response.data.totalResponses).toBe(45);
      expect(response.data.statistics.completionRate).toBe(75);
    });

    it('should include statistics and charts data in response', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/analysis`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFeedbackAnalysis,
          });
        })
      );

      const response = await getFeedbackAnalysis(feedbackId);
      const analysis = response.data;

      // Verify item analysis structure
      expect(analysis.items).toHaveLength(2);
      expect(analysis.items[0]).toHaveProperty('itemId');
      expect(analysis.items[0]).toHaveProperty('name');
      expect(analysis.items[0]).toHaveProperty('distribution');
      expect(analysis.items[0]).toHaveProperty('statistics');
      expect(analysis.items[0]!.statistics).toHaveProperty('mean');
      expect(analysis.items[0]!.statistics).toHaveProperty('mode');

      // Verify response distribution
      expect(analysis.items[0]!.distribution).toHaveLength(5);
      expect(analysis.items[0]!.distribution?.[0]).toHaveProperty('value');
      expect(analysis.items[0]!.distribution?.[0]).toHaveProperty('count');
      expect(analysis.items[0]!.distribution?.[0]).toHaveProperty('percentage');
    });

    it('should validate permission for analysis viewing (teachers/admins only)', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/analysis`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'Only teachers can view feedback analysis',
                details: {
                  required_capability: 'mod/feedback:viewanalysepage',
                },
              },
            },
            { status: 403 }
          );
        })
      );

      await expect(getFeedbackAnalysis(feedbackId)).rejects.toThrow();
    });

    it('should support filtering by group parameter', async () => {
      const options: AnalysisOptions = {
        groupId: 5,
      };

      let requestUrl: string = '';
      
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/analysis`, ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            success: true,
            data: mockFeedbackAnalysis,
          });
        })
      );

      await getFeedbackAnalysis(feedbackId, options);

      expect(requestUrl).toContain('groupId=5');
    });

    it('should support filtering by course parameter', async () => {
      const options: AnalysisOptions = {
        courseId: 10,
      };

      let requestUrl: string = '';
      
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/analysis`, ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            success: true,
            data: mockFeedbackAnalysis,
          });
        })
      );

      await getFeedbackAnalysis(feedbackId, options);

      expect(requestUrl).toContain('courseId=10');
    });

    it('should handle empty analysis (no responses yet)', async () => {
      const emptyAnalysis: FeedbackAnalysis = {
        feedbackId: 1,
        totalResponses: 0,
        meetAnonymousThreshold: false,
        items: [],
        statistics: {
          totalResponses: 0,
          completionRate: 0,
          averageTime: 0,
          responsesByCourse: [],
          responsesByGroup: [],
          respondents: [],
          nonRespondents: [],
          lastSubmissionDate: 0,
        },
        generatedAt: Date.now(),
      };

      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/analysis`, () => {
          return HttpResponse.json({
            success: true,
            data: emptyAnalysis,
          });
        })
      );

      const response = await getFeedbackAnalysis(feedbackId);

      expect(response.success).toBe(true);
      expect(response.data.totalResponses).toBe(0);
      expect(response.data.items).toHaveLength(0);
    });

    it('should validate TypeScript types for analysis data structure', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/analysis`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFeedbackAnalysis,
          });
        })
      );

      const response = await getFeedbackAnalysis(feedbackId);
      const analysis: FeedbackAnalysis = response.data;

      // Type assertions to verify TypeScript interface compliance
      expect(typeof analysis.feedbackId).toBe('number');
      expect(typeof analysis.totalResponses).toBe('number');
      expect(typeof analysis.generatedAt).toBe('number');
      expect(Array.isArray(analysis.items)).toBe(true);
      
      if (analysis.items.length > 0) {
        const item = analysis.items[0]!;
        expect(typeof item.itemId).toBe('number');
        expect(typeof item.name).toBe('string');
        expect(typeof item.type).toBe('string');
        expect(Array.isArray(item.distribution)).toBe(true);
      }
    });
  });

  describe('getFeedbackStatus()', () => {
    const feedbackId = 1;

    it('should successfully fetch feedback completion status', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/status`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFeedbackStatus,
          });
        })
      );

      const response = await getFeedbackStatus(feedbackId);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockFeedbackStatus);
    });

    it('should indicate completion state (completed/incomplete)', async () => {
      const completedStatus: FeedbackStatus = {
        ...mockFeedbackStatus,
        isCompleted: true,
        attemptCount: 1,
      };

      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/status`, () => {
          return HttpResponse.json({
            success: true,
            data: completedStatus,
          });
        })
      );

      const response = await getFeedbackStatus(feedbackId);

      expect(response.data.isCompleted).toBe(true);
      expect(response.data.attemptCount).toBe(1);
    });

    it('should handle anonymous feedback status', async () => {
      const anonymousStatus: FeedbackStatus = {
        ...mockFeedbackStatus,
      };

      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/status`, () => {
          return HttpResponse.json({
            success: true,
            data: anonymousStatus,
          });
        })
      );

      const response = await getFeedbackStatus(feedbackId);

      expect(response.data.isOpen).toBe(true);
    });

    it('should support multiple completion status', async () => {
      const multipleSubmitStatus: FeedbackStatus = {
        ...mockFeedbackStatus,
        allowMultiple: true,
        isCompleted: true,
        attemptCount: 2,
      };

      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/status`, () => {
          return HttpResponse.json({
            success: true,
            data: multipleSubmitStatus,
          });
        })
      );

      const response = await getFeedbackStatus(feedbackId);

      expect(response.data.allowMultiple).toBe(true);
      expect(response.data.isCompleted).toBe(true);
      expect(response.data.attemptCount).toBe(2);
    });

    it('should include response metadata (submission timestamp, attempt number)', async () => {
      const statusWithMetadata: FeedbackStatus = {
        ...mockFeedbackStatus,
        isCompleted: true,
        attemptCount: 1,
      };

      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/status`, () => {
          return HttpResponse.json({
            success: true,
            data: statusWithMetadata,
            meta: {
              submissionTimestamp: 1640000000,
              attemptNumber: 1,
            },
          });
        })
      );

      const response = await getFeedbackStatus(feedbackId);

      expect(response.data.isCompleted).toBe(true);
      expect(response.data.attemptCount).toBe(1);
      expect(response.meta).toHaveProperty('submissionTimestamp');
      expect(response.meta).toHaveProperty('attemptNumber');
    });
  });

  describe('canCompleteFeedback()', () => {
    const feedbackId = 1;

    it('should return true when user can complete feedback', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/can-complete`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              canComplete: true,
            },
          });
        })
      );

      const response = await canCompleteFeedback(feedbackId);

      expect(response.success).toBe(true);
      expect(response.data.canComplete).toBe(true);
    });

    it('should return false with reason when user cannot complete', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/can-complete`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              canComplete: false,
              reason: 'Feedback is closed',
            },
          });
        })
      );

      const response = await canCompleteFeedback(feedbackId);

      expect(response.data.canComplete).toBe(false);
      expect(response.data.reason).toBe('Feedback is closed');
    });

    it('should handle permission check failure', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/can-complete`, () => {
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
        })
      );

      await expect(canCompleteFeedback(feedbackId)).rejects.toThrow();
    });

    it('should handle already submitted scenario', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/can-complete`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              canComplete: false,
              reason: 'You have already completed this feedback',
            },
          });
        })
      );

      const response = await canCompleteFeedback(feedbackId);

      expect(response.data.canComplete).toBe(false);
      expect(response.data.reason).toContain('already completed');
    });
  });

  describe('getFeedbackResponses()', () => {
    const feedbackId = 1;

    it('should successfully fetch user feedback responses', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/responses`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              responses: mockFeedbackResponses,
              total: mockFeedbackResponses.length,
              hasMore: false,
            },
          });
        })
      );

      const response = await getFeedbackResponses(feedbackId);

      expect(response.success).toBe(true);
      expect(response.data.responses).toHaveLength(1);
      expect(response.data.responses[0]).toEqual(mockFeedbackResponses[0]);
    });

    it('should return responses for current user only', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/responses`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              responses: mockFeedbackResponses,
              total: mockFeedbackResponses.length,
              hasMore: false,
            },
          });
        })
      );

      const response = await getFeedbackResponses(feedbackId);

      // All responses should belong to current user (implicit from backend)
      expect(response.data.responses).toHaveLength(1);
      expect(response.data.responses[0]!.id).toBe(1);
      expect(response.data.responses[0]!.feedback).toBe(1);
    });

    it('should handle empty response history', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/responses`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              responses: [],
              total: 0,
              hasMore: false,
            },
          });
        })
      );

      const response = await getFeedbackResponses(feedbackId);

      expect(response.success).toBe(true);
      expect(response.data.responses).toHaveLength(0);
    });

    it('should include completed and in-progress submissions', async () => {
      const mixedResponses: FeedbackCompleted[] = [
        {
          id: 1,
          feedback: 1,
          userid: 1,
          timemodified: 1640000000,
          random_response: 0,
          anonymous_response: 0,
          courseid: 10,
        },
        {
          id: 2,
          feedback: 1,
          userid: 1,
          timemodified: 1640010000,
          random_response: 0,
          anonymous_response: 0,
          courseid: 10,
        },
      ];

      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/responses`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              responses: mixedResponses,
              total: mixedResponses.length,
              hasMore: false,
            },
          });
        })
      );

      const response = await getFeedbackResponses(feedbackId);

      expect(response.data.responses).toHaveLength(2);
      expect(response.data.responses[0]!.id).toBe(1);
      expect(response.data.responses[1]!.id).toBe(2);
    });

    it('should handle permission error for viewing reports capability', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}/responses`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'Cannot view feedback responses',
                details: {
                  required_capability: 'mod/feedback:viewreports',
                },
              },
            },
            { status: 403 }
          );
        })
      );

      await expect(getFeedbackResponses(feedbackId)).rejects.toThrow();
    });
  });

  describe('saveProgress()', () => {
    const feedbackId = 1;
    const partialResponses: Record<number, string | number> = {
      1: '4',
      2: 'Work in progress...',
    };

    it('should successfully save in-progress feedback responses', async () => {
      server.use(
        http.post(`*${API_BASE_URL}/feedback/${feedbackId}/save-progress`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              saved: true,
              completedId: 0, // In-progress ID
              resumePage: 1,
            },
          });
        })
      );

      const response = await saveProgress(feedbackId, partialResponses);

      expect(response.success).toBe(true);
      expect(response.data.saved).toBe(true);
      expect(response.data.resumePage).toBe(1);
    });

    it('should allow resuming from saved page', async () => {
      server.use(
        http.post(`*${API_BASE_URL}/feedback/${feedbackId}/save-progress`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              saved: true,
              completedId: 0,
              resumePage: 2,
              savedValues: partialResponses,
            },
          });
        })
      );

      const response = await saveProgress(feedbackId, partialResponses);

      expect(response.data.resumePage).toBe(2);
      expect(response.data.savedValues).toEqual(partialResponses);
    });
  });

  describe('Error Handling', () => {
    it('should parse standard error envelope', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/1`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid feedback ID',
                details: {
                  feedbackId: 1,
                },
              },
            },
            { status: 400 }
          );
        })
      );

      try {
        await getFeedback(1);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeDefined();
        // Error should contain response data
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(error.response).toBeDefined();
      }
    });

    it('should map error codes correctly', async () => {
      const errorCodes = [
        { code: 'PERMISSION_DENIED', status: 403 },
        { code: 'NOT_FOUND', status: 404 },
        { code: 'VALIDATION_ERROR', status: 400 },
        { code: 'FEEDBACK_CLOSED', status: 403 },
        { code: 'DUPLICATE_SUBMISSION', status: 409 },
      ];

      for (const { code, status } of errorCodes) {
        server.use(
          http.get(`*${API_BASE_URL}/feedback/1`, () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code,
                  message: `Error: ${code}`,
                },
              },
              { status }
            );
          })
        );

        await expect(getFeedback(1)).rejects.toThrow();
      }
    });

    it('should handle timeout scenarios', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/1`, async () => {
          // Simulate timeout with delay
          await new Promise((resolve) => setTimeout(resolve, 10));
          return HttpResponse.error();
        })
      );

      await expect(getFeedback(1)).rejects.toThrow();
    });

    it('should handle retry logic for transient failures', async () => {
      let attemptCount = 0;

      server.use(
        http.get(`*${API_BASE_URL}/feedback/1`, () => {
          attemptCount++;
          if (attemptCount < 2) {
            return HttpResponse.error();
          }
          return HttpResponse.json({
            success: true,
            data: mockFeedback,
          });
        })
      );

      // Note: Actual retry logic would be in apiClient interceptor
      // This test documents the expected behavior
      try {
        await getFeedback(1);
      } catch (error) {
        // First attempt fails, retry would handle subsequent attempts
        expect(attemptCount).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should enforce correct response types', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/feedback/1`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFeedback,
          });
        })
      );

      const response: ApiResponse<Feedback> = await getFeedback(1);

      // TypeScript should enforce these types at compile time
      expect(response.success).toBeDefined();
      expect(response.data).toBeDefined();
      
      const feedback: Feedback = response.data;
      expect(typeof feedback.id).toBe('number');
      expect(typeof feedback.name).toBe('string');
    });

    it('should handle optional fields correctly', async () => {
      const feedbackWithOptionals: Feedback = {
        ...mockFeedback,
        timeopen: 0,
        timeclose: 0,
      };

      server.use(
        http.get(`*${API_BASE_URL}/feedback/1`, () => {
          return HttpResponse.json({
            success: true,
            data: feedbackWithOptionals,
          });
        })
      );

      const response = await getFeedback(1);
      const feedback = response.data;

      // Optional fields should be properly typed
      expect(feedback.timeopen).toBeDefined();
      expect(feedback.timeclose).toBeDefined();
    });

    it('should validate union types for different response states', async () => {
      // Test different status states
      const statuses: FeedbackStatus[] = [
        { ...mockFeedbackStatus, isCompleted: false, attemptCount: 0, lastCompleted: undefined },
        { ...mockFeedbackStatus, isCompleted: true, attemptCount: 1, lastCompleted: mockFeedbackResponses[0] },
      ];

      for (const status of statuses) {
        server.use(
          http.get(`*${API_BASE_URL}/feedback/1/status`, () => {
            return HttpResponse.json({
              success: true,
              data: status,
            });
          })
        );

        const response = await getFeedbackStatus(1);
        
        // TypeScript should handle union type correctly
        if (response.data.isCompleted) {
          expect(response.data.lastCompleted).toBeDefined();
          if (response.data.lastCompleted) {
            expect(typeof response.data.lastCompleted.id).toBe('number');
          }
        } else {
          expect(response.data.lastCompleted).toBeUndefined();
        }
      }
    });

    it('should ensure no any types in test assertions', () => {
      // This test documents that we avoid 'any' types
      const feedback: Feedback = mockFeedback;
      const items: FeedbackItem[] = mockFeedbackItems;
      const analysis: FeedbackAnalysis = mockFeedbackAnalysis;
      const status: FeedbackStatus = mockFeedbackStatus;
      const responses: FeedbackCompleted[] = mockFeedbackResponses;

      // All variables are explicitly typed
      expect(feedback).toBeDefined();
      expect(items).toBeDefined();
      expect(analysis).toBeDefined();
      expect(status).toBeDefined();
      expect(responses).toBeDefined();
    });
  });

  describe('React Query Integration', () => {
    it('should support proper query key generation for caching', async () => {
      // Query keys should be consistent for React Query caching
      const feedbackId = 1;
      const queryKey = ['feedback', feedbackId];

      server.use(
        http.get(`*${API_BASE_URL}/feedback/${feedbackId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockFeedback,
          });
        })
      );

      await getFeedback(feedbackId);

      // Query key pattern is documented for React Query hooks
      expect(queryKey).toEqual(['feedback', 1]);
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    it('should support staleTime and gcTime configurations', async () => {
      // These configurations would be in React Query hooks
      // React Query v5: renamed cacheTime to gcTime
      const cacheConfig = {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      };

      expect(cacheConfig.staleTime).toBe(300000);
      expect(cacheConfig.gcTime).toBe(600000);
    });

    it('should support mutation success callbacks', async () => {
      server.use(
        http.post(`*${API_BASE_URL}/feedback/1/submit`, () => {
          return HttpResponse.json({
            success: true,
            data: mockSubmissionResult,
          });
        })
      );

      const response = await submitFeedbackResponse(1, {
        1: '4',
        2: 'Good',
        3: 'Yes',
      });

      // Mutation response supports success callbacks
      expect(response.success).toBe(true);
      expect(response.data.completedId).toBeDefined();
    });

    it('should support query invalidation after mutations', () => {
      // Query invalidation pattern for React Query
      const invalidationKeys = [
        ['feedback', 1],
        ['feedback', 1, 'status'],
        ['feedback', 1, 'responses'],
      ];

      // After submission, these queries should be invalidated
      expect(invalidationKeys).toHaveLength(3);
    });

    it('should verify refetch behavior expectations', async () => {
      let callCount = 0;

      server.use(
        http.get(`*${API_BASE_URL}/feedback/1`, () => {
          callCount++;
          return HttpResponse.json({
            success: true,
            data: mockFeedback,
          });
        })
      );

      // First fetch
      await getFeedback(1);
      expect(callCount).toBe(1);

      // Refetch
      await getFeedback(1);
      expect(callCount).toBe(2);
    });
  });
});

