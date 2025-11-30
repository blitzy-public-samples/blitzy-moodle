/**
 * Unit tests for workshopApi module
 *
 * Tests all workshop-related API endpoint integrations including:
 * - Fetching workshop details and user plans
 * - Managing submissions (create, update, delete)
 * - Handling peer assessments
 * - Switching workshop phases
 * - Allocating reviewers to submissions
 * - Managing grades
 *
 * Uses MSW (Mock Service Worker) for API mocking
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../../mocks/server';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Import the workshopApi module
import * as workshopApi from '@/features/activities/workshop/api/workshopApi';
import type {
  Workshop,
  WorkshopSubmission,
  WorkshopAssessment,
  WorkshopUserPlan,
  WorkshopAssessmentFormData,
} from '@/features/activities/workshop/types';
import { WorkshopPhase, ExamplesMode } from '@/features/activities/workshop/types';

/* eslint-disable @typescript-eslint/unbound-method */

// Mock API base URL
const API_BASE_URL = 'http://localhost:8000/api/v1';

// Mock JWT token for authentication
const MOCK_JWT_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

// ============================================================================
// Mock Data
// ============================================================================

const mockWorkshop: Workshop = {
  id: 1,
  courseId: 10,
  name: 'Peer Review Workshop',
  intro: 'Welcome to the peer review workshop',
  introFormat: 1,
  instructAuthors: 'Submit your work by the deadline',
  instructAuthorsFormat: 1,
  instructReviewers: 'Provide constructive feedback',
  instructReviewersFormat: 1,
  phase: WorkshopPhase.SUBMISSION,
  strategy: 'accumulative',
  evaluation: 'best',
  grade: 100,
  gradingGrade: 20,
  gradeDecimals: 2,
  submissionStart: 1640000000,
  submissionEnd: 1640100000,
  assessmentStart: 1640100001,
  assessmentEnd: 1640200000,
  useExamples: false,
  examplesMode: ExamplesMode.VOLUNTARY,
  usePeerAssessment: true,
  useSelfAssessment: false,
  lateSubmissions: false,
  maxBytes: 5242880,
  nAttachments: 3,
  submissionFileTypes: '.pdf,.doc,.docx',
  overallFeedbackMode: 1,
  overallFeedbackFiles: 2,
  overallFeedbackFileTypes: '.pdf,.doc',
  conclusion: 'Thank you for participating',
  conclusionFormat: 1,
  timeCreated: 1639900000,
  timeModified: 1640000000,
};

const mockSubmission: WorkshopSubmission = {
  id: 1,
  workshopId: 1,
  example: false,
  authorId: 5,
  authorFirstName: 'John',
  authorLastName: 'Doe',
  authorEmail: 'john.doe@example.com',
  title: 'My Research Paper',
  content: '<p>This is the content of my submission.</p>',
  contentFormat: 1,
  contentTrust: false,
  attachment: 0,
  grade: 85.5,
  gradingGrade: 18.0,
  gradeOver: null,
  gradingGradeOver: null,
  feedbackAuthor: 'Good work on your submission!',
  feedbackAuthorFormat: 1,
  timeCreated: 1640050000,
  timeModified: 1640050000,
  published: false,
  late: false,
};

const mockSubmissions: WorkshopSubmission[] = [
  mockSubmission,
  {
    id: 2,
    workshopId: 1,
    example: false,
    authorId: 6,
    authorFirstName: 'Jane',
    authorLastName: 'Smith',
    authorEmail: 'jane.smith@example.com',
    title: 'Analysis Project',
    content: '<p>My analysis project content.</p>',
    contentFormat: 1,
    contentTrust: false,
    attachment: 1,
    grade: null,
    gradingGrade: null,
    gradeOver: null,
    gradingGradeOver: null,
    feedbackAuthor: null,
    feedbackAuthorFormat: 1,
    timeCreated: 1640055000,
    timeModified: 1640055000,
    published: false,
    late: false,
  },
];

const mockAssessment: WorkshopAssessment = {
  id: 1,
  submissionId: 1,
  reviewerId: 6,
  reviewerFirstName: 'Jane',
  reviewerLastName: 'Smith',
  weight: 1,
  grade: 80.0,
  gradingGrade: 17.0,
  gradingGradeOver: null,
  feedbackAuthor: 'Well-written paper with clear arguments.',
  feedbackAuthorFormat: 1,
  feedbackAuthorAttachment: 0,
  feedbackReviewer: null,
  feedbackReviewerFormat: 1,
  timeCreated: 1640110000,
  timeModified: 1640110000,
};

const mockAssessments: WorkshopAssessment[] = [
  mockAssessment,
  {
    id: 2,
    submissionId: 1,
    reviewerId: 7,
    reviewerFirstName: 'Bob',
    reviewerLastName: 'Johnson',
    weight: 1,
    grade: 90.0,
    gradingGrade: 19.0,
    gradingGradeOver: null,
    feedbackAuthor: 'Excellent research methodology.',
    feedbackAuthorFormat: 1,
    feedbackAuthorAttachment: 0,
    feedbackReviewer: null,
    feedbackReviewerFormat: 1,
    timeCreated: 1640115000,
    timeModified: 1640115000,
  },
];

const mockUserPlan: WorkshopUserPlan = {
  userId: 5,
  workshopId: 1,
  phases: [
    {
      phase: WorkshopPhase.SETUP,
      title: 'Setup phase',
      tasks: [],
      active: false,
    },
    {
      phase: WorkshopPhase.SUBMISSION,
      title: 'Submission phase',
      tasks: [
        {
          key: 'submit',
          title: 'Submit your work',
          link: '/mod/workshop/submission.php?id=1',
          completed: true,
          details: 'Submitted on 2021-12-20',
        },
      ],
      active: true,
    },
    {
      phase: WorkshopPhase.ASSESSMENT,
      title: 'Assessment phase',
      tasks: [
        {
          key: 'assess1',
          title: 'Assess submission by Jane Smith',
          link: '/mod/workshop/assessment.php?asid=1',
          completed: false,
        },
        {
          key: 'assess2',
          title: 'Assess submission by Bob Johnson',
          link: '/mod/workshop/assessment.php?asid=2',
          completed: false,
        },
      ],
      active: false,
    },
    {
      phase: WorkshopPhase.EVALUATION,
      title: 'Grading evaluation phase',
      tasks: [],
      active: false,
    },
    {
      phase: WorkshopPhase.CLOSED,
      title: 'Closed',
      tasks: [],
      active: false,
    },
  ],
};

const mockGrades = [
  {
    submissionId: 1,
    authorId: 5,
    authorName: 'John Doe',
    submissionGrade: 85.5,
    gradingGrade: 18.0,
    finalGrade: 91.1,
  },
  {
    submissionId: 2,
    authorId: 6,
    authorName: 'Jane Smith',
    submissionGrade: 78.0,
    gradingGrade: 16.5,
    finalGrade: 82.8,
  },
];

// ============================================================================
// MSW Request Handlers
// ============================================================================

const handlers = [
  // GET workshop detail
  http.get(`*${API_BASE_URL}/workshop/:id`, ({ params }) => {
    const { id } = params;

    if (id === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Workshop not found',
          },
        },
        { status: 404 }
      );
    }

    if (id === '403') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to view this workshop',
          },
        },
        { status: 403 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        workshop: mockWorkshop,
        userPlan: mockUserPlan,
        currentPhaseTitle: 'Submission phase',
        canSubmit: true,
        canAssess: false,
        canAllocate: false,
        canSwitchPhase: false,
      },
    });
  }),

  // GET workshop user plan
  http.get(`*${API_BASE_URL}/workshop/:id/userplan`, ({ params }) => {
    const { id } = params;

    if (id === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Workshop not found',
          },
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: mockUserPlan,
    });
  }),

  // GET workshop submissions
  http.get(`*${API_BASE_URL}/workshop/:id/submissions`, ({ params }) => {
    const { id } = params;

    if (id === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Workshop not found',
          },
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: mockSubmissions,
    });
  }),

  // POST create submission
  http.post(`*${API_BASE_URL}/workshop/:id/submissions`, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as {
      title: string;
      content: string;
      contentFormat?: number;
      attachmentId?: number;
    };

    if (id === '403') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Submissions are not allowed in this phase',
          },
        },
        { status: 403 }
      );
    }

    const newSubmission: WorkshopSubmission = {
      id: 10,
      workshopId: parseInt(id as string),
      example: false,
      authorId: 5,
      authorFirstName: 'John',
      authorLastName: 'Doe',
      title: body.title,
      content: body.content,
      contentFormat: body.contentFormat ?? 1,
      contentTrust: false,
      attachment: body.attachmentId ?? 0,
      grade: null,
      gradingGrade: null,
      gradeOver: null,
      gradingGradeOver: null,
      feedbackAuthor: null,
      feedbackAuthorFormat: 1,
      timeCreated: Date.now() / 1000,
      timeModified: Date.now() / 1000,
      published: false,
      late: false,
    };

    return HttpResponse.json({
      success: true,
      data: newSubmission,
    });
  }),

  // PUT update submission
  http.put(`*${API_BASE_URL}/workshop/submissions/:submissionId`, async ({ params, request }) => {
    const { submissionId } = params;
    const body = (await request.json()) as {
      title?: string;
      content?: string;
      contentFormat?: number;
      attachmentId?: number;
    };

    if (submissionId === '403') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You cannot edit this submission',
          },
        },
        { status: 403 }
      );
    }

    const updatedSubmission: WorkshopSubmission = {
      ...mockSubmission,
      id: parseInt(submissionId as string),
      title: body.title ?? mockSubmission.title,
      content: body.content ?? mockSubmission.content,
      contentFormat: body.contentFormat ?? mockSubmission.contentFormat,
      timeModified: Date.now() / 1000,
    };

    return HttpResponse.json({
      success: true,
      data: updatedSubmission,
    });
  }),

  // DELETE submission
  http.delete(`*${API_BASE_URL}/workshop/submissions/:submissionId`, ({ params }) => {
    const { submissionId } = params;

    if (submissionId === '403') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You cannot delete this submission',
          },
        },
        { status: 403 }
      );
    }

    if (submissionId === '409') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Cannot delete submission that has been assessed',
          },
        },
        { status: 409 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: null,
    });
  }),

  // GET assessments for a submission
  http.get(`*${API_BASE_URL}/workshop/submissions/:submissionId/assessments`, ({ params }) => {
    const { submissionId } = params;

    if (submissionId === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Submission not found',
          },
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: mockAssessments,
    });
  }),

  // POST create assessment
  http.post(
    `*${API_BASE_URL}/workshop/submissions/:submissionId/assessments`,
    async ({ params, request }) => {
      const { submissionId } = params;
      const body = (await request.json()) as WorkshopAssessmentFormData;

      if (submissionId === '403') {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'You are not allowed to assess this submission',
            },
          },
          { status: 403 }
        );
      }

      const newAssessment: WorkshopAssessment = {
        id: 100,
        submissionId: parseInt(submissionId as string),
        reviewerId: 5,
        reviewerFirstName: 'John',
        reviewerLastName: 'Doe',
        weight: 1,
        grade: 85.0,
        gradingGrade: null,
        gradingGradeOver: null,
        feedbackAuthor: body.feedbackAuthor ?? null,
        feedbackAuthorFormat: body.feedbackAuthorFormat ?? 1,
        feedbackAuthorAttachment: 0,
        feedbackReviewer: null,
        feedbackReviewerFormat: 1,
        timeCreated: Date.now() / 1000,
        timeModified: Date.now() / 1000,
      };

      return HttpResponse.json({
        success: true,
        data: newAssessment,
      });
    }
  ),

  // PUT update assessment
  http.put(`*${API_BASE_URL}/workshop/assessments/:assessmentId`, async ({ params, request }) => {
    const { assessmentId } = params;
    const body = (await request.json()) as WorkshopAssessmentFormData;

    if (assessmentId === '403') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You cannot edit this assessment',
          },
        },
        { status: 403 }
      );
    }

    const updatedAssessment: WorkshopAssessment = {
      ...mockAssessment,
      id: parseInt(assessmentId as string),
      feedbackAuthor: body.feedbackAuthor ?? mockAssessment.feedbackAuthor,
      feedbackAuthorFormat: body.feedbackAuthorFormat ?? mockAssessment.feedbackAuthorFormat,
      timeModified: Date.now() / 1000,
    };

    return HttpResponse.json({
      success: true,
      data: updatedAssessment,
    });
  }),

  // POST switch workshop phase
  http.post(`*${API_BASE_URL}/workshop/:id/switchphase`, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as { targetPhase: WorkshopPhase };

    if (id === '403') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Only teachers can switch workshop phases',
          },
        },
        { status: 403 }
      );
    }

    const updatedWorkshop: Workshop = {
      ...mockWorkshop,
      id: parseInt(id as string),
      phase: body.targetPhase,
      timeModified: Date.now() / 1000,
    };

    return HttpResponse.json({
      success: true,
      data: updatedWorkshop,
    });
  }),

  // POST allocate reviewers
  http.post(`*${API_BASE_URL}/workshop/:id/allocate`, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as {
      method: string;
      settings?: Record<string, unknown>;
    };

    if (id === '403') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Only teachers can allocate reviewers',
          },
        },
        { status: 403 }
      );
    }

    if (id === '422') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Not enough submissions to allocate reviews',
          },
        },
        { status: 422 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        success: true,
        allocated: body.method === 'random' ? 6 : 2,
        message: `Allocated ${body.method === 'random' ? 6 : 2} assessments using ${body.method} method`,
      },
    });
  }),

  // GET workshop grades
  http.get(`*${API_BASE_URL}/workshop/:id/grades`, ({ params }) => {
    const { id } = params;

    if (id === '404') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Workshop not found',
          },
        },
        { status: 404 }
      );
    }

    if (id === '403') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to view grades',
          },
        },
        { status: 403 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: mockGrades,
    });
  }),

  // PUT update grade
  http.put(`*${API_BASE_URL}/workshop/:id/grade`, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as {
      submissionId: number;
      grade?: number | null;
      gradingGrade?: number | null;
      feedbackAuthor?: string;
      feedbackAuthorFormat?: number;
      published?: boolean;
    };

    if (id === '403') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Only teachers can update grades',
          },
        },
        { status: 403 }
      );
    }

    const updatedSubmission: WorkshopSubmission = {
      ...mockSubmission,
      id: body.submissionId,
      grade: body.grade ?? mockSubmission.grade,
      gradingGrade: body.gradingGrade ?? mockSubmission.gradingGrade,
      feedbackAuthor: body.feedbackAuthor ?? mockSubmission.feedbackAuthor,
      feedbackAuthorFormat: body.feedbackAuthorFormat ?? mockSubmission.feedbackAuthorFormat,
      published: body.published ?? mockSubmission.published,
      timeModified: Date.now() / 1000,
    };

    return HttpResponse.json({
      success: true,
      data: updatedSubmission,
    });
  }),
];

// ============================================================================
// Test Wrapper Component
// ============================================================================

/**
 * Create a wrapper component with fresh QueryClient for each test
 */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('workshopApi', () => {
  beforeAll(() => {
    // Set up mock JWT token in localStorage
    localStorage.setItem('moodle_access_token', MOCK_JWT_TOKEN);
  });

  afterAll(() => {
    localStorage.clear();
  });

  beforeEach(() => {
    server.use(...handlers);
  });

  afterEach(() => {
    server.resetHandlers();
  });

  // ==========================================================================
  // useWorkshop Tests
  // ==========================================================================

  describe('useWorkshop', () => {
    it('should fetch workshop details successfully', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshop(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.workshop.id).toBe(1);
      expect(result.current.data?.workshop.name).toBe('Peer Review Workshop');
      expect(result.current.data?.workshop.phase).toBe(WorkshopPhase.SUBMISSION);
    });

    it('should return user plan with workshop details', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshop(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.userPlan).toBeDefined();
      expect(result.current.data?.userPlan?.phases).toHaveLength(5);
    });

    it('should return capability flags', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshop(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.canSubmit).toBe(true);
      expect(result.current.data?.canAssess).toBe(false);
      expect(result.current.data?.canAllocate).toBe(false);
      expect(result.current.data?.canSwitchPhase).toBe(false);
    });

    it('should handle 404 error for non-existent workshop', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshop(404), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('should handle 403 error for permission denied', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshop(403), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('should not fetch when workshop ID is 0', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshop(0), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should respect enabled option', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshop(1, { enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  // ==========================================================================
  // useWorkshopUserPlan Tests
  // ==========================================================================

  describe('useWorkshopUserPlan', () => {
    it('should fetch user plan successfully', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshopUserPlan(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.userId).toBe(5);
      expect(result.current.data?.workshopId).toBe(1);
      expect(result.current.data?.phases).toHaveLength(5);
    });

    it('should include phases with tasks', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshopUserPlan(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Check submission phase
      const submissionPhase = result.current.data?.phases.find(
        (p) => p.phase === WorkshopPhase.SUBMISSION
      );
      expect(submissionPhase?.active).toBe(true);
      expect(submissionPhase?.tasks).toHaveLength(1);
      expect(submissionPhase?.tasks[0]?.completed).toBe(true);

      // Check assessment phase
      const assessmentPhase = result.current.data?.phases.find(
        (p) => p.phase === WorkshopPhase.ASSESSMENT
      );
      expect(assessmentPhase?.tasks).toHaveLength(2);
    });

    it('should handle 404 error', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshopUserPlan(404), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // ==========================================================================
  // useWorkshopSubmissions Tests
  // ==========================================================================

  describe('useWorkshopSubmissions', () => {
    it('should fetch submissions successfully', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshopSubmissions(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0]?.title).toBe('My Research Paper');
    });

    it('should include author information', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshopSubmissions(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const submission = result.current.data?.[0];
      expect(submission?.authorFirstName).toBe('John');
      expect(submission?.authorLastName).toBe('Doe');
      expect(submission?.authorEmail).toBe('john.doe@example.com');
    });

    it('should handle 404 error', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshopSubmissions(404), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // ==========================================================================
  // useCreateSubmission Tests
  // ==========================================================================

  describe('useCreateSubmission', () => {
    it('should create submission successfully', async () => {
      const { result } = renderHook(() => workshopApi.useCreateSubmission(), {
        wrapper: createWrapper(),
      });

      const submissionData = {
        workshopId: 1,
        title: 'New Submission',
        content: '<p>New submission content</p>',
      };

      let createdSubmission: WorkshopSubmission | undefined;
      await result.current.mutateAsync(submissionData).then((data) => {
        createdSubmission = data;
      });

      expect(createdSubmission?.title).toBe('New Submission');
      expect(createdSubmission?.content).toBe('<p>New submission content</p>');
      expect(createdSubmission?.workshopId).toBe(1);
    });

    it('should handle permission denied error', async () => {
      const { result } = renderHook(() => workshopApi.useCreateSubmission(), {
        wrapper: createWrapper(),
      });

      const submissionData = {
        workshopId: 403,
        title: 'New Submission',
        content: '<p>Content</p>',
      };

      await expect(result.current.mutateAsync(submissionData)).rejects.toThrow();
    });

    it('should include optional content format', async () => {
      const { result } = renderHook(() => workshopApi.useCreateSubmission(), {
        wrapper: createWrapper(),
      });

      const submissionData = {
        workshopId: 1,
        title: 'Formatted Submission',
        content: '**Bold content**',
        contentFormat: 4, // Markdown format
      };

      const createdSubmission = await result.current.mutateAsync(submissionData);
      expect(createdSubmission.contentFormat).toBe(4);
    });
  });

  // ==========================================================================
  // useUpdateSubmission Tests
  // ==========================================================================

  describe('useUpdateSubmission', () => {
    it('should update submission successfully', async () => {
      const { result } = renderHook(() => workshopApi.useUpdateSubmission(), {
        wrapper: createWrapper(),
      });

      const updateData = {
        workshopId: 1,
        submissionId: 1,
        title: 'Updated Title',
        content: '<p>Updated content</p>',
      };

      const updatedSubmission = await result.current.mutateAsync(updateData);

      expect(updatedSubmission.title).toBe('Updated Title');
      expect(updatedSubmission.content).toBe('<p>Updated content</p>');
    });

    it('should handle permission denied error', async () => {
      const { result } = renderHook(() => workshopApi.useUpdateSubmission(), {
        wrapper: createWrapper(),
      });

      const updateData = {
        workshopId: 1,
        submissionId: 403,
        title: 'Cannot Update',
      };

      await expect(result.current.mutateAsync(updateData)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // useDeleteSubmission Tests
  // ==========================================================================

  describe('useDeleteSubmission', () => {
    it('should delete submission successfully', async () => {
      const { result } = renderHook(() => workshopApi.useDeleteSubmission(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ workshopId: 1, submissionId: 1 })
      ).resolves.toBeUndefined();
    });

    it('should handle permission denied error', async () => {
      const { result } = renderHook(() => workshopApi.useDeleteSubmission(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ workshopId: 1, submissionId: 403 })
      ).rejects.toThrow();
    });

    it('should handle conflict error when submission has assessments', async () => {
      const { result } = renderHook(() => workshopApi.useDeleteSubmission(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ workshopId: 1, submissionId: 409 })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // useWorkshopAssessments Tests
  // ==========================================================================

  describe('useWorkshopAssessments', () => {
    it('should fetch assessments for workshop', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshopAssessments(1), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => expect(result.current.isSuccess).toBe(true),
        { timeout: 5000 }
      );

      // The hook fetches assessments for all submissions
      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
    });
  });

  // ==========================================================================
  // useSubmissionAssessments Tests
  // ==========================================================================

  describe('useSubmissionAssessments', () => {
    it('should fetch assessments for a specific submission', async () => {
      const { result } = renderHook(() => workshopApi.useSubmissionAssessments(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0]?.reviewerFirstName).toBe('Jane');
    });

    it('should include assessment grades and feedback', async () => {
      const { result } = renderHook(() => workshopApi.useSubmissionAssessments(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const assessment = result.current.data?.[0];
      expect(assessment?.grade).toBe(80.0);
      expect(assessment?.feedbackAuthor).toBe('Well-written paper with clear arguments.');
    });

    it('should handle 404 error', async () => {
      const { result } = renderHook(() => workshopApi.useSubmissionAssessments(404), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // ==========================================================================
  // useCreateAssessment Tests
  // ==========================================================================

  describe('useCreateAssessment', () => {
    it('should create assessment successfully', async () => {
      const { result } = renderHook(() => workshopApi.useCreateAssessment(), {
        wrapper: createWrapper(),
      });

      const assessmentData = {
        workshopId: 1,
        submissionId: 1,
        formData: {
          dimensionGrades: [
            { dimensionId: 1, grade: 85, peerComment: 'Good work', peerCommentFormat: 1 },
          ],
          feedbackAuthor: 'Overall good submission',
          feedbackAuthorFormat: 1,
        },
      };

      const createdAssessment = await result.current.mutateAsync(assessmentData);

      expect(createdAssessment.submissionId).toBe(1);
      expect(createdAssessment.grade).toBe(85.0);
    });

    it('should handle permission denied error', async () => {
      const { result } = renderHook(() => workshopApi.useCreateAssessment(), {
        wrapper: createWrapper(),
      });

      const assessmentData = {
        workshopId: 1,
        submissionId: 403,
        formData: {
          dimensionGrades: [],
        },
      };

      await expect(result.current.mutateAsync(assessmentData)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // useUpdateAssessment Tests
  // ==========================================================================

  describe('useUpdateAssessment', () => {
    it('should update assessment successfully', async () => {
      const { result } = renderHook(() => workshopApi.useUpdateAssessment(), {
        wrapper: createWrapper(),
      });

      const updateData = {
        workshopId: 1,
        submissionId: 1,
        assessmentId: 1,
        formData: {
          dimensionGrades: [
            { dimensionId: 1, grade: 90, peerComment: 'Excellent', peerCommentFormat: 1 },
          ],
          feedbackAuthor: 'Updated feedback',
          feedbackAuthorFormat: 1,
        },
      };

      const updatedAssessment = await result.current.mutateAsync(updateData);
      expect(updatedAssessment.feedbackAuthor).toBe('Updated feedback');
    });

    it('should handle permission denied error', async () => {
      const { result } = renderHook(() => workshopApi.useUpdateAssessment(), {
        wrapper: createWrapper(),
      });

      const updateData = {
        workshopId: 1,
        submissionId: 1,
        assessmentId: 403,
        formData: {
          dimensionGrades: [],
        },
      };

      await expect(result.current.mutateAsync(updateData)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // useSwitchWorkshopPhase Tests
  // ==========================================================================

  describe('useSwitchWorkshopPhase', () => {
    it('should switch workshop phase successfully', async () => {
      const { result } = renderHook(() => workshopApi.useSwitchWorkshopPhase(), {
        wrapper: createWrapper(),
      });

      const switchData = {
        workshopId: 1,
        targetPhase: WorkshopPhase.ASSESSMENT,
      };

      const updatedWorkshop = await result.current.mutateAsync(switchData);

      expect(updatedWorkshop.phase).toBe(WorkshopPhase.ASSESSMENT);
    });

    it('should handle all phase transitions', async () => {
      const { result } = renderHook(() => workshopApi.useSwitchWorkshopPhase(), {
        wrapper: createWrapper(),
      });

      // Test SUBMISSION -> ASSESSMENT
      let updated = await result.current.mutateAsync({
        workshopId: 1,
        targetPhase: WorkshopPhase.ASSESSMENT,
      });
      expect(updated.phase).toBe(WorkshopPhase.ASSESSMENT);

      // Test -> EVALUATION
      updated = await result.current.mutateAsync({
        workshopId: 1,
        targetPhase: WorkshopPhase.EVALUATION,
      });
      expect(updated.phase).toBe(WorkshopPhase.EVALUATION);

      // Test -> CLOSED
      updated = await result.current.mutateAsync({
        workshopId: 1,
        targetPhase: WorkshopPhase.CLOSED,
      });
      expect(updated.phase).toBe(WorkshopPhase.CLOSED);
    });

    it('should handle permission denied error', async () => {
      const { result } = renderHook(() => workshopApi.useSwitchWorkshopPhase(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          workshopId: 403,
          targetPhase: WorkshopPhase.ASSESSMENT,
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // useAllocateReviewers Tests
  // ==========================================================================

  describe('useAllocateReviewers', () => {
    it('should allocate reviewers using random method', async () => {
      const { result } = renderHook(() => workshopApi.useAllocateReviewers(), {
        wrapper: createWrapper(),
      });

      const allocationParams = {
        workshopId: 1,
        method: 'random' as const,
        settings: {
          numOfReviews: 3,
          excludeSameGroup: true,
        },
      };

      const allocationResult = await result.current.mutateAsync(allocationParams);

      expect(allocationResult.success).toBe(true);
      expect(allocationResult.allocated).toBe(6);
    });

    it('should allocate reviewers using manual method', async () => {
      const { result } = renderHook(() => workshopApi.useAllocateReviewers(), {
        wrapper: createWrapper(),
      });

      const allocationParams = {
        workshopId: 1,
        method: 'manual' as const,
        settings: {
          numPerAuthor: 2,
        },
      };

      const allocationResult = await result.current.mutateAsync(allocationParams);

      expect(allocationResult.success).toBe(true);
      expect(allocationResult.allocated).toBe(2);
    });

    it('should handle permission denied error', async () => {
      const { result } = renderHook(() => workshopApi.useAllocateReviewers(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          workshopId: 403,
          method: 'random',
        })
      ).rejects.toThrow();
    });

    it('should handle insufficient submissions error', async () => {
      const { result } = renderHook(() => workshopApi.useAllocateReviewers(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          workshopId: 422,
          method: 'random',
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // useWorkshopGrades Tests
  // ==========================================================================

  describe('useWorkshopGrades', () => {
    it('should fetch grades successfully', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshopGrades(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
    });

    it('should include submission and grading grades', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshopGrades(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const grade = result.current.data?.[0];
      expect(grade?.submissionGrade).toBe(85.5);
      expect(grade?.gradingGrade).toBe(18.0);
      expect(grade?.finalGrade).toBe(91.1);
    });

    it('should include author information', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshopGrades(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const grade = result.current.data?.[0];
      expect(grade?.authorId).toBe(5);
      expect(grade?.authorName).toBe('John Doe');
    });

    it('should handle 404 error', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshopGrades(404), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('should handle 403 error', async () => {
      const { result } = renderHook(() => workshopApi.useWorkshopGrades(403), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // ==========================================================================
  // useUpdateWorkshopGrade Tests
  // ==========================================================================

  describe('useUpdateWorkshopGrade', () => {
    it('should update grade successfully', async () => {
      const { result } = renderHook(() => workshopApi.useUpdateWorkshopGrade(), {
        wrapper: createWrapper(),
      });

      const gradeData = {
        workshopId: 1,
        submissionId: 1,
        grade: 95.0,
        feedbackAuthor: 'Excellent work!',
      };

      const updatedSubmission = await result.current.mutateAsync(gradeData);

      expect(updatedSubmission.grade).toBe(95.0);
      expect(updatedSubmission.feedbackAuthor).toBe('Excellent work!');
    });

    it('should update grading grade', async () => {
      const { result } = renderHook(() => workshopApi.useUpdateWorkshopGrade(), {
        wrapper: createWrapper(),
      });

      const gradeData = {
        workshopId: 1,
        submissionId: 1,
        gradingGrade: 19.5,
      };

      const updatedSubmission = await result.current.mutateAsync(gradeData);

      expect(updatedSubmission.gradingGrade).toBe(19.5);
    });

    it('should update publication status', async () => {
      const { result } = renderHook(() => workshopApi.useUpdateWorkshopGrade(), {
        wrapper: createWrapper(),
      });

      const gradeData = {
        workshopId: 1,
        submissionId: 1,
        published: true,
      };

      const updatedSubmission = await result.current.mutateAsync(gradeData);

      expect(updatedSubmission.published).toBe(true);
    });

    it('should handle permission denied error', async () => {
      const { result } = renderHook(() => workshopApi.useUpdateWorkshopGrade(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          workshopId: 403,
          submissionId: 1,
          grade: 90,
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('integration scenarios', () => {
    it('should handle complete workshop workflow', async () => {
      const wrapper = createWrapper();

      // 1. Fetch workshop details
      const { result: workshopResult } = renderHook(() => workshopApi.useWorkshop(1), { wrapper });
      await waitFor(() => expect(workshopResult.current.isSuccess).toBe(true));
      expect(workshopResult.current.data?.workshop.phase).toBe(WorkshopPhase.SUBMISSION);

      // 2. Create submission
      const { result: createSubmissionResult } = renderHook(
        () => workshopApi.useCreateSubmission(),
        { wrapper }
      );
      const submission = await createSubmissionResult.current.mutateAsync({
        workshopId: 1,
        title: 'Test Submission',
        content: '<p>Content</p>',
      });
      expect(submission.id).toBeDefined();

      // 3. Fetch submissions
      const { result: submissionsResult } = renderHook(
        () => workshopApi.useWorkshopSubmissions(1),
        { wrapper }
      );
      await waitFor(() => expect(submissionsResult.current.isSuccess).toBe(true));

      // 4. Switch to assessment phase (as teacher)
      const { result: switchPhaseResult } = renderHook(
        () => workshopApi.useSwitchWorkshopPhase(),
        { wrapper }
      );
      const updatedWorkshop = await switchPhaseResult.current.mutateAsync({
        workshopId: 1,
        targetPhase: WorkshopPhase.ASSESSMENT,
      });
      expect(updatedWorkshop.phase).toBe(WorkshopPhase.ASSESSMENT);

      // 5. Allocate reviewers
      const { result: allocateResult } = renderHook(() => workshopApi.useAllocateReviewers(), {
        wrapper,
      });
      const allocation = await allocateResult.current.mutateAsync({
        workshopId: 1,
        method: 'random',
        settings: { numOfReviews: 2 },
      });
      expect(allocation.success).toBe(true);
    });

    it('should handle assessment workflow', async () => {
      const wrapper = createWrapper();

      // 1. Fetch submissions to assess
      const { result: submissionsResult } = renderHook(
        () => workshopApi.useWorkshopSubmissions(1),
        { wrapper }
      );
      await waitFor(() => expect(submissionsResult.current.isSuccess).toBe(true));

      // 2. Create assessment
      const { result: createAssessmentResult } = renderHook(
        () => workshopApi.useCreateAssessment(),
        { wrapper }
      );
      const assessment = await createAssessmentResult.current.mutateAsync({
        workshopId: 1,
        submissionId: 1,
        formData: {
          dimensionGrades: [{ dimensionId: 1, grade: 85, peerComment: 'Good', peerCommentFormat: 1 }],
          feedbackAuthor: 'Well done',
        },
      });
      expect(assessment.grade).toBe(85.0);

      // 3. Update assessment
      const { result: updateAssessmentResult } = renderHook(
        () => workshopApi.useUpdateAssessment(),
        { wrapper }
      );
      const updatedAssessment = await updateAssessmentResult.current.mutateAsync({
        workshopId: 1,
        submissionId: 1,
        assessmentId: assessment.id,
        formData: {
          dimensionGrades: [{ dimensionId: 1, grade: 90, peerComment: 'Excellent', peerCommentFormat: 1 }],
          feedbackAuthor: 'Revised: Excellent work',
        },
      });
      expect(updatedAssessment.feedbackAuthor).toBe('Revised: Excellent work');
    });

    it('should handle grading workflow', async () => {
      const wrapper = createWrapper();

      // 1. Switch to evaluation phase
      const { result: switchResult } = renderHook(() => workshopApi.useSwitchWorkshopPhase(), {
        wrapper,
      });
      await switchResult.current.mutateAsync({
        workshopId: 1,
        targetPhase: WorkshopPhase.EVALUATION,
      });

      // 2. Fetch grades
      const { result: gradesResult } = renderHook(() => workshopApi.useWorkshopGrades(1), {
        wrapper,
      });
      await waitFor(() => expect(gradesResult.current.isSuccess).toBe(true));
      expect(gradesResult.current.data?.length).toBeGreaterThan(0);

      // 3. Update grades
      const { result: updateGradeResult } = renderHook(
        () => workshopApi.useUpdateWorkshopGrade(),
        { wrapper }
      );
      const updatedSubmission = await updateGradeResult.current.mutateAsync({
        workshopId: 1,
        submissionId: 1,
        grade: 95,
        published: true,
      });
      expect(updatedSubmission.grade).toBe(95);
      expect(updatedSubmission.published).toBe(true);

      // 4. Close workshop
      const closedWorkshop = await switchResult.current.mutateAsync({
        workshopId: 1,
        targetPhase: WorkshopPhase.CLOSED,
      });
      expect(closedWorkshop.phase).toBe(WorkshopPhase.CLOSED);
    });
  });
});
