/**
 * Comprehensive Vitest Unit Tests for useCategories React Query Hooks
 *
 * Tests glossary category CRUD operations including:
 * - Category fetching with entry counts and auto-link settings
 * - Category creation with optimistic updates
 * - Category updates with cache management
 * - Category deletion with cascade handling
 * - Error handling for constraint violations
 * - Cache invalidation after mutations
 *
 * @module tests/unit/features/activities/glossary/hooks/useCategories.test
 * @see react-frontend/src/features/activities/glossary/hooks/useCategories.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import React from 'react';

import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  categoryQueryKeys,
} from '@/features/activities/glossary/hooks/useCategories';

import type {
  GlossaryCategory,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@/features/activities/glossary/types/glossary.types';

import { createTestQueryClient } from '@tests/helpers/render';
import { server } from '@tests/mocks/server';

// ============================================================================
// Test Constants and Mock Data Helpers
// ============================================================================

const TEST_GLOSSARY_ID = 42;
/**
 * Uses wildcard prefix to match full URLs like http://localhost:8000/api/v1/...
 */
const API_BASE_URL = '*/api/v1';

/**
 * Creates a mock glossary category for testing
 */
function createMockCategory(overrides: Partial<GlossaryCategory> = {}): GlossaryCategory {
  return {
    id: 1,
    glossaryid: TEST_GLOSSARY_ID,
    name: 'Test Category',
    usedynalink: false,
    entrycount: 0,
    ...overrides,
  };
}

/**
 * Creates multiple mock categories for list testing
 */
function createMockCategories(count: number = 3): GlossaryCategory[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    glossaryid: TEST_GLOSSARY_ID,
    name: `Category ${String.fromCharCode(65 + index)}`, // A, B, C...
    usedynalink: index % 2 === 0,
    entrycount: index * 5,
  }));
}

// ============================================================================
// Test Wrapper Setup
// ============================================================================

/**
 * Creates a wrapper component with QueryClientProvider for hook testing
 */
function createWrapper(queryClient: QueryClient) {
  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Test Suite: useCategories Hook
// ============================================================================

describe('useCategories', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  describe('successful category list fetch', () => {
    it('should return loading state initially', () => {
      const mockCategories = createMockCategories(3);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
          return HttpResponse.json({
            success: true,
            data: mockCategories,
          });
        })
      );

      const { result } = renderHook(
        () => useCategories(TEST_GLOSSARY_ID),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should fetch categories successfully', async () => {
      const mockCategories = createMockCategories(3);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
          return HttpResponse.json({
            success: true,
            data: mockCategories,
          });
        })
      );

      const { result } = renderHook(
        () => useCategories(TEST_GLOSSARY_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBeDefined();
      expect(result.current.data).toHaveLength(3);
    });

    it('should return empty array for glossary with no categories', async () => {
      server.use(
        http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
          return HttpResponse.json({
            success: true,
            data: [],
          });
        })
      );

      const { result } = renderHook(
        () => useCategories(TEST_GLOSSARY_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual([]);
    });

    it('should return correct category data structure', async () => {
      const mockCategory = createMockCategory({
        id: 5,
        name: 'Programming Terms',
        usedynalink: true,
        entrycount: 15,
      });

      server.use(
        http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
          return HttpResponse.json({
            success: true,
            data: [mockCategory],
          });
        })
      );

      const { result } = renderHook(
        () => useCategories(TEST_GLOSSARY_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const category = result.current.data?.[0];
      expect(category?.id).toBe(5);
      expect(category?.name).toBe('Programming Terms');
      expect(category?.usedynalink).toBe(true);
      expect(category?.entrycount).toBe(15);
      expect(category?.glossaryid).toBe(TEST_GLOSSARY_ID);
    });

    it('should use correct cache key', async () => {
      const mockCategories = createMockCategories(2);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
          return HttpResponse.json({
            success: true,
            data: mockCategories,
          });
        })
      );

      const { result } = renderHook(
        () => useCategories(TEST_GLOSSARY_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify cache key format: ['glossary', glossaryId, 'categories']
      const expectedKey = categoryQueryKeys.list(TEST_GLOSSARY_ID);
      expect(expectedKey).toEqual(['glossary', TEST_GLOSSARY_ID, 'categories']);

      const cachedData = queryClient.getQueryData(expectedKey);
      expect(cachedData).toBeDefined();
    });

    it('should sort categories alphabetically by name', async () => {
      const unsortedCategories = [
        createMockCategory({ id: 1, name: 'Zebra' }),
        createMockCategory({ id: 2, name: 'Alpha' }),
        createMockCategory({ id: 3, name: 'Middle' }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
          return HttpResponse.json({
            success: true,
            data: unsortedCategories,
          });
        })
      );

      const { result } = renderHook(
        () => useCategories(TEST_GLOSSARY_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0]?.name).toBe('Alpha');
      expect(result.current.data?.[1]?.name).toBe('Middle');
      expect(result.current.data?.[2]?.name).toBe('Zebra');
    });

    it('should include entry count for each category', async () => {
      const mockCategories = [
        createMockCategory({ id: 1, name: 'Empty', entrycount: 0 }),
        createMockCategory({ id: 2, name: 'Few', entrycount: 5 }),
        createMockCategory({ id: 3, name: 'Many', entrycount: 100 }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
          return HttpResponse.json({
            success: true,
            data: mockCategories,
          });
        })
      );

      const { result } = renderHook(
        () => useCategories(TEST_GLOSSARY_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const empty = result.current.data?.find((c) => c.name === 'Empty');
      const few = result.current.data?.find((c) => c.name === 'Few');
      const many = result.current.data?.find((c) => c.name === 'Many');

      expect(empty?.entrycount).toBe(0);
      expect(few?.entrycount).toBe(5);
      expect(many?.entrycount).toBe(100);
    });

    it('should include auto-link configuration flag for each category', async () => {
      const mockCategories = [
        createMockCategory({ id: 1, name: 'AutoLink Enabled', usedynalink: true }),
        createMockCategory({ id: 2, name: 'AutoLink Disabled', usedynalink: false }),
      ];

      server.use(
        http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
          return HttpResponse.json({
            success: true,
            data: mockCategories,
          });
        })
      );

      const { result } = renderHook(
        () => useCategories(TEST_GLOSSARY_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const enabled = result.current.data?.find((c) => c.name === 'AutoLink Enabled');
      const disabled = result.current.data?.find((c) => c.name === 'AutoLink Disabled');

      expect(enabled?.usedynalink).toBe(true);
      expect(disabled?.usedynalink).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle failed fetch with error state', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      server.use(
        http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: 'Internal server error',
              },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(
        () => useCategories(TEST_GLOSSARY_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();

      consoleSpy.mockRestore();
    });

    it('should handle network failures', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      server.use(
        http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(
        () => useCategories(TEST_GLOSSARY_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should handle permission denied error (403)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      server.use(
        http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to view categories',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(
        () => useCategories(TEST_GLOSSARY_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe('query behavior', () => {
    it('should not run query when glossaryId is 0', () => {
      const { result } = renderHook(
        () => useCategories(0),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.isLoading).toBe(false);
    });

    it('should not run query when glossaryId is negative', () => {
      const { result } = renderHook(
        () => useCategories(-1),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should support enabled option', async () => {
      const { result } = renderHook(
        () => useCategories(TEST_GLOSSARY_ID, { enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.isLoading).toBe(false);
    });

    it('should support refetch behavior', async () => {
      let fetchCount = 0;
      const mockCategories = createMockCategories(2);

      server.use(
        http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
          fetchCount++;
          return HttpResponse.json({
            success: true,
            data: mockCategories,
          });
        })
      );

      const { result } = renderHook(
        () => useCategories(TEST_GLOSSARY_ID),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchCount).toBe(1);

      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(fetchCount).toBe(2);
    });
  });
});

// ============================================================================
// Test Suite: useCreateCategory Hook
// ============================================================================

describe('useCreateCategory', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  describe('successful category creation', () => {
    it('should create a category successfully', async () => {
      const newCategory: CreateCategoryInput = {
        glossaryId: TEST_GLOSSARY_ID,
        name: 'New Category',
        usedynalink: false,
      };

      const createdCategory = createMockCategory({
        id: 10,
        name: newCategory.name,
        usedynalink: newCategory.usedynalink,
      });

      server.use(
        http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
          return HttpResponse.json({
            success: true,
            data: createdCategory,
          }, { status: 201 });
        })
      );

      const { result } = renderHook(
        () => useCreateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate(newCategory);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(createdCategory);
    });

    it('should handle required fields validation (name)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      server.use(
        http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Category name is required',
              },
            },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(
        () => useCreateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      const invalidInput: CreateCategoryInput = {
        glossaryId: TEST_GLOSSARY_ID,
        name: '',
        usedynalink: false,
      };

      await act(async () => {
        result.current.mutate(invalidInput);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should create category with auto-link enabled', async () => {
      const newCategory: CreateCategoryInput = {
        glossaryId: TEST_GLOSSARY_ID,
        name: 'AutoLink Category',
        usedynalink: true,
      };

      const createdCategory = createMockCategory({
        id: 11,
        name: newCategory.name,
        usedynalink: true,
      });

      server.use(
        http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
          return HttpResponse.json({
            success: true,
            data: createdCategory,
          }, { status: 201 });
        })
      );

      const { result } = renderHook(
        () => useCreateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate(newCategory);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.usedynalink).toBe(true);
    });

    it('should create category with auto-link disabled', async () => {
      const newCategory: CreateCategoryInput = {
        glossaryId: TEST_GLOSSARY_ID,
        name: 'No AutoLink Category',
        usedynalink: false,
      };

      const createdCategory = createMockCategory({
        id: 12,
        name: newCategory.name,
        usedynalink: false,
      });

      server.use(
        http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
          return HttpResponse.json({
            success: true,
            data: createdCategory,
          }, { status: 201 });
        })
      );

      const { result } = renderHook(
        () => useCreateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate(newCategory);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.usedynalink).toBe(false);
    });
  });

  describe('optimistic updates', () => {
    it('should show immediate UI feedback with optimistic update', async () => {
      const existingCategories = createMockCategories(2);

      // Pre-populate cache
      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        existingCategories
      );

      const newCategory: CreateCategoryInput = {
        glossaryId: TEST_GLOSSARY_ID,
        name: 'Optimistic Category',
        usedynalink: false,
      };

      let resolveRequest: () => void;
      const requestPromise = new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });

      server.use(
        http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
          await requestPromise;
          return HttpResponse.json({
            success: true,
            data: createMockCategory({
              id: 100,
              name: newCategory.name,
              usedynalink: newCategory.usedynalink,
            }),
          }, { status: 201 });
        })
      );

      const { result } = renderHook(
        () => useCreateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      // Start mutation without waiting
      act(() => {
        result.current.mutate(newCategory);
      });

      // Check optimistic update immediately
      await waitFor(() => {
        const cachedData = queryClient.getQueryData<GlossaryCategory[]>(
          categoryQueryKeys.list(TEST_GLOSSARY_ID)
        );
        // Should have the original 2 + 1 optimistic
        expect(cachedData?.length).toBe(3);
        expect(cachedData?.some((c) => c.name === 'Optimistic Category')).toBe(true);
      });

      // Resolve the request
      resolveRequest!();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate cache after successful creation', async () => {
      const existingCategories = createMockCategories(1);

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        existingCategories
      );

      const newCategory: CreateCategoryInput = {
        glossaryId: TEST_GLOSSARY_ID,
        name: 'New Category',
        usedynalink: false,
      };

      const createdCategory = createMockCategory({
        id: 50,
        name: newCategory.name,
        usedynalink: newCategory.usedynalink,
      });

      server.use(
        http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
          return HttpResponse.json({
            success: true,
            data: createdCategory,
          }, { status: 201 });
        }),
        http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
          return HttpResponse.json({
            success: true,
            data: [...existingCategories, createdCategory],
          });
        })
      );

      const { result } = renderHook(
        () => useCreateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate(newCategory);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Cache should be invalidated and contain new category
      const cacheState = queryClient.getQueryState(
        categoryQueryKeys.list(TEST_GLOSSARY_ID)
      );
      expect(cacheState?.isInvalidated).toBe(true);
    });
  });

  describe('mutation state', () => {
    it('should track loading state (isPending)', async () => {
      let resolveRequest: () => void;
      const requestPromise = new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });

      server.use(
        http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
          await requestPromise;
          return HttpResponse.json({
            success: true,
            data: createMockCategory({ id: 20 }),
          }, { status: 201 });
        })
      );

      const { result } = renderHook(
        () => useCreateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate({
          glossaryId: TEST_GLOSSARY_ID,
          name: 'Test',
          usedynalink: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      resolveRequest!();

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should execute success callback', async () => {
      const onSuccessMock = vi.fn();

      const createdCategory = createMockCategory({ id: 25 });

      server.use(
        http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
          return HttpResponse.json({
            success: true,
            data: createdCategory,
          }, { status: 201 });
        })
      );

      const { result } = renderHook(
        () => useCreateCategory({ onSuccess: onSuccessMock }),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          glossaryId: TEST_GLOSSARY_ID,
          name: 'Test',
          usedynalink: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccessMock).toHaveBeenCalledTimes(1);
      expect(onSuccessMock).toHaveBeenCalledWith(
        createdCategory,
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should handle duplicate category name', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      server.use(
        http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'DUPLICATE_CATEGORY',
                message: 'A category with this name already exists',
              },
            },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(
        () => useCreateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          glossaryId: TEST_GLOSSARY_ID,
          name: 'Existing Category',
          usedynalink: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should handle validation error for name too long', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      server.use(
        http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Category name must not exceed 255 characters',
              },
            },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(
        () => useCreateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          glossaryId: TEST_GLOSSARY_ID,
          name: 'A'.repeat(300),
          usedynalink: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      consoleSpy.mockRestore();
    });

    it('should handle permission denied error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      server.use(
        http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to manage categories',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(
        () => useCreateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          glossaryId: TEST_GLOSSARY_ID,
          name: 'Test Category',
          usedynalink: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      consoleSpy.mockRestore();
    });

    it('should rollback optimistic update on error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const existingCategories = createMockCategories(2);

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        existingCategories
      );

      server.use(
        http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: 'Internal server error',
              },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(
        () => useCreateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          glossaryId: TEST_GLOSSARY_ID,
          name: 'Will Fail',
          usedynalink: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Cache should be rolled back to original categories
      const cachedData = queryClient.getQueryData<GlossaryCategory[]>(
        categoryQueryKeys.list(TEST_GLOSSARY_ID)
      );
      expect(cachedData?.length).toBe(2);
      expect(cachedData?.some((c) => c.name === 'Will Fail')).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});

// ============================================================================
// Test Suite: useUpdateCategory Hook
// ============================================================================

describe('useUpdateCategory', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  describe('successful category update', () => {
    it('should update category name successfully', async () => {
      const existingCategory = createMockCategory({
        id: 5,
        name: 'Old Name',
        usedynalink: false,
      });

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        [existingCategory]
      );

      const updateInput: UpdateCategoryInput = {
        categoryId: 5,
        name: 'New Name',
        usedynalink: false,
      };

      const updatedCategory = { ...existingCategory, name: 'New Name' };

      server.use(
        http.put(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json({
            success: true,
            data: updatedCategory,
          });
        })
      );

      const { result } = renderHook(
        () => useUpdateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.name).toBe('New Name');
    });

    it('should toggle auto-link setting', async () => {
      const existingCategory = createMockCategory({
        id: 6,
        name: 'Category',
        usedynalink: false,
      });

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        [existingCategory]
      );

      const updateInput: UpdateCategoryInput = {
        categoryId: 6,
        name: 'Category',
        usedynalink: true,
      };

      const updatedCategory = { ...existingCategory, usedynalink: true };

      server.use(
        http.put(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json({
            success: true,
            data: updatedCategory,
          });
        })
      );

      const { result } = renderHook(
        () => useUpdateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate(updateInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.usedynalink).toBe(true);
    });
  });

  describe('optimistic updates', () => {
    it('should apply optimistic update immediately', async () => {
      const existingCategories = [
        createMockCategory({ id: 1, name: 'Original' }),
      ];

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        existingCategories
      );

      let resolveRequest: () => void;
      const requestPromise = new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });

      server.use(
        http.put(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          await requestPromise;
          return HttpResponse.json({
            success: true,
            data: createMockCategory({ id: 1, name: 'Updated' }),
          });
        })
      );

      const { result } = renderHook(
        () => useUpdateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      act(() => {
        result.current.mutate({
          categoryId: 1,
          name: 'Updated',
          usedynalink: false,
        });
      });

      // Check optimistic update applied immediately
      await waitFor(() => {
        const cachedData = queryClient.getQueryData<GlossaryCategory[]>(
          categoryQueryKeys.list(TEST_GLOSSARY_ID)
        );
        expect(cachedData?.[0]?.name).toBe('Updated');
      });

      resolveRequest!();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('cache management', () => {
    it('should invalidate cache after successful update', async () => {
      const existingCategory = createMockCategory({ id: 7, name: 'Test' });

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        [existingCategory]
      );

      server.use(
        http.put(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json({
            success: true,
            data: { ...existingCategory, name: 'Updated Test' },
          });
        })
      );

      const { result } = renderHook(
        () => useUpdateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 7,
          name: 'Updated Test',
          usedynalink: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const cacheState = queryClient.getQueryState(
        categoryQueryKeys.list(TEST_GLOSSARY_ID)
      );
      expect(cacheState?.isInvalidated).toBe(true);
    });
  });

  describe('mutation state', () => {
    it('should track loading state during update', async () => {
      const existingCategory = createMockCategory({ id: 8 });

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        [existingCategory]
      );

      let resolveRequest: () => void;
      const requestPromise = new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });

      server.use(
        http.put(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          await requestPromise;
          return HttpResponse.json({
            success: true,
            data: existingCategory,
          });
        })
      );

      const { result } = renderHook(
        () => useUpdateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate({
          categoryId: 8,
          name: 'Updated',
          usedynalink: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      resolveRequest!();

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
    });

    it('should execute success callback after update', async () => {
      const onSuccessMock = vi.fn();
      const existingCategory = createMockCategory({ id: 9 });

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        [existingCategory]
      );

      const updatedCategory = { ...existingCategory, name: 'Updated' };

      server.use(
        http.put(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json({
            success: true,
            data: updatedCategory,
          });
        })
      );

      const { result } = renderHook(
        () => useUpdateCategory({ onSuccess: onSuccessMock }),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 9,
          name: 'Updated',
          usedynalink: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccessMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle not found error (404)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        []
      );

      server.use(
        http.put(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Category not found',
              },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(
        () => useUpdateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 999,
          name: 'Updated',
          usedynalink: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      consoleSpy.mockRestore();
    });

    it('should handle validation errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const existingCategory = createMockCategory({ id: 10 });

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        [existingCategory]
      );

      server.use(
        http.put(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid category name',
              },
            },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(
        () => useUpdateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 10,
          name: '',
          usedynalink: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      consoleSpy.mockRestore();
    });

    it('should handle permission check failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const existingCategory = createMockCategory({ id: 11 });

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        [existingCategory]
      );

      server.use(
        http.put(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to edit this category',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(
        () => useUpdateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 11,
          name: 'Updated',
          usedynalink: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      consoleSpy.mockRestore();
    });

    it('should rollback optimistic update on error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const existingCategory = createMockCategory({ id: 12, name: 'Original Name' });

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        [existingCategory]
      );

      server.use(
        http.put(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: 'Internal server error',
              },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(
        () => useUpdateCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 12,
          name: 'Updated Name',
          usedynalink: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Cache should be rolled back to original
      const cachedData = queryClient.getQueryData<GlossaryCategory[]>(
        categoryQueryKeys.list(TEST_GLOSSARY_ID)
      );
      expect(cachedData?.[0]?.name).toBe('Original Name');

      consoleSpy.mockRestore();
    });
  });
});

// ============================================================================
// Test Suite: useDeleteCategory Hook
// ============================================================================

describe('useDeleteCategory', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  describe('successful category deletion', () => {
    it('should delete empty category successfully', async () => {
      const existingCategories = [
        createMockCategory({ id: 1, name: 'To Delete', entrycount: 0 }),
        createMockCategory({ id: 2, name: 'Keep', entrycount: 5 }),
      ];

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        existingCategories
      );

      server.use(
        http.delete(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json({
            success: true,
            data: { deleted: true },
          });
        })
      );

      const { result } = renderHook(
        () => useDeleteCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 1,
          glossaryId: TEST_GLOSSARY_ID,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(true);
    });
  });

  describe('optimistic removal', () => {
    it('should remove category from UI immediately', async () => {
      const existingCategories = [
        createMockCategory({ id: 1, name: 'First' }),
        createMockCategory({ id: 2, name: 'Second' }),
        createMockCategory({ id: 3, name: 'Third' }),
      ];

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        existingCategories
      );

      let resolveRequest: () => void;
      const requestPromise = new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });

      server.use(
        http.delete(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          await requestPromise;
          return HttpResponse.json({
            success: true,
            data: true,
          });
        })
      );

      const { result } = renderHook(
        () => useDeleteCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      act(() => {
        result.current.mutate({
          categoryId: 2,
          glossaryId: TEST_GLOSSARY_ID,
        });
      });

      // Check optimistic removal immediately
      await waitFor(() => {
        const cachedData = queryClient.getQueryData<GlossaryCategory[]>(
          categoryQueryKeys.list(TEST_GLOSSARY_ID)
        );
        expect(cachedData?.length).toBe(2);
        expect(cachedData?.find((c) => c.id === 2)).toBeUndefined();
      });

      resolveRequest!();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('cache management', () => {
    it('should invalidate cache after successful delete', async () => {
      const existingCategories = [
        createMockCategory({ id: 1, name: 'Category' }),
      ];

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        existingCategories
      );

      server.use(
        http.delete(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json({
            success: true,
            data: true,
          });
        })
      );

      const { result } = renderHook(
        () => useDeleteCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 1,
          glossaryId: TEST_GLOSSARY_ID,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Cache should be invalidated
      const cacheState = queryClient.getQueryState(
        categoryQueryKeys.list(TEST_GLOSSARY_ID)
      );
      expect(cacheState?.isInvalidated).toBe(true);
    });

    it('should also invalidate entries cache after delete', async () => {
      const existingCategories = [
        createMockCategory({ id: 1, name: 'Category' }),
      ];

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        existingCategories
      );

      // Set up entries cache
      queryClient.setQueryData(
        ['glossary', TEST_GLOSSARY_ID, 'entries'],
        []
      );

      server.use(
        http.delete(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json({
            success: true,
            data: true,
          });
        })
      );

      const { result } = renderHook(
        () => useDeleteCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 1,
          glossaryId: TEST_GLOSSARY_ID,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Entries cache should also be invalidated
      const entriesCacheState = queryClient.getQueryState(
        ['glossary', TEST_GLOSSARY_ID, 'entries']
      );
      expect(entriesCacheState?.isInvalidated).toBe(true);
    });
  });

  describe('mutation state', () => {
    it('should track loading state during deletion', async () => {
      const existingCategories = [
        createMockCategory({ id: 1 }),
      ];

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        existingCategories
      );

      let resolveRequest: () => void;
      const requestPromise = new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });

      server.use(
        http.delete(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          await requestPromise;
          return HttpResponse.json({
            success: true,
            data: true,
          });
        })
      );

      const { result } = renderHook(
        () => useDeleteCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate({
          categoryId: 1,
          glossaryId: TEST_GLOSSARY_ID,
        });
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      resolveRequest!();

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should execute success callback after deletion', async () => {
      const onSuccessMock = vi.fn();

      const existingCategories = [
        createMockCategory({ id: 1 }),
      ];

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        existingCategories
      );

      server.use(
        http.delete(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json({
            success: true,
            data: true,
          });
        })
      );

      const { result } = renderHook(
        () => useDeleteCategory({ onSuccess: onSuccessMock }),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 1,
          glossaryId: TEST_GLOSSARY_ID,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccessMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('cascade handling', () => {
    it('should handle deleting category with assigned entries (server cascades)', async () => {
      const categoryWithEntries = createMockCategory({
        id: 5,
        name: 'Category With Entries',
        entrycount: 10,
      });

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        [categoryWithEntries]
      );

      // Server handles cascade - entries become uncategorized
      server.use(
        http.delete(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json({
            success: true,
            data: true,
          });
        })
      );

      const { result } = renderHook(
        () => useDeleteCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 5,
          glossaryId: TEST_GLOSSARY_ID,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Category should be removed from cache
      const cachedData = queryClient.getQueryData<GlossaryCategory[]>(
        categoryQueryKeys.list(TEST_GLOSSARY_ID)
      );
      expect(cachedData?.find((c) => c.id === 5)).toBeUndefined();
    });

    it('should handle constraint violation error (if server rejects)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const categoryWithEntries = createMockCategory({
        id: 6,
        name: 'Category With Entries',
        entrycount: 5,
      });

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        [categoryWithEntries]
      );

      server.use(
        http.delete(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'CONSTRAINT_VIOLATION',
                message: 'Cannot delete category with assigned entries',
              },
            },
            { status: 409 }
          );
        })
      );

      const { result } = renderHook(
        () => useDeleteCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 6,
          glossaryId: TEST_GLOSSARY_ID,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Category should be restored in cache after rollback
      const cachedData = queryClient.getQueryData<GlossaryCategory[]>(
        categoryQueryKeys.list(TEST_GLOSSARY_ID)
      );
      expect(cachedData?.find((c) => c.id === 6)).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle permission check failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const existingCategories = [
        createMockCategory({ id: 1 }),
      ];

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        existingCategories
      );

      server.use(
        http.delete(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to delete this category',
              },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(
        () => useDeleteCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 1,
          glossaryId: TEST_GLOSSARY_ID,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      consoleSpy.mockRestore();
    });

    it('should handle not found error (404)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        []
      );

      server.use(
        http.delete(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Category not found',
              },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(
        () => useDeleteCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 999,
          glossaryId: TEST_GLOSSARY_ID,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      consoleSpy.mockRestore();
    });

    it('should handle network failures (500, 503)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const existingCategories = [
        createMockCategory({ id: 1 }),
      ];

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        existingCategories
      );

      server.use(
        http.delete(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: 'Service unavailable',
              },
            },
            { status: 503 }
          );
        })
      );

      const { result } = renderHook(
        () => useDeleteCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 1,
          glossaryId: TEST_GLOSSARY_ID,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      consoleSpy.mockRestore();
    });

    it('should rollback optimistic removal on error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const existingCategories = [
        createMockCategory({ id: 1, name: 'Should Remain' }),
        createMockCategory({ id: 2, name: 'Also Remain' }),
      ];

      queryClient.setQueryData(
        categoryQueryKeys.list(TEST_GLOSSARY_ID),
        existingCategories
      );

      server.use(
        http.delete(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
          return HttpResponse.json(
            {
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: 'Deletion failed',
              },
            },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(
        () => useDeleteCategory(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.mutate({
          categoryId: 1,
          glossaryId: TEST_GLOSSARY_ID,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Cache should be rolled back - both categories restored
      const cachedData = queryClient.getQueryData<GlossaryCategory[]>(
        categoryQueryKeys.list(TEST_GLOSSARY_ID)
      );
      expect(cachedData?.length).toBe(2);
      expect(cachedData?.find((c) => c.id === 1)).toBeDefined();
      expect(cachedData?.find((c) => c.id === 2)).toBeDefined();

      consoleSpy.mockRestore();
    });
  });
});

// ============================================================================
// Test Suite: Auto-link Feature
// ============================================================================

describe('Auto-link Feature Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  it('should create category with auto-link enabled', async () => {
    const createdCategory = createMockCategory({
      id: 100,
      name: 'AutoLink Test',
      usedynalink: true,
    });

    server.use(
      http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
        return HttpResponse.json({
          success: true,
          data: createdCategory,
        }, { status: 201 });
      })
    );

    const { result } = renderHook(
      () => useCreateCategory(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      result.current.mutate({
        glossaryId: TEST_GLOSSARY_ID,
        name: 'AutoLink Test',
        usedynalink: true,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.usedynalink).toBe(true);
  });

  it('should create category with auto-link disabled', async () => {
    const createdCategory = createMockCategory({
      id: 101,
      name: 'No AutoLink',
      usedynalink: false,
    });

    server.use(
      http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
        return HttpResponse.json({
          success: true,
          data: createdCategory,
        }, { status: 201 });
      })
    );

    const { result } = renderHook(
      () => useCreateCategory(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      result.current.mutate({
        glossaryId: TEST_GLOSSARY_ID,
        name: 'No AutoLink',
        usedynalink: false,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.usedynalink).toBe(false);
  });

  it('should toggle auto-link from false to true in update', async () => {
    const existingCategory = createMockCategory({
      id: 102,
      name: 'Toggle Test',
      usedynalink: false,
    });

    queryClient.setQueryData(
      categoryQueryKeys.list(TEST_GLOSSARY_ID),
      [existingCategory]
    );

    const updatedCategory = { ...existingCategory, usedynalink: true };

    server.use(
      http.put(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
        return HttpResponse.json({
          success: true,
          data: updatedCategory,
        });
      })
    );

    const { result } = renderHook(
      () => useUpdateCategory(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      result.current.mutate({
        categoryId: 102,
        name: 'Toggle Test',
        usedynalink: true,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.usedynalink).toBe(true);
  });

  it('should toggle auto-link from true to false in update', async () => {
    const existingCategory = createMockCategory({
      id: 103,
      name: 'Toggle Test',
      usedynalink: true,
    });

    queryClient.setQueryData(
      categoryQueryKeys.list(TEST_GLOSSARY_ID),
      [existingCategory]
    );

    const updatedCategory = { ...existingCategory, usedynalink: false };

    server.use(
      http.put(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
        return HttpResponse.json({
          success: true,
          data: updatedCategory,
        });
      })
    );

    const { result } = renderHook(
      () => useUpdateCategory(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      result.current.mutate({
        categoryId: 103,
        name: 'Toggle Test',
        usedynalink: false,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.usedynalink).toBe(false);
  });
});

// ============================================================================
// Test Suite: Cache Management
// ============================================================================

describe('Cache Management Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  it('should use correct cache invalidation strategy for create', async () => {
    const mockCategories = createMockCategories(2);

    queryClient.setQueryData(
      categoryQueryKeys.list(TEST_GLOSSARY_ID),
      mockCategories
    );

    const newCategory = createMockCategory({ id: 50, name: 'New' });

    server.use(
      http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
        return HttpResponse.json({
          success: true,
          data: newCategory,
        }, { status: 201 });
      })
    );

    const { result } = renderHook(
      () => useCreateCategory(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      result.current.mutate({
        glossaryId: TEST_GLOSSARY_ID,
        name: 'New',
        usedynalink: false,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify cache is invalidated
    const cacheState = queryClient.getQueryState(
      categoryQueryKeys.list(TEST_GLOSSARY_ID)
    );
    expect(cacheState?.isInvalidated).toBe(true);
  });

  it('should handle cache synchronization across components', async () => {
    const mockCategories = createMockCategories(3);

    server.use(
      http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
        return HttpResponse.json({
          success: true,
          data: mockCategories,
        });
      })
    );

    // Simulate two components using the same hook
    const { result: result1 } = renderHook(
      () => useCategories(TEST_GLOSSARY_ID),
      { wrapper: createWrapper(queryClient) }
    );

    const { result: result2 } = renderHook(
      () => useCategories(TEST_GLOSSARY_ID),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
      expect(result2.current.isSuccess).toBe(true);
    });

    // Both should have same data from shared cache
    expect(result1.current.data).toEqual(result2.current.data);
  });

  it('should handle different glossary IDs with separate caches', async () => {
    const glossary1Categories = [createMockCategory({ id: 1, glossaryid: 1, name: 'Cat 1' })];
    const glossary2Categories = [createMockCategory({ id: 2, glossaryid: 2, name: 'Cat 2' })];

    server.use(
      http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, ({ params }) => {
        const glossaryId = Number(params.glossaryId);
        if (glossaryId === 1) {
          return HttpResponse.json({
            success: true,
            data: glossary1Categories,
          });
        }
        return HttpResponse.json({
          success: true,
          data: glossary2Categories,
        });
      })
    );

    const { result: result1 } = renderHook(
      () => useCategories(1),
      { wrapper: createWrapper(queryClient) }
    );

    const { result: result2 } = renderHook(
      () => useCategories(2),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
      expect(result2.current.isSuccess).toBe(true);
    });

    expect(result1.current.data?.[0]?.name).toBe('Cat 1');
    expect(result2.current.data?.[0]?.name).toBe('Cat 2');
  });
});

// ============================================================================
// Test Suite: Integration Tests - CRUD Workflow
// ============================================================================

describe('Integration Tests - CRUD Workflow', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  it('should handle create → update → delete workflow', async () => {
    // Step 1: Create
    const createdCategory = createMockCategory({
      id: 200,
      name: 'Workflow Test',
      usedynalink: false,
    });

    server.use(
      http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
        return HttpResponse.json({
          success: true,
          data: createdCategory,
        }, { status: 201 });
      }),
      http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
        return HttpResponse.json({
          success: true,
          data: [createdCategory],
        });
      })
    );

    const { result: createResult } = renderHook(
      () => useCreateCategory(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      createResult.current.mutate({
        glossaryId: TEST_GLOSSARY_ID,
        name: 'Workflow Test',
        usedynalink: false,
      });
    });

    await waitFor(() => {
      expect(createResult.current.isSuccess).toBe(true);
    });

    // Step 2: Update
    const updatedCategory = { ...createdCategory, name: 'Updated Workflow' };

    // Update the cache with created category first
    queryClient.setQueryData(
      categoryQueryKeys.list(TEST_GLOSSARY_ID),
      [createdCategory]
    );

    server.use(
      http.put(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
        return HttpResponse.json({
          success: true,
          data: updatedCategory,
        });
      })
    );

    const { result: updateResult } = renderHook(
      () => useUpdateCategory(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      updateResult.current.mutate({
        categoryId: 200,
        name: 'Updated Workflow',
        usedynalink: false,
      });
    });

    await waitFor(() => {
      expect(updateResult.current.isSuccess).toBe(true);
    });

    // Update cache for delete test
    queryClient.setQueryData(
      categoryQueryKeys.list(TEST_GLOSSARY_ID),
      [updatedCategory]
    );

    // Step 3: Delete
    server.use(
      http.delete(`${API_BASE_URL}/glossary/categories/:categoryId`, async () => {
        return HttpResponse.json({
          success: true,
          data: true,
        });
      })
    );

    const { result: deleteResult } = renderHook(
      () => useDeleteCategory(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      deleteResult.current.mutate({
        categoryId: 200,
        glossaryId: TEST_GLOSSARY_ID,
      });
    });

    await waitFor(() => {
      expect(deleteResult.current.isSuccess).toBe(true);
    });

    // Verify final state - category should be removed
    const cachedData = queryClient.getQueryData<GlossaryCategory[]>(
      categoryQueryKeys.list(TEST_GLOSSARY_ID)
    );
    expect(cachedData?.find((c) => c.id === 200)).toBeUndefined();
  });

  it('should handle creating multiple categories', async () => {
    let categoryIdCounter = 300;

    server.use(
      http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async ({ request }) => {
        const body = await request.json() as CreateCategoryInput;
        return HttpResponse.json({
          success: true,
          data: createMockCategory({
            id: categoryIdCounter++,
            name: body.name,
            usedynalink: body.usedynalink,
          }),
        }, { status: 201 });
      })
    );

    const { result } = renderHook(
      () => useCreateCategory(),
      { wrapper: createWrapper(queryClient) }
    );

    // Create first category
    await act(async () => {
      result.current.mutate({
        glossaryId: TEST_GLOSSARY_ID,
        name: 'First Category',
        usedynalink: false,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Create second category
    await act(async () => {
      result.current.reset();
    });

    await act(async () => {
      result.current.mutate({
        glossaryId: TEST_GLOSSARY_ID,
        name: 'Second Category',
        usedynalink: true,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.name).toBe('Second Category');
  });

  it('should handle updating multiple categories', async () => {
    const existingCategories = [
      createMockCategory({ id: 400, name: 'Category A' }),
      createMockCategory({ id: 401, name: 'Category B' }),
    ];

    queryClient.setQueryData(
      categoryQueryKeys.list(TEST_GLOSSARY_ID),
      existingCategories
    );

    server.use(
      http.put(`${API_BASE_URL}/glossary/categories/:categoryId`, async ({ request, params }) => {
        const body = await request.json() as { name: string; usedynalink: number };
        const categoryId = Number(params.categoryId);
        return HttpResponse.json({
          success: true,
          data: createMockCategory({
            id: categoryId,
            name: body.name,
            // API sends 1/0, convert back to boolean for response
            usedynalink: Boolean(body.usedynalink),
          }),
        });
      })
    );

    const { result } = renderHook(
      () => useUpdateCategory(),
      { wrapper: createWrapper(queryClient) }
    );

    // Update first category
    await act(async () => {
      result.current.mutate({
        categoryId: 400,
        name: 'Updated A',
        usedynalink: false,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Reset and update second category
    await act(async () => {
      result.current.reset();
    });

    await act(async () => {
      result.current.mutate({
        categoryId: 401,
        name: 'Updated B',
        usedynalink: true,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.name).toBe('Updated B');
    expect(result.current.data?.usedynalink).toBe(true);
  });
});

// ============================================================================
// Test Suite: Error Message Structure
// ============================================================================

describe('Error Message Structure Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  it('should return proper error structure for validation errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    server.use(
      http.post(`${API_BASE_URL}/glossary/:glossaryId/categories`, async () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Category name contains invalid characters',
              details: {
                field: 'name',
                constraint: 'alphanumeric_only',
              },
            },
          },
          { status: 400 }
        );
      })
    );

    const { result } = renderHook(
      () => useCreateCategory(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      result.current.mutate({
        glossaryId: TEST_GLOSSARY_ID,
        name: 'Invalid<>Name',
        usedynalink: false,
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error).toBeInstanceOf(Error);

    consoleSpy.mockRestore();
  });

  it('should return proper error structure for server errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    server.use(
      http.get(`${API_BASE_URL}/glossary/:glossaryId/categories`, () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'SERVER_ERROR',
              message: 'Database connection failed',
            },
          },
          { status: 500 }
        );
      })
    );

    const { result } = renderHook(
      () => useCategories(TEST_GLOSSARY_ID),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();

    consoleSpy.mockRestore();
  });
});

// ============================================================================
// Test Suite: Query Key Verification
// ============================================================================

describe('Query Key Verification', () => {
  it('should generate correct list query key', () => {
    const key = categoryQueryKeys.list(42);
    expect(key).toEqual(['glossary', 42, 'categories']);
  });

  it('should generate correct detail query key', () => {
    const key = categoryQueryKeys.detail(42, 5);
    expect(key).toEqual(['glossary', 42, 'categories', 5]);
  });

  it('should generate correct all query key', () => {
    expect(categoryQueryKeys.all).toEqual(['glossary']);
  });
});
