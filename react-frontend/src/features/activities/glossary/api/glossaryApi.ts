/**
 * Glossary API Client Module
 *
 * TypeScript API client for the Moodle glossary activity module. Provides methods
 * to interact with the backend REST API endpoints at /api/v1/glossary/ for all
 * glossary operations including entries, categories, ratings, comments, and attachments.
 *
 * This module follows the thin API wrapper pattern where all business logic remains
 * on the backend. Each function calls the corresponding PHP API endpoint which in
 * turn invokes existing Moodle glossary functions.
 *
 * Features:
 * - Full CRUD operations for glossary entries
 * - Category management for organizing entries
 * - Rating and commenting system integration
 * - File attachment handling with upload support
 * - Search and filtering with multiple browse modes
 * - Approval workflow for moderated glossaries
 *
 * Usage with React Query:
 * ```typescript
 * import { useQuery, useMutation } from '@tanstack/react-query';
 * import { getGlossary, createEntry } from './glossaryApi';
 *
 * // Fetch glossary
 * const { data } = useQuery({
 *   queryKey: ['glossary', glossaryId],
 *   queryFn: () => getGlossary(glossaryId)
 * });
 *
 * // Create entry mutation
 * const createMutation = useMutation({
 *   mutationFn: createEntry
 * });
 * ```
 *
 * @module features/activities/glossary/api/glossaryApi
 */

import apiClient from '@/services/api/client';
import type { ApiResponse } from '@/types/api';
import type { Id } from '@/types/common';
import type {
  Glossary,
  GlossaryEntry,
  GlossaryCategory,
  GlossaryComment,
  GlossaryRating,
  GlossaryAttachment,
  GlossaryFilters,
  CreateEntryInput,
  UpdateEntryInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  RateEntryInput,
  PostCommentInput,
  UpdateCommentInput,
  RatingStats,
} from '@/features/activities/glossary/types/glossary.types';

// ============================================================================
// API Endpoints Constants
// ============================================================================

/**
 * Base path for all glossary API endpoints
 */
const GLOSSARY_API_BASE = '/glossary';

// ============================================================================
// Glossary Operations
// ============================================================================

/**
 * Fetches a single glossary by its ID
 *
 * Retrieves complete glossary details including configuration settings,
 * available browse modes, and user permissions for the glossary.
 *
 * @param glossaryId - The unique identifier of the glossary
 * @returns Promise resolving to the glossary data
 *
 * @example
 * ```typescript
 * const glossary = await getGlossary(123);
 * console.log(glossary.name, glossary.displayformat);
 * ```
 */
export async function getGlossary(glossaryId: Id): Promise<Glossary> {
  const response = await apiClient.get<ApiResponse<Glossary>>(
    `${GLOSSARY_API_BASE}/${glossaryId}`
  );
  return response.data.data;
}

/**
 * Fetches all glossaries for a given course
 *
 * Returns a list of glossaries available in the specified course,
 * including both main and secondary glossaries.
 *
 * @param courseId - The course ID to fetch glossaries from
 * @returns Promise resolving to array of glossaries
 *
 * @example
 * ```typescript
 * const glossaries = await getGlossaries(5);
 * glossaries.forEach(g => console.log(g.name));
 * ```
 */
export async function getGlossaries(courseId: Id): Promise<Glossary[]> {
  const response = await apiClient.get<ApiResponse<Glossary[]>>(
    `${GLOSSARY_API_BASE}`,
    { params: { courseid: courseId } }
  );
  return response.data.data;
}

// ============================================================================
// Entry Operations
// ============================================================================

/**
 * Fetches entries from a glossary with optional filtering
 *
 * Supports multiple browse modes (alphabetical, by category, by date, by author)
 * and various filtering options. Returns paginated results.
 *
 * @param glossaryId - The glossary ID to fetch entries from
 * @param filters - Optional filters for searching/browsing entries
 * @returns Promise resolving to object containing entries array and total count
 *
 * @example
 * ```typescript
 * // Fetch all entries
 * const { entries, total } = await getEntries(123);
 *
 * // Fetch entries starting with 'A'
 * const { entries } = await getEntries(123, {
 *   browseMode: 'letter',
 *   letter: 'A'
 * });
 *
 * // Fetch entries by category
 * const { entries } = await getEntries(123, {
 *   browseMode: 'cat',
 *   categoryId: 5
 * });
 * ```
 */
export async function getEntries(
  glossaryId: Id,
  filters?: GlossaryFilters
): Promise<{ entries: GlossaryEntry[]; total: number }> {
  const params: Record<string, unknown> = {
    glossaryid: glossaryId,
  };

  if (filters) {
    if (filters.browseMode) params.mode = filters.browseMode;
    if (filters.letter) params.letter = filters.letter;
    if (filters.categoryId) params.categoryid = filters.categoryId;
    if (filters.userId) params.userid = filters.userId;
    if (filters.approved !== undefined) params.approved = filters.approved ? 1 : 0;
    if (filters.sortBy) params.sortby = filters.sortBy;
    if (filters.sortOrder) params.sortorder = filters.sortOrder;
    if (filters.page !== undefined) params.page = filters.page;
    if (filters.perPage !== undefined) params.perpage = filters.perPage;
  }

  const response = await apiClient.get<
    ApiResponse<{ entries: GlossaryEntry[]; total: number }>
  >(`${GLOSSARY_API_BASE}/${glossaryId}/entries`, { params });

  return response.data.data;
}

/**
 * Searches entries within a glossary
 *
 * Performs full-text search on entry concepts and definitions.
 * Supports various search modes and sorting options.
 *
 * @param glossaryId - The glossary ID to search within
 * @param query - Search query string
 * @param options - Additional search options
 * @returns Promise resolving to matching entries and total count
 *
 * @example
 * ```typescript
 * // Basic search
 * const { entries } = await searchEntries(123, 'programming');
 *
 * // Full search (concept and definition)
 * const { entries } = await searchEntries(123, 'react', {
 *   fullsearch: true,
 *   sortBy: 'concept',
 *   sortOrder: 'asc'
 * });
 * ```
 */
export async function searchEntries(
  glossaryId: Id,
  query: string,
  options?: {
    fullsearch?: boolean;
    sortBy?: 'concept' | 'author' | 'created' | 'modified';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    perPage?: number;
  }
): Promise<{ entries: GlossaryEntry[]; total: number }> {
  const params: Record<string, unknown> = {
    glossaryid: glossaryId,
    mode: 'search',
    hook: query,
    fullsearch: options?.fullsearch ? 1 : 0,
  };

  if (options) {
    if (options.sortBy) params.sortby = options.sortBy;
    if (options.sortOrder) params.sortorder = options.sortOrder;
    if (options.page !== undefined) params.page = options.page;
    if (options.perPage !== undefined) params.perpage = options.perPage;
  }

  const response = await apiClient.get<
    ApiResponse<{ entries: GlossaryEntry[]; total: number }>
  >(`${GLOSSARY_API_BASE}/${glossaryId}/entries/search`, { params });

  return response.data.data;
}

/**
 * Fetches a single glossary entry by ID
 *
 * Retrieves the complete entry including definition, attachments,
 * tags, category information, and author details.
 *
 * @param entryId - The unique identifier of the entry
 * @returns Promise resolving to the entry data
 *
 * @example
 * ```typescript
 * const entry = await getEntry(456);
 * console.log(entry.concept, entry.definition);
 * ```
 */
export async function getEntry(entryId: Id): Promise<GlossaryEntry> {
  const response = await apiClient.get<ApiResponse<GlossaryEntry>>(
    `${GLOSSARY_API_BASE}/entries/${entryId}`
  );
  return response.data.data;
}

/**
 * Creates a new glossary entry
 *
 * Creates an entry in the specified glossary. The entry may require
 * approval depending on glossary settings and user permissions.
 *
 * @param input - Entry creation data including concept, definition, and options
 * @returns Promise resolving to the created entry
 *
 * @example
 * ```typescript
 * const newEntry = await createEntry({
 *   glossaryId: 123,
 *   concept: 'React',
 *   definition: 'A JavaScript library for building user interfaces',
 *   definitionformat: TextFormat.HTML,
 *   usedynalink: true,
 *   casesensitive: false,
 *   fullmatch: true
 * });
 * ```
 */
export async function createEntry(input: CreateEntryInput): Promise<GlossaryEntry> {
  // If there are file attachments, use multipart form data
  if (input.attachments && input.attachments.length > 0) {
    const formData = new FormData();
    formData.append('glossaryid', String(input.glossaryId));
    formData.append('concept', input.concept);
    formData.append('definition', input.definition);
    formData.append('definitionformat', String(input.definitionformat));
    formData.append('usedynalink', input.usedynalink ? '1' : '0');
    formData.append('casesensitive', input.casesensitive ? '1' : '0');
    formData.append('fullmatch', input.fullmatch ? '1' : '0');

    if (input.categoryId !== undefined) {
      formData.append('categoryid', String(input.categoryId));
    }

    input.attachments.forEach((file, index) => {
      formData.append(`attachment_${index}`, file);
    });

    const response = await apiClient.post<ApiResponse<GlossaryEntry>>(
      `${GLOSSARY_API_BASE}/${input.glossaryId}/entries`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // Extended timeout for file uploads
      }
    );
    return response.data.data;
  }

  // Standard JSON request without attachments
  const response = await apiClient.post<ApiResponse<GlossaryEntry>>(
    `${GLOSSARY_API_BASE}/${input.glossaryId}/entries`,
    {
      concept: input.concept,
      definition: input.definition,
      definitionformat: input.definitionformat,
      usedynalink: input.usedynalink ? 1 : 0,
      casesensitive: input.casesensitive ? 1 : 0,
      fullmatch: input.fullmatch ? 1 : 0,
      categoryid: input.categoryId,
    }
  );
  return response.data.data;
}

/**
 * Updates an existing glossary entry
 *
 * Updates the entry with new values. Only fields provided in the input
 * will be updated. Users can only update their own entries unless they
 * have the manageentries capability.
 *
 * @param input - Entry update data including entry ID and new values
 * @returns Promise resolving to the updated entry
 *
 * @example
 * ```typescript
 * const updatedEntry = await updateEntry({
 *   entryId: 456,
 *   concept: 'React.js',
 *   definition: 'Updated definition...',
 *   definitionformat: TextFormat.HTML,
 *   usedynalink: true,
 *   casesensitive: false,
 *   fullmatch: true
 * });
 * ```
 */
export async function updateEntry(input: UpdateEntryInput): Promise<GlossaryEntry> {
  // If there are file attachments, use multipart form data
  if (input.attachments && input.attachments.length > 0) {
    const formData = new FormData();
    formData.append('concept', input.concept);
    formData.append('definition', input.definition);
    formData.append('definitionformat', String(input.definitionformat));
    formData.append('usedynalink', input.usedynalink ? '1' : '0');
    formData.append('casesensitive', input.casesensitive ? '1' : '0');
    formData.append('fullmatch', input.fullmatch ? '1' : '0');

    if (input.categoryId !== undefined) {
      formData.append('categoryid', String(input.categoryId));
    }

    input.attachments.forEach((file, index) => {
      formData.append(`attachment_${index}`, file);
    });

    const response = await apiClient.put<ApiResponse<GlossaryEntry>>(
      `${GLOSSARY_API_BASE}/entries/${input.entryId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // Extended timeout for file uploads
      }
    );
    return response.data.data;
  }

  // Standard JSON request without attachments
  const response = await apiClient.put<ApiResponse<GlossaryEntry>>(
    `${GLOSSARY_API_BASE}/entries/${input.entryId}`,
    {
      concept: input.concept,
      definition: input.definition,
      definitionformat: input.definitionformat,
      usedynalink: input.usedynalink ? 1 : 0,
      casesensitive: input.casesensitive ? 1 : 0,
      fullmatch: input.fullmatch ? 1 : 0,
      categoryid: input.categoryId,
    }
  );
  return response.data.data;
}

/**
 * Deletes a glossary entry
 *
 * Permanently removes the entry and its associated data (attachments,
 * comments, ratings). Users can only delete their own entries unless
 * they have the manageentries capability.
 *
 * @param entryId - The unique identifier of the entry to delete
 * @returns Promise resolving to success indicator
 *
 * @example
 * ```typescript
 * const success = await deleteEntry(456);
 * if (success) {
 *   console.log('Entry deleted successfully');
 * }
 * ```
 */
export async function deleteEntry(entryId: Id): Promise<boolean> {
  const response = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
    `${GLOSSARY_API_BASE}/entries/${entryId}`
  );
  return response.data.data.deleted;
}

/**
 * Approves a pending glossary entry
 *
 * Marks an entry as approved, making it visible to all users.
 * Only users with the approve capability can perform this action.
 *
 * @param entryId - The unique identifier of the entry to approve
 * @returns Promise resolving to the approved entry
 *
 * @example
 * ```typescript
 * const approvedEntry = await approveEntry(456);
 * console.log(approvedEntry.approved); // true
 * ```
 */
export async function approveEntry(entryId: Id): Promise<GlossaryEntry> {
  const response = await apiClient.post<ApiResponse<GlossaryEntry>>(
    `${GLOSSARY_API_BASE}/entries/${entryId}/approve`
  );
  return response.data.data;
}

// ============================================================================
// Category Operations
// ============================================================================

/**
 * Fetches all categories for a glossary
 *
 * Returns the list of categories used to organize entries within
 * the glossary, including entry counts for each category.
 *
 * @param glossaryId - The glossary ID to fetch categories from
 * @returns Promise resolving to array of categories
 *
 * @example
 * ```typescript
 * const categories = await getCategories(123);
 * categories.forEach(cat => console.log(cat.name, cat.entrycount));
 * ```
 */
export async function getCategories(glossaryId: Id): Promise<GlossaryCategory[]> {
  const response = await apiClient.get<ApiResponse<GlossaryCategory[]>>(
    `${GLOSSARY_API_BASE}/${glossaryId}/categories`
  );
  return response.data.data;
}

/**
 * Creates a new category in a glossary
 *
 * Creates a category for organizing glossary entries. Only users
 * with the managecategories capability can create categories.
 *
 * @param input - Category creation data
 * @returns Promise resolving to the created category
 *
 * @example
 * ```typescript
 * const newCategory = await createCategory({
 *   glossaryId: 123,
 *   name: 'Programming Concepts',
 *   usedynalink: true
 * });
 * ```
 */
export async function createCategory(input: CreateCategoryInput): Promise<GlossaryCategory> {
  const response = await apiClient.post<ApiResponse<GlossaryCategory>>(
    `${GLOSSARY_API_BASE}/${input.glossaryId}/categories`,
    {
      name: input.name,
      usedynalink: input.usedynalink ? 1 : 0,
    }
  );
  return response.data.data;
}

/**
 * Updates an existing glossary category
 *
 * Updates the category with new values. Only users with the
 * managecategories capability can update categories.
 *
 * @param input - Category update data including category ID and new values
 * @returns Promise resolving to the updated category
 *
 * @example
 * ```typescript
 * const updatedCategory = await updateCategory({
 *   categoryId: 5,
 *   name: 'Updated Category Name',
 *   usedynalink: false
 * });
 * ```
 */
export async function updateCategory(input: UpdateCategoryInput): Promise<GlossaryCategory> {
  const response = await apiClient.put<ApiResponse<GlossaryCategory>>(
    `${GLOSSARY_API_BASE}/categories/${input.categoryId}`,
    {
      name: input.name,
      usedynalink: input.usedynalink ? 1 : 0,
    }
  );
  return response.data.data;
}

/**
 * Deletes a glossary category
 *
 * Permanently removes the category. Entries in the deleted category
 * are moved to uncategorized. Only users with the managecategories
 * capability can delete categories.
 *
 * @param categoryId - The unique identifier of the category to delete
 * @returns Promise resolving to success indicator
 *
 * @example
 * ```typescript
 * const success = await deleteCategory(5);
 * if (success) {
 *   console.log('Category deleted successfully');
 * }
 * ```
 */
export async function deleteCategory(categoryId: Id): Promise<boolean> {
  const response = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
    `${GLOSSARY_API_BASE}/categories/${categoryId}`
  );
  return response.data.data.deleted;
}

// ============================================================================
// Rating Operations
// ============================================================================

/**
 * Fetches ratings for a glossary entry
 *
 * Returns rating statistics and the current user's rating if they
 * have rated the entry. Only available if the glossary has rating enabled.
 *
 * @param entryId - The entry ID to fetch ratings for
 * @returns Promise resolving to rating statistics
 *
 * @example
 * ```typescript
 * const ratings = await getEntryRatings(456);
 * console.log(`Average: ${ratings.average}, Count: ${ratings.count}`);
 * if (ratings.userRating) {
 *   console.log(`Your rating: ${ratings.userRating}`);
 * }
 * ```
 */
export async function getEntryRatings(entryId: Id): Promise<RatingStats> {
  const response = await apiClient.get<ApiResponse<RatingStats>>(
    `${GLOSSARY_API_BASE}/entries/${entryId}/ratings`
  );
  return response.data.data;
}

/**
 * Rates a glossary entry
 *
 * Submits or updates a rating for an entry. Users cannot rate their
 * own entries. The rating must be within the scale defined for the glossary.
 *
 * @param input - Rating input including entry ID, rating value, and scale ID
 * @returns Promise resolving to updated rating statistics
 *
 * @example
 * ```typescript
 * const updatedRatings = await rateEntry({
 *   entryId: 456,
 *   rating: 4,
 *   scaleid: 100 // Points scale 1-100
 * });
 * ```
 */
export async function rateEntry(input: RateEntryInput): Promise<RatingStats> {
  const response = await apiClient.post<ApiResponse<RatingStats>>(
    `${GLOSSARY_API_BASE}/entries/${input.entryId}/ratings`,
    {
      rating: input.rating,
      scaleid: input.scaleid,
    }
  );
  return response.data.data;
}

// ============================================================================
// Comment Operations
// ============================================================================

/**
 * Fetches comments for a glossary entry
 *
 * Returns all comments on the entry in chronological order.
 * Only available if the glossary allows comments.
 *
 * @param entryId - The entry ID to fetch comments for
 * @returns Promise resolving to array of comments
 *
 * @example
 * ```typescript
 * const comments = await getEntryComments(456);
 * comments.forEach(comment => {
 *   console.log(`${comment.userfullname}: ${comment.content}`);
 * });
 * ```
 */
export async function getEntryComments(entryId: Id): Promise<GlossaryComment[]> {
  const response = await apiClient.get<ApiResponse<GlossaryComment[]>>(
    `${GLOSSARY_API_BASE}/entries/${entryId}/comments`
  );
  return response.data.data;
}

/**
 * Posts a new comment on a glossary entry
 *
 * Creates a comment on the specified entry. Only available if
 * the glossary allows comments and the user has permission.
 *
 * @param input - Comment data including entry ID and content
 * @returns Promise resolving to the created comment
 *
 * @example
 * ```typescript
 * const newComment = await postComment({
 *   entryId: 456,
 *   content: 'Great explanation!',
 *   format: TextFormat.PLAIN
 * });
 * ```
 */
export async function postComment(input: PostCommentInput): Promise<GlossaryComment> {
  const response = await apiClient.post<ApiResponse<GlossaryComment>>(
    `${GLOSSARY_API_BASE}/entries/${input.entryId}/comments`,
    {
      content: input.content,
      format: input.format,
    }
  );
  return response.data.data;
}

/**
 * Updates an existing comment
 *
 * Updates the comment with new content. Users can only update
 * their own comments unless they have the deleteanycomment capability.
 *
 * @param input - Comment update data including comment ID and new content
 * @returns Promise resolving to the updated comment
 *
 * @example
 * ```typescript
 * const updatedComment = await updateComment({
 *   commentId: 789,
 *   content: 'Updated comment text',
 *   format: TextFormat.PLAIN
 * });
 * ```
 */
export async function updateComment(input: UpdateCommentInput): Promise<GlossaryComment> {
  const response = await apiClient.put<ApiResponse<GlossaryComment>>(
    `${GLOSSARY_API_BASE}/comments/${input.commentId}`,
    {
      content: input.content,
      format: input.format,
    }
  );
  return response.data.data;
}

/**
 * Deletes a comment from a glossary entry
 *
 * Permanently removes the comment. Users can only delete their own
 * comments unless they have the deleteanycomment capability.
 *
 * @param commentId - The unique identifier of the comment to delete
 * @returns Promise resolving to success indicator
 *
 * @example
 * ```typescript
 * const success = await deleteComment(789);
 * if (success) {
 *   console.log('Comment deleted successfully');
 * }
 * ```
 */
export async function deleteComment(commentId: Id): Promise<boolean> {
  const response = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
    `${GLOSSARY_API_BASE}/comments/${commentId}`
  );
  return response.data.data.deleted;
}

// ============================================================================
// Attachment Operations
// ============================================================================

/**
 * Fetches attachments for a glossary entry
 *
 * Returns all file attachments associated with the entry including
 * file metadata such as name, size, MIME type, and download URL.
 *
 * @param entryId - The entry ID to fetch attachments for
 * @returns Promise resolving to array of attachments
 *
 * @example
 * ```typescript
 * const attachments = await getAttachments(456);
 * attachments.forEach(file => {
 *   console.log(`${file.filename} (${file.filesize} bytes)`);
 *   console.log(`Download: ${file.fileurl}`);
 * });
 * ```
 */
export async function getAttachments(entryId: Id): Promise<GlossaryAttachment[]> {
  const response = await apiClient.get<ApiResponse<GlossaryAttachment[]>>(
    `${GLOSSARY_API_BASE}/entries/${entryId}/attachments`
  );
  return response.data.data;
}

/**
 * Uploads an attachment to a glossary entry
 *
 * Uploads a file to be attached to the specified entry. The file
 * is stored in Moodle's file storage system. Only users who can
 * edit the entry can upload attachments.
 *
 * @param entryId - The entry ID to attach the file to
 * @param file - The file to upload
 * @param onProgress - Optional callback for upload progress updates
 * @returns Promise resolving to the uploaded attachment metadata
 *
 * @example
 * ```typescript
 * const inputFile = document.querySelector('input[type="file"]').files[0];
 *
 * const attachment = await uploadAttachment(
 *   456,
 *   inputFile,
 *   (progress) => console.log(`Upload: ${progress}%`)
 * );
 *
 * console.log(`Uploaded: ${attachment.filename}`);
 * ```
 */
export async function uploadAttachment(
  entryId: Id,
  file: File,
  onProgress?: (percentCompleted: number) => void
): Promise<GlossaryAttachment> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<ApiResponse<GlossaryAttachment>>(
    `${GLOSSARY_API_BASE}/entries/${entryId}/attachments`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000, // 2 minute timeout for file uploads
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    }
  );
  return response.data.data;
}
