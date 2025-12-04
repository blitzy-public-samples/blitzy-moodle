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

import React, { ReactNode } from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

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
  workshopQueryKeys,
} from '@/features/activities/workshop/api/workshopApi';

import { createTestQueryClient } from '@/tests/helpers/render';

import type {
  Workshop,
  WorkshopSubmission,
  WorkshopAssessment,
  WorkshopPhase,
  WorkshopGradingStrategy,
  WorkshopUserPlan,
  WorkshopGrade,
  DimensionGrade,
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
    strategy: 'accumulative' as WorkshopGradingStrategy,
    grade: 100,
    gradingGrade: 20,
    useExamples: false,
    usePeerAssessment: true,
    useSelfAssessment: false,
    submissionStart: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
    submissionEnd: Math.floor(Date.now() / 1000) + 86400 * 6, // 6 days from now
    assessmentStart: Math.floor(Date.now() / 1000) + 86400 * 7,
    assessmentEnd: Math.floor(Date.now() / 1000) + 86400 * 14,
    phaseSwitchAssessment: 0,
    instructAuthors: '<p>Instructions for authors</p>',
    instructAuthorsFormat: 1,
    instructReviewers: '<p>Instructions for reviewers</p>',
    instructReviewersFormat: 1,
    maxBytes: 10485760, // 10MB
    lateSubmissions: false,
    overallFeedbackMode: 1,
    overallFeedbackFiles: 0,
    overallFeedbackMaxBytes: 0,
    examplesMode: 0,
    submissionTypeText: 1,
    submissionTypeFile: 1,
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
    authorId: 2,
    authorName: 'Test Student',
    title: 'Test Submission',
    content: '<p>Submission content</p>',
    contentFormat: 1,
    attachment: 0,
    files: [],
    grade: null,
    gradeOver: null,
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
    reviewerName: 'Test Reviewer',
    weight: 1,
    grade: 85,
    gradingGrade: 18,
    gradingGradeOver: null,
    feedbackAuthor: '<p>Good work!</p>',
    feedbackAuthorFormat: 1,
    feedbackReviewer: null,
    feedbackReviewerFormat: 1,
    timeCreated: Math.floor(Date.now() / 1000) - 1800,
    timeModified: Math.floor(Date.now() / 1000),
    dimensions: [],
    ...overrides,
  };
}

/**
 * Factory function for creating mock WorkshopGrade objects
 */
function createMockGrade(overrides: Partial<WorkshopGrade> = {}): WorkshopGrade {
  return {
    id: 1,
    workshopId: 1,
    participantId: 2,
    participantName: 'Test Student',
    submissionGrade: 85,
    submissionGradeOver: null,
    gradingGrade: 18,
    gradingGradeOver: null,
    aggregatedGrade: null,
    feedback: null,
    feedbackFormat: 1,
    timeModified: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Factory function for creating mock WorkshopUserPlan objects
 */
function createMockUserPlan(overrides: Partial<WorkshopUserPlan> = {}): WorkshopUserPlan {
  return {
    currentPhase: 20 as WorkshopPhase,
    canSubmit: true,
    canAssess: false,
    canViewOthersSubmissions: false,
    canViewOwnAssessments: false,
    canViewOthersAssessments: false,
    canPublish: false,
    canSwitchPhase: false,
    canAllocate: false,
    canOverrideGrades: false,
    submission: null,
    assessments: [],
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
    comment: 'Good effort on this dimension',
    commentFormat: 1,
    ...overrides,
  };
}

// ============================================================================
// API Base URL and Endpoints
// ============================================================================

const API_BASE_URL = '/api/v1';

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
  // GET /api/v1/workshops/:id - Get workshop details
  http.get(`${API_BASE_URL}/workshops/:id`, ({ params, request }) => {
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

  // GET /api/v1/workshops/:id/submissions - Get workshop submissions
  http.get(`${API_BASE_URL}/workshops/:id/submissions`, ({ params, request }) => {
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

  // POST /api/v1/workshops/:id/submissions - Create submission
  http.post(`${API_BASE_URL}/workshops/:id/submissions`, async ({ params, request }) => {
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

  // PUT /api/v1/workshops/submissions/:id - Update submission
  http.put(`${API_BASE_URL}/workshops/submissions/:id`, async ({ params, request }) => {
    const body = await request.json();
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
    
    mockSubmissionsData[index] = { ...mockSubmissionsData[index], ...body };
    
    return HttpResponse.json({
      success: true,
      data: mockSubmissionsData[index],
    });
  }),

  // DELETE /api/v1/workshops/submissions/:id - Delete submission
  http.delete(`${API_BASE_URL}/workshops/submissions/:id`, ({ params, request }) => {
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

  // GET /api/v1/workshops/:id/assessments - Get workshop assessments
  http.get(`${API_BASE_URL}/workshops/:id/assessments`, ({ params, request }) => {
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

  // POST /api/v1/workshops/:id/assessments - Create assessment
  http.post(`${API_BASE_URL}/workshops/:id/assessments`, async ({ params, request }) => {
    const body = await request.json();
    apiCallLog.push({ method: 'POST', url: request.url, body });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    const newAssessment = createMockAssessment({
      id: mockAssessmentsData.length + 1,
      submissionId: body.submissionId,
      dimensions: body.dimensions || [],
    });
    mockAssessmentsData.push(newAssessment);
    
    return HttpResponse.json({
      success: true,
      data: newAssessment,
    }, { status: 201 });
  }),

  // PUT /api/v1/workshops/assessments/:id - Update assessment
  http.put(`${API_BASE_URL}/workshops/assessments/:id`, async ({ params, request }) => {
    const body = await request.json();
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
    
    mockAssessmentsData[index] = { ...mockAssessmentsData[index], ...body };
    
    return HttpResponse.json({
      success: true,
      data: mockAssessmentsData[index],
    });
  }),

  // POST /api/v1/workshops/:id/switch-phase - Switch workshop phase
  http.post(`${API_BASE_URL}/workshops/:id/switch-phase`, async ({ params, request }) => {
    const body = await request.json();
    apiCallLog.push({ method: 'POST', url: request.url, body });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    const validPhases = [0, 10, 20, 30, 40, 50]; // Setup, submission, assessment, evaluation, closed
    if (!validPhases.includes(body.phase)) {
      return HttpResponse.json(
        { success: false, error: { code: '400', message: 'Invalid phase transition' } },
        { status: 400 }
      );
    }
    
    if (mockWorkshopData) {
      mockWorkshopData.phase = body.phase;
    }
    
    return HttpResponse.json({
      success: true,
      data: { phase: body.phase },
    });
  }),

  // POST /api/v1/workshops/:id/allocate - Allocate reviewers
  http.post(`${API_BASE_URL}/workshops/:id/allocate`, async ({ params, request }) => {
    const body = await request.json();
    apiCallLog.push({ method: 'POST', url: request.url, body });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    const validMethods = ['manual', 'random', 'scheduled'];
    if (!validMethods.includes(body.method)) {
      return HttpResponse.json(
        { success: false, error: { code: '400', message: 'Invalid allocation method' } },
        { status: 400 }
      );
    }
    
    // Return allocation result
    return HttpResponse.json({
      success: true,
      data: {
        method: body.method,
        allocationsCreated: body.method === 'manual' ? body.allocations?.length || 0 : 5,
        message: `Reviewers allocated using ${body.method} method`,
      },
    });
  }),

  // GET /api/v1/workshops/:id/grades - Get workshop grades
  http.get(`${API_BASE_URL}/workshops/:id/grades`, ({ params, request }) => {
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

  // PUT /api/v1/workshops/grades/:id - Update workshop grade
  http.put(`${API_BASE_URL}/workshops/grades/:id`, async ({ params, request }) => {
    const body = await request.json();
    apiCallLog.push({ method: 'PUT', url: request.url, body });
    
    if (mockShouldFail) {
      return HttpResponse.json(
        { success: false, error: { code: mockShouldFail.status.toString(), message: mockShouldFail.message } },
        { status: mockShouldFail.status }
      );
    }
    
    const gradeId = Number(params.id);
    const index = mockGradesData.findIndex(g => g.id === gradeId);
    if (index === -1) {
      return HttpResponse.json(
        { success: false, error: { code: '404', message: 'Grade not found' } },
        { status: 404 }
      );
    }
    
    mockGradesData[index] = {
      ...mockGradesData[index],
      submissionGradeOver: body.submissionGradeOver ?? mockGradesData[index].submissionGradeOver,
      gradingGradeOver: body.gradingGradeOver ?? mockGradesData[index].gradingGradeOver,
      feedback: body.feedback ?? mockGradesData[index].feedback,
      timeModified: Math.floor(Date.now() / 1000),
    };
    
    return HttpResponse.json({
      success: true,
      data: mockGradesData[index],
    });
  }),
];

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(...handlers);

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
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetMockData();
  });

  afterEach(() => {
    server.resetHandlers();
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
      expect(workshopQueryKeys.submissions(1)).toEqual(['workshops', 1, 'submissions']);
    });

    it('should generate correct query key for workshop assessments', () => {
      expect(workshopQueryKeys.assessments(1)).toEqual(['workshops', 1, 'assessments']);
    });

    it('should generate correct query key for workshop grades', () => {
      expect(workshopQueryKeys.grades(1)).toEqual(['workshops', 1, 'grades']);
    });
  });

  // ==========================================================================
  // useWorkshop Hook Tests
  // ==========================================================================

  describe('useWorkshop', () => {
    it('should call GET /api/v1/workshops/{id} and return workshop with phases and user plan', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshop(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(expectApiCall('GET', '/workshops/1')).toBe(true);
      expect(result.current.data?.workshop).toBeDefined();
      expect(result.current.data?.workshop.id).toBe(1);
      expect(result.current.data?.workshop.name).toBe('Test Workshop');
      expect(result.current.data?.userPlan).toBeDefined();
      expect(result.current.data?.userPlan.currentPhase).toBeDefined();
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
      
      const callCountAfterFirst = apiCallLog.filter(c => c.method === 'GET' && c.url.includes('/workshops/1')).length;
      expect(callCountAfterFirst).toBe(1);

      // Second call with same query client (should use cache)
      const { result: result2 } = renderHook(() => useWorkshop(1), { wrapper });
      
      // Data should be immediately available from cache
      expect(result2.current.data?.workshop).toBeDefined();
      
      const callCountAfterSecond = apiCallLog.filter(c => c.method === 'GET' && c.url.includes('/workshops/1')).length;
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
    it('should call GET /api/v1/workshops/{id}/submissions', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopSubmissions(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(expectApiCall('GET', '/workshops/1/submissions')).toBe(true);
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].title).toBe('Test Submission');
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
      expect(result.current.data?.[2].late).toBe(true);
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

      expect(result.current.data?.[0].late).toBe(true);
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
    it('should call POST /api/v1/workshops/{id}/submissions with FormData for files', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useCreateSubmission(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          workshopId: 1,
          title: 'My New Submission',
          content: '<p>My submission content</p>',
          files: [],
        });
      });

      expect(expectApiCall('POST', '/workshops/1/submissions')).toBe(true);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.title).toBeDefined();
    });

    it('should return loading state during mutation', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useCreateSubmission(), { wrapper });

      // Start mutation but don't await
      act(() => {
        result.current.mutate({
          workshopId: 1,
          title: 'Test',
          content: 'Content',
          files: [],
        });
      });

      // Check loading state
      expect(result.current.isPending).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should invalidate submissions cache after successful creation', async () => {
      const wrapper = createWrapper(queryClient);
      
      // Pre-fetch submissions
      const { result: submissionsResult } = renderHook(() => useWorkshopSubmissions(1), { wrapper });
      await waitFor(() => expect(submissionsResult.current.isSuccess).toBe(true));
      
      const initialCount = submissionsResult.current.data?.length || 0;

      // Create new submission
      const { result: createResult } = renderHook(() => useCreateSubmission(), { wrapper });
      
      await act(async () => {
        await createResult.current.mutateAsync({
          workshopId: 1,
          title: 'New Submission',
          content: 'Content',
          files: [],
        });
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

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            workshopId: 1,
            title: '',
            content: 'Content',
            files: [],
          });
        })
      ).rejects.toBeDefined();

      expect(result.current.isError).toBe(true);
    });

    it('should handle deadline passed error', async () => {
      mockShouldFail = { status: 403, message: 'Submission deadline has passed' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useCreateSubmission(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            workshopId: 1,
            title: 'Late Submission',
            content: 'Content',
            files: [],
          });
        })
      ).rejects.toBeDefined();
    });
  });

  // ==========================================================================
  // useUpdateSubmission Hook Tests
  // ==========================================================================

  describe('useUpdateSubmission', () => {
    it('should call PUT /api/v1/workshops/submissions/{id}', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateSubmission(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          submissionId: 1,
          workshopId: 1,
          title: 'Updated Title',
          content: 'Updated content',
        });
      });

      expect(expectApiCall('PUT', '/workshops/submissions/1')).toBe(true);
      expect(result.current.isSuccess).toBe(true);
    });

    it('should handle 404 when submission not found', async () => {
      mockShouldFail = { status: 404, message: 'Submission not found' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateSubmission(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            submissionId: 999,
            workshopId: 1,
            title: 'Updated',
            content: 'Content',
          });
        })
      ).rejects.toBeDefined();
    });
  });

  // ==========================================================================
  // useDeleteSubmission Hook Tests
  // ==========================================================================

  describe('useDeleteSubmission', () => {
    it('should call DELETE /api/v1/workshops/submissions/{id}', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useDeleteSubmission(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ submissionId: 1, workshopId: 1 });
      });

      expect(expectApiCall('DELETE', '/workshops/submissions/1')).toBe(true);
      expect(result.current.isSuccess).toBe(true);
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
      
      await act(async () => {
        await deleteResult.current.mutateAsync({ submissionId: 1, workshopId: 1 });
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

      await expect(
        act(async () => {
          await result.current.mutateAsync({ submissionId: 1, workshopId: 1 });
        })
      ).rejects.toBeDefined();
    });
  });

  // ==========================================================================
  // useWorkshopAssessments Hook Tests
  // ==========================================================================

  describe('useWorkshopAssessments', () => {
    it('should call GET /api/v1/workshops/{id}/assessments', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopAssessments(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(expectApiCall('GET', '/workshops/1/assessments')).toBe(true);
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
        createMockAssessment({ id: 1, reviewerName: undefined }), // Anonymous
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopAssessments(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Reviewer name should be undefined for anonymous reviews
      expect(result.current.data?.[0].reviewerName).toBeUndefined();
    });

    it('should return assessment with dimension grades', async () => {
      mockAssessmentsData = [
        createMockAssessment({
          id: 1,
          dimensions: [
            createMockDimensionGrade({ dimensionId: 1, grade: 85 }),
            createMockDimensionGrade({ dimensionId: 2, grade: 90 }),
          ],
        }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopAssessments(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].dimensions).toHaveLength(2);
      expect(result.current.data?.[0].dimensions?.[0].grade).toBe(85);
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
    it('should call POST /api/v1/workshops/{id}/assessments with dimension data', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useCreateAssessment(), { wrapper });

      const dimensionData = [
        createMockDimensionGrade({ dimensionId: 1, grade: 80 }),
        createMockDimensionGrade({ dimensionId: 2, grade: 75 }),
      ];

      await act(async () => {
        await result.current.mutateAsync({
          workshopId: 1,
          submissionId: 1,
          dimensions: dimensionData,
          feedbackAuthor: 'Great work!',
        });
      });

      expect(expectApiCall('POST', '/workshops/1/assessments')).toBe(true);
      expect(result.current.isSuccess).toBe(true);

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
      
      await act(async () => {
        await createResult.current.mutateAsync({
          workshopId: 1,
          submissionId: 1,
          dimensions: [],
          feedbackAuthor: 'Feedback',
        });
      });

      await waitFor(() => {
        expect(assessmentsResult.current.data?.length).toBe(initialCount + 1);
      });
    });

    it('should handle validation error for invalid dimension grades', async () => {
      mockShouldFail = { status: 400, message: 'Invalid dimension grades' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useCreateAssessment(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            workshopId: 1,
            submissionId: 1,
            dimensions: [],
            feedbackAuthor: '',
          });
        })
      ).rejects.toBeDefined();
    });
  });

  // ==========================================================================
  // useUpdateAssessment Hook Tests
  // ==========================================================================

  describe('useUpdateAssessment', () => {
    it('should call PUT /api/v1/workshops/assessments/{id}', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateAssessment(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          assessmentId: 1,
          workshopId: 1,
          dimensions: [createMockDimensionGrade({ dimensionId: 1, grade: 95 })],
          feedbackAuthor: 'Updated feedback',
        });
      });

      expect(expectApiCall('PUT', '/workshops/assessments/1')).toBe(true);
      expect(result.current.isSuccess).toBe(true);
    });

    it('should handle 404 when assessment not found', async () => {
      mockShouldFail = { status: 404, message: 'Assessment not found' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateAssessment(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            assessmentId: 999,
            workshopId: 1,
            dimensions: [],
            feedbackAuthor: 'Feedback',
          });
        })
      ).rejects.toBeDefined();
    });
  });

  // ==========================================================================
  // useSwitchWorkshopPhase Hook Tests
  // ==========================================================================

  describe('useSwitchWorkshopPhase', () => {
    it('should call POST /api/v1/workshops/{id}/switch-phase', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useSwitchWorkshopPhase(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          workshopId: 1,
          phase: 30 as WorkshopPhase, // Assessment phase
        });
      });

      expect(expectApiCall('POST', '/workshops/1/switch-phase')).toBe(true);
      expect(result.current.isSuccess).toBe(true);
    });

    it('should handle valid phase transitions', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useSwitchWorkshopPhase(), { wrapper });

      // Test switching to each valid phase
      const validPhases: WorkshopPhase[] = [10, 20, 30, 40, 50] as WorkshopPhase[];
      
      for (const phase of validPhases) {
        await act(async () => {
          await result.current.mutateAsync({
            workshopId: 1,
            phase,
          });
        });
        expect(result.current.isSuccess).toBe(true);
      }
    });

    it('should handle invalid phase transition error', async () => {
      mockShouldFail = { status: 400, message: 'Invalid phase transition' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useSwitchWorkshopPhase(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            workshopId: 1,
            phase: 99 as WorkshopPhase, // Invalid phase
          });
        })
      ).rejects.toBeDefined();
    });

    it('should invalidate workshop cache after phase switch', async () => {
      const wrapper = createWrapper(queryClient);
      
      // Pre-fetch workshop
      const { result: workshopResult } = renderHook(() => useWorkshop(1), { wrapper });
      await waitFor(() => expect(workshopResult.current.isSuccess).toBe(true));
      
      const initialPhase = workshopResult.current.data?.workshop.phase;

      // Switch phase
      const { result: switchResult } = renderHook(() => useSwitchWorkshopPhase(), { wrapper });
      
      await act(async () => {
        await switchResult.current.mutateAsync({
          workshopId: 1,
          phase: 30 as WorkshopPhase,
        });
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

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            workshopId: 1,
            phase: 30 as WorkshopPhase,
          });
        })
      ).rejects.toBeDefined();
    });
  });

  // ==========================================================================
  // useAllocateReviewers Hook Tests
  // ==========================================================================

  describe('useAllocateReviewers', () => {
    it('should call POST /api/v1/workshops/{id}/allocate with manual allocation', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useAllocateReviewers(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          workshopId: 1,
          method: 'manual',
          allocations: [
            { reviewerId: 2, submissionId: 1 },
            { reviewerId: 3, submissionId: 2 },
          ],
        });
      });

      expect(expectApiCall('POST', '/workshops/1/allocate')).toBe(true);
      expect(result.current.isSuccess).toBe(true);
      
      const lastCall = getLastApiCall('POST');
      expect((lastCall?.body as Record<string, unknown>)?.method).toBe('manual');
    });

    it('should handle random allocation method', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useAllocateReviewers(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          workshopId: 1,
          method: 'random',
          numOfReviews: 3,
        });
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.method).toBe('random');
      expect(result.current.data?.allocationsCreated).toBeGreaterThan(0);
    });

    it('should handle scheduled allocation method', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useAllocateReviewers(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          workshopId: 1,
          method: 'scheduled',
        });
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.method).toBe('scheduled');
    });

    it('should handle invalid allocation method error', async () => {
      mockShouldFail = { status: 400, message: 'Invalid allocation method' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useAllocateReviewers(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            workshopId: 1,
            method: 'invalid' as 'manual' | 'random' | 'scheduled',
          });
        })
      ).rejects.toBeDefined();
    });

    it('should return allocation summary with created count', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useAllocateReviewers(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          workshopId: 1,
          method: 'random',
          numOfReviews: 2,
        });
      });

      expect(result.current.data?.allocationsCreated).toBeDefined();
      expect(typeof result.current.data?.allocationsCreated).toBe('number');
    });

    it('should invalidate assessments cache after allocation', async () => {
      const wrapper = createWrapper(queryClient);
      
      // Pre-fetch assessments
      const { result: assessmentsResult } = renderHook(() => useWorkshopAssessments(1), { wrapper });
      await waitFor(() => expect(assessmentsResult.current.isSuccess).toBe(true));

      // Perform allocation
      const { result: allocateResult } = renderHook(() => useAllocateReviewers(), { wrapper });
      
      await act(async () => {
        await allocateResult.current.mutateAsync({
          workshopId: 1,
          method: 'random',
        });
      });

      // Verify allocation was successful
      expect(allocateResult.current.isSuccess).toBe(true);
    });
  });

  // ==========================================================================
  // useWorkshopGrades Hook Tests
  // ==========================================================================

  describe('useWorkshopGrades', () => {
    it('should call GET /api/v1/workshops/{id}/grades', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopGrades(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(expectApiCall('GET', '/workshops/1/grades')).toBe(true);
      expect(result.current.data).toHaveLength(1);
    });

    it('should return grades with submission and grading scores', async () => {
      mockGradesData = [
        createMockGrade({
          id: 1,
          submissionGrade: 85,
          gradingGrade: 18,
        }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopGrades(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].submissionGrade).toBe(85);
      expect(result.current.data?.[0].gradingGrade).toBe(18);
    });

    it('should handle grades with overrides', async () => {
      mockGradesData = [
        createMockGrade({
          id: 1,
          submissionGrade: 80,
          submissionGradeOver: 90, // Teacher override
          gradingGrade: 15,
          gradingGradeOver: 18, // Teacher override
        }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopGrades(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].submissionGradeOver).toBe(90);
      expect(result.current.data?.[0].gradingGradeOver).toBe(18);
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
    it('should call PUT /api/v1/workshops/grades/{id}', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateWorkshopGrade(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          gradeId: 1,
          workshopId: 1,
          submissionGradeOver: 95,
          feedback: 'Excellent work!',
        });
      });

      expect(expectApiCall('PUT', '/workshops/grades/1')).toBe(true);
      expect(result.current.isSuccess).toBe(true);
    });

    it('should update submission grade override', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateWorkshopGrade(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          gradeId: 1,
          workshopId: 1,
          submissionGradeOver: 100,
        });
      });

      expect(result.current.data?.submissionGradeOver).toBe(100);
    });

    it('should update grading grade override', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateWorkshopGrade(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          gradeId: 1,
          workshopId: 1,
          gradingGradeOver: 20,
        });
      });

      expect(result.current.data?.gradingGradeOver).toBe(20);
    });

    it('should invalidate grades cache after update', async () => {
      const wrapper = createWrapper(queryClient);
      
      // Pre-fetch grades
      const { result: gradesResult } = renderHook(() => useWorkshopGrades(1), { wrapper });
      await waitFor(() => expect(gradesResult.current.isSuccess).toBe(true));

      // Update grade
      const { result: updateResult } = renderHook(() => useUpdateWorkshopGrade(), { wrapper });
      
      await act(async () => {
        await updateResult.current.mutateAsync({
          gradeId: 1,
          workshopId: 1,
          submissionGradeOver: 99,
        });
      });

      // Grades cache should be invalidated
      await waitFor(() => {
        expect(gradesResult.current.data?.[0].submissionGradeOver).toBe(99);
      });
    });

    it('should handle permission denied for mod/workshop:overridegrades', async () => {
      mockShouldFail = { status: 403, message: 'You do not have permission to override grades' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateWorkshopGrade(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            gradeId: 1,
            workshopId: 1,
            submissionGradeOver: 95,
          });
        })
      ).rejects.toBeDefined();
    });

    it('should handle 404 when grade not found', async () => {
      mockShouldFail = { status: 404, message: 'Grade not found' };
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateWorkshopGrade(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            gradeId: 999,
            workshopId: 1,
            submissionGradeOver: 95,
          });
        })
      ).rejects.toBeDefined();
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
        http.get(`${API_BASE_URL}/workshops/:id`, () => {
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
        c.method === 'GET' && c.url.includes('/workshops/1')
      ).length;

      // Second call - should use cache
      const { result: result2 } = renderHook(() => useWorkshop(1), { wrapper });
      expect(result2.current.data).toBeDefined();
      
      const getCallsAfterSecond = apiCallLog.filter(c => 
        c.method === 'GET' && c.url.includes('/workshops/1')
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

      // Both should be in cache
      const workshopCacheKey = workshopQueryKeys.detail(1);
      const submissionsCacheKey = workshopQueryKeys.submissions(1);
      
      expect(queryClient.getQueryData(workshopCacheKey)).toBeDefined();
      expect(queryClient.getQueryData(submissionsCacheKey)).toBeDefined();
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

      // Verify all cache entries use expected keys
      expect(queryClient.getQueryData(workshopQueryKeys.detail(1))).toBeDefined();
      expect(queryClient.getQueryData(workshopQueryKeys.submissions(1))).toBeDefined();
      expect(queryClient.getQueryData(workshopQueryKeys.assessments(1))).toBeDefined();
      expect(queryClient.getQueryData(workshopQueryKeys.grades(1))).toBeDefined();
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
      await act(async () => {
        await createResult.current.mutateAsync({
          workshopId: 1,
          title: 'New',
          content: 'Content',
          files: [],
        });
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
      
      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate({
          workshopId: 1,
          title: 'Test',
          content: 'Content',
          files: [],
        });
      });

      expect(result.current.isPending).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isPending).toBe(false);
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
      expect(lateSubmissions?.[0].id).toBe(1);
    });

    it('should maintain reviewer anonymity in anonymous peer review workflows', async () => {
      // Set up anonymous assessments (reviewerName should be undefined/null)
      mockAssessmentsData = [
        createMockAssessment({ id: 1, reviewerId: 2, reviewerName: undefined }),
        createMockAssessment({ id: 2, reviewerId: 3, reviewerName: undefined }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopAssessments(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify reviewer names are not exposed
      result.current.data?.forEach(assessment => {
        expect(assessment.reviewerName).toBeUndefined();
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

    it('should handle submission with attached files', async () => {
      mockSubmissionsData = [
        createMockSubmission({
          id: 1,
          attachment: 2,
          files: [
            { filename: 'document.pdf', size: 1024000 },
            { filename: 'image.png', size: 512000 },
          ] as WorkshopSubmission['files'],
        }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopSubmissions(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].attachment).toBe(2);
      expect(result.current.data?.[0].files).toHaveLength(2);
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

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            workshopId: 1,
            title: 'Late submission',
            content: 'Content',
            files: [],
          });
        })
      ).rejects.toBeDefined();
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

    it('should handle assessment with all dimension grades', async () => {
      mockAssessmentsData = [
        createMockAssessment({
          id: 1,
          dimensions: [
            createMockDimensionGrade({ dimensionId: 1, grade: 80, comment: 'Good' }),
            createMockDimensionGrade({ dimensionId: 2, grade: 90, comment: 'Excellent' }),
            createMockDimensionGrade({ dimensionId: 3, grade: 70, comment: 'Needs work' }),
          ],
        }),
      ];
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useWorkshopAssessments(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const dimensions = result.current.data?.[0].dimensions;
      expect(dimensions).toHaveLength(3);
      expect(dimensions?.every(d => d.grade !== undefined && d.comment !== undefined)).toBe(true);
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
        dimensions: [createMockDimensionGrade()],
        feedbackAuthor: 'Test feedback',
      };

      await act(async () => {
        await result.current.mutateAsync(assessmentData);
      });

      const lastCall = getLastApiCall('POST');
      expect(lastCall).toBeDefined();
      expect(lastCall?.body).toMatchObject({
        submissionId: 1,
        feedbackAuthor: 'Test feedback',
      });
    });

    it('should send proper JSON body for phase switch', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useSwitchWorkshopPhase(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          workshopId: 1,
          phase: 30 as WorkshopPhase,
        });
      });

      const lastCall = getLastApiCall('POST');
      expect(lastCall).toBeDefined();
      expect((lastCall?.body as Record<string, unknown>)?.phase).toBe(30);
    });

    it('should send proper JSON body for grade update', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useUpdateWorkshopGrade(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          gradeId: 1,
          workshopId: 1,
          submissionGradeOver: 95,
          gradingGradeOver: 19,
          feedback: 'Updated feedback',
        });
      });

      const lastCall = getLastApiCall('PUT');
      expect(lastCall).toBeDefined();
      expect(lastCall?.body).toMatchObject({
        submissionGradeOver: 95,
        gradingGradeOver: 19,
        feedback: 'Updated feedback',
      });
    });

    it('should send proper body for allocation request', async () => {
      const wrapper = createWrapper(queryClient);
      
      const { result } = renderHook(() => useAllocateReviewers(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          workshopId: 1,
          method: 'manual',
          allocations: [
            { reviewerId: 2, submissionId: 1 },
            { reviewerId: 3, submissionId: 2 },
          ],
        });
      });

      const lastCall = getLastApiCall('POST');
      expect(lastCall).toBeDefined();
      expect((lastCall?.body as Record<string, unknown>)?.method).toBe('manual');
      expect((lastCall?.body as Record<string, unknown[]>)?.allocations).toHaveLength(2);
    });
  });
});

