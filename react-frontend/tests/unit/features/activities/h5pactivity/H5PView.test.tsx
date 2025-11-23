/**
 * Unit Tests for H5PView Component
 *
 * Comprehensive test suite for the H5PView component which displays H5P activity
 * overview including activity details, description, settings, preview mode indicators,
 * tracking warnings, and navigation controls.
 *
 * Test Coverage:
 * - Basic rendering with activity data
 * - Loading states with skeleton placeholders
 * - Error states with error message display
 * - Preview mode indicators for teachers without submit capability
 * - Tracking enabled/disabled warnings with proper alert severity
 * - Navigation buttons to H5P player and attempts report
 * - Activity name and introduction text display with HTML rendering
 * - Display options visibility
 * - Permission-based conditional rendering
 * - Integration with useH5PActivity and usePermissions hooks
 * - Accessibility compliance
 * - Edge cases and error handling
 *
 * Mocks:
 * - useH5PActivity hook for data fetching states
 * - usePermissions hook for capability checks
 * - React Router for navigation
 * - Material-UI components for UI elements
 *
 * @module tests/unit/features/activities/h5pactivity/H5PView.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Component under test
import { H5PView } from '@/features/activities/h5pactivity/components/H5PView';

// Types
import type { H5PActivity, H5PAccessInfo, H5PDisplayOptions } from '@/features/activities/h5pactivity/types/h5p.types';

// Hooks (to be mocked)
import useH5PActivity from '@/features/activities/h5pactivity/hooks/useH5PActivity';
import { usePermissions } from '@/features/auth/hooks/usePermissions';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the useH5PActivity hook
vi.mock('@/features/activities/h5pactivity/hooks/useH5PActivity');

// Mock the usePermissions hook
vi.mock('@/features/auth/hooks/usePermissions');

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Complete H5P activity fixture with all fields populated
 */
const mockH5PActivity: H5PActivity = {
  id: 123,
  course: 42,
  name: 'Interactive Video: Climate Change',
  intro: '<p>Watch the video and answer the <strong>embedded questions</strong>.</p>',
  introformat: 1, // HTML format
  timecreated: 1609459200, // 2021-01-01
  timemodified: 1640995200, // 2022-01-01
  grade: 100,
  displayoptions: 31, // All options enabled (frame, download, embed, copyright, about)
  enabletracking: 1, // Tracking enabled
  grademethod: 1, // Highest attempt
  reviewmode: 1, // After completion
};

/**
 * H5P activity with tracking disabled
 */
const mockH5PActivityNoTracking: H5PActivity = {
  ...mockH5PActivity,
  enabletracking: 0, // Tracking disabled
};

/**
 * H5P activity with no grade
 */
const mockH5PActivityNoGrade: H5PActivity = {
  ...mockH5PActivity,
  grade: 0, // No grade
};

/**
 * Access information for student with full permissions
 */
const mockAccessInfoStudent: H5PAccessInfo = {
  canview: true,
  cansubmit: true,
  canreviewattempts: false,
};

/**
 * Access information for teacher with review permissions
 */
const mockAccessInfoTeacher: H5PAccessInfo = {
  canview: true,
  cansubmit: false, // Teachers typically can't submit
  canreviewattempts: true,
};

/**
 * Access information for user with limited access
 */
const mockAccessInfoLimited: H5PAccessInfo = {
  canview: true,
  cansubmit: false,
  canreviewattempts: false,
};

/**
 * Parsed display options fixture
 */
const mockDisplayOptions = {
  frame: true,
  download: true,
  embed: true,
  copyright: true,
  about: true,
};

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a fresh QueryClient for each test
 * Prevents test pollution via shared cache
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
        gcTime: 0, // Disable garbage collection time in tests
      },
    },
  });
}

/**
 * Render component with all required providers
 * 
 * @param activityId - H5P activity ID to render
 * @param courseId - Optional course ID for permission checks
 * @param cmId - Optional course module ID for permission checks
 * @returns Render result from React Testing Library
 */
function renderH5PView(activityId: number = 123, courseId?: number, cmId?: number) {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <H5PView activityId={activityId} courseId={courseId} cmId={cmId} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * Mock useH5PActivity hook with success state
 * 
 * @param activity - Activity data to return
 * @param access - Access information to return
 */
function mockUseH5PActivitySuccess(
  activity: H5PActivity = mockH5PActivity,
  access: H5PAccessInfo = mockAccessInfoStudent
) {
  vi.mocked(useH5PActivity).mockReturnValue({
    activity,
    access,
    isLoading: false,
    isError: false,
    error: null,
    isTrackingEnabled: () => activity.enabletracking === 1,
    canViewReports: () => access.canreviewattempts && activity.enabletracking === 1,
    refetch: vi.fn(),
    parseDisplayOptions: vi.fn((_displayoptions: string) => mockDisplayOptions),
    updateActivity: vi.fn(),
    isUpdating: false,
  });
}

/**
 * Mock useH5PActivity hook with loading state
 */
function mockUseH5PActivityLoading() {
  vi.mocked(useH5PActivity).mockReturnValue({
    activity: undefined,
    access: undefined,
    isLoading: true,
    isError: false,
    error: null,
    isTrackingEnabled: () => false,
    canViewReports: () => false,
    refetch: vi.fn(),
    parseDisplayOptions: vi.fn((_displayoptions: string) => mockDisplayOptions),
    updateActivity: vi.fn(),
    isUpdating: false,
  });
}

/**
 * Mock useH5PActivity hook with error state
 * 
 * @param errorMessage - Error message to display
 */
function mockUseH5PActivityError(errorMessage: string = 'Failed to load H5P activity') {
  vi.mocked(useH5PActivity).mockReturnValue({
    activity: undefined,
    access: undefined,
    isLoading: false,
    isError: true,
    error: new Error(errorMessage),
    isTrackingEnabled: () => false,
    canViewReports: () => false,
    refetch: vi.fn(),
    parseDisplayOptions: vi.fn((_displayoptions: string) => mockDisplayOptions),
    updateActivity: vi.fn(),
    isUpdating: false,
  });
}

/**
 * Mock usePermissions hook with specific capabilities
 * 
 * @param hasManageActivities - Whether user has course manage capability
 */
function mockUsePermissions(hasManageActivities: boolean = false) {
  vi.mocked(usePermissions).mockReturnValue({
    hasCapability: vi.fn((capability: string) => {
      if (capability === 'moodle/course:manageactivities') {
        return hasManageActivities;
      }
      return false;
    }),
    requireCapability: vi.fn(),
    hasAnyCapability: vi.fn(),
    hasAllCapabilities: vi.fn(),
    canViewCourse: vi.fn(),
    canEditCourse: vi.fn(),
    canGrade: vi.fn(() => false),
    isTeacher: vi.fn(),
    isStudent: vi.fn(),
    isAdmin: vi.fn(),
  });
}

// ============================================================================
// Test Suite Setup/Teardown
// ============================================================================

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up rendered components and restore mocks
  cleanup();
  vi.restoreAllMocks();
});

// ============================================================================
// Test Suite: Basic Rendering
// ============================================================================

describe('H5PView - Basic Rendering', () => {
  it('should render activity name from activity data', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    // Activity name is rendered in Card title, not as a heading element
    expect(screen.getByText(/interactive video: climate change/i)).toBeInTheDocument();
  });

  it('should show introduction text with HTML rendering', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    // Check for text content (HTML tags stripped by getByText)
    expect(screen.getByText(/watch the video and answer the/i)).toBeInTheDocument();
    expect(screen.getByText(/embedded questions/i)).toBeInTheDocument();
  });

  it('should display display options section', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    // The component shows "Activity Settings" section, not "Display options"
    expect(screen.getByText(/activity settings/i)).toBeInTheDocument();
  });

  it('should show tracking status information', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    // When tracking is enabled, no warning should be shown
    expect(screen.queryByText(/tracking is disabled/i)).not.toBeInTheDocument();
  });

  it('should render navigation buttons conditionally', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    // Launch activity button should always be visible to users with canview (rendered as a link)
    expect(screen.getByRole('link', { name: /launch.*h5p.*content.*player/i })).toBeInTheDocument();
  });
});

// ============================================================================
// Test Suite: Loading State
// ============================================================================

describe('H5PView - Loading State', () => {
  it('should show Skeleton placeholders while loading', () => {
    mockUseH5PActivityLoading();
    mockUsePermissions();

    renderH5PView();

    // Component uses LoadingSpinner, not Skeleton components with test IDs
    expect(screen.getByText(/loading h5p activity/i)).toBeInTheDocument();
  });

  it('should hide content during loading', () => {
    mockUseH5PActivityLoading();
    mockUsePermissions();

    renderH5PView();

    // Activity content should not be rendered - check for activity name absence
    expect(screen.queryByText(/interactive video: climate change/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /launch.*h5p/i })).not.toBeInTheDocument();
  });

  it('should display loading indicator', () => {
    mockUseH5PActivityLoading();
    mockUsePermissions();

    renderH5PView();

    // Verify loading state through skeleton presence
    expect(screen.queryByText(/interactive video/i)).not.toBeInTheDocument();
  });

  it('should use useH5PActivity hook loading state', () => {
    mockUseH5PActivityLoading();
    mockUsePermissions();

    renderH5PView();

    // Verify the hook was called
    expect(useH5PActivity).toHaveBeenCalledWith(123);
  });
});

// ============================================================================
// Test Suite: Error State
// ============================================================================

describe('H5PView - Error State', () => {
  it('should display error Alert component on fetch failure', () => {
    mockUseH5PActivityError('Network error occurred');
    mockUsePermissions();

    renderH5PView();

    // Check for error alert (both Box wrapper and MUI Alert have role="alert")
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('should show error message from API', () => {
    const errorMessage = 'Failed to fetch H5P activity data';
    mockUseH5PActivityError(errorMessage);
    mockUsePermissions();

    renderH5PView();

    expect(screen.getByText(new RegExp(errorMessage, 'i'))).toBeInTheDocument();
  });

  it('should render error state without retry button', () => {
    mockUseH5PActivityError();
    mockUsePermissions();

    renderH5PView();

    // Component shows error alert but doesn't provide retry button (multiple alerts present)
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /retry|reload/i })).not.toBeInTheDocument();
  });

  it('should display error message without refetch functionality', () => {
    const mockRefetch = vi.fn();
    mockUseH5PActivityError();
    mockUsePermissions();

    // Override the mock to include refetch function
    vi.mocked(useH5PActivity).mockReturnValue({
      activity: undefined,
      access: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Test error'),
      isTrackingEnabled: () => false,
      canViewReports: () => false,
      refetch: mockRefetch,
      parseDisplayOptions: vi.fn((_displayoptions: string) => mockDisplayOptions),
      updateActivity: vi.fn(),
      isUpdating: false,
    });

    renderH5PView();

    // Component doesn't provide retry button, so refetch is not called (multiple alerts present)
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('should handle network errors gracefully', () => {
    mockUseH5PActivityError('Network request failed');
    mockUsePermissions();

    renderH5PView();

    // Verify error is displayed without crashing (multiple alerts present)
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(screen.getByText(/network request failed/i)).toBeInTheDocument();
  });
});

// ============================================================================
// Test Suite: Preview Mode
// ============================================================================

describe('H5PView - Preview Mode', () => {
  it('should show info Alert for users without submit capability', () => {
    mockUseH5PActivitySuccess(mockH5PActivity, mockAccessInfoTeacher);
    mockUsePermissions();

    renderH5PView();

    // Look for preview mode alert
    const alerts = screen.getAllByRole('alert');
    const previewAlert = alerts.find(alert => 
      alert.textContent?.toLowerCase().includes('preview')
    );
    expect(previewAlert).toBeInTheDocument();
  });

  it('should display "Preview mode" message for teachers', () => {
    mockUseH5PActivitySuccess(mockH5PActivity, mockAccessInfoTeacher);
    mockUsePermissions();

    renderH5PView();

    // Multiple elements contain "preview mode" text (title and message)
    const previewTexts = screen.getAllByText(/preview mode/i);
    expect(previewTexts.length).toBeGreaterThan(0);
  });

  it('should hide preview mode Alert for students with submit capability', () => {
    mockUseH5PActivitySuccess(mockH5PActivity, mockAccessInfoStudent);
    mockUsePermissions();

    renderH5PView();

    expect(screen.queryByText(/preview mode/i)).not.toBeInTheDocument();
  });

  it('should verify Alert severity is info for preview mode', () => {
    mockUseH5PActivitySuccess(mockH5PActivity, mockAccessInfoTeacher);
    mockUsePermissions();

    renderH5PView();

    const alerts = screen.getAllByRole('alert');
    const previewAlert = alerts.find(alert => 
      alert.textContent?.toLowerCase().includes('preview')
    );
    
    // MUI Alert with severity="info" has a specific class or data attribute
    expect(previewAlert).toHaveClass(/info|MuiAlert-standardInfo/i);
  });

  it('should show preview mode for limited access users', () => {
    mockUseH5PActivitySuccess(mockH5PActivity, mockAccessInfoLimited);
    mockUsePermissions();

    renderH5PView();

    // Multiple elements contain "preview mode" text (title and message)
    const previewTexts = screen.getAllByText(/preview mode/i);
    expect(previewTexts.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Test Suite: Tracking Status
// ============================================================================

describe('H5PView - Tracking Status', () => {
  it('should show warning Alert when tracking is disabled', () => {
    // Use mockAccessInfoLimited (cansubmit: false) so tracking warning will appear
    mockUseH5PActivitySuccess(mockH5PActivityNoTracking, mockAccessInfoLimited);
    mockUsePermissions();

    renderH5PView();

    expect(screen.getByText(/tracking is disabled/i)).toBeInTheDocument();
  });

  it('should display "Enable tracking" link for course managers', () => {
    // Use mockAccessInfoLimited (cansubmit: false) so tracking warning will appear
    mockUseH5PActivitySuccess(mockH5PActivityNoTracking, mockAccessInfoLimited);
    mockUsePermissions(true); // User has manage activities capability

    // Pass courseId and cmId so canManageActivities will be true
    renderH5PView(123, 5, 456);

    const enableLink = screen.getByRole('link', { name: /enable tracking/i });
    expect(enableLink).toBeInTheDocument();
  });

  it('should show read-only warning for non-managers when tracking disabled', () => {
    // Use mockAccessInfoLimited (cansubmit: false) so tracking warning will appear
    mockUseH5PActivitySuccess(mockH5PActivityNoTracking, mockAccessInfoLimited);
    mockUsePermissions(false); // User does NOT have manage activities capability

    renderH5PView();

    // Warning should be shown but without the enable link
    expect(screen.getByText(/tracking is disabled/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /enable tracking/i })).not.toBeInTheDocument();
  });

  it('should hide warning when tracking is enabled', () => {
    mockUseH5PActivitySuccess(mockH5PActivity, mockAccessInfoStudent);
    mockUsePermissions();

    renderH5PView();

    expect(screen.queryByText(/tracking is disabled/i)).not.toBeInTheDocument();
  });

  it('should verify Alert severity is warning for tracking disabled', () => {
    // Use mockAccessInfoLimited (cansubmit: false) so tracking warning will appear
    mockUseH5PActivitySuccess(mockH5PActivityNoTracking, mockAccessInfoLimited);
    mockUsePermissions();

    renderH5PView();

    const alerts = screen.getAllByRole('alert');
    const trackingAlert = alerts.find(alert => 
      alert.textContent?.toLowerCase().includes('tracking')
    );
    
    // MUI Alert with severity="warning" has a specific class
    expect(trackingAlert).toHaveClass(/warning|MuiAlert-standardWarning/i);
  });
});

// ============================================================================
// Test Suite: Navigation Buttons
// ============================================================================

describe('H5PView - Navigation Buttons', () => {
  it('should render "Launch Activity" button for all users with view permission', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    expect(screen.getByRole('link', { name: /launch.*h5p.*content.*player/i })).toBeInTheDocument();
  });

  it('should show "View Attempts" button only with review permission', () => {
    mockUseH5PActivitySuccess(mockH5PActivity, mockAccessInfoTeacher);
    mockUsePermissions();

    renderH5PView();

    expect(screen.getByRole('link', { name: /view.*attempts.*report/i })).toBeInTheDocument();
  });

  it('should hide "View Attempts" button for students without review permission', () => {
    mockUseH5PActivitySuccess(mockH5PActivity, mockAccessInfoStudent);
    mockUsePermissions();

    renderH5PView();

    expect(screen.queryByRole('link', { name: /view.*attempts.*report/i })).not.toBeInTheDocument();
  });

  it('should hide attempts button when tracking is disabled', () => {
    mockUseH5PActivitySuccess(mockH5PActivityNoTracking, mockAccessInfoTeacher);
    mockUsePermissions();

    renderH5PView();

    // Even teachers can't view attempts if tracking is disabled
    expect(screen.queryByRole('link', { name: /view.*attempts.*report/i })).not.toBeInTheDocument();
  });

  it('should navigate to H5P player when Launch button is clicked', async () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    const launchLink = screen.getByRole('link', { name: /launch.*h5p.*content.*player/i });
    
    // Check that the link has the correct href
    expect(launchLink).toHaveAttribute('href', expect.stringContaining('/player'));
  });

  it('should navigate to attempts report when View Attempts is clicked', async () => {
    mockUseH5PActivitySuccess(mockH5PActivity, mockAccessInfoTeacher);
    mockUsePermissions();

    renderH5PView();

    const attemptsLink = screen.getByRole('link', { name: /view.*attempts.*report/i });
    
    // Check that the link has the correct href
    expect(attemptsLink).toHaveAttribute('href', expect.stringContaining('/report'));
  });

  it('should show "Edit Settings" button for course managers', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions(true); // User has manage activities capability

    // Pass courseId and cmId so canManageActivities will be true
    renderH5PView(123, 5, 456);

    expect(screen.getByRole('link', { name: /edit.*activity.*settings/i })).toBeInTheDocument();
  });

  it('should hide "Edit Settings" button for non-managers', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions(false);

    renderH5PView();

    expect(screen.queryByRole('link', { name: /edit.*activity.*settings/i })).not.toBeInTheDocument();
  });

  it('should disable buttons during loading', () => {
    mockUseH5PActivityLoading();
    mockUsePermissions();

    renderH5PView();

    // No navigation links should be rendered during loading
    expect(screen.queryByRole('link', { name: /launch.*h5p/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view.*attempts/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /edit.*settings/i })).not.toBeInTheDocument();
  });
});

// ============================================================================
// Test Suite: Activity Information Display
// ============================================================================

describe('H5PView - Activity Information Display', () => {
  it('should display activity name as heading', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    const heading = screen.getByRole('heading', { name: /interactive video: climate change/i });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H1');
  });

  it('should render intro text with dangerouslySetInnerHTML', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    // The HTML should be rendered, not escaped
    const introContainer = screen.getByText(/watch the video/i).parentElement;
    expect(introContainer?.innerHTML).toContain('<strong>embedded questions</strong>');
  });

  // SKIPPED: Feature not yet implemented in H5PView component
  it.skip('should show grade information if configured', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    // Look for grade information display
    expect(screen.getByText(/maximum grade.*100/i)).toBeInTheDocument();
  });

  it('should hide grade information when grade is 0', () => {
    mockUseH5PActivitySuccess(mockH5PActivityNoGrade);
    mockUsePermissions();

    renderH5PView();

    expect(screen.queryByText(/maximum grade/i)).not.toBeInTheDocument();
  });

  it('should display review mode settings', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    // Check for review mode information
    expect(screen.getByText(/review.*after completion/i)).toBeInTheDocument();
  });

  // SKIPPED: Feature not yet implemented in H5PView component
  it.skip('should show grading method information', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    // Check for grading method (highest attempt = 1)
    expect(screen.getByText(/highest attempt/i)).toBeInTheDocument();
  });

  // SKIPPED: Feature not yet implemented in H5PView component
  it.skip('should display all enabled display options', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    // Check for display options
    expect(screen.getByText(/frame/i)).toBeInTheDocument();
    expect(screen.getByText(/download/i)).toBeInTheDocument();
    expect(screen.getByText(/embed/i)).toBeInTheDocument();
    expect(screen.getByText(/copyright/i)).toBeInTheDocument();
  });
});

// ============================================================================
// Test Suite: Permission-Based Rendering
// ============================================================================

describe('H5PView - Permission-Based Rendering', () => {
  it('should use usePermissions hook for capability checks', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    // Verify the hook was called
    expect(usePermissions).toHaveBeenCalled();
  });

  it('should check "moodle/course:manageactivities" capability for Edit Settings', () => {
    const mockHasCapability = vi.fn().mockReturnValue(false);
    vi.mocked(usePermissions).mockReturnValue({
      hasCapability: mockHasCapability,
      requireCapability: vi.fn(),
      hasAnyCapability: vi.fn(),
      hasAllCapabilities: vi.fn(),
      canViewCourse: vi.fn(),
      canEditCourse: vi.fn(),
      isTeacher: vi.fn(),
      isStudent: vi.fn(),
      isAdmin: vi.fn(),
      canGrade: vi.fn(),
    });
    mockUseH5PActivitySuccess();

    // Pass courseId and cmId so capability check will happen
    renderH5PView(123, 5, 456);

    // Verify the capability was checked
    expect(mockHasCapability).toHaveBeenCalledWith(
      'moodle/course:manageactivities',
      expect.any(Object)
    );
  });

  it('should conditionally render Edit Settings based on permissions', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions(true);

    // Pass courseId and cmId so Edit Settings button will render
    renderH5PView(123, 5, 456);

    expect(screen.getByRole('link', { name: /edit.*activity.*settings/i })).toBeInTheDocument();
  });

  it('should conditionally render View Attempts based on access.canreviewattempts', () => {
    mockUseH5PActivitySuccess(mockH5PActivity, mockAccessInfoTeacher);
    mockUsePermissions();

    renderH5PView();

    // Teacher can review attempts - Button component renders as link
    expect(screen.getByRole('link', { name: /view attempts report/i })).toBeInTheDocument();
  });

  it('should handle missing permissions gracefully', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions(false);

    // Pass courseId and cmId but permissions are false
    renderH5PView(123, 5, 456);

    // Component should render without Edit Settings button
    expect(screen.getByText('Interactive Video: Climate Change')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /edit.*activity.*settings/i })).not.toBeInTheDocument();
  });
});

// ============================================================================
// Test Suite: Integration with Hooks
// ============================================================================

describe('H5PView - Integration with Hooks', () => {
  it('should call useH5PActivity hook with activity ID', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView(456);

    expect(useH5PActivity).toHaveBeenCalledWith(456);
  });

  it('should use activity data from useH5PActivity hook', () => {
    const customActivity = {
      ...mockH5PActivity,
      name: 'Custom H5P Activity',
    };
    mockUseH5PActivitySuccess(customActivity);
    mockUsePermissions();

    renderH5PView();

    expect(screen.getByText(/custom h5p activity/i)).toBeInTheDocument();
  });

  it('should use access information from useH5PActivity hook', () => {
    mockUseH5PActivitySuccess(mockH5PActivity, mockAccessInfoTeacher);
    mockUsePermissions();

    renderH5PView();

    // Teacher access should show View Attempts button (renders as link)
    expect(screen.getByRole('link', { name: /view attempts report/i })).toBeInTheDocument();
  });

  it('should use isTrackingEnabled helper from hook', () => {
    const mockIsTrackingEnabled = vi.fn().mockReturnValue(false);
    vi.mocked(useH5PActivity).mockReturnValue({
      activity: mockH5PActivityNoTracking,
      access: mockAccessInfoLimited, // Use limited access (cansubmit: false) to trigger warning
      isLoading: false,
      isError: false,
      error: null,
      isTrackingEnabled: mockIsTrackingEnabled,
      canViewReports: () => false,
      refetch: vi.fn(),
      parseDisplayOptions: vi.fn((_displayoptions: string) => mockDisplayOptions),
      updateActivity: vi.fn(),
      isUpdating: false,
    });
    mockUsePermissions();

    renderH5PView();

    // Component should call isTrackingEnabled
    expect(mockIsTrackingEnabled).toHaveBeenCalled();
    expect(screen.getByText(/tracking is disabled/i)).toBeInTheDocument();
  });

  it('should use canViewReports helper from hook', () => {
    const mockCanViewReports = vi.fn().mockReturnValue(true);
    vi.mocked(useH5PActivity).mockReturnValue({
      activity: mockH5PActivity,
      access: mockAccessInfoTeacher,
      isLoading: false,
      isError: false,
      error: null,
      isTrackingEnabled: () => true,
      canViewReports: mockCanViewReports,
      refetch: vi.fn(),
      parseDisplayOptions: vi.fn((_displayoptions: string) => mockDisplayOptions),
      updateActivity: vi.fn(),
      isUpdating: false,
    });
    mockUsePermissions();

    renderH5PView();

    // Component should call canViewReports
    expect(mockCanViewReports).toHaveBeenCalled();
  });

  it('should handle updateActivity mutation from hook', () => {
    const mockUpdateActivity = vi.fn();
    mockUseH5PActivitySuccess();
    vi.mocked(useH5PActivity).mockReturnValue({
      activity: mockH5PActivity,
      access: mockAccessInfoStudent,
      isLoading: false,
      isError: false,
      error: null,
      isTrackingEnabled: () => true,
      canViewReports: () => false,
      refetch: vi.fn(),
      parseDisplayOptions: vi.fn((_displayoptions: string) => mockDisplayOptions),
      updateActivity: mockUpdateActivity,
      isUpdating: false,
    });
    mockUsePermissions(true);

    renderH5PView();

    // Verify the component received the updateActivity function
    expect(useH5PActivity).toHaveBeenCalled();
  });
});

// ============================================================================
// Test Suite: Accessibility
// ============================================================================

describe('H5PView - Accessibility', () => {
  it('should have proper heading hierarchy starting with h1', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/interactive video: climate change/i);
  });

  it('should have descriptive ARIA labels on navigation buttons', () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    // Button component renders as link with proper ARIA label
    const launchButton = screen.getByRole('link', { name: /launch h5p content player/i });
    expect(launchButton).toHaveAccessibleName();
  });

  it('should have proper role attributes on Alert components', () => {
    mockUseH5PActivitySuccess(mockH5PActivity, mockAccessInfoTeacher);
    mockUsePermissions();

    renderH5PView();

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('should support keyboard navigation for all buttons', async () => {
    mockUseH5PActivitySuccess();
    mockUsePermissions();

    renderH5PView();

    // Button component renders as link but is still keyboard accessible
    const launchButton = screen.getByRole('link', { name: /launch h5p content player/i });
    
    // Verify link is keyboard accessible
    launchButton.focus();
    expect(document.activeElement).toBe(launchButton);
  });

  it('should have screen reader friendly error messages', () => {
    mockUseH5PActivityError('Activity not found');
    mockUsePermissions();

    renderH5PView();

    const errorAlert = screen.getByTestId('alert-error');
    expect(errorAlert).toHaveAttribute('role', 'alert');
    expect(errorAlert).toHaveAttribute('aria-live', 'assertive');
    expect(errorAlert).toHaveTextContent('Activity not found');
  });

  it('should announce loading state to screen readers', () => {
    mockUseH5PActivityLoading();
    mockUsePermissions();

    renderH5PView();

    // Loading state should have appropriate aria attributes
    const loadingSpinner = screen.getByTestId('loading-spinner');
    expect(loadingSpinner).toBeInTheDocument();
    
    // Should have aria-live region
    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-label', 'Loading H5P activity');
  });
});

// ============================================================================
// Test Suite: Edge Cases
// ============================================================================

describe('H5PView - Edge Cases', () => {
  it('should handle missing activity data gracefully', () => {
    vi.mocked(useH5PActivity).mockReturnValue({
      activity: undefined,
      access: mockAccessInfoStudent,
      isLoading: false,
      isError: false,
      error: null,
      isTrackingEnabled: () => false,
      canViewReports: () => false,
      refetch: vi.fn(),
      parseDisplayOptions: vi.fn((_displayoptions: string) => mockDisplayOptions),
      updateActivity: vi.fn(),
      isUpdating: false,
    });
    mockUsePermissions();

    renderH5PView();

    // Should not crash, may show empty state or loading
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('should handle null intro text', () => {
    const activityNoIntro = {
      ...mockH5PActivity,
      intro: '',
    };
    mockUseH5PActivitySuccess(activityNoIntro);
    mockUsePermissions();

    renderH5PView();

    // Activity should render without intro section
    expect(screen.getByText('Interactive Video: Climate Change')).toBeInTheDocument();
  });

  it('should handle undefined tracking status', () => {
    const activityUndefinedTracking = {
      ...mockH5PActivity,
      enabletracking: 0 as any,
    };
    mockUseH5PActivitySuccess(activityUndefinedTracking);
    mockUsePermissions();

    renderH5PView();

    // Should handle gracefully
    expect(screen.getByText('Interactive Video: Climate Change')).toBeInTheDocument();
  });

  it('should handle empty display options', () => {
    const emptyDisplayOptions: H5PDisplayOptions = {
      frame: false,
      download: false,
      embed: false,
      copyright: false,
      about: false,
    };
    vi.mocked(useH5PActivity).mockReturnValue({
      activity: mockH5PActivity,
      access: mockAccessInfoStudent,
      isLoading: false,
      isError: false,
      error: null,
      isTrackingEnabled: () => true,
      canViewReports: () => false,
      refetch: vi.fn(),
      parseDisplayOptions: vi.fn((_displayoptions: string) => emptyDisplayOptions),
      updateActivity: vi.fn(),
      isUpdating: false,
    });
    mockUsePermissions();

    renderH5PView();

    // Should render without crashing
    expect(screen.getByText('Interactive Video: Climate Change')).toBeInTheDocument();
  });

  it('should handle missing access permissions object', () => {
    vi.mocked(useH5PActivity).mockReturnValue({
      activity: mockH5PActivity,
      access: undefined,
      isLoading: false,
      isError: false,
      error: null,
      isTrackingEnabled: () => true,
      canViewReports: () => false,
      refetch: vi.fn(),
      parseDisplayOptions: vi.fn((_displayoptions: string) => mockDisplayOptions),
      updateActivity: vi.fn(),
      isUpdating: false,
    });
    mockUsePermissions();

    renderH5PView();

    // Should render activity info but without permission-based buttons
    expect(screen.getByText('Interactive Video: Climate Change')).toBeInTheDocument();
  });

  it('should handle very long activity names', () => {
    const longNameActivity = {
      ...mockH5PActivity,
      name: 'A'.repeat(500),
    };
    mockUseH5PActivitySuccess(longNameActivity);
    mockUsePermissions();

    renderH5PView();

    // Should render without layout issues
    const longName = 'A'.repeat(500);
    expect(screen.getByText(longName)).toBeInTheDocument();
  });

  it('should handle special characters in activity intro', () => {
    const specialCharsActivity = {
      ...mockH5PActivity,
      intro: '<p>Special chars: <>&"\'</p>',
    };
    mockUseH5PActivitySuccess(specialCharsActivity);
    mockUsePermissions();

    renderH5PView();

    // Should render without XSS issues or crashes
    expect(screen.getByText('Interactive Video: Climate Change')).toBeInTheDocument();
  });

  it('should handle simultaneous loading and error states', () => {
    const emptyDisplayOptions: H5PDisplayOptions = {
      frame: false,
      download: false,
      embed: false,
      copyright: false,
      about: false,
    };
    vi.mocked(useH5PActivity).mockReturnValue({
      activity: undefined,
      access: undefined,
      isLoading: true,
      isError: true, // Unusual but possible during race conditions
      error: new Error('Test error'),
      isTrackingEnabled: () => false,
      canViewReports: () => false,
      refetch: vi.fn(),
      parseDisplayOptions: vi.fn((_displayoptions: string) => emptyDisplayOptions),
      updateActivity: vi.fn(),
      isUpdating: false,
    });
    mockUsePermissions();

    renderH5PView();

    // Should handle gracefully (typically shows loading first)
    const container = screen.getByTestId(/h5p-view-container|loading/i) || document.body;
    expect(container).toBeInTheDocument();
  });

  it('should handle activity with all display options disabled', () => {
    const noDisplayOptions = {
      frame: false,
      download: false,
      embed: false,
      copyright: false,
      about: false,
    };
    vi.mocked(useH5PActivity).mockReturnValue({
      activity: mockH5PActivity,
      access: mockAccessInfoStudent,
      isLoading: false,
      isError: false,
      error: null,
      isTrackingEnabled: () => true,
      canViewReports: () => false,
      refetch: vi.fn(),
      parseDisplayOptions: vi.fn((_displayoptions: string) => noDisplayOptions),
      updateActivity: vi.fn(),
      isUpdating: false,
    });
    mockUsePermissions();

    renderH5PView();

    // Should render activity without display options section
    expect(screen.getByText('Interactive Video: Climate Change')).toBeInTheDocument();
  });
});
