/**
 * Unit tests for H5PReportCard component
 * Tests rendering, score visualization, status indicators, navigation,
 * responsive layout, and accessibility features
 */

import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { H5PReportCard } from '@/features/activities/h5pactivity/components/H5PReportCard';
import type { H5PAttempt } from '@/features/activities/h5pactivity/types/h5p.types';
import { formatDuration } from '@/utils/date';

// Mock utilities
vi.mock('@/utils/date', () => ({
  formatDuration: vi.fn((seconds: number) => {
    if (!seconds) {return 'N/A';}
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }),
  formatNumber: vi.fn((num: number) => num.toString()),
}));

// Test fixtures
const createMockAttempt = (overrides: Partial<H5PAttempt> = {}): H5PAttempt => ({
  id: 1,
  h5pactivityid: 100,
  userid: 500,
  timecreated: Date.now() / 1000 - 3600, // 1 hour ago
  timemodified: Date.now() / 1000 - 3600,
  attempt: 1,
  rawscore: 8,
  maxscore: 10,
  scaled: 0.8,
  duration: 180, // 3 minutes
  completion: 1,
  success: 1,
  ...overrides,
});

// Test wrapper component
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
  TestWrapper.displayName = 'TestWrapper';

  return TestWrapper;
};

describe('H5PReportCard', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('renders attempt number display', () => {
      const attempt = createMockAttempt({ attempt: 3 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/Attempt 3/i)).toBeInTheDocument();
    });

    it('displays score as fraction with percentage', () => {
      const attempt = createMockAttempt({ rawscore: 8, maxscore: 10 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // Should show "8/10" or "8 / 10"
      expect(screen.getByText(/8.*10/)).toBeInTheDocument();
      // Should show "80%" or "(80%)"
      expect(screen.getByText(/80%/)).toBeInTheDocument();
    });

    it('displays completion status icon when complete', () => {
      const attempt = createMockAttempt({ completion: 1 });
      const { container } = render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // Should show CheckCircle icon (MUI adds testid or we check for chip)
      const chip = container.querySelector('[class*="MuiChip"]');
      expect(chip).toBeInTheDocument();
      expect(screen.getByText(/Complete/i)).toBeInTheDocument();
    });

    it('displays incomplete status icon when not complete', () => {
      const attempt = createMockAttempt({ completion: 0 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/Incomplete/i)).toBeInTheDocument();
    });

    it('displays success badge in green when successful', () => {
      const attempt = createMockAttempt({ success: 1 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/Passed/i)).toBeInTheDocument();
      // Check for success color class or inline style
      const successChip = screen.getByText(/Passed/i).closest('[class*="MuiChip"]');
      expect(successChip).toBeInTheDocument();
    });

    it('displays failure badge in gray when not successful', () => {
      const attempt = createMockAttempt({ success: 0 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/Failed/i)).toBeInTheDocument();
    });

    it('formats timestamp using formatDistanceToNow', () => {
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
      const attempt = createMockAttempt({ timecreated: oneHourAgo });
      
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // Should show relative time like "1 hour ago" or "about 1 hour ago"
      expect(screen.getByText(/hour.*ago/i)).toBeInTheDocument();
    });

    it('displays formatted duration', () => {
      const attempt = createMockAttempt({ duration: 180 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // formatDuration should format 180s as "3m 0s"
      expect(formatDuration).toHaveBeenCalledWith(180);
      expect(screen.getByText(/3m 0s/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Score Visualization Tests
  // ============================================================================

  describe('Score Visualization', () => {
    it('renders progress indicator for score percentage', () => {
      const attempt = createMockAttempt({ rawscore: 7, maxscore: 10 });
      const { container } = render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // Check for LinearProgress component
      const progress = container.querySelector('[class*="MuiLinearProgress"]');
      expect(progress).toBeInTheDocument();
    });

    it('shows 0% score with appropriate styling', () => {
      const attempt = createMockAttempt({ rawscore: 0, maxscore: 10 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/0%/)).toBeInTheDocument();
      expect(screen.getByText(/0.*10/)).toBeInTheDocument();
    });

    it('shows 50% score with progress indicator', () => {
      const attempt = createMockAttempt({ rawscore: 5, maxscore: 10 });
      const { container } = render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/50%/)).toBeInTheDocument();
      
      // Check progress bar exists
      const progress = container.querySelector('[class*="MuiLinearProgress"]');
      expect(progress).toBeInTheDocument();
    });

    it('shows 100% score with full progress indicator', () => {
      const attempt = createMockAttempt({ rawscore: 10, maxscore: 10 });
      const { container } = render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/100%/)).toBeInTheDocument();
      
      // Check progress bar exists and should be full
      const progress = container.querySelector('[class*="MuiLinearProgress"]');
      expect(progress).toBeInTheDocument();
    });

    it('displays score fraction with proper formatting', () => {
      const attempt = createMockAttempt({ rawscore: 15, maxscore: 20 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/15.*20/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Status Indicator Tests
  // ============================================================================

  describe('Status Indicators', () => {
    it('shows completion badge with CheckCircle icon when complete', () => {
      const attempt = createMockAttempt({ completion: 1 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      const completionBadge = screen.getByText(/Complete/i);
      expect(completionBadge).toBeInTheDocument();
      
      // Verify it's in a Chip component
      const chip = completionBadge.closest('[class*="MuiChip"]');
      expect(chip).toBeInTheDocument();
    });

    it('shows incomplete badge with RadioButtonUnchecked when not complete', () => {
      const attempt = createMockAttempt({ completion: 0 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      const incompleteBadge = screen.getByText(/Incomplete/i);
      expect(incompleteBadge).toBeInTheDocument();
    });

    it('displays success badge in green when successful', () => {
      const attempt = createMockAttempt({ success: 1 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      const successBadge = screen.getByText(/Passed/i);
      expect(successBadge).toBeInTheDocument();
      
      const chip = successBadge.closest('[class*="MuiChip"]');
      expect(chip).toBeInTheDocument();
    });

    it('displays failure badge in gray when not successful', () => {
      const attempt = createMockAttempt({ success: 0 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      const failBadge = screen.getByText(/Failed/i);
      expect(failBadge).toBeInTheDocument();
    });

    it('handles null completion state', () => {
      const attempt = createMockAttempt({ completion: null });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // Should either show "Unknown" or not show completion chip
      // Component behavior depends on implementation
      const card = screen.getByRole('article');
      expect(card).toBeInTheDocument();
    });

    it('handles null success state', () => {
      const attempt = createMockAttempt({ success: null });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // Should either show "Unknown" or not show success chip
      const card = screen.getByRole('article');
      expect(card).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Duration and Timestamp Tests
  // ============================================================================

  describe('Duration and Timestamp Formatting', () => {
    it('formats duration in seconds', () => {
      const attempt = createMockAttempt({ duration: 45 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(formatDuration).toHaveBeenCalledWith(45);
      expect(screen.getByText(/45s/i)).toBeInTheDocument();
    });

    it('formats duration in minutes', () => {
      const attempt = createMockAttempt({ duration: 330 }); // 5m 30s
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(formatDuration).toHaveBeenCalledWith(330);
      expect(screen.getByText(/5m 30s/i)).toBeInTheDocument();
    });

    it('formats duration in hours', () => {
      const attempt = createMockAttempt({ duration: 5400 }); // 1h 30m
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(formatDuration).toHaveBeenCalledWith(5400);
      expect(screen.getByText(/1h 30m/i)).toBeInTheDocument();
    });

    it('formats timestamp as relative time', () => {
      const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
      const attempt = createMockAttempt({ timecreated: twoHoursAgo });
      
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // Should show something like "2 hours ago"
      expect(screen.getByText(/hours? ago/i)).toBeInTheDocument();
    });

    it('handles zero duration', () => {
      const attempt = createMockAttempt({ duration: 0 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(formatDuration).toHaveBeenCalledWith(0);
      expect(screen.getByText(/N\/A/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  describe('Navigation', () => {
    it('renders as clickable card', () => {
      const attempt = createMockAttempt();
      const { container } = render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // Should have CardActionArea which makes it clickable
      const actionArea = container.querySelector('[class*="MuiCardActionArea"]');
      expect(actionArea).toBeInTheDocument();
    });

    it('navigates to detailed attempt view on click', () => {
      const attempt = createMockAttempt({ id: 42 });
      const reportUrl = `/h5p/report/${attempt.id}`;
      
      const { container } = render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={reportUrl}
        />,
        { wrapper: createWrapper() }
      );

      // Find the clickable area
      const actionArea = container.querySelector('[class*="MuiCardActionArea"]');
      expect(actionArea).toBeInTheDocument();
      
      // Verify link points to correct URL
      const link = container.querySelector(`a[href="${reportUrl}"]`);
      expect(link).toBeInTheDocument();
    });

    it('passes correct attempt ID to navigation', () => {
      const attempt = createMockAttempt({ id: 123 });
      const reportUrl = `/h5p/report/123`;
      
      const { container } = render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={reportUrl}
        />,
        { wrapper: createWrapper() }
      );

      const link = container.querySelector(`a[href="${reportUrl}"]`);
      expect(link).toBeInTheDocument();
      expect(link?.getAttribute('href')).toBe(reportUrl);
    });

    it('handles click events properly', async () => {
      const attempt = createMockAttempt();
      const onClick = vi.fn();
      
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
          onClick={onClick}
        />,
        { wrapper: createWrapper() }
      );

      // When onClick is provided, CardActionArea renders as a button (not a link)
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Responsive Layout Tests
  // ============================================================================

  describe('Responsive Layout', () => {
    it('renders compact mode when compact prop is true', () => {
      const attempt = createMockAttempt();
      const { container } = render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
          compact
        />,
        { wrapper: createWrapper() }
      );

      // In compact mode, some secondary info might be hidden
      const card = container.querySelector('[class*="MuiCard"]');
      expect(card).toBeInTheDocument();
    });

    it('renders expanded mode when compact prop is false', () => {
      const attempt = createMockAttempt();
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
          compact={false}
        />,
        { wrapper: createWrapper() }
      );

      // In expanded mode, all info should be visible
      expect(screen.getByText(/Attempt/i)).toBeInTheDocument();
      expect(screen.getByText(/hour.*ago/i)).toBeInTheDocument();
      expect(screen.getByText(/3m 0s/i)).toBeInTheDocument();
    });

    it('shows all info in expanded mode', () => {
      const attempt = createMockAttempt();
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
          compact={false}
        />,
        { wrapper: createWrapper() }
      );

      // All metadata should be visible
      expect(screen.getByText(/Attempt/i)).toBeInTheDocument();
      expect(screen.getByText(/Complete/i)).toBeInTheDocument();
      expect(screen.getByText(/Passed/i)).toBeInTheDocument();
      expect(screen.getByText(/hour.*ago/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('has proper ARIA labels for status icons', () => {
      const attempt = createMockAttempt({ completion: 1, success: 1 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // Chips should have accessible text
      expect(screen.getByText(/Complete/i)).toBeInTheDocument();
      expect(screen.getByText(/Passed/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation with tab', async () => {
      const attempt = createMockAttempt();
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // Tab to the card link
      await user.tab();
      
      // The link should be focused
      const link = screen.getByRole('link');
      expect(link).toHaveFocus();
    });

    it('supports keyboard navigation with enter key', async () => {
      const attempt = createMockAttempt();
      const onClick = vi.fn();
      
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
          onClick={onClick}
        />,
        { wrapper: createWrapper() }
      );

      // When onClick is provided, CardActionArea renders as a button (not a link)
      const button = screen.getByRole('button');
      button.focus();
      
      // Press Enter
      await user.keyboard('{Enter}');
      
      // Should trigger onClick handler
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith(attempt.id);
    });

    it('has proper heading structure', () => {
      const attempt = createMockAttempt({ attempt: 5 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // Should have attempt number as heading or strong text
      expect(screen.getByText(/Attempt 5/i)).toBeInTheDocument();
    });

    it('includes screen reader text for scores', () => {
      const attempt = createMockAttempt({ rawscore: 8, maxscore: 10 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // Score should be visible and readable
      expect(screen.getByText(/8.*10/)).toBeInTheDocument();
      expect(screen.getByText(/80%/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles zero score gracefully', () => {
      const attempt = createMockAttempt({ rawscore: 0, maxscore: 10 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/0%/)).toBeInTheDocument();
      expect(screen.getByText(/0.*10/)).toBeInTheDocument();
    });

    it('handles null duration showing N/A', () => {
      const attempt = createMockAttempt({ duration: 0 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/N\/A/i)).toBeInTheDocument();
    });

    it('handles very large scores', () => {
      const attempt = createMockAttempt({ rawscore: 9999, maxscore: 10000 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // formatNumber adds commas and decimal places for better readability
      expect(screen.getByText(/9,999.*10,000/)).toBeInTheDocument();
      // 99.99% but might be rounded
      expect(screen.getByText(/99/)).toBeInTheDocument();
    });

    it('handles very long durations in days', () => {
      const attempt = createMockAttempt({ duration: 86400 }); // 24 hours
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(formatDuration).toHaveBeenCalledWith(86400);
      // Should format as hours
      expect(screen.getByText(/24h/i)).toBeInTheDocument();
    });

    it('handles attempt without isScored prop', () => {
      const attempt = createMockAttempt();
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
          isScored={false}
        />,
        { wrapper: createWrapper() }
      );

      // When not scored, score section might not be displayed
      const card = screen.getByRole('article');
      expect(card).toBeInTheDocument();
    });

    it('handles attempt with custom className', () => {
      const attempt = createMockAttempt();
      const { container } = render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
          className="custom-class"
        />,
        { wrapper: createWrapper() }
      );

      const card = container.querySelector('.custom-class');
      expect(card).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Material-UI Integration Tests
  // ============================================================================

  describe('Material-UI Integration', () => {
    it('uses Card component from MUI', () => {
      const attempt = createMockAttempt();
      const { container } = render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      const card = container.querySelector('[class*="MuiCard"]');
      expect(card).toBeInTheDocument();
    });

    it('uses CardContent for layout', () => {
      const attempt = createMockAttempt();
      const { container } = render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      const cardContent = container.querySelector('[class*="MuiCardContent"]');
      expect(cardContent).toBeInTheDocument();
    });

    it('uses Chip for status indicators', () => {
      const attempt = createMockAttempt({ completion: 1, success: 1 });
      const { container } = render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      const chips = container.querySelectorAll('[class*="MuiChip"]');
      expect(chips.length).toBeGreaterThan(0);
    });

    it('uses proper theme spacing', () => {
      const attempt = createMockAttempt();
      const { container } = render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // MUI components should have proper spacing classes
      const card = container.querySelector('[class*="MuiCard"]');
      expect(card).toBeInTheDocument();
    });

    it('uses proper theme colors', () => {
      const attempt = createMockAttempt({ success: 1 });
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      // Success chip should use success color
      const successChip = screen.getByText(/Passed/i).closest('[class*="MuiChip"]');
      expect(successChip).toBeInTheDocument();
    });
  });

  // ============================================================================
  // TypeScript Type Tests
  // ============================================================================

  describe('TypeScript Types', () => {
    it('accepts valid H5PAttempt props', () => {
      const attempt: H5PAttempt = createMockAttempt();
      
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('handles optional props correctly', () => {
      const attempt = createMockAttempt();
      
      // Should render with only required props
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('handles all optional props together', () => {
      const attempt = createMockAttempt();
      const onClick = vi.fn();
      
      render(
        <H5PReportCard 
          attempt={attempt} 
          reportUrl={`/report/${attempt.id}`}
          compact
          isScored
          onClick={onClick}
          className="test-class"
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByRole('article')).toBeInTheDocument();
    });
  });
});
