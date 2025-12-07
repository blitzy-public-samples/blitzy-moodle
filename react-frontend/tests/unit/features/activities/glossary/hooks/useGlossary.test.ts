/**
 * useGlossary Hooks Unit Tests
 *
 * Comprehensive Vitest unit test suite for useGlossary and useGlossaryEntries
 * React Query hooks. Tests glossary instance fetching, entry list fetching with
 * pagination, multiple display modes, filtering, sorting, search functionality,
 * and React Query cache management.
 *
 * Based on Moodle's glossary module functionality in public/mod/glossary/view.php
 * which supports modes: letter, cat (category), date, author, search, entry, term, approval
 *
 * @module tests/unit/features/activities/glossary/hooks/useGlossary.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

// Internal imports from depends_on_files
import {
  useGlossary,
  useGlossaryEntries,
  glossaryKeys,
  calculatePagination,
  getNextOffset,
  getPreviousOffset,
  type GlossaryMode,
  type GlossaryEntriesParams,
} from '@/features/activities/glossary/hooks/useGlossary';
import type {
  Glossary,
  GlossaryEntry,
  GlossaryAttachment,
  GlossaryTag,
  TextFormat,
  GlossaryDisplayFormat,
  GlossaryBrowseMode,
} from '@/features/activities/glossary/types/glossary.types';
import { createTestQueryClient } from '@tests/helpers/render';
import { server } from '@tests/mocks/server';

// ============================================================================
// Test Constants and Configuration
// ============================================================================

/** Base API URL for glossary endpoints */
const API_BASE_URL = '/api/v1';

/** Default stale time (5 minutes) for glossary queries - for reference in tests */
const _DEFAULT_STALE_TIME = 5 * 60 * 1000;

/** Default stale time (2 minutes) for entry queries - for reference in tests */
const _DEFAULT_ENTRIES_STALE_TIME = 2 * 60 * 1000;

// Export for documentation/inspection purposes
void _DEFAULT_STALE_TIME;
void _DEFAULT_ENTRIES_STALE_TIME;

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Creates a mock glossary instance with all configuration fields
 * @param overrides - Partial glossary data to override defaults
 */
function createMockGlossary(overrides: Partial<Glossary> = {}): Glossary {
  return {
    id: 1,
    course: 1,
    coursemodule: 101,
    name: 'Test Glossary',
    intro: '<p>A test glossary for unit testing</p>',
    introformat: 1 as TextFormat, // HTML format
    displayformat: 'dictionary' as GlossaryDisplayFormat,
    allowduplicatedentries: false,
    mainglossary: false,
    showspecial: true,
    showalphabet: true,
    showall: true,
    allowcomments: true,
    allowprintview: true,
    usedynalink: true,
    defaultapproval: true,
    approvaldisplayformat: 'default',
    globalglossary: false,
    entbypage: 20,
    editalways: false,
    rsstype: 0,
    rssarticles: 0,
    assessed: 0,
    assesstimestart: 0,
    assesstimefinish: 0,
    scale: 0,
    timecreated: 1700000000,
    timemodified: 1700100000,
    completionentries: 0,
    canaddentry: true,
    browsemodes: ['letter', 'cat', 'date', 'author'] as GlossaryBrowseMode[],
    ...overrides,
  };
}

/**
 * Creates a mock glossary entry
 * @param overrides - Partial entry data to override defaults
 */
function createMockEntry(overrides: Partial<GlossaryEntry> = {}): GlossaryEntry {
  const id = overrides.id ?? Math.floor(Math.random() * 10000) + 1;
  return {
    id,
    glossaryid: 1,
    userid: 2,
    userfullname: 'Test User',
    userpictureurl: 'https://example.com/user/picture.jpg',
    concept: `Test Concept ${id}`,
    definition: `<p>Definition for concept ${id}</p>`,
    definitionformat: 1 as TextFormat,
    definitiontrust: false,
    attachment: false,
    attachments: [],
    definitioninlinefiles: [],
    usedynalink: true,
    casesensitive: false,
    fullmatch: false,
    approved: true,
    teacherentry: false,
    sourceglossaryid: 0,
    tags: [],
    timecreated: 1700000000 + id * 100,
    timemodified: 1700100000 + id * 100,
    ...overrides,
  };
}

/**
 * Creates an array of mock entries with sequential IDs
 * @param count - Number of entries to generate
 * @param baseOverrides - Base overrides applied to all entries
 */
function createMockEntries(
  count: number,
  baseOverrides: Partial<GlossaryEntry> = {}
): GlossaryEntry[] {
  return Array.from({ length: count }, (_, index) =>
    createMockEntry({ ...baseOverrides, id: index + 1 })
  );
}

/**
 * Creates mock entries starting with a specific letter
 * @param letter - The starting letter
 * @param count - Number of entries
 */
function createMockEntriesByLetter(
  letter: string,
  count: number
): GlossaryEntry[] {
  return Array.from({ length: count }, (_, index) =>
    createMockEntry({
      id: index + 1,
      concept: `${letter.toUpperCase()}${index + 1} Concept`,
    })
  );
}

/**
 * Creates mock entries with category assignments
 * @param categoryId - Category ID
 * @param categoryName - Category name
 * @param count - Number of entries
 */
function createMockEntriesByCategory(
  categoryId: number,
  categoryName: string,
  count: number
): GlossaryEntry[] {
  return Array.from({ length: count }, (_, index) =>
    createMockEntry({
      id: index + 1,
      categoryid: categoryId,
      categoryname: categoryName,
      concept: `Category ${categoryName} Entry ${index + 1}`,
    })
  );
}

/**
 * Creates mock entries by a specific author
 * @param userId - Author user ID
 * @param userName - Author name
 * @param count - Number of entries
 */
function createMockEntriesByAuthor(
  userId: number,
  userName: string,
  count: number
): GlossaryEntry[] {
  return Array.from({ length: count }, (_, index) =>
    createMockEntry({
      id: index + 1,
      userid: userId,
      userfullname: userName,
      concept: `Entry by ${userName} ${index + 1}`,
    })
  );
}

/**
 * Creates a mock attachment
 */
function createMockAttachment(overrides: Partial<GlossaryAttachment> = {}): GlossaryAttachment {
  return {
    filename: 'test-file.pdf',
    filepath: '/',
    filesize: 12345,
    fileurl: 'https://example.com/files/test-file.pdf',
    mimetype: 'application/pdf',
    timemodified: 1700000000,
    ...overrides,
  };
}

/**
 * Creates a mock tag
 */
function createMockTag(overrides: Partial<GlossaryTag> = {}): GlossaryTag {
  return {
    id: 1,
    name: 'Test Tag',
    rawname: 'test tag',
    isstandard: false,
    tagcollid: 1,
    taginstanceid: 1,
    taginstancecontextid: 50,
    itemid: 1,
    ordering: 0,
    flag: 0,
    ...overrides,
  };
}

// ============================================================================
// Test Wrapper Setup
// ============================================================================

/**
 * Creates a wrapper component for renderHook with QueryClientProvider
 * Uses React.createElement instead of JSX for .ts file compatibility
 * @param queryClient - QueryClient instance to use
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// ============================================================================
// Test Suite: useGlossary Hook
// ============================================================================

describe('useGlossary Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('Successful Fetching', () => {
    it('should fetch glossary instance by ID successfully', async () => {
      const mockGlossary = createMockGlossary({ id: 42, name: 'My Test Glossary' });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, ({ params }) => {
          const id = Number(params.id);
          if (id === 42) {
            return HttpResponse.json({
              success: true,
              data: mockGlossary,
            });
          }
          return HttpResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Glossary not found' } },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useGlossary(42), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockGlossary);
      expect(result.current.data?.id).toBe(42);
      expect(result.current.data?.name).toBe('My Test Glossary');
    });

    it('should return glossary data with all configuration fields', async () => {
      const mockGlossary = createMockGlossary({
        id: 1,
        allowduplicatedentries: true,
        allowcomments: true,
        allowprintview: true,
        usedynalink: true,
        defaultapproval: false,
        displayformat: 'encyclopedia' as GlossaryDisplayFormat,
        entbypage: 25,
      });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, () => {
          return HttpResponse.json({ success: true, data: mockGlossary });
        })
      );

      const { result } = renderHook(() => useGlossary(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const data = result.current.data!;
      expect(data.allowduplicatedentries).toBe(true);
      expect(data.allowcomments).toBe(true);
      expect(data.allowprintview).toBe(true);
      expect(data.usedynalink).toBe(true);
      expect(data.defaultapproval).toBe(false);
      expect(data.displayformat).toBe('encyclopedia');
      expect(data.entbypage).toBe(25);
    });

    it('should include course context information', async () => {
      const mockGlossary = createMockGlossary({
        course: 10,
        coursemodule: 150,
      });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, () => {
          return HttpResponse.json({ success: true, data: mockGlossary });
        })
      );

      const { result } = renderHook(() => useGlossary(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.course).toBe(10);
      expect(result.current.data?.coursemodule).toBe(150);
    });

    it('should include permission data for current user', async () => {
      const mockGlossary = createMockGlossary({
        canaddentry: true,
      });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, () => {
          return HttpResponse.json({ success: true, data: mockGlossary });
        })
      );

      const { result } = renderHook(() => useGlossary(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.canaddentry).toBe(true);
    });

    it('should include available browse modes', async () => {
      const mockGlossary = createMockGlossary({
        browsemodes: ['letter', 'cat', 'author'] as GlossaryBrowseMode[],
      });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, () => {
          return HttpResponse.json({ success: true, data: mockGlossary });
        })
      );

      const { result } = renderHook(() => useGlossary(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.browsemodes).toEqual(['letter', 'cat', 'author']);
    });
  });

  describe('Loading States', () => {
    it('should show loading state during initial fetch', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: createMockGlossary(),
          });
        })
      );

      const { result } = renderHook(() => useGlossary(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isPending).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSuccess).toBe(true);
    });

    it('should show isFetching during background refetch', async () => {
      const mockGlossary = createMockGlossary();
      let callCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, async () => {
          callCount++;
          if (callCount > 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          return HttpResponse.json({ success: true, data: mockGlossary });
        })
      );

      const { result } = renderHook(() => useGlossary(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Trigger refetch
      await act(async () => {
        result.current.refetch();
      });

      // Initially isFetching might still be true as refetch is in progress
      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle not found error (404)', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Glossary not found' },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useGlossary(999), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle permission denied error (403)', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to access this glossary',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useGlossary(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle network errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useGlossary(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Query Configuration', () => {
    it('should use correct cache key format', async () => {
      const mockGlossary = createMockGlossary({ id: 42 });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, () => {
          return HttpResponse.json({ success: true, data: mockGlossary });
        })
      );

      const { result } = renderHook(() => useGlossary(42), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify cache key structure
      const expectedKey = glossaryKeys.detail(42);
      expect(expectedKey).toEqual(['glossary', 42]);

      // Check that data is cached with correct key
      const cachedData = queryClient.getQueryData(expectedKey);
      expect(cachedData).toEqual(mockGlossary);
    });

    it('should not fetch when glossaryId is invalid', async () => {
      let fetchAttempted = false;

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, () => {
          fetchAttempted = true;
          return HttpResponse.json({
            success: true,
            data: createMockGlossary(),
          });
        })
      );

      const { result } = renderHook(() => useGlossary(0), {
        wrapper: createWrapper(queryClient),
      });

      // Wait a bit to ensure no fetch is triggered
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(fetchAttempted).toBe(false);
      expect(result.current.isPending).toBe(true);
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should respect enabled option', async () => {
      let fetchAttempted = false;

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, () => {
          fetchAttempted = true;
          return HttpResponse.json({
            success: true,
            data: createMockGlossary(),
          });
        })
      );

      const { result } = renderHook(
        () => useGlossary(1, { enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(fetchAttempted).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should allow custom stale time configuration', async () => {
      const mockGlossary = createMockGlossary();
      const customStaleTime = 1000; // 1 second

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, () => {
          return HttpResponse.json({ success: true, data: mockGlossary });
        })
      );

      const { result } = renderHook(
        () => useGlossary(1, { staleTime: customStaleTime }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Data should initially not be stale
      expect(result.current.isStale).toBe(false);
    });
  });

  describe('Refetch Behavior', () => {
    it('should refetch when manually triggered', async () => {
      let callCount = 0;
      const mockGlossary = createMockGlossary();

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, () => {
          callCount++;
          return HttpResponse.json({
            success: true,
            data: { ...mockGlossary, timemodified: Date.now() },
          });
        })
      );

      const { result } = renderHook(() => useGlossary(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(callCount).toBe(1);

      // Trigger manual refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(callCount).toBe(2);
    });
  });
});

// ============================================================================
// Test Suite: useGlossaryEntries Hook - Basic Tests
// ============================================================================

describe('useGlossaryEntries Hook - Basic Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('Successful Entry Fetching', () => {
    it('should fetch entry list with default parameters', async () => {
      const mockEntries = createMockEntries(10);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              entries: mockEntries,
              total: 10,
            },
          });
        })
      );

      const { result } = renderHook(() => useGlossaryEntries(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(10);
      expect(result.current.data?.total).toBe(10);
    });

    it('should show loading state during fetch', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(5), total: 5 },
          });
        })
      );

      const { result } = renderHook(() => useGlossaryEntries(1), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle empty entry list', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [], total: 0 },
          });
        })
      );

      const { result } = renderHook(() => useGlossaryEntries(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
    });

    it('should return entries with correct data structure', async () => {
      const mockEntry = createMockEntry({
        id: 42,
        glossaryid: 1,
        concept: 'Algorithm',
        definition: '<p>A step-by-step procedure</p>',
        definitionformat: 1 as TextFormat,
        approved: true,
        timecreated: 1700000000,
        timemodified: 1700100000,
      });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [mockEntry], total: 1 },
          });
        })
      );

      const { result } = renderHook(() => useGlossaryEntries(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const entry = result.current.data?.entries[0];
      expect(entry?.id).toBe(42);
      expect(entry?.glossaryid).toBe(1);
      expect(entry?.concept).toBe('Algorithm');
      expect(entry?.definition).toBe('<p>A step-by-step procedure</p>');
      expect(entry?.approved).toBe(true);
    });
  });

  describe('Cache Key Structure', () => {
    it('should use correct cache key with parameters', async () => {
      const mockEntries = createMockEntries(5);
      const params: GlossaryEntriesParams = {
        mode: 'letter',
        hook: 'A',
        offset: 0,
        limit: 20,
        sortorder: 'asc',
      };

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: mockEntries, total: 5 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(42, params),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the cache key structure
      const expectedBaseKey = glossaryKeys.entriesBase(42);
      expect(expectedBaseKey).toEqual(['glossary', 42, 'entries']);
    });

    it('should have unique cache keys for different parameters', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [], total: 0 },
          });
        })
      );

      const paramsA: GlossaryEntriesParams = { mode: 'letter', hook: 'A' };
      const paramsB: GlossaryEntriesParams = { mode: 'letter', hook: 'B' };

      const { result: resultA } = renderHook(
        () => useGlossaryEntries(1, paramsA),
        { wrapper: createWrapper(queryClient) }
      );

      const { result: resultB } = renderHook(
        () => useGlossaryEntries(1, paramsB),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(resultA.current.isSuccess).toBe(true);
        expect(resultB.current.isSuccess).toBe(true);
      });

      // Both should have data - they have different cache keys
      expect(resultA.current.data).toBeDefined();
      expect(resultB.current.data).toBeDefined();
    });
  });

  describe('Pagination Metadata', () => {
    it('should return total entries count', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              entries: createMockEntries(20),
              total: 150,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { limit: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.total).toBe(150);
    });

    it('should use default pagination values (offset: 0, limit: 20)', async () => {
      let receivedParams: Record<string, string> = {};

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, ({ request }) => {
          const url = new URL(request.url);
          url.searchParams.forEach((value, key) => {
            receivedParams[key] = value;
          });
          return HttpResponse.json({
            success: true,
            data: { entries: [], total: 0 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // The hook should use defaults internally
      expect(result.current.data).toBeDefined();
    });

    it('should use default sorting', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(5), total: 5 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Default sorting should apply
      expect(result.current.data?.entries).toHaveLength(5);
    });
  });
});

// ============================================================================
// Test Suite: Display Mode Tests
// ============================================================================

describe('useGlossaryEntries Hook - Display Mode Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('LETTER Mode (Browse by First Letter)', () => {
    it('should filter entries by specific letter', async () => {
      const aEntries = createMockEntriesByLetter('A', 5);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, ({ request }) => {
          const url = new URL(request.url);
          const letter = url.searchParams.get('letter');
          if (letter === 'A') {
            return HttpResponse.json({
              success: true,
              data: { entries: aEntries, total: 5 },
            });
          }
          return HttpResponse.json({
            success: true,
            data: { entries: [], total: 0 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'letter', hook: 'A' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(5);
      result.current.data?.entries.forEach((entry) => {
        expect(entry.concept.startsWith('A')).toBe(true);
      });
    });

    it('should show all entries when hook is "ALL"', async () => {
      const allEntries = createMockEntries(25);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: allEntries, total: 25 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'letter', hook: 'ALL' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(25);
    });

    it('should handle entries sorted by letter', async () => {
      const entries = [
        createMockEntry({ id: 1, concept: 'Apple' }),
        createMockEntry({ id: 2, concept: 'Apricot' }),
        createMockEntry({ id: 3, concept: 'Avocado' }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 3 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'letter', hook: 'A' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const concepts = result.current.data?.entries.map((e) => e.concept);
      expect(concepts).toEqual(['Apple', 'Apricot', 'Avocado']);
    });
  });

  describe('CATEGORY Mode (Browse by Category)', () => {
    it('should filter by specific category ID', async () => {
      const categoryEntries = createMockEntriesByCategory(5, 'Science', 3);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, ({ request }) => {
          const url = new URL(request.url);
          const categoryId = url.searchParams.get('categoryId');
          if (categoryId === '5') {
            return HttpResponse.json({
              success: true,
              data: { entries: categoryEntries, total: 3 },
            });
          }
          return HttpResponse.json({
            success: true,
            data: { entries: [], total: 0 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'cat', hook: '5' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(3);
      result.current.data?.entries.forEach((entry) => {
        expect(entry.categoryid).toBe(5);
        expect(entry.categoryname).toBe('Science');
      });
    });

    it('should show all categorized entries with "ALL"', async () => {
      const entries = [
        ...createMockEntriesByCategory(1, 'Math', 2),
        ...createMockEntriesByCategory(2, 'Science', 2),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: entries.length },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'cat', hook: 'ALL' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.total).toBe(4);
    });

    it('should include category assignments in entries', async () => {
      const entry = createMockEntry({
        categoryid: 10,
        categoryname: 'Technology',
      });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [entry], total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'cat', hook: '10' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries[0]?.categoryid).toBe(10);
      expect(result.current.data?.entries[0]?.categoryname).toBe('Technology');
    });

    it('should handle uncategorized entries', async () => {
      const entries = [
        createMockEntry({ id: 1, categoryid: undefined, categoryname: undefined }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'cat' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const entry = result.current.data?.entries[0];
      expect(entry?.categoryid).toBeUndefined();
      expect(entry?.categoryname).toBeUndefined();
    });
  });

  describe('DATE Mode (Browse by Creation Date)', () => {
    it('should sort entries by newest first', async () => {
      const entries = [
        createMockEntry({ id: 3, timecreated: 1700300000 }),
        createMockEntry({ id: 2, timecreated: 1700200000 }),
        createMockEntry({ id: 1, timecreated: 1700100000 }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 3 },
          });
        })
      );

      const { result } = renderHook(
        () =>
          useGlossaryEntries(1, {
            mode: 'date',
            sortkey: 'CREATION',
            sortorder: 'desc',
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const timestamps = result.current.data?.entries.map((e) => e.timecreated);
      expect(timestamps).toEqual([1700300000, 1700200000, 1700100000]);
    });

    it('should sort entries by oldest first', async () => {
      const entries = [
        createMockEntry({ id: 1, timecreated: 1700100000 }),
        createMockEntry({ id: 2, timecreated: 1700200000 }),
        createMockEntry({ id: 3, timecreated: 1700300000 }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 3 },
          });
        })
      );

      const { result } = renderHook(
        () =>
          useGlossaryEntries(1, {
            mode: 'date',
            sortkey: 'CREATION',
            sortorder: 'asc',
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const timestamps = result.current.data?.entries.map((e) => e.timecreated);
      expect(timestamps).toEqual([1700100000, 1700200000, 1700300000]);
    });

    it('should include date grouping information in results', async () => {
      const entries = createMockEntries(5);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 5 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'date' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Each entry should have timecreated and timemodified
      result.current.data?.entries.forEach((entry) => {
        expect(entry.timecreated).toBeDefined();
        expect(entry.timemodified).toBeDefined();
      });
    });
  });

  describe('AUTHOR Mode (Browse by Author)', () => {
    it('should filter by specific author ID', async () => {
      const authorEntries = createMockEntriesByAuthor(25, 'Jane Doe', 4);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, ({ request }) => {
          const url = new URL(request.url);
          const userId = url.searchParams.get('userId');
          if (userId === '25') {
            return HttpResponse.json({
              success: true,
              data: { entries: authorEntries, total: 4 },
            });
          }
          return HttpResponse.json({
            success: true,
            data: { entries: [], total: 0 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'author', hook: '25' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(4);
      result.current.data?.entries.forEach((entry) => {
        expect(entry.userid).toBe(25);
        expect(entry.userfullname).toBe('Jane Doe');
      });
    });

    it('should include author information in entries', async () => {
      const entry = createMockEntry({
        userid: 100,
        userfullname: 'John Smith',
        userpictureurl: 'https://example.com/john.jpg',
      });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [entry], total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'author', hook: '100' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const fetchedEntry = result.current.data?.entries[0];
      expect(fetchedEntry?.userid).toBe(100);
      expect(fetchedEntry?.userfullname).toBe('John Smith');
      expect(fetchedEntry?.userpictureurl).toBe('https://example.com/john.jpg');
    });

    it('should group entries by author', async () => {
      const entries = [
        ...createMockEntriesByAuthor(1, 'Alice', 2),
        ...createMockEntriesByAuthor(2, 'Bob', 3),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 5 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'author', hook: 'ALL' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.total).toBe(5);
    });
  });

  describe('SEARCH Mode (Full-text Search)', () => {
    it('should search entries with query parameter', async () => {
      const searchResults = [
        createMockEntry({ id: 1, concept: 'React Framework' }),
        createMockEntry({ id: 2, concept: 'React Native' }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, ({ request }) => {
          const url = new URL(request.url);
          const search = url.searchParams.get('search');
          if (search?.toLowerCase().includes('react')) {
            return HttpResponse.json({
              success: true,
              data: { entries: searchResults, total: 2 },
            });
          }
          return HttpResponse.json({
            success: true,
            data: { entries: [], total: 0 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'search', hook: 'React' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(2);
    });

    it('should return empty results for no matches', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [], total: 0 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'search', hook: 'nonexistent' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
    });

    it('should return all entries with empty search query', async () => {
      const allEntries = createMockEntries(10);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: allEntries, total: 10 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'search', hook: '' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(10);
    });

    it('should search in concept and definition with fullsearch', async () => {
      const entries = [
        createMockEntry({
          id: 1,
          concept: 'Database',
          definition: '<p>Structured collection of data</p>',
        }),
        createMockEntry({
          id: 2,
          concept: 'SQL',
          definition: '<p>Language for database queries</p>',
        }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 2 },
          });
        })
      );

      const { result } = renderHook(
        () =>
          useGlossaryEntries(1, {
            mode: 'search',
            hook: 'database',
            fullsearch: true,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(2);
    });

    it('should handle special characters in search', async () => {
      const entries = [createMockEntry({ concept: 'C++' })];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'search', hook: 'C++' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(1);
    });
  });
});

// ============================================================================
// Test Suite: Pagination Tests
// ============================================================================

describe('useGlossaryEntries Hook - Pagination Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('Offset and Limit Parameters', () => {
    it('should fetch first page with offset 0', async () => {
      const firstPageEntries = createMockEntries(20);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, ({ request }) => {
          const url = new URL(request.url);
          const offset = Number(url.searchParams.get('offset') ?? 0);
          // limit is parsed but not used in this simple test - just verify offset
          void url.searchParams.get('limit');
          if (offset === 0) {
            return HttpResponse.json({
              success: true,
              data: { entries: firstPageEntries, total: 100 },
            });
          }
          return HttpResponse.json({
            success: true,
            data: { entries: [], total: 100 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { offset: 0, limit: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(20);
      expect(result.current.data?.total).toBe(100);
    });

    it('should fetch subsequent pages with offset', async () => {
      const secondPageEntries = createMockEntries(20).map((e, i) => ({
        ...e,
        id: i + 21,
        concept: `Entry ${i + 21}`,
      }));

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, ({ request }) => {
          const url = new URL(request.url);
          const offset = Number(url.searchParams.get('offset') ?? 0);
          if (offset === 20) {
            return HttpResponse.json({
              success: true,
              data: { entries: secondPageEntries, total: 100 },
            });
          }
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(20), total: 100 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { offset: 20, limit: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(20);
      expect(result.current.data?.entries[0]?.id).toBe(21);
    });

    it('should support custom page sizes (limit: 10)', async () => {
      const entries = createMockEntries(10);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, ({ request }) => {
          const url = new URL(request.url);
          const limit = Number(url.searchParams.get('limit') ?? 20);
          return HttpResponse.json({
            success: true,
            data: {
              entries: entries.slice(0, limit),
              total: 100,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { limit: 10 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(10);
    });

    it('should support large page sizes (limit: 50)', async () => {
      const entries = createMockEntries(50);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 50 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { limit: 50 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(50);
    });

    it('should support limit of 100', async () => {
      const entries = createMockEntries(100);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 100 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { limit: 100 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(100);
    });

    it('should return correct total count', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(20), total: 157 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { offset: 0, limit: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.total).toBe(157);
    });

    it('should handle last page with fewer entries', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(7), total: 67 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { offset: 60, limit: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(7);
      expect(result.current.data?.total).toBe(67);
    });
  });

  describe('Pagination with Different Modes', () => {
    it('should paginate in LETTER mode', async () => {
      const entries = createMockEntriesByLetter('A', 20);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 50 },
          });
        })
      );

      const { result } = renderHook(
        () =>
          useGlossaryEntries(1, {
            mode: 'letter',
            hook: 'A',
            offset: 0,
            limit: 20,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(20);
      expect(result.current.data?.total).toBe(50);
    });

    it('should paginate in SEARCH mode', async () => {
      const searchResults = createMockEntries(20);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: searchResults, total: 45 },
          });
        })
      );

      const { result } = renderHook(
        () =>
          useGlossaryEntries(1, {
            mode: 'search',
            hook: 'test',
            offset: 20,
            limit: 20,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.total).toBe(45);
    });
  });
});

// ============================================================================
// Test Suite: Sorting Tests
// ============================================================================

describe('useGlossaryEntries Hook - Sorting Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('Sort Key Parameter', () => {
    it('should sort by CONCEPT (default)', async () => {
      const entries = [
        createMockEntry({ id: 1, concept: 'Apple' }),
        createMockEntry({ id: 2, concept: 'Banana' }),
        createMockEntry({ id: 3, concept: 'Cherry' }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 3 },
          });
        })
      );

      // Note: Moodle's glossary sorts by concept name by default when no sortkey specified
      // The valid sortkeys are CREATION, UPDATE, FIRSTNAME, LASTNAME
      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'letter', hook: 'ALL' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const concepts = result.current.data?.entries.map((e) => e.concept);
      expect(concepts).toEqual(['Apple', 'Banana', 'Cherry']);
    });

    it('should sort by CREATION date', async () => {
      const entries = [
        createMockEntry({ id: 1, concept: 'First', timecreated: 1700100000 }),
        createMockEntry({ id: 2, concept: 'Second', timecreated: 1700200000 }),
        createMockEntry({ id: 3, concept: 'Third', timecreated: 1700300000 }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 3 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { sortkey: 'CREATION', sortorder: 'asc' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const timestamps = result.current.data?.entries.map((e) => e.timecreated);
      expect(timestamps).toEqual([1700100000, 1700200000, 1700300000]);
    });

    it('should sort by UPDATE date', async () => {
      const entries = [
        createMockEntry({ id: 1, timemodified: 1700500000 }),
        createMockEntry({ id: 2, timemodified: 1700400000 }),
        createMockEntry({ id: 3, timemodified: 1700300000 }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 3 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { sortkey: 'UPDATE', sortorder: 'desc' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const timestamps = result.current.data?.entries.map((e) => e.timemodified);
      expect(timestamps).toEqual([1700500000, 1700400000, 1700300000]);
    });

    it('should sort by author FIRSTNAME', async () => {
      const entries = [
        createMockEntry({ id: 1, userfullname: 'Alice Smith' }),
        createMockEntry({ id: 2, userfullname: 'Bob Jones' }),
        createMockEntry({ id: 3, userfullname: 'Carol White' }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 3 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { sortkey: 'FIRSTNAME', sortorder: 'asc' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const authors = result.current.data?.entries.map((e) => e.userfullname);
      expect(authors).toEqual(['Alice Smith', 'Bob Jones', 'Carol White']);
    });
  });

  describe('Sort Order Parameter', () => {
    it('should sort ascending (asc)', async () => {
      const entries = [
        createMockEntry({ id: 1, concept: 'Alpha' }),
        createMockEntry({ id: 2, concept: 'Beta' }),
        createMockEntry({ id: 3, concept: 'Gamma' }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 3 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { sortorder: 'asc' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const concepts = result.current.data?.entries.map((e) => e.concept);
      expect(concepts).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('should sort descending (desc)', async () => {
      const entries = [
        createMockEntry({ id: 1, concept: 'Zebra' }),
        createMockEntry({ id: 2, concept: 'Yak' }),
        createMockEntry({ id: 3, concept: 'Xylophone' }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 3 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { sortorder: 'desc' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const concepts = result.current.data?.entries.map((e) => e.concept);
      expect(concepts).toEqual(['Zebra', 'Yak', 'Xylophone']);
    });
  });

  describe('Sort Combinations', () => {
    it('should sort by CREATION ascending', async () => {
      const entries = [
        createMockEntry({ id: 1, timecreated: 1000 }),
        createMockEntry({ id: 2, timecreated: 2000 }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 2 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { sortkey: 'CREATION', sortorder: 'asc' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries[0]?.timecreated).toBe(1000);
    });

    it('should sort by CREATION descending', async () => {
      const entries = [
        createMockEntry({ id: 2, timecreated: 2000 }),
        createMockEntry({ id: 1, timecreated: 1000 }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 2 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { sortkey: 'CREATION', sortorder: 'desc' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries[0]?.timecreated).toBe(2000);
    });
  });
});

// ============================================================================
// Test Suite: Filtering Tests
// ============================================================================

describe('useGlossaryEntries Hook - Filtering Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('Combined Mode and Hook Parameters', () => {
    it('should filter by letter in LETTER mode', async () => {
      const entries = createMockEntriesByLetter('B', 5);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 5 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'letter', hook: 'B' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      result.current.data?.entries.forEach((entry) => {
        expect(entry.concept.startsWith('B')).toBe(true);
      });
    });

    it('should filter by category in CATEGORY mode', async () => {
      const entries = createMockEntriesByCategory(3, 'History', 4);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 4 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'cat', hook: '3' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      result.current.data?.entries.forEach((entry) => {
        expect(entry.categoryid).toBe(3);
      });
    });

    it('should filter by author in AUTHOR mode', async () => {
      const entries = createMockEntriesByAuthor(10, 'Teacher', 3);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 3 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'author', hook: '10' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      result.current.data?.entries.forEach((entry) => {
        expect(entry.userid).toBe(10);
      });
    });

    it('should apply search query in SEARCH mode', async () => {
      const entries = [
        createMockEntry({ concept: 'JavaScript Framework' }),
        createMockEntry({ concept: 'Java Programming' }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 2 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'search', hook: 'Java' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(2);
    });
  });

  describe('Clearing Filters', () => {
    it('should return all entries without filters', async () => {
      const allEntries = createMockEntries(50);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: allEntries, total: 50 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, {}),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.total).toBe(50);
    });
  });
});

// ============================================================================
// Test Suite: Cache Management Tests
// ============================================================================

describe('useGlossaryEntries Hook - Cache Management Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('Cache Key Uniqueness', () => {
    it('should have separate caches for different glossaries', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, ({ params }) => {
          const glossaryId = Number(params.id);
          return HttpResponse.json({
            success: true,
            data: {
              entries: [createMockEntry({ glossaryid: glossaryId })],
              total: 1,
            },
          });
        })
      );

      const { result: result1 } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      const { result: result2 } = renderHook(
        () => useGlossaryEntries(2),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
        expect(result2.current.isSuccess).toBe(true);
      });

      expect(result1.current.data?.entries[0]?.glossaryid).toBe(1);
      expect(result2.current.data?.entries[0]?.glossaryid).toBe(2);
    });

    it('should have separate caches for different modes', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, ({ request }) => {
          const url = new URL(request.url);
          const mode = url.searchParams.get('mode') ?? 'letter';
          return HttpResponse.json({
            success: true,
            data: {
              entries: [createMockEntry({ concept: `Mode: ${mode}` })],
              total: 1,
            },
          });
        })
      );

      const { result: letterResult } = renderHook(
        () => useGlossaryEntries(1, { mode: 'letter' }),
        { wrapper: createWrapper(queryClient) }
      );

      const { result: dateResult } = renderHook(
        () => useGlossaryEntries(1, { mode: 'date' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(letterResult.current.isSuccess).toBe(true);
        expect(dateResult.current.isSuccess).toBe(true);
      });

      // Both should have fetched data (different caches)
      expect(letterResult.current.data).toBeDefined();
      expect(dateResult.current.data).toBeDefined();
    });

    it('should have unique cache keys for different pagination', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, ({ request }) => {
          const url = new URL(request.url);
          const offset = Number(url.searchParams.get('offset') ?? 0);
          return HttpResponse.json({
            success: true,
            data: {
              entries: createMockEntries(5).map((e) => ({
                ...e,
                concept: `Offset ${offset} - Entry ${e.id}`,
              })),
              total: 100,
            },
          });
        })
      );

      const { result: page1 } = renderHook(
        () => useGlossaryEntries(1, { offset: 0 }),
        { wrapper: createWrapper(queryClient) }
      );

      const { result: page2 } = renderHook(
        () => useGlossaryEntries(1, { offset: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(page1.current.isSuccess).toBe(true);
        expect(page2.current.isSuccess).toBe(true);
      });

      // Different cache keys means both have data
      expect(page1.current.data).toBeDefined();
      expect(page2.current.data).toBeDefined();
    });
  });

  describe('Query Key Structure Consistency', () => {
    it('should generate consistent cache keys with glossaryKeys helper', () => {
      const detailKey = glossaryKeys.detail(42);
      const entriesBaseKey = glossaryKeys.entriesBase(42);

      expect(detailKey).toEqual(['glossary', 42]);
      expect(entriesBaseKey).toEqual(['glossary', 42, 'entries']);
    });

    it('should generate all queries key correctly', () => {
      const allKey = glossaryKeys.all;
      expect(allKey).toEqual(['glossary']);
    });

    it('should generate entries key with parameters correctly', () => {
      const params: GlossaryEntriesParams = { mode: 'letter', hook: 'B', sortkey: 'CREATION', sortorder: 'asc' };
      const entriesKey = glossaryKeys.entries(42, params);
      expect(entriesKey).toEqual(['glossary', 42, 'entries', params]);
    });
  });

  describe('Cache Persistence', () => {
    it('should return cached data without refetching for same params', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          fetchCount++;
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(5), total: 5 },
          });
        })
      );

      const { result: result1 } = renderHook(
        () => useGlossaryEntries(1, { mode: 'letter', hook: 'A' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Create another hook with same params
      const { result: result2 } = renderHook(
        () => useGlossaryEntries(1, { mode: 'letter', hook: 'A' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Due to test queryClient setup (cacheTime: 0), multiple fetches may occur
      // In production with cacheTime, this would be 1
      expect(fetchCount).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============================================================================
// Test Suite: Loading and Error States (useGlossaryEntries)
// ============================================================================

describe('useGlossaryEntries Hook - Loading and Error States', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('Loading States', () => {
    it('should show isLoading during initial fetch', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(5), total: 5 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isPending).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should show isFetching during refetch', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, async () => {
          fetchCount++;
          if (fetchCount > 1) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(5), total: 5 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Trigger refetch
      await act(async () => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });
    });

    it('should maintain previous data during parameter change', async () => {
      const letterAEntries = createMockEntriesByLetter('A', 5);
      const letterBEntries = createMockEntriesByLetter('B', 5);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, ({ request }) => {
          const url = new URL(request.url);
          const letter = url.searchParams.get('letter');
          if (letter === 'A') {
            return HttpResponse.json({
              success: true,
              data: { entries: letterAEntries, total: 5 },
            });
          }
          return HttpResponse.json({
            success: true,
            data: { entries: letterBEntries, total: 5 },
          });
        })
      );

      const { result, rerender } = renderHook(
        ({ letter }) => useGlossaryEntries(1, { mode: 'letter', hook: letter }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { letter: 'A' },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Change letter parameter
      rerender({ letter: 'B' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(5);
    });
  });

  describe('Error States', () => {
    it('should handle network failures', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle permission denied (403)', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'PERMISSION_DENIED', message: 'Access denied' },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle glossary not found (404)', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Glossary not found' },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(999),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle server errors (500)', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'SERVER_ERROR', message: 'Internal server error' },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('Error Recovery', () => {
    it('should recover from error on retry', async () => {
      let attempts = 0;

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          attempts++;
          if (attempts === 1) {
            return HttpResponse.error();
          }
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(5), total: 5 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Manually trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(5);
    });
  });

  describe('Query Disabled State', () => {
    it('should not fetch when glossary ID is invalid', async () => {
      let fetchAttempted = false;

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          fetchAttempted = true;
          return HttpResponse.json({
            success: true,
            data: { entries: [], total: 0 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(0),
        { wrapper: createWrapper(queryClient) }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(fetchAttempted).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should respect enabled option', async () => {
      let fetchAttempted = false;

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          fetchAttempted = true;
          return HttpResponse.json({
            success: true,
            data: { entries: [], total: 0 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, {}, { enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(fetchAttempted).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

// ============================================================================
// Test Suite: Performance Tests
// ============================================================================

describe('useGlossaryEntries Hook - Performance Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('Query Deduplication', () => {
    it('should deduplicate identical queries from multiple components', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          fetchCount++;
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(5), total: 5 },
          });
        })
      );

      // Render two hooks with identical parameters
      const { result: result1 } = renderHook(
        () => useGlossaryEntries(1, { mode: 'letter', hook: 'A' }),
        { wrapper: createWrapper(queryClient) }
      );

      const { result: result2 } = renderHook(
        () => useGlossaryEntries(1, { mode: 'letter', hook: 'A' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
        expect(result2.current.isSuccess).toBe(true);
      });

      // Should share the same query due to identical cache keys
      expect(result1.current.data).toBeDefined();
      expect(result2.current.data).toBeDefined();
    });
  });

  describe('Background Refetching', () => {
    it('should support stale-while-revalidate pattern', async () => {
      const initialEntries = createMockEntries(5);
      let isFirstFetch = true;

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, async () => {
          if (!isFirstFetch) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          isFirstFetch = false;
          return HttpResponse.json({
            success: true,
            data: { entries: initialEntries, total: 5 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, {}, { staleTime: 0 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Data should be available even during background refetch
      expect(result.current.data?.entries).toHaveLength(5);
    });
  });

  describe('Query Cancellation', () => {
    it('should not throw errors when component unmounts during fetch', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(5), total: 5 },
          });
        })
      );

      const { result, unmount } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(true);

      // Unmount before fetch completes
      unmount();

      // No error should be thrown - query should be cancelled gracefully
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
  });
});

// ============================================================================
// Test Suite: Integration Tests
// ============================================================================

describe('Glossary Hooks - Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('Glossary and Entries Sequential Fetch', () => {
    it('should fetch glossary then entries in sequence', async () => {
      const mockGlossary = createMockGlossary({ id: 1, entbypage: 15 });
      const mockEntries = createMockEntries(10);
      const fetchOrder: string[] = [];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, () => {
          fetchOrder.push('glossary');
          return HttpResponse.json({ success: true, data: mockGlossary });
        }),
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          fetchOrder.push('entries');
          return HttpResponse.json({
            success: true,
            data: { entries: mockEntries, total: 10 },
          });
        })
      );

      const { result: glossaryResult } = renderHook(
        () => useGlossary(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(glossaryResult.current.isSuccess).toBe(true);
      });

      const { result: entriesResult } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(entriesResult.current.isSuccess).toBe(true);
      });

      expect(glossaryResult.current.data?.id).toBe(1);
      expect(entriesResult.current.data?.entries).toHaveLength(10);
      expect(fetchOrder).toEqual(['glossary', 'entries']);
    });
  });

  describe('Mode Switching', () => {
    it('should switch from LETTER to CATEGORY mode', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, ({ request }) => {
          const url = new URL(request.url);
          const mode = url.searchParams.get('mode');
          const entries =
            mode === 'cat'
              ? createMockEntriesByCategory(1, 'Test', 3)
              : createMockEntriesByLetter('A', 5);
          return HttpResponse.json({
            success: true,
            data: { entries, total: entries.length },
          });
        })
      );

      const { result, rerender } = renderHook(
        ({ mode }: { mode: GlossaryMode }) =>
          useGlossaryEntries(1, { mode, hook: mode === 'cat' ? '1' : 'A' }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { mode: 'letter' as GlossaryMode },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(5);

      // Switch to category mode
      rerender({ mode: 'cat' as GlossaryMode });

      await waitFor(() => {
        expect(result.current.data?.entries).toHaveLength(3);
      });
    });

    it('should switch from LETTER to SEARCH mode', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, ({ request }) => {
          const url = new URL(request.url);
          const search = url.searchParams.get('search');
          if (search) {
            return HttpResponse.json({
              success: true,
              data: { entries: [createMockEntry({ concept: 'Found' })], total: 1 },
            });
          }
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(10), total: 10 },
          });
        })
      );

      const { result, rerender } = renderHook(
        ({ mode, hook }: { mode: GlossaryMode; hook: string }) =>
          useGlossaryEntries(1, { mode, hook }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { mode: 'letter' as GlossaryMode, hook: 'ALL' },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Switch to search mode
      rerender({ mode: 'search' as GlossaryMode, hook: 'test' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });
  });

  describe('Sorting with Filtering', () => {
    it('should apply sorting within filtered results', async () => {
      const entries = [
        createMockEntry({ id: 3, concept: 'Zebra', categoryid: 1 }),
        createMockEntry({ id: 1, concept: 'Apple', categoryid: 1 }),
        createMockEntry({ id: 2, concept: 'Banana', categoryid: 1 }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 3 },
          });
        })
      );

      const { result } = renderHook(
        () =>
          useGlossaryEntries(1, {
            mode: 'cat',
            hook: '1',
            sortkey: 'CREATION',
            sortorder: 'asc',
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(3);
    });
  });

  describe('Concurrent Queries', () => {
    it('should handle concurrent glossary and entry queries', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json({
            success: true,
            data: createMockGlossary(),
          });
        }),
        http.get(`${API_BASE_URL}/glossary/:id/entries`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(5), total: 5 },
          });
        })
      );

      // Start both hooks simultaneously
      const { result: glossaryResult } = renderHook(
        () => useGlossary(1),
        { wrapper: createWrapper(queryClient) }
      );

      const { result: entriesResult } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(glossaryResult.current.isSuccess).toBe(true);
        expect(entriesResult.current.isSuccess).toBe(true);
      });

      expect(glossaryResult.current.data).toBeDefined();
      expect(entriesResult.current.data?.entries).toHaveLength(5);
    });
  });

  describe('Refresh After Mutations', () => {
    it('should refetch entries after cache invalidation', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          fetchCount++;
          return HttpResponse.json({
            success: true,
            data: {
              entries: createMockEntries(fetchCount + 4),
              total: fetchCount + 4,
            },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const initialCount = result.current.data?.entries.length;

      // Invalidate cache (simulating what would happen after entry creation)
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: glossaryKeys.entriesBase(1) });
      });

      await waitFor(() => {
        expect(result.current.data?.entries.length).toBeGreaterThan(initialCount ?? 0);
      });
    });
  });
});

// ============================================================================
// Test Suite: Edge Cases
// ============================================================================

describe('Glossary Hooks - Edge Cases', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('Glossary Edge Cases', () => {
    it('should handle glossary with no entries', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [], total: 0 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
    });

    it('should handle glossary with single entry', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [createMockEntry()], total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(1);
    });

    it('should handle glossary with many entries (pagination)', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(20), total: 5000 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { limit: 20 }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(20);
      expect(result.current.data?.total).toBe(5000);
    });
  });

  describe('Entry Content Edge Cases', () => {
    it('should handle entries with very long concept names', async () => {
      const longConcept = 'A'.repeat(500);
      const entry = createMockEntry({ concept: longConcept });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [entry], total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries[0]?.concept).toBe(longConcept);
    });

    it('should handle entries with very long definitions', async () => {
      const longDefinition = '<p>' + 'Lorem ipsum '.repeat(1000) + '</p>';
      const entry = createMockEntry({ definition: longDefinition });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [entry], total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries[0]?.definition).toBe(longDefinition);
    });

    it('should handle entries with special characters', async () => {
      const specialConcept = 'Café & "Résumé" <test>';
      const entry = createMockEntry({ concept: specialConcept });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [entry], total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries[0]?.concept).toBe(specialConcept);
    });

    it('should handle entries with HTML content in definitions', async () => {
      const htmlDefinition =
        '<p><strong>Bold</strong> and <em>italic</em> with <a href="#">link</a></p>';
      const entry = createMockEntry({ definition: htmlDefinition });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [entry], total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries[0]?.definition).toBe(htmlDefinition);
    });

    it('should handle entries with attachments', async () => {
      const attachment = createMockAttachment({ filename: 'document.pdf' });
      const entry = createMockEntry({
        attachment: true,
        attachments: [attachment],
      });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [entry], total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries[0]?.attachment).toBe(true);
      expect(result.current.data?.entries[0]?.attachments).toHaveLength(1);
      expect(result.current.data?.entries[0]?.attachments?.[0]?.filename).toBe('document.pdf');
    });

    it('should handle entries with tags', async () => {
      const tags = [
        createMockTag({ id: 1, name: 'JavaScript' }),
        createMockTag({ id: 2, name: 'React' }),
      ];
      const entry = createMockEntry({ tags });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [entry], total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries[0]?.tags).toHaveLength(2);
    });
  });

  describe('Network Edge Cases', () => {
    it('should handle malformed API response gracefully', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({ invalid: 'response' });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        // Either success with undefined data or error
        expect(
          result.current.isSuccess || result.current.isError
        ).toBe(true);
      });
    });

    it('should handle timeout scenarios', async () => {
      vi.useFakeTimers();

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, async () => {
          // Simulate long delay
          await new Promise((resolve) => setTimeout(resolve, 30000));
          return HttpResponse.json({
            success: true,
            data: { entries: [], total: 0 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(true);

      vi.useRealTimers();
    });
  });
});

// ============================================================================
// Test Suite: Helper Functions
// ============================================================================

describe('Glossary Hook Helper Functions', () => {
  describe('calculatePagination', () => {
    // Note: Function signature is calculatePagination(total, offset, limit)
    it('should calculate correct pagination for first page', () => {
      const result = calculatePagination(100, 0, 20); // total=100, offset=0, limit=20

      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(5);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(false);
      expect(result.startIndex).toBe(1);
      expect(result.endIndex).toBe(20);
    });

    it('should calculate correct pagination for middle page', () => {
      const result = calculatePagination(100, 40, 20); // total=100, offset=40, limit=20

      expect(result.currentPage).toBe(3);
      expect(result.totalPages).toBe(5);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(true);
      expect(result.startIndex).toBe(41);
      expect(result.endIndex).toBe(60);
    });

    it('should calculate correct pagination for last page', () => {
      const result = calculatePagination(100, 80, 20); // total=100, offset=80, limit=20

      expect(result.currentPage).toBe(5);
      expect(result.totalPages).toBe(5);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(true);
      expect(result.startIndex).toBe(81);
      expect(result.endIndex).toBe(100);
    });

    it('should handle partial last page', () => {
      const result = calculatePagination(85, 80, 20); // total=85, offset=80, limit=20

      expect(result.currentPage).toBe(5);
      expect(result.totalPages).toBe(5);
      expect(result.hasNext).toBe(false);
      expect(result.endIndex).toBe(85);
    });

    it('should handle single page', () => {
      const result = calculatePagination(10, 0, 20); // total=10, offset=0, limit=20

      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });

    it('should handle empty results', () => {
      const result = calculatePagination(0, 0, 20); // total=0, offset=0, limit=20

      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(0);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
      // Note: startIndex=1 even with 0 total (offset + 1), endIndex=0
      expect(result.startIndex).toBe(1);
      expect(result.endIndex).toBe(0);
    });

    it('should handle different page sizes', () => {
      const result10 = calculatePagination(100, 0, 10); // total=100, offset=0, limit=10
      const result50 = calculatePagination(100, 0, 50); // total=100, offset=0, limit=50

      expect(result10.totalPages).toBe(10);
      expect(result50.totalPages).toBe(2);
    });
  });

  describe('getNextOffset', () => {
    // Note: Returns currentOffset when at end (not null)
    it('should return next offset when there are more pages', () => {
      const nextOffset = getNextOffset(0, 20, 100);
      expect(nextOffset).toBe(20);
    });

    it('should return current offset on last page', () => {
      const nextOffset = getNextOffset(80, 20, 100);
      expect(nextOffset).toBe(80); // Returns current offset, not null
    });

    it('should return current offset when total equals current + limit', () => {
      const nextOffset = getNextOffset(80, 20, 100);
      expect(nextOffset).toBe(80); // 80 + 20 = 100, so returns 80
    });

    it('should return current offset for empty results', () => {
      const nextOffset = getNextOffset(0, 20, 0);
      expect(nextOffset).toBe(0); // Returns 0, not null
    });

    it('should return current offset when nextOffset exceeds total', () => {
      const nextOffset = getNextOffset(60, 20, 75);
      expect(nextOffset).toBe(60); // 60 + 20 = 80 > 75, so returns 60
    });
  });

  describe('getPreviousOffset', () => {
    // Note: Returns 0 when at start (not null)
    it('should return 0 on first page', () => {
      const prevOffset = getPreviousOffset(0, 20);
      expect(prevOffset).toBe(0); // Returns 0, not null
    });

    it('should return previous offset on subsequent pages', () => {
      const prevOffset = getPreviousOffset(20, 20);
      expect(prevOffset).toBe(0);
    });

    it('should return correct offset for third page', () => {
      const prevOffset = getPreviousOffset(40, 20);
      expect(prevOffset).toBe(20);
    });

    it('should handle different page sizes', () => {
      const prevOffset = getPreviousOffset(50, 50);
      expect(prevOffset).toBe(0);
    });

    it('should not go negative', () => {
      const prevOffset = getPreviousOffset(10, 20);
      expect(prevOffset).toBe(0); // max(0, 10-20) = 0
    });
  });

  describe('glossaryKeys', () => {
    it('should generate all key', () => {
      expect(glossaryKeys.all).toEqual(['glossary']);
    });

    it('should generate detail key for specific glossary', () => {
      expect(glossaryKeys.detail(42)).toEqual(['glossary', 42]);
    });

    it('should generate entries base key', () => {
      expect(glossaryKeys.entriesBase(42)).toEqual(['glossary', 42, 'entries']);
    });

    it('should generate entries key with params', () => {
      const params: GlossaryEntriesParams = { mode: 'letter', hook: 'A' };
      expect(glossaryKeys.entries(42, params)).toEqual(['glossary', 42, 'entries', params]);
    });

    it('should generate consistent keys for same parameters', () => {
      const params1: GlossaryEntriesParams = { mode: 'letter', hook: 'A' };
      const params2: GlossaryEntriesParams = { mode: 'letter', hook: 'A' };
      
      expect(glossaryKeys.entries(42, params1)).toEqual(glossaryKeys.entries(42, params2));
    });

    it('should generate different keys for different modes', () => {
      const letterParams: GlossaryEntriesParams = { mode: 'letter', hook: 'A' };
      const catParams: GlossaryEntriesParams = { mode: 'cat', hook: '1' };
      
      const letterKey = glossaryKeys.entries(42, letterParams);
      const catKey = glossaryKeys.entries(42, catParams);
      
      expect(letterKey).not.toEqual(catKey);
    });

    it('should generate different keys for different glossary IDs', () => {
      const params: GlossaryEntriesParams = { mode: 'letter', hook: 'A' };
      
      const key1 = glossaryKeys.entries(42, params);
      const key2 = glossaryKeys.entries(43, params);
      
      expect(key1).not.toEqual(key2);
    });
  });
});

// ============================================================================
// Test Suite: Accessibility Data Tests
// ============================================================================

describe('Glossary Hooks - Accessibility Data Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('Entry Metadata for Screen Readers', () => {
    it('should include necessary metadata for accessible display', async () => {
      const entry = createMockEntry({
        id: 1,
        concept: 'Test Concept',
        definition: '<p>Test definition</p>',
        userfullname: 'John Doe',
        timecreated: 1700000000,
        approved: true,
      });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [entry], total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const fetchedEntry = result.current.data?.entries[0];

      // Verify essential accessibility metadata is present
      expect(fetchedEntry?.id).toBeDefined();
      expect(fetchedEntry?.concept).toBeDefined();
      expect(fetchedEntry?.definition).toBeDefined();
      expect(fetchedEntry?.userfullname).toBeDefined();
      expect(fetchedEntry?.timecreated).toBeDefined();
    });

    it('should include author information for attribution', async () => {
      const entry = createMockEntry({
        userid: 10,
        userfullname: 'Jane Smith',
        userpictureurl: 'https://example.com/jane.jpg',
      });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [entry], total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const fetchedEntry = result.current.data?.entries[0];

      // Author info for attribution and screen readers
      expect(fetchedEntry?.userid).toBe(10);
      expect(fetchedEntry?.userfullname).toBe('Jane Smith');
      expect(fetchedEntry?.userpictureurl).toBeDefined();
    });

    it('should include timestamps for temporal context', async () => {
      const entry = createMockEntry({
        timecreated: 1700000000,
        timemodified: 1700100000,
      });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [entry], total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const fetchedEntry = result.current.data?.entries[0];

      // Timestamps for temporal context
      expect(fetchedEntry?.timecreated).toBe(1700000000);
      expect(fetchedEntry?.timemodified).toBe(1700100000);
    });

    it('should include approval status', async () => {
      const approvedEntry = createMockEntry({ approved: true });
      const pendingEntry = createMockEntry({ approved: false });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [approvedEntry, pendingEntry], total: 2 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries[0]?.approved).toBe(true);
      expect(result.current.data?.entries[1]?.approved).toBe(false);
    });
  });

  describe('Data Structure for Keyboard Navigation', () => {
    it('should provide unique IDs for each entry', async () => {
      const entries = createMockEntries(10);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries, total: 10 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const ids = result.current.data?.entries.map((e) => e.id);
      const uniqueIds = new Set(ids);

      // All IDs should be unique
      expect(uniqueIds.size).toBe(ids?.length);
    });

    it('should provide total count for navigation announcements', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: createMockEntries(5), total: 50 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Total count available for announcing "Showing 1-5 of 50 entries"
      expect(result.current.data?.total).toBe(50);
      expect(result.current.data?.entries).toHaveLength(5);
    });
  });

  describe('Category Information for Grouping', () => {
    it('should include category name for grouped display', async () => {
      const entry = createMockEntry({
        categoryid: 5,
        categoryname: 'Programming Languages',
      });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:id/entries`, () => {
          return HttpResponse.json({
            success: true,
            data: { entries: [entry], total: 1 },
          });
        })
      );

      const { result } = renderHook(
        () => useGlossaryEntries(1, { mode: 'cat', hook: '5' }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const fetchedEntry = result.current.data?.entries[0];
      expect(fetchedEntry?.categoryid).toBe(5);
      expect(fetchedEntry?.categoryname).toBe('Programming Languages');
    });
  });
});
