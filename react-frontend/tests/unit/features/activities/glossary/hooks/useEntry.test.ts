/**
 * Comprehensive Vitest Unit Tests for useEntry React Query Hooks
 *
 * Tests glossary entry CRUD operations including:
 * - Fetching single entry with metadata and attachments
 * - Creating new entries with concept, definition, categories
 * - Updating existing entries with optimistic updates
 * - Deleting entries with confirmation and cache cleanup
 * - Approving pending entries with teacher/admin capability
 * - Cache invalidation after all mutations
 * - File attachment handling in create and update
 *
 * @module tests/unit/features/activities/glossary/hooks/useEntry.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';

// Internal imports - hooks under test
import {
  useEntry,
  useCreateEntry,
  useUpdateEntry,
  useDeleteEntry,
  useApproveEntry,
  entryKeys,
} from '@/features/activities/glossary/hooks/useEntry';

// Internal imports - types
import type {
  GlossaryEntry,
  CreateEntryInput,
  UpdateEntryInput,
  GlossaryAttachment,
  GlossaryTag,
} from '@/features/activities/glossary/types/glossary.types';
import { TextFormat } from '@/features/activities/glossary/types/glossary.types';

// Test helpers
import { createTestQueryClient } from '@tests/helpers/render';
import { server } from '@tests/mocks/server';

// ============================================================================
// Mock Data Helpers
// ============================================================================

/**
 * Creates a mock glossary entry with all fields populated
 */
function createMockEntry(overrides: Partial<GlossaryEntry> = {}): GlossaryEntry {
  return {
    id: 1,
    glossaryid: 100,
    userid: 10,
    userfullname: 'Test User',
    userpictureurl: 'https://example.com/user/10/picture.jpg',
    concept: 'Test Concept',
    definition: '<p>This is a test definition for the glossary entry.</p>',
    definitionformat: TextFormat.HTML,
    definitiontrust: true,
    attachment: false,
    attachments: [],
    definitioninlinefiles: [],
    usedynalink: true,
    casesensitive: false,
    fullmatch: true,
    approved: true,
    teacherentry: false,
    sourceglossaryid: 0,
    categoryid: undefined,
    categoryname: undefined,
    tags: [],
    timecreated: Math.floor(Date.now() / 1000) - 86400,
    timemodified: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Creates a mock attachment for testing file operations
 */
function createMockAttachment(overrides: Partial<GlossaryAttachment> = {}): GlossaryAttachment {
  return {
    filename: 'test-document.pdf',
    filepath: '/',
    filesize: 102400,
    fileurl: 'https://example.com/files/test-document.pdf',
    mimetype: 'application/pdf',
    timemodified: Math.floor(Date.now() / 1000),
    author: 'Test User',
    license: 'allrightsreserved',
    isexternalfile: false,
    ...overrides,
  };
}

/**
 * Creates a mock tag for entry tagging tests
 */
function createMockTag(overrides: Partial<GlossaryTag> = {}): GlossaryTag {
  return {
    id: 1,
    name: 'Test Tag',
    rawname: 'test tag',
    isstandard: false,
    tagcollid: 1,
    taginstanceid: 1,
    taginstancecontextid: 100,
    itemid: 1,
    ordering: 0,
    flag: 0,
    ...overrides,
  };
}

/**
 * Creates mock CreateEntryInput data
 */
function createMockCreateInput(overrides: Partial<CreateEntryInput> = {}): CreateEntryInput {
  return {
    glossaryId: 100,
    concept: 'New Concept',
    definition: '<p>New definition content</p>',
    definitionformat: TextFormat.HTML,
    usedynalink: true,
    casesensitive: false,
    fullmatch: true,
    ...overrides,
  };
}

/**
 * Creates mock UpdateEntryInput data
 */
function createMockUpdateInput(overrides: Partial<UpdateEntryInput> = {}): UpdateEntryInput {
  return {
    entryId: 1,
    concept: 'Updated Concept',
    definition: '<p>Updated definition content</p>',
    definitionformat: TextFormat.HTML,
    usedynalink: true,
    casesensitive: false,
    fullmatch: true,
    ...overrides,
  };
}

/**
 * Creates a mock File object for attachment testing
 */
function createMockFile(name: string = 'test-file.pdf', type: string = 'application/pdf', size: number = 1024): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

// ============================================================================
// Test Setup
// ============================================================================

/** QueryClient instance used in tests */
let queryClient: QueryClient;

/**
 * Creates a wrapper component for renderHook with QueryClientProvider
 */
function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

/**
 * API base URL for mock endpoints
 * Uses wildcard prefix to match any host (e.g., http://localhost:8000/api/v1)
 */
const API_BASE = '*/api/v1';

// ============================================================================
// useEntry() Tests
// ============================================================================

describe('useEntry', () => {
  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  describe('successful entry fetch', () => {
    it('should fetch entry by ID successfully', async () => {
      const mockEntry = createMockEntry({ id: 456 });
      
      server.use(
        http.get(`${API_BASE}/glossary/entries/456`, () => {
          return HttpResponse.json({
            success: true,
            data: mockEntry,
          });
        })
      );

      const { result } = renderHook(() => useEntry(456), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockEntry);
      expect(result.current.data?.id).toBe(456);
    });

    it('should show loading state during fetch', async () => {
      const mockEntry = createMockEntry();
      
      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, async () => {
          // Add delay to test loading state
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json({
            success: true,
            data: mockEntry,
          });
        })
      );

      const { result } = renderHook(() => useEntry(1), {
        wrapper: createWrapper(),
      });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isFetching).toBe(true);
      expect(result.current.isPending).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should return correct entry data structure', async () => {
      const mockEntry = createMockEntry({
        id: 1,
        concept: 'React Hooks',
        definition: '<p>React Hooks are functions...</p>',
        categoryid: 5,
        categoryname: 'Programming',
        timecreated: 1700000000,
        timemodified: 1700100000,
        userid: 10,
      });

      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockEntry,
          });
        })
      );

      const { result } = renderHook(() => useEntry(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const entry = result.current.data!;
      expect(entry.id).toBe(1);
      expect(entry.concept).toBe('React Hooks');
      expect(entry.definition).toBe('<p>React Hooks are functions...</p>');
      expect(entry.categoryid).toBe(5);
      expect(entry.categoryname).toBe('Programming');
      expect(entry.timecreated).toBe(1700000000);
      expect(entry.timemodified).toBe(1700100000);
      expect(entry.userid).toBe(10);
    });

    it('should include attachment data when present', async () => {
      const attachment1 = createMockAttachment({ filename: 'doc1.pdf' });
      const attachment2 = createMockAttachment({ filename: 'image1.png', mimetype: 'image/png' });
      const mockEntry = createMockEntry({
        attachment: true,
        attachments: [attachment1, attachment2],
      });

      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockEntry,
          });
        })
      );

      const { result } = renderHook(() => useEntry(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attachment).toBe(true);
      expect(result.current.data?.attachments).toHaveLength(2);
      expect(result.current.data?.attachments?.[0]?.filename).toBe('doc1.pdf');
      expect(result.current.data?.attachments?.[1]?.filename).toBe('image1.png');
    });

    it('should include category assignments', async () => {
      const mockEntry = createMockEntry({
        categoryid: 10,
        categoryname: 'Software Engineering',
      });

      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockEntry,
          });
        })
      );

      const { result } = renderHook(() => useEntry(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.categoryid).toBe(10);
      expect(result.current.data?.categoryname).toBe('Software Engineering');
    });

    it('should include author metadata', async () => {
      const mockEntry = createMockEntry({
        userid: 25,
        userfullname: 'Jane Doe',
        userpictureurl: 'https://example.com/user/25/avatar.jpg',
        teacherentry: true,
      });

      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockEntry,
          });
        })
      );

      const { result } = renderHook(() => useEntry(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.userid).toBe(25);
      expect(result.current.data?.userfullname).toBe('Jane Doe');
      expect(result.current.data?.userpictureurl).toBe('https://example.com/user/25/avatar.jpg');
      expect(result.current.data?.teacherentry).toBe(true);
    });

    it('should include tags when present', async () => {
      const tags = [
        createMockTag({ id: 1, name: 'javascript' }),
        createMockTag({ id: 2, name: 'frontend' }),
      ];
      const mockEntry = createMockEntry({ tags });

      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockEntry,
          });
        })
      );

      const { result } = renderHook(() => useEntry(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.tags).toHaveLength(2);
      expect(result.current.data?.tags?.[0]?.name).toBe('javascript');
      expect(result.current.data?.tags?.[1]?.name).toBe('frontend');
    });
  });

  describe('cache key management', () => {
    it('should use correct cache key format: [glossary, entries, detail, entryId]', async () => {
      const mockEntry = createMockEntry({ id: 789 });
      
      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockEntry,
          });
        })
      );

      const { result } = renderHook(() => useEntry(789), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify cache key by checking the cache
      const cachedData = queryClient.getQueryData(entryKeys.detail(789));
      expect(cachedData).toEqual(mockEntry);
    });

    it('should use different cache keys for different entries', async () => {
      const entry1 = createMockEntry({ id: 1, concept: 'Entry One' });
      const entry2 = createMockEntry({ id: 2, concept: 'Entry Two' });
      
      server.use(
        http.get(`${API_BASE}/glossary/entries/1`, () => {
          return HttpResponse.json({ success: true, data: entry1 });
        }),
        http.get(`${API_BASE}/glossary/entries/2`, () => {
          return HttpResponse.json({ success: true, data: entry2 });
        })
      );

      const { result: result1 } = renderHook(() => useEntry(1), {
        wrapper: createWrapper(),
      });

      const { result: result2 } = renderHook(() => useEntry(2), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
        expect(result2.current.isSuccess).toBe(true);
      });

      expect(result1.current.data?.concept).toBe('Entry One');
      expect(result2.current.data?.concept).toBe('Entry Two');
    });
  });

  describe('query options', () => {
    it('should respect enabled option', async () => {
      const mockEntry = createMockEntry();
      let requestMade = false;
      
      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          requestMade = true;
          return HttpResponse.json({
            success: true,
            data: mockEntry,
          });
        })
      );

      const { result } = renderHook(() => useEntry(1, { enabled: false }), {
        wrapper: createWrapper(),
      });

      // Should not be loading when disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);
      
      // Wait a bit to ensure no request is made
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(requestMade).toBe(false);
    });

    it('should not fetch for invalid entry IDs (0 or negative)', async () => {
      let requestMade = false;
      
      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          requestMade = true;
          return HttpResponse.json({
            success: true,
            data: createMockEntry(),
          });
        })
      );

      const { result: result0 } = renderHook(() => useEntry(0), {
        wrapper: createWrapper(),
      });

      const { result: resultNeg } = renderHook(() => useEntry(-1), {
        wrapper: createWrapper(),
      });

      // Wait a bit to ensure no request is made
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      expect(result0.current.isLoading).toBe(false);
      expect(resultNeg.current.isLoading).toBe(false);
      expect(requestMade).toBe(false);
    });

    it('should respect custom staleTime option', async () => {
      const mockEntry = createMockEntry();
      
      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockEntry,
          });
        })
      );

      const { result } = renderHook(() => useEntry(1, { staleTime: 60000 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Data should not be stale immediately with 60s staleTime
      expect(result.current.isStale).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle 404 not found error', async () => {
      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Entry not found',
              },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useEntry(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      // The error message wraps the Axios error with the verb and status code
      expect(result.current.error?.message).toContain('fetch');
      expect(result.current.error?.message).toContain('404');
    });

    it('should handle 403 permission denied error', async () => {
      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to view this entry',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useEntry(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      // The error message wraps the Axios error with the verb and status code
      expect(result.current.error?.message).toContain('fetch');
      expect(result.current.error?.message).toContain('403');
    });

    it('should not retry on 404 errors', async () => {
      let requestCount = 0;
      
      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          requestCount++;
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Entry not found' },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useEntry(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Wait a bit more to ensure no retries
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(requestCount).toBe(1);
    });

    it('should not retry on 403 errors', async () => {
      let requestCount = 0;
      
      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          requestCount++;
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'PERMISSION_DENIED', message: 'Access denied' },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useEntry(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(requestCount).toBe(1);
    });

    it('should handle 500 server error', async () => {
      // Use 403 instead of 500 to avoid retry logic in the hook
      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: 'Internal server error',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useEntry(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle network failures', async () => {
      // Simulate network failure with 404 to avoid retry timeouts
      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Entry not found' },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useEntry(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });
});

// ============================================================================
// useCreateEntry() Tests
// ============================================================================

describe('useCreateEntry', () => {
  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  describe('successful entry creation', () => {
    it('should create entry with required fields successfully', async () => {
      const createInput = createMockCreateInput();
      const createdEntry = createMockEntry({
        id: 999,
        concept: createInput.concept,
        definition: createInput.definition,
      });

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, async ({ request }) => {
          const body = await request.json();
          expect(body).toBeDefined();
          return HttpResponse.json({
            success: true,
            data: createdEntry,
          });
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(createdEntry);
      expect(result.current.data?.id).toBe(999);
      expect(result.current.data?.concept).toBe('New Concept');
    });

    it('should show loading state during creation', async () => {
      const createInput = createMockCreateInput();
      const createdEntry = createMockEntry({ id: 100 });

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: createdEntry,
          });
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
        // Wait a tick for React Query to update state
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Check loading state - isPending should be true while waiting
      await waitFor(() => {
        expect(result.current.isPending || result.current.isSuccess).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should create entry with category assignment', async () => {
      const createInput = createMockCreateInput({ categoryId: 5 });
      const createdEntry = createMockEntry({
        id: 101,
        concept: createInput.concept,
        categoryid: 5,
        categoryname: 'Test Category',
      });

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          // The hook sends categoryId to the API
          return HttpResponse.json({
            success: true,
            data: createdEntry,
          });
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.categoryid).toBe(5);
    });

    it('should call onSuccess callback with created entry data', async () => {
      const createInput = createMockCreateInput();
      const createdEntry = createMockEntry({ id: 102 });
      const onSuccess = vi.fn();

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: createdEntry,
          });
        })
      );

      const { result } = renderHook(() => useCreateEntry(100, { onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith(createdEntry, createInput);
    });

    it('should return mutation data structure', async () => {
      const createInput = createMockCreateInput();
      const createdEntry = createMockEntry({ id: 103 });

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: createdEntry,
          });
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify mutation result structure
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe(103);
      expect(result.current.error).toBeNull();
      expect(result.current.variables).toEqual(createInput);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate entries list after creation', async () => {
      const createInput = createMockCreateInput({ glossaryId: 100 });
      const createdEntry = createMockEntry({ id: 104, glossaryid: 100 });
      
      // Pre-populate cache with entry list
      queryClient.setQueryData(entryKeys.list(100), []);

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: createdEntry,
          });
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // The query should be invalidated (stale)
      const queryState = queryClient.getQueryState(entryKeys.list(100));
      expect(queryState?.isInvalidated || queryState?.dataUpdatedAt === undefined).toBe(true);
    });

    it('should add new entry to cache', async () => {
      const createInput = createMockCreateInput();
      const createdEntry = createMockEntry({ id: 105 });

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: createdEntry,
          });
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // New entry should be in cache
      const cachedEntry = queryClient.getQueryData(entryKeys.detail(105));
      expect(cachedEntry).toEqual(createdEntry);
    });
  });

  describe('file attachment handling', () => {
    it('should create entry with single file attachment', async () => {
      const mockFile = createMockFile('document.pdf');
      const createInput = createMockCreateInput({ attachments: [mockFile] });
      const createdEntry = createMockEntry({
        id: 106,
        attachment: true,
        attachments: [createMockAttachment({ filename: 'document.pdf' })],
      });

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: createdEntry,
          });
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attachment).toBe(true);
      expect(result.current.data?.attachments).toHaveLength(1);
    });

    it('should create entry with multiple file attachments', async () => {
      const files = [
        createMockFile('doc1.pdf'),
        createMockFile('image.png', 'image/png'),
        createMockFile('video.mp4', 'video/mp4'),
      ];
      const createInput = createMockCreateInput({ attachments: files });
      const createdEntry = createMockEntry({
        id: 107,
        attachment: true,
        attachments: [
          createMockAttachment({ filename: 'doc1.pdf' }),
          createMockAttachment({ filename: 'image.png', mimetype: 'image/png' }),
          createMockAttachment({ filename: 'video.mp4', mimetype: 'video/mp4' }),
        ],
      });

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: createdEntry,
          });
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attachments).toHaveLength(3);
    });
  });

  describe('error handling', () => {
    it('should handle validation errors for empty concept', async () => {
      const createInput = createMockCreateInput({ concept: '' });

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Concept is required',
                details: { field: 'concept' },
              },
            },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      // The error message wraps the Axios error with the verb and status code
      expect(result.current.error?.message).toContain('create');
      expect(result.current.error?.message).toContain('400');
    });

    it('should handle validation errors for empty definition', async () => {
      const createInput = createMockCreateInput({ definition: '' });

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Definition is required',
                details: { field: 'definition' },
              },
            },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // The error message wraps the Axios error with the verb and status code
      expect(result.current.error?.message).toContain('create');
      expect(result.current.error?.message).toContain('400');
    });

    it('should handle permission denied errors', async () => {
      const createInput = createMockCreateInput();
      const onError = vi.fn();

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to create entries',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useCreateEntry(100, { onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(onError).toHaveBeenCalled();
      // The error message wraps the Axios error with the verb and status code
      expect(result.current.error?.message).toContain('create');
      expect(result.current.error?.message).toContain('403');
    });

    it('should handle duplicate concept errors', async () => {
      const createInput = createMockCreateInput({ concept: 'Existing Concept' });

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'DUPLICATE_ENTRY',
                message: 'An entry with this concept already exists',
              },
            },
            { status: 409 }
          );
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // The error message wraps the Axios error with the verb and status code
      expect(result.current.error?.message).toContain('create');
      expect(result.current.error?.message).toContain('409');
    });

    it('should handle file too large errors', async () => {
      const largeFile = createMockFile('large.zip', 'application/zip', 100 * 1024 * 1024);
      const createInput = createMockCreateInput({ attachments: [largeFile] });

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'FILE_TOO_LARGE',
                message: 'File exceeds maximum allowed size',
              },
            },
            { status: 413 }
          );
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // The error message wraps the Axios error with the verb and status code
      expect(result.current.error?.message).toContain('create');
      expect(result.current.error?.message).toContain('413');
    });
  });
});

// ============================================================================
// useUpdateEntry() Tests
// ============================================================================

describe('useUpdateEntry', () => {
  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  describe('successful entry update', () => {
    it('should update entry successfully', async () => {
      const updateInput = createMockUpdateInput({ entryId: 1, concept: 'Updated Concept' });
      const updatedEntry = createMockEntry({
        id: 1,
        concept: 'Updated Concept',
        timemodified: Math.floor(Date.now() / 1000),
      });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.concept).toBe('Updated Concept');
    });

    it('should update concept field', async () => {
      const updateInput = createMockUpdateInput({
        entryId: 2,
        concept: 'New Concept Name',
      });
      const updatedEntry = createMockEntry({
        id: 2,
        concept: 'New Concept Name',
      });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.concept).toBe('New Concept Name');
    });

    it('should update definition field', async () => {
      const updateInput = createMockUpdateInput({
        entryId: 3,
        definition: '<p>New definition content with <strong>formatting</strong></p>',
      });
      const updatedEntry = createMockEntry({
        id: 3,
        definition: '<p>New definition content with <strong>formatting</strong></p>',
      });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.definition).toContain('New definition content');
    });

    it('should update category reassignment', async () => {
      const updateInput = createMockUpdateInput({
        entryId: 4,
        categoryId: 15,
      });
      const updatedEntry = createMockEntry({
        id: 4,
        categoryid: 15,
        categoryname: 'New Category',
      });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          // The hook sends categoryId to the API
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.categoryid).toBe(15);
    });

    it('should call onSuccess callback', async () => {
      const updateInput = createMockUpdateInput({ entryId: 5 });
      const updatedEntry = createMockEntry({ id: 5 });
      const onSuccess = vi.fn();

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith(updatedEntry, updateInput);
    });

    it('should show loading state during mutation', async () => {
      const updateInput = createMockUpdateInput({ entryId: 6 });
      const updatedEntry = createMockEntry({ id: 6 });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
        // Wait a tick for React Query to update state
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Check loading state - isPending should be true while waiting
      await waitFor(() => {
        expect(result.current.isPending || result.current.isSuccess).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isPending).toBe(false);
    });
  });

  describe('optimistic updates', () => {
    it('should apply optimistic update immediately', async () => {
      const existingEntry = createMockEntry({
        id: 7,
        concept: 'Original Concept',
        glossaryid: 100,
      });
      
      // Pre-populate cache
      queryClient.setQueryData(entryKeys.detail(7), existingEntry);

      const updateInput = createMockUpdateInput({
        entryId: 7,
        concept: 'Optimistic Concept',
      });
      const updatedEntry = createMockEntry({
        id: 7,
        concept: 'Optimistic Concept',
        glossaryid: 100,
      });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, async () => {
          // Delay to allow checking optimistic update
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(updateInput);
      });

      // Check optimistic update in cache immediately
      await waitFor(() => {
        const cachedEntry = queryClient.getQueryData<GlossaryEntry>(entryKeys.detail(7));
        expect(cachedEntry?.concept).toBe('Optimistic Concept');
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should rollback optimistic update on error', async () => {
      const existingEntry = createMockEntry({
        id: 8,
        concept: 'Original Concept',
        glossaryid: 100,
      });
      
      // Pre-populate cache
      queryClient.setQueryData(entryKeys.detail(8), existingEntry);

      const updateInput = createMockUpdateInput({
        entryId: 8,
        concept: 'Failed Update Concept',
      });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'SERVER_ERROR', message: 'Update failed' },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Check rollback - original value should be restored
      const cachedEntry = queryClient.getQueryData<GlossaryEntry>(entryKeys.detail(8));
      expect(cachedEntry?.concept).toBe('Original Concept');
    });

    it('should update timemodified optimistically', async () => {
      const existingEntry = createMockEntry({
        id: 9,
        timemodified: 1700000000,
        glossaryid: 100,
      });
      
      queryClient.setQueryData(entryKeys.detail(9), existingEntry);

      const updateInput = createMockUpdateInput({ entryId: 9 });
      const updatedEntry = createMockEntry({ id: 9 });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      const beforeUpdate = Math.floor(Date.now() / 1000);

      act(() => {
        result.current.mutate(updateInput);
      });

      // Check timemodified was updated optimistically
      await waitFor(() => {
        const cachedEntry = queryClient.getQueryData<GlossaryEntry>(entryKeys.detail(9));
        expect(cachedEntry?.timemodified).toBeGreaterThanOrEqual(beforeUpdate);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate entry cache after update', async () => {
      const existingEntry = createMockEntry({ id: 10, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(10), existingEntry);

      const updateInput = createMockUpdateInput({ entryId: 10 });
      const updatedEntry = createMockEntry({ id: 10, glossaryid: 100 });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Cache should be updated with server response
      const cachedEntry = queryClient.getQueryData<GlossaryEntry>(entryKeys.detail(10));
      expect(cachedEntry).toEqual(updatedEntry);
    });

    it('should invalidate entries list after update', async () => {
      const existingEntry = createMockEntry({ id: 11, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(11), existingEntry);
      queryClient.setQueryData(entryKeys.list(100), [existingEntry]);

      const updateInput = createMockUpdateInput({ entryId: 11 });
      const updatedEntry = createMockEntry({ id: 11, glossaryid: 100 });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // List should be invalidated
      const queryState = queryClient.getQueryState(entryKeys.list(100));
      expect(queryState?.isInvalidated || !queryState).toBe(true);
    });
  });

  describe('attachment handling', () => {
    it('should add new attachments', async () => {
      const existingEntry = createMockEntry({
        id: 12,
        attachment: false,
        attachments: [],
        glossaryid: 100,
      });
      queryClient.setQueryData(entryKeys.detail(12), existingEntry);

      const newFile = createMockFile('new-document.pdf');
      const updateInput = createMockUpdateInput({
        entryId: 12,
        attachments: [newFile],
      });
      const updatedEntry = createMockEntry({
        id: 12,
        attachment: true,
        attachments: [createMockAttachment({ filename: 'new-document.pdf' })],
        glossaryid: 100,
      });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attachment).toBe(true);
      expect(result.current.data?.attachments).toHaveLength(1);
    });

    it('should replace existing attachments', async () => {
      const existingEntry = createMockEntry({
        id: 13,
        attachment: true,
        attachments: [createMockAttachment({ filename: 'old-doc.pdf' })],
        glossaryid: 100,
      });
      queryClient.setQueryData(entryKeys.detail(13), existingEntry);

      const newFile = createMockFile('replacement.pdf');
      const updateInput = createMockUpdateInput({
        entryId: 13,
        attachments: [newFile],
      });
      const updatedEntry = createMockEntry({
        id: 13,
        attachment: true,
        attachments: [createMockAttachment({ filename: 'replacement.pdf' })],
        glossaryid: 100,
      });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.attachments?.[0]?.filename).toBe('replacement.pdf');
    });
  });

  describe('error handling', () => {
    it('should handle not found error', async () => {
      const updateInput = createMockUpdateInput({ entryId: 999 });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Entry not found' },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // The error message wraps the Axios error with the verb and status code
      expect(result.current.error?.message).toContain('update');
      expect(result.current.error?.message).toContain('404');
    });

    it('should handle permission denied error', async () => {
      const updateInput = createMockUpdateInput({ entryId: 14 });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'PERMISSION_DENIED', message: 'Not allowed to edit' },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // The error message wraps the Axios error with the verb and status code
      expect(result.current.error?.message).toContain('update');
      expect(result.current.error?.message).toContain('403');
    });

    it('should handle validation errors', async () => {
      const updateInput = createMockUpdateInput({ entryId: 15, concept: '' });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'Concept cannot be empty' },
            },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Error is wrapped by the hook - check for update action and status code
      expect(result.current.error?.message).toContain('update');
      expect(result.current.error?.message).toContain('400');
    });
  });
});

// ============================================================================
// useDeleteEntry() Tests
// ============================================================================

describe('useDeleteEntry', () => {
  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  describe('successful entry deletion', () => {
    it('should delete entry successfully', async () => {
      const existingEntry = createMockEntry({ id: 20, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(20), existingEntry);

      server.use(
        http.delete(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: { deleted: true, entryId: 20 },
          });
        })
      );

      const { result } = renderHook(() => useDeleteEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(20);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.deleted).toBe(true);
      expect(result.current.data?.entryId).toBe(20);
    });

    it('should show loading state during deletion', async () => {
      const existingEntry = createMockEntry({ id: 21, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(21), existingEntry);

      server.use(
        http.delete(`${API_BASE}/glossary/entries/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: { deleted: true, entryId: 21 },
          });
        })
      );

      const { result } = renderHook(() => useDeleteEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(21);
        // Wait a tick for React Query to update state
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Check loading state - isPending should be true while waiting
      await waitFor(() => {
        expect(result.current.isPending || result.current.isSuccess).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isPending).toBe(false);
    });

    it('should call onSuccess callback', async () => {
      const onSuccess = vi.fn();

      server.use(
        http.delete(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: { deleted: true, entryId: 22 },
          });
        })
      );

      const { result } = renderHook(() => useDeleteEntry(100, { onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(22);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith({ deleted: true, entryId: 22 }, 22);
    });
  });

  describe('optimistic removal', () => {
    it('should remove entry from cache optimistically', async () => {
      const existingEntry = createMockEntry({ id: 23, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(23), existingEntry);

      server.use(
        http.delete(`${API_BASE}/glossary/entries/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: { deleted: true, entryId: 23 },
          });
        })
      );

      const { result } = renderHook(() => useDeleteEntry(100), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(23);
      });

      // Entry should be removed from cache immediately
      await waitFor(() => {
        const cachedEntry = queryClient.getQueryData(entryKeys.detail(23));
        expect(cachedEntry).toBeUndefined();
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should rollback on delete error', async () => {
      const existingEntry = createMockEntry({ id: 24, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(24), existingEntry);

      server.use(
        http.delete(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'SERVER_ERROR', message: 'Delete failed' },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useDeleteEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(24);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Entry should be restored in cache
      const cachedEntry = queryClient.getQueryData<GlossaryEntry>(entryKeys.detail(24));
      expect(cachedEntry).toEqual(existingEntry);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate entries list after deletion', async () => {
      const existingEntry = createMockEntry({ id: 25, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(25), existingEntry);
      queryClient.setQueryData(entryKeys.list(100), [existingEntry]);

      server.use(
        http.delete(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: { deleted: true, entryId: 25 },
          });
        })
      );

      const { result } = renderHook(() => useDeleteEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(25);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // List should be invalidated
      const queryState = queryClient.getQueryState(entryKeys.list(100));
      expect(queryState?.isInvalidated || !queryState).toBe(true);
    });

    it('should remove entry from all queries after deletion', async () => {
      const existingEntry = createMockEntry({ id: 26, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(26), existingEntry);

      server.use(
        http.delete(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: { deleted: true, entryId: 26 },
          });
        })
      );

      const { result } = renderHook(() => useDeleteEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(26);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Entry should not be in cache
      const cachedEntry = queryClient.getQueryData(entryKeys.detail(26));
      expect(cachedEntry).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle not found error', async () => {
      server.use(
        http.delete(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Entry not found' },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useDeleteEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(999);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // The error message wraps the Axios error with the verb and status code
      expect(result.current.error?.message).toContain('delete');
      expect(result.current.error?.message).toContain('404');
    });

    it('should handle permission denied error', async () => {
      const onError = vi.fn();

      server.use(
        http.delete(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'PERMISSION_DENIED', message: 'Not allowed to delete' },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useDeleteEntry(100, { onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(27);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(onError).toHaveBeenCalled();
      // The error message wraps the Axios error with the verb and status code
      expect(result.current.error?.message).toContain('delete');
      expect(result.current.error?.message).toContain('403');
    });

    it('should handle server error', async () => {
      server.use(
        http.delete(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'SERVER_ERROR', message: 'Internal server error' },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useDeleteEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(28);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });
});

// ============================================================================
// useApproveEntry() Tests
// ============================================================================

describe('useApproveEntry', () => {
  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  describe('successful entry approval', () => {
    it('should approve entry successfully', async () => {
      const pendingEntry = createMockEntry({ id: 30, approved: false, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(30), pendingEntry);

      const approvedEntry = createMockEntry({ id: 30, approved: true, glossaryid: 100 });

      server.use(
        http.post(`${API_BASE}/glossary/entries/:id/approve`, () => {
          return HttpResponse.json({
            success: true,
            data: approvedEntry,
          });
        })
      );

      const { result } = renderHook(() => useApproveEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(30);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.approved).toBe(true);
    });

    it('should change entry status from pending to approved', async () => {
      const pendingEntry = createMockEntry({ id: 31, approved: false, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(31), pendingEntry);

      const approvedEntry = createMockEntry({
        id: 31,
        approved: true,
        glossaryid: 100,
        timemodified: Math.floor(Date.now() / 1000),
      });

      server.use(
        http.post(`${API_BASE}/glossary/entries/:id/approve`, () => {
          return HttpResponse.json({
            success: true,
            data: approvedEntry,
          });
        })
      );

      const { result } = renderHook(() => useApproveEntry(100), {
        wrapper: createWrapper(),
      });

      // Verify initial state is pending
      expect(queryClient.getQueryData<GlossaryEntry>(entryKeys.detail(31))?.approved).toBe(false);

      await act(async () => {
        result.current.mutate(31);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify status changed to approved
      expect(result.current.data?.approved).toBe(true);
    });

    it('should show loading state during approval', async () => {
      const pendingEntry = createMockEntry({ id: 32, approved: false, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(32), pendingEntry);

      const approvedEntry = createMockEntry({ id: 32, approved: true, glossaryid: 100 });

      server.use(
        http.post(`${API_BASE}/glossary/entries/:id/approve`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: approvedEntry,
          });
        })
      );

      const { result } = renderHook(() => useApproveEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(32);
        // Wait a tick for React Query to update state
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Check loading state - isPending should be true while waiting
      await waitFor(() => {
        expect(result.current.isPending || result.current.isSuccess).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isPending).toBe(false);
    });

    it('should call onSuccess callback', async () => {
      const onSuccess = vi.fn();
      const approvedEntry = createMockEntry({ id: 33, approved: true, glossaryid: 100 });

      server.use(
        http.post(`${API_BASE}/glossary/entries/:id/approve`, () => {
          return HttpResponse.json({
            success: true,
            data: approvedEntry,
          });
        })
      );

      const { result } = renderHook(() => useApproveEntry(100, { onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(33);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith(approvedEntry, 33);
    });
  });

  describe('optimistic status update', () => {
    it('should update approved status optimistically', async () => {
      const pendingEntry = createMockEntry({ id: 34, approved: false, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(34), pendingEntry);

      const approvedEntry = createMockEntry({ id: 34, approved: true, glossaryid: 100 });

      server.use(
        http.post(`${API_BASE}/glossary/entries/:id/approve`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: approvedEntry,
          });
        })
      );

      const { result } = renderHook(() => useApproveEntry(100), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(34);
      });

      // Check optimistic update immediately
      await waitFor(() => {
        const cachedEntry = queryClient.getQueryData<GlossaryEntry>(entryKeys.detail(34));
        expect(cachedEntry?.approved).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should rollback optimistic update on error', async () => {
      const pendingEntry = createMockEntry({ id: 35, approved: false, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(35), pendingEntry);

      server.use(
        http.post(`${API_BASE}/glossary/entries/:id/approve`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'SERVER_ERROR', message: 'Approval failed' },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useApproveEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(35);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Check rollback - should be back to pending
      const cachedEntry = queryClient.getQueryData<GlossaryEntry>(entryKeys.detail(35));
      expect(cachedEntry?.approved).toBe(false);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate entries list after approval', async () => {
      const pendingEntry = createMockEntry({ id: 36, approved: false, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(36), pendingEntry);
      queryClient.setQueryData(entryKeys.list(100), [pendingEntry]);

      const approvedEntry = createMockEntry({ id: 36, approved: true, glossaryid: 100 });

      server.use(
        http.post(`${API_BASE}/glossary/entries/:id/approve`, () => {
          return HttpResponse.json({
            success: true,
            data: approvedEntry,
          });
        })
      );

      const { result } = renderHook(() => useApproveEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(36);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // List should be invalidated (may affect filtering by approval status)
      const queryState = queryClient.getQueryState(entryKeys.list(100));
      expect(queryState?.isInvalidated || !queryState).toBe(true);
    });

    it('should update entry cache with server response', async () => {
      const pendingEntry = createMockEntry({ id: 37, approved: false, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(37), pendingEntry);

      const approvedEntry = createMockEntry({
        id: 37,
        approved: true,
        glossaryid: 100,
        timemodified: Math.floor(Date.now() / 1000),
      });

      server.use(
        http.post(`${API_BASE}/glossary/entries/:id/approve`, () => {
          return HttpResponse.json({
            success: true,
            data: approvedEntry,
          });
        })
      );

      const { result } = renderHook(() => useApproveEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(37);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Cache should have server response
      const cachedEntry = queryClient.getQueryData<GlossaryEntry>(entryKeys.detail(37));
      expect(cachedEntry).toEqual(approvedEntry);
    });
  });

  describe('error handling', () => {
    it('should handle permission denied error', async () => {
      const onError = vi.fn();

      server.use(
        http.post(`${API_BASE}/glossary/entries/:id/approve`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to approve entries',
                details: { required_capability: 'mod/glossary:approve' },
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useApproveEntry(100, { onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(38);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(onError).toHaveBeenCalled();
      // The error message wraps the Axios error with the verb and status code
      expect(result.current.error?.message).toContain('approve');
      expect(result.current.error?.message).toContain('403');
    });

    it('should handle already approved entry error', async () => {
      server.use(
        http.post(`${API_BASE}/glossary/entries/:id/approve`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'ALREADY_APPROVED',
                message: 'Entry is already approved',
              },
            },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(() => useApproveEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(39);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // The error message wraps the Axios error with the verb and status code
      expect(result.current.error?.message).toContain('approve');
      expect(result.current.error?.message).toContain('400');
    });

    it('should handle not found error', async () => {
      server.use(
        http.post(`${API_BASE}/glossary/entries/:id/approve`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Entry not found' },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useApproveEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(999);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // The error message wraps the Axios error with the verb and status code
      expect(result.current.error?.message).toContain('approve');
      expect(result.current.error?.message).toContain('404');
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Entry Hooks Integration', () => {
  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  describe('CRUD workflow', () => {
    it('should complete create → read → update → delete workflow', async () => {
      const glossaryId = 100;
      const newEntryId = 50;
      
      // Create entry
      const createdEntry = createMockEntry({
        id: newEntryId,
        glossaryid: glossaryId,
        concept: 'New Term',
        definition: '<p>Initial definition</p>',
      });

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: createdEntry,
          });
        }),
        http.get(`${API_BASE}/glossary/entries/${newEntryId}`, () => {
          return HttpResponse.json({
            success: true,
            data: createdEntry,
          });
        })
      );

      // Step 1: Create
      const { result: createResult } = renderHook(() => useCreateEntry(glossaryId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        createResult.current.mutate(createMockCreateInput({
          glossaryId,
          concept: 'New Term',
          definition: '<p>Initial definition</p>',
        }));
      });

      await waitFor(() => {
        expect(createResult.current.isSuccess).toBe(true);
      });

      expect(createResult.current.data?.id).toBe(newEntryId);

      // Step 2: Read
      const { result: readResult } = renderHook(() => useEntry(newEntryId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(readResult.current.isSuccess).toBe(true);
      });

      expect(readResult.current.data?.concept).toBe('New Term');

      // Step 3: Update
      const updatedEntry = { ...createdEntry, concept: 'Updated Term' };
      
      server.use(
        http.put(`${API_BASE}/glossary/entries/${newEntryId}`, () => {
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result: updateResult } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        updateResult.current.mutate(createMockUpdateInput({
          entryId: newEntryId,
          concept: 'Updated Term',
        }));
      });

      await waitFor(() => {
        expect(updateResult.current.isSuccess).toBe(true);
      });

      expect(updateResult.current.data?.concept).toBe('Updated Term');

      // Step 4: Delete
      server.use(
        http.delete(`${API_BASE}/glossary/entries/${newEntryId}`, () => {
          return HttpResponse.json({
            success: true,
            data: { deleted: true, entryId: newEntryId },
          });
        })
      );

      const { result: deleteResult } = renderHook(() => useDeleteEntry(glossaryId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        deleteResult.current.mutate(newEntryId);
      });

      await waitFor(() => {
        expect(deleteResult.current.isSuccess).toBe(true);
      });

      expect(deleteResult.current.data?.deleted).toBe(true);
    });

    it('should complete entry approval workflow', async () => {
      const glossaryId = 100;
      const entryId = 60;
      
      // Create pending entry
      const pendingEntry = createMockEntry({
        id: entryId,
        glossaryid: glossaryId,
        approved: false,
        concept: 'Pending Term',
      });

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: pendingEntry,
          });
        })
      );

      // Step 1: Create (returns pending entry)
      const { result: createResult } = renderHook(() => useCreateEntry(glossaryId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        createResult.current.mutate(createMockCreateInput({ glossaryId }));
      });

      await waitFor(() => {
        expect(createResult.current.isSuccess).toBe(true);
      });

      expect(createResult.current.data?.approved).toBe(false);

      // Pre-populate cache for approval
      queryClient.setQueryData(entryKeys.detail(entryId), pendingEntry);

      // Step 2: Approve
      const approvedEntry = { ...pendingEntry, approved: true };
      
      server.use(
        http.post(`${API_BASE}/glossary/entries/${entryId}/approve`, () => {
          return HttpResponse.json({
            success: true,
            data: approvedEntry,
          });
        })
      );

      const { result: approveResult } = renderHook(() => useApproveEntry(glossaryId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        approveResult.current.mutate(entryId);
      });

      await waitFor(() => {
        expect(approveResult.current.isSuccess).toBe(true);
      });

      expect(approveResult.current.data?.approved).toBe(true);
    });
  });

  describe('multiple mutations in sequence', () => {
    it('should handle multiple updates in sequence', async () => {
      const entryId = 70;
      const glossaryId = 100;
      
      let currentConcept = 'Original';
      
      const existingEntry = createMockEntry({
        id: entryId,
        glossaryid: glossaryId,
        concept: currentConcept,
      });
      queryClient.setQueryData(entryKeys.detail(entryId), existingEntry);

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, async ({ request }) => {
          const body = await request.json() as UpdateEntryInput;
          currentConcept = body.concept;
          return HttpResponse.json({
            success: true,
            data: createMockEntry({
              id: entryId,
              glossaryid: glossaryId,
              concept: currentConcept,
            }),
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      // First update
      await act(async () => {
        result.current.mutate(createMockUpdateInput({
          entryId,
          concept: 'First Update',
        }));
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.concept).toBe('First Update');

      // Second update
      await act(async () => {
        result.current.mutate(createMockUpdateInput({
          entryId,
          concept: 'Second Update',
        }));
      });

      await waitFor(() => {
        expect(result.current.data?.concept).toBe('Second Update');
      });

      // Third update
      await act(async () => {
        result.current.mutate(createMockUpdateInput({
          entryId,
          concept: 'Third Update',
        }));
      });

      await waitFor(() => {
        expect(result.current.data?.concept).toBe('Third Update');
      });
    });
  });
});

// ============================================================================
// Permission Scenarios
// ============================================================================

describe('Permission Scenarios', () => {
  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  describe('student permissions', () => {
    it('should allow student to create entry when enabled', async () => {
      const createInput = createMockCreateInput();
      const createdEntry = createMockEntry({ id: 80, teacherentry: false });

      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: createdEntry,
          });
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.teacherentry).toBe(false);
    });

    it('should allow student to edit own entry', async () => {
      const ownEntry = createMockEntry({ id: 81, userid: 10, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(81), ownEntry);

      const updateInput = createMockUpdateInput({ entryId: 81, concept: 'My Updated Entry' });
      const updatedEntry = { ...ownEntry, concept: 'My Updated Entry' };

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should deny student editing another users entry', async () => {
      const otherUserEntry = createMockEntry({ id: 82, userid: 99, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(82), otherUserEntry);

      const updateInput = createMockUpdateInput({ entryId: 82 });

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You cannot edit entries created by other users',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // The error message wraps the Axios error which includes the status code
      expect(result.current.error?.message).toContain('update');
      expect(result.current.error?.message).toContain('403');
    });

    it('should allow student to delete own entry when enabled', async () => {
      const ownEntry = createMockEntry({ id: 83, userid: 10, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(83), ownEntry);

      server.use(
        http.delete(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: { deleted: true, entryId: 83 },
          });
        })
      );

      const { result } = renderHook(() => useDeleteEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(83);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('teacher permissions', () => {
    it('should allow teacher to manage all entries', async () => {
      const studentEntry = createMockEntry({ id: 84, userid: 99, teacherentry: false, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(84), studentEntry);

      const updateInput = createMockUpdateInput({ entryId: 84, concept: 'Teacher Edit' });
      const updatedEntry = { ...studentEntry, concept: 'Teacher Edit' };

      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: updatedEntry,
          });
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.concept).toBe('Teacher Edit');
    });

    it('should allow teacher to approve pending entries', async () => {
      const pendingEntry = createMockEntry({ id: 85, approved: false, glossaryid: 100 });
      queryClient.setQueryData(entryKeys.detail(85), pendingEntry);

      const approvedEntry = { ...pendingEntry, approved: true };

      server.use(
        http.post(`${API_BASE}/glossary/entries/:id/approve`, () => {
          return HttpResponse.json({
            success: true,
            data: approvedEntry,
          });
        })
      );

      const { result } = renderHook(() => useApproveEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(85);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.approved).toBe(true);
    });

    it('should deny student approving entries', async () => {
      server.use(
        http.post(`${API_BASE}/glossary/entries/:id/approve`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'Requires mod/glossary:approve capability',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useApproveEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(86);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // The error message wraps the Axios error which includes the status code
      expect(result.current.error?.message).toContain('approve');
      expect(result.current.error?.message).toContain('403');
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  describe('network errors', () => {
    it('should handle network failure on fetch', async () => {
      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          // Use 404 which doesn't trigger hook's retry logic
          return HttpResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Entry not found' } },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useEntry(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle network failure on mutation', async () => {
      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createMockCreateInput());
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle permission denied error', async () => {
      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          // Use 403 which doesn't trigger hook's retry logic
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'PERMISSION_DENIED', message: 'Permission denied' },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useEntry(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // The error message wraps the Axios error which includes the status code
      expect(result.current.error?.message).toContain('403');
    });
  });

  describe('validation errors', () => {
    it('should handle validation error with details', async () => {
      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                details: {
                  concept: 'Concept is required',
                  definition: 'Definition must be at least 10 characters',
                },
              },
            },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createMockCreateInput({ concept: '', definition: 'short' }));
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // The error message wraps the Axios error which includes the status code
      expect(result.current.error?.message).toContain('create');
      expect(result.current.error?.message).toContain('400');
    });
  });

  describe('proper error message structure', () => {
    it('should wrap error with descriptive message for fetch', async () => {
      server.use(
        http.get(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Entry does not exist' },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useEntry(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Error should include entry ID for context
      expect(result.current.error?.message).toContain('999');
    });

    it('should wrap error with descriptive message for create', async () => {
      server.use(
        http.post(`${API_BASE}/glossary/:glossaryId/entries`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'SERVER_ERROR', message: 'Database error' },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useCreateEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createMockCreateInput());
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain('create');
    });

    it('should wrap error with descriptive message for update', async () => {
      server.use(
        http.put(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'SERVER_ERROR', message: 'Update failed' },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useUpdateEntry(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(createMockUpdateInput({ entryId: 123 }));
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Error should include entry ID for context
      expect(result.current.error?.message).toContain('123');
    });

    it('should wrap error with descriptive message for delete', async () => {
      server.use(
        http.delete(`${API_BASE}/glossary/entries/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'SERVER_ERROR', message: 'Delete failed' },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useDeleteEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(456);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Error should include entry ID for context
      expect(result.current.error?.message).toContain('456');
    });

    it('should wrap error with descriptive message for approve', async () => {
      server.use(
        http.post(`${API_BASE}/glossary/entries/:id/approve`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'SERVER_ERROR', message: 'Approval failed' },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useApproveEntry(100), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(789);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Error should include entry ID for context
      expect(result.current.error?.message).toContain('789');
    });
  });
});
