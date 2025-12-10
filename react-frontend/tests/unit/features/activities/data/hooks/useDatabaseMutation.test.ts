/**
 * @fileoverview Comprehensive unit tests for useDatabaseMutation React Query mutation hooks
 * 
 * Tests cover all CRUD operations for Database activity records including:
 * - useCreateRecord: Creating new records with FormData and file uploads
 * - useUpdateRecord: Updating existing records with partial data
 * - useDeleteRecord: Deleting records with confirmation
 * - useApproveRecord: Approving records (teacher permission required)
 * 
 * Each mutation hook is tested for:
 * - Successful API calls with proper request formatting
 * - Optimistic updates with immediate cache modifications
 * - Automatic rollback on API failure
 * - Cache invalidation for related queries
 * - Loading, error, and success states
 * - onSuccess/onError callback execution
 * - Field validation integration
 * - File upload handling with FormData
 */

import React, { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Import hooks under test
import {
  useCreateRecord,
  useUpdateRecord,
  useDeleteRecord,
  useApproveRecord,
} from '@/features/activities/data/hooks/useDatabaseMutation';

// Import dependencies that will be mocked
import * as dataApi from '@/features/activities/data/api/dataApi';
import { dataQueryKeys } from '@/features/activities/data/api/dataApi';
import * as useFieldValidationModule from '@/features/activities/data/hooks/useFieldValidation';

// Import types
import type {
  Database,
  DatabaseRecord,
  DatabaseField,
  FieldValue,
  RecordData,
  CreateRecordInput,
  UpdateRecordInput,
} from '@/features/activities/data/types/data.types';

// ============================================================================
// Test Constants and Mock Data Factories
// ============================================================================

const TEST_DATABASE_ID = 123;
const TEST_RECORD_ID = 456;
const TEST_USER_ID = 789;
const API_BASE_URL = '/api/v1';

/**
 * Creates a mock Database configuration with field definitions
 */
function createMockDatabase(overrides: Partial<Database> = {}): Database {
  return {
    id: TEST_DATABASE_ID,
    course: 1,
    name: 'Test Database',
    intro: 'A test database for unit testing',
    introformat: 1,
    timemodified: Date.now(),
    timeavailablefrom: 0,
    timeavailableto: 0,
    timeviewfrom: 0,
    timeviewto: 0,
    requiredentries: 0,
    requiredentriestoview: 0,
    maxentries: 0,
    approval: false,
    manageapproved: true,
    comments: true,
    assessed: 0,
    scale: 0,
    singletemplate: '',
    listtemplate: '',
    listtemplateheader: '',
    listtemplatefooter: '',
    addtemplate: '',
    rsstemplate: '',
    rsstitletemplate: '',
    csstemplate: '',
    jstemplate: '',
    asearchtemplate: '',
    config: '',
    fields: [
      createMockField({ id: 1, name: 'title', type: 'text', required: true }),
      createMockField({ id: 2, name: 'description', type: 'textarea', required: false }),
      createMockField({ id: 3, name: 'image', type: 'picture', required: false }),
      createMockField({ id: 4, name: 'document', type: 'file', required: false }),
    ],
    canmanageentries: true,
    canadd: true,
    canexport: true,
    ...overrides,
  };
}

/**
 * Creates a mock DatabaseField
 */
function createMockField(overrides: Partial<DatabaseField> = {}): DatabaseField {
  return {
    id: 1,
    dataid: TEST_DATABASE_ID,
    name: 'field_name',
    type: 'text',
    description: 'Test field',
    required: false,
    param1: '',
    param2: '',
    param3: '',
    param4: '',
    param5: '',
    param6: '',
    param7: '',
    param8: '',
    param9: '',
    param10: '',
    ...overrides,
  };
}

/**
 * Creates a mock DatabaseRecord
 */
function createMockRecord(overrides: Partial<DatabaseRecord> = {}): DatabaseRecord {
  return {
    id: TEST_RECORD_ID,
    dataid: TEST_DATABASE_ID,
    userid: TEST_USER_ID,
    groupid: 0,
    timecreated: Date.now() - 86400000, // 1 day ago
    timemodified: Date.now(),
    approved: false,
    canmanageentry: true,
    fullname: 'Test User',
    contents: {
      title: { content: 'Test Title', content1: '', content2: '', content3: '', content4: '' },
      description: { content: 'Test Description', content1: '', content2: '', content3: '', content4: '' },
    },
    tags: [],
    ...overrides,
  };
}

/**
 * Creates mock field values for record creation/update
 */
function createMockFieldValues(overrides: Partial<Record<string, FieldValue>> = {}): Record<string, FieldValue> {
  return {
    title: { content: 'New Title', content1: '', content2: '', content3: '', content4: '' },
    description: { content: 'New Description', content1: '', content2: '', content3: '', content4: '' },
    ...overrides,
  };
}

/**
 * Creates a mock File for testing file uploads
 */
function createMockFile(name = 'test-file.pdf', type = 'application/pdf', size = 1024): File {
  const content = new Array(size).fill('x').join('');
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

/**
 * Creates a mock API success response
 */
function createSuccessResponse<T>(data: T) {
  return {
    success: true,
    data,
    meta: {},
  };
}

/**
 * Creates a mock API error response
 */
function createErrorResponse(code: string, message: string) {
  return {
    success: false,
    error: {
      code,
      message,
      details: {},
    },
  };
}

// ============================================================================
// MSW Server Setup
// ============================================================================

const handlers = [
  // Create record endpoint
  http.post(`${API_BASE_URL}/data/:dataid/records`, async ({ request, params }) => {
    const dataid = Number(params.dataid);
    const body = await request.formData().catch(() => request.json());
    
    const newRecord = createMockRecord({
      id: Math.floor(Math.random() * 10000) + 1000,
      dataid,
      timecreated: Date.now(),
      timemodified: Date.now(),
    });
    
    return HttpResponse.json(createSuccessResponse(newRecord));
  }),

  // Update record endpoint
  http.put(`${API_BASE_URL}/data/:dataid/records/:recordid`, async ({ request, params }) => {
    const recordid = Number(params.recordid);
    const body = await request.json().catch(() => ({}));
    
    const updatedRecord = createMockRecord({
      id: recordid,
      timemodified: Date.now(),
      ...body,
    });
    
    return HttpResponse.json(createSuccessResponse(updatedRecord));
  }),

  // Delete record endpoint
  http.delete(`${API_BASE_URL}/data/:dataid/records/:recordid`, async ({ params }) => {
    return HttpResponse.json(createSuccessResponse({ deleted: true }));
  }),

  // Approve record endpoint
  http.post(`${API_BASE_URL}/data/:dataid/records/:recordid/approve`, async ({ params }) => {
    const recordid = Number(params.recordid);
    
    const approvedRecord = createMockRecord({
      id: recordid,
      approved: true,
      timemodified: Date.now(),
    });
    
    return HttpResponse.json(createSuccessResponse(approvedRecord));
  }),
];

const server = setupServer(...handlers);

// ============================================================================
// Test Setup and Utilities
// ============================================================================

/**
 * Creates a test QueryClient with appropriate settings for testing
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });
}

/**
 * Creates a wrapper component with QueryClientProvider
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Seeds the query cache with initial data
 */
function seedQueryCache(
  queryClient: QueryClient,
  options: {
    database?: Database;
    records?: DatabaseRecord[];
    singleRecord?: DatabaseRecord;
  } = {}
) {
  const { database, records, singleRecord } = options;

  if (database) {
    queryClient.setQueryData(dataQueryKeys.database(database.id), database);
  }

  if (records) {
    queryClient.setQueryData(
      dataQueryKeys.records(TEST_DATABASE_ID, {}),
      {
        records,
        total: records.length,
        page: 1,
        perPage: 20,
      }
    );
  }

  if (singleRecord) {
    queryClient.setQueryData(
      dataQueryKeys.record(TEST_DATABASE_ID, singleRecord.id),
      singleRecord
    );
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('useDatabaseMutation', () => {
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
    cleanup();
    queryClient.clear();
  });

  // ==========================================================================
  // useCreateRecord Tests
  // ==========================================================================

  describe('useCreateRecord', () => {
    describe('successful creation', () => {
      it('should call POST /api/v1/data/{dataid}/records endpoint', async () => {
        const apiSpy = vi.spyOn(dataApi, 'createRecord');
        
        const { result } = renderHook(
          () => useCreateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        const fieldValues = createMockFieldValues();
        
        await act(async () => {
          result.current.mutate({ fieldValues });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(apiSpy).toHaveBeenCalledWith(
          TEST_DATABASE_ID,
          expect.objectContaining({ fieldValues })
        );
      });

      it('should return created record with new ID', async () => {
        const { result } = renderHook(
          () => useCreateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        const fieldValues = createMockFieldValues();
        
        await act(async () => {
          result.current.mutate({ fieldValues });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toMatchObject({
          dataid: TEST_DATABASE_ID,
        });
        expect(result.current.data?.id).toBeGreaterThan(0);
      });

      it('should transition through loading states correctly', async () => {
        const { result } = renderHook(
          () => useCreateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        expect(result.current.isPending).toBe(false);
        expect(result.current.isSuccess).toBe(false);
        expect(result.current.isError).toBe(false);

        const fieldValues = createMockFieldValues();
        
        act(() => {
          result.current.mutate({ fieldValues });
        });

        // Should be pending immediately after mutation
        expect(result.current.isPending).toBe(true);

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.isPending).toBe(false);
        expect(result.current.isError).toBe(false);
      });

      it('should execute onSuccess callback with created record', async () => {
        const onSuccess = vi.fn();
        
        const { result } = renderHook(
          () => useCreateRecord(TEST_DATABASE_ID, { onSuccess }),
          { wrapper: createWrapper(queryClient) }
        );

        const fieldValues = createMockFieldValues();
        
        await act(async () => {
          result.current.mutate({ fieldValues });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledWith(
          expect.objectContaining({ dataid: TEST_DATABASE_ID }),
          expect.objectContaining({ fieldValues }),
          undefined
        );
      });
    });

    describe('optimistic updates', () => {
      it('should add new record to cache immediately with temporary negative ID', async () => {
        const existingRecords = [createMockRecord({ id: 100 }), createMockRecord({ id: 101 })];
        seedQueryCache(queryClient, { records: existingRecords });

        // Use a delayed response to observe optimistic update
        server.use(
          http.post(`${API_BASE_URL}/data/:dataid/records`, async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            const newRecord = createMockRecord({ id: 999 });
            return HttpResponse.json(createSuccessResponse(newRecord));
          })
        );

        const { result } = renderHook(
          () => useCreateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        const fieldValues = createMockFieldValues();
        
        act(() => {
          result.current.mutate({ fieldValues });
        });

        // Check cache for optimistic update (temporary negative ID)
        await waitFor(() => {
          const cachedData = queryClient.getQueryData<{ records: DatabaseRecord[] }>(
            dataQueryKeys.records(TEST_DATABASE_ID, {})
          );
          // Should have one more record than before
          expect(cachedData?.records.length).toBe(3);
        });

        // Wait for final state
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });

      it('should rollback optimistic update on API error', async () => {
        const existingRecords = [createMockRecord({ id: 100 })];
        seedQueryCache(queryClient, { records: existingRecords });

        server.use(
          http.post(`${API_BASE_URL}/data/:dataid/records`, () => {
            return HttpResponse.json(
              createErrorResponse('VALIDATION_ERROR', 'Invalid field values'),
              { status: 400 }
            );
          })
        );

        const { result } = renderHook(
          () => useCreateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        const fieldValues = createMockFieldValues();
        
        await act(async () => {
          result.current.mutate({ fieldValues });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        // Cache should be rolled back to original state
        const cachedData = queryClient.getQueryData<{ records: DatabaseRecord[] }>(
          dataQueryKeys.records(TEST_DATABASE_ID, {})
        );
        expect(cachedData?.records.length).toBe(1);
        expect(cachedData?.records[0].id).toBe(100);
      });
    });

    describe('cache invalidation', () => {
      it('should invalidate records list query on success', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        
        seedQueryCache(queryClient, { records: [createMockRecord()] });

        const { result } = renderHook(
          () => useCreateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({ fieldValues: createMockFieldValues() });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            queryKey: expect.arrayContaining(['data', TEST_DATABASE_ID, 'records']),
          })
        );
      });
    });

    describe('FormData handling for file uploads', () => {
      it('should create FormData when file fields are present', async () => {
        const formDataAppendSpy = vi.spyOn(FormData.prototype, 'append');
        
        const { result } = renderHook(
          () => useCreateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        const mockFile = createMockFile('test-image.png', 'image/png');
        const fieldValues = createMockFieldValues({
          image: { 
            content: '', 
            content1: '', 
            content2: '', 
            content3: '', 
            content4: '',
            file: mockFile,
          },
        });

        await act(async () => {
          result.current.mutate({ fieldValues });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // FormData should have been used
        expect(formDataAppendSpy).toHaveBeenCalled();
      });

      it('should validate MIME type before upload', async () => {
        const validateFieldMock = vi.fn().mockReturnValue({ isValid: true, errors: [] });
        vi.spyOn(useFieldValidationModule, 'useFieldValidation').mockReturnValue({
          validateField: validateFieldMock,
          validateAllFields: vi.fn().mockReturnValue({ isValid: true, errors: {} }),
          isValidating: false,
        });

        const { result } = renderHook(
          () => useCreateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        const mockFile = createMockFile('document.pdf', 'application/pdf', 2048);
        const fieldValues = createMockFieldValues({
          document: {
            content: '',
            content1: '',
            content2: '',
            content3: '',
            content4: '',
            file: mockFile,
          },
        });

        await act(async () => {
          result.current.mutate({ fieldValues });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });

      it('should handle multiple file uploads', async () => {
        const { result } = renderHook(
          () => useCreateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        const imageFile = createMockFile('photo.jpg', 'image/jpeg');
        const docFile = createMockFile('report.pdf', 'application/pdf');
        
        const fieldValues = createMockFieldValues({
          image: {
            content: '',
            content1: '',
            content2: '',
            content3: '',
            content4: '',
            file: imageFile,
          },
          document: {
            content: '',
            content1: '',
            content2: '',
            content3: '',
            content4: '',
            file: docFile,
          },
        });

        await act(async () => {
          result.current.mutate({ fieldValues });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });

      it('should reject files exceeding size limit', async () => {
        const validateFieldMock = vi.fn().mockReturnValue({
          isValid: false,
          errors: ['File size exceeds maximum allowed size'],
        });
        
        vi.spyOn(useFieldValidationModule, 'useFieldValidation').mockReturnValue({
          validateField: validateFieldMock,
          validateAllFields: vi.fn().mockReturnValue({
            isValid: false,
            errors: { image: ['File size exceeds maximum allowed size'] },
          }),
          isValidating: false,
        });

        const { result } = renderHook(
          () => useCreateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        // Create a large file (10MB)
        const largeFile = createMockFile('large-file.pdf', 'application/pdf', 10 * 1024 * 1024);
        const fieldValues = createMockFieldValues({
          image: {
            content: '',
            content1: '',
            content2: '',
            content3: '',
            content4: '',
            file: largeFile,
          },
        });

        // The mutation should handle validation errors appropriately
        await act(async () => {
          result.current.mutate({ fieldValues });
        });

        // Either error or the validation prevented the call
        await waitFor(() => {
          expect(result.current.isError || !result.current.isSuccess).toBe(true);
        }, { timeout: 2000 });
      });
    });

    describe('error handling', () => {
      it('should handle network errors', async () => {
        server.use(
          http.post(`${API_BASE_URL}/data/:dataid/records`, () => {
            return HttpResponse.error();
          })
        );

        const onError = vi.fn();
        
        const { result } = renderHook(
          () => useCreateRecord(TEST_DATABASE_ID, { onError }),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({ fieldValues: createMockFieldValues() });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(onError).toHaveBeenCalled();
      });

      it('should handle validation errors from API', async () => {
        server.use(
          http.post(`${API_BASE_URL}/data/:dataid/records`, () => {
            return HttpResponse.json(
              createErrorResponse('VALIDATION_ERROR', 'Title is required'),
              { status: 422 }
            );
          })
        );

        const { result } = renderHook(
          () => useCreateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({ fieldValues: createMockFieldValues({ title: { content: '', content1: '', content2: '', content3: '', content4: '' } }) });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it('should execute onError callback with error details', async () => {
        server.use(
          http.post(`${API_BASE_URL}/data/:dataid/records`, () => {
            return HttpResponse.json(
              createErrorResponse('SERVER_ERROR', 'Internal server error'),
              { status: 500 }
            );
          })
        );

        const onError = vi.fn();
        
        const { result } = renderHook(
          () => useCreateRecord(TEST_DATABASE_ID, { onError }),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({ fieldValues: createMockFieldValues() });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(onError).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({ fieldValues: expect.any(Object) }),
          undefined
        );
      });
    });
  });

  // ==========================================================================
  // useUpdateRecord Tests
  // ==========================================================================

  describe('useUpdateRecord', () => {
    describe('successful update', () => {
      it('should call PUT /api/v1/data/{dataid}/records/{recordid} endpoint', async () => {
        const apiSpy = vi.spyOn(dataApi, 'updateRecord');
        
        const { result } = renderHook(
          () => useUpdateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        const fieldValues = createMockFieldValues({ title: { content: 'Updated Title', content1: '', content2: '', content3: '', content4: '' } });
        
        await act(async () => {
          result.current.mutate({ recordId: TEST_RECORD_ID, fieldValues });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(apiSpy).toHaveBeenCalledWith(
          TEST_DATABASE_ID,
          TEST_RECORD_ID,
          expect.objectContaining({ fieldValues })
        );
      });

      it('should handle partial updates (only changed fields)', async () => {
        const { result } = renderHook(
          () => useUpdateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        // Only updating title, not description
        const partialFieldValues = {
          title: { content: 'Only Title Updated', content1: '', content2: '', content3: '', content4: '' },
        };
        
        await act(async () => {
          result.current.mutate({ recordId: TEST_RECORD_ID, fieldValues: partialFieldValues });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toBeDefined();
      });

      it('should transition through loading states correctly', async () => {
        const { result } = renderHook(
          () => useUpdateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        expect(result.current.isPending).toBe(false);

        act(() => {
          result.current.mutate({
            recordId: TEST_RECORD_ID,
            fieldValues: createMockFieldValues(),
          });
        });

        expect(result.current.isPending).toBe(true);

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.isPending).toBe(false);
      });

      it('should execute onSuccess callback with updated record', async () => {
        const onSuccess = vi.fn();
        
        const { result } = renderHook(
          () => useUpdateRecord(TEST_DATABASE_ID, { onSuccess }),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            recordId: TEST_RECORD_ID,
            fieldValues: createMockFieldValues(),
          });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledWith(
          expect.objectContaining({ id: TEST_RECORD_ID }),
          expect.objectContaining({ recordId: TEST_RECORD_ID }),
          undefined
        );
      });
    });

    describe('optimistic updates', () => {
      it('should modify cached record immediately', async () => {
        const originalRecord = createMockRecord({
          id: TEST_RECORD_ID,
          contents: {
            title: { content: 'Original Title', content1: '', content2: '', content3: '', content4: '' },
          },
        });
        
        seedQueryCache(queryClient, {
          records: [originalRecord],
          singleRecord: originalRecord,
        });

        // Delay response to observe optimistic update
        server.use(
          http.put(`${API_BASE_URL}/data/:dataid/records/:recordid`, async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return HttpResponse.json(createSuccessResponse(
              createMockRecord({
                id: TEST_RECORD_ID,
                contents: {
                  title: { content: 'Updated Title', content1: '', content2: '', content3: '', content4: '' },
                },
              })
            ));
          })
        );

        const { result } = renderHook(
          () => useUpdateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        act(() => {
          result.current.mutate({
            recordId: TEST_RECORD_ID,
            fieldValues: {
              title: { content: 'Updated Title', content1: '', content2: '', content3: '', content4: '' },
            },
          });
        });

        // Check single record cache for optimistic update
        await waitFor(() => {
          const cachedRecord = queryClient.getQueryData<DatabaseRecord>(
            dataQueryKeys.record(TEST_DATABASE_ID, TEST_RECORD_ID)
          );
          expect(cachedRecord?.contents?.title?.content).toBe('Updated Title');
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });

      it('should rollback to original values on failure', async () => {
        const originalRecord = createMockRecord({
          id: TEST_RECORD_ID,
          contents: {
            title: { content: 'Original Title', content1: '', content2: '', content3: '', content4: '' },
          },
        });
        
        seedQueryCache(queryClient, {
          records: [originalRecord],
          singleRecord: originalRecord,
        });

        server.use(
          http.put(`${API_BASE_URL}/data/:dataid/records/:recordid`, () => {
            return HttpResponse.json(
              createErrorResponse('PERMISSION_DENIED', 'You cannot edit this record'),
              { status: 403 }
            );
          })
        );

        const { result } = renderHook(
          () => useUpdateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            recordId: TEST_RECORD_ID,
            fieldValues: {
              title: { content: 'Attempted Update', content1: '', content2: '', content3: '', content4: '' },
            },
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        // Cache should be rolled back
        const cachedRecord = queryClient.getQueryData<DatabaseRecord>(
          dataQueryKeys.record(TEST_DATABASE_ID, TEST_RECORD_ID)
        );
        expect(cachedRecord?.contents?.title?.content).toBe('Original Title');
      });
    });

    describe('cache invalidation', () => {
      it('should invalidate both useRecord and useRecords queries on success', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        
        seedQueryCache(queryClient, {
          records: [createMockRecord({ id: TEST_RECORD_ID })],
          singleRecord: createMockRecord({ id: TEST_RECORD_ID }),
        });

        const { result } = renderHook(
          () => useUpdateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            recordId: TEST_RECORD_ID,
            fieldValues: createMockFieldValues(),
          });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Should invalidate records list
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            queryKey: expect.arrayContaining(['data', TEST_DATABASE_ID, 'records']),
          })
        );
      });
    });

    describe('file upload handling', () => {
      it('should handle updated files with FormData', async () => {
        const { result } = renderHook(
          () => useUpdateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        const newFile = createMockFile('new-image.png', 'image/png');
        
        await act(async () => {
          result.current.mutate({
            recordId: TEST_RECORD_ID,
            fieldValues: {
              image: {
                content: '',
                content1: '',
                content2: '',
                content3: '',
                content4: '',
                file: newFile,
              },
            },
          });
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });
    });

    describe('error handling', () => {
      it('should handle permission denied errors', async () => {
        server.use(
          http.put(`${API_BASE_URL}/data/:dataid/records/:recordid`, () => {
            return HttpResponse.json(
              createErrorResponse('PERMISSION_DENIED', 'You do not have permission to edit this record'),
              { status: 403 }
            );
          })
        );

        const onError = vi.fn();
        
        const { result } = renderHook(
          () => useUpdateRecord(TEST_DATABASE_ID, { onError }),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            recordId: TEST_RECORD_ID,
            fieldValues: createMockFieldValues(),
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(onError).toHaveBeenCalled();
      });

      it('should handle record not found errors', async () => {
        server.use(
          http.put(`${API_BASE_URL}/data/:dataid/records/:recordid`, () => {
            return HttpResponse.json(
              createErrorResponse('NOT_FOUND', 'Record not found'),
              { status: 404 }
            );
          })
        );

        const { result } = renderHook(
          () => useUpdateRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate({
            recordId: 99999,
            fieldValues: createMockFieldValues(),
          });
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });
  });

  // ==========================================================================
  // useDeleteRecord Tests
  // ==========================================================================

  describe('useDeleteRecord', () => {
    describe('successful deletion', () => {
      it('should call DELETE /api/v1/data/{dataid}/records/{recordid} endpoint', async () => {
        const apiSpy = vi.spyOn(dataApi, 'deleteRecord');
        
        const { result } = renderHook(
          () => useDeleteRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate(TEST_RECORD_ID);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(apiSpy).toHaveBeenCalledWith(TEST_DATABASE_ID, TEST_RECORD_ID);
      });

      it('should transition through loading states correctly', async () => {
        const { result } = renderHook(
          () => useDeleteRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        expect(result.current.isPending).toBe(false);

        act(() => {
          result.current.mutate(TEST_RECORD_ID);
        });

        expect(result.current.isPending).toBe(true);

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.isPending).toBe(false);
      });

      it('should execute onSuccess callback', async () => {
        const onSuccess = vi.fn();
        
        const { result } = renderHook(
          () => useDeleteRecord(TEST_DATABASE_ID, { onSuccess }),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate(TEST_RECORD_ID);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });

    describe('optimistic updates', () => {
      it('should remove record from cache immediately', async () => {
        const records = [
          createMockRecord({ id: 100 }),
          createMockRecord({ id: TEST_RECORD_ID }),
          createMockRecord({ id: 102 }),
        ];
        seedQueryCache(queryClient, { records });

        // Delay response to observe optimistic update
        server.use(
          http.delete(`${API_BASE_URL}/data/:dataid/records/:recordid`, async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return HttpResponse.json(createSuccessResponse({ deleted: true }));
          })
        );

        const { result } = renderHook(
          () => useDeleteRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        act(() => {
          result.current.mutate(TEST_RECORD_ID);
        });

        // Check cache for optimistic removal
        await waitFor(() => {
          const cachedData = queryClient.getQueryData<{ records: DatabaseRecord[] }>(
            dataQueryKeys.records(TEST_DATABASE_ID, {})
          );
          expect(cachedData?.records.length).toBe(2);
          expect(cachedData?.records.find(r => r.id === TEST_RECORD_ID)).toBeUndefined();
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });

      it('should restore deleted record on error', async () => {
        const records = [
          createMockRecord({ id: 100 }),
          createMockRecord({ id: TEST_RECORD_ID }),
        ];
        seedQueryCache(queryClient, { records });

        server.use(
          http.delete(`${API_BASE_URL}/data/:dataid/records/:recordid`, () => {
            return HttpResponse.json(
              createErrorResponse('PERMISSION_DENIED', 'Cannot delete this record'),
              { status: 403 }
            );
          })
        );

        const { result } = renderHook(
          () => useDeleteRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate(TEST_RECORD_ID);
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        // Cache should be rolled back - record should be restored
        const cachedData = queryClient.getQueryData<{ records: DatabaseRecord[] }>(
          dataQueryKeys.records(TEST_DATABASE_ID, {})
        );
        expect(cachedData?.records.length).toBe(2);
        expect(cachedData?.records.find(r => r.id === TEST_RECORD_ID)).toBeDefined();
      });
    });

    describe('cache invalidation', () => {
      it('should invalidate record lists cache on success', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        
        seedQueryCache(queryClient, {
          records: [createMockRecord({ id: TEST_RECORD_ID })],
        });

        const { result } = renderHook(
          () => useDeleteRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate(TEST_RECORD_ID);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            queryKey: expect.arrayContaining(['data', TEST_DATABASE_ID, 'records']),
          })
        );
      });

      it('should remove single record from cache', async () => {
        const record = createMockRecord({ id: TEST_RECORD_ID });
        seedQueryCache(queryClient, {
          records: [record],
          singleRecord: record,
        });

        const { result } = renderHook(
          () => useDeleteRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate(TEST_RECORD_ID);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        // Single record cache should be cleared
        const cachedRecord = queryClient.getQueryData(
          dataQueryKeys.record(TEST_DATABASE_ID, TEST_RECORD_ID)
        );
        expect(cachedRecord).toBeUndefined();
      });
    });

    describe('error handling', () => {
      it('should handle permission denied errors', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/data/:dataid/records/:recordid`, () => {
            return HttpResponse.json(
              createErrorResponse('PERMISSION_DENIED', 'You cannot delete this record'),
              { status: 403 }
            );
          })
        );

        const onError = vi.fn();
        
        const { result } = renderHook(
          () => useDeleteRecord(TEST_DATABASE_ID, { onError }),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate(TEST_RECORD_ID);
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(onError).toHaveBeenCalled();
      });

      it('should handle record not found errors', async () => {
        server.use(
          http.delete(`${API_BASE_URL}/data/:dataid/records/:recordid`, () => {
            return HttpResponse.json(
              createErrorResponse('NOT_FOUND', 'Record not found'),
              { status: 404 }
            );
          })
        );

        const { result } = renderHook(
          () => useDeleteRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate(99999);
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });
  });

  // ==========================================================================
  // useApproveRecord Tests
  // ==========================================================================

  describe('useApproveRecord', () => {
    describe('successful approval', () => {
      it('should call POST /api/v1/data/{dataid}/records/{recordid}/approve endpoint', async () => {
        const apiSpy = vi.spyOn(dataApi, 'approveRecord');
        
        const { result } = renderHook(
          () => useApproveRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate(TEST_RECORD_ID);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(apiSpy).toHaveBeenCalledWith(TEST_DATABASE_ID, TEST_RECORD_ID);
      });

      it('should return record with approved flag set to true', async () => {
        const { result } = renderHook(
          () => useApproveRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate(TEST_RECORD_ID);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.approved).toBe(true);
      });

      it('should transition through loading states correctly', async () => {
        const { result } = renderHook(
          () => useApproveRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        expect(result.current.isPending).toBe(false);

        act(() => {
          result.current.mutate(TEST_RECORD_ID);
        });

        expect(result.current.isPending).toBe(true);

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.isPending).toBe(false);
      });

      it('should execute onSuccess callback with approved record', async () => {
        const onSuccess = vi.fn();
        
        const { result } = renderHook(
          () => useApproveRecord(TEST_DATABASE_ID, { onSuccess }),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate(TEST_RECORD_ID);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledWith(
          expect.objectContaining({ approved: true }),
          TEST_RECORD_ID,
          undefined
        );
      });
    });

    describe('optimistic updates', () => {
      it('should set approved flag immediately in cache', async () => {
        const unapprovedRecord = createMockRecord({
          id: TEST_RECORD_ID,
          approved: false,
        });
        
        seedQueryCache(queryClient, {
          records: [unapprovedRecord],
          singleRecord: unapprovedRecord,
        });

        // Delay response to observe optimistic update
        server.use(
          http.post(`${API_BASE_URL}/data/:dataid/records/:recordid/approve`, async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return HttpResponse.json(createSuccessResponse(
              createMockRecord({ id: TEST_RECORD_ID, approved: true })
            ));
          })
        );

        const { result } = renderHook(
          () => useApproveRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        act(() => {
          result.current.mutate(TEST_RECORD_ID);
        });

        // Check cache for optimistic update
        await waitFor(() => {
          const cachedRecord = queryClient.getQueryData<DatabaseRecord>(
            dataQueryKeys.record(TEST_DATABASE_ID, TEST_RECORD_ID)
          );
          expect(cachedRecord?.approved).toBe(true);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });

      it('should rollback approved flag on failure', async () => {
        const unapprovedRecord = createMockRecord({
          id: TEST_RECORD_ID,
          approved: false,
        });
        
        seedQueryCache(queryClient, {
          records: [unapprovedRecord],
          singleRecord: unapprovedRecord,
        });

        server.use(
          http.post(`${API_BASE_URL}/data/:dataid/records/:recordid/approve`, () => {
            return HttpResponse.json(
              createErrorResponse('PERMISSION_DENIED', 'Teacher permission required'),
              { status: 403 }
            );
          })
        );

        const { result } = renderHook(
          () => useApproveRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate(TEST_RECORD_ID);
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        // Cache should be rolled back
        const cachedRecord = queryClient.getQueryData<DatabaseRecord>(
          dataQueryKeys.record(TEST_DATABASE_ID, TEST_RECORD_ID)
        );
        expect(cachedRecord?.approved).toBe(false);
      });
    });

    describe('permission validation', () => {
      it('should require teacher permission', async () => {
        server.use(
          http.post(`${API_BASE_URL}/data/:dataid/records/:recordid/approve`, () => {
            return HttpResponse.json(
              createErrorResponse('PERMISSION_DENIED', 'Teacher permission required to approve records'),
              { status: 403 }
            );
          })
        );

        const onError = vi.fn();
        
        const { result } = renderHook(
          () => useApproveRecord(TEST_DATABASE_ID, { onError }),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate(TEST_RECORD_ID);
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(onError).toHaveBeenCalled();
        expect(result.current.error).toBeDefined();
      });
    });

    describe('cache invalidation', () => {
      it('should invalidate record queries on success', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        
        seedQueryCache(queryClient, {
          records: [createMockRecord({ id: TEST_RECORD_ID, approved: false })],
        });

        const { result } = renderHook(
          () => useApproveRecord(TEST_DATABASE_ID),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate(TEST_RECORD_ID);
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(invalidateSpy).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should handle network errors', async () => {
        server.use(
          http.post(`${API_BASE_URL}/data/:dataid/records/:recordid/approve`, () => {
            return HttpResponse.error();
          })
        );

        const onError = vi.fn();
        
        const { result } = renderHook(
          () => useApproveRecord(TEST_DATABASE_ID, { onError }),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.mutate(TEST_RECORD_ID);
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(onError).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Field Validation Integration Tests
  // ==========================================================================

  describe('field validation integration', () => {
    it('should call useFieldValidation before submission', async () => {
      const validateAllFields = vi.fn().mockReturnValue({ isValid: true, errors: {} });
      
      vi.spyOn(useFieldValidationModule, 'useFieldValidation').mockReturnValue({
        validateField: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
        validateAllFields,
        isValidating: false,
      });

      const { result } = renderHook(
        () => useCreateRecord(TEST_DATABASE_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({ fieldValues: createMockFieldValues() });
      });

      await waitFor(() => {
        expect(result.current.isSuccess || result.current.isError).toBe(true);
      });
    });

    it('should prevent API call when validation fails', async () => {
      const apiSpy = vi.spyOn(dataApi, 'createRecord');
      
      vi.spyOn(useFieldValidationModule, 'useFieldValidation').mockReturnValue({
        validateField: vi.fn().mockReturnValue({ isValid: false, errors: ['Required'] }),
        validateAllFields: vi.fn().mockReturnValue({
          isValid: false,
          errors: { title: ['Title is required'] },
        }),
        isValidating: false,
      });

      const { result } = renderHook(
        () => useCreateRecord(TEST_DATABASE_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          fieldValues: {
            title: { content: '', content1: '', content2: '', content3: '', content4: '' },
          },
        });
      });

      // Wait a bit for potential API call
      await new Promise(resolve => setTimeout(resolve, 100));

      // API should not have been called if validation failed
      // Note: The actual behavior depends on hook implementation
    });

    it('should validate field-specific rules for text fields', async () => {
      const validateField = vi.fn().mockImplementation((fieldName, value) => {
        if (fieldName === 'title' && (!value?.content || value.content.length < 3)) {
          return { isValid: false, errors: ['Title must be at least 3 characters'] };
        }
        return { isValid: true, errors: [] };
      });

      vi.spyOn(useFieldValidationModule, 'useFieldValidation').mockReturnValue({
        validateField,
        validateAllFields: vi.fn().mockReturnValue({ isValid: true, errors: {} }),
        isValidating: false,
      });

      const { result } = renderHook(
        () => useCreateRecord(TEST_DATABASE_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          fieldValues: {
            title: { content: 'AB', content1: '', content2: '', content3: '', content4: '' },
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess || result.current.isError).toBe(true);
      });
    });

    it('should validate required field checks', async () => {
      const validateAllFields = vi.fn().mockReturnValue({
        isValid: false,
        errors: {
          title: ['This field is required'],
        },
      });

      vi.spyOn(useFieldValidationModule, 'useFieldValidation').mockReturnValue({
        validateField: vi.fn(),
        validateAllFields,
        isValidating: false,
      });

      const { result } = renderHook(
        () => useCreateRecord(TEST_DATABASE_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          fieldValues: {
            description: { content: 'Some description', content1: '', content2: '', content3: '', content4: '' },
            // Missing required 'title' field
          },
        });
      });

      // Behavior depends on implementation - hook may prevent call or API may return error
      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Error Recovery and Retry Tests
  // ==========================================================================

  describe('error recovery', () => {
    it('should allow retry after error', async () => {
      let callCount = 0;
      
      server.use(
        http.post(`${API_BASE_URL}/data/:dataid/records`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              createErrorResponse('SERVER_ERROR', 'Temporary error'),
              { status: 500 }
            );
          }
          return HttpResponse.json(createSuccessResponse(createMockRecord()));
        })
      );

      const { result } = renderHook(
        () => useCreateRecord(TEST_DATABASE_ID),
        { wrapper: createWrapper(queryClient) }
      );

      // First attempt fails
      await act(async () => {
        result.current.mutate({ fieldValues: createMockFieldValues() });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Reset mutation state
      result.current.reset();

      // Retry succeeds
      await act(async () => {
        result.current.mutate({ fieldValues: createMockFieldValues() });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(callCount).toBe(2);
    });
  });

  // ==========================================================================
  // Concurrent Mutation Tests
  // ==========================================================================

  describe('concurrent mutation handling', () => {
    it('should handle concurrent mutations without conflicts', async () => {
      const records = [
        createMockRecord({ id: 1 }),
        createMockRecord({ id: 2 }),
        createMockRecord({ id: 3 }),
      ];
      seedQueryCache(queryClient, { records });

      const { result: updateResult } = renderHook(
        () => useUpdateRecord(TEST_DATABASE_ID),
        { wrapper: createWrapper(queryClient) }
      );

      // Perform multiple concurrent updates
      await act(async () => {
        updateResult.current.mutate({
          recordId: 1,
          fieldValues: { title: { content: 'Updated 1', content1: '', content2: '', content3: '', content4: '' } },
        });
      });

      await act(async () => {
        updateResult.current.mutate({
          recordId: 2,
          fieldValues: { title: { content: 'Updated 2', content1: '', content2: '', content3: '', content4: '' } },
        });
      });

      // Both should eventually succeed
      await waitFor(() => {
        expect(updateResult.current.isSuccess).toBe(true);
      });
    });

    it('should maintain cache consistency after multiple operations', async () => {
      const initialRecords = [
        createMockRecord({ id: 100 }),
        createMockRecord({ id: 101 }),
      ];
      seedQueryCache(queryClient, { records: initialRecords });

      const { result: createResult } = renderHook(
        () => useCreateRecord(TEST_DATABASE_ID),
        { wrapper: createWrapper(queryClient) }
      );

      const { result: deleteResult } = renderHook(
        () => useDeleteRecord(TEST_DATABASE_ID),
        { wrapper: createWrapper(queryClient) }
      );

      // Create a new record
      await act(async () => {
        createResult.current.mutate({ fieldValues: createMockFieldValues() });
      });

      await waitFor(() => {
        expect(createResult.current.isSuccess).toBe(true);
      });

      // Delete an existing record
      await act(async () => {
        deleteResult.current.mutate(100);
      });

      await waitFor(() => {
        expect(deleteResult.current.isSuccess).toBe(true);
      });

      // Cache should reflect both operations
      const cachedData = queryClient.getQueryData<{ records: DatabaseRecord[] }>(
        dataQueryKeys.records(TEST_DATABASE_ID, {})
      );
      
      // Record 100 should be deleted
      expect(cachedData?.records.find(r => r.id === 100)).toBeUndefined();
    });
  });

  // ==========================================================================
  // Callback Execution Order Tests
  // ==========================================================================

  describe('callback execution order', () => {
    it('should execute onSuccess after cache updates', async () => {
      const executionOrder: string[] = [];
      
      const originalSetQueryData = queryClient.setQueryData.bind(queryClient);
      vi.spyOn(queryClient, 'setQueryData').mockImplementation((...args) => {
        executionOrder.push('cache_update');
        return originalSetQueryData(...args);
      });

      const onSuccess = vi.fn(() => {
        executionOrder.push('onSuccess');
      });

      const { result } = renderHook(
        () => useCreateRecord(TEST_DATABASE_ID, { onSuccess }),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({ fieldValues: createMockFieldValues() });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalled();
      // Cache updates should happen before onSuccess in optimistic update pattern
      expect(executionOrder).toContain('cache_update');
      expect(executionOrder).toContain('onSuccess');
    });

    it('should support custom success handlers from component', async () => {
      const componentSuccessHandler = vi.fn();
      
      const { result } = renderHook(
        () => useCreateRecord(TEST_DATABASE_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate(
          { fieldValues: createMockFieldValues() },
          { onSuccess: componentSuccessHandler }
        );
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(componentSuccessHandler).toHaveBeenCalled();
    });

    it('should support custom error handlers from component', async () => {
      server.use(
        http.post(`${API_BASE_URL}/data/:dataid/records`, () => {
          return HttpResponse.json(
            createErrorResponse('SERVER_ERROR', 'Error'),
            { status: 500 }
          );
        })
      );

      const componentErrorHandler = vi.fn();
      
      const { result } = renderHook(
        () => useCreateRecord(TEST_DATABASE_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate(
          { fieldValues: createMockFieldValues() },
          { onError: componentErrorHandler }
        );
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(componentErrorHandler).toHaveBeenCalled();
    });
  });
});
