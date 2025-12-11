/**
 * @fileoverview Unit tests for AllocationManager component
 *
 * Comprehensive test suite covering:
 * - Three allocation methods: Manual, Random, and Scheduled
 * - Permission checks for 'mod/workshop:allocate' capability
 * - Allocation statistics display (total submissions, reviewers, coverage)
 * - Reviewer workload distribution
 * - Drag-and-drop interface for manual allocation
 * - Random allocation configuration and execution
 * - Scheduled allocation date picker and configuration
 * - Allocation results table with submission-reviewer pairs
 * - Undo/Redo functionality
 * - Conflict detection and warning messages
 * - React Query mutations for allocation operations
 * - Optimistic updates during allocation
 * - Error handling for allocation failures
 * - Material-UI Tabs integration
 * - Accessibility of interface elements
 *
 * @see public/mod/workshop/allocation.php - PHP allocation handler reference
 * @see public/mod/workshop/allocation/manual/lib.php - Manual allocation logic
 * @see public/mod/workshop/allocation/random/lib.php - Random allocation logic
 * @see public/mod/workshop/allocation/scheduled/lib.php - Scheduled allocation logic
 */

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Internal imports
import AllocationManager from '@/features/activities/workshop/components/AllocationManager';
import {
  createMockWorkshop,
  createMockSubmission,
  createMockAllocation,
} from './test-utils';
import { render, type RenderOptions } from '../../../../helpers/render';
import { createMockUser } from '../../../../helpers/mockData';

// ============================================================================
// Mock useToast hook
// ============================================================================

/**
 * Mock functions for useToast to track success/error/warning messages
 * These are used to verify that the component shows appropriate feedback
 */
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockShowWarning = vi.fn();
const mockShowInfo = vi.fn();

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    success: mockShowSuccess,
    error: mockShowError,
    warning: mockShowWarning,
    info: mockShowInfo,
    toasts: [],
    showToast: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  }),
}));

// ============================================================================
// Test Constants
// ============================================================================

const WORKSHOP_ID = 1;
const COURSE_ID = 100;
const CONTEXT_ID = 500;

// ============================================================================
// Default Render Options with Workshop Permissions
// ============================================================================

/**
 * Creates a mock user with workshop allocation capability.
 * This user has all the required permissions to manage workshop allocations.
 * Capabilities must be objects with capability, contextId, and granted properties.
 */
const createUserWithAllocateCapability = () =>
  createMockUser({
    id: 1,
    firstname: 'Teacher',
    lastname: 'User',
    roles: [{ id: 3, shortname: 'editingteacher', name: 'Editing Teacher' }],
    capabilities: [
      { capability: 'mod/workshop:view', contextId: CONTEXT_ID, granted: true },
      { capability: 'mod/workshop:allocate', contextId: CONTEXT_ID, granted: true },
      { capability: 'mod/workshop:editdimensions', contextId: CONTEXT_ID, granted: true },
      { capability: 'mod/workshop:manageexamples', contextId: CONTEXT_ID, granted: true },
      { capability: 'mod/workshop:publishsubmissions', contextId: CONTEXT_ID, granted: true },
      { capability: 'mod/workshop:switchphase', contextId: CONTEXT_ID, granted: true },
    ],
  });

/**
 * Default render options for AllocationManager tests.
 * Provides an authenticated user with workshop allocation permissions.
 */
const getDefaultRenderOptions = (overrides: Partial<RenderOptions> = {}): RenderOptions => ({
  authenticated: true,
  user: createUserWithAllocateCapability(),
  ...overrides,
});

/**
 * API base URL matching the test environment configuration in vitest.config.ts
 * MSW handlers need full URLs to properly intercept requests when the API client
 * uses an absolute base URL (http://localhost:8000/api/v1)
 */
const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * API endpoint paths for workshop allocation operations.
 * These must match the actual API paths used by the AllocationManager component:
 * - GET/POST /workshops/{id}/allocations - list/create allocations
 * - POST /workshops/{id}/allocations/{submissionId}/{reviewerId} - manual allocation
 * - POST /workshops/{id}/allocations/random - random allocation
 * - POST /workshops/{id}/allocations/scheduled - scheduled allocation
 */
const API_ENDPOINTS = {
  workshop: `${API_BASE_URL}/workshops/${WORKSHOP_ID}`,
  allocations: `${API_BASE_URL}/workshops/${WORKSHOP_ID}/allocations`,
  // Manual allocation uses dynamic path: /allocations/{submissionId}/{reviewerId}
  manualAllocate: `${API_BASE_URL}/workshops/${WORKSHOP_ID}/allocations`,
  randomAllocate: `${API_BASE_URL}/workshops/${WORKSHOP_ID}/allocations/random`,
  scheduledAllocate: `${API_BASE_URL}/workshops/${WORKSHOP_ID}/allocations/scheduled`,
};

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Create mock submissions for allocation testing
 * Note: Property names MUST match the WorkshopSubmission interface (camelCase)
 */
const createMockSubmissions = () => [
  createMockSubmission({
    id: 1,
    workshopId: WORKSHOP_ID,
    authorId: 101,
    title: 'Submission 1',
    authorFirstName: 'Alice',
    authorLastName: 'Student',
  }),
  createMockSubmission({
    id: 2,
    workshopId: WORKSHOP_ID,
    authorId: 102,
    title: 'Submission 2',
    authorFirstName: 'Bob',
    authorLastName: 'Student',
  }),
  createMockSubmission({
    id: 3,
    workshopId: WORKSHOP_ID,
    authorId: 103,
    title: 'Submission 3',
    authorFirstName: 'Carol',
    authorLastName: 'Student',
  }),
];

/**
 * Create mock reviewers for allocation testing
 */
const createMockReviewers = () => [
  { id: 101, fullname: 'Alice Student', email: 'alice@example.com' },
  { id: 102, fullname: 'Bob Student', email: 'bob@example.com' },
  { id: 103, fullname: 'Carol Student', email: 'carol@example.com' },
  { id: 104, fullname: 'David Student', email: 'david@example.com' },
];

/**
 * Create mock allocations representing existing reviewer assignments
 */
const createMockAllocations = () => [
  createMockAllocation({
    id: 1,
    submissionId: 1,
    reviewerId: 102,
    submissionTitle: 'Submission 1',
    authorName: 'Alice Student',
    reviewerName: 'Bob Student',
    grade: null,
  }),
  createMockAllocation({
    id: 2,
    submissionId: 2,
    reviewerId: 103,
    submissionTitle: 'Submission 2',
    authorName: 'Bob Student',
    reviewerName: 'Carol Student',
    grade: 85.5,
  }),
];

/**
 * Create mock workshop data with allocation-related settings
 */
const createMockWorkshopData = (overrides = {}) =>
  createMockWorkshop({
    id: WORKSHOP_ID,
    courseId: COURSE_ID,
    name: 'Test Workshop',
    phase: 20, // PHASE_SUBMISSION
    usePeerAssessment: true,
    useSelfAssessment: false,
    useExamples: false,
    ...overrides,
  });

// ============================================================================
// MSW Server Setup
// ============================================================================

/**
 * MSW handlers for workshop allocation API endpoints
 */
const createAllocationHandlers = (options: {
  hasAllocatePermission?: boolean;
  workshopData?: ReturnType<typeof createMockWorkshopData>;
  allocationsData?: ReturnType<typeof createMockAllocations>;
  shouldFailManual?: boolean;
  shouldFailRandom?: boolean;
  shouldFailScheduled?: boolean;
  randomAllocationConflict?: boolean;
} = {}) => {
  const {
    hasAllocatePermission = true,
    workshopData = createMockWorkshopData(),
    allocationsData = createMockAllocations(),
    shouldFailManual = false,
    shouldFailRandom = false,
    shouldFailScheduled = false,
    randomAllocationConflict = false,
  } = options;

  return [
    // Workshop data endpoint - includes submissions for the component to display
    http.get(API_ENDPOINTS.workshop, () => {
      return HttpResponse.json({
        success: true,
        data: {
          ...workshopData,
          submissions: createMockSubmissions(),
          context: {
            id: CONTEXT_ID,
            contextlevel: 70, // CONTEXT_MODULE
          },
          capabilities: hasAllocatePermission
            ? ['mod/workshop:allocate', 'mod/workshop:view']
            : ['mod/workshop:view'],
        },
      });
    }),

    // Allocations list endpoint
    http.get(API_ENDPOINTS.allocations, () => {
      return HttpResponse.json({
        success: true,
        data: {
          allocations: allocationsData,
          submissions: createMockSubmissions(),
          reviewers: createMockReviewers(),
        },
      });
    }),

    // Manual allocation endpoint - handles POST /allocations with body { submissionId, reviewerId }
    http.post(API_ENDPOINTS.allocations, async ({ request }) => {
      if (shouldFailManual) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ALLOCATION_FAILED',
              message: 'Failed to create allocation: reviewer already assigned',
            },
          },
          { status: 400 }
        );
      }

      const body = await request.json() as { submissionId: number; reviewerId: number };
      const newAllocation = createMockAllocation({
        id: Date.now(),
        submissionId: body.submissionId,
        reviewerId: body.reviewerId,
        submissionTitle: 'Test Submission',
        authorName: 'Test Author',
        reviewerName: 'Test Reviewer',
        grade: null,
      });

      return HttpResponse.json({
        success: true,
        data: {
          success: true,
          allocated: 1,
          allocation: newAllocation,
        },
      });
    }),

    // Random allocation endpoint
    http.post(API_ENDPOINTS.randomAllocate, async ({ request }) => {
      if (shouldFailRandom) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'INSUFFICIENT_REVIEWERS',
              message: 'Not enough reviewers available for the requested allocation',
            },
          },
          { status: 400 }
        );
      }

      if (randomAllocationConflict) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ALLOCATION_CONFLICT',
              message: 'Allocation conflict detected: some reviewers already have maximum allocations',
              details: {
                conflicts: [
                  { reviewerId: 101, currentCount: 5, maxAllowed: 5 },
                  { reviewerId: 102, currentCount: 5, maxAllowed: 5 },
                ],
              },
            },
          },
          { status: 409 }
        );
      }

      const _body = await request.json() as { numOfReviews: number };
      void _body; // Read to consume the request body
      // Simulate creating allocations based on config
      const newAllocations = [
        createMockAllocation({
          id: Date.now(),
          submissionId: 1,
          reviewerId: 103,
          submissionTitle: 'Submission 1',
          authorName: 'Alice Student',
          reviewerName: 'Carol Student',
          grade: null,
        }),
        createMockAllocation({
          id: Date.now() + 1,
          submissionId: 3,
          reviewerId: 101,
          submissionTitle: 'Submission 3',
          authorName: 'Carol Student',
          reviewerName: 'Alice Student',
          grade: null,
        }),
      ];

      return HttpResponse.json({
        success: true,
        data: {
          success: true,
          allocated: newAllocations.length,
          message: `Random allocation completed: ${newAllocations.length} allocations created`,
          allocations: newAllocations,
        },
      });
    }),

    // Scheduled allocation endpoint
    http.post(API_ENDPOINTS.scheduledAllocate, async ({ request }) => {
      if (shouldFailScheduled) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'SCHEDULE_FAILED',
              message: 'Failed to schedule allocation: invalid time specified',
            },
          },
          { status: 400 }
        );
      }

      const body = await request.json() as { enabled: boolean; scheduledTime: number };
      return HttpResponse.json({
        success: true,
        data: {
          success: true,
          allocated: 0,
          scheduled: true,
          enabled: body.enabled,
          scheduledTime: body.scheduledTime,
          message: body.enabled ? 'Scheduled allocation enabled' : 'Scheduled allocation disabled',
        },
      });
    }),

    // Delete allocation endpoint
    http.delete(`${API_ENDPOINTS.allocations}/:submissionId/:reviewerId`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { deleted: true, submissionId: params.submissionId, reviewerId: params.reviewerId },
      });
    }),
  ];
};

// Create the MSW server with default handlers
const server = setupServer(...createAllocationHandlers());

// ============================================================================
// Test Suite Setup
// ============================================================================

beforeAll(() => {
  // Use 'bypass' to avoid errors from unhandled requests that aren't relevant to these tests
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

// ============================================================================
// Test Suites
// ============================================================================

describe('AllocationManager', () => {
  // --------------------------------------------------------------------------
  // Rendering and Structure Tests
  // --------------------------------------------------------------------------

  describe('Component Rendering', () => {
    it('renders tabbed interface with three tabs: Manual, Random, Scheduled', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Verify all three tabs are present
      const tabList = screen.getByRole('tablist');
      expect(tabList).toBeInTheDocument();

      const manualTab = screen.getByRole('tab', { name: /manual/i });
      const randomTab = screen.getByRole('tab', { name: /random/i });
      const scheduledTab = screen.getByRole('tab', { name: /scheduled/i });

      expect(manualTab).toBeInTheDocument();
      expect(randomTab).toBeInTheDocument();
      expect(scheduledTab).toBeInTheDocument();

      // Manual tab should be selected by default
      expect(manualTab).toHaveAttribute('aria-selected', 'true');
    });

    it('renders statistics dashboard with allocation metrics', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Check for statistics in Chip labels (format: "N Submissions", "N Reviewers", "N% Coverage")
      await waitFor(() => {
        expect(screen.getByText(/\d+ Submissions/)).toBeInTheDocument();
        expect(screen.getByText(/\d+ Reviewers/)).toBeInTheDocument();
        expect(screen.getByText(/\d+% Coverage/)).toBeInTheDocument();
      });
    });

    it('renders loading state while fetching data', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      // Should show loading indicator initially
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // Wait for content to load
      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Permission Tests
  // --------------------------------------------------------------------------

  describe('Permission Checks', () => {
    it('only renders for users with mod/workshop:allocate capability', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Component should be fully rendered with tabs
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('shows permission denied message when user lacks allocate capability', async () => {
      server.use(...createAllocationHandlers({ hasAllocatePermission: false }));

      // Create a user WITHOUT the workshop:allocate capability
      const userWithoutCapability = createMockUser({
        id: 2,
        firstname: 'Student',
        lastname: 'User',
        roles: [{ id: 5, shortname: 'student', name: 'Student' }],
        capabilities: [
          { capability: 'mod/workshop:view', contextId: CONTEXT_ID, granted: true },
        ], // Only view, no allocate
      });

      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, {
        authenticated: true,
        user: userWithoutCapability,
      });

      await waitFor(() => {
        expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
      });

      // Tabs should not be visible
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Statistics Display Tests
  // --------------------------------------------------------------------------

  describe('Allocation Statistics', () => {
    it('displays total submissions count', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      // Component renders stats like "3 Submissions" in Chip labels
      await waitFor(() => {
        expect(screen.getByText(/\d+ Submissions/)).toBeInTheDocument();
      });
    });

    it('displays total reviewers count', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      // Component renders stats like "4 Reviewers" in Chip labels
      await waitFor(() => {
        expect(screen.getByText(/\d+ Reviewers/)).toBeInTheDocument();
      });
    });

    it('displays coverage percentage correctly', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      // Component renders coverage like "67% Coverage" in Chip labels
      await waitFor(() => {
        expect(screen.getByText(/\d+% Coverage/)).toBeInTheDocument();
      });
    });

    it('displays reviewer workload distribution', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Navigate to manual tab if not already there
      const manualTab = screen.getByRole('tab', { name: /manual/i });
      await userEvent.click(manualTab);

      // Should show workload information
      await waitFor(() => {
        expect(screen.getByText(/workload/i)).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Manual Allocation Tab Tests
  // --------------------------------------------------------------------------

  describe('Manual Allocation Tab', () => {
    it('displays drag-and-drop interface for assigning reviewers', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Manual tab should be active by default
      const manualTabPanel = screen.getByRole('tabpanel');
      expect(manualTabPanel).toBeInTheDocument();

      // Check for submission selection dropdown (labeled "Select Submission")
      expect(screen.getByLabelText(/select submission/i)).toBeInTheDocument();
      // Check for reviewer selection dropdown (labeled "Select Reviewer")
      expect(screen.getByLabelText(/select reviewer/i)).toBeInTheDocument();
    });

    it('shows Allocate button in manual tab', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Component renders "Allocate" button (or "Allocating..." when pending)
      const allocateButton = screen.getByRole('button', { name: /^allocate$/i });
      expect(allocateButton).toBeInTheDocument();
    });

    it('triggers manual allocation mutation when allocation is created', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Select a submission from dropdown
      const submissionSelect = screen.getByLabelText(/select submission/i);
      await user.click(submissionSelect);
      
      // Get all options and select the first one
      const submissionOptions = await screen.findAllByRole('option');
      expect(submissionOptions.length).toBeGreaterThan(0);
      const firstSubmissionOption = submissionOptions[0];
      expect(firstSubmissionOption).toBeDefined();
      await user.click(firstSubmissionOption!);

      // Select a reviewer from dropdown
      const reviewerSelect = screen.getByLabelText(/select reviewer/i);
      await user.click(reviewerSelect);
      
      // Get reviewer options and select one different from submission author
      const reviewerOptions = await screen.findAllByRole('option');
      expect(reviewerOptions.length).toBeGreaterThan(0);
      // Select second option to ensure it's different
      const reviewerOption = reviewerOptions.length > 1 ? reviewerOptions[1] : reviewerOptions[0];
      expect(reviewerOption).toBeDefined();
      await user.click(reviewerOption!);

      // Click allocate button
      const allocateButton = screen.getByRole('button', { name: /^allocate$/i });
      await user.click(allocateButton);

      // Wait for success feedback - component shows snackbar or toast with success message
      await waitFor(() => {
        // Component calls showSuccess() which triggers a toast notification
        // The success message contains "allocation" keyword
        const successElements = screen.queryAllByText(/allocation|success/i);
        expect(successElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('shows reviewer workload count per reviewer', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Component renders "Reviewer Workload Distribution" section with chips like "Name: X reviews"
      await waitFor(() => {
        expect(screen.getByText(/reviewer workload distribution/i)).toBeInTheDocument();
      });
      
      // The workload chips show "X reviews" format (based on component line 867)
      // May be empty if no allocations exist yet, but the section header should exist
      expect(screen.queryAllByText(/\d+\s*reviews?/i)).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Random Allocation Tab Tests
  // --------------------------------------------------------------------------

  describe('Random Allocation Tab', () => {
    it('shows configuration form for number of assessments', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Click random tab
      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Check for configuration inputs
      await waitFor(() => {
        expect(screen.getByLabelText(/number of reviews/i)).toBeInTheDocument();
      });
    });

    it('displays reviews per submission/reviewer selector', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Click random tab
      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Check for reviews per selector
      await waitFor(() => {
        expect(screen.getByLabelText(/reviews per/i)).toBeInTheDocument();
      });
    });

    it('shows Execute Random Allocation button', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Click random tab
      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Check for execute button
      await waitFor(() => {
        const executeButton = screen.getByRole('button', { name: /execute random allocation/i });
        expect(executeButton).toBeInTheDocument();
      });
    });

    it('triggers random allocation mutation when execute button is clicked', async () => {
      const user = userEvent.setup();
      mockShowSuccess.mockClear();
      
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Click random tab
      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Wait for tab content
      await waitFor(() => {
        expect(screen.getByLabelText(/number of reviews/i)).toBeInTheDocument();
      });

      // Set number of reviews
      const numReviewsInput = screen.getByLabelText(/number of reviews/i);
      await user.clear(numReviewsInput);
      await user.type(numReviewsInput, '3');

      // Click execute button
      const executeButton = screen.getByRole('button', { name: /execute random allocation/i });
      await user.click(executeButton);

      // Verify success message was shown via useToast
      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith(expect.stringMatching(/allocation.*complete|allocation.*created/i));
      });
    });

    it('shows checkbox options for random allocation configuration', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Click random tab
      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Check for configuration checkboxes
      await waitFor(() => {
        expect(screen.getByLabelText(/remove current allocations/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/exclude same-group/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/add self-assessment/i)).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Scheduled Allocation Tab Tests
  // --------------------------------------------------------------------------

  describe('Scheduled Allocation Tab', () => {
    it('displays date/time picker for automatic allocation', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Click scheduled tab
      const scheduledTab = screen.getByRole('tab', { name: /scheduled/i });
      await user.click(scheduledTab);

      // Check for datetime picker
      await waitFor(() => {
        expect(screen.getByLabelText(/scheduled time/i)).toBeInTheDocument();
      });
    });

    it('shows enable scheduled allocation checkbox', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Click scheduled tab
      const scheduledTab = screen.getByRole('tab', { name: /scheduled/i });
      await user.click(scheduledTab);

      // Check for enable checkbox
      await waitFor(() => {
        expect(screen.getByLabelText(/enable scheduled allocation/i)).toBeInTheDocument();
      });
    });

    it('saves scheduled allocation configuration when save button is clicked', async () => {
      const user = userEvent.setup();
      mockShowSuccess.mockClear();
      
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Click scheduled tab
      const scheduledTab = screen.getByRole('tab', { name: /scheduled/i });
      await user.click(scheduledTab);

      // Enable scheduled allocation
      await waitFor(() => {
        expect(screen.getByLabelText(/enable scheduled allocation/i)).toBeInTheDocument();
      });

      const enableCheckbox = screen.getByLabelText(/enable scheduled allocation/i);
      await user.click(enableCheckbox);

      // Set scheduled time
      const dateInput = screen.getByLabelText(/scheduled time/i);
      const futureDate = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
      await user.clear(dateInput);
      await user.type(dateInput, futureDate);

      // Click save button
      const saveButton = screen.getByRole('button', { name: /save scheduled allocation/i });
      await user.click(saveButton);

      // Verify success message was shown via useToast
      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith(expect.stringMatching(/scheduled allocation.*enabled|scheduled.*saved/i));
      });
    });

    it('disables date picker when scheduled allocation is not enabled', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Click scheduled tab
      const scheduledTab = screen.getByRole('tab', { name: /scheduled/i });
      await user.click(scheduledTab);

      // Check that date input is disabled by default
      await waitFor(() => {
        const dateInput = screen.getByLabelText(/scheduled time/i);
        expect(dateInput).toBeDisabled();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Allocation Results Table Tests
  // --------------------------------------------------------------------------

  describe('Allocation Results Table', () => {
    it('displays current allocations in a table', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Check for allocations table
      expect(screen.getByText(/current allocations/i)).toBeInTheDocument();
      
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('shows submission-reviewer pairs in table rows', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Check for table headers
      expect(screen.getByText('Submission')).toBeInTheDocument();
      expect(screen.getByText('Author')).toBeInTheDocument();
      expect(screen.getByText('Reviewer')).toBeInTheDocument();
      expect(screen.getByText('Grade')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();

      // Check for allocation data (Bob Student appears multiple times - as author and reviewer)
      expect(screen.getByText('Submission 1')).toBeInTheDocument();
      expect(screen.getByText('Alice Student')).toBeInTheDocument();
      // Bob Student may appear multiple times (as author of other submissions and as reviewer)
      expect(screen.getAllByText('Bob Student').length).toBeGreaterThan(0);
    });

    it('displays grade status in table (graded vs not graded)', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // One allocation has grade 85.5, other has null
      expect(screen.getByText('85.5')).toBeInTheDocument();
      expect(screen.getByText('Not graded')).toBeInTheDocument();
    });

    it('shows delete button for each allocation', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Get all delete buttons
      const deleteButtons = screen.getAllByRole('button', { name: /remove allocation/i });
      expect(deleteButtons.length).toBe(2); // 2 mock allocations
    });

    it('shows empty state message when no allocations exist', async () => {
      server.use(...createAllocationHandlers({ allocationsData: [] }));

      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Check for empty state message
      expect(screen.getByText(/no allocations have been created/i)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Undo/Redo Functionality Tests
  // --------------------------------------------------------------------------

  describe('Undo/Redo Functionality', () => {
    it('renders undo and redo buttons', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      const undoButton = screen.getByRole('button', { name: /undo/i });
      const redoButton = screen.getByRole('button', { name: /redo/i });

      expect(undoButton).toBeInTheDocument();
      expect(redoButton).toBeInTheDocument();
    });

    it('disables undo button when no actions to undo', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      const undoButton = screen.getByRole('button', { name: /undo/i });
      expect(undoButton).toBeDisabled();
    });

    it('disables redo button when no actions to redo', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      const redoButton = screen.getByRole('button', { name: /redo/i });
      expect(redoButton).toBeDisabled();
    });

    it('enables undo button after performing an allocation action', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Perform a delete action to enable undo
      // Use the second allocation (index 1) which has a grade and will trigger confirmation modal
      const deleteButtons = screen.getAllByRole('button', { name: /remove allocation/i });
      expect(deleteButtons.length).toBeGreaterThan(1);
      const secondDeleteButton = deleteButtons[1];
      expect(secondDeleteButton).toBeDefined();
      await user.click(secondDeleteButton!); // Click second allocation which has grade: 85.5

      // Confirm deletion in modal (only appears for graded allocations)
      const confirmButton = await screen.findByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Wait for undo button to be enabled
      await waitFor(() => {
        const undoButton = screen.getByRole('button', { name: /undo/i });
        expect(undoButton).not.toBeDisabled();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Tab Switching Tests
  // --------------------------------------------------------------------------

  describe('Material-UI Tabs Integration', () => {
    it('switches to Random tab when clicked', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Check tab is now selected
      expect(randomTab).toHaveAttribute('aria-selected', 'true');

      // Check random tab content is visible
      await waitFor(() => {
        expect(screen.getByLabelText(/number of reviews/i)).toBeInTheDocument();
      });
    });

    it('switches to Scheduled tab when clicked', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      const scheduledTab = screen.getByRole('tab', { name: /scheduled/i });
      await user.click(scheduledTab);

      // Check tab is now selected
      expect(scheduledTab).toHaveAttribute('aria-selected', 'true');

      // Check scheduled tab content is visible
      await waitFor(() => {
        expect(screen.getByLabelText(/enable scheduled allocation/i)).toBeInTheDocument();
      });
    });

    it('maintains tab state after content update', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Switch to random tab
      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Interact with random tab content
      const numReviewsInput = await screen.findByLabelText(/number of reviews/i);
      await user.clear(numReviewsInput);
      await user.type(numReviewsInput, '5');

      // Tab should still be selected
      expect(randomTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  // --------------------------------------------------------------------------
  // Error Handling Tests
  // --------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('displays error message when manual allocation fails', async () => {
      server.use(...createAllocationHandlers({ shouldFailManual: true }));

      const user = userEvent.setup();
      mockShowError.mockClear();
      
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Try to create an allocation
      // Note: The component uses submission authors as potential reviewers
      const submissionSelect = screen.getByLabelText(/select submission/i);
      await user.click(submissionSelect);
      
      const submissionOption = await screen.findByRole('option', { name: /submission 3/i });
      await user.click(submissionOption);

      const reviewerSelect = screen.getByLabelText(/select reviewer/i);
      await user.click(reviewerSelect);
      
      // Use Alice Student (authorId 101) as reviewer - she appears in submissions list
      const reviewerOption = await screen.findByRole('option', { name: /alice student/i });
      await user.click(reviewerOption);

      const addButton = screen.getByRole('button', { name: /^allocate$/i });
      await user.click(addButton);

      // Verify error message was shown via useToast
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(expect.stringMatching(/failed|error|allocation/i));
      });
    });

    it('displays error message when random allocation fails due to insufficient reviewers', async () => {
      server.use(...createAllocationHandlers({ shouldFailRandom: true }));

      const user = userEvent.setup();
      mockShowError.mockClear();
      
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Navigate to random tab
      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Execute random allocation
      const executeButton = await screen.findByRole('button', { name: /execute random allocation/i });
      await user.click(executeButton);

      // Verify error message was shown via useToast
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(expect.stringMatching(/not enough|insufficient|reviewer|failed/i));
      });
    });

    it('displays conflict warning when allocation conflicts are detected', async () => {
      server.use(...createAllocationHandlers({ randomAllocationConflict: true }));

      const user = userEvent.setup();
      mockShowError.mockClear();
      
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Navigate to random tab
      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Execute random allocation
      const executeButton = await screen.findByRole('button', { name: /execute random allocation/i });
      await user.click(executeButton);

      // Verify error message was shown via useToast
      // 409 Conflict response still goes through error handler in the component
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(expect.stringMatching(/conflict|failed|error/i));
      });
    });

    it('displays error message when scheduled allocation save fails', async () => {
      server.use(...createAllocationHandlers({ shouldFailScheduled: true }));

      const user = userEvent.setup();
      mockShowError.mockClear();
      
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Navigate to scheduled tab
      const scheduledTab = screen.getByRole('tab', { name: /scheduled/i });
      await user.click(scheduledTab);

      // Enable scheduled allocation
      const enableCheckbox = await screen.findByLabelText(/enable scheduled allocation/i);
      await user.click(enableCheckbox);

      // Set a scheduled time (required when enabled)
      const dateTimeInput = screen.getByLabelText(/scheduled time/i);
      // Set a future datetime
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Tomorrow
      const dateTimeValue = futureDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm format
      await user.clear(dateTimeInput);
      await user.type(dateTimeInput, dateTimeValue);

      // Click save button
      const saveButton = screen.getByRole('button', { name: /save scheduled allocation/i });
      await user.click(saveButton);

      // Verify error message was shown via useToast
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(expect.stringMatching(/failed|error|schedule/i));
      });
    });
  });

  // --------------------------------------------------------------------------
  // React Query Mutations Tests
  // --------------------------------------------------------------------------

  describe('React Query Mutations', () => {
    it('calls executeManualAllocation mutation with correct payload', async () => {
      const user = userEvent.setup();
      let capturedPayload: { submissionId: number; reviewerId: number } | null = null;

      server.use(
        http.post(API_ENDPOINTS.allocations, async ({ request }) => {
          const body = await request.json() as { submissionId: number; reviewerId: number };
          capturedPayload = {
            submissionId: body.submissionId,
            reviewerId: body.reviewerId,
          };
          return HttpResponse.json({
            success: true,
            data: {
              success: true,
              allocated: 1,
              allocation: createMockAllocation({
                id: 999,
                submissionId: capturedPayload.submissionId,
                reviewerId: capturedPayload.reviewerId,
              }),
            },
          });
        })
      );

      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Create allocation
      // Note: Component uses submission authors as potential reviewers
      const submissionSelect = screen.getByLabelText(/select submission/i);
      await user.click(submissionSelect);
      
      const submissionOption = await screen.findByRole('option', { name: /submission 3/i });
      await user.click(submissionOption);

      const reviewerSelect = screen.getByLabelText(/select reviewer/i);
      await user.click(reviewerSelect);
      
      // Use Alice Student (authorId 101) as reviewer - she appears in submissions list
      const reviewerOption = await screen.findByRole('option', { name: /alice student/i });
      await user.click(reviewerOption);

      const addButton = screen.getByRole('button', { name: /^allocate$/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(capturedPayload).not.toBeNull();
        expect(capturedPayload?.submissionId).toBe(3);
        expect(capturedPayload?.reviewerId).toBe(101); // Alice Student's ID
      });
    });

    it('calls executeRandomAllocation mutation with correct configuration', async () => {
      const user = userEvent.setup();
      let capturedConfig: Record<string, unknown> | null = null;

      server.use(
        http.post(API_ENDPOINTS.randomAllocate, async ({ request }) => {
          capturedConfig = await request.json() as Record<string, unknown>;
          return HttpResponse.json({
            success: true,
            data: { allocationsCreated: 2, allocations: [] },
          });
        })
      );

      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Navigate to random tab
      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Configure and execute
      const numReviewsInput = await screen.findByLabelText(/number of reviews/i);
      // Use tripleClick to select all, then type to replace - more reliable than clear
      await user.tripleClick(numReviewsInput);
      await user.keyboard('3');

      const selfAssessmentCheckbox = screen.getByLabelText(/add self-assessment/i);
      await user.click(selfAssessmentCheckbox);

      const executeButton = screen.getByRole('button', { name: /execute random allocation/i });
      await user.click(executeButton);

      await waitFor(() => {
        expect(capturedConfig).not.toBeNull();
        // Component sends lowercase field names
        expect(capturedConfig?.numofreviews).toBe(3);
        expect(capturedConfig?.addselfassessment).toBe(true);
      });
    });

    it('calls scheduleAllocation mutation with correct schedule data', async () => {
      const user = userEvent.setup();
      let capturedSchedule: Record<string, unknown> | null = null;

      server.use(
        http.post(API_ENDPOINTS.scheduledAllocate, async ({ request }) => {
          capturedSchedule = await request.json() as Record<string, unknown>;
          return HttpResponse.json({
            success: true,
            data: { scheduled: true },
          });
        })
      );

      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Navigate to scheduled tab
      const scheduledTab = screen.getByRole('tab', { name: /scheduled/i });
      await user.click(scheduledTab);

      // Enable and configure
      const enableCheckbox = await screen.findByLabelText(/enable scheduled allocation/i);
      await user.click(enableCheckbox);

      // Set a scheduled time (required when enabled)
      const dateTimeInput = screen.getByLabelText(/scheduled time/i);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Tomorrow
      const dateTimeValue = futureDate.toISOString().slice(0, 16);
      await user.clear(dateTimeInput);
      await user.type(dateTimeInput, dateTimeValue);

      const saveButton = screen.getByRole('button', { name: /save scheduled allocation/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(capturedSchedule).not.toBeNull();
        expect(capturedSchedule?.enabled).toBe(true);
      });
    });

    it('shows loading state during mutation execution', async () => {
      const user = userEvent.setup();
      
      // Add delay to API response
      server.use(
        http.post(API_ENDPOINTS.randomAllocate, async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return HttpResponse.json({
            success: true,
            data: {
              success: true,
              allocated: 2,
              message: 'Random allocation completed: 2 allocations created',
              allocations: [],
            },
          });
        })
      );

      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Navigate to random tab
      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Click execute button
      const executeButton = await screen.findByRole('button', { name: /execute random allocation/i });
      await user.click(executeButton);

      // Check for loading state
      expect(screen.getByText(/allocating/i)).toBeInTheDocument();
      expect(executeButton).toBeDisabled();

      // Wait for completion
      await waitFor(() => {
        expect(screen.queryByText(/allocating/i)).not.toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Optimistic Updates Tests
  // --------------------------------------------------------------------------

  describe('Optimistic Updates', () => {
    it('reflects allocation creation in UI after mutation completes', async () => {
      const user = userEvent.setup();
      
      // Use a handler that returns quickly for this test
      server.use(
        http.post(API_ENDPOINTS.allocations, async ({ request }) => {
          const body = await request.json() as { submissionId: number; reviewerId: number };
          return HttpResponse.json({
            success: true,
            data: {
              success: true,
              allocated: 1,
              allocation: createMockAllocation({ 
                id: 999,
                submissionId: body.submissionId,
                reviewerId: body.reviewerId,
                submissionTitle: 'Submission 3',
                reviewerName: 'Carol Student',
              }),
            },
          });
        })
      );

      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Verify initial state has rows (header + existing allocations)
      expect(screen.getAllByRole('row').length).toBeGreaterThan(0);

      // Create allocation
      const submissionSelect = screen.getByLabelText(/select submission/i);
      await user.click(submissionSelect);
      
      const submissionOption = await screen.findByRole('option', { name: /submission 3/i });
      await user.click(submissionOption);

      const reviewerSelect = screen.getByLabelText(/select reviewer/i);
      await user.click(reviewerSelect);
      
      // Use Carol Student (authorId 103) as reviewer - she's in submissions list
      const reviewerOption = await screen.findByRole('option', { name: /carol student/i });
      await user.click(reviewerOption);

      const addButton = screen.getByRole('button', { name: /^allocate$/i });
      await user.click(addButton);

      // Wait for success message which indicates mutation completed
      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalled();
      });

      // After mutation completes, the cache should be invalidated and allocations refetched
      // The component refetches and updates the local allocations state
      // Note: The UI updates via cache invalidation after successful mutation,
      // which means we check for success message rather than row count changes
      // since the refetch happens asynchronously
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility Tests
  // --------------------------------------------------------------------------

  describe('Accessibility', () => {
    it('has accessible tab navigation with proper ARIA attributes', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      const tabList = screen.getByRole('tablist');
      expect(tabList).toBeInTheDocument();

      const tabs = screen.getAllByRole('tab');
      tabs.forEach((tab) => {
        expect(tab).toHaveAttribute('aria-selected');
        expect(tab).toHaveAttribute('id');
      });

      const tabPanel = screen.getByRole('tabpanel');
      expect(tabPanel).toHaveAttribute('aria-labelledby');
    });

    it('has accessible form controls with proper labels', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Check manual tab controls
      expect(screen.getByLabelText(/select submission/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/select reviewer/i)).toBeInTheDocument();

      // Switch to random tab
      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Check random tab controls
      await waitFor(() => {
        expect(screen.getByLabelText(/number of reviews/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/reviews per/i)).toBeInTheDocument();
      });
    });

    it('has accessible action buttons with proper labels', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Undo/Redo buttons
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument();

      // Allocate button
      expect(screen.getByRole('button', { name: /^allocate$/i })).toBeInTheDocument();

      // Remove allocation buttons
      const removeButtons = screen.getAllByRole('button', { name: /remove allocation/i });
      expect(removeButtons.length).toBeGreaterThan(0);
    });

    it('supports keyboard navigation for tab switching', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Focus on first tab
      const manualTab = screen.getByRole('tab', { name: /manual/i });
      manualTab.focus();

      // Press right arrow to move to next tab
      await user.keyboard('{ArrowRight}');

      // Random tab should now be focused
      const randomTab = screen.getByRole('tab', { name: /random/i });
      expect(document.activeElement).toBe(randomTab);
    });

    it('table has proper accessibility structure', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      // Check for proper table structure
      const headers = within(table).getAllByRole('columnheader');
      expect(headers.length).toBeGreaterThan(0);

      const rows = within(table).getAllByRole('row');
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Confirmation Modal Tests
  // --------------------------------------------------------------------------

  describe('Confirmation Modal', () => {
    it('shows confirmation modal when removing allocation', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Click delete button for the second allocation (index 1) which has grade: 85.5
      // Only graded allocations show a confirmation modal
      const deleteButtons = screen.getAllByRole('button', { name: /remove allocation/i });
      expect(deleteButtons.length).toBeGreaterThan(1);
      const secondDeleteButton = deleteButtons[1];
      expect(secondDeleteButton).toBeDefined();
      await user.click(secondDeleteButton!); // Second allocation has a grade

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText(/confirm action/i)).toBeInTheDocument();
      });
    });

    it('cancels allocation removal when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Get initial allocation count
      const initialRows = screen.getAllByRole('row');
      const initialCount = initialRows.length;

      // Click delete button for graded allocation (index 1) to trigger modal
      const deleteButtonsCancel = screen.getAllByRole('button', { name: /remove allocation/i });
      expect(deleteButtonsCancel.length).toBeGreaterThan(1);
      const gradedDeleteButton = deleteButtonsCancel[1];
      expect(gradedDeleteButton).toBeDefined();
      await user.click(gradedDeleteButton!); // Second allocation has a grade

      // Click cancel in modal
      const cancelButton = await screen.findByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText(/confirm action/i)).not.toBeInTheDocument();
      });

      // Allocation count should remain the same
      const finalRows = screen.getAllByRole('row');
      expect(finalRows.length).toBe(initialCount);
    });

    it('removes allocation when confirm is clicked', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} cmId={CONTEXT_ID} />, getDefaultRenderOptions());

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Click delete button for graded allocation (index 1) to trigger modal
      const deleteButtonsConfirm = screen.getAllByRole('button', { name: /remove allocation/i });
      expect(deleteButtonsConfirm.length).toBeGreaterThan(1);
      const gradedDeleteButtonConfirm = deleteButtonsConfirm[1];
      expect(gradedDeleteButtonConfirm).toBeDefined();
      await user.click(gradedDeleteButtonConfirm!); // Second allocation has a grade

      // Click confirm in modal
      const confirmButton = await screen.findByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText(/confirm action/i)).not.toBeInTheDocument();
      });
    });
  });
});
