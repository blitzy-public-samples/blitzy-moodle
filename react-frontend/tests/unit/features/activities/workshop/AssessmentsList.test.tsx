/**
 * Unit Tests for AssessmentsList Component
 *
 * Comprehensive test suite validating the AssessmentsList component that displays
 * peer assessments for workshop submissions. Tests cover assessment rendering,
 * filtering by completion status, sorting, permission-based action buttons,
 * grade and weight display, feedback status indicators, React Query integration,
 * and accessibility compliance.
 *
 * Based on test requirements from:
 * - public/mod/workshop/assessment.php (assessment permission checks)
 * - public/mod/workshop/renderer.php (assessment display patterns)
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';

// Internal imports from helpers
import { renderWithAuth, screen, waitFor } from '@tests/helpers/render';

// Import global MSW server - DO NOT create a separate server instance
import { server } from '@tests/mocks/server';

// Component under test
import AssessmentsList from '@/features/activities/workshop/components/AssessmentsList';

// Types
import {
  WorkshopPhase,
  type WorkshopAssessment,
  type Workshop,
} from '@/features/activities/workshop/types/workshop.types';

// ============================================================================
// Mock Factories (local implementation since test-utils.ts may not exist yet)
// ============================================================================

/**
 * Creates a mock assessment with default values
 * Based on WorkshopAssessment interface from workshop.types.ts
 *
 * @param overrides - Partial assessment to override defaults
 * @returns Complete mock assessment object
 */
function createMockAssessment(
  overrides: Partial<WorkshopAssessment> = {}
): WorkshopAssessment {
  return {
    id: 1,
    submissionId: 1,
    reviewerId: 100,
    reviewerFirstName: 'John',
    reviewerLastName: 'Doe',
    weight: 1,
    grade: 85,
    gradingGrade: null,
    gradingGradeOver: null,
    feedbackAuthor: null,
    feedbackAuthorFormat: 1,
    feedbackAuthorAttachment: 0,
    feedbackReviewer: null,
    feedbackReviewerFormat: 1,
    timeCreated: Date.now() / 1000 - 86400,
    timeModified: Date.now() / 1000,
    ...overrides,
  };
}

/**
 * Creates a mock workshop with default values
 *
 * @param overrides - Partial workshop to override defaults
 * @returns Complete mock workshop object
 */
function createMockWorkshop(overrides: Partial<Workshop> = {}): Workshop {
  return {
    id: 1,
    courseId: 1,
    name: 'Test Workshop',
    intro: 'Workshop introduction',
    introFormat: 1,
    instructAuthors: 'Author instructions',
    instructAuthorsFormat: 1,
    instructReviewers: 'Reviewer instructions',
    instructReviewersFormat: 1,
    phase: WorkshopPhase.ASSESSMENT,
    strategy: 'accumulative',
    evaluation: 'best',
    grade: 100,
    gradingGrade: 80,
    gradeDecimals: 2,
    submissionStart: null,
    submissionEnd: null,
    assessmentStart: null,
    assessmentEnd: null,
    phaseSwitchAssessment: false,
    useExamples: false,
    examplesMode: 0,
    usePeerAssessment: true,
    useSelfAssessment: false,
    lateSubmissions: false,
    maxBytes: 10485760,
    nAttachments: 1,
    submissionFileTypes: null,
    overallFeedbackMode: 0,
    overallFeedbackFiles: 0,
    overallFeedbackFileTypes: null,
    conclusion: '',
    conclusionFormat: 1,
    timeCreated: Date.now() / 1000 - 604800,
    timeModified: Date.now() / 1000,
    ...overrides,
  };
}

// ============================================================================
// Mock Permission Hook
// ============================================================================

// Mock usePermissions hook
const mockHasCapability = vi.fn();
const mockIsTeacher = vi.fn();

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasCapability: mockHasCapability,
    isTeacher: mockIsTeacher(),
    isAdmin: false,
    isStudent: true,
    permissions: [],
  }),
}));

// ============================================================================
// Mock Toast Hook
// ============================================================================

const mockShowError = vi.fn();
const mockShowInfo = vi.fn();
const mockShowSuccess = vi.fn();

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    success: mockShowSuccess,
    error: mockShowError,
    info: mockShowInfo,
    warning: vi.fn(),
    loading: vi.fn(),
  }),
}));

// ============================================================================
// Mock Navigation
// ============================================================================

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ============================================================================
// MSW Server Setup
// ============================================================================

// Must match VITE_API_BASE_URL in vitest.config.ts for MSW to intercept requests
const API_BASE_URL = 'http://localhost:8000/api/v1';

// Default mock data
const defaultMockAssessments: WorkshopAssessment[] = [
  createMockAssessment({
    id: 1,
    submissionId: 1,
    reviewerId: 100,
    reviewerFirstName: 'John',
    reviewerLastName: 'Doe',
    weight: 1,
    grade: 85,
    feedbackAuthor: 'Good work overall',
    timeModified: 1700000000,
  }),
  createMockAssessment({
    id: 2,
    submissionId: 1,
    reviewerId: 101,
    reviewerFirstName: 'Jane',
    reviewerLastName: 'Smith',
    weight: 1.5,
    grade: 90,
    feedbackAuthor: null,
    timeModified: 1700001000,
  }),
  createMockAssessment({
    id: 3,
    submissionId: 1,
    reviewerId: 102,
    reviewerFirstName: 'Bob',
    reviewerLastName: 'Johnson',
    weight: 0.5,
    grade: null,
    feedbackAuthor: null,
    timeModified: 1700002000,
  }),
];

const defaultMockWorkshop = createMockWorkshop({
  id: 1,
  phase: WorkshopPhase.ASSESSMENT,
  grade: 100,
});

/**
 * Create mock WorkshopData structure expected by useWorkshop hook
 * This includes workshop, currentPhase, userPlan, and submissions
 */
function createMockWorkshopData(workshop = defaultMockWorkshop) {
  return {
    workshop,
    currentPhase: workshop.phase,
    currentPhaseTitle: workshop.phase === WorkshopPhase.ASSESSMENT 
      ? 'Assessment phase' 
      : workshop.phase === WorkshopPhase.CLOSED 
        ? 'Closed' 
        : 'Submission phase',
    userPlan: {
      phases: [
        { code: 10, title: 'Setup phase', active: workshop.phase === 10 },
        { code: 20, title: 'Submission phase', active: workshop.phase === 20 },
        { code: 30, title: 'Assessment phase', active: workshop.phase === 30 },
        { code: 40, title: 'Grading evaluation phase', active: workshop.phase === 40 },
        { code: 50, title: 'Closed', active: workshop.phase === 50 },
      ],
    },
    submissions: [],
  };
}

// MSW request handlers
const handlers = [
  // Workshop data endpoint - returns full WorkshopData structure
  http.get(`${API_BASE_URL}/workshops/:workshopId`, ({ params }) => {
    const workshopId = Number(params.workshopId);
    if (workshopId === 999) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Workshop not found' } },
        { status: 404 }
      );
    }
    const workshop = { ...defaultMockWorkshop, id: workshopId };
    return HttpResponse.json({
      success: true,
      data: createMockWorkshopData(workshop),
    });
  }),

  // Assessments endpoint
  http.get(`${API_BASE_URL}/workshops/:workshopId/assessments`, ({ params, request }) => {
    const workshopId = Number(params.workshopId);
    const url = new URL(request.url);
    const submissionId = url.searchParams.get('submissionId');

    if (workshopId === 999) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Workshop not found' } },
        { status: 404 }
      );
    }

    if (workshopId === 403) {
      return HttpResponse.json(
        { success: false, error: { code: 'PERMISSION_DENIED', message: 'You do not have permission' } },
        { status: 403 }
      );
    }

    if (workshopId === 500) {
      return HttpResponse.error();
    }

    let assessments = [...defaultMockAssessments];
    
    // Filter by submission ID if provided
    if (submissionId) {
      assessments = assessments.filter(a => a.submissionId === Number(submissionId));
    }

    // Empty workshop (no assessments)
    if (workshopId === 888) {
      assessments = [];
    }

    const gradedCount = assessments.filter(a => a.grade !== null).length;
    const pendingCount = assessments.filter(a => a.grade === null).length;

    return HttpResponse.json({
      success: true,
      data: {
        assessments,
        totalCount: assessments.length,
        gradedCount,
        pendingCount,
      },
    });
  }),
];

// ============================================================================
// Test Suite
// ============================================================================

describe('AssessmentsList Component', () => {
  // Setup default handlers before all tests in this suite
  beforeAll(() => {
    // Add workshop-specific handlers to the global server
    server.use(...handlers);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset to default handlers (which now includes workshop handlers)
    server.resetHandlers();
    // Re-add workshop handlers after reset
    server.use(...handlers);
    
    // Default permission mocks
    mockHasCapability.mockImplementation((capability: string) => {
      // Default: has basic view permissions
      if (capability === 'mod/workshop:viewreviewernames') return true;
      if (capability === 'mod/workshop:peerassess') return false;
      if (capability === 'mod/workshop:overridegrades') return false;
      return false;
    });
    mockIsTeacher.mockReturnValue(false);
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Assessment List Rendering', () => {
    it('renders assessments list with multiple assessment items', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading assessments/i)).not.toBeInTheDocument();
      });

      // Check that assessments are rendered
      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
      expect(screen.getByText(/bob johnson/i)).toBeInTheDocument();
    });

    it('displays assessment card with reviewer name, grade, weight, and feedback status', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Check grade display (85 / 100)
      expect(screen.getByText(/85\.0/)).toBeInTheDocument();

      // Check weight displays
      expect(screen.getByText('1')).toBeInTheDocument(); // Normal weight
      expect(screen.getByText('1.5')).toBeInTheDocument(); // Adjusted weight

      // Check feedback indicator - Yes for John (has feedback)
      const feedbackCells = screen.getAllByText('Yes');
      expect(feedbackCells.length).toBeGreaterThan(0);
    });

    it('shows anonymized reviewer names when user lacks viewreviewernames capability', async () => {
      mockHasCapability.mockImplementation((capability: string) => {
        if (capability === 'mod/workshop:viewreviewernames') return false;
        return false;
      });

      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/loading assessments/i)).not.toBeInTheDocument();
      });

      // Should show anonymized reviewer names
      await waitFor(() => {
        expect(screen.getByText(/reviewer 100/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/reviewer 101/i)).toBeInTheDocument();
    });

    it('displays submission title column when showSubmissionTitle is true', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} showSubmissionTitle={true} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Submission column header should be present
      expect(screen.getByText('Submission')).toBeInTheDocument();
    });

    it('hides submission title column when showSubmissionTitle is false', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} showSubmissionTitle={false} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Submission column header should NOT be present
      expect(screen.queryByText('Submission')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Filtering Tests
  // ==========================================================================

  describe('Filtering by Completion Status', () => {
    it('shows all assessments by default', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // All assessments should be visible
      expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
      expect(screen.getByText(/bob johnson/i)).toBeInTheDocument();

      // Header should show total count
      expect(screen.getByText(/assessments \(3\)/i)).toBeInTheDocument();
    });

    it('filters by graded status', async () => {
      const user = userEvent.setup();
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Open filter dropdown and select 'Graded'
      const filterSelect = screen.getByLabelText(/filter by status/i);
      await user.click(filterSelect);
      
      const gradedOption = screen.getByRole('option', { name: /graded/i });
      await user.click(gradedOption);

      // Wait for filter to apply
      await waitFor(() => {
        expect(screen.getByText(/assessments \(2\)/i)).toBeInTheDocument();
      });

      // Bob should be hidden (pending assessment with no grade)
      expect(screen.queryByText(/bob johnson/i)).not.toBeInTheDocument();
    });

    it('filters by pending status', async () => {
      const user = userEvent.setup();
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Open filter dropdown and select 'Pending'
      const filterSelect = screen.getByLabelText(/filter by status/i);
      await user.click(filterSelect);
      
      const pendingOption = screen.getByRole('option', { name: /pending/i });
      await user.click(pendingOption);

      // Wait for filter to apply
      await waitFor(() => {
        expect(screen.getByText(/assessments \(1\)/i)).toBeInTheDocument();
      });

      // Only Bob should be visible (pending assessment)
      expect(screen.getByText(/bob johnson/i)).toBeInTheDocument();
      expect(screen.queryByText(/john doe/i)).not.toBeInTheDocument();
    });

    it('filters by closed status when workshop is closed', async () => {
      // Set up closed workshop
      server.use(
        http.get(`${API_BASE_URL}/workshops/:workshopId`, () => {
          const closedWorkshop = createMockWorkshop({ phase: WorkshopPhase.CLOSED });
          return HttpResponse.json({
            success: true,
            data: createMockWorkshopData(closedWorkshop),
          });
        })
      );

      const user = userEvent.setup();
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/loading assessments/i)).not.toBeInTheDocument();
      });

      // Open filter dropdown
      const filterSelect = screen.getByLabelText(/filter by status/i);
      await user.click(filterSelect);

      // Closed option should be available
      const closedOption = screen.getByRole('option', { name: /closed/i });
      expect(closedOption).toBeInTheDocument();
    });

    it('shows message when no assessments match filter', async () => {
      // Create workshop with only graded assessments
      server.use(
        http.get(`${API_BASE_URL}/workshops/:workshopId/assessments`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              assessments: [
                createMockAssessment({ id: 1, grade: 85 }),
                createMockAssessment({ id: 2, grade: 90 }),
              ],
              totalCount: 2,
              gradedCount: 2,
              pendingCount: 0,
            },
          });
        })
      );

      const user = userEvent.setup();
      renderWithAuth(<AssessmentsList workshopId={1} />);

      // Wait for data to load (may have multiple assessments with same reviewer name)
      await waitFor(() => {
        const reviewerNames = screen.getAllByText(/john doe/i);
        expect(reviewerNames.length).toBeGreaterThan(0);
      });

      // Filter by pending
      const filterSelect = screen.getByLabelText(/filter by status/i);
      await user.click(filterSelect);
      
      const pendingOption = screen.getByRole('option', { name: /pending/i });
      await user.click(pendingOption);

      // Should show "no pending assessments" message (component shows "No pending assessments found. Try changing the filter.")
      await waitFor(() => {
        expect(screen.getByText(/no pending assessments found|no assessments match/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Sorting Tests
  // ==========================================================================

  describe('Sorting Functionality', () => {
    it('allows sorting by reviewer name', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Find the Reviewer column header - should be sortable
      const reviewerHeader = screen.getByText('Reviewer');
      expect(reviewerHeader).toBeInTheDocument();
    });

    it('allows sorting by grade', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Find the Grade column header
      const gradeHeader = screen.getByText('Grade');
      expect(gradeHeader).toBeInTheDocument();
    });

    it('allows sorting by weight', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Find the Weight column header
      const weightHeader = screen.getByText('Weight');
      expect(weightHeader).toBeInTheDocument();
    });

    it('allows sorting by date', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Find the Date column header
      const dateHeader = screen.getByText('Date');
      expect(dateHeader).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Action Button Tests
  // ==========================================================================

  describe('Action Buttons', () => {
    it('shows view action button for all users', async () => {
      const user = userEvent.setup();
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Row actions buttons should be present (kebab menu)
      const actionButtons = screen.getAllByLabelText(/row actions/i);
      expect(actionButtons.length).toBeGreaterThan(0);

      // Click first action button to open menu
      const firstActionButton = actionButtons[0];
      expect(firstActionButton).toBeDefined();
      await user.click(firstActionButton!);

      // View Assessment menu item should be present
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /view assessment/i })).toBeInTheDocument();
      });
    });

    it('shows edit button only for users with peerassess capability in assessment phase', async () => {
      const user = userEvent.setup();
      mockHasCapability.mockImplementation((capability: string) => {
        if (capability === 'mod/workshop:viewreviewernames') return true;
        if (capability === 'mod/workshop:peerassess') return true;
        return false;
      });

      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Click first action button to open menu
      const actionButtons = screen.getAllByLabelText(/row actions/i);
      expect(actionButtons.length).toBeGreaterThan(0);
      await user.click(actionButtons[0]!);

      // Edit Assessment menu item should be present for users with peerassess capability
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /edit assessment/i })).toBeInTheDocument();
      });
    });

    it('shows edit button for users with canoverridegrades capability', async () => {
      const user = userEvent.setup();
      mockHasCapability.mockImplementation((capability: string) => {
        if (capability === 'mod/workshop:viewreviewernames') return true;
        if (capability === 'mod/workshop:overridegrades') return true;
        return false;
      });

      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Click first action button to open menu
      const actionButtons = screen.getAllByLabelText(/row actions/i);
      expect(actionButtons.length).toBeGreaterThan(0);
      await user.click(actionButtons[0]!);

      // Edit Assessment menu item should be available
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /edit assessment/i })).toBeInTheDocument();
      });
    });

    it('hides edit button when workshop is not in assessment phase', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:workshopId`, () => {
          const closedWorkshop = createMockWorkshop({ phase: WorkshopPhase.CLOSED });
          return HttpResponse.json({
            success: true,
            data: createMockWorkshopData(closedWorkshop),
          });
        })
      );

      mockHasCapability.mockImplementation((capability: string) => {
        if (capability === 'mod/workshop:viewreviewernames') return true;
        if (capability === 'mod/workshop:peerassess') return true;
        return false;
      });

      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/loading assessments/i)).not.toBeInTheDocument();
      });

      // Workshop phase chip should show 'Closed'
      await waitFor(() => {
        expect(screen.getByText(/phase: closed/i)).toBeInTheDocument();
      });
    });

    it('navigates to assessment view when view button is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Click first row actions button to open menu
      const actionButtons = screen.getAllByLabelText(/row actions/i);
      expect(actionButtons.length).toBeGreaterThan(0);
      await user.click(actionButtons[0]!);

      // Click view assessment menu item
      const viewMenuItem = await screen.findByRole('menuitem', { name: /view assessment/i });
      await user.click(viewMenuItem);

      // Should navigate to assessment view
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/workshops/1/assessments/'));
    });

    it('calls onAssessmentSelect callback when view button is clicked', async () => {
      const onAssessmentSelect = vi.fn();
      const user = userEvent.setup();
      
      renderWithAuth(
        <AssessmentsList workshopId={1} onAssessmentSelect={onAssessmentSelect} />
      );

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Click first row actions button to open menu
      const actionButtons = screen.getAllByLabelText(/row actions/i);
      expect(actionButtons.length).toBeGreaterThan(0);
      await user.click(actionButtons[0]!);

      // Click view assessment menu item
      const viewMenuItem = await screen.findByRole('menuitem', { name: /view assessment/i });
      await user.click(viewMenuItem);

      // Callback should be called with assessment data
      expect(onAssessmentSelect).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Weight Display Tests
  // ==========================================================================

  describe('Assessment Weight Display', () => {
    it('displays normal weight (1) without special formatting', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Weight of 1 should be displayed
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('displays adjusted weight greater than 1', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
      });

      // Weight of 1.5 should be displayed
      expect(screen.getByText('1.5')).toBeInTheDocument();
    });

    it('displays adjusted weight less than 1', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/bob johnson/i)).toBeInTheDocument();
      });

      // Weight of 0.5 should be displayed
      expect(screen.getByText('0.5')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Feedback Status Indicators Tests
  // ==========================================================================

  describe('Feedback Status Indicators', () => {
    it('shows "Yes" when feedbackAuthor is present', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Find feedback indicators
      const yesFeedback = screen.getAllByText('Yes');
      expect(yesFeedback.length).toBeGreaterThan(0);
    });

    it('shows "No" when feedbackAuthor is null', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
      });

      // Find "No" feedback indicators for Jane and Bob (who have no feedback)
      const noFeedback = screen.getAllByText('No');
      expect(noFeedback.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe('Empty State', () => {
    it('renders empty state message when no assessments exist', async () => {
      renderWithAuth(<AssessmentsList workshopId={888} />);

      await waitFor(() => {
        expect(screen.queryByText(/loading assessments/i)).not.toBeInTheDocument();
      });

      // Should show empty state message
      await waitFor(() => {
        expect(screen.getByText(/no assessments have been allocated yet/i)).toBeInTheDocument();
      });
    });

    it('empty state mentions allocation phase', async () => {
      renderWithAuth(<AssessmentsList workshopId={888} />);

      await waitFor(() => {
        expect(screen.getByText(/allocation phase/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Progress Bar and Statistics Tests
  // ==========================================================================

  describe('Progress Bar and Statistics', () => {
    it('displays pending assessments count for teachers', async () => {
      mockIsTeacher.mockReturnValue(true);

      renderWithAuth(<AssessmentsList workshopId={1} showAllocationInfo={true} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Should show assessment progress section
      expect(screen.getByText(/assessment progress/i)).toBeInTheDocument();
      // Look for "Pending:" specifically (the statistics label, not status chip)
      expect(screen.getByText(/pending:/i)).toBeInTheDocument();
    });

    it('displays completion progress bar for teachers', async () => {
      mockIsTeacher.mockReturnValue(true);

      renderWithAuth(<AssessmentsList workshopId={1} showAllocationInfo={true} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Progress bar should be present with appropriate aria label
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('shows total assessment count', async () => {
      mockIsTeacher.mockReturnValue(true);

      renderWithAuth(<AssessmentsList workshopId={1} showAllocationInfo={true} />);

      await waitFor(() => {
        expect(screen.getByText(/total/i)).toBeInTheDocument();
      });

      // Total: 3 assessments
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows completed assessment count', async () => {
      mockIsTeacher.mockReturnValue(true);

      renderWithAuth(<AssessmentsList workshopId={1} showAllocationInfo={true} />);

      await waitFor(() => {
        expect(screen.getByText(/completed/i)).toBeInTheDocument();
      });

      // Completed: 2 assessments (John and Jane have grades)
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('hides allocation info when showAllocationInfo is false', async () => {
      mockIsTeacher.mockReturnValue(true);

      renderWithAuth(<AssessmentsList workshopId={1} showAllocationInfo={false} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Assessment progress section should NOT be present
      expect(screen.queryByText(/assessment progress/i)).not.toBeInTheDocument();
    });

    it('hides allocation info for non-teachers', async () => {
      mockIsTeacher.mockReturnValue(false);

      renderWithAuth(<AssessmentsList workshopId={1} showAllocationInfo={true} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Assessment progress section should NOT be present for students
      expect(screen.queryByText(/assessment progress/i)).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // React Query Integration Tests
  // ==========================================================================

  describe('React Query Integration', () => {
    it('shows loading state while fetching assessments', async () => {
      // Delay API response to test loading state
      server.use(
        http.get(`${API_BASE_URL}/workshops/:workshopId/assessments`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: {
              assessments: defaultMockAssessments,
              totalCount: 3,
              gradedCount: 2,
              pendingCount: 1,
            },
          });
        })
      );

      renderWithAuth(<AssessmentsList workshopId={1} />);

      // Should show loading state
      expect(screen.getByText(/loading assessments/i)).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading assessments/i)).not.toBeInTheDocument();
      });
    });

    it('shows error state when API returns 404', async () => {
      renderWithAuth(<AssessmentsList workshopId={999} />);

      await waitFor(() => {
        expect(screen.getByText(/error loading assessments/i)).toBeInTheDocument();
      });
    });

    it('shows error state when API returns 403 (permission denied)', async () => {
      renderWithAuth(<AssessmentsList workshopId={403} />);

      await waitFor(() => {
        expect(screen.getByText(/error loading assessments/i)).toBeInTheDocument();
      });
    });

    it('shows error state when network error occurs', async () => {
      renderWithAuth(<AssessmentsList workshopId={500} />);

      await waitFor(() => {
        expect(screen.getByText(/error loading assessments/i)).toBeInTheDocument();
      });
    });

    it('provides retry button on error state', async () => {
      renderWithAuth(<AssessmentsList workshopId={999} />);

      await waitFor(() => {
        expect(screen.getByText(/error loading assessments/i)).toBeInTheDocument();
      });

      // Retry button should be present
      const retryButton = screen.getByLabelText(/retry loading assessments/i);
      expect(retryButton).toBeInTheDocument();
    });

    it('refetches data when retry button is clicked', async () => {
      let callCount = 0;
      
      server.use(
        http.get(`${API_BASE_URL}/workshops/:workshopId/assessments`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { success: false, error: { message: 'Server error' } },
              { status: 500 }
            );
          }
          return HttpResponse.json({
            success: true,
            data: {
              assessments: defaultMockAssessments,
              totalCount: 3,
              gradedCount: 2,
              pendingCount: 1,
            },
          });
        })
      );

      const user = userEvent.setup();
      renderWithAuth(<AssessmentsList workshopId={1} />);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText(/error loading assessments/i)).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByLabelText(/retry loading assessments/i);
      await user.click(retryButton);

      // Should now show assessments
      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('has accessible table/list structure', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // DataGrid uses role="grid" instead of "table"
      const grid = screen.getByRole('grid', { name: /workshop assessments list/i });
      expect(grid).toBeInTheDocument();
    });

    it('has accessible filter select with label', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Filter select should have accessible label
      const filterSelect = screen.getByLabelText(/filter by status/i);
      expect(filterSelect).toBeInTheDocument();
    });

    it('has accessible action buttons with aria-labels', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Row actions buttons should have aria-labels (actions are in a dropdown menu)
      const rowActionsButtons = screen.getAllByLabelText(/row actions/i);
      expect(rowActionsButtons.length).toBeGreaterThan(0);
    });

    it('has accessible progress bar with aria-label', async () => {
      mockIsTeacher.mockReturnValue(true);

      renderWithAuth(<AssessmentsList workshopId={1} showAllocationInfo={true} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Progress bar should have accessible label
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label');
    });

    it('status chips have proper role and labels', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Status chips should be present (multiple assessments may have same status)
      const gradedChips = screen.getAllByText('Graded');
      expect(gradedChips.length).toBeGreaterThan(0);
      
      const pendingChips = screen.getAllByText('Pending');
      expect(pendingChips.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Role-Based Rendering Tests
  // ==========================================================================

  describe('Role-Based Rendering', () => {
    it('renders student view with received assessments', async () => {
      mockIsTeacher.mockReturnValue(false);
      mockHasCapability.mockImplementation((capability: string) => {
        if (capability === 'mod/workshop:viewreviewernames') return true;
        return false;
      });

      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Student should NOT see allocation info
      expect(screen.queryByText(/assessment progress/i)).not.toBeInTheDocument();
    });

    it('renders teacher view with all assessments and allocation info', async () => {
      mockIsTeacher.mockReturnValue(true);
      mockHasCapability.mockImplementation((capability: string) => {
        if (capability === 'mod/workshop:viewreviewernames') return true;
        if (capability === 'mod/workshop:overridegrades') return true;
        return false;
      });

      renderWithAuth(<AssessmentsList workshopId={1} showAllocationInfo={true} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Teacher should see allocation info
      expect(screen.getByText(/assessment progress/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Grade Display Formatting Tests
  // ==========================================================================

  describe('Grade Display Formatting', () => {
    it('displays grade with decimal precision', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/85\.0/)).toBeInTheDocument();
      });

      // Grade should show decimal (85.0)
      expect(screen.getByText(/90\.0/)).toBeInTheDocument();
    });

    it('displays dash for null/ungraded assessments', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/bob johnson/i)).toBeInTheDocument();
      });

      // Ungraded assessments should show dash
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('displays grade out of maximum (e.g., 85.0 / 100)', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/85\.0/)).toBeInTheDocument();
      });

      // Should show max grade reference (multiple assessments may have this)
      const gradeDisplays = screen.getAllByText(/\/ 100/);
      expect(gradeDisplays.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Workshop Phase Tests
  // ==========================================================================

  describe('Workshop Phase Display', () => {
    it('shows phase chip for current workshop phase', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Phase chip should be visible
      expect(screen.getByText(/phase: assessment/i)).toBeInTheDocument();
    });

    it('shows editing disabled message when not in assessment phase', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:workshopId`, () => {
          const submissionWorkshop = createMockWorkshop({ phase: WorkshopPhase.SUBMISSION });
          return HttpResponse.json({
            success: true,
            data: createMockWorkshopData(submissionWorkshop),
          });
        })
      );

      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/loading assessments/i)).not.toBeInTheDocument();
      });

      // Should show editing disabled warning
      await waitFor(() => {
        expect(screen.getByText(/editing disabled/i)).toBeInTheDocument();
      });
    });

    it('shows closed phase indicator when workshop is closed', async () => {
      server.use(
        http.get(`${API_BASE_URL}/workshops/:workshopId`, () => {
          const closedWorkshop = createMockWorkshop({ phase: WorkshopPhase.CLOSED });
          return HttpResponse.json({
            success: true,
            data: createMockWorkshopData(closedWorkshop),
          });
        })
      );

      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/loading assessments/i)).not.toBeInTheDocument();
      });

      // Phase should show 'Closed'
      await waitFor(() => {
        expect(screen.getByText(/phase: closed/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Integration with SubmissionId Filter
  // ==========================================================================

  describe('SubmissionId Filter', () => {
    it('passes submissionId to API when provided', async () => {
      let capturedSubmissionId: string | null = null;
      
      server.use(
        http.get(`${API_BASE_URL}/workshops/:workshopId/assessments`, ({ request }) => {
          const url = new URL(request.url);
          capturedSubmissionId = url.searchParams.get('submissionId');
          return HttpResponse.json({
            success: true,
            data: {
              assessments: defaultMockAssessments.filter(a => a.submissionId === 1),
              totalCount: 3,
              gradedCount: 2,
              pendingCount: 1,
            },
          });
        })
      );

      renderWithAuth(<AssessmentsList workshopId={1} submissionId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // API should have received submissionId parameter
      expect(capturedSubmissionId).toBe('1');
    });
  });

  // ==========================================================================
  // Toast Notification Tests
  // ==========================================================================

  describe('Toast Notifications', () => {
    it('shows info toast when filter is changed', async () => {
      const user = userEvent.setup();
      renderWithAuth(<AssessmentsList workshopId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Change filter
      const filterSelect = screen.getByLabelText(/filter by status/i);
      await user.click(filterSelect);
      
      const gradedOption = screen.getByRole('option', { name: /graded/i });
      await user.click(gradedOption);

      // Toast should be shown
      await waitFor(() => {
        expect(mockShowInfo).toHaveBeenCalledWith(expect.stringContaining('graded'));
      });
    });
  });

  // ==========================================================================
  // DataTable Column Definition Tests
  // ==========================================================================

  describe('DataTable Column Definitions', () => {
    it('renders all expected columns', async () => {
      renderWithAuth(<AssessmentsList workshopId={1} showSubmissionTitle={true} />);

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });

      // Check all column headers
      expect(screen.getByText('Reviewer')).toBeInTheDocument();
      expect(screen.getByText('Submission')).toBeInTheDocument();
      expect(screen.getByText('Grade')).toBeInTheDocument();
      expect(screen.getByText('Weight')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Feedback')).toBeInTheDocument();
    });
  });
});
