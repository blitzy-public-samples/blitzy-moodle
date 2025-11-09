/**
 * Unit tests for useToast custom hook
 *
 * Tests comprehensive toast notification queue management functionality including:
 * - Toast creation with different types (success, error, warning, info)
 * - Auto-dismissal after configurable timeout duration
 * - Manual dismissal of individual toasts by ID
 * - Clearing all toasts from the queue
 * - Toast queue management and ordering (FIFO)
 * - Convenience methods for different toast types
 * - Unique ID generation for each toast
 * - Custom duration configuration
 * - Action button support in toast options
 *
 * Uses React Testing Library's renderHook for isolated hook testing,
 * act() for wrapping state updates, and Vitest fake timers for
 * testing timeout-based auto-dismissal functionality.
 *
 * @module tests/unit/hooks/useToast
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '@/hooks/useToast';

describe('useToast', () => {
  /**
   * Setup fake timers before each test to control setTimeout behavior
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /**
   * Restore real timers after each test for cleanup
   */
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Test: Hook initialization
   * Verifies that the hook initializes with an empty toasts array
   */
  it('should initialize with empty toasts array', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toasts).toEqual([]);
    expect(result.current.toasts.length).toBe(0);
  });

  /**
   * Test: Basic toast creation
   * Verifies showToast function adds a toast with correct properties
   */
  it('should add toast with showToast function', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test message', 'info');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      message: 'Test message',
      type: 'info',
      duration: 5000,
    });
    expect(result.current.toasts[0].id).toBeTruthy();
    expect(typeof result.current.toasts[0].id).toBe('string');
  });

  /**
   * Test: Unique ID generation
   * Verifies that each toast gets a unique identifier
   */
  it('should generate unique IDs for each toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('First toast', 'info');
      result.current.showToast('Second toast', 'success');
      result.current.showToast('Third toast', 'error');
    });

    const ids = result.current.toasts.map((toast) => toast.id);
    const uniqueIds = new Set(ids);

    expect(ids.length).toBe(3);
    expect(uniqueIds.size).toBe(3);
    // Verify no duplicate IDs
    ids.forEach((id, index) => {
      expect(ids.indexOf(id)).toBe(index);
    });
  });

  /**
   * Test: Success convenience method
   * Verifies success() creates a toast with type 'success'
   */
  it('should add toast using success convenience method', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Success!');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].message).toBe('Success!');
  });

  /**
   * Test: Error convenience method
   * Verifies error() creates a toast with type 'error'
   */
  it('should add toast using error convenience method', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.error('Error!');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('error');
    expect(result.current.toasts[0].message).toBe('Error!');
  });

  /**
   * Test: Warning convenience method
   * Verifies warning() creates a toast with type 'warning'
   */
  it('should add toast using warning convenience method', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.warning('Warning!');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('warning');
    expect(result.current.toasts[0].message).toBe('Warning!');
  });

  /**
   * Test: Info convenience method
   * Verifies info() creates a toast with type 'info'
   */
  it('should add toast using info convenience method', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.info('Info!');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('info');
    expect(result.current.toasts[0].message).toBe('Info!');
  });

  /**
   * Test: Auto-dismiss with default duration
   * Verifies toast automatically dismisses after default 5000ms timeout
   */
  it('should auto-dismiss toast after default duration (5000ms)', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Auto-dismiss test', 'info');
    });

    // Toast should be present
    expect(result.current.toasts).toHaveLength(1);

    // Advance time by 4999ms - toast should still be present
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(result.current.toasts).toHaveLength(1);

    // Advance time by 1ms more (total 5000ms) - toast should be dismissed
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  /**
   * Test: Auto-dismiss with custom duration
   * Verifies toast automatically dismisses after custom timeout duration
   */
  it('should auto-dismiss toast after custom duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Custom duration test', 'success', {
        duration: 2000,
      });
    });

    expect(result.current.toasts).toHaveLength(1);

    // Advance time by 2000ms - toast should be dismissed
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  /**
   * Test: Manual dismissal by ID
   * Verifies dismiss() removes specific toast from queue without affecting others
   */
  it('should dismiss specific toast by ID', () => {
    const { result } = renderHook(() => useToast());

    let toast1Id: string;
    let toast2Id: string;
    let toast3Id: string;

    act(() => {
      toast1Id = result.current.showToast('First toast', 'info');
      toast2Id = result.current.showToast('Second toast', 'success');
      toast3Id = result.current.showToast('Third toast', 'warning');
    });

    expect(result.current.toasts).toHaveLength(3);

    // Dismiss the second toast
    act(() => {
      result.current.dismiss(toast2Id);
    });

    expect(result.current.toasts).toHaveLength(2);
    
    // Verify the second toast was dismissed
    const remainingIds = result.current.toasts.map((t) => t.id);
    expect(remainingIds).not.toContain(toast2Id);
    expect(remainingIds).toContain(toast1Id);
    expect(remainingIds).toContain(toast3Id);
    
    // Verify the correct toasts remain
    expect(result.current.toasts[0].message).toBe('First toast');
    expect(result.current.toasts[1].message).toBe('Third toast');
  });

  /**
   * Test: Clear all toasts
   * Verifies clear() removes all toasts from the queue
   */
  it('should clear all toasts with clear function', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Toast 1', 'info');
      result.current.showToast('Toast 2', 'success');
      result.current.showToast('Toast 3', 'error');
      result.current.showToast('Toast 4', 'warning');
      result.current.showToast('Toast 5', 'info');
    });

    expect(result.current.toasts).toHaveLength(5);

    act(() => {
      result.current.clear();
    });

    expect(result.current.toasts).toHaveLength(0);
    expect(result.current.toasts).toEqual([]);
  });

  /**
   * Test: Multiple toasts with different durations
   * Verifies toasts with different durations dismiss at correct times
   */
  it('should handle multiple toasts with different durations', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Short duration', 'info', { duration: 1000 });
      result.current.showToast('Long duration', 'success', { duration: 3000 });
    });

    expect(result.current.toasts).toHaveLength(2);

    // Advance time by 1000ms - first toast should dismiss
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Long duration');

    // Advance time by 2000ms more (total 3000ms) - second toast should dismiss
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    
    expect(result.current.toasts).toHaveLength(0);
  });

  /**
   * Test: Action button support
   * Verifies toast can include action button with label and onClick handler
   */
  it('should support action buttons in toast options', () => {
    const { result } = renderHook(() => useToast());
    const mockAction = vi.fn();

    act(() => {
      result.current.showToast('Toast with action', 'info', {
        action: {
          label: 'Undo',
          onClick: mockAction,
        },
      });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].action).toBeDefined();
    expect(result.current.toasts[0].action?.label).toBe('Undo');
    expect(result.current.toasts[0].action?.onClick).toBe(mockAction);
    expect(typeof result.current.toasts[0].action?.onClick).toBe('function');
  });

  /**
   * Test: Toast queue ordering (FIFO)
   * Verifies toasts are maintained in first-in-first-out order
   */
  it('should maintain toast queue order (FIFO)', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('First', 'info');
      result.current.showToast('Second', 'success');
      result.current.showToast('Third', 'warning');
    });

    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts[0].message).toBe('First');
    expect(result.current.toasts[1].message).toBe('Second');
    expect(result.current.toasts[2].message).toBe('Third');
  });

  /**
   * Test: Graceful handling of non-existent toast ID
   * Verifies dismiss() with invalid ID doesn't throw error and doesn't affect existing toasts
   */
  it('should handle dismissing non-existent toast ID gracefully', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test toast', 'info');
    });

    expect(result.current.toasts).toHaveLength(1);
    const originalToast = result.current.toasts[0];

    // Attempt to dismiss non-existent toast - should not throw error
    expect(() => {
      act(() => {
        result.current.dismiss('non-existent-id-12345');
      });
    }).not.toThrow();

    // Original toast should still be present
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].id).toBe(originalToast.id);
    expect(result.current.toasts[0].message).toBe('Test toast');
  });

  /**
   * Test: Manual dismiss only (duration: 0)
   * Verifies toast with duration 0 does not auto-dismiss and requires manual dismissal
   */
  it('should not dismiss toast if duration is 0 (manual dismiss only)', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Manual dismiss only', 'info', {
        duration: 0,
      });
    });

    expect(result.current.toasts).toHaveLength(1);

    // Advance time by 10 seconds - toast should still be present
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Manual dismiss only');
  });

  /**
   * Test: Convenience methods return toast ID
   * Verifies all convenience methods return the toast ID for manual control
   */
  it('should return toast ID from convenience methods', () => {
    const { result } = renderHook(() => useToast());

    let successId: string;
    let errorId: string;
    let warningId: string;
    let infoId: string;

    act(() => {
      successId = result.current.success('Success message');
      errorId = result.current.error('Error message');
      warningId = result.current.warning('Warning message');
      infoId = result.current.info('Info message');
    });

    expect(typeof successId).toBe('string');
    expect(typeof errorId).toBe('string');
    expect(typeof warningId).toBe('string');
    expect(typeof infoId).toBe('string');

    expect(successId).toBeTruthy();
    expect(errorId).toBeTruthy();
    expect(warningId).toBeTruthy();
    expect(infoId).toBeTruthy();

    // Verify IDs match the toasts in the queue
    const toastIds = result.current.toasts.map((t) => t.id);
    expect(toastIds).toContain(successId);
    expect(toastIds).toContain(errorId);
    expect(toastIds).toContain(warningId);
    expect(toastIds).toContain(infoId);
  });

  /**
   * Test: Custom duration with convenience methods
   * Verifies convenience methods accept custom duration in options
   */
  it('should support custom duration with convenience methods', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Success with custom duration', { duration: 3000 });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].duration).toBe(3000);

    // Advance time by 2999ms - toast should still be present
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.toasts).toHaveLength(1);

    // Advance time by 1ms more (total 3000ms) - toast should be dismissed
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  /**
   * Test: Multiple dismissals and additions
   * Verifies complex scenarios with adding and dismissing multiple toasts
   */
  it('should handle complex add and dismiss scenarios', () => {
    const { result } = renderHook(() => useToast());

    let id1: string, id2: string, id3: string, id4: string;

    act(() => {
      id1 = result.current.showToast('Toast 1', 'info');
      id2 = result.current.showToast('Toast 2', 'success');
      id3 = result.current.showToast('Toast 3', 'warning');
    });

    expect(result.current.toasts).toHaveLength(3);

    // Dismiss first and third toasts
    act(() => {
      result.current.dismiss(id1);
      result.current.dismiss(id3);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].id).toBe(id2);

    // Add new toast
    act(() => {
      id4 = result.current.showToast('Toast 4', 'error');
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(result.current.toasts[0].id).toBe(id2);
    expect(result.current.toasts[1].id).toBe(id4);
  });

  /**
   * Test: Toast with all options
   * Verifies toast can be created with complete configuration including custom duration and action
   */
  it('should create toast with all options', () => {
    const { result } = renderHook(() => useToast());
    const mockAction = vi.fn();

    act(() => {
      result.current.showToast('Full options toast', 'warning', {
        duration: 7000,
        action: {
          label: 'Retry',
          onClick: mockAction,
        },
      });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      message: 'Full options toast',
      type: 'warning',
      duration: 7000,
    });
    expect(result.current.toasts[0].action).toBeDefined();
    expect(result.current.toasts[0].action?.label).toBe('Retry');
    expect(result.current.toasts[0].action?.onClick).toBe(mockAction);
  });
});
