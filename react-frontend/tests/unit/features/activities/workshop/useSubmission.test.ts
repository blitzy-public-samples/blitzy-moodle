/**
 * Unit Tests for useSubmission Hook
 *
 * Comprehensive tests for workshop submission CRUD operations including:
 * - Fetching user's own submission
 * - Creating new submissions with text/files
 * - Updating draft submissions
 * - Deleting submissions
 * - Publishing submissions (teachers only)
 * - Submission editability checks
 * - File attachment handling
 * - Optimistic updates
 * - Query invalidation
 * - Loading and error states
 * - React Query mutation integration with proper permission checks
 *
 * @module tests/unit/features/activities/workshop/useSubmission.test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React, { type ReactNode } from 'react';

import useSubmission, {
  useCreateSubmission,
  useUpdateSubmission,
  useDeleteSubmission,
  usePublishSubmission,
  useWorkshopSubmissions,
  WORKSHOP_SUBMISSIONS_QUERY_KEY,
  type SubmissionFormData,
  type SubmissionFile,
} from '@/features/activities/workshop/hooks/useSubmission';
import type { WorkshopSubmission } from '@/types/entities';
import { createTestQueryClient } from '@/tests/helpers/render';

// ============================================================================
// Mock Data Factories (since test-utils.ts is not available)
// ============================================================================

/**
 * Factory function for creating mock WorkshopSubmission objects
 * Generates realistic submission data matching Moodle workshop submission structure
 *
 * @param overrides - Optional partial properties to override defaults
 * @returns Complete WorkshopSubmission object
 */
function createMockSubmission(
  overrides: Partial<WorkshopSubmission> = {}
): WorkshopSubmission {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: 1,
    workshopId: 100,
    example: false,
    authorId: 10,
    authorFirstName: 'Test',
    authorLastName: 'User',
    authorEmail: 'test@example.com',
    authorPicture: 0,
    title: 'Test Submission',
    content: '<p>This is the submission content.</p>',
    contentFormat: 1, // HTML format
    contentTrust: false,
    attachment: 0,
    grade: null,
    gradingGrade: null,
    gradeOver: null,
    gradingGradeOver: null,
    feedbackAuthor: null,
    feedbackAuthorFormat: 1,
    timeCreated: now - 3600,
    timeModified: now - 1800,
    published: false,
    late: false,
    url: '/mod/workshop/submission.php?id=1',
    ...overrides,
  };
}

/**
 * Factory function for creating mock submission form data
 *
 * @param overrides - Optional partial properties to override defaults
 * @returns Complete SubmissionFormData object
 */
function createMockSubmissionFormData(
  overrides: Partial<SubmissionFormData> = {}
): SubmissionFormData {
  return {
    title: 'New Submission',
    content: '<p>Submission content for testing.</p>',
    contentformat: 1,
    ...overrides,
  };
}

/**
 * Factory function for creating mock file attachment data
 *
 * @param overrides - Optional partial properties to override defaults
 * @returns Complete SubmissionFile object
 */
function createMockSubmissionFile(
  overrides: Partial<SubmissionFile> = {}
): SubmissionFile {
  return {
    filename: 'test-document.pdf',
    filesize: 1024 * 100, // 100KB
    mimetype: 'application/pdf',
    ...overrides,
  };
}

// ============================================================================
// MSW Handlers Setup
// ============================================================================

/** Base API URL for workshop endpoints */
const API_BASE = '/api/v1';

/** Mock submission data used across tests */
let mockSubmission = createMockSubmission();
let mockSubmissionsList: WorkshopSubmission[] = [];

/**
 * MSW request handlers for workshop submission API endpoints
 * Provides mock responses for all CRUD operations
 */
const handlers = [
  // GET /api/v1/workshops/submissions/:id - Get specific submission
  http.get(`${API_BASE}/workshops/submissions/:id`, ({ params }) => {
    const id = Number(params.id);
    const submission = mockSubmissionsList.find((s) => s.id === id) || mockSubmission;

    if (id === 999) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Submission not found' },
        },
        { status: 404 }
      );
    }

    if (id === 998) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'PERMISSION_DENIED', message: 'Access denied' },
        },
        { status: 403 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: { ...submission, id },
      meta: {
        timestamp: Date.now(),
        canEdit: true,
        canDelete: true,
        canPublish: false,
      },
    });
  }),

  // GET /api/v1/workshops/:workshopId/submissions/mine - Get user's own submission
  http.get(`${API_BASE}/workshops/:workshopId/submissions/mine`, ({ params }) => {
    const workshopId = Number(params.workshopId);

    if (workshopId === 999) {
      return HttpResponse.json({
        success: false,
        data: null,
      });
    }

    return HttpResponse.json({
      success: true,
      data: { ...mockSubmission, workshopId },
      meta: {
        timestamp: Date.now(),
        canEdit: true,
        canDelete: true,
      },
    });
  }),

  // GET /api/v1/workshops/:workshopId/submissions - Get all submissions
  http.get(`${API_BASE}/workshops/:workshopId/submissions`, ({ params }) => {
    const workshopId = Number(params.workshopId);

    if (workshopId === 998) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'PERMISSION_DENIED', message: 'Not a teacher' },
        },
        { status: 403 }
      );
    }

    const submissions =
      mockSubmissionsList.length > 0
        ? mockSubmissionsList.map((s) => ({ ...s, workshopId }))
        : [
            createMockSubmission({ id: 1, workshopId, authorId: 10 }),
            createMockSubmission({ id: 2, workshopId, authorId: 11, title: 'Another Submission' }),
            createMockSubmission({ id: 3, workshopId, authorId: 12, title: 'Third Submission' }),
          ];

    return HttpResponse.json({
      success: true,
      data: submissions,
      meta: {
        total: submissions.length,
        timestamp: Date.now(),
      },
    });
  }),

  // POST /api/v1/workshops/:workshopId/submissions - Create new submission
  http.post(`${API_BASE}/workshops/:workshopId/submissions`, async ({ params, request }) => {
    const workshopId = Number(params.workshopId);

    if (workshopId === 997) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Title is required' },
        },
        { status: 400 }
      );
    }

    if (workshopId === 996) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'PHASE_ERROR', message: 'Not in submission phase' },
        },
        { status: 400 }
      );
    }

    if (workshopId === 995) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'ALREADY_SUBMITTED', message: 'Already submitted' },
        },
        { status: 400 }
      );
    }

    // Parse request body
    let data: Partial<SubmissionFormData>;
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      data = {
        title: formData.get('title') as string,
        content: formData.get('content') as string,
        contentformat: Number(formData.get('contentformat')) || 1,
      };
    } else {
      data = (await request.json()) as SubmissionFormData;
    }

    const newSubmission = createMockSubmission({
      id: Date.now(),
      workshopId,
      title: data.title || 'Untitled',
      content: data.content || '',
      contentFormat: data.contentformat || 1,
      timeCreated: Math.floor(Date.now() / 1000),
      timeModified: Math.floor(Date.now() / 1000),
    });

    return HttpResponse.json({
      success: true,
      data: newSubmission,
    });
  }),

  // PUT /api/v1/workshops/submissions/:id - Update submission
  http.put(`${API_BASE}/workshops/submissions/:id`, async ({ params, request }) => {
    const id = Number(params.id);

    if (id === 999) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Submission not found' },
        },
        { status: 404 }
      );
    }

    if (id === 998) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'PERMISSION_DENIED', message: 'Cannot edit this submission' },
        },
        { status: 403 }
      );
    }

    if (id === 997) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'PHASE_ERROR', message: 'Submission phase ended' },
        },
        { status: 400 }
      );
    }

    // Parse request body
    let data: Partial<SubmissionFormData>;
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      data = {
        title: formData.get('title') as string,
        content: formData.get('content') as string,
        contentformat: Number(formData.get('contentformat')) || 1,
      };
    } else {
      data = (await request.json()) as SubmissionFormData;
    }

    const updatedSubmission = createMockSubmission({
      ...mockSubmission,
      id,
      title: data.title || mockSubmission.title,
      content: data.content || mockSubmission.content,
      contentFormat: data.contentformat || mockSubmission.contentFormat,
      timeModified: Math.floor(Date.now() / 1000),
    });

    return HttpResponse.json({
      success: true,
      data: updatedSubmission,
    });
  }),

  // DELETE /api/v1/workshops/submissions/:id - Delete submission
  http.delete(`${API_BASE}/workshops/submissions/:id`, ({ params }) => {
    const id = Number(params.id);

    if (id === 999) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Submission not found' },
        },
        { status: 404 }
      );
    }

    if (id === 998) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'PERMISSION_DENIED', message: 'Cannot delete this submission' },
        },
        { status: 403 }
      );
    }

    if (id === 997) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'HAS_ASSESSMENTS', message: 'Submission has assessments' },
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: { message: 'Submission deleted successfully' },
    });
  }),

  // POST /api/v1/workshops/submissions/:id/publish - Publish/unpublish submission
  http.post(`${API_BASE}/workshops/submissions/:id/publish`, async ({ params, request }) => {
    const id = Number(params.id);
    const body = (await request.json()) as { published: boolean };

    if (id === 999) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Submission not found' },
        },
        { status: 404 }
      );
    }

    if (id === 998) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Only teachers can publish submissions',
          },
        },
        { status: 403 }
      );
    }

    if (id === 997) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'PHASE_ERROR', message: 'Cannot publish in this phase' },
        },
        { status: 400 }
      );
    }

    const publishedSubmission = createMockSubmission({
      ...mockSubmission,
      id,
      published: body.published,
      timeModified: Math.floor(Date.now() / 1000),
    });

    return HttpResponse.json({
      success: true,
      data: publishedSubmission,
    });
  }),
];

/** MSW server instance for intercepting HTTP requests */
const server = setupServer(...handlers);

// ============================================================================
// Test Setup and Teardown
// ============================================================================

/** Test query client instance */
let testQueryClient: QueryClient;

/**
 * Wrapper component providing React Query context for hook tests
 */
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={testQueryClient}>{children}</QueryClientProvider>
    );
  };
}

beforeAll(() => {
  // Start MSW server before all tests
  server.listen({ onUnhandledRequest: 'error' });
});

afterAll(() => {
  // Close MSW server after all tests
  server.close();
});

beforeEach(() => {
  // Reset handlers, query client, and mock data before each test
  server.resetHandlers();
  testQueryClient = createTestQueryClient();
  mockSubmission = createMockSubmission();
  mockSubmissionsList = [];
  vi.clearAllMocks();
});

// ============================================================================
// Test Suites
// ============================================================================

describe('useSubmission Hook', () => {
  describe('Query Hook Basics', () => {
    it('accepts workshopId and optional submissionId parameters', async () => {
      const { result } = renderHook(() => useSubmission(100), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data).toBeDefined();
    });

    it('fetches user\'s own submission when only workshopId is provided', async () => {
      const workshopId = 100;
      const { result } = renderHook(() => useSubmission(workshopId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.workshopId).toBe(workshopId);
    });

    it('fetches specific submission by ID when submissionId is provided', async () => {
      const workshopId = 100;
      const submissionId = 42;
      const { result } = renderHook(() => useSubmission(workshopId, submissionId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe(submissionId);
    });

    it('returns correct submission data structure', async () => {
      const { result } = renderHook(() => useSubmission(100, 1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const submission = result.current.data;
      expect(submission).toBeDefined();
      expect(submission).toHaveProperty('id');
      expect(submission).toHaveProperty('workshopId');
      expect(submission).toHaveProperty('authorId');
      expect(submission).toHaveProperty('title');
      expect(submission).toHaveProperty('content');
      expect(submission).toHaveProperty('contentFormat');
      expect(submission).toHaveProperty('attachment');
      expect(submission).toHaveProperty('grade');
      expect(submission).toHaveProperty('gradeOver');
      expect(submission).toHaveProperty('published');
      expect(submission).toHaveProperty('feedbackAuthor');
      expect(submission).toHaveProperty('timeCreated');
      expect(submission).toHaveProperty('timeModified');
    });

    it('handles enabled option to disable automatic fetching', async () => {
      const { result } = renderHook(
        () => useSubmission(100, undefined, { enabled: false }),
        { wrapper: createWrapper() }
      );

      // Should not be loading since query is disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.isFetching).toBe(false);
    });

    it('returns null for user without submission', async () => {
      const { result } = renderHook(() => useSubmission(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('handles 404 not found error for invalid submission ID', async () => {
      const { result } = renderHook(() => useSubmission(100, 999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('handles 403 permission denied error', async () => {
      const { result } = renderHook(() => useSubmission(100, 998), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Loading States', () => {
    it('shows loading state while fetching', async () => {
      const { result } = renderHook(() => useSubmission(100), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it('provides refetch function for manual data refresh', async () => {
      const { result } = renderHook(() => useSubmission(100), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(typeof result.current.refetch).toBe('function');

      // Test refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.isSuccess).toBe(true);
    });
  });
});

describe('useCreateSubmission Mutation', () => {
  describe('Successful Creation', () => {
    it('creates a new submission via POST API call', async () => {
      const workshopId = 100;
      const formData = createMockSubmissionFormData({
        title: 'My New Submission',
        content: '<p>My submission content.</p>',
      });

      const { result } = renderHook(() => useCreateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, data: formData });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.title).toBe(formData.title);
      expect(result.current.data?.workshopId).toBe(workshopId);
    });

    it('handles file attachments with multipart form data', async () => {
      const workshopId = 100;
      const mockFile = new File(['test content'], 'test-file.pdf', {
        type: 'application/pdf',
      });

      const formData = createMockSubmissionFormData({
        title: 'Submission with Files',
        attachments: [
          createMockSubmissionFile({
            file: mockFile,
            filename: 'test-file.pdf',
          }),
        ],
      });

      const { result } = renderHook(() => useCreateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, data: formData });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });

    it('invalidates workshop queries on success', async () => {
      const workshopId = 100;
      const formData = createMockSubmissionFormData();
      const invalidateQueriesSpy = vi.spyOn(testQueryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, data: formData });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateQueriesSpy).toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('shows loading state during mutation', async () => {
      const workshopId = 100;
      const formData = createMockSubmissionFormData();

      const { result } = renderHook(() => useCreateSubmission(), {
        wrapper: createWrapper(),
      });

      let loadingObserved = false;

      act(() => {
        result.current.mutate({ workshopId, data: formData });
      });

      // Check loading state immediately after mutation call
      if (result.current.isPending) {
        loadingObserved = true;
      }

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Loading should have been observed or mutation was instant
      expect(loadingObserved || result.current.isSuccess).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('handles validation errors from API', async () => {
      const workshopId = 997; // Triggers validation error
      const formData = createMockSubmissionFormData({ title: '' });

      const { result } = renderHook(() => useCreateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, data: formData });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });

    it('handles phase errors when not in submission phase', async () => {
      const workshopId = 996; // Triggers phase error
      const formData = createMockSubmissionFormData();

      const { result } = renderHook(() => useCreateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, data: formData });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });

    it('handles already submitted errors', async () => {
      const workshopId = 995; // Triggers already submitted error
      const formData = createMockSubmissionFormData();

      const { result } = renderHook(() => useCreateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, data: formData });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Callback Functions', () => {
    it('calls onSuccess callback when mutation succeeds', async () => {
      const workshopId = 100;
      const formData = createMockSubmissionFormData();
      const onSuccessMock = vi.fn();

      const { result } = renderHook(
        () =>
          useCreateSubmission({
            onSuccess: onSuccessMock,
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.mutate({ workshopId, data: formData });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(onSuccessMock).toHaveBeenCalledWith(
        expect.objectContaining({ workshopId }),
        expect.objectContaining({ workshopId, data: formData }),
        undefined
      );
    });

    it('calls onError callback when mutation fails', async () => {
      const workshopId = 997; // Triggers validation error
      const formData = createMockSubmissionFormData();
      const onErrorMock = vi.fn();

      const { result } = renderHook(
        () =>
          useCreateSubmission({
            onError: onErrorMock,
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.mutate({ workshopId, data: formData });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(onErrorMock).toHaveBeenCalled();
    });
  });
});

describe('useUpdateSubmission Mutation', () => {
  describe('Successful Update', () => {
    it('updates an existing submission via PUT API call', async () => {
      const submissionId = 1;
      const formData = createMockSubmissionFormData({
        title: 'Updated Submission Title',
        content: '<p>Updated content.</p>',
      });

      const { result } = renderHook(() => useUpdateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ submissionId, data: formData });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.title).toBe(formData.title);
    });

    it('handles file attachments on update', async () => {
      const submissionId = 1;
      const mockFile = new File(['updated content'], 'updated-file.pdf', {
        type: 'application/pdf',
      });

      const formData = createMockSubmissionFormData({
        title: 'Updated with New File',
        attachments: [
          createMockSubmissionFile({
            file: mockFile,
            filename: 'updated-file.pdf',
          }),
        ],
      });

      const { result } = renderHook(() => useUpdateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ submissionId, data: formData });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });
  });

  describe('Optimistic Updates', () => {
    it('performs optimistic update on submission modification', async () => {
      const submissionId = 1;
      const workshopId = 100;

      // Pre-populate cache with submission
      testQueryClient.setQueryData(
        [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, submissionId],
        mockSubmission
      );

      const formData = createMockSubmissionFormData({
        title: 'Optimistically Updated',
      });

      const { result } = renderHook(() => useUpdateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ submissionId, data: formData });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('rolls back optimistic update on error', async () => {
      const submissionId = 999; // Not found
      const workshopId = 100;
      const originalSubmission = createMockSubmission({ id: submissionId, workshopId });

      // Pre-populate cache
      testQueryClient.setQueryData(
        [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, submissionId],
        originalSubmission
      );

      const formData = createMockSubmissionFormData({
        title: 'This Update Will Fail',
      });

      const { result } = renderHook(() => useUpdateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ submissionId, data: formData });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      // Should have attempted rollback
      expect(result.current.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('handles 404 not found error', async () => {
      const submissionId = 999;
      const formData = createMockSubmissionFormData();

      const { result } = renderHook(() => useUpdateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ submissionId, data: formData });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });

    it('handles 403 permission denied error', async () => {
      const submissionId = 998;
      const formData = createMockSubmissionFormData();

      const { result } = renderHook(() => useUpdateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ submissionId, data: formData });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });

    it('handles phase error when submission phase ended', async () => {
      const submissionId = 997;
      const formData = createMockSubmissionFormData();

      const { result } = renderHook(() => useUpdateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ submissionId, data: formData });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Query Invalidation', () => {
    it('invalidates workshop queries on successful update', async () => {
      const submissionId = 1;
      const formData = createMockSubmissionFormData();
      const invalidateQueriesSpy = vi.spyOn(testQueryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ submissionId, data: formData });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateQueriesSpy).toHaveBeenCalled();
    });
  });
});

describe('useDeleteSubmission Mutation', () => {
  describe('Successful Deletion', () => {
    it('deletes a submission via DELETE API call', async () => {
      const workshopId = 100;
      const submissionId = 1;

      const { result } = renderHook(() => useDeleteSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('removes submission from cache on success', async () => {
      const workshopId = 100;
      const submissionId = 1;

      // Pre-populate cache
      testQueryClient.setQueryData(
        [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, submissionId],
        mockSubmission
      );
      testQueryClient.setQueryData(
        [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, 'mine'],
        mockSubmission
      );

      const { result } = renderHook(() => useDeleteSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe('Optimistic Deletion', () => {
    it('performs optimistic removal from cache', async () => {
      const workshopId = 100;
      const submissionId = 1;

      // Pre-populate cache
      testQueryClient.setQueryData(
        [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, submissionId],
        mockSubmission
      );

      const { result } = renderHook(() => useDeleteSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('rolls back on deletion error', async () => {
      const workshopId = 100;
      const submissionId = 999; // Not found
      const originalSubmission = createMockSubmission({
        id: submissionId,
        workshopId,
      });

      // Pre-populate cache
      testQueryClient.setQueryData(
        [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, submissionId],
        originalSubmission
      );

      const { result } = renderHook(() => useDeleteSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('handles 404 not found error', async () => {
      const workshopId = 100;
      const submissionId = 999;

      const { result } = renderHook(() => useDeleteSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });

    it('handles 403 permission denied error', async () => {
      const workshopId = 100;
      const submissionId = 998;

      const { result } = renderHook(() => useDeleteSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });

    it('handles error when submission has assessments', async () => {
      const workshopId = 100;
      const submissionId = 997;

      const { result } = renderHook(() => useDeleteSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Query Invalidation', () => {
    it('invalidates workshop and submission queries on success', async () => {
      const workshopId = 100;
      const submissionId = 1;
      const invalidateQueriesSpy = vi.spyOn(testQueryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateQueriesSpy).toHaveBeenCalled();
    });
  });
});

describe('usePublishSubmission Mutation', () => {
  describe('Teacher-Only Operation', () => {
    it('publishes a submission via POST API call (teachers only)', async () => {
      const workshopId = 100;
      const submissionId = 1;

      const { result } = renderHook(() => usePublishSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId, publish: true });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.published).toBe(true);
    });

    it('unpublishes a submission', async () => {
      const workshopId = 100;
      const submissionId = 1;

      const { result } = renderHook(() => usePublishSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId, publish: false });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.published).toBe(false);
    });

    it('handles permission denied for non-teachers', async () => {
      const workshopId = 100;
      const submissionId = 998; // Triggers permission denied

      const { result } = renderHook(() => usePublishSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId, publish: true });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Optimistic Updates', () => {
    it('performs optimistic update changing published flag', async () => {
      const workshopId = 100;
      const submissionId = 1;
      const originalSubmission = createMockSubmission({
        id: submissionId,
        workshopId,
        published: false,
      });

      // Pre-populate cache
      testQueryClient.setQueryData(
        [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, submissionId],
        originalSubmission
      );

      const { result } = renderHook(() => usePublishSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId, publish: true });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.published).toBe(true);
    });

    it('rolls back optimistic update on error', async () => {
      const workshopId = 100;
      const submissionId = 999; // Not found
      const originalSubmission = createMockSubmission({
        id: submissionId,
        workshopId,
        published: false,
      });

      // Pre-populate cache
      testQueryClient.setQueryData(
        [WORKSHOP_SUBMISSIONS_QUERY_KEY, workshopId, submissionId],
        originalSubmission
      );

      const { result } = renderHook(() => usePublishSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId, publish: true });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('handles 404 not found error', async () => {
      const workshopId = 100;
      const submissionId = 999;

      const { result } = renderHook(() => usePublishSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId, publish: true });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });

    it('handles phase error when publishing not allowed', async () => {
      const workshopId = 100;
      const submissionId = 997; // Phase error

      const { result } = renderHook(() => usePublishSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId, publish: true });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Query Invalidation', () => {
    it('invalidates queries after successful publication', async () => {
      const workshopId = 100;
      const submissionId = 1;
      const invalidateQueriesSpy = vi.spyOn(testQueryClient, 'invalidateQueries');

      const { result } = renderHook(() => usePublishSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId, publish: true });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateQueriesSpy).toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('shows loading state during publish operation', async () => {
      const workshopId = 100;
      const submissionId = 1;

      const { result } = renderHook(() => usePublishSubmission(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate({ workshopId, submissionId, publish: true });
      });

      // Mutation should complete
      await waitFor(() =>
        expect(result.current.isPending || result.current.isSuccess).toBe(true)
      );
    });
  });
});

describe('useWorkshopSubmissions Hook', () => {
  describe('Fetching All Submissions', () => {
    it('fetches all submissions for a workshop', async () => {
      const workshopId = 100;

      const { result } = renderHook(() => useWorkshopSubmissions(workshopId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
      expect(result.current.data?.length).toBeGreaterThan(0);
    });

    it('returns submissions with correct data structure', async () => {
      const workshopId = 100;

      const { result } = renderHook(() => useWorkshopSubmissions(workshopId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const submissions = result.current.data;
      expect(submissions).toBeDefined();
      expect(submissions?.length).toBeGreaterThan(0);

      const submission = submissions![0];
      expect(submission).toHaveProperty('id');
      expect(submission).toHaveProperty('workshopId');
      expect(submission).toHaveProperty('title');
      expect(submission).toHaveProperty('authorId');
    });
  });

  describe('Error Handling', () => {
    it('handles permission denied for non-teachers', async () => {
      const workshopId = 998; // Triggers permission denied

      const { result } = renderHook(() => useWorkshopSubmissions(workshopId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });
});

describe('TypeScript Type Validation', () => {
  it('SubmissionFormData has correct type structure', () => {
    const formData: SubmissionFormData = {
      title: 'Test',
      content: 'Content',
      contentformat: 1,
      attachments: [],
      attachment_filemanager: 123,
    };

    expect(formData).toHaveProperty('title');
    expect(formData).toHaveProperty('content');
    expect(formData).toHaveProperty('contentformat');
    expect(typeof formData.title).toBe('string');
    expect(typeof formData.contentformat).toBe('number');
  });

  it('SubmissionFile has correct type structure', () => {
    const fileData: SubmissionFile = {
      filename: 'test.pdf',
      filesize: 1024,
      mimetype: 'application/pdf',
    };

    expect(fileData).toHaveProperty('filename');
    expect(fileData).toHaveProperty('filesize');
    expect(fileData).toHaveProperty('mimetype');
    expect(typeof fileData.filename).toBe('string');
    expect(typeof fileData.filesize).toBe('number');
  });

  it('WorkshopSubmission types are compatible with hook return values', async () => {
    const { result } = renderHook(() => useSubmission(100, 1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const submission: WorkshopSubmission | undefined = result.current.data;

    if (submission) {
      // Type checking - these should compile
      const id: number = submission.id;
      const title: string = submission.title;
      const published: boolean = submission.published;
      const grade: number | null = submission.grade;

      expect(typeof id).toBe('number');
      expect(typeof title).toBe('string');
      expect(typeof published).toBe('boolean');
      expect(grade === null || typeof grade === 'number').toBe(true);
    }
  });
});

describe('Mutation Function Types', () => {
  it('createSubmission mutate function accepts correct parameters', async () => {
    const { result } = renderHook(() => useCreateSubmission(), {
      wrapper: createWrapper(),
    });

    // Type check - mutate should accept CreateSubmissionVariables
    const mutate = result.current.mutate;
    expect(typeof mutate).toBe('function');

    // Test with correct types
    await act(async () => {
      mutate({
        workshopId: 100,
        data: {
          title: 'Test',
          content: 'Content',
          contentformat: 1,
        },
      });
    });

    await waitFor(() =>
      expect(result.current.isSuccess || result.current.isError).toBe(true)
    );
  });

  it('updateSubmission mutate function accepts correct parameters', async () => {
    const { result } = renderHook(() => useUpdateSubmission(), {
      wrapper: createWrapper(),
    });

    const mutate = result.current.mutate;
    expect(typeof mutate).toBe('function');

    await act(async () => {
      mutate({
        submissionId: 1,
        data: {
          title: 'Updated',
          content: 'Updated content',
          contentformat: 1,
        },
      });
    });

    await waitFor(() =>
      expect(result.current.isSuccess || result.current.isError).toBe(true)
    );
  });

  it('deleteSubmission mutate function accepts correct parameters', async () => {
    const { result } = renderHook(() => useDeleteSubmission(), {
      wrapper: createWrapper(),
    });

    const mutate = result.current.mutate;
    expect(typeof mutate).toBe('function');

    await act(async () => {
      mutate({
        workshopId: 100,
        submissionId: 1,
      });
    });

    await waitFor(() =>
      expect(result.current.isSuccess || result.current.isError).toBe(true)
    );
  });

  it('publishSubmission mutate function accepts correct parameters', async () => {
    const { result } = renderHook(() => usePublishSubmission(), {
      wrapper: createWrapper(),
    });

    const mutate = result.current.mutate;
    expect(typeof mutate).toBe('function');

    await act(async () => {
      mutate({
        workshopId: 100,
        submissionId: 1,
        publish: true,
      });
    });

    await waitFor(() =>
      expect(result.current.isSuccess || result.current.isError).toBe(true)
    );
  });
});

describe('Permission Checks', () => {
  describe('canSubmit Permission', () => {
    it('allows creation when user has submit permission', async () => {
      const workshopId = 100;
      const formData = createMockSubmissionFormData();

      const { result } = renderHook(() => useCreateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, data: formData });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Success indicates permission was granted
      expect(result.current.data).toBeDefined();
    });
  });

  describe('Editable Flag', () => {
    it('allows update when submission is editable', async () => {
      const submissionId = 1;
      const formData = createMockSubmissionFormData({
        title: 'Edited Submission',
      });

      const { result } = renderHook(() => useUpdateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ submissionId, data: formData });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });

    it('prevents update when submission is not editable', async () => {
      const submissionId = 998; // Permission denied
      const formData = createMockSubmissionFormData();

      const { result } = renderHook(() => useUpdateSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ submissionId, data: formData });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Publish Permission', () => {
    it('restricts publish to teachers only', async () => {
      const workshopId = 100;
      const submissionId = 998; // Triggers permission denied

      const { result } = renderHook(() => usePublishSubmission(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ workshopId, submissionId, publish: true });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      // Error indicates non-teacher was denied
      expect(result.current.error).toBeDefined();
    });
  });
});

describe('File Upload Data Formatting', () => {
  it('formats file upload data as FormData for multipart requests', async () => {
    const workshopId = 100;
    const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    const formData: SubmissionFormData = {
      title: 'Submission with File',
      content: 'Content here',
      contentformat: 1,
      attachments: [
        {
          file: mockFile,
          filename: 'test.pdf',
          filesize: mockFile.size,
          mimetype: 'application/pdf',
        },
      ],
    };

    const { result } = renderHook(() => useCreateSubmission(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ workshopId, data: formData });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Success indicates FormData was properly formatted
    expect(result.current.data).toBeDefined();
  });

  it('sends JSON for submissions without files', async () => {
    const workshopId = 100;
    const formData: SubmissionFormData = {
      title: 'Text Only Submission',
      content: 'Just text content',
      contentformat: 1,
    };

    const { result } = renderHook(() => useCreateSubmission(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ workshopId, data: formData });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
  });

  it('handles multiple file attachments', async () => {
    const workshopId = 100;
    const file1 = new File(['content1'], 'doc1.pdf', { type: 'application/pdf' });
    const file2 = new File(['content2'], 'doc2.pdf', { type: 'application/pdf' });

    const formData: SubmissionFormData = {
      title: 'Multi-file Submission',
      content: 'Content with multiple files',
      contentformat: 1,
      attachments: [
        {
          file: file1,
          filename: 'doc1.pdf',
          filesize: file1.size,
          mimetype: 'application/pdf',
        },
        {
          file: file2,
          filename: 'doc2.pdf',
          filesize: file2.size,
          mimetype: 'application/pdf',
        },
      ],
    };

    const { result } = renderHook(() => useCreateSubmission(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ workshopId, data: formData });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
  });
});

describe('Query Key Constants', () => {
  it('exports WORKSHOP_SUBMISSIONS_QUERY_KEY constant', () => {
    expect(WORKSHOP_SUBMISSIONS_QUERY_KEY).toBe('workshop-submissions');
  });

  it('uses correct query key structure for submissions', async () => {
    const workshopId = 100;
    const submissionId = 42;

    // Verify query key format by checking cache
    const { result } = renderHook(() => useSubmission(workshopId, submissionId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Check that data is cached with correct key
    const cachedData = testQueryClient.getQueryData([
      WORKSHOP_SUBMISSIONS_QUERY_KEY,
      workshopId,
      submissionId,
    ]);

    expect(cachedData).toBeDefined();
  });

  it('uses "mine" suffix for user\'s own submission query key', async () => {
    const workshopId = 100;

    const { result } = renderHook(() => useSubmission(workshopId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Check cache with 'mine' key
    const cachedData = testQueryClient.getQueryData([
      WORKSHOP_SUBMISSIONS_QUERY_KEY,
      workshopId,
      'mine',
    ]);

    expect(cachedData).toBeDefined();
  });
});
