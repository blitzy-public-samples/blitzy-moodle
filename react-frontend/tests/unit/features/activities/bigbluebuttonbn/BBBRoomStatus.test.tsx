/**
 * BBBRoomStatus Component Unit Tests
 *
 * Comprehensive test suite for the BBBRoomStatus component that displays
 * real-time BigBlueButton meeting room status including:
 * - Session running state ('Meeting in Progress' or 'Meeting Not Started')
 * - Formatted start time (e.g., 'Session started at: 2:30 PM')
 * - Moderator count with proper singular/plural labels
 * - Participant/viewer count with proper singular/plural labels
 * - Status messages for meeting state information
 * - Automatic 30-second polling when meeting is running
 *
 * Tests cover:
 * - Component rendering with meeting running state
 * - Component rendering when meeting is not running
 * - Real-time polling behavior with fake timers
 * - Loading states and skeleton loaders
 * - Error states and error handling
 * - Edge cases for participant counts and pluralization
 * - Accessibility (ARIA labels, screen reader support)
 * - Material-UI component integration
 *
 * @module tests/unit/features/activities/bigbluebuttonbn/BBBRoomStatus.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

import { BBBRoomStatus } from '@/features/activities/bigbluebuttonbn/components/BBBRoomStatus';
import { useBBBMeetingInfo } from '@/features/activities/bigbluebuttonbn/hooks/useBBB';
import { render, screen, waitFor } from '@tests/helpers/render';

// ============================================================================
// Mock Setup
// ============================================================================

/**
 * Mock the useBBBMeetingInfo hook to control meeting status data in tests.
 * This allows testing different meeting states (running, not running, loading, error).
 */
vi.mock('@/features/activities/bigbluebuttonbn/hooks/useBBB', () => ({
  useBBBMeetingInfo: vi.fn(),
}));

/**
 * Mock the formatTime utility to provide predictable time formatting in tests.
 */
vi.mock('@/utils/date', () => ({
  formatTime: vi.fn((timestamp: number) => {
    // Provide predictable time format for testing
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }),
}));

// ============================================================================
// Type Definitions for Mocks
// ============================================================================

/**
 * Type for the mocked useBBBMeetingInfo hook return value.
 * Matches the UseQueryResult interface from React Query.
 */
interface MockMeetingInfoResult {
  data: {
    statusRunning: boolean;
    statusClosed?: boolean;
    statusOpen?: boolean;
    statusMessage: string;
    moderatorCount: number;
    participantCount: number;
    moderatorPlural?: boolean;
    participantPlural?: boolean;
    canJoin?: boolean;
    startedAt?: number | null;
    openingTime?: number | null;
    closingTime?: number | null;
  } | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch?: () => void;
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a mock meeting info result with default values.
 * @param overrides - Properties to override in the mock result
 * @returns Complete mock meeting info result
 */
function createMockMeetingInfo(
  overrides: {
    data?: MockMeetingInfoResult['data'];
    isLoading?: boolean;
    isError?: boolean;
    error?: Error | null;
    refetch?: () => void;
  } = {}
): MockMeetingInfoResult {
  const defaultData: NonNullable<MockMeetingInfoResult['data']> = {
    statusRunning: false,
    statusMessage: 'Meeting not started',
    moderatorCount: 0,
    participantCount: 0,
    moderatorPlural: false,
    participantPlural: false,
    canJoin: false,
    startedAt: null,
  };

  return {
    // Use 'data' in overrides to check if key was explicitly provided (even if undefined)
    data: 'data' in overrides ? overrides.data : defaultData,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    error: overrides.error ?? null,
    refetch: overrides.refetch,
  };
}

/**
 * Creates mock data for a running meeting with participants.
 * @param moderators - Number of moderators
 * @param participants - Number of participants/viewers
 * @param startedAt - Start timestamp (defaults to a fixed time for testing)
 * @returns Mock data for running meeting
 */
function createRunningMeetingData(
  moderators: number,
  participants: number,
  startedAt: number = 1700000000000 // Fixed timestamp for testing
): NonNullable<MockMeetingInfoResult['data']> {
  return {
    statusRunning: true,
    statusMessage: 'Meeting is in progress',
    moderatorCount: moderators,
    participantCount: participants,
    moderatorPlural: moderators !== 1,
    participantPlural: participants !== 1,
    canJoin: true,
    startedAt,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('BBBRoomStatus', () => {
  // Get typed reference to the mocked hook
  const mockUseBBBMeetingInfo = useBBBMeetingInfo as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Ensure timers are restored after each test
    vi.useRealTimers();
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  describe('Loading State', () => {
    it('should display skeleton loader during initial fetch', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
          isLoading: true,
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      // Verify skeleton loader is displayed
      expect(screen.getByTestId('bbb-room-status-skeleton')).toBeInTheDocument();
    });

    it('should transition smoothly from loading to loaded state', async () => {
      // Start with loading state
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
          isLoading: true,
        })
      );

      const { rerender } = render(<BBBRoomStatus instanceId={1} />);

      // Verify skeleton is shown initially
      expect(screen.getByTestId('bbb-room-status-skeleton')).toBeInTheDocument();

      // Update mock to return loaded data
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
          isLoading: false,
        })
      );

      // Re-render to trigger state update
      rerender(<BBBRoomStatus instanceId={1} />);

      // Verify skeleton is gone and content is displayed
      await waitFor(() => {
        expect(screen.queryByTestId('bbb-room-status-skeleton')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('bbb-room-status')).toBeInTheDocument();
    });

    it('should render skeleton with proper structure', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
          isLoading: true,
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const skeleton = screen.getByTestId('bbb-room-status-skeleton');
      expect(skeleton).toBeInTheDocument();
      // Skeleton should have child skeleton elements
      expect(skeleton.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Meeting Running State Tests
  // ==========================================================================

  describe('Meeting Running State', () => {
    it('should display "Meeting in Progress" status chip when meeting is running', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(2, 10),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const statusChip = screen.getByTestId('bbb-running-status-chip');
      expect(statusChip).toBeInTheDocument();
      expect(statusChip).toHaveTextContent('Meeting in Progress');
    });

    it('should display formatted start time when meeting is running', () => {
      const startTime = new Date('2024-01-15T14:30:00').getTime();
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5, startTime),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const startTimeElement = screen.getByTestId('bbb-session-start-time');
      expect(startTimeElement).toBeInTheDocument();
      expect(startTimeElement).toHaveTextContent('Session started at:');
      // The time should be formatted (we mocked formatTime)
      expect(startTimeElement).toHaveTextContent('PM');
    });

    it('should display moderator count when meeting is running', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(3, 10),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const moderatorElement = screen.getByTestId('bbb-moderator-count');
      expect(moderatorElement).toBeInTheDocument();
      expect(moderatorElement).toHaveTextContent('3');
    });

    it('should display participant/viewer count when meeting is running', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 15),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const participantElement = screen.getByTestId('bbb-participant-count');
      expect(participantElement).toBeInTheDocument();
      expect(participantElement).toHaveTextContent('15');
    });

    it('should display status message when meeting is running', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            ...createRunningMeetingData(1, 5),
            statusMessage: 'Session is active and recording',
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const statusMessage = screen.getByTestId('bbb-status-message');
      expect(statusMessage).toBeInTheDocument();
      expect(statusMessage).toHaveTextContent('Session is active and recording');
    });

    it('should have proper role="status" and aria-live attributes for accessibility', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const statusContainer = screen.getByTestId('bbb-room-status');
      expect(statusContainer).toHaveAttribute('role', 'status');
      expect(statusContainer).toHaveAttribute('aria-live', 'polite');
    });
  });

  // ==========================================================================
  // Meeting Not Running State Tests
  // ==========================================================================

  describe('Meeting Not Running State', () => {
    it('should display "Meeting Not Started" status chip when meeting is not running', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            statusRunning: false,
            statusMessage: 'Meeting has not started yet',
            moderatorCount: 0,
            participantCount: 0,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const statusChip = screen.getByTestId('bbb-running-status-chip');
      expect(statusChip).toBeInTheDocument();
      expect(statusChip).toHaveTextContent('Meeting Not Started');
    });

    it('should not display participant counts when meeting is not running', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            statusRunning: false,
            statusMessage: 'Meeting has not started',
            moderatorCount: 0,
            participantCount: 0,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      // Participant and moderator counts should not be visible
      expect(screen.queryByTestId('bbb-moderator-count')).not.toBeInTheDocument();
      expect(screen.queryByTestId('bbb-participant-count')).not.toBeInTheDocument();
    });

    it('should not display start time when meeting is not running', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            statusRunning: false,
            statusMessage: 'Meeting has not started',
            moderatorCount: 0,
            participantCount: 0,
            startedAt: null,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      expect(screen.queryByTestId('bbb-session-start-time')).not.toBeInTheDocument();
    });

    it('should display status message when meeting is not running', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            statusRunning: false,
            statusMessage: 'The meeting will start at 3:00 PM',
            moderatorCount: 0,
            participantCount: 0,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const statusMessage = screen.getByTestId('bbb-status-message');
      expect(statusMessage).toBeInTheDocument();
      expect(statusMessage).toHaveTextContent('The meeting will start at 3:00 PM');
    });

    it('should display "Meeting ended" message appropriately', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            statusRunning: false,
            statusClosed: true,
            statusMessage: 'Meeting has ended',
            moderatorCount: 0,
            participantCount: 0,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      expect(screen.getByTestId('bbb-status-message')).toHaveTextContent('Meeting has ended');
    });
  });

  // ==========================================================================
  // Singular/Plural Label Tests (Edge Cases)
  // ==========================================================================

  describe('Singular/Plural Labels', () => {
    it('should display "Moderator:" (singular) for 1 moderator', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            ...createRunningMeetingData(1, 5),
            moderatorPlural: false,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const moderatorElement = screen.getByTestId('bbb-moderator-count');
      expect(moderatorElement).toHaveTextContent('Moderator:');
      expect(moderatorElement).not.toHaveTextContent('Moderators:');
      expect(moderatorElement).toHaveTextContent('1');
    });

    it('should display "Moderators:" (plural) for 2+ moderators', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            ...createRunningMeetingData(3, 10),
            moderatorPlural: true,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const moderatorElement = screen.getByTestId('bbb-moderator-count');
      expect(moderatorElement).toHaveTextContent('Moderators:');
      expect(moderatorElement).toHaveTextContent('3');
    });

    it('should display "Viewer:" (singular) for 1 participant', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            ...createRunningMeetingData(1, 1),
            participantPlural: false,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const participantElement = screen.getByTestId('bbb-participant-count');
      expect(participantElement).toHaveTextContent('Viewer:');
      expect(participantElement).not.toHaveTextContent('Viewers:');
      expect(participantElement).toHaveTextContent('1');
    });

    it('should display "Viewers:" (plural) for 3+ participants', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            ...createRunningMeetingData(1, 25),
            participantPlural: true,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const participantElement = screen.getByTestId('bbb-participant-count');
      expect(participantElement).toHaveTextContent('Viewers:');
      expect(participantElement).toHaveTextContent('25');
    });

    it('should handle zero participants correctly with plural label', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            ...createRunningMeetingData(1, 0),
            participantPlural: true, // 0 should use plural form
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const participantElement = screen.getByTestId('bbb-participant-count');
      expect(participantElement).toHaveTextContent('0');
      expect(participantElement).toHaveTextContent('Viewers:');
    });

    it('should handle zero moderators with plural label', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            statusRunning: true,
            statusMessage: 'Meeting started',
            moderatorCount: 0,
            participantCount: 5,
            moderatorPlural: true, // 0 should use plural form
            participantPlural: true,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const moderatorElement = screen.getByTestId('bbb-moderator-count');
      expect(moderatorElement).toHaveTextContent('0');
      expect(moderatorElement).toHaveTextContent('Moderators:');
    });
  });

  // ==========================================================================
  // Error State Tests
  // ==========================================================================

  describe('Error State', () => {
    it('should display error message when API returns error', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
          isLoading: false,
          isError: true,
          error: new Error('Failed to load meeting status'),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const errorElement = screen.getByTestId('bbb-room-status-error');
      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveTextContent('Unable to load room status');
      expect(errorElement).toHaveTextContent('Failed to load meeting status');
    });

    it('should display error with severity="error" for proper styling', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
          isLoading: false,
          isError: true,
          error: new Error('Network error'),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const errorAlert = screen.getByTestId('bbb-room-status-error');
      expect(errorAlert).toHaveClass('MuiAlert-standardError');
    });

    it('should handle 404 error appropriately', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
          isLoading: false,
          isError: true,
          error: new Error('Meeting not found (404)'),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      expect(screen.getByTestId('bbb-room-status-error')).toHaveTextContent(
        'Meeting not found (404)'
      );
    });

    it('should handle 500 server error appropriately', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
          isLoading: false,
          isError: true,
          error: new Error('Internal server error (500)'),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      expect(screen.getByTestId('bbb-room-status-error')).toHaveTextContent(
        'Internal server error (500)'
      );
    });
  });

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe('Empty State', () => {
    it('should display empty state when no status data available', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
          isLoading: false,
          isError: false,
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const emptyState = screen.getByTestId('bbb-room-status-empty');
      expect(emptyState).toBeInTheDocument();
      expect(emptyState).toHaveTextContent('Room status unavailable');
    });
  });

  // ==========================================================================
  // Polling Behavior Tests
  // ==========================================================================

  describe('Polling Behavior', () => {
    it('should call useBBBMeetingInfo with enabled=true when instanceId > 0', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={123} />);

      expect(mockUseBBBMeetingInfo).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          enabled: true,
        })
      );
    });

    it('should configure 30-second polling interval when enablePolling is true', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={1} enablePolling={true} />);

      expect(mockUseBBBMeetingInfo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          refetchInterval: 30000,
        })
      );
    });

    it('should disable polling when enablePolling prop is false', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={1} enablePolling={false} />);

      expect(mockUseBBBMeetingInfo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          refetchInterval: false,
        })
      );
    });

    it('should accept custom polling interval', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(
        <BBBRoomStatus instanceId={1} enablePolling={true} pollingInterval={15000} />
      );

      expect(mockUseBBBMeetingInfo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          refetchInterval: 15000,
        })
      );
    });

    it('should update UI when status changes from polling', async () => {
      // Initial state: not running
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            statusRunning: false,
            statusMessage: 'Meeting not started',
            moderatorCount: 0,
            participantCount: 0,
          },
        })
      );

      const { rerender } = render(<BBBRoomStatus instanceId={1} />);

      expect(screen.getByTestId('bbb-running-status-chip')).toHaveTextContent(
        'Meeting Not Started'
      );

      // Simulate status update from polling: now running
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(2, 10),
        })
      );

      rerender(<BBBRoomStatus instanceId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('bbb-running-status-chip')).toHaveTextContent(
          'Meeting in Progress'
        );
      });

      // Verify counts are now displayed
      expect(screen.getByTestId('bbb-moderator-count')).toHaveTextContent('2');
      expect(screen.getByTestId('bbb-participant-count')).toHaveTextContent('10');
    });

    it('should update participant counts when polling returns new data', async () => {
      // Initial state: 5 participants
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      const { rerender } = render(<BBBRoomStatus instanceId={1} />);

      expect(screen.getByTestId('bbb-participant-count')).toHaveTextContent('5');

      // Simulate update: 15 participants
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(2, 15),
        })
      );

      rerender(<BBBRoomStatus instanceId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('bbb-participant-count')).toHaveTextContent('15');
        expect(screen.getByTestId('bbb-moderator-count')).toHaveTextContent('2');
      });
    });

    it('should use fake timers to verify polling interval configuration', () => {
      vi.useFakeTimers();

      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={1} enablePolling={true} />);

      // Verify the hook was called with the correct refetch interval
      expect(mockUseBBBMeetingInfo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          refetchInterval: 30000,
        })
      );

      // Advance timers - the actual polling is handled by React Query,
      // we're testing the configuration is correct
      vi.advanceTimersByTime(30000);

      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // Callback Tests
  // ==========================================================================

  describe('Status Change Callback', () => {
    it('should call onStatusChange when status updates', async () => {
      const onStatusChange = vi.fn();
      const statusData = createRunningMeetingData(2, 10);

      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: statusData,
        })
      );

      render(<BBBRoomStatus instanceId={1} onStatusChange={onStatusChange} />);

      // Wait for useEffect to fire
      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith(statusData);
      });
    });

    it('should not call onStatusChange when data is undefined', () => {
      const onStatusChange = vi.fn();

      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
          isLoading: true,
        })
      );

      render(<BBBRoomStatus instanceId={1} onStatusChange={onStatusChange} />);

      expect(onStatusChange).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Compact Mode Tests
  // ==========================================================================

  describe('Compact Mode', () => {
    it('should render compact version when compact prop is true', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(2, 10),
        })
      );

      render(<BBBRoomStatus instanceId={1} compact={true} />);

      expect(screen.getByTestId('bbb-room-status-compact')).toBeInTheDocument();
      expect(screen.queryByTestId('bbb-room-status')).not.toBeInTheDocument();
    });

    it('should display inline moderator and viewer counts in compact mode', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            ...createRunningMeetingData(2, 10),
            moderatorPlural: true,
            participantPlural: true,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} compact={true} />);

      const compactContainer = screen.getByTestId('bbb-room-status-compact');
      expect(compactContainer).toHaveTextContent('2 moderators');
      expect(compactContainer).toHaveTextContent('10 viewers');
    });

    it('should not display counts in compact mode when meeting is not running', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            statusRunning: false,
            statusMessage: 'Not started',
            moderatorCount: 0,
            participantCount: 0,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} compact={true} />);

      const compactContainer = screen.getByTestId('bbb-room-status-compact');
      expect(compactContainer).not.toHaveTextContent('moderator');
      expect(compactContainer).not.toHaveTextContent('viewer');
    });

    it('should have role="status" in compact mode for accessibility', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={1} compact={true} />);

      expect(screen.getByTestId('bbb-room-status-compact')).toHaveAttribute(
        'role',
        'status'
      );
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle meeting just started (startedAt within last minute)', () => {
      const now = Date.now();
      const justStarted = now - 30000; // 30 seconds ago

      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 1, justStarted),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      // Should still display the start time
      expect(screen.getByTestId('bbb-session-start-time')).toBeInTheDocument();
    });

    it('should handle meeting running for many hours', () => {
      const manyHoursAgo = Date.now() - 8 * 60 * 60 * 1000; // 8 hours ago

      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(3, 50, manyHoursAgo),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      // Should properly display time even for long-running meetings
      expect(screen.getByTestId('bbb-session-start-time')).toBeInTheDocument();
    });

    it('should handle Unix timestamp in seconds (not milliseconds)', () => {
      // Unix timestamps can come in seconds or milliseconds
      // 1700000000 seconds = Nov 14, 2023
      const unixSeconds = 1700000000;

      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5, unixSeconds),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      // Should handle both formats
      expect(screen.getByTestId('bbb-session-start-time')).toBeInTheDocument();
    });

    it('should handle very large participant counts', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            ...createRunningMeetingData(10, 1000),
            moderatorPlural: true,
            participantPlural: true,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      expect(screen.getByTestId('bbb-participant-count')).toHaveTextContent('1000');
      expect(screen.getByTestId('bbb-moderator-count')).toHaveTextContent('10');
    });

    it('should not display status message section if message is empty', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            statusRunning: true,
            statusMessage: '',
            moderatorCount: 1,
            participantCount: 5,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      expect(screen.queryByTestId('bbb-status-message')).not.toBeInTheDocument();
    });

    it('should handle whitespace-only status message', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            statusRunning: true,
            statusMessage: '   ',
            moderatorCount: 1,
            participantCount: 5,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      expect(screen.queryByTestId('bbb-status-message')).not.toBeInTheDocument();
    });

    it('should disable query when instanceId is 0 or negative', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
        })
      );

      render(<BBBRoomStatus instanceId={0} />);

      // The hook should be called with enabled=false for invalid instanceId
      expect(mockUseBBBMeetingInfo).toHaveBeenCalledWith(
        0,
        expect.objectContaining({
          enabled: false,
        })
      );
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have proper ARIA label on running status chip', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const statusChip = screen.getByTestId('bbb-running-status-chip');
      expect(statusChip).toHaveAttribute(
        'aria-label',
        'Meeting is currently running'
      );
    });

    it('should have proper ARIA label for not running status', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            statusRunning: false,
            statusMessage: 'Not started',
            moderatorCount: 0,
            participantCount: 0,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const statusChip = screen.getByTestId('bbb-running-status-chip');
      expect(statusChip).toHaveAttribute(
        'aria-label',
        'Meeting has not started'
      );
    });

    it('should have aria-hidden on decorative icons', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(2, 10),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      // Check that time icon in start time section is aria-hidden
      const startTimeSection = screen.getByTestId('bbb-session-start-time');
      const timeIcon = startTimeSection.querySelector('[aria-hidden="true"]');
      expect(timeIcon).toBeInTheDocument();
    });

    it('should have aria-label on moderator count', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            ...createRunningMeetingData(2, 10),
            moderatorPlural: true,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const moderatorSection = screen.getByTestId('bbb-moderator-count');
      const countSpan = moderatorSection.querySelector('[aria-label]');
      expect(countSpan).toHaveAttribute('aria-label', '2 moderators');
    });

    it('should have aria-label on participant count', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            ...createRunningMeetingData(1, 5),
            participantPlural: true,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const participantSection = screen.getByTestId('bbb-participant-count');
      const countSpan = participantSection.querySelector('[aria-label]');
      expect(countSpan).toHaveAttribute('aria-label', '5 viewers');
    });

    it('should have aria-atomic for complete status announcements', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const statusContainer = screen.getByTestId('bbb-room-status');
      expect(statusContainer).toHaveAttribute('aria-atomic', 'true');
    });
  });

  // ==========================================================================
  // Material-UI Integration Tests
  // ==========================================================================

  describe('Material-UI Integration', () => {
    it('should render MUI Chip component for status indicator', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const chip = screen.getByTestId('bbb-running-status-chip');
      expect(chip).toHaveClass('MuiChip-root');
    });

    it('should use success color for running meeting chip', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const chip = screen.getByTestId('bbb-running-status-chip');
      expect(chip).toHaveClass('MuiChip-colorSuccess');
    });

    it('should use default color for not running meeting chip', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: {
            statusRunning: false,
            statusMessage: 'Not started',
            moderatorCount: 0,
            participantCount: 0,
          },
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const chip = screen.getByTestId('bbb-running-status-chip');
      expect(chip).toHaveClass('MuiChip-colorDefault');
    });

    it('should render MUI Typography components for text', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      // Status container should contain Typography elements
      const statusContainer = screen.getByTestId('bbb-room-status');
      expect(
        statusContainer.querySelectorAll('.MuiTypography-root').length
      ).toBeGreaterThan(0);
    });

    it('should render MUI Alert component for errors', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
          isLoading: false,
          isError: true,
          error: new Error('Test error'),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const errorAlert = screen.getByTestId('bbb-room-status-error');
      expect(errorAlert).toHaveClass('MuiAlert-root');
    });

    it('should render MUI Skeleton components for loading state', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
          isLoading: true,
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const skeleton = screen.getByTestId('bbb-room-status-skeleton');
      expect(skeleton.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    });

    it('should use MUI Box component for layout', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      // The status container should be a Box component (renders as div with MuiBox class)
      const statusContainer = screen.getByTestId('bbb-room-status');
      // Box renders as a div by default
      expect(statusContainer.tagName.toLowerCase()).toBe('div');
    });

    it('should apply proper border styling from theme', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      const statusContainer = screen.getByTestId('bbb-room-status');
      // MUI's sx prop generates CSS classes, so we verify computed styles exist
      // The p: 2 in STATUS_CONTAINER_SX becomes 16px padding (2 * 8px theme spacing)
      const computedStyle = window.getComputedStyle(statusContainer);
      // Verify padding is applied (MUI's theme spacing unit is 8px, so p: 2 = 16px)
      expect(computedStyle.padding).toBeTruthy();
    });
  });

  // ==========================================================================
  // Hook Integration Tests
  // ==========================================================================

  describe('useBBBMeetingInfo Hook Integration', () => {
    it('should pass correct instanceId to hook', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
        })
      );

      render(<BBBRoomStatus instanceId={42} />);

      expect(mockUseBBBMeetingInfo).toHaveBeenCalledWith(42, expect.any(Object));
    });

    it('should pass options object to hook', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={1} enablePolling={true} pollingInterval={20000} />);

      expect(mockUseBBBMeetingInfo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          enabled: true,
          refetchInterval: 20000,
        })
      );
    });

    it('should handle hook returning undefined data gracefully', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
          isLoading: false,
          isError: false,
        })
      );

      // Should not throw and should render empty state
      expect(() => {
        render(<BBBRoomStatus instanceId={1} />);
      }).not.toThrow();

      expect(screen.getByTestId('bbb-room-status-empty')).toBeInTheDocument();
    });

    it('should handle hook throwing error', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: undefined,
          isLoading: false,
          isError: true,
          error: new Error('Hook threw error'),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      expect(screen.getByTestId('bbb-room-status-error')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Props Validation Tests
  // ==========================================================================

  describe('Props Configuration', () => {
    it('should use default values for optional props', () => {
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(<BBBRoomStatus instanceId={1} />);

      // Default: enablePolling=true, pollingInterval=30000
      expect(mockUseBBBMeetingInfo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          refetchInterval: 30000,
        })
      );

      // Default: compact=false
      expect(screen.getByTestId('bbb-room-status')).toBeInTheDocument();
      expect(screen.queryByTestId('bbb-room-status-compact')).not.toBeInTheDocument();
    });

    it('should handle all props being provided', () => {
      const onStatusChange = vi.fn();
      mockUseBBBMeetingInfo.mockReturnValue(
        createMockMeetingInfo({
          data: createRunningMeetingData(1, 5),
        })
      );

      render(
        <BBBRoomStatus
          instanceId={99}
          enablePolling={false}
          pollingInterval={45000}
          onStatusChange={onStatusChange}
          compact={false}
        />
      );

      expect(mockUseBBBMeetingInfo).toHaveBeenCalledWith(
        99,
        expect.objectContaining({
          enabled: true,
          refetchInterval: false,
        })
      );
    });
  });
});
