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

import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { screen, within, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Internal imports
import AllocationManager from '@/features/activities/workshop/components/AllocationManager';
import {
  setupWorkshopHandlers,
  createMockWorkshop,
  createMockSubmission,
  createMockAllocation,
  createMockUserPlan,
} from './test-utils';
import { render } from '../../../../helpers/render';

// ============================================================================
// Test Constants
// ============================================================================

const WORKSHOP_ID = 1;
const COURSE_ID = 100;
const CONTEXT_ID = 500;

/**
 * API endpoint paths for workshop allocation operations
 */
const API_ENDPOINTS = {
  workshop: `/api/v1/workshops/${WORKSHOP_ID}`,
  allocations: `/api/v1/workshops/${WORKSHOP_ID}/allocations`,
  manualAllocate: `/api/v1/workshops/${WORKSHOP_ID}/allocate`,
  randomAllocate: `/api/v1/workshops/${WORKSHOP_ID}/allocate/random`,
  scheduledAllocate: `/api/v1/workshops/${WORKSHOP_ID}/allocate/scheduled`,
};

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Create mock submissions for allocation testing
 */
const createMockSubmissions = () => [
  createMockSubmission({
    id: 1,
    workshopid: WORKSHOP_ID,
    authorid: 101,
    title: 'Submission 1',
    authorName: 'Alice Student',
  }),
  createMockSubmission({
    id: 2,
    workshopid: WORKSHOP_ID,
    authorid: 102,
    title: 'Submission 2',
    authorName: 'Bob Student',
  }),
  createMockSubmission({
    id: 3,
    workshopid: WORKSHOP_ID,
    authorid: 103,
    title: 'Submission 3',
    authorName: 'Carol Student',
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
    course: COURSE_ID,
    name: 'Test Workshop',
    phase: 20, // PHASE_SUBMISSION
    usepeerassessment: true,
    useselfassessment: false,
    useexamples: false,
    submissions: createMockSubmissions(),
    allocations: createMockAllocations(),
    reviewers: createMockReviewers(),
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
    // Workshop data endpoint
    http.get(API_ENDPOINTS.workshop, () => {
      return HttpResponse.json({
        success: true,
        data: {
          ...workshopData,
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

    // Manual allocation endpoint
    http.post(API_ENDPOINTS.manualAllocate, async ({ request }) => {
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
        data: { allocation: newAllocation },
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

      const body = await request.json() as { numOfReviews: number };
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
          allocationsCreated: newAllocations.length,
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
          scheduled: true,
          scheduledTime: body.scheduledTime,
          message: 'Allocation scheduled successfully',
        },
      });
    }),

    // Delete allocation endpoint
    http.delete(`${API_ENDPOINTS.allocations}/:allocationId`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { deleted: true, allocationId: params.allocationId },
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
  server.listen({ onUnhandledRequest: 'error' });
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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Check for statistics cards
      expect(screen.getByText(/total submissions/i)).toBeInTheDocument();
      expect(screen.getByText(/total reviewers/i)).toBeInTheDocument();
      expect(screen.getByText(/coverage/i)).toBeInTheDocument();
    });

    it('renders loading state while fetching data', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Component should be fully rendered with tabs
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('shows permission denied message when user lacks allocate capability', async () => {
      server.use(...createAllocationHandlers({ hasAllocatePermission: false }));

      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText(/total submissions/i)).toBeInTheDocument();
      });

      // Mock data has 3 submissions
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('displays total reviewers count', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText(/total reviewers/i)).toBeInTheDocument();
      });

      // Mock data has 4 reviewers
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('displays coverage percentage correctly', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText(/coverage/i)).toBeInTheDocument();
      });

      // 2 allocations out of 3 submissions = 66.7% coverage
      expect(screen.getByText(/66\.?\d*%/)).toBeInTheDocument();
    });

    it('displays reviewer workload distribution', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Manual tab should be active by default
      const manualTabPanel = screen.getByRole('tabpanel');
      expect(manualTabPanel).toBeInTheDocument();

      // Check for submission list and reviewer list
      expect(screen.getByText(/submissions/i)).toBeInTheDocument();
      expect(screen.getByText(/reviewers/i)).toBeInTheDocument();
    });

    it('shows Add Allocation button in manual tab', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add allocation/i });
      expect(addButton).toBeInTheDocument();
    });

    it('triggers manual allocation mutation when allocation is created', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Select a submission from dropdown
      const submissionSelect = screen.getByLabelText(/select submission/i);
      await user.click(submissionSelect);
      
      const submissionOption = await screen.findByRole('option', { name: /submission 3/i });
      await user.click(submissionOption);

      // Select a reviewer from dropdown
      const reviewerSelect = screen.getByLabelText(/select reviewer/i);
      await user.click(reviewerSelect);
      
      const reviewerOption = await screen.findByRole('option', { name: /david student/i });
      await user.click(reviewerOption);

      // Click add allocation button
      const addButton = screen.getByRole('button', { name: /add allocation/i });
      await user.click(addButton);

      // Wait for success feedback
      await waitFor(() => {
        expect(screen.getByText(/allocation.*created/i)).toBeInTheDocument();
      });
    });

    it('shows reviewer workload count per reviewer', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Check for workload indicators (e.g., "1 assessment", "2 assessments")
      const workloadElements = screen.getAllByText(/\d+\s*assessment/i);
      expect(workloadElements.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Random Allocation Tab Tests
  // --------------------------------------------------------------------------

  describe('Random Allocation Tab', () => {
    it('shows configuration form for number of assessments', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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

      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText(/allocation.*complete/i)).toBeInTheDocument();
      });
    });

    it('shows checkbox options for random allocation configuration', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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

      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText(/scheduled.*successfully/i)).toBeInTheDocument();
      });
    });

    it('disables date picker when scheduled allocation is not enabled', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Check for allocations table
      expect(screen.getByText(/current allocations/i)).toBeInTheDocument();
      
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('shows submission-reviewer pairs in table rows', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Check for table headers
      expect(screen.getByText('Submission')).toBeInTheDocument();
      expect(screen.getByText('Author')).toBeInTheDocument();
      expect(screen.getByText('Reviewer')).toBeInTheDocument();
      expect(screen.getByText('Grade')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();

      // Check for allocation data
      expect(screen.getByText('Submission 1')).toBeInTheDocument();
      expect(screen.getByText('Alice Student')).toBeInTheDocument();
      expect(screen.getByText('Bob Student')).toBeInTheDocument();
    });

    it('displays grade status in table (graded vs not graded)', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // One allocation has grade 85.5, other has null
      expect(screen.getByText('85.5')).toBeInTheDocument();
      expect(screen.getByText('Not graded')).toBeInTheDocument();
    });

    it('shows delete button for each allocation', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Get all delete buttons
      const deleteButtons = screen.getAllByRole('button', { name: /remove allocation/i });
      expect(deleteButtons.length).toBe(2); // 2 mock allocations
    });

    it('shows empty state message when no allocations exist', async () => {
      server.use(...createAllocationHandlers({ allocationsData: [] }));

      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      const undoButton = screen.getByRole('button', { name: /undo/i });
      const redoButton = screen.getByRole('button', { name: /redo/i });

      expect(undoButton).toBeInTheDocument();
      expect(redoButton).toBeInTheDocument();
    });

    it('disables undo button when no actions to undo', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      const undoButton = screen.getByRole('button', { name: /undo/i });
      expect(undoButton).toBeDisabled();
    });

    it('disables redo button when no actions to redo', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      const redoButton = screen.getByRole('button', { name: /redo/i });
      expect(redoButton).toBeDisabled();
    });

    it('enables undo button after performing an allocation action', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Perform a delete action to enable undo
      const deleteButtons = screen.getAllByRole('button', { name: /remove allocation/i });
      await user.click(deleteButtons[0]);

      // Confirm deletion in modal
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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Try to create an allocation
      const submissionSelect = screen.getByLabelText(/select submission/i);
      await user.click(submissionSelect);
      
      const submissionOption = await screen.findByRole('option', { name: /submission 3/i });
      await user.click(submissionOption);

      const reviewerSelect = screen.getByLabelText(/select reviewer/i);
      await user.click(reviewerSelect);
      
      const reviewerOption = await screen.findByRole('option', { name: /david student/i });
      await user.click(reviewerOption);

      const addButton = screen.getByRole('button', { name: /add allocation/i });
      await user.click(addButton);

      // Check for error message
      await waitFor(() => {
        expect(screen.getByText(/failed to create allocation/i)).toBeInTheDocument();
      });
    });

    it('displays error message when random allocation fails due to insufficient reviewers', async () => {
      server.use(...createAllocationHandlers({ shouldFailRandom: true }));

      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Navigate to random tab
      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Execute random allocation
      const executeButton = await screen.findByRole('button', { name: /execute random allocation/i });
      await user.click(executeButton);

      // Check for error message
      await waitFor(() => {
        expect(screen.getByText(/not enough reviewers/i)).toBeInTheDocument();
      });
    });

    it('displays conflict warning when allocation conflicts are detected', async () => {
      server.use(...createAllocationHandlers({ randomAllocationConflict: true }));

      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Navigate to random tab
      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Execute random allocation
      const executeButton = await screen.findByRole('button', { name: /execute random allocation/i });
      await user.click(executeButton);

      // Check for conflict warning
      await waitFor(() => {
        expect(screen.getByText(/conflict/i)).toBeInTheDocument();
      });
    });

    it('displays error message when scheduled allocation save fails', async () => {
      server.use(...createAllocationHandlers({ shouldFailScheduled: true }));

      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Navigate to scheduled tab
      const scheduledTab = screen.getByRole('tab', { name: /scheduled/i });
      await user.click(scheduledTab);

      // Enable and try to save
      const enableCheckbox = await screen.findByLabelText(/enable scheduled allocation/i);
      await user.click(enableCheckbox);

      const saveButton = screen.getByRole('button', { name: /save scheduled allocation/i });
      await user.click(saveButton);

      // Check for error message
      await waitFor(() => {
        expect(screen.getByText(/failed to schedule/i)).toBeInTheDocument();
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
        http.post(API_ENDPOINTS.manualAllocate, async ({ request }) => {
          capturedPayload = await request.json() as { submissionId: number; reviewerId: number };
          return HttpResponse.json({
            success: true,
            data: {
              allocation: createMockAllocation({
                id: 999,
                submissionId: capturedPayload.submissionId,
                reviewerId: capturedPayload.reviewerId,
              }),
            },
          });
        })
      );

      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Create allocation
      const submissionSelect = screen.getByLabelText(/select submission/i);
      await user.click(submissionSelect);
      
      const submissionOption = await screen.findByRole('option', { name: /submission 3/i });
      await user.click(submissionOption);

      const reviewerSelect = screen.getByLabelText(/select reviewer/i);
      await user.click(reviewerSelect);
      
      const reviewerOption = await screen.findByRole('option', { name: /david student/i });
      await user.click(reviewerOption);

      const addButton = screen.getByRole('button', { name: /add allocation/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(capturedPayload).not.toBeNull();
        expect(capturedPayload?.submissionId).toBe(3);
        expect(capturedPayload?.reviewerId).toBe(104);
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

      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Navigate to random tab
      const randomTab = screen.getByRole('tab', { name: /random/i });
      await user.click(randomTab);

      // Configure and execute
      const numReviewsInput = await screen.findByLabelText(/number of reviews/i);
      await user.clear(numReviewsInput);
      await user.type(numReviewsInput, '3');

      const selfAssessmentCheckbox = screen.getByLabelText(/add self-assessment/i);
      await user.click(selfAssessmentCheckbox);

      const executeButton = screen.getByRole('button', { name: /execute random allocation/i });
      await user.click(executeButton);

      await waitFor(() => {
        expect(capturedConfig).not.toBeNull();
        expect(capturedConfig?.numOfReviews).toBe(3);
        expect(capturedConfig?.addSelfAssessment).toBe(true);
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

      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Navigate to scheduled tab
      const scheduledTab = screen.getByRole('tab', { name: /scheduled/i });
      await user.click(scheduledTab);

      // Enable and configure
      const enableCheckbox = await screen.findByLabelText(/enable scheduled allocation/i);
      await user.click(enableCheckbox);

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
            data: { allocationsCreated: 2, allocations: [] },
          });
        })
      );

      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
    it('immediately reflects allocation creation in UI before server response', async () => {
      const user = userEvent.setup();
      
      // Add delay to simulate slow response
      server.use(
        http.post(API_ENDPOINTS.manualAllocate, async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return HttpResponse.json({
            success: true,
            data: {
              allocation: createMockAllocation({ id: 999 }),
            },
          });
        })
      );

      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Get initial allocation count
      const initialRows = screen.getAllByRole('row');
      const initialCount = initialRows.length;

      // Create allocation
      const submissionSelect = screen.getByLabelText(/select submission/i);
      await user.click(submissionSelect);
      
      const submissionOption = await screen.findByRole('option', { name: /submission 3/i });
      await user.click(submissionOption);

      const reviewerSelect = screen.getByLabelText(/select reviewer/i);
      await user.click(reviewerSelect);
      
      const reviewerOption = await screen.findByRole('option', { name: /david student/i });
      await user.click(reviewerOption);

      const addButton = screen.getByRole('button', { name: /add allocation/i });
      await user.click(addButton);

      // UI should update immediately (optimistic update)
      await waitFor(() => {
        const updatedRows = screen.getAllByRole('row');
        expect(updatedRows.length).toBeGreaterThan(initialCount);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility Tests
  // --------------------------------------------------------------------------

  describe('Accessibility', () => {
    it('has accessible tab navigation with proper ARIA attributes', async () => {
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Undo/Redo buttons
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument();

      // Add allocation button
      expect(screen.getByRole('button', { name: /add allocation/i })).toBeInTheDocument();

      // Remove allocation buttons
      const removeButtons = screen.getAllByRole('button', { name: /remove allocation/i });
      expect(removeButtons.length).toBeGreaterThan(0);
    });

    it('supports keyboard navigation for tab switching', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByRole('button', { name: /remove allocation/i });
      await user.click(deleteButtons[0]);

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText(/confirm action/i)).toBeInTheDocument();
      });
    });

    it('cancels allocation removal when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Get initial allocation count
      const initialRows = screen.getAllByRole('row');
      const initialCount = initialRows.length;

      // Click delete button
      const deleteButtons = screen.getAllByRole('button', { name: /remove allocation/i });
      await user.click(deleteButtons[0]);

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
      render(<AllocationManager workshopId={WORKSHOP_ID} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Review Allocation')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByRole('button', { name: /remove allocation/i });
      await user.click(deleteButtons[0]);

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
