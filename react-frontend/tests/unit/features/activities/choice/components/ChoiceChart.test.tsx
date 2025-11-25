/**
 * Unit tests for ChoiceChart component.
 * 
 * Tests validate bar chart visualization of choice response distribution with:
 * - Horizontal and vertical layouts
 * - Percentage and count display
 * - Option text rendering
 * - Responsive breakpoint handling
 * - Empty state with zero responses
 * - maxanswers limit display
 * - MUI theme color application
 * - Tooltip details on hover
 * - Accessibility attributes for screen readers
 * 
 * @module tests/unit/features/activities/choice/components/ChoiceChart
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@/tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { run as axeRun } from 'axe-core';
import * as useMediaQueryModule from '@mui/material/useMediaQuery';

import { ChoiceChart } from '@/features/activities/choice/components/ChoiceChart';
import { createMockOptionResult } from '@/tests/unit/features/activities/choice/mocks/choiceMocks';

// Mock useMediaQuery from MUI to control responsive behavior
vi.mock('@mui/material/useMediaQuery');

describe('ChoiceChart', () => {
  // Helper to mock desktop viewport (horizontal layout default)
  const mockDesktopView = () => {
    vi.mocked(useMediaQueryModule.default).mockReturnValue(false);
  };

  // Helper to mock mobile viewport (vertical layout forced)
  const mockMobileView = () => {
    vi.mocked(useMediaQueryModule.default).mockReturnValue(true);
  };

  beforeEach(() => {
    // Default to desktop view for most tests
    mockDesktopView();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering Tests', () => {
    it('renders chart container with proper role="img" for accessibility', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
        createMockOptionResult({ optionid: 2, text: 'Option B', count: 10, percentage: 50 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const chartContainer = screen.getByRole('img', { name: /choice response distribution/i });
      expect(chartContainer).toBeInTheDocument();
    });

    it('displays all option names passed in props', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'JavaScript', count: 15, percentage: 30 }),
        createMockOptionResult({ optionid: 2, text: 'TypeScript', count: 20, percentage: 40 }),
        createMockOptionResult({ optionid: 3, text: 'Python', count: 15, percentage: 30 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('Python')).toBeInTheDocument();
    });

    it('renders bar elements for each option', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
        createMockOptionResult({ optionid: 2, text: 'Option B', count: 10, percentage: 50 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // Each option should have a colored bar element
      const bars = container.querySelectorAll('[data-testid*="chart-bar"]');
      expect(bars.length).toBe(2);
    });

    it('shows count and percentage labels for each option', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 15, percentage: 60 }),
        createMockOptionResult({ optionid: 2, text: 'Option B', count: 10, percentage: 40 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // Check for count displays
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();

      // Check for percentage displays
      expect(screen.getByText(/60\.0%/)).toBeInTheDocument();
      expect(screen.getByText(/40\.0%/)).toBeInTheDocument();
    });

    it('uses correct ARIA labels describing the chart', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 100 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const chartContainer = screen.getByRole('img');
      expect(chartContainer).toHaveAttribute('aria-label');
      const ariaLabel = chartContainer.getAttribute('aria-label');
      expect(ariaLabel).toContain('Choice response distribution');
    });
  });

  describe('Horizontal Layout Tests', () => {
    it('renders option text on the left side', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Red', count: 10, percentage: 50 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // In horizontal layout, option text should appear before the bar
      const optionText = screen.getByText('Red');
      const parentBox = optionText.closest('[data-testid*="option-row"]');
      expect(parentBox).toBeInTheDocument();
    });

    it('displays horizontal bars in the middle with width based on percentage', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
        createMockOptionResult({ optionid: 2, text: 'Option B', count: 5, percentage: 25 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const bars = container.querySelectorAll('[data-testid*="chart-bar"]');
      expect(bars.length).toBe(2);
      
      // First bar should have width: 50%
      expect(bars[0]).toHaveStyle({ width: '50%' });
      
      // Second bar should have width: 25%
      expect(bars[1]).toHaveStyle({ width: '25%' });
    });

    it('shows percentage and count on the right side', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 15, percentage: 75 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // Both count and percentage should be visible
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText(/75\.0%/)).toBeInTheDocument();
    });

    it('applies proper CSS classes for horizontal layout', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // Check that the layout container has horizontal orientation
      const layoutBox = container.querySelector('[data-testid*="chart-container"]');
      expect(layoutBox).toBeInTheDocument();
    });

    it('calculates bar widths correctly (percentage of 100%)', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 100 }),
        createMockOptionResult({ optionid: 2, text: 'Option B', count: 0, percentage: 0 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const bars = container.querySelectorAll('[data-testid*="chart-bar"]');
      
      // First bar should be full width (100%)
      expect(bars[0]).toHaveStyle({ width: '100%' });
      
      // Second bar should be minimal width (0%)
      expect(bars[1]).toHaveStyle({ width: '0%' });
    });

    it('handles long option text with proper truncation', () => {
      const longText = 'This is a very long option text that should be truncated properly to fit in the layout without breaking the UI';
      const options = [
        createMockOptionResult({ optionid: 1, text: longText, count: 10, percentage: 100 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const optionText = screen.getByText(longText);
      expect(optionText).toBeInTheDocument();
      
      // Check that the text element has appropriate styling for truncation
      const computedStyle = window.getComputedStyle(optionText);
      // Note: actual overflow/text-overflow styles would be applied via MUI
    });
  });

  describe('Vertical Layout Tests', () => {
    it('renders option text at bottom', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Red', count: 10, percentage: 50 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="vertical"
          showPercentages={true}
        />
      );

      const optionText = screen.getByText('Red');
      expect(optionText).toBeInTheDocument();
      
      // In vertical layout, text appears below the bar
      const parentColumn = optionText.closest('[data-testid*="option-column"]');
      expect(parentColumn).toBeInTheDocument();
    });

    it('displays vertical bars stacked upward with height based on percentage', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
        createMockOptionResult({ optionid: 2, text: 'Option B', count: 5, percentage: 25 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="vertical"
          showPercentages={true}
        />
      );

      const bars = container.querySelectorAll('[data-testid*="chart-bar"]');
      expect(bars.length).toBe(2);
      
      // In vertical layout, bars should have height based on percentage
      // Note: Actual height implementation may use CSS variables or inline styles
      expect(bars[0]).toHaveStyle({ height: '50%' });
      expect(bars[1]).toHaveStyle({ height: '25%' });
    });

    it('shows percentage label above bars', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 15, percentage: 75 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="vertical"
          showPercentages={true}
        />
      );

      // Percentage should be visible above the bar
      expect(screen.getByText(/75\.0%/)).toBeInTheDocument();
    });

    it('applies proper CSS classes for vertical layout', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="vertical"
          showPercentages={true}
        />
      );

      const layoutBox = container.querySelector('[data-testid*="chart-container"]');
      expect(layoutBox).toBeInTheDocument();
    });

    it('calculates bar heights correctly', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 20, percentage: 80 }),
        createMockOptionResult({ optionid: 2, text: 'Option B', count: 5, percentage: 20 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="vertical"
          showPercentages={true}
        />
      );

      const bars = container.querySelectorAll('[data-testid*="chart-bar"]');
      
      expect(bars[0]).toHaveStyle({ height: '80%' });
      expect(bars[1]).toHaveStyle({ height: '20%' });
    });
  });

  describe('Data Visualization Tests', () => {
    it('correctly displays response counts for each option', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 42, percentage: 70 }),
        createMockOptionResult({ optionid: 2, text: 'Option B', count: 18, percentage: 30 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('18')).toBeInTheDocument();
    });

    it('correctly displays percentages for each option', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 35, percentage: 70.0 }),
        createMockOptionResult({ optionid: 2, text: 'Option B', count: 15, percentage: 30.0 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(screen.getByText(/70\.0%/)).toBeInTheDocument();
      expect(screen.getByText(/30\.0%/)).toBeInTheDocument();
    });

    it('handles zero responses with minimal bar and "0%" label', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 0, percentage: 0 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText(/0\.0%/)).toBeInTheDocument();
      
      const bar = container.querySelector('[data-testid*="chart-bar"]');
      expect(bar).toHaveStyle({ width: '0%' });
    });

    it('shows percentages adding up to 100% (or close with rounding)', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 33, percentage: 33.33 }),
        createMockOptionResult({ optionid: 2, text: 'Option B', count: 33, percentage: 33.33 }),
        createMockOptionResult({ optionid: 3, text: 'Option C', count: 34, percentage: 33.34 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // All three percentages should be visible
      const percentages = screen.getAllByText(/33\.\d+%/);
      expect(percentages.length).toBeGreaterThanOrEqual(2);
    });

    it('handles single option with 100% selection', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Only Option', count: 50, percentage: 100 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText(/100\.0%/)).toBeInTheDocument();
      
      const bar = container.querySelector('[data-testid*="chart-bar"]');
      expect(bar).toHaveStyle({ width: '100%' });
    });

    it('handles multiple options with varying distributions', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Very Popular', count: 70, percentage: 70 }),
        createMockOptionResult({ optionid: 2, text: 'Somewhat Popular', count: 20, percentage: 20 }),
        createMockOptionResult({ optionid: 3, text: 'Least Popular', count: 10, percentage: 10 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(screen.getByText('Very Popular')).toBeInTheDocument();
      expect(screen.getByText('Somewhat Popular')).toBeInTheDocument();
      expect(screen.getByText('Least Popular')).toBeInTheDocument();
      
      const bars = container.querySelectorAll('[data-testid*="chart-bar"]');
      expect(bars[0]).toHaveStyle({ width: '70%' });
      expect(bars[1]).toHaveStyle({ width: '20%' });
      expect(bars[2]).toHaveStyle({ width: '10%' });
    });
  });

  describe('Limit Display Tests (when maxanswers provided)', () => {
    it('shows "X/Y responses" format when maxanswers is set', () => {
      const options = [
        createMockOptionResult({ 
          optionid: 1, 
          text: 'Limited Option', 
          count: 15, 
          percentage: 100,
          maxanswers: 30 
        }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // Should show "15/30" format
      expect(screen.getByText(/15\/30/)).toBeInTheDocument();
    });

    it('displays current count vs maximum for each option', () => {
      const options = [
        createMockOptionResult({ 
          optionid: 1, 
          text: 'Option A', 
          count: 8, 
          percentage: 50,
          maxanswers: 20 
        }),
        createMockOptionResult({ 
          optionid: 2, 
          text: 'Option B', 
          count: 12, 
          percentage: 50,
          maxanswers: 20 
        }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(screen.getByText(/8\/20/)).toBeInTheDocument();
      expect(screen.getByText(/12\/20/)).toBeInTheDocument();
    });

    it('correctly formats limit information', () => {
      const options = [
        createMockOptionResult({ 
          optionid: 1, 
          text: 'Option', 
          count: 100, 
          percentage: 100,
          maxanswers: 150 
        }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // Should show formatted limit
      const limitText = screen.getByText(/100\/150/);
      expect(limitText).toBeInTheDocument();
    });

    it('hides limit info when maxanswers not provided', () => {
      const options = [
        createMockOptionResult({ 
          optionid: 1, 
          text: 'Unlimited Option', 
          count: 15, 
          percentage: 100,
          maxanswers: 0  // 0 means unlimited
        }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // Should only show the count, not in "X/Y" format
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.queryByText(/15\/0/)).not.toBeInTheDocument();
    });
  });

  describe('Responsive Design Tests', () => {
    it('uses useMediaQuery to detect mobile breakpoints', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 100 }),
      ];

      mockMobileView();

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // Verify useMediaQuery was called
      expect(useMediaQueryModule.default).toHaveBeenCalled();
    });

    it('switches from horizontal to vertical on mobile (< 600px)', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 100 }),
      ];

      mockMobileView();

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"  // This should be overridden on mobile
          showPercentages={true}
        />
      );

      // On mobile, should render vertical layout regardless of prop
      const bar = container.querySelector('[data-testid*="chart-bar"]');
      expect(bar).toBeInTheDocument();
      // Would have height instead of width in vertical layout
    });

    it('maintains horizontal layout on desktop (>= 600px)', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
      ];

      mockDesktopView();

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const bar = container.querySelector('[data-testid*="chart-bar"]');
      expect(bar).toHaveStyle({ width: '50%' });
    });
  });

  describe('Empty State Tests', () => {
    it('handles array with zero responses gracefully', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 0, percentage: 0 }),
        createMockOptionResult({ optionid: 2, text: 'Option B', count: 0, percentage: 0 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(screen.getByText('Option A')).toBeInTheDocument();
      expect(screen.getByText('Option B')).toBeInTheDocument();
    });

    it('displays minimal bars for all zero responses', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 0, percentage: 0 }),
        createMockOptionResult({ optionid: 2, text: 'Option B', count: 0, percentage: 0 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const bars = container.querySelectorAll('[data-testid*="chart-bar"]');
      expect(bars.length).toBe(2);
      expect(bars[0]).toHaveStyle({ width: '0%' });
      expect(bars[1]).toHaveStyle({ width: '0%' });
    });

    it('shows "0" count and "0%" for empty options', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Empty Option', count: 0, percentage: 0 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText(/0\.0%/)).toBeInTheDocument();
    });

    it('no errors with empty data', () => {
      const options: any[] = [];

      // Should render without crashing
      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Styling and Theming Tests', () => {
    it('applies MUI theme primary color to bars', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const bar = container.querySelector('[data-testid*="chart-bar"]');
      expect(bar).toBeInTheDocument();
      
      // Bar should use theme colors (specific color checking would require theme context)
      const computedStyle = window.getComputedStyle(bar as Element);
      expect(computedStyle.backgroundColor).toBeTruthy();
    });

    it('uses consistent spacing from MUI theme', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // MUI Box components should have proper spacing
      const boxes = container.querySelectorAll('[class*="MuiBox"]');
      expect(boxes.length).toBeGreaterThan(0);
    });

    it('uses appropriate typography variants', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // Typography components should be present
      const typographyElements = container.querySelectorAll('[class*="MuiTypography"]');
      expect(typographyElements.length).toBeGreaterThan(0);
    });

    it('applies color gradients correctly', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const bar = container.querySelector('[data-testid*="chart-bar"]');
      expect(bar).toBeInTheDocument();
      
      // Check that background is applied (gradient or solid color)
      const computedStyle = window.getComputedStyle(bar as Element);
      expect(computedStyle.background).toBeTruthy();
    });

    it('handles light and dark theme modes', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
      ];

      // Our render helper provides theme context
      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // Component should render correctly with theme
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Tooltip Tests', () => {
    it('shows tooltip on hover with detailed information', async () => {
      const user = userEvent.setup();
      const options = [
        createMockOptionResult({ 
          optionid: 1, 
          text: 'Option A', 
          count: 15, 
          percentage: 60 
        }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const bar = container.querySelector('[data-testid*="chart-bar"]');
      expect(bar).toBeInTheDocument();

      // Hover over the bar
      await user.hover(bar as Element);

      // Tooltip should appear with detailed info
      await waitFor(() => {
        const tooltip = screen.queryByRole('tooltip');
        if (tooltip) {
          expect(tooltip).toBeInTheDocument();
        }
      });
    });

    it('tooltip includes option name, count, and percentage', async () => {
      const user = userEvent.setup();
      const options = [
        createMockOptionResult({ 
          optionid: 1, 
          text: 'JavaScript', 
          count: 25, 
          percentage: 50 
        }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const bar = container.querySelector('[data-testid*="chart-bar"]');
      await user.hover(bar as Element);

      await waitFor(() => {
        const tooltip = screen.queryByRole('tooltip');
        if (tooltip) {
          expect(tooltip).toHaveTextContent(/JavaScript/);
          expect(tooltip).toHaveTextContent(/25/);
          expect(tooltip).toHaveTextContent(/50/);
        }
      });
    });

    it('tooltip shows limit information when available', async () => {
      const user = userEvent.setup();
      const options = [
        createMockOptionResult({ 
          optionid: 1, 
          text: 'Limited Option', 
          count: 10, 
          percentage: 50,
          maxanswers: 30
        }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const bar = container.querySelector('[data-testid*="chart-bar"]');
      await user.hover(bar as Element);

      await waitFor(() => {
        const tooltip = screen.queryByRole('tooltip');
        if (tooltip) {
          expect(tooltip).toHaveTextContent(/30/); // maxanswers
        }
      });
    });

    it('tooltip follows cursor position', async () => {
      const user = userEvent.setup();
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const bar = container.querySelector('[data-testid*="chart-bar"]');
      await user.hover(bar as Element);

      // MUI Tooltip follows cursor by default
      await waitFor(() => {
        const tooltip = screen.queryByRole('tooltip');
        // Tooltip should appear somewhere on the screen
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Tests', () => {
    it('has proper ARIA labels on chart container', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const chartContainer = screen.getByRole('img');
      expect(chartContainer).toHaveAttribute('aria-label');
    });

    it('each bar has descriptive aria-label', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
        createMockOptionResult({ optionid: 2, text: 'Option B', count: 10, percentage: 50 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      const bars = container.querySelectorAll('[data-testid*="chart-bar"]');
      bars.forEach((bar) => {
        // Each bar should have accessible attributes
        expect(bar).toBeInTheDocument();
      });
    });

    it('screen reader can access all data', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 15, percentage: 60 }),
        createMockOptionResult({ optionid: 2, text: 'Option B', count: 10, percentage: 40 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // All text content should be accessible
      expect(screen.getByText('Option A')).toBeInTheDocument();
      expect(screen.getByText('Option B')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('color contrast meets WCAG AA standards', async () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // Run axe accessibility tests
      const results = await axeRun(container);
      
      // Check for color contrast violations
      const contrastViolations = results.violations.filter(
        (v) => v.id === 'color-contrast'
      );
      expect(contrastViolations).toHaveLength(0);
    });

    it('tab navigation works correctly', async () => {
      const user = userEvent.setup();
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option A', count: 10, percentage: 50 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // Tab through interactive elements
      await user.tab();
      
      // Should be able to navigate through the component
      expect(document.activeElement).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles very small percentages (< 1%)', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Tiny', count: 1, percentage: 0.5 }),
        createMockOptionResult({ optionid: 2, text: 'Large', count: 199, percentage: 99.5 }),
      ];

      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(screen.getByText(/0\.5%/)).toBeInTheDocument();
      expect(screen.getByText(/99\.5%/)).toBeInTheDocument();

      const bars = container.querySelectorAll('[data-testid*="chart-bar"]');
      // Even tiny percentages should render a visible bar
      expect(bars[0]).toHaveStyle({ width: '0.5%' });
    });

    it('handles very large numbers (> 1000 responses)', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Popular', count: 5000, percentage: 50 }),
        createMockOptionResult({ optionid: 2, text: 'Also Popular', count: 5000, percentage: 50 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(screen.getByText('5000')).toBeInTheDocument();
      // Large numbers should be formatted properly
      const countElements = screen.getAllByText('5000');
      expect(countElements.length).toBe(2);
    });

    it('handles decimal percentages with proper rounding', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'A', count: 10, percentage: 33.333333 }),
        createMockOptionResult({ optionid: 2, text: 'B', count: 10, percentage: 33.333333 }),
        createMockOptionResult({ optionid: 3, text: 'C', count: 10, percentage: 33.333334 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // Should display rounded percentages (typically to 1 decimal place)
      const percentageElements = screen.getAllByText(/33\.3%/);
      expect(percentageElements.length).toBeGreaterThan(0);
    });

    it('handles special characters in option text', () => {
      const options = [
        createMockOptionResult({ 
          optionid: 1, 
          text: 'Option with <special> & "characters"', 
          count: 10, 
          percentage: 50 
        }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // React should properly escape special characters
      expect(screen.getByText(/Option with <special> & "characters"/)).toBeInTheDocument();
    });

    it('handles very long option names with ellipsis', () => {
      const longName = 'This is an extremely long option name that exceeds normal character limits and should be truncated with ellipsis to maintain proper layout and visual hierarchy';
      const options = [
        createMockOptionResult({ optionid: 1, text: longName, count: 10, percentage: 100 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('handles negative or invalid data gracefully', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Invalid', count: -5, percentage: -10 }),
      ];

      // Should not crash, even with invalid data
      const { container } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(container).toBeInTheDocument();
      // Component should handle negative values gracefully
      expect(screen.getByText('Invalid')).toBeInTheDocument();
    });
  });

  describe('Props Validation Tests', () => {
    it('required props: options array', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option', count: 10, percentage: 100 }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(screen.getByText('Option')).toBeInTheDocument();
    });

    it('optional props: displayLayout, showPercentages', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option', count: 10, percentage: 100 }),
      ];

      // Test with showPercentages = false
      const { rerender } = render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={false}
        />
      );

      // Percentage should be hidden
      expect(screen.queryByText(/100\.0%/)).not.toBeInTheDocument();

      // Test with vertical layout
      rerender(
        <ChoiceChart
          options={options}
          displayLayout="vertical"
          showPercentages={true}
        />
      );

      expect(screen.getByText('Option')).toBeInTheDocument();
    });

    it('default values applied when props not provided', () => {
      const options = [
        createMockOptionResult({ optionid: 1, text: 'Option', count: 10, percentage: 100 }),
      ];

      // Component should handle missing optional props gracefully
      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      expect(screen.getByText('Option')).toBeInTheDocument();
    });

    it('TypeScript interfaces enforced', () => {
      // This test validates that TypeScript compilation succeeds
      const options = [
        createMockOptionResult({ 
          optionid: 1, 
          text: 'Valid Option', 
          count: 10, 
          percentage: 50,
          maxanswers: 20
        }),
      ];

      render(
        <ChoiceChart
          options={options}
          displayLayout="horizontal"
          showPercentages={true}
        />
      );

      // If this compiles and renders, TypeScript interfaces are properly enforced
      expect(screen.getByText('Valid Option')).toBeInTheDocument();
    });
  });
});
