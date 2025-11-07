/**
 * MSW Request Handlers for Feedback API Endpoints
 * 
 * This file provides Mock Service Worker (MSW) handlers for feedback activity
 * API endpoints, enabling isolated frontend testing without backend dependencies.
 * 
 * Handlers include:
 * - GET /api/v1/feedback/:id - Feedback activity details
 * - GET /api/v1/feedback/:id/questions - Get feedback questions
 * - POST /api/v1/feedback/:id/submit - Submit feedback response
 * - GET /api/v1/feedback/:id/analysis - Get feedback analysis/results
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

interface Feedback {
  id: number;
  course: number;
  name: string;
  intro: string;
  introformat: number;
  anonymous: number; // 2 = no anonymous, 1 = anonymous
  email_notification: number;
  multiple_submit: number;
  autonumbering: number;
  site_after_submit: string;
  page_after_submit: string;
  page_after_submitformat: number;
  publish_stats: number;
  timeopen: number;
  timeclose: number;
  timemodified: number;
  completionsubmit: number;
}

interface FeedbackQuestion {
  id: number;
  feedback: number;
  template: number;
  name: string;
  label: string;
  presentation: string;
  typ: string;
  hasvalue: number;
  position: number;
  required: number;
  dependitem: number;
  dependvalue: string;
  options: string;
}

interface FeedbackResponse {
  id: number;
  feedback: number;
  userid: number;
  anonymous: number;
  timemodified: number;
  answers: Record<number, any>;
}

interface FeedbackAnalysis {
  feedbackId: number;
  totalResponses: number;
  completionRate: number;
  questions: Array<{
    itemId: number;
    question: string;
    type: string;
    responses: Array<{
      value: string;
      count: number;
      percentage: number;
    }>;
    average?: number;
    mode?: number;
    distribution?: {
      min: number;
      max: number;
      median: number;
    };
    percentage?: number;
  }>;
  courseBreakdown?: Record<number, {
    totalResponses: number;
    completionRate: number;
  }>;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_FEEDBACK: Record<number, Feedback> = {
  1: {
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
    completionsubmit: 1
  },
  2: {
    id: 2,
    course: 10,
    name: 'Mid-Term Feedback',
    intro: 'How are you finding the course so far?',
    introformat: 1,
    anonymous: 1, // FEEDBACK_ANONYMOUS_YES
    email_notification: 1,
    multiple_submit: 1,
    autonumbering: 1,
    site_after_submit: '',
    page_after_submit: 'Your feedback has been recorded',
    page_after_submitformat: 1,
    publish_stats: 1,
    timeopen: 1640000000,
    timeclose: 1672536000,
    timemodified: 1640000000,
    completionsubmit: 1
  }
};

const MOCK_QUESTIONS: Record<number, FeedbackQuestion[]> = {
  1: [
    {
      id: 1,
      feedback: 1,
      template: 0,
      name: 'question1',
      label: 'How would you rate this course?',
      presentation: '1|2|3|4|5',
      typ: 'multichoice',
      hasvalue: 1,
      position: 1,
      required: 1,
      dependitem: 0,
      dependvalue: '',
      options: 'r>>>>>1####2####3####4####5'
    },
    {
      id: 2,
      feedback: 1,
      template: 0,
      name: 'question2',
      label: 'What did you like most about the course?',
      presentation: '',
      typ: 'textarea',
      hasvalue: 1,
      position: 2,
      required: 0,
      dependitem: 0,
      dependvalue: '',
      options: ''
    },
    {
      id: 3,
      feedback: 1,
      template: 0,
      name: 'question3',
      label: 'Would you recommend this course?',
      presentation: 'Yes####No',
      typ: 'multichoice',
      hasvalue: 1,
      position: 3,
      required: 1,
      dependitem: 0,
      dependvalue: '',
      options: 'r>>>>>Yes####No'
    }
  ],
  2: [
    {
      id: 4,
      feedback: 2,
      template: 0,
      name: 'difficulty',
      label: 'How difficult is the course material?',
      presentation: 'Too Easy####Just Right####Too Hard',
      typ: 'multichoice',
      hasvalue: 1,
      position: 1,
      required: 1,
      dependitem: 0,
      dependvalue: '',
      options: 'r>>>>>Too Easy####Just Right####Too Hard'
    },
    {
      id: 5,
      feedback: 2,
      template: 0,
      name: 'progress',
      label: 'How is your progress in the course?',
      presentation: '',
      typ: 'textarea',
      hasvalue: 1,
      position: 2,
      required: 0,
      dependitem: 0,
      dependvalue: '',
      options: ''
    }
  ]
};

const MOCK_ANALYSIS: Record<number, FeedbackAnalysis> = {
  1: {
    feedbackId: 1,
    totalResponses: 45,
    completionRate: 90.0,
    questions: [
      {
        itemId: 1,
        question: 'How would you rate this course?',
        type: 'multichoice',
        responses: [
          { value: '5', count: 20, percentage: 44.4 },
          { value: '4', count: 15, percentage: 33.3 },
          { value: '3', count: 8, percentage: 17.8 },
          { value: '2', count: 2, percentage: 4.4 },
          { value: '1', count: 0, percentage: 0 }
        ],
        average: 4.2,
        mode: 5
      },
      {
        itemId: 3,
        question: 'Would you recommend this course?',
        type: 'multichoice',
        responses: [
          { value: 'Yes', count: 42, percentage: 93.3 },
          { value: 'No', count: 3, percentage: 6.7 }
        ],
        percentage: 93.3
      }
    ]
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

async function simulateNetworkDelay(min = 100, max = 300): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// ============================================================================
// MSW Request Handlers
// ============================================================================

/**
 * GET /api/v1/feedback/:id
 * Fetch feedback activity details by ID
 */
const getFeedbackHandler = http.get('*/api/v1/feedback/:id', async ({ params }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id);
  const feedback = MOCK_FEEDBACK[id];
  
  if (!feedback) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'FEEDBACK_NOT_FOUND',
          message: `Feedback activity with ID ${id} not found`,
          details: { feedbackId: id }
        }
      },
      { status: 404 }
    );
  }
  
  return HttpResponse.json({
    success: true,
    data: feedback
  });
});

/**
 * GET /api/v1/feedback/:id/questions
 * Get questions for a feedback activity
 */
const getQuestionsHandler = http.get('*/api/v1/feedback/:id/questions', async ({ params }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id);
  const feedback = MOCK_FEEDBACK[id];
  
  if (!feedback) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'FEEDBACK_NOT_FOUND',
          message: `Feedback activity with ID ${id} not found`,
          details: { feedbackId: id }
        }
      },
      { status: 404 }
    );
  }
  
  if (!feedback.canView) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to view this feedback',
          details: {
            required_capability: 'mod/feedback:view',
            context: 'module'
          }
        }
      },
      { status: 403 }
    );
  }
  
  const questions = MOCK_QUESTIONS[id] || [];
  
  return HttpResponse.json({
    success: true,
    data: questions
  });
});

/**
 * POST /api/v1/feedback/:id/submit
 * Submit feedback responses
 */
const submitFeedbackHandler = http.post('*/api/v1/feedback/:id/submit', async ({ params, request }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id);
  const feedback = MOCK_FEEDBACK[id];
  
  if (!feedback) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'FEEDBACK_NOT_FOUND',
          message: `Feedback activity with ID ${id} not found`,
          details: { feedbackId: id }
        }
      },
      { status: 404 }
    );
  }
  
  if (!feedback.canSubmit) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to submit this feedback',
          details: {
            required_capability: 'mod/feedback:complete',
            context: 'module'
          }
        }
      },
      { status: 403 }
    );
  }
  
  // Check if already submitted (for non-multiple submit feedback)
  if (feedback.hasSubmitted && feedback.multiple_submit === 0) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'ALREADY_SUBMITTED',
          message: 'You have already submitted this feedback',
          details: { 
            feedbackId: id,
            multiple_submit: feedback.multiple_submit
          }
        }
      },
      { status: 409 }
    );
  }
  
  const body = await request.json() as any;
  
  if (!body.answers || typeof body.answers !== 'object') {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Answers object is required',
          details: { missing_fields: ['answers'] }
        }
      },
      { status: 400 }
    );
  }
  
  // Validate required questions are answered
  const questions = MOCK_QUESTIONS[id] || [];
  const missingRequired = questions
    .filter(q => q.required && !body.answers[q.id])
    .map(q => q.id);
  
  if (missingRequired.length > 0) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Required questions must be answered',
          details: { 
            missing_questions: missingRequired
          }
        }
      },
      { status: 400 }
    );
  }
  
  const response: FeedbackResponse = {
    id: Math.floor(Math.random() * 10000),
    feedback: id,
    userid: feedback.anonymous === 1 ? 0 : 5,
    anonymous: feedback.anonymous,
    timemodified: Math.floor(Date.now() / 1000),
    answers: body.answers
  };
  
  return HttpResponse.json({
    success: true,
    data: response,
    message: feedback.page_after_submit || 'Thank you for your feedback!'
  }, { status: 201 });
});

/**
 * GET /api/v1/feedback/:id/analysis
 * Get feedback analysis and results
 */
const getAnalysisHandler = http.get('*/api/v1/feedback/:id/analysis', async ({ params }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id);
  const feedback = MOCK_FEEDBACK[id];
  
  if (!feedback) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'FEEDBACK_NOT_FOUND',
          message: `Feedback activity with ID ${id} not found`,
          details: { feedbackId: id }
        }
      },
      { status: 404 }
    );
  }
  
  if (!feedback.canViewAnalysis) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to view feedback analysis',
          details: {
            required_capability: 'mod/feedback:viewanalysepage',
            context: 'module'
          }
        }
      },
      { status: 403 }
    );
  }
  
  if (feedback.publish_stats === 0 && !feedback.canViewAnalysis) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'STATS_NOT_PUBLISHED',
          message: 'Statistics for this feedback are not published',
          details: { feedbackId: id }
        }
      },
      { status: 403 }
    );
  }
  
  const analysis = MOCK_ANALYSIS[id] || {
    feedbackId: id,
    totalSubmissions: 0,
    anonymousSubmissions: 0,
    questions: []
  };
  
  return HttpResponse.json({
    success: true,
    data: analysis
  });
});

// ============================================================================
// Export Handlers
// ============================================================================

/**
 * Array of all feedback-related MSW request handlers
 * 
 * Usage in test setup:
 * ```typescript
 * import { feedbackHandlers } from './mocks/handlers/feedback';
 * 
 * const server = setupServer(...feedbackHandlers);
 * 
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 */
export const feedbackHandlers = [
  getFeedbackHandler,
  getQuestionsHandler,
  submitFeedbackHandler,
  getAnalysisHandler,
];
