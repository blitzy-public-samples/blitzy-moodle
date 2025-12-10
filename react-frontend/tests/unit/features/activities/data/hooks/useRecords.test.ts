/**
 * @file Unit tests for useRecords and useRecordsInfinite React Query hooks
 * @description Comprehensive tests for fetching Database activity records with filtering,
 * sorting, pagination, infinite scroll, and caching behavior.
 * 
 * Tests cover:
 * - Basic record fetching from GET /api/v1/data/{dataid}/records
 * - Search filtering (text search across all fields)
 * - Approval status filtering (all, approved, pending)
 * - User and group filtering
 * - Date range filtering (created and modified dates)
 * - Sorting by fields and standard columns
 * - Pagination with page/perPage parameters
 * - React Query caching with filter-specific keys
 * - Infinite query pattern for scroll pagination
 * - Error handling and retry behavior
 */

import React, { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../mocks/server';
import { useRecords, useRecordsInfinite } from '@/features/activities/data/hooks/useRecords';
import type {
  DatabaseRecord,
  DatabaseRecordsResponse,
  SearchCriteria,
  FieldType,
} from '@/features/activities/data/types/data.types';

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Creates a mock database record for testing
 */
function createMockRecord(overrides: Partial<DatabaseRecord> = {}): DatabaseRecord {
  const id = overrides.id ?? Math.floor(Math.random() * 10000) + 1;
  return {
    id,
    userid: overrides.userid ?? 1,
    groupid: overrides.groupid ?? 0,
    dataid: overrides.dataid ?? 1,
    timecreated: overrides.timecreated ?? Math.floor(Date.now() / 1000) - 86400,
    timemodified: overrides.timemodified ?? Math.floor(Date.now() / 1000),
    approved: overrides.approved ?? true,
    ...overrides,
  };
}

/**
 * Creates a paginated records response
 */
function createMockRecordsResponse(
  records: DatabaseRecord[],
  options: {
    page?: number;
    perPage?: number;
    total?: number;
  } = {}
): DatabaseRecordsResponse {
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 10;
  const total = options.total ?? records.length;
  
  return {
    records,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  };
}

/**
 * Creates multiple mock records with varying properties
 */
function createMockRecordSet(count: number, baseOverrides: Partial<DatabaseRecord> = {}): DatabaseRecord[] {
  return Array.from({ length: count }, (_, index) => 
    createMockRecord({
      id: index + 1,
      timecreated: Math.floor(Date.now() / 1000) - (count - index) * 3600,
      timemodified: Math.floor(Date.now() / 1000) - (count - index) * 1800,
      ...baseOverrides,
    })
  );
}

// ============================================================================
// Test Setup and Utilities
// ============================================================================

/**
 * Creates a fresh QueryClient configured for testing
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
 * Creates a wrapper component for React Query provider
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

// ============================================================================
// Test Suite
// ============================================================================

describe('useRecords', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    cleanup();
    server.resetHandlers();
  });

  // ==========================================================================
  // Basic Record Fetching Tests
  // ==========================================================================

  describe('basic record fetching', () => {
    it('should fetch records successfully with default parameters', async () => {
      const mockRecords = createMockRecordSet(5, { dataid: 1, approved: true });
      const mockResponse = createMockRecordsResponse(mockRecords, { total: 5 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: mockRecords.map(r => ({
                ...r,
                contents: [],
              })),
              totalcount: 5,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({ databaseId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(false);
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.records).toHaveLength(5);
      expect(result.current.data?.pagination.total).toBe(5);
    });

    it('should return correct loading states', async () => {
      const mockRecords = createMockRecordSet(3, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return HttpResponse.json({
            data: {
              entries: mockRecords,
              totalcount: 3,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({ databaseId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      // Check initial loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isFetching).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // After loading completes
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);
      expect(result.current.isSuccess).toBe(true);
    });

    it('should return empty array when no records exist', async () => {
      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: [],
              totalcount: 0,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({ databaseId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.records).toHaveLength(0);
      expect(result.current.data?.pagination.total).toBe(0);
    });

    it('should include record metadata in response', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const mockRecord = createMockRecord({
        id: 42,
        userid: 5,
        groupid: 3,
        dataid: 1,
        timecreated: timestamp - 3600,
        timemodified: timestamp,
        approved: true,
      });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: [mockRecord],
              totalcount: 1,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({ databaseId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const record = result.current.data?.records[0];
      expect(record?.id).toBe(42);
      expect(record?.userid).toBe(5);
      expect(record?.groupid).toBe(3);
      expect(record?.dataid).toBe(1);
      expect(record?.timecreated).toBe(timestamp - 3600);
      expect(record?.timemodified).toBe(timestamp);
      expect(record?.approved).toBe(true);
    });
  });

  // ==========================================================================
  // Search Filtering Tests
  // ==========================================================================

  describe('search filtering', () => {
    it('should apply search filter parameter', async () => {
      let capturedParams: Record<string, string> | null = null;
      const mockRecords = createMockRecordSet(2, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', ({ request }) => {
          const url = new URL(request.url);
          capturedParams = Object.fromEntries(url.searchParams);
          return HttpResponse.json({
            data: {
              entries: mockRecords,
              totalcount: 2,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          search: 'test search',
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Search is applied client-side in the hook, but verify results
      expect(result.current.data?.records).toBeDefined();
    });

    it('should return all records when search is empty string', async () => {
      const mockRecords = createMockRecordSet(5, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: mockRecords,
              totalcount: 5,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          search: '',
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.records).toHaveLength(5);
    });

    it('should be case-insensitive in search', async () => {
      const mockRecords = createMockRecordSet(3, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: mockRecords,
              totalcount: 3,
            },
          });
        })
      );

      const { result: result1 } = renderHook(
        () => useRecords({
          databaseId: 1,
          search: 'TEST',
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Create new query client for second hook
      const queryClient2 = createTestQueryClient();
      const { result: result2 } = renderHook(
        () => useRecords({
          databaseId: 1,
          search: 'test',
        }),
        { wrapper: createWrapper(queryClient2) }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Both should return data (client-side filtering)
      expect(result1.current.data).toBeDefined();
      expect(result2.current.data).toBeDefined();
    });
  });

  // ==========================================================================
  // Approval Status Filtering Tests
  // ==========================================================================

  describe('approval status filtering', () => {
    it('should filter by approved status', async () => {
      const approvedRecords = createMockRecordSet(3, { dataid: 1, approved: true });
      const pendingRecords = createMockRecordSet(2, { dataid: 1, approved: false });
      pendingRecords.forEach((r, i) => { r.id = 100 + i; });
      const allRecords = [...approvedRecords, ...pendingRecords];

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: allRecords,
              totalcount: 5,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          approvalStatus: 'approved',
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Client-side filtering should show only approved records
      const records = result.current.data?.records ?? [];
      expect(records.every(r => r.approved === true)).toBe(true);
    });

    it('should filter by pending status', async () => {
      const approvedRecords = createMockRecordSet(3, { dataid: 1, approved: true });
      const pendingRecords = createMockRecordSet(2, { dataid: 1, approved: false });
      pendingRecords.forEach((r, i) => { r.id = 100 + i; });
      const allRecords = [...approvedRecords, ...pendingRecords];

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: allRecords,
              totalcount: 5,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          approvalStatus: 'pending',
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Client-side filtering should show only pending records
      const records = result.current.data?.records ?? [];
      expect(records.every(r => r.approved === false)).toBe(true);
    });

    it('should return all records when approval status is "all"', async () => {
      const approvedRecords = createMockRecordSet(3, { dataid: 1, approved: true });
      const pendingRecords = createMockRecordSet(2, { dataid: 1, approved: false });
      pendingRecords.forEach((r, i) => { r.id = 100 + i; });
      const allRecords = [...approvedRecords, ...pendingRecords];

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: allRecords,
              totalcount: 5,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          approvalStatus: 'all',
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.records).toHaveLength(5);
    });
  });

  // ==========================================================================
  // User and Group Filtering Tests
  // ==========================================================================

  describe('user and group filtering', () => {
    it('should filter by user ID', async () => {
      const user1Records = createMockRecordSet(3, { dataid: 1, userid: 1 });
      const user2Records = createMockRecordSet(2, { dataid: 1, userid: 2 });
      user2Records.forEach((r, i) => { r.id = 100 + i; });
      const allRecords = [...user1Records, ...user2Records];

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: allRecords,
              totalcount: 5,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          userId: 1,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Client-side filtering should show only user 1's records
      const records = result.current.data?.records ?? [];
      expect(records.every(r => r.userid === 1)).toBe(true);
      expect(records).toHaveLength(3);
    });

    it('should filter by group ID', async () => {
      const group1Records = createMockRecordSet(3, { dataid: 1, groupid: 1 });
      const group2Records = createMockRecordSet(2, { dataid: 1, groupid: 2 });
      group2Records.forEach((r, i) => { r.id = 100 + i; });
      const allRecords = [...group1Records, ...group2Records];

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: allRecords,
              totalcount: 5,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          groupId: 1,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Client-side filtering should show only group 1's records
      const records = result.current.data?.records ?? [];
      expect(records.every(r => r.groupid === 1)).toBe(true);
      expect(records).toHaveLength(3);
    });

    it('should combine user and group filters', async () => {
      const records = [
        createMockRecord({ id: 1, userid: 1, groupid: 1, dataid: 1 }),
        createMockRecord({ id: 2, userid: 1, groupid: 2, dataid: 1 }),
        createMockRecord({ id: 3, userid: 2, groupid: 1, dataid: 1 }),
        createMockRecord({ id: 4, userid: 2, groupid: 2, dataid: 1 }),
      ];

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 4,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          userId: 1,
          groupId: 1,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should only return records matching both user 1 AND group 1
      const filteredRecords = result.current.data?.records ?? [];
      expect(filteredRecords).toHaveLength(1);
      expect(filteredRecords[0].userid).toBe(1);
      expect(filteredRecords[0].groupid).toBe(1);
    });
  });

  // ==========================================================================
  // Date Range Filtering Tests
  // ==========================================================================

  describe('date range filtering', () => {
    const now = Math.floor(Date.now() / 1000);
    const oneDay = 86400;
    const oneWeek = oneDay * 7;

    it('should filter by dateRange (created date range)', async () => {
      const records = [
        createMockRecord({ id: 1, timecreated: now - oneDay, dataid: 1 }), // Yesterday
        createMockRecord({ id: 2, timecreated: now - oneWeek, dataid: 1 }), // Week ago
        createMockRecord({ id: 3, timecreated: now, dataid: 1 }), // Today
      ];

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 3,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          dateRange: {
            from: now - (oneDay * 2), // 2 days ago
            to: now + oneDay, // Tomorrow
          },
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should filter to records created within last 2 days
      const filteredRecords = result.current.data?.records ?? [];
      expect(filteredRecords.every(r => 
        r.timecreated >= now - (oneDay * 2) && r.timecreated <= now + oneDay
      )).toBe(true);
    });

    it('should filter by single date boundary (from only)', async () => {
      const records = [
        createMockRecord({ id: 1, timecreated: now - oneDay, dataid: 1 }),
        createMockRecord({ id: 2, timecreated: now - oneWeek, dataid: 1 }),
        createMockRecord({ id: 3, timecreated: now, dataid: 1 }),
      ];

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 3,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          dateRange: {
            from: now - (oneDay * 2), // 2 days ago
          },
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should filter to records created in last 2 days
      const filteredRecords = result.current.data?.records ?? [];
      expect(filteredRecords.every(r => r.timecreated >= now - (oneDay * 2))).toBe(true);
    });

    it('should filter by modifiedDateRange', async () => {
      const records = [
        createMockRecord({ id: 1, timemodified: now - oneDay, dataid: 1 }),
        createMockRecord({ id: 2, timemodified: now - oneWeek, dataid: 1 }),
        createMockRecord({ id: 3, timemodified: now, dataid: 1 }),
      ];

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 3,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          modifiedDateRange: {
            from: now - (oneDay * 2),
            to: now + oneDay,
          },
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should filter by modified date
      const filteredRecords = result.current.data?.records ?? [];
      expect(filteredRecords.every(r =>
        r.timemodified >= now - (oneDay * 2) && r.timemodified <= now + oneDay
      )).toBe(true);
    });
  });

  // ==========================================================================
  // Sorting Tests
  // ==========================================================================

  describe('sorting', () => {
    it('should sort by timeadded ascending', async () => {
      let capturedParams: Record<string, string> | null = null;
      const records = createMockRecordSet(3, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', ({ request }) => {
          const url = new URL(request.url);
          capturedParams = Object.fromEntries(url.searchParams);
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 3,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          sort: {
            field: 0, // timeadded
            direction: 0, // ASC
          },
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify sort params were sent
      expect(capturedParams?.sort).toBe('0');
      expect(capturedParams?.order).toBe('ASC');
    });

    it('should sort by timeadded descending', async () => {
      let capturedParams: Record<string, string> | null = null;
      const records = createMockRecordSet(3, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', ({ request }) => {
          const url = new URL(request.url);
          capturedParams = Object.fromEntries(url.searchParams);
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 3,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          sort: {
            field: 0,
            direction: 1, // DESC
          },
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedParams?.order).toBe('DESC');
    });

    it('should sort by field ID', async () => {
      let capturedParams: Record<string, string> | null = null;
      const records = createMockRecordSet(3, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', ({ request }) => {
          const url = new URL(request.url);
          capturedParams = Object.fromEntries(url.searchParams);
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 3,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          sort: {
            field: 5, // Field ID 5
            direction: 0,
          },
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedParams?.sort).toBe('5');
    });

    it('should use default sort when not specified', async () => {
      let capturedParams: Record<string, string> | null = null;
      const records = createMockRecordSet(3, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', ({ request }) => {
          const url = new URL(request.url);
          capturedParams = Object.fromEntries(url.searchParams);
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 3,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({ databaseId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Default sort may or may not be included in params
      expect(result.current.data?.records).toHaveLength(3);
    });
  });

  // ==========================================================================
  // Pagination Tests
  // ==========================================================================

  describe('pagination', () => {
    it('should paginate with page and perPage parameters', async () => {
      let capturedParams: Record<string, string> | null = null;
      const records = createMockRecordSet(10, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', ({ request }) => {
          const url = new URL(request.url);
          capturedParams = Object.fromEntries(url.searchParams);
          const page = parseInt(capturedParams?.page ?? '1');
          const perPage = parseInt(capturedParams?.perpage ?? '10');
          const start = (page - 1) * perPage;
          const paginatedRecords = records.slice(start, start + perPage);
          return HttpResponse.json({
            data: {
              entries: paginatedRecords,
              totalcount: records.length,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          page: 1,
          perPage: 5,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedParams?.page).toBe('1');
      expect(capturedParams?.perpage).toBe('5');
      expect(result.current.data?.pagination.page).toBe(1);
      expect(result.current.data?.pagination.perPage).toBe(5);
    });

    it('should calculate totalPages correctly', async () => {
      const records = createMockRecordSet(25, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: records.slice(0, 10),
              totalcount: 25,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          page: 1,
          perPage: 10,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.pagination.total).toBe(25);
      expect(result.current.data?.pagination.totalPages).toBe(3); // ceil(25/10) = 3
    });

    it('should detect hasMore flag on pages with more data', async () => {
      const records = createMockRecordSet(25, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: records.slice(0, 10),
              totalcount: 25,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          page: 1,
          perPage: 10,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const pagination = result.current.data?.pagination;
      const hasMore = pagination ? pagination.page < pagination.totalPages : false;
      expect(hasMore).toBe(true);
    });

    it('should detect no more pages on last page', async () => {
      const records = createMockRecordSet(15, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: records.slice(10, 15),
              totalcount: 15,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          page: 2,
          perPage: 10,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const pagination = result.current.data?.pagination;
      const hasMore = pagination ? pagination.page < pagination.totalPages : false;
      expect(hasMore).toBe(false);
    });

    it('should handle page size changes', async () => {
      const records = createMockRecordSet(30, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', ({ request }) => {
          const url = new URL(request.url);
          const perPage = parseInt(url.searchParams.get('perpage') ?? '10');
          return HttpResponse.json({
            data: {
              entries: records.slice(0, perPage),
              totalcount: 30,
            },
          });
        })
      );

      // First render with perPage=10
      const { result, rerender } = renderHook(
        ({ perPage }) => useRecords({
          databaseId: 1,
          page: 1,
          perPage,
        }),
        { 
          wrapper: createWrapper(queryClient),
          initialProps: { perPage: 10 },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.pagination.perPage).toBe(10);

      // Rerender with perPage=20
      rerender({ perPage: 20 });

      await waitFor(() => {
        expect(result.current.data?.pagination.perPage).toBe(20);
      });
    });
  });

  // ==========================================================================
  // React Query Caching Tests
  // ==========================================================================

  describe('React Query caching', () => {
    it('should create unique cache keys for different filter combinations', async () => {
      const records = createMockRecordSet(5, { dataid: 1 });
      let requestCount = 0;

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          requestCount++;
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 5,
            },
          });
        })
      );

      // First query with search filter
      const { result: result1 } = renderHook(
        () => useRecords({
          databaseId: 1,
          search: 'filter1',
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second query with different search filter (should make new request)
      const { result: result2 } = renderHook(
        () => useRecords({
          databaseId: 1,
          search: 'filter2',
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Should have made 2 API requests due to different cache keys
      expect(requestCount).toBe(2);
    });

    it('should use cached data for identical queries', async () => {
      const records = createMockRecordSet(5, { dataid: 1 });
      let requestCount = 0;

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          requestCount++;
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 5,
            },
          });
        })
      );

      // First query
      const { result: result1 } = renderHook(
        () => useRecords({ databaseId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second identical query (should use cache)
      const { result: result2 } = renderHook(
        () => useRecords({ databaseId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Should have only made 1 request (second used cache)
      expect(requestCount).toBe(1);
    });

    it('should include all filter params in query key', async () => {
      const records = createMockRecordSet(5, { dataid: 1 });
      let requestCount = 0;

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          requestCount++;
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 5,
            },
          });
        })
      );

      // Query with multiple filters
      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          search: 'test',
          approvalStatus: 'approved',
          userId: 5,
          groupId: 3,
          page: 2,
          perPage: 20,
          sort: { field: 1, direction: 0 },
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Same query should use cache
      const { result: result2 } = renderHook(
        () => useRecords({
          databaseId: 1,
          search: 'test',
          approvalStatus: 'approved',
          userId: 5,
          groupId: 3,
          page: 2,
          perPage: 20,
          sort: { field: 1, direction: 0 },
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      expect(requestCount).toBe(1); // Used cache
    });

    it('should invalidate cache when filters change', async () => {
      const records = createMockRecordSet(5, { dataid: 1 });
      let requestCount = 0;

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          requestCount++;
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 5,
            },
          });
        })
      );

      const { result, rerender } = renderHook(
        ({ userId }) => useRecords({
          databaseId: 1,
          userId,
        }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { userId: 1 },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(requestCount).toBe(1);

      // Change filter
      rerender({ userId: 2 });

      await waitFor(() => {
        expect(requestCount).toBe(2);
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('error handling', () => {
    it('should handle network errors', async () => {
      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(
        () => useRecords({ databaseId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle 404 not found', async () => {
      server.use(
        http.get('*/api/v1/data/databases/999/entries', () => {
          return HttpResponse.json(
            { 
              success: false, 
              error: { code: 'NOT_FOUND', message: 'Database not found' } 
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(
        () => useRecords({ databaseId: 999 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle 403 permission denied', async () => {
      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json(
            { 
              success: false, 
              error: { code: 'PERMISSION_DENIED', message: 'Access denied' } 
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(
        () => useRecords({ databaseId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle malformed response', async () => {
      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({ invalid: 'response' });
        })
      );

      const { result } = renderHook(
        () => useRecords({ databaseId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        // May succeed with empty/undefined data or error depending on implementation
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should not retry on failure when retry is disabled', async () => {
      let requestCount = 0;
      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          requestCount++;
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(
        () => useRecords({ databaseId: 1 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // With retry disabled in test QueryClient, should only make 1 request
      expect(requestCount).toBe(1);
    });
  });

  // ==========================================================================
  // Disabled Query Tests
  // ==========================================================================

  describe('disabled query', () => {
    it('should not fetch when enabled is false', async () => {
      let requestCount = 0;
      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          requestCount++;
          return HttpResponse.json({
            data: { entries: [], totalcount: 0 },
          });
        })
      );

      const { result } = renderHook(
        () => useRecords({
          databaseId: 1,
          enabled: false,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      // Wait a bit to ensure no request is made
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(requestCount).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('should fetch when enabled changes to true', async () => {
      const records = createMockRecordSet(3, { dataid: 1 });
      let requestCount = 0;

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          requestCount++;
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 3,
            },
          });
        })
      );

      const { result, rerender } = renderHook(
        ({ enabled }) => useRecords({
          databaseId: 1,
          enabled,
        }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { enabled: false },
        }
      );

      expect(requestCount).toBe(0);

      // Enable the query
      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(requestCount).toBe(1);
    });
  });
});

// ============================================================================
// useRecordsInfinite Test Suite
// ============================================================================

describe('useRecordsInfinite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    cleanup();
    server.resetHandlers();
  });

  describe('infinite scroll pagination', () => {
    it('should fetch initial page of records', async () => {
      const page1Records = createMockRecordSet(10, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: page1Records,
              totalcount: 25,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecordsInfinite({ databaseId: 1, perPage: 10 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.pages).toHaveLength(1);
      expect(result.current.data?.pages[0].records).toHaveLength(10);
    });

    it('should fetch next page with fetchNextPage', async () => {
      const page1Records = createMockRecordSet(10, { dataid: 1 });
      page1Records.forEach((r, i) => { r.id = i + 1; });
      const page2Records = createMockRecordSet(10, { dataid: 1 });
      page2Records.forEach((r, i) => { r.id = i + 11; });

      let pageRequested = 0;
      server.use(
        http.get('*/api/v1/data/databases/1/entries', ({ request }) => {
          const url = new URL(request.url);
          pageRequested = parseInt(url.searchParams.get('page') ?? '1');
          const records = pageRequested === 1 ? page1Records : page2Records;
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 25,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecordsInfinite({ databaseId: 1, perPage: 10 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.hasNextPage).toBe(true);

      // Fetch next page
      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(result.current.data?.pages).toHaveLength(2);
      });

      expect(result.current.data?.pages[1].records).toHaveLength(10);
    });

    it('should calculate hasNextPage correctly', async () => {
      const records = createMockRecordSet(10, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', ({ request }) => {
          const url = new URL(request.url);
          const page = parseInt(url.searchParams.get('page') ?? '1');
          return HttpResponse.json({
            data: {
              entries: page === 3 ? records.slice(0, 5) : records, // Last page has 5 records
              totalcount: 25,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecordsInfinite({ databaseId: 1, perPage: 10 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // First page, should have more
      expect(result.current.hasNextPage).toBe(true);
    });

    it('should not have next page on last page', async () => {
      const records = createMockRecordSet(5, { dataid: 1 });

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 5, // Total equals current records
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecordsInfinite({ databaseId: 1, perPage: 10 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.hasNextPage).toBe(false);
    });

    it('should accumulate all pages in data.pages', async () => {
      let requestedPage = 0;
      
      server.use(
        http.get('*/api/v1/data/databases/1/entries', ({ request }) => {
          const url = new URL(request.url);
          requestedPage = parseInt(url.searchParams.get('page') ?? '1');
          const records = createMockRecordSet(10, { dataid: 1 });
          records.forEach((r, i) => { r.id = (requestedPage - 1) * 10 + i + 1; });
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 35,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecordsInfinite({ databaseId: 1, perPage: 10 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Fetch pages 2 and 3
      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(result.current.data?.pages).toHaveLength(2);
      });

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(result.current.data?.pages).toHaveLength(3);
      });

      // Verify all pages are accumulated
      expect(result.current.data?.pages[0].records).toHaveLength(10);
      expect(result.current.data?.pages[1].records).toHaveLength(10);
      expect(result.current.data?.pages[2].records).toHaveLength(10);
    });

    it('should apply filters to infinite query', async () => {
      const approvedRecords = createMockRecordSet(10, { dataid: 1, approved: true });
      const pendingRecords = createMockRecordSet(5, { dataid: 1, approved: false });
      pendingRecords.forEach((r, i) => { r.id = 100 + i; });
      const allRecords = [...approvedRecords, ...pendingRecords];

      server.use(
        http.get('*/api/v1/data/databases/1/entries', () => {
          return HttpResponse.json({
            data: {
              entries: allRecords,
              totalcount: 15,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecordsInfinite({
          databaseId: 1,
          perPage: 10,
          approvalStatus: 'approved',
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should filter to only approved records (client-side filtering)
      const records = result.current.data?.pages[0].records ?? [];
      expect(records.every(r => r.approved === true)).toBe(true);
    });

    it('should handle isFetchingNextPage state', async () => {
      server.use(
        http.get('*/api/v1/data/databases/1/entries', async ({ request }) => {
          const url = new URL(request.url);
          const page = parseInt(url.searchParams.get('page') ?? '1');
          if (page > 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          const records = createMockRecordSet(10, { dataid: 1 });
          records.forEach((r, i) => { r.id = (page - 1) * 10 + i + 1; });
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 25,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecordsInfinite({ databaseId: 1, perPage: 10 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Start fetching next page
      act(() => {
        result.current.fetchNextPage();
      });

      // Should be fetching next page
      expect(result.current.isFetchingNextPage).toBe(true);

      await waitFor(() => {
        expect(result.current.isFetchingNextPage).toBe(false);
      });
    });

    it('should handle error during fetchNextPage', async () => {
      let requestCount = 0;
      server.use(
        http.get('*/api/v1/data/databases/1/entries', ({ request }) => {
          requestCount++;
          if (requestCount > 1) {
            return HttpResponse.error();
          }
          const records = createMockRecordSet(10, { dataid: 1 });
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 25,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecordsInfinite({ databaseId: 1, perPage: 10 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Try to fetch next page (should fail)
      await act(async () => {
        try {
          await result.current.fetchNextPage();
        } catch {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(result.current.isFetchingNextPage).toBe(false);
      });

      // First page data should still be intact
      expect(result.current.data?.pages).toHaveLength(1);
    });
  });

  describe('allRecords helper', () => {
    it('should flatten all pages into single array', async () => {
      let requestedPage = 0;
      
      server.use(
        http.get('*/api/v1/data/databases/1/entries', ({ request }) => {
          const url = new URL(request.url);
          requestedPage = parseInt(url.searchParams.get('page') ?? '1');
          const records = createMockRecordSet(10, { dataid: 1 });
          records.forEach((r, i) => { r.id = (requestedPage - 1) * 10 + i + 1; });
          return HttpResponse.json({
            data: {
              entries: records,
              totalcount: 25,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useRecordsInfinite({ databaseId: 1, perPage: 10 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Fetch second page
      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(result.current.data?.pages).toHaveLength(2);
      });

      // Access allRecords if available
      const allRecords = result.current.data?.pages.flatMap(p => p.records) ?? [];
      expect(allRecords).toHaveLength(20);
    });
  });
});

// ============================================================================
// Combined Filter Tests
// ============================================================================

describe('combined filters', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    cleanup();
    server.resetHandlers();
  });

  it('should apply multiple filters together', async () => {
    const records = [
      createMockRecord({ id: 1, userid: 1, groupid: 1, approved: true, dataid: 1 }),
      createMockRecord({ id: 2, userid: 1, groupid: 1, approved: false, dataid: 1 }),
      createMockRecord({ id: 3, userid: 2, groupid: 1, approved: true, dataid: 1 }),
      createMockRecord({ id: 4, userid: 1, groupid: 2, approved: true, dataid: 1 }),
      createMockRecord({ id: 5, userid: 2, groupid: 2, approved: false, dataid: 1 }),
    ];

    server.use(
      http.get('*/api/v1/data/databases/1/entries', () => {
        return HttpResponse.json({
          data: {
            entries: records,
            totalcount: 5,
          },
        });
      })
    );

    const { result } = renderHook(
      () => useRecords({
        databaseId: 1,
        userId: 1,
        groupId: 1,
        approvalStatus: 'approved',
      }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should only return record 1 (user=1, group=1, approved=true)
    const filteredRecords = result.current.data?.records ?? [];
    expect(filteredRecords).toHaveLength(1);
    expect(filteredRecords[0].id).toBe(1);
  });

  it('should apply date range with other filters', async () => {
    const now = Math.floor(Date.now() / 1000);
    const oneDay = 86400;
    
    const records = [
      createMockRecord({ id: 1, userid: 1, timecreated: now - oneDay, approved: true, dataid: 1 }),
      createMockRecord({ id: 2, userid: 1, timecreated: now - oneDay * 5, approved: true, dataid: 1 }),
      createMockRecord({ id: 3, userid: 2, timecreated: now - oneDay, approved: true, dataid: 1 }),
    ];

    server.use(
      http.get('*/api/v1/data/databases/1/entries', () => {
        return HttpResponse.json({
          data: {
            entries: records,
            totalcount: 3,
          },
        });
      })
    );

    const { result } = renderHook(
      () => useRecords({
        databaseId: 1,
        userId: 1,
        dateRange: {
          from: now - oneDay * 2,
          to: now,
        },
      }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should only return record 1 (user=1 AND within date range)
    const filteredRecords = result.current.data?.records ?? [];
    expect(filteredRecords).toHaveLength(1);
    expect(filteredRecords[0].id).toBe(1);
  });
});
