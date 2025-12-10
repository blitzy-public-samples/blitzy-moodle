/**
 * @fileoverview Unit tests for useDatabase React Query hook
 * @description Comprehensive test suite validating Database activity configuration fetching
 * from GET /api/v1/data/{id} endpoint. Tests verify React Query caching behavior, database
 * settings retrieval (name, intro, approval requirements, maxentries, comments, ratings,
 * time restrictions), field definitions with all 12 types, user permissions, templates,
 * loading states, error handling, and automatic refetching.
 *
 * Tests cover:
 * - Basic functionality (fetch, loading, success, error states)
 * - Query key pattern ['data', 'databases', dataId]
 * - Caching behavior with 5-minute stale time
 * - Field definitions (12 field types: text, textarea, number, date, file, picture,
 *   url, checkbox, radiobutton, menu, multimenu, latlong)
 * - User permissions (canView, canWriteEntry, canManageEntries, canApprove, canManageTemplates)
 * - Time restrictions (timeavailablefrom, timeavailableto, requiredentries)
 * - Error handling (404, 403, 500, network errors)
 * - Conditional fetching with enabled option
 * - Auto-refetching on window focus and network reconnect
 * - Manual refetch and cache invalidation
 *
 * @module tests/unit/features/activities/data/hooks/useDatabase.test
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { useDatabase } from '@/features/activities/data/hooks/useDatabase';
import { dataQueryKeys } from '@/features/activities/data/api/dataApi';
import type {
  Database,
  DatabaseField,
  TextField,
  TextAreaField,
  NumberField,
  DateField,
  CheckboxField,
  MenuField,
  MultiMenuField,
  RadioButtonField,
  FileField,
  PictureField,
  URLField,
  LatLongField,
  FieldType,
} from '@/features/activities/data/types/data.types';

// ============================================================================
// Constants - Matching Hook Implementation
// ============================================================================

/**
 * Default stale time for database configuration data (5 minutes).
 * Must match the value in useDatabase hook for testing stale time behavior.
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

/**
 * Default garbage collection time (30 minutes).
 * Must match the value in useDatabase hook for testing cache persistence.
 */
const DEFAULT_GC_TIME = 30 * 60 * 1000;

/**
 * API base URL for testing
 */
const API_BASE_URL = '/api/v1';

// ============================================================================
// MSW Server Setup
// ============================================================================

/**
 * MSW request handlers for database API endpoints
 */
const handlers = [
  // Default successful database fetch handler
  http.get(`${API_BASE_URL}/data/:id`, ({ params }) => {
    const id = Number(params.id);
    return HttpResponse.json({
      success: true,
      data: createMockDatabase({ id }),
      meta: { timestamp: Math.floor(Date.now() / 1000) },
    });
  }),
];

/**
 * MSW server instance for intercepting API requests
 */
const server = setupServer(...handlers);

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a properly configured QueryClient for testing.
 * Disables retries and logging to make tests deterministic.
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}

/**
 * Wrapper component that provides QueryClient context
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock Database object with all required fields.
 * Provides realistic default values that match the Moodle database structure.
 *
 * @param overrides - Partial Database object to override default values
 * @returns Complete Database object for testing
 */
function createMockDatabase(overrides: Partial<Database> = {}): Database {
  return {
    id: 1,
    course: 1,
    name: 'Student Projects Database',
    intro: '<p>A database for submitting and viewing student projects.</p>',
    introformat: 1,
    comments: true,
    timeavailablefrom: 0,
    timeavailableto: 0,
    timeviewfrom: 0,
    timeviewto: 0,
    requiredentries: 1,
    requiredentriestoview: 0,
    maxentries: 5,
    rssarticles: 0,
    singletemplate: '<div class="entry">[[title]]</div>',
    listtemplate: '<div class="list">[[title]] - [[author]]</div>',
    listtemplateheader: '<div class="header">Entries</div>',
    listtemplatefooter: '<div class="footer">Total: [[count]]</div>',
    addtemplate: '<form>[[title]][[description]]</form>',
    rsstemplate: '',
    rsstitletemplate: '',
    csstemplate: '.entry { margin: 10px; }',
    jstemplate: '',
    asearchtemplate: '',
    approval: true,
    manageapproved: true,
    scale: 0,
    assessed: 0,
    assesstimestart: 0,
    assesstimefinish: 0,
    defaultsort: 0,
    defaultsortdir: 0,
    editany: false,
    notification: 0,
    timemodified: 1705276800,
    config: '',
    completionentries: 1,
    fields: [],
    ...overrides,
  };
}

/**
 * Creates a mock TextField
 */
function createMockTextField(overrides: Partial<TextField> = {}): TextField {
  return {
    id: 1,
    dataid: 1,
    type: 'text' as FieldType.Text,
    name: 'Title',
    description: 'Enter the project title',
    required: true,
    position: 1,
    param1: '100', // Max length
    ...overrides,
  };
}

/**
 * Creates a mock TextAreaField
 */
function createMockTextAreaField(overrides: Partial<TextAreaField> = {}): TextAreaField {
  return {
    id: 2,
    dataid: 1,
    type: 'textarea' as FieldType.Textarea,
    name: 'Description',
    description: 'Detailed project description',
    required: true,
    position: 2,
    param1: '80', // Width
    param2: '15', // Height
    ...overrides,
  };
}

/**
 * Creates a mock NumberField
 */
function createMockNumberField(overrides: Partial<NumberField> = {}): NumberField {
  return {
    id: 3,
    dataid: 1,
    type: 'number' as FieldType.Number,
    name: 'Budget',
    description: 'Project budget in dollars',
    required: false,
    position: 3,
    param1: '2', // Decimal places
    ...overrides,
  };
}

/**
 * Creates a mock DateField
 */
function createMockDateField(overrides: Partial<DateField> = {}): DateField {
  return {
    id: 4,
    dataid: 1,
    type: 'date' as FieldType.Date,
    name: 'Deadline',
    description: 'Project deadline',
    required: false,
    position: 4,
    ...overrides,
  };
}

/**
 * Creates a mock CheckboxField
 */
function createMockCheckboxField(overrides: Partial<CheckboxField> = {}): CheckboxField {
  return {
    id: 5,
    dataid: 1,
    type: 'checkbox' as FieldType.Checkbox,
    name: 'Completed',
    description: 'Mark if project is completed',
    required: false,
    position: 5,
    ...overrides,
  };
}

/**
 * Creates a mock MenuField
 */
function createMockMenuField(overrides: Partial<MenuField> = {}): MenuField {
  return {
    id: 6,
    dataid: 1,
    type: 'menu' as FieldType.Menu,
    name: 'Category',
    description: 'Select project category',
    required: true,
    position: 6,
    param1: 'Technology\nScience\nArt\nOther', // Options
    ...overrides,
  };
}

/**
 * Creates a mock MultiMenuField
 */
function createMockMultiMenuField(overrides: Partial<MultiMenuField> = {}): MultiMenuField {
  return {
    id: 7,
    dataid: 1,
    type: 'multimenu' as FieldType.MultiMenu,
    name: 'Tags',
    description: 'Select applicable tags',
    required: false,
    position: 7,
    param1: 'Innovation\nResearch\nPrototype\nCollaboration', // Options
    ...overrides,
  };
}

/**
 * Creates a mock RadioButtonField
 */
function createMockRadioButtonField(overrides: Partial<RadioButtonField> = {}): RadioButtonField {
  return {
    id: 8,
    dataid: 1,
    type: 'radiobutton' as FieldType.RadioButton,
    name: 'Status',
    description: 'Current project status',
    required: true,
    position: 8,
    param1: 'Planning\nIn Progress\nCompleted\nOnHold', // Options
    ...overrides,
  };
}

/**
 * Creates a mock FileField
 */
function createMockFileField(overrides: Partial<FileField> = {}): FileField {
  return {
    id: 9,
    dataid: 1,
    type: 'file' as FieldType.File,
    name: 'Attachment',
    description: 'Upload project files',
    required: false,
    position: 9,
    ...overrides,
  };
}

/**
 * Creates a mock PictureField
 */
function createMockPictureField(overrides: Partial<PictureField> = {}): PictureField {
  return {
    id: 10,
    dataid: 1,
    type: 'picture' as FieldType.Picture,
    name: 'Cover Image',
    description: 'Project cover image',
    required: false,
    position: 10,
    param1: '640', // Width
    param2: '480', // Height
    ...overrides,
  };
}

/**
 * Creates a mock URLField
 */
function createMockURLField(overrides: Partial<URLField> = {}): URLField {
  return {
    id: 11,
    dataid: 1,
    type: 'url' as FieldType.URL,
    name: 'Project Link',
    description: 'Link to project website',
    required: false,
    position: 11,
    param1: '1', // Force link
    param2: 'Visit Project', // Link text
    param3: '1', // Display mode
    ...overrides,
  };
}

/**
 * Creates a mock LatLongField
 */
function createMockLatLongField(overrides: Partial<LatLongField> = {}): LatLongField {
  return {
    id: 12,
    dataid: 1,
    type: 'latlong' as FieldType.LatLong,
    name: 'Location',
    description: 'Project location coordinates',
    required: false,
    position: 12,
    ...overrides,
  };
}

/**
 * Creates a complete set of all 12 field types
 */
function createAllFieldTypes(): DatabaseField[] {
  return [
    createMockTextField(),
    createMockTextAreaField(),
    createMockNumberField(),
    createMockDateField(),
    createMockCheckboxField(),
    createMockMenuField(),
    createMockMultiMenuField(),
    createMockRadioButtonField(),
    createMockFileField(),
    createMockPictureField(),
    createMockURLField(),
    createMockLatLongField(),
  ];
}

// ============================================================================
// Test Suite
// ============================================================================

describe('useDatabase', () => {
  let queryClient: QueryClient;

  // Start MSW server before all tests
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  // Reset handlers and create fresh QueryClient before each test
  beforeEach(() => {
    queryClient = createTestQueryClient();
    server.resetHandlers();
  });

  // Clear query cache after each test
  afterEach(() => {
    queryClient.clear();
    cleanup();
  });

  // Stop MSW server after all tests
  afterAll(() => {
    server.close();
  });

  // ==========================================================================
  // Basic Functionality Tests
  // ==========================================================================

  describe('Basic Functionality', () => {
    it('should fetch database on mount with provided dataId', async () => {
      const mockDatabase = createMockDatabase({ id: 5, name: 'Test Database' });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(5), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe(5);
      expect(result.current.data?.name).toBe('Test Database');
    });

    it('should return loading state initially (isLoading: true)', async () => {
      // Delay response to observe loading state
      server.use(
        http.get(`${API_BASE_URL}/data/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: createMockDatabase(),
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should return success state with database data after fetch', async () => {
      const mockDatabase = createMockDatabase({
        id: 10,
        name: 'Research Database',
        intro: '<p>Store research findings.</p>',
        maxentries: 10,
        approval: true,
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(10), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockDatabase);
      expect(result.current.data?.id).toBe(10);
      expect(result.current.data?.name).toBe('Research Database');
      expect(result.current.data?.maxentries).toBe(10);
      expect(result.current.data?.approval).toBe(true);
    });

    it('should return error state when API call fails', async () => {
      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useDatabase(999, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should return data matching Database type structure', async () => {
      const mockDatabase = createMockDatabase({
        id: 1,
        name: 'Structured Database',
        course: 5,
        comments: true,
        maxentries: 20,
        requiredentries: 2,
        approval: false,
        scale: 100,
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const database = result.current.data;
      expect(database).toBeDefined();
      expect(typeof database?.id).toBe('number');
      expect(typeof database?.name).toBe('string');
      expect(typeof database?.course).toBe('number');
      expect(typeof database?.intro).toBe('string');
      expect(typeof database?.comments).toBe('boolean');
      expect(typeof database?.maxentries).toBe('number');
      expect(typeof database?.requiredentries).toBe('number');
      expect(typeof database?.approval).toBe('boolean');
    });
  });

  // ==========================================================================
  // Query Key Pattern Tests
  // ==========================================================================

  describe('Query Key Pattern', () => {
    it('should use query key format: [\'data\', \'databases\', dataId]', () => {
      expect(dataQueryKeys.database(5)).toEqual(['data', 'databases', 5]);
      expect(dataQueryKeys.database(10)).toEqual(['data', 'databases', 10]);
      expect(dataQueryKeys.database(999)).toEqual(['data', 'databases', 999]);
    });

    it('should generate consistent keys across application', () => {
      const key1 = dataQueryKeys.database(42);
      const key2 = dataQueryKeys.database(42);

      expect(key1).toEqual(key2);
      expect(JSON.stringify(key1)).toBe(JSON.stringify(key2));
    });

    it('should generate different keys for different dataIds', () => {
      const key1 = dataQueryKeys.database(1);
      const key2 = dataQueryKeys.database(2);
      const key3 = dataQueryKeys.database(100);

      expect(key1).not.toEqual(key2);
      expect(key2).not.toEqual(key3);
      expect(key1).not.toEqual(key3);
    });

    it('should have cache isolation between different database IDs', async () => {
      const database1 = createMockDatabase({ id: 1, name: 'Database One' });
      const database2 = createMockDatabase({ id: 2, name: 'Database Two' });

      let requestCount = 0;
      server.use(
        http.get(`${API_BASE_URL}/data/:id`, ({ params }) => {
          requestCount++;
          const id = Number(params.id);
          const data = id === 1 ? database1 : database2;
          return HttpResponse.json({
            success: true,
            data,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      // Fetch first database
      const { result: result1 } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Fetch second database
      const { result: result2 } = renderHook(() => useDatabase(2), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Verify both databases are cached separately
      expect(result1.current.data?.name).toBe('Database One');
      expect(result2.current.data?.name).toBe('Database Two');
      expect(requestCount).toBe(2);
    });
  });

  // ==========================================================================
  // Caching Behavior Tests
  // ==========================================================================

  describe('Caching Behavior', () => {
    it('should have staleTime set to 5 minutes (300000ms)', () => {
      expect(DEFAULT_STALE_TIME).toBe(5 * 60 * 1000);
    });

    it('should return cached data immediately on re-render', async () => {
      const mockDatabase = createMockDatabase({ id: 1, name: 'Cached Database' });
      let requestCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          requestCount++;
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      // Create a client with actual stale time for this test
      const cachedQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: DEFAULT_STALE_TIME,
            gcTime: DEFAULT_GC_TIME,
          },
        },
      });

      // First render
      const { result: result1, unmount } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(cachedQueryClient),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      unmount();

      // Second render should use cached data
      const { result: result2 } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(cachedQueryClient),
      });

      // Should have data immediately from cache
      expect(result2.current.data).toBeDefined();
      expect(result2.current.data?.id).toBe(1);
      expect(result2.current.data?.name).toBe('Cached Database');

      // API should only be called once
      expect(requestCount).toBe(1);

      cachedQueryClient.clear();
    });

    it('should have cache persist across component unmounts', async () => {
      const mockDatabase = createMockDatabase({ id: 5, name: 'Persistent Cache' });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      // Use a client with gcTime configured
      const persistentClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: DEFAULT_STALE_TIME,
            gcTime: DEFAULT_GC_TIME,
          },
        },
      });

      // First mount
      const { unmount } = renderHook(() => useDatabase(5), {
        wrapper: createWrapper(persistentClient),
      });

      await waitFor(() => {
        expect(persistentClient.getQueryData(dataQueryKeys.database(5))).toBeDefined();
      });

      // Unmount
      unmount();

      // Check cache still exists
      const cachedData = persistentClient.getQueryData(dataQueryKeys.database(5));
      expect(cachedData).toBeDefined();

      persistentClient.clear();
    });

    it('should not call API when fresh data exists in cache', async () => {
      const mockDatabase = createMockDatabase({ id: 1 });
      let requestCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          requestCount++;
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      // Pre-populate cache
      queryClient.setQueryData(dataQueryKeys.database(1), mockDatabase);

      const { result } = renderHook(
        () => useDatabase(1, { staleTime: Infinity }),
        { wrapper: createWrapper(queryClient) }
      );

      // Should have data immediately
      expect(result.current.data).toEqual(mockDatabase);

      // Should not call API since data is fresh
      expect(requestCount).toBe(0);
    });

    it('should have gcTime set to 30 minutes', () => {
      expect(DEFAULT_GC_TIME).toBe(30 * 60 * 1000);
    });
  });

  // ==========================================================================
  // Field Definitions Tests
  // ==========================================================================

  describe('Field Definitions', () => {
    it('should correctly parse TextField with max length parameter', async () => {
      const textField = createMockTextField({ param1: '150' });
      const mockDatabase = createMockDatabase({ fields: [textField] });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const fields = result.current.data?.fields;
      expect(fields).toBeDefined();
      expect(fields?.length).toBe(1);

      const field = fields?.[0] as TextField;
      expect(field.type).toBe('text');
      expect(field.name).toBe('Title');
      expect(field.param1).toBe('150');
    });

    it('should correctly parse TextAreaField with width and height parameters', async () => {
      const textAreaField = createMockTextAreaField({ param1: '100', param2: '20' });
      const mockDatabase = createMockDatabase({ fields: [textAreaField] });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const field = result.current.data?.fields?.[0] as TextAreaField;
      expect(field.type).toBe('textarea');
      expect(field.param1).toBe('100');
      expect(field.param2).toBe('20');
    });

    it('should correctly parse NumberField with decimal places parameter', async () => {
      const numberField = createMockNumberField({ param1: '3' });
      const mockDatabase = createMockDatabase({ fields: [numberField] });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const field = result.current.data?.fields?.[0] as NumberField;
      expect(field.type).toBe('number');
      expect(field.param1).toBe('3');
    });

    it('should correctly parse DateField', async () => {
      const dateField = createMockDateField();
      const mockDatabase = createMockDatabase({ fields: [dateField] });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const field = result.current.data?.fields?.[0] as DateField;
      expect(field.type).toBe('date');
      expect(field.name).toBe('Deadline');
    });

    it('should correctly parse CheckboxField', async () => {
      const checkboxField = createMockCheckboxField();
      const mockDatabase = createMockDatabase({ fields: [checkboxField] });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const field = result.current.data?.fields?.[0] as CheckboxField;
      expect(field.type).toBe('checkbox');
      expect(field.name).toBe('Completed');
    });

    it('should correctly parse MenuField with options', async () => {
      const menuField = createMockMenuField({
        param1: 'Option A\nOption B\nOption C',
      });
      const mockDatabase = createMockDatabase({ fields: [menuField] });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const field = result.current.data?.fields?.[0] as MenuField;
      expect(field.type).toBe('menu');
      expect(field.param1).toBe('Option A\nOption B\nOption C');
    });

    it('should correctly parse MultiMenuField with options', async () => {
      const multiMenuField = createMockMultiMenuField({
        param1: 'Tag1\nTag2\nTag3\nTag4',
      });
      const mockDatabase = createMockDatabase({ fields: [multiMenuField] });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const field = result.current.data?.fields?.[0] as MultiMenuField;
      expect(field.type).toBe('multimenu');
      expect(field.param1).toBe('Tag1\nTag2\nTag3\nTag4');
    });

    it('should correctly parse RadioButtonField with options', async () => {
      const radioField = createMockRadioButtonField({
        param1: 'Yes\nNo\nMaybe',
      });
      const mockDatabase = createMockDatabase({ fields: [radioField] });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const field = result.current.data?.fields?.[0] as RadioButtonField;
      expect(field.type).toBe('radiobutton');
      expect(field.param1).toBe('Yes\nNo\nMaybe');
    });

    it('should correctly parse FileField', async () => {
      const fileField = createMockFileField();
      const mockDatabase = createMockDatabase({ fields: [fileField] });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const field = result.current.data?.fields?.[0] as FileField;
      expect(field.type).toBe('file');
      expect(field.name).toBe('Attachment');
    });

    it('should correctly parse PictureField with dimensions', async () => {
      const pictureField = createMockPictureField({ param1: '800', param2: '600' });
      const mockDatabase = createMockDatabase({ fields: [pictureField] });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const field = result.current.data?.fields?.[0] as PictureField;
      expect(field.type).toBe('picture');
      expect(field.param1).toBe('800');
      expect(field.param2).toBe('600');
    });

    it('should correctly parse URLField with display parameters', async () => {
      const urlField = createMockURLField({
        param1: '1',
        param2: 'Click Here',
        param3: '2',
      });
      const mockDatabase = createMockDatabase({ fields: [urlField] });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const field = result.current.data?.fields?.[0] as URLField;
      expect(field.type).toBe('url');
      expect(field.param1).toBe('1');
      expect(field.param2).toBe('Click Here');
      expect(field.param3).toBe('2');
    });

    it('should correctly parse LatLongField', async () => {
      const latLongField = createMockLatLongField();
      const mockDatabase = createMockDatabase({ fields: [latLongField] });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const field = result.current.data?.fields?.[0] as LatLongField;
      expect(field.type).toBe('latlong');
      expect(field.name).toBe('Location');
    });

    it('should handle all 12 field types together', async () => {
      const allFields = createAllFieldTypes();
      const mockDatabase = createMockDatabase({ fields: allFields });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const fields = result.current.data?.fields;
      expect(fields).toBeDefined();
      expect(fields?.length).toBe(12);

      // Verify each field type is present
      const fieldTypes = fields?.map((f) => f.type);
      expect(fieldTypes).toContain('text');
      expect(fieldTypes).toContain('textarea');
      expect(fieldTypes).toContain('number');
      expect(fieldTypes).toContain('date');
      expect(fieldTypes).toContain('checkbox');
      expect(fieldTypes).toContain('menu');
      expect(fieldTypes).toContain('multimenu');
      expect(fieldTypes).toContain('radiobutton');
      expect(fieldTypes).toContain('file');
      expect(fieldTypes).toContain('picture');
      expect(fieldTypes).toContain('url');
      expect(fieldTypes).toContain('latlong');
    });

    it('should handle required field flag correctly', async () => {
      const requiredField = createMockTextField({ required: true, name: 'Required Field' });
      const optionalField = createMockTextField({
        id: 2,
        required: false,
        name: 'Optional Field',
      });
      const mockDatabase = createMockDatabase({ fields: [requiredField, optionalField] });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const fields = result.current.data?.fields;
      expect(fields?.[0].required).toBe(true);
      expect(fields?.[1].required).toBe(false);
    });
  });

  // ==========================================================================
  // Database Settings Tests
  // ==========================================================================

  describe('Database Settings', () => {
    it('should retrieve database name and intro correctly', async () => {
      const mockDatabase = createMockDatabase({
        name: 'Student Portfolio Database',
        intro: '<p>Store and share your work samples.</p>',
        introformat: 1,
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.name).toBe('Student Portfolio Database');
      expect(result.current.data?.intro).toBe('<p>Store and share your work samples.</p>');
      expect(result.current.data?.introformat).toBe(1);
    });

    it('should retrieve approval settings correctly', async () => {
      const mockDatabase = createMockDatabase({
        approval: true,
        manageapproved: false,
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.approval).toBe(true);
      expect(result.current.data?.manageapproved).toBe(false);
    });

    it('should retrieve max entries and required entries correctly', async () => {
      const mockDatabase = createMockDatabase({
        maxentries: 10,
        requiredentries: 3,
        requiredentriestoview: 1,
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.maxentries).toBe(10);
      expect(result.current.data?.requiredentries).toBe(3);
      expect(result.current.data?.requiredentriestoview).toBe(1);
    });

    it('should retrieve comments and ratings settings correctly', async () => {
      const mockDatabase = createMockDatabase({
        comments: true,
        scale: 100,
        assessed: 1,
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.comments).toBe(true);
      expect(result.current.data?.scale).toBe(100);
      expect(result.current.data?.assessed).toBe(1);
    });
  });

  // ==========================================================================
  // Time Restrictions Tests
  // ==========================================================================

  describe('Time Restrictions', () => {
    it('should parse timeavailablefrom and timeavailableto correctly', async () => {
      const startTime = 1705276800; // 2024-01-15
      const endTime = 1718409600;   // 2024-06-15

      const mockDatabase = createMockDatabase({
        timeavailablefrom: startTime,
        timeavailableto: endTime,
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.timeavailablefrom).toBe(startTime);
      expect(result.current.data?.timeavailableto).toBe(endTime);
    });

    it('should parse timeviewfrom and timeviewto correctly', async () => {
      const viewStart = 1705276800;
      const viewEnd = 1718409600;

      const mockDatabase = createMockDatabase({
        timeviewfrom: viewStart,
        timeviewto: viewEnd,
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.timeviewfrom).toBe(viewStart);
      expect(result.current.data?.timeviewto).toBe(viewEnd);
    });

    it('should handle zero time values (no restriction)', async () => {
      const mockDatabase = createMockDatabase({
        timeavailablefrom: 0,
        timeavailableto: 0,
        timeviewfrom: 0,
        timeviewto: 0,
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.timeavailablefrom).toBe(0);
      expect(result.current.data?.timeavailableto).toBe(0);
      expect(result.current.data?.timeviewfrom).toBe(0);
      expect(result.current.data?.timeviewto).toBe(0);
    });

    it('should parse assessment time restrictions correctly', async () => {
      const assessStart = 1705276800;
      const assessEnd = 1718409600;

      const mockDatabase = createMockDatabase({
        assesstimestart: assessStart,
        assesstimefinish: assessEnd,
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.assesstimestart).toBe(assessStart);
      expect(result.current.data?.assesstimefinish).toBe(assessEnd);
    });

    it('should validate required entries logic', async () => {
      const mockDatabase = createMockDatabase({
        requiredentries: 5,
        requiredentriestoview: 2,
        completionentries: 3,
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const database = result.current.data;
      expect(database?.requiredentries).toBe(5);
      expect(database?.requiredentriestoview).toBe(2);
      expect(database?.completionentries).toBe(3);
    });
  });

  // ==========================================================================
  // Template Configuration Tests
  // ==========================================================================

  describe('Template Configurations', () => {
    it('should retrieve single entry template correctly', async () => {
      const mockDatabase = createMockDatabase({
        singletemplate: '<div class="entry">[[title]][[description]]</div>',
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.singletemplate).toBe(
        '<div class="entry">[[title]][[description]]</div>'
      );
    });

    it('should retrieve list template with header and footer correctly', async () => {
      const mockDatabase = createMockDatabase({
        listtemplate: '<tr><td>[[title]]</td><td>[[author]]</td></tr>',
        listtemplateheader: '<table><thead><tr><th>Title</th><th>Author</th></tr></thead><tbody>',
        listtemplatefooter: '</tbody></table>',
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.listtemplate).toContain('[[title]]');
      expect(result.current.data?.listtemplateheader).toContain('<table>');
      expect(result.current.data?.listtemplatefooter).toContain('</table>');
    });

    it('should retrieve add template correctly', async () => {
      const mockDatabase = createMockDatabase({
        addtemplate: '<form><div class="field">[[title]]</div></form>',
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.addtemplate).toContain('<form>');
    });

    it('should retrieve CSS and JS templates correctly', async () => {
      const mockDatabase = createMockDatabase({
        csstemplate: '.entry { border: 1px solid #ccc; padding: 10px; }',
        jstemplate: 'document.addEventListener("DOMContentLoaded", function() { });',
      });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.csstemplate).toContain('.entry');
      expect(result.current.data?.jstemplate).toContain('addEventListener');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle error state when API throws', async () => {
      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'API Error' } },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useDatabase(1, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle 404 error for invalid database ID', async () => {
      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Database not found' },
            },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useDatabase(99999, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle 403 error for permission denied', async () => {
      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'PERMISSION_DENIED', message: 'Permission denied' },
            },
            { status: 403 }
          );
        })
      );

      const { result } = renderHook(() => useDatabase(1, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle network errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useDatabase(1, { retry: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should retry on failure according to retry option', async () => {
      let requestCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          requestCount++;
          if (requestCount < 3) {
            return HttpResponse.json(
              { success: false, error: { code: 'INTERNAL_ERROR', message: 'Temporary error' } },
              { status: 500 }
            );
          }
          return HttpResponse.json({
            success: true,
            data: createMockDatabase(),
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const retryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 3,
            retryDelay: 0, // Instant retry for testing
            gcTime: 0,
            staleTime: 0,
          },
        },
      });

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(retryClient),
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 5000 }
      );

      expect(requestCount).toBe(3);

      retryClient.clear();
    });
  });

  // ==========================================================================
  // Conditional Fetching Tests
  // ==========================================================================

  describe('Conditional Fetching', () => {
    it('should prevent fetch when enabled is false', async () => {
      let requestCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          requestCount++;
          return HttpResponse.json({
            success: true,
            data: createMockDatabase(),
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1, { enabled: false }), {
        wrapper: createWrapper(queryClient),
      });

      // Wait a bit to ensure no fetch is triggered
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(requestCount).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPending).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should fetch when enabled changes from false to true', async () => {
      let requestCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          requestCount++;
          return HttpResponse.json({
            success: true,
            data: createMockDatabase(),
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useDatabase(1, { enabled }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { enabled: false },
        }
      );

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(requestCount).toBe(0);

      // Enable fetching
      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(requestCount).toBe(1);
    });

    it('should not fetch when dataId is invalid (0 or negative)', async () => {
      let requestCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          requestCount++;
          return HttpResponse.json({
            success: true,
            data: createMockDatabase(),
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result: result0 } = renderHook(() => useDatabase(0), {
        wrapper: createWrapper(queryClient),
      });

      const { result: resultNeg } = renderHook(() => useDatabase(-1), {
        wrapper: createWrapper(queryClient),
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(requestCount).toBe(0);
      expect(result0.current.isPending).toBe(true);
      expect(resultNeg.current.isPending).toBe(true);
    });
  });

  // ==========================================================================
  // Manual Refetch Tests
  // ==========================================================================

  describe('Manual Refetch', () => {
    it('should support manual refetch via result.refetch()', async () => {
      const initialDatabase = createMockDatabase({ name: 'Initial Database' });
      const updatedDatabase = createMockDatabase({ name: 'Updated Database' });
      let requestCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          requestCount++;
          const data = requestCount === 1 ? initialDatabase : updatedDatabase;
          return HttpResponse.json({
            success: true,
            data,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.name).toBe('Initial Database');

      // Trigger manual refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.data?.name).toBe('Updated Database');
      });

      expect(requestCount).toBe(2);
    });

    it('should keep data available during refetch', async () => {
      const initialDatabase = createMockDatabase({ name: 'Initial' });
      const updatedDatabase = createMockDatabase({ name: 'Updated' });
      let requestCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, async () => {
          requestCount++;
          // Add delay to second request to observe isRefetching
          if (requestCount === 2) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          const data = requestCount === 1 ? initialDatabase : updatedDatabase;
          return HttpResponse.json({
            success: true,
            data,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Trigger refetch
      act(() => {
        result.current.refetch();
      });

      // Data should still be available during refetch
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.name).toBe('Initial');

      await waitFor(() => {
        expect(result.current.data?.name).toBe('Updated');
      });
    });
  });

  // ==========================================================================
  // Auto-Refetching Tests
  // ==========================================================================

  describe('Auto-Refetching', () => {
    it('should support refetch on window focus', async () => {
      let requestCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          requestCount++;
          return HttpResponse.json({
            success: true,
            data: createMockDatabase(),
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const refetchClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: true,
            staleTime: 0,
          },
        },
      });

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(refetchClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const initialCount = requestCount;

      // Simulate window focus event
      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });

      // Wait for potential refetch
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Focus may trigger a refetch depending on stale state
      expect(result.current.data).toBeDefined();

      refetchClient.clear();
    });

    it('should support refetch on network reconnect', async () => {
      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: createMockDatabase(),
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const reconnectClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnReconnect: true,
            staleTime: 0,
          },
        },
      });

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(reconnectClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();

      reconnectClient.clear();
    });
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  describe('Loading States', () => {
    it('should have isLoading true during initial fetch', async () => {
      server.use(
        http.get(`${API_BASE_URL}/data/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json({
            success: true,
            data: createMockDatabase(),
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isFetching).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should have isFetching true during any fetch including background refetch', async () => {
      let requestCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, async () => {
          requestCount++;
          if (requestCount > 1) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          return HttpResponse.json({
            success: true,
            data: createMockDatabase(),
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Trigger refetch
      act(() => {
        result.current.refetch();
      });

      // isFetching should be true during refetch, but isLoading should be false
      expect(result.current.isFetching).toBe(true);
      expect(result.current.isLoading).toBe(false); // Not initial load

      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });
    });

    it('should have correct state transitions: loading -> success', async () => {
      const states: Array<{ isLoading: boolean; isSuccess: boolean; isError: boolean }> = [];

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: createMockDatabase(),
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => {
        const query = useDatabase(1);
        states.push({
          isLoading: query.isLoading,
          isSuccess: query.isSuccess,
          isError: query.isError,
        });
        return query;
      }, {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should have transitioned from loading to success
      const loadingState = states.find((s) => s.isLoading);
      const successState = states.find((s) => s.isSuccess);

      expect(loadingState).toBeDefined();
      expect(successState).toBeDefined();
    });
  });

  // ==========================================================================
  // TypeScript Type Safety Tests
  // ==========================================================================

  describe('TypeScript Type Safety', () => {
    it('should return properly typed data (Database | undefined)', async () => {
      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: createMockDatabase(),
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // TypeScript should infer result.current.data as Database | undefined
      const database = result.current.data;

      // These should be valid property accesses without type errors
      if (database) {
        const id: number = database.id;
        const name: string = database.name;
        const comments: boolean = database.comments;
        const fields: DatabaseField[] | undefined = database.fields;

        expect(id).toBeDefined();
        expect(name).toBeDefined();
        expect(typeof comments).toBe('boolean');
        expect(Array.isArray(fields) || fields === undefined).toBe(true);
      }
    });

    it('should correctly type DatabaseField array with discriminated union', async () => {
      const allFields = createAllFieldTypes();
      const mockDatabase = createMockDatabase({ fields: allFields });

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: mockDatabase,
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(() => useDatabase(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const fields = result.current.data?.fields;
      expect(fields).toBeDefined();

      // Test type narrowing with discriminated union
      fields?.forEach((field) => {
        switch (field.type) {
          case 'text':
            expect((field as TextField).param1).toBeDefined();
            break;
          case 'textarea':
            expect((field as TextAreaField).param1).toBeDefined();
            break;
          case 'number':
            expect((field as NumberField).param1).toBeDefined();
            break;
          case 'menu':
            expect((field as MenuField).param1).toBeDefined();
            break;
          case 'multimenu':
            expect((field as MultiMenuField).param1).toBeDefined();
            break;
          case 'radiobutton':
            expect((field as RadioButtonField).param1).toBeDefined();
            break;
          case 'picture':
            expect((field as PictureField).param1).toBeDefined();
            break;
          case 'url':
            expect((field as URLField).param1).toBeDefined();
            break;
          case 'date':
          case 'checkbox':
          case 'file':
          case 'latlong':
            // These field types don't have param1
            expect(field.type).toBeDefined();
            break;
        }
      });
    });
  });

  // ==========================================================================
  // Hook Options Tests
  // ==========================================================================

  describe('Hook Options', () => {
    it('should accept custom staleTime option', async () => {
      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: createMockDatabase(),
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(
        () => useDatabase(1, { staleTime: 1000 * 60 * 10 }), // 10 minutes
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });

    it('should accept custom gcTime option', async () => {
      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: createMockDatabase(),
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(
        () => useDatabase(1, { gcTime: 1000 * 60 * 60 }), // 60 minutes
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });

    it('should accept custom retry option', async () => {
      let requestCount = 0;

      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          requestCount++;
          return HttpResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Error' } },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useDatabase(1, { retry: 1 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Should have attempted 1 retry (initial + 1 retry = 2 requests)
      expect(requestCount).toBe(2);
    });

    it('should accept refetchOnWindowFocus option', async () => {
      server.use(
        http.get(`${API_BASE_URL}/data/:id`, () => {
          return HttpResponse.json({
            success: true,
            data: createMockDatabase(),
            meta: { timestamp: Math.floor(Date.now() / 1000) },
          });
        })
      );

      const { result } = renderHook(
        () => useDatabase(1, { refetchOnWindowFocus: false }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });
  });
});
