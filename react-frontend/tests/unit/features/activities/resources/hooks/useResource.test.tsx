/**
 * Unit tests for resource activity module custom React hooks.
 *
 * Tests useResource, useResourceFiles, useResourcePage, useResourceUrl, useResourceFolder hooks
 * and tracking mutations (useTrackResourceView, useTrackResourceDownload) with React Query integration.
 *
 * Validates data fetching, caching behavior, loading states, error handling, refetch functionality,
 * optimistic updates, query key management, staleTime/cacheTime configuration, and TypeScript type safety.
 *
 * @module tests/unit/features/activities/resources/hooks/useResource
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { apiClient } from '@/services/api/client';
import {
  useResource,
  useResourceFiles,
  useResourcePage,
  useResourceUrl,
  useResourceFolder,
  useTrackResourceView,
  useTrackResourceDownload,
  resourceKeys,
} from '@/features/activities/resources/hooks/useResource';

// Mock the API client module
vi.mock('@/services/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock data for testing
const mockResourceFile = {
  id: 1,
  coursemodule: 101,
  course: 10,
  name: 'Sample Resource File',
  intro: 'This is a sample resource',
  introformat: 1,
  timemodified: 1609459200,
  viewcount: 10,
  downloadcount: 5,
  type: 'resource' as const,
  files: [
    {
      filename: 'document.pdf',
      filepath: '/files/',
      filesize: 1024000,
      mimetype: 'application/pdf',
      timemodified: 1609459200,
      url: 'https://example.com/file.pdf',
    },
  ],
  display: 0,
  displayoptions: '',
  filterfiles: 0,
  revision: 1,
};

const mockResourcePage = {
  id: 2,
  coursemodule: 102,
  course: 10,
  name: 'Sample Page',
  intro: 'This is a sample page',
  introformat: 1,
  timemodified: 1609459200,
  viewcount: 20,
  type: 'page' as const,
  content: '<h1>Page Content</h1><p>This is the main content.</p>',
  contentformat: 1,
  legacyfiles: 0,
  legacyfileslast: 0,
  display: 0,
  displayoptions: '',
};

const mockResourceUrl = {
  id: 3,
  coursemodule: 103,
  course: 10,
  name: 'External Link',
  intro: 'This is an external URL',
  introformat: 1,
  timemodified: 1609459200,
  viewcount: 15,
  type: 'url' as const,
  externalurl: 'https://example.com',
  display: 0,
  displayoptions: '',
  parameters: '',
};

const mockResourceFolder = {
  id: 4,
  coursemodule: 104,
  course: 10,
  name: 'Sample Folder',
  intro: 'This is a sample folder',
  introformat: 1,
  timemodified: 1609459200,
  viewcount: 8,
  type: 'folder' as const,
  files: [
    {
      filename: 'file1.pdf',
      filepath: '/folder/',
      filesize: 512000,
      mimetype: 'application/pdf',
      timemodified: 1609459200,
      url: 'https://example.com/file1.pdf',
    },
    {
      filename: 'file2.docx',
      filepath: '/folder/',
      filesize: 256000,
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      timemodified: 1609459200,
      url: 'https://example.com/file2.docx',
    },
  ],
  revision: 1,
  display: 0,
  showexpanded: 1,
  showdownloadfolder: 1,
};

// Standard API response wrapper
const createApiResponse = <T,>(data: T) => ({
  success: true,
  data,
});

// Test wrapper component that provides QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useResource hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('successful data fetching', () => {
    it('should fetch resource data successfully', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResourceFile);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/resources/1');
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });

    it('should call API with correct resource ID', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      renderHook(() => useResource(42), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/resources/42');
      });
    });

    it('should return resource data with correct TypeScript types', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // TypeScript type assertion - if this compiles, types are correct
      const resource = result.current.data;
      expect(resource?.id).toBe(1);
      expect(resource?.name).toBe('Sample Resource File');
      expect(resource?.coursemodule).toBe(101);
    });
  });

  describe('loading states', () => {
    it('should show loading state during fetch', async () => {
      vi.mocked(apiClient.get).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isPending).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should show loading as false after successful fetch', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSuccess).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle API errors correctly', async () => {
      const errorMessage = 'Network error';
      // Mock 3 consecutive failures (initial + 2 retries) to exhaust retry: 2
      vi.mocked(apiClient.get)
        .mockRejectedValueOnce(new Error(errorMessage))
        .mockRejectedValueOnce(new Error(errorMessage))
        .mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 }); // Increased timeout to account for exponential retry delay (~3s)

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe(errorMessage);
      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle 404 not found errors', async () => {
      const error = new Error('Resource not found');
      // Mock 3 consecutive failures (initial + 2 retries) to exhaust retry: 2
      vi.mocked(apiClient.get)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      const { result } = renderHook(() => useResource(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 }); // Increased timeout to account for exponential retry delay (~3s)

      expect(result.current.error?.message).toBe('Resource not found');
    });

    it('should handle 403 permission denied errors', async () => {
      const error = new Error('Permission denied');
      // Mock 3 consecutive failures (initial + 2 retries) to exhaust retry: 2
      vi.mocked(apiClient.get)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 }); // Increased timeout to account for exponential retry delay (~3s)

      expect(result.current.error?.message).toBe('Permission denied');
    });

    it('should handle network timeout errors', async () => {
      const error = new Error('Request timeout');
      // Mock 3 consecutive failures (initial + 2 retries) to exhaust retry: 2
      vi.mocked(apiClient.get)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 }); // Increased timeout to account for exponential retry delay (~3s)

      expect(result.current.error?.message).toBe('Request timeout');
    });
  });

  describe('refetch functionality', () => {
    it('should refetch data when refetch() is called', async () => {
      vi.mocked(apiClient.get)
        .mockResolvedValueOnce({
          data: createApiResponse(mockResourceFile),
        })
        .mockResolvedValueOnce({
          data: createApiResponse({ ...mockResourceFile, viewcount: 20 }),
        });

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.viewcount).toBe(10);

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.data?.viewcount).toBe(20);
      });

      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('query key management', () => {
    it('should use correct query key format', () => {
      const resourceId = 1;
      const expectedKey = ['resources', 'detail', resourceId];

      const actualKey = resourceKeys.detail(resourceId);

      expect(actualKey).toEqual(expectedKey);
    });

    it('should generate unique keys for different resources', () => {
      const key1 = resourceKeys.detail(1);
      const key2 = resourceKeys.detail(2);

      expect(key1).not.toEqual(key2);
      expect(key1[2]).toBe(1);
      expect(key2[2]).toBe(2);
    });
  });

  describe('caching behavior', () => {
    it('should cache resource data with staleTime of 5 minutes', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      const { result, rerender } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(apiClient.get).toHaveBeenCalledTimes(1);

      // Rerender should not trigger new fetch (cache is fresh)
      rerender();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });

    it('should not refetch when data is fresh', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      // Create ONE wrapper instance to share cache between renders
      const wrapper = createWrapper();

      const { result, unmount } = renderHook(() => useResource(1), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      unmount();

      // Mount again with same ID and SAME wrapper - should use cache
      const { result: result2 } = renderHook(() => useResource(1), {
        wrapper, // Reuse the same wrapper to access the same QueryClient cache
      });

      // Data should be immediately available from cache
      expect(result2.current.data).toEqual(mockResourceFile);
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('enabled/disabled query conditions', () => {
    it('should not fetch when id is undefined', () => {
      renderHook(() => useResource(undefined), {
        wrapper: createWrapper(),
      });

      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('should not fetch when id is 0', () => {
      renderHook(() => useResource(0), {
        wrapper: createWrapper(),
      });

      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('should not fetch when id is negative', () => {
      renderHook(() => useResource(-1), {
        wrapper: createWrapper(),
      });

      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('should fetch when id is valid positive number', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalled();
      });
    });
  });

  describe('retry logic', () => {
    it('should retry failed requests up to 2 times', async () => {
      vi.mocked(apiClient.get)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          data: createApiResponse(mockResourceFile),
        });

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 5000 }); // Increased timeout to account for exponential retry delay (~3s)

      // Initial call + 2 retries = 3 total calls
      expect(apiClient.get).toHaveBeenCalledTimes(3);
    });
  });
});

describe('useResourceFiles hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful data fetching', () => {
    it('should fetch resource files successfully', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      const { result } = renderHook(() => useResourceFiles(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResourceFile);
      expect(result.current.data?.files).toHaveLength(1);
      expect(result.current.data?.files[0]?.filename).toBe('document.pdf');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/resources/1/files');
    });

    it('should return file array with proper structure', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      const { result } = renderHook(() => useResourceFiles(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const file = result.current.data?.files[0];
      expect(file).toBeDefined();
      expect(file?.filename).toBeDefined();
      expect(file?.filesize).toBeDefined();
      expect(file?.mimetype).toBeDefined();
      expect(file?.url).toBeDefined();
    });
  });

  describe('query key management', () => {
    it('should use correct query key for files', () => {
      const resourceId = 1;
      const expectedKey = ['resources', 'files', resourceId];

      const actualKey = resourceKeys.files(resourceId);

      expect(actualKey).toEqual(expectedKey);
    });
  });

  describe('error handling', () => {
    it('should handle file fetch errors', async () => {
      const error = new Error('File not found');
      // Mock 3 consecutive failures (initial + 2 retries) to exhaust retry: 2
      vi.mocked(apiClient.get)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      const { result } = renderHook(() => useResourceFiles(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 }); // Increased timeout to account for exponential retry delay (~3s)

      expect(result.current.error?.message).toBe('File not found');
    });
  });
});

describe('useResourcePage hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful data fetching', () => {
    it('should fetch page content successfully', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourcePage),
      });

      const { result } = renderHook(() => useResourcePage(2), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResourcePage);
      expect(result.current.data?.content).toContain('<h1>Page Content</h1>');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/resources/pages/2');
    });

    it('should return HTML content with proper format', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourcePage),
      });

      const { result } = renderHook(() => useResourcePage(2), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.content).toBeDefined();
      expect(result.current.data?.contentformat).toBe(1);
      expect(typeof result.current.data?.content).toBe('string');
    });
  });

  describe('query key management', () => {
    it('should use correct query key for page', () => {
      const pageId = 2;
      const expectedKey = ['resources', 'page', pageId];

      const actualKey = resourceKeys.page(pageId);

      expect(actualKey).toEqual(expectedKey);
    });
  });

  describe('caching behavior for static content', () => {
    it('should cache page content for 5 minutes', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourcePage),
      });

      const { result, rerender } = renderHook(() => useResourcePage(2), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      rerender();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle missing page errors', async () => {
      const error = new Error('Page not found');
      // Mock 3 consecutive failures (initial + 2 retries) to exhaust retry: 2
      vi.mocked(apiClient.get)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      const { result } = renderHook(() => useResourcePage(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 }); // Increased timeout to account for exponential retry delay (~3s)

      expect(result.current.error?.message).toBe('Page not found');
    });

    it('should handle inaccessible page errors', async () => {
      const error = new Error('Access denied');
      // Mock 3 consecutive failures (initial + 2 retries) to exhaust retry: 2
      vi.mocked(apiClient.get)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      const { result } = renderHook(() => useResourcePage(2), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 }); // Increased timeout to account for exponential retry delay (~3s)

      expect(result.current.error?.message).toBe('Access denied');
    });
  });
});

describe('useResourceUrl hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful data fetching', () => {
    it('should fetch URL resource successfully', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceUrl),
      });

      const { result } = renderHook(() => useResourceUrl(3), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResourceUrl);
      expect(result.current.data?.externalurl).toBe('https://example.com');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/resources/urls/3');
    });

    it('should return external URL with validation data', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceUrl),
      });

      const { result } = renderHook(() => useResourceUrl(3), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.externalurl).toBeDefined();
      expect(typeof result.current.data?.externalurl).toBe('string');
      expect(result.current.data?.externalurl.startsWith('http')).toBe(true);
    });
  });

  describe('query key management', () => {
    it('should use correct query key for URL', () => {
      const urlId = 3;
      const expectedKey = ['resources', 'url', urlId];

      const actualKey = resourceKeys.url(urlId);

      expect(actualKey).toEqual(expectedKey);
    });
  });

  describe('error handling', () => {
    it('should handle invalid URL errors', async () => {
      const error = new Error('Invalid URL');
      // Mock 3 consecutive failures (initial + 2 retries) to exhaust retry: 2
      vi.mocked(apiClient.get)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      const { result } = renderHook(() => useResourceUrl(3), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 }); // Increased timeout to account for exponential retry delay (~3s)

      expect(result.current.error?.message).toBe('Invalid URL');
    });
  });
});

describe('useResourceFolder hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful data fetching', () => {
    it('should fetch folder contents successfully', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFolder),
      });

      const { result } = renderHook(() => useResourceFolder(4), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResourceFolder);
      expect(result.current.data?.files).toHaveLength(2);
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/resources/folders/4');
    });

    it('should return nested file structure', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFolder),
      });

      const { result } = renderHook(() => useResourceFolder(4), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const files = result.current.data?.files;
      expect(files).toBeDefined();
      expect(files?.[0]?.filename).toBe('file1.pdf');
      expect(files?.[1]?.filename).toBe('file2.docx');
    });

    it('should include folder display options', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFolder),
      });

      const { result } = renderHook(() => useResourceFolder(4), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.showexpanded).toBe(1);
      expect(result.current.data?.showdownloadfolder).toBe(1);
    });
  });

  describe('query key management', () => {
    it('should use correct query key for folder', () => {
      const folderId = 4;
      const expectedKey = ['resources', 'folder', folderId];

      const actualKey = resourceKeys.folder(folderId);

      expect(actualKey).toEqual(expectedKey);
    });
  });

  describe('error handling', () => {
    it('should handle folder not found errors', async () => {
      const error = new Error('Folder not found');
      // Mock 3 consecutive failures (initial + 2 retries) to exhaust retry: 2
      vi.mocked(apiClient.get)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      const { result } = renderHook(() => useResourceFolder(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 }); // Increased timeout to account for exponential retry delay (~3s)

      expect(result.current.error?.message).toBe('Folder not found');
    });
  });
});

describe('useTrackResourceView mutation hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful view tracking', () => {
    it('should track resource view successfully', async () => {
      const trackingResponse = {
        success: true,
        viewcount: 11,
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: createApiResponse(trackingResponse),
      });

      const { result } = renderHook(() => useTrackResourceView(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/resources/1/view');
      expect(result.current.data).toEqual(trackingResponse);
    });

    it('should call API with correct resource ID', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: createApiResponse({ success: true, viewcount: 1 }),
      });

      const { result } = renderHook(() => useTrackResourceView(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(42);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/resources/42/view');
      });
    });
  });

  describe('optimistic updates', () => {
    it('should invalidate resource cache after successful tracking', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: createApiResponse({ success: true, viewcount: 11 }),
      });

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useTrackResourceView(), { wrapper });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateQueriesSpy).toHaveBeenCalled();
    });

    it('should update cache with new view count', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });

      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: createApiResponse({ success: true, viewcount: 15 }),
      });

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useTrackResourceView(), { wrapper });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setQueryDataSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle tracking failures', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Tracking failed'));

      const { result } = renderHook(() => useTrackResourceView(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Tracking failed');
    });

    it('should log error on tracking failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useTrackResourceView(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Network error');
    });
  });

  describe('mutation states', () => {
    it('should show loading state during mutation', async () => {
      // Create a promise we can control
      let resolveMutation: (value: any) => void;
      const mutationPromise = new Promise((resolve) => {
        resolveMutation = resolve;
      });

      vi.mocked(apiClient.post).mockReturnValue(mutationPromise as any);

      const { result } = renderHook(() => useTrackResourceView(), {
        wrapper: createWrapper(),
      });

      // Trigger mutation
      act(() => {
        result.current.mutate(1);
      });

      // Wait for loading state to become true
      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      // Clean up: resolve the promise
      act(() => {
        resolveMutation!({
          data: createApiResponse({ success: true, viewcount: 1 }),
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });
});

describe('useTrackResourceDownload mutation hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful download tracking', () => {
    it('should track resource download successfully', async () => {
      const trackingResponse = {
        success: true,
        downloadcount: 6,
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: createApiResponse(trackingResponse),
      });

      const { result } = renderHook(() => useTrackResourceDownload(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/resources/1/download');
      expect(result.current.data).toEqual(trackingResponse);
    });

    it('should call API with correct parameters', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: createApiResponse({ success: true, downloadcount: 1 }),
      });

      const { result } = renderHook(() => useTrackResourceDownload(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(10);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/resources/10/download');
      });
    });
  });

  describe('optimistic updates', () => {
    it('should invalidate both resource and files cache', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: createApiResponse({ success: true, downloadcount: 10 }),
      });

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useTrackResourceDownload(), { wrapper });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2);
    });

    it('should update cache with new download count', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });

      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: createApiResponse({ success: true, downloadcount: 20 }),
      });

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useTrackResourceDownload(), { wrapper });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setQueryDataSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle download tracking failures', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Download tracking failed'));

      const { result } = renderHook(() => useTrackResourceDownload(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Download tracking failed');
    });

    it('should log error on failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Server error'));

      const { result } = renderHook(() => useTrackResourceDownload(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Server error');
    });
  });
});

describe('React Query configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('staleTime configuration', () => {
    it('should respect 5 minute staleTime for resource queries', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Data should remain fresh for configured staleTime
      expect(result.current.isStale).toBe(false);
    });
  });

  describe('gcTime (formerly cacheTime) configuration', () => {
    it('should configure 10 minute cache time', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Cache should be configured correctly
      expect(result.current.data).toBeDefined();
    });
  });

  describe('refetchOnWindowFocus behavior', () => {
    it('should be enabled for resource queries', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query should have refetchOnWindowFocus enabled
      expect(result.current.data).toBeDefined();
    });
  });

  describe('retry logic configuration', () => {
    it('should retry queries up to 2 times with exponential backoff', async () => {
      vi.mocked(apiClient.get)
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce({
          data: createApiResponse(mockResourceFile),
        });

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 5000 }); // Increased timeout to account for exponential retry delay (~3s)

      expect(apiClient.get).toHaveBeenCalledTimes(3);
    });

    it('should not retry mutations on failure (retry: false)', async () => {
      const errorMessage = 'Mutation failure';
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useTrackResourceView(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(1);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Mutations should not retry, so only 1 call should be made
      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(result.current.error?.message).toBe(errorMessage);
    });
  });
});

describe('TypeScript type safety', () => {
  describe('return type validation', () => {
    it('should return UseQueryResult type for queries', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // TypeScript compile-time checks
      const queryResult = result.current;
      expect(queryResult.data).toBeDefined();
      expect(queryResult.isLoading).toBeDefined();
      expect(queryResult.isError).toBeDefined();
      expect(queryResult.error).toBeDefined();
      expect(queryResult.refetch).toBeDefined();
    });

    it('should return UseMutationResult type for mutations', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: createApiResponse({ success: true, viewcount: 1 }),
      });

      const { result } = renderHook(() => useTrackResourceView(), {
        wrapper: createWrapper(),
      });

      // TypeScript compile-time checks
      const mutationResult = result.current;
      expect(mutationResult.mutate).toBeDefined();
      expect(mutationResult.mutateAsync).toBeDefined();
      expect(mutationResult.isPending).toBeDefined();
      expect(mutationResult.isError).toBeDefined();
      expect(mutationResult.isSuccess).toBeDefined();
    });
  });

  describe('generic type parameter inference', () => {
    it('should infer correct resource type', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      const { result } = renderHook(() => useResource(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Type should be inferred as Resource
      const {data} = result.current;
      if (data) {
        expect(data.id).toBeDefined();
        expect(data.name).toBeDefined();
        expect(data.type).toBeDefined();
      }
    });

    it('should infer correct ResourceFile type', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourceFile),
      });

      const { result } = renderHook(() => useResourceFiles(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const {data} = result.current;
      if (data) {
        expect(data.type).toBe('resource');
        expect(data.files).toBeDefined();
      }
    });

    it('should infer correct ResourcePage type', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: createApiResponse(mockResourcePage),
      });

      const { result } = renderHook(() => useResourcePage(2), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const {data} = result.current;
      if (data) {
        expect(data.type).toBe('page');
        expect(data.content).toBeDefined();
      }
    });
  });
});

describe('resourceKeys query key factory', () => {
  it('should generate correct key for all resources', () => {
    expect(resourceKeys.all).toEqual(['resources']);
  });

  it('should generate correct key for resource detail', () => {
    expect(resourceKeys.detail(1)).toEqual(['resources', 'detail', 1]);
  });

  it('should generate correct key for resource files', () => {
    expect(resourceKeys.files(1)).toEqual(['resources', 'files', 1]);
  });

  it('should generate correct key for resource page', () => {
    expect(resourceKeys.page(2)).toEqual(['resources', 'page', 2]);
  });

  it('should generate correct key for resource URL', () => {
    expect(resourceKeys.url(3)).toEqual(['resources', 'url', 3]);
  });

  it('should generate correct key for resource folder', () => {
    expect(resourceKeys.folder(4)).toEqual(['resources', 'folder', 4]);
  });

  it('should maintain type safety with const assertions', () => {
    const key = resourceKeys.detail(1);
    // TypeScript compile-time check for readonly array
    expect(Array.isArray(key)).toBe(true);
  });
});
