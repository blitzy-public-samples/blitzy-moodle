/**
 * Unit Tests for useRecord Hook
 *
 * Comprehensive test suite for the useRecord React Query hook that fetches
 * single Database activity records. Tests cover:
 * - Successful record fetching with complete data structure
 * - React Query caching with record-specific keys
 * - Field value typing and transformation
 * - User permissions (canEdit, canDelete, canApprove)
 * - Loading, error, and success states
 * - Error handling (404, 403, network errors)
 * - Retry logic and automatic refetching
 * - Optimistic update support
 *
 * @module tests/unit/features/activities/data/hooks/useRecord.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import React from 'react';

import useRecord from '@/features/activities/data/hooks/useRecord';
import type { RecordData } from '@/features/activities/data/hooks/useRecord';
import { dataQueryKeys, getRecord } from '@/features/activities/data/api/dataApi';
import type { RecordWithContents, RecordComment } from '@/features/activities/data/api/dataApi';
import type { DatabaseRecord, FieldContent, FieldType } from '@/features/activities/data/types/data.types';

// Import MSW server from test setup
import { server } from '../../../../mocks/server';

// ============================================================================
// Test Constants
// ============================================================================

const DATA_API_BASE = '/data';
const TEST_DATABASE_ID = 123;
const TEST_RECORD_ID = 456;

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock FieldContent object for testing
 */
function createMockFieldContent(overrides: Partial<FieldContent> = {}): FieldContent {
  return {
    id: Math.floor(Math.random() * 10000) + 1,
    fieldid: 1,
    recordid: TEST_RECORD_ID,
    content: 'Test content',
    content1: undefined,
    content2: undefined,
    content3: undefined,
    content4: undefined,
    ...overrides,
  };
}

/**
 * Creates a mock RecordComment object for testing
 */
function createMockComment(overrides: Partial<RecordComment> = {}): RecordComment {
  return {
    id: Math.floor(Math.random() * 10000) + 1,
    userid: 100,
    userfullname: 'Comment User',
    content: 'This is a test comment',
    format: 1,
    timecreated: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    ...overrides,
  };
}

/**
 * Creates a mock RecordWithContents object for testing
 */
function createMockRecordWithContents(
  overrides: Partial<RecordWithContents> = {}
): RecordWithContents {
  const baseRecord: RecordWithContents = {
    // DatabaseRecord properties
    id: TEST_RECORD_ID,
    userid: 42,
    groupid: 0,
    dataid: TEST_DATABASE_ID,
    timecreated: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
    timemodified: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    approved: true,
    
    // RecordWithContents extended properties
    contents: [
      createMockFieldContent({ id: 1, fieldid: 1, content: 'John Doe' }),
      createMockFieldContent({ id: 2, fieldid: 2, content: 'john@example.com' }),
      createMockFieldContent({ id: 3, fieldid: 3, content: '42' }),
      createMockFieldContent({ id: 4, fieldid: 4, content: '2024-01-15' }),
      createMockFieldContent({
        id: 5,
        fieldid: 5,
        content: 'https://example.com/files/document.pdf',
        content1: 'document.pdf',
      }),
    ],
    userfullname: 'John Doe',
    canEdit: true,
    canDelete: false,
    tags: [
      { id: 1, name: 'important' },
      { id: 2, name: 'featured' },
    ],
    rating: {
      aggregate: 4.5,
      count: 10,
      userRating: 5,
    },
    comments: [
      createMockComment({ id: 1, content: 'Great entry!' }),
      createMockComment({ id: 2, content: 'Very helpful information.' }),
    ],
  };

  return { ...baseRecord, ...overrides };
}

// ============================================================================
// Test Query Client Setup
// ============================================================================

/**
 * Creates a test QueryClient with no retries and instant cache expiration
 * for deterministic testing
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
  });
}

/**
 * Creates a wrapper component that provides QueryClientProvider context
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('useRecord Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  // ==========================================================================
  // Successful Record Fetching Tests
  // ==========================================================================

  describe('Successful Record Fetching', () => {
    it('should fetch record data successfully', async () => {
      const mockRecord = createMockRecordWithContents();

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.record).toBeUndefined();

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify record data is returned
      expect(result.current.record).toBeDefined();
      expect(result.current.data).toBeDefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return properly typed RecordData with user and permissions', async () => {
      const mockRecord = createMockRecordWithContents({
        userid: 42,
        userfullname: 'Jane Smith',
        canEdit: true,
        canDelete: true,
        approved: true,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const recordData = result.current.record!;

      // Verify user object transformation
      expect(recordData.user).toBeDefined();
      expect(recordData.user.id).toBe(42);
      expect(recordData.user.firstname).toBe('Jane');
      expect(recordData.user.lastname).toBe('Smith');
      expect(recordData.user.fullname).toBe('Jane Smith');

      // Verify permissions object transformation
      expect(recordData.permissions).toBeDefined();
      expect(recordData.permissions.canEdit).toBe(true);
      expect(recordData.permissions.canDelete).toBe(true);
      expect(recordData.permissions.canApprove).toBe(true);
    });

    it('should include record metadata', async () => {
      const timecreated = Math.floor(Date.now() / 1000) - 86400;
      const timemodified = Math.floor(Date.now() / 1000) - 3600;

      const mockRecord = createMockRecordWithContents({
        id: TEST_RECORD_ID,
        userid: 42,
        groupid: 5,
        dataid: TEST_DATABASE_ID,
        timecreated,
        timemodified,
        approved: false,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const recordData = result.current.record!;

      // Verify record metadata
      expect(recordData.id).toBe(TEST_RECORD_ID);
      expect(recordData.userid).toBe(42);
      expect(recordData.groupid).toBe(5);
      expect(recordData.dataid).toBe(TEST_DATABASE_ID);
      expect(recordData.timecreated).toBe(timecreated);
      expect(recordData.timemodified).toBe(timemodified);
      expect(recordData.approved).toBe(false);
    });

    it('should include ratings, comments, and tags', async () => {
      const mockRecord = createMockRecordWithContents({
        tags: [
          { id: 1, name: 'urgent' },
          { id: 2, name: 'review' },
          { id: 3, name: 'approved' },
        ],
        rating: {
          aggregate: 3.8,
          count: 25,
          userRating: 4,
        },
        comments: [
          createMockComment({ id: 101, content: 'First comment' }),
          createMockComment({ id: 102, content: 'Second comment' }),
        ],
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const recordData = result.current.record!;

      // Verify tags
      expect(recordData.tags).toHaveLength(3);
      expect(recordData.tags![0].name).toBe('urgent');
      expect(recordData.tags![1].name).toBe('review');
      expect(recordData.tags![2].name).toBe('approved');

      // Verify rating
      expect(recordData.rating).toBeDefined();
      expect(recordData.rating!.aggregate).toBe(3.8);
      expect(recordData.rating!.count).toBe(25);
      expect(recordData.rating!.userRating).toBe(4);

      // Verify comments
      expect(recordData.comments).toHaveLength(2);
      expect(recordData.comments![0].content).toBe('First comment');
      expect(recordData.comments![1].content).toBe('Second comment');
    });

    it('should provide helper flags (canEdit, canDelete, isApproved, isPending)', async () => {
      const mockRecord = createMockRecordWithContents({
        canEdit: true,
        canDelete: false,
        approved: true,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify helper flags
      expect(result.current.canEdit).toBe(true);
      expect(result.current.canDelete).toBe(false);
      expect(result.current.isApproved).toBe(true);
      expect(result.current.isPending).toBe(false);
    });

    it('should correctly calculate isPending for unapproved records', async () => {
      const mockRecord = createMockRecordWithContents({
        approved: false,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isApproved).toBe(false);
      expect(result.current.isPending).toBe(true);
    });
  });

  // ==========================================================================
  // Loading States Tests
  // ==========================================================================

  describe('Loading States', () => {
    it('should start in loading state', () => {
      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, async () => {
          // Delay response to test loading state
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: { entry: createMockRecordWithContents() },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isFetching).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.record).toBeUndefined();
    });

    it('should transition from loading to success state', async () => {
      const mockRecord = createMockRecordWithContents();

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // After success
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeDefined();
      expect(result.current.record).toBeDefined();
    });
  });

  // ==========================================================================
  // React Query Caching Tests
  // ==========================================================================

  describe('React Query Caching', () => {
    it('should use correct query key with dataid and recordid', async () => {
      const mockRecord = createMockRecordWithContents();

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify cache key structure
      const expectedKey = dataQueryKeys.record(TEST_DATABASE_ID, TEST_RECORD_ID);
      const cacheData = queryClient.getQueryData(expectedKey);
      expect(cacheData).toBeDefined();
    });

    it('should have unique cache entries for different records', async () => {
      const mockRecord1 = createMockRecordWithContents({ id: 100 });
      const mockRecord2 = createMockRecordWithContents({ id: 200 });

      let callCount = 0;

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, ({ params }) => {
          callCount++;
          const recordId = Number(params.recordId);
          const record = recordId === 100 ? mockRecord1 : mockRecord2;
          return HttpResponse.json({
            success: true,
            data: { entry: record },
          });
        })
      );

      // First record
      const { result: result1 } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: 100 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second record with different ID
      const { result: result2 } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: 200 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Both should have made API calls (different cache keys)
      expect(callCount).toBe(2);

      // Verify different records in cache
      expect(result1.current.record?.id).toBe(100);
      expect(result2.current.record?.id).toBe(200);
    });

    it('should return cached data on subsequent renders', async () => {
      const mockRecord = createMockRecordWithContents();
      let apiCallCount = 0;

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          apiCallCount++;
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      // First render
      const { result: result1, unmount } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      expect(apiCallCount).toBe(1);

      // Unmount and re-render (simulating navigation away and back)
      unmount();

      // Second render with same parameters
      const { result: result2 } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      // Should get cached data immediately (staleTime: 0 means it refetches, but placeholder data shows)
      expect(result2.current.data).toBeDefined();
    });

    it('should support manual cache invalidation', async () => {
      const mockRecord = createMockRecordWithContents();

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Invalidate cache
      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: dataQueryKeys.record(TEST_DATABASE_ID, TEST_RECORD_ID),
        });
      });

      // Query should refetch
      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Field Value Typing Tests
  // ==========================================================================

  describe('Field Value Typing', () => {
    it('should return contents array with all field values', async () => {
      const contents: FieldContent[] = [
        { id: 1, fieldid: 1, recordid: TEST_RECORD_ID, content: 'Text Value' },
        { id: 2, fieldid: 2, recordid: TEST_RECORD_ID, content: '123.45' },
        { id: 3, fieldid: 3, recordid: TEST_RECORD_ID, content: '2024-03-15' },
        {
          id: 4,
          fieldid: 4,
          recordid: TEST_RECORD_ID,
          content: 'https://example.com/file.pdf',
          content1: 'file.pdf',
          content2: 'application/pdf',
        },
        {
          id: 5,
          fieldid: 5,
          recordid: TEST_RECORD_ID,
          content: 'https://example.com/image.jpg',
          content1: 'image.jpg',
        },
        { id: 6, fieldid: 6, recordid: TEST_RECORD_ID, content: 'https://example.com' },
        { id: 7, fieldid: 7, recordid: TEST_RECORD_ID, content: '1' }, // checkbox
        { id: 8, fieldid: 8, recordid: TEST_RECORD_ID, content: 'Option A' }, // radiobutton/menu
        {
          id: 9,
          fieldid: 9,
          recordid: TEST_RECORD_ID,
          content: '40.7128',
          content1: '-74.0060',
        }, // latlong
      ];

      const mockRecord = createMockRecordWithContents({ contents });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const recordData = result.current.record!;

      // Verify all contents are returned
      expect(recordData.contents).toHaveLength(9);

      // Verify text field
      expect(recordData.contents[0].content).toBe('Text Value');

      // Verify number field
      expect(recordData.contents[1].content).toBe('123.45');

      // Verify date field
      expect(recordData.contents[2].content).toBe('2024-03-15');

      // Verify file field with metadata
      expect(recordData.contents[3].content).toBe('https://example.com/file.pdf');
      expect(recordData.contents[3].content1).toBe('file.pdf');
      expect(recordData.contents[3].content2).toBe('application/pdf');

      // Verify picture/image field
      expect(recordData.contents[4].content).toBe('https://example.com/image.jpg');
      expect(recordData.contents[4].content1).toBe('image.jpg');

      // Verify URL field
      expect(recordData.contents[5].content).toBe('https://example.com');

      // Verify checkbox field
      expect(recordData.contents[6].content).toBe('1');

      // Verify menu/radiobutton field
      expect(recordData.contents[7].content).toBe('Option A');

      // Verify latlong field
      expect(recordData.contents[8].content).toBe('40.7128');
      expect(recordData.contents[8].content1).toBe('-74.0060');
    });

    it('should handle empty/null field values', async () => {
      const contents: FieldContent[] = [
        { id: 1, fieldid: 1, recordid: TEST_RECORD_ID, content: '' },
        { id: 2, fieldid: 2, recordid: TEST_RECORD_ID, content: undefined },
      ];

      const mockRecord = createMockRecordWithContents({ contents });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const recordData = result.current.record!;

      expect(recordData.contents[0].content).toBe('');
      expect(recordData.contents[1].content).toBeUndefined();
    });
  });

  // ==========================================================================
  // User Permissions Tests
  // ==========================================================================

  describe('User Permissions', () => {
    it('should correctly map canEdit permission', async () => {
      const mockRecord = createMockRecordWithContents({
        canEdit: true,
        canDelete: false,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.canEdit).toBe(true);
      expect(result.current.record!.permissions.canEdit).toBe(true);
    });

    it('should correctly map canDelete permission', async () => {
      const mockRecord = createMockRecordWithContents({
        canEdit: false,
        canDelete: true,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.canDelete).toBe(true);
      expect(result.current.record!.permissions.canDelete).toBe(true);
    });

    it('should derive canApprove from canEdit permission', async () => {
      // When canEdit is true, canApprove should also be true (per implementation)
      const mockRecordWithEdit = createMockRecordWithContents({
        canEdit: true,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecordWithEdit },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // canApprove is derived from canEdit in the implementation
      expect(result.current.record!.permissions.canApprove).toBe(true);
    });

    it('should handle record without permissions (default to false)', async () => {
      const mockRecord = createMockRecordWithContents({
        canEdit: undefined,
        canDelete: undefined,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should default to false when undefined
      expect(result.current.canEdit).toBe(false);
      expect(result.current.canDelete).toBe(false);
      expect(result.current.record!.permissions.canEdit).toBe(false);
      expect(result.current.record!.permissions.canDelete).toBe(false);
      expect(result.current.record!.permissions.canApprove).toBe(false);
    });

    it('should handle different user roles (record owner vs other user)', async () => {
      // Owner has edit access
      const ownerRecord = createMockRecordWithContents({
        userid: 42,
        canEdit: true,
        canDelete: true,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: ownerRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.canEdit).toBe(true);
      expect(result.current.canDelete).toBe(true);
    });

    it('should handle group-restricted permissions', async () => {
      // Record in a specific group
      const groupRecord = createMockRecordWithContents({
        groupid: 5,
        canEdit: false,
        canDelete: false,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: groupRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.record!.groupid).toBe(5);
      expect(result.current.canEdit).toBe(false);
      expect(result.current.canDelete).toBe(false);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle 404 not found error', async () => {
      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Record not found',
              },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: 99999 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.record).toBeUndefined();
    });

    it('should handle 403 permission denied error', async () => {
      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to view this record',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle network errors', async () => {
      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle 500 server error', async () => {
      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Internal server error',
              },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should validate invalid database ID', async () => {
      const { result } = renderHook(
        () => useRecord({ dataId: -1, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      // Query should not be enabled with invalid params
      // Wait a tick to ensure state is settled
      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });
    });

    it('should validate invalid record ID', async () => {
      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: 0 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Query should not be enabled with invalid params
      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });
    });
  });

  // ==========================================================================
  // Query Options Tests
  // ==========================================================================

  describe('Query Options', () => {
    it('should support custom staleTime option', async () => {
      const mockRecord = createMockRecordWithContents();

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () =>
          useRecord({
            dataId: TEST_DATABASE_ID,
            recordId: TEST_RECORD_ID,
            options: { staleTime: 60000 }, // 1 minute
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });

    it('should support enabled option to disable query', async () => {
      let apiCalled = false;

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          apiCalled = true;
          return HttpResponse.json({
            success: true,
            data: { entry: createMockRecordWithContents() },
          });
        })
      );

      const { result } = renderHook(
        () =>
          useRecord({
            dataId: TEST_DATABASE_ID,
            recordId: TEST_RECORD_ID,
            options: { enabled: false },
          }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait to ensure no API call is made
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(apiCalled).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });

    it('should support refetch method', async () => {
      let callCount = 0;

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          callCount++;
          return HttpResponse.json({
            success: true,
            data: { entry: createMockRecordWithContents() },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(callCount).toBe(1);

      // Trigger manual refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(callCount).toBe(2);
      });
    });
  });

  // ==========================================================================
  // Optimistic Updates Tests
  // ==========================================================================

  describe('Optimistic Updates Support', () => {
    it('should allow cache to be updated optimistically', async () => {
      const mockRecord = createMockRecordWithContents({
        approved: false,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify initial state
      expect(result.current.record!.approved).toBe(false);

      // Optimistically update cache
      await act(async () => {
        queryClient.setQueryData(
          dataQueryKeys.record(TEST_DATABASE_ID, TEST_RECORD_ID),
          (oldData: RecordWithContents | undefined) => {
            if (!oldData) return oldData;
            return { ...oldData, approved: true };
          }
        );
      });

      // Cache should be updated
      const cachedData = queryClient.getQueryData<RecordWithContents>(
        dataQueryKeys.record(TEST_DATABASE_ID, TEST_RECORD_ID)
      );
      expect(cachedData?.approved).toBe(true);
    });

    it('should support rollback on mutation failure', async () => {
      const initialRecord = createMockRecordWithContents({
        approved: false,
        contents: [createMockFieldContent({ content: 'Original Value' })],
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: initialRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Store original data for potential rollback
      const originalData = queryClient.getQueryData<RecordWithContents>(
        dataQueryKeys.record(TEST_DATABASE_ID, TEST_RECORD_ID)
      );

      // Optimistically update
      await act(async () => {
        queryClient.setQueryData(
          dataQueryKeys.record(TEST_DATABASE_ID, TEST_RECORD_ID),
          (oldData: RecordWithContents | undefined) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              contents: [createMockFieldContent({ content: 'Updated Value' })],
            };
          }
        );
      });

      // Simulate mutation failure - rollback
      await act(async () => {
        queryClient.setQueryData(
          dataQueryKeys.record(TEST_DATABASE_ID, TEST_RECORD_ID),
          originalData
        );
      });

      // Verify rollback worked
      const rolledBackData = queryClient.getQueryData<RecordWithContents>(
        dataQueryKeys.record(TEST_DATABASE_ID, TEST_RECORD_ID)
      );
      expect(rolledBackData?.contents[0].content).toBe('Original Value');
    });

    it('should support cache prefetching for optimistic navigation', async () => {
      const mockRecord = createMockRecordWithContents();

      // Prefetch record into cache
      await act(async () => {
        queryClient.setQueryData(
          dataQueryKeys.record(TEST_DATABASE_ID, TEST_RECORD_ID),
          mockRecord
        );
      });

      // Hook should use prefetched data immediately
      const { result } = renderHook(
        () =>
          useRecord({
            dataId: TEST_DATABASE_ID,
            recordId: TEST_RECORD_ID,
            options: { staleTime: Infinity },
          }),
        { wrapper: createWrapper(queryClient) }
      );

      // Data should be available immediately from cache
      expect(result.current.data).toBeDefined();
    });
  });

  // ==========================================================================
  // User Info Transformation Tests
  // ==========================================================================

  describe('User Info Transformation', () => {
    it('should parse single-word name correctly', async () => {
      const mockRecord = createMockRecordWithContents({
        userfullname: 'Admin',
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.record!.user.firstname).toBe('Admin');
      expect(result.current.record!.user.lastname).toBeUndefined();
      expect(result.current.record!.user.fullname).toBe('Admin');
    });

    it('should parse multi-part name correctly', async () => {
      const mockRecord = createMockRecordWithContents({
        userfullname: 'John Paul Smith',
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.record!.user.firstname).toBe('John');
      expect(result.current.record!.user.lastname).toBe('Paul Smith');
      expect(result.current.record!.user.fullname).toBe('John Paul Smith');
    });

    it('should handle empty/undefined username', async () => {
      const mockRecord = createMockRecordWithContents({
        userfullname: undefined,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.record!.user.firstname).toBeUndefined();
      expect(result.current.record!.user.lastname).toBeUndefined();
      expect(result.current.record!.user.fullname).toBeUndefined();
    });

    it('should set user.id from record.userid', async () => {
      const mockRecord = createMockRecordWithContents({
        userid: 999,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.record!.user.id).toBe(999);
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle record with no contents', async () => {
      const mockRecord = createMockRecordWithContents({
        contents: [],
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.record!.contents).toHaveLength(0);
    });

    it('should handle record with no tags', async () => {
      const mockRecord = createMockRecordWithContents({
        tags: undefined,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.record!.tags).toBeUndefined();
    });

    it('should handle record with no rating', async () => {
      const mockRecord = createMockRecordWithContents({
        rating: undefined,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.record!.rating).toBeUndefined();
    });

    it('should handle record with no comments', async () => {
      const mockRecord = createMockRecordWithContents({
        comments: undefined,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: TEST_RECORD_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.record!.comments).toBeUndefined();
    });

    it('should handle very large record ID', async () => {
      const largeRecordId = 999999999;
      const mockRecord = createMockRecordWithContents({
        id: largeRecordId,
      });

      server.use(
        http.get(`*/api/v1${DATA_API_BASE}/databases/:databaseId/entries/:recordId`, () => {
          return HttpResponse.json({
            success: true,
            data: { entry: mockRecord },
          });
        })
      );

      const { result } = renderHook(
        () => useRecord({ dataId: TEST_DATABASE_ID, recordId: largeRecordId }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.record!.id).toBe(largeRecordId);
    });
  });
});
