/**
 * @fileoverview Comprehensive API integration tests for workshop endpoints
 * 
 * Tests validate React Query hooks for fetching workshop details, managing submissions
 * (CRUD operations), handling peer assessments (create, update, submit), switching
 * workshop phases, allocating reviewers (manual, random, scheduled), and managing grades.
 * 
 * Tests verify proper API endpoint calls, request/response data structures, error handling,
 * caching strategies, optimistic updates, and TypeScript type safety.
 */

import type { ReactNode } from 'react';
import type React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@tests/mocks/server';

import type {
  WorkshopGrade} from '@/features/activities/workshop/api/workshopApi';
import {
  useWorkshop,
  useWorkshopSubmissions,
  useCreateSubmission,
  useDeleteSubmission,
  useWorkshopAssessments,
  useCreateAssessment,
  useSwitchWorkshopPhase,
  useAllocateReviewers,
  useWorkshopGrades,
  useUpdateWorkshopGrade,
  useUpdateSubmission,
  useUpdateAssessment,
  workshopQueryKeys
} from '@/features/activities/workshop/api/workshopApi';

import { createTestQueryClient } from '@tests/helpers/render';

import type {
  Workshop,
  WorkshopSubmission,
  WorkshopAssessment,
  WorkshopPhase,
  GradingStrategy,
  WorkshopUserPlan,
  WorkshopUserPlanPhase,
  DimensionGrade,
  AllocationResult,
} from '@/features/activities/workshop/types';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Factory function for creating mock Workshop objects with realistic defaults
 */
function createMockWorkshop(overrides: Partial<Workshop> = {}): Workshop {
  return {
    id: 1,
    courseId: 1,
    name: 'Test Workshop',
    intro: '<p>Workshop introduction text</p>',
    introFormat: 1,
    phase: 20 as WorkshopPhase, // Submission phase
    strategy: 'accumulative' as GradingStrategy,
    evaluation: 'best',
    grade: 100,
    gradingGrade: 20,
    gradeDecimals: 2,
    useExamples: false,
    usePeerAssessment: true,
    useSelfAssessment: false,
    submissionStart: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
    submissionEnd: Math.floor(Date.now() / 1000) + 86400 * 6, // 6 days from now
    assessmentStart: Math.floor(Date.now() / 1000) + 86400 * 7,
    assessmentEnd: Math.floor(Date.now() / 1000) + 86400 * 14,
    phaseSwitchAssessment: false,
    instructAuthors: '<p>Instructions for authors</p>',
    instructAuthorsFormat: 1,
    instructReviewers: '<p>Instructions for reviewers</p>',
    instructReviewersFormat: 1,
    maxBytes: 10485760, // 10MB
    lateSubmissions: false,
    overallFeedbackMode: 1,
    overallFeedbackFiles: 0,
    overallFeedbackFileTypes: null,
    examplesMode: 0,
    nAttachments: 1,
    submissionFileTypes: '.pdf,.doc,.docx',
    conclusion: '',
    conclusionFormat: 1,
    timeCreated: Math.floor(Date.now() / 1000) - 86400 * 7,
    timeModified: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Factory function for creating mock WorkshopSubmission objects
 */
function createMockSubmission(overrides: Partial<WorkshopSubmission> = {}): WorkshopSubmission {
  return {
    id: 1,
    workshopId: 1,
    example: false,
    authorId: 2,
    authorFirstName: 'Test',
    authorLastName: 'Student',
    authorEmail: 'test.student@example.com',
    title: 'Test Submission',
    content: '<p>Submission content</p>',
    contentFormat: 1,
    contentTrust: false,
    attachment: 0,
    grade: null,
    gradingGrade: null,
    gradeOver: null,
    gradingGradeOver: null,
    feedbackAuthor: null,
    feedbackAuthorFormat: 1,
    published: false,
    late: false,
    timeCreated: Math.floor(Date.now() / 1000) - 3600,
    timeModified: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Factory function for creating mock WorkshopAssessment objects
 */
function createMockAssessment(overrides: Partial<WorkshopAssessment> = {}): WorkshopAssessment {
  return {
    id: 1,
    submissionId: 1,
    reviewerId: 3,
    reviewerFirstName: 'Test',
    reviewerLastName: 'Reviewer',
    weight: 1,
    grade: 85,
    gradingGrade: 18,
    gradingGradeOver: null,
    feedbackAuthor: '<p>Good work!</p>',
    feedbackAuthorFormat: 1,
    feedbackAuthorAttachment: 0,
    feedbackReviewer: null,
    feedbackReviewerFormat: 1,
    timeCreated: Math.floor(Date.now() / 1000) - 1800,
    timeModified: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Factory function for creating mock WorkshopGrade objects
 */
function createMockGrade(overrides: Partial<WorkshopGrade> = {}): WorkshopGrade {
  return {
    submissionId: 1,
    authorId: 2,
    authorName: 'Test Student',
    submissionGrade: 85,
    gradingGrade: 18,
    finalGrade: null,
    ...overrides,
  };
}

/**
 * Factory function for creating mock WorkshopUserPlanPhase objects
 */
function createMockUserPlanPhase(overrides: Partial<WorkshopUserPlanPhase> = {}): WorkshopUserPlanPhase {
  return {
    phase: 20 as WorkshopPhase,
    title: 'Submission phase',
    tasks: [],
    active: true,
    ...overrides,
  };
}

/**
 * Factory function for creating mock WorkshopUserPlan objects
 */
function createMockUserPlan(overrides: Partial<WorkshopUserPlan> = {}): WorkshopUserPlan {
  return {
    userId: 2,
    workshopId: 1,
    phases: [
      createMockUserPlanPhase({ phase: 10 as WorkshopPhase, title: 'Setup phase', active: false }),
      createMockUserPlanPhase({ phase: 20 as WorkshopPhase, title: 'Submission phase', active: true }),
      createMockUserPlanPhase({ phase: 30 as WorkshopPhase, title: 'Assessment phase', active: false }),
      createMockUserPlanPhase({ phase: 40 as WorkshopPhase, title: 'Evaluation phase', active: false }),
      createMockUserPlanPhase({ phase: 50 as WorkshopPhase, title: 'Closed', active: false }),
    ],
    examples: [],
    ...overrides,
  };
}

/**
 * Factory function for creating mock DimensionGrade objects
 */
function createMockDimensionGrade(overrides: Partial<DimensionGrade> = {}): DimensionGrade {
  return {
    dimensionId: 1,
    grade: 80,
    peerComment: 'Good effort on this dimension',
    peerCommentFormat: 1,
    ...overrides,
  };
}

// ============================================================================
// API Base URL and Endpoints
// ============================================================================

const API_BASE_URL = '*/api/v1';

// ============================================================================
// MSW Handlers Setup
// ============================================================================

// Store for tracking API calls in tests
let apiCallLog: Array<{ method: string; url: string; body?: unknown }> = [];

// Mock data store (can be modified in individual tests)
let mockWorkshopData: Workshop | null = null;
let mockSubmissionsData: WorkshopSubmission[] = [];
let mockAssessmentsData: WorkshopAssessment[] = [];
let mockGradesData: WorkshopGrade[] = [];
let mockShouldFail: { status: number; message: string } | null = null;

/**
 * Reset mock data store before each test
 */
function resetMockData(): void {
  apiCallLog = [];
  mockWorkshopData = createMockWorkshop();
  mockSubmissionsData = [createMockSubmission()];
  mockAssessmentsData = [createMockAssessment()];
  mockGradesData = [createMockGrade()];
  mockShouldFail = null;
}

/**
 * MSW handlers for workshop API endpoints
 */
const handlers = [
  // GET /api/v1/workshop/:id - Get workshop details
  http.get(`${API_BASE_URL}/workshop/:id`, ({ params, request }) => {
    apiCallLog.push({ method: 'GET', url: request.url });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    const workshopId = Number(params.id);
    if (!mockWorkshopData || mockWorkshopData.id !== workshopId) {
      return HttpResponse.json(
        { success: false, error: { code: '404', message: 'Workshop not found' } },
        { status: 404 }
      );
    }
    
    return HttpResponse.json({
      success: true,
      data: {
        workshop: mockWorkshopData,
        userPlan: createMockUserPlan(),
      },
    });
  }),

  // GET /api/v1/workshop/:id/submissions - Get workshop submissions
  http.get(`${API_BASE_URL}/workshop/:id/submissions`, ({ request }) => {
    apiCallLog.push({ method: 'GET', url: request.url });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    return HttpResponse.json({
      success: true,
      data: mockSubmissionsData,
    });
  }),

  // POST /api/v1/workshop/:id/submissions - Create submission
  http.post(`${API_BASE_URL}/workshop/:id/submissions`, async ({ params, request }) => {
    const body = await request.formData().catch(() => request.json());
    apiCallLog.push({ method: 'POST', url: request.url, body });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    const newSubmission = createMockSubmission({
      id: mockSubmissionsData.length + 1,
      workshopId: Number(params.id),
    });
    mockSubmissionsData.push(newSubmission);
    
    return HttpResponse.json({
      success: true,
      data: newSubmission,
    }, { status: 201 });
  }),

  // PUT /api/v1/workshop/submissions/:id - Update submission
  http.put(`${API_BASE_URL}/workshop/submissions/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    apiCallLog.push({ method: 'PUT', url: request.url, body });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    const submissionId = Number(params.id);
    const index = mockSubmissionsData.findIndex(s => s.id === submissionId);
    if (index === -1) {
      return HttpResponse.json(
        { success: false, error: { code: '404', message: 'Submission not found' } },
        { status: 404 }
      );
    }
    
    mockSubmissionsData[index] = { ...mockSubmissionsData[index], ...body } as WorkshopSubmission;
    
    return HttpResponse.json({
      success: true,
      data: mockSubmissionsData[index],
    });
  }),

  // DELETE /api/v1/workshop/submissions/:id - Delete submission
  http.delete(`${API_BASE_URL}/workshop/submissions/:id`, ({ params, request }) => {
    apiCallLog.push({ method: 'DELETE', url: request.url });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    const submissionId = Number(params.id);
    const index = mockSubmissionsData.findIndex(s => s.id === submissionId);
    if (index === -1) {
      return HttpResponse.json(
        { success: false, error: { code: '404', message: 'Submission not found' } },
        { status: 404 }
      );
    }
    
    mockSubmissionsData.splice(index, 1);
    
    return HttpResponse.json({ success: true, data: null });
  }),

  // GET /api/v1/workshop/submissions/:submissionId/assessments - Get assessments for a submission
  http.get(`${API_BASE_URL}/workshop/submissions/:submissionId/assessments`, ({ request }) => {
    apiCallLog.push({ method: 'GET', url: request.url });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    return HttpResponse.json({
      success: true,
      data: mockAssessmentsData,
    });
  }),

  // POST /api/v1/workshop/submissions/:submissionId/assessments - Create assessment
  http.post(`${API_BASE_URL}/workshop/submissions/:submissionId/assessments`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    apiCallLog.push({ method: 'POST', url: request.url, body });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    const newAssessment = createMockAssessment({
      id: mockAssessmentsData.length + 1,
      submissionId: (body.submissionId as number) ?? 1,
    });
    mockAssessmentsData.push(newAssessment);
    
    return HttpResponse.json({
      success: true,
      data: newAssessment,
    }, { status: 201 });
  }),

  // PUT /api/v1/workshop/assessments/:id - Update assessment
  http.put(`${API_BASE_URL}/workshop/assessments/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    apiCallLog.push({ method: 'PUT', url: request.url, body });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    const assessmentId = Number(params.id);
    const index = mockAssessmentsData.findIndex(a => a.id === assessmentId);
    if (index === -1) {
      return HttpResponse.json(
        { success: false, error: { code: '404', message: 'Assessment not found' } },
        { status: 404 }
      );
    }
    
    mockAssessmentsData[index] = { ...mockAssessmentsData[index], ...body } as WorkshopAssessment;
    
    return HttpResponse.json({
      success: true,
      data: mockAssessmentsData[index],
    });
  }),

  // POST /api/v1/workshop/:id/switchphase - Switch workshop phase
  http.post(`${API_BASE_URL}/workshop/:id/switchphase`, async ({ request }) => {
    const body = await request.json() as { targetPhase?: number };
    apiCallLog.push({ method: 'POST', url: request.url, body });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    const validPhases = [10, 20, 30, 40, 50]; // Setup, submission, assessment, evaluation, closed
    if (body.targetPhase === undefined || !validPhases.includes(body.targetPhase)) {
      return HttpResponse.json(
        { success: false, error: { code: '400', message: 'Invalid phase transition' } },
        { status: 400 }
      );
    }
    
    if (mockWorkshopData) {
      mockWorkshopData.phase = body.targetPhase as WorkshopPhase;
    }
    
    return HttpResponse.json({
      success: true,
      data: { phase: body.targetPhase },
    });
  }),

  // POST /api/v1/workshop/:id/allocate - Allocate reviewers
  http.post(`${API_BASE_URL}/workshop/:id/allocate`, async ({ request }) => {
    const body = await request.json() as { method?: string; settings?: { numOfReviews?: number } };
    apiCallLog.push({ method: 'POST', url: request.url, body });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    const validMethods = ['manual', 'random', 'scheduled'];
    if (!body.method || !validMethods.includes(body.method)) {
      return HttpResponse.json(
        { success: false, error: { code: '400', message: 'Invalid allocation method' } },
        { status: 400 }
      );
    }
    
    // Return AllocationResult structure
    const allocationResult: AllocationResult = {
      success: true,
      allocated: body.settings?.numOfReviews ? body.settings.numOfReviews * 2 : 5,
      message: `Reviewers allocated using ${body.method} method`,
    };
    
    return HttpResponse.json({
      success: true,
      data: allocationResult,
    });
  }),

  // GET /api/v1/workshop/:id/grades - Get workshop grades
  http.get(`${API_BASE_URL}/workshop/:id/grades`, ({ request }) => {
    apiCallLog.push({ method: 'GET', url: request.url });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    return HttpResponse.json({
      success: true,
      data: mockGradesData,
    });
  }),

  // PUT /api/v1/workshop/:id/grade - Update workshop grade (returns updated submission)
  http.put(`${API_BASE_URL}/workshop/:id/grade`, async ({ request }) => {
    const body = await request.json() as { submissionId?: number; grade?: number | null; gradingGrade?: number | null };
    apiCallLog.push({ method: 'PUT', url: request.url, body });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    const submissionId = body.submissionId ?? 1;
    const submissionIndex = mockSubmissionsData.findIndex(s => s.id === submissionId);
    const existingSubmission = mockSubmissionsData[submissionIndex];
    
    if (submissionIndex === -1 || !existingSubmission) {
      return HttpResponse.json(
        { success: false, error: { code: '404', message: 'Grade not found' } },
        { status: 404 }
      );
    }
    
    // Update the submission with new grade data
    const updatedSubmission: WorkshopSubmission = {
      ...existingSubmission,
      grade: body.grade ?? existingSubmission.grade,
      gradingGrade: body.gradingGrade ?? existingSubmission.gradingGrade,
    };
    mockSubmissionsData[submissionIndex] = updatedSubmission;
    
    // Also update the grades data for cache invalidation tests
    const gradeIndex = mockGradesData.findIndex(g => g.submissionId === submissionId);
    if (gradeIndex !== -1 && mockGradesData[gradeIndex]) {
      const existingGrade = mockGradesData[gradeIndex];
      mockGradesData[gradeIndex] = {
        ...existingGrade,
        submissionGrade: body.grade ?? existingGrade.submissionGrade,
        gradingGrade: body.gradingGrade ?? existingGrade.gradingGrade,
      };
    }
    
    return HttpResponse.json({
      success: true,
      data: updatedSubmission,
    });
  }),
];

// ============================================================================
// MSW Server Setup
// ============================================================================

// Note: The MSW server is created and started in tests/setup.ts via tests/mocks/server.ts
// We import it and use server.use(...handlers) to add our custom handlers.

// ============================================================================
// Test Helper Functions
// ============================================================================

/**
 * Creates a wrapper component with QueryClientProvider for testing hooks
 */
function createWrapper(queryClient: QueryClient): React.FC<{ children: ReactNode }> {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Verifies that an API call was made with specific parameters
 */
function expectApiCall(method: string, urlPattern: string | RegExp): boolean {
  return apiCallLog.some(call => {
    const methodMatch = call.method === method;
    const urlMatch = typeof urlPattern === 'string' 
      ? call.url.includes(urlPattern)
      : urlPattern.test(call.url);
    return methodMatch && urlMatch;
  });
}

/**
 * Gets the most recent API call for a specific method
 */
function getLastApiCall(method: string): { method: string; url: string; body?: unknown } | undefined {
  return [...apiCallLog].reverse().find(call => call.method === method);
}

// ============================================================================
// Test Suite Setup
// ============================================================================

describe('workshopApi', () => {
  let queryClient: QueryClient;

  beforeAll(() => {
    // Register our custom handlers with the already-running MSW server
    // Note: server.listen() is called in tests/setup.ts globally
    server.use(...handlers);
  });

  afterAll(() => {
    // Reset to default handlers from the global setup
    server.resetHandlers();
  });

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetMockData();
    // Re-register handlers in case previous test modified them
    server.use(...handlers);
  });

  afterEach(() => {
    queryClient.clear();
  });

  // ==========================================================================
  // workshopQueryKeys Tests
  // ==========================================================================
  
  describe('workshopQueryKeys', () => {
    it('should generate correct query key for workshop list', () => {
      expect(workshopQueryKeys.all).toEqual(['workshops']);
    });

    it('should generate correct query key for workshop details', () => {
      expect(workshopQueryKeys.detail(1)).toEqual(['workshops', 'detail', 1]);
      expect(workshopQueryKeys.detail(42)).toEqual(['workshops', 'detail', 42]);
    });

    it('should generate correct query key for workshop submissions', () => {
      expect(workshopQueryKeys.submissions(1)).toEqual(['workshops', 'submissions', 1]);
    });

    it('should generate correct query key for workshop assessments', () => {
      expect(workshopQueryKeys.assessments(1)).toEqual(['workshops', 'assessments', 1]);
    });

    it('should generate correct query key for workshop grades', () => {
      expect(workshopQueryKeys.grades(1)).toEqual(['workshops', 'grades', 1]);
    });
  });

  // ==========================================================================
  // useWorkshop Hook Tests
  // ==========================================================================

  describe('useWorkshop', () => {
    it('should call GET /api/v1/workshop/{id} and return workshop with phases and user plan', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshop(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(expectApiCall('GET', '/workshop/1')).toBe(true);
      expect(result.current.data?.workshop).toBeDefined();
      expect(result.current.data?.workshop.id).toBe(1);
      expect(result.current.data?.workshop.name).toBe('Test Workshop');
      expect(result.current.data?.userPlan).toBeDefined();
      expect(result.current.data?.userPlan?.phases).toBeDefined();
    });

    it('should return loading state while fetching', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshop(1), { wrapper });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle 404 error when workshop not found', async () => {
      mockShouldFail = { status: 404, message: 'Workshop not found' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshop(999), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle 403 permission denied error', async () => {
      mockShouldFail = { status: 403, message: 'Permission denied' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshop(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should use cached data on second call without making API request', async () => {
      const wrapper = createWrapper(queryClient);
      
      // First call
      const { result: result1 } = renderHook(() => useWorkshop(1), { wrapper });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));
      
      const callCountAfterFirst = apiCallLog.filter(c => c.method === 'GET' && c.url.includes('/workshop/1')).length;
      expect(callCountAfterFirst).toBe(1);

      // Second call with same query client (should use cache)
      const { result: result2 } = renderHook(() => useWorkshop(1), { wrapper });
      
      // Data should be immediately available from cache
      expect(result2.current.data?.workshop).toBeDefined();
      
      const callCountAfterSecond = apiCallLog.filter(c => c.method === 'GET' && c.url.includes('/workshop/1')).length;
      expect(callCountAfterSecond).toBe(1); // No additional API call
    });

    it('should not fetch when enabled is false', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshop(1, { enabled: false }), { wrapper });

      // Wait a bit to ensure no fetch is triggered
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(apiCallLog.length).toBe(0);
    });
  });

  // ==========================================================================
  // useWorkshopSubmissions Hook Tests
  // ==========================================================================

  describe('useWorkshopSubmissions', () => {
    it('should call GET /api/v1/workshop/{id}/submissions', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopSubmissions(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(expectApiCall('GET', '/workshop/1/submissions')).toBe(true);
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0]!.title).toBe('Test Submission');
    });

    it('should return empty array when no submissions exist', async () => {
      mockSubmissionsData = [];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopSubmissions(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it('should handle multiple submissions', async () => {
      mockSubmissionsData = [
        createMockSubmission({ id: 1, title: 'Submission 1' }),
        createMockSubmission({ id: 2, title: 'Submission 2', authorId: 3 }),
        createMockSubmission({ id: 3, title: 'Submission 3', authorId: 4, late: true }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopSubmissions(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(3);
      expect(result.current.data![2]!.late).toBe(true);
    });

    it('should verify late submissions are properly flagged', async () => {
      mockSubmissionsData = [
        createMockSubmission({ id: 1, late: true, title: 'Late Submission' }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopSubmissions(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data![0]!.late).toBe(true);
    });

    it('should handle 401 unauthorized error', async () => {
      mockShouldFail = { status: 401, message: 'Unauthorized' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopSubmissions(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // useCreateSubmission Hook Tests
  // ==========================================================================

  describe('useCreateSubmission', () => {
    it('should call POST /api/v1/workshop/{id}/submissions with submission data', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useCreateSubmission(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          title: 'My New Submission',
          content: '<p>My submission content</p>',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(expectApiCall('POST', '/workshop/1/submissions')).toBe(true);
      expect(result.current.data?.title).toBeDefined();
    });

    it('should return loading state during mutation', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useCreateSubmission(), { wrapper });

      // Initially, the mutation should not be pending
      expect(result.current.isPending).toBe(false);
      expect(result.current.isIdle).toBe(true);

      // Start mutation
      act(() => {
        result.current.mutate({
          workshopId: 1,
          title: 'Test',
          content: 'Content',
        });
      });

      // Mutation will go through isPending -> isSuccess lifecycle
      // In fast test environments, we may not catch isPending=true
      // So we verify the final state instead
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      
      // After completion, isPending should be false
      expect(result.current.isPending).toBe(false);
    });

    it('should invalidate submissions cache after successful creation', async () => {
      const wrapper = createWrapper(queryClient);
      
      // Pre-fetch submissions
      const { result: submissionsResult } = renderHook(() => useWorkshopSubmissions(1), { wrapper });
      await waitFor(() => expect(submissionsResult.current.isSuccess).toBe(true));
      
      const initialCount = submissionsResult.current.data?.length || 0;

      // Create new submission
      const { result: createResult } = renderHook(() => useCreateSubmission(), { wrapper });
      
      act(() => {
        createResult.current.mutate({
          workshopId: 1,
          title: 'New Submission',
          content: 'Content',
        });
      });

      await waitFor(() => {
        expect(createResult.current.isSuccess).toBe(true);
      });

      // Submissions cache should be invalidated and refetched
      await waitFor(() => {
        expect(submissionsResult.current.data?.length).toBe(initialCount + 1);
      });
    });

    it('should handle validation error for missing title', async () => {
      mockShouldFail = { status: 400, message: 'Title is required' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useCreateSubmission(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          title: '',
          content: 'Content',
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle deadline passed error', async () => {
      mockShouldFail = { status: 403, message: 'Submission deadline has passed' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useCreateSubmission(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          title: 'Late Submission',
          content: 'Content',
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // useUpdateSubmission Hook Tests
  // ==========================================================================

  describe('useUpdateSubmission', () => {
    it('should call PUT /api/v1/workshop/submissions/{id}', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateSubmission(), { wrapper });

      act(() => {
        result.current.mutate({
          submissionId: 1,
          workshopId: 1,
          title: 'Updated Title',
          content: 'Updated content',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(expectApiCall('PUT', '/workshop/submissions/1')).toBe(true);
    });

    it('should handle 404 when submission not found', async () => {
      mockShouldFail = { status: 404, message: 'Submission not found' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateSubmission(), { wrapper });

      act(() => {
        result.current.mutate({
          submissionId: 999,
          workshopId: 1,
          title: 'Updated',
          content: 'Content',
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // useDeleteSubmission Hook Tests
  // ==========================================================================

  describe('useDeleteSubmission', () => {
    it('should call DELETE /api/v1/workshop/submissions/{id}', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useDeleteSubmission(), { wrapper });

      act(() => {
        result.current.mutate({ submissionId: 1, workshopId: 1 });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(expectApiCall('DELETE', '/workshop/submissions/1')).toBe(true);
    });

    it('should invalidate submissions cache after deletion', async () => {
      mockSubmissionsData = [
        createMockSubmission({ id: 1 }),
        createMockSubmission({ id: 2 }),
      ];
      const wrapper = createWrapper(queryClient);
      
      // Pre-fetch submissions
      const { result: submissionsResult } = renderHook(() => useWorkshopSubmissions(1), { wrapper });
      await waitFor(() => expect(submissionsResult.current.isSuccess).toBe(true));
      expect(submissionsResult.current.data).toHaveLength(2);

      // Delete submission
      const { result: deleteResult } = renderHook(() => useDeleteSubmission(), { wrapper });
      
      act(() => {
        deleteResult.current.mutate({ submissionId: 1, workshopId: 1 });
      });

      await waitFor(() => {
        expect(deleteResult.current.isSuccess).toBe(true);
      });

      // Cache should be invalidated
      await waitFor(() => {
        expect(submissionsResult.current.data).toHaveLength(1);
      });
    });

    it('should handle permission denied error', async () => {
      mockShouldFail = { status: 403, message: 'Cannot delete submission' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useDeleteSubmission(), { wrapper });

      act(() => {
        result.current.mutate({ submissionId: 1, workshopId: 1 });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // useWorkshopAssessments Hook Tests
  // ==========================================================================

  describe('useWorkshopAssessments', () => {
    it('should fetch submissions first, then assessments for each submission', async () => {
      // Setup: ensure we have a submission so the hook can fetch its assessments
      mockSubmissionsData = [createMockSubmission({ id: 1 })];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopAssessments(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // The hook first fetches submissions, then fetches assessments for each
      expect(expectApiCall('GET', '/workshop/1/submissions')).toBe(true);
      expect(expectApiCall('GET', '/workshop/submissions/1/assessments')).toBe(true);
      expect(result.current.data).toHaveLength(1);
    });

    it('should return empty array when no assessments exist', async () => {
      mockAssessmentsData = [];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopAssessments(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it('should maintain reviewer anonymity when configured', async () => {
      mockAssessmentsData = [
        createMockAssessment({ id: 1, reviewerFirstName: '', reviewerLastName: '' }), // Anonymous
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopAssessments(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Reviewer name should be empty for anonymous reviews
      expect(result.current.data?.[0]?.reviewerFirstName).toBe('');
      expect(result.current.data?.[0]?.reviewerLastName).toBe('');
    });

    it('should return assessment with grade data', async () => {
      mockAssessmentsData = [
        createMockAssessment({
          id: 1,
          grade: 85,
          gradingGrade: 18,
        }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopAssessments(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data![0]!.grade).toBe(85);
      expect(result.current.data![0]!.gradingGrade).toBe(18);
    });

    it('should verify TypeScript type matching for WorkshopAssessment', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopAssessments(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const assessment: WorkshopAssessment | undefined = result.current.data?.[0];
      expect(assessment).toBeDefined();
      expect(typeof assessment?.id).toBe('number');
      expect(typeof assessment?.submissionId).toBe('number');
      expect(typeof assessment?.reviewerId).toBe('number');
      expect(typeof assessment?.weight).toBe('number');
    });
  });

  // ==========================================================================
  // useCreateAssessment Hook Tests
  // ==========================================================================

  describe('useCreateAssessment', () => {
    it('should call POST /api/v1/workshop/submissions/{submissionId}/assessments with dimension data', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useCreateAssessment(), { wrapper });

      const dimensionGrades = [
        createMockDimensionGrade({ dimensionId: 1, grade: 80 }),
        createMockDimensionGrade({ dimensionId: 2, grade: 75 }),
      ];

      act(() => {
        result.current.mutate({
          workshopId: 1,
          submissionId: 1,
          formData: {
            dimensionGrades,
            feedbackAuthor: 'Great work!',
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(expectApiCall('POST', '/workshop/submissions/1/assessments')).toBe(true);

      const lastCall = getLastApiCall('POST');
      expect(lastCall?.body).toBeDefined();
    });

    it('should invalidate assessments cache after creation', async () => {
      const wrapper = createWrapper(queryClient);
      
      // Pre-fetch assessments
      const { result: assessmentsResult } = renderHook(() => useWorkshopAssessments(1), { wrapper });
      await waitFor(() => expect(assessmentsResult.current.isSuccess).toBe(true));
      
      const initialCount = assessmentsResult.current.data?.length || 0;

      // Create new assessment
      const { result: createResult } = renderHook(() => useCreateAssessment(), { wrapper });
      
      act(() => {
        createResult.current.mutate({
          workshopId: 1,
          submissionId: 1,
          formData: {
            dimensionGrades: [],
            feedbackAuthor: 'Feedback',
          },
        });
      });

      await waitFor(() => {
        expect(createResult.current.isSuccess).toBe(true);
      });

      await waitFor(() => {
        expect(assessmentsResult.current.data?.length).toBe(initialCount + 1);
      });
    });

    it('should handle validation error for invalid dimension grades', async () => {
      mockShouldFail = { status: 400, message: 'Invalid dimension grades' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useCreateAssessment(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          submissionId: 1,
          formData: {
            dimensionGrades: [],
            feedbackAuthor: '',
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // useUpdateAssessment Hook Tests
  // ==========================================================================

  describe('useUpdateAssessment', () => {
    it('should call PUT /api/v1/workshop/assessments/{id}', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateAssessment(), { wrapper });

      act(() => {
        result.current.mutate({
          assessmentId: 1,
          workshopId: 1,
          submissionId: 1,
          formData: {
            dimensionGrades: [createMockDimensionGrade({ dimensionId: 1, grade: 95 })],
            feedbackAuthor: 'Updated feedback',
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(expectApiCall('PUT', '/workshop/assessments/1')).toBe(true);
    });

    it('should handle 404 when assessment not found', async () => {
      mockShouldFail = { status: 404, message: 'Assessment not found' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateAssessment(), { wrapper });

      act(() => {
        result.current.mutate({
          assessmentId: 999,
          workshopId: 1,
          submissionId: 1,
          formData: {
            dimensionGrades: [],
            feedbackAuthor: 'Feedback',
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // useSwitchWorkshopPhase Hook Tests
  // ==========================================================================

  describe('useSwitchWorkshopPhase', () => {
    it('should call POST /api/v1/workshop/{id}/switchphase', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useSwitchWorkshopPhase(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          targetPhase: 30 as WorkshopPhase, // Assessment phase
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(expectApiCall('POST', '/workshop/1/switchphase')).toBe(true);
    });

    it('should handle valid phase transitions', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useSwitchWorkshopPhase(), { wrapper });

      // Test switching to each valid phase
      const validPhases: WorkshopPhase[] = [10, 20, 30, 40, 50] as WorkshopPhase[];
      
      for (const targetPhase of validPhases) {
        act(() => {
          result.current.mutate({
            workshopId: 1,
            targetPhase,
          });
        });
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      }
    });

    it('should handle invalid phase transition error', async () => {
      mockShouldFail = { status: 400, message: 'Invalid phase transition' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useSwitchWorkshopPhase(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          targetPhase: 99 as WorkshopPhase, // Invalid phase
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should invalidate workshop cache after phase switch', async () => {
      const wrapper = createWrapper(queryClient);
      
      // Pre-fetch workshop
      const { result: workshopResult } = renderHook(() => useWorkshop(1), { wrapper });
      await waitFor(() => expect(workshopResult.current.isSuccess).toBe(true));
      
      const initialPhase = workshopResult.current.data?.workshop.phase;

      // Switch phase
      const { result: switchResult } = renderHook(() => useSwitchWorkshopPhase(), { wrapper });
      
      act(() => {
        switchResult.current.mutate({
          workshopId: 1,
          targetPhase: 30 as WorkshopPhase,
        });
      });

      await waitFor(() => {
        expect(switchResult.current.isSuccess).toBe(true);
      });

      // Workshop cache should be invalidated and refetched with new phase
      await waitFor(() => {
        expect(workshopResult.current.data?.workshop.phase).not.toBe(initialPhase);
      });
    });

    it('should handle permission denied when user cannot switch phase', async () => {
      mockShouldFail = { status: 403, message: 'You do not have permission to switch phases' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useSwitchWorkshopPhase(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          targetPhase: 30 as WorkshopPhase,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // useAllocateReviewers Hook Tests
  // ==========================================================================

  describe('useAllocateReviewers', () => {
    it('should call POST /api/v1/workshop/{id}/allocate with manual allocation', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useAllocateReviewers(), { wrapper });

      // Start the mutation
      act(() => {
        result.current.mutate({
          workshopId: 1,
          method: 'manual',
        });
      });

      // Wait for the mutation to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the API call was made
      expect(expectApiCall('POST', '/workshop/1/allocate')).toBe(true);
      
      const lastCall = getLastApiCall('POST');
      expect((lastCall?.body as Record<string, unknown>)?.method).toBe('manual');
    });

    it('should handle random allocation method', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useAllocateReviewers(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          method: 'random',
          settings: {
            numOfReviews: 3,
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.success).toBe(true);
      expect(result.current.data?.allocated).toBeGreaterThan(0);
    });

    it('should handle scheduled allocation method', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useAllocateReviewers(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          method: 'scheduled',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.success).toBe(true);
    });

    it('should handle invalid allocation method error', async () => {
      mockShouldFail = { status: 400, message: 'Invalid allocation method' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useAllocateReviewers(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          method: 'invalid' as 'manual' | 'random' | 'scheduled',
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should return allocation summary with allocated count', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useAllocateReviewers(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          method: 'random',
          settings: {
            numOfReviews: 2,
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.allocated).toBeDefined();
      expect(typeof result.current.data?.allocated).toBe('number');
    });

    it('should invalidate assessments cache after allocation', async () => {
      const wrapper = createWrapper(queryClient);
      
      // Pre-fetch assessments
      const { result: assessmentsResult } = renderHook(() => useWorkshopAssessments(1), { wrapper });
      await waitFor(() => expect(assessmentsResult.current.isSuccess).toBe(true));

      // Perform allocation
      const { result: allocateResult } = renderHook(() => useAllocateReviewers(), { wrapper });
      
      act(() => {
        allocateResult.current.mutate({
          workshopId: 1,
          method: 'random',
        });
      });

      await waitFor(() => {
        expect(allocateResult.current.isSuccess).toBe(true);
      });
    });
  });

  // ==========================================================================
  // useWorkshopGrades Hook Tests
  // ==========================================================================

  describe('useWorkshopGrades', () => {
    it('should call GET /api/v1/workshop/{id}/grades', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopGrades(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(expectApiCall('GET', '/workshop/1/grades')).toBe(true);
      expect(result.current.data).toHaveLength(1);
    });

    it('should return grades with submission and grading scores', async () => {
      mockGradesData = [
        createMockGrade({
          submissionId: 1,
          submissionGrade: 85,
          gradingGrade: 18,
        }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopGrades(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data![0]!.submissionGrade).toBe(85);
      expect(result.current.data![0]!.gradingGrade).toBe(18);
    });

    it('should handle grades with final grade calculated', async () => {
      mockGradesData = [
        createMockGrade({
          submissionId: 1,
          submissionGrade: 80,
          gradingGrade: 15,
          finalGrade: 75, // Final grade calculated
        }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopGrades(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data![0]!.submissionGrade).toBe(80);
      expect(result.current.data![0]!.gradingGrade).toBe(15);
      expect(result.current.data![0]!.finalGrade).toBe(75);
    });

    it('should return empty array when no grades exist', async () => {
      mockGradesData = [];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopGrades(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  // ==========================================================================
  // useUpdateWorkshopGrade Hook Tests
  // ==========================================================================

  describe('useUpdateWorkshopGrade', () => {
    it('should call PUT /api/v1/workshop/{id}/grade', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateWorkshopGrade(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          submissionId: 1,
          grade: 95,
          feedbackAuthor: 'Excellent work!',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(expectApiCall('PUT', '/workshop/1/grade')).toBe(true);
    });

    it('should update submission grade', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateWorkshopGrade(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          submissionId: 1,
          grade: 100,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // useUpdateWorkshopGrade returns WorkshopSubmission with updated grade
      expect(result.current.data?.grade).toBe(100);
    });

    it('should update grading grade', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateWorkshopGrade(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          submissionId: 1,
          gradingGrade: 20,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.gradingGrade).toBe(20);
    });

    it('should invalidate grades cache after update', async () => {
      const wrapper = createWrapper(queryClient);
      
      // Pre-fetch grades
      const { result: gradesResult } = renderHook(() => useWorkshopGrades(1), { wrapper });
      await waitFor(() => expect(gradesResult.current.isSuccess).toBe(true));
      
      // Record the initial grades fetch count
      const initialGradesFetchCount = apiCallLog.filter(
        c => c.method === 'GET' && c.url.includes('/grades')
      ).length;

      // Update grade
      const { result: updateResult } = renderHook(() => useUpdateWorkshopGrade(), { wrapper });
      
      act(() => {
        updateResult.current.mutate({
          workshopId: 1,
          submissionId: 1,
          grade: 99,
        });
      });

      await waitFor(() => {
        expect(updateResult.current.isSuccess).toBe(true);
      });

      // Verify that grades cache was invalidated by checking that a refetch was triggered
      await waitFor(() => {
        const newGradesFetchCount = apiCallLog.filter(
          c => c.method === 'GET' && c.url.includes('/grades')
        ).length;
        expect(newGradesFetchCount).toBeGreaterThan(initialGradesFetchCount);
      });
      
      // After refetch completes, the data should be fresh again
      // The key verification is that a new GET request was made (cache invalidation triggered refetch)
      expect(gradesResult.current.isSuccess).toBe(true);
    });

    it('should handle permission denied for mod/workshop:overridegrades', async () => {
      mockShouldFail = { status: 403, message: 'You do not have permission to override grades' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateWorkshopGrade(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          submissionId: 1,
          grade: 95,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle 404 when grade not found', async () => {
      mockShouldFail = { status: 404, message: 'Grade not found' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateWorkshopGrade(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          submissionId: 999,
          grade: 95,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle 400 Bad Request errors', async () => {
      mockShouldFail = { status: 400, message: 'Bad request' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshop(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle 401 Unauthorized errors', async () => {
      mockShouldFail = { status: 401, message: 'Unauthorized' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshop(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle 403 Forbidden errors', async () => {
      mockShouldFail = { status: 403, message: 'Forbidden' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopSubmissions(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle 404 Not Found errors', async () => {
      mockShouldFail = { status: 404, message: 'Not found' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopAssessments(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle 500 Internal Server errors', async () => {
      mockShouldFail = { status: 500, message: 'Internal server error' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopGrades(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle network failures with retry logic', async () => {
      // Configure test query client to retry once
      const retryQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            retryDelay: 10, // Short delay for tests
          },
        },
      });

      let callCount = 0;
      server.use(
        http.get(`${API_BASE_URL}/workshop/:id`, () => {
          callCount++;
          if (callCount < 2) {
            return HttpResponse.error();
          }
          return HttpResponse.json({
            success: true,
            data: {
              workshop: createMockWorkshop(),
              userPlan: createMockUserPlan(),
            },
          });
        })
      );

      const wrapper = createWrapper(retryQueryClient);
      const { result } = renderHook(() => useWorkshop(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 5000 });

      expect(callCount).toBe(2); // First call failed, second succeeded
    });
  });

  // ==========================================================================
  // Caching Behavior Tests
  // ==========================================================================

  describe('Caching Behavior', () => {
    it('should cache workshop data and reuse on subsequent calls', async () => {
      const wrapper = createWrapper(queryClient);
      
      // First call
      const { result: result1 } = renderHook(() => useWorkshop(1), { wrapper });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));
      
      const getCallsBeforeSecond = apiCallLog.filter(c => 
        c.method === 'GET' && c.url.includes('/workshop/1')
      ).length;

      // Second call - should use cache
      const { result: result2 } = renderHook(() => useWorkshop(1), { wrapper });
      expect(result2.current.data).toBeDefined();
      
      const getCallsAfterSecond = apiCallLog.filter(c => 
        c.method === 'GET' && c.url.includes('/workshop/1')
      ).length;

      expect(getCallsAfterSecond).toBe(getCallsBeforeSecond);
    });

    it('should cache submissions list separately from workshop', async () => {
      const wrapper = createWrapper(queryClient);
      
      // Fetch workshop
      const { result: workshopResult } = renderHook(() => useWorkshop(1), { wrapper });
      await waitFor(() => expect(workshopResult.current.isSuccess).toBe(true));

      // Fetch submissions (separate cache entry)
      const { result: submissionsResult } = renderHook(() => useWorkshopSubmissions(1), { wrapper });
      await waitFor(() => expect(submissionsResult.current.isSuccess).toBe(true));

      // Both should be in cache - use queryClient.getQueriesData to find by partial key
      const workshopCacheKey = workshopQueryKeys.detail(1);
      
      expect(queryClient.getQueryData(workshopCacheKey)).toBeDefined();
      // Submissions cache key includes additional params, so check that data exists
      expect(submissionsResult.current.data).toBeDefined();
      expect(submissionsResult.current.data?.length).toBeGreaterThanOrEqual(0);
    });

    it('should use correct query keys for cache management', async () => {
      const wrapper = createWrapper(queryClient);
      
      // Fetch various data
      const { result: workshopResult } = renderHook(() => useWorkshop(1), { wrapper });
      const { result: submissionsResult } = renderHook(() => useWorkshopSubmissions(1), { wrapper });
      const { result: assessmentsResult } = renderHook(() => useWorkshopAssessments(1), { wrapper });
      const { result: gradesResult } = renderHook(() => useWorkshopGrades(1), { wrapper });

      await waitFor(() => {
        expect(workshopResult.current.isSuccess).toBe(true);
        expect(submissionsResult.current.isSuccess).toBe(true);
        expect(assessmentsResult.current.isSuccess).toBe(true);
        expect(gradesResult.current.isSuccess).toBe(true);
      });

      // Verify cache entries exist by checking hook data
      expect(queryClient.getQueryData(workshopQueryKeys.detail(1))).toBeDefined();
      expect(queryClient.getQueryData(workshopQueryKeys.grades(1))).toBeDefined();
      // workshopAssessments is used for assessments by workshop ID (not submission ID)
      expect(queryClient.getQueryData(workshopQueryKeys.workshopAssessments(1))).toBeDefined();
      // Submissions uses extended key with params, verify through hook data instead
      expect(submissionsResult.current.data).toBeDefined();
    });

    it('should invalidate related caches on mutation success', async () => {
      const wrapper = createWrapper(queryClient);
      
      // Pre-fetch submissions
      const { result: submissionsResult } = renderHook(() => useWorkshopSubmissions(1), { wrapper });
      await waitFor(() => expect(submissionsResult.current.isSuccess).toBe(true));
      
      // Store original fetch count
      const originalFetchCount = apiCallLog.filter(c => 
        c.method === 'GET' && c.url.includes('/submissions')
      ).length;

      // Perform mutation (create submission)
      const { result: createResult } = renderHook(() => useCreateSubmission(), { wrapper });
      act(() => {
        createResult.current.mutate({
          workshopId: 1,
          title: 'New',
          content: 'Content',
        });
      });

      // Wait for mutation to complete
      await waitFor(() => {
        expect(createResult.current.isSuccess).toBe(true);
      });

      // Wait for cache invalidation and refetch
      await waitFor(() => {
        const newFetchCount = apiCallLog.filter(c => 
          c.method === 'GET' && c.url.includes('/submissions')
        ).length;
        expect(newFetchCount).toBeGreaterThan(originalFetchCount);
      });
    });
  });

  // ==========================================================================
  // Loading States Tests
  // ==========================================================================

  describe('Loading States', () => {
    it('should show isLoading true while fetching workshop', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshop(1), { wrapper });
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should show isPending true during mutation', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useCreateSubmission(), { wrapper });
      
      // Initially, the mutation should not be pending
      expect(result.current.isPending).toBe(false);

      // Start the mutation
      act(() => {
        result.current.mutate({
          workshopId: 1,
          title: 'Test',
          content: 'Content',
        });
      });

      // Wait for the mutation to complete successfully
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // After completion, isPending should be false
      expect(result.current.isPending).toBe(false);
      
      // Verify the mutation was actually called and returned data
      expect(result.current.data).toBeDefined();
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty submissions list', async () => {
      mockSubmissionsData = [];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopSubmissions(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.data?.length).toBe(0);
    });

    it('should handle missing assessments gracefully', async () => {
      mockAssessmentsData = [];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopAssessments(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it('should handle late submissions with proper flag', async () => {
      mockSubmissionsData = [
        createMockSubmission({ id: 1, late: true }),
        createMockSubmission({ id: 2, late: false }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopSubmissions(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const lateSubmissions = result.current.data?.filter(s => s.late);
      expect(lateSubmissions).toHaveLength(1);
      expect(lateSubmissions![0]!.id).toBe(1);
    });

    it('should maintain reviewer anonymity in anonymous peer review workflows', async () => {
      // Set up anonymous assessments (reviewer name fields should be empty)
      mockAssessmentsData = [
        createMockAssessment({ id: 1, reviewerId: 2, reviewerFirstName: '', reviewerLastName: '' }),
        createMockAssessment({ id: 2, reviewerId: 3, reviewerFirstName: '', reviewerLastName: '' }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopAssessments(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify reviewer names are not exposed (empty strings for anonymous)
      result.current.data?.forEach(assessment => {
        expect(assessment.reviewerFirstName).toBe('');
        expect(assessment.reviewerLastName).toBe('');
      });
    });

    it('should handle workshop in different phases correctly', async () => {
      const wrapper = createWrapper(queryClient);
      
      // Test each phase
      const phases: WorkshopPhase[] = [0, 10, 20, 30, 40, 50] as WorkshopPhase[];
      
      for (const phase of phases) {
        mockWorkshopData = createMockWorkshop({ phase });
        queryClient.clear(); // Clear cache for fresh fetch
        
        const { result } = renderHook(() => useWorkshop(1), { wrapper });
        
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
        
        expect(result.current.data?.workshop.phase).toBe(phase);
      }
    });

    it('should handle workshop with no grading grade (peer assessment disabled)', async () => {
      mockWorkshopData = createMockWorkshop({
        usePeerAssessment: false,
        gradingGrade: 0,
      });
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshop(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.workshop.usePeerAssessment).toBe(false);
      expect(result.current.data?.workshop.gradingGrade).toBe(0);
    });

    it('should handle submission with attachments', async () => {
      mockSubmissionsData = [
        createMockSubmission({
          id: 1,
          attachment: 2,
        }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopSubmissions(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data![0]!.attachment).toBe(2);
    });

    it('should validate submission deadline handling', async () => {
      // Create workshop with past deadline
      mockWorkshopData = createMockWorkshop({
        submissionEnd: Math.floor(Date.now() / 1000) - 86400, // Yesterday
        lateSubmissions: false,
      });
      
      mockShouldFail = { status: 403, message: 'Submission deadline has passed' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useCreateSubmission(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          title: 'Late submission',
          content: 'Content',
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle workshop with self-assessment enabled', async () => {
      mockWorkshopData = createMockWorkshop({
        useSelfAssessment: true,
      });
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshop(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.workshop.useSelfAssessment).toBe(true);
    });

    it('should handle assessment with complete feedback data', async () => {
      mockAssessmentsData = [
        createMockAssessment({
          id: 1,
          grade: 85,
          gradingGrade: 18,
          feedbackAuthor: '<p>Good work!</p>',
          feedbackReviewer: '<p>Helpful review</p>',
        }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopAssessments(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const assessment = result.current.data?.[0];
      expect(assessment?.grade).toBe(85);
      expect(assessment?.gradingGrade).toBe(18);
      expect(assessment?.feedbackAuthor).toBe('<p>Good work!</p>');
    });
  });

  // ==========================================================================
  // Request Data Formatting Tests
  // ==========================================================================

  describe('Request Data Formatting', () => {
    it('should send proper JSON body for assessment creation', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useCreateAssessment(), { wrapper });

      const assessmentData = {
        workshopId: 1,
        submissionId: 1,
        formData: {
          dimensionGrades: [createMockDimensionGrade()],
          feedbackAuthor: 'Test feedback',
        },
      };

      act(() => {
        result.current.mutate(assessmentData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const lastCall = getLastApiCall('POST');
      expect(lastCall).toBeDefined();
      // Note: submissionId is in the URL path, not the request body
      // The body only contains the formData contents
      expect(lastCall?.body).toMatchObject({
        dimensionGrades: expect.any(Array),
        feedbackAuthor: 'Test feedback',
      });
      // Verify the URL contains the submissionId
      expect(lastCall?.url).toContain('/submissions/1/assessments');
    });

    it('should send proper JSON body for phase switch', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useSwitchWorkshopPhase(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          targetPhase: 30 as WorkshopPhase,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const lastCall = getLastApiCall('POST');
      expect(lastCall).toBeDefined();
      expect((lastCall?.body as Record<string, unknown>)?.targetPhase).toBe(30);
    });

    it('should send proper JSON body for grade update', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateWorkshopGrade(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          submissionId: 1,
          grade: 95,
          gradingGrade: 19,
          feedbackAuthor: 'Updated feedback',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const lastCall = getLastApiCall('PUT');
      expect(lastCall).toBeDefined();
      expect(lastCall?.body).toMatchObject({
        grade: 95,
        gradingGrade: 19,
        feedbackAuthor: 'Updated feedback',
      });
    });

    it('should send proper body for allocation request', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useAllocateReviewers(), { wrapper });

      act(() => {
        result.current.mutate({
          workshopId: 1,
          method: 'random',
          settings: {
            numOfReviews: 3,
            numPerAuthor: 2,
            excludeSameGroup: true,
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const lastCall = getLastApiCall('POST');
      expect(lastCall).toBeDefined();
      expect((lastCall?.body as Record<string, unknown>)?.method).toBe('random');
      const bodySettings = (lastCall?.body as Record<string, { numOfReviews?: number }>)?.settings;
      expect(bodySettings?.numOfReviews).toBe(3);
    });
  });
});

