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
  courseId: number;
  name: string;
  intro: string;
  introFormat: number;
  anonymous: boolean;
  multipleSubmit: boolean;
  autonumbering: boolean;
  siteAfterSubmit: string;
  pageAfterSubmit: string;
  pageAfterSubmitFormat: number;
  publishStats: boolean;
  timeOpen: number;
  timeClose: number;
  timeModified: number;
  completionSubmit: boolean;
  canView: boolean;
  canSubmit: boolean;
  canViewAnalysis: boolean;
  hasSubmitted: boolean;
}

interface FeedbackQuestion {
  id: number;
  feedbackId: number;
  type: string;
  name: string;
  label: string;
  required: boolean;
  position: number;
  dependItem: number;
  dependValue: string;
  options: string;
  values?: string[];
}

interface FeedbackResponse {
  id: number;
  feedbackId: number;
  userId: number;
  anonymous: boolean;
  timeModified: number;
  answers: Record<number, any>;
}

interface FeedbackAnalysis {
  feedbackId: number;
  totalSubmissions: number;
  anonymousSubmissions: number;
  questions: Array<{
    questionId: number;
    questionName: string;
    questionType: string;
    answers: Array<{
      value: string;
      count: number;
      percentage: number;
    }>;
  }>;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_FEEDBACK: Record<number, Feedback> = {
  1: {
    id: 1,
    courseId: 10,
    name: 'Course Evaluation Survey',
    intro: 'Please provide your feedback on this course',
    introFormat: 1,
    anonymous: true,
    multipleSubmit: false,
    autonumbering: true,
    siteAfterSubmit: '',
    pageAfterSubmit: 'Thank you for your feedback!',
    pageAfterSubmitFormat: 1,
    publishStats: true,
    timeOpen: 1640000000,
    timeClose: 1672536000,
    timeModified: 1640000000,
    completionSubmit: true,
    canView: true,
    canSubmit: true,
    canViewAnalysis: false,
    hasSubmitted: false
  },
  2: {
    id: 2,
    courseId: 10,
    name: 'Mid-Term Feedback',
    intro: 'How are you finding the course so far?',
    introFormat: 1,
    anonymous: false,
    multipleSubmit: true,
    autonumbering: true,
    siteAfterSubmit: '',
    pageAfterSubmit: 'Your feedback has been recorded',
    pageAfterSubmitFormat: 1,
    publishStats: false,
    timeOpen: 1640000000,
    timeClose: 1672536000,
    timeModified: 1640000000,
    completionSubmit: true,
    canView: true,
    canSubmit: true,
    canViewAnalysis: true,
    hasSubmitted: true
  }
};

const MOCK_QUESTIONS: Record<number, FeedbackQuestion[]> = {
  1: [
    {
      id: 1,
      feedbackId: 1,
      type: 'multichoice',
      name: 'Overall Rating',
      label: 'How would you rate this course overall?',
      required: true,
      position: 1,
      dependItem: 0,
      dependValue: '',
      options: 'r>>>>> Excellent | Very Good | Good | Fair | Poor',
      values: ['Excellent', 'Very Good', 'Good', 'Fair', 'Poor']
    },
    {
      id: 2,
      feedbackId: 1,
      type: 'textarea',
      name: 'Comments',
      label: 'What did you like most about this course?',
      required: false,
      position: 2,
      dependItem: 0,
      dependValue: '',
      options: ''
    },
    {
      id: 3,
      feedbackId: 1,
      type: 'textarea',
      name: 'Improvements',
      label: 'What could be improved?',
      required: false,
      position: 3,
      dependItem: 0,
      dependValue: '',
      options: ''
    },
    {
      id: 4,
      feedbackId: 1,
      type: 'numeric',
      name: 'Instructor Rating',
      label: 'Rate the instructor (1-10)',
      required: true,
      position: 4,
      dependItem: 0,
      dependValue: '',
      options: '1|10'
    }
  ],
  2: [
    {
      id: 5,
      feedbackId: 2,
      type: 'multichoice',
      name: 'Difficulty',
      label: 'How difficult is the course material?',
      required: true,
      position: 1,
      dependItem: 0,
      dependValue: '',
      options: 'r>>>>> Too Easy | Easy | Just Right | Difficult | Too Difficult',
      values: ['Too Easy', 'Easy', 'Just Right', 'Difficult', 'Too Difficult']
    },
    {
      id: 6,
      feedbackId: 2,
      type: 'textarea',
      name: 'Progress',
      label: 'How is your progress in the course?',
      required: false,
      position: 2,
      dependItem: 0,
      dependValue: '',
      options: ''
    }
  ]
};

const MOCK_ANALYSIS: Record<number, FeedbackAnalysis> = {
  1: {
    feedbackId: 1,
    totalSubmissions: 45,
    anonymousSubmissions: 45,
    questions: [
      {
        questionId: 1,
        questionName: 'Overall Rating',
        questionType: 'multichoice',
        answers: [
          { value: 'Excellent', count: 20, percentage: 44.4 },
          { value: 'Very Good', count: 15, percentage: 33.3 },
          { value: 'Good', count: 8, percentage: 17.8 },
          { value: 'Fair', count: 2, percentage: 4.4 },
          { value: 'Poor', count: 0, percentage: 0 }
        ]
      },
      {
        questionId: 4,
        questionName: 'Instructor Rating',
        questionType: 'numeric',
        answers: [
          { value: 'Average: 8.5', count: 45, percentage: 100 }
        ]
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
  if (feedback.hasSubmitted && !feedback.multipleSubmit) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'ALREADY_SUBMITTED',
          message: 'You have already submitted this feedback',
          details: { 
            feedbackId: id,
            multipleSubmit: feedback.multipleSubmit
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
    feedbackId: id,
    userId: feedback.anonymous ? 0 : 5,
    anonymous: feedback.anonymous,
    timeModified: Date.now() / 1000,
    answers: body.answers
  };
  
  return HttpResponse.json({
    success: true,
    data: response,
    message: feedback.pageAfterSubmit || 'Thank you for your feedback!'
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
  
  if (!feedback.publishStats && !feedback.canViewAnalysis) {
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
