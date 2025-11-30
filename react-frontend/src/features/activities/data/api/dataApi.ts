/**
 * Data Activity API Client Module
 *
 * TypeScript API client for the Moodle Database (mod_data) activity module.
 * Provides methods for database operations, record CRUD, field management,
 * advanced search, templates, file attachments, export/import, and ratings.
 *
 * This module wraps the backend REST API endpoints at /api/v1/data/ and
 * integrates with React Query for efficient data fetching and caching.
 *
 * Based on Moodle's PHP implementation:
 * - public/mod/data/lib.php
 * - public/mod/data/locallib.php
 * - public/mod/data/classes/external.php
 *
 * @module features/activities/data/api/dataApi
 */

import apiClient from '@/services/api/client';
import type {
  Database,
  DatabaseRecord,
  DatabaseField,
  FieldContent,
  FieldType,
  TemplateType,
  SearchCriteria,
  DatabaseRecordsResponse,
  DatabasePermissions,
} from '@/features/activities/data/types/data.types';
import type { CourseId } from '@/types/common';

// ============================================================================
// Constants
// ============================================================================

/**
 * Base API path for database activity endpoints
 */
const DATA_API_BASE = '/data';

/**
 * Default pagination settings for record listings
 */
const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// Query Key Factories
// ============================================================================

/**
 * Query key factory for database activity queries.
 *
 * Provides consistent and type-safe query keys for React Query caching.
 *
 * @example
 * ```typescript
 * // Use in React Query hooks
 * const { data } = useQuery({
 *   queryKey: dataQueryKeys.database(123),
 *   queryFn: () => getDatabase(123)
 * });
 * ```
 */
/**
 * Base query key for all data module queries
 */
const DATA_QUERY_BASE = ['data'] as const;

export const dataQueryKeys = {
  /** Base key for all data module queries */
  all: DATA_QUERY_BASE,

  /** Key for all database instance queries */
  databases: (): readonly unknown[] => [...DATA_QUERY_BASE, 'databases'] as const,

  /** Key for databases in a specific course */
  databasesByCourse: (courseId: CourseId): readonly unknown[] =>
    [...DATA_QUERY_BASE, 'databases', 'course', courseId] as const,

  /** Key for a specific database instance */
  database: (databaseId: number): readonly unknown[] =>
    [...DATA_QUERY_BASE, 'databases', databaseId] as const,

  /** Key for database access information */
  databaseAccess: (databaseId: number): readonly unknown[] =>
    [...DATA_QUERY_BASE, 'databases', databaseId, 'access'] as const,

  /** Key for all record queries */
  records: (): readonly unknown[] => [...DATA_QUERY_BASE, 'records'] as const,

  /** Key for records in a specific database */
  recordsByDatabase: (databaseId: number, params?: SearchCriteria): readonly unknown[] =>
    [...DATA_QUERY_BASE, 'records', 'database', databaseId, params] as const,

  /** Key for a specific record */
  record: (databaseId: number, recordId: number): readonly unknown[] =>
    [...DATA_QUERY_BASE, 'records', databaseId, recordId] as const,

  /** Key for all field queries */
  fields: (): readonly unknown[] => [...DATA_QUERY_BASE, 'fields'] as const,

  /** Key for fields in a specific database */
  fieldsByDatabase: (databaseId: number): readonly unknown[] =>
    [...DATA_QUERY_BASE, 'fields', 'database', databaseId] as const,

  /** Key for a specific field */
  field: (databaseId: number, fieldId: number): readonly unknown[] =>
    [...DATA_QUERY_BASE, 'fields', databaseId, fieldId] as const,

  /** Key for search queries */
  search: (databaseId: number, criteria: SearchCriteria): readonly unknown[] =>
    [...DATA_QUERY_BASE, 'search', databaseId, criteria] as const,

  /** Key for template queries */
  templates: (databaseId: number): readonly unknown[] =>
    [...DATA_QUERY_BASE, 'databases', databaseId, 'templates'] as const,

  /** Key for a specific template */
  template: (databaseId: number, templateType: TemplateType): readonly unknown[] =>
    [...DATA_QUERY_BASE, 'databases', databaseId, 'templates', templateType] as const,

  /** Key for file queries */
  files: (databaseId: number, recordId: number): readonly unknown[] =>
    [...DATA_QUERY_BASE, 'records', databaseId, recordId, 'files'] as const,
};

// ============================================================================
// Type Definitions for API Requests/Responses
// ============================================================================

/**
 * Parameters for creating a new database record
 */
export interface CreateRecordParams {
  /** Database instance ID */
  databaseId: number;
  /** Group ID (0 for no group) */
  groupId?: number;
  /** Field content data - map of field ID to content value */
  data: Array<{
    /** Field ID */
    fieldid: number;
    /** Field subfield (e.g., 'content', 'content1') */
    subfield?: string;
    /** Field value */
    value: string;
  }>;
}

/**
 * Parameters for updating an existing record
 */
export interface UpdateRecordParams {
  /** Database instance ID */
  databaseId: number;
  /** Record ID to update */
  recordId: number;
  /** Field content data - map of field ID to content value */
  data: Array<{
    /** Field ID */
    fieldid: number;
    /** Field subfield */
    subfield?: string;
    /** Field value */
    value: string;
  }>;
}

/**
 * Parameters for creating a new field
 */
export interface CreateFieldParams {
  /** Database instance ID */
  databaseId: number;
  /** Field type */
  type: FieldType;
  /** Field name */
  name: string;
  /** Field description */
  description: string;
  /** Whether field is required */
  required?: boolean;
  /** Additional parameters based on field type */
  param1?: string;
  param2?: string;
  param3?: string;
  param4?: string;
  param5?: string;
}

/**
 * Parameters for updating an existing field
 */
export interface UpdateFieldParams {
  /** Database instance ID */
  databaseId: number;
  /** Field ID to update */
  fieldId: number;
  /** Updated field name */
  name?: string;
  /** Updated field description */
  description?: string;
  /** Whether field is required */
  required?: boolean;
  /** Additional parameters based on field type */
  param1?: string;
  param2?: string;
  param3?: string;
  param4?: string;
  param5?: string;
}

/**
 * Parameters for updating a template
 */
export interface UpdateTemplateParams {
  /** Database instance ID */
  databaseId: number;
  /** Template type to update */
  templateType: TemplateType;
  /** New template content (HTML) */
  content: string;
}

/**
 * Parameters for file upload
 */
export interface UploadFileParams {
  /** Database instance ID */
  databaseId: number;
  /** Record ID to attach file to */
  recordId: number;
  /** Field ID for file attachment */
  fieldId: number;
  /** File to upload */
  file: File;
}

/**
 * Parameters for exporting records
 */
export interface ExportRecordsParams {
  /** Database instance ID */
  databaseId: number;
  /** Export format */
  format: 'csv' | 'ods' | 'xml';
  /** Field IDs to include in export (empty for all) */
  fieldIds?: number[];
  /** Record IDs to export (empty for all) */
  recordIds?: number[];
}

/**
 * Parameters for importing records
 */
export interface ImportRecordsParams {
  /** Database instance ID */
  databaseId: number;
  /** Import file */
  file: File;
  /** Encoding of the import file */
  encoding?: string;
  /** Delimiter for CSV files */
  delimiter?: string;
  /** Whether first row contains field names */
  hasHeader?: boolean;
}

/**
 * Parameters for rating a record
 */
export interface RateRecordParams {
  /** Database instance ID */
  databaseId: number;
  /** Record ID to rate */
  recordId: number;
  /** Rating value */
  rating: number;
}

/**
 * Parameters for adding a comment
 */
export interface AddCommentParams {
  /** Database instance ID */
  databaseId: number;
  /** Record ID to comment on */
  recordId: number;
  /** Comment content */
  content: string;
}

/**
 * Database access information response
 */
export interface DatabaseAccessInfo {
  /** User permissions */
  permissions: DatabasePermissions;
  /** Whether user can add entries */
  canAdd: boolean;
  /** Number of entries user has made */
  userEntriesCount: number;
  /** Number of entries required before viewing */
  entriesRequiredToView: number;
  /** Whether viewing restriction is met */
  canView: boolean;
  /** Timestamps for availability window */
  timeavailablefrom?: number;
  timeavailableto?: number;
  /** Whether database is currently available */
  isAvailable: boolean;
  /** Groups user belongs to */
  groups: Array<{ id: number; name: string }>;
}

/**
 * Template data structure
 */
export interface TemplateData {
  /** Template type */
  type: TemplateType;
  /** Template content (HTML) */
  content: string;
  /** Whether this is the default template */
  isDefault: boolean;
}

/**
 * File attachment information
 */
export interface FileAttachment {
  /** File ID */
  id: number;
  /** File name */
  filename: string;
  /** MIME type */
  mimetype: string;
  /** File size in bytes */
  filesize: number;
  /** Download URL */
  fileurl: string;
  /** Upload timestamp */
  timemodified: number;
}

/**
 * Comment data structure
 */
export interface RecordComment {
  /** Comment ID */
  id: number;
  /** User ID who made the comment */
  userid: number;
  /** User's full name */
  userfullname: string;
  /** Comment content */
  content: string;
  /** Format of comment content */
  format: number;
  /** Timestamp of comment */
  timecreated: number;
}

/**
 * Record with full content data
 */
export interface RecordWithContents extends DatabaseRecord {
  /** All field contents for this record */
  contents: FieldContent[];
  /** User's full name */
  userfullname?: string;
  /** Whether current user can edit this record */
  canEdit?: boolean;
  /** Whether current user can delete this record */
  canDelete?: boolean;
  /** Record's tags */
  tags?: Array<{ id: number; name: string }>;
  /** Record's rating (if enabled) */
  rating?: {
    aggregate?: number;
    count?: number;
    userRating?: number;
  };
  /** Record's comments (if enabled) */
  comments?: RecordComment[];
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Fetches a single database activity instance by ID.
 *
 * Retrieves complete database configuration including templates, settings,
 * and metadata. Use getDatabaseAccessInfo() for permission information.
 *
 * @param databaseId - The unique identifier of the database instance
 * @returns Promise resolving to the database configuration
 * @throws Error if database not found or user lacks view permission
 *
 * @example
 * ```typescript
 * const database = await getDatabase(123);
 * console.log(database.name, database.intro);
 * ```
 */
export async function getDatabase(databaseId: number): Promise<Database> {
  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }

  const response = await apiClient.get<{ data: Database }>(
    `${DATA_API_BASE}/databases/${databaseId}`
  );

  return response.data.data;
}

/**
 * Fetches all database activity instances for specified courses.
 *
 * Retrieves a list of database activities the user has access to within
 * the given courses. Useful for course overview pages.
 *
 * @param courseIds - Array of course IDs to fetch databases for
 * @returns Promise resolving to array of database instances
 * @throws Error if no valid course IDs provided
 *
 * @example
 * ```typescript
 * const databases = await getDatabases([5, 10, 15]);
 * databases.forEach(db => console.log(db.name));
 * ```
 */
export async function getDatabases(
  courseIds: CourseId[]
): Promise<Database[]> {
  if (!courseIds || courseIds.length === 0) {
    throw new Error('At least one course ID must be provided');
  }

  const validCourseIds = courseIds.filter((id) => id > 0);
  if (validCourseIds.length === 0) {
    throw new Error('No valid course IDs provided');
  }

  const response = await apiClient.post<{ data: { databases: Database[] } }>(
    `${DATA_API_BASE}/databases/by-courses`,
    { courseids: validCourseIds }
  );

  return response.data.data.databases;
}

/**
 * Fetches access information and permissions for a database activity.
 *
 * Returns user permissions, entry counts, group access, and availability
 * status. Essential for determining what actions the user can perform.
 *
 * @param databaseId - The database instance ID
 * @returns Promise resolving to access information
 * @throws Error if database not found or access denied
 *
 * @example
 * ```typescript
 * const accessInfo = await getDatabaseAccessInfo(123);
 * if (accessInfo.canAdd) {
 *   // Show add entry button
 * }
 * ```
 */
export async function getDatabaseAccessInfo(
  databaseId: number
): Promise<DatabaseAccessInfo> {
  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }

  const response = await apiClient.get<{ data: DatabaseAccessInfo }>(
    `${DATA_API_BASE}/databases/${databaseId}/access`
  );

  return response.data.data;
}

// ============================================================================
// Record Operations
// ============================================================================

/**
 * Fetches paginated records from a database activity.
 *
 * Retrieves records with pagination, sorting, and optional grouping support.
 * For advanced filtering, use searchRecords() instead.
 *
 * @param databaseId - The database instance ID
 * @param params - Optional pagination and sorting parameters
 * @returns Promise resolving to paginated records response
 * @throws Error if database not found or access denied
 *
 * @example
 * ```typescript
 * const response = await getRecords(123, {
 *   page: 1,
 *   perPage: 20,
 *   sort: { field: 0, direction: 0 } // Sort by time added, ascending
 * });
 * ```
 */
export async function getRecords(
  databaseId: number,
  params?: SearchCriteria
): Promise<DatabaseRecordsResponse> {
  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }

  const queryParams: Record<string, unknown> = {
    page: params?.page ?? 1,
    perpage: params?.perPage ?? DEFAULT_PAGE_SIZE,
  };

  if (params?.sort) {
    queryParams.sort = params.sort.field;
    queryParams.order = params.sort.direction === 0 ? 'ASC' : 'DESC';
  }

  const response = await apiClient.get<{
    data: {
      entries: RecordWithContents[];
      totalcount: number;
    };
  }>(`${DATA_API_BASE}/databases/${databaseId}/entries`, {
    params: queryParams,
  });

  const { entries, totalcount } = response.data.data;
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? DEFAULT_PAGE_SIZE;

  return {
    records: entries.map((entry) => ({
      id: entry.id,
      userid: entry.userid,
      groupid: entry.groupid,
      dataid: entry.dataid,
      timecreated: entry.timecreated,
      timemodified: entry.timemodified,
      approved: entry.approved,
    })),
    pagination: {
      page,
      perPage,
      total: totalcount,
      totalPages: Math.ceil(totalcount / perPage),
    },
  };
}

/**
 * Fetches a single record by ID with all field contents.
 *
 * Retrieves complete record data including all field contents, user info,
 * and optionally ratings and comments if enabled on the database.
 *
 * @param databaseId - The database instance ID
 * @param recordId - The record ID to fetch
 * @returns Promise resolving to record with contents
 * @throws Error if record not found or access denied
 *
 * @example
 * ```typescript
 * const record = await getRecord(123, 456);
 * record.contents.forEach(content => {
 *   console.log(`Field ${content.fieldid}: ${content.content}`);
 * });
 * ```
 */
export async function getRecord(
  databaseId: number,
  recordId: number
): Promise<RecordWithContents> {
  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!recordId || recordId <= 0) {
    throw new Error('Invalid record ID provided');
  }

  const response = await apiClient.get<{ data: { entry: RecordWithContents } }>(
    `${DATA_API_BASE}/databases/${databaseId}/entries/${recordId}`
  );

  return response.data.data.entry;
}

/**
 * Creates a new record in a database activity.
 *
 * Submits a new entry with field values. The record may require approval
 * depending on database settings.
 *
 * @param params - Record creation parameters including field data
 * @returns Promise resolving to the created record ID
 * @throws Error if validation fails or user lacks permission
 *
 * @example
 * ```typescript
 * const recordId = await createRecord({
 *   databaseId: 123,
 *   data: [
 *     { fieldid: 1, value: 'John Doe' },
 *     { fieldid: 2, value: 'john@example.com' }
 *   ]
 * });
 * ```
 */
export async function createRecord(
  params: CreateRecordParams
): Promise<number> {
  const { databaseId, groupId = 0, data } = params;

  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!data || data.length === 0) {
    throw new Error('At least one field value must be provided');
  }

  const response = await apiClient.post<{ data: { newentryid: number } }>(
    `${DATA_API_BASE}/databases/${databaseId}/entries`,
    {
      groupid: groupId,
      data: data.map((item) => ({
        fieldid: item.fieldid,
        subfield: item.subfield ?? '',
        value: item.value,
      })),
    }
  );

  return response.data.data.newentryid;
}

/**
 * Updates an existing record in a database activity.
 *
 * Modifies field values for an existing entry. User must have edit
 * permission for the record.
 *
 * @param params - Record update parameters including field data
 * @returns Promise resolving when update is complete
 * @throws Error if validation fails, record not found, or permission denied
 *
 * @example
 * ```typescript
 * await updateRecord({
 *   databaseId: 123,
 *   recordId: 456,
 *   data: [
 *     { fieldid: 1, value: 'Jane Doe' }
 *   ]
 * });
 * ```
 */
export async function updateRecord(params: UpdateRecordParams): Promise<void> {
  const { databaseId, recordId, data } = params;

  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!recordId || recordId <= 0) {
    throw new Error('Invalid record ID provided');
  }
  if (!data || data.length === 0) {
    throw new Error('At least one field value must be provided');
  }

  await apiClient.put(`${DATA_API_BASE}/databases/${databaseId}/entries/${recordId}`, {
    data: data.map((item) => ({
      fieldid: item.fieldid,
      subfield: item.subfield ?? '',
      value: item.value,
    })),
  });
}

/**
 * Deletes a record from a database activity.
 *
 * Permanently removes a record and all its field contents. User must have
 * delete permission for the record.
 *
 * @param databaseId - The database instance ID
 * @param recordId - The record ID to delete
 * @returns Promise resolving when deletion is complete
 * @throws Error if record not found or permission denied
 *
 * @example
 * ```typescript
 * await deleteRecord(123, 456);
 * ```
 */
export async function deleteRecord(
  databaseId: number,
  recordId: number
): Promise<void> {
  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!recordId || recordId <= 0) {
    throw new Error('Invalid record ID provided');
  }

  await apiClient.delete(
    `${DATA_API_BASE}/databases/${databaseId}/entries/${recordId}`
  );
}

/**
 * Approves or unapproves a pending record.
 *
 * Changes the approval status of a record. Only users with approval
 * capability can perform this action.
 *
 * @param databaseId - The database instance ID
 * @param recordId - The record ID to approve/unapprove
 * @param approved - Whether to approve (true) or unapprove (false)
 * @returns Promise resolving when approval status is updated
 * @throws Error if record not found or user lacks approval permission
 *
 * @example
 * ```typescript
 * // Approve a pending record
 * await approveRecord(123, 456, true);
 *
 * // Unapprove a record
 * await approveRecord(123, 456, false);
 * ```
 */
export async function approveRecord(
  databaseId: number,
  recordId: number,
  approved: boolean = true
): Promise<void> {
  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!recordId || recordId <= 0) {
    throw new Error('Invalid record ID provided');
  }

  await apiClient.post(
    `${DATA_API_BASE}/databases/${databaseId}/entries/${recordId}/approve`,
    { approve: approved ? 1 : 0 }
  );
}

// ============================================================================
// Field Operations
// ============================================================================

/**
 * Fetches all field definitions for a database activity.
 *
 * Retrieves the complete list of fields with their types, settings, and
 * configuration parameters.
 *
 * @param databaseId - The database instance ID
 * @returns Promise resolving to array of field definitions
 * @throws Error if database not found or access denied
 *
 * @example
 * ```typescript
 * const fields = await getFields(123);
 * fields.forEach(field => {
 *   console.log(`${field.name} (${field.type})`);
 * });
 * ```
 */
export async function getFields(databaseId: number): Promise<DatabaseField[]> {
  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }

  const response = await apiClient.get<{ data: { fields: DatabaseField[] } }>(
    `${DATA_API_BASE}/databases/${databaseId}/fields`
  );

  return response.data.data.fields;
}

/**
 * Creates a new field in a database activity.
 *
 * Adds a new field definition to the database. Only users with template
 * management capability can create fields.
 *
 * @param params - Field creation parameters
 * @returns Promise resolving to the created field ID
 * @throws Error if validation fails or user lacks permission
 *
 * @example
 * ```typescript
 * const fieldId = await createField({
 *   databaseId: 123,
 *   type: FieldType.Text,
 *   name: 'Full Name',
 *   description: 'Enter your full name',
 *   required: true,
 *   param1: '100' // Max length
 * });
 * ```
 */
export async function createField(params: CreateFieldParams): Promise<number> {
  const { databaseId, type, name, description, required, ...additionalParams } =
    params;

  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!type) {
    throw new Error('Field type is required');
  }
  if (!name || name.trim().length === 0) {
    throw new Error('Field name is required');
  }

  const response = await apiClient.post<{ data: { fieldid: number } }>(
    `${DATA_API_BASE}/databases/${databaseId}/fields`,
    {
      type,
      name: name.trim(),
      description: description || '',
      required: required ? 1 : 0,
      ...additionalParams,
    }
  );

  return response.data.data.fieldid;
}

/**
 * Updates an existing field definition.
 *
 * Modifies field settings. Only users with template management capability
 * can update fields.
 *
 * @param params - Field update parameters
 * @returns Promise resolving when update is complete
 * @throws Error if field not found or user lacks permission
 *
 * @example
 * ```typescript
 * await updateField({
 *   databaseId: 123,
 *   fieldId: 1,
 *   name: 'Updated Field Name',
 *   required: false
 * });
 * ```
 */
export async function updateField(params: UpdateFieldParams): Promise<void> {
  const { databaseId, fieldId, ...updateData } = params;

  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!fieldId || fieldId <= 0) {
    throw new Error('Invalid field ID provided');
  }

  const hasUpdates = Object.values(updateData).some(
    (value) => value !== undefined
  );
  if (!hasUpdates) {
    throw new Error('At least one field property must be provided for update');
  }

  await apiClient.put(
    `${DATA_API_BASE}/databases/${databaseId}/fields/${fieldId}`,
    updateData
  );
}

/**
 * Deletes a field from a database activity.
 *
 * Permanently removes a field and all its content from all records.
 * Only users with template management capability can delete fields.
 *
 * @param databaseId - The database instance ID
 * @param fieldId - The field ID to delete
 * @returns Promise resolving when deletion is complete
 * @throws Error if field not found or user lacks permission
 *
 * @example
 * ```typescript
 * await deleteField(123, 1);
 * ```
 */
export async function deleteField(
  databaseId: number,
  fieldId: number
): Promise<void> {
  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!fieldId || fieldId <= 0) {
    throw new Error('Invalid field ID provided');
  }

  await apiClient.delete(
    `${DATA_API_BASE}/databases/${databaseId}/fields/${fieldId}`
  );
}

// ============================================================================
// Search Operations
// ============================================================================

/**
 * Searches records in a database with advanced filtering.
 *
 * Performs an advanced search across database records with support for
 * field-specific searches, full-text search, sorting, and pagination.
 *
 * @param databaseId - The database instance ID
 * @param criteria - Search criteria including filters, sort, and pagination
 * @returns Promise resolving to paginated search results
 * @throws Error if database not found or access denied
 *
 * @example
 * ```typescript
 * const results = await searchRecords(123, {
 *   search: 'john',
 *   advanced: { 1: 'john@example.com' }, // Search field 1 for email
 *   sort: { field: 2, direction: 1 }, // Sort by field 2, descending
 *   page: 1,
 *   perPage: 20
 * });
 * ```
 */
export async function searchRecords(
  databaseId: number,
  criteria: SearchCriteria
): Promise<DatabaseRecordsResponse> {
  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }

  const page = criteria.page ?? 1;
  const perPage = criteria.perPage ?? DEFAULT_PAGE_SIZE;

  const requestBody: Record<string, unknown> = {
    databaseid: databaseId,
    page: page - 1, // API uses 0-indexed pages
    perpage: perPage,
  };

  if (criteria.search) {
    requestBody.search = criteria.search;
  }

  if (criteria.sort) {
    requestBody.sort = criteria.sort.field;
    requestBody.order = criteria.sort.direction === 0 ? 'ASC' : 'DESC';
  }

  if (criteria.advanced && Object.keys(criteria.advanced).length > 0) {
    requestBody.advsearch = Object.entries(criteria.advanced).map(
      ([fieldId, value]) => ({
        name: `f_${fieldId}`,
        value,
      })
    );
  }

  const response = await apiClient.post<{
    data: {
      entries: RecordWithContents[];
      totalcount: number;
      maxcount: number;
    };
  }>(`${DATA_API_BASE}/databases/${databaseId}/search`, requestBody);

  const { entries, totalcount } = response.data.data;

  return {
    records: entries.map((entry) => ({
      id: entry.id,
      userid: entry.userid,
      groupid: entry.groupid,
      dataid: entry.dataid,
      timecreated: entry.timecreated,
      timemodified: entry.timemodified,
      approved: entry.approved,
    })),
    pagination: {
      page,
      perPage,
      total: totalcount,
      totalPages: Math.ceil(totalcount / perPage),
    },
  };
}

// ============================================================================
// Template Operations
// ============================================================================

/**
 * Fetches all templates for a database activity.
 *
 * Retrieves all template types (single, list, add, search, rss, css, js)
 * for the database.
 *
 * @param databaseId - The database instance ID
 * @returns Promise resolving to array of template data
 * @throws Error if database not found or access denied
 *
 * @example
 * ```typescript
 * const templates = await getTemplates(123);
 * const singleTemplate = templates.find(t => t.type === TemplateType.Single);
 * ```
 */
export async function getTemplates(
  databaseId: number
): Promise<TemplateData[]> {
  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }

  const response = await apiClient.get<{ data: { templates: TemplateData[] } }>(
    `${DATA_API_BASE}/databases/${databaseId}/templates`
  );

  return response.data.data.templates;
}

/**
 * Updates a template for a database activity.
 *
 * Modifies the HTML content of a specific template type. Only users with
 * template management capability can update templates.
 *
 * @param params - Template update parameters
 * @returns Promise resolving when update is complete
 * @throws Error if database not found or user lacks permission
 *
 * @example
 * ```typescript
 * await updateTemplate({
 *   databaseId: 123,
 *   templateType: TemplateType.Single,
 *   content: '<div class="entry">[[fieldname]]</div>'
 * });
 * ```
 */
export async function updateTemplate(
  params: UpdateTemplateParams
): Promise<void> {
  const { databaseId, templateType, content } = params;

  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!templateType) {
    throw new Error('Template type is required');
  }
  if (content === undefined || content === null || content === '') {
    throw new Error('Template content is required');
  }

  await apiClient.put(
    `${DATA_API_BASE}/databases/${databaseId}/templates/${templateType}`,
    { content }
  );
}

/**
 * Resets a template to its default content.
 *
 * Restores a template to the automatically generated default based on
 * current field definitions. Only users with template management
 * capability can reset templates.
 *
 * @param databaseId - The database instance ID
 * @param templateType - The template type to reset
 * @returns Promise resolving to the default template content
 * @throws Error if database not found or user lacks permission
 *
 * @example
 * ```typescript
 * const defaultContent = await resetTemplate(123, TemplateType.List);
 * ```
 */
export async function resetTemplate(
  databaseId: number,
  templateType: TemplateType
): Promise<string> {
  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!templateType) {
    throw new Error('Template type is required');
  }

  const response = await apiClient.post<{ data: { content: string } }>(
    `${DATA_API_BASE}/databases/${databaseId}/templates/${templateType}/reset`
  );

  return response.data.data.content;
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Uploads a file attachment to a record field.
 *
 * Uploads a file to be associated with a file or picture field in a record.
 * Supports standard browser File objects.
 *
 * @param params - File upload parameters
 * @returns Promise resolving to the uploaded file information
 * @throws Error if upload fails, record not found, or field type mismatch
 *
 * @example
 * ```typescript
 * const fileInput = document.querySelector('input[type="file"]');
 * const file = fileInput.files[0];
 *
 * const attachment = await uploadFile({
 *   databaseId: 123,
 *   recordId: 456,
 *   fieldId: 3,
 *   file
 * });
 * ```
 */
export async function uploadFile(
  params: UploadFileParams
): Promise<FileAttachment> {
  const { databaseId, recordId, fieldId, file } = params;

  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!recordId || recordId <= 0) {
    throw new Error('Invalid record ID provided');
  }
  if (!fieldId || fieldId <= 0) {
    throw new Error('Invalid field ID provided');
  }
  if (!file) {
    throw new Error('File is required');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('fieldid', String(fieldId));

  const response = await apiClient.post<{ data: { file: FileAttachment } }>(
    `${DATA_API_BASE}/databases/${databaseId}/entries/${recordId}/files`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data.data.file;
}

/**
 * Fetches all file attachments for a record.
 *
 * Retrieves a list of all files attached to fields in a specific record.
 *
 * @param databaseId - The database instance ID
 * @param recordId - The record ID
 * @returns Promise resolving to array of file attachments
 * @throws Error if record not found or access denied
 *
 * @example
 * ```typescript
 * const files = await getFiles(123, 456);
 * files.forEach(file => {
 *   console.log(`${file.filename} (${file.filesize} bytes)`);
 * });
 * ```
 */
export async function getFiles(
  databaseId: number,
  recordId: number
): Promise<FileAttachment[]> {
  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!recordId || recordId <= 0) {
    throw new Error('Invalid record ID provided');
  }

  const response = await apiClient.get<{ data: { files: FileAttachment[] } }>(
    `${DATA_API_BASE}/databases/${databaseId}/entries/${recordId}/files`
  );

  return response.data.data.files;
}

/**
 * Deletes a file attachment from a record.
 *
 * Removes a specific file attachment from a record field.
 *
 * @param databaseId - The database instance ID
 * @param recordId - The record ID
 * @param fileId - The file ID to delete
 * @returns Promise resolving when deletion is complete
 * @throws Error if file not found or user lacks permission
 *
 * @example
 * ```typescript
 * await deleteFile(123, 456, 789);
 * ```
 */
export async function deleteFile(
  databaseId: number,
  recordId: number,
  fileId: number
): Promise<void> {
  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!recordId || recordId <= 0) {
    throw new Error('Invalid record ID provided');
  }
  if (!fileId || fileId <= 0) {
    throw new Error('Invalid file ID provided');
  }

  await apiClient.delete(
    `${DATA_API_BASE}/databases/${databaseId}/entries/${recordId}/files/${fileId}`
  );
}

// ============================================================================
// Export/Import Operations
// ============================================================================

/**
 * Exports database records to a file format.
 *
 * Generates an export file in CSV, ODS, or XML format containing
 * selected records and fields.
 *
 * @param params - Export parameters including format and selection
 * @returns Promise resolving to export file download URL
 * @throws Error if database not found or user lacks export permission
 *
 * @example
 * ```typescript
 * const downloadUrl = await exportRecords({
 *   databaseId: 123,
 *   format: 'csv',
 *   fieldIds: [1, 2, 3] // Only export specific fields
 * });
 * window.open(downloadUrl, '_blank');
 * ```
 */
export async function exportRecords(
  params: ExportRecordsParams
): Promise<string> {
  const { databaseId, format, fieldIds, recordIds } = params;

  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!format || !['csv', 'ods', 'xml'].includes(format)) {
    throw new Error('Invalid export format. Must be csv, ods, or xml');
  }

  const response = await apiClient.post<{ data: { downloadurl: string } }>(
    `${DATA_API_BASE}/databases/${databaseId}/export`,
    {
      format,
      fieldids: fieldIds ?? [],
      recordids: recordIds ?? [],
    }
  );

  return response.data.data.downloadurl;
}

/**
 * Imports records from a file into the database.
 *
 * Processes a CSV, ODS, or XML file and creates new records in the database.
 *
 * @param params - Import parameters including file and options
 * @returns Promise resolving to import result with count of imported records
 * @throws Error if import fails, file invalid, or user lacks permission
 *
 * @example
 * ```typescript
 * const fileInput = document.querySelector('input[type="file"]');
 * const file = fileInput.files[0];
 *
 * const result = await importRecords({
 *   databaseId: 123,
 *   file,
 *   hasHeader: true,
 *   delimiter: ','
 * });
 * console.log(`Imported ${result.count} records`);
 * ```
 */
export async function importRecords(
  params: ImportRecordsParams
): Promise<{ count: number; warnings: string[] }> {
  const { databaseId, file, encoding = 'UTF-8', delimiter = ',', hasHeader = true } =
    params;

  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!file) {
    throw new Error('Import file is required');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('encoding', encoding);
  formData.append('delimiter', delimiter);
  formData.append('hasheader', hasHeader ? '1' : '0');

  const response = await apiClient.post<{
    data: { count: number; warnings: string[] };
  }>(`${DATA_API_BASE}/databases/${databaseId}/import`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.data;
}

// ============================================================================
// Rating and Comments Operations
// ============================================================================

/**
 * Rates a database record.
 *
 * Submits a rating for a record if ratings are enabled on the database.
 * The rating value must be within the configured scale range.
 *
 * @param params - Rating parameters
 * @returns Promise resolving to the new aggregate rating
 * @throws Error if ratings disabled, record not found, or invalid rating value
 *
 * @example
 * ```typescript
 * const newAggregate = await rateRecord({
 *   databaseId: 123,
 *   recordId: 456,
 *   rating: 5
 * });
 * console.log(`New average rating: ${newAggregate}`);
 * ```
 */
export async function rateRecord(
  params: RateRecordParams
): Promise<{ aggregate: number; count: number }> {
  const { databaseId, recordId, rating } = params;

  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!recordId || recordId <= 0) {
    throw new Error('Invalid record ID provided');
  }
  if (rating === undefined || rating === null) {
    throw new Error('Rating value is required');
  }

  const response = await apiClient.post<{
    data: { aggregate: number; count: number };
  }>(`${DATA_API_BASE}/databases/${databaseId}/entries/${recordId}/rate`, {
    rating,
  });

  return response.data.data;
}

/**
 * Adds a comment to a database record.
 *
 * Posts a new comment on a record if comments are enabled on the database.
 *
 * @param params - Comment parameters
 * @returns Promise resolving to the created comment
 * @throws Error if comments disabled, record not found, or content empty
 *
 * @example
 * ```typescript
 * const comment = await addComment({
 *   databaseId: 123,
 *   recordId: 456,
 *   content: 'Great entry! Very helpful information.'
 * });
 * ```
 */
export async function addComment(
  params: AddCommentParams
): Promise<RecordComment> {
  const { databaseId, recordId, content } = params;

  if (!databaseId || databaseId <= 0) {
    throw new Error('Invalid database ID provided');
  }
  if (!recordId || recordId <= 0) {
    throw new Error('Invalid record ID provided');
  }
  if (!content || content.trim().length === 0) {
    throw new Error('Comment content is required');
  }

  const response = await apiClient.post<{ data: { comment: RecordComment } }>(
    `${DATA_API_BASE}/databases/${databaseId}/entries/${recordId}/comments`,
    { content: content.trim() }
  );

  return response.data.data.comment;
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * Data Activity API namespace export
 *
 * Groups all API functions under a single namespace for convenient importing.
 *
 * @example
 * ```typescript
 * import dataApi from '@/features/activities/data/api/dataApi';
 *
 * const database = await dataApi.getDatabase(123);
 * const records = await dataApi.getRecords(123, { page: 1, perPage: 20 });
 * ```
 */
const dataApi = {
  // Database operations
  getDatabase,
  getDatabases,
  getDatabaseAccessInfo,

  // Record operations
  getRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  approveRecord,

  // Field operations
  getFields,
  createField,
  updateField,
  deleteField,

  // Search operations
  searchRecords,

  // Template operations
  getTemplates,
  updateTemplate,
  resetTemplate,

  // File operations
  uploadFile,
  getFiles,
  deleteFile,

  // Export/Import operations
  exportRecords,
  importRecords,

  // Rating and comments
  rateRecord,
  addComment,

  // Query keys for React Query
  queryKeys: dataQueryKeys,
};

export default dataApi;
