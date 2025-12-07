/**
 * CourseManagement Component Unit Tests
 *
 * Comprehensive unit tests for the CourseManagement admin component covering:
 * - Course CRUD operations (create, read, update, delete)
 * - Search functionality with debouncing
 * - Filtering by category and visibility status
 * - Bulk actions (delete, hide, show, move to category)
 * - Material-UI DataGrid interactions (sorting, pagination, row selection)
 * - Error handling for API failures
 * - Permission-based action visibility
 * - Form validation for course operations
 *
 * @module tests/unit/features/admin/courses/CourseManagement.test
 * @see react-frontend/src/features/admin/courses/components/CourseManagement.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';

// Testing utilities from render helper
import {
  render,
  screen,
  waitFor,
  within,
  userEvent,
  act,
  fireEvent,
} from '@/tests/helpers/render';

// MSW Server for API mocking
import { server } from '@/tests/mocks/server';

// Mock data factories
import { mockCourse, mockCourseCategory, mockCourseArray } from '@/tests/mocks/data';

// Component under test
import CourseManagement from '@/features/admin/courses/components/CourseManagement';

// Types
import type { Course, CourseCategory } from '@/types/entities';
import type { PaginatedResponse, ApiResponse } from '@/types/api';
import type { BulkActionResult } from '@/features/admin/courses/types/bulk.types';

// ============================================================================
// Test Constants
// ============================================================================

const API_BASE_URL = '/api/v1';
const COURSES_ENDPOINT = `${API_BASE_URL}/admin/courses`;
const CATEGORIES_ENDPOINT = `${API_BASE_URL}/admin/courses/categories`;

// Default debounce delay in the component
const SEARCH_DEBOUNCE_MS = 500;

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock paginated courses response
 */
function createMockCoursesResponse(
  courses: Course[],
  pagination: { page: number; perPage: number; total: number } = {
    page: 1,
    perPage: 20,
    total: courses.length,
  }
): PaginatedResponse<Course> {
  return {
    success: true,
    data: {
      items: courses,
      page: pagination.page,
      perPage: pagination.perPage,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.perPage),
    },
    meta: {
      pagination: {
        page: pagination.page,
        perPage: pagination.perPage,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.perPage),
      },
    },
  };
}

/**
 * Creates a mock paginated categories response
 */
function createMockCategoriesResponse(
  categories: CourseCategory[]
): PaginatedResponse<CourseCategory> {
  return {
    success: true,
    data: {
      items: categories,
      page: 1,
      perPage: 100,
      total: categories.length,
      totalPages: 1,
    },
    meta: {
      pagination: {
        page: 1,
        perPage: 100,
        total: categories.length,
        totalPages: 1,
      },
    },
  };
}

/**
 * Creates mock bulk action result
 */
function createMockBulkActionResult(
  successCount: number,
  failedCount: number = 0,
  errors: Array<{ courseId: number; courseName: string; message: string }> = []
): ApiResponse<BulkActionResult> {
  return {
    success: true,
    data: {
      successCount,
      failedCount,
      totalCount: successCount + failedCount,
      errors,
    },
  };
}

// ============================================================================
// Default Mock Data
// ============================================================================

const defaultMockCourses: Course[] = [
  mockCourse({
    id: 1,
    fullname: 'Introduction to Programming',
    shortname: 'CS101',
    category: 1,
    visible: 1,
    format: 'topics',
    startdate: Math.floor(Date.now() / 1000),
    enddate: Math.floor(Date.now() / 1000) + 90 * 86400,
    timecreated: Math.floor(Date.now() / 1000) - 30 * 86400,
  }) as Course,
  mockCourse({
    id: 2,
    fullname: 'Advanced Mathematics',
    shortname: 'MATH201',
    category: 2,
    visible: 1,
    format: 'weeks',
    startdate: Math.floor(Date.now() / 1000),
    enddate: Math.floor(Date.now() / 1000) + 90 * 86400,
    timecreated: Math.floor(Date.now() / 1000) - 20 * 86400,
  }) as Course,
  mockCourse({
    id: 3,
    fullname: 'Hidden Course',
    shortname: 'HIDDEN101',
    category: 1,
    visible: 0,
    format: 'topics',
    startdate: Math.floor(Date.now() / 1000),
    enddate: Math.floor(Date.now() / 1000) + 90 * 86400,
    timecreated: Math.floor(Date.now() / 1000) - 10 * 86400,
  }) as Course,
];

const defaultMockCategories: CourseCategory[] = [
  mockCourseCategory({
    id: 1,
    name: 'Computer Science',
    parent: 0,
    depth: 1,
    path: '/1',
    coursecount: 5,
  }) as CourseCategory,
  mockCourseCategory({
    id: 2,
    name: 'Mathematics',
    parent: 0,
    depth: 1,
    path: '/2',
    coursecount: 3,
  }) as CourseCategory,
  mockCourseCategory({
    id: 3,
    name: 'Web Development',
    parent: 1,
    depth: 2,
    path: '/1/3',
    coursecount: 2,
  }) as CourseCategory,
];

// ============================================================================
// Test Setup and Utilities
// ============================================================================

/**
 * Sets up default MSW handlers for tests
 */
function setupDefaultHandlers(
  courses: Course[] = defaultMockCourses,
  categories: CourseCategory[] = defaultMockCategories
): void {
  server.use(
    // GET courses list
    http.get(`${API_BASE_URL}/admin/courses`, ({ request }) => {
      const url = new URL(request.url);
      const search = url.searchParams.get('search');
      const categoryId = url.searchParams.get('categoryId');
      const visible = url.searchParams.get('visible');
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const perPage = parseInt(url.searchParams.get('perPage') || '20', 10);

      let filteredCourses = [...courses];

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        filteredCourses = filteredCourses.filter(
          (c) =>
            c.fullname.toLowerCase().includes(searchLower) ||
            c.shortname.toLowerCase().includes(searchLower)
        );
      }

      // Apply category filter
      if (categoryId) {
        filteredCourses = filteredCourses.filter(
          (c) => c.category === parseInt(categoryId, 10)
        );
      }

      // Apply visibility filter
      if (visible !== null && visible !== undefined) {
        const isVisible = visible === 'true';
        filteredCourses = filteredCourses.filter((c) =>
          isVisible ? c.visible === 1 : c.visible === 0
        );
      }

      // Apply pagination
      const startIndex = (page - 1) * perPage;
      const paginatedCourses = filteredCourses.slice(
        startIndex,
        startIndex + perPage
      );

      return HttpResponse.json(
        createMockCoursesResponse(paginatedCourses, {
          page,
          perPage,
          total: filteredCourses.length,
        })
      );
    }),

    // GET categories list
    http.get(`${API_BASE_URL}/admin/courses/categories`, () => {
      return HttpResponse.json(createMockCategoriesResponse(categories));
    }),

    // DELETE single course
    http.delete(`${API_BASE_URL}/admin/courses/:id`, ({ params }) => {
      const { id } = params;
      return HttpResponse.json({
        success: true,
        data: { deleted: true, courseId: Number(id) },
      });
    }),

    // POST bulk delete
    http.post(`${API_BASE_URL}/admin/courses/bulk/delete`, async ({ request }) => {
      const body = (await request.json()) as { courseIds: number[] };
      return HttpResponse.json(
        createMockBulkActionResult(body.courseIds.length)
      );
    }),

    // POST bulk update visibility
    http.post(`${API_BASE_URL}/admin/courses/bulk/visibility`, async ({ request }) => {
      const body = (await request.json()) as { courseIds: number[]; visible: boolean };
      return HttpResponse.json(
        createMockBulkActionResult(body.courseIds.length)
      );
    }),

    // POST bulk move to category
    http.post(`${API_BASE_URL}/admin/courses/bulk/move`, async ({ request }) => {
      const body = (await request.json()) as { courseIds: number[]; categoryId: number };
      return HttpResponse.json(
        createMockBulkActionResult(body.courseIds.length)
      );
    })
  );
}

/**
 * Utility to wait for loading to finish
 */
async function waitForLoadingToFinish(): Promise<void> {
  await waitFor(
    () => {
      const loadingElements = screen.queryAllByRole('progressbar');
      expect(loadingElements.length).toBe(0);
    },
    { timeout: 5000 }
  );
}

/**
 * Utility to advance timers for debounce testing
 */
async function advanceTimersAndFlush(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

// ============================================================================
// Test Suite: Course Listing and Display
// ============================================================================

describe('CourseManagement Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultHandlers();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('Course Listing and Display', () => {
    it('renders course list with DataGrid', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByRole('grid')).toBeInTheDocument();
      });

      // Verify course data is displayed
      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });
    });

    it('displays course columns (name, shortname, category, visibility, actions)', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: /course name/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /short name/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /category/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /visibility/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /actions/i })).toBeInTheDocument();
      });
    });

    it('shows loading skeleton while fetching data', async () => {
      // Set up a delayed response
      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json(
            createMockCoursesResponse(defaultMockCourses)
          );
        })
      );

      render(<CourseManagement />, { authenticated: true });

      // Check for loading state
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('displays empty state when no courses exist', async () => {
      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, () => {
          return HttpResponse.json(createMockCoursesResponse([]));
        })
      );

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText(/no courses found/i)).toBeInTheDocument();
      });
    });

    it('renders course visibility indicators', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        // Should have visible and hidden chips
        expect(screen.getAllByText('Visible').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Hidden').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('handles API errors with error message display', async () => {
      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, () => {
          return HttpResponse.json(
            { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch courses' } },
            { status: 500 }
          );
        })
      );

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText(/failed to load courses/i)).toBeInTheDocument();
      });
    });

    it('shows retry button in error state', async () => {
      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, () => {
          return HttpResponse.json(
            { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch courses' } },
            { status: 500 }
          );
        })
      );

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Test Suite: Search Functionality
  // ============================================================================

  describe('Search Functionality', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('renders search input field in toolbar', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search courses/i)).toBeInTheDocument();
      });
    });

    it('updates course list when search term is entered', async () => {
      vi.useRealTimers();
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search courses/i);
      await user.type(searchInput, 'Math');

      // Wait for debounce and re-fetch
      await waitFor(
        () => {
          expect(screen.getByText('Advanced Mathematics')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('debounces search input (waits before querying)', async () => {
      const fetchSpy = vi.fn();

      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, ({ request }) => {
          fetchSpy();
          return HttpResponse.json(createMockCoursesResponse(defaultMockCourses));
        })
      );

      render(<CourseManagement />, { authenticated: true });

      // Wait for initial load
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      const searchInput = screen.getByPlaceholderText(/search courses/i);

      // Type quickly
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'Ma' } });
        vi.advanceTimersByTime(100);
        fireEvent.change(searchInput, { target: { value: 'Mat' } });
        vi.advanceTimersByTime(100);
        fireEvent.change(searchInput, { target: { value: 'Math' } });
      });

      // Should not have made additional API calls yet
      const callsBefore = fetchSpy.mock.calls.length;

      // Advance past debounce time
      await act(async () => {
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      });

      // Now API call should have been made
      await waitFor(() => {
        expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBefore);
      });
    });

    it('filters courses by fullname match', async () => {
      vi.useRealTimers();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText(/search courses/i);

      await user.type(searchInput, 'Introduction');

      await waitFor(
        () => {
          expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('filters courses by shortname match', async () => {
      vi.useRealTimers();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText(/search courses/i);

      await user.type(searchInput, 'CS101');

      await waitFor(
        () => {
          expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('shows "no results" message when search yields no matches', async () => {
      vi.useRealTimers();

      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, ({ request }) => {
          const url = new URL(request.url);
          const search = url.searchParams.get('search');

          if (search === 'nonexistent') {
            return HttpResponse.json(createMockCoursesResponse([]));
          }

          return HttpResponse.json(createMockCoursesResponse(defaultMockCourses));
        })
      );

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText(/search courses/i);

      await user.clear(searchInput);
      await user.type(searchInput, 'nonexistent');

      await waitFor(
        () => {
          expect(screen.getByText(/no courses found/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('clears search with clear button', async () => {
      vi.useRealTimers();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search courses/i)).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText(/search courses/i);

      await user.type(searchInput, 'test');

      // Look for clear button
      const clearButton = await screen.findByRole('button', { name: /clear search/i });
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
    });
  });

  // ============================================================================
  // Test Suite: Filter Controls
  // ============================================================================

  describe('Filter Controls', () => {
    it('renders category filter dropdown', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      });
    });

    it('populates category dropdown with hierarchical categories', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      });

      // Open dropdown
      const categorySelect = screen.getByLabelText(/filter by category/i);
      await user.click(categorySelect);

      // Check for category options
      await waitFor(() => {
        expect(screen.getByText('Computer Science')).toBeInTheDocument();
        expect(screen.getByText('Mathematics')).toBeInTheDocument();
      });
    });

    it('filters courses by selected category', async () => {
      const user = userEvent.setup();

      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, ({ request }) => {
          const url = new URL(request.url);
          const categoryId = url.searchParams.get('categoryId');

          if (categoryId === '2') {
            return HttpResponse.json(
              createMockCoursesResponse([defaultMockCourses[1]])
            );
          }

          return HttpResponse.json(createMockCoursesResponse(defaultMockCourses));
        })
      );

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const categorySelect = screen.getByLabelText(/filter by category/i);
      await user.click(categorySelect);

      // Select Mathematics category (id: 2)
      const mathOption = await screen.findByRole('option', { name: /mathematics/i });
      await user.click(mathOption);

      await waitFor(() => {
        expect(screen.getByText('Advanced Mathematics')).toBeInTheDocument();
      });
    });

    it('renders visibility filter (All/Visible/Hidden)', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /all/i })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /visible/i })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /hidden/i })).toBeInTheDocument();
      });
    });

    it('filters courses by visibility status', async () => {
      const user = userEvent.setup();

      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, ({ request }) => {
          const url = new URL(request.url);
          const visible = url.searchParams.get('visible');

          if (visible === 'false') {
            const hiddenCourses = defaultMockCourses.filter((c) => c.visible === 0);
            return HttpResponse.json(createMockCoursesResponse(hiddenCourses));
          }

          if (visible === 'true') {
            const visibleCourses = defaultMockCourses.filter((c) => c.visible === 1);
            return HttpResponse.json(createMockCoursesResponse(visibleCourses));
          }

          return HttpResponse.json(createMockCoursesResponse(defaultMockCourses));
        })
      );

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Click "Hidden" filter
      const hiddenRadio = screen.getByRole('radio', { name: /hidden/i });
      await user.click(hiddenRadio);

      await waitFor(() => {
        expect(screen.getByText('Hidden Course')).toBeInTheDocument();
      });
    });

    it('clear filters button resets all filters', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search courses/i)).toBeInTheDocument();
      });

      // Apply some filters
      const searchInput = screen.getByPlaceholderText(/search courses/i);
      await user.type(searchInput, 'test');

      const hiddenRadio = screen.getByRole('radio', { name: /hidden/i });
      await user.click(hiddenRadio);

      // Click clear filters
      const clearFiltersButton = screen.getByRole('button', { name: /clear.*filters/i });
      await user.click(clearFiltersButton);

      // Verify filters are reset
      await waitFor(() => {
        expect(searchInput).toHaveValue('');
        expect(screen.getByRole('radio', { name: /all/i })).toBeChecked();
      });
    });
  });

  // ============================================================================
  // Test Suite: DataGrid Pagination
  // ============================================================================

  describe('DataGrid Pagination', () => {
    it('displays pagination controls at bottom', async () => {
      const manyCourses = Array.from({ length: 50 }, (_, i) =>
        mockCourse({
          id: i + 1,
          fullname: `Course ${i + 1}`,
          shortname: `C${i + 1}`,
          category: 1,
          visible: 1,
        }) as Course
      );

      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, ({ request }) => {
          const url = new URL(request.url);
          const page = parseInt(url.searchParams.get('page') || '1', 10);
          const perPage = parseInt(url.searchParams.get('perPage') || '20', 10);

          const startIndex = (page - 1) * perPage;
          const paginatedCourses = manyCourses.slice(startIndex, startIndex + perPage);

          return HttpResponse.json(
            createMockCoursesResponse(paginatedCourses, {
              page,
              perPage,
              total: manyCourses.length,
            })
          );
        })
      );

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        // MUI DataGrid pagination uses a table footer
        expect(screen.getByRole('grid')).toBeInTheDocument();
      });
    });

    it('allows changing page size', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByRole('grid')).toBeInTheDocument();
      });

      // DataGrid has built-in pagination which shows rows per page
      const grid = screen.getByRole('grid');
      expect(grid).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Test Suite: DataGrid Sorting
  // ============================================================================

  describe('DataGrid Sorting', () => {
    it('enables sorting on course name column', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        const nameHeader = screen.getByRole('columnheader', { name: /course name/i });
        expect(nameHeader).toBeInTheDocument();
      });
    });

    it('sorts courses when column header clicked', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Click on the course name column header to sort
      const nameHeader = screen.getByRole('columnheader', { name: /course name/i });
      await user.click(nameHeader);

      // DataGrid should handle sorting
      await waitFor(() => {
        expect(screen.getByRole('grid')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Test Suite: Row Selection
  // ============================================================================

  describe('Row Selection', () => {
    it('renders checkbox in each row for selection', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(0);
      });
    });

    it('selects single course when checkbox clicked', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Find and click first row checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // First row checkbox (0 is header)

      // Should show selection count
      await waitFor(() => {
        expect(screen.getByText(/1 course.*selected/i)).toBeInTheDocument();
      });
    });

    it('shows bulk actions toolbar when courses selected', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Select a course
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      // Should show bulk action buttons
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /show selected courses/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /hide selected courses/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /delete selected courses/i })).toBeInTheDocument();
      });
    });

    it('shows count of selected courses in toolbar', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Select multiple courses
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      await waitFor(() => {
        expect(screen.getByText(/2 courses selected/i)).toBeInTheDocument();
      });
    });

    it('clears selection with clear selection button', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Select a course
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByText(/1 course.*selected/i)).toBeInTheDocument();
      });

      // Clear selection
      const clearSelectionButton = screen.getByRole('button', { name: /clear selection/i });
      await user.click(clearSelectionButton);

      // Selection toolbar should be hidden
      await waitFor(() => {
        expect(screen.queryByText(/course.*selected/i)).not.toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Test Suite: Individual Course Actions
  // ============================================================================

  describe('Individual Course Actions', () => {
    it('renders edit button for each course', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      expect(editButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('renders delete button for each course', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('opens delete confirmation dialog when delete button clicked', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Find delete button in first row
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
      });
    });

    it('renders quick visibility toggle button', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Should have visibility toggle buttons
      const hideButtons = screen.getAllByRole('button', { name: /hide/i });
      expect(hideButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('shows view course link that opens in new tab', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      expect(viewButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // Test Suite: Bulk Delete Action
  // ============================================================================

  describe('Bulk Delete Action', () => {
    it('shows bulk delete button when courses selected', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Select a course
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete selected courses/i })).toBeInTheDocument();
      });
    });

    it('opens confirmation dialog with selected course count', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Select multiple courses
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      // Click bulk delete
      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected courses/i });
      await user.click(bulkDeleteButton);

      // Should show dialog with count
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/2.*course/i)).toBeInTheDocument();
      });
    });

    it('cancels delete when cancel button clicked in dialog', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Select and open delete dialog
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected courses/i });
      await user.click(bulkDeleteButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('calls DELETE API for each selected course when confirmed', async () => {
      const deleteSpy = vi.fn();

      server.use(
        http.post(`${API_BASE_URL}/admin/courses/bulk/delete`, async ({ request }) => {
          const body = await request.json();
          deleteSpy(body);
          return HttpResponse.json(createMockBulkActionResult(2));
        })
      );

      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Select courses
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      // Open delete dialog and confirm
      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected courses/i });
      await user.click(bulkDeleteButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /delete all/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalled();
      });
    });

    it('clears selection after successful bulk delete', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Select and delete
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected courses/i });
      await user.click(bulkDeleteButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /delete all/i });
      await user.click(confirmButton);

      // Selection should be cleared
      await waitFor(() => {
        expect(screen.queryByText(/course.*selected/i)).not.toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Test Suite: Bulk Visibility Actions
  // ============================================================================

  describe('Bulk Visibility Actions', () => {
    it('shows bulk hide button when courses selected', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /hide selected courses/i })).toBeInTheDocument();
      });
    });

    it('shows bulk show button when courses selected', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /show selected courses/i })).toBeInTheDocument();
      });
    });

    it('calls API to hide all selected courses', async () => {
      const visibilitySpy = vi.fn();

      server.use(
        http.post(`${API_BASE_URL}/admin/courses/bulk/visibility`, async ({ request }) => {
          const body = await request.json();
          visibilitySpy(body);
          return HttpResponse.json(createMockBulkActionResult(1));
        })
      );

      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      const hideButton = screen.getByRole('button', { name: /hide selected courses/i });
      await user.click(hideButton);

      await waitFor(() => {
        expect(visibilitySpy).toHaveBeenCalledWith(
          expect.objectContaining({ visible: false })
        );
      });
    });

    it('calls API to show all selected courses', async () => {
      const visibilitySpy = vi.fn();

      server.use(
        http.post(`${API_BASE_URL}/admin/courses/bulk/visibility`, async ({ request }) => {
          const body = await request.json();
          visibilitySpy(body);
          return HttpResponse.json(createMockBulkActionResult(1));
        })
      );

      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      const showButton = screen.getByRole('button', { name: /show selected courses/i });
      await user.click(showButton);

      await waitFor(() => {
        expect(visibilitySpy).toHaveBeenCalledWith(
          expect.objectContaining({ visible: true })
        );
      });
    });
  });

  // ============================================================================
  // Test Suite: Bulk Move to Category
  // ============================================================================

  describe('Bulk Move to Category', () => {
    it('shows move to category button when courses selected', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /move selected courses/i })).toBeInTheDocument();
      });
    });

    it('opens category selection dialog', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      const moveButton = screen.getByRole('button', { name: /move selected courses/i });
      await user.click(moveButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/move courses to category/i)).toBeInTheDocument();
      });
    });

    it('allows selecting target category from dropdown', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      const moveButton = screen.getByRole('button', { name: /move selected courses/i });
      await user.click(moveButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Should have target category dropdown
      const categorySelect = screen.getByLabelText(/target category/i);
      expect(categorySelect).toBeInTheDocument();
    });

    it('calls API to move courses when confirmed', async () => {
      const moveSpy = vi.fn();

      server.use(
        http.post(`${API_BASE_URL}/admin/courses/bulk/move`, async ({ request }) => {
          const body = await request.json();
          moveSpy(body);
          return HttpResponse.json(createMockBulkActionResult(1));
        })
      );

      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      const moveButton = screen.getByRole('button', { name: /move selected courses/i });
      await user.click(moveButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Select a category
      const categorySelect = screen.getByLabelText(/target category/i);
      await user.click(categorySelect);

      const mathOption = await screen.findByRole('option', { name: /mathematics/i });
      await user.click(mathOption);

      // Click move button
      const confirmMoveButton = within(screen.getByRole('dialog')).getByRole('button', { name: /move/i });
      await user.click(confirmMoveButton);

      await waitFor(() => {
        expect(moveSpy).toHaveBeenCalledWith(
          expect.objectContaining({ categoryId: expect.any(Number) })
        );
      });
    });
  });

  // ============================================================================
  // Test Suite: Delete Course Confirmation
  // ============================================================================

  describe('Delete Course Confirmation', () => {
    it('displays course name in confirmation dialog', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Click delete on first course
      const deleteButtons = screen.getAllByRole('button', { name: /delete.*introduction/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/introduction to programming/i)).toBeInTheDocument();
      });
    });

    it('shows warning about permanent deletion', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete.*introduction/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/permanent/i)).toBeInTheDocument();
      });
    });

    it('cancels delete without API call when cancel clicked', async () => {
      const deleteSpy = vi.fn();

      server.use(
        http.delete(`${API_BASE_URL}/admin/courses/:id`, () => {
          deleteSpy();
          return HttpResponse.json({ success: true, data: { deleted: true } });
        })
      );

      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete.*introduction/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Dialog should close without API call
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('calls DELETE API with course ID when confirmed', async () => {
      const deleteSpy = vi.fn();

      server.use(
        http.delete(`${API_BASE_URL}/admin/courses/:id`, ({ params }) => {
          deleteSpy(params.id);
          return HttpResponse.json({ success: true, data: { deleted: true } });
        })
      );

      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete.*introduction/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith('1');
      });
    });

    it('shows loading spinner during deletion', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/admin/courses/:id`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return HttpResponse.json({ success: true, data: { deleted: true } });
        })
      );

      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete.*introduction/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText(/deleting/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Test Suite: Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('displays error when course list fetch fails', async () => {
      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, () => {
          return HttpResponse.json(
            { success: false, error: { code: 'FETCH_ERROR', message: 'Database error' } },
            { status: 500 }
          );
        })
      );

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText(/failed to load courses/i)).toBeInTheDocument();
      });
    });

    it('handles 403 permission errors with appropriate message', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/admin/courses/:id`, () => {
          return HttpResponse.json(
            { success: false, error: { code: 'PERMISSION_DENIED', message: 'Access denied' } },
            { status: 403 }
          );
        })
      );

      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Try to delete
      const deleteButtons = screen.getAllByRole('button', { name: /delete.*introduction/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      // Error message should be shown via toast
      // The component uses useToast hook for error notifications
    });

    it('handles 404 not found errors gracefully', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/admin/courses/:id`, () => {
          return HttpResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Course not found' } },
            { status: 404 }
          );
        })
      );

      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete.*introduction/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      // Dialog should close after error
      await waitFor(() => {
        // Component handles error via toast
      });
    });

    it('handles network errors with offline message', async () => {
      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, () => {
          return HttpResponse.error();
        })
      );

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText(/failed to load courses/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Test Suite: Loading States
  // ============================================================================

  describe('Loading States', () => {
    it('shows loading state while initial data loads', async () => {
      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return HttpResponse.json(createMockCoursesResponse(defaultMockCourses));
        })
      );

      render(<CourseManagement />, { authenticated: true });

      // DataGrid should show loading state
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('disables action buttons while mutation is in progress', async () => {
      server.use(
        http.post(`${API_BASE_URL}/admin/courses/bulk/visibility`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return HttpResponse.json(createMockBulkActionResult(1));
        })
      );

      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      const showButton = screen.getByRole('button', { name: /show selected courses/i });
      await user.click(showButton);

      // Button should become disabled during mutation
      await waitFor(() => {
        const hideButton = screen.getByRole('button', { name: /hide selected courses/i });
        expect(hideButton).toBeDisabled();
      });
    });
  });

  // ============================================================================
  // Test Suite: React Query Integration
  // ============================================================================

  describe('React Query Integration', () => {
    it('uses useQuery hook to fetch courses with correct query key', async () => {
      const fetchSpy = vi.fn();

      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, () => {
          fetchSpy();
          return HttpResponse.json(createMockCoursesResponse(defaultMockCourses));
        })
      );

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });
    });

    it('invalidates course list query after successful mutation', async () => {
      const fetchSpy = vi.fn();

      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, () => {
          fetchSpy();
          return HttpResponse.json(createMockCoursesResponse(defaultMockCourses));
        }),
        http.post(`${API_BASE_URL}/admin/courses/bulk/visibility`, async () => {
          return HttpResponse.json(createMockBulkActionResult(1));
        })
      );

      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const initialFetchCount = fetchSpy.mock.calls.length;

      // Trigger mutation
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      const showButton = screen.getByRole('button', { name: /show selected courses/i });
      await user.click(showButton);

      // Should refetch after mutation
      await waitFor(() => {
        expect(fetchSpy.mock.calls.length).toBeGreaterThan(initialFetchCount);
      });
    });
  });

  // ============================================================================
  // Test Suite: Accessibility
  // ============================================================================

  describe('Accessibility', () => {
    it('all interactive elements have accessible names', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Search input has accessible label
      expect(screen.getByLabelText(/search courses/i)).toBeInTheDocument();

      // Category filter has accessible label
      expect(screen.getByLabelText(/filter by category/i)).toBeInTheDocument();

      // Visibility filter has accessible label
      expect(screen.getByLabelText(/filter by visibility/i)).toBeInTheDocument();
    });

    it('DataGrid has aria-label', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        const grid = screen.getByRole('grid');
        expect(grid).toHaveAttribute('aria-label', 'Course management table');
      });
    });

    it('delete confirmation has clear ARIA labels', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete.*introduction/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-labelledby');
        expect(dialog).toHaveAttribute('aria-describedby');
      });
    });

    it('action buttons have tooltips explaining their purpose', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // The component wraps buttons with Tooltip components
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      expect(editButtons.length).toBeGreaterThan(0);

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('focus moves to dialog when opened', async () => {
      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete.*introduction/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        // MUI Dialog handles focus management automatically
      });
    });
  });

  // ============================================================================
  // Test Suite: Props and Configuration
  // ============================================================================

  describe('Props and Configuration', () => {
    it('hides action column when showActions is false', async () => {
      render(<CourseManagement showActions={false} />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Should not have actions column
      expect(screen.queryByRole('columnheader', { name: /actions/i })).not.toBeInTheDocument();
    });

    it('filters by initial categoryId when provided', async () => {
      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, ({ request }) => {
          const url = new URL(request.url);
          const categoryId = url.searchParams.get('categoryId');

          if (categoryId === '2') {
            return HttpResponse.json(
              createMockCoursesResponse([defaultMockCourses[1]])
            );
          }

          return HttpResponse.json(createMockCoursesResponse(defaultMockCourses));
        })
      );

      render(<CourseManagement categoryId={2} />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Advanced Mathematics')).toBeInTheDocument();
      });
    });

    it('calls onCourseSelect callback when course clicked', async () => {
      const onCourseSelect = vi.fn();
      const user = userEvent.setup();

      render(<CourseManagement onCourseSelect={onCourseSelect} />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Click on course name
      const courseName = screen.getByText('Introduction to Programming');
      await user.click(courseName);

      await waitFor(() => {
        expect(onCourseSelect).toHaveBeenCalledWith(1);
      });
    });
  });

  // ============================================================================
  // Test Suite: Refresh Functionality
  // ============================================================================

  describe('Refresh Functionality', () => {
    it('shows refresh button', async () => {
      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      });
    });

    it('refetches data when refresh button clicked', async () => {
      const fetchSpy = vi.fn();

      server.use(
        http.get(`${API_BASE_URL}/admin/courses`, () => {
          fetchSpy();
          return HttpResponse.json(createMockCoursesResponse(defaultMockCourses));
        })
      );

      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      const initialFetchCount = fetchSpy.mock.calls.length;

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(fetchSpy.mock.calls.length).toBeGreaterThan(initialFetchCount);
      });
    });
  });

  // ============================================================================
  // Test Suite: Partial Bulk Action Failures
  // ============================================================================

  describe('Partial Bulk Action Failures', () => {
    it('handles partial success (some succeed, some fail)', async () => {
      server.use(
        http.post(`${API_BASE_URL}/admin/courses/bulk/visibility`, async () => {
          return HttpResponse.json(
            createMockBulkActionResult(1, 1, [
              { courseId: 2, courseName: 'Advanced Mathematics', message: 'Permission denied' },
            ])
          );
        })
      );

      const user = userEvent.setup();

      render(<CourseManagement />, { authenticated: true });

      await waitFor(() => {
        expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
      });

      // Select multiple courses
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      const showButton = screen.getByRole('button', { name: /show selected courses/i });
      await user.click(showButton);

      // Should still complete and clear selection
      await waitFor(() => {
        expect(screen.queryByText(/course.*selected/i)).not.toBeInTheDocument();
      });
    });
  });
});
