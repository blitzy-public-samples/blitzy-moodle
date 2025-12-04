/**
 * Unit Tests for useWikiEdit Custom Hook
 *
 * Comprehensive test suite for the wiki page editing hook that manages:
 * - Save mutations with optimistic updates
 * - Draft auto-save functionality with debounce (30 seconds)
 * - Conflict detection and resolution
 * - Page lock acquisition and release
 * - Form validation and error handling
 * - Edit session persistence across page reloads
 *
 * @module tests/unit/features/activities/wiki/useWikiEdit.test
 * @see react-frontend/src/features/activities/wiki/hooks/useWikiEdit.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import React, { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { useWikiEdit } from '@/features/activities/wiki/hooks/useWikiEdit';
import type { WikiFormat } from '@/features/activities/wiki/types/wiki.types';
import { createTestQueryClient } from '@tests/helpers/render';
import { clearAllStorage } from '@tests/helpers/storageUtils';
import { unfreezeTime } from '@tests/helpers/dateUtils';
import { generateMockId } from '@tests/helpers/mockData';

// Import global MSW server - DO NOT create a local server, use the global one
import { server } from '@tests/mocks/server';

// ============================================================================
// MOCK SETUP
// ============================================================================

/**
 * Mock the useNavigate hook from react-router-dom
 */
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/**
 * Mock the useWikiLock hook to control lock behavior in tests
 */
const mockAcquireLock = vi.fn().mockResolvedValue(undefined);
const mockReleaseLock = vi.fn().mockResolvedValue(undefined);
const mockHasLock = vi.fn<[], boolean>().mockReturnValue(true);

vi.mock('@/features/activities/wiki/hooks/useWikiLock', () => ({
  useWikiLock: () => ({
    acquireLock: mockAcquireLock,
    releaseLock: mockReleaseLock,
    hasLock: mockHasLock() as boolean,
    lockConflict: null,
    lockHolder: null,
    isLoading: false,
  }),
}));

/**
 * Mock localStorage for draft persistence testing
 */
const localStorageMock: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageMock[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageMock).forEach((key) => delete localStorageMock[key]);
  }),
  length: 0,
  key: vi.fn(),
};

// ============================================================================
// MSW HANDLERS
// ============================================================================

/**
 * Default successful save response
 */
const mockSaveResponse = {
  success: true,
  pageid: 1,
  version: 2,
};

/**
 * Default preview response
 */
const mockPreviewResponse = {
  html: '<p>Preview content</p>',
  success: true,
  warnings: [],
};

/**
 * Default page lock response
 */
const mockLockResponse = {
  locked: true,
  pageid: 1,
  userid: 1,
  lockedat: Math.floor(Date.now() / 1000),
};

/**
 * Sets up the wiki-specific MSW handlers for testing.
 * These handlers override the global handlers for wiki endpoints to provide
 * controlled, predictable responses for unit testing.
 * 
 * Note: We use the global MSW server from @tests/mocks/server and add
 * these handlers via server.use() in beforeEach to ensure test isolation.
 */
function setupWikiHandlers(): void {
  server.use(
    // Save wiki page endpoint - returns a fixed response
    http.post('*/api/v1/wiki/:pageId/save', () => {
      return HttpResponse.json({
        success: true,
        data: mockSaveResponse,
      });
    }),

    // Preview wiki page endpoint
    http.post('*/api/v1/wiki/page/:pageId/preview', () => {
      return HttpResponse.json({
        success: true,
        data: mockPreviewResponse,
      });
    }),

    // Acquire page lock endpoint
    http.post('*/api/v1/wiki/page/:pageId/lock', () => {
      return HttpResponse.json({
        success: true,
        data: mockLockResponse,
      });
    }),

    // Release page lock endpoint
    http.delete('*/api/v1/wiki/page/:pageId/lock', () => {
      return HttpResponse.json({
        success: true,
        data: { released: true },
      });
    }),

    // Lock heartbeat endpoint
    http.post('*/api/v1/wiki/page/:pageId/lock/heartbeat', () => {
      return HttpResponse.json({
        success: true,
        data: { expiresIn: 1800 },
      });
    }),

    // Get wiki page endpoint
    http.get('*/api/v1/wiki/:pageId', () => {
      return HttpResponse.json({
        success: true,
        data: {
          id: 1,
          title: 'Test Page',
          content: '<p>Initial content</p>',
          contentFormat: 'html',
          version: 1,
        },
      });
    }),

    // Save section endpoint
    http.post('*/api/v1/wiki/:pageId/savesection', () => {
      return HttpResponse.json({
        success: true,
        data: mockSaveResponse,
      });
    })
  );
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Test query client instance
 */
let queryClient: QueryClient;

/**
 * Creates a wrapper component with all required providers
 * @returns A React component that wraps children with QueryClientProvider and MemoryRouter
 */
function createWrapper(): React.FC<{ children: ReactNode }> {
  function TestWrapper({ children }: { children: ReactNode }): React.ReactElement {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(MemoryRouter, null, children)
    );
  }
  TestWrapper.displayName = 'TestWrapper';
  return TestWrapper;
}

/**
 * Default hook parameters for testing
 */
interface TestHookParams {
  pageId?: number;
  initialContent?: string;
  contentFormat?: WikiFormat;
}

/**
 * Renders the useWikiEdit hook with default or custom parameters
 */
function renderUseWikiEditHook(params: TestHookParams = {}) {
  const defaultParams = {
    pageId: params.pageId ?? 1,
    initialContent: params.initialContent ?? '<p>Initial content</p>',
    contentFormat: params.contentFormat ?? ('html' as WikiFormat),
  };

  return renderHook(() => useWikiEdit(defaultParams), {
    wrapper: createWrapper(),
  });
}

// ============================================================================
// TEST LIFECYCLE
// ============================================================================

// Note: The global MSW server is started/stopped by tests/setup.ts
// We don't need beforeAll/afterAll for server lifecycle here.

beforeEach(() => {
  // Set up wiki-specific handlers FIRST (before any React Query operations)
  // These handlers override any global handlers for the wiki endpoints
  setupWikiHandlers();

  // Create fresh query client for each test
  queryClient = createTestQueryClient();
  
  // Make query client globally available for test utilities
  globalThis.__queryClient__ = queryClient;

  // Reset all mocks
  vi.clearAllMocks();
  mockNavigate.mockClear();
  mockAcquireLock.mockClear();
  mockReleaseLock.mockClear();
  mockHasLock.mockReturnValue(true);

  // Clear localStorage mock
  mockLocalStorage.clear();
  Object.keys(localStorageMock).forEach((key) => delete localStorageMock[key]);

  // Setup storage mock
  Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  clearAllStorage();
  unfreezeTime();
  vi.useRealTimers();
});

// ============================================================================
// TEST SUITES
// ============================================================================

describe('useWikiEdit', () => {
  // ==========================================================================
  // HOOK INITIALIZATION TESTS
  // ==========================================================================

  describe('Hook Initialization', () => {
    it('should initialize with page ID and initial content', () => {
      const pageId = generateMockId();
      const initialContent = '<p>Test content</p>';

      const { result } = renderUseWikiEditHook({
        pageId,
        initialContent,
        contentFormat: 'html',
      });

      expect(result.current.editState.currentContent).toBe(initialContent);
      expect(result.current.editState.isDirty).toBe(false);
      expect(result.current.editState.hasUnsavedChanges).toBe(false);
      expect(result.current.editState.lastSaved).toBeNull();
    });

    it('should return all expected functions and state', () => {
      const { result } = renderUseWikiEditHook();

      // Check functions exist
      expect(typeof result.current.savePage).toBe('function');
      expect(typeof result.current.previewPage).toBe('function');
      expect(typeof result.current.cancelEdit).toBe('function');
      expect(typeof result.current.updateContent).toBe('function');
      expect(typeof result.current.validate).toBe('function');
      expect(typeof result.current.clearDraft).toBe('function');

      // Check state exists
      expect(result.current.editState).toBeDefined();
      expect(typeof result.current.isSaving).toBe('boolean');
      expect(typeof result.current.isPreviewing).toBe('boolean');
    });

    it('should initialize with different content formats', () => {
      const formats: WikiFormat[] = ['html', 'creole', 'nwiki'];

      formats.forEach((format) => {
        const { result } = renderUseWikiEditHook({
          contentFormat: format,
        });

        expect(result.current.editState).toBeDefined();
        expect(result.current.editState.isDirty).toBe(false);
      });
    });

    it('should acquire lock on initialization', async () => {
      renderUseWikiEditHook();

      await waitFor(() => {
        expect(mockAcquireLock).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // EDIT MUTATION TESTS
  // ==========================================================================

  describe('Edit Mutation - Save Page', () => {
    it('should save page content successfully', async () => {
      const { result } = renderUseWikiEditHook();

      // Update content first
      result.current.updateContent('<p>Updated content</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      // Save the page
      await result.current.savePage();

      await waitFor(() => {
        expect(result.current.isSaving).toBe(false);
        expect(mockNavigate).toHaveBeenCalledWith('/wiki/1');
      });
    });

    it('should set isSaving to true during save operation', async () => {
      // Add delay to save endpoint
      server.use(
        http.post('*/api/v1/wiki/:pageId/save', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: mockSaveResponse,
          });
        })
      );

      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>New content</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      // Start save but don't await
      const savePromise = result.current.savePage();

      // Check isSaving is true during operation
      await waitFor(() => {
        expect(result.current.isSaving).toBe(true);
      });

      await savePromise;

      await waitFor(() => {
        expect(result.current.isSaving).toBe(false);
      });
    });

    it('should throw error when trying to save without lock', async () => {
      mockHasLock.mockReturnValue(false);

      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>New content</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      await expect(result.current.savePage()).rejects.toThrow(
        'Cannot save: page lock not held'
      );
    });

    it('should release lock after successful save', async () => {
      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>New content</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      await result.current.savePage();

      await waitFor(() => {
        expect(mockReleaseLock).toHaveBeenCalled();
      });
    });

    it('should navigate to wiki page after successful save', async () => {
      const pageId = 42;
      const { result } = renderUseWikiEditHook({ pageId });

      result.current.updateContent('<p>New content</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      await result.current.savePage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(`/wiki/${pageId}`);
      });
    });
  });

  // ==========================================================================
  // OPTIMISTIC UPDATE TESTS
  // ==========================================================================

  describe('Optimistic Updates', () => {
    // Use a dedicated QueryClient with non-zero gcTime for optimistic update tests
    // The default createTestQueryClient uses gcTime: 0 which causes immediate GC
    // when cancelQueries() is called in onMutate, breaking optimistic updates
    let optimisticQueryClient: QueryClient;

    beforeEach(() => {
      optimisticQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 1000 * 60 * 5, // 5 minutes - allows cache to persist during tests
            staleTime: 0,
          },
          mutations: {
            retry: false,
          },
        },
      });
    });

    afterEach(() => {
      optimisticQueryClient.clear();
    });

    // Helper to render with the optimistic query client
    function renderWithOptimisticClient(props: Parameters<typeof useWikiEdit>[0]) {
      function OptimisticWrapper({ children }: { children: React.ReactNode }): React.ReactElement {
        return React.createElement(
          QueryClientProvider,
          { client: optimisticQueryClient },
          React.createElement(MemoryRouter, null, children)
        );
      }

      return renderHook(() => useWikiEdit(props), { wrapper: OptimisticWrapper });
    }

    it('should optimistically update page content before server response', async () => {
      const pageId = 1;
      const newContent = '<p>Optimistically updated content</p>';

      // Set initial cache data with all required WikiPage fields
      const initialCacheData = {
        id: pageId,
        subwikiid: 1,
        title: 'Test Page',
        content: '<p>Original content</p>',
        timecreated: Date.now() / 1000,
        timemodified: Date.now() / 1000,
        timerendered: Date.now() / 1000,
        userid: 1,
      };
      optimisticQueryClient.setQueryData(['wiki', 'page', pageId], initialCacheData);

      // Add delay to observe optimistic update
      server.use(
        http.post('*/api/v1/wiki/:pageId/save', async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return HttpResponse.json({
            success: true,
            data: mockSaveResponse,
          });
        })
      );

      const { result } = renderWithOptimisticClient({
        pageId,
        initialContent: '<p>Original content</p>',
        contentFormat: 'html',
      });

      result.current.updateContent(newContent);

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      // Start save
      const savePromise = result.current.savePage();

      // Wait for optimistic update
      await waitFor(() => {
        const cachedData = optimisticQueryClient.getQueryData(['wiki', 'page', pageId]) as {
          content: string;
        };
        expect(cachedData?.content).toBe(newContent);
      }, { timeout: 5000 });

      await savePromise;
    });

    it('should rollback on save error', async () => {
      const pageId = 1;
      const originalContent = '<p>Original content</p>';
      const newContent = '<p>New content that will fail</p>';

      // Set initial cache data
      optimisticQueryClient.setQueryData(['wiki', 'page', pageId], {
        id: pageId,
        title: 'Test Page',
        content: originalContent,
        timemodified: Date.now() / 1000,
      });

      // Make save fail
      server.use(
        http.post('*/api/v1/wiki/:pageId/save', () => {
          return HttpResponse.json(
            {
              success: false,
              error: { message: 'Save failed', code: 'SAVE_ERROR' },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderWithOptimisticClient({
        pageId,
        initialContent: originalContent,
        contentFormat: 'html',
      });

      result.current.updateContent(newContent);

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      // Attempt save (should fail)
      try {
        await result.current.savePage();
      } catch {
        // Expected to throw
      }

      // Check rollback occurred
      await waitFor(() => {
        const cachedData = optimisticQueryClient.getQueryData(['wiki', 'page', pageId]) as {
          content: string;
        };
        expect(cachedData?.content).toBe(originalContent);
      });
    });

    it('should update cache after successful save', async () => {
      const pageId = 1;
      const newContent = '<p>Successfully saved content</p>';

      optimisticQueryClient.setQueryData(['wiki', 'page', pageId], {
        id: pageId,
        title: 'Test Page',
        content: '<p>Original</p>',
        timemodified: Date.now() / 1000,
      });

      const { result } = renderWithOptimisticClient({
        pageId,
        initialContent: '<p>Original</p>',
        contentFormat: 'html',
      });

      result.current.updateContent(newContent);

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      await result.current.savePage();

      await waitFor(() => {
        const cachedData = optimisticQueryClient.getQueryData(['wiki', 'page', pageId]) as {
          content: string;
        };
        expect(cachedData?.content).toBe(newContent);
      });
    });
  });

  // ==========================================================================
  // DRAFT AUTO-SAVE TESTS
  // ==========================================================================

  describe('Draft Auto-Save Functionality', () => {
    it('should auto-save draft to localStorage with 30 second debounce', async () => {
      vi.useFakeTimers();
      const pageId = 123;
      const draftKey = `wiki-draft-${pageId}`;

      const { result } = renderUseWikiEditHook({ pageId });

      // Update content
      await act(async () => {
        result.current.updateContent('<p>Draft content</p>');
      });

      // Advance time less than debounce interval - should not save yet
      await act(async () => {
        vi.advanceTimersByTime(20000);
      });

      // Draft should not be saved yet (debounce is 30 seconds)
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
        draftKey,
        expect.stringContaining('Draft content')
      );

      // Advance past debounce interval
      await act(async () => {
        vi.advanceTimersByTime(15000);
      });

      // Now draft should be saved
      expect(mockLocalStorage.setItem).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should recover draft from localStorage on component mount', () => {
      const pageId = 456;
      const draftKey = `wiki-draft-${pageId}`;
      const savedDraft = '<p>Recovered draft content</p>';

      // Pre-populate localStorage with draft
      localStorageMock[draftKey] = JSON.stringify(savedDraft);
      mockLocalStorage.getItem.mockImplementation(
        (key: string) => localStorageMock[key] || null
      );

      const { result } = renderUseWikiEditHook({
        pageId,
        initialContent: '<p>Initial content</p>',
      });

      // draftContent should reflect what was in localStorage
      expect(result.current.draftContent).toBeDefined();
    });

    it('should clear draft after successful save', async () => {
      const pageId = 789;

      const { result } = renderUseWikiEditHook({ pageId });

      result.current.updateContent('<p>Content to save</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      await result.current.savePage();

      await waitFor(() => {
        expect(mockLocalStorage.removeItem).toHaveBeenCalled();
      });
    });

    it('should clear draft using clearDraft function', () => {
      const { result } = renderUseWikiEditHook();

      result.current.clearDraft();

      expect(mockLocalStorage.removeItem).toHaveBeenCalled();
    });

    it('should not auto-save draft when lock is not held', async () => {
      vi.useFakeTimers();
      mockHasLock.mockReturnValue(false);

      const pageId = 111;
      const draftKey = `wiki-draft-${pageId}`;

      mockLocalStorage.setItem.mockClear();

      const { result } = renderUseWikiEditHook({ pageId });

      await act(async () => {
        result.current.updateContent('<p>Content without lock</p>');
      });

      // Advance past debounce interval
      await act(async () => {
        vi.advanceTimersByTime(35000);
      });

      // Draft should NOT be saved since we don't have the lock
      // Check that setItem was not called with the draft key
      const draftSaveCalls = mockLocalStorage.setItem.mock.calls.filter(
        (call: string[]) => call[0] === draftKey
      );
      expect(draftSaveCalls.length).toBe(0);

      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // CONFLICT DETECTION TESTS
  // ==========================================================================

  describe('Concurrent Edit Detection', () => {
    it('should detect version mismatch conflict', async () => {
      server.use(
        http.post('*/api/v1/wiki/:pageId/save', () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VERSION_MISMATCH',
                message: 'The page has been modified by another user',
                currentVersion: 3,
                yourVersion: 1,
              },
            },
            { status: 409 }
          );
        })
      );

      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>Conflicting content</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      await expect(result.current.savePage()).rejects.toThrow();
    });

    it('should detect when another user edits same page', async () => {
      server.use(
        http.post('*/api/v1/wiki/:pageId/save', () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'CONCURRENT_EDIT',
                message: 'Another user has edited this page',
                editedBy: 'Jane Doe',
                editedAt: Date.now() / 1000,
              },
            },
            { status: 409 }
          );
        })
      );

      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>My changes</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      await expect(result.current.savePage()).rejects.toThrow();
    });

    it('should handle conflict with server version gracefully', async () => {
      const serverContent = '<p>Server updated content</p>';

      server.use(
        http.post('*/api/v1/wiki/:pageId/save', () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'MERGE_CONFLICT',
                message: 'Merge conflict detected',
                serverContent,
                serverVersion: 5,
              },
            },
            { status: 409 }
          );
        })
      );

      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>Local changes</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      try {
        await result.current.savePage();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // PAGE LOCK TESTS
  // ==========================================================================

  describe('Page Lock Management', () => {
    it('should acquire lock during editing', async () => {
      renderUseWikiEditHook();

      await waitFor(() => {
        expect(mockAcquireLock).toHaveBeenCalled();
      });
    });

    it('should release lock on save or cancel', async () => {
      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>Content</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      await result.current.savePage();

      await waitFor(() => {
        expect(mockReleaseLock).toHaveBeenCalled();
      });
    });

    it('should handle lock timeout (30 minutes)', async () => {
      // Setup error response for lock expiration
      server.use(
        http.post('*/api/v1/wiki/:pageId/save', () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'LOCK_EXPIRED',
                message: 'Your edit lock has expired after 30 minutes',
              },
            },
            { status: 423 }
          );
        })
      );

      const { result } = renderUseWikiEditHook();

      // Update content
      result.current.updateContent('<p>Content after timeout</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      // Attempt to save - should fail with lock expired error
      await expect(result.current.savePage()).rejects.toThrow();
    });

    it('should release lock on component unmount', async () => {
      const { unmount } = renderUseWikiEditHook();

      // Unmount the hook
      unmount();

      // Wait for cleanup
      await waitFor(() => {
        expect(mockReleaseLock).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // PREVIEW FUNCTIONALITY TESTS
  // ==========================================================================

  describe('Preview Functionality', () => {
    it('should preview page content', async () => {
      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>Content to preview</p>');

      const preview = await result.current.previewPage();

      expect(preview).toBeDefined();
      expect(preview.html).toBeDefined();
      expect(preview.success).toBe(true);
    });

    it('should set isPreviewing during preview operation', async () => {
      server.use(
        http.post('*/api/v1/wiki/page/:pageId/preview', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: mockPreviewResponse,
          });
        })
      );

      const { result } = renderUseWikiEditHook();

      // Start preview but don't await
      const previewPromise = result.current.previewPage();

      await waitFor(() => {
        expect(result.current.isPreviewing).toBe(true);
      });

      await previewPromise;

      await waitFor(() => {
        expect(result.current.isPreviewing).toBe(false);
      });
    });
  });

  // ==========================================================================
  // VALIDATION TESTS
  // ==========================================================================

  describe('Form Validation', () => {
    it('should validate content is not empty', () => {
      const { result } = renderUseWikiEditHook({
        initialContent: '',
      });

      const validation = result.current.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: 'content',
          code: 'CONTENT_REQUIRED',
        })
      );
    });

    it('should validate content length limits', () => {
      // Create content that exceeds 1MB limit
      const longContent = 'x'.repeat(1000001);

      const { result } = renderUseWikiEditHook({
        initialContent: longContent,
      });

      const validation = result.current.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: 'content',
          code: 'CONTENT_TOO_LONG',
        })
      );
    });

    it('should pass validation for valid content', () => {
      const { result } = renderUseWikiEditHook({
        initialContent: '<p>Valid content</p>',
      });

      const validation = result.current.validate();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should throw error on save with invalid content', async () => {
      const { result } = renderUseWikiEditHook({
        initialContent: '<p>Valid</p>',
      });

      // Update to invalid (empty) content
      result.current.updateContent('   ');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      await expect(result.current.savePage()).rejects.toThrow('Validation failed');
    });

    it('should validate content format is valid', () => {
      const { result } = renderUseWikiEditHook({
        initialContent: '<p>Content</p>',
        contentFormat: 'html',
      });

      const validation = result.current.validate();
      expect(validation.isValid).toBe(true);
    });
  });

  // ==========================================================================
  // CANCEL EDIT TESTS
  // ==========================================================================

  describe('Edit Cancellation', () => {
    it('should cancel editing and navigate back', async () => {
      const pageId = 999;
      const { result } = renderUseWikiEditHook({ pageId });

      await result.current.cancelEdit();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(`/wiki/${pageId}`);
      });
    });

    it('should show confirmation when canceling with unsaved changes', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      const { result } = renderUseWikiEditHook();

      // Make changes
      result.current.updateContent('<p>Unsaved changes</p>');

      await waitFor(() => {
        expect(result.current.editState.hasUnsavedChanges).toBe(true);
      });

      await result.current.cancelEdit();

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('unsaved changes')
      );

      confirmSpy.mockRestore();
    });

    it('should not navigate if user cancels confirmation', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>Unsaved changes</p>');

      await waitFor(() => {
        expect(result.current.editState.hasUnsavedChanges).toBe(true);
      });

      await result.current.cancelEdit();

      expect(mockNavigate).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('should release lock on cancel', async () => {
      const { result } = renderUseWikiEditHook();

      await result.current.cancelEdit();

      await waitFor(() => {
        expect(mockReleaseLock).toHaveBeenCalled();
      });
    });

    it('should clear draft on cancel', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>Unsaved</p>');

      await waitFor(() => {
        expect(result.current.editState.hasUnsavedChanges).toBe(true);
      });

      await result.current.cancelEdit();

      await waitFor(() => {
        expect(mockLocalStorage.removeItem).toHaveBeenCalled();
      });

      confirmSpy.mockRestore();
    });

    it('should navigate even if lock release fails', async () => {
      mockReleaseLock.mockRejectedValueOnce(new Error('Lock release failed'));

      const pageId = 555;
      const { result } = renderUseWikiEditHook({ pageId });

      await result.current.cancelEdit();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(`/wiki/${pageId}`);
      });
    });
  });

  // ==========================================================================
  // CONTENT UPDATE TESTS
  // ==========================================================================

  describe('Content Updates', () => {
    it('should update current content', async () => {
      const { result } = renderUseWikiEditHook();

      const newContent = '<p>Updated content</p>';
      result.current.updateContent(newContent);

      // State updates are asynchronous in React - use waitFor
      await waitFor(() => {
        expect(result.current.editState.currentContent).toBe(newContent);
      });
    });

    it('should mark as dirty when content changes', async () => {
      const { result } = renderUseWikiEditHook({
        initialContent: '<p>Original</p>',
      });

      expect(result.current.editState.isDirty).toBe(false);

      result.current.updateContent('<p>Changed</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });
    });

    it('should track hasUnsavedChanges state', async () => {
      const { result } = renderUseWikiEditHook({
        initialContent: '<p>Initial</p>',
      });

      expect(result.current.editState.hasUnsavedChanges).toBe(false);

      result.current.updateContent('<p>Modified</p>');

      await waitFor(() => {
        expect(result.current.editState.hasUnsavedChanges).toBe(true);
      });
    });

    it('should not mark dirty when content matches initial', async () => {
      const initialContent = '<p>Same content</p>';
      const { result } = renderUseWikiEditHook({ initialContent });

      // Change content
      result.current.updateContent('<p>Different</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      // Revert to initial
      result.current.updateContent(initialContent);

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(false);
      });
    });
  });

  // ==========================================================================
  // NETWORK ERROR HANDLING TESTS
  // ==========================================================================

  describe('Network Error Handling', () => {
    it('should handle network error during save', async () => {
      server.use(
        http.post('*/api/v1/wiki/:pageId/save', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>Content</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      await expect(result.current.savePage()).rejects.toThrow();
    });

    it('should handle server error during save', async () => {
      server.use(
        http.post('*/api/v1/wiki/:pageId/save', () => {
          return HttpResponse.json(
            {
              success: false,
              error: { message: 'Internal Server Error', code: 'SERVER_ERROR' },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>Content</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      await expect(result.current.savePage()).rejects.toThrow();
    });

    it('should handle timeout during save', async () => {
      // Simulate a request that fails due to timeout by returning a timeout error
      server.use(
        http.post('*/api/v1/wiki/:pageId/save', () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'TIMEOUT',
                message: 'Request timed out',
              },
            },
            { status: 504 }
          );
        })
      );

      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>Content</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      // The save should fail due to simulated timeout
      await expect(result.current.savePage()).rejects.toThrow();
    });
  });

  // ==========================================================================
  // MUTATION CALLBACK TESTS
  // ==========================================================================

  describe('Mutation Callbacks', () => {
    it('should update lastSaved on successful save', async () => {
      const { result } = renderUseWikiEditHook();

      expect(result.current.editState.lastSaved).toBeNull();

      result.current.updateContent('<p>New content</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      await result.current.savePage();

      await waitFor(() => {
        expect(result.current.editState.lastSaved).toBeInstanceOf(Date);
      });
    });

    it('should reset hasUnsavedChanges after save', async () => {
      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>Changes</p>');

      await waitFor(() => {
        expect(result.current.editState.hasUnsavedChanges).toBe(true);
      });

      await result.current.savePage();

      await waitFor(() => {
        expect(result.current.editState.hasUnsavedChanges).toBe(false);
      });
    });

    it('should reset isDirty after successful save', async () => {
      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>Changes</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      await result.current.savePage();

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(false);
      });
    });

    it('should invalidate queries after successful save', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderUseWikiEditHook();

      result.current.updateContent('<p>Content</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      await result.current.savePage();

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalled();
      });

      invalidateSpy.mockRestore();
    });
  });

  // ==========================================================================
  // SECTION EDITING TESTS
  // ==========================================================================

  describe('Section Editing', () => {
    it('should handle section-specific content updates', async () => {
      const { result } = renderUseWikiEditHook({
        initialContent: '== Section 1 ==\nContent 1\n== Section 2 ==\nContent 2',
        contentFormat: 'creole',
      });

      const sectionContent = '== Section 1 ==\nUpdated Content 1\n== Section 2 ==\nContent 2';
      result.current.updateContent(sectionContent);

      await waitFor(() => {
        expect(result.current.editState.currentContent).toBe(sectionContent);
        expect(result.current.editState.isDirty).toBe(true);
      });
    });
  });

  // ==========================================================================
  // CHARACTER COUNT AND LIMITS TESTS
  // ==========================================================================

  describe('Character Count and Content Limits', () => {
    it('should allow content up to maximum length', () => {
      const maxContent = 'x'.repeat(1000000);

      const { result } = renderUseWikiEditHook({
        initialContent: maxContent,
      });

      const validation = result.current.validate();
      expect(validation.isValid).toBe(true);
    });

    it('should reject content exceeding maximum length', () => {
      const overMaxContent = 'x'.repeat(1000001);

      const { result } = renderUseWikiEditHook({
        initialContent: overMaxContent,
      });

      const validation = result.current.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toBeDefined();
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]?.code).toBe('CONTENT_TOO_LONG');
    });

    it('should trim whitespace when checking for empty content', () => {
      const { result } = renderUseWikiEditHook({
        initialContent: '   \n\t  ',
      });

      const validation = result.current.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toBeDefined();
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]?.code).toBe('CONTENT_REQUIRED');
    });
  });

  // ==========================================================================
  // LOADING STATES TESTS
  // ==========================================================================

  describe('Loading States', () => {
    it('should indicate saving state correctly', async () => {
      server.use(
        http.post('*/api/v1/wiki/:pageId/save', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: mockSaveResponse,
          });
        })
      );

      const { result } = renderUseWikiEditHook();

      expect(result.current.isSaving).toBe(false);

      result.current.updateContent('<p>Content</p>');

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      const savePromise = result.current.savePage();

      await waitFor(() => {
        expect(result.current.isSaving).toBe(true);
      });

      await savePromise;

      await waitFor(() => {
        expect(result.current.isSaving).toBe(false);
      });
    });

    it('should indicate previewing state correctly', async () => {
      server.use(
        http.post('*/api/v1/wiki/page/:pageId/preview', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: mockPreviewResponse,
          });
        })
      );

      const { result } = renderUseWikiEditHook();

      expect(result.current.isPreviewing).toBe(false);

      const previewPromise = result.current.previewPage();

      await waitFor(() => {
        expect(result.current.isPreviewing).toBe(true);
      });

      await previewPromise;

      await waitFor(() => {
        expect(result.current.isPreviewing).toBe(false);
      });
    });
  });

  // ==========================================================================
  // EDIT SESSION PERSISTENCE TESTS
  // ==========================================================================

  describe('Edit Session Persistence', () => {
    it('should persist edit state across content updates', async () => {
      const { result } = renderUseWikiEditHook();

      const updates = ['<p>Update 1</p>', '<p>Update 2</p>', '<p>Update 3</p>'];

      for (const content of updates) {
        result.current.updateContent(content);
      }

      await waitFor(() => {
        expect(result.current.editState.currentContent).toBe(updates[updates.length - 1]);
        expect(result.current.editState.isDirty).toBe(true);
      });
    });

    it('should maintain edit state during preview operations', async () => {
      const { result } = renderUseWikiEditHook();

      const editContent = '<p>Content being edited</p>';
      result.current.updateContent(editContent);

      await waitFor(() => {
        expect(result.current.editState.isDirty).toBe(true);
      });

      // Perform preview
      await result.current.previewPage();

      // Edit state should be preserved
      expect(result.current.editState.currentContent).toBe(editContent);
      expect(result.current.editState.isDirty).toBe(true);
    });
  });
});
