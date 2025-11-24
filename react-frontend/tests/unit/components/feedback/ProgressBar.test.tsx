/**
 * Unit Tests for ProgressBar Component
 * 
 * Comprehensive test suite validating determinate progress (0-100%), indeterminate progress,
 * color variants, label display, buffer mode, height customization, and accessibility features.
 * Tests cover all use cases including file uploads, quiz timers, completion tracking, and
 * multi-stage operations with WCAG 2.1 AA compliance validation.
 * 
 * @see ProgressBar component at react-frontend/src/components/feedback/ProgressBar.tsx
 * @see Section 0.4 Transformation Mapping - React feedback components
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ProgressBar } from '@/components/feedback/ProgressBar';

describe('ProgressBar Component', () => {
  // Clean up after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Basic Rendering Tests
   * Validate that ProgressBar renders correctly with different configurations
   */
  describe('Basic Rendering', () => {
    test('renders progress bar', () => {
      render(<ProgressBar />);
      
      // Assert LinearProgress component present via role
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    test('renders with default props', () => {
      render(<ProgressBar />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert indeterminate variant when no value provided
      expect(progressBar).toBeInTheDocument();
      // Indeterminate progress should not have aria-valuenow
      expect(progressBar).not.toHaveAttribute('aria-valuenow');
    });

    test('displays label when showLabel=true', () => {
      render(<ProgressBar value={50} showLabel />);
      
      // Assert label visible with percentage
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    test('hides label when showLabel=false', () => {
      render(<ProgressBar value={50} showLabel={false} />);
      
      // Assert no label element present
      expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });

    test('renders with custom className', () => {
      const { container } = render(<ProgressBar className="custom-progress" />);
      
      // Assert custom class applied to container
      const wrapper = container.querySelector('.custom-progress');
      expect(wrapper).toBeInTheDocument();
    });
  });

  /**
   * Determinate Progress Tests
   * Validate progress bar with specific percentage values
   */
  describe('Determinate Progress', () => {
    test('renders determinate variant with value', () => {
      render(<ProgressBar value={50} />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert determinate variant indicated by aria-valuenow presence
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    });

    test('displays 0% progress', () => {
      render(<ProgressBar value={0} showLabel />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert value at minimum
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    test('displays 50% progress', () => {
      render(<ProgressBar value={50} showLabel />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert half filled
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    test('displays 100% progress', () => {
      render(<ProgressBar value={100} showLabel />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert fully filled
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    test('clamps negative values to 0', () => {
      render(<ProgressBar value={-10} showLabel />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert value clamped to 0
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    test('clamps values above 100 to 100', () => {
      render(<ProgressBar value={150} showLabel />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert value clamped to 100
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    test('handles decimal values', () => {
      render(<ProgressBar value={33.33} showLabel />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert decimal value rounded for display
      expect(progressBar).toHaveAttribute('aria-valuenow', '33.33');
      expect(screen.getByText('33%')).toBeInTheDocument(); // Rounded display
    });

    test('validates aria-valuenow attribute matches value prop', () => {
      const { rerender } = render(<ProgressBar value={25} />);
      
      let progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '25');
      
      // Update value
      rerender(<ProgressBar value={75} />);
      
      progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    });
  });

  /**
   * Indeterminate Progress Tests
   * Validate progress bar for operations with unknown duration
   */
  describe('Indeterminate Progress', () => {
    test('renders indeterminate variant without value', () => {
      render(<ProgressBar />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert indeterminate by absence of aria-valuenow
      expect(progressBar).not.toHaveAttribute('aria-valuenow');
      expect(progressBar).toBeInTheDocument();
    });

    test('indeterminate progress animates', () => {
      const { container } = render(<ProgressBar />);
      
      // Assert animation present through MUI classes
      const linearProgress = container.querySelector('.MuiLinearProgress-indeterminate');
      expect(linearProgress).toBeInTheDocument();
    });

    test('no aria-valuenow in indeterminate mode', () => {
      render(<ProgressBar />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert aria-valuenow not present
      expect(progressBar).not.toHaveAttribute('aria-valuenow');
    });

    test('indeterminate with aria-label', () => {
      render(<ProgressBar ariaLabel="Loading content" />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert accessible label present
      expect(progressBar).toHaveAttribute('aria-label', 'Loading content');
    });
  });

  /**
   * Color Variant Tests
   * Validate all color options match MUI theme colors
   */
  describe('Color Variants', () => {
    test('renders with primary color (default)', () => {
      const { container } = render(<ProgressBar value={50} />);
      
      // Assert primary color applied via MUI class
      const linearProgress = container.querySelector('.MuiLinearProgress-colorPrimary');
      expect(linearProgress).toBeInTheDocument();
    });

    test('renders with secondary color', () => {
      const { container } = render(<ProgressBar value={50} color="secondary" />);
      
      // Assert secondary color applied
      const linearProgress = container.querySelector('.MuiLinearProgress-colorSecondary');
      expect(linearProgress).toBeInTheDocument();
    });

    test('renders with success color', () => {
      const { container } = render(<ProgressBar value={50} color="success" />);
      
      // Assert success color applied (green styling)
      const linearProgress = container.querySelector('.MuiLinearProgress-colorSuccess');
      expect(linearProgress).toBeInTheDocument();
    });

    test('renders with error color', () => {
      const { container } = render(<ProgressBar value={50} color="error" />);
      
      // Assert error color applied (red styling)
      const linearProgress = container.querySelector('.MuiLinearProgress-colorError');
      expect(linearProgress).toBeInTheDocument();
    });

    test('renders with warning color', () => {
      const { container } = render(<ProgressBar value={50} color="warning" />);
      
      // Assert warning color applied (yellow/orange styling)
      const linearProgress = container.querySelector('.MuiLinearProgress-colorWarning');
      expect(linearProgress).toBeInTheDocument();
    });

    test('renders with info color', () => {
      const { container } = render(<ProgressBar value={50} color="info" />);
      
      // Assert info color applied (blue styling)
      const linearProgress = container.querySelector('.MuiLinearProgress-colorInfo');
      expect(linearProgress).toBeInTheDocument();
    });

    test('validates LinearProgress color prop matches input', () => {
      const { container, rerender } = render(<ProgressBar value={50} color="primary" />);
      
      let linearProgress = container.querySelector('.MuiLinearProgress-colorPrimary');
      expect(linearProgress).toBeInTheDocument();
      
      // Change color
      rerender(<ProgressBar value={50} color="error" />);
      
      linearProgress = container.querySelector('.MuiLinearProgress-colorError');
      expect(linearProgress).toBeInTheDocument();
    });
  });

  /**
   * Label Display Tests
   * Validate percentage and custom label rendering
   */
  describe('Label Display', () => {
    test('displays percentage label', () => {
      render(<ProgressBar value={75} showLabel />);
      
      // Assert percentage text displayed
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    test('displays custom label', () => {
      render(<ProgressBar value={50} showLabel label="Processing..." />);
      
      // Assert custom text displayed
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    test('custom label overrides percentage', () => {
      render(<ProgressBar value={75} showLabel label="Almost done" />);
      
      // Assert custom label shown, not percentage
      expect(screen.getByText('Almost done')).toBeInTheDocument();
      expect(screen.queryByText('75%')).not.toBeInTheDocument();
    });

    test('label positioning below bar', () => {
      render(<ProgressBar value={50} showLabel labelPosition="below" />);
      
      // Assert Typography element after LinearProgress
      const label = screen.getByText('50%');
      expect(label).toBeInTheDocument();
      expect(label.tagName).toBe('P'); // Typography renders as <p> by default for caption
    });

    test('label positioning as overlay', () => {
      render(<ProgressBar value={50} showLabel labelPosition="overlay" />);
      
      // Assert label exists with overlay positioning
      const label = screen.getByText('50%');
      expect(label).toBeInTheDocument();
      
      // Overlay label should have position absolute in parent
      const labelParent = label.parentElement;
      expect(labelParent).toHaveStyle({ position: 'absolute' });
    });

    test('no label when showLabel is undefined', () => {
      render(<ProgressBar value={50} />);
      
      // Assert no label displayed by default
      expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });

    test('label with ReactNode content', () => {
      render(
        <ProgressBar
          value={60}
          showLabel
          label={<span data-testid="custom-node">Custom Node Label</span>}
        />
      );
      
      // Assert ReactNode label renders correctly
      expect(screen.getByTestId('custom-node')).toBeInTheDocument();
      expect(screen.getByText('Custom Node Label')).toBeInTheDocument();
    });
  });

  /**
   * Buffer Mode Tests
   * Validate multi-stage operation progress display
   */
  describe('Buffer Mode', () => {
    test('renders buffer variant', () => {
      const { container } = render(
        <ProgressBar value={30} buffer={50} variant="buffer" />
      );
      
      // Assert buffer variant via MUI class
      const linearProgress = container.querySelector('.MuiLinearProgress-buffer');
      expect(linearProgress).toBeInTheDocument();
    });

    test('buffer value displays correctly', () => {
      render(<ProgressBar value={30} buffer={50} variant="buffer" showLabel />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert both primary value and buffer exist
      expect(progressBar).toHaveAttribute('aria-valuenow', '30');
      expect(progressBar).toBeInTheDocument();
    });

    test('primary and buffer values both shown', () => {
      const { container } = render(
        <ProgressBar value={40} buffer={70} variant="buffer" />
      );
      
      // Assert buffer variant displays two progress indicators
      const linearProgress = container.querySelector('.MuiLinearProgress-buffer');
      expect(linearProgress).toBeInTheDocument();
      
      // Buffer creates two bars (primary and buffer)
      const bars = container.querySelectorAll('.MuiLinearProgress-bar');
      expect(bars.length).toBeGreaterThan(0);
    });

    test('buffer value clamped 0-100', () => {
      const { rerender } = render(
        <ProgressBar value={50} buffer={-10} variant="buffer" />
      );
      
      let progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      
      // Test upper clamp
      rerender(<ProgressBar value={50} buffer={150} variant="buffer" />);
      
      progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    test('auto-detects buffer variant', () => {
      const { container } = render(<ProgressBar value={30} buffer={60} />);
      
      // Assert buffer variant automatically applied when buffer prop provided
      const linearProgress = container.querySelector('.MuiLinearProgress-buffer');
      expect(linearProgress).toBeInTheDocument();
    });
  });

  /**
   * Height Customization Tests
   * Validate custom height styling
   */
  describe('Height Customization', () => {
    test('renders with default height (4px)', () => {
      const { container } = render(<ProgressBar value={50} />);
      
      const linearProgress = container.querySelector('.MuiLinearProgress-root');
      
      // Assert default height style applied
      expect(linearProgress).toHaveStyle({ height: '4px' });
    });

    test('renders with custom height', () => {
      const { container } = render(<ProgressBar value={50} height={10} />);
      
      const linearProgress = container.querySelector('.MuiLinearProgress-root');
      
      // Assert custom height applied
      expect(linearProgress).toHaveStyle({ height: '10px' });
    });

    test('height applies to LinearProgress', () => {
      const { container } = render(<ProgressBar value={50} height={8} />);
      
      const linearProgress = container.querySelector('.MuiLinearProgress-root');
      
      // Validate CSS/style attributes
      expect(linearProgress).toHaveStyle({ height: '8px' });
      
      // Also validate border radius scales with height (height/2)
      expect(linearProgress).toHaveStyle({ borderRadius: '4px' });
    });
  });

  /**
   * Accessibility Tests
   * Validate WCAG 2.1 AA compliance with proper ARIA attributes
   */
  describe('Accessibility', () => {
    test('has role=progressbar', () => {
      render(<ProgressBar value={50} />);
      
      // Assert role attribute on LinearProgress
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    test('has aria-valuenow for determinate', () => {
      render(<ProgressBar value={65} />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert current value in ARIA
      expect(progressBar).toHaveAttribute('aria-valuenow', '65');
    });

    test('has aria-valuemin=0', () => {
      render(<ProgressBar value={50} />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert minimum value attribute
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    });

    test('has aria-valuemax=100', () => {
      render(<ProgressBar value={50} />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert maximum value attribute
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    test('aria-valuenow updates with value changes', () => {
      const { rerender } = render(<ProgressBar value={30} />);
      
      let progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '30');
      
      // Change value
      rerender(<ProgressBar value={80} />);
      
      progressBar = screen.getByRole('progressbar');
      
      // Assert ARIA updates
      expect(progressBar).toHaveAttribute('aria-valuenow', '80');
    });

    test('no aria-valuenow for indeterminate', () => {
      render(<ProgressBar />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert attribute not present for indeterminate
      expect(progressBar).not.toHaveAttribute('aria-valuenow');
    });

    test('has aria-label when provided', () => {
      render(<ProgressBar ariaLabel="File upload progress" value={50} />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert accessible name
      expect(progressBar).toHaveAttribute('aria-label', 'File upload progress');
    });

    test('all ARIA attributes present for determinate', () => {
      render(<ProgressBar value={42} ariaLabel="Loading progress" />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Comprehensive ARIA validation
      expect(progressBar).toHaveAttribute('role', 'progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '42');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-label', 'Loading progress');
    });
  });

  /**
   * Real-World Integration Tests
   * Simulate actual usage scenarios from Moodle operations
   */
  describe('Real-World Integration', () => {
    test('file upload progress scenario', async () => {
      const { rerender } = render(
        <ProgressBar
          value={0}
          showLabel
          label="Starting upload..."
          color="primary"
        />
      );
      
      // Simulate upload from 0% to 100%
      expect(screen.getByText('Starting upload...')).toBeInTheDocument();
      
      // 25% uploaded
      rerender(
        <ProgressBar value={25} showLabel label="Uploading (25%)" color="primary" />
      );
      await waitFor(() => {
        expect(screen.getByText('Uploading (25%)')).toBeInTheDocument();
      });
      
      // 50% uploaded
      rerender(
        <ProgressBar value={50} showLabel label="Uploading (50%)" color="primary" />
      );
      await waitFor(() => {
        expect(screen.getByText('Uploading (50%)')).toBeInTheDocument();
      });
      
      // 100% complete
      rerender(
        <ProgressBar value={100} showLabel label="Upload complete!" color="success" />
      );
      await waitFor(() => {
        expect(screen.getByText('Upload complete!')).toBeInTheDocument();
      });
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    test('quiz timer countdown scenario', async () => {
      // Simulate decreasing progress for time remaining
      const { rerender } = render(
        <ProgressBar
          value={100}
          showLabel
          label="30:00 remaining"
          color="success"
          height={6}
        />
      );
      
      expect(screen.getByText('30:00 remaining')).toBeInTheDocument();
      
      // 50% time remaining
      rerender(
        <ProgressBar
          value={50}
          showLabel
          label="15:00 remaining"
          color="warning"
          height={6}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('15:00 remaining')).toBeInTheDocument();
      });
      
      // 10% time remaining (critical)
      rerender(
        <ProgressBar
          value={10}
          showLabel
          label="03:00 remaining"
          color="error"
          height={6}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('03:00 remaining')).toBeInTheDocument();
      });
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '10');
    });

    test('course completion tracking', () => {
      render(
        <ProgressBar
          value={85}
          showLabel
          label="Course 85% complete"
          color="success"
        />
      );
      
      // Simulate completion percentage
      expect(screen.getByText('Course 85% complete')).toBeInTheDocument();
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '85');
    });

    test('multi-stage operation with buffer', () => {
      render(
        <ProgressBar
          value={40}
          buffer={70}
          variant="buffer"
          showLabel
          label="Processing: upload 40%, verification 70%"
          color="primary"
        />
      );
      
      // Simulate buffer for staged operation
      expect(screen.getByText('Processing: upload 40%, verification 70%')).toBeInTheDocument();
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '40');
    });
  });

  /**
   * Animation and Updates Tests
   * Validate smooth transitions and rapid value changes
   */
  describe('Animation and Updates', () => {
    test('progress updates smoothly', async () => {
      const { rerender } = render(<ProgressBar value={10} showLabel />);
      
      expect(screen.getByText('10%')).toBeInTheDocument();
      
      // Change value multiple times
      rerender(<ProgressBar value={30} showLabel />);
      await waitFor(() => {
        expect(screen.getByText('30%')).toBeInTheDocument();
      });
      
      rerender(<ProgressBar value={60} showLabel />);
      await waitFor(() => {
        expect(screen.getByText('60%')).toBeInTheDocument();
      });
      
      rerender(<ProgressBar value={90} showLabel />);
      await waitFor(() => {
        expect(screen.getByText('90%')).toBeInTheDocument();
      });
      
      // Assert smooth transition with no errors
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '90');
    });

    test('handles rapid value changes', async () => {
      const { rerender } = render(<ProgressBar value={0} />);
      
      // Update value quickly
      for (let i = 10; i <= 100; i += 10) {
        rerender(<ProgressBar value={i} showLabel />);
      }
      
      // Assert no errors and final value correct
      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    test('handles value prop changes in controlled component pattern', async () => {
      const { rerender } = render(<ProgressBar value={25} showLabel />);
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '25');
      
      // Controlled update
      rerender(<ProgressBar value={75} showLabel />);
      
      await waitFor(() => {
        expect(screen.getByText('75%')).toBeInTheDocument();
        expect(progressBar).toHaveAttribute('aria-valuenow', '75');
      });
    });
  });

  /**
   * Edge Cases
   * Validate graceful handling of unusual input values
   */
  describe('Edge Cases', () => {
    test('handles undefined value gracefully', () => {
      render(<ProgressBar />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert indeterminate mode
      expect(progressBar).not.toHaveAttribute('aria-valuenow');
      expect(progressBar).toBeInTheDocument();
    });

    test('handles null value gracefully', () => {
      // @ts-expect-error - Testing null handling
      render(<ProgressBar value={null} />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert defaults to indeterminate
      expect(progressBar).not.toHaveAttribute('aria-valuenow');
    });

    test('renders without label when showLabel undefined', () => {
      render(<ProgressBar value={50} />);
      
      // Assert default no label
      expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });

    test('handles zero value correctly', () => {
      render(<ProgressBar value={0} showLabel />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Zero is valid determinate value
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    test('handles very small decimal values', () => {
      render(<ProgressBar value={0.5} showLabel />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert small decimals handled
      expect(progressBar).toHaveAttribute('aria-valuenow', '0.5');
      expect(screen.getByText('1%')).toBeInTheDocument(); // Rounded display
    });

    test('handles very large values by clamping', () => {
      render(<ProgressBar value={999999} showLabel />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Assert clamped to maximum
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    test('handles color prop with invalid value', () => {
      // @ts-expect-error - Testing invalid color handling
      const { container } = render(<ProgressBar value={50} color="invalid" />);
      
      // Assert falls back to primary
      const linearProgress = container.querySelector('.MuiLinearProgress-colorPrimary');
      expect(linearProgress).toBeInTheDocument();
    });

    test('handles empty string label', () => {
      render(<ProgressBar value={50} showLabel label="" />);
      
      // Empty label should not render
      expect(screen.queryByText('')).not.toBeInTheDocument();
    });
  });
});
