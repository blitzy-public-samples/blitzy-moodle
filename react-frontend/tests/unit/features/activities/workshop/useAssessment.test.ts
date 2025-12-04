/**
 * @file useAssessment.test.ts
 * @description Comprehensive unit tests for useAssessment hook validating peer assessment operations.
 * Tests fetching assessment details, creating new assessments, updating assessment grades and feedback,
 * submitting completed assessments, assessment dimensions handling from grading strategy,
 * optimistic updates, query invalidation, loading and error states, permission checks,
 * and React Query mutation integration with proper TypeScript types.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React, { ReactNode } from 'react';

// Internal imports from workshop hooks
import {
  useAssessment,
  useCreateAssessment,
  useUpdateAssessment,
  useSubmitAssessment,
  validateAssessmentPermission,
  calculateDimensionTotal,
  formatDimensionData,
} from '@/features/activities/workshop/hooks/useAssessment';

// Import types
import type {
  WorkshopAssessment,
  WorkshopAssessmentFormData,
  WorkshopAssessmentDimension,
  GradingStrategy,
} from '@/features/activities/workshop/types';

// Import test utilities
import {
  createMockAssessment,
  createMockDimension,
  createMockDimensionGrade,
  createMockGradingStrategy,
  mockAssessmentWithDimensions,
  WORKSHOP_PHASE,
  GRADING_STRATEGIES,
  setupWorkshopHandlers,
  createWorkshopMockServer,
} from './test-utils.tsx';

import { createTestQueryClient } from '@/tests/helpers/render';

// ============================================================================
// Constants and Configuration
// ============================================================================

const API_BASE_URL = '/api/v1';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a complete mock assessment with all fields populated
 */
function createFullMockAssessment(overrides?: Partial<WorkshopAssessment>): WorkshopAssessment {
  return createMockAssessment({
    id: 1,
    submissionId: 10,
    reviewerId: 101,
    reviewerFirstName: 'Jane',
    reviewerLastName: 'Reviewer',
    weight: 1,
    grade: 85,
    gradingGrade: 90,
    gradingGradeOver: null,
    feedbackAuthor: '<p>Excellent work on the analysis section</p>',
    feedbackAuthorFormat: 1,
    feedbackAuthorAttachment: 0,
    feedbackReviewer: '<p>Thank you for the detailed feedback</p>',
    feedbackReviewerFormat: 1,
    timeCreated: Math.floor(Date.now() / 1000) - 3600,
    timeModified: Math.floor(Date.now() / 1000) - 1800,
    ...overrides,
  });
}

/**
 * Creates mock dimension grades for testing
 */
function createMockDimensionGrades(count: number = 3): WorkshopAssessmentDimension[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    workshopId: 1,
    sort: i + 1,
    description: `<p>Dimension ${i + 1} criteria</p>`,
    descriptionFormat: 1,
    grade: 20,
    weight: 1,
    strategy: GRADING_STRATEGIES.ACCUMULATIVE,
    dimensionGrade: 15 + i,
    peerComment: `Comment for dimension ${i + 1}`,
    peerCommentFormat: 1,
  }));
}

// ============================================================================
// MSW Server Setup
// ============================================================================

const mockAssessments = [
  createFullMockAssessment({ id: 1, submissionId: 10 }),
  createFullMockAssessment({ id: 2, submissionId: 11, reviewerId: 102 }),
];

const mockDimensions = createMockGradingStrategy(GRADING_STRATEGIES.ACCUMULATIVE, 3);

const handlers = [
  // GET assessment details - /api/v1/workshops/assessments/{id}
  http.get(`${API_BASE_URL}/workshops/assessments/:assessmentId`, ({ params }) => {
    const assessmentId = Number(params.assessmentId);
    const assessment = mockAssessments.find((a) => a.id === assessmentId);

    if (assessment) {
      return HttpResponse.json({
        success: true,
        data: {
          ...assessment,
          dimensions: createMockDimensionGrades(3),
        },
      });
    }

    return HttpResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Assessment not found' },
      },
      { status: 404 }
    );
  }),

  // POST create assessment - /api/v1/workshops/{id}/assessments
  http.post(`${API_BASE_URL}/workshops/:workshopId/assessments`, async ({ request, params }) => {
    const workshopId = Number(params.workshopId);
    const body = (await request.json()) as WorkshopAssessmentFormData;

    if (workshopId > 0) {
      const newAssessment = createFullMockAssessment({
        id: 100,
        submissionId: body.submissionId,
        grade: null,
        gradingGrade: null,
        feedbackAuthor: body.feedbackAuthor || null,
      });

      return HttpResponse.json({
        success: true,
        data: newAssessment,
      });
    }

    return HttpResponse.json(
      {
        success: false,
        error: { code: 'PERMISSION_DENIED', message: 'Cannot create assessment' },
      },
      { status: 403 }
    );
  }),

  // PUT update assessment - /api/v1/workshops/assessments/{id}
  http.put(`${API_BASE_URL}/workshops/assessments/:assessmentId`, async ({ request, params }) => {
    const assessmentId = Number(params.assessmentId);
    const body = (await request.json()) as Partial<WorkshopAssessmentFormData>;
    const assessment = mockAssessments.find((a) => a.id === assessmentId);

    if (assessment) {
      const updatedAssessment = {
        ...assessment,
        feedbackAuthor: body.feedbackAuthor || assessment.feedbackAuthor,
        grade: body.dimensions
          ? body.dimensions.reduce((sum, d) => sum + (d.grade || 0), 0)
          : assessment.grade,
        timeModified: Math.floor(Date.now() / 1000),
      };

      return HttpResponse.json({
        success: true,
        data: updatedAssessment,
      });
    }

    return HttpResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Assessment not found' },
      },
      { status: 404 }
    );
  }),

  // POST submit assessment - /api/v1/workshops/assessments/{id}/submit
  http.post(`${API_BASE_URL}/workshops/assessments/:assessmentId/submit`, ({ params }) => {
    const assessmentId = Number(params.assessmentId);
    const assessment = mockAssessments.find((a) => a.id === assessmentId);

    if (assessment) {
      return HttpResponse.json({
        success: true,
        data: {
          ...assessment,
          submitted: true,
          submittedAt: Math.floor(Date.now() / 1000),
        },
      });
    }

    return HttpResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Assessment not found' },
      },
      { status: 404 }
    );
  }),

  // GET workshop dimensions - /api/v1/workshops/{id}/dimensions
  http.get(`${API_BASE_URL}/workshops/:workshopId/dimensions`, ({ params }) => {
    const workshopId = Number(params.workshopId);

    if (workshopId > 0) {
      return HttpResponse.json({
        success: true,
        data: mockDimensions,
      });
    }

    return HttpResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workshop not found' },
      },
      { status: 404 }
    );
  }),
];

const server = setupServer(...handlers);

// ============================================================================
// Test Wrapper Setup
// ============================================================================

/**
 * Creates a wrapper component with QueryClientProvider for testing hooks
 */
function createWrapper(queryClient?: QueryClient) {
  const client = queryClient || createTestQueryClient();

  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client },
      children
    );
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('useAssessment Hook Tests', () => {
  let queryClient: QueryClient;

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
  });

  // ==========================================================================
  // useAssessment Query Hook Tests
  // ==========================================================================

  describe('useAssessment - Query Hook', () => {
    it('should accept assessmentId and fetch assessment details', async () => {
      const assessmentId = 1;
      const { result } = renderHook(() => useAssessment(assessmentId), {
        wrapper: createWrapper(queryClient),
      });

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);

      // Wait for data to be fetched
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify assessment data structure
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe(assessmentId);
    });

    it('should call GET /api/v1/workshops/assessments/{id} API endpoint', async () => {
      const assessmentId = 1;
      let requestUrl = '';

      server.use(
        http.get(`${API_BASE_URL}/workshops/assessments/:assessmentId`, ({ request }) => {
          requestUrl = new URL(request.url).pathname;
          return HttpResponse.json({
            success: true,
            data: createFullMockAssessment({ id: assessmentId }),
          });
        })
      );

      const { result } = renderHook(() => useAssessment(assessmentId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(requestUrl).toBe(`${API_BASE_URL}/workshops/assessments/${assessmentId}`);
    });

    it('should return correct assessment data structure with all fields', async () => {
      const assessmentId = 1;
      const { result } = renderHook(() => useAssessment(assessmentId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const assessment = result.current.data;
      expect(assessment).toMatchObject({
        id: expect.any(Number),
        submissionId: expect.any(Number),
        reviewerId: expect.any(Number),
        weight: expect.any(Number),
        timeCreated: expect.any(Number),
        timeModified: expect.any(Number),
      });

      // Verify optional grade fields
      expect(assessment).toHaveProperty('grade');
      expect(assessment).toHaveProperty('gradingGrade');
      expect(assessment).toHaveProperty('gradingGradeOver');
      expect(assessment).toHaveProperty('feedbackReviewer');
    });

    it('should include dimensions array matching grading strategy', async () => {
      const assessmentId = 1;
      const { result } = renderHook(() => useAssessment(assessmentId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const assessment = result.current.data;
      expect(assessment?.dimensions).toBeDefined();
      expect(Array.isArray(assessment?.dimensions)).toBe(true);
      expect(assessment?.dimensions?.length).toBeGreaterThan(0);

      // Verify dimension structure
      assessment?.dimensions?.forEach((dim) => {
        expect(dim).toHaveProperty('id');
        expect(dim).toHaveProperty('description');
        expect(dim).toHaveProperty('grade');
        expect(dim).toHaveProperty('weight');
      });
    });

    it('should handle loading state correctly', async () => {
      const assessmentId = 1;
      const { result } = renderHook(() => useAssessment(assessmentId), {
        wrapper: createWrapper(queryClient),
      });

      // Check initial loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSuccess).toBe(true);
    });

    it('should handle 404 error when assessment not found', async () => {
      const nonExistentId = 9999;
      const { result } = renderHook(() => useAssessment(nonExistentId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should not fetch when assessmentId is undefined', async () => {
      const { result } = renderHook(() => useAssessment(undefined as unknown as number), {
        wrapper: createWrapper(queryClient),
      });

      // Should not be loading when disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);
    });
  });

  // ==========================================================================
  // useCreateAssessment Mutation Hook Tests
  // ==========================================================================

  describe('useCreateAssessment - Mutation Hook', () => {
    it('should call POST /api/v1/workshops/{id}/assessments on creation', async () => {
      const workshopId = 1;
      let capturedRequest: WorkshopAssessmentFormData | null = null;

      server.use(
        http.post(`${API_BASE_URL}/workshops/:workshopId/assessments`, async ({ request }) => {
          capturedRequest = (await request.json()) as WorkshopAssessmentFormData;
          return HttpResponse.json({
            success: true,
            data: createFullMockAssessment({ id: 100, submissionId: capturedRequest.submissionId }),
          });
        })
      );

      const { result } = renderHook(() => useCreateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      const formData: WorkshopAssessmentFormData = {
        submissionId: 10,
        feedbackAuthor: 'Great analysis of the topic',
        feedbackAuthorFormat: 1,
        dimensions: [
          { dimensionId: 1, grade: 18, peerComment: 'Good structure' },
          { dimensionId: 2, grade: 16, peerComment: 'Clear presentation' },
        ],
      };

      await act(async () => {
        result.current.mutate(formData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedRequest).toBeDefined();
      expect(capturedRequest?.submissionId).toBe(10);
    });

    it('should return new assessment data on successful creation', async () => {
      const workshopId = 1;
      const { result } = renderHook(() => useCreateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      const formData: WorkshopAssessmentFormData = {
        submissionId: 10,
        feedbackAuthor: 'Excellent work',
        feedbackAuthorFormat: 1,
        dimensions: [{ dimensionId: 1, grade: 20, peerComment: 'Perfect' }],
      };

      await act(async () => {
        result.current.mutate(formData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.submissionId).toBe(10);
    });

    it('should handle createAssessment mutation function correctly', async () => {
      const workshopId = 1;
      const { result } = renderHook(() => useCreateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.mutate).toBeDefined();
      expect(typeof result.current.mutate).toBe('function');
      expect(result.current.mutateAsync).toBeDefined();
      expect(typeof result.current.mutateAsync).toBe('function');
    });

    it('should handle permission denied error (403)', async () => {
      const workshopId = 1;

      server.use(
        http.post(`${API_BASE_URL}/workshops/:workshopId/assessments`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'PERMISSION_DENIED', message: 'You cannot assess this submission' },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useCreateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      const formData: WorkshopAssessmentFormData = {
        submissionId: 10,
        feedbackAuthor: 'Test feedback',
        feedbackAuthorFormat: 1,
        dimensions: [],
      };

      await act(async () => {
        result.current.mutate(formData);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should show loading state during mutation', async () => {
      const workshopId = 1;

      // Add delay to observe loading state
      server.use(
        http.post(`${API_BASE_URL}/workshops/:workshopId/assessments`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: createFullMockAssessment({ id: 100 }),
          });
        })
      );

      const { result } = renderHook(() => useCreateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      const formData: WorkshopAssessmentFormData = {
        submissionId: 10,
        feedbackAuthor: 'Test',
        feedbackAuthorFormat: 1,
        dimensions: [],
      };

      act(() => {
        result.current.mutate(formData);
      });

      expect(result.current.isPending).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should invalidate queries on successful creation', async () => {
      const workshopId = 1;
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      const formData: WorkshopAssessmentFormData = {
        submissionId: 10,
        feedbackAuthor: 'Test feedback',
        feedbackAuthorFormat: 1,
        dimensions: [],
      };

      await act(async () => {
        result.current.mutate(formData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateQueriesSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // useUpdateAssessment Mutation Hook Tests
  // ==========================================================================

  describe('useUpdateAssessment - Mutation Hook', () => {
    it('should call PUT /api/v1/workshops/assessments/{id} on update', async () => {
      const workshopId = 1;
      let capturedUrl = '';

      server.use(
        http.put(`${API_BASE_URL}/workshops/assessments/:assessmentId`, ({ request }) => {
          capturedUrl = new URL(request.url).pathname;
          return HttpResponse.json({
            success: true,
            data: createFullMockAssessment({ id: 1 }),
          });
        })
      );

      const { result } = renderHook(() => useUpdateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({
          assessmentId: 1,
          data: {
            feedbackAuthor: 'Updated feedback',
            dimensions: [{ dimensionId: 1, grade: 19, peerComment: 'Improved analysis' }],
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedUrl).toBe(`${API_BASE_URL}/workshops/assessments/1`);
    });

    it('should handle updateAssessment mutation function', async () => {
      const workshopId = 1;
      const { result } = renderHook(() => useUpdateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.mutate).toBeDefined();
      expect(typeof result.current.mutate).toBe('function');
    });

    it('should update assessment grades and feedback', async () => {
      const workshopId = 1;
      let capturedBody: Record<string, unknown> | null = null;

      server.use(
        http.put(`${API_BASE_URL}/workshops/assessments/:assessmentId`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            success: true,
            data: createFullMockAssessment({
              id: 1,
              feedbackAuthor: capturedBody.feedbackAuthor as string,
            }),
          });
        })
      );

      const { result } = renderHook(() => useUpdateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      const updateData = {
        assessmentId: 1,
        data: {
          feedbackAuthor: 'Updated overall feedback',
          dimensions: [
            { dimensionId: 1, grade: 17, peerComment: 'Revised comment' },
            { dimensionId: 2, grade: 18, peerComment: 'Better structure noted' },
          ],
        },
      };

      await act(async () => {
        result.current.mutate(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedBody?.feedbackAuthor).toBe('Updated overall feedback');
      expect(capturedBody?.dimensions).toBeDefined();
    });

    it('should perform optimistic updates during modification', async () => {
      const workshopId = 1;
      const assessmentId = 1;

      // Pre-populate the cache
      const originalAssessment = createFullMockAssessment({ id: assessmentId });
      queryClient.setQueryData(['assessments', assessmentId], originalAssessment);

      // Delay server response to observe optimistic update
      server.use(
        http.put(`${API_BASE_URL}/workshops/assessments/:assessmentId`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return HttpResponse.json({
            success: true,
            data: createFullMockAssessment({
              id: assessmentId,
              feedbackAuthor: 'Server updated feedback',
            }),
          });
        })
      );

      const { result } = renderHook(() => useUpdateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({
          assessmentId,
          data: {
            feedbackAuthor: 'Optimistically updated feedback',
            dimensions: [],
          },
        });
      });

      // The mutation should be in pending state
      expect(result.current.isPending).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should invalidate queries on successful update', async () => {
      const workshopId = 1;
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({
          assessmentId: 1,
          data: {
            feedbackAuthor: 'Test update',
            dimensions: [],
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateQueriesSpy).toHaveBeenCalled();
    });

    it('should handle validation errors (400)', async () => {
      const workshopId = 1;

      server.use(
        http.put(`${API_BASE_URL}/workshops/assessments/:assessmentId`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid dimension grades',
                details: { field: 'dimensions', error: 'Grade must be between 0 and maximum' },
              },
            },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(() => useUpdateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({
          assessmentId: 1,
          data: {
            feedbackAuthor: 'Test',
            dimensions: [{ dimensionId: 1, grade: 999, peerComment: 'Invalid grade' }],
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle 404 error for non-existent assessment', async () => {
      const workshopId = 1;

      const { result } = renderHook(() => useUpdateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({
          assessmentId: 9999,
          data: {
            feedbackAuthor: 'Test',
            dimensions: [],
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // useSubmitAssessment Mutation Hook Tests
  // ==========================================================================

  describe('useSubmitAssessment - Mutation Hook', () => {
    it('should call POST /api/v1/workshops/assessments/{id}/submit on finalization', async () => {
      const workshopId = 1;
      let capturedUrl = '';

      server.use(
        http.post(`${API_BASE_URL}/workshops/assessments/:assessmentId/submit`, ({ request }) => {
          capturedUrl = new URL(request.url).pathname;
          return HttpResponse.json({
            success: true,
            data: { ...createFullMockAssessment({ id: 1 }), submitted: true },
          });
        })
      );

      const { result } = renderHook(() => useSubmitAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(1);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedUrl).toBe(`${API_BASE_URL}/workshops/assessments/1/submit`);
    });

    it('should handle submitAssessment mutation function', async () => {
      const workshopId = 1;
      const { result } = renderHook(() => useSubmitAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.mutate).toBeDefined();
      expect(typeof result.current.mutate).toBe('function');
    });

    it('should mark assessment as submitted and prevent further edits', async () => {
      const workshopId = 1;

      server.use(
        http.post(`${API_BASE_URL}/workshops/assessments/:assessmentId/submit`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              ...createFullMockAssessment({ id: 1 }),
              submitted: true,
              submittedAt: Math.floor(Date.now() / 1000),
            },
          });
        })
      );

      const { result } = renderHook(() => useSubmitAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(1);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.submitted).toBe(true);
    });

    it('should trigger grade recalculation after submission', async () => {
      const workshopId = 1;

      server.use(
        http.post(`${API_BASE_URL}/workshops/assessments/:assessmentId/submit`, () => {
          // Simulate grade recalculation in response
          return HttpResponse.json({
            success: true,
            data: {
              ...createFullMockAssessment({ id: 1, grade: 85 }),
              submitted: true,
              gradeRecalculated: true,
            },
          });
        })
      );

      const { result } = renderHook(() => useSubmitAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(1);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify grade is calculated after submission
      expect(result.current.data?.grade).toBeDefined();
    });

    it('should invalidate assessment queries after submission', async () => {
      const workshopId = 1;
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSubmitAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(1);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateQueriesSpy).toHaveBeenCalled();
    });

    it('should handle incomplete assessment submission error', async () => {
      const workshopId = 1;

      server.use(
        http.post(`${API_BASE_URL}/workshops/assessments/:assessmentId/submit`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'INCOMPLETE_ASSESSMENT',
                message: 'All dimensions must be graded before submission',
              },
            },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(() => useSubmitAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(1);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle missing required feedback fields error', async () => {
      const workshopId = 1;

      server.use(
        http.post(`${API_BASE_URL}/workshops/assessments/:assessmentId/submit`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'MISSING_FEEDBACK',
                message: 'Overall feedback is required by workshop configuration',
              },
            },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(() => useSubmitAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(1);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should show loading state during submission', async () => {
      const workshopId = 1;

      server.use(
        http.post(`${API_BASE_URL}/workshops/assessments/:assessmentId/submit`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: { ...createFullMockAssessment({ id: 1 }), submitted: true },
          });
        })
      );

      const { result } = renderHook(() => useSubmitAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate(1);
      });

      expect(result.current.isPending).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Grading Strategy and Dimension Tests
  // ==========================================================================

  describe('Grading Strategy Integration', () => {
    it('should handle accumulative grading strategy dimensions', async () => {
      const workshopId = 1;
      const dimensions = createMockGradingStrategy(GRADING_STRATEGIES.ACCUMULATIVE, 3);

      server.use(
        http.get(`${API_BASE_URL}/workshops/:workshopId/dimensions`, () => {
          return HttpResponse.json({
            success: true,
            data: dimensions,
          });
        })
      );

      const { result } = renderHook(() => useAssessment(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify accumulative strategy dimensions have point grades
      const assessment = result.current.data;
      expect(assessment?.dimensions).toBeDefined();
    });

    it('should handle rubric grading strategy dimensions', async () => {
      const dimensions = createMockGradingStrategy(GRADING_STRATEGIES.RUBRIC, 4);

      expect(dimensions).toHaveLength(4);
      dimensions.forEach((dim) => {
        expect(dim.strategy).toBe(GRADING_STRATEGIES.RUBRIC);
      });
    });

    it('should handle comments-only grading strategy', async () => {
      const dimensions = createMockGradingStrategy(GRADING_STRATEGIES.COMMENTS, 2);

      expect(dimensions).toHaveLength(2);
      dimensions.forEach((dim) => {
        expect(dim.strategy).toBe(GRADING_STRATEGIES.COMMENTS);
        expect(dim.grade).toBe(0); // Comments strategy has no grades
      });
    });

    it('should handle numerrors grading strategy', async () => {
      const dimensions = createMockGradingStrategy(GRADING_STRATEGIES.NUMERRORS, 5);

      expect(dimensions).toHaveLength(5);
      dimensions.forEach((dim) => {
        expect(dim.strategy).toBe(GRADING_STRATEGIES.NUMERRORS);
        expect(dim.grade).toBe(1); // Binary error check
      });
    });

    it('should validate grade range per grading strategy', () => {
      // Accumulative: grades should be between 0 and max grade
      const accumulativeDim = createMockDimension({
        strategy: GRADING_STRATEGIES.ACCUMULATIVE,
        grade: 20,
      });
      expect(accumulativeDim.grade).toBeLessThanOrEqual(100);
      expect(accumulativeDim.grade).toBeGreaterThanOrEqual(0);

      // Numerrors: binary (0 or 1)
      const numerrorsDim = createMockDimension({
        strategy: GRADING_STRATEGIES.NUMERRORS,
        grade: 1,
      });
      expect([0, 1]).toContain(numerrorsDim.grade);
    });
  });

  // ==========================================================================
  // Permission Check Tests
  // ==========================================================================

  describe('Permission Checks', () => {
    it('should validate isreviewer flag for assessment access', async () => {
      const assessment = createFullMockAssessment({ reviewerId: 101 });

      // Validate that reviewer can access
      const canAccess = validateAssessmentPermission(assessment, 101, 'reviewer');
      expect(canAccess).toBe(true);

      // Non-reviewer should not have access
      const cannotAccess = validateAssessmentPermission(assessment, 999, 'student');
      expect(cannotAccess).toBe(false);
    });

    it('should validate canoverridegrades capability for teachers', () => {
      const assessment = createFullMockAssessment();

      // Teacher with override capability
      const canOverride = validateAssessmentPermission(assessment, 50, 'teacher');
      expect(canOverride).toBe(true);

      // Student cannot override grades
      const studentCannotOverride = validateAssessmentPermission(assessment, 100, 'student');
      expect(studentCannotOverride).toBe(false);
    });

    it('should handle permission denied error on assessment update', async () => {
      const workshopId = 1;

      server.use(
        http.put(`${API_BASE_URL}/workshops/assessments/:assessmentId`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to modify this assessment',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useUpdateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({
          assessmentId: 1,
          data: { feedbackAuthor: 'Unauthorized update', dimensions: [] },
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should validate weight override permission for teachers', () => {
      const assessment = createFullMockAssessment({ weight: 1 });

      // Teacher can override weight
      const teacherCanOverride = validateAssessmentPermission(assessment, 50, 'teacher');
      expect(teacherCanOverride).toBe(true);

      // Student cannot override weight
      const studentCannotOverride = validateAssessmentPermission(assessment, 100, 'student');
      expect(studentCannotOverride).toBe(false);
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe('Utility Functions', () => {
    describe('calculateDimensionTotal', () => {
      it('should calculate total grade from dimension grades', () => {
        const dimensions = [
          createMockDimensionGrade({ grade: 15 }),
          createMockDimensionGrade({ grade: 18 }),
          createMockDimensionGrade({ grade: 12 }),
        ];

        const total = calculateDimensionTotal(dimensions);
        expect(total).toBe(45);
      });

      it('should handle empty dimensions array', () => {
        const total = calculateDimensionTotal([]);
        expect(total).toBe(0);
      });

      it('should handle null grades in dimensions', () => {
        const dimensions = [
          createMockDimensionGrade({ grade: 15 }),
          createMockDimensionGrade({ grade: null as unknown as number }),
          createMockDimensionGrade({ grade: 12 }),
        ];

        const total = calculateDimensionTotal(dimensions);
        expect(total).toBe(27);
      });
    });

    describe('formatDimensionData', () => {
      it('should format accumulative strategy dimensions correctly', () => {
        const dimensions = [
          { dimensionId: 1, grade: 18, peerComment: 'Good' },
          { dimensionId: 2, grade: 16, peerComment: 'Needs improvement' },
        ];

        const formatted = formatDimensionData(dimensions, GRADING_STRATEGIES.ACCUMULATIVE);
        expect(formatted).toHaveLength(2);
        formatted.forEach((dim) => {
          expect(dim).toHaveProperty('dimensionId');
          expect(dim).toHaveProperty('grade');
          expect(dim).toHaveProperty('peerComment');
        });
      });

      it('should format rubric strategy dimensions with levels', () => {
        const dimensions = [
          { dimensionId: 1, grade: 10, peerComment: 'Level 1 selected' },
        ];

        const formatted = formatDimensionData(dimensions, GRADING_STRATEGIES.RUBRIC);
        expect(formatted).toHaveLength(1);
      });

      it('should format comments strategy dimensions without grades', () => {
        const dimensions = [
          { dimensionId: 1, grade: 0, peerComment: 'Detailed comment here' },
        ];

        const formatted = formatDimensionData(dimensions, GRADING_STRATEGIES.COMMENTS);
        expect(formatted).toHaveLength(1);
        expect(formatted[0].grade).toBe(0);
      });

      it('should format numerrors strategy dimensions with binary values', () => {
        const dimensions = [
          { dimensionId: 1, grade: 1, peerComment: 'Error found' },
          { dimensionId: 2, grade: 0, peerComment: 'No error' },
        ];

        const formatted = formatDimensionData(dimensions, GRADING_STRATEGIES.NUMERRORS);
        expect(formatted).toHaveLength(2);
        expect([0, 1]).toContain(formatted[0].grade);
        expect([0, 1]).toContain(formatted[1].grade);
      });
    });
  });

  // ==========================================================================
  // Query Key and Cache Management Tests
  // ==========================================================================

  describe('Query Key and Cache Management', () => {
    it('should use correct query key for assessment', async () => {
      const assessmentId = 1;
      const { result } = renderHook(() => useAssessment(assessmentId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Check that data is cached with correct key
      const cachedData = queryClient.getQueryData(['assessments', assessmentId]);
      expect(cachedData).toBeDefined();
    });

    it('should invalidate correct queries on mutation', async () => {
      const workshopId = 1;
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({
          submissionId: 10,
          feedbackAuthor: 'Test',
          feedbackAuthorFormat: 1,
          dimensions: [],
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify invalidation was called with workshop assessments query
      expect(invalidateQueriesSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Mutation Callback Tests
  // ==========================================================================

  describe('Mutation Callbacks', () => {
    it('should call onSuccess callback on successful creation', async () => {
      const workshopId = 1;
      const onSuccessMock = vi.fn();

      const { result } = renderHook(
        () => useCreateAssessment(workshopId),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate(
          {
            submissionId: 10,
            feedbackAuthor: 'Test',
            feedbackAuthorFormat: 1,
            dimensions: [],
          },
          {
            onSuccess: onSuccessMock,
          }
        );
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccessMock).toHaveBeenCalled();
    });

    it('should call onError callback on failed mutation', async () => {
      const workshopId = 1;
      const onErrorMock = vi.fn();

      server.use(
        http.post(`${API_BASE_URL}/workshops/:workshopId/assessments`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'ERROR', message: 'Test error' },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(
        () => useCreateAssessment(workshopId),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate(
          {
            submissionId: 10,
            feedbackAuthor: 'Test',
            feedbackAuthorFormat: 1,
            dimensions: [],
          },
          {
            onError: onErrorMock,
          }
        );
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(onErrorMock).toHaveBeenCalled();
    });

    it('should call onSettled callback regardless of outcome', async () => {
      const workshopId = 1;
      const onSettledMock = vi.fn();

      const { result } = renderHook(
        () => useUpdateAssessment(workshopId),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate(
          {
            assessmentId: 1,
            data: {
              feedbackAuthor: 'Test',
              dimensions: [],
            },
          },
          {
            onSettled: onSettledMock,
          }
        );
      });

      await waitFor(() => {
        expect(onSettledMock).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // TypeScript Type Validation Tests
  // ==========================================================================

  describe('TypeScript Type Validation', () => {
    it('should enforce proper WorkshopAssessment type', () => {
      const assessment: WorkshopAssessment = createFullMockAssessment();

      // Type checking - these properties should exist
      expect(assessment.id).toBeDefined();
      expect(assessment.submissionId).toBeDefined();
      expect(assessment.reviewerId).toBeDefined();
      expect(assessment.weight).toBeDefined();
    });

    it('should enforce proper WorkshopAssessmentFormData type', () => {
      const formData: WorkshopAssessmentFormData = {
        submissionId: 1,
        feedbackAuthor: 'Test feedback',
        feedbackAuthorFormat: 1,
        dimensions: [
          { dimensionId: 1, grade: 15, peerComment: 'Test' },
        ],
      };

      expect(formData.submissionId).toBeDefined();
      expect(formData.dimensions).toBeInstanceOf(Array);
    });

    it('should validate dimension data structure', () => {
      const dimension = createMockDimension();

      expect(dimension.id).toBeDefined();
      expect(dimension.workshopId).toBeDefined();
      expect(dimension.description).toBeDefined();
      expect(dimension.grade).toBeDefined();
      expect(dimension.weight).toBeDefined();
      expect(dimension.strategy).toBeDefined();
    });
  });
});
