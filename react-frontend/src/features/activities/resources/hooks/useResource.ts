/**
 * Custom React hooks for resource activity module state management using React Query.
 *
 * Provides hooks for fetching resource data (files, pages, URLs, folders) with automatic
 * caching, refetching, error handling, and optimistic updates for download tracking
 * and view counting.
 *
 * @module features/activities/resources/hooks/useResource
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';

/**
 * TypeScript interfaces for resource data structures
 */

interface BaseResource {
  id: number;
  coursemodule: number;
  course: number;
  name: string;
  intro: string;
  introformat: number;
  timemodified: number;
  viewcount?: number;
  downloadcount?: number;
}

interface ResourceFile extends BaseResource {
  type: 'resource';
  files: Array<{
    filename: string;
    filepath: string;
    filesize: number;
    mimetype: string;
    timemodified: number;
    url: string;
  }>;
  display: number;
  displayoptions: string;
  filterfiles: number;
  revision: number;
  tobemigrated?: number;
  legacyfiles?: number;
  legacyfileslast?: number;
}

interface ResourcePage extends BaseResource {
  type: 'page';
  content: string;
  contentformat: number;
  legacyfiles: number;
  legacyfileslast: number;
  display: number;
  displayoptions: string;
}

interface ResourceUrl extends BaseResource {
  type: 'url';
  externalurl: string;
  display: number;
  displayoptions: string;
  parameters: string;
}

export interface FolderNode {
  id: string;
  name: string;
  isFolder: boolean;
  isRoot?: boolean;
  children?: FolderNode[];
  file?: {
    filename: string;
    filepath: string;
    filesize: number;
    mimetype: string;
    timemodified: number;
    url: string;
  };
  path: string;
  parentPath?: string;
}

interface ResourceFolder extends BaseResource {
  type: 'folder';
  files: Array<{
    filename: string;
    filepath: string;
    filesize: number;
    mimetype: string;
    timemodified: number;
    url: string;
  }>;
  revision: number;
  display: number;
  showexpanded: number;
  showdownloadfolder: number;
  tree: FolderNode;
  canManageFiles: boolean;
  canDownload: boolean;
  archiveUrl?: string;
  editUrl?: string;
}

type Resource = ResourceFile | ResourcePage | ResourceUrl | ResourceFolder;

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

interface TrackingResponse {
  success: boolean;
  viewcount?: number;
  downloadcount?: number;
}

/**
 * Query keys factory for resource queries.
 * Provides consistent cache key structure for React Query.
 */
const resourceKeys = {
  all: ['resources'] as const,
  lists: () => [...resourceKeys.all, 'list'] as const,
  list: (filters: string) => [...resourceKeys.lists(), { filters }] as const,
  details: () => [...resourceKeys.all, 'detail'] as const,
  detail: (id: number) => [...resourceKeys.details(), id] as const,
  files: (id: number) => [...resourceKeys.all, 'files', id] as const,
  page: (id: number) => [...resourceKeys.all, 'page', id] as const,
  url: (id: number) => [...resourceKeys.all, 'url', id] as const,
  folder: (id: number) => [...resourceKeys.all, 'folder', id] as const,
};

/**
 * Hook for fetching individual resource data by ID.
 *
 * Calls GET /api/v1/resources/{id} which wraps existing Moodle resource functions.
 * Implements automatic caching with 5-minute stale time.
 *
 * @param id - The resource ID to fetch (optional - query is disabled if undefined)
 * @returns React Query result with resource data, loading state, error state, and refetch function
 *
 * @example
 * ```tsx
 * const { data, isLoading, isError, error, refetch } = useResource(resourceId);
 * if (isLoading) return <LoadingSpinner />;
 * if (isError) return <ErrorMessage error={error} />;
 * return <ResourceDisplay resource={data} />;
 * ```
 */
export function useResource(id?: number): UseQueryResult<Resource, Error> {
  return useQuery<Resource, Error>({
    queryKey: resourceKeys.detail(id ?? 0),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Resource>>(`/api/v1/resources/${id}`);
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: true,
    enabled: !!id && id > 0,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for fetching files associated with a resource (mod_resource).
 *
 * Calls GET /api/v1/resources/{id}/files which wraps existing Moodle file functions.
 * Returns file metadata including URLs, sizes, and MIME types.
 *
 * @param id - The resource ID to fetch files for (optional - query is disabled if undefined)
 * @returns React Query result with resource file data
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useResourceFiles(resourceId);
 * return data?.files.map(file => <FileCard key={file.filename} file={file} />);
 * ```
 */
export function useResourceFiles(id?: number): UseQueryResult<ResourceFile, Error> {
  return useQuery<ResourceFile, Error>({
    queryKey: resourceKeys.files(id ?? 0),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ResourceFile>>(
        `/api/v1/resources/${id}/files`
      );
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    enabled: !!id && id > 0,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for fetching page content (mod_page).
 *
 * Calls GET /api/v1/resources/pages/{id} which wraps existing Moodle page functions.
 * Returns page content with HTML formatting and metadata.
 *
 * @param id - The page resource ID to fetch (optional - query is disabled if undefined)
 * @returns React Query result with page resource data
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useResourcePage(pageId);
 * return <div dangerouslySetInnerHTML={{ __html: data?.content }} />;
 * ```
 */
export function useResourcePage(id?: number): UseQueryResult<ResourcePage, Error> {
  return useQuery<ResourcePage, Error>({
    queryKey: resourceKeys.page(id ?? 0),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ResourcePage>>(
        `/api/v1/resources/pages/${id}`
      );
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    enabled: !!id && id > 0,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for fetching URL data (mod_url).
 *
 * Calls GET /api/v1/resources/urls/{id} which wraps existing Moodle URL functions.
 * Returns URL resource data including external URL and display options.
 *
 * @param id - The URL resource ID to fetch (optional - query is disabled if undefined)
 * @returns React Query result with URL resource data
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useResourceUrl(urlId);
 * return <ExternalLink href={data?.externalurl} target="_blank" />;
 * ```
 */
export function useResourceUrl(id?: number): UseQueryResult<ResourceUrl, Error> {
  return useQuery<ResourceUrl, Error>({
    queryKey: resourceKeys.url(id ?? 0),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ResourceUrl>>(
        `/api/v1/resources/urls/${id}`
      );
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    enabled: !!id && id > 0,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for fetching folder contents (mod_folder).
 *
 * Calls GET /api/v1/resources/folders/{id} which wraps existing Moodle folder functions.
 * Returns folder resource data including file list and display options.
 *
 * @param id - The folder resource ID to fetch (optional - query is disabled if undefined)
 * @returns React Query result with folder resource data
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useResourceFolder(folderId);
 * return <FolderBrowser files={data?.files} expanded={data?.showexpanded} />;
 * ```
 */
export function useResourceFolder(id?: number): UseQueryResult<ResourceFolder, Error> {
  return useQuery<ResourceFolder, Error>({
    queryKey: resourceKeys.folder(id ?? 0),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ResourceFolder>>(
        `/api/v1/resources/folders/${id}`
      );
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    enabled: !!id && id > 0,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Mutation hook for tracking resource views.
 *
 * Calls POST /api/v1/resources/{id}/view which wraps existing Moodle view tracking functions.
 * Implements optimistic updates by invalidating the resource cache after successful tracking.
 *
 * @returns React Query mutation result for tracking views
 *
 * @example
 * ```tsx
 * const trackView = useTrackResourceView();
 *
 * useEffect(() => {
 *   trackView.mutate(resourceId);
 * }, [resourceId]);
 * ```
 */
export function useTrackResourceView(): UseMutationResult<
  TrackingResponse,
  Error,
  number,
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation<TrackingResponse, Error, number>({
    mutationFn: async (resourceId: number) => {
      const response = await apiClient.post<ApiResponse<TrackingResponse>>(
        `/api/v1/resources/${resourceId}/view`
      );
      return response.data.data;
    },
    onSuccess: (data, resourceId) => {
      // Invalidate resource cache to refetch updated view count
      void queryClient.invalidateQueries({ queryKey: resourceKeys.detail(resourceId) });

      // Optionally update cache optimistically without refetching
      queryClient.setQueryData<Resource>(resourceKeys.detail(resourceId), (oldData) => {
        if (oldData && data.viewcount !== undefined) {
          return {
            ...oldData,
            viewcount: data.viewcount,
          };
        }
        return oldData;
      });
    },
    retry: false,
  });
}

/**
 * Mutation hook for tracking resource downloads.
 *
 * Calls POST /api/v1/resources/{id}/download which wraps existing Moodle download tracking functions.
 * Implements optimistic updates by invalidating the resource cache after successful tracking.
 *
 * @returns React Query mutation result for tracking downloads
 *
 * @example
 * ```tsx
 * const trackDownload = useTrackResourceDownload();
 *
 * const handleDownload = (resourceId: number) => {
 *   trackDownload.mutate(resourceId, {
 *     onSuccess: () => {
 *       // Download tracking successful
 *       window.open(downloadUrl, '_blank');
 *     }
 *   });
 * };
 * ```
 */
export function useTrackResourceDownload(): UseMutationResult<
  TrackingResponse,
  Error,
  number,
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation<TrackingResponse, Error, number>({
    mutationFn: async (resourceId: number) => {
      const response = await apiClient.post<ApiResponse<TrackingResponse>>(
        `/api/v1/resources/${resourceId}/download`
      );
      return response.data.data;
    },
    onSuccess: (data, resourceId) => {
      // Invalidate resource cache to refetch updated download count
      void queryClient.invalidateQueries({ queryKey: resourceKeys.detail(resourceId) });
      void queryClient.invalidateQueries({ queryKey: resourceKeys.files(resourceId) });

      // Optionally update cache optimistically without refetching
      queryClient.setQueryData<Resource>(resourceKeys.detail(resourceId), (oldData) => {
        if (oldData && data.downloadcount !== undefined) {
          return {
            ...oldData,
            downloadcount: data.downloadcount,
          };
        }
        return oldData;
      });
    },
    retry: false,
  });
}

/**
 * Export query keys for external cache management if needed
 */
export { resourceKeys };
