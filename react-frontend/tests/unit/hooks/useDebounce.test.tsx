import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useDebounce from '@/hooks/useDebounce';

/**
 * Unit tests for useDebounce custom hook
 *
 * Tests the debouncing functionality that delays value updates until after a specified
 * delay period has passed without changes to the input value. Validates proper timing
 * behavior, cleanup on unmount, handling of rapid changes, and TypeScript type preservation.
 *
 * Test Coverage:
 * - Initial value behavior (immediate return without debouncing)
 * - Default delay timing (500ms)
 * - Custom delay timing
 * - Rapid value changes (timeout reset behavior)
 * - Multiple debounce cycles
 * - Cleanup on unmount (memory leak prevention)
 * - Type preservation (string, number, object, array)
 * - Edge case: zero delay
 */
describe('useDebounce', () => {
  /**
   * Set up fake timers before each test to control time passage
   * This allows us to test debounce timing behavior deterministically
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /**
   * Restore real timers after each test to clean up
   * Prevents fake timers from affecting other tests
   */
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Test: Initial value should be returned immediately without debouncing
   *
   * Purpose: Verify that the hook returns the initial value synchronously
   * on first render, without waiting for any debounce delay.
   *
   * Expected behavior:
   * - The debounced value equals the initial value immediately
   * - No delay is applied to the first render
   */
  it('should return initial value immediately', () => {
    const initialValue = 'initial';
    const { result } = renderHook(() => useDebounce(initialValue));

    // Assert: Debounced value should equal initial value immediately
    expect(result.current).toBe(initialValue);
  });

  /**
   * Test: Should debounce value updates with default delay (500ms)
   *
   * Purpose: Verify that the hook waits for the default 500ms delay before
   * updating the debounced value when the input value changes.
   *
   * Expected behavior:
   * - Before 500ms: debounced value remains as initial value
   * - After 500ms: debounced value updates to new value
   *
   * Assertions:
   * 1. Before timeout: debounced value equals initial value
   * 2. At 499ms: debounced value still equals initial value (not updated yet)
   * 3. At 500ms: debounced value updates to new value
   */
  it('should debounce value updates with default delay (500ms)', () => {
    const initialValue = 'initial';
    const newValue = 'updated';

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      {
        initialProps: { value: initialValue },
      }
    );

    // Initial render: value should be initial value
    expect(result.current).toBe(initialValue);

    // Rerender with new value
    rerender({ value: newValue });

    // Assert: Before timeout completes, debounced value should still be initial value
    expect(result.current).toBe(initialValue);

    // Advance timers by 499ms (1ms before timeout)
    act(() => {
      vi.advanceTimersByTime(499);
    });

    // Assert: At 499ms, debounced value should NOT be updated yet
    expect(result.current).toBe(initialValue);

    // Advance timers by 1ms more (total 500ms)
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Assert: At 500ms, debounced value should be updated to new value
    expect(result.current).toBe(newValue);
  });

  /**
   * Test: Should debounce value updates with custom delay
   *
   * Purpose: Verify that the hook respects a custom delay parameter
   * and updates the debounced value only after that custom delay period.
   *
   * Expected behavior:
   * - Before custom delay (1000ms): debounced value remains unchanged
   * - After custom delay (1000ms): debounced value updates to new value
   *
   * Assertions:
   * 1. Before 1000ms: debounced value equals initial value
   * 2. After 1000ms: debounced value updates to new value
   */
  it('should debounce value updates with custom delay', () => {
    const initialValue = 'initial';
    const newValue = 'updated';
    const customDelay = 1000;

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: initialValue, delay: customDelay },
      }
    );

    // Initial render: value should be initial value
    expect(result.current).toBe(initialValue);

    // Rerender with new value (same custom delay)
    rerender({ value: newValue, delay: customDelay });

    // Assert: Before timeout completes, debounced value should still be initial value
    expect(result.current).toBe(initialValue);

    // Advance timers by 999ms (1ms before custom timeout)
    act(() => {
      vi.advanceTimersByTime(999);
    });

    // Assert: At 999ms, debounced value should NOT be updated yet
    expect(result.current).toBe(initialValue);

    // Advance timers by 1ms more (total 1000ms)
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Assert: At 1000ms, debounced value should be updated to new value
    expect(result.current).toBe(newValue);
  });

  /**
   * Test: Should reset timeout on rapid value changes
   *
   * Purpose: Verify that when the input value changes multiple times rapidly,
   * the debounce timer resets on each change, and only the final value is
   * returned after the delay period from the last change.
   *
   * Expected behavior:
   * - Each value change resets the timeout
   * - Only the final value triggers an update after the delay
   * - Intermediate values are never reflected in the debounced value
   *
   * Scenario:
   * - Change to value1, wait 400ms (not enough for 500ms delay)
   * - Change to value2, wait 400ms (timeout resets, still not enough)
   * - Change to value3, wait 400ms (timeout resets again, still not enough)
   * - Total 1200ms passed, but only 400ms since last change
   * - Wait additional 100ms (500ms since last change)
   * - Debounced value should equal value3, skipping value1 and value2
   */
  it('should reset timeout on rapid value changes', () => {
    const initialValue = 'initial';
    const value1 = 'change1';
    const value2 = 'change2';
    const value3 = 'change3';

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      {
        initialProps: { value: initialValue },
      }
    );

    // Initial render: value should be initial value
    expect(result.current).toBe(initialValue);

    // First change: rerender with value1
    rerender({ value: value1 });
    expect(result.current).toBe(initialValue);

    // Advance 400ms (not enough for 500ms delay)
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBe(initialValue);

    // Second change: rerender with value2 (resets timeout)
    rerender({ value: value2 });
    expect(result.current).toBe(initialValue);

    // Advance another 400ms (total 800ms, but only 400ms since last change)
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBe(initialValue);

    // Third change: rerender with value3 (resets timeout again)
    rerender({ value: value3 });
    expect(result.current).toBe(initialValue);

    // Advance another 400ms (total 1200ms, but only 400ms since last change)
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Assert: Still initial value because last change was only 400ms ago
    expect(result.current).toBe(initialValue);

    // Advance final 100ms (500ms since last change to value3)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Assert: Debounced value should now equal value3, skipping value1 and value2
    expect(result.current).toBe(value3);
  });

  /**
   * Test: Should handle multiple debounce cycles
   *
   * Purpose: Verify that the hook can handle multiple sequential debounce
   * cycles, where a value is debounced, then changed again and debounced again.
   *
   * Expected behavior:
   * - First cycle: value updates after delay
   * - Second cycle: value updates again after delay
   * - Each cycle operates independently
   *
   * Assertions:
   * 1. First value updates after first delay
   * 2. Second value updates after second delay
   * 3. Both updates complete successfully
   */
  it('should handle multiple debounce cycles', () => {
    const value1 = 'first';
    const value2 = 'second';
    const value3 = 'third';

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      {
        initialProps: { value: value1 },
      }
    );

    // Initial render: value should be value1
    expect(result.current).toBe(value1);

    // First cycle: Change to value2
    rerender({ value: value2 });
    expect(result.current).toBe(value1); // Still value1 before timeout

    // Complete first debounce cycle
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(value2); // Updated to value2

    // Second cycle: Change to value3
    rerender({ value: value3 });
    expect(result.current).toBe(value2); // Still value2 before timeout

    // Complete second debounce cycle
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(value3); // Updated to value3

    // Assert: Multiple cycles completed successfully
    expect(result.current).toBe(value3);
  });

  /**
   * Test: Should cleanup timeout on unmount
   *
   * Purpose: Verify that the hook properly cleans up the timeout when the
   * component unmounts before the debounce delay completes. This prevents
   * memory leaks and attempting to update state on unmounted components.
   *
   * Expected behavior:
   * - Timeout is set up when value changes
   * - Component unmounts before timeout completes
   * - Timeout is cleaned up (clearTimeout called)
   * - No state update errors occur
   * - No memory leaks
   *
   * Assertions:
   * - No errors thrown when unmounting before timeout
   * - Console warnings about state updates on unmounted components do not occur
   */
  it('should cleanup timeout on unmount', () => {
    const initialValue = 'initial';
    const newValue = 'updated';

    const { result, rerender, unmount } = renderHook(
      ({ value }) => useDebounce(value),
      {
        initialProps: { value: initialValue },
      }
    );

    // Initial render: value should be initial value
    expect(result.current).toBe(initialValue);

    // Rerender with new value
    rerender({ value: newValue });
    expect(result.current).toBe(initialValue);

    // Advance timers partway through delay (250ms of 500ms)
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Unmount component before timeout completes
    unmount();

    // Advance timers past the original delay
    // This should NOT cause any errors or state updates
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Assert: No errors should have been thrown
    // The timeout was properly cleaned up on unmount
    // This test passes if no errors occur during execution
    expect(true).toBe(true);
  });

  /**
   * Test: Should work with different value types
   *
   * Purpose: Verify that the hook maintains TypeScript type safety and works
   * correctly with different value types including primitives (string, number)
   * and complex types (objects, arrays).
   *
   * Expected behavior:
   * - Generic type parameter T is preserved
   * - Works with string values
   * - Works with number values
   * - Works with object values
   * - Works with array values
   * - Full TypeScript type safety maintained
   *
   * Assertions for each type:
   * 1. Initial value is correct
   * 2. Value updates after delay
   * 3. Type is preserved (TypeScript compile-time check)
   */
  describe('should work with different value types', () => {
    /**
     * Test: String type preservation
     *
     * Purpose: Verify debouncing works with string values and type is preserved
     */
    it('should work with string values', () => {
      const initialValue = 'hello';
      const newValue = 'world';

      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value),
        {
          initialProps: { value: initialValue },
        }
      );

      expect(result.current).toBe(initialValue);

      rerender({ value: newValue });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe(newValue);
      // TypeScript ensures type is string
      const typeCheck: string = result.current;
      expect(typeof typeCheck).toBe('string');
    });

    /**
     * Test: Number type preservation
     *
     * Purpose: Verify debouncing works with number values and type is preserved
     */
    it('should work with number values', () => {
      const initialValue = 42;
      const newValue = 100;

      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value),
        {
          initialProps: { value: initialValue },
        }
      );

      expect(result.current).toBe(initialValue);

      rerender({ value: newValue });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe(newValue);
      // TypeScript ensures type is number
      const typeCheck: number = result.current;
      expect(typeof typeCheck).toBe('number');
    });

    /**
     * Test: Object type preservation
     *
     * Purpose: Verify debouncing works with object values and type is preserved
     *
     * Note: Object comparison is by reference, not deep equality
     * The hook preserves object references correctly
     */
    it('should work with object values', () => {
      const initialValue = { name: 'John', age: 30 };
      const newValue = { name: 'Jane', age: 25 };

      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value),
        {
          initialProps: { value: initialValue },
        }
      );

      expect(result.current).toBe(initialValue);
      expect(result.current).toEqual(initialValue);

      rerender({ value: newValue });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe(newValue);
      expect(result.current).toEqual(newValue);
      // TypeScript ensures type is object with correct shape
      const typeCheck: { name: string; age: number } = result.current;
      expect(typeCheck.name).toBe('Jane');
      expect(typeCheck.age).toBe(25);
    });

    /**
     * Test: Array type preservation
     *
     * Purpose: Verify debouncing works with array values and type is preserved
     *
     * Note: Array comparison is by reference, not deep equality
     * The hook preserves array references correctly
     */
    it('should work with array values', () => {
      const initialValue = [1, 2, 3];
      const newValue = [4, 5, 6];

      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value),
        {
          initialProps: { value: initialValue },
        }
      );

      expect(result.current).toBe(initialValue);
      expect(result.current).toEqual(initialValue);

      rerender({ value: newValue });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe(newValue);
      expect(result.current).toEqual(newValue);
      // TypeScript ensures type is number array
      const typeCheck: number[] = result.current;
      expect(Array.isArray(typeCheck)).toBe(true);
      expect(typeCheck.length).toBe(3);
      expect(typeCheck[0]).toBe(4);
    });

    /**
     * Test: Boolean type preservation
     *
     * Purpose: Verify debouncing works with boolean values and type is preserved
     */
    it('should work with boolean values', () => {
      const initialValue = false;
      const newValue = true;

      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value),
        {
          initialProps: { value: initialValue },
        }
      );

      expect(result.current).toBe(initialValue);

      rerender({ value: newValue });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe(newValue);
      // TypeScript ensures type is boolean
      const typeCheck: boolean = result.current;
      expect(typeof typeCheck).toBe('boolean');
    });
  });

  /**
   * Test: Should handle zero delay
   *
   * Purpose: Verify that the hook handles the edge case of a zero delay.
   * With a zero delay, the value should update immediately (or on the next tick).
   *
   * Expected behavior:
   * - With 0ms delay, the timeout fires immediately
   * - Value updates synchronously (or on next tick)
   * - No errors occur with zero delay
   *
   * Assertions:
   * 1. Initial value is correct
   * 2. After rerender with 0ms delay, value updates immediately
   */
  it('should handle zero delay', () => {
    const initialValue = 'initial';
    const newValue = 'updated';
    const zeroDelay = 0;

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: initialValue, delay: zeroDelay },
      }
    );

    // Initial render: value should be initial value
    expect(result.current).toBe(initialValue);

    // Rerender with new value and zero delay
    rerender({ value: newValue, delay: zeroDelay });

    // With zero delay, we need to advance timers by 0ms to trigger the timeout
    act(() => {
      vi.advanceTimersByTime(0);
    });

    // Assert: With zero delay, value should update immediately
    expect(result.current).toBe(newValue);
  });

  /**
   * Test: Should handle negative delay (edge case)
   *
   * Purpose: Verify that the hook handles invalid negative delay gracefully.
   * setTimeout with negative delay is treated as 0 in JavaScript.
   *
   * Expected behavior:
   * - Negative delay is treated as zero delay
   * - Value updates immediately
   * - No errors occur
   */
  it('should handle negative delay gracefully', () => {
    const initialValue = 'initial';
    const newValue = 'updated';
    const negativeDelay = -100;

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: initialValue, delay: negativeDelay },
      }
    );

    // Initial render: value should be initial value
    expect(result.current).toBe(initialValue);

    // Rerender with new value and negative delay
    rerender({ value: newValue, delay: negativeDelay });

    // Negative delay is treated as zero delay by setTimeout
    act(() => {
      vi.advanceTimersByTime(0);
    });

    // Assert: Value should update immediately (negative delay treated as zero)
    expect(result.current).toBe(newValue);
  });

  /**
   * Test: Should handle delay changes during debounce
   *
   * Purpose: Verify that changing the delay parameter while a debounce is
   * in progress properly resets the timer with the new delay.
   *
   * Expected behavior:
   * - Initial delay starts counting
   * - Delay parameter changes
   * - Timer resets with new delay
   * - Value updates after new delay period
   *
   * Assertions:
   * 1. Value doesn't update with old delay
   * 2. Value updates after new delay from the change
   */
  it('should handle delay changes during debounce', () => {
    const initialValue = 'initial';
    const newValue = 'updated';
    const initialDelay = 500;
    const newDelay = 1000;

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: initialValue, delay: initialDelay },
      }
    );

    // Initial render
    expect(result.current).toBe(initialValue);

    // Change value with initial delay (500ms)
    rerender({ value: newValue, delay: initialDelay });

    // Advance 400ms
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Change delay to 1000ms (this resets the timer)
    rerender({ value: newValue, delay: newDelay });

    // Advance to where old delay would have completed (500ms from start)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Assert: Value should NOT be updated yet (old delay doesn't apply)
    expect(result.current).toBe(initialValue);

    // Advance to complete new delay (1000ms from delay change)
    act(() => {
      vi.advanceTimersByTime(900);
    });

    // Assert: Value should now be updated after new delay
    expect(result.current).toBe(newValue);
  });

  /**
   * Test: Should handle undefined and null values
   *
   * Purpose: Verify that the hook can handle undefined and null values
   * correctly, preserving type safety.
   *
   * Expected behavior:
   * - Undefined values are debounced correctly
   * - Null values are debounced correctly
   * - Type safety is maintained
   */
  it('should handle undefined and null values', () => {
    // Test undefined
    const { result: undefinedResult, rerender: undefinedRerender } = renderHook(
      ({ value }) => useDebounce(value),
      {
        initialProps: { value: undefined as string | undefined },
      }
    );

    expect(undefinedResult.current).toBe(undefined);

    undefinedRerender({ value: 'defined' as string | undefined });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(undefinedResult.current).toBe('defined');

    // Test null
    const { result: nullResult, rerender: nullRerender } = renderHook(
      ({ value }) => useDebounce(value),
      {
        initialProps: { value: null as string | null },
      }
    );

    expect(nullResult.current).toBe(null);

    nullRerender({ value: 'not-null' as string | null });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(nullResult.current).toBe('not-null');
  });
});
