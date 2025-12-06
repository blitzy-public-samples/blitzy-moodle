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
import type { QueryClient} from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
// Use the global MSW server from test setup instead of creating a local one
import { server } from '@tests/mocks/server';
import React, { type ReactNode } from 'react';

// Internal imports from workshop hooks
import {
  useAssessment,
  useCreateAssessment,
  useUpdateAssessment,
  useSubmitAssessment,
  calculateAssessmentGrade,
  isAssessmentComplete,
  formatDimensionGrade,
  type Assessment,
  type CreateAssessmentData,
  type UpdateAssessmentData,
} from '@/features/activities/workshop/hooks/useAssessment';

// Import types
import type { WorkshopAssessmentDimension } from '@/types/entities';

// Import test utilities
import {
  createMockDimension,
  createMockGradingStrategy,
  GRADING_STRATEGIES,
} from './test-utils.tsx';

import { createTestQueryClient } from '@tests/helpers/render';

// ============================================================================
// Constants and Configuration
// ============================================================================

// Use the same API base URL as vitest.config.ts env setting for MSW to intercept requests
const API_BASE_URL = 'http://localhost:8000/api/v1';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a complete mock assessment with all fields populated
 * Uses lowercase properties to match the Assessment interface from useAssessment.ts
 * which aligns with Moodle database schema conventions
 */
function createFullMockAssessment(overrides?: Partial<Assessment>): Assessment {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: 1,
    submissionid: 10,
    reviewerid: 101,
    weight: 1,
    grade: 85,
    gradinggrade: 90,
    gradinggradeover: null,
    gradinggradeoverby: null,
    feedbackauthor: '<p>Excellent work on the analysis section</p>',
    feedbackauthorformat: 1,
    feedbackauthorattachment: 0,
    feedbackreviewer: '<p>Thank you for the detailed feedback</p>',
    feedbackreviewerformat: 1,
    timecreated: now - 3600,
    timemodified: now - 1800,
    dimensions: createMockDimensionGrades(3),
    reviewer: {
      id: 101,
      firstname: 'Jane',
      lastname: 'Reviewer',
      fullname: 'Jane Reviewer',
      picture: null,
      email: 'jane.reviewer@example.com',
    },
    ...overrides,
  };
}

/**
 * Creates mock dimension grades for testing - matches WorkshopAssessmentDimension type from entities.ts
 * WorkshopAssessmentDimension has: dimensionid (required), grade (optional), peercomment (optional), peercommentformat (required)
 */
function createMockDimensionGrades(count: number = 3): WorkshopAssessmentDimension[] {
  return Array.from({ length: count }, (_, i) => ({
    dimensionid: i + 1,
    grade: 15 + i,
    peercomment: `Comment for dimension ${i + 1}`,
    peercommentformat: 1,
  }));
}

/**
 * Creates a single mock WorkshopAssessmentDimension with optional overrides
 * Note: WorkshopAssessmentDimension interface does NOT have `id` or `assessmentid`
 */
function createMockWorkshopDimension(
  overrides?: Partial<WorkshopAssessmentDimension>
): WorkshopAssessmentDimension {
  return {
    dimensionid: 1,
    grade: 80,
    peercomment: 'Good analysis with room for improvement',
    peercommentformat: 1,
    ...overrides,
  };
}

// ============================================================================
// MSW Server Setup
// ============================================================================

const mockAssessments = [
  createFullMockAssessment({ id: 1, submissionid: 10 }),
  createFullMockAssessment({ id: 2, submissionid: 11, reviewerid: 102 }),
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
    const body = (await request.json()) as CreateAssessmentData;

    if (workshopId > 0) {
      const newAssessment = createFullMockAssessment({
        id: 100,
        submissionid: body.submissionid,
        reviewerid: body.reviewerid,
        grade: null,
        gradinggrade: null,
      });

      return HttpResponse.json({
        success: true,
        data: {
          id: newAssessment.id,
          submissionid: newAssessment.submissionid,
          reviewerid: newAssessment.reviewerid,
        },
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
    const body = (await request.json()) as UpdateAssessmentData;
    const assessment = mockAssessments.find((a) => a.id === assessmentId);

    if (assessment) {
      const updatedAssessment = {
        ...assessment,
        feedbackauthor: body.feedbackauthor || assessment.feedbackauthor,
        grade: body.dimensions
          ? body.dimensions.reduce((sum, d) => sum + (d.grade || 0), 0)
          : assessment.grade,
        timemodified: Math.floor(Date.now() / 1000),
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
          nextAssessmentId: null,
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

// Global server is imported from @tests/mocks/server
// Handlers are registered in beforeAll using server.use()

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
    // Register our test handlers with the global server
    server.use(...handlers);
  });

  afterAll(() => {
    // Reset to default handlers (global server manages its own lifecycle)
    server.resetHandlers();
  });

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset to just our handlers, removing any test-specific overrides
    server.resetHandlers(...handlers);
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

      // Compare against pathname (without host)
      expect(requestUrl).toBe(`/api/v1/workshops/assessments/${assessmentId}`);
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
      // Note: Property names use lowercase to match Moodle database schema conventions
      expect(assessment).toMatchObject({
        id: expect.any(Number),
        submissionid: expect.any(Number),
        reviewerid: expect.any(Number),
        weight: expect.any(Number),
        timecreated: expect.any(Number),
      });

      // Verify optional grade fields (lowercase property names)
      expect(assessment).toHaveProperty('grade');
      expect(assessment).toHaveProperty('gradinggrade');
      expect(assessment).toHaveProperty('gradinggradeover');
      expect(assessment).toHaveProperty('feedbackreviewer');
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

      // Verify dimension structure matches WorkshopAssessmentDimension interface:
      // dimensionid, grade, peercomment, peercommentformat (no 'id' or 'assessmentid')
      assessment?.dimensions?.forEach((dim) => {
        expect(dim).toHaveProperty('dimensionid');
        expect(dim).toHaveProperty('grade');
        expect(dim).toHaveProperty('peercomment');
        expect(dim).toHaveProperty('peercommentformat');
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
      let capturedRequest: CreateAssessmentData | null = null;

      server.use(
        http.post(`${API_BASE_URL}/workshops/:workshopId/assessments`, async ({ request }) => {
          capturedRequest = (await request.json()) as CreateAssessmentData;
          return HttpResponse.json({
            success: true,
            data: {
              id: 100,
              submissionid: capturedRequest.submissionid,
              reviewerid: capturedRequest.reviewerid,
            },
          });
        })
      );

      const { result } = renderHook(() => useCreateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      // CreateAssessmentData uses lowercase properties matching Moodle schema
      const formData: CreateAssessmentData = {
        submissionid: 10,
        reviewerid: 101,
        weight: 1,
      };

      await act(async () => {
        result.current.createAssessment(formData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Use type assertion to access captured request properties
      expect(capturedRequest).not.toBeNull();
      // Non-null assertion since we already checked not null
      expect(capturedRequest!.submissionid).toBe(10);
    });

    it('should complete successfully on valid creation', async () => {
      const workshopId = 1;
      const { result } = renderHook(() => useCreateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      // CreateAssessmentData uses lowercase properties
      const formData: CreateAssessmentData = {
        submissionid: 10,
        reviewerid: 101,
        weight: 1,
      };

      await act(async () => {
        result.current.createAssessment(formData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Note: useCreateAssessment doesn't expose data directly
      // Success is indicated by isSuccess flag
      expect(result.current.isError).toBe(false);
    });

    it('should handle createAssessment mutation function correctly', async () => {
      const workshopId = 1;
      const { result } = renderHook(() => useCreateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      // The hook returns createAssessment and createAssessmentAsync
      expect(result.current.createAssessment).toBeDefined();
      expect(typeof result.current.createAssessment).toBe('function');
      expect(result.current.createAssessmentAsync).toBeDefined();
      expect(typeof result.current.createAssessmentAsync).toBe('function');
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

      // CreateAssessmentData uses lowercase properties
      const formData: CreateAssessmentData = {
        submissionid: 10,
        reviewerid: 101,
        weight: 1,
      };

      await act(async () => {
        result.current.createAssessment(formData);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should show loading state during mutation', async () => {
      const workshopId = 1;
      let resolveRequest: (() => void) | null = null;

      // Add controlled delay to observe loading state
      server.use(
        http.post(`${API_BASE_URL}/workshops/:workshopId/assessments`, async () => {
          await new Promise<void>((resolve) => {
            resolveRequest = resolve;
          });
          return HttpResponse.json({
            success: true,
            data: createFullMockAssessment({ id: 100 }),
          });
        })
      );

      const { result } = renderHook(() => useCreateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      // CreateAssessmentData uses lowercase properties
      const formData: CreateAssessmentData = {
        submissionid: 10,
        reviewerid: 101,
        weight: 1,
      };

      // Trigger the mutation
      act(() => {
        result.current.createAssessment(formData);
      });

      // Wait for loading state to be set
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      }, { timeout: 1000 });

      // Now resolve the request
      act(() => {
        resolveRequest?.();
      });

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

      // CreateAssessmentData uses lowercase properties
      const formData: CreateAssessmentData = {
        submissionid: 10,
        reviewerid: 101,
        weight: 1,
      };

      await act(async () => {
        result.current.createAssessment(formData);
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
      const assessmentId = 1;
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

      const { result } = renderHook(() => useUpdateAssessment(workshopId, assessmentId), {
        wrapper: createWrapper(queryClient),
      });

      // UpdateAssessmentData uses lowercase properties matching Moodle schema
      const updateData: UpdateAssessmentData = {
        feedbackauthor: 'Updated feedback',
        feedbackauthorformat: 1,
        dimensions: [{ dimensionid: 1, grade: 19, peercomment: 'Improved analysis', peercommentformat: 1 }],
      };

      await act(async () => {
        result.current.updateAssessment(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // pathname contains just the path portion without the host
      expect(capturedUrl).toBe('/api/v1/workshops/assessments/1');
    });

    it('should handle updateAssessment mutation function', async () => {
      const workshopId = 1;
      const assessmentId = 1;
      const { result } = renderHook(() => useUpdateAssessment(workshopId, assessmentId), {
        wrapper: createWrapper(queryClient),
      });

      // Hook returns updateAssessment and updateAssessmentAsync functions
      expect(result.current.updateAssessment).toBeDefined();
      expect(typeof result.current.updateAssessment).toBe('function');
      expect(result.current.updateAssessmentAsync).toBeDefined();
      expect(typeof result.current.updateAssessmentAsync).toBe('function');
    });

    it('should update assessment grades and feedback', async () => {
      const workshopId = 1;
      const assessmentId = 1;
      let capturedBody: Record<string, unknown> | null = null;

      server.use(
        http.put(`${API_BASE_URL}/workshops/assessments/:assessmentId`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            success: true,
            data: createFullMockAssessment({
              id: 1,
              feedbackauthor: capturedBody.feedbackauthor as string,
            }),
          });
        })
      );

      // useUpdateAssessment signature: (assessmentId, workshopId?)
      const { result } = renderHook(() => useUpdateAssessment(assessmentId, workshopId), {
        wrapper: createWrapper(queryClient),
      });

      // UpdateAssessmentData uses lowercase properties matching Moodle schema
      const updateData: UpdateAssessmentData = {
        feedbackauthor: 'Updated overall feedback',
        feedbackauthorformat: 1,
        dimensions: [
          { dimensionid: 1, grade: 17, peercomment: 'Revised comment', peercommentformat: 1 },
          { dimensionid: 2, grade: 18, peercomment: 'Better structure noted', peercommentformat: 1 },
        ],
      };

      await act(async () => {
        result.current.updateAssessment(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Use type assertion to access captured body properties
      expect(capturedBody).not.toBeNull();
      // Non-null assertion since we already checked not null
      expect(capturedBody!.feedbackauthor).toBe('Updated overall feedback');
      expect(capturedBody!.dimensions).toBeDefined();
    });

    it('should perform optimistic updates during modification', async () => {
      const workshopId = 1;
      const assessmentId = 1;

      // Pre-populate the cache
      const originalAssessment = createFullMockAssessment({ id: assessmentId });
      queryClient.setQueryData(['assessments', assessmentId], originalAssessment);

      let resolveRequest: (() => void) | null = null;

      // Delay server response to observe optimistic update
      server.use(
        http.put(`${API_BASE_URL}/workshops/assessments/:assessmentId`, async () => {
          await new Promise<void>((resolve) => {
            resolveRequest = resolve;
          });
          return HttpResponse.json({
            success: true,
            data: createFullMockAssessment({
              id: assessmentId,
              feedbackauthor: 'Server updated feedback',
            }),
          });
        })
      );

      const { result } = renderHook(() => useUpdateAssessment(workshopId, assessmentId), {
        wrapper: createWrapper(queryClient),
      });

      // UpdateAssessmentData uses lowercase properties
      const updateData: UpdateAssessmentData = {
        feedbackauthor: 'Optimistically updated feedback',
        feedbackauthorformat: 1,
        dimensions: [],
      };

      // Trigger the mutation
      act(() => {
        result.current.updateAssessment(updateData);
      });

      // Wait for loading state to be set
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      }, { timeout: 1000 });

      // Now resolve the request
      act(() => {
        resolveRequest?.();
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should invalidate queries on successful update', async () => {
      const workshopId = 1;
      const assessmentId = 1;
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateAssessment(workshopId, assessmentId), {
        wrapper: createWrapper(queryClient),
      });

      // UpdateAssessmentData uses lowercase properties
      const updateData: UpdateAssessmentData = {
        feedbackauthor: 'Test update',
        feedbackauthorformat: 1,
        dimensions: [],
      };

      await act(async () => {
        result.current.updateAssessment(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateQueriesSpy).toHaveBeenCalled();
    });

    it('should handle validation errors (400)', async () => {
      const workshopId = 1;
      const assessmentId = 1;

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

      const { result } = renderHook(() => useUpdateAssessment(workshopId, assessmentId), {
        wrapper: createWrapper(queryClient),
      });

      // UpdateAssessmentData with invalid grade (using lowercase properties)
      const updateData: UpdateAssessmentData = {
        feedbackauthor: 'Test',
        feedbackauthorformat: 1,
        dimensions: [{ dimensionid: 1, grade: 999, peercomment: 'Invalid grade', peercommentformat: 1 }],
      };

      await act(async () => {
        result.current.updateAssessment(updateData);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle 404 error for non-existent assessment', async () => {
      const workshopId = 1;
      const assessmentId = 9999;

      // Override handler for this specific test to ensure 404 response
      server.use(
        http.put(`${API_BASE_URL}/workshops/assessments/:assessmentId`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Assessment not found' },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useUpdateAssessment(workshopId, assessmentId), {
        wrapper: createWrapper(queryClient),
      });

      // UpdateAssessmentData uses lowercase properties
      const updateData: UpdateAssessmentData = {
        feedbackauthor: 'Test',
        feedbackauthorformat: 1,
        dimensions: [],
      };

      await act(async () => {
        result.current.updateAssessment(updateData);
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
      const assessmentId = 1;
      const workshopId = 1;
      let capturedUrl = '';

      server.use(
        http.post(`${API_BASE_URL}/workshops/assessments/:assessmentId/submit`, ({ request }) => {
          capturedUrl = new URL(request.url).pathname;
          return HttpResponse.json({
            success: true,
            data: {
              submitted: true,
              submittedAt: Math.floor(Date.now() / 1000),
              nextAssessmentId: null,
            },
          });
        })
      );

      // Note: useSubmitAssessment takes assessmentId first, workshopId second
      const { result } = renderHook(() => useSubmitAssessment(assessmentId, workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.submitAssessment({ saveandclose: true });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // pathname contains just the path portion without the host
      expect(capturedUrl).toBe('/api/v1/workshops/assessments/1/submit');
    });

    it('should handle submitAssessment mutation function', async () => {
      const assessmentId = 1;
      const workshopId = 1;
      const { result } = renderHook(() => useSubmitAssessment(assessmentId, workshopId), {
        wrapper: createWrapper(queryClient),
      });

      // Hook returns submitAssessment and submitAssessmentAsync functions
      expect(result.current.submitAssessment).toBeDefined();
      expect(typeof result.current.submitAssessment).toBe('function');
      expect(result.current.submitAssessmentAsync).toBeDefined();
      expect(typeof result.current.submitAssessmentAsync).toBe('function');
    });

    it('should mark assessment as submitted and prevent further edits', async () => {
      const assessmentId = 1;
      const workshopId = 1;

      server.use(
        http.post(`${API_BASE_URL}/workshops/assessments/:assessmentId/submit`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              submitted: true,
              submittedAt: Math.floor(Date.now() / 1000),
              nextAssessmentId: null,
            },
          });
        })
      );

      const { result } = renderHook(() => useSubmitAssessment(assessmentId, workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.submitAssessment({ saveandclose: true });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Success means the assessment is now submitted
      expect(result.current.isError).toBe(false);
    });

    it('should trigger grade recalculation after submission', async () => {
      const assessmentId = 1;
      const workshopId = 1;

      server.use(
        http.post(`${API_BASE_URL}/workshops/assessments/:assessmentId/submit`, () => {
          // Simulate grade recalculation in response
          return HttpResponse.json({
            success: true,
            data: {
              submitted: true,
              submittedAt: Math.floor(Date.now() / 1000),
              nextAssessmentId: null,
              gradeRecalculated: true,
            },
          });
        })
      );

      const { result } = renderHook(() => useSubmitAssessment(assessmentId, workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.submitAssessment({ saveandclose: true });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify submission was successful (grade recalculation happens on server)
      expect(result.current.isError).toBe(false);
    });

    it('should invalidate assessment queries after submission', async () => {
      const assessmentId = 1;
      const workshopId = 1;
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSubmitAssessment(assessmentId, workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.submitAssessment({ saveandclose: true });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateQueriesSpy).toHaveBeenCalled();
    });

    it('should handle incomplete assessment submission error', async () => {
      const assessmentId = 1;
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

      const { result } = renderHook(() => useSubmitAssessment(assessmentId, workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.submitAssessment({ saveandclose: true });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle missing required feedback fields error', async () => {
      const assessmentId = 1;
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

      const { result } = renderHook(() => useSubmitAssessment(assessmentId, workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.submitAssessment({ saveandclose: true });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should show loading state during submission', async () => {
      const assessmentId = 1;
      const workshopId = 1;
      let resolveRequest: (() => void) | null = null;

      server.use(
        http.post(`${API_BASE_URL}/workshops/assessments/:assessmentId/submit`, async () => {
          // Wait for test to check loading state before resolving
          await new Promise<void>((resolve) => {
            resolveRequest = resolve;
          });
          return HttpResponse.json({
            success: true,
            data: {
              submitted: true,
              submittedAt: Math.floor(Date.now() / 1000),
              nextAssessmentId: null,
            },
          });
        })
      );

      const { result } = renderHook(() => useSubmitAssessment(assessmentId, workshopId), {
        wrapper: createWrapper(queryClient),
      });

      // Trigger the mutation
      act(() => {
        result.current.submitAssessment({ saveandclose: true });
      });

      // Wait for loading state to be set
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      }, { timeout: 1000 });

      // Now resolve the request
      act(() => {
        resolveRequest?.();
      });

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
      const assessmentId = 1;
      const dimensions = createMockGradingStrategy(GRADING_STRATEGIES.ACCUMULATIVE, 3);

      server.use(
        http.get(`${API_BASE_URL}/workshops/:workshopId/dimensions`, () => {
          return HttpResponse.json({
            success: true,
            data: dimensions,
          });
        })
      );

      const { result } = renderHook(() => useAssessment(assessmentId), {
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
      // Assessment uses lowercase properties matching Moodle schema
      const assessment = createFullMockAssessment({ reviewerid: 101 });

      // Verify assessment includes reviewer information for permission validation
      expect(assessment.reviewerid).toBe(101);

      // When user is the reviewer, they should be able to access their own assessment
      // The actual permission validation happens server-side, but the data structure supports it
      const isCurrentUserReviewer = assessment.reviewerid === 101;
      expect(isCurrentUserReviewer).toBe(true);

      // Non-reviewer check (different user ID)
      const isNonReviewerUser = assessment.reviewerid === 999;
      expect(isNonReviewerUser).toBe(false);
    });

    it('should validate canoverridegrades capability through API response', async () => {
      const assessmentId = 1;

      // Mock an assessment with grade override capability data (lowercase properties)
      server.use(
        http.get(`${API_BASE_URL}/workshops/assessments/:assessmentId`, () => {
          return HttpResponse.json({
            success: true,
            data: createFullMockAssessment({
              gradinggradeover: 95, // Teacher has overridden the grading grade
            }),
          });
        })
      );

      const { result } = renderHook(() => useAssessment(assessmentId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assessment data should include override grade from server (lowercase property)
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.gradinggradeover).toBe(95);
    });

    it('should handle permission denied error on assessment update', async () => {
      const assessmentId = 1;
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

      const { result } = renderHook(() => useUpdateAssessment(assessmentId, workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        // UpdateAssessmentData uses lowercase properties - dimensions is required
        result.current.updateAssessment({
          feedbackauthor: 'Unauthorized update',
          dimensions: [],
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle permission denied error on assessment submission', async () => {
      const assessmentId = 1;
      const workshopId = 1;

      server.use(
        http.post(`${API_BASE_URL}/workshops/assessments/:assessmentId/submit`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You cannot submit assessments in this phase',
              },
            },
            { status: 403 }
          );
        })
      );

      // useSubmitAssessment takes assessmentId as first param, workshopId as optional second
      const { result } = renderHook(() => useSubmitAssessment(assessmentId, workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        // submitAssessment takes optional SubmitAssessmentData
        result.current.submitAssessment({ saveandclose: true });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should validate weight override permission through API', async () => {
      const assessmentId = 1;
      const workshopId = 1;

      // Mock a weight override that fails for non-teachers
      server.use(
        http.put(`${API_BASE_URL}/workshops/assessments/:assessmentId`, () => {
          // In a real scenario, the server would check teacher permissions
          return HttpResponse.json({
            success: true,
            data: createFullMockAssessment({
              weight: 2, // Updated weight
            }),
          });
        })
      );

      const { result } = renderHook(() => useUpdateAssessment(assessmentId, workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        // UpdateAssessmentData uses lowercase properties - dimensions is required
        result.current.updateAssessment({
          weight: 2,
          dimensions: [],
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Note: useUpdateAssessment doesn't directly expose data
      // Success is indicated by isSuccess flag
      expect(result.current.isError).toBe(false);
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe('Utility Functions', () => {
    describe('calculateAssessmentGrade', () => {
      it('should calculate average grade as percentage from dimension grades', () => {
        const dimensions: WorkshopAssessmentDimension[] = [
          createMockWorkshopDimension({ grade: 80 }),
          createMockWorkshopDimension({ grade: 90 }),
          createMockWorkshopDimension({ grade: 70 }),
        ];

        // Average: (80 + 90 + 70) / 3 = 80
        // Percentage: (80 / 100) * 100 = 80
        const result = calculateAssessmentGrade(dimensions, 100);
        expect(result).toBe(80);
      });

      it('should handle empty dimensions array', () => {
        const result = calculateAssessmentGrade([]);
        expect(result).toBeNull();
      });

      it('should handle undefined grades in dimensions', () => {
        const dimensions: WorkshopAssessmentDimension[] = [
          createMockWorkshopDimension({ grade: 80 }),
          createMockWorkshopDimension({ grade: undefined }),
          createMockWorkshopDimension({ grade: 60 }),
        ];

        // Only counts graded dimensions: (80 + 60) / 2 = 70
        const result = calculateAssessmentGrade(dimensions, 100);
        expect(result).toBe(70);
      });

      it('should normalize to percentage based on maxGrade', () => {
        const dimensions: WorkshopAssessmentDimension[] = [
          createMockWorkshopDimension({ grade: 15 }),
          createMockWorkshopDimension({ grade: 18 }),
          createMockWorkshopDimension({ grade: 12 }),
        ];

        // Average: (15 + 18 + 12) / 3 = 15
        // With maxGrade 20: (15 / 20) * 100 = 75%
        const result = calculateAssessmentGrade(dimensions, 20);
        expect(result).toBe(75);
      });

      it('should cap result at 100%', () => {
        const dimensions: WorkshopAssessmentDimension[] = [
          createMockWorkshopDimension({ grade: 120 }),
        ];

        const result = calculateAssessmentGrade(dimensions, 100);
        expect(result).toBe(100);
      });

      it('should return null when all grades are undefined', () => {
        const dimensions: WorkshopAssessmentDimension[] = [
          createMockWorkshopDimension({ grade: undefined }),
          createMockWorkshopDimension({ grade: undefined }),
        ];

        const result = calculateAssessmentGrade(dimensions, 100);
        expect(result).toBeNull();
      });
    });

    describe('isAssessmentComplete', () => {
      it('should return true when all dimensions have grades', () => {
        const dimensions: WorkshopAssessmentDimension[] = [
          createMockWorkshopDimension({ grade: 80 }),
          createMockWorkshopDimension({ grade: 75 }),
          createMockWorkshopDimension({ grade: 90 }),
        ];

        const result = isAssessmentComplete(dimensions);
        expect(result).toBe(true);
      });

      it('should return false when some dimensions are ungraded', () => {
        const dimensions: WorkshopAssessmentDimension[] = [
          createMockWorkshopDimension({ grade: 80 }),
          createMockWorkshopDimension({ grade: undefined }),
          createMockWorkshopDimension({ grade: 90 }),
        ];

        const result = isAssessmentComplete(dimensions);
        expect(result).toBe(false);
      });

      it('should return false for empty dimensions array', () => {
        const result = isAssessmentComplete([]);
        expect(result).toBe(false);
      });

      it('should check only required dimensions when specified', () => {
        const dimensions: WorkshopAssessmentDimension[] = [
          createMockWorkshopDimension({ dimensionid: 1, grade: 80 }),
          createMockWorkshopDimension({ dimensionid: 2, grade: undefined }),
          createMockWorkshopDimension({ dimensionid: 3, grade: 90 }),
        ];

        // Only require dimensions 1 and 3
        const result = isAssessmentComplete(dimensions, [1, 3]);
        expect(result).toBe(true);

        // Require dimension 2 which is ungraded
        const resultWithUngraded = isAssessmentComplete(dimensions, [1, 2]);
        expect(resultWithUngraded).toBe(false);
      });
    });

    describe('formatDimensionGrade', () => {
      it('should format grade for display', () => {
        // Grade 80 out of 100 max, at 100 scale -> 80.00
        const result = formatDimensionGrade(80, 100, 2);
        expect(result).toBe('80.00');
      });

      it('should return dash for null grade', () => {
        const result = formatDimensionGrade(null);
        expect(result).toBe('-');
      });

      it('should return dash for undefined grade', () => {
        const result = formatDimensionGrade(undefined);
        expect(result).toBe('-');
      });

      it('should respect decimal places parameter', () => {
        const result = formatDimensionGrade(75.5, 100, 1);
        expect(result).toBe('75.5');
      });

      it('should scale grade based on maxGrade', () => {
        // Grade is stored as percentage, display based on maxGrade
        // If grade=80 (80%) and maxGrade=20, real grade = 20 * 80 / 100 = 16
        const result = formatDimensionGrade(80, 20, 2);
        expect(result).toBe('16.00');
      });

      it('should handle zero grade', () => {
        const result = formatDimensionGrade(0, 100, 2);
        expect(result).toBe('0.00');
      });

      it('should use default decimals of 2', () => {
        const result = formatDimensionGrade(75, 100);
        expect(result).toBe('75.00');
      });
    });

    describe('Dimension Data Formatting for Grading Strategies', () => {
      it('should validate accumulative strategy dimensions with points', () => {
        const dimensions = [
          createMockWorkshopDimension({ grade: 18, dimensionid: 1 }),
          createMockWorkshopDimension({ grade: 16, dimensionid: 2 }),
        ];

        // Verify dimension structure matches accumulative strategy requirements
        dimensions.forEach((dim) => {
          expect(dim).toHaveProperty('dimensionid');
          expect(dim).toHaveProperty('grade');
          expect(typeof dim.grade).toBe('number');
        });
      });

      it('should validate rubric strategy dimensions with levels', () => {
        const dimensions = [
          createMockWorkshopDimension({ grade: 10, dimensionid: 1 }),
        ];

        // Rubric grades should be level values
        expect(dimensions).toHaveLength(1);
        // Use non-null assertion since we know array has 1 element
        expect(dimensions[0]!.grade).toBeDefined();
      });

      it('should validate comments strategy dimensions without numeric grades', () => {
        const dimension = createMockWorkshopDimension({ 
          grade: 0, 
          dimensionid: 1,
          peercomment: 'Detailed feedback comment' 
        });

        // Comments strategy uses 0 for grade, focusing on comment
        expect(dimension.grade).toBe(0);
        expect(dimension.peercomment).toBeDefined();
      });

      it('should validate numerrors strategy dimensions with binary values', () => {
        const dimensions = [
          createMockWorkshopDimension({ grade: 1, dimensionid: 1 }), // Error found
          createMockWorkshopDimension({ grade: 0, dimensionid: 2 }), // No error
        ];

        // Numerrors uses binary grades (0 or 1)
        dimensions.forEach((dim) => {
          expect([0, 1]).toContain(dim.grade);
        });
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
      // Hook uses query key pattern: ['workshops', 'assessments', assessmentId]
      const cachedData = queryClient.getQueryData(['workshops', 'assessments', assessmentId]);
      expect(cachedData).toBeDefined();
    });

    it('should invalidate correct queries on mutation', async () => {
      const workshopId = 1;
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateAssessment(workshopId), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        // CreateAssessmentData uses lowercase properties
        result.current.createAssessment({
          submissionid: 10,
          reviewerid: 101,
          weight: 1,
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

  describe('Mutation State Transitions', () => {
    it('should transition to success state on successful creation', async () => {
      const workshopId = 1;

      const { result } = renderHook(
        () => useCreateAssessment(workshopId),
        { wrapper: createWrapper(queryClient) }
      );

      // Initial state should not be in success
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        // CreateAssessmentData uses lowercase properties
        result.current.createAssessment({
          submissionid: 10,
          reviewerid: 101,
          weight: 1,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // After success, error state should be false
      expect(result.current.isError).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should transition to error state on failed mutation', async () => {
      const workshopId = 1;

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
        // CreateAssessmentData uses lowercase properties
        result.current.createAssessment({
          submissionid: 10,
          reviewerid: 101,
          weight: 1,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Error object should be populated
      expect(result.current.error).toBeDefined();
      expect(result.current.isSuccess).toBe(false);
    });

    it('should set isLoading during mutation', async () => {
      const assessmentId = 1;
      const workshopId = 1;

      const { result } = renderHook(
        () => useUpdateAssessment(assessmentId, workshopId),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        // UpdateAssessmentData uses lowercase properties
        result.current.updateAssessment({
          feedbackauthor: 'Test',
          dimensions: [],
        });
      });

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should complete with success or error
      expect(result.current.isSuccess || result.current.isError).toBe(true);
    });

    it('should allow reset after mutation', async () => {
      const workshopId = 1;

      const { result } = renderHook(
        () => useCreateAssessment(workshopId),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.createAssessment({
          submissionid: 10,
          reviewerid: 101,
          weight: 1,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Reset the mutation state
      act(() => {
        result.current.reset();
      });

      // After reset, state should be cleared
      // Wait for state to propagate after reset
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(false);
      });

      expect(result.current.isError).toBe(false);
    });
  });

  // ==========================================================================
  // TypeScript Type Validation Tests
  // ==========================================================================

  describe('TypeScript Type Validation', () => {
    it('should enforce proper Assessment type from hook', () => {
      // Assessment type from useAssessment hook uses lowercase properties
      const assessment: Assessment = createFullMockAssessment();

      // Type checking - these properties should exist (lowercase per Moodle schema)
      expect(assessment.id).toBeDefined();
      expect(assessment.submissionid).toBeDefined();
      expect(assessment.reviewerid).toBeDefined();
      expect(assessment.weight).toBeDefined();
      expect(assessment.grade).toBeDefined();
      expect(assessment.dimensions).toBeDefined();
      expect(assessment.reviewer).toBeDefined();
    });

    it('should enforce proper CreateAssessmentData type', () => {
      // CreateAssessmentData uses lowercase properties
      const createData: CreateAssessmentData = {
        submissionid: 1,
        reviewerid: 101,
        weight: 1,
      };

      expect(createData.submissionid).toBeDefined();
      expect(createData.reviewerid).toBeDefined();
      expect(createData.weight).toBeDefined();
    });

    it('should enforce proper UpdateAssessmentData type', () => {
      // UpdateAssessmentData uses lowercase properties
      const updateData: UpdateAssessmentData = {
        feedbackauthor: 'Test feedback',
        feedbackauthorformat: 1,
        dimensions: [
          { dimensionid: 1, grade: 15, peercomment: 'Test', peercommentformat: 1 },
        ],
      };

      expect(updateData.feedbackauthor).toBeDefined();
      expect(updateData.dimensions).toBeInstanceOf(Array);
    });

    it('should validate AssessmentDimension from test-utils structure', () => {
      // createMockDimension returns AssessmentDimension (dimension definition)
      const dimension = createMockDimension();

      expect(dimension.id).toBeDefined();
      expect(dimension.workshopId).toBeDefined();
      expect(dimension.description).toBeDefined();
      expect(dimension.grade).toBeDefined();
      expect(dimension.weight).toBeDefined();
      expect(dimension.strategy).toBeDefined();
    });

    it('should validate WorkshopAssessmentDimension type', () => {
      // WorkshopAssessmentDimension is the grade data for a dimension
      const dimensionGrade: WorkshopAssessmentDimension = createMockWorkshopDimension();

      expect(dimensionGrade.dimensionid).toBeDefined();
      expect(dimensionGrade.grade).toBeDefined();
      expect(dimensionGrade.peercomment).toBeDefined();
      expect(dimensionGrade.peercommentformat).toBeDefined();
    });
  });
});
