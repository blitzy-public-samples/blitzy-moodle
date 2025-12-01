/**
 * Glossary Category Management Hooks
 *
 * React Query hooks for managing glossary categories including fetching,
 * creating, updating, and deleting categories with automatic cache updates.
 *
 * Categories are used to organize glossary entries into logical groups.
 * Each category can have the auto-link feature enabled, which automatically
 * links category names when they appear in entries.
 *
 * Features:
 * - Fetch all categories for a glossary sorted by name
 * - Create new categories with name and auto-link configuration
 * - Update existing categories with optimistic updates
 * - Delete categories with cascade handling for assigned entries
 * - Automatic cache invalidation after mutations
 * - Error handling for constraint violations
 *
 * Usage:
 * ```typescript
 * import {
 *   useCategories,
 *   useCreateCategory,
 *   useUpdateCategory,
 *   useDeleteCategory
 * } from './useCategories';
 *
 * // Fetch categories
 * const { data: categories, isLoading } = useCategories(glossaryId);
 *
 * // Create category
 * const createMutation = useCreateCategory({
 *   onSuccess: () => console.log('Category created')
 * });
 * createMutation.mutate({ glossaryId, name: 'New Category', usedynalink: true });
 *
 * // Update category
 * const updateMutation = useUpdateCategory({
 *   onSuccess: () => console.log('Category updated')
 * });
 * updateMutation.mutate({ categoryId: 5, name: 'Updated Name', usedynalink: false });
 *
 * // Delete category
 * const deleteMutation = useDeleteCategory({
 *   onSuccess: () => console.log('Category deleted')
 * });
 * deleteMutation.mutate({ categoryId: 5, glossaryId });
 * ```
 *
 * @module features/activities/glossary/hooks/useCategories
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/features/activities/glossary/api/glossaryApi';

import type {
  GlossaryCategory,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@/features/activities/glossary/types/glossary.types';

import type { Id } from '@/types/common';

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query key factory for glossary category queries
 * Follows the pattern ['glossary', glossaryId, 'categories'] for cache management
 */
export const categoryQueryKeys = {
  /**
   * Base key for all category queries
   */
  all: ['glossary'] as const,

  /**
   * Key for categories list of a specific glossary
   * @param glossaryId - The glossary ID
   */
  list: (glossaryId: Id) => ['glossary', glossaryId, 'categories'] as const,

  /**
   * Key for a single category
   * @param glossaryId - The glossary ID
   * @param categoryId - The category ID
   */
  detail: (glossaryId: Id, categoryId: Id) =>
    ['glossary', glossaryId, 'categories', categoryId] as const,
};

// ============================================================================
// Types for Hook Options
// ============================================================================

/**
 * Options for the useCategories hook
 */
export interface UseCategoriesOptions
  extends Omit<
    UseQueryOptions<GlossaryCategory[], Error, GlossaryCategory[], readonly ['glossary', Id, 'categories']>,
    'queryKey' | 'queryFn'
  > {
  /**
   * Whether to enable the query
   * @default true
   */
  enabled?: boolean;
}

/**
 * Options for the useCreateCategory mutation hook
 */
export interface UseCreateCategoryOptions
  extends Omit<
    UseMutationOptions<GlossaryCategory, Error, CreateCategoryInput, CreateCategoryContext>,
    'mutationFn'
  > {}

/**
 * Options for the useUpdateCategory mutation hook
 */
export interface UseUpdateCategoryOptions
  extends Omit<
    UseMutationOptions<GlossaryCategory, Error, UpdateCategoryInput, UpdateCategoryContext>,
    'mutationFn'
  > {}

/**
 * Input for delete category mutation
 */
export interface DeleteCategoryInput {
  /** The category ID to delete */
  categoryId: Id;
  /** The glossary ID (required for cache invalidation) */
  glossaryId: Id;
}

/**
 * Options for the useDeleteCategory mutation hook
 */
export interface UseDeleteCategoryOptions
  extends Omit<
    UseMutationOptions<boolean, Error, DeleteCategoryInput, DeleteCategoryContext>,
    'mutationFn'
  > {}

// ============================================================================
// Context Types for Optimistic Updates
// ============================================================================

/**
 * Context stored during create category optimistic update
 */
interface CreateCategoryContext {
  /** Previous categories list for rollback */
  previousCategories?: GlossaryCategory[];
  /** Temporary ID assigned to the optimistic category */
  tempId: number;
}

/**
 * Context stored during update category optimistic update
 */
interface UpdateCategoryContext {
  /** Previous categories list for rollback */
  previousCategories?: GlossaryCategory[];
  /** The glossary ID for cache key lookup */
  glossaryId?: Id;
}

/**
 * Context stored during delete category mutation
 */
interface DeleteCategoryContext {
  /** Previous categories list for rollback */
  previousCategories?: GlossaryCategory[];
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching all categories for a glossary
 *
 * Returns a sorted list of categories with entry counts. Categories are
 * sorted alphabetically by name to provide consistent ordering.
 *
 * @param glossaryId - The unique identifier of the glossary
 * @param options - Additional React Query options
 * @returns Query result containing categories array, loading state, and error
 *
 * @example
 * ```typescript
 * function CategoryList({ glossaryId }: { glossaryId: number }) {
 *   const {
 *     data: categories,
 *     isLoading,
 *     error
 *   } = useCategories(glossaryId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <ul>
 *       {categories?.map(cat => (
 *         <li key={cat.id}>
 *           {cat.name} ({cat.entrycount} entries)
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useCategories(
  glossaryId: Id,
  options?: UseCategoriesOptions
): ReturnType<typeof useQuery<GlossaryCategory[], Error, GlossaryCategory[], readonly ['glossary', Id, 'categories']>> {
  return useQuery({
    queryKey: categoryQueryKeys.list(glossaryId),
    queryFn: async () => {
      const categories = await getCategories(glossaryId);
      // Sort categories by name alphabetically for consistent ordering
      return categories.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
    },
    // Cache categories for 5 minutes since they don't change frequently
    staleTime: 5 * 60 * 1000,
    // Keep data in cache for 30 minutes
    gcTime: 30 * 60 * 1000,
    // Only run query if glossaryId is provided
    enabled: glossaryId > 0 && (options?.enabled !== false),
    ...options,
  });
}

/**
 * Hook for creating a new glossary category
 *
 * Creates a new category with the specified name and auto-link configuration.
 * Implements optimistic updates for immediate UI feedback, with automatic
 * rollback on error.
 *
 * @param options - Mutation options including callbacks and configuration
 * @returns Mutation object with mutate function and state
 *
 * @example
 * ```typescript
 * function CreateCategoryForm({ glossaryId }: { glossaryId: number }) {
 *   const [name, setName] = useState('');
 *   const [useDynaLink, setUseDynaLink] = useState(false);
 *
 *   const createMutation = useCreateCategory({
 *     onSuccess: (newCategory) => {
 *       console.log('Created category:', newCategory.name);
 *       setName('');
 *     },
 *     onError: (error) => {
 *       if (error.message.includes('duplicate')) {
 *         alert('A category with this name already exists');
 *       }
 *     }
 *   });
 *
 *   const handleSubmit = (e: FormEvent) => {
 *     e.preventDefault();
 *     createMutation.mutate({
 *       glossaryId,
 *       name,
 *       usedynalink: useDynaLink
 *     });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input value={name} onChange={e => setName(e.target.value)} />
 *       <label>
 *         <input
 *           type="checkbox"
 *           checked={useDynaLink}
 *           onChange={e => setUseDynaLink(e.target.checked)}
 *         />
 *         Enable auto-linking
 *       </label>
 *       <button type="submit" disabled={createMutation.isPending}>
 *         {createMutation.isPending ? 'Creating...' : 'Create Category'}
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useCreateCategory(
  options?: UseCreateCategoryOptions
): ReturnType<typeof useMutation<GlossaryCategory, Error, CreateCategoryInput, CreateCategoryContext>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCategory,

    onMutate: async (newCategoryInput) => {
      // Cancel any outgoing refetches to avoid optimistic update conflicts
      await queryClient.cancelQueries({
        queryKey: categoryQueryKeys.list(newCategoryInput.glossaryId),
      });

      // Snapshot the previous value for rollback
      const previousCategories = queryClient.getQueryData<GlossaryCategory[]>(
        categoryQueryKeys.list(newCategoryInput.glossaryId)
      );

      // Generate a temporary ID for the optimistic update
      // Use a negative number to distinguish from real IDs
      const tempId = -Date.now();

      // Create optimistic category
      const optimisticCategory: GlossaryCategory = {
        id: tempId,
        glossaryid: newCategoryInput.glossaryId,
        name: newCategoryInput.name,
        usedynalink: newCategoryInput.usedynalink,
        entrycount: 0,
      };

      // Optimistically update the categories list
      if (previousCategories) {
        const updatedCategories = [...previousCategories, optimisticCategory].sort(
          (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );
        queryClient.setQueryData(
          categoryQueryKeys.list(newCategoryInput.glossaryId),
          updatedCategories
        );
      }

      // Return context with previous value for rollback
      return { previousCategories, tempId };
    },

    onError: (error, newCategoryInput, context) => {
      // Rollback to the previous value on error
      if (context?.previousCategories) {
        queryClient.setQueryData(
          categoryQueryKeys.list(newCategoryInput.glossaryId),
          context.previousCategories
        );
      }

      // Call user's onError if provided
      options?.onError?.(error, newCategoryInput, context);
    },

    onSuccess: (createdCategory, newCategoryInput, context) => {
      // Replace the optimistic category with the real one from the server
      const currentCategories = queryClient.getQueryData<GlossaryCategory[]>(
        categoryQueryKeys.list(newCategoryInput.glossaryId)
      );

      if (currentCategories && context) {
        const updatedCategories = currentCategories
          .map((cat) => (cat.id === context.tempId ? createdCategory : cat))
          .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        queryClient.setQueryData(
          categoryQueryKeys.list(newCategoryInput.glossaryId),
          updatedCategories
        );
      }

      // Call user's onSuccess if provided
      options?.onSuccess?.(createdCategory, newCategoryInput, context);
    },

    onSettled: (data, error, newCategoryInput) => {
      // Always invalidate to ensure cache is in sync with server
      queryClient.invalidateQueries({
        queryKey: categoryQueryKeys.list(newCategoryInput.glossaryId),
      });

      // Call user's onSettled if provided
      options?.onSettled?.(data, error, newCategoryInput, undefined);
    },

    ...options,
  });
}

/**
 * Hook for updating an existing glossary category
 *
 * Updates a category with new name and/or auto-link configuration.
 * Implements optimistic updates for immediate UI feedback.
 *
 * @param options - Mutation options including callbacks and configuration
 * @returns Mutation object with mutate function and state
 *
 * @example
 * ```typescript
 * function EditCategoryForm({
 *   category,
 *   glossaryId
 * }: {
 *   category: GlossaryCategory;
 *   glossaryId: number;
 * }) {
 *   const [name, setName] = useState(category.name);
 *   const [useDynaLink, setUseDynaLink] = useState(category.usedynalink);
 *
 *   const updateMutation = useUpdateCategory({
 *     onSuccess: () => {
 *       console.log('Category updated successfully');
 *     }
 *   });
 *
 *   const handleSubmit = (e: FormEvent) => {
 *     e.preventDefault();
 *     updateMutation.mutate({
 *       categoryId: category.id,
 *       name,
 *       usedynalink: useDynaLink
 *     });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input value={name} onChange={e => setName(e.target.value)} />
 *       <label>
 *         <input
 *           type="checkbox"
 *           checked={useDynaLink}
 *           onChange={e => setUseDynaLink(e.target.checked)}
 *         />
 *         Enable auto-linking
 *       </label>
 *       <button type="submit" disabled={updateMutation.isPending}>
 *         {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useUpdateCategory(
  options?: UseUpdateCategoryOptions
): ReturnType<typeof useMutation<GlossaryCategory, Error, UpdateCategoryInput, UpdateCategoryContext>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCategory,

    onMutate: async (updateInput) => {
      // Find the glossary ID from cached categories
      // We need to search all category caches to find the one containing this category
      let glossaryId: Id | undefined;
      let previousCategories: GlossaryCategory[] | undefined;

      // Get all cached queries that match the category list pattern
      const allQueries = queryClient.getQueriesData<GlossaryCategory[]>({
        queryKey: categoryQueryKeys.all,
      });

      // Find the categories list containing our category
      for (const [queryKey, categories] of allQueries) {
        if (categories && categories.some((cat) => cat.id === updateInput.categoryId)) {
          // Extract glossary ID from query key ['glossary', glossaryId, 'categories']
          glossaryId = queryKey[1] as Id;
          previousCategories = categories;
          break;
        }
      }

      if (!glossaryId || !previousCategories) {
        // If we can't find the category, just return empty context
        return { previousCategories: undefined, glossaryId: undefined };
      }

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: categoryQueryKeys.list(glossaryId),
      });

      // Optimistically update the category
      const updatedCategories = previousCategories
        .map((cat) =>
          cat.id === updateInput.categoryId
            ? {
                ...cat,
                name: updateInput.name,
                usedynalink: updateInput.usedynalink,
              }
            : cat
        )
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

      queryClient.setQueryData(categoryQueryKeys.list(glossaryId), updatedCategories);

      return { previousCategories, glossaryId };
    },

    onError: (error, updateInput, context) => {
      // Rollback to the previous value on error
      if (context?.previousCategories && context?.glossaryId) {
        queryClient.setQueryData(
          categoryQueryKeys.list(context.glossaryId),
          context.previousCategories
        );
      }

      // Call user's onError if provided
      options?.onError?.(error, updateInput, context);
    },

    onSuccess: (updatedCategory, updateInput, context) => {
      // Update the cache with the server response
      if (context?.glossaryId) {
        const currentCategories = queryClient.getQueryData<GlossaryCategory[]>(
          categoryQueryKeys.list(context.glossaryId)
        );

        if (currentCategories) {
          const updatedCategories = currentCategories
            .map((cat) => (cat.id === updateInput.categoryId ? updatedCategory : cat))
            .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

          queryClient.setQueryData(
            categoryQueryKeys.list(context.glossaryId),
            updatedCategories
          );
        }
      }

      // Call user's onSuccess if provided
      options?.onSuccess?.(updatedCategory, updateInput, context);
    },

    onSettled: (data, error, updateInput, context) => {
      // Always invalidate to ensure cache is in sync with server
      if (context?.glossaryId) {
        queryClient.invalidateQueries({
          queryKey: categoryQueryKeys.list(context.glossaryId),
        });
      }

      // Call user's onSettled if provided
      options?.onSettled?.(data, error, updateInput, context);
    },

    ...options,
  });
}

/**
 * Hook for deleting a glossary category
 *
 * Deletes a category from the glossary. When a category is deleted,
 * entries assigned to that category become uncategorized. This operation
 * requires the managecategories capability.
 *
 * The hook handles cascade operations on the server side:
 * - Entries in the deleted category are unassigned (moved to uncategorized)
 * - Category auto-link associations are removed
 * - Cache is properly invalidated to reflect changes
 *
 * @param options - Mutation options including callbacks and configuration
 * @returns Mutation object with mutate function and state
 *
 * @example
 * ```typescript
 * function CategoryItem({
 *   category,
 *   glossaryId
 * }: {
 *   category: GlossaryCategory;
 *   glossaryId: number;
 * }) {
 *   const deleteMutation = useDeleteCategory({
 *     onSuccess: () => {
 *       console.log('Category deleted successfully');
 *     },
 *     onError: (error) => {
 *       if (error.message.includes('constraint')) {
 *         alert('Cannot delete category: has associated entries');
 *       } else {
 *         alert('Failed to delete category');
 *       }
 *     }
 *   });
 *
 *   const handleDelete = () => {
 *     if (confirm(`Delete category "${category.name}"?`)) {
 *       deleteMutation.mutate({
 *         categoryId: category.id,
 *         glossaryId
 *       });
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <span>{category.name}</span>
 *       <span>({category.entrycount} entries)</span>
 *       <button
 *         onClick={handleDelete}
 *         disabled={deleteMutation.isPending}
 *       >
 *         {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDeleteCategory(
  options?: UseDeleteCategoryOptions
): ReturnType<typeof useMutation<boolean, Error, DeleteCategoryInput, DeleteCategoryContext>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeleteCategoryInput) => {
      return deleteCategory(input.categoryId);
    },

    onMutate: async (deleteInput) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: categoryQueryKeys.list(deleteInput.glossaryId),
      });

      // Snapshot the previous value for potential rollback
      const previousCategories = queryClient.getQueryData<GlossaryCategory[]>(
        categoryQueryKeys.list(deleteInput.glossaryId)
      );

      // Optimistically remove the category from the list
      if (previousCategories) {
        const updatedCategories = previousCategories.filter(
          (cat) => cat.id !== deleteInput.categoryId
        );
        queryClient.setQueryData(
          categoryQueryKeys.list(deleteInput.glossaryId),
          updatedCategories
        );
      }

      return { previousCategories };
    },

    onError: (error, deleteInput, context) => {
      // Rollback to the previous value on error
      if (context?.previousCategories) {
        queryClient.setQueryData(
          categoryQueryKeys.list(deleteInput.glossaryId),
          context.previousCategories
        );
      }

      // Call user's onError if provided
      options?.onError?.(error, deleteInput, context);
    },

    onSuccess: (success, deleteInput, context) => {
      // Call user's onSuccess if provided
      options?.onSuccess?.(success, deleteInput, context);
    },

    onSettled: (data, error, deleteInput, context) => {
      // Always invalidate related queries to ensure cache consistency
      queryClient.invalidateQueries({
        queryKey: categoryQueryKeys.list(deleteInput.glossaryId),
      });

      // Also invalidate entries query since entries might have been affected
      queryClient.invalidateQueries({
        queryKey: ['glossary', deleteInput.glossaryId, 'entries'],
      });

      // Call user's onSettled if provided
      options?.onSettled?.(data, error, deleteInput, context);
    },

    ...options,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Prefetches categories for a glossary
 *
 * Useful for preloading category data before navigating to a page
 * that will display category management.
 *
 * @param queryClient - The React Query client instance
 * @param glossaryId - The glossary ID to prefetch categories for
 *
 * @example
 * ```typescript
 * const queryClient = useQueryClient();
 *
 * // Prefetch categories when hovering over a link
 * const handleMouseEnter = () => {
 *   prefetchCategories(queryClient, glossaryId);
 * };
 * ```
 */
export async function prefetchCategories(
  queryClient: ReturnType<typeof useQueryClient>,
  glossaryId: Id
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: categoryQueryKeys.list(glossaryId),
    queryFn: async () => {
      const categories = await getCategories(glossaryId);
      return categories.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Invalidates all category-related queries for a glossary
 *
 * Forces a refetch of category data. Useful after bulk operations
 * or when external changes need to be reflected.
 *
 * @param queryClient - The React Query client instance
 * @param glossaryId - The glossary ID to invalidate categories for
 *
 * @example
 * ```typescript
 * const queryClient = useQueryClient();
 *
 * // Force refresh after bulk import
 * await invalidateCategoriesCache(queryClient, glossaryId);
 * ```
 */
export async function invalidateCategoriesCache(
  queryClient: ReturnType<typeof useQueryClient>,
  glossaryId: Id
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: categoryQueryKeys.list(glossaryId),
  });
}
