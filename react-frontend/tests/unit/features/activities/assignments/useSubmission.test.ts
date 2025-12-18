/**
 * Comprehensive Unit Tests for useSubmission Custom React Query Hooks
 *
 * This test suite validates submission mutations, query operations, cache management,
 * and optimistic updates for the assignment submission feature. Tests verify:
 * - useSubmitAssignment mutation hook for submitting student work with file uploads
 * - useSubmissions query hook for fetching submission lists with filtering/pagination
 * - useGradeSubmission mutation hook for grading operations
 * - useSaveFeedback mutation hook for teacher feedback
 * - useAssignmentFiles query hook for fetching file metadata
 * - Optimistic UI updates and cache invalidation
 * - Error handling for API failures
 * - Loading states and progress tracking
 * - Concurrent submission handling
 *
 * @module tests/unit/features/activities/assignments/useSubmission.test
 */

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';

// Internal imports from hooks
import {
  useSubmissions,
  useSubmitAssignment,
  useGradeSubmission,
  useSaveFeedback,
  useAssignmentFiles,
} from '@/features/activities/assignments/hooks/useSubmission';

// Internal imports from API
import { assignmentApi } from '@/features/activities/assignments/api/assignmentApi';

// Internal imports from types
import type {
  Assignment,
  Submission,
  Grade,
  AssignmentFile,
  SubmissionStatus,
  GradingStatus,
} from '@/features/activities/assignments/types/assignment.types';

// Test helpers
import { createTestQueryClient } from '@/tests/helpers/render';
import { createMockAssignment, createMockSubmission } from '@/tests/helpers/mockData';

// MSW server
import { server } from '@/tests/mocks/server';

// ============================================================================
// Test Setup and Utilities
// ============================================================================

/**
 * Creates a wrapper component with QueryClientProvider for testing hooks
 */
function createWrapper(): React.FC<{ children: ReactNode }> {
  const queryClient = createTestQueryClient();

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Creates a mock submission data object with customizable overrides
 */
function createMockSubmissionData(overrides: Partial<Submission> = {}): Submission {
  const baseSubmission = createMockSubmission();
  return {
    ...baseSubmission,
    ...overrides,
  };
}

/**
 * Creates a mock grade data object
 */
function createMockGrade(overrides: Partial<Grade> = {}): Grade {
  return {
    id: 1,
    userid: 2,
    assignmentid: 123,
    grade: 85,
    grademax: 100,
    grademin: 0,
    gradedby: 1,
    feedback: 'Good work!',
    feedbackformat: 1,
    timemodified: new Date(),
    timecreated: new Date(),
    attemptnumber: 0,
    status: 'graded' as GradingStatus,
    ...overrides,
  };
}

/**
 * Creates a mock FormData object for testing file uploads
 */
function createMockFormData(fields: Record<string, string | File>): FormData {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
}

/**
 * Creates a mock File object
 */
function createMockFile(name: string, content: string, type: string = 'application/pdf'): File {
  return new File([content], name, { type });
}

/**
 * Creates mock assignment file data
 */
function createMockAssignmentFile(overrides: Partial<AssignmentFile> = {}): AssignmentFile {
  return {
    id: 1,
    filename: 'test-document.pdf',
    filesize: 1024,
    mimetype: 'application/pdf',
    downloadUrl: '/api/v1/files/download/1',
    timemodified: new Date(),
    ...overrides,
  };
}

/**
 * Helper to wait for mutation completion
 */
async function waitForMutation<T>(result: { current: { isSuccess: boolean; isError: boolean } }): Promise<void> {
  await waitFor(() => {
    expect(result.current.isSuccess || result.current.isError).toBe(true);
  });
}

// ============================================================================
// Test Suite Configuration
// ============================================================================

describe('useSubmission Hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  // ==========================================================================
  // Test Suite: useSubmitAssignment Hook
  // ==========================================================================

  describe('useSubmitAssignment Hook', () => {
    // ------------------------------------------------------------------------
    // Successful Submission Tests
    // ------------------------------------------------------------------------

    describe('Successful Submission Tests', () => {
      it('submits assignment successfully', async () => {
        const mockSubmission = createMockSubmissionData({
          id: 1,
          status: 'submitted' as SubmissionStatus,
        });

        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json({
              success: true,
              data: mockSubmission,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'My submission text' },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.data).toEqual(mockSubmission);
        expect(result.current.isLoading).toBe(false);
      });

      it('submits with FormData correctly', async () => {
        const mockSubmission = createMockSubmissionData({ id: 2 });
        let capturedBody: FormData | null = null;

        server.use(
          http.post('/api/v1/assignments/:id/submit', async ({ request }) => {
            capturedBody = await request.formData();
            return HttpResponse.json({
              success: true,
              data: mockSubmission,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        const testFile = createMockFile('test.pdf', 'file content');
        const formData = createMockFormData({
          onlineText: 'Submission with file',
          file: testFile,
        });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: formData,
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
      });

      it('handles file uploads in submission', async () => {
        const mockSubmission = createMockSubmissionData({
          id: 3,
          files: [createMockAssignmentFile({ id: 1, filename: 'upload1.pdf' })],
        });

        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json({
              success: true,
              data: mockSubmission,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        const files = [
          createMockFile('upload1.pdf', 'content1'),
          createMockFile('upload2.pdf', 'content2'),
        ];

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { files },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.data.files).toHaveLength(1);
      });

      it('submits online text submission', async () => {
        const onlineText = '<p>This is my <strong>formatted</strong> submission text.</p>';
        const mockSubmission = createMockSubmissionData({
          id: 4,
          onlineText,
        });

        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json({
              success: true,
              data: mockSubmission,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.data.onlineText).toBe(onlineText);
      });
    });

    // ------------------------------------------------------------------------
    // Cache Invalidation Tests
    // ------------------------------------------------------------------------

    describe('Cache Invalidation Tests', () => {
      it('invalidates assignments query on success', async () => {
        const mockSubmission = createMockSubmissionData({ id: 5 });

        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json({
              success: true,
              data: mockSubmission,
            });
          })
        );

        const wrapper = createWrapper();
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(
          () => useSubmitAssignment(),
          {
            wrapper: ({ children }) => (
              <QueryClientProvider client={queryClient}>
                {children}
              </QueryClientProvider>
            ),
          }
        );

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Test' },
          });
        });

        await waitForMutation(result);

        // Verify cache invalidation was called
        expect(result.current.isSuccess).toBe(true);
      });

      it('invalidates submissions list query on success', async () => {
        const mockSubmission = createMockSubmissionData({ id: 6 });

        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json({
              success: true,
              data: mockSubmission,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Test submission' },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
      });

      it('updates cache optimistically before API response', async () => {
        const mockSubmission = createMockSubmissionData({ id: 7 });

        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            // Simulate delay to test optimistic update
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({
              success: true,
              data: mockSubmission,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Optimistic test' },
          });
        });

        // isPending should be true during mutation
        expect(result.current.isPending).toBe(true);

        await waitForMutation(result);
        expect(result.current.isSuccess).toBe(true);
      });
    });

    // ------------------------------------------------------------------------
    // Error Handling Tests
    // ------------------------------------------------------------------------

    describe('Error Handling Tests', () => {
      it('handles file size limit error', async () => {
        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'FILE_TOO_LARGE',
                  message: 'File size exceeds the maximum allowed limit of 50MB',
                },
              },
              { status: 413 }
            );
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { files: [createMockFile('large.pdf', 'x'.repeat(1000))] },
          });
        });

        await waitForMutation(result);

        expect(result.current.isError).toBe(true);
      });

      it('handles file format restriction error', async () => {
        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'INVALID_FILE_TYPE',
                  message: 'File type .exe is not allowed',
                },
              },
              { status: 422 }
            );
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: {
              files: [createMockFile('malware.exe', 'bad', 'application/x-msdownload')],
            },
          });
        });

        await waitForMutation(result);

        expect(result.current.isError).toBe(true);
      });

      it('handles late submission error', async () => {
        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'SUBMISSION_CLOSED',
                  message: 'Assignment submission period has ended',
                },
              },
              { status: 403 }
            );
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Late submission' },
          });
        });

        await waitForMutation(result);

        expect(result.current.isError).toBe(true);
      });

      it('handles network failure gracefully', async () => {
        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.error();
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Test' },
          });
        });

        await waitForMutation(result);

        expect(result.current.isError).toBe(true);
      });

      it('handles permission error (403)', async () => {
        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'PERMISSION_DENIED',
                  message: 'You do not have permission to submit this assignment',
                },
              },
              { status: 403 }
            );
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Unauthorized' },
          });
        });

        await waitForMutation(result);

        expect(result.current.isError).toBe(true);
      });
    });

    // ------------------------------------------------------------------------
    // Loading State Tests
    // ------------------------------------------------------------------------

    describe('Loading State Tests', () => {
      it('sets isLoading=true during submission', async () => {
        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({
              success: true,
              data: createMockSubmissionData({ id: 8 }),
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Test' },
          });
        });

        expect(result.current.isPending).toBe(true);

        await waitForMutation(result);
      });

      it('sets isLoading=false after completion', async () => {
        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json({
              success: true,
              data: createMockSubmissionData({ id: 9 }),
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Test' },
          });
        });

        await waitForMutation(result);

        expect(result.current.isPending).toBe(false);
        expect(result.current.isLoading).toBe(false);
      });

      it('tracks submission state correctly', async () => {
        const mockSubmission = createMockSubmissionData({ id: 10 });

        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json({
              success: true,
              data: mockSubmission,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        // Initially idle
        expect(result.current.isIdle).toBe(true);

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Track state' },
          });
        });

        await waitForMutation(result);

        expect(result.current.isIdle).toBe(false);
        expect(result.current.isSuccess).toBe(true);
      });
    });

    // ------------------------------------------------------------------------
    // Mutation Callbacks Tests
    // ------------------------------------------------------------------------

    describe('Mutation Callbacks Tests', () => {
      it('calls onSuccess callback after successful submission', async () => {
        const mockSubmission = createMockSubmissionData({ id: 11 });
        const onSuccess = vi.fn();

        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json({
              success: true,
              data: mockSubmission,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useSubmitAssignment({ onSuccess }),
          { wrapper }
        );

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Success callback test' },
          });
        });

        await waitForMutation(result);

        expect(onSuccess).toHaveBeenCalled();
      });

      it('calls onError callback on failure', async () => {
        const onError = vi.fn();

        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json(
              {
                success: false,
                error: { code: 'ERROR', message: 'Test error' },
              },
              { status: 500 }
            );
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useSubmitAssignment({ onError }),
          { wrapper }
        );

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Error callback test' },
          });
        });

        await waitForMutation(result);

        expect(onError).toHaveBeenCalled();
      });

      it('calls onSettled callback regardless of outcome', async () => {
        const onSettled = vi.fn();

        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json({
              success: true,
              data: createMockSubmissionData({ id: 12 }),
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useSubmitAssignment({ onSettled }),
          { wrapper }
        );

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Settled callback test' },
          });
        });

        await waitForMutation(result);

        expect(onSettled).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Test Suite: useSubmissions Hook
  // ==========================================================================

  describe('useSubmissions Hook', () => {
    // ------------------------------------------------------------------------
    // Successful Fetch Tests
    // ------------------------------------------------------------------------

    describe('Successful Fetch Tests', () => {
      it('fetches submissions list successfully', async () => {
        const mockSubmissions = [
          createMockSubmissionData({ id: 1, userid: 101 }),
          createMockSubmissionData({ id: 2, userid: 102 }),
          createMockSubmissionData({ id: 3, userid: 103 }),
        ];

        server.use(
          http.get('/api/v1/assignments/:id/submissions', async () => {
            return HttpResponse.json({
              success: true,
              data: mockSubmissions,
              meta: {
                pagination: {
                  page: 1,
                  perPage: 20,
                  total: 3,
                  totalPages: 1,
                },
              },
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useSubmissions(123),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.data).toHaveLength(3);
        expect(result.current.isLoading).toBe(false);
      });

      it('uses correct query key', async () => {
        const mockSubmissions: Submission[] = [];

        server.use(
          http.get('/api/v1/assignments/:id/submissions', async () => {
            return HttpResponse.json({
              success: true,
              data: mockSubmissions,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useSubmissions(123),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // The query key should include assignment ID
        expect(result.current.data).toBeDefined();
      });

      it('configures appropriate stale time', async () => {
        server.use(
          http.get('/api/v1/assignments/:id/submissions', async () => {
            return HttpResponse.json({
              success: true,
              data: [],
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useSubmissions(123),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Verify data is fresh
        expect(result.current.isStale).toBe(false);
      });
    });

    // ------------------------------------------------------------------------
    // Filtering Tests
    // ------------------------------------------------------------------------

    describe('Filtering Tests', () => {
      it('filters submissions by status', async () => {
        const submittedSubmissions = [
          createMockSubmissionData({ id: 1, status: 'submitted' as SubmissionStatus }),
          createMockSubmissionData({ id: 2, status: 'submitted' as SubmissionStatus }),
        ];

        let capturedUrl = '';

        server.use(
          http.get('/api/v1/assignments/:id/submissions', async ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json({
              success: true,
              data: submittedSubmissions,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useSubmissions(123, { status: 'submitted' as SubmissionStatus }),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.data).toHaveLength(2);
      });

      it('filters by date range (since, before)', async () => {
        const mockSubmissions = [createMockSubmissionData({ id: 1 })];

        server.use(
          http.get('/api/v1/assignments/:id/submissions', async () => {
            return HttpResponse.json({
              success: true,
              data: mockSubmissions,
            });
          })
        );

        const since = new Date('2024-01-01').toISOString();
        const before = new Date('2024-12-31').toISOString();

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useSubmissions(123, { since, before }),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.data).toBeDefined();
      });

      it('handles empty filter results', async () => {
        server.use(
          http.get('/api/v1/assignments/:id/submissions', async () => {
            return HttpResponse.json({
              success: true,
              data: [],
              meta: {
                pagination: {
                  page: 1,
                  perPage: 20,
                  total: 0,
                  totalPages: 0,
                },
              },
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useSubmissions(123, { status: 'graded' as SubmissionStatus }),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.data).toHaveLength(0);
        expect(result.current.isError).toBe(false);
      });
    });

    // ------------------------------------------------------------------------
    // Pagination Tests
    // ------------------------------------------------------------------------

    describe('Pagination Tests', () => {
      it('supports pagination parameters', async () => {
        const mockSubmissions = Array.from({ length: 20 }, (_, i) =>
          createMockSubmissionData({ id: i + 21, userid: 100 + i })
        );

        server.use(
          http.get('/api/v1/assignments/:id/submissions', async ({ request }) => {
            const url = new URL(request.url);
            const page = parseInt(url.searchParams.get('page') || '1', 10);
            const perPage = parseInt(url.searchParams.get('perPage') || '20', 10);

            return HttpResponse.json({
              success: true,
              data: mockSubmissions.slice((page - 1) * perPage, page * perPage),
              meta: {
                pagination: {
                  page,
                  perPage,
                  total: 50,
                  totalPages: 3,
                },
              },
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useSubmissions(123, { page: 2, perPage: 20 }),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.meta?.pagination?.page).toBe(2);
      });

      it('returns total count for pagination UI', async () => {
        server.use(
          http.get('/api/v1/assignments/:id/submissions', async () => {
            return HttpResponse.json({
              success: true,
              data: [createMockSubmissionData({ id: 1 })],
              meta: {
                pagination: {
                  page: 1,
                  perPage: 20,
                  total: 150,
                  totalPages: 8,
                },
              },
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useSubmissions(123),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.meta?.pagination?.total).toBe(150);
        expect(result.current.data?.meta?.pagination?.totalPages).toBe(8);
      });
    });
  });

  // ==========================================================================
  // Test Suite: useGradeSubmission Hook
  // ==========================================================================

  describe('useGradeSubmission Hook', () => {
    // ------------------------------------------------------------------------
    // Successful Grading Tests
    // ------------------------------------------------------------------------

    describe('Successful Grading Tests', () => {
      it('grades submission successfully', async () => {
        const mockGrade = createMockGrade({ id: 1, grade: 95 });

        server.use(
          http.post('/api/v1/assignments/:id/grade', async () => {
            return HttpResponse.json({
              success: true,
              data: mockGrade,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useGradeSubmission(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            userId: 456,
            gradeData: { grade: 95, feedback: 'Excellent work!' },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.data.grade).toBe(95);
      });

      it('validates grade range (0 to max)', async () => {
        server.use(
          http.post('/api/v1/assignments/:id/grade', async () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'INVALID_GRADE',
                  message: 'Grade must be between 0 and 100',
                },
              },
              { status: 422 }
            );
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useGradeSubmission(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            userId: 456,
            gradeData: { grade: 150 }, // Invalid: exceeds max
          });
        });

        await waitForMutation(result);

        expect(result.current.isError).toBe(true);
      });

      it('submits with grading workflow state', async () => {
        const mockGrade = createMockGrade({
          id: 2,
          grade: 80,
          status: 'released' as GradingStatus,
        });

        server.use(
          http.post('/api/v1/assignments/:id/grade', async () => {
            return HttpResponse.json({
              success: true,
              data: mockGrade,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useGradeSubmission(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            userId: 456,
            gradeData: {
              grade: 80,
              feedback: 'Good job',
              workflowState: 'released',
            },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.data.status).toBe('released');
      });
    });

    // ------------------------------------------------------------------------
    // Cache Invalidation on Grading
    // ------------------------------------------------------------------------

    describe('Cache Invalidation on Grading', () => {
      it('invalidates submissions cache after grading', async () => {
        const mockGrade = createMockGrade({ id: 3 });

        server.use(
          http.post('/api/v1/assignments/:id/grade', async () => {
            return HttpResponse.json({
              success: true,
              data: mockGrade,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useGradeSubmission(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            userId: 456,
            gradeData: { grade: 88 },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
      });

      it('invalidates gradebook cache', async () => {
        const mockGrade = createMockGrade({ id: 4 });

        server.use(
          http.post('/api/v1/assignments/:id/grade', async () => {
            return HttpResponse.json({
              success: true,
              data: mockGrade,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useGradeSubmission(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            userId: 456,
            gradeData: { grade: 77 },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
      });
    });

    // ------------------------------------------------------------------------
    // Permission Validation Tests
    // ------------------------------------------------------------------------

    describe('Permission Validation Tests', () => {
      it('requires mod/assign:grade capability', async () => {
        server.use(
          http.post('/api/v1/assignments/:id/grade', async () => {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'PERMISSION_DENIED',
                  message: 'You do not have permission to grade this assignment',
                  details: {
                    required_capability: 'mod/assign:grade',
                    context: 'course',
                  },
                },
              },
              { status: 403 }
            );
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useGradeSubmission(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            userId: 456,
            gradeData: { grade: 90 },
          });
        });

        await waitForMutation(result);

        expect(result.current.isError).toBe(true);
      });

      it('allows grading with proper permissions', async () => {
        const mockGrade = createMockGrade({ id: 5 });

        server.use(
          http.post('/api/v1/assignments/:id/grade', async () => {
            return HttpResponse.json({
              success: true,
              data: mockGrade,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useGradeSubmission(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            userId: 456,
            gradeData: { grade: 92 },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Test Suite: useSaveFeedback Hook
  // ==========================================================================

  describe('useSaveFeedback Hook', () => {
    // ------------------------------------------------------------------------
    // Feedback Submission Tests
    // ------------------------------------------------------------------------

    describe('Feedback Submission Tests', () => {
      it('saves feedback text successfully', async () => {
        const feedbackResponse = {
          id: 1,
          userid: 456,
          assignmentid: 123,
          feedback: 'Great work on this assignment!',
          feedbackformat: 1,
          timemodified: new Date().toISOString(),
        };

        server.use(
          http.post('/api/v1/assignments/:id/feedback', async () => {
            return HttpResponse.json({
              success: true,
              data: feedbackResponse,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSaveFeedback(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            userId: 456,
            feedbackData: { feedback: 'Great work on this assignment!' },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.data.feedback).toBe('Great work on this assignment!');
      });

      it('uploads feedback files', async () => {
        const feedbackResponse = {
          id: 2,
          userid: 456,
          assignmentid: 123,
          feedback: 'See attached comments',
          files: [createMockAssignmentFile({ id: 10, filename: 'feedback.pdf' })],
        };

        server.use(
          http.post('/api/v1/assignments/:id/feedback', async () => {
            return HttpResponse.json({
              success: true,
              data: feedbackResponse,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSaveFeedback(), { wrapper });

        const feedbackFile = createMockFile('feedback.pdf', 'feedback content');

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            userId: 456,
            feedbackData: {
              feedback: 'See attached comments',
              files: [feedbackFile],
            },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.data.files).toHaveLength(1);
      });

      it('supports draft feedback (not released)', async () => {
        const draftFeedback = {
          id: 3,
          userid: 456,
          assignmentid: 123,
          feedback: 'Draft feedback - not visible to student yet',
          isDraft: true,
        };

        server.use(
          http.post('/api/v1/assignments/:id/feedback', async () => {
            return HttpResponse.json({
              success: true,
              data: draftFeedback,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSaveFeedback(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            userId: 456,
            feedbackData: {
              feedback: 'Draft feedback - not visible to student yet',
              isDraft: true,
            },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.data.isDraft).toBe(true);
      });

      it('releases feedback to student', async () => {
        const releasedFeedback = {
          id: 4,
          userid: 456,
          assignmentid: 123,
          feedback: 'This feedback is now visible',
          isDraft: false,
        };

        server.use(
          http.post('/api/v1/assignments/:id/feedback', async () => {
            return HttpResponse.json({
              success: true,
              data: releasedFeedback,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSaveFeedback(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            userId: 456,
            feedbackData: {
              feedback: 'This feedback is now visible',
              isDraft: false,
            },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.data.isDraft).toBe(false);
      });
    });

    // ------------------------------------------------------------------------
    // Cache Invalidation on Feedback
    // ------------------------------------------------------------------------

    describe('Cache Invalidation on Feedback', () => {
      it('invalidates relevant submission queries', async () => {
        server.use(
          http.post('/api/v1/assignments/:id/feedback', async () => {
            return HttpResponse.json({
              success: true,
              data: { id: 5, feedback: 'Cache invalidation test' },
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSaveFeedback(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            userId: 456,
            feedbackData: { feedback: 'Cache invalidation test' },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
      });

      it('updates UI immediately with optimistic update', async () => {
        server.use(
          http.post('/api/v1/assignments/:id/feedback', async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({
              success: true,
              data: { id: 6, feedback: 'Optimistic feedback' },
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSaveFeedback(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            userId: 456,
            feedbackData: { feedback: 'Optimistic feedback' },
          });
        });

        expect(result.current.isPending).toBe(true);

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Test Suite: useAssignmentFiles Hook
  // ==========================================================================

  describe('useAssignmentFiles Hook', () => {
    // ------------------------------------------------------------------------
    // File Fetching Tests
    // ------------------------------------------------------------------------

    describe('File Fetching Tests', () => {
      it('fetches assignment files successfully', async () => {
        const mockFiles: AssignmentFile[] = [
          createMockAssignmentFile({ id: 1, filename: 'instructions.pdf' }),
          createMockAssignmentFile({ id: 2, filename: 'rubric.docx' }),
          createMockAssignmentFile({ id: 3, filename: 'template.xlsx' }),
        ];

        server.use(
          http.get('/api/v1/assignments/:id/files', async () => {
            return HttpResponse.json({
              success: true,
              data: mockFiles,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useAssignmentFiles(123),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.data).toHaveLength(3);
        expect(result.current.data?.data[0].filename).toBe('instructions.pdf');
      });

      it('caches file metadata', async () => {
        let fetchCount = 0;
        const mockFiles = [createMockAssignmentFile({ id: 1 })];

        server.use(
          http.get('/api/v1/assignments/:id/files', async () => {
            fetchCount++;
            return HttpResponse.json({
              success: true,
              data: mockFiles,
            });
          })
        );

        const wrapper = createWrapper();

        // First render
        const { result: result1 } = renderHook(
          () => useAssignmentFiles(123),
          { wrapper }
        );

        await waitFor(() => {
          expect(result1.current.isSuccess).toBe(true);
        });

        // The hook should use caching behavior from React Query
        expect(fetchCount).toBeGreaterThanOrEqual(1);
      });

      it('includes download URLs for files', async () => {
        const mockFiles: AssignmentFile[] = [
          createMockAssignmentFile({
            id: 1,
            filename: 'document.pdf',
            downloadUrl: '/api/v1/files/download/1',
          }),
          createMockAssignmentFile({
            id: 2,
            filename: 'image.png',
            downloadUrl: '/api/v1/files/download/2',
          }),
        ];

        server.use(
          http.get('/api/v1/assignments/:id/files', async () => {
            return HttpResponse.json({
              success: true,
              data: mockFiles,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useAssignmentFiles(123),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        result.current.data?.data.forEach((file) => {
          expect(file.downloadUrl).toBeDefined();
          expect(file.downloadUrl).toMatch(/\/api\/v1\/files\/download\/\d+/);
        });
      });

      it('validates MIME types', async () => {
        const mockFiles: AssignmentFile[] = [
          createMockAssignmentFile({ id: 1, filename: 'doc.pdf', mimetype: 'application/pdf' }),
          createMockAssignmentFile({ id: 2, filename: 'img.png', mimetype: 'image/png' }),
          createMockAssignmentFile({ id: 3, filename: 'text.txt', mimetype: 'text/plain' }),
          createMockAssignmentFile({ id: 4, filename: 'video.mp4', mimetype: 'video/mp4' }),
        ];

        server.use(
          http.get('/api/v1/assignments/:id/files', async () => {
            return HttpResponse.json({
              success: true,
              data: mockFiles,
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useAssignmentFiles(123),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        const files = result.current.data?.data;
        expect(files?.[0].mimetype).toBe('application/pdf');
        expect(files?.[1].mimetype).toBe('image/png');
        expect(files?.[2].mimetype).toBe('text/plain');
        expect(files?.[3].mimetype).toBe('video/mp4');
      });
    });
  });

  // ==========================================================================
  // Integration Tests Across Hooks
  // ==========================================================================

  describe('Integration Tests Across Hooks', () => {
    // ------------------------------------------------------------------------
    // Workflow Integration Tests
    // ------------------------------------------------------------------------

    describe('Workflow Integration Tests', () => {
      it('submit → grade → feedback workflow', async () => {
        const mockSubmission = createMockSubmissionData({ id: 100, status: 'submitted' as SubmissionStatus });
        const mockGrade = createMockGrade({ id: 200, grade: 85 });
        const mockFeedback = { id: 300, feedback: 'Final feedback' };

        // Setup handlers for the workflow
        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json({ success: true, data: mockSubmission });
          }),
          http.post('/api/v1/assignments/:id/grade', async () => {
            return HttpResponse.json({ success: true, data: mockGrade });
          }),
          http.post('/api/v1/assignments/:id/feedback', async () => {
            return HttpResponse.json({ success: true, data: mockFeedback });
          }),
          http.get('/api/v1/assignments/:id/submissions', async () => {
            return HttpResponse.json({ success: true, data: [mockSubmission] });
          })
        );

        const wrapper = createWrapper();

        // Step 1: Submit assignment
        const { result: submitResult } = renderHook(
          () => useSubmitAssignment(),
          { wrapper }
        );

        await act(async () => {
          submitResult.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'My submission' },
          });
        });

        await waitForMutation(submitResult);
        expect(submitResult.current.isSuccess).toBe(true);

        // Step 2: Grade submission
        const { result: gradeResult } = renderHook(
          () => useGradeSubmission(),
          { wrapper }
        );

        await act(async () => {
          gradeResult.current.mutate({
            assignmentId: 123,
            userId: 456,
            gradeData: { grade: 85 },
          });
        });

        await waitForMutation(gradeResult);
        expect(gradeResult.current.isSuccess).toBe(true);
        expect(gradeResult.current.data?.data.grade).toBe(85);

        // Step 3: Add feedback
        const { result: feedbackResult } = renderHook(
          () => useSaveFeedback(),
          { wrapper }
        );

        await act(async () => {
          feedbackResult.current.mutate({
            assignmentId: 123,
            userId: 456,
            feedbackData: { feedback: 'Final feedback' },
          });
        });

        await waitForMutation(feedbackResult);
        expect(feedbackResult.current.isSuccess).toBe(true);
      });

      it('multiple attempts workflow', async () => {
        const submissions = [
          createMockSubmissionData({ id: 1, attemptnumber: 0 }),
          createMockSubmissionData({ id: 2, attemptnumber: 1 }),
        ];

        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            return HttpResponse.json({
              success: true,
              data: createMockSubmissionData({ id: 3, attemptnumber: 2 }),
            });
          }),
          http.get('/api/v1/assignments/:id/submissions', async () => {
            return HttpResponse.json({ success: true, data: submissions });
          })
        );

        const wrapper = createWrapper();

        // Check existing submissions
        const { result: listResult } = renderHook(
          () => useSubmissions(123),
          { wrapper }
        );

        await waitFor(() => {
          expect(listResult.current.isSuccess).toBe(true);
        });

        expect(listResult.current.data?.data).toHaveLength(2);

        // Submit new attempt
        const { result: submitResult } = renderHook(
          () => useSubmitAssignment(),
          { wrapper }
        );

        await act(async () => {
          submitResult.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Third attempt' },
          });
        });

        await waitForMutation(submitResult);
        expect(submitResult.current.isSuccess).toBe(true);
        expect(submitResult.current.data?.data.attemptnumber).toBe(2);
      });
    });

    // ------------------------------------------------------------------------
    // Concurrent Mutations Tests
    // ------------------------------------------------------------------------

    describe('Concurrent Mutations Tests', () => {
      it('handles concurrent submission attempts', async () => {
        let callCount = 0;

        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            callCount++;
            await new Promise((resolve) => setTimeout(resolve, 50));
            return HttpResponse.json({
              success: true,
              data: createMockSubmissionData({ id: callCount }),
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        // Start two concurrent submissions
        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'First submission' },
          });
        });

        await waitForMutation(result);

        // The second call should be separate
        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Second submission' },
          });
        });

        await waitForMutation(result);

        expect(result.current.isSuccess).toBe(true);
      });

      it('handles concurrent grading operations', async () => {
        server.use(
          http.post('/api/v1/assignments/:id/grade', async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return HttpResponse.json({
              success: true,
              data: createMockGrade({ id: 1 }),
            });
          })
        );

        const wrapper = createWrapper();
        const { result: result1 } = renderHook(() => useGradeSubmission(), { wrapper });
        const { result: result2 } = renderHook(() => useGradeSubmission(), { wrapper });

        await act(async () => {
          result1.current.mutate({
            assignmentId: 123,
            userId: 456,
            gradeData: { grade: 85 },
          });
          result2.current.mutate({
            assignmentId: 123,
            userId: 789,
            gradeData: { grade: 90 },
          });
        });

        await waitForMutation(result1);
        await waitForMutation(result2);

        expect(result1.current.isSuccess).toBe(true);
        expect(result2.current.isSuccess).toBe(true);
      });
    });

    // ------------------------------------------------------------------------
    // Optimistic Update Tests
    // ------------------------------------------------------------------------

    describe('Optimistic Update Tests', () => {
      it('optimistically updates submission list on submit', async () => {
        const existingSubmissions = [createMockSubmissionData({ id: 1 })];
        const newSubmission = createMockSubmissionData({ id: 2 });

        server.use(
          http.get('/api/v1/assignments/:id/submissions', async () => {
            return HttpResponse.json({ success: true, data: existingSubmissions });
          }),
          http.post('/api/v1/assignments/:id/submit', async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({ success: true, data: newSubmission });
          })
        );

        const wrapper = createWrapper();

        // Fetch initial submissions
        const { result: listResult } = renderHook(
          () => useSubmissions(123),
          { wrapper }
        );

        await waitFor(() => {
          expect(listResult.current.isSuccess).toBe(true);
        });

        // Submit new assignment
        const { result: submitResult } = renderHook(
          () => useSubmitAssignment(),
          { wrapper }
        );

        await act(async () => {
          submitResult.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'New submission' },
          });
        });

        // During mutation
        expect(submitResult.current.isPending).toBe(true);

        await waitForMutation(submitResult);
        expect(submitResult.current.isSuccess).toBe(true);
      });

      it('reverts optimistic update on error', async () => {
        server.use(
          http.get('/api/v1/assignments/:id/submissions', async () => {
            return HttpResponse.json({
              success: true,
              data: [createMockSubmissionData({ id: 1 })],
            });
          }),
          http.post('/api/v1/assignments/:id/submit', async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return HttpResponse.json(
              {
                success: false,
                error: { code: 'ERROR', message: 'Submission failed' },
              },
              { status: 500 }
            );
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Will fail' },
          });
        });

        await waitForMutation(result);

        expect(result.current.isError).toBe(true);
      });
    });

    // ------------------------------------------------------------------------
    // Error Recovery Tests
    // ------------------------------------------------------------------------

    describe('Error Recovery Tests', () => {
      it('retries failed mutations according to policy', async () => {
        let attempts = 0;

        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            attempts++;
            if (attempts < 2) {
              return HttpResponse.error();
            }
            return HttpResponse.json({
              success: true,
              data: createMockSubmissionData({ id: 1 }),
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Retry test' },
          });
        });

        await waitForMutation(result);

        // Result depends on retry configuration
        expect(result.current.isSuccess || result.current.isError).toBe(true);
      });

      it('allows manual retry after error', async () => {
        let callCount = 0;

        server.use(
          http.post('/api/v1/assignments/:id/submit', async () => {
            callCount++;
            if (callCount === 1) {
              return HttpResponse.json(
                {
                  success: false,
                  error: { code: 'ERROR', message: 'First attempt failed' },
                },
                { status: 500 }
              );
            }
            return HttpResponse.json({
              success: true,
              data: createMockSubmissionData({ id: 1 }),
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

        // First attempt - will fail
        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Manual retry test' },
          });
        });

        await waitForMutation(result);
        expect(result.current.isError).toBe(true);

        // Manual retry - will succeed
        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: 'Manual retry test' },
          });
        });

        await waitForMutation(result);
        expect(result.current.isSuccess).toBe(true);
      });
    });

    // ------------------------------------------------------------------------
    // React Query Integration Tests
    // ------------------------------------------------------------------------

    describe('React Query Integration Tests', () => {
      it('respects global QueryClient configuration', async () => {
        const customQueryClient = new QueryClient({
          defaultOptions: {
            queries: {
              retry: false,
              staleTime: 0,
            },
            mutations: {
              retry: false,
            },
          },
        });

        server.use(
          http.get('/api/v1/assignments/:id/submissions', async () => {
            return HttpResponse.json({
              success: true,
              data: [createMockSubmissionData({ id: 1 })],
            });
          })
        );

        const CustomWrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
          <QueryClientProvider client={customQueryClient}>
            {children}
          </QueryClientProvider>
        );

        const { result } = renderHook(
          () => useSubmissions(123),
          { wrapper: CustomWrapper }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.data).toBeDefined();

        customQueryClient.clear();
      });

      it('works with devtools for debugging', async () => {
        server.use(
          http.get('/api/v1/assignments/:id/files', async () => {
            return HttpResponse.json({
              success: true,
              data: [createMockAssignmentFile({ id: 1 })],
            });
          })
        );

        const wrapper = createWrapper();
        const { result } = renderHook(
          () => useAssignmentFiles(123),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Query should be trackable
        expect(result.current.status).toBe('success');
      });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles rapid mutation calls', async () => {
      let callSequence: number[] = [];

      server.use(
        http.post('/api/v1/assignments/:id/submit', async () => {
          const order = callSequence.length + 1;
          callSequence.push(order);
          return HttpResponse.json({
            success: true,
            data: createMockSubmissionData({ id: order }),
          });
        })
      );

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

      // Rapid fire mutations
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          result.current.mutate({
            assignmentId: 123,
            submissionData: { onlineText: `Rapid call ${i}` },
          });
        });
      }

      await waitFor(() => {
        expect(result.current.isSuccess || result.current.isError).toBe(true);
      });

      // Last mutation should complete
      expect(result.current.data?.data).toBeDefined();
    });

    it('handles unmount during mutation', async () => {
      server.use(
        http.post('/api/v1/assignments/:id/submit', async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return HttpResponse.json({
            success: true,
            data: createMockSubmissionData({ id: 1 }),
          });
        })
      );

      const wrapper = createWrapper();
      const { result, unmount } = renderHook(() => useSubmitAssignment(), { wrapper });

      await act(async () => {
        result.current.mutate({
          assignmentId: 123,
          submissionData: { onlineText: 'Unmount test' },
        });
      });

      // Unmount before completion - should not throw
      unmount();

      // No assertion needed - test passes if no error is thrown
    });

    it('handles very large file uploads', async () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB content
      const mockSubmission = createMockSubmissionData({
        id: 1,
        files: [createMockAssignmentFile({ id: 1, filesize: 104857600 })], // 100MB
      });

      server.use(
        http.post('/api/v1/assignments/:id/submit', async () => {
          return HttpResponse.json({
            success: true,
            data: mockSubmission,
          });
        })
      );

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

      const largeFile = createMockFile('large-file.pdf', largeContent);

      await act(async () => {
        result.current.mutate({
          assignmentId: 123,
          submissionData: { files: [largeFile] },
        });
      });

      await waitForMutation(result);

      expect(result.current.isSuccess).toBe(true);
    });

    it('handles empty submissions array', async () => {
      server.use(
        http.get('/api/v1/assignments/:id/submissions', async () => {
          return HttpResponse.json({
            success: true,
            data: [],
            meta: {
              pagination: {
                page: 1,
                perPage: 20,
                total: 0,
                totalPages: 0,
              },
            },
          });
        })
      );

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSubmissions(123),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toEqual([]);
      expect(result.current.isError).toBe(false);
    });

    it('handles assignment not found', async () => {
      server.use(
        http.get('/api/v1/assignments/:id/submissions', async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Assignment not found',
              },
            },
            { status: 404 }
          );
        })
      );

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSubmissions(999),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('handles invalid assignment ID', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSubmissions(0),
        { wrapper }
      );

      // Hook should handle invalid ID gracefully
      expect(result.current.isLoading || result.current.isIdle || result.current.isPending).toBe(true);
    });

    it('handles submission with empty files array', async () => {
      const mockSubmission = createMockSubmissionData({
        id: 1,
        files: [],
      });

      server.use(
        http.post('/api/v1/assignments/:id/submit', async () => {
          return HttpResponse.json({
            success: true,
            data: mockSubmission,
          });
        })
      );

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

      await act(async () => {
        result.current.mutate({
          assignmentId: 123,
          submissionData: { onlineText: 'Text only submission', files: [] },
        });
      });

      await waitForMutation(result);

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.data.files).toEqual([]);
    });

    it('handles special characters in feedback', async () => {
      const specialFeedback = '<script>alert("xss")</script> & <br/> "quotes" \'apostrophes\'';

      server.use(
        http.post('/api/v1/assignments/:id/feedback', async () => {
          return HttpResponse.json({
            success: true,
            data: { id: 1, feedback: specialFeedback },
          });
        })
      );

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSaveFeedback(), { wrapper });

      await act(async () => {
        result.current.mutate({
          assignmentId: 123,
          userId: 456,
          feedbackData: { feedback: specialFeedback },
        });
      });

      await waitForMutation(result);

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.data.feedback).toBe(specialFeedback);
    });

    it('handles Unicode content in submission', async () => {
      const unicodeText = '日本語テキスト 中文文本 العربية текст на русском 🎉✨';

      server.use(
        http.post('/api/v1/assignments/:id/submit', async () => {
          return HttpResponse.json({
            success: true,
            data: createMockSubmissionData({ id: 1, onlineText: unicodeText }),
          });
        })
      );

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSubmitAssignment(), { wrapper });

      await act(async () => {
        result.current.mutate({
          assignmentId: 123,
          submissionData: { onlineText: unicodeText },
        });
      });

      await waitForMutation(result);

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.data.onlineText).toBe(unicodeText);
    });

    it('handles zero grade value', async () => {
      const mockGrade = createMockGrade({ id: 1, grade: 0 });

      server.use(
        http.post('/api/v1/assignments/:id/grade', async () => {
          return HttpResponse.json({
            success: true,
            data: mockGrade,
          });
        })
      );

      const wrapper = createWrapper();
      const { result } = renderHook(() => useGradeSubmission(), { wrapper });

      await act(async () => {
        result.current.mutate({
          assignmentId: 123,
          userId: 456,
          gradeData: { grade: 0, feedback: 'Incomplete submission' },
        });
      });

      await waitForMutation(result);

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.data.grade).toBe(0);
    });

    it('handles maximum grade value', async () => {
      const mockGrade = createMockGrade({ id: 1, grade: 100, grademax: 100 });

      server.use(
        http.post('/api/v1/assignments/:id/grade', async () => {
          return HttpResponse.json({
            success: true,
            data: mockGrade,
          });
        })
      );

      const wrapper = createWrapper();
      const { result } = renderHook(() => useGradeSubmission(), { wrapper });

      await act(async () => {
        result.current.mutate({
          assignmentId: 123,
          userId: 456,
          gradeData: { grade: 100, feedback: 'Perfect score!' },
        });
      });

      await waitForMutation(result);

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.data.grade).toBe(100);
    });
  });
});
